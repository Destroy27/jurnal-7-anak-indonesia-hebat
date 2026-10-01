/* ============================================================
   Jurnal 7 Anak Indonesia Hebat — login.js
   Halaman depan: pilih peran, masuk, arahkan ke halaman terkait.
   ============================================================ */
(function () {
  'use strict';

  var J = window.Jurnal;
  var H = window.HABITS7;
  var role = 'siswa';

  document.getElementById('tahun').textContent = new Date().getFullYear();
  document.head.insertAdjacentHTML('beforeend', J.svgDefs());

  /* ---------- Nama aplikasi & sekolah ---------- */
  function terapkanNamaApp(nama) {
    nama = nama || 'Jurnal 7 Anak Indonesia Hebat';
    var sekolah = J.sekolah || '';
    document.title = sekolah ? nama + ' - ' + sekolah : nama;
    document.getElementById('namaAppNav').textContent = nama;
    var sub = document.getElementById('namaSekolahNav');
    if (sub) sub.textContent = sekolah || 'Mencetak Anak Indonesia Hebat';
    document.getElementById('namaAppFoot').textContent = nama;
    var foot = document.getElementById('namaSekolahFoot');
    if (foot) foot.textContent = sekolah;
  }

  /* ---------- Kartu 7 kebiasaan (bagian paling atas) ----------
     Tata letak kartu:
       1. LINGKARAN gambar di tengah atas, dikelilingi cincin
          tipis warna kebiasaan + nomor di sudutnya.
       2. Judul di bawah lingkaran.
       3. Panel kecil berisi penjelasan lengkap.
       4. Chip info: target jam, atau cara mengisinya.
     Gambar diambil dari SITECONFIG.gambarKebiasaan (lihat
     site-config.js). Kalau kosong / file tidak ada, lingkaran
     otomatis memakai ikon + warna kebiasaan. */
  function gambarKebiasaan() {
    var wadah = document.getElementById('habitCards');
    if (!wadah) return;

    wadah.innerHTML = H.list.map(function (h) {
      var gambar = J.gambarHabit(h.key);
      var foto = gambar
        ? '<img src="' + J.esc(gambar) + '" alt="" loading="lazy" onerror="this.remove()">'
        : '';

      /* Info kecil: kebiasaan jam tampil targetnya, kebiasaan
         centang tampil caranya mengisi. */
      var target = H.targetOf(h.key);
      var meta = target
        ? '<i class="fa-regular fa-clock"></i> ' + J.esc(h.targetLabel || 'Target') + ' ' + J.esc(target)
        : '<i class="fa-solid fa-check"></i> Cukup centang';

      /* Halaman depan ruangnya cukup untuk penjelasan lengkap;
         kalau suatu kebiasaan belum punya `deskripsi`, turun ke
         teks satu baris `sub`. */
      var cerita = h.deskripsi || h.sub || '';

      return '<article class="show-card" style="--hc:' + h.color + '">' +
        '<div class="show-top">' +
          '<div class="show-ring">' +
            '<span class="show-no">' + h.no + '</span>' +
            '<div class="show-media">' +
              '<i class="' + h.icon + '"></i>' + foto +
            '</div>' +
          '</div>' +
          '<h3 class="show-title">' + J.esc(h.title) + '</h3>' +
        '</div>' +
        '<div class="show-body">' +
          '<p class="show-desc">' + J.esc(cerita) + '</p>' +
          '<span class="show-meta">' + meta + '</span>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  /* ---------- Ganti peran ---------- */
  document.querySelectorAll('.role-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      role = tab.dataset.role;
      document.querySelectorAll('.role-tab').forEach(function (t) {
        var aktif = t === tab;
        t.classList.toggle('active', aktif);
        t.setAttribute('aria-selected', aktif ? 'true' : 'false');
      });
      document.querySelectorAll('[data-panel]').forEach(function (p) {
        p.classList.toggle('hidden', p.dataset.panel !== role);
      });
      document.getElementById('loginError').classList.add('hidden');
      fokus();
    });
  });

  function fokus() {
    var id = { siswa: 'nis', guru: 'gUser', ortu: 'kode' }[role];
    var el = document.getElementById(id);
    if (el) setTimeout(function () { el.focus(); }, 60);
  }

  /* ---------- Lihat / sembunyikan sandi ---------- */
  document.querySelectorAll('[data-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var inp = document.getElementById(btn.dataset.toggle);
      var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      btn.innerHTML = '<i class="fa-solid ' + (show ? 'fa-eye-slash' : 'fa-eye') + '"></i>';
    });
  });

  /* ---------- Kirim form ---------- */
  var sedangLogin = false;
  document.getElementById('formLogin').addEventListener('submit', function (e) {
    e.preventDefault();
    if (sedangLogin) return;

    var err = document.getElementById('loginError');
    err.classList.add('hidden');

    if (!J.isConfigured()) {
      tampilkanError('Database belum terhubung. Isi URL Apps Script di assets/js/site-config.js dulu.');
      document.getElementById('setupCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    var btn = document.getElementById('btnLogin');
    var teksAsli = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch spin"></i> Memeriksa...';
    sedangLogin = true;

    var p;
    if (role === 'siswa') {
      var nis = document.getElementById('nis').value.trim();
      var panggilan = document.getElementById('pin').value.trim();
      if (!nis || !panggilan) { gagal('No. absen dan nama panggilan wajib diisi.'); return; }
      p = J.loginSiswa(nis, panggilan);
    } else if (role === 'guru') {
      var u = document.getElementById('gUser').value.trim();
      var pw = document.getElementById('gPass').value;
      if (!u || !pw) { gagal('Username dan password wajib diisi.'); return; }
      p = J.loginGuru(u, pw);
    } else {
      var k = document.getElementById('kode').value.trim();
      if (!k) { gagal('Kode akses wajib diisi.'); return; }
      p = J.loginOrtu(k);
    }

    p.then(function (r) {
      if (!r.ok) { gagal(r.msg || 'Gagal masuk.'); return; }
      btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Berhasil';
      var sesi = { role: r.role, waktu: new Date().toISOString() };
      if (r.role === 'guru') { sesi.guru = { user: r.guru.user, nama: r.guru.nama }; sesi.kelasAwal = ''; }
      if (r.role === 'siswa') sesi.siswa = { nis: r.siswa.nis, nama: r.siswa.nama, kelasId: r.siswa.kelasId };
      if (r.role === 'ortu') sesi.siswa = { nis: r.siswa.nis, nama: r.siswa.nama, kelasId: r.siswa.kelasId };
      J.simpanSesi(sesi);
      setTimeout(function () {
        location.href = r.role === 'guru' ? 'guru.html' : r.role === 'ortu' ? 'ortu.html' : 'murid.html';
      }, 420);
    });

    function gagal(pesan) {
      sedangLogin = false;
      btn.disabled = false;
      btn.innerHTML = teksAsli;
      tampilkanError(pesan);
      J.toast('Gagal masuk', pesan, 'err');
    }
  });

  function tampilkanError(pesan) {
    var err = document.getElementById('loginError');
    err.textContent = pesan;
    err.classList.remove('hidden');
  }

  /* ---------- Kartu setup ---------- */
  /* Pesan merah "Database belum terhubung" di dalam form harus ikut
     hilang begitu koneksi terbukti berhasil. Dulu hanya hilang saat
     form dikirim ulang, jadi setelah menekan "Sudah Diisi, Coba Lagi"
     dan koneksi berhasil, teks merahnya masih nempel di bawah form. */
  function sembunyikanError() {
    var err = document.getElementById('loginError');
    if (err) { err.textContent = ''; err.classList.add('hidden'); }
  }
  function perbaruiSetup() {
    var sudah = J.isConfigured();
    document.getElementById('setupCard').classList.toggle('hidden', sudah);
    document.getElementById('loginWrap').classList.toggle('hidden', !sudah);
    if (!sudah) {
      document.getElementById('setupRing').innerHTML =
        '<div class="ring" style="width:84px;height:84px">' +
        '<svg width="84" height="84"><circle cx="42" cy="42" r="36" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="8"/>' +
        '<text x="42" y="52" text-anchor="middle" font-size="30" fill="#E3C15C" font-family="serif" font-weight="700">7</text></svg></div>';
    }
  }

  document.getElementById('btnCekKoneksi').addEventListener('click', function () {
    J.scriptURL = J.siteScriptURL;
    if (!J.isConfigured()) {
      J.toast('URL masih kosong', 'Buka assets/js/site-config.js dan tempel URL /exec.', 'warn');
      return;
    }
    J.loadCache();
    J.syncAll(function (r) {
      if (r.ok) {
        perbaruiSetup();
        gambarKebiasaan();
        terapkanNamaApp(J.config.appName);
        sembunyikanError();
        J.toast('Terhubung', 'Database siap dipakai. Silakan masuk.', 'ok');
      } else {
        J.toast('Gagal terhubung', r.msg, 'err');
      }
    });
  });

  /* ---------- Init ---------- */
  gambarKebiasaan();
  perbaruiSetup();
  terapkanNamaApp(J.config.appName);

  if (J.isConfigured()) {
    J.syncAll(function (r) {
      perbaruiSetup();
      if (r.ok) {
        terapkanNamaApp(J.config.appName);
        gambarKebiasaan();
        sembunyikanError();
      } else {
        J.toast('Database belum terbaca', r.msg, 'warn');
      }
    });

    /* Sesi masih aktif? arahkan langsung ke halaman peran */
    var sesi = J.ambilSesi();
    if (sesi && sesi.role) {
      var navRole = document.getElementById('navRole');
      var label = { guru: 'Guru', siswa: 'Murid', ortu: 'Orang Tua' }[sesi.role] || '';
      document.getElementById('navRoleText').textContent = label;
      navRole.classList.remove('hidden');
    }
  }

  fokus();
})();