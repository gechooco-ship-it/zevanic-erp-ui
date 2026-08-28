// js/vue-config.js
// ============================================================================
// Zevanic House > Config — menu BARU (27 Agt 2026, §26.1). Pusat kelola data
// referensi yang SEBELUMNYA tersebar di gear (Pengaturan) 2 layar beda:
//   - Gear "Entry Bahan & Aksesoris" (vue-bahan-aksesoris.js): Jenis Bahan,
//     Jenis Aksesoris, Data Satuan, Data Warna, Data Ukuran.
//   - Gear "Stock & Pembelian" (vue-stock-pembelian.js): Data Suplayer.
//
// Permintaan Guru: setiap tab child di sini formatnya "entry dan searchbox +
// bawahnya table" — BEDA dari tampilan lama (kumpulan tag/chip) yang masih
// dipertahankan APA ADANYA di semua pemakaian lama (Config Karyawan dst).
// Makanya MasterDataCategory & MasterDataTabelManager (vue-components.js)
// ditambah prop BARU `tampilTabel` (default false = tidak berubah) — logic
// tambah/hapus/cari TETAP 1 sumber yang sama, cuma template render beda.
//
// TIDAK dipindah ke sini (keputusan Guru, diskusi 27 Agt 2026):
//   - Data Rak Penyimpanan (dulu di gear Entry Bahan & Aksesoris) — DIHAPUS
//     TOTAL dari gear (bukan dipindah), karena sudah ada menu "Rak
//     Penyimpanan" sendiri yang lebih lengkap (vue-rak-penyimpanan.js).
//   - Prefix ID Bahan/Aksesoris & Prefix No. Pembelian — TETAP di gear
//     masing-masing, karena sifatnya setting teknis (counter internal),
//     bukan data referensi yang dicari-cari.
//
// Izin akses: SEMUA 6 tab pakai 1 menu-id yang sama, 'config_master_data'
// (didaftarkan di vue-config-akses.js DAFTAR_MENU) — sama seperti pola
// "Config Karyawan" (1 menu-id dipakai bareng banyak MasterDataCategory
// sekaligus). Menu BARU defaultnya HANYA Owner (kebijakan baku project ini)
// — kalau Guru mau Admin/PIC/Superuser juga bisa akses, atur manual lewat
// Config Akses setelah kode ini live.
//
// Pola mount: SAMA seperti child-tab lain di app ini (lihat vue-rak-
// penyimpanan.js) — 6 mount point terpisah, masing-masing Vue app kecil
// (cuma bungkus 1 komponen reusable), di-mount LAZY lewat
// window.pastikanMountConfigXxx() yang dipanggil dashboard.js
// (pindahSubTab()) PAS tab-nya benar-benar dibuka — supaya tidak baca
// Firestore 6 koleksi sekaligus kalau orang belum pernah buka Config.
// ============================================================================
import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { MasterDataCategory, MasterDataTabelManager } from './vue-components.js?v=2';

const MENU_ID_CONFIG = 'config_master_data';

const AppConfigJenisBahan = {
  components: { MasterDataCategory },
  template: `<master-data-category kategori="jenis_bahan" label="Jenis Bahan" menu-id="${MENU_ID_CONFIG}" :tampil-tabel="true" />`
};

const AppConfigJenisAksesoris = {
  components: { MasterDataCategory },
  template: `<master-data-category kategori="jenis_aksesoris" label="Jenis Aksesoris" menu-id="${MENU_ID_CONFIG}" :tampil-tabel="true" />`
};

const AppConfigSatuan = {
  components: { MasterDataTabelManager },
  template: `<master-data-tabel-manager koleksi="master_satuan" label-singular="Satuan" label-nama="Nama Satuan" menu-id="${MENU_ID_CONFIG}" :tampil-tabel="true" />`
};

const AppConfigWarna = {
  components: { MasterDataTabelManager },
  template: `<master-data-tabel-manager koleksi="master_warna" label-singular="Warna" label-nama="Nama Warna" menu-id="${MENU_ID_CONFIG}" :tampil-tabel="true" />`
};

const AppConfigUkuran = {
  components: { MasterDataTabelManager },
  template: `<master-data-tabel-manager koleksi="master_ukuran" label-singular="Ukuran" label-nama="Nama Ukuran" menu-id="${MENU_ID_CONFIG}" :tampil-tabel="true" />`
};

// AppConfigJenisProduk — BARU (28 Agt 2026). Pola SAMA PERSIS seperti
// AppConfigUkuran di atas (koleksi 2-kolom nama+keterangan lewat
// MasterDataTabelManager) — permintaan Guru, "buat seperti Data Ukuran".
// Sumber DropdownCari "Jenis Produk" di Master Produk > Entry Produk
// (koleksi master_jenis_produk, lihat js/vue-master-produk.js).
const AppConfigJenisProduk = {
  components: { MasterDataTabelManager },
  template: `<master-data-tabel-manager koleksi="master_jenis_produk" label-singular="Jenis Produk" label-nama="Nama Jenis Produk" menu-id="${MENU_ID_CONFIG}" :tampil-tabel="true" />`
};

// AppConfigSuplayer — field3 (Kontak/Alamat) sama persis seperti
// MasterSuplayerManager LAMA (dulu di gear Stock & Pembelian, SEKARANG
// dihapus dari sana — lihat catatan di vue-stock-pembelian.js). TIDAK
// diimpor silang dari file itu (konsisten pola "disalin, bukan diimpor
// silang" di project ini) — di sini cukup panggil MasterDataTabelManager
// langsung dengan props yang sama.
const AppConfigSuplayer = {
  components: { MasterDataTabelManager },
  template: `<master-data-tabel-manager koleksi="master_suplayer" label-singular="Suplayer" label-nama="Nama Suplayer" menu-id="${MENU_ID_CONFIG}" field3-key="kontak" field3-label="Kontak/Alamat (opsional)" :tampil-tabel="true" />`
};

let vmConfigJenisBahan = null;
let vmConfigJenisAksesoris = null;
let vmConfigSatuan = null;
let vmConfigWarna = null;
let vmConfigUkuran = null;
let vmConfigJenisProduk = null;
let vmConfigSuplayer = null;

window.pastikanMountConfigJenisBahan = function() {
  if (vmConfigJenisBahan) return;
  const mountPoint = document.getElementById('vue-config-jenisbahan');
  if (mountPoint) vmConfigJenisBahan = createApp(AppConfigJenisBahan).mount('#vue-config-jenisbahan');
};
window.pastikanMountConfigJenisAksesoris = function() {
  if (vmConfigJenisAksesoris) return;
  const mountPoint = document.getElementById('vue-config-jenisaksesoris');
  if (mountPoint) vmConfigJenisAksesoris = createApp(AppConfigJenisAksesoris).mount('#vue-config-jenisaksesoris');
};
window.pastikanMountConfigSatuan = function() {
  if (vmConfigSatuan) return;
  const mountPoint = document.getElementById('vue-config-satuan');
  if (mountPoint) vmConfigSatuan = createApp(AppConfigSatuan).mount('#vue-config-satuan');
};
window.pastikanMountConfigWarna = function() {
  if (vmConfigWarna) return;
  const mountPoint = document.getElementById('vue-config-warna');
  if (mountPoint) vmConfigWarna = createApp(AppConfigWarna).mount('#vue-config-warna');
};
window.pastikanMountConfigUkuran = function() {
  if (vmConfigUkuran) return;
  const mountPoint = document.getElementById('vue-config-ukuran');
  if (mountPoint) vmConfigUkuran = createApp(AppConfigUkuran).mount('#vue-config-ukuran');
};
window.pastikanMountConfigJenisProduk = function() {
  if (vmConfigJenisProduk) return;
  const mountPoint = document.getElementById('vue-config-jenisproduk');
  if (mountPoint) vmConfigJenisProduk = createApp(AppConfigJenisProduk).mount('#vue-config-jenisproduk');
};
window.pastikanMountConfigSuplayer = function() {
  if (vmConfigSuplayer) return;
  const mountPoint = document.getElementById('vue-config-suplayer');
  if (mountPoint) vmConfigSuplayer = createApp(AppConfigSuplayer).mount('#vue-config-suplayer');
};
