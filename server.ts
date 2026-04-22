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
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JWT_SECRET = process.env.JWT_SECRET || 'development-only-change-me';
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true';
const MAINTENANCE_TITLE = (process.env.MAINTENANCE_TITLE || 'Sistem Sedang Diselenggara').trim();
const MAINTENANCE_MESSAGE = (process.env.MAINTENANCE_MESSAGE || 'Sistem eMBJ sedang melalui kerja penyelenggaraan sementara. Sila cuba semula sebentar lagi.').trim();
const MAINTENANCE_STARTED_AT = (process.env.MAINTENANCE_STARTED_AT || '').trim() || null;

const getSystemStatusPayload = () => ({
  status: 'ok',
  maintenance_mode: MAINTENANCE_MODE,
  maintenance_title: MAINTENANCE_TITLE,
  maintenance_message: MAINTENANCE_MESSAGE,
  maintenance_started_at: MAINTENANCE_STARTED_AT,
});

const OFFICIAL_ISSUE_CATEGORIES = [
  'Kewangan',
  'Infrastruktur dan Fasiliti',
  'Sumber Manusia',
  'Kebajikan/Pembudayaan Nilai',
  'Inovasi dan Produktiviti',
  'Lain-lain',
] as const;
const LEGACY_ISSUE_CATEGORIES = [
  'Kewangan dan kemudahan',
  'Pentadbiran',
  'Kebajikan',
  'Inovasi dan produktivi',
  'Lain-lain',
] as const;
const SEEDED_ISSUE_CATEGORIES = Array.from(new Set([...LEGACY_ISSUE_CATEGORIES, ...OFFICIAL_ISSUE_CATEGORIES]));

const getRequestIp = (req: any) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || null;
};

const normalizeIssueComparisonText = (value: unknown) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getIssueComparisonTokens = (value: unknown) =>
  normalizeIssueComparisonText(value)
    .split(' ')
    .filter((token) => token.length >= 3);

const calculateIssueSimilarityScore = (leftTitle: unknown, rightTitle: unknown) => {
  const normalizedLeft = normalizeIssueComparisonText(leftTitle);
  const normalizedRight = normalizeIssueComparisonText(rightTitle);

  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 100;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return 92;

  const leftTokens = Array.from(new Set(getIssueComparisonTokens(normalizedLeft)));
  const rightTokens = Array.from(new Set(getIssueComparisonTokens(normalizedRight)));
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

  const rightTokenSet = new Set(rightTokens);
  const intersectionCount = leftTokens.filter((token) => rightTokenSet.has(token)).length;
  if (intersectionCount === 0) return 0;

  const unionCount = new Set([...leftTokens, ...rightTokens]).size;
  const overlapScore = intersectionCount / Math.min(leftTokens.length, rightTokens.length);
  const jaccardScore = intersectionCount / unionCount;

  return Math.min(100, Math.max(0, Math.round((overlapScore * 70 + jaccardScore * 30) * 100)));
};

const normalizeCategoryLabel = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const findOfficialIssueCategory = (category: unknown) => {
  const normalized = normalizeCategoryLabel(category);
  return OFFICIAL_ISSUE_CATEGORIES.find((item) => normalizeCategoryLabel(item) === normalized) || null;
};

const normalizeOfficialCategoryInput = (category: unknown) => {
  const officialCategory = findOfficialIssueCategory(category);
  if (!officialCategory) {
    throw new Error('Kategori hanya boleh menggunakan pengelasan rasmi sistem.');
  }
  return officialCategory;
};

const normalizeIssueTitle = (title: unknown) => {
  const normalized = String(title || '').trim();
  if (!normalized) {
    throw new Error('Tajuk isu diperlukan');
  }
  return normalized;
};

const normalizeIssueStatus = (status: unknown) => {
  const normalized = String(status || '').trim();
  if (!['Selesai', 'Belum Selesai'].includes(normalized)) {
    throw new Error('Status isu tidak sah');
  }
  return normalized as 'Selesai' | 'Belum Selesai';
};

const normalizeResponsibleOfficer = (value: unknown) => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const normalizeIssueCategory = (
  db: Database.Database,
  category: unknown,
  options: { officialOnly?: boolean } = {}
) => {
  const normalized = String(category || '').trim();
  if (!normalized) {
    throw new Error('Kategori isu diperlukan');
  }

  const officialCategory = findOfficialIssueCategory(normalized);
  if (options.officialOnly) {
    if (!officialCategory) {
      throw new Error('Kategori isu baharu mesti menggunakan pengelasan rasmi semasa');
    }
    return officialCategory;
  }

  if (officialCategory) {
    return officialCategory;
  }

  const categoryRow = db.prepare(
    'SELECT name FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1'
  ).get(normalized) as { name?: string } | undefined;

  if (!categoryRow?.name) {
    throw new Error('Kategori isu tidak sah mengikut senarai rasmi');
  }

  return String(categoryRow.name).trim();
};

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
      status TEXT NOT NULL DEFAULT 'APPROVED',
      requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
      is_from_previous INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL, 
      status TEXT NOT NULL,
      responsible_officer TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      actor_username TEXT,
      actor_role TEXT,
      actor_department_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      target_label TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // Ensure columns exist (for existing databases) - DO THIS BEFORE MIGRATION
  try { db.prepare("ALTER TABLE meetings ADD COLUMN unlock_requested INTEGER DEFAULT 0").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE meetings ADD COLUMN delete_requested INTEGER DEFAULT 0").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE meetings ADD COLUMN minit_path TEXT").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'APPROVED'").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE users ADD COLUMN requested_at TEXT").run(); } catch(e) {}
  try { db.prepare("UPDATE users SET status = 'APPROVED' WHERE status IS NULL OR TRIM(status) = ''").run(); } catch(e) {}
  try { db.prepare("UPDATE users SET requested_at = CURRENT_TIMESTAMP WHERE requested_at IS NULL OR TRIM(requested_at) = ''").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE issues ADD COLUMN is_from_previous INTEGER NOT NULL DEFAULT 0").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE issues ADD COLUMN responsible_officer TEXT").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE issues ADD COLUMN updated_at TEXT").run(); } catch(e) {}
  try { db.prepare("UPDATE issues SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL OR TRIM(updated_at) = ''").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE audit_logs ADD COLUMN actor_department_name TEXT").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE audit_logs ADD COLUMN entity_id TEXT").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE audit_logs ADD COLUMN target_label TEXT").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE audit_logs ADD COLUMN details TEXT").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE audit_logs ADD COLUMN ip_address TEXT").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE audit_logs ADD COLUMN user_agent TEXT").run(); } catch(e) {}
  try { db.prepare("ALTER TABLE audit_logs ADD COLUMN created_at TEXT").run(); } catch(e) {}

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
              status TEXT NOT NULL DEFAULT 'APPROVED',
              requested_at TEXT,
              FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE CASCADE
            );
            INSERT INTO users_new (id, username, password, role, department_id, status, requested_at)
            SELECT
              id,
              username,
              password,
              role,
              department_id,
              COALESCE(status, 'APPROVED'),
              COALESCE(requested_at, CURRENT_TIMESTAMP)
            FROM users;
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
    db.prepare('INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)').run('admin', hash, 'ADMIN', 'APPROVED');
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

  SEEDED_ISSUE_CATEGORIES.forEach(name => {
    db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)').run(name);
  });

  const MINIT_UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024;

  const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });
  const upload = multer({
    storage,
    limits: { fileSize: MINIT_UPLOAD_LIMIT_BYTES },
  });

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  
  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static('uploads'));
  app.get('/api/public/system-status', (req, res) => {
    res.json(getSystemStatusPayload());
  });
  app.use('/api', (req, res, next) => {
    if (!MAINTENANCE_MODE) {
      next();
      return;
    }

    const allowedPaths = new Set([
      '/health',
      '/public/system-status',
    ]);

    if (allowedPaths.has(req.path)) {
      next();
      return;
    }

    res.status(503).json({
      ...getSystemStatusPayload(),
      error: MAINTENANCE_MESSAGE,
    });
  });

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

  const getDepartmentName = (departmentId?: number | null) => {
    if (!departmentId) return null;
    const department = db.prepare('SELECT name FROM departments WHERE id = ?').get(departmentId) as any;
    return department?.name || null;
  };

  const writeAuditLog = (req: any, options: {
    actor?: any;
    actorUsername?: string | null;
    actorRole?: string | null;
    actorDepartmentId?: number | null;
    action: string;
    entityType: string;
    entityId?: string | number | null;
    targetLabel?: string | null;
    details?: Record<string, unknown> | null;
  }) => {
    try {
      const actor = options.actor || null;
      const actorDepartmentName = options.actorDepartmentId !== undefined
        ? getDepartmentName(options.actorDepartmentId)
        : getDepartmentName(actor?.department_id);

      db.prepare(`
        INSERT INTO audit_logs (
          actor_user_id,
          actor_username,
          actor_role,
          actor_department_name,
          action,
          entity_type,
          entity_id,
          target_label,
          details,
          ip_address,
          user_agent,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        actor?.id || null,
        options.actorUsername ?? actor?.username ?? null,
        options.actorRole ?? actor?.role ?? null,
        actorDepartmentName,
        options.action,
        options.entityType,
        options.entityId != null ? String(options.entityId) : null,
        options.targetLabel || null,
        JSON.stringify(options.details || {}),
        getRequestIp(req),
        req.headers['user-agent'] || null
      );
    } catch (error) {
      console.error('Gagal menulis audit log:', error);
    }
  };

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    
    const token = authHeader.split(' ')[1];
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const currentUser = db.prepare('SELECT id, username, role, department_id, status FROM users WHERE id = ?').get(decoded.id);
      if (!currentUser) {
        return res.status(401).json({ error: 'Pengguna tidak ditemui' });
      }
      if (currentUser.status !== 'APPROVED') {
        return res.status(403).json({ error: 'Akses akaun ini telah dinyahaktifkan atau belum diluluskan' });
      }
      req.user = currentUser;
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
    if (user.status === 'PENDING') {
      return res.status(403).json({ error: 'Permohonan akaun masih menunggu kelulusan HQ' });
    }
    if (user.status === 'REJECTED') {
      return res.status(403).json({ error: 'Permohonan akaun telah ditolak. Sila hubungi HQ.' });
    }

    const token = jwt.sign({ 
      id: user.id, 
      username: user.username, 
      role: user.role,
      department_id: user.department_id,
      status: user.status,
    }, JWT_SECRET, { expiresIn: '12h' });

    writeAuditLog(req, {
      actor: user,
      action: 'LOGIN',
      entityType: 'AUTH',
      entityId: user.id,
      targetLabel: user.username,
      details: { department_name: user.department_name },
    });

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        department_id: user.department_id,
        department_name: user.department_name,
        status: user.status
      } 
    });
  }));

  app.post('/api/register', catchErrors((req: any, res: any) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const departmentId = Number(req.body.department_id);
    if (!username || !password || !departmentId || Number.isNaN(departmentId)) {
      return res.status(400).json({ error: 'Nama pengguna, kata laluan, dan jabatan diperlukan' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Kata laluan mesti sekurang-kurangnya 6 aksara' });
    }
    const department = db.prepare("SELECT id FROM departments WHERE id = ? AND name <> 'HQ'").get(departmentId);
    if (!department) {
      return res.status(400).json({ error: 'Jabatan yang dipilih tidak sah untuk pendaftaran akaun' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (username, password, role, department_id, status, requested_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(username, hash, 'USER', departmentId, 'PENDING');
    writeAuditLog(req, {
      action: 'REGISTER_ACCOUNT',
      entityType: 'USER',
      entityId: result.lastInsertRowid,
      targetLabel: username,
      actorUsername: username,
      actorRole: 'USER',
      actorDepartmentId: departmentId,
      details: { status: 'PENDING' },
    });
    res.json({ id: result.lastInsertRowid, success: true });
  }));

  app.get('/api/audit-logs', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    const { action, actor, date_from, date_to, limit } = req.query;
    const filters = [];
    const params: any[] = [];

    if (action) {
      filters.push('action LIKE ?');
      params.push(`%${String(action).trim()}%`);
    }
    if (actor) {
      filters.push('(actor_username LIKE ? OR IFNULL(target_label, \'\') LIKE ? OR IFNULL(actor_department_name, \'\') LIKE ?)');
      params.push(`%${String(actor).trim()}%`, `%${String(actor).trim()}%`, `%${String(actor).trim()}%`);
    }
    if (date_from) {
      filters.push('datetime(created_at) >= datetime(?)');
      params.push(`${String(date_from)} 00:00:00`);
    }
    if (date_to) {
      filters.push('datetime(created_at) <= datetime(?)');
      params.push(`${String(date_to)} 23:59:59`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT *
      FROM audit_logs
      ${whereClause}
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT ?
    `).all(...params, Math.min(Number(limit || 200), 500)) as any[];

    res.json(rows.map((row) => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : null,
    })));
  }));

  // User Management
  app.get('/api/users', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    const users = db.prepare(`
      SELECT u.id, u.username, u.role, u.department_id, d.name as department_name, u.status, u.requested_at
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY CASE u.status WHEN 'PENDING' THEN 0 WHEN 'REJECTED' THEN 1 ELSE 2 END, datetime(u.requested_at) DESC, u.username
    `).all();
    res.json(users);
  }));

  app.post('/api/users', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    const { username, password, role, department_id } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, password, role, department_id, status, requested_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').run(username, hash, role, department_id, 'APPROVED');
    writeAuditLog(req, {
      actor: req.user,
      action: 'CREATE_USER',
      entityType: 'USER',
      entityId: result.lastInsertRowid,
      targetLabel: username,
      details: { role, department_id: department_id || null, status: 'APPROVED' },
    });
    res.json({ id: result.lastInsertRowid });
  }));

  app.delete('/api/users/:id', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    const targetUser = db.prepare('SELECT username, role FROM users WHERE id = ?').get(req.params.id) as any;
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    writeAuditLog(req, {
      actor: req.user,
      action: 'DELETE_USER',
      entityType: 'USER',
      entityId: req.params.id,
      targetLabel: targetUser?.username || `Pengguna #${req.params.id}`,
      details: { role: targetUser?.role || null },
    });
    res.json({ success: true });
  }));

  app.post('/api/users/:id/approve', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    const targetUser = db.prepare('SELECT username FROM users WHERE id = ?').get(req.params.id) as any;
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run('APPROVED', req.params.id);
    writeAuditLog(req, {
      actor: req.user,
      action: 'APPROVE_USER',
      entityType: 'USER',
      entityId: req.params.id,
      targetLabel: targetUser?.username || `Pengguna #${req.params.id}`,
      details: { status: 'APPROVED' },
    });
    res.json({ success: true });
  }));

  app.post('/api/users/:id/reject', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    const targetUser = db.prepare('SELECT username FROM users WHERE id = ?').get(req.params.id) as any;
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run('REJECTED', req.params.id);
    writeAuditLog(req, {
      actor: req.user,
      action: 'REJECT_USER',
      entityType: 'USER',
      entityId: req.params.id,
      targetLabel: targetUser?.username || `Pengguna #${req.params.id}`,
      details: { status: 'REJECTED' },
    });
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
    writeAuditLog(req, {
      actor: req.user,
      action: 'CREATE_DEPARTMENT',
      entityType: 'DEPARTMENT',
      entityId: result.lastInsertRowid,
      targetLabel: name,
    });
    res.json({ id: result.lastInsertRowid });
  }));

  app.delete('/api/departments/:id', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    const department = db.prepare('SELECT name FROM departments WHERE id = ?').get(req.params.id) as any;
    db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
    writeAuditLog(req, {
      actor: req.user,
      action: 'DELETE_DEPARTMENT',
      entityType: 'DEPARTMENT',
      entityId: req.params.id,
      targetLabel: department?.name || `Jabatan #${req.params.id}`,
    });
    res.json({ success: true });
  }));

  app.get('/api/public/departments', catchErrors((req: any, res: any) => {
    const departments = db.prepare("SELECT * FROM departments WHERE name <> 'HQ' ORDER BY name").all();
    res.json(departments);
  }));

  // Category Management
  app.get('/api/categories', authenticate, catchErrors((req: any, res: any) => {
    const categories = db.prepare('SELECT * FROM categories').all();
    res.json(categories);
  }));

  app.post('/api/categories', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    const normalizedName = normalizeOfficialCategoryInput(req.body.name);
    const existingCategory = db.prepare(
      'SELECT id, name FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1'
    ).get(normalizedName) as { id?: number; name?: string } | undefined;

    if (existingCategory?.id) {
      return res.json({ id: existingCategory.id });
    }

    const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(normalizedName);
    writeAuditLog(req, {
      actor: req.user,
      action: 'CREATE_CATEGORY',
      entityType: 'CATEGORY',
      entityId: result.lastInsertRowid,
      targetLabel: normalizedName,
    });
    res.json({ id: result.lastInsertRowid });
  }));

  app.delete('/api/categories/:id', authenticate, isAdmin, catchErrors((req: any, res: any) => {
    const category = db.prepare('SELECT name FROM categories WHERE id = ?').get(req.params.id) as any;
    if (findOfficialIssueCategory(category?.name)) {
      return res.status(400).json({ error: 'Kategori rasmi sistem tidak boleh dihapuskan.' });
    }

    const issueUsage = category?.name
      ? db.prepare('SELECT COUNT(*) as total FROM issues WHERE LOWER(TRIM(category)) = LOWER(TRIM(?))').get(category.name) as { total?: number }
      : null;

    if (Number(issueUsage?.total || 0) > 0) {
      return res.status(400).json({ error: 'Kategori ini masih digunakan pada isu yang telah direkodkan dan tidak boleh dihapuskan.' });
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    writeAuditLog(req, {
      actor: req.user,
      action: 'DELETE_CATEGORY',
      entityType: 'CATEGORY',
      entityId: req.params.id,
      targetLabel: category?.name || `Kategori #${req.params.id}`,
    });
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
    writeAuditLog(req, {
      actor: req.user,
      action: 'CREATE_MEETING',
      entityType: 'MEETING',
      entityId: result.lastInsertRowid,
      targetLabel: bil_mesyuarat,
      details: { tarikh_mesyuarat, department_id, has_minutes: Boolean(minit_path) },
    });
    res.json({ id: result.lastInsertRowid });
  }));

  app.get('/api/meetings/:id/issues', authenticate, catchErrors((req: any, res: any) => {
    const issues = db.prepare('SELECT * FROM issues WHERE meeting_id = ?').all(req.params.id);
    res.json(issues);
  }));

  app.get('/api/meetings/:id/similar-issues', authenticate, catchErrors((req: any, res: any) => {
    const meeting = db.prepare(`
      SELECT m.id, m.department_id, d.name AS department_name
      FROM meetings m
      JOIN departments d ON d.id = m.department_id
      WHERE m.id = ?
    `).get(req.params.id) as any;

    if (!meeting) return res.status(404).json({ error: 'Mesyuarat tidak ditemui' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Akses tidak dibenarkan' });
    }

    const requestedTitle = String(req.query.title || '').trim();
    if (requestedTitle.length < 4) {
      return res.json([]);
    }

    const issues = (req.user.role === 'ADMIN'
      ? db.prepare(`
          SELECT
            i.id,
            i.meeting_id,
            i.category,
            i.is_from_previous,
            i.title,
            i.status,
            i.updated_at,
            m.bil_mesyuarat,
            m.tarikh_mesyuarat,
            d.name AS department_name
          FROM issues i
          JOIN meetings m ON m.id = i.meeting_id
          JOIN departments d ON d.id = m.department_id
          ORDER BY m.tarikh_mesyuarat DESC, i.updated_at DESC, i.id DESC
          LIMIT 250
        `).all()
      : db.prepare(`
          SELECT
            i.id,
            i.meeting_id,
            i.category,
            i.is_from_previous,
            i.title,
            i.status,
            i.updated_at,
            m.bil_mesyuarat,
            m.tarikh_mesyuarat,
            d.name AS department_name
          FROM issues i
          JOIN meetings m ON m.id = i.meeting_id
          JOIN departments d ON d.id = m.department_id
          WHERE m.department_id = ?
          ORDER BY m.tarikh_mesyuarat DESC, i.updated_at DESC, i.id DESC
          LIMIT 250
        `).all(meeting.department_id)) as any[];

    const similarIssues = issues
      .map((issue) => ({
        id: Number(issue.id),
        meeting_id: Number(issue.meeting_id),
        meeting_label: issue.bil_mesyuarat,
        meeting_date: issue.tarikh_mesyuarat,
        department_name: issue.department_name,
        category: issue.category,
        title: issue.title,
        status: issue.status,
        is_from_previous: Number(issue.is_from_previous || 0),
        updated_at: issue.updated_at,
        similarity_score: calculateIssueSimilarityScore(requestedTitle, issue.title),
        is_same_meeting: Number(issue.meeting_id) === Number(req.params.id),
      }))
      .filter((issue) => issue.similarity_score >= 45)
      .sort((left, right) => right.similarity_score - left.similarity_score || Number(right.is_same_meeting) - Number(left.is_same_meeting))
      .slice(0, 6);

    res.json(similarIssues);
  }));

  app.post('/api/meetings/:id/issues', authenticate, catchErrors((req: any, res: any) => {
    const { category, title, status, responsible_officer, is_from_previous } = req.body;
    const normalizedCategory = normalizeIssueCategory(db, category, { officialOnly: true });
    const normalizedTitle = normalizeIssueTitle(title);
    const normalizedStatus = normalizeIssueStatus(status);
    const normalizedResponsibleOfficer = normalizeResponsibleOfficer(responsible_officer);
    const result = db.prepare(`
      INSERT INTO issues (meeting_id, category, is_from_previous, title, status, responsible_officer, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(req.params.id, normalizedCategory, is_from_previous ? 1 : 0, normalizedTitle, normalizedStatus, normalizedResponsibleOfficer);
    writeAuditLog(req, {
      actor: req.user,
      action: 'CREATE_ISSUE',
      entityType: 'ISSUE',
      entityId: result.lastInsertRowid,
      targetLabel: normalizedTitle,
      details: { meeting_id: req.params.id, category: normalizedCategory, status: normalizedStatus, is_from_previous: is_from_previous ? 1 : 0 },
    });
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
    writeAuditLog(req, {
      actor: req.user,
      action: 'SEND_MEETING_MESSAGE',
      entityType: 'MEETING_MESSAGE',
      entityId: result.lastInsertRowid,
      targetLabel: `Mesyuarat #${req.params.id}`,
      details: { meeting_id: req.params.id, preview: message.slice(0, 120) },
    });
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
    const { status, title, category, responsible_officer, is_from_previous } = req.body;
    const updates = [];
    const params = [];
    if (status !== undefined) { updates.push('status = ?'); params.push(normalizeIssueStatus(status)); }
    if (title !== undefined) { updates.push('title = ?'); params.push(normalizeIssueTitle(title)); }
    if (category !== undefined) { updates.push('category = ?'); params.push(normalizeIssueCategory(db, category)); }
    if (responsible_officer !== undefined) { updates.push('responsible_officer = ?'); params.push(normalizeResponsibleOfficer(responsible_officer)); }
    if (is_from_previous !== undefined) { updates.push('is_from_previous = ?'); params.push(is_from_previous ? 1 : 0); }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);
    
    db.prepare(`UPDATE issues SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    writeAuditLog(req, {
      actor: req.user,
      action: 'UPDATE_ISSUE',
      entityType: 'ISSUE',
      entityId: req.params.id,
      details: req.body,
    });
    res.json({ success: true });
  }));

  app.delete('/api/issues/:id', authenticate, catchErrors((req: any, res: any) => {
    const issue = db.prepare('SELECT title, meeting_id FROM issues WHERE id = ?').get(req.params.id) as any;
    db.prepare('DELETE FROM issues WHERE id = ?').run(req.params.id);
    writeAuditLog(req, {
      actor: req.user,
      action: 'DELETE_ISSUE',
      entityType: 'ISSUE',
      entityId: req.params.id,
      targetLabel: issue?.title || `Isu #${req.params.id}`,
      details: { meeting_id: issue?.meeting_id || null },
    });
    res.json({ success: true });
  }));

  app.patch('/api/meetings/:id/lock', authenticate, catchErrors((req: any, res: any) => {
    db.prepare("UPDATE meetings SET is_locked = 1 WHERE id = ?").run(req.params.id);
    writeAuditLog(req, {
      actor: req.user,
      action: 'LOCK_MEETING',
      entityType: 'MEETING',
      entityId: req.params.id,
      targetLabel: `Mesyuarat #${req.params.id}`,
    });
    res.json({ success: true });
  }));

  app.post('/api/meetings/:id/submit', authenticate, catchErrors((req: any, res: any) => {
    db.prepare("UPDATE meetings SET is_locked = 1 WHERE id = ?").run(req.params.id);
    writeAuditLog(req, {
      actor: req.user,
      action: 'SUBMIT_MEETING_TO_HQ',
      entityType: 'MEETING',
      entityId: req.params.id,
      targetLabel: `Mesyuarat #${req.params.id}`,
    });
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

  app.get('/api/dashboard/issues', authenticate, catchErrors((req: any, res: any) => {
    let { department_id, year, bil_mesyuarat, category, status, official_only } = req.query;
    if (req.user.role !== 'ADMIN') {
      department_id = req.user.department_id;
      official_only = undefined;
    }

    let query = `
      SELECT
        i.*,
        m.bil_mesyuarat AS meeting_label,
        m.tarikh_mesyuarat AS meeting_date,
        m.department_id,
        d.name AS department_name,
        m.is_locked AS meeting_is_locked
      FROM issues i
      JOIN meetings m ON i.meeting_id = m.id
      JOIN departments d ON m.department_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (official_only === '1') {
      query += ' AND m.is_locked = 1';
    }
    if (department_id) {
      query += ' AND m.department_id = ?';
      params.push(Number(department_id));
    }
    if (year) {
      query += " AND CAST(strftime('%Y', m.tarikh_mesyuarat) AS INTEGER) = ?";
      params.push(Number(year));
    }
    if (bil_mesyuarat) {
      query += ' AND m.bil_mesyuarat = ?';
      params.push(String(bil_mesyuarat));
    }
    if (category) {
      query += ' AND i.category = ?';
      params.push(String(category));
    }
    if (status === 'Selesai' || status === 'Belum Selesai') {
      query += ' AND i.status = ?';
      params.push(String(status));
    }

    query += `
      ORDER BY
        CASE WHEN i.status = 'Belum Selesai' THEN 0 ELSE 1 END,
        m.tarikh_mesyuarat DESC,
        d.name ASC,
        m.bil_mesyuarat ASC,
        i.id DESC
    `;

    const issues = db.prepare(query).all(...params);
    res.json(issues);
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
