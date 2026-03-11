import express from 'express';
import cors from 'cors';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const DATABASE_URL = requireEnv('DATABASE_URL');
const JWT_SECRET = requireEnv('JWT_SECRET');
const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'meeting-minutes';
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DATABASE_CONNECT_RETRIES = Number(process.env.DATABASE_CONNECT_RETRIES || 6);
const DATABASE_CONNECT_DELAY_MS = Number(process.env.DATABASE_CONNECT_DELAY_MS || 5000);

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

type AuthUser = {
  id: number;
  username: string;
  role: 'ADMIN' | 'USER';
  department_id: number | null;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
};

const normalizeMinitPath = (minitPath: string | null | undefined) => {
  if (!minitPath) return null;
  const normalized = minitPath.replace(/\\/g, '/');
  return normalized.startsWith('http://') || normalized.startsWith('https://')
    ? normalized
    : normalized.startsWith('/')
      ? normalized
      : `/${normalized}`;
};

const query = async <T = any>(text: string, params: any[] = []) => {
  const result = await pool.query<T>(text, params);
  return result;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDatabaseWithRetry = async () => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DATABASE_CONNECT_RETRIES; attempt += 1) {
    try {
      await query('SELECT 1');
      if (attempt > 1) {
        console.log(`Sambungan database berjaya pada cubaan ke-${attempt}.`);
      }
      return;
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === DATABASE_CONNECT_RETRIES;
      const message = error instanceof Error ? error.message : String(error);

      console.error(`Sambungan database gagal pada cubaan ke-${attempt}/${DATABASE_CONNECT_RETRIES}: ${message}`);

      if (isLastAttempt) {
        break;
      }

      await wait(DATABASE_CONNECT_DELAY_MS * attempt);
    }
  }

  throw lastError;
};

const bootstrapDatabase = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS departments (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN', 'USER')),
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY,
      bil_mesyuarat TEXT NOT NULL,
      tarikh_mesyuarat DATE NOT NULL,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      minit_path TEXT,
      submission_method TEXT,
      is_locked INTEGER NOT NULL DEFAULT 0,
      unlock_requested INTEGER NOT NULL DEFAULT 0,
      unlock_rejected INTEGER NOT NULL DEFAULT 0,
      delete_requested INTEGER NOT NULL DEFAULT 0,
      delete_rejected INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS issues (
      id SERIAL PRIMARY KEY,
      meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      is_from_previous INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Selesai', 'Belum Selesai')),
      responsible_officer TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS meeting_messages (
      id SERIAL PRIMARY KEY,
      meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS meeting_message_reads (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, meeting_id)
    );
  `);

  await query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'APPROVED';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS minit_path TEXT;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS submission_method TEXT;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS unlock_requested INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS unlock_rejected INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS delete_requested INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS delete_rejected INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE meetings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS is_from_previous INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS responsible_officer TEXT;
    ALTER TABLE issues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE meeting_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE meeting_message_reads ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);

  const defaultDepartments = ['HQ', 'IT', 'HR', 'FINANCE'];
  const defaultCategories = ['Kebajikan', 'Perjawatan', 'Kewangan', 'Infrastruktur', 'Lain-lain'];

  for (const name of defaultDepartments) {
    await query('INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  }

  for (const name of defaultCategories) {
    await query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  }

  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD;
  if (adminPassword) {
    const existingAdmin = await query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (existingAdmin.rowCount === 0) {
      const hash = bcrypt.hashSync(adminPassword, 10);
      await query('INSERT INTO users (username, password, role, status) VALUES ($1, $2, $3, $4)', ['admin', hash, 'ADMIN', 'APPROVED']);
    }
  }
};

const uploadMinutesToSupabase = async (file?: Express.Multer.File) => {
  if (!file) return null;

  const ext = path.extname(file.originalname) || '.pdf';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const objectPath = `minutes/${filename}`;
  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(objectPath, file.buffer, {
      contentType: file.mimetype || 'application/pdf',
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
};

async function startServer() {
  await connectDatabaseWithRetry();
  await bootstrapDatabase();

  const app = express();

  app.use(cors());
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      query(
        `SELECT u.id, u.username, u.role, u.department_id, u.status
         FROM users u
         WHERE u.id = $1`,
        [decoded.id]
      ).then((result) => {
        const currentUser = result.rows[0] as any;
        if (!currentUser) return res.status(401).json({ error: 'Pengguna tidak ditemui' });
        if (currentUser.status !== 'APPROVED') {
          return res.status(403).json({ error: 'Akses akaun ini telah dinyahaktifkan atau belum diluluskan' });
        }
        req.user = {
          id: currentUser.id,
          username: currentUser.username,
          role: currentUser.role,
          department_id: currentUser.department_id,
          status: currentUser.status,
        };
        next();
      }).catch(() => {
        res.status(401).json({ error: 'Pengesahan pengguna gagal' });
      });
    } catch (_error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
    next();
  };

  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const result = await query(`
      SELECT u.*, d.name AS department_name
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.username = $1
    `, [username]);

    const user = result.rows[0] as any;
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.status === 'PENDING') {
      return res.status(403).json({ error: 'Permohonan akaun masih menunggu kelulusan HQ' });
    }
    if (user.status === 'REJECTED') {
      return res.status(403).json({ error: 'Permohonan akaun telah ditolak. Sila hubungi HQ.' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        department_id: user.department_id,
        status: user.status,
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        department_id: user.department_id,
        department_name: user.department_name,
        status: user.status,
      },
    });
  });

  app.post('/api/register', async (req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const departmentId = Number(req.body.department_id);
    if (!username || !password || !departmentId || Number.isNaN(departmentId)) {
      return res.status(400).json({ error: 'Nama pengguna, kata laluan, dan jabatan diperlukan' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Kata laluan mesti sekurang-kurangnya 6 aksara' });
    }
    const departmentResult = await query('SELECT id FROM departments WHERE id = $1 AND name <> $2', [departmentId, 'HQ']);
    if (departmentResult.rowCount === 0) {
      return res.status(400).json({ error: 'Jabatan yang dipilih tidak sah untuk pendaftaran akaun' });
    }

    const hash = bcrypt.hashSync(password, 10);
    try {
      const result = await query(
        'INSERT INTO users (username, password, role, department_id, status, requested_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
        [username, hash, 'USER', departmentId, 'PENDING']
      );
      res.json({ id: result.rows[0].id, success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/change-password', authenticate, async (req: any, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (String(new_password).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const userResult = await query('SELECT id, password FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0] as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!bcrypt.compareSync(current_password, user.password)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hash = bcrypt.hashSync(new_password, 10);
    await query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ success: true });
  });

  app.get('/api/users', authenticate, isAdmin, async (_req, res) => {
    const users = await query(`
      SELECT u.id, u.username, u.role, u.department_id, d.name AS department_name, u.status, u.requested_at
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      ORDER BY CASE u.status WHEN 'PENDING' THEN 0 WHEN 'REJECTED' THEN 1 ELSE 2 END, u.requested_at DESC, u.username
    `);
    res.json(users.rows);
  });

  app.post('/api/users', authenticate, isAdmin, async (req, res) => {
    const { username, password, role, department_id } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    try {
      const result = await query(
        'INSERT INTO users (username, password, role, department_id, status, requested_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
        [username, hash, role, department_id || null, 'APPROVED']
      );
      res.json({ id: result.rows[0].id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/users/:id', authenticate, isAdmin, async (req, res) => {
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  app.post('/api/users/:id/approve', authenticate, isAdmin, async (req, res) => {
    await query('UPDATE users SET status = $1 WHERE id = $2', ['APPROVED', req.params.id]);
    res.json({ success: true });
  });

  app.post('/api/users/:id/reject', authenticate, isAdmin, async (req, res) => {
    await query('UPDATE users SET status = $1 WHERE id = $2', ['REJECTED', req.params.id]);
    res.json({ success: true });
  });

  app.get('/api/departments', authenticate, async (_req, res) => {
    const departments = await query('SELECT * FROM departments ORDER BY name');
    res.json(departments.rows);
  });

  app.post('/api/departments', authenticate, isAdmin, async (req, res) => {
    try {
      const result = await query('INSERT INTO departments (name) VALUES ($1) RETURNING id', [req.body.name]);
      res.json({ id: result.rows[0].id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/departments/:id', authenticate, isAdmin, async (req, res) => {
    await query('DELETE FROM departments WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  app.get('/api/public/departments', async (_req, res) => {
    const departments = await query('SELECT * FROM departments WHERE name <> $1 ORDER BY name', ['HQ']);
    res.json(departments.rows);
  });

  app.get('/api/categories', authenticate, async (_req, res) => {
    const categories = await query('SELECT * FROM categories ORDER BY name');
    res.json(categories.rows);
  });

  app.post('/api/categories', authenticate, isAdmin, async (req, res) => {
    try {
      const result = await query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [req.body.name]);
      res.json({ id: result.rows[0].id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/categories/:id', authenticate, isAdmin, async (req, res) => {
    await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  app.get('/api/meetings', authenticate, async (req: any, res) => {
    let { department_id } = req.query;
    if (req.user.role !== 'ADMIN') {
      department_id = req.user.department_id;
    }

    const params: any[] = [];
    let filterSql = '';
    if (department_id) {
      params.push(Number(department_id));
      filterSql = `WHERE m.department_id = $${params.length}`;
    }

    const meetings = await query(`
      SELECT
        m.*,
        d.name AS department_name,
        COALESCE(COUNT(i.id), 0) AS total_issues,
        COALESCE(SUM(CASE WHEN i.status = 'Selesai' THEN 1 ELSE 0 END), 0) AS completed_issues,
        STRING_AGG(DISTINCT i.category, ',' ORDER BY i.category) AS issue_categories
      FROM meetings m
      JOIN departments d ON d.id = m.department_id
      LEFT JOIN issues i ON i.meeting_id = m.id
      ${filterSql}
      GROUP BY m.id, d.name
      ORDER BY m.tarikh_mesyuarat DESC, m.id DESC
    `, params);

    res.json(meetings.rows.map((meeting: any) => ({
      ...meeting,
      total_issues: Number(meeting.total_issues || 0),
      completed_issues: Number(meeting.completed_issues || 0),
      minit_path: normalizeMinitPath(meeting.minit_path),
    })));
  });

  app.post('/api/meetings', authenticate, upload.single('minit'), async (req: any, res) => {
    const { bil_mesyuarat, tarikh_mesyuarat, submission_method } = req.body;
    const departmentId = req.user.role === 'ADMIN'
      ? Number(req.body.department_id || req.user.department_id)
      : Number(req.user.department_id);
    const minitPath = await uploadMinutesToSupabase(req.file || undefined);

    const result = await query(
      `
      INSERT INTO meetings (
        bil_mesyuarat,
        tarikh_mesyuarat,
        department_id,
        created_by,
        minit_path,
        submission_method,
        unlock_requested,
        unlock_rejected,
        delete_requested,
        delete_rejected
      )
      VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 0, 0)
      RETURNING id
      `,
      [bil_mesyuarat, tarikh_mesyuarat, departmentId, req.user.id, minitPath, submission_method || null]
    );

    res.json({ id: result.rows[0].id });
  });

  app.delete('/api/meetings/:id', authenticate, async (req: any, res) => {
    const meetingResult = await query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    const meeting = meetingResult.rows[0] as any;
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role !== 'ADMIN' && meeting.is_locked) {
      return res.status(403).json({ error: 'Meeting is locked. Request delete permission from HQ.' });
    }

    await query('DELETE FROM meetings WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  app.post('/api/meetings/:id/request-delete', authenticate, async (req: any, res) => {
    const meetingResult = await query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    const meeting = meetingResult.rows[0] as any;
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await query('UPDATE meetings SET delete_requested = 1, delete_rejected = 0 WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  app.post('/api/meetings/:id/approve-delete', authenticate, isAdmin, async (req, res) => {
    await query('DELETE FROM meetings WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  app.post('/api/meetings/:id/reject-delete', authenticate, isAdmin, async (req, res) => {
    await query('UPDATE meetings SET delete_requested = 0, delete_rejected = 1 WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  app.get('/api/meetings/:id', authenticate, async (req: any, res) => {
    const result = await query(`
      SELECT
        m.*,
        d.name AS department_name,
        COALESCE(COUNT(i.id), 0) AS total_issues,
        COALESCE(SUM(CASE WHEN i.status = 'Selesai' THEN 1 ELSE 0 END), 0) AS completed_issues,
        STRING_AGG(DISTINCT i.category, ',' ORDER BY i.category) AS issue_categories
      FROM meetings m
      JOIN departments d ON d.id = m.department_id
      LEFT JOIN issues i ON i.meeting_id = m.id
      WHERE m.id = $1
      GROUP BY m.id, d.name
    `, [req.params.id]);

    const meeting = result.rows[0] as any;
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      ...meeting,
      total_issues: Number(meeting.total_issues || 0),
      completed_issues: Number(meeting.completed_issues || 0),
      minit_path: normalizeMinitPath(meeting.minit_path),
    });
  });

  app.get('/api/meetings/:id/issues', authenticate, async (req: any, res) => {
    const issueResult = await query(`
      SELECT
        i.*,
        m.department_id,
        m.is_locked
      FROM issues i
      JOIN meetings m ON m.id = i.meeting_id
      WHERE i.meeting_id = $1
      ORDER BY i.id ASC
    `, [req.params.id]);

    const meetingDepartmentId = issueResult.rows[0]?.department_id;
    if (meetingDepartmentId && req.user.role !== 'ADMIN' && Number(meetingDepartmentId) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(issueResult.rows.map((issue: any) => ({
      ...issue,
      is_from_previous: Number(issue.is_from_previous || 0),
    })));
  });

  app.post('/api/meetings/:id/issues', authenticate, async (req: any, res) => {
    const meetingResult = await query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    const meeting = meetingResult.rows[0] as any;
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (meeting.is_locked) return res.status(403).json({ error: 'Meeting is locked' });

    const { category, title, status, responsible_officer, is_from_previous } = req.body;
    const result = await query(
      `
      INSERT INTO issues (meeting_id, category, is_from_previous, title, status, responsible_officer)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [req.params.id, category, is_from_previous ? 1 : 0, title, status, responsible_officer || null]
    );

    res.json({ id: result.rows[0].id });
  });

  app.get('/api/meetings/:id/messages', authenticate, async (req: any, res) => {
    const meetingResult = await query('SELECT id, department_id FROM meetings WHERE id = $1', [req.params.id]);
    const meeting = meetingResult.rows[0] as any;
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(`
      SELECT
        mm.id,
        mm.meeting_id,
        mm.user_id,
        mm.message,
        mm.created_at,
        u.username,
        u.role AS user_role,
        d.name AS department_name
      FROM meeting_messages mm
      JOIN users u ON u.id = mm.user_id
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE mm.meeting_id = $1
      ORDER BY mm.created_at ASC, mm.id ASC
    `, [req.params.id]);

    res.json(result.rows);
  });

  app.post('/api/meetings/:id/messages', authenticate, async (req: any, res) => {
    const meetingResult = await query('SELECT id, department_id FROM meetings WHERE id = $1', [req.params.id]);
    const meeting = meetingResult.rows[0] as any;
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const message = String(req.body.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'Mesej tidak boleh kosong' });
    }

    const result = await query(
      'INSERT INTO meeting_messages (meeting_id, user_id, message) VALUES ($1, $2, $3) RETURNING id',
      [req.params.id, req.user.id, message]
    );
    res.json({ id: result.rows[0].id });
  });

  app.post('/api/meetings/:id/messages/read', authenticate, async (req: any, res) => {
    const meetingResult = await query('SELECT id, department_id FROM meetings WHERE id = $1', [req.params.id]);
    const meeting = meetingResult.rows[0] as any;
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await query(`
      INSERT INTO meeting_message_reads (user_id, meeting_id, last_read_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id, meeting_id)
      DO UPDATE SET last_read_at = EXCLUDED.last_read_at
    `, [req.user.id, req.params.id]);

    res.json({ success: true });
  });

  app.get('/api/messages/unread-summary', authenticate, async (req: any, res) => {
    const params: any[] = [req.user.id];
    const departmentFilter = req.user.role === 'ADMIN' ? '' : 'AND m.department_id = $2';
    if (req.user.role !== 'ADMIN') {
      params.push(Number(req.user.department_id));
    }

    const result = await query(`
      WITH per_message AS (
        SELECT
          mm.id,
          mm.meeting_id,
          mm.message,
          mm.created_at,
          m.bil_mesyuarat,
          d.name AS department_name,
          COALESCE(mmr.last_read_at, TO_TIMESTAMP(0)) AS last_read_at,
          ROW_NUMBER() OVER (PARTITION BY mm.meeting_id ORDER BY mm.created_at DESC, mm.id DESC) AS rn
        FROM meeting_messages mm
        JOIN meetings m ON m.id = mm.meeting_id
        JOIN departments d ON d.id = m.department_id
        LEFT JOIN meeting_message_reads mmr
          ON mmr.meeting_id = mm.meeting_id
          AND mmr.user_id = $1
        WHERE mm.user_id <> $1
          ${departmentFilter}
      ),
      unread_group AS (
        SELECT
          meeting_id,
          bil_mesyuarat,
          department_name,
          COUNT(*) FILTER (WHERE created_at > last_read_at) AS unread_count,
          MAX(created_at) AS last_message_at,
          MAX(CASE WHEN rn = 1 THEN LEFT(message, 120) END) AS last_message_preview
        FROM per_message
        GROUP BY meeting_id, bil_mesyuarat, department_name
      )
      SELECT *
      FROM unread_group
      WHERE unread_count > 0
      ORDER BY last_message_at DESC
    `, params);

    const items = result.rows.map((row: any) => ({
      meeting_id: Number(row.meeting_id),
      bil_mesyuarat: row.bil_mesyuarat,
      department_name: row.department_name,
      unread_count: Number(row.unread_count || 0),
      last_message_at: row.last_message_at,
      last_message_preview: row.last_message_preview || '',
    }));

    res.json({
      total_unread: items.reduce((sum: number, item: any) => sum + item.unread_count, 0),
      items,
    });
  });

  app.patch('/api/issues/:id', authenticate, async (req: any, res) => {
    const issueResult = await query(`
      SELECT i.*, m.department_id, m.is_locked
      FROM issues i
      JOIN meetings m ON m.id = i.meeting_id
      WHERE i.id = $1
    `, [req.params.id]);
    const issue = issueResult.rows[0] as any;

    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    if (req.user.role !== 'ADMIN' && Number(issue.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (issue.is_locked) return res.status(403).json({ error: 'Meeting is locked' });

    const updates: string[] = [];
    const params: any[] = [];
    const pushUpdate = (column: string, value: any) => {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
    };

    if (req.body.status !== undefined) pushUpdate('status', req.body.status);
    if (req.body.title !== undefined) pushUpdate('title', req.body.title);
    if (req.body.category !== undefined) pushUpdate('category', req.body.category);
    if (req.body.responsible_officer !== undefined) pushUpdate('responsible_officer', req.body.responsible_officer);
    if (req.body.is_from_previous !== undefined) pushUpdate('is_from_previous', req.body.is_from_previous ? 1 : 0);
    pushUpdate('updated_at', new Date().toISOString());

    params.push(req.params.id);
    await query(`UPDATE issues SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    res.json({ success: true });
  });

  app.delete('/api/issues/:id', authenticate, async (req: any, res) => {
    const issueResult = await query(`
      SELECT i.*, m.department_id, m.is_locked
      FROM issues i
      JOIN meetings m ON m.id = i.meeting_id
      WHERE i.id = $1
    `, [req.params.id]);
    const issue = issueResult.rows[0] as any;

    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    if (req.user.role !== 'ADMIN' && Number(issue.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (issue.is_locked) return res.status(403).json({ error: 'Meeting is locked' });

    await query('DELETE FROM issues WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  app.patch('/api/meetings/:id/lock', authenticate, isAdmin, async (req, res) => {
    await query('UPDATE meetings SET is_locked = 1, unlock_requested = 0, unlock_rejected = 0 WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  app.post('/api/meetings/:id/submit', authenticate, async (req: any, res) => {
    const meetingResult = await query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    const meeting = meetingResult.rows[0] as any;
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await query(
      'UPDATE meetings SET is_locked = 1, unlock_requested = 0, unlock_rejected = 0, delete_requested = 0, delete_rejected = 0 WHERE id = $1',
      [req.params.id]
    );
    res.json({ success: true });
  });

  app.post('/api/meetings/:id/request-unlock', authenticate, async (req: any, res) => {
    const meetingResult = await query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    const meeting = meetingResult.rows[0] as any;
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await query('UPDATE meetings SET unlock_requested = 1, unlock_rejected = 0 WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  app.post('/api/meetings/:id/approve-unlock', authenticate, isAdmin, async (req, res) => {
    await query('UPDATE meetings SET is_locked = 0, unlock_requested = 0, unlock_rejected = 0 WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  app.post('/api/meetings/:id/reject-unlock', authenticate, isAdmin, async (req, res) => {
    await query('UPDATE meetings SET unlock_requested = 0, unlock_rejected = 1 WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  app.get('/api/stats', authenticate, async (req: any, res) => {
    let { department_id, bil_mesyuarat, category } = req.query;
    if (req.user.role !== 'ADMIN') {
      department_id = req.user.department_id;
    }

    const filters = ['m.is_locked = 1'];
    const params: any[] = [];
    if (department_id) {
      params.push(Number(department_id));
      filters.push(`m.department_id = $${params.length}`);
    }
    if (bil_mesyuarat) {
      params.push(String(bil_mesyuarat));
      filters.push(`m.bil_mesyuarat = $${params.length}`);
    }
    if (category) {
      params.push(String(category));
      filters.push(`i.category = $${params.length}`);
    }

    const stats = await query(`
      SELECT
        i.category,
        COUNT(*) AS total,
        SUM(CASE WHEN i.status = 'Selesai' THEN 1 ELSE 0 END) AS selesai,
        SUM(CASE WHEN i.status <> 'Selesai' THEN 1 ELSE 0 END) AS belum_selesai
      FROM issues i
      JOIN meetings m ON m.id = i.meeting_id
      WHERE ${filters.join(' AND ')}
      GROUP BY i.category
      ORDER BY i.category
    `, params);

    res.json(stats.rows.map((row: any) => ({
      category: row.category,
      total: Number(row.total || 0),
      selesai: Number(row.selesai || 0),
      belum_selesai: Number(row.belum_selesai || 0),
    })));
  });

  app.get('/api/reports/pengelasan', authenticate, async (req: any, res) => {
    let { department_id, bil_mesyuarat, category } = req.query;
    if (req.user.role !== 'ADMIN') {
      department_id = req.user.department_id;
    }

    const filters = ['m.is_locked = 1'];
    const params: any[] = [];
    if (department_id) {
      params.push(Number(department_id));
      filters.push(`m.department_id = $${params.length}`);
    }
    if (bil_mesyuarat) {
      params.push(String(bil_mesyuarat));
      filters.push(`m.bil_mesyuarat = $${params.length}`);
    }
    if (category) {
      params.push(String(category));
      filters.push(`i.category = $${params.length}`);
    }

    const [issueResult, categoryResult, departmentResult] = await Promise.all([
      query(`
        SELECT
          i.category,
          i.is_from_previous,
          i.title,
          i.status,
          i.responsible_officer
        FROM issues i
        JOIN meetings m ON m.id = i.meeting_id
        WHERE ${filters.join(' AND ')}
        ORDER BY i.category, i.id
      `, params),
      query('SELECT name FROM categories ORDER BY id ASC, name ASC'),
      department_id ? query('SELECT name FROM departments WHERE id = $1', [Number(department_id)]) : Promise.resolve({ rows: [] as any[] }),
    ]);

    const categoryNames = category
      ? [String(category)]
      : [
          ...categoryResult.rows.map((row: any) => String(row.name || '').trim()).filter(Boolean),
          ...Array.from(new Set(issueResult.rows.map((row: any) => String(row.category || '').trim()).filter(Boolean))),
        ].filter((value, index, array) => array.indexOf(value) === index);

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

    for (const issue of issueResult.rows as any[]) {
      const categoryName = String(issue.category || '').trim();
      if (!categoryName) continue;
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
    }

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
      department_name: departmentResult.rows[0]?.name || 'Semua Jabatan',
      meeting_label: bil_mesyuarat ? String(bil_mesyuarat) : 'Semua Mesyuarat',
      report_year: new Date().getFullYear(),
      rows,
      totals: {
        ...totals,
        overall: totals.previous_selesai + totals.previous_belum + totals.new_selesai + totals.new_belum,
      },
    });
  });

  const distPath = path.resolve(__dirname, 'dist');
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`Production-ready server listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
