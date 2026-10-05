-- ============================================================
-- JEJAK 7 KAIH - Skema database (Cloudflare D1 / SQLite)
-- ------------------------------------------------------------
-- Menggantikan sheet CONFIG, SISWA, dan JURNAL.
--
-- PERBEDAAN PENTING dari spreadsheet:
--
-- Sheet JURNAL dulu "menambah baris" setiap kali murid menyimpan.
-- Satu anak + satu tanggal + satu kebiasaan bisa punya ratusan
-- baris - terbukti di data lama: 2.573 baris untuk 70 kombinasi,
-- jadi 97,3% duplikat. Baris paling banyak: 276 baris untuk
-- satu anak satu hari.
--
-- Di sini, PRIMARY KEY membuat duplikat tidak mungkin terjadi.
-- Menyimpan ulang hari yang sama menimpa baris yang ada,
-- bukan menambah. Jadi masalah 97,3% duplikat selesai permanen
-- tanpa perlu ever menjalankan "pembersihan" lagi.
-- ============================================================

-- ---------- CONFIG (pengganti sheet CONFIG | Key | Value) ----------
-- Bentuk isinya sama persis dengan yang sudah dibaca frontend,
-- supaya tidak ada perubahan sama sekali di sisi aplikasi.
CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---------- SISWA ----------
-- Kunci utama: (kelas_id, nis), BUKAN nis saja.
-- No. absen hanya unik dalam satu kelas - dua kelas boleh
-- sama-sama punya anak nomor 1. Ini yang membuat identitas
-- menjadi pasangan (kelas, no. absen).
CREATE TABLE IF NOT EXISTS siswa (
  kelas_id  TEXT NOT NULL,
  nis       TEXT NOT NULL,
  nama      TEXT NOT NULL DEFAULT '',
  pin       TEXT NOT NULL DEFAULT '',
  kode_ortu TEXT NOT NULL DEFAULT '',
  panggilan TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (kelas_id, nis)
);

-- Dipakai untuk cari berdasarkan no. absen saja (tanpa kelas),
-- mis. saat guru mengetik di kotak pencarian.
CREATE INDEX IF NOT EXISTS idx_siswa_nis ON siswa (nis);

-- ---------- JURNAL ----------
-- Kunci utama ini sama persis dengan bentuk id yang sudah
-- dipakai frontend: kelasId__nis__tanggal__kode.
CREATE TABLE IF NOT EXISTS jurnal (
  kelas_id   TEXT NOT NULL,
  nis        TEXT NOT NULL,
  nama       TEXT NOT NULL DEFAULT '',
  tanggal    TEXT NOT NULL,
  kode       TEXT NOT NULL,
  nilai      TEXT NOT NULL DEFAULT '',
  catatan    TEXT NOT NULL DEFAULT '',
  ts_iso     TEXT NOT NULL DEFAULT '',
  ts_display TEXT NOT NULL DEFAULT '',
  ada_foto   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kelas_id, nis, tanggal, kode)
);

-- get_all selalu mengurutkan tanggal DESC, jadi indeks ini
-- membuat urutan itu gratis.
CREATE INDEX IF NOT EXISTS idx_jurnal_tanggal ON jurnal (tanggal DESC);

-- Panel guru menghapus jurnal satu kelas penuh, jadi ini
--dipakai ketika kelas dihapus.
CREATE INDEX IF NOT EXISTS idx_jurnal_kelas ON jurnal (kelas_id);