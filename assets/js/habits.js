/* ====
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
   ==== */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------
     DUA JENIS TEKS per kebiasaan:
       sub        -> versi SATU BARIS. Dipakai di kartu jurnal
                     harian (murid) yang sempit, jadi harus pendek.
       deskripsi  -> penjelasan LENGKAP. Dipakai di halaman
                     depan (kartu 7 kebiasaan) yang ruangnya cukup.
                     Kalau deskripsi tidak diisi, halaman depan
                     otomatis memakai `sub`.
     ------------------------------------------------------------ */
  var HABITS = [
    /* ATURAN CATATAN WAJIB (lihat catatan di atas):
       wajibCatatan: true  -> begitu kebiasaan DICENTANG, kolom
                             catatan WAJIB diisi sebelum boleh disimpan.
                             Nilainya dibaca murid.js, jadi mengubah
                             true/false di sini langsung berlaku
                             tanpa menyentuh kode lain.
       Untuk type 'time' (bangun, tidur) dibiarkan false: cukup
       mengetik jamnya, catatan tetap opsional. */
    {
      key: 'bangun',
      no: 1,
      title: 'Bangun Pagi',
      sub: 'Bangun pagi dan mulai hari dengan tenang',
      deskripsi: 'Bangun Pagi mengajarkan nilai-nilai disiplin, keseimbangan, produktivitas, dan menghargai waktu yang berkontribusi pada kualitas hidup yang lebih baik.',
      type: 'time',
      unit: 'jam',
      targetTime: '05:30',
      targetLabel: 'Target bangun',
      placeholder: 'Contoh: 05:30',
      icon: 'fa-solid fa-sun',
      color: '#8A6D1A',
      tip: 'Coba satu alarm untuk bangun, jangan bolak-balik.'
    },
    {
      key: 'ibadah',
      no: 2,
      title: 'Beribadah / Berdoa',
      sub: 'Beribadah dan berdoa sesuai keyakinanmu',
      deskripsi: 'Beribadah bukan hanya sekadar ritual, tetapi juga menyimpan makna spiritual dan moral yang membentuk kepribadian, pencarian makna hidup, serta membentuk hubungan yang harmonis seseorang dengan Tuhan, alam, dan sesama.',
      type: 'check',
      label: 'Sudah beribadah dan berdoa hari ini',
      wajibCatatan: false,
      icon: 'fa-solid fa-hands-praying',
      color: '#1F5A7A',
      tip: 'Sesuaikan dengan keyakinan dan agama yang kamu anut.'
    },
    {
      key: 'olahraga',
      no: 3,
      title: 'Berolahraga',
      sub: 'Badan sehat, tebal menghadapi tantangan',
      deskripsi: 'Berolahraga lebih dari sekadar menjaga kesehatan fisik, tetapi mengandung makna mendalam yang berhubungan dengan disiplin, keseimbangan, ketahanan mental, dan bahkan kehidupan yang lebih terarah atau bermakna.',
      type: 'check',
      label: 'Sudah olahraga hari ini',
      wajibCatatan: false,
      icon: 'fa-solid fa-person-running',
      color: '#2F7D4F',
      tip: 'Olahraga ringan seperti lari, bersepeda, atau bermain bola sudah cukup.'
    },
    {
      key: 'makan',
      no: 4,
      title: 'Makan Sehat dan Bergizi',
      sub: 'Jaga tubuh dengan makanan sehat',
      deskripsi: 'Makan Sehat dan bergizi berkaitan dengan prinsip dan nilai tentang pentingnya memenuhi kebutuhan nutrisi tubuh untuk mendukung kehidupan yang sehat, seimbang, dan bermakna.',
      type: 'check',
      label: 'Sudah makan sehat dan bergizi',
      wajibCatatan: false,
      icon: 'fa-solid fa-bowl-food',
      color: '#B85C22',
      tip: 'Makan tiga kali sehari, perbanyak sayur dan buah.'
    },
    {
      key: 'belajar',
      no: 5,
      title: 'Gemar Belajar',
      sub: 'Suka belajar dan bertambah pengetahuan',
      deskripsi: 'Gemar belajar mengajak seseorang untuk tumbuh dalam pemahaman, karakter, dan kearifan.',
      type: 'check',
      label: 'Sudah belajar hari ini',
      wajibCatatan: false,
      icon: 'fa-solid fa-book-open',
      color: '#5B4A9E',
      tip: 'Walaupun sudah selesai belajar, sisihkan waktu untuk membaca.'
    },
    {
      key: 'masyarakat',
      no: 6,
      title: 'Bermasyarakat',
      sub: 'Sopan santun dan ramah terhadap sesama',
      deskripsi: 'Bermasyarakat didasarkan pada nilai-nilai prinsip yang mendorong individu untuk hidup bersama secara harmonis dan berkontribusi terhadap kesejahteraan kolektif.',
      type: 'check',
      label: 'Sudah bersikap baik kepada sesama',
      wajibCatatan: false,
      icon: 'fa-solid fa-people-group',
      color: '#2A7A80',
      tip: 'Bantu teman, sopan santun, dan jaga kebersihan bersama.'
    },
    {
      key: 'tidur',
      no: 7,
      title: 'Tidur Cepat',
      sub: 'Istirahat cukup, tidur sebelum jam 9 malam',
      deskripsi: 'Tidur cepat adalah aspek penting dari kehidupan yang berdampak pada kesehatan fisik, kesejahteraan mental, serta kehidupan spiritual dan sosial.',
      type: 'time',
      unit: 'jam',
      targetTime: '21:00',
      targetLabel: 'Target tidur',
      placeholder: 'Contoh: 20:30',
      icon: 'fa-solid fa-bed',
      color: '#4A5A54',
      tip: 'Tidur cukup 9-10 jam supaya sekolah besok lebih fit.'
    }
  ];

  /* Peta cepat: key -> objek kebiasaan */
  var BY_KEY = {};
  HABITS.forEach(function (h) { BY_KEY[h.key] = h; });
  
  /* Bobot poin per isian (sesuai permintaan user) */
  var BOBOT = {
    centang: 1,      // hanya centang
    isi: 2,          // centang + catatan terisi
    dokumentasi: 3   // centang + catatan + dokumentasi/foto
  };

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
      key: String(key || ''), no: 99, title: 'Kebiasaan', sub: '', deskripsi: '', wajibCatatan: false,
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

  /* Apakah kebiasaan ini punya dokumentasi foto?
     Datenya sampai dari 3 bentuk: boolean TRUE, string "YA" dari
     spreadsheet, atau string base64 (versi lama). Semua aman
     karena nilai FALSE/SIANG/TIDAK ikut dianggap "tidak ada". */
  function adaDokumentasi(v) {
    if (v === true) return true;
    var s = String(v == null ? '' : v).trim().toUpperCase();
    return s !== '' && s !== 'FALSE' && s !== '0' && s !== 'NO' && s !== 'N' && s !== 'TIDAK';
  }

  /* Skor satu isian 0..100 dengan bobot:
       centang saja            -> 33   (1 x)
       + catatan terisi        -> 67   (2 x)
       + dokumentasi/foto      -> 100  (3 x) */
  function scoreEntry(habitKey, nilai, catatan, adaFoto) {
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
    // check
    if (adaDokumentasi(adaFoto)) return 100;
    if (catatan && String(catatan).trim() !== '') return 67;
    return 33;
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
    adaDokumentasi: adaDokumentasi,
    parseHM: parseHM,
    toHM: toHM,
    BOBOT: BOBOT,
    levelDariJumlah: levelDariJumlah,
    ringkas: ringkas
  };
})(typeof window !== 'undefined' ? window : this);