# ERP Haraka Seed

Sistem ERP untuk **PT Benih Haraka Sejahtera (HARAKA SEED)**, produsen benih hortikultura di Jember. Dibangun dengan Next.js 16 dan Postgres (Neon), di-deploy di Vercel, dan terhubung ke email lewat SMTP dan IMAP.

## Aplikasi (PWA)

ERP bisa dipasang sebagai aplikasi di HP atau komputer lewat **Pengaturan → Pasang sebagai aplikasi** (atau menu browser "Tambahkan ke layar utama"). Tidak ada service worker, jadi aplikasi selalu memuat versi terbaru dan tetap butuh internet. Nama & ikon diatur di `src/app/manifest.ts` dan `public/icons/`.

## Divisi & hak akses

Setiap karyawan login dengan **email pribadinya**. Hak akses mengikuti divisi; divisi tidak bisa melihat modul divisi lain, dan **keuangan hanya untuk Founder**.

| Divisi | Modul bawaan |
|---|---|
| **Founder & Moderator** | Semua modul, termasuk Keuangan (pembayaran, piutang, invoice, omzet), Akun Pengguna (mengundang email & memberi hak akses per divisi), dan pengaturan perusahaan |
| **Marketing** | Penjualan, Pelanggan, Keluhan Pelanggan, Produk, Email, Laporan penjualan (jumlah kemasan, tanpa omzet) |
| **Warehouse** | Gudang & Lot, Pengiriman (tanpa harga), Produk, Laporan gudang |
| **Produksi** | Produksi Benih, Petani Mitra, Produk, Laporan produksi |
| **Lab / QC** | Antrian uji lab, kelulusan & karantina lot, Produk, Laporan QC |
| **Mutu** | Audit ISO 9001 (internal/eksternal/surveilan), temuan & CAPA, pengendalian dokumen mutu, Produk, Laporan mutu |
| **Admin / SDM** | Karyawan, Pembelian, Pembayaran Benih, Pelanggan, Email, Laporan SDM |

Founder bisa mengubah modul tiap divisi di **Pengaturan → Hak akses divisi**. Modul Keuangan, Buku Kas, dan Akun Pengguna terkunci khusus Founder. Akses dicek di setiap halaman, aksi, dan unduhan, jadi bukan sekadar menu yang disembunyikan.

**Akun:** Founder (moderator ERP) mengundang email dan memilih divisinya di menu **Akun Pengguna**. Pengguna menerima email undangan untuk membuat kata sandinya sendiri (berlaku 72 jam). **Lupa kata sandi** bisa dilakukan sendiri dari halaman login; tautan reset dikirim ke email (berlaku 1 jam, sekali pakai). Akun yang dinonaktifkan langsung keluar dari semua perangkat.

## Modul

| Modul | Isi |
|---|---|
| **Dashboard** | Founder: omzet, piutang, grafik 12 bulan, varietas terlaris. Divisi lain: kartu & daftar sesuai modulnya |
| **Penjualan** | Pesanan → konfirmasi → kirim (stok dipotong per lot dengan FEFO) → invoice. Cetak pesanan, invoice, dan surat jalan |
| **Keuangan** | Piutang & umur piutang, pembayaran masuk, pengingat telat bayar (massal, invoice PDF terlampir) |
| **Buku Kas** | Pemasukan & pengeluaran harian per kategori, saldo berjalan per bulan (khusus Founder) |
| **Pengiriman** | Antrian pesanan siap kirim untuk gudang, input kurir & resi, surat jalan, bukti pengiriman |
| **Pelanggan** | Distributor, toko tani, petani, ekspor. Riwayat pesanan, email, dokumen |
| **Gudang & Lot** | Stok per lot dengan data mutu, kadaluarsa, penyesuaian stok, ketertelusuran |
| **Stok Bahan Baku** | Bahan baku benih (kg) per kode produksi: belum uji, proses uji, siap jual |
| **Produksi Benih** | Tanam → panen → prosesing → serah ke Lab/QC |
| **Lab / QC** | Uji daya kecambah/kemurnian/kadar air; lulus → lot masuk stok; uji ulang; lot gagal dikarantina (tidak bisa dijual) |
| **Mutu & Audit ISO** | Jadwal & laporan audit, temuan per klausul ISO 9001 → divisi penanggung jawab mengisi akar masalah & tindakan → Mutu memverifikasi & menutup (notifikasi email di tiap langkah). Daftar dokumen mutu (SOP, IK, formulir) dengan revisi & jadwal tinjau |
| **Temuan Audit** | Setiap divisi melihat & menjawab temuan untuk divisinya sendiri |
| **Keluhan Pelanggan** | (Marketing) keluhan, investigasi, penggantian, daftar penerima lot yang sama |
| **SDM** | Data karyawan per divisi, terhubung ke akun ERP |
| **Petani Mitra / Pembelian / Produk** | Penangkar, PO ke supplier, 38 varietas katalog resmi dengan foto kemasan |
| **Email** | Kotak masuk perusahaan (IMAP), terkirim, gagal, tulis, balas |
| **Laporan** | Tab per divisi (Keuangan, Penjualan, Produksi, Lab/QC, Gudang, Mutu & Audit, Keluhan, SDM), semua bisa diunduh CSV |
| **Pengaturan** | Akun saya (semua). Founder: hak akses divisi, profil perusahaan, gambar tanda tangan dokumen, email otomatis, hapus data contoh |

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

Akun Founder pertama dibuat dari `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Lokal tanpa variabel itu, default-nya `nurainimaulidia@gmail.com` / `haraka123`. **Segera ganti kata sandi** di Pengaturan. Email perusahaan (`EMAIL_USER`, ptbenihharakasejahtera@gmail.com) dipakai ERP untuk mengirim email, bukan untuk login.

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
