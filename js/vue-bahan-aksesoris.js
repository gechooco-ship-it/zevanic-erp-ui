// js/vue-bahan-aksesoris.js
// ============================================================================
// Zevanic House > Master Bahan & Aksesoris — fitur BARU (23 Agt 2026, awal
// pembangunan modul Konveksi). 2 menu di dalamnya:
//   1. "Bahan / Aksesoris" (BahanAksesorisEntryManager) — form entry data.
//   2. "List Bahan / Aksesoris" (BahanAksesorisListManager) — tabel paginasi
//      + edit + hapus.
//
// KEPUTUSAN DESAIN yang sudah dikonfirmasi Hilman (AskUserQuestion,
// 23 Agt 2026) — lihat STATUS-PROYEK.md §20 untuk detail lengkap:
//   1. Harga Modal & Harga Pemakaian DIHITUNG OTOMATIS (readonly), BUKAN
//      diisi manual — cuma Harga Pembelian, Isi Konversi Pembelian, dan
//      Margin Modal yang diisi manual.
//        Harga Modal     = Harga Pembelian / Isi Konversi Pembelian
//        Harga Pemakaian = Harga Modal + Margin Modal   (Margin = NOMINAL
//        Rupiah, BUKAN persen — asumsi ini, konfirmasi ke Hilman terpisah)
//   2. Popup konversi berjenjang (Dus > Pack > Pcs, dst) DISIMPAN PERMANEN
//      sebagai array `konversi_bertingkat` di dokumen, bukan cuma kalkulator
//      sekali pakai.
//   3. ID Bahan/Aksesoris SEQUENTIAL (bukan acak seperti idAcak() di
//      vue-registrasi.js) — prefix terpisah per kategori (Bahan/Aksesoris),
//      diatur lewat panel Pengaturan (ikon gear di menu Entry), counter
//      naik otomatis pakai runTransaction() (koleksi baru
//      `pengaturan_id_bahan_aksesoris`, BUKAN numpang di koleksi `config`
//      yang di firestore.rules cuma boleh ditulis Owner/Superuser — di
//      sini level admin ke atas WAJIB bisa atur & pakai).
//   4. Menu baru "Zevanic House" di sidebar, admin ke atas (isAdminLevel()
//      — pic/admin/owner/superuser), sejajar Master Absensi/Keuangan/
//      Karyawan/Integrasi.
//
// ASUMSI TAMBAHAN (belum eksplisit ditanyakan ke Hilman, level risiko
// rendah/gampang diubah — lihat catatan di STATUS-PROYEK.md §20):
//   - Field "Jenis Bahan / Aksesoris" (wajib) diimplementasi sebagai daftar
//     master data yang bisa diedit admin (pakai MasterDataCategory yang
//     SUDAH ADA di vue-components.js, pola sama seperti Jenis Pekerjaan/
//     Jabatan/dst) — TAPI dipisah jadi 2 kategori master_data berbeda:
//     'jenis_bahan' dan 'jenis_aksesoris', dipilih otomatis sesuai field
//     baru "Kategori Utama" (Bahan/Aksesoris) di bawah.
//   - Field "Kategori Utama" (Bahan / Aksesoris) BARU, TIDAK ADA di daftar
//     13 field asli permintaan Hilman — ditambahkan karena SECARA STRUKTUR
//     wajib ada: field ini yang menentukan prefix ID mana dipakai (poin 3
//     di atas) dan kategori Jenis mana yang muncul di dropdown (poin di
//     atas), juga dipakai buat filter di List.
//   - Satuan Pembelian & Satuan Pemakaian sengaja dibuat TEKS BEBAS (bukan
//     dropdown master data) — satuan konveksi terlalu beragam (meter, yard,
//     roll, kg, dus, pack, pcs, dst), teks bebas lebih fleksibel di tahap
//     awal ini.
//
// UPDATE (25 Agt 2026) — Rak Penyimpanan & Volume Barang, sesuai keputusan
// Hilman (AskUserQuestion 3 pertanyaan):
//   1. Kode Rak/Baris Rak/Kolom Rak = "Master Data Rak terkelola" (BUKAN
//      teks bebas). ASUMSI ARSITEKTUR (belum eksplisit ditanyakan, level
//      risiko rendah — gampang diubah nanti): diimplementasi sebagai 3
//      kategori master_data TERPISAH ('kode_rak', 'baris_rak', 'kolom_rak'),
//      masing-masing pakai MasterDataCategory yang sudah ada (persis pola
//      jenis_bahan/jenis_aksesoris) — BUKAN 1 record gabungan per kombinasi
//      rak (ditolak: kombinasi Kode x Baris x Kolom bisa sangat banyak di
//      gudang nyata, "1 record per kombinasi persis" tidak praktis untuk
//      dikelola). Dampak: 3 dropdown ini SAMA untuk kategori Bahan maupun
//      Aksesoris (tidak dipisah kategori_utama seperti Jenis) — rak gudang
//      dianggap 1 sistem penomoran bersama, bukan spesifik per Bahan/
//      Aksesoris. Kalau ternyata Hilman mau per-kombinasi (misal validasi
//      "kombinasi X-Y-Z sudah dipakai barang lain") atau mau dipisah per
//      kategori, kabari untuk diubah.
//   2. Tinggi/Panjang/Lebar = dimensi 1 SATUAN BARANG itu sendiri (bukan
//      dimensi fisik raknya, walau tujuan akhirnya buat hitung kapasitas
//      rak) — Volume = Tinggi x Panjang x Lebar, dihitung otomatis (pola
//      sama seperti Harga Modal/Harga Pemakaian, computed client-side lalu
//      ditulis sebagai field biasa saat simpan, BUKAN dihitung Firestore).
//   3. Ronde ini CUMA simpan & tampilkan Volume — TIDAK ada logic
//      peringatan overstok. Peringatan overstok direncanakan MENYUSUL,
//      munculnya nanti di menu List Order Belanja & Nota Order Belanja
//      (vue-stock-pembelian.js), BELUM dikerjakan di sini.
//
// UPDATE (25 Agt 2026, §25.2) — Qty per Roll/Lot (arahan Hilman: "untuk qty
// per lot bantu jalankan (fifo nanti saja) ... tombol aktif jika dia memang
// menurut data wajib entry qty per lot"). Field BARU `pakai_lot_tracking`
// (boolean, opsional/opt-in per item, default false) ditambahkan di sini —
// dipakai SEMATA-MATA sebagai FLAG PENANDA di js/vue-stock-pembelian.js
// (Daftar Pesanan Pembelian) untuk mengaktifkan/nonaktifkan tombol popup
// "Qty per Roll/Lot" di kolom paling kiri tabel itu. TIDAK ADA logic
// FIFO/pengurangan stok per-lot di ronde ini (SENGAJA ditunda sesuai
// arahan Guru) — lihat catatan lengkap di vue-stock-pembelian.js &
// STATUS-PROYEK.md §25.2.
//
// UPDATE (25 Agt 2026, §25) — Rak Penyimpanan DIROMBAK jadi menu tersendiri
// (`js/vue-rak-penyimpanan.js`, koleksi `master_rak_penyimpanan`), atas
// permintaan Hilman: "Kode Rak Penyimpanan mending dibuat Menu di data
// bahan & aksesoris ... estimasi kapasitas rak volumenya brpa". Field
// `kode_rak`/`baris_rak`/`kolom_rak` LEPAS di poin 1 di atas (25 Agt,
// ronde pertama) DIGANTI jadi `rak_id` (ref ke 1 record spesifik di
// `master_rak_penyimpanan`) + `rak_label` (denormalisasi, mis. "A-1-3") —
// dikonfirmasi Hilman lewat AskUserQuestion ("1 dropdown pilih Rak
// terdaftar", bukan 3 dropdown lepas lagi). AMAN diganti langsung (bukan
// migrasi) karena field lama belum sempat dipakai data nyata sama sekali.
// 3 kategori master_data (`kode_rak`/`baris_rak`/`kolom_rak`) TETAP
// dipertahankan (masih dipakai di panel Pengaturan di bawah) — sekarang
// fungsinya jadi "bahan baku" isian saat BIKIN record Rak baru di menu
// Rak Penyimpanan, BUKAN dipilih langsung di sini lagi.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDoc, getDocs, setDoc, serverTimestamp, runTransaction, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
// MasterDataCategory/MasterDataTabelManager TIDAK diimpor lagi di sini
// (27 Agt 2026, §26.1) — panel Pengaturan yang dulu pakai keduanya (Jenis
// Bahan/Aksesoris, Data Satuan/Warna/Ukuran, Data Rak Penyimpanan) sudah
// dirombak, lihat catatan di atas PengaturanBahanAksesoris di bawah.
import { DropdownCari, PopupPratinjauCetakLabel } from './vue-components.js?v=5';
import { usePaginasiFirestore } from './vue-paginasi.js';
// BARU (28 Agt 2026, §41.2, permintaan Guru: "cetak label pindahkan ke
// Data Bahan & Aksesoris > List Bahan dan Aksesoris") — `ambilSemuaLotByBahan`
// dan `catatLogCetakLabel` DULU privat di `CetakLabelManager`
// (js/vue-stock-pembelian.js, menu "Cetak Label" tersendiri di Stock &
// Pembelian, SEKARANG DIHAPUS). Koleksi `lot_bahan_aksesoris` &
// `log_cetak_label` TETAP "dimiliki" vue-stock-pembelian.js (sudah ada
// beberapa fungsi lot lain yang diimpor lintas file dari sana, pola sama
// seperti vue-kartu-stok.js/vue-scan-opname.js/vue-scan-persiapan.js) —
// cuma 2 fungsi INI yang sekarang jadi export supaya bisa dipakai di sini.
import { ambilSemuaLotByBahan, catatLogCetakLabel } from './vue-stock-pembelian.js';

const KATEGORI_UTAMA_OPSI = ['Bahan', 'Aksesoris'];

function kategoriMasterData(kategoriUtama) {
  return kategoriUtama === 'Aksesoris' ? 'jenis_aksesoris' : 'jenis_bahan';
}
function kunciPengaturanId(kategoriUtama) {
  return kategoriUtama === 'Aksesoris' ? 'aksesoris' : 'bahan';
}

// ambilDaftarNama — BARU (23 Agt 2026), dipakai buat isi opsi DropdownCari
// (Warna, Satuan Pembelian, Satuan Pemakaian) dari koleksi MasterDataTabelManager
// (master_satuan/master_warna, lihat vue-components.js) — beda dari
// window.ambilMasterList (dashboard.js) yang bacanya dari 1 dokumen
// `master_data/{kategori}` berisi array, koleksi ini 1 dokumen per item.
async function ambilDaftarNama(koleksi) {
  try {
    const snap = await getDocs(collection(db, koleksi));
    const list = [];
    snap.forEach(d => { if (d.data().nama) list.push(d.data().nama); });
    list.sort((a, b) => a.localeCompare(b));
    return list;
  } catch (e) {
    console.error(`Gagal ambil daftar ${koleksi}:`, e);
    return [];
  }
}

// ambilDaftarRak — BARU (25 Agt 2026, §25). Ambil SEMUA record dari menu
// baru "Rak Penyimpanan" (`master_rak_penyimpanan`, js/vue-rak-penyimpanan.js)
// buat jadi opsi dropdown "Pilih Rak" di sini — pola sama seperti
// ambilDaftarNama() di atas (fetch semua, TANPA paginasi — ini buat
// SUMBER dropdown, bukan tabel browsing, jumlah rak realistis kecil,
// konsisten dengan opsiSatuan/opsiWarna).
async function ambilDaftarRak() {
  try {
    const snap = await getDocs(collection(db, 'master_rak_penyimpanan'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.rak_label || '').localeCompare(b.rak_label || ''));
    return list;
  } catch (e) {
    console.error('Gagal ambil daftar Rak Penyimpanan:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Import/Export Excel (BARU 28 Agt 2026, §35, permintaan Guru: "tambah
// fitur import di list bahan dan aksesoris... upload massal beserta
// templetnya"). Pola & helper DISALIN dari js/vue-master-produk.js §28.9
// (bukan diimpor silang — konsisten konvensi proyek ini), disesuaikan buat
// skema Bahan & Aksesoris. Keputusan cakupan (2 ronde AskUserQuestion,
// lihat STATUS-PROYEK.md §35):
//   1. Template CUMA field WAJIB (Kategori Utama, Jenis, Nama, Warna, Harga
//      Pembelian, Satuan Pembelian, Isi Konversi Pembelian, Satuan
//      Pemakaian, Margin Modal) — Rak Penyimpanan, Volume Barang (Tinggi/
//      Panjang/Lebar), flag "Perlu Qty per Roll/Lot", dan Foto TIDAK ikut,
//      diisi menyusul manual lewat Edit kalau perlu.
//   2. Baris yang kombinasi Kategori Utama+Nama+Warna-nya SUDAH ADA di data
//      tersimpan DILEWATI (skip) — TIDAK ditimpa/diupdate sama sekali,
//      beda dari pola "Ganti Total" di Import Produk Utama (Master Produk).
//      Import Bahan & Aksesoris ini MURNI nambah data baru saja.
// ---------------------------------------------------------------------------

// jarakLevenshtein/cariSaranTerdekat/validasiPilihan — jarak edit standar
// buat saran "maksud Anda...?" di popup verifikasi import. TIDAK ada pola
// sejenis sebelumnya di file ini — disalin persis dari vue-master-produk.js.
function jarakLevenshtein(a, b) {
  a = (a || '').toLowerCase(); b = (b || '').toLowerCase();
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const baris = new Array(n + 1);
  for (let j = 0; j <= n; j++) baris[j] = j;
  for (let i = 1; i <= m; i++) {
    let diagAtas = baris[0];
    baris[0] = i;
    for (let j = 1; j <= n; j++) {
      const simpan = baris[j];
      baris[j] = a[i - 1] === b[j - 1] ? diagAtas : 1 + Math.min(diagAtas, baris[j], baris[j - 1]);
      diagAtas = simpan;
    }
  }
  return baris[n];
}
function cariSaranTerdekat(teks, daftarOpsi) {
  if (!teks || !daftarOpsi || !daftarOpsi.length) return '';
  let terbaik = '', jarakTerbaik = Infinity;
  for (const opsi of daftarOpsi) {
    const j = jarakLevenshtein(teks, opsi);
    if (j < jarakTerbaik) { jarakTerbaik = j; terbaik = opsi; }
  }
  const ambang = Math.max(2, Math.ceil(teks.length / 2));
  return jarakTerbaik <= ambang ? terbaik : '';
}
function validasiPilihan(nilaiAsli, daftarOpsi) {
  const teks = (nilaiAsli || '').trim();
  if (!teks) return { valid: false, nilai: '', saran: '' };
  const cocok = (daftarOpsi || []).find(o => o.toLowerCase() === teks.toLowerCase());
  if (cocok) return { valid: true, nilai: cocok, saran: '' };
  return { valid: false, nilai: teks, saran: cariSaranTerdekat(teks, daftarOpsi) };
}

// bacaFileExcel/ambilSheet/unduhWorkbook — pakai XLSX global dari
// index.html (SheetJS), sama seperti vue-master-produk.js.
function bacaFileExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try { resolve(XLSX.read(new Uint8Array(e.target.result), { type: 'array' })); }
      catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
function ambilSheet(workbook, namaSheet) {
  const sheet = workbook.Sheets[namaSheet];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}
function unduhWorkbook(sheets, namaFile) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.baris, { header: s.header });
    XLSX.utils.book_append_sheet(wb, ws, s.nama);
  }
  XLSX.writeFile(wb, namaFile);
}

// ambilSemuaBahanAksesoris — ambil SEMUA dokumen master_bahan_aksesoris
// (bukan 1 halaman paginasi) — dipakai buat cek Kategori+Nama+Warna dobel
// dalam file & cek data yang mau di-skip karena sudah ada.
async function ambilSemuaBahanAksesoris() {
  try {
    const snap = await getDocs(collection(db, 'master_bahan_aksesoris'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
  } catch (e) {
    console.error('Gagal ambil semua Bahan & Aksesoris:', e);
    return [];
  }
}

// kunciBahanAksesoris — kunci identitas dipakai buat cocokkan baris Excel
// ke data yang sudah ada (Kategori Utama + Nama + Warna, dikonfirmasi Guru
// lewat AskUserQuestion, §35).
function kunciBahanAksesoris(kategori, nama, warna) {
  return [kategori, nama, warna].map(v => (v || '').toString().trim().toLowerCase()).join('||');
}

const HEADER_BAHAN_AKSESORIS = ['Kategori Utama', 'Jenis', 'Nama', 'Warna', 'Harga Pembelian', 'Satuan Pembelian', 'Isi Konversi Pembelian', 'Satuan Pemakaian', 'Margin Modal'];

function unduhTemplateBahanAksesoris() {
  const contohBahan = { 'Kategori Utama': 'Bahan', 'Jenis': 'Kain', 'Nama': 'Katun Combed 30s', 'Warna': 'Putih', 'Harga Pembelian': 1000000, 'Satuan Pembelian': 'Roll', 'Isi Konversi Pembelian': 50, 'Satuan Pemakaian': 'Meter', 'Margin Modal': 500 };
  const contohAksesoris = { 'Kategori Utama': 'Aksesoris', 'Jenis': 'Resleting', 'Nama': 'Resleting YKK', 'Warna': 'Hitam', 'Harga Pembelian': 50000, 'Satuan Pembelian': 'Pack', 'Isi Konversi Pembelian': 12, 'Satuan Pemakaian': 'Pcs', 'Margin Modal': 200 };
  unduhWorkbook([{ nama: 'Bahan & Aksesoris', header: HEADER_BAHAN_AKSESORIS, baris: [contohBahan, contohAksesoris] }], 'Template Import Bahan & Aksesoris.xlsx');
}

// FieldValidasiInline — 1 sel tabel popup verifikasi: tampilkan nilai dari
// Excel + status valid/tidak, bisa dikoreksi langsung lewat DropdownCari.
// Disalin dari vue-master-produk.js (pola sama).
const FieldValidasiInline = {
  components: { DropdownCari },
  props: {
    nilai: { type: String, default: '' },
    opsi: { type: Array, default: () => [] }
  },
  emits: ['update:nilai'],
  computed: {
    hasil() { return validasiPilihan(this.nilai, this.opsi); }
  },
  template: `
    <div>
      <dropdown-cari :model-value="nilai" :opsi="opsi" placeholder="Cari & pilih..." @update:modelValue="v => $emit('update:nilai', v)" />
      <div v-if="!hasil.valid && nilai && hasil.saran" style="font-size:10.5px; margin-top:2px; color:var(--danger);">
        Tidak cocok persis. Maksud Anda "{{ hasil.saran }}"? <button type="button" @click="$emit('update:nilai', hasil.saran)" style="border:none; background:none; color:var(--burgundy); text-decoration:underline; cursor:pointer; font-size:10.5px; padding:0;">Pakai ini</button>
      </div>
      <div v-else-if="!hasil.valid && nilai" style="font-size:10.5px; margin-top:2px; color:var(--danger);">Tidak ditemukan di daftar. Pilih dari dropdown di atas.</div>
      <div v-else-if="!hasil.valid" style="font-size:10.5px; margin-top:2px; color:var(--danger);">Wajib diisi.</div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// PopupImportBahanAksesoris — popup verifikasi 1 tahap (beda dari Master
// Produk yang 2 tahap Produk Utama+BOM, di sini cuma 1 jenis data). Kolom
// "Jenis" opsinya BEDA per baris tergantung Kategori Utama baris itu
// (Jenis Bahan vs Jenis Aksesoris) — makanya dihitung per-baris, bukan 1
// list statis seperti Warna/Satuan.
// ---------------------------------------------------------------------------
const PopupImportBahanAksesoris = {
  components: { FieldValidasiInline, DropdownCari },
  props: {
    barisMentah: { type: Array, default: () => [] },
    opsiJenisBahan: { type: Array, default: () => [] },
    opsiJenisAksesoris: { type: Array, default: () => [] },
    opsiWarna: { type: Array, default: () => [] },
    opsiSatuan: { type: Array, default: () => [] },
    daftarLama: { type: Array, default: () => [] },
    sedangImport: { type: Boolean, default: false }
  },
  emits: ['tutup', 'konfirmasi'],
  setup(props, { emit }) {
    const petaLama = computed(() => {
      const peta = {};
      for (const p of props.daftarLama) peta[kunciBahanAksesoris(p.kategori_utama, p.nama, p.warna)] = p;
      return peta;
    });

    const baris = ref(props.barisMentah.map(b => ({
      kategori_utama: String(b['Kategori Utama'] || '').trim(),
      jenis: String(b['Jenis'] || '').trim(),
      nama: String(b['Nama'] || '').trim(),
      warna: String(b['Warna'] || '').trim(),
      harga_pembelian: b['Harga Pembelian'],
      satuan_pembelian: String(b['Satuan Pembelian'] || '').trim(),
      isi_konversi_pembelian: b['Isi Konversi Pembelian'],
      satuan_pemakaian: String(b['Satuan Pemakaian'] || '').trim(),
      margin_modal: b['Margin Modal']
    })));

    function opsiJenisUntuk(b) {
      const kat = validasiPilihan(b.kategori_utama, KATEGORI_UTAMA_OPSI);
      if (!kat.valid) return [];
      return kat.nilai === 'Aksesoris' ? props.opsiJenisAksesoris : props.opsiJenisBahan;
    }

    const jumlahKunciDalamFile = computed(() => {
      const peta = {};
      for (const b of baris.value) {
        if (!b.kategori_utama || !b.nama || !b.warna) continue;
        const kunci = kunciBahanAksesoris(b.kategori_utama, b.nama, b.warna);
        peta[kunci] = (peta[kunci] || 0) + 1;
      }
      return peta;
    });

    function statusBaris(b) {
      if (!validasiPilihan(b.kategori_utama, KATEGORI_UTAMA_OPSI).valid) return { valid: false, label: 'Kategori Utama harus "Bahan"/"Aksesoris"', tipe: 'danger' };
      if (!validasiPilihan(b.jenis, opsiJenisUntuk(b)).valid) return { valid: false, label: 'Jenis belum valid', tipe: 'danger' };
      if (!b.nama) return { valid: false, label: 'Nama kosong', tipe: 'danger' };
      if (!validasiPilihan(b.warna, props.opsiWarna).valid) return { valid: false, label: 'Warna belum valid', tipe: 'danger' };
      if (!(parseFloat(b.harga_pembelian) > 0)) return { valid: false, label: 'Harga Pembelian harus > 0', tipe: 'danger' };
      if (!validasiPilihan(b.satuan_pembelian, props.opsiSatuan).valid) return { valid: false, label: 'Satuan Pembelian belum valid', tipe: 'danger' };
      if (!(parseFloat(b.isi_konversi_pembelian) > 0)) return { valid: false, label: 'Isi Konversi Pembelian harus > 0', tipe: 'danger' };
      if (!validasiPilihan(b.satuan_pemakaian, props.opsiSatuan).valid) return { valid: false, label: 'Satuan Pemakaian belum valid', tipe: 'danger' };
      if (b.margin_modal === '' || b.margin_modal === null || b.margin_modal === undefined || isNaN(parseFloat(b.margin_modal))) return { valid: false, label: 'Margin Modal wajib diisi (boleh 0)', tipe: 'danger' };
      const kunci = kunciBahanAksesoris(b.kategori_utama, b.nama, b.warna);
      if (jumlahKunciDalamFile.value[kunci] > 1) return { valid: false, label: 'Kategori+Nama+Warna dobel di file', tipe: 'danger' };
      const ada = petaLama.value[kunci];
      return { valid: true, label: ada ? 'Sudah ada, dilewati' : 'Data baru (ID otomatis)', tipe: ada ? 'warn' : 'ok' };
    }

    const barisDenganStatus = computed(() => baris.value.map(b => ({ b, status: statusBaris(b), opsiJenis: opsiJenisUntuk(b) })));
    const semuaSiap = computed(() => baris.value.length > 0 && barisDenganStatus.value.every(x => x.status.valid));

    function konfirmasi() {
      if (!semuaSiap.value) return;
      emit('konfirmasi', baris.value.map(b => ({ ...b, kategori_utama: validasiPilihan(b.kategori_utama, KATEGORI_UTAMA_OPSI).nilai })));
    }

    return { baris, barisDenganStatus, semuaSiap, konfirmasi, KATEGORI_UTAMA_OPSI };
  },
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:flex-start; justify-content:center; padding:16px; overflow-y:auto;">
      <div class="gc-card" style="max-width:960px; width:100%; margin:24px 0;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:4px;"><i class="fas fa-file-import" style="color:var(--burgundy); margin-right:8px;"></i>Verifikasi Import Bahan &amp; Aksesoris</h3>
        <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Periksa {{ baris.length }} baris dari file. Data yang kombinasi Kategori Utama+Nama+Warna-nya SUDAH ADA akan DILEWATI (tidak ditimpa) — cuma data baru yang ditambahkan, ID dibuat otomatis. Rak Penyimpanan, Volume Barang, dan flag "Perlu Qty per Roll/Lot" TIDAK ikut lewat Import — isi menyusul manual lewat Edit kalau perlu.</p>
        <div style="overflow-x:auto; margin-bottom:16px;">
          <table class="gc-table" style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
              <tr style="text-align:left; color:var(--text-faint); font-size:10.5px; text-transform:uppercase;">
                <th style="padding:6px; min-width:120px;">Kategori Utama</th>
                <th style="padding:6px; min-width:150px;">Jenis</th>
                <th style="padding:6px;">Nama</th>
                <th style="padding:6px; min-width:150px;">Warna</th>
                <th style="padding:6px;">Harga Beli</th>
                <th style="padding:6px; min-width:140px;">Satuan Beli</th>
                <th style="padding:6px;">Isi Konversi</th>
                <th style="padding:6px; min-width:140px;">Satuan Pakai</th>
                <th style="padding:6px;">Margin</th>
                <th style="padding:6px; min-width:170px;">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(x, i) in barisDenganStatus" :key="i" style="border-top:1px solid var(--line);">
                <td style="padding:6px;"><field-validasi-inline v-model:nilai="x.b.kategori_utama" :opsi="KATEGORI_UTAMA_OPSI" /></td>
                <td style="padding:6px;"><field-validasi-inline v-model:nilai="x.b.jenis" :opsi="x.opsiJenis" /></td>
                <td style="padding:6px;"><input v-model="x.b.nama" type="text" style="width:100%; padding:7px 9px; border:1.5px solid var(--line); border-radius:8px; font-size:12px; box-sizing:border-box;"></td>
                <td style="padding:6px;"><field-validasi-inline v-model:nilai="x.b.warna" :opsi="opsiWarna" /></td>
                <td style="padding:6px;"><input v-model.number="x.b.harga_pembelian" type="number" min="0" style="width:90px; padding:7px 9px; border:1.5px solid var(--line); border-radius:8px; font-size:12px; box-sizing:border-box;"></td>
                <td style="padding:6px;"><field-validasi-inline v-model:nilai="x.b.satuan_pembelian" :opsi="opsiSatuan" /></td>
                <td style="padding:6px;"><input v-model.number="x.b.isi_konversi_pembelian" type="number" min="0" style="width:80px; padding:7px 9px; border:1.5px solid var(--line); border-radius:8px; font-size:12px; box-sizing:border-box;"></td>
                <td style="padding:6px;"><field-validasi-inline v-model:nilai="x.b.satuan_pemakaian" :opsi="opsiSatuan" /></td>
                <td style="padding:6px;"><input v-model.number="x.b.margin_modal" type="number" min="0" style="width:80px; padding:7px 9px; border:1.5px solid var(--line); border-radius:8px; font-size:12px; box-sizing:border-box;"></td>
                <td style="padding:6px;"><span class="tag" :class="x.status.tipe">{{ x.status.label }}</span></td>
              </tr>
              <tr v-if="!barisDenganStatus.length"><td colspan="10" style="padding:14px; text-align:center; color:var(--text-faint);">File kosong / sheet "Bahan & Aksesoris" tidak ada isinya.</td></tr>
            </tbody>
          </table>
        </div>
        <div v-if="!semuaSiap" style="font-size:11.5px; color:var(--danger); margin-bottom:10px;"><i class="fas fa-triangle-exclamation" style="margin-right:5px;"></i>Perbaiki dulu semua baris yang belum valid sebelum Import (tidak bisa sebagian).</div>
        <div style="display:flex; gap:8px;">
          <button @click="konfirmasi" :disabled="!semuaSiap || sedangImport" class="btn-primary" style="flex:1;">{{ sedangImport ? 'Mengimpor...' : ('Import ' + baris.length + ' Baris') }}</button>
          <button @click="$emit('tutup')" type="button" class="btn-outline" style="flex:1;" :disabled="sedangImport">Batal</button>
        </div>
      </div>
    </div>
  `
};

// Kompresi gambar sisi klien — pola SAMA seperti js/camera.js (foto KTP) &
// js/vue-reimburse.js (foto bukti), disalin di sini (bukan diimpor) karena
// tidak di-export ke window, cuma dipakai internal file masing-masing.
// Dimensi lebih kecil (500px) & kualitas lebih rendah (0.65) dibanding
// reimburse — ini foto KATALOG bahan (thumbnail), bukan bukti nota, jadi
// TIDAK perlu resolusi tinggi, prioritas dokumen tetap kecil (banyak baris).
function kompresGambarBahan(file, maxDimensi, kualitas) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        let { width, height } = img;
        if (width > maxDimensi || height > maxDimensi) {
          if (width > height) { height = Math.round(height * (maxDimensi / width)); width = maxDimensi; }
          else { width = Math.round(width * (maxDimensi / height)); height = maxDimensi; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', kualitas));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// generateIdBerurutan — inti poin 3 keputusan desain di atas. runTransaction
// WAJIB dipakai di sini (beda dari idAcak() lama di vue-registrasi.js yang
// random jadi tidak butuh ini) supaya counter tidak pernah dobel/tabrakan
// walau 2 admin submit BERSAMAAN persis di waktu yang sama.
async function generateIdBerurutan(kategoriUtama) {
  const kunci = kunciPengaturanId(kategoriUtama);
  const refDoc = doc(db, 'pengaturan_id_bahan_aksesoris', kunci);
  return await runTransaction(db, async (trx) => {
    const snap = await trx.get(refDoc);
    const data = snap.exists() ? snap.data() : null;
    if (!data || !data.prefix) {
      throw new Error(`Prefix ID untuk kategori "${kategoriUtama}" belum diatur. Buka tombol "Pengaturan" (ikon gear di pojok atas) dulu untuk mengatur prefix-nya, baru simpan lagi.`);
    }
    const counterBaru = (data.counter || 0) + 1;
    if (snap.exists()) trx.update(refDoc, { counter: counterBaru });
    else trx.set(refDoc, { prefix: data.prefix, counter: counterBaru });
    return `${data.prefix}-${String(counterBaru).padStart(4, '0')}`;
  });
}

function formStateKosong() {
  return reactive({
    kategori_utama: '',
    jenis: '',
    foto: '',
    nama: '',
    warna: '',
    harga_pembelian: '',
    satuan_pembelian: '',
    isi_konversi_pembelian: '',
    satuan_pemakaian: '',
    // BARU (25 Agt 2026, §25.2) — flag opsional, lihat catatan arsitektur
    // di atas file ini (dekat komentar "UPDATE (25 Agt 2026, §25.2)").
    pakai_lot_tracking: false,
    // BARU (25 Agt 2026) — Rak Penyimpanan (Kode/Baris/Kolom) & Volume
    // Barang (Tinggi/Panjang/Lebar, volume dihitung otomatis = t*p*l).
    // Lihat catatan arsitektur di bawah PengaturanBahanAksesoris. SEMUA
    // opsional (tidak divalidasi wajib di simpanData/simpanEdit) — item
    // lama/baru tetap bisa disimpan tanpa data rak dulu, diisi menyusul.
    // BARU (25 Agt 2026, §25) — ref ke record di master_rak_penyimpanan
    // (menu baru "Rak Penyimpanan"). rak_label = denormalisasi tampilan
    // (mis. "A-1-3"), dipakai juga jadi v-model DropdownCari (strict-select
    // dari opsiRak) — rak_id diturunkan otomatis dari rak_label lewat watch.
    rak_id: '',
    rak_label: '',
    tinggi_barang: '',
    panjang_barang: '',
    lebar_barang: '',
    // BARU (1 Sep 2026, wireframe handoff "Persiapan Produksi - Acc
    // Webbing") — panjang 1 roll gudang (meter), opsional, dasar hitung
    // kolom "roll" di kartu Acc Webbing (butuh_meter / panjang_roll,
    // dibulatkan ke atas). Kosong/0 = belum diisi, kartu Acc Webbing
    // menampilkan "-" bukan angka salah tebak. Cuma relevan buat item
    // webbing/tali, tapi field digeneralisasi (tidak dibatasi per jenis)
    // biar form tetap sederhana — sama pola seperti Volume Barang di atas.
    panjang_roll: '',
    margin_modal: '',
    konversi_bertingkat: []
  });
}

// hitungHargaPerSatuanAkhir — BARU (27 Agt 2026, §25.14, revisi permintaan
// Guru atas §21.11/§21.13). SEBELUM INI "Harga per Satuan Akhir" (dan Harga
// Modal turunannya) SELALU dihitung dari baris PALING ATAS saja
// (baris[0].harga / total-faktor-semua-tingkat) — baris tingkat lain
// (Pack/Pcs) cuma DICATAT tapi TIDAK ikut menentukan Harga Modal.
//
// Guru: "kita tarik data saja dari hitung konversi berjenjang. harga
// menurut satuan awal adalah harga saat pembelian. misal ada 3 jenjang
// artinya ada 3 harga dengan 3 satuan awal, untuk harga per satuan akhir
// tetap patokannya pada harga per harga terupdate per satuan" — dicontohkan
// dengan angka: Dus 900rb, Pack 100rb → hasil akhir per Pcs = 1rb, "menurut
// data satuan awal yang PALING MAHAL". Jadi SEKARANG: tiap tingkat yang
// harga-nya diisi (>0) dihitung dulu "harga implikasi per satuan akhir"-nya
// SENDIRI-SENDIRI (harga tingkat itu dibagi faktor konversi dari tingkat
// itu SAMPAI akhir rantai — BUKAN dari tingkat paling atas), lalu diambil
// yang PALING MAHAL di antara semuanya. Ini KONSISTEN dengan prinsip
// konservatif yang SUDAH dipakai `perbaruiHargaMasterDariRiwayat()` di
// vue-stock-pembelian.js (pilih harga TERMAHAL supaya modal/harga jual
// tidak "ketinggalan" pas harga bahan naik) — cuma sekarang prinsip yang
// sama diterapkan juga ke input MANUAL popup ini, bukan cuma ke riwayat
// pembelian otomatis.
//
// Item 1-tingkat (tanpa Konversi Berjenjang, isi manual biasa) TIDAK
// terpengaruh sama sekali — fungsi ini HANYA dipakai di dalam popup
// Konversi Berjenjang.
function hitungHargaPerSatuanAkhir(baris) {
  let maxHarga = 0;
  baris.forEach((b, i) => {
    const h = parseFloat(b.harga);
    if (!(h > 0)) return;
    // Faktor konversi dari TINGKAT INI (i) sampai akhir rantai — BUKAN
    // dari tingkat 0. Mis. kalau tingkat ini "Pack" (i=1) dan tingkat
    // terakhir "Pcs" dengan jumlah 12, faktornya = 12 (1 Pack = 12 Pcs),
    // BUKAN faktor gabungan Dus->Pcs.
    const faktor = baris.slice(i).reduce((t, x) => t * (parseFloat(x.jumlah) || 0), 1);
    if (!(faktor > 0)) return;
    const impliedHargaAkhir = h / faktor;
    if (impliedHargaAkhir > maxHarga) maxHarga = impliedHargaAkhir;
  });
  return maxHarga;
}
// useKonversiBerjenjang — logic popup "bantu hitung konversi banyak tingkat"
// (mis. Dus > Pack > Pcs), dipakai BARENG oleh form Entry & form Edit (di
// modal List) lewat 1 fungsi ini supaya logicnya tidak ditulis 2x beda-beda.
function useKonversiBerjenjang(form) {
  const tampilPopupKonversi = ref(false);
  const barisKonversi = ref([]);

  function bukaPopupKonversi() {
    barisKonversi.value = (form.konversi_bertingkat && form.konversi_bertingkat.length > 0)
      ? JSON.parse(JSON.stringify(form.konversi_bertingkat))
      : [{ dari: form.satuan_pembelian || '', jumlah: '', ke: '', harga: form.harga_pembelian || '' }];
    tampilPopupKonversi.value = true;
  }
  function tutupPopupKonversi() { tampilPopupKonversi.value = false; }
  function tambahBarisKonversi() {
    const terakhir = barisKonversi.value[barisKonversi.value.length - 1];
    // BARU (malam 24 Agt 2026, harga berjenjang) — harga TIDAK ikut
    // dicopy dari baris sebelumnya (beda konteks pembelian tiap tingkat,
    // mis. beli Dus vs beli Pack harganya beda) — sengaja dikosongkan.
    barisKonversi.value.push({ dari: terakhir ? terakhir.ke : '', jumlah: '', ke: '', harga: '' });
  }
  function hapusBarisKonversi(i) {
    if (barisKonversi.value.length <= 1) return;
    barisKonversi.value.splice(i, 1);
  }
  const totalKonversiBerjenjang = computed(() =>
    barisKonversi.value.reduce((total, b) => total * (parseFloat(b.jumlah) || 0), 1)
  );
  function terapkanKonversi() {
    // BARU (malam 24 Agt 2026, harga berjenjang) — Harga Pembelian SEKARANG
    // field di TIAP baris (harga waktu beli di satuan AWAL baris itu), bukan
    // 1 field tunggal di atas popup lagi.
    // GANTI (27 Agt 2026, §25.14, permintaan Guru — SUPERSEDE §21.11/§21.13)
    // — SEBELUMNYA form.harga_pembelian SELALU = baris[0].harga polos
    // (baris lain cuma tercatat, tidak ikut menentukan Harga Modal).
    // SEKARANG Harga Modal (form.harga_pembelian / isi_konversi_pembelian,
    // formula TIDAK berubah — lihat komentar atas file) diturunkan dari
    // hitungHargaPerSatuanAkhir() — harga TERMAHAL di antara implikasi
    // per-satuan-akhir SEMUA tingkat yang diisi (bukan cuma tingkat
    // teratas). form.harga_pembelian di sini DIKONVERSI BALIK ke "per
    // Satuan Pembelian" (dikali isi_konversi_pembelian) supaya field ini
    // (dan label "Satuan Pembelian"-nya) tetap konsisten artinya seperti
    // sebelumnya, HANYA angkanya sekarang bisa lebih tinggi dari yang
    // diketik di baris[0] kalau ada tingkat lain yang implikasinya lebih
    // mahal.
    if (!(parseFloat(barisKonversi.value[0]?.harga) > 0)) { alert('Isi Harga Pembelian di baris pertama dulu (harus lebih dari 0).'); return; }
    const tidakLengkap = barisKonversi.value.some(b => !b.dari.trim() || !b.ke.trim() || !(parseFloat(b.jumlah) > 0));
    if (tidakLengkap) { alert('Lengkapi semua baris dulu: satuan awal, jumlah (angka > 0), dan satuan tujuan.'); return; }
    form.isi_konversi_pembelian = totalKonversiBerjenjang.value;
    const hargaSatuanAkhirMax = hitungHargaPerSatuanAkhir(barisKonversi.value);
    form.harga_pembelian = Math.round(hargaSatuanAkhirMax * form.isi_konversi_pembelian);
    form.konversi_bertingkat = JSON.parse(JSON.stringify(barisKonversi.value));
    // Field Satuan Pembelian & Satuan Pemakaian di form utama JADI HILANG
    // begitu Konversi Banyak Tingkat dipakai (lihat template Entry/Edit) —
    // makanya di sini WAJIB selalu diisi/ditimpa otomatis dari baris
    // pertama & terakhir popup, bukan cuma "kalau masih kosong" seperti
    // sebelumnya. Kalau tidak, field itu bisa jadi kosong tapi tidak
    // kelihatan (karena disembunyikan) dan Simpan gagal tanpa jelas kenapa.
    const barisPertama = barisKonversi.value[0];
    const barisTerakhir = barisKonversi.value[barisKonversi.value.length - 1];
    if (barisPertama && barisPertama.dari) form.satuan_pembelian = barisPertama.dari;
    if (barisTerakhir && barisTerakhir.ke) form.satuan_pemakaian = barisTerakhir.ke;
    tampilPopupKonversi.value = false;
  }
  // BARU (24 Agt 2026) — dipakai tombol "Hapus & Isi Manual" yang muncul
  // saat Konversi Banyak Tingkat sudah diterapkan (form.konversi_bertingkat
  // ada isinya). Nilai Satuan Pembelian/Isi Konversi/Satuan Pemakaian yang
  // SUDAH terisi dari hasil konversi SENGAJA tidak ikut dikosongkan — cuma
  // flag konversi_bertingkat-nya yang dibersihkan, supaya user tinggal edit
  // manual dari situ (bukan mulai dari nol lagi).
  function hapusKonversiBertingkat() {
    if (!confirm('Hapus Konversi Banyak Tingkat? Field Satuan Pembelian, Isi Konversi Pembelian & Satuan Pemakaian akan tampil lagi sebagai isian manual (nilai yang sudah ada tetap dipertahankan, tinggal diedit kalau perlu).')) return;
    form.konversi_bertingkat = [];
  }
  return { tampilPopupKonversi, barisKonversi, bukaPopupKonversi, tutupPopupKonversi, tambahBarisKonversi, hapusBarisKonversi, totalKonversiBerjenjang, terapkanKonversi, hapusKonversiBertingkat };
}

function formatRupiah(n) {
  const angka = parseFloat(n) || 0;
  return 'Rp ' + Math.round(angka).toLocaleString('id-ID');
}

// BARU (24 Agt 2026) — dipakai untuk tampilkan stok_akhir (lihat Kartu Stok
// Bahan/Aksesoris, js/vue-kartu-stok.js). Field ini di-update transaksional
// oleh catatPergerakanKartuStok() di vue-stock-pembelian.js, bukan diedit manual.
function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

// buatQrDataUrl — BARU (28 Agt 2026, §41.2, dibutuhkan fitur Cetak Label
// yang pindah ke file ini). Disalin (BUKAN diimpor lintas file, konvensi
// proyek ini utk fungsi bantu generate-QR kecil — lihat catatan sama di
// vue-order-spk.js) dari `buatQrDataUrl()` di vue-stock-pembelian.js —
// LOGIC SAMA PERSIS: gambar QR sinkron ke <div> tersembunyi di window
// UTAMA (bukan di window print), ambil hasilnya sebagai data URL PNG,
// baru dikirim ke PopupPratinjauCetakLabel sebagai gambar statis siap
// pakai — window print tidak perlu apa pun dari internet/library lagi.
// `qrcodejs` (global `QRCode`) sudah dimuat sekali di index.html.
function buatQrDataUrl(teks) {
  if (typeof QRCode === 'undefined') return '';
  const tmp = document.createElement('div');
  tmp.style.cssText = 'position:absolute; left:-9999px; top:-9999px; width:160px; height:160px;';
  document.body.appendChild(tmp);
  let dataUrl = '';
  try {
    new QRCode(tmp, { text: String(teks || ''), width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M });
    const canvas = tmp.querySelector('canvas');
    if (canvas) dataUrl = canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Gagal generate QR:', teks, e);
  }
  document.body.removeChild(tmp);
  return dataUrl;
}

// ---------------------------------------------------------------------------
// PengaturanBahanAksesoris — panel (dibuka lewat ikon gear), SEKARANG cuma
// atur Prefix ID per kategori.
//
// RIWAYAT (27 Agt 2026, §26.1) — sebelumnya panel ini JUGA berisi kelola
// Jenis Bahan/Jenis Aksesoris/Data Satuan/Data Warna/Data Ukuran DAN Data
// Rak Penyimpanan (Kode/Baris/Kolom Rak). Keputusan Guru:
//   - Jenis Bahan, Jenis Aksesoris, Data Satuan, Data Warna, Data Ukuran —
//     DIPINDAH ke menu baru "Config" (Zevanic House > Config), lihat
//     js/vue-config.js. TIDAK lagi ada di panel ini.
//   - Data Rak Penyimpanan (Kode/Baris/Kolom Rak) — DIHAPUS TOTAL (bukan
//     dipindah), karena sudah ada menu "Rak Penyimpanan" sendiri yang
//     lebih lengkap (vue-rak-penyimpanan.js), jadi versi mini di sini
//     jadi redundan.
//   - Prefix ID (satu-satunya yang tersisa di sini) TETAP di panel ini,
//     bukan ikut pindah ke Config — sifatnya setting teknis (counter
//     internal per kategori), bukan data referensi yang dicari-cari.
// ---------------------------------------------------------------------------
const PengaturanBahanAksesoris = {
  emits: ['tutup'],
  setup(props, { emit }) {
    const prefixBahan = ref('');
    const prefixAksesoris = ref('');
    const counterBahan = ref(0);
    const counterAksesoris = ref(0);
    const memuat = ref(true);
    const menyimpan = ref(false);

    async function muat() {
      memuat.value = true;
      try {
        const [snapBahan, snapAksesoris] = await Promise.all([
          getDoc(doc(db, 'pengaturan_id_bahan_aksesoris', 'bahan')),
          getDoc(doc(db, 'pengaturan_id_bahan_aksesoris', 'aksesoris'))
        ]);
        if (snapBahan.exists()) { prefixBahan.value = snapBahan.data().prefix || ''; counterBahan.value = snapBahan.data().counter || 0; }
        if (snapAksesoris.exists()) { prefixAksesoris.value = snapAksesoris.data().prefix || ''; counterAksesoris.value = snapAksesoris.data().counter || 0; }
      } catch (e) {
        console.error('Gagal muat pengaturan ID Bahan/Aksesoris:', e);
      }
      memuat.value = false;
    }

    async function simpan() {
      if (!prefixBahan.value.trim() || !prefixAksesoris.value.trim()) {
        alert('Isi prefix untuk Bahan maupun Aksesoris dulu (tidak boleh kosong).');
        return;
      }
      menyimpan.value = true;
      try {
        // merge:true WAJIB — supaya field `counter` yang sudah jalan TIDAK
        // ikut tertimpa balik ke kosong tiap kali prefix disimpan ulang.
        await setDoc(doc(db, 'pengaturan_id_bahan_aksesoris', 'bahan'), { prefix: prefixBahan.value.trim().toUpperCase() }, { merge: true });
        await setDoc(doc(db, 'pengaturan_id_bahan_aksesoris', 'aksesoris'), { prefix: prefixAksesoris.value.trim().toUpperCase() }, { merge: true });
        alert('Pengaturan tersimpan.');
        emit('tutup');
      } catch (e) {
        console.error('Gagal simpan pengaturan ID:', e);
        alert('Gagal menyimpan pengaturan. Coba lagi.');
      }
      menyimpan.value = false;
    }

    onMounted(muat);
    return { prefixBahan, prefixAksesoris, counterBahan, counterAksesoris, memuat, menyimpan, simpan };
  },
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="$emit('tutup')">
      <div class="gc-card" style="max-width:480px; width:100%; max-height:90vh; overflow-y:auto;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:14px;"><i class="fas fa-gear" style="color:var(--burgundy); margin-right:8px;"></i>Pengaturan Bahan & Aksesoris</h3>
        <div v-if="memuat" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;">Memuat...</div>
        <template v-else>
          <p style="font-size:11.5px; font-weight:700; color:var(--text-muted); margin-bottom:8px;">Prefix ID (contoh: BHN, AKS) — nomor urut naik otomatis, TIDAK bisa diubah manual di sini.</p>
          <div style="display:grid; gap:10px; margin-bottom:18px;" class="grid-cols-1 md:grid-cols-2">
            <div class="gc-field" style="margin-bottom:0;">
              <label>Prefix Bahan</label>
              <input v-model="prefixBahan" type="text" placeholder="Contoh: BHN" style="text-transform:uppercase;">
              <p style="font-size:10px; color:var(--text-faint); margin-top:4px;">Sudah terpakai: {{ counterBahan }}. ID berikutnya: {{ (prefixBahan||'...').toUpperCase() }}-{{ String(counterBahan+1).padStart(4,'0') }}</p>
            </div>
            <div class="gc-field" style="margin-bottom:0;">
              <label>Prefix Aksesoris</label>
              <input v-model="prefixAksesoris" type="text" placeholder="Contoh: AKS" style="text-transform:uppercase;">
              <p style="font-size:10px; color:var(--text-faint); margin-top:4px;">Sudah terpakai: {{ counterAksesoris }}. ID berikutnya: {{ (prefixAksesoris||'...').toUpperCase() }}-{{ String(counterAksesoris+1).padStart(4,'0') }}</p>
            </div>
          </div>
          <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="width:100%;">{{ menyimpan ? 'Menyimpan...' : 'Simpan Prefix' }}</button>
          <p style="font-size:10.5px; color:var(--text-faint); margin-top:10px;"><i class="fas fa-circle-info" style="margin-right:4px;"></i>Kelola Jenis Bahan, Jenis Aksesoris, Data Satuan, Data Warna, Data Ukuran, dan Data Suplayer sekarang lewat menu <b>Zevanic House &gt; Config</b>.</p>
        </template>
        <button @click="$emit('tutup')" class="btn-outline" style="width:100%; margin-top:18px;">Tutup</button>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// PopupKonversiBerjenjang — dipakai BARENG oleh Entry & Edit lewat props,
// emit 'terapkan'/'tutup' supaya state konversi tetap dipegang komponen
// induk masing-masing (form Entry / form Edit), bukan disimpan ganda di sini.
// ---------------------------------------------------------------------------
const PopupKonversiBerjenjang = {
  components: { DropdownCari },
  props: {
    baris: { type: Array, required: true },
    total: { type: Number, required: true },
    // BARU (24 Agt 2026) — Satuan awal/tujuan SEKARANG dropdown pencarian
    // (bukan teks bebas lagi), opsi diambil dari Data Satuan (master_satuan,
    // dikirim dari komponen induk Entry/Edit yang sudah punya list ini).
    opsiSatuan: { type: Array, default: () => [] }
  },
  emits: ['tambah', 'hapus', 'terapkan', 'tutup'],
  computed: {
    // BARU (malam 24 Agt 2026, harga berjenjang ronde 2) — admin cuma
    // isi harga NOTA (harga di satuan awal, mis. Rp 1jt per Dus), sistem
    // yang hitung harga per satuan akhirnya sendiri — tidak perlu admin
    // hitung manual (permintaan Guru: "admin males hitung").
    // GANTI (27 Agt 2026, §25.14) — SEBELUMNYA cuma baca baris[0] (tingkat
    // teratas). SEKARANG pakai hitungHargaPerSatuanAkhir() (fungsi
    // module-level, dipakai bareng terapkanKonversi() di atas) — ambil
    // yang PALING MAHAL di antara implikasi per-satuan-akhir SEMUA
    // tingkat yang harganya diisi, bukan cuma tingkat teratas.
    hargaPerSatuanAkhirFormatted() {
      return formatRupiah(hitungHargaPerSatuanAkhir(this.baris));
    }
  },
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="$emit('tutup')">
      <div class="gc-card" style="max-width:640px; width:100%; max-height:90vh; overflow-y:auto;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:6px;"><i class="fas fa-calculator" style="color:var(--burgundy); margin-right:8px;"></i>Bantu Hitung Konversi Berjenjang</h3>
        <p style="font-size:11px; color:var(--text-faint); margin-bottom:6px;">Contoh: 1 Dus = 12 Pack, 1 Pack = 12 Pcs. Tambah baris kalau tingkatnya lebih dari 1. Hasil akhir akan otomatis mengisi "Isi Konversi Pembelian". Satuan diambil dari Data Satuan — kalau belum ada di daftar, tambah dulu lewat Pengaturan.</p>
        <p style="font-size:11px; color:var(--burgundy); background:var(--burgundy-light); border-radius:8px; padding:8px 10px; margin-bottom:14px;"><i class="fas fa-circle-info" style="margin-right:5px;"></i><b>Tips isi:</b> isi Harga Pembelian per baris PERSIS seperti di nota (harga buat beli 1 Satuan Awal-nya, mis. Rp 1.000.000 per Dus) — <b>tidak perlu dihitung manual</b>, sistem yang bagi ke satuan lebih kecil otomatis. Urutan baris mulai dari satuan yang <b>PALING BESAR</b> dulu (Satuan Pembelian, mis. Dus), baru turun ke yang lebih kecil tiap tambah baris (Pack, lalu Pcs) sampai ke Satuan Pemakaian.</p>
        <!-- BARU (malam 24 Agt 2026, harga berjenjang ronde 2) — Harga
             Pembelian SEKARANG field di TIAP baris (bukan cuma baris
             pertama) — merekam harga NYATA waktu beli di satuan awal
             baris itu (mis. baris 1 beli per Dus Rp 1jt, baris 2 kalau
             suatu saat beli langsung per Pack harganya beda lagi, lebih
             mahal). Yang dipakai buat Harga Modal TETAP baris PALING
             ATAS saja (form.harga_pembelian = baris[0].harga, lihat
             terapkanKonversi()) — baris lain SEKARANG DATA NYATA (bukan
             cuma referensi opsional lagi), disimpan apa adanya di
             konversi_bertingkat buat dipakai fitur Riwayat Harga
             Pembelian nanti. -->
        <div class="hidden md:grid" style="grid-template-columns:1fr 1fr 64px 1fr 30px; gap:6px; margin-bottom:4px;">
          <span style="font-size:10px; font-weight:700; color:var(--text-faint);">HARGA PEMBELIAN</span>
          <span style="font-size:10px; font-weight:700; color:var(--text-faint);">SATUAN AWAL</span>
          <span style="font-size:10px; font-weight:700; color:var(--text-faint);">JUMLAH</span>
          <span style="font-size:10px; font-weight:700; color:var(--text-faint);">SATUAN TUJUAN</span>
          <span></span>
        </div>
        <div v-for="(b, i) in baris" :key="i" class="gc-row-konversi" style="margin-bottom:10px; padding:10px; background:var(--ivory-dim); border-radius:10px;">
          <div><span class="gc-row-label">Harga Pembelian</span><input v-model.number="b.harga" type="number" min="0" placeholder="0" style="width:100%; padding:7px 6px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;"></div>
          <div><span class="gc-row-label">Satuan Awal</span><dropdown-cari v-model="b.dari" :opsi="opsiSatuan" placeholder="Mis. Dus" /></div>
          <div><span class="gc-row-label">Jumlah</span><input v-model.number="b.jumlah" type="number" min="0" placeholder="Jml" style="width:100%; padding:7px 6px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;"></div>
          <div><span class="gc-row-label">Satuan Tujuan</span><dropdown-cari v-model="b.ke" :opsi="opsiSatuan" placeholder="Mis. Pack" /></div>
          <div style="display:flex; justify-content:flex-end;"><button @click="$emit('hapus', i)" class="icon-btn" style="color:var(--danger);" title="Hapus baris"><i class="fas fa-trash-alt"></i></button></div>
        </div>
        <button @click="$emit('tambah')" class="btn-outline" style="font-size:11.5px; padding:6px 14px; margin-bottom:16px;"><i class="fas fa-plus" style="margin-right:5px;"></i>Tambah Tingkat</button>
        <div v-if="baris[0]" style="background:var(--ivory-dim); border-radius:10px; padding:10px 14px; margin-bottom:16px; font-size:12.5px;">
          <div style="display:flex; justify-content:space-between;">
            <span style="color:var(--text-muted);">1 {{ baris[0].dari || '...' }} =</span><b>{{ total || 0 }} {{ baris[baris.length - 1].ke || '...' }}</b>
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:4px; padding-top:4px; border-top:1px dashed var(--line);">
            <span style="color:var(--text-muted);">Harga per {{ baris[baris.length - 1].ke || 'satuan akhir' }}:</span><b style="color:var(--burgundy);">{{ hargaPerSatuanAkhirFormatted }}</b>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="$emit('terapkan')" class="btn-primary" style="flex:1;">Terapkan</button>
          <button @click="$emit('tutup')" class="btn-outline" style="flex:1;">Batal</button>
        </div>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// BahanAksesorisEntryManager — menu "Bahan / Aksesoris" (form entry data baru)
// ---------------------------------------------------------------------------
const BahanAksesorisEntryManager = {
  components: { PopupKonversiBerjenjang, PengaturanBahanAksesoris, DropdownCari },
  setup() {
    const form = formStateKosong();
    const opsiJenis = ref([]);
    const opsiSatuan = ref([]);
    const opsiWarna = ref([]);
    const daftarRak = ref([]);
    const opsiRak = computed(() => daftarRak.value.map(r => r.rak_label));
    const menyimpan = ref(false);
    const tampilPengaturan = ref(false);

    async function muatOpsiSatuanWarna() {
      [opsiSatuan.value, opsiWarna.value] = await Promise.all([
        ambilDaftarNama('master_satuan'),
        ambilDaftarNama('master_warna')
      ]);
    }

    // muatDaftarRak — BARU (25 Agt 2026, §25). Ambil semua record Rak
    // (menu "Rak Penyimpanan") buat opsi dropdown "Pilih Rak" di bawah.
    async function muatDaftarRak() { daftarRak.value = await ambilDaftarRak(); }
    // rakDipilih — cari record lengkap Rak yang sedang dipilih (buat
    // tampilkan info dimensi/volume rak-nya sebagai konfirmasi visual).
    const rakDipilih = computed(() => daftarRak.value.find(r => r.id === form.rak_id) || null);
    // Begitu form.rak_label berubah (DropdownCari strict-select — SELALU
    // salah satu dari opsiRak, atau string kosong), turunkan rak_id
    // otomatis dari situ. Kalau labelnya tidak cocok record manapun
    // (mis. dikosongkan), rak_id ikut dikosongkan.
    watch(() => form.rak_label, (label) => {
      const cocok = daftarRak.value.find(r => r.rak_label === label);
      form.rak_id = cocok ? cocok.id : '';
    });

    const hargaModal = computed(() => {
      const hp = parseFloat(form.harga_pembelian) || 0;
      const ik = parseFloat(form.isi_konversi_pembelian) || 0;
      return ik > 0 ? hp / ik : 0;
    });
    const hargaPemakaian = computed(() => hargaModal.value + (parseFloat(form.margin_modal) || 0));
    // volumeBarang — BARU (25 Agt 2026). Volume = Tinggi x Panjang x Lebar
    // (dimensi 1 satuan barang itu sendiri, bukan dimensi rak — lihat
    // catatan arsitektur poin 2 di atas file ini). 0 kalau salah satu
    // dimensi belum diisi.
    const volumeBarang = computed(() => {
      const t = parseFloat(form.tinggi_barang) || 0;
      const p = parseFloat(form.panjang_barang) || 0;
      const l = parseFloat(form.lebar_barang) || 0;
      return t * p * l;
    });

    async function muatOpsiJenis() {
      if (!form.kategori_utama) { opsiJenis.value = []; return; }
      opsiJenis.value = window.ambilMasterList ? await window.ambilMasterList(kategoriMasterData(form.kategori_utama)) : [];
    }
    watch(() => form.kategori_utama, () => { form.jenis = ''; muatOpsiJenis(); });

    onMounted(() => { muatOpsiSatuanWarna(); muatDaftarRak(); });

    function pilihFoto(event) {
      const file = event.target.files[0];
      if (!file) return;
      kompresGambarBahan(file, 500, 0.65)
        .then(dataUrl => { form.foto = dataUrl; })
        .catch(e => { console.error('Gagal proses foto:', e); alert('Gagal memproses foto, coba foto lain.'); });
    }
    function hapusFoto() { form.foto = ''; }

    const konversi = useKonversiBerjenjang(form);

    function resetForm() {
      const kategoriDipertahankan = form.kategori_utama;
      Object.assign(form, formStateKosong());
      form.kategori_utama = kategoriDipertahankan; // biar tidak usah pilih ulang tiap entry berturut-turut
    }

    // simpanData(duplikat) — BARU (23 Agt 2026): 1 fungsi dipakai 2 tombol.
    // duplikat=false (tombol "Simpan"): form direset kosong setelah sukses
    // (perilaku LAMA, tetap dipertahankan). duplikat=true (tombol "Simpan &
    // Duplikat"): form TIDAK direset — semua field DIPERTAHANKAN APA ADANYA
    // (kecuali Foto, sengaja dikosongkan — varian warna baru biasanya butuh
    // foto baru juga) supaya admin tinggal ubah sedikit detail yang beda
    // (paling umum: Warna, tapi bisa juga Harga/Satuan/dll — bebas) lalu
    // simpan lagi jadi entri BARU (ID baru lagi, BUKAN update entri lama).
    async function simpanData(duplikat) {
      if (!form.kategori_utama) return alert('Pilih Kategori Utama (Bahan/Aksesoris) dulu.');
      if (!form.jenis) return alert('Pilih Jenis Bahan/Aksesoris dulu.');
      if (!form.nama.trim()) return alert('Isi Nama Bahan/Aksesoris dulu.');
      if (!form.warna.trim()) return alert('Pilih Warna dulu.');
      if (!(parseFloat(form.harga_pembelian) > 0)) return alert('Isi Harga Pembelian dulu (harus lebih dari 0).');
      if (!form.satuan_pembelian.trim()) return alert('Pilih Satuan Pembelian dulu.');
      if (!(parseFloat(form.isi_konversi_pembelian) > 0)) return alert('Isi Isi Konversi Pembelian dulu (harus lebih dari 0) — bisa pakai tombol "Bantu Hitung Konversi Berjenjang" kalau tingkatnya banyak.');
      if (!form.satuan_pemakaian.trim()) return alert('Pilih Satuan Pemakaian dulu.');
      if (form.margin_modal === '' || form.margin_modal === null) return alert('Isi Margin Modal dulu (boleh 0 kalau memang tidak ada margin).');

      menyimpan.value = true;
      try {
        const idBaru = await generateIdBerurutan(form.kategori_utama);
        await addDoc(collection(db, 'master_bahan_aksesoris'), {
          id_tampil: idBaru,
          kategori_utama: form.kategori_utama,
          jenis: form.jenis,
          foto: form.foto || null,
          nama: form.nama.trim(),
          warna: form.warna.trim(),
          harga_pembelian: parseFloat(form.harga_pembelian) || 0,
          satuan_pembelian: form.satuan_pembelian.trim(),
          isi_konversi_pembelian: parseFloat(form.isi_konversi_pembelian) || 0,
          satuan_pemakaian: form.satuan_pemakaian.trim(),
          harga_modal: hargaModal.value,
          margin_modal: parseFloat(form.margin_modal) || 0,
          harga_pemakaian: hargaPemakaian.value,
          konversi_bertingkat: form.konversi_bertingkat || [],
          // BARU (25 Agt 2026, §25.2) — flag opsional, lihat catatan
          // arsitektur di atas file ini.
          pakai_lot_tracking: !!form.pakai_lot_tracking,
          // BARU (25 Agt 2026) — Rak Penyimpanan & Volume Barang, semua
          // opsional (lihat catatan arsitektur di atas file ini).
          rak_id: form.rak_id || '',
          rak_label: form.rak_id ? form.rak_label : '',
          tinggi_barang: parseFloat(form.tinggi_barang) || 0,
          panjang_barang: parseFloat(form.panjang_barang) || 0,
          lebar_barang: parseFloat(form.lebar_barang) || 0,
          volume_barang: volumeBarang.value,
          // BARU (1 Sep 2026) — lihat catatan panjang_roll di formKosong().
          panjang_roll: parseFloat(form.panjang_roll) || 0,
          dibuat_pada: serverTimestamp(),
          dibuat_oleh: window.currentUser?.email || null
        });
        if (duplikat) {
          form.foto = '';
          alert(`Tersimpan! ID: ${idBaru}\n\nForm DIPERTAHANKAN untuk Duplikat — ubah detail yang beda (misal Warna), lalu Simpan / Simpan & Duplikat lagi.`);
        } else {
          alert(`Tersimpan! ID: ${idBaru}`);
          resetForm();
        }
      } catch (e) {
        console.error('Gagal simpan Bahan/Aksesoris:', e);
        alert(e.message && e.message.includes('Prefix ID') ? e.message : 'Gagal menyimpan data. Coba lagi.');
      }
      menyimpan.value = false;
    }
    function simpan() { return simpanData(false); }
    function simpanDanDuplikat() { return simpanData(true); }

    return {
      form, opsiJenis, opsiSatuan, opsiWarna, opsiRak, rakDipilih,
      KATEGORI_UTAMA_OPSI, menyimpan, hargaModal, hargaPemakaian, volumeBarang, formatRupiah, formatQty,
      pilihFoto, hapusFoto, simpan, simpanDanDuplikat, tampilPengaturan, muatOpsiJenis, muatOpsiSatuanWarna, muatDaftarRak,
      ...konversi
    };
  },
  template: `
    <div class="gc-card" style="margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h3 style="font-weight:700; font-size:13.5px;"><i class="fas fa-boxes-stacked" style="color:var(--burgundy); margin-right:8px;"></i>Entry Bahan / Aksesoris</h3>
        <button @click="tampilPengaturan = true" class="icon-btn" title="Pengaturan (prefix ID & Jenis)"><i class="fas fa-gear"></i></button>
      </div>

      <div class="gc-field">
        <label>Kategori Utama <span style="color:var(--danger);">*</span></label>
        <div style="display:flex; gap:16px;">
          <label v-for="k in KATEGORI_UTAMA_OPSI" :key="k" style="display:flex; align-items:center; gap:6px; font-size:12.5px; cursor:pointer;">
            <input type="radio" :value="k" v-model="form.kategori_utama" style="accent-color:var(--burgundy);">{{ k }}
          </label>
        </div>
      </div>

      <p style="font-size:10.5px; color:var(--text-faint); margin:2px 0 12px;">Tanggal Entry & ID akan dibuat OTOMATIS saat disimpan.</p>

      <div style="display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-2">
        <div class="gc-field">
          <label>Jenis Bahan / Aksesoris <span style="color:var(--danger);">*</span></label>
          <dropdown-cari v-model="form.jenis" :opsi="opsiJenis" :disabled="!form.kategori_utama" :placeholder="form.kategori_utama ? 'Cari & pilih Jenis...' : 'Pilih Kategori Utama dulu'" />
        </div>
        <div class="gc-field">
          <label>Foto (opsional)</label>
          <input type="file" accept="image/*" @change="pilihFoto">
        </div>
        <div class="gc-field">
          <label>Nama Bahan / Aksesoris <span style="color:var(--danger);">*</span></label>
          <input v-model="form.nama" type="text" placeholder="Contoh: Katun Combed 30s">
        </div>
        <div class="gc-field">
          <label>Warna Bahan / Aksesoris <span style="color:var(--danger);">*</span></label>
          <dropdown-cari v-model="form.warna" :opsi="opsiWarna" placeholder="Cari & pilih Warna..." />
        </div>
      </div>
      <div v-if="form.foto" style="margin-bottom:12px;">
        <img :src="form.foto" style="width:80px; height:80px; object-fit:cover; border-radius:10px; border:1.5px solid var(--line);">
        <button @click="hapusFoto" style="background:none; border:none; color:var(--danger); font-size:11px; font-weight:700; cursor:pointer; margin-left:8px;">Hapus foto</button>
      </div>

      <hr style="border-color:var(--line); margin:14px 0;">

      <div v-if="!(form.konversi_bertingkat && form.konversi_bertingkat.length > 0)" style="display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-4">
        <div class="gc-field">
          <label>Harga Pembelian (Rp) <span style="color:var(--danger);">*</span></label>
          <input v-model.number="form.harga_pembelian" type="number" min="0" placeholder="0">
        </div>
        <div class="gc-field">
          <label>Satuan Pembelian <span style="color:var(--danger);">*</span></label>
          <dropdown-cari v-model="form.satuan_pembelian" :opsi="opsiSatuan" placeholder="Cari & pilih Satuan..." />
        </div>
        <div class="gc-field">
          <label>Isi Konversi Pembelian <span style="color:var(--danger);">*</span></label>
          <input v-model.number="form.isi_konversi_pembelian" type="number" min="0" placeholder="Contoh: 144">
        </div>
        <div class="gc-field">
          <label>Satuan Pemakaian <span style="color:var(--danger);">*</span></label>
          <dropdown-cari v-model="form.satuan_pemakaian" :opsi="opsiSatuan" placeholder="Cari & pilih Satuan..." />
        </div>
      </div>

      <div v-else style="background:var(--ivory-dim); border-radius:12px; padding:14px 16px; margin-bottom:4px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <b style="font-size:12.5px;"><i class="fas fa-calculator" style="color:var(--burgundy); margin-right:6px;"></i>Konversi Banyak Tingkat aktif</b>
          <div style="display:flex; gap:6px;">
            <button @click="bukaPopupKonversi" class="icon-btn" title="Ubah Konversi Banyak Tingkat"><i class="fas fa-pen"></i></button>
            <button @click="hapusKonversiBertingkat" class="icon-btn" style="color:var(--danger);" title="Hapus & isi manual"><i class="fas fa-times"></i></button>
          </div>
        </div>
        <p style="font-size:11.5px; margin-bottom:4px;">Harga Pembelian: <b>{{ formatRupiah(form.harga_pembelian) }}</b></p>
        <p style="font-size:11.5px; color:var(--text-muted);">Rincian: {{ form.konversi_bertingkat.map(b => '1 ' + b.dari + ' = ' + b.jumlah + ' ' + b.ke + (b.harga ? ' (' + formatRupiah(b.harga) + '/' + b.dari + ')' : '')).join(', ') }}</p>
        <p style="font-size:11.5px; margin-top:4px;">Isi Konversi Pembelian: <b>{{ form.isi_konversi_pembelian }}</b> &middot; Satuan Pemakaian: <b>{{ form.satuan_pemakaian }}</b></p>
      </div>

      <!-- BARU (25 Agt 2026) — tombol Konversi Banyak Tingkat DIPINDAH ke
           sini (di bawah field Harga Pembelian/Satuan Pembelian/Isi
           Konversi/Satuan Pemakaian, sebelum Rak Penyimpanan & Margin
           Modal) — sebelumnya nempel di sebelah Margin Modal. Cuma
           tampil kalau Konversi Banyak Tingkat BELUM aktif — kalau
           sudah aktif, kotak ringkasan di atas sudah punya tombol
           edit/hapus sendiri. -->
      <div v-if="!(form.konversi_bertingkat && form.konversi_bertingkat.length > 0)" style="margin-top:10px;">
        <button @click="bukaPopupKonversi" class="btn-outline" style="white-space:nowrap; padding:0 16px; height:44px;"><i class="fas fa-calculator" style="margin-right:6px;"></i>Konversi Banyak Tingkat</button>
      </div>

      <!-- BARU (25 Agt 2026, §25.2) — flag opsional per item: tandai kalau
           bahan ini disimpan per roll/kones & perlu qty per roll dicatat
           saat diterima (Nota Order Belanja). Mengaktifkan tombol popup
           "Qty per Roll/Lot" di tabel Daftar Pesanan Pembelian
           (js/vue-stock-pembelian.js) — FIFO/pemakaian per-lot belum
           dikerjakan (menyusul). -->
      <div class="gc-field" style="margin-top:12px;">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:400;">
          <input type="checkbox" v-model="form.pakai_lot_tracking" style="accent-color:var(--burgundy); width:16px; height:16px;">
          <span>Perlu Qty per Roll/Lot saat diterima (mis. bahan berbentuk Roll/Kones)</span>
        </label>
      </div>

      <!-- BARU (25 Agt 2026, §25) — Rak Penyimpanan SEKARANG 1 dropdown
           pilih Rak terdaftar (menu baru "Rak Penyimpanan",
           js/vue-rak-penyimpanan.js) — BUKAN 3 dropdown lepas lagi. Kalau
           daftar Rak masih kosong, ada pesan bantu arah ke menu itu.
           Opsional. -->
      <p style="font-size:11.5px; font-weight:700; color:var(--text-muted); margin:16px 0 8px;"><i class="fas fa-warehouse" style="margin-right:6px;"></i>Rak Penyimpanan (opsional)</p>
      <div class="gc-field">
        <label>Pilih Rak</label>
        <dropdown-cari v-model="form.rak_label" :opsi="opsiRak" placeholder="Cari & pilih Rak..." />
        <p v-if="opsiRak.length === 0" style="font-size:10.5px; color:var(--text-faint); margin-top:4px;">Belum ada Rak terdaftar — daftarkan dulu di sub-menu "Rak Penyimpanan".</p>
        <p v-else-if="rakDipilih" style="font-size:10.5px; color:var(--text-faint); margin-top:4px;">Dimensi Rak: {{ formatQty(rakDipilih.tinggi_rak) }} &times; {{ formatQty(rakDipilih.panjang_rak) }} &times; {{ formatQty(rakDipilih.lebar_rak) }} cm &middot; Kapasitas: {{ formatQty(rakDipilih.volume_rak) }} cm&sup3;</p>
      </div>

      <!-- BARU (25 Agt 2026) — Volume Barang (Tinggi/Panjang/Lebar dari 1
           satuan BARANG ini sendiri, BUKAN dimensi rak — lihat catatan
           arsitektur di atas file ini). Volume dihitung otomatis
           (readonly), disimpan sebagai field volume_barang. -->
      <p style="font-size:11.5px; font-weight:700; color:var(--text-muted); margin:14px 0 8px;"><i class="fas fa-cube" style="margin-right:6px;"></i>Volume Barang (opsional) — untuk hitung kapasitas rak, cegah over stok</p>
      <div style="display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-3">
        <div class="gc-field">
          <label>Tinggi (cm)</label>
          <input v-model.number="form.tinggi_barang" type="number" min="0" placeholder="0">
        </div>
        <div class="gc-field">
          <label>Panjang (cm)</label>
          <input v-model.number="form.panjang_barang" type="number" min="0" placeholder="0">
        </div>
        <div class="gc-field">
          <label>Lebar (cm)</label>
          <input v-model.number="form.lebar_barang" type="number" min="0" placeholder="0">
        </div>
      </div>
      <p style="font-size:11px; color:var(--text-faint); margin:2px 0 0;">Volume (otomatis): <b>{{ volumeBarang.toLocaleString('id-ID') }} cm&sup3;</b> per {{ form.satuan_pemakaian || 'satuan pemakaian' }}</p>

      <!-- BARU (1 Sep 2026) — Panjang Roll, dasar hitung kolom "roll" di
           kartu Acc Webbing. Opsional, cuma relevan buat item webbing/tali. -->
      <div class="gc-field" style="margin-top:14px;">
        <label>Panjang 1 Roll (meter) <span style="font-size:10px; color:var(--text-faint); font-weight:400;">— opsional, dasar hitung kolom "roll" Acc Webbing</span></label>
        <input v-model.number="form.panjang_roll" type="number" min="0" placeholder="0">
      </div>

      <div class="gc-field" style="margin-top:16px;">
        <label>Margin Modal (Rp) <span style="color:var(--danger);">*</span></label>
        <input v-model.number="form.margin_modal" type="number" min="0" placeholder="0">
      </div>

      <div style="background:var(--ivory-dim); border-radius:12px; padding:12px 16px; display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:16px 0;">
        <div><span style="font-size:10.5px; color:var(--text-faint); display:block;">Harga Modal (otomatis)</span><b style="font-size:14px;">{{ formatRupiah(hargaModal) }}</b></div>
        <div><span style="font-size:10.5px; color:var(--text-faint); display:block;">Harga Pemakaian (otomatis)</span><b style="font-size:14px; color:var(--burgundy);">{{ formatRupiah(hargaPemakaian) }}</b></div>
      </div>

      <div style="display:flex; gap:8px;">
        <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="flex:1; padding:12px;"><i class="fas fa-floppy-disk" style="margin-right:6px;"></i>{{ menyimpan ? 'Menyimpan...' : 'Simpan' }}</button>
        <button @click="simpanDanDuplikat" :disabled="menyimpan" class="btn-outline" style="flex:1; padding:12px;" title="Simpan sebagai entri baru, TAPI form tidak dikosongkan — tinggal ubah detail yang beda (misal Warna) lalu simpan lagi"><i class="fas fa-copy" style="margin-right:6px;"></i>Simpan &amp; Duplikat</button>
      </div>
    </div>

    <popup-konversi-berjenjang v-if="tampilPopupKonversi" :baris="barisKonversi" :total="totalKonversiBerjenjang" :opsi-satuan="opsiSatuan"
      @tambah="tambahBarisKonversi" @hapus="hapusBarisKonversi" @terapkan="terapkanKonversi" @tutup="tutupPopupKonversi" />
    <pengaturan-bahan-aksesoris v-if="tampilPengaturan" @tutup="tampilPengaturan = false; muatOpsiJenis(); muatOpsiSatuanWarna(); muatDaftarRak()" />
  `
};

// ---------------------------------------------------------------------------
// BahanAksesorisListManager — menu "List Bahan / Aksesoris" (tabel paginasi
// cursor-based, WAJIB sesuai PRINSIP-HEMAT.md — bukan fetch-semua-lalu-
// potong-di-JS seperti MasterKendaraanManager lama).
// ---------------------------------------------------------------------------
const BahanAksesorisListManager = {
  components: { PopupKonversiBerjenjang, DropdownCari, PopupImportBahanAksesoris, PopupPratinjauCetakLabel },
  setup() {
    const filterKategori = ref('ALL');
    const paginasi = usePaginasiFirestore(db, 'master_bahan_aksesoris', {
      perHalaman: 15,
      urutkanField: 'nama',
      cariField: 'nama',
      constraintTambahan: () => filterKategori.value === 'ALL' ? [] : [where('kategori_utama', '==', filterKategori.value)],
      petakan: (id, d) => ({ id, ...d })
    });
    watch(filterKategori, () => paginasi.muatUlang());

    const sedangEditId = ref(null);
    const formEdit = formStateKosong();
    const opsiJenisEdit = ref([]);
    const opsiSatuanEdit = ref([]);
    const opsiWarnaEdit = ref([]);
    const daftarRakEdit = ref([]);
    const opsiRakEdit = computed(() => daftarRakEdit.value.map(r => r.rak_label));
    const menyimpanEdit = ref(false);

    async function muatOpsiSatuanWarnaEdit() {
      [opsiSatuanEdit.value, opsiWarnaEdit.value] = await Promise.all([
        ambilDaftarNama('master_satuan'),
        ambilDaftarNama('master_warna')
      ]);
    }

    // muatDaftarRakEdit — BARU (25 Agt 2026, §25), sama seperti
    // muatDaftarRak() di BahanAksesorisEntryManager, dipanggil tiap
    // bukaEdit() (bukan sekali saat mounted) supaya selalu ambil daftar
    // Rak terbaru saat modal dibuka.
    async function muatDaftarRakEdit() { daftarRakEdit.value = await ambilDaftarRak(); }
    const rakDipilihEdit = computed(() => daftarRakEdit.value.find(r => r.id === formEdit.rak_id) || null);
    watch(() => formEdit.rak_label, (label) => {
      const cocok = daftarRakEdit.value.find(r => r.rak_label === label);
      formEdit.rak_id = cocok ? cocok.id : '';
    });

    const hargaModalEdit = computed(() => {
      const hp = parseFloat(formEdit.harga_pembelian) || 0;
      const ik = parseFloat(formEdit.isi_konversi_pembelian) || 0;
      return ik > 0 ? hp / ik : 0;
    });
    const hargaPemakaianEdit = computed(() => hargaModalEdit.value + (parseFloat(formEdit.margin_modal) || 0));
    // volumeBarangEdit — BARU (25 Agt 2026), sama seperti volumeBarang di
    // BahanAksesorisEntryManager.
    const volumeBarangEdit = computed(() => {
      const t = parseFloat(formEdit.tinggi_barang) || 0;
      const p = parseFloat(formEdit.panjang_barang) || 0;
      const l = parseFloat(formEdit.lebar_barang) || 0;
      return t * p * l;
    });
    async function muatOpsiJenisEdit() {
      opsiJenisEdit.value = window.ambilMasterList ? await window.ambilMasterList(kategoriMasterData(formEdit.kategori_utama)) : [];
    }
    watch(() => formEdit.kategori_utama, () => { if (sedangEditId.value) muatOpsiJenisEdit(); });

    const konversiEdit = useKonversiBerjenjang(formEdit);

    function bukaEdit(item) {
      sedangEditId.value = item.id;
      Object.assign(formEdit, {
        kategori_utama: item.kategori_utama || '', jenis: item.jenis || '', foto: item.foto || '',
        nama: item.nama || '', warna: item.warna || '', harga_pembelian: item.harga_pembelian || '',
        satuan_pembelian: item.satuan_pembelian || '', isi_konversi_pembelian: item.isi_konversi_pembelian || '',
        satuan_pemakaian: item.satuan_pemakaian || '', margin_modal: item.margin_modal ?? '',
        // BARU (25 Agt 2026, §25.2) — flag opsional, lihat catatan
        // arsitektur di atas file ini.
        pakai_lot_tracking: !!item.pakai_lot_tracking,
        // BARU (25 Agt 2026, §25) — Rak Penyimpanan (ref) & Volume Barang.
        rak_id: item.rak_id || '', rak_label: item.rak_label || '',
        tinggi_barang: item.tinggi_barang || '', panjang_barang: item.panjang_barang || '', lebar_barang: item.lebar_barang || '',
        panjang_roll: item.panjang_roll || '',
        konversi_bertingkat: item.konversi_bertingkat || []
      });
      muatOpsiJenisEdit();
      muatOpsiSatuanWarnaEdit();
      muatDaftarRakEdit();
    }
    function batalEdit() { sedangEditId.value = null; }

    function pilihFotoEdit(event) {
      const file = event.target.files[0];
      if (!file) return;
      kompresGambarBahan(file, 500, 0.65)
        .then(dataUrl => { formEdit.foto = dataUrl; })
        .catch(e => { console.error('Gagal proses foto:', e); alert('Gagal memproses foto, coba foto lain.'); });
    }

    async function simpanEdit() {
      if (!formEdit.jenis || !formEdit.nama.trim() || !formEdit.warna.trim() || !(parseFloat(formEdit.harga_pembelian) > 0) ||
          !formEdit.satuan_pembelian.trim() || !(parseFloat(formEdit.isi_konversi_pembelian) > 0) || !formEdit.satuan_pemakaian.trim() ||
          formEdit.margin_modal === '' || formEdit.margin_modal === null) {
        alert('Lengkapi semua field wajib dulu.');
        return;
      }
      menyimpanEdit.value = true;
      try {
        // CATATAN: id_tampil, kategori_utama, dan dibuat_pada SENGAJA TIDAK
        // ikut diupdate di sini — ID & kategori yang menentukan prefix ID
        // tidak boleh berubah setelah dibuat (kalau kategorinya salah pilih,
        // lebih aman hapus & entry ulang daripada ID jadi tidak konsisten
        // dengan prefix kategori aslinya).
        await updateDoc(doc(db, 'master_bahan_aksesoris', sedangEditId.value), {
          jenis: formEdit.jenis, foto: formEdit.foto || null, nama: formEdit.nama.trim(), warna: formEdit.warna.trim(),
          harga_pembelian: parseFloat(formEdit.harga_pembelian) || 0, satuan_pembelian: formEdit.satuan_pembelian.trim(),
          isi_konversi_pembelian: parseFloat(formEdit.isi_konversi_pembelian) || 0, satuan_pemakaian: formEdit.satuan_pemakaian.trim(),
          harga_modal: hargaModalEdit.value, margin_modal: parseFloat(formEdit.margin_modal) || 0, harga_pemakaian: hargaPemakaianEdit.value,
          konversi_bertingkat: formEdit.konversi_bertingkat || [],
          // BARU (25 Agt 2026, §25.2) — flag opsional, lihat catatan
          // arsitektur di atas file ini.
          pakai_lot_tracking: !!formEdit.pakai_lot_tracking,
          // BARU (25 Agt 2026, §25) — Rak Penyimpanan (ref) & Volume Barang.
          rak_id: formEdit.rak_id || '', rak_label: formEdit.rak_id ? formEdit.rak_label : '',
          tinggi_barang: parseFloat(formEdit.tinggi_barang) || 0, panjang_barang: parseFloat(formEdit.panjang_barang) || 0,
          lebar_barang: parseFloat(formEdit.lebar_barang) || 0, volume_barang: volumeBarangEdit.value,
          panjang_roll: parseFloat(formEdit.panjang_roll) || 0,
          diedit_pada: serverTimestamp(), diedit_oleh: window.currentUser?.email || null
        });
        sedangEditId.value = null;
        await paginasi.muatUlang();
      } catch (e) {
        console.error('Gagal simpan edit Bahan/Aksesoris:', e);
        alert('Gagal menyimpan perubahan. Coba lagi.');
      }
      menyimpanEdit.value = false;
    }

    async function hapus(id) {
      if (!confirm('Hapus data ini secara permanen? Nomor ID yang sudah terpakai TIDAK akan dipakai ulang.')) return;
      try {
        await deleteDoc(doc(db, 'master_bahan_aksesoris', id));
        await paginasi.muatUlang();
      } catch (e) {
        console.error('Gagal hapus Bahan/Aksesoris:', e);
        alert('Gagal menghapus data.');
      }
    }

    // --- Cetak Label (BARU 28 Agt 2026, §41.2) ------------------------------
    // GANTI dari tab tersendiri "Cetak Label" di Stock & Pembelian
    // (CetakLabelManager, DIHAPUS) jadi tombol per-kartu di sini — permintaan
    // Guru eksplisit: "cetak label pindahkan ke Data Bahan & Aksesoris >
    // List Bahan dan Aksesoris". Logic (roll-tracking vs item biasa, QR,
    // log) SAMA PERSIS seperti CetakLabelManager lama, cuma dipicu dari
    // tombol kartu (bukan search-tab terpisah) & pakai popup pratinjau BARU
    // (PopupPratinjauCetakLabel, vue-components.js — ukuran fisik 4x2 inch
    // thermal roll, ganti dari cetak langsung tanpa pratinjau).
    //
    // Izin cetak TETAP dicek lewat menu id LAMA `stock_cetak_label` (BUKAN
    // `bahan_aksesoris_list`) — SENGAJA, supaya hak akses yang SUDAH diatur
    // Owner sebelumnya (siapa boleh cetak) tidak yatim/perlu diatur ulang
    // cuma gara-gara tombolnya pindah tempat. Entrinya di DAFTAR_MENU
    // (vue-config-akses.js) ditandai `deprecated:true` (tidak lagi tampil
    // sebagai menu/tile navigasi), TAPI tetap tampil di tabel permission
    // Config Akses supaya Owner masih bisa lihat/atur kolom izinnya.
    const menuIdCetakLabel = 'stock_cetak_label';
    const bolehCetak = computed(() => window.cekIzinMenu(menuIdCetakLabel, 'print') !== false);

    const popupPilihRollAktif = ref(false);
    const itemUntukCetak = ref(null);
    const daftarLotUntukCetak = ref([]);
    const memuatLotCetak = ref(false);
    const lotDicentangCetak = reactive({});
    const lotTercentangCetak = computed(() => daftarLotUntukCetak.value.filter(l => lotDicentangCetak[l.id]));
    function toggleSemuaLotCetak(v) { daftarLotUntukCetak.value.forEach(l => { lotDicentangCetak[l.id] = v; }); }

    const popupCetakLabelAktif = ref(false);
    const daftarLabelPreview = ref([]);
    const cetakInfoAktif = ref({ namaBarang: '', jenis: '' }); // dipakai catatLogCetakLabel setelah popup emit 'cetak'

    async function bukaCetakLabel(item) {
      if (!bolehCetak.value) return;
      if (typeof QRCode === 'undefined') {
        alert('Library pembuat QR belum siap dimuat. Coba refresh halaman (Ctrl+Shift+R) lalu ulangi.');
        return;
      }
      const namaLengkap = item.nama + (item.warna ? ' ' + item.warna : '');
      if (item.pakai_lot_tracking) {
        itemUntukCetak.value = item;
        Object.keys(lotDicentangCetak).forEach(k => delete lotDicentangCetak[k]);
        daftarLotUntukCetak.value = [];
        popupPilihRollAktif.value = true;
        memuatLotCetak.value = true;
        try { daftarLotUntukCetak.value = await ambilSemuaLotByBahan(item.id); }
        catch (e) { console.error('Gagal ambil daftar lot:', e); daftarLotUntukCetak.value = []; }
        memuatLotCetak.value = false;
      } else {
        if (!item.id_tampil) return alert('Item ini belum punya ID Tampil (id_tampil kosong) — cek ulang data Bahan/Aksesorisnya.');
        cetakInfoAktif.value = { namaBarang: namaLengkap, jenis: 'item' };
        daftarLabelPreview.value = [{ kode: item.id_tampil, nama: namaLengkap, info: item.satuan_pemakaian || '', qrDataUrl: buatQrDataUrl(item.id_tampil) }];
        popupCetakLabelAktif.value = true;
      }
    }

    function lanjutCetakDariRoll() {
      if (lotTercentangCetak.value.length === 0) return alert('Centang minimal 1 roll/lot yang mau dicetak labelnya dulu.');
      const item = itemUntukCetak.value;
      const namaLengkap = item.nama + (item.warna ? ' ' + item.warna : '');
      cetakInfoAktif.value = { namaBarang: namaLengkap, jenis: 'roll' };
      daftarLabelPreview.value = lotTercentangCetak.value.map(l => ({
        kode: l.kode_lot,
        nama: namaLengkap,
        info: `${l.qty ?? l.qty_sisa ?? ''} ${item.satuan_pemakaian || ''} &middot; ${l.tanggal_masuk || ''}${l.status !== 'aktif' ? ' &middot; SUDAH HABIS (cetak ulang)' : ''}`,
        qrDataUrl: buatQrDataUrl(l.kode_lot)
      }));
      popupPilihRollAktif.value = false;
      popupCetakLabelAktif.value = true;
    }
    function tutupPopupPilihRoll() { popupPilihRollAktif.value = false; }

    // saatCetakBerhasil — dipanggil lewat event 'cetak' PopupPratinjauCetakLabel,
    // SETELAH window cetak fisik sudah dibuka. Catat 1 baris log
    // `log_cetak_label` (jumlah = banyak label unik x jumlah salinan yang
    // Guru atur di popup) — pola SAMA PERSIS `CetakLabelManager.catatLog()`
    // lama.
    async function saatCetakBerhasil(payload) {
      const jumlahTotal = daftarLabelPreview.value.length * (payload?.jumlahSalinan || 1);
      await catatLogCetakLabel(cetakInfoAktif.value.namaBarang, jumlahTotal, cetakInfoAktif.value.jenis);
      if (riwayatCetakDimuat.value) await paginasiLogCetak.muatUlang();
    }

    // --- Riwayat Cetak Label (modal on-demand, BARU §41.2) ------------------
    // DULU tabel Riwayat SELALU tampil di bawah form Cetak Label (menu
    // tersendiri). SEKARANG, karena Cetak Label jadi tombol per-kartu (List
    // Bahan & Aksesoris sudah ramai — searchbox, filter, Import Excel,
    // banyak kartu), riwayat ini dijadikan modal yang dibuka manual lewat
    // tombol "Riwayat Cetak Label" di toolbar atas — datanya (koleksi
    // `log_cetak_label`) TIDAK hilang, cuma cara lihatnya jadi on-demand.
    const riwayatCetakAktif = ref(false);
    const riwayatCetakDimuat = ref(false);
    const paginasiLogCetak = usePaginasiFirestore(db, 'log_cetak_label', {
      perHalaman: 10, urutkanField: 'tanggal', urutkanArah: 'desc', cariField: 'nama_barang',
      petakan: (id, d) => ({ id, ...d })
    });
    async function bukaRiwayatCetak() {
      riwayatCetakAktif.value = true;
      if (!riwayatCetakDimuat.value) { riwayatCetakDimuat.value = true; await paginasiLogCetak.muatUlang(); }
    }
    function formatTanggalLogCetak(ts) {
      if (ts && typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toLocaleString('id-ID');
      return '-';
    }

    // --- Import/Export Excel (BARU 28 Agt 2026, §35) -----------------------
    const dropdownImportTerbuka = ref(false);
    const inputFileBahanAksesoris = ref(null);

    const opsiJenisBahanImport = ref([]);
    const opsiJenisAksesorisImport = ref([]);
    const opsiWarnaImport = ref([]);
    const opsiSatuanImport = ref([]);
    const daftarLamaImport = ref([]); // SEMUA data (bukan cuma 1 halaman paginasi) — cek Kategori+Nama+Warna sudah ada/belum

    const popupImportAktif = ref(false);
    const barisMentahImport = ref([]);
    const sedangImport = ref(false);

    // muatSemuaReferensiImport — SELALU ambil data referensi & data
    // tersimpan TERBARU tiap kali mau import (bukan cache lama), pola sama
    // seperti Import Master Produk (§28.9).
    async function muatSemuaReferensiImport() {
      const [jenisBahan, jenisAksesoris, warna, satuan, semuaData] = await Promise.all([
        window.ambilMasterList ? window.ambilMasterList(kategoriMasterData('Bahan')) : [],
        window.ambilMasterList ? window.ambilMasterList(kategoriMasterData('Aksesoris')) : [],
        ambilDaftarNama('master_warna'),
        ambilDaftarNama('master_satuan'),
        ambilSemuaBahanAksesoris()
      ]);
      opsiJenisBahanImport.value = jenisBahan;
      opsiJenisAksesorisImport.value = jenisAksesoris;
      opsiWarnaImport.value = warna;
      opsiSatuanImport.value = satuan;
      daftarLamaImport.value = semuaData;
    }

    function bukaTemplateBahanAksesoris() { unduhTemplateBahanAksesoris(); dropdownImportTerbuka.value = false; }
    function pancingFileBahanAksesoris() { dropdownImportTerbuka.value = false; inputFileBahanAksesoris.value?.click(); }

    async function saatFileBahanAksesorisDipilih(ev) {
      const file = ev.target.files[0];
      ev.target.value = ''; // reset biar file sama bisa dipilih ulang
      if (!file) return;
      try {
        const wb = await bacaFileExcel(file);
        const baris = ambilSheet(wb, 'Bahan & Aksesoris');
        if (!baris.length) return alert('Sheet "Bahan & Aksesoris" tidak ditemukan atau kosong. Pastikan file berasal dari Template Import Bahan & Aksesoris.');
        await muatSemuaReferensiImport();
        barisMentahImport.value = baris;
        popupImportAktif.value = true;
      } catch (e) {
        console.error('Gagal baca file Bahan & Aksesoris:', e);
        alert('Gagal membaca file Excel. Pastikan formatnya benar (.xlsx).');
      }
    }

    function tutupPopupImport() { popupImportAktif.value = false; }

    // konfirmasiImportBahanAksesoris — MURNI nambah data baru (permintaan
    // Guru, dikonfirmasi lewat AskUserQuestion §35): baris yang kombinasi
    // Kategori+Nama+Warna-nya SUDAH ADA di-SKIP (tidak ditimpa sama sekali),
    // beda dari pola "Ganti Total" di Import Produk Utama (Master Produk).
    // ID dibuat lewat generateIdBerurutan() yang SAMA dipakai form Entry
    // manual (runTransaction, aman dari tabrakan counter).
    async function konfirmasiImportBahanAksesoris(barisSiap) {
      sedangImport.value = true;
      try {
        const semuaData = await ambilSemuaBahanAksesoris();
        const petaLama = new Set(semuaData.map(p => kunciBahanAksesoris(p.kategori_utama, p.nama, p.warna)));
        let dibuat = 0, dilewati = 0;
        for (const b of barisSiap) {
          const kunci = kunciBahanAksesoris(b.kategori_utama, b.nama, b.warna);
          if (petaLama.has(kunci)) { dilewati++; continue; }
          const hargaPembelian = parseFloat(b.harga_pembelian) || 0;
          const isiKonversi = parseFloat(b.isi_konversi_pembelian) || 0;
          const marginModal = parseFloat(b.margin_modal) || 0;
          const hargaModalBaris = isiKonversi > 0 ? hargaPembelian / isiKonversi : 0;
          const idBaru = await generateIdBerurutan(b.kategori_utama);
          await addDoc(collection(db, 'master_bahan_aksesoris'), {
            id_tampil: idBaru,
            kategori_utama: b.kategori_utama,
            jenis: b.jenis,
            foto: null,
            nama: b.nama,
            warna: b.warna,
            harga_pembelian: hargaPembelian,
            satuan_pembelian: b.satuan_pembelian,
            isi_konversi_pembelian: isiKonversi,
            satuan_pemakaian: b.satuan_pemakaian,
            harga_modal: hargaModalBaris,
            margin_modal: marginModal,
            harga_pemakaian: hargaModalBaris + marginModal,
            konversi_bertingkat: [],
            pakai_lot_tracking: false,
            rak_id: '', rak_label: '',
            tinggi_barang: 0, panjang_barang: 0, lebar_barang: 0, volume_barang: 0,
            dibuat_pada: serverTimestamp(),
            dibuat_oleh: window.currentUser?.email || null
          });
          petaLama.add(kunci); // jaga-jaga baris lain kunci sama (seharusnya sudah ditolak validasi "dobel di file")
          dibuat++;
        }
        popupImportAktif.value = false;
        await paginasi.muatUlang();
        alert(`Import selesai: ${dibuat} data baru ditambahkan, ${dilewati} dilewati (sudah ada).`);
      } catch (e) {
        console.error('Gagal import Bahan & Aksesoris:', e);
        alert(e.message && e.message.includes('Prefix ID') ? e.message : 'Gagal mengimpor. Coba lagi.');
      }
      sedangImport.value = false;
    }

    onMounted(async () => { await window.authReady; await paginasi.muatUlang(); });

    return {
      filterKategori, paginasi, formatRupiah, formatQty,
      sedangEditId, formEdit, opsiJenisEdit, opsiSatuanEdit, opsiWarnaEdit,
      opsiRakEdit, rakDipilihEdit, volumeBarangEdit,
      menyimpanEdit, hargaModalEdit, hargaPemakaianEdit,
      bukaEdit, batalEdit, pilihFotoEdit, simpanEdit, hapus,
      tampilPopupKonversiEdit: konversiEdit.tampilPopupKonversi, barisKonversiEdit: konversiEdit.barisKonversi,
      bukaPopupKonversiEdit: konversiEdit.bukaPopupKonversi, tutupPopupKonversiEdit: konversiEdit.tutupPopupKonversi,
      tambahBarisKonversiEdit: konversiEdit.tambahBarisKonversi, hapusBarisKonversiEdit: konversiEdit.hapusBarisKonversi,
      totalKonversiBerjenjangEdit: konversiEdit.totalKonversiBerjenjang, terapkanKonversiEdit: konversiEdit.terapkanKonversi,
      hapusKonversiBertingkatEdit: konversiEdit.hapusKonversiBertingkat,
      dropdownImportTerbuka, inputFileBahanAksesoris,
      opsiJenisBahanImport, opsiJenisAksesorisImport, opsiWarnaImport, opsiSatuanImport, daftarLamaImport,
      popupImportAktif, barisMentahImport, sedangImport,
      bukaTemplateBahanAksesoris, pancingFileBahanAksesoris, saatFileBahanAksesorisDipilih,
      tutupPopupImport, konfirmasiImportBahanAksesoris,
      bolehCetak, popupPilihRollAktif, daftarLotUntukCetak, memuatLotCetak, lotDicentangCetak,
      lotTercentangCetak, toggleSemuaLotCetak, itemUntukCetak,
      popupCetakLabelAktif, daftarLabelPreview, bukaCetakLabel, lanjutCetakDariRoll, tutupPopupPilihRoll, saatCetakBerhasil,
      riwayatCetakAktif, paginasiLogCetak, bukaRiwayatCetak, formatTanggalLogCetak
    };
  },
  template: `
    <div style="display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap:wrap;">
      <div style="position:relative; flex:1; min-width:220px;">
        <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
        <input :value="paginasi.cariTeks.value" @input="paginasi.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari nama (awalan)..." style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
      </div>
      <select v-model="filterKategori" style="padding:9px 13px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
        <option value="ALL">Semua Kategori</option>
        <option value="Bahan">Bahan</option>
        <option value="Aksesoris">Aksesoris</option>
      </select>
      <!-- BARU (28 Agt 2026, §35) — Import/Template Excel, pola sama persis
           seperti "Import / Template Excel" di List Produk (Master Produk,
           §28.9). -->
      <div style="position:relative;">
        <button @click="dropdownImportTerbuka = !dropdownImportTerbuka" type="button" class="btn-outline" style="font-size:12px;">
          <i class="fas fa-file-excel" style="margin-right:6px;"></i>Import / Template Excel <i class="fas fa-chevron-down" style="margin-left:6px; font-size:9px;"></i>
        </button>
        <div v-if="dropdownImportTerbuka" @click="dropdownImportTerbuka = false" style="position:fixed; inset:0; z-index:15;"></div>
        <div v-if="dropdownImportTerbuka" style="position:absolute; top:calc(100% + 6px); left:0; z-index:20; background:var(--surface); border:1px solid var(--line); border-radius:12px; box-shadow:0 6px 18px rgba(0,0,0,.12); min-width:250px; padding:6px; display:flex; flex-direction:column;">
          <button @click="bukaTemplateBahanAksesoris" type="button" class="btn-ghost" style="text-align:left; padding:8px 10px; font-size:12.5px; border-radius:8px;"><i class="fas fa-download" style="margin-right:8px; width:14px;"></i>Download Template</button>
          <button @click="pancingFileBahanAksesoris" type="button" class="btn-ghost" style="text-align:left; padding:8px 10px; font-size:12.5px; border-radius:8px;"><i class="fas fa-upload" style="margin-right:8px; width:14px;"></i>Import Excel (Upload Massal)</button>
        </div>
      </div>
      <input ref="inputFileBahanAksesoris" type="file" accept=".xlsx,.xls" @change="saatFileBahanAksesorisDipilih" style="display:none;">
      <!-- BARU (28 Agt 2026, §41.2) — Riwayat Cetak Label, dulu SELALU
           tampil di bawah tab "Cetak Label" tersendiri (Stock & Pembelian,
           DIHAPUS), sekarang modal on-demand di sini (tombol cetak per
           kartu sekarang ada di bawah, lihat blok kartu). -->
      <button v-if="bolehCetak" @click="bukaRiwayatCetak" type="button" class="btn-outline" style="font-size:12px;"><i class="fas fa-clock-rotate-left" style="margin-right:6px;"></i>Riwayat Cetak Label</button>
    </div>

    <!-- GANTI (28 Agt 2026, §39) — dulu tabel scroll horizontal (12 kolom),
         SEKARANG kartu (pola SAMA seperti List Produk §30) — permintaan
         Guru: "Data Bahan & Aksesoris" eksplisit disebut jadi salah satu
         tabel yang dijadikan Kartu, di HP MAUPUN desktop (bukan cuma HP). -->
    <div v-if="paginasi.memuat.value" class="gc-card" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <div v-else-if="paginasi.errorPaginasi.value" class="gc-card" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasi.errorPaginasi.value }}</div>
    <div v-else-if="paginasi.dataHalaman.value.length === 0" class="gc-card" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada data.</div>
    <div v-else style="display:flex; flex-direction:column; gap:10px;">
      <div v-for="item in paginasi.dataHalaman.value" :key="item.id" class="gc-card" style="padding:14px;">
        <div style="display:flex; gap:12px; align-items:flex-start; margin-bottom:12px;">
          <img v-if="item.foto" :src="item.foto" style="width:52px; height:52px; object-fit:cover; border-radius:10px; flex-shrink:0;">
          <div v-else style="width:52px; height:52px; border-radius:10px; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; flex-shrink:0;"><i class="fas fa-image" style="color:var(--text-faint); font-size:15px;"></i></div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:13.5px;">{{ item.nama }} <i v-if="item.pakai_lot_tracking" class="fas fa-layer-group" style="color:var(--burgundy); font-size:10px;" title="Perlu Qty per Roll/Lot saat diterima"></i></div>
            <div style="font-size:11.5px; color:var(--text-muted);">{{ item.warna }}</div>
            <div style="font-size:10.5px; color:var(--text-faint); margin-top:2px;">{{ item.id_tampil || '-' }} &middot; {{ item.dibuat_pada?.toDate ? item.dibuat_pada.toDate().toLocaleDateString('id-ID') : '-' }}</div>
          </div>
          <span class="tag neutral" style="flex-shrink:0;">{{ item.kategori_utama }}<span v-if="item.jenis"> &middot; {{ item.jenis }}</span></span>
        </div>

        <div style="display:grid; gap:8px; margin-bottom:10px;" class="grid-cols-2 md:grid-cols-4">
          <div><span style="font-size:10px; color:var(--text-faint); display:block;">Beli</span><b style="font-size:12.5px;">{{ formatRupiah(item.harga_pembelian) }}</b><span style="font-size:10.5px; color:var(--text-muted);"> / {{ item.satuan_pembelian }}</span></div>
          <div><span style="font-size:10px; color:var(--text-faint); display:block;">Modal</span><b style="font-size:12.5px;">{{ formatRupiah(item.harga_modal) }}</b></div>
          <div><span style="font-size:10px; color:var(--text-faint); display:block;">Margin</span><b style="font-size:12.5px;">{{ formatRupiah(item.margin_modal) }}</b></div>
          <div><span style="font-size:10px; color:var(--text-faint); display:block;">Harga Pakai</span><b style="font-size:12.5px; color:var(--burgundy);">{{ formatRupiah(item.harga_pemakaian) }}</b></div>
        </div>

        <div class="kartu-rows" style="display:flex; flex-direction:column; gap:5px; background:var(--ivory-dim); border-radius:10px; padding:10px 12px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Konversi</span><span style="font-weight:700;">{{ item.isi_konversi_pembelian }} {{ item.satuan_pemakaian }} / {{ item.satuan_pembelian }}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Stok Akhir</span><span style="font-weight:700;">{{ formatQty(item.stok_akhir) }} {{ item.satuan_pemakaian }}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Rak / Volume</span><span style="font-weight:700;">{{ item.rak_label || '-' }}<span v-if="item.volume_barang"> &middot; {{ formatQty(item.volume_barang) }} cm&sup3;</span></span></div>
        </div>

        <div style="display:flex; gap:8px;">
          <button @click="bukaEdit(item)" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 12px;"><i class="fas fa-pen" style="margin-right:6px;"></i>Edit</button>
          <!-- BARU (28 Agt 2026, §41.2, permintaan Guru) — Cetak Label
               pindah ke sini, dulu tab tersendiri di Stock & Pembelian. -->
          <button v-if="bolehCetak" @click="bukaCetakLabel(item)" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 12px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Label</button>
          <button @click="hapus(item.id)" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 12px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-trash-alt" style="margin-right:6px;"></i>Hapus</button>
        </div>
      </div>
    </div>
    <div v-if="!paginasi.memuat.value && paginasi.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
      <button class="icon-btn" :disabled="paginasi.nomorHalaman.value <= 1" @click="paginasi.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
      <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasi.nomorHalaman.value }}</span>
      <button class="icon-btn" :disabled="!paginasi.adaBerikutnya.value" @click="paginasi.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
    </div>

    <div v-if="sedangEditId" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="batalEdit">
      <div class="gc-card" style="max-width:560px; width:100%; max-height:90vh; overflow-y:auto;">
        <h3 style="font-weight:700; font-size:14px; margin-bottom:14px;">Edit Bahan / Aksesoris</h3>
        <div style="display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-2">
          <div class="gc-field">
            <label>Jenis</label>
            <dropdown-cari v-model="formEdit.jenis" :opsi="opsiJenisEdit" placeholder="Cari & pilih Jenis..." />
          </div>
          <div class="gc-field"><label>Foto</label><input type="file" accept="image/*" @change="pilihFotoEdit"></div>
          <div class="gc-field"><label>Nama</label><input v-model="formEdit.nama" type="text"></div>
          <div class="gc-field"><label>Warna</label><dropdown-cari v-model="formEdit.warna" :opsi="opsiWarnaEdit" placeholder="Cari & pilih Warna..." /></div>
        </div>
        <div v-if="formEdit.foto" style="margin-bottom:12px;"><img :src="formEdit.foto" style="width:70px; height:70px; object-fit:cover; border-radius:10px; border:1.5px solid var(--line);"></div>
        <div v-if="!(formEdit.konversi_bertingkat && formEdit.konversi_bertingkat.length > 0)" style="display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-4">
          <div class="gc-field"><label>Harga Pembelian (Rp)</label><input v-model.number="formEdit.harga_pembelian" type="number" min="0"></div>
          <div class="gc-field"><label>Satuan Pembelian</label><dropdown-cari v-model="formEdit.satuan_pembelian" :opsi="opsiSatuanEdit" placeholder="Cari & pilih Satuan..." /></div>
          <div class="gc-field">
            <label>Isi Konversi Pembelian</label>
            <input v-model.number="formEdit.isi_konversi_pembelian" type="number" min="0">
          </div>
          <div class="gc-field"><label>Satuan Pemakaian</label><dropdown-cari v-model="formEdit.satuan_pemakaian" :opsi="opsiSatuanEdit" placeholder="Cari & pilih Satuan..." /></div>
        </div>

        <div v-else style="background:var(--ivory-dim); border-radius:12px; padding:14px 16px; margin-bottom:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <b style="font-size:12.5px;"><i class="fas fa-calculator" style="color:var(--burgundy); margin-right:6px;"></i>Konversi Banyak Tingkat aktif</b>
            <div style="display:flex; gap:6px;">
              <button @click="bukaPopupKonversiEdit" class="icon-btn" title="Ubah Konversi Banyak Tingkat"><i class="fas fa-pen"></i></button>
              <button @click="hapusKonversiBertingkatEdit" class="icon-btn" style="color:var(--danger);" title="Hapus & isi manual"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <p style="font-size:11.5px; margin-bottom:4px;">Harga Pembelian: <b>{{ formatRupiah(formEdit.harga_pembelian) }}</b></p>
          <p style="font-size:11.5px; color:var(--text-muted);">Rincian: {{ formEdit.konversi_bertingkat.map(b => '1 ' + b.dari + ' = ' + b.jumlah + ' ' + b.ke + (b.harga ? ' (' + formatRupiah(b.harga) + '/' + b.dari + ')' : '')).join(', ') }}</p>
          <p style="font-size:11.5px; margin-top:4px;">Isi Konversi Pembelian: <b>{{ formEdit.isi_konversi_pembelian }}</b> &middot; Satuan Pemakaian: <b>{{ formEdit.satuan_pemakaian }}</b></p>
        </div>

        <!-- BARU (25 Agt 2026) — tombol Konversi Banyak Tingkat DIPINDAH,
             sama seperti di form Entry (lihat catatan di sana). -->
        <div v-if="!(formEdit.konversi_bertingkat && formEdit.konversi_bertingkat.length > 0)" style="margin-top:10px;">
          <button @click="bukaPopupKonversiEdit" class="btn-outline" style="white-space:nowrap; padding:0 16px; height:44px;"><i class="fas fa-calculator" style="margin-right:6px;"></i>Konversi Banyak Tingkat</button>
        </div>

        <!-- BARU (25 Agt 2026, §25.2) — flag opsional, sama seperti form Entry. -->
        <div class="gc-field" style="margin-top:12px;">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:400;">
            <input type="checkbox" v-model="formEdit.pakai_lot_tracking" style="accent-color:var(--burgundy); width:16px; height:16px;">
            <span>Perlu Qty per Roll/Lot saat diterima (mis. bahan berbentuk Roll/Kones)</span>
          </label>
        </div>

        <!-- BARU (25 Agt 2026, §25) — Rak Penyimpanan sekarang 1 dropdown
             pilih Rak terdaftar, sama seperti form Entry (lihat catatan
             di sana). -->
        <p style="font-size:11.5px; font-weight:700; color:var(--text-muted); margin:16px 0 8px;"><i class="fas fa-warehouse" style="margin-right:6px;"></i>Rak Penyimpanan (opsional)</p>
        <div class="gc-field">
          <label>Pilih Rak</label>
          <dropdown-cari v-model="formEdit.rak_label" :opsi="opsiRakEdit" placeholder="Cari & pilih Rak..." />
          <p v-if="rakDipilihEdit" style="font-size:10.5px; color:var(--text-faint); margin-top:4px;">Dimensi Rak: {{ formatQty(rakDipilihEdit.tinggi_rak) }} &times; {{ formatQty(rakDipilihEdit.panjang_rak) }} &times; {{ formatQty(rakDipilihEdit.lebar_rak) }} cm &middot; Kapasitas: {{ formatQty(rakDipilihEdit.volume_rak) }} cm&sup3;</p>
        </div>

        <p style="font-size:11.5px; font-weight:700; color:var(--text-muted); margin:14px 0 8px;"><i class="fas fa-cube" style="margin-right:6px;"></i>Volume Barang (opsional) — untuk hitung kapasitas rak, cegah over stok</p>
        <div style="display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-3">
          <div class="gc-field">
            <label>Tinggi (cm)</label>
            <input v-model.number="formEdit.tinggi_barang" type="number" min="0" placeholder="0">
          </div>
          <div class="gc-field">
            <label>Panjang (cm)</label>
            <input v-model.number="formEdit.panjang_barang" type="number" min="0" placeholder="0">
          </div>
          <div class="gc-field">
            <label>Lebar (cm)</label>
            <input v-model.number="formEdit.lebar_barang" type="number" min="0" placeholder="0">
          </div>
        </div>
        <p style="font-size:11px; color:var(--text-faint); margin:2px 0 0;">Volume (otomatis): <b>{{ volumeBarangEdit.toLocaleString('id-ID') }} cm&sup3;</b> per {{ formEdit.satuan_pemakaian || 'satuan pemakaian' }}</p>

        <div class="gc-field" style="margin-top:14px;">
          <label>Panjang 1 Roll (meter) <span style="font-size:10px; color:var(--text-faint); font-weight:400;">— opsional, dasar hitung kolom "roll" Acc Webbing</span></label>
          <input v-model.number="formEdit.panjang_roll" type="number" min="0" placeholder="0">
        </div>

        <div class="gc-field" style="margin-top:16px;">
          <label>Margin Modal (Rp)</label><input v-model.number="formEdit.margin_modal" type="number" min="0">
        </div>
        <div style="background:var(--ivory-dim); border-radius:12px; padding:12px 16px; display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:16px 0;">
          <div><span style="font-size:10.5px; color:var(--text-faint); display:block;">Harga Modal (otomatis)</span><b>{{ formatRupiah(hargaModalEdit) }}</b></div>
          <div><span style="font-size:10.5px; color:var(--text-faint); display:block;">Harga Pemakaian (otomatis)</span><b style="color:var(--burgundy);">{{ formatRupiah(hargaPemakaianEdit) }}</b></div>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="simpanEdit" :disabled="menyimpanEdit" class="btn-primary" style="flex:1;">{{ menyimpanEdit ? 'Menyimpan...' : 'Simpan Perubahan' }}</button>
          <button @click="batalEdit" class="btn-outline" style="flex:1;">Batal</button>
        </div>
      </div>
    </div>
    <popup-konversi-berjenjang v-if="tampilPopupKonversiEdit" :baris="barisKonversiEdit" :total="totalKonversiBerjenjangEdit" :opsi-satuan="opsiSatuanEdit"
      @tambah="tambahBarisKonversiEdit" @hapus="hapusBarisKonversiEdit" @terapkan="terapkanKonversiEdit" @tutup="tutupPopupKonversiEdit" />

    <popup-import-bahan-aksesoris
      v-if="popupImportAktif"
      :baris-mentah="barisMentahImport"
      :opsi-jenis-bahan="opsiJenisBahanImport"
      :opsi-jenis-aksesoris="opsiJenisAksesorisImport"
      :opsi-warna="opsiWarnaImport"
      :opsi-satuan="opsiSatuanImport"
      :daftar-lama="daftarLamaImport"
      :sedang-import="sedangImport"
      @tutup="tutupPopupImport"
      @konfirmasi="konfirmasiImportBahanAksesoris" />

    <!-- BARU (28 Agt 2026, §41.2) — popup pilih roll/lot SEBELUM cetak,
         cuma muncul buat item 'pakai_lot_tracking'. Item biasa (bukan lot)
         LANGSUNG lompat ke popup-pratinjau-cetak-label di bawah, tanpa
         lewat popup ini sama sekali (lihat bukaCetakLabel()). -->
    <div v-if="popupPilihRollAktif" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9998; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="tutupPopupPilihRoll">
      <div class="gc-card" style="max-width:520px; width:100%; max-height:90vh; overflow-y:auto;">
        <h3 style="font-weight:700; font-size:14px; margin-bottom:4px;">Pilih Roll/Lot untuk Dicetak</h3>
        <p style="font-size:11px; color:var(--text-faint); margin-bottom:12px;">{{ itemUntukCetak ? (itemUntukCetak.nama + (itemUntukCetak.warna ? ' ' + itemUntukCetak.warna : '')) : '' }} — item ini pakai Qty per Roll/Lot. Centang roll yang mau dicetak labelnya (termasuk yang sudah habis, kalau labelnya hilang dan mau dicetak ulang).</p>

        <div v-if="memuatLotCetak" style="font-size:12px; color:var(--text-faint); padding:8px 0;">Memuat daftar roll/lot...</div>
        <div v-else-if="daftarLotUntukCetak.length === 0" style="font-size:12px; color:var(--text-faint); padding:8px 0;">Belum ada roll/lot tercatat untuk item ini.</div>
        <div v-else style="overflow-x:auto; margin-bottom:12px;">
          <div style="margin-bottom:6px;">
            <button @click="toggleSemuaLotCetak(true)" class="btn-outline" style="padding:4px 10px; font-size:11px; margin-right:6px;">Pilih Semua</button>
            <button @click="toggleSemuaLotCetak(false)" class="btn-outline" style="padding:4px 10px; font-size:11px;">Kosongkan</button>
          </div>
          <table class="gc-table" style="width:100%; font-size:11.5px;">
            <thead><tr><th style="width:32px;"></th><th>Kode Lot</th><th>Qty Sisa</th><th>Tanggal Masuk</th><th>Status</th></tr></thead>
            <tbody>
              <tr v-for="l in daftarLotUntukCetak" :key="l.id">
                <td><input type="checkbox" v-model="lotDicentangCetak[l.id]" style="accent-color:var(--burgundy); width:14px; height:14px;"></td>
                <td>{{ l.kode_lot }}</td>
                <td>{{ l.qty_sisa ?? l.qty ?? '-' }}</td>
                <td>{{ l.tanggal_masuk || '-' }}</td>
                <td><span class="tag" :class="l.status === 'aktif' ? 'ok' : 'neutral'">{{ l.status === 'aktif' ? 'Aktif' : 'Habis' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="display:flex; gap:8px;">
          <button @click="lanjutCetakDariRoll" :disabled="lotTercentangCetak.length === 0" class="btn-primary" style="flex:1;">Lanjut ke Pratinjau ({{ lotTercentangCetak.length }})</button>
          <button @click="tutupPopupPilihRoll" type="button" class="btn-outline" style="flex:1;">Batal</button>
        </div>
      </div>
    </div>

    <popup-pratinjau-cetak-label :terbuka="popupCetakLabelAktif" judul="Cetak Label" :daftar-label="daftarLabelPreview" @tutup="popupCetakLabelAktif = false" @cetak="saatCetakBerhasil" />

    <!-- BARU (28 Agt 2026, §41.2) — Riwayat Cetak Label, modal on-demand
         (lihat catatan di tombol toolbar-nya di atas). -->
    <div v-if="riwayatCetakAktif" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9997; display:flex; align-items:flex-start; justify-content:center; padding:16px; overflow-y:auto;" @click.self="riwayatCetakAktif = false">
      <div class="gc-card" style="max-width:560px; width:100%; margin:24px 0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <h3 style="font-weight:700; font-size:14px;">Riwayat Cetak Label</h3>
          <button @click="riwayatCetakAktif = false" style="background:none; border:none; color:var(--text-faint); font-size:16px; cursor:pointer;"><i class="fas fa-times"></i></button>
        </div>
        <div style="position:relative; max-width:320px; margin-bottom:12px;">
          <i class="fas fa-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-faint); font-size:12px;"></i>
          <input :value="paginasiLogCetak.cariTeks.value" @input="paginasiLogCetak.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari nama barang (awalan)..." style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
        </div>
        <div v-if="paginasiLogCetak.memuat.value" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
        <div v-else-if="paginasiLogCetak.errorPaginasi.value" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasiLogCetak.errorPaginasi.value }}</div>
        <div v-else-if="paginasiLogCetak.dataHalaman.value.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada riwayat cetak label.</div>
        <div v-else style="display:flex; flex-direction:column; gap:10px;">
          <div v-for="r in paginasiLogCetak.dataHalaman.value" :key="r.id" class="gc-card" style="padding:14px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:10px;">
              <div style="font-weight:700; font-size:13.5px;">{{ r.nama_barang }}</div>
              <span class="tag neutral" style="flex-shrink:0;">{{ r.jenis === 'roll' ? 'Roll/Lot' : 'Item' }}</span>
            </div>
            <div class="kartu-rows" style="display:flex; flex-direction:column; gap:5px; background:var(--ivory-dim); border-radius:10px; padding:10px 12px;">
              <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Tanggal</span><span style="font-weight:700;">{{ formatTanggalLogCetak(r.tanggal) }}</span></div>
              <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Jumlah Label</span><span style="font-weight:700;">{{ r.jumlah_label }}</span></div>
              <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Dicetak Oleh</span><span style="font-weight:700;">{{ r.dicetak_oleh || '-' }}</span></div>
            </div>
          </div>
        </div>
        <div v-if="!paginasiLogCetak.memuat.value && paginasiLogCetak.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
          <button class="icon-btn" :disabled="paginasiLogCetak.nomorHalaman.value <= 1" @click="paginasiLogCetak.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
          <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasiLogCetak.nomorHalaman.value }}</span>
          <button class="icon-btn" :disabled="!paginasiLogCetak.adaBerikutnya.value" @click="paginasiLogCetak.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
        </div>
      </div>
    </div>
  `
};

const AppBahanAksesorisEntry = { components: { BahanAksesorisEntryManager }, template: `<bahan-aksesoris-entry-manager />` };
let vmBahanAksesorisEntry = null;
window.pastikanMountBahanAksesorisEntry = function() {
  if (vmBahanAksesorisEntry) return;
  const mountPoint = document.getElementById('vue-bahan-aksesoris-entry');
  if (mountPoint) vmBahanAksesorisEntry = createApp(AppBahanAksesorisEntry).mount('#vue-bahan-aksesoris-entry');
};

const AppBahanAksesorisList = { components: { BahanAksesorisListManager }, template: `<bahan-aksesoris-list-manager />` };
let vmBahanAksesorisList = null;
window.pastikanMountBahanAksesorisList = function() {
  if (vmBahanAksesorisList) return;
  const mountPoint = document.getElementById('vue-bahan-aksesoris-list');
  if (mountPoint) vmBahanAksesorisList = createApp(AppBahanAksesorisList).mount('#vue-bahan-aksesoris-list');
};
