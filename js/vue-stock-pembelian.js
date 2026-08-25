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
//
// UPDATE (25 Agt 2026, §25.2) — Qty per Roll/Lot. Arahan Hilman (persis):
// "1. untuk qty per lot bantu jalankan (fifo nanti saja) 2. pakai tombol
// pop up disimpan per baris dan kolomnya paling depan. tombol aktif jika
// dia memang menurut data wajib entry qty per lot". Diimplementasikan:
//   - Kolom BARU paling kiri di tabel "Daftar Pesanan Pembelian" (sebelum
//     kolom centang), isinya 1 tombol per baris (ikon layer-group).
//   - Tombol HANYA aktif kalau item baris itu ditandai `pakai_lot_tracking`
//     di Data Bahan & Aksesoris (field BARU, lihat vue-bahan-aksesoris.js)
//     — didenormalisasi ke tiap baris lewat buatBarisPesanan() di bawah.
//     Kalau tidak ditandai, sel tampil "-" (tidak bisa diklik).
//   - Klik tombol -> buka popup (PopupQtyPerLot, pola SAMA seperti
//     PopupKonversiBerjenjang di vue-bahan-aksesoris.js) — isi qty tiap
//     roll/lot satu-satu (SEBELUM Nota/List disimpan, sesuai arahan Guru
//     "ketika nota datang input langsung sebelum simpan"). Hasil disimpan
//     ke field BARU `detail_lot` (array {qty, keterangan}) di baris itu,
//     ikut tersimpan ke `pesanan_pembelian.items[].detail_lot` pas
//     Simpan/Pending — TIDAK ada dokumen lot terpisah dulu.
//   - FIFO / logic konsumsi per-lot (dipakai barang lama dulu baru baru)
//     SENGAJA BELUM dikerjakan ronde ini (arahan Guru: "fifo nanti saja").
//     Konsekuensi yang PERLU DIKETAHUI: begitu "Catat Pemakaian" manual di
//     Kartu Stok (js/vue-kartu-stok.js) dipakai, stok_akhir agregat
//     berkurang TAPI qty per-lot di sini TIDAK ikut berkurang — jadi
//     invarian "total lot = stok_akhir" cuma pasti benar TEPAT SETELAH
//     barang diterima, lalu bisa "meleset" begitu ada pemakaian, sampai
//     FIFO benar-benar dikerjakan. Ini keterbatasan SEMENTARA yang
//     disengaja, dicatat juga di STATUS-PROYEK.md §25.2.
//
// UPDATE (25 Agt 2026, §25.3) — FIFO dijalankan (arahan Guru: "stok saat
// dipakai bantu sync dlu langsung pangkas aja bisa? walau data rak belum
// ada?" — dikonfirmasi lewat AskUserQuestion: pakai form "Catat Pemakaian"
// yang SUDAH ADA di Kartu Stok, TIDAK menunggu modul SPK/produksi yang
// belum ada). Ditambahkan:
//   - Koleksi BARU `lot_bahan_aksesoris` — 1 dokumen = 1 roll/lot individual
//     (`qty_awal`, `qty_sisa`, `tanggal_masuk`, dst). Dibuat OTOMATIS begitu
//     Nota Order Belanja di-final-kan untuk item `pakai_lot_tracking` yang
//     `detail_lot`-nya sudah diisi (lihat `catatPergerakanKartuStok()` di
//     bawah, param baru `lotBaru`) — DALAM transaksi yang SAMA dengan
//     update `stok_akhir` & ledger `kartu_stok_bahan_aksesoris`, supaya
//     ketiganya SELALU konsisten sekaligus.
//   - Fungsi BARU `catatPemakaianDenganFifo()` (export, dipakai
//     `js/vue-kartu-stok.js` di form "Catat Pemakaian") — untuk item
//     `pakai_lot_tracking`, potong dari roll/lot TERLAMA dulu (urut
//     `tanggal_masuk` ASC), dalam 1 `runTransaction()` (baca semua lot dulu
//     lewat `tx.get()`, baru tulis — aturan wajib Firestore transaction).
//     Kalau BELUM ADA data lot sama sekali -> lempar error `LOT_KOSONG`
//     (BLOKIR, sesuai keputusan Guru — jangan proses pemakaian tanpa data
//     lot). Kalau total lot AKTIF < qty diminta -> lempar error `LOT_KURANG`
//     (bawa info `totalTersedia`) — TIDAK diblokir diam-diam, `vue-kartu-
//     stok.js` menangkap ini dan menampilkan popup 3 opsi keputusan (kurangi
//     jumlah / proses sebagian + sisanya masuk Persiapan Masalah / tunggu
//     dulu, sisanya tetap masuk Persiapan Masalah) — SEMUA lewat koleksi
//     `persiapan_masalah` yang SUDAH ADA apa adanya (TIDAK ada field/skema
//     baru di sana, cukup 1 entri normal seperti alur "butuh beli barang"
//     yang sudah berjalan).
// ============================================================================
import { createApp, ref, reactive, computed, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDoc, getDocs, setDoc, serverTimestamp, runTransaction, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DropdownCari, MasterDataTabelManager } from './vue-components.js';
import { usePaginasiFirestore } from './vue-paginasi.js';

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
// false) dan "Nota Order Belanja" (mode-nota true).
//
// DIPERTEGAS (malam 24 Agt 2026, revisi Guru) — 2 mode ini punya MAKNA
// BISNIS beda, bukan cuma beda label:
// - "List Order Belanja" (modeNota=false) — ESTIMASI belanja yang dibuat
//   SUPIR, lalu di-approve OWNER, SEBELUM belanja sungguhan terjadi. Harga
//   di sini CUMA ikut Data Bahan & Aksesoris apa adanya (read-only, lihat
//   kolom Harga di template) — TIDAK memicu Riwayat Harga Pembelian atau
//   auto-update harga master (lihat simpan()).
// - "Nota Order Belanja" (modeNota=true) — CATATAN PEMBELIAN NYATA
//   (harga aktual sesuai nota fisik), harga per baris BISA diedit admin,
//   DAN memicu catatRiwayatHargaDanUpdateMaster() begitu di-final-kan.
// ---------------------------------------------------------------------------

// BARU (malam 24 Agt 2026) — Kartu Stok Bahan/Aksesoris. Module-level
// (BUKAN di dalam setup() manapun) & di-export SUPAYA bisa dipakai BARENG
// oleh hook pembelian di catatRiwayatHargaDanUpdateMaster() (bawah, dalam
// file yang sama) MAUPUN form "Pemakaian Manual" di js/vue-kartu-stok.js
// (file terpisah) — 1 fungsi tunggal biar stok_akhir master & saldo_setelah
// di tiap baris kartu SELALU dihitung dari 1 jalur runTransaction() yang
// sama, tidak ada 2 cara beda yang bisa bikin angkanya meleset satu sama
// lain. `qty` WAJIB sudah dalam satuan_pemakaian (bukan satuan_pembelian)
// — stok SATU satuan konsisten walau tiap pembelian bisa beda satuan beli.
export async function catatPergerakanKartuStok({ bahanId, namaBahan, tanggal, jenis, qty, satuan, sumber, noPembelian, keterangan, lotBaru }) {
  const refBahan = doc(db, 'master_bahan_aksesoris', bahanId);
  await runTransaction(db, async (tx) => {
    const snapBahan = await tx.get(refBahan);
    const stokSebelum = snapBahan.exists() ? (parseFloat(snapBahan.data().stok_akhir) || 0) : 0;
    const stokSetelah = jenis === 'masuk' ? stokSebelum + qty : stokSebelum - qty;
    tx.set(refBahan, { stok_akhir: stokSetelah }, { merge: true });
    const refGerak = doc(collection(db, 'kartu_stok_bahan_aksesoris'));
    tx.set(refGerak, {
      bahan_aksesoris_id: bahanId, nama_bahan: namaBahan, tanggal, jenis, qty,
      satuan: satuan || '', sumber: sumber || '', no_pembelian: noPembelian || '',
      keterangan: keterangan || '', saldo_setelah: stokSetelah,
      dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
    });
    // BARU (25 Agt 2026, §25.3) — kalau ada data lot baru (masuk lewat Nota
    // untuk item `pakai_lot_tracking`), tulis 1 dokumen `lot_bahan_aksesoris`
    // per baris DALAM transaksi yang SAMA — supaya stok_akhir, ledger kartu
    // stok, dan data lot SELALU konsisten sekaligus (tidak ada celah antara
    // 1 tulis sukses & yang lain gagal).
    if (jenis === 'masuk' && Array.isArray(lotBaru) && lotBaru.length > 0) {
      lotBaru.forEach(l => {
        const qtyLot = parseFloat(l.qty) || 0;
        if (qtyLot <= 0) return;
        const refLot = doc(collection(db, 'lot_bahan_aksesoris'));
        tx.set(refLot, {
          bahan_aksesoris_id: bahanId, nama_bahan: namaBahan,
          qty_awal: qtyLot, qty_sisa: qtyLot, satuan: satuan || '',
          tanggal_masuk: tanggal, no_pembelian: noPembelian || '',
          keterangan: l.keterangan || '', status: 'aktif',
          dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
        });
      });
    }
  });
}

// catatPemakaianDenganFifo — BARU (25 Agt 2026, §25.3). Dipakai form "Catat
// Pemakaian" di js/vue-kartu-stok.js, HANYA untuk item `pakai_lot_tracking`.
// Potong dari roll/lot TERLAMA dulu (`tanggal_masuk` ASC). Query kandidat
// lot dilakukan DULU di luar transaksi (Firestore transaction TIDAK
// mendukung query, cuma tx.get() per-dokumen) — begitu masuk transaksi,
// SEMUA lot kandidat dibaca ULANG lewat tx.get() (data FRESH, jaga-jaga
// ada pemakaian lain nyelip di antara query awal & transaksi ini) sebelum
// ada tulisan apapun (aturan wajib Firestore: semua get() sebelum set/
// update dalam 1 transaction).
//
// 2 kondisi dilempar sebagai Error dengan `.kode` (BUKAN dikembalikan diam-
// diam) — supaya pemanggil (vue-kartu-stok.js) bisa tangani beda-beda:
//   - `LOT_KOSONG` — belum ada data lot SAMA SEKALI untuk item ini. BLOKIR
//     (keputusan Guru) — jangan proses pemakaian tanpa data lot.
//   - `LOT_KURANG` — total qty_sisa semua lot aktif < qty yang diminta.
//     TIDAK diblokir diam-diam, `err.totalTersedia` dibawa supaya pemanggil
//     bisa tawarkan 3 opsi keputusan (lihat vue-kartu-stok.js).
export async function catatPemakaianDenganFifo({ bahanId, namaBahan, tanggal, qty, satuan, keterangan }) {
  const snapLot = await getDocs(query(collection(db, 'lot_bahan_aksesoris'), where('bahan_aksesoris_id', '==', bahanId), where('status', '==', 'aktif')));
  const lots = []; snapLot.forEach(d => lots.push({ id: d.id, ...d.data() }));
  lots.sort((a, b) => (a.tanggal_masuk || '').localeCompare(b.tanggal_masuk || '') || ((a.dibuat_pada?.seconds || 0) - (b.dibuat_pada?.seconds || 0)));

  if (lots.length === 0) {
    const err = new Error('Belum ada data lot untuk item ini.');
    err.kode = 'LOT_KOSONG';
    throw err;
  }
  const totalTersedia = lots.reduce((t, l) => t + (parseFloat(l.qty_sisa) || 0), 0);
  if (totalTersedia < qty) {
    const err = new Error('Total qty lot aktif kurang dari yang diminta.');
    err.kode = 'LOT_KURANG';
    err.totalTersedia = totalTersedia;
    throw err;
  }

  // Rencana alokasi FIFO (dihitung dari data hasil query di atas) — jumlah
  // `ambil` per lot di-clamp ULANG pakai data FRESH di dalam transaksi
  // (lihat bawah), rencana ini cuma menentukan LOT MANA saja yang kepakai
  // & urutannya.
  let sisaDipotong = qty;
  const rencana = [];
  for (const l of lots) {
    if (sisaDipotong <= 0) break;
    const tersedia = parseFloat(l.qty_sisa) || 0;
    if (tersedia <= 0) continue;
    const ambil = Math.min(tersedia, sisaDipotong);
    rencana.push({ id: l.id, tanggal_masuk: l.tanggal_masuk, ambil });
    sisaDipotong -= ambil;
  }

  const refBahan = doc(db, 'master_bahan_aksesoris', bahanId);
  const rincianHasil = [];
  let stokSetelahFinal = 0;
  await runTransaction(db, async (tx) => {
    const snapBahan = await tx.get(refBahan);
    const lotRefs = rencana.map(r => doc(db, 'lot_bahan_aksesoris', r.id));
    const lotSnaps = [];
    for (const ref of lotRefs) lotSnaps.push(await tx.get(ref)); // WAJIB berurutan/di-await 1-1 dalam transaction (bukan Promise.all) — konsisten dengan cara tx.get() dipakai di tempat lain

    const stokSebelum = snapBahan.exists() ? (parseFloat(snapBahan.data().stok_akhir) || 0) : 0;
    const stokSetelah = stokSebelum - qty;
    tx.set(refBahan, { stok_akhir: stokSetelah }, { merge: true });

    let totalTerpotongUlang = 0;
    rencana.forEach((r, i) => {
      const lotSnap = lotSnaps[i];
      const sisaSekarang = lotSnap.exists() ? (parseFloat(lotSnap.data().qty_sisa) || 0) : 0;
      const ambilFix = Math.min(r.ambil, sisaSekarang);
      const sisaBaru = sisaSekarang - ambilFix;
      tx.update(lotRefs[i], { qty_sisa: sisaBaru, status: sisaBaru <= 0 ? 'habis' : 'aktif' });
      rincianHasil.push({ lot_id: r.id, tanggal_masuk: r.tanggal_masuk, dipotong: ambilFix, sisa_setelah: sisaBaru });
      totalTerpotongUlang += ambilFix;
    });
    // Jaga-jaga langka: kalau data berubah persis di antara query awal &
    // transaksi ini (mis. ada pemakaian lain nyelip) sampai totalnya jadi
    // tidak cukup lagi — batalkan transaksi ini dengan pesan jelas, JANGAN
    // diam-diam catat kurang dari qty yang diminta.
    if (Math.round((totalTerpotongUlang - qty) * 100) !== 0) {
      throw Object.assign(new Error('Data lot berubah saat diproses, coba Catat Pemakaian lagi.'), { kode: 'LOT_BERUBAH' });
    }

    const refGerak = doc(collection(db, 'kartu_stok_bahan_aksesoris'));
    tx.set(refGerak, {
      bahan_aksesoris_id: bahanId, nama_bahan: namaBahan, tanggal, jenis: 'keluar', qty,
      satuan: satuan || '', sumber: 'Pemakaian Manual (FIFO Lot)', no_pembelian: '',
      keterangan: keterangan || '', saldo_setelah: stokSetelah, rincian_lot: rincianHasil,
      dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
    });
    stokSetelahFinal = stokSetelah;
  });

  return { rincian: rincianHasil, stokSetelah: stokSetelahFinal };
}

// ---------------------------------------------------------------------------
// PopupQtyPerLot — BARU (25 Agt 2026, §25.2). Popup isi qty per roll/lot
// untuk 1 baris di "Daftar Pesanan Pembelian", pola SAMA seperti
// PopupKonversiBerjenjang di vue-bahan-aksesoris.js (state diedit di
// komponen induk OrderBelanjaScreen lewat props, emit 'tambah'/'hapus'/
// 'terapkan'/'tutup' — bukan disimpan ganda di sini).
// ---------------------------------------------------------------------------
const PopupQtyPerLot = {
  props: {
    baris: { type: Array, required: true },
    total: { type: Number, required: true },
    target: { type: Number, default: 0 },
    satuan: { type: String, default: '' },
    namaBarang: { type: String, default: '' }
  },
  emits: ['tambah', 'hapus', 'terapkan', 'tutup'],
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="$emit('tutup')">
      <div class="gc-card" style="max-width:520px; width:100%; max-height:90vh; overflow-y:auto;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:6px;"><i class="fas fa-layer-group" style="color:var(--burgundy); margin-right:8px;"></i>Qty per Roll/Lot — {{ namaBarang }}</h3>
        <p style="font-size:11px; color:var(--text-faint); margin-bottom:14px;">Isi qty tiap roll/kones satu per satu (qtynya bisa beda-beda tiap roll). Total dijumlah otomatis. Catatan: FIFO/pemakaian per-lot belum aktif — ronde ini baru mencatat qty per roll saat barang diterima.</p>
        <div style="display:grid; grid-template-columns:40px 1fr 1fr 30px; gap:6px; margin-bottom:4px;">
          <span style="font-size:10px; font-weight:700; color:var(--text-faint);">NO</span>
          <span style="font-size:10px; font-weight:700; color:var(--text-faint);">QTY ({{ satuan || 'satuan' }})</span>
          <span style="font-size:10px; font-weight:700; color:var(--text-faint);">KETERANGAN (opsional)</span>
          <span></span>
        </div>
        <div v-for="(b, i) in baris" :key="i" style="display:grid; grid-template-columns:40px 1fr 1fr 30px; gap:6px; align-items:center; margin-bottom:8px;">
          <span style="font-size:11.5px; color:var(--text-muted); text-align:center;">{{ i + 1 }}</span>
          <input v-model.number="b.qty" type="number" min="0" placeholder="0" style="width:100%; padding:7px 6px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
          <input v-model="b.keterangan" type="text" placeholder="Mis. no. roll" style="width:100%; padding:7px 6px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
          <button @click="$emit('hapus', i)" class="icon-btn" style="color:var(--danger);" title="Hapus baris"><i class="fas fa-trash-alt"></i></button>
        </div>
        <button @click="$emit('tambah')" class="btn-outline" style="font-size:11.5px; padding:6px 14px; margin-bottom:16px;"><i class="fas fa-plus" style="margin-right:5px;"></i>Tambah Roll/Lot</button>
        <div style="background:var(--ivory-dim); border-radius:10px; padding:10px 14px; margin-bottom:16px; font-size:12.5px;">
          <div style="display:flex; justify-content:space-between;">
            <span style="color:var(--text-muted);">Total {{ baris.length }} roll/lot:</span><b>{{ total }} {{ satuan }}</b>
          </div>
          <div v-if="target > 0" style="display:flex; justify-content:space-between; margin-top:4px; padding-top:4px; border-top:1px dashed var(--line);">
            <span style="color:var(--text-muted);">Qty di baris pesanan:</span>
            <b :style="{color: total === target ? 'var(--text-muted)' : 'var(--danger)'}">{{ target }} {{ satuan }}{{ total !== target ? ' (beda dengan total roll!)' : '' }}</b>
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

const OrderBelanjaScreen = {
  components: { DropdownCari, PengaturanStockPembelian, PopupQtyPerLot },
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

    // BARU (25 Agt 2026, §25.2) — Popup "Qty per Roll/Lot". indexBarisLot
    // menyimpan INDEX baris di daftarPesanan yang sedang diedit lewat
    // popup (bukan reference langsung, supaya gampang dibatalkan tanpa
    // menyentuh data asli sebelum "Terapkan" diklik).
    const tampilPopupLot = ref(false);
    const indexBarisLot = ref(-1);
    const barisLotSementara = ref([]);
    function bukaPopupLot(i) {
      const it = daftarPesanan.value[i];
      if (!it || !it.pakai_lot_tracking) return;
      indexBarisLot.value = i;
      barisLotSementara.value = (it.detail_lot && it.detail_lot.length > 0)
        ? JSON.parse(JSON.stringify(it.detail_lot))
        : [{ qty: '', keterangan: '' }];
      tampilPopupLot.value = true;
    }
    function tutupPopupLot() { tampilPopupLot.value = false; indexBarisLot.value = -1; }
    function tambahBarisLot() { barisLotSementara.value.push({ qty: '', keterangan: '' }); }
    function hapusBarisLot(i) {
      if (barisLotSementara.value.length <= 1) return;
      barisLotSementara.value.splice(i, 1);
    }
    const totalQtyLot = computed(() => barisLotSementara.value.reduce((t, b) => t + (parseFloat(b.qty) || 0), 0));
    const barisLotTarget = computed(() => (indexBarisLot.value >= 0 && daftarPesanan.value[indexBarisLot.value]) ? (parseFloat(daftarPesanan.value[indexBarisLot.value].qty_s) || 0) : 0);
    const barisLotSatuan = computed(() => (indexBarisLot.value >= 0 && daftarPesanan.value[indexBarisLot.value]) ? (daftarPesanan.value[indexBarisLot.value].satuan || '') : '');
    const barisLotNama = computed(() => (indexBarisLot.value >= 0 && daftarPesanan.value[indexBarisLot.value]) ? (daftarPesanan.value[indexBarisLot.value].nama || '') : '');
    function terapkanLot() {
      const tidakLengkap = barisLotSementara.value.some(b => !(parseFloat(b.qty) > 0));
      if (tidakLengkap) { alert('Isi Qty tiap roll/lot dulu (harus lebih dari 0). Hapus baris yang tidak dipakai.'); return; }
      if (indexBarisLot.value >= 0 && daftarPesanan.value[indexBarisLot.value]) {
        daftarPesanan.value[indexBarisLot.value].detail_lot = JSON.parse(JSON.stringify(barisLotSementara.value));
      }
      tampilPopupLot.value = false;
      indexBarisLot.value = -1;
    }

    const bolehSimpan = computed(() => window.cekIzinMenu(menuId, 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu(menuId, 'delete') !== false);

    const opsiSuplayer = computed(() => daftarSuplayer.value.map(s => s.nama));
    const opsiNamaBarang = computed(() => daftarBahan.value.map(b => b.nama));
    // BARU (malam 24 Agt 2026) — dihitung LIVE dari qty*harga (bukan baca
    // field `jumlah` statis lagi), supaya begitu admin edit Harga Aktual
    // di tabel, Estimasi Biaya Belanja di atas langsung ikut update.
    const estimasiBiaya = computed(() => daftarPesanan.value.reduce((t, i) => t + (parseFloat(i.qty) || 0) * (parseFloat(i.harga) || 0), 0));
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

    // BARU (malam 24 Agt 2026, fitur Riwayat Harga Pembelian) — field
    // `harga` di baris pesanan SEKARANG "Harga Aktual": diisi OTOMATIS
    // dari harga_pembelian master data sebagai DEFAULT/perkiraan, TAPI
    // admin BOLEH TIMPA sesuai angka SUNGGUHAN di nota (harga sering
    // naik-turun tiap beli). `isi_konversi` disimpan sebagai SNAPSHOT
    // (bukan dihitung ulang dari master data nanti) supaya Riwayat Harga
    // Pembelian tetap akurat meski konversi master data berubah di masa
    // depan. `jumlah` SENGAJA TIDAK disimpan di sini lagi — dihitung
    // ulang live tiap kali harga diedit (lihat estimasiBiaya computed &
    // template kolom Jumlah), baru di-final-kan pas simpan().
    function buatBarisPesanan(item, qty, keterangan) {
      const suplayer = daftarSuplayer.value.find(s => s.nama === suplayerEntry.value);
      const isiKonversi = parseFloat(item.isi_konversi_pembelian) || 1;
      return {
        dicentang: false,
        suplayer_id: suplayer ? suplayer.id : '', suplayer_nama: suplayerEntry.value,
        bahan_aksesoris_id: item.id, sku: item.id, nama: item.nama,
        qty: qty, satuan_bahan: item.satuan_pembelian || '',
        qty_s: Math.round((qty * isiKonversi) * 100) / 100, satuan: item.satuan_pemakaian || '',
        isi_konversi: isiKonversi,
        harga: parseFloat(item.harga_pembelian) || 0,
        keterangan: keterangan || '',
        // BARU (25 Agt 2026, §25.2) — denormalisasi flag dari Data Bahan &
        // Aksesoris (item.pakai_lot_tracking) supaya tombol popup "Qty per
        // Roll/Lot" di tabel tahu harus aktif/tidak TANPA perlu lookup
        // ulang tiap render. `detail_lot` mulai kosong, diisi lewat popup
        // (lihat bukaPopupLot/terapkanLot di bawah).
        pakai_lot_tracking: !!item.pakai_lot_tracking,
        detail_lot: []
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
      // BARU (25 Agt 2026, §25.2) — fallback pakai_lot_tracking/detail_lot
      // buat draft LAMA (dibuat sebelum field ini ada) supaya tetap aman
      // dibuka & tidak error di template.
      daftarPesanan.value = JSON.parse(JSON.stringify(d.items || [])).map(i => ({
        ...i, dicentang: false,
        pakai_lot_tracking: !!i.pakai_lot_tracking, detail_lot: i.detail_lot || []
      }));
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
        // `jumlah` di-final-kan di sini (qty*harga saat ini) — SEBELUMNYA
        // dihitung sekali waktu baris ditambah, SEKARANG dihitung ulang
        // pas simpan supaya ikut angka Harga Aktual terakhir yang diedit
        // admin (lihat catatan buatBarisPesanan()).
        const itemsFinal = daftarPesanan.value.map(({ dicentang, ...rest }) => ({
          ...rest, jumlah: Math.round((parseFloat(rest.qty) || 0) * (parseFloat(rest.harga) || 0))
        }));
        const payload = {
          no_pembelian: noPembelian,
          tanggal: tanggal.value,
          items: itemsFinal,
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
        // BARU (malam 24 Agt 2026) — begitu pesanan di-FINAL-kan (bukan
        // draft), catat tiap item jadi 1 baris Riwayat Harga Pembelian +
        // update otomatis Harga Pembelian di Data Bahan & Aksesoris
        // (aturan: tanggal terbaru, termahal per Satuan Pemakaian kalau
        // beda satuan — lihat catatRiwayatHargaDanUpdateMaster()).
        // SENGAJA di-try/catch TERPISAH — kalau ini gagal, pesanan_
        // pembelian yang SUDAH tersimpan sukses TIDAK boleh ikut dianggap
        // gagal ke Guru, cukup dicatat di Console buat ditelusuri nanti.
        //
        // DIPERBAIKI (malam 24 Agt 2026, revisi Guru) — SEBELUMNYA jalan
        // buat KEDUA mode (List & Nota), TERNYATA salah: "List Order
        // Belanja" itu ESTIMASI belanja dipakai supir + di-approve Owner
        // (harga di situ CUMA ikut apa adanya dari Data Bahan &
        // Aksesoris, lihat komentar props modeNota & template Harga di
        // bawah — read-only). Yang benar-benar jadi CATATAN PEMBELIAN
        // NYATA (harga aktual sesuai nota) cuma "Nota Order Belanja" —
        // makanya riwayat & auto-update harga SEKARANG cuma jalan kalau
        // props.modeNota true.
        if (statusBaru === 'final' && props.modeNota) {
          try {
            await catatRiwayatHargaDanUpdateMaster(itemsFinal, tanggal.value, noPembelian);
          } catch (e) {
            console.error('Pesanan tersimpan, TAPI gagal catat Riwayat Harga Pembelian:', e);
          }
        }
        alert(statusBaru === 'final' ? `Pesanan Pembelian ${noPembelian} tersimpan (final).` : `Disimpan sebagai draft (${noPembelian}).`);
        if (statusBaru === 'final') formKosong();
        await muatSemua();
      } catch (e) {
        console.error('Gagal simpan Pesanan Pembelian:', e);
        alert(e.message && e.message.includes('Prefix') ? e.message : 'Gagal menyimpan. Coba lagi.');
      }
      menyimpan.value = false;
    }

    // BARU (malam 24 Agt 2026) — Riwayat Harga Pembelian: 1 baris per item
    // yang benar-benar dibeli (Nota/List Order Belanja di-final-kan), lalu
    // otomatis cek ulang & update Harga Pembelian di Data Bahan & Aksesoris
    // supaya selalu ikut harga TERBARU (dan kalau ada beberapa harga di
    // tanggal yang sama, dipilih yang TERMAHAL — sengaja konservatif,
    // supaya modal/harga jual tidak ketinggalan pas harga bahan naik).
    async function catatRiwayatHargaDanUpdateMaster(items, tanggalPembelian, noPembelianRef) {
      for (const it of items) {
        if (!it.bahan_aksesoris_id || !(parseFloat(it.harga) > 0)) continue;
        const isiKonversi = parseFloat(it.isi_konversi) || 1;
        const hargaPerSatuanPemakaian = parseFloat(it.harga) / isiKonversi;
        try {
          await addDoc(collection(db, 'riwayat_harga_pembelian'), {
            bahan_aksesoris_id: it.bahan_aksesoris_id,
            nama_bahan: it.nama,
            tanggal: tanggalPembelian,
            satuan: it.satuan_bahan || '',
            harga: parseFloat(it.harga) || 0,
            isi_konversi: isiKonversi,
            satuan_pemakaian: it.satuan || '',
            harga_per_satuan_pemakaian: hargaPerSatuanPemakaian,
            no_pembelian: noPembelianRef,
            suplayer_nama: it.suplayer_nama || '',
            dibuat_pada: serverTimestamp(),
            dibuat_oleh: window.currentUser?.email || null
          });
          await perbaruiHargaMasterDariRiwayat(it.bahan_aksesoris_id);
        } catch (e) {
          console.error(`Gagal catat Riwayat Harga Pembelian / update master untuk "${it.nama}":`, e);
        }
        // BARU (malam 24 Agt 2026) — Kartu Stok: pembelian (Nota final)
        // JUGA dicatat sebagai 1 baris "masuk" di kartu_stok_bahan_
        // aksesoris, dalam satuan_pemakaian (qty_s, sudah dikonversi
        // waktu baris ditambah) — bukan satuan_bahan, biar stok SATU
        // satuan konsisten walau tiap pembelian bisa beda satuan beli.
        // Dibungkus try/catch TERPISAH LAGI dari riwayat harga di atas —
        // supaya kartu stok gagal tidak ikut menggagalkan riwayat harga
        // yang sudah berhasil (dan sebaliknya).
        try {
          const qtyMasuk = parseFloat(it.qty_s) || 0;
          if (qtyMasuk > 0) {
            await catatPergerakanKartuStok({
              bahanId: it.bahan_aksesoris_id, namaBahan: it.nama, tanggal: tanggalPembelian,
              jenis: 'masuk', qty: qtyMasuk, satuan: it.satuan || '',
              sumber: 'Nota Order Belanja', noPembelian: noPembelianRef, keterangan: '',
              // BARU (25 Agt 2026, §25.3) — kalau item ini pakai_lot_tracking
              // DAN sudah diisi lewat popup "Qty per Roll/Lot" (§25.2), ikut
              // buatkan dokumen lot_bahan_aksesoris (lihat catatan di
              // catatPergerakanKartuStok() di atas).
              lotBaru: (it.pakai_lot_tracking && Array.isArray(it.detail_lot) && it.detail_lot.length > 0) ? it.detail_lot : undefined
            });
          }
        } catch (e) {
          console.error(`Gagal catat Kartu Stok (masuk) untuk "${it.nama}":`, e);
        }
      }
    }

    // Ambil SEMUA riwayat item ini, cari tanggal PALING BARU, di antara
    // yang tanggalnya sama itu ambil yang harga-per-Satuan-Pemakaian-nya
    // PALING MAHAL (apple-to-apple meski satuan beli beda-beda tiap
    // pembelian) — lalu timpa harga_pembelian di master data (dikonversi
    // balik ke satuan pembelian item itu SEKARANG, supaya harga_modal
    // hasil bagi tetap konsisten dengan isi_konversi_pembelian yang ada).
    async function perbaruiHargaMasterDariRiwayat(bahanId) {
      const snap = await getDocs(query(collection(db, 'riwayat_harga_pembelian'), where('bahan_aksesoris_id', '==', bahanId)));
      const semua = []; snap.forEach(d => semua.push(d.data()));
      if (semua.length === 0) return;
      const tanggalTerbaru = semua.reduce((max, r) => (r.tanggal > max ? r.tanggal : max), semua[0].tanggal);
      const kandidat = semua.filter(r => r.tanggal === tanggalTerbaru);
      const termahal = kandidat.reduce((max, r) => (r.harga_per_satuan_pemakaian > max.harga_per_satuan_pemakaian ? r : max), kandidat[0]);

      const refBahan = doc(db, 'master_bahan_aksesoris', bahanId);
      const snapBahan = await getDoc(refBahan);
      if (!snapBahan.exists()) return;
      const bahan = snapBahan.data();
      const isiKonversiSaatIni = parseFloat(bahan.isi_konversi_pembelian) || 1;
      const hargaPembelianBaru = Math.round(termahal.harga_per_satuan_pemakaian * isiKonversiSaatIni);
      const hargaModalBaru = isiKonversiSaatIni > 0 ? hargaPembelianBaru / isiKonversiSaatIni : 0;
      const marginModal = parseFloat(bahan.margin_modal) || 0;
      await updateDoc(refBahan, {
        harga_pembelian: hargaPembelianBaru,
        harga_modal: hargaModalBaru,
        margin_modal: marginModal,
        harga_pemakaian: hargaModalBaru + marginModal,
        harga_diupdate_dari_riwayat_pada: serverTimestamp()
      });
    }

    function cetak() {
      if (daftarPesanan.value.length === 0) return alert('Belum ada item untuk dicetak.');
      const w = window.open('', '_blank');
      if (!w) return alert('Popup diblokir browser. Izinkan popup untuk mencetak.');
      const baris = daftarPesanan.value.map((it, i) => `<tr>
        <td>${i + 1}</td><td>${it.suplayer_nama || '-'}</td><td>${it.sku || '-'}</td><td>${it.nama || '-'}</td>
        <td>${it.qty} ${it.satuan_bahan || ''}</td><td>${formatRupiah(it.harga)}</td><td>${formatRupiah((parseFloat(it.qty) || 0) * (parseFloat(it.harga) || 0))}</td><td>${it.keterangan || ''}</td>
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
      tambahItemManual, tambahDariPermintaan, hapusTerpilih, pilihNoPembelian, batal, simpan, cetak,
      // BARU (25 Agt 2026, §25.2) — Popup Qty per Roll/Lot.
      tampilPopupLot, barisLotSementara, totalQtyLot, barisLotTarget, barisLotSatuan, barisLotNama,
      bukaPopupLot, tutupPopupLot, tambahBarisLot, hapusBarisLot, terapkanLot
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
                <th title="Qty per Roll/Lot"><i class="fas fa-layer-group"></i></th>
                <th><i class="fas fa-square-check"></i></th><th>No</th><th>Suplayer</th><th>SKU</th><th>Nama Barang</th>
                <th>QTY</th><th>Satuan Bahan</th><th>QTY-s</th><th>Satuan</th><th>Harga</th><th>Jumlah</th><th>Keterangan</th>
              </tr></thead>
              <tbody>
                <tr v-for="(it, i) in daftarPesanan" :key="i">
                  <td>
                    <button v-if="it.pakai_lot_tracking" @click="bukaPopupLot(i)" class="icon-btn"
                      :style="{color: (it.detail_lot && it.detail_lot.length) ? 'var(--burgundy)' : 'var(--text-faint)'}"
                      :title="(it.detail_lot && it.detail_lot.length) ? ('Qty per Roll/Lot: ' + it.detail_lot.length + ' lot terisi') : 'Isi Qty per Roll/Lot'">
                      <i class="fas fa-layer-group"></i>
                    </button>
                    <span v-else style="color:var(--text-faint); font-size:11px;" title="Item ini tidak ditandai perlu Qty per Roll/Lot (atur di Data Bahan & Aksesoris)">-</span>
                  </td>
                  <td><input type="checkbox" v-model="it.dicentang" style="accent-color:var(--burgundy);"></td>
                  <td>{{ i + 1 }}</td><td>{{ it.suplayer_nama }}</td><td>{{ it.sku }}</td><td>{{ it.nama }}</td>
                  <td>{{ it.qty }}</td><td>{{ it.satuan_bahan }}</td><td>{{ it.qty_s }}</td><td>{{ it.satuan }}</td>
                  <td>
                    <input v-if="modeNota" v-model.number="it.harga" type="number" min="0" style="width:90px; padding:4px 6px; border:1px solid var(--line); border-radius:6px; font-size:11px;">
                    <span v-else :title="'Ikut Data Bahan & Aksesoris — List Order Belanja cuma estimasi, harga tidak bisa diedit di sini'">{{ formatRupiah(it.harga) }}</span>
                  </td>
                  <td>{{ formatRupiah((parseFloat(it.qty)||0) * (parseFloat(it.harga)||0)) }}</td>
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
      <popup-qty-per-lot v-if="tampilPopupLot" :baris="barisLotSementara" :total="totalQtyLot" :target="barisLotTarget" :satuan="barisLotSatuan" :nama-barang="barisLotNama"
        @tambah="tambahBarisLot" @hapus="hapusBarisLot" @terapkan="terapkanLot" @tutup="tutupPopupLot" />
    </div>
  `
};

// ---------------------------------------------------------------------------
// RiwayatHargaPembelianManager — menu "Riwayat Harga Pembelian" (BARU, malam
// 24 Agt 2026). Tabel READ-ONLY, cursor-based paginasi (WAJIB sesuai
// PRINSIP-HEMAT.md), diisi otomatis oleh catatRiwayatHargaDanUpdateMaster()
// tiap kali Nota/List Order Belanja di-final-kan. Cari berdasarkan nama
// bahan (awalan), urut tanggal terbaru dulu.
// ---------------------------------------------------------------------------
const RiwayatHargaPembelianManager = {
  setup() {
    const paginasi = usePaginasiFirestore(db, 'riwayat_harga_pembelian', {
      perHalaman: 15,
      urutkanField: 'tanggal',
      urutkanArah: 'desc',
      cariField: 'nama_bahan',
      petakan: (id, d) => ({ id, ...d })
    });
    onMounted(async () => { await window.authReady; await paginasi.muatUlang(); });
    return { paginasi, formatRupiah };
  },
  template: `
    <div class="gc-card" style="padding:14px;">
      <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Riwayat Harga Pembelian</label>
      <p style="font-size:11px; color:var(--text-faint); margin-bottom:12px;">Tercatat otomatis tiap kali Nota / List Order Belanja di-final-kan. Harga Pembelian di Data Bahan &amp; Aksesoris otomatis mengikuti baris dengan tanggal PALING BARU (kalau ada beberapa di tanggal sama, yang PALING MAHAL per Satuan Pemakaian).</p>

      <div style="position:relative; max-width:320px; margin-bottom:12px;">
        <i class="fas fa-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-faint); font-size:12px;"></i>
        <input :value="paginasi.cariTeks.value" @input="paginasi.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari nama bahan (awalan)..." style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
      </div>

      <div v-if="paginasi.memuat.value" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="paginasi.errorPaginasi.value" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasi.errorPaginasi.value }}</div>
      <div v-else-if="paginasi.dataHalaman.value.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada riwayat pembelian.</div>
      <div v-else style="overflow-x:auto;">
        <table class="gc-table" style="width:100%; font-size:11.5px;">
          <thead><tr>
            <th>Tanggal</th><th>Nama Bahan</th><th>Suplayer</th><th>Satuan Beli</th><th>Harga</th><th>Isi Konversi</th><th>Satuan Pemakaian</th><th>Harga / Satuan Pemakaian</th><th>No. Pembelian</th>
          </tr></thead>
          <tbody>
            <tr v-for="r in paginasi.dataHalaman.value" :key="r.id">
              <td>{{ r.tanggal }}</td><td>{{ r.nama_bahan }}</td><td>{{ r.suplayer_nama || '-' }}</td>
              <td>{{ r.satuan }}</td><td>{{ formatRupiah(r.harga) }}</td><td>{{ r.isi_konversi }}</td>
              <td>{{ r.satuan_pemakaian }}</td><td style="color:var(--burgundy); font-weight:700;">{{ formatRupiah(r.harga_per_satuan_pemakaian) }}</td>
              <td>{{ r.no_pembelian || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!paginasi.memuat.value && paginasi.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
        <button class="icon-btn" :disabled="paginasi.nomorHalaman.value <= 1" @click="paginasi.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
        <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasi.nomorHalaman.value }}</span>
        <button class="icon-btn" :disabled="!paginasi.adaBerikutnya.value" @click="paginasi.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
      </div>
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

const AppRiwayatHargaPembelian = { components: { RiwayatHargaPembelianManager }, template: `<riwayat-harga-pembelian-manager />` };
let vmRiwayatHargaPembelian = null;
window.pastikanMountRiwayatHargaPembelian = function() {
  if (vmRiwayatHargaPembelian) return;
  const mountPoint = document.getElementById('vue-riwayat-harga-pembelian');
  if (mountPoint) vmRiwayatHargaPembelian = createApp(AppRiwayatHargaPembelian).mount('#vue-riwayat-harga-pembelian');
};
