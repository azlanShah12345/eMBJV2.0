# Otak eMBJ

## Tujuan
- Fail ini menjadi ringkasan konteks kerja semasa untuk projek `eMBJ`.
- Gunakan fail ini sebagai rujukan cepat sebelum membuat perubahan penting pada sistem.

## Identiti Sistem
- Nama sistem pada UI dan branding ialah `eMBJ`.
- Nama organisasi rasmi ialah `Sarawak Civil Service`.
- Semua label UI, mesej sistem, butang, jadual, dan tajuk halaman hendaklah menggunakan Bahasa Malaysia formal kecuali jika pengguna minta sebaliknya.

## Peraturan Operasi Penting
- Untuk papan pemuka pentadbir, hanya data yang telah dihantar ke HQ dianggap data rasmi.
- Pecahan kategori, kad ringkasan, prestasi jabatan, laporan dihantar, dan eksport Lampiran B mesti sentiasa konsisten.
- Jika penapis tidak dipilih, jangan hantar `undefined`, `null`, atau string kosong ke API.
- Lampiran A kekal berasaskan pemantauan mesyuarat jabatan.
- Lampiran B kekal berasaskan jumlah isu mengikut kategori.

## Aliran Produk Semasa
- `Papan Pemuka` pengguna jabatan dan modul `Mesyuarat` telah diasingkan.
- Fungsi `Mesyuarat Baharu`, draf, dan pengurusan rekod tidak boleh dicampurkan semula ke dalam dashboard pengguna tanpa arahan baharu.
- Chat dalaman adalah mengikut konteks rekod mesyuarat, bukan chat umum sistem.
- Notifikasi mesej belum dibaca dalam header menggunakan status baca per pengguna dan tidak patut diganti dengan kiraan frontend sementara.

## Infrastruktur Production
- Stack rasmi production ialah GitHub, Render, Supabase Postgres, dan Supabase Storage.
- Jangan cadangkan SQLite sebagai seni bina production utama.
- Rahsia seperti `.env`, `DATABASE_URL`, token, dan kunci production tidak boleh dimasukkan ke Git.
- Untuk Render, sambungan database production hendaklah selari dengan konfigurasi Supabase yang sah.

## Amalan Perubahan
- Sebelum perubahan besar pada UI, eksport, chat, notifikasi, dashboard pengguna, atau aliran mesyuarat, cipta backup yang boleh dipulihkan dalam folder `backup/`.
- Jangan padam fungsi sedia ada tanpa persetujuan pengguna.
- Jika ada ralat data, utamakan pembetulan punca sebenar, bukan workaround sementara.
- Selepas perubahan kod, jalankan sekurang-kurangnya `npm run lint`.

## Fokus Pembantu
- Utamakan penjelasan yang ringkas, jelas, dan terus kepada tindakan.
- Bila menyemak isu, fokus dahulu pada punca, kesan, dan pembetulan.
- Bila perubahan besar dibuat, nyatakan fail utama yang terlibat dan langkah ujiannya.
