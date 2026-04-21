# Deploy eMBJ to GitHub, Supabase, and Render

This project now has two backend entry points:

- `server-sqlite3.ts`
  Local SQLite workflow that you are using now.
- `server-postgres.ts`
  Production-ready workflow for Supabase Postgres + Supabase Storage + Render.

## 1. Push the project to GitHub

If your project is not already in Git:

```powershell
git init
git add .
git commit -m "Prepare eMBJ for Supabase and Render"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## 2. Create a Supabase project

1. Create a new project in Supabase.
2. Save these values:
   - `Project URL`
   - `Service Role Key`
   - `Database password`
   - `Session pooler` connection string

## 3. Apply the database schema in Supabase

1. Open `SQL Editor` in Supabase.
2. Copy the contents of [supabase/schema.sql](./supabase/schema.sql).
3. Run the script.

This creates:

- `departments`
- `users`
- `categories`
- `meetings`
- `issues`

## 4. Create the storage bucket

In Supabase Storage:

1. Create a bucket named `meeting-minutes`
2. Make it public

If you want another bucket name, set `SUPABASE_STORAGE_BUCKET` in Render later.

## 5. Prepare environment variables

Copy [`.env.example`](./.env.example) and prepare these values:

- `DATABASE_URL`
- `DATABASE_SSL`
- `JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `ADMIN_DEFAULT_PASSWORD`
- `PORT`
- `HOST`

Notes:

- Use the Supabase `Session pooler` PostgreSQL URL for `DATABASE_URL`
- Keep `DATABASE_SSL=true` for Render + Supabase
- Set a strong `JWT_SECRET`
- `ADMIN_DEFAULT_PASSWORD` is only used if the `admin` user does not exist yet

## 6. Deploy on Render

1. Create a new `Web Service`
2. Connect your GitHub repo
3. Use the following settings:

- Build Command:

```bash
npm install && npm run build
```

- Start Command:

```bash
npm run start:render
```

- Health Check Path:

```text
/api/health
```

You can also use [render.yaml](./render.yaml).

## 7. Add environment variables in Render

In Render dashboard, add:

- `DATABASE_URL`
- `DATABASE_SSL`
- `JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `ADMIN_DEFAULT_PASSWORD`
- `PORT`
- `HOST`

## 8. Verify the deployment

After deployment:

1. Open `/api/health`
2. Open `/api/health/database`
3. Log in as `admin`
4. Create a meeting
5. Upload a PDF
6. Submit to HQ
7. Test approve/reject flows
8. Generate Lampiran A and B

## 9. Migrate existing SQLite data

Current production code is ready for Supabase, but your local SQLite data is still in:

- `mbj_system.db`

To migrate automatically with the included script:

```bash
npm run migrate:supabase
```

The script will:

1. Read data from local `mbj_system.db`
2. Upsert departments, users, and categories into Supabase Postgres
3. Insert meetings and issues into Supabase Postgres
4. Upload existing local minute PDFs from `uploads/` into Supabase Storage
5. Update `minit_path` to the new Supabase public URLs

If you prefer manual migration:

1. Export departments
2. Export users
3. Export categories
4. Export meetings
5. Export issues
6. Upload old minute PDFs into Supabase Storage
7. Update `minit_path` in Postgres to point to the Supabase public URLs

If you want, the next step is to build a one-time migration script from `mbj_system.db` into Supabase Postgres.
