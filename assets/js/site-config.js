/* ============================================================
   site-config.js
   ------------------------------------------------------------
   SATU-SATUNYA file yang perlu diisi guru setelah membuat
   Google Spreadsheet + Apps Script (lihat README).

   Tempel URL Apps Script (yang berakhiran /exec) di bawah.
   Setelah diisi, seluruh perangkat (HP murid, HP orang tua,
   laptop guru) langsung terhubung tanpa setting tambahan.

   Catatan: file ini ikut ter-deploy ke GitHub Pages, jadi
   siapa pun bisa melihat isinya. Jangan pernah menaruh
   password atau data sensitif di sini.
   ============================================================ */
window.SITECONFIG = {
  /* Ganti string kosong di bawah dengan URL deployment kamu,
     contoh: https://script.google.com/macros/s/AKfycb.../exec  */
  scriptUrl: 'https://script.google.com/macros/s/AKfycbw6G4vDvW1eo237lnk3O-OITMpw76CjXLmegXYCggvsgE3j2RcCNtfiJZwbZd136bcn/exec',

  /* Nama aplikasi yang tampil di judul & header.
     Bisa diubah juga dari menu Pengaturan di Panel Guru. */
  namaApp: 'Jurnal 7 Anak Indonesia Hebat',

  /* Nama sekolah. Tampil di navbar (judul browser, halaman masuk),
     dan bisa dicetak di kop laporan. Boleh dikosongkan. */
  namaSekolah: 'SD N 4 Jehem'
};