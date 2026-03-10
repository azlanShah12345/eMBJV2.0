# eMBJ Project Rules

## Bahasa Dan Penamaan
- Gunakan Bahasa Malaysia formal untuk semua label UI, mesej sistem, butang, jadual, dan tajuk halaman kecuali jika pengguna minta sebaliknya.
- Nama organisasi rasmi ialah `Sarawak Civil Service`.
- Nama sistem yang digunakan pada UI dan branding ialah `eMBJ`.
- Elakkan campuran label Bahasa Inggeris jika ada padanan Bahasa Malaysia yang sesuai.

## Peraturan Dashboard Dan Data
- Untuk papan pemuka pentadbir, hanya data yang telah dihantar ke HQ dianggap data rasmi.
- Pecahan mengikut kategori mesti memaparkan data sebenar berdasarkan laporan yang dihantar ke HQ.
- Jika penapis tidak dipilih, jangan hantar nilai `undefined`, `null`, atau string kosong ke API.
- Sebarang perubahan pada analitik pentadbir mesti menjaga keselarasan antara:
  - kad ringkasan
  - pecahan kategori
  - prestasi jabatan
  - laporan dihantar
  - eksport Lampiran B

## Lampiran Dan Eksport
- Struktur Lampiran A dan Lampiran B mesti dikekalkan mengikut format rasmi semasa kecuali jika pengguna minta ubah.
- Lampiran A adalah berasaskan pemantauan mesyuarat jabatan.
- Lampiran B adalah berasaskan jumlah isu mengikut kategori.
- Sebelum mengubah format eksport PDF atau Excel, semak sama ada perubahan itu akan menjejaskan susun atur rasmi.

## Peraturan Perubahan Kod
- Sebelum perubahan besar pada UI, eksport, atau aliran data, cipta salinan backup yang boleh dipulihkan.
- Jangan padam fungsi sedia ada tanpa persetujuan pengguna.
- Jangan ubah data pengguna atau rekod penting secara merosakkan tanpa arahan jelas.
- Jika ada ralat data, utamakan pembetulan punca sebenar, bukan workaround sementara.

## Ujian Dan Pengesahan
- Selepas perubahan kod, jalankan sekurang-kurangnya `npm run lint`.
- Jika perubahan menyentuh deploy, database, upload fail, atau eksport, semak juga aliran utama yang terkesan.
- Jika ada isu frontend yang bergantung pada cache browser atau bundle lama, nyatakan perkara itu dengan jelas kepada pengguna.

## Deploy Dan Production
- Production stack rasmi projek ini ialah:
  - GitHub
  - Render
  - Supabase Postgres
  - Supabase Storage
- Jangan cadangkan SQLite local storage sebagai seni bina production utama kecuali untuk ujian sementara.
- Fail `.env` dan rahsia production tidak boleh dimasukkan ke Git.

## Gaya Kerja Pembantu
- Beri penjelasan yang ringkas, jelas, dan terus kepada tindakan.
- Jika pengguna meminta semakan isu, fokus dahulu pada punca, kesan, dan pembetulan.
- Jika pengguna meminta perubahan dan ia boleh dibuat terus dengan selamat, laksanakan perubahan itu.
- Jika perubahan besar dibuat, nyatakan fail utama yang terlibat dan cara pengguna hendak menguji hasilnya.
