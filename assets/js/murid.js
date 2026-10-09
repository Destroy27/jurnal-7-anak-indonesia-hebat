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
  var sedangSimpan = false; /* Supaya label tombol tidak ditimpa saat request berjalan */

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
  document.title = 'Jurnal Saya - JEJAK 7 KAIH';

  var sinkronSelesai = false;

  function pasangIdentitas() {
    siswa = J.getSiswa(sesi.siswa.nis, sesi.siswa.kelasId);
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
      var e = J.entryOf(siswa.nis, t, h.key, siswa.kelasId);
      isian[h.key] = {
        nilai: e ? e.nilai : '',
        catatan: e ? e.catatan : '',
        /* Foto TIDAK ikut di cache jurnal (bikin localStorage penuh).
           Foto dibaca dari gudang foto lokal. Kalau foto sudah ada di
           perangkat lain, tetap tampil sebagai "ada dokumentasi"
           walau gambar pratinjaunya tidak ada. */
        foto: J.ambilFoto(siswa.nis, t, h.key, siswa.kelasId) || '',
        adaFoto: !!(e && e.adaFoto)
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
    var adaFoto = !!((v && v.foto) || (v && v.adaFoto));
    var lbl = adaFoto ? 'Ganti Foto Dokumentasi' : 'Unggah Foto Dokumentasi';
    var pratinjau = (v && v.foto)
      ? '<img id="img-prev-' + h.key + '" src="' + J.esc(v.foto) + '" alt="Dokumentasi" style="max-width:100%;max-height:160px;border-radius:8px;border:1px solid #ddd;object-fit:cover;">'
      : '<div class="text-xs text-muted" id="img-prev-' + h.key + '" style="padding:8px 0;">Dokumentasi tersimpan di perangkat ini.</div>';
    return '<div class="habit-photo-wrap" data-photo="' + h.key + '" style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border,#e2e8f0);">' +
      '<label for="input-foto-' + h.key + '" class="btn btn-ghost btn-sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:12.5px;background:rgba(19,74,59,0.06);color:var(--primary,#134A3B);border:1px dashed var(--primary,#134A3B);border-radius:8px;padding:6px 12px;">' +
        '<i class="fa-solid fa-camera"></i> <span class="lbl-foto-' + h.key + '">' + lbl + '</span>' +
      '</label>' +
      '<input type="file" id="input-foto-' + h.key + '" data-habit="' + h.key + '" data-jenis="foto" accept="image/*" capture="environment" style="display:none">' +
      '<div class="foto-preview-container" id="box-prev-' + h.key + '" style="margin-top:8px;position:relative;display:' + (adaFoto ? 'inline-block' : 'none') + ';">' +
        pratinjau +
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
    // Catatan tidak wajib lagi
    return false;
  }

  function gambarFormulir() {
    var t = J.todayISO();
    document.getElementById('habitGrid').innerHTML = H.list.map(function (h) {
      var v = isian[h.key] || { nilai: '', catatan: '', foto: '', adaFoto: false };
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
          isian[k].adaFoto = true;
          adaPerubahan = true;
          var img = document.getElementById('img-prev-' + k);
          if (img && img.tagName === 'IMG') img.src = dataUrl;
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
        isian[k].adaFoto = false;
        adaPerubahan = true;
        document.getElementById('box-prev-' + k).style.display = 'none';
        document.querySelector('.lbl-foto-' + k).textContent = 'Unggah Foto';
      });
    });
  }

  /* ============================================================
     DRAFTER: SIMPAN YANG SEDANG DIISIH SECARA OTOMATIS
     ------------------------------------------------------------
     Dulunya isian hanya hidup di memori. Kalau murid menutup tab
     di tengah mengisi (atau HP-nya restart), semua yang diketik
     hilang dan harus diisi ulang dari nol.

     Sekarang setiap ketikan disimpan ke localStorage, dengan kunci
     yang mencakup NIS + tanggal. Jadi:
       - Murid keluar lalu buka lagi -> isian kembali utuh
       - Berpindah hari -> draf hari lama tidak ikut terbawa
     Foto TIDAK ikut disimpan (bisa berukuran besar).
     ============================================================ */
  var KUNCI_DRAF = 'j7_draft_';
  var _tundaDraf = null;
  var punyaDrafDipulihkan = false;

  function kunciDraf() {
    return KUNCI_DRAF + (siswa ? siswa.nis : 'x') + '_' + J.todayISO();
  }

  function simpanDraf() {
    if (!siswa) return;
    try {
      var bersih = {};
      var ada = false;
      H.list.forEach(function (h) {
        var v = isian[h.key] || {};
        if (String(v.nilai || '').trim() === '' && String(v.catatan || '').trim() === '' && !v.adaFoto) return;
        bersih[h.key] = { nilai: v.nilai || '', catatan: v.catatan || '', adaFoto: !!v.adaFoto };
        ada = true;
      });
      if (ada) localStorage.setItem(kunciDraf(), JSON.stringify(bersih));
      else localStorage.removeItem(kunciDraf());
    } catch (e) { /* localStorage penuh - draf adalah pelengkap, bukan kritis */ }
  }

  function muatDraf() {
    if (!siswa) return false;
    try {
      var raw = localStorage.getItem(kunciDraf());
      if (!raw) return false;
      var d = JSON.parse(raw);
      if (!d) return false;
      var ada = false;
      H.list.forEach(function (h) {
        var v = d[h.key];
        if (!v) return;
        /* Draf hanya dipulihkan kalau isian server kosong untuk
           kebiasaan ini. Kalau server sudah punya isian (mis. dari
           perangkat lain), data server yang lebih trustworthy. */
        if (isian[h.key] && String(isian[h.key].nilai || '') !== '') return;
        if (String(v.nilai || '') !== '' || String(v.catatan || '') !== '') {
          isian[h.key] = v;
          if (String(v.nilai || '') !== '') ada = true;
        }
      });
      if (ada) punyaDrafDipulihkan = true;
      return ada;
    } catch (e) { return false; }
  }

  function hapusDraf() {
    if (!siswa) return;
    try { localStorage.removeItem(kunciDraf()); } catch (e) {}
  }

  /* Tunda penulisan draf supaya tidak localStorage pada tiap ketikan. */
  function jedaDraf() {
    clearTimeout(_tundaDraf);
    _tundaDraf = setTimeout(simpanDraf, 600);
  }

  function setIsian(k, nilai) {
    if (!isian[k]) isian[k] = { nilai: '', catatan: '', foto: '', adaFoto: false };
    isian[k].nilai = nilai == null ? '' : String(nilai);
    adaPerubahan = true; /* Menandai bahwa murid sedang mengetik/mengubah form */
    jedaDraf();

    var h = H.byKey(k) || H.safe(k);
    var kartu = document.querySelector('[data-kartu="' + k + '"]');
    var badge = document.querySelector('[data-kartu="' + k + '"] .habit-state');
    var terisi = isian[k].nilai !== '';
    var centang = !!(h && h.type === 'check' && isian[k].nilai === '1');
    if (kartu) {
      kartu.classList.toggle('filled', terisi || isian[k].catatan !== '' || !!isian[k].foto || !!isian[k].adaFoto);
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
    
    /* Tombol simpan TIDAK pernah dikunci: centang satu saja sudah
       boleh disimpan, tidak perlu menunggu semua 7 terisi. */
    if (sedangSimpan) return;
    var label = n > 0
      ? '<i class="fa-solid fa-floppy-disk"></i> Simpan (' + n + ')'
      : '<i class="fa-solid fa-floppy-disk"></i> Simpan';
    var btn = document.getElementById('btnSimpanSemua');
    if (btn) { btn.disabled = false; btn.innerHTML = label; }
    var btnH = document.getElementById('btnSimpanHeader');
    if (btnH) btnH.innerHTML = label;
    // Progress bar yang jelas
    var bar = document.getElementById('progressBar');
    var barText = document.getElementById('progressText');
    if (bar) bar.style.width = persen + '%';
    if (barText) barText.textContent = n + '/' + H.total() + ' (' + persen + '%)';
  }

  /* ============================================================
     SIMPAN JURNAL
     ------------------------------------------------------------
     Lima perbaikan yangrequested Tuan setelah mencoba bersama
     pacarnya:

     1. DULU: tidak ada notifikasi sama sekali setelah simpan.
        Murid menekan tombol lalu tidak tahu apa-apa terjadi.
        SEKARANG: toast.success + tombol jadi "Tersimpan".

     2. DULU: ada DUA tombol simpan (atas & bawah) keduanya
        memanggil fungsi yang sama - murid bingung.
        SEKARANG: tombol HEADER disembunyikan saat form terbuka.

     3. DULU: setelah simpan, murid bisa langsung simpan lagi
        sehingga data dobel di sheet.
        SEKARANG: dikunci sampai tanggal berganti.

     4. Draft otomatis: isian disimpan lokal, jadi keluar-masuk
        halaman tidak menghilangkan hasil kerja murid.

     5. Tombol menampilkan jumlah isian yang akan dikirim, jadi
        murid tahu apa yang sedang dikirim.
     ============================================================ */
  function simpanSemua() {
    if (sedangSimpan) return;   /* cegah klik ganda */

    var salah = validasiCatatan();
    if (tolakCatatanKosong(salah)) return;

    var t = J.todayISO();

    /* KUNCI HARI INI: kalau semua kebiasaan sudah punya entri
       di server untuk tanggal ini, tidak ada yang perlu dikirim.
       Ini yang mencegah baris dobel menumpuk di sheet. */
    var sudahDikirim = 0;
    var items = [];
    H.list.forEach(function (h) {
      var v = isian[h.key] || { nilai: '', catatan: '', foto: '', adaFoto: false };
      if (!v.nilai && !v.catatan && !v.adaFoto) return;
      var sudah = J.entryOf(siswa.nis, t, h.key, siswa.kelasId);
      if (sudah && String(sudah.nilai || '') === String(v.nilai || '') &&
          String(sudah.catatan || '') === String(v.catatan || '')) {
        sudahDikirim++;   /* isian identik, tidak perlu dikirim lagi */
        return;
      }
      if (v.foto) J.simpanFoto(siswa.nis, t, h.key, v.foto, siswa.kelasId);
      items.push(J.buildEntry(siswa, t, h.key, v.nilai, v.catatan, !!v.adaFoto || !!v.foto));
    });

    if (!items.length) {
      if (sudahDikirim > 0) {
        return J.toast('Sudah tersimpan',
          'Semua isian hari ini sudah ada di server. Tidak ada yang perlu dikirim lagi.', 'ok');
      }
      return J.toast('Belum ada isian', 'Isi minimal satu kebiasaan dulu.', 'warn');
    }

    /* Kunci KEDUA tombol selama proses, dan tampilkan jumlahnya
       supaya murid tahu persis apa yang sedang dikirim. */
    var labelSending = '<i class="fa-solid fa-circle-notch spin"></i> Mengirim ' + items.length + '...';
    var btn = document.getElementById('btnSimpanSemua');
    var btnH = document.getElementById('btnSimpanHeader');
    if (btn) { btn.disabled = true; btn.innerHTML = labelSending; }
    if (btnH) { btnH.disabled = true; btnH.innerHTML = labelSending; }
    sedangSimpan = true;
    adaPerubahan = false;
    simpanDraf();   /* draf tetap disimpan sebagai pengaman */

    var labelOk = '<i class="fa-solid fa-check"></i> Tersimpan';
    var labelGagal = '<i class="fa-solid fa-floppy-disk"></i> Simpan';
    J.simpanEntries(items, function (r) {
      sedangSimpan = false;
      if (btn) { btn.disabled = false; btn.innerHTML = labelOk; }
      if (btnH) { btnH.disabled = false; btnH.innerHTML = labelOk; }

      if (r.ok) {
        /* NOTIFIKASI SUKSES - ini yang tadinya hilang sama sekali */
        if (r.confirmed) {
          J.toast('Jurnal tersimpan', items.length + ' kebiasaan untuk hari ini sudah masuk database.', 'ok');
          hapusDraf();
        } else {
          J.toast('Tersimpan di perangkat',
            items.length + ' isian menunggu sinyal. Akan dikirim otomatis - jangan tutup halaman.', 'warn');
        }
        gambarFormulir();
        muatRekap(false);
        perbaruiAntrean();
        try { if (document.getElementById('btnSync')) { J.syncAll(function () {}); } } catch (e) {}
        /* Kembalikan label normal setelah 2,5 detik supaya tombol
           tidak terlihat "macet" di status berhasil. */
        setTimeout(function () {
          if (sedangSimpan) return;
          var lb = '<i class="fa-solid fa-floppy-disk"></i> Simpan';
          if (btn) btn.innerHTML = lb;
          if (btnH) btnH.innerHTML = lb;
        }, 2500);
      } else {
        if (btn) btn.innerHTML = labelGagal;
        if (btnH) btnH.innerHTML = labelGagal;
        J.toast('Gagal menyimpan', (r && r.msg) || 'Coba lagi beberapa saat lagi.', 'err');
        perbaruiAntrean();
      }
    });
  }
  function on(id, ev, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(ev, fn);
  }
  on('btnSimpanSemua', 'click', function () { simpanSemua(); });
  on('btnSimpanHeader', 'click', function () { simpanSemua(); });
  on('btnRiwayat', 'click', function () { muatRekap(true); });

  function setFormTerbuka(v) {
    formTerbuka = v;
    var f = document.getElementById('bukaForm');
    if (f) f.style.display = v ? '' : 'none';
    var b = document.getElementById('btnIsi');
    if (b) b.innerHTML = v ? '<i class="fa-solid fa-eye-slash"></i> Sembunyikan' : '<i class="fa-solid fa-pen"></i> Isi Jurnal';

    /* TOMBOL GANDA. Dulu ada dua tombol "Simpan" yang keduanya
       memanggil fungsi yang sama (satu di header kartu, satu di
       bawah formulir). Murid bingung dan tidak tahu mana yang benar.
       Sekarang: ketika formulir TERBUKA, tombol header disembunyikan
       supaya hanya ada satu tombol simpan yang terlihat.
       Saat formulir tertutup, tombol header kembali muncul sebagai
       jalan pintas. */
    var btnH = document.getElementById('btnSimpanHeader');
    if (btnH) {
      btnH.style.display = v ? 'none' : '';
      /* Jangan sampai tombol header tetap terkunci dari proses
         simpan sebelumnya. */
      if (!v && sedangSimpan) { btnH.disabled = false; btnH.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan'; }
    }
    if (v) setTimeout(function () { if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 40);
  }
  on('btnIsi', 'click', function () { setFormTerbuka(!formTerbuka); });
  on('btnTutupForm', 'click', function () { setFormTerbuka(false); });
  on('btnTutupForm2', 'click', function () { setFormTerbuka(false); });

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

  function setTeks(id, nilai) {
    var el = document.getElementById(id);
    if (el) el.textContent = nilai;
  }

  function muatRekap(paksaToast) {
    var r = J.rekapSiswa(siswa.nis, rentangHari, siswa.kelasId);
    setTeks('statHariAktif', r.hariAktifJml);
    setTeks('statPoin', r.rataPoin);
    setTeks('statStreak', r.streak);
    setTeks('strekTeks', r.streak + ' hari');
    setTeks('lencanaDimiliki', r.lencana.length + ' / ' + H.lencana.length);

    var bangun = r.perHabit.find(function (p) { return p.key === 'bangun'; });
    setTeks('statBangun', bangun && bangun.rataWaktu ? bangun.rataWaktu : '-');
    var tb = document.getElementById('targetBangun');
    if (tb) tb.textContent = H.toHM(H.parseHM(H.targetOf('bangun')) || 330);

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
        if (persen > 100) persen = 100;
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

    var rekapList = document.getElementById('rekapList');
    if (rekapList) {
      rekapList.innerHTML = r.perHabit.map(function (p) {
        return '<div class="rekap-item"><div class="ri-no" style="background:' + p.color + '">' + p.no + '</div><div class="ri-body"><div class="ri-title"><strong>' + J.esc(p.title) + '</strong><span>' + p.persen + '%</span></div><div class="progress thin"><i style="width:' + p.persen + '%;background:' + p.color + '"></i></div><div class="text-xs text-muted mt-1">' + p.jumlah + ' dari 7 hari terisi &middot; skor ' + p.rataSkor + '</div></div></div>';
      }).join('');
    }

    var sudah = {};
    r.lencana.forEach(function (l) { sudah[l.key] = true; });
    var htmlLencana = H.lencana.map(function (l) {
      var dapat = !!sudah[l.key];
      return '<div class="lencana' + (dapat ? '' : ' locked') + '" title="' + J.esc(l.desc) + '">' +
        '<i class="' + l.icon + '"></i>' +
        '<span>' + (dapat ? l.label : 'Terkunci') + '</span>' +
        '<small>' + l.butuh + 'x</small></div>';
    }).join('');
    var lg = document.getElementById('lencanaGrid');
    if (lg) lg.innerHTML = htmlLencana;

    var riwayatList = document.getElementById('riwayatList');
    if (riwayatList) {
      var hariAda = Object.keys(r.harian).sort().reverse().slice(0, 5);
      riwayatList.innerHTML = hariAda.length ? hariAda.map(function (d) {
        var hr = r.harian[d];
        return '<div class="list-row"><div class="list-avatar"><i class="fa-solid fa-calendar-day"></i></div><div class="list-main"><h4>' + J.esc(J.fmtHari(d)) + ', ' + J.esc(J.fmtTanggal(d)) + '</h4><p>' + hr.jumlah + '/7 kebiasaan &middot; Poin: ' + hr.poin + '</p></div></div>';
      }).join('') : '<div class="empty">Belum ada riwayat</div>';
    }

    /* Catatan dari guru */
    muatCatatan();

    if (paksaToast) J.toast('Rekap diperbarui', 'Menampilkan data terbaru.', 'ok');
  }

  function muatCatatan() {
    var catatan = J.catatanUntuk(siswa.nis, siswa.kelasId);
    var card = document.getElementById('cardCatatan');
    if (!card) return;
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

  function muatSemua(paksaToast) {
    if (!siswa) pasangIdentitas();
    if (!siswa) return;
    /* Jangan sentuh formulir kalau murid sedang mengetik. Ini penting
       karena sekarang render pertama bisa terjadi SEBELUM sinkron
       selesai — jadi sinkron bisa tiba tepat saat murid mulai isi. */
    if (!adaPerubahan) {
      /* Data tersimpan di server jadi acuan utama... */
      muatIsianHariIni();
      /* ...lalu timpa dengan draf lokal yang belum sempat terkirim.
         Draf menang supaya ketikan yang belum tersimpan tidak hilang.
         Dipanggil SESUDAH muatIsianHariIni dan SEBELUM gambarFormulir,
         karena gambarFormulir membaca isian untuk menggambar UI. */
      muatDraf();
      gambarFormulir();
      setFormTerbuka(true);
      /* Beri tahu kalau(isian yang diketik sebelumnya berhasil dipulihkan. */
      if (punyaDrafDipulihkan) {
        J.toast('Isian dipulihkan',
          'Ada isian yang belum sempat tersimpan. Lengkapi lalu tekan Simpan.', 'warn');
        punyaDrafDipulihkan = false;
      }
    }
    muatSapaan();
    muatRekap(paksaToast !== false);
  }

  /* ============================================================
     TAMPILKAN DULU DARI CACHE, BARU SINKRON DI BELAKANG
     ------------------------------------------------------------
     VERSI LAMA (murid.js saja): halaman ini menunggu balasan API
     dulu sebelum menampilkan apa pun. Itu 2-4 detik hampa karena
     sheet masih 2.527 baris duplikat.

     SEKARANG: tampilkan dari localStorage (0,01 detik, tanpa
     jaringan), lalu segarkan di belakang. Bila cache kosong,
     perilaku lama dipertahankan persis. Bila sinkron gagal tapi
     cache ada, tampilan tetap utuh - murid tidak pernah melihat
     halaman kosong.

     CATATAN: core.js sudah memuat cache ke state.* sebelum
     script ini dijalankan, jadi J.state di sini sudah terisi.
     ============================================================ */
  var adaCacheLokal = !!(J.state.students && J.state.students.length);

  if (adaCacheLokal) {
    /* Cache ada -> tampilkan SEKETIKA, tanpa menunggu server. */
    pasangIdentitas();
    muatSemua(false);          /* false = jangan munculkan toast */
    perbaruiAntrean();
  } else {
    /* Belum pernah dibuka di perangkat ini -> tidak ada yang bisa
       ditampilkan, jadi tunggu server seperti biasa. */
    document.getElementById('identitas').textContent = 'Memuat data...';
  }

  J.syncAll(function (r) {
    sinkronSelesai = true;
    if (!r.ok) {
      /* Cache tetap ditampilkan; hanya bar status yang diberi tahu.
         Murid bisa tetap jalan dengan data terakhir, bukan kosong. */
      if (adaCacheLokal) {
        tampilkanStatus('Menampilkan data dari cache perangkat. ' + r.msg, 'warn');
      } else {
        tampilkanStatus('Database belum terbaca: ' + r.msg, 'danger');
      }
      return;
    }
    pasangIdentitas();
    /* Kalau cache sudah ditampilkan duluan, jangan toast lagi. */
    muatSemua(!adaCacheLokal);
    perbaruiAntrean();
    /* Bar status dibersihkan begitu sinkron berhasil, supaya pesan
       "dari cache perangkat" tidak nempel setelah data segar masuk. */
    sembunyikanStatus();

    /* PERINGATAN TANGGAL RUSAK. Tanpa ini, gejalanya "rekap selalu 0"
       dan;Tuan mengira aplikasinya rusak. Padahal penyebabnya ada di
       sheet, bukan di kode. Guru perlu diberi tahu agar menjalankan
       menu "Jurnal 7 Kebiasaan - Perbaiki Tanggal & Jam". */
    if (r.tanggalRusak > 0) {
      J.toast('Rekap belum terbaca',
        'Sebagian data tanggal rusak di database (' + r.tanggalRusak + ' baris, contoh ' +
        (r.contohTanggalRusak || '-') + '). Minta guru membuka spreadsheet lalu pilih ' +
        'Jurnal 7 Kebiasaan - Perbaiki Tanggal & Jam.', 'warn');
    }

    /* INI FIX BUG KERISET: Saat auto-sync, JANGAN render ulang form jika ada perubahan! */
    J.mulaiAutoSync(function () {
      pasangIdentitas();
      muatSapaan();
      muatRekap(false);
      perbaruiAntrean();
      /* Fungsi muatIsianHariIni() & gambarFormulir() dihapus dari sini! */
    });
  });
})();
