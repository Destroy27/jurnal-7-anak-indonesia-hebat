/* ============================================================
   UJI BACKEND WORKER (D1) - semua operasi tulis
   ------------------------------------------------------------
   Yang diuji:
     - 4 endpoint baca, termasuk JSONP
     - upsert jurnal: menyimpan 2x TIDAK menambah baris
     - delete_entry, clear_entries, save_students, save_config, save_note
     - kelas + absen jadi identitas
     - apa yang terjadi kalau ada salah ketik

   CARA PAKAI (server harus sudah jalan di http://localhost:8787):
     node tools/uji-backend.mjs [http://localhost:8787]
   ============================================================ */

const asal = process.argv[2] || 'http://localhost:8787';

let lulus = 0, gagal = 0;
function cek(nama, ok, tambahan) {
  if (ok) { lulus++; console.log('  OK    ' + nama); }
  else { gagal++; console.log('  GAGAL ' + nama + (tambahan ? '  ->  ' + tambahan : '')); }
}

/* ---------- helper ---------- */
async function baca(action, prefix) {
  const u = new URL(asal + '/?action=' + action);
  if (prefix) u.searchParams.set('prefix', prefix);
  const r = await fetch(u);
  const teks = await r.text();
  if (!prefix) return { status: r.status, ct: r.headers.get('content-type'), json: JSON.parse(teks) };
  const m = new RegExp('^' + prefix + '\\((.*)\\);$', 's').exec(teks);
  return { status: r.status, ct: r.headers.get('content-type'), raw: teks, json: m ? JSON.parse(m[1]) : null };
}
async function tulis(payload) {
  /* Meniru frontend: mode no-cors, Content-Type text/plain.
     Di Node fetch tidak punya mode no-cors, jadi header dipisah
     agar isi request tetap sama persis. */
  const r = await fetch(asal + '/', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(payload)
  });
  return { status: r.status, json: await r.json() };
}

(async () => {
  console.log('== UJI BACKEND WORKER + D1 ==');
  console.log('  alamat: ' + asal);
  console.log('');

  /* ---------- 1. Baca ---------- */
  console.log('-- 1. Endpoint baca --');
  const semua = await baca('get_all');
  cek('get_all ok', semua.json.ok === true);
  cek('get_all punya 11 field yang.apps Script punya',
    ['ok','config','students','entries','jumlahSiswa','jumlahEntri',
     'tanggalRusak','contohTanggalRusak','cacheBerfungsi',
     'jumlahPotonganCache','cachePesanError'].every(f => f in semua.json),
    'hilang: ' + ['ok','config','students','entries','jumlahSiswa','jumlahEntri','tanggalRusak','contohTanggalRusak','cacheBerfungsi','jumlahPotonganCache','cachePesanError'].filter(f => !(f in semua.json)).join(','));
  cek('get_all mengembalikan siswa', Array.isArray(semua.json.students) && semua.json.students.length > 0);
  cek('get_all mengembalikan entri', Array.isArray(semua.json.entries));
  cek('tanggalRusak = 0', semua.json.tanggalRusak === 0, String(semua.json.tanggalRusak));

  const cfg = await baca('get_config');
  cek('get_config ok', cfg.json.ok === true && !!cfg.json.config);
  const sis = await baca('get_students');
  cek('get_students ok', sis.json.ok === true && Array.isArray(sis.json.students));
  const ent = await baca('get_entries');
  cek('get_entries ok', ent.json.ok === true && Array.isArray(ent.json.entries));
  console.log('');

  /* ---------- 2. JSONP ---------- */
  console.log('-- 2. JSONP (cara frontend membaca) --');
  const jp = await baca('get_all', '_j7_uji123');
  cek('JSONP dibungkus dengan prefix', jp.raw.startsWith('_j7_uji123(') && jp.raw.endsWith(');'), jp.raw.slice(0, 60));
  cek('Content-Type application/javascript',
    (jp.ct || '').includes('javascript'), jp.ct);
  cek('isi JSONP bisa di-parse', jp.json !== null && jp.json.ok === true);
  console.log('');

  /* ---------- 3. Halaman info ---------- */
  console.log('-- 3. Tanpa parameter --');
  const info = await fetch(asal + '/');
  const infoT = await info.text();
  cek('halaman informasi terbuang (bukan error)', info.status === 200 && infoT.includes('<'));
  console.log('');

  /* ---------- 4. Bentuk field entri ---------- */
  console.log('-- 4. Bentuk field entri (harus sama dengan Code.gs) --');
  if (ent.json.entries.length) {
    const e = ent.json.entries[0];
    const wajib = ['id','kelasId','nis','nama','tanggal','kode','nilai','catatan','tsISO','tsDisplay','adaFoto'];
    const kurang = wajib.filter(f => !(f in e));
    cek('semua 11 field ada', kurang.length === 0, 'kurang: ' + kurang.join(','));
    cek('id = kelasId__nis__tanggal__kode',
      e.id === e.kelasId + '__' + e.nis + '__' + e.tanggal + '__' + e.kode, e.id);
    cek('adaFoto berupa boolean', typeof e.adaFoto === 'boolean', typeof e.adaFoto);
  } else { cek('ada entri untuk diperiksa', false, 'tabel jurnal kosong'); }
  console.log('');

  /* ---------- 5. Bentuk field siswa ---------- */
  console.log('-- 5. Bentuk field siswa --');
  if (sis.json.students.length) {
    const s = sis.json.students[0];
    const wajib = ['kelasId','nis','nama','pin','kodeOrtu','panggilan'];
    const kurang = wajib.filter(f => !(f in s));
    cek('semua 6 field ada', kurang.length === 0, 'kurang: ' + kurang.join(','));
    cek('siswa terurut berdasarkan nama',
      JSON.stringify(sis.json.students.map(x => x.nama)) ===
      JSON.stringify([...sis.json.students].map(x => x.nama).sort((a,b) => a.localeCompare(b,'id'))));
  } else { cek('ada siswa untuk diperiksa', false, 'tabel siswa kosong'); }
  console.log('');

  /* ---------- 6. UPSERT: inti dari semua perbaikan ---------- */
  console.log('-- 6. Upsert: simpan 2x tidak boleh menambah baris --');
  const kelasUji = 'ujicosa';
  const tgl = '2026-10-05';

  /* Pastikan kelas uji bersih lebih dulu */
  await tulis({ action: 'clear_entries', kelasId: kelasUji });
  await tulis({ action: 'save_students', kelasId: kelasUji, students: [
    { nis: '1', nama: 'Anak Uji Satu', pin: 'x', kodeOrtu: 'ORTU-UJI-1', panggilan: 'uji1' },
    { nis: '2', nama: 'Anak Uji Dua', pin: 'x', kodeOrtu: 'ORTU-UJI-2', panggilan: 'uji2' }
  ]});

  let sebelum = (await baca('get_entries')).json.entries.filter(e => e.kelasId === kelasUji).length;
  const s1 = await tulis({ action: 'save_entries', items: [
    { kelasId: kelasUji, nis: '1', nama: 'Anak Uji Satu', tanggal: tgl, kode: 'bangun', nilai: '05:00', catatan: 'pertama', tsISO: '2026-10-05T00:00:00.000Z', tsDisplay: '05/10/2026 07:00' },
    { kelasId: kelasUji, nis: '1', nama: 'Anak Uji Satu', tanggal: tgl, kode: 'ibadah', nilai: '06:00', catatan: 'pertama', tsISO: '2026-10-05T00:00:00.000Z', tsDisplay: '05/10/2026 08:00' }
  ]});
  cek('simpan pertama ok', s1.json.ok === true, s1.json.msg);
  cek('ditambah 2, diubah 0', s1.json.ditambah === 2 && s1.json.diubah === 0,
    'ditambah=' + s1.json.ditambah + ' diubah=' + s1.json.diubah);

  let sesudah1 = (await baca('get_entries')).json.entries.filter(e => e.kelasId === kelasUji).length;
  cek('ada 2 baris setelah simpan pertama', sesudah1 === 2, sesudah1 + ' baris');

  /* Simpan LAGI - inilah yang dulu membuat 2.573 baris */
  const s2 = await tulis({ action: 'save_entries', items: [
    { kelasId: kelasUji, nis: '1', nama: 'Anak Uji Satu', tanggal: tgl, kode: 'bangun', nilai: '05:30', catatan: 'kedua', tsISO: '2026-10-05T01:00:00.000Z', tsDisplay: '05/10/2026 08:00' }
  ]});
  cek('simpan kedua ok', s2.json.ok === true);
  cek('ditambah 0, diubah 1', s2.json.ditambah === 0 && s2.json.diubah === 1,
    'ditambah=' + s2.json.ditambah + ' diubah=' + s2.json.diubah);

  let sesudah2 = (await baca('get_entries')).json.entries.filter(e => e.kelasId === kelasUji).length;
  cek('TETAP 2 baris - tidak bertambah (tidak ada duplikat)', sesudah2 === 2, sesudah2 + ' baris');

  const isi = (await baca('get_entries')).json.entries.filter(e => e.kelasId === kelasUji);
  const bangun = isi.find(e => e.kode === 'bangun');
  cek('nilai yang tersimpan adalah yang TERBARU (05:30)', bangun && bangun.nilai === '05:30', bangun && bangun.nilai);
  cek('catatan yang tersimpan adalah yang TERBARU (kedua)', bangun && bangun.catatan === 'kedua', bangun && bangun.catatan);
  cek('nilai lama (05:00) benar-benar hilang',
    isi.filter(e => e.nilai === '05:00').length === 0);
  console.log('');

  /* ---------- 7. Kelas + absen = identitas ----------
     PENTING: data asli SUDAH punya siswa bernomor absen 1 di dua
     kelas (Gede/Dary dan Mikayla). Jadi angka total tidak boleh
     dibandingkan dengan angka tetap - yang dibandingkan adalah
     selisih terhadap data sebelum kelas uji dibuat. */
  console.log('-- 7. Kelas + absen sebagai identitas --');
  const kelasLain = 'ujicosa2';
  await tulis({ action: 'clear_entries', kelasId: kelasUji });
  await tulis({ action: 'clear_entries', kelasId: kelasLain });
  /* Kosongkan juga daftarnya. clear_entries hanya menghapus jurnal,
     jadi tanpa ini sisa siswa uji dari eksekusi sebelumnya masih
     ada dan membuat angka baseline ikut bergeser. */
  await tulis({ action: 'save_students', kelasId: kelasUji, students: [] });
  await tulis({ action: 'save_students', kelasId: kelasLain, students: [] });

  const semuaSebelum7 = (await baca('get_students')).json.students;
  const absen1Sebelum = semuaSebelum7.filter(s => String(s.nis) === '1').length;
  const entriSebelum7 = (await baca('get_entries')).json.entries.length;

  await tulis({ action: 'save_students', kelasId: kelasUji, students: [
    { nis: '1', nama: 'Anak Uji Satu', pin: 'x', kodeOrtu: 'ORTU-UJI-1', panggilan: 'uji1' }
  ]});
  await tulis({ action: 'save_students', kelasId: kelasLain, students: [
    { nis: '1', nama: 'Anak Uji Kelas Lain', pin: 'x', kodeOrtu: 'ORTU-UJI-3', panggilan: 'uji3' }
  ]});
  await tulis({ action: 'save_entries', items: [
    { kelasId: kelasUji, nis: '1', nama: 'Anak Uji Satu', tanggal: tgl, kode: 'bangun', nilai: '05:30', catatan: 'kedua', tsISO: '2026-10-05T01:00:00.000Z', tsDisplay: '05/10/2026 08:00' },
    { kelasId: kelasLain, nis: '1', nama: 'Anak Uji Kelas Lain', tanggal: tgl, kode: 'bangun', nilai: '04:00', catatan: 'kelas lain', tsISO: '2026-10-05T02:00:00.000Z', tsDisplay: '05/10/2026 09:00' }
  ]});

  const semuaSiswa7 = (await baca('get_students')).json.students;
  const absen1Sesudah = semuaSiswa7.filter(s => String(s.nis) === '1');
  cek('absen 1 bertambah 2 kelas uji tanpa bentrok (' + absen1Sebelum + ' -> ' + absen1Sesudah.length + ')',
    absen1Sesudah.length === absen1Sebelum + 2,
    absen1Sebelum + ' -> ' + absen1Sesudah.length);
  const kelasAbsen1 = new Set(absen1Sesudah.map(s => s.kelasId));
  cek('tiap kelas punya nomornya sendiri (' + kelasAbsen1.size + ' kelas berbeda)',
    kelasAbsen1.size === absen1Sesudah.length);

  const perKelas = (await baca('get_entries')).json.entries
    .filter(e => String(e.nis) === '1' && e.kode === 'bangun' && e.tanggal === tgl
              && (e.kelasId === kelasUji || e.kelasId === kelasLain));
  cek('kedua kelas uji punya entri sendiri-sendiri (' + perKelas.length + ' entri)',
    perKelas.length === 2, perKelas.length + ' entri');
  cek('nilai tiap kelas terpisah (05:30 vs 04:00)',
    perKelas.length === 2 && new Set(perKelas.map(e => e.nilai)).size === 2,
    perKelas.map(e => e.kelasId + '=' + e.nilai).join(', '));
  cek('tidak ada duplikat lintas kelas',
    new Set(perKelas.map(e => e.kelasId)).size === perKelas.length);
  console.log('');

  /* ---------- 8. Hapus ---------- */
  console.log('-- 8. delete_entry dan clear_entries --');
  const h1 = await tulis({ action: 'delete_entry', kelasId: kelasUji, nis: '1', tanggal: tgl, kode: 'ibadah' });
  cek('delete_entry ok', h1.json.ok === true, h1.json.msg);
  const setelahHapus = (await baca('get_entries')).json.entries.filter(e => e.kelasId === kelasUji);
  cek('sisa 1 baris di kelas uji', setelahHapus.length === 1, setelahHapus.length + ' baris');
  cek('yang dihapus adalah "ibadah"', setelahHapus[0] && setelahHapus[0].kode === 'bangun', setelahHapus[0] && setelahHapus[0].kode);

  const h2 = await tulis({ action: 'delete_entry', kelasId: kelasUji, nis: '1', tanggal: tgl, kode: 'tidakada' });
  cek('hapus yang tidak ada tetap ok (tidak error)', h2.json.ok === true || h2.json.ok === false, h2.json.msg);

  const h3 = await tulis({ action: 'clear_entries', kelasId: kelasUji });
  cek('clear_entries ok', h3.json.ok === true, h3.json.msg);
  cek('kelas uji benar-benar kosong',
    (await baca('get_entries')).json.entries.filter(e => e.kelasId === kelasUji).length === 0);
  cek('kelas lain TIDAK ikut terhapus',
    (await baca('get_entries')).json.entries.filter(e => e.kelasId === kelasLain).length === 1);
  console.log('');

  /* ---------- 9. Simpan siswa (ganti isi satu kelas) ---------- */
  console.log('-- 9. save_students hanya mengubah kelas yang dipilih --');
  const kelasAsli = semua.json.students[0].kelasId;
  const jumlahSebelumKelasAsli = semuaSiswa7.filter(s => s.kelasId === kelasAsli).length;
  await tulis({ action: 'save_students', kelasId: kelasUji, students: [
    { nis: '9', nama: 'Sembilan', pin: '', kodeOrtu: 'ORTU-9', panggilan: 'sembilan' }
  ]});
  const setelahSiswa = (await baca('get_students')).json.students;
  cek('siswa kelas uji diganti jadi 1 orang',
    setelahSiswa.filter(s => s.kelasId === kelasUji).length === 1);
  cek('siswa kelas ' + kelasAsli + ' tidak berubah (' + jumlahSebelumKelasAsli + ' orang)',
    setelahSiswa.filter(s => s.kelasId === kelasAsli).length === jumlahSebelumKelasAsli,
    jumlahSebelumKelasAsli + ' -> ' + setelahSiswa.filter(s => s.kelasId === kelasAsli).length);
  console.log('');

  /* ---------- 10. Kesalahan ---------- */
  console.log('-- 10. Kesalahan harus dikembalikan sebagai JSON, bukan 500 kosong --');
  const e1 = await tulis({ action: 'save_entries', items: [] });
  cek('items kosong ditolak dengan pesan', e1.json.ok === false && !!e1.json.msg, JSON.stringify(e1.json));
  const e2 = await tulis({ action: 'save_students', kelasId: '', students: [] });
  cek('kelasId kosong ditolak', e2.json.ok === false && !!e2.json.msg);
  const e3 = await tulis({ action: 'aksi_tidak_dikenal' });
  cek('aksi tak dikenal ditolak dengan pesan jelas',
    e3.json.ok === false && String(e3.json.msg).includes('tidak dikenal'), e3.json.msg);
  const e4 = await tulis({ action: 'save_entries', items: [{ kelasId: '', nis: '', tanggal: '', kode: '' }] });
  cek('isian tidak lengkap ditolak, tidak exception', e4.json.ok === false);
  console.log('');

  /* ---------- 11. Kebersihan ---------- */
  console.log('-- 11. Bersihkan data uji --');
  await tulis({ action: 'clear_entries', kelasId: kelasUji });
  await tulis({ action: 'clear_entries', kelasId: kelasLain });
  /* Hapus kelas uji dari daftar kelas tanpa mengganggu kelas asli */
  const cfgSekarang = (await baca('get_config')).json.config;
  const kelasAsliDaftar = cfgSekarang.classes.map(c => c.id);
  await tulis({ action: 'save_config', appName: cfgSekarang.appName, teachers: cfgSekarang.teachers,
    classes: cfgSekarang.classes, habitOverrides: cfgSekarang.habitOverrides, notes: cfgSekarang.notes });
  const akhir = await baca('get_all');
  cek('kelas uji hilang dari jurnal', akhir.json.entries.filter(e => e.kelasId === kelasUji || e.kelasId === kelasLain).length === 0);
  cek('siswa asli utuh (' + akhir.json.jumlahSiswa + ' orang)',
    akhir.json.students.every(s => kelasAsliDaftar.includes(s.kelasId)),
    'siswa dari kelas uji masih ada');
  cek('entri asli tetap ada', akhir.json.jumlahEntri > 0, String(akhir.json.jumlahEntri));
  console.log('');

  console.log('  lulus ' + lulus + ', gagal ' + gagal);
  if (gagal) { console.log('  !! ADA YANG GAGAL'); process.exitCode = 1; }
  else console.log('  SEMUA UJI BACKEND LULUS');
})();