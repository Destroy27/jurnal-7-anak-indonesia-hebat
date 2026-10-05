/* ============================================================
   BUKTI KECOCOKAN: 70 baris D1 vs 2.573 baris spreadsheet
   ------------------------------------------------------------
   Pertanyaan yang dijawab: setelah frontend membuang duplikat
   (mengambil baris terbaru per tanggal+kode), apakah hasilnya
   SAMA PERSAIS dengan data 2.573 baris?

   Kalau sama, berarti pindah ke D1 tidak mengubah apa pun yang
   dilihat murid dan guru. Kalau tidak sama, berarti ada isian
   yang hilang - dan itu harus diketahui sebelum deploy.

   CARA PAKAI:
     node tools/bukti-kecocokan.mjs <apps-script.json> <worker.json>
   ============================================================ */

import { readFileSync } from 'node:fs';

const [, , fLama, fBaru] = process.argv;
if (!fLama || !fBaru) {
  console.error('Cara pakai: node tools/bukti-kecocokan.mjs <apps-script.json> <worker.json>');
  process.exit(1);
}

const lama = JSON.parse(readFileSync(fLama, 'utf8'));
const baru = JSON.parse(readFileSync(fBaru, 'utf8'));

let lulus = 0, gagal = 0;
function cek(nama, ok, tambahan) {
  if (ok) { lulus++; console.log('  OK    ' + nama); }
  else { gagal++; console.log('  GAGAL ' + nama + (tambahan ? '  ->  ' + tambahan : '')); }
}

/* --- Bentuk "apa yang dilihat murid": kelas + absen + tanggal + kode --- */
function sidik(e) {
  return [e.kelasId, String(e.nis), e.tanggal, e.kode].join('|');
}

/* --- Cara frontend menyimpan entri: terbaru per (kelas, absen, tanggal, kode) ---
   PENTING: kuncinya HARUS menyertakan kelas dan nomor absen.
   Frontend memanggil entriesOf(nis) - jadi per anak. Kalau kuncinya
   hanya tanggal+kode, semua anak akan saling menimpa dan skrip ini
   melaporkan ketidakcocokan yang palsu. */
function rapikan(entri) {
  const peta = new Map();
  for (const e of entri) {
    const k = sidik(e);
    const sebelum = peta.get(k);
    if (!sebelum || String(e.tsISO || '') > String(sebelum.tsISO || '')) peta.set(k, e);
  }
  return [...peta.values()].sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));
}

console.log('== BUKTI KECOCOKAN DATA ==');
console.log('  Apps Script : ' + lama.entries.length.toLocaleString('id-ID') + ' entri');
console.log('  Worker D1   : ' + baru.entries.length.toLocaleString('id-ID') + ' entri');
console.log('');

const rapiLama = rapikan(lama.entries);
const petaBaru = new Map(baru.entries.map(e => [sidik(e), e]));

console.log('-- 1. Setelah dibuang duplikat, jumlahnya harus sama --');
cek('entri unik identik (' + rapiLama.length + ')',
  rapiLama.length === baru.entries.length,
  'rapikan=' + rapiLama.length + ' worker=' + baru.entries.length);
console.log('');

console.log('-- 2. Setiap entri harus ada di D1, nilainya tidak boleh beda --');
let hilang = [], bedaNilai = [];
for (const e of rapiLama) {
  const k = sidik(e);
  const d = petaBaru.get(k);
  if (!d) { hilang.push(k); continue; }
  for (const f of ['nama', 'nilai', 'catatan', 'tsISO', 'tsDisplay', 'adaFoto']) {
    if (String(e[f]) !== String(d[f])) bedaNilai.push(k + '  [' + f + '] "' + e[f] + '" vs "' + d[f] + '"');
  }
}
cek('tidak ada entri yang hilang (' + (rapiLama.length - hilang.length) + '/' + rapiLama.length + ')',
  hilang.length === 0, hilang.slice(0, 3).join(', '));
cek('tidak ada nilai yang berbeda',
  bedaNilai.length === 0, bedaNilai.slice(0, 3).join(' | '));
console.log('');

console.log('-- 3. D1 tidak boleh punya entri tambahan yang tidak ada di spreadsheet --');
const setLama = new Set(rapiLama.map(sidik));
const tambahan = baru.entries.filter(e => !setLama.has(sidik(e))).map(sidik);
cek('tidak ada entri tambahan', tambahan.length === 0, tambahan.slice(0, 3).join(', '));
console.log('');

console.log('-- 4. Siswa harus identik --');
const kS = s => [s.kelasId, String(s.nis), s.nama, s.pin, s.kodeOrtu, s.panggilan].join('|');
const setSiswaLama = lama.students.map(kS).sort();
const setSiswaBaru = baru.students.map(kS).sort();
cek('daftar siswa sama persis (' + setSiswaBaru.length + ' orang)',
  JSON.stringify(setSiswaLama) === JSON.stringify(setSiswaBaru),
  'beda: ' + setSiswaBaru.filter(x => !setSiswaLama.includes(x)).join(', '));
cek('jumlah siswa sama',
  lama.students.length === baru.students.length,
  lama.students.length + ' vs ' + baru.students.length);
console.log('');

console.log('-- 5. Config harus identik --');
for (const f of ['appName']) {
  cek('config.' + f + ' sama',
    String(lama.config[f]) === String(baru.config[f]),
    '"' + lama.config[f] + '" vs "' + baru.config[f] + '"');
}
for (const f of ['teachers', 'classes', 'habitOverrides', 'notes']) {
  const a = JSON.stringify(lama.config[f]);
  const b = JSON.stringify(baru.config[f]);
  cek('config.' + f + ' sama (' + (Array.isArray(lama.config[f]) ? lama.config[f].length : 'obj') + ')',
    a === b, a === b ? '' : 'beda');
}
console.log('');

console.log('-- 6. Tanggal rusak harus tetap 0 --');
cek('tanggalRusak = 0', baru.tanggalRusak === 0, String(baru.tanggalRusak));
cek('semua tanggal di D1 itu tanggal kalender sungguhan',
  baru.entries.every(e => /^\d{4}-\d{2}-\d{2}$/.test(e.tanggal)),
  baru.entries.filter(e => !/^\d{4}-\d{2}-\d{2}$/.test(e.tanggal)).map(e => e.tanggal).join(', '));
console.log('');

console.log('-- 7. Ukuran --');
const bLama = JSON.stringify(lama.entries).length;
const bBaru = JSON.stringify(baru.entries).length;
console.log('  JSON entri: ' + bLama.toLocaleString('id-ID') + ' B  ->  ' + bBaru.toLocaleString('id-ID') + ' B' +
  '  (hemat ' + (100 - bBaru / bLama * 100).toFixed(1) + '%)');
console.log('');

console.log('  lulus ' + lulus + ', gagal ' + gagal);
if (gagal) { console.log('  !! ADA YANG TIDAK COCOK - jangan deploy sebelum ini diperbaiki'); process.exitCode = 1; }
else console.log('  SEMUA COCOK - pindah ke D1 tidak mengubah apa pun yang dilihat pengguna');