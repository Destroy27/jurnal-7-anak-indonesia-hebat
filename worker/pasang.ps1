# ============================================================
# PASANG JEJAK 7 KAIH KE CLOUDFLARE
# ------------------------------------------------------------
# Skrip ini mengerjakan SEMUA langkah setelah Tuan masuk akun.
# Tinggal jalankan dua kali:
#
#   1. npx wrangler login     (butuh Tuan, buka browser)
#   2. .\pasang.ps1            (skrip ini, sisanya otomatis)
#
# Jalankan ulang skrip ini kapan saja aman - semua langkahnya
# aman diulang karena tidak menghapus apa pun yang tidak
# diperlukan.
#
# CARA JALANKAN:
#   Klik kanan berkas ini di Explorer -> "Run with PowerShell"
#   atau buka PowerShell di folder ini lalu ketik:  .\pasang.ps1
#
# Kalau PowerShell menolak dengan pesan "running scripts is
# disabled", jalankan DULU perintah ini sekali saja:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# ============================================================

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

# Pastikan kita berada di folder ini, apa pun folder asalnya.
# Penting: npx mencari program di folder saat ini. Kalau Tuan
# menjalankan skrip ini dengan klik-klik, folder saat ini bisa
# saja bukan folder worker - lalu npx tidak menemukan wrangler
# dan gagal.
Set-Location $PSScriptRoot

# Hilangkan animasi supaya tidak berantakan di layar
try { $Host.UI.RawUI.WindowTitle = 'Pasang JEJAK 7 KAIH ke Cloudflare' } catch { }

$API  = 'https://script.google.com/macros/s/AKfycbw6G4vDvW1eo237lnk3O-OITMpw76CjXLmegXYCggvsgE3j2RcCNtfiJZwbZd136bcn/exec'
$NAMA = 'jejak7'
$TOML = Join-Path $PSScriptRoot 'wrangler.toml'

function Judul {
  param([string]$T)
  Write-Host ''
  Write-Host ('=' * 62) -ForegroundColor DarkGray
  Write-Host "  $T" -ForegroundColor Cyan
  Write-Host ('=' * 62) -ForegroundColor DarkGray
}
function Oke   { param([string]$T) Write-Host "  [OK]   $T" -ForegroundColor Green }
function Info  { param([string]$T) Write-Host "  [i]    $T" -ForegroundColor Gray }
function Gagal { param([string]$T) Write-Host "  [GAGAL] $T" -ForegroundColor Red }
function Tanya { param([string]$T) Write-Host "  [?]    $T" -ForegroundColor Yellow }

# ------------------------------------------------------------
Judul 'LANGKAH 1 dari 8 - cek sudah masuk akun?'
# ------------------------------------------------------------
$who = (& npx wrangler whoami 2>&1 | Out-String)
if ($who -match 'not authenticated') {
  Gagal 'Belum masuk akun Cloudflare.'
  Write-Host ''
  Write-Host '  Jalankan ini lebih dulu:' -ForegroundColor White
  Write-Host ''
  Write-Host '      npx wrangler login' -ForegroundColor Yellow
  Write-Host ''
  Write-Host '  Browser akan terbuka. Klik "Allow" sampai muncul' -ForegroundColor White
  Write-Host '  tulisan "Successfully logged in".' -ForegroundColor White
  Write-Host ''
  Write-Host '  Setelah itu, jalankan skrip ini lagi.' -ForegroundColor White
  Write-Host ''
  Read-Host '  Tekan Enter untuk menutup'
  exit 1
}
Oke 'Sudah masuk akun Cloudflare.'

# ------------------------------------------------------------
Judul 'LANGKAH 2 dari 8 - siapkan database D1'
# ------------------------------------------------------------
$daftar = (& npx wrangler d1 list --json 2>$null | Out-String)
$id = $null
if ($daftar.Trim()) {
  $j = $daftar | ConvertFrom-Json
  $ada = @($j | Where-Object { $_.name -eq $NAMA })
  if ($ada.Count -ge 1) {
    $id = $ada[0].uuid
    Oke "Database '$NAMA' sudah ada. Dipakai yang ini."
  }
}
if (-not $id) {
  Info "Membuat database '$NAMA'..."
  $buat = (& npx wrangler d1 create $NAMA 2>&1 | Out-String)
  $m = [regex]::Match($buat, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}')
  if (-not $m.Success) {
    Gagal 'Database gagal dibuat. Pesan dari Cloudflare:'
    Write-Host $buat -ForegroundColor DarkGray
    Read-Host '  Tekan Enter untuk menutup'
    exit 1
  }
  $id = $m.Value
  Oke "Database '$NAMA' dibuat."
}
Info "database_id = $id"

# ------------------------------------------------------------
Judul 'LANGKAH 3 dari 8 - tulis database_id ke wrangler.toml'
# ------------------------------------------------------------
if (-not (Test-Path $TOML)) { Gagal "Berkas $TOML tidak ditemukan."; Read-Host '  Tekan Enter'; exit 1 }
$t = [System.IO.File]::ReadAllText($TOML)
$lama = [regex]::Match($t, 'database_id\s*=\s*"([^"]*)"').Groups[1].Value
$t2 = [regex]::Replace($t, 'database_id\s*=\s*"[^"]*"', ('database_id = "' + $id + '"'))
if ($t2 -ne $t) {
  [System.IO.File]::WriteAllText($TOML, $t2, (New-Object System.Text.UTF8Encoding($false)))
  if ($lama -like '0000*') { Oke 'Placeholder diganti dengan database_id asli.' }
  else { Info "database_id diperbarui (sebelumnya $lama)." }
} else { Oke 'wrangler.toml sudah benar.' }

# ------------------------------------------------------------
Judul 'LANGKAH 4 dari 8 - buat tabel di database'
# ------------------------------------------------------------
Info 'Menjalankan berkas migrations/0001_init.sql ke server...'
$skema = (& npx wrangler d1 execute $NAMA --remote --file=migrations/0001_init.sql 2>&1 | Out-String)
if ($skema -match 'error|Error|ERROR') {
  Gagal 'Gagal membuat tabel. Pesan:'
  Write-Host $skema -ForegroundColor DarkGray
  Read-Host '  Tekan Enter untuk menutup'
  exit 1
}
if ($skema -match 'already exists') { Oke 'Tabel sudah ada, dilewati.' }
else { Oke 'Tabel berhasil dibuat.' }

# ------------------------------------------------------------
Judul 'LANGKAH 5 dari 8 - unduh data yang sekarang ada'
# ------------------------------------------------------------
$json = Join-Path $PSScriptRoot 'get_all.json'
Info 'Mengambil data langsung dari backend yang sekarang...'
try {
  curl.exe -sL -g --compressed -o $json --url ($API + '?action=get_all')
} catch {
  Gagal 'Gagal mengunduh data.'
  Read-Host '  Tekan Enter untuk menutup'
  exit 1
}
if (-not (Test-Path $json)) { Gagal 'Berkas get_all.json tidak terbentuk.'; Read-Host '  Tekan Enter'; exit 1 }
$ukuran = [math]::Round((Get-Item $json).Length / 1KB)
$d = Get-Content $json -Raw | ConvertFrom-Json
Oke ("Data terunduh: {0} KB, {1} siswa, {2} baris jurnal." -f $ukuran, $d.jumlahSiswa, $d.jumlahEntri)

# ------------------------------------------------------------
Judul 'LANGKAH 6 dari 8 - rapikan data (hapus duplikat)'
# ------------------------------------------------------------
$sql = Join-Path $PSScriptRoot 'impor.sql'
if (Test-Path $sql) { Remove-Item $sql -Force }
Info 'Mengambil hanya satu baris terbaru untuk tiap kombinasi...'
$hasil = (& node tools/impor-dari-spreadsheet.mjs $json $sql 2>&1 | Out-String)
$hasil.Trim() -split "`n" | ForEach-Object { Write-Host "         $_" -ForegroundColor DarkGray }
if (-not (Test-Path $sql)) { Gagal 'impor.sql tidak terbentuk.'; Read-Host '  Tekan Enter'; exit 1 }
Oke ("SQL siap: {0:N0} baris." -f ([System.IO.File]::ReadAllLines($sql).Count))

# ------------------------------------------------------------
Judul 'LANGKAH 7 dari 8 - masukkan data ke database'
# ------------------------------------------------------------
$masuk = (& npx wrangler d1 execute $NAMA --remote --file=impor.sql 2>&1 | Out-String)
if ($masuk -match 'ERROR') {
  Gagal 'Gagal memasukkan data. Pesan:'
  Write-Host $masuk -ForegroundColor DarkGray
  Read-Host '  Tekan Enter untuk menutup'
  exit 1
}
Oke 'Data masuk ke database.'
$cek = (& npx wrangler d1 execute $NAMA --remote --command='SELECT (SELECT COUNT(*) FROM siswa) AS siswa, (SELECT COUNT(*) FROM jurnal) AS entri' 2>&1 | Out-String)
$c1 = [regex]::Match($cek, '"siswa":\s*(\d+)')
$c2 = [regex]::Match($cek, '"entri":\s*(\d+)')
if ($c1.Success -and $c2.Success) {
  Info ("Isi database sekarang: {0} siswa, {1} entri." -f $c1.Groups[1].Value, $c2.Groups[1].Value)
  if ([int]$c2.Groups[1].Value -lt 10) {
    Tanya 'Jumlahnya kecil. TETAP lanjutkan?'
    if ((Read-Host '  ketik Lanjut untuk setuju') -notmatch '(?i)lanjut') {
      Write-Host '  Dihentikan. Tidak ada yang diubah.' -ForegroundColor Yellow
      Read-Host '  Tekan Enter untuk menutup'
      exit 1
    }
  }
}

# ------------------------------------------------------------
Judul 'LANGKAH 8 dari 8 - pasang ke internet'
# ------------------------------------------------------------
Info 'Mengunggah Worker ke Cloudflare...'
$deploy = (& npx wrangler deploy 2>&1 | Out-String)
$alamat = [regex]::Match($deploy, 'https://[a-z0-9\-]+\.workers\.dev').Value
if (-not $alamat) {
  Tanya 'Deploy selesai tapi alamat tidak terbaca. Tampilkan semua pesan:'
  Write-Host $deploy -ForegroundColor DarkGray
  Read-Host '  Tekan Enter untuk menutup'
  exit 1
}
Oke 'Worker sudah hidup di internet.'

# ------------------------------------------------------------
Write-Host ''
Write-Host ('=' * 62) -ForegroundColor DarkGray
Write-Host '  SELESAI' -ForegroundColor Green
Write-Host ('=' * 62) -ForegroundColor DarkGray
Write-Host ''
Write-Host '  Alamat backend baru:' -ForegroundColor White
Write-Host ''
Write-Host "      $alamat" -ForegroundColor Yellow
Write-Host ''
Write-Host '  UJI DULU sebelum mengganti aplikasi:' -ForegroundColor White
Write-Host "      $alamat?action=get_all" -ForegroundColor DarkGray
Write-Host ''
Write-Host '  Harus muncul angka 13 siswa dan 70 entri.' -ForegroundColor Gray
Write-Host ''
Write-Host '  Kalau angkanya sudah benar, beri tahu saya saja. Saya'
Write-Host '  yang ganti satu baris di site-config.js supaya Tuan'
Write-Host '  tidak perlu mengedit berkas sendiri.'
Write-Host ''
Write-Host '  PENTING: alamat ini belum dipakai aplikasi. Yang'
Write-Host '  presentasi sekarang masih aman dan tidak berubah.' -ForegroundColor DarkGray
Write-Host ''
$alamat | Set-Clipboard
Write-Host '  (alamat sudah disalin ke clipboard Tuan)' -ForegroundColor DarkGray
Write-Host ''
Read-Host '  Tekan Enter untuk menutup'