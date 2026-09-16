// js/vue-config.js
// Zevanic House > Config. Pusat data referensi produksi: 9 child-tab, tiap tab
// satu Vue app kecil pembungkus komponen master data yang reusable.
//
// Koleksi & field:
// - master_data/jenis_bahan & /jenis_aksesoris: lewat MasterDataCategory.
// - master_satuan, master_warna, master_ukuran, master_jenis_produk,
//   master_komponen, master_tahap_persiapan: lewat MasterDataTabelManager.
// - master_prefix_divisi: nama_menu, nama_tlc, tlc_tujuan, kode_tujuan.
// - master_tlc: kode, nama, tipe — entry dibuat OTOMATIS saat kode baru diketik
//   di kolom Nama TLC tabel Kode per Divisi.
//
// Jebakan:
// - Tidak ada UI hapus master_tlc di layar ini; entry salah ketik cuma bisa
//   dibersihkan lewat Firebase Console.
// - Ke-9 tab memakai satu menu-id 'config_master_data' (didaftarkan di
//   vue-config-akses.js), defaultnya Owner saja.
// - Mount LAZY per tab lewat window.pastikanMountConfigXxx yang dipanggil
//   dashboard.js; jangan dipanggil saat load, itu membaca 9 koleksi sekaligus.

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, deleteDoc, getDoc, getDocs, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { MasterDataCategory, MasterDataTabelManager } from './vue-components.js?v=13';

const MENU_ID_CONFIG = 'config_master_data';

const AppConfigJenisBahan = {
  components: { MasterDataCategory },
  template: `<master-data-category ref="mgr" kategori="jenis_bahan" label="Jenis Bahan" menu-id="${MENU_ID_CONFIG}" :tampil-tabel="true" />`
};

const AppConfigJenisAksesoris = {
  components: { MasterDataCategory },
  template: `<master-data-category ref="mgr" kategori="jenis_aksesoris" label="Jenis Aksesoris" menu-id="${MENU_ID_CONFIG}" :tampil-tabel="true" />`
};

const AppConfigSatuan = {
  components: { MasterDataTabelManager },
  template: `<master-data-tabel-manager ref="mgr" koleksi="master_satuan" label-singular="Satuan" label-nama="Nama Satuan" menu-id="${MENU_ID_CONFIG}" :tampil-tabel="true" />`
};

const AppConfigWarna = {
  components: { MasterDataTabelManager },
  template: `<master-data-tabel-manager ref="mgr" koleksi="master_warna" label-singular="Warna" label-nama="Nama Warna" menu-id="${MENU_ID_CONFIG}" :tampil-tabel="true" />`
};

const AppConfigUkuran = {
  components: { MasterDataTabelManager },
  template: `<master-data-tabel-manager ref="mgr" koleksi="master_ukuran" label-singular="Ukuran" label-nama="Nama Ukuran" menu-id="${MENU_ID_CONFIG}" :tampil-tabel="true" />`
};

// AppConfigJenisProduk — pola sama seperti AppConfigUkuran di atas (koleksi
// 2-kolom nama+keterangan lewat MasterDataTabelManager). Sumber
// DropdownCari "Jenis Produk" di Master Produk > Entry Produk (koleksi
// master_jenis_produk, lihat js/vue-master-produk.js).
const AppConfigJenisProduk = {
  components: { MasterDataTabelManager },
  template: `<master-data-tabel-manager ref="mgr" koleksi="master_jenis_produk" label-singular="Jenis Produk" label-nama="Nama Jenis Produk" menu-id="${MENU_ID_CONFIG}" :tampil-tabel="true" />`
};

// AppConfigKomponen — koleksi master_komponen, 2 kolom nama+keterangan lewat
// MasterDataTabelManager. Belum disambungkan ke field/dropdown manapun.
// :izinkan-import-excel="true" mengaktifkan Import/Template Excel — opt-in per
// tab, tab Config lain tidak dapat tombol itu kecuali propnya dinyalakan juga.
const AppConfigKomponen = {
  components: { MasterDataTabelManager },
  template: `<master-data-tabel-manager ref="mgr" koleksi="master_komponen" label-singular="Komponen" label-nama="Nama Komponen" menu-id="${MENU_ID_CONFIG}" :tampil-tabel="true" :izinkan-import-excel="true" />`
};

// AppConfigTahapPersiapan — koleksi master_tahap_persiapan lewat
// MasterDataTabelManager. Sumber DropdownCari "Tahap Proses" di BOM Aksesoris
// (js/vue-master-produk.js) dan filter kartu Acc Sewing/Webbing/Finishing di
// Persiapan Produksi V2 — isinya harus persis 3 entry dengan nama itu.
const AppConfigTahapPersiapan = {
  components: { MasterDataTabelManager },
  template: `<master-data-tabel-manager ref="mgr" koleksi="master_tahap_persiapan" label-singular="Tahap Persiapan" label-nama="Nama Tahap (mis. Sewing, Webbing, Finishing)" menu-id="${MENU_ID_CONFIG}" :tampil-tabel="true" />`
};

// AppConfigTlc — satu tabel "Kode per Divisi"; entry master_tlc dibuat otomatis
// lewat kolom Nama TLC (simpanBaris). Tidak ada UI hapus/ubah master_tlc di sini,
// perbaikan lewat Firestore Console. Generator kode cuma baca jalur_key
// bahan/sewing/webbing/finishing; baris pp_*/masalah/custom murni referensi.
const DAFTAR_MENU_DIVISI = [
  { jalur_key: 'bahan', nama_menu: 'Persiapan Produksi › Bahan', aktif: true },
  { jalur_key: 'sewing', nama_menu: 'Persiapan Produksi › Acc Sewing', aktif: true },
  { jalur_key: 'webbing', nama_menu: 'Persiapan Produksi › Acc Webbing', aktif: true },
  { jalur_key: 'finishing', nama_menu: 'Persiapan Produksi › Acc Finishing', aktif: true },
  { jalur_key: 'masalah', nama_menu: 'Persiapan Produksi › Masalah', aktif: false },
  { jalur_key: 'pp_cutting', nama_menu: 'Proses Produksi › Cutting', aktif: false, tlcKodeSekarang: 'TLC-PTG' },
  { jalur_key: 'pp_serie', nama_menu: 'Proses Produksi › Serie (Separating)', aktif: false, tlcKodeSekarang: 'TLC-SER' },
  { jalur_key: 'pp_sewing', nama_menu: 'Proses Produksi › Sewing', aktif: false, tlcKodeSekarang: 'TLC-JHT' },
  { jalur_key: 'pp_finishing', nama_menu: 'Proses Produksi › Finishing', aktif: false, tlcKodeSekarang: 'TLC-FIN' },
  { jalur_key: 'pp_gudang', nama_menu: 'Proses Produksi › Gudang Barang Jadi', aktif: false, tlcKodeSekarang: 'TLC-GBJ' }
];

const AppConfigTlc = {
  setup() {
    const menuId = MENU_ID_CONFIG;
    const bolehTambah = computed(() => window.cekIzinMenu(menuId, 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu(menuId, 'delete') !== false);

    const memuat = ref(true);
    const daftarTlc = ref([]); // master_tlc mentah — sumber saran combobox "Nama TLC"
    const baris = ref([]); // gabungan DAFTAR_MENU_DIVISI (tetap) + baris custom dari Firestore

    function barisKosong(d) {
      return {
        jalur_key: d.jalur_key, nama_menu: d.nama_menu, aktif: !!d.aktif,
        tlcKodeSekarang: d.tlcKodeSekarang || '', custom: false, id: d.jalur_key,
        namaTlc: '', tlcTujuan: '', kodeTujuan: '', menyimpan: false, cariTerbuka: false, kataCari: ''
      };
    }

    async function muat() {
      memuat.value = true;
      try {
        const [snapTlc, snapDivisi] = await Promise.all([
          getDocs(collection(db, 'master_tlc')),
          getDocs(collection(db, 'master_prefix_divisi'))
        ]);
        const listTlc = [];
        snapTlc.forEach(d => listTlc.push({ id: d.id, ...d.data() }));
        listTlc.sort((a, b) => (a.kode || '').localeCompare(b.kode || ''));
        daftarTlc.value = listTlc;

        // Doc id = jalur_key utk 10 baris tetap (deterministik, tidak pernah
        // duplikat) — doc dengan id LAIN dianggap baris custom.
        const petaDivisi = {};
        const customDocs = [];
        snapDivisi.forEach(d => {
          const data = d.data();
          const tetap = DAFTAR_MENU_DIVISI.find(x => x.jalur_key === d.id);
          if (tetap) petaDivisi[d.id] = data; else customDocs.push({ id: d.id, ...data });
        });

        const daftarTetap = DAFTAR_MENU_DIVISI.map(d => {
          const b = barisKosong(d);
          const data = petaDivisi[d.jalur_key];
          if (data) { b.namaTlc = data.nama_tlc || ''; b.tlcTujuan = data.tlc_tujuan || ''; b.kodeTujuan = data.kode_tujuan || ''; }
          return b;
        });
        const daftarCustom = customDocs.map(d => ({
          jalur_key: null, nama_menu: d.nama_menu || '(tanpa nama)', aktif: false, tlcKodeSekarang: '', custom: true, id: d.id,
          namaTlc: d.nama_tlc || '', tlcTujuan: d.tlc_tujuan || '', kodeTujuan: d.kode_tujuan || '', menyimpan: false, cariTerbuka: false, kataCari: ''
        }));
        baris.value = [...daftarTetap, ...daftarCustom];
      } catch (e) { console.error('Gagal muat TLC & Prefix:', e); }
      memuat.value = false;
    }

    // Combobox "Nama TLC" per baris. DropdownCari (vue-components.js) tidak dipakai
    // karena strict-select 1 field string, sedangkan di sini butuh 2 field sekaligus
    // (nama+kode) dan mode "buat baru kalau belum ada" — jadi ditulis sendiri dengan
    // pola sama: kotak ketik + filter + panel saran.
    function saranTlc(row) {
      const kata = (row.kataCari || '').trim().toLowerCase();
      if (!kata) return daftarTlc.value;
      return daftarTlc.value.filter(t => (t.nama || '').toLowerCase().includes(kata) || (t.kode || '').toLowerCase().includes(kata));
    }
    function bukaCari(row) { row.kataCari = ''; row.cariTerbuka = true; }
    function tutupCariTunda(row) {
      // @mousedown.prevent di opsi (pilihTlc) membuat cariTerbuka sudah false sebelum
      // timeout ini jalan — jangan timpa lagi (kataCari sudah dikosongkan pilihTlc).
      // Kalau masih terbuka (user blur tanpa klik saran), commit teks yang diketik
      // jadi Nama TLC baru supaya tidak hilang diam-diam.
      setTimeout(() => {
        if (!row.cariTerbuka) return;
        const kata = (row.kataCari || '').trim();
        if (kata) row.namaTlc = kata;
        row.cariTerbuka = false;
      }, 150);
    }
    function pilihTlc(row, t) {
      row.namaTlc = t.nama; row.tlcTujuan = t.kode;
      row.cariTerbuka = false; row.kataCari = '';
    }

    async function simpanBaris(row) {
      if (!bolehTambah.value) return alert('Anda tidak punya izin menyimpan di sini. Hubungi Owner/PIC.');
      // Baca langsung dari kataCari kalau combobox masih terbuka saat tombol
      // Simpan diklik (blur belum sempat commit, lihat tutupCariTunda).
      const namaTlc = (row.cariTerbuka ? row.kataCari : row.namaTlc).trim();
      const tlcTujuan = row.tlcTujuan.trim().toUpperCase();
      const kodeTujuan = row.kodeTujuan.trim();
      if (kodeTujuan && !/^\d{1,2}$/.test(kodeTujuan)) return alert('Kode TLC wajib angka, maks 2 digit (mis. 12).');
      const kodeTujuanRapi = kodeTujuan ? kodeTujuan.padStart(2, '0') : '';
      if ((namaTlc && !tlcTujuan) || (!namaTlc && tlcTujuan)) return alert('Nama TLC dan TLC Divisi wajib diisi berdua, atau dikosongkan berdua.');
      row.menyimpan = true;
      try {
        // Buat entry master_tlc baru OTOMATIS kalau kode-nya belum ada di daftar
        // .
        if (tlcTujuan && !daftarTlc.value.some(t => (t.kode || '').toLowerCase() === tlcTujuan.toLowerCase())) {
          await addDoc(collection(db, 'master_tlc'), { kode: tlcTujuan, nama: namaTlc, tipe: '', dibuat_pada: serverTimestamp() });
        }
        const data = { nama_menu: row.nama_menu, nama_tlc: namaTlc, tlc_tujuan: tlcTujuan, kode_tujuan: kodeTujuanRapi };
        await setDoc(doc(db, 'master_prefix_divisi', row.id), data, { merge: true });
        await muat();
      } catch (e) {
        console.error('Gagal simpan master_prefix_divisi:', e);
        alert('Gagal menyimpan: ' + (e.code || e.message || e) + '\n\nKalau kodenya "permission-denied": Rules Firestore untuk master_prefix_divisi kemungkinan belum di-publish di Firebase Console.');
        row.menyimpan = false;
      }
    }

    // Baris custom di luar 10 titik tetap (mis. Vendor)
    const formCustom = reactive({ nama_menu: '' });
    const menyimpanCustom = ref(false);
    async function tambahCustom() {
      if (!bolehTambah.value) return alert('Anda tidak punya izin menambah di sini. Hubungi Owner/PIC.');
      const namaMenu = formCustom.nama_menu.trim();
      if (!namaMenu) return alert('Isi Nama Menu/Divisi dulu.');
      menyimpanCustom.value = true;
      try {
        await addDoc(collection(db, 'master_prefix_divisi'), { nama_menu: namaMenu, nama_tlc: '', tlc_tujuan: '', kode_tujuan: '', dibuat_pada: serverTimestamp() });
        formCustom.nama_menu = '';
        await muat();
      } catch (e) { console.error('Gagal tambah baris custom:', e); alert('Gagal menyimpan.'); }
      menyimpanCustom.value = false;
    }
    async function hapusCustom(row) {
      if (!bolehHapus.value) return alert('Anda tidak punya izin menghapus di sini. Hubungi Owner/PIC.');
      if (!confirm(`Hapus baris "${row.nama_menu}"?`)) return;
      try { await deleteDoc(doc(db, 'master_prefix_divisi', row.id)); await muat(); }
      catch (e) { console.error('Gagal hapus baris custom:', e); alert('Gagal menghapus.'); }
    }

    onMounted(async () => { await window.authReady; await muat(); });
    return { muat,
      memuat, baris, bolehTambah, bolehHapus,
      saranTlc, bukaCari, tutupCariTunda, pilihTlc, simpanBaris,
      formCustom, menyimpanCustom, tambahCustom, hapusCustom
    };
  },
  template: `
    <div>
      <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">TLC &amp; Prefix</label>
      <p style="font-size:11px; color:var(--text-faint); margin:-4px 0 10px;">1 baris = 1 titik/menu yang punya kode tugas sendiri. <b>Nama TLC</b> = cari &amp; pilih titik TLC yang sudah ada, atau ketik nama baru (otomatis dibuatkan entry-nya). <b>TLC Divisi</b> = kode TLC-nya, muncul di label cetak (di bawahnya diikuti kode tugas). <b>Kode TLC</b> (2 digit) dipakai gabung ke Kode Grouping utk label+query scan QR (mis. kode_spk <code>G26R0912P001</code> + kode TLC <code>12</code> + urutan bahan+anak SPK+komponen &rarr; <code>G26R0912P001-120101-01</code>) — <b>cuma benar-benar dipakai generator</b> utk 4 baris "Persiapan Produksi" teratas (tanda hijau); baris lain aman diisi/dikosongkan sebagai referensi dulu.</p>

      <div v-if="memuat" style="font-size:11px; color:var(--text-faint);">Memuat...</div>
      <div v-else class="gc-table-scroll">
        <table class="gc-table">
          <thead><tr><th>Nama Menu/Divisi</th><th style="min-width:170px;">Nama TLC</th><th style="width:130px;">TLC Divisi</th><th style="width:90px;">Kode TLC</th><th style="width:90px;">Aksi</th></tr></thead>
          <tbody>
            <tr v-for="row in baris" :key="row.id">
              <td>
                {{ row.nama_menu }}
                <span v-if="row.aktif" class="tag ok" style="margin-left:6px;">aktif &rarr; kode anak SPK</span>
                <span v-else-if="!row.custom" class="tag" style="margin-left:6px; color:var(--text-faint);">referensi</span>
                <div v-if="row.tlcKodeSekarang" style="font-size:9.5px; color:var(--text-faint); margin-top:2px;">kode di app sekarang: <code>{{ row.tlcKodeSekarang }}</code></div>
              </td>
              <td style="position:relative;">
                <input
                  :value="row.cariTerbuka ? row.kataCari : row.namaTlc"
                  @input="row.kataCari = $event.target.value"
                  @focus="bukaCari(row)"
                  @blur="tutupCariTunda(row)"
                  type="text" placeholder="Cari/ketik nama TLC..."
                  style="width:100%; padding:6px 8px; border:1.5px solid var(--line); border-radius:8px; font-size:11.5px; background:var(--ivory-dim); box-sizing:border-box;">
                <div v-if="row.cariTerbuka && saranTlc(row).length" class="gc-card" style="position:absolute; z-index:20; top:100%; left:0; right:0; max-height:160px; overflow-y:auto; padding:4px; margin-top:2px;">
                  <div v-for="t in saranTlc(row)" :key="t.id" @mousedown.prevent="pilihTlc(row, t)" style="padding:6px 8px; font-size:11px; cursor:pointer; border-radius:6px;" onmouseover="this.style.background='var(--ivory-dim)'" onmouseout="this.style.background='transparent'">
                    <b>{{ t.nama }}</b> <span style="color:var(--text-faint);">({{ t.kode }})</span>
                  </div>
                </div>
              </td>
              <td><input v-model="row.tlcTujuan" type="text" maxlength="14" placeholder="mis. TLC-PBI-01" style="width:100%; text-transform:uppercase; padding:6px 8px; border:1.5px solid var(--line); border-radius:8px; font-size:11.5px; box-sizing:border-box;"></td>
              <td><input v-model="row.kodeTujuan" type="text" maxlength="2" placeholder="12" style="width:100%; padding:6px 8px; border:1.5px solid var(--line); border-radius:8px; font-size:11.5px; box-sizing:border-box;"></td>
              <td style="white-space:nowrap;">
                <button v-if="bolehTambah" @click="simpanBaris(row)" :disabled="row.menyimpan" class="btn-primary" style="padding:5px 10px; font-size:11px;">Simpan</button>
                <button v-if="row.custom && bolehHapus" @click="hapusCustom(row)" class="icon-btn" style="color:var(--danger);" title="Hapus baris"><i class="fas fa-trash-alt"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="bolehTambah" style="display:flex; gap:6px; margin-top:12px; flex-wrap:wrap;">
        <input v-model="formCustom.nama_menu" @keyup.enter="tambahCustom" type="text" placeholder="Tambah baris lain (mis. Vendor Sablon)" style="flex:1; min-width:200px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
        <button @click="tambahCustom" :disabled="menyimpanCustom" class="btn-primary" style="padding:0 16px;"><i class="fas fa-plus"></i> Baris Lain</button>
      </div>
    </div>
  `
};

// AppConfigRiwayatPin ada di Scan & Cetak > PIN (AppScanCetakRiwayatPin,
// js/vue-scan-cetak.js), bukan di Config. Konsisten dengan wireframe
// "05 - Scan dan Cetak" §4.1. Tidak ada salinan komponennya di file ini supaya
// tidak ada 2 versi kode yang bisa menyimpang.

let vmConfigJenisBahan = null;
let vmConfigJenisAksesoris = null;
let vmConfigSatuan = null;
let vmConfigWarna = null;
let vmConfigUkuran = null;
let vmConfigJenisProduk = null;
let vmConfigKomponen = null;
let vmConfigTahapPersiapan = null;
let vmConfigTlc = null;

window.pastikanMountConfigJenisBahan = function() {
  if (vmConfigJenisBahan) { const mgr = vmConfigJenisBahan.$refs && vmConfigJenisBahan.$refs.mgr; if (mgr && typeof mgr.muat === 'function') mgr.muat(); return; }
  const mountPoint = document.getElementById('vue-config-jenisbahan');
  if (mountPoint) vmConfigJenisBahan = createApp(AppConfigJenisBahan).mount('#vue-config-jenisbahan');
};
window.pastikanMountConfigJenisAksesoris = function() {
  if (vmConfigJenisAksesoris) { const mgr = vmConfigJenisAksesoris.$refs && vmConfigJenisAksesoris.$refs.mgr; if (mgr && typeof mgr.muat === 'function') mgr.muat(); return; }
  const mountPoint = document.getElementById('vue-config-jenisaksesoris');
  if (mountPoint) vmConfigJenisAksesoris = createApp(AppConfigJenisAksesoris).mount('#vue-config-jenisaksesoris');
};
window.pastikanMountConfigSatuan = function() {
  if (vmConfigSatuan) { const mgr = vmConfigSatuan.$refs && vmConfigSatuan.$refs.mgr; if (mgr && typeof mgr.muat === 'function') mgr.muat(); return; }
  const mountPoint = document.getElementById('vue-config-satuan');
  if (mountPoint) vmConfigSatuan = createApp(AppConfigSatuan).mount('#vue-config-satuan');
};
window.pastikanMountConfigWarna = function() {
  if (vmConfigWarna) { const mgr = vmConfigWarna.$refs && vmConfigWarna.$refs.mgr; if (mgr && typeof mgr.muat === 'function') mgr.muat(); return; }
  const mountPoint = document.getElementById('vue-config-warna');
  if (mountPoint) vmConfigWarna = createApp(AppConfigWarna).mount('#vue-config-warna');
};
window.pastikanMountConfigUkuran = function() {
  if (vmConfigUkuran) { const mgr = vmConfigUkuran.$refs && vmConfigUkuran.$refs.mgr; if (mgr && typeof mgr.muat === 'function') mgr.muat(); return; }
  const mountPoint = document.getElementById('vue-config-ukuran');
  if (mountPoint) vmConfigUkuran = createApp(AppConfigUkuran).mount('#vue-config-ukuran');
};
window.pastikanMountConfigJenisProduk = function() {
  if (vmConfigJenisProduk) { const mgr = vmConfigJenisProduk.$refs && vmConfigJenisProduk.$refs.mgr; if (mgr && typeof mgr.muat === 'function') mgr.muat(); return; }
  const mountPoint = document.getElementById('vue-config-jenisproduk');
  if (mountPoint) vmConfigJenisProduk = createApp(AppConfigJenisProduk).mount('#vue-config-jenisproduk');
};
window.pastikanMountConfigKomponen = function() {
  if (vmConfigKomponen) { const mgr = vmConfigKomponen.$refs && vmConfigKomponen.$refs.mgr; if (mgr && typeof mgr.muat === 'function') mgr.muat(); return; }
  const mountPoint = document.getElementById('vue-config-komponen');
  if (mountPoint) vmConfigKomponen = createApp(AppConfigKomponen).mount('#vue-config-komponen');
};
window.pastikanMountConfigTahapPersiapan = function() {
  if (vmConfigTahapPersiapan) { const mgr = vmConfigTahapPersiapan.$refs && vmConfigTahapPersiapan.$refs.mgr; if (mgr && typeof mgr.muat === 'function') mgr.muat(); return; }
  const mountPoint = document.getElementById('vue-config-tahappersiapan');
  if (mountPoint) vmConfigTahapPersiapan = createApp(AppConfigTahapPersiapan).mount('#vue-config-tahappersiapan');
};
window.pastikanMountConfigTlc = function() {
  if (vmConfigTlc) { if (typeof vmConfigTlc.muat === 'function') vmConfigTlc.muat(); return; }
  const mountPoint = document.getElementById('vue-config-tlc');
  if (mountPoint) vmConfigTlc = createApp(AppConfigTlc).mount('#vue-config-tlc');
};
