/* ============================================================
   Jurnal 7 Anak Indonesia Hebat — murid.js
   ------------------------------------------------------------
   Halaman murid: mengisi jurnal harian + melihat rekap pribadi.
   ============================================================ */
(function () {
  'use strict';

  var J = window.Jurnal;
  var H = window.HABITS7;

  var sesi = J.ambilSesi();
  var siswa = null;
  var rentangHari = 7;
  var isian = {};        /* { habitKey: { nilai, catatan } } — isian hari ini */
  var formTerbuka = true;

  /* ============================================================
     1. GERBANG: hanya murid yang sudah login boleh masuk
     ============================================================ */
  function gerbang() {
    if (!sesi || sesi.role !== 'siswa' || !sesi.siswa) {
      document.body.innerHTML =
        '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">' +
        '<div class="card card-lg text-center" style="max-width:420px">' +
        '<div class="empty-icon"><i class="fa-solid fa-lock"></i></div>' +
        '<h2 style="font-size:20px;margin-bottom:8px">Belum masuk</h2>' +
        '<p class="text-sm text-muted">Silakan masuk dengan No. Absen dan Nama Panggilan terlebih dahulu.</p>' +
        '<a class="btn btn-primary btn-block mt-3" href="index.html"><i class="fa-solid fa-arrow-right-to-bracket"></i> Halaman Masuk</a>' +
        '</div></div>';
      return false;
    }
    return true;
  }
  if (!gerbang()) return;

  document.head.insertAdjacentHTML('beforeend', J.svgDefs());
  document.getElementById('appName').textContent = (J.config.appName || 'Jurnal 7 Anak Indonesia Hebat');

  /* ============================================================
     2. IDENTITAS & SESSION
     ============================================================ */
  function pasangIdentitas() {
    siswa = J.getSiswa(sesi.siswa.nis);
    if (!siswa) {
      J.toast('Data tidak ditemukan', 'Data kamu belum ada di database. Minta guru menambahkamu.', 'err');
      document.getElementById('identitas').textContent = 'Data tidak ditemukan';
      return;
    }
    sesi.siswa = { nis: siswa.nis, nama: siswa.nama, kelasId: siswa.kelasId };
    J.simpanSesi(sesi);

    var kelas = J.getKelas(siswa.kelasId);
    document.getElementById('identitas').textContent =
      siswa.nama + ' - ' + (kelas ? kelas.nama : 'Tanpa kelas') + ' - No. absen ' + siswa.nis;
  }

  document.getElementById('btnLogout').addEventListener('click', function () {
    if (!confirm('Keluar dari jurnal?')) return;
    J.hapusSesi();
    location.href = 'index.html';
  });
  document.getElementById('btnSync').addEventListener('click', function () {
    var b = this;
    b.innerHTML = '<i class="fa-solid fa-circle-notch spin"></i>';
    J.syncAll(function (r) {
      b.innerHTML = '<i class="fa-solid fa-rotate"></i>';
      if (r.ok) { pasangIdentitas(); muatSemua(); J.toast('Tersinkron', 'Data terbaru berhasil diambil.', 'ok'); }
      else J.toast('Gagal sinkron', r.msg, 'err');
    });
  });
  document.getElementById('btnPerbaiki').addEventListener('click', function () {
    J.syncAll(function (r) {
      if (r.ok) { muatSemua(); sembunyikanStatus(); J.toast('Tersinkron', 'Semua isian sudah masuk database.', 'ok'); }
      else J.toast('Masih gagal', r.msg, 'err');
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
     3. FORMULIR JURNAL
     ============================================================ */
  function muatIsianHariIni() {
    isian = {};
    var t = J.todayISO();
    H.list.forEach(function (h) {
      var e = J.entryOf(siswa.nis, t, h.key);
      isian[h.key] = {
        nilai: e ? e.nilai : '',
        catatan: e ? e.catatan : ''
      };
    });
  }

  function gambarFormulir() {
    var t = J.todayISO();
    var target = J.targetBangun();

    document.getElementById('habitGrid').innerHTML = H.list.map(function (h) {
      var v = isian[h.key] || { nilai: '', catatan: '' };
      var terisi = String(v.nilai).trim() !== '';
      var kontrol = '';

      if (h.type === 'time') {
        kontrol =
          '<div class="time-input-row">' +
          '<input class="time-input" type="time" data-habit="' + h.key + '" data-jenis="nilai"' +
          ' value="' + J.esc(v.nilai) + '" step="300" aria-label="Jam bangun">' +
          '</div>' +
          '<div class="time-target"><i class="fa-solid fa-bullseye"></i> Target bangun <b>' + J.esc(target) + '</b>' +
          (terisi ? ' - skor <b>' + H.scoreEntry(h.key, v.nilai) + '</b>' : '') + '</div>';
      } else if (h.type === 'scale') {
        kontrol =
          '<div class="scale-row" data-scale="' + h.key + '">' +
          [1, 2, 3, 4, 5].map(function (n) {
            return '<button type="button" class="scale-btn' + (String(v.nilai) === String(n) ? ' on' : '') +
              '" data-habit="' + h.key + '" data-nilai="' + n + '" aria-label="Nilai ' + n + '">' + n + '</button>';
          }).join('') +
          '</div><div class="scale-desc" data-desc="' + h.key + '">' +
          J.esc((h.labels && h.labels[v.nilai]) || 'Pilih angka 1 sampai 5') + '</div>';
      } else if (h.type === 'check') {
        kontrol =
          '<button type="button" class="check-row' + (v.nilai === '1' ? ' on' : '') + '" data-habit="' + h.key + '" data-jenis="check">' +
          '<span class="box"><i class="fa-solid fa-check"></i></span><span>' + J.esc(h.label) + '</span></button>';
      } else {
        kontrol =
          '<textarea class="textarea" data-habit="' + h.key + '" data-jenis="nilai" maxlength="' + (h.maxLen || 300) +
          '" placeholder="' + J.esc(h.placeholder || 'Tulis di sini...') + '">' + J.esc(v.nilai) + '</textarea>';
      }

      return '<article class="habit-card' + (terisi ? ' filled' : '') + '" style="--hb:' + h.color + '" data-kartu="' + h.key + '">' +
        '<div class="habit-head">' +
        '<div class="habit-no">' + h.no + '</div>' +
        '<div class="habit-meta"><h3>' + J.esc(h.title) + '</h3><p>' + J.esc(h.sub) + '</p></div>' +
        '<div class="habit-state">' +
        (terisi ? '<span class="badge badge-success"><i class="fa-solid fa-check"></i> Terisi</span>'
                : '<span class="badge badge-soft"><i class="fa-solid fa-pen"></i> Kosong</span>') +
        '</div></div>' +
        kontrol +
        (h.type !== 'text' ?
          '<div class="habit-note"><input class="input" data-habit="' + h.key + '" data-jenis="catatan"' +
          ' maxlength="200" placeholder="Catatan (opsional)" value="' + J.esc(v.catatan) + '"></div>' : '') +
        (h.tip ? '<div class="habit-tip"><i class="fa-solid fa-lightbulb"></i><span>' + J.esc(h.tip) + '</span></div>' : '') +
        '</article>';
    }).join('');

    pasangEventFormulir();
    perbaruiRingkasanHari();
  }

  function pasangEventFormulir() {
    /* Input jam */
    document.querySelectorAll('input[type="time"][data-jenis="nilai"]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        setIsian(inp.dataset.habit, inp.value);
      });
      inp.addEventListener('input', function () { setIsian(inp.dataset.habit, inp.value); });
    });

    /* Skala 1-5 */
    document.querySelectorAll('.scale-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var k = btn.dataset.habit, n = btn.dataset.nilai;
        var baru = String(isian[k].nilai) === n ? '' : n;
        setIsian(k, baru);
        var h = H.byKey(k);
        var desc = document.querySelector('[data-desc="' + k + '"]');
        if (desc) desc.textContent = (baru && h.labels && h.labels[baru]) ? h.labels[baru] : 'Pilih angka 1 sampai 5';
      });
    });

    /* Centang */
    document.querySelectorAll('.check-row').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setIsian(btn.dataset.habit, String(isian[btn.dataset.habit].nilai) === '1' ? '' : '1');
      });
    });

    /* Isian bebas (tipe text): textarea menyimpan nilai utama */
    document.querySelectorAll('textarea[data-jenis="nilai"]').forEach(function (el) {
      el.addEventListener('input', function () {
        setIsian(el.dataset.habit, el.value);
      });
    });

    /* Catatan */
    document.querySelectorAll('[data-jenis="catatan"]').forEach(function (el) {
      el.addEventListener('input', function () {
        var k = el.dataset.habit;
        isian[k] = isian[k] || { nilai: '', catatan: '' };
        isian[k].catatan = el.value;
        var kartu = document.querySelector('[data-kartu="' + k + '"]');
        var terisi = (isian[k].nilai !== '' && isian[k].nilai != null) || el.value.trim() !== '';
        if (kartu) kartu.classList.toggle('filled', terisi);
      });
    });
  }

  function setIsian(k, nilai) {
    if (!isian[k]) isian[k] = { nilai: '', catatan: '' };
    isian[k].nilai = nilai == null ? '' : String(nilai);

    var kartu = document.querySelector('[data-kartu="' + k + '"]');
    var badge = document.querySelector('[data-kartu="' + k + '"] .habit-state');
    var terisi = isian[k].nilai !== '';
    if (kartu) {
      kartu.classList.toggle('filled', terisi || isian[k].catatan !== '');
      if (terisi && !kartu.classList.contains('just-filled')) {
        kartu.classList.add('just-filled');
        setTimeout(function () { kartu.classList.remove('just-filled'); }, 700);
      }
    }
    if (badge) {
      badge.innerHTML = terisi
        ? '<span class="badge badge-success"><i class="fa-solid fa-check"></i> Terisi</span>'
        : '<span class="badge badge-soft"><i class="fa-solid fa-pen"></i> Kosong</span>';
    }

    /* Skor jam bangun langsung ditampilkan */
    if (k === 'bangun') {
      var target = document.querySelector('[data-kartu="bangun"] .time-target');
      if (target) {
        target.innerHTML = '<i class="fa-solid fa-bullseye"></i> Target bangun <b>' + J.esc(J.targetBangun()) + '</b>' +
          (terisi ? ' - skor <b>' + H.scoreEntry('bangun', isian[k].nilai) + '</b>' : '');
      }
    }
    perbaruiRingkasanHari();
  }

  function perbaruiRingkasanHari() {
    var t = J.todayISO();
    var n = H.list.filter(function (h) { return String(isian[h.key].nilai || '').trim() !== ''; }).length;
    var persen = Math.round((n / H.total()) * 100);
    document.getElementById('ringHari').innerHTML = J.ring(persen, 78, 8);

    var chip = document.getElementById('chipHari');
    chip.innerHTML =
      '<span class="badge badge-maroon"><i class="fa-solid fa-list-check"></i> ' + n + ' dari ' + H.total() + ' terisi</span>' +
      (persen === 100
        ? '<span class="badge badge-gold"><i class="fa-solid fa-star"></i> Jurnal lengkap!</span>'
        : '<span class="badge badge-soft"><i class="fa-solid fa-hourglass-half"></i> ' + (H.total() - n) + ' lagi</span>');

    var btn = document.getElementById('btnSimpanSemua');
    btn.disabled = n === 0;
    btn.innerHTML = n > 0
      ? '<i class="fa-solid fa-floppy-disk"></i> Simpan (' + n + ')'
      : '<i class="fa-solid fa-floppy-disk"></i> Simpan';
  }

  /* ---------- Simpan ---------- */
  var sedangSimpan = false;
  function simpanSemua(pakaiTombol) {
    if (sedangSimpan) return;
    sedangSimpan = true;

    var btn = document.getElementById('btnSimpanSemua');
    var teksAsli = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch spin"></i> Menyimpan...';

    var t = J.todayISO();
    var items = [];
    H.list.forEach(function (h) {
      var v = isian[h.key] || { nilai: '', catatan: '' };
      var adaNilai = String(v.nilai || '').trim() !== '';
      var adaCatatan = String(v.catatan || '').trim() !== '';
      if (!adaNilai && !adaCatatan) return;
      if (adaCatatan && !adaNilai) return; /* catatan tanpa isian utama: abaikan */
      items.push(J.buildEntry(siswa, t, h.key, v.nilai, v.catatan));
    });

    if (!items.length) {
      sedangSimpan = false;
      btn.disabled = false;
      btn.innerHTML = teksAsli;
      J.toast('Belum ada isian', 'Isi minimal satu kebiasaan dulu.', 'warn');
      return;
    }

    J.simpanEntries(items, function (r) {
      sedangSimpan = false;
      btn.disabled = false;
      btn.innerHTML = teksAsli;
      if (r.ok) {
        var lengkap = H.list.filter(function (h) { return String(isian[h.key].nilai || '').trim() !== ''; }).length;
        if (lengkap === H.total()) {
          J.toast('Jurnal lengkap!', 'Hebat, semua 7 kebiasaan terisi hari ini.', 'ok');
          konfeti();
        } else {
          J.toast('Tersimpan', lengkap + ' dari ' + H.total() + ' kebiasaan tercatat.', 'ok');
        }
        muatRekap();
        perbaruiAntrean();
      } else {
        J.toast('Gagal menyimpan', r.msg, 'err');
      }
    });
  }
  document.getElementById('btnSimpanSemua').addEventListener('click', function () { simpanSemua(true); });
  document.getElementById('btnRiwayat').addEventListener('click', function () { muatRekap(true); });

  function konfeti() {
    var warna = ['#A82249', '#C9A227', '#75162F', '#E3C15C', '#D9799A'];
    for (var i = 0; i < 40; i++) {
      (function (i) {
        var el = document.createElement('div');
        el.className = 'confetti';
        el.style.left = (Math.random() * 100) + 'vw';
        el.style.background = warna[i % warna.length];
        el.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
        el.style.animationDelay = (Math.random() * 0.5) + 's';
        document.body.appendChild(el);
        setTimeout(function () { el.remove(); }, 3600);
      })(i);
    }
  }

  /* ---------- Buka / tutup formulir ---------- */
  function setFormTerbuka(v) {
    formTerbuka = v;
    document.getElementById('bukaForm').style.display = v ? '' : 'none';
    document.getElementById('btnIsi').innerHTML = v
      ? '<i class="fa-solid fa-eye-slash"></i> Sembunyikan'
      : '<i class="fa-solid fa-pen"></i> Isi Jurnal';
    if (v) setTimeout(function () {
      document.getElementById('bukaForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  }
  document.getElementById('btnIsi').addEventListener('click', function () { setFormTerbuka(!formTerbuka); });
  document.getElementById('btnTutupForm').addEventListener('click', function () { setFormTerbuka(false); });

  /* ---------- Rentang rekap ---------- */
  document.querySelectorAll('#chipRentang .chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      document.querySelectorAll('#chipRentang .chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      rentangHari = parseInt(chip.dataset.hari, 10);
      muatRekap();
    });
  });

  /* ============================================================
     4. REKAP
     ============================================================ */
  function muatRekap(paksaToast) {
    var r = J.rekapSiswa(siswa.nis, rentangHari);

    /* Statistik */
    document.getElementById('statHariAktif').textContent = r.hariAktifJml;
    document.getElementById('statHariAktifHint').textContent = 'dalam ' + rentangHari + ' hari terakhir';
    document.getElementById('statPoin').textContent = r.rataPoin;
    document.getElementById('statPoinHint').textContent =
      r.hariAktifJml ? 'dari isian yang terisi' : 'belum ada isian';

    var bangun = r.perHabit.find(function (p) { return p.key === 'bangun'; });
    document.getElementById('statBangun').textContent = bangun && bangun.rataWaktu ? bangun.rataWaktu : '-';
    document.getElementById('statBangunHint').textContent = 'target ' + J.targetBangun();
    document.getElementById('statStreak').textContent = r.streak;
    document.getElementById('strekTeks').textContent = r.streak + ' hari beruntun';

    /* Heatmap */
    document.getElementById('heatmap').innerHTML = J.heatmap(r.harian, r.hariRentang);

    /* Rekap per kebiasaan */
    document.getElementById('rekapList').innerHTML = r.perHabit.map(function (p) {
      return '<div class="rekap-item">' +
        '<div class="ri-no" style="background:' + p.color + '">' + p.no + '</div>' +
        '<div class="ri-body">' +
        '<div class="ri-title"><strong>' + J.esc(p.title) + '</strong>' +
        '<span>' + p.persen + '%</span></div>' +
        '<div class="progress thin"><i style="width:' + p.persen + '%;background:' + p.color + '"></i></div>' +
        '<div class="text-xs text-muted mt-1">' +
        (p.type === 'time' && p.rataWaktu
          ? 'Rata-rata bangun <b class="mono">' + p.rataWaktu + '</b> &middot; '
          : '') +
        p.jumlah + ' dari ' + rentangHari + ' hari terisi' +
        (p.rataSkor ? ' &middot; skor ' + p.rataSkor : '') +
        '</div></div></div>';
    }).join('');

    /* Grafik jam bangun */
    var dataBangun = r.hariRentang.slice(-10).map(function (d) {
      var e = J.entryOf(siswa.nis, d, 'bangun');
      var menit = e ? H.parseHM(e.nilai) : null;
      return {
        label: J.fmtTanggalPendek(d).slice(0, 5),
        value: menit === null ? 0 : Math.max(0, 12 - menit / 60),  /* makin pagi = makin tinggi */
        menit: menit,
        warna: e ? 'gold' : ''
      };
    });
    var adaBangun = dataBangun.some(function (d) { return d.menit !== null; });
    document.getElementById('grafikBangun').innerHTML = adaBangun
      ? J.barChart(dataBangun, { max: 12, tampilkanNilai: false })
      : '<div class="empty"><div class="empty-icon"><i class="fa-solid fa-sun"></i></div>' +
        '<h4>Belum ada data jam bangun</h4><p>Isi kebiasaan nomor 1 beberapa hari lagi agar grafiknya muncul.</p></div>';

    /* Lencana */
    var sudah = {};
    r.lencana.forEach(function (l) { sudah[l.key] = true; });
    document.getElementById('lencanaGrid').innerHTML = H.lencana.map(function (l) {
      var dapat = !!sudah[l.key];
      return '<div class="lencana' + (dapat ? '' : ' locked') + '" title="' + J.esc(l.desc) + '">' +
        '<i class="' + l.icon + '"></i>' +
        '<span>' + (dapat ? l.label : 'Terkunci') + '</span></div>';
    }).join('');

    /* Riwayat 5 hari terakhir */
    var hariAda = Object.keys(r.harian).sort().reverse().slice(0, 5);
    document.getElementById('riwayatList').innerHTML = hariAda.length
      ? hariAda.map(function (d) {
        var hr = r.harian[d];
        var chips = Object.keys(hr.byKey).sort(function (a, b) {
          return H.byKey(a).no - H.byKey(b).no;
        }).map(function (k) {
          var h = H.byKey(k);
          return '<span class="badge badge-soft" title="' + J.esc(h.title) + '">' +
            '<i class="' + h.icon + '" style="color:' + h.color + '"></i>' +
            J.esc(H.ringkas(k, hr.byKey[k].nilai)) + '</span>';
        }).join('');
        return '<div class="list-row">' +
          '<div class="list-avatar"><i class="fa-solid fa-calendar-day"></i></div>' +
          '<div class="list-main">' +
          '<h4>' + J.esc(J.fmtHari(d)) + ', ' + J.esc(J.fmtTanggal(d)) + '</h4>' +
          '<p>' + hr.jumlah + ' dari ' + H.total() + ' kebiasaan &middot; poin ' + hr.poin + '</p>' +
          '<div class="flex gap-1 flex-wrap mt-1">' + chips + '</div>' +
          '</div>' +
          '<div style="flex-shrink:0">' + J.ring(hr.poin, 52, 6) + '</div>' +
          '</div>';
      }).join('')
      : '<div class="empty"><div class="empty-icon"><i class="fa-solid fa-book-open"></i></div>' +
        '<h4>Belum ada riwayat</h4><p>Isi jurnal pertamamu di atas.</p></div>';

    /* Catatan guru */
    muatCatatan();

    /* Antrean offline */
    perbaruiAntrean();

    if (paksaToast) J.toast('Rekap diperbarui', 'Menampilkan data terbaru.', 'ok');
  }

  function muatCatatan() {
    var catatan = J.catatanUntuk(siswa.nis);
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

  function perbaruiAntrean() {
    var n = J.pendingCount;
    if (n > 0) {
      tampilkanStatus(n + ' isian menunggu dikirim ulang ke database. App akan mengirimkannya otomatis saat koneksi tersedia.', 'warn');
    } else {
      sembunyikanStatus();
    }
  }

  /* ============================================================
     5. SAPUAN & INIT
     ============================================================ */
  function muatSapaan() {
    var jam = new Date().getHours();
    var sapaan = jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam';
    document.getElementById('sapaan').textContent = sapaan + ', ' + (siswa ? siswa.nama.split(' ')[0] : 'Teman') + '!';
    document.getElementById('tanggalHari').textContent =
      J.fmtHari(J.todayISO()) + ', ' + J.fmtTanggal(J.todayISO()) + ' - ' + J.fmtWaktu();
  }

  function muatSemua() {
    if (!siswa) pasangIdentitas();
    if (!siswa) return;
    muatIsianHariIni();
    gambarFormulir();
    setFormTerbuka(true);
    muatSapaan();
    muatRekap();
  }

 pasangIdentitas();

  if (!J.isConfigured()) {
    tampilkanStatus('Database belum terhubung. Isi URL Apps Script di assets/js/site-config.js.', 'danger');
    document.getElementById('btnPerbaiki').textContent = 'Buka Pengaturan';
    document.getElementById('btnPerbaiki').onclick = function () { location.href = 'index.html'; };
    return;
  }

  /* Tunggu sinkron pertama agar data siswa & jurnal benar */
  J.syncAll(function (r) {
    if (!r.ok) {
      tampilkanStatus('Database belum terbaca: ' + r.msg, 'danger');
      return;
    }
    pasangIdentitas();
    muatSemua();
    J.mulaiAutoSync(function () {
      var lama = document.getElementById('sapaan').textContent;
      pasangIdentitas();
      muatIsianHariIni();
      gambarFormulir();
      muatSapaan();
      muatRekap();
      perbaruiAntrean();
    }, 90000);
  });

  /* Perbarui jam pada sapaan */
  setInterval(muatSapaan, 30000);

  /* Shortcut: Ctrl/Cmd + S untuk menyimpan */
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      simpanSemua();
    }
  });
})();