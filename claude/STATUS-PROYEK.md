# STATUS PROYEK (RINGKAS) — Zevanic/Gechoo ERP

> **Terakhir diperbarui: 7 September 2026 (malam), §5.15.** Fitur Pesanan
> REKONSTRUKSI BESAR dari handoff "Pesanan dan Transaksi": piutang
> (Tempo/DP/Cicilan) + koleksi `piutang_pembayaran` BARU **SUDAH DITULIS**
> (lompat duluan dari urutan §6 RENCANA-REKONSTRUKSI-2026-09.md atas
> permintaan eksplisit Guru — bukan kesalahan urutan, CATATAN penting:
> langkah 5-14/Scan generik-Persiapan-Proses Produksi TETAP belum
> disentuh). **BELUM DITEST BROWSER/FIRESTORE SAMA SEKALI** — lihat §5.15
> & §7 poin 0. Rules `piutang_pembayaran` **BELUM di-Publish**, blocker
> keras. Persiapan Produksi > Bahan + Acc Sewing/Webbing/Finishing
> **SUDAH push+diuji Guru, semua jalan** (bukan lagi "0 data live").
> Master Suplayer rebuild **SUDAH push+diuji Guru, semua jalan**. Master
> Pelanggan (modul baru total) **SELESAI PENUH**: rules di-Publish,
> sudah di-push GitHub, sudah dites di browser. Redesain Beranda Desktop
> selesai beberapa ronde revisi, dikonfirmasi live via screenshot Guru.
> Semua koleksi (termasuk `master_pelanggan`, `master_tlc`, `bagging`,
> `tugas_kirim`, `spk_track`, `transaksi_kasir`) sekarang dikonfirmasi
> ADA di `firestore.rules` — lihat `FIRESTORE-RULES-SNAPSHOT.md`.
> Rencana besar berikutnya (modul Scan generik, lalu sisa Persiapan
> Produksi, baru Proses Produksi) ada di `RENCANA-REKONSTRUKSI-2026-09.md`
> §6 — urutannya DIGESER 7 Sep 2026, Cutting BUKAN lagi prioritas
> berikutnya. Detail penuh tiap fitur: `STATUS-PROYEK-ARSIP.md`.

---

## 1. Apa proyek ini

Sistem ERP internal **Zevanic/Gechoo** — sudah berkembang JAUH dari
cuma "absensi karyawan" jadi mencakup **konveksi penuh**: produksi
(BOM, SPK, jalur produksi per-pos), stok bahan, pembelian, Kasir
(Pesanan), dan Master Pelanggan. Dipakai skala **~500 karyawan**.

- **Frontend**: Vue 3 CDN, tanpa build step.
- **Backend**: Firebase (Firestore, Auth, Storage, Cloud Functions di
  repo terpisah `zevanic-cloud-function` — TIDAK bisa diakses sesi
  Claude manapun).
- **Hosting**: `gechoo.online` lewat GitHub Pages, repo
  `gechooco-ship-it/zevanic-erp-ui`.
- **Alur kerja file**: kode dikirim ke folder `Code` (device bridge),
  byte-size diverifikasi cocok, Guru yang `git push` ke GitHub —
  **deploy BUKAN otomatis**, selalu tanya/cek status push sebelum
  asumsi fitur "sudah live".
- **Akses baca kode terkini**: `git clone` via Bash **TERBUKTI PALING
  ANDAL** (WebFetch ke github.com pernah gagal tergantung sesi) — lihat
  `PETA-INFRASTRUKTUR.md`. WAJIB dipakai buat verifikasi klaim
  "sudah/belum dikerjakan", bukan tebak dari dokumentasi manapun
  (termasuk dokumentasi ini sendiri — riwayat pernah kejadian
  dokumentasi basi, lihat §6).

## 2. Cara kerja sebelum mengerjakan apapun

1. Baca file ini dulu, lalu `STATUS-PROYEK-ARSIP.md` kalau butuh detail
   proses spesifik suatu fitur.
2. Baca `PRINSIP-HEMAT.md` + `PEDOMAN-GAYA-KERJA.md` — WAJIB diikuti,
   termasuk aturan **"GANTI bagian lama, JANGAN TUMPUK"** saat menulis
   ke file RINGKAS ini (celah yang sempat kejadian: nulis blok "BARU"/
   "BARU LAGI" baru tanpa menghapus yang lama — lihat contoh nyata &
   perbaikannya di `PEDOMAN-GAYA-KERJA.md`).
3. **Keputusan menu kompleks/ambigu** (bukan cuma soal teknis) — kalau
   Claude MENILAI SENDIRI ambigu, WAJIB langsung interupsi Guru saat
   itu juga (AskUserQuestion/chat), JANGAN tebak-jalan-dulu-tanya-
   belakangan. Kalau pertanyaannya teknis (nama field dsb), sederhanakan
   ke bahasa operasional dulu. **Pengecualian**: instruksi Guru yang
   SUDAH eksplisit & tidak ambigu (walau menyimpang dari konvensi lama)
   tidak perlu dikonfirmasi ulang — itu keputusan sadar Guru.
4. **JANGAN PERCAYA begitu saja** — baik klaim lisan Guru soal "logic
   ini sudah begini", dokumen spek/wireframe manapun, MAUPUN dokumentasi
   internal sendiri (`PETA-DATABASE.md` dkk pernah salah tulis skema) —
   semua WAJIB disilangkan ke kode live (`git clone`/`grep`) sebelum
   jadi dasar keputusan, terutama soal skema data.

## 3. Cara deploy

| Jenis file | Cara deploy |
|---|---|
| `.js`, `.html`, `.css`, `.md` | Kirim ke folder `Code` (device bridge) → Guru copy ke repo kerja → `git push` |
| `firestore.rules` | Firebase Console → Firestore Database → Rules → Publish |
| `storage.rules` | Firebase Console → Storage → Rules → Publish |

## 4. Alur Registrasi → Login

Sudah beberapa kali direvisi — versi TERBARU: password dibuat KARYAWAN
SENDIRI saat registrasi (bukan lagi NIK yang di-generate Admin, dan
BUKAN pula OTP-dulu-baru-Admin-buat-akun versi paling awal). Detail
lengkap: `STATUS-PROYEK-ARSIP.md` §12.

## 5. Modul-modul besar — status TERKINI per topik

### 5.1 Absensi lewat QR (HP Kiosk gudang)
Kiosk device khusus di gudang, scan QR + PIN buat Clock In/Out. FIXED
& dikonfirmasi Guru. Detail: Arsip §18-§19.x.

### 5.2 Zevanic House — modul Konveksi
Master Bahan & Aksesoris, Stock & Pembelian, Rak Penyimpanan (+Lot/
Roll FIFO sebagai SARAN default, bisa manual/scan), Kartu Stok,
Persiapan Masalah, Config Data Komponen, Import Excel massal. Banyak
bagian berlabel **BELUM DITES SAMA SEKALI** (terutama fitur fisik:
scan kamera, cetak label) — jangan asumsi stabil tanpa konfirmasi
testing terbaru Guru. Detail: Arsip §20-§27, §33-§38.

### 5.3 Master Produk — Bill of Material (BOM)
`vue-master-produk.js` — Entry Produk lengkap (BOM Jasa/Pola/Aksesoris/
Vendor), SKU otomatis, Import/Export Excel, Config Jenis Produk. **BARU
(§5.13)**: 2 field tambahan `moq_serie`/`kelipatan_isi_pola` (data-layer
saja, modul konsumen "Proses Produksi > Serie" BELUM dibangun — JANGAN
disamakan dengan `master_produk.kelipatan` lama yang sudah dipakai Order
SPK/Kasir, itu field BEDA & tetap dipakai apa adanya). Detail: Arsip
§28.x, §30-§32, §38, §45, §5.13.

### 5.4 Persiapan Produksi V2 — pipeline SPK (5 jalur: Bahan/Sewing/Webbing/Finishing/Vendor)
**"Perlu Disiapkan"** (klaster & SPK Grouping) di-REBUILD TOTAL dari
wireframe handoff baru (31 Agt) — mendukung partial qty (1 SPK bisa
ikut >1 grouping), kunci klaster diperbaiki (dulu bug, tidak ikut
`size`). **4 modul child BARU** (Bahan, Acc Sewing, Acc Webbing, Acc
Finishing) — pola sama (scan QR operator, stok berkurang atomik di
scan entry, cetak label, PIN admin buat cetak ulang), beda kunci
kartu (Bahan = per jenis bahan gabungan lintas-dokumen; 3 Acc = per
SPK Grouping, tidak digabung). **Vendor** (jalur ke-5) masih generik
`JalurTahapManager` lama, belum ada modul khusus.

**Diperbarui 7 Sep 2026(konfirmasi Guru)**: Bahan + Acc Sewing/Webbing/
Finishing **SUDAH di-push GitHub DAN sudah diuji Guru, semua jalan** —
status "0 data live"/"belum diuji sama sekali" di atas SUDAH TIDAK
BERLAKU, digantikan status ini. Testing ujung-ke-ujung detail
(checklist per-field) belum ada laporan tertulis terpisah dari Guru,
tapi confirmed berjalan secara fungsional.

**Dibandingkan ulang ke wireframe "Perlu Disiapkan" (7 Sep 2026)**:
kode live (`vue-persiapan-produksi-v2.js`) SESUAI secara fungsional —
klaster (kunci nama+ukuran+versi pola), generate kode SPK harian
3-digit, panel grouping, distribusi otomatis ke 4 pos, split-qty 1 SPK
ikut >1 grouping (`qty_tergrouping`/`grouping_ids`), grouping selesai
hilang total dari antrean (bukan riwayat) — semua SESUAI keputusan
§5.10. Beda nama field vs dokumen wireframe (`kode_spk` bukan `kode`,
`kunci_pola` string bukan `kunci_gabung` map, `breakdown[]` bukan
`anggota[]`) — ini KOSMETIK/historis (kode ditulis sebelum wireframe
field-spec final), BUKAN bug, tidak perlu diubah kecuali ada alasan
baru.

⚠️ **Blocker fungsional masih aktif**: tab **"Selesai"** di tiap modul
child (Bahan/Acc Sewing/Acc Webbing/Acc Finishing) masih akan tampil
KOSONG TERUS — field `sampai_pada` belum punya penulis. **Diperbarui**:
penulisnya BUKAN cuma Cutting — direncanakan sebagai 1 modul Scan
generik dipakai semua pos, lihat `RENCANA-REKONSTRUKSI-2026-09.md` §9.3
dan §6 langkah 5 (harus selesai sebelum Cutting mulai).

Detail lengkap tiap modul + checklist testing: Arsip §5.10, §5.11,
§5.11b, §5.11d.

### 5.5 Redesign Mobile "Gechoo Mobile Organic"
Gaya visual mobile baru, diterapkan ke 4 modul antrean + Home Mobile
(grid menu tarik otomatis dari `DAFTAR_MENU`). Detail: Arsip §44.1-§44.9.

### 5.6 Role: PIC Owner
Kelola keuangan lintas gudang per jenis usaha. Detail: Arsip §29.

### 5.7 Menu "Pesanan" — Kasir & pipeline
`vue-pesanan.js` — **LIVE & dikonfirmasi** untuk alur dasar (Tunai/
Transfer/QRIS/Lainnya, tanpa pelanggan). Rules `transaksi_kasir`/
`pengaturan_id_transaksi_kasir` dikonfirmasi ADA di snapshot Rules 5
Sep. **Dicek ulang ke kode 7 Sep 2026**: fitur piutang (Tempo/DP/
Cicilan, `master_pelanggan` terhubung ke kasir) **BELUM ADA SAMA
SEKALI** di kode live — `METODE_PEMBAYARAN_OPSI` masih cuma
`['Tunai','Transfer','QRIS','Lainnya']`, `nama_pelanggan` masih teks
bebas (bukan pilih dari `master_pelanggan`). Ini BUKAN bug, ini memang
langkah yang belum dikerjakan (lihat `RENCANA-REKONSTRUKSI-2026-09.md`
§6 langkah 15). **DIPERBARUI 7 Sep 2026 malam (§5.15)**: modul ini
sudah DIREKONSTRUKSI TOTAL — status di paragraf ini sekarang HISTORIS
(kondisi SEBELUM §5.15), lihat §5.15 untuk kondisi TERKINI (piutang
sudah ditulis, tapi belum ditest). Detail: Arsip §45, §5.7.

### 5.8-5.9 Redesain Desktop — Beranda
Dashboard desktop penuh: sidebar ("Zevanic Core Optima", ikon tiap
grup), topbar (52px, pencarian global Ctrl+K — REAL, baca dari DOM
sidebar), 4 KPI (`getCountFromServer`), Pipeline Persiapan (data real
dari `spk_track`/`order_spk`), Pipeline Produksi (placeholder, belum
ada skema), Kartu Absen (real, read-only, reuse logic mobile), Quote
(bug timezone UTC-vs-WIB SUDAH diperbaiki, sekarang eksplisit
`Asia/Jakarta`), Aktivitas Terbaru & Pintasan Papan Tik (statis/
ilustratif, BUKAN data live), "Perlu Tindakan Anda" 2 grup (Persiapan
real, Produksi placeholder). **Dikonfirmasi live via screenshot Guru**
untuk sebagian besar; verifikasi FUNGSIONAL penuh (lonceng notifikasi,
angka KPI benar) belum ada konfirmasi tertulis eksplisit.

**Audit keamanan Absensi/Clock In** (dipicu redesain ini): timestamp
Clock In/Out ASLI (`_ts`, `serverTimestamp()`) **AMAN** dari fake jam
device, status Ontime/Terlambat juga aman (dihitung dari `_ts`). Celah
KECIL belum diperbaiki: field TEKS tampilan (`waktu`/`waktu_masuk`,
dari jam device) yang ditampilkan ke admin BISA menyesatkan (badge
status tetap benar, tapi teks jam bisa salah) — dampak saat ini kecil
(belum ada modul Payroll yang membacanya). **WAJIB**: kalau
Payroll/Slip Gaji dibangun nanti, hitung dari `_ts`, BUKAN field teks.

Detail lengkap semua ronde revisi: Arsip §5.9-§5.9e.

### 5.10 Master Suplayer + Config "TLC & Prefix"
`vue-master-suplayer.js` (Entry, Alias & MOQ, Petakan Order) + tab
Config baru "TLC & Prefix" (`master_tlc`, koleksi BARU, skema
`{kode,nama,tipe}`). "Alias Pembelian" lama di Stock & Pembelian
DIHAPUS (digantikan Master Suplayer). Rules `master_tlc` dikonfirmasi
ADA (snapshot 5 Sep). **Diperbarui 7 Sep 2026**: sudah di-push GitHub
DAN sudah diuji Guru, semua jalan (Entry+List, Alias+MOQ, Petakan
Order). Detail: Arsip §5.12.

### 5.11 Prefix Kode SPK — dikonfigurasi
Prefix kode SPK Grouping (dulu hardcode `"SPK"`) sekarang bisa diatur
lewat kartu "Prefix Kode SPK" di tab TLC & Prefix. Tidak perlu rules
baru. Detail: Arsip §5.13.

### 5.12 Master Pelanggan — modul BARU TOTAL
`vue-master-pelanggan.js` — CRUD via popup, field `nama/telepon/alamat/
email/tipe/limit_piutang/saldo_piutang/catatan`. `saldo_piutang` SENGAJA
read-only (selalu Rp 0 sampai fitur piutang/langkah 15 dibangun — INI
BENAR, BUKAN BUG). Bagian dari rencana besar `RENCANA-REKONSTRUKSI-
2026-09.md` (langkah 4).

**Rules `master_pelanggan` sudah di-Publish, sudah di-push ke GitHub,
dan SUDAH DITES di browser (7 Sep 2026) — Tambah/Edit/Hapus, dedupe
nama, badge tipe SEMUA jalan.** Modul ini SELESAI PENUH. **DIPERBARUI
7 Sep 2026 malam (§5.15)**: `saldo_piutang` di atas SEKARANG MULAI
BENAR-BENAR BERUBAH (bukan lagi selalu Rp 0) sejak modul Pesanan
direkonstruksi — 2 titik tulis resmi: checkout Kasir (menambah) dan
`catatPembayaranSusulan()` (mengurangi), lihat §5.15. Modul Master
Pelanggan ITU SENDIRI tidak berubah kodenya. Detail: Arsip §5.14.

### 5.13 Zevanic House — 4 gap wireframe diimplementasi (7 Sep 2026, kode belum ditest browser)
Dari audit penuh `wireframe.dc.html` Zevanic House (RENCANA-REKONSTRUKSI-
2026-09.md §9.2). Guru sudah putuskan semua lewat AskUserQuestion,
KODE SUDAH DITULIS + `node --check` lolos + sudah dikirim ke
`Code\` di device — **BELUM ADA testing browser sama sekali**, jangan
anggap stabil sebelum dikonfirmasi Guru.

1. **List Bahan & Aksesoris (1.2.1/1.2.2)**: `vue-bahan-aksesoris.js` —
   GANTI TOTAL dari kartu (redesain 28 Agt) BALIK ke tabel grid 7 kolom
   + filter tab (Semua/Bahan/Aksesoris/Perlu dilengkapi, badge
   `getCountFromServer`) + baris expand (roll/lot aktif + 3 harga
   terakhir dari `riwayat_harga_pembelian` + tombol Edit/Cetak Label/
   Lihat Kartu Stok) + "Muat 20 Lagi". Field baru `lengkap` (boolean,
   dihitung ulang tiap simpan) buat tab "Perlu dilengkapi".
2. **Margin Modal → PERSEN** (bukan lagi Rupiah flat): `harga_pemakaian
   = harga_modal * (1 + margin_modal/100)`. Diterapkan di 3 titik
   `vue-bahan-aksesoris.js` (Entry/Edit/Import Excel) **DAN**
   `vue-stock-pembelian.js` `perbaruiHargaMasterDariRiwayat()` (fungsi
   auto-jalan tiap Nota Order Belanja difinalkan — SEMPAT tertinggal
   pakai formula lama, SUDAH ikut diperbaiki di sesi yang sama, jangan
   sampai ke-deploy salah satu tanpa yang lain). **Data lama** yang
   `margin_modal`-nya masih nominal Rupiah akan terbaca SALAH sebagai
   persen — TIDAK ADA migrasi otomatis, Guru WAJIB cek manual data
   yang sudah ada sebelum 7 Sep 2026.
3. **HPP per produk (2.3, fitur BARU TOTAL)**: tab ke-3 "HPP" di Master
   Produk (`vue-master-produk.js`, `MasterProdukHppManager`, menu-id
   baru `master_produk_hpp`, default akses Owner-only). Dihitung LIVE
   dari BOM (bahan kain + aksesoris × `harga_pemakaian` + jasa Cutting/
   Serie dari `bom_pola` + jasa lain dari `bom_jasa`) — **TIDAK
   di-cache**, sesuai keputusan Guru. Field baru `master_produk.
   biaya_tambahan_hpp` ([{nama,jumlah}]) — satu-satunya yang benar-benar
   ditulis lewat tombol Simpan.
4. **Riwayat PIN (Config 4.1, fitur BARU TOTAL)**: tab baru di Config
   (`AppConfigRiwayatPin`, `vue-config.js`), baca koleksi BARU
   `riwayat_pin` (field belum dikonfirmasi — tidak ada modul manapun
   yang menulis ke sini, sengaja dibangun kosong menunggu modul Scan &
   PIN generik/langkah 5). **PENTING — belum bisa dipakai sampai
   Firebase Console Rules ditambah match block `riwayat_pin`** (koleksi
   ini SAMA SEKALI TIDAK ADA di `FIRESTORE-RULES-SNAPSHOT.md` 5 Sep
   2026 — tanpa match block, Firestore default-deny, tab akan tampil
   error permission-denied, BUKAN kosong seperti seharusnya). Saran
   rule (pola sama seperti `cetak_ulang_log`, log yang immutable):
   `allow read: if isAdminLevel(); allow create: if login(); allow
   update, delete: if false;` — Guru WAJIB publish ini dulu di Firebase
   Console sebelum tab ini kelihatan benar.

### 5.14 Stok dan Pembelian — rebuild 4 sub-tab wireframe diimplementasi (7 Sep 2026, kode belum ditest browser)
Lanjutan `/design-terapkan-handoff` untuk modul Stok dan Pembelian (folder
handoff `04 - Stok dan Pembelian`). Guru sudah putuskan 5 keputusan lewat
AskUserQuestion (2 ronde), KODE SUDAH DITULIS + `node --check` lolos + sudah
dikirim ke `Code\` di device (12 file, verifikasi byte-per-byte cocok) —
**BELUM ADA testing browser/Firestore sama sekali**, dan modul ini menyentuh
UANG (harga pembelian) dan STOK — WAJIB ditest ekstra hati-hati sebelum
dipercaya.

1. **Daftar Nota (sub-tab 1, GANTI TOTAL dari "Order Belanja")**:
   `vue-stock-pembelian.js`, `DaftarNotaScreen` — layout ala kasir
   (katalog+keranjang), entry keyboard-first persis SERAH-TERIMA §3.2
   (ketik → Enter pilih/tambah qty kalau dobel → Tab → qty popup → Enter
   → Tab → satuan popup → Enter → balik ke search; ngetik apa saja di
   tengah alur membatalkan & mulai ulang search). Fitur "List Order
   Belanja" (estimasi lama) **DIHAPUS TOTAL** sesuai keputusan Guru
   "Hapus sekarang" (scope-nya pindah ke Persiapan Produksi/Persiapan
   Belanja — BUKAN tanggung jawab modul ini lagi). Field baru
   `pesanan_pembelian.foto_bon` (upload Storage, pola sama seperti foto
   di `vue-master-produk.js`) dan `order_driver_id` (SELALU `null`
   untuk sekarang — belum ada modul driver yang menulis field ini, chip
   "Sumber: Manual" tampil selalu, chip "Dari Driver" baru muncul kalau
   modul driver sudah dibangun).
2. **Finalisasi nota PAKAI PIN**: kalau user yang login sudah
   Owner-tier, langsung finalisasi tanpa PIN; kalau bukan, popup PIN
   generik muncul (`PopupPin`), dicocokkan via `cariUserByPin()`.
   Mekanisme PIN lengkap di poin 4.
3. **Riwayat Harga Pembelian (sub-tab 2)**:
   `RiwayatHargaPembelianManager` — banner alert baru untuk item yang
   harganya NAIK dari nota final (field baru di `master_bahan_aksesoris`:
   `harga_perlu_konfirmasi` boolean + `harga_pending` object
   `{harga_baru, harga_lama, tanggal, no_pembelian, suplayer,
   satuan_asal, sumber}`). Tombol "Terapkan & buka blokir" HANYA jalan
   dengan PIN Owner-tier — update `harga_modal`/`harga_pembelian`/
   `harga_pemakaian` (formula persen, bukan Rupiah flat) lalu hapus
   flag. **Simplifikasi yang perlu diketahui**: untuk item
   `konversi_bertingkat` (rantai satuan berjenjang), tombol Terapkan
   cuma update `harga_modal` di tier terakhir, TIDAK menghitung ulang
   seluruh rantai konversi seperti `perbaruiHargaMasterDariRiwayat()`
   saat nota difinalkan — beda dari alur normal nota, sengaja
   disederhanakan, WAJIB diverifikasi kalau ada item jenis ini yang
   harganya naik.
4. **PIN mechanism BARU (dipakai poin 2+3), REUSE infrastruktur yang
   SUDAH ADA**: proyek ini ternyata sudah punya `users.{email}.pin_hash`
   (SHA-256 dari `pin + '|' + email`, dibangun 22 Agt 2026 untuk
   absensi Kiosk) — dipakai lagi di sini, BUKAN bikin field PIN baru.
   `vue-stock-pembelian.js` sekarang punya salinan ke-4 dari fungsi
   `hashPin()` (proyek ini memang tidak pakai shared-utility import,
   tiap file yang butuh fungsi ini bikin salinan sendiri — sama seperti
   pola yang sudah ada di `vue-account-profile.js` dan `vue-camera.js`).
   `tierOwnerKeAtas()` mengecek role `owner`/`superuser` atau (`pic` +
   `profil_akses==='pic_owner'`). `cariUserByPin()` query `users` where
   role in `[owner,superuser,pic,admin]`, cocokkan hash PIN input ke
   tiap kandidat, kunci 3x salah (`MAKS_PERCOBAAN_PIN`, sama seperti
   pola lockout Kiosk). **Keterbatasan yang WAJIB Guru tahu**: user
   yang belum pernah set `pin_hash` (belum pernah pakai absensi Kiosk
   PIN) TIDAK BISA dipakai untuk finalisasi/Terapkan di modul ini
   sampai PIN-nya diisi.
5. **Checkout guard BARU di Pesanan/Kasir**: `vue-pesanan.js`, fungsi
   `bahanTerblokirDiKeranjang()` dipanggil di awal `buatOrder()` — cek
   apakah ada bahan di keranjang (dari BOM produk yang sudah ada di
   memori) yang `harga_perlu_konfirmasi == true`, kalau ada, checkout
   DIBLOK dengan alert nama item yang kena. **Sengaja fail OPEN**: kalau
   query pengecekan itu sendiri error, checkout TETAP JALAN (bukan
   diblok) — supaya bug di guard ini tidak sampai menghentikan seluruh
   operasional Kasir. Trade-off yang disengaja, WAJIB dipantau kalau
   tiba-tiba banyak nota lolos padahal ada harga pending.
6. **Kartu Stok (sub-tab 3) — GANTI TOTAL jadi READ-ONLY**:
   `vue-kartu-stok.js` dipangkas drastis (890+ baris dihapus) — form
   "Catat Pemakaian" (alokasi FIFO manual, popup 3-opsi kekurangan lot,
   tombol Scan QR) DIHAPUS TOTAL dari sini. Digabung jadi SATU layar
   (dulu 2 layar Ringkasan→Detail) dengan pencarian/ganti-item, badge
   "Lot Aktif" baru (reuse `ambilLotAktif()` tanpa ubah).
   **Penyimpangan dari rencana awal Guru, sudah dikonfirmasi ulang**:
   rencana semula "pindah ke Scan & Cetak" ternyata SALAH PREMIS —
   `vue-scan-persiapan.js` memang sudah ada dan sudah dipakai Guru,
   TAPI cuma menangani kasus SEDERHANA (SPK tunggal, 1 roll), BELUM
   menangani alokasi FIFO multi-roll maupun alur "ajukan kekurangan ke
   `persiapan_masalah`". Ditemukan saat pengerjaan, dilaporkan ke Guru,
   Guru pilih "pindahkan scope ke Scan Persiapan" — jadi KEDUA gap itu
   (poin 7 di bawah) dipindah ke `vue-scan-persiapan.js` DULU, baru
   Kartu Stok jadi read-only murni. Excel export masih belum diputuskan
   (SERAH-TERIMA §7), belum dikerjakan.
7. **Scan Persiapan diperluas** (`vue-scan-persiapan.js`, prasyarat
   poin 6): fungsi baru `bangunAlokasiFifoScan()` — ambil dari lot yang
   di-scan DULU, sisanya ditarik dari lot aktif lain (FIFO asli, sudah
   dikonfirmasi urutannya benar via `ambilLotAktif()`) untuk bahan yang
   sama. Popup 3-opsi kekurangan (kurangi jumlah / proses sebagian &
   ajukan sisa ke `persiapan_masalah` / tunggu dulu) dipindah persis
   dari Kartu Stok lama, skema tulis `persiapan_masalah` SAMA. Reuse
   `catatPemakaianDariAlokasi()` dari `vue-stock-pembelian.js` TANPA
   DIUBAH.
8. **Rak Penyimpanan (sub-tab 4) — PINDAH dari "Data Bahan &
   Aksesoris" ke sini + migrasi model data**: `vue-rak-penyimpanan.js`
   ditulis ulang total. Model LAMA = 3 dropdown master-list terpisah
   (`kode_rak`/`baris_rak`/`kolom_rak`, digabung dash "A-2-3"). Model
   BARU (ikut wireframe) = 3 kolom isian bebas (field baru `rak` +
   `baris_rak`/`kolom_rak` jadi teks bebas) digabung TANPA pemisah jadi
   `kode_rak` (contoh "E11"). Field `rak_label` (alias) dipertahankan
   supaya dropdown "Pilih Rak" di `vue-bahan-aksesoris.js` tetap jalan
   tanpa perlu diubah. `volume_rak` TETAP cm³ mentah di database (cuma
   dikonversi ke m³ pas ditampilkan), karena `vue-bahan-aksesoris.js`
   baca field ini persis dan hardcode teks "cm³". **Dokumen rak LAMA
   (belum punya field `rak`) TIDAK di-migrasi otomatis** — sandbox ini
   tidak punya akses Firestore live, jadi Guru WAJIB rapikan data rak
   lama secara manual (sementara tetap tampil lewat fallback ke
   `rak_label` lama). List baru berbasis per-item (1 baris per barang
   yang sudah ditaruh di rak) + bar kapasitas — **formula bar kapasitas
   ini BARU dan BELUM DIKONFIRMASI Guru**: per-item terpakai =
   `stok_akhir × volume_barang`, per-rak terpakai = jumlah semua item
   di rak itu, sisa = `volume_rak − terpakai`, warna <50% hijau/50-79%
   kuning/≥80% merah.

**File yang berubah (12 total)**: `index.html`, `dashboard.js`,
`vue-config-akses.js`, `vue-header-mobile.js`, `vue-kartu-stok.js`,
`vue-pesanan.js`, `vue-rak-penyimpanan.js`, `vue-scan-persiapan.js`,
`vue-stock-pembelian.js` — plus 3 file bawaan dari §5.13
(`vue-bahan-aksesoris.js`, `vue-config.js`, `vue-master-produk.js`)
dikirim ulang untuk mastiin fitur §5.13 tidak ikut hilang (sudah
di-grep ulang, aman).

### 5.15 Pesanan dan Transaksi — rekonstruksi besar (7 Sep 2026, kode belum ditest browser, LONCAT dari urutan rencana)
`/design-terapkan-handoff` untuk modul Pesanan dan Transaksi (folder
handoff `01 - Pesanan dan Transaksi`), atas permintaan eksplisit Guru
lewat invocation langsung — **ini LONCAT dari urutan
`RENCANA-REKONSTRUKSI-2026-09.md` §6** (piutang/Pesanan tadinya
dijadwalkan step 15, setelah Scan generik + sisa Persiapan Produksi +
Proses Produksi yang belum selesai). Bukan kesalahan, Guru yang minta,
tapi WAJIB dicatat sebagai penyimpangan urutan. Guru sudah putuskan 7
keputusan lewat AskUserQuestion (2 ronde + 2 follow-up klarifikasi),
KODE SUDAH DITULIS + `node --check` lolos — **BELUM ADA testing
browser/Firestore sama sekali, DAN ada blocker Firestore rules yang
belum dipublish (lihat poin 7)** — jangan dianggap siap pakai.

Seluruh menu "Pesanan" dirombak dari 5 sub-menu lama (Kasir, Menunggu
Proses [CRUD manual], Persiapan, Produksi, Pengiriman) jadi 4 sub-menu
baru: Penjualan Kasir, Menunggu Proses (sekarang murni antrian QO,
CRUD manual dihapus), Daftar Pesanan (baru, gabungan ringkasan
pipeline), Transaksi Keuangan (baru, piutang & kas).

1. **Penjualan Kasir (1.1/1.2)**: `PesananKasirManager` ditulis ulang
   jadi alur 2 langkah (keranjang → pembayaran). Field pelanggan baru
   wajib dipilih (`ambilDaftarPelanggan()`, disalin dari
   `vue-master-pelanggan.js`). Status bayar cuma 3 opsi saat checkout:
   Lunas/DP/Tempo (Cicilan BUKAN opsi checkout, lihat poin 6). DP
   dihitung otomatis jadi persen dari nominal (keputusan Guru D7).
   Struk cetak masih MVP `window.print()` browser biasa, BUKAN
   integrasi printer thermal POS sungguhan (disederhanakan, ditandai
   di komentar kode).
2. **Checkout menulis ke 3 tempat**: `transaksi_kasir` (field baru
   `pelanggan_id`, `status_bayar`, `dp_persen`, `total_dibayar`,
   `sisa_piutang`, `jatuh_tempo`), `order_spk` (field baru
   `pelanggan_id`/`pelanggan_nama`/`transaksi_kasir_id`/
   `no_transaksi`/`status_bayar` — snapshot, ditambahkan supaya
   Daftar Pesanan & Transaksi Keuangan tidak perlu N+1 lookup, bukan
   dari spek asli tapi diperlukan secara teknis), dan koleksi BARU
   `piutang_pembayaran/{autoId}` (1 dokumen per pembayaran, sesuai
   `SPESIFIKASI-KOLEKSI-BARU.md` §2) untuk catatan pembayaran awal.
   `master_pelanggan.saldo_piutang` ditambah kalau ada sisa piutang
   baru dari transaksi ini.
3. **Menunggu Proses (2.1/2.2) — GANTI TOTAL jadi murni antrian QO**:
   `PesananMenungguManager` ditulis ulang total, form CRUD manual SPK
   dihapus. Order yang statusnya `Aktif` dan belum diproses
   (`qo_diproses !== true`, field BARU) dikelompokkan per transaksi.
   Algoritma opsi QO (`opsiQO`) = 4 kelipatan pertama yang >= RO,
   keputusan Guru D5 (wireframe punya contoh data yang saling
   kontradiksi, ini interpretasi yang dipilih Guru karena cocok
   dengan 2 dari 3 baris contoh). Akses digerbang ganda: `cekIzinMenu`
   DAN `tierOwnerKeAtas()` — kalau bukan Owner-tier, pesan akses
   ditolak eksplisit merujuk `PEDOMAN-SERAH-TERIMA.md` aturan #8.
   Tombol "Proses N orderan" SELALU minta `PopupPin` walau user yang
   login sudah Owner (keputusan Guru D4, beda dari pola
   `vue-stock-pembelian.js` yang skip PIN untuk Owner login — di sini
   sengaja TIDAK disamakan). Aksi proses HANYA update `qty_order` +
   `qo_diproses`/`qo_diproses_pada`/`qo_oleh` di `order_spk` — **TIDAK
   PERNAH menyentuh `status_grouping`**.
4. **Temuan arsitektur penting saat pengerjaan (WAJIB diketahui kalau
   ada yang menyentuh modul ini lagi)**: jawaban awal Guru bilang QO
   "tulis ke `order_spk.status_grouping`". Sebelum menulis kode itu,
   dibaca dulu `js/vue-persiapan-produksi-v2.js` (cross-check kode
   live) — ternyata `status_grouping` (nilai `''`/`'sebagian'`/
   `'tergrouping'`, plus `qty_tergrouping`/`grouping_ids`/
   `id_spk_grouping`/`kode_spk_grouping`) adalah field yang SUDAH
   PUNYA pemilik tunggal: layar "Perlu Disiapkan" di modul Persiapan
   Produksi. Temuan ini dilaporkan balik ke Guru (bukan ditebak
   sendiri), Guru re-konfirmasi: cukup update `qty_order` saja untuk
   QO. Field BARU `qo_diproses`/`qo_diproses_pada`/`qo_oleh`
   ditambahkan supaya antrian "Menunggu Proses" tetap bisa tahu order
   mana yang sudah diproses TANPA melanggar single-source-of-truth
   `status_grouping` milik Persiapan Produksi.
5. **Daftar Pesanan (3.1/3.2/3.2.1) — BARU, gabungan 3 menu ringkasan
   lama**: `PesananDaftarManager` menggantikan
   `RingkasanSpkTrackManager` + 3 wrapper (Persiapan/Produksi/
   Pengiriman lama). Baca semua `order_spk`+`transaksi_kasir`
   (difilter `pelanggan_id` ada isinya)+`spk_track` sekaligus, susun
   6-kotak ringkasan total + per-kartu-pelanggan, popup rincian anak
   SPK (3.2) dan popup timeline riwayat scan (3.2.1, dari
   `spk_track.riwayat_scan`). **Penyederhanaan yang WAJIB diketahui
   (T3)**: begitu SPK masuk grouping di Persiapan Produksi, grouping
   itu bisa berisi campuran SPK dari BEBERAPA pelanggan sekaligus —
   jadi atribusi per-pelanggan yang presisi cuma bisa dihitung untuk
   status "Perlu Disiapkan" (sebelum grouping). Untuk 5 kolom jalur
   sesudahnya, angka yang ditampilkan adalah hitungan "tersentuh
   grouping ini" berlabel perkiraan, BUKAN hitungan per-pelanggan
   yang eksak — trade-off yang disengaja karena data sumbernya memang
   sudah campur, bukan bug.
6. **Transaksi Keuangan (4.1/4.1.1/4.2.1/4.2.2) — BARU**:
   `PesananTransaksiManager`, 3 tab: Kas Besar (agregasi per
   pelanggan: nilai/sudah dibayar/sisa/status jatuh tempo), Rincian
   Transaksi (list flat `piutang_pembayaran`, read-only, total per
   metode), Rincian Piutang (`transaksi_kasir` yang `sisa_piutang>0`,
   diurutkan jatuh tempo). Fungsi baru `catatPembayaranSusulan()` —
   SATU-SATUNYA titik yang boleh mengurangi
   `master_pelanggan.saldo_piutang` (dipakai pembayaran susulan
   pasca-checkout, BUKAN pembayaran awal saat checkout). Tombol "Catat
   pembayaran" cuma KELIHATAN untuk Owner-tier, tapi tetap WAJIB lewat
   `PopupPin` saat diklik (sama seperti poin 3 — PIN selalu wajib,
   bukan cuma untuk yang levelnya kurang).
7. **Cicilan = status turunan, BUKAN opsi checkout** (keputusan Guru
   D6, diklarifikasi 2 tahap karena jawaban pertama Guru sempat
   ambigu/terpotong): tidak ada jadwal cicilan baru yang dibangun,
   cuma reuse `master_pelanggan.limit_piutang` yang SUDAH ADA ("0 =
   tidak boleh piutang") sebagai plafon tunggal. Checkout **DIBLOKIR
   TOTAL** (bukan sekadar warning) kalau
   `saldo_piutang + sisa_baru > limit_piutang`.
8. **BLOCKER Firestore rules — koleksi `piutang_pembayaran` BELUM
   PUNYA rule sama sekali** (dicek silang ke
   `claude/FIRESTORE-RULES-SNAPSHOT.md` 5 Sep 2026 — tidak ada match
   block untuk koleksi ini). Tanpa rule, semua tulis/baca ke koleksi
   ini akan `permission-denied` di production. **WAJIB dipublish Guru
   di Firebase Console SEBELUM fitur pembayaran/piutang di modul ini
   bisa dipakai sama sekali** — bukan cuma kurang optimal, benar-benar
   tidak akan jalan. Saran rule (pola sama seperti koleksi transaksi
   lain yang append-only dari sisi user biasa):
   `allow read: if isAdminLevel(); allow create: if login(); allow
   update, delete: if isAdminLevel();` (sesuaikan lagi kalau perlu —
   ini draft awal, belum divalidasi Guru).
   Catatan tambahan: klaim `SERAH-TERIMA.md` bahwa rule
   `transaksi_kasir`/`pengaturan_id_transaksi_kasir` "belum
   dipublish" ternyata BASI — rule untuk keduanya SUDAH ADA di
   snapshot 5 Sep. `master_pelanggan` tidak ada di snapshot itu juga,
   tapi banner `STATUS-PROYEK.md` yang lebih baru mengklaim sudah
   dipublish — kesimpulannya dokumen snapshot rules itu sendiri yang
   sudah basi untuk sebagian koleksi, jadi jangan 100% percaya
   snapshot itu untuk koleksi lain juga tanpa cek ulang ke Firebase
   Console langsung kalau ragu.

**File yang berubah (4 total)**: `index.html`, `dashboard.js`,
`vue-config-akses.js`, `vue-pesanan.js`.

**UPDATE (7 Sep 2026 malam)**: blocker Firestore rules poin 7 di atas
SUDAH SELESAI — `piutang_pembayaran` (rule persis usulan di atas) DAN
`riwayat_pin` (ketemu belakangan, lihat §5.13 poin 4) sudah ditambah ke
`firestore.rules` dan **sudah dipublish Guru ke Firebase Console**
(dikonfirmasi langsung: "firestore done upload"). Snapshot terbaru ada
di `claude/FIRESTORE-RULES-SNAPSHOT.md`.

### 5.16 Scan & Cetak — FONDASI dibangun (7 Sep 2026 malam, kode belum ditest browser, BARU TAHAP 1 dari rencana besar)
`/design-terapkan-handoff` untuk modul "05 - Scan dan Cetak", atas
instruksi eksplisit Guru: "kerjakan terapkan dan seluruh turunannya".
Guru mengonfirmasi lewat 3 ronde AskUserQuestion bahwa cakupan
sesungguhnya JAUH lebih besar dari SERAH-TERIMA.md modul ini sendiri
(yang cuma minta 2 sub-menu) — wireframe.dc.html-nya menggambarkan 4
grup (Scan Stok, Scan Persiapan Produksi generik, Cetak, PIN) yang jadi
FONDASI dipakai bersama oleh Persiapan Produksi (refactor) dan 5 modul
Proses Produksi baru total (Cutting, Sewing, Finishing, Serie, Gudang
Barang Jadi) yang JUGA harus dibangun sebagai bagian dari pekerjaan ini
(Serie perlu Sewing+Finishing eksis dulu supaya tabnya tidak kosong
percuma).

**PENTING — INI BARU TAHAP 1 (fondasi + menu), BUKAN seluruh pekerjaan
selesai.** Urutan yang disepakati dengan Guru: Scan+PIN generik (fondasi,
tahap ini) → refactor 4 pos Persiapan Produksi pakai itu → Cutting →
Sewing → Finishing → Serie → Gudang Barang Jadi → Cetak Label Produk +
katalog cetak. 5 modul Proses Produksi & refactor Persiapan Produksi
**BELUM dikerjakan** — menyusul di sesi/commit berikutnya.

1. **File baru `js/vue-scan-cetak.js`** — genuinely diimpor (bukan
   disalin per-file, beda dari konvensi lama proyek ini untuk
   hashPin/PopupPin) — berisi: `PopupPinGenerik` (props
   `konteks`/`rolesDiizinkan`, MENULIS ke `riwayat_pin` di setiap
   percobaan, sukses maupun gagal — koleksi ini dibuat pagi ini §5.13
   tapi belum ada penulisnya sampai sekarang), `ScanGenerik` (kamera+QR
   generik, cuma emit teks hasil scan mentah — TIDAK tahu apa-apa soal
   Firestore/validasi, pemanggil yang urus itu, sesuai prinsip "Scan
   Entry = satu-satunya titik pengurangan stok" yang beda tiap pos),
   `buatQrDataUrl`/`muatJsQr`/`cariKaryawanByQr`/`hashPin`/
   `tierOwnerKeAtas`/`cariUserByPin` (dipindah dari
   `vue-persiapan-produksi-v2.js`/`vue-stock-pembelian.js`, logic TIDAK
   diubah), dan `AppScanCetakRiwayatPin` (Riwayat PIN, DIPINDAH APA
   ADANYA dari `AppConfigRiwayatPin` di `vue-config.js`).
2. **Keputusan implementasi (tidak eksplisit di spek manapun, dibuat
   karena cuma soal bentuk log internal — lihat komentar besar di
   `vue-scan-cetak.js`)**: PIN cocok tapi role di luar
   `rolesDiizinkan` dicatat `berhasil:false` dengan nama PEMILIK PIN
   (bukan disamakan dengan "PIN salah total" yang `nama_pengguna` jadi
   'Tidak dikenali'). Kalau Guru mau bentuk beda, tabel Riwayat PIN
   tinggal disesuaikan (read-only, tidak ada penulis lain bergantung).
3. **Migrasi TIDAK termasuk**: `PopupPin`/`hashPin` versi lama di
   `vue-pesanan.js`/`vue-stock-pembelian.js`/`vue-absensi-qr.js`/
   `vue-account-profile.js`/`vue-camera.js` **BELUM ikut dipindah**
   pakai `PopupPinGenerik` — sengaja, supaya modul yang sudah stabil
   tidak ikut berisiko disentuh di luar cakupan tugas ini. Efeknya:
   Riwayat PIN di menu baru ini untuk sementara CUMA mencatat pemakaian
   PIN dari kode BARU (mulai sesi ini) — pemakaian PIN lama di modul-
   modul itu TIDAK tercatat di sini. Ini gap yang disengaja, bukan bug.
4. **Menu top-level baru "Scan & Cetak"** (sejajar Zevanic House/
   Pesanan/Persiapan Produksi) — 4 sub-tab: Scan Stok (Scan Opname +
   Scan Persiapan, DIPINDAH dari Zevanic House > Scan, logic TIDAK
   berubah), Referensi Scan (katalog statis baca-saja jenis-jenis scan
   per modul, TIDAK ada scan sungguhan di sini), Cetak (indeks label/
   lembar cetak yang sudah ada + baris "Cetak Label Produk" ditandai
   BELUM DIBANGUN), PIN (Riwayat PIN, DIPINDAH dari Zevanic House >
   Config).
5. **Ketemu & diperbaiki 1 bug tersembunyi saat wiring**: gerbang
   visibility sidebar (`window.aturTampilanBerdasarkanRole` di
   `auth.js`) HARUS mendaftarkan tiap tombol menu top-level baru secara
   eksplisit di 2 tempat (array hide default + blok show admin-level) —
   kalau lupa, class `hidden` bawaan index.html tidak pernah dicopot
   dan menunya TIDAK PERNAH muncul untuk role manapun, termasuk Owner
   (bug yang sama persis pernah kejadian di `menu-pesanan`, dicatat di
   §5 poin soal itu). Ketauan sebelum kode diserahkan karena
   cross-check ke `auth.js`, bukan cuma index.html/dashboard.js.
6. **Drive-by fix kecil (di luar cakupan, ketemu pas kerjakan ini)**:
   `tab-pesanan` ternyata sudah lama hilang dari `LABEL_TAB` di
   `js/vue-header-mobile.js` (header mobile nongol kosong pas buka
   menu Pesanan manapun) — sekalian diperbaiki karena trivial & aman.
7. **Firestore**: TIDAK ada rule baru yang perlu ditambah tahap ini —
   `riwayat_pin` sudah punya rule dari §5.13/5.15 (`allow create: if
   login()`), cukup untuk `PopupPinGenerik` menulis.
8. **BELUM ditest browser sama sekali** — `node --check` lolos semua
   file yang diubah, tag HTML seimbang (dicek terprogram), tidak ada id
   duplikat, tapi belum ada 1 klik pun di browser sungguhan. WAJIB
   ditest sebelum dianggap stabil: (a) menu "Scan & Cetak" muncul di
   sidebar untuk role admin-level, (b) Scan Opname/Scan Persiapan masih
   berfungsi persis seperti sebelumnya di lokasi baru, (c) Riwayat PIN
   di lokasi baru masih bisa dibuka (akan tetap kosong sampai ada kode
   baru yang memanggil `PopupPinGenerik`, itu BUKAN bug), (d) Config >
   Riwayat PIN sudah benar-benar hilang (tidak nyangkut di cache
   browser lama).

**File yang berubah/baru (7 total)**: `js/vue-scan-cetak.js` (baru),
`index.html`, `js/dashboard.js`, `js/auth.js`, `js/vue-config.js`,
`js/vue-config-akses.js`, `js/vue-header-mobile.js`.

## 6. Bug besar & pelajaran (kelas bug yang bisa terulang)

- **Inline `style="display:..."` SELALU menang dari class CSS manapun**
  (termasuk `.hidden` custom proyek ini) — jangan campur keduanya di 1
  elemen. Kelas bug SAMA juga muncul di atribut HTML asli `[hidden]`
  vs CSS `{display:flex}` author stylesheet (author SELALU menang dari
  UA stylesheet) — fix: selector lebih spesifik `[hidden]{display:none}`.
- **Ambil-semua-lalu-saring-di-JS jadi mahal di skala besar** (~500
  karyawan = 86rb baca/hari dari pola yang dulu "terasa aman"). Selalu
  pakai `getCountFromServer()`/query bertarget, bukan tarik dokumen
  penuh untuk sekadar hitung/filter.
- **Grup sidebar top-level BARU wajib didaftarkan ke `auth.js`**
  (`aturTampilanBerdasarkanRole()`) — kalau lupa, menu tidak PERNAH
  muncul walau semua kode lain benar. (Menu NESTED di grup yang sudah
  ada TIDAK kena masalah ini.)
- **`toISOString()` = UTC, bukan tanggal lokal** — proyek ini WIB
  (UTC+7), jadi jam 00:00-06:59 WIB dapat tanggal KEMARIN kalau pakai
  `toISOString()`. Pakai `toLocaleDateString('en-CA', {timeZone:
  'Asia/Jakarta'})` untuk tanggal KALENDER (beda dengan timestamp
  presisi tinggi yang MEMANG pantas `serverTimestamp()` penuh). Kelas
  bug sama masih ADA di `vue-kartu-stok.js`/`vue-reimburse.js`/
  `dashboard.js` (nama file CSV) — belum diperbaiki, dampak kecil.
- **Field jam device vs jam server** — APAPUN yang dipakai untuk
  KEPUTUSAN (status, approval, gaji) WAJIB dari `_ts`/`serverTimestamp()`,
  TIDAK PERNAH dari `new Date()` polos.
- **Klaim lisan Guru DAN dokumen spek/wireframe DAN dokumentasi
  internal sendiri — SEMUA bisa basi.** Selalu silangkan ke kode live
  sebelum jadi dasar keputusan skema.
- **Derivasi mekanis (cp+sed) bisa salah-rename referensi silang-pos**
  yang kebetulan disebut di file yang sama — WAJIB `grep` verifikasi
  manual tiap habis sed pass, `node --check` tidak cukup (cuma cek
  sintaks, bukan makna string).
- **Klaim "sudah ada penggantinya di modul lain" WAJIB dicek di level
  FUNGSI, bukan cuma level FILE-ada.** Keputusan awal Guru "pindah ke
  Scan & Cetak" (7 Sep 2026, Kartu Stok) sempat mau dieksekusi berdasar
  premis "file penggantinya sudah ada" — ternyata filenya memang ada
  dan sudah dipakai Guru, TAPI cuma menangani sebagian kasus (kasus
  sederhana 1 roll), bukan seluruh cakupan yang mau dihapus (alokasi
  FIFO multi-roll + alur ajukan kekurangan). Agen yang menemukan ini
  berhenti dan lapor alih-alih diam-diam lanjut atau diam-diam
  memutuskan sendiri — itu yang benar. Kelas bug yang sama juga bisa
  muncul di klaim "koleksi/field ini sudah ditulis modul X" — selalu
  cek FUNGSI yang menulis/membaca, bukan cuma nama modul yang disebut.
- **Jawaban keputusan Guru sendiri bisa berbasis premis teknis yang
  salah — WAJIB dicross-check ke kode live SEBELUM dieksekusi, bukan
  cuma dokumen spek.** Contoh nyata (§5.15, 7 Sep 2026): Guru sempat
  jawab "QO tulis ke `order_spk.status_grouping`" tanpa tahu field itu
  sudah jadi milik penuh mekanisme grouping Persiapan Produksi
  (state-machine dengan field pendamping `qty_tergrouping`/
  `grouping_ids`/dst). Baca kode live LEBIH DULU sebelum menulis kode
  yang menyentuh field bersama, baru kalau ketemu konflik — lapor
  balik ke Guru sebagai temuan teknis, minta re-konfirmasi. Jangan
  langsung eksekusi jawaban Guru mentah-mentah kalau itu menyangkut
  field yang kelihatannya "milik" mekanisme lain.
- **Kalau Guru minta modul dikerjakan di luar urutan
  `RENCANA-REKONSTRUKSI-2026-09.md` yang sudah disepakati, itu SAH
  (Guru berhak ubah prioritas) tapi WAJIB dicatat eksplisit sebagai
  penyimpangan urutan** di STATUS-PROYEK.md — supaya sesi berikutnya
  tidak bingung kenapa langkah yang "belum giliran" tiba-tiba sudah
  ada kodenya (lihat §5.15, piutang Pesanan dikerjakan sebelum Scan
  generik/Persiapan Produksi/Proses Produksi selesai).

## 7. Yang PALING PENTING diverifikasi sesi berikutnya

0a. **BARU (7 Sep 2026) — §5.15 rekonstruksi Pesanan dan Transaksi (4
    sub-menu, TERMASUK PIUTANG) BELUM DITEST BROWSER/FIRESTORE SAMA
    SEKALI, dan modul ini menyentuh UANG (kasir, piutang, pembayaran)**:
    Penjualan Kasir (checkout 2 langkah + guard limit piutang), Menunggu
    Proses (antrian QO murni, PIN selalu wajib), Daftar Pesanan
    (ringkasan pipeline, atribusi per-pelanggan approx setelah
    grouping), Transaksi Keuangan (Kas Besar/Rincian Transaksi/Rincian
    Piutang, `catatPembayaranSusulan()`). **BLOCKER KERAS sebelum modul
    ini bisa dites sama sekali**: Guru WAJIB publish Firestore rule
    untuk koleksi BARU `piutang_pembayaran` dulu (lihat §5.15 poin 8) —
    tanpa ini semua baca/tulis piutang akan `permission-denied`. Setelah
    rule terpasang, test: (a) checkout Lunas/DP/Tempo menulis field baru
    di `transaksi_kasir`+`order_spk` dengan benar, (b) blokir total
    checkout saat `saldo_piutang + sisa_baru > limit_piutang` benar-benar
    memblokir (bukan cuma warning), (c) "Proses massal" QO di Menunggu
    Proses HANYA mengubah `qty_order` dan TIDAK menyentuh
    `status_grouping` (cek Firestore langsung), (d) Catat Pembayaran
    susulan (Transaksi Keuangan) mengurangi `saldo_piutang` dengan benar
    dan status transaksi berubah ke `lunas`/`cicilan` sesuai sisa, (e)
    PopupPin memang selalu muncul (termasuk untuk Owner login) di kedua
    titik ini sesuai keputusan Guru D4.
0. **§5.14 rebuild Stok dan Pembelian (4 sub-tab)
   BELUM DITEST BROWSER/FIRESTORE SAMA SEKALI, dan ini modul UANG+STOK**:
   Daftar Nota (entry keyboard-first + PIN finalisasi), Riwayat Harga
   (alert kenaikan harga + Terapkan PIN Owner), Kartu Stok (read-only),
   Rak Penyimpanan (migrasi model data), checkout guard di Pesanan,
   PIN mechanism baru berbasis `users.pin_hash`. Sebelum dianggap jalan:
   (a) pastikan minimal Owner + 1 user tier lain punya `pin_hash` terisi
   (kalau belum, PIN sama sekali tidak bisa dipakai di modul ini — lihat
   §5.14 poin 4), (b) test alur nota draft→final ujung ke ujung, cek
   `kartu_stok_bahan_aksesoris`/`lot_bahan_aksesoris`/harga master
   ke-update BENAR, (c) test kenaikan harga memang memblokir checkout
   Pesanan dan "Terapkan" memang membuka blokirnya, (d) test FIFO
   multi-roll baru di Scan Persiapan (`bangunAlokasiFifoScan`) dengan
   kasus nyata >1 lot aktif, (e) cek data Rak Penyimpanan LAMA (belum
   punya field `rak`) masih kebaca lewat fallback, JANGAN dianggap hilang
   kalau tampil kosong — cek dulu ke Firestore langsung.
1. **§5.13 4 fitur Zevanic House BELUM DITEST BROWSER SAMA SEKALI**:
   List Bahan grid+expand, margin persen, HPP, Riwayat PIN. Sebelum
   dianggap jalan: (a) Guru WAJIB publish rule Firestore `riwayat_pin`
   dulu (lihat §5.13 poin 4) baru tab itu bisa dites, (b) cek data
   `margin_modal` lama tidak ke-baca salah sebagai persen di List, (c)
   cek Nota Order Belanja baru difinalkan tidak menimpa
   `harga_pemakaian` dengan angka salah, (d) cek HPP menghitung benar
   utk produk yang BOM-nya kompleks (banyak pola/vendor/aksesoris).
2. ~~Semua modul §5.4 (Bahan, Acc Sewing/Webbing/Finishing) — 0 DATA
   LIVE~~ **RESOLVED (7 Sep 2026)** — Guru konfirmasi sudah push+uji,
   semua jalan. Checklist testing detail per-field (Arsip §5.10/§5.11/
   §5.11d) masih belum ada laporan tertulis terpisah, tapi fungsional
   confirmed jalan.
3. **Modul "Scan Sampai" (dan 5 saudaranya) belum dibangun** — bukan
   cuma soal Bahan/Acc, ini dipakai SEMUA 9 pos Persiapan+Proses
   Produksi (lihat `RENCANA-REKONSTRUKSI-2026-09.md` §9.3). Diputuskan
   dibangun sebagai 1 modul generik terpisah, SEBELUM Cutting mulai.
4. **Konfirmasi fungsional Beranda Desktop belum lengkap** — lonceng
   notifikasi, angka KPI/Pipeline benar, pencarian global — sudah
   confirmed LIVE via screenshot tapi belum ada konfirmasi tertulis
   fungsi-per-fungsi dari Guru.
5. ~~Apakah wiring Master Suplayer/TLC/Prefix sudah cukup~~ **Diperbarui
   7 Sep 2026**: Guru bilang BELUM CUKUP, Bahan/Acc masih perlu
   disentuh langsung — kekurangan spesifiknya: ambang "tertahan" per
   pos (§9.1 rencana rekonstruksi) + hal lain yang BELUM dijelaskan
   Guru (masih ditanya, jawaban tertunda — jangan anggap lengkap).
6. Field `tipe` di Master Pelanggan murni informasional (tidak
   pengaruhi `limit_piutang` otomatis) — konfirmasi ini sudah cukup.
7. ~~Pesanan piutang (Tempo/DP/Cicilan) — dicek langsung ke kode (7 Sep
   2026), BELUM ADA SAMA SEKALI, sesuai rencana (langkah 15, belum
   giliran)~~ **DIPERBARUI 7 Sep 2026**: Guru minta dikerjakan sekarang
   juga (loncat urutan, lihat §5.15) — kodenya SUDAH DITULIS, TAPI
   belum ditest sama sekali dan diblokir rule Firestore
   `piutang_pembayaran` yang belum dipublish (lihat poin 0a di atas).
   Langkah 5-14 (Scan generik + sisa Persiapan Produksi + Proses
   Produksi) TETAP belum selesai — urutan rencana untuk sisanya TIDAK
   berubah, cuma langkah 15 ini yang dikerjakan lebih awal atas
   permintaan Guru.
8. Cek `RENCANA-REKONSTRUKSI-2026-09.md` untuk peta lengkap langkah
   rekonstruksi besar yang sedang berjalan — urutan sudah DIGESER 7 Sep
   2026 (Persiapan Produksi lengkap dulu, baru Proses Produksi/Cutting).

---

*File ini TIDAK mencakup detail teknis penuh (field-per-field, kode-
per-kode, proses ronde-demi-ronde) — itu semua ada lengkap di
`STATUS-PROYEK-ARSIP.md`, cari pakai nomor section (§) yang dirujuk
di atas.*
