// js/vue-config-akses.js
// Master Karyawan > Akses & Keamanan, pill Petakan Menu + Jabatan (Assign di
// vue-hak-akses.js). Jabatan = role + jenis usaha + menu yang tampil. DAFTAR_MENU
// di file ini satu-satunya tempat menu aplikasi didaftarkan.
//
// Koleksi & field:
// - akses_jabatan/{jabatan huruf kecil}: nama, role, jenis_pekerjaan, menus.
//   Dibaca auth.js muatIzinMenuSaya; role & jenis_pekerjaan disalin ke users
//   saat jabatan dipasang di pill Assign.
// - pengaturan_sistem/peta_kategori_usaha: kategori menu -> jenis usaha.
// - master_data/jabatan (items): daftar nama jabatan, ditulis dari sini juga.
//
// Jebakan:
// - Izin di sini client-side, hanya menyembunyikan. Kuasa simpan sungguhan
//   ditentukan field role lewat Firestore Rules.
// - Kategori milik usaha lain (lihat pill Petakan Menu) disembunyikan DAN
//   ditulis tertutup saat simpan.
// - Ubah role/usaha jabatan WAJIB diikuti "Terapkan ke karyawan".
// - DAFTAR_MENU satu sumber kebenaran: icon+aksi dibaca vue-home.js & sidebar.
//   deprecated/wajibOwner berlaku di sini. Entry menu lama jangan dihapus.

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
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
  // ganti — izin jabatan tersimpan memakai id ini.
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
    aksi: () => { window.pindahTab('tab-persiapan-produksi'); window.pindahSubTab('sub-persiapan-produksi', 'sub-pp-bahan', null, {catatRiwayat:true}); window.pindahSubTab('sub-pp-bahan-tahap', 'sub-pp-bahan-perludisiapkan', null, {catatRiwayat:true}); } },
  { id: 'pp_sewing', label: 'Persiapan Produksi - Acc Sewing', kategori: 'Persiapan Produksi', icon: 'fa-scissors',
    aksi: () => { window.pindahTab('tab-persiapan-produksi'); window.pindahSubTab('sub-persiapan-produksi', 'sub-pp-sewing', null, {catatRiwayat:true}); window.pindahSubTab('sub-pp-sewing-tahap', 'sub-pp-sewing-perludisiapkan', null, {catatRiwayat:true}); } },
  { id: 'pp_webbing', label: 'Persiapan Produksi - Acc Webbing', kategori: 'Persiapan Produksi', icon: 'fa-ribbon',
    aksi: () => { window.pindahTab('tab-persiapan-produksi'); window.pindahSubTab('sub-persiapan-produksi', 'sub-pp-webbing', null, {catatRiwayat:true}); window.pindahSubTab('sub-pp-webbing-tahap', 'sub-pp-webbing-perludisiapkan', null, {catatRiwayat:true}); } },
  { id: 'pp_finishing', label: 'Persiapan Produksi - Acc Finishing', kategori: 'Persiapan Produksi', icon: 'fa-check-double',
    aksi: () => { window.pindahTab('tab-persiapan-produksi'); window.pindahSubTab('sub-persiapan-produksi', 'sub-pp-finishing', null, {catatRiwayat:true}); window.pindahSubTab('sub-pp-finishing-tahap', 'sub-pp-finishing-perludisiapkan', null, {catatRiwayat:true}); } },
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
    aksi: () => { window.pindahTab('tab-scan-cetak'); window.pindahSubTab('sub-scan-cetak', 'sub-scan-cetak-pin', null); } },
  { id: 'scan_pilihan_scan', label: 'Scan & Cetak - Pilihan Scan', kategori: 'Scan & Cetak', icon: 'fa-list-ul',
    aksi: () => { window.pindahTab('tab-scan-cetak'); window.pindahSubTab('sub-scan-cetak', 'sub-scan-cetak-pilihanscan', null); } }
];

// Urutan tampilan KATEGORI permission: accordion Config Akses, grid Home mobile,
// dan sidebar desktop. Kategori baru DITAMBAH DI UJUNG — menyisipkan di tengah
// menggeser urutan yang sudah tersimpan di pengaturan_sistem/urutan_menu_home.
// Master Karyawan/Absensi/Keuangan tetap terpisah walau sidebar menggabungnya.
export const KATEGORI_URUTAN = ['Umum', 'Master Karyawan', 'Master Absensi', 'Master Keuangan', 'Zevanic House', 'Stok dan Pembelian', 'Pesanan', 'Persiapan Produksi', 'Proses Produksi', 'Scan & Cetak', 'Master Integrasi'];
export { DAFTAR_MENU };
// AppPetaMenu: pill "Petakan Menu". Menentukan kategori menu mana dipakai jenis
// usaha mana. Dibaca pill Jabatan untuk menyembunyikan kategori yang tidak
// dipakai usaha jabatan itu, jadi tidak perlu dicentang satu per satu.

const DOC_PETA_USAHA = ['pengaturan_sistem', 'peta_kategori_usaha'];

// Dipakai HANYA kalau dokumen petanya belum pernah disimpan. Kategori yang
// tidak disebut di sini berarti dipakai SEMUA usaha.
const PETA_USAHA_BAWAAN = {
  'Zevanic House': ['ZCO'],
  'Stok dan Pembelian': ['ZCO'],
  'Pesanan': ['ZCO'],
  'Persiapan Produksi': ['ZCO'],
  'Proses Produksi': ['ZCO'],
  'Scan & Cetak': ['ZCO']
};

// Satu-satunya tempat aturan "kategori ini boleh untuk usaha itu" dibaca.
// Kategori tanpa entri = milik semua usaha (aman untuk kategori yang baru
// ditambahkan ke DAFTAR_MENU).
export function kategoriUntukUsaha(peta, usaha) {
  return KATEGORI_URUTAN.filter(k => {
    const daftar = peta ? peta[k] : PETA_USAHA_BAWAAN[k];
    if (!daftar || daftar.length === 0) return true;
    return daftar.includes(usaha);
  });
}

export async function muatPetaKategoriUsaha() {
  try {
    const snap = await getDoc(doc(db, ...DOC_PETA_USAHA));
    return snap.exists() ? (snap.data().peta || {}) : { ...PETA_USAHA_BAWAAN };
  } catch (e) {
    console.error('Gagal muat peta kategori-usaha, pakai bawaan:', e);
    return { ...PETA_USAHA_BAWAAN };
  }
}

const AppPetaMenu = {
  setup() {
    const daftarUsaha = ref([]);
    const peta = reactive({});
    const memuat = ref(true);
    const menyimpan = ref(false);

    function dipakai(kategori, usaha) {
      const d = peta[kategori];
      return !d || d.length === 0 ? true : d.includes(usaha);
    }
    // Mencentang SEMUA usaha sama artinya dengan "tidak dibatasi", jadi
    // entrinya dikosongkan supaya usaha baru otomatis ikut kebagian.
    function toggle(kategori, usaha) {
      const sekarang = daftarUsaha.value.filter(u => dipakai(kategori, u));
      const baru = sekarang.includes(usaha) ? sekarang.filter(u => u !== usaha) : [...sekarang, usaha];
      peta[kategori] = baru.length === daftarUsaha.value.length ? [] : baru;
    }

    async function muat() {
      memuat.value = true;
      daftarUsaha.value = window.ambilMasterList ? await window.ambilMasterList('jenis_pekerjaan') : [];
      const tersimpan = await muatPetaKategoriUsaha();
      Object.keys(peta).forEach(k => delete peta[k]);
      KATEGORI_URUTAN.forEach(k => { peta[k] = tersimpan[k] ? [...tersimpan[k]] : []; });
      memuat.value = false;
    }

    async function simpan() {
      menyimpan.value = true;
      try {
        const polos = {};
        KATEGORI_URUTAN.forEach(k => { polos[k] = [...(peta[k] || [])]; });
        await setDoc(doc(db, ...DOC_PETA_USAHA), { peta: polos });
        alert('Peta menu tersimpan. Buka pill Jabatan untuk melihat hasilnya.');
      } catch (e) {
        console.error('Gagal simpan peta kategori-usaha:', e);
        alert('Gagal menyimpan peta menu.');
      }
      menyimpan.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });

    return { daftarUsaha, peta, memuat, menyimpan, KATEGORI_URUTAN, dipakai, toggle, simpan, muat };
  },
  template: `
    <div>
      <div class="gc-card" style="background:var(--blue); border:none; margin-bottom:16px;">
        <h4 class="gc-heading" style="font-weight:700; font-size:13px; color:var(--teal-text);"><i class="fas fa-diagram-project" style="margin-right:8px;"></i> Petakan Menu ke Jenis Usaha</h4>
        <p style="font-size:11px; color:var(--teal-text); margin-top:4px; opacity:.85;">Tentukan kategori menu mana dipakai usaha mana. Yang <b>tidak dicentang</b> tidak akan muncul sama sekali saat mengatur jabatan usaha itu — jadi tidak perlu mencentang menu satu per satu di sana. Kategori yang dicentang semua usaha berarti menu bersama.</p>
      </div>

      <div class="gc-card" style="margin-bottom:16px;">
        <button @click="simpan" :disabled="menyimpan" class="btn-primary block">
          <i class="fas" :class="menyimpan ? 'fa-spinner fa-spin' : 'fa-save'" style="margin-right:8px;"></i>{{ menyimpan ? 'Menyimpan...' : 'Simpan Peta Menu' }}
        </button>
      </div>

      <div v-if="memuat" class="gc-card" style="text-align:center; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="daftarUsaha.length === 0" class="gc-card" style="color:var(--burgundy); font-size:11.5px; font-weight:700;">Belum ada Jenis Usaha. Tambahkan dulu di Master Karyawan &rsaquo; Config Karyawan &rsaquo; Jenis Pekerjaan.</div>
      <div v-else class="gc-card" style="padding:0; overflow:hidden;">
        <div class="gc-table-scroll">
          <table class="gc-table" style="min-width:420px;">
            <thead>
              <tr>
                <th class="freeze freeze-left" style="width:220px;">Kategori menu</th>
                <th v-for="u in daftarUsaha" :key="u" style="text-align:center; width:110px;">{{ u }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="k in KATEGORI_URUTAN" :key="k">
                <td class="freeze freeze-left" style="font-weight:600;">{{ k }}</td>
                <td v-for="u in daftarUsaha" :key="u" style="text-align:center;">
                  <input type="checkbox" :checked="dipakai(k, u)" @change="toggle(k, u)" style="accent-color:var(--ok); width:16px; height:16px;">
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
};

let vmPetaMenu = null;
window.pastikanMountPetaMenu = function() {
  if (vmPetaMenu) { if (typeof vmPetaMenu.muat === 'function') vmPetaMenu.muat(); return; }
  const mountPoint = document.getElementById('vue-peta-menu');
  if (mountPoint) vmPetaMenu = createApp(AppPetaMenu).mount('#vue-peta-menu');
};


// AppJabatanAkses: satu-satunya halaman pengatur akses. Jabatan menyimpan role
// (pengaman di Rules) + jenis_pekerjaan (batas usaha) + menu yang boleh tampil.
// Keduanya DISALIN ke users saat jabatan dipasang di pill Assign, karena Rules
// dan custom claim membaca users, bukan jabatan.

const KOSONG_IZIN_JABATAN = () => ({ view: true, add: true, edit: true, delete: true, print: true });
const TUTUP_IZIN_JABATAN = () => ({ view: false, add: false, edit: false, delete: false, print: false });
const ROLE_BAKU_JABATAN = ['operator', 'admin', 'pic', 'pic_owner', 'owner'];

const AppJabatanAkses = {
  setup() {
    const daftarJabatan = ref([]);
    const daftarUsaha = ref([]);
    const memuat = ref(true);
    const menyimpan = ref(false);
    const menghapus = ref(false);
    const menyinkron = ref(false);

    const petaKategori = ref(null); // diisi dari pill Petakan Menu saat muat()
    const jabatanDipilih = ref('');
    const roleJabatan = ref('operator');
    const usahaJabatan = ref('');
    const namaJabatanBaru = ref('');
    const adaPembatasanTersimpan = ref(false);

    const menus = reactive({});
    DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN_JABATAN(); });

    // Kategori yang ditampilkan ikut jenis usaha jabatan ini, menurut peta yang
    // diatur di pill Petakan Menu — Guru tidak perlu mencentang menu yang memang
    // tidak dipakai usahanya.
    const kategoriTampil = computed(() => kategoriUntukUsaha(petaKategori.value, usahaJabatan.value));

    const kategoriTerbuka = reactive({});
    KATEGORI_URUTAN.forEach(k => { kategoriTerbuka[k] = true; });
    function toggleKategori(k) { kategoriTerbuka[k] = !kategoriTerbuka[k]; }

    const cariMenu = ref('');
    function menuUntukKategori(kategori) {
      const kata = cariMenu.value.trim().toLowerCase();
      return DAFTAR_MENU.filter(m => m.kategori === kategori && !m.deprecated && (!kata || m.label.toLowerCase().includes(kata)));
    }
    function semuaTercentangKolom(kategori, field) {
      const daftar = menuUntukKategori(kategori);
      return daftar.length > 0 && daftar.every(m => menus[m.id][field]);
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
      daftarUsaha.value = window.ambilMasterList ? await window.ambilMasterList('jenis_pekerjaan') : [];
      petaKategori.value = await muatPetaKategoriUsaha();
      if (jabatanDipilih.value) await pilihJabatan(jabatanDipilih.value);
      memuat.value = false;
    }

    async function pilihJabatan(nama) {
      jabatanDipilih.value = nama;
      roleJabatan.value = 'operator';
      usahaJabatan.value = '';
      adaPembatasanTersimpan.value = false;
      DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN_JABATAN(); });
      if (!nama) return;
      try {
        const snap = await getDoc(doc(db, 'akses_jabatan', nama.trim().toLowerCase()));
        if (!snap.exists()) return;
        const d = snap.data();
        adaPembatasanTersimpan.value = true;
        roleJabatan.value = d.role || 'operator';
        usahaJabatan.value = d.jenis_pekerjaan || '';
        const dataMenus = d.menus || {};
        DAFTAR_MENU.forEach(m => {
          menus[m.id] = dataMenus[m.id] ? { ...KOSONG_IZIN_JABATAN(), ...dataMenus[m.id] } : KOSONG_IZIN_JABATAN();
        });
      } catch (e) {
        console.error('Gagal muat akses_jabatan untuk', nama, e);
      }
    }

    // Jabatan baru ditulis ke master_data/jabatan juga, supaya dropdown Jabatan
    // di Daftar Karyawan dan di sini selalu satu daftar yang sama.
    async function tambahJabatan() {
      const nama = namaJabatanBaru.value.trim();
      if (!nama) return alert('Isi nama jabatan dulu.');
      if (daftarJabatan.value.some(j => j.toLowerCase() === nama.toLowerCase())) {
        return alert('Jabatan dengan nama itu sudah ada.');
      }
      try {
        const itemsBaru = [...daftarJabatan.value, nama];
        await setDoc(doc(db, 'master_data', 'jabatan'), { items: itemsBaru }, { merge: true });
        daftarJabatan.value = itemsBaru;
        namaJabatanBaru.value = '';
        await pilihJabatan(nama);
      } catch (e) {
        console.error('Gagal tambah jabatan:', e);
        alert('Gagal menambah jabatan.');
      }
    }

    async function simpan() {
      if (!jabatanDipilih.value) return alert('Pilih jabatan dulu.');
      if (!usahaJabatan.value) return alert('Pilih Jenis Usaha dulu — itu yang menentukan menu mana yang berlaku.');
      menyimpan.value = true;
      try {
        // Menu di kategori milik usaha lain ditulis TERTUTUP, bukan dibiarkan
        // terbuka: layarnya tidak menampilkannya, jadi kalau dibiarkan terbuka
        // Guru tidak punya cara melihat bahwa menu itu masih boleh.
        const kategoriBoleh = new Set(kategoriTampil.value);
        const menusPolos = {};
        DAFTAR_MENU.forEach(m => {
          menusPolos[m.id] = kategoriBoleh.has(m.kategori) ? { ...menus[m.id] } : TUTUP_IZIN_JABATAN();
        });
        await setDoc(doc(db, 'akses_jabatan', jabatanDipilih.value.trim().toLowerCase()), {
          nama: jabatanDipilih.value,
          role: roleJabatan.value,
          jenis_pekerjaan: usahaJabatan.value,
          menus: menusPolos
        });
        adaPembatasanTersimpan.value = true;
        alert(`Jabatan "${jabatanDipilih.value}" tersimpan.`);
        await sinkronKaryawan(true);
      } catch (e) {
        console.error('Gagal simpan akses_jabatan:', e);
        alert('Gagal menyimpan jabatan.');
      }
      menyimpan.value = false;
    }

    // role & jenis_pekerjaan di users adalah SALINAN dari jabatan. Tiap definisi
    // jabatan berubah, salinan itu ikut diperbarui, kalau tidak Rules memakai
    // nilai lama sampai karyawannya kebetulan diedit satu per satu.
    async function sinkronKaryawan(otomatis) {
      if (!jabatanDipilih.value) return;
      menyinkron.value = true;
      let diperbarui = 0, gagal = 0;
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('jabatan', '==', jabatanDipilih.value)));
        if (snap.empty) {
          if (!otomatis) alert('Belum ada karyawan dengan jabatan ini.');
          menyinkron.value = false;
          return;
        }
        if (!otomatis && !confirm(`Terapkan role "${roleJabatan.value}" dan usaha "${usahaJabatan.value}" ke ${snap.size} karyawan berjabatan ini?`)) {
          menyinkron.value = false;
          return;
        }
        for (const d of snap.docs) {
          const p = d.data();
          if (p.role === roleJabatan.value && p.jenis_pekerjaan === usahaJabatan.value) continue;
          try {
            await updateDoc(doc(db, 'users', d.id), { role: roleJabatan.value, jenis_pekerjaan: usahaJabatan.value });
            diperbarui++;
          } catch (e) { console.error('Gagal sinkron', d.id, e); gagal++; }
        }
        alert(`Sinkron selesai. Diperbarui: ${diperbarui}, gagal: ${gagal}. Karyawan yang sedang login perlu login ulang supaya izinnya ikut berubah.`);
      } catch (e) {
        console.error('Gagal sinkron karyawan:', e);
        alert('Gagal menyinkronkan karyawan.');
      }
      menyinkron.value = false;
    }

    async function hapusPengaturan() {
      if (!jabatanDipilih.value) return;
      if (!confirm(`Hapus pengaturan akses jabatan "${jabatanDipilih.value}"? Karyawan berjabatan ini kembali tanpa pembatasan menu (mengikuti gerbang role saja).`)) return;
      menghapus.value = true;
      try {
        await deleteDoc(doc(db, 'akses_jabatan', jabatanDipilih.value.trim().toLowerCase()));
        DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN_JABATAN(); });
        adaPembatasanTersimpan.value = false;
        alert('Pengaturan jabatan dihapus.');
      } catch (e) {
        console.error('Gagal hapus akses_jabatan:', e);
        alert('Gagal menghapus pengaturan.');
      }
      menghapus.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });

    return { muat,
      daftarJabatan, daftarUsaha, memuat, menyimpan, menghapus, menyinkron,
      jabatanDipilih, roleJabatan, usahaJabatan, namaJabatanBaru, adaPembatasanTersimpan,
      ROLE_BAKU_JABATAN, pilihJabatan, tambahJabatan, simpan, sinkronKaryawan, hapusPengaturan,
      menus, kategoriTampil, kategoriTerbuka, toggleKategori, menuUntukKategori, cariMenu,
      semuaTercentangKolom, toggleKolomKategori
    };
  },
  template: `
    <div>
      <div class="gc-card" style="background:var(--blue); border:none; margin-bottom:16px;">
        <h4 class="gc-heading" style="font-weight:700; font-size:13px; color:var(--teal-text);"><i class="fas fa-user-tie" style="margin-right:8px;"></i> Jabatan &amp; Akses</h4>
        <p style="font-size:11px; color:var(--teal-text); margin-top:4px; opacity:.85;">Satu jabatan menyimpan tiga hal: <b>Role</b> (pengaman, menentukan apa yang boleh disimpan), <b>Jenis Usaha</b> (menentukan data siapa yang terlihat), dan <b>menu</b> yang tampil. Pasang jabatannya ke karyawan di pill Assign — role dan usaha ikut otomatis. Owner tidak terpengaruh, selalu penuh.</p>
      </div>

      <div class="gc-card" style="margin-bottom:16px;">
        <div style="display:grid; gap:12px; margin-bottom:12px;" class="grid-cols-1 md:grid-cols-3">
          <div class="gc-field" style="margin-bottom:0;">
            <label>Jabatan</label>
            <select :value="jabatanDipilih" @change="pilihJabatan($event.target.value)">
              <option value="">— pilih jabatan —</option>
              <option v-for="j in daftarJabatan" :key="j" :value="j">{{ j }}</option>
            </select>
          </div>
          <div class="gc-field" style="margin-bottom:0;">
            <label>Role (pengaman)</label>
            <select v-model="roleJabatan" :disabled="!jabatanDipilih">
              <option v-for="r in ROLE_BAKU_JABATAN" :key="r" :value="r">{{ r.toUpperCase() }}</option>
            </select>
          </div>
          <div class="gc-field" style="margin-bottom:0;">
            <label>Jenis Usaha</label>
            <select v-model="usahaJabatan" :disabled="!jabatanDipilih">
              <option value="">— pilih usaha —</option>
              <option v-for="u in daftarUsaha" :key="u" :value="u">{{ u }}</option>
            </select>
          </div>
        </div>
        <div style="display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap; border-top:1px solid var(--line); padding-top:12px;">
          <div class="gc-field" style="margin-bottom:0; flex:1; min-width:200px;">
            <label>Jabatan baru</label>
            <input v-model="namaJabatanBaru" type="text" placeholder="Contoh: Admin HRD ZCO">
          </div>
          <button @click="tambahJabatan" class="btn-outline" style="white-space:nowrap;"><i class="fas fa-plus" style="margin-right:6px;"></i> Tambah</button>
        </div>
      </div>

      <div v-if="jabatanDipilih" style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap;">
        <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="flex:1; min-width:180px;">
          <i class="fas" :class="menyimpan ? 'fa-spinner fa-spin' : 'fa-save'" style="margin-right:8px;"></i>{{ menyimpan ? 'Menyimpan...' : 'Simpan Jabatan' }}
        </button>
        <button @click="sinkronKaryawan(false)" :disabled="menyinkron" class="btn-outline" style="flex:1; min-width:180px;">
          <i class="fas" :class="menyinkron ? 'fa-spinner fa-spin' : 'fa-rotate'" style="margin-right:8px;"></i>{{ menyinkron ? 'Menyinkron...' : 'Terapkan ke karyawan' }}
        </button>
        <button v-if="adaPembatasanTersimpan" @click="hapusPengaturan" :disabled="menghapus" class="btn-ghost" style="flex:1; min-width:180px; border:1.5px solid var(--burgundy); color:var(--burgundy);">
          <i class="fas" :class="menghapus ? 'fa-spinner fa-spin' : 'fa-trash'" style="margin-right:8px;"></i>{{ menghapus ? 'Menghapus...' : 'Hapus Pengaturan' }}
        </button>
      </div>

      <div v-if="jabatanDipilih && !usahaJabatan" class="gc-card" style="margin-bottom:14px; border:1.5px solid var(--burgundy);">
        <p style="font-size:11.5px; color:var(--burgundy); font-weight:700;">Pilih Jenis Usaha dulu — menu yang berlaku untuk jabatan ini baru muncul setelah itu.</p>
      </div>

      <div v-if="jabatanDipilih && usahaJabatan" style="position:relative; margin-bottom:14px;">
        <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
        <input v-model="cariMenu" type="text" placeholder="Cari nama menu..." style="width:100%; max-width:320px; padding:9px 13px 9px 34px; background:var(--ivory-dim); border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
      </div>

      <div v-if="jabatanDipilih && usahaJabatan" v-for="kategori in kategoriTampil" :key="kategori" class="gc-card" style="margin-bottom:12px; padding:0; overflow:hidden;">
        <div @click="toggleKategori(kategori)" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; cursor:pointer; background:var(--ivory-dim);">
          <h3 class="gc-heading" style="font-size:13px; font-weight:700;">{{ kategori }}</h3>
          <i class="fas" :class="kategoriTerbuka[kategori] ? 'fa-chevron-up' : 'fa-chevron-down'" style="color:var(--text-muted);"></i>
        </div>
        <div v-show="kategoriTerbuka[kategori]" class="gc-table-scroll">
          <table class="gc-table" style="table-layout:fixed; min-width:640px;">
            <thead>
              <tr>
                <th class="freeze freeze-left" style="width:220px;">Nama menu</th>
                <th v-for="f in ['view','add','edit','delete','print']" :key="f" style="width:84px; text-align:center;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="checkbox" :checked="semuaTercentangKolom(kategori, f)" @change="toggleKolomKategori(kategori, f)" style="accent-color:var(--burgundy); width:14px; height:14px;">
                    <span>{{ f.charAt(0).toUpperCase() + f.slice(1) }}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in menuUntukKategori(kategori)" :key="m.id">
                <td class="freeze freeze-left" style="font-weight:600;">{{ m.label }}</td>
                <td v-for="f in ['view','add','edit','delete','print']" :key="f" style="text-align:center;">
                  <input type="checkbox" v-model="menus[m.id][f]" style="accent-color:var(--ok); width:16px; height:16px;">
                </td>
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


// "Akses & Keamanan" = 1 layar dengan 3 pill (Petakan Menu/Jabatan/Assign).
// Markup pill + pane ada di index.html; petaMount di dashboard.js mengarah ke
// window.pastikanMountAksesKeamanan di bawah.

window.pindahPillAksesKeamanan = function(nama) {
  const semua = ['petamenu', 'jabatan', 'assign'];
  semua.forEach(n => {
    const pane = document.getElementById('pane-akses-' + n);
    const tombol = document.getElementById('pill-akses-' + n);
    if (pane) pane.classList.toggle('hidden', n !== nama);
    if (tombol) tombol.classList.toggle('active', n === nama);
  });
};
window.pastikanMountAksesKeamanan = function() {
  window.pastikanMountPetaMenu();
  window.pastikanMountJabatanAkses();
  if (window.pastikanMountHakAkses) window.pastikanMountHakAkses();
};
