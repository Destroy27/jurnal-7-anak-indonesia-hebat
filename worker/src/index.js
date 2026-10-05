/* ============================================================
   JEJAK 7 KAIH - Backend (Cloudflare Worker + D1)
   ------------------------------------------------------------
   PENGGANTI Code.gs (Google Apps Script + Spreadsheet).

   Frontend TIDAK PERLU diubah sama sekali. Semua nama aksi,
   nama field, dan bentuk respons sengaja dibuat sama persis
   dengan Code.gs:

     Baca (JSONP)   ?action=get_all | get_config | get_students | get_entries
     Tulis (POST)   action=save_config | save_students | save_entries |
                    delete_entry | clear_entries | save_note

   Bentuk balasan yang WAJIB dipertahankan:
     siswa  : kelasId, nis, nama, pin, kodeOrtu, panggilan
     entri  : id, kelasId, nis, nama, tanggal, kode, nilai,
              catatan, tsISO, tsDisplay, adaFoto
     config : appName, teachers, classes, habitOverrides, notes
     get_all: ok, config, students, entries, jumlahSiswa,
              jumlahEntri, tanggalRusak, contohTanggalRusak,
              cacheBerfungsi, jumlahPotonganCache, cachePesanError

   Catatan: cacheBerfungsi selalu true di sini karena D1 tidak
   punya batas 100 KB per kunci seperti CacheService. Yang dulu
   700 KB dan tidak muat, sekarang jadi beberapa baris dengan
   indeks.
   ============================================================ */

/* ---------------- Zona waktu ----------------
   Hanya dipakai untuk jalur pemulihan tanggal rusak dan kolom
   Waktu Tampil. Tanggal ordinarily datang dari perangkat murid
   (sudah berupa "YYYY-MM-DD"), jadi zona ini hampir tak pernah
   dipakai. Diukur dari data lama: ketidakcocokan tanggal vs UTC
   mulai tepat pukul 17:00 UTC = 00:00 WIB.
   Kalau ternyata sekolah memakai WITA, ubah satu baris ini. */
var ZONA = 'Asia/Makassar';

/* Akun guru bawaan - sama persis dengan Code.gs, supaya kalau
   database baru masih kosong, guru tetap bisa masuk. Password
   = SHA-256 dari "guru123". Segera ganti di Panel Guru. */
var GURU_AWAL = {
  user: 'guru',
  nama: 'Guru',
  pass: 'ae81343369944399b70de862dbe75536faa8e44c50ad0a312e380303173f4756'
};

/* ============================================================
   PENANGANAN WAKTU & TANGGAL
   (diterjemahkan apa adanya dari Code.gs)
   ============================================================ */

function pad2(n) {
  n = Number(n);
  return (n < 10 ? '0' : '') + n;
}

/* Tanggal "YYYY-MM-DD" dalam zona sekolah, bukan UTC. */
function fmtZona(d, pola) {
  var bagian = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(d);
  var p = {};
  for (var i = 0; i < bagian.length; i++) p[bagian[i].type] = bagian[i].value;
  if (pola === 'yyyy-MM-dd') return p.year + '-' + p.month + '-' + p.day;
  if (pola === 'HH:mm') return p.hour + ':' + p.minute;
  if (pola === 'dd/MM/yyyy HH:mm') {
    return p.day + '/' + p.month + '/' + p.year + ' ' + p.hour + ':' + p.minute;
  }
  if (pola === 'dd/MM/yyyy') return p.day + '/' + p.month + '/' + p.year;
  return '';
}

function fmtTanggalISO(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date && !isNaN(v.getTime())) return fmtZona(v, 'yyyy-MM-dd');
  var s = String(v).trim();
  /* hari 1-3 digit supaya sisa format rusak lama ("2026-10-003")
     tetap dinormalkan jadi 2026-10-03 */
  var m = /^(\d{4})-(\d{1,2})-(\d{1,3})/.exec(s);
  if (m) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
  /* dd/MM/yyyy (format bawaan Sheets saat locale Singapura) */
  var p = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
  if (p) return p[3] + '-' + pad2(p[2]) + '-' + pad2(p[1]);
  return s;
}

/* Jam masih bisa tersimpan dengan 3 digit ("005:30", "009:18")
   karena bug pad2 lama. Angka 0 di depan jam hanya beli satu
   karakter, bukan makna - jam aslinya tetap 5, bukan 5 jam. */
function fmtJamHM(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date && !isNaN(v.getTime())) return fmtZona(v, 'HH:mm');
  var s = String(v).trim();
  var m = /^(\d{1,3}):(\d{1,2})$/.exec(s);
  if (m) {
    var jam = Number(m[1]), menit = Number(m[2]);
    if (jam <= 23 && menit <= 59) return pad2(jam) + ':' + pad2(menit);
    return s;
  }
  return s;
}

/* Apakah ini tanggal KALENDER yang benar-benar ada?
   "2026-10-00" LULUS pola teks karena "00" memang dua angka,
   tapi hari ke-0 tidak pernah ada di kalender. */
function isoTanggalSah(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return false;
  var y = Number(m[1]), bln = Number(m[2]), hr = Number(m[3]);
  if (bln < 1 || bln > 12 || hr < 1 || hr > 31) return false;
  var d = new Date(Date.UTC(y, bln - 1, hr));
  return d.getUTCFullYear() === y && d.getUTCMonth() === bln - 1 && d.getUTCDate() === hr;
}

/* Pulihkan tanggal dari kolom WAKTU, dipakai kalau kolom Tanggal
   tidak bisa dipercaya. */
function tglDariWaktu(v) {
  if (v === null || v === undefined || v === '') return '';
  var d;
  if (v instanceof Date && !isNaN(v.getTime())) {
    d = v;
  } else {
    var s = String(v).trim();
    d = new Date(s);
    /* Tanggal polos tanpa penanda zona ditafsirkan new Date()
       sebagai UTC, padahal nilainya ditulis dalam waktu lokal. */
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !/(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
      d = new Date(s + 'Z');
    }
  }
  if (isNaN(d.getTime())) return '';
  var out = fmtZona(d, 'yyyy-MM-dd');
  return isoTanggalSah(out) ? out : '';
}

/* Satu pintu masuk untuk menormalkan kolom Tanggal. */
function tanggalValid(vTanggal, vWaktuISO, vWaktuTampil) {
  var t = fmtTanggalISO(vTanggal);
  if (isoTanggalSah(t)) return { ok: true, tanggal: t, asal: 'kolom' };
  var dariWaktu = tglDariWaktu(vWaktuISO);
  if (!dariWaktu) dariWaktu = tglDariWaktu(vWaktuTampil);
  if (dariWaktu) return { ok: true, tanggal: dariWaktu, asal: 'waktu' };
  return { ok: false, tanggal: t, asal: '' };
}

function parseJSON(teks, bawaan) {
  try {
    var v = JSON.parse(String(teks || ''));
    return (v === null || v === undefined) ? bawaan : v;
  } catch (e) { return bawaan; }
}
function arr(nilai) { return Array.isArray(nilai) ? nilai : []; }
function objek(nilai) {
  return (nilai && typeof nilai === 'object' && !Array.isArray(nilai)) ? nilai : {};
}
function teks(v) { return String(v == null ? '' : v).trim(); }

/* ============================================================
   CONFIG
   ============================================================ */
var BAWAAN_CONFIG = {
  appName: 'Jurnal 7 Anak Indonesia Hebat',
  teachers: [GURU_AWAL],
  classes: [],
  habitOverrides: { bangun: { targetTime: '05:30' }, tidur: { targetTime: '21:00' } },
  notes: []
};

async function bacaConfig(db) {
  var res = await db.prepare('SELECT key, value FROM config').all();
  var peta = {};
  var rows = (res && res.results) || [];
  for (var i = 0; i < rows.length; i++) peta[String(rows[i].key)] = rows[i].value;

  /* Run pertama: key 'teachers' belum pernah dibuat, jadi dibuatkan
     satu akun guru bawaan supaya guru bisa langsung masuk. Begitu
     key ini tersimpan - walau nilainya array kosong karena semua
     akun memang sengaja dihapus - akun bawaan tidak muncul lagi. */
  if (!Object.prototype.hasOwnProperty.call(peta, 'teachers')) {
    var akun = [GURU_AWAL];
    await db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)')
      .bind('teachers', JSON.stringify(akun)).run();
    return {
      appName: String(peta.app_name || BAWAAN_CONFIG.appName),
      teachers: akun,
      classes: arr(parseJSON(peta.classes, [])),
      habitOverrides: objek(parseJSON(peta.habit_overrides, BAWAAN_CONFIG.habitOverrides)),
      notes: arr(parseJSON(peta.notes, []))
    };
  }

  return {
    appName: String(peta.app_name || BAWAAN_CONFIG.appName),
    teachers: arr(parseJSON(peta.teachers, [])),
    classes: arr(parseJSON(peta.classes, [])),
    habitOverrides: objek(parseJSON(peta.habit_overrides, BAWAAN_CONFIG.habitOverrides)),
    notes: arr(parseJSON(peta.notes, []))
  };
}

async function getConfig(db) {
  return { ok: true, config: await bacaConfig(db) };
}

/* Hapus data siswa & jurnal milik kelas yang sudah tidak ada di CONFIG */
async function bersihkanKelasHilang(db, kelasHidup) {
  var s = await db.prepare('SELECT DISTINCT kelas_id FROM siswa').all();
  var ids = ((s && s.results) || []).map(function (r) { return String(r.kelas_id); });
  for (var i = 0; i < ids.length; i++) {
    if (!kelasHidup[ids[i]]) {
      await db.prepare('DELETE FROM siswa WHERE kelas_id = ?').bind(ids[i]).run();
    }
  }
  var j = await db.prepare('SELECT DISTINCT kelas_id FROM jurnal').all();
  var idsJ = ((j && j.results) || []).map(function (r) { return String(r.kelas_id); });
  for (var k = 0; k < idsJ.length; k++) {
    if (!kelasHidup[idsJ[k]]) {
      await db.prepare('DELETE FROM jurnal WHERE kelas_id = ?').bind(idsJ[k]).run();
    }
  }
}

async function saveConfig(db, body) {
  var lama = await bacaConfig(db);

  var appName = String(body.appName || 'Jurnal 7 Anak Indonesia Hebat');
  var teachers = arr(body.teachers);
  var classes = arr(body.classes);
  var overrides = objek(body.habitOverrides);
  var notes = arr(body.notes);

  /* Catatan lama tetap dipertahankan bila frontend tidak
     mengirim daftar notes (mis. saat menambah kelas saja). */
  if (!body.notes) notes = lama.notes || [];
  if (!body.habitOverrides) overrides = lama.habitOverrides || overrides;

  var baris = [
    ['app_name', appName],
    ['teachers', JSON.stringify(teachers)],
    ['classes', JSON.stringify(classes)],
    ['habit_overrides', JSON.stringify(overrides)],
    ['notes', JSON.stringify(notes)],
    ['updated_at', new Date().toISOString()]
  ];

  /* Semua ditulis sekaligus lewat db.batch, supaya tidak ada
     keadaan setengah jadi kalau salah satu gagal. Isinya masih
     kecil (beberapa ratus byte per key). */
  var stmts = baris.map(function (b) {
    return db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').bind(b[0], b[1]);
  });
  await db.batch(stmts);

  /* Buang data siswa & jurnal milik kelas yang sudah dihapus */
  var kelasHidup = {};
  classes.forEach(function (c) { if (c && c.id) kelasHidup[String(c.id)] = true; });
  await bersihkanKelasHilang(db, kelasHidup);

  return {
    ok: true,
    msg: 'Konfigurasi tersimpan (' + classes.length + ' kelas, ' +
      teachers.length + ' guru, ' + notes.length + ' catatan)'
  };
}

/* ============================================================
   SISWA
   ============================================================ */
function barisSiswa(r) {
  var kelasId = teks(r.kelas_id);
  var nis = teks(r.nis);
  var nama = teks(r.nama);
  if (!kelasId || !nis || !nama) return null;
  return {
    kelasId: kelasId,
    nis: nis,
    nama: nama,
    pin: teks(r.pin),
    kodeOrtu: teks(r.kode_ortu),
    panggilan: teks(r.panggilan)
  };
}

async function getStudents(db) {
  var res = await db.prepare(
    'SELECT kelas_id, nis, nama, pin, kode_ortu, panggilan FROM siswa'
  ).all();
  var siswa = [];
  var rows = (res && res.results) || [];
  for (var i = 0; i < rows.length; i++) {
    var s = barisSiswa(rows[i]);
    if (s) siswa.push(s);
  }
  siswa.sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
  return { ok: true, students: siswa };
}

async function saveStudents(db, body) {
  var kelasId = teks(body.kelasId);
  if (!kelasId) return { ok: false, msg: 'kelasId kosong' };
  var masuk = arr(body.students);

  /* Ganti seluruh isi kelas ini sekaligus lewat db.batch: hapus yang
     lama, lalu tulis yang baru. Ada indeks (kelas_id, nis) jadi ini
     murah. */
  var stmts = [db.prepare('DELETE FROM siswa WHERE kelas_id = ?').bind(kelasId)];

  /* Buang no. absen ganda DALAM kelas ini saja. Dua kelas boleh
     sama-sama punya nomor 1 - itu tidak salah. */
  var sudah = {};
  var bersih = [];
  masuk.forEach(function (s) {
    var nis = teks(s.nis);
    var nama = teks(s.nama);
    if (!nis || !nama) return;
    if (sudah[nis]) return;
    sudah[nis] = true;
    bersih.push({
      kelas_id: kelasId, nis: nis, nama: nama,
      pin: teks(s.pin), kode_ortu: teks(s.kodeOrtu), panggilan: teks(s.panggilan)
    });
  });
  bersih.forEach(function (s) {
    stmts.push(db.prepare(
      'INSERT OR REPLACE INTO siswa (kelas_id, nis, nama, pin, kode_ortu, panggilan) ' +
      'VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(s.kelas_id, s.nis, s.nama, s.pin, s.kode_ortu, s.panggilan));
  });

  await db.batch(stmts);
  return { ok: true, msg: 'Siswa tersimpan: ' + bersih.length + ' orang' };
}

/* ============================================================
   JURNAL
   ============================================================ */
async function getEntries(db) {
  var res = await db.prepare(
    'SELECT kelas_id, nis, nama, tanggal, kode, nilai, catatan, ts_iso, ts_display, ada_foto ' +
    'FROM jurnal ORDER BY tanggal DESC'
  ).all();
  var isi = [];
  var rows = (res && res.results) || [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var kelasId = teks(r.kelas_id);
    var nis = teks(r.nis);
    var tanggal = fmtTanggalISO(r.tanggal);
    var kode = teks(r.kode);
    if (!kelasId || !nis || !tanggal || !kode) continue;
    isi.push({
      id: kelasId + '__' + nis + '__' + tanggal + '__' + kode,
      kelasId: kelasId,
      nis: nis,
      nama: teks(r.nama),
      tanggal: tanggal,
      kode: kode,
      nilai: fmtJamHM(r.nilai),
      catatan: teks(r.catatan),
      tsISO: teks(r.ts_iso),
      tsDisplay: fmtJamHM(r.ts_display),
      adaFoto: Number(r.ada_foto) === 1
    });
  }
  return { ok: true, entries: isi };
}

/* Satu anak + satu tanggal + satu kebiasaan hanya boleh punya satu
   baris (upsert). PRIMARY KEY yang menjamin itu, jadi mengisi ulang
   hari yang sama MENGGANTI isian lama - tidak pernah menambah
   duplikat. Inilah yang membuat 97,3% duplikat tidak bisa terjadi
   lagi tanpa perlu tindakan apa pun. */
async function saveEntries(db, body) {
  var items = arr(body.items);
  if (!items.length) return { ok: false, msg: 'Tidak ada isian untuk disimpan' };

  var stmts = [];
  var ditambah = 0;
  var diubah = 0;

  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var kelasId = teks(it.kelasId);
    var nis = teks(it.nis);
    var nama = teks(it.nama);
    var tanggal = fmtTanggalISO(it.tanggal);
    var kode = teks(it.kode);
    var nilai = teks(it.nilai);
    var catatan = teks(it.catatan);
    if (!kelasId || !nis || !tanggal || !kode) continue;

    var adaFoto = (it.adaFoto === true || String(it.adaFoto).toLowerCase() === 'true') ? 1 : 0;
    var tsISO = String(it.tsISO || new Date().toISOString());
    var tsDisplay = String(it.tsDisplay || fmtZona(new Date(), 'dd/MM/yyyy HH:mm'));

    /* Hanya untuk pesan "n ditambahkan, m diubah". Jumlahnya tidak
       berpengaruh ke isi, karena hasil akhirnya sama saja. */
    var cek = await db.prepare(
      'SELECT 1 AS ada FROM jurnal WHERE kelas_id = ? AND nis = ? AND tanggal = ? AND kode = ?'
    ).bind(kelasId, nis, tanggal, kode).first();
    if (cek && cek.ada) diubah++; else ditambah++;

    stmts.push(db.prepare(
      'INSERT OR REPLACE INTO jurnal ' +
      '(kelas_id, nis, nama, tanggal, kode, nilai, catatan, ts_iso, ts_display, ada_foto) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(kelasId, nis, nama, tanggal, kode, nilai, catatan, tsISO, tsDisplay, adaFoto));
  }

  if (!stmts.length) return { ok: false, msg: 'Tidak ada isian untuk disimpan' };
  await db.batch(stmts);

  return {
    ok: true,
    msg: 'Jurnal tersimpan: ' + (ditambah + diubah) + ' isian',
    ditambah: ditambah,
    diubah: diubah
  };
}

async function deleteEntry(db, body) {
  var kelasId = teks(body.kelasId);
  var nis = teks(body.nis);
  var tanggal = fmtTanggalISO(body.tanggal);
  var kode = teks(body.kode);
  if (!kelasId || !nis || !tanggal || !kode) {
    return { ok: false, msg: 'Isian tidak ditemukan' };
  }
  await db.prepare(
    'DELETE FROM jurnal WHERE kelas_id = ? AND nis = ? AND tanggal = ? AND kode = ?'
  ).bind(kelasId, nis, tanggal, kode).run();
  return { ok: true, msg: 'Isian dihapus' };
}

/* Kosongkan seluruh jurnal satu kelas (data siswa tetap aman) */
async function clearEntries(db, body) {
  var kelasId = teks(body.kelasId);
  if (!kelasId) return { ok: false, msg: 'kelasId kosong' };
  var r = await db.prepare('DELETE FROM jurnal WHERE kelas_id = ?').bind(kelasId).run();
  var n = (r && r.meta && r.meta.changes) || 0;
  return { ok: true, msg: n + ' isian dihapus' };
}

/* Catatan guru disimpan di tabel config, sama seperti di Code.gs */
async function saveNote(db, body) {
  var cfg = await bacaConfig(db);
  var n = body.note || {};
  var nis = teks(n.nis);
  var isi = teks(n.isi);
  if (!nis || !isi) return { ok: false, msg: 'Data catatan tidak lengkap' };

  cfg.notes = cfg.notes || [];
  cfg.notes.push({
    nis: nis,
    jenis: String(n.jenis || 'catatan'),
    isi: isi,
    tanggal: String(n.tanggal || fmtZona(new Date(), 'yyyy-MM-dd')),
    guru: String(n.guru || 'Guru'),
    dibuat: new Date().toISOString()
  });

  return saveConfig(db, {
    appName: cfg.appName,
    teachers: cfg.teachers,
    classes: cfg.classes,
    habitOverrides: cfg.habitOverrides,
    notes: cfg.notes
  });
}

/* ============================================================
   BACA SEMUA (1 permintaan untuk semuanya)
   ============================================================ */
async function getAll(db) {
  var cfg = await getConfig(db);
  var sis = await getStudents(db);
  var ent = await getEntries(db);

  /* Deteksi tanggal rusak. Gejalanya rekap selalu 0%: mesin rekap
     membandingkan e.tanggal dengan tanggal kalender. Kalau tanggalnya
     tidak pernah ada di kalender, chart, persen, streak, dan poin
     semuanya nol - dan kelihatan seperti "aplikasinya tidak jalan". */
  var rusak = 0;
  var contoh = '';
  for (var i = 0; i < ent.entries.length; i++) {
    var t = String(ent.entries[i].tanggal || '');
    if (!isoTanggalSah(t)) {
      rusak++;
      if (!contoh) contoh = t;
    }
  }

  return {
    ok: cfg.ok && sis.ok && ent.ok,
    config: cfg.config,
    students: sis.students,
    entries: ent.entries,
    jumlahSiswa: sis.students.length,
    jumlahEntri: ent.entries.length,
    tanggalRusak: rusak,
    contohTanggalRusak: contoh,
    /* Cache tidak diperlukan lagi: D1 membaca 70 baris dalam
       hitungan milidetik, bukan 2.573 baris seperti sheet dulu.
       Field ini dipertahankan supaya frontend tidak berubah. */
    cacheBerfungsi: true,
    jumlahPotonganCache: 0,
    cachePesanError: ''
  };
}

/* ============================================================
   ENTRY POINT
   ============================================================ */

/* Bungkus hasil sebagai JSON atau JSONP (kalau ada prefix) */
function json(obj, prefix) {
  var out = JSON.stringify(obj);
  if (prefix) out = prefix + '(' + out + ');';
  return new Response(out, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    }
  });
}

function jsonPOST(obj) {
  return new Response(JSON.stringify(obj), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    }
  });
}

/* Halaman informasi, sama seperti Apps Script menampilkan HTML
   bila dibuka tanpa parameter. */
function halamanInfo() {
  var w = 'max-width:620px;padding:28px;font-family:Segoe UI,sans-serif';
  return new Response(
    '<div style="' + w + '">' +
    '<h2 style="color:#5E0F1D;margin:0 0 10px">JEJAK 7 KAIH aktif</h2>' +
    '<p style="color:#4B2A34;line-height:1.7">Backend ini memakai database D1, ' +
    'bukan spreadsheet. Alamatnya sudah terpasang di aplikasi.</p>' +
    '<p style="color:#8A6C76;font-size:13px;line-height:1.8">' +
    'Aksi baca: <code>?action=get_all</code>, <code>?action=get_config</code>, ' +
    '<code>?action=get_students</code>, <code>?action=get_entries</code>.</p>' +
    '<p style="color:#12805C;font-size:13px">Tabel config, siswa, dan jurnal ' +
    'dibuat otomatis saat migrasi pertama.</p>' +
    '</div>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export default {
  async fetch(request, env) {
    var url = new URL(request.url);

    /* Frontend menulis dengan mode no-cors dan Content-Type
       text/plain, jadi ini "simple request" tanpa preflight.
       Header di sini tetap dipasang supaya aman kalau suatu saat
       frontend diubah ke fetch biasa. */
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    try {
      /* ---- Tulis data (POST) ---- */
      if (request.method === 'POST') {
        var body = JSON.parse(await request.text());
        var aksi = String(body.action || '');
        switch (aksi) {
          case 'save_config':   return jsonPOST(await saveConfig(env.DB, body));
          case 'save_students': return jsonPOST(await saveStudents(env.DB, body));
          case 'save_entries':  return jsonPOST(await saveEntries(env.DB, body));
          case 'delete_entry':  return jsonPOST(await deleteEntry(env.DB, body));
          case 'clear_entries': return jsonPOST(await clearEntries(env.DB, body));
          case 'save_note':     return jsonPOST(await saveNote(env.DB, body));
          default:
            return jsonPOST({ ok: false, msg: 'Aksi tidak dikenal: ' + aksi });
        }
      }

      /* ---- Baca data (GET / JSONP) ---- */
      var p = {};
      url.searchParams.forEach(function (v, k) { p[k] = v; });
      var action = String(p.action || '');
      var prefix = String(p.prefix || '');

      if (action === 'get_all')      return json(await getAll(env.DB), prefix);
      if (action === 'get_config')   return json(await getConfig(env.DB), prefix);
      if (action === 'get_students') return json(await getStudents(env.DB), prefix);
      if (action === 'get_entries')  return json(await getEntries(env.DB), prefix);

      /* Tanpa parameter: tampilkan halaman informasi */
      return halamanInfo();
    } catch (err) {
      /* Penting: error dikembalikan sebagai JSON yang punya ok:false,
         BUKAN sebagai 500 kosong. Frontend membaca `r.msg` untuk
         menampilkan pesan ke guru; kalau responnya bukan JSON,
         murid melihat "Waktu tunggu habis" dan datanya tertahan. */
      var pesan = (err && err.message) ? err.message : String(err);
      if (request.method === 'POST') return jsonPOST({ ok: false, msg: 'Error: ' + pesan });
      return json({ ok: false, msg: 'Error: ' + pesan }, prefix);
    }
  }
};