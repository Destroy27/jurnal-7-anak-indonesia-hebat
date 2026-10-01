/* ============================================================
   Jurnal 7 Anak Indonesia Hebat — habits.js
   ------------------------------------------------------------
   Sumber tunggal definisi 7 kebiasaan. Dipakai oleh seluruh
   halaman (murid, guru, orang tua) supaya tampilan, penilaian,
   dan rekap selalu konsisten.

   Tipe isian:
     time  → jam (contoh: "05:30")   ada target jam (targetTime)
     scale → angka 1..5               ada label tiap angka
     check → sudah / belum            ada label singkat
     text  → catatan / tulisan bebas
   ============================================================ */
(function (root) {
  'use strict';

  var HABITS = [
    {
      key: 'bangun',
      no: 1,
      title: 'Bangun Pagi dengan Tujuan',
      sub: 'Bangun lebih awal, punya rencana untuk hari ini',
      type: 'time',
      unit: 'jam',
      targetTime: '05:30',
      icon: 'fa-solid fa-sun',
      color: '#C9A227',
      tip: 'Coba satu alarm untuk bangun, jangan bolak-balik.',
      placeholder: 'Contoh: 05:30'
    },
    {
      key: 'sasaran',
      no: 2,
      title: 'Tetapkan Sasaran Hari Ini',
      sub: 'Tulis 1-3 hal yang ingin kamu capai hari ini',
      type: 'text',
      icon: 'fa-solid fa-bullseye',
      color: '#A82249',
      tip: 'Sasaran sebaiknya spesifik. Contoh: "Selesai PR Matematika halaman 3".',
      placeholder: 'Sasaran saya hari ini adalah...',
      maxLen: 300
    },
    {
      key: 'prioritas',
      no: 3,
      title: 'Prioritaskan yang Penting',
      sub: 'Pilih kegiatan yang paling penting untuk kamu kerjakan',
      type: 'check',
      label: 'Sudah kuprioritaskan dan kerjakan yang paling penting',
      icon: 'fa-solid fa-list-check',
      color: '#8E1C3B',
      tip: 'Kalau tugasnya banyak, kerjakan yang paling sulit lebih dulu.'
    },
    {
      key: 'boss',
      no: 4,
      title: 'Aku yang BOS atas Hariku',
      sub: 'Seberapa baik kamu mengatur waktu dan perasaanmu?',
      type: 'scale',
      labels: {
        1: 'Sulit mengatur',
        2: 'Kadang berhasil',
        3: 'Cukup berhasil',
        4: 'Berhasil',
        5: 'Penuh berhasil'
      },
      icon: 'fa-solid fa-crown',
      color: '#75162F',
      tip: 'Kamu yang Bos atas harimu sendiri, bukan waktu yang mengatur kamu.'
    },
    {
      key: 'refleksi',
      no: 5,
      title: 'Jadwalkan untuk Refleksi',
      sub: 'Sebelum tidur, tulis pelajaran dari hari ini',
      type: 'text',
      icon: 'fa-solid fa-moon',
      color: '#5C1126',
      tip: 'Refleksi singkat setiap malam membuat kebiasaan makin kuat.',
      placeholder: 'Hari ini aku belajar...',
      maxLen: 300
    },
    {
      key: 'dengar',
      no: 6,
      title: 'Dengarkan Dulu, Baru Bicara',
      sub: 'Seberapa baik kamu mendengarkan orang lain?',
      type: 'scale',
      labels: {
        1: 'Kurang',
        2: 'Cukup',
        3: 'Baik',
        4: 'Sangat baik',
        5: 'Sangat luar biasa'
      },
      icon: 'fa-solid fa-ear-listen',
      color: '#9C7B16',
      tip: 'Dengarkan sampai orang selesai bicara, baru kamu menjawab.'
    },
    {
      key: 'asah',
      no: 7,
      title: 'Asah Gendangmu',
      sub: 'Jaga badan dan tubuhmu tetap sehat',
      type: 'check',
      label: 'Sudah olahraga, membaca, atau santai bareng keluarga',
      icon: 'fa-solid fa-dumbbell',
      color: '#12805C',
      tip: 'Olahraga, baca buku, dan hang out bareng keluarga.'
    }
  ];

  /* Peta cepat: key -> objek kebiasaan */
  var BY_KEY = {};
  HABITS.forEach(function (h) { BY_KEY[h.key] = h; });

  /* Palet warna lengthwise 7 (untuk bar & sparkline) */
  var PALETTE = HABITS.map(function (h) { return h.color; });

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
    { key: 'bangunkecil', icon: 'fa-solid fa-sun', label: 'Bangun Pagi', desc: 'Bangun paling lambat 05:30 sebanyak 10x', butuh: 10 },
    { key: 'lengkap', icon: 'fa-solid fa-star', label: 'Hari Lengkap', desc: 'Semua 7 kebiasaan terisi 10x', butuh: 10 }
  ];

  /* ---------- Helper ---------- */

  function get(key) { return BY_KEY[key] || null; }
  function byNo(no) {
    for (var i = 0; i < HABITS.length; i++) if (HABITS[i].no === Number(no)) return HABITS[i];
    return null;
  }
  function keys() { return HABITS.map(function (h) { return h.key; }); }
  function total() { return HABITS.length; }

  /* Skor satu isian 0..100
     - time  : 100 bila <= target, turun 20 poin tiap 30 menit lebih lambat (min 0)
     - scale : (nilai / 5) * 100
     - check : 100 bila terisi
     - text  : 100 bila ada isi                                        */
  function scoreEntry(habitKey, nilai) {
    var h = BY_KEY[habitKey];
    if (!h) return 0;
    var v = String(nilai == null ? '' : nilai).trim();
    if (!v) return 0;

    if (h.type === 'time') {
      var m = parseHM(v);
      if (!m) return 0;
      var t = parseHM(h.targetTime) || 330; /* default 05:30 */
      var selisih = m - t;
      if (selisih <= 0) return 100;
      return Math.max(0, 100 - Math.ceil(selisih / 30) * 20);
    }
    if (h.type === 'scale') {
      var n = parseInt(v, 10);
      if (isNaN(n)) return 0;
      return Math.max(0, Math.min(100, (n / 5) * 100));
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
    if (!h) return String(nilai || '');
    var v = String(nilai == null ? '' : nilai).trim();
    if (!v) return '-';
    if (h.type === 'check') return v === '1' ? 'Sudah' : 'Belum';
    if (h.type === 'scale') {
      var lbl = h.labels && h.labels[v];
      return lbl ? v + ' - ' + lbl : v;
    }
    if (h.type === 'text') return v.length > 40 ? v.slice(0, 40) + '...' : v;
    return v;
  }

  root.HABITS7 = {
    list: HABITS,
    byKey: get,
    byNo: byNo,
    keys: keys,
    total: total,
    palette: PALETTE,
    lencana: LENCANA,
    HARI: HARI,
    HARI_PENDEK: HARI_PENDEK,
    scoreEntry: scoreEntry,
    parseHM: parseHM,
    toHM: toHM,
    levelDariJumlah: levelDariJumlah,
    ringkas: ringkas
  };
})(typeof window !== 'undefined' ? window : this);