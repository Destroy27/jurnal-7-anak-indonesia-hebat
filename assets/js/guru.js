/* ============================================================
   Jurnal 7 Anak Indonesia Hebat — guru.js
   ------------------------------------------------------------
   Panel guru: dashboard rekap kelas, kelola siswa & kelas,
   catatan untuk siswa, pengaturan aplikasi.
   ============================================================ */
(function () {
  'use strict';

  var J = window.Jurnal;
  var H = window.HABITS7;

  var sesi = J.ambilSesi();
  var kelasAktif = '';
  var rentangHari = 14;
  var sinkronTerakhir = '-';

  /* ============================================================
     1. GERBANG
     ============================================================ */
  if (!sesi || sesi.role !== 'guru') {
    document.body.innerHTML =
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">' +
      '<div class="card card-lg text-center" style="max-width:420px">' +
      '<div class="empty-icon"><i class="fa-solid fa-lock"></i></div>' +
      '<h2 style="font-size:20px;margin-bottom:8px">Area Guru</h2>' +
      '<p class="text-sm text-muted">Halaman ini hanya untuk guru. Silakan masuk terlebih dahulu.</p>' +
      '<a class="btn btn-primary btn-block mt-3" href="index.html"><i class="fa-solid fa-arrow-right-to-bracket"></i> Halaman Masuk</a>' +
      '</div></div>';
    return;
  }

  document.head.insertAdjacentHTML('beforeend', J.svgDefs());
  document.getElementById('namaGuru').textContent = sesi.guru ? sesi.guru.nama || sesi.guru.user : 'Guru';
  document.getElementById('identitas').textContent = 'Panel Guru - ' + (J.config.appName || 'Jurnal 7 Anak Indonesia Hebat');

  /* ============================================================
     2. TAB
     ============================================================ */
  document.querySelectorAll('#tabs .tab').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('#tabs .tab').forEach(function (x) { x.classList.remove('active'); });
      t.classList.add('active');
      var nama = t.dataset.tab;
      ['dashboard', 'kelas', 'catatan', 'pengaturan'].forEach(function (n) {
        document.getElementById('tab-' + n).classList.toggle('hidden', n !== nama);
      });
      if (nama === 'kelas') muatTabelSiswa();
      if (nama === 'catatan') muatDaftarCatatan();
      if (nama === 'pengaturan') muatPengaturan();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.getElementById('btnLogout').addEventListener('click', function () {
    if (!confirm('Keluar dari Panel Guru?')) return;
    J.hapusSesi();
    location.href = 'index.html';
  });
  document.getElementById('btnSync').addEventListener('click', function () {
    var b = this;
    b.innerHTML = '<i class="fa-solid fa-circle-notch spin"></i>';
    J.syncAll(function (r) {
      b.innerHTML = '<i class="fa-solid fa-rotate"></i>';
      if (r.ok) { gambarSemua(); sembunyikanStatus(); J.toast('Tersinkron', 'Data terbaru berhasil diambil.', 'ok'); }
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

  /* ============================================================
     3. PILIH KELAS
     ============================================================ */
  function gambarKelas() {
    var picker = document.getElementById('classPicker');
    var list = J.classes;
    if (!list.length) {
      picker.innerHTML = '<div class="empty"><div class="empty-icon"><i class="fa-solid fa-school"></i></div>' +
        '<h4>Belum ada kelas</h4><p>Klik tombol "Kelas Baru" untuk membuat kelas pertama.</p></div>';
      return;
    }
    if (!kelasAktif || !J.getKelas(kelasAktif)) {
      kelasAktif = list[0].id;
      try { localStorage.setItem(J.KEYS.kelas, kelasAktif); } catch (e) {}
    }
    picker.innerHTML = list.map(function (k) {
      var jml = J.getSiswaKelas(k.id).length;
      return '<button class="class-card' + (k.id === kelasAktif ? ' active' : '') + '" data-kelas="' + J.esc(k.id) + '">' +
        '<strong>' + J.esc(k.nama) + '</strong>' +
        '<span>' + jml + ' siswa</span></button>';
    }).join('');

    picker.querySelectorAll('.class-card').forEach(function (b) {
      b.addEventListener('click', function () {
        kelasAktif = b.dataset.kelas;
        try { localStorage.setItem(J.KEYS.kelas, kelasAktif); } catch (e) {}
        gambarKelas();
        gambarDashboard();
        muatTabelSiswa();
        muatSelectSiswa();
      });
    });
  }

  document.getElementById('btnTambahKelas').addEventListener('click', function () {
    J.modal({
      judul: 'Kelas Baru',
      isi:
        '<div class="field"><label for="nkNama">Nama Kelas <span class="req">*</span></label>' +
        '<input class="input" id="nkNama" type="text" placeholder="contoh: 4A" maxlength="30"></div>' +
        '<div class="field mt-2"><label for="nkWali">Nama Wali Kelas</label>' +
        '<input class="input" id="nkWali" type="text" placeholder="contoh: Bu Sri" maxlength="40"></div>' +
        '<div class="banner banner-info mt-3" style="font-size:12px"><i class="fa-solid fa-circle-info"></i>' +
        '<span>Kelas bisa dipakai ulang setiap tahun. Rename kapan saja tanpa kehilangan data.</span></div>',
      footer: '<button class="btn btn-ghost" data-tutup>Batal</button>' +
        '<button class="btn btn-primary" id="nkSimpan"><i class="fa-solid fa-check"></i> Buat Kelas</button>'
    });
    document.getElementById('nkSimpan').addEventListener('click', function () {
      var nama = document.getElementById('nkNama').value.trim();
      if (!nama) { J.toast('Nama kelas wajib diisi', '', 'warn'); return; }
      var wali = document.getElementById('nkWali').value.trim();
      var cfg = JSON.parse(JSON.stringify(J.config));
      cfg.classes = cfg.classes || [];
      var id = 'k' + Date.now().toString(36);
      cfg.classes.push({ id: id, nama: nama, wali: wali });
      J.tutupModal();
      J.simpanConfig(cfg, function (r) {
        if (r.ok) { kelasAktif = id; gambarSemua(); J.toast('Kelas dibuat', 'Kelas "' + nama + '" siap diisi siswa.', 'ok'); }
        else J.toast('Gagal', r.msg, 'err');
      });
    });
  });

  /* ============================================================
     4. DASHBOARD REKAP
     ============================================================ */
  function gambarDashboard() {
    var wrap = document.getElementById('isiDashboard');
    if (!kelasAktif) { wrap.innerHTML = ''; return; }

    var r = J.rekapKelas(kelasAktif, rentangHari);
    var k = r.kelas;
    var s = r.statistik;
    var hariIni = J.todayISO();

    var html = '';

    /* Judul + alat */
    html += '<div class="print-head"><h2>Rekap Jurnal - ' + J.esc(k ? k.nama : '') + '</h2>' +
      '<p>' + J.esc(J.fmtTanggal(hariIni)) + ' - ' + rentangHari + ' hari terakhir</p></div>';

    html += '<div class="card anim-in anim-in-1" style="margin-bottom:16px">' +
      '<div class="card-head"><div><h2>Rekap Kelas ' + J.esc(k ? k.nama : '') + '</h2>' +
      '<p>' + rentangHari + ' hari terakhir &middot; ' + J.esc(k ? k.nama : '') +
      (k && k.wali ? ' &middot; Wali: ' + J.esc(k.wali) : '') + '</p></div>' +
      '<div class="flex gap-1 flex-wrap no-print">' +
      '<div class="chip-row">' +
      [7, 14, 30].map(function (n) {
        return '<button class="chip' + (n === rentangHari ? ' active' : '') + '" data-rata="' + n + '">' + n + ' Hari</button>';
      }).join('') + '</div>' +
      '<button class="btn btn-ghost btn-sm" id="btnCetak"><i class="fa-solid fa-print"></i> Cetak</button>' +
      '<button class="btn btn-ghost btn-sm" id="btnCsv"><i class="fa-solid fa-file-csv"></i> CSV</button>' +
      '</div></div>';

    /* Statistik */
    html += '<div class="grid grid-4" style="margin-bottom:20px">' +
      '<div class="stat"><div class="stat-icon"><i class="fa-solid fa-users"></i></div>' +
      '<div class="stat-value">' + s.total + '</div><div class="stat-label">Siswa</div>' +
      '<div class="stat-hint">' + s.aktif + ' aktif journaling</div></div>' +

      '<div class="stat gold"><div class="stat-icon"><i class="fa-solid fa-star"></i></div>' +
      '<div class="stat-value">' + s.rataKelas + '</div><div class="stat-label">Rata-rata Kelas</div>' +
      '<div class="stat-hint">' + (s.rataKelasDari
        ? 'dari ' + s.rataKelasDari + ' siswa yang mengisi'
        : 'belum ada siswa yang mengisi') + '</div></div>' +

      '<div class="stat green"><div class="stat-icon"><i class="fa-solid fa-calendar-check"></i></div>' +
      '<div class="stat-value">' + s.persenHariIni + '%</div><div class="stat-label">Terisi Hari Ini</div>' +
      '<div class="stat-hint">' + s.isiHariIni + ' dari ' + s.total + ' siswa</div></div>' +

      '<div class="stat"><div class="stat-icon"><i class="fa-solid fa-fire"></i></div>' +
      '<div class="stat-value">' + s.streakTertinggi + '</div><div class="stat-label">Streak Tertinggi</div>' +
      '<div class="stat-hint">hari beruntun</div></div>' +
      '</div>';

    /* Peringatan siswa perlu bantuan */
    if (s.perluBantu.length && s.total > 0) {
      html += '<div class="banner banner-warn mb-3">' +
        '<i class="fa-solid fa-triangle-exclamation"></i>' +
        '<span><b>' + s.perluBantu.length + ' siswa</b> belum mengisi jurnal (maksimal 1 hari dalam ' +
        rentangHari + ' hari terakhir): ' +
        s.perluBantu.slice(0, 6).map(function (b) { return J.esc(b.nama); }).join(', ') +
        (s.perluBantu.length > 6 ? ', dan lainnya' : '') + '.</span></div>';
    }

    html += '</div>';

    /* Grafik kelas per kebiasaan */
    html += '<div class="card anim-in anim-in-2" style="margin-bottom:16px">' +
      '<div class="card-head"><div><h3>Kelengkapan Kelas per Kebiasaan</h3>' +
      '<p>Rata-rata dari seluruh siswa di kelas ini.</p></div></div>' +
      '<div class="rekap-list" id="rekapKelasList"></div></div>';

    /* Tabel matrix siswa x hari */
    html += '<div class="card anim-in anim-in-3">' +
      '<div class="card-head"><div><h3>Rekap Per Siswa</h3>' +
      '<p>Klik nama siswa untuk melihat rincian & memberi catatan.</p></div></div>' +
      '<div class="table-wrap"><table class="table table-clickable"><thead><tr>' +
      '<th style="min-width:190px">Siswa</th>' +
      r.hariRentang.map(function (d) {
        return '<th style="text-align:center" title="' + J.esc(J.fmtHari(d) + ' ' + J.fmtTanggal(d)) + '">' +
          J.pad2(J.fromISO(d).getDate()) + '</th>';
      }).join('') +
      '<th style="text-align:center">Hari</th><th style="min-width:120px">Kelengkapan</th>' +
      '<th style="text-align:center">Poin</th><th style="text-align:center">Beruntun</th>' +
      '<th style="text-align:center">Bangun</th>' +
      '</tr></thead><tbody>';

    if (!r.baris.length) {
      html += '<tr><td colspan="' + (r.hariRentang.length + 7) + '">' +
        '<div class="empty"><div class="empty-icon"><i class="fa-solid fa-users-slash"></i></div>' +
        '<h4>Belum ada siswa</h4><p>Tambahkan siswa di tab "Kelas &amp; Siswa".</p></div></td></tr>';
    }

    r.baris.forEach(function (b) {
      var build = J.entryOf(b.nis, hariIni, 'bangun');
      html += '<tr data-nis="' + J.esc(b.nis) + '">' +
        '<td><div class="siswa-cell"><div class="av">' + J.esc(J.inisial(b.nama)) + '</div>' +
        '<div class="info"><strong>' + J.esc(b.nama) + '</strong><span>' + J.esc(b.nis) + '</span></div></div></td>' +
        b.hariRentang.map(function (d) {
          var hr = b.harian[d];
          var jml = hr ? hr.jumlah : 0;
          var lv = H.levelDariJumlah(jml);
          var judul = J.fmtHari(d) + ' ' + J.fmtTanggalPendek(d) + ': ' + jml + '/' + H.total();
          return '<td style="text-align:center"><span class="matrix-cell lv' + lv + (d === hariIni ? ' today' : '') +
            '" title="' + J.esc(judul) + '">' + jml + '</span></td>';
        }).join('') +
        '<td style="text-align:center;font-family:var(--mono);font-weight:700">' + b.hariAktif + '</td>' +
        '<td><div class="progress-row"><div class="progress"><i style="width:' + b.kelengkapan + '%"></i></div>' +
        '<span class="pct">' + b.kelengkapan + '%</span></div></td>' +
        '<td style="text-align:center"><span class="badge ' +
        (b.poin >= 70 ? 'badge-success' : b.poin >= 40 ? 'badge-warning' : 'badge-danger') + '">' + b.poin + '</span></td>' +
        '<td style="text-align:center">' + (b.streak > 0
          ? '<span class="badge badge-gold"><i class="fa-solid fa-fire"></i> ' + b.streak + '</span>'
          : '<span class="text-muted">-</span>') + '</td>' +
        '<td style="text-align:center;font-family:var(--mono);font-size:12px">' +
        (build ? J.esc(build.nilai) : '<span class="text-muted">-</span>') + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div></div>';

    wrap.innerHTML = html;

    /* Grafik per kebiasaan kelas */
    var per = H.list.map(function (h) {
      var terisi = 0, jml = 0;
      r.baris.forEach(function (b) {
        var rows = J.entriesOf(b.nis).filter(function (e) {
          return e.kode === h.key && b.hariRentang.indexOf(e.tanggal) !== -1;
        });
        if (rows.length) {
          terisi++;
          jml += H.scoreEntry(h.key, rows[rows.length - 1].nilai);
        }
      });
      var persen = s.total ? Math.round((terisi / (s.total * rentangHari)) * 100) : 0;
      return {
        key: h.key, no: h.no, title: h.title, color: h.color,
        persen: persen,
        poin: terisi ? Math.round(jml / terisi) : 0
      };
    });
    document.getElementById('rekapKelasList').innerHTML = per.map(function (p) {
      return '<div class="rekap-item">' +
        '<div class="ri-no" style="background:' + p.color + '">' + p.no + '</div>' +
        '<div class="ri-body"><div class="ri-title"><strong>' + J.esc(p.title) + '</strong>' +
        '<span>' + p.persen + '% &middot; ' + p.poin + ' poin</span></div>' +
        '<div class="progress thin"><i style="width:' + p.persen + '%;background:' + p.color + '"></i></div></div></div>';
    }).join('');

    /* Event */
    wrap.querySelectorAll('[data-rata]').forEach(function (b) {
      b.addEventListener('click', function () { rentangHari = parseInt(b.dataset.rata, 10); gambarDashboard(); });
    });
    wrap.querySelectorAll('tbody tr[data-nis]').forEach(function (tr) {
      tr.addEventListener('click', function () { detailSiswa(tr.dataset.nis); });
    });
    var bc = document.getElementById('btnCetak');
    if (bc) bc.addEventListener('click', function () { window.print(); });
    var bs = document.getElementById('btnCsv');
    if (bs) bs.addEventListener('click', eksporCsv);
  }

  /* ---------- Ekspor CSV ---------- */
  function eksporCsv() {
    var r = J.rekapKelas(kelasAktif, rentangHari);
    var head = ['No. Absen', 'Nama', 'Poin', 'Kelengkapan (%)', 'Hari Terisi', 'Streak', 'Jam Bangun Terakhir'];
    H.list.forEach(function (h) { head.push(h.no + '. ' + h.title); });
    var rows = [head];
    r.baris.forEach(function (b) {
      var row = [b.nis, b.nama, b.poin, b.kelengkapan, b.hariAktif, b.streak];
      var eb = J.entriesOf(b.nis).filter(function (e) { return e.kode === 'bangun'; })
        .sort(function (a, c) { return String(c.tanggal).localeCompare(String(a.tanggal)); });
      row.push(eb.length ? eb[0].nilai : '');
      H.list.forEach(function (h) {
        var semua = J.entriesOf(b.nis).filter(function (e) {
          return e.kode === h.key && b.hariRentang.indexOf(e.tanggal) !== -1;
        });
        var n = semua.length;
        row.push(n + '/' + rentangHari);
      });
      rows.push(row);
    });
    J.exportCSV(rows, 'rekap-jurnal-' + (r.kelas ? r.kelas.nama : 'kelas') + '-' + rentangHari + 'hari.csv');
    J.toast('CSV diunduh', 'Buka di Excel atau Google Sheets.', 'ok');
  }

  /* ============================================================
     5. DETAIL SISWA (modal)
     ============================================================ */
  function detailSiswa(nis) {
    var s = J.getSiswa(nis);
    if (!s) return;
    var r = J.rekapSiswa(nis, rentangHari);
    var kelas = J.getKelas(s.kelasId);
    var hariIni = J.todayISO();

    var isi =
      '<div class="siswa-detail-head">' +
      '<div class="av">' + J.esc(J.inisial(s.nama)) + '</div>' +
      '<div><h3>' + J.esc(s.nama) + '</h3>' +
      '<p>' + J.esc(kelas ? kelas.nama : '-') + ' &middot; No. absen ' + J.esc(s.nis) +
      ' &middot; nama panggilan "' + J.esc(s.panggilan || '-') + '"</p></div>' +
      '<div class="mini-stats">' +
      '<div><strong>' + r.rataPoin + '</strong><span>Poin</span></div>' +
      '<div><strong>' + r.kelengkapan + '%</strong><span>Kelengkapan</span></div>' +
      '<div><strong>' + r.streak + '</strong><span>Beruntun</span></div>' +
      '</div></div>';

    /* Kelengkapan per kebiasaan */
    isi += '<h4 style="font-family:var(--font);font-size:14px;margin-bottom:12px">Per Kebiasaan (' + rentangHari + ' hari)</h4>';
    isi += '<div class="rekap-list mb-3">' + r.perHabit.map(function (p) {
      return '<div class="rekap-item"><div class="ri-no" style="background:' + p.color + '">' + p.no + '</div>' +
        '<div class="ri-body"><div class="ri-title"><strong>' + J.esc(p.title) + '</strong>' +
        '<span>' + p.persen + '%' + (p.rataWaktu ? ' - ' + p.rataWaktu : '') + '</span></div>' +
        '<div class="progress thin"><i style="width:' + p.persen + '%;background:' + p.color + '"></i></div></div></div>';
    }).join('') + '</div>';

    /* Catatan sekolah */
    var catatan = J.catatanUntuk(nis);
    isi += '<div class="rule-gold mb-3"></div>' +
      '<div class="flex justify-between items-center gap-2 mb-2" style="flex-wrap:wrap">' +
      '<h4 style="font-family:var(--font);font-size:14px">Catatan (' + catatan.length + ')</h4>' +
      '<button class="btn btn-soft btn-sm" id="dTambahCatatan"><i class="fa-solid fa-plus"></i> Tambah Catatan</button></div>';
    isi += '<div id="dCatatan" class="mb-3">' + (catatan.length ? catatan.map(function (n) {
      return '<div class="note-card' + (n.jenis === 'pujian' ? ' note-gold' : '') + '">' +
        '<div class="nc-meta"><i class="fa-solid fa-user-tie"></i>' + J.esc(n.guru || 'Guru') +
        ' &middot; ' + J.esc(J.fmtTanggal(n.tanggal || '')) + '</div><p>' + J.esc(n.isi) + '</p></div>';
    }).join('') : '<p class="text-sm text-muted">Belum ada catatan.</p>') + '</div>';

    /* Riwayat harian + hapus */
    isi += '<div class="rule-gold mb-3"></div>' +
      '<h4 style="font-family:var(--font);font-size:14px;margin-bottom:10px">Riwayat harian (klik untuk hapus)</h4>';
    var hariAda = Object.keys(r.harian).sort().reverse().slice(0, 14);
    isi += '<div id="dRiwayat">' + (hariAda.length ? hariAda.map(function (d) {
      var hr = r.harian[d];
      var baris = Object.keys(hr.byKey).sort(function (a, b) { return H.noOf(a) - H.noOf(b); }).map(function (k) {
        var h = H.safe(k);
        return '<div class="list-row" style="padding:8px 0">' +
          '<div class="ri-no" style="background:' + h.color + ';width:28px;height:28px;font-size:11px">' + h.no + '</div>' +
          '<div class="list-main"><h4 style="font-size:13px">' + J.esc(h.title) + '</h4>' +
          '<p>' + J.esc(H.ringkas(k, hr.byKey[k].nilai)) +
          (hr.byKey[k].catatan ? ' - "' + J.esc(hr.byKey[k].catatan) + '"' : '') + '</p></div>' +
          '<button class="btn btn-danger btn-icon" data-hapus="' + J.esc(k) + '" data-tanggal="' + J.esc(d) +
          '" title="Hapus isian ini"><i class="fa-solid fa-trash"></i></button></div>';
      }).join('');
      return '<details style="margin-bottom:6px"' + (d === hariAda[0] ? ' open' : '') + '>' +
        '<summary style="cursor:pointer;font-size:13px;font-weight:700;padding:8px 0;color:var(--maroon-700)">' +
        J.esc(J.fmtHari(d)) + ', ' + J.esc(J.fmtTanggal(d)) +
        ' <span class="badge badge-soft">' + hr.jumlah + '/' + H.total() + '</span></summary>' + baris + '</details>';
    }).join('') : '<p class="text-sm text-muted">Belum ada jurnal.</p>') + '</div>';

    J.modal({
      judul: 'Rincian ' + s.nama,
      lebar: true,
      isi: isi,
      footer:
        '<button class="btn btn-ghost" data-tutup>Tutup</button>' +
        '<button class="btn btn-danger btn-sm" id="dReset"><i class="fa-solid fa-eraser"></i> Hapus Semua Jurnal Murid Ini</button>'
    });

    /* Event di dalam modal */
    document.getElementById('dRiwayat').addEventListener('click', function (e) {
      var b = e.target.closest('[data-hapus]');
      if (!b) return;
      if (!confirm('Hapus isian "' + H.safe(b.dataset.hapus).title + '" tanggal ' + J.fmtTanggal(b.dataset.tanggal) + '?')) return;
      J.hapusEntry(s.kelasId, s.nis, b.dataset.tanggal, b.dataset.hapus, function (r) {
        if (r.ok) { J.tutupModal(); gambarDashboard(); muatTabelSiswa(); J.toast('Isian dihapus', '', 'ok'); }
        else J.toast('Gagal hapus', r.msg, 'err');
      });
    });

    document.getElementById('dTambahCatatan').addEventListener('click', function () {
      var teks = prompt('Tulis catatan untuk ' + s.nama + ':');
      if (!teks || !teks.trim()) return;
      var jenis = confirm('Klik OK untuk menandai sebagai \'Apresiasi / Pujian\'. Klik Batal untuk catatan biasa.');
      simpanCatatan(s.nis, jenis ? 'pujian' : 'catatan', teks.trim());
    });

    document.getElementById('dReset').addEventListener('click', function () {
      if (!confirm('Hapus SEMUA jurnal ' + s.nama + '? Tindakan ini tidak bisa dibatalkan.')) return;
      var hari = Object.keys(r.harian);
      var n = 0;
      hari.forEach(function (d) {
        Object.keys(r.harian[d].byKey).forEach(function (k) {
          J.hapusEntry(s.kelasId, s.nis, d, k);
          n++;
        });
      });
      setTimeout(function () {
        J.syncAll(function () {
          J.tutupModal();
          gambarDashboard();
          muatTabelSiswa();
          J.toast('Jurnal dihapus', n + ' isian dari ' + s.nama + ' sudah dihapus.', 'ok');
        });
      }, 2500);
    });
  }

  /* ============================================================
     6. TAB KELAS & SISWA
     ============================================================ */
  function muatTabelSiswa() {
    var tbody = document.getElementById('tabelSiswa');
    var k = J.getKelas(kelasAktif);
    document.getElementById('subKelas').textContent = k
      ? 'Kelas ' + k.nama + ' - ' + J.getSiswaKelas(kelasAktif).length + ' siswa terdaftar'
      : 'Pilih kelas di tab Dashboard dulu.';

    if (!k) { tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center">Belum ada kelas dipilih.</td></tr>'; return; }

    var siswa = J.getSiswaKelas(kelasAktif);
    if (!siswa.length) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty"><div class="empty-icon"><i class="fa-solid fa-user-plus"></i></div>' +
        '<h4>Belum ada siswa</h4><p>Gunakan "Tambah Siswa" atau tempel daftar sekaligus.</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = siswa.map(function (s) {
      var r = J.rekapSiswa(s.nis, 14);
      return '<tr>' +
        '<td><div class="siswa-cell"><div class="av">' + J.esc(J.inisial(s.nama)) + '</div>' +
        '<div class="info"><strong>' + J.esc(s.nama) + '</strong><span>No. absen ' + J.esc(s.nis) + '</span></div></div></td>' +
        '<td class="num mono">' + J.esc(s.nis) + '</td>' +
        '<td class="num"><b class="mono pw-terlihat">' + J.esc(s.panggilan || '-') + '</b></td>' +
        '<td class="num mono">' + J.esc(s.kodeOrtu || '-') + '</td>' +
        '<td><div class="progress-row"><div class="progress thin"><i style="width:' + r.kelengkapan + '%"></i></div>' +
        '<span class="pct">' + r.kelengkapan + '%</span></div></td>' +
        '<td class="text-right nowrap">' +
        '<button class="btn btn-ghost btn-icon" data-edit="' + J.esc(s.nis) + '" title="Edit"><i class="fa-solid fa-pen"></i></button> ' +
        '<button class="btn btn-ghost btn-icon" data-lihat="' + J.esc(s.nis) + '" title="Lihat rekap"><i class="fa-solid fa-eye"></i></button> ' +
        '<button class="btn btn-danger btn-icon" data-hapus="' + J.esc(s.nis) + '" title="Hapus"><i class="fa-solid fa-trash"></i></button>' +
        '</td></tr>';
    }).join('');

    tbody.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { formSiswa(b.dataset.edit); });
    });
    tbody.querySelectorAll('[data-lihat]').forEach(function (b) {
      b.addEventListener('click', function () { detailSiswa(b.dataset.lihat); });
    });
    tbody.querySelectorAll('[data-hapus]').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = J.getSiswa(b.dataset.hapus);
        if (!confirm('Hapus siswa ' + s.nama + ' beserta jurnal dan kode orang tuanya?')) return;
        var lain = J.getSiswaKelas(kelasAktif).filter(function (x) { return x.nis !== s.nis; });
        J.simpanSiswa(kelasAktif, lain, function (r) {
          if (r.ok) { muatTabelSiswa(); gambarKelas(); gambarDashboard(); J.toast('Siswa dihapus', '', 'ok'); }
          else J.toast('Gagal', r.msg, 'err');
        });
      });
    });
  }

  /* ---------- Form siswa ---------- */
  var KODE_AWAL = 'ORTU-';
  function kodeOtomatis() {
    var huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    var s = '';
    for (var i = 0; i < 4; i++) s += huruf[Math.floor(Math.random() * huruf.length)];
    return KODE_AWAL + s;
  }
  /* Nomor absen berikutnya, mengikuti gaya nomor yang sudah dipakai
     kelas ini. Ada dua gaya yang lazim:
       - "siswa01, siswa02, ..."  -> dari nomor urut
       - "1331, 1332, ..."         -> dari No. Induk sekolah
     Kalau tidak ada pola yang dikenali, jatuh ke siswa01. */
  function absenBerikutnya() {
    var list = J.getSiswaKelas(kelasAktif);
    var max = 0, dipakai = {}, gaya = null;
    list.forEach(function (s) {
      var n = String(s.nis || '').trim();
      if (!n) return;
      dipakai[n.toLowerCase()] = true;
      if (/^\d+$/.test(n)) {
        gaya = 'angka';
        max = Math.max(max, parseInt(n, 10));
      } else {
        var m = n.toLowerCase().match(/^siswa\s*[-_]?\s*(\d+)$/);
        if (m) { gaya = 'siswa'; max = Math.max(max, parseInt(m[1], 10)); }
      }
    });

    if (gaya === 'angka') {
      var a = max + 1;
      while (dipakai[String(a)]) a++;
      return String(a);
    }
    if (gaya === 'siswa') {
      var s = max + 1;
      while (s < 1000 && dipakai['siswa' + ('0' + s).slice(-2)]) s++;
      return 'siswa' + ('0' + s).slice(-2);
    }
    var baru = 1;
    while (baru < 1000 && dipakai['siswa' + ('0' + baru).slice(-2)]) baru++;
    return 'siswa' + ('0' + baru).slice(-2);
  }

  /* Nama panggilan dicadangkan dari kata pertama nama lengkap */
  function panggilanDariNama(nama) {
    var kata = String(nama || '').trim().split(/\s+/)[0] || '';
    return kata.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  }

  function formSiswa(nisLama) {
    var lama = nisLama ? J.getSiswa(nisLama) : null;
    var kode = lama ? lama.kodeOrtu : kodeOtomatis();

    J.modal({
      judul: lama ? 'Edit Siswa' : 'Tambah Siswa',
      isi:
        '<div class="grid grid-2" style="gap:14px">' +
        '<div class="field"><label>Nama Lengkap <span class="req">*</span></label>' +
        '<input class="input" id="fsNama" type="text" maxlength="40" value="' + J.esc(lama ? lama.nama : '') + '"></div>' +
        '<div class="field"><label>No. Absen <span class="req">*</span></label>' +
        '<input class="input mono" id="fsNis" type="text" maxlength="20" value="' +
        J.esc(lama ? lama.nis : absenBerikutnya()) + '"' +
        (lama ? ' disabled' : '') + '>' +
        (lama ? '' : '<button type="button" class="btn btn-ghost btn-xs" id="fsAbsenBaru" style="margin-top:6px">' +
          '<i class="fa-solid fa-rotate"></i> Nomor berikutnya</button>') + '</div>' +
        '<div class="field"><label>Nama Panggilan (sandi login) <span class="req">*</span></label>' +
        '<input class="input mono" id="fsPanggilan" type="text" maxlength="20" value="' +
        J.esc(lama ? lama.panggilan || '' : '') + '" placeholder="contoh: Adi"' +
        (lama ? ' autocomplete="off"' : ' autocomplete="off"') + '>' +
        '<span class="field-hint">Murid masuk memakai <b>No. Absen</b> + <b>Nama Panggilan</b> ini.</span></div>' +
        '<div class="field"><label>Kode Akses Orang Tua</label>' +
        '<input class="input mono" id="fsKode" type="text" maxlength="20" value="' + J.esc(kode) + '"></div>' +
        '</div>' +
        '<div class="banner banner-maroon mt-3" style="font-size:12px"><i class="fa-solid fa-circle-info"></i>' +
        '<span>Sampaikan <b>No. Absen</b> dan <b>Nama Panggilan</b> ke murid. Bila murid lupa, ' +
        'nama panggilan tetap terlihat di tabel ini &mdash; bisa dicetak lewat tombol ' +
        '<b>Unduh Template CSV</b> atau disalin lewat <b>Salin Daftar Login</b>.</span></div>',
      footer: '<button class="btn btn-ghost" data-tutup>Batal</button>' +
        '<button class="btn btn-primary" id="fsSimpan"><i class="fa-solid fa-check"></i> Simpan</button>'
    });

    if (!lama) {
      document.getElementById('fsKode').addEventListener('click', function () { this.value = kodeOtomatis(); });
      document.getElementById('fsAbsenBaru').addEventListener('click', function () { this.value = absenBerikutnya(); });

      /* Nama panggilan ikut terisi dari kata pertama nama, selama
         guru belum mengetiknya sendiri. */
      var isiPanggilan = document.getElementById('fsPanggilan');
      var diisiManual = false;
      isiPanggilan.addEventListener('input', function () { diisiManual = true; });
      document.getElementById('fsNama').addEventListener('input', function () {
        if (!diisiManual) isiPanggilan.value = panggilanDariNama(this.value);
      });
    }

    document.getElementById('fsSimpan').addEventListener('click', function () {
      var nama = document.getElementById('fsNama').value.trim();
      var nis = (lama ? lama.nis : document.getElementById('fsNis').value.trim());
      var panggilan = document.getElementById('fsPanggilan').value.trim();
      var ko = document.getElementById('fsKode').value.trim().toUpperCase();

      if (!nama) { J.toast('Nama wajib diisi', '', 'warn'); return; }
      if (!nis) { J.toast('No. absen wajib diisi', '', 'warn'); return; }
      if (!/^[a-zA-Z0-9._-]{1,20}$/.test(nis)) {
        J.toast('No. absen tidak valid', 'Gunakan huruf/angka saja, contoh: siswa01', 'warn'); return;
      }
      /* Edit: nama panggilan dikosongkan berarti tidak diubah */
      var panggilanFinal = panggilan;
      if (lama) {
        if (!panggilanFinal) panggilanFinal = lama.panggilan || '';
      } else if (!panggilanFinal) {
        panggilanFinal = panggilanDariNama(nama);
      }
      if (!panggilanFinal) {
        J.toast('Nama panggilan wajib diisi', 'Murid butuh ini untuk bisa masuk.', 'warn'); return;
      }
      if (panggilanFinal.length > 20) { J.toast('Nama panggilan maksimal 20 huruf', '', 'warn'); return; }

      var sudahAda = J.getSiswa(nis);
      if (sudahAda && (!lama || sudahAda.nis !== lama.nis)) {
        J.toast('No. absen sudah dipakai', 'No. absen ' + nis + ' dipakai ' + sudahAda.nama + '.', 'err');
        return;
      }
      var bentrokKode = J.state.students.some(function (x) {
        return String(x.kodeOrtu).toUpperCase() === ko && (!lama || x.nis !== lama.nis);
      });
      if (ko && bentrokKode) { J.toast('Kode sudah dipakai', 'Pilih kode lain untuk orang tua.', 'err'); return; }

      /* Nama panggilan disimpan polos (agar guru bisa membantu murid
         yang lupa) sekaligus sebagai hash SHA-256 untuk login. */
      var panggilanFinal = lama && !panggilan ? (lama.panggilan || '') : panggilan;
      var hashFinal = lama && panggilanFinal === (lama.panggilan || '') ? lama.pin : '';

      var tugas = hashFinal
        ? Promise.resolve(hashFinal)
        : J.sha256(panggilanFinal.toLowerCase()).then(function (hash) {
            if (!hash) throw new Error('Browser tidak mendukung SHA-256.');
            return hash;
          });

      tugas.then(function (hash) {
        var daftar = J.getSiswaKelas(kelasAktif).filter(function (x) { return x.nis !== nis; });
        if (lama) daftar = daftar.concat([{
          kelasId: lama.kelasId, nis: lama.nis, nama: nama,
          panggilan: panggilanFinal, pin: hash, kodeOrtu: ko
        }]);
        else daftar.push({
          kelasId: kelasAktif, nis: nis, nama: nama,
          panggilan: panggilanFinal, pin: hash, kodeOrtu: ko
        });

        J.simpanSiswa(kelasAktif, daftar, function (r) {
          if (r.ok) {
            J.tutupModal();
            muatTabelSiswa(); gambarKelas(); gambarDashboard();
            J.toast('Siswa disimpan',
              nama + ' - No. absen ' + nis + ', nama panggilan "' + panggilanFinal + '"' +
              (ko ? ' - Kode ortu ' + ko : ''), 'ok');
          } else J.toast('Gagal menyimpan', r.msg, 'err');
        });
      }).catch(function (e) { J.toast('Gagal menyimpan', e.message, 'err'); });
    });
  }

  document.getElementById('btnTambahSiswa').addEventListener('click', function () {
    if (!kelasAktif) { J.toast('Pilih kelas dulu', 'Klik salah satu kelas di tab Dashboard.', 'warn'); return; }
    formSiswa(null);
  });

  /* ---------- Tempel massal ---------- */
  document.getElementById('btnTempelSiswa').addEventListener('click', function () {
    if (!kelasAktif) { J.toast('Pilih kelas dulu', '', 'warn'); return; }
    J.modal({
      judul: 'Tempel Daftar Siswa Massal',
      isi:
        '<div class="banner banner-info mb-3" style="font-size:12.5px"><i class="fa-solid fa-circle-info"></i>' +
        '<span>Tempel daftar dari Excel atau Google Sheets. Format per baris:<br>' +
        '<b class="mono">No. Absen | Nama | Nama Panggilan | KodeOrangTua</b><br>' +
        'Nama panggilan boleh dikosongkan &mdash; nanti diambil dari kata pertama nama. ' +
        'Kode orang tua juga boleh kosong, nanti diisi guru.</span></div>' +
        '<div class="field"><label for="tmTmpData">Data Siswa</label>' +
        '<textarea class="textarea mono" id="tmTmpData" rows="10" style="font-size:12.5px" ' +
        'placeholder="siswa01 | Adi Pratama | adi | ORTU-A1B2&#10;siswa02 | Bela Sari | bela | "></textarea></div>',
      footer: '<button class="btn btn-ghost" data-tutup>Batal</button>' +
        '<button class="btn btn-primary" id="tmProses"><i class="fa-solid fa-check"></i> Tambahkan Semua</button>'
    });

    document.getElementById('tmProses').addEventListener('click', function () {
      var teks = document.getElementById('tmTmpData').value.trim();
      if (!teks) { J.toast('Data kosong', '', 'warn'); return; }
      var baris = teks.split(/\r?\n/).filter(function (b) { return b.trim(); });
      var ada = J.getSiswaKelas(kelasAktif);
      var nisAda = {}; ada.forEach(function (s) { nisAda[s.nis] = true; });

      var baru = [], dupe = [], hashTugas = [];
      baris.forEach(function (b) {
        var p = b.split(/\s*[|;\t]\s*/).map(function (x) { return x.trim(); });
        var nis = p[0], nama = p[1];
        var panggilan = (p[2] || '').replace(/\s+/g, '');
        var ko = (p[3] || '').toUpperCase();
        if (!nis || !nama) return;
        if (!panggilan) panggilan = panggilanDariNama(nama);
        if (!panggilan) return;
        nis = nis.toLowerCase();
        if (nisAda[nis]) { dupe.push(nis + ' - ' + nama); return; }
        nisAda[nis] = true;
        baru.push({
          kelasId: kelasAktif, nis: nis, nama: nama,
          panggilan: panggilan, pin: '', kodeOrtu: ko
        });
        hashTugas.push(J.sha256(panggilan.toLowerCase()).then(function (hash) {
          baru.find(function (x) { return x.nis === nis; }).pin = hash;
        }));
      });

      if (!baru.length) { J.toast('Tidak ada data valid', dupe.length ? 'Semua no. absen sudah terdaftar.' : 'Cek format baris.', 'warn'); return; }

      Promise.all(hashTugas).then(function () {
        var daftar = ada.concat(baru.map(function (x) {
          return {
            kelasId: x.kelasId, nis: x.nis, nama: x.nama,
            panggilan: x.panggilan, pin: x.pin, kodeOrtu: x.kodeOrtu
          };
        }));
        J.simpanSiswa(kelasAktif, daftar, function (r) {
          if (r.ok) {
            J.tutupModal();
            muatTabelSiswa(); gambarKelas(); gambarDashboard();
            J.toast('Siswa ditambahkan', baru.length + ' siswa baru' + (dupe.length ? ', ' + dupe.length + ' dilewati' : ''), 'ok');
          } else J.toast('Gagal', r.msg, 'err');
        });
      });
    });
  });

  /* ---------- Daftar login (cadangan guru) ---------- */
  function teksDaftarLogin() {
    var k = J.getKelas(kelasAktif);
    var siswa = J.getSiswaKelas(kelasAktif);
    var lines = ['DAFTAR LOGIN MURID - ' + (k ? k.nama : '-')];
    lines.push('No. Absen | Nama Lengkap | Nama Panggilan | Kode Orang Tua');
    siswa.forEach(function (s) {
      lines.push([s.nis, s.nama, s.panggilan || '-', s.kodeOrtu || '-'].join(' | '));
    });
    return lines.join('\n');
  }

  function salinTeks(teks, selesai) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(teks).then(selesai, function () { salinGanti(teks, selesai); });
    } else salinGanti(teks, selesai);
  }
  function salinGanti(teks, selesai) {
    var ta = document.createElement('textarea');
    ta.value = teks;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    selesai();
  }

  document.getElementById('btnSalinSiswa').addEventListener('click', function () {
    if (!kelasAktif) { J.toast('Pilih kelas dulu', '', 'warn'); return; }
    if (!J.getSiswaKelas(kelasAktif).length) { J.toast('Belum ada siswa', '', 'warn'); return; }
    var teks = teksDaftarLogin();
    salinTeks(teks, function () {
      J.toast('Daftar login disalin',
        J.getSiswaKelas(kelasAktif).length + ' siswa - tempel di WhatsApp/Word sebagai cadangan.', 'ok');
    });
  });

  document.getElementById('btnUnduhSiswa').addEventListener('click', function () {
    var siswa = J.getSiswaKelas(kelasAktif);
    var rows = [['No. Absen', 'Nama', 'Nama Panggilan', 'KodeOrangTua', 'Jurnal Terisi (14h)']];
    siswa.forEach(function (s) {
      rows.push([s.nis, s.nama, s.panggilan || '', s.kodeOrtu || '', J.rekapSiswa(s.nis, 14).kelengkapan + '%']);
    });
    J.exportCSV(rows, 'template-siswa-' + (J.getKelas(kelasAktif) || {}).nama + '.csv');
    J.toast('Template diunduh',
      'Sudah terisi no. absen & nama panggilan - simpan sebagai cadangan, lalu tempel kembali bila perlu.', 'ok');
  });

  document.getElementById('btnKosongkan').addEventListener('click', function () {
    var k = J.getKelas(kelasAktif);
    if (!k) return;
    if (!confirm('Kosongkan SEMUA jurnal kelas ' + k.nama + '? Data siswa tetap aman, hanya jurnal yang dihapus.')) return;
    if (!confirm('Yakin? Tindakan ini tidak bisa dibatalkan.')) return;
    J.hapusSemuaEntries(kelasAktif, function (r) {
      if (r && r.ok) { gambarDashboard(); J.toast('Jurnal dikosongkan', 'Kelas ' + k.nama + ' siap diisi lagi.', 'ok'); }
      else J.toast('Gagal', (r && r.msg) || 'Coba lagi.', 'err');
    });
  });

  /* ============================================================
     7. TAB CATATAN
     ============================================================ */
  function simpanCatatan(nis, jenis, isi, tanggal) {
    J.simpanCatatan({
      nis: String(nis),
      jenis: jenis || 'catatan',
      isi: isi,
      tanggal: tanggal || J.todayISO(),
      guru: sesi.guru ? (sesi.guru.nama || sesi.guru.user) : 'Guru'
    }, function (r) {
      if (r.ok) { muatDaftarCatatan(); muatSelectSiswa(); J.toast('Catatan terkirim', 'Murid dan orang tuanya bisa melihatnya.', 'ok'); }
      else J.toast('Gagal', r.msg, 'err');
    });
  }

  function muatSelectSiswa() {
    var sel = document.getElementById('catSiswa');
    if (!sel) return;
    var semua = J.state.students.slice().sort(function (a, b) {
      return String(a.nama).localeCompare(String(b.nama), 'id');
    });
    sel.innerHTML = '<option value="">-- Pilih siswa --</option>' + semua.map(function (s) {
      var k = J.getKelas(s.kelasId);
      return '<option value="' + J.esc(s.nis) + '">' + J.esc(s.nama) + ' (' + J.esc(k ? k.nama : '-') + ')</option>';
    }).join('');
  }

  function muatDaftarCatatan() {
    var wrap = document.getElementById('daftarCatatan');
    if (!wrap) return;
    muatSelectSiswa();
    if (!document.getElementById('catTanggal').value) {
      document.getElementById('catTanggal').value = J.todayISO();
    }
    var semua = (J.config.notes || []).slice().sort(function (a, b) {
      return String(b.tanggal).localeCompare(String(a.tanggal));
    });
    wrap.innerHTML = semua.length ? semua.slice(0, 40).map(function (n) {
      var s = J.getSiswa(n.nis);
      return '<div class="note-card' + (n.jenis === 'pujian' ? ' note-gold' : '') + '">' +
        '<div class="nc-meta"><i class="fa-solid fa-user"></i>' + J.esc(s ? s.nama : n.nis) +
        ' &middot; ' + J.esc(n.guru || 'Guru') + ' &middot; ' + J.esc(J.fmtTanggal(n.tanggal || '')) + '</div>' +
        '<p>' + J.esc(n.isi) + '</p></div>';
    }).join('') : '<div class="empty"><div class="empty-icon"><i class="fa-solid fa-comment-dots"></i></div>' +
      '<h4>Belum ada catatan</h4><p>Catatan yang kamu kirim akan muncul di sini.</p></div>';
  }

  document.getElementById('btnSimpanCatatan').addEventListener('click', function () {
    var nis = document.getElementById('catSiswa').value;
    var isi = document.getElementById('catIsi').value.trim();
    var jenis = document.getElementById('catJenis').value;
    var tanggal = document.getElementById('catTanggal').value || J.todayISO();
    if (!nis) { J.toast('Pilih siswa', '', 'warn'); return; }
    if (!isi) { J.toast('Isi catatan kosong', '', 'warn'); return; }
    simpanCatatan(nis, jenis, isi, tanggal);
    document.getElementById('catIsi').value = '';
  });

  /* ============================================================
     8. TAB PENGATURAN
     ============================================================ */
  function muatPengaturan() {
    document.getElementById('setNamaApp').value = J.config.appName || '';
    var ov = J.config.habitOverrides || {};
    document.getElementById('setTarget').value = H.targetOf('bangun') || '';
    document.getElementById('setTargetTidur').value = H.targetOf('tidur') || '';
    document.getElementById('setUrl').value = J.scriptURL;

    document.getElementById('infoStatus').innerHTML = J.isConfigured()
      ? '<span class="badge badge-success"><i class="fa-solid fa-check"></i> Terhubung</span>'
      : '<span class="badge badge-danger"><i class="fa-solid fa-xmark"></i> Belum diatur</span>';
    document.getElementById('infoSiswa').textContent = J.state.students.length + ' siswa';
    document.getElementById('infoEntri').textContent = J.state.entries.length + ' entri';
    document.getElementById('infoWaktu').textContent = sinkronTerakhir;

    var daftar = J.teachers;
    document.getElementById('daftarGuru').innerHTML = daftar.length ? daftar.map(function (t) {
      return '<div class="list-row"><div class="list-avatar"><i class="fa-solid fa-user-tie"></i></div>' +
        '<div class="list-main"><h4>' + J.esc(t.nama || t.user) + '</h4>' +
        '<p>username: <span class="mono">' + J.esc(t.user) + '</span></p></div>' +
        (t.user === 'guru'
          ? '<span class="badge badge-warning">akun default</span>'
          : '<button class="btn btn-danger btn-icon" data-hapus-guru="' + J.esc(t.user) + '" title="Hapus guru">' +
            '<i class="fa-solid fa-trash"></i></button>') +
        '</div>';
    }).join('') : '<p class="text-sm text-muted">Belum ada akun guru.</p>';

    document.querySelectorAll('[data-hapus-guru]').forEach(function (b) {
      b.addEventListener('click', function () {
        var u = b.dataset.hapusGuru;
        if (!confirm('Hapus akun guru "' + u + '"?')) return;
        var cfg = JSON.parse(JSON.stringify(J.config));
        cfg.teachers = cfg.teachers.filter(function (t) { return t.user !== u; });
        J.simpanConfig(cfg, function (r) {
          if (r.ok) { muatPengaturan(); J.toast('Akun dihapus', '', 'ok'); }
          else J.toast('Gagal', r.msg, 'err');
        });
      });
    });
  }

  document.getElementById('btnSimpanIdentitas').addEventListener('click', function () {
    var nama = document.getElementById('setNamaApp').value.trim();
    var target = document.getElementById('setTarget').value;
    var targetTidur = document.getElementById('setTargetTidur').value;
    if (!nama) { J.toast('Nama aplikasi wajib diisi', '', 'warn'); return; }
    if (!target) { J.toast('Target jam bangun wajib diisi', '', 'warn'); return; }
    var cfg = JSON.parse(JSON.stringify(J.config));
    cfg.appName = nama;
    cfg.habitOverrides = cfg.habitOverrides || {};
    cfg.habitOverrides.bangun = { targetTime: target };
    if (targetTidur) cfg.habitOverrides.tidur = { targetTime: targetTidur };
    J.simpanConfig(cfg, function (r) {
      if (r.ok) {
        J.terapkanTarget();
        gambarSemua();
        J.toast('Pengaturan disimpan', '', 'ok');
      } else J.toast('Gagal', r.msg, 'err');
    });
  });

  document.getElementById('btnTambahGuru').addEventListener('click', function () {
    var nama = document.getElementById('gNama').value.trim();
    var user = document.getElementById('gUser').value.trim().toLowerCase();
    var pass = document.getElementById('gPass').value;
    if (!nama || !user) { J.toast('Nama & username wajib diisi', '', 'warn'); return; }
    if (pass.length < 6) { J.toast('Password minimal 6 karakter', '', 'warn'); return; }
    if (J.teachers.some(function (t) { return t.user === user; })) { J.toast('Username sudah dipakai', '', 'err'); return; }
    J.sha256(pass).then(function (hash) {
      var cfg = JSON.parse(JSON.stringify(J.config));
      cfg.teachers = cfg.teachers || [];
      cfg.teachers.push({ user: user, nama: nama, pass: hash });
      J.simpanConfig(cfg, function (r) {
        if (r.ok) {
          document.getElementById('gNama').value = '';
          document.getElementById('gUser').value = '';
          document.getElementById('gPass').value = '';
          muatPengaturan();
          J.toast('Guru ditambahkan', 'Username ' + user, 'ok');
        } else J.toast('Gagal', r.msg, 'err');
      });
    });
  });

  document.getElementById('btnSimpanUrl').addEventListener('click', function () {
    var u = document.getElementById('setUrl').value.trim();
    if (u && !/^https?:\/\/[^\s?#]+\/exec\/?$/i.test(u)) {
      J.toast('URL tidak valid', 'Pastikan URL berakhiran /exec. Contoh: https://script.google.com/macros/s/AKfy.../exec', 'err');
      return;
    }
    J.scriptURL = u;
    J.syncAll(function (r) {
      if (r.ok) { gambarSemua(); sembunyikanStatus(); J.toast('URL disimpan', 'Koneksi berhasil.', 'ok'); }
      else J.toast('URL tersimpan, koneksi gagal', r.msg, 'err');
    });
  });

  document.getElementById('btnTesUrl').addEventListener('click', function () {
    var b = this;
    b.innerHTML = '<i class="fa-solid fa-circle-notch spin"></i> Menguji...';
    J.syncAll(function (r) {
      b.innerHTML = '<i class="fa-solid fa-plug-circle-check"></i> Tes Koneksi';
      if (r.ok) { gambarSemua(); sembunyikanStatus(); J.toast('Koneksi berhasil', r.jumlahSiswa + ' siswa, ' + r.jumlahEntri + ' entri.', 'ok'); }
      else J.toast('Koneksi gagal', r.msg, 'err');
    });
  });

  document.getElementById('btnMuatTemplate').addEventListener('click', function () {
    location.href = 'apps-script/Code.gs';
  });

  /* ============================================================
     9. INIT
     ============================================================ */
  /* SHA-256 dari "guru123". Cukup untuk mendeteksi apakah password
     bawaan masih terpasang - tidak perlu membandingkan teks biasa. */
  var SANDI_GURU_AWAL = 'ae81343369944399b70de862dbe75536faa8e44c50ad0a312e380303173f4756';

  function cekGuruAwal() {
    var masihBawaan = J.teachers.some(function (t) { return t.pass === SANDI_GURU_AWAL; });
    document.getElementById('peringatanGuruAwal').classList.toggle('hidden', !masihBawaan);
  }

  function gambarSemua() {
    document.getElementById('appName').textContent = (J.config.appName || 'Jurnal 7 Anak Indonesia Hebat');
    document.title = 'Panel Guru - ' + (J.sekolah || (J.config.appName || 'Jurnal 7 Anak Indonesia Hebat'));
    gambarKelas();
    gambarDashboard();
    muatTabelSiswa();
    muatDaftarCatatan();
    cekGuruAwal();
  }

  if (!J.isConfigured()) {
    tampilkanStatus('Database belum terhubung. Atur Google Apps Script Web App URL di tab Pengaturan.', 'danger');
    document.querySelector('#tabs .tab[data-tab="pengaturan"]').click();
    return;
  }

  try { kelasAktif = localStorage.getItem(J.KEYS.kelas) || ''; } catch (e) {}

  if (!J.state.students.length) {
    gambarKelas();
    gambarDashboard();
    /* Tunggu sinkron: belum ada cache lokal */
    J.syncAll(function (r) {
      sinkronTerakhir = J.fmtTanggalPendekJam(J.todayISO());
      if (!r.ok) { tampilkanStatus('Database belum terbaca: ' + r.msg, 'danger'); return; }
      if (!J.teachers.length) buatGuruBawaan();
      gambarSemua();
      /* Bar status dibersihkan begitu sinkron berhasil, supaya
         pesan "belum terhubung" tidak nempel setelah database
         sebenarnya sudah nyambung. */
      sembunyikanStatus();
      J.mulaiAutoSync(function () { gambarSemua(); }, 90000);
    });
  } else {
    gambarSemua();
    J.syncAll(function (r) {
      sinkronTerakhir = J.fmtTanggalPendekJam(J.todayISO());
      if (!r.ok) { tampilkanStatus('Gagal sinkron: ' + r.msg, 'warn'); return; }
      if (!J.teachers.length) buatGuruBawaan();
      gambarSemua();
      /* Sama seperti jalur di atas: bar status dibersihkan
         setelah sinkron berhasil. */
      sembunyikanStatus();
      J.mulaiAutoSync(function () { gambarSemua(); }, 90000);
    });
  }

  /* Akun guru bawaan saat spreadsheet masih kosong */
  function buatGuruBawaan() {
    J.sha256('guru123').then(function (hash) {
      var cfg = JSON.parse(JSON.stringify(J.config));
      cfg.appName = cfg.appName || 'Jurnal 7 Anak Indonesia Hebat';
      cfg.classes = cfg.classes || [];
      cfg.teachers = cfg.teachers || [];
      if (!cfg.teachers.length) {
        cfg.teachers.push({ user: 'guru', nama: 'Guru', pass: hash });
      }
      if (!cfg.notes) cfg.notes = [];
      if (!cfg.habitOverrides) cfg.habitOverrides = { bangun: { targetTime: '05:30' }, tidur: { targetTime: '21:00' } };
      J.terapkanTarget();
      J.simpanConfig(cfg);
      J.toast('Akun guru dibuat', 'username: guru - password: guru123. Segera ganti!', 'warn');
    });
  }
})();