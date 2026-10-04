/* ============================================================
   JURNAL 7 ANAK INDONESIA HEBAT - Backend Google Apps Script
   ------------------------------------------------------------
   CARA PAKAI:
   1. Buka https://sheets.new -> buat spreadsheet baru
   2. Menu "Ekstensi" -> "Apps Script"
   3. Hapus semua isi Code.gs, tempel SELURUH isi file ini
   4. Klik Save (ikon simpan)
   5. Klik "Deploy" -> "New deployment" -> pilih ikon roda gigi
      (Test deployments) -> tipe "Web app"
      - Execute as       : Me
      - Who has access   : Anyone
   6. Klik Deploy, lalu izinkan akses di layar persetujuan Google
      (bila muncul "advanced" -> klik "Go to ... (unsafe)" -> Allow)
   7. Salin URL yang berakhiran /exec
   8. Tempel URL itu ke assets/js/site-config.js pada baris scriptUrl

   Sheet CONFIG, SISWA, dan JURNAL otomatis dibuat saat pertama
   kali dibutuhkan - tidak perlu dibuat manual.

   ------------------------------------------------------------
   CATATAN ARSITEKTUR
   - Semua operasi TULIS dikunci LockService supaya 30+ murid
     yang mengisi jurnal bersamaan tidak menabrak spreadsheet.
   - Pembacaan memakai CacheService supaya 30+ perangkat yang
     sinkron bersamaan hanya membaca spreadsheet satu kali.
   - Frontend memakai JSONP untuk baca dan POST no-cors untuk
     tulis, lalu memverifikasi hasilnya kembali ke server.
   ============================================================ */

/* ---------------- Nama sheet & pengaturan ---------------- */
var SHEET_CONFIG = 'CONFIG';
var SHEET_SISWA  = 'SISWA';
var SHEET_JURNAL = 'JURNAL';

var LOCK_TIMEOUT_MS = 15000;   /* berapa lama request menunggu giliran */
var CACHE_DETIK     = 30;      /* masa cache data master              */
var LOGS_CACHE_KEY  = 'j7_logs_v1';

/* Kolom sheet SISWA. "Nama Panggilan" ada di paling kanan supaya
   sheet lama (5 kolom) tetap kompatibel tanpa migrasi data. */
var HEADER_SISWA = [
  'Kelas ID', 'No. Absen', 'Nama Lengkap', 'Sandi (hash)',
  'Kode Orang Tua', 'Nama Panggilan'
];

/* Akun guru bawaan, dibuat OTOMATIS pada run pertama saja sehingga
   guru tidak terkunci dari websitenya sendiri. Password masih
   SHA-256 dari teks aslinya ("guru123").
   PENTING: setelah masuk, segera ganti password ini di
   Panel Guru > Pengaturan > Akun Guru. */
var GURU_AWAL = {
  user: 'guru',
  nama: 'Guru',
  pass: 'ae81343369944399b70de862dbe75536faa8e44c50ad0a312e380303173f4756'
};

/* ============================================================
   ENTRY POINT
   ============================================================ */

/* ---- Tulis data (POST) ---- */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = String(body.action || '');

    if (action === 'save_config')   return json_(withLock_(function () { return saveConfig_(body); }));
    if (action === 'save_students') return json_(withLock_(function () { return saveStudents_(body); }));
    if (action === 'save_entries')  return json_(withLock_(function () { return saveEntries_(body); }));
    if (action === 'delete_entry')  return json_(withLock_(function () { return deleteEntry_(body); }));
    if (action === 'clear_entries') return json_(withLock_(function () { return clearEntries_(body); }));
    if (action === 'save_note')     return json_(withLock_(function () { return saveNote_(body); }));

    return json_({ ok: false, msg: 'Aksi tidak dikenal: ' + action });
  } catch (err) {
    return json_({ ok: false, msg: 'Error: ' + err.message });
  }
}

/* ---- Baca data (GET / JSONP) ---- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = String(p.action || '');
  var prefix = String(p.prefix || '');

  if (action === 'get_all')     return json_(getAll_(), prefix);
  if (action === 'get_config')  return json_(getConfig_(), prefix);
  if (action === 'get_students')return json_(getStudents_(), prefix);
  if (action === 'get_entries') return json_(getEntries_(), prefix);

  /* Tanpa parameter: tampilkan halaman informasi Ringkas */
  return HtmlService.createHtmlOutput(
    '<div style="font-family:Segoe UI,sans-serif;padding:28px;max-width:620px">' +
    '<h2 style="color:#5E0F1D;margin:0 0 10px">Backend Jurnal 7 Kebiasaan aktif</h2>' +
    '<p style="color:#4B2A34;line-height:1.7">Alamat ini siap dipakai. Tempel URL yang berakhiran ' +
    '<b>/exec</b> ini ke file <b>assets/js/site-config.js</b> pada baris <b>scriptUrl</b>.</p>' +
    '<p style="color:#8A6C76;font-size:13px;line-height:1.8">' +
    'Aksi baca: <code>?action=get_all</code>, <code>?action=get_config</code>, ' +
    '<code>?action=get_students</code>, <code>?action=get_entries</code>.</p>' +
    '<p style="color:#12805C;font-size:13px">Sheet ' + SHEET_CONFIG + ', ' + SHEET_SISWA +
    ', dan ' + SHEET_JURNAL + ' dibuat otomatis saat data pertama masuk.</p>' +
    '</div>'
  );
}

/* Bungkus hasil sebagai JSON atau JSONP (kalau ada prefix) */
function json_(obj, prefix) {
  var out = JSON.stringify(obj);
  if (prefix) out = prefix + '(' + out + ');';
  return ContentService.createTextOutput(out)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/* ============================================================
   KUNCI ANTRIAN TULIS
   ============================================================ */
/* Semua operasi tulis melewati kunci ini. Tanpa kunci, 30 murid
   yang mengisi jurnal pada detik yang sama bisa saling menimpa
   baris spreadsheet (sumber error "Service invoked too many
   times"). Dengan kunci, setiap penulisan berurutan dan aman.

   Bila gagal dapat giliran dalam 15 detik, frontend yang
   gagal akan menyimpan datanya di perangkat dan mengirim ulang
   otomatis - tidak ada isian yang hilang. */
function withLock_(fn, timeoutMs) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(timeoutMs || LOCK_TIMEOUT_MS)) {
    return { ok: false, msg: 'Server sibuk - data disimpan di perangkat dan dikirim ulang otomatis.' };
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   CACHE
   ============================================================ */
function cacheGet_(key) {
  try { return CacheService.getScriptCache().get(key); } catch (e) { return null; }
}
function cachePut_(key, val, detik) {
  try { CacheService.getScriptCache().put(key, val, detik || CACHE_DETIK); } catch (e) {}
}
function cacheBuang_(key) {
  try { CacheService.getScriptCache().remove(key); } catch (e) {}
}
function buangSemuaCache_() {
  cacheBuang_(LOGS_CACHE_KEY);
  cacheBuang_('cfg');
  cacheBuang_('siswa');
}

/* ============================================================
   HELPER SHEET
   ============================================================ */
function getSS() { return SpreadsheetApp.getActiveSpreadsheet(); }

function pastikanSheet(nama, header) {
  var ss = getSS();
  var sh = ss.getSheetByName(nama);
  if (sh) return sh;
  sh = ss.insertSheet(nama);
  if (header && header.length) {
    sh.getRange(1, 1, 1, header.length).setValues([header])
      .setFontWeight('bold')
      .setBackground('#F0E8EA')
      .setFontColor('#480B19');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ============================================================
   NORMALISASI TANGGAL & JAM  (PALING PENTING)
   ------------------------------------------------------------
   Google Sheets diam-diam mengubah teks "2026-10-02" menjadi
   TANGGAL sungguhan, dan "05:30" menjadi JAM. Setelah itu
   getValues() mengembalikan objek Date, dan String(date)
   menjadi panjang seperti:
     "Fri Oct 02 2026 00:00:00 GMT+0800 (Waktu Standar Singapura)"

   Padahal seluruh frontend membandingkan tanggal dengan format
   "YYYY-MM-DD". Akibatnya TIDAK ADA yang cocok => rekap, persen,
   rata-rata, lencana, dan rekap harian guru semuanya NOL.

   Dua perbaikan di sini:
     1) jadikanTeks_()  -> kolom JURNAL dijadikan Plain Text
        supaya data baru tidak dikonversi lagi.
     2) fmtTanggalISO_() & fmtJamHM_() -> data lama yang sudah
        terlanjur jadi Date, dinormalkan saat dibaca. Jadi data
        lama langsung terbaca tanpa perlu diedit manual.
   ============================================================ */
/* WAJIB: n harus jadi Number dulu sebelum ditempel. Kalau tidak,
   pad2_('03') menghasilkan '003' sehingga tanggal jadi '2026-10-003'. */
function pad2_(n) { n = Number(n); return (n < 10 ? '0' : '') + n; }

function fmtTanggalISO_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  /* hari 1-3 digit supaya sisa format rusak lama ("2026-10-003")
     tetap dinormalkan jadi 2026-10-03 */
  var m = /^(\d{4})-(\d{1,2})-(\d{1,3})/.exec(s);
  if (m) return m[1] + '-' + pad2_(m[2]) + '-' + pad2_(m[3]);
  /* dd/MM/yyyy (format bawaan Sheets saat locale Singapura) */
  var p = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
  if (p) return p[3] + '-' + pad2_(p[2]) + '-' + pad2_(p[1]);
  return s;
}

function fmtJamHM_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
  }
  var s = String(v).trim();
  var m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (m) return pad2_(m[1]) + ':' + m[2];
  return s;
}

/* Jadikan semua kolom JURNAL berformat Plain Text. Cukup dicek
   satu sel supaya tidak memberat setiap kali menyimpan. */
function jadikanTeks_(sh) {
  try {
    if (sh.getRange(2, 4).getNumberFormat() === '@') return false;
    var baris = Math.max(sh.getMaxRows(), 2);
    sh.getRange(2, 1, baris - 1, HEADER_JURNAL.length).setNumberFormat('@');
    return true;
  } catch (e) { return false; }
}

function parseJSON_(teks, bawaan) {
  try {
    var v = JSON.parse(String(teks || ''));
    return (v === null || v === undefined) ? bawaan : v;
  } catch (e) { return bawaan; }
}

function boolArray_(nilai) { return Array.isArray(nilai) ? nilai : []; }
function objArray_(nilai) { return (nilai && typeof nilai === 'object' && !Array.isArray(nilai)) ? nilai : {}; }

/* ============================================================
   BACA SEMUA (1 request untuk semuanya)
   ============================================================ */
/* Config + daftar siswa + seluruh jurnal dalam SATU panggilan.
  Modul ini penting: saat 30 perangkat sinkron bersamaan,
   spreadsheet hanya dibaca satu kali, bukan 30 kali. */
function getAll_() {
  var cfg = getConfig_();
  var sis = getStudents_();
  var ent = getEntries_();

  /* Deteksi tanggal rusak.
     Gejalanya rekap selalu 0%: mesin rekap membandingkan e.tanggal
     dengan tanggal kalender (mis. "2026-10-04"). Kalau sheet masih
     menyimpan "2026-10-003", tidak akan pernah cocok sama sekali.
     Efeknya: chart, persen, streak, dan poin semuanya nol - dan
     kelihatan seperti "aplikasinya tidak jalan".
     Dikirim ke frontend supaya guru diberi tahu, bukan diam saja. */
  var rusak = 0;
  var contoh = '';
  for (var i = 0; i < ent.entries.length; i++) {
    var t = String(ent.entries[i].tanggal || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
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
    contohTanggalRusak: contoh
  };
}

/* ============================================================
   CONFIG  (sheet: CONFIG | Key | Value)
   ============================================================ */
function bacaConfig_() {
  var bawaan = {
    appName: 'Jurnal 7 Anak Indonesia Hebat',
    teachers: [GURU_AWAL],
    classes: [],
    habitOverrides: { bangun: { targetTime: '05:30' }, tidur: { targetTime: '21:00' } },
    notes: []
  };
  var sh;
  try { sh = pastikanSheet(SHEET_CONFIG, ['Key', 'Value']); } catch (e) { sh = null; }
  if (!sh || sh.getLastRow() < 1) return bawaan;

  var data = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
  var peta = {};
  data.forEach(function (r) { peta[String(r[0]).trim()] = r[1]; });

  /* Run pertama: sheet CONFIG belum punya key 'teachers', jadi dibuatkan
     satu akun guru bawaan supaya guru bisa langsung masuk.
     Begitu key ini tersimpan - walau nilainya array kosong karena semua
     akun memang sengaja dihapus - akun bawaan tidak akan muncul lagi. */
  if (!Object.prototype.hasOwnProperty.call(peta, 'teachers')) {
    var akun = [GURU_AWAL];
    try {
      sh.getRange(sh.getLastRow() + 1, 1, 1, 2).setValues([['teachers', JSON.stringify(akun)]]);
    } catch (e) { return bawaan; }
    return {
      appName: String(peta.app_name || bawaan.appName),
      teachers: akun,
      classes: boolArray_(parseJSON_(peta.classes, [])),
      habitOverrides: objArray_(parseJSON_(peta.habit_overrides, bawaan.habitOverrides)),
      notes: boolArray_(parseJSON_(peta.notes, []))
    };
  }

  return {
    appName: String(peta.app_name || bawaan.appName),
    teachers: boolArray_(parseJSON_(peta.teachers, [])),
    classes: boolArray_(parseJSON_(peta.classes, [])),
    habitOverrides: objArray_(parseJSON_(peta.habit_overrides, bawaan.habitOverrides)),
    notes: boolArray_(parseJSON_(peta.notes, []))
  };
}

function getConfig_() {
  var cached = cacheGet_('cfg');
  if (cached) {
    try { return { ok: true, config: JSON.parse(cached), cached: true }; } catch (e) {}
  }
  var cfg = bacaConfig_();
  cachePut_('cfg', JSON.stringify(cfg));
  return { ok: true, config: cfg };
}

function saveConfig_(body) {
  var sh = pastikanSheet(SHEET_CONFIG, ['Key', 'Value']);
  sh.clear();
  sh.getRange(1, 1, 1, 2).setValues([['Key', 'Value']])
    .setFontWeight('bold')
    .setBackground('#F0E8EA')
    .setFontColor('#480B19');
  sh.setFrozenRows(1);

  var appName = String(body.appName || 'Jurnal 7 Anak Indonesia Hebat');
  var teachers = boolArray_(body.teachers);
  var classes = boolArray_(body.classes);
  var overrides = objArray_(body.habitOverrides);
  var notes = boolArray_(body.notes);

  /* Catatan lama tetap dipertahankan bila frontend tidak
     mengirim daftar notes (mis. saat menambah kelas saja). */
  if (!body.notes) {
    var lama = bacaConfig_();
    notes = lama.notes || [];
  }
  if (!body.habitOverrides) {
    var lama2 = bacaConfig_();
    overrides = lama2.habitOverrides || overrides;
  }

  var baris = [
    ['app_name', appName],
    ['teachers', JSON.stringify(teachers)],
    ['classes', JSON.stringify(classes)],
    ['habit_overrides', JSON.stringify(overrides)],
    ['notes', JSON.stringify(notes)],
    ['updated_at', new Date().toISOString()]
  ];
  sh.getRange(2, 1, baris.length, 2).setValues(baris);
  sh.setColumnWidth(1, 150);
  sh.setColumnWidth(2, 500);
  sh.setTabColor('#8B1826');

  /* Buang data siswa & jurnal milik kelas yang sudah dihapus */
  var kelasHidup = {};
  classes.forEach(function (c) { if (c && c.id) kelasHidup[String(c.id)] = true; });
  bersihkanKelasHilang_(kelasHidup);

  buangSemuaCache_();
  return {
    ok: true,
    msg: 'Konfigurasi tersimpan (' + classes.length + ' kelas, ' + teachers.length + ' guru, ' + notes.length + ' catatan)'
  };
}

/* Hapus baris milik kelas yang tidak lagi ada di CONFIG */
function bersihkanKelasHilang_(kelasHidup) {
  var ss = getSS();
  var s = ss.getSheetByName(SHEET_SISWA);
  if (s && s.getLastRow() > 1) {
    var dS = s.getRange(2, 1, s.getLastRow() - 1, 1).getValues();
    for (var i = dS.length - 1; i >= 0; i--) {
      if (!kelasHidup[String(dS[i][0]).trim()]) s.deleteRow(i + 2);
    }
  }
  var j = ss.getSheetByName(SHEET_JURNAL);
  if (j && j.getLastRow() > 1) {
    var dJ = j.getRange(2, 1, j.getLastRow() - 1, 1).getValues();
    for (var k = dJ.length - 1; k >= 0; k--) {
      if (!kelasHidup[String(dJ[k][0]).trim()]) j.deleteRow(k + 2);
    }
  }
}

/* Perbarui baris header sheet SISWA kalau kolomnya belum lengkap.
   Data di bawahnya tidak disentuh sama sekali. */
function rapikanHeaderSiswa_(sh) {
  var sekarang = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var perlu = false;
  for (var i = 0; i < HEADER_SISWA.length; i++) {
    if (String(sekarang[i] || '').trim() !== HEADER_SISWA[i]) { perlu = true; break; }
  }
  if (!perlu) return;
  sh.getRange(1, 1, 1, HEADER_SISWA.length).setValues([HEADER_SISWA]);
  if (sh.getFrozenRows() < 1) sh.setFrozenRows(1);
}

/* ============================================================
   SISWA  (sheet: SISWA | Kelas ID | No. Absen | Nama | Sandi |
           Kode Ortu | Nama Panggilan)
   Catatan: kolom "Nama Panggilan" sengaja ditambahkan di paling
   kanan agar data lama (5 kolom) tetap bisa dibaca apa adanya.
   ============================================================ */
function getStudents_() {
  var cached = cacheGet_('siswa');
  if (cached) {
    try { return { ok: true, students: JSON.parse(cached), cached: true }; } catch (e) {}
  }
  var sh = getSS().getSheetByName(SHEET_SISWA);
  var siswa = [];
  if (sh && sh.getLastRow() > 1) {
    var data = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
    data.forEach(function (r) {
      var kelasId = String(r[0]).trim();
      var nis = String(r[1]).trim();
      var nama = String(r[2]).trim();
      if (!kelasId || !nis || !nama) return;
      siswa.push({
        kelasId: kelasId,
        nis: nis,
        nama: nama,
        pin: String(r[3]).trim(),
        kodeOrtu: String(r[4]).trim(),
        panggilan: String(r[5]).trim()
      });
    });
  }
  siswa.sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
  cachePut_('siswa', JSON.stringify(siswa));
  return { ok: true, students: siswa };
}

function saveStudents_(body) {
  var kelasId = String(body.kelasId || '').trim();
  if (!kelasId) return { ok: false, msg: 'kelasId kosong' };
  var masuk = boolArray_(body.students);

  var sh = pastikanSheet(SHEET_SISWA, HEADER_SISWA);
  rapikanHeaderSiswa_(sh);

  /* Hapus semua baris kelas ini dulu, dari bawah ke atas supaya
     tetap aman walaupun baris kelas lain tersebar di sheet. */
  var last = sh.getLastRow();
  var hapus = [];
  if (last > 1) {
    var cek = sh.getRange(2, 1, last - 1, 1).getValues();
    cek.forEach(function (r, i) {
      if (String(r[0]).trim() === kelasId) hapus.push(i + 2);
    });
    for (var i = hapus.length - 1; i >= 0; i--) sh.deleteRow(hapus[i]);
  }

  /* Tulis ulang, buang NIS ganda */
  var bersih = [];
  var sudah = {};
  masuk.forEach(function (s) {
    var nis = String(s.nis || '').trim();
    var nama = String(s.nama || '').trim();
    if (!nis || !nama) return;
    if (sudah[nis]) return;
    sudah[nis] = true;
    bersih.push([
      kelasId, nis, nama,
      String(s.pin || '').trim(),
      String(s.kodeOrtu || '').trim(),
      String(s.panggilan || '').trim()
    ]);
  });
  if (bersih.length) {
    var mulai = sh.getLastRow() + 1;
    sh.getRange(mulai, 1, bersih.length, 6).setValues(bersih);
  }
  sh.setColumnWidth(1, 110);
  sh.setColumnWidth(2, 100);
  sh.setColumnWidth(3, 230);
  sh.setColumnWidth(4, 120);
  sh.setColumnWidth(5, 130);
  sh.setColumnWidth(6, 140);
  sh.setTabColor('#C9A227');

  cacheBuang_('siswa');
  return { ok: true, msg: 'Siswa tersimpan: ' + bersih.length + ' orang' };
}

/* ============================================================
   JURNAL  (sheet: JURNAL)
   Kelas ID | No. Absen | Nama | Tanggal | Kode | Nilai | Catatan | ISO | Tampil | Ada Foto
   Kolom "Ada Foto" hanya berisi YA / kosong. Foto jpeg-nya sendiri
   TIDAK disimpan ke spreadsheet (sel Google Sheets cuma bisa
   50.000 karakter per sel, sedangkan foto base64 jauh lebih besar
   dan akan menggagalkan seluruh pengiriman). Yang perlu disimpan
   cuma nyatanya ada foto atau tidak, untuk menghitung bobot poin.
   ============================================================ */
var HEADER_JURNAL = ['Kelas ID', 'No. Absen', 'Nama', 'Tanggal', 'Kode Kebiasaan', 'Nilai', 'Catatan', 'Waktu ISO', 'Waktu Tampil', 'Ada Foto'];

function getEntries_() {
  /* Cache 3 detik: saat banyak perangkat sync bersamaan dalam
     jendela waktu yang sama, spreadsheet hanya dibaca 1x. */
  var cached = cacheGet_(LOGS_CACHE_KEY);
  if (cached !== null) {
    var arr = [];
    try { arr = JSON.parse(cached); } catch (e) { arr = []; }
    return { ok: true, entries: arr, cached: true };
  }

  var sh = getSS().getSheetByName(SHEET_JURNAL);
  var isi = [];
  var lebar = Math.min(Math.max(sh ? sh.getLastColumn() : 0, HEADER_JURNAL.length), 10);
  if (sh && sh.getLastRow() > 1) {
    var data = sh.getRange(2, 1, sh.getLastRow() - 1, lebar).getValues();
    data.forEach(function (r) {
      var kelasId = String(r[0]).trim();
      var nis = String(r[1]).trim();
      var tanggal = fmtTanggalISO_(r[3]);
      var kode = String(r[4]).trim();
      if (!kelasId || !nis || !tanggal || !kode) return;
      isi.push({
        id: kelasId + '__' + nis + '__' + tanggal + '__' + kode,
        kelasId: kelasId,
        nis: nis,
        nama: String(r[2]).trim(),
        tanggal: tanggal,
        kode: kode,
        nilai: fmtJamHM_(r[5]),
        catatan: String(r[6]).trim(),
        tsISO: String(r[7]).trim(),
        tsDisplay: fmtJamHM_(r[8]),
        adaFoto: String(r[9] == null ? '' : r[9]).trim().toUpperCase() === 'YA'
      });
    });
  }
  isi.sort(function (a, b) { return String(b.tanggal).localeCompare(String(a.tanggal)); });
  /* TTL 60 detik, bukan 3 detik.

     Dulu 3 detik hampir tidak berguna: setiap perangkat auto-sync
     tiap 90 detik, jadi hampir tidak pernah ada yang kena cache.
     Yang terjadi cuma satu sheet dibaca berulang kali.

     Dengan 60 detik, 30 perangkat yang datang bersamaan membaca
     sheet CUMA SEKALI. Beban baca sheet berkurang drastis.

     Aman karena jurnal tidak butuh real-time: murid yang baru
     menyimpan akan melihat datanya sendiri lewat respons simpan,
     bukan lewat pembacaan cache ini. */
  cachePut_(LOGS_CACHE_KEY, JSON.stringify(isi), 60);
  return { ok: true, entries: isi };
}

/* Tulis isian jurnal._one anak + satu tanggal + satu kebiasaan
   hanya boleh punya satu baris (upsert): mengisi ulang hari yang
   sama akan MENGUBAH isian lama, bukan menambah duplikat. */
function saveEntries_(body) {
  var items = boolArray_(body.items);
  if (!items.length) return { ok: false, msg: 'Tidak ada isian untuk disimpan' };

  var sh = pastikanSheet(SHEET_JURNAL, HEADER_JURNAL);
  jadikanTeks_(sh);
  var tambah = [];
  var berubah = 0;

  /* Peta indeks dibaca SEKALI saja. Kalau tidak, setiap isian akan
     membaca seluruh sheet berulang kali. Saat jurnal menumpuk ribuan
     baris, satu kiriman 7 isian jadi jauh lebih lambat.
     PENTING: tanggal dinormalkan dengan fmtTanggalISO_ supaya baris
     lama yang sudah jadi Date SULLIT ketemu (dulu selalu salah,
     sehingga tiap simpan menambah baris duplikat). */
  var last = sh.getLastRow();
  var peta = {};
  if (last > 1) {
    var semua = sh.getRange(2, 1, last - 1, 5).getValues();
    for (var i = 0; i < semua.length; i++) {
      var kunci = String(semua[i][0]).trim() + '||' + String(semua[i][1]).trim() +
        '||' + fmtTanggalISO_(semua[i][3]) + '||' + String(semua[i][4]).trim();
      if (peta[kunci] === undefined) peta[kunci] = i + 2;
    }
  }

  items.forEach(function (it) {
    var kelasId = String(it.kelasId || '').trim();
    var nis = String(it.nis || '').trim();
    var nama = String(it.nama || '').trim();
    var tanggal = fmtTanggalISO_(it.tanggal);
    var kode = String(it.kode || '').trim();
    var nilai = String(it.nilai == null ? '' : it.nilai).trim();
    var catatan = String(it.catatan == null ? '' : it.catatan).trim();

    if (!kelasId || !nis || !tanggal || !kode) return;

    var baris = [
      kelasId, nis, nama, tanggal, kode, nilai, catatan,
      String(it.tsISO || new Date().toISOString()),
      String(it.tsDisplay || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')),
      it.adaFoto === true || String(it.adaFoto).toLowerCase() === 'true' ? 'YA' : ''
    ];

    var kunci = kelasId + '||' + nis + '||' + tanggal + '||' + kode;
    var barisKe = peta[kunci] || 0;
    if (barisKe > 0) peta[kunci] = 0;   /* kunci dipakai, jangan dipakai lagi di paket ini */

    if (barisKe > 0) {
      sh.getRange(barisKe, 1, 1, HEADER_JURNAL.length).setValues([baris]);
      berubah++;
    } else {
      tambah.push(baris);
    }
  });

  if (tambah.length) sh.getRange(sh.getLastRow() + 1, 1, tambah.length, HEADER_JURNAL.length).setValues(tambah);
  sh.setTabColor('#8B1826');

  /* Hasil tulis langsung terlihat, tanpa menunggu masa cache */
  cacheBuang_(LOGS_CACHE_KEY);

  return {
    ok: true,
    msg: 'Jurnal tersimpan: ' + (tambah.length + berubah) + ' isian',
    ditambah: tambah.length,
    diubah: berubah
  };
}

/* Hapus satu isian jurnal */
function deleteEntry_(body) {
  var kelasId = String(body.kelasId || '').trim();
  var nis = String(body.nis || '').trim();
  var tanggal = fmtTanggalISO_(body.tanggal);
  var kode = String(body.kode || '').trim();

  var sh = getSS().getSheetByName(SHEET_JURNAL);
  if (!sh || sh.getLastRow() <= 1) return { ok: false, msg: 'Tidak ada jurnal' };

  var data = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === kelasId &&
        String(data[i][1]).trim() === nis &&
        fmtTanggalISO_(data[i][3]) === tanggal &&
        String(data[i][4]).trim() === kode) {
      sh.deleteRow(i + 2);
      cacheBuang_(LOGS_CACHE_KEY);
      return { ok: true, msg: 'Isian dihapus' };
    }
  }
  return { ok: false, msg: 'Isian tidak ditemukan' };
}

/* Kosongkan seluruh jurnal satu kelas (data siswa tetap aman) */
function clearEntries_(body) {
  var kelasId = String(body.kelasId || '').trim();
  var sh = getSS().getSheetByName(SHEET_JURNAL);
  if (!sh || sh.getLastRow() <= 1) return { ok: true, msg: 'Tidak ada jurnal' };

  var last = sh.getLastRow();
  var data = sh.getRange(2, 1, last - 1, 1).getValues();
  var hapus = [];
  data.forEach(function (r, i) {
    if (String(r[0]).trim() === kelasId) hapus.push(i + 2);
  });
  for (var i = hapus.length - 1; i >= 0; i--) sh.deleteRow(hapus[i]);

  cacheBuang_(LOGS_CACHE_KEY);
  return { ok: true, msg: hapus.length + ' isian dihapus' };
}

/* ============================================================
   CATATAN GURU
   ============================================================ */
/* Disimpan di CONFIG agar tidak perlu sheet tambahan. */
function saveNote_(body) {
  var cfg = bacaConfig_();
  var n = body.note || {};
  var nis = String(n.nis || '').trim();
  var isi = String(n.isi || '').trim();
  if (!nis || !isi) return { ok: false, msg: 'Data catatan tidak lengkap' };

  cfg.notes = cfg.notes || [];
  cfg.notes.push({
    nis: nis,
    jenis: String(n.jenis || 'catatan'),
    isi: isi,
    tanggal: String(n.tanggal || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')),
    guru: String(n.guru || 'Guru'),
    dibuat: new Date().toISOString()
  });

  /* Simpan ulang seluruh CONFIG lewat fungsi yang sama */
  return saveConfig_({
    appName: cfg.appName,
    teachers: cfg.teachers,
    classes: cfg.classes,
    habitOverrides: cfg.habitOverrides,
    notes: cfg.notes
  });
}

/* ============================================================
   MENU SPREADSHEET
   ============================================================ */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Jurnal 7 Kebiasaan')
      .addItem('Cek Isi Database', 'menuCek')
      .addItem('Perbaiki Tanggal & Jam', 'menuFormatTanggal')
      .addToUi();
  } catch (e) {}
}

function menuCek() {
  var cfg = bacaConfig_();
  var sis = getStudents_();
  var ent = getEntries_();
  SpreadsheetApp.getUi().alert(
    'Nama Aplikasi : ' + cfg.appName + '\n' +
    'Kelas          : ' + cfg.classes.length + '\n' +
    'Akun Guru      : ' + cfg.teachers.length + '\n' +
    'Siswa          : ' + sis.students.length + '\n' +
    'Isi Jurnal     : ' + ent.entries.length + '\n' +
    'Catatan Guru   : ' + cfg.notes.length
  );
}

/* Perbaiki data jurnal yang rusak. Dua masalah sekaligus:
     1) kolom Tanggal & Nilai yang sudah dikonversi Google Sheets
        menjadi objek Date/Time ditulis ulang sebagai TEKS polos
        ("2026-10-02" & "05:30") supaya frontend bisa membandingkannya;
     2) BARIS DOBEL dibuang. dulu setiap simpan menambah baris baru
        (upsert gagal karena tanggalnya sudah jadi objek Date), jadi
        satu isian bisa terimpan puluhan kali dan kelengkapan naik
        lebih dari 100%. Yang dipertahankan hanya baris TERBARU.

   CARA BARU: bukan menghapus baris satu per satu (deleteRow 2000+
   kali akan KEBURUAN timeout di Apps Script), tapi.build ulang
   sheet: hapus semua baris data dengan SATU deleteRows(), lalu
   tulis ulang hanya baris yang unik. Total +/- 5 panggilan API. */
function menuFormatTanggal() {
  var ui = SpreadsheetApp.getUi();
  var sh = getSS().getSheetByName(SHEET_JURNAL);
  if (!sh || sh.getLastRow() <= 1) { ui.alert('Belum ada data jurnal.'); return; }

  var n = sh.getLastRow() - 1;
  var lebar = Math.min(Math.max(sh.getLastColumn(), HEADER_JURNAL.length), 10);
  var data = sh.getRange(2, 1, n, lebar).getValues();

  /* Kumpulkan baris TERBARU untuk tiap kombinasi
     kelas + siswa + tanggal + kode */
  var terbaik = {};
  for (var i = 0; i < n; i++) {
    var tgl = fmtTanggalISO_(data[i][3]);
    if (!tgl) continue;
    var kunci = String(data[i][0]).trim() + '||' + String(data[i][1]).trim() +
      '||' + tgl + '||' + String(data[i][4]).trim();
    var stamp = (Object.prototype.toString.call(data[i][7]) === '[object Date]' && !isNaN(data[i][7].getTime()))
      ? data[i][7].getTime() : String(data[i][7] == null ? '' : data[i][7]);
    if (terbaik[kunci] === undefined || stamp >= terbaik[kunci].stamp) {
      terbaik[kunci] = { stamp: stamp, row: i };
    }
  }

  var barisBaik = [];
  for (var kk in terbaik) barisBaik.push(terbaik[kk].row);
  barisBaik.sort(function (a, b) { return a - b; });

  /* Susun isi akhir sekaligus menormalkan tanggal & jam */
  var hasil = [];
  for (var b = 0; b < barisBaik.length; b++) {
    var r = data[barisBaik[b]];
    hasil.push([
      String(r[0]).trim(),
      String(r[1]).trim(),
      String(r[2]).trim(),
      fmtTanggalISO_(r[3]),
      String(r[4]).trim(),
      fmtJamHM_(r[5]),
      String(r[6] == null ? '' : r[6]).trim(),
      String(r[7] == null ? '' : r[7]).trim(),
      fmtJamHM_(r[8]),
      (r[9] != null && String(r[9]).trim().toUpperCase() === 'YA') ? 'YA' : ''
    ]);
  }

  var hapus = n - hasil.length;
  if (hapus > 0) {
    var jawab = ui.alert(
      'Bersihkan ' + hapus + ' baris dobel?',
      'Baris jurnal sekarang : ' + n + '\n' +
      'Baris unik             : ' + hasil.length + '\n' +
      'Baris dobel            : ' + hapus + '\n\n' +
      'Isi dobel dihapus, yang tertinggal selalu versi TERBARU.',
      ui.ButtonSet.YES_NO);
    if (jawab !== ui.Button.YES) { ui.alert('Dibatalkan, tidak ada yang diubah.'); return; }
  }

  /* --- Bangun ulang sheet (cepat: total +/- 6 panggilan API) --- */
  sh.deleteRows(2, n);
  /* pastikan kolom cukup untuk 10 header */
  var kurangKolom = HEADER_JURNAL.length - sh.getLastColumn();
  if (kurangKolom > 0) sh.insertColumnsAfter(Math.max(sh.getLastColumn(), 1), kurangKolom);
  /* pastikan baris cukup untuk data yang akan ditulis ulang */
  var kurangBaris = (hasil.length + 2) - sh.getMaxRows();
  if (kurangBaris > 0) sh.insertRowsAfter(sh.getMaxRows(), kurangBaris);
  sh.getRange(1, 1, 1, HEADER_JURNAL.length).setValues([HEADER_JURNAL]);
  sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), HEADER_JURNAL.length).setNumberFormat('@');
  if (hasil.length) {
    sh.getRange(2, 1, hasil.length, HEADER_JURNAL.length).setValues(hasil);
  }
  sh.setFrozenRows(1);
  sh.setTabColor('#8B1826');

  cacheBuang_(LOGS_CACHE_KEY);
  ui.alert('Selesai diperbaiki.\n\n' +
    'Baris jurnal sebelum : ' + n + '\n' +
    'Baris jurnal sesudah : ' + hasil.length + '\n' +
    'Baris dobel dihapus  : ' + hapus + '\n\n' +
    'Semua kolom JURNAL sekarang Plain Text, jadi tanggal\n' +
    'tidak akan berubah jadi tanggal lagi di masa depan.');
}