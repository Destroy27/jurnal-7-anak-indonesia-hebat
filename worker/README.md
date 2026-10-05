# JEJAK 7 KAIH - Backend Cloudflare (Worker + D1)

Ini adalah pengganti `apps-script/Code.gs`. Tampilan aplikasi
**tidak diubah sama sekali** - semua nama aksi dan bentuk data sengaja
dibuat sama persis.

Status sekarang: **sudah ditulis dan sudah diuji penuh di komputer ini,
tetapi belum dipasang di internet.** Yang belum bisa saya lakukan sendiri
adalah masuk ke akun Cloudflare Tuan.

---

## Yang sudah dibuktikan (bukan perkiraan)

| Yang diuji | Hasil |
|---|---|
| Bentuk respons `get_all` | 11 field, sama persis dengan Apps Script |
| Bentuk data siswa | 6 field sama persis |
| Bentuk data entri | 11 field sama persis |
| 2.573 baris spreadsheet -> D1 | 70 baris, **13/13 cocok**, tidak ada isian hilang |
| Operasi tulis (upsert) | 47/47 uji lulus |
| Uji frontend `smoke-core` | 41 fungsi, 0 exception |
| Uji frontend `tes-kelas` | 14/14 lulus |
| Uji frontend `tes-login` | 10 lulus, 1 gagal (itu memang uji negatif) |
| Pekerjaan server per permintaan | 1-16 ms (dari log wrangler dev) |
| Ukuran data terkirim | 698.048 B -> 21.638 B (97% lebih kecil) |

Yang **belum** diketahui: kecepatan dari internet ke Cloudflare sungguhan.
Angka 1-16 ms di atas adalah pekerjaan di sisi server saja, di komputer
Tuan sendiri. Butuh akun Cloudflare untuk mengukurnya.

---

## CARA MEMASANG (5 langkah, sekali saja)

### Langkah 1 - Masuk ke akun Cloudflare

Buka PowerShell di folder `worker`, lalu jalankan:

```powershell
npx wrangler login
```

Browser akan terbuka. Pilih "Allow" pada halaman Cloudflare.
Kalau muncul peringatan, pilih "Allow".

**Harus muncul tanda ini kalau berhasil:**

```
Successfully logged in
```

### Langkah 2 - Buat database

```powershell
npx wrangler d1 create jejak7
```

Akan muncul seperti ini:

```
[[d1_databases]]
binding = "DB"
database_name = "jejak7"
database_id = "e5a1b2c3-d4e5-f6a7-b8c9-d0e1f2a3b4c5"
```

**Salin hanya `database_id`-nya**, lalu tempel ke baris
`database_id =` di berkas `wrangler.toml`. Ganti yang ada sekarang
(`00000000-0000-0000-0000-000000000000`) dengan milik Tuan.

> Hati-hati: salin UUID-nya saja. Jangan ikut menyalin tanda kurung siku
> `[[ ]]` atau nama `binding`.

### Langkah 3 - Buat tabel di database

```powershell
npx wrangler d1 execute jejak7 --remote --file=migrations/0001_init.sql
```

Harus muncul: `6 commands executed successfully`

### Langkah 4 - Masukkan data yang sekarang ada

Unek-export data lama dari aplikasi yang sekarang masih jalan
(buka di browser, salin alamat ini):

```
https://script.google.com/macros/s/AKfycbw6G4vDvW1eo237lnk3O-OITMpw76CjXLmegXYCggvsgE3j2RcCNtfiJZwbZd136bcn/exec?action=get_all
```

Simpan teksnya sebagai `get_all.json` (pakai Notepad: Simpan Sebagai,
pilih "All Files" supaya akhirannya `.json`).

Lalu jalankan:

```powershell
node tools/impor-dari-spreadsheet.mjs get_all.json impor.sql
npx wrangler d1 execute jejak7 --remote --file=impor.sql
```

Yang diharapkan di layar:

```
entri : 2573 -> 70  (duplikat dibuang: 2503)
92 commands executed successfully
```

**Jangan pakai `>` di PowerShell** untuk menulis `impor.sql`. PowerShell
menulis hasilnya sebagai UTF-16 dan ditolak wrangler dengan pesan
"Configuration file contains UTF-16 LE byte order marker". Skrip di atas
sudah menulis sendiri sebagai UTF-8.

### Langkah 5 - Pasang Worker

```powershell
npx wrangler deploy
```

Akan muncul alamat seperti:

```
https://jejak7-api.namamu.workers.dev
```

Buka alamat itu di browser. Kalau muncul tulisan hijau **"JEJAK 7 KAIH aktif"**,
berarti sudah jalan.

---

## Langkah terakhir - Yang paling mudah dibatalkan

Buka `assets/js/site-config.js`, **baris 18**, ganti alamat backend:

```js
scriptUrl: 'https://jejak7-api.namamu.workers.dev',
```

Lalu unggah ke GitHub seperti biasa.

### Kalau ada masalah, kembalikan dalam 1 menit

Ubah **baris yang sama** kembali:

```js
scriptUrl: 'https://script.google.com/macros/s/AKfycbw6G4vDvW1eo237lnk3O-OITMpw76CjXLmegXX/exec',
```

Data di spreadsheet **tidak dihapus** sama sekali. Jadi kembali ke yang
lama selalu bisa.

---

## Kalau perlu menguji ulang

```powershell
npx wrangler dev --local --port 8787        # jalankan server uji
node tools/uji-backend.mjs http://localhost:8787   # 47 uji
node tools/bukti-kecocokan.mjs data_lama.json data_baru.json   # 13 uji
```

`uji-backend.mjs` menghapus sendiri data ujinya di akhir, jadi data asli
tidak tersentuh.

---

## Yang perlu diketahui

- **Kuota.** Paket gratis Cloudflare: 100.000 permintaan/hari, dan aplikasi
  ini memakai sekitar 270 permintaan/hari. Tidak akan pernah habis.
  Sheets, sebaliknya, punya batas 90 menit/hari - dan itulah yang pernah
  membuat aplikasi tidak bisa dibuka.
- **Tidak ada timer yang menyala sendiri.** Semua sinkron hanya terjadi saat
  perangkat benar-benar dipakai. Ini yang membuat pemakaiannya sangat sedikit.
- **Zona waktu** diatur di `wrangler.toml` (`ZONA_WAKTU`). Tanggal sebenarnya
  selalu comes dari perangkat murid, jadi nilai ini hampir tidak pernah dipakai.
- **Kunci database.** `jurnal` punya kunci `(kelas, no. absen, tanggal, kebiasaan)`.
  Ini yang membuat 97,3% duplikat tidak akan pernah terjadi lagi - mengisi
  ulang hari yang sama menimpa, bukan menambah.