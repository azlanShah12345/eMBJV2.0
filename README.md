# eMBJ

Sistem `eMBJ` digunakan untuk pemantauan mesyuarat MBJ, pengurusan isu, komunikasi rekod mesyuarat, serta penjanaan Lampiran rasmi untuk `Sarawak Civil Service`.

## Ringkasan Teknologi

- Frontend: React 19 + Vite + TypeScript
- Backend utama: Express + TypeScript
- Production rasmi: Render + Supabase Postgres + Supabase Storage
- Sokongan legacy tempatan: SQLite untuk rujukan dan migrasi data lama

## Peraturan Operasi Penting

- Semua label UI dan mesej sistem hendaklah menggunakan Bahasa Malaysia formal.
- Untuk papan pemuka pentadbir, hanya rekod yang telah dihantar ke HQ dianggap data rasmi.
- Lampiran A kekal berasaskan pemantauan mesyuarat jabatan.
- Lampiran B kekal berasaskan jumlah isu mengikut kategori.
- Jangan commit fail rahsia seperti `.env`, `eMBJ.env`, token, atau kunci production.

## Keperluan

- Node.js 20 atau lebih baharu
- NPM
- Persekitaran Windows disyorkan menggunakan `npm.cmd` jika PowerShell menyekat `npm`

## Pembolehubah Persekitaran

Salin [`.env.example`](./.env.example) kepada `.env` dan isi nilai sebenar:

- `DATABASE_URL`
- `DATABASE_SSL`
- `JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `ADMIN_DEFAULT_PASSWORD`
- `MAINTENANCE_MODE`
- `MAINTENANCE_TITLE`
- `MAINTENANCE_MESSAGE`
- `MAINTENANCE_STARTED_AT`
- `PORT`
- `HOST`

## Skrip Projek

- `npm.cmd run dev`
  Menjalankan backend utama `server-postgres.ts` untuk aliran semasa yang selari dengan Supabase/Postgres.
- `npm.cmd run dev:sqlite`
  Menjalankan aliran SQLite legacy untuk semakan data lama atau keserasian sementara.
- `npm.cmd run build`
  Membina frontend Vite ke folder `dist/`.
- `npm.cmd run lint`
  Menjalankan semakan TypeScript tanpa output binaan.
- `npm.cmd run start`
  Menjalankan backend utama yang sama seperti aliran production.
- `npm.cmd run migrate:supabase`
  Memindahkan data SQLite lama ke Supabase Postgres menggunakan skrip migrasi sedia ada.

## Laluan Utama Sistem

- `Papan Pemuka` pengguna jabatan ialah paparan ringkasan jabatan.
- Modul `Mesyuarat` ialah tempat khusus untuk `Mesyuarat Baharu`, draf, dan pengurusan rekod.
- Chat dalaman berada dalam butiran rekod mesyuarat, bukan chat umum sistem.
- Notifikasi mesej belum dibaca menggunakan status baca per pengguna.

## Deploy Production

Rujuk [DEPLOY_SUPABASE_RENDER.md](./DEPLOY_SUPABASE_RENDER.md) untuk aliran deploy ke Render dan penyediaan Supabase.

Tetapan Render semasa:

- Build Command: `npm install && npm run build`
- Start Command: `npm run start:render`
- Health Check: `/api/health`

## Mod Penyelenggaraan

Sistem kini menyokong halaman `Maintenance` yang boleh diaktifkan tanpa ubah kod.

Tetapan yang digunakan:

- `MAINTENANCE_MODE=true`
  Menghidupkan mod penyelenggaraan.
- `MAINTENANCE_TITLE`
  Tajuk rasmi yang dipaparkan pada halaman penyelenggaraan.
- `MAINTENANCE_MESSAGE`
  Mesej rasmi kepada pengguna.
- `MAINTENANCE_STARTED_AT`
  Masa mula penyelenggaraan untuk dipaparkan pada halaman tersebut.

Contoh tetapan:

```env
MAINTENANCE_MODE=true
MAINTENANCE_TITLE=Sistem eMBJ Sedang Diselenggara
MAINTENANCE_MESSAGE=Sistem sedang ditutup sementara bagi kerja penyelenggaraan dan semakan teknikal. Sila cuba semula selepas kerja selesai.
MAINTENANCE_STARTED_AT=2026-04-22T09:30:00+08:00
```

Cara guna di Render:

1. Buka perkhidmatan aplikasi di Render.
2. Pergi ke `Environment`.
3. Tambah atau kemas kini pembolehubah di atas.
4. Tetapkan `MAINTENANCE_MODE=true`.
5. Simpan perubahan dan biarkan Render deploy semula servis.
6. Selepas selesai, tukar semula `MAINTENANCE_MODE=false` dan deploy semula.

Nota operasi:

- Semasa mod ini aktif, frontend akan memaparkan halaman penyelenggaraan kepada semua pengguna.
- API utama akan dipulangkan sebagai `503` kecuali endpoint awam status sistem dan health check.
- Ini sesuai untuk deploy besar, pembaikan database, atau semakan production yang memerlukan sistem dihentikan sementara.

## Semakan Selepas Perubahan

Selepas sebarang perubahan kod:

```powershell
npm.cmd run lint
```

Jika perubahan menyentuh deploy, database, upload fail, atau eksport:

1. Semak `/api/health`
2. Semak `/api/health/database`
3. Uji log masuk
4. Uji cipta mesyuarat
5. Uji penghantaran ke HQ
6. Uji eksport Lampiran A dan Lampiran B
