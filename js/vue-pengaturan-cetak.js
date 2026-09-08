// js/vue-pengaturan-cetak.js
// ============================================================================
// Pengaturan Cetak — BARU (8 Sep 2026, keputusan Guru, audit kode proyek).
//
// LATAR: audit menemukan `PopupPratinjauCetakLabel` (vue-components.js) pakai
// SATU ukuran fisik hardcode (4x2 inch) untuk SEMUA jenis label di seluruh
// app — padahal PEDOMAN-SERAH-TERIMA.md §5 mendokumentasikan ukuran BERBEDA
// per jenis (SPK Grouping 10x15cm, label kecil 4x2cm, dst) dan bagian
// "Setting cetak terpusat" PEDOMAN eksplisit minta 1 config per jenis
// cetak, diedit dari menu Scan & Cetak, otomatis berlaku ke semua pos
// pemakainya ("satu modul cetak, banyak pos"). Fitur itu belum pernah ada.
//
// KEPUTUSAN GURU (audit 8 Sep 2026):
// - Ukuran kertas (lebar x tinggi mm) & posisi QR diedit dari SINI, per
//   jenis cetak — TIDAK per modul/pos, walau dipakai banyak pos (mis.
//   "kode_bagging" dipakai Cutting+Serie+Sewing+Finishing+Vendor, SATU
//   config untuk semuanya).
// - Default (kalau Guru belum pernah mengedit satu jenis) = ukuran yang
//   SUDAH berjalan sekarang (4x2 inch = 101.6x50.8mm) — supaya cetak yang
//   sudah jalan TIDAK berubah tiba-tiba tanpa Guru sengaja mengubahnya.
// - "Data yang ditampilkan": nama/info tetap toggle sesi seperti sebelumnya
//   (checkbox di popup cetak, TIDAK dipindah ke sini) — yang dipindah ke
//   sini cuma field TAMBAHAN yang sebelumnya hardcode ada/tidaknya (rincian
//   khusus per jenis, lihat `rincianTersedia` tiap entri katalog). Jenis
//   yang tidak punya rincian tambahan cukup diatur ukuran & posisi QR-nya.
//
// Koleksi: `pengaturan_cetak/{jenisId}` — field: lebar_mm, tinggi_mm,
// posisi_qr ('kiri'|'kanan'|'atas'), rincian_aktif (array<string>, urutan
// tampil), diubah_pada, diubah_oleh.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, doc, getDoc, setDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// KATALOG_CETAK — daftar TETAP semua jenis cetak di app ini. Menambah jenis
// cetak BARU di kemudian hari = tambah 1 entri di sini (id harus SAMA persis
// dengan yang dipakai pemanggil `PopupPratinjauCetakLabel :jenis-cetak="..."`).
export const KATALOG_CETAK = {
  label_spk_bahan: {
    label: 'Label SPK Grouping — Bahan', kategori: 'Persiapan Produksi',
    keterangan: 'Persiapan Produksi > Bahan, tiap tahap. 1 label per bahan.',
    rincianTersedia: []
  },
  label_spk_acc_sewing: {
    label: 'Label SPK Grouping — Acc Sewing', kategori: 'Persiapan Produksi',
    keterangan: 'Persiapan Produksi > Acc Sewing. 1 SPK = 1 label.',
    rincianTersedia: []
  },
  label_spk_acc_webbing: {
    label: 'Label SPK Grouping — Acc Webbing', kategori: 'Persiapan Produksi',
    keterangan: 'Persiapan Produksi > Acc Webbing. 1 SPK = 1 label.',
    rincianTersedia: [
      { key: 'roll', label: 'Roll' },
      { key: 'kode_webbing2', label: 'Kode Webbing 2' },
      { key: 'kode_webbing3', label: 'Kode Webbing 3' }
    ]
  },
  label_spk_acc_finishing: {
    label: 'Label SPK Grouping — Acc Finishing', kategori: 'Persiapan Produksi',
    keterangan: 'Persiapan Produksi > Acc Finishing. 1 SPK = 1 label.',
    rincianTersedia: [
      { key: 'varian', label: 'Varian & Jumlah' }
    ]
  },
  label_masalah: {
    label: 'Label — Persiapan Masalah', kategori: 'Persiapan Produksi',
    keterangan: 'Persiapan Produksi > Masalah, 1 label per baris kekurangan.',
    rincianTersedia: []
  },
  label_komponen_cutting: {
    label: 'Label Komponen — Cutting', kategori: 'Proses Produksi',
    keterangan: 'Proses Produksi > Cutting, per bom pola x isi pola.',
    rincianTersedia: []
  },
  kode_bagging: {
    label: 'Kode Bagging', kategori: 'Proses Produksi',
    keterangan: 'Dipakai bareng: Cutting, Serie, Sewing, Finishing, Vendor (Persiapan Produksi).',
    rincianTersedia: []
  },
  lembar_kode_tugas: {
    label: 'Lembar Kode Tugas', kategori: 'Proses Produksi',
    keterangan: 'Dipakai bareng: Serie, Sewing, Finishing, Vendor (Persiapan Produksi).',
    rincianTersedia: []
  },
  id_komponen_serie: {
    label: 'ID Komponen — Serie', kategori: 'Proses Produksi',
    keterangan: 'Proses Produksi > Serie, per komponen per batch separating.',
    rincianTersedia: []
  },
  batch_separating: {
    label: 'Cetak Batch Separating — Serie', kategori: 'Proses Produksi',
    keterangan: 'Proses Produksi > Serie.',
    rincianTersedia: []
  },
  label_pcs_sewing: {
    label: 'Label per Pcs — Sewing', kategori: 'Proses Produksi',
    keterangan: 'Proses Produksi > Sewing. QR + SKU + produk + ukuran + warna + kode pcs + kode batch — sekaligus barcode jual.',
    rincianTersedia: []
  },
  label_bahan_aksesoris: {
    label: 'Label Bahan & Aksesoris', kategori: 'Zevanic House',
    keterangan: 'Zevanic House > Master Bahan & Aksesoris.',
    rincianTersedia: []
  },
  // 3 entri BARU (8 Sep 2026) — ditemukan saat menyambungkan tiap pemanggil
  // popup ke katalog ini: 3 titik cetak label ini SUDAH ADA di kode tapi
  // belum tercakup katalog awal (bukan bug, cuma katalog awal belum
  // lengkap menyisir semua pemanggil).
  label_spk_terbit: {
    label: 'Label SPK Baru Terbit', kategori: 'Persiapan Produksi',
    keterangan: 'Persiapan Produksi > Perlu Disiapkan, langsung setelah tombol Buat SPK Grouping ditekan (ringkasan lintas jalur, SEBELUM masuk ke layar per-jalur).',
    rincianTersedia: []
  },
  label_no_spk: {
    label: 'Label No. SPK', kategori: 'Zevanic House',
    keterangan: 'Zevanic House > Order SPK (master data No. SPK dari spreadsheet lama).',
    rincianTersedia: []
  },
  label_roll_pembelian: {
    label: 'Label Roll Pembelian', kategori: 'Stok & Pembelian',
    keterangan: 'Stok & Pembelian > Nota Order Belanja, cetak label per roll/lot yang diterima.',
    rincianTersedia: []
  },
  struk_kasir: {
    label: 'Struk Kasir', kategori: 'Pesanan',
    keterangan: 'Pesanan > Penjualan Kasir. Kertas roll (lebar saja, bukan label QR).',
    rincianTersedia: [],
    strukRoll: true // penanda: pakai lebar_mm saja (roll thermal), tinggi menyesuaikan isi
  }
};

const DEFAULT_PENGATURAN = { lebar_mm: 101.6, tinggi_mm: 50.8, posisi_qr: 'kiri', rincian_aktif: [] };
const DEFAULT_STRUK = { lebar_mm: 80, tinggi_mm: 0, posisi_qr: 'kiri', rincian_aktif: [] };

// Cache in-memory per sesi — hemat read Firestore (PELAJARAN.md), 1 doc
// dibaca sekali per sesi kecuali baru saja disimpan ulang dari Pengaturan
// Cetak (langsung update cache, tidak nunggu reload).
const _cachePengaturan = new Map();

// ambilPengaturanCetak — dipanggil PopupPratinjauCetakLabel & PopupPratinjauCetakStruk
// sebelum render pratinjau. Fallback ke default (= ukuran yang sudah
// berjalan sekarang) kalau dokumen belum pernah dibuat Guru.
export async function ambilPengaturanCetak(jenisId) {
  if (_cachePengaturan.has(jenisId)) return _cachePengaturan.get(jenisId);
  const fallback = (KATALOG_CETAK[jenisId] && KATALOG_CETAK[jenisId].strukRoll) ? DEFAULT_STRUK : DEFAULT_PENGATURAN;
  try {
    const snap = await getDoc(doc(db, 'pengaturan_cetak', jenisId));
    const hasil = snap.exists() ? { ...fallback, ...snap.data() } : { ...fallback };
    _cachePengaturan.set(jenisId, hasil);
    return hasil;
  } catch (e) {
    console.error('Gagal ambil pengaturan_cetak/' + jenisId + ':', e);
    return { ...fallback };
  }
}

function invalidasiCache(jenisId, data) {
  _cachePengaturan.set(jenisId, { ...data });
}

// ---------------------------------------------------------------------------
// AppPengaturanCetak — layar admin, mount di Scan & Cetak > Pengaturan Cetak.
// ---------------------------------------------------------------------------
export const AppPengaturanCetak = {
  setup() {
    const memuat = ref(true);
    const daftarJenis = ref([]); // [{id, ...katalog, pengaturan}]
    const editAktif = ref(null); // jenisId yang lagi dibuka form editnya
    const formEdit = reactive({ lebar_mm: 0, tinggi_mm: 0, posisi_qr: 'kiri', rincian_aktif: [] });
    const menyimpan = ref(false);

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDocs(collection(db, 'pengaturan_cetak'));
        const peta = {};
        snap.forEach(d => { peta[d.id] = d.data(); });
        daftarJenis.value = Object.keys(KATALOG_CETAK).map(id => {
          const kat = KATALOG_CETAK[id];
          const fallback = kat.strukRoll ? DEFAULT_STRUK : DEFAULT_PENGATURAN;
          const pengaturan = peta[id] ? { ...fallback, ...peta[id] } : { ...fallback, _belumDiatur: true };
          _cachePengaturan.set(id, pengaturan); // sinkronkan cache sekalian
          return { id, ...kat, pengaturan };
        });
      } catch (e) {
        console.error('Gagal muat pengaturan_cetak:', e);
        alert('Gagal memuat Pengaturan Cetak. Coba refresh.');
      }
      memuat.value = false;
    }

    function bukaEdit(j) {
      editAktif.value = j.id;
      formEdit.lebar_mm = j.pengaturan.lebar_mm;
      formEdit.tinggi_mm = j.pengaturan.tinggi_mm;
      formEdit.posisi_qr = j.pengaturan.posisi_qr;
      formEdit.rincian_aktif = [...(j.pengaturan.rincian_aktif || [])];
    }
    function tutupEdit() { editAktif.value = null; }

    function toggleRincian(key) {
      const idx = formEdit.rincian_aktif.indexOf(key);
      if (idx >= 0) formEdit.rincian_aktif.splice(idx, 1);
      else formEdit.rincian_aktif.push(key);
    }
    function naikkanRincian(key) {
      const idx = formEdit.rincian_aktif.indexOf(key);
      if (idx > 0) { const t = formEdit.rincian_aktif[idx - 1]; formEdit.rincian_aktif[idx - 1] = formEdit.rincian_aktif[idx]; formEdit.rincian_aktif[idx] = t; }
    }
    function turunkanRincian(key) {
      const idx = formEdit.rincian_aktif.indexOf(key);
      if (idx >= 0 && idx < formEdit.rincian_aktif.length - 1) { const t = formEdit.rincian_aktif[idx + 1]; formEdit.rincian_aktif[idx + 1] = formEdit.rincian_aktif[idx]; formEdit.rincian_aktif[idx] = t; }
    }

    async function simpanEdit() {
      if (!(parseFloat(formEdit.lebar_mm) > 0)) return alert('Lebar kertas harus lebih dari 0 mm.');
      const jenis = KATALOG_CETAK[editAktif.value];
      if (!jenis.strukRoll && !(parseFloat(formEdit.tinggi_mm) > 0)) return alert('Tinggi kertas harus lebih dari 0 mm.');
      menyimpan.value = true;
      try {
        const data = {
          lebar_mm: parseFloat(formEdit.lebar_mm) || 0,
          tinggi_mm: jenis.strukRoll ? 0 : (parseFloat(formEdit.tinggi_mm) || 0),
          posisi_qr: formEdit.posisi_qr,
          rincian_aktif: [...formEdit.rincian_aktif],
          diubah_pada: serverTimestamp(),
          diubah_oleh: (window.currentUser && (window.currentUser.nama || window.currentUser.email)) || '-'
        };
        await setDoc(doc(db, 'pengaturan_cetak', editAktif.value), data, { merge: true });
        invalidasiCache(editAktif.value, data);
        const item = daftarJenis.value.find(j => j.id === editAktif.value);
        if (item) { item.pengaturan = { ...data }; delete item.pengaturan._belumDiatur; }
        editAktif.value = null;
        alert('Pengaturan cetak disimpan.');
      } catch (e) {
        console.error('Gagal simpan pengaturan_cetak:', e);
        alert('Gagal menyimpan. Coba lagi.');
      }
      menyimpan.value = false;
    }

    onMounted(muat);

    return {
      memuat, daftarJenis, editAktif, formEdit, menyimpan,
      bukaEdit, tutupEdit, toggleRincian, naikkanRincian, turunkanRincian, simpanEdit
    };
  },
  template: `
    <div>
      <div style="margin-bottom:14px;">
        <h3 class="gc-heading" style="font-size:14px; font-weight:700; margin:0 0 4px;">Pengaturan Cetak</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0;">Satu jenis cetak = satu pengaturan, berlaku otomatis ke semua pos pemakainya. Ukuran default = ukuran yang sudah berjalan sekarang (belum pernah diubah).</p>
      </div>

      <div v-if="memuat" class="gc-kosong">Memuat...</div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="j in daftarJenis" :key="j.id" class="gc-card" style="padding:12px 14px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
            <div style="min-width:0;">
              <div style="font-weight:700; font-size:12.5px;">{{ j.label }}</div>
              <div style="font-size:10px; color:var(--text-faint); margin-top:2px;">{{ j.keterangan }}</div>
              <div class="gc-num" style="font-size:11px; margin-top:6px; color:var(--text-muted);">
                <span v-if="j.strukRoll">Lebar roll: {{ j.pengaturan.lebar_mm }}mm</span>
                <span v-else>{{ j.pengaturan.lebar_mm }} x {{ j.pengaturan.tinggi_mm }} mm</span>
                &middot; QR di {{ j.pengaturan.posisi_qr }}
                <span v-if="j.rincianTersedia.length"> &middot; {{ j.pengaturan.rincian_aktif.length }}/{{ j.rincianTersedia.length }} rincian aktif</span>
              </div>
              <span v-if="j.pengaturan._belumDiatur" class="tag warn" style="margin-top:6px;">Belum pernah diatur</span>
            </div>
            <button @click="bukaEdit(j)" class="btn-outline" style="flex-shrink:0; padding:7px 12px; font-size:11px;"><i class="fas fa-pen" style="margin-right:5px;"></i>Edit</button>
          </div>
        </div>
      </div>

      <div v-if="editAktif" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="tutupEdit">
        <div class="gc-card" style="max-width:420px; width:100%; max-height:88vh; overflow-y:auto; padding:18px;">
          <h3 class="gc-heading" style="font-size:14px; font-weight:700; margin:0 0 12px;">{{ daftarJenis.find(j=>j.id===editAktif).label }}</h3>

          <div v-if="KATALOG_CETAK[editAktif].strukRoll" class="gc-field">
            <label>Lebar Kertas Roll (mm)</label>
            <input v-model.number="formEdit.lebar_mm" type="number" min="1" placeholder="mis. 58 atau 80">
          </div>
          <div v-else style="display:flex; gap:10px;">
            <div class="gc-field" style="flex:1;"><label>Lebar (mm)</label><input v-model.number="formEdit.lebar_mm" type="number" min="1"></div>
            <div class="gc-field" style="flex:1;"><label>Tinggi (mm)</label><input v-model.number="formEdit.tinggi_mm" type="number" min="1"></div>
          </div>

          <div class="gc-field">
            <label>Posisi QR</label>
            <select v-model="formEdit.posisi_qr">
              <option value="kiri">Kiri</option>
              <option value="kanan">Kanan</option>
              <option value="atas">Atas</option>
            </select>
          </div>

          <div v-if="daftarJenis.find(j=>j.id===editAktif).rincianTersedia.length" style="margin-top:6px;">
            <label style="font-size:11px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">Rincian tambahan yang ditampilkan (urutan dari atas = urutan cetak)</label>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <div v-for="r in daftarJenis.find(j=>j.id===editAktif).rincianTersedia" :key="r.key" style="display:flex; align-items:center; gap:8px; font-size:11.5px; padding:6px 8px; border-radius:8px; background:var(--ivory-dim);">
                <input type="checkbox" :checked="formEdit.rincian_aktif.includes(r.key)" @change="toggleRincian(r.key)">
                <span style="flex:1;">{{ r.label }}</span>
                <button v-if="formEdit.rincian_aktif.includes(r.key)" type="button" @click="naikkanRincian(r.key)" class="icon-btn" style="padding:2px 6px;"><i class="fas fa-arrow-up"></i></button>
                <button v-if="formEdit.rincian_aktif.includes(r.key)" type="button" @click="turunkanRincian(r.key)" class="icon-btn" style="padding:2px 6px;"><i class="fas fa-arrow-down"></i></button>
              </div>
            </div>
          </div>

          <div style="display:flex; gap:8px; margin-top:16px;">
            <button @click="simpanEdit" :disabled="menyimpan" class="btn-primary" style="flex:1; padding:10px;">{{ menyimpan ? 'Menyimpan...' : 'Simpan' }}</button>
            <button @click="tutupEdit" type="button" class="btn-outline" style="flex:1; padding:10px;">Batal</button>
          </div>
        </div>
      </div>
    </div>
  `,
  data() { return { KATALOG_CETAK }; }
};

let _appPengaturanCetak = null;
window.pastikanMountPengaturanCetak = function () {
  const el = document.getElementById('vue-pengaturan-cetak');
  if (!el || el.dataset.mounted === '1') return;
  _appPengaturanCetak = createApp(AppPengaturanCetak);
  _appPengaturanCetak.mount('#vue-pengaturan-cetak');
  el.dataset.mounted = '1';
};
