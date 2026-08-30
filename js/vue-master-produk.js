// js/vue-master-produk.js
// ============================================================================
// Zevanic House > Master Produk — fitur BARU (27 Agt 2026, §28), Bill of
// Material (BOM) untuk produksi konveksi. Dasar dari mockup React yang
// dikirim Hilman (mockupformbomproduk.jsx), diskusikan & disepakati lewat
// 4 ronde AskUserQuestion sebelum ditulis (lihat STATUS-PROYEK.md §28 untuk
// catatan lengkap keputusan). Ringkasan keputusan kunci yang membentuk kode
// di bawah:
//   1. SEMUA field "Nama Bahan/Aksesoris/Komponen" WAJIB pilih dari Data
//      Bahan & Aksesoris (master_bahan_aksesoris) lewat DropdownCari —
//      TIDAK BOLEH teks bebas. Pola resolve nama->id SAMA seperti
//      js/vue-persiapan-masalah.js. ⚠️ Kode Webbing 2/3 DULU juga ikut
//      aturan ini — SUPERSEDE (28 Agt 2026, §38): SEKARANG teks bebas
//      (input manual), lihat catatan poin 6 di bawah.
//   2. Tujuannya fondasi produksi (nanti dipakai potong stok otomatis) —
//      BUKAN cuma dokumentasi, makanya link ke master_bahan_aksesoris
//      di atas WAJIB (bukan opsional) supaya datanya bisa disambung nanti.
//   3. BOM Pola & BOM Vendor DIGABUNG jadi 1 tab dengan toggle Internal/
//      Vendor PER BARIS (beda dari mockup yang pisah 2 tab) — field jenis
//      vendor cuma tampil kalau baris itu ditandai Vendor.
//   4. Foto (produk & tiap baris Pola/Vendor) pakai Firebase Storage
//      (path `master_produk/{id}/...`), BUKAN base64-in-Firestore seperti
//      modul lain — ini modul KEDUA yang pakai Storage (sebelumnya cuma
//      pengumuman, lihat js/vue-config-info.js buat pola upload yang sama
//      dipakai di sini). Storage Rules-nya baru (belum ada sebelumnya),
//      lihat storage.rules di root repo — WAJIB ditempel manual di Firebase
//      Console > Storage > Rules (sama seperti alur firestore.rules).
//   5. SKU: field TERSENDIRI (bukan cuma string tampilan turunan seperti di
//      mockup), WAJIB unik (dicek query sebelum simpan, pola SAMA seperti
//      cekNoSpkDobel() di js/vue-order-spk.js). SENGAJA TIDAK pakai id_
//      tampil sekuensial (mis. PRD-0001) seperti master_bahan_aksesoris —
//      SKU inilah kode utamanya, sesuai desain mockup asli, supaya tidak
//      dobel-kode yang membingungkan. GANTI (28 Agt 2026, permintaan
//      Hilman): dulu otomatis dari Nama-Warna-Size TAPI boleh diedit manual
//      — SEKARANG FULL OTOMATIS, user/admin TIDAK ENTRY SKU SAMA SEKALI
//      (form Entry Produk maupun Import Excel), field-nya read-only. Kalau
//      basis Nama-Warna-Size tabrakan dengan produk lain, sistem sendiri
//      yang nambah akhiran -2/-3/dst (lihat kunciProduk/buatSkuUnikAsync).
//   6. "Isi Pola (Pcs)" = hasil potong per pcs produk jadi dari 1x potong
//      pola itu. "Kode Webbing 2/3" DULU referensi ke aksesoris/bahan lain
//      (DropdownCari, opsional) — SUPERSEDE (28 Agt 2026, §38, permintaan
//      Guru): SEKARANG input teks manual/bebas, TIDAK ADA LAGI FK ke
//      master_bahan_aksesoris untuk 2 field ini (form maupun Excel Import
//      BOM sheet Aksesoris — keduanya ikut diubah, dikonfirmasi Guru).
//   7. Posisi menu: Zevanic House > setelah "Stock & Pembelian", sebelum
//      "Order SPK".
//   8. Dikerjakan SEKALIGUS SEMUA (bukan bertahap) — keputusan eksplisit
//      Hilman, BUKAN saran default (saran awal Claude adalah bertahap).
//
// CATATAN GRID RESPONSIVE (support mobile+desktop, wajib per permintaan
// Hilman): modul-modul LAIN di app ini (vue-bahan-aksesoris.js, vue-order-
// spk.js) pakai `style="display:grid; grid-template-columns:...;"` INLINE
// BERSAMAAN dengan class `grid-cols-1 md:grid-cols-N` — secara CSS
// specificity, style inline itu SELALU menang atas class, jadi class
// grid-cols-nya sebenarnya TIDAK PERNAH benar-benar aktif (grid tetap multi-
// kolom di HP). Di file INI classnya dipakai TANPA grid-template-columns
// inline (cuma `display:grid` + `gap` inline, kolom count murni dari class
// grid-cols-1/md:grid-cols-N) — supaya BENAR-BENAR collapse ke 1 kolom di
// HP. Lihat STATUS-PROYEK.md §28 kalau mau samakan pola ini ke modul lama.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, doc, setDoc, updateDoc, deleteDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { db, storage } from "./firebase-config.js";
import { DropdownCari } from './vue-components.js?v=3';
import { usePaginasiFirestore } from './vue-paginasi.js?v=1';
import { pakaiRiwayatTabVue } from './vue-riwayat-tab.js?v=1';

// ambilDaftarBahanAksesorisLengkap — disalin (bukan diimpor silang) dari
// pola yang sama di js/vue-persiapan-masalah.js / vue-stock-pembelian.js /
// vue-scan-opname.js / vue-scan-persiapan.js — tiap file berdiri sendiri.
async function ambilDaftarBahanAksesorisLengkap() {
  try {
    const snap = await getDocs(collection(db, 'master_bahan_aksesoris'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    return list;
  } catch (e) {
    console.error('Gagal ambil daftar Bahan/Aksesoris:', e);
    return [];
  }
}

// ambilDaftarNama — pola SAMA seperti js/vue-bahan-aksesoris.js, dipakai
// buat opsi DropdownCari Warna (master_warna) & Satuan (master_satuan).
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

// formatNamaBahan — disalin (bukan diimpor silang) dari js/vue-stock-
// pembelian.js: gabung nama+warna jadi 1 string tampilan/pilihan, mis.
// "Kain Katun Merah". WAJIB dipakai (bukan b.nama polos) karena item
// Bahan/Aksesoris yang NAMANYA sama tapi WARNA beda itu NORMAL (warna
// field terpisah di Data Bahan & Aksesoris) — kalau opsi dropdown &
// resolveBahan cuma pakai nama polos, varian-varian warna itu TIDAK BISA
// dibedakan di dropdown, dan .find() selalu ambil hasil PERTAMA yang
// cocok (silent bug, bisa nyantol ke warna yang salah). DIPERBAIKI
// (28 Agt 2026, atas masukan Hilman) — sebelumnya modul ini pakai b.nama
// polos + field "Warna Bahan"/"Warna" terpisah, sekarang digabung jadi 1
// field pilihan, sama seperti bug yang sudah lebih dulu diperbaiki di
// vue-stock-pembelian.js (§25.7/§25.11).
function formatNamaBahan(b) {
  return (b.nama || '') + (b.warna ? ` ${b.warna}` : '');
}

// resolveBahan — cari item Bahan/Aksesoris yang KOMBINASI nama+warna-nya
// (lewat formatNamaBahan) persis cocok dengan teks yang dipilih lewat
// DropdownCari. Dipakai buat validasi "wajib pilih dari daftar, bukan
// teks bebas" (keputusan #1) di setiap baris BOM.
function resolveBahan(daftarBahan, namaText) {
  if (!namaText) return null;
  return daftarBahan.find(b => formatNamaBahan(b) === namaText) || null;
}

// --- Kompresi & upload foto ke Firebase Storage --------------------------
// Kompresi sisi klien pakai <canvas> (pola SAMA seperti kompresGambarBahan
// di vue-bahan-aksesoris.js — 500px/kualitas 0.65, foto katalog/dokumentasi
// bukan bukti resolusi tinggi) tapi hasil akhirnya Blob (bukan dataURL)
// karena tujuannya diupload ke Storage, bukan disimpan langsung di field
// Firestore (keputusan #4).
function kompresFotoKeBlob(file, maxDimensi, kualitas) {
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
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Gagal buat blob foto')), 'image/jpeg', kualitas);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// uploadFotoProduk — path pattern SAMA seperti js/vue-config-info.js
// (`pengumuman/{id}/media_{timestamp}.{ext}`), disesuaikan jadi
// `master_produk/{produkId}/{segmen}_{timestamp}.jpg`.
async function uploadFotoProduk(produkId, segmen, file) {
  const blob = await kompresFotoKeBlob(file, 700, 0.7);
  const pathFile = `master_produk/${produkId}/${segmen}_${Date.now()}.jpg`;
  const refFile = storageRef(storage, pathFile);
  await uploadBytes(refFile, blob);
  return await getDownloadURL(refFile);
}
async function hapusFotoProdukLama(url) {
  if (!url) return;
  try { await deleteObject(storageRef(storage, url)); } catch (e) { /* file lama mungkin sudah tidak ada, abaikan */ }
}

function buatSkuOtomatis(nama, warna, size) {
  return [nama, warna, size].filter(Boolean).join('-').toUpperCase().replace(/\s+/g, '');
}

// kunciProduk — GANTI (28 Agt 2026, permintaan Hilman): SKU SEKARANG full
// otomatis, user/admin TIDAK ENTRY SKU SAMA SEKALI (baik di form Entry
// Produk maupun Import Excel) — dulu boleh diedit manual, sekarang tidak
// bisa lagi. Konsekuensinya identitas produk yang dipegang USER bergeser
// dari SKU ke kombinasi Nama+Warna+Size (bahan baku SKU otomatis itu
// sendiri). Dipakai buat mencocokkan produk yang SAMA (update lama vs buat
// baru) di form Entry Produk (implisit, lewat idProduk) maupun Import Excel
// (Produk Utama & BOM) — GANTI TOTAL dari pola lama yang mencocokkan by SKU.
function kunciProduk(nama, warna, size) {
  return [nama, warna, size].map(v => (v || '').toString().trim().toLowerCase()).join('||');
}

// gcd2/lcm2/hitungKelipatan — BARU (28 Agt 2026, permintaan Guru): field
// "Kelipatan" di Data Produk Utama. Guru: "kelipatan ini tarikan dari
// kelipatan terkecil dari isi pola dari semua nama pola" — ini istilah
// matematika Indonesia "KPK" (Kelipatan Persekutuan Terkecil = LCM),
// BUKAN FPB/GCD. Tiap baris BOM Pola (`bom_pola`) punya `isi_pola_pcs`
// (hasil potong per pcs produk buat pola itu) — misal Pola A hasil 12
// pcs/potong, Pola B hasil 8 pcs/potong: order/produksi HARUS kelipatan
// KPK(12,8) = 24 pcs supaya SEMUA pola bisa dipotong genap tanpa sisa
// (tidak ada pola yang motong "setengah" karena qty tidak pas). Baris
// dengan Isi Pola (Pcs) kosong/0 (mis. baris tipe Vendor yang belum
// diisi, atau baris kosong) DIABAIKAN — tidak ikut dihitung, tidak
// menggagalkan hitungan baris lain. Dipakai live-preview di form Entry
// (lihat kelipatanLive di FormEntryProdukBOM) DAN disimpan permanen ke
// field `kelipatan` (payload simpan()) — sama pola "computed tapi
// disimpan" seperti volume_barang/harga_modal di tempat lain, supaya
// Order SPK (js/vue-order-spk.js) bisa BACA LANGSUNG tanpa perlu hitung
// ulang BOM tiap produk cuma buat tampilkan acuan minimal order.
function gcd2(a, b) {
  a = Math.round(Math.abs(a)); b = Math.round(Math.abs(b));
  while (b) { [a, b] = [b, a % b]; }
  return a;
}
function lcm2(a, b) {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd2(a, b);
}
function hitungKelipatan(bomPola) {
  const nilai = (bomPola || []).map(b => parseFloat(b.isi_pola_pcs) || 0).filter(n => n > 0);
  if (nilai.length === 0) return 0;
  return nilai.reduce((a, b) => lcm2(a, b));
}

// cekSkuDobel — pola SAMA seperti cekNoSpkDobel() di js/vue-order-spk.js.
async function cekSkuDobel(sku, idSedangEdit) {
  const q = query(collection(db, 'master_produk'), where('sku', '==', sku));
  const snap = await getDocs(q);
  return snap.docs.some(d => d.id !== idSedangEdit);
}

// buatSkuUnikAsync — dipakai form Entry Produk (satu produk, live Firestore
// check). Kalau SKU dasar (dari Nama-Warna-Size) sudah dipakai produk LAIN,
// otomatis tambah akhiran -2/-3/dst sampai ketemu yang belum dipakai — user
// TIDAK diminta ubah apa-apa (GANTI 28 Agt 2026: dulu ditolak+alert minta
// user ubah SKU manual, SEKARANG SKU tidak lagi bisa diedit manual jadi
// tabrakan harus diselesaikan sistem sendiri, bukan dilempar ke user).
async function buatSkuUnikAsync(baseSku, idSedangEdit) {
  let sku = baseSku, n = 1;
  while (await cekSkuDobel(sku, idSedangEdit)) {
    n++;
    sku = baseSku + '-' + n;
  }
  return sku;
}

// ---------------------------------------------------------------------------
// Import/Export Excel (Master Produk) — desain disepakati lewat 2 ronde
// AskUserQuestion sebelum ditulis (lihat STATUS-PROYEK.md §28.9): 2 tahap
// (Import Produk Utama dulu, baru Import BOM setelah SKU-nya ada), template
// BOM 4 sheet dalam 1 file (Jasa/Pola/Komponen/Aksesoris), popup verifikasi
// dengan saran koreksi (Levenshtein) + boleh dikoreksi inline lewat
// DropdownCari sebelum Import ditekan, mode "Ganti Total" per SKU per
// kategori (BUKAN tambah/gabung ke BOM lama), TEKS SAJA (tanpa foto), dan 1
// tombol dropdown gabungan (Download Template + Import), sesuai konfirmasi
// akhir Hilman.
// ---------------------------------------------------------------------------

// ambilSemuaProduk — ambil SEMUA dokumen master_produk (bukan 1 halaman
// paginasi) — dipakai buat cek Nama+Warna+Size dobel dalam file, generate
// SKU baru yang tidak tabrakan, & cek produk yang mau di-import BOM-nya
// sudah terdaftar di Data Produk.
// `export` (BARU 28 Agt 2026) — dulu cuma dipakai internal file ini (cek
// dobel Nama+Warna+Size saat Import Excel). SEKARANG juga diimpor
// vue-order-spk.js buat dropdown "Pilih Produk (SKU)" — permintaan Guru
// sambungkan Order SPK ke Master Produk lewat SKU. Fungsi & isinya TIDAK
// diubah (tetap ambil SEMUA field termasuk `sku`, `kelipatan`), cuma
// exposed lintas file.
export async function ambilSemuaProduk() {
  try {
    const snap = await getDocs(collection(db, 'master_produk'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
  } catch (e) {
    console.error('Gagal ambil semua Master Produk:', e);
    return [];
  }
}

// jarakLevenshtein — jarak edit standar (insert/delete/substitute = 1).
// Tidak ada pola/library sejenis di codebase ini, ditulis dari nol khusus
// buat saran "maksud Anda...?" di popup verifikasi import.
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

// cariSaranTerdekat — cari opsi ter-mirip (jarak Levenshtein terkecil) buat
// "maksud Anda...?". Ambang batas separuh panjang teks (longgar tapi tetap
// masuk akal) biar tidak menyarankan sesuatu yang jauh beda.
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

// validasiPilihan — cek 1 nilai teks dari Excel terhadap daftar opsi resmi
// (opsiNamaBahan/opsiWarna/opsiSatuan dll). Cocok PERSIS (case-insensitive,
// trim) = valid, nilai dinormalkan ke ejaan resmi di daftar. Tidak cocok =
// kasih saran (kalau ada) buat dikoreksi inline di popup — TIDAK PERNAH
// otomatis dianggap benar (sesuai keputusan "kasih saran & bisa dikoreksi
// langsung di popup", bukan auto-terima tebakan).
function validasiPilihan(nilaiAsli, daftarOpsi) {
  const teks = (nilaiAsli || '').trim();
  if (!teks) return { valid: false, nilai: '', saran: '' };
  const cocok = (daftarOpsi || []).find(o => o.toLowerCase() === teks.toLowerCase());
  if (cocok) return { valid: true, nilai: cocok, saran: '' };
  return { valid: false, nilai: teks, saran: cariSaranTerdekat(teks, daftarOpsi) };
}

// bacaFileExcel / ambilSheet — pakai XLSX global yang sudah dimuat lewat
// <script> di index.html (SheetJS, sudah dipakai duluan di
// js/vue-penjadwalan.js buat fitur export/import serupa) — TIDAK perlu
// dependency baru.
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

// unduhWorkbook — bikin file .xlsx dari beberapa sheet sekaligus (dipakai
// buat 2 template: Produk Utama 1 sheet, BOM 4 sheet dalam 1 file — sesuai
// keputusan "4 sheet terpisah dalam 1 file").
function unduhWorkbook(sheets, namaFile) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.baris, { header: s.header });
    XLSX.utils.book_append_sheet(wb, ws, s.nama);
  }
  XLSX.writeFile(wb, namaFile);
}

// Header kolom template — string-nya SEKALIGUS jadi nama kolom di Excel,
// jadi HARUS PERSIS sama dipakai waktu baca file (ambilSheet + akses
// b['...']) di bawah. Field "Nama + Warna" (Bahan/Aksesoris) diisi TEKS
// GABUNGAN sama seperti tampilan DropdownCari di form (lihat
// formatNamaBahan), mis. "Kain Kanvas Merah". ⚠️ Kode Webbing 2/3 & kolom
// "Komponen" (sheet Komponen) BUKAN bagian aturan ini lagi sejak §36/§38 —
// keduanya teks bebas, TIDAK perlu format Nama+Warna.
// GANTI (28 Agt 2026, permintaan Hilman) — kolom "SKU" DIHAPUS dari SEMUA
// sheet (Produk Utama & BOM). SKU sekarang full otomatis (lihat kunciProduk
// di atas), jadi TIDAK ADA LAGI kolom SKU yang perlu diisi di Excel. Sheet
// "Produk Utama" diidentifikasi lewat Nama+Jenis Produk+Warna+Size sendiri
// (SKU digenerate sistem saat baris itu diimport). Sheet BOM (Jasa/Pola/
// Komponen/Aksesoris) SEKARANG mencocokkan baris ke produk lewat kolom
// "Nama"+"Warna"+"Size" (BUKAN SKU lagi — SKU tidak diketahui user sebelum
// Import Produk Utama selesai jalan).
const HEADER_PRODUK_UTAMA = ['Nama', 'Jenis Produk', 'Warna', 'Size'];
const HEADER_JASA = ['Nama', 'Warna', 'Size', 'Nama Jasa', 'Harga'];
const HEADER_POLA = ['Nama', 'Warna', 'Size', 'Tipe (internal/vendor)', 'Nama Pola', 'Bahan (Nama + Warna)', 'Panjang', 'Isi Pola (Pcs)', 'Jasa Cutting', 'Jasa Serie', 'Jenis Vendor'];
const HEADER_KOMPONEN = ['Nama', 'Warna', 'Size', 'Nama Pola', 'Komponen', 'Qty']; // GANTI (28 Agt 2026, §36): dulu 'Nama Komponen (Nama + Warna)', sekarang 'Komponen' (sumber Data Komponen/Config, plain text)
const HEADER_AKSESORIS = ['Nama', 'Warna', 'Size', 'Tahap Proses', 'Aksesoris (Nama + Warna)', 'Qty', 'Satuan', 'Kode Webbing 2', 'Kode Webbing 3']; // GANTI (28 Agt 2026, §38): dulu 'Kode Webbing 2/3 (Nama + Warna)', sekarang teks bebas (permintaan Guru), header disederhanakan

function unduhTemplateProdukUtama() {
  const contoh = { 'Nama': 'Tas Ransel Kanvas', 'Jenis Produk': 'Tas', 'Warna': 'Merah', 'Size': 'All Size' };
  unduhWorkbook([{ nama: 'Produk Utama', header: HEADER_PRODUK_UTAMA, baris: [contoh] }], 'Template Import Produk Utama.xlsx');
}

function unduhTemplateBOM() {
  const contohJasa = { 'Nama': 'Tas Ransel Kanvas', 'Warna': 'Merah', 'Size': 'All Size', 'Nama Jasa': 'Jasa Jahit', 'Harga': 15000 };
  const contohPola = { 'Nama': 'Tas Ransel Kanvas', 'Warna': 'Merah', 'Size': 'All Size', 'Tipe (internal/vendor)': 'internal', 'Nama Pola': 'Badan Depan', 'Bahan (Nama + Warna)': 'Kain Kanvas Merah', 'Panjang': 1.2, 'Isi Pola (Pcs)': 4, 'Jasa Cutting': 2000, 'Jasa Serie': 3000, 'Jenis Vendor': '' };
  const contohKomponen = { 'Nama': 'Tas Ransel Kanvas', 'Warna': 'Merah', 'Size': 'All Size', 'Nama Pola': 'Badan Depan', 'Komponen': 'Badan Belakang', 'Qty': 1 };
  const contohAksesoris = { 'Nama': 'Tas Ransel Kanvas', 'Warna': 'Merah', 'Size': 'All Size', 'Tahap Proses': 'Finishing', 'Aksesoris (Nama + Warna)': 'Resleting YKK Hitam', 'Qty': 1, 'Satuan': 'Pcs', 'Kode Webbing 2': '', 'Kode Webbing 3': '' };
  unduhWorkbook([
    { nama: 'Jasa', header: HEADER_JASA, baris: [contohJasa] },
    { nama: 'Pola', header: HEADER_POLA, baris: [contohPola] },
    { nama: 'Komponen', header: HEADER_KOMPONEN, baris: [contohKomponen] },
    { nama: 'Aksesoris', header: HEADER_AKSESORIS, baris: [contohAksesoris] }
  ], 'Template Import BOM.xlsx');
}

// --- Baris kosong per kategori BOM ----------------------------------------
function barisJasaKosong() { return { nama: '', harga: '' }; }
function barisPolaKosong() {
  return {
    tipe: 'internal', // 'internal' | 'vendor' — keputusan #3, gabung 1 tab + toggle
    foto: '', fotoFile: null, fotoPreview: '', fotoDihapus: false,
    nama_pola: '',
    bahan_pilih: '', bahan_aksesoris_id: '', // GANTI (28 Agt 2026): warna_bahan_pilih dihapus, digabung ke bahan_pilih (lihat formatNamaBahan)
    panjang: '', isi_pola_pcs: '', jasa_cutting: '', jasa_serie: '',
    jenis_vendor: '',
    komponen: []
  };
}
// barisKomponenKosong — GANTI (28 Agt 2026, §34, permintaan Guru: dropdown
// "Kelola Komponen" sekarang ambil dari Data Komponen [Config, koleksi
// master_komponen], BUKAN LAGI dari Data Bahan & Aksesoris. master_komponen
// cuma daftar nama polos (pola sama Warna/Jenis Produk, TANPA id/FK) — jadi
// `bahan_aksesoris_id` DIHAPUS dari baris ini, `pilih` sekarang LANGSUNG
// jadi nilai final `nama_komponen` (bukan lagi teks buat di-resolve ke item
// Bahan & Aksesoris). SUPERSEDE (28 Agt 2026, §36, permintaan Guru lewat
// Template BOM baru): Excel Import BOM sheet "Komponen" SEKARANG JUGA ikut
// diganti ke Data Komponen (Config) — kolom header jadi "Komponen" (dulu
// "Nama Komponen (Nama + Warna)"), validasi ke opsiKomponen (master_komponen)
// bukan lagi Data Bahan & Aksesoris. Baris hasil import SEKARANG format
// `{ nama_komponen, qty }` — SAMA PERSIS dengan baris dari form manual,
// TIDAK ADA LAGI `bahan_aksesoris_id` di baris manapun — konsekuensi "2
// sumber beda" yang dicatat di §34 SUDAH TIDAK BERLAKU LAGI sejak §36,
// lihat STATUS-PROYEK.md §36.
function barisKomponenKosong() { return { pilih: '', qty: '' }; }
// barisAksesorisKosong — GANTI (28 Agt 2026, §38, permintaan Guru): Kode
// Webbing 2/3 DULU wajib pilih dari Data Bahan & Aksesoris (DropdownCari,
// resolve ke bahan_aksesoris_id — lihat komentar poin 6 di atas berkas ini,
// SEKARANG SUDAH TIDAK BERLAKU). SEKARANG jadi INPUT MANUAL/teks bebas —
// `webbing2_id`/`webbing3_id` DIHAPUS (tidak ada lagi link ke
// master_bahan_aksesoris buat 2 field ini), `webbing2_pilih`/`webbing3_pilih`
// diganti nama jadi `webbing2`/`webbing3` (langsung teks final, bukan lagi
// teks buat di-resolve — pola sama seperti `pilih` di barisKomponenKosong
// sejak §34).
function barisAksesorisKosong() {
  return {
    tahap_proses: '',
    aksesoris_pilih: '', bahan_aksesoris_id: '', // GANTI (28 Agt 2026): warna_pilih dihapus, digabung ke aksesoris_pilih (lihat formatNamaBahan)
    qty: '', satuan_pilih: '',
    webbing2: '',
    webbing3: ''
  };
}

// ---------------------------------------------------------------------------
// KelolaKomponenModal — modal "Kelola Komponen" per baris BOM Pola/Vendor.
// Pola prop SAMA seperti PopupKonversiBerjenjang (vue-bahan-aksesoris.js):
// `baris` dikirim SEBAGAI REFERENSI (array reactive), dimutasi langsung di
// sini — tidak perlu event update:modelValue bolak-balik tiap field.
// ---------------------------------------------------------------------------
const KelolaKomponenModal = {
  components: { DropdownCari },
  props: {
    komponen: { type: Array, required: true },
    namaPola: { type: String, default: '' },
    // GANTI (28 Agt 2026, §34) — dulu opsiNamaBahan/daftarBahan (Data Bahan
    // & Aksesoris), SEKARANG opsiKomponen (Data Komponen, Config, koleksi
    // master_komponen) — permintaan Guru eksplisit.
    opsiKomponen: { type: Array, default: () => [] }
  },
  emits: ['tutup'],
  methods: {
    tambah() { this.komponen.push(barisKomponenKosong()); },
    hapus(i) { this.komponen.splice(i, 1); }
  },
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="$emit('tutup')">
      <div class="gc-card" style="max-width:560px; width:100%; max-height:90vh; overflow-y:auto;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:4px;"><i class="fas fa-puzzle-piece" style="color:var(--burgundy); margin-right:8px;"></i>Kelola Komponen</h3>
        <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Komponen untuk pola "{{ namaPola || '(belum diberi nama)' }}". Nama Komponen wajib pilih dari Data Komponen (Config).</p>
        <div v-for="(k, i) in komponen" :key="i" class="gc-row-nq" style="margin-bottom:8px;">
          <div><span class="gc-row-label">Komponen</span><dropdown-cari v-model="k.pilih" :opsi="opsiKomponen" placeholder="Cari & pilih komponen..." /></div>
          <div><span class="gc-row-label">Qty</span><input v-model.number="k.qty" type="number" min="0" placeholder="Qty" style="width:100%; padding:8px 10px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; box-sizing:border-box;"></div>
          <div style="display:flex; justify-content:flex-end; align-items:center;"><button @click="hapus(i)" class="icon-btn" style="color:var(--danger);" title="Hapus komponen"><i class="fas fa-trash-alt"></i></button></div>
        </div>
        <button @click="tambah" class="btn-outline" style="font-size:11.5px; padding:6px 14px; margin-bottom:16px;"><i class="fas fa-plus" style="margin-right:5px;"></i>Tambah Komponen</button>
        <button @click="$emit('tutup')" class="btn-primary block">Selesai</button>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// FormEntryProdukBOM — form lengkap Data Produk Utama + 4 kategori BOM.
// Dipakai DUA tempat: MasterProdukEntryManager (mode create, halaman biasa)
// & modal edit di MasterProdukListManager (mode edit, dataAwal terisi) —
// sengaja dipisah jadi 1 komponen (BEDA dari pola lama vue-bahan-
// aksesoris.js yang duplikat form Entry & modal Edit) karena form BOM ini
// jauh lebih besar/kompleks, duplikasi ~500 baris bukan pilihan masuk akal.
// ---------------------------------------------------------------------------
const FormEntryProdukBOM = {
  components: { DropdownCari, KelolaKomponenModal },
  props: { dataAwal: { type: Object, default: null } },
  emits: ['tersimpan', 'batal'],
  setup(props, { emit }) {
    const modeEdit = computed(() => !!props.dataAwal);
    const menyimpan = ref(false);
    const mengupload = ref(false);
    const tabAktif = ref('jasa'); // 'jasa' | 'pola' | 'aksesoris'
    // BARU (§39) — switch tab BOM Jasa/Pola/Aksesoris di layar Entry Produk
    // ini adalah tab internal Vue GENUINE (bukan navigasi antar menu), jadi
    // disambungkan ke riwayat tombol back HP. TIDAK disambungkan untuk
    // tabAktif milik PopupImportBOM (komponen terpisah di bawah) — itu tab
    // di DALAM modal transient (buka saat proses Import Excel, langsung
    // ditutup lagi setelah konfirmasi/batal), bukan tab layar yang perlu
    // "diingat" lewat tombol back.
    pakaiRiwayatTabVue('produk-bom-tab', tabAktif);

    const daftarBahan = ref([]);
    const opsiNamaBahan = computed(() => daftarBahan.value.map(b => formatNamaBahan(b)));
    const opsiWarna = ref([]);
    const opsiSatuan = ref([]);
    // BARU (28 Agt 2026) — Jenis Produk (mis. "Kaos", "Celana"), sumbernya
    // Config > Jenis Produk (master_jenis_produk), pola SAMA seperti Warna:
    // DropdownCari wajib pilih dari daftar, disimpan sebagai teks (bukan id).
    const opsiJenisProduk = ref([]);
    // BARU (28 Agt 2026, §34) — Data Komponen (Config, master_komponen),
    // sumber dropdown "Kelola Komponen" (BOM Pola), pola SAMA seperti Warna/
    // Jenis Produk: DropdownCari wajib pilih dari daftar, disimpan sebagai
    // teks (bukan id) — GANTI dari sumber lama Data Bahan & Aksesoris,
    // permintaan Guru eksplisit.
    const opsiKomponen = ref([]);
    // opsiTahapPersiapan — BARU (28 Agt 2026, permintaan Guru: "sambungkan
    // dropdown cari > Persiapan untuk Tahap" di BOM Aksesoris). Sumber
    // Config > Persiapan Untuk Tahap (koleksi master_tahap_persiapan) —
    // pola SAMA seperti opsiKomponen/opsiJenisProduk di atas: DropdownCari
    // BUKAN strict-select (field `tahap_proses` TETAP teks bebas seperti
    // sebelumnya, dropdown ini cuma bantu SARAN/konsistensi penulisan,
    // TIDAK mem-validasi harus pilih dari daftar — beda dari Warna/Jenis
    // Produk/Komponen yang wajib pilih). Alasan: field ini SUDAH ADA lama
    // sebagai teks bebas (dipakai juga Import Excel BOM Aksesoris sejak
    // sebelum menu Config ini ada), mengunci jadi strict-select berisiko
    // "mengunci keluar" data lama yang tidak persis cocok ejaannya dengan
    // daftar master baru.
    const opsiTahapPersiapan = ref([]);

    const idProduk = props.dataAwal?.id || doc(collection(db, 'master_produk')).id;

    const form = reactive({
      nama: props.dataAwal?.nama || '',
      jenis_produk_pilih: props.dataAwal?.jenis_produk || '',
      warna_pilih: props.dataAwal?.warna || '',
      size: props.dataAwal?.size || '',
      sku: props.dataAwal?.sku || '',
      foto: props.dataAwal?.foto || '',
      // harga_jual — BARU (30 Agt 2026, fitur "Pesanan" — Penjualan Kasir
      // butuh harga jual per produk buat isi keranjang, master_produk
      // SEBELUMNYA cuma punya data BOM/ongkos produksi, TIDAK ADA field
      // harga jual sama sekali (lihat AskUserQuestion, keputusan Guru:
      // "Field 'Harga Jual' baru di Master Produk"). Angka polos (bukan
      // per-varian/promo), opsional — produk lama tanpa harga jual tetap
      // muncul di Kasir tapi harganya 0 (bisa diedit manual di keranjang
      // kalau perlu, lihat js/vue-pesanan.js).
      harga_jual: props.dataAwal?.harga_jual || '',
      bom_jasa: props.dataAwal?.bom_jasa ? JSON.parse(JSON.stringify(props.dataAwal.bom_jasa)) : [],
      bom_pola: props.dataAwal?.bom_pola ? JSON.parse(JSON.stringify(props.dataAwal.bom_pola)).map(b => ({
        ...barisPolaKosong(), ...b,
        // GANTI (28 Agt 2026) — dulu Nama Bahan & Warna Bahan 2 field
        // terpisah, SEKARANG 1 field gabungan (formatNamaBahan) biar
        // varian warna beda bisa dibedakan di dropdown. bahan_pilih
        // direkonstruksi dari nama_bahan+warna_bahan yang TERSIMPAN (2
        // field itu TETAP disimpan terpisah di Firestore, cuma UI-nya
        // digabung jadi 1 dropdown).
        bahan_pilih: formatNamaBahan({ nama: b.nama_bahan, warna: b.warna_bahan }),
        fotoFile: null, fotoPreview: '',
        // penting: komponen tersimpan cuma punya nama_komponen (bukan
        // "pilih") — kalau tidak dipetakan ulang, DropdownCari-nya bakal
        // kosong waktu edit padahal datanya ada, dan validasi() akan
        // salah kira belum dipilih (nolak simpan padahal cuma tampilan).
        komponen: (b.komponen || []).map(k => ({ ...barisKomponenKosong(), ...k, pilih: k.nama_komponen || '' }))
      })) : [],
      // GANTI (28 Agt 2026) — aksesoris_pilih SEKARANG direkonstruksi dari
      // nama_aksesoris+warna gabungan (sama alasan seperti bom_pola di
      // atas). GANTI LAGI (28 Agt 2026, §38): webbing2/webbing3 SEKARANG
      // field teks bebas langsung dari `a.webbing2`/`a.webbing3` (BUKAN
      // LAGI `webbing2_nama`/`webbing3_nama` hasil resolve FK) — lihat
      // barisAksesorisKosong() & simpan().
      bom_aksesoris: props.dataAwal?.bom_aksesoris ? JSON.parse(JSON.stringify(props.dataAwal.bom_aksesoris)).map(a => ({ ...barisAksesorisKosong(), ...a, aksesoris_pilih: formatNamaBahan({ nama: a.nama_aksesoris, warna: a.warna }), satuan_pilih: a.satuan || '', webbing2: a.webbing2 || '', webbing3: a.webbing3 || '' })) : []
    });

    // GANTI (28 Agt 2026, permintaan Hilman) — SKU SEKARANG FULL OTOMATIS,
    // user/admin TIDAK ENTRY SKU SAMA SEKALI (dulu ada mode "diedit manual"
    // yang menghentikan auto-isi begitu user ketik langsung — DIHAPUS).
    // form.sku di sini cuma PREVIEW dasar (live, dari Nama-Warna-Size, tanpa
    // Firestore check) — SKU FINAL yang benar-benar unik (bisa dapat akhiran
    // -2/-3 kalau tabrakan) baru ditentukan simpan() lewat buatSkuUnikAsync().
    watch([() => form.nama, () => form.warna_pilih, () => form.size], () => {
      form.sku = buatSkuOtomatis(form.nama, form.warna_pilih, form.size);
    });

    // kelipatanLive — BARU (28 Agt 2026, permintaan Guru), lihat catatan
    // panjang hitungKelipatan() di atas file ini. Live-preview (reactive
    // ke form.bom_pola, update otomatis tiap Isi Pola (Pcs) diketik) —
    // nilai FINAL yang sama disimpan ke field `kelipatan` di simpan().
    const kelipatanLive = computed(() => hitungKelipatan(form.bom_pola));

    const fotoProdukFile = ref(null);
    const fotoProdukPreview = ref(props.dataAwal?.foto || '');
    // fotoProdukDihapus — BARU: tanda "foto lama SENGAJA dihapus, jangan
    // dipertahankan waktu simpan" (beda dari sekadar belum pernah ada foto).
    // Tanpa ini, klik "Hapus Foto" cuma mengosongkan tampilan, tapi file
    // lama di Storage tidak pernah ikut dihapus (jadi file yatim) — pola
    // sama seperti alasan hapus(item) di js/vue-config-info.js.
    const fotoProdukDihapus = ref(false);
    function pilihFotoProduk(ev) {
      const file = ev.target.files[0];
      if (!file) return;
      fotoProdukFile.value = file;
      fotoProdukPreview.value = URL.createObjectURL(file);
      fotoProdukDihapus.value = false;
    }
    function hapusFotoProduk() { fotoProdukFile.value = null; fotoProdukPreview.value = ''; fotoProdukDihapus.value = true; }

    function pilihFotoPola(baris, ev) {
      const file = ev.target.files[0];
      if (!file) return;
      baris.fotoFile = file;
      baris.fotoPreview = URL.createObjectURL(file);
      baris.fotoDihapus = false;
    }
    function hapusFotoPola(baris) { baris.fotoFile = null; baris.fotoPreview = ''; baris.fotoDihapus = true; }

    // Modal Kelola Komponen
    const modalKomponenAktif = ref(null); // index baris pola yang sedang dibuka
    function bukaKomponen(i) { modalKomponenAktif.value = i; }
    function tutupKomponen() { modalKomponenAktif.value = null; }

    async function muatOpsi() {
      const [bahan, warna, satuan, jenisProduk, komponen, tahapPersiapan] = await Promise.all([
        ambilDaftarBahanAksesorisLengkap(),
        ambilDaftarNama('master_warna'),
        ambilDaftarNama('master_satuan'),
        ambilDaftarNama('master_jenis_produk'),
        ambilDaftarNama('master_komponen'),
        ambilDaftarNama('master_tahap_persiapan')
      ]);
      daftarBahan.value = bahan;
      opsiWarna.value = warna;
      opsiSatuan.value = satuan;
      opsiJenisProduk.value = jenisProduk;
      opsiKomponen.value = komponen;
      opsiTahapPersiapan.value = tahapPersiapan;
    }
    onMounted(async () => { await window.authReady; await muatOpsi(); });

    function saatPilihBahanPola(baris) {
      const item = resolveBahan(daftarBahan.value, baris.bahan_pilih);
      baris.bahan_aksesoris_id = item ? item.id : '';
    }
    function saatPilihAksesoris(baris) {
      const item = resolveBahan(daftarBahan.value, baris.aksesoris_pilih);
      baris.bahan_aksesoris_id = item ? item.id : '';
    }
    // saatPilihWebbing() — DIHAPUS (28 Agt 2026, §38): Kode Webbing 2/3
    // sekarang input teks manual, tidak ada lagi resolve ke Data Bahan &
    // Aksesoris, jadi tidak perlu handler saat dipilih.

    function tambahJasa() { form.bom_jasa.push(barisJasaKosong()); }
    function hapusJasa(i) { form.bom_jasa.splice(i, 1); }
    function tambahPola() { form.bom_pola.push(barisPolaKosong()); }
    function hapusPola(i) { form.bom_pola.splice(i, 1); }
    function tambahAksesoris() { form.bom_aksesoris.push(barisAksesorisKosong()); }
    function hapusAksesoris(i) { form.bom_aksesoris.splice(i, 1); }

    function validasi() {
      if (!form.nama.trim()) return 'Isi Nama Produk dulu.';
      if (!form.jenis_produk_pilih.trim()) return 'Pilih Jenis Produk dulu.';
      if (!form.warna_pilih.trim()) return 'Pilih Warna dulu.';
      if (!form.size.trim()) return 'Isi Size dulu.';
      for (const b of form.bom_pola) {
        const adaIsi = b.nama_pola || b.bahan_pilih || b.panjang || b.isi_pola_pcs;
        if (!adaIsi) continue;
        if (!resolveBahan(daftarBahan.value, b.bahan_pilih)) {
          return `BOM ${b.tipe === 'vendor' ? 'Vendor' : 'Pola'} "${b.nama_pola || '(tanpa nama)'}": pilih Nama Bahan dari daftar dulu (bukan teks bebas). Kalau belum ada, tambahkan dulu di menu Data Bahan & Aksesoris.`;
        }
        for (const k of b.komponen) {
          if (!k.pilih && !k.qty) continue;
          // GANTI (28 Agt 2026, §34) — komponen sekarang divalidasi ke Data
          // Komponen (opsiKomponen, teks polos), BUKAN LAGI resolveBahan ke
          // Data Bahan & Aksesoris.
          if (!opsiKomponen.value.includes(k.pilih)) return `Komponen di BOM "${b.nama_pola || '(tanpa nama)'}": pilih Nama Komponen dari daftar dulu.`;
        }
      }
      for (const a of form.bom_aksesoris) {
        const adaIsi = a.aksesoris_pilih || a.tahap_proses || a.qty;
        if (!adaIsi) continue;
        if (!resolveBahan(daftarBahan.value, a.aksesoris_pilih)) {
          return `BOM Aksesoris "${a.tahap_proses || '(tanpa tahap)'}": pilih Nama Aksesoris dari daftar dulu.`;
        }
        // Kode Webbing 2/3 — DIHAPUS validasinya (28 Agt 2026, §38): SEKARANG
        // teks bebas/opsional, tidak perlu resolve ke Data Bahan & Aksesoris
        // lagi (dulu di sini, sebelum §38).
      }
      return '';
    }

    async function simpan() {
      const pesanError = validasi();
      if (pesanError) return alert(pesanError);
      menyimpan.value = true;
      try {
        // GANTI (28 Agt 2026) — dulu SKU dobel ditolak+alert minta user ubah
        // manual. SEKARANG SKU tidak lagi bisa diedit manual, jadi tabrakan
        // diselesaikan sistem sendiri (tambah akhiran -2/-3/dst otomatis,
        // lihat buatSkuUnikAsync di atas) — user tidak diminta apa-apa.
        const skuFinal = await buatSkuUnikAsync(form.sku.trim(), props.dataAwal?.id);

        mengupload.value = true;
        let fotoUrl = form.foto;
        if (fotoProdukFile.value) {
          const lama = fotoUrl;
          fotoUrl = await uploadFotoProduk(idProduk, 'foto', fotoProdukFile.value);
          await hapusFotoProdukLama(lama);
        } else if (fotoProdukDihapus.value) {
          await hapusFotoProdukLama(fotoUrl);
          fotoUrl = '';
        }

        const bomPolaSiap = [];
        for (let i = 0; i < form.bom_pola.length; i++) {
          const b = form.bom_pola[i];
          let fotoPolaUrl = b.foto;
          if (b.fotoFile) {
            const lama = fotoPolaUrl;
            fotoPolaUrl = await uploadFotoProduk(idProduk, `pola${i}`, b.fotoFile);
            await hapusFotoProdukLama(lama);
          } else if (b.fotoDihapus) {
            await hapusFotoProdukLama(fotoPolaUrl);
            fotoPolaUrl = '';
          }
          const bahanItem = resolveBahan(daftarBahan.value, b.bahan_pilih);
          bomPolaSiap.push({
            tipe: b.tipe,
            foto: fotoPolaUrl,
            nama_pola: (b.nama_pola || '').trim(),
            bahan_aksesoris_id: bahanItem ? bahanItem.id : '',
            nama_bahan: bahanItem ? bahanItem.nama : '',
            // GANTI (28 Agt 2026) — warna_bahan SEKARANG auto-ikut dari
            // item yang dipilih (field warna_bahan_pilih terpisah sudah
            // dihapus), BUKAN dipilih manual lagi.
            warna_bahan: bahanItem ? (bahanItem.warna || '') : '',
            panjang: parseFloat(b.panjang) || 0,
            isi_pola_pcs: parseFloat(b.isi_pola_pcs) || 0,
            jasa_cutting: parseFloat(b.jasa_cutting) || 0,
            jasa_serie: parseFloat(b.jasa_serie) || 0,
            jenis_vendor: b.tipe === 'vendor' ? (b.jenis_vendor || '').trim() : '',
            // GANTI (28 Agt 2026, §34) — komponen SEKARANG dari Data Komponen
            // (teks polos, k.pilih = nilai final `nama_komponen` langsung),
            // BUKAN LAGI di-resolve ke item Data Bahan & Aksesoris — field
            // `bahan_aksesoris_id` DIHAPUS dari baris komponen (tidak relevan
            // lagi, master_komponen tidak punya konsep id/FK ke stok).
            komponen: (b.komponen || []).filter(k => k.pilih).map(k => ({ nama_komponen: k.pilih, qty: parseFloat(k.qty) || 0 }))
          });
        }

        const bomAksesorisSiap = form.bom_aksesoris.map(a => {
          const item = resolveBahan(daftarBahan.value, a.aksesoris_pilih);
          return {
            tahap_proses: (a.tahap_proses || '').trim(),
            bahan_aksesoris_id: item ? item.id : '',
            nama_aksesoris: item ? item.nama : '',
            // GANTI (28 Agt 2026) — warna SEKARANG auto-ikut dari item yang
            // dipilih (field warna_pilih terpisah sudah dihapus), BUKAN
            // dipilih manual lagi — sama alasan seperti warna_bahan di atas.
            warna: item ? (item.warna || '') : '',
            qty: parseFloat(a.qty) || 0,
            satuan: (a.satuan_pilih || '').trim(),
            // GANTI (28 Agt 2026, §38, permintaan Guru) — Kode Webbing 2/3
            // SEKARANG teks bebas langsung dari input manual, BUKAN LAGI
            // di-resolve ke Data Bahan & Aksesoris. `webbing2_id`/`webbing3_id`
            // DIHAPUS (tidak ada lagi FK buat 2 field ini).
            webbing2: (a.webbing2 || '').trim(),
            webbing3: (a.webbing3 || '').trim()
          };
        });

        const bomJasaSiap = form.bom_jasa.filter(j => j.nama).map(j => ({ nama: (j.nama || '').trim(), harga: parseFloat(j.harga) || 0 }));

        const payload = {
          sku: skuFinal,
          nama: form.nama.trim(),
          jenis_produk: form.jenis_produk_pilih.trim(),
          warna: form.warna_pilih.trim(),
          size: form.size.trim(),
          foto: fotoUrl,
          bom_jasa: bomJasaSiap,
          bom_pola: bomPolaSiap,
          bom_aksesoris: bomAksesorisSiap,
          // harga_jual — BARU (30 Agt 2026, fitur "Pesanan"), lihat catatan
          // panjang di form reactive() atas file ini.
          harga_jual: parseFloat(form.harga_jual) || 0,
          // kelipatan — BARU (28 Agt 2026, permintaan Guru). Dihitung dari
          // bomPolaSiap (bukan kelipatanLive.value langsung) supaya pasti
          // sinkron dengan bom_pola versi FINAL yang benar-benar disimpan
          // (misal ada baris kosong yang difilter simpan(), dsb).
          kelipatan: hitungKelipatan(bomPolaSiap)
        };

        if (modeEdit.value) {
          payload.diedit_pada = serverTimestamp();
          payload.diedit_oleh = window.currentUser?.email || null;
          await updateDoc(doc(db, 'master_produk', props.dataAwal.id), payload);
        } else {
          payload.dibuat_pada = serverTimestamp();
          payload.dibuat_oleh = window.currentUser?.email || null;
          await setDoc(doc(db, 'master_produk', idProduk), payload);
        }
        mengupload.value = false;
        emit('tersimpan');
      } catch (e) {
        console.error('Gagal simpan Master Produk:', e);
        alert('Gagal menyimpan produk. Coba lagi.');
      }
      mengupload.value = false;
      menyimpan.value = false;
    }

    return {
      modeEdit, menyimpan, mengupload, tabAktif, form, opsiNamaBahan, opsiWarna, opsiSatuan, opsiJenisProduk, opsiKomponen,
      opsiTahapPersiapan,
      kelipatanLive,
      fotoProdukPreview, pilihFotoProduk, hapusFotoProduk,
      pilihFotoPola, hapusFotoPola,
      modalKomponenAktif, bukaKomponen, tutupKomponen,
      daftarBahan,
      saatPilihBahanPola, saatPilihAksesoris,
      tambahJasa, hapusJasa, tambahPola, hapusPola, tambahAksesoris, hapusAksesoris,
      simpan
    };
  },
  template: `
    <div>
      <div class="gc-card" style="margin-bottom:16px;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:14px;"><i class="fas fa-shirt" style="color:var(--burgundy); margin-right:8px;"></i>Data Produk Utama</h3>
        <div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap; margin-bottom:4px;">
          <div>
            <div v-if="fotoProdukPreview" style="margin-bottom:8px;">
              <img :src="fotoProdukPreview" style="width:96px; height:96px; object-fit:cover; border-radius:12px; border:1.5px solid var(--line);">
            </div>
            <div class="gc-field" style="margin-bottom:0; width:200px;">
              <label>Foto Produk</label>
              <input type="file" accept="image/*" @change="pilihFotoProduk">
              <button v-if="fotoProdukPreview" @click="hapusFotoProduk" type="button" class="btn-outline" style="font-size:11px; padding:5px 10px; margin-top:6px;">Hapus Foto</button>
            </div>
          </div>
          <div style="flex:1; min-width:240px; display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-4">
            <div class="gc-field" style="margin-bottom:0;"><label>Jenis Produk</label><dropdown-cari v-model="form.jenis_produk_pilih" :opsi="opsiJenisProduk" placeholder="Cari & pilih Jenis Produk..." /></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Nama Produk</label><input v-model="form.nama" type="text" placeholder="Mis. Tas Ransel Kanvas"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Warna</label><dropdown-cari v-model="form.warna_pilih" :opsi="opsiWarna" placeholder="Cari & pilih Warna..." /></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Size</label><input v-model="form.size" type="text" placeholder="Mis. All Size / L / 30x40cm"></div>
          </div>
        </div>
        <div style="display:flex; gap:16px; flex-wrap:wrap;">
          <div class="gc-field" style="max-width:320px; flex:1; min-width:220px;">
            <label>SKU <span style="font-weight:400; color:var(--text-faint);">(otomatis dari Nama-Warna-Size, tidak perlu diisi)</span></label>
            <input :value="form.sku" type="text" readonly style="text-transform:uppercase; background:var(--ivory-dim); color:var(--text-muted); cursor:not-allowed;">
          </div>
          <!-- Harga Jual — BARU (30 Agt 2026, fitur "Pesanan" > Penjualan
               Kasir), lihat catatan panjang di form reactive() atas file
               ini. Opsional (boleh 0/kosong), TIDAK ikut validasi() wajib. -->
          <div class="gc-field" style="max-width:320px; flex:1; min-width:220px;">
            <label>Harga Jual <span style="font-weight:400; color:var(--text-faint);">(dipakai Penjualan Kasir)</span></label>
            <input v-model.number="form.harga_jual" type="number" min="0" placeholder="0">
          </div>
          <!-- Kelipatan — BARU (28 Agt 2026, permintaan Guru). Readonly,
               otomatis dari KPK (Kelipatan Persekutuan Terkecil) semua
               "Isi Pola (Pcs)" di tab BOM Pola & Vendor bawah — lihat
               catatan panjang hitungKelipatan() di atas file ini. Ini
               ACUAN MINIMAL ORDER yang nanti ditampilkan di Order SPK
               (js/vue-order-spk.js) begitu produk ini dipilih lewat SKU. -->
          <div class="gc-field" style="max-width:320px; flex:1; min-width:220px;">
            <label>Kelipatan <span style="font-weight:400; color:var(--text-faint);">(otomatis, acuan minimal order — lihat tab BOM Pola)</span></label>
            <input :value="kelipatanLive > 0 ? (kelipatanLive + ' pcs') : 'Belum ada Isi Pola (Pcs) terisi'" type="text" readonly style="background:var(--ivory-dim); color:var(--text-muted); cursor:not-allowed;">
          </div>
        </div>
      </div>

      <div class="gc-card">
        <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
          <button @click="tabAktif='jasa'" type="button" class="btn-outline" :class="{filled: tabAktif==='jasa'}" style="font-size:12px;"><i class="fas fa-hand-holding-dollar" style="margin-right:6px;"></i>BOM Jasa ({{ form.bom_jasa.length }})</button>
          <button @click="tabAktif='pola'" type="button" class="btn-outline" :class="{filled: tabAktif==='pola'}" style="font-size:12px;"><i class="fas fa-scissors" style="margin-right:6px;"></i>BOM Pola &amp; Vendor ({{ form.bom_pola.length }})</button>
          <button @click="tabAktif='aksesoris'" type="button" class="btn-outline" :class="{filled: tabAktif==='aksesoris'}" style="font-size:12px;"><i class="fas fa-gem" style="margin-right:6px;"></i>BOM Aksesoris ({{ form.bom_aksesoris.length }})</button>
        </div>

        <!-- BOM Jasa -->
        <div v-show="tabAktif==='jasa'">
          <div v-for="(j, i) in form.bom_jasa" :key="i" class="gc-row-nq" style="margin-bottom:8px;">
            <div class="gc-field" style="margin-bottom:0;"><span class="gc-row-label">Nama Jasa</span><input v-model="j.nama" type="text" placeholder="Nama Jasa (mis. Jasa Jahit)"></div>
            <div class="gc-field" style="margin-bottom:0;"><span class="gc-row-label">Harga</span><input v-model.number="j.harga" type="number" min="0" placeholder="Harga"></div>
            <div style="display:flex; justify-content:flex-end; align-items:center;"><button @click="hapusJasa(i)" type="button" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button></div>
          </div>
          <button @click="tambahJasa" type="button" class="btn-outline" style="font-size:11.5px;"><i class="fas fa-plus" style="margin-right:5px;"></i>Tambah Jasa</button>
        </div>

        <!-- BOM Pola & Vendor (digabung, keputusan #3) -->
        <div v-show="tabAktif==='pola'">
          <div v-for="(b, i) in form.bom_pola" :key="i" class="gc-card" style="margin-bottom:12px; background:var(--ivory-dim);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div style="display:flex; gap:6px;">
                <button @click="b.tipe='internal'" type="button" class="btn-outline" :class="{filled: b.tipe==='internal'}" style="font-size:11px; padding:6px 12px;">Internal (Pola)</button>
                <button @click="b.tipe='vendor'" type="button" class="btn-outline" :class="{filled: b.tipe==='vendor'}" style="font-size:11px; padding:6px 12px;">Vendor</button>
              </div>
              <button @click="hapusPola(i)" type="button" class="icon-btn" style="color:var(--danger);" title="Hapus baris"><i class="fas fa-trash-alt"></i></button>
            </div>
            <div style="display:flex; gap:14px; flex-wrap:wrap;">
              <div>
                <img v-if="!b.fotoDihapus && (b.fotoPreview || b.foto)" :src="b.fotoPreview || b.foto" style="width:76px; height:76px; object-fit:cover; border-radius:10px; border:1.5px solid var(--line); margin-bottom:6px; display:block;">
                <div class="gc-field" style="margin-bottom:0; width:170px;">
                  <label>{{ b.tipe==='vendor' ? 'Foto Proses' : 'Foto' }}</label>
                  <input type="file" accept="image/*" @change="ev => pilihFotoPola(b, ev)">
                  <button v-if="!b.fotoDihapus && (b.fotoPreview || b.foto)" @click="hapusFotoPola(b)" type="button" class="btn-outline" style="font-size:10.5px; padding:4px 8px; margin-top:5px;">Hapus Foto</button>
                </div>
              </div>
              <div style="flex:1; min-width:260px; display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-2">
                <div class="gc-field" style="margin-bottom:0;"><label>Nama Pola</label><input v-model="b.nama_pola" type="text"></div>
                <div class="gc-field" style="margin-bottom:0;"><label>Bahan (Nama + Warna)</label><dropdown-cari v-model="b.bahan_pilih" :opsi="opsiNamaBahan" placeholder="Cari & pilih bahan..." @update:modelValue="saatPilihBahanPola(b)" /></div>
                <div class="gc-field" style="margin-bottom:0;"><label>Panjang</label><input v-model.number="b.panjang" type="number" min="0"></div>
                <div class="gc-field" style="margin-bottom:0;"><label>Isi Pola (Pcs)</label><input v-model.number="b.isi_pola_pcs" type="number" min="0" placeholder="Hasil potong per pcs produk"></div>
                <div class="gc-field" style="margin-bottom:0;"><label>Jasa Cutting</label><input v-model.number="b.jasa_cutting" type="number" min="0"></div>
                <div class="gc-field" style="margin-bottom:0;"><label>Jasa Serie</label><input v-model.number="b.jasa_serie" type="number" min="0"></div>
                <div v-if="b.tipe==='vendor'" class="gc-field" style="margin-bottom:0;"><label>Jenis Vendor</label><input v-model="b.jenis_vendor" type="text"></div>
              </div>
            </div>
            <button @click="bukaKomponen(i)" type="button" class="btn-outline" style="font-size:11.5px; margin-top:10px;"><i class="fas fa-puzzle-piece" style="margin-right:5px;"></i>Kelola Komponen ({{ b.komponen.length }})</button>
          </div>
          <button @click="tambahPola" type="button" class="btn-outline" style="font-size:11.5px;"><i class="fas fa-plus" style="margin-right:5px;"></i>Tambah Baris Pola/Vendor</button>
        </div>

        <!-- BOM Aksesoris -->
        <div v-show="tabAktif==='aksesoris'">
          <div v-for="(a, i) in form.bom_aksesoris" :key="i" class="gc-card" style="margin-bottom:12px; background:var(--ivory-dim);">
            <div style="display:flex; justify-content:flex-end; margin-bottom:6px;">
              <button @click="hapusAksesoris(i)" type="button" class="icon-btn" style="color:var(--danger);" title="Hapus baris"><i class="fas fa-trash-alt"></i></button>
            </div>
            <div style="display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-3">
              <!-- GANTI (28 Agt 2026, permintaan Guru: "sambungkan dropdown
                   cari > Persiapan untuk Tahap") — dulu input teks bebas
                   polos, SEKARANG DropdownCari bersumber Config > Persiapan
                   Untuk Tahap (master_tahap_persiapan). TETAP nilai teks
                   bebas (bukan strict-select, lihat catatan opsiTahapPersiapan
                   di setup() atas komponen ini) — data lama yang belum
                   persis cocok ejaannya TETAP tampil normal. Field Firestore
                   TIDAK berubah nama (tetap 'tahap_proses'), dipakai juga
                   sebagai filter Persiapan Acc Sewing/Webbing/Finishing di
                   menu Persiapan Produksi V2 (js/vue-persiapan-produksi-v2.js
                   — nama file dikoreksi 30 Agt 2026, Fase 5 audit; versi
                   LAMA vue-persiapan-produksi.js sudah ditinggalkan). -->
              <div class="gc-field" style="margin-bottom:0;"><label>Tahap Proses <span style="font-weight:400; color:var(--text-faint);">(Persiapan Untuk Tahap)</span></label><dropdown-cari v-model="a.tahap_proses" :opsi="opsiTahapPersiapan" placeholder="Cari/isi tahap, mis. Sewing..." /></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Aksesoris (Nama + Warna)</label><dropdown-cari v-model="a.aksesoris_pilih" :opsi="opsiNamaBahan" placeholder="Cari & pilih..." @update:modelValue="saatPilihAksesoris(a)" /></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Qty</label><input v-model.number="a.qty" type="number" min="0"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Satuan</label><dropdown-cari v-model="a.satuan_pilih" :opsi="opsiSatuan" placeholder="Cari & pilih..." /></div>
              <div></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Kode Webbing 2 <span style="font-weight:400; color:var(--text-faint);">(opsional, teks bebas)</span></label><input v-model="a.webbing2" type="text" placeholder="Kode/catatan webbing 2..."></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Kode Webbing 3 <span style="font-weight:400; color:var(--text-faint);">(opsional, teks bebas)</span></label><input v-model="a.webbing3" type="text" placeholder="Kode/catatan webbing 3..."></div>
            </div>
          </div>
          <button @click="tambahAksesoris" type="button" class="btn-outline" style="font-size:11.5px;"><i class="fas fa-plus" style="margin-right:5px;"></i>Tambah Baris Aksesoris</button>
        </div>
      </div>

      <div style="display:flex; gap:8px; margin-top:16px;">
        <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="flex:1;">{{ mengupload ? 'Mengupload foto...' : (menyimpan ? 'Menyimpan...' : (modeEdit ? 'Simpan Perubahan' : 'Simpan Produk')) }}</button>
        <button v-if="modeEdit" @click="$emit('batal')" type="button" class="btn-outline" style="flex:1;">Batal</button>
      </div>

      <kelola-komponen-modal
        v-if="modalKomponenAktif !== null"
        :komponen="form.bom_pola[modalKomponenAktif].komponen"
        :nama-pola="form.bom_pola[modalKomponenAktif].nama_pola"
        :opsi-komponen="opsiKomponen"
        @tutup="tutupKomponen" />
    </div>
  `
};

// ---------------------------------------------------------------------------
// MasterProdukEntryManager — halaman "Entry Produk" (selalu mode CREATE,
// pola sama seperti BahanAksesorisEntryManager: form direset kosong lagi
// setelah simpan sukses, biar bisa langsung entry produk berikutnya).
// ---------------------------------------------------------------------------
const MasterProdukEntryManager = {
  components: { FormEntryProdukBOM },
  setup() {
    const kunciForm = ref(0); // ganti :key buat "reset" form total setelah simpan
    function saatTersimpan() {
      alert('Produk berhasil disimpan.');
      kunciForm.value++;
    }
    return { kunciForm, saatTersimpan };
  },
  template: `
    <div>
      <h3 class="gc-heading" style="font-weight:700; font-size:15px; margin-bottom:4px;"><i class="fas fa-box-open" style="color:var(--burgundy); margin-right:8px;"></i>Entry Produk (BOM)</h3>
      <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Data produk jadi konveksi lengkap dengan Bill of Material (Jasa, Pola/Vendor, Aksesoris) — jadi fondasi produksi.</p>
      <form-entry-produk-b-o-m :key="kunciForm" @tersimpan="saatTersimpan" />
    </div>
  `
};

// ---------------------------------------------------------------------------
// FieldValidasiInline — 1 sel tabel di popup verifikasi import: tampilkan
// nilai teks dari Excel + status valid/tidak, bisa langsung dikoreksi lewat
// DropdownCari (keputusan "kasih saran & bisa dikoreksi langsung di
// popup", bukan cuma tampilan baca-saja).
// ---------------------------------------------------------------------------
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
// PopupImportProdukUtama — tahap 1 dari 2. Validasi tiap baris (Nama wajib,
// Warna wajib cocok Data Warna, Size wajib, kombinasi Nama+Warna+Size tidak
// boleh dobel dalam 1 file) sebelum tombol Import aktif — SEMUA baris harus
// valid, TIDAK BISA import sebagian (keputusan "Ganti Total"). GANTI (28 Agt
// 2026, permintaan Hilman): kolom SKU DIHAPUS — SKU sekarang full otomatis
// dari sistem, dicocokkan/di-preview lewat kunciProduk (Nama+Warna+Size).
// ---------------------------------------------------------------------------
const PopupImportProdukUtama = {
  components: { FieldValidasiInline },
  props: {
    barisMentah: { type: Array, default: () => [] },
    opsiWarna: { type: Array, default: () => [] },
    opsiJenisProduk: { type: Array, default: () => [] },
    daftarProdukLama: { type: Array, default: () => [] },
    sedangImport: { type: Boolean, default: false }
  },
  emits: ['tutup', 'konfirmasi'],
  setup(props, { emit }) {
    const petaProdukLama = computed(() => {
      const peta = {};
      for (const p of props.daftarProdukLama) peta[kunciProduk(p.nama, p.warna, p.size)] = p;
      return peta;
    });

    const baris = ref(props.barisMentah.map(b => ({
      nama: String(b['Nama'] || '').trim(),
      jenis_produk: String(b['Jenis Produk'] || '').trim(),
      warna: String(b['Warna'] || '').trim(),
      size: String(b['Size'] || '').trim()
    })));

    const jumlahKunciDalamFile = computed(() => {
      const peta = {};
      for (const b of baris.value) {
        if (!b.nama || !b.warna || !b.size) continue;
        const kunci = kunciProduk(b.nama, b.warna, b.size);
        peta[kunci] = (peta[kunci] || 0) + 1;
      }
      return peta;
    });

    function statusBaris(b) {
      if (!b.nama) return { valid: false, label: 'Nama kosong', tipe: 'danger' };
      if (!validasiPilihan(b.jenis_produk, props.opsiJenisProduk).valid) return { valid: false, label: 'Jenis Produk belum valid', tipe: 'danger' };
      if (!validasiPilihan(b.warna, props.opsiWarna).valid) return { valid: false, label: 'Warna belum valid', tipe: 'danger' };
      if (!b.size) return { valid: false, label: 'Size kosong', tipe: 'danger' };
      const kunci = kunciProduk(b.nama, b.warna, b.size);
      if (jumlahKunciDalamFile.value[kunci] > 1) return { valid: false, label: 'Nama+Warna+Size dobel di file', tipe: 'danger' };
      const ada = petaProdukLama.value[kunci];
      return { valid: true, label: ada ? 'Update produk lama (SKU tetap)' : 'Produk baru (SKU otomatis)', tipe: ada ? 'warn' : 'ok' };
    }

    // previewSku — INFORMASI SAJA (bukan nilai final): produk lama pakai SKU
    // yang sudah ada (TIDAK berubah), produk baru pakai tebakan dasar dari
    // Nama-Warna-Size — SKU final sungguhan (bisa dapat akhiran -2/-3 kalau
    // ternyata tabrakan) baru ditentukan sistem saat tombol Import ditekan.
    function previewSku(b) {
      if (!b.nama || !b.warna || !b.size) return '-';
      const ada = petaProdukLama.value[kunciProduk(b.nama, b.warna, b.size)];
      if (ada) return ada.sku || '-';
      return buatSkuOtomatis(b.nama, b.warna, b.size);
    }

    const barisDenganStatus = computed(() => baris.value.map(b => ({ b, status: statusBaris(b) })));
    const semuaSiap = computed(() => baris.value.length > 0 && barisDenganStatus.value.every(x => x.status.valid));

    function konfirmasi() {
      if (!semuaSiap.value) return;
      emit('konfirmasi', baris.value.map(b => ({ ...b })));
    }

    return { baris, barisDenganStatus, semuaSiap, konfirmasi, previewSku };
  },
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:flex-start; justify-content:center; padding:16px; overflow-y:auto;">
      <div class="gc-card" style="max-width:820px; width:100%; margin:24px 0;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:4px;"><i class="fas fa-file-import" style="color:var(--burgundy); margin-right:8px;"></i>Verifikasi Import Produk Utama</h3>
        <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Periksa {{ baris.length }} baris dari file. Warna yang tidak cocok persis bisa dikoreksi langsung di sini. Produk yang Nama+Warna+Size-nya sudah terdaftar akan DIGANTI TOTAL datanya (bukan ditambah dobel) — SKU-nya TIDAK berubah. Produk baru dapat SKU otomatis dari sistem (kolom "SKU" di bawah cuma perkiraan, bisa dapat akhiran -2/-3 kalau ternyata tabrakan).</p>
        <div style="overflow-x:auto; margin-bottom:16px;">
          <table class="gc-table" style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
              <tr style="text-align:left; color:var(--text-faint); font-size:10.5px; text-transform:uppercase;">
                <th style="padding:6px;">Nama</th>
                <th style="padding:6px; min-width:150px;">Jenis Produk</th>
                <th style="padding:6px; min-width:160px;">Warna</th>
                <th style="padding:6px;">Size</th>
                <th style="padding:6px;">SKU (otomatis)</th>
                <th style="padding:6px;">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(x, i) in barisDenganStatus" :key="i" style="border-top:1px solid var(--line);">
                <td style="padding:6px;">{{ x.b.nama || '-' }}</td>
                <td style="padding:6px;"><field-validasi-inline v-model:nilai="x.b.jenis_produk" :opsi="opsiJenisProduk" /></td>
                <td style="padding:6px;"><field-validasi-inline v-model:nilai="x.b.warna" :opsi="opsiWarna" /></td>
                <td style="padding:6px;">{{ x.b.size || '-' }}</td>
                <td style="padding:6px; font-weight:700; color:var(--text-muted);">{{ previewSku(x.b) }}</td>
                <td style="padding:6px;"><span class="tag" :class="x.status.tipe">{{ x.status.label }}</span></td>
              </tr>
              <tr v-if="!barisDenganStatus.length"><td colspan="6" style="padding:14px; text-align:center; color:var(--text-faint);">File kosong / sheet "Produk Utama" tidak ada isinya.</td></tr>
            </tbody>
          </table>
        </div>
        <div v-if="!semuaSiap" style="font-size:11.5px; color:var(--danger); margin-bottom:10px;"><i class="fas fa-triangle-exclamation" style="margin-right:5px;"></i>Perbaiki dulu semua baris yang belum valid sebelum Import (tidak bisa sebagian).</div>
        <div style="display:flex; gap:8px;">
          <button @click="konfirmasi" :disabled="!semuaSiap || sedangImport" class="btn-primary" style="flex:1;">{{ sedangImport ? 'Mengimpor...' : ('Import ' + baris.length + ' Produk') }}</button>
          <button @click="$emit('tutup')" type="button" class="btn-outline" style="flex:1;" :disabled="sedangImport">Batal</button>
        </div>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// PopupImportBOM — tahap 2 dari 2 (jalan setelah produknya ada lewat Import
// Produk Utama). 4 tab (Jasa/Pola/Komponen/Aksesoris) dari 1 file, Komponen
// dicocokkan ke Pola lewat pasangan (Produk, Nama Pola) yang harus ada di
// sheet Pola. SEMUA baris di SEMUA sheet harus valid sebelum Import aktif.
// GANTI (28 Agt 2026, permintaan Hilman): dulu tiap baris dicocokkan ke
// produk lewat kolom SKU — SEKARANG lewat kolom Nama+Warna+Size (kunciProduk)
// karena SKU sudah tidak lagi diketik user di mana pun (full otomatis).
// ---------------------------------------------------------------------------
const PopupImportBOM = {
  components: { FieldValidasiInline },
  props: {
    barisJasa: { type: Array, default: () => [] },
    barisPola: { type: Array, default: () => [] },
    barisKomponen: { type: Array, default: () => [] },
    barisAksesoris: { type: Array, default: () => [] },
    opsiNamaBahan: { type: Array, default: () => [] },
    opsiKomponen: { type: Array, default: () => [] }, // BARU (§36) — Data Komponen (Config), sumber validasi sheet "Komponen" (GANTI dari opsiNamaBahan)
    opsiSatuan: { type: Array, default: () => [] },
    daftarProdukLama: { type: Array, default: () => [] },
    sedangImport: { type: Boolean, default: false }
  },
  emits: ['tutup', 'konfirmasi'],
  setup(props, { emit }) {
    const tabAktif = ref('jasa');
    const petaProdukAda = computed(() => {
      const peta = {};
      for (const p of props.daftarProdukLama) peta[kunciProduk(p.nama, p.warna, p.size)] = p;
      return peta;
    });
    function produkAda(nama, warna, size) { return !!(nama && warna && size && petaProdukAda.value[kunciProduk(nama, warna, size)]); }

    const jasa = ref(props.barisJasa.map(b => ({
      prodNama: String(b['Nama'] || '').trim(), prodWarna: String(b['Warna'] || '').trim(), prodSize: String(b['Size'] || '').trim(),
      nama: String(b['Nama Jasa'] || '').trim(), harga: b['Harga']
    })));
    function statusJasa(b) {
      if (!produkAda(b.prodNama, b.prodWarna, b.prodSize)) return { valid: false, label: 'Produk (Nama+Warna+Size) tidak ditemukan (Import Produk Utama dulu)' };
      if (!b.nama) return { valid: false, label: 'Nama Jasa kosong' };
      if (b.harga === '' || isNaN(Number(b.harga))) return { valid: false, label: 'Harga harus angka' };
      return { valid: true, label: 'OK' };
    }

    const pola = ref(props.barisPola.map(b => ({
      prodNama: String(b['Nama'] || '').trim(), prodWarna: String(b['Warna'] || '').trim(), prodSize: String(b['Size'] || '').trim(),
      tipe: String(b['Tipe (internal/vendor)'] || '').trim().toLowerCase(),
      nama_pola: String(b['Nama Pola'] || '').trim(),
      bahan: String(b['Bahan (Nama + Warna)'] || '').trim(),
      panjang: b['Panjang'], isi_pola_pcs: b['Isi Pola (Pcs)'],
      jasa_cutting: b['Jasa Cutting'], jasa_serie: b['Jasa Serie'],
      jenis_vendor: String(b['Jenis Vendor'] || '').trim()
    })));
    function statusPola(b) {
      if (!produkAda(b.prodNama, b.prodWarna, b.prodSize)) return { valid: false, label: 'Produk (Nama+Warna+Size) tidak ditemukan' };
      if (b.tipe !== 'internal' && b.tipe !== 'vendor') return { valid: false, label: 'Tipe harus "internal" atau "vendor"' };
      if (!b.nama_pola) return { valid: false, label: 'Nama Pola kosong' };
      if (!validasiPilihan(b.bahan, props.opsiNamaBahan).valid) return { valid: false, label: 'Bahan belum valid' };
      if (b.panjang === '' || isNaN(Number(b.panjang))) return { valid: false, label: 'Panjang harus angka' };
      if (b.isi_pola_pcs === '' || isNaN(Number(b.isi_pola_pcs))) return { valid: false, label: 'Isi Pola (Pcs) harus angka' };
      if (b.jasa_cutting === '' || isNaN(Number(b.jasa_cutting))) return { valid: false, label: 'Jasa Cutting harus angka' };
      if (b.jasa_serie === '' || isNaN(Number(b.jasa_serie))) return { valid: false, label: 'Jasa Serie harus angka' };
      return { valid: true, label: 'OK' };
    }
    const kunciProdukPola = computed(() => new Set(pola.value.filter(p => p.prodNama && p.prodWarna && p.prodSize && p.nama_pola).map(p => kunciProduk(p.prodNama, p.prodWarna, p.prodSize) + '||' + p.nama_pola.toLowerCase())));

    const komponen = ref(props.barisKomponen.map(b => ({
      prodNama: String(b['Nama'] || '').trim(), prodWarna: String(b['Warna'] || '').trim(), prodSize: String(b['Size'] || '').trim(),
      nama_pola: String(b['Nama Pola'] || '').trim(),
      nama_komponen: String(b['Komponen'] || '').trim(), // GANTI (§36): dulu kolom 'Nama Komponen (Nama + Warna)'
      qty: b['Qty']
    })));
    function statusKomponen(b) {
      if (!produkAda(b.prodNama, b.prodWarna, b.prodSize)) return { valid: false, label: 'Produk (Nama+Warna+Size) tidak ditemukan' };
      if (!b.nama_pola || !kunciProdukPola.value.has(kunciProduk(b.prodNama, b.prodWarna, b.prodSize) + '||' + b.nama_pola.toLowerCase())) return { valid: false, label: 'Nama Pola tidak cocok baris di sheet Pola (Produk sama)' };
      if (!validasiPilihan(b.nama_komponen, props.opsiKomponen).valid) return { valid: false, label: 'Komponen belum valid (cek Data Komponen di Config)' };
      if (b.qty === '' || isNaN(Number(b.qty))) return { valid: false, label: 'Qty harus angka' };
      return { valid: true, label: 'OK' };
    }

    const aksesoris = ref(props.barisAksesoris.map(b => ({
      prodNama: String(b['Nama'] || '').trim(), prodWarna: String(b['Warna'] || '').trim(), prodSize: String(b['Size'] || '').trim(),
      tahap_proses: String(b['Tahap Proses'] || '').trim(),
      aksesoris: String(b['Aksesoris (Nama + Warna)'] || '').trim(),
      qty: b['Qty'], satuan: String(b['Satuan'] || '').trim(),
      // GANTI (28 Agt 2026, §38): dulu kolom 'Kode Webbing 2/3 (Nama + Warna)',
      // sekarang teks bebas — kolomnya juga diganti nama jadi 'Kode Webbing 2/3'.
      webbing2: String(b['Kode Webbing 2'] || '').trim(),
      webbing3: String(b['Kode Webbing 3'] || '').trim()
    })));
    function statusAksesoris(b) {
      if (!produkAda(b.prodNama, b.prodWarna, b.prodSize)) return { valid: false, label: 'Produk (Nama+Warna+Size) tidak ditemukan' };
      if (!b.tahap_proses) return { valid: false, label: 'Tahap Proses kosong' };
      if (!validasiPilihan(b.aksesoris, props.opsiNamaBahan).valid) return { valid: false, label: 'Aksesoris belum valid' };
      if (b.qty === '' || isNaN(Number(b.qty))) return { valid: false, label: 'Qty harus angka' };
      if (!validasiPilihan(b.satuan, props.opsiSatuan).valid) return { valid: false, label: 'Satuan belum valid' };
      // Kode Webbing 2/3 — DIHAPUS validasinya (28 Agt 2026, §38): SEKARANG
      // teks bebas/opsional, tidak perlu divalidasi ke Data Bahan & Aksesoris.
      return { valid: true, label: 'OK' };
    }

    const jasaDenganStatus = computed(() => jasa.value.map(b => ({ b, status: statusJasa(b) })));
    const polaDenganStatus = computed(() => pola.value.map(b => ({ b, status: statusPola(b) })));
    const komponenDenganStatus = computed(() => komponen.value.map(b => ({ b, status: statusKomponen(b) })));
    const aksesorisDenganStatus = computed(() => aksesoris.value.map(b => ({ b, status: statusAksesoris(b) })));

    const jumlahError = computed(() =>
      jasaDenganStatus.value.filter(x => !x.status.valid).length +
      polaDenganStatus.value.filter(x => !x.status.valid).length +
      komponenDenganStatus.value.filter(x => !x.status.valid).length +
      aksesorisDenganStatus.value.filter(x => !x.status.valid).length
    );
    const semuaSiap = computed(() => {
      const adaBaris = jasa.value.length || pola.value.length || komponen.value.length || aksesoris.value.length;
      return !!adaBaris && jumlahError.value === 0;
    });

    function konfirmasi() {
      if (!semuaSiap.value) return;
      emit('konfirmasi', {
        jasa: jasa.value.map(b => ({ prodNama: b.prodNama, prodWarna: b.prodWarna, prodSize: b.prodSize, nama: b.nama, harga: Number(b.harga) || 0 })),
        pola: pola.value.map(b => ({ prodNama: b.prodNama, prodWarna: b.prodWarna, prodSize: b.prodSize, tipe: b.tipe, nama_pola: b.nama_pola, bahan: b.bahan, panjang: Number(b.panjang) || 0, isi_pola_pcs: Number(b.isi_pola_pcs) || 0, jasa_cutting: Number(b.jasa_cutting) || 0, jasa_serie: Number(b.jasa_serie) || 0, jenis_vendor: b.jenis_vendor })),
        komponen: komponen.value.map(b => ({ prodNama: b.prodNama, prodWarna: b.prodWarna, prodSize: b.prodSize, nama_pola: b.nama_pola, nama_komponen: b.nama_komponen, qty: Number(b.qty) || 0 })),
        aksesoris: aksesoris.value.map(b => ({ prodNama: b.prodNama, prodWarna: b.prodWarna, prodSize: b.prodSize, tahap_proses: b.tahap_proses, aksesoris: b.aksesoris, qty: Number(b.qty) || 0, satuan: b.satuan, webbing2: b.webbing2, webbing3: b.webbing3 }))
      });
    }

    return { tabAktif, jasaDenganStatus, polaDenganStatus, komponenDenganStatus, aksesorisDenganStatus, jumlahError, semuaSiap, konfirmasi };
  },
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:flex-start; justify-content:center; padding:16px; overflow-y:auto;">
      <div class="gc-card" style="max-width:960px; width:100%; margin:24px 0;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:4px;"><i class="fas fa-file-import" style="color:var(--burgundy); margin-right:8px;"></i>Verifikasi Import BOM</h3>
        <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Produk (Nama+Warna+Size) harus sudah terdaftar di Data Produk (Import Produk Utama dulu). BOM lama produk yang kena akan DIGANTI TOTAL, bukan ditambah.</p>

        <div style="display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap;">
          <button @click="tabAktif='jasa'" type="button" class="btn-outline" :class="{filled: tabAktif==='jasa'}" style="font-size:11.5px;">Jasa ({{ jasaDenganStatus.length }})</button>
          <button @click="tabAktif='pola'" type="button" class="btn-outline" :class="{filled: tabAktif==='pola'}" style="font-size:11.5px;">Pola ({{ polaDenganStatus.length }})</button>
          <button @click="tabAktif='komponen'" type="button" class="btn-outline" :class="{filled: tabAktif==='komponen'}" style="font-size:11.5px;">Komponen ({{ komponenDenganStatus.length }})</button>
          <button @click="tabAktif='aksesoris'" type="button" class="btn-outline" :class="{filled: tabAktif==='aksesoris'}" style="font-size:11.5px;">Aksesoris ({{ aksesorisDenganStatus.length }})</button>
        </div>

        <div v-show="tabAktif==='jasa'" style="overflow-x:auto; margin-bottom:14px;">
          <table class="gc-table" style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead><tr style="text-align:left; color:var(--text-faint); font-size:10.5px; text-transform:uppercase;"><th style="padding:6px; min-width:160px;">Produk (Nama &middot; Warna &middot; Size)</th><th style="padding:6px;">Nama Jasa</th><th style="padding:6px;">Harga</th><th style="padding:6px;">Status</th></tr></thead>
            <tbody>
              <tr v-for="(x,i) in jasaDenganStatus" :key="i" style="border-top:1px solid var(--line);">
                <td style="padding:6px; font-weight:700;">{{ x.b.prodNama || '-' }} &middot; {{ x.b.prodWarna || '-' }} &middot; {{ x.b.prodSize || '-' }}</td>
                <td style="padding:6px;">{{ x.b.nama || '-' }}</td>
                <td style="padding:6px;">{{ x.b.harga }}</td>
                <td style="padding:6px;"><span class="tag" :class="x.status.valid ? 'ok' : 'danger'">{{ x.status.label }}</span></td>
              </tr>
              <tr v-if="!jasaDenganStatus.length"><td colspan="4" style="padding:14px; text-align:center; color:var(--text-faint);">Sheet "Jasa" kosong.</td></tr>
            </tbody>
          </table>
        </div>

        <div v-show="tabAktif==='pola'" style="overflow-x:auto; margin-bottom:14px;">
          <table class="gc-table" style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead><tr style="text-align:left; color:var(--text-faint); font-size:10.5px; text-transform:uppercase;"><th style="padding:6px; min-width:160px;">Produk (Nama &middot; Warna &middot; Size)</th><th style="padding:6px;">Tipe</th><th style="padding:6px;">Nama Pola</th><th style="padding:6px; min-width:160px;">Bahan</th><th style="padding:6px;">Status</th></tr></thead>
            <tbody>
              <tr v-for="(x,i) in polaDenganStatus" :key="i" style="border-top:1px solid var(--line);">
                <td style="padding:6px; font-weight:700;">{{ x.b.prodNama || '-' }} &middot; {{ x.b.prodWarna || '-' }} &middot; {{ x.b.prodSize || '-' }}</td>
                <td style="padding:6px;">{{ x.b.tipe || '-' }}</td>
                <td style="padding:6px;">{{ x.b.nama_pola || '-' }}</td>
                <td style="padding:6px;"><field-validasi-inline v-model:nilai="x.b.bahan" :opsi="opsiNamaBahan" /></td>
                <td style="padding:6px;"><span class="tag" :class="x.status.valid ? 'ok' : 'danger'">{{ x.status.label }}</span></td>
              </tr>
              <tr v-if="!polaDenganStatus.length"><td colspan="5" style="padding:14px; text-align:center; color:var(--text-faint);">Sheet "Pola" kosong.</td></tr>
            </tbody>
          </table>
        </div>

        <div v-show="tabAktif==='komponen'" style="overflow-x:auto; margin-bottom:14px;">
          <table class="gc-table" style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead><tr style="text-align:left; color:var(--text-faint); font-size:10.5px; text-transform:uppercase;"><th style="padding:6px; min-width:160px;">Produk (Nama &middot; Warna &middot; Size)</th><th style="padding:6px;">Nama Pola</th><th style="padding:6px; min-width:160px;">Komponen</th><th style="padding:6px;">Qty</th><th style="padding:6px;">Status</th></tr></thead>
            <tbody>
              <tr v-for="(x,i) in komponenDenganStatus" :key="i" style="border-top:1px solid var(--line);">
                <td style="padding:6px; font-weight:700;">{{ x.b.prodNama || '-' }} &middot; {{ x.b.prodWarna || '-' }} &middot; {{ x.b.prodSize || '-' }}</td>
                <td style="padding:6px;">{{ x.b.nama_pola || '-' }}</td>
                <td style="padding:6px;"><field-validasi-inline v-model:nilai="x.b.nama_komponen" :opsi="opsiKomponen" /></td>
                <td style="padding:6px;">{{ x.b.qty }}</td>
                <td style="padding:6px;"><span class="tag" :class="x.status.valid ? 'ok' : 'danger'">{{ x.status.label }}</span></td>
              </tr>
              <tr v-if="!komponenDenganStatus.length"><td colspan="5" style="padding:14px; text-align:center; color:var(--text-faint);">Sheet "Komponen" kosong.</td></tr>
            </tbody>
          </table>
        </div>

        <div v-show="tabAktif==='aksesoris'" style="overflow-x:auto; margin-bottom:14px;">
          <table class="gc-table" style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead><tr style="text-align:left; color:var(--text-faint); font-size:10.5px; text-transform:uppercase;"><th style="padding:6px; min-width:160px;">Produk (Nama &middot; Warna &middot; Size)</th><th style="padding:6px;">Tahap</th><th style="padding:6px; min-width:150px;">Aksesoris</th><th style="padding:6px;">Qty</th><th style="padding:6px; min-width:120px;">Satuan</th><th style="padding:6px;">Status</th></tr></thead>
            <tbody>
              <tr v-for="(x,i) in aksesorisDenganStatus" :key="i" style="border-top:1px solid var(--line);">
                <td style="padding:6px; font-weight:700;">{{ x.b.prodNama || '-' }} &middot; {{ x.b.prodWarna || '-' }} &middot; {{ x.b.prodSize || '-' }}</td>
                <td style="padding:6px;">{{ x.b.tahap_proses || '-' }}</td>
                <td style="padding:6px;"><field-validasi-inline v-model:nilai="x.b.aksesoris" :opsi="opsiNamaBahan" /></td>
                <td style="padding:6px;">{{ x.b.qty }}</td>
                <td style="padding:6px;"><field-validasi-inline v-model:nilai="x.b.satuan" :opsi="opsiSatuan" /></td>
                <td style="padding:6px;"><span class="tag" :class="x.status.valid ? 'ok' : 'danger'">{{ x.status.label }}</span></td>
              </tr>
              <tr v-if="!aksesorisDenganStatus.length"><td colspan="6" style="padding:14px; text-align:center; color:var(--text-faint);">Sheet "Aksesoris" kosong.</td></tr>
            </tbody>
          </table>
        </div>

        <div v-if="!semuaSiap" style="font-size:11.5px; color:var(--danger); margin-bottom:10px;"><i class="fas fa-triangle-exclamation" style="margin-right:5px;"></i>Ada {{ jumlahError }} baris belum valid di semua sheet. Perbaiki dulu semua (tidak bisa sebagian) sebelum Import.</div>
        <div style="display:flex; gap:8px;">
          <button @click="konfirmasi" :disabled="!semuaSiap || sedangImport" class="btn-primary" style="flex:1;">{{ sedangImport ? 'Mengimpor...' : 'Import BOM' }}</button>
          <button @click="$emit('tutup')" type="button" class="btn-outline" style="flex:1;" :disabled="sedangImport">Batal</button>
        </div>
      </div>
    </div>
  `
};

// formatRupiah/hitungBreakdownPola/totalHargaJasa/totalKomponenPola — BARU
// (28 Agt 2026, redesign kartu List Produk atas permintaan Guru: "bantu
// redesign kartu list produk, saya takjub dengan kartu list bahan &
// aksesoris ada foto juga"). formatRupiah sengaja disalin persis dari pola
// yang sama di js/vue-bahan-aksesoris.js (tiap file vue-*.js di proyek ini
// punya salinan lokalnya sendiri, tidak ada util currency global).
function formatRupiah(n) {
  const angka = parseFloat(n) || 0;
  return 'Rp ' + Math.round(angka).toLocaleString('id-ID');
}
function hitungBreakdownPola(item) {
  const pola = item.bom_pola || [];
  const vendor = pola.filter(p => p.tipe === 'vendor').length;
  return { total: pola.length, internal: pola.length - vendor, vendor };
}
function totalHargaJasa(item) {
  return (item.bom_jasa || []).reduce((sum, j) => sum + (parseFloat(j.harga) || 0), 0);
}
function totalKomponenPola(item) {
  return (item.bom_pola || []).reduce((sum, p) => sum + ((p.komponen || []).length), 0);
}
// polaUtama — BARU (28 Agt 2026, §41.1). Ambil baris PERTAMA `bom_pola`
// (nama_pola + tipe internal/vendor + nama_bahan/warna_bahan-nya) buat
// ditampilkan di blok kartu-rows List Produk (GANTI dari tanggal Dibuat/
// Diedit yang Guru bilang kurang berguna). Object kosong kalau belum ada
// baris Pola sama sekali (template pakai `|| '-'` buat itu).
function polaUtama(item) {
  const p = (item.bom_pola || [])[0];
  if (!p) return { nama: '', tipe: '', bahan: '' };
  return {
    nama: p.nama_pola || '',
    tipe: p.tipe === 'vendor' ? 'Vendor' : 'Internal',
    bahan: p.nama_bahan ? (p.nama_bahan + (p.warna_bahan ? ' ' + p.warna_bahan : '')) : ''
  };
}

// ---------------------------------------------------------------------------
// MasterProdukListManager — halaman "List Produk": cari+paginasi+tabel,
// modal edit (pakai ulang FormEntryProdukBOM), hapus (termasuk hapus foto
// di Storage kalau ada, biar tidak numpuk file yatim — pola sama seperti
// hapus() di js/vue-config-info.js).
// ---------------------------------------------------------------------------
const MasterProdukListManager = {
  components: { FormEntryProdukBOM, PopupImportProdukUtama, PopupImportBOM },
  setup() {
    const bolehHapus = computed(() => window.cekIzinMenu('master_produk_list', 'delete') !== false);

    // --- Hitung Ulang Kelipatan Semua Produk (BARU 28 Agt 2026, permintaan
    // Guru) --------------------------------------------------------------
    // Field `kelipatan` (§42.2) BARU dihitung & disimpan pas produk
    // di-SIMPAN — produk LAMA yang sudah ada dari SEBELUM fitur ini belum
    // pernah tersentuh, jadi `kelipatan`-nya masih kosong sampai dibuka +
    // Simpan manual satu-satu. Guru minta cara lebih cepat: 1 tombol,
    // backfill SEMUA produk sekaligus tanpa perlu buka satu-satu.
    //
    // Hemat tulis (PRINSIP-HEMAT.md): kalau `kelipatan` yang SUDAH
    // tersimpan di suatu produk KEBETULAN sudah sama dengan hasil hitung
    // ulang (termasuk produk yang memang belum pernah punya BOM Pola sama
    // sekali, keduanya 0), produk itu DILEWATI — tidak ada `updateDoc()`
    // percuma. Field LAIN produk (nama/foto/BOM/dst) SAMA SEKALI tidak
    // disentuh, cuma `kelipatan` yang ditimpa kalau beda.
    const sedangHitungKelipatan = ref(false);
    async function hitungUlangKelipatanSemua() {
      if (!confirm('Hitung ulang field Kelipatan untuk SEMUA produk sekaligus, berdasarkan Isi Pola BOM yang tersimpan saat ini? Field lain tiap produk TIDAK ikut berubah.')) return;
      sedangHitungKelipatan.value = true;
      try {
        const semuaProduk = await ambilSemuaProduk();
        let diupdate = 0, dilewati = 0;
        for (const p of semuaProduk) {
          const kelipatanBaru = hitungKelipatan(p.bom_pola || []);
          if ((p.kelipatan || 0) === kelipatanBaru) { dilewati++; continue; }
          await updateDoc(doc(db, 'master_produk', p.id), { kelipatan: kelipatanBaru });
          diupdate++;
        }
        await paginasi.muatUlang();
        alert(`Selesai: ${diupdate} produk diperbarui, ${dilewati} sudah sesuai (dilewati, hemat tulis).`);
      } catch (e) {
        console.error('Gagal hitung ulang Kelipatan semua produk:', e);
        alert('Gagal menghitung ulang Kelipatan. Coba lagi.');
      }
      sedangHitungKelipatan.value = false;
    }

    // CATATAN (28 Agt 2026, role "PIC Owner") — sempat dicoba tambah
    // filterPeran jenis_pekerjaan di sini, TAPI DIBATALKAN: Guru
    // konfirmasi SELURUH grup menu Zevanic House (termasuk Master Produk)
    // memang 100% bisnis ZCO/Konveksi, jadi filter per-produk tidak ada
    // gunanya (PIC Owner cukup diberi akses lewat menu, tidak perlu tag
    // apa-apa). Filter jenis usaha yang BENAR-BENAR perlu cukup di
    // Reimburse (satu-satunya menu lintas JNT/ZCO) — lihat STATUS-
    // PROYEK.md §29.
    const paginasi = usePaginasiFirestore(db, 'master_produk', {
      perHalaman: 15,
      urutkanField: 'nama',
      cariField: 'nama',
      petakan: (id, d) => ({ id, ...d })
    });

    const sedangEdit = ref(null); // objek produk (termasuk id) yang lagi diedit, null = modal tertutup

    function bukaEdit(item) { sedangEdit.value = item; }
    function tutupEdit() { sedangEdit.value = null; }
    function saatTersimpanEdit() {
      sedangEdit.value = null;
      paginasi.muatUlang();
    }

    async function hapus(item) {
      if (!bolehHapus.value) return alert('Anda tidak punya izin menghapus di sini. Hubungi Owner/PIC.');
      if (!confirm(`Hapus produk "${item.nama}" (SKU: ${item.sku})? Foto yang sudah diupload juga akan dihapus.`)) return;
      try {
        await deleteDoc(doc(db, 'master_produk', item.id));
        if (item.foto) await hapusFotoProdukLama(item.foto);
        for (const b of (item.bom_pola || [])) { if (b.foto) await hapusFotoProdukLama(b.foto); }
        await paginasi.muatUlang();
      } catch (e) {
        console.error('Gagal hapus Master Produk:', e);
        alert('Gagal menghapus.');
      }
    }

    // --- Checkbox pilih + Hapus Massal (28 Agt 2026) ------------------------
    // produkTerpilih menyimpan id produk yang dicentang. SENGAJA tidak
    // direset saat pindah halaman paginasi, supaya bisa pilih produk dari
    // beberapa halaman sekaligus sebelum hapus massal.
    const produkTerpilih = ref([]);
    function toggleCentang(id) {
      const i = produkTerpilih.value.indexOf(id);
      if (i === -1) produkTerpilih.value.push(id); else produkTerpilih.value.splice(i, 1);
    }
    const semuaTercentang = computed(() => {
      const halaman = paginasi.dataHalaman.value;
      return halaman.length > 0 && halaman.every(it => produkTerpilih.value.includes(it.id));
    });
    function toggleSemua() {
      const idHalaman = paginasi.dataHalaman.value.map(it => it.id);
      if (semuaTercentang.value) {
        produkTerpilih.value = produkTerpilih.value.filter(id => !idHalaman.includes(id));
      } else {
        produkTerpilih.value = [...new Set([...produkTerpilih.value, ...idHalaman])];
      }
    }
    async function hapusMassal() {
      if (!bolehHapus.value) return alert('Anda tidak punya izin menghapus di sini. Hubungi Owner/PIC.');
      const jumlah = produkTerpilih.value.length;
      if (jumlah === 0) return;
      if (!confirm(`Hapus ${jumlah} produk terpilih? Foto yang sudah diupload juga akan dihapus. Tindakan ini tidak bisa dibatalkan.`)) return;
      const idGagal = [];
      for (const id of produkTerpilih.value) {
        try {
          const item = paginasi.dataHalaman.value.find(it => it.id === id);
          await deleteDoc(doc(db, 'master_produk', id));
          if (item && item.foto) await hapusFotoProdukLama(item.foto);
          for (const b of (item && item.bom_pola || [])) { if (b.foto) await hapusFotoProdukLama(b.foto); }
        } catch (e) {
          console.error('Gagal hapus produk (massal), id:', id, e);
          idGagal.push(id);
        }
      }
      produkTerpilih.value = idGagal;
      await paginasi.muatUlang();
      if (idGagal.length > 0) alert(`${idGagal.length} dari ${jumlah} produk gagal dihapus. Coba lagi untuk yang tersisa.`);
    }

    onMounted(async () => { await window.authReady; await paginasi.muatUlang(); });

    // --- Import/Export Excel (§28.9) ---------------------------------------
    const dropdownImportTerbuka = ref(false);
    const inputFileProdukUtama = ref(null);
    const inputFileBOM = ref(null);

    const opsiNamaBahanImport = ref([]);
    const opsiKomponenImport = ref([]); // BARU (§36) — Data Komponen (Config), sumber validasi sheet "Komponen"
    const opsiWarnaImport = ref([]);
    const opsiSatuanImport = ref([]);
    const opsiJenisProdukImport = ref([]);
    const daftarBahanImport = ref([]);
    const daftarProdukSemuaImport = ref([]); // SEMUA produk (bukan cuma 1 halaman paginasi.dataHalaman) — dipakai buat cek SKU sudah ada/belum

    const popupImportProdukUtamaAktif = ref(false);
    const barisMentahProdukUtama = ref([]);
    const sedangImportProdukUtama = ref(false);

    const popupImportBOMAktif = ref(false);
    const barisMentahJasa = ref([]);
    const barisMentahPola = ref([]);
    const barisMentahKomponen = ref([]);
    const barisMentahAksesoris = ref([]);
    const sedangImportBOM = ref(false);

    // muatSemuaReferensiImport — SELALU ambil data referensi & daftar produk
    // TERBARU tiap kali mau import (bukan cache lama), biar validasi Nama
    // Bahan/Warna/Satuan/SKU pasti sesuai kondisi data SAAT INI.
    async function muatSemuaReferensiImport() {
      const [bahan, warna, satuan, jenisProduk, komponen, semuaProduk] = await Promise.all([
        ambilDaftarBahanAksesorisLengkap(),
        ambilDaftarNama('master_warna'),
        ambilDaftarNama('master_satuan'),
        ambilDaftarNama('master_jenis_produk'),
        ambilDaftarNama('master_komponen'), // BARU (§36) — Data Komponen (Config)
        ambilSemuaProduk()
      ]);
      daftarBahanImport.value = bahan;
      opsiNamaBahanImport.value = bahan.map(b => formatNamaBahan(b));
      opsiKomponenImport.value = komponen;
      opsiWarnaImport.value = warna;
      opsiSatuanImport.value = satuan;
      opsiJenisProdukImport.value = jenisProduk;
      daftarProdukSemuaImport.value = semuaProduk;
    }

    function bukaTemplateProdukUtama() { unduhTemplateProdukUtama(); dropdownImportTerbuka.value = false; }
    function bukaTemplateBOM() { unduhTemplateBOM(); dropdownImportTerbuka.value = false; }
    function pancingFileProdukUtama() { dropdownImportTerbuka.value = false; inputFileProdukUtama.value?.click(); }
    function pancingFileBOM() { dropdownImportTerbuka.value = false; inputFileBOM.value?.click(); }

    async function saatFileProdukUtamaDipilih(ev) {
      const file = ev.target.files[0];
      ev.target.value = ''; // reset biar file sama bisa dipilih ulang
      if (!file) return;
      try {
        const wb = await bacaFileExcel(file);
        const baris = ambilSheet(wb, 'Produk Utama');
        if (!baris.length) return alert('Sheet "Produk Utama" tidak ditemukan atau kosong. Pastikan file berasal dari Template Import Produk Utama.');
        await muatSemuaReferensiImport();
        barisMentahProdukUtama.value = baris;
        popupImportProdukUtamaAktif.value = true;
      } catch (e) {
        console.error('Gagal baca file Produk Utama:', e);
        alert('Gagal membaca file Excel. Pastikan formatnya benar (.xlsx).');
      }
    }

    async function saatFileBOMDipilih(ev) {
      const file = ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      try {
        const wb = await bacaFileExcel(file);
        const jasa = ambilSheet(wb, 'Jasa');
        const pola = ambilSheet(wb, 'Pola');
        const komponen = ambilSheet(wb, 'Komponen');
        const aksesoris = ambilSheet(wb, 'Aksesoris');
        if (!jasa.length && !pola.length && !komponen.length && !aksesoris.length) {
          return alert('Ke-4 sheet (Jasa, Pola, Komponen, Aksesoris) tidak ditemukan atau semuanya kosong. Pastikan file berasal dari Template Import BOM.');
        }
        await muatSemuaReferensiImport();
        barisMentahJasa.value = jasa;
        barisMentahPola.value = pola;
        barisMentahKomponen.value = komponen;
        barisMentahAksesoris.value = aksesoris;
        popupImportBOMAktif.value = true;
      } catch (e) {
        console.error('Gagal baca file BOM:', e);
        alert('Gagal membaca file Excel. Pastikan formatnya benar (.xlsx).');
      }
    }

    function tutupPopupImportProdukUtama() { popupImportProdukUtamaAktif.value = false; }
    function tutupPopupImportBOM() { popupImportBOMAktif.value = false; }

    // konfirmasiImportProdukUtama — GANTI (28 Agt 2026, permintaan Hilman):
    // dulu upsert per SKU (kolom SKU wajib diisi user di Excel), SEKARANG
    // upsert per kombinasi Nama+Warna+Size (kunciProduk) karena SKU sudah
    // tidak lagi diketik user — produk yang kuncinya sudah ada -> TIMPA nama/
    // jenis_produk/warna/size-nya (bukan bikin dobel), SKU LAMA DIPERTAHANKAN
    // (tidak digenerate ulang, biar konsisten dengan SKU yang mungkin sudah
    // dipakai fisik, mis. label tercetak); kunci belum ada -> dokumen baru
    // dengan SKU baru digenerate otomatis dari Nama-Warna-Size (tambah
    // akhiran -2/-3/dst kalau ternyata basis SKU-nya tabrakan — dicek pakai
    // Set skuTerpakai yang di-seed dari SKU semua produk yang sudah ada,
    // supaya TIDAK perlu query Firestore berulang tiap baris).
    async function konfirmasiImportProdukUtama(barisSiap) {
      sedangImportProdukUtama.value = true;
      try {
        const semuaProduk = await ambilSemuaProduk();
        const petaLama = {};
        const skuTerpakai = new Set();
        for (const p of semuaProduk) {
          petaLama[kunciProduk(p.nama, p.warna, p.size)] = p;
          if (p.sku) skuTerpakai.add(p.sku.toUpperCase());
        }
        let dibuat = 0, diupdate = 0;
        for (const b of barisSiap) {
          const kunci = kunciProduk(b.nama, b.warna, b.size);
          const lama = petaLama[kunci];
          if (lama) {
            await updateDoc(doc(db, 'master_produk', lama.id), {
              nama: b.nama, jenis_produk: b.jenis_produk, warna: b.warna, size: b.size,
              diedit_pada: serverTimestamp(), diedit_oleh: window.currentUser?.email || null
            });
            diupdate++;
          } else {
            let sku = buatSkuOtomatis(b.nama, b.warna, b.size);
            let n = 1;
            while (skuTerpakai.has(sku)) { n++; sku = buatSkuOtomatis(b.nama, b.warna, b.size) + '-' + n; }
            skuTerpakai.add(sku);
            const idBaru = doc(collection(db, 'master_produk')).id;
            await setDoc(doc(db, 'master_produk', idBaru), {
              sku, nama: b.nama, jenis_produk: b.jenis_produk, warna: b.warna, size: b.size,
              foto: '', bom_jasa: [], bom_pola: [], bom_aksesoris: [],
              dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
            });
            // simpan produk baru ini juga ke petaLama — jaga-jaga kalau ada
            // baris lain di barisSiap dengan kunci SAMA PERSIS (seharusnya
            // sudah ditolak validasi "dobel di file" di popup, tapi jaga-jaga).
            petaLama[kunci] = { id: idBaru, sku, nama: b.nama, warna: b.warna, size: b.size };
            dibuat++;
          }
        }
        popupImportProdukUtamaAktif.value = false;
        await paginasi.muatUlang();
        alert(`Import selesai: ${dibuat} produk baru, ${diupdate} produk diperbarui.`);
      } catch (e) {
        console.error('Gagal import Produk Utama:', e);
        alert('Gagal mengimpor. Coba lagi.');
      }
      sedangImportProdukUtama.value = false;
    }

    // konfirmasiImportBOM — GANTI (28 Agt 2026, permintaan Hilman): dulu
    // dikelompokkan per SKU, SEKARANG per kombinasi Nama+Warna+Size
    // (kunciProduk) karena SKU sudah tidak lagi diketik user di sheet BOM.
    // TIMPA TOTAL bom_jasa/bom_pola/bom_aksesoris produk itu (keputusan
    // "Ganti Total", bukan tambah/gabung dengan BOM lama). Komponen
    // dicocokkan ke Pola lewat (Produk, Nama Pola) — sudah divalidasi cocok
    // di popup sebelum sampai sini.
    async function konfirmasiImportBOM(payload) {
      sedangImportBOM.value = true;
      try {
        const semuaProduk = await ambilSemuaProduk();
        const petaProduk = {};
        for (const p of semuaProduk) petaProduk[kunciProduk(p.nama, p.warna, p.size)] = p;

        const kunciTerpengaruh = new Set([
          ...payload.jasa.map(x => kunciProduk(x.prodNama, x.prodWarna, x.prodSize)),
          ...payload.pola.map(x => kunciProduk(x.prodNama, x.prodWarna, x.prodSize)),
          ...payload.aksesoris.map(x => kunciProduk(x.prodNama, x.prodWarna, x.prodSize))
        ]);

        let jumlahProdukDiupdate = 0;
        for (const kunci of kunciTerpengaruh) {
          const produk = petaProduk[kunci];
          if (!produk) continue; // sudah divalidasi ada di popup, jaga-jaga saja

          const bomJasa = payload.jasa.filter(x => kunciProduk(x.prodNama, x.prodWarna, x.prodSize) === kunci)
            .map(x => ({ nama: x.nama, harga: x.harga }));

          const polaUntukProduk = payload.pola.filter(x => kunciProduk(x.prodNama, x.prodWarna, x.prodSize) === kunci);
          const bomPola = polaUntukProduk.map(p => {
            const item = resolveBahan(daftarBahanImport.value, p.bahan);
            // GANTI (28 Agt 2026, §36): Komponen SEKARANG dari Data Komponen
            // (Config, plain text) — TIDAK ADA LAGI resolveBahan/
            // bahan_aksesoris_id di baris ini, sama format dengan baris
            // Komponen dari form manual (§34).
            const komponenBaris = payload.komponen
              .filter(k => kunciProduk(k.prodNama, k.prodWarna, k.prodSize) === kunci && k.nama_pola.toLowerCase() === p.nama_pola.toLowerCase())
              .map(k => ({ nama_komponen: k.nama_komponen, qty: k.qty }));
            return {
              tipe: p.tipe, foto: '', nama_pola: p.nama_pola,
              bahan_aksesoris_id: item ? item.id : '', nama_bahan: item ? item.nama : '', warna_bahan: item ? (item.warna || '') : '',
              panjang: p.panjang, isi_pola_pcs: p.isi_pola_pcs, jasa_cutting: p.jasa_cutting, jasa_serie: p.jasa_serie,
              jenis_vendor: p.tipe === 'vendor' ? p.jenis_vendor : '',
              komponen: komponenBaris
            };
          });

          // GANTI (28 Agt 2026, §38): Kode Webbing 2/3 SEKARANG teks bebas
          // langsung dari kolom Excel, TIDAK ADA LAGI resolveBahan()/
          // webbing2_id/webbing3_id (sama alasan seperti Komponen di §36).
          const bomAksesoris = payload.aksesoris.filter(x => kunciProduk(x.prodNama, x.prodWarna, x.prodSize) === kunci).map(a => {
            const item = resolveBahan(daftarBahanImport.value, a.aksesoris);
            return {
              tahap_proses: a.tahap_proses,
              bahan_aksesoris_id: item ? item.id : '', nama_aksesoris: item ? item.nama : '', warna: item ? (item.warna || '') : '',
              qty: a.qty, satuan: a.satuan,
              webbing2: a.webbing2 || '', webbing3: a.webbing3 || ''
            };
          });

          await updateDoc(doc(db, 'master_produk', produk.id), {
            bom_jasa: bomJasa, bom_pola: bomPola, bom_aksesoris: bomAksesoris,
            diedit_pada: serverTimestamp(), diedit_oleh: window.currentUser?.email || null
          });
          jumlahProdukDiupdate++;
        }
        popupImportBOMAktif.value = false;
        await paginasi.muatUlang();
        alert(`Import BOM selesai: ${jumlahProdukDiupdate} produk diperbarui.`);
      } catch (e) {
        console.error('Gagal import BOM:', e);
        alert('Gagal mengimpor BOM. Coba lagi.');
      }
      sedangImportBOM.value = false;
    }

    return {
      paginasi, sedangEdit, bukaEdit, tutupEdit, saatTersimpanEdit, hapus, bolehHapus,
      produkTerpilih, toggleCentang, semuaTercentang, toggleSemua, hapusMassal,
      formatRupiah, hitungBreakdownPola, totalHargaJasa, totalKomponenPola, polaUtama,
      dropdownImportTerbuka, inputFileProdukUtama, inputFileBOM,
      opsiWarnaImport, opsiNamaBahanImport, opsiKomponenImport, opsiSatuanImport, opsiJenisProdukImport, daftarProdukSemuaImport,
      popupImportProdukUtamaAktif, barisMentahProdukUtama, sedangImportProdukUtama,
      popupImportBOMAktif, barisMentahJasa, barisMentahPola, barisMentahKomponen, barisMentahAksesoris, sedangImportBOM,
      bukaTemplateProdukUtama, bukaTemplateBOM, pancingFileProdukUtama, pancingFileBOM,
      saatFileProdukUtamaDipilih, saatFileBOMDipilih,
      tutupPopupImportProdukUtama, tutupPopupImportBOM,
      konfirmasiImportProdukUtama, konfirmasiImportBOM,
      sedangHitungKelipatan, hitungUlangKelipatanSemua
    };
  },
  template: `
    <div>
      <h3 class="gc-heading" style="font-weight:700; font-size:15px; margin-bottom:12px;"><i class="fas fa-list" style="color:var(--burgundy); margin-right:8px;"></i>List Produk</h3>

      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-start; margin-bottom:12px;">
        <div style="max-width:320px; flex:1; min-width:200px;">
          <input :value="paginasi.cariTeks.value" @input="paginasi.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari nama produk (awalan)..." style="width:100%; padding:10px 14px; border:1.5px solid var(--line); border-radius:12px; font-size:13px; box-sizing:border-box;">
        </div>
        <div style="position:relative;">
          <button @click="dropdownImportTerbuka = !dropdownImportTerbuka" type="button" class="btn-outline" style="font-size:12px;">
            <i class="fas fa-file-excel" style="margin-right:6px;"></i>Import / Template Excel <i class="fas fa-chevron-down" style="margin-left:6px; font-size:9px;"></i>
          </button>
          <div v-if="dropdownImportTerbuka" @click="dropdownImportTerbuka = false" style="position:fixed; inset:0; z-index:15;"></div>
          <div v-if="dropdownImportTerbuka" style="position:absolute; top:calc(100% + 6px); left:0; z-index:20; background:var(--surface); border:1px solid var(--line); border-radius:12px; box-shadow:0 6px 18px rgba(0,0,0,.12); min-width:250px; padding:6px; display:flex; flex-direction:column;">
            <button @click="bukaTemplateProdukUtama" type="button" class="btn-ghost" style="text-align:left; padding:8px 10px; font-size:12.5px; border-radius:8px;"><i class="fas fa-download" style="margin-right:8px; width:14px;"></i>Download Template Produk Utama</button>
            <button @click="pancingFileProdukUtama" type="button" class="btn-ghost" style="text-align:left; padding:8px 10px; font-size:12.5px; border-radius:8px;"><i class="fas fa-upload" style="margin-right:8px; width:14px;"></i>Import Produk Utama</button>
            <div style="height:1px; background:var(--line); margin:4px 2px;"></div>
            <button @click="bukaTemplateBOM" type="button" class="btn-ghost" style="text-align:left; padding:8px 10px; font-size:12.5px; border-radius:8px;"><i class="fas fa-download" style="margin-right:8px; width:14px;"></i>Download Template BOM</button>
            <button @click="pancingFileBOM" type="button" class="btn-ghost" style="text-align:left; padding:8px 10px; font-size:12.5px; border-radius:8px;"><i class="fas fa-upload" style="margin-right:8px; width:14px;"></i>Import BOM</button>
          </div>
        </div>
        <!-- Hitung Ulang Kelipatan Semua Produk — BARU (28 Agt 2026,
             permintaan Guru), lihat catatan panjang hitungUlangKelipatanSemua()
             di atas file ini. 1 tombol, backfill semua produk sekaligus —
             biar tidak perlu buka satu-satu + klik Simpan cuma buat
             ngisi field Kelipatan produk lama. -->
        <button @click="hitungUlangKelipatanSemua" :disabled="sedangHitungKelipatan" type="button" class="btn-outline" style="font-size:12px;">
          <i class="fas fa-rotate" style="margin-right:6px;"></i>{{ sedangHitungKelipatan ? 'Menghitung...' : 'Hitung Ulang Kelipatan Semua Produk' }}
        </button>
        <input ref="inputFileProdukUtama" type="file" accept=".xlsx,.xls" @change="saatFileProdukUtamaDipilih" style="display:none;">
        <input ref="inputFileBOM" type="file" accept=".xlsx,.xls" @change="saatFileBOMDipilih" style="display:none;">
      </div>

      <div v-if="paginasi.memuat.value" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="paginasi.errorPaginasi.value" style="text-align:center; padding:24px; color:var(--danger); font-size:12px;">{{ paginasi.errorPaginasi.value }}</div>
      <template v-else>
        <!-- 28 Agt 2026: dulu ada 2 tampilan (tabel desktop + kartu mobile)
             yang gantian muncul lewat CSS responsif. Guru minta disederhanakan
             jadi SATU tampilan kartu saja untuk semua ukuran layar, sekalian
             tambah checkbox pilih + Hapus Massal. -->
        <div v-if="bolehHapus" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:12px;">
          <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text-muted); cursor:pointer;">
            <input type="checkbox" :checked="semuaTercentang" @change="toggleSemua" style="accent-color:var(--burgundy); width:15px; height:15px;">
            Pilih semua di halaman ini
          </label>
          <button @click="hapusMassal" :disabled="produkTerpilih.length === 0" class="btn-outline" style="font-size:12px; padding:7px 14px; color:var(--danger); border-color:var(--danger);">
            <i class="fas fa-trash-alt" style="margin-right:6px;"></i>Hapus Massal ({{ produkTerpilih.length }})
          </button>
        </div>

        <!-- GANTI (28 Agt 2026, redesign atas permintaan Guru: "bantu redesign
             kartu list produk, saya takjub dengan kartu list bahan &
             aksesoris ada foto juga") — dulu kartu flat 1 baris, SEKARANG
             pola 4-bagian yang SAMA seperti List Bahan & Aksesoris
             (js/vue-bahan-aksesoris.js §39): header foto+nama+tag, mini-grid
             stat BOM, blok kartu-rows ivory-dim (tanggal dibuat/diedit), lalu
             tombol aksi. Checkbox pilih massal (bolehHapus) dipertahankan,
             sekarang di header row sejajar foto. -->
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div v-for="item in paginasi.dataHalaman.value" :key="item.id" class="gc-card" style="padding:14px;">
            <div style="display:flex; gap:12px; align-items:flex-start; margin-bottom:12px;">
              <input v-if="bolehHapus" type="checkbox" :checked="produkTerpilih.includes(item.id)" @change="toggleCentang(item.id)" style="accent-color:var(--burgundy); width:16px; height:16px; margin-top:18px; flex-shrink:0;">
              <img v-if="item.foto" :src="item.foto" style="width:52px; height:52px; object-fit:cover; border-radius:10px; flex-shrink:0;">
              <div v-else style="width:52px; height:52px; border-radius:10px; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; flex-shrink:0;"><i class="fas fa-tshirt" style="color:var(--text-faint); font-size:15px;"></i></div>
              <div style="flex:1; min-width:0;">
                <div style="font-weight:700; font-size:13.5px;">{{ item.nama }}</div>
                <div style="font-size:11.5px; color:var(--text-muted);">{{ item.warna }} &middot; {{ item.size }}</div>
                <div style="font-size:10.5px; color:var(--text-faint); margin-top:2px;">SKU: {{ item.sku || '-' }}</div>
              </div>
              <span v-if="item.jenis_produk" class="tag neutral" style="flex-shrink:0;">{{ item.jenis_produk }}</span>
            </div>

            <div style="display:grid; gap:8px; margin-bottom:10px;" class="grid-cols-2 md:grid-cols-4">
              <div><span style="font-size:10px; color:var(--text-faint); display:block;">Jasa</span><b style="font-size:12.5px; color:var(--burgundy);">{{ formatRupiah(totalHargaJasa(item)) }}</b><span style="font-size:10.5px; color:var(--text-muted);"> &middot; {{ (item.bom_jasa||[]).length }} layanan</span></div>
              <div><span style="font-size:10px; color:var(--text-faint); display:block;">Pola</span><b style="font-size:12.5px;">{{ hitungBreakdownPola(item).total }}</b><span style="font-size:10.5px; color:var(--text-muted);"> &middot; {{ hitungBreakdownPola(item).internal }} internal, {{ hitungBreakdownPola(item).vendor }} vendor</span></div>
              <div><span style="font-size:10px; color:var(--text-faint); display:block;">Aksesoris</span><b style="font-size:12.5px;">{{ (item.bom_aksesoris||[]).length }}</b><span style="font-size:10.5px; color:var(--text-muted);"> item</span></div>
              <div><span style="font-size:10px; color:var(--text-faint); display:block;">Komponen</span><b style="font-size:12.5px;">{{ totalKomponenPola(item) }}</b><span style="font-size:10.5px; color:var(--text-muted);"> di semua pola</span></div>
            </div>

            <!-- GANTI (28 Agt 2026, §41.1, permintaan Guru: "untuk text
                 dibuat dan diedit saya kurang setuju... ganti isinya") —
                 dulu blok ini isinya tanggal Dibuat/Diedit Terakhir (dinilai
                 Guru kurang berguna buat kartu ini). SEKARANG isinya info
                 PRODUKSI: Pola Utama (baris pertama bom_pola, + tipe
                 internal/vendor) & Bahan Utama (nama+warna bahan pola itu)
                 — lebih relevan buat kartu Master Produk dibanding metadata
                 tanggal, dan info ini SEBELUMNYA sama sekali tidak
                 kelihatan dari List Produk (harus buka Edit dulu buat
                 tahu). Kalau bom_pola > 1 baris, ditambah "+N lainnya". -->
            <div class="kartu-rows" style="display:flex; flex-direction:column; gap:5px; background:var(--ivory-dim); border-radius:10px; padding:10px 12px; margin-bottom:10px;">
              <div style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span style="color:var(--text-faint); flex-shrink:0;">Pola Utama</span><span style="font-weight:700; text-align:right;">{{ polaUtama(item).nama || '-' }}<span v-if="polaUtama(item).nama"> &middot; {{ polaUtama(item).tipe }}</span><span v-if="(item.bom_pola||[]).length > 1"> &middot; +{{ (item.bom_pola||[]).length - 1 }} lainnya</span></span></div>
              <div style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span style="color:var(--text-faint); flex-shrink:0;">Bahan Utama</span><span style="font-weight:700; text-align:right;">{{ polaUtama(item).bahan || '-' }}</span></div>
              <!-- Kelipatan — BARU (28 Agt 2026, permintaan Guru), field
                   'kelipatan' yang sudah tersimpan (dihitung & disimpan
                   waktu produk terakhir disimpan, lihat FormEntryProdukBOM
                   di atas file ini) — di sini CUMA baca, tidak dihitung
                   ulang. -->
              <div style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span style="color:var(--text-faint); flex-shrink:0;">Kelipatan (Acuan Order)</span><span style="font-weight:700; text-align:right;">{{ item.kelipatan > 0 ? (item.kelipatan + ' pcs') : '-' }}</span></div>
              <!-- Harga Jual — BARU (30 Agt 2026, fitur "Pesanan"). -->
              <div style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span style="color:var(--text-faint); flex-shrink:0;">Harga Jual</span><span style="font-weight:700; text-align:right;">{{ item.harga_jual > 0 ? formatRupiah(item.harga_jual) : '-' }}</span></div>
            </div>

            <div style="display:flex; gap:8px;">
              <button @click="bukaEdit(item)" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 12px;"><i class="fas fa-pen" style="margin-right:6px;"></i>Edit</button>
              <button v-if="bolehHapus" @click="hapus(item)" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 12px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-trash-alt" style="margin-right:6px;"></i>Hapus</button>
            </div>
          </div>
          <div v-if="paginasi.dataHalaman.value.length === 0" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Belum ada produk.</div>
        </div>

        <div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:16px;">
          <button @click="paginasi.halamanSebelumnya" :disabled="paginasi.nomorHalaman.value <= 1" class="icon-btn"><i class="fas fa-chevron-left"></i></button>
          <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasi.nomorHalaman.value }}</span>
          <button @click="paginasi.halamanBerikutnya" :disabled="!paginasi.adaBerikutnya.value" class="icon-btn"><i class="fas fa-chevron-right"></i></button>
        </div>
      </template>

      <div v-if="sedangEdit" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9998; display:flex; align-items:flex-start; justify-content:center; padding:16px; overflow-y:auto;" @click.self="tutupEdit">
        <div style="max-width:900px; width:100%; margin:24px 0;">
          <form-entry-produk-b-o-m :data-awal="sedangEdit" @tersimpan="saatTersimpanEdit" @batal="tutupEdit" />
        </div>
      </div>

      <popup-import-produk-utama
        v-if="popupImportProdukUtamaAktif"
        :baris-mentah="barisMentahProdukUtama"
        :opsi-warna="opsiWarnaImport"
        :opsi-jenis-produk="opsiJenisProdukImport"
        :daftar-produk-lama="daftarProdukSemuaImport"
        :sedang-import="sedangImportProdukUtama"
        @tutup="tutupPopupImportProdukUtama"
        @konfirmasi="konfirmasiImportProdukUtama" />

      <popup-import-b-o-m
        v-if="popupImportBOMAktif"
        :baris-jasa="barisMentahJasa"
        :baris-pola="barisMentahPola"
        :baris-komponen="barisMentahKomponen"
        :baris-aksesoris="barisMentahAksesoris"
        :opsi-nama-bahan="opsiNamaBahanImport"
        :opsi-komponen="opsiKomponenImport"
        :opsi-satuan="opsiSatuanImport"
        :daftar-produk-lama="daftarProdukSemuaImport"
        :sedang-import="sedangImportBOM"
        @tutup="tutupPopupImportBOM"
        @konfirmasi="konfirmasiImportBOM" />
    </div>
  `
};

// --- Mount, pola SAMA seperti js/vue-order-spk.js / vue-bahan-aksesoris.js -
const AppMasterProdukEntry = { components: { MasterProdukEntryManager }, template: `<master-produk-entry-manager />` };
let vmMasterProdukEntry = null;
window.pastikanMountProdukEntry = function() {
  if (vmMasterProdukEntry) return;
  const mountPoint = document.getElementById('vue-master-produk-entry');
  if (mountPoint) vmMasterProdukEntry = createApp(AppMasterProdukEntry).mount('#vue-master-produk-entry');
};

const AppMasterProdukList = { components: { MasterProdukListManager }, template: `<master-produk-list-manager />` };
let vmMasterProdukList = null;
window.pastikanMountProdukList = function() {
  if (vmMasterProdukList) return;
  const mountPoint = document.getElementById('vue-master-produk-list');
  if (mountPoint) vmMasterProdukList = createApp(AppMasterProdukList).mount('#vue-master-produk-list');
};
