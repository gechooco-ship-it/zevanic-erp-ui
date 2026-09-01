// js/vue-persiapan-finishing.js
// ============================================================================
// Persiapan Produksi > Acc Finishing — menu BARU (1 Sep 2026, wireframe
// handoff "Persiapan Produksi - Acc Finishing", modul ke-5 (terakhir) dari
// paket F:\ZEVANIC HOUSE\FOUNDATION\Mockup\handoff\). Dikerjakan BERSAMA Acc
// Sewing & Acc Webbing dalam satu sesi atas instruksi eksplisit Guru (1 Sep
// 2026) — MENYIMPANG dari aturan "satu modul per sesi, urutan tidak boleh
// dibalik" yang ditulis README paket handoff. Guru sudah diberi tahu soal
// penyimpangan ini (lihat STATUS-PROYEK.md). File ini MENUMPANG POLA js/
// vue-persiapan-sewing.js (dikerjakan lebih dulu dalam sesi yang sama) —
// SAMA PERSIS strukturnya, baca komentar besar di file itu untuk detail
// alasan arsitektur yang tidak diulang di sini. Bagian di bawah ini HANYA
// menyoroti yang BEDA khas pos Finishing.
//
// Pos yang menyiapkan BARANG CETAK DAN KEMASAN — hangtag, label merek, kartu
// ukuran, polybag. Satuannya pcs, qty-nya hampir selalu 1 per pcs produk.
// Yang menahan di pos ini BUKAN hitungan, tapi KETERSEDIAAN CETAKAN — dua
// kolom khas: varian & keadaan cetak.
//
// ARSITEKTUR DATA — PENTING, baca dulu sebelum ubah apapun di sini:
//
// SERAH-TERIMA.md modul ini menyebut koleksi `persiapan_komponen` sebagai
// sumber datanya ("sudah ada di repo"). ITU SUDAH TIDAK BENAR — koleksi itu
// DITINGGALKAN Guru 29 Agt 2026 tanpa migrasi (lihat komentar besar di
// js/vue-order-spk.js sekitar baris ~91-103, dan catatan arsitektur di js/
// vue-persiapan-bahan.js). Sudah diverifikasi ke kode live sebelum modul ini
// ditulis — BUKAN tebakan (dicek ulang lagi 1 Sep 2026, sesi ini).
//
// Yang benar-benar dipakai: `spk_track` (1 dokumen per SPK Grouping per
// jalur, dibuat js/vue-persiapan-produksi-v2.js function
// buatSpkTrackUntukGrouping()). Dokumen jalur:'finishing' punya field
// TAMBAHAN `finishing_rincian[]` (diisi function hitungFinishingRincian() di
// file itu SAAT SPK Grouping diterbitkan) — SATU BARIS per (komponen
// aksesoris x anak SPK), sumber BOM-nya `master_produk.bom_aksesoris[]`
// disaring tahap_proses mengandung "finishing":
//   order_spk_id, no_spk, qty, bahan_aksesoris_id, nama_aksesoris, warna,
//   produk_size, qty_per_pcs, satuan, butuh, status, masuk_tahap_pada,
//   label_cetak_pada, operator_uid, operator_nama, ditugaskan_pada,
//   riwayat_operator[], entry_qty, entry_oleh, entry_pada, catatan_masalah,
//   kode_bagging, kode_tugas, tlc_tujuan (ditulis saat Scan Kirim, lihat Tab
//   3), sampai_pada (ditulis MODUL LAIN, lihat catatan TAB 5 di bawah),
//   + KHAS POS INI: varian_tipe/varian_jumlah (default 'tunggal'/1 SAAT
//   GENERATE — lihat KEPUTUSAN di bawah).
//
// KEPUTUSAN (Yang Belum Diputuskan §7 SERAH-TERIMA — belum dijawab Guru,
// dipilih default paling aman dulu, BUKAN final, tanyakan Guru kalau mau
// diubah):
//   - varian_tipe/varian_jumlah default 'tunggal'/1 — BOM Aksesoris (js/
//     vue-master-produk.js) TIDAK (belum) punya field pemisah varian per
//     warna/size, jadi satu baris BOM dianggap satu varian tunggal sampai
//     Guru menjawab §7 dan field varian ditambah ke BOM Aksesoris.
//   - keadaan_cetak/sisa_dicetak (SERAH-TERIMA §2/§3: "sisa … dicetak" bukan
//     "kurang") SENGAJA TIDAK disimpan statis di rincian (bisa basi begitu
//     stok berubah) — dihitung LIVE di kelompokKartuSpk() dari stok terkini
//     vs `butuh`, SAMA pola seperti cek cukup/kurang Bahan & Sewing. Kartu
//     di sini pakai label "sisa X dicetak" (bukan tag "stok kurang" polos
//     seperti Sewing/Webbing) — lihat Tab 1 template.
//   - "Menunggu cetakan jadi alur sendiri atau lewat Persiapan Masalah
//     seperti biasa" & "kekurangan 1 warna hangtag menahan seluruh SPK atau
//     cuma baris itu" — BELUM diputuskan Guru, file ini TIDAK membangun alur
//     baru apapun untuk itu (baris kurang tetap lewat mekanisme "Masalah"
//     yang sudah ada, sama seperti Sewing/Webbing, sampai Guru memutuskan).
//
// PERBEDAAN KARTU dari Bahan — PENTING: Bahan "satu kartu satu bahan+warna"
// (kartu dikumpulkan LINTAS dokumen spk_track). Pos ini SEBALIKNYA: "satu
// kartu satu SPK Grouping" (SERAH-TERIMA §2) — kartu = SATU dokumen
// spk_track itu sendiri (kode kartu berakhiran -FIN), isinya baris-baris
// komponennya. Konsekuensinya: TIDAK ada "kumulatif butuh/stok lintas
// grouping" seperti Bahan — cek stok cukup dilakukan PER BARIS independen
// terhadap stok live (lihat kelompokKartuSpk()).
//
// Label fisik: "1 SPK = 1 label" (SERAH-TERIMA §3/§5) dibaca sebagai 1 LABEL
// PER ANAK SPK (bukan per grouping) — sama alasan seperti vue-persiapan-
// sewing.js. Kode yang di-QR-kan cuma jejak cetak (traceability) — yang
// benar-benar DISCAN BALIK di Tunjuk Operator/Scan Entry/Scan Pack selalu
// `no_spk` polos.
//
// Satu scan pack/kirim di sini BISA menandai BEBERAPA baris komponen
// sekaligus (semua komponen milik 1 anak SPK, atau semua baris ber-
// kode_bagging sama) — sama pola vue-persiapan-sewing.js, lihat
// updateBarisFinishingMassal() di bawah.
//
// Koleksi bagging/tugas_kirim/master_tlc/cetak_ulang_log — SUDAH ADA di
// repo (ditambahkan modul Bahan, 31 Agt 2026), DIPAKAI ULANG APA ADANYA
// (generik lintas jalur, TIDAK perlu tambahan firestore.rules baru).
// tlc_asal pos ini = 'TLC-FIN' (sudah ada di daftar seed TLC bawaan Bahan).
//
// Print label, scan QR, kode harian, ambang tertahan, PIN cetak ulang,
// estafet operator — SEMUA pola SAMA PERSIS seperti vue-persiapan-bahan.js/
// vue-persiapan-sewing.js (disalin, konvensi "salin logic kecil per-file"
// proyek ini).
// ============================================================================

import { createApp, ref, reactive, computed, watch, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel } from './vue-components.js?v=5';

// --- Konfigurasi khas pos ini (SATU-SATUNYA tempat yang beda antara file
// Sewing/Webbing/Finishing untuk bagian generik — field tambahan khas
// masing-masing pos ditangani terpisah di komponennya sendiri). -----------
const JALUR = 'finishing';
const FIELD_RINCIAN = 'finishing_rincian';
const SUFFIX_LABEL = 'FIN';
const TLC_ASAL = 'TLC-FIN';
const MENU_ID = 'pp_finishing';
const ICON_KOSONG = 'fa-check-double';

// --- Format & hitung kecil --------------------------------------------------
function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
const AMBANG_TERTAHAN_JAM = 6; // keputusan Guru, 31 Agt 2026 — sama semua tab/pos
function jamSejak(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return ms / 3600000;
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
function formatWaktu(iso) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return '-'; }
}
function hariIniSama(iso) {
  if (!iso) return false;
  const d = new Date(iso), now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
function siklusJam(b) {
  if (!b.label_cetak_pada || !b.sampai_pada) return null;
  return (new Date(b.sampai_pada).getTime() - new Date(b.label_cetak_pada).getTime()) / 3600000;
}
function formatSiklus(jam) {
  if (jam === null || jam === undefined || isNaN(jam)) return '-';
  if (jam < 1) return Math.max(1, Math.round(jam * 60)) + ' menit';
  return jam.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jam';
}

// --- QR: generate & baca — DISALIN dari vue-persiapan-bahan.js. ------------
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
function muatJsQr() {
  return new Promise((resolve, reject) => {
    if (window.jsQR) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
async function cariKaryawanByQr(qrData) {
  const qSnap = await getDocs(query(collection(db, 'users'), where('id_app', '==', qrData)));
  if (!qSnap.empty) return { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
  const docSnap = await getDoc(doc(db, 'users', qrData));
  if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
  return null;
}

// --- Kode harian berurut (bagging/tugas kirim) — SAMA fungsi persis dengan
// vue-persiapan-bahan.js (counter doc dibagi lintas pos dengan sengaja,
// supaya kode BAG/TGS tetap unik global, bukan cuma unik per pos). --------
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

// --- Baca & ratakan spk_track jalur='sewing' --------------------------------
async function muatSemuaTrackFinishing() {
  const snap = await getDocs(query(collection(db, 'spk_track'), where('jalur', '==', JALUR)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
function daftarBarisDariTrack(daftarTrack) {
  const baris = [];
  daftarTrack.forEach(t => {
    (t[FIELD_RINCIAN] || []).forEach((b, idx) => {
      baris.push({ ...b, _trackId: t.id, _lineIdx: idx, kode_spk: t.kode_spk, grouping_id: t.grouping_id, nama_produk: t.nama_produk });
    });
  });
  return baris;
}
function barisKey(b) { return b._trackId + '::' + b._lineIdx; }

// updateBarisFinishing — read-modify-write ATOMIK 1 baris (dipilih lewat
// index), SAMA pola seperti updateBarisBahan() di vue-persiapan-bahan.js.
// Dipakai aksi yang menyentuh SATU baris komponen (Tunjuk 1-per-1 kalau
// sudah dipisah, entry, masalah, ganti operator).
async function updateBarisFinishing(trackId, lineIdx, patchFn) {
  const refTrack = doc(db, 'spk_track', trackId);
  await runTransaction(db, async (trx) => {
    const snap = await trx.get(refTrack);
    if (!snap.exists()) throw new Error('SPK Track tidak ditemukan (mungkin sudah dihapus).');
    const arr = Array.isArray(snap.data()[FIELD_RINCIAN]) ? [...snap.data()[FIELD_RINCIAN]] : [];
    if (!arr[lineIdx]) throw new Error('Baris komponen tidak ditemukan — coba muat ulang halaman.');
    arr[lineIdx] = { ...arr[lineIdx], ...patchFn(arr[lineIdx]) };
    trx.update(refTrack, { [FIELD_RINCIAN]: arr, diperbarui_pada: serverTimestamp() });
  });
}
// updateBarisFinishingMassal — BARU (beda dari Bahan): patch SEMUA elemen
// array yang lolos matchFn() dalam SATU transaksi. Diperlukan karena "1
// kartu = 1 SPK Grouping" (bukan 1 kartu = 1 bahan+warna macam Bahan): 1
// scan Tunjuk/Pack/Kirim di sini bisa menandai BEBERAPA baris komponen
// sekaligus (semua komponen milik 1 anak SPK, atau semua baris ber-
// kode_bagging sama) — SATU dokumen, banyak baris kena sekaligus.
async function updateBarisFinishingMassal(trackId, matchFn, patchFn) {
  const refTrack = doc(db, 'spk_track', trackId);
  let kena = 0;
  await runTransaction(db, async (trx) => {
    const snap = await trx.get(refTrack);
    if (!snap.exists()) throw new Error('SPK Track tidak ditemukan (mungkin sudah dihapus).');
    const arr = Array.isArray(snap.data()[FIELD_RINCIAN]) ? [...snap.data()[FIELD_RINCIAN]] : [];
    for (let i = 0; i < arr.length; i++) {
      if (matchFn(arr[i])) { arr[i] = { ...arr[i], ...patchFn(arr[i]) }; kena++; }
    }
    if (kena === 0) return;
    trx.update(refTrack, { [FIELD_RINCIAN]: arr, diperbarui_pada: serverTimestamp() });
  });
  return kena;
}

// konfirmasiEntry — SATU-SATUNYA tempat stok master_bahan_aksesoris
// berkurang (SERAH-TERIMA §8 uji-terima #3), SAMA pola vue-persiapan-bahan.js.
async function konfirmasiEntry(b) {
  const refTrack = doc(db, 'spk_track', b._trackId);
  const refBahan = doc(db, 'master_bahan_aksesoris', b.bahan_aksesoris_id);
  const now = new Date().toISOString();
  const oleh = window.currentUser?.email || '';
  await runTransaction(db, async (trx) => {
    const [snapTrack, snapBahan] = await Promise.all([trx.get(refTrack), trx.get(refBahan)]);
    if (!snapTrack.exists()) throw new Error('SPK Track tidak ditemukan.');
    const arr = Array.isArray(snapTrack.data()[FIELD_RINCIAN]) ? [...snapTrack.data()[FIELD_RINCIAN]] : [];
    if (!arr[b._lineIdx]) throw new Error('Baris sudah berubah — muat ulang halaman.');
    arr[b._lineIdx] = {
      ...arr[b._lineIdx],
      status: 'perlu_dikirim', masuk_tahap_pada: now,
      entry_qty: arr[b._lineIdx].butuh, entry_oleh: oleh, entry_pada: now
    };
    trx.update(refTrack, { [FIELD_RINCIAN]: arr, diperbarui_pada: serverTimestamp() });
    if (snapBahan.exists()) {
      const stokBaru = (parseFloat(snapBahan.data().stok_akhir) || 0) - (parseFloat(b.butuh) || 0);
      trx.update(refBahan, { stok_akhir: stokBaru });
    }
  });
}

// kelompokKartuSpk — kelompokkan baris (SUDAH difilter status tertentu) jadi
// kartu per SPK TRACK (= per SPK Grouping, SERAH-TERIMA §2). Beda dari
// kelompokKartuBahan() di vue-persiapan-bahan.js: TIDAK ada alokasi greedy
// lintas kartu (SERAH-TERIMA Finishing tidak menyebut "kumulatif" sebagai
// aturan khas) — tiap baris dicek CUKUP/KURANG independen terhadap stok
// live komponennya sendiri.
function kelompokKartuSpk(barisList, petaStokBahan) {
  const peta = {};
  barisList.forEach(b => {
    const key = b._trackId;
    if (!peta[key]) peta[key] = { trackId: key, kodeSpk: b.kode_spk, namaProduk: b.nama_produk, produkSize: b.produk_size, baris: [] };
    peta[key].baris.push(b);
  });
  const list = Object.values(peta);
  list.forEach(k => {
    k.baris.forEach(b => {
      const info = petaStokBahan[b.bahan_aksesoris_id] || {};
      b._stok = parseFloat(info.stok_akhir) || 0;
      b._rakId = info.rak_id || '';
      b._bisa = b._stok >= (parseFloat(b.butuh) || 0);
      // keadaan_cetak/sisa_dicetak — KHAS POS INI, dihitung LIVE (lihat
      // KEPUTUSAN di komentar besar atas file): "menunggu cetakan", BUKAN
      // "kurang", karena kekurangan barang cetak biasanya cuma menunggu
      // cetakan masuk (SERAH-TERIMA §3).
      b._keadaanCetak = b._bisa ? 'stok_tetap' : 'menunggu_cetakan';
      b._sisaDicetak = b._bisa ? 0 : Math.max(0, (parseFloat(b.butuh) || 0) - b._stok);
    });
    k.adaKurang = k.baris.some(b => !b._bisa);
  });
  list.sort((a, b) => (a.adaKurang === b.adaKurang) ? 0 : (a.adaKurang ? -1 : 1));
  return list;
}

// kunciSepack — "syarat sepack" (SERAH-TERIMA §3 "Aturan khas pos ini"):
// PRODUK dan SIZE sama (beda dari Bahan — di sini komponennya sudah terikat
// SPK, jadi bukan pola dan bahan). Warna & no SPK boleh beda.
function kunciSepack(b) { return `${b.nama_produk}::${b.produk_size}`.toLowerCase(); }
function labelSepack(b) { return `${b.nama_produk} · size ${b.produk_size || '-'}`; }

// --- ModalScanQr — DISALIN utuh dari vue-persiapan-bahan.js. ---------------
const ModalScanQr = {
  props: { aktif: { type: Boolean, default: false }, judul: String, subjudul: String },
  emits: ['hasil', 'tutup'],
  setup(props, { emit }) {
    const videoEl = ref(null), canvasEl = ref(null);
    const memuatKamera = ref(false), error = ref('');
    let stream = null, frameId = null, timeoutId = null;

    async function mulai() {
      memuatKamera.value = true; error.value = '';
      try { await muatJsQr(); } catch (e) {
        error.value = 'Gagal memuat modul pembaca QR. Cek koneksi internet.'; memuatKamera.value = false; return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (videoEl.value) { videoEl.value.srcObject = stream; await videoEl.value.play(); }
        memuatKamera.value = false;
        pindai();
      } catch (e) {
        error.value = 'Gagal mengakses kamera. Pastikan izin kamera diaktifkan.'; memuatKamera.value = false;
      }
    }
    function pindai() {
      if (!stream) return;
      const video = videoEl.value, canvas = canvasEl.value;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const gambar = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const kode = window.jsQR(gambar.data, gambar.width, gambar.height, { inversionAttempts: 'dontInvert' });
        if (kode && kode.data) {
          if (navigator.vibrate) navigator.vibrate(120);
          emit('hasil', kode.data.trim());
          timeoutId = setTimeout(() => { if (stream) pindai(); }, 900);
          return;
        }
      }
      frameId = requestAnimationFrame(pindai);
    }
    function berhenti() {
      if (frameId) { cancelAnimationFrame(frameId); frameId = null; }
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      error.value = '';
    }
    watch(() => props.aktif, (v) => { if (v) mulai(); else berhenti(); });
    onUnmounted(berhenti);
    return { videoEl, canvasEl, memuatKamera, error, tutup: () => emit('tutup') };
  },
  template: `
    <div v-if="aktif" style="position:fixed; inset:0; background:rgba(0,0,0,.85); z-index:10000; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:16px;">
      <div style="width:100%; max-width:340px; aspect-ratio:1/1; background:#111; border-radius:12px; overflow:hidden; position:relative; margin-bottom:16px;">
        <video ref="videoEl" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover;" :class="{ hidden: memuatKamera }"></video>
        <canvas ref="canvasEl" class="hidden"></canvas>
        <div v-if="memuatKamera" style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#C9B4A4; text-align:center; padding:16px;">
          <i class="fas fa-qrcode" style="font-size:36px; margin-bottom:10px;"></i>
          <span v-if="error" style="color:#F2A0A0; font-size:12px;">{{ error }}</span>
          <span v-else style="font-size:12.5px;">Menyiapkan kamera...</span>
        </div>
      </div>
      <p style="color:#fff; font-size:12.5px; margin-bottom:4px; text-align:center; font-weight:700;">{{ judul }}</p>
      <p v-if="subjudul" style="color:#C9B4A4; font-size:11.5px; margin-bottom:14px; text-align:center; max-width:320px;">{{ subjudul }}</p>
      <button @click="tutup" class="btn-outline" style="padding:8px 24px; background:#fff;">Tutup</button>
    </div>
  `
};

// ============================================================================
// TAB 1: Perlu Disiapkan (langkah wireframe 1a -> 1b -> 1c)
// Kartu per SPK Grouping (bukan per bahan seperti Bahan). 1a: cek stok per
// baris + centang baris yang bisa jalan + cetak label (1 label per anak
// SPK). 1b: badge "sudah dicetak" + cetak ulang (PIN+alasan). 1c: penunjukan
// (scan operator + scan berkali-kali label anak SPK — 1 scan anak SPK
// menandai SEMUA baris komponen anak SPK itu sekaligus).
// ============================================================================
const PersiapanFinishingPerluDisiapkan = {
  components: { PopupPratinjauCetakLabel, ModalScanQr },
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const petaStokBahan = ref({});
    const cari = ref('');
    const kartuTerbuka = reactive({});
    const pilihanCetak = reactive({}); // barisKey -> bool (override manual)

    const bolehProses = computed(() => window.cekIzinMenu(MENU_ID, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(MENU_ID, 'print') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const [tracks, stokSnap] = await Promise.all([
          muatSemuaTrackFinishing(),
          getDocs(collection(db, 'master_bahan_aksesoris'))
        ]);
        daftarTrack.value = tracks;
        const peta = {}; stokSnap.forEach(d => { peta[d.id] = d.data(); });
        petaStokBahan.value = peta;
      } catch (e) {
        console.error('Gagal muat Acc Finishing > Perlu Disiapkan:', e);
        daftarTrack.value = [];
      }
      memuat.value = false;
    }

    const kartuList = computed(() => {
      const baris = daftarBarisDariTrack(daftarTrack.value).filter(b => b.status === 'perlu_disiapkan');
      let kartu = kelompokKartuSpk(baris, petaStokBahan.value);
      const kata = cari.value.trim().toLowerCase();
      if (kata) {
        kartu = kartu.filter(k => k.kodeSpk.toLowerCase().includes(kata) || k.namaProduk.toLowerCase().includes(kata) || k.baris.some(b => (b.no_spk || '').toLowerCase().includes(kata)));
      }
      return kartu;
    });

    function toggleKartu(k) { kartuTerbuka[k.trackId] = !kartuTerbuka[k.trackId]; }
    function isChecked(b) {
      const key = barisKey(b);
      if (key in pilihanCetak) return pilihanCetak[key];
      return !!(b._bisa && !b.label_cetak_pada);
    }
    function toggleCheck(b) {
      if (!b._bisa || b.label_cetak_pada) return;
      pilihanCetak[barisKey(b)] = !isChecked(b);
    }

    // --- Cetak label (1a -> 1b): 1 label PER ANAK SPK, seluruh komponen
    // anak SPK itu dirinci di dalamnya (SERAH-TERIMA §5) ---
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    let _pendingCetak = [];
    function cetakLabelKartu(k) {
      if (typeof QRCode === 'undefined') { alert('Library pembuat QR belum siap dimuat. Refresh halaman (Ctrl+Shift+R) lalu ulangi.'); return; }
      const terpilih = k.baris.filter(b => isChecked(b) && b._bisa && !b.label_cetak_pada);
      if (!terpilih.length) { alert('Tidak ada baris yang bisa dicetak (stok belum cukup untuk baris manapun, atau sudah dicetak semua).'); return; }
      const perAnak = {};
      terpilih.forEach(b => { (perAnak[b.no_spk] ||= []).push(b); });
      const preview = Object.entries(perAnak).map(([noSpk, barisGrup]) => ({
        kode: noSpk,
        nama: k.namaProduk,
        info: barisGrup.map(b => `${b.nama_aksesoris} ${b.warna} &middot; ${formatQty(b.butuh)} ${b.satuan}`).join(' | '),
        qrDataUrl: buatQrDataUrl(`${noSpk}-${SUFFIX_LABEL}`)
      }));
      daftarLabelPreview.value = preview;
      _pendingCetak = terpilih;
      popupCetakAktif.value = true;
    }
    async function onCetakSelesai() {
      const now = new Date().toISOString();
      try {
        // 1 aksi cetak bisa mencakup >1 baris DI DOKUMEN YANG SAMA (kartu =
        // 1 dokumen) — cukup 1 updateBarisFinishingMassal per kartu, bukan N
        // transaksi terpisah per baris.
        const byTrack = {};
        _pendingCetak.forEach(b => { (byTrack[b._trackId] ||= []).push(b); });
        await Promise.all(Object.entries(byTrack).map(([trackId, barisGrup]) => {
          const idxSet = new Set(barisGrup.map(b => b._lineIdx));
          return updateBarisFinishingMassal(trackId, (b, i) => idxSet.has(i), () => ({ label_cetak_pada: now }));
        }));
      } catch (e) { console.error('Gagal catat label_cetak_pada:', e); }
      _pendingCetak = [];
      await muat();
    }

    // --- Cetak ulang (PIN + alasan, dicatat cetak_ulang_log) ---
    const popupCetakUlang = ref(null); // { kartu, alasan, pin }
    function bukaCetakUlang(k) {
      if (!k.baris.some(b => b.label_cetak_pada)) return;
      popupCetakUlang.value = { kartu: k, alasan: '', pin: '' };
    }
    async function konfirmasiCetakUlang() {
      const p = popupCetakUlang.value;
      if (!p) return;
      if (!p.alasan.trim()) { alert('Alasan cetak ulang wajib diisi.'); return; }
      if (!p.pin.trim()) { alert('PIN admin wajib diisi.'); return; }
      const sudahDicetak = p.kartu.baris.filter(b => b.label_cetak_pada);
      const perAnak = {};
      sudahDicetak.forEach(b => { (perAnak[b.no_spk] ||= []).push(b); });
      const preview = Object.entries(perAnak).map(([noSpk, barisGrup]) => ({
        kode: noSpk, nama: p.kartu.namaProduk,
        info: 'CETAK ULANG &middot; ' + barisGrup.map(b => `${b.nama_aksesoris} ${b.warna}`).join(' | '),
        qrDataUrl: buatQrDataUrl(`${noSpk}-${SUFFIX_LABEL}`)
      }));
      try {
        await addDoc(collection(db, 'cetak_ulang_log'), {
          kode_spk: p.kartu.kodeSpk,
          bahan: p.kartu.namaProduk,
          alasan: p.alasan.trim(), pin_oleh: window.currentUser?.email || '',
          pada: serverTimestamp()
        });
      } catch (e) { console.error('Gagal catat cetak_ulang_log:', e); }
      daftarLabelPreview.value = preview;
      _pendingCetak = [];
      popupCetakUlang.value = null;
      popupCetakAktif.value = true;
    }

    // --- Penunjukan (1c): scan operator, lalu scan berkali-kali label anak
    // SPK di kartu ini — 1 scan anak SPK menandai SEMUA baris komponennya
    // sekaligus (beda dari Bahan yang 1 baris per anak SPK). ---
    const modalTunjuk = reactive({ aktif: false, kartu: null, operator: null, tahap: 'operator', log: [] });
    function bukaPenunjukan(k) {
      const eligible = k.baris.filter(b => b.label_cetak_pada && b.status === 'perlu_disiapkan');
      if (!eligible.length) { alert('Belum ada baris yang sudah dicetak labelnya di kartu ini.'); return; }
      modalTunjuk.kartu = k; modalTunjuk.operator = null; modalTunjuk.tahap = 'operator'; modalTunjuk.log = [];
      modalTunjuk.aktif = true;
    }
    function tutupPenunjukan() { modalTunjuk.aktif = false; modalTunjuk.kartu = null; modalTunjuk.operator = null; modalTunjuk.log = []; }
    async function hasilScanTunjuk(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      if (!kode) return;
      if (modalTunjuk.tahap === 'operator') {
        const karyawan = await cariKaryawanByQr(kode);
        if (!karyawan) { alert('QR tidak dikenali — operator/tim tidak ditemukan.'); return; }
        modalTunjuk.operator = { id: karyawan.id, nama: karyawan.nama || karyawan.name || karyawan.id };
        modalTunjuk.tahap = 'anak';
        return;
      }
      const cocok = (modalTunjuk.kartu?.baris || []).filter(b => b.no_spk === kode && b.label_cetak_pada && b.status === 'perlu_disiapkan');
      if (!cocok.length) { alert(`Kode "${kode}" tidak cocok baris manapun di kartu ini (mungkin belum dicetak labelnya, atau sudah ditunjuk).`); return; }
      const now = new Date().toISOString();
      const trackId = modalTunjuk.kartu.trackId;
      const idxSet = new Set(cocok.map(b => b._lineIdx));
      try {
        await updateBarisFinishingMassal(trackId, (b, i) => idxSet.has(i), (lama) => ({
          status: 'sedang_disiapkan', masuk_tahap_pada: now,
          operator_uid: modalTunjuk.operator.id, operator_nama: modalTunjuk.operator.nama, ditugaskan_pada: now,
          riwayat_operator: [...(lama.riwayat_operator || []), { operator_uid: modalTunjuk.operator.id, operator_nama: modalTunjuk.operator.nama, mulai_pada: now }]
        }));
        modalTunjuk.log.unshift(`${kode} (${cocok.length} komponen) -> ${modalTunjuk.operator.nama}`);
        cocok.forEach(b => { b.status = 'sedang_disiapkan'; }); // optimistik
      } catch (e) {
        console.error('Gagal simpan penunjukan:', e);
        alert('Gagal menyimpan penunjukan. Coba lagi.');
      }
    }
    async function selesaiPenunjukan() { tutupPenunjukan(); await muat(); }

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, kartuList, cari, kartuTerbuka, toggleKartu, isChecked, toggleCheck,
      bolehProses, bolehCetak, formatQty, formatWaktu, ICON_KOSONG,
      popupCetakAktif, daftarLabelPreview, cetakLabelKartu, onCetakSelesai,
      popupCetakUlang, bukaCetakUlang, konfirmasiCetakUlang,
      modalTunjuk, bukaPenunjukan, tutupPenunjukan, hasilScanTunjuk, selesaiPenunjukan
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <template v-else>
      <div style="display:flex; align-items:center; gap:9px; background:var(--surface); border:1px solid var(--line); border-radius:999px; padding:9px 13px; margin-bottom:12px;">
        <i class="fas fa-magnifying-glass" style="font-size:15px; color:var(--text-faint); flex-shrink:0;"></i>
        <input v-model="cari" type="text" placeholder="Cari kode SPK, produk, atau no. SPK..." style="flex:1; min-width:0; border:none; outline:none; background:none; font-size:12px; color:var(--text);">
      </div>

      <div v-if="kartuList.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas" :class="ICON_KOSONG"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada komponen yang perlu disiapkan</h3>
      </div>

      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="k in kartuList" :key="k.trackId" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px; cursor:pointer;" @click="toggleKartu(k)">
            <div style="min-width:0;">
              <div class="gc-heading gc-num" style="font-weight:700; font-size:13.5px;">{{ k.kodeSpk }}</div>
              <div style="font-size:11px; color:var(--text-faint); margin-top:2px;">{{ k.namaProduk }} &middot; size {{ k.produkSize || '-' }} &middot; {{ k.baris.length }} komponen</div>
            </div>
            <span v-if="k.adaKurang" class="tag warn" style="flex-shrink:0;">ada yang menunggu cetakan</span>
            <span v-else class="tag ok" style="flex-shrink:0;">stok cukup</span>
            <i class="fas" :class="kartuTerbuka[k.trackId] ? 'fa-chevron-up' : 'fa-chevron-down'" style="color:var(--text-faint); flex-shrink:0; margin-top:4px;"></i>
          </div>

          <div v-if="kartuTerbuka[k.trackId]" style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
            <label v-for="b in k.baris" :key="barisKey(b)" style="display:flex; align-items:center; gap:8px; font-size:11px; padding:6px 8px; border-radius:10px; flex-wrap:wrap;" :style="{ background: b.label_cetak_pada ? 'var(--ok-light)' : (b._bisa ? 'transparent' : 'var(--danger-light)') }">
              <input type="checkbox" :checked="isChecked(b)" :disabled="!b._bisa || !!b.label_cetak_pada" @change="toggleCheck(b)">
              <span class="gc-num" style="font-weight:700; min-width:90px;">{{ b.no_spk }}</span>
              <span>{{ b.nama_aksesoris }} <span style="color:var(--text-faint);">{{ b.warna }}</span></span>
              <span v-if="b.varian_jumlah > 1" class="tag neutral">{{ b.varian_jumlah }} varian</span>
              <span class="gc-num" style="color:var(--text-faint);">butuh {{ formatQty(b.butuh) }} {{ b.satuan }}</span>
              <span class="gc-num" style="color:var(--text-faint);">stok {{ formatQty(b._stok) }}</span>
              <span v-if="b.label_cetak_pada" class="tag ok" style="margin-left:auto;">sudah dicetak</span>
              <span v-else-if="!b._bisa" class="tag warn" style="margin-left:auto;">sisa {{ formatQty(b._sisaDicetak) }} {{ b.satuan }} dicetak</span>
            </label>
          </div>

          <div v-if="bolehCetak" style="display:flex; gap:8px; border-top:1px solid var(--line); padding-top:10px;">
            <button @click="cetakLabelKartu(k)" class="btn-outline" style="flex:1; padding:9px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Label</button>
            <button v-if="k.baris.some(b=>b.label_cetak_pada)" @click="bukaCetakUlang(k)" class="btn-outline" style="flex:1; padding:9px; color:var(--warn); border-color:var(--warn);"><i class="fas fa-rotate" style="margin-right:6px;"></i>Cetak Ulang</button>
            <button v-if="bolehProses && k.baris.some(b=>b.label_cetak_pada && b.status==='perlu_disiapkan')" @click="bukaPenunjukan(k)" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Tunjuk Operator</button>
          </div>
        </div>
      </div>
    </template>

    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Label Anak SPK" :daftar-label="daftarLabelPreview" @tutup="popupCetakAktif = false" @cetak="onCetakSelesai" />

    <div v-if="popupCetakUlang" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;"><i class="fas fa-rotate" style="margin-right:8px; color:var(--warn);"></i>Cetak Ulang Label</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0 0 10px;">{{ popupCetakUlang.kartu.kodeSpk }} — dicatat di riwayat cetak ulang.</p>
        <div class="gc-field" style="margin-bottom:8px;"><label>Alasan</label><input v-model="popupCetakUlang.alasan" type="text" placeholder="Mis. label rusak/hilang"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>PIN Admin</label><input v-model="popupCetakUlang.pin" type="password" placeholder="PIN"></div>
        <div style="display:flex; gap:8px;">
          <button @click="popupCetakUlang = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiCetakUlang" class="btn-primary" style="flex:1; padding:9px;">Cetak Ulang</button>
        </div>
      </div>
    </div>

    <modal-scan-qr :aktif="modalTunjuk.aktif"
      :judul="modalTunjuk.tahap==='operator' ? 'Scan QR Operator/Tim' : ('Scan label anak SPK — operator: ' + (modalTunjuk.operator?.nama || ''))"
      :subjudul="modalTunjuk.tahap==='anak' ? 'Bisa discan berkali-kali. Scan QR operator lain buat ganti operator aktif.' : ''"
      @hasil="hasilScanTunjuk" @tutup="selesaiPenunjukan" />
    <div v-if="modalTunjuk.aktif && modalTunjuk.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:260px;">
      <div v-for="(l,i) in modalTunjuk.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>
  `
};

// ============================================================================
// TAB 2: Sedang Disiapkan (langkah wireframe 2a -> 2b)
// SAMA pola vue-persiapan-bahan.js Tab 2 — dikelompokkan per operator, aksi
// per baris (Scan Entry/Masalah/Ganti Operator).
// ============================================================================
const PersiapanFinishingSedangDisiapkan = {
  components: { ModalScanQr },
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const sedangProses = reactive({});
    const bolehProses = computed(() => window.cekIzinMenu(MENU_ID, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try { daftarTrack.value = await muatSemuaTrackFinishing(); }
      catch (e) { console.error('Gagal muat Acc Finishing > Sedang Disiapkan:', e); daftarTrack.value = []; }
      memuat.value = false;
    }

    const kelompokOperator = computed(() => {
      const baris = daftarBarisDariTrack(daftarTrack.value).filter(b => b.status === 'sedang_disiapkan');
      const peta = {};
      baris.forEach(b => {
        const key = b.operator_uid || b.operator_nama || '-';
        if (!peta[key]) peta[key] = { operatorNama: b.operator_nama || '(tanpa nama)', baris: [] };
        peta[key].baris.push(b);
      });
      return Object.values(peta).sort((a, b) => b.baris.length - a.baris.length);
    });

    const modalAksi = reactive({ aktif: false, mode: null, baris: null }); // 'entry' | 'masalah' | 'ganti'
    function bukaAksi(mode, b) {
      if (sedangProses[barisKey(b)]) return;
      modalAksi.mode = mode; modalAksi.baris = b; modalAksi.aktif = true;
    }
    function tutupAksi() { modalAksi.aktif = false; modalAksi.mode = null; modalAksi.baris = null; }
    async function hasilScanAksi(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      const b = modalAksi.baris;
      if (!kode || !b) return;
      if (modalAksi.mode === 'ganti') {
        const karyawan = await cariKaryawanByQr(kode);
        if (!karyawan) { alert('QR tidak dikenali — operator/tim tidak ditemukan.'); return; }
        const key = barisKey(b); sedangProses[key] = true;
        try {
          const now = new Date().toISOString();
          await updateBarisFinishing(b._trackId, b._lineIdx, (lama) => ({
            operator_uid: karyawan.id, operator_nama: karyawan.nama || karyawan.name || karyawan.id, ditugaskan_pada: now,
            riwayat_operator: [...(lama.riwayat_operator || []), { operator_uid: karyawan.id, operator_nama: karyawan.nama || karyawan.name || karyawan.id, mulai_pada: now }]
          }));
          tutupAksi(); await muat();
        } catch (e) { console.error('Gagal ganti operator:', e); alert('Gagal menyimpan. Coba lagi.'); }
        sedangProses[key] = false;
        return;
      }
      if (kode !== b.no_spk) { alert(`Kode yang discan ("${kode}") tidak cocok dengan anak SPK ini (${b.no_spk}).`); return; }
      const key = barisKey(b); sedangProses[key] = true;
      try {
        if (modalAksi.mode === 'entry') {
          await konfirmasiEntry(b);
        } else if (modalAksi.mode === 'masalah') {
          const catatan = prompt('Jelaskan masalahnya:');
          if (!catatan || !catatan.trim()) { sedangProses[key] = false; return; }
          await updateBarisFinishing(b._trackId, b._lineIdx, () => ({ catatan_masalah: catatan.trim() }));
        }
        tutupAksi(); await muat();
      } catch (e) { console.error('Gagal proses scan:', modalAksi.mode, e); alert('Gagal memproses. Coba lagi.'); }
      sedangProses[key] = false;
    }

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, kelompokOperator, bolehProses, sedangProses,
      formatQty, formatDiamSejak, tertahan, barisKey,
      modalAksi, bukaAksi, tutupAksi, hasilScanAksi
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else-if="kelompokOperator.length === 0" class="gc-kosong gc-card">
      <div class="lingkaran"><i class="fas fa-gears"></i></div>
      <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang sedang disiapkan</h3>
    </div>

    <div v-else style="display:flex; flex-direction:column; gap:10px;">
      <div v-for="op in kelompokOperator" :key="op.operatorNama" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
          <i class="fas fa-user" style="color:var(--aksen-ink);"></i>
          <span class="gc-heading" style="font-weight:700; font-size:13px;">{{ op.operatorNama }}</span>
          <span class="tag pink" style="margin-left:auto;">{{ op.baris.length }} baris</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div v-for="b in op.baris" :key="barisKey(b)" style="border:1px solid var(--line); border-radius:14px; padding:10px;" :style="{ background: tertahan(b.masuk_tahap_pada) ? 'var(--warn-light)' : 'transparent' }">
            <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:4px;">
              <span class="gc-num" style="font-weight:700; font-size:11.5px;">{{ b.no_spk }}</span>
              <span class="tag" :class="tertahan(b.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(b.masuk_tahap_pada) }}</span>
            </div>
            <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:6px;">{{ b.nama_aksesoris }} {{ b.warna }} &middot; {{ formatQty(b.butuh) }} {{ b.satuan }} &middot; {{ b.nama_produk }}</div>
            <div v-if="b.catatan_masalah" style="font-size:10.5px; color:var(--danger); background:var(--danger-light); border-radius:8px; padding:5px 8px; margin-bottom:6px;"><i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>{{ b.catatan_masalah }}</div>
            <div v-if="bolehProses" style="display:flex; gap:6px;">
              <button @click="bukaAksi('entry', b)" :disabled="sedangProses[barisKey(b)]" class="btn-primary" style="flex:1; padding:7px; font-size:11px;"><i class="fas fa-qrcode" style="margin-right:4px;"></i>Scan Entry</button>
              <button @click="bukaAksi('masalah', b)" :disabled="sedangProses[barisKey(b)]" class="btn-outline" style="flex:1; padding:7px; font-size:11px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Masalah</button>
              <button @click="bukaAksi('ganti', b)" :disabled="sedangProses[barisKey(b)]" class="btn-outline" style="flex:0 0 auto; padding:7px 9px; font-size:11px;" title="Ganti Operator (estafet shift)"><i class="fas fa-arrow-right-arrow-left"></i></button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <modal-scan-qr :aktif="modalAksi.aktif"
      :judul="modalAksi.mode==='ganti' ? 'Scan QR operator pengganti' : ('Scan label ' + (modalAksi.baris?.no_spk || ''))"
      :subjudul="modalAksi.mode==='entry' ? 'Scan Entry — stok akan berkurang.' : (modalAksi.mode==='masalah' ? 'Scan Masalah — akan diminta catatan.' : '')"
      @hasil="hasilScanAksi" @tutup="tutupAksi" />
  `
};

// ============================================================================
// TAB 3: Perlu Di Kirim (langkah wireframe 3a -> 3b)
// Papan hanya baris berstatus perlu_dikirim. Dua cetak (Kode Bagging tanpa
// TLC, Kode Tugas dengan tujuan TLC dropdown). Dua scan (Scan Pack, Scan
// Kirim) — SATU scan bisa menandai BEBERAPA baris komponen sekaligus (semua
// komponen 1 anak SPK yang di-pack bareng, atau semua baris ber-kode_bagging
// sama saat kirim) — beda dari Bahan yang 1 scan = 1 baris.
// ============================================================================
const PersiapanFinishingPerluDikirim = {
  components: { PopupPratinjauCetakLabel, ModalScanQr },
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const daftarBaggingAktif = ref([]);
    const daftarTlc = ref([]);
    const sedangProses = ref(false);
    const bolehProses = computed(() => window.cekIzinMenu(MENU_ID, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(MENU_ID, 'print') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const [tracks, baggingSnap, tlcSnap] = await Promise.all([
          muatSemuaTrackFinishing(),
          getDocs(query(collection(db, 'bagging'), where('ditutup_pada', '==', null))),
          getDocs(collection(db, 'master_tlc'))
        ]);
        daftarTrack.value = tracks;
        daftarBaggingAktif.value = baggingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        daftarTlc.value = tlcSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error('Gagal muat Acc Finishing > Perlu Di Kirim:', e);
        daftarTrack.value = []; daftarBaggingAktif.value = []; daftarTlc.value = [];
      }
      memuat.value = false;
    }

    const barisTertahan = computed(() => daftarBarisDariTrack(daftarTrack.value).filter(b => b.status === 'perlu_dikirim'));
    const kelompokSepack = computed(() => {
      const peta = {};
      barisTertahan.value.forEach(b => {
        const key = kunciSepack(b);
        if (!peta[key]) peta[key] = { key, label: labelSepack(b), baris: [] };
        peta[key].baris.push(b);
      });
      return Object.values(peta).sort((a, b) => b.baris.length - a.baris.length);
    });

    const popupBagging = ref(null);
    function bukaCetakBagging() {
      if (!kelompokSepack.value.length) { alert('Tidak ada baris di tab ini.'); return; }
      popupBagging.value = { sepackKey: kelompokSepack.value[0].key, jumlah: 1 };
    }
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    async function konfirmasiCetakBagging() {
      const p = popupBagging.value;
      const grup = kelompokSepack.value.find(g => g.key === p.sepackKey);
      if (!grup) return;
      const n = Math.max(1, parseInt(p.jumlah) || 1);
      sedangProses.value = true;
      try {
        const preview = [];
        for (let i = 0; i < n; i++) {
          const kode = await generateKodeHarian('BAG', 'pengaturan_id_bagging');
          await addDoc(collection(db, 'bagging'), {
            kode, produk_label: grup.label, isi: [], ditutup_pada: null,
            dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
          });
          preview.push({ kode, nama: grup.label, info: 'Kode Bagging &middot; belum diisi', qrDataUrl: buatQrDataUrl(kode) });
        }
        daftarLabelPreview.value = preview;
        popupBagging.value = null;
        popupCetakAktif.value = true;
        await muat();
      } catch (e) { console.error('Gagal cetak kode bagging:', e); alert('Gagal membuat kode bagging. Coba lagi.'); }
      sedangProses.value = false;
    }

    const popupTugas = ref(null);
    function bukaCetakTugas() {
      if (!daftarTlc.value.length) { alert('Belum ada data TLC (Titik Lokasi Cerdas). Isi dulu lewat tombol "Isi TLC Awal" di bawah, atau tambah manual di Firestore koleksi master_tlc.'); return; }
      popupTugas.value = { tlcTujuan: daftarTlc.value[0].kode };
    }
    async function konfirmasiCetakTugas() {
      const p = popupTugas.value;
      sedangProses.value = true;
      try {
        const kode = await generateKodeHarian('TGS', 'pengaturan_id_tugas_kirim');
        await addDoc(collection(db, 'tugas_kirim'), {
          kode, tlc_asal: TLC_ASAL, tlc_tujuan: p.tlcTujuan, pack: [],
          dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
        });
        daftarLabelPreview.value = [{ kode, nama: 'Kode Tugas Kirim', info: `${TLC_ASAL} &rarr; ${p.tlcTujuan}`, qrDataUrl: buatQrDataUrl(kode) }];
        popupTugas.value = null;
        popupCetakAktif.value = true;
      } catch (e) { console.error('Gagal cetak kode tugas:', e); alert('Gagal membuat kode tugas. Coba lagi.'); }
      sedangProses.value = false;
    }

    async function isiTlcAwal() {
      if (daftarTlc.value.length) return;
      const contoh = [
        ['TLC-BHN', 'Gudang Bahan'], ['TLC-SEW', 'Pos Acc Sewing'], ['TLC-WEB', 'Pos Acc Webbing'],
        ['TLC-FIN', 'Pos Acc Finishing'], ['TLC-VDR', 'Vendor'], ['TLC-MSL', 'Persiapan Masalah'],
        ['TLC-PTG-01', 'Meja Potong 1'], ['TLC-SEW-01', 'Line Jahit 1'], ['TLC-FIN-01', 'Line Finishing 1'], ['TLC-QC', 'QC']
      ];
      sedangProses.value = true;
      try {
        await Promise.all(contoh.map(([kode, nama]) => addDoc(collection(db, 'master_tlc'), { kode, nama, tipe: kode.split('-')[1] || '' })));
        await muat();
      } catch (e) { console.error('Gagal isi TLC awal:', e); }
      sedangProses.value = false;
    }

    // --- Scan Pack: step1 kode bagging, step2 anak SPK berkali-kali. 1 scan
    // anak SPK menandai SEMUA baris komponen anak SPK itu (bisa lintas
    // beberapa baris, tapi selalu di dalam kartu/dokumen yang sama). ---
    const modalPack = reactive({ aktif: false, bagging: null, log: [] });
    function bukaScanPack() { modalPack.bagging = null; modalPack.log = []; modalPack.aktif = true; }
    function tutupScanPack() { modalPack.aktif = false; modalPack.bagging = null; modalPack.log = []; muat(); }
    async function hasilScanPack(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      if (!modalPack.bagging) {
        const b = daftarBaggingAktif.value.find(x => x.kode === kode);
        if (!b) { alert(`Kode bagging "${kode}" tidak ditemukan atau sudah ditutup.`); return; }
        modalPack.bagging = b;
        return;
      }
      const cocok = barisTertahan.value.filter(x => x.no_spk === kode && !x.kode_bagging);
      if (!cocok.length) { alert(`Kode "${kode}" tidak cocok anak SPK yang masih tertahan / sudah di-pack.`); return; }
      if (labelSepack(cocok[0]) !== modalPack.bagging.produk_label) {
        alert(`Kode "${kode}" bukan produk yang sama dengan bagging ini (${modalPack.bagging.produk_label}). Syarat sepack: produk dan size harus sama.`);
        return;
      }
      const byTrack = {};
      cocok.forEach(b => { (byTrack[b._trackId] ||= []).push(b); });
      try {
        await Promise.all(Object.entries(byTrack).map(([trackId, barisGrup]) => {
          const idxSet = new Set(barisGrup.map(b => b._lineIdx));
          return updateBarisFinishingMassal(trackId, (b, i) => idxSet.has(i), () => ({ kode_bagging: modalPack.bagging.kode }));
        }));
        await updateDoc(doc(db, 'bagging', modalPack.bagging.id), { isi: arrayUnion(kode) });
        modalPack.log.unshift(kode + ` (${cocok.length} komponen) -> ` + modalPack.bagging.kode);
        cocok.forEach(b => { b.kode_bagging = modalPack.bagging.kode; });
      } catch (e) { console.error('Gagal scan pack:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }
    async function tutupBagging() {
      if (!modalPack.bagging) return;
      try { await updateDoc(doc(db, 'bagging', modalPack.bagging.id), { ditutup_pada: serverTimestamp() }); } catch (e) { console.error('Gagal tutup bagging:', e); }
      modalPack.bagging = null;
    }

    // --- Scan Kirim: step1 kode tugas, step2 kode bagging tiap pack. ---
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
        } catch (e) { console.error('Gagal cari kode tugas:', e); }
        return;
      }
      const anggota = barisTertahan.value.filter(x => x.kode_bagging === kode);
      if (!anggota.length) { alert(`Kode bagging "${kode}" tidak ditemukan di antara yang masih tertahan (mungkin belum di-pack, atau sudah dikirim).`); return; }
      const now = new Date().toISOString();
      const byTrack = {};
      anggota.forEach(b => { (byTrack[b._trackId] ||= []).push(b); });
      try {
        await Promise.all(Object.entries(byTrack).map(([trackId, barisGrup]) => {
          const idxSet = new Set(barisGrup.map(b => b._lineIdx));
          return updateBarisFinishingMassal(trackId, (b, i) => idxSet.has(i), () => ({
            status: 'sedang_dikirim', masuk_tahap_pada: now, kode_tugas: modalKirim.tugas.kode,
            tlc_tujuan: modalKirim.tugas.tlc_tujuan || ''
          }));
        }));
        await updateDoc(doc(db, 'tugas_kirim', modalKirim.tugas.id), { pack: arrayUnion({ kode_bagging: kode, pada: now }) });
        modalKirim.log.unshift(kode + ' (' + anggota.length + ' komponen) -> ' + modalKirim.tugas.kode);
      } catch (e) { console.error('Gagal scan kirim:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, kelompokSepack, daftarTlc, bolehProses, bolehCetak, sedangProses,
      formatQty, formatDiamSejak, tertahan,
      popupBagging, bukaCetakBagging, konfirmasiCetakBagging,
      popupTugas, bukaCetakTugas, konfirmasiCetakTugas, isiTlcAwal,
      popupCetakAktif, daftarLabelPreview,
      modalPack, bukaScanPack, tutupScanPack, hasilScanPack, tutupBagging,
      modalKirim, bukaScanKirim, tutupScanKirim, hasilScanKirim
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <template v-else>
      <div v-if="bolehCetak" style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <button @click="bukaCetakBagging" class="btn-outline" style="flex:1; min-width:150px; padding:9px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Kode Bagging</button>
        <button @click="bukaCetakTugas" class="btn-outline" style="flex:1; min-width:150px; padding:9px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Kode Tugas</button>
      </div>
      <div v-if="bolehProses" style="display:flex; gap:8px; margin-bottom:12px;">
        <button @click="bukaScanPack" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Pack</button>
        <button @click="bukaScanKirim" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Kirim</button>
      </div>

      <div v-if="kelompokSepack.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-box-open"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang tertahan di Perlu Di Kirim</h3>
      </div>

      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="g in kelompokSepack" :key="g.key" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
          <div class="gc-heading" style="font-weight:700; font-size:12.5px; margin-bottom:8px;">{{ g.label }}</div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div v-for="b in g.baris" :key="barisKey(b)" style="display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:11px; padding:6px 8px; border-radius:10px;" :style="{ background: tertahan(b.masuk_tahap_pada) ? 'var(--warn-light)' : 'transparent' }">
              <span class="gc-num" style="font-weight:700;">{{ b.no_spk }}</span>
              <span style="color:var(--text-faint);">{{ b.nama_aksesoris }} {{ b.warna }}</span>
              <span v-if="b.kode_bagging" class="tag ok">{{ b.kode_bagging }}</span>
              <span v-else class="tag neutral">belum di-pack</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Kode" :daftar-label="daftarLabelPreview" @tutup="popupCetakAktif = false" />

    <div v-if="popupBagging" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Cetak Kode Bagging</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Produk</label>
          <select v-model="popupBagging.sepackKey"><option v-for="g in kelompokSepack" :key="g.key" :value="g.key">{{ g.label }}</option></select>
        </div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Jumlah Label</label><input v-model.number="popupBagging.jumlah" type="number" min="1"></div>
        <div style="display:flex; gap:8px;">
          <button @click="popupBagging = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiCetakBagging" :disabled="sedangProses" class="btn-primary" style="flex:1; padding:9px;">Cetak</button>
        </div>
      </div>
    </div>

    <div v-if="popupTugas" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Cetak Kode Tugas</h3>
        <div class="gc-field" style="margin-bottom:14px;"><label>Tujuan (TLC)</label>
          <select v-model="popupTugas.tlcTujuan"><option v-for="t in daftarTlc" :key="t.id" :value="t.kode">{{ t.kode }} — {{ t.nama }}</option></select>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="popupTugas = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiCetakTugas" :disabled="sedangProses" class="btn-primary" style="flex:1; padding:9px;">Cetak</button>
        </div>
      </div>
    </div>

    <div v-if="!daftarTlc.length" style="margin-top:10px;"><button @click="isiTlcAwal" class="btn-outline" style="width:100%; padding:8px; font-size:11px;">Isi TLC Awal (10 lokasi contoh)</button></div>

    <modal-scan-qr :aktif="modalPack.aktif" :judul="modalPack.bagging ? ('Scan anak SPK — bagging ' + modalPack.bagging.kode) : 'Scan Kode Bagging'" subjudul="Bisa discan berkali-kali. Tutup lewat tombol di bawah kalau sudah selesai." @hasil="hasilScanPack" @tutup="tutupScanPack" />
    <div v-if="modalPack.aktif && modalPack.bagging" style="position:fixed; left:16px; bottom:16px; z-index:10001; display:flex; flex-direction:column; gap:8px; max-width:260px;">
      <button @click="tutupBagging" class="btn-primary" style="padding:8px 14px; font-size:11px;">Tutup Bagging Ini</button>
      <div style="background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px;"><div v-for="(l,i) in modalPack.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div></div>
    </div>

    <modal-scan-qr :aktif="modalKirim.aktif" :judul="modalKirim.tugas ? ('Scan kode bagging — tugas ' + modalKirim.tugas.kode) : 'Scan Kode Tugas'" subjudul="Bisa discan berkali-kali (tiap kode bagging = 1 pack)." @hasil="hasilScanKirim" @tutup="tutupScanKirim" />
    <div v-if="modalKirim.aktif && modalKirim.tugas && modalKirim.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:260px;">
      <div v-for="(l,i) in modalKirim.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>
  `
};

// ============================================================================
// TAB 4: Sedang Di Kirim — VIEW-ONLY, SAMA pola vue-persiapan-bahan.js.
// ============================================================================
const PersiapanFinishingSedangDikirim = {
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    async function muat() {
      memuat.value = true;
      try { daftarTrack.value = await muatSemuaTrackFinishing(); }
      catch (e) { console.error('Gagal muat Acc Finishing > Sedang Di Kirim:', e); daftarTrack.value = []; }
      memuat.value = false;
    }
    const kelompokTugas = computed(() => {
      const baris = daftarBarisDariTrack(daftarTrack.value).filter(b => b.status === 'sedang_dikirim');
      const peta = {};
      baris.forEach(b => {
        const key = b.kode_tugas || '(tanpa kode tugas)';
        if (!peta[key]) peta[key] = { kodeTugas: key, baris: [] };
        peta[key].baris.push(b);
      });
      return Object.values(peta).sort((a, b) => a.kodeTugas.localeCompare(b.kodeTugas));
    });
    onMounted(async () => { await window.authReady; await muat(); });
    return { memuat, kelompokTugas, formatQty, formatDiamSejak, barisKey };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else-if="kelompokTugas.length === 0" class="gc-kosong gc-card">
      <div class="lingkaran"><i class="fas fa-truck-fast"></i></div>
      <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang sedang dikirim</h3>
    </div>

    <div v-else style="display:flex; flex-direction:column; gap:10px;">
      <div v-for="g in kelompokTugas" :key="g.kodeTugas" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <i class="fas fa-route" style="color:var(--aksen-ink);"></i>
          <span class="gc-num gc-heading" style="font-weight:700; font-size:12.5px;">{{ g.kodeTugas }}</span>
          <span class="tag pink" style="margin-left:auto;">{{ g.baris.length }} item &middot; menunggu diterima</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:5px;">
          <div v-for="b in g.baris" :key="barisKey(b)" style="display:flex; justify-content:space-between; gap:8px; font-size:11px;">
            <span class="gc-num" style="font-weight:700;">{{ b.no_spk }}</span>
            <span style="color:var(--text-faint);">{{ b.nama_aksesoris }} {{ b.warna }} &middot; {{ formatQty(b.butuh) }} {{ b.satuan }}</span>
            <span class="gc-num" style="color:var(--text-faint);">{{ b.kode_bagging }}</span>
          </div>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// TAB 5: Selesai — riwayat. SAMA pola vue-persiapan-bahan.js Tab 5.
//
// PENTING — batas tanggung jawab file ini: baris pindah ke status 'selesai'
// SAAT DIVISI PENERIMA SCAN SAMPAI, BUKAN saat pos ini Scan Kirim. Layar
// "Scan Sampai" itu SENDIRI di luar lingkup modul ini (SERAH-TERIMA §4) —
// jadi tab ini HANYA MEMBACA field `status`/`sampai_pada` yang ditulis
// modul LAIN yang belum dibangun di manapun. Sampai modul itu ada, tab ini
// akan tampil KOSONG terus — itu BUKAN bug di file ini (SAMA persis catatan
// di vue-persiapan-bahan.js).
// ============================================================================
const PersiapanFinishingSelesai = {
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);

    async function muat() {
      memuat.value = true;
      try { daftarTrack.value = await muatSemuaTrackFinishing(); }
      catch (e) { console.error('Gagal muat Acc Finishing > Selesai:', e); daftarTrack.value = []; }
      memuat.value = false;
    }

    const isOperatorSaja = computed(() => (window.currentUser?.role || '').toLowerCase() === 'operator');

    const semuaSelesai = computed(() => daftarBarisDariTrack(daftarTrack.value).filter(b => b.status === 'selesai'));
    const barisSaya = computed(() => semuaSelesai.value.filter(b => b.operator_uid && b.operator_uid === window.currentUser?.email)
      .sort((a, b) => new Date(b.sampai_pada || 0) - new Date(a.sampai_pada || 0)));

    const selesaiHariIni = computed(() => semuaSelesai.value.filter(b => hariIniSama(b.sampai_pada)));
    const kpi = computed(() => {
      const list = selesaiHariIni.value;
      const totalKomponen = list.reduce((s, b) => s + (parseFloat(b.entry_qty) || 0), 0);
      const siklusList = list.map(siklusJam).filter(j => j !== null);
      const rataSiklus = siklusList.length ? (siklusList.reduce((a, b) => a + b, 0) / siklusList.length) : null;
      const terpaksaKurang = list.filter(b => !!b.catatan_masalah).length;
      const operatorSet = new Set(list.map(b => b.operator_uid).filter(Boolean));
      return {
        selesai: list.length, totalKomponen, rataSiklus,
        terpaksaKurang, operatorTerlibat: operatorSet.size
      };
    });

    const daftarUrut = computed(() => [...semuaSelesai.value].sort((a, b) => new Date(b.sampai_pada || 0) - new Date(a.sampai_pada || 0)));

    function keadaan(b) { return b.catatan_masalah ? 'kurang' : 'lengkap'; }

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, isOperatorSaja, barisSaya, daftarUrut, kpi,
      formatQty, formatWaktu, formatSiklus, siklusJam, keadaan, barisKey
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <template v-else-if="isOperatorSaja">
      <div v-if="barisSaya.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-clock-rotate-left"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0 0 4px;">Belum ada riwayat</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0;">Baris yang pernah Anda scan entry akan muncul di sini setelah tuntas diterima.</p>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:8px;">
        <div v-for="b in barisSaya" :key="barisKey(b)" class="gc-card gc-card-menonjol" style="padding:12px; border-radius:16px;">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:4px;">
            <span class="gc-num" style="font-weight:700; font-size:12px;">{{ b.no_spk }}</span>
            <span class="tag" :class="keadaan(b)==='lengkap' ? 'ok' : 'warn'">{{ keadaan(b) }}</span>
          </div>
          <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:6px;">{{ b.nama_aksesoris }} {{ b.warna }} &middot; {{ formatQty(b.butuh) }} {{ b.satuan }}</div>
          <div style="display:flex; gap:14px; font-size:10.5px;">
            <div><span style="color:var(--text-faint);">Entry:</span> <span class="gc-num">{{ formatWaktu(b.entry_pada) }}</span></div>
            <div><span style="color:var(--text-faint);">Sampai:</span> <span class="gc-num">{{ formatWaktu(b.sampai_pada) }}</span></div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
        <div style="flex:1; min-width:110px; border:1px dashed var(--line); border-radius:12px; padding:8px 10px; background:var(--ivory-dim);">
          <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Selesai hari ini</div>
          <div class="gc-num" style="font-size:16px; font-weight:700;">{{ kpi.selesai }}</div>
        </div>
        <div style="flex:1; min-width:110px; border:1px dashed var(--line); border-radius:12px; padding:8px 10px; background:var(--ivory-dim);">
          <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Baris komponen</div>
          <div class="gc-num" style="font-size:16px; font-weight:700;">{{ formatQty(kpi.totalKomponen) }}</div>
        </div>
        <div style="flex:1; min-width:110px; border:1px dashed var(--line); border-radius:12px; padding:8px 10px; background:var(--ivory-dim);">
          <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Rata-rata siklus</div>
          <div class="gc-num" style="font-size:16px; font-weight:700;">{{ formatSiklus(kpi.rataSiklus) }}</div>
        </div>
        <div style="flex:1; min-width:110px; border:1px dashed var(--line); border-radius:12px; padding:8px 10px; background:var(--ivory-dim);">
          <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Terpaksa kurang</div>
          <div class="gc-num" :style="{ fontSize:'16px', fontWeight:700, color: kpi.terpaksaKurang ? 'var(--warn)' : 'inherit' }">{{ kpi.terpaksaKurang }}</div>
        </div>
        <div style="flex:1; min-width:110px; border:1px dashed var(--line); border-radius:12px; padding:8px 10px; background:var(--ivory-dim);">
          <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Operator terlibat</div>
          <div class="gc-num" style="font-size:16px; font-weight:700;">{{ kpi.operatorTerlibat }}</div>
        </div>
      </div>

      <div v-if="daftarUrut.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-circle-check"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0 0 4px;">Belum ada yang selesai</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0;">Baris masuk ke sini otomatis saat divisi penerima Scan Sampai — bukan saat pos ini Scan Kirim.</p>
      </div>

      <div v-else class="gc-table-scroll">
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead>
            <tr style="text-align:left; color:var(--text-faint); border-bottom:1px solid var(--line);">
              <th style="padding:6px 8px;">Kode</th>
              <th style="padding:6px 8px;">Komponen</th>
              <th style="padding:6px 8px;">Entry</th>
              <th style="padding:6px 8px;">Disiapkan oleh</th>
              <th style="padding:6px 8px;">Pack</th>
              <th style="padding:6px 8px;">Tujuan TLC</th>
              <th style="padding:6px 8px;">Sampai</th>
              <th style="padding:6px 8px;">Siklus</th>
              <th style="padding:6px 8px;">Keadaan</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in daftarUrut" :key="barisKey(b)" style="border-bottom:1px solid var(--line);">
              <td style="padding:6px 8px;">
                <div class="gc-num" style="font-weight:700;">{{ b.no_spk }}</div>
                <div style="font-size:9.5px; color:var(--text-faint);">label {{ formatWaktu(b.label_cetak_pada) }}</div>
              </td>
              <td style="padding:6px 8px;">{{ b.nama_aksesoris }} {{ b.warna }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatWaktu(b.entry_pada) }}</td>
              <td style="padding:6px 8px;">{{ b.operator_nama || '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ b.kode_bagging || '-' }}</td>
              <td style="padding:6px 8px;">{{ b.tlc_tujuan || '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatWaktu(b.sampai_pada) }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatSiklus(siklusJam(b)) }}</td>
              <td style="padding:6px 8px;"><span class="tag" :class="keadaan(b)==='lengkap' ? 'ok' : 'warn'">{{ keadaan(b) }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  `
};

// --- Mount ke index.html — LAZY, SAMA pola vue-persiapan-bahan.js: fungsi
// window.pastikanMountPpFinishingXxx() dipanggil oleh pindahSubTab() (js/
// dashboard.js, peta `petaMount`) PERTAMA KALI tab itu dibuka. --------------
let vmPpFinishingPerluDisiapkan = null;
window.pastikanMountPpFinishingPerluDisiapkan = function () {
  if (vmPpFinishingPerluDisiapkan) return;
  const mountPoint = document.getElementById('vue-pp-finishing-perludisiapkan');
  if (mountPoint) vmPpFinishingPerluDisiapkan = createApp(PersiapanFinishingPerluDisiapkan).mount('#vue-pp-finishing-perludisiapkan');
};
let vmPpFinishingSedangDisiapkan = null;
window.pastikanMountPpFinishingSedangDisiapkan = function () {
  if (vmPpFinishingSedangDisiapkan) return;
  const mountPoint = document.getElementById('vue-pp-finishing-sedangdisiapkan');
  if (mountPoint) vmPpFinishingSedangDisiapkan = createApp(PersiapanFinishingSedangDisiapkan).mount('#vue-pp-finishing-sedangdisiapkan');
};
let vmPpFinishingPerluDikirim = null;
window.pastikanMountPpFinishingPerluDikirim = function () {
  if (vmPpFinishingPerluDikirim) return;
  const mountPoint = document.getElementById('vue-pp-finishing-perludikirim');
  if (mountPoint) vmPpFinishingPerluDikirim = createApp(PersiapanFinishingPerluDikirim).mount('#vue-pp-finishing-perludikirim');
};
let vmPpFinishingSedangDikirim = null;
window.pastikanMountPpFinishingSedangDikirim = function () {
  if (vmPpFinishingSedangDikirim) return;
  const mountPoint = document.getElementById('vue-pp-finishing-sedangdikirim');
  if (mountPoint) vmPpFinishingSedangDikirim = createApp(PersiapanFinishingSedangDikirim).mount('#vue-pp-finishing-sedangdikirim');
};
let vmPpFinishingSelesai = null;
window.pastikanMountPpFinishingSelesai = function () {
  if (vmPpFinishingSelesai) return;
  const mountPoint = document.getElementById('vue-pp-finishing-selesai');
  if (mountPoint) vmPpFinishingSelesai = createApp(PersiapanFinishingSelesai).mount('#vue-pp-finishing-selesai');
};
