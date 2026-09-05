// js/vue-config-akses.js
// ============================================================================
// Master Karyawan > Config Akses — buat & atur PROFIL AKSES bernama bebas
// (bukan cuma 5 role baku). Tiap profil punya izin View/Add/Edit/Delete/
// Print per menu, dikelompokkan per kategori (bisa dilipat/dibuka).
//
// PENERAPAN (update 17 Agt 2026): View menu (Home mobile) dan tombol Add/
// Edit/Delete/Print di beberapa layar SUDAH menerapkan izin dari sini
// secara nyata (lihat window.cekIzinMenu/cekFiturAkses di auth.js, dan
// STATUS-PROYEK.md untuk daftar layar mana saja yang sudah/belum). Ini
// murni PENERAPAN DI TAMPILAN (client-side) — keputusan sadar, BUKAN
// jadi batas keamanan Firestore Rules (itu tetap di 4 tingkat role baku,
// biar tidak nambah biaya baca per operasi tulis).
//
// KARENA rules tetap di tingkat role baku, tapi profil di sini boleh
// bernama BEBAS (mis. "admin_finance") — tiap profil WAJIB pilih 1 dari
// 5 tingkat baku sebagai "tingkatKeamanan"-nya (lihat bagian atas form).
// Itu yang benar-benar dikirim ke Firestore Rules lewat custom claim;
// nama profil sendiri cuma dipakai buat cari izin tampilan di sini.
//
// Akses ke layar ini SENGAJA dibatasi khusus Owner (lihat auth.js).
// ============================================================================
import { createApp, ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const TINGKAT_KEAMANAN_BAKU = ['operator', 'pic', 'admin', 'owner', 'superuser'];

// BARU (27 Agt 2026, §27 — Redesain Home Mobile) — tiap menu SEKARANG juga
// punya `icon` (kelas FontAwesome) dan `aksi` (function pindah tab/sub-tab,
// SAMA PERSIS dengan yang dipanggil tombol sidebar-nya masing-masing di
// index.html). INI YANG BIKIN DAFTAR_MENU BENERAN "satu sumber kebenaran":
// grid menu Home mobile (js/vue-home.js, lewat daftarMenuGroups() di
// vue-components.js) sekarang MEMBACA icon+aksi langsung dari sini, BUKAN
// disalin tangan ke daftar terpisah lagi seperti sebelumnya (itu yang bikin
// Home mobile ketinggalan — lihat STATUS-PROYEK.md §27). Tambah menu baru
// di sini SATU TEMPAT SAJA (kasih icon+aksi-nya sekalian) -> otomatis
// nongol juga di Home mobile, tanpa perlu file lain diubah.
//
// `deprecated: true` = menu ini SENGAJA disembunyikan dari Home mobile
// (entry-nya dibiarkan di sini biar data izin lama tidak yatim, sama
// seperti alasan aslinya) — TIDAK butuh icon/aksi.
// `wajibOwner: true` = TAMBAHAN pengunci di ATAS izin Config Akses biasa —
// menu ini di Home mobile TETAP terkunci utk siapapun SELAIN role 'owner'
// asli, APAPUN hasil Config Akses-nya. Dipakai cuma utk 2 menu yang
// memang sudah lama begini di sidebar desktop (Config Akses & Hak Akses,
// lihat id="btn-sub-karyawan-akses"/"btn-sub-karyawan-hakakses" di
// index.html) + Device Kiosk (List Device Kiosk) — supaya perilakunya
// konsisten sama di mobile.
const DAFTAR_MENU = [
  { id: 'dashboard', label: 'Dashboard', kategori: 'Umum' },
  { id: 'profile', label: 'Profile', kategori: 'Umum' },
  // fiturList = kontrol granular OPSIONAL per menu, di luar View/Add/Edit/
  // Delete/Print baku — dipakai buat kunci field/dropdown SPESIFIK di
  // dalam form menu itu (bukan seluruh menunya). Contoh nyata: dropdown
  // "Jenis Lokasi" di form Master Gudang, defaultnya Tetap untuk non-
  // Owner, cuma Owner yang bisa buka opsi Dinamis. Kalau nanti ada
  // kebutuhan serupa (kunci field lain), TAMBAHKAN entry baru di
  // fiturList menu terkait di sini — JANGAN bikin mekanisme baru,
  // panggil window.cekFiturAkses(menuId, fiturKey) di titik yang mau
  // dikunci (lihat auth.js untuk definisi fungsinya).
  { id: 'config_absensi', label: 'Config Absensi', kategori: 'Master Absensi', icon: 'fa-gear',
    aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-config', null, {catatRiwayat:true}); },
    fiturList: [
    { key: 'ubah_jenis_lokasi', label: 'Boleh ubah Jenis Lokasi gudang (Tetap/Dinamis)' }
  ] },
  { id: 'penjadwalan', label: 'Penjadwalan', kategori: 'Master Absensi', icon: 'fa-calendar-days',
    aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-jadwal', null, {catatRiwayat:true}); } },
  { id: 'antrean_absensi', label: 'Antrean Absensi', kategori: 'Master Absensi', icon: 'fa-clipboard-check',
    aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-accept', null, {catatRiwayat:true}); } },
  { id: 'antrean_lembur', label: 'Antrean Lembur', kategori: 'Master Absensi', icon: 'fa-business-time',
    aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-lembur', null, {catatRiwayat:true}); } },
  { id: 'antrean_reimburse', label: 'Antrean Reimburse', kategori: 'Master Keuangan', icon: 'fa-receipt',
    aksi: () => { window.pindahTab('tab-keuangan'); window.pindahSubTab('sub-keuangan', 'sub-keuangan-antrean', null, {catatRiwayat:true}); } },
  { id: 'master_kendaraan', label: 'Master Kendaraan', kategori: 'Master Keuangan', icon: 'fa-truck',
    aksi: () => { window.pindahTab('tab-keuangan'); window.pindahSubTab('sub-keuangan', 'sub-keuangan-kendaraan', null, {catatRiwayat:true}); } },
  { id: 'riwayat_reimburse', label: 'Riwayat Reimburse', kategori: 'Master Keuangan', icon: 'fa-clock-rotate-left',
    aksi: () => { window.pindahTab('tab-keuangan'); window.pindahSubTab('sub-keuangan', 'sub-keuangan-riwayat-reimburse', null, {catatRiwayat:true}); } },
  { id: 'riwayat_bensin', label: 'Riwayat Isi Bensin', kategori: 'Master Keuangan', icon: 'fa-gas-pump',
    aksi: () => { window.pindahTab('tab-keuangan'); window.pindahSubTab('sub-keuangan', 'sub-keuangan-riwayat-bensin', null, {catatRiwayat:true}); } },
  { id: 'riwayat_servis', label: 'Riwayat Servis', kategori: 'Master Keuangan', icon: 'fa-wrench',
    aksi: () => { window.pindahTab('tab-keuangan'); window.pindahSubTab('sub-keuangan', 'sub-keuangan-riwayat-servis', null, {catatRiwayat:true}); } },
  { id: 'master_keuangan', label: 'Master Keuangan', kategori: 'Master Keuangan', icon: 'fa-tags',
    aksi: () => { window.pindahTab('tab-keuangan'); window.pindahSubTab('sub-keuangan', 'sub-keuangan-kategori', null, {catatRiwayat:true}); } },
  { id: 'riwayat_absensi', label: 'Riwayat All Absensi', kategori: 'Master Absensi', icon: 'fa-clock-rotate-left',
    aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-rekap', null); } },
  { id: 'antrean_dakar', label: 'Antrean Dakar', kategori: 'Master Karyawan', icon: 'fa-user-clock',
    aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-antrean', null, {catatRiwayat:true}); } },
  { id: 'config_karyawan', label: 'Config Karyawan', kategori: 'Master Karyawan', icon: 'fa-sliders',
    aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-config', null); } },
  { id: 'daftar_karyawan', label: 'Daftar Karyawan', kategori: 'Master Karyawan', icon: 'fa-users',
    aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-data', null, {catatRiwayat:true}); } },
  { id: 'config_info', label: 'Config Info', kategori: 'Master Karyawan', icon: 'fa-bullhorn',
    aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-info', null); } },
  { id: 'slip_gaji', label: 'Slip Gaji', kategori: 'Master Karyawan', icon: 'fa-file-invoice-dollar',
    aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-slip', null); } },
  { id: 'payroll', label: 'Payroll', kategori: 'Master Karyawan', icon: 'fa-money-check-dollar',
    aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-payroll', null); } },
  { id: 'config_akses', label: 'Config Akses', kategori: 'Master Karyawan', icon: 'fa-shield-halved', wajibOwner: true,
    aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-akses', null); } },
  { id: 'hak_akses', label: 'Hak Akses', kategori: 'Master Karyawan', icon: 'fa-user-shield', wajibOwner: true,
    aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-hakakses', null, {catatRiwayat:true}); } },
  { id: 'whatsapp_gateway', label: 'WhatsApp Gateway', kategori: 'Master Integrasi', icon: 'fa-comment-dots',
    aksi: () => { window.pindahTab('tab-whatsapp'); if (window.bukaSubTabWhatsapp) window.bukaSubTabWhatsapp('monitor'); } },
  { id: 'mail_gateway', label: 'Mail Gateway', kategori: 'Master Integrasi', icon: 'fa-envelope',
    aksi: () => { window.pindahTab('tab-mail-gateway'); } },
  { id: 'device_kiosk', label: 'List Device Kiosk', kategori: 'Master Integrasi', icon: 'fa-tablet-screen-button', wajibOwner: true,
    aksi: () => { window.pindahTab('tab-device-kiosk'); } },
  // BARU (23 Agt 2026) — Zevanic House > Master Bahan & Aksesoris. id
  // SENGAJA TIDAK diubah (masih bahan_aksesoris_entry/list) walau labelnya
  // di sidebar sekarang "Data Bahan & Aksesoris" — supaya akses_config yang
  // sudah tersimpan sebelumnya (per-user) TIDAK ikut kereset/hilang.
  // BARU (27 Agt 2026, §26.1) — Zevanic House > Config (6 tab child: Jenis
  // Bahan, Jenis Aksesoris, Data Satuan, Data Warna, Data Ukuran, Data
  // Suplayer). 1 menu-id dipakai bareng ke-6nya (pola sama seperti
  // 'config_karyawan'), lihat js/vue-config.js.
  { id: 'config_master_data', label: 'Config', kategori: 'Zevanic House', icon: 'fa-sliders',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-config', null); window.pindahSubTab('sub-zh-config', 'sub-zh-config-jenisbahan', null); } },
  // BARU (28 Agt 2026, §39) — 3 aksi di bawah ini SEKARANG ikut catatRiwayat:
  // true (riwayat tombol back HP) — ini jalur PALING SERING dipakai user
  // mobile buka menu ini (lewat tile Home §27), jadi WAJIB ikut dicatat,
  // bukan cuma tombol sidebar desktop.
  { id: 'bahan_aksesoris_entry', label: 'Entry Bahan & Aksesoris', kategori: 'Zevanic House', icon: 'fa-boxes-stacked',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-databahan', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-databahan', 'sub-zh-databahan-entry', null, {catatRiwayat:true}); } },
  { id: 'bahan_aksesoris_list', label: 'List Bahan & Aksesoris', kategori: 'Zevanic House', icon: 'fa-list',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-databahan', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-databahan', 'sub-zh-databahan-list', null, {catatRiwayat:true}); } },
  // BARU (25 Agt 2026, §25) — Rak Penyimpanan.
  { id: 'bahan_aksesoris_rak', label: 'Rak Penyimpanan', kategori: 'Zevanic House', icon: 'fa-warehouse',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-databahan', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-databahan', 'sub-zh-databahan-rak', null, {catatRiwayat:true}); } },
  // BARU (24 Agt 2026) — Persiapan Masalah + Stock & Pembelian.
  { id: 'persiapan_masalah', label: 'Persiapan Masalah', kategori: 'Zevanic House', icon: 'fa-triangle-exclamation',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-persiapan', null, {catatRiwayat:true}); } },
  // DIPENSIUNKAN (27 Agt 2026, §26.1) — CRUD Suplayer dulu di
  // 'config_master_data' (menu Config). GANTI TOTAL (5 Sep 2026) — CRUD
  // Suplayer sekarang di 3 entry 'suplayer_*' di bawah (Zevanic House >
  // Master Suplayer, js/vue-master-suplayer.js). Entry ini SENGAJA
  // dibiarkan (bukan dihapus) supaya data izin lama di Firestore tidak
  // yatim tanpa penjelasan — sudah tidak dipakai komponen manapun.
  // `deprecated: true` (BARU §27) supaya juga tidak ikut nongol sebagai
  // tile basi di grid Home mobile.
  { id: 'master_suplayer', label: 'Master Suplayer (DIPENSIUNKAN, lihat Master Suplayer)', kategori: 'Zevanic House', deprecated: true },
  // BARU (5 Sep 2026, wireframe handoff "Zevanic House" grup 5 +
  // rekonstruksi Persiapan Produksi) — Master Suplayer: 3 sub-tab, lihat
  // js/vue-master-suplayer.js. Posisi SENGAJA sebelum Stock & Pembelian
  // (data Suplayer/Alias/MOQ jadi prasyarat List Order Belanja & Nota).
  { id: 'suplayer_entry', label: 'Master Suplayer - Entry & List', kategori: 'Zevanic House', icon: 'fa-truck-fast',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-suplayer', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-suplayer', 'sub-zh-suplayer-entry', null, {catatRiwayat:true}); } },
  { id: 'suplayer_alias_moq', label: 'Master Suplayer - Alias & MOQ', kategori: 'Zevanic House', icon: 'fa-tags',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-suplayer', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-suplayer', 'sub-zh-suplayer-alias-moq', null, {catatRiwayat:true}); } },
  { id: 'suplayer_petakan_order', label: 'Master Suplayer - Petakan Order', kategori: 'Zevanic House', icon: 'fa-map-location-dot',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-suplayer', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-suplayer', 'sub-zh-suplayer-petakan', null, {catatRiwayat:true}); } },
  // DIPENSIUNKAN (5 Sep 2026) — Alias Pembelian PINDAH TOTAL ke
  // 'suplayer_alias_moq' di atas (Zevanic House > Master Suplayer > Alias
  // & MOQ, DITAMBAH field moq/moq_satuan/lead_time_hari). Entry ini
  // SENGAJA dibiarkan (pola sama seperti 'master_suplayer' di atas) supaya
  // data izin lama tidak yatim — tab & mount div lamanya sudah dicopot
  // dari index.html, aksi() dihapus.
  { id: 'stock_alias_pembelian', label: 'Alias Pembelian (DIPENSIUNKAN, lihat Master Suplayer)', kategori: 'Zevanic House', icon: 'fa-tags', deprecated: true },
  { id: 'stock_list_order_belanja', label: 'List Order Belanja', kategori: 'Zevanic House', icon: 'fa-cart-shopping',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-stock', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-stock', 'sub-zh-stock-listorder', null, {catatRiwayat:true}); } },
  { id: 'stock_nota_order_belanja', label: 'Nota Order Belanja', kategori: 'Zevanic House', icon: 'fa-receipt',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-stock', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-stock', 'sub-zh-stock-notaorder', null, {catatRiwayat:true}); } },
  // DIPENSIUNKAN (28 Agt 2026, §41.2) — dulu tab "Cetak Label" tersendiri
  // di Stock & Pembelian (CetakLabelManager, js/vue-stock-pembelian.js).
  // Guru minta dipindah jadi tombol per-kartu di List Bahan & Aksesoris
  // (js/vue-bahan-aksesoris.js) — tab & mount point lamanya SUDAH DIHAPUS
  // dari index.html. Entry ini SENGAJA DIBIARKAN (bukan dihapus, pola SAMA
  // seperti 'master_suplayer' di atas) supaya data izin `print` yang SUDAH
  // Owner atur sebelumnya (siapa boleh cetak) TIDAK yatim — tombol cetak
  // yang baru di List Bahan & Aksesoris TETAP mengecek menu id INI (lihat
  // vue-bahan-aksesoris.js). `deprecated: true` supaya tidak lagi nongol
  // sebagai tile navigasi basi di Home mobile/sidebar (sudah tidak ada
  // tab tujuan yang bisa dituju lagi, aksi() dihapus).
  { id: 'stock_cetak_label', label: 'Cetak Label (DIPENSIUNKAN, lihat List Bahan & Aksesoris)', kategori: 'Zevanic House', icon: 'fa-print', deprecated: true },
  // BARU (27 Agt 2026, §28) — Master Produk (BOM): lihat js/vue-master-
  // produk.js. Posisi SENGAJA setelah Stock & Pembelian, sebelum Order
  // SPK (keputusan Hilman, AskUserQuestion ronde 4).
  { id: 'master_produk_entry', label: 'Entry Produk', kategori: 'Zevanic House', icon: 'fa-box-open',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-produk', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-produk', 'sub-zh-produk-entry', null, {catatRiwayat:true}); } },
  { id: 'master_produk_list', label: 'List Produk', kategori: 'Zevanic House', icon: 'fa-list',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-produk', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-produk', 'sub-zh-produk-list', null, {catatRiwayat:true}); } },
  // DIPENSIUNKAN (30 Agt 2026, fitur "Pesanan", keputusan Guru:
  // "Pesaanan (Menu Group Baru)... 1. Order SPK (ganti nama jadi Penjualan
  // Kasir)... 2. Menunggu Proses") — fungsi CRUD Order SPK (list/edit/
  // hapus/cetak label) PINDAH TOTAL ke 'pesanan_menunggu' (kategori baru
  // "Pesanan"), file js/vue-pesanan.js (kode DISALIN & disesuaikan dari
  // js/vue-order-spk.js, BUKAN diimpor — konvensi proyek ini). Tombol
  // sidebar & tab-content lama SUDAH DICOPOT dari index.html (js/vue-
  // order-spk.js TIDAK LAGI dimuat, pola SAMA seperti persiapan_produksi_*
  // di atas). `deprecated: true` supaya izin lama yang sudah diatur Owner
  // per akun TIDAK yatim/error, id ini TETAP ADA di daftar tapi tidak lagi
  // nongol sebagai tile navigasi.
  { id: 'order_spk', label: 'Order SPK (DIPENSIUNKAN, lihat Pesanan > Menunggu Proses)', kategori: 'Zevanic House', deprecated: true },
  // DIPENSIUNKAN (29 Agt 2026, koreksi arsitektur menu Persiapan Produksi
  // — Guru: "ralat mending bikin group menu baru namanya Persiapan
  // Produksi supaya tersusun rapih ... sejajar dengan zevanic house").
  // `deprecated: true` (pola SAMA seperti 'master_suplayer'/
  // 'stock_cetak_label' di atas) — id-id ini TETAP ADA di daftar (jangan
  // sampai config akses lama yang sudah terlanjur mengatur izinnya error),
  // tapi tombolnya sudah dicopot dari index.html jadi tidak lagi bisa
  // diklik/dituju. GANTI TOTAL oleh 6 menu-id baru kategori "Persiapan
  // Produksi" di bawah (lihat js/vue-persiapan-produksi-v2.js).
  { id: 'persiapan_produksi_antrean', label: 'Persiapan Produksi - Perlu Disiapkan (LAMA, lihat kategori Persiapan Produksi)', kategori: 'Zevanic House', deprecated: true },
  { id: 'persiapan_produksi_bahan', label: 'Persiapan Produksi - Persiapan Bahan (LAMA, lihat kategori Persiapan Produksi)', kategori: 'Zevanic House', deprecated: true },
  { id: 'persiapan_produksi_sewing', label: 'Persiapan Produksi - Persiapan Acc Sewing (LAMA, lihat kategori Persiapan Produksi)', kategori: 'Zevanic House', deprecated: true },
  { id: 'persiapan_produksi_webbing', label: 'Persiapan Produksi - Persiapan Acc Webbing (LAMA, lihat kategori Persiapan Produksi)', kategori: 'Zevanic House', deprecated: true },
  { id: 'persiapan_produksi_finishing', label: 'Persiapan Produksi - Persiapan Acc Finishing (LAMA, lihat kategori Persiapan Produksi)', kategori: 'Zevanic House', deprecated: true },
  // BARU (29 Agt 2026, koreksi arsitektur menu) — Persiapan Produksi V2:
  // 6 menu-id, kategori SENDIRI "Persiapan Produksi" (BUKAN "Zevanic
  // House" lagi — sekarang grup sidebar top-level sendiri, sejajar Zevanic
  // House). Lihat js/vue-persiapan-produksi-v2.js & STATUS-PROYEK.md
  // §44.13. Fase 1: cuma 'pp_disiapkan' yang fungsional; 5 sisanya
  // (jalur) sudah bisa diberi izin dari sekarang walau isinya masih
  // placeholder, supaya Config Akses tidak perlu disentuh lagi nanti pas
  // Fase 2-5 mengisi logic-nya.
  { id: 'pp_disiapkan', label: 'Persiapan Produksi - Perlu Disiapkan', kategori: 'Persiapan Produksi', icon: 'fa-list-check',
    aksi: () => { window.pindahTab('tab-persiapan-produksi'); window.pindahSubTab('sub-persiapan-produksi', 'sub-pp-disiapkan', null, {catatRiwayat:true}); } },
  { id: 'pp_vendor', label: 'Persiapan Produksi - Vendor', kategori: 'Persiapan Produksi', icon: 'fa-handshake',
    aksi: () => { window.pindahTab('tab-persiapan-produksi'); window.pindahSubTab('sub-persiapan-produksi', 'sub-pp-vendor', null, {catatRiwayat:true}); window.pindahSubTab('sub-pp-vendor-tahap', 'sub-pp-vendor-perludiproses', null, {catatRiwayat:true}); } },
  { id: 'pp_bahan', label: 'Persiapan Produksi - Bahan', kategori: 'Persiapan Produksi', icon: 'fa-scroll',
    aksi: () => { window.pindahTab('tab-persiapan-produksi'); window.pindahSubTab('sub-persiapan-produksi', 'sub-pp-bahan', null, {catatRiwayat:true}); window.pindahSubTab('sub-pp-bahan-tahap', 'sub-pp-bahan-perludiproses', null, {catatRiwayat:true}); } },
  { id: 'pp_sewing', label: 'Persiapan Produksi - Acc Sewing', kategori: 'Persiapan Produksi', icon: 'fa-scissors',
    aksi: () => { window.pindahTab('tab-persiapan-produksi'); window.pindahSubTab('sub-persiapan-produksi', 'sub-pp-sewing', null, {catatRiwayat:true}); window.pindahSubTab('sub-pp-sewing-tahap', 'sub-pp-sewing-perludiproses', null, {catatRiwayat:true}); } },
  { id: 'pp_webbing', label: 'Persiapan Produksi - Acc Webbing', kategori: 'Persiapan Produksi', icon: 'fa-ribbon',
    aksi: () => { window.pindahTab('tab-persiapan-produksi'); window.pindahSubTab('sub-persiapan-produksi', 'sub-pp-webbing', null, {catatRiwayat:true}); window.pindahSubTab('sub-pp-webbing-tahap', 'sub-pp-webbing-perludiproses', null, {catatRiwayat:true}); } },
  { id: 'pp_finishing', label: 'Persiapan Produksi - Acc Finishing', kategori: 'Persiapan Produksi', icon: 'fa-check-double',
    aksi: () => { window.pindahTab('tab-persiapan-produksi'); window.pindahSubTab('sub-persiapan-produksi', 'sub-pp-finishing', null, {catatRiwayat:true}); window.pindahSubTab('sub-pp-finishing-tahap', 'sub-pp-finishing-perludiproses', null, {catatRiwayat:true}); } },
  // BARU (30 Agt 2026) — grup top-level "Pesanan" (sejajar Zevanic House/
  // Persiapan Produksi), keputusan Guru lewat AskUserQuestion + spesifikasi
  // final: "Pesaanan (Menu Group Baru), didalam group menu pesanan
  // adalah: 1. Order SPK (ganti nama jadi Penjualan Kasir) > tampilan
  // seperti request order, 2. Menunggu Proses, 3. Proses Persiapan
  // (ringkasan data tarikan dari proses persiapan produksi), 4. Proses
  // Produksi (ringkasan data tarikan dari proses persiapan produksi),
  // 5. Proses Pengiriman". Lihat js/vue-pesanan.js utk detail lengkap tiap
  // menu (kode grouping/asumsi yang belum eksplisit dikonfirmasi Guru
  // didokumentasikan di komentar atas file itu, BUKAN cuma di sini).
  { id: 'pesanan_kasir', label: 'Penjualan Kasir', kategori: 'Pesanan', icon: 'fa-cash-register',
    aksi: () => { window.pindahTab('tab-pesanan'); window.pindahSubTab('sub-pesanan', 'sub-pesanan-kasir', null, {catatRiwayat:true}); } },
  { id: 'pesanan_menunggu', label: 'Menunggu Proses', kategori: 'Pesanan', icon: 'fa-clipboard-list',
    aksi: () => { window.pindahTab('tab-pesanan'); window.pindahSubTab('sub-pesanan', 'sub-pesanan-menunggu', null, {catatRiwayat:true}); } },
  { id: 'pesanan_persiapan', label: 'Proses Persiapan', kategori: 'Pesanan', icon: 'fa-list-check',
    aksi: () => { window.pindahTab('tab-pesanan'); window.pindahSubTab('sub-pesanan', 'sub-pesanan-persiapan', null, {catatRiwayat:true}); } },
  { id: 'pesanan_produksi', label: 'Proses Produksi', kategori: 'Pesanan', icon: 'fa-gears',
    aksi: () => { window.pindahTab('tab-pesanan'); window.pindahSubTab('sub-pesanan', 'sub-pesanan-produksi', null, {catatRiwayat:true}); } },
  { id: 'pesanan_pengiriman', label: 'Proses Pengiriman', kategori: 'Pesanan', icon: 'fa-truck-fast',
    aksi: () => { window.pindahTab('tab-pesanan'); window.pindahSubTab('sub-pesanan', 'sub-pesanan-pengiriman', null, {catatRiwayat:true}); } },
  // BARU (27 Agt 2026, §26.4) — Scan > Scan Opname: lihat js/vue-scan-
  // opname.js. Aksi catat penyesuaian dicek lewat kolom 'edit'. Gating
  // "mobile-only untuk non-Owner" TIDAK lewat kolom izin ini — itu
  // hardcode `window.currentUser.role === 'owner'` di file itu sendiri
  // (pola sama seperti Config Akses/Hak Akses/Device Kiosk di auth.js),
  // menu-id ini CUMA buat kontrol boleh/tidaknya menyimpan (di atas
  // gerbang mobile itu, bukan pengganti).
  { id: 'scan_opname', label: 'Scan Opname', kategori: 'Zevanic House', icon: 'fa-qrcode',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-scan', null); window.pindahSubTab('sub-zh-scan', 'sub-zh-scan-opname', null); } },
  // BARU (27 Agt 2026, §26.5, Tahap 5 — TAHAP TERAKHIR) — Scan > Scan
  // Persiapan: lihat js/vue-scan-persiapan.js. Aksi catat pemakaian dicek
  // lewat kolom 'edit'. Gating "mobile-only utk non-Owner" TETAP hardcode
  // role === 'owner' di file itu sendiri (SAMA seperti Scan Opname) —
  // menu-id ini CUMA buat kontrol boleh/tidaknya menyimpan, bukan
  // pengganti gerbang mobile itu.
  { id: 'scan_persiapan', label: 'Scan Persiapan', kategori: 'Zevanic House', icon: 'fa-boxes-stacked',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-scan', null); window.pindahSubTab('sub-zh-scan', 'sub-zh-scan-persiapan', null); } }
];

// BARU (29 Agt 2026, koreksi arsitektur menu) — 'Persiapan Produksi'
// kategori BARU, sejajar 'Zevanic House' (dulu sub-menu di dalamnya).
// Posisi SENGAJA setelah Zevanic House (urutan sidebar desktop & mobile
// pakai array ini juga, lihat js/vue-components.js daftarMenuGroups()).
// BARU (30 Agt 2026, fitur "Pesanan") — kategori baru 'Pesanan', posisi
// SENGAJA setelah 'Zevanic House' dan SEBELUM 'Persiapan Produksi' — Kasir
// (di 'Pesanan') MENGHASILKAN SPK yang mengalir ke 'Persiapan Produksi',
// jadi urutan sidebar mengikuti alur kerja (Zevanic House data master ->
// Pesanan jual -> Persiapan Produksi kerjakan). Posisi ini ASUMSI (belum
// eksplisit dikonfirmasi Guru soal urutan pastinya) — gampang digeser
// tinggal ubah array ini kalau Guru mau urutan lain.
export const KATEGORI_URUTAN = ['Umum', 'Master Absensi', 'Master Keuangan', 'Master Karyawan', 'Master Integrasi', 'Zevanic House', 'Pesanan', 'Persiapan Produksi'];
export { DAFTAR_MENU };
const KOSONG_IZIN = () => ({ view: false, add: false, edit: false, delete: false, print: false });

// Default awal untuk 5 profil baku SENGAJA disamakan dengan perilaku
// hardcode yang sudah jalan sekarang (lihat auth.js) — supaya profil ini
// begitu pertama dibuka sudah masuk akal, bukan kosong semua.
function bikinDefaultProfil(namaProfil) {
  const menus = {};
  DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN(); });

  const semua = (id) => { menus[id] = { view: true, add: true, edit: true, delete: true, print: true }; };
  const lihatSaja = (id) => { menus[id].view = true; };

  if (namaProfil === 'owner') {
    DAFTAR_MENU.forEach(m => semua(m.id));
  } else if (namaProfil === 'superuser') {
    // ATURAN TETAP (18 Agt 2026, permintaan eksplisit): menu BARU yang
    // ditambahkan ke DAFTAR_MENU TIDAK LAGI otomatis ikut ke sini. Dulu
    // Superuser = Owner untuk SEMUA menu (blanket, ikut DAFTAR_MENU
    // apapun isinya) — sekarang daftar di bawah ini FIXED/snapshot,
    // cuma menu yang SUDAH ADA per tanggal ini. Menu baru ke depan
    // default-nya CUMA Owner yang bisa akses, sampai Owner atur manual
    // lewat Config Akses kalau memang mau dibagikan ke Superuser juga.
    // JANGAN tambahkan menu baru ke daftar ini secara otomatis — biarkan
    // Owner yang putuskan & atur sendiri lewat tampilan Config Akses.
    [
      'dashboard', 'profile',
      'config_absensi', 'penjadwalan', 'antrean_absensi', 'antrean_lembur', 'riwayat_absensi',
      'antrean_dakar', 'config_karyawan', 'daftar_karyawan', 'config_info', 'slip_gaji', 'payroll',
      'whatsapp_gateway', 'mail_gateway'
      // SENGAJA TIDAK termasuk: config_akses, hak_akses — khusus Owner
      // asli, sudah begitu sejak awal fitur ini dibuat, bukan hal baru.
    ].forEach(semua);
  } else if (namaProfil === 'pic' || namaProfil === 'admin') {
    lihatSaja('dashboard');
    menus.profile = { view: true, add: true, edit: true, delete: false, print: false };
    ['config_absensi', 'penjadwalan', 'antrean_absensi', 'antrean_lembur', 'riwayat_absensi'].forEach(semua);
    // Contoh nyata pemakaian fitur granular: Admin/PIC boleh kelola
    // Master Gudang sepenuhnya (view/add/edit/delete/print semua true di
    // atas), TAPI khusus dropdown "Jenis Lokasi"-nya tetap terkunci ke
    // Tetap — cuma Owner yang bisa buka opsi Dinamis.
    menus.config_absensi.fitur = { ubah_jenis_lokasi: false };
  } else {
    lihatSaja('dashboard');
    menus.profile = { view: true, add: true, edit: true, delete: false, print: false };
  }
  return menus;
}

const PROFIL_BAKU = ['operator', 'pic', 'admin', 'owner', 'superuser'];

const AppConfigAkses = {
  setup() {
    const daftarProfil = ref([]); // nama-nama profil yang sudah pernah disimpan
    const memuat = ref(true);
    const menyimpan = ref(false);

    const namaAkses = ref('');
    const profilDipilih = ref('');
    // tingkatKeamanan: 1 dari 5 nama baku, INI yang benar-benar dikirim
    // ke Firestore Rules lewat custom claim (field "role" di data
    // karyawan). Nama profil di "namaAkses" cuma dipakai buat cari izin
    // TAMPILAN, tidak pernah sampai ke Rules. Default 'operator' (paling
    // rendah) — sengaja bukan default tinggi, biar profil baru yang lupa
    // diatur tidak tiba-tiba dapat akses tulis luas.
    const tingkatKeamanan = ref('operator');
    const menus = reactive({});
    // pastikanFiturAda: kalau menu ini punya fiturList (kontrol granular
    // tambahan), pastikan menus[id].fitur SELALU ada sebagai objek —
    // supaya template (v-model="menus[m.id].fitur[f.key]") tidak error
    // kalau datanya belum pernah tersimpan sama sekali.
    function pastikanFiturAda(menuId) {
      const def = DAFTAR_MENU.find(m => m.id === menuId);
      if (def && def.fiturList && !menus[menuId].fitur) menus[menuId].fitur = {};
    }
    DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN(); pastikanFiturAda(m.id); });

    const kategoriTerbuka = reactive({});
    KATEGORI_URUTAN.forEach(k => { kategoriTerbuka[k] = true; });
    function toggleKategori(k) { kategoriTerbuka[k] = !kategoriTerbuka[k]; }

    // BARU (27 Agt 2026, §27 — Redesain Home Mobile), N diubah 5->4 di
    // §27.1 — Urutan Menu di Home Mobile. Home mobile cuma nampilkan 4
    // menu PALING ATAS per kategori (sisanya lewat "Lihat Semua") — urutan
    // 4 teratas itu diatur di sini, bukan ditebak. Disimpan 1 dokumen
    // tunggal, dibaca vue-home.js tiap kali Home dimuat (1x getDoc, hemat
    // baca). Menu yang belum pernah diatur otomatis ikut urutan asli
    // DAFTAR_MENU di posisi paling akhir (self-healing kalau ada menu baru
    // ditambah belakangan).
    const urutanMenu = reactive({});
    const urutanTerbuka = reactive({});
    const menyimpanUrutan = ref(false);
    // BARU (27 Agt 2026, sesi lanjutan §27.2) — urutanKategoriArr: urutan
    // KATEGORI/GRUP itu sendiri (mis. Zevanic House di atas/bawah Master
    // Absensi), TERPISAH dari urutanMenu (urutan menu DI DALAM 1 kategori,
    // sudah ada sejak §27.1). Disimpan 1 dokumen yang SAMA (field baru
    // `urutanKategori`, array nama kategori) — dipakai bareng oleh Home
    // mobile (urutan grup di grid) DAN sidebar desktop (urutan grup +
    // urutan tombol tab di dalam halaman Master Absensi/Keuangan/Karyawan/
    // Zevanic House, lihat window.terapkanUrutanMenuDesktop di auth.js).
    const urutanKategoriArr = ref([]);
    function labelMenu(id) { const m = DAFTAR_MENU.find(x => x.id === id); return m ? m.label : id; }
    async function muatUrutanMenu() {
      const kategoriDipakai = KATEGORI_URUTAN.filter(k => k !== 'Umum');
      kategoriDipakai.forEach(k => { urutanTerbuka[k] = false; });
      let perKategoriTersimpan = {};
      let urutanKategoriTersimpan = [];
      try {
        const snap = await getDoc(doc(db, 'pengaturan_sistem', 'urutan_menu_home'));
        if (snap.exists()) {
          perKategoriTersimpan = snap.data().perKategori || {};
          urutanKategoriTersimpan = snap.data().urutanKategori || [];
        }
      } catch (e) {
        console.error('Gagal muat urutan menu Home mobile:', e);
      }
      kategoriDipakai.forEach(k => {
        const idsAsli = DAFTAR_MENU.filter(m => m.kategori === k && !m.deprecated).map(m => m.id);
        const tersimpan = (perKategoriTersimpan[k] || []).filter(id => idsAsli.includes(id));
        const belumAda = idsAsli.filter(id => !tersimpan.includes(id));
        urutanMenu[k] = [...tersimpan, ...belumAda];
      });
      // Self-healing sama seperti urutanMenu: kategori tersimpan yang masih
      // valid dipertahankan urutannya, kategori baru (belum pernah diatur)
      // otomatis nambah di paling akhir.
      const katTersimpanValid = urutanKategoriTersimpan.filter(k => kategoriDipakai.includes(k));
      const katBelumAda = kategoriDipakai.filter(k => !katTersimpanValid.includes(k));
      urutanKategoriArr.value = [...katTersimpanValid, ...katBelumAda];
    }
    function naikkanUrutan(kategori, idx) {
      if (idx <= 0) return;
      const arr = urutanMenu[kategori];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    }
    function turunkanUrutan(kategori, idx) {
      const arr = urutanMenu[kategori];
      if (idx >= arr.length - 1) return;
      [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
    }
    function naikkanKategori(idx) {
      if (idx <= 0) return;
      const arr = urutanKategoriArr.value;
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    }
    function turunkanKategori(idx) {
      const arr = urutanKategoriArr.value;
      if (idx >= arr.length - 1) return;
      [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
    }
    async function simpanUrutanMenu() {
      menyimpanUrutan.value = true;
      try {
        const perKategori = {};
        KATEGORI_URUTAN.filter(k => k !== 'Umum').forEach(k => { perKategori[k] = urutanMenu[k] || []; });
        await setDoc(doc(db, 'pengaturan_sistem', 'urutan_menu_home'), { perKategori, urutanKategori: urutanKategoriArr.value });
        alert('Urutan menu Home mobile & desktop berhasil disimpan!');
      } catch (e) {
        console.error('Gagal simpan urutan menu Home mobile:', e);
        alert('Gagal menyimpan urutan menu.');
      }
      menyimpanUrutan.value = false;
    }

    const cariMenu = ref('');
    function menuUntukKategori(kategori) {
      const kata = cariMenu.value.trim().toLowerCase();
      return DAFTAR_MENU.filter(m => m.kategori === kategori && (!kata || m.label.toLowerCase().includes(kata)));
    }

    // Checkbox "pilih semua" di header kolom (View/Add/Edit/Delete/Print) —
    // cakupannya cuma menu-menu di dalam kategori itu saja, tidak ikut
    // menyentuh kategori lain.
    function semuaTercentangKolom(kategori, field) {
      const daftarMenu = menuUntukKategori(kategori);
      return daftarMenu.length > 0 && daftarMenu.every(m => menus[m.id][field]);
    }
    function toggleKolomKategori(kategori, field) {
      const nilaiBaru = !semuaTercentangKolom(kategori, field);
      menuUntukKategori(kategori).forEach(m => { menus[m.id][field] = nilaiBaru; });
    }

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDocs(collection(db, "akses_config"));
        const namaTersimpan = [];
        snap.forEach(d => namaTersimpan.push(d.id));
        // Gabungkan dengan profil baku (biar selalu muncul di daftar
        // pilihan meski belum pernah disimpan sekalipun) — KECUALI "owner",
        // sengaja disembunyikan dari daftar pilih/edit karena Owner wajib
        // selalu punya akses penuh ke segalanya, tidak boleh dikonfigurasi
        // (dikecilkan) lewat layar ini sama sekali.
        const gabungan = [...new Set([...PROFIL_BAKU, ...namaTersimpan])]
          .filter(nama => nama !== 'owner')
          .sort();
        daftarProfil.value = gabungan;

        if (!profilDipilih.value && gabungan.length > 0) {
          await pilihProfil(gabungan[0]);
        }
      } catch (e) {
        console.error("Gagal muat daftar profil akses:", e);
      }
      memuat.value = false;
    }

    async function pilihProfil(nama) {
      if (!nama) { mulaiProfilBaru(); return; }
      profilDipilih.value = nama;
      namaAkses.value = nama;
      try {
        const snap = await getDoc(doc(db, "akses_config", nama));
        const data = snap.exists() ? snap.data() : null;
        const dataMenus = data ? (data.menus || {}) : null;
        // Profil baku (operator/pic/admin/owner/superuser): tingkat
        // keamanannya SAMA DENGAN namanya sendiri, kecuali sudah pernah
        // disimpan beda secara eksplisit. Profil kustom yang belum pernah
        // diatur: default 'operator' (paling aman/rendah).
        tingkatKeamanan.value = data?.tingkatKeamanan || (PROFIL_BAKU.includes(nama) ? nama : 'operator');
        DAFTAR_MENU.forEach(m => {
          menus[m.id] = dataMenus && dataMenus[m.id] ? { ...KOSONG_IZIN(), ...dataMenus[m.id] } : (
            PROFIL_BAKU.includes(nama) ? bikinDefaultProfil(nama)[m.id] : KOSONG_IZIN()
          );
          pastikanFiturAda(m.id);
        });
      } catch (e) {
        console.error("Gagal muat profil akses:", nama, e);
      }
    }

    function mulaiProfilBaru() {
      profilDipilih.value = '';
      namaAkses.value = '';
      tingkatKeamanan.value = 'operator';
      DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN(); pastikanFiturAda(m.id); });
    }

    async function simpan() {
      const nama = namaAkses.value.trim();
      if (!nama) return alert("Nama Akses harus diisi!");
      if (nama.toLowerCase() === 'owner') {
        return alert("Nama \"owner\" tidak boleh dipakai — Owner wajib selalu punya akses penuh dan tidak boleh dikonfigurasi lewat layar ini.");
      }

      menyimpan.value = true;
      try {
        const menusPolos = {};
        DAFTAR_MENU.forEach(m => { menusPolos[m.id] = { ...menus[m.id] }; });
        await setDoc(doc(db, "akses_config", nama), { nama, tingkatKeamanan: tingkatKeamanan.value, menus: menusPolos });
        alert(`Profil akses "${nama}" berhasil disimpan!`);
        profilDipilih.value = nama;
        await muat();
      } catch (e) {
        console.error("Gagal simpan profil akses:", e);
        alert("Gagal menyimpan profil akses.");
      }
      menyimpan.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); muatUrutanMenu(); });

    return {
      daftarProfil, memuat, menyimpan, muat,
      namaAkses, profilDipilih, pilihProfil, mulaiProfilBaru, simpan,
      tingkatKeamanan, TINGKAT_KEAMANAN_BAKU,
      menus, KATEGORI_URUTAN, kategoriTerbuka, toggleKategori, menuUntukKategori, cariMenu,
      semuaTercentangKolom, toggleKolomKategori,
      urutanMenu, urutanTerbuka, menyimpanUrutan, labelMenu, naikkanUrutan, turunkanUrutan, simpanUrutanMenu,
      urutanKategoriArr, naikkanKategori, turunkanKategori
    };
  },
  template: `
    <div>
      <div class="gc-card" style="background:var(--blue); border:none; margin-bottom:16px;">
        <h4 class="gc-heading" style="font-weight:700; font-size:13px; color:#1F5060;"><i class="fas fa-shield-halved" style="margin-right:8px;"></i> Config Akses</h4>
        <p style="font-size:11px; color:#1F5060; margin-top:4px; opacity:.85;">Buat atau ubah profil akses — tiap profil punya izin View/Add/Edit/Delete/Print sendiri per menu. Profil ini nanti dipilih untuk tiap karyawan di tab Hak Akses.</p>
      </div>

      <div class="gc-card" style="margin-bottom:16px; border:1.5px solid var(--burgundy);">
        <h4 class="gc-heading" style="font-size:12.5px; font-weight:700; margin-bottom:6px;"><i class="fas fa-shield-halved" style="color:var(--burgundy); margin-right:8px;"></i> Tingkat Keamanan Dasar</h4>
        <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">Profil ini boleh dinamai bebas, tapi untuk KEAMANAN DATA (Firestore Rules), harus setara dengan salah satu dari 5 tingkat baku berikut. Ini yang menentukan bisa/tidaknya karyawan dengan profil ini benar-benar MENYIMPAN data (bukan cuma soal tampil/sembunyi menu).</p>
        <div class="gc-field" style="margin-bottom:0; max-width:280px;">
          <label>Setara dengan tingkat</label>
          <select v-model="tingkatKeamanan">
            <option v-for="t in TINGKAT_KEAMANAN_BAKU" :key="t" :value="t">{{ t.toUpperCase() }}</option>
          </select>
        </div>
      </div>

      <div class="gc-card" style="margin-bottom:16px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;" class="md:grid-cols-2">
          <div class="gc-field" style="margin-bottom:0;">
            <label>Pilih profil untuk diedit (atau buat baru)</label>
            <select :value="profilDipilih" @change="pilihProfil($event.target.value)">
              <option value="">+ Buat profil baru</option>
              <option v-for="p in daftarProfil" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
          <div class="gc-field" style="margin-bottom:0;">
            <label>Nama akses{{ profilDipilih ? ' (nama profil yang sedang diedit, tidak bisa diganti di sini)' : '' }}</label>
            <input v-model="namaAkses" type="text" placeholder="Contoh: admin_gudang_utama" :disabled="!!profilDipilih" :style="profilDipilih ? 'background:var(--ivory-dim); color:var(--text-muted); cursor:not-allowed;' : ''">
          </div>
        </div>
        <button @click="simpan" :disabled="menyimpan" class="btn-primary block">
          <i class="fas" :class="profilDipilih ? 'fa-rotate' : 'fa-save'" style="margin-right:8px;"></i>
          {{ menyimpan ? 'Menyimpan...' : (profilDipilih ? 'Update profil akses' : 'Simpan profil akses (baru)') }}
        </button>
      </div>

      <div class="gc-card" style="margin-bottom:16px; border:1.5px solid var(--burgundy);">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:6px; flex-wrap:wrap;">
          <h4 class="gc-heading" style="font-size:12.5px; font-weight:700;"><i class="fas fa-arrow-down-wide-short" style="color:var(--burgundy); margin-right:8px;"></i> Urutan Menu di Home Mobile & Sidebar Desktop</h4>
          <button @click="simpanUrutanMenu" :disabled="menyimpanUrutan" class="btn-primary" style="padding:8px 16px; font-size:11.5px;">
            <i class="fas" :class="menyimpanUrutan ? 'fa-spinner fa-spin' : 'fa-save'" style="margin-right:6px;"></i>{{ menyimpanUrutan ? 'Menyimpan...' : 'Simpan Urutan' }}
          </button>
        </div>
        <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">Urutan di sini dipakai BARENG untuk grid Home mobile (4 menu paling atas per kategori yang tampil duluan, sisanya lewat "Lihat Semua") DAN posisi tombol di sidebar desktop (termasuk tab di dalam halaman Master Absensi/Keuangan/Karyawan/Zevanic House) — 1x atur, dua-duanya ikut.</p>

        <div style="margin-bottom:14px; border:1px solid var(--line); border-radius:12px; padding:10px 12px; background:var(--ivory-dim);">
          <p style="font-size:11px; font-weight:700; margin-bottom:8px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.03em;">Urutan Kategori (Grup Menu)</p>
          <div v-for="(kategori, idxKat) in urutanKategoriArr" :key="'kat-'+kategori" style="display:flex; align-items:center; justify-content:space-between; padding:6px 8px; border-bottom:1px solid var(--line); gap:8px;">
            <span style="font-size:12px; flex:1;"><span style="display:inline-block; width:20px; color:var(--text-faint); font-weight:700;">{{ idxKat + 1 }}.</span>{{ kategori }}</span>
            <span style="display:flex; gap:4px; flex:none;">
              <button @click="naikkanKategori(idxKat)" :disabled="idxKat===0" style="background:var(--surface); border:1px solid var(--line); border-radius:6px; width:26px; height:26px; cursor:pointer;" :style="idxKat===0 ? 'opacity:.3;' : ''"><i class="fas fa-arrow-up" style="font-size:10px;"></i></button>
              <button @click="turunkanKategori(idxKat)" :disabled="idxKat === urutanKategoriArr.length - 1" style="background:var(--surface); border:1px solid var(--line); border-radius:6px; width:26px; height:26px; cursor:pointer;" :style="idxKat === urutanKategoriArr.length - 1 ? 'opacity:.3;' : ''"><i class="fas fa-arrow-down" style="font-size:10px;"></i></button>
            </span>
          </div>
        </div>

        <div v-for="kategori in urutanKategoriArr" :key="'urutan-'+kategori" style="margin-bottom:10px; border:1px solid var(--line); border-radius:12px; overflow:hidden;">
          <div @click="urutanTerbuka[kategori] = !urutanTerbuka[kategori]" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; cursor:pointer; background:var(--ivory-dim);">
            <span style="font-size:12px; font-weight:700;">{{ kategori }} <span style="font-size:10px; color:var(--text-faint); font-weight:600;">({{ (urutanMenu[kategori]||[]).length }} menu)</span></span>
            <i class="fas" :class="urutanTerbuka[kategori] ? 'fa-chevron-up' : 'fa-chevron-down'" style="color:var(--text-muted); font-size:11px;"></i>
          </div>
          <div v-show="urutanTerbuka[kategori]" style="padding:8px 10px;">
            <div v-for="(id, idx) in (urutanMenu[kategori] || [])" :key="id" style="display:flex; align-items:center; justify-content:space-between; padding:6px 8px; border-bottom:1px solid var(--line); gap:8px;">
              <span style="font-size:12px; flex:1;">
                <span style="display:inline-block; width:20px; color:var(--text-faint); font-weight:700;">{{ idx + 1 }}.</span>
                {{ labelMenu(id) }}
                <span v-if="idx < 4" style="font-size:9px; font-weight:800; color:var(--ok); background:var(--ok-light); padding:1px 6px; border-radius:999px; margin-left:6px; white-space:nowrap;">tampil duluan</span>
              </span>
              <span style="display:flex; gap:4px; flex:none;">
                <button @click="naikkanUrutan(kategori, idx)" :disabled="idx===0" style="background:var(--surface); border:1px solid var(--line); border-radius:6px; width:26px; height:26px; cursor:pointer;" :style="idx===0 ? 'opacity:.3;' : ''"><i class="fas fa-arrow-up" style="font-size:10px;"></i></button>
                <button @click="turunkanUrutan(kategori, idx)" :disabled="idx === (urutanMenu[kategori]||[]).length - 1" style="background:var(--surface); border:1px solid var(--line); border-radius:6px; width:26px; height:26px; cursor:pointer;" :style="idx === (urutanMenu[kategori]||[]).length - 1 ? 'opacity:.3;' : ''"><i class="fas fa-arrow-down" style="font-size:10px;"></i></button>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="memuat" style="text-align:center; padding:40px 0; color:var(--text-faint);">
        <i class="fas fa-spinner fa-spin" style="font-size:24px; margin-bottom:8px; display:block;"></i>Memuat...
      </div>

      <div v-else style="position:relative; margin-bottom:14px;">
        <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
        <input v-model="cariMenu" type="text" placeholder="Cari nama menu..." style="width:100%; max-width:320px; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
      </div>

      <div v-if="!memuat" v-for="kategori in KATEGORI_URUTAN" :key="kategori" class="gc-card" style="margin-bottom:12px; padding:0; overflow:hidden;">
        <div @click="toggleKategori(kategori)" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; cursor:pointer; background:var(--ivory-dim);">
          <h3 class="gc-heading" style="font-size:13px; font-weight:700;">{{ kategori }}</h3>
          <i class="fas" :class="kategoriTerbuka[kategori] ? 'fa-chevron-up' : 'fa-chevron-down'" style="color:var(--text-muted);"></i>
        </div>
        <div v-show="kategoriTerbuka[kategori]" class="gc-table-scroll">
          <table class="gc-table" style="table-layout:fixed; min-width:640px;">
            <thead>
              <tr>
                <th class="freeze freeze-left" style="width:220px;">Nama menu</th>
                <th style="width:84px; text-align:center;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="checkbox" :checked="semuaTercentangKolom(kategori, 'view')" @change="toggleKolomKategori(kategori, 'view')" style="accent-color:var(--burgundy); width:14px; height:14px;">
                    <span>View</span>
                  </div>
                </th>
                <th style="width:84px; text-align:center;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="checkbox" :checked="semuaTercentangKolom(kategori, 'add')" @change="toggleKolomKategori(kategori, 'add')" style="accent-color:var(--burgundy); width:14px; height:14px;">
                    <span>Add</span>
                  </div>
                </th>
                <th style="width:84px; text-align:center;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="checkbox" :checked="semuaTercentangKolom(kategori, 'edit')" @change="toggleKolomKategori(kategori, 'edit')" style="accent-color:var(--burgundy); width:14px; height:14px;">
                    <span>Edit</span>
                  </div>
                </th>
                <th style="width:84px; text-align:center;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="checkbox" :checked="semuaTercentangKolom(kategori, 'delete')" @change="toggleKolomKategori(kategori, 'delete')" style="accent-color:var(--burgundy); width:14px; height:14px;">
                    <span>Delete</span>
                  </div>
                </th>
                <th style="width:84px; text-align:center;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="checkbox" :checked="semuaTercentangKolom(kategori, 'print')" @change="toggleKolomKategori(kategori, 'print')" style="accent-color:var(--burgundy); width:14px; height:14px;">
                    <span>Print</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in menuUntukKategori(kategori)" :key="m.id">
                <td class="freeze freeze-left" style="font-weight:600;">{{ m.label }}</td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].view" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].add" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].edit" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].delete" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].print" style="accent-color:var(--ok); width:16px; height:16px;"></td>
              </tr>
              <tr v-for="m in menuUntukKategori(kategori).filter(x => x.fiturList)" :key="m.id + '-fitur'">
                <td colspan="6" style="background:var(--ivory-dim); padding:10px 12px;">
                  <div style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.03em; margin-bottom:6px;">Kontrol tambahan — {{ m.label }}</div>
                  <label v-for="f in m.fiturList" :key="f.key" style="display:flex; align-items:center; gap:8px; font-size:12px; padding:4px 0; cursor:pointer;">
                    <input type="checkbox" v-model="menus[m.id].fitur[f.key]" style="accent-color:var(--ok); width:15px; height:15px;">
                    {{ f.label }}
                  </label>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
};

let vmConfigAkses = null;
// Perbaikan bug BESAR: komponen ini dulu langsung di-mount() begitu file ini
// dimuat (artinya SETIAP kali halaman dibuka, oleh SIAPAPUN, termasuk yang
// tidak punya akses ke layar ini) — onMounted-nya otomatis mencoba fetch
// Firestore walau orangnya tidak pernah membuka tab ini sama sekali. Itu
// yang bikin console penuh "Missing or insufficient permissions" dan baca
// Firestore boros. Sekarang mount() BARU terjadi saat dashboard.js
// pindahSubTab benar-benar memanggil window.pastikanMountConfigAkses() —
// yaitu PERSIS saat tab ini pertama kali dibuka, bukan dari awal muat
// halaman.
window.pastikanMountConfigAkses = function() {
  if (vmConfigAkses) return; // sudah pernah di-mount, tidak perlu ulang
  const mountPoint = document.getElementById('vue-config-akses');
  if (mountPoint) vmConfigAkses = createApp(AppConfigAkses).mount('#vue-config-akses');
};
window.refreshConfigAkses = function() { if (vmConfigAkses) vmConfigAkses.muat(); };
