/* ====
   Jurnal 7 Anak Indonesia Hebat — core.js
   ------------------------------------------------------------
   Dipakai oleh: index.html · murid.html · guru.html · ortu.html

   Arsitektur:
   - Google Spreadsheet (via Apps Script) = sumber kebenaran
   - localStorage = cache ringan supaya halaman cepat dibuka
   - Baca data  = JSONP via GET  (?action=get_all)
   - Tulis data = POST mode no-cors + verifikasi ulang (garansi data masuk)
   ==== */
(function (root) {
  'use strict';

  var H = root.HABITS7;

  /* ---------------- Kunci penyimpanan lokal ---------------- */
  var KEYS = {
    cache:  'j7_cache_v1',
    script: 'j7_script_url',
    sesi:   'j7_sesi',
    kelas:  'j7_kelas_terpilih'
  };
  var PENDING_KEY = 'j7_pending';

  /* ---------------- State global ---------------- */
  var state = {
    config: { appName: 'Jurnal 7 Anak Indonesia Hebat', teachers: [], habitOverrides: {}, notes: [] },
    students: [],   /* { kelasId, nis, nama, panggilan, pin, kodeOrtu, kelas } */
    entries: []     /* { id, kelasId, nis, nama, tanggal, kode, nilai, catatan, tsISO, tsDisplay } */
  };
  var onExternalChange = null;
  var _syncBusy = false;
  var _configLoaded = false;

  var _pending = [];
  try { _pending = JSON.parse(localStorage.getItem(PENDING_KEY)) || []; } catch (e) { _pending = []; }
  var _pendBusy = false;
  var _pendTimer = null;
  var _onPendingConfirm = null;

  /* ---------------- URL Apps Script ----------------
     Sumber urutan:
     1. site-config.js  (diisi sekali oleh guru -> berlaku untuk semua perangkat)
     2. localStorage    (diubah dari Panel Admin saat/runtime)
  ------------------------------------------------------------ */
  function siteScriptURL() {
    var sc = root.SITECONFIG || {};
    return String(sc.scriptUrl || '').trim();
  }
  /* Nama sekolah ditulis sekali di site-config.js, dipakai untuk
     judul tab, navbar, dan kop halaman cetak. */
  function namaSekolah() {
    var sc = root.SITECONFIG || {};
    return String(sc.namaSekolah || '').trim();
  }
  /* ---------------- Gambar kebiasaan ----------------
     Guru bebas menyiapkan foto untuk tiap kebiasaan. Isi
     SITECONFIG.gambarKebiasaan (lihat site-config.js):
       { bangun: 'assets/img/habits/bangun.jpg', ... }
     Kalau dikosongkan atau file-nya tidak ada, kartu otomatis
     memakai ikon + warna kebiasaan, jadi tidak pernah rusak. */
  function gambarHabit(key) {
    var sc = root.SITECONFIG || {};
    var peta = sc.gambarKebiasaan || {};
    return String(peta[key] || '').trim();
  }
  /* ---------------- Logo aplikasi ----------------
     Semua halaman (depan, murid, guru, orang tua) memakai SATU
     logo yang sama, yaitu assets/img/logo-sd.png (logo SD N 4
     Jehem). Kalau file itu belum diunggah, browser otomatis turun
     ke assets/img/logo.svg (logo bawaan), jadi halaman tidak pernah
     rusak. Kalau SITECONFIG.logo diisi, path itulah yang dipakai
     sehingga logo bisa diganti tanpa menyentuh file HTML. */
  var LOGO_UTAMA = 'assets/img/logo-sd.png';
  var LOGO_CADANGAN = 'assets/img/logo.svg';

  function logoURL() {
    var sc = root.SITECONFIG || {};
    var dari = String(sc.logo || '').trim();
    return dari || LOGO_UTAMA;
  }
  /* Satu tempat untuk semua <img data-logo>. Dua catatan penting:
     1) onerror HAPUS BARU di hop terakhir. Kalau dilepas sejak
        hop pertama, logo.svg yang hilang tidak akan pernah
        tertangani dan yang muncul hanya gambar rusak.
     2) pakai style.display, BUKAN .hidden, karena reset di
        base.css (`img { display:block }`) mengalahkan atribut
        [hidden]. */
  function terapkanLogo() {
    var url = logoURL();
    var imgs = document.querySelectorAll('img[data-logo]');
    for (var i = 0; i < imgs.length; i++) {
      (function (img) {
        img.onerror = function () {
          if (String(img.getAttribute('src') || '') === LOGO_CADANGAN) {
            img.onerror = null;
            img.style.display = 'none';
            return;
          }
          img.src = LOGO_CADANGAN;
        };
        img.src = url;
      })(imgs[i]);
    }
  }
  var scriptURL = (function () {
    try { return localStorage.getItem(KEYS.script) || siteScriptURL(); } catch (e) { return siteScriptURL(); }
  })();
  function isConfigured() {
    /* Terima URL http(s) apa pun yang berakhiran /exec - milik Google
       Apps Script maupun proxy sendiri. Local testing pun jadi mungkin. */
    return /^https?:\/\/[^\s?#]+\/exec\/?$/i.test(String(scriptURL || '').trim());
  }
  /* Peringatan halus kalau URL tidak terlihat seperti Google Apps Script */
  function peringatanUrl() {
    var u = String(scriptURL || '').trim();
    if (!u) return 'URL Apps Script belum diisi.';
    if (!/script\.google\.com/i.test(u)) {
      return 'URL ini bukan dari script.google.com. Pastikan deployment disetel "Anyone" dan URL berakhiran /exec.';
    }
    return '';
  }

  /* === CACHE LOKAL === */
  function loadCache() {
    try {
      var raw = localStorage.getItem(KEYS.cache);
      if (!raw) return;
      var c = JSON.parse(raw);
      if (c && c.config) {
        state.config = Object.assign({ appName: 'Jurnal 7 Anak Indonesia Hebat', teachers: [], habitOverrides: {}, notes: [] }, c.config);
        state.students = c.students || [];
        state.entries = c.entries || [];
        _configLoaded = true;
        terapkanTarget();
      }
    } catch (e) { /* abaikan cache rusak */ }
  }
  function saveCache() {
    try {
      localStorage.setItem(KEYS.cache, JSON.stringify(state));
      return true;
    } catch (e) { return false; }
  }
  function saveScriptURL() {
    try { localStorage.setItem(KEYS.script, scriptURL); } catch (e) { /* mode privat */ }
  }

  /* === HELPER UMUM === */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function uid() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  function inisial(nama) {
    var parts = String(nama || '?').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /* === TANGGAL (selalu waktu lokal) === */
  function todayISO() { return toISO(new Date()); }

  function toISO(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function fromISO(iso) {
    var p = String(iso || '').split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function addDays(iso, n) {
    var d = fromISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  function daysBetween(a, b) {
    return Math.round((fromISO(b) - fromISO(a)) / 86400000);
  }
  /* Rentang tanggal mundur: [kemarin, ..., hari ini] */
  function lastDays(n) {
    var out = [], t = todayISO();
    for (var i = n - 1; i >= 0; i--) out.push(addDays(t, -i));
    return out;
  }
  function fmtTanggal(iso) {
    var d = fromISO(iso);
    if (isNaN(d)) return iso;
    return d.getDate() + ' ' + ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][d.getMonth()] + ' ' + d.getFullYear();
  }
  function fmtTanggalPendek(iso) {
    var d = fromISO(iso);
    if (isNaN(d)) return iso;
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1);
  }
  function fmtHari(iso) {
    var d = fromISO(iso);
    if (isNaN(d)) return '';
    return H.HARI[d.getDay()];
  }
  function fmtWaktu() {
    var d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function fmtTanggalPendekJam(iso) {
    var d = fromISO(iso);
    if (isNaN(d)) return '';
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' +
      pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /* === SHA-256 (login) === */
  function sha256(text) {
    if (root.crypto && root.crypto.subtle && root.TextEncoder) {
      return root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
        .then(function (buf) {
          return Array.prototype.map.call(new Uint8Array(buf), function (b) {
            return ('0' + b.toString(16)).slice(-2);
          }).join('');
        });
    }
    return Promise.resolve(null);
  }

  /* === SELEKTOR DATA === */
  function getKelas(id) {
    var list = state.config.classes || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  /* No. absen ditulis bebas: "1", "01", "001" semuanya berarti anak yang
     sama, dan huruf besar/kecil juga dianggap sama. Tanpa ini murid yang
     mengetik "01" ditolak padahal di sheet tersimpan "1". */
  function nisKunci_(v) {
    var s = String(v == null ? '' : v).trim().toLowerCase();
    if (/^\d+$/.test(s)) return String(Number(s));   /* "01" -> "1", "007" -> "7" */
    return s;
  }
  /* No. absen TIDAK unik sendirian - ia unik per kelas. Dua kelas boleh
     sama-sama punya anak nomor 1. Karena itu identitas siswa adalah
     pasangan (kelas, no. absen), dan semua pembacaan entri wajib tahu
     kelasnya. Tanpa ini, anak kelas A bisa melihat jurnal anak lain
     yang kebetulan memakai nomor absen sama. */
  function kelasKunci_(v) {
    return v == null || v === '' ? '' : String(v).trim().toLowerCase();
  }
  function getSiswa(nis, kelasId) {
    var n = nisKunci_(nis);
    var kc = kelasId == null || kelasId === '' ? '' : String(kelasId).trim().toLowerCase();

    /* CARI YANG PERSIS DULU.
       No. absen (NIS) hanya unik DALAM satu kelas. Sheet JURNAL boleh
       menyimpan NIS 1 untuk siswa kelas "4" dan NIS 1 untuk siswa
       kelas "tes" tanpa itu salah. Kalau pencarian hanya memakai NIS,
       getSiswa('1') akan selalu mengembalikan siswa yang kebetulan
       lebih dulu di daftar - sehingga orang tua melihat jurnal anak
       yang salah.

       Karena itu kelas ikut dipertimbangkan kalau tersedia.
       Bila kelas tidak diberikan, pemanggil hanya mendapat kandidat
       pertama - sama seperti perilaku lama. */
    var cocok = [];
    for (var i = 0; i < state.students.length; i++) {
      var s = state.students[i];
      if (nisKunci_(s.nis) !== n) continue;
      if (kc && String(s.kelasId).trim().toLowerCase() === kc) return s;
      cocok.push(s);
    }
    if (kc) return null;            /* kelas diketahui, tidak ada yang cocok */
    /* Kandidat tunggal pasti orang yang dimaksud. Kalau ada lebih dari
       satu (NIS sama di beberapa kelas), pakai yang pertama supaya
       perilakunya sama persis dengan versi lama. */
    var unik = cocok.length === 1 ? cocok[0] : null;
    return unik || cocok[0] || null;
  }
  function getSiswaKelas(kelasId) {
    return state.students
      .filter(function (s) { return String(s.kelasId) === String(kelasId); })
      .sort(function (a, b) {
        if (a.nama !== b.nama) return String(a.nama).localeCompare(String(b.nama), 'id');
        return String(a.nis).localeCompare(String(b.nis), 'en', { numeric: true });
      });
  }
  /* Jurnal satu siswa.
     PENTING: versi lama selalu MENAMBAH baris baru tiap kali
     disimpan (upsert-nya gagal karena tanggal berubah jadi objek
     Date), sehingga satu isian bisa muncul puluhan kali. Kalau
     tidak di-rapikan di sini, kelengkapan/daya bisa lebih dari
     100% dan rata-rata menjadi tidak masuk akal. Yang dipakai
     selalu baris paling TERBARU per (tanggal + kode). */
  function entriesOf(nis, kelasId) {
    var n = nisKunci_(nis);
    var kc = kelasKunci_(kelasId);
    var peta = {};
    state.entries.forEach(function (e) {
      if (nisKunci_(e.nis) !== n) return;
      if (kc && kelasKunci_(e.kelasId) !== kc) return;
      var k = String(e.tanggal) + '__' + String(e.kode);
      var lama = peta[k];
      if (!lama) { peta[k] = e; return; }
      if (String(e.tsISO || '') > String(lama.tsISO || '')) peta[k] = e;
    });
    return Object.keys(peta).map(function (k) { return peta[k]; })
      .sort(function (a, b) { return String(a.tanggal).localeCompare(String(b.tanggal)); });
  }
  function entryOf(nis, tanggal, kode, kelasId) {
    return entriesOf(nis, kelasId).filter(function (e) {
      return String(e.tanggal) === String(tanggal) && String(e.kode) === String(kode);
    }).slice(-1)[0] || null;
  }
  /* Target jam bangun & tidur bisa diatur guru lewat tab Pengaturan */
  function targetBangun() { return H.targetOf('bangun') || '05:30'; }
  function targetTidur() { return H.targetOf('tidur') || '21:00'; }

  /* Teruskan setelan target guru ke habits.js supaya skor ikut berubah */
  function terapkanTarget() { H.setOverrides(state.config.habitOverrides || {}); }

  /* === MESIN REKAP === */

  /* Ringkasan satu hari: jumlah kebiasaan terisi + skor rata-rata */
  function ringkasHari(entriesHari) {
    var byKey = {};
    entriesHari.forEach(function (e) { byKey[String(e.kode)] = e; });
    var jumlah = Object.keys(byKey).length;
    var totalSkor = 0;
    Object.keys(byKey).forEach(function (k) {
      var en = byKey[k];
      totalSkor += H.scoreEntry(k, en.nilai, en.catatan, en.adaFoto);
    });
    return {
      tanggal: entriesHari.length ? entriesHari[0].tanggal : '',
      byKey: byKey,
      jumlah: jumlah,
      lengkap: jumlah >= H.total(),
      skor: jumlah ? Math.round(totalSkor / jumlah) : 0,
      poin: jumlah ? Math.round(totalSkor / H.total()) : 0
    };
  }

  /* Deret berurutan hari berisi jurnal (untuk heatmap & streak) */
  function deretHari(entries) {
    var map = {};
    entries.forEach(function (e) {
      if (!map[e.tanggal]) map[e.tanggal] = [];
      map[e.tanggal].push(e);
    });
    var out = {};
    Object.keys(map).forEach(function (k) { out[k] = ringkasHari(map[k]); });
    return out;
  }

  /* Berapa hari berturut-turut isi jurnal, berakhir di hari ini (atau kemarin) */
  function hitungStreak(harianMap) {
    var t = todayISO();
    var cursor = harianMap[t] ? t : addDays(t, -1);
    if (!harianMap[cursor]) return 0;
    var n = 0;
    while (harianMap[cursor]) { n++; cursor = addDays(cursor, -1); }
    return n;
  }
  function streakTerpanjang(entries) {
    var hari = Object.keys(deretHari(entries)).sort();
    var terbaik = 0, berjalan = 0, prev = null;
    hari.forEach(function (d) {
      if (prev && daysBetween(prev, d) === 1) berjalan++;
      else berjalan = 1;
      if (berjalan > terbaik) terbaik = berjalan;
      prev = d;
    });
    return terbaik;
  }

  /* Rekap lengkap satu siswa dalam rentang hari */
  function rekapSiswa(nis, jumlahHari, kelasId) {
    var n = Number(jumlahHari) || 30;
    var semua = entriesOf(nis, kelasId);
    var harian = deretHari(semua);
    var rentang = lastDays(n);
    var hariAktif = Object.keys(harian).filter(function (d) { return harian[d].jumlah > 0; });

    var totalSlot = rentang.length * H.total();
    var totalIsi = semua.filter(function (e) { return rentang.indexOf(e.tanggal) !== -1; }).length;
    var poin = 0;
    semua.forEach(function (e) { if (rentang.indexOf(e.tanggal) !== -1) poin += H.scoreEntry(e.kode, e.nilai, e.catatan, e.adaFoto); });

    /* Per kebiasaan */
    var hariIni = todayISO();
    var perHabit = H.list.map(function (h) {
      var rows = semua.filter(function (e) {
        return e.kode === h.key && rentang.indexOf(e.tanggal) !== -1;
      }).sort(function (a, b) { return String(a.tanggal).localeCompare(String(b.tanggal)); });

      var skorTotal = 0;
      rows.forEach(function (r) { skorTotal += H.scoreEntry(h.key, r.nilai, r.catatan, r.adaFoto); });

      /* Jendela 7 hari terakhir: dipakai untuk PERSEN dan SKOR
         rata-rata, sehingga begitu anak journaling, angkanya
         langsung naik di hari yang sama. */
      var rows7 = semua.filter(function (e) {
        var d = daysBetween(e.tanggal, hariIni);
        return e.kode === h.key && d >= 0 && d <= 6;
      });
      var count7 = rows7.length;
      var skor7 = 0;
      rows7.forEach(function (r) { skor7 += H.scoreEntry(h.key, r.nilai, r.catatan, r.adaFoto); });

      var rataWaktu = null;
      if (h.type === 'time' && rows.length) {
        var jumlahMenit = 0, valid = 0;
        rows.forEach(function (r) {
          var m = H.parseHM(r.nilai);
          if (m !== null) { jumlahMenit += m; valid++; }
        });
        if (valid) rataWaktu = H.toHM(jumlahMenit / valid);
      }

      var pembagi = 7;
      var persen = Math.round((count7 / pembagi) * 100);
      if (persen > 100) persen = 100;
      if (persen < 0) persen = 0;
      return {
        key: h.key, no: h.no, title: h.title, sub: h.sub, icon: h.icon, color: h.color, type: h.type,
        jumlah: count7,
        persen: persen,
        rataSkor: count7 ? Math.round(skor7 / count7) : 0,
        terakhir: rows.length ? rows[rows.length - 1].nilai : '',
        catatanTerakhir: rows.length ? rows[rows.length - 1].catatan : '',
        tanggalTerakhir: rows.length ? rows[rows.length - 1].tanggal : '',
        rataWaktu: rataWaktu
      };
    });

    return {
      nis: String(nis),
      hariRentang: rentang,
      harian: harian,
      hariAktif: hariAktif,
      hariAktifJml: hariAktif.length,
      /* Poin = kualitas isian yang terisi (0-100).
         Kelengkapan = berapa persen dari slot rentang yang terisi.
         Dua hal sengaja dipisah supaya anak yang baru mulai tidak
         terlihat nilainya kecil. Dijepit 100% supaya tidak pernah
         lebih dari 100 walau ada data dobel. */
      kelengkapan: totalSlot ? Math.min(100, Math.round((totalIsi / totalSlot) * 100)) : 0,
      rataPoin: totalIsi ? Math.round(poin / totalIsi) : 0,
      streak: hitungStreak(harian),
      streakTerpanjang: streakTerpanjang(semua),
      perHabit: perHabit,
      lencana: lencanaTerbuka(harian, semua)
    };
  }

  /* Lencana yang sudah syarat */
  function lencanaTerbuka(harian, semuaEntries) {
    var hariAktif = Object.keys(harian).filter(function (d) { return harian[d].jumlah > 0; }).length;
    var bangunTelat = semuaEntries.filter(function (e) {
      if (e.kode !== 'bangun') return false;
      var m = H.parseHM(e.nilai);
      return m !== null && m <= (H.parseHM(targetBangun()) || 330);
    }).length;
    var hariLengkap = Object.keys(harian).filter(function (d) { return harian[d].lengkap; }).length;
    var tidurTepat = semuaEntries.filter(function (e) {
      if (e.kode !== 'tidur') return false;
      var m = H.parseHM(e.nilai);
      var t = H.parseHM(targetTidur());
      return m !== null && t !== null && m <= t;
    }).length;

    return H.lencana.filter(function (l) {
      if (l.key === 'bangunkecil') return bangunTelat >= l.butuh;
      if (l.key === 'tidurtepat') return tidurTepat >= l.butuh;
      if (l.key === 'lengkap') return hariLengkap >= l.butuh;
      return hariAktif >= l.butuh;
    });
  }

  /* Rekap satu kelas: ringkasan per siswa + agregat kelas */
  function rekapKelas(kelasId, jumlahHari) {
    var n = Number(jumlahHari) || 7;
    var siswa = getSiswaKelas(kelasId);
    var baris = siswa.map(function (s) {
      /* kelas ikut dikirim: rekap satu kelas tidak boleh ikut menghitung
         entri anak lain yang kebetulan memakai no. absen sama */
      var r = rekapSiswa(s.nis, n, kelasId);
      var harianTerisi = r.hariAktifJml;
      return {
        siswa: s,
        rekap: r,
        nama: s.nama,
        nis: s.nis,
        poin: r.rataPoin,
        kelengkapan: r.kelengkapan,
        streak: r.streak,
        hariAktif: harianTerisi,
        hariRentang: r.hariRentang,
        harian: r.harian,
      };
    });
    baris.sort(function (a, b) { return b.poin - a.poin; });

    var total = baris.length;
    var aktif = baris.filter(function (b) { return b.hariAktif > 0; }).length;
    var hariIni = todayISO();
    var isiHariIni = baris.filter(function (b) { return b.harian[hariIni] && b.harian[hariIni].jumlah > 0; }).length;
    /* Rata-rata hanya dari siswa yang sudah mengisi, supaya siswa yang
       belum mulai tidak menjatuhkan nilai kelas. */
    var yangTerisi = baris.filter(function (b) { return b.hariAktif > 0; });
    var rataKelas = yangTerisi.length
      ? Math.round(yangTerisi.reduce(function (a, b) { return a + b.poin; }, 0) / yangTerisi.length)
      : 0;
    var best = baris[0] || null;
    /* "Perlu bantuan" = belum mengisi jurnal HARI INI. Bukan
   "aktif" saja, karena anak yang sudah mulai 2-3 hari lalu juga
   belum mengisi hari ini, dan itulah yang perlu dikejar guru.
   `hariAktifJml` tidak ada di baris rekap kelas (itu milik
   rekapSiswa) - kalau salah nama, hasilnya selalu kosong. */
var perluBantu = baris.filter(function (b) {
  var h = b.harian[hariIni];
  return !(h && h.jumlah > 0);
});

    return {
      kelas: getKelas(kelasId),
      kelasId: kelasId,
      jumlahSiswa: total,
      hariRentang: lastDays(n),
      baris: baris,
      statistik: {
        total: total,
        aktif: aktif,
        tidakAktif: total - aktif,
        isiHariIni: isiHariIni,
        persenHariIni: total ? Math.round((isiHariIni / total) * 100) : 0,
        rataKelas: rataKelas,
        rataKelasDari: yangTerisi.length,
        streakTertinggi: total ? Math.max.apply(null, baris.map(function (b) { return b.streak; })) : 0,
        terbaik: best,
        perluBantu: perluBantu
      }
    };
  }

  /* === AUTENTIKASI ===
     Pola arsitektur tanpa server: data tersinkron ke perangkat,
     sehingga verifikasi dilakukan di sisi klien. Sama seperti
     aplikasi absensi sebelumnya. Lihat catatan keamanan di README.
  ------------------------------------------------------------ */
  function loginGuru(user, password) {
    var u = String(user || '').trim().toLowerCase();
    var daftar = state.config.teachers || [];
    var cocok = daftar.find(function (t) { return String(t.user).toLowerCase() === u; }) || null;
    if (!cocok) return Promise.resolve({ ok: false, msg: 'Akun guru tidak ditemukan.' });
    return sha256(String(password || '')).then(function (hash) {
      if (!hash) return { ok: false, msg: 'Browser tidak mendukung SHA-256 (butuh HTTPS).' };
      if (hash !== cocok.pass) return { ok: false, msg: 'Password salah.' };
      return { ok: true, role: 'guru', guru: cocok };
    });
  }
  /* Login murid: No. Absen (bebas, mis. siswa01) + Nama Panggilan.
     Nama panggilan disimpan dua kali: polos (supaya guru bisa
     membantu murid yang lupa) & hash SHA-256 (dipakai saat login). */
  function loginSiswa(nis, panggilan, kelasId) {
    /* Kelas ikut dicari. Tanpa ini, dua kelas yang sama-sama punya
       anak nomor absen 1 akan selalu mengembalikan whichever yang
       kebetulan lebih dulu di daftar - sehingga anak yang kedua tidak
       bisa masuk sama sekali. */
    var s = getSiswa(nis, kelasId);
    if (!s) return Promise.resolve({ ok: false, msg: 'No. absen tidak terdaftar. Tanya guru kelasmu.' });
    var pw = String(panggilan || '').trim();
    if (!pw) return Promise.resolve({ ok: false, msg: 'Nama panggilan wajib diisi.' });
    return sha256(pw.toLowerCase()).then(function (hash) {
      if (!hash) return { ok: false, msg: 'Browser tidak mendukung SHA-256 (butuh HTTPS).' };
      if (hash !== s.pin) {
        return { ok: false, msg: 'Nama panggilan salah. Tanya guru kelasmu ya.' };
      }
      return { ok: true, role: 'siswa', siswa: s };
    });
  }
  function loginOrtu(kode) {
    var k = String(kode || '').trim().toUpperCase();
    var s = state.students.find(function (x) { return String(x.kodeOrtu || '').toUpperCase() === k; });
    if (!s) return Promise.resolve({ ok: false, msg: 'Kode akses tidak ditemukan. Hubungi guru.' });
    return Promise.resolve({ ok: true, role: 'ortu', siswa: s });
  }

  /* Sesi login */
  function simpanSesi(sesi) {
    try { localStorage.setItem(KEYS.sesi, JSON.stringify(sesi)); } catch (e) {}
  }
  function ambilSesi() {
    try { return JSON.parse(localStorage.getItem(KEYS.sesi)) || null; } catch (e) { return null; }
  }
  function hapusSesi() {
    try { localStorage.removeItem(KEYS.sesi); } catch (e) {}
  }

  /* === HTTP: JSONP (baca) === */
  function fetchJSONP(action, params, cb, timeoutMs) {
    if (!isConfigured()) {
      cb({ ok: false, msg: 'URL Apps Script belum diatur. Buka menu Pengaturan.' });
      return;
    }
    var qs = '?action=' + encodeURIComponent(action);
    if (params) {
      Object.keys(params).forEach(function (k) {
        if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
          qs += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
        }
      });
    }
    var prefix = '_j7_' + Math.random().toString(36).slice(2, 10);
    var s = document.createElement('script');
    var done = false;
    function bersihkan() {
      done = true;
      try { delete root[prefix]; } catch (e) { root[prefix] = undefined; }
      try { if (s.parentNode) s.parentNode.removeChild(s); } catch (e) {}
    }
    root[prefix] = function (data) { bersihkan(); cb(data); };
    s.onerror = function () {
      if (done) return;
      bersihkan();
      cb({ ok: false, msg: 'Gagal menghubungi database. Cek URL & versi deployment Apps Script.' });
    };
    s.src = scriptURL.trim() + qs + '&prefix=' + prefix;
    setTimeout(function () {
      if (!done) { bersihkan(); cb({ ok: false, msg: 'Waktu tunggu habis. Periksa koneksi & URL Apps Script.' }); }
    }, timeoutMs || 25000);
    document.head.appendChild(s);
  }

  /* === HTTP: POST (tulis) === */
  function postToSheet(payload, retries) {
    if (!isConfigured()) return Promise.resolve({ ok: false, msg: 'URL Apps Script belum diatur.' });
    retries = retries == null ? 2 : Math.max(0, retries);
    var attempt = 0;
    var TIMEOUT_MS = 18000;

    function coba() {
      attempt++;
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
      return fetch(scriptURL.trim(), {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function () {
        if (timer) clearTimeout(timer);
        return { ok: true };
      }).catch(function (err) {
        if (timer) clearTimeout(timer);
        if (attempt <= retries) {
          var wait = 700 * Math.pow(2, attempt - 1);
          return new Promise(function (res) { setTimeout(function () { res(coba()); }, wait); });
        }
        return { ok: false, msg: 'Koneksi gagal - periksa jaringan lalu coba lagi.' };
      });
    }
    return coba();
  }

  /* === SYNC === */
  function syncAll(onDone) {
    if (!isConfigured()) { if (onDone) onDone({ ok: false, msg: 'URL Apps Script belum diatur.' }); return; }
    if (_syncBusy) return;
    _syncBusy = true;

    fetchJSONP('get_all', null, function (r) {
      _syncBusy = false;
      if (r && r.ok && r.config) {
        state.config = r.config;
        state.students = r.students || [];
        state.entries = r.entries || [];
        _configLoaded = true;
        terapkanTarget();
        saveCache();
        jadwalkanTuangAntrean();
        if (onDone) onDone({
          ok: true,
          jumlahSiswa: state.students.length,
          jumlahEntri: state.entries.length,
          /* Diteruskan ke halaman supaya bisa memberi tahu guru
             kalau tanggal di sheet rusak (penyebab rekap 0%). */
          tanggalRusak: r.tanggalRusak || 0,
          contohTanggalRusak: r.contohTanggalRusak || '',
          /* Status cache dari backend. Kalau false terus-menerus,
             cache-nya mati - itu bukan masalah yang dilihat murid,
             tapi berarti tiap sinkron membaca ulang seluruh sheet. */
          cacheBerfungsi: !!r.cacheBerfungsi,
          jumlahPotonganCache: r.jumlahPotonganCache || 0,
          cachePesanError: r.cachePesanError || ''
        });
      } else {
        if (onDone) onDone({ ok: false, msg: (r && r.msg) || 'Gagal mengambil data.' });
      }
    });
  }

  /* ============================================================
     AUTO-SYNC BERJALAN DI LATAR BELAKANG
     ------------------------------------------------------------
     Default 90 detik terlalu sering untuk jurnal harian: tidak ada
     yang butuh data berubah tiap 1,5 menit. Murid mengisi satu kali
     seumur hari, guru membuka rekap satu-dua kali sehari.

     5 menit memangkas jumlah unduhan menjadi seperenam dari
     sebelumnya. Ditambah: jangan langsung sync saat tab baru dibuka
     (biasanya justru sedang mengetik) — tunggu dulu tab diam.

     Nilai ms dari pemanggil tetap dipakai, jadi angka 90000 di
     halaman lain tidak ikut berubah dan tidak merusak apa pun.
     ============================================================ */
  function mulaiAutoSync(onDone, ms) {
    ms = ms || 300000;                 /* dianggap basi setelah 5 menit */
    var jedaAwal = 8000;               /* beri waktu halaman selesai tampil */
    var pengamanMs = 3600000;          /* jaring pengaman: 1 jam */
    var terakhirBerhasil = Date.now();

    function jalankan() {
      syncAll(function (r) {
        if (r && r.ok) terakhirBerhasil = Date.now();
        if (onDone) onDone(r);
      });
    }

    /* Halaman baru dibuka: satu sinkron apa pun kondisinya. */
    setTimeout(jalankan, jedaAwal);

    /* Setelah itu hanya bila memang sudah basi. SyncAll sudah
       menolak dua permintaan yang tumpang tindih (_syncBusy),
       jadi peristiwa focus + visibilitychange yang datang
       berurutan tidak menyebabkan dua kali permintaan ke server. */
    function bilaBasi() {
      if (typeof document !== 'undefined' && document.hidden) return;
      if ((Date.now() - terakhirBerhasil) < ms) return;
      jalankan();
    }

    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) bilaBasi();
      });
    }
    if (typeof root !== 'undefined' && root.addEventListener) {
      root.addEventListener('focus', bilaBasi);
    }
    setInterval(bilaBasi, pengamanMs);
  }

  /* === SIMPAN JURNAL (GARANSI MASUK) ===
     Alur: POST -> tunggu -> verifikasi ke database -> bila belum
     masuk, simpan ke antrean lokal & kirim ulang otomatis.
     Inilah yang mencegah catatan hilang saat sinyaljelek.
  ------------------------------------------------------------ */
  function idEntri(e) {
    return [e.kelasId, e.nis, e.tanggal, e.kode].join('__');
  }
  function entriSudahDiServer(item) {
    return state.entries.some(function (e) { return idEntri(e) === idEntri(item); });
  }

  function buildEntry(siswa, tanggal, kode, nilai, catatan, adaFoto) {
    return {
      action: 'save_entries',
      kelasId: String(siswa.kelasId || ''),
      nis: String(siswa.nis || ''),
      nama: String(siswa.nama || ''),
      tanggal: tanggal,
      kode: kode,
      nilai: String(nilai == null ? '' : nilai).trim(),
      catatan: String(catatan == null ? '' : catatan).trim(),
      /* HanyaYA/TIDAK. Foto jpeg-nya sendiri TIDAK dikirim ke
         spreadsheet: satu sel Google Sheets hanya kuat 50.000
         karakter, sedangkan foto base64 jauh lebih besar dan
         kalau ikut terkirim, seluruh jurnal gagal tersimpan.
         Foto disimpan terpisah di perangkat (lihat simpanFoto). */
      adaFoto: adaFoto ? 'YA' : '',
      tsISO: new Date().toISOString(),
      tsDisplay: fmtTanggalPendekJam(todayISO())
    };
  }

  /* ---------- Gudang foto lokal (TERPISAH dari cache jurnal) ----------
     Base64 foto berukuran besar. Kalau ikut masuk ke j7_cache_v1,
     localStorage penuh (batas ±5 MB) lalu saveCache gagal diam-diam
     dan halaman selalu memakai data lama - itu sebabnya jurnal
     "tidak kesimpen". Karena itu foto disimpan pada kunci sendiri. */
  var FOTO_KEY = 'j7_foto_v1';
  var _fotoStore = null;
  function ambilFotoStore() {
    if (_fotoStore) return _fotoStore;
    try { _fotoStore = JSON.parse(localStorage.getItem(FOTO_KEY)) || {}; }
    catch (e) { _fotoStore = {}; }
    return _fotoStore;
  }
  function simpanFotoStore() {
    try {
      localStorage.setItem(FOTO_KEY, JSON.stringify(_fotoStore || {}));
      return true;
    } catch (e) {
      /* Kuota penuh: buang foto paling lama, lalu coba lagi. */
      try {
        var k = Object.keys(_fotoStore || {}).sort();
        while (k.length > 40) { delete _fotoStore[k.shift()]; }
        localStorage.setItem(FOTO_KEY, JSON.stringify(_fotoStore));
        return true;
      } catch (e2) { return false; }
    }
  }
  function kunciFoto(nis, tanggal, kode, kelasId) {
    var kc = kelasKunci_(kelasId);
    return kc ? [kc, nis, tanggal, kode].join('__') : [nis, tanggal, kode].join('__');
  }
  function simpanFoto(nis, tanggal, kode, dataUrl, kelasId) {
    if (!dataUrl) return false;
    ambilFotoStore()[kunciFoto(nis, tanggal, kode, kelasId)] = dataUrl;
    return simpanFotoStore();
  }
  function ambilFoto(nis, tanggal, kode, kelasId) {
    /* Kalau kelas diberikan, coba kunci lengkap dulu; lalu jatuh ke
       kunci lama (tanpa kelas) supaya foto yang tersimpan sebelum
       perubahan ini tetap ditemukan. */
    if (kelasKunci_(kelasId)) {
      var baru = ambilFotoStore()[kunciFoto(nis, tanggal, kode, kelasId)];
      if (baru) return baru;
    }
    return ambilFotoStore()[kunciFoto(nis, tanggal, kode)] || '';
  }

  function simpanEntries(items, cb) {
    /* Yang dianggap "ada isian" bukan hanya nilai: catatan dan foto
       juga sah punya isian. Versi lama membuang catatan/foto yang
       tidak punya nilai, jadi isian murid hilang tanpa jejak. */
    items = items.filter(function (x) {
      if (!x) return false;
      return String(x.nilai || '') !== '' || String(x.catatan || '') !== '' ||
             x.adaFoto === 'YA' || x.adaFoto === true;
    });
    if (!items.length) { if (cb) cb({ ok: true, confirmed: true, msg: 'Tidak ada isian baru.' }); return Promise.resolve({ ok: true, confirmed: true }); }

    /* Tampilkan langsung di layar (cache lokal) supaya respons */
    var baru = items.map(function (it) {
      return {
        id: idEntri(it), kelasId: it.kelasId, nis: it.nis, nama: it.nama,
        tanggal: it.tanggal, kode: it.kode, nilai: it.nilai, catatan: it.catatan,
        adaFoto: it.adaFoto === 'YA' || it.adaFoto === true,
        tsISO: it.tsISO, tsDisplay: it.tsDisplay, pending: true
      };
    });
    baru.forEach(function (b) {
      var i = state.entries.findIndex(function (e) { return e.id === b.id; });
      if (i === -1) state.entries.push(b); else state.entries[i] = b;
    });
    saveCache();
    if (typeof onExternalChange === 'function') onExternalChange();

    /* Kirim satu paket (efisien: 7 kebiasaan = 1 request) */
    var paket = {
      action: 'save_entries',
      items: items.map(function (it) {
        return {
          kelasId: it.kelasId, nis: it.nis, nama: it.nama, tanggal: it.tanggal,
          kode: it.kode, nilai: it.nilai, catatan: it.catatan, adaFoto: it.adaFoto,
          tsISO: it.tsISO, tsDisplay: it.tsDisplay
        };
      })
    };

    return postToSheet(paket, 0).then(function () {
      return new Promise(function (r) { setTimeout(r, 6500); });
    }).then(function () {
      return verifikasi(items);
    }).then(function (semuaMasuk) {
      if (semuaMasuk) {
        if (cb) cb({ ok: true, msg: 'Tersimpan & terverifikasi.' });
        return { ok: true, confirmed: true };
      }
      masukkanAntrean(items);
      if (cb) cb({ ok: true, msg: 'Tersimpan di perangkat - dikirim ulang otomatis.' });
      return { ok: true, confirmed: false, queued: true };
    }).catch(function () {
      masukkanAntrean(items);
      if (cb) cb({ ok: true, msg: 'Tersimpan di perangkat - dikirim ulang otomatis.' });
      return { ok: true, confirmed: false, queued: true };
    });
  }

  /* Cek ke server: apakah semua isian ini benar-benar sudah masuk? */
  function verifikasi(items) {
    return new Promise(function (resolve) {
      fetchJSONP('get_entries', null, function (r) {
        if (!r || !r.ok || !r.entries) { resolve(null); return; }
        var peta = {};
        r.entries.forEach(function (e) { peta[idEntri(e)] = true; });
        var hilang = items.filter(function (it) { return !peta[idEntri(it)]; });
        /* null = ragu (server lambat) -> tahan antrean saja */
        if (r.entries.length === 0 && state.entries.length > 0) { resolve(null); return; }
        resolve(hilang.length === 0);
      }, 20000);
    });
  }

  /* ---------- Antrean offline ---------- */
  function simpanAntrean() { try { localStorage.setItem(PENDING_KEY, JSON.stringify(_pending)); } catch (e) {} }
  function masukkanAntrean(items) {
    items.forEach(function (it) {
      if (!_pending.some(function (x) { return idEntri(x) === idEntri(it); })) _pending.push(it);
    });
    simpanAntrean();
    jadwalkanTuangAntrean();
  }
  function jadwalkanTuangAntrean() {
    clearTimeout(_pendTimer);
    if (!_pending.length) return;
    _pendTimer = setTimeout(function () { kurasAntrean(); }, 20000);
  }
  function kurasAntrean() {
    if (_pendBusy || !_pending.length || !isConfigured()) return Promise.resolve();
    _pendBusy = true;
    var items = _pending.slice();
    return new Promise(function (resolve) {
      fetchJSONP('get_entries', null, function (r) {
        if (!r || !r.ok || !r.entries) { _pendBusy = false; jadwalkanTuangAntrean(); resolve(); return; }
        var peta = {};
        r.entries.forEach(function (e) { peta[idEntri(e)] = true; });
        var terkonfirmasi = [], kirimLagi = [];
        items.forEach(function (p) {
          if (peta[idEntri(p)]) terkonfirmasi.push(p); else kirimLagi.push(p);
        });

        /* Yang sudah masuk: tandai pending=false di cache lokal */
        terkonfirmasi.forEach(function (p) {
          var it = state.entries.find(function (e) { return e.id === idEntri(p); });
          if (it) it.pending = false;
          if (typeof _onPendingConfirm === 'function') _onPendingConfirm(p);
        });
        saveCache();
        if (terkonfirmasi.length) {
          _pending = _pending.filter(function (x) { return !terkonfirmasi.some(function (p) { return idEntri(x) === idEntri(p); }); });
          simpanAntrean();
          if (typeof onExternalChange === 'function') onExternalChange();
        }

        /* Sisanya: kirim ulang berurutan */
        var chain = Promise.resolve();
        kirimLagi.forEach(function (p) {
          chain = chain.then(function () {
            return postToSheet({ action: 'save_entries', items: [stripAction(p)] }, 0);
          });
        });
        chain.then(function () {
          _pendBusy = false;
          jadwalkanTuangAntrean();
          resolve();
        });
      }, 15000);
    });
  }
  function stripAction(p) {
    return {
      kelasId: p.kelasId, nis: p.nis, nama: p.nama, tanggal: p.tanggal,
      kode: p.kode, nilai: p.nilai, catatan: p.catatan,
      tsISO: p.tsISO, tsDisplay: p.tsDisplay
    };
  }

  /* === ADMIN: KELOLA DATA === */
  function simpanConfig(cfg, cb) {
    if (!_configLoaded) {
      if (cb) cb({ ok: false, msg: 'Tunggu sinkron pertama selesai, lalu coba lagi.' });
      return Promise.resolve({ ok: false });
    }
    state.config = cfg;
    saveCache();
    return postToSheet({
      action: 'save_config',
      appName: cfg.appName,
      teachers: cfg.teachers,
      classes: cfg.classes,
      habitOverrides: cfg.habitOverrides
    }).then(function (r) {
      setTimeout(function () { syncAll(function () { if (cb) cb(r); }); }, 500);
      return r;
    });
  }

  function simpanSiswa(kelasId, daftar, cb) {
    state.students = state.students.filter(function (s) { return s.kelasId !== kelasId; })
      .concat(daftar.map(function (s) {
        return {
          kelasId: kelasId, nis: String(s.nis).trim(), nama: String(s.nama).trim(),
          kelas: s.kelas || '', panggilan: String(s.panggilan || '').trim(),
          pin: s.pin || '', kodeOrtu: String(s.kodeOrtu || '').trim()
        };
      }));
    saveCache();
    return postToSheet({ action: 'save_students', kelasId: kelasId, students: state.students.filter(function (s) { return s.kelasId === kelasId; }) })
      .then(function (r) {
        setTimeout(function () { syncAll(function () { if (cb) cb(r); }); }, 500);
        return r;
      });
  }

  function hapusEntry(kelasId, nis, tanggal, kode, cb) {
    state.entries = state.entries.filter(function (e) {
      return !(String(e.kelasId) === String(kelasId) && String(e.nis) === String(nis) &&
        String(e.tanggal) === String(tanggal) && String(e.kode) === String(kode));
    });
    /* Foto lokal ikut dibuang supaya tidak memenuhi kuota localStorage */
    delete ambilFotoStore()[kunciFoto(nis, tanggal, kode)];
    simpanFotoStore();
    saveCache();
    return postToSheet({ action: 'delete_entry', kelasId: kelasId, nis: nis, tanggal: tanggal, kode: kode })
      .then(function (r) { if (cb) cb(r); return r; });
  }

  function hapusSemuaEntries(kelasId, cb) {
    state.entries = state.entries.filter(function (e) { return String(e.kelasId) !== String(kelasId); });
    saveCache();
    return postToSheet({ action: 'clear_entries', kelasId: kelasId })
      .then(function (r) { setTimeout(function () { syncAll(cb); }, 500); return r; });
  }

  /* === CATATAN GURU UNTUK SISWA === */
  /* Disimpan di sheet CATATAN agar guru bisa menulis pesan untuk orang tua. */
  function simpanCatatan(catatanBaru, cb) {
    return postToSheet({ action: 'save_note', note: catatanBaru })
      .then(function (r) {
        setTimeout(function () { syncAll(function () { if (cb) cb(r); }); }, 500);
        return r;
      });
  }
  function catatanUntuk(nis, kelasId) {
    var kc = kelasKunci_(kelasId);
    return (state.config.notes || [])
      .filter(function (n) {
        if (String(n.nis) !== String(nis)) return false;
        if (kc && kelasKunci_(n.kelasId) !== kc) return false;
        return true;
      })
      .sort(function (a, b) { return String(b.tanggal).localeCompare(String(a.tanggal)); });
  }

  /* === RENDER: RING / BAR / HEATMAP === */
  var GRAD_ID = 'j7ringGrad';
  function svgDefs() {
    return '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' +
      '<defs><linearGradient id="' + GRAD_ID + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#175C49"/><stop offset="100%" stop-color="#0F3B30"/>' +
      '</linearGradient>' +
      '<linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#175C49"/><stop offset="100%" stop-color="#175C49" stop-opacity="0"/>' +
      '</linearGradient></defs></svg>';
  }

  function ring(persen, size, tebal, warna) {
    persen = Math.max(0, Math.min(100, Math.round(persen || 0)));
    size = size || 96; tebal = tebal || 9;
    var r = (size - tebal) / 2;
    var keliling = 2 * Math.PI * r;
    var isi = keliling * persen / 100;
    return '<div class="ring" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg width="' + size + '" height="' + size + '">' +
      '<circle class="ring-track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + tebal + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + tebal + '"' +
      ' stroke="url(#' + GRAD_ID + ')" stroke-dasharray="' + keliling.toFixed(1) + '"' +
      ' stroke-dashoffset="' + (keliling - isi).toFixed(1) + '" fill="none" stroke-linecap="round"' +
      (warna ? ' style="stroke:' + warna + '"' : '') + '/>' +
      '</svg>' +
      '<div class="ring-label"><strong>' + persen + '%</strong></div>' +
      '</div>';
  }

  /* Bar chart sederhana (data: [{label, value, max, warna}]) */
  function barChart(data, opsi) {
    opsi = opsi || {};
    if (!data.length) return '<div class="empty"><p>Belum ada data.</p></div>';
    var max = opsi.max || Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1]));
    return '<div class="bars">' + data.map(function (d) {
      var tinggi = max ? Math.round((d.value / max) * 100) : 0;
      if (d.value <= 0) return '<div class="bar-col"><div class="bar-track"><div class="bar-fill empty" style="height:5px"></div></div><div class="bar-label">' + esc(d.label) + '</div></div>';
      return '<div class="bar-col">' +
        '<div class="bar-track"><div class="bar-fill' + (d.kelas || '') + '" style="height:' + Math.max(4, tinggi) + '%">' +
        (opsi.tampilkanNilai === false ? '' : '<span class="bar-value">' + esc(d.teks != null ? d.teks : d.value) + '</span>') +
        '</div></div>' +
        '<div class="bar-label">' + esc(d.label) + '</div></div>';
    }).join('') + '</div>';
  }

  /* Heatmap 7 kolom (Minggu..Sabtu) - bisa untuk rentang atau kalender bulanan */
  function heatmap(harian, tanggalList, opsi) {
    opsi = opsi || {};
    var out = '';
    var list = tanggalList || [];
    var hariIni = todayISO();
    
    // Jika opsi.bulan disediakan (YYYY-MM), render kalender bulanan penuh
    if (opsi.bulan) {
      var parts = opsi.bulan.split('-');
      var tahun = parseInt(parts[0], 10);
      var bulan = parseInt(parts[1], 10); // 1-12
      var dAwal = new Date(tahun, bulan - 1, 1);
      var dAkhir = new Date(tahun, bulan, 0); // hari terakhir bulan
      var offset = dAwal.getDay(); // 0=minggu di JS?
      // Di Indonesia biasanya Minggu=0? tapi kita pakai getDay() standar
      // Tambah sel kosong
      for (var i = 0; i < offset; i++) {
        out += '<div class="heat-cell empty"></div>';
      }
      for (var tgl = 1; tgl <= dAkhir.getDate(); tgl++) {
        var d = new Date(tahun, bulan - 1, tgl);
        var iso = toISO(d);
        var h = harian[iso];
        var jumlah = h ? h.jumlah : 0;
        var lv = H.levelDariJumlah(jumlah);
        var label = fmtHari(iso) + ' ' + fmtTanggalPendek(iso) + ' - ' + jumlah + '/' + H.total() + ' kebiasaan';
        var isHariIni = (iso === hariIni);
        var isLainBulan = false; // semua dalam bulan ini
        out += '<div class="heat-cell lv' + lv + (isHariIni ? ' today' : '') + (isLainBulan ? ' other' : '') + '" title="' + esc(label) + '">' +
          tgl + '</div>';
      }
      // Tambah sel kosong sisa
      var totalSel = offset + dAkhir.getDate();
      var sisa = (7 - (totalSel % 7)) % 7;
      for (var j = 0; j < sisa; j++) {
        out += '<div class="heat-cell empty"></div>';
      }
      return out;
    }
    
    /* baris kosong pembuka agar kolom hari/weekday sejajar (mode rentang) */
    if (list.length) {
      var d0 = fromISO(list[0]).getDay();
      for (var k = 0; k < d0; k++) out += '<div></div>';
    }
    list.forEach(function (t) {
      var h = harian[t];
      var jumlah = h ? h.jumlah : 0;
      var lv = H.levelDariJumlah(jumlah);
      var label = fmtHari(t) + ' ' + fmtTanggalPendek(t) + ' - ' + jumlah + '/' + H.total() + ' kebiasaan';
      out += '<div class="heat-cell lv' + lv + (t === hariIni ? ' today' : '') + '" title="' + esc(label) + '">' +
        fromISO(t).getDate() + '</div>';
    });
    return out;
  }

  /* === TOAST === */
  var _toastTimer = null;
  function toast(judul, pesan, tipe) {
    var t = document.getElementById('toast');
    if (!t) { console.log('[' + judul + '] ' + pesan); return; }
    tipe = tipe || 'ok';
    var ikon = { ok: 'fa-solid fa-circle-check', warn: 'fa-solid fa-triangle-exclamation', err: 'fa-solid fa-circle-xmark' };
    t.querySelector('.t-icon').className = 't-icon ' + (tipe === 'ok' ? 'ok' : tipe === 'warn' ? 'warn' : 'err');
    t.querySelector('.t-icon').innerHTML = '<i class="' + ikon[tipe] + '"></i>';
    t.querySelector('.t-title').textContent = judul;
    t.querySelector('.t-msg').textContent = pesan || '';
    t.classList.add('show');
    t.onclick = sembunyikanToast;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(sembunyikanToast, 4200);
  }

  /* Toast hilang otomatis, tapi juga bisa ditutup dengan satu ketukan.
     Pesan koneksi ("Gagal sinkron", "Database belum terbaca") kadang
     muncul lagi dan lagi; tanpa cara dismiss yang cepat, toastnya
     terasa "nyangkut" di bagian bawah layar. */
  function sembunyikanToast() {
    var t = document.getElementById('toast');
    if (!t) return;
    t.classList.remove('show');
    clearTimeout(_toastTimer);
  }

  /* === MODAL === */
  function modal(opsi) {
    tutupModal();
    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.id = 'modalJ7';
    backdrop.innerHTML =
      '<div class="modal' + (opsi.lebar ? ' modal-lg' : '') + '" role="dialog" aria-modal="true">' +
      '<div class="modal-head"><h3>' + esc(opsi.judul || '') + '</h3>' +
      '<button class="icon-btn" data-tutup aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="modal-body">' + (opsi.isi || '') + '</div>' +
      (opsi.footer === null ? '' : '<div class="modal-foot">' + (opsi.footer || '') + '</div>') +
      '</div>';
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop || e.target.hasAttribute('data-tutup')) tutupModal();
    });
    document.body.style.overflow = 'hidden';
    return backdrop;
  }
  function tutupModal() {
    var m = document.getElementById('modalJ7');
    if (m) m.remove();
    document.body.style.overflow = '';
  }

  /* === EKSPOR / CETAK === */
  function exportCSV(rows, namaFile) {
    var csv = rows.map(function (r) {
      return r.map(function (c) {
        c = String(c == null ? '' : c);
        return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
      }).join(',');
    }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = namaFile || 'jurnal.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  /* === KONTEN UTAMA (API PUBLIK) === */
  var api = {
    KEYS: KEYS,
    get state() { return state; },
    get config() { return state.config; },
    get classes() { return state.config.classes || []; },
    get teachers() { return state.config.teachers || []; },
    get scriptURL() { return scriptURL; },
    set scriptURL(v) { scriptURL = String(v || '').trim(); saveScriptURL(); },
    get siteScriptURL() { return siteScriptURL(); },
    get sekolah() { return namaSekolah(); },
    gambarHabit: gambarHabit,
    logoURL: logoURL,
    get pendingCount() { return _pending.length; },

    isConfigured: isConfigured,
    peringatanUrl: peringatanUrl,
    loadCache: loadCache,
    saveCache: saveCache,
    setOnExternalChange: function (fn) { onExternalChange = fn; },
    setOnPendingConfirm: function (fn) { _onPendingConfirm = fn; },

    esc: esc, pad2: pad2, uid: uid, inisial: inisial, sha256: sha256,
    todayISO: todayISO, toISO: toISO, fromISO: fromISO, addDays: addDays,
    daysBetween: daysBetween, lastDays: lastDays,
    fmtTanggal: fmtTanggal, fmtTanggalPendek: fmtTanggalPendek, fmtHari: fmtHari,
    fmtWaktu: fmtWaktu, fmtTanggalPendekJam: fmtTanggalPendekJam,

    getKelas: getKelas, getSiswa: getSiswa, getSiswaKelas: getSiswaKelas,
    entriesOf: entriesOf, entryOf: entryOf, targetBangun: targetBangun, targetTidur: targetTidur,
      terapkanTarget: terapkanTarget,

    rekapSiswa: rekapSiswa, rekapKelas: rekapKelas, deretHari: deretHari,
    hitungStreak: hitungStreak, streakTerpanjang: streakTerpanjang,

    loginGuru: loginGuru, loginSiswa: loginSiswa, loginOrtu: loginOrtu,
    simpanSesi: simpanSesi, ambilSesi: ambilSesi, hapusSesi: hapusSesi,

    fetchJSONP: fetchJSONP, postToSheet: postToSheet,
    syncAll: syncAll, mulaiAutoSync: mulaiAutoSync,
    simpanEntries: simpanEntries, kurasAntrean: kurasAntrean,

    simpanConfig: simpanConfig, simpanSiswa: simpanSiswa,
    hapusEntry: hapusEntry, hapusSemuaEntries: hapusSemuaEntries,
    simpanCatatan: simpanCatatan, catatanUntuk: catatanUntuk,
    buildEntry: buildEntry, idEntri: idEntri,
    simpanFoto: simpanFoto, ambilFoto: ambilFoto,

    svgDefs: svgDefs, ring: ring, barChart: barChart, heatmap: heatmap,
    toast: toast, modal: modal, tutupModal: tutupModal, exportCSV: exportCSV
  };

  /* Sinkron antar-tab */
  root.addEventListener('storage', function (e) {
    if (e.key === KEYS.cache || e.key === KEYS.script) {
      loadCache();
      if (typeof onExternalChange === 'function') onExternalChange();
    }
  });
  root.addEventListener('online', function () { jadwalkanTuangAntrean(); });

  root.Jurnal = api;
  terapkanLogo();
  loadCache();
})(typeof window !== 'undefined' ? window : this);
