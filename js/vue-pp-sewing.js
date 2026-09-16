// js/vue-pp-sewing.js
// Proses Produksi > Sewing — menerima batch dari Serie, menjahit, mencetak
// label pcs, lalu mengirim hasilnya balik ke Serie. 5 tab.
//
// Koleksi & field:
// - sewing_track: 1 dokumen per batch yang masuk Sewing. batch_id (id dokumen
//   separating_batch), kode_batch, kode_bagging[], kode_tugas, terima_pada,
//   mulai_sewing_pada, entry_pada, label_pcs_dicetak_pada. Dibuat LAZY &
//   idempoten dari separating_batch berstatus kirim_sewing tiap Tab 1 dibuka.
// - label_pcs: 1 dokumen per pcs jadi. kode_pcs = PCS + yymmdd + counter.
//
// Jebakan:
// - kode_bagging[] & kode_tugas di sewing_track KHUSUS pengiriman KELUAR
//   (Sewing ke Serie). Kiriman MASUK dari Serie dicocokkan langsung ke
//   separating_batch — kalau tertukar, Serie Tab Terima tidak menemukannya.
// - terima_pada (Sewing menerima dari Serie) BEDA dari sampai_pada. status
//   'selesai' + sampai_pada ditulis SERIE lewat buatTabTerima, bukan modul ini.
// - Cetak Ulang membaca ulang label_pcs lewat batch_id, tidak addDoc lagi.
// - Satu bagging membundel semua label_pcs satu batch, jadi Scan Kirim tidak
//   perlu menunggu "semua bagging discan" seperti pos lain.

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel } from './vue-components.js?v=13';
import { ScanGenerik, PopupPinGenerik, buatQrDataUrl, ajukanPersiapanMasalah, buatUnpackUniversal, ambilStatusUnpackBagging } from './vue-scan-cetak.js?v=7';

// Format & hitung kecil (disalin pola dari Cutting/Serie, belum ada
// infrastruktur util generik lintas file).
function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
const AMBANG_TERTAHAN_JAM = 6; // sama semua pos, lihat catatan §8 header js/vue-pp-cutting.js
function jamSejak(iso) {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}
function tertahan(iso) {
  const j = jamSejak(iso);
  return j !== null && j > AMBANG_TERTAHAN_JAM;
}
function formatDiamSejak(iso) {
  const j = jamSejak(iso);
  if (j === null) return '-';
  if (j < 1) return Math.max(1, Math.round(j * 60)) + ' menit';
  return j.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jam';
}
// formatJamDurasi — SAMA logika formatDiamSejak, tapi input angka jam MENTAH
// (hasil selisih 2 timestamp yang sudah dihitung), bukan 1 ISO string vs waktu
// kini — dipakai KPI "rata-rata waktu per batch" Tab 3.2 (keputusan #5).
function formatJamDurasi(jam) {
  if (jam === null || jam === undefined || isNaN(jam)) return '-';
  if (jam < 1) return Math.max(1, Math.round(jam * 60)) + ' menit';
  return jam.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jam';
}
function formatWaktu(iso) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return '-'; }
}
function hariIniSama(iso) {
  if (!iso) return false;
  const d = new Date(iso), now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
// generateKodeHarianFormat — pola SAMA seperti Cutting/Serie: mengembalikan
// STRING TERFORMAT penuh `${prefix}${tanggalKey}-${counter 3 digit}`.
async function generateKodeHarianFormat(prefix, koleksiCounter) {
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
function picOwnerKeAtas(userData) {
  if (!userData) return false;
  const role = (userData.role || '').toLowerCase();
  return role === 'owner' || role === 'superuser' || role === 'pic';
}
const TLC_ASAL_SEWING = 'TLC-JHT';
const TLC_TUJUAN_SERIE = 'TLC-SER';

// Baca koleksi mentah
async function muatSemuaSeparatingBatch() {
  const snap = await getDocs(collection(db, 'separating_batch'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function muatSemuaSewingTrack() {
  const snap = await getDocs(collection(db, 'sewing_track'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
let _cachePetaProduk = null;
async function ambilPetaProdukBySku() {
  if (_cachePetaProduk) return _cachePetaProduk;
  const peta = {};
  try {
    const snap = await getDocs(collection(db, 'master_produk'));
    snap.forEach(d => { const p = d.data(); if (p.sku) peta[p.sku] = p; });
  } catch (e) { console.error('Gagal ambil master_produk:', e); }
  _cachePetaProduk = peta;
  return peta;
}
// resolveSkuWarnaBatch — keputusan #4: rantai separating_batch.spk_groupings [0]
// -> spk_grouping.sku_produk_terlibat[0] -> master_produk.warna.
async function resolveSkuWarnaBatch(batch, petaProduk) {
  try {
    const gid = (batch.spk_groupings || [])[0];
    if (!gid) return { sku_produk: '', warna: '' };
    const gSnap = await getDoc(doc(db, 'spk_grouping', gid));
    if (!gSnap.exists()) return { sku_produk: '', warna: '' };
    const g = gSnap.data();
    const sku = (g.sku_produk_terlibat || [])[0] || '';
    const produk = sku ? petaProduk[sku] : null;
    return { sku_produk: sku, warna: (produk && produk.warna) || '' };
  } catch (e) { console.error('Gagal resolve sku/warna batch Sewing:', e); return { sku_produk: '', warna: '' }; }
}
// pastikanSewingTrackLengkap — keputusan #8: buat sewing_track utk
// separating_batch berstatus 'kirim_sewing' yang belum punya, LAZY, idempoten.
async function pastikanSewingTrackLengkap() {
  const [batchList, trackList, petaProduk] = await Promise.all([
    muatSemuaSeparatingBatch(), muatSemuaSewingTrack(), ambilPetaProdukBySku()
  ]);
  const masuk = batchList.filter(b => b.status === 'kirim_sewing');
  const sudahAda = new Set(trackList.map(t => t.batch_id));
  const belum = masuk.filter(b => !sudahAda.has(b.id));
  if (belum.length) {
    const now = new Date().toISOString();
    await Promise.all(belum.map(async (b) => {
      const { sku_produk, warna } = await resolveSkuWarnaBatch(b, petaProduk);
      await addDoc(collection(db, 'sewing_track'), {
        batch_id: b.id, kode_batch: b.kode_batch || '',
        // kode_spk disalin dari separating_batch. Array (bisa >1
        // grouping kalau batch ini hasil gabungan).
        kode_spk: b.spk_groupings || [],
        nama_produk: b.nama_produk || '', size: b.size || '',
        sku_produk, warna, qty: parseFloat(b.qty) || 0,
        status: 'perlu_diproses',
        operator_uid: null, operator_nama: null, riwayat_operator: [],
        kode_bagging: [], kode_tugas: '', tujuan: 'Serie',
        unpack_log: [], catatan_masalah: '',
        terima_pada: null, mulai_sewing_pada: null, entry_pada: null, label_pcs_dicetak_pada: null,
        masuk_tahap_pada: now, sampai_pada: null,
        // riwayat_scan ditulis ADITIF.
        riwayat_scan: [],
        dibuat_pada: serverTimestamp(), diperbarui_pada: serverTimestamp()
      });
    }));
  }
  return await muatSemuaSewingTrack();
}
// updateSewingTrack — read-modify-write ATOMIK, pola sama seperti
// updateCuttingTrack/updateSeparatingBatch di modul lain.
async function updateSewingTrack(trackId, mutator) {
  const ref = doc(db, 'sewing_track', trackId);
  await runTransaction(db, async (trx) => {
    const snap = await trx.get(ref);
    if (!snap.exists()) throw new Error('Dokumen sewing_track tidak ditemukan.');
    const data = snap.data();
    const patch = mutator(data) || {};
    trx.update(ref, { ...patch, diperbarui_pada: serverTimestamp() });
  });
}

// Popup Scan Masalah generik (jumlah kurang + alasan) — SAMA pola Cutting/
// Serie, sumberJalur:'sewing'.
function popupMasalahMixin(kirimFn) {
  const popupMasalah = ref(null); // { target, jumlah, alasan }
  function bukaMasalah(target) { popupMasalah.value = { target, jumlah: target.qty || 0, alasan: '' }; }
  function batalMasalah() { popupMasalah.value = null; }
  async function konfirmasiMasalah() {
    const p = popupMasalah.value;
    if (!p) return;
    if (!p.alasan.trim()) { alert('Alasan wajib diisi.'); return; }
    try { await kirimFn(p); popupMasalah.value = null; }
    catch (e) { console.error('Gagal ajukan masalah:', e); alert('Gagal menyimpan. Coba lagi.'); }
  }
  return { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah };
}
async function kirimMasalahSewing(track, jumlah, alasan) {
  await ajukanPersiapanMasalah({
    tlcAsal: TLC_ASAL_SEWING, sumberJalur: 'sewing',
    trackId: track.id, noSpk: track.kode_batch,
    bahanNama: track.nama_produk, bahanWarna: track.size, satuan: 'pcs',
    qtyKurang: jumlah, alasan
  });
  // riwayat_scan ditulis ADITIF. Dipanggil dari SEMUA popup Scan
  // Masalah (Tab 3.1/3.2/3.3/3.4, satu fungsi dipakai bersama) — dibungkus
  // try/catch supaya kegagalan catat riwayat_scan tidak menggagalkan pengajuan
  // masalah yang sudah berhasil di atas.
  try {
    await updateSewingTrack(track.id, () => ({
      riwayat_scan: arrayUnion({ aksi: 'masalah', oleh: window.currentUser?.email || null, pada: new Date().toISOString(), catatan: alasan, qty: jumlah ?? null })
    }));
  } catch (e) { console.error('Gagal catat riwayat_scan masalah Sewing:', e); }
}


// TAB 3.1: Perlu Di Proses

const SewingPerluDiProses = {
  components: { ScanGenerik, PopupPinGenerik },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    // unpackEnrich mengisi badge "Unpack" karena buatUnpackUniversal tidak
    // menulis t.unpack_log. Kunci: t.kode_batch (string, sama persis dengan
    // bagging.kode_batch dari Serie Tab 2.3 — lebih presisi daripada t.kode_spk
    // yang array). Lihat ambilStatusUnpackBagging di vue-scan-cetak.js.
    const unpackEnrich = ref({});
    const menuId = 'proses_sewing';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehOperator = computed(() => picOwnerKeAtas(window.currentUser));

    async function muat() {
      memuat.value = true;
      try {
        daftar.value = (await pastikanSewingTrackLengkap()).filter(t => t.status === 'perlu_diproses');
        unpackEnrich.value = await ambilStatusUnpackBagging('kode_batch', 'kode_batch_asal', daftar.value.map(t => t.kode_batch));
      }
      catch (e) { console.error('Gagal muat Sewing > Perlu Di Proses:', e); daftar.value = []; }
      memuat.value = false;
    }

    // Scan Sampai: step1 kode_tugas, step2 kode_bagging berkali-kali —
    // KEDUANYA dicocokkan ke `separating_batch` (BUKAN sewing_track sendiri,
    // lihat keputusan #2). Begitu KOMPLIT, tulis `terima_pada` di sewing_track
    // yang batch_id-nya cocok.
    const modalSampai = reactive({ aktif: false, batch: null, tugasKirim: null, log: [] });
    function bukaScanSampai() { modalSampai.batch = null; modalSampai.tugasKirim = null; modalSampai.log = []; modalSampai.aktif = true; }
    function tutupScanSampai() { modalSampai.aktif = false; modalSampai.batch = null; modalSampai.tugasKirim = null; modalSampai.log = []; muat(); }
    async function hasilScanSampai(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      if (!modalSampai.batch) {
        try {
          const snap = await getDocs(query(collection(db, 'separating_batch'), where('kode_tugas', '==', kode)));
          if (snap.empty) { alert(`Kode tugas "${kode}" tidak ditemukan.`); return; }
          modalSampai.batch = { id: snap.docs[0].id, ...snap.docs[0].data() };
          // cache tugas_kirim (kode-nya SAMA dengan kode_tugas yang sudah
          // dicocokkan di atas) supaya tiap kode_bagging yang lolos di step2
          // bisa langsung melepas pack[].sampai_pada-nya, persis pola
          // pp-cutting.js.
          try {
            const snapTugas = await getDocs(query(collection(db, 'tugas_kirim'), where('kode', '==', kode)));
            modalSampai.tugasKirim = snapTugas.empty ? null : { id: snapTugas.docs[0].id, ...snapTugas.docs[0].data() };
          } catch (e) { console.error('Gagal cari tugas_kirim utk pelepasan sampai:', e); modalSampai.tugasKirim = null; }
        } catch (e) { console.error('Gagal cari kode tugas:', e); alert('Gagal mencari kode tugas. Coba lagi.'); }
        return;
      }
      const b = modalSampai.batch;
      if (!(b.kode_bagging || []).includes(kode)) { alert(`Kode bagging "${kode}" tidak cocok dengan tugas ini.`); return; }
      if (modalSampai.log.includes(kode)) { alert(`Kode bagging "${kode}" sudah discan sebelumnya di sesi ini.`); return; }
      modalSampai.log.unshift(kode);
      // lepas kaitan root1/root2/bagging di tugas_kirim.pack[] begitu
      // kode_bagging ini dinyatakan sampai.
      const tk = modalSampai.tugasKirim;
      if (tk) {
        const packArr = Array.isArray(tk.pack) ? tk.pack : [];
        const idxPack = packArr.findIndex(p => p.kode_bagging === kode && !p.sampai_pada);
        if (idxPack >= 0) {
          try {
            const nowLepas = new Date().toISOString();
            const packBaru = packArr.slice();
            packBaru[idxPack] = { ...packBaru[idxPack], sampai_pada: nowLepas };
            await updateDoc(doc(db, 'tugas_kirim', tk.id), { pack: packBaru });
            tk.pack = packBaru;
          } catch (e) { console.error('Gagal lepas pack tugas_kirim (Sewing):', e); }
        }
      }
      const sudahSemua = (b.kode_bagging || []).every(kb => modalSampai.log.includes(kb));
      if (sudahSemua) {
        try {
          const t = daftar.value.find(x => x.batch_id === b.id);
          if (!t) { alert('Bagging cocok, tapi sewing_track untuk batch ini belum ada — coba tutup lalu buka lagi tab ini.'); return; }
          const now = new Date().toISOString();
          // riwayat_scan ditulis ADITIF.
          await updateSewingTrack(t.id, () => ({
            terima_pada: now,
            riwayat_scan: arrayUnion({ aksi: 'sampai', oleh: window.currentUser?.email || null, pada: now, qty: t.qty ?? null, catatan: 'Diterima dari Serie — kode tugas ' + (b.kode_tugas || '') })
          }));
          modalSampai.log.unshift('SEMUA bagging sampai — batch ' + (b.kode_batch || '') + ' siap ditunjuk operator');
          await muat();
        } catch (e) { console.error('Gagal simpan scan sampai Sewing:', e); alert('Gagal menyimpan. Coba lagi.'); }
      }
    }

    // Scan Unpack: scan ULANG tiap isi bagging (bagging.isi[]), lihat
    // buatUnpackUniversal di vue-scan-cetak.js untuk detail lengkap.
    const { modalUnpack, bukaScanUnpack, tutupScanUnpack, hasilScanUnpack, tutupUnpack } = buatUnpackUniversal();

    // Tunjuk Operator (PIN, role PIC/PIC Owner/Owner) — keputusan #9:
    // diblokir kalau belum Scan Sampai (terima_pada kosong).
    const popupPinOperator = ref(null); // track
    function bukaTunjukOperator(track) {
      if (!track.terima_pada) { alert('Batch ini belum di-Scan Sampai — lakukan Scan Sampai dulu sebelum menunjuk operator.'); return; }
      popupPinOperator.value = track;
    }
    async function pinSuksesOperator(user) {
      const track = popupPinOperator.value;
      popupPinOperator.value = null;
      try {
        const now = new Date().toISOString();
        const namaOperator = user.nama || user.name || user.email;
        await updateSewingTrack(track.id, (data) => ({
          operator_uid: user.email, operator_nama: namaOperator,
          riwayat_operator: [...(data.riwayat_operator || []), { uid: user.email, nama: namaOperator, pada: now }],
          status: 'sedang_sewing', mulai_sewing_pada: now, masuk_tahap_pada: now,
          // riwayat_scan ditulis ADITIF.
          riwayat_scan: arrayUnion({ aksi: 'operator', oleh: namaOperator, pada: now, qty: data.qty ?? null })
        }));
        await muat();
      } catch (e) { console.error('Gagal tunjuk operator Sewing:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahSewing(p.target, p.jumlah, p.alasan);
      await muat();
    });

    // Toolbar global (wireframe §3.1): per kartu cuma ada SATU tombol
    // kontekstual "Scan Operator". Scan Sampai & Scan Unpack global secara logic
    // (target dicari dari kode yang discan, pola Gudang). Scan Masalah butuh
    // target+jumlah spesifik, jadi lewat popup "pilih dulu" di toolbar.

    const pilihMasalah = ref(null); // { targetId }
    function bukaMasalahToolbar() {
      if (!daftar.value.length) { alert('Tidak ada batch di tab ini untuk dilaporkan.'); return; }
      pilihMasalah.value = { targetId: daftar.value[0].id };
    }
    function batalPilihMasalah() { pilihMasalah.value = null; }
    function konfirmasiPilihMasalah() {
      const t = daftar.value.find(x => x.id === pilihMasalah.value.targetId);
      pilihMasalah.value = null;
      if (t) bukaMasalah(t);
    }

    onMounted(async () => { await window.authReady; await muat(); });

    return { muat,
      memuat, daftar, unpackEnrich, bolehProses, bolehOperator, formatQty, formatDiamSejak, tertahan,
      modalSampai, bukaScanSampai, tutupScanSampai, hasilScanSampai,
      modalUnpack, bukaScanUnpack, tutupScanUnpack, hasilScanUnpack, tutupUnpack,
      popupPinOperator, bukaTunjukOperator, pinSuksesOperator,
      popupMasalah, batalMasalah, konfirmasiMasalah,
      pilihMasalah, bukaMasalahToolbar, batalPilihMasalah, konfirmasiPilihMasalah
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <!-- Toolbar global — Scan Sampai & Scan Unpack global dari sisi logic, tampilannya
        dikumpulkan di sini. Scan Masalah lewat popup pilih-target. -->
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <button v-if="bolehProses" @click="bukaScanSampai" class="btn-primary" style="flex:1; min-width:120px; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Sampai</button>
        <button v-if="bolehProses" @click="bukaScanUnpack" class="btn-outline" style="flex:1; min-width:120px; padding:9px;"><i class="fas fa-box-open" style="margin-right:6px;"></i>Scan Unpack</button>
        <button v-if="bolehProses" @click="bukaMasalahToolbar" class="btn-outline" style="flex:1; min-width:120px; padding:9px; color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>Scan Masalah</button>
      </div>
      <div v-if="daftar.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-inbox"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada batch yang perlu diproses</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="t in daftar" :key="t.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ t.kode_batch }}</div>
            <span class="tag" :class="tertahan(t.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(t.masuk_tahap_pada) }}</span>
          </div>
          <div style="font-size:12px; color:var(--text-faint); margin-bottom:6px;">{{ t.nama_produk }} &middot; size {{ t.size || '-' }} &middot; warna {{ t.warna || '-' }} &middot; qty {{ formatQty(t.qty) }}</div>
          <div style="font-size:10.5px; margin-bottom:10px;">
            <span class="tag" :class="t.terima_pada ? 'ok' : 'neutral'">{{ t.terima_pada ? 'sudah sampai' : 'belum sampai' }}</span>
          </div>
          <!-- Satu tombol kontekstual (wireframe §3.1): Scan Operator, mati kalau belum
            sampai/komplit. Guard alert di bukaTunjukOperator jadi jaring kedua. -->
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button v-if="bolehOperator" @click="bukaTunjukOperator(t)" :disabled="!t.terima_pada" class="btn-outline" style="flex:1; padding:8px; font-size:11.5px;" :style="{ opacity: t.terima_pada ? 1 : .5 }"><i class="fas fa-user-check" style="margin-right:4px;"></i>Scan Operator</button>
          </div>
          <div v-if="(unpackEnrich[t.kode_batch] || []).length" style="margin-top:8px; font-size:10.5px; color:var(--text-faint);">
            Unpack: <span v-for="(u,i) in unpackEnrich[t.kode_batch]" :key="i" class="tag" :class="u.unpack_hasil==='komplit' ? 'ok' : (u.unpack_hasil==='inkomplit' ? 'warn' : 'neutral')" style="margin-right:4px;">{{ u.kode }}: {{ u.unpack_hasil || 'belum' }}</span>
          </div>
        </div>
      </div>
    </template>

    <scan-generik :aktif="modalSampai.aktif" :judul="modalSampai.batch ? ('Scan kode bagging — tugas ' + modalSampai.batch.kode_tugas) : 'Scan Kode Tugas'" subjudul="Bisa discan berkali-kali (tiap kode bagging = 1 pack dari Serie)." @hasil="hasilScanSampai" @tutup="tutupScanSampai" />
    <div v-if="modalSampai.aktif && modalSampai.batch && modalSampai.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:280px;">
      <div v-for="(l,i) in modalSampai.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>

    <scan-generik :aktif="modalUnpack.aktif" :judul="modalUnpack.bagging ? ('Scan ulang isi — bagging ' + modalUnpack.bagging.kode) : 'Scan Kode Bagging (Unpack)'" subjudul="Scan ulang tiap barang di dalam bagging ini satu per satu, sama seperti Scan Pack." @hasil="hasilScanUnpack" @tutup="tutupScanUnpack" />
    <div v-if="modalUnpack.aktif && modalUnpack.bagging" style="position:fixed; left:16px; bottom:90px; z-index:10001; background:rgba(0,0,0,.82); border-radius:12px; padding:10px 14px; max-width:300px; color:#fff;">
      <div style="font-size:11.5px; font-weight:700; margin-bottom:6px;">{{ modalUnpack.dicocokkan.length }}/{{ (modalUnpack.bagging.isi||[]).length }} cocok<span v-if="modalUnpack.asing.length"> &middot; {{ modalUnpack.asing.length }} asing</span></div>
      <div v-for="(l,i) in modalUnpack.log.slice(0,4)" :key="i" style="font-size:10.5px; margin-bottom:2px;">{{ l }}</div>
      <div v-if="!modalUnpack.bagging.unpack_hasil" style="display:flex; gap:6px; margin-top:8px;">
        <button @click="tutupUnpack(false)" class="btn-primary" style="flex:1; padding:6px; font-size:10.5px;">Tutup</button>
        <button @click="tutupUnpack(true)" class="btn-outline" style="flex:1; padding:6px; font-size:10.5px; color:#F2A0A0; border-color:#F2A0A0;">Paksa INKOMPLIT</button>
      </div>
    </div>

    <popup-pin-generik v-if="popupPinOperator" judul="Verifikasi PIN — Operator Sewing" konteks="Sewing - Scan Operator" :roles-diizinkan="['owner','superuser','pic_owner','pic']" @sukses="pinSuksesOperator" @batal="popupPinOperator = null" />

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.target.kode_batch }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. bagging rusak/isi tidak lengkap"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>

    <div v-if="pilihMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Pilih Batch — Scan Masalah</h3>
        <div class="gc-field" style="margin-bottom:14px;"><label>Pilih Batch</label>
          <select v-model="pilihMasalah.targetId"><option v-for="t in daftar" :key="t.id" :value="t.id">{{ t.kode_batch }} — {{ t.nama_produk }}</option></select>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="batalPilihMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiPilihMasalah" class="btn-primary" style="flex:1; padding:9px;">Lanjut</button>
        </div>
      </div>
    </div>
  `
};


// TAB 3.2: Sedang Sewing — dikelompokkan per operator + KPI (keputusan #5).

const SewingSedangSewing = {
  components: { ScanGenerik },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const semuaTrack = ref([]);
    const menuId = 'proses_sewing';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const semua = await muatSemuaSewingTrack();
        semuaTrack.value = semua;
        daftar.value = semua.filter(t => t.status === 'sedang_sewing');
      } catch (e) { console.error('Gagal muat Sewing > Sedang Sewing:', e); daftar.value = []; semuaTrack.value = []; }
      memuat.value = false;
    }

    function kpiOperator(namaOperator) {
      const milik = semuaTrack.value.filter(t => t.operator_nama === namaOperator);
      const selesaiHariIni = milik.filter(t => t.entry_pada && hariIniSama(t.entry_pada)).length;
      const durasiList = milik
        .filter(t => t.entry_pada && t.mulai_sewing_pada)
        .map(t => (new Date(t.entry_pada).getTime() - new Date(t.mulai_sewing_pada).getTime()) / 3600000);
      const rataRata = durasiList.length ? (durasiList.reduce((a, b) => a + b, 0) / durasiList.length) : null;
      return { selesaiHariIni, rataRata };
    }
    const kelompokOperator = computed(() => {
      const peta = {};
      daftar.value.forEach(t => {
        const key = t.operator_nama || '(belum ditunjuk)';
        if (!peta[key]) peta[key] = { operator: key, daftar: [], kpi: kpiOperator(key) };
        peta[key].daftar.push(t);
      });
      return Object.values(peta);
    });

    // Scan Entry: satu scan kode_batch = batch selesai dijahit.
    const modalEntry = reactive({ aktif: false, log: [] });
    function bukaScanEntry() { modalEntry.log = []; modalEntry.aktif = true; }
    function tutupScanEntry() { modalEntry.aktif = false; modalEntry.log = []; muat(); }
    async function hasilScanEntry(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      const t = daftar.value.find(x => x.kode_batch === kode);
      if (!t) { alert(`Kode batch "${kode}" tidak ditemukan di Sedang Sewing.`); return; }
      try {
        const now = new Date().toISOString();
        // riwayat_scan ditulis ADITIF.
        await updateSewingTrack(t.id, () => ({
          status: 'perlu_dikirim', entry_pada: now, masuk_tahap_pada: now,
          riwayat_scan: arrayUnion({ aksi: 'entry', oleh: window.currentUser?.email || null, pada: now, qty: t.qty ?? null })
        }));
        modalEntry.log.unshift(kode + ' -> selesai dijahit');
        await muat();
      } catch (e) { console.error('Gagal scan entry Sewing:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahSewing(p.target, p.jumlah, p.alasan);
      await muat();
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return { muat,
      memuat, kelompokOperator, bolehProses, formatQty, formatDiamSejak, tertahan, formatJamDurasi,
      modalEntry, bukaScanEntry, tutupScanEntry, hasilScanEntry,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div v-if="bolehProses" style="display:flex; gap:8px; margin-bottom:12px;">
        <button @click="bukaScanEntry" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Entry (kode batch)</button>
      </div>
      <div v-if="kelompokOperator.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-shirt"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada batch yang sedang dijahit</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:12px;">
        <div v-for="op in kelompokOperator" :key="op.operator" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
            <div class="gc-heading" style="font-weight:700; font-size:12.5px;"><i class="fas fa-user" style="margin-right:6px;"></i>{{ op.operator }}</div>
            <div style="display:flex; gap:6px;">
              <span class="tag ok">{{ op.kpi.selesaiHariIni }} selesai hari ini</span>
              <span class="tag neutral">rata² {{ formatJamDurasi(op.kpi.rataRata) }}/batch</span>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div v-for="t in op.daftar" :key="t.id" style="display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:11px; padding:6px 8px; border-radius:10px;" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : 'transparent' }">
              <span class="gc-num" style="font-weight:700;">{{ t.kode_batch }}</span>
              <span style="color:var(--text-faint);">{{ t.nama_produk }} size {{ t.size || '-' }}</span>
              <span class="gc-num" style="color:var(--text-faint);">diam {{ formatDiamSejak(t.masuk_tahap_pada) }}</span>
              <button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="padding:4px 8px; font-size:10px; color:var(--danger);"><i class="fas fa-triangle-exclamation"></i></button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <scan-generik :aktif="modalEntry.aktif" judul="Scan Entry — Batch Selesai Dijahit" subjudul="Scan kode batch. Bisa discan berkali-kali (tiap scan = 1 batch selesai)." @hasil="hasilScanEntry" @tutup="tutupScanEntry" />
    <div v-if="modalEntry.aktif && modalEntry.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:280px;">
      <div v-for="(l,i) in modalEntry.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.target.kode_batch }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. jahitan cacat"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};


// TAB 3.3: Perlu Dikirim — Cetak Label Pcs, Cetak Bagging+Kode Tugas, Scan Pack,
// Scan Kirim, Scan Masalah (keputusan #6/#7/#11/#12).

const SewingPerluDikirim = {
  components: { PopupPratinjauCetakLabel, ScanGenerik },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const daftarBaggingAktif = ref([]);
    const sedangProses = ref(false);
    const menuId = 'proses_sewing';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const [tracks, baggingSnap] = await Promise.all([
          muatSemuaSewingTrack(),
          getDocs(query(collection(db, 'bagging'), where('ditutup_pada', '==', null)))
        ]);
        daftar.value = tracks.filter(t => t.status === 'perlu_dikirim');
        daftarBaggingAktif.value = baggingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) { console.error('Gagal muat Sewing > Perlu Dikirim:', e); daftar.value = []; daftarBaggingAktif.value = []; }
      memuat.value = false;
    }

    // Cetak Label Pcs (keputusan #6: sekali cetak, cetak ulang membaca dokumen
    // yang sudah ada, tanpa addDoc).
    const popupCetakPcsAktif = ref(false);
    const daftarLabelPcsPreview = ref([]);
    async function cetakLabelPcs(t) {
      if (t.label_pcs_dicetak_pada) {
        try {
          const snap = await getDocs(query(collection(db, 'label_pcs'), where('batch_id', '==', t.id)));
          const existing = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          daftarLabelPcsPreview.value = existing.map(l => ({ kode: l.kode_pcs, nama: l.nama_produk, info: `${l.sku_produk || '-'} &middot; ${l.size || '-'} &middot; ${l.warna || '-'} &middot; ${t.kode_batch}`, qrDataUrl: buatQrDataUrl(l.kode_pcs) }));
          popupCetakPcsAktif.value = true;
        } catch (e) { console.error('Gagal ambil ulang label pcs:', e); alert('Gagal memuat label yang sudah dicetak.'); }
        return;
      }
      const qty = Math.max(0, parseInt(t.qty) || 0);
      if (qty <= 0) { alert('Qty batch ini 0/tidak valid — tidak bisa cetak label pcs.'); return; }
      sedangProses.value = true;
      try {
        const preview = [];
        for (let i = 0; i < qty; i++) {
          const kodePcs = await generateKodeHarianFormat('PCS', 'pengaturan_id_label_pcs');
          await addDoc(collection(db, 'label_pcs'), {
            kode_pcs: kodePcs, batch_id: t.id, kode_batch: t.kode_batch || '', sku_produk: t.sku_produk || '',
            nama_produk: t.nama_produk || '', size: t.size || '', warna: t.warna || '',
            status: 'dicetak', order_spk_id: null, gudang_masuk_pada: null, terjual_pada: null, transaksi_kasir_id: null,
            dibuat_pada: serverTimestamp()
          });
          preview.push({ kode: kodePcs, nama: t.nama_produk, info: `${t.sku_produk || '-'} &middot; ${t.size || '-'} &middot; ${t.warna || '-'} &middot; ${t.kode_batch}`, qrDataUrl: buatQrDataUrl(kodePcs) });
        }
        await updateSewingTrack(t.id, () => ({ label_pcs_dicetak_pada: new Date().toISOString() }));
        daftarLabelPcsPreview.value = preview;
        popupCetakPcsAktif.value = true;
        await muat();
      } catch (e) { console.error('Gagal cetak label pcs:', e); alert('Gagal mencetak. Coba lagi.'); }
      sedangProses.value = false;
    }

    // Cetak Bagging + Kode Tugas (1 aksi gabungan, keputusan #11/#12)
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    async function cetakBaggingTugas(t) {
      if (!t.label_pcs_dicetak_pada) { alert('Cetak Label Pcs dulu sebelum cetak bagging + kode tugas.'); return; }
      if (t.kode_bagging && t.kode_bagging.length) { if (!confirm('Batch ini sudah pernah dicetak bagging + kode tugas. Cetak ULANG (kode baru)?')) return; }
      sedangProses.value = true;
      try {
        const kodeBag = await generateKodeHarianFormat('BAG', 'pengaturan_id_bagging');
        // kode_spk/kode_batch ditulis LANGSUNG saat dibuat (bukan lewat
        // validator scan pertama seperti Persiapan) — batch di sini SUDAH pasti
        // tunggal (layar terkunci ke 1 batch sejak awal), tidak mungkin campur
        // lewat UI ini.
        await addDoc(collection(db, 'bagging'), {
          kode: kodeBag, produk_label: `${t.kode_batch} &middot; ${t.nama_produk}`, isi: [], ditutup_pada: null,
          kode_spk: t.kode_spk || [], kode_batch: t.kode_batch || null,
          dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
        });
        const kodeTugas = await generateKodeHarianFormat('TGS', 'pengaturan_id_tugas_kirim');
        await addDoc(collection(db, 'tugas_kirim'), {
          kode: kodeTugas, tlc_asal: TLC_ASAL_SEWING, tlc_tujuan: TLC_TUJUAN_SERIE, pack: [],
          dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
        });
        await updateSewingTrack(t.id, () => ({ kode_bagging: [kodeBag], kode_tugas: kodeTugas }));
        daftarLabelPreview.value = [
          { kode: kodeBag, nama: 'Kode Bagging', info: `${t.kode_batch} &middot; ${t.nama_produk}`, qrDataUrl: buatQrDataUrl(kodeBag) },
          { kode: kodeTugas, nama: 'Kode Tugas — Serie', info: `TLC-JHT &rarr; TLC-SER &middot; ${t.kode_batch}`, qrDataUrl: buatQrDataUrl(kodeTugas) }
        ];
        popupCetakAktif.value = true;
        await muat();
      } catch (e) { console.error('Gagal cetak bagging + kode tugas Sewing:', e); alert('Gagal mencetak. Coba lagi.'); }
      sedangProses.value = false;
    }

    // Scan Pack: step1 kode bagging, step2 kode pcs berkali-kali
    const modalPack = reactive({ aktif: false, bagging: null, batch: null, log: [] });
    function bukaScanPack() { modalPack.bagging = null; modalPack.batch = null; modalPack.log = []; modalPack.aktif = true; }
    function tutupScanPack() { modalPack.aktif = false; modalPack.bagging = null; modalPack.batch = null; modalPack.log = []; muat(); }
    async function hasilScanPack(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      if (!modalPack.bagging) {
        const b = daftarBaggingAktif.value.find(x => x.kode === kode);
        if (!b) { alert(`Kode bagging "${kode}" tidak ditemukan atau sudah ditutup.`); return; }
        const t = daftar.value.find(x => (x.kode_bagging || []).includes(kode));
        if (!t) { alert(`Kode bagging "${kode}" tidak terkait batch manapun di tab ini.`); return; }
        modalPack.bagging = b; modalPack.batch = t;
        return;
      }
      try {
        const snap = await getDocs(query(collection(db, 'label_pcs'), where('batch_id', '==', modalPack.batch.id), where('kode_pcs', '==', kode)));
        if (snap.empty) { alert(`Kode pcs "${kode}" tidak ditemukan di batch ${modalPack.batch.kode_batch}.`); return; }
        await updateDoc(doc(db, 'bagging', modalPack.bagging.id), { isi: arrayUnion(kode) });
        modalPack.log.unshift(kode + ' -> ' + modalPack.bagging.kode);
      } catch (e) { console.error('Gagal scan pack Sewing:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }
    async function tutupBaggingPack() {
      if (!modalPack.bagging) return;
      try {
        await updateDoc(doc(db, 'bagging', modalPack.bagging.id), { ditutup_pada: serverTimestamp() });
        // riwayat_scan ditulis ADITIF. qty dihitung dari log sesi ini yang
        // cocok kode bagging ini saja (modalPack.log bisa memuat scan bagging
        // lain kalau operator ganti bagging tanpa menutup modal), bukan dari
        // .isi dokumen bagging yang salinan lokalnya tidak ikut arrayUnion.
        if (modalPack.batch) {
          const kodeBaggingIni = modalPack.bagging.kode;
          const qtyPack = modalPack.log.filter(l => l.endsWith(' -> ' + kodeBaggingIni)).length || null;
          await updateSewingTrack(modalPack.batch.id, () => ({
            riwayat_scan: arrayUnion({ aksi: 'pack', oleh: window.currentUser?.email || null, pada: new Date().toISOString(), qty: qtyPack, catatan: kodeBaggingIni })
          }));
        }
      } catch (e) { console.error('Gagal tutup bagging:', e); alert('Gagal menutup bagging. Coba lagi.'); }
      modalPack.bagging = null; modalPack.batch = null;
    }

    // Scan Kirim: step1 kode tugas, step2 kode bagging (1x cukup, lihat
    // keputusan #11 — satu batch = satu bagging).
    const modalKirim = reactive({ aktif: false, tugas: null, log: [] });
    function bukaScanKirim() { modalKirim.tugas = null; modalKirim.log = []; modalKirim.aktif = true; }
    function tutupScanKirim() { modalKirim.aktif = false; modalKirim.tugas = null; modalKirim.log = []; muat(); }
    async function hasilScanKirim(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      if (!modalKirim.tugas) {
        try {
          const snap = await getDocs(query(collection(db, 'tugas_kirim'), where('kode', '==', kode)));
          if (snap.empty) { alert(`Kode tugas "${kode}" tidak ditemukan.`); return; }
          modalKirim.tugas = { id: snap.docs[0].id, ...snap.docs[0].data() };
        } catch (e) { console.error('Gagal cari kode tugas:', e); alert('Gagal mencari kode tugas. Coba lagi.'); }
        return;
      }
      const t = daftar.value.find(x => x.kode_tugas === modalKirim.tugas.kode && (x.kode_bagging || []).includes(kode));
      if (!t) { alert(`Kode bagging "${kode}" tidak cocok dengan tugas ini.`); return; }
      try {
        const now = new Date().toISOString();
        // kode_spk/kode_batch ikut disalin ke pack[], dilepas oleh Scan
        // Sampai (sampai_pada).
        await updateDoc(doc(db, 'tugas_kirim', modalKirim.tugas.id), {
          pack: arrayUnion({ kode_bagging: kode, kode_spk: t.kode_spk || [], kode_batch: t.kode_batch || null, pada: now, sampai_pada: null })
        });
        // riwayat_scan ditulis ADITIF.
        await updateSewingTrack(t.id, () => ({
          status: 'sedang_dikirim', masuk_tahap_pada: now,
          riwayat_scan: arrayUnion({ aksi: 'kirim', oleh: window.currentUser?.email || null, pada: now, qty: t.qty ?? null, catatan: 'Kirim ke Serie — kode tugas ' + modalKirim.tugas.kode })
        }));
        modalKirim.log.unshift(kode + ' -> ' + modalKirim.tugas.kode + ' (status pindah ke Sedang Kirim)');
        await muat();
      } catch (e) { console.error('Gagal scan kirim Sewing:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahSewing(p.target, p.jumlah, p.alasan);
      await muat();
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return { muat,
      memuat, daftar, bolehProses, bolehCetak, sedangProses, formatQty, formatDiamSejak, tertahan,
      popupCetakPcsAktif, daftarLabelPcsPreview, cetakLabelPcs,
      popupCetakAktif, daftarLabelPreview, cetakBaggingTugas,
      modalPack, bukaScanPack, tutupScanPack, hasilScanPack, tutupBaggingPack,
      modalKirim, bukaScanKirim, tutupScanKirim, hasilScanKirim,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div v-if="bolehProses" style="display:flex; gap:8px; margin-bottom:12px;">
        <button @click="bukaScanPack" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Pack</button>
        <button @click="bukaScanKirim" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-paper-plane" style="margin-right:6px;"></i>Scan Kirim</button>
      </div>
      <div v-if="daftar.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-box-open"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada batch yang perlu dikirim</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="t in daftar" :key="t.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ t.kode_batch }}</div>
            <span class="tag" :class="tertahan(t.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(t.masuk_tahap_pada) }}</span>
          </div>
          <div style="font-size:12px; color:var(--text-faint); margin-bottom:6px;">{{ t.nama_produk }} &middot; size {{ t.size || '-' }} &middot; warna {{ t.warna || '-' }} &middot; qty {{ formatQty(t.qty) }}</div>
          <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:10px; display:flex; gap:6px; flex-wrap:wrap;">
            <span class="tag" :class="t.label_pcs_dicetak_pada ? 'ok' : 'neutral'">{{ t.label_pcs_dicetak_pada ? 'label pcs dicetak' : 'label pcs belum dicetak' }}</span>
            <span v-if="t.kode_tugas" class="tag ok">{{ t.kode_tugas }} &rarr; Serie</span>
            <span v-else class="tag neutral">belum dicetak bagging/kode tugas</span>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button v-if="bolehCetak" @click="cetakLabelPcs(t)" :disabled="sedangProses" class="btn-outline" style="flex:1; min-width:150px; padding:8px; font-size:11.5px;"><i class="fas fa-print" style="margin-right:4px;"></i>{{ t.label_pcs_dicetak_pada ? 'Cetak Ulang Label Pcs' : 'Cetak Label Pcs' }}</button>
            <button v-if="bolehCetak" @click="cetakBaggingTugas(t)" :disabled="sedangProses" class="btn-outline" style="flex:1; min-width:170px; padding:8px; font-size:11.5px;"><i class="fas fa-print" style="margin-right:4px;"></i>Cetak Bagging + Kode Tugas</button>
            <button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="flex:1; min-width:120px; padding:8px; font-size:11.5px; color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
          </div>
        </div>
      </div>
    </template>

    <popup-pratinjau-cetak-label :terbuka="popupCetakPcsAktif" judul="Cetak Label Pcs" :daftar-label="daftarLabelPcsPreview" jenis-cetak="label_pcs_sewing" @tutup="popupCetakPcsAktif = false" />
    <!--
      jenis-cetak dipatok 'kode_bagging' — lihat catatan sama di vue-pp-cutting.js (cetak gabungan
      bagging+tugas 1 job cetak).
    -->
    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Bagging + Kode Tugas" :daftar-label="daftarLabelPreview" jenis-cetak="kode_bagging" @tutup="popupCetakAktif = false" />

    <scan-generik :aktif="modalPack.aktif" :judul="modalPack.bagging ? ('Scan kode pcs — bagging ' + modalPack.bagging.kode) : 'Scan Kode Bagging'" subjudul="Bisa discan berkali-kali. Tutup lewat tombol di bawah kalau sudah selesai." @hasil="hasilScanPack" @tutup="tutupScanPack" />
    <div v-if="modalPack.aktif && modalPack.bagging" style="position:fixed; left:16px; bottom:16px; z-index:10001; display:flex; flex-direction:column; gap:8px; max-width:260px;">
      <button @click="tutupBaggingPack" class="btn-primary" style="padding:8px 14px; font-size:11px;">Tutup Bagging Ini</button>
      <div style="background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px;"><div v-for="(l,i) in modalPack.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div></div>
    </div>

    <scan-generik :aktif="modalKirim.aktif" :judul="modalKirim.tugas ? ('Scan kode bagging — tugas ' + modalKirim.tugas.kode) : 'Scan Kode Tugas'" subjudul="Satu batch = satu kode bagging." @hasil="hasilScanKirim" @tutup="tutupScanKirim" />
    <div v-if="modalKirim.aktif && modalKirim.tugas && modalKirim.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:280px;">
      <div v-for="(l,i) in modalKirim.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.target.kode_batch }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. label pcs salah cetak"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};


// TAB 3.4: Sedang Kirim — read-only tracking, dikelompokkan per kode tugas
// (mirip CuttingSedangDiKirim), + Scan Masalah (keputusan #10).

const SewingSedangKirim = {
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const menuId = 'proses_sewing';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try { daftar.value = (await muatSemuaSewingTrack()).filter(t => t.status === 'sedang_dikirim'); }
      catch (e) { console.error('Gagal muat Sewing > Sedang Kirim:', e); daftar.value = []; }
      memuat.value = false;
    }

    const kelompokTugas = computed(() => {
      const peta = {};
      daftar.value.forEach(t => {
        const key = t.kode_tugas || '(tanpa kode tugas)';
        if (!peta[key]) peta[key] = { kodeTugas: key, daftar: [] };
        peta[key].daftar.push(t);
      });
      return Object.values(peta);
    });

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahSewing(p.target, p.jumlah, p.alasan);
      await muat();
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return { muat, memuat, kelompokTugas, bolehProses, formatQty, formatDiamSejak, tertahan, popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div v-if="kelompokTugas.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-truck-fast"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang sedang dikirim</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="g in kelompokTugas" :key="g.kodeTugas" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
          <div class="gc-heading" style="font-weight:700; font-size:12.5px; margin-bottom:8px;">{{ g.kodeTugas }} &rarr; Serie</div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div v-for="t in g.daftar" :key="t.id" style="display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:11px; padding:6px 8px; border-radius:10px;" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : 'transparent' }">
              <span class="gc-num" style="font-weight:700;">{{ t.kode_batch }}</span>
              <span style="color:var(--text-faint);">{{ t.nama_produk }} size {{ t.size || '-' }}</span>
              <span class="gc-num" style="color:var(--text-faint);">diam {{ formatDiamSejak(t.masuk_tahap_pada) }}</span>
              <button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="padding:4px 8px; font-size:10px; color:var(--danger);"><i class="fas fa-triangle-exclamation"></i></button>
            </div>
          </div>
        </div>
      </div>
      <div style="margin-top:10px; font-size:10.5px; color:var(--text-faint); text-align:center;">Tab ini read-only — baris pindah ke Selesai otomatis begitu Serie melakukan Scan Sampai (Tab 2.6 Terima Sewing, modul Serie).</div>
    </template>

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.target.kode_batch }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. bagging rusak dalam perjalanan"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};


// TAB 3.5: Selesai — riwayat, read-only. Baris masuk saat Serie (Tab 2.6 Terima
// Sewing) Scan Sampai dan menulis `sewing_track.status = 'selesai'` +
// `sampai_pada` (keputusan #1). Serie sudah bisa menulis itu, jadi baris muncul
// begitu siklus pertama selesai.

const SewingSelesai = {
  setup() {
    const memuat = ref(true);
    const semuaSelesai = ref([]);
    const kataKunci = ref('');
    const dariTanggal = ref('');
    const sampaiTanggal = ref('');

    async function muat() {
      memuat.value = true;
      try { semuaSelesai.value = (await muatSemuaSewingTrack()).filter(t => t.status === 'selesai').sort((a, b) => new Date(b.sampai_pada || 0) - new Date(a.sampai_pada || 0)); }
      catch (e) { console.error('Gagal muat Sewing > Selesai:', e); semuaSelesai.value = []; }
      memuat.value = false;
    }

    const selesaiHariIni = computed(() => semuaSelesai.value.filter(t => hariIniSama(t.sampai_pada)));

    const daftarUrut = computed(() => {
      let hasil = semuaSelesai.value;
      const kata = kataKunci.value.trim().toLowerCase();
      if (kata) hasil = hasil.filter(t => (t.kode_batch || '').toLowerCase().includes(kata) || (t.nama_produk || '').toLowerCase().includes(kata));
      if (dariTanggal.value) hasil = hasil.filter(t => t.sampai_pada && new Date(t.sampai_pada) >= new Date(dariTanggal.value));
      if (sampaiTanggal.value) hasil = hasil.filter(t => t.sampai_pada && new Date(t.sampai_pada) <= new Date(sampaiTanggal.value + 'T23:59:59'));
      return hasil;
    });

    function unduhCsv() {
      if (!daftarUrut.value.length) { alert('Tidak ada data untuk diunduh.'); return; }
      const header = ['Kode Batch', 'Produk', 'Size', 'Warna', 'Qty', 'Operator', 'Kode Tugas', 'Selesai Pada'];
      const baris = daftarUrut.value.map(t => [t.kode_batch, t.nama_produk, t.size, t.warna, t.qty, t.operator_nama, t.kode_tugas, formatWaktu(t.sampai_pada)]);
      const csv = [header, ...baris].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `sewing-selesai-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    onMounted(async () => { await window.authReady; await muat(); });

    return { muat, memuat, daftarUrut, selesaiHariIni, kataKunci, dariTanggal, sampaiTanggal, unduhCsv, formatQty, formatWaktu };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div class="gc-card" style="padding:12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <div style="font-size:12px; color:var(--text-faint);">Selesai hari ini</div>
        <div class="gc-num" style="font-weight:700; font-size:16px;">{{ selesaiHariIni.length }}</div>
      </div>
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <input v-model="kataKunci" type="text" placeholder="Cari kode batch / produk..." style="flex:2; min-width:160px; padding:8px; background:var(--ivory-dim); border-radius:10px; border:1px solid var(--line);">
        <input v-model="dariTanggal" type="date" style="flex:1; min-width:130px; padding:8px; border-radius:10px; border:1px solid var(--line);">
        <input v-model="sampaiTanggal" type="date" style="flex:1; min-width:130px; padding:8px; border-radius:10px; border:1px solid var(--line);">
        <button @click="unduhCsv" class="btn-outline" style="padding:8px 14px; font-size:11.5px;"><i class="fas fa-download" style="margin-right:6px;"></i>Unduh CSV</button>
      </div>

      <div v-if="daftarUrut.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-circle-check"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada riwayat Selesai</h3>
        <p style="font-size:11px; color:var(--text-faint); margin-top:6px;">Tab ini terisi otomatis begitu Serie melakukan Scan Sampai di Tab 2.6 "Terima Sewing" — bukan error.</p>
      </div>
      <div v-else class="gc-card" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead><tr style="text-align:left; border-bottom:1px solid var(--line);">
            <th style="padding:6px 8px;">Kode Batch</th><th style="padding:6px 8px;">Produk</th><th style="padding:6px 8px;">Qty</th>
            <th style="padding:6px 8px;">Operator</th><th style="padding:6px 8px;">Kode Tugas</th><th style="padding:6px 8px;">Selesai</th>
          </tr></thead>
          <tbody>
            <tr v-for="t in daftarUrut" :key="t.id" style="border-bottom:1px solid var(--line);">
              <td style="padding:6px 8px;" class="gc-num">{{ t.kode_batch }}</td>
              <td style="padding:6px 8px;">{{ t.nama_produk }} {{ t.size }} {{ t.warna }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatQty(t.qty) }}</td>
              <td style="padding:6px 8px;">{{ t.operator_nama || '-' }}</td>
              <td style="padding:6px 8px;">{{ t.kode_tugas || '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatWaktu(t.sampai_pada) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  `
};

// Mount ke index.html — LAZY, SAMA pola seperti Cutting/Serie: fungsi
// window.pastikanMountSewingXxx dipanggil oleh pindahSubTab (js/ dashboard.js,
// peta petaMount) PERTAMA KALI tab itu dibuka.
let vmSewingPerluDiProses = null;
window.pastikanMountSewingPerluDiProses = function () {
  if (vmSewingPerluDiProses) { if (typeof vmSewingPerluDiProses.muat === 'function') vmSewingPerluDiProses.muat(); return; }
  const mountPoint = document.getElementById('vue-sewing-perludiproses');
  if (mountPoint) vmSewingPerluDiProses = createApp(SewingPerluDiProses).mount('#vue-sewing-perludiproses');
};
let vmSewingSedangSewing = null;
window.pastikanMountSewingSedangSewing = function () {
  if (vmSewingSedangSewing) { if (typeof vmSewingSedangSewing.muat === 'function') vmSewingSedangSewing.muat(); return; }
  const mountPoint = document.getElementById('vue-sewing-sedangsewing');
  if (mountPoint) vmSewingSedangSewing = createApp(SewingSedangSewing).mount('#vue-sewing-sedangsewing');
};
let vmSewingPerluDikirim = null;
window.pastikanMountSewingPerluDikirim = function () {
  if (vmSewingPerluDikirim) { if (typeof vmSewingPerluDikirim.muat === 'function') vmSewingPerluDikirim.muat(); return; }
  const mountPoint = document.getElementById('vue-sewing-perludikirim');
  if (mountPoint) vmSewingPerluDikirim = createApp(SewingPerluDikirim).mount('#vue-sewing-perludikirim');
};
let vmSewingSedangKirim = null;
window.pastikanMountSewingSedangKirim = function () {
  if (vmSewingSedangKirim) { if (typeof vmSewingSedangKirim.muat === 'function') vmSewingSedangKirim.muat(); return; }
  const mountPoint = document.getElementById('vue-sewing-sedangkirim');
  if (mountPoint) vmSewingSedangKirim = createApp(SewingSedangKirim).mount('#vue-sewing-sedangkirim');
};
let vmSewingSelesai = null;
window.pastikanMountSewingSelesai = function () {
  if (vmSewingSelesai) { if (typeof vmSewingSelesai.muat === 'function') vmSewingSelesai.muat(); return; }
  const mountPoint = document.getElementById('vue-sewing-selesai');
  if (mountPoint) vmSewingSelesai = createApp(SewingSelesai).mount('#vue-sewing-selesai');
};
