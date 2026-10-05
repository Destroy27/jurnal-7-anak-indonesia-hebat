/* ====
   site-config.js
   ------------------------------------------------------------
   SATU-SATUNYA file yang perlu diisi guru setelah menyiapkan
   backend (lihat README).

   URL backend ada di baris scriptUrl di bawah. Setelah diisi, seluruh
   perangkat (HP murid, HP orang tua, laptop guru) langsung terhubung
   tanpa setting tambahan.

   Catatan: file ini ikut ter-deploy ke GitHub Pages, jadi
   siapa pun bisa melihat isinya. Jangan pernah menaruh
   password atau data sensitif di sini.
   ==== */
window.SITECONFIG = {
  /* Backend aktif. Awalnya Google Apps Script, sejak 5 Oktober 2026
     diganti Cloudflare Worker. Kembalikan ke sistem lama dengan
     menaruh URL /exec Apps Script di sini.
     Jalur /exec sengaja dipakai walau Worker juga menjawab di root:
     aplikasi menolak URL yang tidak berakhiran /exec. */
  scriptUrl: 'https://jejak7-api.jejak7-api.workers.dev/exec',

  /* Nama aplikasi yang tampil di judul & header.
     Bisa diubah juga dari menu Pengaturan di Panel Guru. */
  namaApp: 'JEJAK 7 KAIH',

  /* Nama sekolah. Tampil di navbar (judul browser, halaman masuk),
     dan bisa dicetak di kop laporan. Boleh dikosongkan. */
  namaSekolah: 'SD N 4 Jehem',

  /* ====
     LOGO APLIKASI
     ------------------------------------------------------------
     Cara paling cepat: salin logomu ke folder  assets/img/
     dengan nama  logo-sd.png  (atau .jpg — hapus yang lama
     supaya tidak bentrok). Semua halaman langsung memakainya —
     navbar, halaman depan, dan kotak logo di kartu login.
     Tidak perlu sentuh kode sama sekali.

     Kalau file-nya tidak ada, aplikasi otomatis memakai
     assets/img/logo.svg (logo bawaan) supaya tidak ada gambar
     rusak.

     Baris di bawah hanya perlu diisi kalau logomu berada di
     tempat lain / repository lain:
        logo: 'assets/img/logo-sekolah.png',
     ==== */
  logo: 'assets/img/logo-sd.png',

  /* ====
     GAMBAR 7 KEBIASAAN (sudah terisi)
     ------------------------------------------------------------
     Ketujuh gambar sudah dipasang sebagai .jpg 900 x 900 di
     folder  assets/img/habits/  (total hanya ±248 KB, ringan
     dibuka HP murid di jaringan sekolah).

     CARA MENGGANTI GAMBAR:
     1. Siapkan gambar (persegi 900 x 900 px, .jpg, di bawah
        150 KB per file). Format persegi penting karena slot
        gambarnya sudah diatur persegi — kalau tidak, bagian
        atas/bawah gambar akan terpotong.
     2. Simpan ke  assets/img/habits/  dengan nama yang sama
        persis (bangun, ibadah, olahraga, makan, belajar,
        masyarakat, tidur).
     3. Kalau memang mau ganti format, ubah juga extension
        di baris di bawah.
     4. Commit & push. Kartu langsung berubah.

     Kalau file-nya dihapus / namanya salah, kartu otomatis
     kembali ke ikon + warna kebiasaan. Jadi tidak pernah gagal
     tampil.
     ==== */
  gambarKebiasaan: {
    bangun: 'assets/img/habits/bangun.jpg',
    ibadah: 'assets/img/habits/ibadah.jpg',
    olahraga: 'assets/img/habits/olahraga.jpg',
    makan: 'assets/img/habits/makan.jpg',
    belajar: 'assets/img/habits/belajar.jpg',
    masyarakat: 'assets/img/habits/masyarakat.jpg',
    tidur: 'assets/img/habits/tidur.jpg'
  }
};
