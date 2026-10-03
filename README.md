# ERP Haraka Seed

Sistem ERP untuk **PT Benih Haraka Sejahtera (HARAKA SEED)**, produsen benih hortikultura di Jember. Dibangun dengan Next.js 16 dan Postgres (Neon), di-deploy di Vercel, dan terhubung ke email lewat SMTP dan IMAP.

## Modul

| Modul | Isi |
|---|---|
| **Dashboard** | Omzet bulan ini vs bulan lalu, piutang dan yang lewat jatuh tempo, pesanan siap kirim, stok rendah, lot yang hampir kadaluarsa, grafik 12 bulan, varietas terlaris, email masuk |
| **Penjualan** | Pesanan → konfirmasi → kirim (stok dipotong per lot dengan FEFO, invoice terbit otomatis) → pembayaran. Ada tab piutang, cetak invoice dan surat jalan (berisi nomor lot), serta pembatalan yang mengembalikan stok |
| **Pelanggan** | Distributor, toko tani, petani, ekspor. Riwayat pesanan, omzet, piutang, kirim email langsung, dan riwayat korespondensi |
| **Inventori & Lot** | Stok per lot dengan data mutu (daya kecambah, kemurnian, kadar air), tanggal kadaluarsa, penyesuaian stok, ketertelusuran (lot dikirim ke pelanggan mana), dan email peringatan stok rendah |
| **Produksi Benih** | Papan alur tanam → panen → prosesing → uji lab → lulus. Batch yang lulus otomatis menjadi lot di stok |
| **Petani Mitra** | Data penangkar, lahan, dan hasil panen |
| **Pembelian** | Supplier dan purchase order yang bisa dikirim ke supplier lewat email |
| **Produk** | 12 varietas Haraka (KENTA F1, DIARA F1, BIANTARA F1, MARISA F1, MEILI F1, SAHWA F1, JANU F1, VEDA F1, VINETA, LUMINA, SENDAYU, CALLINA MADU) |
| **Email** | Kotak masuk (sinkron IMAP, email pengirim dicocokkan ke pelanggan), terkirim, gagal, tulis, dan balas |
| **Laporan** | Omzet per bulan, varietas, pelanggan, dan kota. Bisa diekspor ke CSV (Excel) |
| **Pengaturan** | Profil perusahaan (kop email/invoice), rekening, saklar email otomatis, pengguna, dan penghapusan data contoh |

### Email otomatis
- **Pesanan dikonfirmasi**: email konfirmasi pesanan dikirim ke pelanggan.
- **Barang dikirim**: email info pengiriman (kurir dan resi) serta invoice dikirim ke pelanggan.
- **Pembayaran dicatat**: tanda terima dikirim ke pelanggan (opsional).
- **Manual**: pengingat jatuh tempo (massal), peringatan stok rendah, kirim PO ke supplier, dan email bebas.

Semua email memakai kop HARAKA SEED dan tercatat di menu Email. Email yang gagal juga dicatat beserta alasannya.

## Menjalankan secara lokal

Butuh **Node.js 22+** dan Vercel CLI (`npm i -g vercel`).

```bash
npm install
vercel link          # hubungkan ke project haraka-erp
vercel env pull      # ambil DATABASE_URL dkk. ke .env.local
npm run dev          # http://localhost:3000
```

Lupa kata sandi admin: `node --env-file=.env.local scripts/reset-password.mjs <email> <sandi-baru>`.

> **Penting:** environment Development memakai database yang sama dengan Production. Agar uji coba lokal tidak mengubah data asli, jalankan dengan schema terpisah: `DB_SCHEMA=dev npm run dev`. Hapus schema uji dengan `node --env-file=.env.local scripts/drop-schema.mjs dev`.

Tabel dibuat otomatis saat aplikasi pertama kali dibuka dan langsung diisi data contoh (pelanggan dan supplier bertanda "(Contoh)", pesanan 6 bulan, lot awal). Harga produk hanya perkiraan, jadi sesuaikan di menu Produk. Untuk mulai dengan data asli, buka **Pengaturan → Hapus data contoh & transaksi**.

Login awal memakai `ADMIN_EMAIL` / `ADMIN_PASSWORD` dari environment. Lokal tanpa variabel itu, default-nya `ptbenihharakasejahter@gmail.com` / `haraka123`. **Segera ganti kata sandi** di menu Pengaturan.

### Menghubungkan Gmail
1. Login ke akun Google perusahaan, lalu aktifkan **Verifikasi 2 Langkah**.
2. Buat **App Password** di https://myaccount.google.com/apppasswords.
3. Pastikan IMAP aktif di Gmail (Setelan → Penerusan dan POP/IMAP).
4. Isi `EMAIL_USER` dan `EMAIL_PASS` (App Password) di `.env.local`, lalu jalankan ulang server.
5. Buka Pengaturan → **Kirim email tes**.

Untuk email domain sendiri (Zoho, cPanel, Outlook), isi juga `SMTP_HOST`, `SMTP_PORT`, `IMAP_HOST`, dan `IMAP_PORT`.

## Deploy (Vercel)

Project Vercel `haraka-erp` terhubung ke repo GitHub ini: setiap push ke `main` otomatis deploy ke production, dan setiap branch/PR mendapat URL preview. Database Neon Postgres dipasang lewat Vercel Marketplace.

Variabel environment di Vercel: `DATABASE_URL` (otomatis dari Neon), `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Untuk email, tambahkan:
```bash
vercel env add EMAIL_USER production
vercel env add EMAIL_PASS production --sensitive
vercel --prod        # atau push ke main
```

## Struktur
```
src/lib/db.ts          koneksi Postgres, transaksi, skema, data awal
src/lib/inventory.ts   stok, alokasi FEFO, lot
src/lib/email.ts       SMTP/IMAP + template email
src/actions/*.ts       server actions per modul
src/app/(app)/*        halaman ERP
src/app/cetak/*        invoice & surat jalan siap cetak/PDF
```
