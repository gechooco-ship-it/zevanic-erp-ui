# Peta Dampak — Rekonstruksi Besar (Pesanan, Zevanic House, Persiapan Produksi, Proses Produksi)

> Dibuat 5 Sep 2026, atas permintaan Guru: *"kita mulai koding saya akan
> rekonstruksi besar2n dari mulai pesanan, zevanic house, persiapan produksi
> dan tambahan proses produksi... semua dirombak melalu wireframe claude
> design logika, alur, database, menu akan terdampak."* Guru memilih
> **"Petakan dampak dulu"** sebelum koding — dokumen ini isinya itu.
>
> Sumber: 20 berkas di `Mockup/handoff/` (dibaca penuh) + `PETA-DATABASE.md`,
> `PETA-MENU.md` (dibaca penuh) + **verifikasi langsung ke kode live**
> (`git clone` repo, commit terakhir **2 Sep 2026**) — bukan cuma dari teks
> spek wireframe, sesuai kebiasaan proyek ini (spek bisa basi dari kode).

---

## 0. Ringkasan eksekutif

Paket wireframe ini menyentuh **4 area top-level** + 1 area pendukung:

| Area | Sifat | Skala |
|---|---|---|
| **Pesanan dan Transaksi** | Rework — nambah piutang/pelanggan ke fitur yang sudah ada (kasir, dsb) | Sedang |
| **Zevanic House** | Rework — Master Pelanggan baru, Master Suplayer diperluas total | Sedang-besar |
| **Persiapan Produksi** | Rework sebagian (Masalah **rebuild total**), pos baru (Persiapan Belanja) | Besar |
| **Proses Produksi** | **BARU SELURUHNYA** — 5 pos (Cutting, Serie, Sewing, Finishing, Gudang Barang Jadi) | Sangat besar |
| Stok & Pembelian / Scan & Cetak | Rework kecil — beberapa fungsi dipindah lokasi menu | Kecil |

**Temuan paling penting** (dari verifikasi kode, bukan dari teks wireframe):

1. **Proses Produksi mengisi placeholder yang sudah lama menunggu.** Kartu
   "Pipeline Produksi" di Beranda desktop (`vue-home-desktop.js`) sudah ada
   sejak 30 Agt 2026 sebagai **placeholder UI-only "Segera Hadir"** untuk
   jalur Cutting/Serie/Sewing/Finishing — sengaja tanpa skema data (keputusan
   eksplisit Guru saat itu). Paket wireframe ini persis yang dibutuhkan untuk
   mengaktifkannya.
2. **Ada writer yang selama ini hilang, dan Cutting-lah jawabannya.**
   `spk_track.bahan_rincian[].sampai_pada` (dan padanannya di
   `sewing_rincian[]`/`webbing_rincian[]`/`finishing_rincian[]`) **belum
   punya penulis di manapun** — didokumentasikan eksplisit di
   `PETA-DATABASE.md` sebagai gap yang disengaja ditunda. Modul **Cutting ›
   Perlu Di Proses (1.1) "Scan Sampai"** adalah penulis itu. Begitu Cutting
   selesai, tab **Selesai** di Bahan/Acc Sewing/Acc Webbing/Acc Finishing
   (yang sekarang "sengaja kosong terus") akan **mulai terisi data** — ini
   perlu di-regression-test ke 4 modul lama itu juga, bukan cuma modul baru.
3. **Persiapan Masalah bukan penambahan — itu rebuild total.** Kode live
   sekarang (`js/vue-persiapan-masalah.js`, 197 baris) cuma daftar datar
   status `menunggu`/`sudah_dipesan`. Wireframe minta **7 child-menu**
   (Perlu Diajukan → Menunggu Setuju → … → Selesai) dengan alur approval
   Owner dan integrasi ke Persiapan Belanja. Efeknya sama besar dengan
   rebuild Bahan/Acc kemarin.
4. **Master Suplayer juga rebuild, bukan tambahan field kecil.** Sekarang
   cuma tabel generik `MasterDataTabelManager` (field: nama, keterangan,
   kontak). Wireframe minta 3 sub-halaman penuh (5.1 Entry+List, 5.2 Alias+
   MOQ, 5.3 Petakan Order) plus 4 field baru (bank, nama_rek, no_rek, no_wa).
5. **`firestore.rules` akan jadi bottleneck berulang.** `transaksi_kasir`
   dan `pengaturan_id_transaksi_kasir` (fitur Pesanan, 30 Agt) **masih belum
   dipublish** ke Firebase Console sampai sekarang. Paket ini menambah
   **12+ koleksi baru** (lihat §2) — kalau pola yang sama berulang (kode
   selesai, rules menyusul telat), modul baru akan terus tertahan di
   "kode selesai, belum bisa ditulis". Rekomendasi: siapkan draft rules
   BERSAMAAN dengan tiap modul, bukan di akhir.

---

## 1. Status live sekarang (dikonfirmasi ke kode, bukan ke ingatan)

| Modul | Status live (commit 2 Sep 2026) | Catatan |
|---|---|---|
| Persiapan Produksi › Perlu Disiapkan | ✅ Aktif, sudah dipakai | Wireframe barunya kemungkinan cuma penyempurnaan kecil (klaster, panel grouping) — **belum dibandingkan detail** |
| Persiapan Produksi › Bahan | ⚠️ Kode selesai & dikirim, **belum di-push Guru, belum diuji** | `js/vue-persiapan-bahan.js` ADA di repo (sudah ter-push ternyata — cek ulang saat mulai kerja apakah statusnya sudah berubah jadi "aktif") |
| Persiapan Produksi › Acc Sewing/Webbing/Finishing | idem Bahan | 3 file ada di repo |
| Persiapan Produksi › Vendor | ✅ Aktif, tapi **generik** (`JalurTahapManager`) | Wireframe **belum digambar** untuk pos ini — lihat §5 |
| Persiapan Produksi › Masalah | ✅ Aktif TAPI **versi sangat sederhana** (1 daftar status) | Wireframe minta 7 child-menu — **REBUILD TOTAL**, bukan tambahan |
| Persiapan Produksi › Persiapan Belanja | ❌ Belum ada sama sekali | Konsepnya baru; sebagian tumpang tindih "List Order Belanja" yang sudah ada di Stok & Pembelian — lihat §5 |
| Pesanan (semua 4 sub-menu) | ⚠️ Kode selesai, **belum diuji**, `firestore.rules` **belum dipublish** | Piutang/pelanggan di wireframe ini akan ditumpuk DI ATAS kode yang belum pernah jalan sekali pun |
| Zevanic House › Master Suplayer | ✅ Aktif tapi generik (nama/keterangan/kontak saja) | Rebuild ke 5.1-5.3 + 4 field baru |
| Zevanic House › Master Pelanggan | ❌ Belum ada sama sekali (dicek: tidak ada 1 pun referensi `master_pelanggan` di kode) | Koleksi + menu baru total |
| Proses Produksi (semua 5 pos) | ❌ Belum ada sama sekali | Tidak ada file, tidak ada koleksi, tidak ada grup sidebar (`navgrp-prosesproduksi` belum ada) |
| Stok & Pembelian › Alias Pembelian | ✅ Aktif, di lokasi sekarang | Wireframe bilang "DIPINDAH" ke Zevanic House › Master Suplayer 5.2 — struktur data sama, cuma lokasi menu berubah |
| `master_produk.moq_serie` / `.kelipatan_isi_pola` | ❌ Field belum ada | Dicek langsung — tidak ada di `vue-master-produk.js` |
| `master_bahan_aksesoris.panjang_roll` | ✅ **Sudah ada** (ditambahkan 1 Sep 2026 untuk Acc Webbing) | Bisa dipakai ulang oleh Serie kalau perlu basis roll yang sama |

---

## 2. Dampak database — koleksi baru & field baru

### 2.1 Koleksi BARU total (belum ada sama sekali di kode/Firestore)

| Koleksi | Dipakai oleh | Catatan kunci |
|---|---|---|
| `master_pelanggan` | Zevanic House, Pesanan (kasir, piutang) | `saldo_piutang` JANGAN ditulis langsung — lewat fungsi catat pembayaran |
| `piutang_pembayaran` | Pesanan › Transaksi Keuangan | 1 dokumen per PEMBAYARAN, bukan per transaksi. Wewenang: Owner/PIC Owner + PIN |
| `order_belanja_driver` | Persiapan Belanja, Stok & Pembelian › List Order Driver | 1 dokumen = 1 order ke 1 suplayer |
| `pending_driver` | idem | Item yang stoknya habis di suplayer asal, bisa di-assign ulang |
| `cutting_track` | Proses Produksi › Cutting | 1 per SPK Grouping masuk Cutting, status 7 nilai |
| `label_komponen` | Cutting | 1 per label komponen (4×2cm) |
| `pengaturan_id_label_komponen/{yymmdd}` | Cutting | counter harian |
| `separating_batch` | Serie | 1 per batch hasil Generate Separating |
| `pengaturan_id_separating/{yymmdd}` | Serie | counter harian |
| `sewing_track` | Sewing (Proses Produksi) | 1 per batch masuk Sewing |
| `label_pcs` | Sewing → dipakai lintas Finishing/Gudang/Kasir | **Label paling penting di seluruh paket** — 1 label dipakai 3 pemakai (Finishing scan per tahap, Gudang scan masuk, Kasir scan jual) |
| `pengaturan_id_label_pcs/{yymmdd}` | Sewing | counter harian |
| `finishing_track` | Finishing (Proses Produksi) | 1 per pcs, 4 tahap (QC/Steam/Folding/Packing) |
| `opname_produk_jadi` (opsional) | Gudang Barang Jadi › Scan Opname | Log audit opname, bukan wajib di versi awal |

**Catatan desain penting**: Persiapan Produksi (Bahan/Acc) pakai koleksi
terpisah `bagging`/`tugas_kirim` dengan pola "blank-then-scan-to-fill".
Spek Proses Produksi (Cutting/Serie/Sewing/Finishing) menyebut
`kode_bagging[]`/`kode_tugas` sebagai **field langsung di dalam dokumen
track**-nya sendiri, tanpa merinci apakah itu tetap menunjuk ke koleksi
`bagging`/`tugas_kirim` yang sama atau berdiri sendiri. Ini **perlu
diklarifikasi ke Guru sebelum mulai Cutting** — kalau tidak diseragamkan,
"1 modul cetak, banyak pos" (aturan di `PEDOMAN-SERAH-TERIMA.md`) tidak
akan benar-benar tercapai untuk Proses Produksi.

### 2.2 Field BARU di koleksi yang SUDAH ADA

| Koleksi | Field baru | Untuk |
|---|---|---|
| `transaksi_kasir` | `pelanggan_id`, `status_bayar`, `dp_persen`, `total_dibayar`, `sisa_piutang`, `jatuh_tempo` | Pesanan piutang |
| `master_suplayer` | `bank`, `nama_rek`, `no_rek`, `no_wa` | Format order WA driver |
| `alias_pembelian` | `moq`, `moq_satuan`, `lead_time_hari`, `is_default_order` | Persiapan Belanja, Petakan Order |
| `persiapan_masalah` | `tlc_asal`, `sumber_jalur`, `spk_track_id`, `baris_index` | Rebuild modul Masalah |
| `pesanan_pembelian` | `foto_bon`, `order_driver_id` | Bukti bon dari driver |
| `users` | `pin_hash`, `pin_salt` | PIN generik (edit harga, cetak ulang, dst) — **PIN WAJIB unik lintas user**, perlu strategi lookup kalau pakai bcrypt |
| `master_produk` | `moq_serie`, `kelipatan_isi_pola` | Serie |
| `master_bahan_aksesoris` | — (sudah ada `panjang_roll`) | Bisa dipakai ulang |
| `spk_track` (jalur bahan/sewing/webbing/finishing) | **tidak ada field baru**, tapi `..._rincian[].sampai_pada` **akhirnya dapat penulis** | Ditulis oleh Cutting saat "Scan Sampai" (lihat §0 poin 2) |

### 2.3 PIN — catatan keamanan

Spek `SPESIFIKASI-KOLEKSI-BARU.md` minta `pin_hash` di-hash (bcrypt/SHA-256+salt),
**bukan plaintext**. Sistem PIN yang sudah ada sekarang (`cetak_ulang_log.pin_dicatat`,
dipakai modul Bahan/Acc) **eksplisit TIDAK diverifikasi kriptografis** —
cuma dicatat sebagai jejak audit (dikonfirmasi di `PETA-DATABASE.md`). Paket
baru ini (piutang, edit harga, cetak ulang label) mengasumsikan PIN
**benar-benar diverifikasi** lewat fungsi generik `verifikasiPIN(inputPIN)`.
Ini kebutuhan infrastruktur baru — bukan modifikasi kecil — harus dikerjakan
sebelum modul manapun yang bergantung padanya (Persiapan Belanja, Pesanan
piutang, Stok & Pembelian edit harga).

---

## 3. Dampak menu / sidebar

| Perubahan | Detail |
|---|---|
| **Grup sidebar baru**: "Proses Produksi" | Sejajar "Persiapan Produksi", 5 sub-menu: Cutting, Serie, Sewing, Finishing, Gudang Barang Jadi. `navgrp-prosesproduksi` belum ada di `index.html` — perlu dibuat dari nol (pola sama seperti `navgrp-persiapanproduksi`) |
| **Sub-menu baru** di Zevanic House: "Master Pelanggan" | Grup 3, 2 layar (3.1 List, 3.2 Form) |
| **Master Suplayer** diperluas | Dari 1 tabel generik jadi grup 3 sub-halaman (Entry+List, Alias+MOQ, Petakan Order) |
| **Sub-menu baru** di Persiapan Produksi: "Persiapan Belanja" | Grup 8, admin input + driver mobile + riwayat |
| **Persiapan Masalah** — isi menu sama, tapi jadi 7 child-menu (bukan 1 daftar) | Perlu rombak total struktur tab di dalam menu yang sudah ada |
| **Alias Pembelian** pindah dari Stok & Pembelian ke Zevanic House › Master Suplayer 5.2 | Struktur data sama, hanya lokasi UI |
| **List Order Belanja** (Stok & Pembelian) — konsepnya digantikan alur driver dari Persiapan Belanja | Perlu keputusan Guru: deprecated atau tetap paralel (lihat §5) |
| **DAFTAR_MENU** (`vue-config-akses.js`) | Perlu banyak entri `menuId` baru — tiap sub-menu baru di atas butuh 1 entri, plus kategori baru `"Proses Produksi"` masuk ke `KATEGORI_URUTAN` |
| **Beranda desktop** — kartu "Pipeline Produksi" | Placeholder "Segera Hadir" → diaktifkan datanya nyata begitu Proses Produksi jadi (baca `cutting_track`/`separating_batch`/`sewing_track`/`finishing_track`/`label_pcs`) |
| **Pesanan › Daftar Pesanan (3.1)** — kartu "Pipeline Proses Produksi" | Sekarang tampil "—" (modul belum ada) — otomatis terisi begitu Proses Produksi jadi, TANPA perlu ubah kode `vue-pesanan.js` (asalkan field yang dibaca cocok) |

---

## 4. Dampak alur/logika per area

### 4.1 Pesanan dan Transaksi
- Kasir **wajib** pilih pelanggan sebelum checkout (sekarang opsional) —
  perlu koleksi `master_pelanggan` siap dulu.
- Metode bayar bertambah: Tempo, DP, Cicilan (sekarang cuma Tunai/Transfer/
  QRIS/Lainnya).
- Piutang jadi first-class: `status_bayar` tri/multi-state, dicatat via
  `piutang_pembayaran`, hanya Owner/PIC Owner + PIN.
- Daftar Pesanan (3.1) dapat ringkasan menyeluruh + kartu per pelanggan +
  pipeline (bagian Persiapan sudah bisa jalan sekarang; bagian Proses
  Produksi nunggu modul baru).

### 4.2 Zevanic House
- Master Pelanggan: CRUD baru penuh, dipakai lintas modul (kasir, piutang).
- Master Suplayer: dari generik jadi CRUD lengkap + alias + MOQ + petakan
  order otomatis (`is_default_order`).
- Tidak ada perubahan pada Master Bahan/Master Produk selain field kecil.

### 4.3 Persiapan Produksi
- **Perlu Disiapkan**: kemungkinan penyempurnaan kecil (klaster per nama+
  ukuran+versi pola, panel grouping) — **perlu dibandingkan detail vs kode
  live sebelum diasumsikan "tidak berubah"**, karena wireframe menjelaskan
  perilaku yang cukup rinci (mis. penomoran harian 3 digit, kotak "akan
  masuk ke — otomatis") yang belum tentu 100% sama dengan implementasi
  31 Agt 2026.
- **Bahan / Acc Sewing / Acc Webbing / Acc Finishing**: kode sudah ada,
  **belum diuji** — sebelum menyentuh apapun di sini untuk paket baru ini,
  modul-modul ini harus dites dulu (lihat urutan di §6).
- **Vendor**: wireframe belum digambar. Spec eksplisit bilang "belum
  diputuskan" apakah dibuatkan wireframe khusus atau tetap generik.
- **Masalah**: rebuild total dari 1 daftar jadi 7 child-menu dengan alur
  approval Owner (swipe di mobile) dan qty beli kelipatan MOQ.
- **Persiapan Belanja** (baru): admin input nota → cek pengajuan dari
  Masalah → ACC Owner → generate order per suplayer ke HP driver → driver
  beli (share WA + upload bon) → masuk ke Stok & Pembelian sebagai nota.

### 4.4 Proses Produksi (baru seluruhnya)
Alur fisik: **Cutting → Serie → Sewing → Serie → Finishing → Serie →
Gudang Barang Jadi**. Serie adalah **hub wajib** — tidak ada jalur
langsung antar divisi manapun (aturan lintas modul, ditegaskan di
`PEDOMAN-SERAH-TERIMA.md` poin 11).

- **Cutting**: terima kiriman (scan sampai — **menutup Persiapan Bahan**),
  gelar kain, cetak label komponen, potong, kirim ke Serie.
- **Serie**: hub distribusi 11 tab — generate separating (gabung SPK beda
  yang bahan+warna+size sama), kirim/terima ke-dari Sewing dan Finishing,
  kirim ke Gudang. Alokasi PO FIFO terjadi di titik masuk Gudang, bukan
  di Serie.
- **Sewing**: jahit jadi produk jadi, cetak **label pcs** (dipakai 3
  tempat: Finishing, Gudang, Kasir — ini titik pertemuan paling kritis
  seluruh paket).
- **Finishing**: QC → Steam → Folding → Packing, 4 operator beda, tanpa
  cetak label baru (pakai label pcs dari Sewing). QC gagal → Persiapan
  Masalah → rework via Serie ke Sewing.
- **Gudang Barang Jadi**: scan masuk per pcs, stok **derived** dari
  `label_pcs.status` (bukan field tersendiri) — pola pertama di sistem
  ini yang pakai derived-stock, bukan `stok_akhir` yang ditulis langsung.
  Titik keluar: kasir scan QR label pcs.

### 4.5 Stok & Pembelian / Scan & Cetak
- Perubahan lokasi menu saja untuk Alias Pembelian (lihat §3).
- Scan & Cetak jadi tempat setting cetak terpusat ("1 modul cetak, banyak
  pos") — kalau setting diubah di sini, semua pos yang pakai jenis cetak
  itu ikut berubah. Ini butuh 1 lapisan konfigurasi baru yang belum ada
  sekarang (Scan Opname/Cetak Label Produk saat ini berdiri sendiri per
  modul, belum ada 1 config bersama).

---

## 5. Konflik & keputusan yang perlu Guru sebelum koding jalan

Diurutkan dari yang paling menghambat:

1. **List Order Belanja (Stok & Pembelian) vs Persiapan Belanja (baru)** —
   dua konsep yang tumpang tindih (sama-sama "estimasi belanja"). Wireframe
   bilang yang lama "DIPINDAH", tapi tidak jelas apakah List Order Belanja
   yang sekarang dihapus, dijadikan read-only, atau tetap jalan paralel
   untuk kasus yang tidak lewat driver.
2. **Vendor** — tetap generik atau tunggu wireframe baru? Kalau paket
   Proses Produksi selesai duluan, Vendor jadi satu-satunya jalur yang
   masih terasa "kuno" dibanding pos lain.
3. **Pola `bagging`/`tugas_kirim`** — apakah Proses Produksi memakai
   koleksi yang sama dengan Persiapan Produksi (konsisten "1 modul cetak")
   atau berdiri sendiri per pos (field inline di `cutting_track`/
   `sewing_track`/dst, seperti tertulis literal di spec)?
4. **Firestore rules** — siapa yang menyiapkan draft rules per koleksi
   baru, dan kapan? (Preseden: `transaksi_kasir` sampai sekarang belum
   dipublish, 6 hari sejak kode selesai.)
5. Semua poin "Yang Belum Diputuskan" di tiap `SERAH-TERIMA.md` (daftar
   lengkap di §7) — belum ada satupun yang dijawab Guru secara eksplisit.

---

## 6. Urutan pengerjaan yang disarankan

Menggabungkan urutan resmi di `PEDOMAN-SERAH-TERIMA.md` dengan temuan
dependency dari verifikasi kode:

| # | Langkah | Alasan |
|---|---|---|
| 1 | **Push & uji** Bahan/Acc Sewing/Webbing/Finishing yang sudah "kode selesai" | Prasyarat murni — tidak ada alasan menunda, dan Cutting nanti akan menulis ke field-field modul ini (`sampai_pada`) jadi harus sudah stabil duluan |
| 2 | Publish `firestore.rules` yang tertunda (`transaksi_kasir`, 6 koleksi Bahan/Acc) | Blocker keras yang sudah ada sebelum paket baru ini pun |
| 3 | Infrastruktur PIN sungguhan (`verifikasiPIN`, `pin_hash`) | Dipakai banyak modul baru (Persiapan Belanja, Pesanan piutang, Stok edit harga) — kerjakan sekali, pakai ulang |
| 4 | Master Pelanggan + Master Suplayer (rebuild) | Data dasar yang dibutuhkan Pesanan piutang & Persiapan Belanja |
| 5 | **Cutting** | Membuka `sampai_pada` untuk 4 modul lama — prioritas tinggi supaya tab Selesai yang lama tidak lagi "kosong terus" |
| 6 | **Serie** | Hub — semua pos lain bergantung padanya |
| 7 | **Sewing** (Proses Produksi) | Sumber `label_pcs`, dipakai Finishing+Gudang+Kasir |
| 8 | **Finishing** | Bergantung pada label pcs dari Sewing |
| 9 | **Gudang Barang Jadi** | Titik akhir, baru bisa diuji penuh setelah 5-8 selesai |
| 10 | **Masalah** (rebuild) | Bisa paralel dengan 5-9, tidak saling bergantung langsung |
| 11 | **Persiapan Belanja** | Butuh Masalah (poin 10) sudah jadi dulu (sumber pengajuan) |
| 12 | Pesanan — fitur piutang | Butuh Master Pelanggan (poin 4) |
| 13 | Vendor | Setelah keputusan §5 poin 2 diambil |

Setiap langkah **tetap 1 modul 1 sesi chat**, sesuai aturan
`PEDOMAN-SERAH-TERIMA.md` — dokumen ini hanya peta urutan, bukan izin
mengerjakan beberapa modul sekaligus.

---

## 7. Daftar lengkap "Yang Belum Diputuskan" (dari 20 berkas serah terima)

| Modul | Pertanyaan |
|---|---|
| Lintas modul | Roll webbing terpakai sebagian — jadi stok sisa kode sendiri atau dibebankan penuh ke SPK? |
| Lintas modul | "Menunggu cetakan" (Acc Finishing) — alur sendiri ke vendor sablon, atau tetap lewat Persiapan Masalah? |
| Lintas modul | Satu anak SPK boleh dipegang 2 operator (dibagi)? |
| Lintas modul | Ambang "tertahan" per pos & per shift — nilainya belum ditetapkan (sementara 6 jam dipakai seragam) |
| Lintas modul | Perpindahan tugas saat ganti shift — sudah disepakati lewat scan, tapi layarnya belum digambar |
| Perlu Disiapkan | Grouping yang sudah dibuat — masuk tab Selesai sebagai riwayat atau hilang total? |
| Perlu Disiapkan | Aturan pembatalan grouping kalau Owner salah gabung |
| Perlu Disiapkan | Satu SPK boleh ikut 2 grouping (qty sebagian)? |
| Bahan/Acc Sewing/Webbing/Finishing | Tab Selesai sebagai riwayat — apa saja disimpan, berapa lama |
| Bahan/Acc Sewing/Webbing/Finishing | Layar Scan Sampai divisi penerima — **sekarang terjawab oleh Cutting**, tapi perlu konfirmasi field yang ditulis persis cocok |
| Acc Sewing | Komponen kecil (D-ring, cord lock) — dihitung ketat per pcs atau per kantong dgn toleransi? |
| Acc Webbing | Roll terpakai sebagian — sama seperti poin lintas modul di atas |
| Acc Finishing | Kekurangan hangtag 1 warna — menahan seluruh SPK atau cuma baris warna itu? |
| Masalah | Kumulatif lintas grouping — dihitung live atau di-cache? |
| Masalah | Batas waktu pengajuan sebelum auto-eskalasi |
| Persiapan Belanja | Format WA order — bisa diedit admin? |
| Persiapan Belanja | Driver bisa tambah item di luar order (order tambahan)? |
| Persiapan Belanja | Batas waktu ACC sebelum auto-cancel |
| Vendor | Wireframe khusus vs tetap generik |
| Vendor | Vendor punya akses sistem sendiri atau hanya lewat admin? |
| Pesanan | Retur/pembatalan pesanan — belum dirancang |
| Pesanan | Diskon per item atau per transaksi — belum ada field |
| Pesanan | Format cetak struk — thermal 58/80mm atau A4? |
| Pesanan | Cicilan — ada denda keterlambatan? |
| Zevanic House | Import/export Excel List Bahan & List Produk — tombol ada, format belum |
| Zevanic House | Foto produk — ukuran maks, kompresi, path Storage |
| Zevanic House | HPP — di-cache sebagai field atau selalu dihitung live dari BOM? |
| Zevanic House | Master Pelanggan — tipe (retail/reseller/grosir) beda limit piutang? |
| Stok & Pembelian | Format cetak nota — thermal atau A4? |
| Stok & Pembelian | Nota dari driver bisa diedit admin sebelum finalisasi? |
| Stok & Pembelian | Kartu Stok — perlu export Excel? |
| Scan & Cetak | Wireframe Scan Opname & Scan Persiapan belum digambar |
| Scan & Cetak | Format label produk (ukuran, isi, QR) |
| Scan & Cetak | Scan Opname bisa partial (scan sebagian, simpan, lanjut besok)? |
| Cutting | Tab OUTSOURCE — alur maju-mundur vendor belum diputuskan |
| Cutting | Sablon sebagai tujuan — outsource atau sub-menu sendiri? (diparkir) |
| Serie | Sablon — diparkir (sama seperti Cutting) |
| Serie | Batch separating bisa dibatalkan setelah digenerate? |

---

## 8. Referensi

- 20 berkas `Mockup/handoff/` (dibaca penuh 5 Sep 2026)
- `PETA-DATABASE.md`, `PETA-MENU.md`, `PEDOMAN-GAYA-KERJA.md` (dibaca
  penuh sesi ini)
- Verifikasi kode live: `git clone gechooco-ship-it/zevanic-erp-ui`,
  commit terakhir **2 Sep 2026** ("uppp")
- `STATUS-PROYEK.md` §5.9 (Pipeline Produksi placeholder), §5.10-§5.11d
  (histori rebuild Persiapan Produksi V2)

**Status dokumen ini**: draf untuk direview Guru. Belum ada kode yang
ditulis berdasarkan peta ini — menunggu keputusan §5 dan urutan di §6
dikonfirmasi sebelum modul pertama (disarankan: push+uji Bahan/Acc yang
tertunda) dimulai.
