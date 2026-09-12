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
// Kode per Divisi — GANTI TOTAL (12 Sep 2026 lanjutan 6, laporan Guru poin
// 4: "saya mulai kebingungan... harusnya kamu sudah menampilkan semua menu
// perdivisi yg bisa di edit nama tujuan, tlc tujuan, kode tujuan"). GANTI
// dari "Prefix per Menu/Divisi" LAMA (10 Sep, cuma 2 field nama+kode,
// TIDAK tersambung kemana-mana) — koleksi Firestore TETAP `master_prefix_
// divisi` (Rules-nya SUDAH disiapkan Guru per Blocker #3 STATUS-PROYEK.md,
// ganti nama koleksi akan mubazirkan itu), TAPI skema dokumennya diperluas
// dari `{divisi, kode}` jadi `{group_menu, sub_menu, jalur_key, nama_
// tujuan, tlc_tujuan, kode_tujuan}` — AMAN, koleksi lama kosong (0 dokumen
// per screenshot Guru), tidak ada migrasi data.
//
// 3 field yang diminta Guru:
//   - nama_tujuan & tlc_tujuan — teks bebas, tampil di dropdown+cetak biar
//     gampang dibaca operator (BELUM ada dropdown yang baca 2 field ini,
//     ini data-entry dulu — sama seperti master_tlc dulu sebelum dipakai).
//   - kode_tujuan — 2 digit penomoran, inilah yang JOIN ke kode_spk
//     grouping (lihat generateKodeAnakSpk() di js/vue-persiapan-produksi-
//     v2.js, BARU 12 Sep lanjutan 6): `${kode_spk}-${kode_tujuan}${counter}`.
//
// `jalur_key` — BARU, field TEKNIS (bukan diminta eksplisit oleh Guru,
// tapi WAJIB ada supaya kode di atas tahu baris mana yang jadi sumber
// kode_tujuan buat jalur 'bahan'/'sewing'/'webbing'/'finishing'). Guru
// bisa isi baris utk divisi yang belum sempat disambungkan ke kode (mis.
// Vendor) dengan jalur_key kosong "(hanya referensi)" — baris itu tetap
// tampil di tabel tapi tidak dipakai generator kode manapun.
//
// Group Menu/Sub Menu — 2 kolom LABEL BEBAS (Guru isi sendiri sesuai
// struktur menu app, mis. "Persiapan Produksi" / "Bahan") — SENGAJA tidak
// di-hardcode dari daftar menu app (menu bisa berubah), juga SENGAJA tidak
// di-seed dari tabel referensi 18 pos (arsip 10 Sep lanjutan 9) — Guru
// yang isi sendiri (keputusan Guru via AskUserQuestion, 12 Sep lanjutan 6).
//
// GAP YANG SENGAJA DIBIARKAN: baris (group_menu/sub_menu/jalur_key) masih
// harus ditambah MANUAL satu-satu lewat form di bawah — belum ada tombol
// "isi semua divisi sekaligus". Kalau nanti Guru mau semua divisi produksi
// langsung ada barisnya, tinggal minta di-seed dari tabel 18 pos itu.
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

    // Kode per Divisi (lihat catatan besar di atas komponen ini). Koleksi
    // TETAP master_prefix_divisi, skema BARU 6 field.
    const JALUR_OPSI = [
      { value: '', label: '(hanya referensi, belum disambung kode)' },
      { value: 'bahan', label: 'Persiapan Bahan' },
      { value: 'sewing', label: 'Persiapan Acc Sewing' },
      { value: 'webbing', label: 'Persiapan Acc Webbing' },
      { value: 'finishing', label: 'Persiapan Acc Finishing' }
    ];
    function labelJalur(key) { return (JALUR_OPSI.find(j => j.value === key) || {}).label || '-'; }
    const daftarPrefixDivisi = ref([]);
    const formPrefixDivisi = reactive({ group_menu: '', sub_menu: '', jalur_key: '', nama_tujuan: '', tlc_tujuan: '', kode_tujuan: '' });
    const menyimpanPrefixDivisi = ref(false);
    const editIdPrefixDivisi = ref(null);
    async function muatPrefixDivisi() {
      try {
        const snap = await getDocs(collection(db, 'master_prefix_divisi'));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.group_menu || '').localeCompare(b.group_menu || '') || (a.sub_menu || '').localeCompare(b.sub_menu || ''));
        daftarPrefixDivisi.value = list;
      } catch (e) { console.error('Gagal muat master_prefix_divisi:', e); }
    }
    function batalEditPrefixDivisi() {
      editIdPrefixDivisi.value = null;
      formPrefixDivisi.group_menu = ''; formPrefixDivisi.sub_menu = ''; formPrefixDivisi.jalur_key = '';
      formPrefixDivisi.nama_tujuan = ''; formPrefixDivisi.tlc_tujuan = ''; formPrefixDivisi.kode_tujuan = '';
    }
    function bukaEditPrefixDivisi(item) {
      editIdPrefixDivisi.value = item.id;
      formPrefixDivisi.group_menu = item.group_menu || ''; formPrefixDivisi.sub_menu = item.sub_menu || '';
      formPrefixDivisi.jalur_key = item.jalur_key || ''; formPrefixDivisi.nama_tujuan = item.nama_tujuan || '';
      formPrefixDivisi.tlc_tujuan = item.tlc_tujuan || ''; formPrefixDivisi.kode_tujuan = item.kode_tujuan || '';
    }
    async function simpanPrefixDivisi() {
      if (!bolehTambah.value) return alert('Anda tidak punya izin menambah/mengubah di sini. Hubungi Owner/PIC.');
      const groupMenu = formPrefixDivisi.group_menu.trim();
      const subMenu = formPrefixDivisi.sub_menu.trim();
      if (!groupMenu) return alert('Isi Group Menu dulu (mis. Persiapan Produksi).');
      if (!subMenu) return alert('Isi Sub Menu dulu (mis. Bahan).');
      const kodeTujuan = formPrefixDivisi.kode_tujuan.trim();
      if (kodeTujuan && !/^\d{1,2}$/.test(kodeTujuan)) return alert('Kode Tujuan wajib angka, maks 2 digit (mis. 12).');
      const kodeTujuanRapi = kodeTujuan ? kodeTujuan.padStart(2, '0') : '';
      const jalurKey = formPrefixDivisi.jalur_key;
      const dup = daftarPrefixDivisi.value.find(d => jalurKey && d.jalur_key === jalurKey && d.id !== editIdPrefixDivisi.value);
      if (dup) return alert(`Jalur "${labelJalur(jalurKey)}" sudah dipakai baris "${dup.sub_menu}". Satu jalur cuma boleh 1 baris aktif (kosongkan jalur baris lama dulu kalau mau pindah).`);
      menyimpanPrefixDivisi.value = true;
      try {
        const data = {
          group_menu: groupMenu, sub_menu: subMenu, jalur_key: jalurKey,
          nama_tujuan: formPrefixDivisi.nama_tujuan.trim(), tlc_tujuan: formPrefixDivisi.tlc_tujuan.trim().toUpperCase(),
          kode_tujuan: kodeTujuanRapi
        };
        if (editIdPrefixDivisi.value) {
          await setDoc(doc(db, 'master_prefix_divisi', editIdPrefixDivisi.value), data, { merge: true });
        } else {
          await addDoc(collection(db, 'master_prefix_divisi'), { ...data, dibuat_pada: serverTimestamp() });
        }
        batalEditPrefixDivisi();
        await muatPrefixDivisi();
      } catch (e) {
        console.error('Gagal simpan master_prefix_divisi:', e);
        // Dugaan kuat kalau errornya permission-denied: Rules Firestore utk
        // master_prefix_divisi belum di-publish (lihat FONDASI.md).
        alert('Gagal menyimpan: ' + (e.code || e.message || e) + '\n\nKalau kodenya "permission-denied": Rules Firestore untuk master_prefix_divisi kemungkinan belum di-publish di Firebase Console.');
      }
      menyimpanPrefixDivisi.value = false;
    }
    async function hapusPrefixDivisi(item) {
      if (!bolehHapus.value) return alert('Anda tidak punya izin menghapus di sini. Hubungi Owner/PIC.');
      if (!confirm(`Hapus baris "${item.group_menu} > ${item.sub_menu}"?`)) return;
      try { await deleteDoc(doc(db, 'master_prefix_divisi', item.id)); if (editIdPrefixDivisi.value === item.id) batalEditPrefixDivisi(); await muatPrefixDivisi(); }
      catch (e) { console.error('Gagal hapus master_prefix_divisi:', e); alert('Gagal menghapus.'); }
    }

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

    onMounted(async () => { await window.authReady; await Promise.all([muat(), muatPrefixSpk(), muatPrefixDivisi()]); });
    return {
      memuat, daftarTersaring, daftar, cari, form, menyimpan, bolehTambah, bolehHapus, tambah, hapus,
      prefixSpk, menyimpanPrefix, simpanPrefixSpk,
      JALUR_OPSI, labelJalur, daftarPrefixDivisi, formPrefixDivisi, menyimpanPrefixDivisi, editIdPrefixDivisi,
      simpanPrefixDivisi, hapusPrefixDivisi, bukaEditPrefixDivisi, batalEditPrefixDivisi
    };
  },
  template: `
    <div>
      <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">TLC &amp; Prefix</label>
      <p style="font-size:11px; color:var(--text-faint); margin:-4px 0 10px;">Daftar titik TLC (tempat) yang dipakai sebagai asal/tujuan tiap kode tugas — kode-nya sendiri sudah berformat prefix (mis. TLC-PTG-01).</p>

      <div class="gc-card" style="margin-bottom:14px; padding:12px 14px;">
        <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">Prefix Kode SPK <span class="tag warn" style="font-weight:700; margin-left:4px;">tidak dipakai lagi</span></label>
        <p style="font-size:10.5px; color:var(--text-faint); margin:0 0 8px;">Sejak redesain 12 Sep 2026, format kode SPK Grouping SUDAH TETAP <code>G{{'{'}}YY{{'}'}}R{{'{'}}MMDD{{'}'}}P{{'{'}}counter{{'}'}}</code> (contoh: G26R0912P001) — field prefix di bawah ini TIDAK dibaca kode manapun lagi. Dibiarkan tampil (bukan dihapus) supaya nilai lama tidak hilang diam-diam; aman diabaikan.</p>
        <div style="display:flex; gap:6px; max-width:280px;">
          <input v-model="prefixSpk" type="text" placeholder="Contoh: SPK" style="flex:1; text-transform:uppercase; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
          <button v-if="bolehTambah" @click="simpanPrefixSpk" :disabled="menyimpanPrefix" class="btn-primary" style="padding:0 16px;">Simpan</button>
        </div>
      </div>

      <div class="gc-card" style="margin-bottom:14px; padding:12px 14px;">
        <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">Kode per Divisi (nama tujuan · TLC tujuan · kode tujuan)</label>
        <p style="font-size:10.5px; color:var(--text-faint); margin:0 0 8px;">1 baris = 1 menu/divisi. <b>Nama Tujuan</b> &amp; <b>TLC Tujuan</b> = teks bebas, buat dropdown &amp; cetak biar gampang dibaca operator. <b>Kode Tujuan</b> (2 digit) = penomoran yang JOIN ke kode SPK Grouping (mis. kode_spk <code>G26R0912P001</code> + kode tujuan <code>12</code> + urutan baris &rarr; <code>G26R0912P001-1201</code>). Pilih <b>Jalur</b> kalau baris ini mau otomatis dipakai kode anak SPK di Persiapan Bahan/Acc Sewing/Webbing/Finishing — kosongkan kalau sekadar catatan.</p>
        <div v-if="bolehTambah" style="display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap;">
          <input v-model="formPrefixDivisi.group_menu" type="text" placeholder="Group Menu (mis. Persiapan Produksi)" style="flex:1; min-width:150px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
          <input v-model="formPrefixDivisi.sub_menu" type="text" placeholder="Sub Menu (mis. Bahan)" style="flex:1; min-width:120px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
          <select v-model="formPrefixDivisi.jalur_key" style="min-width:150px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
            <option v-for="j in JALUR_OPSI" :key="j.value" :value="j.value">{{ j.label }}</option>
          </select>
          <input v-model="formPrefixDivisi.nama_tujuan" type="text" placeholder="Nama Tujuan" style="flex:1; min-width:120px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
          <input v-model="formPrefixDivisi.tlc_tujuan" type="text" maxlength="10" placeholder="TLC Tujuan (mis. PBI)" style="width:130px; text-transform:uppercase; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
          <input v-model="formPrefixDivisi.kode_tujuan" type="text" maxlength="2" placeholder="Kode (mis. 12)" style="width:90px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
          <button @click="simpanPrefixDivisi" :disabled="menyimpanPrefixDivisi" class="btn-primary" style="padding:0 16px;">{{ editIdPrefixDivisi ? 'Simpan' : 'Tambah' }}</button>
          <button v-if="editIdPrefixDivisi" @click="batalEditPrefixDivisi" class="btn-outline" style="padding:0 14px;">Batal</button>
        </div>
        <div v-if="daftarPrefixDivisi.length === 0" style="font-size:11px; color:var(--text-faint);">Belum ada baris divisi terdaftar.</div>
        <div v-else class="gc-table-scroll">
          <table class="gc-table">
            <thead><tr><th>Group Menu</th><th>Sub Menu</th><th>Jalur</th><th>Nama Tujuan</th><th>TLC Tujuan</th><th>Kode</th><th style="width:70px;">Aksi</th></tr></thead>
            <tbody>
              <tr v-for="d in daftarPrefixDivisi" :key="d.id">
                <td>{{ d.group_menu }}</td>
                <td>{{ d.sub_menu }}</td>
                <td><span v-if="d.jalur_key" class="tag ok">{{ labelJalur(d.jalur_key) }}</span><span v-else style="color:var(--text-faint);">-</span></td>
                <td>{{ d.nama_tujuan || '-' }}</td>
                <td>{{ d.tlc_tujuan || '-' }}</td>
                <td style="font-weight:700;">{{ d.kode_tujuan || '-' }}</td>
                <td style="white-space:nowrap;">
                  <button @click="bukaEditPrefixDivisi(d)" class="icon-btn" title="Ubah"><i class="fas fa-pen"></i></button>
                  <button v-if="bolehHapus" @click="hapusPrefixDivisi(d)" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
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
        <input v-model="cari" type="text" placeholder="Cari kode/nama..." style="width:100%; padding:7px 10px 7px 28px; background:var(--ivory-dim); border:1.5px solid var(--line); border-radius:10px; font-size:11.5px; outline:none; box-sizing:border-box;">
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
