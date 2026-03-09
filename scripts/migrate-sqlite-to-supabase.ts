import path from 'path';
import { existsSync, readFileSync } from 'fs';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const DATABASE_URL = requireEnv('DATABASE_URL');
const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'meeting-minutes';
const SQLITE_PATH = process.env.SQLITE_PATH || 'mbj_system.db';

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const postgres = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type IdMap = Map<number, number>;

const uploadMinutesIfNeeded = async (minitPath: string | null) => {
  if (!minitPath) return null;
  if (minitPath.startsWith('http://') || minitPath.startsWith('https://')) {
    return minitPath;
  }

  const normalized = minitPath.replace(/^\/+/, '');
  const localPath = path.resolve(normalized);
  if (!existsSync(localPath)) {
    console.warn(`Minutes file not found locally, keeping original path: ${minitPath}`);
    return minitPath;
  }

  const buffer = readFileSync(localPath);
  const fileName = `${Date.now()}-${path.basename(localPath)}`;
  const objectPath = `migrated/${fileName}`;
  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(objectPath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
};

const main = async () => {
  console.log(`Migrating from SQLite file: ${SQLITE_PATH}`);

  const departments = sqlite.prepare('SELECT * FROM departments ORDER BY id').all() as Array<{ id: number; name: string }>;
  const users = sqlite.prepare('SELECT * FROM users ORDER BY id').all() as Array<{ id: number; username: string; password: string; role: string; department_id: number | null }>;
  const categories = sqlite.prepare('SELECT * FROM categories ORDER BY id').all() as Array<{ id: number; name: string }>;
  const meetings = sqlite.prepare('SELECT * FROM meetings ORDER BY id').all() as Array<any>;
  const issues = sqlite.prepare('SELECT * FROM issues ORDER BY id').all() as Array<any>;

  const departmentMap: IdMap = new Map();
  const userMap: IdMap = new Map();
  const meetingMap: IdMap = new Map();

  for (const department of departments) {
    const result = await postgres.query(
      'INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
      [department.name]
    );
    departmentMap.set(department.id, Number(result.rows[0].id));
  }

  for (const category of categories) {
    await postgres.query(
      'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name',
      [category.name]
    );
  }

  for (const user of users) {
    const result = await postgres.query(
      `
      INSERT INTO users (username, password, role, department_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username)
      DO UPDATE SET
        password = EXCLUDED.password,
        role = EXCLUDED.role,
        department_id = EXCLUDED.department_id
      RETURNING id
      `,
      [
        user.username,
        user.password,
        user.role,
        user.department_id ? departmentMap.get(user.department_id) || null : null,
      ]
    );
    userMap.set(user.id, Number(result.rows[0].id));
  }

  for (const meeting of meetings) {
    const uploadedMinutesPath = await uploadMinutesIfNeeded(meeting.minit_path || null);
    const existing = await postgres.query(
      `
      SELECT id
      FROM meetings
      WHERE department_id = $1
        AND bil_mesyuarat = $2
        AND tarikh_mesyuarat = $3
      `,
      [
        departmentMap.get(Number(meeting.department_id)),
        meeting.bil_mesyuarat,
        meeting.tarikh_mesyuarat,
      ]
    );

    if (existing.rowCount) {
      meetingMap.set(meeting.id, Number(existing.rows[0].id));
      await postgres.query(
        `
        UPDATE meetings
        SET
          minit_path = $2,
          submission_method = $3,
          is_locked = $4,
          unlock_requested = $5,
          unlock_rejected = $6,
          delete_requested = $7,
          delete_rejected = $8,
          created_by = $9,
          created_at = COALESCE($10, created_at)
        WHERE id = $1
        `,
        [
          existing.rows[0].id,
          uploadedMinutesPath,
          meeting.submission_method || null,
          Number(meeting.is_locked || 0),
          Number(meeting.unlock_requested || 0),
          Number(meeting.unlock_rejected || 0),
          Number(meeting.delete_requested || 0),
          Number(meeting.delete_rejected || 0),
          meeting.created_by ? userMap.get(Number(meeting.created_by)) || null : null,
          meeting.created_at || null,
        ]
      );
      continue;
    }

    const result = await postgres.query(
      `
      INSERT INTO meetings (
        bil_mesyuarat,
        tarikh_mesyuarat,
        department_id,
        minit_path,
        submission_method,
        is_locked,
        unlock_requested,
        unlock_rejected,
        delete_requested,
        delete_rejected,
        created_by,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, NOW()))
      RETURNING id
      `,
      [
        meeting.bil_mesyuarat,
        meeting.tarikh_mesyuarat,
        departmentMap.get(Number(meeting.department_id)),
        uploadedMinutesPath,
        meeting.submission_method || null,
        Number(meeting.is_locked || 0),
        Number(meeting.unlock_requested || 0),
        Number(meeting.unlock_rejected || 0),
        Number(meeting.delete_requested || 0),
        Number(meeting.delete_rejected || 0),
        meeting.created_by ? userMap.get(Number(meeting.created_by)) || null : null,
        meeting.created_at || null,
      ]
    );
    meetingMap.set(meeting.id, Number(result.rows[0].id));
  }

  for (const issue of issues) {
    const mappedMeetingId = meetingMap.get(Number(issue.meeting_id));
    if (!mappedMeetingId) {
      console.warn(`Skipping issue ${issue.id}; meeting ${issue.meeting_id} was not migrated`);
      continue;
    }

    const existing = await postgres.query(
      `
      SELECT id
      FROM issues
      WHERE meeting_id = $1
        AND category = $2
        AND title = $3
      `,
      [mappedMeetingId, issue.category, issue.title]
    );

    if (existing.rowCount) {
      await postgres.query(
        `
        UPDATE issues
        SET
          status = $2,
          is_from_previous = $3,
          responsible_officer = $4,
          updated_at = COALESCE($5, updated_at)
        WHERE id = $1
        `,
        [
          existing.rows[0].id,
          issue.status,
          Number(issue.is_from_previous || 0),
          issue.responsible_officer || null,
          issue.updated_at || null,
        ]
      );
      continue;
    }

    await postgres.query(
      `
      INSERT INTO issues (
        meeting_id,
        category,
        is_from_previous,
        title,
        status,
        responsible_officer,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, NOW()))
      `,
      [
        mappedMeetingId,
        issue.category,
        Number(issue.is_from_previous || 0),
        issue.title,
        issue.status,
        issue.responsible_officer || null,
        issue.updated_at || null,
      ]
    );
  }

  console.log('SQLite to Supabase migration completed successfully.');
  await postgres.end();
  sqlite.close();
};

main().catch(async (error) => {
  console.error('Migration failed:', error);
  await postgres.end();
  sqlite.close();
  process.exit(1);
});
