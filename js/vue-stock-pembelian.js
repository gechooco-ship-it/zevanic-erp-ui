// js/vue-stock-pembelian.js
// ============================================================================
// Zevanic House > Stock & Pembelian — fitur BARU (24 Agt 2026). 3 menu:
//   1. Alias Pembelian (AliasPembelianManager) — pemetaan nama barang di
//      nota suplayer (bisa beda-beda tiap suplayer) ke 1 item internal di
//      Data Bahan & Aksesoris.
//   2. List Order Belanja (OrderBelanjaScreen, mode-nota=false) — layar
//      "kasir": Group 1 "Daftar Permintaan Bahan & Aksesoris" (REFERENSI
//      SAJA, sumber dari Persiapan Masalah, TIDAK bisa diklik-tambah),
//      Group 2 "Daftar Order Belanja" — entry manual Suplayer(terkunci
//      sampai diganti)+Qty+Nama Barang, hasilnya masuk tabel "Daftar
//      Pesanan Pembelian".
//   3. Nota Order Belanja (OrderBelanjaScreen, mode-nota=true) — SAMA
//      seperti List Order Belanja, TAPI Group 1 dilabel ulang "Daftar
//      Pesanan Bahan & Aksesoris" dan tiap barisnya punya tombol (+) yang
//      LANGSUNG menambah ke "Daftar Pesanan Pembelian" (butuh Suplayer
//      sudah dipilih dulu) — begitu masuk, request Persiapan Masalah
//      terkait otomatis ditandai "sudah_dipesan".
//
// KEPUTUSAN DESAIN (AskUserQuestion, 24 Agt 2026 — lihat STATUS-PROYEK.md
// §21 untuk detail & alasan lengkap):
//   - Q2: kolom cross-check "stok sebelum" di tabel Daftar Pesanan
//     Pembelian DISKIP dulu (belum ada modul stok) — bisa ditambah nanti.
//   - Q3 (rekomendasi Claude, sudah dikonfirmasi arahnya oleh Hilman lewat
//     jawaban "Pending = simpan sebagai draft"): 1 koleksi `pesanan_pembelian`
//     dengan field `status`: 'draft' (tombol PENDING, boleh belum lengkap)
//     -> 'final' (tombol SIMPAN, order dianggap resmi/jadi). TIDAK ada
//     tombol DR.PENDING (dihapus sesuai permintaan). Belum ada tahap
//     approval terpisah (mis. owner approve) di versi ini — status hanya
//     draft/final — KARENA belum ada dampak ke stok (Qty belum menambah
//     stok apapun, poin Q2), jadi belum mendesak. Kalau nanti stok mulai
//     kepengaruh, `status` ini dirancang gampang ditambah 1 tahap lagi
//     (mis. 'menunggu_approval') tanpa bongkar struktur, sama seperti pola
//     `tahap` di koleksi `reimburse`.
//   - Q4: Master Suplayer dikelola pakai MasterDataTabelManager yang sudah
//     ada (vue-components.js), diperluas 1 kolom opsional (field3Key/Label,
//     lihat perubahan di file itu) untuk Kontak/Alamat.
//   - No. Pembelian (contoh "NP001") pola SAMA seperti ID Bahan/Aksesoris:
//     prefix diatur admin, counter naik otomatis via runTransaction,
//     koleksi baru `pengaturan_id_pembelian`.
//   - Dropdown "No. Pembelian" di atas form MERANGKAP jadi daftar draft
//     tersimpan ("didalamnya nanti ada daftar jg yg masih draft" — jawaban
//     Hilman) — pilih "Buat Baru" atau salah satu draft untuk lanjut edit.
//   - Item per Pesanan Pembelian disimpan sebagai ARRAY di dalam 1 dokumen
//     (bukan sub-koleksi terpisah) — jumlah baris per order wajar kecil,
//     lebih sederhana dibaca/ditulis sekaligus (konsisten prinsip hemat).
// ============================================================================
import { createApp, ref, reactive, computed, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDoc, getDocs, setDoc, serverTimestamp, runTransaction, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DropdownCari, MasterDataTabelManager } from './vue-components.js';

// --- helper: ambil semua Bahan+Aksesoris (disalin dari vue-bahan-aksesoris.js
// / vue-persiapan-masalah.js secara sengaja — lihat catatan di file itu). ---
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
async function ambilDaftarSuplayer() {
  try {
    const snap = await getDocs(collection(db, 'master_suplayer'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    return list;
  } catch (e) {
    console.error('Gagal ambil daftar Suplayer:', e);
    return [];
  }
}
function formatRupiah(n) {
  const angka = parseFloat(n) || 0;
  return 'Rp ' + Math.round(angka).toLocaleString('id-ID');
}
// generateNoPembelian — pola SAMA seperti generateIdBerurutan di
// vue-bahan-aksesoris.js, cuma 1 kunci saja (tidak per-kategori).
async function generateNoPembelian() {
  const refDoc = doc(db, 'pengaturan_id_pembelian', 'pembelian');
  return await runTransaction(db, async (trx) => {
    const snap = await trx.get(refDoc);
    const data = snap.exists() ? snap.data() : null;
    if (!data || !data.prefix) {
      throw new Error('Prefix No. Pembelian belum diatur. Buka tombol "Pengaturan" (ikon gear) dulu untuk mengatur prefix-nya, baru simpan lagi.');
    }
    const counterBaru = (data.counter || 0) + 1;
    if (snap.exists()) trx.update(refDoc, { counter: counterBaru });
    else trx.set(refDoc, { prefix: data.prefix, counter: counterBaru });
    return `${data.prefix}${String(counterBaru).padStart(3, '0')}`;
  });
}

// ---------------------------------------------------------------------------
// MasterSuplayerManager — pembungkus tipis MasterDataTabelManager, field
// ke-3 "Kontak/Alamat" (opsional) sesuai permintaan Hilman.
// ---------------------------------------------------------------------------
const MasterSuplayerManager = {
  components: { MasterDataTabelManager },
  template: `<master-data-tabel-manager koleksi="master_suplayer" label-singular="Suplayer" label-nama="Nama Suplayer" menu-id="master_suplayer" field3-key="kontak" field3-label="Kontak/Alamat (opsional)" />`
};

// ---------------------------------------------------------------------------
// PengaturanStockPembelian — panel gear: atur prefix No. Pembelian + kelola
// Master Suplayer. Dipakai di ke-3 menu Stock & Pembelian.
// ---------------------------------------------------------------------------
const PengaturanStockPembelian = {
  components: { MasterSuplayerManager },
  emits: ['tutup'],
  setup(props, { emit }) {
    const prefix = ref('');
    const counter = ref(0);
    const memuat = ref(true);
    const menyimpan = ref(false);

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDoc(doc(db, 'pengaturan_id_pembelian', 'pembelian'));
        if (snap.exists()) { prefix.value = snap.data().prefix || ''; counter.value = snap.data().counter || 0; }
      } catch (e) {
        console.error('Gagal muat pengaturan No. Pembelian:', e);
      }
      memuat.value = false;
    }
    async function simpan() {
      if (!prefix.value.trim()) return alert('Isi prefix No. Pembelian dulu (contoh: NP).');
      menyimpan.value = true;
      try {
        await setDoc(doc(db, 'pengaturan_id_pembelian', 'pembelian'), { prefix: prefix.value.trim().toUpperCase() }, { merge: true });
        alert('Pengaturan tersimpan.');
      } catch (e) {
        console.error('Gagal simpan pengaturan No. Pembelian:', e);
        alert('Gagal menyimpan.');
      }
      menyimpan.value = false;
    }
    onMounted(muat);
    return { prefix, counter, memuat, menyimpan, simpan };
  },
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="$emit('tutup')">
      <div class="gc-card" style="max-width:480px; width:100%; max-height:90vh; overflow-y:auto;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:14px;"><i class="fas fa-gear" style="color:var(--burgundy); margin-right:8px;"></i>Pengaturan Stock &amp; Pembelian</h3>
        <div v-if="memuat" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;">Memuat...</div>
        <template v-else>
          <p style="font-size:11.5px; font-weight:700; color:var(--text-muted); margin-bottom:8px;">Prefix No. Pembelian (contoh: NP) — nomor urut naik otomatis.</p>
          <div class="gc-field">
            <label>Prefix</label>
            <input v-model="prefix" type="text" placeholder="Contoh: NP" style="text-transform:uppercase;">
            <p style="font-size:10px; color:var(--text-faint); margin-top:4px;">Sudah terpakai: {{ counter }}. Nomor berikutnya: {{ (prefix||'...').toUpperCase() }}{{ String(counter+1).padStart(3,'0') }}</p>
          </div>
          <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="width:100%; margin-bottom:20px;">{{ menyimpan ? 'Menyimpan...' : 'Simpan Prefix' }}</button>
          <hr style="border-color:var(--line); margin-bottom:16px;">
          <div class="gc-card" style="padding:14px;">
            <master-suplayer-manager />
          </div>
        </template>
        <button @click="$emit('tutup')" class="btn-outline" style="width:100%; margin-top:18px;">Tutup</button>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// AliasPembelianManager — menu "Alias Pembelian"
// ---------------------------------------------------------------------------
const AliasPembelianManager = {
  components: { DropdownCari, PengaturanStockPembelian },
  setup() {
    const daftarBahan = ref([]);
    const daftarSuplayer = ref([]);
    const daftarAlias = ref([]);
    const memuat = ref(true);
    const menyimpan = ref(false);
    const tampilPengaturan = ref(false);

    const form = reactive({ suplayerNama: '', namaInternal: '', namaDiNota: '' });
    const opsiNamaInternal = computed(() => daftarBahan.value.map(b => b.nama));
    const opsiSuplayer = computed(() => daftarSuplayer.value.map(s => s.nama));

    const bolehTambah = computed(() => window.cekIzinMenu('stock_alias_pembelian', 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu('stock_alias_pembelian', 'delete') !== false);

    async function muatSemua() {
      memuat.value = true;
      try {
        const [bahan, suplayer, snapAlias] = await Promise.all([
          ambilDaftarBahanAksesorisLengkap(),
          ambilDaftarSuplayer(),
          getDocs(collection(db, 'alias_pembelian'))
        ]);
        daftarBahan.value = bahan;
        daftarSuplayer.value = suplayer;
        const list = []; snapAlias.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.suplayer_nama || '').localeCompare(b.suplayer_nama || ''));
        daftarAlias.value = list;
      } catch (e) {
        console.error('Gagal muat Alias Pembelian:', e);
      }
      memuat.value = false;
    }

    async function tambah() {
      if (!bolehTambah.value) return alert('Anda tidak punya izin menambah di sini. Hubungi Owner/PIC.');
      const suplayer = daftarSuplayer.value.find(s => s.nama === form.suplayerNama);
      const bahan = daftarBahan.value.find(b => b.nama === form.namaInternal);
      if (!suplayer) return alert('Pilih Suplayer dulu. Kalau belum ada, tambahkan lewat tombol Pengaturan.');
      if (!bahan) return alert('Pilih Nama Bahan/Aksesoris (internal) dulu.');
      const namaDiNota = form.namaDiNota.trim();
      if (!namaDiNota) return alert('Isi nama barang persis seperti di nota Suplayer.');
      if (daftarAlias.value.some(a => a.suplayer_id === suplayer.id && (a.nama_di_nota || '').toLowerCase() === namaDiNota.toLowerCase())) {
        return alert('Alias ini sudah ada untuk Suplayer tersebut.');
      }
      menyimpan.value = true;
      try {
        await addDoc(collection(db, 'alias_pembelian'), {
          suplayer_id: suplayer.id, suplayer_nama: suplayer.nama,
          bahan_aksesoris_id: bahan.id, bahan_aksesoris_nama: bahan.nama,
          nama_di_nota: namaDiNota,
          dibuat_pada: serverTimestamp()
        });
        form.namaInternal = ''; form.namaDiNota = '';
        await muatSemua();
      } catch (e) {
        console.error('Gagal simpan Alias Pembelian:', e);
        alert('Gagal menyimpan.');
      }
      menyimpan.value = false;
    }

    async function hapus(item) {
      if (!bolehHapus.value) return alert('Anda tidak punya izin menghapus di sini. Hubungi Owner/PIC.');
      if (!confirm(`Hapus alias "${item.nama_di_nota}" -> "${item.bahan_aksesoris_nama}"?`)) return;
      try {
        await deleteDoc(doc(db, 'alias_pembelian', item.id));
        await muatSemua();
      } catch (e) {
        console.error('Gagal hapus Alias Pembelian:', e);
        alert('Gagal menghapus.');
      }
    }

    onMounted(async () => { await window.authReady; muatSemua(); });
    return { daftarAlias, memuat, menyimpan, form, opsiNamaInternal, opsiSuplayer, bolehTambah, bolehHapus, tampilPengaturan, tambah, hapus };
  },
  template: `
    <div class="gc-card" style="padding:16px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
        <h3 style="font-weight:700; font-size:15px;"><i class="fas fa-tags" style="color:var(--burgundy); margin-right:8px;"></i>Alias Pembelian</h3>
        <button @click="tampilPengaturan = true" class="icon-btn" title="Pengaturan"><i class="fas fa-gear"></i></button>
      </div>
      <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Petakan nama barang di nota Suplayer (bisa beda-beda tiap Suplayer) ke 1 item internal di Data Bahan &amp; Aksesoris — supaya pencarian di Order Belanja lebih gampang.</p>
      <div v-if="bolehTambah" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:14px;">
        <div class="gc-field" style="margin-bottom:0;"><label>Suplayer</label><dropdown-cari v-model="form.suplayerNama" :opsi="opsiSuplayer" placeholder="Pilih Suplayer..." /></div>
        <div class="gc-field" style="margin-bottom:0;"><label>Nama Internal</label><dropdown-cari v-model="form.namaInternal" :opsi="opsiNamaInternal" placeholder="Pilih item internal..." /></div>
        <div class="gc-field" style="margin-bottom:0;">
          <label>Nama di Nota Suplayer</label>
          <div style="display:flex; gap:6px;">
            <input v-model="form.namaDiNota" type="text" placeholder="Persis seperti di nota" style="flex:1; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
            <button @click="tambah" :disabled="menyimpan" class="btn-primary" style="white-space:nowrap; padding:0 16px;"><i class="fas fa-plus"></i></button>
          </div>
        </div>
      </div>
      <div v-if="memuat" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="daftarAlias.length === 0" style="font-size:11.5px; color:var(--text-faint);">Belum ada alias.</div>
      <div v-else style="overflow-x:auto;">
        <table class="gc-table" style="width:100%; font-size:12px;">
          <thead><tr><th>Suplayer</th><th>Nama di Nota</th><th>Item Internal</th><th></th></tr></thead>
          <tbody>
            <tr v-for="a in daftarAlias" :key="a.id">
              <td>{{ a.suplayer_nama }}</td><td><b>{{ a.nama_di_nota }}</b></td><td>{{ a.bahan_aksesoris_nama }}</td>
              <td><button v-if="bolehHapus" @click="hapus(a)" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <pengaturan-stock-pembelian v-if="tampilPengaturan" @tutup="tampilPengaturan = false" />
    </div>
  `
};

// ---------------------------------------------------------------------------
// OrderBelanjaScreen — dipakai BARENG oleh "List Order Belanja" (mode-nota
// false) dan "Nota Order Belanja" (mode-nota true). Props modeNota mengatur
// 2 beda: label Group 1, dan apakah Group 1 punya tombol (+) otomatis.
// ---------------------------------------------------------------------------
const OrderBelanjaScreen = {
  components: { DropdownCari, PengaturanStockPembelian },
  props: { modeNota: { type: Boolean, default: false } },
  setup(props) {
    const menuId = props.modeNota ? 'stock_nota_order_belanja' : 'stock_list_order_belanja';
    const daftarBahan = ref([]);
    const daftarSuplayer = ref([]);
    const daftarPermintaan = ref([]); // dari persiapan_masalah, status menunggu
    const daftarDraft = ref([]);
    const memuat = ref(true);
    const tampilPengaturan = ref(false);

    const draftDocId = ref(null);
    const noPembelianAktif = ref('');
    const tanggal = ref(new Date().toISOString().slice(0, 10));
    const suplayerEntry = ref('');
    const qtyEntry = ref('');
    const namaBarangEntry = ref('');
    const daftarPesanan = ref([]);
    const sumberPermintaanIds = ref([]);
    const menyimpan = ref(false);

    const bolehSimpan = computed(() => window.cekIzinMenu(menuId, 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu(menuId, 'delete') !== false);

    const opsiSuplayer = computed(() => daftarSuplayer.value.map(s => s.nama));
    const opsiNamaBarang = computed(() => daftarBahan.value.map(b => b.nama));
    const estimasiBiaya = computed(() => daftarPesanan.value.reduce((t, i) => t + (parseFloat(i.jumlah) || 0), 0));
    const adaTerpilih = computed(() => daftarPesanan.value.some(i => i.dicentang));

    const labelGroup1 = props.modeNota ? 'Daftar Pesanan Bahan & Aksesoris' : 'Daftar Permintaan Bahan & Aksesoris';

    async function muatSemua() {
      memuat.value = true;
      try {
        const [bahan, suplayer, snapPermintaan, snapDraft] = await Promise.all([
          ambilDaftarBahanAksesorisLengkap(),
          ambilDaftarSuplayer(),
          getDocs(query(collection(db, 'persiapan_masalah'), where('status', '==', 'menunggu'))),
          getDocs(query(collection(db, 'pesanan_pembelian'), where('status', '==', 'draft')))
        ]);
        daftarBahan.value = bahan;
        daftarSuplayer.value = suplayer;
        const listPermintaan = []; snapPermintaan.forEach(d => listPermintaan.push({ id: d.id, ...d.data() }));
        listPermintaan.sort((a, b) => (b.dibuat_pada?.seconds || 0) - (a.dibuat_pada?.seconds || 0));
        daftarPermintaan.value = listPermintaan;
        const listDraft = []; snapDraft.forEach(d => listDraft.push({ id: d.id, ...d.data() }));
        listDraft.sort((a, b) => (b.dibuat_pada?.seconds || 0) - (a.dibuat_pada?.seconds || 0));
        daftarDraft.value = listDraft;
      } catch (e) {
        console.error('Gagal muat Order Belanja:', e);
      }
      memuat.value = false;
    }

    function buatBarisPesanan(item, qty, keterangan) {
      const suplayer = daftarSuplayer.value.find(s => s.nama === suplayerEntry.value);
      const isiKonversi = parseFloat(item.isi_konversi_pembelian) || 1;
      const harga = parseFloat(item.harga_pembelian) || 0;
      return {
        dicentang: false,
        suplayer_id: suplayer ? suplayer.id : '', suplayer_nama: suplayerEntry.value,
        bahan_aksesoris_id: item.id, sku: item.id, nama: item.nama,
        qty: qty, satuan_bahan: item.satuan_pembelian || '',
        qty_s: Math.round((qty * isiKonversi) * 100) / 100, satuan: item.satuan_pemakaian || '',
        harga, jumlah: Math.round(qty * harga),
        keterangan: keterangan || ''
      };
    }

    function tambahItemManual() {
      if (!suplayerEntry.value) return alert('Pilih Suplayer dulu.');
      const item = daftarBahan.value.find(b => b.nama === namaBarangEntry.value);
      if (!item) return alert('Pilih Nama Barang dari daftar dulu (bukan teks bebas). Kalau nama di nota Suplayer beda, catat dulu di menu Alias Pembelian.');
      const qty = parseFloat(qtyEntry.value);
      if (!(qty > 0)) return alert('Isi Qty dengan angka lebih dari 0.');
      daftarPesanan.value.push(buatBarisPesanan(item, qty, ''));
      qtyEntry.value = ''; namaBarangEntry.value = ''; // Suplayer SENGAJA tidak direset (terkunci)
    }

    // Khusus Nota Order Belanja: klik (+) di baris Group 1 -> langsung masuk
    // tabel Daftar Pesanan Pembelian, request terkait ditandai sudah_dipesan.
    async function tambahDariPermintaan(p) {
      if (!suplayerEntry.value) return alert('Pilih Suplayer dulu (di panel "Daftar Order Belanja") sebelum menambah dari daftar ini.');
      const item = daftarBahan.value.find(b => b.id === p.bahan_aksesoris_id);
      if (!item) return alert('Data Bahan/Aksesoris sumber permintaan ini sudah tidak ditemukan (mungkin sudah dihapus).');
      daftarPesanan.value.push(buatBarisPesanan(item, p.qty, p.keterangan || ''));
      sumberPermintaanIds.value.push(p.id);
      try {
        await updateDoc(doc(db, 'persiapan_masalah', p.id), { status: 'sudah_dipesan' });
        daftarPermintaan.value = daftarPermintaan.value.filter(x => x.id !== p.id);
      } catch (e) {
        console.error('Gagal tandai Persiapan Masalah sudah dipesan:', e);
      }
    }

    function hapusTerpilih() {
      if (!adaTerpilih.value) return;
      if (!confirm('Hapus baris yang dicentang dari daftar (belum tersimpan permanen)?')) return;
      daftarPesanan.value = daftarPesanan.value.filter(i => !i.dicentang);
    }

    function formKosong() {
      draftDocId.value = null;
      noPembelianAktif.value = '';
      tanggal.value = new Date().toISOString().slice(0, 10);
      suplayerEntry.value = ''; qtyEntry.value = ''; namaBarangEntry.value = '';
      daftarPesanan.value = []; sumberPermintaanIds.value = [];
    }

    function pilihNoPembelian(idDraft) {
      if (!idDraft) { formKosong(); return; }
      const d = daftarDraft.value.find(x => x.id === idDraft);
      if (!d) return;
      draftDocId.value = d.id;
      noPembelianAktif.value = d.no_pembelian || '';
      tanggal.value = d.tanggal || new Date().toISOString().slice(0, 10);
      daftarPesanan.value = JSON.parse(JSON.stringify(d.items || [])).map(i => ({ ...i, dicentang: false }));
      sumberPermintaanIds.value = d.sumber_permintaan_ids || [];
    }

    function batal() {
      if (daftarPesanan.value.length > 0 && !confirm('Batalkan? Data yang belum disimpan (Simpan/Pending) akan hilang.')) return;
      formKosong();
    }

    async function simpan(statusBaru) {
      if (!bolehSimpan.value) return alert('Anda tidak punya izin menyimpan di sini. Hubungi Owner/PIC.');
      if (daftarPesanan.value.length === 0) return alert('Belum ada item di Daftar Pesanan Pembelian.');
      menyimpan.value = true;
      try {
        let noPembelian = noPembelianAktif.value;
        if (!noPembelian) noPembelian = await generateNoPembelian();
        const payload = {
          no_pembelian: noPembelian,
          tanggal: tanggal.value,
          items: daftarPesanan.value.map(({ dicentang, ...rest }) => rest),
          estimasi_biaya_belanja: estimasiBiaya.value,
          status: statusBaru, // 'draft' (tombol Pending) atau 'final' (tombol Simpan)
          sumber_permintaan_ids: sumberPermintaanIds.value,
          dibuat_oleh: window.currentUser?.email || null,
          diupdate_pada: serverTimestamp()
        };
        if (draftDocId.value) {
          await updateDoc(doc(db, 'pesanan_pembelian', draftDocId.value), payload);
        } else {
          payload.dibuat_pada = serverTimestamp();
          const refBaru = await addDoc(collection(db, 'pesanan_pembelian'), payload);
          draftDocId.value = refBaru.id;
        }
        noPembelianAktif.value = noPembelian;
        alert(statusBaru === 'final' ? `Pesanan Pembelian ${noPembelian} tersimpan (final).` : `Disimpan sebagai draft (${noPembelian}).`);
        if (statusBaru === 'final') formKosong();
        await muatSemua();
      } catch (e) {
        console.error('Gagal simpan Pesanan Pembelian:', e);
        alert(e.message && e.message.includes('Prefix') ? e.message : 'Gagal menyimpan. Coba lagi.');
      }
      menyimpan.value = false;
    }

    function cetak() {
      if (daftarPesanan.value.length === 0) return alert('Belum ada item untuk dicetak.');
      const w = window.open('', '_blank');
      if (!w) return alert('Popup diblokir browser. Izinkan popup untuk mencetak.');
      const baris = daftarPesanan.value.map((it, i) => `<tr>
        <td>${i + 1}</td><td>${it.suplayer_nama || '-'}</td><td>${it.sku || '-'}</td><td>${it.nama || '-'}</td>
        <td>${it.qty} ${it.satuan_bahan || ''}</td><td>${formatRupiah(it.harga)}</td><td>${formatRupiah(it.jumlah)}</td><td>${it.keterangan || ''}</td>
      </tr>`).join('');
      w.document.write(`<html><head><title>${noPembelianAktif.value || 'Order Belanja'}</title>
        <style>body{font-family:Arial,sans-serif;padding:24px;color:#222;} table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px;} th,td{border:1px solid #999;padding:6px 8px;text-align:left;} th{background:#f2f2f2;} h2{margin-bottom:2px;}</style>
        </head><body>
        <h2>Nota Order Belanja ${noPembelianAktif.value || '(belum tersimpan)'}</h2>
        <p>Tanggal: ${tanggal.value}</p>
        <table><thead><tr><th>No</th><th>Suplayer</th><th>SKU</th><th>Nama Barang</th><th>Qty</th><th>Harga</th><th>Jumlah</th><th>Keterangan</th></tr></thead><tbody>${baris}</tbody></table>
        <p style="margin-top:16px;"><b>Estimasi Total: ${formatRupiah(estimasiBiaya.value)}</b></p>
        <script>window.print();<\/script>
        </body></html>`);
      w.document.close();
    }

    onMounted(async () => { await window.authReady; muatSemua(); });
    return {
      daftarPermintaan, daftarDraft, memuat, tampilPengaturan, labelGroup1,
      draftDocId, noPembelianAktif, tanggal, suplayerEntry, qtyEntry, namaBarangEntry,
      daftarPesanan, menyimpan, bolehSimpan, bolehHapus, opsiSuplayer, opsiNamaBarang,
      estimasiBiaya, adaTerpilih, formatRupiah,
      tambahItemManual, tambahDariPermintaan, hapusTerpilih, pilihNoPembelian, batal, simpan, cetak
    };
  },
  template: `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
        <h3 style="font-weight:700; font-size:16px;"><i class="fas fa-cart-shopping" style="color:var(--burgundy); margin-right:8px;"></i>{{ modeNota ? 'Nota Order Belanja' : 'List Order Belanja' }}</h3>
        <button @click="tampilPengaturan = true" class="icon-btn" title="Pengaturan"><i class="fas fa-gear"></i></button>
      </div>

      <div v-if="memuat" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <template v-else>
        <!-- Group 1: Daftar Permintaan/Pesanan Bahan & Aksesoris (referensi dari Persiapan Masalah) -->
        <div class="gc-card" style="padding:14px; margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">{{ labelGroup1 }} ({{ daftarPermintaan.length }})</label>
          <div v-if="daftarPermintaan.length === 0" style="font-size:11.5px; color:var(--text-faint);">Tidak ada permintaan menunggu (lihat menu Persiapan Masalah).</div>
          <div v-else style="overflow-x:auto;">
            <table class="gc-table" style="width:100%; font-size:12px;">
              <thead><tr><th>Nama</th><th>Qty</th><th>Satuan</th><th>Keterangan</th><th v-if="modeNota"></th></tr></thead>
              <tbody>
                <tr v-for="p in daftarPermintaan" :key="p.id">
                  <td>{{ p.nama_bahan }}</td><td>{{ p.qty }}</td><td>{{ p.satuan }}</td><td style="color:var(--text-muted);">{{ p.keterangan || '-' }}</td>
                  <td v-if="modeNota"><button @click="tambahDariPermintaan(p)" class="icon-btn" style="color:var(--burgundy);" title="Tambah ke Daftar Order Belanja"><i class="fas fa-circle-plus"></i></button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Group 2: Daftar Order Belanja (entry + tabel Daftar Pesanan Pembelian) -->
        <div class="gc-card" style="padding:14px;">
          <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Daftar Order Belanja</label>

          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:14px;">
            <div class="gc-field" style="margin-bottom:0;">
              <label>No. Pembelian</label>
              <select :value="draftDocId" @change="pilihNoPembelian($event.target.value)" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
                <option value="">+ Buat Baru{{ noPembelianAktif && !draftDocId ? '' : '' }}</option>
                <option v-for="d in daftarDraft" :key="d.id" :value="d.id">{{ d.no_pembelian }} (draft)</option>
              </select>
              <p v-if="noPembelianAktif" style="font-size:10px; color:var(--text-faint); margin-top:4px;">Nomor aktif: <b>{{ noPembelianAktif }}</b></p>
            </div>
            <div class="gc-field" style="margin-bottom:0;"><label>Tanggal</label><input v-model="tanggal" type="date" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;"></div>
            <div class="gc-field" style="margin-bottom:0;">
              <label>Estimasi Biaya Belanja</label>
              <div style="padding:9px 12px; background:var(--ivory-dim); border-radius:10px; font-weight:700; color:var(--burgundy);">{{ formatRupiah(estimasiBiaya) }}</div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 100px 1fr auto; gap:8px; align-items:end; margin-bottom:16px;">
            <div class="gc-field" style="margin-bottom:0;"><label>Suplayer</label><dropdown-cari v-model="suplayerEntry" :opsi="opsiSuplayer" placeholder="Pilih Suplayer..." /></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Qty</label><input v-model.number="qtyEntry" type="number" min="0" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Nama Barang</label><dropdown-cari v-model="namaBarangEntry" :opsi="opsiNamaBarang" placeholder="Cari & pilih..." /></div>
            <button @click="tambahItemManual" class="btn-primary" style="padding:0 18px; height:38px;"><i class="fas fa-plus" style="margin-right:5px;"></i>Tambah</button>
          </div>

          <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Daftar Pesanan Pembelian ({{ daftarPesanan.length }})</label>
          <div v-if="daftarPesanan.length === 0" style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Belum ada item.</div>
          <div v-else style="overflow-x:auto; margin-bottom:14px;">
            <table class="gc-table" style="width:100%; font-size:11.5px;">
              <thead><tr>
                <th><i class="fas fa-square-check"></i></th><th>No</th><th>Suplayer</th><th>SKU</th><th>Nama Barang</th>
                <th>QTY</th><th>Satuan Bahan</th><th>QTY-s</th><th>Satuan</th><th>Harga</th><th>Jumlah</th><th>Keterangan</th>
              </tr></thead>
              <tbody>
                <tr v-for="(it, i) in daftarPesanan" :key="i">
                  <td><input type="checkbox" v-model="it.dicentang" style="accent-color:var(--burgundy);"></td>
                  <td>{{ i + 1 }}</td><td>{{ it.suplayer_nama }}</td><td>{{ it.sku }}</td><td>{{ it.nama }}</td>
                  <td>{{ it.qty }}</td><td>{{ it.satuan_bahan }}</td><td>{{ it.qty_s }}</td><td>{{ it.satuan }}</td>
                  <td>{{ formatRupiah(it.harga) }}</td><td>{{ formatRupiah(it.jumlah) }}</td>
                  <td><input v-model="it.keterangan" type="text" style="width:100%; padding:4px 6px; border:1px solid var(--line); border-radius:6px; font-size:11px;"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button @click="simpan('final')" :disabled="menyimpan" class="btn-primary" style="flex:1; min-width:110px;">{{ menyimpan ? 'Menyimpan...' : 'Simpan' }}</button>
            <button @click="batal" class="btn-outline" style="flex:1; min-width:90px;">Batal</button>
            <button v-if="bolehHapus" @click="hapusTerpilih" :disabled="!adaTerpilih" class="btn-outline" style="flex:1; min-width:90px; color:var(--danger); border-color:var(--danger);">Hapus Terpilih</button>
            <button @click="cetak" class="btn-outline" style="flex:1; min-width:90px;">Cetak</button>
            <button @click="simpan('draft')" :disabled="menyimpan" class="btn-outline" style="flex:1; min-width:90px;">Pending</button>
          </div>
        </div>
      </template>
      <pengaturan-stock-pembelian v-if="tampilPengaturan" @tutup="tampilPengaturan = false" />
    </div>
  `
};

// ---------------------------------------------------------------------------
// Mount functions — 1 per sub-menu (pola sama seperti file Zevanic House lain)
// ---------------------------------------------------------------------------
const AppAliasPembelian = { components: { AliasPembelianManager }, template: `<alias-pembelian-manager />` };
let vmAliasPembelian = null;
window.pastikanMountAliasPembelian = function() {
  if (vmAliasPembelian) return;
  const mountPoint = document.getElementById('vue-alias-pembelian');
  if (mountPoint) vmAliasPembelian = createApp(AppAliasPembelian).mount('#vue-alias-pembelian');
};

const AppListOrderBelanja = { components: { OrderBelanjaScreen }, template: `<order-belanja-screen :mode-nota="false" />` };
let vmListOrderBelanja = null;
window.pastikanMountListOrderBelanja = function() {
  if (vmListOrderBelanja) return;
  const mountPoint = document.getElementById('vue-list-order-belanja');
  if (mountPoint) vmListOrderBelanja = createApp(AppListOrderBelanja).mount('#vue-list-order-belanja');
};

const AppNotaOrderBelanja = { components: { OrderBelanjaScreen }, template: `<order-belanja-screen :mode-nota="true" />` };
let vmNotaOrderBelanja = null;
window.pastikanMountNotaOrderBelanja = function() {
  if (vmNotaOrderBelanja) return;
  const mountPoint = document.getElementById('vue-nota-order-belanja');
  if (mountPoint) vmNotaOrderBelanja = createApp(AppNotaOrderBelanja).mount('#vue-nota-order-belanja');
};
