#Requires -Version 5.1
<#
  push-revisi.ps1
  ------------------------------------------------------------------
  Commit + push revisi JEJAK 7 KAIH ke GitHub Pages.

  Yang di-push (12 file):
    assets/css/components.css   nav: 1 logo, judul JEJAK 7 KAIH
    assets/css/pages.css        kartu pengenalan, kartu fungsi,
                                kartu 7 kebiasaan lebih rapat,
                                rekap harian
    assets/js/core.js           logo utama, bug perluBantu
    assets/js/guru.js           rentang 7 hari, label "X dari Y
                                siswa", blok Rekap Harian
    assets/js/login.js          judul browser
    assets/js/murid.js          judul browser
    assets/js/ortu.js           judul browser
    assets/js/site-config.js    catatan nama file logo
    index.html                  nav + kartu pengenalan + kartu
                                7 kebiasaan
    murid.html / guru.html / ortu.html   nav

  Yang SENGAJA tidak di-push:
    preview/  -> screenshot verifikasi (sudah di-ignore)

  Pakai:  .\push-revisi.ps1          (langsung push)
         .\push-revisi.ps1 -DryRun  (lokas saja, tidak push)
#>

[CmdletBinding()]
param(
  [switch]$DryRun,
  [switch]$SkipPush
)

$ErrorActionPreference = 'Stop'

# ------------------------------------------------------------------
# 1. Pastikan kita di folder repository yang benar
# ------------------------------------------------------------------
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path (Join-Path $root '.git'))) {
  Write-Host "[GAGAL] Folder ini bukan repository git: $root" -ForegroundColor Red
  Write-Host "       Buka folder yang punya .git, lalu jalankan lagi." -ForegroundColor Red
  exit 1
}
Set-Location $root
Write-Host "Folder  : $root"
Write-Host "Branch  : $(git branch --show-current)"
Write-Host "Remote  : $(git remote get-url origin)"
Write-Host ''

# ------------------------------------------------------------------
# 2. Pastikan tidak ada perubahan yang belum sengaja di-staging
#    dan tidak ada file besar yang ikut terbawa
# ------------------------------------------------------------------
$staged = git diff --cached --name-only
if ($staged) {
  Write-Host '[GAGAL] Sudah ada file yang di-staging sebelumnya:' -ForegroundColor Red
  $staged | ForEach-Object { Write-Host "         $_" -ForegroundColor Red }
  Write-Host '       Bersihkan dulu dengan:  git reset' -ForegroundColor Red
  exit 1
}

# ------------------------------------------------------------------
# 3. Daftar file yang boleh ikut
# ------------------------------------------------------------------
$files = @(
  'assets/css/components.css'
  'assets/css/pages.css'
  'assets/js/core.js'
  'assets/js/guru.js'
  'assets/js/login.js'
  'assets/js/murid.js'
  'assets/js/ortu.js'
  'assets/js/site-config.js'
  'index.html'
  'murid.html'
  'guru.html'
  'ortu.html'
)

$missing = $files | Where-Object { -not (Test-Path $_) }
if ($missing) {
  Write-Host '[GAGAL] File berikut tidak ditemukan:' -ForegroundColor Red
  $missing | ForEach-Object { Write-Host "         $_" -ForegroundColor Red }
  exit 1
}

# ------------------------------------------------------------------
# 4. Stage hanya file itu
# ------------------------------------------------------------------
foreach ($f in $files) { git add -- $f }
if ($LASTEXITCODE -ne 0) {
  Write-Host '[GAGAL] git add bermasalah.' -ForegroundColor Red
  exit 1
}

# Kalau ada sisa file lain di luar daftar, jangan ikut di-commit.
# Catatan: harus StartsWith('??'), bukan -like '??*' — di PowerShell
# tanda ? adalah wildcard yang cocok dengan karakter apa saja, jadi
# -like '??*' ikut mencocokkan file yang sudah di-stage.
$sisa = @(git status --porcelain | Where-Object { $_.StartsWith('??') })
if ($sisa.Count -gt 0) {
  Write-Host 'Tidak ikut di-commit:' -ForegroundColor DarkGray
  $sisa | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
  Write-Host ''
}

# ------------------------------------------------------------------
# 5. Tampilkan ringkasan sebelum commit
# ------------------------------------------------------------------
Write-Host 'Perubahan yang akan di-commit:' -ForegroundColor Cyan
git diff --cached --stat
Write-Host ''

# ------------------------------------------------------------------
# 6. Sanity check ringan: pastikan tidak ada file terlalu besar (>2 MB)
# ------------------------------------------------------------------
$besar = git diff --cached --name-only | ForEach-Object {
  if (Test-Path $_) {
    $kb = [math]::Round((Get-Item $_).Length / 1kb, 1)
    if ($kb -gt 2048) { "$_ ($kb KB)" }
  }
}
if ($besar) {
  Write-Host '[PERINGATAN] File besar kemungkinan ikut:' -ForegroundColor Yellow
  $besar | ForEach-Object { Write-Host "         $_" -ForegroundColor Yellow }
  Write-Host ''
}

# ------------------------------------------------------------------
# 7. Commit
# ------------------------------------------------------------------
$pesan = @'
Rapikan navbar, kartu halaman depan, dan rekap harian guru

Navbar:
- satu logo saja (assets/img/logo-sd.png), logo dobel dihapus
- judul nav jadi "JEJAK 7 KAIH" di keempat halaman
- baris bawah jadi konteks halaman (Panel Guru / Jurnal Saya / Pantau Anak)

Halaman depan:
- judul + keterangan aplikasi jadi 4 kartu pengenalan
- blok Fungsi Kalender dirapikan ke kelas .feat-card
- kartu 7 kebiasaan lebih rapat: lingkaran 96->76px, ikon 32->21px,
  nomor 28->22px, grid minmax 212px, baris 7 kartu tidak melebar

Rekap guru (bug data 1 siswa tidak terlihat):
- rentang default 1 -> 7 hari, jadi chip 7/14/30 ada yang aktif
- label per kebiasaan: "X dari Y siswa · Z isian" supaya 1 dari 8
  siswa tidak terlihat seperti 0%
- tambah blok Rekap Harian: siswa mengisi per tanggal
- bug: perluBantu membaca hariAktifJml yang tidak ada di baris
  rekap kelas, hasilnya selalu kosong. Sekarang = belum mengisi
  jurnal hari ini
- tutup satu <div> yang tidak tertutup di murid.html
'@

# Kalau tidak ada perubahan yang perlu di-commit (mis. revisi ini sudah
# pernah di-commit sebelumnya), berhenti dengan pesan jelas - bukan error.
$perubahan = @(git diff --cached --name-only)
if ($perubahan.Count -eq 0) {
  Write-Host ''
  Write-Host 'Tidak ada perubahan yang perlu di-commit.' -ForegroundColor Yellow
  Write-Host 'Semua revisi sudah tercatat di commit sebelumnya.' -ForegroundColor Yellow
  Write-Host ''
  Write-Host 'Cek commit terakhir:' -ForegroundColor DarkGray
  git log -1 --oneline
  exit 0
}

# Pesan ditulis ke file dulu lalu di-commit dengan -F.
# Kalau pakai -m langsung, PowerShell memecah pesan multi-baris
# jadi banyak argumen terpisah dan git-commit gagal.
$msgFile = Join-Path $env:TEMP 'j7-pesan-commit.txt'
[System.IO.File]::WriteAllText(
  $msgFile,
  ($pesan -replace "`r`n", "`n").Trim(),
  (New-Object System.Text.UTF8Encoding($false))
)

git commit -F $msgFile
$commitOk = ($LASTEXITCODE -eq 0)
Remove-Item $msgFile -Force -ErrorAction SilentlyContinue

if (-not $commitOk) {
  Write-Host '[GAGAL] git commit bermasalah.' -ForegroundColor Red
  Write-Host '       Perubahan tetap aman di folder kerja (tidak hilang).' -ForegroundColor Red
  Write-Host '       Lihat pesan error di atas untuk penyebabnya.' -ForegroundColor Red
  exit 1
}

$hash = (git rev-parse --short HEAD)
Write-Host ''
Write-Host "Commit berhasil: $hash" -ForegroundColor Green
Write-Host ''

# ------------------------------------------------------------------
# 8. Push
# ------------------------------------------------------------------
if ($DryRun) {
  Write-Host 'MODE DRY RUN - tidak ada yang di-push.' -ForegroundColor Yellow
  Write-Host 'Commit sudah dibuat di lokal. Jalankan tanpa -DryRun untuk push.' -ForegroundColor Yellow
  exit 0
}
if ($SkipPush) {
  Write-Host '-SkipPush dipakai: commit disimpan di lokal saja.' -ForegroundColor Yellow
  Write-Host 'Push manual dengan:  git push origin main' -ForegroundColor Yellow
  exit 0
}

Write-Host 'Menekan ke origin/main ...' -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host '[GAGAL] Push ditolak. Kemungkinan penyebab:' -ForegroundColor Red
  Write-Host '  - kredensial GitHub belum masuk (pakai Personal Access Token)' -ForegroundColor Red
  Write-Host '  - ada commit baru di remote' -ForegroundColor Red
  Write-Host ''
  Write-Host 'Commit AMAN di lokal. Coba:  git pull --rebase origin main  lalu ulangi push.' -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host 'Push selesai.' -ForegroundColor Green
Write-Host ''
Write-Host 'Tunggu 1-3 menit, lalu buka:' -ForegroundColor Cyan
Write-Host '  https://destroy27.github.io/jurnal-7-anak-indonesia-hebat/' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Cara memastikan versi baru sudah tampil:' -ForegroundColor DarkGray
Write-Host '  1. Tekan Ctrl+F5 (paksa muat ulang, bukan dari cache)' -ForegroundColor DarkGray
Write-Host '  2. Navbar harus tertulis "JEJAK 7 KAIH" dengan satu logo' -ForegroundColor DarkGray
Write-Host '  3. Login guru -> Panel Guru -> bagian "Kelengkapan Kelas' -ForegroundColor DarkGray
Write-Host '     per Kebiasaan" harus punya sub-judul "Rekap Harian"' -ForegroundColor DarkGray

# Exit eksplisit supaya kode keluar script tidak ikut mewarisi
# nilai balik perintah git terakhir.
exit 0