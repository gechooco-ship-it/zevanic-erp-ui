// js/vue-bahan-aksesoris.js
// Zevanic House > Master Bahan & Aksesoris: data master saja (entry, edit,
// hapus, import Excel). Stok, lot, cetak label, harga aktif & margin diatur
// di Stok & Pembelian; di sini hanya ditampilkan (read-only).
//
// Koleksi & field:
// - master_bahan_aksesoris; ID sequential lewat runTransaction di koleksi
//   pengaturan_id_bahan_aksesoris, bukan `config` (rules: Owner/Superuser).
// - kategori_utama (Bahan/Aksesoris) menentukan prefix ID dan isi dropdown
//   Jenis; rak_id + rak_label denormalisasi dari master_rak_penyimpanan.
// - konversi_bertingkat tersimpan permanen; Volume = Tinggi x Panjang x
//   Lebar per satuan barang. pakai_lot_tracking memicu popup lot di Nota.
//
// Jebakan:
// - margin_modal bersatuan PERSEN: Harga Modal = Harga Pembelian / Isi
//   Konversi, Harga Pemakaian = Harga Modal x (1 + margin_modal/100). Rumus
//   kedua kembar di hargaPemakaian, hargaPemakaianEdit, import Excel, dan
//   perbaruiHargaMasterDariRiwayat (vue-stock-pembelian.js) — ubah serentak.
// - Sebagian dokumen masih menyimpan margin_modal sebagai NOMINAL RUPIAH dan
//   dibaca apa adanya tanpa migrasi: harga salah diam-diam, tidak tertebak.

import { createApp, ref, reactive, computed, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDoc, getDocs, setDoc, serverTimestamp, runTransaction, where, query, orderBy, limit, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
// MasterDataCategory/MasterDataTabelManager TIDAK diimpor di sini — panel
// Pengaturan (Jenis Bahan/Aksesoris, Data Satuan/Warna/Ukuran, Data Rak
// Penyimpanan) tidak memakai keduanya, lihat catatan di atas
// PengaturanBahanAksesoris di bawah.
import { DropdownCari, PopupPratinjauCetakLabel } from './vue-components.js?v=14';
import { usePaginasiFirestore } from './vue-paginasi.js';
// Koleksi `lot_bahan_aksesoris` & `log_cetak_label` dimiliki
// js/vue-stock-pembelian.js — semua akses ke keduanya lewat fungsi yang
// diekspor dari sana, jangan query langsung dari file ini.
import { ambilLotAktif } from './vue-stock-pembelian.js?v=34';

const KATEGORI_UTAMA_OPSI = ['Bahan', 'Aksesoris'];

function kategoriMasterData(kategoriUtama) {
  return kategoriUtama === 'Aksesoris' ? 'jenis_aksesoris' : 'jenis_bahan';
}
function kunciPengaturanId(kategoriUtama) {
  return kategoriUtama === 'Aksesoris' ? 'aksesoris' : 'bahan';
}

// Sumber opsi DropdownCari (Warna, Satuan Pembelian/Pemakaian) dari koleksi
// master_satuan/master_warna yang 1 DOKUMEN PER ITEM — beda dari
// window.ambilMasterList (dashboard.js) yang 1 dokumen berisi array.
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

// Sumber dropdown "Pilih Rak" dari `master_rak_penyimpanan`
// (js/vue-rak-penyimpanan.js). Sengaja fetch semua TANPA paginasi — ini sumber
// dropdown, bukan tabel browsing, sama seperti opsiSatuan/opsiWarna.
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


// Import/Export Excel. Template CUMA field wajib (Kategori Utama, Jenis, Nama,
// Warna, Harga Pembelian, Satuan Pembelian, Isi Konversi Pembelian, Satuan
// Pemakaian, Margin Modal); Rak, Volume, flag Qty per Roll/Lot & Foto tidak ikut.
// Import MURNI nambah: baris dgn Kategori+Nama+Warna yang sudah ada DILEWATI.


// jarakLevenshtein/cariSaranTerdekat/validasiPilihan — jarak edit standar buat
// saran "maksud Anda..?" di popup verifikasi import. TIDAK ada pola sejenis
// sebelumnya di file ini — disalin persis dari vue-master-produk.js.
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

// bacaFileExcel/ambilSheet/unduhWorkbook — pakai XLSX global dari index.html
// (SheetJS), sama seperti vue-master-produk.js.
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

// ambilSemuaBahanAksesoris — ambil SEMUA dokumen master_bahan_aksesoris (bukan 1
// halaman paginasi) — dipakai buat cek Kategori+Nama+Warna dobel dalam file &
// cek data yang mau di-skip karena sudah ada.
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

// kunciBahanAksesoris — kunci identitas dipakai buat cocokkan baris Excel ke
// data yang sudah ada .
function kunciBahanAksesoris(kategori, nama, warna) {
  return [kategori, nama, warna].map(v => (v || '').toString().trim().toLowerCase()).join('||');
}

// header kolom "Margin Modal" diberi keterangan "(%)" supaya jelas satuannya
// persen sejak dari Excel-nya (bukan Rupiah lagi).
const HEADER_BAHAN_AKSESORIS = ['Kategori Utama', 'Jenis', 'Nama', 'Warna', 'Harga Pembelian', 'Satuan Pembelian', 'Isi Konversi Pembelian', 'Satuan Pemakaian', 'Margin Modal (%)'];

function unduhTemplateBahanAksesoris() {
  const contohBahan = { 'Kategori Utama': 'Bahan', 'Jenis': 'Kain', 'Nama': 'Katun Combed 30s', 'Warna': 'Putih', 'Harga Pembelian': 1000000, 'Satuan Pembelian': 'Roll', 'Isi Konversi Pembelian': 50, 'Satuan Pemakaian': 'Meter', 'Margin Modal (%)': 15 };
  const contohAksesoris = { 'Kategori Utama': 'Aksesoris', 'Jenis': 'Resleting', 'Nama': 'Resleting YKK', 'Warna': 'Hitam', 'Harga Pembelian': 50000, 'Satuan Pembelian': 'Pack', 'Isi Konversi Pembelian': 12, 'Satuan Pemakaian': 'Pcs', 'Margin Modal (%)': 20 };
  unduhWorkbook([{ nama: 'Bahan & Aksesoris', header: HEADER_BAHAN_AKSESORIS, baris: [contohBahan, contohAksesoris] }], 'Template Import Bahan & Aksesoris.xlsx');
}

// FieldValidasiInline — 1 sel tabel popup verifikasi: tampilkan nilai dari Excel
// + status valid/tidak, bisa dikoreksi langsung lewat DropdownCari. Disalin dari
// vue-master-produk.js (pola sama).
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


// Popup verifikasi import, 1 tahap. Opsi kolom "Jenis" BEDA per baris tergantung
// Kategori Utama baris itu (Jenis Bahan vs Jenis Aksesoris), jadi dihitung
// per-baris — bukan satu list statis seperti Warna/Satuan.

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
      // Header "Margin Modal (%)" dengan fallback ke header lama "Margin Modal".
      // Nilainya TIDAK dikonversi — dibaca apa adanya sebagai PERSEN, padahal
      // file lama bisa berisi nominal Rupiah. Salah baca = harga salah diam-diam.
      margin_modal: b['Margin Modal (%)'] !== undefined ? b['Margin Modal (%)'] : b['Margin Modal']
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
      if (b.margin_modal === '' || b.margin_modal === null || b.margin_modal === undefined || isNaN(parseFloat(b.margin_modal))) return { valid: false, label: 'Margin Modal (%) wajib diisi (boleh 0)', tipe: 'danger' };
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
        <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Periksa {{ baris.length }} baris dari file. Data yang kombinasi Kategori Utama+Nama+Warna-nya SUDAH ADA akan DILEWATI (tidak ditimpa) — cuma data baru yang ditambahkan, ID dibuat otomatis. Rak Penyimpanan, Volume Barang, dan flag "Perlu Qty per Roll/Lot" TIDAK ikut lewat Import — isi menyusul manual lewat Edit kalau perlu. <b>Margin sekarang PERSEN (%)</b>, bukan Rupiah — isi mis. 15 untuk 15%.</p>
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
                <th style="padding:6px;">Margin (%)</th>
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

// Kompresi gambar sisi klien. Dimensi & kualitas sengaja lebih rendah daripada
// foto bukti reimburse (500px / 0.65) — ini thumbnail katalog, prioritasnya
// dokumen Firestore tetap kecil karena barisnya banyak.
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
// WAJIB dipakai di sini (beda dari idAcak lama di vue-registrasi.js yang random
// jadi tidak butuh ini) supaya counter tidak pernah dobel/tabrakan walau 2 admin
// submit BERSAMAAN persis di waktu yang sama.
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
    // flag opsional, lihat catatan arsitektur di atas file ini (dekat komentar
    // "UPDATE ").
    pakai_lot_tracking: false,
    // Rak & Volume Barang SEMUA opsional (tidak divalidasi wajib di
    // simpanData/simpanEdit); volume = tinggi*panjang*lebar, otomatis. rak_label
    // denormalisasi tampilan (mis. "A-1-3") sekaligus v-model DropdownCari;
    // rak_id diturunkan dari rak_label lewat watch, jangan diisi manual.
    rak_id: '',
    rak_label: '',
    tinggi_barang: '',
    panjang_barang: '',
    lebar_barang: '',
    // Panjang 1 roll gudang (meter), opsional. Dasar kolom "roll" di kartu Acc
    // Webbing: ceil(butuh_meter / panjang_roll). Kosong/0 = belum diisi, kartu
    // itu menampilkan "-" bukan angka tebakan.
    panjang_roll: '',
    margin_modal: 0,
    konversi_bertingkat: []
  });
}

// SATU sumber kebenaran "field wajib apa saja", dipakai bareng oleh
// simpanData/simpanEdit/konfirmasiImportBahanAksesoris dan tab "Perlu
// dilengkapi" — JANGAN ditulis ulang beda-beda per tempat. Field opsional (Foto,
// Rak, Volume, Panjang Roll, Pakai Lot Tracking) sengaja tidak ikut dicek.
function hitungLengkap(d) {
  return !!(
    d && d.kategori_utama && d.jenis && d.nama && d.warna &&
    (parseFloat(d.harga_pembelian) > 0) && d.satuan_pembelian &&
    (parseFloat(d.isi_konversi_pembelian) > 0) && d.satuan_pemakaian &&
    d.margin_modal !== '' && d.margin_modal !== null && d.margin_modal !== undefined &&
    !isNaN(parseFloat(d.margin_modal))
  );
}

// Untuk TIAP tingkat yang harga-nya > 0: harga tingkat itu dibagi faktor
// konversi DARI tingkat itu sampai akhir rantai (BUKAN dari tingkat teratas),
// lalu diambil hasil yang PALING MAHAL. Prinsip konservatif yang sama dipakai
// perbaruiHargaMasterDariRiwayat di vue-stock-pembelian.js.
function hitungHargaPerSatuanAkhir(baris) {
  let maxHarga = 0;
  baris.forEach((b, i) => {
    const h = parseFloat(b.harga);
    if (!(h > 0)) return;
    // Faktor konversi dari TINGKAT INI (i) sampai akhir rantai — BUKAN dari
    // tingkat 0. Mis. kalau tingkat ini "Pack" (i=1) dan tingkat terakhir "Pcs"
    // dengan jumlah 12, faktornya = 12 (1 Pack = 12 Pcs), BUKAN faktor gabungan
    // Dus->Pcs.
    const faktor = baris.slice(i).reduce((t, x) => t * (parseFloat(x.jumlah) || 0), 1);
    if (!(faktor > 0)) return;
    const impliedHargaAkhir = h / faktor;
    if (impliedHargaAkhir > maxHarga) maxHarga = impliedHargaAkhir;
  });
  return maxHarga;
}
// useKonversiBerjenjang — logic popup "bantu hitung konversi banyak tingkat"
// (mis. Dus > Pack > Pcs), dipakai BARENG oleh form Entry & form Edit (di modal
// List) lewat 1 fungsi ini supaya logicnya tidak ditulis 2x beda-beda.
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
    // harga TIDAK ikut dicopy dari baris sebelumnya (beda konteks pembelian tiap
    // tingkat, mis. beli Dus vs beli Pack harganya beda) — sengaja dikosongkan.
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
    // Harga Pembelian ada di TIAP baris (harga beli pada satuan awal baris itu).
    // form.harga_pembelian diturunkan dari hitungHargaPerSatuanAkhir lalu
    // DIKONVERSI BALIK ke "per Satuan Pembelian" (dikali isi_konversi_pembelian)
    // supaya arti field ini tetap sama; angkanya bisa > yang diketik di baris 0.
    if (!(parseFloat(barisKonversi.value[0]?.harga) > 0)) { alert('Isi Harga Pembelian di baris pertama dulu (harus lebih dari 0).'); return; }
    const tidakLengkap = barisKonversi.value.some(b => !b.dari.trim() || !b.ke.trim() || !(parseFloat(b.jumlah) > 0));
    if (tidakLengkap) { alert('Lengkapi semua baris dulu: satuan awal, jumlah (angka > 0), dan satuan tujuan.'); return; }
    form.isi_konversi_pembelian = totalKonversiBerjenjang.value;
    const hargaSatuanAkhirMax = hitungHargaPerSatuanAkhir(barisKonversi.value);
    form.harga_pembelian = Math.round(hargaSatuanAkhirMax * form.isi_konversi_pembelian);
    form.konversi_bertingkat = JSON.parse(JSON.stringify(barisKonversi.value));
    // Satuan Pembelian & Satuan Pemakaian di form utama DISEMBUNYIKAN begitu
    // Konversi Banyak Tingkat dipakai, jadi WAJIB selalu ditimpa dari baris
    // pertama & terakhir popup — kalau tidak, field bisa kosong tanpa terlihat
    // dan Simpan gagal tanpa alasan jelas.
    const barisPertama = barisKonversi.value[0];
    const barisTerakhir = barisKonversi.value[barisKonversi.value.length - 1];
    if (barisPertama && barisPertama.dari) form.satuan_pembelian = barisPertama.dari;
    if (barisTerakhir && barisTerakhir.ke) form.satuan_pemakaian = barisTerakhir.ke;
    tampilPopupKonversi.value = false;
  }
  // Tombol "Hapus & Isi Manual". Satuan Pembelian/Isi Konversi/Satuan Pemakaian
  // hasil konversi SENGAJA tidak ikut dikosongkan — cuma konversi_bertingkat
  // yang dibersihkan, supaya user tinggal mengedit, bukan mulai dari nol.
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

// dipakai untuk tampilkan stok_akhir (lihat Kartu Stok Bahan/Aksesoris,
// js/vue-kartu-stok.js). Field ini di-update transaksional oleh
// catatPergerakanKartuStok di vue-stock-pembelian.js, bukan diedit manual.
function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

// QR digambar sinkron ke <div> tersembunyi di window UTAMA (bukan window print),
// diambil sebagai data URL PNG, lalu dikirim ke PopupPratinjauCetakLabel sebagai
// gambar statis — window print tidak boleh butuh library/internet lagi. Global
// `QRCode` (qrcodejs) dimuat sekali di index.html.
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


// Panel gear: HANYA Prefix ID per kategori (setting teknis + counter internal).
// Data referensi Jenis/Satuan/Warna/Ukuran ada di Zevanic House > Config
// (js/vue-config.js), rak di js/vue-rak-penyimpanan.js — jangan ditarik ke sini.

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
        // merge:true WAJIB — supaya field `counter` yang sudah jalan TIDAK ikut
        // tertimpa balik ke kosong tiap kali prefix disimpan ulang.
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


// PopupKonversiBerjenjang — dipakai BARENG oleh Entry & Edit lewat props, emit
// 'terapkan'/'tutup' supaya state konversi tetap dipegang komponen induk
// masing-masing (form Entry / form Edit), bukan disimpan ganda di sini.

const PopupKonversiBerjenjang = {
  components: { DropdownCari },
  props: {
    baris: { type: Array, required: true },
    total: { type: Number, required: true },
    // Satuan awal/tujuan SEKARANG dropdown pencarian (bukan teks bebas lagi),
    // opsi diambil dari Data Satuan (master_satuan, dikirim dari komponen induk
    // Entry/Edit yang sudah punya list ini).
    opsiSatuan: { type: Array, default: () => [] }
  },
  emits: ['tambah', 'hapus', 'terapkan', 'tutup'],
  computed: {
    // Admin cukup isi harga NOTA (harga di satuan awal, mis. Rp 1jt per Dus).
    // hitungHargaPerSatuanAkhir (module-level, dipakai bareng terapkanKonversi)
    // yang menurunkan harganya dari SEMUA tingkat yang harganya diisi.
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
        <!-- Harga Pembelian ada di TIAP baris: harga nyata waktu beli pada satuan awal
          baris itu. Semua baris disimpan apa adanya di konversi_bertingkat dan ikut
          menentukan Harga Modal lewat hitungHargaPerSatuanAkhir. -->
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


// BahanAksesorisEntryManager — menu "Bahan / Aksesoris" (form entry data baru)

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

    // muatDaftarRak — ambil semua record Rak (menu "Rak Penyimpanan")
    // buat opsi dropdown "Pilih Rak" di bawah.
    async function muatDaftarRak() { daftarRak.value = await ambilDaftarRak(); }
    // rakDipilih — cari record lengkap Rak yang sedang dipilih (buat tampilkan
    // info dimensi/volume rak-nya sebagai konfirmasi visual).
    const rakDipilih = computed(() => daftarRak.value.find(r => r.id === form.rak_id) || null);
    // Begitu form.rak_label berubah (DropdownCari strict-select — SELALU salah
    // satu dari opsiRak, atau string kosong), turunkan rak_id otomatis dari
    // situ. Kalau labelnya tidak cocok record manapun (mis. dikosongkan), rak_id
    // ikut dikosongkan.
    watch(() => form.rak_label, (label) => {
      const cocok = daftarRak.value.find(r => r.rak_label === label);
      form.rak_id = cocok ? cocok.id : '';
    });

    const hargaModal = computed(() => {
      const hp = parseFloat(form.harga_pembelian) || 0;
      const ik = parseFloat(form.isi_konversi_pembelian) || 0;
      return ik > 0 ? hp / ik : 0;
    });
    // margin_modal SEKARANG PERSEN (%), bukan nominal Rupiah lagi — lihat
    // catatan besar di atas file ini. Harga Pemakaian = Harga Modal + (Harga
    // Modal x Margin% / 100).
    const hargaPemakaian = computed(() => hargaModal.value * (1 + (parseFloat(form.margin_modal) || 0) / 100));
    // volumeBarang — volume = Tinggi x Panjang x Lebar (dimensi 1 satuan
    // barang itu sendiri, bukan dimensi rak — lihat catatan arsitektur poin 2 di
    // atas file ini). 0 kalau salah satu dimensi belum diisi.
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

    // muat — refresh 3 sumber dropdown (satuan/warna/rak/jenis), dipanggil ulang
    // tiap kali tab ini diklik lagi (lihat pastikanMountBahanAksesorisEntry)
    // supaya opsi baru dari tab/layar lain langsung kelihatan tanpa reload
    // halaman. Data form yang sedang diisi TIDAK ikut direset.
    async function muat() {
      await Promise.all([muatOpsiSatuanWarna(), muatDaftarRak()]);
      if (form.kategori_utama) await muatOpsiJenis();
    }
    onMounted(muat);

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

    // Satu fungsi untuk 2 tombol. duplikat=false ("Simpan"): form direset kosong
    // setelah sukses. duplikat=true ("Simpan & Duplikat"): form dipertahankan
    // apa adanya kecuali Foto, dan simpan berikutnya membuat entri lain dengan
    // ID sendiri — BUKAN memperbarui entri yang sudah tersimpan.
    async function simpanData(duplikat) {
      if (!form.kategori_utama) return alert('Pilih Kategori Utama (Bahan/Aksesoris) dulu.');
      if (!form.jenis) return alert('Pilih Jenis Bahan/Aksesoris dulu.');
      if (!form.nama.trim()) return alert('Isi Nama Bahan/Aksesoris dulu.');
      if (!form.warna.trim()) return alert('Pilih Warna dulu.');
      if (!(parseFloat(form.harga_pembelian) > 0)) return alert('Isi Harga Awal dulu (harus lebih dari 0). Setelah ada nota, harga diatur di Stok & Pembelian › Riwayat Harga.');
      if (!form.satuan_pembelian.trim()) return alert('Pilih Satuan Pembelian dulu.');
      if (!(parseFloat(form.isi_konversi_pembelian) > 0)) return alert('Isi Isi Konversi Pembelian dulu (harus lebih dari 0) — bisa pakai tombol "Bantu Hitung Konversi Berjenjang" kalau tingkatnya banyak.');
      if (!form.satuan_pemakaian.trim()) return alert('Pilih Satuan Pemakaian dulu.');

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
          // flag "lengkap" dihitung & disimpan APA ADANYA (bukan cuma dihitung
          // on-the-fly) supaya bisa dipakai query/tab "Perlu dilengkapi" di
          // List. Lihat hitungLengkap.
          lengkap: hitungLengkap({
            kategori_utama: form.kategori_utama, jenis: form.jenis, nama: form.nama, warna: form.warna,
            harga_pembelian: form.harga_pembelian, satuan_pembelian: form.satuan_pembelian,
            isi_konversi_pembelian: form.isi_konversi_pembelian, satuan_pemakaian: form.satuan_pemakaian,
            margin_modal: form.margin_modal
          }),
          konversi_bertingkat: form.konversi_bertingkat || [],
          // flag opsional, lihat catatan arsitektur di atas file ini.
          pakai_lot_tracking: !!form.pakai_lot_tracking,
          // Rak Penyimpanan & Volume Barang, semua opsional (lihat catatan
          // arsitektur di atas file ini).
          rak_id: form.rak_id || '',
          rak_label: form.rak_id ? form.rak_label : '',
          tinggi_barang: parseFloat(form.tinggi_barang) || 0,
          panjang_barang: parseFloat(form.panjang_barang) || 0,
          lebar_barang: parseFloat(form.lebar_barang) || 0,
          volume_barang: volumeBarang.value,
          // lihat catatan panjang_roll di formKosong.
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
      pilihFoto, hapusFoto, simpan, simpanDanDuplikat, tampilPengaturan, muat, muatOpsiJenis, muatOpsiSatuanWarna, muatDaftarRak,
      ...konversi
    };
  },
  template: `
    <div class="gc-card" style="margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h3 style="font-weight:700; font-size:13.5px;"><i class="fas fa-boxes-stacked" style="color:var(--burgundy); margin-right:8px;"></i>Entry Bahan / Aksesoris</h3>
        <button @click="tampilPengaturan = true" class="icon-btn" title="Pengaturan (prefix ID & Jenis)"><i class="fas fa-gear"></i></button>
      </div>
      <p style="font-size:10.5px; color:var(--text-faint); margin:0 0 14px;">Tanggal Entry & ID akan dibuat OTOMATIS saat disimpan.</p>

      <!-- 3 kolom: foto | identitas | Harga & Satuan. Pakai flex+flex-wrap, JANGAN inline
        grid-template-columns bersama class grid-cols-1 md:grid-cols-N — inline style menang
        dan kolomnya tidak pernah collapse jadi 1 di HP. -->
      <div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap;">
        <div style="flex:0 0 96px;">
          <label class="gc-photo-slot" style="width:90px; height:90px; margin-bottom:8px; overflow:hidden;" title="Klik untuk pilih/ganti foto">
            <img v-if="form.foto" :src="form.foto" style="width:100%; height:100%; object-fit:cover;">
            <span v-else style="font-size:9.5px; text-align:center; line-height:1.3;"><i class="fas fa-image" style="display:block; font-size:16px; margin-bottom:4px;"></i>foto item</span>
            <input type="file" accept="image/*" @change="pilihFoto" style="display:none;">
          </label>
          <button v-if="form.foto" @click="hapusFoto" type="button" class="btn-outline" style="font-size:10px; padding:4px 8px; width:90px;">Hapus foto</button>
        </div>

        <div style="flex:2 1 280px; display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-2">
          <div class="gc-field" style="margin-bottom:0;">
            <label>Kategori Utama <span style="color:var(--danger);">*</span></label>
            <div style="display:flex; gap:16px; align-items:center; min-height:38px;">
              <label v-for="k in KATEGORI_UTAMA_OPSI" :key="k" style="display:flex; align-items:center; gap:6px; font-size:12.5px; cursor:pointer;">
                <input type="radio" :value="k" v-model="form.kategori_utama" style="accent-color:var(--burgundy);">{{ k }}
              </label>
            </div>
          </div>
          <div class="gc-field" style="margin-bottom:0;">
            <label>Jenis Bahan / Aksesoris <span style="color:var(--danger);">*</span></label>
            <dropdown-cari v-model="form.jenis" :opsi="opsiJenis" :disabled="!form.kategori_utama" :placeholder="form.kategori_utama ? 'Cari & pilih Jenis...' : 'Pilih Kategori Utama dulu'" />
          </div>
          <div class="gc-field" style="margin-bottom:0;">
            <label>Nama Bahan / Aksesoris <span style="color:var(--danger);">*</span></label>
            <input v-model="form.nama" type="text" placeholder="Contoh: Katun Combed 30s">
          </div>
          <div class="gc-field" style="margin-bottom:0;">
            <label>Warna Bahan / Aksesoris <span style="color:var(--danger);">*</span></label>
            <dropdown-cari v-model="form.warna" :opsi="opsiWarna" placeholder="Cari & pilih Warna..." />
          </div>
        </div>

        <div style="flex:1 1 240px; max-width:280px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="width:6px; height:6px; border-radius:50%; background:var(--burgundy); flex-shrink:0;"></span>
            <span style="font-weight:700; font-size:11.5px;">Harga &amp; Satuan</span>
          </div>

          <template v-if="!(form.konversi_bertingkat && form.konversi_bertingkat.length > 0)">
            <div class="gc-field" style="margin-bottom:0;">
              <label>Harga Awal (Rp) <span style="color:var(--danger);">*</span></label>
              <input v-model.number="form.harga_pembelian" type="number" min="0" placeholder="0">
              <p style="font-size:9.5px; color:var(--text-faint); margin-top:4px;">Sekali saat item baru. Setelah ada nota, harga &amp; margin diatur di Stok &amp; Pembelian › Riwayat Harga.</p>
            </div>
            <div class="gc-field" style="margin-bottom:0;">
              <label>Satuan Pembelian <span style="color:var(--danger);">*</span></label>
              <dropdown-cari v-model="form.satuan_pembelian" :opsi="opsiSatuan" placeholder="Cari & pilih Satuan..." />
            </div>
            <div class="gc-field" style="margin-bottom:0;">
              <label>Isi Konversi Pembelian <span style="color:var(--danger);">*</span></label>
              <input v-model.number="form.isi_konversi_pembelian" type="number" min="0" placeholder="Contoh: 144">
            </div>
            <div class="gc-field" style="margin-bottom:0;">
              <label>Satuan Pemakaian <span style="color:var(--danger);">*</span></label>
              <dropdown-cari v-model="form.satuan_pemakaian" :opsi="opsiSatuan" placeholder="Cari & pilih Satuan..." />
            </div>
          </template>

          <div v-else style="background:var(--ivory-dim); border-radius:10px; padding:10px 12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <b style="font-size:11.5px;"><i class="fas fa-calculator" style="color:var(--burgundy); margin-right:5px;"></i>Konversi Bertingkat aktif</b>
              <div style="display:flex; gap:4px;">
                <button @click="bukaPopupKonversi" class="icon-btn" title="Ubah Konversi Banyak Tingkat"><i class="fas fa-pen"></i></button>
                <button @click="hapusKonversiBertingkat" class="icon-btn" style="color:var(--danger);" title="Hapus & isi manual"><i class="fas fa-times"></i></button>
              </div>
            </div>
            <p style="font-size:10.5px; margin-bottom:4px;">Harga Pembelian: <b>{{ formatRupiah(form.harga_pembelian) }}</b></p>
            <p style="font-size:10px; color:var(--text-muted);">Rincian: {{ form.konversi_bertingkat.map(b => '1 ' + b.dari + ' = ' + b.jumlah + ' ' + b.ke + (b.harga ? ' (' + formatRupiah(b.harga) + '/' + b.dari + ')' : '')).join(', ') }}</p>
            <p style="font-size:10px; margin-top:4px;">Isi Konversi: <b>{{ form.isi_konversi_pembelian }}</b> &middot; Sat. Pakai: <b>{{ form.satuan_pemakaian }}</b></p>
          </div>

          <!--
            tombol Konversi Banyak Tingkat, cuma tampil kalau Konversi Banyak Tingkat BELUM aktif
            — kalau sudah aktif, kotak ringkasan di atas sudah punya tombol edit/hapus sendiri.
          -->
          <button v-if="!(form.konversi_bertingkat && form.konversi_bertingkat.length > 0)" @click="bukaPopupKonversi" type="button" class="btn-outline" style="font-size:11px; padding:7px 12px;"><i class="fas fa-calculator" style="margin-right:6px;"></i>Konversi Banyak Tingkat</button>

          <!-- Flag per item: bahan disimpan per roll/kones dan qty per roll dicatat saat
            diterima. Mengaktifkan popup "Qty per Roll/Lot" di Daftar Pesanan Pembelian
            (js/vue-stock-pembelian.js). FIFO/pemakaian per-lot belum ada. -->
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:400; font-size:11px;">
            <input type="checkbox" v-model="form.pakai_lot_tracking" style="accent-color:var(--burgundy); width:15px; height:15px; flex-shrink:0;">
            <span>Perlu Qty per Roll/Lot saat diterima</span>
          </label>

          <div style="background:var(--ivory-dim); border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; gap:5px;">
            <div><span style="font-size:9.5px; color:var(--text-faint); display:block;">Harga Modal (otomatis)</span><b style="font-size:13px;">{{ formatRupiah(hargaModal) }}</b></div>
            <div><span style="font-size:9.5px; color:var(--text-faint); display:block;">Harga Pemakaian (otomatis)</span><b style="font-size:13px; color:var(--burgundy);">{{ formatRupiah(hargaPemakaian) }}</b></div>
          </div>
        </div>
      </div>

      <div style="height:1px; background:var(--line); margin:16px 0;"></div>

      <!--
        Volume & Rak — "boleh menyusul", TIDAK wajib. Pola SAMA seperti wireframe 1.1.2 (baris
        tersendiri di bawah 3-kolom utama).
      -->
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
        <span style="width:6px; height:6px; border-radius:50%; background:var(--text-faint); flex-shrink:0;"></span>
        <span style="font-weight:700; font-size:11.5px;">Volume &amp; Rak</span>
        <span style="font-size:10px; color:var(--text-faint);">boleh menyusul &middot; stok tidak diisi di sini</span>
      </div>
      <div style="display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-3">
        <!--
          Rak Penyimpanan 1 dropdown pilih Rak terdaftar (menu "Rak Penyimpanan",
          js/vue-rak-penyimpanan.js).
        -->
        <div class="gc-field" style="margin-bottom:0;">
          <label>Pilih Rak (opsional)</label>
          <dropdown-cari v-model="form.rak_label" :opsi="opsiRak" placeholder="Cari & pilih Rak..." />
          <p v-if="opsiRak.length === 0" style="font-size:10px; color:var(--text-faint); margin-top:4px;">Belum ada Rak terdaftar — daftarkan dulu di sub-menu "Rak Penyimpanan".</p>
          <p v-else-if="rakDipilih" style="font-size:10px; color:var(--text-faint); margin-top:4px;">Dimensi: {{ formatQty(rakDipilih.tinggi_rak) }}&times;{{ formatQty(rakDipilih.panjang_rak) }}&times;{{ formatQty(rakDipilih.lebar_rak) }}cm &middot; Kapasitas: {{ formatQty(rakDipilih.volume_rak) }}cm&sup3;</p>
        </div>
        <!--
          Volume Barang (Tinggi/Panjang/Lebar dari 1 satuan BARANG ini sendiri, BUKAN dimensi
          rak). Volume dihitung otomatis (readonly), disimpan sebagai field volume_barang.
        -->
        <div class="gc-field" style="margin-bottom:0;">
          <label>Volume Barang (cm) <span style="font-size:9.5px; color:var(--text-faint); font-weight:400;">— T &times; P &times; L</span></label>
          <div style="display:flex; gap:6px;">
            <input v-model.number="form.tinggi_barang" type="number" min="0" placeholder="Tinggi">
            <input v-model.number="form.panjang_barang" type="number" min="0" placeholder="Panjang">
            <input v-model.number="form.lebar_barang" type="number" min="0" placeholder="Lebar">
          </div>
          <p style="font-size:9.5px; color:var(--text-faint); margin-top:4px;">Volume (otomatis): <b>{{ volumeBarang.toLocaleString('id-ID') }} cm&sup3;</b> per {{ form.satuan_pemakaian || 'satuan pemakaian' }}</p>
        </div>
        <!--
          Panjang Roll, dasar hitung kolom "roll" di kartu Acc Webbing. Opsional, cuma relevan
          buat item webbing/tali.
        -->
        <div class="gc-field" style="margin-bottom:0;">
          <label>Panjang 1 Roll (meter) <span style="font-size:9.5px; color:var(--text-faint); font-weight:400;">— opsional (Acc Webbing)</span></label>
          <input v-model.number="form.panjang_roll" type="number" min="0" placeholder="0">
        </div>
      </div>

      <div style="display:flex; gap:8px; margin-top:16px;">
        <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="flex:1; padding:12px;"><i class="fas fa-floppy-disk" style="margin-right:6px;"></i>{{ menyimpan ? 'Menyimpan...' : 'Simpan' }}</button>
        <button @click="simpanDanDuplikat" :disabled="menyimpan" class="btn-outline" style="flex:1; padding:12px;" title="Simpan sebagai entri baru, TAPI form tidak dikosongkan — tinggal ubah detail yang beda (misal Warna) lalu simpan lagi"><i class="fas fa-copy" style="margin-right:6px;"></i>Simpan &amp; Duplikat</button>
      </div>
    </div>

    <popup-konversi-berjenjang v-if="tampilPopupKonversi" :baris="barisKonversi" :total="totalKonversiBerjenjang" :opsi-satuan="opsiSatuan"
      @tambah="tambahBarisKonversi" @hapus="hapusBarisKonversi" @terapkan="terapkanKonversi" @tutup="tutupPopupKonversi" />
    <pengaturan-bahan-aksesoris v-if="tampilPengaturan" @tutup="tampilPengaturan = false; muatOpsiJenis(); muatOpsiSatuanWarna(); muatDaftarRak()" />
  `
};


// BahanAksesorisListManager — menu "List Bahan / Aksesoris" (tabel paginasi
// cursor-based, WAJIB hemat read Firestore — bukan fetch-semua-lalu-
// potong-di-JS seperti MasterKendaraanManager lama).

const BahanAksesorisListManager = {
  components: { PopupKonversiBerjenjang, DropdownCari, PopupImportBahanAksesoris },
  setup() {
    // filterTab: 'ALL' | 'Bahan' | 'Aksesoris' | 'INCOMPLETE'. Tiga tab pertama
    // lewat usePaginasiFirestore (cursor, where tunggal, hemat). Tab INCOMPLETE
    // beda sendiri: Firestore tidak bisa query OR lintas field + dokumen yang
    // field-nya hilang, jadi dilayani fetch-semua lalu disaring hitungLengkap.
    const filterTab = ref('ALL');
    const paginasi = usePaginasiFirestore(db, 'master_bahan_aksesoris', {
      perHalaman: 20, // BARU — "Muat 20 lagi" per wireframe (dulu 15/halaman prev-next)
      urutkanField: 'nama',
      cariField: 'nama',
      constraintTambahan: () => (filterTab.value === 'Bahan' || filterTab.value === 'Aksesoris') ? [where('kategori_utama', '==', filterTab.value)] : [],
      petakan: (id, d) => ({ id, ...d })
    });

    // usePaginasiFirestore bermodel prev/next: dataHalaman selalu berisi 1
    // halaman dan ditimpa tiap pindah. Model "Muat Lagi" diakumulasi DI SINI
    // saja (jangan ubah vue-paginasi.js, dipakai banyak modul lain): halaman 1
    // mengisi ulang akumulasi, halaman berikutnya ditambahkan ke bawah.
    const daftarAkumulasi = ref([]);
    watch(paginasi.dataHalaman, (baru) => {
      if (paginasi.nomorHalaman.value === 1) daftarAkumulasi.value = [...baru];
      else daftarAkumulasi.value = [...daftarAkumulasi.value, ...baru];
    });
    function muatLagi() {
      if (filterTab.value === 'INCOMPLETE') {
        visibleIncomplete.value = Math.min(visibleIncomplete.value + 20, daftarIncompleteTersaring.value.length);
      } else if (modeCari.value) {
        visibleCari.value += 20;
      } else {
        paginasi.halamanBerikutnya();
      }
    }

    watch(filterTab, () => {
      visibleCari.value = 20;
      if (filterTab.value !== 'INCOMPLETE' && !modeCari.value) paginasi.muatUlang();
      else visibleIncomplete.value = 20;
    });

    // Badge jumlah per tab (getCountFromServer — hemat, TANPA baca isi
    // dokumen, pola SAMA seperti vue-hak-akses.js/vue-home-desktop.js) + Tab
    // "Perlu dilengkapi" (lihat catatan panjang di atas filterTab).
    const jumlahSemua = ref(0);
    const jumlahBahanTab = ref(0);
    const jumlahAksesorisTab = ref(0);
    const memuatBadge = ref(true);
    const errorBadge = ref('');
    const daftarIncomplete = ref([]); // dokumen LENGKAP (bukan cuma id) hasil saring hitungLengkap
    const visibleIncomplete = ref(20); // "Muat 20 lagi" versi client-side (array sudah di memori)

    const daftarSemua = ref([]);
    const visibleCari = ref(20);
    function cocokCari(d, teks) {
      const hay = [d.nama, d.warna, d.jenis, d.id_tampil, d.kategori_utama].map(x => (x || '').toString().toLowerCase()).join(' ');
      return teks.split(/\s+/).filter(Boolean).every(k => hay.includes(k));
    }
    const daftarIncompleteTersaring = computed(() => {
      const teks = paginasi.cariTeks.value.trim().toLowerCase();
      if (!teks) return daftarIncomplete.value;
      return daftarIncomplete.value.filter(d => cocokCari(d, teks));
    });
    const daftarCari = computed(() => {
      const teks = paginasi.cariTeks.value.trim().toLowerCase();
      return daftarSemua.value.filter(d => (filterTab.value === 'ALL' || d.kategori_utama === filterTab.value) && cocokCari(d, teks))
        .sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    });
    const modeCari = computed(() => filterTab.value !== 'INCOMPLETE' && !!paginasi.cariTeks.value.trim());

    async function muatBadgeDanIncomplete() {
      memuatBadge.value = true;
      errorBadge.value = '';
      try {
        const koleksi = collection(db, 'master_bahan_aksesoris');
        const [snapSemua, snapBahan, snapAksesoris, semuaData] = await Promise.all([
          getCountFromServer(koleksi),
          getCountFromServer(query(koleksi, where('kategori_utama', '==', 'Bahan'))),
          getCountFromServer(query(koleksi, where('kategori_utama', '==', 'Aksesoris'))),
          ambilSemuaBahanAksesoris()
        ]);
        jumlahSemua.value = snapSemua.data().count;
        jumlahBahanTab.value = snapBahan.data().count;
        jumlahAksesorisTab.value = snapAksesoris.data().count;
        daftarSemua.value = semuaData;
        daftarIncomplete.value = semuaData.filter(d => !hitungLengkap(d));
      } catch (e) {
        console.error('Gagal muat badge tab List Bahan & Aksesoris:', e);
        errorBadge.value = 'Gagal menghitung badge tab.';
      }
      memuatBadge.value = false;
    }

    // barisTampil — sumber data yang BENERAN dirender tabel, gabung 2 sumber
    // berbeda tergantung tab aktif (lihat catatan filterTab di atas).
    const barisTampil = computed(() => filterTab.value === 'INCOMPLETE'
      ? daftarIncompleteTersaring.value.slice(0, visibleIncomplete.value)
      : (modeCari.value ? daftarCari.value.slice(0, visibleCari.value) : daftarAkumulasi.value));
    const sedangMemuatList = computed(() => (filterTab.value === 'INCOMPLETE' || modeCari.value) ? memuatBadge.value : paginasi.memuat.value);
    const adaLagiUntukDimuat = computed(() => filterTab.value === 'INCOMPLETE'
      ? visibleIncomplete.value < daftarIncompleteTersaring.value.length
      : (modeCari.value ? visibleCari.value < daftarCari.value.length : paginasi.adaBerikutnya.value));
    const daftarTab = computed(() => [
      { nilai: 'ALL', label: 'Semua', angka: jumlahSemua.value },
      { nilai: 'Bahan', label: 'Bahan', angka: jumlahBahanTab.value },
      { nilai: 'Aksesoris', label: 'Aksesoris', angka: jumlahAksesorisTab.value },
      { nilai: 'INCOMPLETE', label: 'Perlu dilengkapi', angka: daftarIncomplete.value.length }
    ]);

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

    // muatDaftarRakEdit — sama seperti muatDaftarRak di
    // BahanAksesorisEntryManager, dipanggil tiap bukaEdit (bukan sekali saat
    // mounted) supaya selalu ambil daftar Rak terbaru saat modal dibuka.
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
    // sama seperti hargaPemakaian di Entry, margin_modal SEKARANG PERSEN (%),
    // bukan nominal Rupiah lagi.
    const hargaPemakaianEdit = computed(() => hargaModalEdit.value * (1 + (parseFloat(formEdit.margin_modal) || 0) / 100));
    // volumeBarangEdit — sama seperti volumeBarang di
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
        satuan_pemakaian: item.satuan_pemakaian || '', margin_modal: item.margin_modal ?? 0,
        // flag opsional, lihat catatan arsitektur di atas file ini.
        pakai_lot_tracking: !!item.pakai_lot_tracking,
        // Rak Penyimpanan (ref) & Volume Barang.
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
      if (!formEdit.jenis || !formEdit.nama.trim() || !formEdit.warna.trim() ||
          !formEdit.satuan_pembelian.trim() || !(parseFloat(formEdit.isi_konversi_pembelian) > 0) || !formEdit.satuan_pemakaian.trim()) {
        alert('Lengkapi semua field wajib dulu.');
        return;
      }
      menyimpanEdit.value = true;
      try {
        // id_tampil, kategori_utama & dibuat_pada SENGAJA tidak ikut diupdate:
        // kategori menentukan prefix ID, jadi salah kategori harus dihapus &
        // di-entry ulang, bukan diedit — kalau tidak, ID jadi tidak konsisten.
        await updateDoc(doc(db, 'master_bahan_aksesoris', sedangEditId.value), {
          jenis: formEdit.jenis, foto: formEdit.foto || null, nama: formEdit.nama.trim(), warna: formEdit.warna.trim(),
          harga_pembelian: parseFloat(formEdit.harga_pembelian) || 0, satuan_pembelian: formEdit.satuan_pembelian.trim(),
          isi_konversi_pembelian: parseFloat(formEdit.isi_konversi_pembelian) || 0, satuan_pemakaian: formEdit.satuan_pemakaian.trim(),
          harga_modal: hargaModalEdit.value, margin_modal: parseFloat(formEdit.margin_modal) || 0, harga_pemakaian: hargaPemakaianEdit.value,
          // lihat catatan hitungLengkap & simpanData.
          lengkap: hitungLengkap({
            kategori_utama: formEdit.kategori_utama, jenis: formEdit.jenis, nama: formEdit.nama, warna: formEdit.warna,
            harga_pembelian: formEdit.harga_pembelian, satuan_pembelian: formEdit.satuan_pembelian,
            isi_konversi_pembelian: formEdit.isi_konversi_pembelian, satuan_pemakaian: formEdit.satuan_pemakaian,
            margin_modal: formEdit.margin_modal
          }),
          konversi_bertingkat: formEdit.konversi_bertingkat || [],
          // flag opsional, lihat catatan arsitektur di atas file ini.
          pakai_lot_tracking: !!formEdit.pakai_lot_tracking,
          // Rak Penyimpanan (ref) & Volume Barang.
          rak_id: formEdit.rak_id || '', rak_label: formEdit.rak_id ? formEdit.rak_label : '',
          tinggi_barang: parseFloat(formEdit.tinggi_barang) || 0, panjang_barang: parseFloat(formEdit.panjang_barang) || 0,
          lebar_barang: parseFloat(formEdit.lebar_barang) || 0, volume_barang: volumeBarangEdit.value,
          panjang_roll: parseFloat(formEdit.panjang_roll) || 0,
          diedit_pada: serverTimestamp(), diedit_oleh: window.currentUser?.email || null
        });
        sedangEditId.value = null;
        await paginasi.muatUlang();
        muatBadgeDanIncomplete(); // refresh badge & tab "Perlu dilengkapi" (tidak di-await, tidak menahan UI)
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
        muatBadgeDanIncomplete(); // refresh badge & tab "Perlu dilengkapi"
      } catch (e) {
        console.error('Gagal hapus Bahan/Aksesoris:', e);
        alert('Gagal menghapus data.');
      }
    }

    // Import/Export Excel
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

    // muatSemuaReferensiImport — SELALU ambil data referensi & data tersimpan
    // TERBARU tiap kali mau import (bukan cache lama), pola sama seperti Import
    // Master Produk (§28.9).
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

    // MURNI nambah data baru: baris yang kombinasi Kategori+Nama+Warna-nya sudah
    // ada di-SKIP, tidak pernah ditimpa. ID dibuat lewat generateIdBerurutan
    // yang sama dipakai form Entry (runTransaction, aman dari tabrakan counter).
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
          // Margin Modal SEKARANG PERSEN (%), bukan nominal Rupiah lagi. Sama
          // formula dengan hargaPemakaian(Edit) di atas — lihat catatan besar di
          // atas file ini.
          const hargaPemakaianBaris = hargaModalBaris * (1 + marginModal / 100);
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
            harga_pemakaian: hargaPemakaianBaris,
            // Baris yang lolos verifikasi popup import selalu lengkap, tapi
            // tetap dihitung ulang lewat hitungLengkap (bukan ditulis `true`)
            // supaya sumber kebenaran "field wajib" cuma satu.
            lengkap: hitungLengkap({
              kategori_utama: b.kategori_utama, jenis: b.jenis, nama: b.nama, warna: b.warna,
              harga_pembelian: hargaPembelian, satuan_pembelian: b.satuan_pembelian,
              isi_konversi_pembelian: isiKonversi, satuan_pemakaian: b.satuan_pemakaian,
              margin_modal: marginModal
            }),
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
        muatBadgeDanIncomplete(); // refresh badge & tab "Perlu dilengkapi"
        alert(`Import selesai: ${dibuat} data baru ditambahkan, ${dilewati} dilewati (sudah ada).`);
      } catch (e) {
        console.error('Gagal import Bahan & Aksesoris:', e);
        alert(e.message && e.message.includes('Prefix ID') ? e.message : 'Gagal mengimpor. Coba lagi.');
      }
      sedangImport.value = false;
    }


    // Panel expand per baris: kiri stok + roll/lot aktif, kanan harga aktif.
    // Semuanya read-only; pengaturannya di Kartu Stok & Riwayat Harga.
    const idExpand = ref(null);
    const expandMemuat = ref(false);
    const expandLot = ref([]);


    // AMBANG kuning "roll/lot mulai menipis" — BELUM ada ketentuan dari soal
    // angka pastinya, dipilih ANGKA AMAN 20% sisa (qty_sisa / qty_awal < 0.2)
    // sebagai asumsi awal, gampang diubah kalau ternyata maunya beda.
    const AMBANG_LOT_MENIPIS = 0.2;
    function statusLot(l) {
      const awal = parseFloat(l.qty_awal) || 0;
      const sisa = parseFloat(l.qty_sisa) || 0;
      if (awal <= 0) return 'ok';
      return (sisa / awal) < AMBANG_LOT_MENIPIS ? 'warn' : 'ok';
    }

    const errorExpand = ref('');
    async function toggleExpand(item) {
      if (idExpand.value === item.id) { idExpand.value = null; return; }
      idExpand.value = item.id;
      expandMemuat.value = true;
      expandLot.value = [];
      errorExpand.value = '';
      try {
        expandLot.value = item.pakai_lot_tracking ? await ambilLotAktif(item.id) : [];
      } catch (e) {
        console.error('Gagal muat roll/lot aktif:', e);
        errorExpand.value = 'Gagal memuat detail baris. Coba lagi.';
      }
      expandMemuat.value = false;
    }

    // Deep-link ke Kartu Stok / Riwayat Harga item ini (fungsi window diekspos
    // vue-kartu-stok.js & vue-stock-pembelian.js).
    function lihatKartuStok(item) {
      if (window.pindahTab) window.pindahTab('tab-stok-pembelian');
      if (window.pindahSubTab) window.pindahSubTab('sub-zh-stock', 'sub-zh-stock-kartustok', document.querySelector('.sub-zh-stock-btn[data-target="sub-zh-stock-kartustok"]'));
      if (window.bukaKartuStokItem) window.bukaKartuStokItem(item.id);
    }
    function lihatRiwayatHarga(item) {
      if (window.pindahTab) window.pindahTab('tab-stok-pembelian');
      if (window.pindahSubTab) window.pindahSubTab('sub-zh-stock', 'sub-zh-stock-riwayat', document.querySelector('.sub-zh-stock-btn[data-target="sub-zh-stock-riwayat"]'));
      if (window.bukaRiwayatHargaItem) window.bukaRiwayatHargaItem(item.id);
    }

    // Pencarian disaring di JS (cocokCari: semua kata, di posisi mana pun, huruf
    // besar/kecil bebas) atas daftarSemua; paginasi Firestore hanya dipakai
    // saat kotak cari kosong.
    function cariInput(nilai) {
      const kosongSebelum = !paginasi.cariTeks.value.trim();
      paginasi.cariTeks.value = nilai;
      visibleCari.value = 20;
      if (filterTab.value !== 'INCOMPLETE' && !nilai.trim() && !kosongSebelum) paginasi.cariDenganDebounce('');
    }

    async function muat() {
      await Promise.all([paginasi.muatUlang(), muatBadgeDanIncomplete()]);
    }
    onMounted(async () => { await window.authReady; await muat(); });

    return {
      filterTab, daftarTab, paginasi, muat, barisTampil, sedangMemuatList, adaLagiUntukDimuat, muatLagi, cariInput,
      memuatBadge, errorBadge, formatRupiah, formatQty,
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
      modeCari,
      idExpand, expandMemuat, expandLot, statusLot, toggleExpand, lihatKartuStok, lihatRiwayatHarga, errorExpand
    };
  },
  template: `
    <div style="display:flex; gap:10px; align-items:center; margin-bottom:12px; flex-wrap:wrap;">
      <div style="position:relative; flex:1; min-width:220px;">
        <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
        <input :value="paginasi.cariTeks.value" @input="cariInput($event.target.value)" type="text" placeholder="Cari nama, warna, jenis, atau ID..." style="width:100%; padding:9px 13px 9px 34px; background:var(--ivory-dim); border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
      </div>
      <!--
        Import/Template Excel, pola sama persis seperti "Import / Template Excel" di List Produk
        (Master Produk, §28.9).
      -->
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
    </div>

    <!-- Tab filter berbadge ganti dropdown "Semua Kategori" yang lama. -->
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px;">
      <button v-for="t in daftarTab" :key="t.nilai" type="button" @click="filterTab = t.nilai"
        class="btn-outline" :class="{ filled: filterTab === t.nilai }" style="font-size:12px; padding:8px 14px;">
        {{ t.label }}
        <span class="gc-badge-count" :style="filterTab === t.nilai ? 'background:#fff; color:var(--burgundy);' : ''">{{ memuatBadge ? '…' : t.angka }}</span>
      </button>
    </div>
    <p v-if="errorBadge" style="font-size:11px; color:var(--danger); margin:-8px 0 12px;">{{ errorBadge }}</p>

    <div v-if="sedangMemuatList && barisTampil.length === 0" class="gc-card" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <div v-else-if="filterTab !== 'INCOMPLETE' && !modeCari && paginasi.errorPaginasi.value" class="gc-card" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasi.errorPaginasi.value }}</div>
    <div v-else-if="barisTampil.length === 0" class="gc-card" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">{{ filterTab === 'INCOMPLETE' ? 'Semua data sudah lengkap.' : (modeCari ? 'Tidak ada yang cocok dengan kata cari.' : 'Belum ada data.') }}</div>
    <div v-else class="gc-table-scroll">
      <table class="gc-table" style="width:100%;">
        <thead>
          <tr>
            <th style="width:48px;">Foto</th>
            <th>Kategori / Jenis</th>
            <th>Nama &amp; Warna / ID</th>
            <th>Pemakaian / Modal</th>
            <th>Stok / Satuan</th>
            <th>Lot &amp; Rak</th>
            <th>Berjenjang</th>
            <th style="width:36px;"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="item in barisTampil" :key="item.id">
            <tr @click="toggleExpand(item)" style="cursor:pointer;" :style="idExpand === item.id ? 'background:var(--ivory);' : ''">
              <td>
                <img v-if="item.foto" :src="item.foto" style="width:36px; height:36px; object-fit:cover; border-radius:8px;">
                <div v-else style="width:36px; height:36px; border-radius:8px; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center;"><i class="fas fa-image" style="color:var(--text-faint); font-size:13px;"></i></div>
              </td>
              <td>
                <span class="tag" :class="item.kategori_utama === 'Aksesoris' ? 'pink' : 'blue'">{{ item.kategori_utama }}</span>
                <div style="font-size:11px; color:var(--text-muted); margin-top:3px;">{{ item.jenis || '-' }}</div>
              </td>
              <td style="white-space:normal; min-width:150px;">
                <div style="font-weight:700; font-size:12.5px;">{{ item.nama }} <i v-if="item.pakai_lot_tracking" class="fas fa-layer-group" style="color:var(--burgundy); font-size:9px;" title="Perlu Qty per Roll/Lot saat diterima"></i></div>
                <div style="font-size:11px; color:var(--text-muted);">{{ item.warna }}</div>
                <div style="font-size:10px; color:var(--text-faint); margin-top:1px;">{{ item.id_tampil || '-' }}</div>
              </td>
              <td>
                <!--
                  Pemakaian di ATAS, Modal di BAWAH — pemakaian dicek lebih sering (dipakai buat
                  kartu produk/BOM), sesuai wireframe.
                -->
                <div style="font-weight:700; font-size:12.5px; color:var(--burgundy);">{{ formatRupiah(item.harga_pemakaian) }}</div>
                <div style="font-size:10.5px; color:var(--text-faint);">Modal {{ formatRupiah(item.harga_modal) }}</div>
              </td>
              <td>
                <div style="font-weight:700; font-size:12.5px;">{{ formatQty(item.stok_akhir) }}</div>
                <div style="font-size:10.5px; color:var(--text-faint);">{{ item.satuan_pemakaian || '-' }}</div>
              </td>
              <td>
                <div style="font-size:12px;">{{ item.rak_label || '-' }}</div>
                <span v-if="item.pakai_lot_tracking" class="tag neutral" style="margin-top:3px;"><i class="fas fa-layer-group" style="margin-right:4px; font-size:9px;"></i>Pakai Lot</span>
              </td>
              <td>
                <span class="tag" :class="item.konversi_bertingkat && item.konversi_bertingkat.length > 0 ? 'ok' : 'neutral'">{{ item.konversi_bertingkat && item.konversi_bertingkat.length > 0 ? 'Ya' : 'Tidak' }}</span>
              </td>
              <td>
                <!-- Hapus sengaja ditaruh terpisah dari 3 tombol panel expand (Edit, Cetak
                  Label, Lihat Kartu Stok) sebagai ikon kecil per baris. -->
                <button @click.stop="hapus(item.id)" class="icon-btn" style="color:var(--danger); width:26px; height:26px;" title="Hapus"><i class="fas fa-trash-alt" style="font-size:11px;"></i></button>
              </td>
            </tr>
            <tr v-if="idExpand === item.id">
              <td colspan="8" style="background:var(--ivory-dim); padding:14px 16px;">
                <div v-if="expandMemuat" style="text-align:center; color:var(--text-faint); font-size:12px; padding:10px 0;">Memuat detail...</div>
                <div v-else-if="errorExpand" style="color:var(--danger); font-size:11.5px; padding:6px 0;"><i class="fas fa-triangle-exclamation" style="margin-right:5px;"></i>{{ errorExpand }}</div>
                <template v-else>
                  <div style="display:grid; gap:16px;" class="grid-cols-1 md:grid-cols-2">
                    <div>
                      <p style="font-size:11px; font-weight:700; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase;"><i class="fas fa-boxes-stacked" style="margin-right:6px;"></i>Stok {{ formatQty(item.stok_akhir) }} {{ item.satuan_pemakaian || '' }} &middot; Roll / Lot Aktif</p>
                      <p v-if="!item.pakai_lot_tracking" style="font-size:11.5px; color:var(--text-faint);">Item ini tidak pakai tracking Roll/Lot.</p>
                      <p v-else-if="expandLot.length === 0" style="font-size:11.5px; color:var(--text-faint);">Belum ada roll/lot aktif tercatat.</p>
                      <div v-else style="display:flex; flex-wrap:wrap; gap:6px;">
                        <!-- Hijau = stok lot masih banyak, Kuning = menipis (sisa < 20%,
                          lihat AMBANG_LOT_MENIPIS/statusLot di setup). -->
                        <span v-for="l in expandLot" :key="l.id" class="tag" :class="statusLot(l)">{{ l.kode_lot }} &middot; {{ formatQty(l.qty_sisa) }}/{{ formatQty(l.qty_awal) }} {{ l.satuan }}</span>
                      </div>
                    </div>
                    <div>
                      <p style="font-size:11px; font-weight:700; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase;"><i class="fas fa-tag" style="margin-right:6px;"></i>Harga Aktif</p>
                      <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 12px; font-size:11.5px;">
                        <span style="color:var(--text-faint);">Pembelian</span><b>{{ formatRupiah(item.harga_pembelian) }} / {{ item.satuan_pembelian || '-' }}</b>
                        <span style="color:var(--text-faint);">Modal</span><b>{{ formatRupiah(item.harga_modal) }} / {{ item.satuan_pemakaian || '-' }}</b>
                        <span style="color:var(--text-faint);">Margin</span><b>{{ item.margin_modal || 0 }}%</b>
                        <span style="color:var(--text-faint);">Pemakaian</span><b style="color:var(--burgundy);">{{ formatRupiah(item.harga_pemakaian) }}</b>
                      </div>
                      <p style="font-size:10.5px; color:var(--text-faint); margin-top:6px;">Diatur di Stok &amp; Pembelian › Riwayat Harga.</p>
                    </div>
                  </div>
                  <div style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap;">
                    <button @click.stop="bukaEdit(item)" class="btn-outline" style="flex:1; min-width:120px; font-size:11.5px; padding:7px 12px;"><i class="fas fa-pen" style="margin-right:6px;"></i>Edit</button>
                    <button @click.stop="lihatRiwayatHarga(item)" class="btn-outline" style="flex:1; min-width:120px; font-size:11.5px; padding:7px 12px;"><i class="fas fa-tag" style="margin-right:6px;"></i>Atur Harga</button>
                    <button @click.stop="lihatKartuStok(item)" class="btn-outline" style="flex:1; min-width:120px; font-size:11.5px; padding:7px 12px;"><i class="fas fa-boxes-stacked" style="margin-right:6px;"></i>Lihat Kartu Stok</button>
                  </div>
                </template>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <!--
      "Muat 20 lagi" (load-more), BUKAN lagi tombol Sebelumnya/Berikutnya, sesuai wireframe. Lihat
      catatan daftarAkumulasi/muatLagi di setup.
    -->
    <div v-if="barisTampil.length > 0" style="display:flex; justify-content:center; margin-top:16px;">
      <button v-if="adaLagiUntukDimuat" @click="muatLagi" :disabled="sedangMemuatList" class="btn-outline" style="font-size:12px;">{{ sedangMemuatList ? 'Memuat...' : 'Muat 20 Lagi' }}</button>
      <span v-else style="font-size:11px; color:var(--text-faint);">Semua data sudah dimuat ({{ barisTampil.length }}).</span>
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
          <div class="gc-field"><label>Harga Pembelian</label><input :value="formatRupiah(formEdit.harga_pembelian)" type="text" disabled></div>
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

        <!--
          tombol Konversi Banyak Tingkat DIPINDAH, sama seperti di form Entry (lihat catatan di
          sana).
        -->
        <div v-if="!(formEdit.konversi_bertingkat && formEdit.konversi_bertingkat.length > 0)" style="margin-top:10px;">
          <button @click="bukaPopupKonversiEdit" class="btn-outline" style="white-space:nowrap; padding:0 16px; height:44px;"><i class="fas fa-calculator" style="margin-right:6px;"></i>Konversi Banyak Tingkat</button>
        </div>

        <!-- flag opsional, sama seperti form Entry. -->
        <div class="gc-field" style="margin-top:12px;">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:400;">
            <input type="checkbox" v-model="formEdit.pakai_lot_tracking" style="accent-color:var(--burgundy); width:16px; height:16px;">
            <span>Perlu Qty per Roll/Lot saat diterima (mis. bahan berbentuk Roll/Kones)</span>
          </label>
        </div>

        <!--
          Rak Penyimpanan sekarang 1 dropdown pilih Rak terdaftar, sama seperti form Entry (lihat
          catatan di sana).
        -->
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

        <p style="font-size:11px; color:var(--text-faint); margin:16px 0 0;"><i class="fas fa-circle-info" style="margin-right:5px;"></i>Harga &amp; margin ({{ formEdit.margin_modal || 0 }}%) hanya diubah di Stok &amp; Pembelian › Riwayat Harga.</p>
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

  `
};

const AppBahanAksesorisEntry = { components: { BahanAksesorisEntryManager }, template: `<bahan-aksesoris-entry-manager ref="mgr" />` };
let vmBahanAksesorisEntry = null;
window.pastikanMountBahanAksesorisEntry = function() {
  if (vmBahanAksesorisEntry) {
    const mgr = vmBahanAksesorisEntry.$refs && vmBahanAksesorisEntry.$refs.mgr;
    if (mgr && typeof mgr.muat === 'function') mgr.muat();
    return;
  }
  const mountPoint = document.getElementById('vue-bahan-aksesoris-entry');
  if (mountPoint) vmBahanAksesorisEntry = createApp(AppBahanAksesorisEntry).mount('#vue-bahan-aksesoris-entry');
};

const AppBahanAksesorisList = { components: { BahanAksesorisListManager }, template: `<bahan-aksesoris-list-manager ref="mgr" />` };
let vmBahanAksesorisList = null;
window.pastikanMountBahanAksesorisList = function() {
  if (vmBahanAksesorisList) {
    const mgr = vmBahanAksesorisList.$refs && vmBahanAksesorisList.$refs.mgr;
    if (mgr && typeof mgr.muat === 'function') mgr.muat();
    return;
  }
  const mountPoint = document.getElementById('vue-bahan-aksesoris-list');
  if (mountPoint) vmBahanAksesorisList = createApp(AppBahanAksesorisList).mount('#vue-bahan-aksesoris-list');
};
