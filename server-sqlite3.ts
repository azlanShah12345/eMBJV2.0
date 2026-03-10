import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JWT_SECRET = 'mbj-secret-key-2024';

const normalizeMinitPath = (minitPath: string | null | undefined) => {
  if (!minitPath) return null;
  const normalized = minitPath.replace(/\\/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });

  // Initialize Database
  console.log('Initializing database (sqlite3)...');
  const db = await open({
    filename: 'mbj_system.db',
    driver: sqlite3.Database
  });
  
  await db.run('PRAGMA foreign_keys = ON');

  // Create Tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      name TEXT NOT NULL UNIQUE
    );
    
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      username TEXT NOT NULL UNIQUE, 
      password TEXT NOT NULL, 
      role TEXT NOT NULL, 
      department_id INTEGER,
      FOREIGN KEY(department_id) REFERENCES departments(id)
    );
    
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      bil_mesyuarat TEXT NOT NULL, 
      tarikh_mesyuarat TEXT NOT NULL, 
      department_id INTEGER NOT NULL, 
      minit_path TEXT,
      submission_method TEXT,
      is_locked INTEGER DEFAULT 0,
      unlock_requested INTEGER DEFAULT 0,
      unlock_rejected INTEGER DEFAULT 0,
      delete_requested INTEGER DEFAULT 0,
      delete_rejected INTEGER DEFAULT 0,
      created_by INTEGER,
      FOREIGN KEY(department_id) REFERENCES departments(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    );
    
    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      meeting_id INTEGER NOT NULL, 
      category TEXT NOT NULL, 
      title TEXT NOT NULL, 
      status TEXT NOT NULL,
      FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `);

  // Ensure columns exist (migrations)
  const migrations = [
    'ALTER TABLE meetings ADD COLUMN minit_path TEXT',
    'ALTER TABLE meetings ADD COLUMN submission_method TEXT',
    'ALTER TABLE meetings ADD COLUMN unlock_requested INTEGER DEFAULT 0',
    'ALTER TABLE meetings ADD COLUMN unlock_rejected INTEGER DEFAULT 0',
    'ALTER TABLE meetings ADD COLUMN delete_requested INTEGER DEFAULT 0',
    'ALTER TABLE meetings ADD COLUMN delete_rejected INTEGER DEFAULT 0'
  ];

  for (const sql of migrations) {
    try {
      await db.run(sql);
    } catch (e) {
      // Column likely already exists
    }
  }

  // Seed Admin User
  const adminExists = await db.get('SELECT * FROM users WHERE username = ?', 'admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', 'admin', hash, 'ADMIN');
  }

  // Seed Departments
  const deptCountObj = await db.get('SELECT COUNT(*) as count FROM departments');
  if (deptCountObj.count === 0) {
    for (const name of ['HQ', 'IT', 'HR', 'FINANCE']) {
      await db.run('INSERT INTO departments (name) VALUES (?)', name);
    }
  }

  // Seed Categories
  const catCountObj = await db.get('SELECT COUNT(*) as count FROM categories');
  if (catCountObj.count === 0) {
    for (const name of ['Kebajikan', 'Perjawatan', 'Kewangan', 'Infrastruktur', 'Lain-lain']) {
      await db.run('INSERT INTO categories (name) VALUES (?)', name);
    }
  }

  // Backfill any legacy issues that stored a category id string instead of the category name.
  await db.run(`
    UPDATE issues
    SET category = (
      SELECT name
      FROM categories
      WHERE categories.id = CAST(issues.category AS INTEGER)
    )
    WHERE category GLOB '[0-9]*'
      AND EXISTS (
        SELECT 1
        FROM categories
        WHERE categories.id = CAST(issues.category AS INTEGER)
      )
  `);

  const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.pdf';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    }
  });
  const upload = multer({ storage });

  app.use(cors());
  app.use(express.json());
  app.get('/uploads/:filename', (req, res) => {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.resolve('uploads', safeFilename);
    res.type('application/pdf');
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: 'File not found' });
      }
    });
  });
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
    next();
  };

  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await db.get(`
      SELECT u.*, d.name as department_name 
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id 
      WHERE u.username = ?
    `, username);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, department_id: user.department_id }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, department_id: user.department_id, department_name: user.department_name } });
  });

  app.post('/api/change-password', authenticate, async (req: any, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (String(new_password).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await db.get('SELECT id, password FROM users WHERE id = ?', req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!bcrypt.compareSync(current_password, user.password)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hash = bcrypt.hashSync(new_password, 10);
    await db.run('UPDATE users SET password = ? WHERE id = ?', hash, req.user.id);
    res.json({ success: true });
  });

  app.get('/api/users', authenticate, isAdmin, async (req, res) => {
    const users = await db.all('SELECT u.id, u.username, u.role, u.department_id, d.name as department_name FROM users u LEFT JOIN departments d ON u.department_id = d.id');
    res.json(users);
  });

  app.post('/api/users', authenticate, isAdmin, async (req, res) => {
    const { username, password, role, department_id } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    try {
      const result = await db.run('INSERT INTO users (username, password, role, department_id) VALUES (?, ?, ?, ?)', username, hash, role, department_id);
      res.json({ id: result.lastID });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/users/:id', authenticate, isAdmin, async (req, res) => {
    await db.run('DELETE FROM users WHERE id = ?', req.params.id);
    res.json({ success: true });
  });

  app.get('/api/departments', authenticate, async (req, res) => {
    const departments = await db.all('SELECT * FROM departments');
    res.json(departments);
  });

  app.post('/api/departments', authenticate, isAdmin, async (req, res) => {
    const { name } = req.body;
    try {
      const result = await db.run('INSERT INTO departments (name) VALUES (?)', name);
      res.json({ id: result.lastID });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/departments/:id', authenticate, isAdmin, async (req, res) => {
    await db.run('DELETE FROM departments WHERE id = ?', req.params.id);
    res.json({ success: true });
  });

  app.get('/api/categories', authenticate, async (req, res) => {
    const categories = await db.all('SELECT * FROM categories');
    res.json(categories);
  });

  app.post('/api/categories', authenticate, isAdmin, async (req, res) => {
    const { name } = req.body;
    try {
      const result = await db.run('INSERT INTO categories (name) VALUES (?)', name);
      res.json({ id: result.lastID });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/categories/:id', authenticate, isAdmin, async (req, res) => {
    await db.run('DELETE FROM categories WHERE id = ?', req.params.id);
    res.json({ success: true });
  });

  app.get('/api/meetings', authenticate, async (req: any, res) => {
    let { department_id } = req.query;
    if (req.user.role !== 'ADMIN') department_id = req.user.department_id;
    let meetings;
    if (department_id) {
      meetings = await db.all(`
        SELECT m.*, d.name as department_name,
               (SELECT COUNT(*) FROM issues WHERE meeting_id = m.id) as total_issues,
               (SELECT COUNT(*) FROM issues WHERE meeting_id = m.id AND status = 'Selesai') as completed_issues,
               (SELECT GROUP_CONCAT(DISTINCT category) FROM issues WHERE meeting_id = m.id) as issue_categories
        FROM meetings m JOIN departments d ON m.department_id = d.id WHERE m.department_id = ?
      `, department_id);
    } else {
      meetings = await db.all(`
        SELECT m.*, d.name as department_name,
               (SELECT COUNT(*) FROM issues WHERE meeting_id = m.id) as total_issues,
               (SELECT COUNT(*) FROM issues WHERE meeting_id = m.id AND status = 'Selesai') as completed_issues,
               (SELECT GROUP_CONCAT(DISTINCT category) FROM issues WHERE meeting_id = m.id) as issue_categories
        FROM meetings m JOIN departments d ON m.department_id = d.id
      `);
    }
    res.json(meetings.map((meeting: any) => ({
      ...meeting,
      minit_path: normalizeMinitPath(meeting.minit_path),
    })));
  });

  app.post('/api/meetings', authenticate, upload.single('minit'), async (req: any, res) => {
    const { bil_mesyuarat, tarikh_mesyuarat, submission_method } = req.body;
    const department_id = req.user.role === 'ADMIN' ? (req.body.department_id || req.user.department_id) : req.user.department_id;
    const minit_path = req.file ? `/uploads/${path.basename(req.file.path)}` : null;
    
    const result = await db.run(
      'INSERT INTO meetings (bil_mesyuarat, tarikh_mesyuarat, department_id, created_by, minit_path, submission_method, unlock_requested, unlock_rejected, delete_requested, delete_rejected) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0)', 
      bil_mesyuarat, tarikh_mesyuarat, department_id, req.user.id, minit_path, submission_method || null
    );
    res.json({ id: result.lastID });
  });

  app.delete('/api/meetings/:id', authenticate, async (req: any, res) => {
    const meetingId = req.params.id;
    console.log(`[DELETE] Request for meeting ${meetingId} by ${req.user.username}`);
    
    const meeting = await db.get('SELECT * FROM meetings WHERE id = ?', meetingId);
    if (!meeting) {
      console.log(`[DELETE] Meeting ${meetingId} not found`);
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Admin can delete anything
    if (req.user.role === 'ADMIN') {
      console.log(`[DELETE] Admin ${req.user.username} deleting meeting ${meetingId}`);
      await db.run('DELETE FROM meetings WHERE id = ?', meetingId);
      return res.json({ success: true });
    }

    // Department user can only delete their own
    const meetingDeptId = Number(meeting.department_id);
    const userDeptId = Number(req.user.department_id);
    
    if (meetingDeptId !== userDeptId) {
      console.log(`[DELETE] Access denied for ${req.user.username}: Meeting Dept ${meetingDeptId} vs User Dept ${userDeptId}`);
      return res.status(403).json({ error: `Access denied: This meeting belongs to department ID ${meetingDeptId}, but you are in department ID ${userDeptId}.` });
    }

    // If locked, cannot delete directly
    if (meeting.is_locked) {
      console.log(`[DELETE] Meeting ${meetingId} is locked`);
      return res.status(403).json({ error: 'Meeting is locked. Request delete permission from HQ.' });
    }

    console.log(`[DELETE] User ${req.user.username} deleting meeting ${meetingId}`);
    await db.run('DELETE FROM meetings WHERE id = ?', meetingId);
    res.json({ success: true });
  });

  app.post('/api/meetings/:id/request-delete', authenticate, async (req: any, res) => {
    const meetingId = req.params.id;
    const meeting = await db.get('SELECT * FROM meetings WHERE id = ?', meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await db.run("UPDATE meetings SET delete_requested = 1, delete_rejected = 0 WHERE id = ?", meetingId);
    res.json({ success: true });
  });

  app.post('/api/meetings/:id/approve-delete', authenticate, isAdmin, async (req, res) => {
    await db.run("DELETE FROM meetings WHERE id = ?", req.params.id);
    res.json({ success: true });
  });

  app.post('/api/meetings/:id/reject-delete', authenticate, isAdmin, async (req, res) => {
    await db.run("UPDATE meetings SET delete_requested = 0, delete_rejected = 1 WHERE id = ?", req.params.id);
    res.json({ success: true });
  });

  app.get('/api/meetings/:id', authenticate, async (req: any, res) => {
    const meeting = await db.get(`
      SELECT m.*, d.name as department_name 
      FROM meetings m 
      JOIN departments d ON m.department_id = d.id 
      WHERE m.id = ?
    `, req.params.id);
    
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({
      ...meeting,
      minit_path: normalizeMinitPath(meeting.minit_path),
    });
  });

  app.get('/api/meetings/:id/issues', authenticate, async (req: any, res) => {
    const meetingId = req.params.id;
    const meeting = await db.get('SELECT * FROM meetings WHERE id = ?', meetingId);
    
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const issues = await db.all('SELECT * FROM issues WHERE meeting_id = ?', meetingId);
    res.json(issues);
  });

  app.post('/api/meetings/:id/issues', authenticate, async (req: any, res) => {
    const meetingId = req.params.id;
    const meeting = await db.get('SELECT * FROM meetings WHERE id = ?', meetingId);
    
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (meeting.is_locked) return res.status(403).json({ error: 'Meeting is locked' });

    const { category, title, status } = req.body;
    const result = await db.run('INSERT INTO issues (meeting_id, category, title, status) VALUES (?, ?, ?, ?)', meetingId, category, title, status);
    res.json({ id: result.lastID });
  });

  app.patch('/api/issues/:id', authenticate, async (req: any, res) => {
    const issueId = req.params.id;
    const issue = await db.get(`
      SELECT i.*, m.department_id, m.is_locked 
      FROM issues i 
      JOIN meetings m ON i.meeting_id = m.id 
      WHERE i.id = ?
    `, issueId);

    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    if (req.user.role !== 'ADMIN' && Number(issue.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (issue.is_locked) return res.status(403).json({ error: 'Meeting is locked' });

    const { status, title, category } = req.body;
    const updates = [];
    const params = [];
    if (status) { updates.push('status = ?'); params.push(status); }
    if (title) { updates.push('title = ?'); params.push(title); }
    if (category) { updates.push('category = ?'); params.push(category); }
    params.push(issueId);
    await db.run(`UPDATE issues SET ${updates.join(', ')} WHERE id = ?`, ...params);
    res.json({ success: true });
  });

  app.delete('/api/issues/:id', authenticate, async (req: any, res) => {
    const issueId = req.params.id;
    const issue = await db.get(`
      SELECT i.*, m.department_id, m.is_locked 
      FROM issues i 
      JOIN meetings m ON i.meeting_id = m.id 
      WHERE i.id = ?
    `, issueId);

    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    if (req.user.role !== 'ADMIN' && Number(issue.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (issue.is_locked) return res.status(403).json({ error: 'Meeting is locked' });

    await db.run('DELETE FROM issues WHERE id = ?', issueId);
    res.json({ success: true });
  });

  app.patch('/api/meetings/:id/lock', authenticate, isAdmin, async (req, res) => {
    await db.run("UPDATE meetings SET is_locked = 1, unlock_requested = 0, unlock_rejected = 0 WHERE id = ?", req.params.id);
    res.json({ success: true });
  });

  app.post('/api/meetings/:id/submit', authenticate, async (req: any, res) => {
    const meetingId = req.params.id;
    console.log(`[SUBMIT] Request for meeting ${meetingId} by ${req.user.username}`);
    
    const meeting = await db.get('SELECT * FROM meetings WHERE id = ?', meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      console.log(`[SUBMIT] Access denied for ${req.user.username}: Meeting Dept ${meeting.department_id} vs User Dept ${req.user.department_id}`);
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await db.run("UPDATE meetings SET is_locked = 1, unlock_requested = 0, unlock_rejected = 0, delete_requested = 0, delete_rejected = 0 WHERE id = ?", meetingId);
    console.log(`[SUBMIT] Meeting ${meetingId} submitted successfully`);
    res.json({ success: true });
  });

  app.post('/api/meetings/:id/request-unlock', authenticate, async (req: any, res) => {
    const meetingId = req.params.id;
    const meeting = await db.get('SELECT * FROM meetings WHERE id = ?', meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (req.user.role !== 'ADMIN' && meeting.department_id !== req.user.department_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await db.run("UPDATE meetings SET unlock_requested = 1, unlock_rejected = 0 WHERE id = ?", meetingId);
    res.json({ success: true });
  });

  app.post('/api/meetings/:id/approve-unlock', authenticate, isAdmin, async (req, res) => {
    await db.run("UPDATE meetings SET is_locked = 0, unlock_requested = 0, unlock_rejected = 0 WHERE id = ?", req.params.id);
    res.json({ success: true });
  });

  app.post('/api/meetings/:id/reject-unlock', authenticate, isAdmin, async (req, res) => {
    await db.run("UPDATE meetings SET unlock_requested = 0, unlock_rejected = 1 WHERE id = ?", req.params.id);
    res.json({ success: true });
  });

  app.get('/api/stats', authenticate, async (req: any, res) => {
    let { department_id, bil_mesyuarat, category } = req.query;
    if (req.user.role !== 'ADMIN') department_id = req.user.department_id;

    let filteredIssuesQuery = `
      SELECT i.category, i.status
      FROM issues i
      JOIN meetings m ON i.meeting_id = m.id
      WHERE m.is_locked = 1
    `;
    const params = [];
    if (department_id) {
      filteredIssuesQuery += ' AND m.department_id = ?';
      params.push(department_id);
    }
    if (bil_mesyuarat) {
      filteredIssuesQuery += ' AND m.bil_mesyuarat = ?';
      params.push(bil_mesyuarat);
    }
    if (category) {
      filteredIssuesQuery += ' AND i.category = ?';
      params.push(category);
    }

    const categoryListQuery = category
      ? 'SELECT ? AS category'
      : `
        SELECT name AS category FROM categories
        UNION
        SELECT DISTINCT category FROM filtered_issues
      `;

    const stats = await db.all(`
      WITH filtered_issues AS (
        ${filteredIssuesQuery}
      ),
      category_list AS (
        ${categoryListQuery}
      )
      SELECT
        c.category,
        COUNT(fi.category) AS total,
        SUM(CASE WHEN fi.status = 'Selesai' THEN 1 ELSE 0 END) AS selesai,
        SUM(CASE WHEN fi.status IS NOT NULL AND fi.status != 'Selesai' THEN 1 ELSE 0 END) AS belum_selesai
      FROM category_list c
      LEFT JOIN filtered_issues fi ON fi.category = c.category
      GROUP BY c.category
      ORDER BY c.category
    `, ...(category ? [...params, category] : params));
    res.json(stats);
  });

  app.get('/api/reports/pengelasan', authenticate, async (req: any, res) => {
    let { department_id, bil_mesyuarat, category } = req.query;
    if (req.user.role !== 'ADMIN') department_id = req.user.department_id;

    let issueQuery = `
      SELECT i.category, i.is_from_previous, i.title, i.status, i.responsible_officer
      FROM issues i
      JOIN meetings m ON i.meeting_id = m.id
      WHERE m.is_locked = 1
    `;
    const params: any[] = [];
    if (department_id) {
      issueQuery += ' AND m.department_id = ?';
      params.push(department_id);
    }
    if (bil_mesyuarat) {
      issueQuery += ' AND m.bil_mesyuarat = ?';
      params.push(bil_mesyuarat);
    }
    if (category) {
      issueQuery += ' AND i.category = ?';
      params.push(category);
    }
    issueQuery += ' ORDER BY i.category, i.id';

    const [issues, categories, department] = await Promise.all([
      db.all(issueQuery, ...params),
      db.all('SELECT name FROM categories ORDER BY id ASC, name ASC'),
      department_id ? db.get('SELECT name FROM departments WHERE id = ?', department_id) : Promise.resolve(undefined),
    ]);

    const categoryNames = (category
      ? [String(category)]
      : [
          ...categories.map((row: any) => String(row.name || '').trim()).filter(Boolean),
          ...Array.from(new Set(issues.map((row: any) => String(row.category || '').trim()).filter(Boolean))),
        ]
    ).filter((value, index, array) => array.indexOf(value) === index);

    const rowsMap = new Map<string, {
      category: string;
      previous_selesai_titles: string[];
      previous_belum_titles: string[];
      new_selesai_titles: string[];
      new_belum_titles: string[];
    }>();

    categoryNames.forEach((name) => {
      rowsMap.set(name, {
        category: name,
        previous_selesai_titles: [],
        previous_belum_titles: [],
        new_selesai_titles: [],
        new_belum_titles: [],
      });
    });

    issues.forEach((issue: any) => {
      const categoryName = String(issue.category || '').trim();
      if (!categoryName) return;
      const row = rowsMap.get(categoryName) || {
        category: categoryName,
        previous_selesai_titles: [],
        previous_belum_titles: [],
        new_selesai_titles: [],
        new_belum_titles: [],
      };
      const title = `${String(issue.title || '').trim()}${issue.responsible_officer ? ` (${String(issue.responsible_officer).trim()})` : ''}`.trim();
      if (Number(issue.is_from_previous) === 1) {
        if (issue.status === 'Selesai') {
          row.previous_selesai_titles.push(title);
        } else {
          row.previous_belum_titles.push(title);
        }
      } else if (issue.status === 'Selesai') {
        row.new_selesai_titles.push(title);
      } else {
        row.new_belum_titles.push(title);
      }
      rowsMap.set(categoryName, row);
    });

    const rows = Array.from(rowsMap.values());
    const totals = rows.reduce((acc, row) => {
      acc.previous_selesai += row.previous_selesai_titles.length;
      acc.previous_belum += row.previous_belum_titles.length;
      acc.new_selesai += row.new_selesai_titles.length;
      acc.new_belum += row.new_belum_titles.length;
      return acc;
    }, {
      previous_selesai: 0,
      previous_belum: 0,
      new_selesai: 0,
      new_belum: 0,
    });

    res.json({
      department_name: department?.name || 'Semua Jabatan',
      meeting_label: bil_mesyuarat ? String(bil_mesyuarat) : 'Semua Mesyuarat',
      report_year: new Date().getFullYear(),
      rows,
      totals: {
        ...totals,
        overall: totals.previous_selesai + totals.previous_belum + totals.new_selesai + totals.new_belum,
      },
    });
  });

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

startServer().catch(console.error);
