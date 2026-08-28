// js/vue-persiapan-masalah.js
// ============================================================================
// Zevanic House > Persiapan Masalah — fitur BARU (24 Agt 2026), "versi
// sederhana" per keputusan Hilman (AskUserQuestion, jawaban #1 ronde "Stock
// & Pembelian" — lihat STATUS-PROYEK.md §21.1).
//
// Fungsinya: tempat siapa saja (level admin ke atas, sama seperti menu
// Zevanic House lain) mencatat "kebutuhan/masalah bahan-aksesoris yang
// kurang" — nama barang (WAJIB pilih dari Data Bahan & Aksesoris yang sudah
// ada, bukan teks bebas, supaya nyambung datanya ke Alias Pembelian & Order
// Belanja nanti), jumlah, satuan, keterangan. Daftar yang statusnya
// "menunggu" INILAH yang jadi sumber tabel "Daftar Permintaan/Pesanan Bahan
// & Aksesoris" di menu Stock & Pembelian > List/Nota Order Belanja
// (js/vue-stock-pembelian.js) — begitu suatu item benar-benar masuk ke
// sebuah Pesanan Pembelian lewat Nota Order Belanja, statusnya otomatis
// pindah jadi "sudah_dipesan" (ditandai di file itu, bukan di sini).
//
// VERSI SEDERHANA — belum ada: approval sebelum masuk daftar, prioritas/
// urgensi, upload foto masalah. Bisa ditambah nanti kalau Hilman minta.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, deleteDoc, getDocs, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DropdownCari } from './vue-components.js?v=2';

// ambilDaftarBahanAksesorisLengkap — combined Bahan+Aksesoris, dipakai di
// sini DAN di vue-stock-pembelian.js (disalin, bukan diimpor silang, supaya
// 2 file ini tetap bisa berdiri sendiri-sendiri kalau salah satu diedit).
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

const PersiapanMasalahManager = {
  components: { DropdownCari },
  setup() {
    const daftarBahan = ref([]);
    const opsiNama = computed(() => daftarBahan.value.map(b => b.nama));
    const daftarMenunggu = ref([]);
    const daftarSelesai = ref([]);
    const tampilSelesai = ref(false);
    const memuat = ref(true);
    const menyimpan = ref(false);

    const form = reactive({ nama: '', qty: '', satuan: '', keterangan: '' });

    const bolehTambah = computed(() => window.cekIzinMenu('persiapan_masalah', 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu('persiapan_masalah', 'delete') !== false);

    function itemTerpilih() {
      return daftarBahan.value.find(b => b.nama === form.nama) || null;
    }
    // Isi otomatis Satuan begitu Nama dipilih (dari satuan_pemakaian item),
    // tapi tetap boleh diubah manual kalau perlu.
    function saatPilihNama() {
      const item = itemTerpilih();
      if (item) form.satuan = item.satuan_pemakaian || item.satuan_pembelian || '';
    }

    async function muatSemua() {
      memuat.value = true;
      try {
        const [snapMenunggu, snapSelesai, bahan] = await Promise.all([
          getDocs(query(collection(db, 'persiapan_masalah'), where('status', '==', 'menunggu'))),
          getDocs(query(collection(db, 'persiapan_masalah'), where('status', '==', 'sudah_dipesan'))),
          ambilDaftarBahanAksesorisLengkap()
        ]);
        const listMenunggu = []; snapMenunggu.forEach(d => listMenunggu.push({ id: d.id, ...d.data() }));
        const listSelesai = []; snapSelesai.forEach(d => listSelesai.push({ id: d.id, ...d.data() }));
        // urut manual di klien (bukan orderBy Firestore) — supaya TIDAK perlu
        // index komposit tambahan (status + dibuat_pada), koleksi kecil.
        const bandingTanggal = (a, b) => (b.dibuat_pada?.seconds || 0) - (a.dibuat_pada?.seconds || 0);
        listMenunggu.sort(bandingTanggal);
        listSelesai.sort(bandingTanggal);
        daftarMenunggu.value = listMenunggu;
        daftarSelesai.value = listSelesai;
        daftarBahan.value = bahan;
      } catch (e) {
        console.error('Gagal muat Persiapan Masalah:', e);
      }
      memuat.value = false;
    }

    async function tambah() {
      if (!bolehTambah.value) return alert('Anda tidak punya izin menambah di sini. Hubungi Owner/PIC.');
      const item = itemTerpilih();
      if (!item) return alert('Pilih Nama Bahan/Aksesoris dari daftar dulu (bukan teks bebas). Kalau belum ada, tambahkan dulu di menu Data Bahan & Aksesoris.');
      const qty = parseFloat(form.qty);
      if (!(qty > 0)) return alert('Isi Qty dengan angka lebih dari 0.');
      if (!form.satuan.trim()) return alert('Isi Satuan dulu.');
      menyimpan.value = true;
      try {
        await addDoc(collection(db, 'persiapan_masalah'), {
          bahan_aksesoris_id: item.id,
          kategori_utama: item.kategori_utama || '',
          nama_bahan: item.nama,
          qty,
          satuan: form.satuan.trim(),
          keterangan: form.keterangan.trim(),
          status: 'menunggu',
          diminta_oleh: window.currentUser?.email || '-',
          dibuat_pada: serverTimestamp()
        });
        form.nama = ''; form.qty = ''; form.satuan = ''; form.keterangan = '';
        await muatSemua();
      } catch (e) {
        console.error('Gagal simpan Persiapan Masalah:', e);
        alert('Gagal menyimpan. Coba lagi.');
      }
      menyimpan.value = false;
    }

    async function hapus(item) {
      if (!bolehHapus.value) return alert('Anda tidak punya izin menghapus di sini. Hubungi Owner/PIC.');
      if (!confirm(`Hapus permintaan "${item.nama_bahan}" (${item.qty} ${item.satuan})?`)) return;
      try {
        await deleteDoc(doc(db, 'persiapan_masalah', item.id));
        await muatSemua();
      } catch (e) {
        console.error('Gagal hapus Persiapan Masalah:', e);
        alert('Gagal menghapus.');
      }
    }

    onMounted(async () => { await window.authReady; muatSemua(); });
    return { form, opsiNama, daftarMenunggu, daftarSelesai, tampilSelesai, memuat, menyimpan, bolehTambah, bolehHapus, saatPilihNama, tambah, hapus };
  },
  template: `
    <div class="gc-card" style="padding:16px; margin-bottom:16px;">
      <h3 style="font-weight:700; font-size:15px; margin-bottom:4px;"><i class="fas fa-triangle-exclamation" style="color:var(--burgundy); margin-right:8px;"></i>Persiapan Masalah</h3>
      <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Catat bahan/aksesoris yang dibutuhkan/kurang. Daftar "Menunggu" di bawah akan muncul otomatis sebagai referensi di menu Stock &amp; Pembelian &gt; List/Nota Order Belanja.</p>
      <div v-if="bolehTambah" class="grid-cols-1 md:grid-cols-3" style="display:grid; gap:8px; margin-bottom:8px;">
        <div class="gc-field" style="margin-bottom:0;">
          <label>Nama Bahan/Aksesoris</label>
          <dropdown-cari v-model="form.nama" :opsi="opsiNama" placeholder="Cari & pilih..." @update:modelValue="saatPilihNama" />
        </div>
        <div class="gc-field" style="margin-bottom:0;"><label>Qty</label><input v-model.number="form.qty" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:0;"><label>Satuan</label><input v-model="form.satuan" type="text"></div>
      </div>
      <div v-if="bolehTambah" style="display:flex; gap:8px; margin-bottom:14px;">
        <input v-model="form.keterangan" type="text" placeholder="Keterangan (opsional) — kenapa dibutuhkan" style="flex:1; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
        <button @click="tambah" :disabled="menyimpan" class="btn-primary" style="white-space:nowrap; padding:0 18px;">{{ menyimpan ? 'Menyimpan...' : 'Tambah' }}</button>
      </div>

      <div v-if="memuat" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <template v-else>
        <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">Menunggu ({{ daftarMenunggu.length }})</label>
        <div v-if="daftarMenunggu.length === 0" style="font-size:11.5px; color:var(--text-faint); margin-bottom:12px;">Tidak ada permintaan menunggu.</div>
        <!-- GANTI (28 Agt 2026) — dulu tabel scroll horizontal, SEKARANG kartu
             (pola sama seperti List Bahan/Aksesoris), di HP MAUPUN desktop. -->
        <div v-else style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
          <div v-for="d in daftarMenunggu" :key="d.id" class="gc-card" style="padding:12px 14px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
              <div style="font-weight:700; font-size:13px;">{{ d.nama_bahan }}</div>
              <button v-if="bolehHapus" @click="hapus(d)" class="icon-btn" style="color:var(--danger); flex-shrink:0;" title="Hapus"><i class="fas fa-trash-alt"></i></button>
            </div>
            <div class="kartu-rows" style="display:flex; flex-direction:column; gap:5px; background:var(--ivory-dim); border-radius:10px; padding:8px 10px;">
              <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Qty</span><span style="font-weight:700;">{{ d.qty }} {{ d.satuan }}</span></div>
              <div style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span style="color:var(--text-faint); flex-shrink:0;">Keterangan</span><span style="font-weight:700; text-align:right;">{{ d.keterangan || '-' }}</span></div>
              <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Diminta Oleh</span><span style="font-weight:700;">{{ d.diminta_oleh }}</span></div>
            </div>
          </div>
        </div>

        <button @click="tampilSelesai = !tampilSelesai" class="btn-outline" style="font-size:11.5px; padding:6px 14px;">
          {{ tampilSelesai ? 'Sembunyikan' : 'Lihat' }} Riwayat Sudah Dipesan ({{ daftarSelesai.length }})
        </button>
        <div v-if="tampilSelesai" style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
          <div v-for="d in daftarSelesai" :key="d.id" class="gc-card" style="padding:12px 14px;">
            <div style="font-weight:700; font-size:13px; margin-bottom:8px;">{{ d.nama_bahan }}</div>
            <div class="kartu-rows" style="display:flex; flex-direction:column; gap:5px; background:var(--ivory-dim); border-radius:10px; padding:8px 10px;">
              <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Qty</span><span style="font-weight:700;">{{ d.qty }} {{ d.satuan }}</span></div>
              <div style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span style="color:var(--text-faint); flex-shrink:0;">Keterangan</span><span style="font-weight:700; text-align:right;">{{ d.keterangan || '-' }}</span></div>
              <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Diminta Oleh</span><span style="font-weight:700;">{{ d.diminta_oleh }}</span></div>
            </div>
          </div>
        </div>
      </template>
    </div>
  `
};

const AppPersiapanMasalah = { components: { PersiapanMasalahManager }, template: `<persiapan-masalah-manager />` };
let vmPersiapanMasalah = null;
window.pastikanMountPersiapanMasalah = function() {
  if (vmPersiapanMasalah) return;
  const mountPoint = document.getElementById('vue-persiapan-masalah');
  if (mountPoint) vmPersiapanMasalah = createApp(AppPersiapanMasalah).mount('#vue-persiapan-masalah');
};
