// js/vue-config-akses.js
// Master Karyawan > Akses & Keamanan, pill Role + Jabatan (pill Assign di
// vue-hak-akses.js): izin View/Add/Edit/Delete/Print per menu tiap role,
// pembatas per Jabatan, plus urutan menu Home mobile.
//
// Koleksi & field:
// - akses_config/{role}: nama, menus (izin per menu + fiturList opsional). Doc
//   id WAJIB role baku — auth.js mencarinya dengan role.
// - akses_jabatan/{jabatan}: nama, menus — pembatas TAMBAHAN (AND) di atas Role.
// - master_data/jabatan (items): daftar Jabatan, read-only di sini.
//   pengaturan_sistem/urutan_menu_home: perKategori, urutanKategori.
//
// Jebakan:
// - Izin di sini murni client-side dan hanya menyembunyikan tampilan. Kuasa
//   simpan sungguhan ditentukan field role lewat Firestore Rules.
// - owner & pic_owner tidak bisa diedit di sini, keduanya selalu penuh.
// - DAFTAR_MENU satu sumber kebenaran: icon+aksi dibaca vue-home.js & sidebar.
// - Jabatan: dicentang = tidak membatasi, dikosongkan = memblokir, tidak pernah
//   melonggarkan. deprecated:true menyembunyikan menu dari Home, wajibOwner:true
//   mengunci ke owner asli. Entry menu lama jangan dihapus.

import { createApp, ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// Tiap entry punya `icon` (kelas FontAwesome) dan `aksi` (fungsi pindah
// tab/sub-tab) yang DIBACA langsung oleh grid Home mobile lewat daftarMenuGroups
// di vue-components.js — menu baru cukup ditambah di sini lengkap dengan
// icon+aksi-nya. Entry deprecated tidak butuh icon/aksi.
const DAFTAR_MENU = [
  { id: 'dashboard', label: 'Dashboard', kategori: 'Umum' },
  { id: 'profile', label: 'Profile', kategori: 'Umum' },
  // fiturList = kontrol granular OPSIONAL per menu, di luar View/Add/Edit/
  // Delete/Print baku — mengunci field/dropdown SPESIFIK di dalam form, bukan
  // seluruh menunya. Titik penguncian memanggil window.cekFiturAkses(menuId,
  // fiturKey), definisinya di auth.js.
  { id: 'config_absensi', label: 'Config Absensi', kategori: 'Master Absensi', icon: 'fa-gear',
    aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-config', null, {catatRiwayat:true}); },
    fiturList: [
    { key: 'ubah_jenis_lokasi', label: 'Boleh ubah Jenis Lokasi gudang (Tetap/Dinamis)' }
  ] },
  { id: 'penjadwalan', label: 'Penjadwalan', kategori: 'Master Absensi', icon: 'fa-calendar-days',
    aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-jadwal', null, {catatRiwayat:true}); } },
  { id: 'antrean_absensi', label: 'Antrean Absensi', kategori: 'Master Absensi', icon: 'fa-clipboard-check',
    aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-accept', null, {catatRiwayat:true}); } },
  { id: 'antrean_lembur', label: 'Antrean Izin/Cuti/Lembur', kategori: 'Master Absensi', icon: 'fa-calendar-check',
    // id TETAP 'antrean_lembur' walau labelnya sekarang gabungan
    // Izin/Cuti/Lembur — supaya role yang sudah diberi akses menu ini tidak
    // kehilangan izinnya (lihat header js/vue-antrean-lembur.js).
    aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-lembur', null, {catatRiwayat:true}); } },
  { id: 'antrean_reimburse', label: 'Antrean Reimburse', kategori: 'Master Keuangan', icon: 'fa-receipt',
    aksi: () => { window.pindahTab('tab-keuangan'); window.pindahSubTab('sub-keuangan', 'sub-keuangan-antrean', null, {catatRiwayat:true}); } },
  { id: 'master_kendaraan', label: 'Master Kendaraan', kategori: 'Master Keuangan', icon: 'fa-truck',
    aksi: () => { window.pindahTab('tab-keuangan'); window.pindahSubTab('sub-keuangan', 'sub-keuangan-kendaraan', null, {catatRiwayat:true}); } },
  // id 'riwayat_bensin'/'riwayat_servis' tidak ada sama sekali (bukan sekadar
  // ditandai deprecated): tidak ada tombol ke sana, jadi tidak ada izin yatim.
  { id: 'riwayat_reimburse', label: 'Riwayat Keuangan', kategori: 'Master Keuangan', icon: 'fa-wallet',
    aksi: () => { window.pindahTab('tab-keuangan'); window.pindahSubTab('sub-keuangan', 'sub-keuangan-riwayat-reimburse', null, {catatRiwayat:true}); } },
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
  // id 'config_akses'/'hak_akses' tidak dipertahankan sebagai alias — keduanya
  // wajibOwner, tidak pernah dikonfigurasi lewat Config Akses biasa.
  { id: 'akses_keamanan', label: 'Akses & Keamanan', kategori: 'Master Karyawan', icon: 'fa-shield-halved', wajibOwner: true,
    aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-akseskeamanan', null, {catatRiwayat:true}); } },
  { id: 'whatsapp_gateway', label: 'WhatsApp Gateway', kategori: 'Master Integrasi', icon: 'fa-comment-dots',
    aksi: () => { window.pindahTab('tab-whatsapp'); if (window.bukaSubTabWhatsapp) window.bukaSubTabWhatsapp('monitor'); } },
  { id: 'mail_gateway', label: 'Mail Gateway', kategori: 'Master Integrasi', icon: 'fa-envelope',
    aksi: () => { window.pindahTab('tab-mail-gateway'); } },
  { id: 'device_kiosk', label: 'List Device Kiosk', kategori: 'Master Integrasi', icon: 'fa-tablet-screen-button', wajibOwner: true,
    aksi: () => { window.pindahTab('tab-device-kiosk'); } },
  // id 'bahan_aksesoris_*' SENGAJA tidak ikut diubah waktu label sidebar-nya
  // ganti — akses_config per-user tersimpan memakai id ini.
  // 'config_master_data': 1 menu-id dipakai bareng 6 tab child Config (pola sama
  // seperti 'config_karyawan'), lihat js/vue-config.js.
  { id: 'config_master_data', label: 'Config', kategori: 'Zevanic House', icon: 'fa-sliders',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-config', null); window.pindahSubTab('sub-zh-config', 'sub-zh-config-jenisbahan', null); } },
  // 3 aksi di bawah WAJIB ikut catatRiwayat: true (riwayat tombol back HP) —
  // tile Home mobile adalah jalur paling sering dipakai ke menu ini, bukan cuma
  // tombol sidebar desktop.
  { id: 'bahan_aksesoris_entry', label: 'Entry Bahan & Aksesoris', kategori: 'Zevanic House', icon: 'fa-boxes-stacked',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-databahan', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-databahan', 'sub-zh-databahan-entry', null, {catatRiwayat:true}); } },
  { id: 'bahan_aksesoris_list', label: 'List Bahan & Aksesoris', kategori: 'Zevanic House', icon: 'fa-list',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-databahan', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-databahan', 'sub-zh-databahan-list', null, {catatRiwayat:true}); } },
  // Rak Penyimpanan pindah ke 'stock_rak_penyimpanan'. Entry ini dibiarkan tanpa
  // aksi + deprecated supaya izin lama tidak yatim dan tidak nongol sebagai tile.
  { id: 'bahan_aksesoris_rak', label: 'Rak Penyimpanan (DIPENSIUNKAN, lihat Stock & Pembelian)', kategori: 'Zevanic House', icon: 'fa-warehouse', deprecated: true },
  // Diganti 'pp_masalah' (Persiapan Produksi > Masalah); koleksi
  // `permintaan_bahan_manual` sudah dihapus. Entry dibiarkan + deprecated supaya
  // izin tersimpan untuk id ini tidak yatim.
  { id: 'persiapan_masalah', label: 'Persiapan Masalah (DIPENSIUNKAN, lihat Persiapan Produksi > Masalah)', kategori: 'Zevanic House', icon: 'fa-triangle-exclamation', deprecated: true },
  // CRUD Suplayer pindah ke 3 entry 'suplayer_*' (js/vue-master-suplayer.js).
  // Entry dibiarkan + deprecated supaya izin lama tidak yatim.
  { id: 'master_suplayer', label: 'Master Suplayer (DIPENSIUNKAN, lihat Master Suplayer)', kategori: 'Zevanic House', deprecated: true },
  // Master Suplayer: 3 sub-tab, lihat js/vue-master-suplayer.js. Posisi SENGAJA
  // sebelum Stock & Pembelian (data Suplayer/Alias/MOQ jadi prasyarat List Order
  // Belanja & Nota).
  { id: 'suplayer_entry', label: 'Master Suplayer - Entry & List', kategori: 'Zevanic House', icon: 'fa-truck-fast',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-suplayer', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-suplayer', 'sub-zh-suplayer-entry', null, {catatRiwayat:true}); } },
  { id: 'suplayer_alias_moq', label: 'Master Suplayer - Alias & MOQ', kategori: 'Zevanic House', icon: 'fa-tags',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-suplayer', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-suplayer', 'sub-zh-suplayer-alias-moq', null, {catatRiwayat:true}); } },
  { id: 'suplayer_petakan_order', label: 'Master Suplayer - Petakan Order', kategori: 'Zevanic House', icon: 'fa-map-location-dot',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-suplayer', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-suplayer', 'sub-zh-suplayer-petakan', null, {catatRiwayat:true}); } },
  // Alias Pembelian pindah ke 'suplayer_alias_moq' (ditambah field
  // moq/moq_satuan/lead_time_hari). Entry dibiarkan + deprecated supaya izin
  // lama tidak yatim.
  { id: 'stock_alias_pembelian', label: 'Alias Pembelian (DIPENSIUNKAN, lihat Master Suplayer)', kategori: 'Zevanic House', icon: 'fa-tags', deprecated: true },
  // Layar List Order Belanja sudah dicopot dari index.html tanpa pengganti.
  // Entry dibiarkan + deprecated supaya izin lama tidak yatim.
  { id: 'stock_list_order_belanja', label: 'List Order Belanja (DIPENSIUNKAN, lihat Daftar Nota / Persiapan Belanja)', kategori: 'Zevanic House', icon: 'fa-cart-shopping', deprecated: true },
  // Kategori 'Stok dan Pembelian' = grup top-level sendiri, terpisah dari
  // Zevanic House. Aksinya cukup 1 pindahSubTab ('sub-zh-stock') karena
  // tab-strip-nya sudah top level di #tab-stok-pembelian.
  { id: 'stock_nota_order_belanja', label: 'Daftar Nota', kategori: 'Stok dan Pembelian', icon: 'fa-receipt',
    aksi: () => { window.pindahTab('tab-stok-pembelian'); window.pindahSubTab('sub-zh-stock', 'sub-zh-stock-notaorder', null, {catatRiwayat:true}); } },
  // Rak Penyimpanan ada di sini, bukan di Data Bahan & Aksesoris (id
  // 'bahan_aksesoris_rak' di atas deprecated, jangan dipakai ulang). Lihat
  // js/vue-rak-penyimpanan.js.
  { id: 'stock_rak_penyimpanan', label: 'Rak Penyimpanan', kategori: 'Stok dan Pembelian', icon: 'fa-warehouse',
    aksi: () => { window.pindahTab('tab-stok-pembelian'); window.pindahSubTab('sub-zh-stock', 'sub-zh-stock-rak', null, {catatRiwayat:true}); } },
  { id: 'stock_repack', label: 'Repack', kategori: 'Stok dan Pembelian', icon: 'fa-box-archive',
    aksi: () => { window.pindahTab('tab-stok-pembelian'); window.pindahSubTab('sub-zh-stock', 'sub-zh-stock-repack', null, {catatRiwayat:true}); } },
  // Tab Cetak Label sudah dicopot dari index.html, TAPI tombol cetak di List
  // Bahan & Aksesoris tetap mengecek izin `print` pada menu id INI (lihat
  // vue-bahan-aksesoris.js) — id ini jangan dihapus. deprecated:true cuma
  // menyembunyikan tile navigasinya.
  { id: 'stock_cetak_label', label: 'Cetak Label (DIPENSIUNKAN, lihat List Bahan & Aksesoris)', kategori: 'Zevanic House', icon: 'fa-print', deprecated: true },
  // Master Produk (BOM): lihat js/vue-master- produk.js. Posisi SENGAJA setelah
  // Stock & Pembelian, sebelum Order SPK .
  { id: 'master_produk_entry', label: 'Entry Produk', kategori: 'Zevanic House', icon: 'fa-box-open',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-produk', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-produk', 'sub-zh-produk-entry', null, {catatRiwayat:true}); } },
  { id: 'master_produk_list', label: 'List Produk', kategori: 'Zevanic House', icon: 'fa-list',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-produk', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-produk', 'sub-zh-produk-list', null, {catatRiwayat:true}); } },
  // Menu-id TERPISAH dari master_produk_entry/list supaya akses HPP bisa diatur
  // sendiri (mis. Admin boleh lihat HPP tanpa boleh entry BOM). Default akses
  // untuk menu baru di proyek ini: HANYA Owner, sampai Owner membagikannya
  // manual lewat Config Akses.
  { id: 'master_produk_hpp', label: 'HPP', kategori: 'Zevanic House', icon: 'fa-calculator',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-produk', null, {catatRiwayat:true}); window.pindahSubTab('sub-zh-produk', 'sub-zh-produk-hpp', null, {catatRiwayat:true}); } },
  // Master Pelanggan: single-view, 1 menu-id saja (tidak ada sub-tab). Lihat
  // js/vue-master-pelanggan.js.
  { id: 'master_pelanggan', label: 'Master Pelanggan', kategori: 'Zevanic House', icon: 'fa-address-book',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-pelanggan', null, {catatRiwayat:true}); } },
  // CRUD Order SPK pindah ke 'pesanan_menunggu' (js/vue-pesanan.js — kode
  // disalin, BUKAN diimpor, konvensi proyek ini). Entry dibiarkan + deprecated
  // supaya izin yang sudah diatur Owner per akun tidak yatim.
  { id: 'order_spk', label: 'Order SPK (DIPENSIUNKAN, lihat Pesanan > Menunggu Proses)', kategori: 'Zevanic House', deprecated: true },
  // 5 id di bawah diganti 6 menu-id kategori 'Persiapan Produksi'
  // (js/vue-persiapan-produksi-v2.js). Entry dibiarkan + deprecated supaya izin
  // lama tidak yatim.
  { id: 'persiapan_produksi_antrean', label: 'Persiapan Produksi - Perlu Disiapkan (LAMA, lihat kategori Persiapan Produksi)', kategori: 'Zevanic House', deprecated: true },
  { id: 'persiapan_produksi_bahan', label: 'Persiapan Produksi - Persiapan Bahan (LAMA, lihat kategori Persiapan Produksi)', kategori: 'Zevanic House', deprecated: true },
  { id: 'persiapan_produksi_sewing', label: 'Persiapan Produksi - Persiapan Acc Sewing (LAMA, lihat kategori Persiapan Produksi)', kategori: 'Zevanic House', deprecated: true },
  { id: 'persiapan_produksi_webbing', label: 'Persiapan Produksi - Persiapan Acc Webbing (LAMA, lihat kategori Persiapan Produksi)', kategori: 'Zevanic House', deprecated: true },
  { id: 'persiapan_produksi_finishing', label: 'Persiapan Produksi - Persiapan Acc Finishing (LAMA, lihat kategori Persiapan Produksi)', kategori: 'Zevanic House', deprecated: true },
  // Kategori 'Persiapan Produksi' = grup sidebar top-level sendiri, bukan
  // sub-menu Zevanic House. Lihat js/vue-persiapan-produksi-v2.js.
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
  // Masalah, 7 tahap, skema TRB. Lihat js/vue-pp-masalah.js.
  { id: 'pp_masalah', label: 'Persiapan Produksi - Masalah', kategori: 'Persiapan Produksi', icon: 'fa-triangle-exclamation',
    aksi: () => { window.pindahTab('tab-persiapan-produksi'); window.pindahSubTab('sub-persiapan-produksi', 'sub-pp-masalah', null, {catatRiwayat:true}); window.pindahSubTab('sub-pp-masalah-tahap', 'sub-pp-masalah-perludiajukan', null, {catatRiwayat:true}); } },
  // Persiapan Belanja, folder terakhir grup Persiapan Produksi. Lihat
  // js/vue-persiapan-belanja.js.
  { id: 'pp_belanja', label: 'Persiapan Produksi - Persiapan Belanja', kategori: 'Persiapan Produksi', icon: 'fa-cart-shopping',
    aksi: () => { window.pindahTab('tab-persiapan-produksi'); window.pindahSubTab('sub-persiapan-produksi', 'sub-pp-belanja', null, {catatRiwayat:true}); window.pindahSubTab('sub-pp-belanja-tahap', 'sub-pp-belanja-persiapanadmin', null, {catatRiwayat:true}); } },
  // Proses Produksi > Cutting, grup top-level. Satu izin menu untuk semua
  // 7 tab Cutting (SAMA pola seperti pp_bahan/pp_sewing dst yang juga 1 izin
  // untuk 5 tab). Lihat js/vue-pp-cutting.js.
  { id: 'cut_cutting', label: 'Proses Produksi - Cutting', kategori: 'Proses Produksi', icon: 'fa-scissors',
    aksi: () => { window.pindahTab('tab-proses-produksi'); window.pindahSubTab('sub-proses-produksi', 'sub-pr-cutting', null, {catatRiwayat:true}); window.pindahSubTab('sub-pr-cutting-tahap', 'sub-pr-cutting-perludiproses', null, {catatRiwayat:true}); } },
  // Proses Produksi > Serie, NESTED di grup top-level "Proses Produksi" yang
  // SUDAH ada dari Cutting (bukan grup baru) -- satu izin menu untuk semua 11
  // tab Serie, sama pola seperti cut_cutting. Lihat js/vue-pp-serie.js.
  { id: 'proses_serie', label: 'Proses Produksi - Serie', kategori: 'Proses Produksi', icon: 'fa-shuffle',
    aksi: () => { window.pindahTab('tab-proses-produksi'); window.pindahSubTab('sub-proses-produksi', 'sub-pr-serie', null, {catatRiwayat:true}); window.pindahSubTab('sub-pr-serie-tahap', 'sub-pr-serie-perludiproses', null, {catatRiwayat:true}); } },
  // Proses Produksi > Sewing, NESTED di grup top-level "Proses Produksi" yang
  // SUDAH ada dari Cutting/Serie (bukan grup baru) -- satu izin menu untuk semua
  // 5 tab Sewing, sama pola seperti cut_cutting/proses_serie. Lihat js/vue-pp-
  // sewing.js.
  { id: 'proses_sewing', label: 'Proses Produksi - Sewing', kategori: 'Proses Produksi', icon: 'fa-thread',
    aksi: () => { window.pindahTab('tab-proses-produksi'); window.pindahSubTab('sub-proses-produksi', 'sub-pr-sewing', null, {catatRiwayat:true}); window.pindahSubTab('sub-pr-sewing-tahap', 'sub-pr-sewing-perludiproses', null, {catatRiwayat:true}); } },
  // 1 izin menu untuk semua 5 tab Finishing, termasuk 4 sub-tab nested
  // QC/Steam/Folding/Packing di dalam 'Sedang Finishing'. Lihat
  // js/vue-pp-finishing.js.
  { id: 'proses_finishing', label: 'Proses Produksi - Finishing', kategori: 'Proses Produksi', icon: 'fa-check-double',
    aksi: () => { window.pindahTab('tab-proses-produksi'); window.pindahSubTab('sub-proses-produksi', 'sub-pr-finishing', null, {catatRiwayat:true}); window.pindahSubTab('sub-pr-finishing-tahap', 'sub-pr-finishing-perludiproses', null, {catatRiwayat:true}); } },
  // Proses Produksi > Gudang Barang Jadi, NESTED di grup top-level "Proses
  // Produksi" yang SUDAH ada dari Cutting/Serie/Sewing/Finishing (bukan grup
  // baru) -- satu izin menu untuk semua 4 tab Gudang, sama pola seperti
  // proses_finishing. Lihat js/vue-pp-gudang.js.
  { id: 'proses_gudang', label: 'Proses Produksi - Gudang Barang Jadi', kategori: 'Proses Produksi', icon: 'fa-warehouse',
    aksi: () => { window.pindahTab('tab-proses-produksi'); window.pindahSubTab('sub-proses-produksi', 'sub-pr-gudang', null, {catatRiwayat:true}); window.pindahSubTab('sub-pr-gudang-tahap', 'sub-pr-gudang-perludisimpan', null, {catatRiwayat:true}); } },
  // grup top-level "Pesanan" (sejajar Zevanic House/ Persiapan Produksi).
  // id pesanan_persiapan/produksi/pengiriman tidak dipakai lagi — jangan
  // dihidupkan ulang; yang berlaku pesanan_daftar + pesanan_transaksi. Lihat
  // js/vue-pesanan.js utk 7.
  { id: 'pesanan_kasir', label: 'Penjualan Kasir', kategori: 'Pesanan', icon: 'fa-cash-register',
    aksi: () => { window.pindahTab('tab-pesanan'); window.pindahSubTab('sub-pesanan', 'sub-pesanan-kasir', null, {catatRiwayat:true}); } },
  { id: 'pesanan_menunggu', label: 'Menunggu Proses', kategori: 'Pesanan', icon: 'fa-clipboard-list',
    aksi: () => { window.pindahTab('tab-pesanan'); window.pindahSubTab('sub-pesanan', 'sub-pesanan-menunggu', null, {catatRiwayat:true}); } },
  { id: 'pesanan_daftar', label: 'Daftar Pesanan', kategori: 'Pesanan', icon: 'fa-list-check',
    aksi: () => { window.pindahTab('tab-pesanan'); window.pindahSubTab('sub-pesanan', 'sub-pesanan-daftar', null, {catatRiwayat:true}); } },
  { id: 'pesanan_transaksi', label: 'Transaksi Keuangan', kategori: 'Pesanan', icon: 'fa-file-invoice-dollar',
    aksi: () => { window.pindahTab('tab-pesanan'); window.pindahSubTab('sub-pesanan', 'sub-pesanan-transaksi', null, {catatRiwayat:true}); } },
  // id & izin 2 entry Scan ini TIDAK berubah walau kategori & aksi-nya pindah ke
  // 'Scan & Cetak' — profil akses yang sudah diatur tetap berlaku. Gating
  // 'mobile-only untuk non-Owner' hardcode role === 'owner' di
  // vue-scan-opname.js / vue-scan-persiapan.js, bukan di sini.
  { id: 'scan_opname', label: 'Scan Opname', kategori: 'Scan & Cetak', icon: 'fa-qrcode',
    aksi: () => { window.pindahTab('tab-scan-cetak'); window.pindahSubTab('sub-scan-cetak', 'sub-scan-cetak-stok', null); window.pindahSubTab('sub-scancetak-stok-tahap', 'sub-scancetak-stok-opname', null); } },
  { id: 'scan_persiapan', label: 'Scan Persiapan', kategori: 'Scan & Cetak', icon: 'fa-boxes-stacked',
    aksi: () => { window.pindahTab('tab-scan-cetak'); window.pindahSubTab('sub-scan-cetak', 'sub-scan-cetak-stok', null); window.pindahSubTab('sub-scancetak-stok-tahap', 'sub-scancetak-stok-persiapan', null); } },
  // 3 menu-id baru utk 3 sub-tab Scan & Cetak lainnya (Riwayat PIN pindah dari
  // 'config_master_data' ke id sendiri, karena screen ini sekarang di luar
  // Config — beda cakupan izin).
  { id: 'scan_cetak_referensi', label: 'Scan & Cetak - Referensi Scan', kategori: 'Scan & Cetak', icon: 'fa-list-check',
    aksi: () => { window.pindahTab('tab-scan-cetak'); window.pindahSubTab('sub-scan-cetak', 'sub-scan-cetak-referensi', null); } },
  { id: 'scan_cetak_cetak', label: 'Scan & Cetak - Cetak', kategori: 'Scan & Cetak', icon: 'fa-print',
    aksi: () => { window.pindahTab('tab-scan-cetak'); window.pindahSubTab('sub-scan-cetak', 'sub-scan-cetak-cetak', null); } },
  { id: 'scan_cetak_pin', label: 'Scan & Cetak - PIN (Riwayat PIN)', kategori: 'Scan & Cetak', icon: 'fa-key',
    aksi: () => { window.pindahTab('tab-scan-cetak'); window.pindahSubTab('sub-scan-cetak', 'sub-scan-cetak-pin', null); } }
];

// Urutan tampilan KATEGORI permission: accordion Config Akses, grid Home mobile,
// dan sidebar desktop. Kategori baru DITAMBAH DI UJUNG — menyisipkan di tengah
// menggeser urutan yang sudah tersimpan di pengaturan_sistem/urutan_menu_home.
// Master Karyawan/Absensi/Keuangan tetap terpisah walau sidebar menggabungnya.
export const KATEGORI_URUTAN = ['Umum', 'Master Karyawan', 'Master Absensi', 'Master Keuangan', 'Zevanic House', 'Stok dan Pembelian', 'Pesanan', 'Persiapan Produksi', 'Proses Produksi', 'Scan & Cetak', 'Master Integrasi'];
export { DAFTAR_MENU };
const KOSONG_IZIN = () => ({ view: false, add: false, edit: false, delete: false, print: false });

// Default awal role yang bisa diedit SENGAJA disamakan dengan perilaku hardcode
// di auth.js — supaya role ini begitu pertama dibuka sudah masuk akal, bukan
// kosong semua. owner dan pic_owner tidak ada di sini: keduanya selalu penuh.
function bikinDefaultProfil(namaProfil) {
  const menus = {};
  DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN(); });

  const semua = (id) => { menus[id] = { view: true, add: true, edit: true, delete: true, print: true }; };
  const lihatSaja = (id) => { menus[id].view = true; };

  if (namaProfil === 'pic' || namaProfil === 'admin') {
    lihatSaja('dashboard');
    menus.profile = { view: true, add: true, edit: true, delete: false, print: false };
    // Diturunkan dari KATEGORI, bukan daftar id yang ditulis tangan, supaya
    // menu baru di kategori yang sama otomatis ikut. Isinya PERSIS kategori
    // yang tombol sidebarnya digerbang admin-level di auth.js — Master
    // Karyawan dan Master Integrasi sengaja di luar, itu owner/pic_owner.
    const kategoriAdmin = ['Master Absensi', 'Master Keuangan', 'Zevanic House',
      'Stok dan Pembelian', 'Pesanan', 'Persiapan Produksi', 'Proses Produksi', 'Scan & Cetak'];
    DAFTAR_MENU.forEach(m => {
      if (!m.deprecated && !m.wajibOwner && kategoriAdmin.includes(m.kategori)) semua(m.id);
    });
    // Contoh nyata pemakaian fitur granular: Admin/PIC boleh kelola Master
    // Gudang sepenuhnya (view/add/edit/delete/print semua true di atas), TAPI
    // khusus dropdown "Jenis Lokasi"-nya tetap terkunci ke Tetap — cuma Owner
    // yang bisa buka opsi Dinamis.
    menus.config_absensi.fitur = { ubah_jenis_lokasi: false };
  } else {
    lihatSaja('dashboard');
    menus.profile = { view: true, add: true, edit: true, delete: false, print: false };
  }
  return menus;
}

const PROFIL_BAKU = ['operator', 'admin', 'pic', 'pic_owner', 'owner'];

const AppConfigAkses = {
  setup() {
    const daftarProfil = ref([]); // 5 role baku minus owner, diisi di muat()
    const memuat = ref(true);
    const menyimpan = ref(false);

    const profilDipilih = ref('');
    const menus = reactive({});
    // pastikanFiturAda: kalau menu ini punya fiturList (kontrol granular
    // tambahan), pastikan menus[id].fitur SELALU ada sebagai objek — supaya
    // template (v-model="menus[m.id].fitur[f.key]") tidak error kalau datanya
    // belum pernah tersimpan sama sekali.
    function pastikanFiturAda(menuId) {
      const def = DAFTAR_MENU.find(m => m.id === menuId);
      if (def && def.fiturList && !menus[menuId].fitur) menus[menuId].fitur = {};
    }
    DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN(); pastikanFiturAda(m.id); });

    const kategoriTerbuka = reactive({});
    KATEGORI_URUTAN.forEach(k => { kategoriTerbuka[k] = true; });
    function toggleKategori(k) { kategoriTerbuka[k] = !kategoriTerbuka[k]; }

    // Home mobile cuma menampilkan 4 menu teratas per kategori (sisanya lewat
    // "Lihat Semua"); urutan 4 teratas itu diatur di sini. Disimpan 1 dokumen
    // tunggal, dibaca vue-home.js 1x getDoc. Menu yang belum pernah diatur
    // otomatis menempel di akhir (self-healing untuk menu baru).
    const urutanMenu = reactive({});
    const urutanTerbuka = reactive({});
    const menyimpanUrutan = ref(false);
    // urutanKategoriArr: urutan KATEGORI itu sendiri, TERPISAH dari urutanMenu
    // (urutan menu DI DALAM 1 kategori). Disimpan di dokumen yang SAMA, field
    // `urutanKategori`. Dipakai bareng Home mobile dan sidebar desktop (lihat
    // window.terapkanUrutanMenuDesktop di auth.js).
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
    // cakupannya cuma menu-menu di dalam kategori itu saja, tidak ikut menyentuh
    // kategori lain.
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
      // Daftar yang bisa diedit TETAP role baku, tidak lagi ditambah nama bebas
      // dari isi koleksi. owner dan pic_owner sengaja disembunyikan: auth.js
      // memberi keduanya OWNER_PENUH tanpa baca akses_config, jadi mengeditnya
      // di sini tidak akan pernah berefek.
      const gabungan = PROFIL_BAKU.filter(nama => nama !== 'owner' && nama !== 'pic_owner');
      daftarProfil.value = gabungan;
      if (!profilDipilih.value && gabungan.length > 0) await pilihProfil(gabungan[0]);
      memuat.value = false;
    }

    async function pilihProfil(nama) {
      if (!nama) return;
      profilDipilih.value = nama;
      try {
        const snap = await getDoc(doc(db, "akses_config", nama));
        const dataMenus = snap.exists() ? (snap.data().menus || {}) : null;
        // Role yang belum pernah disimpan dimuat dengan izin bawaannya, bukan
        // kosong — kalau kosong, semua menu langsung hilang begitu disimpan.
        DAFTAR_MENU.forEach(m => {
          menus[m.id] = dataMenus && dataMenus[m.id]
            ? { ...KOSONG_IZIN(), ...dataMenus[m.id] }
            : bikinDefaultProfil(nama)[m.id];
          pastikanFiturAda(m.id);
        });
      } catch (e) {
        console.error("Gagal muat profil akses:", nama, e);
      }
    }

    async function simpan() {
      const nama = profilDipilih.value;
      if (!nama) return alert("Pilih role yang mau diatur dulu.");

      menyimpan.value = true;
      try {
        const menusPolos = {};
        DAFTAR_MENU.forEach(m => { menusPolos[m.id] = { ...menus[m.id] }; });
        await setDoc(doc(db, "akses_config", nama), { nama, menus: menusPolos });
        alert(`Izin role "${nama}" berhasil disimpan!`);
      } catch (e) {
        console.error("Gagal simpan profil akses:", e);
        alert("Gagal menyimpan izin role.");
      }
      menyimpan.value = false;
    }

    // Panel "Urutan Menu" disembunyikan lewat fiturUrutanMenuAktif = false.
    // muatUrutanMenu SENGAJA tidak dipanggil di onMounted supaya tidak baca
    // Firestore untuk panel yang tersembunyi; fungsi-fungsinya dibiarkan utuh.
    const fiturUrutanMenuAktif = false;
    onMounted(async () => { await window.authReady; muat(); });

    return {
      daftarProfil, memuat, menyimpan, muat,
      profilDipilih, pilihProfil, simpan,
      menus, KATEGORI_URUTAN, kategoriTerbuka, toggleKategori, menuUntukKategori, cariMenu,
      semuaTercentangKolom, toggleKolomKategori,
      urutanMenu, urutanTerbuka, menyimpanUrutan, labelMenu, naikkanUrutan, turunkanUrutan, simpanUrutanMenu,
      urutanKategoriArr, naikkanKategori, turunkanKategori, fiturUrutanMenuAktif
    };
  },
  template: `
    <div>
      <div class="gc-card" style="background:var(--blue); border:none; margin-bottom:16px;">
        <h4 class="gc-heading" style="font-weight:700; font-size:13px; color:var(--teal-text);"><i class="fas fa-shield-halved" style="margin-right:8px;"></i> Config Akses</h4>
        <p style="font-size:11px; color:var(--teal-text); margin-top:4px; opacity:.85;">Atur izin View/Add/Edit/Delete/Print per menu untuk tiap role. Role dipasang ke karyawan di tab Hak Akses. Untuk mengurangi akses lebih jauh per posisi kerja, pakai tab Akses Jabatan.</p>
      </div>

      <div class="gc-card" style="margin-bottom:16px;">
        <div class="gc-field" style="margin-bottom:14px; max-width:320px;">
          <label>Role yang sedang diatur</label>
          <select :value="profilDipilih" @change="pilihProfil($event.target.value)">
            <option v-for="p in daftarProfil" :key="p" :value="p">{{ p.toUpperCase() }}</option>
          </select>
        </div>
        <button @click="simpan" :disabled="menyimpan" class="btn-primary block">
          <i class="fas fa-rotate" style="margin-right:8px;"></i>
          {{ menyimpan ? 'Menyimpan...' : 'Simpan izin role ini' }}
        </button>
      </div>

      <!--
        Panel disembunyikan lewat v-if fiturUrutanMenuAktif; markup dibiarkan utuh.
      -->
      <div v-if="fiturUrutanMenuAktif" class="gc-card" style="margin-bottom:16px; border:1.5px solid var(--burgundy);">
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
        <input v-model="cariMenu" type="text" placeholder="Cari nama menu..." style="width:100%; max-width:320px; padding:9px 13px 9px 34px; background:var(--ivory-dim); border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
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
// Mount SENGAJA lewat window.pastikanMountConfigAkses yang dipanggil dashboard.js
// saat tab ini pertama dibuka. Kalau di-mount begitu file dimuat, onMounted-nya
// fetch Firestore untuk SIAPAPUN yang buka halaman, termasuk yang tidak punya
// akses — console penuh "Missing or insufficient permissions" dan baca boros.
window.pastikanMountConfigAkses = function() {
  if (vmConfigAkses) { if (typeof vmConfigAkses.muat === 'function') vmConfigAkses.muat(); return; }
  const mountPoint = document.getElementById('vue-config-akses');
  if (mountPoint) vmConfigAkses = createApp(AppConfigAkses).mount('#vue-config-akses');
};
window.refreshConfigAkses = function() { if (vmConfigAkses) vmConfigAkses.muat(); };


// AppJabatanAkses: dimensi Jabatan, pill "Jabatan" di layar Akses & Keamanan.
// Pembatas TAMBAHAN (AND) di atas Role — dicentang = tidak membatasi,
// dikosongkan = memblokir, tidak pernah bisa melonggarkan izin yang Role-nya
// sendiri tolak (lihat window.cekIzinMenu di auth.js).

const KOSONG_IZIN_JABATAN = () => ({ view: true, add: true, edit: true, delete: true, print: true });

const AppJabatanAkses = {
  setup() {
    const daftarJabatan = ref([]);
    const memuat = ref(true);
    const menyimpan = ref(false);
    const menghapus = ref(false);
    const jabatanDipilih = ref('');
    const adaPembatasanTersimpan = ref(false); // true kalau doc akses_jabatan utk pilihan ini sudah pernah disimpan
    const menus = reactive({});
    DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN_JABATAN(); });

    const kategoriTerbuka = reactive({});
    KATEGORI_URUTAN.forEach(k => { kategoriTerbuka[k] = true; });
    function toggleKategori(k) { kategoriTerbuka[k] = !kategoriTerbuka[k]; }

    const cariMenu = ref('');
    function menuUntukKategori(kategori) {
      const kata = cariMenu.value.trim().toLowerCase();
      return DAFTAR_MENU.filter(m => m.kategori === kategori && (!kata || m.label.toLowerCase().includes(kata)));
    }
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
        const snap = await getDoc(doc(db, 'master_data', 'jabatan'));
        daftarJabatan.value = snap.exists() ? (snap.data().items || []) : [];
      } catch (e) {
        console.error('Gagal muat daftar Jabatan (master_data/jabatan):', e);
        daftarJabatan.value = [];
      }
      if (!jabatanDipilih.value && daftarJabatan.value.length > 0) {
        await pilihJabatan(daftarJabatan.value[0]);
      }
      memuat.value = false;
    }

    async function pilihJabatan(nama) {
      jabatanDipilih.value = nama;
      DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN_JABATAN(); });
      adaPembatasanTersimpan.value = false;
      if (!nama) return;
      try {
        const j = nama.trim().toLowerCase();
        const snap = await getDoc(doc(db, 'akses_jabatan', j));
        if (snap.exists()) {
          adaPembatasanTersimpan.value = true;
          const dataMenus = snap.data().menus || {};
          DAFTAR_MENU.forEach(m => {
            menus[m.id] = dataMenus[m.id] ? { ...KOSONG_IZIN_JABATAN(), ...dataMenus[m.id] } : KOSONG_IZIN_JABATAN();
          });
        }
      } catch (e) {
        console.error('Gagal muat akses_jabatan untuk', nama, e);
      }
    }

    async function simpan() {
      if (!jabatanDipilih.value) return alert('Pilih Jabatan dulu.');
      menyimpan.value = true;
      try {
        const j = jabatanDipilih.value.trim().toLowerCase();
        const menusPolos = {};
        DAFTAR_MENU.forEach(m => { menusPolos[m.id] = { ...menus[m.id] }; });
        await setDoc(doc(db, 'akses_jabatan', j), { nama: jabatanDipilih.value, menus: menusPolos });
        adaPembatasanTersimpan.value = true;
        alert(`Pembatasan akses untuk Jabatan "${jabatanDipilih.value}" berhasil disimpan!`);
      } catch (e) {
        console.error('Gagal simpan akses_jabatan:', e);
        alert('Gagal menyimpan pembatasan akses Jabatan.');
      }
      menyimpan.value = false;
    }

    async function hapusPembatasan() {
      if (!jabatanDipilih.value) return;
      if (!confirm(`Hapus SEMUA pembatasan tambahan untuk Jabatan "${jabatanDipilih.value}"? Jabatan ini akan kembali mengikuti izin Role sepenuhnya (tanpa pembatas tambahan).`)) return;
      menghapus.value = true;
      try {
        const j = jabatanDipilih.value.trim().toLowerCase();
        await deleteDoc(doc(db, 'akses_jabatan', j));
        DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN_JABATAN(); });
        adaPembatasanTersimpan.value = false;
        alert('Pembatasan berhasil dihapus — Jabatan ini sekarang tidak punya pembatas tambahan.');
      } catch (e) {
        console.error('Gagal hapus akses_jabatan:', e);
        alert('Gagal menghapus pembatasan.');
      }
      menghapus.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });

    return { muat,
      daftarJabatan, memuat, menyimpan, menghapus, jabatanDipilih, adaPembatasanTersimpan,
      pilihJabatan, simpan, hapusPembatasan,
      menus, KATEGORI_URUTAN, kategoriTerbuka, toggleKategori, menuUntukKategori, cariMenu,
      semuaTercentangKolom, toggleKolomKategori
    };
  },
  template: `
    <div>
      <div class="gc-card" style="background:var(--blue); border:none; margin-bottom:16px;">
        <h4 class="gc-heading" style="font-weight:700; font-size:13px; color:var(--teal-text);"><i class="fas fa-user-tie" style="margin-right:8px;"></i> Pembatas Tambahan per Jabatan</h4>
        <p style="font-size:11px; color:var(--teal-text); margin-top:4px; opacity:.85;">Ini BUKAN pengganti Role — ini pembatas TAMBAHAN (AND). Kotak <b>DICENTANG</b> = tidak ada pembatasan tambahan (ikut izin Role seperti biasa). Kotak <b>DIKOSONGKAN</b> = akses itu DIBLOKIR khusus untuk Jabatan ini, walau Role-nya mengizinkan. Belum pernah diatur = otomatis TIDAK ADA pembatasan sama sekali.</p>
      </div>

      <div class="gc-card" style="margin-bottom:16px;">
        <div class="gc-field" style="margin-bottom:0; max-width:320px;">
          <label>Pilih Jabatan untuk diatur pembatasannya</label>
          <select :value="jabatanDipilih" @change="pilihJabatan($event.target.value)">
            <option value="">— pilih Jabatan —</option>
            <option v-for="j in daftarJabatan" :key="j" :value="j">{{ j }}</option>
          </select>
          <p v-if="!memuat && daftarJabatan.length === 0" style="font-size:11px; color:var(--burgundy); margin-top:8px;">Belum ada data Jabatan. Tambahkan dulu di Master Karyawan &rsaquo; Config Karyawan &rsaquo; Jabatan.</p>
        </div>
      </div>

      <div v-if="jabatanDipilih" style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap;">
        <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="flex:1; min-width:200px;">
          <i class="fas" :class="menyimpan ? 'fa-spinner fa-spin' : 'fa-save'" style="margin-right:8px;"></i>{{ menyimpan ? 'Menyimpan...' : 'Simpan Pembatasan' }}
        </button>
        <button v-if="adaPembatasanTersimpan" @click="hapusPembatasan" :disabled="menghapus" style="flex:1; min-width:200px; background:var(--surface); border:1.5px solid var(--burgundy); color:var(--burgundy); border-radius:10px; font-weight:700; font-size:12.5px; cursor:pointer;">
          <i class="fas" :class="menghapus ? 'fa-spinner fa-spin' : 'fa-trash'" style="margin-right:8px;"></i>{{ menghapus ? 'Menghapus...' : 'Hapus Semua Pembatasan' }}
        </button>
      </div>

      <div v-if="jabatanDipilih" style="position:relative; margin-bottom:14px;">
        <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
        <input v-model="cariMenu" type="text" placeholder="Cari nama menu..." style="width:100%; max-width:320px; padding:9px 13px 9px 34px; background:var(--ivory-dim); border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
      </div>

      <div v-if="jabatanDipilih" v-for="kategori in KATEGORI_URUTAN" :key="kategori" class="gc-card" style="margin-bottom:12px; padding:0; overflow:hidden;">
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
};

let vmJabatanAkses = null;
window.pastikanMountJabatanAkses = function() {
  if (vmJabatanAkses) { if (typeof vmJabatanAkses.muat === 'function') vmJabatanAkses.muat(); return; }
  const mountPoint = document.getElementById('vue-jabatan-akses');
  if (mountPoint) vmJabatanAkses = createApp(AppJabatanAkses).mount('#vue-jabatan-akses');
};


// "Akses & Keamanan" = 1 layar dengan 3 pill (Role/Jabatan/Assign). Markup 3
// pill + 3 pane ada di index.html; petaMount di dashboard.js mengarah ke
// window.pastikanMountAksesKeamanan di bawah.

window.pindahPillAksesKeamanan = function(nama) {
  const semua = ['role', 'jabatan', 'assign'];
  semua.forEach(n => {
    const pane = document.getElementById('pane-akses-' + n);
    const tombol = document.getElementById('pill-akses-' + n);
    if (pane) pane.classList.toggle('hidden', n !== nama);
    if (tombol) tombol.classList.toggle('active', n === nama);
  });
};
window.pastikanMountAksesKeamanan = function() {
  window.pastikanMountConfigAkses();
  window.pastikanMountJabatanAkses();
  if (window.pastikanMountHakAkses) window.pastikanMountHakAkses();
};
