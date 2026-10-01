/* ============================================================
   Jurnal 7 Anak Indonesia Hebat - habits.js
   ------------------------------------------------------------
   Sumber tunggal definisi 7 kebiasaan. Dipakai oleh seluruh
   halaman (murid, guru, orang tua) supaya tampilan, penilaian,
   dan rekap selalu konsisten.

   Daftar ini mengikuti 7 Kebiasaan Anak Indonesia Hebat (G7KAIH),
   gerakan pendidikan karakter Kementerian Pendidikan Dasar dan
   Menengah (Kemendikdasmen), diluncurkan 27 Desember 2024 di
   Jakarta. Buku Panduan resmi terbit 11 April 2025.
     1. Bangun pagi
     2. Beribadah/berdoa sesuai keyakinan
     3. Berolahraga
     4. Makan sehat dan bergizi
     5. Gemar belajar
     6. Bermasyarakat
     7. Tidur cepat (istirahat cukup)

   Tipe isian:
     time  -> jam (contoh: "05:30")   ada target jam (targetTime)
     check -> centang sudah / belum   ada label singkat
   Setiap kebiasaan tetap bisa diisi catatan singkat opsional.
   ============================================================ */
(function (root) {
  'use strict';

  var HABITS = [
    {
      key: 'bangun',
      no: 1,
      title: 'Bangun Pagi',
      sub: 'Bangun pagi dan mulai hari dengan tenang',
      type: 'time',
      unit: 'jam',
      targetTime: '05:30',
      targetLabel: 'Target bangun',
      placeholder: 'Contoh: 05:30',
      icon: 'fa-solid fa-sun',
      color: '#B07D12',
      tip: 'Coba satu alarm untuk bangun, jangan bolak-balik.'
    },
    {
      key: 'ibadah',
      no: 2,
      title: 'Beribadah / Berdoa',
      sub: 'Beribadah dan berdoa sesuai keyakinanmu',
      type: 'check',
      label: 'Sudah beribadah dan berdoa hari ini',
      icon: 'fa-solid fa-hands-praying',
      color: '#1D4E89',
      tip: 'Sesuaikan dengan keyakinan dan agama yang kamu anut.'
    },
    {
      key: 'olahraga',
      no: 3,
      title: 'Berolahraga',
      sub: 'Badan sehat, tebal menghadapi tantangan',
      type: 'check',
      label: 'Sudah olahraga hari ini',
      icon: 'fa-solid fa-person-running',
      color: '#2E7D32',
      tip: 'Olahraga ringan seperti lari, bersepeda, atau bermain bola sudah cukup.'
    },
    {
      key: 'makan',
      no: 4,
      title: 'Makan Sehat dan Bergizi',
      sub: 'Jaga tubuh dengan makanan sehat',
      type: 'check',
      label: 'Sudah makan sehat dan bergizi',
      icon: 'fa-solid fa-bowl-food',
      color: '#C2410C',
      tip: 'Makan tiga kali sehari, perbanyak sayur dan buah.'
    },
    {
      key: 'belajar',
      no: 5,
      title: 'Gemar Belajar',
      sub: 'Suka belajar dan bertambah pengetahuan',
      type: 'check',
      label: 'Sudah belajar hari ini',
      icon: 'fa-solid fa-book-open',
      color: '#5B21B6',
      tip: 'Walaupun sudah selesai belajar, sisihkan waktu untuk membaca.'
    },
    {
      key: 'masyarakat',
      no: 6,
      title: 'Bermasyarakat',
      sub: 'Sopan santun dan ramah terhadap sesama',
      type: 'check',
      label: 'Sudah bersikap baik kepada sesama',
      icon: 'fa-solid fa-people-group',
      color: '#0E7490',
      tip: 'Bantu teman, sopan santun, dan jaga kebersihan bersama.'
    },
    {
      key: 'tidur',
      no: 7,
      title: 'Tidur Cepat',
      sub: 'Istirahat cukup, tidur sebelum jam 9 malam',
      type: 'time',
      unit: 'jam',
      targetTime: '21:00',
      targetLabel: 'Target tidur',
      placeholder: 'Contoh: 20:30',
      icon: 'fa-solid fa-bed',
      color: '#334155',
      tip: 'Tidur cukup 9-10 jam supaya sekolah besok lebih fit.'
    }
  ];

  /* Peta cepat: key -> objek kebiasaan */
  var BY_KEY = {};
  HABITS.forEach(function (h) { BY_KEY[h.key] = h; });

  /* Palet warna lengthwise 7 (untuk bar & sparkline) */
  var PALETTE = HABITS.map(function (h) { return h.color; });

  /* Target jam hasil setelan guru: { bangun: { targetTime }, ... } */
  var OVERRIDES = {};

  function setOverrides(ov) { OVERRIDES = ov || {}; }

  /* Target jam efektif untuk sebuah kebiasaan */
  function targetOf(key) {
    var h = BY_KEY[key];
    if (!h) return null;
    var ov = OVERRIDES[key];
    return (ov && ov.targetTime) || h.targetTime || null;
  }

  /* Nama hari dalam bahasa Indonesia */
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  /* Lencana pencapaian */
  var LENCANA = [
    { key: 'awal', icon: 'fa-solid fa-seedling', label: 'Mulai', desc: 'Jurnal pertama terisi', butuh: 1 },
    { key: '3hari', icon: 'fa-solid fa-fire', label: '3 Hari', desc: 'Jurnal 3 hari berturut-turut', butuh: 3 },
    { key: '7hari', icon: 'fa-solid fa-award', label: '7 Hari', desc: 'Jurnal 7 hari berturut-turut', butuh: 7 },
    { key: '14hari', icon: 'fa-solid fa-trophy', label: '14 Hari', desc: 'Jurnal 14 hari berturut-turut', butuh: 14 },
    { key: '21hari', icon: 'fa-solid fa-crown', label: '21 Hari', desc: 'Jurnal 21 hari berturut-turut', butuh: 21 },
    { key: '30hari', icon: 'fa-solid fa-gem', label: '30 Hari', desc: 'Jurnal 30 hari berturut-turut', butuh: 30 },
    { key: 'bangunkecil', icon: 'fa-solid fa-sun', label: 'Bangun Pagi', desc: 'Bangun sesuai target 10 kali', butuh: 10 },
    { key: 'tidurtepat', icon: 'fa-solid fa-bed', label: 'Tidur Cepat', desc: 'Tidur sesuai target 10 kali', butuh: 10 },
    { key: 'lengkap', icon: 'fa-solid fa-star', label: 'Hari Lengkap', desc: 'Semua 7 kebiasaan terisi 10 kali', butuh: 10 }
  ];

  /* ---------- Helper ---------- */

  function get(key) { return BY_KEY[key] || null; }

  /* Aman untuk data lama / entri yang kebawa kode kebiasaan yang sudah
     tidak dipakai. Selalu mengembalikan objek, tidak pernah null, jadi
     halaman tetap bisa render walau isi jurnal tidak dikenali. */
  function safe(key) {
    return BY_KEY[key] || {
      key: String(key || ''), no: 99, title: 'Kebiasaan', sub: '',
      type: 'text', icon: 'fa-solid fa-circle-question', color: '#9C9CA2',
      tip: '', label: ''
    };
  }

  /* Nomor urut untuk pengurutan; kode tak dikenal ditaruh di akhir */
  function noOf(key) { return BY_KEY[key] ? BY_KEY[key].no : 99; }
  function byNo(no) {
    for (var i = 0; i < HABITS.length; i++) if (HABITS[i].no === Number(no)) return HABITS[i];
    return null;
  }
  function keys() { return HABITS.map(function (h) { return h.key; }); }
  function total() { return HABITS.length; }

  /* Skor satu isian 0..100
       time  : 100 bila <= target, turun 20 poin tiap 30 menit
               melewati target (min 0)
       check : 100 bila terisi                                        */
  function scoreEntry(habitKey, nilai) {
    var h = BY_KEY[habitKey];
    if (!h) return 0;
    var v = String(nilai == null ? '' : nilai).trim();
    if (!v) return 0;

    if (h.type === 'time') {
      var m = parseHM(v);
      if (m === null) return 0;
      var t = parseHM(targetOf(habitKey));
      if (t === null) return 100;
      var selisih = m - t;
      if (selisih <= 0) return 100;
      return Math.max(0, 100 - Math.ceil(selisih / 30) * 20);
    }
    return 100;
  }

  /* "05:30" -> 330 (menit sejak 00:00). null bila tidak valid. */
  function parseHM(str) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(str || '').trim());
    if (!m) return null;
    var h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
    if (isNaN(h) || isNaN(mi) || h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }

  /* 330 -> "05:30" */
  function toHM(menit) {
    var m = Math.max(0, Math.round(menit));
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  /* Level 0..4 untuk pewarnaan heatmap (berdasarkan jumlah kebiasaan terisi) */
  function levelDariJumlah(jumlahIsian) {
    if (!jumlahIsian) return 0;
    if (jumlahIsian <= 2) return 1;
    if (jumlahIsian <= 4) return 2;
    if (jumlahIsian <= 6) return 3;
    return 4;
  }

  /* Label ringkas untuk rekap per kebiasaan */
  function ringkas(habitKey, nilai) {
    var h = BY_KEY[habitKey];
    var v = String(nilai == null ? '' : nilai).trim();
    if (!v) return '-';
    if (!h) return v;
    if (h.type === 'check') return v === '1' ? 'Sudah' : 'Belum';
    if (h.type === 'text') return v.length > 40 ? v.slice(0, 40) + '...' : v;
    return v;
  }

  root.HABITS7 = {
    list: HABITS,
    byKey: get,
    safe: safe,
    noOf: noOf,
    byNo: byNo,
    keys: keys,
    total: total,
    palette: PALETTE,
    lencana: LENCANA,
    HARI: HARI,
    HARI_PENDEK: HARI_PENDEK,
    setOverrides: setOverrides,
    targetOf: targetOf,
    scoreEntry: scoreEntry,
    parseHM: parseHM,
    toHM: toHM,
    levelDariJumlah: levelDariJumlah,
    ringkas: ringkas
  };
})(typeof window !== 'undefined' ? window : this);