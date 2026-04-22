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
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === 'true';
const MAINTENANCE_TITLE = (process.env.MAINTENANCE_TITLE || 'Sistem Sedang Diselenggara').trim();
const MAINTENANCE_MESSAGE = (process.env.MAINTENANCE_MESSAGE || 'Sistem eMBJ sedang melalui kerja penyelenggaraan sementara. Sila cuba semula sebentar lagi.').trim();
const MAINTENANCE_STARTED_AT = (process.env.MAINTENANCE_STARTED_AT || '').trim() || null;
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DATABASE_CONNECT_RETRIES = Number(process.env.DATABASE_CONNECT_RETRIES || 6);
const DATABASE_CONNECT_DELAY_MS = Number(process.env.DATABASE_CONNECT_DELAY_MS || 5000);
const DATABASE_POOL_MAX = Number(process.env.DATABASE_POOL_MAX || 10);
const DATABASE_IDLE_TIMEOUT_MS = Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 30000);
const DATABASE_CONNECTION_TIMEOUT_MS = Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS || 15000);
const DATABASE_QUERY_RETRY_COUNT = Number(process.env.DATABASE_QUERY_RETRY_COUNT || 1);
const DATABASE_QUERY_RETRY_DELAY_MS = Number(process.env.DATABASE_QUERY_RETRY_DELAY_MS || 1000);

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: DATABASE_POOL_MAX,
  idleTimeoutMillis: DATABASE_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: DATABASE_CONNECTION_TIMEOUT_MS,
  keepAlive: true,
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MINIT_UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024;
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MINIT_UPLOAD_LIMIT_BYTES },
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

const isRetrySafeReadQuery = (text: string) => {
  const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!normalized) return false;

  const startsAsReadQuery = normalized.startsWith('select ') || normalized.startsWith('with ');
  if (!startsAsReadQuery) return false;

  return !/\b(insert|update|delete|merge|alter|drop|create|truncate)\b/i.test(normalized);
};

const getQueryLabel = (text: string) => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const label = normalized.split(' ')[0]?.toUpperCase();
  return label || 'UNKNOWN';
};

const query = async <T = any>(text: string, params: any[] = []) => {
  const maxAttempts = isRetrySafeReadQuery(text) ? DATABASE_QUERY_RETRY_COUNT + 1 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await pool.query<T>(text, params);
    } catch (error) {
      const shouldRetry = attempt < maxAttempts && isDatabaseAvailabilityError(error);
      if (!shouldRetry) {
        throw error;
      }

      console.warn(
        `Sambungan database terganggu semasa query ${getQueryLabel(text)}. Cubaan semula ke-${attempt + 1}/${maxAttempts} akan dibuat.`
      );

      await wait(DATABASE_QUERY_RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error('Query database gagal selepas cubaan semula.');
};

const asyncHandler = (handler: any) => (req: any, res: any, next: any) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const getErrorDetails = (error: unknown) => {
  const codes = new Set<string>();
  const messages = new Set<string>();
  const queue: unknown[] = [error];
  const visited = new Set<object>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);
    const candidate = current as any;

    if (typeof candidate.code === 'string' && candidate.code.trim()) {
      codes.add(candidate.code.trim());
    }

    if (typeof candidate.message === 'string' && candidate.message.trim()) {
      messages.add(candidate.message.trim().toLowerCase());
    }

    if (candidate.cause) {
      queue.push(candidate.cause);
    }

    if (Array.isArray(candidate.errors)) {
      queue.push(...candidate.errors);
    }
  }

  return {
    codes: Array.from(codes),
    messages: Array.from(messages),
  };
};

const isDatabaseAvailabilityError = (error: unknown) => {
  const transientCodes = new Set([
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'ENETUNREACH',
    'EHOSTUNREACH',
    '57P01',
  ]);
  const transientMessageFragments = [
    'connection terminated due to connection timeout',
    'connection terminated unexpectedly',
    'connect etimedout',
    'connection timeout',
  ];
  const { codes, messages } = getErrorDetails(error);

  return (
    codes.some((code) => transientCodes.has(code)) ||
    messages.some((message) => transientMessageFragments.some((fragment) => message.includes(fragment)))
  );
};

pool.on('error', (error) => {
  console.error('Ralat pool PostgreSQL:', error);
});

const getRequestIp = (req: any) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || null;
};

const getDepartmentName = async (departmentId?: number | null) => {
  if (!departmentId) return null;
  const result = await query<{ name: string }>('SELECT name FROM departments WHERE id = $1', [departmentId]);
  return result.rows[0]?.name || null;
};

const getMeetingAccessRecord = async (meetingId: string | number) => {
  const result = await query<{
    id: number;
    bil_mesyuarat: string;
    department_id: number;
    is_locked: number;
  }>(
    'SELECT id, bil_mesyuarat, department_id, is_locked FROM meetings WHERE id = $1',
    [meetingId]
  );
  return result.rows[0] || null;
};

const getSystemStatusPayload = () => ({
  status: 'ok',
  maintenance_mode: MAINTENANCE_MODE,
  maintenance_title: MAINTENANCE_TITLE,
  maintenance_message: MAINTENANCE_MESSAGE,
  maintenance_started_at: MAINTENANCE_STARTED_AT,
});

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

const normalizeIssueCategory = async (
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

  const categoryResult = await query<{ name: string }>(
    'SELECT name FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1',
    [normalized]
  );

  if (categoryResult.rowCount === 0) {
    throw new Error('Kategori isu tidak sah mengikut senarai rasmi');
  }

  return String(categoryResult.rows[0].name || '').trim();
};

const normalizeIssueStatus = (status: unknown) => {
  const normalized = String(status || '').trim();
  if (!['Selesai', 'Belum Selesai'].includes(normalized)) {
    throw new Error('Status isu tidak sah');
  }
  return normalized as 'Selesai' | 'Belum Selesai';
};

const normalizeIssueTitle = (title: unknown) => {
  const normalized = String(title || '').trim();
  if (!normalized) {
    throw new Error('Tajuk isu diperlukan');
  }
  return normalized;
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

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 100;
  }

  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
    return 92;
  }

  const leftTokens = Array.from(new Set(getIssueComparisonTokens(normalizedLeft)));
  const rightTokens = Array.from(new Set(getIssueComparisonTokens(normalizedRight)));
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const rightTokenSet = new Set(rightTokens);
  const intersectionCount = leftTokens.filter((token) => rightTokenSet.has(token)).length;
  if (intersectionCount === 0) {
    return 0;
  }

  const unionCount = new Set([...leftTokens, ...rightTokens]).size;
  const overlapScore = intersectionCount / Math.min(leftTokens.length, rightTokens.length);
  const jaccardScore = intersectionCount / unionCount;

  return Math.min(100, Math.max(0, Math.round((overlapScore * 70 + jaccardScore * 30) * 100)));
};

const normalizeResponsibleOfficer = (responsibleOfficer: unknown) => {
  const normalized = String(responsibleOfficer || '').trim();
  return normalized || null;
};

const writeAuditLog = async (
  req: any,
  options: {
    actor?: AuthUser | null;
    actorUsername?: string | null;
    actorRole?: string | null;
    actorDepartmentId?: number | null;
    action: string;
    entityType: string;
    entityId?: string | number | null;
    targetLabel?: string | null;
    details?: Record<string, unknown> | null;
  }
) => {
  try {
    const actor = options.actor || null;
    const actorDepartmentName = options.actorDepartmentId !== undefined
      ? await getDepartmentName(options.actorDepartmentId)
      : await getDepartmentName(actor?.department_id);

    await query(
      `
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
        user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
      `,
      [
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
        req.headers['user-agent'] || null,
      ]
    );
  } catch (error) {
    console.error('Gagal menulis audit log:', error);
  }
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

    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_username TEXT,
      actor_role TEXT,
      actor_department_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      target_label TEXT,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_department_name TEXT;
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_label TEXT;
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);

  const defaultDepartments = ['HQ', 'IT', 'HR', 'FINANCE'];
  const defaultCategories = SEEDED_ISSUE_CATEGORIES;

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
  app.get('/api/health', (_req: any, res: any) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/health/database', asyncHandler(async (_req: any, res: any) => {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  }));

  app.get('/api/public/system-status', (_req: any, res: any) => {
    res.json(getSystemStatusPayload());
  });

  app.use('/api', (req: any, res: any, next: any) => {
    if (!MAINTENANCE_MODE) {
      next();
      return;
    }

    const allowedPaths = new Set([
      '/health',
      '/health/database',
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

  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token akses tidak diberikan' });
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
      res.status(401).json({ error: 'Token akses tidak sah' });
    }
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Akses pentadbir diperlukan' });
    next();
  };

  app.post('/api/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    const result = await query(`
      SELECT u.*, d.name AS department_name
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.username = $1
    `, [username]);

    const user = result.rows[0] as any;
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Nama pengguna atau kata laluan tidak sah' });
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

    await writeAuditLog(req, {
      actor: {
        id: user.id,
        username: user.username,
        role: user.role,
        department_id: user.department_id,
        status: user.status,
      },
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
        status: user.status,
      },
    });
  }));

  app.post('/api/register', asyncHandler(async (req, res) => {
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
      await writeAuditLog(req, {
        action: 'REGISTER_ACCOUNT',
        entityType: 'USER',
        entityId: result.rows[0].id,
        targetLabel: username,
        actorUsername: username,
        actorRole: 'USER',
        actorDepartmentId: departmentId,
        details: { status: 'PENDING' },
      });
      res.json({ id: result.rows[0].id, success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }));

  app.post('/api/change-password', authenticate, asyncHandler(async (req: any, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Kata laluan semasa dan kata laluan baharu diperlukan' });
    }
    if (String(new_password).length < 6) {
      return res.status(400).json({ error: 'Kata laluan baharu mesti sekurang-kurangnya 6 aksara' });
    }

    const userResult = await query('SELECT id, password FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0] as any;
    if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemui' });
    if (!bcrypt.compareSync(current_password, user.password)) {
      return res.status(400).json({ error: 'Kata laluan semasa tidak tepat' });
    }

    const hash = bcrypt.hashSync(new_password, 10);
    await query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.id]);
    await writeAuditLog(req, {
      actor: req.user,
      action: 'CHANGE_PASSWORD',
      entityType: 'USER',
      entityId: req.user.id,
      targetLabel: req.user.username,
    });
    res.json({ success: true });
  }));

  app.get('/api/audit-logs', authenticate, isAdmin, asyncHandler(async (req, res) => {
    const { action, actor, date_from, date_to, limit } = req.query;
    const params: any[] = [];
    const filters: string[] = [];

    if (action) {
      params.push(`%${String(action).trim()}%`);
      filters.push(`al.action ILIKE $${params.length}`);
    }
    if (actor) {
      params.push(`%${String(actor).trim()}%`);
      filters.push(`(
        al.actor_username ILIKE $${params.length}
        OR COALESCE(al.target_label, '') ILIKE $${params.length}
        OR COALESCE(al.actor_department_name, '') ILIKE $${params.length}
      )`);
    }
    if (date_from) {
      params.push(String(date_from));
      filters.push(`al.created_at >= $${params.length}::date`);
    }
    if (date_to) {
      params.push(String(date_to));
      filters.push(`al.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    params.push(Math.min(Number(limit || 200), 500));
    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await query(`
      SELECT
        al.id,
        al.actor_user_id,
        al.actor_username,
        al.actor_role,
        al.actor_department_name,
        al.action,
        al.entity_type,
        al.entity_id,
        al.target_label,
        al.details,
        al.ip_address,
        al.user_agent,
        al.created_at
      FROM audit_logs al
      ${whereClause}
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT $${params.length}
    `, params);

    res.json(result.rows);
  }));

  app.get('/api/users', authenticate, isAdmin, asyncHandler(async (_req, res) => {
    const users = await query(`
      SELECT u.id, u.username, u.role, u.department_id, d.name AS department_name, u.status, u.requested_at
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      ORDER BY CASE u.status WHEN 'PENDING' THEN 0 WHEN 'REJECTED' THEN 1 ELSE 2 END, u.requested_at DESC, u.username
    `);
    res.json(users.rows);
  }));

  app.post('/api/users', authenticate, isAdmin, asyncHandler(async (req: any, res) => {
    const { username, password, role, department_id } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    try {
      const result = await query(
        'INSERT INTO users (username, password, role, department_id, status, requested_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
        [username, hash, role, department_id || null, 'APPROVED']
      );
      await writeAuditLog(req, {
        actor: req.user,
        action: 'CREATE_USER',
        entityType: 'USER',
        entityId: result.rows[0].id,
        targetLabel: username,
        details: { role, department_id: department_id || null, status: 'APPROVED' },
      });
      res.json({ id: result.rows[0].id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }));

  app.delete('/api/users/:id', authenticate, isAdmin, asyncHandler(async (req: any, res) => {
    const targetUser = await query('SELECT username, role FROM users WHERE id = $1', [req.params.id]);
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    await writeAuditLog(req, {
      actor: req.user,
      action: 'DELETE_USER',
      entityType: 'USER',
      entityId: req.params.id,
      targetLabel: targetUser.rows[0]?.username || `Pengguna #${req.params.id}`,
      details: { role: targetUser.rows[0]?.role || null },
    });
    res.json({ success: true });
  }));

  app.post('/api/users/:id/approve', authenticate, isAdmin, asyncHandler(async (req: any, res) => {
    const targetUser = await query('SELECT username FROM users WHERE id = $1', [req.params.id]);
    await query('UPDATE users SET status = $1 WHERE id = $2', ['APPROVED', req.params.id]);
    await writeAuditLog(req, {
      actor: req.user,
      action: 'APPROVE_USER',
      entityType: 'USER',
      entityId: req.params.id,
      targetLabel: targetUser.rows[0]?.username || `Pengguna #${req.params.id}`,
      details: { status: 'APPROVED' },
    });
    res.json({ success: true });
  }));

  app.post('/api/users/:id/reject', authenticate, isAdmin, asyncHandler(async (req: any, res) => {
    const targetUser = await query('SELECT username FROM users WHERE id = $1', [req.params.id]);
    await query('UPDATE users SET status = $1 WHERE id = $2', ['REJECTED', req.params.id]);
    await writeAuditLog(req, {
      actor: req.user,
      action: 'REJECT_USER',
      entityType: 'USER',
      entityId: req.params.id,
      targetLabel: targetUser.rows[0]?.username || `Pengguna #${req.params.id}`,
      details: { status: 'REJECTED' },
    });
    res.json({ success: true });
  }));

  app.get('/api/departments', authenticate, asyncHandler(async (_req, res) => {
    const departments = await query('SELECT * FROM departments ORDER BY name');
    res.json(departments.rows);
  }));

  app.post('/api/departments', authenticate, isAdmin, asyncHandler(async (req: any, res) => {
    try {
      const result = await query('INSERT INTO departments (name) VALUES ($1) RETURNING id', [req.body.name]);
      await writeAuditLog(req, {
        actor: req.user,
        action: 'CREATE_DEPARTMENT',
        entityType: 'DEPARTMENT',
        entityId: result.rows[0].id,
        targetLabel: req.body.name,
      });
      res.json({ id: result.rows[0].id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }));

  app.delete('/api/departments/:id', authenticate, isAdmin, asyncHandler(async (req: any, res) => {
    const department = await query('SELECT name FROM departments WHERE id = $1', [req.params.id]);
    await query('DELETE FROM departments WHERE id = $1', [req.params.id]);
    await writeAuditLog(req, {
      actor: req.user,
      action: 'DELETE_DEPARTMENT',
      entityType: 'DEPARTMENT',
      entityId: req.params.id,
      targetLabel: department.rows[0]?.name || `Jabatan #${req.params.id}`,
    });
    res.json({ success: true });
  }));

  app.get('/api/public/departments', asyncHandler(async (_req, res) => {
    const departments = await query('SELECT * FROM departments WHERE name <> $1 ORDER BY name', ['HQ']);
    res.json(departments.rows);
  }));

  app.get('/api/categories', authenticate, asyncHandler(async (_req, res) => {
    const categories = await query('SELECT * FROM categories ORDER BY name');
    res.json(categories.rows);
  }));

  app.post('/api/categories', authenticate, isAdmin, asyncHandler(async (req: any, res) => {
    try {
      const normalizedName = normalizeOfficialCategoryInput(req.body.name);
      const existingCategory = await query<{ id: string }>(
        'SELECT id FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1',
        [normalizedName]
      );

      if (existingCategory.rowCount > 0) {
        return res.json({ id: existingCategory.rows[0].id });
      }

      const result = await query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [normalizedName]);
      await writeAuditLog(req, {
        actor: req.user,
        action: 'CREATE_CATEGORY',
        entityType: 'CATEGORY',
        entityId: result.rows[0].id,
        targetLabel: normalizedName,
      });
      res.json({ id: result.rows[0].id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }));

  app.delete('/api/categories/:id', authenticate, isAdmin, asyncHandler(async (req: any, res) => {
    const category = await query('SELECT name FROM categories WHERE id = $1', [req.params.id]);
    const categoryName = category.rows[0]?.name;
    if (findOfficialIssueCategory(categoryName)) {
      return res.status(400).json({ error: 'Kategori rasmi sistem tidak boleh dihapuskan.' });
    }

    const issueUsage = categoryName
      ? await query<{ total: string }>(
          'SELECT COUNT(*)::text AS total FROM issues WHERE LOWER(TRIM(category)) = LOWER(TRIM($1))',
          [categoryName]
        )
      : null;

    if (Number(issueUsage?.rows[0]?.total || 0) > 0) {
      return res.status(400).json({ error: 'Kategori ini masih digunakan pada isu yang telah direkodkan dan tidak boleh dihapuskan.' });
    }

    await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    await writeAuditLog(req, {
      actor: req.user,
      action: 'DELETE_CATEGORY',
      entityType: 'CATEGORY',
      entityId: req.params.id,
      targetLabel: category.rows[0]?.name || `Kategori #${req.params.id}`,
    });
    res.json({ success: true });
  }));

  app.get('/api/meetings', authenticate, asyncHandler(async (req: any, res) => {
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
  }));

  app.post('/api/meetings', authenticate, upload.single('minit'), asyncHandler(async (req: any, res) => {
    const { bil_mesyuarat, tarikh_mesyuarat } = req.body;
    const departmentId = req.user.role === 'ADMIN'
      ? Number(req.body.department_id || req.user.department_id)
      : Number(req.user.department_id);
    const meetingLabel = String(bil_mesyuarat || '').trim();
    const meetingDate = String(tarikh_mesyuarat || '').trim();
    const meetingYear = new Date(meetingDate).getFullYear();

    if (!meetingLabel || !meetingDate || Number.isNaN(meetingYear)) {
      return res.status(400).json({ error: 'Bilangan mesyuarat dan tarikh mesyuarat diperlukan' });
    }

    if (!['Bil 1', 'Bil 2', 'Bil 3'].includes(meetingLabel)) {
      return res.status(400).json({ error: 'Bilangan mesyuarat tidak sah' });
    }

    const duplicateMeeting = await query(
      `
      SELECT id
      FROM meetings
      WHERE department_id = $1
        AND bil_mesyuarat = $2
        AND EXTRACT(YEAR FROM tarikh_mesyuarat) = $3
      LIMIT 1
      `,
      [departmentId, meetingLabel, meetingYear]
    );

    if (duplicateMeeting.rowCount > 0) {
      return res.status(409).json({
        error: `Rekod ${meetingLabel} bagi tahun ${meetingYear} untuk jabatan ini telah wujud`,
      });
    }

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
      [meetingLabel, meetingDate, departmentId, req.user.id, minitPath, null]
    );

    await writeAuditLog(req, {
      actor: req.user,
      action: 'CREATE_MEETING',
      entityType: 'MEETING',
      entityId: result.rows[0].id,
      targetLabel: meetingLabel,
      details: {
        tarikh_mesyuarat: meetingDate,
        department_id: departmentId,
        has_minutes: Boolean(minitPath),
      },
    });

    res.json({ id: result.rows[0].id });
  }));

  app.delete('/api/meetings/:id', authenticate, asyncHandler(async (req: any, res) => {
    const meetingResult = await query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    const meeting = meetingResult.rows[0] as any;
    if (!meeting) return res.status(404).json({ error: 'Mesyuarat tidak ditemui' });

    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Akses tidak dibenarkan' });
    }
    if (req.user.role !== 'ADMIN' && meeting.is_locked) {
      return res.status(403).json({ error: 'Mesyuarat telah dikunci. Sila mohon kebenaran hapus daripada HQ.' });
    }

    await query('DELETE FROM meetings WHERE id = $1', [req.params.id]);
    await writeAuditLog(req, {
      actor: req.user,
      action: 'DELETE_MEETING',
      entityType: 'MEETING',
      entityId: req.params.id,
      targetLabel: meeting.bil_mesyuarat,
      details: { department_id: meeting.department_id },
    });
    res.json({ success: true });
  }));

  app.post('/api/meetings/:id/request-delete', authenticate, asyncHandler(async (req: any, res) => {
    const meetingResult = await query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    const meeting = meetingResult.rows[0] as any;
    if (!meeting) return res.status(404).json({ error: 'Mesyuarat tidak ditemui' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Akses tidak dibenarkan' });
    }

    await query('UPDATE meetings SET delete_requested = 1, delete_rejected = 0 WHERE id = $1', [req.params.id]);
    await writeAuditLog(req, {
      actor: req.user,
      action: 'REQUEST_DELETE_MEETING',
      entityType: 'MEETING',
      entityId: req.params.id,
      targetLabel: meeting.bil_mesyuarat,
    });
    res.json({ success: true });
  }));

  app.post('/api/meetings/:id/approve-delete', authenticate, isAdmin, asyncHandler(async (req: any, res) => {
    const meetingResult = await query('SELECT bil_mesyuarat, department_id FROM meetings WHERE id = $1', [req.params.id]);
    await query('DELETE FROM meetings WHERE id = $1', [req.params.id]);
    await writeAuditLog(req, {
      actor: req.user,
      action: 'APPROVE_DELETE_MEETING',
      entityType: 'MEETING',
      entityId: req.params.id,
      targetLabel: meetingResult.rows[0]?.bil_mesyuarat || `Mesyuarat #${req.params.id}`,
      details: { department_id: meetingResult.rows[0]?.department_id || null },
    });
    res.json({ success: true });
  }));

  app.post('/api/meetings/:id/reject-delete', authenticate, isAdmin, asyncHandler(async (req: any, res) => {
    await query('UPDATE meetings SET delete_requested = 0, delete_rejected = 1 WHERE id = $1', [req.params.id]);
    await writeAuditLog(req, {
      actor: req.user,
      action: 'REJECT_DELETE_MEETING',
      entityType: 'MEETING',
      entityId: req.params.id,
      targetLabel: `Mesyuarat #${req.params.id}`,
    });
    res.json({ success: true });
  }));

  app.get('/api/meetings/:id', authenticate, asyncHandler(async (req: any, res) => {
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
    if (!meeting) return res.status(404).json({ error: 'Mesyuarat tidak ditemui' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Akses tidak dibenarkan' });
    }

    res.json({
      ...meeting,
      total_issues: Number(meeting.total_issues || 0),
      completed_issues: Number(meeting.completed_issues || 0),
      minit_path: normalizeMinitPath(meeting.minit_path),
    });
  }));

  app.get('/api/meetings/:id/issues', authenticate, asyncHandler(async (req: any, res) => {
    const meeting = await getMeetingAccessRecord(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Mesyuarat tidak ditemui' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Akses tidak dibenarkan' });
    }

    const issueResult = await query(
      `
      SELECT *
      FROM issues
      WHERE meeting_id = $1
      ORDER BY id ASC
      `,
      [req.params.id]
    );

    res.json(issueResult.rows.map((issue: any) => ({
      ...issue,
      is_from_previous: Number(issue.is_from_previous || 0),
    })));
  }));

  app.get('/api/meetings/:id/similar-issues', authenticate, asyncHandler(async (req: any, res) => {
    const meeting = await getMeetingAccessRecord(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Mesyuarat tidak ditemui' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Akses tidak dibenarkan' });
    }

    const requestedTitle = String(req.query.title || '').trim();
    if (requestedTitle.length < 4) {
      return res.json([]);
    }

    const issueScopeParams: any[] = [];
    const issueScopeFilters: string[] = [];

    if (req.user.role !== 'ADMIN') {
      issueScopeParams.push(meeting.department_id);
      issueScopeFilters.push(`m.department_id = $${issueScopeParams.length}`);
    }

    const issueScopeWhereClause = issueScopeFilters.length > 0 ? `WHERE ${issueScopeFilters.join(' AND ')}` : '';
    const issueResult = await query(
      `
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
      ${issueScopeWhereClause}
      ORDER BY m.tarikh_mesyuarat DESC, i.updated_at DESC, i.id DESC
      LIMIT 250
      `,
      issueScopeParams
    );

    const similarIssues = issueResult.rows
      .map((issue: any) => ({
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

  app.post('/api/meetings/:id/issues', authenticate, asyncHandler(async (req: any, res) => {
    const meeting = await getMeetingAccessRecord(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Mesyuarat tidak ditemui' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Akses tidak dibenarkan' });
    }
    if (meeting.is_locked) return res.status(403).json({ error: 'Mesyuarat telah dikunci' });

    const { category, title, status, responsible_officer, is_from_previous } = req.body;
    const normalizedCategory = await normalizeIssueCategory(category, { officialOnly: true });
    const normalizedTitle = normalizeIssueTitle(title);
    const normalizedStatus = normalizeIssueStatus(status);
    const normalizedResponsibleOfficer = normalizeResponsibleOfficer(responsible_officer);

    const result = await query(
      `
      INSERT INTO issues (meeting_id, category, is_from_previous, title, status, responsible_officer)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [
        req.params.id,
        normalizedCategory,
        is_from_previous ? 1 : 0,
        normalizedTitle,
        normalizedStatus,
        normalizedResponsibleOfficer,
      ]
    );

    await writeAuditLog(req, {
      actor: req.user,
      action: 'CREATE_ISSUE',
      entityType: 'ISSUE',
      entityId: result.rows[0].id,
      targetLabel: normalizedTitle,
      details: {
        meeting_id: req.params.id,
        category: normalizedCategory,
        status: normalizedStatus,
        is_from_previous: is_from_previous ? 1 : 0,
      },
    });

    res.json({ id: result.rows[0].id });
  }));

  app.get('/api/meetings/:id/messages', authenticate, asyncHandler(async (req: any, res) => {
    const meetingResult = await query('SELECT id, department_id FROM meetings WHERE id = $1', [req.params.id]);
    const meeting = meetingResult.rows[0] as any;
    if (!meeting) return res.status(404).json({ error: 'Mesyuarat tidak ditemui' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Akses tidak dibenarkan' });
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
  }));

  app.post('/api/meetings/:id/messages', authenticate, asyncHandler(async (req: any, res) => {
    const meetingResult = await query('SELECT id, department_id FROM meetings WHERE id = $1', [req.params.id]);
    const meeting = meetingResult.rows[0] as any;
    if (!meeting) return res.status(404).json({ error: 'Mesyuarat tidak ditemui' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Akses tidak dibenarkan' });
    }

    const message = String(req.body.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'Mesej tidak boleh kosong' });
    }

    const result = await query(
      'INSERT INTO meeting_messages (meeting_id, user_id, message) VALUES ($1, $2, $3) RETURNING id',
      [req.params.id, req.user.id, message]
    );
    await writeAuditLog(req, {
      actor: req.user,
      action: 'SEND_MEETING_MESSAGE',
      entityType: 'MEETING_MESSAGE',
      entityId: result.rows[0].id,
      targetLabel: `Mesyuarat #${req.params.id}`,
      details: { meeting_id: req.params.id, preview: message.slice(0, 120) },
    });
    res.json({ id: result.rows[0].id });
  }));

  app.post('/api/meetings/:id/messages/read', authenticate, asyncHandler(async (req: any, res) => {
    const meetingResult = await query('SELECT id, department_id FROM meetings WHERE id = $1', [req.params.id]);
    const meeting = meetingResult.rows[0] as any;
    if (!meeting) return res.status(404).json({ error: 'Mesyuarat tidak ditemui' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Akses tidak dibenarkan' });
    }

    await query(`
      INSERT INTO meeting_message_reads (user_id, meeting_id, last_read_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id, meeting_id)
      DO UPDATE SET last_read_at = EXCLUDED.last_read_at
    `, [req.user.id, req.params.id]);

    res.json({ success: true });
  }));

  app.get('/api/messages/unread-summary', authenticate, asyncHandler(async (req: any, res) => {
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
  }));

  app.patch('/api/issues/:id', authenticate, asyncHandler(async (req: any, res) => {
    const issueResult = await query(`
      SELECT i.*, m.department_id, m.is_locked
      FROM issues i
      JOIN meetings m ON m.id = i.meeting_id
      WHERE i.id = $1
    `, [req.params.id]);
    const issue = issueResult.rows[0] as any;

    if (!issue) return res.status(404).json({ error: 'Isu tidak ditemui' });
    if (req.user.role !== 'ADMIN' && Number(issue.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Akses tidak dibenarkan' });
    }
    if (issue.is_locked) return res.status(403).json({ error: 'Mesyuarat telah dikunci' });

    const updates: string[] = [];
    const params: any[] = [];
    const pushUpdate = (column: string, value: any) => {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
    };

    if (req.body.status !== undefined) pushUpdate('status', normalizeIssueStatus(req.body.status));
    if (req.body.title !== undefined) pushUpdate('title', normalizeIssueTitle(req.body.title));
    if (req.body.category !== undefined) pushUpdate('category', await normalizeIssueCategory(req.body.category));
    if (req.body.responsible_officer !== undefined) pushUpdate('responsible_officer', normalizeResponsibleOfficer(req.body.responsible_officer));
    if (req.body.is_from_previous !== undefined) pushUpdate('is_from_previous', req.body.is_from_previous ? 1 : 0);
    pushUpdate('updated_at', new Date().toISOString());

    params.push(req.params.id);
    await query(`UPDATE issues SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    await writeAuditLog(req, {
      actor: req.user,
      action: 'UPDATE_ISSUE',
      entityType: 'ISSUE',
      entityId: req.params.id,
      targetLabel: issue.title,
      details: req.body,
    });
    res.json({ success: true });
  }));

  app.delete('/api/issues/:id', authenticate, asyncHandler(async (req: any, res) => {
    const issueResult = await query(`
      SELECT i.*, m.department_id, m.is_locked
      FROM issues i
      JOIN meetings m ON m.id = i.meeting_id
      WHERE i.id = $1
    `, [req.params.id]);
    const issue = issueResult.rows[0] as any;

    if (!issue) return res.status(404).json({ error: 'Isu tidak ditemui' });
    if (req.user.role !== 'ADMIN' && Number(issue.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Akses tidak dibenarkan' });
    }
    if (issue.is_locked) return res.status(403).json({ error: 'Mesyuarat telah dikunci' });

    await query('DELETE FROM issues WHERE id = $1', [req.params.id]);
    await writeAuditLog(req, {
      actor: req.user,
      action: 'DELETE_ISSUE',
      entityType: 'ISSUE',
      entityId: req.params.id,
      targetLabel: issue.title,
      details: { meeting_id: issue.meeting_id },
    });
    res.json({ success: true });
  }));

  app.patch('/api/meetings/:id/lock', authenticate, isAdmin, asyncHandler(async (req: any, res) => {
    await query('UPDATE meetings SET is_locked = 1, unlock_requested = 0, unlock_rejected = 0 WHERE id = $1', [req.params.id]);
    await writeAuditLog(req, {
      actor: req.user,
      action: 'LOCK_MEETING',
      entityType: 'MEETING',
      entityId: req.params.id,
      targetLabel: `Mesyuarat #${req.params.id}`,
    });
    res.json({ success: true });
  }));

  app.post('/api/meetings/:id/submit', authenticate, asyncHandler(async (req: any, res) => {
    const meetingResult = await query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    const meeting = meetingResult.rows[0] as any;
    if (!meeting) return res.status(404).json({ error: 'Mesyuarat tidak ditemui' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Akses tidak dibenarkan' });
    }

    await query(
      'UPDATE meetings SET is_locked = 1, unlock_requested = 0, unlock_rejected = 0, delete_requested = 0, delete_rejected = 0 WHERE id = $1',
      [req.params.id]
    );
    await writeAuditLog(req, {
      actor: req.user,
      action: 'SUBMIT_MEETING_TO_HQ',
      entityType: 'MEETING',
      entityId: req.params.id,
      targetLabel: meeting.bil_mesyuarat,
    });
    res.json({ success: true });
  }));

  app.post('/api/meetings/:id/request-unlock', authenticate, asyncHandler(async (req: any, res) => {
    const meetingResult = await query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    const meeting = meetingResult.rows[0] as any;
    if (!meeting) return res.status(404).json({ error: 'Mesyuarat tidak ditemui' });
    if (req.user.role !== 'ADMIN' && Number(meeting.department_id) !== Number(req.user.department_id)) {
      return res.status(403).json({ error: 'Akses tidak dibenarkan' });
    }

    await query('UPDATE meetings SET unlock_requested = 1, unlock_rejected = 0 WHERE id = $1', [req.params.id]);
    await writeAuditLog(req, {
      actor: req.user,
      action: 'REQUEST_UNLOCK_MEETING',
      entityType: 'MEETING',
      entityId: req.params.id,
      targetLabel: meeting.bil_mesyuarat,
    });
    res.json({ success: true });
  }));

  app.post('/api/meetings/:id/approve-unlock', authenticate, isAdmin, asyncHandler(async (req: any, res) => {
    await query('UPDATE meetings SET is_locked = 0, unlock_requested = 0, unlock_rejected = 0 WHERE id = $1', [req.params.id]);
    await writeAuditLog(req, {
      actor: req.user,
      action: 'APPROVE_UNLOCK_MEETING',
      entityType: 'MEETING',
      entityId: req.params.id,
      targetLabel: `Mesyuarat #${req.params.id}`,
    });
    res.json({ success: true });
  }));

  app.post('/api/meetings/:id/reject-unlock', authenticate, isAdmin, asyncHandler(async (req: any, res) => {
    await query('UPDATE meetings SET unlock_requested = 0, unlock_rejected = 1 WHERE id = $1', [req.params.id]);
    await writeAuditLog(req, {
      actor: req.user,
      action: 'REJECT_UNLOCK_MEETING',
      entityType: 'MEETING',
      entityId: req.params.id,
      targetLabel: `Mesyuarat #${req.params.id}`,
    });
    res.json({ success: true });
  }));

  app.get('/api/dashboard/issues', authenticate, asyncHandler(async (req: any, res) => {
    let { department_id, year, bil_mesyuarat, category, status, official_only } = req.query;
    if (req.user.role !== 'ADMIN') {
      department_id = req.user.department_id;
      official_only = undefined;
    }

    const filters: string[] = [];
    const params: any[] = [];
    if (official_only === '1') {
      filters.push('m.is_locked = 1');
    }
    if (department_id) {
      params.push(Number(department_id));
      filters.push(`m.department_id = $${params.length}`);
    }
    if (year) {
      params.push(Number(year));
      filters.push(`EXTRACT(YEAR FROM m.tarikh_mesyuarat) = $${params.length}`);
    }
    if (bil_mesyuarat) {
      params.push(String(bil_mesyuarat));
      filters.push(`m.bil_mesyuarat = $${params.length}`);
    }
    if (category) {
      params.push(String(category));
      filters.push(`i.category = $${params.length}`);
    }

    const normalizedStatus =
      status === 'Selesai' ? 'Selesai' :
      status === 'Belum Selesai' ? 'Belum Selesai' :
      null;
    if (normalizedStatus) {
      params.push(normalizedStatus);
      filters.push(`i.status = $${params.length}`);
    }

    const issues = await query(`
      SELECT
        i.*,
        m.bil_mesyuarat AS meeting_label,
        m.tarikh_mesyuarat AS meeting_date,
        m.department_id,
        d.name AS department_name,
        m.is_locked AS meeting_is_locked
      FROM issues i
      JOIN meetings m ON m.id = i.meeting_id
      JOIN departments d ON d.id = m.department_id
      ${filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''}
      ORDER BY
        CASE WHEN i.status = 'Belum Selesai' THEN 0 ELSE 1 END,
        m.tarikh_mesyuarat DESC,
        d.name ASC,
        m.bil_mesyuarat ASC,
        i.id DESC
    `, params);

    res.json(issues.rows.map((row: any) => ({
      id: Number(row.id),
      meeting_id: Number(row.meeting_id),
      category: row.category,
      is_from_previous: Number(row.is_from_previous || 0),
      title: row.title,
      status: row.status,
      responsible_officer: row.responsible_officer || '',
      updated_at: row.updated_at,
      meeting_label: row.meeting_label,
      meeting_date: row.meeting_date,
      department_id: Number(row.department_id),
      department_name: row.department_name,
      meeting_is_locked: Number(row.meeting_is_locked || 0),
    })));
  }));

  app.get('/api/stats', authenticate, asyncHandler(async (req: any, res) => {
    let { department_id, year, bil_mesyuarat, category } = req.query;
    if (req.user.role !== 'ADMIN') {
      department_id = req.user.department_id;
    }

    const filters = ['m.is_locked = 1'];
    const params: any[] = [];
    if (department_id) {
      params.push(Number(department_id));
      filters.push(`m.department_id = $${params.length}`);
    }
    if (year) {
      params.push(Number(year));
      filters.push(`EXTRACT(YEAR FROM m.tarikh_mesyuarat) = $${params.length}`);
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
  }));

  app.get('/api/reports/pengelasan', authenticate, asyncHandler(async (req: any, res) => {
    let { department_id, year, bil_mesyuarat, category } = req.query;
    if (req.user.role !== 'ADMIN') {
      department_id = req.user.department_id;
    }

    const filters = ['m.is_locked = 1'];
    const params: any[] = [];
    if (department_id) {
      params.push(Number(department_id));
      filters.push(`m.department_id = $${params.length}`);
    }
    if (year) {
      params.push(Number(year));
      filters.push(`EXTRACT(YEAR FROM m.tarikh_mesyuarat) = $${params.length}`);
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
      report_year: year ? Number(year) : new Date().getFullYear(),
      rows,
      totals: {
        ...totals,
        overall: totals.previous_selesai + totals.previous_belum + totals.new_selesai + totals.new_belum,
      },
    });
  }));

  app.use((error: any, _req: any, res: any, _next: any) => {
    if (res.headersSent) {
      return;
    }

    if (isDatabaseAvailabilityError(error)) {
      console.error('Sambungan database tidak tersedia:', error);
      return res.status(503).json({
        error: 'Sambungan ke pangkalan data tidak tersedia buat sementara waktu. Sila cuba sebentar lagi.',
      });
    }

    console.error('Ralat pelayan tidak dijangka:', error);
    return res.status(500).json({
      error: 'Ralat pelayan dalaman telah berlaku.',
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
