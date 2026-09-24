// js/vue-cetak-bagging.js
// Layar "Cetak Bagging" (Scan & Cetak): cetak ULANG label Kode Bagging yang ada,
// dan buat kode baru untuk kelompok sepack yang stok labelnya habis.
// Mount ke #vue-cetak-bagging.
//
// Koleksi & field:
// - bagging: kode, produk_label (pola · bahan · size), isi[], ditutup_pada,
//   kode_grouping_induk, dibuat_pada/oleh. Hanya ditutup_pada == null tampil.
// - cetak_ulang_log: kode_grouping_induk, bahan, alasan, pin_oleh, pada.
// - pengaturan_id_bagging: counter harian (generateKodeHarian).
//
// Jebakan:
// - produk_label WAJIB terisi: Scan Pack menolak kode yang produk_label-nya
//   tidak sama persis dengan pola · bahan · size baris yang discan.
// - Pilihan produk_label diambil dari bagging yang SUDAH ada; kelompok sepack
//   baru harus dicetak dari jalurnya sendiri dulu.
// - Cetak dan cetak ulang digerbang role (pic/pic_owner/owner) DAN PIN.
// - Hapus hanya untuk bagging yang isi[]-nya kosong, PIN Owner.

import { createApp, ref, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, query, where, orderBy, limit, getDocs, addDoc, doc, runTransaction, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel, HeaderLayar, KolomCari } from './vue-components.js?v=13';
import { PopupPinGenerik, buatQrDataUrl } from './vue-scan-cetak.js?v=12';

const BATAS_TAMPIL = 30;
const MAKS_BUAT_SEKALIGUS = 10;
const ROLE_BOLEH_CETAK = ['owner', 'superuser', 'pic_owner', 'pic'];

// Penomoran WAJIB lewat transaksi: dua orang menekan Buat di detik yang sama
// tetap dapat nomor beda. Counter di-key per tanggal, jadi reset sendiri.
async function generateKodeHarian(prefix, koleksiCounter) {
  const now = new Date();
  const tanggalKey = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const refDoc = doc(db, koleksiCounter, tanggalKey);
  return await runTransaction(db, async (trx) => {
    const snap = await trx.get(refDoc);
    const counterBaru = (snap.exists() ? (snap.data().counter || 0) : 0) + 1;
    if (snap.exists()) trx.update(refDoc, { counter: counterBaru });
    else trx.set(refDoc, { counter: counterBaru, dibuat_pada: tanggalKey });
    return `${prefix}${tanggalKey}-${String(counterBaru).padStart(3, '0')}`;
  });
}

const AppCetakBagging = {
  components: { PopupPratinjauCetakLabel, PopupPinGenerik, HeaderLayar, KolomCari },
  setup() {
    const memuat = ref(true);
    const errorMuat = ref('');
    const daftar = ref([]);
    const cari = ref('');
    const dipilih = ref([]);
    const sedangProses = ref(false);

    const bolehCetak = computed(() => ROLE_BOLEH_CETAK.includes((window.currentUser?.role || '').toLowerCase()));

    async function muat() {
      memuat.value = true;
      errorMuat.value = '';
      try {
        const q = query(
          collection(db, 'bagging'),
          where('ditutup_pada', '==', null),
          orderBy('dibuat_pada', 'desc'),
          limit(BATAS_TAMPIL)
        );
        const snap = await getDocs(q);
        daftar.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        dipilih.value = [];
      } catch (e) {
        console.error('Gagal memuat daftar bagging:', e);
        errorMuat.value = e && e.code === 'failed-precondition'
          ? 'Perlu index Firestore baru — buka Console browser (F12), klik link "Create composite index" dari error di sana, lalu muat ulang layar ini.'
          : 'Gagal memuat daftar bagging. Cek Console untuk detail.';
      }
      memuat.value = false;
    }

    // Cari client-side: daftarnya cuma 30 baris, tidak perlu query balik ke
    // server tiap ketukan huruf.
    const tersaring = computed(() => {
      const kata = cari.value.trim().toLowerCase();
      if (!kata) return daftar.value;
      return daftar.value.filter(b =>
        (b.kode || '').toLowerCase().includes(kata) ||
        (b.produk_label || '').toLowerCase().includes(kata) ||
        (b.kode_grouping_induk || '').toLowerCase().includes(kata)
      );
    });
    const jumlahKosong = computed(() => daftar.value.filter(b => !(b.isi || []).length).length);

    function toggle(kode) {
      const i = dipilih.value.indexOf(kode);
      if (i >= 0) dipilih.value.splice(i, 1); else dipilih.value.push(kode);
    }
    function terpilih(kode) { return dipilih.value.includes(kode); }
    function ringkasIsi(b) {
      const n = (b.isi || []).length;
      const grouping = b.kode_grouping_induk ? `Kode Grouping ${b.kode_grouping_induk}` : 'belum diisi';
      return `${grouping} · ${n} isi`;
    }
    const rincianTerbuka = ref({});
    function toggleRincian(kode) { rincianTerbuka.value[kode] = !rincianTerbuka.value[kode]; }

    // ---- Cetak ulang: alasan wajib -> PIN -> log -> pratinjau cetak
    const popupAlasan = ref(null); // { alasan }
    const pinAktif = ref(false);
    const popupCetak = ref(false);
    const labelPreview = ref([]);

    function bukaCetakUlang() {
      if (!bolehCetak.value) { alert('Role Anda tidak berwenang mencetak label bagging.'); return; }
      if (!dipilih.value.length) return;
      popupAlasan.value = { alasan: '' };
    }
    function lanjutKePin() {
      if (!popupAlasan.value.alasan.trim()) { alert('Alasan cetak ulang wajib diisi.'); return; }
      pinAktif.value = true;
    }
    async function pinSukses(user) {
      pinAktif.value = false;
      const alasan = popupAlasan.value ? popupAlasan.value.alasan.trim() : '';
      const terpilihObj = daftar.value.filter(b => dipilih.value.includes(b.kode));
      try {
        await addDoc(collection(db, 'cetak_ulang_log'), {
          kode_grouping_induk: terpilihObj.map(b => b.kode_grouping_induk || '-').join(', '),
          bahan: terpilihObj.map(b => b.kode).join(', '),
          alasan, pin_oleh: user.nama || user.email || '',
          pada: serverTimestamp()
        });
      } catch (e) { console.error('Gagal catat cetak ulang:', e); }
      labelPreview.value = terpilihObj.map(b => ({
        kode: b.kode, nama: b.produk_label || '(tanpa label)',
        info: `Kode Bagging &middot; ${(b.isi || []).length} isi`,
        qrDataUrl: buatQrDataUrl(b.kode)
      }));
      popupAlasan.value = null;
      popupCetak.value = true;
    }

    // ---- Buat baru: pilih produk_label yang sudah ada + jumlah
    const popupBaru = ref(null); // { label, jumlah }
    const daftarLabel = computed(() => {
      const set = [];
      daftar.value.forEach(b => { if (b.produk_label && !set.includes(b.produk_label)) set.push(b.produk_label); });
      return set.sort();
    });
    function bukaBuatBaru() {
      if (!bolehCetak.value) { alert('Role Anda tidak berwenang membuat kode bagging.'); return; }
      if (!daftarLabel.value.length) {
        alert('Belum ada kelompok sepack yang bisa dipakai. Cetak bagging pertama untuk kelompok itu dari Persiapan Produksi dulu — layar ini hanya menambah kode untuk kelompok yang sudah ada.');
        return;
      }
      popupBaru.value = { label: daftarLabel.value[0], jumlah: 2 };
    }
    function ubahJumlah(delta) {
      const p = popupBaru.value;
      if (!p) return;
      p.jumlah = Math.min(MAKS_BUAT_SEKALIGUS, Math.max(1, (parseInt(p.jumlah) || 1) + delta));
    }
    async function konfirmasiBuatBaru() {
      const p = popupBaru.value;
      if (!p || !p.label) return;
      sedangProses.value = true;
      try {
        const preview = [];
        for (let i = 0; i < p.jumlah; i++) {
          const kode = await generateKodeHarian('BAG', 'pengaturan_id_bagging');
          // kode_grouping_induk sengaja null: terkunci sendiri pada Scan Pack pertama.
          await addDoc(collection(db, 'bagging'), {
            kode, produk_label: p.label, isi: [], ditutup_pada: null,
            kode_grouping_induk: null, kode_separating: null,
            dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
          });
          preview.push({ kode, nama: p.label, info: 'Kode Bagging &middot; belum diisi', qrDataUrl: buatQrDataUrl(kode) });
        }
        labelPreview.value = preview;
        popupBaru.value = null;
        popupCetak.value = true;
        await muat();
      } catch (e) {
        console.error('Gagal buat kode bagging:', e);
        alert('Gagal membuat kode bagging. Coba lagi.');
      }
      sedangProses.value = false;
    }

    // ---- Hapus bagging kosong (isi belum ada): PIN Owner, dicatat ke
    // cetak_ulang_log. Bagging yang sudah berisi tidak pernah ikut terhapus.
    const pinHapusAktif = ref(false);
    function bukaHapusKosong() {
      if (!jumlahKosong.value) return;
      if (!confirm(`Hapus ${jumlahKosong.value} bagging kosong? Labelnya yang sudah tercetak tidak bisa dipakai lagi.`)) return;
      pinHapusAktif.value = true;
    }
    async function pinHapusSukses(user) {
      pinHapusAktif.value = false;
      const kosong = daftar.value.filter(b => !(b.isi || []).length);
      sedangProses.value = true;
      try {
        const batch = writeBatch(db);
        kosong.forEach(b => batch.delete(doc(db, 'bagging', b.id)));
        batch.set(doc(collection(db, 'cetak_ulang_log')), {
          kode_grouping_induk: '-', bahan: kosong.map(b => b.kode).join(', '),
          alasan: 'Hapus bagging kosong', pin_oleh: user.nama || user.email || '', pada: serverTimestamp()
        });
        await batch.commit();
        await muat();
      } catch (e) { console.error('Gagal hapus bagging kosong:', e); alert('Gagal menghapus. Coba lagi.'); }
      sedangProses.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });

    return {
      memuat, errorMuat, daftar, cari, dipilih, sedangProses, bolehCetak,
      tersaring, jumlahKosong, toggle, terpilih, ringkasIsi,
      rincianTerbuka, toggleRincian, muat,
      popupAlasan, pinAktif, popupCetak, labelPreview,
      bukaCetakUlang, lanjutKePin, pinSukses,
      popupBaru, daftarLabel, bukaBuatBaru, ubahJumlah, konfirmasiBuatBaru,
      pinHapusAktif, bukaHapusKosong, pinHapusSukses
    };
  },
  template: `
  <div>
    <header-layar kicker="SCAN & CETAK" judul="Cetak Bagging" menu-id="scan_cetak_bagging" tab-pulang="tab-scan-cetak" />

    <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
      <div style="flex:1; min-width:0;"><kolom-cari v-model="cari" placeholder="Cari kode / Kode Grouping / produk..." /></div>
      <button @click="bukaBuatBaru" :disabled="!bolehCetak" class="btn-primary" style="padding:9px 14px; white-space:nowrap;"><i class="fas fa-plus" style="margin-right:6px;"></i>Buat Baru</button>
    </div>

    <div v-if="!bolehCetak" class="gc-card" style="padding:10px 12px; margin-bottom:10px; background:var(--warn-light); font-size:11px; color:var(--warn-text);">
      Role Anda bisa melihat daftar ini, tapi tidak bisa mencetak. Cetak label bagging dibatasi ke PIC, PIC Owner, dan Owner.
    </div>

    <div style="display:flex; align-items:center; gap:8px; font-size:10.5px; color:var(--text-muted); margin-bottom:10px;">
      <i class="fas fa-circle-info"></i>
      <span>30 terbaru yang belum ditutup. Ukuran kertas ikut Pengaturan Cetak.</span>
    </div>

    <div v-if="jumlahKosong > 0" class="gc-card" style="padding:10px 12px; margin-bottom:10px; background:var(--ok-light); font-size:11px; color:var(--text);">
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <span style="flex:1; min-width:180px;">Masih ada <b>{{ jumlahKosong }}</b> bagging kosong yang belum terpakai — pakai itu dulu sebelum mencetak baru.</span>
        <button @click="bukaHapusKosong" :disabled="sedangProses" class="btn-outline" style="padding:6px 10px; font-size:11px; color:var(--danger);"><i class="fas fa-trash-can" style="margin-right:4px;"></i>Hapus Bagging Kosong</button>
      </div>
    </div>

    <div v-if="memuat" style="text-align:center; padding:30px 0; color:var(--text-faint); font-size:11px;">Memuat...</div>
    <div v-else-if="errorMuat" class="gc-card" style="padding:12px; font-size:11.5px; color:var(--danger);">{{ errorMuat }}</div>

    <div v-else-if="tersaring.length === 0" class="gc-kosong">
      <div class="lingkaran"><i class="fas fa-box-open"></i></div>
      <h3 class="gc-heading" style="font-size:12.5px; font-weight:700; margin:0;">Tidak ada bagging terbuka</h3>
      <p style="font-size:11px; color:var(--text-muted); margin-top:4px;">Semua sudah ditutup, atau kata cari tidak cocok.</p>
    </div>

    <div v-else style="display:flex; flex-direction:column; gap:7px;">
      <div v-for="b in tersaring" :key="b.kode" class="gc-card" style="padding:11px 12px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <input type="checkbox" :checked="terpilih(b.kode)" @change="toggle(b.kode)" :disabled="!bolehCetak" style="width:18px; height:18px; accent-color:var(--burgundy); flex-shrink:0;">
          <div style="flex:1; min-width:0; cursor:pointer;" @click="toggleRincian(b.kode)">
            <div class="gc-heading gc-num" style="font-size:12.5px; font-weight:700;">{{ b.kode }}</div>
            <div style="font-size:11px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ b.produk_label || '(tanpa label)' }}</div>
            <div style="font-size:10px; color:var(--text-faint); margin-top:2px;">{{ ringkasIsi(b) }}</div>
          </div>
          <span v-if="!(b.isi || []).length" class="tag neutral">belum diisi</span>
          <span v-else class="tag ok">{{ (b.isi || []).length }} isi</span>
        </div>
        <div v-if="rincianTerbuka[b.kode] && (b.isi || []).length" style="margin-top:8px; padding-top:8px; border-top:1px solid var(--line); display:flex; flex-wrap:wrap; gap:5px;">
          <span v-for="x in b.isi" :key="x" class="gc-num" style="font-size:10px; background:var(--ivory-dim); padding:3px 8px; border-radius:999px; color:var(--text-muted);">{{ x }}</span>
        </div>
      </div>
    </div>

    <div v-if="dipilih.length" style="position:sticky; bottom:0; margin-top:12px; padding:11px 12px; background:var(--surface); border-top:1.5px solid var(--line); display:flex; align-items:center; gap:9px;">
      <span style="flex:1; font-size:11px; color:var(--text-muted);">{{ dipilih.length }} dipilih</span>
      <button @click="dipilih = []" class="btn-outline" style="padding:9px 14px;">Batal</button>
      <button @click="bukaCetakUlang" class="btn-primary" style="padding:9px 16px;">Cetak Ulang ({{ dipilih.length }})</button>
    </div>

    <!-- Alasan wajib sebelum PIN: itu yang membedakan cetak ulang wajar dari pemborosan. -->
    <div v-if="popupAlasan" class="gc-dialog-backdrop" @click="popupAlasan = null">
      <div class="gc-dialog" @click.stop style="text-align:left;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 4px;"><i class="fas fa-rotate" style="margin-right:8px; color:var(--warn);"></i>Cetak Ulang Label</h3>
        <p style="font-size:11px; color:var(--text-muted); margin:0 0 12px;">{{ dipilih.length }} kode &middot; dicatat di riwayat cetak ulang.</p>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupAlasan.alasan" type="text" placeholder="Mis. label rusak / hilang"></div>
        <div style="display:flex; gap:8px;">
          <button @click="popupAlasan = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="lanjutKePin" class="btn-primary" style="flex:1; padding:9px;">Lanjut Verifikasi PIN</button>
        </div>
      </div>
    </div>

    <div v-if="popupBaru" class="gc-dialog-backdrop" @click="popupBaru = null">
      <div class="gc-dialog" @click.stop style="text-align:left;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 4px;">Buat Kode Bagging Baru</h3>
        <p style="font-size:11px; color:var(--text-muted); margin:0 0 12px;">Kode lahir kosong; isinya menyusul saat Scan Pack. Kelompok sepack wajib dipilih — tanpa itu kodenya tidak bisa discan.</p>
        <div class="gc-field" style="margin-bottom:12px;">
          <label>Kelompok sepack (pola &middot; bahan &middot; size)</label>
          <select v-model="popupBaru.label"><option v-for="l in daftarLabel" :key="l" :value="l">{{ l }}</option></select>
        </div>
        <div class="gc-field" style="margin-bottom:6px;"><label>Jumlah kode</label></div>
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
          <button @click="ubahJumlah(-1)" class="btn-outline" style="width:42px; padding:9px;">&minus;</button>
          <div class="gc-heading gc-num" style="flex:1; text-align:center; font-size:18px; font-weight:700;">{{ popupBaru.jumlah }}</div>
          <button @click="ubahJumlah(1)" class="btn-outline" style="width:42px; padding:9px;">+</button>
        </div>
        <p style="font-size:10px; color:var(--warn-text); margin:0 0 12px;">Kode langsung dibuat begitu ditekan. Yang masih kosong bisa dihapus dengan PIN Owner.</p>
        <div style="display:flex; gap:8px;">
          <button @click="popupBaru = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiBuatBaru" :disabled="sedangProses" class="btn-primary" style="flex:1; padding:9px;">{{ sedangProses ? 'Membuat...' : 'Buat & Cetak' }}</button>
        </div>
      </div>
    </div>

    <popup-pin-generik v-if="pinAktif" judul="Verifikasi PIN — Cetak Ulang Bagging" konteks="Cetak Bagging - Cetak Ulang" :roles-diizinkan="['owner','superuser','pic_owner','pic']" @sukses="pinSukses" @batal="pinAktif = false" />

    <popup-pin-generik v-if="pinHapusAktif" judul="PIN Owner — Hapus Bagging Kosong" konteks="Cetak Bagging - Hapus Kosong" :roles-diizinkan="['owner','superuser','pic_owner']" @sukses="pinHapusSukses" @batal="pinHapusAktif = false" />

    <popup-pratinjau-cetak-label :terbuka="popupCetak" judul="Cetak Kode Bagging" :daftar-label="labelPreview" jenis-cetak="kode_bagging" @tutup="popupCetak = false" />
  </div>
  `
};

// Ekspos muat() seperti layar lain: tab yang sudah ter-mount tidak memuat
// ulang sendiri saat dibuka lagi.
let vmCetakBagging = null;
const mountPoint = document.getElementById('vue-cetak-bagging');
if (mountPoint) vmCetakBagging = createApp(AppCetakBagging).mount('#vue-cetak-bagging');
window.refreshCetakBagging = function() { if (vmCetakBagging) vmCetakBagging.muat(); };
