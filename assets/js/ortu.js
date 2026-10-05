/* ====
   Jurnal 7 Anak Indonesia Hebat — ortu.js
   ------------------------------------------------------------
   Halaman orang tua: hanya MEMBACA rekap anaknya.
   Tidak ada tombol ubah/hapus di halaman ini.
   ==== */
(function () {
  'use strict';

  var J = window.Jurnal;
  var H = window.HABITS7;

  var sesi = J.ambilSesi();
  var anak = null;
  var rentangHari = 7;

  /* ====
     1. GERBANG
     ==== */
  if (!sesi || (sesi.role !== 'ortu' && sesi.role !== 'siswa')) {
    document.body.innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">' +
      '<div class="card card-lg text-center" style="max-width:420px">' +
      '<div class="empty-icon"><i class="fa-solid fa-lock"></i></div>' +
      '<h2 style="font-size:20px;margin-bottom:8px">Halaman Orang Tua</h2>' +
      '<p class="text-sm text-muted">Masuk dengan Kode Akses yang diberikan guru sekolah.</p>' +
      '<a class="btn btn-primary btn-block mt-3" href="index.html"><i class="fa-solid fa-arrow-right-to-bracket"></i> Halaman Masuk</a>' +
      '</div></div>';
    return;
  }

  document.head.insertAdjacentHTML('beforeend', J.svgDefs());

  document.getElementById('btnLogout').addEventListener('click', function () {
    if (!confirm('Keluar dari halaman pantau?')) return;
    J.hapusSesi();
    location.href = 'index.html';
  });

  document.getElementById('btnSync').addEventListener('click', function () {
    var b = this;
    b.innerHTML = '<i class="fa-solid fa-circle-notch spin"></i>';
    J.syncAll(function (r) {
      b.innerHTML = '<i class="fa-solid fa-rotate"></i>';
      if (r.ok) { muatSemua(); sembunyikanStatus(); J.toast('Tersinkron', 'Data terbaru berhasil diambil.', 'ok'); }
      else J.toast('Gagal sinkron', r.msg, 'err');
    });
  });

  function tampilkanStatus(pesan, tipe) {
    var bar = document.getElementById('statusBar');
    bar.className = 'banner ' + (tipe || 'warn');
    document.getElementById('statusTeks').textContent = pesan;
    bar.classList.remove('hidden');
  }
  function sembunyikanStatus() { document.getElementById('statusBar').classList.add('hidden'); }

  /* ---------- Rentang ---------- */
  document.querySelectorAll('#chipRentang .chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      document.querySelectorAll('#chipRentang .chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      rentangHari = parseInt(chip.dataset.hari, 10);
      muatRekap();
    });
  });

  /* ====
     2. TAMPILKAN
     ==== */
  /* true setelah sinkron pertama selesai. Sebelum itu, "anak belum
     ketemu" hanya berarti belum ada di cache perangkat, bukan berarti
     kode aksesnya salah - jadi banner merah harus ditahan. */
  var sinkronSelesai = false;

  function muatSemua() {
    anak = J.getSiswa(sesi.siswa.nis, sesi.siswa.kelasId);
    if (!anak) {
      if (!sinkronSelesai) {
        document.getElementById('sapaan').textContent = 'Memuat data...';
        return;
      }
      document.getElementById('sapaan').textContent = 'Data anak tidak ditemukan';
      document.getElementById('subJudul').textContent = 'Minta guru kelas untuk memeriksa Kode Akses Anda.';
      tampilkanStatus('Data anak tidak ada di database. Hubungi guru.', 'danger');
      return;
    }
    var kelas = J.getKelas(anak.kelasId);
    /* Nama panggilan: pakai kolom "Nama Panggilan" yang diisi guru
       di sheet SISWA (mis. "Dary", "mikayla"). Dulu halaman ini
       selalu memakai kata pertama nama lengkap, sehingga ortu melihat
       "Gede" padahal anaknya dipanggil "Dary".
       Kalau kolom kosong, jatuh ke kata pertama nama. */
    var namaAnak = String(anak.nama || '').trim();
    var dipanggil = String(anak.panggilan || '').trim();
    if (!dipanggil) dipanggil = namaAnak.split(/\s+/)[0] || namaAnak;

    document.title = 'Pantau ' + dipanggil + ' - JEJAK 7 KAIH';
    document.getElementById('identitas').textContent =
      'Pantau Anak \u00b7 ' + namaAnak + ' - ' + (kelas ? kelas.nama : 'Tanpa kelas');
    document.getElementById('sapaan').textContent = 'Kemajuan ' + dipanggil;
    document.getElementById('subJudul').textContent =
      (kelas ? kelas.nama : '-') + ' &middot; No. absen ' + anak.nis + ' &middot; ' +
      rentangHari + ' hari terakhir';
    muatRekap();
  }

  function muatRekap() {
    if (!anak) return;
    var r = J.rekapSiswa(anak.nis, rentangHari, anak.kelasId);

    document.getElementById('subJudul').innerHTML =
      J.esc((J.getKelas(anak.kelasId) || {}).nama || '-') + ' &middot; NIS ' + J.esc(anak.nis) +
      ' &middot; ' + rentangHari + ' hari terakhir';

    document.getElementById('hAktif').textContent = r.hariAktifJml;
    document.getElementById('hPoin').textContent = r.rataPoin;
    document.getElementById('hStreak').textContent = r.streak;

    var bangun = r.perHabit.find(function (p) { return p.key === 'bangun'; });
    document.getElementById('hBangun').textContent = bangun && bangun.rataWaktu ? bangun.rataWaktu : '-';

    /* Per kebiasaan */
    document.getElementById('rekapList').innerHTML = r.perHabit.map(function (p) {
      return '<div class="rekap-item">' +
        '<div class="ri-no" style="background:' + p.color + '">' + p.no + '</div>' +
        '<div class="ri-body"><div class="ri-title"><strong>' + J.esc(p.title) + '</strong>' +
        '<span>' + p.persen + '%</span></div>' +
        '<div class="progress thin"><i style="width:' + p.persen + '%;background:' + p.color + '"></i></div>' +
        '<div class="text-xs text-muted mt-1">' +
        (p.type === 'time' && p.rataWaktu ? (p.key === 'tidur' ? 'Rata-rata tidur' : 'Rata-rata bangun') + ' <b class="mono">' + p.rataWaktu + '</b> &middot; ' : '') +
        p.jumlah + ' dari ' + rentangHari + ' hari terisi</div></div></div>';
    }).join('');

    /* Heatmap */
    document.getElementById('heatmap').innerHTML = J.heatmap(r.harian, r.hariRentang);

    /* Grafik jam bangun */
    var data = r.hariRentang.slice(-10).map(function (d) {
      var e = J.entryOf(anak.nis, d, 'bangun', anak.kelasId);
      var m = e ? H.parseHM(e.nilai) : null;
      return {
        label: J.fmtTanggalPendek(d).slice(0, 5),
        value: m === null ? 0 : Math.max(0, 12 - m / 60),
        menit: m,
        warna: e ? 'gold' : ''
      };
    });
    document.getElementById('grafikBangun').innerHTML = data.some(function (d) { return d.menit !== null; })
      ? J.barChart(data, { max: 12, tampilkanNilai: false })
      : '<div class="empty"><div class="empty-icon"><i class="fa-solid fa-sun"></i></div>' +
        '<h4>Belum ada data jam bangun</h4><p>Data akan muncul setelah anak mengisi jurnal.</p></div>';

    /* Lencana */
    var sudah = {};
    r.lencana.forEach(function (l) { sudah[l.key] = true; });
    document.getElementById('lencanaGrid').innerHTML = H.lencana.map(function (l) {
      var dapat = !!sudah[l.key];
      return '<div class="lencana' + (dapat ? '' : ' locked') + '" title="' + J.esc(l.desc) + '">' +
        '<i class="' + l.icon + '"></i><span>' + (dapat ? l.label : 'Terkunci') + '</span></div>';
    }).join('');

    /* Riwayat */
    var hariAda = Object.keys(r.harian).sort().reverse().slice(0, 7);
    document.getElementById('riwayatList').innerHTML = hariAda.length ? hariAda.map(function (d) {
      var hr = r.harian[d];
      var chips = Object.keys(hr.byKey).sort(function (a, b) {
        return H.noOf(a) - H.noOf(b);
      }).map(function (k) {
        var h = H.safe(k);
        return '<span class="badge badge-soft" title="' + J.esc(h.title) + '">' +
          '<i class="' + h.icon + '" style="color:' + h.color + '"></i>' +
          J.esc(H.ringkas(k, hr.byKey[k].nilai)) + '</span>';
      }).join('');
      return '<div class="list-row">' +
        '<div class="list-avatar"><i class="fa-solid fa-calendar-day"></i></div>' +
        '<div class="list-main"><h4>' + J.esc(J.fmtHari(d)) + ', ' + J.esc(J.fmtTanggal(d)) + '</h4>' +
        '<p>' + hr.jumlah + ' dari ' + H.total() + ' kebiasaan &middot; poin ' + hr.poin + '</p>' +
        '<div class="flex gap-1 flex-wrap mt-1">' + chips + '</div></div>' +
        '<div style="flex-shrink:0">' + J.ring(hr.poin, 52, 6) + '</div></div>';
    }).join('') : '<div class="empty"><div class="empty-icon"><i class="fa-solid fa-book-open"></i></div>' +
      '<h4>Belum ada jurnal</h4><p>Anak belum mengisi jurnal. Ingatkan untuk mengisi setiap hari.</p></div>';

    /* Catatan guru */
    muatCatatan();
  }

  function muatCatatan() {
    var catatan = J.catatanUntuk(anak.nis, anak.kelasId);
    var card = document.getElementById('cardCatatan');
    if (!catatan.length) { card.style.display = 'none'; return; }
    card.style.display = '';
    document.getElementById('catatanList').innerHTML = catatan.map(function (n) {
      return '<div class="note-card' + (n.jenis === 'pujian' ? ' note-gold' : '') + '">' +
        '<div class="nc-meta"><i class="fa-solid fa-user-tie"></i>' + J.esc(n.guru || 'Guru') +
        ' &middot; ' + J.esc(J.fmtTanggal(n.tanggal || '')) + '</div>' +
        '<p>' + J.esc(n.isi) + '</p></div>';
    }).join('');
  }

  /* ====
     3. INIT
     ==== */
  if (!J.isConfigured()) {
    tampilkanStatus('Database belum terhubung. Hubungi guru sekolah.', 'danger');
    return;
  }

  /* Tampilkan dulu dari cache lokal -&gt; tampilkan dulu, lalu sinkron */
  if (J.state.students.length) muatSemua();
  else document.getElementById('sapaan').textContent = 'Memuat data...';

  J.syncAll(function (r) {
    sinkronSelesai = true;
    if (!r.ok) {
      if (!J.state.students.length) {
        document.getElementById('sapaan').textContent = 'Gagal memuat data';
        tampilkanStatus('Database belum terbaca: ' + r.msg, 'danger');
      } else {
        tampilkanStatus('Menampilkan data dari cache perangkat. ' + r.msg, 'warn');
      }
      return;
    }
    muatSemua();
    /* Sambol status dibersihkan begitu sinkron pertama berhasil,
       supaya bar merah "belum terhubung" tidak nempel di layar
       padahal database sudah nyambung. */
    sembunyikanStatus();
    J.mulaiAutoSync(function () { muatSemua(); });
  });
})();