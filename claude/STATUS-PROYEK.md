
# STATUS PROYEK (RINGKAS) — Zevanic/Gechoo ERP

> **Terakhir diperbarui: 31 Agustus 2026 (malam, lanjutan lagi).** Fitur
> "Pesanan" (Kasir + pipeline, §45/§5.7) sudah di-push Guru ke GitHub,
> bug menu tidak muncul SUDAH DIPERBAIKI & DIKONFIRMASI live (dicek
> `git clone`, fix `auth.js` sudah ada di commit terbaru). Firestore
> Rules 2 koleksi baru Kasir (`transaksi_kasir`,
> `pengaturan_id_transaksi_kasir`) **masih WAJIB di-Publish manual** di
> Firebase Console — blocker keras terpisah, belum dikonfirmasi selesai.
>
> **BARU (31 Agt 2026, lanjutan lagi)**: modul **Persiapan Produksi >
> Bahan** (modul ke-2 dari paket wireframe handoff `Mockup/handoff/`,
> setelah "Perlu Disiapkan" di §5.10) **KODE SUDAH DITULIS & DIKIRIM**
> ke folder `Code`, **BELUM di-push Guru**, **BELUM DIUJI SAMA SEKALI**.
> Ditemukan konflik arsitektur SERIUS sebelum nulis kode — koleksi
> `persiapan_komponen` yang disebut spek modul ini sebagai sumber data
> TERNYATA sudah ditinggalkan Guru sendiri 29 Agt 2026 (§5.10 area
> terkait, ditemukan lewat baca kode `vue-order-spk.js` langsung, bukan
> tebakan). Solusi: field baru `spk_track.bahan_rincian[]`. Rules
> Firestore utk 4 koleksi baru (`bagging`, `tugas_kirim`, `master_tlc`,
> `cetak_ulang_log`) **WAJIB ditempel manual** — belum dikonfirmasi.
> Detail keputusan lengkap: **§5.11**.
>
> **BARU LAGI (1 Sep 2026)**: `firestore.rules` lengkap (file utuh Guru +
> 6 blok baru modul Bahan) sudah dikirim & ditaruh di folder `Code`,
> tinggal Publish. Tab **Selesai** (Bahan) yang di §5.11 sengaja
> placeholder SEKARANG DIBANGUN PENUH (KPI harian + riwayat + siklus +
> "Riwayat Saya" operator) — **tapi akan tampil KOSONG TERUS** sampai
> layar "Scan Sampai" (divisi penerima, di luar lingkup modul Bahan,
> BELUM DIBANGUN di manapun) mulai menulis `sampai_pada`. Detail: **§5.11b**.
> **Ditemukan juga**: 3 modul baru (Acc Sewing/Webbing/Finishing) sudah
> masuk ke `Mockup/handoff/`, siap dikerjakan sesi terpisah, urutan tidak
> boleh dibalik — **§5.11c**.
>
> **BARU LAGI (1 Sep 2026, sesi lanjutan)**: **ke-3 modul Acc Sewing/
> Webbing/Finishing sekaligus KODE SUDAH DITULIS & DIKIRIM** ke folder
> `Code`, atas instruksi eksplisit Guru untuk mengerjakan sekaligus
> (menyimpang dari aturan "satu modul, satu sesi" di README paket
> handoff — **Guru yang memutuskan ini secara sadar**, bukan Claude yang
> mengambil jalan pintas), dan diminta digabung dalam SATU FILE ZIP.
> **BELUM di-push Guru, BELUM DIUJI SAMA SEKALI.** Detail keputusan
> arsitektur lengkap (kartu = 1 `spk_track` per pos, BEDA dari Bahan
> yang kartu = 1 bahan+warna; pola massal-update baru; label 1-per-anak-
> SPK): **§5.11d**.
>
> **REVISI LANJUTAN (30 Agt 2026, sesi lanjutan)** — permintaan Guru
> lihat topbar live via screenshot: badge shift countdown lama
> ("Shift 01:00 | Tepat Waktu...", hardcode salah, `dashboard.js`
> `mulaiHitungJamKerja()`) + h2 "ERP Portal" DICOPOT dari topbar,
> diganti breadcrumb statis gaya mockup; **kartu Absen REAL** (ambil
> dari kartu shift mobile) ditambah di kolom kanan; kartu **"Aktivitas
> Terbaru" & "Pintasan Papan Tik" DIBANGUN** (sebelumnya sengaja
> tidak, lihat §5.9 — Guru membalik keputusan itu secara eksplisit),
> isinya **statis/ilustratif**, bukan data live. 4 file dikirim ulang
> (`index.html`, `css/gechoo-design.css`, `js/vue-home-desktop.js`,
> `js/auth.js` — null-guard). Detail lengkap: §5.9b. **KONFIRMASI
> LIVE** — Guru kirim screenshot `gechoo.online` menunjukkan
> breadcrumb, Kartu Absen, KPI, dan sisi lainnya SUDAH tayang (jadi
> sudah di-push Guru, walau belum ada laporan tertulis eksplisit
> "sudah push" — disimpulkan dari screenshot, bukan tebakan).
>
> **REVISI LANJUTAN KE-2 (30 Agt 2026, sesi lanjutan lagi)** — Guru
> kirim 2 screenshot berdampingan (mockup vs live) + 3 catatan:
> (1) kartu Quote "hilang" di kolom kanan — DICEK, ini BUKAN bug,
> `QuoteCard`/`.gc-quote-desktop` memang by design tidak render kalau
> tidak ada dokumen `quotes` terjadwal hari itu (sama seperti
> mobile) — perlu Guru tambah Quote hari ini lewat Config Info >
> Quote Harian, bukan perbaikan kode; (2) header sidebar diganti
> "Zevanic ERP" + ikon-kotak (dulu "Gechoo ♥" — blok ini SUDAH
> desktop-only dari awal, ganti teks TIDAK menyentuh mobile), topbar
> ditambah **pencarian global (Ctrl K) yang BENERAN berfungsi**
> (bukan cuma visual — baca DOM sidebar, klik hasil = trigger tombol
> sidebar asli); (3) 7 tombol kepala grup sidebar ditambah ikon +
> padding/font-size dirapatkan. 3 file dikirim ulang (`index.html`,
> `css/gechoo-design.css`, `js/dashboard.js`). Detail lengkap: §5.9c.
> **BELUM DI-PUSH GURU, BELUM DIUJI.** Guru langsung nemu 1 bug di
> popup pencarian (selalu tampil pas refresh, bukan cuma pas
> dipanggil) — SUDAH DIPERBAIKI (`css/gechoo-design.css` dikirim
> ulang lagi), detail akar masalah & fix di §5.9c bagian bawah.
> Belum diuji ulang Guru.
>
> **REVISI LANJUTAN KE-3 (30 Agt 2026, sesi lanjutan lagi)** — Guru
> minta 3 hal: (1) nama brand sidebar GANTI LAGI dari "Zevanic ERP"
> jadi **"Zevanic Core Optima"**, plus keluhan header "kepanjangan ke
> bawah" — DICEK ke README paket handoff: `.gc-topbar-desktop` dan
> `.gc-side-brand` ternyata dulu SALAH pakai `height:80px` fixed,
> padahal spec ASLI bilang topbar tinggi **52px** dan header sidebar
> cuma padding-driven (`14px 14px 12px`) — bukan 80px. Dikoreksi ke
> spec asli (BUKAN sekadar diperkecil sembarangan); (2) **bug Quote
> ASLI ditemukan** — Guru sudah isi Quote tapi tetap tidak muncul,
> BEDA dari kesimpulan sesi sebelumnya (yang bilang "by design, belum
> ada data"). Dicek jam server (UTC 18:36 = 01:36 dini hari WIB) —
> KETEMU: `hariIni` di 3 tempat (`QuoteCard`/`vue-components.js`,
> `js/vue-home-desktop.js`, `js/vue-header-mobile.js`) pakai
> `toISOString()` (UTC), BUKAN tanggal lokal — meleset 7 jam tiap hari
> 00:00-06:59 WIB dibanding tanggal yang dipilih admin di form Quote
> Harian. SUDAH DIPERBAIKI (pakai getFullYear/getMonth/getDate, bukan
> toISOString); (3) **"Perlu Tindakan Anda" DIPECAH jadi 2 grup**:
> grup Persiapan (data real, sama seperti Pipeline Persiapan) & grup
> Produksi (placeholder "Segera hadir", konsisten dengan Pipeline
> Produksi — belum ada skema data). 5 file dikirim ulang (`index.html`,
> `css/gechoo-design.css`, `js/vue-components.js`,
> `js/vue-home-desktop.js`, `js/vue-header-mobile.js`). Detail
> lengkap: §5.9d. **BELUM DI-PUSH GURU, BELUM DIUJI.**
>
> **REVISI LANJUTAN KE-4 (30 Agt 2026, sesi lanjutan lagi) — dipertegas
> jadi timezone Asia/Jakarta eksplisit + AUDIT KEAMANAN Absensi/Clock
> In**. Guru tanya "kalau pakai tgl internet Jakarta WIB gimana?" +
> khawatir jam device di-mundurkan biar Clock In "aman". Fix tanggal
> Quote (§5.9d) DIPERTEGAS pakai `toLocaleDateString('en-CA', {timeZone:
> 'Asia/Jakarta'})` — bukan lagi ngikut timezone device apa adanya
> (3 file: `vue-components.js`, `vue-home-desktop.js`, `vue-header-
> mobile.js`). **AUDIT KODE Absensi/Clock In** (dibaca langsung, bukan
> tebakan) — **KABAR BAIK**: timestamp asli Clock In/Out
> (`waktu_ts`/`waktu_masuk_ts`/`waktu_keluar_ts` di `js/vue-camera.js`)
> SUDAH pakai `serverTimestamp()` Firestore (jam SERVER Google, BUKAN
> jam device — TIDAK BISA dipalsukan lewat ubah jam HP), dan status
> Ontime/Terlambat (`hitungStatusKehadiran()` di `js/vue-antrean-
> absensi.js`) SUDAH dihitung dari field `_ts` itu, bukan dari jam
> device — **jam device dimundurkan TIDAK BISA mengubah status
> kehadiran**. **CELAH KECIL ditemukan** (belum diperbaiki, dilaporkan
> ke Guru): teks jam yang TAMPIL ke admin di Antrean Absensi/Riwayat
> All Absensi (`data.waktu`/`data.waktu_masuk`/`data.waktu_keluar`)
> masih dari jam DEVICE (`new Date().toLocaleString('id-ID')`), bisa
> menampilkan teks jam yang salah/dipalsukan walau badge status di
> sebelahnya tetap benar (dari server). Belum ada modul Payroll/Slip
> Gaji sungguhan (dicek, filenya belum ada) yang baca field ini, jadi
> BELUM ada risiko uang — tapi WAJIB dipakai `_ts` (server), BUKAN
> field teks ini, kalau Payroll dibangun nanti. Detail lengkap: §5.9e.
> **BELUM ADA PERUBAHAN KE CELAH INI** — nunggu keputusan Guru.
>
> **REVISI LANJUTAN KE-5 (31 Agt 2026) — rebuild total modul "Perlu
> Disiapkan" (Persiapan Produksi V2) dari wireframe handoff Guru**.
> Guru sediakan paket wireframe handoff baru (folder `Mockup/handoff/`
> di komputer Guru — konvensi BARU: 1 modul per sesi, `SERAH-TERIMA.md`
> + `wireframe.dc.html` + screenshot per modul). Sebelum nulis kode,
> ketahuan wireframe ini TUMPANG TINDIH/BERTABRAKAN arsitektur dengan
> modul "Perlu Disiapkan" yang SUDAH aktif — diklarifikasi ke Guru lewat
> serangkaian AskUserQuestion (bukan tebak-tebak, sesuai kesepakatan
> BARU sesi ini: **kalau Claude nilai suatu keputusan menu kompleks/
> ambigu, WAJIB langsung interupsi Guru saat itu juga**, JANGAN nebak
> dulu baru tanya belakangan — lihat `PEDOMAN-GAYA-KERJA.md`). Hasil:
> **"Ganti total"** modul lama, plus 1 bug LAMA ditemukan & diperbaiki
> (kunci pengelompokan klaster otomatis dulu TIDAK ikut `size`, cuma
> `nama_produk + kunci_pola`). Detail keputusan lengkap, field baru
> (`order_spk.qty_tergrouping`/`grouping_ids`, `spk_grouping.size`), &
> status deploy: **§5.10**. **KODE SUDAH DITULIS & DIKIRIM** ke folder
> `Code` (`index.html`, `css/gechoo-design.css`,
> `js/vue-persiapan-produksi-v2.js`), **BELUM di-push Guru ke repo**,
> **BELUM DIUJI SAMA SEKALI** di browser+Firebase sungguhan.
>
> **Riwayat detail lengkap** (semua koreksi, diskusi, bug-fix step-by-
> step) ada di `STATUS-PROYEK-ARSIP.md` (isi identik dengan versi asli
> dari Cowork, tidak diringkas sama sekali, TIDAK WAJIB dibaca tiap sesi).

---

## 1. Apa proyek ini

Sistem ERP internal untuk **Zevanic/Gechoo** — sudah berkembang JAUH
dari cuma "absensi karyawan" (awal proyek) jadi mencakup **konveksi
penuh**: produksi (BOM, SPK), stok bahan, pembelian, dan sekarang
sedang dibangun **Kasir/Pesanan** + **redesain dashboard desktop**.
Dipakai skala **~500 karyawan** (disebutkan di §44.17, lebih besar dari
perkiraan awal ~89-100).

- **Frontend**: Vue 3 CDN, tanpa build step.
- **Backend**: Firebase (Firestore, Auth, Storage, Cloud Functions di
  repo terpisah).
- **Hosting**: `gechoo.online` lewat GitHub Pages.
- **Repo**: `gechooco-ship-it/zevanic-erp-ui`.
- **Alur kerja kode**: file kode dikirim langsung ke folder
  **`F:\ZEVANIC HOUSE\FOUNDATION\Code`** di komputer Guru lewat koneksi
  perangkat (device bridge). Folder `Code` ini FLAT (semua file
  `.js`/`.html`/`.rules` langsung di root folder, TANPA subfolder `js/`)
  — beda dari struktur repo asli yang punya folder `js/`, jadi saat
  commit file ke sana namanya harus disesuaikan (buang prefix `js/`).
  Guru sendiri yang copy dari folder `Code` ke lokasi kerja repo asli
  lalu `git push`. Sapaan ke pengguna tetap **"Guru"**.
- **Folder `Mockup`** (`F:\ZEVANIC HOUSE\FOUNDATION\Mockup`, tersambung
  lewat device bridge) — berisi paket-paket design handoff (`.dc.html`
  + `README.md` + `github.md` + screenshot) DAN mockup artefak
  (`.html` link claude.ai/code/artifact), TERPISAH dari folder `Code`.
  Isinya referensi visual/spesifikasi, BUKAN kode produksi. **BARU (31
  Agt 2026)**: subfolder `Mockup/handoff/` — konvensi handoff wireframe
  yang LEBIH BAKU (1 modul per sesi, `PEDOMAN-SERAH-TERIMA.md` +
  `SERAH-TERIMA.md` per modul, struktur 9 bagian), lihat §5.10/§5.11.

## 2. Cara kerja sebelum mengerjakan apapun (TIDAK BERUBAH dari versi awal)

1. Baca file ini dulu, lalu `STATUS-PROYEK-ARSIP.md` kalau butuh detail
   spesifik suatu fitur.
2. Baca `PRINSIP-HEMAT.md` + `PEDOMAN-GAYA-KERJA.md` — WAJIB diikuti.
   **BARU (31 Agt 2026)**: `PEDOMAN-GAYA-KERJA.md` sekarang punya aturan
   eksplisit — kalau keputusan MENU kompleks/ambigu, LANGSUNG interupsi
   Guru saat itu juga (AskUserQuestion/chat), JANGAN nebak dulu baru
   tanya belakangan, dan JANGAN nunggu pasif Guru duluan bilang "ini
   kompleks". Lihat §5.10/§5.11 buat contoh penerapannya.
3. **JANGAN PERCAYA** catatan "BELUM ditempel"/"BELUM dites" di section
   LAMA arsip tanpa cek dulu apakah ada section LEBIH BARU yang
   mengoreksi status itu — pola berulang di proyek ini, banyak fitur
   yang statusnya berubah beberapa kali (lihat §12 dst di Arsip).
4. **Kalau ada laporan bug**: JANGAN tebak-tebak — `git clone --depth 1
   https://github.com/gechooco-ship-it/zevanic-erp-ui.git` dulu ke
   sandbox buat baca kode LIVE yang sungguhan (lihat contoh nyata di
   §5.7 — bug "menu Pesanan tidak muncul" ketemu akar masalahnya dalam
   1 ronde `git clone` + `grep`, bukan dari tebakan; contoh lain §5.9d
   — bug Quote ketemu dari cek jam server UTC vs WIB, bukan tebakan;
   §5.9e — audit keamanan Clock In dijawab dengan BACA kode
   `serverTimestamp()`/`hitungStatusKehadiran()` langsung, bukan
   asumsi "pasti aman" atau "pasti bahaya"; §5.10 — klaim Guru soal
   kunci grouping SUDAH ikut `size` DICEK LANGSUNG ke kode, ternyata
   belum, bukan diterima mentah-mentah; §5.11 — spek modul Bahan bilang
   `persiapan_komponen` "sudah ada di repo", DICEK LANGSUNG ke
   `vue-order-spk.js`, ternyata koleksi itu SUDAH ditinggalkan Guru
   sendiri 29 Agt 2026 — spek handoff BISA ketinggalan zaman dari kode
   live, bukan cuma klaim lisan Guru yang perlu dicek).
   Sebelum menulis query Firestore baru, cek juga dulu POLA QUERY yang
   sudah terbukti jalan di modul terkait (lihat §5.9 — semua query
   dashboard Beranda desktop meniru pola yang SUDAH ada di layar
   aslinya masing-masing, bukan ditulis dari nol/tebakan). **Kalau ada
   nilai px/spec visual (tinggi header, padding, dll) yang kelihatan
   janggal, cek ke README paket design handoff DULU sebelum ubah
   sembarangan** — lihat §5.9d poin 1, height 80px yang salah ternyata
   memang menyimpang dari spec asli (52px), bukan cuma "kelihatan
   kegedean".
5. **Kalau ada field tanggal/jam yang berpotensi disalahgunakan
   (Absensi, Lembur, apa pun yang dipakai buat status/gaji)**: WAJIB
   pastikan field yang dipakai untuk KEPUTUSAN (status, gaji, approval)
   berasal dari `serverTimestamp()` Firestore (field `_ts`, jam server
   Google — TIDAK BISA dipalsukan device), BUKAN dari `new Date()` di
   browser (field teks tanpa `_ts` — jam device, BISA dipalsukan kalau
   device di-root/jailbreak atau jamnya diubah manual). Lihat §5.9e
   buat contoh lengkap pola yang BENAR (`hitungStatusKehadiran()`) vs
   yang cuma kosmetik (`data.waktu_masuk` dst).

## 3. Cara deploy

| Jenis file | Cara deploy |
|---|---|
| `.js`, `.html`, `.css`, `.md` (kode) | Folder `F:\ZEVANIC HOUSE\FOUNDATION\Code` di komputer Guru (lewat device bridge) — BUKAN Google Drive/upload manual GitHub |
| `firestore.rules` | Firebase Console → Firestore Database → Rules → Publish |
| `storage.rules` | Firebase Console → Storage → Rules → Publish (lokasi kerja: folder `Code` di komputer Guru, sama dengan `firestore.rules`) |

## 4. Alur Registrasi → Login — SUDAH DIREVISI LAGI (§12), beda dari desain awal

Desain SEBELUMNYA (dini hari 18 Agt, ada di Arsip §3.5): OTP dulu →
Admin buat akun dengan password sementara = NIK. **INI SUDAH DIGANTI**
di revisi ke-3 (§12): **password sekarang dibuat KARYAWAN SENDIRI**
saat registrasi (bukan lagi NIK yang di-generate Admin). Detail
lengkap alur revisi ke-3 ini ada di Arsip §12 — cek langsung ke situ
kalau perlu kerja di area ini.

OTP email (`vue-otp.js`) & instance Firebase kedua (Antrean Dakar)
kemungkinan besar KONSEPNYA masih dipakai, tapi ALUR PASTINYA mungkin
berubah menyesuaikan revisi password ini — **VERIFIKASI ke Arsip §12
sebelum sentuh alur ini**, jangan asumsi dari ringkasan ini saja.

## 5. Modul-modul BESAR yang sudah dibangun (18-31 Agt 2026) — per topik

### 5.1 Absensi lewat QR (HP Kiosk gudang) — §18, §19.x
Kiosk device khusus di gudang, karyawan scan QR + PIN buat Clock In/
Out tanpa perlu HP masing-masing. Banyak ronde bug-fix (PIN 2x,
Clock In/Out dobel, kartu sukses) — **berdasar catatan terakhir
semuanya FIXED & DIKONFIRMASI Guru**, tapi VERIFIKASI ke Arsip §19.11
untuk status paling akhir sebelum asumsi ini stabil. **Catatan §5.9e**:
timestamp Clock In/Out lewat Kiosk JUGA lewat `simpanKeFirebase()` di
`js/vue-camera.js` yang sama — jadi audit keamanan jam server di §5.9e
berlaku juga buat jalur Kiosk ini, bukan cuma Clock In dari HP masing-
masing karyawan.

### 5.2 Zevanic House — modul Konveksi (§20-§27, §33-§38)
Grup menu besar BARU, mencakup:
- **Master Bahan & Aksesoris** (§20) — data bahan baku, satuan/ukuran/warna.
- **Stock & Pembelian**: Alias Pembelian, List/Nota Order Belanja,
  Master Suplayer (§21), dengan banyak revisi lanjutan soal Konversi
  Banyak Tingkat, Harga Pembelian otomatis, dropdown nama+warna,
  Satuan bisa dipilih sesuai tingkat konversi (§25.7-§25.14).
- **Rak Penyimpanan** — awalnya 3 dropdown lepas (§24), DIROMBAK jadi
  menu tersendiri dengan Volume/kapasitas otomatis (§25.1, §25.3).
- **Lot/Roll & FIFO** — sempat 2 kali ganti pendekatan: FIFO OTOMATIS
  (§25.5) **DIGANTI** jadi FIFO SEBAGAI SARAN default + bisa pilih
  manual/scan (§25.6) — **§25.5 SUPERSEDED, jangan pakai sebagai
  acuan**. Termasuk fitur Scan Roll & Cetak Label Roll fisik.
- **Kartu Stok Bahan/Aksesoris** (§23.3) — ringkasan+detail per item.
- **Persiapan Masalah** (§21) — tempat "parkir" masalah stok kurang/
  belum diproses.
- **Config Data Komponen** (§33) — sumber data buat "Kelola Komponen"
  BOM Pola, GANTI dari cara lama (§34).
- **Import/Upload Massal Excel** untuk List Bahan & Aksesoris (§35) dan
  Data Komponen (§37), termasuk penyesuaian template (§36).

⚠️ **BANYAK bagian di 5.2 berlabel "BELUM DITES SAMA SEKALI" di
catatan aslinya** (terutama fitur fisik: scan kamera, cetak label —
Claude tidak bisa verifikasi ini dari sandbox). Jangan asumsi jalan
tanpa konfirmasi Guru.

### 5.3 Master Produk — Bill of Material/BOM (§28.x, §30-§32, §38, §45)
Sudah ada versi SUNGGUHAN (bukan cuma mockup):
- Entry Produk lengkap (BOM Jasa/Pola/Aksesoris/Vendor), file
  `vue-master-produk.js`. **Catatan §5.11**: `bom_pola[]` (field
  `bahan_pilih`/`bahan_aksesoris_id`/`panjang`/`isi_pola_pcs`,
  tipe:'internal'|'vendor') adalah sumber kebutuhan KAIN (dipakai pos
  Bahan) — BEDA dari `bom_aksesoris[]` (aksesoris/trim, dipakai pos
  Acc Sewing/Webbing/Finishing). Jangan tertukar kalau kerja di area BOM.
- **SKU FULL OTOMATIS** (§32) — tidak perlu diketik manual lagi.
- Import/Export Excel (template + verifikasi + saran koreksi, §28.9).
- Config > Jenis Produk (§31), List Produk dengan checkbox + Hapus
  Massal (§30).
- Kode Webbing 2/3 di BOM Aksesoris: sempat dropdown, **DIGANTI** jadi
  input manual (§38).
- **Field `harga_jual`** (BARU §45, 30 Agt 2026) — dulu koleksi ini
  NOL field harga jual (murni data BOM/ongkos produksi), sekarang ada
  field harga jual polos buat kebutuhan Penjualan Kasir (lihat §5.7).

### 5.4 Persiapan Produksi V2 — pipeline SPK (§26, §43, §44.10-§44.25)
Fitur BESAR, paling banyak ronde pengerjaan: SPK Grouping, 5 jalur
paralel (Bahan/Sewing/Webbing/Finishing/Vendor), tiap jalur 5 tahap
(Scan Opname → Cetak Label → dst), driver Vendor (Scan Kirim/Sampai).
Dibangun bertahap Fase 1-5 (§44.13-§44.23), termasuk **audit besar
menemukan bug boros baca Firestore** (§44.15: Antrean Absensi tarik
SELURUH 942 dokumen `users` — sudah diperbaiki §44.17, plus bug N+1
lain §44.18). **Pelajaran ini yang dipakai acuan efisiensi query di
dashboard Beranda desktop baru, §5.9.** **BARU (31 Agt 2026)**: sub-
menu "Perlu Disiapkan" di pipeline ini dibangun ULANG TOTAL dari
wireframe handoff — lihat §5.10. **BARU LAGI (31 Agt 2026, lanjutan)**:
jalur "Bahan" (dari 5 jalur×5 tahap generik `JalurTahapManager` di
bawah) JUGA diganti total — lihat §5.11. **BARU LAGI (1 Sep 2026)**:
jalur Sewing/Webbing/Finishing JUGA diganti total (sekaligus dalam 1
sesi, atas instruksi Guru) — lihat §5.11d. Vendor TIDAK ikut disentuh
(masih generik `JalurTahapManager`).

Ada **checklist testing manual interaktif** (artifact HTML terpisah,
link di §44.25) — **BELUM ADA KONFIRMASI Guru bahwa testing ini
sudah dijalankan/lolos**.

⚠️ **Peringatan eksplisit dari catatan asli**: Firestore Rules untuk
`spk_track` **statusnya TIDAK SEJELAS** rules `spk_grouping` — WAJIB
dicek manual ke Firebase Console dulu sebelum asumsi sudah aktif. Ini
JUGA relevan buat dashboard Beranda desktop baru (§5.9) — KPI Pipeline
Persiapan baca `spk_track`, kalau rules-nya membatasi role tertentu,
KPI itu bisa tampil "–" (gagal baca) untuk role yang tidak diizinkan.

### 5.5 Redesign Mobile "Gechoo Mobile Organic" (§44.1-§44.9)
Gaya visual mobile baru (kartu/tombol/header), **pilot di Antrean
Absensi DISETUJUI Guru** (§44.5), lalu diterapkan ke 4 modul antrean
sekaligus (§44.8). Termasuk redesign Bottom Sheet Profil (beberapa
ronde koreksi, §44.6-§44.8) dengan toggle tema **Auto/Light/Dark**.
Home Mobile JUGA dirombak (§27, §27.1) — grid menu sekarang tarik
otomatis dari `DAFTAR_MENU` (bukan array terpisah yang gampang
ketinggalan update lagi), Shortcut lama diganti "Favorit Saya".
**Tampilan ini TIDAK ikut berubah sama sekali** oleh redesain desktop
di §5.9 — dua kerja yang sengaja dipisah total. Pengecualian KECIL:
§5.9d/§5.9e memperbaiki bug tanggal (`hariIni` UTC vs lokal, lalu
dipertegas timezone Asia/Jakarta) di `js/vue-header-mobile.js` — ini
BUKAN perubahan visual/desain mobile, cuma perbaikan bug data yang
KEBETULAN sama akar masalahnya dengan bug Quote desktop.

### 5.6 Role baru: PIC Owner (§29)
Untuk kelola keuangan LINTAS gudang per jenis usaha — belum sempat
saya baca detail lengkapnya, cek Arsip §29 kalau kerja di area Hak
Akses/Config Akses.

### 5.7 Menu "Pesanan" — Kasir & pipeline (§45) — **SUDAH DI-PUSH GURU, BUG MENU SUDAH DIPERBAIKI & DIKONFIRMASI LIVE**
Grup sidebar baru: Penjualan Kasir (POS, ganti nama dari "Order SPK"),
Menunggu Proses, Proses Persiapan, Proses Produksi, Proses Pengiriman.
File `vue-pesanan.js` (BARU), perubahan ke `vue-master-produk.js`
(tambah field `harga_jual`, lihat §5.3), `vue-config-akses.js`,
`index.html`, `dashboard.js`, `firestore.rules` (2 koleksi baru:
`transaksi_kasir`, `pengaturan_id_transaksi_kasir`).

**STATUS DEPLOY**: 6 file kode dikirim ke folder `Code`, dikonfirmasi
Guru sudah push ke GitHub (commit `004e592`). **Bug "menu Pesanan tidak
muncul"** (akar masalah: `#menu-pesanan` tidak pernah dicopot class
`hidden`-nya di `js/auth.js`/`aturTampilanBerdasarkanRole()`) **SUDAH
DIPERBAIKI, SUDAH DIKIRIM, DAN DIKONFIRMASI SUDAH LIVE** — dicek ulang
30 Agt 2026 malam via `git clone` fresh ke commit terbaru (`ad855fe`,
riwayat git di-squash Guru jadi 1 commit "dsfds" — isi file `auth.js`
byte-identik dengan fix yang dikirim, 52894 byte, jadi FIX INI SUDAH
AKTIF di `gechoo.online`).

**BLOCKER KERAS TERPISAH, BELUM DIKONFIRMASI SELESAI**: Firestore Rules
untuk 2 koleksi baru (`transaksi_kasir`, `pengaturan_id_transaksi_kasir`)
— sudah ada di `firestore.rules` yang dikirim, tapi **BELUM ADA
KONFIRMASI sudah di-Publish manual di Firebase Console**. Kasir tidak
akan bisa menulis transaksi sampai ini di-Publish. Fitur juga **BELUM
DIUJI SAMA SEKALI** ujung-ke-ujung di browser+Firebase sungguhan.

### 5.8 Paket design handoff Desktop — REFERENSI (implementasi asli lihat §5.9)
Lokasi: `F:\ZEVANIC HOUSE\FOUNDATION\Mockup\zevanic erp v1\design_handoff_zevanic_desktop\`
(komputer Guru, lewat device bridge). Berisi: `Zevanic Desktop.dc.html`
(varian A — dashboard operasional, YANG DIPAKAI), `Zevanic Desktop
Alternatif.dc.html` (varian B, TIDAK dipakai), `Zevanic Mobile
Organic.dc.html` (acuan bahasa visual mobile), `README.md` (spesifikasi
1440×900, design token, 7 layar), `github.md` (tabel padanan
menuId→file repo), `gechoo-seed.js`, 13 screenshot PNG. Sifatnya
referensi desain HIGH-FIDELITY (HTML/CSS/ikon Lucide di luar repo),
BUKAN kode produksi. **Catatan §5.9d**: README ini eksplisit sebut
topbar tinggi **52px** dan header sidebar padding `14px 14px 12px` —
implementasi awal (§5.9) SALAH pakai `height:80px` fixed untuk
keduanya, baru dikoreksi di §5.9d. Kalau ada spec visual lain yang
kelihatan janggal ke depan, cek balik ke README ini dulu.

**Alur dari referensi ini ke kode asli**: paket handoff di atas → mockup
artefak interaktif "Zevanic Desktop Adaptasi" (vanilla JS, 3 ronde
revisi konten+warna, izin Guru "gass lanjut koding" 30 Agt 2026 malam)
→ **implementasi kode produksi sungguhan, lihat §5.9 di bawah**. Paket
handoff ini SEKARANG murni arsip referensi, bukan lagi "belum
diimplementasikan" — sebagian (Beranda) SUDAH. **BARU (31 Agt 2026)**:
konvensi handoff BARU dipakai buat modul BERIKUTNYA (`Mockup/handoff/`,
per-modul `SERAH-TERIMA.md`) — lihat §5.10/§5.11, TERPISAH dari paket
lama di atas.

### 5.9 Implementasi Redesain Desktop — Beranda (BARU, 30 Agt 2026 malam) — **KODE DITULIS & DIKIRIM, DIKONFIRMASI LIVE via screenshot (lihat banner atas), BELUM ADA KONFIRMASI TERTULIS FUNGSIONAL (KPI/Pipeline/dst) DARI GURU**

**Izin & keputusan Guru** (AskUserQuestion, 30 Agt 2026): (1) cakupan
sesi ini = Beranda dashboard PENUH (bukan cuma shell kosong, bukan
juga sekalian Kasir desktop); (2) Pipeline Produksi (jalur Cutting/
Serie/Sewing/Finishing) UI-only dulu, placeholder "Segera Hadir", BELUM
ada skema data — jangan bikin skema baru dulu; (3) "Serie" = proses
PENGGABUNGAN dari Bahan + Acc Sewing + Acc Webbing + Acc Vendor (kalau
ada) — dicatat buat referensi kalau nanti skema aslinya dibangun; (4)
warna kartu KPI & Quote pakai gradien maroon (`.gc-kartu-gradien`,
sama seperti kartu shift), KHUSUS Beranda desktop — lihat pengecualian
di `PETA-DESAIN.md`. Mobile TIDAK BOLEH ikut berubah.

**File yang diubah** (dikirim ke folder `Code`, 30 Agt 2026 malam):
- `index.html` — sidebar (`.gc-sidebar`) & header lama diganti topbar
  baru (`.gc-topbar-desktop` + lonceng notifikasi Pengumuman); `#tab-home`
  tidak lagi ke-max-width mobile di level atas (bug lama, dashboard
  desktop kepaksa selebar mobile — sudah diperbaiki); mount lama
  `#vue-pengumuman-desktop`/`#vue-quote-desktop` DICOPOT, ganti
  `#vue-beranda-desktop`.
- `css/gechoo-design.css` — `.gc-sidebar`/`.gc-side-brand` ganti warna
  (pink→ivory/putih, lihat `PETA-DESAIN.md`), + class baru topbar/notif/
  dashboard (`.gc-topbar-desktop`, `.gc-notif-*`, `.gc-dash-grid`,
  `.gc-kpi-*`, `.gc-pipeline-*`, `.gc-tindak-*`, `.gc-quote-desktop`).
- `js/vue-home-desktop.js` — DITULIS ULANG TOTAL. Dulu cuma mount
  `PengumumanCarousel`+`QuoteCard` (masih dipakai MOBILE, `vue-home.js`,
  TIDAK diubah), sekarang komponen `BerandaDesktop` penuh: 4 KPI
  (Persiapan Masalah/Antrean Dakar/Antrean Absensi/Antrean Reimburse),
  Pipeline Persiapan (6 kartu, data REAL dari `order_spk`+`spk_track`),
  Pipeline Produksi (placeholder, TIDAK baca Firestore), Perlu Tindakan
  Anda, kartu Quote (data sama `QuoteCard`, warna beda), lonceng
  notifikasi (pola sama `vue-header-mobile.js`, share key `localStorage`
  "sudah dibaca" dengan mobile). **Baca komentar besar di atas file itu
  — daftar lengkap keputusan & aproksimasi query, jangan diulang di sini.**

**Efisiensi Firestore (sesuai pelajaran §5.4/§6)**: SEMUA KPI pakai
`getCountFromServer()` (1 baca per query, bukan tarik dokumen), KECUALI
"Perlu Disiapkan" (tetap `getDocs()`, meniru persis query layar aslinya
yang butuh filter client-side). Query per-jalur Pipeline Persiapan
SENGAJA 4× `where(jalur=='x').where(status=='y')` terpisah per jalur
(bukan 1 query pakai `where('status','in',[...])`) — supaya PASTI
kompatibel dengan index Firestore yang SUDAH ada (pola equality-only,
sama seperti `JalurTahapManager`), tanpa perlu Guru bikin composite
index baru.

**~~SENGAJA TIDAK dibangun~~ — DIBALIK di §5.9b** (histori keputusan,
DIPERTAHANKAN buat konteks): awalnya kartu "Aktivitas Terbaru" & 
"Pintasan Papan Tik" sengaja tidak dibangun (keputusan sendiri, supaya
tidak ada data palsu di produksi — tidak ada koleksi log lintas-modul
di skema data sungguhan, dan command palette Ctrl+K sendiri belum ada
di app). **Guru secara eksplisit minta dibangun** di sesi lanjutan
(lihat §5.9b) — sekarang KEDUA kartu itu ADA di kolom kanan, isinya
tetap konten statis/ilustratif (dinyatakan jujur di komentar kode),
BUKAN diam-diam dianggap data live.

**BELUM DILAKUKAN / BELUM DIVERIFIKASI (WAJIB dicek sesi berikutnya)**:
1. Guru belum copy file-file di atas (3 file ronde pertama + 4 file
   ronde lanjutan §5.9b, ada overlap `index.html`/`css`/`vue-home-
   desktop.js` — total tetap 4 file unik + `js/auth.js`) dari folder
   `Code` ke repo kerja & `git push` — sama seperti fitur Pesanan,
   deploy BUKAN otomatis.
2. **BELUM DIUJI SAMA SEKALI** di browser+Firebase sungguhan — Claude
   tidak bisa menguji ini dari sandbox. Yang PALING perlu dicek Guru:
   apakah KPI/Pipeline tampil angka benar (bukan "–" terus, tanda gagal
   baca — kemungkinan besar karena role user yang login tidak diizinkan
   `firestore.rules` baca salah satu koleksi `persiapan_masalah`/
   `pendaftaran_pending`/`absensi`/`reimburse`/`order_spk`/`spk_track` —
   lihat peringatan §5.4 soal rules `spk_track`), apakah lonceng
   notifikasi jalan (buka/tutup, badge, tandai dibaca), apakah layout
   sidebar+topbar+dashboard terlihat rapi di lebar layar sungguhan
   (bukan cuma di preview mockup).
3. TIDAK ADA perubahan `firestore.rules` di kerja ini (semua koleksi
   yang dibaca dashboard sudah ada rules-nya dari fitur lain) — tapi
   BELUM diverifikasi apakah rules yang ada mengizinkan SEMUA role baca
   cukup buat KPI tampil untuk semua orang (lihat poin 2 di atas).
4. Firestore index: TIDAK butuh index composite baru (lihat penjelasan
   efisiensi di atas) — tapi ini asumsi berdasar baca kode, bukan
   dites langsung ke Firebase Console sungguhan.

### 5.9b Revisi lanjutan Beranda desktop — topbar breadcrumb, Kartu Absen, Aktivitas Terbaru, Pintasan Papan Tik (BARU, 30 Agt 2026, sesi lanjutan) — **DIKONFIRMASI LIVE via screenshot Guru** (breadcrumb, Kartu Absen, KPI semua tampil di `gechoo.online`)

Guru kirim screenshot topbar live (`gechoo.online`), minta 4 hal
eksplisit: "jam shift dan erp portal hapus ganti dengan yg sesuai
mockup, lalu kartu absen dari mobil bisa diambil tempel di dashboard.
anggap mockup yg dilivekan."

**Yang diubah**:
1. **Topbar** (`index.html`) — h2 "ERP Portal" + badge `#label-badge-
   role` (diisi `dashboard.js` `mulaiHitungJamKerja()`, countdown
   shift HARDCODE "01:00" utk SEMUA orang — tidak akurat) DICOPOT.
   Diganti breadcrumb statis `.gc-crumb` ("Umum › Beranda", persis
   gaya mockup) — statis karena baru Beranda yang punya versi
   desktop, belum ada routing breadcrumb dinamis per-layar.
2. **Kartu Absen** (kolom kanan, paling atas, `js/vue-home-
   desktop.js`) — **REAL**, bukan ilustratif. "Diambil tempel" dari
   kartu shift mobile: logic sama persis `muatShift()`+
   `window.cekStatusClockInSaya()` (`js/vue-home.js`), style reuse
   `.gc-kartu-gradien`/`.gc-pil-status`/`.gc-deco-lingkaran` (class
   lama, TIDAK direka ulang). Read-only, TANPA tombol Clock In/Out
   (clock in/scan QR tetap di app mobile — sesuai teks keterangan di
   kartu itu sendiri).
3. **Aktivitas Terbaru** & **Pintasan Papan Tik** (kolom kanan,
   bawah Quote) — **DIBANGUN**, membalik keputusan §5.9 yang tadinya
   sengaja tidak. **Isinya KONTEN STATIS/ILUSTRATIF** (persis isi
   mockup, konstanta `AKTIVITAS_ILUSTRATIF`/`PINTASAN_ILUSTRATIF` di
   `js/vue-home-desktop.js`), BUKAN data live — tidak ada koleksi log
   aktivitas lintas-modul di skema data sungguhan (`PETA-DATABASE.md`)
   dan tidak ada command palette Ctrl+K sungguhan di app ini. Kalau
   nanti mau versi live beneran, itu kerjaan terpisah (perlu koleksi
   log baru), belum diminta.
4. **`js/auth.js`** — baris pengisi `#label-badge-role`.innerHTML
   (`aturTampilanBerdasarkanRole()`) diberi **null-guard** (dulu
   unconditional, akan crash begitu elemen itu dicopot dari DOM).
   `js/dashboard.js` `mulaiHitungJamKerja()` TIDAK perlu diubah — sudah
   null-guard dari awal, sekarang otomatis no-op karena elemennya
   sudah tidak ada.

**File yang dikirim ulang ke folder `Code`**: `index.html`,
`css/gechoo-design.css` (tambah `.gc-crumb`, `.gc-absen-desktop`,
`.gc-aktivitas-*`, `.gc-pintasan-*`), `js/vue-home-desktop.js`,
`js/auth.js`. Ukuran byte dikonfirmasi cocok persis antara yang
dikirim & yang tertulis di folder `Code` (`device_list_dir`).

**BELUM DILAKUKAN / BELUM DIVERIFIKASI** — SAMA seperti §5.9: belum
di-push Guru ke repo, belum diuji sama sekali di browser+Firebase
sungguhan. Yang PALING perlu dicek Guru kali ini: breadcrumb tampil
benar (bukan kosong/error), Kartu Absen tampil jam shift+status
absen yang BENAR (bukan kartu kosong — kartu ini `v-if="shiftAbsen.
nama"`, jadi kalau `master_shift`/`nama_shift` user tidak ketemu,
kartu ini TIDAK tampil sama sekali, bukan error diam-diam), dan
Aktivitas Terbaru/Pintasan Papan Tik jangan disalahsangka data asli
oleh siapapun yang lihat (isinya memang statis).

### 5.9c Revisi lanjutan ke-2 — header sidebar, pencarian global, ikon sidebar, klarifikasi kartu Quote (BARU, 30 Agt 2026, sesi lanjutan lagi) — **KODE DITULIS & DIKIRIM, BELUM DI-PUSH GURU, BELUM DIUJI**

Guru kirim 2 screenshot berdampingan (mockup referensi vs live
`gechoo.online`, keduanya menampilkan layar sama — Beranda desktop)
dengan 3 catatan eksplisit:

1. **"fokus pada ada 5 kartu, dibawah kartu absen ada quote,
   terapkan"** — DICEK dulu (bukan tebak-tebak): kartu Quote
   (`.gc-quote-desktop`) di kolom kanan memang **BY DESIGN tidak
   render apapun** kalau tidak ada dokumen `quotes` dengan
   `tanggalTampil` == hari ini — ini pola SAMA PERSIS dengan
   `QuoteCard` bersama (`js/vue-components.js`, sudah dipakai
   mobile sejak awal, komentarnya eksplisit bilang "supaya tidak
   ada kartu kosong yang aneh"). **BUKAN bug baru dari sesi ini** —
   kartu itu "hilang" di screenshot live karena memang belum ada
   Quote yang dijadwalkan untuk 30 Agt 2026 di koleksi `quotes`.
   TIDAK ada perubahan kode untuk poin ini — solusinya Guru
   menambahkan Quote hari ini lewat layar Config Info > Quote
   Harian, bukan perbaikan kode. Diputuskan TIDAK menambah quote
   default/fallback supaya perilaku desktop tetap konsisten dengan
   mobile (satu sumber kebenaran perilaku), bukan 2 aturan berbeda
   untuk kartu yang sama datanya.
   **KOREKSI PENTING §5.9d**: kesimpulan "bukan bug" ini TERNYATA
   SALAH — Guru sudah isi Quote tapi tetap tidak muncul, ada bug
   ASLI (timezone) yang baru ketemu di §5.9d. Baca §5.9d, JANGAN
   pakai kesimpulan di poin ini sebagai acuan lagi.
2. **"header tulisan zevanic yah, ada pencarian size"** — 2
   perubahan: (a) teks brand `.gc-side-brand` (pojok kiri-atas
   sidebar) GANTI dari "Gechoo ♥" jadi "Zevanic ERP" + ikon-kotak
   baru `.gc-side-brand-ico` (32px, latar `--burgundy`, glyph
   `--ivory`), persis mockup. Blok ini SUDAH desktop-only dari awal
   (`.gc-sidebar hidden md:flex`) — ganti teks di sini TIDAK
   menyentuh branding mobile SAMA SEKALI (mobile pakai header
   sendiri, `vue-header-mobile.js`, tidak pernah menampilkan blok
   ini). (b) Topbar ditambah **tombol pencarian global "Cari menu
   atau data..." (320px, badge Ctrl K)** yang klik/Ctrl+K-nya BUKA
   overlay palet pencarian — **REAL, bukan cuma visual** (beda dari
   keputusan §5.9b yang sengaja TIDAK membangun ini karena mockup-
   nya cuma visual). Diikat sungguhan: hasil pencarian dibaca
   LANGSUNG dari DOM sidebar (`data-menu-id`), klik hasil = trigger
   `.click()` tombol sidebar ASLI (bukan menduplikasi logic
   `pindahTab`/`pindahSubTab`). Logic: `paletPencarianGlobal()` di
   `js/dashboard.js` — WAJIB baca komentar besar di atas fungsi itu
   sebelum ubah. Navigasi panah atas/bawah TIDAK diimplementasi
   (disederhanakan, Enter pilih hasil teratas) — kalau Guru mau itu
   nanti, penambahan kecil terpisah. Tombol "Export" di mockup
   SENGAJA TIDAK ditambahkan (tidak diminta, dan belum ada logic
   export apapun di baliknya — beda dari pencarian yang punya
   sumber data jelas buat diikat sungguhan). **Nama brand "Zevanic
   ERP" DIGANTI LAGI jadi "Zevanic Core Optima" di §5.9d.**
3. **"sidebar pun masih beda, tidak icon dan padding jauh"** — 2
   perubahan: (a) **7 tombol kepala grup sidebar** (Pesanan/Master
   Absensi/Master Keuangan/Master Karyawan/Master Integrasi/
   Zevanic House/Persiapan Produksi) ditambah ikon `.gc-nav-gico`
   (dulu cuma teks+chevron) — ikonnya PERSIS data mockup
   (`mockup-desktop-adaptasi.html`, variabel `GRUPS`): fa-receipt/
   fa-clock/fa-sack-dollar/fa-users/fa-plug/fa-shirt/
   fa-diagram-project. Sub-item nested SUDAH lama punya ikon
   sendiri, tidak berubah. (b) Base `.gc-nav-item` dirapatkan dari
   `padding:10px 12px; font-size:13px` jadi `padding:9px 10px;
   font-size:12.5px` (mendekati spec mockup 8px 10px/11.5px) — ini
   CUMA pengaruh ke item tanpa override inline (Beranda/Profile +
   7 kepala grup), sub-item nested sudah override sendiri, tidak
   ikut berubah. State "grup terbuka" sekarang JUGA menambah class
   `.gc-grp-buka` ke tombol kepala grup itu sendiri (dulu cuma
   chevron yang berubah warna) — lihat `setGrupSidebarTerbuka()`
   di `js/dashboard.js`.

**File yang dikirim ulang ke folder `Code`**: `index.html`,
`css/gechoo-design.css`, `js/dashboard.js`. Ukuran byte dikonfirmasi
cocok persis antara yang dikirim & yang tertulis di folder `Code`
(`device_list_dir`). `js/vue-home-desktop.js`/`js/auth.js` TIDAK
ikut berubah di ronde ini (tidak disentuh).

**BELUM DILAKUKAN / BELUM DIVERIFIKASI**: belum di-push Guru ke
repo, belum diuji sama sekali di browser sungguhan. Yang PALING
perlu dicek Guru: pencarian global bisa dibuka (klik tombol atau
Ctrl+K), ketik nama menu memfilter hasil dengan benar, klik hasil
benar-benar pindah layar (termasuk buka accordion grup induknya).

**BUG DITEMUKAN GURU & SUDAH DIPERBAIKI (masih sesi yang sama, 30 Agt
2026)**: Guru laporkan popup pencarian **selalu tampil sendiri pas
refresh/hard reset**, bukan cuma pas dipanggil (klik/Ctrl+K) — SEHARUSNYA
tersembunyi sampai dipanggil. Akar masalah dicek langsung (bukan tebak):
overlay (`#paletOverlayDesktop`) pakai atribut asli HTML `hidden`
(bukan class `.hidden` custom proyek ini), tapi rule CSS
`.gc-palet-overlay{display:flex}` adalah CSS PENULIS (author
stylesheet) — author stylesheet SELALU menang mutlak dari default
browser `[hidden]{display:none}` (UA stylesheet) berapapun urutan/
specificity-nya, KECUALI ditimpa selector lebih spesifik. Jadi overlay
full-layar itu SELALU kelihatan dari awal load, walau atribut
`hidden`-nya sudah benar diisi/dilepas lewat JS (`overlay.hidden =
true/false` di `paletPencarianGlobal()`, `js/dashboard.js` — logic JS-
nya SUDAH BENAR dari awal, bukan itu sumber bug). **Fix**: tambah rule
`.gc-palet-overlay[hidden]{display:none;}` di `css/gechoo-design.css`
(selector lebih spesifik, menang lawan `.gc-palet-overlay` polos).
Kelas bug ini SAMA PERSIS dengan pelajaran "`.hidden` vs `flex`" yang
sudah didokumentasikan di file CSS ini sendiri (~baris 466, soal
`index.html` dulu pakai `class="hidden" style="display:flex"` inline)
— cuma versi ini bukan salah urutan class, tapi salah ORIGIN stylesheet
(UA vs author). **File dikirim ulang**: `css/gechoo-design.css` saja
(45501 byte, dikonfirmasi cocok lewat `device_list_dir`). **Sudah
diperbaiki**, belum ada laporan Guru lagi soal bug ini setelah fix —
dianggap SELESAI kecuali Guru bilang sebaliknya.

### 5.9d Revisi lanjutan ke-3 — rename brand, kurangin tinggi header, fix bug Quote (timezone), pecah "Perlu Tindakan Anda" jadi 2 grup (BARU, 30 Agt 2026, sesi lanjutan lagi) — **KODE DITULIS & DIKIRIM, BELUM DI-PUSH GURU, BELUM DIUJI**

Guru minta 3 hal dalam 1 pesan singkat: "zevanic erp ganti dengan
Zevanic Core Optima, header panjang kebawah kurangin" + "bug quote udah
disi tapi masih tidak muncul" + "perlu tindakan jadi 2 grid grid satu
untuk persiapan grid dua untuk produksi".

1. **Rename brand + tinggi header** — nama brand sidebar GANTI dari
   "Zevanic ERP" (§5.9c) jadi **"Zevanic Core Optima"** (h1 di
   `.gc-side-brand`, `index.html`). Teks lebih panjang, jadi h1 diberi
   `white-space:nowrap; overflow:hidden; text-overflow:ellipsis` +
   font-size dikecilkan 14px→13px supaya TIDAK membungkus 2 baris.
   Soal "header kepanjangan ke bawah": DICEK ke README paket handoff
   (BUKAN tebak-tebak) — ternyata `.gc-topbar-desktop` DAN
   `.gc-side-brand` dari §5.9 memang SALAH pakai `height:80px` fixed;
   spec asli README eksplisit bilang **topbar tinggi 52px** dan header
   sidebar cuma **padding-driven `14px 14px 12px`** (bukan height
   fixed). Dikoreksi ke spec asli: `.gc-topbar-desktop{height:80px}` →
   `height:52px`; `.gc-side-brand{height:80px}` → dicopot, ganti
   `padding:14px 14px 12px` (height jadi auto ≈58px ngikut konten).
   Konten di dalam topbar (tombol notif 36px, dll) masih muat di 52px
   karena align-items:center, tidak perlu ubah ukuran elemen lain.
2. **Bug Quote — DITEMUKAN ULANG, BUKAN "by design"** — Guru sudah isi
   Quote hari ini tapi kartu tetap tidak muncul, KONTRADIKSI dengan
   kesimpulan §5.9c poin 1 ("bukan bug, cuma belum ada data"). Dicek
   ULANG dari nol (bukan asumsi lama dipertahankan): jam server saat
   itu UTC 18:36, 30 Agt 2026 — dikonversi ke WIB (UTC+7) = **01:36
   dini hari, 31 Agustus 2026**. Kode `hariIni` (di 3 tempat:
   `QuoteCard`/`js/vue-components.js`, kartu Quote desktop/`js/vue-
   home-desktop.js`, strip Quote mobile/`js/vue-header-mobile.js`)
   pakai `new Date().toISOString().split('T')[0]` — ini **UTC**, bukan
   tanggal lokal device. WIB = UTC+7, jadi setiap hari jam **00:00-
   06:59 WIB, tanggal UTC MASIH tanggal KEMARIN**. Admin yang isi form
   Quote Harian (`<input type="date">`) melihat tanggal LOKAL (sudah
   hari baru, 31 Agustus), sementara query cari `tanggalTampil ==
   "2026-08-30"` (tanggal UTC, masih kemarin) — TIDAK PERNAH cocok
   dengan Quote yang Guru jadwalkan untuk "hari ini" versi dia. Ini
   BUG ASLI, bukan by-design, dan KEBETULAN pas ketahuan karena Guru
   testing tepat di jam rawan (dini hari WIB). **Fix RONDE INI**: ganti
   ke komponen tanggal LOKAL (`getFullYear()`/`getMonth()`/`getDate()`),
   BUKAN `toISOString()`, di ke-3 tempat tadi — **DIPERTEGAS LAGI di
   §5.9e** jadi timezone Asia/Jakarta eksplisit. Field & format simpan
   di `js/vue-config-info.js` (form Quote Harian) SUDAH benar dari
   awal (string `YYYY-MM-DD` dari `<input type="date">`, bukan
   Timestamp) — bukan itu sumber masalah, tidak disentuh.
   **Catatan tambahan (BELUM diubah, di luar scope laporan Guru)**:
   pola `toISOString().split('T')[0]` yang SAMA (berpotensi bug sama)
   masih ada di 3 tempat lain: `js/vue-kartu-stok.js` (default value
   input tanggal pemakaian — dampak kecil, cuma default yang bisa
   diganti manual), `js/vue-reimburse.js` & `js/dashboard.js` (nama
   file CSV export — dampak kosmetik, tanggal di nama file bisa
   meleset 1 hari di jam rawan). TIDAK diperbaiki sesi ini (tidak
   diminta, dampak jauh lebih kecil dari kartu Quote) — tanya Guru
   dulu kalau mau sekalian dibereskan.
3. **"Perlu Tindakan Anda" DIPECAH jadi 2 grup** — kartu ini
   (`js/vue-home-desktop.js`, kolom kiri bawah 2 kartu Pipeline) dulu
   1 daftar rata (Perlu Disiapkan + 5 jalur Persiapan). SEKARANG
   dipecah 2 grup dengan label kecil pemisah (`.gc-tindak-subgrup`):
   **grup "Persiapan"** — sama persis isi lama (Perlu Disiapkan + 5
   jalur, data REAL dari `spk_track`/`order_spk`, class `.gc-tindak-
   row` biasa); **grup "Produksi"** — BARU, isi 4 baris placeholder
   (Cutting/Serie/Sewing/Finishing, chip "–", opacity diredupkan lewat
   class `.gc-tindak-segera`) — SENGAJA placeholder, KONSISTEN dengan
   kartu Pipeline Produksi di atasnya (§5.9, keputusan Guru: skema
   data Produksi belum dibangun, jangan bikin skema baru dulu) — bukan
   angka/chip hitung palsu.

**File yang dikirim ulang ke folder `Code`**: `index.html`,
`css/gechoo-design.css`, `js/vue-components.js`,
`js/vue-home-desktop.js`, `js/vue-header-mobile.js`. Ukuran byte
dikonfirmasi cocok persis antara yang dikirim & yang tertulis di
folder `Code` (`device_list_dir`). `js/dashboard.js`/`js/auth.js`
TIDAK ikut berubah di ronde ini.

**BELUM DILAKUKAN / BELUM DIVERIFIKASI**: belum di-push Guru ke repo,
belum diuji sama sekali di browser sungguhan. Yang PALING perlu dicek
Guru: (a) kartu Quote SEKARANG muncul (baik siang maupun dini hari
WIB — kalau masih tidak muncul siang hari, berarti ADA bug lain lagi,
jangan asumsi ini fix final tanpa konfirmasi Guru); (b) nama brand
"Zevanic Core Optima" tampil 1 baris rapi di sidebar (tidak
terpotong/wrap); (c) tinggi topbar & header sidebar sekarang terasa
pas (tidak "kepanjangan ke bawah" lagi); (d) "Perlu Tindakan Anda"
kelihatan 2 grup terpisah jelas (Persiapan vs Produksi), grup Produksi
kelihatan jelas beda visual (redup) dari grup Persiapan.

### 5.9e Timezone Asia/Jakarta eksplisit + audit keamanan Absensi/Clock In (BARU, 30 Agt 2026, sesi lanjutan lagi) — **KODE DITULIS & DIKIRIM (bagian tanggal), AUDIT SELESAI (bagian keamanan, tidak ada kode diubah)**

Guru tanya 2 hal: "kalau pakai tgl internet jakarta wib bagaimana?" dan
"takutnya di fake jam di device dimundurkan supaya clok in aman".

1. **Tanggal Quote — dipertegas timezone Asia/Jakarta eksplisit.** Fix
   §5.9d (tanggal LOKAL via `getFullYear/getMonth/getDate`) sudah benar
   secara KALENDER (bukan UTC lagi), tapi masih ikut TIMEZONE apa pun
   yang di-set di device — kalau timezone device salah-setting (jarang
   tapi bisa), tanggalnya ikut salah lagi. Diganti jadi eksplisit paksa
   Asia/Jakarta: `new Date().toLocaleDateString('en-CA', {timeZone:
   'Asia/Jakarta'})` — locale `en-CA` dipilih karena formatnya persis
   `YYYY-MM-DD` (sama dengan `<input type="date">`). Diverifikasi
   LANGSUNG di sandbox (bukan cuma baca kode): jam server saat itu UTC
   19:19, dikonversi Jakarta = 02:19 dini hari 31 Agustus — kode BARU
   ini benar mengembalikan `"2026-08-31"` (tanggal Jakarta yang benar),
   BUKAN `"2026-08-30"` (yang akan salah kalau masih pakai cara device-
   local biasa tanpa timezone eksplisit, tergantung setting device).
   Diterapkan di 3 file yang sama dengan §5.9d: `vue-components.js`,
   `vue-home-desktop.js`, `vue-header-mobile.js`.
   **CATATAN JUJUR**: ini masih baca JAM ASLI device (`Date.now()`),
   cuma TIMEZONE-nya yang dipaksa Jakarta — TIDAK melindungi dari jam
   device yang SENGAJA dimundurkan/dimajukan (beda masalah, lihat poin
   2 di bawah). Untuk kartu Quote (cuma tampilan, bukan keputusan
   bisnis), tingkat proteksi ini SUDAH cukup — tidak perlu sampai baca
   jam server Firestore segala buat kartu quote-of-the-day.

2. **Audit keamanan Absensi/Clock In — kekhawatiran Guru soal jam
   device di-fake buat "amanin" Clock In.** DICEK LANGSUNG ke kode
   (bukan asumsi aman/bahaya sepihak):
   - **Timestamp ASLI Clock In/Out AMAN.** Field `waktu_ts`/
     `waktu_masuk_ts`/`waktu_keluar_ts` (ditulis di `simpanKeFirebase()`
     dan `hitungJamKeluarUntukGaji()`, `js/vue-camera.js`, dipakai baik
     Clock In dari HP karyawan maupun dari Kiosk gudang — §5.1) SEMUA
     pakai `serverTimestamp()` Firestore — ini jam SERVER Google yang
     dicatat SAAT Firestore menerima tulisan, SAMA SEKALI TIDAK
     terpengaruh jam yang ditampilkan/di-set di device pengirim. Device
     yang jamnya dimundurkan TIDAK BISA membuat `waktu_ts` ikut mundur.
   - **Status Ontime/Terlambat JUGA aman**, karena dihitung dari field
     itu, BUKAN dari jam device saat itu. `hitungStatusKehadiran()`
     (`js/vue-antrean-absensi.js` baris ~64) malah eksplisit MENOLAK
     input yang bukan Firestore Timestamp asli (`if (!waktuAktualTs ||
     typeof waktuAktualTs.toDate !== 'function') return null` —
     dicek langsung di kode, bukan tebakan) dan SEMUA 3 titik
     pemanggilannya (baris 188/224/255) pakai `props.data.waktu_ts` /
     `props.data.waktu_masuk_ts` / `props.data.waktu_keluar_ts` — field
     yang DIBACA BALIK dari dokumen tersimpan (server-verified), bukan
     dihitung ulang dari jam device saat menampilkan. **Kesimpulan:
     memundurkan jam HP TIDAK BISA mengubah status Ontime/Terlambat
     karyawan** — kekhawatiran Guru MASUK AKAL sebagai pola serangan
     umum (banyak app lain memang rentan ini), tapi proyek ini SUDAH
     dibangun aman dari awal untuk bagian ini, bukan baru diperbaiki
     sesi ini.
   - **CELAH KECIL yang ditemukan (BELUM diperbaiki)**: field TEKS
     tampilan `waktu`/`waktu_masuk`/`waktu_keluar` (`new
     Date().toLocaleString('id-ID')`, non-`_ts`) MASIH pakai jam device
     — field ini DITAMPILKAN ke admin di Antrean Absensi & Riwayat All
     Absensi (`data.waktu`/`data.waktu_masuk`/`data.waktu_keluar`,
     dicek langsung ke template-nya). Jadi kalau karyawan fake jam HP,
     BADGE status (Ontime/Terlambat) di sebelahnya tetap BENAR (server),
     tapi ANGKA JAM TEKS yang dibaca admin bisa salah/menyesatkan
     (misal badge bilang "Terlambat" tapi teks jam yang tertulis
     kelihatan seperti jam masuk normal). **Dampak SAAT INI kecil**:
     dicek, BELUM ADA modul Payroll/Slip Gaji sungguhan (file
     `vue-payroll.js`/`vue-slip-gaji.js` TIDAK ADA di `js/` — dicek
     `ls`, bukan tebakan) yang membaca field teks ini buat hitung gaji,
     jadi BELUM ada risiko uang dari celah ini hari ini. **REKOMENDASI
     buat nanti**: (a) kalau Payroll/Slip Gaji dibangun, WAJIB hitung
     jam kerja dari field `_ts` (server), JANGAN dari field teks
     `waktu_masuk`/`waktu_keluar`; (b) opsional, field teks di Antrean
     Absensi/Riwayat bisa diganti supaya DIAMBIL dari `_ts` juga
     (format ulang `waktu_ts.toDate().toLocaleString('id-ID')` alih-
     alih string device yang disimpan terpisah) — supaya admin TIDAK
     PERNAH lihat 2 versi jam yang beda (device vs server) untuk 1
     kejadian yang sama. **BELUM DIKERJAKAN** — nunggu keputusan Guru,
     karena ini nyentuh jalur tulis produksi Absensi yang dipakai
     ~500 karyawan tiap hari (§1), bukan cuma dashboard kosmetik —
     perlu hati-hati & mungkin pengujian lebih dulu sebelum diubah.

**File yang dikirim ulang ke folder `Code`** (bagian 1 saja — bagian 2
CUMA audit baca kode, TIDAK ada file diubah): `js/vue-components.js`,
`js/vue-home-desktop.js`, `js/vue-header-mobile.js`. Ukuran byte
dikonfirmasi cocok persis (`device_list_dir`).

**BELUM DILAKUKAN**: perbaikan celah kecil di poin 2 (field teks jam
admin) — nunggu Guru putuskan mau diperbaiki sekarang atau nanti.

### 5.10 Rebuild total "Perlu Disiapkan" (Persiapan Produksi V2) dari wireframe handoff (BARU, 31 Agt 2026) — **KODE DITULIS & DIKIRIM, BELUM DI-PUSH GURU, BELUM DIUJI**

**Latar belakang**: Guru menyiapkan paket **wireframe handoff** BARU di
`Mockup/handoff/` (komputer Guru) untuk modul "Persiapan Produksi -
Perlu Disiapkan" — konvensi handoff YANG LEBIH BAKU dari paket §5.8 (1
modul per sesi, `PEDOMAN-SERAH-TERIMA.md` (meta-aturan) +
`SERAH-TERIMA.md` per modul berstruktur 9 bagian + `wireframe.dc.html`
+ screenshot + `support.js` runtime — wireframe dipahami sebagai "acuan
STRUKTUR, bukan kode": warna/komponen visual WAJIB tetap pakai
`css/gechoo-design.css` yang sudah ada, bukan direka ulang dari
wireframe).

**Konflik arsitektur ditemukan SEBELUM nulis kode** — dicek silang ke
`PETA-MENU.md`/`PETA-DATABASE.md`/kode live (`git clone`), wireframe ini
TUMPANG TINDIH dengan modul "Perlu Disiapkan" yang SUDAH aktif (§5.4):
kunci pengelompokan klaster beda, struktur turunan beda (wireframe: 4
"pos" × 2 tahap + konsep "kode anak" yang belum ada di skema; live: 5
jalur × 5 tahap, `spk_track`/`JalurTahapManager`). **Alih-alih
menebak**, ini diklarifikasi ke Guru lewat serangkaian `AskUserQuestion`
— sesuai kesepakatan BARU sesi ini (lihat banner atas &
`PEDOMAN-GAYA-KERJA.md`): **kalau Claude nilai suatu keputusan MENU
kompleks/ambigu, WAJIB langsung interupsi Guru saat itu juga**, bukan
nebak-jalan-lalu-tanya-belakangan, dan bukan pula nunggu pasif Guru
bilang duluan "ini kompleks".

**7 keputusan Guru** (semua via `AskUserQuestion`):
1. Relasi ke "Perlu Disiapkan" V2 yang sudah aktif → **Ganti total**
   (wireframe MENGGANTIKAN versi lama sepenuhnya, bukan berdampingan).
2. Risiko data live → **Belum ada data live** — aman diubah skemanya
   tanpa perlu migrasi data lama.
3. Baris setelah selesai digrouping → **Hilang total dari antrean**
   (tidak ada tab riwayat — diganti dialog konfirmasi sekali-tampil
   setelah "Buat Grouping", bukan daftar persisten seperti sebelumnya).
4. Fitur batalkan grouping → **Ditunda** (tidak dibangun versi ini).
5. Jalur Vendor (wireframe cuma tampilkan 4 chip jalur, tidak termasuk
   Vendor) → **Vendor TETAP ADA** di versi ini (checkbox dipertahankan
   apa adanya), otomatisasi/modul Vendor sendiri menyusul terpisah.
6. 1 SPK ikut lebih dari 1 grouping (qty dipecah sebagian) → **BOLEH**
   — requirement BARU yang mengubah skema (lihat field baru di
   `order_spk`/`spk_grouping`, `PETA-DATABASE.md`).
7. Deteksi 4 "pos"/jalur otomatis dari BOM → **Tetap otomatis dari BOM**
   (logic `jalurOtomatisProduk()` yang sudah ada TIDAK diubah) — frasa
   "otomatis, bukan pilihan" di wireframe diartikan "tidak bisa
   di-uncheck manual", BUKAN "selalu tampilkan ke-4 jalur tanpa syarat".

**Bug LAMA ditemukan & diperbaiki (BUKAN cuma menerima klaim Guru
mentah-mentah)**: di tengah sesi, Guru sempat menyatakan kunci
penggabungan klaster yang SUDAH JALAN itu `nama_produk + size +
panjang_pola + isi_pola_pcs`. **DICEK LANGSUNG ke kode live** (`grep`
ke `vue-persiapan-produksi-v2.js` hasil `git clone`) — TERNYATA kunci
yang ASLI JALAN cuma `nama_produk + kunci_pola` (fungsi lama), **TIDAK
ikut `size` sama sekali** — bug pre-existing yang nyata, bukan salah
ingat semata. Dilaporkan transparan ke Guru (bukan didiamkan), dan
diperbaiki lewat fungsi baru `kunciGrupProduk()` (`nama_produk::size::
kunci_pola`).

**Perubahan skema data** (detail lengkap field: `PETA-DATABASE.md`
bagian `order_spk` & `spk_grouping`):
- `order_spk.qty_tergrouping` (BARU, number) — akumulasi qty yang
  sudah masuk grouping manapun; sisa yang bisa digrouping = `qty_order
  - qty_tergrouping`.
- `order_spk.grouping_ids` (BARU, array) — semua `spk_grouping` yang
  pernah menyertakan SPK ini (`arrayUnion`), gantikan asumsi lama "1
  SPK cuma bisa 1 grouping".
- `order_spk.status_grouping` — BERUBAH dari biner jadi TRI-STATE:
  `''`/`'sebagian'`/`'tergrouping'`.
- `order_spk.id_spk_grouping`/`kode_spk_grouping` — DIPERTAHANKAN
  (kompatibilitas tampilan lama), sekarang artinya "grouping PALING
  BARU", bukan satu-satunya lagi.
- `spk_grouping.size` (BARU, string) — ikut jadi kunci klaster.
- `spk_grouping.qty_total`/`breakdown[].qty` — sekarang BISA partial
  (bukan selalu qty penuh SPK anggotanya).

**File yang diubah & dikirim ke folder `Code`**:
- `js/vue-persiapan-produksi-v2.js` (v1→v2, lalu →v3 di §5.11) —
  komponen `PersiapanDisiapkanManager` DIBANGUN ULANG TOTAL: daftar
  klaster tunggal yang bisa dicari+filter (ganti dari kartu "Kandidat
  Otomatis" + "Belum Bisa Dikelompokkan" + "SPK Grouping Terbaru"
  terpisah), panel "Grouping Baru" (desktop: sticky kanan; mobile:
  floating di atas `.gc-mobile-nav`) dengan pilih anggota + edit qty
  per baris (mendukung partial), preview kode SPK Grouping (non-
  transaksional), cetak label lewat dialog konfirmasi sekali-tampil
  (ganti daftar persisten). **5 jalur×5 tahap `JalurTahapManager` &
  `buatSpkTrackUntukGrouping()` TIDAK DISENTUH di ronde ini** — baru
  di §5.11 fungsi itu ditambah parameter (backward-compatible, lihat
  §5.11).
- `css/gechoo-design.css` (v5→v6) — kelas baru `.gc-pp-panel`/
  `.gc-pp-panel-mobile`/`.gc-pp-layout` (breakpoint 768px), posisi
  panel mobile floating SUDAH dihitung supaya clear dari
  `.gc-mobile-nav` (`bottom:calc(70px + safe-area)`, z-index di bawah
  nav) — dicek dulu ke `js/app.js` bahwa `.gc-mobile-nav` tampil di
  SEMUA tab (bukan cuma Home), jadi WAJIB dihindari di semua layar.
- `index.html` — cuma bump versi query-string 2 file di atas
  (`?v=1→2`, `?v=5→6`), tidak ada perubahan struktur.

**Validasi yang DIJALANKAN sebelum kirim** (sesuai batas kemampuan
sandbox — TIDAK BISA uji browser+Firebase sungguhan, lihat
`PEDOMAN-GAYA-KERJA.md`): `node --check` (sintaks JS lolos), skrip
hitung buka/tutup tag HTML (div/span/button/label/template/p/h3 —
semua seimbang), hitung buka/tutup kurung kurawal CSS (seimbang).
**INI BUKAN "sudah divalidasi" penuh** — belum ada 1 pun uji nyata di
browser dengan data Firestore sungguhan.

**BELUM DILAKUKAN / BELUM DIVERIFIKASI (WAJIB dicek sesi berikutnya)**:
1. Guru belum copy 3 file di atas dari folder `Code` ke repo kerja &
   `git push`.
2. **BELUM DIUJI SAMA SEKALI** di browser+Firebase sungguhan. Yang
   PALING perlu dicek Guru: klaster tampil & ke-grup dengan benar
   (termasuk size beda TIDAK ketuker), panel pilih+qty jalan (termasuk
   partial qty — pecah 1 SPK ke lebih dari 1 grouping), preview kode
   SPK cocok dengan kode final setelah submit, jalur otomatis (Bahan/
   Sewing/Webbing/Finishing) kedeteksi benar dari BOM, checkbox Vendor
   masih berfungsi, panel mobile floating tidak ketiban `.gc-mobile-nav`
   di HP sungguhan, label cetak setelah grouping benar.
3. TIDAK ADA perubahan `firestore.rules` — field baru di `order_spk`/
   `spk_grouping` masih dalam koleksi yang SUDAH ada rule-nya (tidak
   ada koleksi baru), tapi belum diverifikasi field-level (proyek ini
   setahu ini pola rule-nya document-level, bukan field-level).
4. Fitur "batalkan grouping" SENGAJA belum ada (poin 4 keputusan Guru)
   — kalau Guru salah pilih anggota/qty, saat ini belum ada jalan
   balik dari UI, cuma lewat Firestore Console manual.

### 5.11 Modul baru: Persiapan Produksi > Bahan (wireframe handoff modul ke-2) (BARU, 31 Agt 2026, lanjutan) — **KODE DITULIS & DIKIRIM, BELUM DI-PUSH GURU, BELUM DIUJI, RULES FIRESTORE BELUM DITEMPEL**

**Latar belakang**: lanjutan urutan paket `Mockup/handoff/` (§5.10) —
Guru minta cek folder handoff lagi ("cek ada yg baru disana, kita kejar
yg belumnya"), ketemu 4 modul BARU sekaligus (Bahan, Acc Sewing, Acc
Webbing, Acc Finishing). Sesuai aturan paket sendiri ("satu modul, satu
sesi") + kesepakatan interupsi dini (§5.10), Guru diminta konfirmasi
scope dulu — jawab: **Bahan dulu saja sesi ini**, Sewing/Webbing/
Finishing menyusul sesi terpisah (BELUM dikerjakan — sekarang SUDAH,
sekaligus, lihat §5.11d).

**Konflik arsitektur SERIUS ditemukan sebelum nulis kode** (dicek ke
kode live, BUKAN tebakan): `SERAH-TERIMA.md` modul Bahan menyebut
koleksi `persiapan_komponen` sebagai sumber data ("sudah ada di
repo"). **INI SUDAH TIDAK BENAR** — `js/vue-order-spk.js` baris ~91-103
punya komentar eksplisit: koleksi itu (+ `persiapan_produksi`)
**DITINGGALKAN Guru sendiri 29 Agt 2026 TANPA MIGRASI** ("belum sempat
dipakai produksi nyata", UI-nya sudah dicopot). Spek handoff ini
ternyata ditulis independen dari koreksi arsitektur 29 Agt itu — jadi
BUKAN cuma klaim Guru yang perlu dicek (§2 poin 4/§5.10), **spek
wireframe sendiri JUGA bisa ketinggalan zaman dari kode live**, harus
tetap diverifikasi. Sumber sungguhan sekarang: `spk_grouping.breakdown[]`
(daftar anak SPK per grouping, sudah ada) + `master_produk.bom_pola[]`
(BUKAN `bom_aksesoris[]` seperti disebut spek — itu punya pos Acc,
lihat §5.3) + `master_bahan_aksesoris` (stok, sudah ada).

**Solusi skema** (disetujui via AskUserQuestion, jawaban "masih kosong/
belum pernah dipakai" — jadi TIDAK perlu backfill data lama): field
BARU `spk_track.bahan_rincian[]`, diisi SAAT SPK Grouping jalur 'bahan'
diterbitkan (fungsi `hitungBahanRincian()`, dipanggil dari
`buatGroupingDariPanel()`/`buatGroupingSendiri()` di §5.10 — parameter
BARU `bahanRincian` ditambahkan ke `buatSpkTrackUntukGrouping()`,
BACKWARD-COMPATIBLE karena jalur selain 'bahan' dapat array kosong).
SATU baris per (bahan × anak SPK) — bukan per grouping — karena
wireframe butuh ketelitian setingkat itu (penunjukan & entry scan
terjadi per baris komponen, bukan per grouping utuh). Field per baris:
`order_spk_id, no_spk, qty, bahan_aksesoris_id, bahan_nama, bahan_warna,
nama_pola, produk_size, panjang_pola, isi_pola_pcs, amparan,
kebutuhan_kain, status, masuk_tahap_pada, label_cetak_pada,
operator_uid, operator_nama, ditugaskan_pada, riwayat_operator[],
entry_qty, entry_oleh, entry_pada, catatan_masalah, kode_bagging,
kode_tugas`. Rumus kebutuhan (dari spek §3): `amparan = ceil(qty /
isi_pola_pcs)`, `kebutuhan_kain (m) = (panjang_pola cm / 100) × amparan`.

**3 keputusan Guru lain** (diskusi lewat chat, bukan cuma
AskUserQuestion, karena butuh penjelasan bolak-balik):
1. **Model operator** — individu ATAU tim, TANPA field skema baru
   (tim = identitas sendiri di data operator/QR, sama seperti
   individu). **Estafet shift DIIZINKAN**: operator boleh diganti di
   tengah jalan sebelum baris selesai (scan ulang operator baru +
   baris yang sama), riwayat disimpan (`riwayat_operator[]`, BUKAN
   ditimpa) — "1 anak SPK dipegang 2 operator SEKALIGUS" (simultan)
   TIDAK didukung (Guru konfirmasi belum pernah ada kasus itu). Riwayat
   estafet DITAMPILKAN (bukan cuma disimpan), buat ketahuan kalau ada
   reject.
2. **Ambang "tertahan"** — **6 jam**, ditandai warna, SAMA untuk semua
   tab/pos (konstanta `AMBANG_TERTAHAN_JAM` di `js/vue-persiapan-
   bahan.js`), dihitung dari field baru `masuk_tahap_pada` (ISO string,
   BUKAN `serverTimestamp()` — Firestore tidak izinkan sentinel itu di
   dalam elemen array, cuma field top-level dokumen).
3. **4 tab dulu, Selesai placeholder** — sesuai jawaban AskUserQuestion
   sebelumnya, tab Selesai (riwayat) memang belum digambar di wireframe
   (§4/§7 SERAH-TERIMA) — dibiarkan placeholder kosong sesuai rencana.

**File BARU**: `js/vue-persiapan-bahan.js` (~67KB) — 5 komponen Vue
(`PersiapanBahanPerluDisiapkan`, `SedangDisiapkan`, `PerluDikirim`,
`SedangDikirim` [VIEW-ONLY, scan sampai di luar scope §4 SERAH-TERIMA],
`Selesai` [placeholder]), komponen scan kamera lokal `ModalScanQr`
(pola DISALIN dari `JalurTahapManager`, auto-lanjut scan berikutnya
selama modal terbuka — dukung "scan berkali-kali" tanpa buka-tutup
manual), fungsi read-modify-write atomik `updateBarisBahan()`/
`konfirmasiEntry()` (runTransaction rangkap 2 dokumen — spk_track +
master_bahan_aksesoris — supaya stok berkurang atomik bareng status
baris pindah, SATU-SATUNYA tempat stok berkurang, sesuai uji-terima
§8 SERAH-TERIMA), generator kode harian `generateKodeHarian()` (pola
sama `generateKodeSpkGrouping()`, counter terpisah per jenis).

**File DIUBAH**:
- `js/vue-persiapan-produksi-v2.js` (v2→v3) — tambah `hitungBahanRincian()`,
  `ambilPetaBahanAksesoris()`, param `bahanRincian` di
  `buatSpkTrackUntukGrouping()` + 2 titik pemanggilnya.
- `js/dashboard.js` (v20→v21) — `petaMount` 2 entry Bahan diganti (key
  div id + nama fungsi, dari `...PerluDiproses`/`...SedangDiproses`
  jadi `...PerluDisiapkan`/`...SedangDisiapkan`).
- `index.html` — div mount + label tab jalur Bahan diganti ("Perlu
  Disiapkan"/"Sedang Disiapkan"/"Perlu Di Kirim"/"Sedang Di Kirim",
  BUKAN "Diproses"/"Dikirim" tanpa spasi — ikut istilah PEDOMAN-SERAH-
  TERIMA §"Aturan semua modul" #7), tambah `<script>` file baru, bump
  versi `vue-persiapan-produksi-v2.js` (`?v=2→3`) & `dashboard.js`
  (`?v=20→21`). **5 mount lama jalur Bahan di JalurTahapManager
  (`js/vue-persiapan-produksi-v2.js`) SENGAJA DIBIARKAN sebagai kode
  mati** (guard `if(mountPoint)` gagal karena div-nya sudah dihapus/
  diganti nama) — TIDAK dihapus fisik supaya diff lebih kecil &
  jelas asal-usulnya kalau nanti perlu ditelusuri; boleh dibersihkan
  kapan saja tanpa risiko, tidak dipanggil dari mana pun lagi.

**Koleksi Firestore BARU** (belum ada di skema): `bagging`
(`{kode, produk_label, isi[], ditutup_pada, dibuat_pada, dibuat_oleh}`,
kode format `BAGyymmdd-NNN` harian berurut, TANPA TLC — sesuai spek),
`tugas_kirim` (`{kode, tlc_asal, tlc_tujuan, pack[], dibuat_pada,
dibuat_oleh}`, kode `TGSyymmdd-NNN`), `master_tlc`
(`{kode, nama, tipe}` — daftar Titik Lokasi Cerdas/tempat, bisa
diisi contoh 10 lokasi lewat tombol "Isi TLC Awal" di UI kalau masih
kosong), `cetak_ulang_log` (`{kode_spk, bahan, alasan, pin_oleh, pada}`
— audit cetak ulang label), plus 2 koleksi counter harian
(`pengaturan_id_bagging`, `pengaturan_id_tugas_kirim`, pola sama
`pengaturan_id_spk_grouping`). **2 file txt disiapkan & dikirim**:
`firestore-rules-tambahan-persiapan-produksi-bahan.txt` (6 blok
`match`, pola SAMA `login()`/`isAdminLevel()` seperti koleksi lain),
`firestore-index-tambahan-persiapan-produksi-bahan.txt` (isinya: TIDAK
ADA index composite baru dibutuhkan — semua query baru cuma equality
1 field, kepakai single-field index otomatis Firestore).

**Penyederhanaan dari wireframe** (dicatat transparan, boleh dikoreksi
Guru):
- Wireframe gambarkan 1 modal scan 3-field (kunci baris → entry/
  masalah) per operator-group; di sini tiap AKSI (Scan Entry/Scan
  Masalah/Ganti Operator) jadi tombol TERPISAH per baris, satu scan =
  satu aksi langsung commit — hasil akhir sama (kriteria uji-terima
  tetap terpenuhi), tapi alurnya lebih sederhana dari yang digambar.
- "Cetak Kode Bagging"/"Cetak Kode Tugas" diimplementasikan sebagai
  cetak label KOSONG (blank) dalam jumlah tertentu dulu, ISI-nya
  ditentukan BELAKANGAN lewat scan (Scan Pack/Scan Kirim) — bukan
  kode dicetak langsung dari baris yang sudah dipilih. Ini mengikuti
  pembacaan literal §3 spek ("Kodenya belum ditampilkan; terbit saat
  dicetak").
- **PIN admin (cetak ulang label)** — TIDAK ADA infrastruktur
  verifikasi PIN generik di proyek ini (sudah dicek, PIN yang ada
  cuma buat kiosk absensi, beda konteks). PIN di sini DICATAT sebagai
  jejak audit di `cetak_ulang_log`, aksinya sendiri sudah digerbang
  izin menu admin (`bolehProses`/`isAdminLevel` rules) — BUKAN
  diverifikasi kriptografis terhadap PIN tersimpan. **Kalau Guru mau
  verifikasi PIN sungguhan, itu fitur baru terpisah** (field PIN di
  `users` + UI kelola) — belum ditanyakan/dibangun.
- Syarat "sepack" (pola+bahan+size sama, warna+no SPK boleh beda)
  divalidasi dengan membandingkan STRING label (`labelSepack()`,
  gabungan pola+bahan+size) antara baris yang discan vs `produk_label`
  yang tercatat di dokumen `bagging` saat kode itu dicetak — bukan
  perbandingan field terpisah.

**Validasi yang DIJALANKAN sebelum kirim** (sama batasan sandbox seperti
§5.10 — TIDAK BISA uji browser+Firebase sungguhan): `node --check`
lolos di ke-3 file JS (`vue-persiapan-bahan.js`, `vue-persiapan-
produksi-v2.js`, `dashboard.js`), skrip hitung buka/tutup tag HTML
(div/span/button/label/template/p/h3, termasuk di dalam template Vue
`vue-persiapan-bahan.js`) — semua seimbang. Ukuran byte dikonfirmasi
cocok persis antara yang dikirim & yang tertulis di folder `Code`
(`device_list_dir`): `vue-persiapan-bahan.js` 67334, `vue-persiapan-
produksi-v2.js` 78523, `dashboard.js` 41581, `index.html` 100874.

**BELUM DILAKUKAN / BELUM DIVERIFIKASI (WAJIB dicek sesi berikutnya)**:
1. Guru belum copy file-file di atas dari folder `Code` ke repo kerja
   & `git push`.
2. **Rules Firestore BELUM ditempel** (`firestore-rules-tambahan-
   persiapan-produksi-bahan.txt`) — TANPA ini, ke-4 koleksi baru +
   2 counter GAGAL baca/tulis (`permission-denied`) walau kode sudah
   jalan. WAJIB ditempel + Publish sebelum modul ini bisa dipakai
   sama sekali.
3. **BELUM DIUJI SAMA SEKALI** di browser+Firebase sungguhan — sama
   sekali belum ada data live buat dites (SPK Grouping jalur Bahan
   belum pernah dibuat beneran, per jawaban Guru). Yang PALING perlu
   dicek begitu ada data: kartu bahan+warna kebentuk benar & angka
   kumulatif/stok akurat, alokasi greedy (baris mana yang `_bisa`
   dicentang) masuk akal, cetak label per grouping benar (bukan
   tercampur antar grouping), penunjukan+estafet operator tersimpan &
   riwayatnya kebaca, scan entry BENAR-BENAR mengurangi
   `master_bahan_aksesoris.stok_akhir` (bukan cuma pindah status),
   syarat sepack menolak kombinasi salah di Scan Pack, kode bagging/
   tugas tidak pernah dobel dalam 1 hari.
4. Acc Sewing/Acc Webbing/Acc Finishing (3 modul sisa paket handoff)
   **SEKARANG SUDAH dikerjakan sekaligus 1 Sep 2026** — lihat §5.11d
   (sebelumnya direncanakan satu-per-satu sesuai README paket, Guru
   memilih menyimpang dari itu secara eksplisit).
5. Model "tim" sebagai identitas operator (dibahas §keputusan 1 di
   atas) — dipakai sebagai referensi langsung di §5.11d (Acc Sewing/
   Webbing/Finishing), TANPA perubahan mekanisme (sama seperti Bahan:
   individu atau tim, tanpa field skema baru).

### 5.11b Tab "Selesai" (Bahan) dibangun — retrofit dari SERAH-TERIMA.md yang diperbarui Guru (BARU, 1 Sep 2026) — **KODE DITULIS & DIKIRIM, BELUM DI-PUSH GURU, BELUM DIUJI**

Guru update `SERAH-TERIMA.md` modul Bahan di `Mockup/handoff/` (nambah
spek lengkap §2 "Child menu Selesai — riwayat", sebelumnya masih
"belum digambar") dan minta tab **Selesai** (yang di §5.11 sengaja
placeholder) dibangun sekarang, retrofit ke kode Bahan yang sudah ada.

**Yang dibangun** (`js/vue-persiapan-bahan.js`, v1→v2, ukuran 67334→78520
byte): komponen `PersiapanBahanSelesai` diisi penuh —

1. **Versi admin/pic**: 5 kartu KPI (di-scope "hari ini", dasar tanggal
   `sampai_pada`) — selesai hari ini, kain terpakai, rata-rata siklus,
   terpaksa kurang, operator terlibat — lalu papan riwayat (tabel):
   kode grouping child (+ jam cetak label di bawahnya), entry, disiapkan
   oleh, pack (kode bagging), tujuan TLC, jam sampai, siklus, keadaan
   (chip `lengkap`/`kurang` dari `catatan_masalah`).
2. **Versi operator** ("Riwayat Saya", dideteksi dari
   `window.currentUser.role === 'operator'`): daftar kartu TANPA tombol
   apapun, cuma baris yang PERNAH discan operator itu sendiri
   (`operator_uid === window.currentUser.email`), kolom entry + sampai —
   persis SERAH-TERIMA §2 ("bukti kerja, bukan tempat memperbaiki").
3. **Siklus** = jam `label_cetak_pada` → jam `sampai_pada` (SERAH-TERIMA
   §2: "ikut menghitung lama menunggu ditugaskan, mengukur pos ini bukan
   pos penerima").

**2 field baru** di `spk_track.bahan_rincian[]`:
- `tlc_tujuan` — SEKARANG disnapshot ke baris SAAT Scan Kirim (fungsi
  `hasilScanKirim()`, Tab 3), diambil dari `tugas_kirim.tlc_tujuan` —
  supaya tab Selesai tidak perlu query balik ke `tugas_kirim`.
- `sampai_pada` — **BELUM ADA PENULISNYA DI MANAPUN DI SISTEM INI.**
  Field ini akan diisi oleh layar **"Scan Sampai"** milik divisi
  PENERIMA (mis. Proses Produksi > Potong) — yang menurut SERAH-TERIMA
  §4 Scope sendiri secara eksplisit **DI LUAR LINGKUP modul Bahan**
  ("Layar scan sampai | divisi penerima (belum digambar)"). Modul itu
  BELUM DIBANGUN di manapun di seluruh sistem sampai saat ini. **Catatan
  §5.11d**: pola field `sampai_pada`/`tlc_tujuan` yang SAMA dipakai lagi
  di 3 pos Acc (Sewing/Webbing/Finishing) — jadi kekurangan penulis ini
  SEKARANG berlaku di 4 pos sekaligus (Bahan + 3 Acc), bukan cuma Bahan.

**KONSEKUENSI PENTING**: tab Selesai ini akan **tampil KOSONG TERUS**
sampai modul "Scan Sampai" (divisi penerima) dibangun — bukan bug di
file ini, tapi memang belum ada jalur yang menulis `status:'selesai'`
+ `sampai_pada` ke `bahan_rincian[]`. Baris yang sudah di-Scan Kirim
(status `sedang_dikirim`) akan menumpuk di situ tanpa pernah pindah,
sampai layar penerima itu ada. **Ini perlu dibahas dengan Guru**: siapa
yang akan bangun/pakai layar Scan Sampai itu, dan modul apa yang jadi
rumahnya (kandidat paling masuk akal: bagian dari Persiapan Produksi
jalur produksi/Cutting, tapi BELUM ADA skema/menu buat itu sekarang —
lihat §5.9 soal Pipeline Produksi yang masih placeholder).

**Retensi data riwayat**: SERAH-TERIMA §7 masih menandai ini "belum
diputuskan" — diasumsikan TANPA batas waktu dulu (tidak dihapus
otomatis), sampai Guru tentukan lain.

**File dikirim ulang**: `js/vue-persiapan-bahan.js` (v2, 78520 byte),
`index.html` (cache-bust `?v=1`→`?v=2`, ukuran tetap 100874 byte — cuma
1 karakter berubah). Validasi: `node --check` lolos, tag HTML balance
semua OK (div 109/109, table/thead/tbody/tr/th/td semua seimbang).
Ukuran byte dikonfirmasi cocok persis di folder `Code`
(`device_list_dir`). **BELUM di-push Guru, BELUM diuji.**

### 5.11c Ditemukan: 3 modul baru masuk ke `Mockup/handoff/` (BARU, 1 Sep 2026)

Sambil mengerjakan 5.11b, Guru minta cek ulang folder
`Mockup/handoff/` — ternyata paket wireframe BARU SAJA nambah 3 folder
modul sekaligus (semuanya lengkap: `SERAH-TERIMA.md` + `wireframe.dc.html`
+ `support.js` + 10 screenshot `gambar/`): **Acc Sewing**, **Acc Webbing**
(+kolom roll & Kode Webbing 2/3), **Acc Finishing** (+kolom varian &
keadaan cetak). `README.md` paket menegaskan **urutan pengerjaan TIDAK
BOLEH dibolak-balik** (tiap modul menumpang kode modul sebelumnya) —
jadi walau ketiganya sudah tersedia sekaligus, tetap harus **Acc Sewing
dulu**, baru Webbing, baru Finishing — SATU MODUL SATU SESI (aturan yang
sama seperti Bahan). README juga bilang ke-4 pos (Bahan + 3 Acc) SAMA
strukturnya (5 child menu sama, scan QR operator+label, stok berkurang
di scan entry, cetak ulang PIN admin, kode bagging+tugas di kirim) — cuma
kolom kartunya beda per pos — dan modul Bahan yang sudah dibangun jadi
**acuan pola** buat ke-3 modul Acc berikutnya. **Belum dikerjakan sama
sekali** — cuma ditemukan & dicatat di sini, tunggu Guru mulai sesi baru.
**KOREKSI §5.11d**: Guru KEMUDIAN secara eksplisit meminta ke-3 modul ini
dikerjakan SEKALIGUS dalam 1 sesi, menyimpang dari "satu modul satu sesi"
di atas — lihat §5.11d, ini BUKAN pelanggaran diam-diam, Guru yang minta.

### 5.11d Modul baru sekaligus: Persiapan Produksi > Acc Sewing/Webbing/Finishing (BARU, 1 Sep 2026, sesi lanjutan) — **KODE DITULIS & DIKIRIM (zip gabungan), BELUM DI-PUSH GURU, BELUM DIUJI, TIDAK PERLU RULES FIRESTORE BARU**

**Latar belakang & instruksi eksplisit Guru**: setelah §5.11c mencatat
3 modul baru masuk `Mockup/handoff/` dengan aturan "satu modul satu
sesi, urutan Sewing→Webbing→Finishing tidak boleh dibalik", Guru
secara eksplisit bilang: *"saya minta kamu kerjain sekaligus acc
sewing, acc webing, acc finishing"* + *"tapi nanti filenya suguhkan
berbarengan yah dalam zipnya"*. **Ini keputusan SADAR Guru menyimpang
dari aturan README paket sendiri** — tidak perlu dikonfirmasi ulang
lewat AskUserQuestion karena instruksinya sudah eksplisit & tidak
ambigu (beda dengan §5.10/§5.11 yang memang butuh klarifikasi karena
ada konflik arsitektur tersembunyi). Urutan pengerjaan INTERNAL tetap
mengikuti README (Sewing dulu — pola paling sederhana — lalu diturunkan
mekanis ke Webbing lalu Finishing), cuma DIKIRIM sekaligus di akhir,
bukan disetujui/di-deploy Guru satu-satu.

**Riset kode live SEBELUM menulis** (agent riset terpisah, sesuai
`PEDOMAN-GAYA-KERJA.md` — jangan tebak, cek kode dulu): dikonfirmasi
ULANG bahwa `persiapan_komponen` tetap DEAD (sama seperti §5.11, tidak
ada perubahan), dan ditemukan **beda arsitektur kartu yang FUNDAMENTAL**
dari modul Bahan (dicek langsung dari komentar header
`vue-persiapan-bahan.js` sendiri): Bahan = "SATU KARTU SATU BAHAN +
WARNA" (kartu digabung LINTAS DOKUMEN, per jenis bahan). Ke-3 pos Acc
ini = **"SATU KARTU SATU SPK GROUPING"** (kartu = 1 dokumen `spk_track`
itu sendiri, TIDAK ADA penggabungan lintas dokumen, TIDAK ADA alokasi
stok kumulatif ala `kelompokKartuBahan` Bahan) — sesuai SERAH-TERIMA
ke-3 pos ini eksplisit menyebut ini bedanya dari pos Bahan.

**Field `bom_aksesoris[].tahap_proses`** (di `master_produk`, teks
bebas) dicocokkan LONGGAR ke jalur lewat
`.trim().toLowerCase().includes('sewing'|'webbing'|'finishing')` — pola
yang SAMA dipakai fungsi lama `jalurOtomatisProduk()`, dipakai lagi
konsisten di 3 fungsi baru `hitungSewingRincian()`/
`hitungWebbingRincian()`/`hitungFinishingRincian()`.

**Field baru `master_bahan_aksesoris.panjang_roll`** (opsional, meter) —
ditambahkan untuk basis hitung kolom "roll" Acc Webbing (Webbing perlu
tahu berapa roll harus diambil dari `butuh_meter / panjang_roll`, null-
safe kalau field ini belum diisi item aksesoris terkait).

**Pola read-modify-write BARU: `updateBarisXxxMassal()`** — Bahan
punya `updateBarisBahan(trackId, lineIdx, patchFn)` (patch 1 baris per
scan). Di ke-3 pos Acc ini, 1 scan (Tunjuk Operator/Scan Pack/Scan
Kirim) bisa menyentuh BEBERAPA baris komponen sekaligus (semua baris
1 anak-SPK, atau semua baris yang share `kode_bagging`) — karena beda
dari Bahan yang 1 kartu=1 jenis bahan (jadi max 1 baris per anak-SPK
per kartu), di sini 1 anak-SPK bisa punya banyak baris komponen
sekaligus dalam 1 kartu SPK Grouping. Ditambahkan fungsi paralel
`updateBarisXxxMassal(trackId, matchFn, patchFn)` (patch SEMUA elemen
array yang cocok predicate, dalam 1 `runTransaction`) di ke-3 file,
dipakai di scan-scan itu — `updateBarisXxx` single-row tetap ada juga
untuk Scan Entry (yang memang selalu 1 baris).

**Label cetak: "1 label PER ANAK SPK"** (BEDA dari Bahan yang "1
label PER GROUPING") — sesuai SERAH-TERIMA ("1 SPK = 1 label...seluruh
komponen dirinci di dalamnya"), karena 1 grouping bisa berisi lebih
dari 1 anak-SPK yang masing-masing butuh label fisik sendiri. QR yang
DICETAK di label untuk keterlusuran saja — yang BENERAN discan ulang
tetap `no_spk` polos (tag fisik lama dari modul "Perlu Disiapkan"),
sama seperti Bahan.

**"Syarat sepack" BEDA kunci dari Bahan** — Bahan kunci
`pola+bahan+size`; ke-3 pos Acc ini kunci **`produk+size` saja**
(SERAH-TERIMA: "komponennya sudah terikat SPK, jadi bukan pola dan
bahan seperti pos Bahan").

**Koleksi/skema BERBAGI dengan Bahan, TIDAK ADA yang baru**: `bagging`,
`tugas_kirim`, `master_tlc` (sudah diisi entri `TLC-SEW`/`TLC-WEB`/
`TLC-FIN`), `cetak_ulang_log`, `pengaturan_id_bagging`,
`pengaturan_id_tugas_kirim` — SEMUA dikonfirmasi generik/tidak
di-filter jalur di `firestore.rules` (grep langsung ke file rules) —
**TIDAK PERLU perubahan `firestore.rules` sama sekali** untuk ke-3
modul baru ini (beda dari modul Bahan §5.11 yang butuh 6 blok rules
baru).

**Field baru di `spk_track`**: `sewing_rincian[]`, `webbing_rincian[]`,
`finishing_rincian[]` — pola field TERPISAH per jalur (BUKAN 1 array
generik gabungan) supaya TIDAK perlu migrasi bentuk `bahan_rincian[]`
yang sudah ada. Sama seperti `bahan_rincian[]`, masing-masing HANYA
diisi kalau `jalur` dokumen itu cocok, array kosong untuk jalur lain.
Isi baris `webbing_rincian[]` beda dari Sewing/Finishing: tambahan
`panjang_per_pcs`, `butuh_meter`, `roll` (null kalau `panjang_roll`
item belum diisi), `kode_webbing2`/`kode_webbing3`. Isi baris
`finishing_rincian[]`: tambahan `varian_tipe` (default `'tunggal'`) &
`varian_jumlah` (default `1`) — **KEPUTUSAN default, bukan tebakan
diam-diam**: SERAH-TERIMA Finishing masih menandai varian sebagai
"belum diputuskan", jadi 1 baris = 1 varian tunggal dipakai sebagai
default aman, dicatat eksplisit di komentar kode supaya kelihatan kalau
Guru mau ubah nanti. `keadaan_cetak`/`sisa_dicetak` Finishing DIHITUNG
LIVE per baris (bukan field tersimpan) dari status vs `qty`/`varian_
jumlah` — konsisten dengan cara Bahan menghitung status live, bukan
duplikasi state.

**File BARU**:
- `js/vue-persiapan-sewing.js` (~1200+ baris) — ditulis TANGAN penuh
  (pola-nya jadi acuan buat 2 file berikutnya), config `JALUR='sewing'`,
  `FIELD_RINCIAN='sewing_rincian'`, `SUFFIX_LABEL='SEW'`,
  `TLC_ASAL='TLC-SEW'`, `MENU_ID='pp_sewing'`.
- `js/vue-persiapan-webbing.js` — diturunkan MEKANIS dari file Sewing
  (`cp` + `sed` rename konstanta/nama komponen/fungsi/mount-id), lalu
  ditambah manual: kolom roll (`formatRoll()`), badge `kode_webbing2`/
  `kode_webbing3`, kolom "Roll" di tabel admin Tab 5. Config
  `JALUR='webbing'`, `FIELD_RINCIAN='webbing_rincian'`,
  `SUFFIX_LABEL='WEB'`, `TLC_ASAL='TLC-WEB'`, `MENU_ID='pp_webbing'`.
- `js/vue-persiapan-finishing.js` — diturunkan sama seperti Webbing,
  ditambah manual: badge `_keadaanCetak`/`_sisaDicetak` per baris,
  badge jumlah varian kalau >1. Config `JALUR='finishing'`,
  `FIELD_RINCIAN='finishing_rincian'`, `SUFFIX_LABEL='FIN'`,
  `TLC_ASAL='TLC-FIN'`, `MENU_ID='pp_finishing'`.
- **2 bug KECIL dari proses sed diketahui & DIPERBAIKI sebelum kirim**:
  blanket-replace `Acc Sewing`→`Acc Webbing`/`Acc Finishing` sempat
  ikut salah-rename label pos LAIN di dalam seed data bersama
  `master_tlc` (`['TLC-SEW', 'Pos Acc Sewing']` sempat ikut ke-rename
  jadi `'Pos Acc Webbing'` di file Webbing) — ketahuan lewat grep
  verifikasi setelah tiap sed pass, diperbaiki manual di ke-2 file
  turunan sebelum lanjut.

**File DIUBAH**:
- `js/vue-persiapan-produksi-v2.js` — tambah helper
  `_butuhAksesorisDasar()` + 3 fungsi `hitungSewingRincian()`/
  `hitungWebbingRincian()`/`hitungFinishingRincian()` (pola sama
  `hitungBahanRincian()`); `buatSpkTrackUntukGrouping()` ditambah 3
  parameter baru (`sewingRincian`, `webbingRincian`, `finishingRincian`)
  — BACKWARD-COMPATIBLE, jalur lain array kosong; 2 titik pemanggil
  (`buatGroupingDariPanel`/`buatGroupingSendiri`) dihitung ulang untuk
  ikut menyertakan ke-3 rincian baru kalau jalur terkait aktif.
- `js/vue-bahan-aksesoris.js` — tambah field `panjang_roll` (opsional,
  meter) di form tambah & edit item (6 lokasi: `formKosong()`, payload
  simpan, UI input — dobel untuk form tambah & form edit), generalisasi
  (tidak dibatasi ke `jenis` tertentu) supaya bisa dipakai item mana pun
  yang butuh basis hitung roll.
- `index.html` — **GANTI TOTAL** 3 blok konten `sub-pp-sewing`/
  `sub-pp-webbing`/`sub-pp-finishing` (dulu generik 5-tab
  `JalurTahapManager`, label "Perlu Diproses"/dst dengan mount id
  `vue-pp-sewing-perludiproses` dst) — SEKARANG label & id-nya DIGANTI
  konsisten dengan istilah Bahan ("Perlu Disiapkan"/"Sedang Disiapkan"/
  "Perlu Di Kirim"/"Sedang Di Kirim"/"Selesai", mount id
  `vue-pp-sewing-perludisiapkan` dst); 3 tombol sidebar (`onclick`
  `pindahSubTab` ke tab pertama) ikut diretarget ke id baru; 3
  `<script type="module" src="js/vue-persiapan-{sewing,webbing,
  finishing}.js?v=1">` ditambah, ditaruh tepat setelah tag
  `vue-persiapan-bahan.js?v=2` yang sudah ada.
- `js/dashboard.js` — `petaMount` 15 entry lama (5 tab × 3 pos, mis.
  `'sub-pp-sewing-perludiproses': 'pastikanMountPpSewingPerluDiproses'`)
  DIGANTI TOTAL ke id & nama fungsi baru yang cocok dengan file JS baru
  (mis. `'sub-pp-sewing-perludisiapkan': 'pastikanMountPpSewingPerlu
  Disiapkan'`) — **sebelum diganti, nama fungsi dikonfirmasi LANGSUNG**
  dengan `grep` ke ke-3 file JS baru (bukan ditebak dari pola Bahan),
  supaya tidak ada typo yang bikin lazy-mount gagal diam-diam. Entry
  jalur `pp_vendor` (di luar cakupan sesi ini) TIDAK disentuh, tetap
  `-perludiproses`/`-sedangdiproses` seperti semula.

**Validasi yang DIJALANKAN sebelum kirim**: `node --check` lolos di
ke-6 file JS yang disentuh (`vue-persiapan-sewing.js`,
`vue-persiapan-webbing.js`, `vue-persiapan-finishing.js`,
`vue-persiapan-produksi-v2.js`, `vue-bahan-aksesoris.js`,
`dashboard.js`); skrip hitung buka/tutup tag HTML seimbang di ke-3
file baru (`div`/`span`/`button`/`label`/`template`/`p`/`h3`/
`table`/`thead`/`tbody`/`tr`/`th`/`td`, masing-masing dicek per file
karena jumlah kolom beda per pos) DAN di `index.html` setelah semua
edit (div 237/237, span 10/10, button 108/108, p 6/6 — seimbang);
konsistensi lazy-mount diverifikasi manual 3-arah (id div di
`index.html` == target `getElementById()` di tiap file JS ==
key `petaMount` di `dashboard.js`) — bukan cuma dites sintaks, tapi
dicocokkan literal string-nya. **INI BUKAN "sudah divalidasi" penuh**
— sama seperti §5.10/§5.11, belum ada 1 pun uji nyata di browser
dengan data Firestore sungguhan, dan belum ada 1 pun SPK Grouping
jalur Sewing/Webbing/Finishing yang pernah dibuat beneran untuk dites.

**Deliverable**: SEMUA file di atas (3 baru + 4 diubah) digabung dalam
**1 file ZIP**, sesuai instruksi eksplisit Guru "filenya suguhkan
berbarengan...dalam zipnya" — BUKAN dikirim satu-satu ke folder `Code`
seperti pola sesi-sesi sebelumnya.

**BELUM DILAKUKAN / BELUM DIVERIFIKASI (WAJIB dicek sesi berikutnya)**:
1. Guru belum extract zip ke folder `Code`/repo kerja & `git push`.
2. **BELUM DIUJI SAMA SEKALI** di browser+Firebase sungguhan — sama
   sekali belum ada data live (belum pernah ada SPK Grouping jalur
   Sewing/Webbing/Finishing beneran). Yang PALING perlu dicek begitu
   ada data: kartu per-SPK-Grouping kebentuk benar (BUKAN tergabung
   lintas dokumen seperti Bahan — kalau kelihatan tergabung, itu bug),
   massal-update (Tunjuk Operator/Scan Pack/Scan Kirim) benar-benar
   mematch & mematch SEMUA baris terkait (bukan cuma 1), label per-
   anak-SPK tercetak benar (bukan 1 label per grouping), kolom roll
   Webbing kehitung benar (termasuk kasus `panjang_roll` belum diisi
   — harus tampil "-"/null-safe bukan crash/NaN), default varian
   tunggal Finishing masuk akal buat kasus nyata pertama yang punya
   variasi (>1 varian), syarat sepack `produk+size` menolak kombinasi
   salah di Scan Pack, `master_tlc` seed `TLC-SEW`/`TLC-WEB`/`TLC-FIN`
   tidak bentrok/salah label (2 bug sed sempat kejadian, sudah
   diperbaiki, tapi WAJIB dicek ulang visual).
3. Model "tim" operator (referensi §5.11 keputusan 1) — SERAH-TERIMA
   Sewing menyebut contoh "1 SPK 1 tim" tapi belum ada test case NYATA
   — cek dengan Guru begitu ada operator/tim sungguhan yang dites di
   pos ini.
4. **Tidak ada firestore.rules baru yang perlu di-Publish untuk ke-3
   modul ini** (dikonfirmasi lewat grep, bukan asumsi) — TAPI rules
   modul Bahan (§5.11, 6 blok baru) MASIH belum dikonfirmasi selesai
   di-Publish, dan itu blocker bersama karena ke-3 modul Acc ini pakai
   koleksi (`bagging`/`tugas_kirim`/`master_tlc`/`cetak_ulang_log`)
   yang SAMA dengan Bahan.
5. Sama seperti Bahan (§5.11b) — tab Selesai ke-3 pos ini JUGA akan
   tampil KOSONG TERUS sampai modul "Scan Sampai" (divisi penerima)
   dibangun, karena field `sampai_pada` di `sewing_rincian[]`/
   `webbing_rincian[]`/`finishing_rincian[]` JUGA tidak punya penulis
   di manapun — bukan bug, konsekuensi yang sama seperti §5.11b, cuma
   sekarang berlaku di 4 pos sekaligus.

## 6. Bug besar & pelajaran BARU (selain yang sudah ada di versi awal)

- **Sidebar desktop minimize/maximize tidak jalan** (§44.26) — akar
  masalah: elemen HTML punya `style="display:flex"` inline SEKALIGUS
  class `hidden` — inline style SELALU menang mutlak dari CSS
  eksternal manapun. **Akibat sampingan yang baru ketahuan**: SEMUA
  tombol parent grup sidebar (termasuk yang harusnya cuma Owner/
  Superuser) ternyata SELALU tampil ke SEMUA role dari sisi tampilan
  (walau kemungkinan tetap ke-block di lapisan lain). Kalau nambah
  elemen yang mau disembunyikan pakai `hidden`, JANGAN kasih inline
  `style="display:..."` di elemen yang sama.
- **Bug boros N+1 & full-collection-scan** (§44.15-§44.18) — di skala
  ~500 karyawan sungguhan, pola "ambil semua lalu saring di JS" yang
  dulu terasa "cukup aman" di skala kecil, ternyata jadi **86 ribu
  baca/hari**. Pelajaran: prinsip hemat di `PRINSIP-HEMAT.md` BUKAN
  cuma teori, terbukti jadi masalah nyata begitu skala pengguna naik.
  **Diterapkan langsung di dashboard Beranda desktop baru (§5.9)** —
  semua KPI pakai `getCountFromServer()`, bukan tarik dokumen penuh.
- **Menu grup top-level baru lupa didaftarkan ke gerbang role di
  `auth.js`** (§45, 30 Agt 2026) — begitu bikin grup sidebar top-level
  BARU (sejajar Zevanic House/Persiapan Produksi), WAJIB SEKALIAN
  tambahkan elemen tombolnya ke `window.aturTampilanBerdasarkanRole()`
  di `js/auth.js` (masuk daftar reset `hidden` + dicopot untuk role
  yang berhak) — kalau lupa, class `hidden` bawaan di `index.html`
  TIDAK PERNAH tercopot untuk role manapun, menu jadi tidak pernah
  muncul walau semua file lain (routing, mount, Vue component) sudah
  benar. Ini KELAS BUG YANG SAMA POTENSInya terulang lagi kalau bikin
  grup top-level baru lagi ke depan — cek checklist ini SETIAP kali.
- **Tanggal "hari ini" via `toISOString()` itu UTC, BUKAN tanggal
  lokal device — dan tanggal lokal device pun masih ikut timezone
  device apa adanya** (§5.9d/§5.9e, 30 Agt 2026) — proyek ini pakai
  zona waktu WIB (UTC+7) buat penggunanya, jadi setiap hari jam
  **00:00-06:59 WIB**, `new Date().toISOString().split('T')[0]`
  mengembalikan tanggal KEMARIN (versi UTC), padahal admin/karyawan
  yang mengisi form (`<input type="date">`) melihat tanggal LOKAL
  (sudah hari baru). Bug ini bikin kartu Quote desktop+mobile tidak
  pernah cocok dengan Quote yang dijadwalkan Guru. **Pola yang PALING
  BENAR** (dipakai sekarang): paksa timezone Asia/Jakarta eksplisit —
  `new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Jakarta'})`
  — BUKAN `toISOString()` (UTC) dan BUKAN cuma `getFullYear/getMonth/
  getDate` polos (ikut timezone device, bisa salah kalau device
  salah-setting). Ini buat tanggal KALENDER LOKAL saja — beda dengan
  timestamp presisi tinggi seperti `dibuat_pada`/notifikasi "sudah
  dibaca", yang MEMANG pantas pakai `toISOString()`/`serverTimestamp()`
  penuh karena itu titik waktu, bukan tanggal kalender. **Kelas bug
  yang SAMA berpotensi ada di tempat lain** yang masih pakai pola
  lama: `js/vue-kartu-stok.js` (default input tanggal),
  `js/vue-reimburse.js` & `js/dashboard.js` (nama file CSV export) —
  BELUM diperbaiki (di luar scope laporan Guru sesi ini, dampak lebih
  kecil) — cek checklist ini kalau ada laporan bug "tanggal salah 1
  hari" di modul lain ke depan.
- **Field jam device (`new Date()`, non-`_ts`) VS field jam server
  (`serverTimestamp()`, `_ts`) — HARUS TAHU BEDANYA sebelum pakai buat
  KEPUTUSAN** (§5.9e, 30 Agt 2026, dari audit keamanan Absensi/Clock
  In) — proyek ini SUDAH benar untuk bagian yang PALING penting:
  timestamp Clock In/Out asli (`waktu_ts`/`waktu_masuk_ts`/
  `waktu_keluar_ts`, `js/vue-camera.js`) dan penghitungan status
  Ontime/Terlambat (`hitungStatusKehadiran()`, `js/vue-antrean-
  absensi.js`) SEMUA pakai/mengandalkan `serverTimestamp()` — jam
  device TIDAK BISA dipalsukan buat mengubah ini. TAPI field teks
  tampilan (`waktu`/`waktu_masuk`/`waktu_keluar`, dari
  `new Date().toLocaleString('id-ID')`) MASIH pakai jam device, dan
  ini yang TAMPIL ke admin di Antrean Absensi/Riwayat All Absensi —
  jadi teks jamnya BISA menyesatkan walau badge status di sebelahnya
  tetap benar. **Aturan ke depan**: field APAPUN yang dipakai untuk
  KEPUTUSAN (status kehadiran, approval, perhitungan gaji/jam kerja)
  WAJIB dari `_ts`/`serverTimestamp()`, TIDAK PERNAH dari `new Date()`
  polos di browser — field `new Date()` cuma boleh dipakai untuk hal
  yang MURNI kosmetik/display dan tidak masalah kalau salah (dan
  bahkan untuk itu pun sebaiknya, kalau ada `_ts` yang sepadan,
  ditampilkan dari `_ts` juga biar konsisten — lihat rekomendasi
  lengkap di §5.9e poin 2).
- **Klaim lisan Guru soal logic yang "sudah jalan" WAJIB tetap dicek
  ke kode, bukan diterima mentah** (§5.10, 31 Agt 2026) — Guru
  menyatakan kunci grouping klaster sudah ikut `size`, ternyata
  setelah `grep` ke kode live TIDAK. Bukan berarti curiga ke Guru,
  tapi karena ingatan siapapun (termasuk pembuat sistemnya sendiri)
  soal detail kode bisa meleset dari implementasi sungguhan — pola
  yang SAMA dengan aturan §2 poin 4 (jangan tebak, cek kode), cuma
  arahnya sekarang: jangan juga terima "sudah begini" tanpa cek,
  walau yang bilang adalah Guru sendiri.
- **Dokumen SPEK (wireframe/SERAH-TERIMA) juga bisa BASI, bukan cuma
  klaim lisan** (§5.11, 31 Agt 2026) — spek modul Bahan eksplisit
  bilang koleksi `persiapan_komponen` "sudah ada di repo" sebagai
  sumber data, padahal koleksi itu SUDAH ditinggalkan Guru sendiri 2
  hari sebelumnya (29 Agt 2026, §5.10 area). Kemungkinan besar spek
  itu ditulis SEBELUM koreksi arsitektur itu terjadi, lalu tidak ikut
  diperbarui. **Pelajaran**: dokumen manapun (termasuk yang ditulis
  Guru sendiri sebagai spesifikasi resmi) tetap WAJIB disilangkan ke
  kode live sebelum dipakai sebagai dasar keputusan skema — "wireframe
  = acuan struktur bukan kode" (aturan resmi paket handoff) ternyata
  juga berlaku ke bagian Database-nya, bukan cuma bagian visual.
- **Keputusan menu kompleks/ambigu WAJIB langsung diinterupsi ke Guru
  saat itu juga, bukan ditebak-lalu-tanya-belakangan** (kesepakatan
  BARU, 31 Agt 2026, dicatat di `PEDOMAN-GAYA-KERJA.md`) — dipicu oleh
  konflik arsitektur wireframe "Perlu Disiapkan" (§5.10) vs modul yang
  sudah aktif, lalu diterapkan LAGI di §5.11 (konflik `persiapan_
  komponen`). Bedanya dengan sebelumnya: dulu pola kerjanya "coba
  jalan dulu, tanya kalau ketemu masalah"; sekarang begitu Claude
  MENILAI SENDIRI suatu keputusan menu kompleks/ambigu — TANPA
  menunggu Guru bilang duluan "ini kompleks" — WAJIB langsung berhenti
  & tanya (AskUserQuestion/chat) SEBELUM menulis kode apapun terkait
  keputusan itu. **Catatan tambahan §5.11**: kalau pertanyaan teknis
  (nama field, istilah database) terasa sulit dijawab Guru, WAJIB
  disederhanakan ke bahasa operasional/bisnis dulu (bukan diulang
  dengan istilah yang sama) — Guru sempat minta ini eksplisit
  ("pertanyaan yg bisa dijawab murid") di tengah sesi. **Pengecualian
  PENTING (§5.11d, 1 Sep 2026)**: aturan interupsi ini berlaku untuk
  keputusan yang Claude NILAI SENDIRI kompleks/ambigu — BUKAN untuk
  instruksi Guru yang sudah eksplisit & tidak ambigu (seperti "kerjain
  sekaligus 3 modul ini, gabung dalam 1 zip"), walau instruksi itu
  menyimpang dari aturan/konvensi yang sudah ada. Dalam kasus itu,
  Guru SUDAH membuat keputusannya secara sadar — mengonfirmasi ulang
  lewat AskUserQuestion justru berlebihan, bukan kehati-hatian.
- **Sed/derivasi mekanis (cp + blanket string-replace) BISA salah
  rename referensi SILANG-POS di dalam file yang diturunkan** (§5.11d,
  1 Sep 2026) — menurunkan Webbing/Finishing dari Sewing lewat `cp` +
  `sed 's/Acc Sewing/Acc Webbing/g'` itu efisien, TAPI blanket-replace
  ini juga ikut mengubah string LABEL POS LAIN yang kebetulan disebut
  di dalam file yang sama (mis. seed data `master_tlc` yang menyebut
  SEMUA 3 pos termasuk `'Pos Acc Sewing'` yang seharusnya TETAP,
  bukan ikut ke-rename). **Pola aman**: SETIAP kali pakai derivasi
  mekanis lintas-file yang salah satunya menyebut identitas file lain,
  WAJIB `grep` verifikasi manual setelah tiap sed pass sebelum lanjut
  edit berikutnya — jangan cuma percaya `node --check` (itu cuma cek
  sintaks, bukan cek makna/isi string).

## 7. Yang PALING PENTING diverifikasi sesi berikutnya

1. **§5.11d (modul baru sekaligus Acc Sewing/Webbing/Finishing) BELUM
   dikonfirmasi sama sekali** — ini ronde PALING BARU (1 Sep 2026).
   Tanya Guru: (a) sudah extract zip & di-push ke repo?, (b) rules
   Firestore modul Bahan (§5.11, blocker BERSAMA karena koleksi
   dipakai bareng) sudah di-Publish?, (c) begitu ada SPK Grouping
   jalur Sewing/Webbing/Finishing pertama dibuat, MINTA tes penuh
   ujung-ke-ujung (lihat daftar cek di §5.11d bagian "BELUM
   DIVERIFIKASI") sebelum menganggap modul ini stabil.
2. **§5.11b (tab Selesai Bahan) & §5.11 (modul baru Persiapan Produksi
   > Bahan) BELUM dikonfirmasi sama sekali**. Tanya Guru: (a) sudah
   di-copy ke repo & di-push?, (b) Rules Firestore 4 koleksi baru + 2
   counter SUDAH ditempel & di-Publish di Firebase Console? (blocker
   keras, tanpa ini SEMUA 4 pos — Bahan + 3 Acc — GAGAL total), (c)
   begitu ada SPK Grouping jalur Bahan pertama dibuat, MINTA tes penuh
   ujung-ke-ujung (lihat daftar cek di §5.11 bagian "BELUM
   DIVERIFIKASI") sebelum menganggap modul ini stabil.
3. **§5.10 (rebuild total "Perlu Disiapkan" dari wireframe handoff)
   BELUM dikonfirmasi sama sekali**. Tanya Guru apakah sudah di-copy ke
   repo & di-push, lalu MINTA tes penuh ujung-ke-ujung (lihat daftar
   cek di §5.10 bagian "BELUM DIVERIFIKASI") sebelum menganggap fitur
   ini stabil.
4. **§5.9d/§5.9e (rename brand, tinggi header, fix bug Quote timezone
   Asia/Jakarta, "Perlu Tindakan" 2 grup) BELUM dikonfirmasi sama
   sekali**. Tanya Guru apakah sudah di-copy ke repo & di-push, lalu
   MINTA tes: (a) kartu Quote muncul (test di SIANG hari juga, bukan
   cuma malam/dini hari — biar yakin bukan cuma "kebetulan pas jam
   yang benar"), (b) nama "Zevanic Core Optima" 1 baris rapi, (c)
   tinggi header pas, (d) "Perlu Tindakan Anda" kelihatan 2 grup jelas.
5. **Tanya Guru soal celah kecil di §5.9e poin 2** (field teks jam
   admin di Antrean Absensi/Riwayat All Absensi masih dari jam device,
   bisa menyesatkan walau status tetap benar) — apakah mau diperbaiki
   sekarang (ganti sumbernya jadi dari `_ts`) atau ditunda. Ini
   menyentuh jalur tulis Absensi produksi, jangan diubah tanpa
   persetujuan eksplisit karena dipakai ~500 karyawan tiap hari.
6. **§5.9/§5.9b/§5.9c** — sudah dikonfirmasi live via screenshot
   sebelumnya, tapi verifikasi FUNGSIONAL penuh (lonceng notifikasi,
   angka KPI/Pipeline benar, pencarian global) masih belum ada
   konfirmasi tertulis eksplisit dari Guru.
7. **Publish Firestore Rules fitur Pesanan** (`transaksi_kasir`,
   `pengaturan_id_transaksi_kasir`) di Firebase Console — masih belum
   dikonfirmasi selesai (lihat §5.7).
8. **Cek Arsip §12** untuk alur Registrasi/Login yang BENAR (bukan
   §3.5 yang sudah superseded).
9. Banyak fitur di §5.2/§5.4 berlabel "BELUM DITES" — jangan asumsikan
   stabil tanpa tanya konfirmasi testing terbaru ke Guru.
10. Kalau Guru mau lanjut redesain desktop ke layar LAIN (Kasir, dst)
    setelah Beranda dikonfirmasi jalan — itu sesi terpisah, belum mulai.
11. **Kalau ada laporan bug "tanggal meleset 1 hari" di modul LAIN**
    (bukan Quote) — cek dulu apakah modul itu masih pakai
    `toISOString().split('T')[0]` (lihat daftar di §6/§5.9d poin 2),
    kelas bug yang sama bisa terulang.
12. **Kalau Payroll/Slip Gaji mulai dibangun** — WAJIB pastikan hitung
    jam kerja/gaji dari field `_ts` (server), BUKAN field teks
    `waktu_masuk`/`waktu_keluar` (device) — lihat §5.9e poin 2 & §6.
13. **Modul "Scan Sampai" (divisi penerima) MASIH belum dibangun sama
    sekali** — sekarang 4 pos (Bahan + Acc Sewing/Webbing/Finishing)
    SAMA-SAMA punya tab Selesai yang akan tampil kosong terus tanpa
    ini. Bahas dengan Guru siapa yang bangun/pakai modul ini & di mana
    rumahnya — belum pernah eksplisit ditanyakan.
14. **Vendor** (jalur ke-5 di Persiapan Produksi V2) masih generik lewat
    `JalurTahapManager` lama — BELUM ada rencana/wireframe buat modul
    khusus Vendor sejauh yang diketahui, beda dari 4 pos lain yang
    sudah semua diganti total.

---

*File ini TIDAK mencakup detail teknis penuh (field-per-field,
kode-per-kode) untuk topik di atas — itu semua ada lengkap di
`STATUS-PROYEK-ARSIP.md`, cari pakai nomor section (§) yang dirujuk
di atas.*
