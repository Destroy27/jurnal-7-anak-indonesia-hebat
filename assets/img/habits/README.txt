=========================================================
 FOLDER GAMBAR 7 KEBIASAAN
=========================================================
Tujuh file .svg di sini adalah gambar sementara (nomor pada
warna masing-masing kebiasaan). Ganti dengan foto asli supaya
halaman depan tampil lebih menarik.

CARA GANTI
---------------------------------------------------------
1. Siapkan 7 foto (boleh sebagian saja):
     bangun.jpg, ibadah.jpg, olahraga.jpg, makan.jpg,
     belajar.jpg, masyarakat.jpg, tidur.jpg

   Syarat biar tetap ringan di HP sekolah:
     - lebar sekitar 800 px, TINGGI bebas (otomatis dipotong)
     - format .jpg atau .webp
     - ukuran di bawah 300 KB per file
     - foto orang / wajah siswa boleh, tapi pastikan sekolah
       sudah menyetujui. Foto landscape lebih cocok.

2. Hapus file .svg yang akan diganti, lalu taruh fotomu
   dengan nama .jpg yang sama di folder ini.

3. Buka  assets/js/site-config.js, ganti satu kata per
   kebiasaan, dari  .svg  jadi  .jpg  :

     bangun: 'assets/img/habits/bangun.svg'   ->  .jpg

4. Commit & push. Halaman depan langsung berubah.

Kalau file fotonya belum ada / masih salah nama, kartu
otomatis kembali ke ikon + warna kebiasaan. Jadi tidak
pernah gagal tampil.
=========================================================