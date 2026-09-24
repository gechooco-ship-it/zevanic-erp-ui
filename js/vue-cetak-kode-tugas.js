// js/vue-cetak-kode-tugas.js
// Layar "Cetak Kode Tugas" (Scan & Cetak). Mencetak ULANG lembar kode tugas
// kirim yang sudah ada, dan membuat kode tugas baru tanpa lewat jalur produksi.
// Mount ke #vue-cetak-kode-tugas.
//
// Koleksi & field:
// - tugas_kirim: kode, tlc_asal, tlc_tujuan, pack[], dibuat_pada, dibuat_oleh.
// - master_tlc: kode, nama, tipe — sumber dropdown asal/tujuan.
// - cetak_ulang_log: kode_grouping_induk, bahan, alasan, pin_oleh, pada.
// - pengaturan_id_tugas_kirim: counter harian untuk generateKodeHarian.
//
// Jebakan:
// - Beda dari bagging: asal dan tujuan MEMANG sudah diketahui saat cetak, jadi
//   dua dropdown itu wajib diisi dan ikut tercetak di lembarnya.
// - Satu kode tugas boleh memuat pack dari beberapa Kode Grouping; tidak ada
//   aturan satu-grouping seperti di bagging.
// - Cetak dan cetak ulang digerbang role (pic/pic_owner/owner) DAN PIN.
// - master_tlc kosong = dropdown kosong; isi dulu lewat Persiapan Produksi >
//   Bahan (tombol Isi TLC Awal) atau manual di Firestore.

import { createApp, ref, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, query, orderBy, limit, getDocs, addDoc, doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel, HeaderLayar, KolomCari } from './vue-components.js?v=13';
import { PopupPinGenerik, buatQrDataUrl } from './vue-scan-cetak.js?v=11';

const BATAS_TAMPIL = 30;
const MAKS_BUAT_SEKALIGUS = 10;
const ROLE_BOLEH_CETAK = ['owner', 'superuser', 'pic_owner', 'pic'];

// Sama persis dengan penomoran di jalur produksi: transaksi + counter harian,
// supaya nomor tidak pernah dobel walau dibuat dari dua layar berbeda.
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

const AppCetakKodeTugas = {
  components: { PopupPratinjauCetakLabel, PopupPinGenerik, HeaderLayar, KolomCari },
  setup() {
    const memuat = ref(true);
    const errorMuat = ref('');
    const daftar = ref([]);
    const daftarTlc = ref([]);
    const cari = ref('');
    const filterTujuan = ref('SEMUA');
    const dipilih = ref([]);
    const sedangProses = ref(false);

    // ref, BUKAN computed: window.currentUser objek biasa (tidak reaktif) dan
    // lahir ber-role 'operator' sebelum login selesai. computed akan terkunci
    // di nilai pertama itu selamanya. Diisi di muat(), sesudah authReady.
    const bolehCetak = ref(false);

    async function muat() {
      memuat.value = true;
      errorMuat.value = '';
      bolehCetak.value = ROLE_BOLEH_CETAK.includes((window.currentUser?.role || '').toLowerCase());
      try {
        const [snapTugas, snapTlc] = await Promise.all([
          getDocs(query(collection(db, 'tugas_kirim'), orderBy('dibuat_pada', 'desc'), limit(BATAS_TAMPIL))),
          getDocs(collection(db, 'master_tlc'))
        ]);
        daftar.value = snapTugas.docs.map(d => ({ id: d.id, ...d.data() }));
        daftarTlc.value = snapTlc.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.kode || '').localeCompare(b.kode || ''));
        dipilih.value = [];
      } catch (e) {
        console.error('Gagal memuat kode tugas:', e);
        errorMuat.value = e && e.code === 'failed-precondition'
          ? 'Perlu index Firestore baru — buka Console browser (F12), klik link "Create composite index" dari error di sana, lalu muat ulang layar ini.'
          : 'Gagal memuat daftar kode tugas. Cek Console untuk detail.';
      }
      memuat.value = false;
    }

    const daftarTujuan = computed(() => {
      const set = [];
      daftar.value.forEach(t => { if (t.tlc_tujuan && !set.includes(t.tlc_tujuan)) set.push(t.tlc_tujuan); });
      return set.sort();
    });

    // Cari + filter client-side: cuma 30 baris di memori, tidak perlu query balik.
    const tersaring = computed(() => {
      const kata = cari.value.trim().toLowerCase();
      return daftar.value.filter(t => {
        if (filterTujuan.value !== 'SEMUA' && t.tlc_tujuan !== filterTujuan.value) return false;
        if (!kata) return true;
        return (t.kode || '').toLowerCase().includes(kata)
          || (t.tlc_asal || '').toLowerCase().includes(kata)
          || (t.tlc_tujuan || '').toLowerCase().includes(kata);
      });
    });

    function toggle(kode) {
      const i = dipilih.value.indexOf(kode);
      if (i >= 0) dipilih.value.splice(i, 1); else dipilih.value.push(kode);
    }
    function terpilih(kode) { return dipilih.value.includes(kode); }
    function namaTlc(kode) {
      const t = daftarTlc.value.find(x => x.kode === kode);
      return t && t.nama ? `${kode} — ${t.nama}` : (kode || '-');
    }
    const rincianTerbuka = ref({});
    function toggleRincian(kode) { rincianTerbuka.value[kode] = !rincianTerbuka.value[kode]; }
    function grupDalamPack(t) {
      const set = [];
      (t.pack || []).forEach(p => { if (p.kode_grouping_induk && !set.includes(p.kode_grouping_induk)) set.push(p.kode_grouping_induk); });
      return set;
    }

    // ---- Cetak ulang: alasan wajib -> PIN -> log -> pratinjau cetak
    const popupAlasan = ref(null);
    const pinAktif = ref(false);
    const popupCetak = ref(false);
    const labelPreview = ref([]);

    function bukaCetakUlang() {
      if (!bolehCetak.value) { alert('Role Anda tidak berwenang mencetak lembar kode tugas.'); return; }
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
      const terpilihObj = daftar.value.filter(t => dipilih.value.includes(t.kode));
      try {
        await addDoc(collection(db, 'cetak_ulang_log'), {
          kode_grouping_induk: terpilihObj.flatMap(t => grupDalamPack(t)).join(', ') || '-',
          bahan: terpilihObj.map(t => t.kode).join(', '),
          alasan, pin_oleh: user.nama || user.email || '',
          pada: serverTimestamp()
        });
      } catch (e) { console.error('Gagal catat cetak ulang:', e); }
      labelPreview.value = terpilihObj.map(t => ({
        kode: t.kode, nama: 'Kode Tugas Kirim',
        info: `${t.tlc_asal || '-'} &rarr; ${t.tlc_tujuan || '-'} &middot; ${(t.pack || []).length} pack`,
        qrDataUrl: buatQrDataUrl(t.kode)
      }));
      popupAlasan.value = null;
      popupCetak.value = true;
    }

    // ---- Buat baru: asal + tujuan + jumlah
    const popupBaru = ref(null);
    function bukaBuatBaru() {
      if (!bolehCetak.value) { alert('Role Anda tidak berwenang membuat kode tugas.'); return; }
      if (!daftarTlc.value.length) {
        alert('Belum ada data TLC. Isi dulu lewat Persiapan Produksi > Bahan (tombol "Isi TLC Awal"), atau tambah manual di Firestore koleksi master_tlc.');
        return;
      }
      popupBaru.value = { asal: daftarTlc.value[0].kode, tujuan: daftarTlc.value[0].kode, jumlah: 1 };
    }
    function ubahJumlah(delta) {
      const p = popupBaru.value;
      if (!p) return;
      p.jumlah = Math.min(MAKS_BUAT_SEKALIGUS, Math.max(1, (parseInt(p.jumlah) || 1) + delta));
    }
    async function konfirmasiBuatBaru() {
      const p = popupBaru.value;
      if (!p) return;
      if (p.asal === p.tujuan) { alert('Asal dan tujuan tidak boleh sama.'); return; }
      sedangProses.value = true;
      try {
        const preview = [];
        for (let i = 0; i < p.jumlah; i++) {
          const kode = await generateKodeHarian('TGS', 'pengaturan_id_tugas_kirim');
          await addDoc(collection(db, 'tugas_kirim'), {
            kode, tlc_asal: p.asal, tlc_tujuan: p.tujuan, pack: [],
            dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
          });
          preview.push({ kode, nama: 'Kode Tugas Kirim', info: `${p.asal} &rarr; ${p.tujuan}`, qrDataUrl: buatQrDataUrl(kode) });
        }
        labelPreview.value = preview;
        popupBaru.value = null;
        popupCetak.value = true;
        await muat();
      } catch (e) {
        console.error('Gagal buat kode tugas:', e);
        alert('Gagal membuat kode tugas. Coba lagi.');
      }
      sedangProses.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });

    return {
      memuat, errorMuat, daftar, daftarTlc, cari, filterTujuan, dipilih, sedangProses, bolehCetak,
      tersaring, daftarTujuan, toggle, terpilih, namaTlc, grupDalamPack,
      rincianTerbuka, toggleRincian, muat,
      popupAlasan, pinAktif, popupCetak, labelPreview,
      bukaCetakUlang, lanjutKePin, pinSukses,
      popupBaru, bukaBuatBaru, ubahJumlah, konfirmasiBuatBaru
    };
  },
  template: `
  <div>
    <header-layar kicker="SCAN & CETAK" judul="Cetak Kode Tugas" menu-id="scan_cetak_tugas" tab-pulang="tab-scan-cetak" />

    <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
      <div style="flex:1; min-width:0;"><kolom-cari v-model="cari" placeholder="Cari kode tugas / TLC..." /></div>
      <button @click="bukaBuatBaru" :disabled="!bolehCetak" class="btn-primary" style="padding:9px 14px; white-space:nowrap;"><i class="fas fa-plus" style="margin-right:6px;"></i>Buat Baru</button>
    </div>

    <div v-if="!bolehCetak" class="gc-card" style="padding:10px 12px; margin-bottom:10px; background:var(--warn-light); font-size:11px; color:var(--warn-text);">
      Role Anda bisa melihat daftar ini, tapi tidak bisa mencetak. Cetak lembar kode tugas dibatasi ke PIC, PIC Owner, dan Owner.
    </div>

    <div class="gc-field" style="margin-bottom:10px;">
      <label>Tujuan</label>
      <select v-model="filterTujuan">
        <option value="SEMUA">Semua TLC</option>
        <option v-for="t in daftarTujuan" :key="t" :value="t">{{ namaTlc(t) }}</option>
      </select>
    </div>

    <div style="display:flex; align-items:center; gap:8px; font-size:10.5px; color:var(--text-muted); margin-bottom:10px;">
      <i class="fas fa-circle-info"></i>
      <span>30 terbaru. Ukuran kertas ikut Pengaturan Cetak.</span>
    </div>

    <div v-if="memuat" style="text-align:center; padding:30px 0; color:var(--text-faint); font-size:11px;">Memuat...</div>
    <div v-else-if="errorMuat" class="gc-card" style="padding:12px; font-size:11.5px; color:var(--danger);">{{ errorMuat }}</div>

    <div v-else-if="tersaring.length === 0" class="gc-kosong">
      <div class="lingkaran"><i class="fas fa-truck"></i></div>
      <h3 class="gc-heading" style="font-size:12.5px; font-weight:700; margin:0;">Tidak ada kode tugas</h3>
      <p style="font-size:11px; color:var(--text-muted); margin-top:4px;">Belum ada yang dibuat, atau kata cari tidak cocok.</p>
    </div>

    <div v-else style="display:flex; flex-direction:column; gap:7px;">
      <div v-for="t in tersaring" :key="t.kode" class="gc-card" style="padding:11px 12px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <input type="checkbox" :checked="terpilih(t.kode)" @change="toggle(t.kode)" :disabled="!bolehCetak" style="width:18px; height:18px; accent-color:var(--burgundy); flex-shrink:0;">
          <div style="flex:1; min-width:0; cursor:pointer;" @click="toggleRincian(t.kode)">
            <div class="gc-heading gc-num" style="font-size:12.5px; font-weight:700;">{{ t.kode }}</div>
            <div style="display:flex; align-items:center; gap:6px; margin-top:3px; flex-wrap:wrap;">
              <span class="tag neutral">{{ t.tlc_asal || '-' }}</span>
              <i class="fas fa-arrow-right" style="font-size:9px; color:var(--text-faint);"></i>
              <span class="tag">{{ t.tlc_tujuan || '-' }}</span>
            </div>
            <div style="font-size:10px; color:var(--text-faint); margin-top:4px;">{{ (t.pack || []).length }} pack</div>
          </div>
        </div>
        <div v-if="rincianTerbuka[t.kode] && (t.pack || []).length" style="margin-top:8px; padding-top:8px; border-top:1px solid var(--line);">
          <div style="font-size:10px; color:var(--text-muted); margin-bottom:5px;">Kode Grouping di dalamnya: {{ grupDalamPack(t).join(', ') || '-' }}</div>
          <div style="display:flex; flex-wrap:wrap; gap:5px;">
            <span v-for="p in t.pack" :key="p.kode_bagging" class="gc-num" style="font-size:10px; background:var(--ivory-dim); padding:3px 8px; border-radius:999px; color:var(--text-muted);">{{ p.kode_bagging }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="dipilih.length" style="position:sticky; bottom:0; margin-top:12px; padding:11px 12px; background:var(--surface); border-top:1.5px solid var(--line); display:flex; align-items:center; gap:9px;">
      <span style="flex:1; font-size:11px; color:var(--text-muted);">{{ dipilih.length }} dipilih</span>
      <button @click="dipilih = []" class="btn-outline" style="padding:9px 14px;">Batal</button>
      <button @click="bukaCetakUlang" class="btn-primary" style="padding:9px 16px;">Cetak Ulang ({{ dipilih.length }})</button>
    </div>

    <div v-if="popupAlasan" class="gc-dialog-backdrop" @click="popupAlasan = null">
      <div class="gc-dialog" @click.stop style="text-align:left;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 4px;"><i class="fas fa-rotate" style="margin-right:8px; color:var(--warn);"></i>Cetak Ulang Lembar</h3>
        <p style="font-size:11px; color:var(--text-muted); margin:0 0 12px;">{{ dipilih.length }} kode &middot; dicatat di riwayat cetak ulang.</p>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupAlasan.alasan" type="text" placeholder="Mis. lembar sobek / hilang"></div>
        <div style="display:flex; gap:8px;">
          <button @click="popupAlasan = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="lanjutKePin" class="btn-primary" style="flex:1; padding:9px;">Lanjut Verifikasi PIN</button>
        </div>
      </div>
    </div>

    <div v-if="popupBaru" class="gc-dialog-backdrop" @click="popupBaru = null">
      <div class="gc-dialog" @click.stop style="text-align:left;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 4px;">Buat Kode Tugas Baru</h3>
        <p style="font-size:11px; color:var(--text-muted); margin:0 0 12px;">Lembar baru tanpa pack; isinya menyusul saat Scan Kirim.</p>
        <div style="display:flex; gap:8px; margin-bottom:12px;">
          <div class="gc-field" style="flex:1; min-width:0;"><label>Dari</label>
            <select v-model="popupBaru.asal"><option v-for="t in daftarTlc" :key="t.id" :value="t.kode">{{ t.kode }}</option></select>
          </div>
          <div class="gc-field" style="flex:1; min-width:0;"><label>Ke</label>
            <select v-model="popupBaru.tujuan"><option v-for="t in daftarTlc" :key="t.id" :value="t.kode">{{ t.kode }}</option></select>
          </div>
        </div>
        <div class="gc-field" style="margin-bottom:6px;"><label>Jumlah lembar</label></div>
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
          <button @click="ubahJumlah(-1)" class="btn-outline" style="width:42px; padding:9px;">&minus;</button>
          <div class="gc-heading gc-num" style="flex:1; text-align:center; font-size:18px; font-weight:700;">{{ popupBaru.jumlah }}</div>
          <button @click="ubahJumlah(1)" class="btn-outline" style="width:42px; padding:9px;">+</button>
        </div>
        <p style="font-size:10px; color:var(--warn-text); margin:0 0 12px;">Kode langsung dibuat begitu ditekan dan tidak bisa dihapus.</p>
        <div style="display:flex; gap:8px;">
          <button @click="popupBaru = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiBuatBaru" :disabled="sedangProses" class="btn-primary" style="flex:1; padding:9px;">{{ sedangProses ? 'Membuat...' : 'Buat & Cetak' }}</button>
        </div>
      </div>
    </div>

    <popup-pin-generik v-if="pinAktif" judul="Verifikasi PIN — Cetak Ulang Kode Tugas" konteks="Cetak Kode Tugas - Cetak Ulang" :roles-diizinkan="['owner','superuser','pic_owner','pic']" @sukses="pinSukses" @batal="pinAktif = false" />

    <popup-pratinjau-cetak-label :terbuka="popupCetak" judul="Cetak Lembar Kode Tugas" :daftar-label="labelPreview" jenis-cetak="lembar_kode_tugas" @tutup="popupCetak = false" />
  </div>
  `
};

// Ekspos muat() seperti layar lain: tab yang sudah ter-mount tidak memuat
// ulang sendiri saat dibuka lagi.
let vmCetakKodeTugas = null;
const mountPoint = document.getElementById('vue-cetak-kode-tugas');
if (mountPoint) vmCetakKodeTugas = createApp(AppCetakKodeTugas).mount('#vue-cetak-kode-tugas');
window.refreshCetakKodeTugas = function() { if (vmCetakKodeTugas) vmCetakKodeTugas.muat(); };
