# STATUS PROYEK — Zevanic/Gechoo ERP

> **Untuk sesi Claude manapun (baru atau lanjutan): BACA FILE INI DULU sebelum
> mengerjakan apapun.** Ini "titik mulai" tunggal — lebih bisa diandalkan
> daripada mengandalkan ingatan percakapan lama, yang bisa saja tidak
> terbawa ke chat baru. Update file ini di akhir sesi kerja yang cukup
> besar (bukan tiap perubahan kecil).

Terakhir diperbarui: **28 Agustus 2026, §43** — Fitur BARU "Persiapan
Produksi" (Zevanic House > Persiapan Produksi, 5 tab: Perlu Disiapkan +
Persiapan Bahan/Acc Sewing/Acc Webbing/Acc Finishing) + tab Config baru
"Persiapan Untuk Tahap" + dropdown Tahap Proses di BOM Aksesoris (Master
Produk). Dikerjakan setelah 4 ronde AskUserQuestion (trigger antrean,
isi Approve, format id turunan, mekanisme tandai selesai). **KODE SUDAH
DITULIS, DICEK (`node --check` mode ES-module lolos SEMUA file, tag HTML
seimbang), DAN SUDAH DIKIRIM** ke `Data Yang DIsiapkan` (10 file kode +
`firestore.rules` gabungan) — BELUM dikonfirmasi di-deploy/publish oleh
Guru.
⚠️ **2 BLOKIR TES, keduanya WAJIB aksi manual Guru di Firebase Console**:
1. **Firestore Rules** — 3 koleksi baru (`master_tahap_persiapan`,
   `persiapan_produksi`, `persiapan_komponen`) sudah DIGABUNG ke
   `firestore.rules` (dikirim penuh, siap timpa — juga masih ada versi
   tempel-manual `firestore-rules-tambahan-persiapan-produksi.txt` kalau
   perlu). WAJIB **Publish** manual di Firestore Database > Rules.
2. **Firestore Index gabungan** (BARU ditemukan 28 Agt 2026, sore, dari
   laporan Guru "Gagal memuat data" di SEMUA tab Persiapan Produksi) — 2
   composite index: `persiapan_produksi` (status ASC, no_spk ASC) &
   `persiapan_komponen` (tipe ASC, no_spk ASC). Panduan lengkap (2 cara:
   klik link error di Console browser / manual) dikirim sebagai
   `firestore-index-tambahan-persiapan-produksi.txt`.

TANPA KEDUANYA (rules ATAU index saja tidak cukup), menu Persiapan
Produksi & tab Config "Persiapan Untuk Tahap" tidak akan bisa dipakai.
Detail lengkap: §43.
>
> 📁 **KONVENSI LOKASI FILE — BERUBAH (28 Agt 2026), WAJIB DIPATUHI
> SESI-SESI SELANJUTNYA**: dulu `storage.rules` sempat ditulis di folder
> ROOT `F:\ZEVANIC HOUSE\FOUNDATION\`, terpisah dari `firestore.rules`
> yang di `Data Yang Disiapkan`. **Guru SUDAH memindahkan `storage.rules`
> ke dalam `Data Yang Disiapkan` juga** — mulai sekarang SEMUA file kerja
> (kode `.js`/`index.html` MAUPUN `firestore.rules` DAN `storage.rules`)
> ada di **SATU folder yang sama**:
> `F:\ZEVANIC HOUSE\FOUNDATION\Data Yang Disiapkan\`. Jangan cari
> `storage.rules` di folder ROOT lagi mulai sesi ini — sudah tidak ada
> di sana. Kalau sesi berikutnya perlu kirim/tulis ulang `storage.rules`,
> tulis ke `Data Yang Disiapkan`, BUKAN ke ROOT.
>
> ⚠️ **PENTING soal Firestore Rules — STATUS TERKINI (baca ini, JANGAN
> percaya catatan "BELUM ditempel" di bagian riwayat manapun di bawah,
> termasuk §20-§27 — SEMUANYA SUDAH BASI)**: Guru mengonfirmasi
> `firestore.rules` (file lengkap di folder
> `F:\ZEVANIC HOUSE\FOUNDATION\Data Yang Disiapkan\firestore.rules`)
> **SUDAH ditempel & di-Publish ke Firebase Console** — termasuk blok
> `master_produk` BARU §28 (Guru konfirmasi "sudah di deploy semua" pada
> 28 Agt 2026). File itu 1 file UTUH yang isinya SEMUA koleksi dari awal
> proyek s.d. sekarang, TERMASUK `master_produk`. Kalau ada laporan bug
> "permission-denied" di koleksi manapun SETELAH tanggal ini, JANGAN
> langsung diasumsikan rules belum ditempel — cek dulu kemungkinan lain
> (typo field, salah role, dst).
>
> ⚠️ **Soal Storage Rules — STATUS TERKINI**: `storage.rules` (lokasi
> BARU: `Data Yang Disiapkan`, lihat konvensi lokasi di atas) berisi
> gabungan rules ASLI untuk `pengumuman` (dipertahankan persis — path
> `pengumuman/{allPaths=**}`, role check inline, batas 1MB) + blok BARU
> `master_produk/{allPaths=**}` (baca: login, tulis: admin ke atas,
> batas 2MB) — **SUDAH di-deploy Guru** (28 Agt 2026, konfirmasi "sudah
> di deploy semua"). Catatan riwayat: versi `storage.rules` yang SEMPAT
> dibuat dari nol di sesi sebelumnya (pakai helper function
> login()/isAdminLevel(), path 1 level) **BEDA STRUKTUR** dari yang asli
> dan TIDAK PERNAH dipublish — sudah keburu diganti dengan versi
> gabungan yang benar sebelum Guru publish, jadi aman, fitur Pengumuman
> tidak kena risiko regresi.
>
> **STATUS TESTING (28 Agt 2026)**: Guru baru saja bilang "sudah di
> deploy semua sekarang testing" — sesi berikutnya yang menyambung dari
> sini WAJIB tanya Guru dulu hasil testingnya (bukan asumsi semua lancar
> ATAU asumsi ada bug) sebelum menganggap fitur Master Produk ini
> selesai/stabil. Kalau Guru melaporkan bug spesifik, JANGAN
> tebak-tebak — cek kode `vue-master-produk.js` langsung, cek Firestore
> Rules/Storage Rules di atas dulu sebagai kemungkinan penyebab standar
> sebelum menyimpulkan penyebab lain.
>
> **FITUR BARU #2 sambil testing (28 Agt 2026)**: Import/Export Excel
> Master Produk (template + import Produk Utama & BOM + popup
> verifikasi dengan saran koreksi). Kode SUDAH ditulis, `node --check`
> lolos, DAN SUDAH ditulis ke device Guru (`vue-master-produk.js?v=3`,
> device sempat terputus lalu konek lagi di sesi yang sama — dicek dulu
> mtime file di device sebelum commit, cocok dengan yang terakhir
> di-diff, aman tidak ada yang bentrok). **BELUM DITES Guru di live**.
> Detail lengkap: §28.9.
>
> **BUG DITEMUKAN & DIPERBAIKI (28 Agt 2026)**: menu drawer Profile di
> mobile kurang 2 link ("Reimburse" & "Absensi") — laporan Guru "menu
> profile di mobile tidak lengkap", lalu "perbaiki susunannya supaya
> rapi". SUDAH diperbaiki (link ditambah + urutan disusun ulang sama
> dengan urutan tab desktop) & ditulis ke device
> (`vue-profile-drawer.js?v=2`). **BELUM DITES Guru di live.** Detail:
> §28.10.
>
> **PERBAIKAN UX #1 sambil testing (28 Agt 2026)**: Guru minta dropdown
> "Nama Bahan"/"Nama Aksesoris" di BOM Pola & BOM Aksesoris digabung
> dengan Warna jadi 1 field (bukan 2 dropdown terpisah). Dikerjakan +
> SUDAH ditulis ke device Guru (`vue-master-produk.js`, cache-bust
> `?v=2` di `index.html`) — detail lengkap di §28.8. **Sambil
> mengerjakan ini ditemukan & DIPERBAIKI SEKALIAN 1 bug laten**: dropdown
> lama pakai `nama` polos buat opsi & pencocokan (`resolveBahan`) —
> kalau ada 2 item `master_bahan_aksesoris` dengan `nama` SAMA tapi
> `warna` beda (kasus NORMAL), dropdown tidak bisa membedakan keduanya
> dan `.find()` selalu ambil hasil PERTAMA (bisa nyantol ke warna yang
> SALAH tanpa ada error apapun) — PERSIS bug yang sama yang sudah lebih
> dulu diperbaiki di `vue-stock-pembelian.js` (§25.7/§25.11,
> `formatNamaBahan()`), sekarang menyusul diperbaiki juga di Master
> Produk pakai fungsi yang SAMA (disalin, bukan diimpor silang). Kalau
> Guru sempat entry data test SEBELUM perbaikan ini (pakai versi
> `?v=1`), field Bahan/Aksesoris di data test itu mungkin perlu dipilih
> ulang saat Edit (dropdown-nya bakal kosong kalau format tersimpan
> lama tidak cocok format baru) — TIDAK ada migrasi data otomatis,
> risiko ini diterima karena masih tahap testing awal, belum ada data
> produksi sungguhan.
Riwayat sebelumnya (§27) — Redesain Menu Home
Mobile: fondasi grid Home mobile SEKARANG BENERAN tarik dari
`DAFTAR_MENU` (bukan array tulis-tangan terpisah yang ketinggalan
lagi), Shortcut lama diganti "Favorit Saya" (Clock In/Out wajib +
maks. 4 favorit pilihan user) + kolom pencarian + akordeon per
kategori (maks. 5 + Lihat Semua) + admin BARU "Urutan Menu di Home
Mobile" (Config Akses), direvisi lagi §27.1 (grid 4 kolom dst.).
Detail lengkap: §27, §27.1.
Riwayat sebelumnya (§26.6) — Cetak Label Order SPK + tombol scan No.
SPK di Scan Persiapan, **SUDAH DIKIRIM (kode), BELUM DITES Guru di
live**. Detail: §26.6.
Riwayat sebelumnya (§26.5) — Tahap 5 (Scan Persiapan), lihat di bawah.
Riwayat sebelumnya (§26.4) — Tahap 4 (Scan Opname), lihat di bawah.
Riwayat sebelumnya (§26.3) — Tahap 3 (Cetak Label), lihat di bawah.
Riwayat sebelumnya (§26.2) — Tahap 2 (Order SPK), lihat di bawah.
Riwayat sebelumnya (§26.1) — Tahap 1 (Config), lihat di bawah.
Riwayat sebelumnya (§25.14) — revisi cara hitung
Harga Modal/Harga Pembelian buat item dengan Konversi Banyak Tingkat
(SUPERSEDE §21.11/§21.13): sekarang diambil harga TERMAHAL di antara
implikasi per-satuan-akhir SEMUA tingkat (bukan cuma tingkat teratas
saja seperti sebelumnya), prefill "Harga Aktual" di Order Belanja
sekarang ambil harga TINGKAT yang sungguhan dipilih (bukan selalu
tingkat teratas), DAN begitu Nota di-final-kan dengan harga aktual
beda dari Master, baris `konversi_bertingkat` yang cocok tingkatnya
JUGA ikut ter-update otomatis (sebelumnya cuma `harga_pembelian`
tunggal yang ke-update). Detail: §25.14.
Riwayat sebelumnya (§25.13) — field "Satuan"
(List/Nota Order Belanja) SEKARANG BENERAN bisa dipilih (bukan
terkunci lagi seperti §25.12) — opsinya diambil dari rantai "Konversi
Banyak Tingkat" item itu (mis. bisa pilih DUS/PACK/PCS kalau
tingkatnya 3), dan Qty Pakai dihitung pakai faktor konversi yang BENAR
sesuai tingkat yang dipilih (bukan selalu faktor gabungan dari tingkat
paling atas).
Riwayat sebelumnya (§25.12) — 3 perbaikan dari
laporan Guru setelah tes live §25.11: (1) field "Satuan" di baris entry
List/Nota Order Belanja diganti jadi komponen dropdown-cari (biar
konsisten gaya kotak dengan field lain) — TAPI SENGAJA tetap
`disabled`/terkunci ikut item yang dipilih (bukan bisa pilih bebas),
karena bisa bikin Qty Pakai kehitung salah diam-diam kalau satuan
dibolehkan ganti tanpa konversi ikut disesuaikan (**DISUPERSEDE §25.13
di atas** — Guru konfirmasi memang perlu bisa pilih, sudah dibuka +
konversinya dihitung benar sesuai tingkat); (2) kolom "Nama Barang" di tabel List/Nota
Order Belanja (+ Nota cetak) SEKARANG ikut tampil warna (fix akar
masalah: `buatBarisPesanan()` masih simpan `item.nama` polos padahal
dropdown pemilihannya sudah nama+warna); (3) komponen `DropdownCari`
(`vue-components.js`) SEKARANG punya navigasi keyboard (panah
atas/bawah menyorot opsi + Enter memilih + Escape menutup) — SEBELUMNYA
tidak ada sama sekali (komponen ini buatan sendiri, bukan dari
library/SDK Vue manapun). Ditemukan sekalian: `vue-components.js`
SELAMA INI tidak punya skema cache-busting `?v=` sendiri (cuma
diimpor lewat `import ... from './vue-components.js'` tanpa versi di 5
file lain) — jadi perubahan sekarang ditambahkan `?v=1` di tiap baris
importnya supaya browser Guru pasti ambil versi baru, bukan cache lama.
Detail: §25.12. **BELUM DITES Guru.**
Riwayat sebelumnya (§25.11) — revisi besar List &
Nota Order Belanja: Nota SEKARANG "1 Nota = 1 Suplayer" (field Suplayer
pindah ke header, terkunci begitu ada item pertama), dropdown alias
(§25.10) DIBATASI cuma Suplayer yang sedang dipilih + label alias jadi
polos, fokus otomatis ke Qty setelah klik Tambah, field Estimasi Biaya
diperbesar & jadi baris sendiri, kolom tabel disusun ulang + kolom baru
"Nama Alias" + rename "SKU"→"ID Bahan & Aksesoris" (SEKALIAN fix isinya
yang ternyata ID dokumen mentah, bukan id_tampil). Ada 1 keputusan
sepihak yang perlu dikonfirmasi Guru (soal field Suplayer di List). Detail:
§25.11.
Riwayat sebelumnya (§25.10) — dropdown "Nama
Barang" di List & Nota Order Belanja SEKARANG juga bisa dicari lewat
nama Alias (nama di nota Suplayer), tidak cuma nama+warna internal
seperti sebelumnya.
Riwayat sebelumnya (25 Agt 2026, lanjutan lagi, §25.9) —
revisi susunan field entry & tabel Alias Pembelian (Suplayer → Nama di
Nota Suplayer → Nama Internal, sesuai urutan diminta Guru), SEKALIAN
fix bug data: tabel Alias Pembelian ternyata masih belum bisa tampilkan
nama+warna walau dropdown entry-nya sudah bisa (§25.7) — `bahan_aksesoris_nama`
yang tersimpan masih nama polos. Detail: §25.9.
Riwayat sebelumnya (§25.8) —
FIX bug "Cetak Label Roll cetak tapi kode QR-nya tidak muncul" (lapor
Guru). Akar masalah: versi lama memuat library pembuat-QR (`qrcodejs`)
lewat `document.write()` DI DALAM window print yang baru dibuka — pola
ini beda dari satu-satunya pola pemuatan library eksternal yang SUDAH
terbukti jalan di app ini (`jsQR`, dimuat lewat `<script>` biasa di
`index.html`), dan rawan gagal diam-diam (intervensi Chrome terhadap
script lintas-domain yang disisipkan lewat document.write, dan/atau
race proses async internal library saat `window.print()` keburu jalan).
Sudah dicek langsung (bukan tebak-tebak): URL library-nya SENDIRI valid
dan isinya benar. Perbaikan: `qrcodejs` sekarang dimuat SEKALI di
`index.html` (sama seperti `jsQR`), tiap kode QR digambar DI WINDOW
UTAMA lalu diambil sebagai gambar base64 (sinkron, tidak perlu tunggu
proses async internal library), baru dikirim ke window print sebagai
`<img>` statis — window print tidak butuh apa pun dari internet lagi
saat mencetak. Detail: §25.8. **BELUM DITES Guru di live** — perbaikan
ini dikirim, minta Guru coba ulang tombol Cetak Label Roll & konfirmasi.
Riwayat sebelumnya (25 Agt 2026, lanjutan lagi, §25.7) —
dropdown "Nama Barang" (List/Nota Order Belanja) & "Nama Internal"
(Alias Pembelian) SEKARANG tampilkan nama+warna (mis. "DUSKY CRINKLE
BLUSH PINK", permintaan Guru persis) lewat fungsi baru `formatNamaBahan()`.
SEKALIAN memperbaiki **silent bug nyata** yang ditemukan: sebelumnya
kalau ada 2+ item `nama` sama tapi `warna` beda, dropdown tidak bisa
membedakan DAN pemilihan bisa nyantol ke varian warna yang SALAH (cocok
cuma lewat `nama`, ambil hasil pertama). Detail: §25.7. **SUDAH DITES &
DIKONFIRMASI JALAN oleh Guru di live** (sempat kelihatan "belum
berubah" karena cache browser index.html lama — beres setelah hard
refresh, BUKAN masalah deploy/kode).
Riwayat sebelumnya (25 Agt 2026, lanjutan lagi, §25.6, Tahap 2) — FIFO
OTOMATIS §25.5 DIGANTI jadi FIFO SEBAGAI SARAN DEFAULT (arahan
Guru: "per lot punya id bahan/aksesoris masing2 jadi nanti saat ngambil
karyawan cari kode yg sama [atau ... scan qr ... lalu ambil yg mau
dipakainya]"). Di Kartu Stok > "Catat Pemakaian", item `pakai_lot_tracking`
SEKARANG tampilkan tabel "Pilih Roll/Lot yang Dipakai" — sudah terisi
otomatis pakai saran roll TERTUA (FIFO), TAPI karyawan BOLEH ganti/tambah
roll lain lewat cari kode (ketik) atau tombol **Scan Roll** (kamera,
`jsQR`, baca QR label fisik roll). Kalau pilihan akhir BUKAN roll
tertua → **konfirmasi peringatan dulu** (keputusan Guru: "Beri
peringatan dulu", BUKAN diblokir). Tombol BARU **Scan Barang** (Kartu
Stok Ringkasan) — scan QR roll/kode bahan langsung buka Kartu Stok
Detail item itu, jalan pintas SAJA (keputusan Guru: "Cuma buka form
Catat Pemakaian lebih cepat"), berlaku SAMA untuk item lot MAUPUN
BUKAN lot. Tombol BARU **Cetak Label Roll** (Nota Order Belanja) —
begitu Nota di-final-kan & ada roll baru dibuat, cetak label fisik
(`kode_lot` unik BARU per roll + QR) buat ditempel ke roll fisiknya.
`catatPemakaianDenganFifo()` DIHAPUS, GANTI `catatPemakaianDariAlokasi()`
(alokasi roll/qty ditentukan pemanggil, bukan otomatis FIFO lagi).
Popup 3 opsi keputusan (lot kurang dari qty diminta, §25.5) TIDAK
BERUBAH alurnya. Detail lengkap: §25.6. **SUDAH DIKIRIM (zip), BELUM
DITES SAMA SEKALI — kamera/scan/cetak fisik KHUSUSNYA belum bisa
diverifikasi Claude sama sekali (butuh device fisik).**
Riwayat sebelumnya (25 Agt 2026, lanjutan lagi, §25.5) — FIFO
Roll/Lot OTOMATIS dijalankan pertama kali (arahan Guru: "stok saat di
pakai bantu sync dlu lanhsung pangkas aja bisa?"). Koleksi BARU
`lot_bahan_aksesoris` (1 doc = 1 roll/lot individual, `qty_sisa`
dilacak) dibuat OTOMATIS saat Nota Order Belanja di-final-kan untuk
item `pakai_lot_tracking`. Data lot kosong sama sekali → BLOKIR
(keputusan Guru). Data lot kurang dari qty diminta → popup 3 opsi
keputusan (kurangi jumlah / proses sebagian + sisa otomatis masuk
Persiapan Masalah / tunggu dulu, sisa juga masuk Persiapan Masalah —
SEMUA lewat koleksi `persiapan_masalah` yang sudah ada apa adanya,
tidak ada skema baru). Modul SPK/produksi TETAP tidak disentuh (memang
belum ada — dikonfirmasi lewat AskUserQuestion, 3 opsi keputusan
diterapkan di form Catat Pemakaian yang sudah ada, bukan menunggu SPK).
`firestore.rules` BARU untuk `lot_bahan_aksesoris` **SUDAH ditempel &
di-Publish Guru** (dikonfirmasi 27 Agt 2026, file di-upload ke Firebase
Console ~pukul 15:17 WIB — lihat §27.2 buat konfirmasi lengkapnya, 1
file `firestore.rules` yang sama mencakup SEMUA block yang sebelumnya
menunggu). Detail lengkap: §25.5.
**BELUM DITES SAMA SEKALI oleh Guru** — LALU pendekatan FIFO
otomatisnya DIGANTI lagi di §25.6 di atas SEBELUM sempat dites.
Riwayat sebelumnya (25 Agt 2026, lanjutan lagi, §25.4) — Qty per
Roll/Lot RONDE PERTAMA diimplementasikan (arahan Guru: "untuk qty per
lot bantu jalankan (fifo nanti saja)"). Field opsional BARU
`pakai_lot_tracking` di `master_bahan_aksesoris` (checkbox di Entry/
Edit) menandai item yang disimpan per roll/kones. Di Nota & List Order
Belanja, tabel "Daftar Pesanan Pembelian" dapat kolom BARU PALING KIRI
berisi tombol popup "Qty per Roll/Lot" (`PopupQtyPerLot`, komponen
baru) — HANYA aktif untuk baris item yang ditandai flag di atas, isi
qty tiap roll SEBELUM Nota/List disimpan, hasil masuk field baru
`items[].detail_lot`. Detail lengkap: §25.4.
Riwayat sebelumnya (25 Agt 2026, lanjutan) — Rak Penyimpanan DIROMBAK
dari 3 dropdown lepas (§24) jadi **menu tersendiri** ("Rak Penyimpanan",
child ke-3 di Data Bahan & Aksesoris, file BARU
`vue-rak-penyimpanan.js`, koleksi `master_rak_penyimpanan`) — 1 rak
fisik = 1 record (Kode/Baris/Kolom + dimensi Tinggi/Panjang/Lebar →
Volume/kapasitas otomatis), plus tabel daftar semua Rak. Bahan/Aksesoris
sekarang pilih Rak lewat 1 dropdown (`rak_id`+`rak_label`, GANTI field
`kode_rak`/`baris_rak`/`kolom_rak` §24 — aman, belum sempat dipakai data
nyata). `firestore.rules` BARU untuk `master_rak_penyimpanan` **SUDAH
ditempel & di-Publish Guru** (dikonfirmasi 27 Agt 2026 ~pukul 15:17 WIB
— lihat §27.2). Detail: §25.1, §25.3. **Rak Penyimpanan JUGA BELUM ADA
TES SAMA SEKALI** (rules-nya sudah aktif, tapi belum ada yang coba
pakai fiturnya).
Riwayat sebelumnya (25 Agt 2026, ronde pertama): Entry & List
Bahan/Aksesoris ditambah Rak Penyimpanan versi AWAL (3 dropdown lepas,
SUDAH DIGANTI di atas) dan **Volume Barang** (Tinggi/Panjang/Lebar →
Volume dihitung otomatis, cm³, MASIH DIPERTAHANKAN, ini beda dari
Volume Rak) — SEMUA field OPSIONAL, tombol "Konversi Banyak Tingkat"
ikut dipindah posisi (di bawah grid Harga/Satuan, bukan di sebelah
Margin Modal lagi). Ronde ini CUMA simpan & tampilkan Volume —
peringatan overstok BELUM dikerjakan — lihat §24.
Riwayat sebelumnya (24 Agt 2026, malam, lanjutan): bug
`nama_shift` **TIDAK PERNAH tercatat** di dokumen `absensi` sejak awal
(root cause DIKOREKSI dari dugaan Guru soal format jam `master_shift` —
lihat §23.1), sekaligus ketahuan perhitungan otomatis "Status Kehadiran"
di Antrean Absensi diam-diam TIDAK PERNAH berfungsi sejak 19 Agt karena
bergantung field yang sama. Sudah diperbaiki + alat migrasi data lama
ditambahkan. Harga di **List Order Belanja** dijadikan **read-only**
(tidak lagi memicu Riwayat Harga Pembelian — HANYA **Nota** yang boleh,
§23.2). Menu BARU **"Kartu Stok Bahan/Aksesoris"** (Ringkasan + Detail,
pembelian otomatis dari Nota, pemakaian dicatat manual — §23.3) SUDAH
DIKIRIM. `firestore.rules` untuk §23 (block `kartu_stok_bahan_aksesoris`)
**SUDAH ditempel & di-Publish Guru** (dikonfirmasi 27 Agt 2026 ~pukul
15:17 WIB — lihat §27.2) — lihat §23.
Riwayat sebelumnya: FITUR BARU "Zevanic
House > Persiapan Masalah" + "Stock & Pembelian" [Alias Pembelian,
List/Nota Order Belanja, Master Suplayer] §21 SUDAH DIKIRIM, sidebar-nya
DIROMBAK ULANG §21.6 (pola 3 tingkat Parent>Sub-menu>Child, SERAGAM ke
SEMUA grup), popup Konversi Banyak Tingkat DIROMBAK BESAR §21.9-§21.13
(harga per baris, bukan referensi), LALU menu BARU **"Riwayat
Harga Pembelian"** + auto-update otomatis Harga Pembelian di Data Bahan
& Aksesoris §21.14 SUDAH DIKIRIM, `firestore.rules` (termasuk
`riwayat_harga_pembelian`) **SUDAH ditempel Guru ke Firebase Console
("aman done")**. Konvensi kirim file BARU juga disepakati malam
ini (folder `Foundation` = dokumen peta, folder `Foundation\Data Yang
Disiapkan` = file kode siap-push, zip cuma kalau device tidak
tersambung — lihat `PEDOMAN-GAYA-KERJA.md`), DITAMBAH keputusan BARU
soal riwayat browser (tombol back HP) yang bakal diperluas BERTAHAP ke
level Sub-menu & Child-tab mulai menu baru/menu yang tersentuh — lihat
§22, BELUM diimplementasikan, baru rencana desain. Panggilan Hilman
diganti jadi "Guru" mulai sesi ini. Riwayat
sebelumnya: konfirmasi §12 aman, fix badge PIN §19.2 DIKOREKSI ke root
cause yang benar, bug tabel Device Kiosk OPEN, gap navigasi back button
FIXED & DIKONFIRMASI, bug Clock In dobel + badge salah §19.5 FIXED &
DIKONFIRMASI ("done mantap"), QR Profile mobile + menu Absensi QR 4
tombol + redirect Kiosk §19.6 SUDAH DIPERBAIKI (tombol gabungan
dikonfirmasi Hilman), Clock Out "hidup lagi" (dokumen zombie) §19.7
SUDAH DIPERBAIKI, PIN Kiosk 2x (verifikasi+konfirmasi) + kartu sukses
foto diperbesar §19.8 SELESAI & DIKONFIRMASI, bug "Clock Out lewat Kiosk
gagal diam-diam gara-gara dokumen zombie gudang tidak cocok" §19.9
SELESAI & DIKONFIRMASI ("done untuk clock in dan clock out sudah
sesuai"), bug "kartu sukses tidak pernah kelihatan + kurang loading"
§19.10 SUDAH DIPERBAIKI, penyempurnaan kartu sukses §19.11 SUDAH
DIKIRIM, FITUR "Zevanic House > Master Bahan & Aksesoris" §20 + ronde 2
(Data Satuan/Ukuran/Warna, dropdown pencarian, Simpan & Duplikat) §20.6
SUDAH DIKIRIM)

---

## 1. Apa proyek ini

Sistem ERP internal (absensi, manajemen karyawan, WhatsApp Gateway) untuk
Zevanic/Gechoo — dipakai ±89-100 karyawan gudang.

- **Frontend**: Vue 3 via CDN (`unpkg.com`), **tanpa build step** — semua
  file `.js` langsung jalan di browser, tidak ada `npm run build`.
- **Backend**: Firebase — Firestore (database), Auth (login), Storage
  (file gambar/video, baru diaktifkan 17 Agt 2026), Cloud Functions
  (`zevanic-cloud-function/functions/index.js`, terpisah dari repo ini).
- **Hosting**: `gechoo.online`, lewat GitHub Pages.
- **Repo**: `gechooco-ship-it/zevanic-erp-ui` (GitHub, publik).
- **Desain**: warna Gechoo (Ivory/Baby Pink/Light Blue/Mahogany/Burgundy),
  font Poppins + Nunito Sans, style di `css/gechoo-design.css`.

## 2. Cara kerja sebelum mengerjakan apapun

1. **Baca file ini dulu.**
2. Baca `PRINSIP-HEMAT.md` — aturan baku soal hemat baca/tulis Firestore
   dan pola komponen bersama. **Wajib diikuti**, bukan opsional.
3. Kalau Claude punya akses `conversation_search`/`recent_chats` dan
   masih dalam Project yang sama, boleh dipakai buat cari detail spesifik
   dari sesi lama — tapi JANGAN jadi satu-satunya sumber, karena tidak
   selalu bisa diakses dari chat/context baru.
4. Kalau ragu soal keputusan desain/arsitektur yang sudah diambil, cek
   komentar di kode — banyak keputusan penting dijelaskan LANGSUNG di
   tempat kodenya (alasannya, bukan cuma apanya), sengaja ditulis begitu
   supaya tidak hilang kalau riwayat chat tidak terbawa.

## 3. Cara deploy — PENTING, sering jadi sumber bug kalau lupa

| Jenis file | Cara deploy |
|---|---|
| `.js`, `.html`, `.css`, `.md` | Upload biasa ke GitHub (repo `zevanic-erp-ui`) |
| `firestore.rules` | **Firebase Console → Firestore Database → Rules** → timpa isi → Publish. **BUKAN** upload ke GitHub. |
| `storage.rules` | **Firebase Console → Storage → Rules** → timpa isi → Publish. Beda tempat dari Firestore Rules. |

Kesalahan paling sering: user upload file `.js` yang benar tapi lupa
deploy `firestore.rules`/`storage.rules` yang menyertainya, lalu fitur
gagal dengan "Missing or insufficient permissions" — **selalu cek dulu
apakah ada file `.rules` yang menyertai sebelum menyimpulkan itu bug kode.**

## 3.5. Alur Registrasi -> Login DIROMBAK TOTAL (18 Agt 2026, dini hari)

**Kenapa**: data karyawan akan dipakai untuk pajak/asuransi/gaji ke depan
— makin penting diverifikasi manusia dulu sebelum jadi akun resmi.
Sekaligus menutup celah nyata: dulu kalau proses daftar gagal di tengah
jalan, email bisa "nyangkut" (akun Auth terlanjur dibuat, profil
Firestore gagal, tidak bisa dibersihkan otomatis — lihat riwayat masalah
ini di git log lama). Desain baru MENGHILANGKAN skenario itu sama sekali
— akun Auth baru dibuat SETELAH semuanya pasti valid.

### 3.5.1 Alur baru, singkatnya
1. **Registrasi** (`vue-registrasi.js`) — 3 tahap: (a) isi email → kirim
   OTP, (b) masukkan kode OTP → verifikasi, (c) BARU form data lengkap
   muncul (NIK, KTP, alamat, dst — **tanpa field password sama sekali**).
   Submit → tersimpan ke koleksi **`pendaftaran_pending/{email}`** —
   **BELUM ADA akun Firebase Auth sama sekali** di titik ini.
2. **Antrean Dakar** (`vue-antrean-dakar.js`) — Admin baca dari
   `pendaftaran_pending` (bukan `users` lagi), cek data & foto KTP.
   **Setujui** → akun Firebase Auth baru dibuat (password sementara =
   NIK), profil `users/{email}` dibuat lengkap (`role:operator`,
   `status_approval:APPROVED`, `wajib_ganti_password:true`), dokumen
   pending dihapus, email berisi cara login dikirim. **Tolak** → dokumen
   pending dihapus saja (tidak ada akun Auth yang perlu dibersihkan,
   karena memang belum pernah dibuat).
3. **Login pertama kali** (`vue-login.js`) — begitu password benar
   (NIK), sebelum lanjut kemanapun, muncul modal **wajib ganti password**
   (`wajib_ganti_password` di Firestore, `updatePassword()` Firebase
   Auth). Setelah diganti, `wajib_ganti_password` otomatis jadi `false`,
   alur normal lanjut (cek gudang, Clock In, dst — TIDAK berubah).
4. **Login dari perangkat baru** (kapanpun, bukan cuma pertama kali) —
   modal OTP muncul (deteksi murni `localStorage`, key
   `zevanic_device_verified_{email}` — perangkat yang PERNAH lolos OTP
   tidak akan diminta lagi SELAMA localStorage-nya tidak dihapus).
   Diaktifkan/nonaktifkan lewat toggle di WhatsApp Gateway > Config API
   ("Aktifkan verifikasi OTP saat login perangkat baru" — nama menu
   TIDAK diganti biar tidak perlu bikin toggle baru, tapi ISINYA sekarang
   kirim lewat EMAIL, BUKAN WhatsApp lagi — lihat 3.5.3).

### 3.5.2 Teknis paling berisiko — instance Firebase KEDUA
`createUserWithEmailAndPassword()` BAWAANNYA otomatis login sebagai akun
yang BARU dibuat. Kalau dipanggil di instance Firebase yang SAMA dengan
sesi Admin, Admin akan "terlempar" logout dari akunnya sendiri, jadi
login sebagai karyawan baru itu. Solusinya (di `vue-antrean-dakar.js`,
fungsi `buatAkunTanpaGangguSesi`): bikin instance Firebase KEDUA
(`initializeApp(firebaseConfig, "nama-unik")`, config yang SAMA tapi
instance terpisah total), pakai instance itu KHUSUS buat bikin akun,
lalu buang instance itu. Sesi Admin di instance UTAMA sama sekali tidak
tersentuh. `firebaseConfig` (objek mentahnya, bukan cuma hasil
`initializeApp`) sekarang diekspor dari `firebase-config.js` khusus
untuk kebutuhan ini.

### 3.5.3 OTP lama (WhatsApp) DIGANTI TOTAL, bukan cuma dimatikan
Ditemukan saat mengerjakan ini: mekanisme OTP lama di `vue-login.js`
**tidak aman** — kode OTP dibuat & DIBANDINGKAN LANGSUNG di JS browser
(`otpState.kode`, variabel biasa) — siapapun buka DevTools bisa
lihat/lewati verifikasinya. Sekarang diganti total pakai
`window.kirimOtpEmail`/`verifikasiOtpEmail` (lihat 7.4/vue-otp.js) — kode
aslinya TIDAK PERNAH ada di browser, verifikasi murni lewat Firestore
Rules. Toggle aktivasinya TETAP di WhatsApp Gateway (field
`config/whatsapp_gateway.otp_aktif`, biar tidak bikin toggle baru lagi),
tapi pengirimannya sekarang email, bukan WA.

### 3.5.4 Security Rules yang berubah untuk alur ini
- `users/{email}` — CREATE dulu syaratnya "orangnya sendiri yang bikin"
  (`request.auth.token.email == email`). SEKARANG jadi
  `isAdminLevel() && role=='operator' && status_approval=='APPROVED'`
  — karena yang bikin sekarang ADMIN (instance kedua), bukan orangnya.
- `pendaftaran_pending/{email}` (BARU) — create CUMA boleh kalau
  `otp_email/{email}` sudah `terverifikasi:true`. Read/delete
  `isAdminLevel()` saja (dipakai Antrean Dakar).

### 3.5.5 PR — belum sempat dikerjakan malam ini
- **BELUM DITES SAMA SEKALI END-TO-END** (deploy GitHub Pages sempat
  error berkali-kali malam ini) — WAJIB coba alur penuh (daftar → OTP →
  Antrean Dakar setujui → login pertama → ganti password → login lagi
  dari "device" lain buat tes OTP perangkat baru) sebelum dipakai
  karyawan sungguhan.
- Field `wajib_ganti_password` & alur ganti password BELUM pernah
  diuji — `updatePassword()` Firebase bisa gagal kalau sesi dianggap
  "tidak baru login" (`auth/requires-recent-login`) — sudah dikasih
  pesan error yang menjelaskan, tapi belum terverifikasi kapan tepatnya
  ini muncul dalam praktik.
- Kalau nanti ada YANG PERNAH pakai flow REGISTRASI LAMA (akun Auth
  sudah ada dari SEBELUM perombakan ini) dan masih berstatus PENDING di
  `users` (bukan `pendaftaran_pending`) — Antrean Dakar YANG BARU TIDAK
  AKAN melihatnya lagi (beda koleksi!). Perlu dicek manual apakah ada
  data lama seperti ini yang perlu dipindahkan/diproses manual.



### 4.0 Registrasi karyawan baru — bug "email nyangkut" (ditemukan & diperbaiki 17 Agt 2026)
`js/vue-registrasi.js` — proses daftar itu 2 langkah: (1) buat akun
Firebase Auth, (2) simpan profil ke Firestore. Kalau langkah 2 gagal,
kode BERUSAHA membatalkan langkah 1 (`deleteUser`) — tapi pembatalan itu
sendiri bisa gagal juga (sebelumnya cuma dicatat diam-diam di Console,
TIDAK diberitahu ke siapapun) — hasilnya akun Auth "nyangkut" (ada login
tapi tidak ada profil Firestore), email itu jadi tidak bisa dipakai
daftar ulang ("email sudah digunakan") padahal registrasi aslinya gagal.

**Perbaikan yang sudah masuk:**
1. Paksa refresh token (`getIdToken(true)`) sebelum `setDoc`, supaya
   Security Rules cek `request.auth.token.email` dengan token yang pasti
   segar — mengurangi kemungkinan `setDoc` gagal karena masalah timing.
2. Kalau pembatalan (`deleteUser`) SENDIRI gagal, sekarang pesan
   eksplisit muncul ke pengisi form: berhenti, jangan coba ulang, hubungi
   Admin — bukan diam-diam cuma log Console.
3. Pesan error "email sudah digunakan" diperjelas: mencakup 2
   kemungkinan (memang sudah daftar VS nyangkut dari kegagalan
   sebelumnya) — TIDAK bisa dibedakan otomatis dari sisi form, karena
   orang yang gagal daftar belum punya sesi login (Security Rules
   `users/{email}` wajib login dulu untuk dibaca, sengaja tidak dibuka
   supaya tidak ada celah keamanan baru).

⚠️ **Keterbatasan yang masih ada**: kalau email sampai benar-benar
nyangkut, SATU-SATUNYA cara membersihkannya adalah manual lewat
**Firebase Console → Authentication → cari email → Delete**. Tidak ada
alat di dalam app ini untuk mendeteksi/membersihkan otomatis — itu
butuh Admin SDK (server/Cloud Function), di luar jangkauan kode
client-side biasa yang dipakai di sini.

**Role**: `operator` (default, karyawan biasa) < `pic`/`admin` < `owner`/`superuser`
(setara, kecuali disebutkan beda) — role sekarang **dinamis**, tidak
cuma 5 nama baku ini (lihat poin 6, Config Akses).

**Struktur navigasi:**
- **Desktop**: sidebar kiri — Dashboard, Profile, Master Absensi (kalau
  pic/admin/owner/superuser), Master Karyawan (kalau owner/superuser),
  WhatsApp Gateway (kalau owner/superuser).
- **Mobile**: bottom nav 5 ikon — **Home** (hub menu, lihat poin 5),
  **Absensi** (Riwayat + Pengajuan pribadi), **Scan QR** (kamera baca QR,
  belum ada alur pemrosesan lanjutan), **Progress** (placeholder, belum
  dibangun), **Profile** (drawer geser dari kanan).

**Master Absensi** (`tab-admin-acc`): Config Absensi, Penjadwalan,
Antrean Absensi, **Antrean Lembur** (baru), Riwayat All Absensi.
**Master Karyawan** (`tab-superuser`): Antrean Dakar, Daftar Karyawan,
Slip Gaji (placeholder), Payroll (placeholder), Config Karyawan,
**Config Info** (kelola Pengumuman + Quote Harian), **Hak Akses**
(owner-only), **Config Akses** (owner-only).

### 4.1 Login komputer WAJIB Clock In dari HP dulu (aturan lama, bukan baru)
`js/vue-login.js` — sistem deteksi otomatis kalau login lewat browser
desktop (`isDesktopBrowser()`, cek `navigator.userAgent`, BUKAN pilihan
manual). Kalau desktop: kotak pilihan status (Hadir/Izin/Cuti)
disembunyikan sama sekali, diganti cek LANGSUNG ke Firestore
(`sudahClockInHariIniServer()`) — apakah email ini SUDAH ada catatan
Clock In hari ini. Kalau sudah → langsung masuk Dashboard. Kalau belum →
ditolak + logout otomatis, pesan minta Clock In dari HP dulu.

**Alasan**: foto selfie + validasi lokasi/radius cuma bisa lewat kamera
HP — desktop SENGAJA tidak punya jalur Clock In sendiri. Alur yang
benar: HP dulu untuk absen (dengan bukti foto), baru komputer boleh
dipakai untuk kerja administratif (Dashboard, dsb, layar lebih besar).

### 4.2 Aturan khusus Owner
- **Cara ditentukan**: murni field `role: "owner"` di Firestore. TIDAK
  ADA lagi deteksi dari pola email (versi lama yang cek "email
  mengandung kata owner" sudah dihapus total).
- **Login**: Owner (dan Superuser) dikecualikan dari wajib tautan
  gudang — role lain ditolak login kalau belum ditautkan ke gudang
  manapun, Owner tidak (perannya manajerial, bukan operasional
  lapangan). Tetap kena aturan `status_approval` yang sama seperti
  role lain.
- **Akses**: dapat semua menu Master Absensi + Master Karyawan +
  WhatsApp Gateway, DITAMBAH Config Akses & Hak Akses (2 menu ini
  KHUSUS Owner, Superuser tidak dapat).
- **Bypass Config Akses**: Owner SELALU dianggap akses penuh
  (`window.aksesConfigSaya = 'OWNER_PENUH'` di auth.js), dicek PALING
  AWAL sebelum baca Firestore apapun — jadi Owner tidak pernah baca
  `akses_config` sama sekali (hemat), dan tidak bisa dibatasi lewat
  Config Akses walau dicoba. Sengaja begini — Owner tidak boleh
  terkunci sendiri oleh kesalahan pengaturan.
- **Cara menjadikan seseorang Owner**: lewat Hak Akses (pilih role
  "owner" di dropdown). Untuk Owner PERTAMA KALI (belum ada Owner sama
  sekali di sistem) harus diatur manual di Firestore Console
  (`users/{email}.role = "owner"`), karena tidak ada Owner lain yang
  bisa memasangkannya lewat Hak Akses.

## 5. Home mobile — hub menu + header dinamis (dibangun 17 Agt 2026)

`js/vue-home.js` — bukan lagi cuma sapaan+shortcut, sekarang "hub menu"
lengkap: Kartu shift (melayang, lihat 5.2) → Pengumuman (carousel) →
Quote Harian (lihat poin 7.2, cuma tampil kalau ada jadwal hari itu) →
Shortcut (Clock In/Out dinamis, Izin, Cuti, Lembur) → grup menu per role
(Absensi/Master Karyawan/Whatsapp), semua tampil kotak grid 5 kolom.

**Penting**: SEMUA menu grup sekarang **selalu tampil ke siapapun**
(operator termasuk) — yang tidak berhak cuma ditandai kunci (redup +
ikon gembok), klik-nya munculkan pesan "Akses terkunci, silahkan hubungi
Owner / PIC Owner!", BUKAN navigasi. Pengecekan izinnya lewat
`window.cekIzinMenu()` (lihat 6.3), fallback ke role kalau belum diatur.
Logic-nya ada di `daftarMenuGroups()` (vue-components.js) — 1 registry
terpusat, kalau mau ubah/tambah menu, ubah di SATU tempat itu.

Desktop TIDAK pakai hub menu ini — cuma banner sambutan sederhana +
Pengumuman + Quote (komponen SAMA, di-mount terpisah lewat
`js/vue-home-desktop.js`).

### 5.1 Header mobile dinamis (`js/vue-header-mobile.js`, baru)
SATU komponen, dipasang di `<main>` (di atas SEMUA tab, bukan cuma
Home), isinya berubah otomatis:
- **Di Home**: "Selamat [pagi/siang/sore/malam], [Nama]" — kartu pink.
- **Di halaman lain**: "ERP Zevanic House" / "[Menu] - [Sub-menu]" —
  supaya orang tetap tahu sedang di mana walau baris tombol sub-tab
  disembunyikan di mobile (lihat 5.3).

Diaktifkan lewat `window.aturHeaderKonteks(tabId, subTabId)`, dipanggil
dari `pindahTab`/`pindahSubTab` (dashboard.js) — murni cocokkan ID ke
tabel label (`LABEL_TAB`/`LABEL_SUBTAB` di file itu sendiri), TIDAK baca
Firestore. **Kalau nambah tab/sub-tab baru, WAJIB tambahkan label-nya di
kedua tabel itu juga**, atau header-nya bakal kosong pas dibuka.

Header lama (`label-badge-role` + `teks-nama-user`, dengan countdown
"Terlambat +HH:MM:SS") sekarang **desktop-only** (`hidden md:flex`) —
mobile TIDAK pakai lagi, sengaja dihapus dari mobile sesuai permintaan
(fungsi `mulaiHitungJamKerja` di dashboard.js masih ada, cuma untuk
desktop sekarang).

### 5.2 Kartu shift melayang
Kartu putih dengan `margin-top:-26px` supaya visual overlap ke kartu
header pink di atasnya (gaya "melayang"). Isinya sekarang juga:
- Nama gudang di sebelah "Shift hari ini"
- Kalau sudah absen: jam Clock In asli + **durasi kerja berjalan
  real-time** (format `09:00 – 02:14:37`, update tiap detik pakai
  `setInterval`) — murni baca `localStorage` (key
  `zevanic_jam_masuk_{email}`, diisi `js/vue-camera.js` saat Clock In,
  dihapus saat Clock Out), TIDAK ada baca Firestore tambahan.

### 5.3 Baris tombol sub-tab disembunyikan di mobile
Master Absensi & Master Karyawan tadinya punya baris tombol horizontal
(Config Absensi | Penjadwalan | ... ) yang tampil di SEMUA ukuran layar
— sekarang `hidden md:flex`, cuma tampil desktop. Alasan: di mobile,
navigasi SEHARUSNYA lewat Home (atau header dinamis di 5.1), bukan
loncat-loncat sub-tab yang bisa kepencet tidak sengaja + boros baca
(tiap sub-tab dibuka = mount baru = fetch baru). Profile (`vue-account-
profile.js`) SUDAH lebih dulu begini (`hidden md:block`) — drawer profil
di mobile yang jadi navigasinya, bukan baris tombol.

## 6. Sistem Hak Akses (dirombak total 17 Agt 2026, beberapa tahap)

**SEBELUMNYA**: role cuma 5 nama baku (operator/pic/admin/owner/superuser),
hardcode di banyak tempat.

**SEKARANG**: role BEBAS dibuat (profil kustom seperti `admin_finance`),
satu sumber kebenaran = koleksi Firestore `akses_config`. Dikerjakan
bertahap malam ini — semua tahap SUDAH selesai:

### 6.1 Data & tampilan (tahap awal)
- **Config Akses** (`vue-config-akses.js`) — bikin/edit "profil akses"
  bebas namanya, atur izin View/Add/Edit/Delete/Print per menu +
  kontrol granular opsional (`fiturList`, misal kunci dropdown Jenis
  Lokasi di Master Gudang — lihat 6.4). Owner SENGAJA tidak muncul di
  sini (wajib akses penuh selalu, tidak bisa dikonfigurasi).
- **Hak Akses** (`vue-hak-akses.js`) — hubungkan karyawan ke profil.
  Dropdown-nya baca langsung dari `akses_config`.
- **Modal Edit Karyawan** (Daftar Karyawan) — dropdown role sinkron sama.

### 6.2 PENTING — dua field terpisah di `users/{email}` (jangan disatukan lagi!)
Supaya profil kustom TETAP BISA menulis data (lihat 6.3), tiap karyawan
sekarang punya **2 field role**, jangan pernah gabung jadi satu lagi:

| Field | Isi | Dipakai untuk |
|---|---|---|
| `role` | SELALU salah satu dari 5 nama baku (operator/pic/admin/owner/superuser) | Firestore Rules, custom claim (`syncRoleClaim` Cloud Function) — inilah gerbang keamanan SUNGGUHAN |
| `profil_akses` | Bebas — nama profil aslinya (bisa sama dengan role, bisa custom) | Cari izin tampilan (`window.cekIzinMenu`), lookup `akses_config` |

Tiap profil di `akses_config` (termasuk 5 yang baku) punya field
`tingkatKeamanan` — INI yang menentukan nilai `role` yang ditulis kalau
profil itu dipasangkan ke karyawan. Diatur lewat kartu "Tingkat Keamanan
Dasar" di Config Akses. **Kalau nulis ke `users/{email}` secara manual
dari kode manapun ke depan, WAJIB isi keduanya** — cari nilai
`tingkatKeamanan` dari `akses_config/{profil}`, jangan taruh nama profil
langsung ke field `role`.

Fungsi bantu `profilEfektif(d)` (Hak Akses) = `d.profil_akses || d.role`
— dipakai baca yang mana saja terisi, backward-compatible sama data lama.

### 6.3 Penerapan NYATA — client-side (Tahap 1 & 2, selesai)
`window.cekIzinMenu(menuId, jenis)` dan `window.cekFiturAkses(menuId,
fiturKey)` (keduanya di `auth.js`) — data-nya (`window.aksesConfigSaya`)
diambil SEKALI saat login berdasarkan `profil_akses`, bukan baca
Firestore tiap dicek.

**Aturan jatuh-aman**: kalau izin belum diatur (null), DIANGGAP BOLEH —
supaya tidak ada yang tiba-tiba terkunci keluar cuma karena Config Akses
belum lengkap untuk profil itu.

Sudah diterapkan di: Home mobile (visibilitas menu + kunci per-item),
Master Data (9 kategori sekaligus lewat `MasterDataCategory`), Daftar
Karyawan (Edit/Hapus), Config Absensi (Hapus Gudang/Shift), Antrean
Absensi (Accept/Reject/Hapus), Antrean Dakar (Setujui/Tolak).

**Belum diterapkan**: Penjadwalan, tombol Print/Export di manapun,
sidebar desktop (masih pakai gerbang role lama, bukan akses_config).

### 6.4 Kontrol granular per-field (`fiturList`)
Bukan cuma View/Add/Edit/Delete/Print — ada juga kunci SPESIFIK per
field/dropdown di dalam sebuah form. Contoh yang sudah jalan: dropdown
Jenis Lokasi di Master Gudang (`vue-config-absensi.js`), default
terkunci "Tetap" untuk Admin/PIC, Owner selalu bebas. Kalau ke depan
butuh kunci field lain yang serupa: daftarkan `fiturKey` baru di
`fiturList` menu terkait (`DAFTAR_MENU`, vue-config-akses.js), JANGAN
bikin mekanisme baru — panggil `window.cekFiturAkses(menuId, fiturKey)`
di titik yang mau dikunci.

### 6.5 Firestore Security Rules — KEPUTUSAN SADAR: tetap di level role
Diskusikan trade-off-nya dengan Hilman (17 Agt 2026 malam): opsi
"rules baca akses_config per-menu" DITOLAK karena nambah 1 baca
Firestore di HAMPIR SETIAP operasi tulis di seluruh app — biaya
berkelanjutan yang tidak sepadan. **Rules TETAP di 4 tingkat baku**
(`isAdminLevel()`, `isOwnerLevel()`, gratis, tidak baca dokumen
tambahan) — ini genap kenapa 6.2 (pemisahan role/profil_akses) krusial:
tanpa itu, profil kustom akan LOLOS tampilan tapi GAGAL setiap kali
coba menyimpan data (Rules tolak, karena nama profil kustom tidak ada
di daftar baku).

Kalau nanti mau tinjau ulang keputusan ini (misal butuh keamanan lebih
presisi per-menu), diskusikan dulu trade-off biayanya sebelum
implementasi — jangan asumsikan langsung "lebih detail = lebih baik".

### 6.6 Bersih-bersih terkait
"Status Pengguna (Role Akses)" di Config Karyawan Master Data **sudah
dihapus** (17 Agt 2026) — dulu daftar role terpisah yang tidak sinkron,
berisiko bentrok. Sekarang 1 sumber saja (`akses_config`).

### 6.7 PR — karyawan lama yang mungkin masih perlu disesuaikan
Kalau ada karyawan yang SEBELUM perbaikan 6.2 sempat dipasangkan ke
profil KUSTOM (jarang terjadi, karena fitur profil kustom + perbaikan
ini dibangun di sesi yang sama) — field `profil_akses`-nya mungkin
belum terisi. Solusinya: buka lagi lewat Hak Akses, pilih ulang
profilnya, simpan — otomatis dapat `role`+`profil_akses` yang benar.
Karyawan dengan role baku (operator/pic/admin/owner/superuser) TIDAK
terdampak sama sekali, tidak perlu tindakan apapun.

### 6.8 ATURAN TETAP (18 Agt 2026): menu BARU defaultnya Owner-only
**Permintaan eksplisit Hilman, WAJIB diikuti setiap kali menambah menu
baru ke depan** — jangan otomatis kasih akses ke role lain, biar Owner
yang atur manual lewat Config Akses/Hak Akses kalau memang mau dibagikan.

**Yang SUDAH diubah (otomatis)**: `bikinDefaultProfil()` di
`vue-config-akses.js` — dulu Superuser = Owner untuk SEMUA menu (ikut
`DAFTAR_MENU` apapun isinya, otomatis dapat menu baru). SEKARANG
daftar Superuser itu FIXED/snapshot (menu yang sudah ada per tanggal
ini) — menu baru TIDAK otomatis masuk situ lagi. **JANGAN tambahkan
menu baru ke daftar itu secara otomatis** kapanpun menambah menu —
biarkan kosong, biar Owner yang putuskan sendiri.

**Nuansa PENTING yang perlu dipahami** (supaya tidak salah kira "sudah
otomatis aman"): `bikinDefaultProfil()` itu CUMA memengaruhi checkbox
apa yang tampil TERCENTANG saat Owner PERTAMA KALI buka profil yang
BELUM PERNAH disimpan di Config Akses. Itu BUKAN gerbang keamanan
runtime. Gerbang sungguhan (`window.cekIzinMenu`, dipakai di seluruh
app) baca LANGSUNG dari `akses_config/{profil}` di Firestore — kalau
dokumen itu SUDAH PERNAH disimpan sebelumnya (dari sesi kerja
sebelumnya), field menu yang baru ditambahkan TIDAK ADA di situ, dan
sesuai prinsip "jatuh-aman" yang dipegang sejak awal (lihat 6.3),
menu yang belum diatur DIANGGAP BOLEH oleh sebagian besar komponen —
**bertentangan dengan maksud "Owner-only" ini**.

**Solusi praktis** (sampai ada cara yang lebih otomatis): setiap kali
ada menu baru ditambahkan, Owner perlu buka Config Akses → buka tiap
profil yang SUDAH ADA (pic, admin, superuser, profil kustom lain) →
klik "Update profil akses" (simpan ulang, walau menu barunya
dibiarkan tidak dicentang) — supaya menu baru itu TERCATAT EKSPLISIT
sebagai "tidak boleh" di Firestore untuk profil itu, bukan cuma
"belum diatur" (yang jatuh-amannya ke arah BOLEH, bukan TIDAK BOLEH).



## 7. Config Info, Pengumuman, Quote & Emoji Picker (17 Agt 2026)

### 7.1 Pengumuman
`js/vue-config-info.js` — kelola Pengumuman yang tampil di Home (desktop
& mobile). Bisa lampirkan gambar/video (maks 1MB, disimpan di **Firebase
Storage**, BUKAN base64 di Firestore — Firestore batas 1MB/dokumen,
base64 membengkakkan ~33%, jadi tidak muat). Ditampilkan rasio tetap
16:9 (`object-fit:cover`), proporsional otomatis di layar manapun tanpa
perlu upload 2 versi file berbeda.

Tiap pengumuman bisa diatur tampil untuk role tertentu saja (checkbox,
field `rolesTampil`, kosong = semua). Filternya dilakukan LOKAL di
`PengumumanCarousel` (vue-components.js) pakai `window.currentUser.role`
yang sudah ada di memori — bukan query `where()` baru ke server.

### 7.2 Quote Harian (Kotak 3, baru)
Beda konsep dari Pengumuman — koleksi Firestore TERPISAH (`quotes`), 1
quote tampil PER TANGGAL yang dijadwalkan di muka (field
`tanggalTampil`, format `YYYY-MM-DD`), bukan "N terbaru". Kalau tidak
ada quote dijadwalkan untuk hari ini, kartunya (`QuoteCard`,
vue-components.js) TIDAK render apapun — bukan kartu kosong.

Diatur di Config Info juga (section terpisah "Quote Harian"). Batas
karakter SENGAJA diberlakukan: **judul maks 20, isi maks 60** — supaya
muat rapi di kartu kecil (gradasi pink-ke-biru, gaya kartu "Giveaway").
Query-nya `where(tanggalTampil==hariIni), limit(1)` — paling murah, 0
atau 1 baca.

### 7.3 Emoji Picker
`EmojiPicker` (vue-components.js) — komponen bersama, tombol kecil +
popup grid emoji, emit karakter terpilih lewat `@pilih`. Dipasang di
judul+isi Pengumuman DAN judul+isi Quote (4 field total). Kalau nanti
butuh di field lain, tinggal pakai `<emoji-picker @pilih="targetRef += $event">`
— tidak perlu bikin mekanisme baru.

## 8. Antrean Lembur & pembatas jam kerja untuk penggajian (17 Agt 2026)

### 8.1 Antrean Lembur (menu baru, terpisah dari Antrean Absensi)
`js/vue-antrean-lembur.js` — dulu pengajuan Lembur TERCAMPUR di Antrean
Absensi, tapi tampilannya dirancang untuk absensi Hadir biasa (radius/
koordinat/seragam) — info yang PALING PENTING buat Lembur (jam mulai/
selesai diajukan, alasan, instruksi kerja) tidak kelihatan jelas.
Sekarang punya layar sendiri, field yang relevan, Approve/Reject sendiri.
`vue-antrean-absensi.js` sekarang MENGECUALIKAN dokumen berstatus
`"LEMBUR (CLOCK IN)"` — supaya tidak dobel tampil di 2 tempat.

### 8.2 Pembatas jam kerja untuk penggajian
`js/vue-camera.js`, fungsi `hitungJamKeluarUntukGaji()` — dipanggil
SAAT Clock Out. Tujuan: jam pulang TERLAMBAT dari jadwal shift TIDAK
otomatis dihitung sebagai jam kerja tambahan untuk gaji, KECUALI ada
pengajuan Lembur yang **sudah di-ACC** (lihat 8.1) untuk hari itu.

Contoh: shift 08:00–16:00, Clock Out jam 17:00 tanpa Lembur disetujui
→ yang dipakai gaji TETAP 16:00. Kalau ADA Lembur disetujui sampai jam
17:30 → yang dipakai gaji jadi 17:00 (jam Clock Out asli, karena masih
dalam batas lembur yang disetujui).

**Field disimpan DUA-DUANYA** — `waktu` (jam Clock Out ASLI, tidak
pernah diubah, buat transparansi/audit) dan `jam_keluar_untuk_gaji`
(jam yang sudah dibatasi). ⚠️ **Belum ada mesin Payroll sungguhan** yang
membaca field `jam_keluar_untuk_gaji` ini (Slip Gaji/Payroll masih
placeholder) — ini menyiapkan datanya duluan, siap dipakai kapanpun
fitur itu dibangun. Admin tetap bisa koreksi manual dari Antrean/Riwayat
Absensi kalau perhitungan otomatis meleset.

⚠️ **Perlu dicek saat testing**: query di `hitungJamKeluarUntukGaji()`
pakai 3 filter sekaligus (`email` + `status` + `status_acc`) — Firestore
MUNGKIN minta index khusus untuk kombinasi ini. Kalau muncul error
"index diperlukan" di Console, klik link yang Firestore berikan di
pesan error itu (otomatis bikinkan index-nya).

## 9. Prinsip hemat Firestore — WAJIB baca `PRINSIP-HEMAT.md`

Ringkasan super singkat (detail lengkap di file itu):
- Komponen admin **tidak mount sama sekali** sampai tab-nya benar-benar
  diklik (`window.pastikanMountXxx()`, dipanggil dari `pindahSubTab`/
  `pindahTab` di `dashboard.js`) — bukan cuma disembunyikan CSS.
- Paginasi Firestore SUNGGUHAN (`js/vue-paginasi.js`, composable bersama)
  untuk tabel yang datanya bisa banyak — sudah dipasang di Daftar
  Karyawan, BELUM di Antrean Dakar/Penjadwalan/Hak Akses (yang terakhir
  ini juga punya kartu ringkasan hitung total, butuh `getCountFromServer()`
  terpisah, belum dikerjakan).
- Riwayat Absensi pribadi (dipakai SEMUA karyawan) sudah query
  `where(email==...)`, bukan ambil semua lalu filter JS — ini yang paling
  penting sudah beres duluan karena dampaknya ke SEMUA orang.
- Riwayat All Absensi & Antrean Absensi (versi ADMIN, laporan/rekap)
  MASIH baca semua koleksi `absensi` — belum dioptimasi (butuh field
  tanggal format Firestore asli dulu, bukan cuma teks Indonesia, biar
  bisa query rentang tanggal di server).

## 10. Bug besar yang pernah terjadi & pelajarannya (baca kalau nav/klik terasa aneh)

1. **`window.xxx` langsung di template Vue itu TIDAK JALAN** — Vue
   anggap `window` properti komponen, bukan objek global browser. HARUS
   dibungkus fungsi biasa di `setup()` dulu, baru dipanggil dari
   template. Sudah kejadian 3x malam ini di file berbeda (vue-hak-akses,
   vue-penjadwalan, vue-profile-drawer, vue-account-profile) — kalau ada
   tombol yang "diam saja" padahal Vue, CEK INI DULU.
2. **`position:fixed` di dalam elemen yang punya animasi `transform` +
   `overflow:hidden`** — elemen fixed di dalamnya terlihat normal tapi
   area sentuhnya ikut terpotong. Nav bawah mobile sempat kena ini karena
   ada di dalam `#screen-dashboard` (yang punya `fade-in` + `overflow-
   hidden`) — solusinya pindahkan elemen fixed itu jadi SIBLING di luar,
   bukan child.
3. **Field Firestore yang "kadang ada kadang tidak"** (misal `status_acc`
   cuma keisi SAAT admin approve, bukan saat data dibuat) — bikin query
   `where()` yang kelihatannya benar justru MENYEMBUNYIKAN data yang
   belum diproses. Selalu cek dulu field itu KONSISTEN diisi di titik
   PENULISAN data, sebelum bikin query berdasarkan field itu.
4. **Auth/`window.currentUser` timing** — kalau sebuah komponen baca
   `window.currentUser` SEBELUM data user asli terisi (baru login/reload),
   dapat data kosong/fallback. Selalu `await window.authReady` di
   `onMounted`, DAN untuk layar yang harus fresh SEGERA setelah login
   (seperti Home), tambahkan pemanggilan `window.refreshXxx()` eksplisit
   di titik SETELAH `window.currentUser` dipastikan terisi (lihat
   `auth.js`/`vue-login.js`, cari `refreshHome`).

   ⚠️ **PENTING, dikoreksi 23 Agt 2026 (lihat §19.2 untuk kronologi
   lengkap)**: `window.authReady` **BUKAN** sinyal "window.currentUser
   sudah lengkap terisi data Firestore" — itu cuma sinyal "Firebase AUTH
   sudah tau siapa yang login" (dua hal beda!). Yang BENAR-BENAR mengisi
   `window.currentUser` dengan data profil Firestore adalah proses
   TERPISAH & ASYNC (sesi-otomatis di `auth.js` / login manual di
   `vue-login.js`), yang baru memanggil jembatan `window.refreshXxx()`
   SETELAH selesai. Jadi pola yang BENAR itu **BUKAN** "`await
   window.authReady` lalu baca `window.currentUser`" — yang benar:
   pasang logic baca-nya di jembatan `window.refreshXxx()` itu sendiri
   (dipanggil dari `auth.js` baris ~516 & `vue-login.js`), BUKAN di
   `onMounted` manapun. Contoh kasus nyata yang sempat salah didiagnosis
   karena ini: §19.2 (badge PIN) — percobaan fix PERTAMA (taruh
   pemanggilan ulang setelah `await window.authReady` di `onMounted`)
   TERBUKTI TIDAK CUKUP, baru ketahuan setelah Hilman tes ulang & tanya
   "apakah karena tidak ada pengecekan ke Firestore?" — pertanyaan itu
   yang membongkar root cause sebenarnya.

## 11. Yang belum dikerjakan (kalau lanjut sesi baru, ini kandidat berikutnya)

- Paginasi + `getCountFromServer()` untuk Hak Akses, Antrean Dakar,
  Penjadwalan.
- ~~Field tanggal Firestore asli untuk Riwayat All Absensi~~ — **SELESAI
  18 Agt 2026** (`waktu_ts`, lihat `PRINSIP-HEMAT.md`). Yang MASIH
  belum: Riwayat All Absensi sendiri BELUM pakai `waktu_ts` ini untuk
  filter rentang tanggal di server (`muat()`-nya masih `getDocs` ambil
  semua) — field-nya sudah siap, tinggal query-nya yang perlu diubah
  (dan UI filter tanggal ditambahkan) kalau mau benar-benar hemat.
- Penerapan izin Config Akses (View/Add/Edit/Delete/Print) — SUDAH jalan
  nyata di client-side untuk sebagian layar (lihat 6.3 buat daftar
  lengkap mana yang sudah/belum). Security Rules SENGAJA tetap di level
  role baku, bukan per-menu (keputusan sadar soal biaya, lihat 6.5).
- Halaman "Progress" (mobile) — masih placeholder, nunggu skema data
  produksi/SPK dirancang.
- "Scan QR" bisa baca kode QR sungguhan, tapi belum ada yang MEMPROSES
  hasilnya (belum nyambung ke alur kerja apapun).
- Slip Gaji, Payroll, Estimasi Gaji — semua masih placeholder "segera hadir".
- ~~**Navigasi back button HP** (baru, lihat §19.4) — SPA ini belum pakai
  Browser History API sama sekali, jadi tombol back HP langsung keluar
  app alih-alih kembali ke tab/sub-tab internal sebelumnya.~~ — **SUDAH
  DIPERBAIKI 23 Agt 2026** (level tab, lihat §19.4) — dikonfirmasi
  Hilman via testing ("selesai"). Sub-tab, transisi layar (login/kamera/
  buat-password), dan drawer Profile SENGAJA belum masuk cakupan fix ini
  (lihat §19.4 buat rincian & alasannya) — masih kandidat lanjutan kalau
  dibutuhkan.

**Soal fondasi kerja (bukan fitur, cara kerja) — belum jadi masalah di
skala sekarang, tapi relevan kalau nanti dipakai ratusan orang:**
- Belum ada testing otomatis — semua perubahan diverifikasi manual
  (screenshot, cek Console). Risiko "perbaiki A, rusak B tanpa ketahuan"
  makin besar seiring fitur bertambah.
- Belum ada lingkungan staging — semua perubahan langsung ke
  `gechoo.online`, langsung dipakai semua orang begitu di-deploy.
- Belum ada pemantauan error produksi — bug yang cuma muncul di
  perangkat orang lain (bukan yang sedang testing) tidak akan ketahuan
  kecuali dilaporkan manual.

## 12. Registrasi -> Login revisi ke-3: password dibuat karyawan sendiri (18 Agt 2026)

**Kenapa dirombak lagi**: supaya karyawan pilih password sendiri sejak
awal (bukan dipaksa pakai NIK sebagai password sementara lalu wajib
ganti login pertama). Alur token verifikasi lewat TULIS (pola sama
persis `otp_email`) — jangan pernah baca `pendaftaran_pending` langsung
tanpa verifikasi token dulu, lihat `firestore.rules`.

1. **Registrasi** (`vue-registrasi.js`) — TIDAK berubah dari revisi
   sebelumnya: 3 tahap, tanpa password, simpan ke `pendaftaran_pending`.
2. **Antrean Dakar** (`vue-antrean-dakar.js`) — "Setujui" SEKARANG cuma
   generate token acak (`token_buat_password`, `token_kadaluarsa` 30
   menit dari `MASA_BERLAKU_MENIT`) + kirim EMAIL link, BUKAN bikin akun
   langsung. Status "Menunggu Buat Password" (badge kuning) muncul
   sampai karyawan klik link atau kadaluarsa (badge merah) — di kedua
   kondisi itu tombolnya jadi **Assign Ulang** (generate token baru,
   kirim ulang) + **Tolak** (aman, akun Auth belum pernah dibuat).
   **Instance Firebase kedua (`buatAkunTanpaGangguSesi`) SUDAH DIHAPUS**
   — tidak relevan lagi karena yang bikin akun sekarang karyawan sendiri
   (belum login sebagai siapapun), bukan Admin.
3. **Buat Password** (`js/vue-buat-password.js`, layar BARU) — dibuka
   lewat link email (`?buatpassword=1&email=...&token=...`, dideteksi di
   `auth.js` PALING AWAL sebelum logic sesi-otomatis lain jalan, lewat
   `window._modeBuatPassword`). Verifikasi token lewat TULIS
   `tebakan_token` ke `pendaftaran_pending` (persis pola `otp_email`) —
   kalau cocok & belum kadaluarsa, `token_terverifikasi:true` otomatis
   ke-set, BARU boleh baca email/nama/HP (read-only) buat ditampilkan.
   Isi Password+Konfirmasi -> `createUserWithEmailAndPassword` (TANPA
   instance kedua) -> tulis `users/{email}` (field `token_*` dibuang,
   TIDAK ikut ke profil final) -> hapus `pendaftaran_pending` SENDIRI ->
   sign-out -> arahkan ke Login biasa (supaya login pertama tetap lewat
   SATU jalur yang sama, termasuk cek device baru).
4. **Login** (`vue-login.js`) — modal **wajib ganti password DIHAPUS**
   total (sudah tidak relevan). Urutan sekarang cuma: cek device baru
   (OTP email kalau perlu) -> langsung alur normal.

**✅ SUDAH DITES END-TO-END PENUH (dikonfirmasi Hilman, 23 Agt 2026:
"done aman")** — alur daftar → OTP → Antrean Dakar Setujui → klik link
email → Buat Password → login berjalan lancar di dunia nyata. Baris PR
"belum pernah dites" di atas SUDAH TIDAK BERLAKU, ditinggalkan apa
adanya di sini sebagai riwayat, jangan dianggap status terkini.

## 13. Filter otomatis Jenis Pekerjaan di Penjadwalan & Antrean Dakar (18 Agt 2026)

**Tujuan**: Admin yang login cuma urus jenis pekerjaan yang sama dengan
profilnya sendiri — otomatis, tanpa pilih filter manual, DAN hemat baca
Firestore (bukan baca semua lalu filter tampilan, tapi filter di JS
setelah 1x baca per koleksi, sebelum dirender).

**Helper bersama**: `window.bolehLihatJenisPekerjaan(jenisPekerjaanData)`
(`auth.js`, dekat `window.cekIzinMenu`). Aturan:
- **Owner/Superuser SELALU lolos** (`role() bypass`, TIDAK PERNAH
  difilter) — sama seperti bypass Config Akses yang sudah ada.
- **Jatuh-aman**: kalau `jenisPekerjaanData` KOSONG/BELUM ADA (data
  lama yang belum sempat ditag), dianggap BOLEH TAMPIL ke SEMUA Admin —
  supaya data lama tidak tiba-tiba hilang dari pandangan siapapun cuma
  karena belum sempat ditag. Sama prinsipnya dengan aturan jatuh-aman di
  §6.3 (Config Akses).
- Dipakai buat 2 bentuk data: string tunggal (karyawan, field
  `jenis_pekerjaan`) MAUPUN array (gudang/shift, field yang SAMA namanya
  `jenis_pekerjaan`, karena 1 gudang/shift bisa dipakai lebih dari 1
  jenis pekerjaan).

**Diterapkan di:**
- `vue-penjadwalan.js` — daftar karyawan, dropdown Gudang, dropdown
  Shift, ketiganya difilter sesuai `window.currentUser.jenis_pekerjaan`
  Admin yang login.
- `vue-antrean-dakar.js` — daftar antrean pendaftaran (`pendaftaran_pending`)
  DAN dropdown Jadwal Shift di kartu approve, keduanya difilter sama.
- Catatan transparansi ("Cuma nampilin jenis pekerjaan yang sama dengan
  profil Anda") ditampilkan di kedua halaman itu kalau bukan Owner/
  Superuser — lewat `computed` di `setup()`, **BUKAN** `window.xxx`
  langsung di template (lihat §10.1, jangan ulangi bug itu).

**`master_gudang` & `master_shift` sekarang punya field baru**
`jenis_pekerjaan` (array, opsional) — diisi lewat Config Absensi (lihat
§14). Data LAMA yang belum ditag TETAP tampil ke semua Admin (jatuh-aman
di atas), sampai Owner/Admin sempat tag manual.

## 14. Config Absensi jadi 3 sub-tab, hemat baca Master Gudang/Shift (18 Agt 2026)

**Sebelumnya**: Master Gudang & Master Shift tampil BARENGAN begitu
Config Absensi dibuka (2 kartu sebelahan) — jadi KEDUA koleksi kebaca
sekaligus walau orangnya cuma mau lihat salah satu.

**Sekarang** (`vue-config-absensi.js`): dipecah jadi 3 sub-tab (Master
Gudang / Master Shift / **Jenis Pekerjaan**, BARU) — tiap koleksi CUMA
dibaca begitu sub-tabnya BENAR-BENAR dibuka pertama kali. Pola render:
`v-if="dibukaSekali.xxx"` (mount SEKALI, pertama kali dibuka) digabung
`v-show="tabAktif==='xxx'"` (pindah-pindah SETELAH itu TANPA fetch
ulang) — bukan `v-if` polos (itu akan fetch ulang tiap pindah balik).

Sub-tab **Jenis Pekerjaan** PAKAI ULANG komponen bersama
`MasterDataCategory` (`vue-components.js`, sama yang dipakai 9 kategori
Master Data lain di Config Karyawan) — bukan komponen baru. Komponen itu
ditambah prop **`menuId`** (default `'config_karyawan'`, backward-
compatible — 9 pemakaian lama TIDAK berubah sama sekali) supaya
pemakaian baru ini bisa kirim `menu-id="config_absensi"`, biar izinnya
dicek ke menu yang benar, bukan ketiban 'config_karyawan'.

**Master Gudang & Master Shift** — form tambah data baru sekarang punya
checkbox multi-pilih Jenis Pekerjaan (array, dari `master_data/jenis_pekerjaan`).
Data yang SUDAH ADA sebelumnya (dibuat sebelum fitur ini) bisa di-tag
belakangan lewat tombol ikon <i class="fas fa-tags"></i> di tiap baris —
buka form checkbox inline, pilih, Simpan (`updateDoc`, cuma field
`jenis_pekerjaan` yang berubah, field lain tidak tersentuh).

## 15. PEDOMAN KERJA: filter role+jenis_pekerjaan+gudang jadi 1 sistem reusable (18 Agt 2026)

**Kenapa dirombak jadi sistem, bukan tempel manual per tabel**: §13
awalnya nambah `window.bolehLihatJenisPekerjaan()` dan dipakai manual di
2 file. Setelah diminta tambah dimensi GUDANG juga dan diterapkan ke
"semua tabel", pola tempel-manual itu tidak scalable — jadi dirombak
jadi 1 sistem dipakai lewat OPSI, bukan ditulis ulang tiap file.

### Tier 1 — tabel yang MASIH fetch-semua (client-side filter)
Pakai **`window.bolehLihatData(jenisPekerjaanData, gudangData)`**
(`auth.js`) — Owner/Superuser bypass, PUNYA jatuh-aman (data belum ditag
tetap tampil ke semua Admin). Panggil manual di titik `.forEach()` yang
membangun list, SEBELUM `list.push(...)`.

**Sudah diterapkan**: `vue-hak-akses.js`, `vue-riwayat-absensi.js`,
`vue-antrean-absensi.js`, `vue-antrean-lembur.js`, `vue-antrean-dakar.js`
(daftar pending + dropdown shift), `vue-penjadwalan.js` (daftar
karyawan + dropdown gudang/shift), `vue-config-absensi.js` (daftar
Master Gudang & Master Shift yang ditampilkan).

⚠️ **Jebakan yang sudah pernah kejadian**: kalau ada logic "perbaikan
data lama" (`perluDiperbaiki`, dst) di tabel yang sama, filter INI WAJIB
dipasang SETELAH logic perbaikan itu, bukan sebelum — kalau salah
urutan, dokumen yang kefilter keluar tidak akan pernah diperbaiki
(kejadian nyata di `vue-antrean-absensi.js`/`vue-antrean-lembur.js` saat
dikerjakan, ketahuan & diperbaiki sebelum dikirim).

`absensi` **TIDAK** simpan `jenis_pekerjaan` langsung (cuma `gudang`) —
tabel yang sumbernya `absensi` (Riwayat/Antrean Absensi/Lembur) WAJIB
fetch `users` dulu buat bangun peta `email -> jenis_pekerjaan` (1 baca
tambahan per buka halaman, tidak terhindarkan).

### Tier 2 — tabel yang pakai paginasi cursor Firestore sungguhan
Pakai opsi **`filterPeran: true`** di `usePaginasiFirestore()`
(`vue-paginasi.js`) — filter jalan lewat `where()` Firestore beneran
(server-side), BUKAN client-side. Cukup 1 baris opsi, TIDAK PERLU tulis
`where()` manual:
```js
const paginasi = reactive(usePaginasiFirestore(db, 'users', {
  perHalaman: 15, urutkanField: 'nama',
  filterPeran: true,   // <- cukup ini
  petakan: (id, d) => ({ id, ...d })
}));
```
Field custom (kalau nama field beda dari default `jenis_pekerjaan`/
`gudang_penempatan`, atau koleksinya tidak punya dimensi gudang sama
sekali seperti `master_shift`): `filterPeranField: { fieldGudang: null }`.

⚠️ **BEDA PENTING dari Tier 1**: `where()` Firestore **TIDAK PUNYA
jatuh-aman**. Karyawan/gudang lama yang belum ditag `jenis_pekerjaan`/
`gudang_penempatan` **TIDAK AKAN MUNCUL** di tabel Tier 2 buat Admin
non-Owner, sampai ditag. Trade-off SADAR, diterima demi paginasi cursor
tetap benar (filter di JS SETELAH ambil per halaman akan merusak
hitungan "ada halaman berikutnya").

Kemungkinan besar Firestore minta **index gabungan baru** pertama kali
`filterPeran:true` dipakai di koleksi tertentu — errornya muncul di
Console browser lengkap link bikin index sekali klik, itu wajar bukan
bug.

**Sudah diterapkan**: `vue-daftar-karyawan.js` (satu-satunya tabel yang
sudah paginasi cursor sungguhan sampai saat ini).

### Tier 3 — TIDAK bisa langsung dikonversi ke Tier 2 (butuh desain ulang dulu)
`vue-hak-akses.js` dan `vue-penjadwalan.js` punya fitur **Ringkasan**
(kartu jumlah per-role/per-gudang, dihitung dari SELURUH data) dan
**Pilih Semua/Update Massal** (beroperasi ke SEMUA hasil filter, bukan
cuma halaman yang sedang tampil) — dua fitur ini BUTUH seluruh dataset
ke-load di JS. Dipaksa jadi cursor pagination akan DIAM-DIAM MERUSAK
keduanya (kartu cuma hitung 15 baris yang kebaca; "Pilih Semua" cuma
pilih 1 halaman). Kalau nanti mau dikonversi, perlu desain terpisah
(`getCountFromServer()` dengan `where()` beda per kartu ringkasan) —
BUKAN sekadar tukar `getDocs` jadi `usePaginasiFirestore`. Untuk
sekarang keduanya tetap di Tier 1 (`window.bolehLihatData`, sudah
diterapkan).

### PEDOMAN buat tabel BARU ke depan
1. Tidak ada fitur ringkasan/pilih-semua-lintas-halaman? -> **Tier 2**
   langsung (`filterPeran: true`), jangan mulai dari fetch-semua.
2. ADA fitur ringkasan/pilih-semua-lintas-halaman? -> **Tier 1**
   (`window.bolehLihatData`) dulu, evaluasi Tier 2 belakangan kalau data
   sudah besar SEKALIGUS ada waktu desain ulang fitur ringkasannya.
3. Ini berlaku default utk SEMUA tabel yang nampilin data karyawan/
   gudang/shift, KECUALI Owner/Superuser — sama seperti aturan "menu
   baru default Owner-only" di §6.8, JANGAN dianggap opsional.

## 16. PEDOMAN KERJA: search box + filter manual khusus Owner (18 Agt 2026)

**Kenapa perlu, padahal sudah ada §15**: §15 (`window.bolehLihatData`)
otomatis nyaring Admin biasa ke 1 jenis pekerjaan + gudang sendiri —
tapi Owner/Superuser SELALU bypass (lihat semua data tanpa kecuali).
Kalau datanya banyak, Owner bisa "kebanjiran" tanpa cara menyaring.
Solusinya BUKAN ikut kena filter otomatis (Owner memang harus tetap
bisa lihat semua) — Owner dikasih **kendali MANUAL** buat nyaring
sendiri kalau perlu, beda kebutuhan dari Admin biasa.

**Pola baku** (diterapkan pertama di `vue-antrean-absensi.js`, WAJIB
dicontek sama persis di tabel/kartu-grid lain):
- **Search box** — SELALU ada buat semua role, cari berdasarkan nama.
- **Filter Jenis Pekerjaan** & **Filter Gudang** (dropdown) — CUMA
  render (`v-if="isOwnerRole"`) buat Owner/Superuser. Admin biasa TIDAK
  PERNAH lihat dropdown ini sama sekali (redundan, sudah otomatis
  kefilter lewat §15).
- Opsi dropdown Gudang dari `master_gudang`, opsi Jenis Pekerjaan dari
  `window.ambilMasterList('jenis_pekerjaan')` — CUMA dimuat kalau
  `isOwnerRole` true (hemat, Admin biasa tidak pernah butuh).
- Filtering CLIENT-SIDE (bukan `where()` Firestore) — konsisten dengan
  prinsip "antrean seharusnya kecil" di §13 (Antrean/queue BUKAN tabel
  besar yang tumbuh terus, hemat-nya dari query pending-only, bukan
  paginasi/filter server tambahan).
- Setiap item di list WAJIB dilampiri `jenisPekerjaan` (dari peta
  email->jenis_pekerjaan yang sudah dibangun buat §15) supaya filter
  Owner bisa jalan TANPA baca tambahan — data yang sama dipakai ulang,
  bukan fetch baru.
- Kalau hasil filter/cari kosong TAPI `daftarPending` aslinya TIDAK
  kosong, WAJIB pesan BEDA ("Tidak ada yang cocok" bukan "Semua sudah
  tervalidasi") — supaya Owner tidak salah paham antrean-nya benar-benar
  kosong.

## 17. PEDOMAN KERJA: search box + paginasi WAJIB tiap menu baru, filter WAJIB tanya dulu (19 Agt 2026)

Aturan baku permanen dari Hilman, berlaku ke SEMUA menu baru ke depan
tanpa kecuali:

1. **Search box** — WAJIB ada di tiap menu baru yang nampilin daftar/
   tabel data (kecuali memang cuma 1-2 baris yang mustahil butuh cari).
2. **Paginasi** — WAJIB ada di tiap menu baru yang nampilin daftar/tabel
   data. Untuk koleksi kecil (kategori, kendaraan, dsb) cukup PAGINASI
   TAMPILAN client-side (potong array yang sudah difetch, pola
   `PER_HALAMAN`/`halamanSaatIni`/computed slice — SAMA persis dengan
   yang sudah dipakai di Riwayat All Absensi, Master Kendaraan, Riwayat
   Reimburse/Bensin/Servis). TIDAK WAJIB cursor Firestore sungguhan
   kecuali datanya memang sudah/berpotensi besar (baru dipertimbangkan
   Tier 2 kalau itu terjadi).
3. **Filter** (dropdown tambahan di luar search+paginasi) — **WAJIB
   TANYA Hilman dulu** sebelum ditambahkan, JANGAN diputuskan sendiri.
   Ini beda dari search+paginasi yang otomatis wajib tanpa perlu
   ditanya — filter itu soal *apa yang relevan buat pekerjaan
   sehari-hari*, itu Hilman yang paling tahu, bukan diasumsikan dari
   pola tabel lain.

**Kenapa aturan ini dibuat**: 3 halaman baru (Master Kendaraan, Riwayat
Reimburse, Riwayat Bensin/Servis) sempat dikirim TANPA paginasi sama
sekali — Hilman minta dibetulkan dan dijadikan aturan permanen supaya
tidak kejadian lagi ke tabel-tabel baru berikutnya.

## 18. Absensi Melalui QR — HP Kiosk gudang (22-23 Agt 2026)

**Tujuan**: karyawan tanpa HP/HP rusak tetap bisa absen — HP/tablet
Kiosk digantung tetap di gudang, karyawan scan barcode-nya sendiri +
PIN buat verifikasi, lalu lanjut foto selfie/gudang/radius SAMA PERSIS
seperti alur Clock In biasa (bukan alur baru terpisah).

### 18.1 PIN karyawan (`vue-account-profile.js`, tab Keamanan)
Tab Keamanan dipecah 2 sub-tab: **Password** + **PIN** (badge
"Terpasang"/"Belum"). PIN 6 digit, wajib re-auth password, disimpan
`pin_hash` (SHA-256 + salt email pemilik, Web Crypto API bawaan
browser). PIN ini BEDA TOTAL dari login akun Kiosk (yang tetap
email+password Firebase Auth biasa) — PIN cuma verifikasi identitas
KARYAWAN yang di-scan.

✅ **Bug badge status SUDAH DIPERBAIKI, lihat §19.2** — root cause AWAL
salah duga (percobaan pertama TIDAK CUKUP), sudah dikoreksi ke root
cause yang benar.

### 18.2 Device Kiosk (menu baru, Master Integrasi, Owner-only)
`vue-device-kiosk.js` — Owner bikin akun Kiosk (Nama Device, Email,
Password, Gudang bisa >1). **Role TETAP `operator`** (nilai baku,
WAJIB — §6.2), penanda kiosk di field TERPISAH `jenis_akun: 'kiosk'`.
Bikin akun pakai instance Firebase KEDUA (pola `buatAkunTanpaGangguSesi`,
§3.5.2). Nonaktifkan kiosk = toggle `status_kerja`, REUSE gerbang login.

⚠️ **Ada laporan bug tabel tidak tampilkan device multi-gudang, status
OPEN, lihat §19.3.**

### 18.3 Alur "Absensi Melalui QR" (`vue-login.js` + `vue-absensi-qr.js`)
Login (mobile only, toggle mode) → validasi silang (akun bukan Kiosk
ditolak) → SKIP semua gerbang Clock In/gudang/jam kerja buat Kiosk →
**terkunci** di `screen-absensi-qr` (dicek di 2 tempat: login manual
DAN `onAuthStateChanged` buat refresh) → menu 5 pilihan → scan QR
(`jsQR`, timeout 7 detik) → cari karyawan via `id_app`/`email` →
keypad PIN (maks 3 percobaan) → **DELEGASI PENUH ke `screen-camera`**
yang SUDAH ADA (foto, gudang, radius, tulis Firestore — TIDAK dibangun
ulang, cuma `window.currentUser` di-timpa sementara) → kartu sukses
besar (foto+nama+shift+jam, auto-tutup 3 detik) → balik ke menu, siap
buat orang berikutnya. Logout eksplisit (bukan cuma pindah layar) buat
keluar dari mode terkunci.

### 18.4 Daftar LENGKAP bug yang ditemukan + pelajarannya (sesi ini bukti nyata KENAPA §1 pedoman kerja "cek dulu, jangan mikir dulu" itu penting)

1. **`role:'kiosk'` sempat dipakai** — bertentangan dengan §6.2 (role
   WAJIB 5 nama baku). Ketahuan SEBELUM produksi, diperbaiki jadi
   `role:'operator'` + `jenis_akun:'kiosk'` (field terpisah, dicek via
   `isKiosk()`/`get()` bukan custom claim).
2. **Firestore Rules akses field LANGSUNG** (`resource.data.status_approval`
   dst) **melempar error** kalau field itu tidak ada di dokumen (bukan
   `null`) — akun LAMA (termasuk Owner sendiri) gagal update APAPUN
   secara diam-diam (offline persistence bikin kelihatan sukses di HP,
   baru rollback pas sinkron ulang). Perbaikan: pakai `.get(field, default)`.
3. **Query `where()` dengan syarat baca bergantung `resource.data`**
   (`gudang_penempatan.hasAny(...)`) bikin Firestore MENOLAK SELURUH
   QUERY (bukan cuma saring hasil) — Firestore tidak bisa buktikan di
   muka semua kemungkinan hasil pasti lolos syarat itu. Disederhanakan
   jadi `isKiosk()` saja (tidak bergantung resource.data).
4. **§17 (search+paginasi wajib) sempat kelewat** di Device Kiosk
   waktu pertama dibangun — diperbaiki pakai pola Master Kendaraan.
5. **`vue-device-kiosk.js` mount LANGSUNG** (bukan lewat
   `pastikanMountXxx()` seperti semua layar admin lain) — melanggar
   pola hemat, kemungkinan race condition. Diperbaiki jadi lazy-mount,
   didaftarkan di `dashboard.js` `pindahTab`.
6. **Query berfilter (`where jenis_akun=='kiosk'`) ke collection
   `users`** — collection ini punya aturan baca lebih rumit dari
   collection sederhana (`master_kendaraan`, `allow read: if login();`)
   — ternyata BERPOTENSI bikin masalah serupa poin #3. Diperbaiki jadi
   BACA SEMUA collection `users` (tanpa filter query), saring
   `jenis_akun` di JavaScript — PERSIS pola `MasterKendaraanManager.muat()`.
7. **`daftarKioskTersaring` dipakai di template TAPI TIDAK di-`return{}`**
   — bug ketik murni, bikin Vue warning + `Cannot read properties of
   undefined` DIAM-DIAM (React DevTools/Vue warning cuma kelihatan di
   Console, tidak ada alert). **Ini akar masalah SEBENARNYA dari
   laporan "tabel tidak tampil" yang berkali-kali salah didiagnosis**
   (sempat dikira: GPS timeout, Firestore list-query issue, mount
   timing) — SEMUA teori itu salah arah, terbukti keliru begitu
   screenshot Console diminta dan dibaca.
8. **`id_app` kosong ditimpa jadi literal string `"N/A"`** (bukan
   kosong/falsy) di `auth.js`/`vue-login.js` — generator QR
   (`vue-account-profile.js`) salah anggap "N/A" itu ID valid, QR jadi
   isinya literal teks "N/A" (tidak bisa ditemukan manapun saat
   di-scan). Kena SPESIFIK ke Owner (akun manual, `id_app` sering
   belum diisi). Diperbaiki: kecualikan literal "N/A" sebelum fallback
   ke email.
9. **Gudang dipilih dari karyawan yang di-scan APA ADANYA** (bukan
   diirisan dengan gudang milik Kiosk) — Owner (biasa punya
   banyak/beda gudang) gudang pertamanya sering BUKAN gudang yang sama
   dengan Kiosk, Firestore Rules tolak tulis absensi diam-diam.
   Diperbaiki: hitung irisan gudang karyawan × gudang Kiosk dulu.
10. **`simpanKeFirebase()` (vue-camera.js) gagal DIAM-DIAM** — catch
    block cuma `console.error`, TIDAK ADA `alert()` ke user sama
    sekali. Bug LAMA (bukan buatan sesi ini), baru ketahuan lewat
    fitur Kiosk. Diperbaiki: selalu ada pesan jelas kalau gagal.
11. **Submit sukses langsung reset diam-diam** (`selesaiModeKiosk()`)
    tanpa feedback apapun ke orang yang baru absen — laporan "kirim
    pengajuan tidak ada respon". Diperbaiki: kartu sukses besar dulu
    (3 detik), baru reset.
12. **Browser autofill mengisi field Email Kiosk pakai kredensial
    LOGIN TERSIMPAN** (email Owner sendiri) — form "email+password
    berdampingan" dikenali browser sebagai form login biasa. Bikin
    `createUserWithEmailAndPassword` SELALU gagal (email sudah
    dipakai). Diperbaiki: `autocomplete="off"`/`"new-password"` +
    nama field tidak lazim.
13. **`GudangCheckboxSelect` (komponen BERSAMA) tidak auto-tutup**
    begitu klik di luar — overlay-nya berpotensi menangkap klik yang
    seharusnya ke elemen lain di baliknya (misal tombol submit).
    Diperbaiki di level komponen (berlaku ke SEMUA pemakaiannya, bukan
    cuma Device Kiosk).

**Pelajaran paling penting dari daftar ini**: poin #7 butuh SATU
screenshot Console buat ketahuan, setelah BERKALI-KALI teori salah
(poin lain di atas SEMPAT dikira jadi penyebabnya juga, padahal
tidak). **Minta bukti Console DI PERCOBAAN PERTAMA**, bukan setelah
menebak berkali-kali — pelajaran ini sudah masuk `PEDOMAN-GAYA-KERJA.md`.
**Pelajaran BARU serupa dari §19.2**: root cause "masuk akal" pertama
(soal urutan `authReady`) TERNYATA masih salah — kalau fix pertama
tidak menyelesaikan gejalanya, JANGAN puas dengan penjelasan yang
"kedengarannya benar", telusuri lagi sampai ketemu titik PASTI yang
mengisi datanya (di sini: jembatan `window.refreshXxx()`, bukan
`onMounted`/`authReady`).

### 18.5 Cara verifikasi deploy yang TERBUKTI bisa dipercaya
`raw.githubusercontent.com` bisa kasih hasil CDN BASI walau file di
repo sudah benar (dicoba cache-busting query string pun tidak
membantu). **`codeload.github.com`** (download tarball penuh via
bash) TERBUKTI selalu akurat — dipakai berkali-kali sesi ini buat
verifikasi isi repo sungguhan sebelum menuduh "belum di-deploy".

⚠️ **UPDATE 23 Agt 2026 — lihat §19.0**: metode di atas TERNYATA juga
bisa gagal (sesi Claude BERBEDA sempat dapat hasil basi dari sinkronisasi
Project sendiri, bukan dari GitHub langsung). Cara paling andal yang
DITEMUKAN & DIKONFIRMASI 23 Agt 2026: `git clone` langsung repo-nya
(bukan cuma fetch 1 file) — baca §19.0 sebelum percaya cara mana pun
di sini secara membabi buta.

### 18.6 PR — belum sempat dikerjakan
- **BELUM DITES END-TO-END PENUH** (banyak bug ditemukan satu-satu
  lewat proses testing manual Hilman) — perlu 1 putaran tes lengkap
  lagi dari nol setelah SEMUA perbaikan di atas ter-upload.
- `vue-antrean-absensi.js` (kartu approval) belum disesuaikan buat
  kasus TANPA foto (kalau suatu saat submisi Kiosk tanpa selfie
  diperlukan lagi — SAAT INI foto TETAP diambil, sama seperti alur
  biasa, jadi ini belum jadi masalah nyata).
- Tidak ada penanda di dokumen `absensi` buat bedakan "diajukan lewat
  Kiosk" vs "lewat HP sendiri" (audit trail) — dipertimbangkan kalau
  dibutuhkan ke depan.
- GitHub Codespaces (kalau dipakai) punya jam bulanan terbatas — disarankan
  pakai `github.dev` (editor browser gratis tanpa batas jam, tidak
  menyalakan mesin virtual) buat kerja rutin edit+commit+push.

## 19. Update 23 Agt 2026 — konfirmasi §12 aman, bug Kiosk (PIN badge — FIXED, tabel Device Kiosk — OPEN), gap navigasi back button — FIXED & DIKONFIRMASI, bug Clock In dobel + badge salah — FIXED & DIKONFIRMASI ("done mantap"), QR Profile mobile + menu Absensi QR 4 tombol + redirect Kiosk — FIXED (§19.6, menunggu tes Hilman), Clock Out dobel (dokumen zombie) — FIXED (§19.7, menunggu tes Hilman), PIN Kiosk 2x + kartu sukses foto diperbesar — FIXED (§19.8, menunggu tes Hilman)

### 19.0 Metode verifikasi kode live yang PALING andal — `git clone`, bukan cuma WebFetch 1 file
Ditemukan sesi ini: `project_search`/knowledge Project bisa BASI (contoh
nyata: sesi sebelumnya sempat laporkan beberapa "bug" yang TERNYATA
SEMUA salah/basi, lihat retraksi di riwayat chat — Config Absensi
dikira 2 panel padahal sudah 3 sub-tab, dikira `filterPeran:true` belum
dipasang padahal sudah, dst). `WebFetch` ke `github.com/.../blob/main/`
JUGA kadang cuma balikin RINGKASAN (bukan isi mentah file) tergantung
prompt yang dipakai — tidak selalu bisa dipercaya buat baca kode
baris-per-baris.

**Cara PALING andal yang dipakai buat investigasi di bawah ini**:
`git clone --depth 1 https://github.com/gechooco-ship-it/zevanic-erp-ui.git`
lewat Bash (proxy git di lingkungan Claude ini sudah punya token akses
baca ke repo publik ini secara otomatis) — dapat SEMUA file mentah asli,
bisa `grep`/`Read` langsung, dan pasti bukan hasil ringkasan/basi.
**Jadikan metode ini yang PERTAMA dicoba** untuk sesi berikutnya kalau
perlu baca kode sungguhan, sebelum WebFetch/project_search. Dipakai
berulang kali sepanjang investigasi §19 ini (commit yang diverifikasi
berubah seiring Hilman push fix: `f8e45d5` di awal investigasi, lalu
`9560077` "bug pin" setelah Hilman menerapkan fix pertama, lalu
`01b020c9` "bug pin2" setelah fix yang dikoreksi, lalu commit berisi
fix `dashboard.js` untuk back button — §19.4).

**Cara Claude mengirim FIX ke Hilman (karena sesi ini tidak punya akses
push langsung ke repo)**: edit file di clone lokal, verifikasi sintaks
(`node -c namafile.js`), lalu kirim file LENGKAP hasil edit lewat
SendUserFile — Hilman tinggal timpa file yang sama di GitHub & commit.
Jangan cuma kasih instruksi "tambahkan baris X di baris Y" — riskan
salah tempel, file utuh lebih aman & lebih cepat buat Hilman.

### 19.1 §12 (Registrasi revisi ke-3) — DIKONFIRMASI AMAN
Hilman sudah tes end-to-end penuh di dunia nyata: daftar → OTP →
Antrean Dakar Setujui → klik link email → Buat Password → login. Semua
lancar ("done aman"). Tidak ada perubahan kode dibutuhkan. §12 di atas
sudah diupdate mencerminkan ini.

### 19.2 BUG — Badge status PIN salah tampil "Belum Terpasang" setelah refresh — SUDAH DIPERBAIKI (root cause AWAL SALAH DUGA, dikoreksi setelah fix pertama terbukti tidak cukup)
**Gejala** (dilaporkan Hilman): setelah PIN berhasil diset, badge di
Profile > Keamanan > PIN sempat benar ("Terpasang"). Tapi setelah
halaman di-refresh, badge balik jadi "Belum Terpasang" — PADAHAL PIN-nya
aslinya SUDAH terpasang & berfungsi normal (dibuktikan tetap bisa
dipakai scan di Kiosk).

**❌ Percobaan fix PERTAMA (SALAH DUGA, sudah dilepas lagi)** — dugaan
awal: `muatStatusPin()` dipanggil di `onMounted` SEBELUM `await
window.authReady`, jadi tinggal panggil ulang SETELAH baris itu. Hilman
SUDAH menerapkan ini (commit `9560077` "bug pin") dan men-deploy-nya —
**TAPI gejalanya TETAP SAMA setelah refresh**. Hilman lalu bertanya
tepat sasaran: *"apakah karena tidak ada pengecekan ke firestore?"* —
pertanyaan itu yang mengarahkan ke pemeriksaan ulang `auth.js` secara
menyeluruh, dan membongkar kesalahan asumsi di fix pertama.

**✅ Root cause SEBENARNYA, dikonfirmasi lewat kode live (`auth.js` +
`vue-account-profile.js`, commit `9560077`)**: `window.authReady`
**BUKAN** sinyal "`window.currentUser` sudah lengkap terisi data
profil Firestore" — itu cuma sinyal "Firebase AUTH sudah tau SIAPA
yang login" (`onAuthStateChanged` versi cepat, `auth.js` baris ~55-66).
Yang BENAR-BENAR mengisi `window.currentUser` dengan data Firestore
(termasuk `pin_hash`) adalah proses LAIN yang TERPISAH & ASYNC:
- **Refresh halaman / sesi otomatis** → listener `onAuthStateChanged`
  KEDUA di `auth.js` (baris ~404, "SESI OTOMATIS") — baca cache
  `localStorage` ATAU `getDoc(users/{email})` dari Firestore, cek
  banyak syarat (approval, status_kerja, gudang, jam kerja), BARU
  set `window.currentUser = {...d, ...}` (baris ~498-508).
- Proses ini TIDAK disinkronkan ke `window.authReady` sama sekali —
  bisa selesai JAUH SETELAH `authReady` resolve. Jadi `await
  window.authReady` lalu baca `window.currentUser` (persis yang
  dilakukan fix pertama) **TIDAK MENJAMIN** data sudah lengkap.
- Pola yang SUDAH BENAR dari awal di codebase ini: proses "sesi
  otomatis" itu memanggil jembatan `window.refreshAccountProfileDisplay()`
  TEPAT setelah `window.currentUser` BENAR-BENAR lengkap (`auth.js`
  baris ~516, komentar "Jembatan ke vanilla ... TEPAT setelah
  window.currentUser terisi data asli") — dipanggil juga oleh
  `vue-login.js` untuk jalur login manual. **TAPI jembatan ini
  (`vue-account-profile.js` baris ~884) SEBELUMNYA CUMA memanggil
  `vm.muatAccountDisplay()`, TIDAK PERNAH memanggil `muatStatusPin()`**
  — itulah lubangnya. Sama seperti `refreshHome` (§10 poin 4), harusnya
  `muatStatusPin` juga direfresh di titik ini, bukan cuma di `onMounted`.

**Bukan bug di logic simpan/cache PIN itu sendiri** — sudah dicek,
keduanya benar (fungsi simpan PIN & cache sesi `localStorage` konsisten
menyertakan `pin_hash`) — jadi konfirmasi murni soal titik pemanggilan
`muatStatusPin()`, bukan datanya yang salah.

**✅ FIX YANG BENAR (sudah diterapkan & dikirim ke Hilman sebagai file
lengkap, per 23 Agt 2026)** — `js/vue-account-profile.js`:
1. Fix pertama (pemanggilan kedua `muatStatusPin()` setelah `await
   window.authReady` di `onMounted`) **DILEPAS LAGI** — terbukti tidak
   cukup, `onMounted` dikembalikan seperti semula.
2. `muatStatusPin` ditambahkan ke daftar `return {}` di `setup()` —
   sebelumnya cuma `pinStatusTerpasang` (ref-nya) yang di-return, fungsi
   pembacanya sendiri TIDAK bisa diakses dari luar komponen (`vm.xxx`).
3. `window.refreshAccountProfileDisplay` (baris ~884) ditambah 1 baris
   `vm.muatStatusPin();`, sejajar dengan `vm.muatAccountDisplay();` yang
   sudah ada — supaya status PIN ikut dibaca ulang TEPAT di momen
   `window.currentUser` dipastikan lengkap, sama seperti data profil
   lain yang sudah benar duluan.

**✅ Status: DIKONFIRMASI BERES** — Hilman sudah upload+commit (`01b020c9`
"bug pin2") dan verifikasi kode live menunjukkan fix yang benar sudah
ter-deploy dengan tepat (`refreshAccountProfileDisplay`/`muatStatusPin`
sudah sejalan). Tanda ⚠️ terkait di §18.1 sudah dihapus.

### 19.3 BUG (STATUS: OPEN, belum ketemu root cause) — tabel Device Kiosk tidak menampilkan device yang gudangnya dipilih lebih dari 1
**Gejala** (dilaporkan + screenshot Hilman, 23 Agt 2026): ada 2 Device
Kiosk yang seharusnya terdaftar, tabel di menu Device Kiosk cuma
menampilkan 1 (footer tabel malah ikut bilang "1 device", bukan cuma
baris yang hilang — jadi PENGHITUNGAN totalnya sendiri sudah 1, bukan
soal render/pagination). Device yang HILANG itu yang gudangnya dipilih
LEBIH DARI 1 (multi-select) saat dibuat.

**Sudah ditelusuri lewat kode live (metode `git clone` di §19.0)** —
`js/vue-device-kiosk.js` DAN `js/vue-components.js`
(`GudangCheckboxSelect`) SUDAH DIBACA BARIS PER BARIS, TIDAK ADA logic
apapun yang menyaring/membatasi berdasarkan JUMLAH gudang:
- `muat()` (vue-device-kiosk.js) — baca SELURUH collection `users`
  TANPA `where()`, saring cuma `jenis_akun === 'kiosk'` di JavaScript.
  Tidak ada syarat gudang sama sekali di titik ini.
- Kolom tabel — `{{ (k.gudang_penempatan || []).join(', ') }}`, tanpa
  potong/limit jumlah item.
- `GudangCheckboxSelect.toggle()` (vue-components.js) — akumulasi array
  pilihan pakai `push`/`splice` biasa, TIDAK ADA batas jumlah pilihan.
- `tambahKiosk()` — tulis `gudang_penempatan: form.gudang` APA ADANYA
  (array utuh dari form), tidak ada transformasi/pemotongan sebelum
  `setDoc`.

**Kesimpulan sementara**: kode client-side yang bisa dibaca Claude
TERBUKTI BERSIH dari bug ini — root cause KEMUNGKINAN ada di luar kode
yang bisa diakses sesi ini, misalnya:
1. `firestore.rules` (TIDAK ADA di repo GitHub ini — dideploy langsung
   dari Firebase Console per §3, jadi Claude tidak bisa membacanya) —
   mungkin ada aturan yang menolak tulis kalau `gudang_penempatan`
   berisi lebih dari 1 item, dan penolakan itu tidak kelihatan di UI.
2. Dokumen kiosk ke-2 sebenarnya GAGAL tersimpan waktu dibuat (meski
   sekilas terlihat sukses), atau ID dokumennya (pakai email sebagai
   ID) bentrok dengan dokumen lain.
3. Kemungkinan lain yang belum terpikir — SENGAJA tidak ditebak lebih
   jauh, sesuai aturan proyek "jangan bikin tebak2 jika ada bug", DAN
   sesuai pelajaran baru §18.4 ("kalau fix pertama tidak menyelesaikan
   gejala, jangan puas dengan penjelasan yang kedengarannya benar").

**Bukti yang DIBUTUHKAN sebelum lanjut** (ikuti pelajaran §18.4 poin 7
— minta Console/data di percobaan pertama, bukan setelah menebak
berkali-kali):
1. Firebase Console → Firestore Database → collection `users` → cari
   dokumen device kiosk yang HILANG dari tabel (pakai emailnya) — APAKAH
   dokumennya ADA? Kalau ada, apa isi PERSIS field `jenis_akun` dan
   `gudang_penempatan`-nya (screenshot langsung dari Firestore Console)?
2. Browser Console (F12 → tab Console) PAS submit form "Buat Device
   Kiosk" dengan gudang dipilih lebih dari 1 — ada error merah
   (`permission-denied` atau lainnya) atau tidak?

Status: **OPEN**, menunggu salah satu bukti di atas dari Hilman sebelum
diagnosis dilanjutkan.

### 19.4 GAP ARSITEKTUR (bukan bug regresi baru) — tombol back HP keluar total dari app — ✅ SUDAH DIPERBAIKI (level tab), dikonfirmasi Hilman 23 Agt 2026
**Gejala** (dilaporkan Hilman): tombol back di HP langsung keluar dari
app (ke halaman pencarian Google/riwayat browser sebelumnya), BUKAN
kembali ke menu/tab internal yang sebelumnya dibuka.

**Dikonfirmasi lewat kode live** — `js/dashboard.js` di-`grep` penuh
untuk pola Browser History API: **TIDAK ADA SATU PUN** pemakaian
`history.pushState()`, `history.replaceState()`, listener `popstate`,
atau hash routing (`location.hash`) di manapun. `pindahTab()`/
`pindahSubTab()` navigasinya MURNI `classList.add('hidden')`/
`classList.remove('hidden')` pada elemen DOM — tidak pernah mencatat
apapun ke riwayat browser.

**Kenapa ini menyebabkan gejala itu**: app ini SPA satu halaman
(`index.html` tunggal, tanpa routing/hash) — dari sudut pandang browser,
pindah tab/sub-tab di dalam app TIDAK PERNAH jadi "halaman baru" di
riwayat. Begitu tombol back ditekan, browser tidak punya entry internal
apapun untuk dituju, jadi langsung lompat ke entry SEBELUM app ini
dibuka sama sekali (di HP, biasanya hasil pencarian terakhir).

**Ini gap desain yang SUDAH ADA SEJAK AWAL** (bukan regresi dari
perubahan baru-baru ini) — baru sekarang dilaporkan karena baru
kepakai/ketahuan dari sisi pengguna sungguhan.

**✅ FIX YANG DITERAPKAN (23 Agt 2026)** — `js/dashboard.js`, level TAB
(bukan sub-tab, bukan transisi layar — lihat rincian cakupan di bawah):
1. `window.pindahTab(tabId, navKey, _dariPopstate)` — parameter ke-3
   BARU (opsional, default falsy, backward-compatible — dikonfirmasi
   lewat `grep -rn "pindahTab("` ke seluruh repo bahwa TIDAK ADA
   pemanggil lama yang kirim lebih dari 2 argumen). Sebelum toggle
   class `hidden` seperti biasa, kalau bukan hasil dari `popstate`
   (`!_dariPopstate`) DAN tab tujuan beda dari tab yang sedang aktif,
   dipanggil `history.pushState({tab: tabId, navKey: navKey || null},
   '', location.href)` — mencatat 1 entry riwayat browser per pindah
   tab. Dibungkus `try/catch` (kalau `pushState` gagal karena alasan
   apapun, navigasi TETAP lanjut, cuma dicatat ke `console.error`, tidak
   fatal).
2. Listener BARU `window.addEventListener('popstate', ...)` (dipasang
   setelah definisi `pindahSubTab`) — begitu tombol back/forward
   ditekan, baca `e.state.tab` (kalau ada) dan panggil balik
   `window.pindahTab(state.tab, state.navKey, true)` — argumen ke-3
   `true` supaya TIDAK push entry baru lagi (mencegah loop).

**Cakupan fix — SENGAJA dibatasi ke level TAB SAJA, 3 hal ini SENGAJA
BELUM masuk** (bukan kelupaan, masing-masing ada alasan risiko/
kompleksitas tersendiri, jadi kandidat PR terpisah kalau dibutuhkan
ke depan):
- **Sub-tab** (`pindahSubTab`, misal di dalam Master Absensi/Master
  Karyawan) — belum diberi `pushState` sendiri, supaya tidak
  kebanjiran 1 entry riwayat per klik sub-tab (UX back button bisa
  jadi aneh kalau tiap sub-tab dianggap "halaman" sendiri juga).
- **Transisi layar** (`pindahLayar` di `app.js` — Login, Buat Password,
  Camera/absensi QR) — di luar cakupan investigasi bug yang diminta
  Hilman kali ini, DAN beberapa layar ini (kamera terutama) punya alur
  sensitif (geolocation/submit foto) yang berisiko kalau disenggol
  tanpa testing menyeluruh.
- **Profile drawer** (`vue-profile-drawer.js`) — fungsi `tutup()`-nya
  TIDAK diekspos ke `window` (cuma `window.bukaProfileDrawer` yang
  ada), dan `navigasi(subtab)` di dalamnya memanggil `tutup()` lalu
  LANGSUNG `window.pindahTab(...)` tanpa jeda — kalau ditambah
  `history.back()` di titik ini berisiko race condition (async) dengan
  `pushState` yang menyusul. Butuh desain terpisah, bukan tempel
  langsung ke pola yang sama dengan tab.

**Status: DIKONFIRMASI BEKERJA** — fix dikirim ke Hilman (file lengkap
`dashboard.js` via SendUserFile), diuji, Hilman balas "selesai" (23 Agt
2026). Gap navigasi back button di level tab (skenario yang paling
sering kejadian — pindah antar menu Home/Absensi/Master dsb) sudah
tertutup. 3 area yang sengaja belum tersentuh (di atas) tetap jadi gap
yang diketahui, masuk kandidat §11 kalau nanti mau dikerjakan.

### 19.5 BUG SERIUS — Clock In bisa dobel sampai 7x + badge kartu shift salah tampil setelah refresh — SUDAH DIPERBAIKI (3 lapis fix), menunggu tes Hilman

**Gejala** (dilaporkan Hilman, 23 Agt 2026, minta desktop ikut pola
mobile yang sudah diperbaiki):
1. Kartu shift di Home sempat benar menyatakan "Sudah absen" begitu
   selesai Clock In. Tapi di-refresh, badge balik jadi "Belum absen" —
   PADAHAL sudah Clock In beneran.
2. **Lebih parah**: karena badge-nya salah, orangnya bisa Clock In LAGI
   dari tombol shortcut — Hilman coba sampai **7 kali berhasil Clock In**
   berturut-turut tanpa ada penolakan sama sekali.

Ini BUKAN cuma soal tampilan — data integrity (payroll/Riwayat Absensi)
langsung terdampak: 7 dokumen `absensi` per orang per hari kalau
kejadian di produksi.

**Ditelusuri lewat kode live (`git clone`, metode §19.0)** — commit
sebelum fix ini: `958cbe6` ("bug back"). Ditemukan **2 root cause
berbeda**, bukan 1 (keduanya berkontribusi ke gejala, jadi keduanya
diperbaiki + 1 jaring pengaman tambahan di titik tulis):

**❶ Root cause #1 (penyebab UTAMA gejala #2, Clock In dobel via Login)**
— `js/vue-login.js`, fungsi `login()`: kode di sini SUDAH pernah dirombak
19 Agt 2026 supaya pakai satu sumber kebenaran `window.
cekStatusClockInSaya()` (query Firestore `sedang_aktif==true`, tahan
shift-malam & lintas-device — lihat komentar panjang di `auth.js` baris
~556-581) — TAPI rombak itu **CUMA kena jalur DESKTOP** (`isDesktop.value`
branch). Jalur **MOBILE** (kode persis di bawahnya, buat cek "apa perlu
diarahkan ke screen-camera atau langsung Dashboard") **KELEWAT**, masih
pakai cara LAMA: `localStorage.getItem('zevanic_absen_'+email) === tanggal
HARI INI (string persis)`. Ini PERSIS pola lama yang sudah diakui rusak
di komentar `auth.js` sendiri (bug shift-malam + localStorage device-lokal
gampang meleset kalau app ditutup-buka/cache beda) — device/browser yang
tidak konsisten menyimpan localStorage berarti setiap kali proses
`login()` ini jalan ulang (bukan cuma sesi-otomatis `onAuthStateChanged`),
kalau `sudahClockInLokal` salah baca jadi `false`, user diarahkan LAGI ke
`screen-camera` walau aslinya sudah Clock In aktif — begitu submit,
dokumen Clock In BARU tertulis. Diulang beberapa kali (device/browser
mobile yang sesi Firebase Auth-nya tidak selalu persist mulus) -> Clock
In dobel berkali-kali. Bukti konkret: baris kode desktop & mobile di
fungsi yang SAMA, satu pakai cara BARU yang benar, satunya pakai cara
LAMA yang sudah terbukti salah — bukan dugaan, perbandingan langsung di
kode.

**❷ Root cause #2 (penyebab gejala #1, badge salah setelah refresh)** —
`js/vue-home.js`, `onMounted`: pola PERSIS sama dengan yang sudah
dibongkar di §19.2/§10 poin 4 — `onMounted(async () => { await
window.authReady; await muatSemua(); })` jalan LANGSUNG begitu
`authReady` resolve, TANPA mengecek apakah `window.currentUser` BENERAN
sudah terisi data Firestore (dua hal beda, lihat §10 poin 4). Kalau
belum, `muatTampilan()` jalan dengan email KOSONG -> `cekStatusClockInSaya('')`
pasti balik "tidak ketemu" -> badge jadi FALSE. Race condition: fetch
kosong ini (harus nunggu network) kadang selesai BELAKANGAN dan MENIMPA
hasil BENAR yang sudah lebih dulu dimuat `window.refreshHome()`
(dipanggil dari `auth.js`/`vue-login.js` TEPAT setelah `currentUser`
lengkap) — persis kenapa badge sempat benar dulu, lalu "balik salah"
sendiri pas refresh (timing-dependent, bukan selalu salah — ciri khas
race condition).

**✅ FIX (3 lapis, sudah dikirim ke Hilman sebagai file lengkap, 23 Agt
2026)**:
1. **`js/vue-login.js`** — jalur mobile SEKARANG pakai
   `sudahClockInHariIniServer()` (bungkus `cekStatusClockInSaya()`) yang
   SAMA persis dengan jalur desktop — dihitung SEKALI (`sudahClockInServer`),
   dipakai ulang di kedua cabang, supaya kedua device TIDAK BISA "beda
   pendapat" lagi ke depan. Ini juga yang menjawab permintaan Hilman
   "desktop ikut mobile" — sekarang keduanya benar-benar 1 sumber
   kebenaran yang sama, bukan cuma disamakan sepintas.
2. **`js/vue-home.js`** — `onMounted` SEKARANG cuma manggil `muatSemua()`
   kalau `window.currentUser` SUDAH ada isinya di titik itu. Kalau belum,
   diam saja, serahkan ke `window.refreshHome()` (bridge yang sudah
   benar dari awal) yang akan mengisi begitu datanya benar-benar siap —
   menghilangkan race condition-nya sama sekali.
3. **`js/vue-camera.js`** — jaring pengaman TAMBAHAN di titik TULIS
   (`simpanKeFirebase`, JALUR 1/HADIR): SEBELUM `addDoc()` dokumen Clock
   In baru, cek LANGSUNG `window.cekStatusClockInSaya()` — kalau
   ternyata SUDAH ada Clock In aktif, TOLAK (`return 'SUDAH_CLOCK_IN'`,
   sentinel khusus supaya tidak dobel alert dengan pesan error generik
   di pemanggil), alihkan ke Dashboard, TIDAK jadi menulis dokumen baru.
   Ini lapis pertahanan TERAKHIR — supaya even kalau ada bug UI lain yang
   belum ketahuan di masa depan, tetap TIDAK MUNGKIN ada 2 dokumen
   `sedang_aktif:true` bersamaan untuk 1 karyawan.

**Kenapa 3 lapis, bukan 1**: pelajaran dari §18.4/§19.2 — jangan puas
dengan 1 penjelasan yang kelihatan cukup. Di sini ada 2 root cause
BERBEDA yang sama-sama nyata (dikonfirmasi kode, bukan tebakan), plus
jaring pengaman di titik tulis supaya data integrity tetap terjaga
walau ada celah UI yang belum ketahuan ke depan — sesuai prinsip
"jangan cuma percaya penjelasan yang kedengarannya benar".

**Status: SUDAH DIKIRIM ke Hilman (3 file lengkap via SendUserFile:
`vue-login.js`, `vue-home.js`, `vue-camera.js`), MENUNGGU di-upload+
commit+test ulang** — begitu dikonfirmasi berhasil (termasuk skenario
"tutup app pas sudah Clock In, buka lagi, harus langsung ke Dashboard
tanpa diminta Clock In ulang" — INI SUDAH otomatis ditangani jalur
sesi-otomatis `auth.js` baris ~491-492 yang MEMANG sudah pakai
`cekStatusClockInSaya()` dengan benar dari awal, tidak ikut kena bug
ini), update status jadi FIXED di baris atas §19 & bagian atas dokumen.

✅ **UPDATE 23 Agt 2026 (sesi lanjutan, siang)**: Hilman sudah upload+
commit fix di atas (`f72ebc0` "bug clock in") dan balas **"done mantap"**
— DIKONFIRMASI BEKERJA di produksi. Tidak ada laporan susulan soal Clock
In dobel/badge salah lagi.

### 19.6 3 laporan baru sesi ini (siang, setelah §19.5 dikonfirmasi) — QR Profile dari mobile gagal di-scan, menu Absensi QR dirapikan 5→4 tombol, redirect Kiosk salah arah — SEMUA SUDAH DIPERBAIKI, menunggu tes Hilman

**Konteks laporan** (Hilman, 23 Agt 2026 siang): "cek profile > qr akun
owner tadi pagi tdk bisa discan di menu absensi qr karena n/a... qr dari
desktop aman bisa discan tetapi qr generate dari mobile tidak bisa
discan... lalu pada menu absensi qr itu ada 5 tombol, rangkum jadi 4
tombol, clock in/clock out jadikan satu... karena tadi ada celah bisa
scan berkali2 clock in, lalu [pastikan ada] form konfirmasi jika sukses,
alert jika sudah clock in, alert jika ada gagal".

**❶ QR Profile dari mobile tidak valid saat di-scan (desktop aman)** —
ditelusuri lewat kode live (`git clone`, commit `f72ebc0`), ketemu bug
di `js/vue-account-profile.js` `onMounted()`: `muatAccountDisplay()`
(fungsi yang mengisi `idAppTampil`/`qrUrl`, sumber gambar QR yang
ditampilkan) dipanggil LANGSUNG begitu komponen mount, TANPA cek dulu
apakah `window.currentUser` sudah terisi — **pola identik** dengan bug
yang sudah dibongkar di §19.2 (badge PIN) & §19.5 (badge Clock In Home):
`window.authReady` cuma nandain Firebase AUTH tau siapa yang login,
BUKAN nandain data profil Firestore (`window.currentUser`) sudah
lengkap (§10 poin 4). Kalau mount kejadian SEBELUM `currentUser` terisi
(lebih sering di mobile — jaringan/perangkat lebih lambat resolve auth,
makanya TIMING-DEPENDENT, bukan selalu gagal, cocok dengan laporan
"desktop aman, mobile tidak"), QR ke-generate dari data kosong/salah.
Diperparah oleh: sub-tab default Account Profile adalah `'account'`
(tempat QR ditampilkan) — buka Profile lewat drawer TIDAK memicu
`pindahTab('account')` (karena itu sudah tab AKTIF, tidak ada
perpindahan) yang seharusnya me-refresh ulang — jadi QR yang salah bisa
terus tampil sampai user sengaja pindah ke sub-tab lain lalu balik lagi.
**Fix**: `onMounted` sekarang CUMA memanggil `muatAccountDisplay()`/
`muatStatusPin()` kalau `window.currentUser` SUDAH ada isinya — kalau
belum, diam saja, serahkan ke `window.refreshAccountProfileDisplay()`
(bridge yang SUDAH benar dari §19.2, dipanggil TEPAT setelah
`currentUser` lengkap) — pola identik dengan fix §19.5 di `vue-home.js`.

**❷ Menu Absensi QR dirapikan dari 5 tombol jadi 4 (Clock In/Out
digabung)** — `js/vue-absensi-qr.js`: `JENIS_MENU` sebelumnya
`['HADIR (CLOCK IN)', 'CLOCK OUT', 'LEMBUR (CLOCK IN)', 'IZIN', 'CUTI']`
(5 tombol, Clock In & Clock Out dipilih MANUAL terpisah SEBELUM tau
siapa yang bakal di-scan — celah lama: orang bisa pilih "Clock In"
padahal statusnya sebenarnya sudah aktif Clock In, karena menu belum
tau identitas siapapun di titik itu). Sekarang jadi 4 tombol: 1 tombol
gabungan `'ABSEN'` ("Clock In / Out") + Lembur + Izin + Cuti. Arah
Masuk/Keluar BARU ditentukan di `lanjutKeKameraAsli()` — TEPAT setelah
scan QR + PIN benar (identitas karyawan sudah pasti) — pakai
`window.cekStatusClockInSaya(k.id)` (SATU sumber kebenaran yang sama
dipakai Home/Login/write-guard §19.5), baru di-set ke
`window.statusPilihanGlobal` sebagai `'HADIR (CLOCK IN)'` atau
`'CLOCK OUT'` yang SEBENARNYA sesuai status TERKINI orangnya. Ini
otomatis MENUTUP celah "bisa pilih Clock In padahal sudah aktif" di
akarnya (bukan cuma di titik tulis) — karena sekarang TIDAK ADA lagi
pilihan manual Clock In vs Clock Out, sistem yang tentukan.

**❸ Jaring pengaman "sudah Clock In" (dari §19.5) salah arah kalau
dipicu di mode Kiosk** — ditemukan sambil mengerjakan ❷: guard yang
ditambahkan di `vue-camera.js` JALUR 1 (§19.5, cek `cekStatusClockInSaya`
sebelum `addDoc`) SELALU redirect ke `screen-dashboard`/`tab-home` kalau
kena — tapi saat dipicu dari mode Kiosk (`window.modeKioskAktif`),
`window.currentUser` lagi DI-TIMPA SEMENTARA jadi identitas KARYAWAN
yang di-scan (lihat §18.3) — redirect ke Dashboard jadi SALAH ARAH
(device Kiosk seharusnya balik ke menu Absensi QR, bukan ke Dashboard
karyawan siapapun yang kebetulan sedang di-scan). **Fix**: guard
sekarang cek `window.modeKioskAktif` dulu — kalau true, panggil
`window.selesaiModeKiosk()` (pola yang SAMA persis dengan `batalKamera()`
yang sudah benar dari awal — pulihkan identitas Kiosk asli + balik ke
`screen-absensi-qr`), else baru redirect Dashboard seperti semula. Alert
pesannya juga dibedakan ("Kembali ke menu Kiosk..." vs "Mengalihkan ke
Dashboard...") supaya tidak membingungkan.

**Konfirmasi 3 kebutuhan UX Kiosk yang diminta Hilman** (form konfirmasi
sukses / alert sudah Clock In / alert gagal) — semua SUDAH ada &
terverifikasi lewat kode: kartu sukses besar (`tahap.value='sukses'`,
`window.tampilkanSuksesKiosk()`, auto-tutup 3 detik) sudah dibangun sejak
§18.3 fase 4, TIDAK berubah. Alert "sudah Clock In" BARU (bagian dari
❸ di atas, sekarang kiosk-aware). Alert gagal generik ("Gagal mengirim
pengajuan...") sudah ada dari §19.5. Ketiganya kini konsisten dipakai di
JALUR mana pun (Kiosk maupun non-Kiosk).

**Status: SUDAH DIKIRIM ke Hilman (3 file lengkap via SendUserFile:
`vue-absensi-qr.js`, `vue-camera.js`, `vue-account-profile.js`),
MENUNGGU di-upload+commit+test ulang** (termasuk tes lintas-device buat
❶: buka Profile dari mobile beberapa kali, pastikan QR selalu valid
di-scan; tes ❷: scan pakai tombol gabungan buat karyawan yang belum
Clock In lalu yang sudah; tes ❸: coba scan orang yang sudah Clock In
aktif lewat Kiosk, pastikan balik ke menu Kiosk bukan Dashboard).

✅ **UPDATE 23 Agt 2026 (masih sesi siang)**: Hilman konfirmasi tombol
gabungan (❷) sudah jalan ("tombol sudah ngegabung"), commit `59c5cdd`
"bug absensi qr". Lanjut laporan baru: §19.7 di bawah.

### 19.7 BUG — Clock Out "hidup lagi" kalau karyawan yang SAMA di-scan ulang beberapa menit kemudian (root cause: dokumen zombie sisa bug Clock In dobel §19.5) — SUDAH DIPERBAIKI, menunggu tes Hilman

**Gejala** (dilaporkan Hilman, dikonfirmasi lewat 2 pertanyaan klarifikasi
ke Hilman — BUKAN ditebak, sesuai aturan proyek): karyawan yang SUDAH
Clock Out lewat Kiosk, kalau di-scan ULANG beberapa menit kemudian,
sistem MASIH menganggap dia "sedang aktif Clock In" — jadi tombol
gabungan (§19.6) menawarkan Clock Out LAGI, dan berhasil tercatat lagi.
Hilman juga eksplisit konfirmasi: aturan §8.2 (Clock Out tetap boleh
kapan saja, cuma jam gajinya yang dibatasi kalau di luar shift) **TIDAK
diubah** — yang diminta murni "jangan bisa Clock Out dobel", bukan
"blokir Clock Out di luar jam shift".

**Kenapa ditanya dulu, bukan langsung nebak fix**: dari kode live,
SUDAH ada 3 lapis penjagaan (cek status sebelum masuk kamera di tombol
gabungan §19.6, cek status lagi tepat sebelum tulis Firestore di JALUR
2 `vue-camera.js`, tombol Kirim terkunci selama proses kirim) — jadi
"kenapa masih bisa kejadian" butuh klarifikasi presisi, bukan tebakan.
Jawaban Hilman ("discan lagi setelah jeda, bukan discan cepat
berturut-turut") mempersempit ke SATU kemungkinan konkret: query status
yang dipakai (`cekStatusClockInSaya`, `auth.js`) pakai `limit(1)` — kalau
karyawan itu PUNYA lebih dari 1 dokumen `absensi` berstatus
`sedang_aktif:true` BERSAMAAN, Clock Out cuma menutup SATU (yang
kebetulan ke-query), sisanya TETAP `sedang_aktif:true` — scan berikutnya
nemu dokumen LAIN yang belum ditutup, dikira "belum Clock Out".

**Dari mana dokumen dobelnya bisa ada**: hampir pasti sisa dari bug
Clock In dobel (§19.5, SUDAH diperbaiki) — SEBELUM fix itu, Hilman
sendiri sempat tes sampai **7x Clock In berhasil** buat akun yang sama
(Owner), yang berarti sampai 7 dokumen `absensi` ber-`sedang_aktif:true`
sekaligus tersimpan di Firestore buat akun itu. Fix §19.5 mencegah
dokumen zombie BARU, tapi TIDAK membersihkan yang SUDAH ADA dari
testing sebelum fix itu — itulah yang bikin bug ini kelihatan seperti
"muncul lagi" padahal sebenarnya sisa masalah lama yang belum ke-cover.

**✅ FIX (`js/vue-camera.js`, JALUR 2/Clock Out format baru)** — SEBELUMNYA
`updateDoc()` cuma ke 1 `docId` (hasil `cekStatusClockInSaya`, `limit(1)`).
Sekarang JALUR 2 query SEMUA dokumen `sedang_aktif:true` milik email itu
(TANPA `limit`) dan tutup SEKALIGUS SEMUANYA (`Promise.all` map
`updateDoc`) di titik Clock Out mana pun terjadi (Kiosk maupun HP
sendiri) — jadi:
1. Kalau memang cuma ada 1 dokumen aktif (kasus normal), perilakunya
   SAMA seperti sebelumnya, tidak ada yang berubah.
2. Kalau ada dokumen ZOMBIE sisa bug lama, Clock Out kali ini
   **otomatis membersihkan SEMUANYA sekaligus** — self-healing, TIDAK
   perlu Hilman bersih-bersih manual lewat Firestore Console. Begitu
   karyawan yang kena masalah ini Clock Out SEKALI lagi (dengan file
   baru ini sudah live), semua dokumen zombie miliknya ikut tertutup,
   dan tidak akan kejadian lagi ke depan (karena §19.5 sudah mencegah
   dokumen zombie baru terbentuk).

Tidak ada perubahan pada aturan §8.2 (jam kerja) — sesuai jawaban
Hilman, Clock Out tetap boleh kapan saja, cuma memastikan tidak dobel.

**Status: SUDAH DIKIRIM ke Hilman (`vue-camera.js`, file lengkap via
SendUserFile), MENUNGGU di-upload+commit+test ulang** — tes yang
relevan: Clock Out karyawan yang PERNAH kena bug 7x Clock In dulu
(terutama akun Owner, yang paling sering dipakai testing), lalu scan
ulang beberapa menit kemudian, pastikan SUDAH konsisten "tidak aktif"
(tidak nawarin Clock Out lagi).

**PR kecil, sudah dikonfirmasi & DIIMPLEMENTASIKAN** — lihat §19.8 di
bawah: ternyata memang USULAN alur baru (PIN dua kali), sudah
dikonfirmasi eksplisit oleh Hilman dan sudah dikerjakan.

---

### 19.8 Permintaan baru — PIN Kiosk diminta 2x (verifikasi + konfirmasi) + kartu sukses foto diperbesar biar karyawan bangga — SUDAH DIPERBAIKI (2 ronde, urutan DIKOREKSI), menunggu tes Hilman

**Permintaan Hilman** (menjawab pertanyaan klarifikasi soal maksud "PIN
2x" di §19.7): "iya 2x tapi disana infokan yah konfirmasi, sambil
kartu jika sukses clocik suapya bisa mereka bisa bangga saat foto
slefie." Jadi dikonfirmasi eksplisit dua hal:
1. PIN Kiosk diminta **2 kali** — PIN pertama untuk verifikasi identitas
   + menentukan arah (Clock In/Out/Lembur/Izin/Cuti otomatis, sama
   seperti §19.6), PIN kedua khusus untuk **konfirmasi** sebelum kamera
   dibuka dan aksi benar-benar dieksekusi — dan tahap kedua ini harus
   jelas "diinfokan" ke pengguna sebagai konfirmasi (bukan cuma minta
   PIN lagi tanpa penjelasan).
2. Kartu sukses (setelah Clock In/Out berhasil) foto selfie-nya
   diperbesar/dipercantik supaya karyawan bisa "bangga" saat lihat
   fotonya sendiri di layar Kiosk.

**✅ FIX (`js/vue-absensi-qr.js`)**:

1. **Tahap baru `konfirmasi`** disisipkan antara tahap `pin` (PIN
   pertama) dan tahap `sukses`. Alurnya sekarang: scan QR/barcode →
   PIN pertama (`verifikasiPin`, cek `pin_hash` ke Firestore seperti
   biasa) → kalau benar, panggil `siapkanKonfirmasi()` yang menentukan
   arah aksi (pakai `cekStatusClockInSaya` kalau menu "ABSEN" dipilih,
   sama seperti logika lama di §19.6) lalu pindah ke tahap
   `konfirmasi` → tahap ini menampilkan nama karyawan, badge pil
   berisi ikon+label arah yang akan dieksekusi (mis. "Clock Out"),
   teks eksplisit **"Masukkan PIN sekali lagi untuk konfirmasi"**, dan
   keypad PIN lagi → PIN kedua diverifikasi lewat fungsi
   `verifikasiPin` yang SAMA (hash dicek ulang ke `pin_hash`), tapi kali
   ini karena `sedangKonfirmasi.value` sudah `true`, hasil benar
   langsung panggil `lanjutKeKameraAsli()` yang membuka kamera dengan
   arah yang SUDAH ditentukan di langkah pertama (tidak dihitung ulang).
2. State baru: `sedangKonfirmasi` (ref boolean, penanda sedang di PIN
   ke-2), `arahAbsenTerkonfirmasi` (ref string, hasil arah yang sudah
   ditentukan), `LABEL_ARAH` (map arah → {label, icon} buat badge di
   tahap konfirmasi). `kembaliKeMenu()` di-update supaya reset kedua
   state baru ini juga, supaya tiap mulai scan baru bersih.
3. **Kartu sukses foto diperbesar**: dari kotak 140×140px border
   tunggal jadi **lingkaran 172×172px** dengan efek border ganda
   (pink + burgundy, pakai `box-shadow` bertingkat) supaya lebih mirip
   bingkai foto — ikon centang sukses diperkecil sedikit (44px→36px)
   biar seimbang dengan foto yang lebih besar.
4. **Perbaikan kecil tambahan (ditemukan saat review, bukan laporan
   Hilman)**: cabang gudang-tidak-cocok di `lanjutKeKameraAsli()`
   (kalau gudang karyawan yang di-scan tidak overlap dengan gudang
   Kiosk) sebelumnya cuma `alert()` lalu `return` — user macet di
   layar itu tanpa jalan keluar. Ditambahkan `kembaliKeMenu()` setelah
   alert supaya otomatis kembali ke menu Kiosk.

**Verifikasi**: `node -c js/vue-absensi-qr.js` → lolos, tidak ada
syntax error.

**RONDE 2 (23 Agt 2026, sore) — urutan DIKOREKSI setelah Hilman tes
ronde 1**: Hilman melaporkan urutan yang benar seharusnya "scan QR →
PIN pertama → layar konfirmasi (badge arah) → kamera kebuka → PIN
kedua → alert Clock In/Out". Ternyata di ronde 1 saya taruh PIN kedua
SEBELUM kamera dibuka (di layar konfirmasi) — salah urutan. Diperbaiki
lewat 2 pertanyaan klarifikasi ke Hilman dulu (bukan langsung nebak
ulang) untuk memastikan: (1) urutan PIN kedua memang SETELAH foto
diambil, dan (2) kartu sukses foto besar itu sudah otomatis dipakai
untuk Clock In MAUPUN Clock Out (dikonfirmasi: ya, sudah benar, tidak
perlu dibedakan) — jawaban Hilman: PIN kedua SETELAH foto diambil, dan
kartu sukses sudah OK apa adanya (1 desain untuk semua).

**Perubahan arsitektur ronde 2**:
- `vue-absensi-qr.js`: tahap `konfirmasi` SEKARANG cuma menampilkan
  badge arah + tombol "Lanjut ke Kamera"/"Batal" (PIN KEDUA DIHAPUS
  dari layar ini). `verifikasiPin()` disederhanakan — cuma ada 1 PIN di
  file ini (PIN pertama, identitas+arah). State `sedangKonfirmasi`
  dihapus total (tidak dipakai lagi).
- `vue-camera.js`: ditambahkan gerbang PIN KEDUA yang BARU — muncul
  sebagai popup modal "Konfirmasi Terakhir" SETELAH tombol "Kirim
  Pengajuan" ditekan (jadi SETELAH foto selfie sudah diambil), TAPI
  HANYA kalau `window.modeKioskAktif` true (mode Kiosk) — submit dari
  HP karyawan sendiri (login Firebase Auth biasa) TIDAK terpengaruh,
  langsung kirim seperti sebelumnya. PIN dicocokkan ke
  `window.currentUser.pin_hash` (identitas karyawan yang di-scan, sudah
  dioverride sebelum masuk `screen-camera`) pakai `hashPin()` yang
  disalin (pola yang sama dipakai di semua file lain). Salah 3x →
  otomatis `batalKamera()` (kembali ke menu Kiosk, konsisten dengan
  batas percobaan PIN pertama). State PIN-Kiosk direset tiap
  `mulaiKamera()` supaya tidak kebawa dari scan sebelumnya.

**Verifikasi**: `node -c` lolos di KEDUA file, tidak ada syntax error.
Dicek juga tidak ada sisa referensi ke `sedangKonfirmasi` yang sudah
dihapus (grep bersih).

**Status ronde 2: SUDAH DIKONFIRMASI Hilman (commit `884bb6d` "bug
absensiqr3", live di GitHub Pages).**

---

### 19.9 BUG BARU ditemukan SAAT tes ronde 2 — sudah Clock Out lewat Kiosk, discan ulang malah diminta Clock Out LAGI (bukan Clock In) — DIPERBAIKI & AKAR MASALAH TERKONFIRMASI 100% (Hilman paste isi firestore.rules langsung)

**Gejala** (dilaporkan Hilman langsung setelah commit `884bb6d` live):
"udah clockout, saat masuk kembali ke menu absensi qr bukannya
clockin yah?? tapi ini malah minta clockout lagi?"

**Ditanya dulu 2 hal (BUKAN langsung nebak, sesuai aturan proyek +
pelajaran §19.3 "minta bukti di percobaan pertama")**:
1. Apa yang muncul di layar waktu Clock Out tadi? → Jawaban Hilman:
   **ada alert "Gagal mengirim pengajuan..."** (BUKAN kartu sukses) —
   ini bukti PENTING: Clock Out-nya SEBENARNYA GAGAL tersimpan, bukan
   cuma bug tampilan status doang.
2. Akun apa yang dites? → Jawaban Hilman: **akun Owner** — akun yang
   PERSIS sama dengan yang dipakai testing 7x Clock In dulu (§19.5,
   SEBELUM fix), dan PERSIS akun yang punya riwayat masalah gudang
   tidak cocok dengan Kiosk (§18.4 poin 9, kasus QR Owner tidak bisa
   discan gara-gara gudang pertamanya beda dari Kiosk).

**Diagnosis (kemungkinan besar, BELUM 100% pasti — lihat catatan
keterbatasan di bawah)**: fix §19.7 (tutup SEMUA dokumen
`sedang_aktif:true` sekaligus pakai `Promise.all`) — dokumen ZOMBIE LAMA sisa testing 7x Clock In (SEBELUM §19.5
diperbaiki) kemungkinan besar punya field `gudang` yang TIDAK termasuk
gudang Kiosk yang dipakai tes ronde 2 ini (Firestore Rules cuma izinkan
Kiosk menulis absensi buat gudang MILIKNYA SENDIRI, §18.4 poin 9).
`Promise.all` bersifat SEMUA-ATAU-TIDAK-SAMA-SEKALI — begitu SATU
dokumen ditolak Rules (gudang tidak cocok), SELURUH operasi (termasuk
dokumen shift yang SEHARUSNYA berhasil ditutup Kiosk ini) ikut
dianggap gagal oleh kode → alert "Gagal mengirim pengajuan" muncul →
TIDAK ADA dokumen yang benar-benar tertutup → scan berikutnya masih
nemu dokumen `sedang_aktif:true` → dikira "masih Clock In".

**✅ DIKONFIRMASI 100% (bukan cuma dugaan lagi)** — Hilman paste
LANGSUNG isi lengkap `firestore.rules` production ke chat (disimpan
sebagai snapshot permanen di `claude/FIRESTORE-RULES-SNAPSHOT.md`,
baca file itu kalau butuh detail rules koleksi lain juga). Baris
kuncinya, di `match /absensi/{docId}`:
```
allow update: if isAdminLevel()
  || request.auth.token.email == resource.data.email
  || (isKiosk() && resource.data.gudang in gudangKiosk());
```
Ini PERSIS mengonfirmasi diagnosis: update dokumen `absensi` lewat
Kiosk (`request.auth.token.email` = email AKUN KIOSK aslinya — override
`window.currentUser` di sisi client TIDAK mengubah identitas Firebase
Auth sesungguhnya) CUMA lolos kalau `resource.data.gudang` (gudang YANG
TERSIMPAN DI DOKUMEN itu) ada di `gudang_penempatan` milik akun Kiosk.
Dokumen zombie lama yang gudangnya beda — DITOLAK, titik, tidak peduli
Kiosk yang mana pun dipakai. Klausa `request.auth.token.email ==
resource.data.email` (buat self-submit BUKAN Kiosk) TIDAK PUNYA syarat
gudang sama sekali — jadi solusi workaround (Owner Clock Out dari HP
sendiri) JUGA terkonfirmasi 100% BENAR, bukan cuma tebakan.

**✅ FIX DEFENSIF yang SUDAH DITERAPKAN (`js/vue-camera.js`, JALUR 2)** —
`Promise.all` diganti `Promise.allSettled`: tiap dokumen ditutup
SENDIRI-SENDIRI, dokumen yang MEMANG boleh ditutup Kiosk ini (gudang
cocok) TETAP berhasil walau ada dokumen lain yang ditolak. Kalau
SEMUA dokumen gagal (bukan cuma sebagian), BARU dianggap gagal total
(alert tetap muncul, sama seperti sebelumnya). Console log ditambahkan
(jumlah gagal/berhasil + alasan) buat diagnosis lebih lanjut kalau
masih terjadi.

**⚠️ PENTING — fix ini KEMUNGKINAN BELUM CUKUP sendirian**: kalau
dokumen zombie yang gudangnya tidak cocok itu MASIH ada aktif
(`sedang_aktif:true`), Kiosk MANAPUN (bukan cuma Kiosk yang dipakai
sekarang) TIDAK AKAN PERNAH bisa menutupnya — itu keterbatasan
Firestore Rules yang disengaja (mencegah Kiosk gudang A menulis
absensi atas nama gudang B), BUKAN sesuatu yang bisa "diperbaiki" dari
sisi kode Kiosk. **Solusi buat akun Owner yang sudah kadung stuck**:
Owner WAJIB Clock Out SEKALI lewat HP-nya SENDIRI (login biasa, BUKAN
lewat menu Absensi QR/Kiosk) — submit dari akun sendiri kemungkinan
besar TIDAK kena pembatasan gudang yang sama (itu nulis ke dokumen
MILIK SENDIRI, beda konteks dari Kiosk menulis ATAS NAMA orang lain).
Ini akan menutup SEMUA dokumen zombie sekaligus (query-nya SAMA,
`sedang_aktif:true` tanpa filter gudang), baru setelah itu Kiosk bisa
dipakai normal lagi buat akun Owner.

**Status: SELESAI & DIKONFIRMASI Hilman** ("done untuk clock in dan
clock out sudah sesuai") — fix + workaround (Clock Out 1x lewat HP
sendiri) berhasil.

---

### 19.10 BUG BARU ditemukan SAAT konfirmasi §19.9 — kartu sukses besar TIDAK PERNAH kelihatan sama sekali setelah PIN kedua + kurang ada loading — SUDAH DIPERBAIKI

**Gejala** (dilaporkan Hilman, SETELAH konfirmasi Clock In/Out §19.9
sudah beres): "ketika pin kedua dinput harusnya ada sesi loading
sambil nunggu munculkan popup kartu ukuran besar (karna sampai barusan
masih belum ada kartu muncul saat sukses)". Jadi 2 hal: (1) kartu
sukses besar (foto bulat, dari §19.8) TIDAK PERNAH tampil sama sekali
setelah PIN kedua benar & data terkirim, dan (2) tidak ada indikasi
loading yang jelas selama proses kirim berlangsung (popup PIN langsung
"diam" tanpa penjelasan).

**Root cause #1 (bug LAMA, baru ketahuan sekarang) — kartu sukses
memang TIDAK PERNAH bisa kelihatan sejak fitur ini dibuat (§19.6)**:
kartu sukses ada di komponen `vue-absensi-qr.js`, yang hidup di div
`#screen-absensi-qr` — tapi `window.tampilkanSuksesKiosk()` (dipanggil
`vue-camera.js` SETELAH submit sukses) cuma ganti `tahap.value =
'sukses'` TANPA pindah layar balik ke `screen-absensi-qr` — padahal
saat itu layar yang AKTIF masih `screen-camera` (div `#screen-absensi-qr`
masih `display:none`). Jadi kartunya "ada" di data Vue tapi TIDAK
KELIHATAN sama sekali. 3 detik kemudian, `window.selesaiModeKiosk()`
BARU pindah layar balik ke `screen-absensi-qr` — TAPI di baris PERSIS
SEBELUM pindah layar itu, `suksesInfo.value` SUDAH di-null-kan duluan
(reset buat scan berikutnya) — jadi begitu layarnya akhirnya kelihatan,
datanya sudah kosong lagi, langsung balik ke tahap menu tanpa pernah
sempat menampilkan apa-apa.

**✅ FIX (`js/vue-absensi-qr.js`, `window.tampilkanSuksesKiosk`)** —
tambah `window.pindahLayar('screen-absensi-qr')` LANGSUNG di titik
kartu sukses disiapkan (bukan nunggu 3 detik lagi) — supaya
`#screen-absensi-qr` sudah PASTI visible SAAT kartunya ditampilkan.
Pindah layar ini juga otomatis mematikan kamera (efek samping
`pindahLayar` di `app.js`), pas karena foto sudah selesai dipakai.

**Root cause #2 (permintaan tambahan, bukan bug) — tidak ada loading
state**: setelah PIN kedua benar, modal PIN langsung ditutup
(`pinKioskDiminta.value = false`) SEBELUM `kirimDataKeCloud()` (proses
Firestore, bisa makan waktu) selesai — user melihat modal hilang lalu
"diam" sesaat (balik ke layar preview foto) sebelum (kalau fix #1
tidak ada) apa pun terjadi lagi.

**✅ FIX (`js/vue-camera.js`)** — ref baru `mengirimPinKiosk`: begitu
PIN kedua benar, modal PIN **TETAP terbuka** (`pinKioskDiminta` tetap
`true`), TAPI isinya berganti jadi spinner + teks "Mengirim
Absensi... Mohon tunggu sebentar" (`mengirimPinKiosk.value = true`)
selama `kirimDataKeCloud()` berjalan. Modal baru benar-benar ditutup
setelah proses itu selesai (sukses ATAU gagal) — kalau sukses & mode
Kiosk, layar sudah keburu pindah ke `screen-absensi-qr` (fix #1 di
atas) jadi modal ini otomatis ikut hilang dari pandangan; kalau gagal,
modal tertutup dan user bisa coba lagi dari tombol Kirim.

**Verifikasi**: `node -c` lolos di KEDUA file.

**Status ronde 3: SUDAH DIKIRIM & bekerja** — dilanjutkan Hilman minta
3 penyesuaian lagi tanpa laporan bug baru, lihat ronde 4 di bawah.

---

### 19.11 Permintaan penyempurnaan (ronde 4, BUKAN laporan bug) — durasi kartu sukses 3→7 detik, foto diperbesar 2x lipat lagi, tambah suara "Terima kasih"

**Permintaan Hilman**: "pop up revisi menjadi 7detik, terlalu cepat
dan kartu perbesar lagi saja biar epic untuk lingkarannya buat 2x
lipat lebih bsar dari sekarang buat proposional dan apakah bisa saat
pop up kartu keluar mau clocin atau clock out muncul suara terima
kasih".

**✅ Diterapkan (`js/vue-absensi-qr.js`, `window.tampilkanSuksesKiosk`
+ template tahap 'sukses')**:
1. Durasi tampil kartu sukses: **3 detik → 7 detik**
   (`setTimeout(..., 7000)`).
2. Foto lingkaran diperbesar **2x lipat** (172px → 344px,
   `max-width:100%` ditambahkan supaya tetap aman di layar Kiosk yang
   sempit) — kartu pembungkusnya (card) JUGA diperbesar sepadan
   (max-width 340→460px, padding/font/spacing lain ikut discale naik)
   supaya proporsional, bukan cuma foto doang yang membesar sendirian.
3. **Suara "Terima kasih"** — dipakai `SpeechSynthesisUtterance`
   bawaan browser (`lang: 'id-ID'`), dipanggil TEPAT saat kartu sukses
   muncul, **KHUSUS untuk Clock In (`HADIR (CLOCK IN)`) dan Clock Out
   (`CLOCK OUT`)** — TIDAK untuk Lembur/Izin/Cuti (sesuai permintaan
   eksplisit "mau clockin atau clock out"). Dibungkus try/catch + cek
   `window.speechSynthesis` ada dulu, supaya kalau device/browser tidak
   dukung, TIDAK mengganggu alur submit sama sekali (cuma suaranya
   yang tidak keluar).

**Verifikasi**: `node -c` lolos.

**Status: SUDAH DIKIRIM ke Hilman (`vue-absensi-qr.js` saja — file ini
satu-satunya yang berubah ronde ini, `vue-camera.js` TIDAK berubah dari
kiriman ronde 3), MENUNGGU di-upload+commit+test ulang** — tes yang
relevan: kartu sukses sekarang tampil 7 detik (bukan 3), foto
lingkarannya jauh lebih besar tapi kartunya tetap terlihat rapi/tidak
kepotong di layar Kiosk, dan ada suara "Terima kasih" terdengar pas
kartu sukses Clock In/Clock Out muncul (Lembur/Izin/Cuti TETAP diam,
sesuai permintaan).

---

## 20. Update 23 Agt 2026 (malam) — FITUR BARU: "Zevanic House > Master Bahan & Aksesoris" (modul awal Konveksi)

Permintaan BARU, TIDAK terkait bug absensi §19 di atas — awal
pembangunan modul Konveksi. Permintaan asli Hilman (verbatim, disingkat):
grup menu baru "Zevanic House" > "Master Bahan & Aksesoris", 13 field
(Tanggal/ID otomatis, Jenis, Foto, Nama, Warna, Harga Pembelian, Satuan
Pembelian, Isi Konversi Pembelian, Satuan Pemakaian, Harga Modal, Margin
Modal, Harga Pemakaian), 2 sub-menu di dalamnya ("Bahan / Aksesoris" +
"List Bahan / Aksesoris"), dan tombol popup bantu hitung konversi
berjenjang (Dus > Pack > Pcs).

### 20.1 Keputusan desain — dikonfirmasi Hilman lewat AskUserQuestion (4 pertanyaan) SEBELUM mulai coding
Sesuai `PEDOMAN-GAYA-KERJA.md` ("berhenti & tanya HANYA kalau benar-benar
belum ada pola serupa DAN dampaknya luas") — 4 hal ini dianggap cukup
berisiko/struktural buat ditanya dulu, bukan ditebak:

1. **Field harga (Modal/Margin/Pemakaian) — manual semua atau auto-hitung
   sebagian?** → **Auto-hitung** (Recommended, dipilih Hilman). Jadi:
   `harga_pembelian`, `isi_konversi_pembelian`, `margin_modal` = input
   manual. `harga_modal` = `harga_pembelian / isi_konversi_pembelian`
   (readonly). `harga_pemakaian` = `harga_modal + margin_modal`
   (readonly). **ASUMSI belum eksplisit dikonfirmasi**: `margin_modal`
   diperlakukan sebagai NOMINAL RUPIAH (bukan persen) — kalau ternyata
   maksud Hilman itu persen, gampang diubah, tinggal ganti rumus
   `harga_pemakaian` jadi `harga_modal * (1 + margin_modal/100)`.
2. **Popup konversi berjenjang — kalkulator sekali pakai atau data
   permanen?** → **Simpan berjenjang permanen** (Hilman pilih ini, BUKAN
   opsi Recommended) — jadi field `konversi_bertingkat` (array
   `{dari, jumlah, ke}`) ikut TERSIMPAN di dokumen, bukan cuma dipakai
   sekali buat isi field lalu dibuang.
3. **ID otomatis — urut atau acak (pola lama `idAcak()` di
   vue-registrasi.js)?** → **Urut otomatis, prefix terpisah per
   kategori** (Recommended, dipilih Hilman). Ini pola BARU di app ini —
   `idAcak()` yang sudah ada RANDOM (`prefix + 4 digit acak`), TIDAK
   butuh transaksi. ID sequential WAJIB pakai `runTransaction()` biar
   tidak dobel kalau 2 admin submit bersamaan — dibangun dari nol
   (`generateIdBerurutan()` di file baru).
4. **Menu & role akses?** → **Grup sidebar baru "Zevanic House", admin
   ke atas** (Recommended, dipilih Hilman) = `isAdminLevel()` di rules
   (pic/admin/owner/superuser) — SAMA PERSIS gerbang role Master
   Absensi/Keuangan yang sudah ada.

### 20.2 Asumsi TAMBAHAN yang BELUM eksplisit ditanyakan (risiko rendah, gampang diubah)
Disurfacekan di sini biar Hilman bisa koreksi kalau meleset — TIDAK
ditanyakan lewat AskUserQuestion lagi karena levelnya bukan "struktural/
dampak luas" (gampang diubah tanpa migrasi data kalau salah):

- **Field baru "Kategori Utama" (Bahan / Aksesoris)** — TIDAK ADA di 13
  field asli permintaan Hilman, TAPI ditambahkan karena secara struktur
  wajib ada: field inilah yang menentukan (a) prefix ID mana dipakai
  (poin 3 di atas — 1 prefix utk Bahan, 1 lagi utk Aksesoris) dan (b)
  daftar Jenis mana yang muncul di dropdown "Jenis Bahan/Aksesoris"
  (lihat poin di bawah). Diisi lewat 2 radio button di form Entry,
  posisinya di paling atas form (sebelum semua 13 field lain).
- **"Jenis Bahan / Aksesoris" diimplementasi sebagai Master Data yang
  bisa diedit admin** — pakai komponen `MasterDataCategory` yang SUDAH
  ADA (`vue-components.js`, pola sama seperti Jenis Pekerjaan/Jabatan/
  dst), TAPI dipecah jadi 2 kategori terpisah: `master_data/jenis_bahan`
  dan `master_data/jenis_aksesoris` (dipilih otomatis sesuai Kategori
  Utama di atas). Dikelola lewat panel "Pengaturan" (ikon gear) di menu
  Entry, BUKAN menu sidebar terpisah (biar tetap persis "2 menu" sesuai
  permintaan Hilman).
- **Satuan Pembelian & Satuan Pemakaian = teks bebas**, BUKAN dropdown
  master data — satuan konveksi terlalu beragam (meter, yard, roll, kg,
  dus, pack, pcs, dst), teks bebas lebih fleksibel di tahap awal ini.
- **Foto disimpan base64 langsung di Firestore** (bukan Storage) — pola
  SAMA seperti foto absensi/reimburse, TAPI dikompres LEBIH KECIL (500px,
  kualitas 0.65 vs 1000px/0.75 di Reimburse) karena ini katalog dengan
  potensi ribuan baris, bukan bukti transaksi satu kali.

### 20.3 File yang dibangun/diubah
**File BARU**: `js/vue-bahan-aksesoris.js` — 2 komponen utama:
`BahanAksesorisEntryManager` (menu "Bahan / Aksesoris": form + popup
konversi berjenjang `PopupKonversiBerjenjang` + panel
`PengaturanBahanAksesoris`) dan `BahanAksesorisListManager` (menu "List
Bahan / Aksesoris": tabel PAGINASI CURSOR-BASED via `usePaginasiFirestore`
— sesuai `PRINSIP-HEMAT.md`, BUKAN fetch-semua-potong-di-JS seperti
`MasterKendaraanManager` lama — + modal edit + hapus).

**File DIEDIT** (menyambungkan menu baru ke kerangka app yang sudah ada,
pola persis ditiru dari Master Keuangan/`tab-keuangan`):
- `index.html` — tombol+section sidebar (`menu-zevanic-house`/-btn),
  `<div id="tab-zevanic-house">` + 2 sub-tab (`sub-zevanic-house-entry`/
  `-list`) + 2 mount point (`vue-bahan-aksesoris-entry`/`-list`), tag
  `<script>` file baru.
- `dashboard.js` — `tab-zevanic-house` ditambah ke array `tabs` di
  `pindahTab`, handler default sub-tab, `petaTabIndukPerGrup` (buat
  header konteks), `petaMount` (buat `pastikanMountBahanAksesorisEntry`/
  `-List`).
- `auth.js` (`aturTampilanBerdasarkanRole`) — `menu-zevanic-house`/-btn
  ditambah ke gerbang role yang SAMA dengan Master Absensi/Keuangan
  (pic/admin/owner/superuser).
- `vue-components.js` (`daftarMenuGroups`) — grup "Zevanic House"
  ditambah buat tampilan Home mobile, `roleBoleh` sama.
- `vue-config-akses.js` (`DAFTAR_MENU`/`KATEGORI_URUTAN`) — 2 `menuId`
  baru (`bahan_aksesoris_entry`, `bahan_aksesoris_list`) supaya bisa
  diatur granular lewat Config Akses juga (fallback: kalau belum diatur,
  default BOLEH — sama seperti menu lain).

Semua file (`node -c`) lolos verifikasi sintaks sebelum dikirim.

### 20.4 Firestore — 2 koleksi baru, BELUM ADA RULES-nya (BLOKIR sampai ditempel manual)
`master_bahan_aksesoris` (data utama) dan `pengaturan_id_bahan_aksesoris`
(2 dokumen tetap: `bahan`/`aksesoris`, field `prefix`+`counter`, dipakai
`runTransaction()`). Detail skema lengkap ada di `PETA-DATABASE.md`.

⚠️ **SENGAJA TIDAK numpang di koleksi `config`** yang sudah ada — rule
`config` di `firestore.rules` cuma boleh ditulis `isOwnerLevel()`
(owner/superuser), padahal admin/pic (yang justru dipakai entry
sehari-hari, lihat keputusan #4 di §20.1) JUGA perlu bisa atur prefix &
submit data (baca-tulis `counter`). Koleksi baru dengan rule
`isAdminLevel()` sendiri adalah solusinya, konsisten dengan pola
`master_gudang`/`master_kendaraan`/`master_shift` yang sudah ada.

**Rules tambahan SUDAH DITULIS**, dikirim ke Hilman sebagai file terpisah
`firestore-rules-tambahan-zevanic-house.txt` (Claude TIDAK BISA deploy
langsung, WAJIB Hilman tempel manual lewat Firebase Console > Firestore
Database > Rules > Publish — lihat cara di `PETA-INFRASTRUKTUR.md`):

```
match /master_bahan_aksesoris/{docId} {
  allow read: if login();
  allow write: if isAdminLevel();
}
match /pengaturan_id_bahan_aksesoris/{docId} {
  allow read: if login();
  allow write: if isAdminLevel();
}
```

**PENTING buat sesi Claude berikutnya**: kalau ada laporan bug
"permission-denied" di fitur ini, TANYAKAN/CEK DULU apakah rules di atas
SUDAH ditempel & di-Publish Hilman — JANGAN langsung menebak ada bug kode,
karena sampai catatan ini ditulis rules-nya BELUM pernah dikonfirmasi
terpasang.

### 20.5 Status: SUDAH DIKIRIM ke Hilman (23 Agt 2026 malam), BELUM ADA TES SAMA SEKALI
Yang perlu dilakukan Hilman sebelum bisa dites: (1) upload 6 file `.js`+
`index.html` ke GitHub repo, (2) tempel+publish rules tambahan di
Firebase Console (§20.4), (3) baru bisa dites end-to-end: buka menu
Zevanic House > Master Bahan & Aksesoris > atur Prefix dulu lewat ikon
gear (WAJIB, kalau belum diatur nanti muncul alert "Prefix ID belum
diatur" pas coba simpan) > isi Jenis Bahan/Aksesoris lewat panel yang
sama > baru coba entry data.

**BELUM DICOBA/DIVERIFIKASI sama sekali** (murni hasil node -c + baca
kode manual, BUKAN hasil klik-klik UI beneran): alur popup konversi
berjenjang, alur edit di List, kombinasi filter kategori + cari nama
bersamaan di List (berpotensi minta index Firestore gabungan baru —
kalau muncul error di Console browser ada link buat bikin index-nya
sekali klik, itu bukan bug).

### 20.6 Ronde 2 (23 Agt 2026, masih malam yang sama) — Data Satuan/Ukuran/Warna + dropdown pencarian + tombol Simpan & Duplikat
Permintaan Hilman (sambil kirim screenshot panel Pengaturan yang baru
dikirim di §20.1-20.5): (1) field yang "mengisi" Jenis Bahan/Jenis
Aksesoris di form perlu jadi **dropdown model searchbox** (ketik buat
filter, bukan `<select>` polos) biar enak dicari kalau daftarnya panjang;
(2) tambah 3 master data baru — **Data Satuan**, **Data Ukuran**, **Data
Warna** — Satuan & Warna dipakai di menu Master Bahan & Aksesoris, Ukuran
belum disebut dipakai di mana; ketiganya sementara 2 kolom saja (Nama +
Keterangan); (3) di form Bahan & konversi, tambah tombol **"Simpan &
Duplikat"** di samping "Simpan" — bedanya: field lain (termasuk Harga/
Satuan) TETAP bisa diedit sebelum simpan, yang biasanya beda cuma Warna.

**✅ Komponen BARU (`js/vue-components.js`, digeneralisasi supaya bisa
dipakai ulang di menu lain ke depan, bukan cuma ditaruh di file Bahan &
Aksesoris)**:
- **`DropdownCari`** — pengganti `<select>`: kotak ketik yang MEMFILTER
  opsi sambil diketik (combobox), STRICT-SELECT (cuma bisa pilih dari
  daftar yang dikasih, tidak bisa ketik bebas — kalau item belum ada,
  harus ditambah dulu lewat Master Data terkait).
- **`MasterDataTabelManager`** — beda dari `MasterDataCategory` yang
  sudah ada (itu nyimpan 1 dokumen `master_data/{kategori}` isi array
  string polos): komponen ini kelola koleksi Firestore SENDIRI (1
  dokumen per item, 2 field: `nama` + `keterangan`), props `koleksi`
  supaya generik — dipakai 3x buat Satuan/Ukuran/Warna via 3 koleksi
  baru: `master_satuan`, `master_ukuran`, `master_warna`.

**✅ Diterapkan (`js/vue-bahan-aksesoris.js`)**:
- Panel Pengaturan (ikon gear) sekarang punya 5 bagian: Prefix ID, Jenis
  Bahan, Jenis Aksesoris (3 lama) + **Data Satuan, Data Ukuran, Data
  Warna** (3 baru, pakai `MasterDataTabelManager`).
- Field **Jenis** (Entry & Edit), **Warna** (Entry & Edit — sebelumnya
  teks bebas, SEKARANG jadi dropdown dari `master_warna`), **Satuan
  Pembelian** & **Satuan Pemakaian** (Entry & Edit — sebelumnya teks
  bebas, SEKARANG dropdown dari `master_satuan`, list yang SAMA dipakai
  buat keduanya) — semua diganti dari `<select>`/`<input text>` jadi
  `<dropdown-cari>`.
- Tombol **"Simpan & Duplikat"** di sebelah "Simpan" (menu Entry) — 1
  fungsi `simpanData(duplikat)` dipakai 2 tombol. `duplikat=false`
  ("Simpan"): form dikosongkan setelah sukses (perilaku lama). `duplikat
  =true` ("Simpan & Duplikat"): form **DIPERTAHANKAN APA ADANYA**
  (kecuali Foto, sengaja dikosongkan — asumsi varian warna baru biasanya
  butuh foto beda juga) — admin tinggal ubah field yang beda (bebas,
  bisa Warna/Harga/Satuan/dll, TIDAK dikunci cuma-Warna) lalu Simpan/
  Simpan & Duplikat lagi. Selalu bikin dokumen & ID BARU (bukan update
  dokumen lama).

**ASUMSI tambahan (belum eksplisit dikonfirmasi, gampang diubah)**:
- **Data Ukuran** dibangun infrastrukturnya (koleksi `master_ukuran` +
  panel kelola di Pengaturan) TAPI **BELUM DIPAKAI di field manapun** di
  form Bahan/Aksesoris — tidak ada field "Ukuran" di 13 field asli,
  dan Hilman tidak bilang field ini dipakai di menu Bahan & Aksesoris
  (beda dari Satuan & Warna yang eksplisit disebut). Disiapkan duluan
  untuk dipakai di menu lain nanti (kemungkinan modul produksi/BOM).
- **Foto dikosongkan saat "Simpan & Duplikat"** — bukan instruksi
  eksplisit, tapi masuk akal (varian warna beda biasanya foto beda) dan
  gampang diubah kalau Hilman maunya foto ikut dipertahankan juga.
- **`DropdownCari` strict-select** (tidak bisa isi teks bebas di luar
  daftar) — konsisten dengan pola `MasterDataCategory`/dropdown lain di
  app ini (Jenis Pekerjaan, Jabatan, dst selalu dari daftar terkelola,
  bukan teks bebas).

**Firestore**: 3 koleksi baru (`master_satuan`, `master_ukuran`,
`master_warna`) — pola SAMA PERSIS `master_gudang`/`master_kendaraan`
(`allow read: if login(); allow write: if isAdminLevel();`). Rules
tambahan sudah digabung ke file `firestore.rules` LENGKAP yang dikirim
ulang (plus `firestore-rules-tambahan-zevanic-house.txt` diupdate) —
**BELUM DIPUBLISH Hilman** (sama seperti §20.4, masih 1 langkah yang
sama, cuma isinya nambah 3 match block lagi).

**Verifikasi**: `node -c` lolos di `vue-bahan-aksesoris.js` DAN
`vue-components.js`.

**Status: SUDAH DIKIRIM ulang (zip `zevanic-house-bahan-aksesoris.zip`,
8 file: 5 `.js` + `index.html` + `firestore.rules` + 1 `.txt`), MENUNGGU
Hilman upload+publish+tes** — BELUM ADA TES SAMA SEKALI, sama seperti
§20.5 (fitur ini dari awal belum pernah benar-benar dicoba end-to-end).

---

## 21. Update 24 Agt 2026 — FITUR BARU: "Zevanic House > Persiapan Masalah" + "Stock & Pembelian" (Alias Pembelian, List/Nota Order Belanja) + sidebar bertingkat

Permintaan Guru (nama panggilan BARU mulai sesi ini — bukan "Bapak" lagi),
kirim 2 screenshot: (1) referensi sidebar bertingkat/collapsible (grup
"Pembelian" dst dengan anak menu di dalamnya), (2) mockup layar "List
Order Belanja" ala kasir. Permintaan verbatim (disingkat): sidebar Zevanic
House diubah jadi (1) "Data Bahan & Aksesoris" (Entry+List, sudah ada,
cuma dipindah), (2) "Stock & Pembelian" isinya Alias Pembelian + List
Order Belanja (mirip kasir, 2 grup: "Daftar Permintaan Bahan & Aksesoris"
sumber dari Persiapan Masalah, dan "Daftar Order Belanja" entry manual
Suplayer+Qty+Nama Barang, Suplayer terkunci sampai diganti) + Nota Order
Belanja (sama tapi grup pertama dilabel "Daftar Pesanan..." dan tombol
(+) otomatis masuk ke Daftar Order Belanja) + tabel "Daftar Pesanan
Pembelian" ditambah checkbox+tombol Hapus di samping Batal.

### 21.1 Keputusan desain — dikonfirmasi Guru lewat AskUserQuestion (4 pertanyaan) SEBELUM mulai coding

1. **Menu "Persiapan Masalah" (sumber Daftar Permintaan) — bangun versi
   sederhana sekarang, atau placeholder kosong dulu?** → **Bangun versi
   sederhana sekarang** (dipilih Guru). Jadi §21.3 di bawah SUDAH termasuk
   modul ini, BUKAN cuma disiapkan tempatnya.
2. **Kolom cross-check "stok sebelum beli" di tabel Daftar Pesanan
   Pembelian?** → **Skip dulu** (belum ada modul stok, gampang ditambah
   nanti begitu modul stok ada).
3. **Tombol PENDING/DR.PENDING & data penyimpanannya — ini yang PALING
   PENTING, Guru TIDAK memilih opsi siap saji, tapi menjelaskan &
   balik nanya ke Claude:** "Pending = simpan sebagai draft (didalamnya
   nanti ada daftar jg yg masih draft). Dr Pending kita hapus dlu, karena
   nanti data yg disimpan ini harus ada data yg menampungnya termasuk
   approvalnya, baiknya gmn?"
   → **REKOMENDASI Claude yang dipakai** (dijelaskan ke Guru di jawaban
   sesi ini, BUKAN ditanya ulang lewat AskUserQuestion lagi karena Guru
   sudah eksplisit minta rekomendasi, bukan sedang menunda keputusan):
   1 koleksi `pesanan_pembelian`, field `status` cuma **2 nilai**: `draft`
   (tombol **Pending** — boleh belum lengkap, muncul di dropdown "No.
   Pembelian" sebagai daftar draft yang bisa dilanjutkan — inilah "daftar
   yg masih draft" yang dimaksud Guru) dan `final` (tombol **Simpan** —
   order dianggap resmi/jadi). **Tombol DR.PENDING DIHAPUS** sesuai
   permintaan eksplisit. **BELUM ada tahap approval terpisah** (mis.
   Owner approve dulu baru boleh lanjut) di versi ini — alasannya: Qty di
   tabel ini BELUM menambah stok apapun (poin 2 di atas, modul stok belum
   ada), jadi belum ada risiko nyata yang butuh "rem" approval. Field
   `status` ini SENGAJA dirancang gampang ditambah 1 tahap lagi nanti
   (mis. `'menunggu_approval'` di antara draft dan final) TANPA bongkar
   struktur data — pola sama seperti field `tahap` di koleksi `reimburse`
   yang sudah ada (menunggu_admin_finance → menunggu_pic →
   menunggu_owner). **Kalau nanti Qty di sini mulai benar-benar menambah
   stok (modul stok dibangun), tahap approval ini WAJIB dipertimbangkan
   ulang** — dicatat di sini supaya sesi Claude berikutnya tidak lupa.
4. **Master Suplayer — bangun baru atau ada yang mau dipakai ulang?** →
   **Bangun baru, dikelola mirip Data Satuan/Warna** (Recommended,
   dipilih Guru) — pakai `MasterDataTabelManager` yang sudah ada, DIPERLUAS
   1 kolom opsional (field ke-3, "Kontak/Alamat") karena Suplayer butuh 3
   kolom bukan 2 seperti Satuan/Ukuran/Warna.

### 21.2 Desain TAMBAHAN yang belum eksplisit ditanyakan (risiko rendah, gampang diubah)

- **Sidebar bertingkat/collapsible** — pola BARU di app ini (`js/dashboard.js`
  fungsi `toggleNavGroup()`, murni vanilla JS buka/tutup `<div>` + putar
  ikon chevron). SENGAJA CUMA diterapkan di grup "Zevanic House" — grup
  sidebar lain (Master Absensi/Keuangan/Karyawan/Integrasi) TIDAK
  disentuh/diubah, tetap 1 tombol datar seperti sebelumnya.
- **Navigasi di dalam tab Zevanic House SEKARANG murni lewat sidebar** —
  baris tombol sub-tab lama di ATAS konten (mis. "Bahan / Aksesoris" |
  "List Bahan / Aksesoris") DIHAPUS, karena sidebar sekarang sudah
  menyediakan akses langsung ke tiap sub-menu (Entry/List/Persiapan
  Masalah/Alias Pembelian/List Order Belanja/Nota Order Belanja) —
  meniru pola di screenshot referensi Guru (semua navigasi lewat
  sidebar, bukan tab di dalam halaman).
- **"Persiapan Masalah" field "Nama Bahan/Aksesoris" WAJIB pilih dari
  Data Bahan & Aksesoris yang sudah ada** (dropdown pencarian
  `DropdownCari`, BUKAN teks bebas) — supaya nyambung datanya ke Alias
  Pembelian & Order Belanja (butuh `bahan_aksesoris_id` yang valid).
  Konsekuensi: kalau ada kebutuhan barang yang BELUM ada di Data Bahan &
  Aksesoris, harus ditambah dulu di sana sebelum bisa dicatat di
  Persiapan Masalah — belum ada jalur "barang baru langsung dari sini".
- **"Nama Barang" di quick-entry Daftar Order Belanja juga WAJIB pilih
  dari daftar** (gabungan nama internal — BELUM termasuk alias per-
  suplayer secara otomatis di dropdown-nya, staf tetap bisa lihat nama
  aslinya lewat menu Alias Pembelian kalau nama di nota beda). Harga,
  Satuan Bahan, Satuan, dan QTY-s (qty × isi_konversi_pembelian) DIISI
  OTOMATIS dari data Bahan/Aksesoris begitu Nama Barang dipilih — Harga
  masih bisa diedit manual per baris kalau harga beli kali ini beda dari
  harga default.
- **Kolom "stok sebelum beli" (di-skip, poin 2 §21.1) DIGANTI kolom
  QTY-s + Satuan** (bukan kolom kosong) — ini BUKAN fitur cross-check
  stok, cuma konversi satuan (qty beli × isi konversi = qty pakai),
  field ini SUDAH ADA strukturnya di `master_bahan_aksesoris` jadi wajar
  ditampilkan di sini juga, tidak melanggar keputusan skip stok.
- **Tombol Cetak = buka tab baru berisi HTML sederhana lalu
  `window.print()`** (bukan print CSS di halaman dashboard yang rumit) —
  kolom checkbox & QTY-s/Satuan (kolom kerja internal) SENGAJA TIDAK ikut
  dicetak, cuma kolom yang relevan buat Suplayer (No/Suplayer/SKU/Nama/
  Qty+Satuan Bahan/Harga/Jumlah/Keterangan) — menjawab permintaan Guru
  "saat di print kolom tersebut tidk ikut tercetak".
- **1 dokumen `pesanan_pembelian` boleh berisi item dari BEBERAPA
  Suplayer sekaligus** — field "Suplayer" ada di level TIAP BARIS
  (bukan 1 level dokumen), karena tabel "Daftar Pesanan Pembelian" di
  screenshot referensi punya kolom Suplayer per baris. "Suplayer
  terkunci" (permintaan Guru) diartikan sebagai: field entry-nya TIDAK
   direset otomatis setelah tiap "Tambah" (cuma Qty & Nama Barang yang
  reset) — TETAP bisa diganti manual kalau baris berikutnya dari
  Suplayer lain.
- **Item per Pesanan Pembelian disimpan sebagai array di DALAM 1
  dokumen** (bukan sub-koleksi terpisah) — konsisten prinsip hemat,
  jumlah baris per order diasumsikan wajar kecil.
- **SKU di tabel = ID Bahan/Aksesoris internal** (mis. `BHN-0001`, hasil
  `generateIdBerurutan()` dari §20) — bukan field terpisah baru.

### 21.3 File yang dibangun/diubah

**File BARU**:
- `js/vue-persiapan-masalah.js` — `PersiapanMasalahManager`: form entry
  (Nama dari dropdown Data Bahan & Aksesoris, Qty, Satuan auto-isi,
  Keterangan) + tabel "Menunggu" + tabel "Riwayat Sudah Dipesan"
  (collapsible). Koleksi `persiapan_masalah`, field `status`
  (`menunggu`/`sudah_dipesan` — yang kedua ditandai OTOMATIS dari
  `vue-stock-pembelian.js` saat item dipakai lewat Nota Order Belanja,
  BUKAN diubah manual di sini).
- `js/vue-stock-pembelian.js` — 4 komponen: `MasterSuplayerManager`
  (pembungkus `MasterDataTabelManager`), `PengaturanStockPembelian`
  (panel gear: prefix No. Pembelian + Master Suplayer, dipakai di ke-3
  menu), `AliasPembelianManager` (menu "Alias Pembelian"),
  `OrderBelanjaScreen` (dipakai BARENG lewat prop `mode-nota` buat "List
  Order Belanja" `false` dan "Nota Order Belanja" `true` — SATU
  komponen, BUKAN 2 file/komponen terpisah, supaya logic tidak dobel).

**File DIEDIT**:
- `js/vue-components.js` — `MasterDataTabelManager` DIPERLUAS: props baru
  opsional `field3Key`/`field3Label` (kalau kosong, perilaku PERSIS sama
  seperti sebelumnya — Data Satuan/Ukuran/Warna TIDAK terpengaruh sama
  sekali; kalau diisi, muncul input ke-3 — dipakai Master Suplayer untuk
  "Kontak/Alamat").
- `index.html` — sidebar Zevanic House dirombak jadi bertingkat (lihat
  §21.2), 4 mount point baru (`vue-persiapan-masalah`, `vue-alias-
  pembelian`, `vue-list-order-belanja`, `vue-nota-order-belanja`) + 4
  `<div class="sub-zevanic-house-content ...">` baru, 2 tag `<script>`
  file baru.
- `js/dashboard.js` — fungsi baru `toggleNavGroup()` (buka/tutup grup
  sidebar bertingkat), 4 entry baru di `petaMount`
  (`pastikanMountPersiapanMasalah`/`AliasPembelian`/`ListOrderBelanja`/
  `NotaOrderBelanja`).
- `js/auth.js` — 2 ID tombol sidebar baru (`menu-zevanic-persiapan-btn`,
  `menu-zevanic-stock-btn`) ditambah ke gerbang role `isAdminLevel()`
  yang SAMA seperti `menu-zevanic-house-btn` (sekarang jadi toggle grup
  "Data Bahan & Aksesoris", bukan tombol tunggal lagi).
- `js/vue-config-akses.js` — 5 `menuId` baru di kategori "Zevanic House"
  (`persiapan_masalah`, `master_suplayer`, `stock_alias_pembelian`,
  `stock_list_order_belanja`, `stock_nota_order_belanja`). Label
  `bahan_aksesoris_entry`/`_list` diupdate jadi "Entry.../List Bahan &
  Aksesoris" (cuma teks label, **id TIDAK diubah** — supaya akses_config
  yang sudah tersimpan per-user TIDAK ikut kereset/hilang).

Semua file (`node -c`) lolos verifikasi sintaks. `index.html` dicek
manual keseimbangan tag `<div>`/`</div>` (sempat kelihatan tidak
seimbang gara-gara ada literal `<div>` di dalam komentar HTML — SUDAH
diperbaiki teksnya, hasil akhir seimbang 110/110).

### 21.4 Firestore — 5 koleksi baru, BELUM ADA RULES-nya (BLOKIR sampai ditempel manual)

`persiapan_masalah`, `master_suplayer`, `alias_pembelian`,
`pesanan_pembelian`, `pengaturan_id_pembelian` — semua pola SAMA:
`allow read: if login(); allow write: if isAdminLevel();`. Sudah
digabung ke file `firestore.rules` LENGKAP yang dikirim ulang (dan
`firestore-rules-tambahan-zevanic-house.txt` — cuma berisi tambahan
ronde 1+2, BELUM diupdate isi ronde 3 ini, tapi file `firestore.rules`
lengkap SUDAH termasuk — pakai file itu). Detail skema field tiap
koleksi ada di `PETA-DATABASE.md`.

**PENTING buat sesi Claude berikutnya**: kalau ada laporan
"permission-denied" di salah satu dari 5 koleksi baru ini ATAU di 5
koleksi ronde 1+2 (`master_bahan_aksesoris`, dst, §20.4/20.6) — CEK DULU
status publish rules-nya ke Guru, JANGAN langsung menebak bug kode.

### 21.5 Status: SUDAH DIKIRIM ke Guru (24 Agt 2026), BELUM ADA TES SAMA SEKALI

Sama seperti §20/§20.6 — murni hasil `node -c` + baca kode manual, BELUM
pernah diklik-klik di browser beneran. Yang perlu Guru lakukan sebelum
bisa tes: (1) upload semua file `.js` yang berubah + `index.html` ke
GitHub, (2) tempel+publish `firestore.rules` LENGKAP (bukan cuma yang
`.txt`) di Firebase Console, (3) urutan tes yang masuk akal: buka
"Pengaturan" (ikon gear) di Alias Pembelian ATAU List/Nota Order
Belanja dulu → atur Prefix No. Pembelian + tambah minimal 1 Master
Suplayer → coba Persiapan Masalah (tambah 1 permintaan) → coba List
Order Belanja (entry manual) → coba Nota Order Belanja (klik (+) dari
Daftar Pesanan, cek status Persiapan Masalah otomatis pindah "sudah
dipesan") → coba Simpan (final) & Pending (draft, cek muncul di dropdown
No. Pembelian) → coba Cetak.

**BELUM DICOBA/DIVERIFIKASI sama sekali**: alur lengkap draft→lanjut
edit→final, alur checkbox+Hapus Terpilih, kombinasi banyak Suplayer
dalam 1 Pesanan Pembelian, tombol Cetak (popup blocker browser bisa
mengganggu — sudah ada alert kalau popup diblokir, tapi belum dicoba
beneran), dan performa `AliasPembelianManager`/`OrderBelanjaScreen`
kalau Data Bahan & Aksesoris sudah ratusan/ribuan baris (saat ini fetch
semua sekaligus, belum paginasi — cukup untuk skala awal, PERLU
DIREVISI kalau datanya sudah besar).

### 21.6 Revisi 24 Agt 2026 (masih hari yang sama) — struktur sidebar DIROMBAK ULANG, seragam ke SEMUA grup

Begitu §21.1-21.5 dikirim, Guru langsung koreksi struktur sidebarnya
(BELUM sempat dites — jadi ini revisi atas kode yang belum pernah
dicoba, bukan atas bug). Permintaan Guru (verbatim, disingkat): "parent
= group menu (master absensi, master keuangan, master karyawan, zevanic
house, integrasi), sub menu = contoh absensi, keuangan, karyawan, Data
Bahan & Aksesoris, Stock Pembelian, Whatsapp, Mail Gateway. Yg muncul di
sidebar itu menurut parent > dibawah parent nanti ada sub menu. Di
samping parent nanti ada minimize dan maximize. Untuk child menu tetap
pada masing2 sub Menu supaya rapih."

**Yang berubah dari desain §21.2 (sidebar bertingkat versi PERTAMA,
SEKARANG DIGANTI)**: sebelumnya cuma grup Zevanic House yang dibuat
bertingkat, dan SEMUA anak (termasuk child level 3 seperti Entry/List,
Alias Pembelian/List/Nota Order Belanja) langsung naik ke sidebar
(flat, 6 tombol nested di 1 level). Guru MINTA ini direvisi jadi 3
tingkat yang jelas bedanya:
1. **Parent** (grup menu: Master Absensi/Keuangan/Karyawan/Zevanic
   House/Integrasi) — SEKARANG SEMUA grup punya tombol collapse/expand
   sendiri (bukan cuma Zevanic House), pola SERAGAM.
2. **Sub-menu** (nested di bawah parent, mis. "Absensi", "Keuangan",
   "Karyawan", "Data Bahan & Aksesoris", "Persiapan Masalah", "Stock &
   Pembelian", "WhatsApp", "Mail Gateway", "List Device Kiosk") — SATU
   tombol = SATU tab/halaman.
3. **Child menu** (mis. Entry/List di dalam "Data Bahan & Aksesoris",
   Alias Pembelian/List/Nota Order Belanja di dalam "Stock &
   Pembelian") — **DIKEMBALIKAN ke dalam halaman masing-masing** (baris
   tombol tab DI ATAS konten, pola LAMA yang sempat dihapus di §21.2) —
   BUKAN naik ke sidebar. Ini juga otomatis membereskan Master Absensi/
   Keuangan/Karyawan yang SUDAH PUNYA banyak child di dalam tab-nya
   (Config Absensi/Penjadwalan/dst) — TIDAK disentuh sama sekali, sudah
   otomatis sesuai pola yang diminta Guru.

**Implementasi**:
- `js/dashboard.js` — `toggleNavGroup()` DIROMBAK jadi **accordion**
  (buka 1 parent, otomatis tutup yang lain) lewat fungsi baru
  `setGrupSidebarTerbuka(groupId)`, dicari generik lewat atribut
  `data-group` di tiap tombol parent (BUKAN daftar id di-hardcode) —
  supaya kalau nanti ada grup baru, tinggal tambah tombol+`data-group`
  di `index.html`, tidak perlu edit `dashboard.js` lagi. Fungsi baru
  `bukaGrupSidebarUntukTab(tabId)` (peta `petaGrupSidebarPerTab`)
  dipanggil dari `pindahTab()` supaya begitu pindah tab (klik sub-menu,
  tombol back/forward, dst), parent yang relevan OTOMATIS ikut
  kebuka — tidak ada sidebar "nyasar" ke grup lain.
- `index.html` — SEMUA 5 label section (`gc-nav-section` div) diubah
  jadi tombol parent (`<button onclick="toggleNavGroup(...)"`, ikon
  chevron di kanan), id-nya **DIPERTAHANKAN SAMA** (`menu-admin-acc`,
  `menu-keuangan`, `menu-superuser`, `menu-zevanic-house`,
  `menu-whatsapp`) — jadi **`js/auth.js` TIDAK PERLU diubah sama
  sekali**, gerbang role per grup tetap jalan seperti sebelumnya cuma
  elemen HTML-nya beda tipe tag. Sub-menu tiap grup dibungkus `<div
  data-group="...">` terpisah (mulai tertutup, dibuka lewat accordion).
  Tab `tab-zevanic-house` sekarang berisi 3 sub-menu content
  (`sub-zevanic-house-databahan`/`-persiapan`/`-stock`, grup
  `sub-zevanic-house`), 2 di antaranya (databahan, stock) punya baris
  tab child SENDIRI di dalamnya (grup `sub-zh-databahan` dan
  `sub-zh-stock`).
- `petaMount`, `petaTabIndukPerGrup` di `dashboard.js` disesuaikan ke
  id-id content yang baru (`sub-zh-databahan-entry`/`-list`,
  `sub-zh-stock-alias`/`-listorder`/`-notaorder`,
  `sub-zevanic-house-persiapan` tetap).

**File yang berubah round ini**: `index.html`, `js/dashboard.js` SAJA
(`js/auth.js` TIDAK berubah — lihat alasan di atas). `node -c` lolos,
keseimbangan tag `<div>`/`</div>` & `<button>`/`</button>` dicek manual
(112/112 dan 47/47).

**Status: SUDAH DIKIRIM ulang ke Guru (24 Agt 2026), MASIH BELUM ADA TES
SAMA SEKALI** (revisi struktural di atas kode yang dari awal belum
pernah dicoba end-to-end — urutan tes yang disarankan §21.5 MASIH
BERLAKU, ditambah: cek accordion sidebar cuma 1 grup terbuka sekaligus,
cek parent yang benar otomatis kebuka pas pindah tab/klik tombol back).

**UPDATE**: Guru SUDAH terapkan §21 + §21.6 dan konfirmasi jalan (kirim
screenshot sidebar bertingkat + popup Konversi Berjenjang + panel
Pengaturan, semua tampil dengan data asli: TALI, CM/METER/PCS/YARD,
BURGUNDY). Fitur Persiapan Masalah/Stock & Pembelian §21 BELUM
dikonfirmasi dites end-to-end (screenshot baru menunjukkan sidebar +
form Bahan/Aksesoris jalan), TAPI strukturnya sudah live di kode Guru.

### 21.7 Revisi 24 Agt 2026 — Satuan awal/tujuan di popup "Konversi Berjenjang" jadi dropdown pencarian

Guru minta (sambil kirim screenshot popup Konversi Berjenjang & panel
Pengaturan yang sudah jalan): field "Satuan awal" & "Satuan tujuan" di
popup `PopupKonversiBerjenjang` (dibuka dari tombol "Konversi Banyak
Tingkat" di form Entry/Edit) diubah dari teks bebas jadi
searchbox+dropdown, opsi diambil dari Data Satuan (sama seperti field
Satuan Pembelian/Pemakaian di form utama, §20.6).

**Implementasi** (`js/vue-bahan-aksesoris.js`): `PopupKonversiBerjenjang`
ditambah props baru `opsiSatuan` (array) + `components: { DropdownCari }`,
2 `<input type="text">` (`b.dari`/`b.ke`) diganti `<dropdown-cari>`. Kedua
titik pemanggilan (`BahanAksesorisEntryManager` & `BahanAksesorisListManager`
modal Edit) ditambah `:opsi-satuan="opsiSatuan"` / `:opsi-satuan="opsiSatuanEdit"`
— keduanya SUDAH punya list ini (dipakai juga di field Satuan Pembelian/
Pemakaian), jadi tidak perlu fetch baru. `node -c` lolos. Cache-bust
`vue-bahan-aksesoris.js?v=3` (dari `v=2`) di `index.html` — WAJIB, kalau
tidak browser Guru bisa masih pakai versi lama dari cache.

**Konsekuensi**: sama seperti field Satuan lain (strict-select, DropdownCari)
— kalau satuan yang mau dipakai di konversi berjenjang belum ada di Data
Satuan, harus ditambah dulu lewat panel Pengaturan (gear), baru bisa
dipilih di popup ini.

**File yang berubah**: `js/vue-bahan-aksesoris.js`, `index.html` (cuma
baris `<script>` cache-bust). SUDAH DIKIRIM ulang (zip yang sama,
`zevanic-house-stock-pembelian.zip`), BELUM DITES.

### 21.8 Revisi 24 Agt 2026 — 4 field jadi 1 baris grid + field itu HILANG kalau Konversi Banyak Tingkat dipakai

Guru kirim 2 screenshot form Entry "Data Bahan & Aksesoris" (Harga
Pembelian/Satuan Pembelian/Isi Konversi Pembelian/Satuan Pemakaian
sejajar 1 baris) + minta 2 hal:
1. 4 field itu jadi 1 baris grid (bukan 2 baris seperti sebelumnya),
   urutan kiri→kanan: Harga Pembelian → Satuan Pembelian → Isi Konversi
   Pembelian → Satuan Pemakaian. Pola sama diterapkan ke tata-letak baris
   di popup "Konversi Banyak Tingkat" (jadi grid 4 kolom: Satuan awal /
   Jumlah / Satuan tujuan / tombol hapus).
2. **Kalau Konversi Banyak Tingkat sudah dipakai/diterapkan, ke-4 field
   itu HILANG dari form utama.**

**Sempat ditanyakan balik ke Guru** (lewat AskUserQuestion) karena poin 2
punya risiko: Harga Pembelian itu WAJIB diisi tapi TIDAK ADA di popup
konversi (popup cuma urus satuan+jumlah konversi, bukan harga) — kalau
field-nya hilang tanpa gantinya, form jadi tidak bisa disimpan sama
sekali. Guru jawab: **"kalau popup konversi banyak tingkat dipakai, semua
4 field hilang dan digantikan dengan field yang ada pada popup"** — jadi
keputusannya: Harga Pembelian DIPINDAH jadi field DI DALAM popup, bukan
dihapus.

**Implementasi** (`js/vue-bahan-aksesoris.js`):
- `PopupKonversiBerjenjang` ditambah 1 field baru "Harga Pembelian (Rp)"
  di paling atas popup (prop baru `harga` + emit `update:harga`, two-way
  bind ke `form.harga_pembelian` / `formEdit.harga_pembelian` langsung
  dari parent — jadi begitu diketik di popup, langsung update form,
  TANPA nunggu tombol "Terapkan").
- Baris per-tingkat konversi (Satuan awal/Jumlah/Satuan tujuan/tombol
  hapus) diubah dari flexbox ke **CSS grid 4 kolom** (`1fr 64px 1fr
  30px`), sesuai permintaan "4 grid" — dilengkapi label kolom (SATUAN
  AWAL / JUMLAH / SATUAN TUJUAN) di atas baris pertama biar tetap jelas
  tanpa tanda "=" seperti versi lama.
- Form Entry & Edit: 4 field (Harga Pembelian/Satuan Pembelian/Isi
  Konversi Pembelian/Satuan Pemakaian) sekarang grid 4 kolom 1 baris
  (`grid-template-columns:repeat(4,1fr)`) — TAPI cuma tampil kalau
  `form.konversi_bertingkat` KOSONG. Kalau `form.konversi_bertingkat`
  ADA ISI (artinya Konversi Banyak Tingkat sudah "Diterapkan" minimal
  sekali), ke-4 field itu diganti kotak ringkasan (background krem)
  berisi: Harga Pembelian (nilai, dari form, sudah diisi lewat popup),
  Rincian konversi (baris per tingkat, format sama seperti sebelumnya:
  "1 Dus = 12 Pack"), Isi Konversi Pembelian & Satuan Pemakaian (hasil
  otomatis) — plus 2 tombol kecil: pensil (buka lagi popup buat ubah)
  dan silang/hapus (kembali ke 4 field manual, TANPA menghapus nilai
  yang sudah ada — cuma flag `konversi_bertingkat` dikosongkan lagi,
  supaya Guru tinggal edit manual dari situ kalau perlu, bukan mulai
  dari nol).
- **Perbaikan tambahan yang WAJIB** (ditemukan sendiri sambil coding,
  bukan diminta eksplisit): sebelumnya `terapkanKonversi()` cuma ngisi
  `Satuan Pemakaian` otomatis dari baris terakhir popup, dan `Satuan
  Pembelian` TIDAK PERNAH diisi otomatis dari baris pertama popup (dulu
  tidak masalah karena field itu masih kelihatan & bisa diisi manual
  paralel). Sekarang karena field-nya BISA HILANG, kalau tidak diisi
  otomatis, Simpan bisa gagal terus dengan pesan "Pilih Satuan Pembelian
  dulu" padahal field-nya sudah tidak kelihatan — jadi sekarang
  `Satuan Pembelian` & `Satuan Pemakaian` SELALU ditimpa otomatis dari
  baris pertama/terakhir popup tiap kali tombol "Terapkan" dipencet.
  Popup juga sekarang validasi Harga Pembelian (>0) dulu sebelum bisa
  "Terapkan".
- Margin Modal dipindah ke baris sendiri (di luar grid 4 kolom), sesuai
  posisi di screenshot Guru.
- Cache-bust `vue-bahan-aksesoris.js?v=4` (dari `v=3`) di `index.html`.
  `node -c` lolos + cek keseimbangan tag div/button/span/p/label/h3
  (semua balance).

**Cara reset kalau salah pakai popup**: tombol silang di kotak ringkasan
("Hapus & isi manual") — konfirmasi dulu, lalu `konversi_bertingkat`
dikosongkan dan 4 field manual muncul lagi (isinya tetap ada, tinggal
diedit).

**File yang berubah**: `js/vue-bahan-aksesoris.js`, `index.html` (cache-
bust). SUDAH DIKIRIM ulang (zip yang sama, `zevanic-house-stock-
pembelian.zip`), BELUM DITES sama sekali — tolong tes alur: (1) isi form
manual biasa (tanpa popup) → Simpan, pastikan masih jalan seperti biasa;
(2) klik "Konversi Banyak Tingkat" → isi Harga Pembelian + minimal 1
baris satuan → Terapkan → cek 4 field lama hilang, ringkasan muncul
dengan angka yang benar → Simpan → cek data tersimpan benar di Firestore
(`harga_pembelian`, `satuan_pembelian`, `isi_konversi_pembelian`,
`satuan_pemakaian`, `konversi_bertingkat` semua terisi benar); (3) coba
tombol pensil (ubah lagi) dan tombol silang (hapus & isi manual) di
kotak ringkasan, pastikan keduanya jalan sesuai harapan; (4) ulangi (2)-
(3) di menu List → Edit (modal edit), bukan cuma di Entry.

### 21.9 Revisi 24 Agt 2026 (lanjutan §21.8, hari sama) — tombol "Konversi Banyak Tingkat" dipindah ke bawah

Guru kirim screenshot: tombol kalkulator kecil yang nempel di sebelah
input "Isi Konversi Pembelian" (hasil §21.8) dianggap ganggu tata letak
grid 4 kolom. Guru minta tombolnya dipindah ke bawah.

**Implementasi** (`js/vue-bahan-aksesoris.js`, Entry & Edit):
- Cell "Isi Konversi Pembelian" di grid 4 kolom sekarang cuma input
  angka polos (tombol kalkulatornya dicabut dari situ).
- Tombol "Konversi Banyak Tingkat" (full label, bukan cuma ikon) sekarang
  ditaruh di baris yang sama dengan "Margin Modal", di sebelah kanannya
  (flex row: Margin Modal mengisi sisa ruang, tombol di ujung kanan) —
  sesuai posisi di screenshot Guru. Tombol ini otomatis ikut hilang kalau
  Konversi Banyak Tingkat sedang aktif (v-if sama seperti grid 4 field),
  karena aksesnya sudah dari tombol pensil di kotak ringkasan.
- Cache-bust `vue-bahan-aksesoris.js?v=5` (dari `v=4`). `node -c` lolos +
  cek keseimbangan tag (div/button/span/p/label/h3 semua balance).

**File yang berubah**: `js/vue-bahan-aksesoris.js`, `index.html` (cache-
bust). SUDAH DIKIRIM ulang (zip yang sama, `zevanic-house-stock-
pembelian.zip`), BELUM DITES.

### 21.10 Revisi 24 Agt 2026 (lanjutan §21.9, hari sama) — popup Konversi Banyak Tingkat jadi 5 grid

Guru kirim screenshot popup (field "Harga Pembelian" masih di baris
terpisah di atas, baru di bawahnya baris Satuan Awal/Jumlah/Satuan
Tujuan/hapus) + minta digabung jadi 1 grid 5 kolom, urutan kiri→kanan:
Harga Pembelian → Satuan Awal → Jumlah → Satuan Tujuan (kolom ke-5 =
tombol hapus, seperti sebelumnya).

**Implementasi** (`PopupKonversiBerjenjang`, `js/vue-bahan-aksesoris.js`):
- Grid baris per-tingkat diperlebar dari 4 kolom (`1fr 64px 1fr 30px`)
  jadi 5 kolom (`1fr 1fr 64px 1fr 30px`), kolom pertama = Harga Pembelian.
- Karena Harga Pembelian cuma 1 nilai (bukan per-tingkat/per-baris),
  input-nya CUMA ditampilkan di baris pertama (`v-if="i === 0"`) — baris
  ke-2 dst kolom pertamanya kosong (`<span></span>`, jaga grid tetap rapi
  sejajar). Kalau baris pertama dihapus, baris berikutnya otomatis jadi
  index 0 dan Harga Pembelian pindah nongol di situ — data harga sendiri
  TIDAK ikut hilang/pindah, karena tetap bersumber dari `form.harga_
  pembelian` lewat prop `harga`/emit `update:harga`, cuma soal DI BARIS
  MANA input-nya dirender.
- Label kolom (HARGA PEMBELIAN / SATUAN AWAL / JUMLAH / SATUAN TUJUAN)
  jadi 1 baris header di atas grid, gantiin label `<div class="gc-field">`
  yang lama.
- Lebar modal ditambah dikit (`max-width:560px` → `640px`) supaya 5
  kolom tidak terlalu sempit.
- Cache-bust `vue-bahan-aksesoris.js?v=6` (dari `v=5`). `node -c` lolos +
  cek tag balance (div/button/span/p/label/h3 semua OK, `<input>` self-
  closing jadi tidak dihitung penutup).

**File yang berubah**: `js/vue-bahan-aksesoris.js`, `index.html` (cache-
bust). SUDAH DIKIRIM ulang (zip yang sama, `zevanic-house-stock-
pembelian.zip`), BELUM DITES.

### 21.11 Fitur baru 24 Agt 2026 (malam, lanjutan §21.10) — Harga BERJENJANG per tingkat satuan (Dus lebih murah, Pack di tengah, Pcs/ecer lebih mahal)

Guru tanya: "kalau tiap satuan harganya beda bagaimana?" — dikonfirmasi
lewat 2 pertanyaan (AskUserQuestion) + 1 penjelasan langsung dari Guru:

1. **Yang dimaksud**: harga BERJENJANG per satuan — beli 1 Dus lebih
   murah per-unit-nya dibanding beli 1 Pack, begitu juga beli 1 Pcs
   (ecer) lebih mahal lagi. BUKAN histori harga beli ulang / BUKAN harga
   beda-beda per suplier.
2. **Harga Modal (otomatis) tetap dihitung dari Harga Pembelian PALING
   ATAS (Satuan Pembelian) dibagi Isi Konversi Pembelian** — dikonfirmasi
   eksplisit oleh Guru, TIDAK berubah dari logic sebelumnya. Harga di
   tingkat lain (Pack, Pcs) SIFATNYA REFERENSI SAJA, tidak ikut masuk ke
   rumus Harga Modal.

**Implementasi** (`PopupKonversiBerjenjang`, `js/vue-bahan-aksesoris.js`):
- Tiap baris (tingkat) di popup sekarang punya field tambahan: **"Harga
  kalau beli langsung per [Satuan Tujuan] (opsional, referensi saja)"**
  — field baru `hargaTujuan` di tiap objek baris (jadi 1 baris sekarang:
  `{ dari, jumlah, ke, hargaTujuan }`). Contoh: baris "1 Dus = 12 Pack"
  bisa diisi "Harga kalau beli langsung per Pack: Rp 11.000" (referensi,
  BEDA dari hasil bagi otomatis Harga Dus/12).
- Field ini OPSIONAL — TIDAK divalidasi wajib diisi saat "Terapkan"
  (beda dari Harga Pembelian di atas yang tetap wajib).
- Baris "Rincian" di kotak ringkasan (form Entry & Edit) sekarang ikut
  menampilkan harga referensi ini kalau diisi, format: `1 Dus = 12 Pack
  (Rp 11.000/Pack), 1 Pack = 12 Pcs (Rp 1.000/Pcs)`.
- Layout tiap baris di popup diubah: grid 5 kolom (Harga Pembelian/
  Satuan Awal/Jumlah/Satuan Tujuan/Hapus) sebagai baris utama, DITAMBAH
  1 baris kecil di bawahnya khusus field harga referensi ini (supaya
  labelnya bisa dinamis sebut nama satuan tujuannya, mis. "...per Pack"
  vs "...per Pcs" — tidak mungkin kalau dipaksa jadi kolom ke-6 dengan
  header statis).
- Cache-bust `vue-bahan-aksesoris.js?v=7` (dari `v=6`). `node -c` lolos +
  tag balance OK.

**Catatan desain PENTING untuk ke depan**: field `hargaTujuan` ini BARU
disimpan di `konversi_bertingkat` (nested di dokumen `master_bahan_
aksesoris`, BUKAN koleksi terpisah) — jadi TIDAK perlu update firestore
rules. TAPI kalau nanti ada fitur "Stock & Pembelian" yang butuh milih
beli di tingkat mana (misal beli langsung per Pack, bukan per Dus),
harga referensi ini BELUM otomatis dipakai di perhitungan manapun selain
ditampilkan — itu scope terpisah, belum dikerjakan di sini.

**File yang berubah**: `js/vue-bahan-aksesoris.js`, `index.html` (cache-
bust). SUDAH DIKIRIM ulang (zip yang sama, `zevanic-house-stock-
pembelian.zip`), BELUM DITES.

### 21.12 Revisi 24 Agt 2026 (malam, lanjutan §21.11) — urutan field Jenis/Foto/Nama/Warna + tips urutan isi popup Konversi Banyak Tingkat

Guru minta 2 hal:
1. Urutan field di form Entry & modal Edit diubah jadi: **Jenis Bahan/
   Aksesoris → Foto (opsional) → Nama Bahan/Aksesoris → Warna Bahan/
   Aksesoris** (sebelumnya: Jenis → Nama → Warna → Foto). Label "Warna"
   juga diperjelas jadi "Warna Bahan / Aksesoris" (Entry; label Edit
   tetap singkat "Warna" mengikuti gaya modal Edit yang memang ringkas).
2. Tambah catatan/tips di popup Konversi Banyak Tingkat supaya admin
   tidak salah input. **Dikonfirmasi ke Guru dulu** (AskUserQuestion)
   apakah urutan barisnya mau dibalik (kecil→besar) atau tetap besar→
   kecil cuma ditambah catatan — Guru pilih: **urutan TETAP besar→kecil
   seperti sekarang, cuma ditambah catatan/tips cara pakainya**.

**Implementasi** (`js/vue-bahan-aksesoris.js`):
- Grid 4 field Entry (`BahanAksesorisEntryManager`) & Edit
  (`BahanAksesorisListManager` modal) disusun ulang urutannya sesuai
  poin 1 di atas (cuma urutan `<div class="gc-field">` di dalam grid
  yang ditukar, tidak ada perubahan logic/binding).
- Popup `PopupKonversiBerjenjang`: ditambah 1 baris catatan tips (kotak
  kecil warna burgundy-light) di bawah paragraf contoh yang sudah ada —
  isinya: "mulai dari satuan yang PALING BESAR dulu (Satuan Pembelian,
  mis. Dus), baru turun ke yang lebih kecil tiap tambah baris (Pack,
  lalu Pcs) sampai ke Satuan Pemakaian. Jangan dibalik — biar Isi
  Konversi Pembelian otomatisnya benar dan tidak salah pilih satuan
  awal/tujuan." TIDAK ada perubahan logic (urutan baris/auto-fill tetap
  sama seperti §21.10-21.11).
- Cache-bust `vue-bahan-aksesoris.js?v=8` (dari `v=7`). `node -c` lolos +
  tag balance OK.

**File yang berubah**: cuma 2 — `js/vue-bahan-aksesoris.js` & `index.html`
(cache-bust). Mulai ronde ini, DIKIRIM sebagai zip kecil berisi 2 file
ini saja (bukan zip 9-file penuh lagi) — permintaan Guru biar tidak
capek upload banyak file kalau yang berubah cuma sedikit. SUDAH DIKIRIM,
BELUM DITES.

### 21.13 Revisi BESAR 24 Agt 2026 (malam) — Harga Pembelian jadi field PER BARIS (bukan referensi lagi) + rencana fitur "Riwayat Harga Pembelian" (BELUM dikerjakan, masih diskusi)

Guru minta redesain besar cara kerja popup Konversi Banyak Tingkat, alasan
utama: **admin yang isi data sering buru-buru/males hitung manual** — jadi
sistem yang harus hitung, admin cukup masukkan angka PERSIS seperti di
nota pembelian.

**Bagian yang SUDAH dikerjakan (jelas, tidak ambigu):**
1. Field "Harga kalau beli langsung per X (opsional, referensi saja)"
   (hasil §21.11) **DIHAPUS TOTAL** sesuai permintaan Guru.
2. "Harga Pembelian" SEKARANG field di **TIAP baris** popup (bukan cuma
   baris pertama lagi) — merekam harga NYATA sesuai nota, untuk beli 1
   Satuan Awal baris itu. Contoh dari Guru: nota tertulis "1 Dus = Rp
   1.000.000, isi 10 Pack" → admin cukup isi Harga Pembelian=1000000,
   Satuan Awal=Dus, Jumlah=10, Satuan Tujuan=Pack — TIDAK PERLU hitung
   1jt÷10 sendiri, sistem yang hitung.
3. Field baris di data model: `{ dari, jumlah, ke, harga }` — field
   `hargaTujuan` (§21.11) DIHAPUS, diganti `harga` (harga per baris,
   bukan opsional/referensi lagi — data nyata).
4. **Harga Modal tetap dihitung dari baris PALING ATAS saja**
   (`form.harga_pembelian = baris[0].harga`, TIDAK berubah dari
   keputusan §21.11) — baris ke-2 dst boleh diisi harga sendiri (mis.
   kalau suatu saat beli langsung per Pack, bukan per Dus, harganya beda/
   lebih mahal) TAPI itu cuma DATA TERCATAT, tidak ikut dihitung ke Harga
   Modal item ini. Baris kosong (harga belum diisi) tidak divalidasi wajib
   kecuali baris pertama (yang dipakai Harga Modal).
5. **Perbaikan kotak ringkasan (yang Guru sebut "kotak kuning ada
   kesalahan")**: sebelumnya cuma nulis "Total 1 satuan awal = 90 satuan
   akhir" (generik, tidak sebut nama satuannya). SEKARANG nyebut nama
   satuan asli dari data ("1 Yard = 90 CM") DITAMBAH baris baru "Harga
   per CM: Rp 239" (dihitung otomatis dari baris[0].harga ÷ total —
   inilah "sistem yang hitung" yang diminta Guru, tidak perlu admin
   bagi manual). Catatan: contoh Guru bilang "Rp 238" tapi hasil hitung
   presisi 21500÷90 = 238,89 dibulatkan jadi Rp 239 (pembulatan
   `Math.round` konsisten dengan Harga Modal di tempat lain — kemungkinan
   Guru cuma bulatkan kasar di pesannya, bukan salah rumus).
6. Catatan tips di atas popup diperbarui, tekankan "tidak perlu dihitung
   manual, sistem yang bagi otomatis".
7. Prop `harga`/emit `update:harga` di komponen `PopupKonversiBerjenjang`
   DIHAPUS (tidak perlu lagi — harga sekarang murni dari `baris[0].harga`
   saat "Terapkan" diklik, sama pola-nya seperti Satuan Pembelian/
   Pemakaian yang juga auto-ambil dari baris pertama/terakhir).
8. Baris "Rincian" di ringkasan Entry/Edit diperbarui: sekarang tampilkan
   harga per baris (kalau diisi), format "1 Dus = 10 Pack
   (Rp1.000.000/Dus)" (sebelumnya per Satuan Tujuan, sekarang per Satuan
   Awal — sesuai makna harga yang baru).
9. Cache-bust `vue-bahan-aksesoris.js?v=9` (dari `v=8`). `node -c` lolos +
   tag balance OK.

**Bagian yang BELUM dikerjakan — MASIH DISKUSI dengan Guru (jangan
tebak-tebak dulu, ini keputusan besar menyentuh banyak modul):**

Guru minta 2 hal besar tambahan:
- Menu BARU: **Zevanic House → Stock & Pembelian → "Riwayat Harga
  Pembelian"** — mencatat histori harga beli dari waktu ke waktu.
- **Auto-update Harga Pembelian di Data Bahan & Aksesoris** setiap ada
  "pembelanjaan" — ambil dari histori tsb dengan aturan: tanggal
  pembelian PALING BARU, kalau ada beberapa harga di tanggal yang sama
  pilih yang PALING MAHAL (default).

Ini BELUM dikerjakan karena ada beberapa keputusan desain yang masih
perlu dikonfirmasi Guru dulu (sudah ditanyakan lewat chat, MENUNGGU
jawaban):
1. Riwayat Harga Pembelian ini diisi OTOMATIS dari "Nota Order Belanja"
   yang di-final-kan (perlu tambah field harga aktual di situ dulu,
   karena SEKARANG `js/vue-stock-pembelian.js` cuma COPY harga dari
   master data `master_bahan_aksesoris.harga_pembelian` saat item
   ditambahkan ke Nota — BUKAN input harga sungguhan saat itu), ATAU ada
   form entry manual terpisah di menu baru itu, ATAU dua-duanya?
2. Auto-update ke Data Bahan & Aksesoris terjadi REAL-TIME (langsung
   pas Nota di-final-kan), atau lewat tombol manual ("Refresh Harga")?
3. Kalau harga dicatat di satuan yang BEDA-BEDA (mis. beli Dus tanggal
   A, beli Pack tanggal sama juga) — dibandingkan "termahal" itu SETELAH
   dikonversi ke harga per Satuan Pemakaian dulu (apples-to-apples), atau
   cuma dibandingkan kalau satuannya SAMA?

**File yang berubah (bagian yang sudah dikerjakan)**: cuma 2 —
`js/vue-bahan-aksesoris.js` & `index.html` (cache-bust). SUDAH DIKIRIM
(zip 2 file), BELUM DITES. Riwayat Harga Pembelian + auto-update BELUM
mulai dikerjakan sama sekali, menunggu jawaban Guru di atas.

### 21.14 Fitur BARU 24 Agt 2026 (malam, lanjutan §21.13) — "Riwayat Harga Pembelian" + auto-update Harga Pembelian di Data Bahan & Aksesoris — SUDAH DIKERJAKAN

Guru jawab 3 pertanyaan §21.13 lewat AskUserQuestion, SEMUA jawaban
pilih opsi "Recommended":
1. Sumber data Riwayat Harga Pembelian → **Otomatis dari Nota Order
   Belanja** (bukan form entry manual terpisah).
2. Kapan auto-update terjadi → **Real-time, langsung pas Nota
   di-final-kan** (bukan tombol manual "Refresh Harga").
3. Cara bandingkan "termahal" kalau satuan beda-beda → **Dikonversi ke
   harga per Satuan Pemakaian dulu**, baru dibandingkan.

Dengan itu, dikerjakan penuh:

**1) `pesanan_pembelian.items[]` diubah maknanya** — `harga` yang
tadinya cuma di-copy sekali dari master saat baris ditambah (§21.2),
SEKARANG jadi field "Harga Aktual": tetap PREFILL dari
`master_bahan_aksesoris.harga_pembelian` (default, biar admin tidak
mulai dari kosong), TAPI kolom di tabel "Daftar Pesanan Pembelian"
SEKARANG jadi `<input>` yang bisa diedit LANGSUNG per baris, supaya
admin bisa cocokkan ke harga NYATA di nota. Kolom "Jumlah" di tabel yang
tadinya statis (dihitung sekali pas baris ditambah) SEKARANG dihitung
LIVE (`qty × harga` tiap render) — supaya ikut kalau Harga Aktual
diedit belakangan, sebelum baru di-"final"-kan jadi angka permanen pas
`simpan()`. Field BARU `isi_konversi` — snapshot
`isi_konversi_pembelian` item itu SAAT baris ditambah (dipakai buat
normalisasi di poin 3 di bawah, SENGAJA snapshot bukan live-lookup,
supaya riwayat lama tidak berubah kalau item-nya kemudian diedit
konversinya).

**2) Menu BARU: Zevanic House → Stock & Pembelian → "Riwayat Harga
Pembelian"** (`RiwayatHargaPembelianManager`, di `js/vue-stock-
pembelian.js`) — tabel READ-ONLY, paginasi cursor-based
(`usePaginasiFirestore`, WAJIB sesuai `PRINSIP-HEMAT.md`), kolom:
Tanggal, Nama Bahan, Suplayer, Satuan Beli, Harga, Isi Konversi, Satuan
Pemakaian, Harga per Satuan Pemakaian, No. Pembelian. Ada kotak cari
(awalan nama bahan). Sub-tab BARU ditambahkan ke `index.html`
(`sub-zh-stock-riwayat`) + `petaMount` di `dashboard.js`
(`pastikanMountRiwayatHargaPembelian`) — pola SAMA PERSIS seperti
sub-tab lain di grup ini.

**3) Koleksi Firestore BARU `riwayat_harga_pembelian`** — 1 dokumen = 1
baris item yang BENAR-BENAR dibeli, ditulis OTOMATIS oleh fungsi BARU
`catatRiwayatHargaDanUpdateMaster()` tiap kali `simpan('final')` sukses
(berlaku SAMA untuk List Order Belanja MAUPUN Nota Order Belanja — Guru
tidak minta bedakan, dua-duanya representasi pembelian resmi). Field
lengkap: `bahan_aksesoris_id`, `nama_bahan`, `tanggal` (dari tanggal
Pesanan Pembelian, bukan `dibuat_pada`), `satuan`, `harga`,
`isi_konversi` (snapshot), `satuan_pemakaian`, `harga_per_satuan_
pemakaian` (**dihitung** = `harga ÷ isi_konversi` — inilah "dikonversi
ke harga per Satuan Pemakaian dulu" yang Guru pilih, dipakai
membandingkan apple-to-apple walau satuan beli beda-beda), `no_
pembelian`, `suplayer_nama`, `dibuat_pada`, `dibuat_oleh`. Penulisan ini
dibungkus try/catch TERPISAH dari penyimpanan `pesanan_pembelian` —
sengaja, supaya kalau bagian ini gagal, pesanan yang SUDAH tersimpan
sukses TETAP dilaporkan sukses ke Guru (errornya cukup dicatat ke
Console buat ditelusuri belakangan, bukan bikin Guru kira datanya
hilang padahal sebenarnya sudah tersimpan).

**4) Aturan auto-update `master_bahan_aksesoris.harga_pembelian`**
(fungsi BARU `perbaruiHargaMasterDariRiwayat()`, dipanggil otomatis
tiap 1 baris riwayat baru masuk — REAL-TIME sesuai jawaban Guru #2):
ambil SEMUA baris riwayat item itu → cari `tanggal` PALING BARU (string
compare, aman buat format `YYYY-MM-DD`) → di antara baris-baris
bertanggal SAMA itu, pilih yang `harga_per_satuan_pemakaian`-nya PALING
MAHAL (jawaban Guru #3 + aturan asli Guru "tanggal terbaru, termahal
default") → dikonversi BALIK ke `harga_pembelian` pakai `isi_konversi_
pembelian` item SAAT INI di master (BUKAN `isi_konversi` snapshot
riwayatnya — supaya `harga_modal = harga_pembelian ÷ isi_konversi_
pembelian` tetap konsisten matematis, tidak makin melenceng kalau
konversi item itu pernah diedit setelah riwayat lama dicatat) →
`harga_modal` & `harga_pemakaian` (`margin_modal` yang ada dibaca tidak
diubah) ikut ditulis ulang bareng, plus field penanda BARU `harga_
diupdate_dari_riwayat_pada` (Timestamp) — supaya kalau Guru laporkan
"kok harga berubah sendiri", bisa langsung dicek ini bukan bug.

**5) `firestore.rules`** — ditambah 1 block BARU buat
`riwayat_harga_pembelian` (pola SAMA seperti `pesanan_pembelian`:
`read: login()`, `write: isAdminLevel()`). **BELUM DITEMPEL Guru** —
sama seperti koleksi-koleksi Stock & Pembelian lain di §21.4, jadi
sebelum dites, WAJIB Guru tempel manual dulu ke Firebase Console
(publish rules), kalau tidak semua baca/tulis ke koleksi baru ini bakal
`permission-denied`.

**File yang berubah ronde ini**: `js/vue-stock-pembelian.js` (tambah
`RiwayatHargaPembelianManager` + mount function + import `usePaginasi
Firestore` + rombak `buatBarisPesanan`/`estimasiBiaya`/`simpan`/`cetak`
+ 2 fungsi baru), `index.html` (sub-tab baru + cache-bust `dashboard.js
?v=6` & `vue-stock-pembelian.js?v=2`), `js/dashboard.js` (`petaMount`
entry baru), `firestore.rules` (block baru). **TIDAK termasuk** `js/
vue-bahan-aksesoris.js` (sudah dikirim terpisah di §21.13, tidak ada
perubahan lanjutan ronde ini). Semua sudah `node -c` + tag-balance
check — lolos. **Status: SUDAH DIKIRIM ke Guru, BELUM ADA TES SAMA
SEKALI** — rencana tes yang disarankan ke Guru: (a) buat/final-kan 1
Nota Order Belanja dengan Harga Aktual yang SENGAJA beda dari harga
master → cek 1 baris baru muncul di Riwayat Harga Pembelian dengan
angka yang benar; (b) cek Data Bahan & Aksesoris item itu — Harga
Pembelian/Harga Modal/Harga Pemakaian ikut berubah sesuai baris
tersebut; (c) ulangi pembelian ke-2 di tanggal/satuan BEDA buat
memastikan aturan "tanggal terbaru + termahal ternormalisasi" benar-
benar milih baris yang tepat, bukan asal baris terakhir ditulis.

## 22. KEPUTUSAN BARU (malam 24 Agt 2026) — Riwayat browser (tombol back HP) diperluas BERTAHAP ke level Sub-menu & Child-tab, BUKAN retrofit langsung ke semua menu lama

### 22.1 Konteks — apa yang SUDAH jalan vs BELUM

Fix §19.4 (23 Agt 2026, `js/dashboard.js`) **SUDAH LIVE & DIKONFIRMASI
BEKERJA** — tapi cakupannya SENGAJA cuma level **Tab** (Home/Master
Absensi/Master Keuangan/Master Karyawan/Zevanic House/dst — bottom nav
mobile & sidebar top-level). `pindahTab()` push 1 `history` entry per
pindah tab, listener `popstate` baca balik.

**BELUM tersentuh sama sekali** (dipakai `pindahSubTab()`, fungsi
TERPISAH, dipakai bersama oleh SEMUA sub-tab & child-tab di seluruh
app): level **Sub-menu sidebar** (mis. Zevanic House → Data Bahan &
Aksesoris vs Persiapan Masalah vs Stock & Pembelian) DAN level
**Child-tab dalam 1 layar** (mis. di dalam Stock & Pembelian: Alias
Pembelian / List Order Belanja / Nota Order Belanja / Riwayat Harga
Pembelian). Klik-klik di level ini TIDAK tercatat ke riwayat browser
sama sekali — tombol back HP tetap lompat ke level Tab atau keluar app,
tidak bisa "mundur 1 child-tab" dulu.

Alasan ASLI kenapa dulu (§19.4) sengaja dibatasi ke Tab saja: (1) risiko
riwayat browser "penuh sesak" kalau tiap klik sub-tab/child-tab juga
push 1 entry — tanpa desain hati-hati, tombol back jadi harus ditekan
berkali-kali cuma buat keluar 1 layar; (2) `pindahSubTab()` dipakai
BERSAMA oleh SEMUA menu yang sudah stabil & sudah dites (Config
Absensi, Antrean, Daftar Karyawan, dst) — mengubahnya langsung ada
risiko ikut mengganggu menu-menu yang sudah jalan, bukan cuma menu yang
sedang dikerjakan.

### 22.2 Keputusan Guru (dikonfirmasi lewat AskUserQuestion + chat, 24 Agt 2026 malam)

1. **Cakupan level**: kalau/begitu diterapkan, **sampai level Child-tab
   juga** (bukan cuma level Sub-menu sidebar) — Guru pilih opsi yang
   lebih dalam/detail, BUKAN opsi minimal yang direkomendasikan Claude.
   Konsekuensinya: desain HARUS hati-hati soal riwayat "penuh sesak"
   (lihat 22.1 alasan #1) — lihat rencana desain di 22.3.
2. **Titik mulai & cara rollout** — DIPERLUAS dari jawaban awal ("menu
   BARU berikutnya saja") jadi 2 pemicu (kata Guru persis: *"dari menu
   baru dan yg tersentuh kalau ada update biar sekalian"*):
   - **Menu BARU** yang dibangun mulai sekarang — WAJIB langsung pakai
     sistem riwayat ini dari awal.
   - **Menu LAMA yang KEBETULAN sedang disentuh/diedit** untuk alasan
     lain (bug fix, revisi tampilan, fitur tambahan di layar itu) —
     SEKALIAN ditambahkan sistem riwayat ini saat itu juga, TIDAK
     ditunda ke ronde terpisah.
   - **TIDAK melakukan retrofit massal** ke SEMUA menu lama sekaligus
     dalam 1 ronde kerja — itu tetap dihindari (risiko besar, banyak
     layar tersentuh sekaligus tanpa alasan mendesak per layar).

**Ini WAJIB dijadikan PEDOMAN tetap** (kata Guru: *"catat ke status
proyek dan jadikan pedoman"*) — lihat checklist singkat yang ditambahkan
ke `PEDOMAN-GAYA-KERJA.md`, WAJIB dicek tiap kali membangun menu baru
ATAU mengedit sub-tab/child-tab menu lama untuk alasan apapun.

### 22.3 Rencana desain teknis (BELUM diimplementasikan — ditulis di sini SUPAYA konsisten begitu menu baru/tersentuh pertama muncul, bukan didesain ulang tiap kali)

**Backward-compatible, opt-in, TIDAK menyentuh perilaku menu lama yang
belum di-upgrade:**

1. **Tiap tombol sub-tab/child-tab yang ikut sistem ini WAJIB punya
   atribut `data-target="<targetId>"`** pada elemennya (id div konten
   yang dibuka) — supaya sistem bisa "menekan" tombol yang benar secara
   terprogram (pas restore dari `popstate`), tanpa perlu event klik
   sungguhan. Menu lama yang belum diupgrade tidak perlu diubah.
2. **`window.pindahSubTab(grupKelas, targetId, tombolEl, opsi)`** —
   parameter ke-4 BARU, opsional, default `{}` (kalau tidak dikirim =
   PERSIS perilaku sekarang, TIDAK mencatat riwayat apapun — SEMUA
   pemanggil lama otomatis aman, tidak perlu diubah satu pun).
   `opsi.catatRiwayat: true` → menu ini OPT-IN ke sistem riwayat.
   `opsi._dariPopstate: true` → dipasang INTERNAL oleh listener
   `popstate` sendiri saat restore, supaya tidak push entry baru lagi
   (mencegah loop — pola SAMA seperti `_dariPopstate` di `pindahTab`
   §19.4).
3. **State riwayat gabungan** — simpan `window._riwayatNavAktif` (object
   sederhana, ke-reset tiap `pindahTab` pindah ke tab BEDA): `{ tab,
   navKey, subTabs: [{grupKelas, targetId}, ...] }` — daftar SEMUA
   grup sub-tab yang ikut opt-in DAN sedang aktif saat itu (bisa lebih
   dari 1 level nested, mis. sub-menu Zevanic House + child-tab di
   dalamnya sekaligus). Tiap kali `pindahSubTab()` dipanggil dengan
   `catatRiwayat:true` (bukan dari popstate, target beda dari yang
   aktif) → update/tambah entry grup ini di `subTabs`, LALU
   `history.pushState(window._riwayatNavAktif, '', location.href)` —
   push snapshot LENGKAP tiap kali, bukan cuma delta, supaya restore-nya
   simpel & tidak gampang meleset urutan.
4. **Listener `popstate` (perluasan dari yang sudah ada di §19.4, BUKAN
   listener baru terpisah)** — baca `e.state`: kalau ada `state.tab`,
   panggil `pindahTab(state.tab, state.navKey, true)` DULU, BARU untuk
   tiap entry di `state.subTabs` (berurutan dari yang PALING LUAR/atas
   ke yang PALING DALAM/child, supaya elemen DOM tujuan yang lebih
   dalam tidak keburu ke-hidden oleh induknya) panggil `pindahSubTab(
   grupKelas, targetId, null, {catatRiwayat:false, _dariPopstate:true})`
   — `tombolEl` dikirim `null`, tombol yang benar dicari sendiri di
   dalam `pindahSubTab()` lewat `document.querySelector('.' + grupKelas
   + '-btn[data-target="' + targetId + '"]')` (makanya poin 1 di atas
   WAJIB, bukan opsional).
5. **Cara pakai di HTML (`index.html`) untuk menu BARU/tersentuh**:
   `onclick="pindahSubTab('sub-xxx', 'sub-xxx-yyy', this, {catatRiwayat:
   true})"` — 1 kata tambahan per tombol, tidak perlu ubah struktur
   HTML lain.

**Belum diverifikasi/dites SAMA SEKALI** — ini rencana desain buat
diikuti KONSISTEN, bukan kode yang sudah jalan. WAJIB benar-benar
diimplementasi & node -c + tag-balance-check begitu dipakai pertama
kali di menu baru/tersentuh, dan diberitahu jelas ke Guru bahwa bagian
riwayat browser-nya masih perlu dites manual di HP sungguhan (klik
beberapa child-tab dalam, coba tombol back berkali-kali, pastikan
urutannya masuk akal) — bukan cuma "kelihatan benar di kode".

---

## 23. Update 24 Agt 2026 (lanjutan) — bug `nama_shift` TIDAK PERNAH tercatat (root cause BEDA dari dugaan Guru) + fix List/Nota Harga + fitur BARU "Kartu Stok Bahan/Aksesoris"

Guru laporkan 1 pesan berisi 4 hal sekaligus. Sesuai aturan proyek ("jangan
bikin tebak2 jika ada bug"), poin 1 DITELUSURI lewat kode live dulu
(bukan langsung dipercaya), 3 poin lain murni permintaan/klarifikasi
desain fitur yang sudah ada + 1 fitur baru.

### 23.1 BUG — Antrean Absensi / Riwayat All Absensi / CSV tidak tampilkan Shift — root cause DIKOREKSI dari dugaan Guru

**Dugaan Guru** (verbatim): "mungkin karena pakai format jam mengikuti
firestore > maka master shift harus di update, apakah betul?" — dugaan:
format jam di `master_shift` perlu disesuaikan ke format Firestore.

**❌ Dugaan ini SALAH.** Ditelusuri lewat `git clone` fresh (metode §19.0,
WAJIB dipakai buat baca kode live, bukan cache Project) — `grep` penuh ke
`js/vue-camera.js` (SEMUA 3 titik `dataKirim` yang menulis dokumen
`absensi`: Clock In format baru, Clock Out format lama, Izin/Cuti/Lembur)
menemukan: **field `shift`/`nama_shift` TIDAK PERNAH ditulis ke dokumen
`absensi` SAMA SEKALI**, di ketiga titik itu, sejak awal. Ini BUKAN soal
format jam `master_shift` — field-nya memang tidak pernah disertakan pas
dokumen absensi dibuat.

**Konfirmasi gejala ke Guru** (AskUserQuestion): "tidak tampil jam shift"
— cocok dengan diagnosis: karena field-nya kosong, KOLOM Shift di
Riwayat/Antrean/CSV memang selalu tampil `-`/kosong.

**Temuan TAMBAHAN, lebih serius dari laporan awal Guru**: `js/vue-
antrean-absensi.js` (dibangun 19 Agt 2026) punya fungsi `muatJamShift()`
yang MEMBUTUHKAN `props.data.shift` buat query `master_shift` (ambil
`jam_masuk`/`jam_keluar`) dan MENGHITUNG OTOMATIS \"Status Kehadiran\"
(Tepat Waktu/Terlambat) dengan membandingkan jam Clock In/Out asli ke
jam shift itu. Karena field sumbernya TIDAK PERNAH ada sejak fungsi ini
dibangun, **perhitungan otomatis Status Kehadiran ini SUDAH TIDAK
PERNAH BERFUNGSI sejak 19 Agt 2026** — bukan cuma kolom Shift yang
kosong, tapi fitur yang bergantung padanya juga diam-diam mati. Ini baru
ketahuan sekarang lewat penelusuran ini, BUKAN laporan terpisah dari
Guru.

**✅ FIX**:
1. **`js/vue-camera.js`** — ditambahkan `nama_shift: window.currentUser.
   nama_shift || ''` ke SEMUA 3 blok `dataKirim` (Clock In baru, Clock
   Out lama, Izin/Cuti/Lembur) — field diambil dari profil karyawan yang
   sedang login (`window.currentUser.nama_shift`, field yang SUDAH ada
   di `users/{email}`, cuma belum pernah dipakai isi dokumen absensi).
2. **`js/vue-antrean-absensi.js`** — SEMUA referensi `.shift` diganti
   `.nama_shift` (query `master_shift` DAN template tampilan), supaya
   konsisten dengan nama field yang sekarang benar-benar ditulis, DAN
   `muatJamShift()` sekarang bisa jalan sesuai desain aslinya.
3. **`js/vue-riwayat-absensi.js`** — kolom tabel & export CSV diganti
   dari `item.shift`/`row.shift` ke `item.nama_shift`/`row.nama_shift`.
4. **Migrasi data lama** (`js/vue-riwayat-absensi.js`, tombol baru \"Cek
   Data Belum Punya Shift\" + \"Jalankan Migrasi\") — pola SAMA PERSIS
   dengan migrasi `waktu_ts` yang sudah ada (`PRINSIP-HEMAT.md`): cek
   dulu (fetch + filter dokumen `absensi` tanpa `nama_shift`), tampilkan
   jumlahnya, baru jalankan migrasi batch (`writeBatch`, 400/batch),
   aman dijalankan ulang. **Nilai yang diisi = shift KARYAWAN SAAT INI**
   (dari `users/{email}.nama_shift` saat migrasi dijalankan) — BUKAN
   shift yang sebenarnya berlaku di TANGGAL kejadian absensi lama itu
   (data itu tidak pernah dicatat, tidak bisa direkonstruksi). Warning
   eksplisit ditampilkan di UI migrasi soal keterbatasan akurasi historis
   ini, supaya Guru tidak salah kira hasil migrasi 100% akurat untuk
   catatan lama.

**Konsekuensi buat Guru**: perhitungan otomatis Status Kehadiran BARU
akan mulai jalan benar untuk absensi BARU (setelah Clock In/Out pakai
file ini) — untuk data LAMA, jalankan migrasi dulu (§23.1 poin 4), tapi
Status Kehadiran utk data lama tetap TIDAK bisa dihitung ulang otomatis
seakurat aslinya (sama keterbatasan kayak `nama_shift` migrasi di atas)
karena histori shift-per-tanggal tidak pernah tercatat.

### 23.2 Konfirmasi desain — Riwayat Harga Pembelian & Kartu Stok BENAR ikut Nota, BUKAN List

Guru konfirmasi ulang desain §21.14 yang sudah benar: "Riwayat Harga
Pembelian" mengikuti Nota Order Belanja (bukan List) — SUDAH SESUAI,
tidak ada perubahan di titik ini.

**TAPI** Guru sekaligus mengoreksi 1 bug nyata: "List Order Belanja"
(dipakai SUPIR bikin estimasi, di-APPROVAL Owner) SEBELUMNYA ikut
memicu `catatRiwayatHargaDanUpdateMaster()` juga (implementasi §21.14
awalnya menyamakan List & Nota, "Guru tidak minta bedakan" — tapi ronde
ini Guru MEMPERJELAS keduanya HARUS beda). Guru minta: Harga di List
Order Belanja **read-only, ikut master apa adanya** (dikonfirmasi lewat
AskUserQuestion — Guru pilih opsi Recommended) — TIDAK bisa diedit, dan
TIDAK memicu Riwayat Harga Pembelian / auto-update master.

**✅ FIX** (`js/vue-stock-pembelian.js`):
1. `simpan()` — pemanggilan `catatRiwayatHargaDanUpdateMaster()` SEKARANG
   digerbangi `props.modeNota` (`if (statusBaru === 'final' &&
   props.modeNota)`) — cuma Nota yang trigger, List tidak lagi.
2. Kolom Harga di tabel `OrderBelanjaScreen` — `v-if=\"modeNota\"` (input
   bisa diedit) vs `v-else` (`<span>` read-only, tooltip menjelaskan
   "List Order Belanja cuma estimasi, harga tidak bisa diedit di sini").

**Kenapa dibedakan**: List = estimasi supir sebelum approval Owner
(belum tentu jadi pembelian nyata) — harga di sana seharusnya CUMA
referensi dari master, bukan input manual yang bisa salah/beda dari
kenyataan. Nota = catatan pembelian YANG SUDAH TERJADI — di situ harga
harus bisa dikoreksi sesuai nota fisik, dan situ jugalah sumber
kebenaran buat Riwayat Harga Pembelian + auto-update master + (BARU,
lihat §23.3) Kartu Stok.

### 23.3 Fitur BARU — "Kartu Stok Bahan / Aksesoris" (Ringkasan + Detail), pembelian dari Nota, pemakaian manual

Permintaan Guru (verbatim, disingkat): "buatkan menu kartu stok bahan /
aksesoris kedepan untuk pemeblian & pemakaian pun akan ditercatat disini
data dari nota order belanja (bukan dari list order)". Desain
dikonfirmasi lewat AskUserQuestion (2 ronde, ronde 1 sempat cuma
kejawab sebagian, ditanya ulang):

1. **Tampilan stok_akhir** — HARUS muncul juga di List Bahan &
   Aksesoris (kolom baru), DAN Kartu Stok sendiri punya **2 tampilan**:
   **Ringkasan** (1 baris per item, stok_akhir terkini) dan **Detail**
   (per-item, riwayat tiap pergerakan masuk/keluar) — dipilih Guru,
   BUKAN opsi tunggal yang lebih sederhana.
2. **Sumber pemakaian** (belum ada modul Produksi/SPK di sistem ini) →
   **Form catat manual terpisah** (Recommended, dipilih Guru) — dicatat
   langsung di Kartu Stok Detail, BUKAN otomatis dari modul lain (belum
   ada).

**Desain data — 1 mekanisme atomik dipakai 2 arah** (masuk dari Nota,
keluar dari form manual), supaya `stok_akhir` (master) dan riwayat
pergerakan TIDAK PERNAH bisa selisih:

- **`master_bahan_aksesoris.stok_akhir`** (field BARU) — saldo stok
  berjalan, satuan = `satuan_pemakaian` item itu (konsisten dengan
  normalisasi yang sudah dipakai Riwayat Harga Pembelian, §21.14).
- **Koleksi BARU `kartu_stok_bahan_aksesoris`** — 1 dokumen per
  pergerakan (`jenis: 'masuk'|'keluar'`), field: `bahan_aksesoris_id`,
  `nama_bahan`, `tanggal`, `jenis`, `qty`, `satuan`, `sumber` (\"Nota
  Order Belanja\" / \"Pemakaian Manual\"), `no_pembelian` (kalau dari
  Nota), `keterangan`, `saldo_setelah` (snapshot stok SETELAH baris
  ini, buat ledger yang bisa diaudit tanpa hitung ulang manual),
  `dibuat_pada`, `dibuat_oleh`.
- **`catatPergerakanKartuStok({bahanId, namaBahan, tanggal, jenis, qty,
  satuan, sumber, noPembelian, keterangan})`** (fungsi BARU, `export`ed
  dari MODUL-LEVEL `js/vue-stock-pembelian.js`, dipakai bareng oleh
  Nota — otomatis — DAN Kartu Stok — manual) — pakai `runTransaction()`
  Firestore: baca `stok_akhir` sekarang, hitung saldo baru (`+qty` kalau
  masuk, `-qty` kalau keluar), TULIS keduanya (update master +
  dokumen ledger baru) DALAM 1 TRANSAKSI atomik — menjamin tidak
  mungkin ada race condition bikin `stok_akhir` menyimpang dari total
  ledger, bahkan kalau 2 orang catat pergerakan bersamaan.

**Titik panggil OTOMATIS (masuk, dari Nota)** — di
`catatRiwayatHargaDanUpdateMaster()` (§21.14), SETELAH baris Riwayat
Harga ditulis, ditambah try/catch TERPISAH yang memanggil
`catatPergerakanKartuStok({..., jenis:'masuk', sumber:'Nota Order
Belanja', noPembelian: <no pesanan>})` per item — dibungkus try/catch
SENDIRI (konsisten pola §21.14: kalau Kartu Stok gagal, Nota yang sudah
tersimpan TETAP dilaporkan sukses ke Guru, error dicatat ke Console
buat ditelusuri belakangan, TIDAK bikin Guru kira Nota-nya gagal total).

**Titik panggil MANUAL (keluar, dari Kartu Stok Detail)** — form
\"Catat Pemakaian\" (Tanggal, Jumlah, Keterangan) di layar Detail, submit
→ `catatPergerakanKartuStok({..., jenis:'keluar', sumber:'Pemakaian
Manual'})` — kalau jumlah pemakaian akan bikin stok NEGATIF, muncul
konfirmasi (`confirm()`) dulu sebelum lanjut (bukan diblokir total —
Guru mungkin memang perlu catat walau stok tercatat belum cukup, mis.
karena ada barang belum sempat di-Nota-kan).

**File BARU**: `js/vue-kartu-stok.js` — `KartuStokManager`:
- **Ringkasan** — paginasi cursor (`usePaginasiFirestore` pada
  `master_bahan_aksesoris`, WAJIB sesuai `PRINSIP-HEMAT.md`), search +
  filter kategori (Bahan/Aksesoris/ALL), kolom Nama/Kategori/Warna/
  Satuan Pemakaian/**Stok Akhir**, baris bisa diklik buka Detail.
- **Detail** — header kartu (nama item + angka Stok Akhir besar), form
  Catat Pemakaian, tabel Riwayat Pergerakan (paginasi cursor pada
  `kartu_stok_bahan_aksesoris`, difilter `bahan_aksesoris_id` item
  aktif) — kolom Tanggal/Jenis(warna hijau=masuk, merah=keluar)/Jumlah/
  Sumber/No.Pembelian/Keterangan/Saldo Setelah.
- Mount lazy standar: `window.pastikanMountKartuStok()`.

**File DIEDIT** (wiring menu baru, pola SAMA PERSIS seperti Riwayat
Harga Pembelian §21.14):
- `index.html` — tombol sub-tab BARU "Kartu Stok" (child ke-5 di grup
  Stock & Pembelian, setelah Riwayat Harga Pembelian), content div
  `sub-zh-stock-kartustok`, `<script>` tag baru, cache-bust
  `vue-bahan-aksesoris.js?v=10` (kolom stok_akhir baru), `dashboard.js
  ?v=7` (petaMount baru), `vue-stock-pembelian.js?v=3` (tetap, sudah
  di-bump ronde §23.2), `vue-kartu-stok.js?v=1` (baru).
- `js/dashboard.js` — `petaMount['sub-zh-stock-kartustok'] =
  'pastikanMountKartuStok'`.
- `js/vue-bahan-aksesoris.js` — kolom BARU "Stok Akhir" (+ satuan
  pemakaian di bawahnya) di tabel List Bahan & Aksesoris, fungsi bantu
  `formatQty()` (format angka `id-ID`, maks 2 desimal) ditambah &
  di-`return{}` dari `setup()` `BahanAksesorisListManager`. Item lama
  yang belum punya `stok_akhir` (belum pernah ada pergerakan) tampil
  \"0\" (fallback `parseFloat(n)||0`), BUKAN error/kosong.
- `firestore.rules` — block BARU `kartu_stok_bahan_aksesoris`
  (`allow read: if login(); allow write: if isAdminLevel();`, pola SAMA
  seperti `riwayat_harga_pembelian`). **BELUM DITEMPEL Guru** — WAJIB
  publish manual di Firebase Console SEBELUM dites, kalau tidak semua
  baca/tulis ke koleksi ini bakal `permission-denied`.

**Bug internal yang sempat kejadian & sudah diperbaiki SEBELUM dikirim**
(dicatat sebagai pengingat pola, bukan buat Guru tindak lanjuti):
`catatPergerakanKartuStok()` sempat ditulis DI DALAM `setup()`
`OrderBelanjaScreen` (closure komponen, tidak bisa di-`import` file
lain) — ketahuan sebelum verifikasi akhir, dipindah jadi `export
async function` di level MODUL (sebelum definisi komponen), supaya
`vue-kartu-stok.js` bisa `import` fungsi yang SAMA PERSIS (bukan
duplikat logic) — 1 sumber kebenaran buat transaksi stok, dipakai dari
2 tempat.

**Semua file** (`vue-camera.js`, `vue-antrean-absensi.js`,
`vue-riwayat-absensi.js`, `vue-stock-pembelian.js`, `vue-kartu-stok.js`,
`vue-bahan-aksesoris.js`, `dashboard.js`) lolos `node -c`. `index.html`
dicek keseimbangan tag manual (div 116/116, button 49/49, span 7/7, p
8/8, label 0/0, h3 1/1, h4 3/3) — semua OK.

### 23.4 Status: SUDAH DIKIRIM ke Guru (24 Agt 2026), BELUM ADA TES SAMA SEKALI

Sama seperti fitur-fitur Stock & Pembelian sebelumnya — murni hasil
`node -c` + baca kode manual, BELUM pernah diklik di browser beneran.
**WAJIB sebelum tes**: publish `firestore.rules` LENGKAP (termasuk
block baru `kartu_stok_bahan_aksesoris` di §23.3) di Firebase Console.

**Rencana tes yang disarankan ke Guru**:
1. Clock In/Out BARU (HP biasa) — cek kolom Shift SEKARANG tampil
   (bukan `-`) di Antrean Absensi, Riwayat All Absensi, DAN file CSV
   yang diunduh. Cek juga apakah "Status Kehadiran" di Antrean Absensi
   sekarang terhitung otomatis dengan benar (dibandingkan jam shift).
2. Buka Riwayat All Absensi → tombol "Cek Data Belum Punya Shift" →
   kalau ada, jalankan "Jalankan Migrasi" → cek data lama sekarang
   punya Shift terisi (INGAT: ini shift KARYAWAN SAAT INI, bukan shift
   yang berlaku waktu itu, lihat catatan §23.1 poin 4).
3. Buka List Order Belanja — cek kolom Harga SEKARANG read-only (tidak
   bisa diklik/edit), dan finalisasi List TIDAK memunculkan baris baru
   di Riwayat Harga Pembelian.
4. Buka Nota Order Belanja — pastikan MASIH bisa edit Harga per baris
   seperti biasa (§21.14 tidak berubah), finalisasi Nota MASIH
   memunculkan baris di Riwayat Harga Pembelian, DAN SEKARANG juga
   memunculkan baris "masuk" baru di Kartu Stok item terkait.
5. Buka menu BARU "Kartu Stok" — cek Ringkasan menampilkan Stok Akhir
   per item (cocok dengan yang barusan bertambah dari langkah 4), klik
   1 item buka Detail, cek Riwayat Pergerakan menampilkan baris "masuk"
   dari Nota tadi, coba form "Catat Pemakaian" (isi jumlah kecil,
   Simpan) → cek Stok Akhir berkurang & muncul baris "keluar" baru di
   riwayat. Cek juga kolom Stok Akhir di List Bahan & Aksesoris ikut
   ter-update.


## 24. Update Entry Bahan & Aksesoris — Rak Penyimpanan & Volume Barang (25 Agt 2026)

### 24.1 Permintaan Guru

Guru minta 2 perubahan pada form Entry & List (Edit) Bahan/Aksesoris
(`vue-bahan-aksesoris.js`):

1. Pindahkan tombol "Konversi Banyak Tingkat" — sebelumnya nempel di
   sebelah Margin Modal (§21.9) — ke bawah field grid Harga Pembelian/
   Satuan Pembelian/Isi Konversi Pembelian/Satuan Pemakaian.
2. Di bawah tombol itu (dan sebelum Margin Modal), tambah field baru:
   - **Rak Penyimpanan** — 3 grid: Kode Rak, Baris Rak, Kolom Rak.
   - **Volume Barang** — Tinggi, Panjang, Lebar, dengan field Volume
     yang fungsinya mengukur kapasitas rak (biar tahu volume & maximum
     penyimpanan, supaya tidak over stok).

Karena ada 3 sumbu ambiguitas nyata (cara kelola Kode/Baris/Kolom Rak,
makna dimensi Tinggi/Panjang/Lebar, sejauh mana logic overstok
dikerjakan ronde ini), dipakai `AskUserQuestion` (bukan tebak-tebak,
konsisten prinsip proyek) — 3 jawaban Guru:

1. Kode Rak/Baris Rak/Kolom Rak → **"Master Data Rak terkelola"**
   (bukan teks bebas per item).
2. Tinggi/Panjang/Lebar → **dimensi 1 SATUAN BARANG** itu sendiri
   (Bahan/Aksesoris), BUKAN dimensi fisik raknya — walau tujuan akhir
   fitur ini "ukur kapasitas rak".
3. Cakupan ronde ini → **"simpan & tampilkan volume saja"** — logic
   peringatan overstok BELUM dikerjakan sekarang, direncanakan MENYUSUL
   muncul di menu List Order Belanja & Nota Order Belanja
   (`vue-stock-pembelian.js`).

### 24.2 ASUMSI ARSITEKTUR (belum eksplisit ditanyakan, level risiko
rendah/gampang diubah)

Kode Rak/Baris Rak/Kolom Rak diimplementasi sebagai **3 kategori
`master_data` TERPISAH** (`master_data/kode_rak`, `master_data/baris_rak`,
`master_data/kolom_rak`), masing-masing pakai komponen `MasterDataCategory`
yang SUDAH ADA di `vue-components.js` (pola PERSIS sama seperti
`jenis_bahan`/`jenis_aksesoris`, ADD/DELETE lewat panel Pengaturan, gated
`window.cekIzinMenu('bahan_aksesoris_entry', ...)`) — BUKAN 1 koleksi
gabungan `master_rak` berisi 1 record per kombinasi Kode×Baris×Kolom.

Alasan ditolaknya kombinasi 1-record: gudang nyata bisa punya sangat
banyak kombinasi Rak×Baris×Kolom, "1 record per kombinasi persis" jadi
tidak praktis dikelola (harus didaftarkan manual satu-satu tiap
kombinasi baru sebelum bisa dipakai). Dengan 3 kategori terpisah, admin
cukup daftarkan nilai yang ADA per sumbu (mis. Kode Rak: A, B, C; Baris:
1-5; Kolom: 1-8) lalu tiap item bebas kombinasikan lewat 3 dropdown
`DropdownCari` (strict-select, sama pola Warna/Satuan).

**Konsekuensi dari pilihan ini**: 3 dropdown Rak SAMA untuk kategori
Bahan maupun Aksesoris (TIDAK dipisah per `kategori_utama` seperti
Jenis) — dianggap 1 sistem penomoran rak gudang bersama. Kalau Guru mau
beda (misal validasi "kombinasi X-Y-Z sudah dipakai barang lain", atau
Rak Bahan/Aksesoris dipisah), kabari untuk direvisi — perubahan ini
scoped kecil (bukan migrasi data besar) karena belum ada data lama yang
kena dampak.

### 24.3 Perubahan detail

**Field baru di `master_bahan_aksesoris`** (SEMUA OPSIONAL, tidak
divalidasi wajib di `simpanData()`/`simpanEdit()` — item lama & baru
tetap bisa disimpan tanpa data Rak/Volume, diisi menyusul):

- `kode_rak`, `baris_rak`, `kolom_rak` (string) — dari 3 kategori
  `master_data` baru di atas.
- `tinggi_barang`, `panjang_barang`, `lebar_barang` (number, cm) —
  dimensi 1 satuan `satuan_pemakaian` barang itu sendiri.
- `volume_barang` (number, cm³) — **DIHITUNG OTOMATIS** (readonly di
  UI, computed client-side) = `tinggi_barang * panjang_barang *
  lebar_barang`, pola SAMA seperti `harga_modal`/`harga_pemakaian`
  (dihitung di client, ditulis sebagai field biasa saat simpan — BUKAN
  Cloud Function/Firestore computed field).

**Layout form BARU** (Entry `BahanAksesorisEntryManager` & Edit modal
`BahanAksesorisListManager`, tetap dijaga paritas 1:1 seperti sebelumnya):

Urutan lama: [...] → grid 4 field (Harga Pembelian/Satuan Pembelian/Isi
Konversi/Satuan Pemakaian, ATAU kotak ringkasan kalau Konversi Banyak
Tingkat sudah aktif) → [Margin Modal + tombol Konversi Banyak Tingkat
1 baris, §21.9] → Harga Pemakaian.

Urutan BARU: [...] → grid 4 field / kotak ringkasan → **[tombol
Konversi Banyak Tingkat DIPINDAH ke sini, sendirian, cuma tampil kalau
konversi belum aktif]** → **[BARU: Rak Penyimpanan — 3 grid
Kode/Baris/Kolom Rak, tiap-tiap `DropdownCari`]** → **[BARU: Volume
Barang — 3 grid Tinggi/Panjang/Lebar (input number), + baris teks
Volume hasil hitung otomatis]** → [Margin Modal, sekarang sendirian] →
Harga Modal/Harga Pemakaian.

**Panel Pengaturan** (`PengaturanBahanAksesoris`) — ditambah section
baru "Data Rak Penyimpanan" (3x `<master-data-category>` untuk Kode
Rak/Baris Rak/Kolom Rak), taruh setelah Data Satuan/Ukuran/Warna yang
sudah ada.

**Tabel List Bahan & Aksesoris** — kolom baru "Rak / Volume" (setelah
Stok Akhir), menampilkan gabungan `kode_rak-baris_rak-kolom_rak`
(dipisah `-`, `-` kalau semua kosong) di baris atas, dan
`volume_barang` (format `id-ID`, satuan cm³) di baris bawah.

**Firestore Rules** — TIDAK PERLU perubahan. Rule `master_data/{docId}`
sudah generik per-ID dokumen (`allow read: if true; allow write: if
isAdminLevel();`), otomatis mencakup 3 kategori baru `kode_rak`/
`baris_rak`/`kolom_rak` tanpa perlu block terpisah.

### 24.4 File yang berubah

- `js/vue-bahan-aksesoris.js` — semua perubahan di atas: `formStateKosong()`
  tambah 6 field baru, `PengaturanBahanAksesoris` tambah 3
  `master-data-category`, `BahanAksesorisEntryManager` &
  `BahanAksesorisListManager` (`setup()` + template) tambah state/opsi/
  computed `volumeBarang`/fungsi muat opsi Rak + reorder template, tabel
  List tambah kolom "Rak / Volume".
- `index.html` — cache-bust `vue-bahan-aksesoris.js?v=10` → `?v=11`.
- `docs/PETA-DATABASE.md` — field baru `master_bahan_aksesoris`
  didokumentasikan, daftar kategori `master_data` diupdate.
- `docs/PETA-MENU.md` — baris Data Bahan & Aksesoris diupdate.

Verifikasi: `node -c vue-bahan-aksesoris.js` lolos. Keseimbangan tag
HTML di dalam file (div, button, p, label, h3, span, table, tr, td, th,
thead, tbody) dicek manual — semua seimbang (0 selisih).

### 24.5 Status: SUDAH DIKIRIM ke Guru (25 Agt 2026), BELUM ADA TES SAMA SEKALI

Sama seperti fitur-fitur sebelumnya — murni hasil `node -c` + baca kode
manual, BELUM pernah diklik di browser beneran. TIDAK ADA firestore.rules
baru yang perlu ditempel untuk update ini (rule `master_data` generik
sudah cukup).

**Rencana tes yang disarankan ke Guru**:
1. Buka Entry Bahan & Aksesoris → tombol "Pengaturan" → cek section
   baru "Data Rak Penyimpanan" muncul (Kode Rak/Baris Rak/Kolom Rak),
   coba tambah beberapa nilai contoh di tiap kategori.
2. Kembali ke form Entry → cek tombol "Konversi Banyak Tingkat" sekarang
   posisinya di bawah grid Harga/Satuan (bukan di sebelah Margin Modal
   lagi) → cek section "Rak Penyimpanan" (3 dropdown, harus muncul
   nilai yang barusan ditambah di langkah 1) dan "Volume Barang" (isi
   Tinggi/Panjang/Lebar, cek angka Volume di bawahnya otomatis
   ke-update = perkalian ketiganya).
3. Simpan 1 data baru dengan Rak & Volume terisi → cek muncul di tabel
   List, kolom "Rak / Volume" menampilkan kombinasi Kode-Baris-Kolom &
   angka Volume yang benar.
4. Buka Edit data itu dari List → cek 3 dropdown Rak & 3 field Volume
   ter-isi sesuai data tersimpan, coba ubah, Simpan Perubahan → cek
   tabel List ikut ter-update.
5. Coba simpan data BARU tanpa isi Rak/Volume sama sekali (dikosongkan
   semua) → pastikan TETAP BISA tersimpan (field ini opsional, bukan
   wajib) dan tabel List menampilkan "-" di kolom Rak/Volume untuk data
   itu.

## 25. Rak Penyimpanan jadi Menu Tersendiri + Diskusi Lot/Roll & FIFO (25 Agt 2026)

### 25.1 Permintaan Guru & keputusan Rak Penyimpanan

Sehari setelah §24 dikirim (field `kode_rak`/`baris_rak`/`kolom_rak` +
`tinggi_barang`/`panjang_barang`/`lebar_barang` lepas di form Bahan &
Aksesoris), Guru minta pendekatan itu diubah: "Kode Rak Penyimpanan
mending dibuat Menu di data bahan & aksesoris ... estimasi kapasitas
rak volumenya brpa ... dibawahnya ada data table". Dikonfirmasi lewat
AskUserQuestion (4 pertanyaan):

1. Field Kode/Baris/Kolom Rak di form Bahan/Aksesoris → **"1 dropdown
   pilih Rak terdaftar"** (bukan 3 dropdown lepas seperti §24).
2. Cakupan Lot/Roll-tracking (topik §25.2 di bawah) → **"opsional per
   item"**.
3. Fitur "Cetak" → **"Label per Roll/Lot (ditempel fisik)"**, BUKAN
   cetak dokumen Nota/List.
4. Sync yang dimaksud → **"Data lot/roll selalu sinkron dengan Kartu
   Stok (`stok_akhir`)"**.

**Yang dikerjakan (Rak Penyimpanan)**:

Menu BARU **"Rak Penyimpanan"** — child ke-3 di grup "Data Bahan &
Aksesoris" (sejajar Entry & List), file terpisah `js/vue-rak-penyimpanan.js`
(`RakPenyimpananManager`), koleksi Firestore BARU `master_rak_penyimpanan`.
1 dokumen = 1 rak fisik NYATA yang didaftarkan manual (BUKAN generate
semua kombinasi Kode×Baris×Kolom — ini yang bikin pendekatan §24 lama
ditolak sebelumnya, sekarang aman karena inputnya intensional).

Field: `kode_rak`/`baris_rak`/`kolom_rak` (masing-masing dari 3 kategori
`master_data` yang SAMA seperti §24, TETAP dipertahankan — sekarang
fungsinya jadi bahan isian bikin record Rak, bukan dipilih langsung di
Bahan/Aksesoris lagi), `rak_label` (denormalisasi `"Kode-Baris-Kolom"`,
mis. `"A-1-3"`), `tinggi_rak`/`panjang_rak`/`lebar_rak` (cm, WAJIB diisi
— beda dari Volume Barang di §24 yang opsional), `volume_rak` (dihitung
otomatis = t×p×l, "estimasi kapasitas rak" yang diminta Guru). Kombinasi
Kode+Baris+Kolom dicek unik sebelum simpan (query, bukan cuma cek
halaman yang lagi tampil). Di bawah form-nya ada tabel paginasi
(`usePaginasiFirestore`, konsisten `PRINSIP-HEMAT.md`) daftar semua Rak
terdaftar — sesuai permintaan Guru "dibawahnya ada data table".

**`master_bahan_aksesoris` DIUBAH lagi** (aman, field §24 belum sempat
dipakai data nyata sama sekali): `kode_rak`/`baris_rak`/`kolom_rak`
DIHAPUS, diganti `rak_id` (ref ke 1 dokumen `master_rak_penyimpanan`) +
`rak_label` (denormalisasi tampilan). Form Entry & Edit Bahan/Aksesoris
sekarang cuma 1 field "Pilih Rak" (`DropdownCari` strict-select, opsi =
`rak_label` semua Rak terdaftar, fetch SEMUA tanpa paginasi — pola sama
seperti `opsiSatuan`/`opsiWarna`, dianggap "sumber dropdown" bukan
"tabel browsing" jadi tidak melanggar `PRINSIP-HEMAT.md`). Kalau Rak
dipilih, muncul info kecil dimensi & kapasitas Rak itu buat konfirmasi
visual. Kalau belum ada Rak terdaftar sama sekali, muncul pesan arah ke
sub-menu Rak Penyimpanan. Field ini tetap OPSIONAL. Kolom "Rak / Volume"
di tabel List Bahan & Aksesoris sekarang menampilkan `rak_label` (lokasi
rak item itu) + `volume_barang` (volume 1 satuan barangnya sendiri, TIDAK
berubah dari §24) — **PENTING**: "Volume Rak" (kapasitas rak) dan
"Volume Barang" (dimensi 1 item) itu 2 hal BEDA, jangan tertukar —
dicatat eksplisit di PETA-DATABASE.md poin 8.

**File yang berubah**:
- `js/vue-rak-penyimpanan.js` — BARU, `RakPenyimpananManager` lengkap.
- `js/vue-bahan-aksesoris.js` — `formStateKosong()` (`kode_rak` dkk →
  `rak_id`/`rak_label`), `ambilDaftarRak()` (helper baru), Entry & Edit
  `setup()`+template (opsi 3-dropdown → 1 dropdown + watch turunkan
  `rak_id` dari `rak_label` terpilih), `simpanData()`/`simpanEdit()`
  payload, kolom tabel List.
- `index.html` — sub-tab BARU "Rak Penyimpanan" (child ke-3 grup Data
  Bahan & Aksesoris), content div `sub-zh-databahan-rak`, `<script>` tag
  baru, cache-bust `vue-bahan-aksesoris.js?v=11→12`,
  `vue-rak-penyimpanan.js?v=1` (baru).
- `js/dashboard.js` — `petaMount['sub-zh-databahan-rak'] =
  'pastikanMountRakPenyimpanan'`.
- `js/vue-config-akses.js` — `DAFTAR_MENU` tambah `{ id:
  'bahan_aksesoris_rak', label: 'Rak Penyimpanan', kategori: 'Zevanic
  House' }`.
- `firestore.rules` — block BARU `master_rak_penyimpanan` (`allow read:
  if login(); allow write: if isAdminLevel();`, pola sama
  `master_bahan_aksesoris`). **BELUM DITEMPEL Guru.**

Verifikasi: `node -c` semua file JS lolos. Keseimbangan tag HTML
`vue-rak-penyimpanan.js` (div 18/18, button 6/6, p 2/2, label 6/6, table
1/1, tr 2/2, td 5/5, th 5/5, thead 1/1, tbody 1/1, span 8/8) dan
`vue-bahan-aksesoris.js` (div 85/85, button 22/22, p 23/23, label
30/30, h3 4/4, span 28/28, table/tr/td/th/thead/tbody semua seimbang)
dan `index.html` (div 118/118, button 50/50, span 7/7, p 8/8, h3 1/1,
h4 3/3) — semua OK.

### 25.2 Diskusi (BELUM diimplementasikan) — Penyimpanan Bahan per-Roll/Kones, FIFO, Cetak Label, Sync

Guru minta didiskusikan dulu (bukan dikoding) soal update infrastruktur
penyimpanan Bahan berbentuk Roll/Kones: "misal kita beli bahan 10roll
itu qtynya beda2 artinya saat di list order atau nota qty tiap masing2
rol punya sendiri. begitupun saya ingin karyawan ketika pakai bukan
pakai dari yg baru tapi pakai sisa dulu ... tambahkan fitur cetak ...
nanti ini sync juga".

**Gap yang diidentifikasi**: `kartu_stok_bahan_aksesoris` (§23.3) itu
ledger AGREGAT (1 baris "masuk" = 1 angka total, mis. beli 10 roll
tercatat "masuk 500m", bukan per roll) dan `stok_akhir` di
`master_bahan_aksesoris` juga cuma 1 angka saldo total — TIDAK ada
konsep "roll yang mana", jadi TIDAK BISA atur "pakai sisa dulu" (FIFO)
karena sistem memang tidak tahu ada banyak roll individual dengan sisa
beda-beda.

**Keputusan Guru yang SUDAH dikonfirmasi** (lewat AskUserQuestion, lihat
juga §25.1 poin 2-4 di atas):
- Lot/roll-tracking **opsional per item** (bukan wajib semua item) —
  butuh flag baru di `master_bahan_aksesoris` (belum ditentukan nama
  field pastinya, mis. `pakai_lot_tracking`).
- Fitur Cetak = **label per roll/lot** (stiker kode unik ditempel fisik
  ke barang, BUKAN print dokumen Nota/List).
- Sync = **total semua lot aktif 1 item HARUS SELALU sama dengan
  `stok_akhir`-nya** — 1 sumber kebenaran, tidak boleh selisih.
- Kartu Stok "masuk" untuk item lot-tracked baru tercatat **SETELAH**
  qty per roll lengkap diinput (bukan langsung pas Nota final dengan
  angka total dulu) — supaya syarat sync di atas selalu terjaga.

**Titik yang masih didiskusikan (belum final)** — input qty per roll:
Guru mengusulkan input LANGSUNG di dalam Nota, SEBELUM disimpan/final,
lewat tombol aksi khusus per baris item (di tabel "Daftar Pesanan
Pembelian") untuk item yang ditandai perlu qty per roll — BUKAN layar
terpisah "Terima Barang" sesudah Nota final seperti usulan awal Claude
(yang lebih konservatif, menghindari sentuh alur Nota yang sudah
dikirim tapi belum dites). Counter-proposal Claude yang BELUM
dikonfirmasi Guru: tombol itu membuka popup (pola sama seperti "Bantu
Hitung Konversi Berjenjang" yang sudah ada) untuk input qty (dan
opsional harga) tiap roll SEBELUM Simpan — hasilnya disimpan sebagai
`items[].detail_lot` (array) di `pesanan_pembelian`. Begitu Nota
di-final-kan, exactly di titik yang SAMA seperti sekarang
(`catatRiwayatHargaDanUpdateMaster()`/`catatPergerakanKartuStok()`),
untuk item lot-tracked sistem baca `detail_lot` dan buat N dokumen baru
di koleksi lot (belum ditentukan nama pastinya, mis.
`lot_bahan_aksesoris`) sekaligus 1 baris ledger `kartu_stok_bahan_aksesoris`
— semua dalam 1 `runTransaction()` (pola sama seperti sekarang, cuma
lebih banyak dokumen yang disentuh). Validasi: Nota TIDAK BOLEH final
kalau item lot-tracked belum diisi `detail_lot`-nya (blokir, bukan cuma
warning) — supaya syarat sync SELALU terjaga dari awal, tanpa perlu
langkah "Terima Barang" terpisah lagi.

**BELUM diputuskan/dikerjakan sama sekali**:
- Nama koleksi & skema pasti entitas Lot/Roll (usulan sementara:
  `bahan_aksesoris_id`, `kode_lot`, `qty_awal`, `qty_sisa`, `satuan`,
  `tanggal_masuk`, `no_pembelian`, `harga`, `rak_id` opsional, `status`
  aktif/habis).
- Logic FIFO pemakaian (ambil dari lot TERLAMA yang masih sisa dulu,
  potong berjenjang lintas lot kalau 1 lot tidak cukup) — belum
  dirancang detail transaksinya.
- Desain popup input qty per roll di Nota (field apa saja, validasi
  jumlah roll vs qty header, dst).
- Desain & ukuran fisik label cetak per roll (perlu tahu printer/ukuran
  kertas label yang dipakai Guru).
- Field flag opsional per item ("perlu lot-tracking") — belum ditambah
  ke `master_bahan_aksesoris` maupun form Entry/Edit.

**Urutan pengerjaan disepakati Guru**: bertahap — Rak Penyimpanan (§25.1
di atas) dulu, baru Lot/Roll + FIFO + Cetak Label menyusul setelah
detail-detail di atas difinalkan.

### 25.3 Status: Rak Penyimpanan SUDAH DIKIRIM ke Guru (25 Agt 2026), BELUM ADA TES SAMA SEKALI. Lot/Roll BELUM dikerjakan (masih tahap diskusi/desain).

**WAJIB sebelum tes Rak Penyimpanan**: publish `firestore.rules` LENGKAP
(termasuk block baru `master_rak_penyimpanan` di §25.1) di Firebase
Console.

**Rencana tes yang disarankan ke Guru (Rak Penyimpanan)**:
1. Buka Entry Bahan & Aksesoris → Pengaturan → cek "Data Rak
   Penyimpanan" (Kode/Baris/Kolom Rak) masih ada seperti §24, tambah
   beberapa nilai contoh kalau belum ada.
2. Buka sub-menu BARU "Rak Penyimpanan" (child ke-3, sejajar Entry &
   List) → isi form (Kode/Baris/Kolom + Tinggi/Panjang/Lebar) → Simpan
   → cek muncul di tabel di bawahnya dengan Volume terhitung benar
   (Tinggi × Panjang × Lebar). Coba simpan kombinasi Kode/Baris/Kolom
   yang SAMA lagi → harus ditolak (pesan "sudah terdaftar"). Coba Edit
   & Hapus 1 Rak.
3. Kembali ke Entry Bahan & Aksesoris → section "Rak Penyimpanan"
   sekarang harus 1 dropdown "Pilih Rak" (bukan 3 dropdown lagi) → cek
   Rak yang barusan dibuat muncul di opsi, pilih salah satu → cek info
   dimensi/kapasitas Rak muncul di bawah dropdown.
4. Simpan 1 data Bahan/Aksesoris baru dengan Rak terpilih → cek kolom
   "Rak / Volume" di tabel List menampilkan label Rak yang benar (mis.
   "A-1-3") dan Volume Barang-nya (BEDA dari Volume Rak, jangan
   tertukar).
5. Edit data itu dari List → dropdown Rak ter-isi sesuai data
   tersimpan, coba ganti ke Rak lain, Simpan Perubahan → cek List ikut
   ter-update.

### 25.4 Qty per Roll/Lot — IMPLEMENTASI RONDE PERTAMA (25 Agt 2026, §25.2 lanjutan), FIFO SENGAJA DITUNDA

Arahan final Guru (verbatim), setelah counter-proposal Claude di §25.2
disetujui sebagian:

> "1. untuk qty per lot bantu jalankan (fifo nanti saja)
> 2. pakai tombol pop up disimpan per baris dan kolomnya paling depan.
> tombol aktif jika dia memang menurut data wajib entry qty per lot"

**Yang DIKERJAKAN ronde ini** (scope SENGAJA dibatasi — cuma capture qty
per roll saat barang diterima, BUKAN konsumsi/FIFO):

1. **Field baru `pakai_lot_tracking`** (boolean, opt-in per item, default
   `false`) di `master_bahan_aksesoris` — checkbox "Perlu Qty per
   Roll/Lot saat diterima (mis. bahan berbentuk Roll/Kones)" ditambahkan
   di form Entry & Edit (`vue-bahan-aksesoris.js`), ditaruh setelah
   tombol "Konversi Banyak Tingkat", sebelum section Rak Penyimpanan.
   Tabel List Bahan & Aksesoris kasih ikon kecil (layer-group) di
   sebelah Nama kalau flag ini aktif, buat identifikasi cepat tanpa buka
   Edit.
2. **Kolom BARU paling kiri** di tabel "Daftar Pesanan Pembelian" (List
   & Nota Order Belanja, `OrderBelanjaScreen` di `vue-stock-pembelian.js`)
   — 1 tombol (ikon layer-group) per baris. Tombol HANYA aktif kalau
   `it.pakai_lot_tracking` true (didenormalisasi dari master data ke
   baris lewat `buatBarisPesanan()` — dipakai baik untuk baris manual
   [`tambahItemManual`] maupun baris dari Persiapan Masalah
   [`tambahDariPermintaan`]). Kalau tidak ditandai, sel tampil "-" saja
   (tidak bisa diklik) dengan tooltip penjelasan.
3. **Popup `PopupQtyPerLot`** (komponen baru, pola SAMA seperti
   `PopupKonversiBerjenjang` yang sudah ada — state diedit di komponen
   induk `OrderBelanjaScreen`, popup cuma emit event) — isi qty (+
   keterangan opsional, mis. nomor roll) tiap roll/lot SATU-SATU,
   SEBELUM Nota/List disimpan (persis sesuai arahan Guru: "ketika nota
   datang input langsung sebelum simpan"). Popup menampilkan total
   otomatis & PERBANDINGAN (bukan blokir, cuma info berwarna beda kalau
   selisih) dengan Qty di baris pesanan (`qty_s`) — supaya admin sadar
   kalau totalnya belum pas, tapi TETAP BOLEH Terapkan walau beda (tidak
   divalidasi ketat, konsisten dengan keputusan "belum ada validasi
   blokir" karena FIFO/sync penuh belum dikerjakan).
4. Hasil popup disimpan ke field baru **`detail_lot`** (array
   `{qty, keterangan}`) di baris `daftarPesanan` itu — ikut tersimpan ke
   `pesanan_pembelian.items[].detail_lot` pas Simpan/Pending (tidak ada
   perubahan di `simpan()` — `detail_lot` otomatis ikut ter-spread lewat
   `{ ...rest }` yang sudah ada). Draft LAMA (sebelum field ini ada)
   tetap aman dibuka lewat `pilihNoPembelian()` — ada fallback
   `pakai_lot_tracking: !!i.pakai_lot_tracking, detail_lot: i.detail_lot || []`.
5. **TIDAK ADA** dokumen lot terpisah (mis. `lot_bahan_aksesoris`) yang
   dibuat di ronde ini — beda dari rencana awal di §25.2. Data qty per
   roll HANYA tersimpan di dalam array `items[].detail_lot` milik
   dokumen `pesanan_pembelian` itu sendiri. Keputusan ini diambil supaya
   scope ronde ini benar-benar minimal ("fifo nanti saja") — begitu FIFO
   dikerjakan, kemungkinan besar BARU saat itu perlu dokumen lot
   terpisah (biar bisa di-query & dikurangi `qty_sisa`-nya satu-satu).

**YANG BELUM DIKERJAKAN (scope sengaja ditunda, TIDAK BOLEH dianggap
bug)**:
- **FIFO / logic konsumsi per-lot** — "Catat Pemakaian" manual di Kartu
  Stok (`vue-kartu-stok.js`) TETAP cuma mengurangi `stok_akhir` agregat,
  TIDAK menyentuh `detail_lot` manapun. Akibatnya invarian "total
  `detail_lot` = `stok_akhir`" HANYA valid TEPAT SETELAH barang diterima
  — begitu ada pemakaian, akan "meleset" sampai FIFO benar-benar
  dikerjakan. Sudah didokumentasikan di PETA-DATABASE.md poin peringatan
  #9.
- Dokumen lot individual (`qty_sisa`, `status` aktif/habis, dst) — belum
  ada, lihat poin 5 di atas.
- Cetak label per-roll (stiker fisik) — belum disentuh sama sekali,
  masih di tahap ide (§25.2).
- Validasi blokir (mis. "Nota tidak boleh final kalau qty lot belum
  pas") — SENGAJA tidak dibuat, cuma info visual non-blokir di popup
  (lihat poin 3).

**File yang diubah**: `vue-bahan-aksesoris.js` (field
`pakai_lot_tracking` + checkbox Entry/Edit + payload + badge List),
`vue-stock-pembelian.js` (komponen baru `PopupQtyPerLot`, kolom baru di
tabel, state/fungsi popup di `OrderBelanjaScreen`,
`buatBarisPesanan()` didenormalisasi, fallback draft lama di
`pilihNoPembelian()`), `index.html` (bump versi
`vue-bahan-aksesoris.js?v=13`, `vue-stock-pembelian.js?v=4`). TIDAK ADA
perubahan `firestore.rules` (data baru numpang di dokumen
`pesanan_pembelian` yang rule-nya sudah ada).

Verifikasi: `node -c` lolos untuk kedua file JS, tag HTML dalam template
literal seimbang (`vue-bahan-aksesoris.js`: div 87/87, button 22/22,
p 23/23, label 32/32; `vue-stock-pembelian.js`: div 49/49, button
20/20, table/tr/td/th/thead/tbody semua seimbang).

**Status: BELUM DITES SAMA SEKALI oleh Guru.** Rencana tes yang
disarankan:
1. Di Entry Bahan & Aksesoris, tandai 1 item (mis. bahan roll/kones)
   dengan checkbox "Perlu Qty per Roll/Lot", simpan.
2. Buka Nota Order Belanja, tambah baris item itu (lewat entry manual
   atau dari Persiapan Masalah) — cek tombol layer-group di kolom paling
   kiri AKTIF untuk baris ini, dan "-" (tidak bisa diklik) untuk item
   lain yang tidak ditandai.
3. Klik tombol, isi 2-3 baris qty roll berbeda-beda di popup, cek total
   ke-hitung otomatis, Terapkan.
4. Cek ikon tombol berubah warna (nunjukkan sudah ada X lot terisi),
   buka lagi popup-nya — data yang barusan diisi harus tetap ada
   (belum hilang).
5. Simpan Nota (final) — buka lagi draft/dokumen itu (lewat dropdown No.
   Pembelian) — cek `detail_lot` yang diisi tadi tetap tersimpan.
6. (Opsional, cek regresi) Pastikan item YANG TIDAK ditandai
   `pakai_lot_tracking` tetap bisa disimpan seperti biasa tanpa
   terpengaruh perubahan ini.

### 25.5 FIFO Roll/Lot — IMPLEMENTASI (25 Agt 2026, §25.3), stok "Catat Pemakaian" sekarang sync ke lot

Arahan Guru (verbatim): "stok saat di pakai bantu sync dlu lanhsung
pangkas aja bisa? walau data rak belum ada?" — diikuti 2 ronde
AskUserQuestion buat menutup celah desain terbesar (modul SPK/produksi
belum ada sama sekali, cuma placeholder di halaman Progress):

1. **Kalau lot kurang dari qty yang mau dipakai** → Guru: "lempar ke menu
   antrean masalah, disana pic harus ambil keputusan. kurangi jumlah
   order, lanjut sebagian dan orderken sisanya, atau nunggu order dulu
   komplit baru spk jalan." — dipetakan ke 3 opsi popup di form Catat
   Pemakaian (Kartu Stok), lihat implementasi di bawah.
2. **Kalau item ditandai lot-tracking tapi BELUM ada data lot sama
   sekali** → Guru: "Blokir dulu, wajib ada data lot".
3. **Rincian lot yang kepotong FIFO** → Guru: "Tampilkan rincian".
4. **Konfirmasi lingkup** (karena SPK/produksi belum ada modulnya di
   sistem ini sama sekali, masih placeholder) → Guru setuju 3 opsi
   keputusan itu diterapkan di form "Catat Pemakaian" yang SUDAH ADA di
   Kartu Stok, BUKAN nunggu modul SPK dibangun.
5. **Konfirmasi opsi "Lanjut sebagian, order sisanya"** → Guru: "Ya,
   begitu" — qty tersedia langsung dipotong (FIFO) & tercatat sebagai
   pemakaian, SISA kekurangannya otomatis jadi 1 baris baru di Persiapan
   Masalah (antrean "perlu dibeli" biasa, alur yang sudah ada).

**Yang DIKERJAKAN**:

1. **Koleksi BARU `lot_bahan_aksesoris`** — 1 dokumen = 1 roll/lot fisik
   individual (`qty_awal`, `qty_sisa`, `tanggal_masuk`, `no_pembelian`,
   `status` aktif/habis). Dibuat OTOMATIS begitu Nota Order Belanja
   di-final-kan untuk item `pakai_lot_tracking` yang `detail_lot`-nya
   sudah diisi (§25.2) — `catatPergerakanKartuStok()`
   (`vue-stock-pembelian.js`) dapat param baru `lotBaru`, menulis N
   dokumen lot DALAM transaksi yang SAMA dengan update `stok_akhir` &
   ledger `kartu_stok_bahan_aksesoris` — 3 hal ini SELALU konsisten
   sekaligus, tidak ada celah "1 tulis sukses, yang lain gagal".
2. **Fungsi BARU `catatPemakaianDenganFifo()`** (export dari
   `vue-stock-pembelian.js`) — dipakai form "Catat Pemakaian" di Kartu
   Stok, HANYA untuk item `pakai_lot_tracking`:
   - Query semua lot `status:"aktif"` item ini, urut `tanggal_masuk` ASC
     (FIFO — lot paling lama dipotong duluan).
   - **Kosong sama sekali** → lempar `LOT_KOSONG` (BLOKIR, sesuai
     keputusan Guru poin 2).
   - **Kurang** → lempar `LOT_KURANG` (bawa `totalTersedia`) — TIDAK
     diblokir diam-diam, ditangani `vue-kartu-stok.js` (lihat poin 3).
   - **Cukup** → potong FIFO dalam 1 `runTransaction()` (baca ULANG
     semua lot kandidat lewat `tx.get()` — data FRESH, jaga-jaga ada
     pemakaian lain nyelip di antara query awal & transaksi ini — ada
     juga pengecekan ulang total terpotong vs qty diminta, kalau
     ternyata beda [race amat langka] transaksi dibatalkan dengan pesan
     "coba lagi" daripada diam-diam catat kurang), lalu tulis `qty_sisa`
     baru tiap lot + `stok_akhir` + 1 baris `kartu_stok_bahan_aksesoris`
     baru dengan field BARU `rincian_lot` (array, lot mana saja &
     berapa yang kepotong — buat transparansi, keputusan Guru poin 3).
3. **`vue-kartu-stok.js` — "Catat Pemakaian" dirombak jadi 2 jalur**:
   item `pakai_lot_tracking` pakai `catatPemakaianDenganFifo()` (jalur
   BARU), item biasa TETAP jalur LAMA (kurangi `stok_akhir` langsung,
   TIDAK BERUBAH sama sekali — regresi nihil buat item non-lot). Kalau
   `LOT_KURANG` tertangkap, muncul **popup 3 opsi keputusan**:
   - **"Kurangi jumlah pemakaian"** — catat pemakaian PAS sejumlah yang
     tersedia (FIFO), tidak ada sisa, tidak ada entri Persiapan Masalah.
   - **"Proses sebagian, order sisanya"** — qty tersedia dipotong FIFO
     & tercatat SEKARANG, sisa kekurangan otomatis jadi 1 entri BIASA
     baru di `persiapan_masalah` (status `menunggu`, masuk alur
     List/Nota Order Belanja yang sudah ada — TIDAK ADA field/skema
     baru di koleksi itu, cukup `keterangan` yang menjelaskan konteks
     "Kekurangan stok roll/lot saat Catat Pemakaian tanggal ...").
   - **"Tunggu dulu"** — TIDAK ADA yang dipotong/dicatat sekarang, cuma
     kekurangannya yang masuk `persiapan_masalah` (entri SAMA seperti
     opsi di atas) — admin/PIC coba lagi "Catat Pemakaian" (qty penuh)
     nanti setelah stok cukup. Rekonsiliasi/notifikasi otomatis "sudah
     cukup, boleh diproses" BELUM ada — murni manual, dicatat sebagai
     batasan yang disadari.
   - Rincian lot yang kepotong (FIFO berhasil, baik dari form utama
     maupun dari popup opsi A/B) ditampilkan lewat `alert()` (teks
     "Lot masuk {tanggal}: dipotong {qty} (sisa {qty})") DAN disimpan
     permanen di `rincian_lot` — muncul lagi sebagai ikon info (hover)
     di kolom Keterangan tabel Riwayat Pergerakan.
4. **`firestore.rules`** — block baru `lot_bahan_aksesoris` (pola sama
   koleksi Zevanic House lain: `login()` baca, `isAdminLevel()` tulis).
   **SUDAH ditempel & di-Publish Guru** (dikonfirmasi 27 Agt 2026 ~pukul
   15:17 WIB, lihat §27.2 — 1 file yang sama juga mencakup §25.1/§25.3).

**Yang SENGAJA TIDAK dikerjakan / masih batasan**:
- Modul SPK/produksi TETAP tidak disentuh (memang belum ada) — 3 opsi
  keputusan PIC murni bekerja di level "1 pengajuan Catat Pemakaian",
  BUKAN mengatur produksi.
- Opsi "Tunggu dulu" TIDAK ADA mekanisme otomatis buat memberi tahu PIC
  begitu stok sudah cukup lagi — PIC harus INGAT sendiri untuk kembali
  coba "Catat Pemakaian" lagi. Kandidat perbaikan ke depan kalau
  dibutuhkan (mis. notifikasi, atau tombol "coba proses ulang" di
  Persiapan Masalah yang langsung re-attempt FIFO).
- Cetak label per-roll (stiker fisik) MASIH belum disentuh sama sekali
  (dari §25.2), belum ada jadwal.
- Race condition antar-transaksi FIFO ditangani MINIMAL (pengecekan
  ulang + gagal-dengan-pesan-jelas kalau data berubah persis di tengah
  proses) — bukan retry otomatis. Risiko ini SANGAT kecil buat skala
  pemakaian tunggal (1 admin input manual di 1 waktu), belum jadi
  prioritas ditingkatkan.

**File yang diubah**: `vue-stock-pembelian.js` (`catatPergerakanKartuStok`
param baru `lotBaru`, fungsi baru `catatPemakaianDenganFifo`,
`catatRiwayatHargaDanUpdateMaster` pass `lotBaru`), `vue-kartu-stok.js`
(`catatPemakaian()` dirombak 2 jalur, popup 3 opsi keputusan, ikon
rincian lot di Riwayat Pergerakan), `firestore.rules` (block
`lot_bahan_aksesoris`), `index.html` (bump versi
`vue-stock-pembelian.js?v=5`, `vue-kartu-stok.js?v=2`).

Verifikasi: `node -c` lolos di `vue-stock-pembelian.js` DAN
`vue-kartu-stok.js`; tag HTML dalam template literal `vue-kartu-stok.js`
seimbang (div 28/28, button 11/11, p 5/5, label 6/6, table/tr/td/th/
thead/tbody semua seimbang, span 7/7, h3 2/2) — `vue-stock-pembelian.js`
tidak ada perubahan template kali ini (murni logic JS baru), tag lama
tetap seimbang seperti §25.2.

**Status: BELUM DITES SAMA SEKALI oleh Guru.** Rencana tes yang
disarankan:
1. Publish DULU `firestore.rules` lengkap (termasuk block
   `lot_bahan_aksesoris` baru ini + `master_rak_penyimpanan` dari §25.1
   yang juga masih menunggu).
2. Final-kan 1 Nota Order Belanja untuk item `pakai_lot_tracking` dengan
   `detail_lot` terisi (§25.2) — cek muncul dokumen baru di koleksi
   `lot_bahan_aksesoris` sejumlah baris `detail_lot`, `qty_awal` =
   `qty_sisa` = qty yang diisi, `status:"aktif"`.
2b. Buka Kartu Stok > Detail item itu — cek ada teks "Item ini dilacak
    per Roll/Lot" di bawah form Catat Pemakaian.
3. Catat Pemakaian dengan qty LEBIH KECIL dari total lot — cek
   `stok_akhir` berkurang benar, alert rincian lot muncul (lot mana
   yang kepotong), buka lagi salah satu dokumen `lot_bahan_aksesoris`
   yang kepotong → `qty_sisa` berkurang sesuai, cek juga baris baru di
   Riwayat Pergerakan ada ikon info kalau di-hover menampilkan rincian.
4. Catat Pemakaian dengan qty LEBIH BESAR dari total lot tersedia — cek
   popup 3 opsi muncul, coba masing-masing opsi satu-satu (di data uji
   yang beda-beda supaya tidak saling pengaruh): cek opsi "Kurangi"
   catat pas sejumlah tersedia; opsi "Proses sebagian" catat sejumlah
   tersedia DAN muncul 1 entri baru di Persiapan Masalah dengan
   keterangan yang jelas; opsi "Tunggu" TIDAK ada yang tercatat di
   Kartu Stok tapi entri Persiapan Masalah tetap muncul.
5. Coba Catat Pemakaian untuk item `pakai_lot_tracking` yang BELUM
   PERNAH ada Nota-nya sama sekali (belum ada dokumen lot) — cek
   diblokir dengan pesan jelas, BUKAN diam-diam lolos atau error aneh.
6. (Regresi) Cek item BIASA (tanpa `pakai_lot_tracking`) — Catat
   Pemakaian tetap jalan seperti biasa, TIDAK terpengaruh perubahan ini.

### 25.6 Tahap 2 — Pilih Roll/Lot MANUAL (cari kode/scan QR) + Cetak Label, GANTI FIFO otomatis §25.5 (25 Agt 2026)

Arahan Guru (verbatim, mengutip balik ringkasan pengiriman §25.5):
"Catat Pemakaian di Kartu Stok — untuk item yang ditandai per-Roll/Lot,
sekarang otomatis motong dari roll terlama dulu (FIFO), bukan cuma
kurangi angka total lagi. >> per lot punya id bahan / aksesoris masing2
jadi nanti saat ngambil karyawan cari kode yg sama (atau saat
pengambilan scan qr id bahan g mau dipakai lalu ambil yg mau
dipakainya) berlaku untuk yg non lot. coba kamu uraikan dlu sebelum
koding" — instruksi eksplisit untuk uraikan desain DULU sebelum nulis
kode apapun (dipatuhi: outline dikirim dulu ke Guru sebagai teks, baru
3 pertanyaan AskUserQuestion, baru mulai coding setelah dijawab).

**3 pertanyaan AskUserQuestion & jawaban Guru (verbatim)**:
1. "Mulai dari versi mana?" → **"Langsung ke Tahap 2, cetak label +
   scan QR"** — TIDAK mulai dari versi manual tanpa kamera (Tahap 1 yang
   diusulkan Claude di outline dilewati sepenuhnya).
2. "Kalau karyawan pilih roll yang BUKAN paling tua, gimana?" →
   **"Beri peringatan dulu kalau bukan yang tertua"** — konfirmasi
   sebelum simpan, BUKAN diblokir/dilarang.
3. "Untuk item BUKAN lot, scan/cari kode ngapain?" → **"Cuma buka form
   Catat Pemakaian lebih cepat (Recommended)"** — jalan pintas SAJA,
   TIDAK ADA perubahan logic stok buat item biasa.

**Perubahan desain vs §25.5**: FIFO OTOMATIS (`catatPemakaianDenganFifo()`)
DIGANTI TOTAL jadi FIFO SEBAGAI SARAN DEFAULT — karyawan tetap isi Jumlah
pemakaian seperti biasa, tapi SEKARANG sistem tampilkan tabel "Pilih
Roll/Lot yang Dipakai" (sudah terisi otomatis pakai saran roll tertua)
yang BOLEH diedit/diganti karyawan lewat cari kode (ketik) atau scan QR
label fisik roll — sesuai permintaan Guru "karyawan cari kode yg sama
(atau ... scan qr ... lalu ambil yg mau dipakainya)".

**Yang DIKERJAKAN**:

1. **Field BARU `kode_lot`** di `lot_bahan_aksesoris` — kode unik &
   manusia-terbaca per roll (mis. `"BHN-0001-L003"`), dibuat dari
   `master_bahan_aksesoris.id_tampil` (BUKAN `bahan_aksesoris_id`/ID
   dokumen Firestore-nya yang auto-generated & tidak enak dibaca/
   di-scan — sempat salah asumsi di draft awal implementasi, DIKOREKSI
   sebelum dikirim, lihat catatan `cariBahanByIdTampil`/`ambilBahanById`
   di poin 4) + counter BARU `lot_counter` di `master_bahan_aksesoris`,
   di-increment ATOMIK di `catatPergerakanKartuStok()` (transaksi yang
   SAMA dengan pembuatan lot & update `stok_akhir`, tidak ada baca
   tambahan). Fungsi ini SEKARANG me-RETURN `{ lotDibuat: [...] }`
   (id, kode_lot, qty, tanggal_masuk, keterangan) — dipakai fitur cetak
   label (poin 3).
2. **`catatPemakaianDenganFifo()` DIHAPUS, GANTI `catatPemakaianDariAlokasi()`**
   (`vue-stock-pembelian.js`) — terima `alokasi` (`{lotId, qty}[]`) yang
   SUDAH ditentukan pemanggil (`vue-kartu-stok.js`, FIFO cuma saran
   default di sana, lihat poin 3), HANYA validasi total alokasi sama
   dengan qty pemakaian, lalu eksekusi transaksional (baca ULANG semua
   lot yang dialokasikan lewat `tx.get()` — data FRESH, jaga-jaga ada
   pemakaian lain nyelip — baru tulis `qty_sisa` tiap lot + `stok_akhir`
   + 1 baris `kartu_stok_bahan_aksesoris` dengan `rincian_lot` [termasuk
   `kode_lot` sekarang] terisi). Cek `LOT_KOSONG`/`LOT_KURANG` (belum ada
   data lot / lot aktif < qty diminta) SEKARANG dilakukan
   `vue-kartu-stok.js` SENDIRI lewat `ambilLotAktif()` SEBELUM tabel
   alokasi dibuka — bukan dilempar dari fungsi backend ini lagi. 3 opsi
   keputusan PIC saat kurang (§25.5) TIDAK BERUBAH alurnya, cuma
   fungsi pemotongnya yang ganti nama/cara (lihat "Fungsi BARU" di
   bawah).
3. **`vue-kartu-stok.js` — "Catat Pemakaian" dirombak jadi tabel alokasi**
   (item `pakai_lot_tracking` saja, item biasa TETAP jalur LAMA, tidak
   berubah sama sekali):
   - Klik "Lanjut" → cek `daftarLotAktif` (dimuat `ambilLotAktif()` saat
     Detail dibuka) kosong → BLOKIR (pesan sama seperti §25.5). Total
     `qty_sisa` < qty diminta → popup 3 opsi keputusan (SAMA §25.5, 2
     dari 3 opsi sekarang panggil `catatPemakaianDariAlokasi()` dengan
     alokasi FIFO PENUH dari semua lot yang ada — tidak ada pilihan
     manual di kondisi kurang ini, karena memang cuma segini adanya).
   - Cukup → tabel **"Pilih Roll/Lot yang Dipakai"** terbuka, SUDAH
     terisi saran FIFO (`bangunAlokasiFifo()`) — kolom Kode Roll,
     Tanggal Masuk, Tersedia, Diambil (input angka, editable per baris,
     clamp ke `qty_sisa`), tombol hapus per baris.
   - **Cari kode roll** (input teks, filter `kode_lot` yang cocok, klik
     hasil untuk tambah/pilih ke tabel) DAN tombol **"Scan Roll"**
     (kamera) — dua cara yang SAMA-SAMA memenuhi permintaan Guru
     "karyawan cari kode yg sama (atau ... scan qr ...)".
   - Klik "Konfirmasi & Simpan" → validasi total alokasi = qty target
     dulu, lalu **kalau alokasi akhir BEDA dari saran FIFO** →
     `confirm()` peringatan ("Roll/lot yang dipilih BUKAN yang
     tertua...") — sesuai jawaban Guru poin 2, BUKAN diblokir, cuma
     minta konfirmasi sadar. Baru panggil `catatPemakaianDariAlokasi()`.
4. **Fungsi BARU (export) di `vue-stock-pembelian.js`**:
   `ambilLotAktif(bahanId)` (daftar lot aktif urut FIFO, dipakai isi
   tabel alokasi & cek kosong/kurang), `cariLotByKode(kodeLot)` (cari 1
   lot lewat `kode_lot` persis — hasil scan/ketik), `cariBahanByIdTampil(idTampil)`
   (query field `id_tampil`, BUKAN getDoc langsung — karena `id_tampil`
   itu field TERPISAH dari ID dokumen Firestore `master_bahan_aksesoris`,
   ini poin yang sempat salah diasumsikan di draft awal sebelum
   dikoreksi), `ambilBahanById(bahanId)` (getDoc langsung lewat ID
   dokumen asli, dipakai resolve `lot.bahan_aksesoris_id` hasil
   `cariLotByKode()` yang SUDAH ID dokumen).
5. **"Scan Barang"** (tombol BARU di Kartu Stok Ringkasan) — scan QR
   label roll (atau ketik kode) → `cariLotByKode()` lalu
   `ambilBahanById()` (fallback `cariBahanByIdTampil()` kalau bukan kode
   lot) → langsung buka Kartu Stok Detail item itu. Jalan pintas SAJA
   (jawaban Guru poin 3: "Cuma buka form Catat Pemakaian lebih cepat")
   — berlaku SAMA untuk item lot MAUPUN BUKAN lot, TIDAK ADA perubahan
   logic stok.
6. **"Scan Roll"** (tombol BARU di tabel alokasi, Detail) — scan QR
   label fisik roll → `cariLotByKode()`, WAJIB `bahan_aksesoris_id`-nya
   sama dengan item yang sedang dibuka (kalau beda, ditolak dengan
   pesan jelas "roll ini bukan untuk item ini") → tambah/pilih ke tabel
   alokasi.
7. **Kamera Scan QR** (`vue-kartu-stok.js`) — pola SALIN ULANG PERSIS
   dari `js/vue-scan-qr.js` yang sudah ada (`jsQR`, CDN, dimuat lazy;
   `navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})`;
   loop `requestAnimationFrame` baca frame canvas) — konsisten pola
   "salin logic kecil per-file" yang sudah dipakai proyek ini (bukan
   `import` lintas file). 1 modal dipakai bareng buat "Scan Barang" &
   "Scan Roll", dibedakan lewat state `modeScan`.
8. **Cetak Label Roll** (`cetakLabelLot()`, BARU di `OrderBelanjaScreen`,
   `vue-stock-pembelian.js`) — begitu Nota Order Belanja di-final-kan &
   ada roll/lot baru dibuat (`lotDibuat` dari poin 1), tombol "Cetak
   Label Roll" muncul di bawah form: 1 label per roll (`kode_lot` + QR +
   nama/qty/tanggal), dicetak lewat `window.open()` +
   `document.write()` + `window.print()` (pola SAMA seperti `cetak()`
   Nota yang sudah ada) — library pembuat QR (`qrcodejs`, davidshimjs,
   CDN) dimuat & DIJALANKAN DI DALAM window cetak itu sendiri (bukan
   window utama) supaya tidak ada masalah objek lintas-window. TIDAK
   auto-cetak — admin yang putuskan kapan (mis. sekalian nempel label
   ke roll fisiknya begitu barang sampai).

**Yang SENGAJA TIDAK dikerjakan / masih batasan**:
- Deteksi "menyimpang dari FIFO" murni membandingkan SET roll+qty final
  vs saran FIFO default (`bangunAlokasiFifo()` dipanggil ulang buat
  qty yang sama) — bukan logic "seberapa jauh" penyimpangannya, cukup
  ya/tidak buat trigger `confirm()` peringatan.
- Popup 3 opsi keputusan (kondisi lot kurang) TETAP tidak punya pilihan
  manual roll — otomatis pakai semua lot yang ada (FIFO penuh), sesuai
  keputusan Guru §25.5 poin 1 yang tidak diubah di ronde ini.
- Kamera & cetak fisik (QR generation di window print) **BELUM BISA
  DIVERIFIKASI Claude SAMA SEKALI** — butuh device fisik (kamera HP/
  laptop, printer/label fisik) untuk ditest sungguhan. Yang sudah
  diverifikasi Claude cuma: sintaks (`node -c`), keseimbangan tag HTML
  di template literal, dan cross-check nama variabel/fungsi
  dipakai-vs-dikembalikan `setup()`. **WAJIB ditest langsung oleh
  Guru** sebelum dianggap benar-benar jalan.
- Format `kode_lot` (`{id_tampil}-L{counter 3 digit}`) belum pernah
  didiskusikan detail formatnya ke Guru — asumsi rendah-risiko yang
  diambil sendiri (mudah dibaca, konsisten pola ID lain di proyek ini
  seperti `id_tampil` bahan & `no_pembelian`), BUKAN keputusan yang
  diminta konfirmasi eksplisit — kalau Guru mau format lain, gampang
  diganti (1 baris kode di `catatPergerakanKartuStok()`), belum ada
  data lot ber-`kode_lot` yang sudah tercetak sungguhan jadi aman
  diubah kapan saja sebelum tes pertama.

**File yang diubah**: `vue-stock-pembelian.js` (`catatPergerakanKartuStok`
tambah `kode_lot`/`lot_counter`/return `lotDibuat`; fungsi baru
`ambilLotAktif`, `cariLotByKode`, `cariBahanByIdTampil`, `ambilBahanById`;
`catatPemakaianDenganFifo` DIHAPUS diganti `catatPemakaianDariAlokasi`;
`catatRiwayatHargaDanUpdateMaster` kumpulkan & return `lotDibuat`;
`simpan()` tangkap `lotUntukCetak`; fungsi baru `cetakLabelLot()` +
tombol "Cetak Label Roll" di template), `vue-kartu-stok.js` (rombak
besar: tabel alokasi roll/lot, kamera Scan QR disalin dari
`vue-scan-qr.js`, tombol "Scan Barang"/"Scan Roll", fungsi baru
`mulaiCatatPemakaian`/`bangunAlokasiFifo`/`konfirmasiAlokasi`/dst — file
ditulis ulang penuh lewat `Write`, bukan `Edit` bertahap, karena
cakupan perubahan menyentuh hampir semua bagian `setup()` & template),
`index.html` (bump versi `vue-stock-pembelian.js?v=6`,
`vue-kartu-stok.js?v=3`), `docs/PETA-DATABASE.md` (field `kode_lot`,
`lot_counter`, alur baru), `docs/PETA-MENU.md` (deskripsi menu Stock &
Pembelian + `vue-kartu-stok.js` diperbarui). **TIDAK ADA perubahan
`firestore.rules`** — `kode_lot`/`lot_counter` cuma field baru di
dokumen koleksi yang SUDAH ADA rule-nya (`lot_bahan_aksesoris`,
`master_bahan_aksesoris`), bukan koleksi baru.

Verifikasi: `node -c` lolos di `vue-stock-pembelian.js` DAN
`vue-kartu-stok.js`; tag HTML dalam template literal seimbang di
KEDUA file (div/button/table/tr/td/th/thead/tbody/p/label/span/h3/input
dicek manual lewat skrip Node — semua cocok, `input` sengaja tanpa tag
penutup karena void element HTML); semua nama yang dipakai template
`vue-kartu-stok.js` dicross-check ADA di `return {...}` `setup()`nya
(termasuk `daftarLotAktif`, `modeScan`, `videoScanEl`/`canvasScanEl`
buat `ref=` template).

**Status: BELUM DIKIRIM ke Guru, BELUM DITES SAMA SEKALI.** Rencana tes
yang disarankan (SETELAH `firestore.rules` dipublish & kode di-deploy
ke GitHub — repo LIVE masih di state SEBELUM §25 sama sekali per
pengecekan `git clone` terakhir, lihat §25.5):
1. Final-kan 1 Nota Order Belanja untuk item `pakai_lot_tracking` dengan
   `detail_lot` terisi — cek muncul dokumen baru di `lot_bahan_aksesoris`
   dengan `kode_lot` terisi format `{ID}-L001`, `{ID}-L002`, dst
   (counter naik per item, BUKAN global) — DAN cek tombol "Cetak Label
   Roll" muncul di bawah form, klik → cek window baru kebuka isi label +
   QR per roll (browser popup mungkin perlu diizinkan dulu).
2. Buka Kartu Stok > Detail item itu, isi Jumlah pemakaian LEBIH KECIL
   dari total lot, klik "Lanjut" — cek tabel "Pilih Roll/Lot yang
   Dipakai" muncul SUDAH terisi otomatis (roll tertua duluan), total
   "Diambil" sudah pas dengan Jumlah yang diisi.
3. Coba HAPUS baris yang otomatis terisi, TAMBAH roll lain lewat "Cari
   kode roll" (ketik sebagian `kode_lot`) sampai total pas lagi, klik
   "Konfirmasi & Simpan" — cek MUNCUL peringatan "bukan yang tertua"
   dulu (karena roll yang dipilih beda dari saran FIFO), lanjutkan → cek
   `stok_akhir` berkurang benar, `lot_bahan_aksesoris.qty_sisa` roll
   yang DIPILIH (bukan yang disarankan FIFO) yang berkurang.
4. Test tombol "Scan Roll" & "Scan Barang" pakai kamera HP/laptop
   sungguhan, scan label yang barusan dicetak di langkah 1 — cek kamera
   kebuka (izin browser), QR kebaca, roll/item yang benar yang
   ketambah/kebuka. **Ini bagian PALING PENTING buat ditest** karena
   sama sekali belum bisa diverifikasi Claude.
5. (Regresi) Ulangi tes §25.5 poin 4-6 (kondisi lot kurang & item
   biasa) — pastikan MASIH jalan sama seperti sebelumnya, TIDAK
   terpengaruh rombakan Tahap 2 ini.

### 25.7 Dropdown "Nama Barang"/"Nama Internal" tampilkan Warna + fix silent bug salah-varian (25 Agt 2026)

Arahan Guru (verbatim, dengan screenshot Nota Order Belanja): "untuk
dropdown nama barang pada menu alias pebelian, list order belanja dan
nota order belanja bisa di tambhakan dengan warna bahan atau
aksesorisnya misal : DUSKY CRINKLE BLUSH PINK".

**Temuan sebelum diperbaiki (BUKAN cuma soal tampilan)**: dropdown "Nama
Barang" (List/Nota Order Belanja) dan "Nama Internal" (Alias Pembelian)
cuma menampilkan `nama` polos dari `master_bahan_aksesoris` — kalau ada
beberapa item dengan `nama` SAMA tapi `warna` beda (kasus NORMAL, warna
field terpisah & wajib diisi di Data Bahan & Aksesoris), item-itemnya
TIDAK BISA dibedakan sama sekali di dropdown. LEBIH PARAH: begitu salah
satu dipilih, kode mencocokkan balik ke item aslinya cuma lewat `nama`
(`.find(b => b.nama === ...)`) — yang SELALU mengambil hasil PERTAMA
yang cocok di array, jadi bisa nyantol ke VARIAN WARNA YANG SALAH tanpa
ada tanda error apapun. Ini silent bug nyata (bisa salah tempel alias ke
warna yang salah, atau salah masuk baris pesanan pembelian warna yang
salah), bukan cuma kurang enak dilihat — ditemukan & diperbaiki
sekaligus karena akar masalahnya sama (satu fungsi format/cocok yang
kurang lengkap).

**Yang dikerjakan**: fungsi BARU `formatNamaBahan(b)` (module-level,
`vue-stock-pembelian.js`, dekat `formatRupiah`) — gabung `nama` + `warna`
(mis. `"DUSKY CRINKLE BLUSH PINK"`, format persis contoh Guru, warna
di-skip kalau kosong). Dipakai di 2 titik (3 layar, karena List & Nota
Order Belanja BERBAGI 1 komponen `OrderBelanjaScreen`):
- `AliasPembelianManager.opsiNamaInternal` (isi dropdown) & `tambah()`
  (cocokkan balik ke item) — GANTI dari `b.nama` polos.
- `OrderBelanjaScreen.opsiNamaBarang` (isi dropdown, dipakai List & Nota)
  & `tambahItemManual()` (cocokkan balik ke item) — GANTI dari `b.nama`
  polos.

`DropdownCari` (`vue-components.js`) SENGAJA TIDAK diubah — komponennya
generik (dipakai banyak dropdown lain di seluruh sistem, cuma terima
array string polos) sudah cukup buat kebutuhan ini asal string yang
dikasih SUDAH gabungan nama+warna dari sumbernya; mengubah kontraknya
jadi label/value beresiko menyentuh dropdown lain yang tidak perlu
disentuh (prinsip hemat/minim risiko).

**Batasan yang disadari**: kalau ada 2 item dengan `nama` DAN `warna`
PERSIS SAMA (duplikat sungguhan, bukan cuma nama sama beda warna),
ambiguitas lamanya masih ada (ambil yang pertama cocok) — kasus ini
jauh lebih jarang & di luar cakupan permintaan Guru kali ini, tidak
ditambah logic dedup/disambiguasi lebih lanjut.

**File yang diubah**: `vue-stock-pembelian.js` (fungsi baru
`formatNamaBahan`, `opsiNamaInternal`/`tambah()` di
`AliasPembelianManager`, `opsiNamaBarang`/`tambahItemManual()` di
`OrderBelanjaScreen`), `index.html` (bump versi
`vue-stock-pembelian.js?v=7`).

Verifikasi: `node -c` lolos, tag HTML template literal seimbang
(tidak ada perubahan template, murni logic JS) — TIDAK ada perubahan
skema Firestore/`firestore.rules` (murni tampilan+matching di sisi
klien).

**STATUS: SUDAH DITES Guru di live (gechoo.online), DIKONFIRMASI JALAN
("mantappp guruu jooss", lalu "done aman").** Sempat Guru laporkan
dropdown-nya "masih belum berubah" — dicek fresh `git clone` ke repo
GitHub, kode BARU ternyata SUDAH ke-deploy (`vue-stock-pembelian.js?v=7`,
`formatNamaBahan` ada) — jadi bukan soal deploy, disimpulkan cache
browser (index.html lama ke-cache, masih minta `?v=6`). Diarahkan hard
refresh (Ctrl/Cmd+Shift+R) — BERHASIL, dropdown tampil nama+warna
seperti diminta. Poin (1) di atas (dropdown tampil "Nama Warna")
TERKONFIRMASI. Poin (2) & (3) — beda-nya kelihatan kalau ada 2+ item
nama sama warna beda, dan hasil yang tersimpan memang varian warna yang
dipilih (bukan silent-bug lama) — TIDAK secara eksplisit disebutkan
Guru saat konfirmasi, tapi lewat jalur kode YANG SAMA (`formatNamaBahan`
dipakai baik buat tampilan MAUPUN pencocokan balik), jadi risiko rendah
kalau poin (1) sudah pasti benar.

### 25.8 Fix: "Cetak Label Roll" cetak tapi kode QR tidak muncul (25 Agt 2026)

**Laporan Guru (verbatim, sambil kutip ulang ringkasan pengiriman Tahap
2 sebelumnya)**: "cetak label roll sudah bisa tapi kode qr nya ga ada
guru" — tombol Cetak Label Roll di Nota Order Belanja JALAN, label
tercetak (kode_lot, nama, qty, tanggal SEMUA muncul), TAPI gambar QR
code-nya kosong/tidak ada.

**Diagnosis (BUKAN tebak-tebak — dicek langsung sebelum ubah apapun)**:
Fungsi `cetakLabelLot()` versi lama memuat library pembuat-QR
(`qrcodejs`, davidshimjs) lewat tag `<script src="...cdnjs...">` yang
disisipkan via `document.write()` KE DALAM window print yang baru saja
dibuka (`window.open('', '_blank')`), lalu QR digambar lewat
`window.onload` di window print itu sendiri.

Langkah verifikasi yang dilakukan:
1. Cek URL `cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js`
   lewat fetch langsung (bukan asumsi) — **URL-nya VALID**, isinya
   memang kode `qrcodejs` yang benar. Jadi BUKAN salah URL/versi.
2. Cek pola pemuatan library eksternal LAIN yang SUDAH terbukti jalan
   di app ini: `jsQR` (dipakai fitur Scan QR Absensi & Scan
   Barang/Roll Kartu Stok) — ternyata dimuat lewat `<script>` BIASA di
   `index.html` (di-load sekali saat app pertama buka), **BUKAN** lewat
   `document.write()` di window terpisah. Pola `cetakLabelLot()` yang
   lama beda sendiri dari satu-satunya pola yang sudah terbukti aman.
3. Cek dokumentasi resmi Chrome soal intervensi `document.write()`:
   Chrome BISA membatalkan eksekusi `<script>` lintas-domain yang
   disisipkan lewat `document.write()` di halaman utama pada kondisi
   tertentu (koneksi lambat) — jadi ini kandidat penyebab nyata, bukan
   spekulasi kosong.
4. Cek kode sumber `qrcodejs` langsung: `new QRCode(...)` MEMANG
   menggambar ke `<canvas>` secara SINKRON (langsung selesai saat
   `new QRCode()` return), TAPI ada proses TAMBAHAN yang mengubah
   canvas itu jadi `<img>` lewat `canvas.toDataURL()` + `Image.onload`
   yang jalannya ASYNC (di semua browser, bukan cuma Android lama) —
   proses ini SELALU dipicu, dan kalaupun secara visual biasanya tidak
   masalah, ini nambah satu lapis ketergantungan waktu (timing) yang
   tidak perlu ada di window print yang keburu `window.print()`.

Kesimpulan: bukan satu penyebab tunggal yang bisa dipastikan 100% tanpa
akses ke browser Guru langsung, TAPI pola "muat script eksternal +
document.write() di window print baru" itu sendiri adalah pola BERISIKO
(beda dari satu-satunya pola yang terbukti aman di app ini, dan cocok
dengan beberapa cara gagal nyata di atas) — jadi perbaikannya
menghilangkan SELURUH kelas risiko itu sekaligus, bukan cuma
tambal salah satu kemungkinan.

**Yang dikerjakan**:
- `index.html`: tambah `<script src="https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js">`
  di `<head>`, persis di sebelah tag `jsQR` yang sudah terbukti jalan —
  library `qrcodejs` sekarang SELALU siap begitu app dibuka, tidak lagi
  dimuat on-demand di window print.
- `vue-stock-pembelian.js`: fungsi baru `buatQrDataUrl(teks)` —
  menggambar 1 kode QR ke `<div>` tersembunyi DI WINDOW UTAMA
  (`document.body`, posisi `absolute` di luar layar), ambil hasilnya
  langsung dari `<canvas>` bawaan library via `canvas.toDataURL('image/png')`
  (SINKRON, tidak nunggu proses async internal library sama sekali),
  lalu buang elemen sementaranya. `cetakLabelLot()` ditulis ulang:
  panggil `buatQrDataUrl()` utk tiap lot DI WINDOW UTAMA dulu (hasil
  gambar base64), baru kirim HTML ke window print isinya `<img src="data:image/png;base64,...">`
  statis biasa — window print SAMA SEKALI tidak lagi muat apa pun dari
  internet. Kalau `QRCode` ternyata belum siap (edge case: klik
  terlalu cepat sebelum library selesai load) — sekarang ada pesan
  jelas "Library pembuat QR belum siap dimuat. Coba refresh halaman..."
  dulu, bukan diam-diam gagal.

**File yang diubah**: `index.html` (tambah tag `<script>` qrcodejs,
bump versi `vue-stock-pembelian.js?v=8`), `vue-stock-pembelian.js`
(fungsi baru `buatQrDataUrl`, `cetakLabelLot()` ditulis ulang total —
lihat komentar §25.8 di kode persis di atas fungsinya).

Verifikasi: `node -c` lolos, tag HTML template literal seimbang (dicek
manual, satu selisih di penghitungan otomatis ternyata cuma dari kata
"<div>" di KOMENTAR kode, bukan template sungguhan — sudah dipastikan).
TIDAK ada perubahan skema Firestore/`firestore.rules`.

**STATUS: BELUM DITES Guru di live.** Ini perbaikan atas laporan bug
Guru — minta Guru coba lagi tombol "Cetak Label Roll" di Nota Order
Belanja (pastikan hard refresh Ctrl/Cmd+Shift+R dulu biar tidak kena
cache seperti kasus §25.7) dan konfirmasi apakah kode QR-nya sekarang
muncul di label yang dicetak/preview print.

### 25.9 Revisi susunan Alias Pembelian (entry + tabel) + fix tabel tidak tampilkan warna (25 Agt 2026)

**Permintaan Guru (verbatim)**: "Stock & Pembelian > Alias Pembelian,
revisi susunan entry dan table. field entry: Suplayer, Nama di Nota
Suplayer, Nama Internal (Nama + Warna). field table: Suplayer, Nama Di
nota, Nama Internal (Nama + Warna)".

**Yang dikerjakan**:
- **Entry** (`AliasPembelianManager`) — urutan field diubah jadi
  Suplayer → Nama di Nota Suplayer → Nama Internal (dropdown, label
  ditambah "(Nama + Warna)"). SEBELUMNYA urutannya Suplayer → Nama
  Internal → Nama di Nota (tombol Tambah nempel di field itu). Tombol
  Tambah sekarang jadi 1 kolom grid tersendiri di ujung (pola sama
  seperti entry row Daftar Pesanan di List/Nota Order Belanja).
- **Tabel** — kolom diubah jadi Suplayer → Nama di Nota → "Nama
  Internal (Nama + Warna)" (urutan & label sesuai persis permintaan).

**Bug tambahan ditemukan & diperbaiki sekaligus** (bukan cuma tampilan
tabel, tapi soal DATA): dropdown Nama Internal di entry SUDAH pakai
`formatNamaBahan()` (nama+warna) sejak §25.7, TAPI pas disimpan ke
Firestore, field `bahan_aksesoris_nama` yang ditulis masih `bahan.nama`
POLOS (tanpa warna) — jadi walau dropdown-nya sudah benar, tabel Alias
Pembelian TETAP TIDAK BISA membedakan warna, sama seperti sebelum
§25.7. Diperbaiki dengan 2 langkah: (1) `tambah()` sekarang simpan
`formatNamaBahan(bahan)` (nama+warna) ke `bahan_aksesoris_nama` —
dipakai sebagai arsip/fallback; (2) tabel SEKARANG tampilkan lewat
fungsi baru `namaInternalTampil(a)` yang cari LIVE ke `daftarBahan`
(bukan baca field statis) — supaya kalau nama/warna item internal
diedit belakangan di Data Bahan & Aksesoris, alias LAMA ikut tampil
ter-update juga, bukan data beku saat alias dibuat. Fallback ke field
`bahan_aksesoris_nama` yang tersimpan HANYA kalau item internalnya
sudah dihapus.

**File yang diubah**: `vue-stock-pembelian.js` (`AliasPembelianManager`
— `tambah()`, fungsi baru `namaInternalTampil()`, template entry+tabel),
`index.html` (bump versi `vue-stock-pembelian.js?v=9`).

Verifikasi: `node -c` lolos, tag HTML template literal seimbang. TIDAK
ada perubahan skema Firestore (field `bahan_aksesoris_nama` yang sudah
ada dipakai apa adanya, cuma isinya sekarang nama+warna bukan nama
polos — dokumen LAMA yang sudah ada juga otomatis ikut tampil benar
lewat lookup live `namaInternalTampil()`, tidak perlu migrasi data).

**STATUS: BELUM DITES Guru di live.**

### 25.10 Dropdown "Nama Barang" (List & Nota Order Belanja) SEKARANG juga bisa dicari lewat nama Alias (26 Agt 2026)

**Permintaan Guru (verbatim)**: "cek menu list order belanja dan nota
order belanja, pada field nama barang disana data alias tidak muncul,
harusnya nama internal + warna dan atau nama alias juga muncul saat
pencarian".

**Sebelumnya**: dropdown "Nama Barang" di `OrderBelanjaScreen` (dipakai
BARENG List & Nota) CUMA berisi nama+warna internal (`formatNamaBahan()`,
§25.7) — data `alias_pembelian` (menu Alias Pembelian) TIDAK PERNAH
dimuat/dipakai sama sekali di komponen ini, jadi kalau admin mengetik
nama barang PERSIS SEPERTI DI NOTA SUPLAYER (yang sudah dipetakan lewat
Alias Pembelian), tidak akan ketemu apa-apa — harus tahu & ketik nama
INTERNAL-nya dulu.

**Yang dikerjakan**:
- `OrderBelanjaScreen` sekarang JUGA memuat `alias_pembelian` (query
  tanpa `where`, sama seperti `AliasPembelianManager`) di `muatSemua()`.
- Opsi dropdown "Nama Barang" (`opsiNamaBarang`) sekarang GABUNGAN: (a)
  semua nama+warna internal (SAMA seperti sebelumnya), (b) semua nama
  alias — ditulis dengan label jelas `"{nama di nota} (alias {Suplayer}
  → {nama+warna internal})"` supaya kelihatan itu alias (bukan nama
  internal asli) DAN supaya alias dari Suplayer BEDA yang kebetulan
  teksnya sama tetap bisa dibedakan.
- Resolve balik ke item bahan (`tambahItemManual()`) SEKARANG lewat 1
  sumber kebenaran tunggal: `opsiNamaBarangMap` (`Map<label, bahan>`,
  dibangun bareng `opsiNamaBarang` dari data yang SAMA) — baik nama
  internal maupun label alias yang dipilih langsung ter-resolve ke
  bahan yang benar, tidak ada 2 jalur re-matching terpisah yang bisa
  tidak sinkron.
- Alias yang item internalnya sudah TERHAPUS otomatis di-skip (tidak
  ikut muncul di dropdown) — tidak mungkin di-resolve balik lagi.

**Batasan yang disadari**: opsi alias TIDAK di-filter berdasarkan
Suplayer yang sedang dipilih di form entry — SEMUA alias dari SEMUA
Suplayer muncul (label-nya menyebutkan nama Suplayer masing-masing
supaya tetap jelas sumbernya). Ini keputusan SEPIHAK (belum ditanyakan
eksplisit ke Guru) — kalau ternyata mau di-filter ikut Suplayer yang
lagi dipilih, kabari, gampang ditambah.

**File yang diubah**: `vue-stock-pembelian.js` (`OrderBelanjaScreen` —
`daftarAlias` baru, `muatSemua()`, `opsiNamaBarangMap`/`opsiNamaBarang`,
`tambahItemManual()`), `index.html` (bump versi
`vue-stock-pembelian.js?v=10`).

Verifikasi: `node -c` lolos, tag HTML template literal seimbang. TIDAK
ada perubahan skema Firestore (baca `alias_pembelian` apa adanya, tidak
ada field baru).

**STATUS: BELUM DITES Guru di live.**

### 25.11 Revisi besar List/Nota Order Belanja — kunci Suplayer di Nota, filter alias per-Suplayer, susun ulang field & kolom tabel (26 Agt 2026)

**Permintaan Guru (verbatim, disingkat)**: alias dropdown "dibatasi
hanya alias milik Suplayer yang sedang dipilih saja biar tidak
acak2an", format alias saat tampil "langsung nama alias dari suplayer
saja tidak perlu embel2 biar rapih", "khusus untuk nota order belanja 1
nota = 1 suplayer ... saat tambah entry data pertama pada nota order
belanja field suplayer lock sampai di klik disimpan", "saat tombol
tambah default cursor ke field qty", plus revisi posisi field & kolom
tabel (rincian di bawah).

**1. Filter alias per-Suplayer + format polos** (revisi §25.10 yang
baru dikirim sebelumnya) — `opsiNamaBarangMap` SEKARANG cuma
menyertakan alias milik Suplayer yang SEDANG dipilih di field Suplayer
(sebelumnya: SEMUA Suplayer). Label alias di dropdown SEKARANG cuma
`nama_di_nota` POLOS (sebelumnya ada embel2 "(alias {Suplayer} → ...)")
— aman dibuat polos karena sudah dibatasi per-Suplayer, jadi tidak
mungkin lagi ada 2 alias sama teks dari Suplayer beda muncul
berbarengan. Alias TIDAK muncul sama sekali sebelum Suplayer dipilih.

**2. Nota Order Belanja: 1 Nota = 1 Suplayer** — field Suplayer
DIPINDAH dari baris entry ke baris header (bareng No. Pembelian &
Tanggal), dan `suplayerTerkunci` (computed dari `daftarPesanan.length >
0`, KHUSUS `modeNota`) mengunci field itu begitu item PERTAMA
ditambahkan — lepas otomatis lagi begitu `simpan()` sukses (form
kosong). **List Order Belanja TIDAK terkena aturan ini** — tetap boleh
multi-Suplayer per dokumen seperti sebelumnya (field Suplayer TETAP di
baris entry per-item, TIDAK dipindah).

**3. Fokus otomatis ke Qty** — begitu tombol Tambah diklik & item masuk
tabel, cursor otomatis pindah/fokus ke field Qty lagi (`qtyEntryEl` +
`nextTick`), biar entry item berikutnya tidak perlu klik manual.

**4. Revisi posisi field** (List & Nota):
- Baris 1: No. Pembelian, Tanggal, **+ Suplayer khusus Nota** (List: 2
  kolom saja, Suplayer tidak di sini).
- Baris 2 (baris sendiri, BUKAN lagi 1 dari 3 kolom): Estimasi Biaya
  Belanja — ukuran diperbesar ~1.5x (padding `9px 12px`→`14px 18px`,
  font-size implisit→`19px` eksplisit, radius `10px`→`15px`).
- Baris 3 (entry item): Nota = Qty, Satuan (BARU, read-only — ikut
  Satuan Pembelian item yang dipilih di Nama Barang), Nama Barang,
  Tambah. List = Suplayer (tetap di sini), Qty, Satuan (BARU), Nama
  Barang, Tambah.

**5. Revisi kolom tabel Daftar Pesanan Pembelian** (urutan PERSIS
diminta Guru): Aksi (ikon qty per lot), Checkbox, No, **Suplayer
(HANYA List — Nota dihilangkan, karena sudah 1 Suplayer di header)**,
**"ID Bahan & Aksesoris"** (rename dari "SKU"), Qty Beli (dulu "QTY"),
Satuan Beli (dulu "Satuan Bahan"), Qty Pakai (dulu "QTY-s"), Satuan
Pakai (dulu "Satuan"), **Nama Alias (BARU)**, Nama Barang, Harga,
Jumlah, Keterangan.

**Bug tambahan ditemukan & diperbaiki sekaligus** (bukan cuma
rename kolom "SKU"→"ID Bahan & Aksesoris" — datanya sendiri SALAH):
kolom itu SEBELUMNYA menyimpan `item.id` (ID DOKUMEN FIRESTORE
auto-generated, mis. `"aB3xY9pQz..."`) — BUKAN `id_tampil` (ID
manusia-terbaca, mis. `"BHN-0001"`, lihat catatan `id_tampil` vs ID
dokumen di `PETA-DATABASE.md`). Jadi kolom ini selama ini menampilkan
ID mentah yang tidak enak dibaca — apalagi sekarang headernya eksplisit
"ID Bahan & Aksesoris". Diperbaiki: `buatBarisPesanan()` sekarang isi
`sku: item.id_tampil || item.id` (fallback ke ID dokumen HANYA kalau
`id_tampil` kosong/data lama-rusak). Field DI DATABASE tetap namanya
`sku` (tidak di-rename, supaya data lama yang sudah tersimpan tetap
kebaca) — cuma NILAI & LABEL kolomnya yang berubah.

**Kolom "Nama Alias" (BARU)**: diisi otomatis dari alias yang dipilih
lewat dropdown Nama Barang (kalau item dipilih lewat alias) — kosong
kalau dipilih langsung lewat nama+warna internal. Field baru
`nama_alias` ditambahkan ke `buatBarisPesanan()` & tersimpan di
`pesanan_pembelian.items[].nama_alias` (schema BARU, lihat
PETA-DATABASE.md).

**Keputusan SEPIHAK yang diambil (belum eksplisit dikonfirmasi Guru,
mohon dicek)**: instruksi Guru menyebut kolom baris 1 "Suplayer (khusus
list order belanja hilangkan)" TAPI baris entry item (baris 3) hanya
disebutkan "Qty, Satuan, Nama Barang, Tambah" tanpa Suplayer — sekilas
kontradiktif dengan kolom tabel yang TETAP menyebut "Suplayer (khusus
NOTA order belanja hilangkan)" (List tetap punya Suplayer). Diselesaikan
dengan interpretasi: baris 3 versi "Qty, Satuan, Nama Barang, Tambah"
itu KHUSUS Nota (karena Suplayer-nya sudah pindah ke baris 1 buat
Nota); untuk List, field Suplayer di baris entry TETAP ADA seperti
sebelumnya (tidak disebut ulang di instruksi karena memang tidak
berubah posisinya buat List) — supaya konsisten dengan kolom tabel
Suplayer yang tetap ada di List. **Kalau ternyata maksud Guru BEDA
(mis. List juga mau Suplayer dihilangkan total dari entry, lalu
per-item Suplayer diisi dengan cara lain), tolong dikoreksi.**

**File yang diubah**: `vue-stock-pembelian.js` (`OrderBelanjaScreen` —
`opsiNamaBarangMap` direvisi filter+label, `satuanEntryTampil` baru,
`suplayerTerkunci` baru, `qtyEntryEl` baru + fokus di `tambahItemManual()`,
`buatBarisPesanan()` — `sku` & `nama_alias`, template baris
1/2/3 & tabel disusun ulang), `index.html` (bump versi
`vue-stock-pembelian.js?v=11`).

**Verifikasi ukuran main konten** (pertanyaan Guru) — dicek langsung ke
`css/gechoo-design.css` & `index.html` (bukan tebak-tebak): area konten
utama (`<main>`) TIDAK punya `max-width` — lebar penuh mengisi sisa
ruang setelah sidebar desktop (`.gc-sidebar.w-64` = 256px TETAP,
disembunyikan di mobile) dikurangi padding `p-4`/`md:p-8` (16px mobile,
32px desktop tiap sisi). Jadi kontennya FLUID, bukan dibatasi lebar
tertentu — tabel lebar diatasi lewat scroll horizontal per-tabel
(`.gc-table-scroll`/`overflow-x:auto`, `min-width:760px`), bukan lewat
pembatasan lebar halaman.

Verifikasi kode: `node -c` lolos, tag HTML template literal seimbang.
Perubahan skema: `pesanan_pembelian.items[].nama_alias` (field STRING
BARU, opsional/kosong kalau tidak lewat alias) — TIDAK ADA migrasi
perlu, dokumen lama otomatis dianggap kosong (fallback `'-'` di tabel).

**STATUS: BELUM DITES Guru di live.**

---

### 25.12 Perbaikan setelah tes live §25.11: Satuan jadi dropdown-cari, Nama Barang tampil warna di tabel, keyboard navigasi DropdownCari

**Laporan Guru** (screenshot List/Nota Order Belanja):
1. "field satuan itu bisa di dropdowncari"
2. "table pada list order dan nota order nama barnag + warna"
3. "fitur dropdowncari, ketika ketik sebagian dan keyboard arahkan
   kebawah harusnya bisa ini bisa gaada (klw panggil dari vue yg sudah
   jadi ga ada yah? atau js/sdk/api/template yg udah ada?)"

**1. Field Satuan → dropdown-cari.** Sebelumnya kotak tampilan statis
(`<div>` abu-abu read-only). Sekarang diganti komponen `<dropdown-cari>`
yang sama dipakai field Suplayer/Nama Barang di sebelahnya — jadi
gayanya SEKARANG konsisten (kotak+border+ikon panah bawah), bukan kotak
polos beda gaya.

**PENTING — perilakunya SENGAJA tetap terkunci, BUKAN bisa pilih
bebas** (`:disabled="true"`, opsi cuma 1 = satuan item yang lagi
dipilih). Alasan: `isi_konversi_pembelian` yang dipakai hitung "Qty
Pakai" adalah angka SNAPSHOT yang dikalibrasi khusus buat 1
`satuan_pembelian` item itu (lihat `buatBarisPesanan()`). Kalau Satuan
dibolehkan diganti bebas ke satuan lain TANPA angka konversinya ikut
disesuaikan, "Qty Pakai" yang kehitung otomatis bisa SALAH tanpa ada
tanda apapun (silent bug) — risikonya lebih besar daripada manfaat
kosmetiknya. **Kalau ternyata maksud Guru itu Satuan-nya BENERAN mau
bisa dipilih beda dari yang di-set di Master** (misal kadang beli dalam
satuan lain dari biasanya), itu perlu didesain dulu cara hitung ulang
Qty Pakai-nya (belum dibuat di sini) — **mohon dikonfirmasi.**

**2. Kolom "Nama Barang" (tabel List/Nota Order Belanja + Nota cetak)
sekarang tampil nama+warna.** Akar masalah ditemukan di
`buatBarisPesanan()`: field `nama` yang disimpan ke tiap baris pesanan
masih `item.nama` POLOS (tanpa warna) — padahal dropdown "Nama Barang"
yang dipakai MEMILIH item itu sudah pakai `formatNamaBahan(item)`
(nama+warna, sejak §25.7/§25.11). Jadi selama ini 2 item dengan `nama`
sama tapi `warna` beda TETAP tidak bisa dibedakan begitu masuk tabel
Daftar Pesanan Pembelian — walau di dropdown pencariannya SUDAH bisa.
Diperbaiki: `nama: formatNamaBahan(item)` (bukan `item.nama` lagi).
Efek sampingnya (bagus): archival `nama_bahan` yang dicatat ke Riwayat
Harga Pembelian & Kartu Stok (baca dari `it.nama` yang sama) sekarang
otomatis ikut tampil warna juga.

Catatan: ini SNAPSHOT nama saat baris ditambahkan (sama seperti field
lain di baris ini — harga, isi_konversi, dst) — TIDAK otomatis berubah
kalau nama/warna item diedit belakangan di Data Bahan & Aksesoris
(beda dengan `namaInternalTampil()` di Alias Pembelian yang baca LIVE).
Konsisten dengan pola snapshot yang sudah dipakai di baris pesanan
lainnya, jadi TIDAK diubah jadi live-lookup.

**3. Navigasi keyboard di `DropdownCari` (`vue-components.js`).**
Jawaban pertanyaan Guru: komponen ini **100% buatan sendiri** (custom,
ditulis manual di `vue-components.js`), **BUKAN** berasal dari
library/SDK/API/template Vue manapun — jadi bukan soal "setting yang
kelupaan dinyalakan" dari sesuatu yang sudah jadi, tapi memang belum
pernah ditulis. Dicek langsung ke kodenya (bukan tebak-tebak): SEBELUM
perbaikan ini, `<input>` di komponen ini TIDAK punya event handler
`@keydown` sama sekali — cuma bisa pilih opsi lewat klik mouse.

Ditambahkan:
- Panah bawah/atas menyorot 1 opsi di daftar (state baru `indexSorot`,
  divisualisasikan warna highlight `--burgundy-light`) — berhenti di
  opsi paling atas/bawah, TIDAK muter balik ke ujung sebaliknya.
- Enter memilih opsi yang lagi disorot (kalau baru buka dropdown &
  belum tekan panah sama sekali, sorotan otomatis mulai dari opsi
  PALING ATAS hasil filter, jadi Enter langsung pilih hasil teratas).
- Escape menutup dropdown tanpa memilih apa-apa.
- Opsi yang disorot ikut di-scroll otomatis ke dalam layar kalau
  posisinya di luar area kelihatan (daftar opsi scrollable,
  `max-height:220px`).
- Ganti huruf pencarian (hasil filter berubah) otomatis reset sorotan
  balik ke opsi teratas yang baru.

**Ditemukan sekaligus (gap terpisah, bukan diminta Guru tapi perlu
diperbaiki supaya perbaikan #3 di atas BENERAN kepakai)**:
`vue-components.js` **tidak pernah punya skema cache-busting `?v=`
sendiri** — beda dari file Vue lain yang di-load lewat
`<script type="module" src="js/xxx.js?v=N">` di `index.html` (nomor
versi dinaikkan tiap ada perubahan supaya browser TIDAK pakai cache
lama). `vue-components.js` TIDAK PERNAH di-load lewat tag `<script>`
langsung — cuma diimpor sebagai ES module biasa
(`import {...} from './vue-components.js'`) dari 5 file lain
(`vue-bahan-aksesoris.js`, `vue-kartu-stok.js`,
`vue-persiapan-masalah.js`, `vue-rak-penyimpanan.js`,
`vue-stock-pembelian.js`), TANPA parameter versi apapun di URL-nya.
Browser meng-cache ES module berdasarkan URL PERSIS — jadi kalau isi
`vue-components.js` diubah (seperti sekarang) tapi URL importnya tetap
sama persis, ada risiko browser Guru masih pakai versi LAMA dari cache
walau ke-5 file lain sudah di-refresh (perbaikan navigasi keyboard di
atas jadi TIDAK kepakai, padahal filenya sudah benar). Diperbaiki:
semua baris import ditambah `?v=1`
(`from './vue-components.js?v=1'`) — pertama kalinya skema versi ini
dipakai buat file ini, ke depan tiap `vue-components.js` diubah lagi,
`?v=1` di SEMUA 5 baris import ini WAJIB dinaikkan bareng (mis. jadi
`?v=2`), TIDAK CUKUP cuma naikkan versi 1 file importer saja.

**File yang diubah**:
- `vue-components.js` — `DropdownCari`: state baru `indexSorot`+`listEl`,
  fungsi `sorotBerikutnya`/`sorotSebelumnya`/`pilihYangDisorot`/
  `tutupTanpaPilih`, handler `@keydown` di `<input>`, highlight di opsi.
- `vue-stock-pembelian.js` — `buatBarisPesanan()`: `nama: formatNamaBahan(item)`
  (bukan `item.nama`); template Satuan (List & Nota) ganti jadi
  `<dropdown-cari :model-value="satuanEntryTampil" :opsi="[satuanEntryTampil]" disabled />`;
  baris `import ... from './vue-components.js?v=1'`.
- `vue-bahan-aksesoris.js`, `vue-kartu-stok.js`,
  `vue-persiapan-masalah.js`, `vue-rak-penyimpanan.js` — baris import
  `./vue-components.js?v=1` (cuma bump versi import, TIDAK ADA
  perubahan logic lain di 4 file ini).
- `index.html` — bump versi: `vue-bahan-aksesoris.js?v=14`,
  `vue-rak-penyimpanan.js?v=2`, `vue-persiapan-masalah.js?v=2`,
  `vue-stock-pembelian.js?v=12`, `vue-kartu-stok.js?v=4` (supaya
  ke-5 file importer di-refresh browser, otomatis ikut tarik
  `vue-components.js?v=1` yang baru juga).

**Perubahan skema**: TIDAK ADA — field `nama` di
`pesanan_pembelian.items[]` isinya sekarang beda format (nama+warna,
bukan nama polos), tapi nama field & tipe datanya (string) tidak
berubah, jadi tidak perlu migrasi. Dokumen lama (dibuat sebelum
perbaikan ini) tetap tampil nama polos apa adanya (data lama TIDAK
ikut berubah retroaktif — cuma baris BARU yang dibuat setelah ini yang
kena format baru).

Verifikasi: `node -c` lolos semua 6 file yang disentuh, tag HTML
template literal `vue-stock-pembelian.js` seimbang (1 "imbalance" div
yang sempat muncul cuma false-positive dari kata "`<div>`" yang disebut
di komentar kode, bukan markup asli).

**STATUS: BELUM DITES Guru di live. Poin #1 (Satuan dropdown-cari
terkunci) BUTUH KONFIRMASI Guru — lihat catatan di atas — DISUPERSEDE
§25.13 di bawah.**

---

### 25.13 Satuan Beli SUNGGUHAN bisa dipilih (ikut Konversi Banyak Tingkat) + jawaban riset library Vue

**Konfirmasi Guru atas §25.12**: "kadang beli dus, kadang beli pak,
kadang beli pcs > satuan yg muncul sesuai yg diinput di konversi
banyak tingkat" — jadi memang benar maksudnya field Satuan mau bisa
DIPILIH BEBAS, bukan cuma soal tampilan. Dibuka sekarang, dengan
konversi yang dihitung BENAR (bukan asal buka tanpa perbaikan
hitungan — itu yang bikin §25.12 sengaja dikunci dulu sambil tanya).

**Cara kerja sekarang**: Bahan/Aksesoris yang diisi lewat popup "Bantu
Hitung Konversi Berjenjang" (`vue-bahan-aksesoris.js`) sudah LAMA
menyimpan SELURUH rantai tingkatnya di field `konversi_bertingkat`
(array `{dari, jumlah, ke, harga}` per tingkat, mis. tingkat 1 =
`{dari:"DUS", jumlah:10, ke:"PACK"}`, tingkat 2 = `{dari:"PACK",
jumlah:12, ke:"PCS"}`) — cuma field ini SELAMA INI tidak pernah dibaca
lagi di Order Belanja (yang dipakai cuma `isi_konversi_pembelian`,
angka gabungan dari tingkat PALING ATAS). Sekarang dibaca:

- **Opsi Satuan Beli** = tiap `dari` di rantai (DUS, PACK) + satuan
  akhir/`satuan_pemakaian` (PCS, kalau mau beli langsung di satuan
  dasar tanpa lewat kemasan). Item LAMA yang belum pernah diisi lewat
  popup berjenjang (`konversi_bertingkat` kosong/tidak ada) TETAP cuma
  dapat 1 opsi (`satuan_pembelian`-nya), sama seperti perilaku §25.12 —
  TIDAK ADA yang rusak buat data lama.
- **Faktor konversi ke Qty Pakai** dihitung BEDA tergantung satuan yang
  dipilih: kalau pilih DUS (tingkat teratas), faktornya = perkalian
  SEMUA `jumlah` di rantai (sama seperti dulu). Kalau pilih PACK
  (tingkat tengah), faktornya = perkalian `jumlah` MULAI dari tingkat
  PACK saja (bukan dari DUS) — jadi Qty Pakai tetap akurat. Kalau pilih
  PCS (satuan dasar), faktornya = 1 (tidak ada konversi, sudah di
  satuan pemakaian).
- Default Satuan tetap otomatis ke-isi `satuan_pembelian` (tingkat
  teratas) tiap kali item dipilih di dropdown Nama Barang — TAPI
  sekarang boleh ditimpa manual lewat dropdown-nya sendiri sebelum
  klik Tambah.

**Belum disentuh — perlu diwaspadai Guru saat pakai**: field "Harga
Aktual" (Nota) masih prefill dari `harga_pembelian` Master, yang itu
HARGA DI TINGKAT TERATAS (mis. harga per DUS). Kalau Satuan Beli
ditimpa ke PACK/PCS, harga prefill-nya TIDAK otomatis dihitung ulang
ke "harga per PACK"/"harga per PCS" — admin PERLU koreksi manual angka
Harga Aktual-nya di tabel (medannya memang sudah bisa diedit, sejak
§23.2). Ini SENGAJA belum diotomatisasi karena Guru belum minta &
perlu keputusan desain terpisah (misal: apa popup Konversi Berjenjang
perlu nyimpan harga PER TINGKAT, bukan cuma tingkat teratas) — kalau
mau dibuatkan, tolong infokan.

**File yang diubah**: `vue-stock-pembelian.js` — fungsi baru
`opsiSatuanBeliUntuk(item)` & `faktorKonversiUntukSatuan(item, satuan)`;
`satuanEntryTampil` (read-only) diganti `satuanEntryManual` (ref,
bisa ditulis lewat dropdown-cari) + `opsiSatuanEntry` (computed opsi)
+ `watch(namaBarangEntry)` (set default); `buatBarisPesanan()` dapat
param ke-5 `satuanBeliPilihan`; `tambahItemManual()` kirim
`satuanEntryManual.value` & validasi wajib diisi; template Satuan
(List & Nota) jadi `<dropdown-cari v-model="satuanEntryManual" :opsi="opsiSatuanEntry" :disabled="opsiSatuanEntry.length === 0" />`.
`index.html` — bump `vue-stock-pembelian.js?v=13`.

**Perubahan skema**: TIDAK ADA field baru — `items[].satuan_bahan`
(sudah ada sejak awal) sekarang isinya BISA beda dari
`bahan_aksesoris.satuan_pembelian` (kalau admin pilih tingkat lain),
sebelumnya SELALU sama. `items[].isi_konversi` juga sekarang bisa beda
dari `bahan_aksesoris.isi_konversi_pembelian` (kalau bukan tingkat
teratas yang dipilih) — dokumentasi lengkap ada di PETA-DATABASE.md.

Verifikasi: `node -c` lolos, tag HTML template literal seimbang (sama
1 false-positif komentar seperti sebelumnya).

**Jawaban pertanyaan Guru soal referensi library/SDK Vue untuk
DropdownCari** (riset web, bukan dari ingatan — library CDN/ESM
berubah dari waktu ke waktu): app ini pakai Vue 3 TANPA build step
(`import` langsung dari CDN, persis seperti cara `vue.esm-browser.js`
dimuat sekarang) — jadi library kandidat HARUS bisa jalan tanpa
bundler/npm.

| Library | Vue 3? | Bisa CDN tanpa build step? | Kelebihan dibanding DropdownCari sekarang |
|---|---|---|---|
| **vue-select** (sagalbot) | Ya, tapi baru versi `beta` (`4.0.0-beta.6`) — versi stabil masih Vue 2 | Ya — ada build ESM & UMD di unpkg/jsdelivr (`vue-select@beta/dist/vue-select.es.js`), tapi versi ESM-nya perlu `<script type="importmap">` supaya `import "vue"` di dalamnya nyambung ke Vue yang sudah dimuat app ini | Mode "taggable" (bisa isi teks bebas), status loading bawaan, filter bisa dikustom |
| **PrimeVue AutoComplete** | Ya (Vue-3-only) | **Ya, paling gampang** — ada build UMD resmi (`umd/primevue.min.js`, dokumentasinya di primevue.dev/cdn), tinggal `<script>` biasa setelah Vue global, TANPA importmap | Bagian dari 1 sistem komponen lengkap + tema, virtual scroll buat daftar sangat panjang |
| **@vueform/multiselect** | Ya (Vue-3-only) | **Ya, paling gampang** — ada build global murni (`multiselect.global.js`), langsung `<script src=...>`, tanpa importmap sama sekali | Multi-pilih, tagging, & pencarian ASYNC ke server bawaan |
| **Element Plus** (`el-select filterable`) / **Naive UI** (`n-select filterable`) | Ya (keduanya Vue-3-only) | Ya — sama-sama ada build UMD (`element-plus/dist/index.full.js`, `naive-ui/dist/index.js`), jalan sebagai `<script>` biasa + file CSS-nya | Sistem desain lengkap (banyak komponen lain sekalian), Element Plus punya varian `el-select-v2` khusus virtual-scroll buat opsi SANGAT banyak |
| **Headless UI Vue** (`@headlessui/vue`) | Ya | Lebih ribet — WAJIB `importmap` (bare-import `"vue"` DAN `"@tanstack/vue-virtual"`), tidak ada build UMD/global | ARIA/keyboard-accessibility combobox penuh sesuai standar, virtual-scroll bawaan — tapi TIDAK ada styling sama sekali (semua CSS/markup ditulis sendiri) |

**Ringkasan rekomendasi** (kalau suatu saat mau ganti/nambah referensi
desain, BUKAN keputusan sekarang, cuma bahan pertimbangan): yang PALING
gampang dicoba tanpa ubah cara app ini load script (`@vueform/multiselect`
atau PrimeVue AutoComplete, keduanya punya build UMD/global siap
`<script>` langsung) — vue-select butuh sedikit setup tambahan
(importmap), Element Plus/Naive UI bagus tapi berat (bawa 1 sistem
desain besar sekaligus, style-nya sendiri beda dari `gechoo-design.css`
yang sudah dipakai app ini). `DropdownCari` custom yang sudah ada
SEKARANG (setelah §25.12 dapat navigasi keyboard) sudah cukup mumpuni
buat kebutuhan sekarang — tidak ada urgensi ganti, ini murni referensi
kalau ke depan butuh fitur lebih (multi-select, async remote search,
dst) yang berat kalau ditulis manual sendiri.

**STATUS: BELUM DITES Guru di live.**

---

### 25.14 Harga Modal & harga per tingkat sekarang ikut Konversi Berjenjang (SUPERSEDE §21.11/§21.13)

**Laporan/permintaan Guru** (menanggapi catatan "belum diotomatisasi"
di §25.13):
> kita tarik data saja dari hitung konversi berjenjang. harga menurut
> satuan awal adalah harga saat pembelian. misal ada 3 jenjang artinya
> ada 3 harga dengan 3 satuan awal, untuk *harga per satuan akhir*
> tetap patokannya pada harga per harga terupdate per satuan
>
> misal data di tingkat berjenjang
> dus 900rb
> pak 100rb
> satuan akhir pcs > 1rb (menurut data satuan awal yg paling mahal)
>
> ternyata ada nota pembelian 1 dus jadi 1,1jt > artinya update data
> jg pada data bahan & aksesoris

**Interpretasi yang dipakai** (dicek konsisten dengan pola yang SUDAH
ADA di kode, `perbaruiHargaMasterDariRiwayat()` — bukan reka-reka
baru): item dengan Konversi Banyak Tingkat (`konversi_bertingkat`,
mis. Dus→Pack→Pcs) punya harga TERSENDIRI per tingkat (Dus 900rb,
Pack 100rb). "Harga per Satuan Akhir" (dipakai sebagai Harga Modal,
basis margin/harga jual) dihitung dengan: tiap tingkat yang harganya
diisi (>0) dihitung dulu "implikasi harga per satuan akhir"-nya
SENDIRI-SENDIRI (harga tingkat itu ÷ faktor konversi dari tingkat itu
SAMPAI akhir rantai — BUKAN dari tingkat paling atas), lalu diambil
yang **PALING MAHAL** di antara semuanya. Prinsip "pilih yang termahal"
ini KONSISTEN dengan yang sudah lebih dulu dipakai
`perbaruiHargaMasterDariRiwayat()` (pilih harga TERMAHAL dari riwayat
pembelian per tanggal, "supaya modal/harga jual tidak ketinggalan pas
harga bahan naik") — sekarang prinsip yang sama diterapkan juga ke
input MANUAL di popup Konversi Berjenjang.

**Perubahan dibuat, 3 bagian:**

**1. Popup "Bantu Hitung Konversi Berjenjang" (Entry & Edit, Data
Bahan & Aksesoris).** Fungsi baru `hitungHargaPerSatuanAkhir(baris)` —
hitung implikasi harga per satuan akhir tiap baris, ambil yang PALING
MAHAL. Dipakai di 2 tempat:
- **Tampilan live popup** ("Harga per {satuan akhir}: ...") — SEBELUMNYA
  cuma baca `baris[0].harga / total`, SEKARANG pakai fungsi ini (baca
  SEMUA baris).
- **`terapkanKonversi()`** (tombol "Terapkan") — `form.harga_pembelian`
  SEBELUMNYA SELALU `= baris[0].harga` polos (SUPERSEDE keputusan
  §21.11/§21.13, yang bilang "baris lain TIDAK ikut menentukan Harga
  Modal"). SEKARANG `form.harga_pembelian` DITURUNKAN dari harga per
  satuan akhir termahal itu (dikali `isi_konversi_pembelian`, supaya
  labelnya — "harga per Satuan Pembelian" — tetap konsisten artinya),
  jadi angkanya BISA lebih tinggi dari yang diketik di baris pertama
  kalau tingkat lain implikasinya lebih mahal. Field ini di form utama
  cuma tampil sebagai RINGKASAN read-only begitu Konversi Berjenjang
  dipakai (bukan input yang diketik ulang), jadi tidak ada resiko
  "angka yang saya ketik kok berubah sendiri" — yang berubah cuma
  ringkasannya.
- `isi_konversi_pembelian` (faktor gabungan tingkat teratas→akhir)
  **TIDAK berubah rumusnya**, tetap dari `totalKonversiBerjenjang`.

**2. Order Belanja — prefill "Harga Aktual" ikut tingkat yang dipilih.**
Fungsi baru `hargaUntukSatuan(item, satuanDipilih)`
(`vue-stock-pembelian.js`): cari baris `konversi_bertingkat` yang
`dari`-nya cocok Satuan Beli yang dipilih (§25.13), pakai harga baris
itu. Kalau yang dipilih itu satuan akhir/dasar (beli langsung di
satuan pemakaian, tidak lewat kemasan), pakai `harga_modal` (Harga
Modal, sudah termasuk logic §25.14 poin 1 di atas). Item lama/1-tingkat
(tanpa `konversi_bertingkat`) TETAP pakai `harga_pembelian` seperti
biasa — **TIDAK ADA yang berubah buat item begini.** Field "Harga
Aktual" TETAP bisa diedit admin di tabel Nota seperti sebelumnya —
ini cuma DEFAULT-nya yang lebih akurat sekarang.

**3. Nota di-final-kan dengan harga BEDA dari Master → update per
tingkat, bukan cuma flat.** `perbaruiHargaMasterDariRiwayat()`
(dipanggil tiap kali 1 item di Nota di-final-kan) direvisi:
- Item PUNYA `konversi_bertingkat`: tiap TINGKAT dicek sendiri-sendiri
  — cari SEMUA riwayat pembelian yang satuannya PERSIS cocok `dari`
  tingkat itu, ambil tanggal PALING BARU lalu yang harganya (mentah,
  sudah same-satuan) PALING MAHAL di tanggal itu, timpa `harga` baris
  tingkat itu di `konversi_bertingkat` KALAU beda dari yang tersimpan.
  Pembelian langsung di satuan dasar/pemakaian (tanpa lewat kemasan)
  ikut jadi kandidat tambahan (bukan baris tingkat, faktor=1). Setelah
  semua tingkat ter-update, `harga_pembelian`/`harga_modal` dihitung
  ULANG dari tingkat-tingkat yang sudah baru itu, pakai rumus SAMA
  seperti poin 1 (`hitungHargaPerSatuanAkhir`, disalin identik di
  `vue-stock-pembelian.js` — BUKAN diimpor silang dari
  `vue-bahan-aksesoris.js`, konvensi file ini demi 2 file tetap bisa
  berdiri sendiri-sendiri, sama seperti `ambilDaftarBahanAksesorisLengkap()`).
  **Kalau di masa depan rumus `hitungHargaPerSatuanAkhir` diubah lagi,
  WAJIB diubah bareng di KEDUA file, tidak cukup 1 saja.**
- Item LAMA/1-tingkat (TANPA `konversi_bertingkat`): PERSIS perilaku
  sebelum §25.14, TIDAK ADA yang berubah (normalisasi ke satuan
  pemakaian dulu, baru dikonversi balik).

**Contoh konkret sesuai skenario Guru**: Master Bahan X punya
`konversi_bertingkat` = [{dari:"DUS", harga:900000, jumlah:12,
ke:"PACK"}, {dari:"PACK", harga:100000, jumlah:12, ke:"PCS"}]. Nota
Order Belanja beli item ini dengan Satuan Beli **DUS**, tapi harga
aktual di nota ternyata **Rp 1.100.000** (bukan 900rb seperti di
Master) — begitu Nota di-final-kan: baris tingkat DUS di
`konversi_bertingkat` ter-update jadi `harga: 1100000` (baris PACK
tidak ikut berubah, tidak ada pembelian baru di satuan itu), lalu
`harga_pembelian`/`harga_modal` Master dihitung ulang dari implikasi
TERMAHAL antara DUS (1,1jt yang baru) vs PACK (100rb, tetap) —
otomatis DUS yang menang karena implikasinya lebih mahal per unit.

**File yang diubah**: `vue-bahan-aksesoris.js` — fungsi baru
`hitungHargaPerSatuanAkhir(baris)` (module-level); `terapkanKonversi()`
& `PopupKonversiBerjenjang.hargaPerSatuanAkhirFormatted` pakai fungsi
ini. `vue-stock-pembelian.js` — `hitungHargaPerSatuanAkhir(baris)`
(disalin identik) & `hargaUntukSatuan(item, satuan)` (fungsi baru);
`buatBarisPesanan()` — `harga: hargaUntukSatuan(...)` (bukan selalu
`item.harga_pembelian` lagi); `perbaruiHargaMasterDariRiwayat()`
direvisi total (lihat poin 3 di atas). `index.html` — bump
`vue-bahan-aksesoris.js?v=15`, `vue-stock-pembelian.js?v=14`.

**Perubahan skema**: TIDAK ADA field baru. `master_bahan_aksesoris.konversi_bertingkat[].harga`
sekarang BISA berubah otomatis (sebelumnya beku sejak diisi manual di
popup) — dokumentasi lengkap di PETA-DATABASE.md. `harga_pembelian`/
`harga_modal`/`harga_pemakaian` juga BISA berubah lebih sering/lebih
besar dari sebelumnya (mengikuti tingkat termahal, bukan cuma tingkat
teratas) — SEMUA field & nama field TETAP SAMA, cuma NILAI &
rumusnya yang berubah.

**Yang PERLU diwaspadai Guru**: karena Harga Modal sekarang bisa naik
mengikuti tingkat mana saja yang termahal (bukan cuma tingkat
teratas/Satuan Pembelian), item yang SUDAH ada `konversi_bertingkat`
&harga per tingkatnya SUDAH lama tidak update (sejak sebelum §25.14)
akan otomatis "terkoreksi" ke atas begitu ada Nota baru dengan harga
berbeda — ini SESUAI arah yang diminta ("konservatif, jangan
ketinggalan"), tapi kalau ada kejutan harga naik tiba-tiba di suatu
item, ini kemungkinan besar sebabnya (bisa dicek riwayat perubahan
lewat `harga_diupdate_dari_riwayat_pada` di dokumen Bahan/Aksesoris-nya).

Verifikasi: `node -c` lolos kedua file, tag HTML template literal
`vue-stock-pembelian.js` seimbang (false-positif komentar yang sama
seperti sebelumnya).

**Diskusi & konfirmasi Guru (27 Agt 2026, SETELAH kode di atas
dikirim, SEBELUM dites live)** — Guru minta diuraikan dulu 2 hal
sebelum lanjut, jawabannya:

1. **"Harga PACK ikut terkoreksi kalau DUS berubah, atau tetap
   independen?"** — diuraikan dengan angka contoh Guru sendiri (DUS
   900rb→1,1jt di 1 Nota baru, PACK 100rb tidak ada pembelian baru):
   dengan desain YANG SUDAH DIBUAT di atas, baris PACK **TIDAK ikut
   terkoreksi** (tetap 100rb, karena tidak ada bukti transaksi nyata di
   satuan PACK), TAPI satuan akhir/Harga Modal **TETAP ikut
   terkoreksi** (naik dari 1.000/pcs jadi 1.100/pcs, karena implikasi
   dari DUS yang baru sekarang lebih mahal dari implikasi PACK yang
   lama). **Guru KONFIRMASI ini yang diinginkan** ("konsisten dengan
   filosofi yang sudah ada di kode — isi harga PERSIS seperti di nota,
   bukan estimasi/turunan") — jadi kode YANG SUDAH DIKIRIM di atas
   **TIDAK PERLU DIUBAH**, sudah sesuai.
2. **"`getDoc()` ulang ke Data Bahan & Aksesoris pas finalize,
   dipertahankan atau pakai data di memori saja?"** — Guru KONFIRMASI
   **dipertahankan** (lebih aman dari race condition antar-sesi,
   walau sedikit lebih banyak baca Firestore). Ini JUGA sudah PERSIS
   perilaku kode yang sudah dikirim (`perbaruiHargaMasterDariRiwayat()`
   memang masih `getDoc()` ulang, tidak pernah diubah) — **TIDAK PERLU
   DIUBAH.**

Soal pertanyaan Guru satu lagi ("List/Nota Order Belanja supaya irit
baca Firestore, cuma akses Data Bahan & Aksesoris, tidak perlu baca ke
Riwayat Pembelian — apakah hemat juga?") — dicek langsung ke
`muatSemua()`: layar List/Nota Order Belanja (dibuka berkali-kali
sepanjang hari) **memang SUDAH cuma baca** `master_bahan_aksesoris`,
`master_suplayer`, `persiapan_masalah`, `pesanan_pembelian` (draft),
`alias_pembelian` — **TIDAK PERNAH baca `riwayat_harga_pembelian`**
di layar ini. Baca ke `riwayat_harga_pembelian` HANYA terjadi 1 kali
per item unik, PAS Nota di-final-kan (bukan tiap buka layar) — perlu,
karena logika "termahal di tanggal terbaru" butuh lihat riwayat (bisa
ada 2 Nota beda, beli satuan sama, tanggal sama). **Kesimpulan: tidak
ada perubahan kode yang diperlukan di sini juga** — arsitektur yang
sudah ada dari awal (24 Agt 2026, fitur Riwayat Harga Pembelian) SUDAH
memenuhi prinsip ini.

**KESIMPULAN DISKUSI: kode §25.14 yang sudah dikirim TIDAK PERLU
DIUBAH sama sekali — kedua pertanyaan desain Guru terjawab "sudah
begitu perilakunya", cuma perlu dikonfirmasi eksplisit (sudah,
sekarang). Lanjut ke tahap TES LIVE.**

**STATUS: BELUM DITES Guru di live — terutama skenario "beli di tingkat
BUKAN teratas, lalu harganya beda dari Master" perlu dicoba langsung.**


## 26. Menu baru besar: Config, Cetak Label, Order SPK, Scan (27 Agt 2026)

### 26.0 Permintaan awal & diskusi sebelum koding

Permintaan awal Guru (verbatim, dipersingkat): menu baru "Config" (parent
Zevanic House) isinya Jenis Bahan, Jenis Aksesoris, Data Satuan, Data
Warna, Data Ukuran (dipindah dari gear Entry Bahan & Aksesoris) + Data
Suplayer (dipindah dari gear Stock & Pembelian, tapi shortcut cepat tetap
ada di form-form yang butuh); Data Rak Penyimpanan di gear dihapus (sudah
ada menu sendiri); tambah tab "Cetak Label" di Stock & Pembelian; tambah
sub-menu "Scan" (Scan Opname, Scan Persiapan) — update stok/pemakaian
HANYA lewat scan barcode di mobile untuk non-Owner, desktop Owner tetap
CRUD bebas.

Karena permintaan ini besar & beberapa bagian ambigu (format tampilan
Config, nasib gear lama, skema "Cetak Label", efek "Scan Opname" ke qty
stok, dan — paling krusial — "Scan Persiapan" minta input "No SPK" padahal
modul SPK **sama sekali belum ada** di sistem ini, dicek ulang lewat Grep
ke seluruh `docs/` dan semua `vue-*.js`, cuma ada field bebas
"Keterangan" di Kartu Stok yang KADANG diisi teks "buat SPK #123"), sesuai
mandat proyek ("jangan bikin tebak2") diuraikan dulu ke Guru SEBELUM
koding — bukan cuma 1 putaran, tapi beberapa putaran tanya-jawab sampai
semua keputusan berikut settle:

1. **Data Rak Penyimpanan (gear)** — DIHAPUS TOTAL (bukan dipindah ke
   Config), karena sudah ada menu "Rak Penyimpanan" sendiri yang lebih
   lengkap (§25).
2. **Prefix ID Bahan/Aksesoris & Prefix No. Pembelian** — TETAP di gear
   masing-masing (bukan data referensi yang dicari-cari, sifatnya counter
   teknis internal).
3. **Shortcut Suplayer** — tombol "+" nempel di sebelah dropdown-cari
   Suplayer (Alias Pembelian, List/Nota Order Belanja), buka popup MINI
   di halaman yang sama (2 field: Nama + Kontak/Alamat), simpan langsung
   ke `master_suplayer` + auto-pilih di dropdown, TANPA pindah halaman.
4. **Cetak Label** — dropdown cari nama Bahan/Aksesoris → checkbox daftar
   lot (aktif+nonaktif, supaya bisa cetak ulang label roll yang hilang
   fisik walau datanya sudah "habis") **HANYA aktif untuk item
   `pakai_lot_tracking`** — untuk item biasa (bukan qty roll), checkbox
   ini DISABLE (Guru eksplisit: "kalau yg tidak qty roll maka dropdown
   cari checkbox jangan aktif"). Tabel log cetak (tanggal, nama barang,
   dicetak oleh) — Guru KONFIRMASI oke pakai koleksi Firestore baru.
5. **Scan Opname** — per-ROLL untuk item ber-lot (tiap `kode_lot` dihitung
   ulang sendiri-sendiri, bukan 1 angka gabungan per bahan). Efeknya ke
   qty stok: **Opsi B, tercatat sebagai pergerakan "Penyesuaian"**
   (bukan override diam-diam) — supaya auditable & konsisten dengan pola
   pergerakan Kartu Stok yang sudah ada (Guru pilih ini setelah diuraikan
   2 opsi).
6. **Barcode yang discan** — `kode_lot` (infra QR baca `jsQR` yang SUDAH
   ADA, dipakai ulang) untuk item ber-lot; untuk item BUKAN lot, Guru
   eksplisit tetap harus bisa discan juga — artinya menu Cetak Label untuk
   item non-lot HARUS generate QR BARU berisi `id_tampil` (barang jenis
   ini SEBELUMNYA tidak punya kode/QR sama sekali). Dicatat sebagai
   prasyarat teknis buat tahap Cetak Label & Scan nanti.
7. **Gating "mobile-only untuk non-Owner"** — nyambung ke sistem
   `hak_akses`/`config_akses` yang SUDAH ADA (tingkat "owner" sudah
   terdaftar di situ), BUKAN bikin mekanisme permission baru.
8. **"No SPK"** — Guru konfirmasi **Opsi B** (bukan teks bebas): dibuatkan
   master data SPK minimal — field No. SPK (unik), Nama Produk/Keterangan,
   Qty Target, Tanggal, Status (Aktif/Selesai). Guru infokan SPK ini
   SUDAH JALAN nyata di lapangan tapi masih via spreadsheet, rencana
   migrasi bertahap ke sistem ini. **Nama menu di-rename Guru jadi
   "Order SPK"**, DAN posisinya BUKAN di dalam Config (usulan awal Claude)
   — Guru minta **sub-menu SENDIRI**, sejajar Config/Data Bahan &
   Aksesoris/dst, langsung di bawah parent Zevanic House.
9. **Catat Pemakaian (Kartu Stok)** — Scan Persiapan MENGGANTIKAN cuma
   AKSI catat pemakaian barunya (form qty+keterangan); Ringkasan & Detail
   keluar-masuk Kartu Stok Guru eksplisit **TIDAK dihapus**, tetap ada
   seperti sekarang buat lihat data.

Struktur menu final yang disepakati (Zevanic House jadi 6 sub-menu, urutan
sesuai permintaan Guru):

1. **Config** (baru) — 6 tab child, format entry+searchbox+table.
2. Data Bahan & Aksesoris (tetap, gear tinggal Prefix ID).
3. Persiapan Masalah (tidak disentuh sama sekali).
4. Stock & Pembelian (tetap, + tab baru "Cetak Label"; gear tinggal
   Prefix No. Pembelian; shortcut "+" Suplayer di form-form terkait).
5. **Order SPK** (baru) — format entry+searchbox+table.
6. **Scan** (baru) — 2 tab: Scan Opname, Scan Persiapan.

Karena cakupannya besar, dikerjakan **bertahap** (disepakati Guru, sesuai
kebiasaan proyek ini) — bukan sekali kirim semua:

1. Config + shortcut Suplayer — **DIKERJAKAN, lihat §26.1 di bawah.**
2. Order SPK — **DIKERJAKAN, lihat §26.2 di bawah.**
3. Cetak Label (termasuk QR baru buat item non-lot) — **DIKERJAKAN,
   lihat §26.3 di bawah.**
4. Scan Opname — **DIKERJAKAN, lihat §26.4 di bawah.**
5. Scan Persiapan (bergantung Order SPK) — **DIKERJAKAN, lihat §26.5 di
   bawah — TAHAP TERAKHIR, rencana besar §26 SELESAI dikerjakan semua.**

### 26.1 Tahap 1 — Config (SELESAI dikerjakan, BELUM DITES Guru di live)

**File BARU**: `js/vue-config.js` — mount 6 app kecil (lazy-mount, pola
sama seperti child-tab lain di app ini), masing-masing cuma bungkus 1
panggilan `MasterDataCategory` (Jenis Bahan, Jenis Aksesoris) atau
`MasterDataTabelManager` (Data Satuan, Data Warna, Data Ukuran, Data
Suplayer) dengan prop BARU `tampil-tabel="true"`. TIDAK mengimpor silang
`MasterSuplayerManager` dari `vue-stock-pembelian.js` (sudah dihapus di
sana) — konsisten pola "disalin, bukan diimpor silang" proyek ini, Config
panggil `MasterDataTabelManager` langsung dengan props yang sama persis
(field3 Kontak/Alamat).

**`js/vue-components.js` (bump internal, dipakai import `?v=2` sekarang)**
— `MasterDataCategory` & `MasterDataTabelManager` ditambah prop BARU
`tampilTabel` (Boolean, default `false`). Kalau `true`, render template
BEDA: searchbox SELALU tampil (bukan cuma kalau item>5) + `<table
class="gc-table">` (kolom No/Nama/[field3 kalau ada]/Keterangan/Aksi)
menggantikan tampilan tag/chip lama. Logic tambah/hapus/cari (fungsi
`tambah()`/`hapus()`/computed filter) **TIDAK diduplikasi** — 1 sumber
sama dipakai kedua mode, cuma templatenya beda (v-if/v-else di root).
Default `false` berarti **SEMUA pemakaian lama (Config Karyawan, Config
Absensi, dst) TIDAK berubah SAMA SEKALI** — cuma menu Config yang pakai
mode tabel.

**`js/vue-bahan-aksesoris.js`** — panel `PengaturanBahanAksesoris` (gear)
DIRAMPINGKAN, SEKARANG cuma form Prefix ID. Dihapus dari situ: 2x
`<master-data-category>` (Jenis Bahan/Aksesoris), 3x
`<master-data-tabel-manager>` (Satuan/Warna/Ukuran), dan 3x
`<master-data-category>` (Kode/Baris/Kolom Rak — **DIHAPUS TOTAL**, bukan
dipindah). Import `MasterDataCategory`/`MasterDataTabelManager` ikut
dihapus (sudah tidak dipakai file ini sama sekali). **Field `rak_id`/
`rak_label`/dropdown "Pilih Rak" di FORM Bahan/Aksesoris (beda dari
master-data Kode/Baris/Kolom Rak yang dihapus di atas) TIDAK disentuh
sama sekali** — itu fitur terpisah (§25) yang nunjuk ke
`master_rak_penyimpanan`, tetap jalan seperti biasa.

**`js/vue-stock-pembelian.js`** — komponen `MasterSuplayerManager`
DIHAPUS total (sudah tidak dipakai). Panel `PengaturanStockPembelian`
(gear) DIRAMPINGKAN, SEKARANG cuma form Prefix No. Pembelian. Komponen
BARU `PopupTambahSuplayerCepat` (2 field: Nama + Kontak/Alamat, simpan
langsung `addDoc` ke `master_suplayer`, emit `tersimpan` bawa nama baru) —
dipasang di 2 tempat: `AliasPembelianManager` (1 titik Suplayer) dan
`OrderBelanjaScreen` (dipakai BARENG List & Nota Order Belanja — 2 titik
Suplayer: baris header khusus Nota, baris entry khusus List). Handler
`onSuplayerBaruTersimpan(nama)` di tiap tempat: tutup popup, `await
ambilDaftarSuplayer()` ulang (refresh daftar), auto-isi field Suplayer
form dengan nama baru.

**`js/vue-config-akses.js`** — `DAFTAR_MENU` tambah entry baru
`{ id: 'config_master_data', label: 'Config', kategori: 'Zevanic House' }`
— SATU menu-id ini dipakai ke-6 tab Config sekaligus (pola sama seperti
`config_karyawan` dipakai bareng banyak `MasterDataCategory` di Config
Karyawan). Entry lama `master_suplayer` (dulu label "Master Suplayer
(lewat Pengaturan)") DIBIARKAN (tidak dihapus, biar data izin lama di
Firestore tidak yatim tanpa penjelasan), label diganti "DIPENSIUNKAN,
lihat Config" — sudah tidak dipakai komponen manapun.

**PENTING soal izin akses (Guru WAJIB tahu sebelum tes)** — menu BARU di
sistem ini punya celah yang SUDAH DIDOKUMENTASIKAN sejak lama (§6,
"Nuansa PENTING... jatuh-aman ke arah BOLEH"): kalau profil non-Owner
(PIC/Admin/Superuser/kustom) SUDAH PERNAH disimpan di Config Akses
sebelumnya, field `config_master_data` yang baru ini TIDAK ADA di
dokumen `akses_config` mereka — dan karena belum diatur, `cekIzinMenu()`
JATUH-AMAN ke arah **BOLEH** (bukan Owner-only seperti seharusnya). Ini
BUKAN bug baru dari perubahan ini — ini keterbatasan lama yang sudah
berlaku ke SEMUA menu baru sebelumnya juga. **Solusi**: setelah kode ini
live, Guru (Owner) perlu buka Config Akses → buka tiap profil non-Owner
yang sudah ada → klik "Update profil akses" (simpan ulang, walau Config
dibiarkan tidak dicentang) — supaya tercatat eksplisit "tidak boleh".

**Urutan sidebar**: Config ditaruh PALING ATAS (sesuai urutan yang Guru
sebut), TAPI landing tab default begitu klik parent "Zevanic House" TETAP
Data Bahan & Aksesoris (tidak diubah) — asumsi rendah-risiko, gampang
diubah kalau Guru maunya Config yang jadi default.

**File yang diubah**: `js/vue-config.js` (baru), `js/vue-components.js`
(prop `tampilTabel` baru di 2 komponen — internal, importer bump ke
`?v=2`), `js/vue-bahan-aksesoris.js` (gear dirampingkan, import `?v=16`),
`js/vue-stock-pembelian.js` (gear dirampingkan + shortcut Suplayer baru,
`?v=15`), `js/vue-rak-penyimpanan.js`/`js/vue-persiapan-masalah.js`/
`js/vue-kartu-stok.js` (cuma bump import `vue-components.js?v=2`, TIDAK
ada perubahan logic — `?v=3`/`?v=3`/`?v=5`), `js/vue-config-akses.js`
(entry menu baru, TIDAK diversi lewat query string di `index.html`),
`js/dashboard.js` (`petaTabIndukPerGrup` + `petaMount` tambah 6 entry
Config, `?v=8`), `index.html` (sidebar button Config, blok 6 tab child +
6 mount point, semua `<script>` versi terkait di-bump).

**TIDAK ADA perubahan skema Firestore** — Config cuma memindahkan UI ke
atas koleksi yang SUDAH ADA (`master_data/jenis_bahan`,
`master_data/jenis_aksesoris`, `master_satuan`, `master_warna`,
`master_ukuran`, `master_suplayer`), tidak ada koleksi baru di tahap ini.

Verifikasi: `node -c` lolos SEMUA file JS yang disentuh; tag HTML
(div/button) `index.html` DAN `vue-stock-pembelian.js` dicek seimbang
lewat skrip Node manual (satu false-positif lama di `vue-stock-
pembelian.js`, `div` beda 1, SUDAH ADA sejak sebelum sesi ini — dicek ke
2 snapshot lampiran lama, bukan hal baru dari perubahan Tahap 1 ini);
semua nama baru (`tampilTambahSuplayer`, `onSuplayerBaruTersimpan`) dicek
ADA di `return {...}` kedua komponen (`AliasPembelianManager` DAN
`OrderBelanjaScreen`) yang menggunakannya di template.

**Rencana tes yang disarankan ke Guru**:
1. Buka Zevanic House → Config (sidebar, paling atas) → cek 6 tab
   muncul (Jenis Bahan, Jenis Aksesoris, Data Satuan, Data Warna, Data
   Ukuran, Data Suplayer), tiap tab formatnya entry+searchbox+table.
   Tambah 1 data contoh di tiap tab, cek muncul di tabel. Coba cari
   (searchbox) barang yang baru ditambah. Hapus 1 data contoh.
2. Buka Entry Bahan & Aksesoris → gear → cek SEKARANG cuma Prefix ID
   (Jenis/Satuan/Warna/Ukuran/Rak sudah tidak ada di situ lagi).
3. Buka Stock & Pembelian (List/Nota/Alias) → gear → cek SEKARANG cuma
   Prefix No. Pembelian (Suplayer sudah tidak ada di situ lagi).
4. Di Alias Pembelian, List Order Belanja, DAN Nota Order Belanja: coba
   tombol "+" di sebelah field Suplayer → isi Nama (+ Kontak opsional) →
   Simpan → cek popup tutup, field Suplayer otomatis terisi nama baru,
   DAN cek nama itu juga muncul di Config > Data Suplayer.
5. (Regresi) Cek menu LAIN yang pakai `MasterDataCategory`/
   `MasterDataTabelManager` (Config Karyawan, Config Absensi, dst) TETAP
   tampil tag/chip seperti biasa, TIDAK ikut berubah jadi tabel.
6. Setelah semua di atas dikonfirmasi jalan: buka Config Akses → buka
   tiap profil non-Owner yang sudah ada → "Update profil akses" (simpan
   ulang) supaya menu Config baru tercatat eksplisit belum boleh diakses
   non-Owner (lihat catatan izin akses di atas).

**STATUS: Tahap 1 (Config) SUDAH DITES Guru di live, JALAN NORMAL (27 Agt
2026).** Lanjut Tahap 4 (Scan Opname), lihat §26.4.

### 26.2 Tahap 2 — Order SPK (SELESAI dikerjakan, BELUM DITES Guru di live)

Menu baru **Zevanic House > Order SPK** — sub-menu LANGSUNG (bukan lewat
Config, sesuai permintaan Guru), format sama seperti menu master data
lain: entry (form) + searchbox + table (bukan chip/tag), TANPA tab child
di dalamnya (pola sama seperti "Persiapan Masalah" — 1 sub-menu = 1
halaman langsung, lihat `pindahSubTab('sub-zevanic-house',
'sub-zevanic-house-orderspk', this)`).

**Field** (sesuai kesepakatan Guru, minimal dulu — SPK sesungguhnya masih
jalan by spreadsheet di perusahaan, ini cuma langkah awal migrasi
bertahap, TIDAK dimaksudkan jadi modul produksi penuh):
- `no_spk` (String) — No. SPK, WAJIB UNIK. Dicek dobel via query
  `where('no_spk', '==', ...)` sebelum simpan (baik tambah baru maupun
  edit — saat edit, dok dirinya sendiri dikecualikan dari pengecekan).
- `nama_produk` (String) — Nama Produk/Keterangan.
- `qty_target` (Number) — harus > 0.
- `tanggal` (String, format `YYYY-MM-DD`) — default terisi tanggal hari
  ini saat form dibuka.
- `status` (String) — `'Aktif'` atau `'Selesai'` (radio button di form,
  badge warna di tabel: Aktif → `.tag.ok`, Selesai → `.tag.neutral`).
- `dibuat_pada`/`dibuat_oleh`, `diedit_pada`/`diedit_oleh` — jejak audit
  standar (pola sama seperti koleksi Zevanic House lain).

**Koleksi Firestore BARU**: `order_spk`. Pagination pakai
`usePaginasiFirestore` (`js/vue-paginasi.js`, composable yang sudah ada —
`perHalaman: 15`, `urutkanField: 'no_spk'`, `cariField: 'no_spk'`, search
box prefix-match native Firestore, bukan full-text).

**Gating izin**: menu-id baru `order_spk`, dicek lewat
`window.cekIzinMenu('order_spk', 'add'/'delete')`, pola SAMA seperti
komponen Zevanic House lain (`!== false` untuk fail-permissive by
design — lihat catatan gap `cekIzinMenu` di §6, berlaku juga di sini:
profil non-Owner lama perlu "Update profil akses" ulang di Config Akses
supaya menu `order_spk` baru tercatat eksplisit belum boleh diakses).

**File yang diubah/ditambah**:
- `js/vue-order-spk.js` (BARU) — komponen `OrderSpkManager` (form +
  searchbox + table + pagination + CRUD), wrapper `AppOrderSpk`, lazy-
  mount `window.pastikanMountOrderSpk()` ke `#vue-order-spk`. TIDAK
  meng-import apapun dari `vue-stock-pembelian.js` atau file peer lain
  (berdiri sendiri, konsisten dengan konvensi "disalin bukan diimpor
  silang").
- `index.html` — sidebar button "Order SPK" (grup Zevanic House, urutan
  ke-6 setelah Stock & Pembelian), 1 content-div `#sub-zevanic-house-
  orderspk` berisi mount point `#vue-order-spk` (diletakkan setelah blok
  `sub-zevanic-house-stock`), script tag baru
  `js/vue-order-spk.js?v=1`, `js/dashboard.js` di-bump ke `?v=9`.
- `js/dashboard.js` — `petaMount` tambah 1 entry:
  `'sub-zevanic-house-orderspk': 'pastikanMountOrderSpk'`. TIDAK perlu
  entry di `petaTabIndukPerGrup` (bukan grup tab child, sama seperti
  Persiapan Masalah).
- `js/vue-config-akses.js` — `DAFTAR_MENU` tambah 1 entry:
  `{ id: 'order_spk', label: 'Order SPK', kategori: 'Zevanic House' }`.
- `firestore.rules` — blok baru untuk koleksi `order_spk` (pola sama:
  `login()` baca, `isAdminLevel()` tulis), ditambahkan sebelum penanda
  `// ===== akhir tambahan Zevanic House =====`.

**⚠️ BLOKIR TES — perlu aksi manual Guru**: koleksi `order_spk` adalah
koleksi Firestore BARU. Blok rules-nya SUDAH ada di file `firestore.rules`
yang dikirim, TAPI **BELUM otomatis aktif** — Guru perlu publish rules
ini manual lewat Firebase Console (Firestore Database > Rules > copy-
paste isi `firestore.rules` terbaru > Publish), PERSIS seperti proses
untuk `master_rak_penyimpanan` dan `lot_bahan_aksesoris` sebelumnya.
Tanpa ini, menu Order SPK akan gagal baca/tulis (permission-denied) di
live meskipun kode sudah jalan.

Verifikasi: `node -c` lolos (`vue-order-spk.js`, `dashboard.js`, `vue-
config-akses.js`); tag HTML (div/button/script) `index.html` seimbang
(134/134, 58/58, 42/42 — naik dari 132/132, 57/57 di Tahap 1, sesuai
1 content-div + 1 mount-div + 1 button + 1 script baru); dua bug kecil
ditemukan & diperbaiki sendiri sebelum kirim: (1) `bolehTambah`/
`bolehHapus` sempat salah tulis (arrow function polos, bukan `computed()`
Vue asli — `computed` juga sempat belum di-import), (2) sempat pakai
class CSS `tag success` yang TIDAK ada di `gechoo-design.css` (yang benar
`tag ok`/`tag neutral`/dst) — dicek ulang lewat grep ke CSS asli sebelum
kirim.

**Rencana tes yang disarankan ke Guru** (SETELAH publish `firestore.rules`
manual di atas):
1. Buka Zevanic House → Order SPK (sidebar, setelah Stock & Pembelian) →
   cek halaman muncul (form + searchbox + table, TANPA tab child).
2. Isi form (No. SPK, Nama Produk/Keterangan, Qty Target, Tanggal,
   Status) → Simpan → cek muncul di tabel.
3. Coba simpan No. SPK yang SAMA lagi → cek muncul peringatan "sudah
   terdaftar" (dicek dobel), TIDAK tersimpan dobel.
4. Coba cari (searchbox, prefix-match No. SPK) data yang baru
   ditambahkan.
5. Klik edit 1 data → ubah field → simpan → cek perubahan tersimpan
   (termasuk saat No. SPK TIDAK diubah, tidak salah kena "sudah
   terdaftar").
6. Hapus 1 data contoh → cek hilang dari tabel.
7. (Regresi) Cek menu Zevanic House lain (Config, Data Bahan & Aksesoris,
   Persiapan Masalah, Stock & Pembelian) TETAP jalan normal, urutan
   sidebar TIDAK berantakan setelah tambahan tombol "Order SPK".
8. Setelah semua di atas dikonfirmasi jalan: buka Config Akses → buka
   tiap profil non-Owner yang sudah ada → "Update profil akses" (simpan
   ulang) supaya menu Order SPK baru tercatat eksplisit belum boleh
   diakses non-Owner.

**STATUS: Tahap 2 (Order SPK) SUDAH DITES Guru di live, JALAN NORMAL (27
Agt 2026)** — firestore.rules sudah dipublish Guru. Lanjut Tahap 4 (Scan
Opname), lihat §26.4.

### 26.3 Tahap 3 — Cetak Label (SELESAI dikerjakan, BELUM DITES Guru di live)

Tab BARU **"Cetak Label"** di Stock & Pembelian (child tab ke-6, setelah
Kartu Stok — `CetakLabelManager`, di dalam `js/vue-stock-pembelian.js`,
BUKAN file terpisah, karena isinya cukup ringkas & butuh fungsi cetak QR
yang sudah ada persis di file yang sama, lihat `cetakLabelLot()`).

**Alur** (sesuai §26.0 poin 4 & 6):
1. Cari 1 item Bahan/Aksesoris lewat dropdown-cari (SEMUA item, lot
   maupun bukan — pakai `ambilDaftarBahanAksesorisLengkap()` yang sudah
   ada).
2. Kalau item itu `pakai_lot_tracking` (qty roll): tampil tabel checkbox
   SEMUA roll/lot milik item itu — **AKTIF *dan* SUDAH HABIS** (beda dari
   `ambilLotAktif()` yang dipakai Kartu Stok, yang cuma ambil status
   aktif — di sini SENGAJA ambil semua status lewat fungsi baru
   `ambilSemuaLotByBahan()`, supaya bisa cetak ULANG label fisik yang
   hilang walau datanya sudah habis di sistem, sesuai permintaan Guru).
   Ada tombol "Pilih Semua"/"Kosongkan" buat kemudahan. Minimal 1 harus
   dicentang sebelum tombol Cetak aktif secara fungsional (divalidasi,
   bukan di-disable).
3. Kalau item itu BUKAN lot: checkbox SAMA SEKALI TIDAK dimunculkan
   (bukan cuma disable — sesuai kalimat eksplisit Guru "dropdown cari
   checkbox jangan aktif") — langsung 1 tombol Cetak, hasilnya 1 label
   QR berisi `id_tampil` item itu. **Ini QR PERTAMA yang pernah dibuat
   untuk item non-lot** — sebelumnya barang jenis ini tidak punya
   kode/QR fisik sama sekali (prasyarat teknis yang sudah disepakati di
   §26.0 poin 6, buat dipakai nanti di Scan Opname/Scan Persiapan, Tahap
   4/5).
4. Cetak pakai POLA PERSIS `cetakLabelLot()` yang sudah ada (window
   print terpisah, QR digambar sinkron di window utama lewat
   `buatQrDataUrl()`, dikirim sebagai `<img>` statis — TIDAK butuh
   internet lagi saat mencetak). `buatQrDataUrl()` **DIPINDAH dari
   closure di dalam `OrderBelanjaScreen` ke level modul** (file yang
   sama) supaya dipakai bareng oleh `cetakLabelLot()` (yang sudah ada)
   DAN `CetakLabelManager` (baru) — TIDAK ADA perubahan logic di
   dalamnya, cuma posisi. Ini BUKAN pelanggaran konvensi "disalin bukan
   diimpor silang" (itu cuma berlaku ANTAR file `.js` berbeda, bukan
   antar komponen DALAM 1 file yang sama).
5. Tiap kali Cetak berhasil, 1 baris log ditulis ke koleksi Firestore
   BARU `log_cetak_label`: `tanggal` (serverTimestamp), `nama_barang`,
   `jumlah_label`, `jenis` (`'roll'`/`'item'`), `dicetak_oleh` (email).
   Ditampilkan sebagai tabel riwayat READ-ONLY paginasi (`usePaginasi
   Firestore`, cari nama barang) di bawah form — pola sama seperti
   Riwayat Harga Pembelian.

**Gating izin**: menu-id baru `stock_cetak_label`, tombol Cetak dicek
lewat `window.cekIzinMenu('stock_cetak_label', 'print')` — **kolom
`print` di Config Akses SUDAH ADA di skema `KOSONG_IZIN` sejak awal,
tapi baru menu INI yang benar-benar memakainya** (sebelumnya tidak ada
komponen manapun yang cek aksi `'print'`). Pola fail-permissive `!==
false` yang SAMA berlaku di sini juga (lihat catatan gap §6) — profil
non-Owner lama perlu "Update profil akses" ulang di Config Akses supaya
kolom `print` menu ini tercatat eksplisit belum boleh dipakai non-Owner.

**Koleksi Firestore BARU**: `log_cetak_label`.

**File yang diubah**:
- `js/vue-stock-pembelian.js` — komponen BARU `CetakLabelManager` +
  helper modul BARU `ambilSemuaLotByBahan()` (TIDAK diekspor, cuma
  dipakai komponen ini) & `formatTanggalLog()`; `buatQrDataUrl()`
  dipindah dari closure `OrderBelanjaScreen` ke level modul (refactor
  posisi doang, logic sama persis); wrapper `AppCetakLabel` + lazy-mount
  `window.pastikanMountCetakLabel()` ke `#vue-cetak-label`. Bump
  `?v=16`.
- `index.html` — tombol tab child BARU "Cetak Label" (ikon print) di
  grup `sub-zh-stock-btn`, setelah Kartu Stok; 1 content-div
  `#sub-zh-stock-cetaklabel` berisi mount point `#vue-cetak-label`
  (setelah blok `sub-zh-stock-kartustok`). `js/dashboard.js` di-bump ke
  `?v=10`.
- `js/dashboard.js` — `petaMount` tambah 1 entry:
  `'sub-zh-stock-cetaklabel': 'pastikanMountCetakLabel'`. TIDAK perlu
  entry baru di `petaTabIndukPerGrup` (grup `sub-zh-stock` sudah
  terdaftar dari sebelumnya).
- `js/vue-config-akses.js` — `DAFTAR_MENU` tambah 1 entry:
  `{ id: 'stock_cetak_label', label: 'Cetak Label', kategori: 'Zevanic
  House' }`.
- `firestore.rules` — blok baru untuk koleksi `log_cetak_label` (pola
  sama: `login()` baca, `isAdminLevel()` tulis).

**⚠️ BLOKIR TES — perlu aksi manual Guru (SEKALIGUS dengan blokir
`order_spk` dari Tahap 2, §26.2)**: koleksi `log_cetak_label` juga BARU.
Blok rules-nya sudah ada di `firestore.rules` yang dikirim, TAPI BELUM
otomatis aktif — publish manual sekali lewat Firebase Console akan
mengaktifkan KEDUA koleksi baru (`order_spk` DAN `log_cetak_label`)
sekaligus, karena satu file `firestore.rules` yang sama berisi keduanya.

Verifikasi: `node -c` lolos (`vue-stock-pembelian.js`, `dashboard.js`,
`vue-config-akses.js`); tag HTML (div/button/script) `index.html`
seimbang (136/136, 59/59, 42/42 — naik dari 134/134, 58/58, 42/42 di
Tahap 2, sesuai 1 content-div + 1 mount-div + 1 button baru, TANPA
script tag baru karena komponennya nempel di file yang sudah ada); div
di dalam blok `CetakLabelManager` sendiri dicek terpisah, seimbang
22/22 (imbalance +1 di `vue-stock-pembelian.js` keseluruhan TETAP ada,
itu false-positif LAMA dari sebelum sesi ini, sudah didokumentasikan di
§26.1 — dicek ulang di sini supaya jelas BUKAN muncul dari perubahan
Tahap 3 ini).

**Rencana tes yang disarankan ke Guru** (SETELAH publish `firestore.rules`
manual):
1. Buka Stock & Pembelian → tab "Cetak Label" (paling kanan, setelah
   Kartu Stok) → cek halaman muncul.
2. Cari & pilih 1 item YANG PAKAI Qty per Roll/Lot → cek tabel checkbox
   roll muncul (termasuk roll yang sudah habis kalau ada) → centang 1+ →
   Cetak → cek window print baru muncul berisi label QR + kode_lot per
   roll yang dicentang.
3. Cari & pilih 1 item YANG BUKAN Qty per Roll/Lot → cek checkbox SAMA
   SEKALI TIDAK muncul, langsung tombol Cetak → cek window print berisi
   1 label QR berisi `id_tampil` item itu.
4. Scan salah satu QR baru (pakai HP/kamera apapun yang bisa baca QR,
   cek isinya PERSIS `id_tampil`/`kode_lot` yang benar, tanpa embel-embel
   lain).
5. Cek tabel "Riwayat Cetak Label" di bawah form — baris baru muncul
   tiap habis cetak (tanggal, nama barang, jumlah label, jenis, akun
   yang cetak) — coba juga searchbox-nya.
6. (Regresi) Cek "Cetak Label Roll" yang SUDAH ADA di Nota Order Belanja
   (dipicu otomatis begitu Nota difinalkan & ada roll baru) MASIH jalan
   normal seperti sebelumnya — ini yang paling penting dicek karena
   fungsi QR-nya (`buatQrDataUrl`) baru saja dipindah posisi.
7. Setelah semua di atas dikonfirmasi jalan: buka Config Akses → update
   profil non-Owner yang sudah ada supaya kolom `print` menu Cetak Label
   tercatat eksplisit (lihat catatan gap di atas).

**STATUS: Tahap 3 (Cetak Label) SUDAH DITES Guru di live, JALAN NORMAL
(27 Agt 2026)** — firestore.rules sudah dipublish Guru. **Tahap 1, 2,
DAN 3 SEMUA sudah dikonfirmasi Guru jalan normal di live** (Guru: "gasss
udah testing guru" / "Semua lancar, lanjut Tahap 4"). Lanjut ke Tahap 4
(Scan Opname), lihat §26.4 di bawah.

### 26.4 Tahap 4 — Scan Opname (SUDAH DITES Guru di live, JALAN NORMAL — 27 Agt 2026)

Sub-menu BARU **Zevanic House > Scan** — child tab pertamanya **"Scan
Opname"** (`ScanOpnameManager`, file BARU `js/vue-scan-opname.js`).
Struktur child-tab-group disiapkan sekarang (`sub-zh-scan`) walau baru 1
tab, supaya "Scan Persiapan" (Tahap 5) tinggal ditambah sebagai tab
kedua tanpa rombak ulang.

**Fungsinya**: hitung ulang stok FISIK vs stok SISTEM ("stock opname")
lewat scan QR — BUKAN form CRUD bebas. Sesuai keputusan Guru di §26.0
poin 5, 6, 7:

1. **Per-ROLL untuk item `pakai_lot_tracking`** — tiap `kode_lot`
   dihitung ulang SENDIRI-SENDIRI (bukan 1 angka gabungan per bahan).
   Scan label fisik roll (QR yang SAMA dicetak lewat menu Cetak Label,
   §26.3) → langsung ketemu 1 roll spesifik, isi Qty Fisik yang
   ditemukan buat roll ITU SAJA.
2. **Per-ITEM untuk item BUKAN lot** — dibandingkan ke `stok_akhir`
   langsung. Scan QR item (BARU ada sejak Cetak Label §26.3 — item
   non-lot sebelumnya TIDAK punya kode/QR sama sekali).
3. **Efek ke stok — Opsi B** (Guru pilih setelah diuraikan 2 opsi):
   SELALU tercatat sebagai pergerakan **"Penyesuaian"** di ledger
   `kartu_stok_bahan_aksesoris` yang SUDAH ADA (BUKAN override diam-diam,
   BUKAN koleksi baru terpisah) — kelihatan juga di Kartu Stok > Detail >
   Riwayat Pergerakan item itu, auditable. Kalau qty fisik = qty sistem
   (tidak ada selisih), TIDAK ADA apapun yang ditulis — cuma pesan "sudah
   sesuai" ke user.
4. **Gating "mobile-only untuk non-Owner"** (§26.0 poin 7 — nyambung ke
   sistem role yang SUDAH ADA, bukan mekanisme baru): `window.
   currentUser.role === 'owner'` (pola SAMA PERSIS dengan Config Akses/
   Hak Akses/Device Kiosk di `js/auth.js` — Superuser TIDAK ikut
   dikecualikan, HANYA Owner). Owner boleh akses dari desktop MAUPUN
   mobile, DAN boleh cari-pilih item langsung lewat dropdown-cari (TIDAK
   wajib scan). Non-Owner: kalau device-nya desktop, halaman diblokir
   TOTAL (pesan "hanya bisa lewat HP") — kalau mobile, TIDAK ADA jalur
   cari/ketik manual sama sekali, SATU-SATUNYA cara masuk adalah tombol
   Scan (kamera). Deteksi mobile pakai `isDesktopBrowser()` (User-Agent
   regex, disalin dari `js/vue-login.js`).

**Alur teknis (scan → resolve → isi qty fisik → simpan)**:
- Scan pakai `jsQR` (CDN), pola SAMA PERSIS `js/vue-kartu-stok.js`
  (disalin ulang, bukan diimpor silang — konvensi proyek).
- Hasil scan dicoba SEBAGAI `kode_lot` DULU lewat fungsi BARU
  `cariLotByKodeSemuaStatus()` (export baru, `vue-stock-pembelian.js`) —
  **SENGAJA TANPA filter status** (beda dari `cariLotByKode()` yang lama,
  yang cuma cari status `'aktif'`) — supaya roll yang di SISTEM sudah
  `"habis"` tapi TERNYATA fisiknya masih ada tetap ketemu & bisa
  dikoreksi lewat opname (justru itu salah satu skenario opname yang
  paling penting ditangkap).
- Kalau bukan `kode_lot`, dicoba sebagai `id_tampil` item lewat
  `cariBahanByIdTampil()` (export yang SUDAH ADA, dipakai bareng
  `vue-kartu-stok.js`). Kalau item hasil resolve ini ternyata
  `pakai_lot_tracking` (kemungkinan salah scan — harusnya scan roll,
  bukan kode item) → ditolak dengan pesan jelas, BUKAN diproses sebagai
  opname level-item (§26.0 poin 5: item lot WAJIB per roll, tidak ada
  jalur "opname gabungan" buat item begini).
- Owner yang pilih item lewat dropdown (bukan scan): kalau item itu
  `pakai_lot_tracking`, muncul tabel roll AKTIF (`ambilLotAktif()`, yang
  SUDAH ADA) buat dipilih SATU sebagai target opname — opname PER ROLL
  tetap berlaku walau lewat jalur cari, bukan cuma scan.
- Setelah target (1 roll ATAU 1 item) ketemu: form "Qty Fisik yang
  Ditemukan" + keterangan opsional → Simpan. Input-nya SENGAJA "qty
  fisik", BUKAN selisihnya — delta dihitung OTOMATIS (fisik − sistem) di
  2 fungsi BARU (lihat di bawah), lebih natural buat karyawan yang lagi
  hitung fisik di lapangan.
- Ada daftar "Riwayat Sesi Ini" — IN-MEMORY SAJA (bukan koleksi baru,
  hilang kalau halaman di-reload), cuma kemudahan lihat hasil
  scan-berturut-turut tanpa pindah halaman. Riwayat PERMANEN tetap di
  `kartu_stok_bahan_aksesoris` (lihat Kartu Stok > Detail).

**2 fungsi BARU** di-`export` dari `js/vue-stock-pembelian.js` (SATU-
SATUNYA jalur yang boleh mengubah `stok_akhir`/`qty_sisa` akibat opname,
konsisten dengan aturan yang sudah didokumentasikan di
`catatPergerakanKartuStok()` — "JANGAN PERNAH update stok_akhir langsung
dari tempat lain"):
- `catatPenyesuaianOpnameItem({ bahanId, namaBahan, satuan, qtyFisik,
  keterangan })` — item BUKAN lot. `runTransaction()`: kalau delta = 0,
  TIDAK menulis apapun. Kalau ada delta: set `stok_akhir` = qtyFisik +
  tulis 1 baris `kartu_stok_bahan_aksesoris` (`sumber: "Penyesuaian (Scan
  Opname)"`, `jenis`/`qty` mengikuti arah & besar delta).
- `catatPenyesuaianOpnameLot({ lotId, qtyFisik, keterangan })` — item
  LOT, PER ROLL. `runTransaction()`: set `qty_sisa` roll itu = qtyFisik
  (+ `status` ikut disesuaikan otomatis), `stok_akhir` bahan induknya
  BERGESER sebesar delta yang SAMA (karena `stok_akhir` = jumlah SEMUA
  roll aktifnya), tulis 1 baris `kartu_stok_bahan_aksesoris` (`sumber:
  "Penyesuaian (Scan Opname per Roll)"`, `rincian_lot` berisi roll yang
  dikoreksi).

**Gating izin**: menu-id baru `scan_opname`, aksi simpan dicek lewat
`window.cekIzinMenu('scan_opname', 'edit')` — INI TERPISAH dari gerbang
mobile-only di atas (gerbang mobile hardcode role, BUKAN lewat Config
Akses — Config Akses cuma kontrol boleh/tidaknya MENYIMPAN, di ATAS
gerbang mobile, bukan pengganti). Pola fail-permissive `!== false` yang
SAMA berlaku (lihat gap §6) — profil non-Owner lama perlu "Update profil
akses" ulang di Config Akses supaya menu ini tercatat eksplisit.

**Koleksi Firestore BARU**: **TIDAK ADA** — Tahap ini CUMA menulis ke
koleksi yang SUDAH ADA (`kartu_stok_bahan_aksesoris`, `master_bahan_
aksesoris.stok_akhir`, `lot_bahan_aksesoris.qty_sisa`/`status`), yang
rules-nya SUDAH aktif dari sebelumnya. **TIDAK ADA blokir publish
firestore.rules di Tahap ini** (beda dari Tahap 2 & 3).

**File yang diubah/ditambah**:
- `js/vue-scan-opname.js` (BARU) — `ScanOpnameManager` (gerbang mobile +
  cari/scan + form qty fisik + riwayat sesi + modal kamera), wrapper
  `AppScanOpname`, lazy-mount `window.pastikanMountScanOpname()` ke
  `#vue-scan-opname`. TIDAK impor `isDesktopBrowser()`/
  `ambilDaftarBahanAksesorisLengkap()`/`formatNamaBahan()` dari file lain
  (disalin, konsisten konvensi proyek) — TAPI IMPOR fungsi baca/tulis
  lot & stok (`ambilLotAktif`, `cariBahanByIdTampil`, `ambilBahanById`,
  `cariLotByKodeSemuaStatus`, `catatPenyesuaianOpnameItem`,
  `catatPenyesuaianOpnameLot`) dari `vue-stock-pembelian.js`, pola SAMA
  seperti `vue-kartu-stok.js` yang sudah duluan impor fungsi serupa.
- `js/vue-stock-pembelian.js` — 3 export BARU: `cariLotByKodeSemuaStatus`,
  `catatPenyesuaianOpnameItem`, `catatPenyesuaianOpnameLot`. Bump `?v=17`.
- `index.html` — sidebar button BARU "Scan" (grup Zevanic House, urutan
  ke-6/terakhir, setelah Order SPK); 1 content-div `#sub-zevanic-house-
  scan` berisi struktur child-tab-group `sub-zh-scan` (1 tab: "Scan
  Opname") + mount point `#vue-scan-opname`. Script tag baru
  `js/vue-scan-opname.js?v=1`. `js/dashboard.js` di-bump ke `?v=11`.
- `js/dashboard.js` — `petaTabIndukPerGrup` tambah `'sub-zh-scan':
  'tab-zevanic-house'`; `petaMount` tambah `'sub-zh-scan-opname':
  'pastikanMountScanOpname'`.
- `js/vue-config-akses.js` — `DAFTAR_MENU` tambah 1 entry: `{ id:
  'scan_opname', label: 'Scan Opname', kategori: 'Zevanic House' }`.
- `firestore.rules` — **TIDAK diubah** (tidak ada koleksi baru).

Verifikasi: `node -c` lolos (`vue-scan-opname.js`, `vue-stock-
pembelian.js`, `dashboard.js`, `vue-config-akses.js`); tag HTML (div/
button/script) `index.html` seimbang (140/140, 61/61, 43/43 — naik dari
136/136, 59/59, 42/42 di Tahap 3, sesuai 1 content-div + 1 child-tab-
group div + 1 child-tab-content div + 1 mount-div + 2 button [sidebar +
child-tab] + 1 script baru); tag HTML dalam `vue-scan-opname.js` sendiri
juga dicek seimbang penuh (div 18/18, button 6/6, table/video/canvas
1-2/1-2, dst); urutan `tx.get()` SEBELUM `tx.write()`/`tx.update()` di 2
fungsi `runTransaction()` baru dicek manual (aturan wajib Firestore SDK
— baca dulu semua, baru tulis).

**Rencana tes yang disarankan ke Guru**:
1. Buka Zevanic House → Scan → Scan Opname (sidebar, paling bawah) →
   cek halaman muncul, tab "Scan Opname" aktif.
2. **Sebagai Owner, di DESKTOP**: cek TIDAK diblokir, dropdown-cari
   item MUNCUL (selain tombol Scan). Cari & pilih 1 item BUKAN lot →
   cek form Qty Fisik langsung muncul. Isi qty BEDA dari stok sistem →
   Simpan → cek pesan penyesuaian muncul, lalu cek di Kartu Stok >
   Detail item itu ada baris baru "Penyesuaian (Scan Opname)" dengan
   qty selisih yang benar.
3. **Sebagai Owner**: cari & pilih 1 item `pakai_lot_tracking` → cek
   tabel roll aktif muncul → pilih 1 roll → isi Qty Fisik BEDA dari
   qty_sisa sistem → Simpan → cek Kartu Stok > Detail ada baris
   "Penyesuaian (Scan Opname per Roll)" dengan `rincian_lot` kode roll
   yang benar.
4. **Sebagai Owner**: coba Simpan dengan Qty Fisik SAMA PERSIS dengan
   sistem → cek TIDAK ADA baris baru ditulis, cuma pesan "sudah sesuai".
5. **Sebagai role BUKAN Owner (pic/admin/superuser/operator), di
   DESKTOP**: cek halaman TERBLOKIR total dengan pesan "hanya bisa lewat
   HP".
6. **Sebagai role BUKAN Owner, di HP**: cek dropdown-cari TIDAK muncul
   sama sekali, cuma tombol Scan. Scan QR sebuah roll (dicetak lewat
   Cetak Label) → cek langsung masuk form Qty Fisik utk roll ITU. Scan
   QR item non-lot → cek langsung masuk form Qty Fisik level item.
7. Coba scan QR sebuah roll yang statusnya SUDAH "habis" di sistem →
   cek TETAP ketemu & bisa dikoreksi (bukan "kode tidak dikenali").
8. Coba scan kode QR ITEM (id_tampil) dari item yang SEBENARNYA
   `pakai_lot_tracking` → cek muncul pesan penolakan yang jelas (harus
   scan roll, bukan kode item).
9. Setelah semua di atas dikonfirmasi jalan: buka Config Akses → update
   profil non-Owner yang sudah ada supaya menu Scan Opname tercatat
   eksplisit.

**STATUS: Tahap 4 (Scan Opname) SUDAH DIKONFIRMASI Guru JALAN NORMAL di
live (27 Agt 2026, Guru: "gasss udah testing guru" → "Semua lancar,
lanjut Tahap 4" [pertanyaan klarifikasi ini sebenarnya ditanyakan
SEBELUM Tahap 4 mulai dikerjakan, mengonfirmasi Tahap 1-3; Tahap 4
sendiri baru dikonfirmasi lewat pertanyaan klarifikasi kedua sebelum
Tahap 5 dimulai — lihat §26.5]).** Tahap 1, 2, 3, 4 SEMUA sudah
dikonfirmasi Guru jalan normal di live. Tahap 5 (Scan Persiapan) —
lihat di bawah.

### 26.5 Tahap 5 — Scan Persiapan (SELESAI dikerjakan, BELUM DITES Guru di live) — TAHAP TERAKHIR

Tab KEDUA di sub-menu **Zevanic House > Scan** (`ScanPersiapanManager`,
file BARU `js/vue-scan-persiapan.js`) — struktur child-tab-group yang
sudah disiapkan sejak Tahap 4 (`sub-zh-scan`) sekarang terisi 2 tab
("Scan Opname" + "Scan Persiapan"). **Ini TAHAP TERAKHIR dari rencana
besar §26** (Config, Cetak Label, Order SPK, Scan) yang diuraikan &
disepakati Guru sebelum koding — semua 5 tahap sekarang SELESAI
dikerjakan (kode), tinggal menunggu konfirmasi tes Guru di live untuk
Tahap 5 ini.

**Fungsinya**: jalur BARU catat **PEMAKAIAN** barang, terhubung ke **No.
SPK** (Order SPK, §26.2) — lewat scan QR, sesuai keputusan Guru §26.0
poin 8 & 9:

1. **Terhubung ke No. SPK** — poin 8: Guru pilih Opsi B (bukan teks
   bebas No SPK) → dibuatkan master data SPK minimal (`order_spk`,
   §26.2). Scan Persiapan sekarang PAKAI data itu: pilih 1 No. SPK
   berstatus **"Aktif"** dulu (dropdown, difilter `where('status',
   '==', 'Aktif')`) sebelum bisa mulai scan barang — semua pemakaian
   yang dicatat lewat 1 sesi otomatis terhubung ke No. SPK yang sama
   sampai user ganti sendiri ("Ganti No. SPK").
2. **MENGGANTIKAN cuma AKSI catat pemakaian barunya** — poin 9 (kalimat
   Guru persis): "Scan Persiapan MENGGANTIKAN cuma AKSI catat pemakaian
   barunya (form qty+keterangan); Ringkasan & Detail keluar-masuk Kartu
   Stok Guru eksplisit TIDAK dihapus, tetap ada seperti sekarang buat
   lihat data." → form "Catat Pemakaian" LAMA di `js/vue-kartu-stok.js`
   (Kartu Stok > Detail) **TIDAK DIHAPUS SAMA SEKALI** — tetap ada apa
   adanya (termasuk alokasi FIFO multi-roll otomatis + 3 opsi keputusan
   "kekurangan lot" yang terhubung ke Persiapan Masalah). Scan Persiapan
   adalah jalur TAMBAHAN, bukan pengganti/hapus yang lama.
3. **Gating "mobile-only untuk non-Owner"** (§26.0 poin 7) — SAMA PERSIS
   pola Scan Opname (§26.4): `window.currentUser.role === 'owner'`
   (Superuser TIDAK ikut dikecualikan). Owner bebas desktop/mobile +
   boleh cari-pilih barang langsung (dropdown-cari, TIDAK wajib scan).
   Non-Owner: diblokir TOTAL kalau desktop; kalau mobile, SATU-SATUNYA
   jalur identifikasi barang adalah scan QR (kamera) — TIDAK ADA jalur
   cari/ketik manual utk BARANG.
4. **Barcode yang discan** — kode_lot (roll) ATAU id_tampil (item
   non-lot), infrastruktur QR/`jsQR` SAMA PERSIS yang sudah ada (Cetak
   Label §26.3 mencetaknya, Scan Opname §26.4 & Catat Pemakaian
   `vue-kartu-stok.js` sudah baca duluan). Scan roll pakai
   `cariLotByKode()` yang **AKTIF SAJA** (BEDA dari Scan Opname yang
   sengaja pakai `cariLotByKodeSemuaStatus()` — utk PEMAKAIAN, roll yang
   sudah "habis" di sistem memang seharusnya tidak bisa dipakai lagi,
   beda tujuan dari opname yang justru perlu mengoreksi roll "habis"
   yang fisiknya masih ada).

**2 KEPUTUSAN SEPIHAK** (belum eksplisit ditanya ke Guru — dicatat biar
gampang dikoreksi kalau meleset, konsisten pola proyek ini mis. §25.11):

a. **No. SPK dipilih lewat DROPDOWN (bukan scan) utk SEMUA role**
   (termasuk non-Owner) — karena TIDAK ADA infrastruktur QR/barcode utk
   No. SPK sama sekali (beda dari barang/roll yang sudah punya label QR
   lewat Cetak Label). Gerbang "wajib scan" §26.0 poin 6 & 9 dibaca
   SPESIFIK utk identifikasi BARANG (yang menentukan APA & BERAPA stok
   berubah) — bukan utk metadata No. SPK yang sekadar label
   pengelompokan/audit, TIDAK mengubah logic stok sama sekali.
b. **Simplifikasi alokasi roll** — Scan Persiapan CUMA proses **1 roll
   per pencatatan** (qty dibatasi maksimal `qty_sisa` roll yang
   dipilih/discan, DITOLAK kalau lebih) — TIDAK mereplikasi tabel
   alokasi FIFO multi-roll + 3 opsi keputusan "kekurangan lot" yang ada
   di form "Catat Pemakaian" desktop. Kalau qty yang dibutuhkan lebih
   besar dari 1 roll, user cukup scan roll BERIKUTNYA lagi (natural
   buat alur fisik "roll ini abis, lanjut roll itu") — form "Catat
   Pemakaian" lama TETAP ada apa adanya utk kasus yang butuh alokasi
   otomatis multi-roll/kekurangan stok.

**Alur teknis (pilih SPK → scan/pilih barang → isi qty → simpan →
ulang)**:
- Scan pakai `jsQR`, pola SAMA PERSIS Scan Opname/`vue-kartu-stok.js`
  (disalin ulang, bukan diimpor silang).
- Hasil scan dicoba SEBAGAI `kode_lot` dulu lewat `cariLotByKode()`
  (export yang SUDAH ADA, AKTIF saja). Kalau bukan/tidak ketemu, dicoba
  sebagai `id_tampil` item lewat `cariBahanByIdTampil()`. Item hasil
  resolve yang ternyata `pakai_lot_tracking` → ditolak dengan pesan
  jelas (harus scan roll, bukan kode item) — pola SAMA PERSIS Scan
  Opname.
- Owner yang pilih barang lewat dropdown (bukan scan): item
  `pakai_lot_tracking` → muncul tabel roll AKTIF (`ambilLotAktif()`)
  buat dipilih SATU.
- Target (1 roll ATAU 1 item) ketemu → form "Qty yang Dipakai/Diambil"
  + keterangan opsional → Catat Pemakaian. Utk roll: qty DIBATASI
  maksimal `qty_sisa` (client-side, ditolak dengan pesan jelas kalau
  lebih — lihat keputusan sepihak b). Utk item biasa: boleh sampai
  minus tapi WAJIB konfirmasi dulu (pola SAMA PERSIS
  `catatPemakaianBiasa()` di `vue-kartu-stok.js`).
- Keterangan yang ditulis ke ledger SELALU diawali `"No SPK: {no_spk} —
  {nama_produk}"` (+ catatan bebas user kalau diisi) — supaya tiap baris
  pergerakan `kartu_stok_bahan_aksesoris` kelihatan jelas SPK mana yang
  memicunya, tanpa perlu field baru.
- Setelah tersimpan, No. SPK yang sama TETAP terpilih (form kembali ke
  langkah pilih/scan barang) — 1 sesi bisa catat banyak barang
  berturut-turut buat SPK yang sama. "Riwayat Sesi Ini" — IN-MEMORY SAJA
  (bukan koleksi baru, sama pola Scan Opname), tampil Jam/Barang/Kode/
  Qty Dipakai. Riwayat PERMANEN tetap di `kartu_stok_bahan_aksesoris`.

**1 perubahan BACKWARD-COMPATIBLE** di `js/vue-stock-pembelian.js`:
`catatPemakaianDariAlokasi()` sekarang terima param BARU OPSIONAL
`sumber` (default TETAP string lama persis `"Pemakaian Manual (Pilih
Roll/Lot)"` kalau tidak dikirim — pemanggil lama `vue-kartu-stok.js`
TIDAK berubah perilakunya sama sekali). Scan Persiapan mengirim
`sumber: "Pemakaian (Scan Persiapan)"` supaya baris ledger-nya kelihatan
beda dari pemakaian manual desktop di kolom "Sumber" Kartu Stok Detail
(bukan cuma lewat baca teks Keterangan). Item BUKAN lot pakai
`catatPergerakanKartuStok()` yang SUDAH ADA (sudah terima `sumber` dari
dulu, tidak perlu diubah).

**TIDAK ADA fungsi baru** di `vue-stock-pembelian.js` selain perubahan
param opsional di atas — Scan Persiapan CUMA memanggil ulang 2 fungsi
yang SUDAH ADA (`catatPergerakanKartuStok`, `catatPemakaianDariAlokasi`)
+ 4 fungsi baca yang SUDAH ADA (`ambilLotAktif`, `cariLotByKode`,
`cariBahanByIdTampil`, `ambilBahanById`) — TIDAK PERNAH tulis
stok_akhir/qty_sisa langsung, aturan "JANGAN PERNAH update stok_akhir
langsung dari tempat lain" TETAP dipegang penuh.

**Gating izin**: menu-id baru `scan_persiapan`, aksi simpan dicek lewat
`window.cekIzinMenu('scan_persiapan', 'edit')` — pola SAMA PERSIS Scan
Opname (menu-id ini CUMA kontrol boleh/tidaknya MENYIMPAN, terpisah dari
gerbang mobile-only yang hardcode role). Pola fail-permissive `!== false`
yang SAMA berlaku (lihat gap §6).

**Koleksi Firestore BARU**: **TIDAK ADA** — CUMA menulis ke koleksi yang
SUDAH ADA (`kartu_stok_bahan_aksesoris`, `master_bahan_aksesoris.
stok_akhir`, `lot_bahan_aksesoris.qty_sisa`/`status`) + BACA `order_spk`
(§26.2, rules sudah `allow read: if login()` — semua role login bisa
baca, cocok buat dropdown No. SPK non-Owner juga). **TIDAK ADA blokir
publish firestore.rules di Tahap ini** (sama seperti Tahap 4).

**CATATAN write rules + KEPUTUSAN Guru (27 Agt 2026)**: `isAdminLevel()`
di `firestore.rules` (dipakai `kartu_stok_bahan_aksesoris`/
`master_bahan_aksesoris`/`lot_bahan_aksesoris`) mengizinkan role
`['admin','pic','owner','superuser']` — role `'operator'` TIDAK
termasuk, SUDAH BEGITU dari lama (BUKAN hal baru dari Tahap 4/5). Saya
sempat mengingatkan ini sebagai potensi ganjalan buat akun `'operator'`
sungguhan; Guru KONFIRMASI EKSPLISIT: **"jgn tambahkan operator"** ke
`isAdminLevel()` — `firestore.rules` TIDAK diubah sama sekali soal ini.
Pembagian akses yang berlaku CUKUP **Owner vs non-Owner** (persis pola
gerbang mobile-only yang SUDAH ada di Scan Opname/Scan Persiapan).
Soal SIAPA yang boleh PAKAI menu-menu ini ("penggunaan harusnya semua
bisa") — itu diatur lewat Config Akses (`cekIzinMenu`, pola
fail-permissive `!== false`, SUDAH permisif ke semua role secara
default), Guru akan atur sendiri visibility per profil nanti lewat
Config Akses kalau perlu dibatasi — BUKAN lewat `firestore.rules`.

**File yang diubah/ditambah**:
- `js/vue-scan-persiapan.js` (BARU) — `ScanPersiapanManager` (pilih SPK +
  gerbang mobile + cari/scan barang + form qty + riwayat sesi + modal
  kamera), wrapper `AppScanPersiapan`, lazy-mount `window.
  pastikanMountScanPersiapan()` ke `#vue-scan-persiapan`. TIDAK impor
  `isDesktopBrowser()`/`ambilDaftarBahanAksesorisLengkap()`/
  `formatNamaBahan()` dari file lain (disalin, konvensi proyek) — TAPI
  IMPOR fungsi baca/tulis lot & stok (`ambilLotAktif`, `cariLotByKode`,
  `cariBahanByIdTampil`, `ambilBahanById`, `catatPergerakanKartuStok`,
  `catatPemakaianDariAlokasi`) dari `vue-stock-pembelian.js`.
- `js/vue-stock-pembelian.js` — `catatPemakaianDariAlokasi()` tambah 1
  param OPSIONAL BARU `sumber` (backward-compatible, lihat penjelasan di
  atas). Bump `?v=18`.
- `index.html` — tambah 1 button child-tab BARU "Scan Persiapan" (di
  dalam `sub-zh-scan-btn`, tab kedua setelah "Scan Opname") + 1
  content-div `#sub-zh-scan-persiapan` berisi mount point
  `#vue-scan-persiapan`. Script tag baru `js/vue-scan-persiapan.js?v=1`.
  `js/dashboard.js` di-bump ke `?v=12`, `js/vue-stock-pembelian.js`
  ke `?v=18`.
- `js/dashboard.js` — `petaMount` tambah `'sub-zh-scan-persiapan':
  'pastikanMountScanPersiapan'` (`petaTabIndukPerGrup` TIDAK perlu
  diubah, grup `sub-zh-scan` sudah terdaftar sejak Tahap 4).
- `js/vue-config-akses.js` — `DAFTAR_MENU` tambah 1 entry: `{ id:
  'scan_persiapan', label: 'Scan Persiapan', kategori: 'Zevanic
  House' }`.
- `firestore.rules` — **TIDAK diubah** (tidak ada koleksi baru).

Verifikasi: `node -c` lolos (`vue-scan-persiapan.js`, `vue-stock-
pembelian.js`, `dashboard.js`, `vue-config-akses.js`); tag HTML (div/
button/script) `index.html` seimbang (142/142, 62/62, 44/44 — naik dari
140/140, 61/61, 43/43 di Tahap 4, sesuai 1 button child-tab baru + 1
content-div baru + 1 script baru); tag HTML dalam `vue-scan-persiapan.js`
sendiri juga dicek seimbang penuh (div 24/24, button 7/7, table/thead/
tbody 2/2, tr/td/th, p 12/12, label 6/6, video/canvas/textarea 1/1 —
`input` "mismatch" 1/0 adalah NORMAL, void element HTML yang memang
tidak punya tag penutup, sama seperti semua file lain di proyek ini).

**Rencana tes yang disarankan ke Guru**:
1. Buka Zevanic House → Order SPK → pastikan ada minimal 1 No. SPK
   berstatus "Aktif" (buat bahan tes).
2. Buka Zevanic House → Scan → tab "Scan Persiapan" → cek halaman
   muncul, dropdown No. SPK terisi (cuma yang status Aktif).
3. **Sebagai Owner, di DESKTOP**: pilih No. SPK → cek TIDAK diblokir,
   dropdown-cari barang MUNCUL (selain tombol Scan). Cari & pilih 1
   item BUKAN lot → isi Qty → Catat Pemakaian → cek stok berkurang &
   muncul baris baru "Pemakaian (Scan Persiapan)" di Kartu Stok >
   Detail item itu, keterangan berisi "No SPK: ...".
4. **Sebagai Owner**: cari & pilih 1 item `pakai_lot_tracking` → pilih 1
   roll dari tabel → isi Qty ≤ qty_sisa roll → Catat Pemakaian → cek
   `qty_sisa` roll itu berkurang, `stok_akhir` bahan ikut berkurang,
   baris ledger baru muncul dgn `rincian_lot` roll yang benar.
5. **Sebagai Owner**: coba isi Qty LEBIH BESAR dari `qty_sisa` roll yang
   dipilih → cek DITOLAK dengan pesan jelas (bukan diproses
   sebagian/silent).
6. **Sebagai role BUKAN Owner, di DESKTOP**: cek halaman TERBLOKIR total
   (pesan "hanya bisa lewat HP") — SAMA seperti Scan Opname.
7. **Sebagai role BUKAN Owner, di HP**: pilih No. SPK (dropdown TETAP
   muncul, ini bukan yang di-gate) → cek dropdown-cari BARANG TIDAK
   muncul sama sekali, cuma tombol Scan. Scan QR roll → cek langsung
   masuk form Qty utk roll ITU. Scan QR item non-lot → cek langsung
   masuk form Qty level item.
8. Setelah 1 pemakaian tercatat, cek "Ganti No. SPK" balik ke pilihan
   SPK, dan "Riwayat Sesi Ini" di halaman Scan Persiapan menampilkan
   baris yang baru dicatat.
9. ~~PENTING kalau ada akun ber-role 'operator' sungguhan...~~ —
   **SUDAH DIJAWAB Guru (27 Agt 2026): "jgn tambahkan operator"** ke
   `isAdminLevel()`. Pembagian akses CUKUP Owner vs non-Owner;
   `firestore.rules` TIDAK diubah. Poin tes ini GUGUR, tidak perlu
   dites lagi — lihat catatan lengkap di atas ("CATATAN write rules +
   KEPUTUSAN Guru").
10. Setelah semua di atas dikonfirmasi jalan: buka Config Akses →
    update profil non-Owner yang sudah ada supaya menu Scan Persiapan
    tercatat eksplisit (sama seperti Tahap 4).

**STATUS: Tahap 5 (Scan Persiapan) SUDAH DIKIRIM (kode), BELUM DITES
Guru di live — TIDAK ADA blokir firestore.rules (tidak ada koleksi
baru).** Ini TAHAP TERAKHIR dari rencana besar §26 — SEMUA 5 tahap
(Config, Order SPK, Cetak Label, Scan Opname, Scan Persiapan) SEKARANG
SUDAH DIKERJAKAN (kode). Tahap 1-4 sudah dikonfirmasi Guru jalan normal
di live; Tahap 5 menunggu konfirmasi tes terakhir dari Guru untuk
menutup rencana besar §26 secara keseluruhan.

### 26.6 Penambahan setelah Tahap 5 — Cetak Label No. SPK (Order SPK) + tombol Scan No. SPK (Scan Persiapan)

Permintaan TAMBAHAN Guru (27 Agt 2026, setelah Tahap 5 dikirim) — 2 hal
yang saling terkait, dikerjakan bareng:

1. **Menu Order SPK** (`vue-order-spk.js`) SEKARANG bisa **cetak label
   fisik** per No. SPK (QR berisi `no_spk` + teks No. SPK/Nama Produk/
   Qty Target/Tanggal) — pola cetak SAMA PERSIS `CetakLabelManager`
   (§26.3): `buatQrDataUrl()` (disalin ke file ini, `qrcodejs` global
   yang sudah dimuat di `index.html`) + window print terpisah, QR
   digambar sinkron di window utama.
2. **Menu Scan Persiapan** (`vue-scan-persiapan.js`) SEKARANG punya
   **tombol scan kecil** di sebelah field "Pilih No. SPK" — men-
   SUPERSEDE "keputusan sepihak poin a" di §26.5 (yang sempat menduga
   No. SPK TIDAK akan pernah punya barcode fisik, jadi dropdown-saja
   dianggap final) — SEKARANG No. SPK JUGA bisa diidentifikasi lewat
   scan, persis seperti barang/roll.

**Kenapa dikerjakan bareng**: label QR yang dicetak Order SPK (poin 1)
ITULAH yang dibaca tombol scan baru di Scan Persiapan (poin 2) — 1
fitur tidak berguna tanpa yang lain.

**Detail Order SPK (`vue-order-spk.js`)**:
- Tombol form entry (atas) DIROMBAK dari 1 ("Simpan Order SPK"/"Simpan
  Perubahan") jadi **2**: **"Simpan + Cetak"** (`btn-primary`, simpan
  LALU langsung cetak 1 label buat entri yang baru saja disimpan,
  alert() konfirmasi "tersimpan" DILEWATI kalau ini yang dipilih — popup
  cetak sendiri sudah jadi konfirmasi visual) dan **"Simpan"**
  (`btn-outline`, perilaku LAMA persis — simpan saja, tanpa cetak).
  `simpan()` sekarang terima param `jugaCetak` (opsional, default
  falsy = perilaku lama).
- Tabel daftar (bawah) DAPAT **kolom checkbox** (kiri, mirip pola tabel
  roll `CetakLabelManager`) + tombol **"Pilih Semua"/"Kosongkan"** +
  tombol **"Cetak (N)"** (menampilkan jumlah baris tercentang) — buat
  cetak ULANG label BANYAK No. SPK sekaligus (mis. migrasi banyak SPK
  lama dari spreadsheet, atau label fisik hilang/rusak). Checkbox
  dikunci per `item.id`, **cuma berlaku utk baris yang lagi tampil di
  halaman aktif** (tabelnya paginasi cursor-based, TIDAK load semua data
  sekaligus) — pindah halaman TIDAK otomatis mengosongkan centangan
  lama (biar bisa "kumpulkan" pilihan lintas-halaman kalau perlu),
  "Kosongkan" buat reset manual. Dicatat jelas di UI (teks bantuan di
  bawah searchbox).
- Tiap baris tabel JUGA dapat 1 ikon "Cetak" baru (di kolom Aksi, di
  antara Edit dan Hapus) — cetak 1 label buat baris ITU SAJA, jalan
  pintas tanpa perlu centang dulu.
- SEMUA tombol/kolom cetak di atas digate `bolehCetak` — izin BARU
  dicek lewat `window.cekIzinMenu('order_spk', 'print')` — kolom `print`
  ini SUDAH ADA di skema `KOSONG_IZIN` sejak Cetak Label (§26.3, menu
  PERTAMA yang memakainya) — **Order SPK jadi menu KEDUA**. TIDAK ada
  perubahan skema Config Akses (`vue-config-akses.js` TIDAK disentuh —
  `order_spk` sudah terdaftar dari Tahap 2, kolom `print`-nya otomatis
  ikut ada).
- **SENGAJA TIDAK menulis log** ke koleksi `log_cetak_label` (§26.3) —
  koleksi itu skemanya spesifik label Bahan/Aksesoris (field
  `nama_barang`), mencampur No. SPK ke situ bikin "Riwayat Cetak Label"
  di menu Cetak Label jadi rancu domainnya. Order SPK TIDAK punya
  riwayat cetak tersendiri untuk sekarang — **keputusan sepihak**, bisa
  ditambah nanti kalau Guru minta.

**Detail Scan Persiapan (`vue-scan-persiapan.js`)**:
- `scanAktif` (boolean, khusus scan barang) DIGANTI `modeScan`
  (`'spk'|'barang'|null`) — pola 2-tujuan SAMA PERSIS `modeScan` di
  `vue-kartu-stok.js` (`'barang'|'roll'`). Jalur scan barang (`mode ===
  'barang'`) **TIDAK berubah logic-nya SAMA SEKALI**, cuma dipindah ke
  cabang `if` yang baru.
- Fungsi baru (LOKAL, tidak diekspor) `cariSpkByNoSpk(noSpk)` — query
  `order_spk` by `no_spk`, TANPA filter status (beda dari
  `ambilDaftarSpkAktif()` yang dipakai dropdown, filter Aktif saja) —
  supaya kalau yang discan ternyata SPK berstatus "Selesai", user dapat
  pesan JELAS ("cuma No. SPK Aktif yang bisa dipakai"), bukan "kode
  tidak dikenali" yang membingungkan.
- Tombol scan kecil (ikon `fa-qrcode`, `btn-outline`) ditaruh di
  SEBELAH field dropdown-cari "Pilih No. SPK" — tersedia **SEMUA role**
  (BUKAN gerbang mobile-only — gerbang itu KHUSUS identifikasi BARANG di
  Langkah 2 pemakaian, No. SPK cuma metadata pengelompokan/audit yang
  tidak mengubah logic stok, alasan yang SAMA seperti kenapa dropdown
  No. SPK dari awal juga sudah tersedia semua role, §26.5).
- Fungsi `pilihSpk(s)` BARU — logic "set spkAktif + reset field" yang
  SEBELUMNYA cuma ada di dalam `watch(spkEntry, ...)` sekarang jadi
  fungsi terpisah, dipanggil BAIK oleh watch (jalur dropdown) MAUPUN
  oleh hasil scan (jalur baru) — supaya 1 logic saja, tidak dobel.
- Modal kamera (SATU, dipakai gantian) teks bantuannya SEKARANG
  kondisional: "Arahkan kamera ke barcode label No. SPK" (mode `spk`)
  vs "Arahkan kamera ke QR label roll (atau QR item)" (mode `barang`,
  teks LAMA, tidak berubah).

**File yang diubah**:
- `js/vue-order-spk.js` — `buatQrDataUrl()` (disalin) + `cetakSpkList()`
  (BARU) di level modul; `OrderSpkManager` dapat `bolehCetak`,
  `mencetak`, `dicentangTabel`, `spkTercentang`, `toggleSemuaTabel`,
  `cetakTerpilih`; `simpan()` terima param `jugaCetak`; template
  dirombak (tombol form + kolom checkbox tabel + ikon cetak per baris).
- `js/vue-scan-persiapan.js` — fungsi baru `cariSpkByNoSpk()` +
  `pilihSpk()`; `scanAktif` → `modeScan`; `bukaScan()` sekarang terima
  param `mode`; `tangkapHasilScan()` bercabang per `modeScan`; template
  dapat tombol scan kecil di field No. SPK + teks modal kamera
  kondisional.
- `index.html` — bump `js/vue-order-spk.js?v=1→2`,
  `js/vue-scan-persiapan.js?v=1→2`. TIDAK ADA mount point/struktur HTML
  baru (cuma isi 2 file `.js` yang berubah).
- `js/vue-config-akses.js` — **TIDAK diubah** (kolom `print` utk
  `order_spk` otomatis ada, sudah bagian skema `KOSONG_IZIN` generik).
- `firestore.rules` — **TIDAK diubah** (tidak ada koleksi baru, tidak
  ada perubahan pola akses `order_spk` yang sudah ada sejak Tahap 2).
- `js/vue-stock-pembelian.js` — **TIDAK disentuh** (perubahan ini semua
  di file lain).

**Koleksi Firestore BARU**: **TIDAK ADA**. **TIDAK ADA blokir publish
firestore.rules**.

Verifikasi: `node -c` lolos (`vue-order-spk.js`, `vue-scan-
persiapan.js`); tag HTML dalam kedua file dicek seimbang penuh
(`vue-order-spk.js`: div 27/27, button 11/11, table/thead/tbody 1/1,
tr/td/th 2/7/7 dst; `vue-scan-persiapan.js`: div 26/26, button 8/8,
table/thead/tbody 2/2 dst — naik dari §26.5 karena tombol scan No. SPK
baru); `index.html` tag global TETAP seimbang (142/142 div, 62/62
button, 44/44 script — TIDAK berubah dari §26.5, penambahan ini murni
isi file `.js`, bukan struktur HTML baru).

**Rencana tes tambahan** (di ATAS rencana tes §26.2 & §26.5 yang sudah
ada):
1. Di Order SPK: isi entri baru → klik **"Simpan + Cetak"** → cek popup
   print muncul berisi 1 label (QR + No. SPK + Nama Produk + Qty Target
   + Tanggal), data ikut TERSIMPAN di tabel (cek search).
2. Di Order SPK: klik **"Simpan"** biasa (TANPA cetak) → cek TIDAK ada
   popup print, alert "tersimpan" muncul seperti biasa (perilaku lama).
3. Di tabel Order SPK: centang 2-3 baris → klik **"Cetak (N)"** → cek
   popup print berisi label SEBANYAK yang dicentang, urutan & datanya
   benar.
4. Di tabel Order SPK: klik ikon print di 1 baris (tanpa centang apapun)
   → cek cetak 1 label buat baris itu saja.
5. Cetak 1 label No. SPK fisik → buka Scan Persiapan → klik tombol scan
   kecil di sebelah field No. SPK → scan label yang baru dicetak → cek
   No. SPK otomatis terpilih (sama seperti pilih lewat dropdown).
6. Ubah status 1 SPK jadi "Selesai" di Order SPK → scan label SPK itu
   di Scan Persiapan → cek DITOLAK dengan pesan jelas ("cuma No. SPK
   Aktif..."), BUKAN "kode tidak dikenali".
7. Scan barcode acak/tidak dikenal di field No. SPK Scan Persiapan →
   cek pesan "tidak ditemukan" yang jelas.
8. Pastikan jalur scan BARANG (roll/item) di Scan Persiapan masih jalan
   normal seperti sebelumnya (TIDAK ada regresi dari perubahan
   `modeScan`).

**STATUS: Penambahan §26.6 SUDAH DIKIRIM (kode), BELUM DITES Guru di
live.**

---

### 27. Redesain Menu Home Mobile (diskusi + mockup + KODE PENUH, 27 Agt 2026)

**Awal mula**: Hilman kirim 2 screenshot (sidebar desktop Zevanic House vs
Home mobile) + minta didiskusikan kenapa grid menu Home mobile (bagian DI
BAWAH baris Shortcut) tidak ikut ter-update tiap kali menu baru ditambah
di dashboard, dan gimana caranya biar tetap rapi seiring menu bertambah.

**Diagnosis (dicek ke kode, bukan tebakan)**: `daftarMenuGroups()` di
`js/vue-components.js` — walau komentarnya sendiri mengklaim "satu sumber
kebenaran" — ternyata array yang ditulis TANGAN, TERPISAH dari
`DAFTAR_MENU` (`js/vue-config-akses.js`, sumber kebenaran yang SUNGGUHAN
dipakai sidebar & Config Akses). Buktinya: grup "Zevanic House" di situ
CUMA ada 2 menu (Bahan/Aksesoris, List Bahan/Aksesoris), padahal sidebar
sudah 12+ menu (Config, Persiapan Masalah, semua Stock & Pembelian, Order
SPK, Scan Opname, Scan Persiapan — hampir semua yang dibangun sepanjang
§26).

**Mockup**: dibuatkan artifact HTML (diagnosis + 6 opsi tata letak +
mockup phone-frame) — link ada di history chat. Hilman lalu memutuskan
kombinasi: Favorit/Pin (disederhanakan) + Kolom Pencarian + Akordeon per
Grup (maks. 5 + Lihat Semua), dan MINTA LANGSUNG DIKODING PENUH (bukan
bertahap) karena mau tinggal keluar — sesi ini jalan tanpa konfirmasi
lanjutan, semua keputusan desain yang tidak eksplisit diambil sendiri
dan DICATAT di bawah (bukan ditebak diam-diam).

**Keputusan final Hilman (verbatim, disederhanakan)**:
1. Fondasi: grid Home mobile TARIK LANGSUNG dari `DAFTAR_MENU` — SETUJU.
2. Kategori (`kategori` di `DAFTAR_MENU`) jadi nama grup APA ADANYA —
   SETUJU.
3. Kunci ikut logika lama (tampil semua, dikunci gembok) — SETUJU.
4. Header sapaan, kartu shift, Quote Card — **TIDAK disentuh**. Rombak
   MULAI TEPAT SETELAH Quote Card.
5. Baris "Shortcut" (Clock In/Out, Izin, Cuti, Lembur, Reimburse)
   **DIHAPUS**. Ganti "Favorit Saya": 1 kartu Clock In/Out WAJIB (selalu
   ada, tidak bisa dilepas) + MAKS. 4 menu favorit pilihan user sendiri.
6. Kolom pencarian, lintas semua kategori.
7. Akordeon per kategori, maks. 5 menu tampil + "Lihat Semua" kalau lebih.
8. Urutan menu (5 teratas per kategori) diambil dari urutan `DAFTAR_MENU`
   saja (BUKAN frekuensi klik) — DAN Hilman minta dibantu ada menu buat
   atur urutan itu sendiri (BARU, lihat poin admin di bawah).

**Keputusan tambahan yang saya ambil sendiri (didokumentasikan, BUKAN
ditebak diam-diam — kalau Guru mau beda, tinggal bilang)**:
- Default akordeon: **SEMUA TERTUTUP** saat Home dibuka (paling rapi).
  Belum ada instruksi eksplisit soal ini.
- "Lihat Semua" = **expand di tempat** (nambah tampilan item yang
  tersisa langsung di bawah 5 item pertama), BUKAN pindah ke layar
  terpisah — lebih sederhana & konsisten dengan pola akordeon.
- Fallback kalau `cekIzinMenu()` belum pernah diatur utk role tertentu
  (hasil `null`): **default TERKUNCI** untuk siapapun SELAIN
  owner/superuser (sebelumnya per-grup hardcode berbeda-beda, sekarang
  disamakan jadi 1 aturan aman).
- 3 menu (`config_akses`, `hak_akses`, `device_kiosk`) dapat flag BARU
  `wajibOwner: true` di `DAFTAR_MENU` — pengunci TAMBAHAN di ATAS Config
  Akses biasa, TETAP kekunci di Home mobile utk siapapun selain role
  `owner` asli, APAPUN hasil Config Akses-nya — supaya PERILAKU SAMA
  dengan gerbang yang sudah lama ada di sidebar desktop utk 3 menu itu
  (sebelumnya ini logic ada di `daftarMenuGroups()` versi lama, sekarang
  dipindah jadi data di `DAFTAR_MENU`).
- `master_suplayer` (sudah lama ditandai DIPENSIUNKAN) dapat flag BARU
  `deprecated: true` — otomatis TIDAK ikut nongol sebagai tile basi di
  Home mobile (entry-nya tetap ada di `DAFTAR_MENU`, cuma disembunyikan
  dari grid, alasan sama seperti kenapa entry-nya dari awal tidak
  dihapus — data izin lama tidak yatim).
- Kategori `Umum` (Dashboard, Profile) **TIDAK diikutkan** jadi grup di
  Home — bukan menu yang cocok jadi tile grid.

**BARU — admin "Urutan Menu di Home Mobile"** (Config Akses > Master
Karyawan, layar yang sudah Owner-only): kartu baru di ATAS tabel
izin lama, per kategori, tiap menu punya tombol panah naik/turun buat
atur urutan tampil — 5 teratas itu yang muncul duluan di akordeon Home
mobile (badge hijau "tampil duluan"). Simpan ke 1 dokumen Firestore
BARU: `pengaturan_sistem/urutan_menu_home`
(`{ perKategori: { [kategori]: [menuId, ...] } }`). Kalau belum pernah
diatur sama sekali, otomatis jatuh ke urutan asli `DAFTAR_MENU`
(self-healing — menu baru ke depan otomatis kebagian tempat di akhir).

**File yang diubah**:
- `js/vue-config-akses.js` — `DAFTAR_MENU` di-`export`, SEMUA entry
  (kecuali `dashboard`/`profile`/`master_suplayer`) dapat field BARU
  `icon` + `aksi` (function pindah tab/sub-tab — disalin PERSIS dari
  onclick tombol sidebar-nya masing-masing di `index.html`, BUKAN
  ditebak); `config_akses`/`hak_akses`/`device_kiosk` dapat
  `wajibOwner: true`; `master_suplayer` dapat `deprecated: true`;
  `KATEGORI_URUTAN` di-`export`. BARU: state + fungsi
  `urutanMenu`/`muatUrutanMenu`/`naikkanUrutan`/`turunkanUrutan`/
  `simpanUrutanMenu` + kartu template "Urutan Menu di Home Mobile".
- `js/vue-components.js` — `daftarMenuGroups(role, urutanKustomPerKategori)`
  DIROMBAK TOTAL: sekarang import & baca `DAFTAR_MENU`/`KATEGORI_URUTAN`
  dari `vue-config-akses.js` langsung (bukan array tulis-tangan lagi),
  urutan per kategori bisa dikustomisasi lewat parameter baru,
  fallback-terkunci & `wajibOwner` diterapkan di sini.
- `js/vue-home.js` — DIROMBAK dari Quote Card ke bawah: baris Shortcut
  dihapus total, GANTI "Favorit Saya" (state `modeAturFavorit`,
  `favoritIds`, `daftarFavorit`, fungsi `toggleAturFavorit`/
  `toggleFavorit`, simpan ke field BARU `menu_favorit` di
  `users/{email}`); kolom pencarian (`cariMenu`/`hasilPencarian`);
  akordeon per grup default tertutup, maks. 5 + "Lihat Semua"
  (`grupTerbuka`/`grupLihatSemua`/`itemsTampil`/`BATAS_TAMPIL`); baca
  `pengaturan_sistem/urutan_menu_home` 1x tiap muat Home. Fungsi
  `bukaIzin`/`bukaCuti`/`bukaLembur`/`bukaReimburse` (dulu dipanggil
  Shortcut) DIHAPUS (sudah tidak dipakai — jembatan
  `window.bukaFormIzinDariHome` dkk di `vue-account-profile.js` SENGAJA
  dibiarkan ada, tidak berbahaya walau tidak dipanggil siapapun lagi).
- `js/vue-header-mobile.js` — `LABEL_TAB`/`LABEL_SUBTAB` dapat banyak
  entry BARU utk Zevanic House (`tab-zevanic-house` + semua
  `sub-zevanic-house-*`/`sub-zh-*-*`) — TERNYATA celah LAMA (bukan cuma
  dari §26), header mobile selama ini kosong tiap buka menu Zevanic
  House manapun dari sidebar sekalipun. Ketauan sekarang karena Home
  jadi jalur utama ke situ — sekalian dibenerin.
- `index.html` — bump `js/vue-config-akses.js` (baru, `?v=1`),
  `js/vue-home.js` (baru, `?v=1`), `js/vue-header-mobile.js` (baru,
  `?v=1`). Import `vue-components.js` di `vue-home.js` dikasih
  `?v=3` (angka BARU, sengaja tidak ikut `?v=2` yang sudah dipakai
  importer lain — supaya dijamin fetch fresh, lihat catatan di file
  itu sendiri).
- `firestore.rules` — **PERUBAHAN WAJIB DI-PASTE MANUAL OLEH GURU KE
  FIREBASE CONSOLE** (lihat bagian ⚠️ di bawah — INI BUKAN OTOMATIS).

**⚠️ TINDAKAN WAJIB Guru sebelum fitur ini jalan — Firestore Rules**:
Saya TIDAK PUNYA akses deploy rules (dicatat di
`claude/FIRESTORE-RULES-SNAPSHOT.md`). Kebetulan ketemu kopi
`firestore.rules` yang LEBIH BARU dari snapshot itu tersimpan di folder
`F:\ZEVANIC HOUSE\FOUNDATION\Data Yang DIsiapkan\firestore.rules` (sudah
termasuk `order_spk`/`log_cetak_label` dari §26.2/§26.3) — SUDAH saya
tambahkan match block baru di situ & dikirim ulang ke folder yang sama,
tapi **Guru WAJIB buka isi file itu, salin SELURUHNYA, dan paste-timpa
ke Firebase Console → Firestore Database → Rules → Publish** — tanpa ini,
`pengaturan_sistem/urutan_menu_home` akan GAGAL DIBACA (permission-denied)
utk SEMUA role selain Owner, dan urutan menu custom TIDAK akan pernah
kepakai (Home tetap jalan normal, cuma jatuh ke urutan default
`DAFTAR_MENU` — BUKAN error fatal, tapi fitur urutannya percuma tanpa
rules ini). Blok yang ditambahkan:
```
match /pengaturan_sistem/{docId} {
  allow read: if login();
  allow write: if isOwnerOnly();
}
```
Field BARU `menu_favorit` di `users/{email}` **TIDAK BUTUH** perubahan
rules — sudah otomatis boleh ditulis sendiri oleh pemilik akun lewat
klausa `allow update` yang sudah ada (cuma menolak kalau field
`role`/`status_approval`/`gudang_penempatan` ikut berubah, `menu_favorit`
bukan salah satunya).

**Koleksi Firestore BARU**: `pengaturan_sistem` (1 dokumen:
`urutan_menu_home`). **Field BARU**: `users.menu_favorit` (array of
string, maks. 4 menuId).

**Efek samping / gap yang perlu Guru tahu (BUKAN pengurangan diam-diam)**:
- Izin/Cuti/Lembur/Reimburse (dulu shortcut 1-ketuk dari Home) SEKARANG
  cuma bisa diakses lewat tab Profile (bottom nav) → Absensi/Reimburse —
  konsekuensi LANGSUNG dari "Shortcut hapus" yang Hilman minta sendiri,
  BUKAN bug. Ke-4 fitur ini juga TIDAK BISA dipilih sebagai "Favorit"
  (bukan menu di `DAFTAR_MENU`).
- "Kartu Stok" & "Riwayat Harga Pembelian" (sub-tab di Stock & Pembelian)
  dari AWAL tidak punya `menuId` di `DAFTAR_MENU` (tidak digerbangi Config
  Akses sama sekali) — jadi otomatis JUGA tidak nongol di Home mobile
  yang baru (sama seperti sebelumnya, BUKAN regresi baru). Kalau Guru mau
  keduanya bisa diakses/difavoritkan dari Home, perlu didaftarkan dulu ke
  `DAFTAR_MENU` (kerjaan terpisah, belum dikerjakan sekarang).

**Verifikasi**: `node -c` lolos semua (`vue-config-akses.js`,
`vue-components.js`, `vue-home.js`, `vue-header-mobile.js`); tag HTML
template `vue-home.js` dicek seimbang (div 18/18, button 7/7, span
15/15, p 3/3, h3 2/2); tidak ada file lain yang memanggil
`daftarMenuGroups()` selain `vue-home.js` (dicek `grep` seluruh repo,
aman diubah signature-nya).

**Rencana tes** (Guru, di live, urutan disarankan):
1. Buka Home mobile role NON-Owner apapun — pastikan Shortcut lama SUDAH
   HILANG, muncul "Favorit Saya" (cuma kartu Clock In/Out) + kolom
   pencarian + daftar kategori (semua TERTUTUP defaultnya).
2. Ketuk kategori manapun → cek kebuka, maks. 5 menu tampil, kalau lebih
   dari 5 ada tombol "Lihat Semua (N)" yang nambahin sisanya di tempat.
3. Ketuk "Atur" di Favorit Saya → ketuk 1-4 menu YANG TIDAK TERKUNCI di
   kategori manapun → cek bintang muncul + slot Favorit Saya keisi →
   ketuk menu ke-5 → cek muncul alert "maksimal 4" → ketuk "Selesai" →
   REFRESH halaman → cek favorit TETAP tersimpan (baca dari
   `users/{email}.menu_favorit`).
4. Ketik di kolom pencarian (mis. "spk") → cek hasil muncul lintas
   kategori, kelakuan ketuk (navigasi normal / toggle favorit kalau lagi
   mode Atur) sama seperti di akordeon.
5. Login sebagai Owner → cek grup "Master Karyawan" (Config
   Akses/Hak Akses/List Device Kiosk) TETAP tampil normal (tidak
   terkunci) — konfirmasi `wajibOwner` tidak salah kunci Owner sendiri.
6. Login sebagai role non-Owner yang MEMANG diberi akses `hak_akses`
   lewat Config Akses (kalau ada) → cek menu itu **TETAP TERKUNCI** di
   Home mobile (membuktikan `wajibOwner` benar2 mengunci di ATAS Config
   Akses, bukan cuma fallback).
7. Buka Zevanic House manapun dari Home (mis. Order SPK) → cek HEADER
   MOBILE di atas sekarang menampilkan "Zevanic House - Order SPK" (dulu
   kosong, celah lama yang ikut dibenahi).
8. **SETELAH Guru paste rules baru ke Firebase Console**: buka Config
   Akses (Owner) → kartu "Urutan Menu di Home Mobile" → geser 1 menu di
   kategori Zevanic House pakai panah → "Simpan Urutan" → buka Home
   mobile (role manapun) → cek urutan 5 teratas kategori itu BERUBAH
   sesuai yang diatur.
9. **SEBELUM Guru paste rules** (opsional, buat lihat efeknya): buka
   console browser di Home mobile role non-Owner → cek ada log error
   "Gagal muat urutan menu Home mobile" (permission-denied) — INI YANG
   HILANG setelah rules di-paste.

**STATUS: Kode SUDAH DIKIRIM PENUH ke folder Guru (tanpa jeda tahap,
sesuai permintaan). Firestore Rules — file `firestore.rules` (folder
yang sama) — SUDAH ditempel & di-Publish Guru ke Firebase Console
(dikonfirmasi 27 Agt 2026 ~pukul 15:17 WIB, lihat §27.2). BELUM DITES
Guru di live sama sekali.**

### 27.1 Revisi tampilan (27 Agt 2026, sesi lanjutan) — Grid jadi 4 kolom, kolom pencarian dihapus, akordeon diganti Top-4 tampil-langsung

**SUPERSEDE sebagian dari §27** — poin 6 (kolom pencarian) dan poin 7
(akordeon maks. 5 + Lihat Semua) di §27 di atas SEKARANG DIGANTI sesuai
revisi Hilman berikut. Poin 1-5 dan 8 §27 (Favorit Saya tetap maks 4,
sumber `DAFTAR_MENU`, kunci gembok, panel Urutan Menu Owner-only, dst)
**TIDAK berubah**.

**Permintaan Hilman (verbatim)**: "ada revisi tampilan mobile lagi,
tetap yg di rombak d bawah quote, Grid jadi 4: 1. pada favorit saya
(Clockin / Clockout) 2. field cari > hapus 3. Akordeon per Grup, maks. 5
+ Lihat Semua > hapus ganti dengan Top-N + "Lihat Semua""

**Klarifikasi via 3 pertanyaan ke Hilman sebelum koding (BUKAN
ditebak — pesan aslinya ambigu di 2 titik: apakah grid-4 menurunkan maks
favorit, dan apakah grid-4 berlaku cuma Favorit Saya atau semua)**:
1. Favorit Saya grid 4 kolom — apakah maks favorit turun jadi 3 (biar
   Clock In/Out + 3 favorit = 4 kotak pas 1 baris)? → Hilman jawab:
   **TETAP maks 4 favorit** (total 5 kotak: Clock In/Out + 4 favorit,
   grid tetap wrap ke baris ke-2 walau lebar kolom sekarang 4, bukan 5).
2. Grid 4 kolom ini berlaku cuma Favorit Saya, atau juga di tampilan per
   kategori? → Hilman jawab: **berlaku SEMUA** (Favorit Saya DAN daftar
   per kategori sama-sama 4 kolom).
3. Top-N pengganti akordeon, N-nya berapa? → Hilman jawab: **N = 4**
   (samakan dengan lebar grid baru).

**Perubahan final yang dikerjakan**:
1. Grid Favorit Saya: `grid-template-columns:repeat(5,1fr)` →
   `repeat(4,1fr)`. Maks favorit TETAP 4 (tidak berubah dari §27) — cuma
   lebar kolomnya yang berubah, jadi kalau user isi penuh 4 favorit,
   barisnya jadi 2 baris (4 kotak + 1 kotak), BUKAN 1 baris rata seperti
   sebelumnya (5 kotak pas 1 baris).
2. Kolom pencarian (`cariMenu`/`hasilPencarian`, state & template-nya)
   **DIHAPUS TOTAL** dari `vue-home.js`.
3. Akordeon per kategori (`grupTerbuka`/`toggleGrup`, default tertutup,
   perlu tap buka dulu) **DIHAPUS**, diganti tampil LANGSUNG per
   kategori (nama kategori jadi label statis, bukan tombol collapse
   lagi) — nampilkan Top-4 menu (turun dari Top-5 di §27), sisanya lewat
   tombol "Lihat Semua" yang TETAP ADA (`grupLihatSemua`/
   `toggleLihatSemua`/`itemsTampil` dipertahankan apa adanya, cuma
   `BATAS_TAMPIL` diubah 5→4).
4. Grid per kategori JUGA ikut jadi 4 kolom (`repeat(5,1fr)` →
   `repeat(4,1fr)`).
5. Panel admin "Urutan Menu di Home Mobile" (Config Akses) disesuaikan:
   badge hijau "tampil duluan" sekarang nunjuk 4 menu teratas (bukan 5),
   teks penjelasan panel juga diubah dari "5 menu" jadi "4 menu".

**File yang diubah**:
- `js/vue-home.js` — hapus `cariMenu`/`hasilPencarian`/`grupTerbuka`/
  `toggleGrup` (state, fungsi, & 2 blok template terkait) sepenuhnya;
  grid Favorit Saya & grid per kategori sama-sama `repeat(4,1fr)`;
  `BATAS_TAMPIL` 5→4; struktur template per-kategori disederhanakan
  (langsung `v-for="grup in menuGroups"` tanpa lagi ada percabangan
  `v-if="cariMenu.trim()"` vs `v-else`, karena hasil pencarian sudah
  tidak ada).
- `js/vue-config-akses.js` — komentar & teks panel "Urutan Menu di Home
  Mobile" disesuaikan dari "5 menu"/`idx < 5` jadi "4 menu"/`idx < 4`.
  TIDAK ADA perubahan skema data (`pengaturan_sistem/urutan_menu_home`
  tetap PERSIS sama, cuma jumlah yang ditandai "tampil duluan" yang
  berubah tampilannya).
- `index.html` — bump `js/vue-home.js?v=1` → `?v=2`,
  `js/vue-config-akses.js?v=1` → `?v=2`.

**Yang TIDAK berubah dari §27**: sumber data (`DAFTAR_MENU`/
`KATEGORI_URUTAN`), logic kunci (`terkunci`/`wajibOwner`), penyimpanan
favorit (`menu_favorit` di `users/{email}`), koleksi
`pengaturan_sistem/urutan_menu_home`, Firestore Rules (masih PERSIS
sama seperti §27 — kalau Guru belum paste ke Firebase Console, itu
MASIH WAJIB dilakukan, TIDAK ada rules tambahan baru di revisi ini),
fungsi `daftarMenuGroups()` (`vue-components.js`, TIDAK disentuh sama
sekali di revisi ini).

**Verifikasi**: `node --check` lolos `vue-home.js` & `vue-config-akses.js`;
tag HTML `vue-home.js` dicek seimbang (div 13/13, button 5/5, span
12/12, p 3/3, h3 2/2, i 9/9); `grep` konfirmasi TIDAK ADA sisa referensi
`cariMenu`/`hasilPencarian`/`grupTerbuka`/`toggleGrup` yang masih
DIPAKAI di kode (cuma muncul di komentar penjelasan, bukan dipanggil).

**Rencana tes** (di ATAS 9 poin rencana tes §27 — poin 1, 2, dan 4 di
§27 SEKARANG TIDAK RELEVAN lagi karena kolom pencarian & akordeon-tutup
sudah tidak ada):
1. Buka Home mobile — pastikan grid Favorit Saya & grid tiap kategori
   SAMA-SAMA 4 kolom per baris (bukan 5 lagi).
2. Pastikan kolom pencarian SUDAH HILANG dari Home mobile.
3. Pastikan tiap kategori LANGSUNG tampil (tidak perlu tap nama
   kategori dulu), maks. 4 menu per kategori sebelum "Lihat Semua".
4. Kalau kategori punya >4 menu, ketuk "Lihat Semua" → cek sisanya
   muncul di tempat (sama seperti sebelumnya).
5. Isi 4 favorit di Favorit Saya → cek jadi 5 kotak total (Clock In/Out
   + 4 favorit), baris ke-2 cuma 1 kotak — BUKAN error tampilan, ini
   memang keputusan Guru (tetap maks 4 favorit, bukan diturunkan).
6. Buka Config Akses > "Urutan Menu di Home Mobile" → cek badge "tampil
   duluan" sekarang nempel di 4 menu teratas per kategori (bukan 5).

**STATUS: Kode SUDAH DIKIRIM ke folder Guru. BELUM DITES Guru di
live.**

### 27.2 Sinkron urutan menu ke sidebar desktop + urutan kategori bisa diatur + hapus badge angka kategori (27 Agt 2026, sesi lanjutan kedua)

**Permintaan Hilman (verbatim)**: "Pada urutan menu config > dihome
mobile dan samakan juga urutannya yah dengan desktop, lalu urutan
susunana penyimpanan juga kategori menunya bisa di susun, pada tampilan
mobile disamping ada angka yg dilingakri merah itu hapus saja, karena
sudah diwakili oleh lihat semua (n)"

Dipecah jadi 3 permintaan:
1. Urutan custom di panel "Urutan Menu di Home Mobile" (Config Akses)
   SEKARANG JUGA dipakai buat urutan sidebar desktop (sebelumnya cuma
   Home mobile).
2. Urutan KATEGORI itu sendiri (bukan cuma urutan menu DI DALAM 1
   kategori) sekarang JUGA bisa diatur Owner.
3. Badge angka jumlah menu (dilingkari merah) di samping nama kategori
   di Home mobile — dihapus (sudah terwakili "Lihat Semua (N)").

**Klarifikasi via AskUserQuestion sebelum koding (2x, BUKAN ditebak)**:
1. "Samakan urutannya dengan desktop" — maksudnya urutan custom JUGA
   dipakai sidebar desktop (1 sumber, 2 tempat), atau desktop tetap
   urutan lama? → Hilman jawab: **"Urutan custom JUGA dipakai sidebar
   desktop"**.
2. "Kategori menunya bisa disusun" — maksudnya urutan kategori
   (grup) juga bisa diatur Owner? → Hilman jawab: **"Ya, urutan
   kategori (grup) juga bisa diatur Owner"**.

**Temuan arsitektur PENTING (investigasi sebelum koding, supaya tidak
salah scope)**: sidebar desktop di `index.html` itu STATIS (bukan
di-render dari `DAFTAR_MENU`) dan BERLAPIS — tidak 1:1 dengan granularitas
`DAFTAR_MENU`:
- Master Absensi/Keuangan/Karyawan: sidebar cuma 1 tombol per kategori
  (mis. "Absensi" → `tab-admin-acc`) — daftar menu `DAFTAR_MENU`
  kategori itu sebenarnya jadi tombol TAB DI DALAM halaman itu (mis. 5
  tombol tab: Config Absensi/Penjadwalan/Antrean Absensi/Antrean
  Lembur/Riwayat, semua di dalam `tab-admin-acc`).
- Zevanic House: sidebar 6 tombol langsung (Config/Data Bahan &
  Aksesoris/Persiapan Masalah/Stock & Pembelian/Order SPK/Scan), tapi
  3 dari 6 (Data Bahan & Aksesoris, Stock & Pembelian, Scan) masing2
  MEWAKILI beberapa `DAFTAR_MENU` id sekaligus (3, 4, dan 2 id) yang
  jadi tombol tab lebih dalam LAGI di dalam halaman masing2.
- Master Integrasi: sidebar 3 tombol langsung, 1:1 dengan `DAFTAR_MENU`
  (tidak ada nesting tambahan).

Karena kompleksitas ini nambah jauh dari perkiraan awal (sync desktop
ternyata nyentuh 2 lapisan: urutan grup sidebar + urutan tombol tab DI
DALAM beberapa halaman), scope-nya DIKONFIRMASI ULANG ke Hilman lewat
AskUserQuestion ketiga: kerjakan **full 2 lapisan sekaligus** (bukan
bertahap) — Hilman pilih **"Full 2 lapisan sekaligus"**.

**Solusi teknis yang dipakai — REORDER DOM, BUKAN render ulang**: supaya
resiko rendah & tidak mengubah cara kerja `pindahTab`/`pindahSubTab`/
`onclick` yang sudah ada sama sekali, pendekatannya cuma menyusun ULANG
posisi elemen tombol yang SUDAH ADA di DOM (pakai `appendChild` buat
pindah posisi), bukan bikin sidebar jadi data-driven penuh (itu jauh
lebih beresiko & besar, TIDAK dipilih). Setiap tombol yang boleh
diatur ditandai atribut baru:
- `data-menu-id="<id DAFTAR_MENU>"` — kalau 1 tombol = 1 menu (mayoritas
  kasus).
- `data-menu-ids="id1,id2,..."` — kalau 1 tombol mewakili BEBERAPA menu
  sekaligus (3 tombol Zevanic House yang disebut di atas) — posisi
  tombol itu dihitung dari index PALING KECIL di antara menu yang
  diwakilinya.
Total 34 id (semua `DAFTAR_MENU` non-Umum, non-deprecated) SUDAH ditandai
& diverifikasi lewat skrip cocok-cocokan (0 typo, 0 yang kelewatan).

**Perubahan skema data**: dokumen `pengaturan_sistem/urutan_menu_home`
dapat 1 field baru `urutanKategori` (array nama kategori, sejajar
dengan `perKategori` yang sudah ada sejak §27.1) — TIDAK butuh Firestore
Rules baru (rule yang sudah disiapkan Guru itu untuk WHOLE DOC, field
baru otomatis ikut).

**File yang diubah**:
- `js/vue-config-akses.js` — panel "Urutan Menu di Home Mobile" ganti
  judul jadi "...& Sidebar Desktop"; tambah sub-panel BARU "Urutan
  Kategori (Grup Menu)" (naik/turun kategori, state `urutanKategoriArr`,
  fungsi `naikkanKategori`/`turunkanKategori`); `muatUrutanMenu()` &
  `simpanUrutanMenu()` disesuaikan baca/tulis `urutanKategori` di
  dokumen yang sama; list akordeon per-kategori sekarang urut pakai
  `urutanKategoriArr` (bukan `KATEGORI_URUTAN` mentah) supaya preview-nya
  konsisten dgn urutan yang bakal tampil.
- `js/vue-components.js` — `daftarMenuGroups(role, urutanKustomPerKategori,
  urutanKustomKategori)` — parameter ke-3 BARU, dipakai sort urutan grup
  sebelum di-return (fallback `KATEGORI_URUTAN` kalau belum diatur).
- `js/vue-home.js` — `ambilUrutanKustom()` sekarang return
  `{ perKategori, urutanKategori }` (dulu cuma `perKategori`); badge
  angka jumlah menu di header tiap kategori (`{{ grup.items.length }}`)
  DIHAPUS dari template (poin 3 permintaan) — sudah terwakili "Lihat
  Semua (N)"; import `vue-components.js` bump `?v=3`→`?v=4`.
- `js/auth.js` — fungsi BARU `window.terapkanUrutanMenuDesktop()` (async,
  fetch 1x dokumen `urutan_menu_home`, reorder DOM 2 lapis: (a) urutan
  5 pasangan tombol-grup+div-isi di `<nav>` sidebar, (b) urutan tombol
  di dalam `navgrp-integrasi`, `navgrp-zevanic`, dan 6 tab-strip
  (`sub-absensi`, `sub-keuangan`, `sub-karyawan`, `sub-zh-databahan`,
  `sub-zh-stock`, `sub-zh-scan`) — helper `_urutkanSiblingMenu()`,
  stable-sort, tombol tanpa `data-menu-id` (mis. "Riwayat Harga
  Pembelian"/"Kartu Stok" yang tidak ada di `DAFTAR_MENU`) otomatis
  jatuh paling belakang, TIDAK PERNAH hilang); dipanggil (fire-and-forget,
  tidak di-`await`) di baris terakhir `window.aturTampilanBerdasarkanRole()`
  supaya jalan tiap kali sidebar role di-render (login, pulih sesi).
- `index.html` — 34 atribut `data-menu-id`/`data-menu-ids` ditambahkan
  ke tombol sidebar & tab-strip terkait (TIDAK mengubah `onclick`/
  class/style yang sudah ada, cuma nambah atribut); bump versi
  `js/auth.js` (baru pertama kali dikasih versi, sebelumnya tanpa `?v=`)
  jadi `?v=1`, `js/vue-config-akses.js?v=2`→`?v=3`,
  `js/vue-home.js?v=2`→`?v=3`.

**Yang TIDAK berubah**: `pindahTab`/`pindahSubTab`/`toggleNavGroup`
(logic navigasi desktop, sama sekali tidak disentuh — cuma POSISI DOM
tombolnya yang berubah, bukan cara kerja klik-nya); gerbang role/hidden
class per menu (`window.aturTampilanBerdasarkanRole`, bagian
show/hide-nya TIDAK diubah, cuma ditambah 1 baris panggilan di akhir);
Firestore Rules (field baru `urutanKategori` ikut rule WHOLE DOC yang
sudah disiapkan sejak §27 — **UPDATE: SUDAH ditempel & di-Publish
Guru**, dikonfirmasi 27 Agt 2026 ~pukul 15:17 WIB, jadi field baru ini
otomatis ikut aktif juga tanpa kerja tambahan).

**Verifikasi**: `node --check` lolos ke-4 file JS yang diedit
(`auth.js`, `vue-config-akses.js`, `vue-components.js`, `vue-home.js`);
tag `index.html` dicek seimbang (div 142/142, button 62/62 — SAMA
dengan sebelum diedit, cuma nambah atribut bukan elemen); skrip
cocok-cocokan Python konfirmasi 34/34 id `DAFTAR_MENU` (non-Umum,
non-deprecated) SEMUA sudah ditandai `data-menu-id`/`data-menu-ids` di
`index.html`, 0 salah ketik, 0 yang kelewatan.

**Rencana tes** (BELUM dites Guru di live — ini kompleks & nyentuh
banyak halaman, tes manual per bagian dianjurkan sebelum dianggap
selesai):
1. Config Akses > panel "Urutan Menu di Home Mobile & Sidebar Desktop"
   — coba naik/turunkan urutan KATEGORI (sub-panel baru paling atas),
   simpan, refresh — cek urutan tersimpan & ke-load lagi dengan benar.
2. Ubah urutan menu DI DALAM 1 kategori (mis. Zevanic House), simpan.
3. Cek Home mobile — urutan kategori & urutan menu di dalamnya ikut
   berubah sesuai yang diatur di poin 1 & 2.
4. Cek sidebar desktop — urutan 5 grup (Master Absensi/Keuangan/
   Karyawan/Zevanic House/Integrasi) ikut berubah sesuai poin 1.
5. Buka halaman Master Absensi (tab-admin-acc) — cek urutan 5 tombol
   tab (Config Absensi/Penjadwalan/Antrean Absensi/Antrean Lembur/
   Riwayat) ikut urutan yang diatur di Config Akses kategori "Master
   Absensi".
6. Sama untuk Master Keuangan (`tab-keuangan`, 6 tombol) dan Master
   Karyawan (`tab-superuser`, 8 tombol termasuk 2 yang wajibOwner:
   Config Akses & Hak Akses).
7. Buka Zevanic House > "Data Bahan & Aksesoris" — cek urutan 3 tombol
   tab (Entry/List/Rak) ikut kategori "Zevanic House"; sama untuk
   "Stock & Pembelian" (4 tombol bertanda + 2 tombol tak-bertanda
   "Riwayat Harga Pembelian"/"Kartu Stok" yang harus tetap ada di
   posisi belakang, tidak boleh hilang) dan "Scan" (2 tombol).
8. Cek posisi 6 tombol langsung Zevanic House sendiri di sidebar
   (Config/Data Bahan/Persiapan/Stock/Order SPK/Scan) — urut sesuai
   index PALING KECIL dari menu yang diwakili tiap tombol.
9. Login sebagai role selain Owner (mis. admin/pic) — pastikan urutan
   custom TETAP kepakai (bukan cuma untuk Owner), dan tombol yang
   memang tidak boleh diakses role itu TETAP tersembunyi seperti biasa
   (gerbang `aturTampilanBerdasarkanRole` tidak berubah).
10. Cek badge angka jumlah menu di header kategori Home mobile SUDAH
    HILANG (poin 3 permintaan awal).

**STATUS: Kode SUDAH DIKIRIM ke folder Guru. Firestore Rules SUDAH
ditempel & di-Publish (dikonfirmasi 27 Agt 2026 ~pukul 15:17 WIB — 1
file `firestore.rules` yang sama JUGA membereskan tunggakan lama
`lot_bahan_aksesoris`/§25.5, `master_rak_penyimpanan`/§25.1+§25.3, dan
`kartu_stok_bahan_aksesoris`/§23, lihat konfirmasi isi file di atas).
BELUM DITES Guru di live — fitur ini paling kompleks dari semua revisi
Home mobile sejauh ini (nyentuh 6 file, 34 tombol ditandai, reorder DOM
2 lapis), disarankan ditest bertahap per kategori sebelum dianggap
final.**

## 28. Fitur BARU: "Master Produk" — Bill of Material (BOM) untuk produksi konveksi (27 Agt 2026)

**Permintaan Hilman (verbatim)**: "fitur baru Master Produk saya kirim
untuk proses bill of material pada konveksi, saya buatkan versi mockup
bantu sempurnakan dengan tampilan support mobile dan desktop
Zevanic House > Master Produk > Entry Produk
Zevanic House > Master Produk > List Produk
kita diskusi dan bantu uraikan"

Dilampirkan `mockupformbomproduk.jsx` — mockup React (`lucide-react`,
BUKAN bagian dari codebase Vue/vanilla-JS asli, murni ilustrasi UI/UX
yang diinginkan) berisi komponen `FormEntryBOM`: section "Data Produk
Utama" (Nama/Warna/Size/Foto, SKU string turunan otomatis, tidak
tersimpan) + 4 tab kategori BOM — **BOM Jasa** (nama+harga polos),
**BOM Pola** (foto, nama pola, nama bahan, warna bahan, panjang, isi
pola/pcs, jasa cutting, jasa serie, + modal nested "Kelola Komponen"
nama+qty), **BOM Aksesoris** (tahap proses, nama aksesoris, warna, qty,
satuan, kode webbing 2/3), **BOM Vendor** (struktur nyaris identik BOM
Pola, tambah field "Jenis Vendor", foto diganti label "Foto Proses").

Ini fitur BESAR & BARU TOTAL (skema Firestore baru, Storage baru,
menu/sidebar baru, calon pondasi potong-stok-otomatis ke depan) — per
`PEDOMAN-GAYA-KERJA.md` ("berhenti & diskusi dulu untuk keputusan
berisiko/mahal") & prinsip "jangan bikin tebak2", DIDISKUSIKAN dulu
lewat 4 ronde AskUserQuestion (bukan langsung dikoding) sebelum 1 baris
kode pun ditulis.

### 28.1 10 keputusan arsitektur (4 ronde AskUserQuestion)

1. **Nama Bahan/Aksesoris (di SEMUA baris BOM, termasuk Kode Webbing
   2/3)** → **WAJIB pilih dari Data Bahan & Aksesoris** (`DropdownCari`,
   strict-select) — TIDAK BOLEH teks bebas seperti mockup aslinya.
2. **Tujuan BOM ini** → fondasi produksi, ke depan dipakai **potong
   stok otomatis** (BUKAN cuma dokumentasi/arsip) — makanya link ke
   `master_bahan_aksesoris` di poin 1 WAJIB, bukan opsional.
3. **BOM Pola vs BOM Vendor** → **DIGABUNG jadi 1 tab** dengan toggle
   Internal/Vendor PER BARIS (beda dari mockup yang pisah 2 tab
   terpisah) — field "Jenis Vendor" cuma muncul kalau baris ditandai
   Vendor.
4. **Foto (produk & tiap baris Pola/Vendor)** → mulai pakai **Firebase
   Storage** (BUKAN base64-in-Firestore seperti modul lain di app ini)
   — modul KEDUA yang pakai Storage setelah Pengumuman.
5. **Nama Komponen** (di modal nested "Kelola Komponen" dalam baris
   Pola/Vendor) → JUGA wajib pilih dari Data Bahan & Aksesoris (sama
   seperti poin 1, ditegaskan terpisah karena field nested).
6. **SKU Produk** → **field TERSENDIRI, WAJIB UNIK** (dicek dobel
   sebelum simpan, pola sama `cekNoSpkDobel()` di `vue-order-spk.js`) —
   BUKAN cuma string tampilan turunan seperti di mockup (yang tidak
   pernah benar-benar tersimpan/dicek).
7. **"Isi Pola (Pcs)"** → dikonfirmasi artinya **hasil potong per pcs
   produk jadi** dari 1x potong pola itu.
8. **"Kode Webbing 2/3"** → dikonfirmasi ini **REFERENSI ke
   aksesoris/bahan LAIN** (bukan catatan teks bebas) — jadi ikut aturan
   poin 1, harus `DropdownCari` juga (opsional, boleh dikosongkan).
9. **Posisi menu** → Zevanic House, **setelah "Stock & Pembelian",
   sebelum "Order SPK"**.
10. **Cara kerja pembangunan** → Claude mengusulkan BERTAHAP (per
    kategori BOM), TAPI Hilman **memilih "Sekaligus semua"** (opsi
    NON-rekomendasi, keputusan eksplisit) — jadi seluruh fitur (Data
    Produk Utama + 3 kategori BOM + List Produk + Storage + Rules)
    ditulis dalam 1 kali kerja, bukan bertahap per-fase.

**Keputusan desain tambahan (turunan dari 10 di atas, ditentukan Claude
saat implementasi, BUKAN ditanyakan ulang karena mengikuti konvensi
codebase yang sudah ada)**:
- **TIDAK pakai `id_tampil` sekuensial** (mis. `PRD-0001`, pola
  `master_bahan_aksesoris`) — SKU (poin 6) itulah kode utama produk,
  sesuai desain asli mockup Hilman, supaya tidak ada 2 kode berbeda
  yang membingungkan untuk 1 produk. ID dokumen Firestore (auto-
  generated) tetap ada seperti biasa untuk referensi internal.
- **Field "Warna" (produk, Warna Bahan di baris Pola, Warna di baris
  Aksesoris) SEMUA pakai `DropdownCari` ke `master_warna`** — mengikuti
  pola YANG SUDAH ADA di `vue-bahan-aksesoris.js` (field Warna di sana
  sudah wajib pilih dari `master_warna`, bukan cuma field "Nama
  Bahan/Aksesoris" yang diatur eksplisit di poin 1) — bukan tebakan
  baru, perluasan konsisten dari konvensi yang sudah berjalan.
- **Field "Satuan" (BOM Aksesoris)** pakai `DropdownCari` ke
  `master_satuan` — pola sama seperti field Satuan Pembelian/Pemakaian
  di `vue-bahan-aksesoris.js`.
- **Field "Size"** TETAP teks bebas (bukan dropdown) — TIDAK ADA
  koleksi `master_size`/`master_ukuran_produk` sejenis di app ini
  (`master_ukuran` yang sudah ada TIDAK dipakai field manapun sampai
  sekarang, lihat `PETA-DATABASE.md`), jadi bikin dropdown baru untuk
  ini akan jadi tebakan skema yang tidak diminta — dibiarkan teks bebas
  seperti di mockup asli.

### 28.2 Skema Firestore BARU — `master_produk/{autoId}`

| Field | Tipe | Keterangan |
|---|---|---|
| `sku` | string | Kode utama produk, WAJIB unik (dicek query `where('sku','==',...)` sebelum simpan, dok sendiri dikecualikan saat edit — pola sama `cekNoSpkDobel()`). Disarankan otomatis dari `Nama-Warna-Size` (uppercase, spasi dibuang, sama formula seperti mockup asli), TAPI BOLEH diedit manual — begitu user mengetik langsung ke field ini, auto-isi berhenti menimpa (flag `skuDieditManual`) |
| `nama`, `warna`, `size` | string | Data Produk Utama. `warna` via `DropdownCari` (`master_warna`), `size` teks bebas |
| `foto` | string (URL Storage) / `''` | Path `master_produk/{idProduk}/foto_{timestamp}.jpg`, kompresi client (canvas, 700px/kualitas 0.7) sebelum upload. Foto lama dihapus dari Storage (`deleteObject`) begitu diganti ATAU dihapus eksplisit — TIDAK dibiarkan jadi file yatim |
| `bom_jasa` | array\<{nama, harga}\> | Baris kosong (nama kosong) tidak ikut disimpan |
| `bom_pola` | array\<object\> | 1 baris = 1 pola/vendor. Field: `tipe` (`'internal'`/`'vendor'`, keputusan §28.1 poin 3), `foto` (URL Storage, path `master_produk/{idProduk}/pola{index}_{timestamp}.jpg`), `nama_pola`, `bahan_aksesoris_id`+`nama_bahan` (ref+denormalisasi, WAJIB terisi kalau baris ada isinya — poin 1), `warna_bahan`, `panjang`, `isi_pola_pcs` (poin 7), `jasa_cutting`, `jasa_serie`, `jenis_vendor` (cuma diisi kalau `tipe==='vendor'`, kosong otomatis kalau internal), `komponen` (array\<{bahan_aksesoris_id, nama_komponen, qty}\>, dari modal "Kelola Komponen", poin 5) |
| `bom_aksesoris` | array\<object\> | 1 baris = 1 titik pasang aksesoris. Field: `tahap_proses`, `bahan_aksesoris_id`+`nama_aksesoris` (ref+denormalisasi, WAJIB — poin 1), `warna`, `qty`, `satuan`, `webbing2_id`+`webbing2_nama`, `webbing3_id`+`webbing3_nama` (ref+denormalisasi opsional, poin 8 — boleh kosong, TAPI kalau diisi HARUS resolve ke item valid, tidak boleh teks tak-dikenal) |
| `dibuat_pada`, `dibuat_oleh` | Timestamp, string | Standar |
| `diedit_pada`, `diedit_oleh` | Timestamp, string | Cuma ada kalau sudah pernah diedit |

**Validasi sebelum simpan** (`validasi()` di `FormEntryProdukBOM`): Nama/
Warna/Size/SKU wajib diisi; SETIAP baris BOM Pola/Vendor/Aksesoris yang
"ada isinya" (bukan baris kosong bawaan) WAJIB Nama Bahan/Aksesoris-nya
resolve ke item valid di `master_bahan_aksesoris` (kalau tidak, tolak
simpan dengan pesan jelas "pilih dari daftar dulu, bukan teks bebas") —
baris yang benar-benar kosong (belum diisi apa-apa) dilewati, TIDAK
dipaksa lengkap, supaya user bisa nambah banyak baris kosong dulu baru
isi belakangan tanpa dihalangi validasi baris yang belum disentuh.

### 28.3 Firebase Storage BARU

Path: `master_produk/{idProduk}/foto_{timestamp}.jpg` (foto produk) dan
`master_produk/{idProduk}/pola{index}_{timestamp}.jpg` (foto tiap baris
Pola/Vendor) — pola upload SAMA PERSIS seperti `pengumuman/{id}/
media_{timestamp}.{ext}` di `vue-config-info.js` (`uploadBytes`+
`getDownloadURL`, hapus file lama `deleteObject` begitu diganti).

⚠️ **PENTING — ini modul KEDUA yang pakai Firebase Storage di seluruh
proyek** (sebelumnya CUMA Pengumuman).

**KOREKSI (28 Agt 2026)**: catatan versi sebelumnya di sini bilang
"TIDAK ADA `storage.rules` yang tersimpan di mana pun" — itu **KELIRU**,
ditulis saat device bridge putus jadi belum sempat dicek langsung.
Setelah device tersambung lagi, ditemukan `storage.rules` **SUDAH ADA**
sebelumnya, isinya beneran aktif dipakai untuk Pengumuman — saat
ditemukan, lokasinya masih di folder ROOT `FOUNDATION`, terpisah dari
`firestore.rules`. **Guru sudah pindahkan ke `Data Yang Disiapkan`
(28 Agt 2026)** — sekarang SATU folder yang sama dengan semua file
lain, lihat konvensi lokasi di banner atas file ini. Isi aslinya:
```
match /pengumuman/{allPaths=**} {
  allow read: if request.auth != null;
  allow write: if request.auth != null
    && request.auth.token.role in ['admin', 'pic', 'owner', 'superuser']
    && request.resource.size < 1 * 1024 * 1024;
}
```
Pola inline (cek `request.auth.token.role` langsung, tanpa helper
function `login()`/`isAdminLevel()` seperti di `firestore.rules`) dan
pakai wildcard `{allPaths=**}` (bukan 1 level `{id}/{file}`). Versi
`storage.rules` yang sempat dibuat sesi sebelumnya (dari nol, struktur
BEDA dari yang asli ini) **untung belum sempat Guru publish** — kalau
sampai ke-publish, berisiko fitur Pengumuman jadi error baca/upload
foto karena struktur path-nya tidak cocok.

**Sudah diperbaiki & SUDAH DI-DEPLOY (28 Agt 2026)**: `storage.rules`
di device Guru sudah digabung dengan benar — isi ASLI untuk
`pengumuman` dipertahankan PERSIS sama, ditambah blok baru dengan pola
SAMA PERSIS untuk `master_produk/{allPaths=**}` (baca: login, tulis:
admin ke atas, batas ukuran 2MB — bukan 1MB, dikasih sedikit longgar
untuk foto produk). File gabungan ini ada di
`F:\ZEVANIC HOUSE\FOUNDATION\Data Yang Disiapkan\storage.rules` dan
Guru sudah konfirmasi sudah ditempel & Publish ke Firebase Console.

### 28.4 Firestore Rules BARU

Ditambahkan ke `firestore.rules` (di folder Guru, SATU FILE yang sama
dipakai berulang sejak §20 — bukan file terpisah baru):
```
match /master_produk/{docId} {
  allow read: if login();
  allow write: if isAdminLevel();
}
```
Pola SAMA seperti semua koleksi Zevanic House lain — **BELUM ditempel/
di-Publish Guru** ke Firebase Console per saat ini ditulis (beda dari
mayoritas koleksi lain di proyek yang SUDAH — lihat banner peringatan
di atas file ini).

### 28.5 File yang diubah/ditambah

- **`js/vue-master-produk.js`** (BARU, ~740 baris) — modul lengkap:
  helper `ambilDaftarBahanAksesorisLengkap()`/`ambilDaftarNama()`
  (disalin pola dari `vue-persiapan-masalah.js`/`vue-bahan-
  aksesoris.js`, BUKAN diimpor silang — konvensi tiap file berdiri
  sendiri di codebase ini), `resolveBahan()` (validasi wajib-pilih-
  dari-daftar), `kompresFotoKeBlob()`+`uploadFotoProduk()`+
  `hapusFotoProdukLama()` (kompresi+upload+cleanup Storage),
  `buatSkuOtomatis()`+`cekSkuDobel()`. Komponen: `KelolaKomponenModal`
  (modal nested per baris Pola/Vendor, prop `komponen` dikirim SEBAGAI
  REFERENSI array reactive — pola sama `PopupKonversiBerjenjang` di
  `vue-bahan-aksesoris.js`), `FormEntryProdukBOM` (form BOM lengkap,
  SATU komponen dipakai DUA tempat — mode create di halaman Entry, mode
  edit di modal List — BEDA dari pola lama `vue-bahan-aksesoris.js`
  yang duplikat form Entry & Edit, karena form BOM ini jauh lebih besar/
  kompleks buat diduplikasi ~500 baris), `MasterProdukEntryManager`
  (halaman Entry Produk, reset via `:key` increment tiap simpan sukses),
  `MasterProdukListManager` (List Produk: `usePaginasiFirestore`, tabel
  desktop + kartu mobile, modal edit, hapus termasuk cleanup foto
  Storage). Mount: `window.pastikanMountProdukEntry`/
  `pastikanMountProdukList` (pola sama semua modul Zevanic House lain).
- **`index.html`** — 1 tombol sidebar BARU "Master Produk"
  (`data-menu-ids="master_produk_entry,master_produk_list"`, posisi
  setelah Stock & Pembelian/sebelum Order SPK — poin 9), 1 blok konten
  BARU `sub-zevanic-house-produk` (2 child tab: Entry Produk/List
  Produk, `data-menu-id` masing-masing — otomatis ikut sistem urutan
  custom §27.2, TIDAK butuh perubahan tambahan di `auth.js`), 1
  `<script>` tag BARU `js/vue-master-produk.js?v=1`.
- **`js/dashboard.js`** — 2 entri BARU di `petaMount`:
  `sub-zh-produk-entry`→`pastikanMountProdukEntry`,
  `sub-zh-produk-list`→`pastikanMountProdukList`.
- **`js/vue-config-akses.js`** — 2 entri BARU di `DAFTAR_MENU`:
  `master_produk_entry` ("Entry Produk"), `master_produk_list` ("List
  Produk"), kategori "Zevanic House", posisi setelah `stock_cetak_label`
  sebelum `order_spk` (array literal — otomatis menentukan urutan
  default sebelum Owner atur custom). Default izin: Owner penuh
  otomatis, role lain KOSONG sampai Owner atur manual lewat Config Akses
  (pola default menu baru, sama seperti `order_spk`/`config_master_
  data` — TIDAK ditambahkan ke daftar fixed Superuser, sengaja, lihat
  komentar di file itu soal kenapa daftar itu TIDAK auto-ikut menu
  baru).
- **`firestore.rules`** (folder Guru) — blok `master_produk` BARU,
  lihat §28.4.
- **`storage.rules`** (folder Guru, file BARU) — lihat §28.3.

### 28.6 Verifikasi yang SUDAH dilakukan (sebelum dikirim)

- `node --check` (mode ESM) lolos untuk `vue-master-produk.js`,
  `dashboard.js`, `vue-config-akses.js` — 0 syntax error.
- Tag `<div>`/`<script>` `index.html` dicek seimbang setelah 3 blok
  disisipkan (sidebar, konten, script tag).
- Kurung kurawal `firestore.rules` dicek seimbang setelah blok baru
  disisipkan (77 buka = 77 tutup).
- **2 bug ditemukan & diperbaiki sendiri lewat review manual SEBELUM
  dikirim** (bukan ditemukan Guru lewat testing — dicatat di sini biar
  transparan apa yang sempat salah):
  1. Saat mode EDIT (buka produk lama lewat List), baris `komponen` di
     dalam BOM Pola/Vendor cuma menyimpan `nama_komponen` (bukan
     `pilih`, field yang dibaca `DropdownCari`) — akibatnya dropdown
     tampil KOSONG walau datanya ada, DAN validasi salah kira belum
     dipilih (menolak simpan walau data sudah benar). Fix: baris
     `komponen` dipetakan ulang (`pilih: k.nama_komponen`) saat data
     lama dimuat ke form edit.
  2. Tombol "Hapus Foto" di setiap baris Pola/Vendor sempat jadi kode
     mati (fungsi `hapusFotoPola()` ada tapi tidak ada tombolnya di
     template) — DAN logic hapus foto (baik foto produk maupun foto
     baris Pola) sebelumnya cuma mengosongkan tampilan tanpa benar-
     benar menghapus file lama dari Storage (file yatim). Fix: tombol
     ditambahkan + ditandai flag `fotoDihapus` per baris, dieksekusi
     jadi `deleteObject` sungguhan saat tombol Simpan ditekan.
- **BELUM ADA tes langsung ke Firestore/Storage sungguhan** (Firestore
  Rules & Storage Rules-nya sendiri BELUM dipublish Guru — lihat §28.3/
  §28.4, jadi tes end-to-end memang belum bisa dilakukan sampai itu
  beres) — verifikasi di atas murni statis (syntax, struktur, logic
  baca-manual), BUKAN pengganti tes fungsional di live.

### 28.7 STATUS & langkah selanjutnya

**SELESAI (28 Agt 2026):**
1. ✅ Kode ditulis, diverifikasi statis (`node --check` lolos, tag HTML
   seimbang), dan ditulis langsung ke device Guru lewat device bridge
   — sebelum ditulis, tiap file di-diff dulu terhadap isi device yang
   berjalan saat itu untuk pastikan tidak ada perubahan lain yang
   bentrok (aman, base sama persis).
2. ✅ `firestore.rules` (blok `master_produk`, §28.4) ditempel & di-
   Publish Guru ke Firebase Console.
3. ✅ `storage.rules` (gabungan Pengumuman asli + blok `master_produk`
   baru, §28.3) ditempel & di-Publish Guru ke Firebase Console.
4. ✅ Guru pindahkan `storage.rules` dari folder ROOT `FOUNDATION` ke
   dalam `Data Yang Disiapkan` — **konvensi lokasi file BERUBAH mulai
   sekarang, lihat banner di atas file ini**: SEMUA file kerja (kode +
   `firestore.rules` + `storage.rules`) ada di SATU folder yang sama:
   `F:\ZEVANIC HOUSE\FOUNDATION\Data Yang Disiapkan\`.
5. ✅ GitHub Pages sudah di-deploy (konfirmasi Guru "sudah di deploy
   semua").

**SEDANG BERLANGSUNG (28 Agt 2026): Guru sedang TESTING fitur Master
Produk di live.** Sesi Claude manapun yang menyambung dari titik ini
WAJIB tanya dulu ke Guru apa hasil testingnya — JANGAN asumsikan semua
lancar, dan JANGAN tebak-tebak kalau Guru melaporkan bug. Test plan
yang relevan (kalau Guru belum coba semua): buka Zevanic House > Master
Produk, Entry Produk 1 data lengkap (isi semua 3 kategori BOM: Jasa,
Pola/Vendor, Aksesoris), cek muncul benar di List Produk, coba Edit
(termasuk cek dropdown Komponen di baris Pola/Vendor terisi benar —
ini salah satu bug yang sempat ditemukan & diperbaiki sebelum kirim,
lihat §28.6), coba Hapus (cek foto ikut kehapus di Storage), cek
tampilan mobile (grid collapse ke 1 kolom).

**BELUM DIRAISE ke Guru (potensi kerja lanjutan, TIDAK termasuk scope
"sekaligus semua" yang disepakati)**: apakah `order_spk.nama_produk`
(sekarang teks bebas) sebaiknya nanti direferensikan ke Master Produk
ini, supaya tujuan "potong stok otomatis" (poin 2) benar-benar bisa
jalan — ini technically next-step yang natural, tapi TIDAK diminta
Hilman & TIDAK dikerjakan sesi ini, jangan diasumsikan in-scope tanpa
dikonfirmasi dulu.

### 28.8 PERBAIKAN UX (28 Agt 2026, sambil testing) — dropdown Bahan/Aksesoris digabung 1 field

**Permintaan Guru**: "di master produk filter di dropdowncari kategori
bahan mending munculkan langsung bahan dan warna jadi 1 field" — waktu
dicek, TIDAK ada filter kategori di dropdown-nya (itu bukan masalahnya),
tapi field "Nama Bahan"/"Nama Aksesoris" & "Warna Bahan"/"Warna" memang
2 dropdown terpisah di baris BOM Pola & BOM Aksesoris. Digabung jadi 1
field sesuai permintaan.

**Bug laten yang ikut ditemukan (BUKAN dilaporkan Guru, ditemukan waktu
investigasi permintaan di atas)**: `opsiNamaBahan` (opsi dropdown) &
`resolveBahan()` (pencocokan pilihan → item) sebelumnya cuma pakai
`b.nama` POLOS. Kalau ada 2+ item `master_bahan_aksesoris` dengan
`nama` SAMA tapi `warna` beda (kasus NORMAL — warna field terpisah di
Data Bahan & Aksesoris, 1 nama bahan lazim punya banyak varian warna),
dropdown-nya menampilkan nama yang SAMA berkali-kali (tidak bisa
dibedakan), dan `resolveBahan()` yang pakai `.find()` selalu ambil
hasil PERTAMA yang cocok namanya — kalau user maksudnya pilih varian
warna ke-2/ke-3, yang KE-SIMPAN malah `bahan_aksesoris_id` varian
PERTAMA (silent bug, tidak ada error, salah datanya baru ketahuan
belakangan). Ini PERSIS bug yang sama yang sudah lebih dulu ditemukan &
diperbaiki di `js/vue-stock-pembelian.js` (§25.7/§25.11) lewat fungsi
`formatNamaBahan(b)` (`(b.nama||'') + (b.warna?' '+b.warna:'')`) — cuma
belum ikut diterapkan waktu Master Produk ditulis (27 Agt 2026, §28).

**Perbaikan yang dilakukan** (`js/vue-master-produk.js`):
- Fungsi `formatNamaBahan()` DISALIN (bukan diimpor silang, konsisten
  konvensi proyek) dari `vue-stock-pembelian.js` ke file ini.
- `opsiNamaBahan` (opsi dropdown) & `resolveBahan()` (pencocokan) SEKARANG
  pakai `formatNamaBahan(b)`, bukan `b.nama` — otomatis memperbaiki
  SEMUA dropdown yang makai `opsiNamaBahan`/`resolveBahan`: Nama Bahan
  (BOM Pola/Vendor), Nama Aksesoris, Kode Webbing 2/3, DAN Nama
  Komponen (modal "Kelola Komponen") — 1 fix di 1 tempat, efeknya
  menyebar ke semua field terkait (bukan tempel manual di tiap field).
- Field dropdown "Warna Bahan" (baris BOM Pola/Vendor) & "Warna" (baris
  BOM Aksesoris) **DIHAPUS dari UI** (`warna_bahan_pilih`/`warna_pilih`
  dihapus dari state baris) — label field digabung jadi "Bahan (Nama +
  Warna)" / "Aksesoris (Nama + Warna)".
- **Skema Firestore `bom_pola.warna_bahan` & `bom_aksesoris.warna`
  TIDAK berubah** (tetap field string terpisah, BUKAN digabung jadi 1
  string) — cuma cara isinya yang berubah: SEKARANG auto-diambil dari
  `.warna` milik item yang di-resolve (`bahanItem.warna`/`item.warna`),
  BUKAN dipilih manual lewat dropdown kedua lagi.
- `komponen[].nama_komponen` & `webbing2_nama`/`webbing3_nama` (field
  ini dari awal TIDAK punya pasangan field warna terpisah) SEKARANG
  disimpan sebagai `formatNamaBahan(item)` (nama+warna gabungan), biar
  info warnanya tidak hilang.
- Rekonstruksi dropdown saat mode Edit disesuaikan: `bahan_pilih`/
  `aksesoris_pilih` sekarang direkonstruksi dari `formatNamaBahan({nama,
  warna})` (2 field lama → 1 string tampilan), `komponen[].pilih` &
  `webbing2_pilih`/`webbing3_pilih` TIDAK perlu berubah caranya (field
  sumbernya sudah otomatis berisi nama+warna gabungan sejak simpan).
- Field TOP-LEVEL produk (`form.warna_pilih`, dropdown "Warna" di "Data
  Produk Utama") **TIDAK terpengaruh/TIDAK diubah** — itu warna produk
  jadi sendiri (bukan warna bahan/aksesoris yang dipakai), tetap 1
  dropdown `master_warna` terpisah seperti semula.

**Verifikasi**: `node --check` lolos. Diff terhadap versi yang aktif di
device Guru dicek dulu sebelum ditulis (base cocok, tidak ada perubahan
lain yang bentrok). `index.html` di-cache-bust
(`vue-master-produk.js?v=1` → `?v=2`) supaya browser Guru tidak kepakai
versi lama dari cache. Kedua file (`vue-master-produk.js`, `index.html`)
SUDAH ditulis langsung ke `Data Yang Disiapkan` di device Guru.

⚠️ **Risiko data test lama**: kalau Guru sempat entry 1-2 data test
Master Produk SEBELUM perbaikan ini (pakai `?v=1`), field Bahan/
Aksesoris/Komponen/Webbing di data test itu kemungkinan perlu DIPILIH
ULANG saat dibuka Edit (dropdown bisa tampil kosong kalau format nama
tersimpan lama — nama polos — tidak lagi cocok format opsi baru — nama+
warna). TIDAK ada migrasi data otomatis untuk ini — diterima karena
masih tahap testing awal (belum ada data produksi sungguhan yang
kena dampak). Kalau Guru lapor "field Bahan jadi kosong pas Edit" untuk
data yang dibuat SEBELUM hari ini, itu SANGAT MUNGKIN karena ini —
jangan diasumsikan bug baru, cek dulu kapan data itu dibuat.

### 28.9 FITUR BARU (28 Agt 2026) — Import/Export Excel Master Produk

**Permintaan Guru**: sudah punya format Excel sendiri buat input cepat
Master Produk, minta (1) tombol download template, (2) upload file itu,
(3) popup verifikasi sebelum data benar-benar masuk (takut salah nama
bahan/warna dll). Didiskusikan dulu (2 ronde AskUserQuestion, sesuai
permintaan Guru "coba diskusi dulu") sebelum ditulis — 4 keputusan
kunci yang disepakati:
1. **2 tahap terpisah**: Import "Produk Utama" (SKU/Nama/Warna/Size)
   dulu, BARU Import "BOM" (Jasa/Pola/Komponen/Aksesoris) — BOM tidak
   bisa masuk kalau SKU-nya belum ada di Data Produk.
2. **Template BOM = 4 sheet dalam 1 file** (`Jasa`, `Pola`, `Komponen`,
   `Aksesoris`), bukan 4 file terpisah.
3. **Popup verifikasi kasih saran & bisa dikoreksi langsung di popup**
   (bukan cuma tolak-tanpa-saran, dan bukan auto-terima tebakan) —
   dipakai algoritma Levenshtein (`jarakLevenshtein`/`cariSaranTerdekat`,
   ditulis dari nol, tidak ada library sejenis di proyek ini) buat
   saran "maksud Anda...?" kalau teks dari Excel (nama Bahan/Warna/
   Satuan/dll) tidak cocok persis dengan Data Bahan & Aksesoris/Data
   Warna/Data Satuan.
4. **Mode "Ganti Total"** per SKU per kategori — import MENIMPA
   `bom_jasa`/`bom_pola`/`bom_aksesoris` produk itu SELURUHNYA (bukan
   tambah/gabung ke BOM lama), dan Produk Utama SELURUHNYA (nama/warna/
   size) kalau SKU sudah ada — konfirmasi final Guru: "Ganti total
   (Direkomendasikan)".

Konfirmasi akhir Guru soal UI: **teks saja (tanpa foto)**, dan **1
tombol dropdown gabungan** buat ke-4 aksi (Download Template Produk
Utama, Import Produk Utama, Download Template BOM, Import BOM) — bukan
4 tombol terpisah.

**⚠️ Insiden kerja (jujur dicatat, bukan disembunyikan)**: implementasi
PERTAMA fitur ini (ditulis lengkap, `node --check` lolos) HILANG sebelum
sempat dikirim ke device Guru — Claude tidak sengaja menimpa file lokal
lewat `device_stage_files` (ambil ulang salinan dari device buat
persiapan pengiriman, tanpa sadar itu menimpa hasil kerja lokal yang
belum disinkronkan ke device/backup manapun). Fix dropdown §28.8 di
atas AMAN (sudah lebih dulu terkirim & terkonfirmasi jalan di device,
tidak kena dampak). Fitur Import Excel-nya DITULIS ULANG dari nol pada
sesi yang sama (desain yang sudah disepakati di atas TIDAK diulang
diskusinya, cuma implementasi kode yang ditulis ulang) — Guru sudah
diberitahu langsung di chat saat kejadian.

**Fungsi baru** (`js/vue-master-produk.js`):
- `ambilSemuaProduk()` — ambil SEMUA dokumen `master_produk` (bukan 1
  halaman paginasi) buat cek SKU dobel/SKU sudah ada.
- `jarakLevenshtein(a,b)`, `cariSaranTerdekat(teks, daftarOpsi)`,
  `validasiPilihan(nilaiAsli, daftarOpsi)` — fuzzy-match buat saran
  koreksi di popup.
- `bacaFileExcel(file)`, `ambilSheet(workbook, namaSheet)` — baca file
  `.xlsx` (pakai `XLSX` global dari SheetJS, SUDAH dimuat lewat
  `<script>` CDN di `index.html`, sama seperti dipakai duluan di
  `js/vue-penjadwalan.js` — TIDAK ada dependency baru).
- `unduhWorkbook(sheets, namaFile)`, `unduhTemplateProdukUtama()`,
  `unduhTemplateBOM()` — generate & download file `.xlsx` template
  (isi 1 baris contoh per sheet, header PERSIS harus sama waktu dibaca
  ulang).

**Komponen baru**:
- `FieldValidasiInline` — 1 sel tabel popup: tampil nilai + status,
  bisa dikoreksi lewat `DropdownCari` (strict-select, opsi resmi dari
  Data Bahan & Aksesoris/Data Warna/Data Satuan) kalau tidak cocok
  persis, ada tombol "Pakai ini" buat langsung terima saran.
- `PopupImportProdukUtama` — tabel verifikasi tahap 1 (SKU, Nama,
  Warna via `FieldValidasiInline`, Size). SKU kosong/dobel-dalam-file/
  Warna tidak valid/Size kosong = baris ditolak. Tombol Import BARU
  aktif kalau SEMUA baris valid (tidak bisa import sebagian).
- `PopupImportBOM` — 4 tab verifikasi (Jasa/Pola/Komponen/Aksesoris)
  dari 1 file. SKU wajib sudah ada di Data Produk. Komponen dicocokkan
  ke Pola lewat pasangan (SKU, Nama Pola) yang harus ada persis di
  sheet Pola (case-insensitive). Tipe Pola wajib persis `internal`/
  `vendor`. SEMUA baris di SEMUA sheet harus valid sebelum tombol
  Import aktif.

**Perubahan `MasterProdukListManager`**: tombol dropdown baru
"Import / Template Excel" di sebelah kolom cari (4 item: Download
Template Produk Utama, Import Produk Utama, Download Template BOM,
Import BOM) + 2 `<input type="file">` tersembunyi. Handler
`muatSemuaReferensiImport()` SELALU ambil ulang Data Bahan & Aksesoris/
Warna/Satuan/daftar Produk TERBARU tiap kali popup dibuka (bukan
cache), biar validasi sesuai kondisi data SAAT itu. `konfirmasiImport
ProdukUtama()` upsert per SKU (`updateDoc` kalau SKU sudah ada,
`setDoc` dokumen baru kalau belum — produk baru dibuat dengan
`bom_jasa`/`bom_pola`/`bom_aksesoris` kosong, diisi lewat Import BOM).
`konfirmasiImportBOM()` kelompokkan baris per SKU, `updateDoc` TIMPA
TOTAL `bom_jasa`/`bom_pola`/`bom_aksesoris` produk itu (nesting
Komponen ke baris Pola yang cocok).

**Kolom template** (header WAJIB persis, dipakai juga waktu baca file):
- **Produk Utama** (1 sheet "Produk Utama"): `SKU`, `Nama`, `Warna`,
  `Size`.
- **BOM** (4 sheet dalam 1 file):
  - `Jasa`: `SKU`, `Nama Jasa`, `Harga`.
  - `Pola`: `SKU`, `Tipe (internal/vendor)`, `Nama Pola`, `Bahan (Nama
    + Warna)`, `Panjang`, `Isi Pola (Pcs)`, `Jasa Cutting`, `Jasa
    Serie`, `Jenis Vendor`.
  - `Komponen`: `SKU`, `Nama Pola` (harus cocok baris di sheet Pola
    SKU yang sama), `Nama Komponen (Nama + Warna)`, `Qty`.
  - `Aksesoris`: `SKU`, `Tahap Proses`, `Aksesoris (Nama + Warna)`,
    `Qty`, `Satuan`, `Kode Webbing 2 (Nama + Warna)`, `Kode Webbing 3
    (Nama + Warna)`.
- Field "Nama + Warna" (Bahan/Komponen/Aksesoris/Webbing) diisi TEKS
  GABUNGAN sama seperti tampilan dropdown di form (`formatNamaBahan`,
  §28.8), mis. `"Kain Kanvas Merah"` — BUKAN nama polos.

⚠️ **Kalau Excel Guru sendiri header-nya beda** dari yang di atas: harus
disamakan dulu (copy nilai ke template yang di-download dari sini),
karena pembacaan file cocokkan header PERSIS. Belum sempat dicek
langsung format Excel asli Guru (belum dikirim ke sesi ini) — kalau
ternyata beda struktur signifikan, kabari, bisa disesuaikan.

**Status pengiriman**: kode sudah ditulis lengkap, `node --check` lolos
(`vue-master-produk.js` v=3, cache-bust di `index.html`). Device sempat
terputus pas mau dikirim (kedua file dikirim lewat chat/SendUserFile
dulu sebagai jaring pengaman), **device konek lagi di sesi yang sama —
mtime device dicek ulang dulu (cocok persis dengan versi terakhir
di-diff, tidak ada perubahan lain yang bentrok) sebelum akhirnya
DITULIS ke `Data Yang Disiapkan` di device Guru**. **BELUM DITES Guru
di live** — sesi berikutnya WAJIB tanya dulu hasil testing tahap Import
Excel ini (terpisah dari status testing §28 fitur Master Produk
sebelumnya), jangan asumsi lancar.

### 28.10 BUG FIX (28 Agt 2026) — Menu drawer Profile mobile tidak lengkap ("Reimburse" buntu)

**Laporan Guru**: "ada bug menu pada profile di mobile tidak lengkap"
(awalnya tanpa detail — TIDAK ditebak, ditelusuri dulu lewat kode
sungguhan sebelum simpulkan apa-apa, sesuai kebijakan proyek).

**Cara verifikasi** (bukan tebak-tebak): `git clone` langsung repo
GitHub (`gechooco-ship-it/zevanic-erp-ui`, metode paling akurat, lihat
§18.5) ke sandbox, baca `js/vue-profile-drawer.js` (drawer navigasi
Profile khusus mobile) & `js/vue-account-profile.js` (isi sub-tab
Profile) SUNGGUHAN, dibandingkan langsung.

**Akar masalah ditemukan**: sub-tab "Reimburse" (`pindahTab('reimburse')`,
tombol "Ajukan Reimburse" — fitur yang ditambahkan belakangan ke baris
tab Profile) **TIDAK PERNAH ditambahkan ke daftar link di
`vue-profile-drawer.js`** waktu fitur itu dibuat. Baris tombol tab
Profile (`vue-account-profile.js`) memang SENGAJA `hidden md:block`
(disembunyikan total di mobile, lihat §5.3) — drawer Profile
(`vue-profile-drawer.js`) itulah **SATU-SATUNYA jalan navigasi sub-tab
Profile di mobile**. Drawer sebelum fix cuma punya 4 link: Data
Karyawan, Estimasi Gaji, Pencapaian, Keamanan — Reimburse KELUPAAN,
jadi di mobile sub-tab itu **TIDAK BISA DIBUKA SAMA SEKALI** (bukan
cuma "susah ditemukan" — betul-betul tidak ada jalan masuk).

**Perbaikan (putaran 1, `?v=1`)**: 1 baris `<button>` baru ditambahkan
ke `vue-profile-drawer.js` (`navigasi('reimburse')`, ikon `fa-receipt`
sama seperti tombol tab desktopnya), diposisikan setelah "Data
Karyawan". Sekalian dilaporkan ke Guru bahwa "Absensi" kelihatan kena
pola bug YANG SAMA (tidak ada link drawer-nya juga) — TIDAK langsung
diperbaiki tanpa konfirmasi (belum dilaporkan/diminta), ditanya dulu.

**Perbaikan (putaran 2, `?v=2`, permintaan Guru "perbaiki susunannya
supaya rapi")**: link "Absensi" (`navigasi('absensi')`, ikon
`fa-history`) ditambahkan, SEKALIGUS urutan SEMUA link drawer disusun
ulang supaya SAMA PERSIS dengan urutan baris tab desktop: **Data
Karyawan → Absensi → Reimburse → Pencapaian → Keamanan**. "Estimasi
Gaji" (tidak punya tombol di baris tab desktop — placeholder, lihat
PETA-MENU.md) diselipkan setelah Reimburse (dikelompokkan bareng topik
"uang") karena tidak punya posisi acuan di desktop. Urutan final drawer
SEKARANG: Data Karyawan, Absensi, Reimburse, Estimasi Gaji, Pencapaian,
Keamanan.

**Verifikasi**: diff `node --check` lolos tiap putaran, diff terhadap
isi repo GitHub (sumber kebenaran live, putaran 1) & terhadap file yang
baru dikirim (putaran 2) menunjukkan HANYA perubahan komentar + baris
tombol yang dimaksud, tidak ada yang lain kebawa/kehapus. `index.html`
di-cache-bust bertahap (`vue-profile-drawer.js` awalnya TANPA versi →
`?v=1` → `?v=2`). Kedua file SUDAH ditulis ke `Data Yang Disiapkan` di
device Guru (versi final `?v=2`). **BELUM DITES Guru di live.**

**Catatan buat sesi berikutnya**: `vue-profile-drawer.js` &
`vue-account-profile.js` **TIDAK ADA** di folder kerja `Data Yang
Disiapkan` sebelum fix ini (kode sesungguhnya cuma ada di repo GitHub,
belum pernah disalin ke folder kerja karena belum pernah perlu
disentuh) — sekarang `vue-profile-drawer.js` SUDAH ditaruh di situ.
`vue-account-profile.js` MASIH belum ada di folder kerja (tidak
disentuh fix ini) — kalau nanti perlu diedit, `git clone` dulu dari
GitHub (§18.5) buat dapat isi paling akurat, JANGAN andalkan ingatan.

## 29. Role BARU "PIC Owner" (28 Agt 2026) — kelola keuangan lintas gudang per jenis usaha

**Permintaan Guru**: "reimburse ada kebuntuan ... PIC Owner ... bisa
kelola keuangan all gudang ... difilter by jenis usaha misal hanya
konveksi saja gudang semua bisa dilihat." Eksplisit diminta diuraikan
dulu sebelum dikodekan ("ini keputusan penting") — 3 ronde
AskUserQuestion dijalankan sebelum kode ditulis (ringkasan keputusan di
bawah), sesuai kebijakan proyek "jangan tebak-tebak".

### 29.1 Riset yang dilakukan sebelum desain (bukan tebakan)
- Baca ulang `claude/FIRESTORE-RULES-SNAPSHOT.md` (Rules production per
  23 Agt 2026) — fungsi `isAdminLevel()`/`isOwnerLevel()`/`isOwnerOnly()`,
  Rules `reimburse` per-tahap.
- `git clone` langsung repo GitHub, baca `auth.js` (`bolehLihatData`,
  `cekIzinMenu`, `muatAksesConfigSaya`), `vue-config-akses.js`
  (`PROFIL_BAKU`, `TINGKAT_KEAMANAN_BAKU`, gerbang hardcode Config
  Akses/Hak Akses/Device Kiosk/Scan Opname & Persiapan mobile-only),
  `vue-reimburse.js` (`tahapUntukRoleSaya`, `isOwnerRole`),
  `vue-paginasi.js` (`bangunConstraintFilterPeran`), `vue-master-produk.js`,
  `vue-stock-pembelian.js`.
- Konfirmasi lewat `project_search`: §6.5 STATUS-PROYEK.md (keputusan
  SADAR Rules tetap di 4 tingkat baku, opsi "Rules baca akses_config
  per-menu" DITOLAK demi biaya) — jadi PIC Owner TIDAK dibuat sebagai
  role Firestore baru, HARUS menumpang salah satu dari 5 baku.

### 29.2 Keputusan final (3 ronde AskUserQuestion + koreksi Guru di chat)
1. **Model approval reimburse SEBENARNYA 4 level** (dikoreksi Guru
   setelah asumsi awal Claude keliru — awalnya dikira 3 tahap dengan PIC
   Owner menumpang tahap terakhir "menunggu_owner"):
   - Level 1 **Operator** — siapa saja bisa mengajukan.
   - Level 2 **Admin Finance** — approve, dibatasi PER GUDANG (role `admin`,
     tahap `menunggu_admin_finance`).
   - Level 3 **PIC Owner** — approve, dibatasi PER JENIS PEKERJAAN tapi
     LINTAS SEMUA GUDANG (role `pic`, tahap `menunggu_pic`).
   - Level 4 **Owner** — approve final, tanpa batasan (role `owner`,
     tahap `menunggu_owner`).
2. **Role Firestore PIC Owner = `'pic'`** (BUKAN `'owner'`) — cukup
   profil `akses_config` BARU dengan `tingkatKeamanan: 'pic'`. Rules
   tahap `menunggu_pic` sudah mengizinkan `role in ['pic','owner',
   'superuser']`, jadi TIDAK perlu ubah Rules sama sekali.
3. **Konsekuensi role='pic' (dikonfirmasi Guru)**: Config Akses, Hak
   Akses, Device Kiosk, WhatsApp, Mail Gateway, mode "scan penuh lewat
   HP" (Scan Opname/Persiapan) — semua gerbangnya hardcode
   `role==='owner'` literal — TETAP TERTUTUP untuk PIC Owner. Ini
   keputusan SADAR (bukan celah lupa): PIC Owner cuma dapat kuasa
   keuangan/produk, BUKAN kuasa administrasi sistem. Menu Master
   Keuangan & Zevanic House (termasuk Master Produk, Stock & Pembelian)
   sudah otomatis kebuka untuk role `pic` dari gerbang sidebar yang ada
   (tidak perlu ubah gerbang menu).
4. **Dimensi gudang di-bypass EKSPLISIT, BUKAN lewat kosongkan
   `gudang_penempatan`** — Guru sendiri yang menandai risiko ini:
   mengandalkan field kosong itu ambigu (bisa terbaca "belum diisi"
   oleh siapa saja yang lihat data, dan field itu mungkin masih dipakai
   buat keperluan lain di luar reimburse/produk, mis. Kiosk/Absensi).
   Solusinya: cek eksplisit `profil_akses === 'pic_owner'` di kode.

### 29.3 Perubahan kode (semua sudah `node --check` lolos)
- **`auth.js`** (`?v=1` → `?v=2`) — `window.bolehLihatData`: tambah
  `iniPicOwner = profil_akses.toLowerCase() === 'pic_owner'`, dimensi
  gudang (`gudangCocok`) langsung `return true` kalau `iniPicOwner`,
  TIDAK bergantung isi `gudang_penempatan`. Dimensi `jenis_pekerjaan`
  TETAP ditegakkan seperti biasa (PIC Owner Konveksi tetap tidak lihat
  data Retail/Logistik). Dipakai otomatis di semua 8 file yang sudah
  pakai `bolehLihatData` (termasuk Reimburse — **TIDAK ADA perubahan
  lain diperlukan di `vue-reimburse.js` sama sekali**, tahap `menunggu_pic`
  + filter ini sudah cukup).
- **`vue-paginasi.js`** (BARU ditambahkan ke `Data Yang Disiapkan`,
  sebelumnya tidak ada di situ — disalin dari `git clone` sebagai
  sumber kebenaran) — `bangunConstraintFilterPeran()`: pola SAMA persis
  (cek `profil_akses==='pic_owner'`, skip constraint `where()` gudang).
  Import di `vue-master-produk.js`/`vue-stock-pembelian.js` di-cache-bust
  `?v=1`. **CATATAN PENTING buat sesi berikutnya**: file ini dipakai
  JUGA oleh vue-antrean-absensi.js, vue-antrean-dakar.js, vue-antrean-
  lembur.js, vue-config-absensi.js, vue-penjadwalan.js, vue-daftar-
  karyawan.js (kalau pakai `filterPeran:true`) — TIDAK diikutkan
  cache-bust di sesi ini (di luar scope 4 menu yang diminta Guru).
  Kalau ada laporan menu LAIN belum ke-update, cek cache-bust filenya.
- **`vue-master-produk.js`** (`?v=3` → `?v=4`) — field BARU
  `jenis_pekerjaan` (array, konvensi SAMA seperti `master_gudang`/
  `master_shift`) ditambahkan ke form entry (checkbox pill, opsional,
  kosong = tampil ke semua), disimpan di payload `simpan()`. List Produk
  (`MasterProdukListManager`) ditambah opsi `filterPeran: true,
  filterPeranField: { fieldGudang: null }` di `usePaginasiFirestore`
  (produk TIDAK PUNYA dimensi gudang sama sekali, konfirmasi grep —
  katalog produk lintas gudang buat semua role). **BELUM diikutkan**:
  kolom Jenis Pekerjaan di tabel List Produk (tampilan tag), dan
  kolom/isian di Template Import Excel Produk Utama (§28.9) — produk
  hasil import Excel akan TIDAK bertanda jenis usaha (jatuh-aman:
  tampil ke semua) sampai ditandai manual atau ditambahkan nanti.
- **`vue-stock-pembelian.js`** (`?v=18` → `?v=19`) — field BARU
  `jenis_pekerjaan` (array) ditambahkan ke form Order Belanja (checkbox
  pill, sama seperti Master Produk), disimpan di `payload` fungsi
  `simpan()` (koleksi `pesanan_pembelian`). Daftar draft (dropdown "No.
  Pembelian") difilter `window.bolehLihatJenisPekerjaan(d.jenis_pekerjaan)`
  di `muatSemua()`. **BELUM disentuh**: histori pesanan FINAL (kalau ada
  layar terpisah buat browse semua pesanan_pembelian yang sudah final —
  tidak ditemukan di file ini selain draft & Riwayat Harga Pembelian per
  item; kalau ternyata ADA layar itu di file lain, perlu ditambahkan
  filter yang sama).
- **`index.html`** — 3 baris `<script>` di-cache-bust (`auth.js?v=2`,
  `vue-stock-pembelian.js?v=19`, `vue-master-produk.js?v=4`), komentar
  ditambahkan di tiap baris.

### 29.4 Cara Guru pasang PIC Owner (setup, BUKAN kode — dilakukan lewat UI yang sudah ada)
1. **Config Akses** → buat profil baru, **id/nama HARUS PERSIS
   `pic_owner`** (huruf kecil semua, pakai underscore — kode di atas
   mencocokkan string ini apa adanya). Tingkat Keamanan Dasar: **PIC**
   (`tingkatKeamanan: 'pic'`). Centang izin View/Add/Edit/Delete/Print
   untuk menu: Antrean Reimburse (+ Kategori), Master Produk (Entry +
   List), List/Nota Order Belanja & menu Stock lain yang relevan — Slip
   Gaji belum ada, dilewati dulu.
2. **Hak Akses** → assign karyawan yang jadi PIC Owner ke profil
   `pic_owner` ini.
3. **Data Karyawan (Daftar Karyawan)** → edit karyawan itu: isi
   `Jenis Pekerjaan` sesuai bidang usahanya (mis. "Konveksi"). Field
   `Gudang Penempatan` BEBAS diisi apa saja (termasuk kosong) — TIDAK
   memengaruhi akses reimburse/produk/stock PIC Owner lagi (sudah
   di-bypass eksplisit lewat profil, lihat 29.3), jadi aman dipakai
   untuk keperluan lain (mis. Kiosk/Absensi) kalau memang perlu.
4. Kalau nanti mau PIC Owner kedua dengan bidang usaha lain (mis.
   "Retail") — profil `akses_config` yang SAMA (`pic_owner`) dipakai
   ulang, tinggal beda isian `Jenis Pekerjaan` di data karyawannya
   masing-masing (mekanisme ini per-karyawan, bukan per-profil).

### 29.5 Status pengiriman — BELUM SELESAI, device sempat terputus
Kode SUDAH ditulis lengkap & `node --check` lolos untuk `auth.js`,
`vue-paginasi.js`, `vue-master-produk.js`, `vue-stock-pembelian.js`,
`index.html`. **Device Guru terputus dari bridge di tengah sesi
sebelum sempat dikirim** (`device_commit_files` belum sempat dipanggil
sama sekali untuk kelima file ini) — sesi berikutnya WAJIB: (1) cek
device sudah konek lagi, (2) `device_list_dir` ulang folder `Data Yang
Disiapkan` buat cek mtime terbaru (jaga-jaga ada perubahan lain dari
Guru selagi device terputus), (3) baru `device_commit_files` kelima
file di atas. **BELUM DITES Guru di live sama sekali** (reimburse level
3, filter produk/stock by jenis usaha, filter gudang PIC Owner).

### 29.6 Yang SENGAJA belum dikerjakan (di luar 4 menu yang diminta)
- **Slip Gaji/Payroll** — masih placeholder ("Akan datang pada
  pembaruan finansial berikutnya"), belum ada modul buat difilter.
- Menu LAIN yang pakai `bolehLihatData`/`filterPeran` di luar 4 yang
  diminta (Absensi, Antrean Dakar, Antrean Lembur, Penjadwalan,
  Config Absensi, Daftar Karyawan) — PIC Owner (role `pic`) OTOMATIS
  ikut logic barunya kalau menu itu pakai `bolehLihatData`/
  `bangunConstraintFilterPeran` yang sudah diperbaiki di 29.3, TAPI
  belum diuji khusus untuk kasus PIC Owner — kalau Guru memang mau
  PIC Owner buka menu itu juga, cek dulu perilakunya sebelum
  diasumsikan benar.

### 29.7 KOREKSI (28 Agt 2026, sesi sama) — tagging Jenis Pekerjaan di Master Produk/Stock & Pembelian DIBATALKAN

Setelah §29.3 selesai dikirim (sempat terkirim ke Guru lewat zip, BUKAN
lewat device — device putus), Guru kasih konteks penting: **jenis
pekerjaan yang ADA di sistem sekarang cuma 2 — JNT (Logistik) dan ZCO
(Konveksi)**, dan **SELURUH grup menu Zevanic House (Master Produk,
Stock & Pembelian, Persiapan Masalah, Order SPK, Scan Opname/Persiapan,
dst.) memang 100% bisnis ZCO/Konveksi**.

**Konsekuensi**: tag `jenis_pekerjaan` per-produk/per-pesanan yang
ditambahkan di §29.3 (`vue-master-produk.js`, `vue-stock-pembelian.js`)
TIDAK ADA GUNANYA — semua data di Zevanic House sudah pasti ZCO, jadi
filter itu tidak pernah benar-benar menyaring apapun, cuma nambah field
kosong yang membingungkan. Guru diberi pilihan lewat AskUserQuestion,
jawaban: **hapus lagi** (bukan dibiarkan).

**Yang DIKEMBALIKAN (revert bersih, diverifikasi `node --check` + grep
`jenis_pekerjaan` kosong di kedua file)**:
- `vue-master-produk.js` — field `form.jenis_pekerjaan`, `opsiJenisPekerjaan`,
  muat opsi di `muatOpsi()`, UI checkbox pill, `filterPeran`/`filterPeranField`
  di `usePaginasiFirestore` — SEMUA dihapus balik ke kondisi sebelum §29.3.
- `vue-stock-pembelian.js` — field `jenisPekerjaanPesanan`, `opsiJenisPekerjaan`,
  muat opsi di `muatSemua()`, filter `daftarDraft`, UI checkbox pill, reset
  di `formKosong()`/`pilihNoPembelian()` — SEMUA dihapus balik.
- `index.html` — komentar `?v=4`/`?v=19` diperbarui, cache-bust TETAP
  dinaikkan (bukan diturunkan balik) karena baris import
  `./vue-paginasi.js?v=1` di kedua file MEMANG masih beda dari isi asli
  (lihat poin di bawah) — jadi tetap perlu refresh cache, cuma alasannya
  beda dari yang tertulis semula.

**Yang TETAP (tidak direvert, memang masih relevan/tidak berbahaya)**:
- `auth.js` (`bolehLihatData`) — TETAP, dipakai Reimburse (satu-satunya
  menu yang genuinely lintas JNT/ZCO, satu-satunya tempat filter jenis
  usaha benar-benar berguna sekarang).
- `vue-paginasi.js` (`bangunConstraintFilterPeran`) — TETAP, sama
  alasannya (dipakai menu LAIN yang lintas jenis usaha, mis. Absensi/
  Antrean, bukan Zevanic House).
- Import `'./vue-paginasi.js?v=1'` di `vue-master-produk.js` &
  `vue-stock-pembelian.js` — TETAP dibiarkan (harmless, sekadar
  memastikan versi `vue-paginasi.js` terbaru ke-load, walau fungsi
  `filterPeran`-nya sendiri tidak lagi dipanggil dari 2 file ini).

**Status pengiriman TERBARU**: 5 file (`auth.js`, `vue-paginasi.js`,
`vue-master-produk.js`, `vue-stock-pembelian.js`, `index.html`) SUDAH
diperbarui final (setelah revert ini) di sandbox, TAPI **device Guru
MASIH terputus dari bridge** — belum ada satupun yang sampai ke folder
`Data Yang Disiapkan` lewat `device_commit_files`. Sempat dikirim 1x
lewat `SendUserFile` (zip berisi versi §29.3, SEBELUM revert §29.7 ini)
— **zip itu SUDAH BASI, jangan dipakai**, kirim ulang zip baru (atau
device_commit_files kalau sudah konek) yang berisi versi SETELAH revert
ini sebelum Guru pasang manual.

## §30. List Produk (Master Produk) — hapus tampilan dobel + checkbox pilih + Hapus Massal (28 Agt 2026)

**Laporan Guru**: layar Master Produk > List Produk menampilkan 2 tampilan
sekaligus (tabel gaya desktop DAN kartu gaya mobile, dua-duanya kelihatan
bareng, isi produk yang sama dobel). Guru minta cuma tampilan bawah
(kartu) yang dipertahankan. Sekalian minta ditambah checkbox di tiap
produk + tombol Hapus Massal.

**Analisis kode** (`js/vue-master-produk.js`, komponen `MasterProdukListManager`):
kode sebelumnya memang sengaja bikin 2 blok — `<div class="hidden md:block">`
berisi `<table>` (harusnya cuma tampil di layar ≥768px) dan
`<div class="md:hidden">` berisi kartu (harusnya cuma tampil di layar
<768px) — pola responsif yang sama dipakai di banyak tabel lain di app
ini. Class CSS `.hidden`/`.md\:block`/`.md\:hidden` di
`css/gechoo-design.css` (dicek dari git repo) terlihat benar tanpa
`!important` yang bentrok, jadi secara kode+CSS di repo seharusnya
TIDAK mungkin dua-duanya tampil bareng di ukuran layar manapun. Root
cause pastinya tidak sempat diverifikasi langsung ke device Guru (device
sedang terputus dari bridge sepanjang sesi ini) — kemungkinan cache
browser/CSS versi lama, atau file live di komputer Guru sempat beda dari
git repo. **Karena akar masalahnya tidak bisa dipastikan tanpa akses
device, dan Guru sudah eksplisit menyebut hasil akhir yang diinginkan
("tampilan hanya 1 yang bawah aja"), perbaikan yang diambil adalah
melaksanakan permintaan itu langsung** (bukan menebak akar bug): blok
tabel desktop **dihapus total** dari kode, tersisa cuma satu tampilan
kartu yang selalu tampil di semua ukuran layar. Ini otomatis menutup
kemungkinan dobel-tampil apa pun sebabnya, karena sumber duplikasinya
(blok kedua) sudah tidak ada lagi.

**Checkbox pilih + Hapus Massal (baru)**:
- Checkbox di tiap kartu produk (`produkTerpilih` — array id yang
  dicentang, TIDAK direset saat pindah halaman paginasi, supaya bisa
  pilih produk dari beberapa halaman lalu hapus sekaligus).
- Checkbox "Pilih semua di halaman ini" (`semuaTercentang`/`toggleSemua`)
  — cuma pilih/lepas produk yang ada di halaman aktif.
- Tombol "Hapus Massal (n)" (`hapusMassal`) — loop `deleteDoc` +
  `hapusFotoProdukLama` per produk terpilih (pola sama seperti `hapus()`
  satuan yang sudah ada), lalu `paginasi.muatUlang()`. Kalau ada yang
  gagal dihapus, id yang gagal TETAP tercentang (biar bisa dicoba lagi)
  dan muncul alert jumlah yang gagal.
- Checkbox & tombol ini ikut `bolehHapus` (izin hapus menu
  `master_produk_list`) yang sudah ada — kalau tidak ada izin, checkbox
  & tombolnya tidak dirender sama sekali (bukan cuma disembunyikan).

**File yang berubah**: `js/vue-master-produk.js` saja (template List
Produk + logic checkbox/hapus massal di `MasterProdukListManager`).
`index.html`: cache-bust `vue-master-produk.js` naik ke `?v=5`.

**Status pengiriman**: device masih terputus dari bridge sepanjang sesi
ini (dicek ulang, masih gagal) — dikirim via `SendUserFile` sebagai zip
gabungan (§29 + §30 jadi SATU paket terbaru, menggantikan 2 zip
sebelumnya yang sudah basi). Belum diuji langsung di live oleh Guru.

**Belum dikerjakan / tidak diminta**: checkbox/hapus massal untuk
Stock & Pembelian atau menu list lain — kalau Guru mau pola yang sama di
menu lain, perlu diminta eksplisit per menu.

## §31. Config > Jenis Produk (tab baru) + field Jenis Produk di Entry Produk + kolom Excel (28 Agt 2026)

**Permintaan Guru** (verbatim, disingkat): tambah tab "Jenis Produk" di
Zevanic House > Config, format seperti "Data Ukuran"; tambah field
"Jenis Produk" di Master Produk > Entry Produk; tambah kolom "Jenis
Produk" di Template Excel.

**Keputusan desain**: Guru eksplisit minta pola "Data Ukuran" —
`MasterDataTabelManager` (koleksi Firestore sendiri, tabel Nama+
Keterangan, entry+searchbox) — BUKAN pola "Jenis Bahan"/"Jenis
Aksesoris" (`MasterDataCategory`, 1 dokumen `master_data/{kategori}`
isi array string). Konsekuensinya: `master_jenis_produk` jadi KOLEKSI
FIRESTORE BARU, bukan numpang di `master_data` yang sudah punya rule.
Lihat "PENTING — Firestore Rules" di bawah.

**File yang berubah**:
1. `js/vue-config.js` — `AppConfigJenisProduk` (tab ke-7), koleksi
   `master_jenis_produk`, label-singular "Jenis Produk", label-nama
   "Nama Jenis Produk", pakai `MENU_ID_CONFIG` yang sama (config_
   master_data) — tidak perlu menu-id baru di Config Akses.
   `window.pastikanMountConfigJenisProduk()` ditambah, pola sama 6
   fungsi mount lain di file itu.
2. `js/dashboard.js` — peta mount (`petaMount` di `pindahSubTab`) nambah
   `'sub-zh-config-jenisproduk': 'pastikanMountConfigJenisProduk'`.
3. `index.html` — tombol tab + div kontainer "Jenis Produk" ditaruh di
   antara "Data Ukuran" dan "Data Suplayer". Cache-bust: `vue-config.js`
   `?v=2`, `dashboard.js` `?v=13`, `vue-master-produk.js` `?v=6`.
4. `js/vue-master-produk.js` (`FormEntryProdukBOM`, Entry Produk) —
   field `jenis_produk_pilih` BARU: `DropdownCari` ke `opsiJenisProduk`
   (dimuat dari `master_jenis_produk` lewat `ambilDaftarNama()`, fungsi
   yang sama dipakai Warna/Satuan). **WAJIB diisi** (ditambah ke
   `validasi()`, konsisten dengan Warna & Size yang juga wajib — bukan
   field opsional). Disimpan sebagai `jenis_produk` (string, bukan id —
   pola sama seperti `warna`) di payload `master_produk`. Grid form
   diubah dari `md:grid-cols-3` ke `md:grid-cols-4` (Nama, Jenis Produk,
   Warna, Size).
5. Template & Import Excel Produk Utama (`unduhTemplateProdukUtama`,
   `PopupImportProdukUtama`, `konfirmasiImportProdukUtama`) — kolom
   "Jenis Produk" BARU di `HEADER_PRODUK_UTAMA`, divalidasi wajib cocok
   `opsiJenisProdukImport` (sama seperti validasi Warna, ada saran
   koreksi fuzzy-match lewat `field-validasi-inline` + `validasiPilihan`
   yang sudah ada), ikut ditulis ke Firestore di
   `konfirmasiImportProdukUtama` (baik cabang update maupun cabang buat
   baru).

**TIDAK diubah** (di luar permintaan, sengaja tidak disentuh — belajar
dari koreksi Guru soal Jenis Pekerjaan di §29.7, jaga scope ketat):
List Produk (tampilan kartu) belum menampilkan `jenis_produk` — kalau
Guru mau field ini juga tampil di List, perlu diminta eksplisit.

**⚠️ PENTING — Firestore Rules BARU dibutuhkan sebelum fitur ini bisa
dipakai**: `master_jenis_produk` koleksi baru, PERLU 1 match block baru
di `firestore.rules` (pola SAMA PERSIS seperti `master_satuan`/
`master_ukuran`/`master_warna`):
```
match /master_jenis_produk/{docId} {
  allow read: if login();
  allow write: if isAdminLevel();
}
```
Dikirim sebagai file terpisah `firestore-rules-tambahan-jenis-produk.txt`
di zip pengiriman — Guru WAJIB tempel manual di Firebase Console >
Firestore Database > Rules > Publish sebelum tab Config > Jenis Produk
atau field Jenis Produk di Entry Produk bisa dipakai (kalau belum,
"permission-denied", BUKAN bug kode — sesi Claude berikutnya CEK DULU
status publish rules ini kalau ada laporan begitu, jangan langsung
tebak bug).

**Status pengiriman**: device masih terputus dari bridge sepanjang sesi
ini (dicek berkali-kali, konsisten gagal) — dikirim via `SendUserFile`
sebagai zip gabungan (§29+§30+§31 jadi satu paket terbaru, menggantikan
zip-zip sebelumnya). Belum diuji langsung di live oleh Guru.

## 32. FITUR BARU (28 Agt 2026) — SKU Master Produk SEKARANG FULL OTOMATIS

**Permintaan Guru (verbatim)**: "untuk sku di isi otomatis oleh sistem
jadi user atau admin tidak perlu entry sku produk".

**Konteks**: sejak §28, field SKU sudah auto-terisi dari Nama-Warna-Size
TAPI masih bisa diedit manual (skuDieditManual — berhenti auto-isi begitu
user ketik langsung), dan popup Import Excel Produk Utama masih punya
kolom "SKU" wajib diisi user. Guru minta SKU jadi full-otomatis, user/
admin TIDAK entry SKU sama sekali di mana pun.

**2 keputusan diklarifikasi dulu lewat AskUserQuestion** (sesuai
"jangan bikin tebak2") sebelum ditulis:
1. **Duplikat SKU** (kalau 2 produk beda kebetulan hasil Nama-Warna-
   Size-nya sama): Guru pilih **sistem tambah angka otomatis** (akhiran
   -2/-3/dst), BUKAN dibuka lagi jadi bisa diedit manual saat bentrok.
2. **Cakupan**: Guru pilih **YA, sekalian untuk Excel** (bukan cuma
   form Entry Produk manual) — walau sudah diberi tahu konsekuensinya:
   sheet BOM (Jasa/Pola/Komponen/Aksesoris) jadi lebih rumit karena
   mereka butuh cara lain buat mencocokkan baris ke produk (SKU-nya
   belum diketahui user sebelum Import Produk Utama selesai jalan).

**Desain yang diambil buat sheet BOM** (konsekuensi teknis dari
keputusan #2 di atas, bukan ditanya terpisah — kalau ternyata bukan itu
maksud Guru, kabari, gampang disesuaikan): kolom "SKU" di 4 sheet BOM
DIGANTI jadi 3 kolom "Nama"+"Warna"+"Size" (sama seperti sheet Produk
Utama) — baris BOM dicocokkan ke produk lewat kombinasi itu (fungsi baru
`kunciProduk()`), bukan lewat SKU lagi.

**File yang berubah**: `js/vue-master-produk.js` (v=6 → v=7) & `index.html`
(cache-bust ikut).

1. **`kunciProduk(nama, warna, size)`** — fungsi BARU, jadi kunci
   pencocokan produk di seluruh file ini (GANTI TOTAL dari pola lama
   yang pakai SKU buat mencocokkan produk lama vs baru).
2. **`buatSkuUnikAsync(baseSku, idSedangEdit)`** — fungsi BARU dipakai
   `FormEntryProdukBOM.simpan()`: loop `cekSkuDobel()` sampai ketemu SKU
   yang belum dipakai, nambah akhiran `-2`/`-3`/dst kalau tabrakan. User
   TIDAK dikasih alert/diminta ubah apa-apa (GANTI dari §28: dulu
   ditolak+alert "Ubah SKU-nya").
3. **`FormEntryProdukBOM`** (Entry Produk) — `skuDieditManual`/
   `saatEditSku()` DIHAPUS. Field SKU di template jadi **read-only**
   (`readonly`, background abu-abu), label diubah jadi "(otomatis dari
   Nama-Warna-Size, tidak perlu diisi)". `validasi()` — cek "SKU tidak
   boleh kosong" DIHAPUS (selalu otomatis selama Nama/Warna/Size sudah
   diisi, yang sudah divalidasi terpisah). `simpan()` — SKU final
   ditentukan `buatSkuUnikAsync()` sebelum payload ditulis.
4. **Template & Import Excel Produk Utama** (`HEADER_PRODUK_UTAMA`,
   `unduhTemplateProdukUtama`, `PopupImportProdukUtama`,
   `konfirmasiImportProdukUtama`) — kolom **"SKU" DIHAPUS** dari header
   template. Produk dicocokkan lewat `kunciProduk(nama,warna,size)`:
   kunci sudah ada → `updateDoc` TIMPA nama/jenis_produk/warna/size,
   **SKU LAMA DIPERTAHANKAN** (sengaja TIDAK digenerate ulang — biar
   konsisten kalau SKU lama sudah dipakai fisik, mis. label tercetak);
   kunci belum ada → `setDoc` dokumen baru dengan SKU baru dari
   `buatSkuOtomatis()` + loop dedup pakai `Set` yang di-seed dari SKU
   semua produk existing (BUKAN query Firestore berulang tiap baris —
   lebih cepat buat import banyak baris sekaligus). Popup verifikasi
   dapat kolom baru "SKU (otomatis)" — **cuma preview/perkiraan**, jelas
   dicatat di teks popup bisa beda kalau ternyata dapat akhiran -2/-3.
5. **Template & Import BOM** (`HEADER_JASA`/`HEADER_POLA`/
   `HEADER_KOMPONEN`/`HEADER_AKSESORIS`, `PopupImportBOM`,
   `konfirmasiImportBOM`) — kolom **"SKU" DIGANTI** jadi 3 kolom
   "Nama"+"Warna"+"Size" (persis field yang sama di sheet Produk Utama).
   `PopupImportBOM`: `setSkuAda`/`skuValid()` → `petaProdukAda`/
   `produkAda(nama,warna,size)`; `kunciSkuPola` (pasangan SKU+Nama Pola
   buat cocokkan Komponen ke Pola) → `kunciProdukPola` (pasangan
   kunciProduk+Nama Pola). `konfirmasiImportBOM` (parent) dikelompokkan
   ulang per `kunciProduk()`, bukan per SKU lagi — SKU produk (`produk.
   sku`) sama sekali tidak perlu diketahui/dipakai di alur ini lagi.

**⚠️ Breaking buat file Excel LAMA**: file Excel yang sudah disiapkan
Guru sebelum perubahan ini (masih ada kolom "SKU") TIDAK BISA dipakai
langsung — kolom header harus PERSIS cocok (aturan lama, tidak berubah).
Guru perlu download ulang Template baru dan pindahkan datanya. Sudah
diberi peringatan eksplisit di `BACA-DULU.txt` BAGIAN 4.

**TIDAK ada Firestore Rules baru** untuk perubahan ini (tetap koleksi
`master_produk` yang sama, cuma isi field `sku`-nya yang berubah caranya
— bukan koleksi baru).

**Verifikasi**: `node --check` lolos di setiap tahap edit.

**Status pengiriman**: device masih terputus dari bridge sepanjang sesi
ini (dicek lagi, konsisten gagal) — dikirim via `SendUserFile` sebagai
zip gabungan terbaru (§29+§30+§31+§32 jadi satu paket, menggantikan
zip-zip sebelumnya termasuk yang barusan dikirim untuk §31). Belum diuji
langsung di live oleh Guru — mohon dicoba skala kecil dulu (1-2 produk,
lewat form maupun Excel) sebelum dipakai import banyak data sekaligus.

## §33. Config > Data Komponen (tab baru, 28 Agt 2026)

**Permintaan Guru** (verbatim): "pada menu zevanic house > config bantu
tambah tab data komponen mirip seperti data warna".

**Keputusan desain**: pola PERSIS SAMA seperti §31 (Jenis Produk) —
Guru minta "mirip Data Warna", jadi dipakai `MasterDataTabelManager`
(koleksi Firestore sendiri, 2 kolom Nama+Keterangan, entry+searchbox+
tabel) — BUKAN diperiksa dulu lewat AskUserQuestion, karena permintaan
ini SUDAH eksplisit menunjuk pola yang sudah ada persis ("mirip seperti
Data Warna"), tidak ada ambiguitas pola. Tidak diminta disambungkan ke
field/dropdown manapun (beda dari §31 yang eksplisit juga minta field
baru di Entry Produk + kolom Excel) — jadi tab ini **BERDIRI SENDIRI**,
BELUM disambungkan ke field apapun. Kalau nanti Guru mau field/BOM
Komponen di Master Produk pakai daftar ini, perlu diminta terpisah.

**File yang berubah**:
1. `js/vue-config.js` — `AppConfigKomponen` (tab ke-8), koleksi BARU
   `master_komponen`, label-singular "Komponen", label-nama "Nama
   Komponen", pakai `MENU_ID_CONFIG` yang sama (`config_master_data`) —
   tidak perlu menu-id baru di Config Akses.
   `window.pastikanMountConfigKomponen()` ditambah, pola sama fungsi
   mount lain di file itu.
2. `js/dashboard.js` — peta mount (`petaMount` di `pindahSubTab`) nambah
   `'sub-zh-config-komponen': 'pastikanMountConfigKomponen'`. Cache-bust
   `?v=14`.
3. `index.html` — tombol tab + div kontainer "Data Komponen" ditaruh di
   antara "Jenis Produk" dan "Data Suplayer". Cache-bust: `vue-config.js`
   `?v=3`.

**Skema `master_komponen/{autoId}`**: sama persis `master_ukuran`/
`master_jenis_produk` — `nama` (string, WAJIB unik, dicek client),
`keterangan` (string, opsional), `dibuat_pada` (Timestamp).

⚠️ **Firestore Rules BARU dibutuhkan** — `master_komponen` KOLEKSI BARU,
PERLU 1 block Rules baru di Firebase Console (sama pola persis seperti
`master_jenis_produk`). Isinya di file
`firestore-rules-tambahan-data-komponen.txt`, WAJIB ditempel + Publish
dulu di Firebase Console > Firestore Database > Rules (sejajar block
`master_jenis_produk` yang sudah ada) — sebelum itu, tab Data Komponen
akan gagal baca/tulis dengan error "permission-denied" (BUKAN bug kode).

**Verifikasi**: `node --check` lolos (`vue-config.js`, `dashboard.js`);
tag `<div>` `index.html` dicek seimbang (skrip Python manual, 152
buka/152 tutup, cocok).

**Status pengiriman**: device masih terputus dari bridge sepanjang sesi
ini (dicek ulang, konsisten gagal) — dikirim via `SendUserFile` sebagai
zip gabungan terbaru (§29+§30+§31+§32+§33 jadi satu paket, 10 file
termasuk `firestore-rules-tambahan-data-komponen.txt` BARU). Belum diuji
langsung di live oleh Guru.

## §34. "Kelola Komponen" (BOM Pola) ganti sumber ke Data Komponen (28 Agt 2026)

**Permintaan Guru** (dari screenshot Entry Produk > BOM Pola > "Kelola
Komponen"): "PADA DROP DOWN KELOLA KOMPONEN ISI YANG MUNCUL ADALAH DATA
KOMPONEN YANG DI ENTRY PADA MENU CONFIG TADI" — dropdown "Cari & pilih
komponen..." di modal Kelola Komponen harus ambil dari Data Komponen
(§33), bukan Data Bahan & Aksesoris seperti sebelumnya.

**Klarifikasi dilakukan (2 ronde AskUserQuestion)** — sesuai kebijakan
proyek "jangan bikin tebak2": ditanya apakah Template & Import Excel BOM
sheet "Komponen" (kolom "Nama Komponen (Nama+Warna)", sekarang validasi
ke Data Bahan & Aksesoris) ikut diganti juga ke Data Komponen (biar
konsisten dengan form) atau dibiarkan seperti sekarang. Jawaban pertama
("untuk validasi tetap ke sku") ambigu/tidak nyambung langsung ke
pertanyaan — ditanya ULANG buat klarifikasi (bukan ditebak), dan Guru
konfirmasi maksudnya: **Excel sheet Komponen TETAP seperti sekarang**
(validasi ke Data Bahan & Aksesoris, format Nama+Warna) — hanya dropdown
form manual yang berubah.

**File yang berubah**: `js/vue-master-produk.js` saja.
1. `barisKomponenKosong()` — field `bahan_aksesoris_id` DIHAPUS (tidak
   relevan lagi, `master_komponen` tidak punya konsep id/FK). `pilih`
   sekarang LANGSUNG jadi nilai final `nama_komponen` (teks polos dari
   Data Komponen), bukan lagi teks buat di-`resolveBahan()`.
2. `KelolaKomponenModal` — prop `opsiNamaBahan`/`daftarBahan` (Data
   Bahan & Aksesoris) diganti `opsiKomponen` (Data Komponen). Method
   `saatPilih()` (dulu resolve ke `bahan_aksesoris_id`) DIHAPUS — tidak
   perlu lagi. Teks deskripsi popup diganti "...wajib pilih dari Data
   Komponen (Config)."
3. `FormEntryProdukBOM` — `opsiKomponen` (ref) BARU, dimuat lewat
   `ambilDaftarNama('master_komponen')` di `muatOpsi()` (pola sama Warna/
   Jenis Produk). `validasi()`: baris Komponen sekarang dicek
   `opsiKomponen.value.includes(k.pilih)`, bukan `resolveBahan()`.
   `simpan()`: payload komponen SEKARANG `{ nama_komponen: k.pilih, qty }`
   langsung (tanpa `bahan_aksesoris_id`, tanpa `formatNamaBahan()`).
   Prop yang dikirim ke `<kelola-komponen-modal>` diganti `:opsi-komponen`
   (dulu `:opsi-nama-bahan` + `:daftar-bahan`).
4. `index.html` — cache-bust `vue-master-produk.js` `?v=8`.

**⚠️ KONSEKUENSI DISENGAJA — 2 sumber beda buat field `nama_komponen`
yang sama**: sejak perubahan ini, isi `master_produk.bom_pola[].komponen[].
nama_komponen` bisa datang dari 2 sumber beda tergantung jalurnya —
lewat form manual (Data Komponen, teks polos, mis. "Benang Navy") atau
lewat Excel Import BOM (Data Bahan & Aksesoris, format Nama+Warna, mis.
"Benang Navy Merah"). Ini BUKAN bug — Guru sudah eksplisit konfirmasi
Excel TIDAK ikut diubah. Kalau nanti ada laporan "format Nama Komponen
kok beda-beda antar produk", ini penjelasannya — cek dulu produk itu
dibuat/diedit lewat form atau lewat Import Excel sebelum menyimpulkan
ada bug.

**Field `bahan_aksesoris_id` di baris Komponen SEKARANG DIHAPUS dari
alur form manual** — komponen yang diisi lewat form TIDAK LAGI tertaut
ke item Data Bahan & Aksesoris manapun (dulu jadi fondasi rencana potong
stok otomatis ke depan, §28 catatan "SEMUA field wajib pilih dari Data
Bahan & Aksesoris... fondasi buat potong stok otomatis"). **Baris
Komponen dari Excel Import BOM MASIH tertaut** (`bahan_aksesoris_id`
tetap diisi di jalur itu, tidak disentuh). Kalau rencana potong stok
otomatis nanti benar dikerjakan, baris Komponen dari form manual PERLU
ditangani beda (tidak akan punya `bahan_aksesoris_id`) — dicatat di sini
supaya tidak lupa.

**TIDAK ada Firestore Rules baru** untuk perubahan ini (skema
`master_produk` yang sama, cuma cara isi `nama_komponen` yang berubah
di 1 jalur — bukan koleksi baru).

**Verifikasi**: `node --check` lolos.

**Status pengiriman**: device masih terputus dari bridge sepanjang sesi
ini (dicek lagi, konsisten gagal) — dikirim via `SendUserFile` sebagai
zip gabungan terbaru (§29+§30+§31+§32+§33+§34, 10 file). Belum diuji
langsung di live oleh Guru — mohon dicoba isi beberapa Data Komponen di
Config dulu, baru coba "Kelola Komponen" di Entry Produk.

## §35. Import & Upload Massal Excel — List Bahan & Aksesoris (28 Agt 2026)

**Permintaan Guru** (verbatim): "tambah fitur import di list bahan dan
aksesoris\ndan tambah fitur upload massal bahan dan aksesoris beserta
dengan templetnya".

**Klarifikasi dilakukan (2 pertanyaan AskUserQuestion, sekaligus sebelum
mulai coding)** — sesuai kebijakan proyek "jangan bikin tebak2":
1. **Cakupan Template** — pilihan: (a) semua field form lengkap, atau
   (b) field wajib saja. Guru pilih **"Field wajib saja (Recommended)"**
   — Template Excel HANYA berisi 9 kolom wajib: Kategori Utama, Jenis,
   Nama, Warna, Harga Pembelian, Satuan Pembelian, Isi Konversi
   Pembelian, Satuan Pemakaian, Margin Modal. Field lain (Rak
   Penyimpanan, Volume Barang, flag lot-tracking, Foto) TIDAK ada di
   Template — harus diisi manual lewat Edit setelah data masuk kalau
   diperlukan.
2. **Baris duplikat** (kombinasi Kategori Utama + Nama + Warna yang sudah
   ada di database) — pilihan: (a) timpa/update data lama, atau (b)
   lewati (skip). Guru pilih **"Lewati (skip), jangan ditimpa"** — beda
   dari pola Import Master Produk (§28.9) yang defaultnya "Ganti Total"
   (upsert/timpa). Sengaja DIBEDAKAN sesuai pilihan eksplisit Guru untuk
   fitur ini — kalau nanti ada laporan "data lama tidak ke-update pas
   import ulang", ini bukan bug, memang sengaja skip.

**Pola desain**: direplikasi PERSIS dari pola Import/Export Master Produk
(§28.9) yang sudah pernah dikirim & dijelaskan ke Guru sebelumnya —
tombol dropdown "Import / Template Excel" (2 pilihan: Download Template /
Import Excel), popup tabel verifikasi dengan sel yang bisa dikoreksi
inline (`FieldValidasiInline`, saran Levenshtein), status per baris,
tombol Import baru aktif kalau SEMUA baris valid. Sesuai konvensi proyek
"disalin, bukan diimpor silang" — helper (`jarakLevenshtein`,
`cariSaranTerdekat`, `validasiPilihan`, `bacaFileExcel`, `ambilSheet`,
`unduhWorkbook`, `FieldValidasiInline`) DISALIN ulang ke dalam
`vue-bahan-aksesoris.js`, bukan di-import dari `vue-master-produk.js`.

**File yang berubah**: `js/vue-bahan-aksesoris.js` (BARU ditambahkan ke
paket pengiriman kali ini) & `index.html` (cache-bust saja).

1. **Helper baru** (disalin dari `vue-master-produk.js`, pola sama
   persis): `jarakLevenshtein()`, `cariSaranTerdekat()`,
   `validasiPilihan()`, `bacaFileExcel()`, `ambilSheet()`,
   `unduhWorkbook()`.
2. **`ambilSemuaBahanAksesoris()`** — fungsi BARU, `getDocs` seluruh
   koleksi `master_bahan_aksesoris` (dipakai buat cek duplikat saat
   import, bukan query per-baris).
3. **`kunciBahanAksesoris(kategori, nama, warna)`** — fungsi BARU, kunci
   pencocokan (lowercase-trim, gabung `||`) — pola sama `kunciProduk()`
   di §29, tapi versi Bahan & Aksesoris (Kategori Utama + Nama + Warna,
   BUKAN Nama+Warna+Size seperti Produk).
4. **`HEADER_BAHAN_AKSESORIS`** (9 kolom wajib di atas) +
   **`unduhTemplateBahanAksesoris()`** — generate file
   `Template Import Bahan & Aksesoris.xlsx`, sheet
   `"Bahan & Aksesoris"`, isi 2 baris contoh (1 Bahan: "Katun Combed
   30s", 1 Aksesoris: "Resleting YKK").
5. **`FieldValidasiInline`** — component BARU (disalin), sel tabel yang
   bisa dikoreksi manual dengan saran fuzzy-match kalau nilai dari Excel
   tidak persis cocok ke opsi Config.
6. **`PopupImportBahanAksesoris`** — component BARU, popup tabel
   verifikasi 10 kolom (9 field wajib + status). Validasi per baris: 5
   field dropdown (Kategori Utama, Jenis — opsi tergantung Kategori
   baris itu, Warna, Satuan Pembelian, Satuan Pemakaian) divalidasi ke
   Config via `FieldValidasiInline`; Nama & 3 field numerik (Harga
   Pembelian, Isi Konversi Pembelian, Margin Modal) input polos. Baris
   yang kombinasi Kategori+Nama+Warna-nya SUDAH ADA di
   `daftarLama`/dobel di dalam file sendiri ditandai status "Dilewati"
   (bukan error, tapi tidak akan dibuat). Tombol "Import" aktif kalau
   semua baris berstatus valid (baik yang bakal dibuat maupun yang
   dilewati — tidak perlu semua baris baru). `konfirmasi()` menormalkan
   casing `kategori_utama` jadi persis `'Bahan'`/`'Aksesoris'` sebelum
   dikirim ke parent (field ini SATU-SATUNYA yang dinormalkan, karena
   `kategoriMasterData()`/`kunciPengaturanId()` di kode lama melakukan
   pengecekan `=== 'Aksesoris'` yang case-sensitive — field lain seperti
   Warna/Jenis/Satuan sengaja TIDAK dinormalkan, konsisten dengan
   perlakuan field-field itu di tempat lain di file ini).
7. **`BahanAksesorisListManager`** (List Bahan & Aksesoris) —
   ditambahkan: tombol dropdown "Import / Template Excel" di sebelah
   filter Kategori (2 pilihan: "Download Template", "Import Excel
   (Upload Massal)"); input file tersembunyi; `muatSemuaReferensiImport()`
   (memuat opsi Jenis Bahan, Jenis Aksesoris, Warna, Satuan dari Config +
   seluruh data lama lewat `ambilSemuaBahanAksesoris()`);
   `bukaTemplateBahanAksesoris()`, `pancingFileBahanAksesoris()`,
   `saatFileBahanAksesorisDipilih()` (baca sheet `"Bahan & Aksesoris"`),
   `tutupPopupImport()`; **`konfirmasiImportBahanAksesoris(barisSiap)`**
   — loop `for...of` baris yang TIDAK berstatus "Dilewati", tiap baris
   panggil `generateIdBerurutan(kategori)` (fungsi lama, sequential ID
   generator, dipanggil berurutan pakai `await` di dalam loop — BUKAN
   `Promise.all` paralel, sengaja biar urutan ID konsisten) lalu
   `addDoc()` ke `master_bahan_aksesoris` dengan payload field wajib
   saja (field lain — Rak/Volume/flag lot-tracking/Foto — otomatis
   kosong/default, HARUS diisi manual lewat Edit kalau diperlukan).
   Setelah selesai, alert ringkasan:
   `"Import selesai: X data baru ditambahkan, Y dilewati (sudah ada)."`
8. `index.html` — cache-bust `vue-bahan-aksesoris.js` `?v=17`.

**⚠️ Prasyarat sebelum import**: nilai Jenis, Warna, dan Satuan di file
Excel HARUS SUDAH terdaftar duluan di Config (Data Jenis Bahan/Aksesoris,
Data Warna, Data Satuan) — kalau belum ada, `FieldValidasiInline` akan
menandai baris itu belum valid dan menyarankan nilai terdekat, BUKAN
otomatis membuatkan opsi baru di Config.

**⚠️ Beda perilaku dari Import Master Produk (§28.9)**: fitur ini SKIP
data yang sudah ada (Kategori+Nama+Warna sama), TIDAK menimpa/update
seperti Import Master Produk yang defaultnya "Ganti Total". Ini pilihan
eksplisit Guru untuk fitur ini, bukan berarti Import Master Produk ikut
berubah.

**TIDAK ada Firestore Rules baru** untuk fitur ini (tetap koleksi
`master_bahan_aksesoris`/`pengaturan_id_bahan_aksesoris` yang sama, cara
tulis datanya saja yang bertambah jalur — bukan koleksi baru).

**Verifikasi**: `node --check` lolos di `vue-bahan-aksesoris.js`; tag
`<div>` `index.html` dicek seimbang (152/152, sama seperti sebelumnya).

**Status pengiriman**: device masih terputus dari bridge sepanjang sesi
ini (konsisten gagal) — dikirim via `SendUserFile` sebagai zip gabungan
terbaru (§29+§30+§31+§32+§33+§34+§35, 11 file — pertama kalinya
`vue-bahan-aksesoris.js` ikut dalam paket). Belum diuji langsung di live
oleh Guru — mohon dicoba skala kecil dulu (Download Template → isi 2-3
baris → Import) sebelum dipakai upload banyak data sekaligus.

## §36. Template BOM disesuaikan (sheet Komponen ganti sumber) + urutan field Jenis Produk dipindah (28 Agt 2026)

**Permintaan Guru** (verbatim, + file terlampir `Template Import BOM
1.xlsx`): "ini adalah template BOM yang saya inginkan bantu sesuaikan
urutannya di aplikasi" dan "satu lagi, urutan jenis produk pada menu
entry produk dan edit produk di pindah posisinya menjadi setelah foto
produk, jadi urutannya foto produk - jenis produk - nama produk - warna
- size".

**Analisis file Excel yang dikirim Guru** (dibaca lewat `openpyxl`,
dibandingkan programatik dengan `HEADER_JASA`/`HEADER_POLA`/
`HEADER_KOMPONEN`/`HEADER_AKSESORIS` yang ada di kode): sheet **Jasa**,
**Pola**, **Aksesoris** TERNYATA SUDAH PERSIS SAMA (urutan & nama kolom)
dengan yang ada di aplikasi — TIDAK ADA yang perlu diubah di 3 sheet
itu. HANYA sheet **Komponen** yang beda: kolom ke-5 di file Guru
judulnya cuma **"Komponen"** (bukan "Nama Komponen (Nama + Warna)"),
dan baris contohnya isi teks polos (mis. "BADAN BELAKANG", "TUTUP",
"MULUT", "SAKU SAMPING") — bukan format Nama+Warna Bahan & Aksesoris.

**Klarifikasi dilakukan (1 pertanyaan AskUserQuestion)** — sesuai
kebijakan proyek "jangan bikin tebak2": perbedaan header/isi sheet
Komponen ini BUKAN sekadar urutan kolom, tapi berpotensi konsekuensi
besar — apakah artinya sheet Komponen di Excel Import BOM ikut pindah
sumber ke Data Komponen (Config), KONSISTEN dengan dropdown "Kelola
Komponen" di form manual yang sudah diganti duluan (§34), atau cuma
judul kolomnya saja yang mau diringkas (isi tetap format Nama+Warna dari
Data Bahan & Aksesoris seperti keputusan §34 sebelumnya). Guru pilih
**"Ganti ke Data Komponen (Config)"** — ini MEMBATALKAN
(SUPERSEDE) bagian dari keputusan §34 yang eksplisit menyatakan Excel
sheet Komponen TETAP di Data Bahan & Aksesoris.

**File yang berubah**: `js/vue-master-produk.js` (v=8 → v=9) & `index.html`.

1. **`HEADER_KOMPONEN`** — kolom ke-5 diganti `'Nama Komponen (Nama +
   Warna)'` → `'Komponen'`. `contohKomponen` (buat `unduhTemplateBOM()`)
   disesuaikan (contoh isi: "Badan Belakang").
2. **`PopupImportBOM`** — prop BARU `opsiKomponen` (Data Komponen,
   Config) ditambahkan, terpisah dari `opsiNamaBahan` (Data Bahan &
   Aksesoris) yang masih dipakai tab Pola/Aksesoris. Mapping baris
   Komponen: `nama_komponen: String(b['Komponen'] || '').trim()` (dulu
   baca kolom `'Nama Komponen (Nama + Warna)'`). `statusKomponen()`:
   validasi SEKARANG `validasiPilihan(b.nama_komponen, props.opsiKomponen)`
   (dulu `props.opsiNamaBahan`), label pesan error diubah jadi "Komponen
   belum valid (cek Data Komponen di Config)". Template tab Komponen:
   `<field-validasi-inline>` sekarang `:opsi="opsiKomponen"` (dulu
   `opsiNamaBahan`), header kolom tabel jadi "Komponen" (dulu "Nama
   Komponen").
3. **`konfirmasiImportBOM`** (parent, `MasterProdukListManager`) — baris
   Komponen SEKARANG **TIDAK LAGI** di-`resolveBahan()` ke Data Bahan &
   Aksesoris. Payload disimpan langsung `{ nama_komponen: k.nama_komponen,
   qty: k.qty }` — SAMA PERSIS format baris dari form manual (§34), TIDAK
   ADA LAGI `bahan_aksesoris_id` di baris Komponen manapun (baik dari
   form maupun Excel). **Ini MENGHILANGKAN "konsekuensi 2 sumber beda"
   yang dicatat di §34/PETA-DATABASE.md poin 14** — sejak §36, format
   `nama_komponen` KONSISTEN di semua jalur (plain text dari Data
   Komponen), catatan itu sudah tidak berlaku lagi.
4. **`muatSemuaReferensiImport()`** — tambah `ambilDaftarNama('master_komponen')`
   ke `Promise.all`, hasilnya disimpan `opsiKomponenImport` (ref baru),
   dipassing ke `<popup-import-b-o-m :opsi-komponen="opsiKomponenImport">`.
5. **Data Produk Utama (Entry Produk & Edit Produk)** — urutan field
   dalam grid diubah: **Foto Produk → Jenis Produk → Nama Produk →
   Warna → Size** (sebelumnya Foto Produk → Nama Produk → Jenis Produk
   → Warna → Size). Foto Produk sendiri TETAP di posisi paling kiri
   (div terpisah, bukan bagian grid 4-kolom) — cuma urutan 4 field
   dalam grid yang ditukar (`Jenis Produk` dipindah sebelum `Nama
   Produk`). Berlaku OTOMATIS di Entry maupun Edit karena keduanya
   pakai `FormEntryProdukBOM` yang sama — MURNI perubahan tampilan,
   TIDAK ADA perubahan skema/field baru.

⚠️ **WAJIB isi dulu Data Komponen di Config (§33) SEBELUM import Excel
BOM yang ada sheet Komponennya** — nama komponen di Excel harus SUDAH
terdaftar di sana dulu, sama seperti syarat "Kelola Komponen" di form
manual (§34). File Excel format LAMA (kolom "Nama Komponen (Nama +
Warna)") TIDAK BISA dipakai langsung lagi untuk sheet Komponen — Guru
perlu download ulang Template BOM yang baru.

**TIDAK ada Firestore Rules baru** untuk perubahan ini (koleksi
`master_produk`/`master_komponen` yang sama, cara isi & urutan field
saja yang berubah).

**Verifikasi**: `node --check` lolos di `vue-master-produk.js`; tag
`<div>` `index.html` dicek seimbang (152/152, sama seperti sebelumnya);
perbandingan header sheet Jasa/Pola/Aksesoris vs file Excel Guru
diverifikasi programatik (Python, identik persis) sebelum menyimpulkan
cuma sheet Komponen yang perlu diubah.

**Status pengiriman**: device masih terputus dari bridge sepanjang sesi
ini (konsisten gagal) — dikirim via `SendUserFile` sebagai zip gabungan
terbaru (§29+§30+§31+§32+§33+§34+§35+§36, 11 file). Belum diuji langsung
di live oleh Guru — mohon dicoba dulu: isi Data Komponen di Config kalau
belum ada, download ulang Template BOM yang baru, coba isi 1 baris di
sheet Komponen lalu Import, dan cek urutan field di Entry Produk sudah
Foto-Jenis-Nama-Warna-Size.

## §37. Import / Upload Massal Excel di Data Komponen (Config) (28 Agt 2026)

**Permintaan Guru** (verbatim): "sekarang update fitur upload massal di
data komponen beserta dengan tampletnya".

**Keputusan desain (tanpa AskUserQuestion — cukup jelas dari kode &
preseden yang sudah ada, "jangan bikin tebak2" tetap dipatuhi karena
kedua poin di bawah SUDAH ditentukan oleh perilaku existing, bukan
pilihan baru yang perlu diklarifikasi)**:
1. **Isi Template** — Data Komponen cuma punya 2 field (`nama`,
   `keterangan`, sama seperti Data Satuan/Ukuran/Warna/dst), jadi
   Template otomatis cuma 2 kolom, tidak ada ambiguitas field mana yang
   wajib/opsional (beda dari kasus §35 yang field-nya banyak & perlu
   ditanya).
2. **Baris duplikat** — DILEWATI (skip), TIDAK ditimpa. Ini BUKAN
   pilihan baru yang perlu ditanya — fungsi `tambah()` manual di
   `MasterDataTabelManager` SUDAH SEJAK AWAL menolak nama dobel (alert
   "sudah ada di daftar", tidak pernah mengizinkan overwrite by-name),
   jadi Import ikut perilaku yang SUDAH ADA supaya konsisten (form
   manual & Import punya aturan sama), sekalian konsisten dengan
   preseden §35.

**Keputusan arsitektur — fitur ditulis GENERIK, bukan Komponen-only**:
`MasterDataTabelManager` (`vue-components.js`) dipakai BARENG oleh
SEMUA tab Config 2-kolom (Data Satuan/Ukuran/Warna/Jenis Bahan/Jenis
Aksesoris/Jenis Produk/Data Suplayer/Data Komponen — 8 tab total).
Daripada bikin komponen import khusus satu-off di `vue-config.js` HANYA
untuk Komponen, fitur Import Excel ditambahkan ke `MasterDataTabelManager`
itu SENDIRI lewat prop opt-in BARU `izinkanImportExcel` (default
`false` — TIDAK mengubah perilaku 7 tab lain sama sekali), dinyalakan
HANYA di `AppConfigKomponen`. Ini konsisten dengan pola ekstensi
`MasterDataTabelManager` yang SUDAH ADA sebelumnya (`field3Key`/
`field3Label` buat Suplayer, `tampilTabel` buat mode Config) — semuanya
opt-in per pemanggilan, backward-compatible. Konsekuensinya: kalau Guru
nanti mau fitur Import Excel yang sama di tab Config lain (mis. Data
Satuan/Warna), TIDAK perlu kode baru — tinggal nyalakan 1 baris prop di
tab itu.

**File yang berubah**: `js/vue-components.js` (import internal `?v=2`
→ `?v=3`), `js/vue-config.js` (`?v=3` → `?v=4`), `index.html`. Ikut
cache-bust (TANPA perubahan fungsional) di 3 file lain yang meng-import
`vue-components.js`: `js/vue-master-produk.js` (`?v=9`→`?v=10`),
`js/vue-bahan-aksesoris.js` (`?v=17`→`?v=18`), `js/vue-stock-pembelian.js`
(`?v=19`→`?v=20`) — ketiganya cuma import `DropdownCari` dari
`vue-components.js`, tidak dipakai fitur Import Excel ini, bumped murni
buat jaga-jaga cache browser.

1. **`vue-components.js`** — 3 helper BARU DISALIN dari
   vue-master-produk.js/vue-bahan-aksesoris.js (konvensi "disalin,
   bukan diimpor silang" tetap dipatuhi meski ini file SHARED — helper
   Excel-nya tetap copy lokal, bukan di-share lintas 3+ file itu):
   `bacaFileExcel()`, `ambilSheet()`, `unduhWorkbook()`.
2. **`PopupImportMasterData`** — component BARU, GENERIK (bukan
   Komponen-only), popup verifikasi SEDERHANA (SENGAJA tidak pakai
   `FieldValidasiInline`/Levenshtein seperti Import BOM/Bahan &
   Aksesoris — field Nama/Keterangan/field3 semuanya teks bebas, TIDAK
   ADA foreign-key/dropdown yang perlu divalidasi ke daftar lain).
   Status per baris: "Nama kosong" (invalid, blokir tombol Import),
   "Sudah ada, dilewati" (nama match ke `daftarLama`, case-insensitive),
   "Dobel di file ini, dilewati" (nama muncul >1x di file yang sama,
   cuma kemunculan pertama yang diproses), "Baru, akan ditambahkan".
   Tombol Import aktif kalau semua baris valid (kosong-nama saja yang
   blokir — duplikat/skip TIDAK blokir, sama pola §35).
3. **`MasterDataTabelManager`** — prop BARU `izinkanImportExcel`
   (default `false`). State/method BARU (semua di-gate `v-if=
   "izinkanImportExcel && bolehTambah"` di template): `dropdownImportTerbuka`,
   `inputFileImport`, `popupImportAktif`, `barisMentahImport`,
   `sedangImport`, `headerImport` (computed: `['Nama', ...(field3? [field3Label]
   : []), 'Keterangan']` — future-proof kalau nanti dinyalakan bareng
   `field3Key` di tab lain), `unduhTemplateImport()`, `pancingFileImport()`,
   `saatFileImportDipilih()` (baca sheet bernama `props.labelSingular`,
   mis. "Komponen"), `tutupPopupImport()`, `konfirmasiImport()` (loop
   `addDoc()` ke `props.koleksi` per baris baru, field `field3Key` ikut
   diisi kalau ada — meski Komponen sendiri tidak pakai field3). Tombol
   "Import / Template Excel" ditaruh di sebelah searchbox (row yang
   sama, flex).
4. **`vue-config.js`** — `AppConfigKomponen` template ditambah
   `:izinkan-import-excel="true"` (satu-satunya tab yang dinyalakan).

**TIDAK ada Firestore Rules baru** untuk perubahan ini (koleksi
`master_komponen` yang sama, cuma jalur tulis baru lewat Excel).

**Verifikasi**: `node --check` lolos (`vue-components.js` dicek 2 cara —
CommonJS `node --check` dan `node --input-type=module --check` karena
file ini pakai `export const` di top-level; `vue-config.js`,
`vue-master-produk.js`, `vue-bahan-aksesoris.js`, `vue-stock-pembelian.js`
juga lolos); tidak ada nama fungsi/const top-level dobel di
`vue-components.js` (dicek `grep` manual); tag `<div>` `index.html`
dicek seimbang (152/152, tidak berubah — tidak ada edit `<div>` ronde
ini).

**Status pengiriman**: device masih terputus dari bridge sepanjang sesi
ini (konsisten gagal) — dikirim via `SendUserFile` sebagai zip gabungan
terbaru (§29+§30+§31+§32+§33+§34+§35+§36+§37, 12 file — pertama kalinya
`vue-components.js` ikut dalam paket). Belum diuji langsung di live oleh
Guru — mohon dicoba dulu import beberapa nama komponen kecil (3-5 nama)
sebelum dipakai upload banyak data sekaligus.

## §38. Kode Webbing 2 & Kode Webbing 3 (BOM Aksesoris): dropdown ganti jadi input manual (28 Agt 2026)

**Permintaan Guru** (verbatim): "kode webbing 2 dan kode webbing 3 ganti
dengan field bukan drop down, jadi di input manual bukan di pilih".

**Klarifikasi dilakukan (1 pertanyaan AskUserQuestion)** — sesuai
kebijakan proyek "jangan bikin tebak2": field ini juga ada di Template &
Import Excel BOM (sheet Aksesoris), yang sekarang divalidasi ke Data
Bahan & Aksesoris (format Nama+Warna) — sama seperti dropdown di form.
Ditanya apakah perubahan ke input manual ini berlaku juga ke Excel
Import BOM, atau cukup form Entry/Edit Produk saja. Guru jawab: **"form
dan excel di ubah, termasuk judul di eksel di ganti. cukup Kode Webbing
2, Kode Webbing 3, (Nama + Warna) hapus"** — jadi KEDUANYA (form +
Excel) diganti, DAN judul kolom Excel-nya diringkas jadi cuma "Kode
Webbing 2"/"Kode Webbing 3" (suffix "(Nama + Warna)" dihapus).

**File yang berubah**: `js/vue-master-produk.js` (v=10 → v=11) & `index.html`.

1. **`barisAksesorisKosong()`** — `webbing2_pilih`/`webbing2_id` &
   `webbing3_pilih`/`webbing3_id` DIHAPUS, diganti `webbing2`/`webbing3`
   (string, langsung nilai final teks manual — pola sama seperti `pilih`
   di `barisKomponenKosong()` sejak §34).
2. **`saatPilihWebbing()`** — fungsi DIHAPUS TOTAL (tidak perlu resolve
   FK lagi).
3. **`FormEntryProdukBOM`** — mapping `dataAwal` (edit produk lama) baca
   `a.webbing2`/`a.webbing3` langsung (dulu `a.webbing2_nama`/
   `a.webbing3_nama`). `validasi()` — 2 baris pengecekan "harus dipilih
   dari daftar Bahan & Aksesoris" DIHAPUS (field opsional, tidak ada
   validasi format apapun sekarang). `simpan()` — payload
   `bomAksesorisSiap` SEKARANG `webbing2: (a.webbing2||'').trim(),
   webbing3: (a.webbing3||'').trim()` langsung (dulu `resolveBahan()` +
   `webbing2_id`/`webbing2_nama` dst). Template BOM Aksesoris tab: 2
   `<dropdown-cari>` diganti `<input type="text">` biasa, placeholder
   "Kode/catatan webbing 2/3...".
4. **`HEADER_AKSESORIS`** — kolom `'Kode Webbing 2 (Nama + Warna)'`/
   `'Kode Webbing 3 (Nama + Warna)'` diganti `'Kode Webbing 2'`/`'Kode
   Webbing 3'`. `contohAksesoris` (Template) disesuaikan.
5. **`PopupImportBOM`** — mapping baris Aksesoris baca kolom `'Kode
   Webbing 2'`/`'Kode Webbing 3'` (dulu dengan suffix "(Nama + Warna)").
   `statusAksesoris()` — 2 baris validasi `validasiPilihan(...,
   opsiNamaBahan)` buat webbing2/webbing3 DIHAPUS (sekarang selalu
   valid, teks bebas opsional). Tabel verifikasi popup TIDAK PERNAH
   menampilkan kolom Webbing 2/3 sejak awal (cuma dipakai buat validasi
   di belakang layar) — jadi TIDAK ADA perubahan tampilan tabel popup.
6. **`konfirmasiImportBOM`** (parent) — `bomAksesoris` mapping SEKARANG
   `webbing2: a.webbing2 || '', webbing3: a.webbing3 || ''` langsung
   (dulu `resolveBahan()` ke `daftarBahanImport` + `webbing2_id`/
   `webbing2_nama` dst, sama pola perubahan Komponen di §36).

**⚠️ Breaking buat file Excel LAMA**: file Excel BOM yang sudah disiapkan
Guru sebelum perubahan ini (sheet Aksesoris masih ada kolom "(Nama +
Warna)" di judul Kode Webbing) TIDAK BISA dipakai langsung lagi — header
kolom harus PERSIS cocok (aturan lama, tidak berubah). Guru perlu
download ulang Template BOM yang baru.

**Konsekuensi (sama pola seperti Komponen §34/§36)**: `webbing2`/
`webbing3` di `master_produk.bom_aksesoris[]` TIDAK LAGI tertaut ke item
Data Bahan & Aksesoris manapun (dulu jadi fondasi potong-stok-otomatis
ke depan untuk 2 field ini — sekarang konsep itu tidak berlaku lagi
khusus buat Kode Webbing 2/3, field lain di `bom_aksesoris[]` seperti
`bahan_aksesoris_id` [aksesoris utama] TIDAK berubah, tetap FK).

**TIDAK ada Firestore Rules baru** untuk perubahan ini (skema
`master_produk` yang sama, cuma cara isi 2 field ini yang berubah).

**Verifikasi**: `node --check` lolos; grep manual memastikan tidak ada
sisa referensi `webbing2_pilih`/`webbing3_pilih`/`webbing2_id`/
`webbing3_id`/`webbing2_nama`/`webbing3_nama`/`saatPilihWebbing` di kode
fungsional (cuma tersisa di komentar penjelasan); tag `<div>`
`index.html` dicek seimbang (152/152, tidak berubah).

**Status pengiriman**: device masih terputus dari bridge sepanjang sesi
ini (konsisten gagal) — dikirim via `SendUserFile` sebagai zip gabungan
terbaru (§29+§30+§31+§32+§33+§34+§35+§36+§37+§38, 12 file). Belum diuji
langsung di live oleh Guru — mohon dicoba isi 1-2 baris BOM Aksesoris
dengan Kode Webbing 2/3 (teks bebas), cek tersimpan benar di Edit
Produk, lalu coba juga lewat Import Excel dengan Template BOM yang baru.

## §39. Mobile responsif (form + tabel→Kartu) + riwayat tombol back HP sampai level Vue (28 Agt 2026)

**Trigger** (verbatim, Guru): "beberapa form di buka di hp field melayang
keluar dari main kota jadi harus geser ke kanan. sambil itu masih ingat
dengan tampilan mockup hp minta datanya kita diskusi dlu" — lalu
menunjuk file referensi lama `mockupformbomproduk.jsx`. Setelah diskusi
(dibangun 1 artifact mockup interaktif membandingkan pola Form
field-stacking dan Tabel-vs-Kartu pakai token desain Gechoo asli), Guru
memutuskan arah lewat pesan (verbatim): "Untuk tabel yang datanya
sederhana (Daftar Karyawan, Data Bahan & Aksesoris, List Order Belanja,
dst) — jadikan Kartu pola standar baru, di HP maupun desktop, mengikuti
List Produk. Untuk tabel yang MEMANG perlu banyak kolom kelihatan
sejajar sekaligus (Daftar Pesanan Pembelian — 14 kolom, Kartu Stok
Detail) — Scroll Horizontal + kolom beku yang sudah ada tetap
dipertahankan... Untuk semua FORM (bukan tabel) — field SELALU
ditumpuk 1 kolom penuh di HP, sejajar multi-kolom di layar besar." Lalu
diminta digabung sekalian dengan retrofit riwayat tombol back HP (§22.3,
sebelumnya cuma rencana, belum pernah diimplementasi) ke SEMUA file yang
disentuh, sampai ke level tab DI DALAM komponen Vue (bukan cuma level
HTML/sub-tab) — dikonfirmasi lewat AskUserQuestion, Guru pilih "Sampai
tab di DALAM layar Vue juga".

**Root cause bug mobile** (ditemukan lewat investigasi kode, bukan
tebakan): banyak elemen grid form punya inline
`style="...grid-template-columns:...;..."` BERSAMAAN dengan class
`class="grid-cols-1 md:grid-cols-N"` di elemen yang sama — inline style
SELALU menang atas class dengan specificity sama, jadi class
responsive-nya mati total, grid tetap multi-kolom bahkan di HP. Sudah
terdeteksi & terdokumentasi sebagian di komentar header
`vue-master-produk.js` (§28) yang secara eksplisit menyebut
`vue-bahan-aksesoris.js` dan `vue-order-spk.js` sebagai contoh file
bermasalah.

### Fondasi baru yang dibangun

1. **`js/vue-riwayat-tab.js`** (file BARU) — composable
   `pakaiRiwayatTabVue(namaUnik, tabRef)`, menyambungkan `ref()` tab
   internal Vue (mis. `const tab = ref('jasa')` di BOM Jasa/Pola/
   Aksesoris) ke sistem riwayat browser. Extend `window._riwayatNavAktif`
   (dipakai bareng level HTML) dengan array `vueTabs`. Restore lewat 2
   jalur: baca snapshot di setup() (baru pertama mount) + handler global
   `window['_restoreVueTab_'+namaUnik]` (komponen yang sudah ke-mount,
   karena app ini komponen Vue-nya sengaja tidak pernah dibongkar-pasang
   ulang, cuma disembunyikan CSS). Sengaja diimpor bareng (bukan
   disalin ke tiap file, beda dari konvensi biasa) karena logic
   restore/anti-loop-nya harus 100% identik di semua pemakainya.
2. **`js/dashboard.js`** — `pindahSubTab(grupKelas, targetId, tombolEl,
   opsi)` dapat parameter ke-4 baru `opsi={}`; `opsi.catatRiwayat:true`
   = opt-in dicatat ke riwayat back HP (default TETAP tidak dicatat,
   backward compatible — retrofit selalu opsional per menu, bukan
   mass-retrofit). Listener `popstate` sekarang restore 3 level
   berurutan: tab utama → subTabs (HTML) → vueTabs (Vue-internal,
   dipanggil PALING TERAKHIR supaya komponen tujuannya sudah pasti
   ke-mount duluan).
3. **`css/gechoo-design.css`** — utilitas baru: `.gc-row-nq` (row
   3-kolom asimetris Nama+Qty+tombol-hapus, 1 kolom di HP),
   `.gc-row-konversi` (row 5-kolom asimetris), `.gc-row-label` (label
   mini per-field, cuma tampil di HP). **Bug ditemukan & diperbaiki**:
   `.md\:grid{display:grid;}` TERNYATA belum pernah ada padahal sudah
   dipakai (`class="hidden md:grid"`) di `vue-bahan-aksesoris.js`
   (header desktop-only PopupKonversiBerjenjang) — akibatnya header itu
   SELALU hilang bahkan di desktop sejak dibuat. Ditemukan agen yang
   mengerjakan `vue-stock-pembelian.js`, diperbaiki di sini (ditambahkan
   ke blok `@media(min-width:768px)`).

### Per-file (22 file `vue-*.js` disentuh total, dikerjakan paralel lewat
sub-agent per kelompok, semua diverifikasi `node --check` + cek
keseimbangan tag `<div>` sebelum digabung)

**Form-fix + List→Kartu** (mengikuti pola persis `js/vue-bahan-
aksesoris.js`, dikerjakan lebih dulu sebagai contoh acuan): `vue-daftar-
karyawan.js` (prioritas Guru), `vue-rak-penyimpanan.js`, `vue-persiapan-
masalah.js`, `vue-order-spk.js`, `vue-device-kiosk.js`, `vue-account-
profile.js` (tabel Aju Banding Absensi), `vue-reimburse.js` (2 tabel:
Master Kendaraan + Riwayat Reimburse/Bensin/Servis).
`vue-stock-pembelian.js` (file terbesar, 2234 baris): 3 tabel→Kartu
(Alias Pembelian, List Order Belanja, Riwayat Cetak Label).

**Form-fix saja, tabel SENGAJA tetap Scroll+freeze** (matrix bulk-edit
atau butuh perbandingan sejajar, sesuai aturan eksplisit Guru):
`vue-hak-akses.js`, `vue-penjadwalan.js` (keduanya matrix checkbox+role/
jadwal massal), `vue-kartu-stok.js` (eksplisit disebut Guru — "Kartu
Stok Detail"), `vue-master-produk.js` (sudah jadi rujukan sejak §28,
cuma 2 instance grid ketinggalan diperbaiki pakai `.gc-row-nq` yang
ternyata belum pernah benar-benar dipakai). Di `vue-stock-pembelian.js`
juga: Daftar Pesanan Pembelian (14 kolom, eksplisit disebut Guru) +
Riwayat Harga Pembelian + picker Lot tetap Scroll.

**Form-fix saja, tidak ada tabel di file**: `vue-absensi-qr.js`,
`vue-antrean-absensi.js`, `vue-antrean-dakar.js`, `vue-antrean-
lembur.js`, `vue-camera.js`, `vue-home.js`, `vue-config-absensi.js`,
`vue-registrasi.js`, `vue-hak-akses.js`, `vue-penjadwalan.js`.

**Sengaja TIDAK disentuh strukturnya**: `vue-components.js` (komponen
list-editor reusable dipakai lintas layar via props — ubah strukturnya
berisiko merusak semua pemakainya, cuma diperiksa grid-nya, ternyata
tidak ada yang perlu diperbaiki juga). Template cetak nota/label
(string HTML mentah di `vue-stock-pembelian.js`, BUKAN tabel Vue) juga
sengaja tidak disentuh.

**Riwayat tab internal Vue di-wire** (pakai `pakaiRiwayatTabVue`):
`config-absensi-tab` (Master Gudang/Shift/Jenis Pekerjaan),
`akun-profil-tab` + `akun-profil-keamanan-subtab` (Account/Data
Karyawan/.../Keamanan, sampai child-tab Password/PIN), `reimburse-mode`
(jenisPengajuan: Umum/Bensin/Servis), `kartustok-tampilan` (Ringkasan/
Detail), `produk-bom-tab` (BOM Jasa/Pola/Aksesoris — use-case utama
composable ini dibuat). **Sengaja TIDAK di-wire** (dicek & dilaporkan,
bukan ditebak): wizard `tahap` di `vue-absensi-qr.js` (restore ref tanpa
efek samping kamera/timer berisiko bug baru di kiosk), tab di dalam
modal Import BOM (`vue-master-produk.js`, transient/sekali-pakai per
sesi import).

**Riwayat level HTML/sub-tab** — `data-target` + `{catatRiwayat:true}`
ditambahkan ke `index.html` (sidebar desktop: tombol Data Bahan &
Aksesoris [sudah lebih dulu], Persiapan Masalah, Stock & Pembelian,
Master Produk, Order SPK, + seluruh baris tab child di dalam
Config Absensi/Penjadwalan/Antrean Absensi/Antrean Lembur, Keuangan [6
tab], Daftar Karyawan/Antrean Dakar/Hak Akses, Stock & Pembelian [6 tab
child], Master Produk [2 tab child]) dan `js/vue-config-akses.js`
(DAFTAR_MENU — 21 entri `aksi()` untuk jalur tile Home mobile,
menyusul pola yang sama seperti `bahan_aksesoris_*` di §39 awal).
Menu yang isi-filenya TIDAK disentuh ronde ini (Riwayat All Absensi,
Config Karyawan, Config Info, Config Akses, Scan Opname/Persiapan,
WhatsApp/Mail Gateway) SENGAJA dilewati — kebijakan retrofit tetap
"opportunistic, bukan mass-retrofit".

**Verifikasi**: `node --check` lolos di ke-25 file JS yang diedit +
`index.html` dicek seimbang tag `<div>` (152/152). Satu file
(`vue-stock-pembelian.js`) sempat menunjukkan selisih 1 di skrip cek
otomatis — ditelusuri sampai akar: teks `<div>` di DALAM komentar kode
lama (baris ~1666, kalimat prosa menjelaskan arsitektur cetak QR),
BUKAN bug HTML sungguhan — dikonfirmasi manual per-template Vue (7
`template:` di file itu), semua seimbang.

**Belum bisa diklaim "sudah jalan"** — sandbox tidak bisa render
browser sungguhan/interaksi Firestore. Guru WAJIB coba manual: buka tiap
menu yang disebut di atas dari HP, pastikan field form tidak lagi
melayang keluar kotak, tabel yang dikonversi tampil sebagai kartu rapi
(data lengkap, tidak ada yang hilang), tabel yang sengaja dipertahankan
scroll masih bisa digeser normal, dan tombol back HP mundur ke tab/
sub-tab/tab-Vue sebelumnya alih-alih keluar aplikasi — terutama di BOM
Jasa/Pola/Aksesoris (Master Produk), Kartu Stok Ringkasan/Detail, dan
Reimburse Umum/Bensin/Servis (3 tempat riwayat Vue-internal paling
kompleks).

**File yang berubah** (25 JS + `css/gechoo-design.css` + `index.html`,
cache-bust version semua dibump — lihat masing-masing `?v=N` di
`index.html`): `js/dashboard.js`, `js/vue-config-akses.js`, `js/vue-
riwayat-tab.js` (baru), `js/vue-bahan-aksesoris.js`, `js/vue-absensi-
qr.js`, `js/vue-account-profile.js`, `js/vue-antrean-absensi.js`, `js/
vue-antrean-dakar.js`, `js/vue-antrean-lembur.js`, `js/vue-camera.js`,
`js/vue-components.js` (diperiksa, 0 perubahan), `js/vue-config-
absensi.js`, `js/vue-daftar-karyawan.js`, `js/vue-device-kiosk.js`,
`js/vue-hak-akses.js`, `js/vue-home.js`, `js/vue-kartu-stok.js`, `js/
vue-master-produk.js`, `js/vue-order-spk.js`, `js/vue-penjadwalan.js`,
`js/vue-persiapan-masalah.js`, `js/vue-rak-penyimpanan.js`, `js/vue-
registrasi.js`, `js/vue-reimburse.js`, `js/vue-stock-pembelian.js`.

**Status pengiriman**: dikirim 2 jalur — `SendUserFile` (zip 27 file)
DAN langsung ditulis ke folder `Data Yang Disiapkan` di komputer Guru
lewat device bridge (device online sepanjang sesi ini, semua 27 file
berhasil ditulis, tidak ada yang ditolak).

### §39.1. Bugfix: hard refresh paksa logout + drawer profile tidak tertutup saat logout (28 Agt 2026)

**Laporan Guru** (verbatim): "ada bug saat ctrl + shift + r pasti minta
keluar login" dan "saat klik logout, si drawer masih buka tidak
langsung tutup malah menu lainy jadi bisa dlklik". Kedua bug DITELUSURI
ke akar kode dulu (bukan tebakan) sebelum diperbaiki.

**Bug 1 — hard refresh (Ctrl+Shift+R) selalu minta login ulang**: akar
masalahnya di `js/auth.js` (`onAuthStateChanged`, blok fallback sesi
otomatis) — kalau Firebase belum sempat konfirmasi user dalam 1200ms,
kode LANGSUNG paksa ke layar Login, TANPA cek dulu apakah ada cache sesi
tersimpan (`localStorage.zevanic_konteks_sesi`). Hard refresh melewati
cache HTTP browser, jadi SEMUA modul (termasuk SDK Firebase Auth dari
CDN) diunduh ulang lewat jaringan — `onAuthStateChanged` jadi lebih
lambat dari 1200ms padahal sesinya (IndexedDB Firebase + localStorage)
sebenarnya masih valid, keduanya TIDAK ikut terhapus oleh hard refresh.
**Fix**: cek dulu `localStorage.getItem('zevanic_konteks_sesi')` — kalau
ADA cache, toleransi diperpanjang ke 6000ms (cukup buat unduh ulang
modul di koneksi lambat); kalau TIDAK ADA cache sama sekali (memang
belum pernah login/sudah logout), tetap cepat 1200ms.

**Bug 2 — drawer Profile mobile tidak tertutup saat logout**: 2 akar
masalah sekaligus. (a) `keluar()` di `js/vue-profile-drawer.js`
SEBELUMNYA cuma panggil `window.logout()` langsung, TIDAK PERNAH panggil
`tutup()` — drawer + link-link navigasinya tetap AKTIF selama
`signOut(auth)` berjalan (proses ASYNC, ada jeda beneran). (b) drawer
ini di-mount DI LUAR `#screen-dashboard` (sengaja, biar `position:fixed`
z-index tinggi bisa nutup seluruh layar) — akibatnya SAMA PERSIS seperti
bug lama `.gc-mobile-nav` yang sudah pernah diperbaiki: `pindahLayar()`
di `js/app.js` cuma sembunyikan `#screen-dashboard` dan isinya, TIDAK
otomatis ikut menutup drawer yang levelnya sejajar (sibling), bukan anak
dari `#screen-dashboard`. **Fix**: `keluar()` sekarang panggil `tutup()`
duluan sebelum `window.logout()` (umpan balik visual instan); dan
`pindahLayar()` di `js/app.js` sekarang JUGA memaksa tutup drawer
(lewat `window.tutupProfileDrawer()`, baru diekspos di `vue-profile-
drawer.js`) setiap kali pindah ke layar SELAIN dashboard — pola sama
persis dengan penanganan `.gc-mobile-nav` yang sudah ada di fungsi yang
sama, jadi jaring pengaman ini otomatis berlaku untuk SEMUA jalur pindah
layar ke depan, bukan cuma logout.

**File yang berubah**: `js/auth.js` (v2→v3), `js/app.js` (belum
versioned→v2), `js/vue-profile-drawer.js` (v2→v3), `index.html`.

**Verifikasi**: `node --check` lolos di ke-3 file; tag `<div>` di
`vue-profile-drawer.js` & `index.html` dicek tetap seimbang (tidak ada
markup yang diubah, cuma logic JS).

**Belum diuji manual** — sandbox tidak bisa reproduce Ctrl+Shift+R atau
klik sungguhan. Guru tolong dites: hard refresh browser HP/desktop
berkali-kali (pastikan tidak lagi kelempar ke Login kalau sedang login),
dan klik Logout dari drawer mobile (pastikan drawer langsung
tertutup/redup dan menu di baliknya tidak bisa diklik selama proses
logout berjalan).

**UPDATE (28 Agt 2026, akar sebenarnya ketemu lewat log diagnostik)**:
dugaan timeout 1200ms di atas TERNYATA cuma sebagian gambaran — Guru
konfirmasi refresh biasa (bukan cuma Ctrl+Shift+R) juga kena, dan sedang
Clock In + dalam jam shift saat itu. Log diagnostik yang ditambahkan
(`[Sesi Otomatis] GAGAL: ...`) langsung menunjuk akar sebenarnya:

```
[Sesi Otomatis] GAGAL: cekMasihJamKerja() bilang di luar jam shift ...
nama_shift di profil = "SHIFT OWNER" -> balik ke Login.
```

Shift Guru: **"SHIFT OWNER" 09:00–08:59** (nyaris 24 jam, sengaja
dirancang biar Owner "kerja terus"). Bug direproduksi sekitar jam 01:00
dini hari WIB. **Akar masalah**: `window.cekMasihJamKerja()` (`js/
auth.js`) SEBELUMNYA cuma membangun SATU jendela waktu: [HARI INI
jam_masuk, (besok kalau nyebrang tengah malam) jam_keluar]. Pas dini
hari SEBELUM jam_masuk hari ini (mis. jam 01:00, sebelum jam 09:00),
`mulai` dihitung "HARI INI jam 09:00" — itu BELUM terjadi — padahal
yang sungguh berlaku saat itu adalah shift yang mulai KEMARIN jam 09:00
dan baru berakhir HARI INI jam 08:59. Fungsi lama tidak pernah menengok
ke belakang ke jendela kemarin, jadi SELALU gagal di jam-jam dini hari
untuk shift model nyebrang-tengah-malam seperti ini — match persis
"bukan cuma hard refresh, refresh biasa juga kena", karena ini soal
LOGIKA WAKTU, bukan soal kecepatan loading sama sekali.

**Fix**: `cekMasihJamKerja()` sekarang membangun DUA jendela sekaligus
(mulai hari ini, DAN mulai kemarin) lewat helper `bikinJendela(offsetHari)`
— lolos kalau waktu sekarang masuk SALAH SATU jendela. Ditambah log
diagnostik lebih rinci (isi kedua jendela + waktu sekarang) untuk kasus
gagal ke depan. Dicek: `cekMasihJamKerja` cuma didefinisikan & dipakai
1 tempat (`js/auth.js`), tidak ada logic duplikat di `vue-login.js` atau
file lain yang perlu ikut diperbaiki.

**File berubah**: `js/auth.js` (v4→v5), `index.html`.

**Verifikasi**: `node --check` lolos.

**Belum diuji manual** — Guru tolong coba refresh lagi sekarang (kalau
masih dalam jam shift nyebrang-tengah-malam seperti tadi) untuk
konfirmasi fix ini benar menutup celahnya.

---

## §41.1 — Redesign Kartu "List Produk" (28 Agt 2026)

**Permintaan Guru** (verbatim): "bantu redesign kartu list produk, saya
takjub dengan kartu list bahan & aksesoris ada foto juga" — Guru terkesan
dengan kartu "List Bahan & Aksesoris" (dibangun di §39: foto thumbnail,
header row, mini-grid stat, blok `kartu-rows` ivory-dim) dan minta kartu
"List Produk" (yang sudah ada foto tapi masih layout flat 1 baris)
diupgrade ke kualitas visual yang sama.

**Lokasi**: `js/vue-master-produk.js`, komponen `MasterProdukListManager`
(halaman List Produk), template kartu di dalam blok `v-else` (dulu baris
~1626-1645).

**Riset model data produk** (`master_produk`) sebelum desain — field yang
tersedia per item: `nama`, `sku` (auto-generate dari Nama-Warna-Size),
`jenis_produk`, `warna`, `size`, `foto`, `dibuat_pada`/`dibuat_oleh`,
`diedit_pada`/`diedit_oleh` (diisi konsisten dari 4 jalur simpan: form
manual `FormEntryProdukBOM`, import Excel Produk Utama, import Excel BOM),
dan 3 array BOM: `bom_jasa[]` (nama+harga), `bom_pola[]` (tipe
internal/vendor, nama_pola, bahan, panjang, isi_pola_pcs, jasa_cutting,
jasa_serie, jenis_vendor, `komponen[]`), `bom_aksesoris[]` (tahap_proses,
aksesoris, qty, satuan, webbing2/3). Tidak ada field harga/total tersimpan
di level produk — dihitung on-the-fly dari BOM di kartu (lihat di bawah).

**Desain baru** — mengikuti pola 4-bagian List Bahan & Aksesoris persis:

1. **Header row**: checkbox pilih massal (kalau `bolehHapus`) + foto 52x52
   (atau placeholder ikon baju kalau belum ada foto — dulu tidak ada
   fallback ikon, foto kosong = ruang kosong) + nama produk (bold) +
   subtitle Warna · Size + baris kecil "SKU: ..." + tag chip `jenis_produk`
   di kanan (dulu tidak ditampilkan sama sekali di kartu, sekarang jadi tag
   seperti kategori di kartu Bahan).
2. **Mini-grid stat (2 kol mobile / 4 kol desktop)**: "Jasa" (total Rp dari
   `bom_jasa` + jumlah layanan — dihitung fungsi baru `totalHargaJasa()`,
   BARU: dulu cuma jumlah baris, sekarang ada estimasi biaya), "Pola" (total
   + breakdown internal/vendor — fungsi baru `hitungBreakdownPola()`, dulu
   cuma 1 angka gabungan "Pola/Vendor"), "Aksesoris" (jumlah item), "Komponen"
   (total komponen di semua pola gabung — fungsi baru `totalKomponenPola()`,
   info yang SEBELUMNYA sama sekali tidak terlihat dari kartu List Produk).
3. **Blok `kartu-rows` ivory-dim**: "Dibuat" (tanggal + oleh) dan "Diedit
   Terakhir" (tanggal + oleh, atau "Belum pernah" kalau belum pernah
   diedit) — metadata yang sebelumnya tidak ditampilkan sama sekali di UI
   List Produk (cuma tersimpan di Firestore, tidak terlihat siapa yang
   terakhir ubah data produk).
4. **Tombol aksi**: Edit + Hapus (kalau `bolehHapus`) — sama seperti
   sebelumnya, cuma diberi ikon (pen/trash) + full-width sejajar seperti
   kartu Bahan.

**Fungsi helper baru** (module-level, di atas `MasterProdukListManager`,
polanya disalin dari `formatRupiah` di `vue-bahan-aksesoris.js` — tiap
file `vue-*.js` di proyek ini punya salinan lokal sendiri, tidak ada util
currency global): `formatRupiah(n)`, `hitungBreakdownPola(item)`,
`totalHargaJasa(item)`, `totalKomponenPola(item)`. Diekspos lewat
`return {...}` di `setup()` supaya bisa dipanggil dari template.

**Dipertahankan dari versi lama** (fitur bulk-select §39 tidak boleh
hilang): checkbox `produkTerpilih`/`toggleCentang`, "Pilih semua di
halaman ini" (`semuaTercentang`/`toggleSemua`), tombol "Hapus Massal"
(`hapusMassal`) — semuanya tetap terhubung ke variabel/fungsi yang sama,
cuma checkbox-nya sekarang di header row kartu (dulu di kiri kartu
sejajar seluruh baris).

**File berubah**: `js/vue-master-produk.js` (v12→v13), `index.html`.

**Verifikasi**: `node --check` lolos; hitung keseimbangan tag `<div>`
(regex) = 0 (seimbang).

**Delivery**: dikirim ke chat (zip) DAN langsung ditulis ke komputer Guru
di `F:\ZEVANIC HOUSE\FOUNDATION\Data Yang Disiapkan\` (kedua file:
`js/vue-master-produk.js` dan `index.html`).

**Belum diuji manual** — Guru tolong cek tampilan kartu List Produk di HP
maupun desktop, pastikan foto/placeholder ikon tampil benar, angka BOM
(Jasa/Pola/Aksesoris/Komponen) sesuai data produk yang ada, checkbox pilih
massal & Hapus Massal masih berfungsi seperti sebelumnya.

**UPDATE (28 Agt 2026, koreksi cepat)** — Guru cek dan bilang: "untuk text
dibuat dan diedit saya kurang setuju, apa yah??" (minta saran ganti). Blok
`kartu-rows` "Dibuat"/"Diedit Terakhir" **DIGANTI ISINYA** (bukan cuma
teks) jadi info produksi: **"Pola Utama"** (baris pertama `bom_pola` —
nama_pola + tag Internal/Vendor, plus "+N lainnya" kalau bom_pola > 1) dan
**"Bahan Utama"** (nama+warna bahan pola itu) — fungsi baru `polaUtama(item)`
di `js/vue-master-produk.js`, diekspos ke template. Info ini lebih relevan
buat kartu produksi dan sebelumnya SAMA SEKALI tidak kelihatan dari List
Produk (harus buka Edit dulu buat tahu pola/bahan apa yang dipakai).
`js/vue-master-produk.js` v13→v14.

---

## §41.2 — Cetak Label pindah ke List Bahan & Aksesoris + Ukuran 4x2 Thermal (28 Agt 2026)

**Permintaan Guru** (verbatim, 3 bagian dalam 1 pesan):
1. "pada stock & pembelian > cetak label pindahkan ke data bahan &
   aksesoris > list bahan dan aksesoris"
2. "itu ukuran cetak berapa yah?? bisa bikin menu ga sebelum cetak? untuk
   desainya cetaknya, ukuran yg kita pakai 4x2 dan thermal roll"
3. Follow-up setelah AskUserQuestion: revisi ukuran 4x2 berlaku untuk
   **SEMUA 3 tempat cetak label** di app ini (Bahan & Aksesoris, Roll Order
   Belanja, Order SPK) — bukan cuma satu.

**Jawaban ukuran cetak SEBELUMNYA (dicek langsung ke kode dulu, sesuai
prinsip "jangan bikin tebak2")**: ternyata BELUM PERNAH didesain khusus
buat label fisik sama sekali. Ke-3 tempat cetak label (Cetak Label Bahan/
Aksesoris, Cetak Label Roll Nota Order Belanja, Cetak Label Order SPK)
pakai CSS yang SAMA PERSIS (disalin 3x, beda file) — kotak lebar 280px
(~7,4cm) dashed border, TANPA aturan ukuran kertas (`@page`) sama sekali,
ikut ukuran kertas default printer (biasanya A4), banyak label per
halaman. Ini akar yang dirombak di bawah.

**Keputusan desain via AskUserQuestion (Guru pilih)**:
- Teks kartu "Dibuat"/"Diedit" List Produk → **Ganti isinya** (lihat §41.1
  UPDATE di atas).
- Pindah Cetak Label → **Tombol di tiap kartu List** Bahan & Aksesoris
  (bukan tab pencarian terpisah yang cuma dipindah lokasi) — tab "Cetak
  Label" lama di Stock & Pembelian **DIHAPUS TOTAL**.
- Ukuran 4x2 thermal → **berlaku untuk SEMUA 3 tempat cetak** (direvisi
  Guru dari jawaban awal "cuma Bahan & Aksesoris").
- Menu sebelum cetak → **Pratinjau** + **Config print (data apa yang mau
  diprint)**.

### Komponen baru: `PopupPratinjauCetakLabel` (js/vue-components.js)

Popup GENERIK dipakai BARENG di ke-3 tempat cetak (bukan 3 implementasi
terpisah) — kontrak props `daftarLabel: [{kode, nama, info, qrDataUrl}]`
(QR di-generate DULUAN oleh pemanggil lewat `buatQrDataUrl()`, pola sinkron
yang sudah terbukti jalan, popup sendiri TIDAK menggambar QR). Isinya:
- **Pratinjau visual** — tampilkan sampai 3 label pertama dalam kotak
  proporsional (+ "N label lainnya" kalau lebih), supaya kelihatan
  bentuknya SEBELUM benar-benar cetak.
- **Config print** (checkbox) — "Tampilkan Nama Barang" & "Tampilkan Info
  (qty/tanggal)" — QR+kode SELALU tampil (itu intinya, biar tetap bisa
  discan). Ini jawaban permintaan Guru "config print... data apa yg mau
  diprint".
- **Jumlah Salinan per Label** — angka input, mengulang TIAP label yang
  dikirim N kali di halaman cetak (bukan andalkan dialog "copies" printer
  bawaan — lebih pasti kejadian di printer thermal).
- **Cetak Sekarang** — buka window print baru dengan CSS
  `@page { size: 4in 2in; margin: 0; }` + `.label-cetak{width:4in;
  height:2in; ...; page-break-after:always;}` (1 label = 1 lembar fisik,
  GANTI TOTAL dari kotak dashed banyak-per-halaman kertas biasa yang lama).
  Emit event `cetak` (payload jumlahSalinan/tampilNama/tampilInfo) SETELAH
  window dibuka, supaya pemanggil bisa tindak lanjut sendiri (misal catat
  log) — logging SENGAJA TIDAK jadi tanggung jawab popup ini karena
  beda-beda per pemanggil (cuma Bahan/Aksesoris yang catat log).

### Cetak Label pindah ke `js/vue-bahan-aksesoris.js` (`BahanAksesorisListManager`)

- Tombol **"Cetak Label"** BARU di tiap kartu List (sejajar Edit/Hapus,
  ikon printer). Klik: kalau `item.pakai_lot_tracking`, buka popup pilih
  roll/lot dulu (checkbox tabel, "Pilih Semua"/"Kosongkan", SEMUA status
  aktif+habis biar bisa cetak ulang label hilang — logic SAMA PERSIS
  `CetakLabelManager` lama) → tombol "Lanjut ke Pratinjau" bawa yang
  dicentang ke `PopupPratinjauCetakLabel`. Kalau BUKAN lot-tracking,
  LANGSUNG ke pratinjau (1 label, QR isi `id_tampil`).
- **Riwayat Cetak Label** — dulu SELALU tampil sebagai tabel di bawah form
  (menu tersendiri). SEKARANG jadi **modal on-demand** (tombol di toolbar
  atas, sebelah "Import / Template Excel") — datanya (koleksi
  `log_cetak_label`) TIDAK hilang, cuma cara lihatnya diringkas supaya
  halaman List (sudah ramai: search, filter, import, banyak kartu) tidak
  makin penuh. Keputusan desain saya sendiri (bukan tebakan soal DATA,
  cuma soal PENEMPATAN UI) — Guru boleh minta diubah kalau kurang pas.
- Fungsi baru: `buatQrDataUrl()` (disalin, konvensi proyek), `bukaCetakLabel()`,
  `lanjutCetakDariRoll()`, `saatCetakBerhasil()` (catat log SETELAH cetak
  fisik terbuka), `bukaRiwayatCetak()` (lazy-load paginasi log pas modal
  dibuka pertama kali).
- Import BARU dari `js/vue-stock-pembelian.js`: `ambilSemuaLotByBahan()` &
  `catatLogCetakLabel()` — DULU privat di `CetakLabelManager` (dihapus),
  SEKARANG `export`ed (koleksi `lot_bahan_aksesoris`/`log_cetak_label`
  TETAP "dimiliki" vue-stock-pembelian.js, pola sama seperti fungsi lot
  lain yang sudah diimpor lintas file oleh vue-kartu-stok.js/vue-scan-
  opname.js/vue-scan-persiapan.js).

### Izin akses — id menu LAMA dipertahankan (keputusan penting)

Tombol Cetak Label yang baru TETAP mengecek izin lewat menu id LAMA
`stock_cetak_label` (BUKAN bikin id baru di bawah `bahan_aksesoris_list`).
Alasan: kalau pakai id baru, SEMUA Hak Akses yang SUDAH Owner atur
sebelumnya (siapa boleh cetak) akan otomatis KOSONG lagi (default-deny)
begitu kode ini naik, dan Owner harus set ulang manual. Dengan
mempertahankan id lama, izin yang sudah ada TETAP JALAN tanpa perlu apa-apa
dari Owner. Entry `stock_cetak_label` di `DAFTAR_MENU`
(`js/vue-config-akses.js`) ditandai **`deprecated: true`** (pola SAMA
PERSIS `master_suplayer`, §26.1) — artinya: TIDAK LAGI tampil sebagai tile
navigasi di Home mobile/sidebar (`aksi()` dihapus, sudah tidak ada tab
tujuan), TAPI TETAP tampil di tabel permission Config Akses (baris
`menuUntukKategori()` TIDAK filter `deprecated`) supaya Owner masih bisa
lihat/atur kolom izinnya kalau perlu.

### Dibersihkan (tab & mount lama dihapus total)

- `js/vue-stock-pembelian.js`: `CetakLabelManager`, `AppCetakLabel`,
  `window.pastikanMountCetakLabel`, `MENU_ID_CETAK_LABEL` — semua DIHAPUS.
  `cetakLabelLot()` (Nota Order Belanja > "Cetak Label Roll") DIROMBAK
  jadi closure yang buka `PopupPratinjauCetakLabel` (dulu langsung
  `window.print()`).
- `index.html`: tombol tab "Cetak Label" + `<div id="sub-zh-stock-
  cetaklabel">`/`<div id="vue-cetak-label">` di bawah Stock & Pembelian
  DIHAPUS. `stock_cetak_label` juga dihapus dari `data-menu-ids` tombol
  sidebar "Stock & Pembelian" (grup itu sekarang cuma referensi 3 sub-menu
  yang tersisa).
- `js/dashboard.js`: mapping `'sub-zh-stock-cetaklabel':
  'pastikanMountCetakLabel'` dihapus dari `PETA_MOUNT_SUBTAB`.
- `js/vue-header-mobile.js`: mapping label `'sub-zh-stock-cetaklabel':
  'Cetak Label'` dihapus.

---

## §41.3 — Cetak Label Order SPK ikut dirombak ke 4x2 Thermal (28 Agt 2026)

Bagian dari revisi Guru "ini revisi untuk semuanya yah" (§41.2 di atas) —
`cetakSpkList()` di `js/vue-order-spk.js` DULU fungsi modul biasa yang
LANGSUNG `window.print()` (kotak dashed banyak-per-halaman kertas biasa,
CSS disalin identik dari `vue-stock-pembelian.js`). SEKARANG jadi closure
DI DALAM `OrderSpkManager.setup()` (butuh set state reactive popup lokal) —
siapkan `daftarLabelPreview` (QR digambar sinkron seperti sebelumnya) lalu
buka `PopupPratinjauCetakLabel` (komponen BARU, dipakai BARENG §41.2) —
sama-sama dapat pratinjau + config print + jumlah salinan + cetak ukuran
4x2 inch. Dipakai 2 tempat SAMA seperti sebelumnya: tombol "Simpan +
Cetak" (form entry) & tombol "Cetak"/"Cetak (N)" (tabel, checkbox multi-
select). TETAP SENGAJA TIDAK menulis ke `log_cetak_label` (koleksi itu
domainnya khusus label Bahan/Aksesoris, field `nama_barang` — beda skema,
keputusan lama §26.6 tidak diubah).

**File berubah (§41.2 + §41.3 digabung, 1 batch pengiriman)**:
`js/vue-components.js` (BARU: `PopupPratinjauCetakLabel`),
`js/vue-stock-pembelian.js` (v21→v22), `js/vue-order-spk.js` (v3→v4),
`js/vue-bahan-aksesoris.js` (v19→v20), `js/vue-config-akses.js` (v4→v5),
`js/dashboard.js` (v15→v16), `js/vue-header-mobile.js` (v1→v2),
`js/vue-master-produk.js` (v13→v14, lihat §41.1 UPDATE), `index.html`.

**Verifikasi**: `node --check` lolos di SEMUA file proyek (bukan cuma yang
diedit — sapuan penuh). Keseimbangan tag `<div>` (regex) = 0 di semua file
yang markup-nya disentuh, KECUALI 2 false-positive JINAK yang SUDAH
dikonfirmasi (bukan bug nyata): `js/vue-stock-pembelian.js` (komentar lama
berisi teks "`<div>` tersembunyi") dan `js/vue-bahan-aksesoris.js`
(komentar BARU sesi ini, "ke `<div>` tersembunyi di window") — keduanya
teks di dalam komentar kode `//`, bukan markup sungguhan.

**Delivery**: dikirim ke chat (zip, 9 file) DAN langsung ditulis ke
komputer Guru di `F:\ZEVANIC HOUSE\FOUNDATION\Data Yang Disiapkan\`.

**Belum diuji manual sama sekali** — terutama bagian FISIK (cetak
sungguhan ke printer thermal 4x2, scan QR hasil cetak) TIDAK BISA
diverifikasi dari sandbox ini. Guru WAJIB tes langsung sebelum dipakai
produksi:
1. Cetak Label dari kartu List Bahan & Aksesoris (item biasa DAN item
   dengan Qty per Roll/Lot) — cek pratinjau, checkbox Nama/Info, Jumlah
   Salinan, lalu cetak sungguhan ke printer thermal — pastikan pas di
   label fisik 4x2 (tidak kepotong/kekecilan).
2. Cetak Label Roll di Nota Order Belanja (setelah Nota di-final-kan, ada
   roll baru).
3. Cetak Label di Order SPK ("Simpan + Cetak" & "Cetak" tabel).
4. Konfirmasi Hak Akses yang SUDAH diatur Owner sebelumnya (siapa boleh
   cetak) MASIH JALAN seperti biasa di lokasi tombol yang baru (List Bahan
   & Aksesoris) — id menu-nya sengaja dipertahankan `stock_cetak_label`,
   tapi tetap perlu dikonfirmasi nyata.
5. Riwayat Cetak Label (modal, tombol di toolbar List Bahan & Aksesoris)
   — cek data lama (dari CetakLabelManager sebelumnya) masih kebaca normal.

---

## §42 — Fix bug SyntaxError List/Entry Bahan & Aksesoris blank + Order SPK disambungkan ke Master Produk via SKU + field Kelipatan (28 Agt 2026)

### §42.1 — BUG: Entry & List Bahan & Aksesoris blank total (form/table tidak muncul)

**Laporan Guru (verbatim)**: "ada bug pada menu entry bahan & aksesoris dan
list bahan & aksesoris form atau table tidak muncul."

**Root cause (diverifikasi LANGSUNG di live `gechoo.online` lewat browser,
BUKAN tebakan)**: satu pasang backtick (`` ` ``) yang TIDAK di-escape,
nyempil di dalam komentar HTML (`<!-- ... -->`) di tengah template Vue
`BahanAksesorisListManager` (js/vue-bahan-aksesoris.js, baris ~1722, teks
komentar "cuma muncul buat item `pakai_lot_tracking`." — ditulis sesi
sebelumnya waktu nambah fitur Cetak Label §41.2). Karena SELURUH properti
`template:` komponen Vue itu sendiri adalah 1 template-literal JS (dibuka
`` ` `` di awal, ditutup `` ` `` di akhir), backtick nyasar di tengah situ
memotong string itu lebih awal — hasilnya `SyntaxError: Unexpected
identifier 'pakai_lot_tracking'` pas file di-parse browser sebagai ES
module. SATU baris rusak ini bikin SELURUH file gagal di-`import`, makanya
BUKAN cuma List yang blank — Entry ikut blank juga (satu file, satu
kegagalan module, `window.pastikanMountBahanAksesorisEntry` DAN
`...List` sama-sama tidak pernah terbentuk).

**Kenapa lolos verifikasi sesi sebelumnya**: `node --check nama-file.js`
(dipakai sesi lalu sebagai sapuan akhir) TERNYATA parse file `.js` polos
sebagai **CommonJS script**, BUKAN ES module — jadi tidak menangkap error
ini. Baru ketahuan setelah dicoba ulang paksa mode ES module (ganti
ekstensi jadi `.mjs` sebelum `node --check`, PERSIS behavior browser
`<script type="module">`) — error muncul di baris & pesan yang SAMA PERSIS
dengan yang dilaporkan browser live. **Sesi ini & seterusnya: sapuan akhir
`node --check` WAJIB pakai mode ES module** (bukan `.js` polos) supaya
kelas bug ini ketangkap dari awal, bukan nunggu laporan Guru.

**Fix**: ganti 2 backtick nyasar itu jadi kutip satu biasa (`'...'`) — isi
komentar TIDAK berubah maknanya, cuma tanda kutipnya. **Diverifikasi**:
sapuan `node --check` mode ES-module ke SEMUA file `.js` di proyek (bukan
cuma yang disentuh) — SEMUA lolos, termasuk file ini. Tidak ditemukan pola
backtick-nyasar-di-komentar serupa di file lain manapun di proyek ini.

**File berubah**: `js/vue-bahan-aksesoris.js` (v20→v21, cuma baris ini —
TIDAK ada perubahan fitur/logic lain).

---

### §42.2 — Order SPK disambungkan ke Master Produk lewat SKU + field baru "Kelipatan" (acuan minimal order)

**Permintaan Guru (verbatim)**: "lalu pada order spk bantu sambungkan
dengan master produk > sku yah" + "tambahkan juga pada data produk utama
field kelipatan nb kelipatan ini tarikan dari kelipatan terkecil dari isi
pola dari semua nama pola, jadi nanti ada anjurannya berapa yg digunakan
berapa. karena pas di order spk itu harus diinfoakan disamping qty order
sebagai acuan minimal order"

**Field baru "Kelipatan" (Data Produk Utama, `js/vue-master-produk.js`)**:
"Kelipatan terkecil dari isi pola" = istilah matematika Indonesia **KPK
(Kelipatan Persekutuan Terkecil = LCM)**, BUKAN FPB/GCD — dikonfirmasi dari
konteks kalimat Guru sendiri ("kelipatan TERKECIL... dari SEMUA nama
pola"). Tiap baris BOM Pola (`bom_pola`) punya `isi_pola_pcs` ("hasil
potong per pcs produk" untuk pola itu) — misal Pola A hasil 12 pcs/potong,
Pola B hasil 8 pcs/potong: qty produksi/order HARUS kelipatan KPK(12,8) =
24 pcs supaya SEMUA pola bisa dipotong genap tanpa sisa (tidak ada pola
yang "motong setengah" karena qty tidak pas dengan salah satu pola).
Baris dengan Isi Pola (Pcs) kosong/0 (mis. baris Vendor yang belum diisi)
DIABAIKAN dari hitungan, tidak menggagalkan baris lain.

- Fungsi baru (module-level, `js/vue-master-produk.js`): `gcd2()`,
  `lcm2()`, `hitungKelipatan(bomPola)`.
- Live-preview di form Entry/Edit Produk: field readonly baru "Kelipatan"
  di sebelah field SKU (computed `kelipatanLive`, reactive ke
  `form.bom_pola` — update otomatis tiap Isi Pola (Pcs) diketik ulang).
- Disimpan PERMANEN ke field `kelipatan` (number) di dokumen
  `master_produk` tiap kali produk disimpan (pola sama seperti
  `harga_modal`/`volume_barang` — computed tapi disimpan, supaya Order SPK
  bisa baca langsung tanpa hitung ulang BOM).
- List Produk (kartu): baris baru "Kelipatan (Acuan Order)" di blok
  `kartu-rows`, baca `item.kelipatan` langsung (tidak dihitung ulang di
  List).
- **Firestore Rules**: TIDAK butuh rules baru — koleksi `master_produk`
  yang sama, sudah live & dipublish sebelumnya.

**Sambungan Order SPK ↔ Master Produk (`js/vue-order-spk.js`)**:
- Field baru **opsional** `sku_produk` di form & dokumen `order_spk` (FK
  ke `master_produk.sku`) — SENGAJA opsional, SPK migrasi spreadsheet lama
  yang produknya belum tentu ada di Master Produk TETAP bisa isi "Nama
  Produk/Keterangan" manual seperti biasa tanpa terhubung SKU manapun.
- Field baru di form: "Pilih Produk (SKU)" — `DropdownCari` (diimpor dari
  `vue-components.js`, BARU dipakai file ini) isi daftar
  "SKU — Nama Warna Size" semua produk (`ambilSemuaProduk()`, di-`export`
  BARU dari `js/vue-master-produk.js`, diimpor bare/lintas file — dulu
  fungsi ini privat, cuma dipakai cek dobel Import Excel). Begitu produk
  dipilih: `sku_produk` keisi, DAN "Nama Produk/Keterangan" OTOMATIS
  terisi dari Nama+Warna+Size produk itu (TETAP bisa diedit manual
  sesudahnya, bukan dikunci readonly). Tombol "Lepas Sambungan SKU" buat
  lepas sambungan tanpa hapus teks Nama Produk yang sudah terisi.
- **"Acuan Minimal Order" di samping Qty Target** (permintaan eksplisit
  Guru: "diinfoakan disamping qty order") — begitu produk terhubung PUNYA
  `kelipatan` > 0, muncul teks di bawah field Qty Target: "Acuan Minimal
  Order: kelipatan N pcs (dari Isi Pola BOM)". KALAU Qty Target yang
  diisi Guru BUKAN kelipatan bulat dari N, ditambah 1 baris peringatan
  lembut (bukan `alert()`/blokir simpan — cuma pengingat visual, keputusan
  akhir tetap di tangan Guru) menyebutkan sisa pcs yang berpotensi boros
  pola. Kalau produk TIDAK terhubung atau `kelipatan` = 0 (belum ada Isi
  Pola BOM terisi), TIDAK ada hint sama sekali (bukan dianggap error).
- List/tabel Order SPK: baris baru "SKU Produk" di kartu, CUMA tampil
  kalau `item.sku_produk` terisi.
- `bukaEdit()` ikut baca `sku_produk` (produk yang terhubung otomatis
  kerekonstruksi lewat computed `produkTerpilih`, tidak perlu logic
  tambahan).
- **Firestore Rules**: TIDAK butuh rules baru — koleksi `order_spk` yang
  sama, sudah live & dipublish sebelumnya (field baru, bukan koleksi
  baru).

**File berubah (§42.1 + §42.2, 1 batch pengiriman)**:
`js/vue-bahan-aksesoris.js` (v20→v21, cuma fix bug §42.1),
`js/vue-master-produk.js` (v14→v15), `js/vue-order-spk.js` (v4→v5),
`index.html` (3 baris cache-bust).

**Verifikasi**: `node --check` mode ES-module (lihat catatan §42.1) lolos
di SEMUA file `.js` proyek. Keseimbangan tag `<div>` (regex) = 0 di semua
file yang markup-nya disentuh, KECUALI 1 false-positive JINAK yang SUDAH
dikonfirmasi sebelumnya (`js/vue-bahan-aksesoris.js`, komentar teks "ke
`<div>` tersembunyi di window" — itu di dalam komentar `//`, memang bukan
markup, TIDAK ada hubungannya dengan bug §42.1 yang sudah diperbaiki di
tempat lain).

**Belum diuji manual sama sekali** — Guru WAJIB tes langsung setelah
push:
1. Buka Entry Bahan & Aksesoris & List Bahan & Aksesoris — pastikan
   form/tabel SUDAH MUNCUL NORMAL (bug §42.1 utama).
2. Entry/Edit Produk (Master Produk) — isi Isi Pola (Pcs) di beberapa
   baris BOM Pola berbeda, cek field "Kelipatan" di live-preview kehitung
   benar (KPK-nya), simpan, cek tersimpan & muncul juga di kartu List
   Produk.
3. Order SPK — coba "Pilih Produk (SKU)", cek Nama Produk/Keterangan
   otomatis terisi, cek hint "Acuan Minimal Order" muncul sesuai
   Kelipatan produk itu, cek peringatan lembut muncul kalau Qty Target
   diisi bukan kelipatan bulat.
4. Order SPK — cek SPK LAMA (belum terhubung SKU) tetap bisa diedit/
   disimpan normal tanpa terganggu (field `sku_produk` opsional).
5. Regresi: Riwayat Cetak Label & fitur cetak label lain (§41.2/§41.3)
   TETAP jalan normal (file `vue-bahan-aksesoris.js` disentuh lagi di
   putaran ini, walau cuma 1 baris).

**Delivery**: ditulis flat langsung ke `Data Yang Disiapkan\` (device
bridge tersambung) — lihat catatan koreksi folder di `PEDOMAN-GAYA-
KERJA.md` (WAJIB flat, tidak boleh ada sub-folder).

---

### §42.3 — Order SPK: "Qty Target" diganti nama jadi "Qty Order" + hint kelipatan direname "Rekomendasi Kelipatan Order" (28 Agt 2026)

**Permintaan Guru (verbatim)**: "pda order spk ada rekomendasi kelipatan
Order disamping field qty order (hasil rename dari qty target)"

**Ganti nama field, bukan cuma label tampilan**: field Firestore
`qty_target` di koleksi `order_spk` GANTI NAMA jadi `qty_order` (bukan
cuma teks label UI) — variabel reactive `form.qty_target` → `form.qty_order`
di `js/vue-order-spk.js` juga ikut diganti (dicek dulu lewat `grep`, field
ini TIDAK dipakai file lain manapun di proyek — aman direname penuh tanpa
menyentuh file lain).

**Kompatibilitas data lama (TANPA migrasi manual)**: dokumen `order_spk`
yang SUDAH ADA sebelumnya masih tersimpan dengan nama field LAMA
(`qty_target`, belum ada `qty_order`). Supaya tidak butuh migrasi data
manual (dan tidak berisiko qty-nya "hilang"/tampil 0 di SPK lama), semua
pembacaan dinormalisasi SATU TEMPAT: `petakan` di config
`usePaginasiFirestore` (`js/vue-order-spk.js`) —
`qty_order: d.qty_order ?? d.qty_target ?? 0`. Efeknya: SEMUA pemakaian
setelah titik itu (tabel/kartu, edit, cetak label) otomatis baca `qty_order`
dengan benar baik untuk dokumen baru maupun lama, tanpa fallback berulang
di tiap tempat. Begitu SPK lama diedit & disimpan ulang, otomatis pindah
ke field baru (payload `simpan()` SEKARANG cuma menulis `qty_order`, tidak
lagi menulis `qty_target`).

**Hint kelipatan direname**: teks hint di bawah field Qty Order (dari
§42.2) diganti dari "Acuan Minimal Order: kelipatan N pcs..." jadi
**"Rekomendasi Kelipatan Order: N pcs (dari Isi Pola BOM)"** — isi & logic
(termasuk peringatan lembut kalau qty bukan kelipatan bulat) TIDAK
berubah, cuma pilihan katanya disesuaikan sesuai istilah Guru.

**File berubah**: `js/vue-order-spk.js` (v5→v6, HANYA rename field/label +
comment, tidak ada perubahan logic lain), `index.html` (1 baris cache-bust).

**Verifikasi**: `node --check` mode ES-module lolos di SEMUA file proyek
(termasuk file ini). Keseimbangan tag `<div>` = 0.

**Belum diuji manual** — tolong Guru cek: (1) form Order SPK sekarang
label-nya "Qty Order" bukan "Qty Target", (2) hint "Rekomendasi Kelipatan
Order" muncul benar di samping field itu begitu produk (SKU) terhubung,
(3) SPK LAMA (dibuat sebelum update ini) masih tampil qty-nya dengan
benar di tabel/kartu (bukan 0/kosong) — ini yang paling penting dicek,
buktikan fallback field lama jalan.

---

### §42.4 — Tombol "Hitung Ulang Kelipatan Semua Produk" (backfill, 28 Agt 2026)

**Konteks**: Guru sudah tes §42.2/§42.3 di live — hint "Rekomendasi
Kelipatan Order" sempat tidak muncul, ternyata gabungan 2 hal: (1) cache
browser (sudah beres dengan hard refresh Ctrl+Shift+R), (2) field
`kelipatan` MEMANG cuma kehitung & tersimpan pas produk di-SIMPAN — produk
LAMA yang sudah ada dari sebelum §42.2 belum pernah tersentuh field ini,
jadi masih kosong sampai dibuka+Simpan manual. Guru sempat mulai buka
produk satu-satu buat itu — saya tawarkan cara lebih cepat, dikonfirmasi
Guru: **"Ya, buatkan tombol backfill"**.

**Implementasi**: tombol baru "Hitung Ulang Kelipatan Semua Produk" di
toolbar List Produk (`js/vue-master-produk.js`, `MasterProdukListManager`,
sebelah dropdown Import/Template Excel). Klik → `confirm()` dulu → ambil
SEMUA produk (`ambilSemuaProduk()`, fungsi yang sama dipakai §42.2) →
hitung ulang `kelipatan` tiap produk dari `bom_pola`-nya (`hitungKelipatan()`,
fungsi yang SAMA dipakai form Entry — bukan logic baru/duplikat) → cuma
`updateDoc()` produk yang nilainya BEDA dari yang tersimpan (hemat tulis,
`PRINSIP-HEMAT.md` — produk yang kebetulan sudah sesuai DILEWATI, termasuk
produk yang memang belum punya BOM Pola sama sekali). Field LAIN tiap
produk (nama/foto/BOM/dst) TIDAK disentuh sama sekali, cuma `kelipatan`.
Selesai → alert ringkasan "N produk diperbarui, M dilewati" + refresh
tabel.

**Tidak ditambah permission-check baru**: tombol Edit per-kartu di List
Produk yang SUDAH ADA sebelumnya TIDAK punya gate izin 'edit' terpisah
(cuma 'delete' yang dicek, `bolehHapus`) — supaya konsisten dengan pola
yang SUDAH ADA di komponen ini (bukan nebak nambah pola baru), tombol
backfill ini JUGA tidak digate izin tambahan, cuma dilindungi `confirm()`
sebelum jalan (sama seperti pola konfirmasi sebelum aksi Hapus).

**File berubah**: `js/vue-master-produk.js` (v15→v16), `index.html` (1
baris cache-bust).

**Verifikasi**: `node --check` mode ES-module lolos di SEMUA file proyek.
Keseimbangan tag `<div>` = 0.

**Belum diuji manual** — Guru tolong cek: klik tombol "Hitung Ulang
Kelipatan Semua Produk" di List Produk, konfirmasi popup, tunggu selesai,
cek angka ringkasan masuk akal (jumlah produk yang diperbarui), lalu cek
beberapa produk lama yang tadinya belum keisi Kelipatan sekarang sudah
muncul, dan hint "Rekomendasi Kelipatan Order" di Order SPK ikut muncul
untuk produk itu tanpa perlu buka+Simpan manual lagi.

---

## §43 — Fitur BARU "Persiapan Produksi" (28 Agt 2026)

**Permintaan Guru (verbatim, diringkas)**: tambah tab Config baru "Tahap
Proses" (rename "Persiapan Untuk Tahap"), sambungkan ke dropdown Tahap
Proses di BOM Aksesoris (Master Produk). Di bawah menu Order SPK,
tambah group menu baru "Persiapan Produksi": begitu 1 SPK masuk, dia
dulu mampir ke antrean "1. Perlu disiapkan" — kalau di-Approve, sistem
generate id turunan per komponen dari No. SPK (beda angka belakang,
supaya 4 komponen produksi gampang "disatukan" lagi) — lalu "2. Persiapan
Bahan", "3. Persiapan Acc Sewing", "4. Persiapan Acc Webbing", "5.
Persiapan Acc Finishing" (kartu 3-5 = hasil filter BOM Aksesoris per
field Tahap). Format kartu 2-5 SAMA, beda cuma filter — karena akses
kebanyakan lewat HP oleh operator/admin dengan Scan Persiapan.

**4 keputusan arsitektur** (AskUserQuestion, SEBELUM koding — permintaan
ini besar & berpotensi ambigu, konsisten prinsip "jangan bikin tebak2"):

1. **Trigger masuk antrean "Perlu Disiapkan"**: Otomatis begitu SPK
   disimpan (dipilih Guru, opsi Recommended).
2. **Isi hasil Approve**: Bahan + Acc sesuai isi BOM SAJA — bukan selalu
   4 slot tetap (dipilih Guru, opsi Recommended). Kalau BOM Aksesoris
   SPK itu cuma ada tahap "Sewing", CUMA kartu `-SEW` yang dibuat.
3. **Format id turunan**: `SPK-0001-BHN` / `-SEW` / `-WEB` / `-FIN`
   (dipilih Guru, sesuai contoh No. SPK yang biasa dipakai).
4. **Cara tandai 1 item "sudah disiapkan"**: Scan QR lewat menu Scan
   Persiapan (dipilih Guru, opsi Recommended) — BUKAN tombol manual di
   kartu Persiapan Produksi.

**Arsitektur data (3 koleksi Firestore BARU)**:

- **`master_tahap_persiapan`** — koleksi referensi sederhana (skema
  `{nama, keterangan}`, kembar `master_komponen`/`master_ukuran`),
  dikelola lewat tab Config > **Persiapan Untuk Tahap** BARU
  (`js/vue-config.js`, `AppConfigTahapPersiapan`). Guru **WAJIB isi
  persis 3 entry**: "Sewing", "Webbing", "Finishing" (boleh beda
  kapitalisasi, dicocokkan case-insensitive) — ini yang menentukan baris
  BOM Aksesoris masuk ke kartu Persiapan Acc yang mana saat Approve
  (lihat poin "keputusan sepihak" di bawah).
- **`persiapan_produksi`** — 1 dokumen per SPK ("antrean", tab 1 "Perlu
  Disiapkan"). **Doc id SENGAJA DISAMAKAN dengan doc id SPK-nya sendiri**
  (bukan id acak) — pasangan 1:1 yang idempoten, gampang dicari langsung
  tanpa query. Field: `spk_id, no_spk, nama_produk, sku_produk, qty_order,
  status ('perlu_disiapkan'|'approved'), dibuat_pada, dibuat_oleh,
  disetujui_pada, disetujui_oleh`. **Ditulis OTOMATIS** oleh
  `js/vue-order-spk.js` (`buatAntreanPersiapanProduksi()`, dipanggil dari
  `simpan()` — CUMA di cabang SPK BARU/`addDoc`, BUKAN saat SPK lama
  diedit) begitu 1 SPK baru tersimpan. Kegagalan tulis di sini SENGAJA
  TIDAK menggagalkan simpan SPK utama (cuma dicatat ke Console) —
  konsisten prinsip "aksi utama harus tetap sukses walau aksi turunan
  gagal".
- **`persiapan_komponen`** — 1 dokumen per KOMPONEN (Bahan/Acc Sewing/
  Acc Webbing/Acc Finishing) per SPK, dibuat SEKALIGUS saat Approve
  (tab 1) — HANYA untuk komponen yang BENERAN ada isinya di BOM (poin 2
  di atas). **Doc id = `{no_spk}-BHN`/`-SEW`/`-WEB`/`-FIN`** (poin 3 di
  atas, karakter `/` di No. SPK — kalau ada — diganti `-` dulu buat jaga-
  jaga doc id valid). Field: `spk_id, no_spk, nama_produk, sku_produk,
  qty_order, tipe ('bahan'|'sewing'|'webbing'|'finishing'), status
  ('proses'|'selesai'), baris[] ({nama, warna, qty_dibutuhkan, satuan,
  qty_disiapkan, selesai, bahan_aksesoris_id, [webbing2, webbing3 khusus
  Acc]}), dibuat_pada, dibuat_oleh`.

**Approve — cara `qty_dibutuhkan` dihitung** (`js/vue-persiapan-
produksi.js`, `PersiapanQueueManager.approveAntrean()`): baca produk
`master_produk` lewat `sku_produk` SPK, lalu tiap baris `bom_pola`
(Bahan) → `qty_dibutuhkan = panjang (per pcs) × qty_order SPK`; tiap
baris `bom_aksesoris` yang `tahap_proses`-nya cocok Sewing/Webbing/
Finishing → `qty_dibutuhkan = qty (per pcs) × qty_order SPK` — "BOM
explosion" standar, logic dasarnya SAMA dengan field `kelipatan` (§42.2)
yang sudah dibangun sebelumnya. `satuan` diambil dari
`master_bahan_aksesoris.satuan_pemakaian` (Bahan) atau `satuan` baris BOM
Aksesoris itu sendiri (Acc).

**Keputusan sepihak** (belum eksplisit ditanya, dicatat biar gampang
dikoreksi — pola "keputusan sepihak" proyek ini):

- **a.** Pencocokan tahap Acc Sewing/Webbing/Finishing MURNI cocok TEKS
  `tahap_proses` (case-insensitive+trim) terhadap persis 3 kata itu.
  Baris BOM Aksesoris yang `tahap_proses`-nya TIDAK cocok (typo/kosong/
  istilah lain) TIDAK IKUT ke kartu manapun, TANPA peringatan eksplisit
  di kartu Approve — Guru WAJIB isi field itu (dropdown "Persiapan Untuk
  Tahap" di BOM Aksesoris) persis salah satu dari 3 kata itu.
- **b.** Formula `qty_dibutuhkan` (lihat di atas) BELUM ditanyakan
  eksplisit — kalau ada faktor lain (susut/waste %, dst), titik ini yang
  perlu direvisi.
- **c.** Approve **SEKALI JALAN per SPK** (tombolnya hilang begitu
  status `approved`) — supaya progres checklist yang sudah dicatat lewat
  Scan Persiapan TIDAK PERNAH tertimpa Approve ulang. Kalau BOM produk
  berubah SETELAH Approve, kartu yang sudah ada TIDAK otomatis ikut
  berubah (belum ada fitur "Approve Ulang").
- **d.** Approve BLOKIR dengan pesan jelas (bukan generate BOM kosong)
  kalau SPK belum terhubung `sku_produk`, atau produknya sudah terhapus,
  atau BOM-nya kosong total/tahap Acc-nya tidak ada yang cocok.

**Integrasi dengan Scan Persiapan (`js/vue-scan-persiapan.js`,
`tandaiPersiapanDariScan()`)**: dipanggil dari `simpanPemakaian()`
SETELAH pemakaian berhasil dicatat ke ledger (Kartu Stok) — cari
`persiapan_komponen` yang `spk_id`-nya cocok (bisa sampai 4 dokumen per
SPK), cari baris PERTAMA yang `bahan_aksesoris_id`-nya cocok DAN belum
`selesai`, `qty_disiapkan` BERTAMBAH (bukan ditimpa) sebesar qty yang
discan, `selesai:true` otomatis begitu `qty_disiapkan >= qty_dibutuhkan`.
1 scan = update 1 baris saja. Kegagalan fungsi ini SENGAJA TIDAK
menggagalkan pemakaian yang sudah tercatat (try/catch sendiri, cuma
dicatat ke Console) — pola sama seperti `buatAntreanPersiapanProduksi()`
di atas.

**Master Produk (`js/vue-master-produk.js`)**: field `tahap_proses` di
BOM Aksesoris (SUDAH ADA sebelumnya sebagai teks bebas) SEKARANG pakai
`DropdownCari` bersumber `master_tahap_persiapan` (opsi saran, BUKAN
strict-select — data lama yang ejaannya belum persis cocok TETAP tampil
normal, TIDAK ada migrasi data). Nama field Firestore TIDAK berubah.

**Sidebar & menu izin**: grup baru "Persiapan Produksi" di sidebar
Zevanic House, posisi PERSIS di antara "Order SPK" dan "Scan" (permintaan
Guru). 5 menu-id BARU di `js/vue-config-akses.js` (`DAFTAR_MENU`):
`persiapan_produksi_antrean/bahan/sewing/webbing/finishing` — SENGAJA
5 menu-id TERPISAH (bukan 1 grup seperti Master Produk) karena akses
Approve (tab 1) wajar dibatasi PIC/Admin ke atas, sementara tab 2-5
(checklist) lebih wajar diakses lebih luas (operator lapangan). Tab
Config "Persiapan Untuk Tahap" TIDAK butuh menu-id baru (reuse
`config_master_data`, pola sama semua tab Config lain).

**File berubah/baru**:
- `js/vue-persiapan-produksi.js` — **BARU**, `PersiapanQueueManager`
  (tab 1) + `PersiapanKomponenListManager` (tab 2-5, 1 komponen reusable
  prop `tipe`).
- `js/vue-master-produk.js` (v16→v17) — dropdown Tahap Proses.
- `js/vue-config.js` (v4→v5) — tab Config "Persiapan Untuk Tahap".
- `js/vue-order-spk.js` (v6→v7) — auto-buat antrean saat SPK baru.
- `js/vue-scan-persiapan.js` (v2→v3) — integrasi tandai checklist.
- `js/vue-config-akses.js` (v5→v6) — 5 menu-id baru.
- `js/dashboard.js` (v16→v17) — `petaTabIndukPerGrup` + `petaMount` (6
  entry baru: 5 tab Persiapan Produksi + 1 tab Config).
- `js/vue-header-mobile.js` (v2→v3) — `LABEL_SUBTAB` (6 entry baru).
- `index.html` — sidebar (1 tombol grup baru), content-div Persiapan
  Produksi (5 sub-tab + 5 mount point), content-div Config (1 sub-tab +
  1 mount point baru), cache-bust 8 file di atas + 1 script tag baru.
- `firestore-rules-tambahan-persiapan-produksi.txt` — **BARU**, 3 blok
  match (`master_tahap_persiapan`, `persiapan_produksi`,
  `persiapan_komponen`) buat ditempel ke `firestore.rules` Guru.

**⚠️ BLOKIR TES #1 (SUDAH SELESAI dikirim, TINGGAL Publish manual)**: 3
koleksi Firestore BARU di atas sudah DIGABUNG ke `firestore.rules` (file
LENGKAP siap-timpa dikirim ke `Data Yang DIsiapkan` 28 Agt 2026 malam —
juga masih ada versi tempel-manual `firestore-rules-tambahan-persiapan-
produksi.txt` kalau Guru mau tempel manual ke rules versi lain). WAJIB
**Publish** manual di Firebase Console > Firestore Database > Rules.
TANPA ini, menu Persiapan Produksi & tab Config "Persiapan Untuk Tahap"
permission-denied total.

**⚠️ BLOKIR TES #2 (BARU ketauan 28 Agt 2026 sore, dari laporan Guru
"Gagal memuat data. Cek Console..." di SEMUA 5 tab Persiapan Produksi)**:
query `usePaginasiFirestore()` yang dipakai tab-tab itu (where()+
orderBy() gabungan, lihat §9 soal pola ini) butuh **2 index gabungan
Firestore BARU** yang belum ada:
- Koleksi `persiapan_produksi`: `status` (Ascending) + `no_spk`
  (Ascending) — dipakai tab "Perlu Disiapkan".
- Koleksi `persiapan_komponen`: `tipe` (Ascending) + `no_spk`
  (Ascending) — dipakai SEMUA 4 tab Bahan/Sewing/Webbing/Finishing
  sekaligus (1 index menutup ke-4nya, cuma beda nilai `tipe`).

Panduan lengkap (2 cara: klik link auto dari error Console browser /
bikin manual step-by-step) dikirim sebagai `firestore-index-tambahan-
persiapan-produksi.txt` ke folder yang sama. **TANPA index ini, SEMUA 5
tab Persiapan Produksi tetap gagal muat data WALAUPUN rules sudah
di-Publish** — 2 blokir ini INDEPENDEN, keduanya wajib beres.

**Verifikasi**: `node --check` mode ES-module (copy ke `.mjs` dulu,
lihat §42.1) lolos di **SEMUA** 46 file `.js` proyek (bukan cuma yang
disentuh). Keseimbangan tag `<div>`/`<button>`/`<script>` index.html =
164/164, 73/73, 46/46. ID mount-point & key peta (dashboard.js/
vue-header-mobile.js/vue-config-akses.js/index.html) dicocokkan silang
manual satu-satu (grep), semua sudah pas.

**Belum diuji manual sama sekali** — Guru WAJIB, SETELAH publish rules
DAN bikin 2 index di atas (urutan bebas, tapi DUA-duanya harus beres
dulu):
1. Buka Config > Persiapan Untuk Tahap → isi persis 3 entry "Sewing",
   "Webbing", "Finishing" (WAJIB, sebelum tes Approve manapun).
2. Buka Master Produk > Entry Produk > tab BOM Aksesoris → isi/pilih
   field "Tahap Proses" dari dropdown baru → Simpan.
3. Buat 1 Order SPK BARU, terhubung ke produk itu (Pilih Produk SKU) →
   cek muncul otomatis di Persiapan Produksi > Perlu Disiapkan.
4. Klik Approve pada SPK itu → cek kartu Persiapan Bahan/Acc Sewing/
   Webbing/Finishing MUNCUL SESUAI ISI BOM (yang kosong TIDAK muncul) →
   cek qty per baris masuk akal (qty per pcs BOM × Qty Order SPK).
5. Coba Approve SPK yang BELUM terhubung SKU → cek pesan error jelas,
   TIDAK ada kartu ter-generate.
6. Buka Scan Persiapan (HP), pilih SPK yang sudah di-Approve, scan/catat
   pemakaian 1 Bahan/Acc yang ada di BOM-nya → balik ke kartu Persiapan
   terkait → cek progress bar & centang baris itu ke-update (qty
   disiapkan bertambah, otomatis "selesai" kalau sudah cukup).
7. (Regresi) Cek Order SPK, Master Produk, Scan Persiapan, Config lain
   TETAP jalan normal seperti biasa.
8. Setelah semua di atas jalan: buka Config Akses → update profil akses
   non-Owner yang relevan (5 menu-id baru default HANYA Owner).
