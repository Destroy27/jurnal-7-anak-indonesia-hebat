# 📖 Jurnal 7 Anak Indonesia Hebat

Aplikasi **jurnal kebiasaan harian untuk siswa SD**, siap di-hosting gratis di
**GitHub Pages**, dengan database **Cloudflare D1**.

Anak mengisi jurnal 7 kebiasaan setiap hari — mulai dari jam bangun pagi — lalu **rekapnya
otomatis** terlihat oleh guru di sekolah dan orang tua di rumah.

> 🏫 Dipakai di **SD N 4 Jehem**. Nama sekolah diatur di
> [`assets/js/site-config.js`](assets/js/site-config.js) (`namaSekolah`), tampil di navbar
> dan judul tab browser.
>
> 🌐 Website: **https://destroy27.github.io/jurnal-7-anak-indonesia-hebat/**
>
> ⚙️ **Untuk pengguna di SD N 4 Jehem: tidak ada yang perlu dipasang.** Backend-nya
> sudah aktif dan URL-nya sudah terisi di `site-config.js`. Langsung buka saja
> websitenya.

![Stack](https://img.shields.io/badge/Stack-HTML%20%2B%20CSS%20%2B%20JS-maroon) ![DB](https://img.shields.io/badge/DB-Cloudflare%20D1-orange) ![Host](https://img.shields.io/badge/Host-GitHub%20Pages-blue)

### Database pernah dua kali

Aplikasi ini dulu memakai **Google Spreadsheet + Apps Script**. Sekarang memakai
**Cloudflare Workers + D1**. Alasannya terukur, bukan perkiraan: Spreadsheet punya
jeda tetap sekitar 1,3 detik sebelum jawaban apa pun keluar, dan kadang satu
permintaan memakan 16 detik. D1 menjawab dalam 0,2 detik dan tidak pernah
melewati setengah detik untuk data yang sama.

Keduanya masih bisa dipakai. Yang aktif sekarang adalah D1. Cara kembali ke
Spreadsheet ada di bagian [Troubleshooting](#troubleshooting).

---

## 🌟 7 Kebiasaan Anak Indonesia Hebat (G7KAIH)

| # | Kebiasaan | Isian | Tipe |
|---|---|---|---|
| 1 | **Bangun Pagi** | Jam bangun pagi (target bisa diatur guru) | 🕐 jam |
| 2 | **Beribadah / Berdoa** | Sudah / belum | ✅ centang |
| 3 | **Berolahraga** | Sudah / belum | ✅ centang |
| 4 | **Makan Sehat dan Bergizi** | Sudah / belum | ✅ centang |
| 5 | **Gemar Belajar** | Sudah / belum | ✅ centang |
| 6 | **Bermasyarakat** | Sudah / belum | ✅ centang |
| 7 | **Tidur Cepat** | Jam tidur malam (target bisa diatur guru) | 🕐 jam |

Setiap isian diberi **skor 0–100** sehingga bisa langsung dijumlahkan jadi nilai kelas.
Untuk kebiasaan jam (bangun & tidur), skor 100 bila **paling lambat sesuai target**
(bawaan bangun 05:30, tidur 21:00), lalu turun 20 poin tiap 30 menit lebih lambat.
Setiap kebiasaan centang juga **wajib** diberi **catatan singkat** begitu sudah dicentang —
supaya jurnal tidak hanya berisi centang, tapi ada penjelasan apa yang dilakukan anak.
Untuk kebiasaan jam (bangun & tidur) catatan tetap opsional.
Aturan ini diatur per kebiasaan di `assets/js/habits.js` (`wajibCatatan: true`),
jadi bisa diubah tanpa menyentuh kode lain.

> **Sumber daftar:** 7 Kebiasaan Anak Indonesia Hebat (G7KAIH) adalah gerakan pendidikan
> karakter Kementerian Pendidikan Dasar dan Menengah (Kemendikdasmen), diluncurkan
> 27 Desember 2024 di Jakarta. Buku Panduannya terbit 11 April 2025.

---

## 👥 Tiga Peran

| Peran | Halaman | Login | Hak akses |
|---|---|---|---|
| **Murid** | `murid.html` | **No. Absen** + **Nama Panggilan** | Isi jurnal sendiri, lihat rekap pribadi |
| **Guru** | `guru.html` | **username** + **password** | Rekap seluruh kelas, kelola siswa, beri catatan |
| **Orang Tua** | `ortu.html` | **Kode Akses** | **Hanya melihat** rekap anaknya |

> Halaman orang tua tidak punya satu pun tombol ubah atau hapus — murni untuk memantau.

---

## ✨ Fitur

### Halaman Murid (`murid.html`) — tampilan besar & ramah anak SD

- **Isi jam bangun pagi** lewat input jam, lengkap dengan **target sekolah** & skor langsung
- Lima kebiasaan centang (ibadah, olahraga, makan sehat, gemar belajar, bermasyarakat) + jam tidur cepat
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

### Langkah 1 — Siapkan backend

Backend yang aktif adalah **Cloudflare Workers + D1**. Cara pasang lengkap ada
di [`worker/README.md`](worker/README.md), termasuk perintah mengimpor data dari
Spreadsheet lama kalau sudah punya.

Ringkasnya, di dalam folder `worker/`:

```powershell
.\pasang.ps1
```

Skrip itu membuat database D1, mengimpor data, lalu mengunggah Worker. Setelah
selesai ia mencetak URL backend seperti `https://jejak7-api.jejak7-api.workers.dev/exec`.

> **Mengapa butuh jalur `/exec`?** Aplikasi menolak URL yang tidak berakhiran
> `/exec` (dicek di `core.js`, fungsi `isConfigured`). Worker juga menjawab di
> jalur root, tapi alamat yang dipakai aplikasi tetap yang berakhiran `/exec`.
> Jangan dihapus bagian itu.

<details>
<summary>Alternatif lama — Google Spreadsheet + Apps Script (masih bisa dipakai)</summary>

Kalau lebih suka tidak memakai Cloudflare, sistem lama masih utuh di folder
[`apps-script/`](apps-script/):

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
>
> Struktur sheet `SISWA`:
> `Kelas ID | No. Absen | Nama Lengkap | Sandi (hash) | Kode Orang Tua | Nama Panggilan`
> Kolom terakhir sengaja ditambahkan paling kanan, jadi sheet versi lama (5 kolom)
> tetap terbaca tanpa perlu migrasi.

</details>

### Langkah 2 — Tempel URL ke Website

1. Buka file [`assets/js/site-config.js`](assets/js/site-config.js)
2. Ganti baris `scriptUrl` dengan URL `/exec` tadi:

   ```js
   window.SITECONFIG = {
     scriptUrl: 'https://jejak7-api.jejak7-api.workers.dev/exec',
     namaApp: 'Jurnal 7 Anak Indonesia Hebat'
   };
   ```

3. **Unggah ulang** file tersebut ke repository (langkah 4)

> Cukup **satu kali**. Setelah itu semua perangkat — HP murid, HP orang tua, laptop guru —
> langsung terhubung tanpa perlu setting apa pun.
>
> ⚠️ Kalau pernah memakai Spreadsheet sebelumnya, **jangan** mengosongkan
> `scriptUrl`. Alasannya: perangkat lama menyimpan URL lamanya di `localStorage`,
> dan `localStorage` menang atas `site-config`. `core.js` sudah menangani
> ini — URL Google otomatis dikalahkan kalau `site-config` menunjuk ke tempat
> lain — tapi jangan bergantung pada itu kalau bisa dihindari.

### Langkah 3 — Jalankan Lokal (menguji)

```bash
python -m http.server 8080
```

Buka **http://localhost:8080/index.html**. Bisa juga langsung klik `index.html`
di browser — seluruh fungsi tetap jalan (data lewat backend yang terpasang).

### Langkah 4 — Konfigurasi Awal di Panel Guru

1. Buka halaman **Guru** (`guru.html`) dan login:
   **username `guru`** · **password `guru123`**
   → **segera ganti password** di tab *Pengaturan → Akun Guru* (hapus akun default)
2. Tab **Kelas & Siswa**: klik **Kelas Baru** di tab Dashboard dulu (misal `4A`)
3. **Tambah Siswa** (satu-satu) atau **Tempel Massal** (dari Excel)
4. **Sampaikan ke wali murid**:
   - ke **murid** → **No. Absen** (mis. `siswa01`) + **Nama Panggilan** (mis. `adi`)
   - ke **orang tua** → Kode Akses (satu kode = satu anak)
5. Cadangan login: klik **Salin Daftar Login** (atau **Unduh Template CSV**) di tab
   *Kelas & Siswa*. Nama panggilan tampil polos di tabel supaya guru bisa membantu
   murid yang lupa — ini bukan rahasia, cuma alat bantu ingat-mengingat.
6. Tab **Pengaturan** → atur **target jam bangun** sesuai kesepakatan sekolah

### Cara Murid Masuk

| Yang diisi | Contoh | Keterangan |
|---|---|---|
| No. Absen | `siswa01` | Bebas, huruf/angka. Dibuat berurutan otomatis oleh guru |
| Nama Panggilan | `adi` | Sama dengan yang tercatat guru, tidak peka huruf besar/kecil |

Kalau murid lupa nama panggilan: **tanya guru kelas**, guru bisa membacanya langsung
dari tabel *Kelas & Siswa* (atau dari daftar login yang sudah dicadangkan guru).

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
│   ├── img/
│   │   ├── logo.png         → 🖼️ LOGO APLIKASI (letakkan logomu di sini)
│   │   ├── logo.svg         → logo bawaan (dipakai kalau logo.png belum ada)
│   │   └── habits/         → 🖼️ 7 GAMBAR KEBIASAAN (sudah terisi, lihat README di dalamnya)
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

- Password guru dan nama panggilan murid disimpan sebagai **hash SHA-256** untuk login
- **Nama panggilan disimpan juga dalam bentuk polos** di sheet `SISWA` (kolom
  `Nama Panggilan`) supaya guru bisa membantu murid yang lupa — ini disengaja, karena
  untuk anak SD jauh lebih penting guru bisa membacanya daripada sandi yang
  benar-benar rahasia
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
| Murid tidak bisa login | Cek **No. Absen** & **Nama Panggilan** di tab **Kelas & Siswa**. Nama panggilan tampil polos — tinggal dibacakan ke murid, lalu klik ikon pensil untuk menggantinya |
| Orang tua tidak bisa masuk | Pastikan **Kode Akses** siswa sudah diisi (kolomnya boleh kosong saat tambah, bisa diisi ulang lewat Edit) |
| Data tidak muncul di rekap guru | Klik tombol **⟳ Sinkron** di kanan atas |
| Isian tersimpan tapi belum masuk database | Banner kuning "menunggu dikirim ulang" akan hilang sendiri setelah terkonfirmasi. Jangan tutup aplikasi buru-buru |
| Ingin ganti SD / tahun baru | Buat **kelas baru** di Dashboard, lalu pindahkan siswa lewat Tempel Massal. Data tahun lama tetap tersimpan |
| Ingin mulai dari nol | **Pengaturan → Kosongkan Jurnal** per kelas (data siswa tetap aman) |

---

## 🎨 Logo Aplikasi

Seluruh halaman memakai **satu logo yang sama**: di navbar (kotak 42 px) dan di
kotak logo pada kartu login.

### Cara memasang logo (paling mudah)

1. Siapkan logomu dalam bentuk **persegi** (ideal 512 × 512 px, PNG transparan
   atau JPG, di bawah 200 KB).
2. Salin ke folder `assets/img/` dengan nama **`logo.png`** (atau `logo.jpg` —
   ubah satu kata `png` → `jpg` di empat file HTML).
3. Commit & push. Logo langsung muncul di semua halaman.

Tidak ada kode yang perlu diubah, dan **kalau logomu belum diunggah**, aplikasi
otomatis memakai `assets/img/logo.svg` (logo bawaan) supaya tidak pernah tampil
gambar rusak.

> Kalau logo belum ada, tiap navbar menampilkan ikon bawaannya (buku / papan
> tulis / rumah) seperti sebelumnya — jadi halaman tetap rapi.

### Kalau logo disimpan di tempat lain

Isi satu baris di [`assets/js/site-config.js`](assets/js/site-config.js):

```js
logo: 'assets/img/logo-sekolah.png',   // boleh kosong (default)
```

Satu baris ini berlaku untuk **semua** halaman — navbar, halaman depan, sampai
kartu login. Kalau file yang ditunjuk tidak ada, sistem otomatis mundur ke
`assets/img/logo.svg`.

### Ukuran & tampilan

| Bagian | Ukuran kotak | Perilaku |
|---|---|---|
| Navbar | 42 × 42 px | Logo tidak dipotong (`object-fit: contain`),latar putih, ikon jadi cadangan |
| Kartu login | 76 × 76 px (62 px di HP) | Logo tidak dipotong, kotak putih dengan garis tipis |

Logo berbentuk **persegi** paling aman. Kalau logo berupa tulisan panjang
(wordmark) yang terlalu melebar, tampilannya tetap utuh tapi ukurannya jadi
kecil di navbar.

---

## 🎨 Tema Warna

Nuansa **hijau botol + krem**, dipadukan abu-abu netral untuk seluruh latar,
tombol, badge, dan garis. Semua latar merah muda (pink) dan merah marun
sengaja dibuang supaya hijau botol hanya muncul sebagai teks, isian, dan
tombol — warnanya jadi lebih bersih dan mudah ditukar tema.

```
Hijau gelap    #04201B   Krem aksen    #F0EAD8
Hijau bottle   #134A3B   Krem muda     #F8F5EC
Hijau mid      #175C49   Emas/krem    #E2D3A9
Teks netral    #14231F   Kartu        #FFFFFF
Latar halaman  #F8F6EF   Garis         #E4E0D3
```

> Nama variabel CSS masih `—maroon—` (misal `--maroon-700`) demi kompatibilitas
> dengan seluruh CSS yang sudah tertulis, **nilainya sekarang hijau botol**.
> Kalau ingin mengganti tema, cukup ubah blok `:root` di
> [`assets/css/base.css`](assets/css/base.css).

Tujuh kebiasaan memakai **warna berbeda** yang gelap dan pekat, supaya mudah
dibedakan di grafik rekap guru.

---

## 📄 Lisensi

Bebas dipakai dan dimodifikasi untuk kebutuhan pendidikan masing-masing sekolah.
