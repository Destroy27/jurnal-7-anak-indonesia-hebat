# 📖 Jurnal 7 Anak Indonesia Hebat

Aplikasi **jurnal kebiasaan harian untuk siswa SD**, berbasis **Google Spreadsheet** (tanpa
server sendiri), siap di-hosting gratis di **GitHub Pages**.

Anak mengisi jurnal 7 kebiasaan setiap hari — mulai dari jam bangun pagi — lalu **rekapnya
otomatis** terlihat oleh guru di sekolah dan orang tua di rumah.

![Stack](https://img.shields.io/badge/Stack-HTML%20%2B%20CSS%20%2B%20JS-maroon) ![DB](https://img.shields.io/badge/DB-Google%20Sheets%20%2B%20Apps%20Script-gold) ![Host](https://img.shields.io/badge/Host-GitHub%20Pages-blue)

---

## 🌟 7 Kebiasaan Anak Indonesia Hebat

| # | Kebiasaan | Isian | Tipe |
|---|---|---|---|
| 1 | **Bangun Pagi dengan Tujuan** | Jam bangun pagi (jam bisa diatur guru) | 🕐 jam |
| 2 | **Tetapkan Sasaran Hari Ini** | Tulis 1–3 target hari ini | ✍️ tulisan |
| 3 | **Prioritaskan yang Penting** | Sudah / belum | ✅ centang |
| 4 | **Aku yang BOS atas Hariku** | Skala 1–5 mengatur waktu & perasaan | 1️⃣ skala |
| 5 | **Jadwalkan untuk Refleksi** | Tulis pelajaran hari ini sebelum tidur | ✍️ tulisan |
| 6 | **Dengarkan Dulu, Baru Bicara** | Skala 1–5|mendengarkan orang lain | 1️⃣ skala |
| 7 | **Asah Gendangmu** | Sudah / belum olahraga, baca, santai | ✅ centang |

Setiap isian diberi **skor 0–100** sehingga bisa langsung dijumlahkan jadi nilai kelas.
Untuk kebiasaan jam bangun, skor 100 bila bangun **paling lambat sesuai target** (bawaan 05:30),
lalu turun 20 poin tiap 30 menit lebih lambat.

---

## 👥 Tiga Peran

| Peran | Halaman | Login | Hak akses |
|---|---|---|---|
| **Murid** | `murid.html` | **NIS** + **PIN** | Isi jurnal sendiri, lihat rekap pribadi |
| **Guru** | `guru.html` | **username** + **password** | Rekap seluruh kelas, kelola siswa, beri catatan |
| **Orang Tua** | `ortu.html` | **Kode Akses** | **Hanya melihat** rekap anaknya |

> Halaman orang tua tidak punya satu pun tombol ubah atau hapus — murni untuk memantau.

---

## ✨ Fitur

### Halaman Murid (`murid.html`) — tampilan besar & ramah anak SD

- **Isi jam bangun pagi** lewat input jam, lengkap dengan **target sekolah** & skor langsung
- Sasaran hari ini, prioritas, skala "aku BOS", refleksi malam, escalas mendengar, asah gendang
- **Tombol Simpan** mengirim 7 kebiasaan dalam **1 request** saja (hemat kuota)
- **Konfeti** + toast ucapan selamat saat 7 kebiasaan terisi semua
- **Rekap pribadi**: hari terisi, rata-rata poin, rata-rata jam bangun, streak beruntun
- **Kalender kebiasaan** (heatmap 30 hari) — makin gelap makin lengkap
- **Grafik jam bangun** 10 hari terakhir
- **8 lencana pencapaian** (3/7/14/21/30 hari beruntun, bangun pagi, hari lengkap)
- Riwayat 5 hari terakhir + **catatan dari guru**
- Auto-sinkron tiap 90 detik, dan **tidak melakukan** sinkron saat tab disembunyikan

### Halaman Guru (`guru.html`)

- **Dashboard per kelas**: rata-rata poin kelas, persen terisi hari ini, streak tertinggi
- **Peringatan siswa perlu bantuan** (yang journaling-nya ≤ 1 hari)
- **Tabel matrix siswa × hari** — warnanya menunjukkan kelengkapan tiap hari
- **Rincian per siswa** (modal): skor 7 kebiasaan, riwayat harian, **hapus isian** satu per satu
- **Kelola siswa**: tambah satu-satu, **tempel massal dari Excel**, edit, hapus
- Otomatis dibuat: **NIS**, **PIN** murid, dan **Kode Akses** orang tua per anak
- **Catatan untuk siswa** — tampil di halaman murid & orang tuanya
- **Unduh CSV** + **cetak** rapi (A4 landscape)
- **Multi-kelas** & **multi-akun guru**
- Pengaturan: nama aplikasi, target jam bangun, URL database, unduh `Code.gs`

### Halaman Orang Tua (`ortu.html`)

- Ringkasan 4 angka besar: hari terisi, rata-rata poin, rata-rata jam bangun, streak
- Kelengkapan per kebiasaan, kalender kebiasaan, grafik jam bangun, lencana
- Rincian jurnal 7 hari terakhir + catatan guru

---

## 🚀 Cara Pasang (Setup)

### Langkah 1 — Buat Database Spreadsheet + Backend

1. Buka **https://sheets.new** → buat spreadsheet baru, misal **"Jurnal 7 Kebiasaan SD"**
2. Menu **Ekstensi → Apps Script**
3. Hapus seluruh isi `Code.gs` bawaan, lalu tempel **seluruh isi** file
   [`apps-script/Code.gs`](apps-script/Code.gs) → klik **Save** (💾)
4. Klik **Deploy → New deployment** → ikon roda gigi *(Test deployments)* → tipe **Web app**
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
5. Klik **Deploy**, lalu **izinkan akses** di layar persetujuan Google
   - (bila muncul "advanced" → klik *Go to ... (unsafe)* → **Allow**)
6. **Salin URL** yang berakhiran `/exec`

> Sheet `CONFIG`, `SISWA`, dan `JURNAL` **dibuat otomatis** saat data pertama masuk —
> tidak perlu dibuat manual.

### Langkah 2 — Tempel URL ke Website

1. Buka file [`assets/js/site-config.js`](assets/js/site-config.js)
2. Ganti string kosong pada baris `scriptUrl` dengan URL `/exec` tadi:

   ```js
   window.SITECONFIG = {
     scriptUrl: 'https://script.google.com/macros/s/AKfycb.../exec',
     namaApp: 'Jurnal 7 Anak Indonesia Hebat'
   };
   ```

3. **Unggah ulang** file tersebut ke repository (langkah 4)

> Cukup **satu kali**. Setelah itu semua perangkat — HP murid, HP orang tua, laptop guru —
> langsung terhubung tanpa perlusetting apa pun.

### Langkah 3 — Jalankan Lokal (menguji)

```bash
python -m http.server 8080
```

Buka **http://localhost:8080/index.html**. Bisa juga langsung klik `index.html`
di browser — seluruh fungsi tetap jalan (data lewat Apps Script).

### Langkah 4 — Konfigurasi Awal di Panel Guru

1. Buka halaman **Guru** (`guru.html`) dan login:
   **username `guru`** · **password `guru123`**
   → **segera ganti password** di tab *Pengaturan → Akun Guru* (hapus akun default)
2. Tab **Kelas & Siswa**: klik **Kelas Baru** di tab Dashboard dulu (misal `4A`)
3. **Tambah Siswa** (satu-satu) atau **Tempel Massal** (dari Excel) — PIN & Kode Orang Tua
   dibuat otomatis
4. **Sampaikan ke wali murid**: tabel:
   - ke **murid** → NIS + PIN
   - ke **orang tua** → Kode Akses (satu kode = satu anak)
5. Tab **Pengaturan** → atur **target jam bangun** sesuai kesepakatan sekolah

### Langkah 5 — Hosting di GitHub Pages 🌐

1. Buat repository baru di GitHub (misal `jurnal-7-anak-indonesia-hebat`)
2. Upload **seluruh isi** folder ini ke repository tersebut
   > Folder `apps-script/` ikut terunggah untuk memudahkan — Apps Script tetap
   > harus ditempel manual dari sana.
3. Buka **Settings → Pages**
4. **Source:** `Deploy from a branch` → pilih `main` → folder `/ (root)` → **Save**
5. Tunggu 1–2 menit → website live di
   `https://<username>.github.io/jurnal-7-anak-indonesia-hebat/`
6. Bagikan linknya ke murid, orang tua, dan fellow guru 📚

---

## 🧠 Cara Kerja

```
Murid / Orang Tua / Guru (browser)      Google Cloud              Kamu (Google Account)
┌──────────────────────────┐     ┌────────────────┐     ┌──────────────────────────┐
│ index.html               │     │  Apps Script   │     │  Google Spreadsheet      │
│ murid.html  guru.html    │ ──► │  (Web App)     │ ──► │  CONFIG · SISWA ·       │
│ ortu.html                │     │                │     │  JURNAL                 │
│ core.js (cache lokal)    │ ◄── │  JSONP / POST  │ ◄── │                          │
└──────────────────────────┘     └────────────────┘     └──────────────────────────┘
```

- **Baca data** → `GET ?action=get_all` (satu permintaan untuk config + siswa + jurnal)
- **Tulis data** → `POST` (`save_entries`, `save_students`, `save_config`, …)
- **Anti tabrakan** → `LockService` membuat semua penulisan berurutan, sehingga 30+ murid
  mengisi jurnal bersamaan tetap aman
- **Hemat beban** → `CacheService` membuat 30+ perangkat yang sinkron bersamaan hanya
  membaca spreadsheet **satu kali**
- **Anti hilang** → setelah POST, frontend **memverifikasi** kembali ke server. Bila belum
  masuk, isian disimpan di `localStorage` dan **dikirim ulang otomatis** sampai terkonfirmasi

---

## 📁 Struktur Project

```
jurnal-7-anak-indonesia-hebat/
├── index.html          → halaman depan + login (pilih peran)
├── murid.html          → jurnal harian + rekap pribadi
├── murid.js            → logika halaman murid
├── guru.html           → dashboard rekap kelas + kelola data
├── guru.js             → logika panel guru
├── ortu.html           → halaman pantau orang tua (read-only)
├── ortu.js             → logika halaman orang tua
├── assets/
│   ├── css/
│   │   ├── base.css        → token desain, reset, layout
│   │   ├── components.css  → tombol, kartu, tabel, toast, grafik
│   │   └── pages.css       → login, kartu kebiasaan, dashboard
│   └── js/
│       ├── site-config.js  → ⚙️ TEMPEL URL APPS SCRIPT DI SINI
│       ├── habits.js       → definisi 7 kebiasaan + mesin skor
│       ├── core.js         → state, sinkron, auth, mesin rekap
│       ├── login.js        → logika halaman login
│       ├── murid.js
│       ├── guru.js
│       └── ortu.js
├── apps-script/
│   └── Code.gs         → backend Google Apps Script (tempel ke spreadsheet)
└── README.md
```

---

## ⚠️ Catatan Keamanan

Sesuai arsitektur tanpa server, ada hal yang perlu diketahui:

- Password guru, PIN murid, dan kode orang tua disimpan sebagai **hash SHA-256**
  (bukan teks biasa)
- Login pada dasarnya adalah **pintu antarmuka**: data tersinkron ke perangkat, sehingga secara
  teknis siapa pun yang bisa membuka aplikasi bisa melihat data yang tersinkron
- **Jangan bagikan URL spreadsheet** ke siapa pun. Yang dibagikan hanya URL website
- URL Apps Script bersifat publik — ini memang dibutuhkan agar murid bisa mengisi jurnal
  tanpa harus login Google. Untuk kebutuhan sekolah seperti ini sudah sangat umum
- **Pakai password guru yang kuat dan berbeda** dari hal lain, dan **hapus akun default**
- Satu **Kode Akses Orang Tua** hanya berlaku untuk **satu anak** — jangan dipakai bersama

---

## 🛠 Troubleshooting

| Masalah | Solusi |
|---|---|
| Muncul kartu "Hubungkan Database dulu" | `scriptUrl` di `assets/js/site-config.js` masih kosong |
| "Database belum terbaca" | Klik **Pengaturan → Tes Koneksi**. Pastikan deployment Apps Script versi terbaru (**Deploy → Manage deployments → ✏️ → Version: New**) |
| Murid tidak bisa login | Cek NIS & PIN di **Kelas & Siswa**. PIN tampil tersamar (`***`), klik ikon pensil untuk melihat/mengganti |
| Orang tua tidak bisa masuk | Pastikan **Kode Akses** siswa sudah diisi (kolomnya boleh kosong saat tambah, bisa diisi ulang lewat Edit) |
| Data tidak muncul di rekap guru | Klik tombol **⟳ Sinkron** di kanan atas |
| Isian tersimpan tapi belum masuk database | Banner kuning "menunggu dikirim ulang" akan hilang sendiri setelah terkonfirmasi. Jangan tutup aplikasi buru-buru |
| Ingin ganti SD / tahun baru | Buat **kelas baru** di Dashboard, lalu pindahkan siswa lewat Tempel Massal. Data tahun lama tetap tersimpan |
| Ingin mulai dari nol | **Pengaturan → Kosongkan Jurnal** per kelas (data siswa tetap aman) |

---

## 🎨 Tema Warna

Nuansa **merah marun** dengan aksen emas —dipilih agar terlihat elegan sekaligus hangat,
cocok untuk lingkungan sekolah. Seluruh warna terkumpul di variabel CSS pada
[`assets/css/base.css`](assets/css/base.css), jadi mengganti tema cukup mengedit satu tempat.

```
Maroon utama   #75162F   Aksen emas   #C9A227
Maroon gelap   #430C1B   Emas terang   #E3C15C
Maroon muda    #A82249   Latar        #F7F2F4
```

---

## 📄 Lisensi

Bebas dipakai dan dimodifikasi untuk kebutuhan pendidikan masing-masing sekolah.