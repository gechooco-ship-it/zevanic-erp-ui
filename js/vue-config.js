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
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, deleteDoc, getDoc, getDocs, setDoc, serverTimestamp, query, orderBy, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { MasterDataCategory, MasterDataTabelManager } from './vue-components.js?v=3';

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

// AppConfigKomponen — BARU (28 Agt 2026). Permintaan Guru: "tambah tab
// Data Komponen mirip seperti Data Warna" — pola SAMA PERSIS (koleksi
// 2-kolom nama+keterangan lewat MasterDataTabelManager). KOLEKSI BARU
// (master_komponen), BELUM disambungkan ke field/dropdown manapun (mis.
// BOM Komponen di Master Produk masih pakai Bahan+Warna seperti biasa) —
// Guru cuma minta tab-nya, kalau nanti mau disambungkan ke field
// tertentu, tinggal diminta terpisah.
// BARU (28 Agt 2026, §37) — :izinkan-import-excel="true" mengaktifkan fitur
// Import/Upload Massal Excel + Template (tombol "Import / Template Excel"
// di sebelah searchbox) yang baru ditambahkan ke MasterDataTabelManager
// (vue-components.js). Opt-in per tab — tab Config lain (Satuan/Ukuran/
// Warna/dst) TIDAK ikut dapat tombol ini kecuali propnya juga dinyalakan
// di situ.
const AppConfigKomponen = {
  components: { MasterDataTabelManager },
  template: `<master-data-tabel-manager koleksi="master_komponen" label-singular="Komponen" label-nama="Nama Komponen" menu-id="${MENU_ID_CONFIG}" :tampil-tabel="true" :izinkan-import-excel="true" />`
};

// AppConfigTahapPersiapan — BARU (28 Agt 2026, permintaan Guru: "tambahkan
// menu baru di config > tahap proses (rename jadi Persiapan Untuk Tahap)").
// Pola SAMA PERSIS seperti AppConfigKomponen/AppConfigJenisProduk (koleksi
// 2-kolom nama+keterangan lewat MasterDataTabelManager). Koleksi BARU
// (master_tahap_persiapan) — sumber DropdownCari field "Tahap Proses" di
// BOM Aksesoris (Master Produk > Entry Produk, lihat js/vue-master-
// produk.js) DAN dipakai filter kartu Acc Sewing/Webbing/Finishing di
// menu Persiapan Produksi V2 (js/vue-persiapan-produksi-v2.js — nama file
// dikoreksi 30 Agt 2026, Fase 5 audit; versi LAMA vue-persiapan-produksi.js
// sudah ditinggalkan). Guru diminta isi PERSIS 3 entry "Sewing"/"Webbing"/
// "Finishing" (case-insensitive dicocokkan) supaya ke-3 kartu filter itu
// bisa mengelompokkan baris BOM Aksesoris dengan benar — lihat catatan
// panjang di vue-persiapan-produksi-v2.js soal pencocokan tahap.
const AppConfigTahapPersiapan = {
  components: { MasterDataTabelManager },
  template: `<master-data-tabel-manager koleksi="master_tahap_persiapan" label-singular="Tahap Persiapan" label-nama="Nama Tahap (mis. Sewing, Webbing, Finishing)" menu-id="${MENU_ID_CONFIG}" :tampil-tabel="true" />`
};

// AppConfigTlc — GANTI TOTAL (5 Sep 2026, wireframe handoff "Format TLC dan
// prefix dikelola di Zevanic House › TLC & Prefix" — PEDOMAN-SERAH-TERIMA.md
// §13) dari AppConfigSuplayer LAMA (CRUD Suplayer sekarang di Zevanic House
// > Master Suplayer, js/vue-master-suplayer.js — TIDAK lagi di sini, lihat
// catatan di file itu).
//
// Koleksi `master_tlc` — dikonfirmasi berulang di 4 wireframe SERAH-TERIMA
// terpisah (Persiapan Produksi - Bahan/Acc Sewing/Acc Webbing/Acc Finishing,
// semua mendaftarkan struktur SAMA PERSIS): `{ kode, nama, tipe }`. Contoh
// isi: TLC-BHN, TLC-SEW, TLC-WEB, TLC-FIN, TLC-VDR, TLC-MSL, TLC-PTG-01,
// TLC-SEW-01, TLC-FIN-01, TLC-QC — dipakai SEMUA dropdown "tujuan TLC" pas
// cetak kode tugas di Persiapan Produksi & nanti Proses Produksi (Cutting/
// Serie/dst).
//
// `kode` (mis. "TLC-PTG-01") = identitas utama yang dicari-cari (SAMA peran
// seperti "nama" di MasterDataTabelManager lain), `nama` = deskripsi pos
// (mis. "Potong · meja 1"), `tipe` = kategori pos (bebas isi Owner, mis.
// "tetap"/"custom" atau "bahan"/"sewing"/"vendor" dst — TIDAK didikte kode,
// cuma field teks bebas).
//
// SENGAJA komponen baru sendiri (BUKAN MasterDataTabelManager) — field
// primer di sana SELALU bernama Firestore `nama` (+ opsional field3Key +
// `keterangan`), kalau dipaksa dipakai maka `kode` (yang harus dibaca modul
// lain nanti dengan nama field PERSIS itu) akan tersimpan di bawah key
// `nama` generik, bukan `kode` — beda dari spesifikasi, berisiko bikin
// modul Cutting/Proses Produksi nanti salah baca. Makanya CRUD ditulis
// sendiri di sini, tapi tampilannya tetap ikut pola "entry+searchbox+table"
// yang sama seperti tab Config lain.
//
// KLARIFIKASI (5 Sep 2026) — Guru sudah konfirmasi langsung ("iyah berkaitan
// dengan tlc dan pembuatan prefix kode spk") bahwa "Prefix" di nama tab ini
// BUKAN cuma soal format `kode` TLC (dugaan awal di atas, sudah usang) —
// ADA pengaturan prefix terpisah: prefix kode SPK yang dipakai
// generateKodeSpkGrouping() (js/vue-persiapan-produksi-v2.js) waktu bikin
// `spk_grouping.kode_spk`. Sebelum ini prefix-nya HARDCODE string "SPK" —
// sekarang dibuat bisa diatur di sini, disimpan di koleksi
// `pengaturan_id_spk_grouping` doc `config` (key TETAP "config", BEDA dari
// doc counter harian yang key-nya `{yymmdd}` — supaya tidak pernah tabrakan)
// — polanya SAMA PERSIS seperti prefixBahan/prefixAksesoris di
// js/vue-bahan-aksesoris.js dan prefix Pembelian di js/vue-stock-
// pembelian.js (baca sekali waktu mount, simpan via setDoc merge).
const AppConfigTlc = {
  setup() {
    const menuId = MENU_ID_CONFIG;
    const bolehTambah = computed(() => window.cekIzinMenu(menuId, 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu(menuId, 'delete') !== false);

    const memuat = ref(true);
    const daftar = ref([]);
    const cari = ref('');
    const menyimpan = ref(false);
    const form = reactive({ kode: '', nama: '', tipe: '' });

    // Prefix Kode SPK — BARU (5 Sep 2026), lihat catatan panjang di atas.
    // Default tampil "SPK" kalau doc config belum pernah dibuat (SAMA
    // seperti fallback yang sudah dipakai generateKodeSpkGrouping()).
    const prefixSpk = ref('');
    const menyimpanPrefix = ref(false);
    async function muatPrefixSpk() {
      try {
        const snap = await getDoc(doc(db, 'pengaturan_id_spk_grouping', 'config'));
        prefixSpk.value = snap.exists() ? (snap.data().prefix || 'SPK') : 'SPK';
      } catch (e) { console.error('Gagal muat prefix SPK:', e); prefixSpk.value = 'SPK'; }
    }
    async function simpanPrefixSpk() {
      if (!bolehTambah.value) return alert('Anda tidak punya izin mengubah pengaturan ini. Hubungi Owner/PIC.');
      const nilai = prefixSpk.value.trim().toUpperCase();
      if (!nilai) return alert('Isi Prefix Kode SPK dulu (contoh: SPK).');
      menyimpanPrefix.value = true;
      try {
        await setDoc(doc(db, 'pengaturan_id_spk_grouping', 'config'), { prefix: nilai }, { merge: true });
        prefixSpk.value = nilai;
        alert('Prefix Kode SPK tersimpan.');
      } catch (e) { console.error('Gagal simpan prefix SPK:', e); alert('Gagal menyimpan.'); }
      menyimpanPrefix.value = false;
    }

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDocs(collection(db, 'master_tlc'));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.kode || '').localeCompare(b.kode || ''));
        daftar.value = list;
      } catch (e) { console.error('Gagal muat master_tlc:', e); }
      memuat.value = false;
    }

    const daftarTersaring = computed(() => {
      const kata = cari.value.trim().toLowerCase();
      if (!kata) return daftar.value;
      return daftar.value.filter(d => (d.kode || '').toLowerCase().includes(kata) || (d.nama || '').toLowerCase().includes(kata));
    });

    async function tambah() {
      if (!bolehTambah.value) return alert('Anda tidak punya izin menambah di sini. Hubungi Owner/PIC.');
      const kode = form.kode.trim();
      if (!kode) return alert('Kode TLC wajib diisi (mis. TLC-PTG-01).');
      if (daftar.value.some(d => (d.kode || '').toLowerCase() === kode.toLowerCase())) return alert(`Kode TLC "${kode}" sudah ada.`);
      menyimpan.value = true;
      try {
        await addDoc(collection(db, 'master_tlc'), { kode, nama: form.nama.trim(), tipe: form.tipe.trim(), dibuat_pada: serverTimestamp() });
        form.kode = ''; form.nama = ''; form.tipe = '';
        await muat();
      } catch (e) { console.error('Gagal tambah master_tlc:', e); alert('Gagal menyimpan.'); }
      menyimpan.value = false;
    }

    async function hapus(item) {
      if (!bolehHapus.value) return alert('Anda tidak punya izin menghapus di sini. Hubungi Owner/PIC.');
      if (!confirm(`Hapus kode TLC "${item.kode}"? Kode tugas yang SUDAH pernah dicetak memakai kode ini TIDAK ikut berubah.`)) return;
      try { await deleteDoc(doc(db, 'master_tlc', item.id)); await muat(); }
      catch (e) { console.error('Gagal hapus master_tlc:', e); alert('Gagal menghapus.'); }
    }

    onMounted(async () => { await window.authReady; await Promise.all([muat(), muatPrefixSpk()]); });
    return { memuat, daftarTersaring, daftar, cari, form, menyimpan, bolehTambah, bolehHapus, tambah, hapus, prefixSpk, menyimpanPrefix, simpanPrefixSpk };
  },
  template: `
    <div>
      <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">TLC &amp; Prefix</label>
      <p style="font-size:11px; color:var(--text-faint); margin:-4px 0 10px;">Daftar titik TLC (tempat) yang dipakai sebagai asal/tujuan tiap kode tugas — kode-nya sendiri sudah berformat prefix (mis. TLC-PTG-01).</p>

      <div class="gc-card" style="margin-bottom:14px; padding:12px 14px;">
        <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">Prefix Kode SPK</label>
        <p style="font-size:10.5px; color:var(--text-faint); margin:0 0 8px;">Dipakai sebagai awalan kode saat SPK Grouping dibuat (Persiapan Produksi). Contoh hasil: {{ (prefixSpk||'SPK').toUpperCase() }}250905001.</p>
        <div style="display:flex; gap:6px; max-width:280px;">
          <input v-model="prefixSpk" type="text" placeholder="Contoh: SPK" style="flex:1; text-transform:uppercase; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
          <button v-if="bolehTambah" @click="simpanPrefixSpk" :disabled="menyimpanPrefix" class="btn-primary" style="padding:0 16px;">Simpan</button>
        </div>
      </div>

      <div v-if="bolehTambah" style="display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap;">
        <input v-model="form.kode" @keyup.enter="tambah" type="text" placeholder="Kode TLC (mis. TLC-PTG-01)" style="flex:1; min-width:110px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
        <input v-model="form.nama" @keyup.enter="tambah" type="text" placeholder="Nama/Deskripsi (mis. Potong - meja 1)" style="flex:1; min-width:110px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
        <input v-model="form.tipe" @keyup.enter="tambah" type="text" placeholder="Tipe (opsional)" style="flex:1; min-width:110px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
        <button @click="tambah" :disabled="menyimpan" class="btn-primary" style="padding:0 16px;"><i class="fas fa-plus"></i></button>
      </div>
      <div style="position:relative; max-width:280px; margin-bottom:10px;">
        <i class="fas fa-search" style="position:absolute; left:11px; top:9px; color:var(--text-faint); font-size:11px;"></i>
        <input v-model="cari" type="text" placeholder="Cari kode/nama..." style="width:100%; padding:7px 10px 7px 28px; border:1.5px solid var(--line); border-radius:10px; font-size:11.5px; outline:none; box-sizing:border-box;">
      </div>
      <div v-if="memuat" style="font-size:11px; color:var(--text-faint);">Memuat...</div>
      <div v-else class="gc-table-scroll">
        <table class="gc-table">
          <thead><tr><th style="width:48px;">No</th><th>Kode TLC</th><th>Nama/Deskripsi</th><th>Tipe</th><th style="width:70px;">Aksi</th></tr></thead>
          <tbody>
            <tr v-if="daftar.length === 0"><td colspan="5" style="color:var(--text-faint); font-size:11px;">Belum ada data.</td></tr>
            <tr v-else-if="daftarTersaring.length === 0"><td colspan="5" style="color:var(--text-faint); font-size:11px;">Tidak ada yang cocok dicari.</td></tr>
            <tr v-for="(d, i) in daftarTersaring" :key="d.id">
              <td>{{ i + 1 }}</td>
              <td style="font-weight:700;">{{ d.kode }}</td>
              <td>{{ d.nama || '-' }}</td>
              <td>{{ d.tipe || '-' }}</td>
              <td><button v-if="bolehHapus" @click="hapus(d)" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
};

// AppConfigRiwayatPin — BARU (7 Sep 2026). SERAH-TERIMA.md modul ini (§2,
// grup 4 Config) minta "4.1 Riwayat PIN — siapa pakai PIN di menu mana",
// dan §8 (acceptance criteria) minta "PIN dicatat di riwayat (group
// 4.1)". TAPI wireframe.dc.html modul ini TIDAK PUNYA mockup layar untuk
// ini (dicek langsung, nihil), DAN belum ada infrastruktur "verifikasi
// PIN + catat siapa pakai di menu mana" di kode live manapun — PIN
// sekarang cuma dipakai ad-hoc di beberapa tempat (aksi role-gated),
// TIDAK ADA satupun yang menulis ke sebuah log terpusat. Modul umum
// "Scan & PIN" yang akan menulis ke log ini rencananya BARU dibangun
// terpisah nanti — DI LUAR cakupan tugas ini.
//
// Keputusan Guru (7 Sep 2026, ditanya langsung): "Bikin sekarang, tapi
// kosong dulu" — jadi layar ini DIBANGUN SUNGGUHAN sekarang (bukan
// placeholder statis), nyambung ke koleksi Firestore sungguhan, TAPI
// SECARA SAH akan tampil kosong terus sampai modul Scan & PIN itu jadi
// dan mulai menulis ke sini. Ini BUKAN bug, JANGAN "diperbaiki" dengan
// data contoh/fiktif — kosong itu memang keadaan yang benar untuk saat
// ini.
//
// Koleksi `riwayat_pin` — BARU, dicek dulu (grep) TIDAK dipakai di mana
// pun di kode live sebelum ini, aman dipakai. Bentuk field di bawah
// BELUM DIKONFIRMASI (UNCONFIRMED) — tidak ada penulis yang bisa
// dijadikan acuan, ini tebakan terbaik yang forward-compatible dengan
// pola field lain di app ini (mis. `dibuat_pada`/serverTimestamp di
// koleksi log lain seperti wa_log/mail):
//   { uid: string, nama_pengguna: string, menu: string (nama menu/aksi
//     tempat PIN dipakai), berhasil: boolean (verifikasi sukses/gagal),
//     waktu: Timestamp (serverTimestamp saat dicatat) }
// Kalau modul Scan & PIN nanti ternyata pakai nama field beda, tabel ini
// TINGGAL disesuaikan (murni tampilan baca, tidak ada penulis lain yang
// bergantung pada bentuk field ini).
//
// Pola ambil data: SAMA seperti "Riwayat pengiriman" di Monitoring
// WhatsApp Gateway (js/vue-whatsapp-gateway.js, muatMonitoring/
// muatLagiLog) — getDocs+orderBy+limit, tombol "Muat Lagi" manual
// (startAfter), BUKAN usePaginasiFirestore (vue-paginasi.js) karena
// composable itu dipakai utk tabel dgn cari/filter aktif; log kronologis
// polos begini di app ini konsisten pakai pola manual startAfter itu.
// Error Firestore (mis. index belum dibuat) ditangkap & ditampilkan
// dengan pesan yg mengarahkan ke Console browser, pola sama seperti
// vue-bahan-aksesoris.js/vue-hak-akses.js (errorExpand/errorRingkasan).
//
// SENGAJA komponen berdiri sendiri (bukan MasterDataTabelManager) — ini
// layar BACA SAJA (tidak ada tambah/hapus dari sini), beda kebutuhan
// dari master data biasa.
const UKURAN_MUAT_RIWAYAT_PIN = 30;
const AppConfigRiwayatPin = {
  setup() {
    const memuat = ref(true);
    const memuatLagi = ref(false);
    const daftar = ref([]);
    const adaLagi = ref(false);
    const error = ref('');
    let cursorTerakhir = null;

    function pesanError(e) {
      return e && e.code === 'failed-precondition'
        ? 'Perlu index Firestore baru — buka Console browser (F12), cari link "Create composite index" dari error ini, klik untuk bikin index-nya sekali.'
        : (e && e.code === 'permission-denied')
          ? 'Tidak punya izin membaca riwayat PIN. Hubungi Owner/PIC kalau ini tidak seharusnya terjadi.'
          : 'Gagal memuat riwayat PIN. Coba lagi.';
    }

    async function muat() {
      memuat.value = true;
      error.value = '';
      daftar.value = [];
      cursorTerakhir = null;
      adaLagi.value = false;
      try {
        const snap = await getDocs(query(collection(db, 'riwayat_pin'), orderBy('waktu', 'desc'), limit(UKURAN_MUAT_RIWAYAT_PIN)));
        const docs = snap.docs;
        daftar.value = docs.map(d => ({ id: d.id, ...d.data() }));
        if (docs.length > 0) cursorTerakhir = docs[docs.length - 1];
        adaLagi.value = docs.length === UKURAN_MUAT_RIWAYAT_PIN;
      } catch (e) {
        console.error('Gagal muat riwayat_pin:', e);
        error.value = pesanError(e);
      }
      memuat.value = false;
    }

    async function muatLagi() {
      if (!cursorTerakhir || memuatLagi.value) return;
      memuatLagi.value = true;
      try {
        const snap = await getDocs(query(collection(db, 'riwayat_pin'), orderBy('waktu', 'desc'), startAfter(cursorTerakhir), limit(UKURAN_MUAT_RIWAYAT_PIN)));
        const docs = snap.docs;
        daftar.value = [...daftar.value, ...docs.map(d => ({ id: d.id, ...d.data() }))];
        if (docs.length > 0) cursorTerakhir = docs[docs.length - 1];
        adaLagi.value = docs.length === UKURAN_MUAT_RIWAYAT_PIN;
      } catch (e) {
        console.error('Gagal muat riwayat_pin (lanjutan):', e);
        error.value = pesanError(e);
      }
      memuatLagi.value = false;
    }

    function formatWaktu(w) {
      return (w && typeof w.toDate === 'function') ? w.toDate().toLocaleString('id-ID') : '-';
    }

    onMounted(async () => { await window.authReady; await muat(); });
    return { memuat, memuatLagi, daftar, adaLagi, error, muat, muatLagi, formatWaktu };
  },
  template: `
    <div>
      <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Riwayat PIN</label>
      <p style="font-size:11px; color:var(--text-faint); margin:-4px 0 10px;">Catatan siapa memakai PIN, di menu/aksi apa, dan hasil verifikasinya (sukses/gagal) — diurut dari yang terbaru.</p>

      <div v-if="error" style="padding:12px 14px; border-radius:10px; background:var(--danger-light); color:var(--danger); font-size:11.5px; margin-bottom:12px;">
        <i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>{{ error }}
        <button @click="muat" class="btn-outline" style="margin-left:8px; padding:3px 10px; font-size:11px;">Coba lagi</button>
      </div>

      <div v-if="memuat" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;"><i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i>Memuat riwayat PIN...</div>

      <div v-else-if="!error && daftar.length === 0" class="gc-kosong">
        <div class="lingkaran"><i class="fas fa-key"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada riwayat PIN tercatat</h3>
      </div>

      <template v-else-if="!error">
        <div class="gc-table-scroll">
          <table class="gc-table">
            <thead><tr><th style="width:48px;">No</th><th>Waktu</th><th>Nama Pengguna</th><th>Menu</th><th style="width:90px;">Hasil</th></tr></thead>
            <tbody>
              <tr v-for="(d, i) in daftar" :key="d.id">
                <td>{{ i + 1 }}</td>
                <td class="gc-cell-muted" style="white-space:nowrap;">{{ formatWaktu(d.waktu) }}</td>
                <td>{{ d.nama_pengguna || '-' }}</td>
                <td>{{ d.menu || '-' }}</td>
                <td>
                  <span v-if="d.berhasil" class="tag ok">Sukses</span>
                  <span v-else class="tag danger">Gagal</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="adaLagi" style="text-align:center; margin-top:14px;">
          <button @click="muatLagi" :disabled="memuatLagi" class="btn-outline filled">
            <i class="fas" :class="memuatLagi ? 'fa-spinner fa-spin' : 'fa-rotate-right'" style="margin-right:6px;"></i>
            {{ memuatLagi ? 'Memuat...' : 'Muat Lagi (30 berikutnya)' }}
          </button>
        </div>
      </template>
    </div>
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
let vmConfigRiwayatPin = null;

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
window.pastikanMountConfigKomponen = function() {
  if (vmConfigKomponen) return;
  const mountPoint = document.getElementById('vue-config-komponen');
  if (mountPoint) vmConfigKomponen = createApp(AppConfigKomponen).mount('#vue-config-komponen');
};
window.pastikanMountConfigTahapPersiapan = function() {
  if (vmConfigTahapPersiapan) return;
  const mountPoint = document.getElementById('vue-config-tahappersiapan');
  if (mountPoint) vmConfigTahapPersiapan = createApp(AppConfigTahapPersiapan).mount('#vue-config-tahappersiapan');
};
window.pastikanMountConfigTlc = function() {
  if (vmConfigTlc) return;
  const mountPoint = document.getElementById('vue-config-tlc');
  if (mountPoint) vmConfigTlc = createApp(AppConfigTlc).mount('#vue-config-tlc');
};
window.pastikanMountConfigRiwayatPin = function() {
  if (vmConfigRiwayatPin) return;
  const mountPoint = document.getElementById('vue-config-riwayatpin');
  if (mountPoint) vmConfigRiwayatPin = createApp(AppConfigRiwayatPin).mount('#vue-config-riwayatpin');
};
