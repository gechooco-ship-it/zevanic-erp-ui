// js/vue-config.js
// Zevanic House > Config. Pusat data referensi produksi + Reset Testing:
// 10 child-tab, tiap tab satu Vue app kecil.
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
// - Tidak ada UI hapus master_tlc; salah ketik dibersihkan lewat Firebase Console.
// - Ke-9 tab memakai satu menu-id 'config_master_data' (didaftarkan di
//   vue-config-akses.js), defaultnya Owner saja.
// - Mount LAZY per tab lewat window.pastikanMountConfigXxx yang dipanggil
//   dashboard.js; jangan dipanggil saat load, itu membaca 9 koleksi sekaligus.
// - Tab Reset Testing hanya menyentuh data Pesanan/Persiapan/Collection/Proses
//   (+ koreksi saldo_piutang pelanggan). Zevanic House & Management tidak.

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, deleteDoc, getDoc, getDocs, setDoc, serverTimestamp, writeBatch, increment } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { MasterDataCategory, MasterDataTabelManager } from './vue-components.js?v=13';
import { PopupPinGenerik } from './vue-scan-cetak.js?v=10';

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
  { jalur_key: 'pp_serie', nama_menu: 'Collection › Pengumpulan + Serie', aktif: false, tlcKodeSekarang: 'TLC-SER' },
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
      <p style="font-size:11px; color:var(--text-faint); margin:-4px 0 10px;">1 baris = 1 titik/menu yang punya kode tugas sendiri. <b>Nama TLC</b> = cari &amp; pilih titik TLC yang sudah ada, atau ketik nama baru (otomatis dibuatkan entry-nya). <b>TLC Divisi</b> = kode TLC-nya, muncul di label cetak (di bawahnya diikuti kode tugas). <b>Kode TLC</b> (2 digit) dipakai gabung ke Kode Grouping utk label+query scan QR (mis. kode_grouping_induk <code>G26R0912P001</code> + kode TLC <code>12</code> + urutan bahan+anak SPK+komponen &rarr; <code>G26R0912P001-120101-01</code>) — <b>cuma benar-benar dipakai generator</b> utk 4 baris "Persiapan Produksi" teratas (tanda hijau); baris lain aman diisi/dikosongkan sebagai referensi dulu.</p>

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


// Reset Testing — hapus data uji coba menu Pesanan, Persiapan Produksi,
// Collection, dan Proses Produksi SAJA. Zevanic House, Management, Stok dan
// Pembelian (lot, kartu stok, nota) dan semua master TIDAK boleh masuk daftar.
// Hapus per 400 dokumen (batas batch 500). bawaan:false = tidak dicentang awal.
const KOLEKSI_RESET = [
  { id: 'pesanan', grup: 'Pesanan', ket: 'Pesanan kasir' }, { id: 'transaksi_kasir', grup: 'Pesanan', ket: 'Pesanan kasir (nama lama)' },
  { id: 'piutang_pembayaran', grup: 'Pesanan', ket: 'Pembayaran piutang pesanan' }, { id: 'order', grup: 'Pesanan', ket: 'ID Order' },
  { id: 'order_spk', grup: 'Pesanan', ket: 'ID Order (nama lama)' },
  { id: 'spk_separating', grup: 'Persiapan', ket: 'Separating' }, { id: 'spk_grouping', grup: 'Persiapan', ket: 'Grouping' },
  { id: 'spk_track', grup: 'Persiapan', ket: 'Track Bahan/ACC/Vendor' }, { id: 'persiapan_masalah', grup: 'Persiapan', ket: 'Masalah' },
  { id: 'roll_sisa_webbing', grup: 'Persiapan', ket: 'Sisa roll webbing (lama)' }, { id: 'persiapan_komponen', grup: 'Persiapan', ket: 'Komponen ACC (lama)' },
  { id: 'order_belanja_driver', grup: 'Persiapan', ket: 'Order driver — terkait nota pembelian', bawaan: false },
  { id: 'pending_driver', grup: 'Persiapan', ket: 'Pending driver — terkait nota pembelian', bawaan: false },
  { id: 'bagging', grup: 'Persiapan/Proses', ket: 'Bagging' }, { id: 'tugas_kirim', grup: 'Persiapan/Proses', ket: 'Kode tugas' },
  { id: 'log_scan', grup: 'Persiapan/Proses', ket: 'Log scan' }, { id: 'cetak_ulang_log', grup: 'Persiapan/Proses', ket: 'Log cetak ulang' },
  { id: 'separating_batch', grup: 'Proses', ket: 'Batch Serie (lama)' }, { id: 'cutting_track', grup: 'Proses', ket: 'Cutting' },
  { id: 'label_komponen', grup: 'Proses', ket: 'Label komponen' }, { id: 'sewing_track', grup: 'Proses', ket: 'Sewing' },
  { id: 'finishing_track', grup: 'Proses', ket: 'Finishing' }, { id: 'label_pcs', grup: 'Proses', ket: 'Label pcs' },
  { id: 'berita_acara', grup: 'Proses', ket: 'Berita Acara' }, { id: 'opname_produk_jadi', grup: 'Proses', ket: 'Opname gudang barang jadi' },
  { id: 'pengaturan_id_spk_separating', grup: 'Counter', ket: 'Separating' }, { id: 'pengaturan_id_spk_grouping', grup: 'Counter', ket: 'Grouping' },
  { id: 'pengaturan_id_tugas_kirim', grup: 'Counter', ket: 'Kode tugas' }, { id: 'pengaturan_id_bagging', grup: 'Counter', ket: 'Bagging' },
  { id: 'pengaturan_id_label_komponen', grup: 'Counter', ket: 'Label komponen' }, { id: 'pengaturan_id_label_pcs', grup: 'Counter', ket: 'Label pcs' },
  { id: 'pengaturan_id_persiapan_masalah', grup: 'Counter', ket: 'MSL' }, { id: 'pengaturan_id_persiapan_masalah_pengajuan', grup: 'Counter', ket: 'Pengajuan masalah' },
  { id: 'pengaturan_id_berita_acara', grup: 'Counter', ket: 'Berita Acara' },
  { id: 'pengaturan_id_order_belanja_driver', grup: 'Counter', ket: 'Order driver', bawaan: false }
];
// Pesanan uji coba ikut menaikkan master_pelanggan.saldo_piutang (Zevanic
// House). Sebelum dihapus, sisa_piutang-nya dikurangkan balik per pelanggan.
const KOLEKSI_BERPIUTANG = ['pesanan', 'transaksi_kasir'];
const AppConfigResetTesting = {
  components: { PopupPinGenerik },
  setup() {
    const jumlah = reactive({});
    const pilih = reactive(Object.fromEntries(KOLEKSI_RESET.map(k => [k.id, k.bawaan !== false])));
    const memuat = ref(false);
    const sedangHapus = ref(false);
    const konfirmasi = ref('');
    const pinAktif = ref(false);
    const log = ref([]);
    async function muat() {
      memuat.value = true;
      for (const k of KOLEKSI_RESET) {
        try { jumlah[k.id] = (await getDocs(collection(db, k.id))).size; } catch (e) { jumlah[k.id] = '?'; }
      }
      memuat.value = false;
    }
    function mulai() {
      if (konfirmasi.value !== 'RESET') { alert('Ketik RESET (huruf besar) untuk konfirmasi.'); return; }
      if (!KOLEKSI_RESET.some(k => pilih[k.id])) { alert('Pilih minimal satu koleksi.'); return; }
      pinAktif.value = true;
    }
    async function pinSukses() {
      pinAktif.value = false; sedangHapus.value = true; log.value = [];
      for (const k of KOLEKSI_RESET.filter(x => pilih[x.id])) {
        try {
          const snap = await getDocs(collection(db, k.id));
          // Koreksi saldo ditulis di batch yang SAMA dengan hapusnya (increment),
          // jadi gagal di tengah tidak membuat saldo terkurang dua kali.
          const berpiutang = KOLEKSI_BERPIUTANG.includes(k.id);
          const pelangganAda = new Set();
          if (berpiutang) {
            const ids = [...new Set(snap.docs.map(d => d.data().pelanggan_id).filter(Boolean))];
            for (const pid of ids) { if ((await getDoc(doc(db, 'master_pelanggan', pid))).exists()) pelangganAda.add(pid); }
          }
          for (let i = 0; i < snap.docs.length; i += 400) {
            const potong = snap.docs.slice(i, i + 400);
            const batch = writeBatch(db);
            potong.forEach(d => batch.delete(d.ref));
            if (berpiutang) {
              const per = {};
              potong.forEach(d => { const x = d.data(); const sisa = parseFloat(x.sisa_piutang) || 0; if (pelangganAda.has(x.pelanggan_id) && sisa > 0) per[x.pelanggan_id] = (per[x.pelanggan_id] || 0) + sisa; });
              Object.entries(per).forEach(([pid, sisa]) => batch.set(doc(db, 'master_pelanggan', pid), { saldo_piutang: increment(-sisa) }, { merge: true }));
            }
            await batch.commit();
          }
          if (berpiutang && pelangganAda.size) log.value.push('saldo_piutang ' + pelangganAda.size + ' pelanggan dikoreksi');
          log.value.push(k.id + ': ' + snap.size + ' dihapus');
        } catch (e) { console.error('Gagal reset ' + k.id + ':', e); log.value.push(k.id + ': GAGAL (' + (e.code || e.message) + ')'); }
      }
      konfirmasi.value = ''; sedangHapus.value = false;
      await muat();
    }
    onMounted(async () => { await window.authReady; await muat(); });
    return { KOLEKSI_RESET, jumlah, pilih, memuat, sedangHapus, konfirmasi, pinAktif, log, muat, mulai, pinSukses };
  },
  template: `
    <div class="gc-card" style="padding:14px;">
      <h3 class="gc-heading" style="font-size:14px; font-weight:700; margin:0 0 4px;">Reset Data Testing</h3>
      <p style="font-size:11.5px; color:var(--text-faint); margin:0 0 12px;">Hanya data uji coba menu Pesanan, Persiapan Produksi, Collection, dan Proses Produksi. Zevanic House, Management, lot, stok, kartu stok, nota pembelian, dan master data TIDAK ikut. Saldo piutang pelanggan dari pesanan uji coba dikoreksi otomatis. Tidak bisa dibatalkan.</p>
      <div class="gc-table-scroll" style="margin-bottom:12px;">
        <table style="width:100%; border-collapse:collapse; font-size:11.5px;">
          <tbody>
            <tr v-for="k in KOLEKSI_RESET" :key="k.id" style="border-bottom:1px solid var(--line);">
              <td style="padding:5px 8px; width:28px;"><input type="checkbox" v-model="pilih[k.id]"></td>
              <td style="padding:5px 8px; color:var(--text-faint);">{{ k.grup }}</td>
              <td style="padding:5px 8px;" class="gc-num">{{ k.id }}</td>
              <td style="padding:5px 8px; color:var(--text-faint);">{{ k.ket }}</td>
              <td style="padding:5px 8px; text-align:right;" class="gc-num">{{ memuat ? '...' : jumlah[k.id] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="gc-field" style="margin-bottom:10px;"><label>Ketik RESET untuk konfirmasi</label><input v-model="konfirmasi" type="text" autocomplete="off"></div>
      <div style="display:flex; gap:8px;">
        <button @click="muat" :disabled="memuat || sedangHapus" class="btn-outline" style="flex:1; padding:9px;">Hitung Ulang</button>
        <button @click="mulai" :disabled="sedangHapus" class="btn-primary" style="flex:1; padding:9px; background:var(--danger);">{{ sedangHapus ? 'Menghapus...' : 'Hapus Data Testing' }}</button>
      </div>
      <div v-if="log.length" style="margin-top:10px; font-size:11px;" class="gc-num"><div v-for="(l,i) in log" :key="i">{{ l }}</div></div>
    </div>
    <popup-pin-generik v-if="pinAktif" judul="PIN Owner — Reset Data Testing" pesan="Data yang dicentang akan dihapus permanen." konteks="Config - Reset Data Testing" :roles-diizinkan="['owner','superuser','pic_owner']" @sukses="pinSukses" @batal="pinAktif = false" />
  `
};

let vmConfigJenisBahan = null;
let vmConfigJenisAksesoris = null;
let vmConfigSatuan = null;
let vmConfigWarna = null;
let vmConfigUkuran = null;
let vmConfigJenisProduk = null;
let vmConfigKomponen = null;
let vmConfigTahapPersiapan = null;
let vmConfigTlc = null;
let vmConfigResetTesting = null;

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
window.pastikanMountConfigResetTesting = function() {
  if (vmConfigResetTesting) { if (typeof vmConfigResetTesting.muat === 'function') vmConfigResetTesting.muat(); return; }
  const mountPoint = document.getElementById('vue-config-resettesting');
  if (mountPoint) vmConfigResetTesting = createApp(AppConfigResetTesting).mount('#vue-config-resettesting');
};
