# ERP Haraka Seed

Sistem ERP untuk **PT Benih Haraka Sejahtera (HARAKA SEED)**, produsen benih hortikultura di Jember. Dibangun dengan Next.js 16 dan SQLite bawaan Node.js (tanpa server database terpisah), dan terhubung ke email lewat SMTP dan IMAP.

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

## Menjalankan

Butuh **Node.js 24** (memakai `node:sqlite` bawaan).

```bash
npm install
cp .env.example .env.local   # lalu isi nilainya
npm run dev                  # http://localhost:3000
```

Login awal: `ADMIN_EMAIL` / `ADMIN_PASSWORD` dari `.env.local`. Jika tidak diisi, default-nya `admin@harakaseeds.com` / `haraka123`. **Segera ganti kata sandi** di menu Pengaturan.

Database dibuat otomatis di `data/haraka.db` dan sudah berisi data contoh (pelanggan dan supplier bertanda "(Contoh)", pesanan 6 bulan, lot awal). Harga produk hanya perkiraan, jadi sesuaikan di menu Produk. Untuk mulai dengan data asli, buka **Pengaturan → Hapus data contoh & transaksi**, atau set `SEED_DEMO=0` sebelum database pertama kali dibuat.

### Menghubungkan Gmail
1. Login ke akun Google perusahaan, lalu aktifkan **Verifikasi 2 Langkah**.
2. Buat **App Password** di https://myaccount.google.com/apppasswords.
3. Pastikan IMAP aktif di Gmail (Setelan → Penerusan dan POP/IMAP).
4. Isi `EMAIL_USER` dan `EMAIL_PASS` (App Password) di `.env.local`, lalu jalankan ulang server.
5. Buka Pengaturan → **Kirim email tes**.

Untuk email domain sendiri (Zoho, cPanel, Outlook), isi juga `SMTP_HOST`, `SMTP_PORT`, `IMAP_HOST`, dan `IMAP_PORT`.

### Produksi (server kantor / VPS)
```bash
npm run build
npm start          # port 3000
```
Rajin backup file `data/haraka.db`. Jika diakses lewat HTTP biasa (tanpa HTTPS) dari jaringan kantor, set `INSECURE_COOKIE=1` agar login berfungsi. Disarankan tetap memakai HTTPS.

> Catatan: aplikasi ini menyimpan data di file SQLite lokal, jadi perlu server dengan disk permanen (PC kantor, VPS, Railway, Fly.io). Aplikasi ini tidak cocok untuk hosting serverless seperti Vercel tanpa mengganti database ke Postgres.

## Struktur
```
src/lib/db.ts          skema, migrasi, data awal
src/lib/inventory.ts   stok, alokasi FEFO, lot
src/lib/email.ts       SMTP/IMAP + template email
src/actions/*.ts       server actions per modul
src/app/(app)/*        halaman ERP
src/app/cetak/*        invoice & surat jalan siap cetak/PDF
```
