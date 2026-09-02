# Rencana Desain — Persiapan Produksi V2 (SPK Grouping + 5 Jalur)

Status: **Fase 1 (SPK Grouping) + Fase 2 (jalur Bahan) + Fase 3 (3 jalur
Acc: Sewing/Webbing/Finishing) + Fase 4 (jalur Vendor) — SEMUA 5 jalur
kode sudah ditulis, BELUM diuji manual di browser+Firebase sungguhan.**
Dokumen ini merangkum hasil diskusi 29 Agt 2026 antara Guru dan Claude
soal menu Persiapan Produksi yang baru. Detail lengkap implementasi
Fase 1 ada di `STATUS-PROYEK.md` §44.13, Fase 2 di §44.14, Fase 3 di
§44.19, Fase 4 di §44.20.

## 1. Tiga keputusan yang sudah dikonfirmasi Guru

| # | Pertanyaan | Jawaban Guru |
|---|---|---|
| 1 | Alur baru ini gantikan sistem "Persiapan Produksi" yang sekarang, atau jadi lapisan baru di depannya? | **Ganti total.** Sistem lama (status biner `perlu_disiapkan`/`approved` + `proses`/`selesai`, tanpa grouping) resmi dipensiunkan. |
| 2 | Setelah beberapa Order digabung jadi 1 SPK Grouping, gimana cara tetap tahu qty tiap Order aslinya? | **Simpan breakdown per Order ID** di dalam dokumen SPK Grouping-nya — bukan cuma total qty gabungan. |
| 3 | 5 tahap di tiap jalur (Vendor/Bahan/Acc Sewing/Acc Webbing/Acc Finishing) jalannya gimana untuk 1 SPK Grouping yang sama? | **Paralel independen** — status tiap jalur bisa beda-beda di waktu yang sama untuk SPK Grouping yang sama. |

## 1.5. Temuan penting: sistem lama baru dibangun KEMARIN, belum pernah dites

Dicek ke `STATUS-PROYEK.md` §43 dan file `firestore-index-tambahan-
persiapan-produksi.txt`/`firestore-rules-tambahan-persiapan-
produksi.txt` yang masih ada di repo: menu "Persiapan Produksi" yang
sekarang itu **baru dibangun 28 Agt 2026 — sehari sebelum diskusi ini**,
dan sampai catatan terakhir statusnya **"Belum diuji manual sama
sekali"** karena masih terblokir 2 hal (publish Firestore rules + bikin
2 composite index) yang waktu itu baru dikirim ke Guru, belum
dikonfirmasi selesai.

**Artinya bagus buat kita**: kemungkinan besar **belum ada data live**
sama sekali di `persiapan_produksi`/`persiapan_komponen` (belum pernah
ada SPK yang berhasil di-Approve karena query-nya masih gagal muat).
Jadi keputusan "ganti total" (§1 poin 1) risikonya rendah — **tidak
perlu migrasi data**, tinggal pensiunkan collection lama begitu saja.
Ini juga masuk akal kenapa Guru minta desain baru cuma sehari setelah
versi pertama jadi: kemungkinan pas mau nyoba/mikirin alur operasional
sungguhan, ketauan versi pertama (1 SPK = 1 baris, tanpa grouping/
pipeline kirim-terima/vendor) belum cukup buat kebutuhan riil di
lapangan.

**Yang berarti perlu ikut dibereskan saat replace** (bukan cuma 2
collection Firestore): 5 menu-id di `js/vue-config-akses.js`
(`persiapan_produksi_antrean/bahan/sewing/webbing/finishing`), rules
`firestore.rules` untuk `persiapan_produksi`/`persiapan_komponen`/
`master_tahap_persiapan`, entry sidebar + `petaTabIndukPerGrup`/
`petaMount` di `js/dashboard.js`, dan `LABEL_SUBTAB` di
`js/vue-header-mobile.js` — semua bekas wiring menu lama ini perlu
diganti sesuai struktur menu baru (§6). **SEMUA INI SUDAH DIKERJAKAN**
di Fase 1 (lihat §1.7 & `STATUS-PROYEK.md` §44.13), termasuk
`LABEL_SUBTAB` (`js/vue-header-mobile.js`, header judul mode mobile).

## 1.6. Putaran kedua — klarifikasi dari Guru (29 Agt 2026, siang)

4 pertanyaan di §5 (versi pertama dokumen ini) sudah ditanyakan ke Guru.
Jawabannya membuka detail penting yang MENGOREKSI beberapa asumsi awal
di dokumen ini — dicatat di sini apa adanya, belum semua langsung jadi
keputusan final (ada yang masih perlu contoh angka konkret, lihat §5
baru di bawah):

**A. Kunci grouping BUKAN cuma SKU sama** — kata Guru persis: *"nama
produk sama walau beda asal bahan, sama (panjang pola dan isi pola)
bisa digrouping, sehingga bahan tersebut diproses oleh cutting bisa
digelar kain bersamaan. gelar kain bersamaan > pola kain > cutting
bersamaan > dikirim."* Jadi kunci sebenarnya: **`nama_produk` +
`panjang pola` + `isi pola` sama** — BUKAN warna/asal bahan yang harus
sama. Dua field itu match PERSIS dengan field yang sudah ada di
`master_produk.bom_pola`: `panjang` (panjang pola) dan `isi_pola_pcs`
(isi pola) — dikonfirmasi lewat riset kode sebelumnya, bukan kebetulan.
Alasan bisnisnya: pola dengan panjang & isi yang sama bisa "digelar"
dalam 1 hamparan kain sekaligus dipotong bersamaan di cutting, biar
efisien — walau warna kain beda-beda. **CATATAN PENTING** (ditemukan
saat implementasi Fase 1, lihat §1.7): `order_spk.nama_produk` itu
STRING GABUNGAN "Nama Warna Size" — nama DASAR yang dipakai buat cocok-
kan kunci grouping diambil dari `master_produk.nama` (field terpisah),
via `sku_produk` tiap SPK, BUKAN dari `order_spk.nama_produk` langsung.

**B. Split qty per Order terikat "KPK" isi pola — TERNYATA SUDAH ADA
field & rumusnya, ketemu pas nyari referensi lain.** Kata Guru: *"qty
bisa dipecah dengan syarat kpk dan isi pola."* Awalnya saya kira ini
perlu rumus baru — ternyata field `master_produk.kelipatan` (§42.2,
28 Agt 2026) itu PERSIS rumus ini: `hitungKelipatan()` di
`js/vue-master-produk.js` (baris 212-216) hitung KPK/LCM dari SEMUA
`bom_pola[].isi_pola_pcs` produk itu (fungsi `gcd2`/`lcm2` standar).
Sudah dipakai di Order SPK sebagai "Rekomendasi Kelipatan Order" —
warning kalau `qty_order` bukan kelipatan bulat dari `kelipatan`,
sampai dihitung persis "sisa X pcs berpotensi boros pola". **Field ini
SUDAH ADA & bisa dipakai** untuk split-qty per grouping — **BELUM
diimplementasikan di Fase 1** (Fase 1 baru menggabungkan SELURUH qty
tiap SPK anggota ke 1 grouping, belum ada UI pecah-sebagian qty per
kelipatan) — scope Fase 2 ke atas kalau dibutuhkan.

**C. Jalur Vendor = pekerjaan dekorasi luar (sublim/sablon/bordir,
dll)** — BUKAN `bom_pola.tipe==='vendor'` (potong pola vendor) seperti
dugaan awal saya. Ini berarti field yang sudah ada TIDAK otomatis pas —
`bom_aksesoris` sekarang cuma punya 3 nilai `tahap_proses` (Sewing/
Webbing/Finishing dari `master_tahap_persiapan`), BELUM ada slot buat
"Vendor/Sublim/Sablon/Bordir". Kemungkinan perlu **field/master data
baru** di BOM Aksesoris Master Produk, bukan cuma routing status —
lihat §5.C (MASIH TERBUKA, belum dijawab Guru). Sementara di Fase 1,
jalur Vendor TIDAK terdeteksi otomatis — cuma checkbox manual opsional
di form pembuatan grouping.

**D. SCAN OPERATOR pakai QR PRIBADI tiap akun yang SUDAH ADA** — kata
Guru: *"karena semua akun sudah punya qr masing2 nanti koor akan klik
menu scan operator dan tembak qr di hp karyawan yg terdapat qr."*
Dicek ke kode — INI SUDAH ADA & AKTIF: tab Account Profile
(`js/vue-account-profile.js`, baris ~229-248) generate QR pribadi tiap
akun dari `id_app` (fallback email), dipakai buat absensi fisik — bahkan
caption-nya sudah literally menyebut *"Tunjukkan QR ini saat melakukan
absensi fisik **atau verifikasi proses SPK**"* (baris 599, kelihatannya
sudah disiapkan buat kebutuhan ini dari awal). Mekanisme scan kameranya
(`js/vue-scan-qr.js`, jsQR) SAMA PERSIS dengan yang dipakai Scan
Persiapan sekarang. **Tidak ada pembatasan jabatan** — koordinator bebas
pilih siapa saja yang QR-nya di-scan. Ini hook yang SANGAT bisa dipakai
ulang apa adanya — **SUDAH DIIMPLEMENTASIKAN di Fase 2** (jalur Bahan,
tahap pertama yang butuh SCAN OPERATOR — lihat `STATUS-PROYEK.md`
§44.14), dan langsung ikut kepakai lagi apa adanya di Fase 3 (§44.19).

## 1.7. Koreksi arsitektur menu + Fase 1 dibangun (29 Agt 2026, malam)

Setelah §1.6 dijawab, 3 pertanyaan blocking terakhir sebelum coding
ditanyakan & dijawab:

- **Aturan nomor urut** → **"Global per hari, lintas produk"**
  (dikonfirmasi, format final `SPK{yymmdd}{urutan 3 digit}`, counter
  transaksi harian `pengaturan_id_spk_grouping/{yymmdd}`, reset otomatis
  tiap ganti tanggal karena doc id-nya per tanggal).
- **Collection lama** (`persiapan_produksi`/`persiapan_komponen`) →
  **"Ya, langsung tinggalkan/hapus"** — ditinggalkan tanpa migrasi,
  rules-nya TETAP DIBIARKAN ADA (jaga-jaga dokumen lama), tapi tidak ada
  lagi kode yang menulis/membacanya.
- **Penempatan menu** — pertanyaan pertama saya keliru diartikan Guru
  sebagai "tetap di slot yang sama" (nested di Zevanic House). Guru
  MENGOREKSI: *"ralat mending bikin grouo menu baru namanya Persiapan
  Produksi supaya tersusun rapih"*, dipertegas: *"persiapan produksi
  sejajar dengan zevanic house ... perlu disiapkan, vendor, bahan, acc
  sewing, acc webing, acc finisihing > sejajar dengan Stock & Pembelian/
  Keuangan/Master Produk (sub menu) ... pipeline jadi child menu,
  sesuaikan masing2"*. **Keputusan final: grup sidebar TOP-LEVEL baru**
  ("Persiapan Produksi", sejajar Master Absensi/Keuangan/Karyawan/
  Zevanic House/Integrasi), 6 sub-menu sejajar di dalamnya (Perlu
  Disiapkan/Vendor/Bahan/Acc Sewing/Acc Webbing/Acc Finishing), 5-tahap
  pipeline jadi CHILD-TAB di dalam masing-masing 5 sub-menu jalur (bukan
  di bawah "Perlu Disiapkan").
- **Wiring lama** → **"Ditulis ulang bersih dari nol"** (bukan
  ditambal) — `js/vue-persiapan-produksi.js` DITINGGALKAN (file tidak
  dihapus dari disk, tapi `<script>`-nya dicopot dari `index.html`).

**Fase 1 SUDAH DIBANGUN** dengan struktur ini: sidebar top-level baru +
25 slot navigasi child-tab (5 jalur × 5 tahap, placeholder sampai Fase
2-5) + "Perlu Disiapkan" fungsional penuh (generator SPK Grouping, baca
`order_spk` aktif, cocokkan via `master_produk.nama` + kunci pola, cetak
label). Detail file-per-file & catatan validasi ada di
`STATUS-PROYEK.md` §44.13 — TIDAK diulang di sini supaya dokumen ini
tetap fokus ke keputusan desain, bukan changelog implementasi.

**Riset penting sebelum tulis kode** (dicatat supaya tidak terulang di
Fase berikutnya): tombol header tiap grup sidebar top-level (`menu-
zevanic-house`, dst) mulai `hidden` di HTML dan HARUS didaftarkan manual
di `js/auth.js` `aturTampilanBerdasarkanRole()` supaya kelihatan sesuai
role — kalau lupa, grup baru itu **permanen tidak pernah muncul** di
sidebar siapapun walau markup & routing-nya sudah benar. `js/auth.js`
juga punya `terapkanUrutanMenuDesktop()` (fitur urutan menu custom
Owner) dengan peta kategori→id-grup sendiri yang perlu entry baru juga.

## 2. Yang sudah ada di kode sekarang (dicek langsung, bukan tebakan)

Supaya jelas apa yang akan diganti dan apa yang bisa dipakai ulang:

**`order_spk`** (`js/vue-order-spk.js`) — 1 dokumen = 1 baris SKU (bukan
array multi-item). Field: `no_spk` (teks bebas, BUKAN auto-generate —
divalidasi cuma unik), `sku_produk`, `nama_produk`, `qty_order`,
`tanggal`, `status` (`Aktif`/`Selesai`) — **BARU (Fase 1)**: `id_spk_
grouping`/`kode_spk_grouping`/`status_grouping` diisi begitu SPK ini
ikut 1 SPK Grouping. Dulu saat SPK baru disimpan otomatis membuat 1
dokumen antrean di `persiapan_produksi` — **panggilan itu SUDAH DIHAPUS**
di Fase 1 (lihat `STATUS-PROYEK.md` §44.13), digantikan pembacaan
langsung `order_spk` oleh menu "Perlu Disiapkan" yang baru.

**`persiapan_produksi` + `persiapan_komponen`** (`js/vue-persiapan-
produksi.js`, DITINGGALKAN) — status biner `perlu_disiapkan → approved`
di level SPK, lalu `proses → selesai` di level komponen. Saat "Approve",
sistem membongkar `master_produk.bom_pola` jadi komponen `tipe:'bahan'`,
dan `bom_aksesoris` jadi `tipe:'sewing'/'webbing'/'finishing'`
(dikelompokkan dari field `tahap_proses` yang sudah ada persis dengan 3
nama itu). **Ini match langsung dengan 3 dari 5 jalur yang Guru minta**
(Acc Sewing/Webbing/Finishing) — pola deteksi yang SAMA (cocokkan
`tahap_proses` case-insensitive) dipakai ulang di Fase 1 buat
`jalurOtomatisProduk()`, walau isi tahap 5-nya sendiri belum dibangun
(Fase 2-5).

**`js/vue-scan-persiapan.js`** — cuma ada 1 aksi tulis: "Catat Pemakaian"
(scan QR bahan → catat ke kartu stok). Mekanisme scan-nya pakai kamera +
library `jsQR` (CDN), bukan input manual — **pola scan ini bisa dipakai
ulang apa adanya** untuk SCAN OPERATOR/ENTRY/PACK/KIRIM/SAMPAI yang
akan dibangun Fase 2 ke atas.

**`PopupPratinjauCetakLabel`** (`js/vue-components.js`) — komponen cetak
label generik yang sudah dipakai 3 tempat (kontrak: `daftarLabel:
[{kode, nama, info, qrDataUrl}]`, cetak thermal `4in x 2in`). **Dipakai
ulang apa adanya di Fase 1** untuk Label Kode SPK Grouping; akan dipakai
lagi untuk Label Kode Bagging & Label Kode Tugas di Fase 2 ke atas.

**`master_produk.bom_pola.panjang` + `.isi_pola_pcs`** — dua field ini
(sudah ada, aktif dipakai) ternyata PERSIS jadi kunci grouping yang
dimaksud Guru (lihat §1.6.A) — **DIPAKAI di Fase 1** (`kunciPolaProduk()`
di `js/vue-persiapan-produksi-v2.js`), bukan field baru.

**`master_produk.kelipatan`** (`js/vue-master-produk.js`, `hitungKelipatan()`
baris 212-216) — KPK/LCM dari semua `bom_pola[].isi_pola_pcs`, SUDAH
disimpan permanen per produk & sudah dipakai di Order SPK sebagai
"Rekomendasi Kelipatan Order". **Ini rumus persis buat aturan split qty
SPK Grouping (§1.6.B) — BELUM dipakai di Fase 1** (Fase 1 gabung qty
penuh per SPK anggota, split-per-kelipatan menyusul Fase 2 ke atas kalau
dibutuhkan).

**QR pribadi per akun** (`js/vue-account-profile.js` + `js/vue-scan-
qr.js`) — tiap karyawan sudah punya QR pribadi (dari `id_app`/email)
yang sudah dipakai buat absensi fisik, dan caption-nya sudah menyinggung
"verifikasi proses SPK". Mekanisme scan-nya (jsQR) sama dengan yang
dipakai Scan Persiapan. **Dipakai buat SCAN OPERATOR sejak Fase 2**
(lihat §1.6.D), dan tetap dipakai apa adanya di Fase 3 (jalur Acc).

**`master_produk.bom_pola.tipe`** (`'internal'`/`'vendor'` + field
`jenis_vendor`) — dugaan awal saya (field ini = penentu jalur "Vendor")
**TERNYATA KELIRU** setelah diklarifikasi Guru (§1.6.C) — jalur Vendor
yang dimaksud itu pekerjaan dekorasi (sublim/sablon/bordir), bukan
potong-pola-oleh-vendor. Field ini kemungkinan tetap ada gunanya untuk
kasus lain, tapi TIDAK otomatis jadi sumber data jalur Vendor yang baru
— perlu field/master data baru di BOM Aksesoris (lihat §5.C, masih
terbuka).

## 3. Struktur data — `spk_grouping` (Fase 1, SUDAH diimplementasikan)

Skema aktual yang ditulis di Fase 1 (`js/vue-persiapan-produksi-v2.js`),
sedikit lebih sederhana dari rancangan awal dokumen ini (field
`kunci_pola` jadi string tunggal "diurutkan" bukan objek, breakdown
tidak menyimpan `id_spk_grouping` balik ke SPK secara array tapi lewat
field baru di `order_spk` — lihat §2):

```
kode_spk:               "SPK260829001"   (SPKyymmdd + urut 3 digit, global per hari)
nama_produk:             string           // nama DASAR (master_produk.nama), §1.6.A
kunci_pola:              string           // "panjang1xisi1|panjang2xisi2|..." terurut
sku_produk_terlibat:     [sku, ...]
qty_total:                number
breakdown: [
  { order_spk_id, no_spk, sku_produk, nama_produk, qty }, ...
]
jalur_aktif:             ['bahan', 'sewing', ...]   // deteksi otomatis dari BOM +
                                                      // 'vendor' kalau dicentang manual
label_grouping_dicetak:  boolean
tanggal_generate, dibuat_oleh
```

`order_spk` anggota grouping ditandai `id_spk_grouping` (FK balik ke
dokumen ini), `kode_spk_grouping`, `status_grouping: 'tergrouping'` —
supaya tidak muncul lagi di antrean "Perlu Disiapkan" berikutnya.

### `spk_track` — Fase 2 (jalur Bahan) + Fase 3 (jalur Acc), SUDAH diimplementasikan

Skema AKTUAL yang ditulis di Fase 2 (`js/vue-persiapan-produksi-v2.js`,
fungsi `buatSpkTrackUntukGrouping()`) — 1 dokumen per `spk_grouping` ×
jalur aktif, supaya status paralel independen sesuai keputusan #3:

```
grouping_id:      FK ke spk_grouping (id dokumen)
kode_spk:         string (disalin dari spk_grouping.kode_spk, buat query cepat tanpa join)
nama_produk:      string (disalin dari spk_grouping.nama_produk)
qty_total:        number (disalin dari spk_grouping.qty_total)
jalur:            'vendor' | 'bahan' | 'sewing' | 'webbing' | 'finishing'
status:           'perlu_diproses' | 'sedang_diproses' | 'perlu_dikirim' | 'sedang_dikirim' | 'selesai'
operator_id, operator_nama       // diisi saat SCAN OPERATOR
kode_bagging                     // diisi saat cetak Label Kode Bagging (sebelum SCAN PACK)
kode_tugas                       // diisi saat cetak Label Kode Tugas (sebelum SCAN KIRIM)
riwayat_scan: [
  { aksi: 'operator'|'entry'|'masalah'|'pack'|'kirim'|'sampai', oleh, pada }, ...
]
catatan_masalah   // diisi kalau SCAN MASALAH dipakai
dibuat_pada, diperbarui_pada
```

**Skema INI TIDAK BERUBAH SAMA SEKALI di Fase 3** — jalur Sewing/
Webbing/Finishing memakai collection & bentuk dokumen yang IDENTIK,
cuma nilai field `jalur` yang beda ('sewing'/'webbing'/'finishing').
Tidak ada field baru, tidak ada rules baru (lihat `STATUS-PROYEK.md`
§44.19).

**Penyimpangan dari rancangan awal (keputusan sepihak, tandai buat
Guru)**: field `baris_kebutuhan[]` (rencana awal: reuse bentuk `baris`
di `persiapan_komponen`, checklist qty per-item) **TIDAK dibuat** —
Fase 2 disederhanakan jadi murni per-BATCH (1 `spk_track` = progres 1
SPK Grouping utuh di 1 jalur), bukan per-komponen/per-item seperti
sistem lama. Alasan: semua aksi scan jalur Bahan/Acc scan **label fisik
batch** (SPK Grouping/Bagging/Tugas), bukan checklist qty per barang —
jadi tidak ada tempat "qty_disiapkan per baris" untuk diisi. Kalau Guru
mau granularitas per-item nanti, ini perlu didesain ulang (bukan
sekadar nambah field).

Kenapa dipecah jadi 2 collection (bukan 1 dokumen besar dengan field
per-jalur): supaya query "daftar SPK yang perlu diproses di jalur Bahan/
Sewing/Webbing/Finishing" itu query flat sederhana (`where jalur=='...'
and status=='perlu_diproses'`), bukan harus baca semua grouping lalu
filter di client — pola ini sama dengan kenapa `persiapan_komponen`
sekarang dipisah per-tahap dari `persiapan_produksi`. Rules Firestore
untuk `spk_track` **sudah ditulis DAN sudah dipublish** ke Firebase
Console sejak Fase 2 — Fase 3 pakai rules yang SAMA (generic, tidak
bercabang per nilai `jalur`), tidak perlu publish ulang apapun.

## 4. Alur per tahap (dipetakan ke aksi yang diminta Guru) — jalur Bahan + 3 jalur Acc SUDAH dibangun (Fase 2+3), jalur Vendor masih rancangan

**Perlu Diproses** → admin CETAK Label Kode SPK Grouping (pakai
`PopupPratinjauCetakLabel`, `kode: kode_spk` — **SUDAH JALAN di Fase
1**, lihat §3) → baru bisa **SCAN OPERATOR** — koordinator buka menu
Scan Operator lalu scan **QR PRIBADI operator** yang ditugaskan (bukan
scan label SPK-nya, lihat §1.6.D) → pindah **Sedang Diproses**.
**SUDAH DIBANGUN Fase 2, dipakai ulang apa adanya di Fase 3** — gerbang
tambahan: label SPK Grouping wajib sudah dicetak
(`label_grouping_dicetak`) sebelum tombol Scan Operator boleh dipakai.

**Sedang Diproses** (jalur Bahan) — urutan kerja fisiknya:
**gelar kain bersamaan → pola kain → cutting bersamaan** (sesuai §1.6.A
— makanya SPK-SPK dengan panjang & isi pola sama digabung, biar hamparan
kainnya bisa sekali gelar sekali potong) → setelah selesai, operator
**SCAN ENTRY** (tandai selesai proses) → **Perlu Dikirim**. Kalau
bermasalah → **SCAN MASALAH** (isi `catatan_masalah`). Untuk **3 jalur
Acc (Sewing/Webbing/Finishing)**, "Sedang Diproses" artinya proses
jahit/webbing/finishing itu sendiri berlangsung — alur SCAN ENTRY/
MASALAH-nya IDENTIK, cuma makna fisik pekerjaannya beda per jalur.
**SUDAH DIBANGUN Fase 2 (Bahan) + Fase 3 (3 Acc)** — TAPI "Scan Masalah"
belum terhubung ke `js/vue-persiapan-masalah.js` (keputusan sepihak,
cuma catat lokal di `spk_track`, lihat §3), status TIDAK berubah saat
dipakai.

**Perlu Dikirim** → admin cetak Label Kode Bagging → operator **SCAN
PACK** → **Sedang Dikirim**. **SUDAH DIBANGUN Fase 2 + Fase 3.**

**Sedang Dikirim** → admin cetak Label Kode Tugas → operator **SCAN
KIRIM** → tapi status TETAP "Sedang Dikirim" (sesuai catatan Guru: "SCAN
SAMPAI pada proses selanjutnya" yang baru mengubah status) → baru jadi
**Selesai** setelah pihak penerima (proses berikutnya) melakukan **SCAN
SAMPAI**. **SUDAH DIBANGUN Fase 2 + Fase 3** — TAPI Scan Kirim & Scan
Sampai dilakukan di layar yang SAMA (belum ada layar "penerima" terpisah,
keputusan sepihak).

Semua aksi SCAN di atas pakai ulang mekanisme kamera+`jsQR` yang sudah
terbukti jalan di `vue-scan-persiapan.js` (lookup QR-pribadi-ke-
karyawan pakai pola `vue-absensi-qr.js`) — beda target tulis saja
(`spk_track.status` + push ke `riwayat_scan`), bukan mekanisme scan
baru. **Fase 3 (Sewing/Webbing/Finishing) SUDAH SELESAI** memakai ulang
persis komponen `JalurTahapManager` yang sama, cuma parameter `jalur`
beda — TIDAK ada alur baru yang ditulis, sesuai perkiraan di §7.

## 5. Pertanyaan terbuka Fase 4 (Vendor) — SEBAGIAN terjawab 29 Agt 2026 malam

Poin "A" (nomor urut) & poin "menu" sudah dijawab final (§1.7). Poin "B"
(aturan KPK) sudah ketemu jawabannya sendiri dari field yang sudah ada
(§1.6.B). Poin "D" di bawah SEKARANG SUDAH TERJAWAB (lihat jawaban di
bawahnya) — Fase 4 (Vendor) **SUDAH DIBANGUN & SELESAI** (kode) memakai
jawaban itu, lihat `STATUS-PROYEK.md` §44.20. Poin "C" MASIH SEBAGIAN
terbuka, TAPI **TIDAK LAGI memblokir** Fase 4 — jalur Vendor sudah bisa
jalan penuh lewat aktivasi manual yang sudah ada sejak Fase 1 (lihat
jawaban di bawah C).

**C. Untuk jalur Vendor (sublim/sablon/bordir dll)** — SEBAGIAN
terjawab 29 Agt 2026 malam: *"vendor yg scan driver yg biasa belanja,
karena dia jg kurir yg kirim dan sampai barang"* — siapa yang SCAN
SUDAH JELAS (driver internal, akun+QR yang sama seperti karyawan lain,
BUKAN vendor dikasih akses terpisah). **MASIH TERBUKA**: apakah field
`tahap_proses` BOM Aksesoris memang perlu ditambah pilihan baru
**"Vendor"** (persis pola Sewing/Webbing/Finishing) plus 1 field
tambahan jenis vendor (Sublim/Sablon/Bordir/dll — teks bebas atau
dropdown baru?), supaya jalur Vendor bisa terdeteksi OTOMATIS dari BOM
sama seperti 3 jalur Acc — **belum ditanyakan ulang ke Guru**, dan
**belum jadi syarat wajib** karena jalur Vendor sudah bisa diaktifkan
manual (checkbox "+ Jalur Vendor (manual)", sudah ada sejak Fase 1) yang
generic terhadap `jalur_aktif`. Kalau nanti volume SPK yang butuh jalur
Vendor cukup banyak sehingga aktivasi manual terasa merepotkan, ini bisa
diangkat lagi sebagai enhancement.

**D. SCAN ENTRY vs SCAN SAMPAI di jalur Vendor — TERJAWAB 29 Agt 2026
malam.** Pertanyaannya dulu: karena barang fisik sempat keluar dari
lokasi (dikirim ke vendor luar, bukan cuma pindah antar-bagian internal
seperti jalur Bahan/Acc), apakah alur 5 tahapnya tetap SAMA PERSIS, atau
ada tahap/label tambahan khusus. **Jawaban Guru**: *"vendor yg scan
driver yg biasa belanja, karena dia jg kurir yg kirim dan sampai
barang"* — karena 1 orang (driver) yang pegang PENUH transportasi fisik
kedua arah (antar ke vendor MAUPUN jemput balik), **alur 5-tahap generic
yang sudah ada (Scan Operator/Entry/Pack/Kirim/Sampai) SUDAH CUKUP**,
TIDAK perlu tahap/label tambahan — driver itu sendiri yang scan di
hampir semua titik (assign sebagai operator, konfirmasi vendor selesai
kerja lewat Scan Entry, lalu Scan Pack/Kirim/Sampai buat bawa balik ke
internal). Diimplementasikan di `STATUS-PROYEK.md` §44.20.

## 6. Yang dipensiunkan (per keputusan "ganti total") — STATUS: SUDAH DIKERJAKAN di Fase 1

- Collection `persiapan_produksi` + `persiapan_komponen` — ditinggalkan
  tanpa migrasi (tidak ada data live, §1.5). Rules **dibiarkan ada**
  (tidak dihapus, jaga-jaga dokumen lama).
- 5 menu-id lama di `js/vue-config-akses.js` — ditandai `deprecated:
  true` (tidak dihapus, jaga config akses lama yang mungkin sudah
  terlanjur diatur), digantikan 6 menu-id baru kategori "Persiapan
  Produksi".
- Entry sidebar + mount lama di `js/dashboard.js` — dihapus, diganti
  entry baru untuk grup top-level "Persiapan Produksi".
- `js/vue-persiapan-produksi.js` — DITINGGALKAN (file tetap ada di
  disk, `<script>`-nya dicopot dari `index.html`).
- `js/vue-order-spk.js` — pemanggilan `buatAntreanPersiapanProduksi()`
  DIHAPUS (bukan cuma didiamkan) supaya tidak lagi menulis ke
  collection yang sudah tidak dibaca siapapun.
- `LABEL_TAB`/`LABEL_SUBTAB` di `js/vue-header-mobile.js` — 5 entry lama
  `sub-zh-persiapanproduksi-*` diganti, `tab-persiapan-produksi` +
  6 label sub-menu + 25 label child-tab (5 jalur x 5 tahap) ditambah,
  supaya judul header mobile tetap benar di semua layar baru.
- **DIPERTAHANKAN** (bukan dihapus): `master_tahap_persiapan` (koleksi
  referensi "Sewing"/"Webbing"/"Finishing", dipakai dropdown Tahap Proses
  di BOM Aksesoris Master Produk) — namanya persis cocok dengan 3 jalur
  Acc yang baru, tetap dipakai sebagai sumber pengelompokan `tahap_proses`
  seperti sekarang (dipakai ulang di `jalurOtomatisProduk()` Fase 1).
- `js/vue-persiapan-masalah.js` — dipertahankan, akan disambungkan ulang
  ke SCAN MASALAH yang baru di Fase 2 (belum disentuh sama sekali).

## 7. Pembagian fase build

1. **Fase 1 — SELESAI (kode).** SPK Grouping generation: baca SPK aktif
   → kelompokkan otomatis (nama dasar + kunci pola) atau manual (SPK
   tanpa SKU) → generate `spk_grouping` + `breakdown` + cetak Label.
   Menu top-level baru + 25 slot navigasi 5 jalur × 5 tahap (placeholder).
   Rules baru (`spk_grouping`, `pengaturan_id_spk_grouping`) **sudah
   dipublish** ke Firebase Console. **BELUM diuji manual di
   browser+Firebase.**
2. **Fase 2 — SELESAI (kode).** Jalur Bahan penuh (5 tahap + scan) —
   paling mirip pola yang sudah ada (`vue-scan-persiapan.js`), jadi
   risiko paling kecil buat jadi acuan pola jalur lain (komponen
   `JalurTahapManager`, reusable buat Fase 3). Termasuk: `spk_track` +
   rules-nya (**sudah dipublish**), SCAN OPERATOR (§1.6.D). Split-qty
   per kelipatan (§1.6.B) **TIDAK dibangun** — split-nya sudah cukup
   lewat pengelompokan `kunci_pola` di Fase 1, tidak ada split lanjutan
   per-tahap. **BELUM diuji manual di browser+Firebase.**
3. **Fase 3 — SELESAI (kode), 29 Agt 2026 malam.** 3 jalur Acc (Sewing/
   Webbing/Finishing) — state machine-nya TERBUKTI sama persis dengan
   Fase 2 seperti diperkirakan: tinggal parametrisasi `jalur`
   (`JalurTahapManager` dipakai ulang apa adanya lewat
   `buatAppJalurTahap()`, TIDAK ada komponen baru ditulis). Tidak ada
   rules/collection baru — pakai `spk_track` yang sama persis, jadi
   tidak ada publish tambahan yang diperlukan. Detail lengkap & catatan
   validasi: `STATUS-PROYEK.md` §44.19. **BELUM diuji manual di
   browser+Firebase.**
4. **Fase 4 — SELESAI (kode), 29 Agt 2026 malam.** Jalur Vendor —
   TERNYATA TIDAK "paling beda" seperti dugaan awal §7 versi sebelumnya:
   §5.D terjawab Guru (driver internal yang sama jadi kurir kirim+sampai
   barang) sehingga 5-tahap generic yang sudah ada CUKUP tanpa
   tahap/label tambahan. §5.C (field BOM buat deteksi otomatis) MASIH
   sebagian terbuka tapi TIDAK memblokir — jalur Vendor pakai aktivasi
   MANUAL yang sudah ada sejak Fase 1 (checkbox), bukan menunggu skema
   BOM baru. Tidak ada rules/collection baru — sama seperti Fase 3,
   pakai `spk_track` yang sama persis. Sekarang SEMUA 5 jalur (Vendor/
   Bahan/Acc Sewing/Acc Webbing/Acc Finishing) sudah fungsional penuh di
   kode, placeholder statis di menu Persiapan Produksi sudah HABIS (0
   sisa). Detail lengkap & catatan validasi: `STATUS-PROYEK.md` §44.20.
   **BELUM diuji manual di browser+Firebase.**
5. **Fase 5** — Audit menyeluruh referensi lama yang mungkin masih
   tersisa, rapikan dokumentasi. BELUM DIMULAI.

---
*Dibuat 29 Agt 2026 berdasarkan diskusi dengan Guru. Diperbarui 29 Agt
2026 malam setelah Fase 1 (SPK Grouping + arsitektur menu top-level)
selesai ditulis — lihat `STATUS-PROYEK.md` §44.13. Diperbarui lagi
malam yang sama setelah Fase 2 (jalur Bahan, `spk_track` +
`JalurTahapManager`) selesai ditulis — lihat `STATUS-PROYEK.md` §44.14
untuk detail implementasi & catatan validasi. Diperbarui lagi malam yang
sama setelah Fase 3 (3 jalur Acc Sewing/Webbing/Finishing, parametrisasi
`JalurTahapManager` yang sama tanpa komponen baru) selesai ditulis —
lihat `STATUS-PROYEK.md` §44.19. Diperbarui lagi malam yang sama setelah
Fase 4 (jalur Vendor, §5.D terjawab Guru, aktivasi manual dipakai
langsung tanpa menunggu deteksi BOM otomatis) selesai ditulis — lihat
`STATUS-PROYEK.md` §44.20. Kelima jalur Persiapan Produksi V2 sekarang
SEMUA sudah punya kode, belum ada yang diuji manual di browser+Firebase
sungguhan.*
