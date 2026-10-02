/* ====
   Jurnal 7 Anak Indonesia Hebat — murid.js
   ------------------------------------------------------------
   Halaman murid: mengisi jurnal harian + melihat rekap pribadi
   + Upload Foto
   + FIX BUG FORM KERISET & OPTIMASI SUPER CEPAT
   ==== */
(function () {
  'use strict';

  var J = window.Jurnal;
  var H = window.HABITS7;

  var sesi = J.ambilSesi();
  var siswa = null;
  var rentangHari = 7;
  var isian = {}; 
  var formTerbuka = true;
  var bulanAktif = null; // YYYY-MM, null berarti pakai rentang terakhir
  var adaPerubahan = false; /* Penanda agar form tidak keriset saat auto-sync */

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
  document.title = 'Jurnal Saya - ' + (J.sekolah || (J.config.appName || 'Jurnal 7 Anak Indonesia Hebat'));

  var sinkronSelesai = false;

  function pasangIdentitas() {
    siswa = J.getSiswa(sesi.siswa.nis);
    if (!siswa) {
      document.getElementById('identitas').textContent = sinkronSelesai ? 'Data tidak ditemukan' : 'Memuat data...';
      return;
    }
    sesi.siswa = { nis: siswa.nis, nama: siswa.nama, kelasId: siswa.kelasId };
    J.simpanSesi(sesi);
    var kelas = J.getKelas(siswa.kelasId);
    document.getElementById('identitas').textContent = siswa.nama + ' - ' + (kelas ? kelas.nama : 'Tanpa kelas') + ' - No. ' + siswa.nis;
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
      if (r.ok) { 
        pasangIdentitas(); 
        if(!adaPerubahan) { muatIsianHariIni(); gambarFormulir(); } // Hanya muat form jika tidak ada yg sedang diketik
        muatRekap();
        perbaruiAntrean(); 
        J.toast('Tersinkron', 'Data terbaru berhasil diambil.', 'ok'); 
      }
    });
  });

  function tampilkanStatus(pesan, tipe) {
    var bar = document.getElementById('statusBar');
    bar.className = 'banner ' + (tipe || 'warn');
    document.getElementById('statusTeks').textContent = pesan;
    bar.classList.remove('hidden');
  }
  function sembunyikanStatus() { document.getElementById('statusBar').classList.add('hidden'); }

  function muatIsianHariIni() {
    isian = {};
    var t = J.todayISO();
    H.list.forEach(function (h) {
      var e = J.entryOf(siswa.nis, t, h.key);
      isian[h.key] = {
        nilai: e ? e.nilai : '',
        catatan: e ? e.catatan : '',
        foto: e ? (e.foto || '') : ''
      };
    });
    adaPerubahan = false; // Reset status perubahan
  }

  function badgeStatus(h, terisi) {
    if (!terisi) return '<span class="badge badge-soft"><i class="fa-solid fa-pen"></i> Kosong</span>';
    if (h && h.type === 'check') return '<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Sudah</span>';
    return '<span class="badge badge-success"><i class="fa-solid fa-check"></i> Terisi</span>';
  }

  function kolomCatatan(h, v) {
    if (h.type === 'text') return '';
    var wajib = !!h.wajibCatatan;
    var terisi = String(v.nilai || '').trim() !== '';
    var aktif = wajib && terisi;
    var placeholder = aktif ? 'Tulis catatan singkat...' : (wajib ? 'Catatan (wajib setelah dicentang)' : 'Catatan (opsional)');

    return '<div class="habit-note' + (aktif ? ' wajib' : '') + '" data-note="' + h.key + '">' +
      '<div class="note-row">' +
        '<input class="input" id="cat-' + h.key + '" data-habit="' + h.key + '" data-jenis="catatan" maxlength="200" placeholder="' + placeholder + '" value="' + J.esc(v.catatan) + '">' +
        (aktif ? '<span class="note-star"><i class="fa-solid fa-asterisk"></i></span>' : '') +
      '</div>' +
    '</div>';
  }

  function kolomFoto(h, v) {
    if (h.key === 'bangun' || h.key === 'tidur') return '';
    var adaFoto = !!(v && v.foto);
    return '<div class="habit-photo-wrap" data-photo="' + h.key + '" style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border,#e2e8f0);">' +
      '<label for="input-foto-' + h.key + '" class="btn btn-ghost btn-sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:12.5px;background:rgba(19,74,59,0.06);color:var(--primary,#134A3B);border:1px dashed var(--primary,#134A3B);border-radius:8px;padding:6px 12px;">' +
        '<i class="fa-solid fa-camera"></i> <span class="lbl-foto-' + h.key + '">' + (adaFoto ? 'Ganti Foto Dokumentasi' : 'Unggah Foto Dokumentasi') + '</span>' +
      '</label>' +
      '<input type="file" id="input-foto-' + h.key + '" data-habit="' + h.key + '" data-jenis="foto" accept="image/*" capture="environment" style="display:none">' +
      '<div class="foto-preview-container" id="box-prev-' + h.key + '" style="margin-top:8px;position:relative;display:' + (adaFoto ? 'inline-block' : 'none') + ';">' +
        '<img id="img-prev-' + h.key + '" src="' + J.esc(v.foto || '') + '" alt="Dokumentasi" style="max-width:100%;max-height:160px;border-radius:8px;border:1px solid #ddd;object-fit:cover;">' +
        '<button type="button" class="btn-hapus-foto" data-hapus-foto="' + h.key + '" style="position:absolute;top:4px;right:4px;background:rgba(220,38,38,0.85);color:#fff;border:none;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;" title="Hapus Foto"><i class="fa-solid fa-xmark"></i></button>' +
      '</div>' +
    '</div>';
  }

  function bacaDanKompresFoto(file, callback) {
    if (!file) return callback('');
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        var maxW = 300; 
        var scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.4));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function tandaiCatatanWajib(key) {
    var bungkus = document.querySelector('[data-note="' + key + '"]');
    if (!bungkus) return;
    var h = H.byKey(key) || {};
    var v = isian[key] || {};
    var wajib = !!h.wajibCatatan && String(v.nilai || '').trim() !== '';
    bungkus.classList.toggle('wajib', wajib);
    if (!wajib || String(v.catatan || '').trim() !== '') bungkus.classList.remove('galat');
  }

  function validasiCatatan() {
    var salah = [];
    H.list.forEach(function (h) {
      if (!h.wajibCatatan) return;
      var v = isian[h.key] || {};
      if (String(v.nilai || '').trim() === '') return;
      if (String(v.catatan || '').trim() !== '') return;
      salah.push(h);
    });
    return salah;
  }

  function tolakCatatanKosong(salah) {
    salah.forEach(function(h){ document.querySelector('[data-note="' + h.key + '"]').classList.add('galat'); });
    if (!salah.length) return false;
    J.toast('Catatan wajib diisi', 'Harap isi catatan untuk kebiasaan yang dicentang.', 'warn');
    return true;
  }

  function gambarFormulir() {
    var t = J.todayISO();
    document.getElementById('habitGrid').innerHTML = H.list.map(function (h) {
      var v = isian[h.key] || { nilai: '', catatan: '', foto: '' };
      var terisi = String(v.nilai).trim() !== '';
      var kontrol = '';

      if (h.type === 'time') {
        kontrol = '<div class="time-input-row"><input class="time-input" type="time" data-habit="' + h.key + '" data-jenis="nilai" value="' + J.esc(v.nilai) + '"></div>';
      } else if (h.type === 'check') {
        var on = String(v.nilai) === '1';
        kontrol = '<button type="button" class="check-row' + (on ? ' on' : '') + '" data-habit="' + h.key + '"><span class="box"><i class="fa-solid fa-check"></i></span><span class="check-label">' + J.esc(h.label || 'Sudah') + '</span></button>';
      } else {
        kontrol = '<textarea class="textarea" data-habit="' + h.key + '" data-jenis="nilai" placeholder="Tulis di sini...">' + J.esc(v.nilai) + '</textarea>';
      }

      var centang = h.type === 'check' && String(v.nilai) === '1';
      return '<article class="habit-card' + (terisi ? ' filled' : '') + (centang ? ' centang' : '') + '" style="--hb:' + h.color + '" data-kartu="' + h.key + '">' +
        '<div class="habit-head"><div class="habit-thumb"><i class="' + h.icon + '"></i><span class="habit-no">' + h.no + '</span></div>' +
        '<div class="habit-meta"><h3>' + J.esc(h.title) + '</h3><p>' + J.esc(h.sub) + '</p></div>' +
        '<div class="habit-state">' + badgeStatus(h, terisi) + '</div></div>' +
        kontrol + kolomCatatan(h, v) + kolomFoto(h, v) +
        '</article>';
    }).join('');
    pasangEventFormulir();
    perbaruiRingkasanHari();
  }

  function pasangEventFormulir() {
    document.querySelectorAll('input[type="time"][data-jenis="nilai"]').forEach(function (inp) {
      inp.addEventListener('input', function () { setIsian(inp.dataset.habit, inp.value); });
    });
    document.querySelectorAll('.check-row').forEach(function (btn) {
      btn.addEventListener('click', function () { setIsian(btn.dataset.habit, String(isian[btn.dataset.habit].nilai) === '1' ? '' : '1'); });
    });
    document.querySelectorAll('textarea[data-jenis="nilai"], [data-jenis="catatan"]').forEach(function (el) {
      el.addEventListener('input', function () { 
        if(el.dataset.jenis === "catatan") {
          isian[el.dataset.habit].catatan = el.value;
          adaPerubahan = true;
          tandaiCatatanWajib(el.dataset.habit);
        } else {
          setIsian(el.dataset.habit, el.value); 
        }
      });
    });
    document.querySelectorAll('input[type="file"][data-jenis="foto"]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var k = inp.dataset.habit;
        var file = inp.files && inp.files[0];
        if (!file) return;
        bacaDanKompresFoto(file, function (dataUrl) {
          isian[k].foto = dataUrl;
          adaPerubahan = true;
          document.getElementById('img-prev-' + k).src = dataUrl;
          document.getElementById('box-prev-' + k).style.display = 'inline-block';
          document.querySelector('.lbl-foto-' + k).textContent = 'Ganti Foto';
          perbaruiRingkasanHari();
        });
      });
    });
    document.querySelectorAll('[data-hapus-foto]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var k = btn.dataset.hapusFoto;
        isian[k].foto = '';
        adaPerubahan = true;
        document.getElementById('box-prev-' + k).style.display = 'none';
        document.querySelector('.lbl-foto-' + k).textContent = 'Unggah Foto';
      });
    });
  }

  function setIsian(k, nilai) {
    if (!isian[k]) isian[k] = { nilai: '', catatan: '', foto: '' };
    isian[k].nilai = nilai == null ? '' : String(nilai);
    adaPerubahan = true; /* Menandai bahwa murid sedang mengetik/mengubah form */

    var h = H.byKey(k) || H.safe(k);
    var kartu = document.querySelector('[data-kartu="' + k + '"]');
    var badge = document.querySelector('[data-kartu="' + k + '"] .habit-state');
    var terisi = isian[k].nilai !== '';
    var centang = !!(h && h.type === 'check' && isian[k].nilai === '1');
    if (kartu) {
      kartu.classList.toggle('filled', terisi || isian[k].catatan !== '' || isian[k].foto !== '');
      kartu.classList.toggle('centang', centang);
    }
    if (badge) badge.innerHTML = badgeStatus(h, terisi);
    
    var barisCentang = kartu ? kartu.querySelector('.check-row') : null;
    if (barisCentang) barisCentang.classList.toggle('on', centang);
    tandaiCatatanWajib(k);
    perbaruiRingkasanHari();
  }

  function perbaruiRingkasanHari() {
    var n = H.list.filter(function (h) { return String(isian[h.key].nilai || '').trim() !== ''; }).length;
    var persen = Math.round((n / H.total()) * 100);
    document.getElementById('ringHari').innerHTML = J.ring(persen, 78, 8);
    document.getElementById('chipHari').innerHTML =
      '<span class="badge badge-maroon"><i class="fa-solid fa-list-check"></i> ' + n + ' dari ' + H.total() + ' terisi</span>' +
      (persen === 100 ? '<span class="badge badge-gold"><i class="fa-solid fa-star"></i> Jurnal lengkap!</span>' : '<span class="badge badge-soft"><i class="fa-solid fa-hourglass-half"></i> ' + (H.total() - n) + ' lagi</span>');
    
    var btn = document.getElementById('btnSimpanSemua');
    btn.disabled = n === 0;
    btn.innerHTML = n > 0 ? '<i class="fa-solid fa-floppy-disk"></i> Simpan (' + n + ')' : '<i class="fa-solid fa-floppy-disk"></i> Simpan';
  }

  /* OPTIMISTIC UI: Simpan Super Cepat */
  function simpanSemua() {
    var salah = validasiCatatan();
    if (tolakCatatanKosong(salah)) return;

    var t = J.todayISO();
    var items = [];
    H.list.forEach(function (h) {
      var v = isian[h.key] || { nilai: '', catatan: '', foto: '' };
      if (!v.nilai && !v.catatan && !v.foto) return;
      var entry = J.buildEntry(siswa, t, h.key, v.nilai, v.catatan);
      if (v.foto) entry.foto = v.foto;
      items.push(entry);
    });
    if (!items.length) return J.toast('Belum ada isian', 'Isi minimal satu kebiasaan dulu.', 'warn');

    var btn = document.getElementById('btnSimpanSemua');
    var teksAsli = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Tersimpan!';
    setTimeout(function() { btn.disabled = false; btn.innerHTML = teksAsli; }, 2000);

    J.toast('Tersimpan', 'Data berhasil dicatat.', 'ok');
    adaPerubahan = false; // Reset penanda setelah save berhasil

    J.simpanEntries(items, function (r) {
      if (r.ok) { 
        muatRekap(false); 
        perbaruiAntrean();
        // Auto-sync ringan
        try { if (document.getElementById('btnSync')) { J.syncAll(function(){}); } } catch(e) {}
      } 
      else { perbaruiAntrean(); }
    });
  }
  document.getElementById('btnSimpanSemua').addEventListener('click', function () { simpanSemua(); });
  document.getElementById('btnRiwayat').addEventListener('click', function () { muatRekap(true); });

  function setFormTerbuka(v) {
    formTerbuka = v;
    document.getElementById('bukaForm').style.display = v ? '' : 'none';
    document.getElementById('btnIsi').innerHTML = v ? '<i class="fa-solid fa-eye-slash"></i> Sembunyikan' : '<i class="fa-solid fa-pen"></i> Isi Jurnal';
    if (v) setTimeout(function () { document.getElementById('bukaForm').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 40);
  }
  document.getElementById('btnIsi').addEventListener('click', function () { setFormTerbuka(!formTerbuka); });
  document.getElementById('btnTutupForm').addEventListener('click', function () { setFormTerbuka(false); });

  document.querySelectorAll('#chipRentang .chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      document.querySelectorAll('#chipRentang .chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      rentangHari = parseInt(chip.dataset.hari, 10);
      bulanAktif = null; // kembali ke mode rentang
      muatRekap();
    });
  });
  
  // Navigasi bulan untuk kalender
  function bulanToYYYYMM(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
  }
  function ubahBulan(delta) {
    if (!bulanAktif) {
      var t = new Date();
      bulanAktif = bulanToYYYYMM(new Date(t.getFullYear(), t.getMonth(), 1));
    }
    var p = bulanAktif.split('-');
    var nd = new Date(parseInt(p[0],10), parseInt(p[1],10)-1 + delta, 1);
    bulanAktif = bulanToYYYYMM(nd);
    muatRekap();
  }
  function setBulanIni() {
    bulanAktif = null;
    // aktifkan chip rentang terakhir yg aktif? atau biarkan
    muatRekap();
  }
  if (document.getElementById('btnPrevBulan')) document.getElementById('btnPrevBulan').addEventListener('click', function(){ubahBulan(-1);});
  if (document.getElementById('btnNextBulan')) document.getElementById('btnNextBulan').addEventListener('click', function(){ubahBulan(1);});
  if (document.getElementById('btnSekarang')) document.getElementById('btnSekarang').addEventListener('click', setBulanIni);

  function muatRekap(paksaToast) {
    var r = J.rekapSiswa(siswa.nis, rentangHari);
    document.getElementById('statHariAktif').textContent = r.hariAktifJml;
    document.getElementById('statPoin').textContent = r.rataPoin;
    document.getElementById('statStreak').textContent = r.streak;
    
    var bangun = r.perHabit.find(function (p) { return p.key === 'bangun'; });
    document.getElementById('statBangun').textContent = bangun && bangun.rataWaktu ? bangun.rataWaktu : '-';

    /* Bar chart konsistensi/streak */
    try {
      var daysArr = (r.hariRentang || []);
      if (daysArr.length === 0 && r.harian) {
        daysArr = Object.keys(r.harian).sort().slice(-Math.max(7, rentangHari));
      }
      var barData = daysArr.slice(-Math.max(7, rentangHari)).map(function(d) {
        var hr = r.harian[d];
        var jml = hr ? hr.jumlah : 0;
        var persen = Math.round((jml / H.total()) * 100);
        return {
          label: J.fmtTanggalPendek(d).slice(0,5),
          value: persen,
          teks: persen + '%',
          kelas: persen >= 100 ? 'gold' : (persen >= 60 ? 'green' : '')
        };
      });
      if (document.getElementById('barKonsistensi')) {
        document.getElementById('barKonsistensi').innerHTML = J.barChart(barData, { max: 100, tampilkanNilai: true });
      }
    } catch(e) {}

    document.getElementById('rekapList').innerHTML = r.perHabit.map(function (p) {
      return '<div class="rekap-item"><div class="ri-no" style="background:' + p.color + '">' + p.no + '</div><div class="ri-body"><div class="ri-title"><strong>' + J.esc(p.title) + '</strong><span>' + p.persen + '%</span></div><div class="progress thin"><i style="width:' + p.persen + '%;background:' + p.color + '"></i></div><div class="text-xs text-muted mt-1">' + p.jumlah + ' hari terisi</div></div></div>';
    }).join('');

    var sudah = {}; r.lencana.forEach(function (l) { sudah[l.key] = true; });
    document.getElementById('lencanaGrid').innerHTML = H.lencana.map(function (l) {
      var dapat = !!sudah[l.key];
      return '<div class="lencana' + (dapat ? '' : ' locked') + '" title="' + J.esc(l.desc) + '"><i class="' + l.icon + '"></i><span>' + (dapat ? l.label : 'Terkunci') + '</span></div>';
    }).join('');

    var hariAda = Object.keys(r.harian).sort().reverse().slice(0, 5);
    document.getElementById('riwayatList').innerHTML = hariAda.length ? hariAda.map(function (d) {
      var hr = r.harian[d];
      return '<div class="list-row"><div class="list-avatar"><i class="fa-solid fa-calendar-day"></i></div><div class="list-main"><h4>' + J.esc(J.fmtHari(d)) + ', ' + J.esc(J.fmtTanggal(d)) + '</h4><p>Poin: ' + hr.poin + '</p></div></div>';
    }).join('') : '<div class="empty">Belum ada riwayat</div>';

    if (paksaToast) J.toast('Rekap diperbarui', 'Menampilkan data terbaru.', 'ok');
  }

  function perbaruiAntrean() {
    var n = J.pendingCount;
    if (n > 0) tampilkanStatus(n + ' isian menunggu dikirim ke database.', 'warn');
    else sembunyikanStatus();
  }

  function muatSapaan() {
    var jam = new Date().getHours();
    var sapaan = jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam';
    
    // PERBAIKAN: Gunakan Nama Panggilan (jika ada), atau potongan pertama dari nama lengkap
    var panggilan = 'Teman';
    if (siswa) {
      if (siswa.panggilan && siswa.panggilan.trim() !== '') {
        panggilan = siswa.panggilan;
      } else {
        panggilan = siswa.nama.split(' ')[0];
      }
    }
    
    document.getElementById('sapaan').textContent = sapaan + ', ' + panggilan + '!';
    document.getElementById('tanggalHari').textContent = J.fmtHari(J.todayISO()) + ', ' + J.fmtTanggal(J.todayISO());
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

  J.syncAll(function (r) {
    sinkronSelesai = true;
    if (!r.ok) return tampilkanStatus('Database belum terbaca: ' + r.msg, 'danger');
    pasangIdentitas();
    muatSemua();
    perbaruiAntrean();
    
    /* INI FIX BUG KERISET: Saat auto-sync, JANGAN render ulang form jika ada perubahan! */
    J.mulaiAutoSync(function () {
      pasangIdentitas();
      muatSapaan();
      muatRekap(false);
      perbaruiAntrean();
      /* Fungsi muatIsianHariIni() & gambarFormulir() dihapus dari sini! */
    }, 90000);
  });
})();
