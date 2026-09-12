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
import { collection, addDoc, doc, deleteDoc, getDoc, getDocs, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { MasterDataCategory, MasterDataTabelManager } from './vue-components.js?v=7';

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

// AppConfigTlc — REDESAIN TOTAL (12 Sep 2026 lanjutan 8, coretan Guru di
// screenshot: hapus kartu "Prefix Kode SPK" + tabel CRUD master_tlc lama,
// "Kode per Divisi" ganti dari form(Group Menu/Sub Menu/dropdown Jalur)
// jadi SATU TABEL — "namun bukan dropdown tapi table"). GANTI dari versi
// lanjutan 6 (form input bebas + dropdown Jalur 4 opsi).
//
// DIHAPUS TOTAL (sesuai coretan, bukan disembunyikan):
//   - Kartu "Prefix Kode SPK" — sudah tidak dipakai kode manapun sejak
//     redesain kode_spk 12 Sep pagi (field lama di pengaturan_id_spk_
//     grouping/config DIBIARKAN apa adanya di Firestore, cuma UI-nya yang
//     hilang — tidak ada migrasi/hapus data).
//   - Tabel CRUD master_tlc terpisah (Kode TLC/Nama-Deskripsi/Tipe/Aksi +
//     form tambahnya) — sekarang entry master_tlc dibuat OTOMATIS lewat
//     kolom "Nama TLC" di tabel baru (jawaban Guru: "dropdown + bisa buat
//     baru sekalian", lihat simpanBaris()).
//   GAP DISENGAJA: karena tabel CRUD lama dihapus, TIDAK ADA LAGI cara
//   hapus/ubah entry master_tlc yang salah ketik dari layar ini — kalau
//   perlu, hapus manual lewat Firestore Console (koleksi master_tlc).
//   Koleksi master_tlc sendiri TIDAK berubah skema ({kode, nama, tipe}) —
//   tetap dipakai 6+ modul lain apa adanya (dropdown "TLC Tujuan" pas
//   kirim tugas: Cutting, Persiapan Bahan/Sewing/Webbing/Finishing/Masalah).
//
// DAFTAR_MENU_DIVISI — jawaban poin Guru "cek repo yg berkaitan dengan
// anak grouping, dan anak separating; semua titik tlc" — digrep LANGSUNG
// dari kode live 12 Sep (bukan ditebak): 4 jalur Persiapan Produksi yang
// SUDAH aktif dipakai kode_anak_spk (bahan/sewing/webbing/finishing,
// lihat tandaiKodeAnakSpk()/ambilPetaKodeTujuanDivisi() js/vue-persiapan-
// produksi-v2.js) + Persiapan Masalah (pakai dropdown master_tlc juga,
// vue-pp-masalah.js) + 5 titik Proses Produksi yang masing-masing punya
// TLC_ASAL hardcode SENDIRI di kodenya (Cutting=TLC-PTG, Serie=TLC-SER,
// Sewing=TLC-JHT, Finishing=TLC-FIN, Gudang Barang Jadi=TLC-GBJ — lihat
// konstanta TLC_ASAL_*/TLC_TUJUAN_* di masing2 js/vue-pp-*.js).
//
// PENTING — baris Proses Produksi (jalur_key 'pp_*') MURNI DATA-ENTRY
// REFERENSI sesi ini: kode hardcode TLC_ASAL_* di vue-pp-cutting/serie/
// sewing/finishing/gudang.js TIDAK diubah (Guru: "guru sambungkan
// sendiri" — nyambungkannya ke tabel ini titik lanjutan berikutnya).
// `ambilPetaKodeTujuanDivisi()` cuma baca key `bahan/sewing/webbing/
// finishing` dari koleksi ini — baris `pp_*`/`masalah` aman diisi kosong
// kapan saja, tidak dipakai generator kode manapun, nol resiko regresi.
//
// Baris CUSTOM di luar 10 titik tetap ini (mis. Vendor) tetap bisa
// ditambah manual lewat form kecil di bawah tabel — jalur_key null, murni
// referensi selamanya, TIDAK pernah dipakai generator.
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

        // Doc id = jalur_key utk 10 baris tetap (deterministik, tidak
        // pernah duplikat) — doc dengan id LAIN dianggap baris custom.
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

    // --- Combobox "Nama TLC" per baris. DropdownCari (vue-components.js)
    // TIDAK dipakai — komponen itu strict-select 1 field string, sedangkan
    // di sini butuh 2 field sekaligus (nama+kode) DAN mode "buat baru
    // kalau belum ada" (jawaban Guru), jadi ditulis sendiri, pola SAMA
    // (kotak ketik+filter+panel saran) seperti DropdownCari. ---
    function saranTlc(row) {
      const kata = (row.kataCari || '').trim().toLowerCase();
      if (!kata) return daftarTlc.value;
      return daftarTlc.value.filter(t => (t.nama || '').toLowerCase().includes(kata) || (t.kode || '').toLowerCase().includes(kata));
    }
    function bukaCari(row) { row.kataCari = ''; row.cariTerbuka = true; }
    function tutupCariTunda(row) {
      // @mousedown.prevent di opsi (pilihTlc) membuat cariTerbuka sudah
      // false SEBELUM timeout ini jalan — kalau begitu, jangan timpa lagi
      // (kataCari sudah dikosongkan pilihTlc). Kalau masih terbuka (user
      // blur tanpa klik saran), commit teks yang diketik jadi Nama TLC
      // baru supaya tidak hilang diam-diam (dukung alur "ketik nama baru").
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
      // Baca langsung dari kataCari kalau combobox masih terbuka saat
      // tombol Simpan diklik (blur belum sempat commit, lihat tutupCariTunda).
      const namaTlc = (row.cariTerbuka ? row.kataCari : row.namaTlc).trim();
      const tlcTujuan = row.tlcTujuan.trim().toUpperCase();
      const kodeTujuan = row.kodeTujuan.trim();
      if (kodeTujuan && !/^\d{1,2}$/.test(kodeTujuan)) return alert('Kode Tujuan wajib angka, maks 2 digit (mis. 12).');
      const kodeTujuanRapi = kodeTujuan ? kodeTujuan.padStart(2, '0') : '';
      if ((namaTlc && !tlcTujuan) || (!namaTlc && tlcTujuan)) return alert('Nama TLC dan TLC Tujuan wajib diisi berdua, atau dikosongkan berdua.');
      row.menyimpan = true;
      try {
        // Buat entry master_tlc baru OTOMATIS kalau kode-nya belum ada di
        // daftar (jawaban Guru: "dropdown + bisa buat baru sekalian").
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

    // --- Baris custom di luar 10 titik tetap (mis. Vendor) ---
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
    return {
      memuat, baris, bolehTambah, bolehHapus,
      saranTlc, bukaCari, tutupCariTunda, pilihTlc, simpanBaris,
      formCustom, menyimpanCustom, tambahCustom, hapusCustom
    };
  },
  template: `
    <div>
      <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">TLC &amp; Prefix</label>
      <p style="font-size:11px; color:var(--text-faint); margin:-4px 0 10px;">1 baris = 1 titik/menu yang punya kode tugas sendiri. <b>Nama TLC</b> = cari &amp; pilih titik TLC yang sudah ada, atau ketik nama baru (otomatis dibuatkan entry-nya). <b>TLC Tujuan</b> = kode TLC-nya, muncul di label cetak (di bawahnya diikuti kode tugas). <b>Kode Tujuan</b> (2 digit) dipakai gabung ke kode SPK Grouping utk label+query scan QR (mis. kode_spk <code>G26R0912P001</code> + kode tujuan <code>12</code> + urutan baris &rarr; <code>G26R0912P001-1201</code>) — <b>cuma benar-benar dipakai generator</b> utk 4 baris "Persiapan Produksi" teratas (tanda hijau); baris lain aman diisi/dikosongkan sebagai referensi dulu.</p>

      <div v-if="memuat" style="font-size:11px; color:var(--text-faint);">Memuat...</div>
      <div v-else class="gc-table-scroll">
        <table class="gc-table">
          <thead><tr><th>Nama Menu/Divisi</th><th style="min-width:170px;">Nama TLC</th><th style="width:130px;">TLC Tujuan</th><th style="width:90px;">Kode Tujuan</th><th style="width:90px;">Aksi</th></tr></thead>
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

// AppConfigRiwayatPin — DIPINDAH (7 Sep 2026 malam) ke Scan & Cetak > PIN,
// lihat AppScanCetakRiwayatPin di js/vue-scan-cetak.js (kode identik, cuma
// nama komponen/mount point berubah). Ini konsisten dengan wireframe "05 -
// Scan dan Cetak" §4.1 (Riwayat PIN memang bagian grup PIN, bukan Config) —
// keputusan Guru saat membangun menu itu. Blok komponen lama DIHAPUS dari
// sini, bukan cuma dikomentari, supaya tidak ada 2 salinan kode yang bisa
// menyimpang.

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
