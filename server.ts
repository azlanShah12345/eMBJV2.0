console.log('Server script starting...');
import express from 'express';

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JWT_SECRET = 'mbj-secret-key-2024';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
    console.log('Application port opened, initializing background tasks...');
  });

  // Initialize Database
  console.log('Initializing database...');
  let db: Database.Database;
  try {
    db = new Database('mbj_system.db');
    // We'll enable foreign keys AFTER migrations to be safe
    db.pragma('foreign_keys = OFF');
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization failed:', err);
    throw err;
  }

  // Create Tables
  db.exec(`
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
      FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      bil_mesyuarat TEXT NOT NULL, 
      tarikh_mesyuarat TEXT NOT NULL, 
      department_id INTEGER NOT NULL, 
      is_locked INTEGER DEFAULT 0,
      unlock_requested INTEGER DEFAULT 0,
      delete_requested INTEGER DEFAULT 0,
      minit_path TEXT,
      created_by INTEGER,
      FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE CASCADE,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
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

    CREATE TABLE IF NOT EXISTS meeting_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meeting_message_reads (
      user_id INTEGER NOT NULL,
      meeting_id INTEGER NOT NULL,
      last_read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, meeting_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );
  `);

  // Ensure columns exist (for existing databases) - DO THIS BEFORE MIGRATION
  try { db.prepare("ALTER TABLE meetings ADD COLUMN unlock_requested INTEGER DEFAULT 0").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE meetings ADD COLUMN delete_requested INTEGER DEFAULT 0").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE meetings ADD COLUMN minit_path TEXT").run(); } catch(e) {}

  // Migration: Check if meetings table has ON DELETE SET NULL for created_by
  try {
    const meetingsRow = db.prepare("SELECT sql FROM sqlite_master WHERE name='meetings'").get();
    if (meetingsRow && meetingsRow.sql) {
      const meetingsSchema = meetingsRow.sql;
      if (!meetingsSchema.includes('ON DELETE SET NULL') || !meetingsSchema.includes('ON DELETE CASCADE')) {
        console.log('Migrating meetings table schema...');
        db.transaction(() => {
          db.exec(`
            CREATE TABLE meetings_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT, 
              bil_mesyuarat TEXT NOT NULL, 
              tarikh_mesyuarat TEXT NOT NULL, 
              department_id INTEGER NOT NULL, 
              is_locked INTEGER DEFAULT 0,
              unlock_requested INTEGER DEFAULT 0,
              delete_requested INTEGER DEFAULT 0,
              minit_path TEXT,
              created_by INTEGER,
              FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE CASCADE,
              FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
            );
            INSERT INTO meetings_new (id, bil_mesyuarat, tarikh_mesyuarat, department_id, is_locked, unlock_requested, delete_requested, minit_path, created_by)
            SELECT id, bil_mesyuarat, tarikh_mesyuarat, department_id, is_locked, unlock_requested, delete_requested, minit_path, created_by FROM meetings;
            DROP TABLE meetings;
            ALTER TABLE meetings_new RENAME TO meetings;
          `);
        })();
        console.log('Meetings table migrated.');
      }
    }
  } catch (err) {
    console.error('Meetings migration failed:', err);
  }

  // Migration: Check if users table has ON DELETE CASCADE
  try {
    const usersRow = db.prepare("SELECT sql FROM sqlite_master WHERE name='users'").get();
    if (usersRow && usersRow.sql) {
      const usersSchema = usersRow.sql;
      if (!usersSchema.includes('ON DELETE CASCADE')) {
        console.log('Migrating users table schema...');
        db.transaction(() => {
          db.exec(`
            CREATE TABLE users_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT, 
              username TEXT NOT NULL UNIQUE, 
              password TEXT NOT NULL, 
              role TEXT NOT NULL, 
              department_id INTEGER,
              FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE CASCADE
            );
            INSERT INTO users_new (id, username, password, role, department_id)
            SELECT id, username, password, role, department_id FROM users;
            DROP TABLE users;
            ALTER TABLE users_new RENAME TO users;
          `);
        })();
        console.log('Users table migrated.');
      }
    }
  } catch (err) {
    console.error('Users migration failed:', err);
  }

  // Re-enable foreign keys after migrations
  db.pragma('foreign_keys = ON');

  // Seed Admin User if not exists
  const adminExists = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hash, 'ADMIN');
  }

  // Seed a Regular User if not exists
  const userExists = db.prepare('SELECT * FROM users WHERE username = ?').get('user1');
  if (!userExists) {
    const hash = bcrypt.hashSync('user123', 10);
    // Assign to IT department (id 2)
    db.prepare('INSERT INTO users (username, password, role, department_id) VALUES (?, ?, ?, ?)').run('user1', hash, 'USER', 2);
  }

  // Seed Departments if empty
  const deptCount = db.prepare('SELECT COUNT(*) as count FROM departments').get().count;
  if (deptCount === 0) {
    ['HQ', 'IT', 'HR', 'FINANCE'].forEach(name => {
      db.prepare('INSERT INTO departments (name) VALUES (?)').run(name);
    });
  }

  // Seed Categories if empty
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (catCount === 0) {
    ['Kebajikan', 'Perjawatan', 'Kewangan', 'Infrastruktur', 'Lain-lain'].forEach(name => {
      db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
    });
  }

  const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });
  const upload = multer({ storage });

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  
  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static('uploads'));

  // Error handling wrapper
  const catchErrors = (fn: any) => async (req: any, res: any, next: any) => {
    try {
      await fn(req, res, next);
    } catch (err: any) {
      console.error('API Error:', err);
      if (!res.headersSent) {
        res.status(err.code === 'SQLITE_CONSTRAINT' ? 400 : 500).json({ 
          error: err.message || 'Internal server error' 
        });
      }
    }
  };

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
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  };

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/login', catchErrors((req: any, res: any) => {
    const { username, password } = req.body;
    const user = db.prepare(`
      SELECT u.*, d.name as department_name 
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id 
      WHERE u.username = ?
    `).get(username);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ 
      id: user.id, 
      username: user.username, 
      role: user.role,
      department_id: user.department_id 
    }, JWT_SECRET);

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        department_id: user.department_id,
        department_name: user.department_name
      } 
    });
  }));

  // User Management
  app.get('/api/users', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    const users = db.prepare(`
      SELECT u.id, u.username, u.role, u.department_id, d.name as department_name 
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id
    `).all();
    res.json(users);
  }));

  app.post('/api/users', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    const { username, password, role, department_id } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, password, role, department_id) VALUES (?, ?, ?, ?)').run(username, hash, role, department_id);
    res.json({ id: result.lastInsertRowid });
  }));

  app.delete('/api/users/:id', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  }));

  // Department Management
  app.get('/api/departments', authenticate, catchErrors((req: any, res: any) => {
    const departments = db.prepare('SELECT * FROM departments').all();
    res.json(departments);
  }));

  app.post('/api/departments', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    const { name } = req.body;
    const result = db.prepare('INSERT INTO departments (name) VALUES (?)').run(name);
    res.json({ id: result.lastInsertRowid });
  }));

  app.delete('/api/departments/:id', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  }));

  // Category Management
  app.get('/api/categories', authenticate, catchErrors((req: any, res: any) => {
    const categories = db.prepare('SELECT * FROM categories').all();
    res.json(categories);
  }));

  app.post('/api/categories', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    const { name } = req.body;
    const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
    res.json({ id: result.lastInsertRowid });
  }));

  app.delete('/api/categories/:id', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  }));

  app.get('/api/meetings', authenticate, catchErrors((req: any, res: any) => {
    let { department_id } = req.query;
    
    // If not admin, force filter by user's department
    if (req.user.role !== 'ADMIN') {
      department_id = req.user.department_id;
    }

    let meetings;
    if (department_id) {
      meetings = db.prepare(`
        SELECT m.*, d.name as department_name,
               (SELECT COUNT(*) FROM issues WHERE meeting_id = m.id) as total_issues,
               (SELECT COUNT(*) FROM issues WHERE meeting_id = m.id AND status = 'Selesai') as completed_issues
        FROM meetings m 
        JOIN departments d ON m.department_id = d.id 
        WHERE m.department_id = ?
        ORDER BY m.tarikh_mesyuarat DESC
      `).all(department_id);
    } else {
      meetings = db.prepare(`
        SELECT m.*, d.name as department_name,
               (SELECT COUNT(*) FROM issues WHERE meeting_id = m.id) as total_issues,
               (SELECT COUNT(*) FROM issues WHERE meeting_id = m.id AND status = 'Selesai') as completed_issues
        FROM meetings m 
        JOIN departments d ON m.department_id = d.id
        ORDER BY m.tarikh_mesyuarat DESC
      `).all();
    }
    res.json(meetings);
  }));

  app.get('/api/meetings/:id', authenticate, catchErrors((req: any, res: any) => {
    const meeting = db.prepare(`
      SELECT m.*, d.name as department_name
      FROM meetings m
      JOIN departments d ON m.department_id = d.id
      WHERE m.id = ?
    `).get(req.params.id);

    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    // Check permissions
    if (req.user.role !== 'ADMIN' && meeting.department_id !== req.user.department_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(meeting);
  }));

  app.post('/api/meetings', authenticate, upload.single('minit'), catchErrors((req: any, res: any) => {
    const { bil_mesyuarat, tarikh_mesyuarat } = req.body;
    const department_id = req.body.department_id || req.user.department_id;
    const minit_path = req.file ? `/uploads/${req.file.filename}` : null;
    
    if (!department_id) {
      return res.status(400).json({ error: 'Department ID is required' });
    }

    const result = db.prepare(`
      INSERT INTO meetings (bil_mesyuarat, tarikh_mesyuarat, department_id, created_by, minit_path) 
      VALUES (?, ?, ?, ?, ?)
    `).run(bil_mesyuarat, tarikh_mesyuarat, department_id, req.user.id, minit_path);
    res.json({ id: result.lastInsertRowid });
  }));

  app.get('/api/meetings/:id/issues', authenticate, catchErrors((req: any, res: any) => {
    const issues = db.prepare('SELECT * FROM issues WHERE meeting_id = ?').all(req.params.id);
    res.json(issues);
  }));

  app.post('/api/meetings/:id/issues', authenticate, catchErrors((req: any, res: any) => {
    const { category, title, status } = req.body;
    const result = db.prepare(`
      INSERT INTO issues (meeting_id, category, title, status) 
      VALUES (?, ?, ?, ?)
    `).run(req.params.id, category, title, status);
    res.json({ id: result.lastInsertRowid });
  }));

  app.get('/api/meetings/:id/messages', authenticate, catchErrors((req: any, res: any) => {
    const meeting = db.prepare('SELECT id, department_id FROM meetings WHERE id = ?').get(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = db.prepare(`
      SELECT
        mm.id,
        mm.meeting_id,
        mm.user_id,
        mm.message,
        mm.created_at,
        u.username,
        u.role as user_role,
        d.name as department_name
      FROM meeting_messages mm
      JOIN users u ON u.id = mm.user_id
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE mm.meeting_id = ?
      ORDER BY mm.created_at ASC, mm.id ASC
    `).all(req.params.id);

    res.json(messages);
  }));

  app.post('/api/meetings/:id/messages', authenticate, catchErrors((req: any, res: any) => {
    const meeting = db.prepare('SELECT id, department_id FROM meetings WHERE id = ?').get(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const message = String(req.body.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'Mesej tidak boleh kosong' });
    }

    const result = db.prepare(`
      INSERT INTO meeting_messages (meeting_id, user_id, message)
      VALUES (?, ?, ?)
    `).run(req.params.id, req.user.id, message);
    res.json({ id: result.lastInsertRowid });
  }));

  app.post('/api/meetings/:id/messages/read', authenticate, catchErrors((req: any, res: any) => {
    const meeting = db.prepare('SELECT id, department_id FROM meetings WHERE id = ?').get(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    db.prepare(`
      INSERT INTO meeting_message_reads (user_id, meeting_id, last_read_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, meeting_id) DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
    `).run(req.user.id, req.params.id);

    res.json({ success: true });
  }));

  app.get('/api/messages/unread-summary', authenticate, catchErrors((req: any, res: any) => {
    const queryParams: any[] = [req.user.id, req.user.id, req.user.id];
    let departmentFilter = '';
    if (req.user.role !== 'ADMIN') {
      departmentFilter = 'AND m.department_id = ?';
      queryParams.push(Number(req.user.department_id));
    }

    const items = db.prepare(`
      WITH latest_messages AS (
        SELECT
          mm.meeting_id,
          mm.message,
          mm.created_at,
          ROW_NUMBER() OVER (PARTITION BY mm.meeting_id ORDER BY mm.created_at DESC, mm.id DESC) AS rn
        FROM meeting_messages mm
        WHERE mm.user_id <> ?
      ),
      unread_counts AS (
        SELECT
          mm.meeting_id,
          m.bil_mesyuarat,
          d.name AS department_name,
          COUNT(*) AS unread_count,
          MAX(mm.created_at) AS last_message_at
        FROM meeting_messages mm
        JOIN meetings m ON m.id = mm.meeting_id
        JOIN departments d ON d.id = m.department_id
        LEFT JOIN meeting_message_reads mmr
          ON mmr.meeting_id = mm.meeting_id
          AND mmr.user_id = ?
        WHERE mm.user_id <> ?
          AND datetime(mm.created_at) > datetime(COALESCE(mmr.last_read_at, '1970-01-01 00:00:00'))
          ${departmentFilter}
        GROUP BY mm.meeting_id, m.bil_mesyuarat, d.name
      )
      SELECT
        uc.meeting_id,
        uc.bil_mesyuarat,
        uc.department_name,
        uc.unread_count,
        uc.last_message_at,
        COALESCE(lm.message, '') AS last_message_preview
      FROM unread_counts uc
      LEFT JOIN latest_messages lm
        ON lm.meeting_id = uc.meeting_id
        AND lm.rn = 1
      ORDER BY datetime(uc.last_message_at) DESC
    `).all(...queryParams);

    const normalizedItems = items.map((item: any) => ({
      meeting_id: Number(item.meeting_id),
      bil_mesyuarat: item.bil_mesyuarat,
      department_name: item.department_name,
      unread_count: Number(item.unread_count || 0),
      last_message_at: item.last_message_at,
      last_message_preview: String(item.last_message_preview || '').slice(0, 120),
    }));

    res.json({
      total_unread: normalizedItems.reduce((sum: number, item: any) => sum + item.unread_count, 0),
      items: normalizedItems,
    });
  }));

  app.patch('/api/issues/:id', authenticate, catchErrors((req: any, res: any) => {
    const { status, title, category } = req.body;
    const updates = [];
    const params = [];
    if (status) { updates.push('status = ?'); params.push(status); }
    if (title) { updates.push('title = ?'); params.push(title); }
    if (category) { updates.push('category = ?'); params.push(category); }
    params.push(req.params.id);
    
    db.prepare(`UPDATE issues SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true });
  }));

  app.delete('/api/issues/:id', authenticate, catchErrors((req: any, res: any) => {
    db.prepare('DELETE FROM issues WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  }));

  app.patch('/api/meetings/:id/lock', authenticate, catchErrors((req: any, res: any) => {
    db.prepare("UPDATE meetings SET is_locked = 1 WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  }));

  app.post('/api/meetings/:id/submit', authenticate, catchErrors((req: any, res: any) => {
    db.prepare("UPDATE meetings SET is_locked = 1 WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  }));

  app.post('/api/meetings/:id/request-unlock', authenticate, catchErrors((req: any, res: any) => {
    db.prepare("UPDATE meetings SET unlock_requested = 1 WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  }));

  app.post('/api/meetings/:id/approve-unlock', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    db.prepare("UPDATE meetings SET is_locked = 0, unlock_requested = 0 WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  }));

  app.post('/api/meetings/:id/request-delete', authenticate, catchErrors((req: any, res: any) => {
    db.prepare("UPDATE meetings SET delete_requested = 1 WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  }));

  app.post('/api/meetings/:id/approve-delete', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    db.prepare("DELETE FROM meetings WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  }));

  app.delete('/api/meetings/:id', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    db.prepare("DELETE FROM meetings WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  }));

  app.get('/api/stats', authenticate, catchErrors((req: any, res: any) => {
    const { department_id, bil_mesyuarat } = req.query;
    let query = `
      SELECT category, 
             COUNT(*) as total,
             SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END) as selesai,
             SUM(CASE WHEN status = 'Belum Selesai' THEN 1 ELSE 0 END) as belum_selesai
      FROM issues i
      JOIN meetings m ON i.meeting_id = m.id
      WHERE 1=1
    `;
    const params = [];
    if (department_id) {
      query += ' AND m.department_id = ?';
      params.push(department_id);
    }
    if (bil_mesyuarat) {
      query += ' AND m.bil_mesyuarat = ?';
      params.push(bil_mesyuarat);
    }
    query += ' GROUP BY category';
    
    const stats = db.prepare(query).all(...params);
    res.json(stats);
  }));

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Global Error Handler:', err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.code === 'SQLITE_CONSTRAINT' ? 400 : 500).json({
      error: err.message || 'Internal server error'
    });
  });

  // Vite middleware for development
  try {
    console.log('Initializing Vite...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware attached');
  } catch (err) {
    console.error('Vite initialization failed:', err);
  }
}

console.log('Calling startServer()...');
setInterval(() => console.log('Heartbeat...'), 10000);
startServer().catch(err => {
  console.error('Failed to start server:', err);
});
