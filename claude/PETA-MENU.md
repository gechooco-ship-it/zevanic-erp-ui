# PETA MENU KERJA — Zevanic/Gechoo ERP

> Referensi cepat "menu apa → file mana". Kalau `STATUS-PROYEK.md` itu
> cerita KENAPA sesuatu dibangun begitu, file ini jawab pertanyaan
> praktis: **"saya mau ubah menu/sub-menu X, file mana yang perlu
> di-upload?"**
>
> Setiap file di sini SUDAH DICEK LANGSUNG ke kode-nya (bukan dari
> ingatan) — kalau ada sub-tab di dalam satu file, itu ditulis rinci di
> baris "Sub-menu di dalamnya".

---

## 📱 Navigasi Bawah (Mobile, 5 ikon)

> **DIROMBAK 27→28 Agt 2026** (redesain mobile "Gechoo Mobile Organic",
> §27→§27.2 lalu §44, revisi kecil lanjutan 29 Agt) — kode SUDAH DIKIRIM,
> **BELUM SEPENUHNYA DITES Guru di live**.

| Menu | File Utama | Sub-menu di dalamnya | Role | Status |
|---|---|---|---|---|
| **Home** | `vue-home.js` | Kartu Shift (`.gc-kartu-gradien`) + Clock In/Out, **Kartu Statistik** (3 angka — SEMUA masih placeholder "–", rumus "Peringkat" belum disepakati Guru), **Favorit Saya** (1 kartu Clock In/Out WAJIB tampil + maks. 4 kartu favorit pilihan user — `users/{email}.menu_favorit`, dipilih lewat layar **Atur Favorit** [`vue-atur-favorit.js`, BARU], TIDAK ADA lagi toggle pilih-lepas inline di Beranda sendiri), lalu **1 grup kategori menu** (`grupTampil`, dari `users/{email}.beranda_grup` — grid 4 kolom, maks. 4 menu + tombol "Lihat Semua Menu (N)" buka layar **Menu Lengkap** [`vue-menu-lengkap.js`, BARU — pencarian semua menu, semua kategori, client-side]; jumlah kartu per grup ikut `users/{email}.beranda_batas_kartu` [2-8, default 4]). Kedua layar baru di-mount EAGER via `<div id="tab-menu-lengkap">`/`<div id="tab-atur-favorit">` (`index.html`), terdaftar di array `tabs` (`dashboard.js`) — BUKAN bagian 5 ikon nav bawah, dibuka dari Home saja. Daftar & urutan menu ditarik dari `DAFTAR_MENU`/`KATEGORI_URUTAN` (`vue-config-akses.js`), override urutan lewat panel Config Akses "Urutan Menu di Home Mobile & Sidebar Desktop" (lihat baris Config Akses di bawah — TERPISAH dari preferensi grup-tampil per-user). Pengumuman/Quote Harian TIDAK LAGI kartu di body — pindah ke Header (lihat di bawah) | Semua | ✅ Aktif |
| **Absensi** → **Profile** ("Absensi") | `vue-account-profile.js` | *lihat tabel Profile di bawah* | Semua | ✅ Aktif |
| **Scan QR** | `vue-scan-qr.js` | — (bingkai kamera `.gc-cam-view` bergaya, rasio 3:4 + garis scan animasi, kosmetik §44) | Semua | ⚠️ Bisa baca QR, BELUM ada yang memproses hasilnya |
| **Progress** | *(belum dibangun)* | — | Semua | ❌ Placeholder |
| **Profile (Bottom Sheet)** | `vue-sheet-profil.js` (GANTI TOTAL `vue-profile-drawer.js` — **file lama DIHAPUS dari disk & `index.html`**, tidak ada fallback) | Panel naik dari bawah (`.gc-sheet`) — kartu QR gradien + 3 aksi cepat (**Keluar**/Logout, Scan QR, **Mode Tema** [siklus terang → gelap → otomatis, `window.toggleTema()`/`temaPreferensi()`]) + 6 link ke sub-tab `vue-account-profile.js`: Profil Lengkap (Data Karyawan) → Absensi Saya → Reimburse Saya → Estimasi Gaji → Pencapaian → Keamanan — **SATU-SATUNYA jalan navigasi sub-tab Profile di mobile** (baris tombol tab desktop `.hidden.md:block` tidak tampil di mobile). **⚠️ Sub-tab Profile baru ke depan WAJIB ditambah link-nya di sini juga** — kelupaan = sub-tab itu buntu total di mobile, bukan cuma susah ditemukan | Semua | ✅ Aktif |

**Header dinamis** (semua halaman mobile, di luar 5 ikon): `vue-header-mobile.js` — kartu sapaan + Quote Harian inline 1 baris, **lonceng notifikasi** + badge angka (baca koleksi `pengumuman`, SUMBER SAMA seperti `PengumumanCarousel` lama; badge dari `localStorage` key `zevanic_notif_terakhir_dilihat_{email}`, TIDAK ADA tulis Firestore tambahan), avatar inisial (visual saja, bukan link). Mode `'tersembunyi'` (`TAB_HEADER_SENDIRI = ['tab-menu-lengkap','tab-atur-favorit']`) dipakai layar yang sudah punya header sendiri (`HeaderLayar`, `vue-components.js`) biar tidak dobel header. `PengumumanCarousel`/`QuoteCard` (`vue-components.js`) MASIH ADA, dipakai desktop. **BARU (5 Sep 2026, §5.12)**: map sub-tab-id→label ditambah 3 entri untuk Master Suplayer (`sub-zh-suplayer-entry`/`-alias-moq`/`-petakan`) & diperbarui untuk tab Config yang di-rename (`sub-zh-config-tlc` → "TLC & Prefix"), entri lama `sub-zh-stock-alias` dihapus (menu-nya sudah tidak ada). **BARU LAGI (7 Sep 2026 malam, §5.14)**: label sub-tab Stok & Pembelian diperbarui mengikuti 4 tab baru (`sub-zh-stock-notaorder`→"Daftar Nota", dst — lihat bagian Zevanic House di bawah), entri lama untuk "List Order Belanja" dihapus.

### Sub-menu di dalam Profile (`vue-account-profile.js`) — 7 tab internal
Baris tombol tab (`.gc-card.hidden.md:block`) desktop-only. Navigasi mobile
100% lewat Bottom Sheet `vue-sheet-profil.js` di atas — sub-tab tanpa link
di sheet **buntu total di mobile**.

| Sub-tab | Isinya | Link di Bottom Sheet mobile? |
|---|---|---|
| **Account** | QR code pribadi, tombol Logout | Tidak ada link langsung (QR sudah tampil di kartu atas sheet) |
| **Data Karyawan** | Edit data diri sendiri | ✅ Ya ("Profil Lengkap") |
| **Absensi** | Riwayat kehadiran pribadi + form pengajuan Izin/Cuti/Lembur | ✅ Ya |
| **Reimburse** | Form pengajuan reimburse | ✅ Ya |
| **Estimasi Gaji** | Placeholder — TIDAK ada tombolnya di baris tab desktop (cuma `tabAktif='gaji'` lewat kode, belum ada jalur klik normal) | ✅ Ya |
| **Pencapaian** | *(belum banyak dikembangkan)* | ✅ Ya |
| **Keamanan** | 2 sub-tab: **Password** (ganti password) + **PIN** (dipakai "Absensi Melalui QR", DAN sejak 7 Sep 2026 malam — §5.14 — `pin_hash` yang sama DIREUSE untuk finalisasi Nota + Terapkan harga di Stok & Pembelian, lihat `PETA-DATABASE.md`) | ✅ Ya |

---

## 🕐 Master Absensi (sidebar desktop / grup menu Home)

| Menu | File Utama | Sub-menu di dalamnya | Role | Status |
|---|---|---|---|---|
| **Config Absensi** | `vue-config-absensi.js` | 2 bagian dalam 1 file: **Master Gudang & Titik Lokasi** (`MasterGudangManager`) + **Master Shift** (`MasterShiftManager`) | pic/admin/owner/superuser | ✅ Aktif |
| **Penjadwalan** | `vue-penjadwalan.js` | — | pic/admin/owner/superuser | ✅ Aktif (belum paginasi) |
| **Antrean Absensi** | `vue-antrean-absensi.js` | Query/tampilan shift pakai `nama_shift` (fix bug field yang sempat tidak pernah tercatat — perhitungan otomatis "Status Kehadiran" [`muatJamShift()`] baru bisa jalan sesuai desain aslinya). Avatar foto di header kartu (fallback `foto_selfie_keluar` → `foto_selfie_masuk` → `foto_selfie`/`foto`), tombol Hapus format-lama dipindah ke menu titik-tiga (⋮) | pic/admin/owner/superuser | ✅ Aktif |
| **Antrean Lembur** | `vue-antrean-lembur.js` | — | pic/admin/owner/superuser | ✅ Aktif — approve di sini pengaruh langsung ke hitungan gaji |
| **Riwayat All Absensi** | `vue-riwayat-absensi.js` | Termasuk alat migrasi `waktu_ts` (banner kuning, muncul otomatis kalau perlu) | pic/admin/owner/superuser | ✅ Aktif (belum paginasi) |

---

## 👥 Master Karyawan (sidebar desktop / grup menu Home)

| Menu | File Utama | Sub-menu di dalamnya | Role | Status |
|---|---|---|---|---|
| **Antrean Dakar** | `vue-antrean-dakar.js` | Border foto KTP disamakan gaya avatar kartu (radius 12px, kosmetik saja — ini KTP, bukan foto wajah, TIDAK diubah jadi avatar bulat) | owner/superuser | ⚠️ Baru dirombak total, **BELUM DITES** |
| **Daftar Karyawan** | `vue-daftar-karyawan.js` | Modal Edit Karyawan (`EditKaryawanModal`, di file yang sama) | owner/superuser | ✅ Aktif, sudah paginasi |
| **Slip Gaji** | *(belum dibangun)* | — | owner/superuser | ❌ Placeholder |
| **Payroll** | *(belum dibangun)* | — | owner/superuser | ❌ Placeholder — tapi `jam_keluar_untuk_gaji` (vue-camera.js) sudah siap dipakai nanti |
| **Config Karyawan** | `vue-config-karyawan.js` | **8 kategori Master Data**: Jenis Pekerjaan, Status Kerja, Jabatan, Status Karyawan, Kabupaten/Kota, Alasan Izin, Alasan Cuti, Status Kehadiran (+ Kecamatan, dikelola terpisah karena bertingkat per Kabupaten) | owner/superuser | ✅ Aktif |
| **Config Info** | `vue-config-info.js` | 2 bagian: **Pengumuman** (dengan lampiran gambar/video — sumber data yang SAMA sekarang JUGA dipakai lonceng notifikasi header mobile, lihat baris "Header dinamis" di atas) + **Quote Harian** (jadwal per tanggal) | owner/superuser | ✅ Aktif |
| **Hak Akses** | `vue-hak-akses.js` | — | **owner saja** | ✅ Aktif |
| **Config Akses** | `vue-config-akses.js` | Termasuk kartu "Tingkat Keamanan Dasar" per profil. `DAFTAR_MENU` (SATU-SATUNYA sumber daftar menu & izin) — tiap entri punya `icon` (kelas FontAwesome) & `aksi` (fungsi navigasi `pindahTab`/`pindahSubTab`, dipakai Home mobile & sidebar desktop); flag `wajibOwner` (kunci keras ke Owner, di luar Config Akses) & `deprecated` (sembunyikan dari Home). `KATEGORI_URUTAN` (array urutan kategori) di-`export`. Kartu tambahan **"Urutan Menu di Home Mobile & Sidebar Desktop"**: sub-panel "Urutan Kategori (Grup Menu)" (panah naik/turun urutan grup) + daftar menu per kategori dengan panah naik/turun urutan tampil (4 teratas = yang tampil sebelum "Lihat Semua"), tombol "Simpan Urutan" tulis ke `pengaturan_sistem/urutan_menu_home` (field `perKategori` + `urutanKategori`) — dipakai Home mobile DAN sidebar desktop (lihat baris `auth.js` di bawah). **BEDA** dari preferensi grup-tampil-di-Beranda per-user (`beranda_grup`/dst, di `users/{email}` masing-masing lewat layar Atur Favorit) — itu SENGAJA TIDAK memakai koleksi global ini. **BARU (5 Sep 2026, §5.12)**: 3 menu-id BARU ditambah (`suplayer_entry`/`suplayer_alias_moq`/`suplayer_petakan_order`, kategori "Zevanic House"); entry lama `master_suplayer` (Config > Data Suplayer, sudah `deprecated`) label diperbarui; `stock_alias_pembelian` SEKARANG JUGA `deprecated:true` (tetap ada di `DAFTAR_MENU`, tidak dihapus, `aksi()`-nya dicopot). **BARU LAGI (7 Sep 2026 malam, §5.14)**: `stock_list_order_belanja` SEKARANG `deprecated:true` (`aksi()` dicopot, label diubah "List Order Belanja (DIPENSIUNKAN, lihat Daftar Nota / Persiapan Belanja)"); `stock_nota_order_belanja` label diganti "Daftar Nota" (id/`aksi()` tetap sama); `bahan_aksesoris_rak` (menu-id lama Rak Penyimpanan di Data Bahan & Aksesoris) SEKARANG `deprecated:true`; menu-id BARU `stock_rak_penyimpanan` ditambah (Rak Penyimpanan versi baru, di grup Stok & Pembelian) | **owner saja** | ✅ Aktif (baru "cetak biru" sebagian — lihat STATUS-PROYEK.md §6.3). Panel Urutan Menu BELUM SEPENUHNYA DITES Guru di live |

---

## 🏭 Zevanic House (sidebar desktop / grup menu Home)

> Modul manufaktur/gudang — grup sidebar sendiri `navgrp-zevanic`, semua
> sub-menu di bawah 1 tab `tab-zevanic-house`. Semua menu-id akses ada di
> `DAFTAR_MENU` (`vue-config-akses.js`), kategori `"Zevanic House"`.
>
> **UPDATE (5 Sep 2026, §5.12)**: tab Config "Data Suplayer" DIGANTI
> "**TLC & Prefix**" (koleksi BARU `master_tlc`, skema `{kode, nama,
> tipe}`); "Master Suplayer" SEKARANG menu sidebar TERSENDIRI (bukan lagi
> sub-tab Stock & Pembelian) dengan 3 sub-tab sendiri; tab "Alias
> Pembelian" DIHAPUS dari Stock & Pembelian (fungsinya pindah ke Master
> Suplayer > Alias & MOQ). **KODE DITULIS, BELUM DIKIRIM ke folder
> `Code`, BELUM di-push Guru, BELUM DIUJI SAMA SEKALI** — lihat
> `STATUS-PROYEK.md` §5.12.
>
> **UPDATE LAGI (7 Sep 2026, §5.13)**: List Bahan & Aksesoris GANTI TOTAL
> balik ke tabel grid+expand (dari kartu 28 Agt), tab Master Produk dapat
> tab ke-3 "HPP" (Owner-only), Config dapat tab baru "Riwayat PIN"
> (`riwayat_pin`, kosong sengaja). Detail: lihat baris masing-masing di
> bawah.
>
> **UPDATE LAGI (7 Sep 2026 malam, §5.14, `/design-terapkan-handoff`
> "Stok dan Pembelian")**: rebuild 4 sub-tab **Stock & Pembelian**
> (Daftar Nota, Riwayat Harga Pembelian, Kartu Stok, Rak Penyimpanan —
> Rak Penyimpanan PINDAH ke sini dari Data Bahan & Aksesoris). "List
> Order Belanja" DIHAPUS TOTAL dari kode (bukan cuma menu, tombol/div/
> mount semuanya dicopot). PIN finalisasi Nota + Terapkan harga REUSE
> `users.pin_hash` (bukan koleksi/mekanisme baru). `vue-scan-
> persiapan.js` (di bagian "Scan" bawah) diperluas menyerap 2 fungsi
> dari Kartu Stok lama. **KODE DITULIS, `node --check` lolos, DIKIRIM ke
> `Code\` device (12 file, byte-size terverifikasi), BELUM DIUJI
> BROWSER/FIRESTORE SAMA SEKALI**, dan modul ini sensitif UANG+STOK —
> lihat `STATUS-PROYEK.md` §5.14.

| Menu | File Utama | Sub-menu di dalamnya | Role | Status |
|---|---|---|---|---|
| **Config** | `vue-config.js` | 10 tab child: **Jenis Bahan**, **Jenis Aksesoris** (lewat `MasterDataCategory`, koleksi `master_data`, kategori `jenis_bahan`/`jenis_aksesoris`), **Data Satuan**, **Data Warna**, **Data Ukuran**, **Jenis Produk**, **Data Komponen**, **Persiapan Untuk Tahap** (ke-6 ini lewat `MasterDataTabelManager`), **TLC & Prefix** (`AppConfigTlc`, koleksi `master_tlc` + kartu "Prefix Kode SPK"), dan **Riwayat PIN** (BARU, §5.13 — `AppConfigRiwayatPin`, baca koleksi BARU `riwayat_pin`, read-only, TAMPIL KOSONG sampai ada modul yang menulis ke sana DAN rule Firestore-nya di-publish — lihat `PETA-DATABASE.md`) | Config Akses (`config_master_data`, default cuma Owner) | ⚠️ Riwayat PIN: kode ditulis, `node --check` lolos, dikirim ke `Code\`, BELUM diuji, BLOCKED sampai rule `riwayat_pin` dipublish; tab TLC & Prefix: kode ditulis, BELUM dikirim/di-push/diuji; 8 tab lain ✅ Aktif |
| **Master Suplayer** | `js/vue-master-suplayer.js` (BARU, 3 komponen) | 3 sub-tab: **Entry Suplayer** (`SuplayerEntryList` — data suplayer: nama, kontak, bank, no rekening, no WA — koleksi `master_suplayer`, GANTI dari tab generic lama), **Alias & MOQ** (`AliasMoqManager` — GANTI dari `AliasPembelianManager`/tab "Alias Pembelian" Stock & Pembelian lama, koleksi `alias_pembelian`, field BARU `moq`/`moq_satuan`/`lead_time_hari`/`is_default_order`), **Petakan Order** (`PetakanOrderManager` — pilih 1 suplayer default per kelompok item, `writeBatch` memastikan cuma 1 `is_default_order:true` per kelompok) | `suplayer_entry` / `suplayer_alias_moq` / `suplayer_petakan_order` (BARU) | ⚠️ Kode ditulis & SUDAH dikirim ke folder `Code` (byte-size terverifikasi), rules `master_tlc`/`alias_pembelian`/`master_suplayer` dikonfirmasi ADA (lihat §5.13), BELUM di-push Guru, BELUM DIUJI SAMA SEKALI |
| **Data Bahan & Aksesoris** | `vue-bahan-aksesoris.js` | 2 sub-tab: **Entry Bahan & Aksesoris** (form + gear pengaturan Prefix ID — **BARU 1 Sep 2026, §5.11d**: field opsional **Panjang Roll** (meter); margin_modal SEKARANG persen, §5.13) dan **List Bahan & Aksesoris** — **GANTI TOTAL (7 Sep 2026, §5.13)**: dari kartu BALIK ke tabel grid 7 kolom + filter tab (Semua/Bahan/Aksesoris/Perlu dilengkapi, badge count) + baris expand (roll/lot aktif + 3 harga terakhir + tombol Edit/Cetak Label/Lihat Kartu Stok) + "Muat 20 Lagi" | `bahan_aksesoris_entry` / `bahan_aksesoris_list` | ⚠️ §5.13 (List grid+expand, margin persen): kode ditulis, `node --check` lolos, dikirim ke `Code\`, BELUM DIUJI BROWSER; field Panjang Roll (§5.11d) tetap ✅ Aktif |
| **Persiapan Masalah** | `vue-persiapan-masalah.js` | Daftar permintaan bahan/aksesoris yang lagi kosong (status `menunggu`/`sudah_dipesan`) — sumber "Sumber Permintaan" saat bikin Nota. **Catatan (7 Sep 2026, §5.14)**: sekarang JUGA ditulis oleh alur "ajukan kekurangan" di Scan Persiapan (lihat baris Scan di bawah), skema tulis sama | `persiapan_masalah` | ✅ Aktif |
| **Stock & Pembelian** | `vue-stock-pembelian.js` | **REBUILD TOTAL (7 Sep 2026 malam, §5.14)** — 4 sub-tab: **Daftar Nota** (`DaftarNotaScreen`, GANTI dari "List Order Belanja"+"Nota Order Belanja", DEFAULT AKTIF) — layout ala kasir, entry keyboard-first (ketik→Enter→Tab→qty popup→Enter→Tab→satuan popup→Enter→balik ke search), foto_bon upload, `order_driver_id` shell (SELALU `null`), finalisasi digerbang PIN (`PopupPin`/`cariUserByPin()`, Owner-tier langsung tanpa PIN). "List Order Belanja" (mode estimasi lama) **DIHAPUS TOTAL dari kode** (bukan cuma UI — komponen `AppListOrderBelanja` dihapus). Komponen `AliasPembelianManager` (lama) tetap kode mati, tidak disentuh | `stock_nota_order_belanja` (label BARU "Daftar Nota", id sama) — `stock_list_order_belanja` SEKARANG `deprecated` | ⚠️ Kode ditulis, `node --check` lolos, dikirim ke `Code\`, BELUM DIUJI BROWSER — modul UANG, test hati-hati |
| ↳ **Riwayat Harga Pembelian** | `vue-stock-pembelian.js` (`RiwayatHargaPembelianManager`) | Sub-tab ke-2 di grup Stock & Pembelian (`sub-zh-stock-riwayat`) — baca `riwayat_harga_pembelian`. **BARU (7 Sep 2026, §5.14)**: banner alert kenaikan harga (query `master_bahan_aksesoris` where `harga_perlu_konfirmasi==true`) + tombol "Terapkan & buka blokir" (PIN Owner-tier wajib, non-Owner ditolak) — update `harga_modal`/`harga_pembelian`/`harga_pemakaian` (formula persen) + hapus flag. Item `konversi_bertingkat`: Terapkan cuma update tier terakhir (simplifikasi, lihat `PETA-DATABASE.md`) | — (belum ada menu-id tersendiri) | ⚠️ Kode ditulis, BELUM DIUJI BROWSER |
| ↳ **Kartu Stok** | `vue-kartu-stok.js` | Sub-tab ke-3 (`sub-zh-stock-kartustok`) — **GANTI TOTAL jadi READ-ONLY MURNI (7 Sep 2026, §5.14)**: form "Catat Pemakaian" (FIFO manual, popup 3-opsi, Scan QR) DIHAPUS TOTAL, dipindah ke Scan Persiapan (lihat baris Scan di bawah). 2 layar lama (Ringkasan→Detail) DIGABUNG jadi 1 layar dengan `DropdownCari` "Ganti Item" + badge "Lot Aktif" baru. **Penyimpangan dari rencana awal**: rencana "pindah ke Scan & Cetak" ternyata salah premis (Scan Persiapan sudah ada tapi cuma kasus sederhana) — dikonfirmasi ulang ke Guru, scope FIFO+kekurangan dipindah ke Scan Persiapan dulu. Excel export masih belum diputuskan | — (idem) | ⚠️ Kode ditulis, BELUM DIUJI BROWSER |
| ↳ **Rak Penyimpanan** | `vue-rak-penyimpanan.js` | Sub-tab ke-4 (`sub-zh-stock-rak`) — **PINDAH ke sini (7 Sep 2026, §5.14) dari "Data Bahan & Aksesoris"** (menu-id lama `bahan_aksesoris_rak` sekarang `deprecated`). **Migrasi model data**: kode_rak/baris_rak/kolom_rak GANTI dari 3 dropdown master-data terkelola jadi 3 input teks bebas digabung (`rak+baris_rak+kolom_rak` → `kode_rak`, mis. "E11"). `rak_label` dipertahankan sebagai alias supaya dropdown "Pilih Rak" di Data Bahan & Aksesoris tetap jalan. Dokumen lama TIDAK dimigrasi otomatis (Guru wajib rapikan manual). List baru per-item + bar kapasitas (formula BARU, belum dikonfirmasi Guru) — lihat `PETA-DATABASE.md` untuk skema lengkap | `stock_rak_penyimpanan` (BARU, `bahan_aksesoris_rak` lama `deprecated`) | ⚠️ Kode ditulis, BELUM DIUJI BROWSER, data rak lama perlu migrasi manual |
| **Master Produk** | `vue-master-produk.js` | 3 sub-tab (**BARU: tab ke-3**): **Entry Produk** (form BOM, **BARU LAGI 5 Sep 2026, §5.13: field "MOQ Pesanan Produk"** (`moq_serie`) **& "Kelipatan Isi Pola"** (`kelipatan_isi_pola`)), **List Produk**, dan **HPP** (BARU TOTAL, §5.13 — `MasterProdukHppManager`, menu-id `master_produk_hpp`, Owner-only, dihitung LIVE dari BOM + `biaya_tambahan_hpp` manual, TIDAK di-cache) | `master_produk_entry` / `master_produk_list` / `master_produk_hpp` (BARU) | ⚠️ Tab HPP (§5.13): kode ditulis, `node --check` lolos, dikirim ke `Code\`, BELUM DIUJI BROWSER; 2 field §5.13 lain: idem; sisanya ✅ Aktif |
| **Master Pelanggan** | `js/vue-master-pelanggan.js` (BARU TOTAL, §5.12) | Single-view (`MasterPelangganManager`): list kartu per pelanggan (nama, badge tipe, saldo piutang, limit piutang) + 1 popup Tambah/Edit (nama*, telepon, alamat, email, tipe, limit_piutang, catatan). `saldo_piutang` readonly, SELALU 0 sampai fitur Pesanan piutang (langkah 12) jadi — bukan bug. Koleksi BARU `master_pelanggan` | `master_pelanggan` (BARU) | ✅ **Rules dipublish + SUDAH DITES di browser (7 Sep 2026)** — Tambah/Edit/Hapus, dedupe nama, badge tipe semua jalan. SELESAI PENUH |
| **Order SPK** | ~~`vue-order-spk.js`~~ | **DIPENSIUNKAN (30 Agt 2026)** — fungsi CRUD (daftar SPK, cetak label QR) PINDAH TOTAL ke **Pesanan > Menunggu Proses** (lihat bagian "🛒 Pesanan" di bawah). Tombol & div konten lama DIHAPUS dari `index.html`, `js/vue-order-spk.js` TIDAK LAGI DIMUAT (file dibiarkan ada di disk, tidak dihapus) | — | ⚠️ DIPENSIUNKAN, lihat Pesanan |
| **Scan** | 2 file terpisah, 1 sub-tab grup (`sub-zevanic-house-scan`) | **Scan Opname** (`vue-scan-opname.js`) — hitung ulang stok fisik vs sistem lewat scan QR, tulis "Penyesuaian" ke Kartu Stok (`catatPenyesuaianOpnameItem`/`catatPenyesuaianOpnameLot`, diimpor dari `vue-stock-pembelian.js`); **Scan Persiapan** (`vue-scan-persiapan.js`) — scan No. SPK (`order_spk`) lalu scan barang, catat pemakaian bahan langsung ke Kartu Stok lewat `catatPergerakanKartuStok()`/`catatPemakaianDariAlokasi()`. **DIPERLUAS (7 Sep 2026 malam, §5.14)**: sekarang JUGA menangani alokasi FIFO multi-roll (`bangunAlokasiFifoScan()`, ambil dari lot yang di-scan dulu baru sisanya dari lot aktif lain) dan alur "ajukan kekurangan" 3-opsi (kurangi jumlah / proses sebagian & ajukan sisa ke `persiapan_masalah` / tunggu dulu) — 2 fungsi ini DIPINDAH dari Kartu Stok lama (lihat baris Kartu Stok di atas). **BUKAN** modul "Scan generik" 6-jenis yang direncanakan `RENCANA-REKONSTRUKSI-2026-09.md` §9.3 (itu belum mulai dikerjakan) | `scan_opname` / `scan_persiapan` — Scan Opname WAJIB mobile buat non-Owner (hardcode role check di file, bukan lewat Config Akses) | ✅ Aktif (Scan Opname); ⚠️ Scan Persiapan: perluasan §5.14 BELUM DIUJI BROWSER |

✅ **File LAMA, SUDAH DIHAPUS TOTAL dari repo (1 Sep 2026)**: `vue-persiapan-produksi.js` (5 sub-tab lama `sub-zh-persiapanproduksi-*`, koleksi `persiapan_produksi`/`persiapan_komponen`) — GANTI TOTAL oleh grup "Persiapan Produksi" di bawah. Sudah dikonfirmasi aman dihapus (dicek: tidak ada `<script>` tag di `index.html`, tidak ada `import` dari file lain, ke-5 fungsi `window.pastikanMount...`-nya sudah tidak dipanggil di `petaMount` `dashboard.js`) sebelum Guru hapus manual dari GitHub — menunya sudah tidak tampil, sesuai dugaan. **BARU (30 Agt 2026)**: `vue-order-spk.js` (daftar+form+cetak label SPK) — GANTI TOTAL oleh "Pesanan > Menunggu Proses" (kode disalin, bukan diimpor, ke `js/vue-pesanan.js`), tombolnya sudah dicopot dari `index.html`, file-nya sendiri **BELUM dihapus** dari disk (masih ada, tapi tidak pernah di-`<script>`/import lagi). **BARU LAGI (7 Sep 2026 malam)**: komponen `AppListOrderBelanja`/`vmListOrderBelanja` ("List Order Belanja", `vue-stock-pembelian.js`) DIHAPUS TOTAL dari kode (bukan cuma dicopot dari `index.html` — kodenya sendiri dihapus), sesuai keputusan Guru "Hapus sekarang".

---

## 🛒 Pesanan (grup top-level BARU, sejajar Zevanic House / Persiapan Produksi)

> **BARU (30 Agt 2026)**. Grup sidebar sendiri `navgrp-pesanan`, tab
> sendiri `tab-pesanan` (BUKAN nested di Zevanic House). Posisi SENGAJA
> setelah Zevanic House, sebelum Persiapan Produksi (ikuti alur kerja:
> Kasir jual → SPK → Persiapan Produksi kerjakan — ASUMSI urutan, belum
> eksplisit dikonfirmasi Guru). Semua menu-id akses ada di `DAFTAR_MENU`
> (`vue-config-akses.js`), kategori `"Pesanan"`. **Latar belakang &
> keputusan arsitektur lengkap (4 ronde AskUserQuestion + 3 asumsi yang
> belum eksplisit dikonfirmasi Guru)**: lihat komentar besar di atas
> `js/vue-pesanan.js`, dan `STATUS-PROYEK.md` §45.
>
> **⚠️ BELUM DIUJI di browser+Firebase sungguhan** — lihat daftar 9 poin
> uji manual di `STATUS-PROYEK.md` §45. `firestore.rules` BELUM
> dipublish (blocker keras buat "Penjualan Kasir" bisa menulis data).
>
> **BARU (7 Sep 2026 malam, §5.14)**: `buatOrder()` (`PesananKasirManager`)
> sekarang dipanggil lewat guard baru `bahanTerblokirDiKeranjang()` —
> checkout DIBLOK kalau ada bahan di keranjang (resolve dari BOM produk)
> yang `master_bahan_aksesoris.harga_perlu_konfirmasi==true`. Fail OPEN
> kalau query guard sendiri error (checkout tetap jalan). Lihat
> `PETA-DATABASE.md` untuk detail.

| Menu | File Utama | Sub-menu di dalamnya | Role | Status |
|---|---|---|---|---|
| **Penjualan Kasir** | `vue-pesanan.js` (`PesananKasirManager`) | POS: tab kategori produk (dari `jenis_produk`) + grid produk (harga dari `master_produk.harga_jual`, BARU) + panel keranjang (qty stepper, nama pelanggan opsional, metode pembayaran, total). "Buat Order" → guard harga pending (§5.14, BARU) → 1 dokumen `transaksi_kasir` + N dokumen `order_spk` OTOMATIS (1 per item, field SPK tidak berubah — mengalir ke pipeline Persiapan Produksi V2 tanpa hambatan) | `pesanan_kasir` | ⚠️ Kode selesai, BELUM diuji |
| **Menunggu Proses** | `vue-pesanan.js` (`PesananMenungguManager`) | DISALIN dari `OrderSpkManager` lama (`vue-order-spk.js`) — daftar SPK (`order_spk`, cari+paginasi), tambah/edit/hapus, cetak label QR (per baris/pilih-banyak). Koleksi SAMA dibaca Kasir & form manual ini | `pesanan_menunggu` | ⚠️ Kode selesai, BELUM diuji |
| **Proses Persiapan** | `vue-pesanan.js` (`RingkasanSpkTrackManager`, `jalur-set=['vendor','bahan']`) | Ringkasan BACA SAJA (0 tombol aksi) — `spk_track` jalur Vendor+Bahan, 5 kartu ringkasan per tahap + daftar + tombol "Buka di Persiapan Produksi" per baris. **Catatan (31 Agt 2026)**: untuk jalur `bahan`, ringkasan ini masih baca `spk_track.status` level-dokumen sebagai gambaran kasar — status OPERASIONAL sesungguhnya jalur Bahan sekarang per baris di `bahan_rincian[].status` (lihat `PETA-DATABASE.md`), jadi ringkasan di sini bisa TIDAK sepresisi tampilan asli di menu Persiapan Produksi > Bahan | `pesanan_persiapan` | ⚠️ Kode selesai, BELUM diuji |
| **Proses Produksi** | `vue-pesanan.js` (`RingkasanSpkTrackManager`, `jalur-set=['sewing','webbing','finishing']`) | Sama pola dengan Proses Persiapan, jalur Acc Sewing+Webbing+Finishing. **Catatan (1 Sep 2026)**: sama seperti Bahan, ke-3 jalur ini SEKARANG status operasional sesungguhnya juga per baris (`sewing_rincian[]`/`webbing_rincian[]`/`finishing_rincian[]`, lihat `PETA-DATABASE.md`) — ringkasan di sini masih baca `spk_track.status` level-dokumen, jadi bisa TIDAK sepresisi tampilan asli di menu Persiapan Produksi masing-masing pos | `pesanan_produksi` | ⚠️ Kode selesai, BELUM diuji |
| **Proses Pengiriman** | `vue-pesanan.js` (`RingkasanSpkTrackManager`, `status-set=['perlu_dikirim','sedang_dikirim']`) | Sama pola, TAPI filter status (bukan jalur) — lintas SEMUA jalur, ringkasan per jalur (bukan per tahap) | `pesanan_pengiriman` | ⚠️ Kode selesai, BELUM diuji |

---

## 🧵 Persiapan Produksi V2 (grup top-level BARU, sejajar Zevanic House)

> Grup sidebar sendiri `navgrp-persiapanproduksi`, tab sendiri
> `tab-persiapan-produksi` (BUKAN nested di Zevanic House). Detail
> desain lengkap: `claude/RENCANA-PERSIAPAN-PRODUKSI-V2.md`.
>
> **UPDATE (31 Agt 2026, §5.11)**: jalur **Bahan** DIKELUARKAN dari
> `JalurTahapManager` generik di bawah, dibangun ULANG TOTAL di file
> BARU `js/vue-persiapan-bahan.js` dari wireframe handoff ke-2 (modul
> ke-2 dari `Mockup/handoff/`, setelah "Perlu Disiapkan").
>
> **UPDATE LAGI (1 Sep 2026, §5.11d)**: jalur **Acc Sewing**, **Acc
> Webbing**, **Acc Finishing** JUGA DIKELUARKAN dari `JalurTahapManager`
> generik, dibangun ULANG TOTAL SEKALIGUS (1 sesi, atas instruksi
> eksplisit Guru — menyimpang dari aturan "satu modul per sesi" di
> README paket handoff, lihat `STATUS-PROYEK.md` §5.11d), masing-masing
> di file BARU sendiri (`vue-persiapan-sewing.js`/`vue-persiapan-
> webbing.js`/`vue-persiapan-finishing.js`), pola Bahan jadi ACUAN tapi
> arsitektur kartu BEDA (1 kartu = 1 `spk_track`, bukan gabungan lintas
> dokumen — lihat `PETA-DATABASE.md`). **Vendor SEKARANG SATU-SATUNYA**
> jalur yang masih generik lewat `JalurTahapManager` — belum ada
> rencana/wireframe modul khusus untuk Vendor sejauh diketahui. **KODE
> KE-3 MODUL BARU SUDAH DITULIS & DIKIRIM (1 file zip gabungan), BELUM
> di-push Guru, BELUM DIUJI SAMA SEKALI.**
>
> **CATATAN (5 Sep 2026, §5.12)**: koleksi `master_tlc` yang dipakai
> ke-4 pos di bawah (Bahan + 3 Acc) SEKARANG JUGA dikelola lewat tab
> Config baru "TLC & Prefix" (`AppConfigTlc`, lihat bagian "🏭 Zevanic
> House" di atas) — sebelumnya cuma bisa diisi via tombol "Isi TLC
> Awal" di masing-masing modul. Skema `{kode, nama, tipe}` di
> `PETA-DATABASE.md` juga sudah dikoreksi (sebelumnya sempat salah
> tertulis `{nama, keterangan}`).

| Menu | File Utama | Sub-menu di dalamnya | Role | Status |
|---|---|---|---|---|
| **Perlu Disiapkan** | `vue-persiapan-produksi-v2.js` (`PersiapanDisiapkanManager`) | Kelompokkan SPK aktif (`order_spk`) yang produk+pola-nya sama jadi 1 "SPK Grouping" (`spk_grouping`), cetak label, lalu auto-buat 1 `spk_track` per jalur aktif (kalau jalur `bahan`/`sewing`/`webbing`/`finishing` ikut aktif, SEKALIAN dihitung rincian per-baris-nya lewat `hitungBahanRincian()`/`hitungSewingRincian()`/`hitungWebbingRincian()`/`hitungFinishingRincian()`, lihat `PETA-DATABASE.md`) | `pp_disiapkan` | ✅ Aktif |
| **Bahan** | `js/vue-persiapan-bahan.js` (BARU, file terpisah — BUKAN lagi `JalurTahapManager`) | **5 sub-tab, DIRENAME dari versi lama (`Perlu Diproses`/`Sedang Diproses`) supaya konsisten istilah wireframe**: **Perlu Disiapkan** (kartu per-kelompok "sepack" — pola+nama bahan+size sama, warna/no_spk boleh beda; cetak label per-grouping dengan split kalau campur sepack; cetak ulang via PIN+alasan dicatat ke `cetak_ulang_log`; penunjukan operator: scan QR operator lalu scan berulang kode anak-SPK) → **Sedang Disiapkan** (papan dikelompokkan per operator, tombol per baris: Scan Entry/Scan Masalah/Ganti Operator — Ganti Operator = jalur estafet/shift-handover, riwayat ke `bahan_rincian[].riwayat_operator[]`) → **Perlu Di Kirim** (Cetak Kode Bagging/Cetak Kode Tugas, tombol "Isi TLC Awal" seed 10 lokasi contoh ke `master_tlc` kalau masih kosong, modal Scan Pack + Scan Kirim) → **Sedang Di Kirim** (view-only, dikelompokkan per `kode_tugas`) → **Selesai** (riwayat lengkap — KPI harian, tabel siklus `label_cetak_pada`→`sampai_pada`, versi "Riwayat Saya" khusus operator; **TAPI akan tampil kosong terus** — belum ada modul "Scan Sampai" divisi penerima yang menulis `sampai_pada`, lihat `PETA-DATABASE.md`/`STATUS-PROYEK.md` §5.11b). Ambang "tertahan" **6 jam** (dihitung dari `masuk_tahap_pada`, warna beda kalau lewat) dipakai SERAGAM di semua tab — pola ini DIPAKAI LAGI di ke-3 file Acc di bawah. Mount LAZY (`window.pastikanMountPpBahanXxx()`, dipanggil `pindahSubTab()`, pola SAMA seperti mount jalur×tahap lain — BUKAN eager) | `pp_bahan` (menu-id lama dipakai lagi — TIDAK berubah, cuma isi filenya yang ganti total) | ⚠️ Kode selesai & dikirim, **BELUM di-push Guru, BELUM DIUJI SAMA SEKALI** |
| **Acc Sewing** | `js/vue-persiapan-sewing.js` (BARU, 1 Sep 2026, file terpisah) | **5 sub-tab, pola SAMA seperti Bahan** (Perlu Disiapkan → Sedang Disiapkan → Perlu Di Kirim → Sedang Di Kirim → Selesai) TAPI **kartu = 1 `spk_track`** (1 SPK Grouping), BUKAN gabungan lintas dokumen seperti Bahan — TIDAK ADA alokasi stok kumulatif ala Bahan. 1 scan (Tunjuk Operator/Scan Pack/Scan Kirim) bisa menyentuh BANYAK baris sekaligus (semua baris 1 anak-SPK, atau semua baris share `kode_bagging`) lewat fungsi baru `updateBarisSewingMassal()` (beda dari Bahan yang max 1 baris per anak-SPK per kartu). **Label dicetak 1 PER ANAK SPK** (beda dari Bahan yang 1 label per grouping). Syarat "sepack" kunci `produk+size` saja (beda dari Bahan yang `pola+bahan+size`). Sumber kebutuhan: `master_produk.bom_aksesoris[]` (BUKAN `bom_pola[]`), filter `tahap_proses` cocok longgar "sewing". Mount LAZY, pola sama Bahan | `pp_sewing` (menu-id lama dipakai lagi) | ⚠️ Kode selesai & dikirim, **BELUM di-push Guru, BELUM DIUJI SAMA SEKALI** |
| **Acc Webbing** | `js/vue-persiapan-webbing.js` (BARU, 1 Sep 2026, diturunkan mekanis dari Sewing) | Pola SAMA PERSIS seperti Acc Sewing di atas, DITAMBAH kolom khusus Webbing: **roll** (dihitung dari `butuh_meter / master_bahan_aksesoris.panjang_roll` — field BARU, null-safe kalau belum diisi) dan **Kode Webbing 2/Kode Webbing 3** (teks bebas, dari `bom_aksesoris[].webbing2`/`webbing3`) — tampil sebagai badge/kolom tambahan di tab 1, tab 2, dan tabel admin tab 5 | `pp_webbing` (menu-id lama dipakai lagi) | ⚠️ Kode selesai & dikirim, **BELUM di-push Guru, BELUM DIUJI SAMA SEKALI** |
| **Acc Finishing** | `js/vue-persiapan-finishing.js` (BARU, 1 Sep 2026, diturunkan mekanis dari Sewing) | Pola SAMA PERSIS seperti Acc Sewing di atas, DITAMBAH: badge "varian" (`varian_jumlah` >1) dan indikator "keadaan cetak"/"sisa dicetak" (dihitung LIVE per baris, bukan field tersimpan) — `varian_tipe`/`varian_jumlah` default `'tunggal'`/`1`, **KEPUTUSAN default eksplisit** karena SERAH-TERIMA masih menandai varian sebagai "belum diputuskan" saat kode ini ditulis | `pp_finishing` (menu-id lama dipakai lagi) | ⚠️ Kode selesai & dikirim, **BELUM di-push Guru, BELUM DIUJI SAMA SEKALI** |
| **Vendor** (jalur sisa, generik) | `vue-persiapan-produksi-v2.js` (`JalurTahapManager`, komponen generic dipasang lewat `buatAppJalurTahap()`) | 5 child-tab tahap **Perlu Diproses → Sedang Diproses → Perlu Dikirim → Sedang Dikirim → Selesai**, digerakkan scan QR (Scan Operator/Entry/Masalah/Pack/Kirim/Sampai) yang update `spk_track.status` level-dokumen (BEDA dari Bahan/Acc Sewing/Webbing/Finishing di atas, yang status operasionalnya per baris) | `pp_vendor` | ✅ Aktif (masih manual-checkbox, belum deteksi otomatis dari BOM — SATU-SATUNYA jalur yang masih pola lama sekarang) |

---

## 🔌 Integrasi (sidebar desktop / grup menu Home)

| Menu | File Utama | Sub-menu di dalamnya | Role | Status |
|---|---|---|---|---|
| **WhatsApp Gateway** | `vue-whatsapp-gateway.js` | 3 tab: **Config API**, **Template Pesan**, **Monitoring Respon** | owner/superuser | ✅ Aktif (toggle OTP di tab Config API, tapi sekarang kirim lewat Email) |
| **Mail Gateway** | `vue-mail-gateway.js` | 3 tab: **Config & Tes OTP**, **Template Pesan**, **Monitoring** | owner/superuser | ✅ Aktif |

---

## 🔑 Alur Login & Registrasi (bukan menu, tapi sering ditanya)

| Bagian | File Utama | Sub-tahap di dalamnya |
|---|---|---|
| **Registrasi karyawan baru** | `vue-registrasi.js` | 4 tahap: Email → OTP → Form data lengkap → Selesai |
| **Login** | `vue-login.js` | Termasuk modal OTP perangkat baru + modal wajib ganti password (2 modal terpisah, muncul kondisional) + mode "Absensi Melalui QR" (`modeKioskLogin`, khusus akun Device Kiosk) |
| **Absensi Melalui QR** | `vue-absensi-qr.js` | Menu 5 pilihan (Clock In/Out/Lembur/Izin/Cuti) → scan QR → PIN → delegasi ke `screen-camera`. Animasi `gxPop` di kartu sukses (kosmetik, §44) |
| **Sesi & role saat login** | `auth.js` | `window.cekIzinMenu`, `window.cekFiturAkses`, `window.muatAksesConfigSaya`. `window.terapkanUrutanMenuDesktop()` — baca `pengaturan_sistem/urutan_menu_home` & susun ulang posisi tombol sidebar desktop biar sama dengan urutan yang diatur Owner lewat Config Akses (dipanggil otomatis di akhir `aturTampilanBerdasarkanRole()`). `window.bolehLihatData()` ada bypass eksplisit dimensi gudang untuk `profil_akses === 'pic_owner'`. `window.aturTema(mode)`/`toggleTema()`/`temaSaatIni()`/`temaPreferensi()` — API tema, siklus 3 tahap `light → dark → auto`, localStorage key `zevanic_tema` (fungsi aslinya di `index.html`, dicatat di sini karena sering dicari bareng fungsi sesi lain) |
| **Navigasi antar-tab** | `dashboard.js` | `pindahTab`/`pindahSubTab`, peta mount tiap layar (`petaMount`), DAN `petaTabIndukPerGrup` (map TERPISAH, keyed by sub-tab-group-prefix, dipakai breadcrumb/header-context — BUKAN mount). **BARU (1 Sep 2026)**: 15 entry lama jalur Sewing/Webbing/Finishing (`sub-pp-sewing-perludiproses` dkk → `pastikanMountPpSewingPerluDiproses` dkk) DIGANTI TOTAL ke id & nama fungsi baru (mis. `sub-pp-sewing-perludisiapkan` → `pastikanMountPpSewingPerluDisiapkan`), pola sama dengan 5 entry Bahan yang sudah diganti 31 Agt 2026. Entry jalur `pp_vendor` TIDAK ikut disentuh, tetap `-perludiproses`/`-sedangdiproses`. **BARU LAGI (5 Sep 2026, §5.12)**: `petaTabIndukPerGrup` ditambah `'sub-zh-suplayer': 'tab-zevanic-house'`; `petaMount` ditambah 3 entry Master Suplayer (`sub-zh-suplayer-entry`/`-alias-moq`/`-petakan` → `pastikanMountSuplayerEntry`/`SuplayerAliasMoq`/`SuplayerPetakan`), diganti 1 entry Config (`sub-zh-config-suplayer`→`sub-zh-config-tlc`), dihapus 1 entry (`sub-zh-stock-alias`). Array `tabs` (dipakai riwayat tombol kembali HP) termasuk `'tab-menu-lengkap'`/`'tab-atur-favorit'`/`'tab-pesanan'`. **BARU LAGI (7 Sep 2026 malam, §5.14)**: entry `sub-zh-stock-listorder` (List Order Belanja) DIHAPUS dari `petaMount`; entry mount Rak Penyimpanan DIPINDAH dari `sub-zevanic-house-databahan-rak` (lama) ke `sub-zh-stock-rak` (baru, di grup Stock & Pembelian) |
| **Kamera & submit absensi** | `vue-camera.js` | Hadir/Izin/Cuti/Lembur/Clock Out — 1 komponen, banyak mode lewat `window.statusPilihanGlobal`. Semua `dataKirim` menyertakan `nama_shift`. Bingkai kamera (`.gc-cam-view`) bergaya (rasio 3:4, garis scan animasi) — kosmetik saja, logic ambil-foto/submit tidak disentuh |

---

## 🧩 File "tak kasat mata" (bukan 1 menu spesifik, dipakai di mana-mana)

| File | Isinya |
|---|---|
| `vue-components.js` | Komponen bersama: `DuaBaris`, `GudangRingkas`, `GudangCheckboxSelect`, `MasterDataCategory`, `PengumumanCarousel` (MASIH ADA, dipakai desktop — mobile pindah ke lonceng header), `QuoteCard` (MASIH ADA, dipakai desktop), `EmojiPicker`, `DropdownCari` (combobox cari-sambil-ketik), `MasterDataTabelManager` (master data 2 kolom Nama+Keterangan per koleksi sendiri, prop opsional `tampilTabel` buat mode tabel & `izinkanImportExcel` buat tombol Import/Template Excel — **CATATAN (5 Sep 2026, §5.12)**: `master_suplayer` & `master_tlc` TIDAK LAGI lewat komponen ini, masing-masing sekarang komponen bespoke sendiri di `vue-master-suplayer.js`/`vue-config.js` karena butuh field REAL yang beda dari `nama`/`keterangan` generic), `daftarMenuGroups(role, urutanKustomPerKategori, urutanKustomKategori)` (registry menu Home — derivasi dari `DAFTAR_MENU`/`KATEGORI_URUTAN` di `vue-config-akses.js`, dipanggil HANYA dari `vue-home.js`). **4 komponen BARU (§44)**: `KartuMenu` (kartu 1 menu, dipakai Beranda & Menu Lengkap), `AksesTerbatasDialog` (dialog modul terkunci, ganti `alert()` polos), `HeaderLayar` (tombol kembali+kicker+judul, dipakai layar mode header `'tersembunyi'`), `KolomCari` (kolom cari pil, dipakai Menu Lengkap & Atur Favorit) |
| `vue-paginasi.js` | Composable paginasi Firestore — dipakai Daftar Karyawan + beberapa layar Zevanic House/Pesanan (lihat tabel Zevanic House/Pesanan di atas) |
| `vue-otp.js` | `window.kirimOtpEmail`/`verifikasiOtpEmail` — fondasi OTP, dipakai Registrasi & Login |
| `firebase-config.js` | Inisialisasi Firebase, termasuk `firebaseConfig` mentah (dipakai Antrean Dakar buat instance kedua) |
| `css/gechoo-design.css` | Semua warna/style — kalau soal tampilan (warna, jarak, ukuran font) tapi bukan soal 1 menu spesifik, ini filenya. Termasuk token mode gelap + kelas `.gc-*` (Bottom Sheet, Dialog, kartu gradien, empty state, dst — lihat `PETA-DESAIN.md` untuk detail lengkap) |
| `index.html` | Kerangka halaman, semua mount point (`<div id="vue-...">`), tombol sidebar/sub-tab. Mount point `#tab-menu-lengkap`/`#tab-atur-favorit`/`#vue-sheet-profil` (GANTI `#vue-profile-drawer`, dihapus total); script tema (`window.aturTema`/`toggleTema`/`temaSaatIni`/`temaPreferensi`, siklus `light → dark → auto`). **BARU (31 Agt 2026)**: 5 mount point sub-tab Bahan (`#vue-pp-bahan-perludisiapkan` dkk), `<script type="module" src="js/vue-persiapan-bahan.js">`. **BARU LAGI (1 Sep 2026)**: 15 mount point sub-tab Acc Sewing/Webbing/Finishing (`#vue-pp-sewing-perludisiapkan` dkk, label tab & nama div DIGANTI TOTAL dari versi generik lama), 3 tombol sidebar diretarget ke tab pertama baru, 3 `<script type="module" src="js/vue-persiapan-{sewing,webbing,finishing}.js?v=1">` ditambah setelah tag `vue-persiapan-bahan.js`. **BARU LAGI (5 Sep 2026, §5.12)**: 1 tombol sidebar baru "Master Suplayer" + blok konten `sub-zevanic-house-suplayer` (3 mount point `#vue-suplayer-entry`/`-alias-moq`/`-petakan`); tab Config "Data Suplayer"→"TLC & Prefix" (mount `#vue-config-tlc`); tab+div+mount "Alias Pembelian" DIHAPUS dari Stock & Pembelian; `<script type="module" src="js/vue-master-suplayer.js?v=1">` ditambah. **BARU LAGI (5 Sep 2026, §5.12/§5.14 lama)**: 1 tombol sidebar baru "Master Pelanggan" (setelah Master Produk) + blok konten `sub-zevanic-house-pelanggan` (single-view, 1 mount point `#vue-master-pelanggan`, tidak ada sub-tab bar); `<script type="module" src="js/vue-master-pelanggan.js?v=1">` ditambah; `dashboard.js` version bump v=22→v=23. **BARU LAGI (7 Sep 2026, §5.13)**: tab ke-3 "HPP" Master Produk (mount `#vue-master-produk-hpp`), tab "Riwayat PIN" Config (mount `#vue-config-riwayat-pin`). **BARU LAGI (7 Sep 2026 malam, §5.14)**: tab bar Stock & Pembelian (`sub-zh-stock`) sekarang 4 tab bersih — Daftar Nota (default, `sub-zh-stock-notaorder`) / Riwayat Harga Pembelian (`sub-zh-stock-riwayat`) / Kartu Stok (`sub-zh-stock-kartustok`) / Rak Penyimpanan (`sub-zh-stock-rak`, `data-menu-id="stock_rak_penyimpanan"`, mount `#vue-rak-penyimpanan`) — tab+div+mount "List Order Belanja" DIHAPUS TOTAL; tab Rak Penyimpanan LAMA di grup "Data Bahan & Aksesoris" (`sub-zh-databahan-rak`) DIHAPUS; group nav `data-menu-ids` diperbarui. Version bump: `dashboard.js?v=23→24`, `vue-pesanan.js?v=1→2`, `vue-config-akses.js?v=7→8`, `vue-stock-pembelian.js?v=22→23`, `vue-rak-penyimpanan.js?v=?→5`, `vue-scan-persiapan.js?v=3→4`, `vue-kartu-stok.js?v=6→7` |
| `js/vue-persiapan-bahan.js` | **BARU (31 Agt 2026, §5.11)** — modul Persiapan Produksi > Bahan versi rebuild, lihat baris "Bahan" di tabel Persiapan Produksi V2 di atas untuk isi lengkapnya |
| `js/vue-persiapan-sewing.js`, `js/vue-persiapan-webbing.js`, `js/vue-persiapan-finishing.js` | **BARU (1 Sep 2026, §5.11d)** — modul Persiapan Produksi > Acc Sewing/Webbing/Finishing, dikerjakan sekaligus 1 sesi atas instruksi Guru, lihat baris masing-masing di tabel Persiapan Produksi V2 di atas |
| `js/vue-master-suplayer.js` | **BARU (5 Sep 2026, §5.12)** — 3 komponen Master Suplayer (`SuplayerEntryList`/`AliasMoqManager`/`PetakanOrderManager`), lihat baris "Master Suplayer" di tabel Zevanic House di atas untuk isi lengkapnya. Beberapa helper kecil (`ambilDaftarBahanAksesorisLengkap`/`formatNamaBahan`/`ambilDaftarSuplayerLengkap`) DISALIN dari `vue-stock-pembelian.js` (bukan diimpor) — konvensi "salin logic kecil per-file" proyek ini |
| `js/vue-master-pelanggan.js` | **BARU (5 Sep 2026)** — Master Pelanggan, lihat baris "Master Pelanggan" di tabel Zevanic House di atas. **SELESAI PENUH, SUDAH DITES browser (7 Sep 2026)** |
| `js/vue-rak-penyimpanan.js` | **DITULIS ULANG TOTAL (7 Sep 2026 malam, §5.14)** — migrasi model data + PINDAH menu ke Stock & Pembelian, lihat baris "↳ Rak Penyimpanan" di tabel Zevanic House di atas |

---

## Aturan lain yang mungkin perlu (bukan `.js`)

| File | Kapan dibutuhkan |
|---|---|
| `firestore.rules` | Error "permission denied", atau menambah koleksi Firestore baru. ~~**BARU (31 Agt 2026)**: 6 koleksi modul Bahan... rules-nya BELUM ditempel~~ **RESOLVED (5 Sep 2026, §5.13)** — Guru paste isi `firestore.rules` LENGKAP ke chat, SEMUA koleksi yang dipakai kode s.d. §5.13 (termasuk `master_tlc`, `bagging`, `tugas_kirim`, `cetak_ulang_log`, `pengaturan_id_bagging`, `pengaturan_id_tugas_kirim`, `spk_track`, `transaksi_kasir`, `pengaturan_id_transaksi_kasir`) SUDAH ADA match block-nya — lihat `claude/FIRESTORE-RULES-SNAPSHOT.md` (snapshot terbaru) & `STATUS-PROYEK.md` §5.13. `master_pelanggan` **SUDAH DIPUBLISH** (7 Sep 2026). **BARU LAGI (7 Sep 2026 malam, §5.14)**: `riwayat_pin` (Config, §5.13) **MASIH BELUM DIPUBLISH** — blocker keras buat tab itu. Field baru §5.14 (`harga_perlu_konfirmasi`/`harga_pending` di `master_bahan_aksesoris`, `foto_bon`/`order_driver_id` di `pesanan_pembelian`) TIDAK butuh rule baru (field di koleksi yang sudah ada rule-nya); `master_rak_penyimpanan` (skema berubah) juga TIDAK butuh rule baru (rule generik per-koleksi, bukan per-field) |
| `storage.rules` | Masalah upload gambar/video (Config Info). **BARU (7 Sep 2026, §5.14)**: path `pesanan_pembelian/{id}/bon_*.jpg` (foto bon) pola sama dengan `master_produk` — cek rule ini juga men-cover path baru ini sebelum upload foto bon dites |
