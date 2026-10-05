/* ============================================================
   IMPOR DATA DARI SPREADSHEET KE D1
   ------------------------------------------------------------
   Membaca berkas JSON hasil unduhan ?action=get_all, lalu
   menulisnya sebagai SQL untuk D1.

   PENTING: 2.573 baris lama hanya berisi 70 kombinasi unik.
   Yang diimpor hanya yang terbaru per kombinasi - persis seperti
   yang dilakukan menu "Perbaiki Tanggal & Jam", dan persis seperti
   yang sudah dilakukan frontend saat menampilkan (frontend juga
   mengambil baris terbaru per tanggal+kode). Jadi hasil akhirnya
   identik, tapi tabelnya jadi 36x lebih kecil dan tidak akan
   pernah membengkak lagi.

   CARA PAKAI:
     node tools/impor-dari-spreadsheet.mjs <berkas-get_all.json> impor.sql

   UJUNG KELUARAN WAJIB lewat argumen kedua, BUKAN lewat ">" dari
   PowerShell. PowerShell menulis hasil ">" sebagai UTF-16 LE, dan
   wrangler menolaknya dengan pesan "Configuration file contains
   UTF-16 LE byte order marker". Skrip ini menulis UTF-8 sendiri,
   jadi bebas jebakan.
   ============================================================ */

import { readFileSync, writeFileSync } from 'node:fs';

/* ---------- Util: escape SQL ---------- */
function sql(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function pad2(n) {
  n = Number(n);
  return (n < 10 ? '0' : '') + n;
}

/* ---------- Tanggal ---------- */
function fmtTanggalISO(v) {
  if (v === null || v === undefined || v === '') return '';
  const s = String(v).trim();
  const m = /^(\d{4})-(\d{1,2})-(\d{1,3})/.exec(s);
  if (m) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
  const p = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
  if (p) return p[3] + '-' + pad2(p[2]) + '-' + pad2(p[1]);
  return s;
}
function isoTanggalSah(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return false;
  const y = Number(m[1]), bln = Number(m[2]), hr = Number(m[3]);
  if (bln < 1 || bln > 12 || hr < 1 || hr > 31) return false;
  const d = new Date(Date.UTC(y, bln - 1, hr));
  return d.getUTCFullYear() === y && d.getUTCMonth() === bln - 1 && d.getUTCDate() === hr;
}
function fmtJamHM(v) {
  if (v === null || v === undefined || v === '') return '';
  const s = String(v).trim();
  const m = /^(\d{1,3}):(\d{1,2})$/.exec(s);
  if (m) {
    const jam = Number(m[1]), menit = Number(m[2]);
    if (jam <= 23 && menit <= 59) return pad2(jam) + ':' + pad2(menit);
    return s;
  }
  return s;
}
function teks(v) { return String(v == null ? '' : v).trim(); }

/* ---------- Baca masukan ---------- */
const berkas = process.argv[2];
const keluar = process.argv[3];
if (!berkas || !keluar) {
  console.error('Cara pakai:');
  console.error('  node tools/impor-dari-spreadsheet.mjs <berkas-get_all.json> <keluaran.sql>');
  console.error('');
  console.error('Jangan pakai ">" dari PowerShell - hasilnya UTF-16 dan ditolak wrangler.');
  process.exit(1);
}
const data = JSON.parse(readFileSync(berkas, 'utf8'));
const cfg = data.config || {};
const siswa = data.students || [];
const semuaEntri = data.entries || [];

/* ---------- CONFIG ---------- */
const barisConfig = [
  ['app_name', cfg.appName || 'Jurnal 7 Anak Indonesia Hebat'],
  ['teachers', JSON.stringify(cfg.teachers || [])],
  ['classes', JSON.stringify(cfg.classes || [])],
  ['habit_overrides', JSON.stringify(cfg.habitOverrides || {})],
  ['notes', JSON.stringify(cfg.notes || [])]
];

/* ---------- SISWA ---------- */
/* Buang baris yang tidak lengkap, dan nomor absen ganda dalam
   kelas yang sama (duplikat kelas BERBEDA dibiarkan - itu sah). */
const siswaBersih = [];
const sudah = new Set();
let siswaBuang = 0;
for (const s of siswa) {
  const kelasId = teks(s.kelasId);
  const nis = teks(s.nis);
  const nama = teks(s.nama);
  if (!kelasId || !nis || !nama) { siswaBuang++; continue; }
  const kunci = kelasId + '||' + nis;
  if (sudah.has(kunci)) { siswaBuang++; continue; }
  sudah.add(kunci);
  siswaBersih.push({ kelasId, nis, nama, pin: teks(s.pin), kodeOrtu: teks(s.kodeOrtu), panggilan: teks(s.panggilan) });
}

/* ---------- JURNAL: ambil yang terbaru per kombinasi ---------- */
const peta = new Map();
let tanggalTidakSah = 0;
for (const e of semuaEntri) {
  const kelasId = teks(e.kelasId);
  const nis = teks(e.nis);
  const tanggal = fmtTanggalISO(e.tanggal);
  const kode = teks(e.kode);
  if (!kelasId || !nis || !kode) continue;
  if (!isoTanggalSah(tanggal)) { tanggalTidakSah++; continue; }

  const kunci = kelasId + '||' + nis + '||' + tanggal + '||' + kode;
  const lama = peta.get(kunci);
  const ts = String(e.tsISO || '');
  if (!lama || ts > String(lama.tsISO || '')) {
    peta.set(kunci, {
      kelasId, nis, nama: teks(e.nama), tanggal, kode,
      nilai: fmtJamHM(e.nilai), catatan: teks(e.catatan),
      tsISO: ts, tsDisplay: fmtJamHM(e.tsDisplay),
      adaFoto: (e.adaFoto === true || String(e.adaFoto).toLowerCase() === 'true') ? 1 : 0
    });
  }
}
const jurnal = [...peta.values()];

/* ---------- Tulis SQL ---------- */
const out = [];
out.push('-- ============================================================');
out.push('-- IMPOR JURNAL 7 KAIH - dihasilkan tools/impor-dari-spreadsheet.mjs');
out.push('--   siswa  : ' + siswa.length + ' -> ' + siswaBersih.length + ' (buang ' + siswaBuang + ')');
out.push('--   entri  : ' + semuaEntri.length + ' -> ' + jurnal.length + ' (buang ' + (semuaEntri.length - jurnal.length) + ' duplikat)');
out.push('--   tanggal tidak sah dibuang: ' + tanggalTidakSah);
out.push('-- ============================================================');
out.push('PRAGMA foreign_keys = OFF;');
out.push('BEGIN TRANSACTION;');
out.push('');
out.push('DELETE FROM jurnal;');
out.push('DELETE FROM siswa;');
out.push('DELETE FROM config;');
out.push('');

out.push('-- CONFIG');
for (const [k, v] of barisConfig) {
  out.push('INSERT OR REPLACE INTO config (key, value) VALUES (' + sql(k) + ', ' + sql(v) + ');');
}
out.push('');

out.push('-- SISWA');
for (const s of siswaBersih) {
  out.push('INSERT OR REPLACE INTO siswa (kelas_id, nis, nama, pin, kode_ortu, panggilan) VALUES (' +
    sql(s.kelasId) + ', ' + sql(s.nis) + ', ' + sql(s.nama) + ', ' +
    sql(s.pin) + ', ' + sql(s.kodeOrtu) + ', ' + sql(s.panggilan) + ');');
}
out.push('');

out.push('-- JURNAL');
for (const j of jurnal) {
  out.push('INSERT OR REPLACE INTO jurnal ' +
    '(kelas_id, nis, nama, tanggal, kode, nilai, catatan, ts_iso, ts_display, ada_foto) VALUES (' +
    sql(j.kelasId) + ', ' + sql(j.nis) + ', ' + sql(j.nama) + ', ' + sql(j.tanggal) + ', ' +
    sql(j.kode) + ', ' + sql(j.nilai) + ', ' + sql(j.catatan) + ', ' +
    sql(j.tsISO) + ', ' + sql(j.tsDisplay) + ', ' + j.adaFoto + ');');
}
out.push('');
out.push('COMMIT;');

/* Ringkasan ke stderr supaya tidak ikut jadi SQL. */
console.error('---- ringkasan impor ----');
console.error('siswa : ' + siswa.length + ' -> ' + siswaBersih.length);
console.error('entri : ' + semuaEntri.length + ' -> ' + jurnal.length +
  '  (duplikat dibuang: ' + (semuaEntri.length - jurnal.length) + ')');
if (tanggalTidakSah > 0) {
  console.error('PERHATIAN: ' + tanggalTidakSah + ' entri bermasalah tanggal dan DIBUANG.');
}
writeFileSync(keluar, out.join('\n') + '\n', 'utf8');
console.error('ditulis : ' + keluar + '  (' + (out.join('\n').length + 1).toLocaleString('id-ID') + ' B, UTF-8)');