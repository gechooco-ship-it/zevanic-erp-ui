// js/vue-pp-finishing.js
// Proses Produksi > Finishing. Menerima kiriman dari Serie, proses 4 tahap
// berurutan per PCS (QC → Steam → Folding → Packing), lalu kirim balik ke
// Serie. Tidak mencetak label baru — pakai label_pcs dari Sewing.
//
// Koleksi & field:
// - finishing_track: 1 dokumen PER PCS, bukan per batch. tahap_aktif
//   (qc/steam/folding/packing/selesai), status perlu_diproses →
//   sedang_finishing → perlu_dikirim → sedang_dikirim → selesai. kode_bagging
//   & kode_tugas di sini TUNGGAL/STRING, bukan array seperti sewing_track.
// - batch_id = id Firestore separating_batch, BUKAN sewing_track; banyak pcs
//   berbagi batch_id yang sama, itu disengaja.
// - label_pcs.status sesudah 'di_finishing' wewenang Gudang Barang Jadi/Kasir.
//
// Jebakan:
// - kode_tugas WAJIB sama persis di semua dokumen pcs yang dikirim bersamaan:
//   Serie Tab 2.9 query where('kode_tugas','==',kode) dan harus dapat semuanya.
// - status 'selesai' + sampai_pada TIDAK ditulis modul ini — Serie Tab 2.9 yang
//   menutupnya, jadi Tab 4.4 memang menggantung sampai Serie scan.
// - Scan tiap tahap DIBLOKIR selama terima_pada pcs itu masih kosong.

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel } from './vue-components.js?v=13';
import { ScanGenerik, ScanTerpaduGenerik, buatScanTerpadu, buatQrDataUrl, ajukanPersiapanMasalah } from './vue-scan-cetak.js?v=9';
import { aksiAktif, pastikanCachePilihanScan } from './vue-popup-scan.js?v=5';

// Format & hitung kecil (disalin pola dari Cutting/Serie/Sewing).
function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
const AMBANG_TERTAHAN_JAM = 6;
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
function formatWaktu(iso) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return '-'; }
}
function hariIniSama(iso) {
  if (!iso) return false;
  const d = new Date(iso), now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
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
// saringMilikOperator — operator hanya lihat baris yang ditugaskan ke dirinya
// (lewat Scan Operator); role lain lihat semua baris. Gerbang TAMPILAN,
// terpisah dari picOwnerKeAtas yang cuma menggerbang tombol aksi. Sub-tab per
// tahap pakai tahap-nya sendiri; tab gabungan pakai ...SemuaTahap.
function milikUserIni(track, tahap) {
  return !!(track['op_' + tahap]?.uid && track['op_' + tahap].uid === window.currentUser?.email);
}
function saringMilikOperator(barisList, tahap) {
  if ((window.currentUser?.role || '').toLowerCase() !== 'operator') return barisList;
  return barisList.filter(t => milikUserIni(t, tahap));
}
function saringMilikOperatorSemuaTahap(barisList) {
  if ((window.currentUser?.role || '').toLowerCase() !== 'operator') return barisList;
  return barisList.filter(t => URUTAN_TAHAP.some(tahap => milikUserIni(t, tahap)));
}
const TLC_ASAL_FINISHING = 'TLC-FIN';
const TLC_TUJUAN_SERIE = 'TLC-SER';
const URUTAN_TAHAP = ['qc', 'steam', 'folding', 'packing'];
const LABEL_TAHAP = { qc: 'QC', steam: 'Steam', folding: 'Folding', packing: 'Packing' };
const ICON_TAHAP = { qc: 'fa-magnifying-glass', steam: 'fa-wind', folding: 'fa-layer-group', packing: 'fa-box' };
// Pilihan Scan (vue-popup-scan.js) — targetId & aksi id per sub-tab tahap,
// dipakai gerbang tombol desktop lewat aksiAktif().
const TARGET_ID_SEDANG_TAHAP = { qc: 'sub-pr-finishing-sedangqc', steam: 'sub-pr-finishing-sedangsteam', folding: 'sub-pr-finishing-sedangfolding', packing: 'sub-pr-finishing-sedangpacking' };
const AKSI_OPERATOR_SEDANG_TAHAP = { qc: 'finishing_operator_qc', steam: 'finishing_operator_steam', folding: 'finishing_operator_folding', packing: 'finishing_operator_packing' };
const AKSI_ENTRY_SEDANG_TAHAP = { qc: 'finishing_entry_qc', steam: 'finishing_entry_steam', folding: 'finishing_entry_folding', packing: 'finishing_entry_packing' };

// Baca koleksi mentah
async function muatSemuaSeparatingBatch() {
  const snap = await getDocs(collection(db, 'separating_batch'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function muatSemuaFinishingTrack() {
  const snap = await getDocs(collection(db, 'finishing_track'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function muatSemuaSewingTrack() {
  const snap = await getDocs(collection(db, 'sewing_track'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
// pastikanFinishingTrackLengkap — keputusan #3/#4/#5: rantai separating_batch ->
// sewing_track (batch_id cocok) -> label_pcs (batch_id cocok ke sewing_ track),
// 1 finishing_track per label_pcs, idempoten.
async function pastikanFinishingTrackLengkap() {
  const [batchList, trackList, sewingList] = await Promise.all([
    muatSemuaSeparatingBatch(), muatSemuaFinishingTrack(), muatSemuaSewingTrack()
  ]);
  const masuk = batchList.filter(b => b.status === 'kirim_finishing');
  const sudahAda = new Set(trackList.map(t => t.batch_id));
  const belum = masuk.filter(b => !sudahAda.has(b.id));
  for (const b of belum) {
    try {
      const sewingCocok = sewingList.filter(s => s.batch_id === b.id);
      if (!sewingCocok.length) continue; // belum ada sewing_track terkait — coba lagi lain kali
      const pcsSnaps = await Promise.all(sewingCocok.map(s => getDocs(query(collection(db, 'label_pcs'), where('batch_id', '==', s.id)))));
      const daftarPcs = pcsSnaps.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
      const now = new Date().toISOString();
      await Promise.all(daftarPcs.map(async (p) => {
        await addDoc(collection(db, 'finishing_track'), {
          kode_pcs: p.kode_pcs, label_pcs_id: p.id, batch_id: b.id, kode_batch: b.kode_batch || '',
          // kode_spk disalin dari separating_batch, array.
          kode_spk: b.spk_groupings || [],
          nama_produk: p.nama_produk || b.nama_produk || '', size: p.size || b.size || '', warna: p.warna || '',
          status: 'perlu_diproses', tahap_aktif: null, progress: 0,
          op_qc: null, op_steam: null, op_folding: null, op_packing: null,
          scan_qc_pada: null, scan_steam_pada: null, scan_folding_pada: null, scan_packing_pada: null,
          terima_pada: null, kode_bagging: null, kode_tugas: null, catatan_masalah: '',
          masuk_tahap_pada: now, sampai_pada: null,
          // riwayat_scan ditulis ADITIF.
          riwayat_scan: [],
          dibuat_pada: serverTimestamp(), diperbarui_pada: serverTimestamp()
        });
        try { await updateDoc(doc(db, 'label_pcs', p.id), { status: 'di_finishing' }); }
        catch (e) { console.error('Gagal update label_pcs.status ke di_finishing:', e); }
      }));
    } catch (e) { console.error('Gagal lazy-create finishing_track utk batch ' + (b.kode_batch || b.id) + ':', e); }
  }
  return await muatSemuaFinishingTrack();
}
async function updateFinishingTrack(trackId, mutator) {
  const ref = doc(db, 'finishing_track', trackId);
  await runTransaction(db, async (trx) => {
    const snap = await trx.get(ref);
    if (!snap.exists()) throw new Error('Dokumen finishing_track tidak ditemukan.');
    const data = snap.data();
    const patch = mutator(data) || {};
    trx.update(ref, { ...patch, diperbarui_pada: serverTimestamp() });
  });
}
// cariOperatorByKode — scan QR operator (keputusan #7): cocokkan ke `users` by
// email (isi QR pribadi karyawan SAMA seperti QR yang dipakai fitur lain, lihat
// Account > QR code pribadi).
async function cariOperatorByKode(kode) {
  const emailCoba = (kode || '').trim();
  if (!emailCoba) return null;
  try {
    const snap = await getDoc(doc(db, 'users', emailCoba));
    if (snap.exists()) { const u = snap.data(); return { uid: emailCoba, nama: u.nama || u.name || emailCoba }; }
  } catch (e) { console.error('Gagal cari operator by kode:', e); }
  return null;
}

// Popup Scan Masalah generik (jumlah kurang + alasan) — sumberJalur:'finishing'.
function popupMasalahMixin(kirimFn) {
  const popupMasalah = ref(null);
  function bukaMasalah(target) { popupMasalah.value = { target, jumlah: 1, alasan: '' }; }
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
async function kirimMasalahFinishing(t, jumlah, alasan) {
  await ajukanPersiapanMasalah({
    tlcAsal: TLC_ASAL_FINISHING, sumberJalur: 'finishing',
    trackId: t.id, noSpk: t.kode_batch,
    bahanNama: t.nama_produk, bahanWarna: t.kode_pcs, satuan: 'pcs',
    qtyKurang: jumlah, alasan
  });
  // riwayat_scan ditulis ADITIF. ajukanPersiapanMasalah cuma
  // menulis ke koleksi persiapan_masalah (fungsi generik dipakai semua pos,
  // TIDAK diubah di sini) — riwayat_scan finishing_track dicatat terpisah supaya
  // tidak ganggu jalur yang sudah ada.
  try {
    await updateFinishingTrack(t.id, () => ({
      riwayat_scan: arrayUnion({ aksi: 'masalah', oleh: window.currentUser?.email || null, pada: new Date().toISOString(), catatan: alasan, qty: jumlah })
    }));
  } catch (e) { console.error('Gagal catat riwayat_scan masalah Finishing:', e); }
}


// Popup gabungan "Scan Operator + Entry per Tahap" (wireframe 4.2a, keputusan
// #6/#7/#8) — dipakai ULANG di Tab 4.1 (tahap dikunci 'qc') & tiap sub-tab Tab
// 4.2. mode: 'operator' (scan QR operator dulu, gated PIC+) atau 'sendiri'
// (window.currentUser langsung, siapapun boleh akses menu edit).

function buatModalTahap(tahap, statusMasuk, statusSetelahSelesai) {
  return {
    props: { aktif: Boolean, mode: { type: String, default: 'operator' } },
    emits: ['tutup'],
    components: { ScanGenerik },
    setup(props, { emit }) {
      const langkah = ref(1); // 1 = scan operator (mode 'operator' saja), 2 = scan pcs
      const operatorTerpilih = ref(null);
      const log = ref([]);
      function mulai() {
        if (props.mode === 'sendiri') {
          operatorTerpilih.value = { uid: window.currentUser?.email, nama: window.currentUser?.nama || window.currentUser?.name || window.currentUser?.email };
          langkah.value = 2;
        } else { langkah.value = 1; operatorTerpilih.value = null; }
        log.value = [];
      }
      async function hasilScan(kodeMentah) {
        const kode = (kodeMentah || '').trim();
        if (langkah.value === 1) {
          const op = await cariOperatorByKode(kode);
          if (!op) { alert('QR operator tidak dikenali — pastikan scan QR pribadi karyawan.'); return; }
          operatorTerpilih.value = op; langkah.value = 2; return;
        }
        try {
          const snap = await getDocs(query(collection(db, 'finishing_track'), where('kode_pcs', '==', kode)));
          if (snap.empty) { alert(`Kode pcs "${kode}" tidak ditemukan.`); return; }
          const t = { id: snap.docs[0].id, ...snap.docs[0].data() };
          if (t.tahap_aktif !== tahap && !(tahap === 'qc' && t.status === 'perlu_diproses')) { alert(`Pcs "${kode}" tidak sedang di tahap ${LABEL_TAHAP[tahap]}.`); return; }
          if (tahap === 'qc' && t.status === 'perlu_diproses' && !t.terima_pada) { alert('Pcs ini belum di-Scan Sampai — lakukan Scan Sampai dulu di Tab Perlu Di Proses.'); return; }
          const now = new Date().toISOString();
          const idxTahap = URUTAN_TAHAP.indexOf(tahap);
          const tahapBerikut = URUTAN_TAHAP[idxTahap + 1] || 'selesai';
          const progressBaru = idxTahap + 1;
          // riwayat_scan ditulis ADITIF. mode 'operator' (PIC scan
          // QR operator lain lalu scan pcs, keputusan #6/#7) dipetakan ke aksi
          // 'operator'; mode 'sendiri' (operator scan dirinya sendiri, keputusan
          // #8) dipetakan ke aksi 'entry'.
          const aksiScan = props.mode === 'operator' ? 'operator' : 'entry';
          const patch = {
            ['op_' + tahap]: operatorTerpilih.value, ['scan_' + tahap + '_pada']: now,
            progress: progressBaru, tahap_aktif: tahapBerikut, masuk_tahap_pada: now,
            riwayat_scan: arrayUnion({ aksi: aksiScan, oleh: operatorTerpilih.value.nama || operatorTerpilih.value.uid, pada: now, qty: 1, catatan: 'Tahap ' + LABEL_TAHAP[tahap] })
          };
          if (tahap === 'qc' && t.status === 'perlu_diproses') patch.status = 'sedang_finishing';
          if (progressBaru >= 4) patch.status = 'perlu_dikirim';
          await updateFinishingTrack(t.id, () => patch);
          log.value.unshift(kode + ' -> ' + LABEL_TAHAP[tahap] + ' selesai (' + operatorTerpilih.value.nama + ')' + (progressBaru >= 4 ? ' — SEMUA TAHAP SELESAI' : ' -> lanjut ' + (LABEL_TAHAP[tahapBerikut] || tahapBerikut)));
        } catch (e) { console.error('Gagal scan entry tahap ' + tahap + ':', e); alert('Gagal menyimpan. Coba lagi.'); }
      }
      function tutup() { emit('tutup'); }
      onMounted(mulai);
      return { langkah, operatorTerpilih, log, hasilScan, tutup, LABEL_TAHAP, tahap };
    },
    template: `
      <scan-generik :aktif="aktif && langkah===1" judul="Scan QR Operator" :subjudul="'Pilih operator untuk tahap ' + LABEL_TAHAP[tahap] + '.'" @hasil="hasilScan" @tutup="tutup" />
      <scan-generik :aktif="aktif && langkah===2" :judul="'Scan Kode Pcs — ' + LABEL_TAHAP[tahap] + (operatorTerpilih ? (' (' + operatorTerpilih.nama + ')') : '')" subjudul="Bisa discan berkali-kali, tiap scan = 1 pcs selesai tahap ini." @hasil="hasilScan" @tutup="tutup" />
      <div v-if="aktif && langkah===2 && log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:300px;">
        <div v-for="(l,i) in log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
      </div>
    `
  };
}
const ModalTahapQc = buatModalTahap('qc');
const ModalTahapSteam = buatModalTahap('steam');
const ModalTahapFolding = buatModalTahap('folding');
const ModalTahapPacking = buatModalTahap('packing');
const MODAL_PER_TAHAP = { qc: ModalTahapQc, steam: ModalTahapSteam, folding: ModalTahapFolding, packing: ModalTahapPacking };


// TAB 4.1: Perlu Di Proses

const FinishingPerluDiProses = {
  components: { ScanGenerik, ScanTerpaduGenerik, ModalTahapQc },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const menuId = 'proses_finishing';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehOperator = computed(() => picOwnerKeAtas(window.currentUser));

    async function muat() {
      memuat.value = true;
      try { daftar.value = saringMilikOperatorSemuaTahap((await pastikanFinishingTrackLengkap()).filter(t => t.status === 'perlu_diproses')); }
      catch (e) { console.error('Gagal muat Finishing > Perlu Di Proses:', e); daftar.value = []; }
      memuat.value = false;
    }

    // Scan Sampai: step1 kode_tugas, step2 kode_bagging berkali-kali,
    // dicocokkan ke `separating_batch` (mengikuti pola Sewing keputusan #2).
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
          // cache tugas_kirim (kode sama dengan kode_tugas ini).
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
          } catch (e) { console.error('Gagal lepas pack tugas_kirim (Finishing):', e); }
        }
      }
      const sudahSemua = (b.kode_bagging || []).every(kb => modalSampai.log.includes(kb));
      if (sudahSemua) {
        try {
          const pcsBatch = daftar.value.filter(x => x.batch_id === b.id);
          if (!pcsBatch.length) { alert('Bagging cocok, tapi belum ada finishing_track untuk batch ini — coba tutup lalu buka lagi tab ini.'); return; }
          const now = new Date().toISOString();
          const olehSampai = window.currentUser?.email || null;
          // riwayat_scan ditulis ADITIF.
          await Promise.all(pcsBatch.map(t => updateFinishingTrack(t.id, () => ({ terima_pada: now, riwayat_scan: arrayUnion({ aksi: 'sampai', oleh: olehSampai, pada: now, qty: 1 }) }))));
          modalSampai.log.unshift('SEMUA bagging sampai — batch ' + (b.kode_batch || '') + ' (' + pcsBatch.length + ' pcs) siap ditunjuk operator QC');
          await muat();
        } catch (e) { console.error('Gagal simpan scan sampai Finishing:', e); alert('Gagal menyimpan. Coba lagi.'); }
      }
    }

    // Scan Unpack: scan ULANG tiap isi bagging (bagging.isi[]), lihat
    // Scan Unpack — konversi ke buatScanTerpadu (Draft/Upload), gantikan
    // buatUnpackUniversal lama. Sama persis pola vue-pp-cutting.js: kunci Kode
    // Bagging dulu, scan ulang isi berkali-kali, Upload cuma menutup KOMPLIT
    // kalau semua isi cocok tanpa kode asing — kalau tidak, pakai "Paksa
    // INKOMPLIT" di chip atas.
    async function tulisTutupUnpack(b, dicocokkan, asing, hilang, cocokSemua) {
      const now = new Date().toISOString();
      try {
        await updateDoc(doc(db, 'bagging', b.id), {
          kode_spk: null, kode_batch: null,
          kode_spk_asal: b.kode_spk ?? null, kode_batch_asal: b.kode_batch ?? null,
          unpack_hasil: cocokSemua ? 'komplit' : 'inkomplit',
          unpack_pada: now, unpack_oleh: window.currentUser?.email || null,
          unpack_dicocokkan: dicocokkan, unpack_asing: asing, unpack_hilang: hilang
        });
        await muat();
        return { ok: true };
      } catch (e) { console.error('Gagal menutup Scan Unpack:', e); return { ok: false, pesan: 'Gagal menyimpan. Coba lagi.' }; }
    }
    const unpackTerpadu = buatScanTerpadu({
      judul: 'Scan Unpack — Bagging', subjudul: 'Kunci kode bagging, lalu scan ulang tiap isinya',
      twoStep: {
        labelPertama: 'Kode Bagging', labelKedua: 'Isi Bagging',
        placeholderPertama: 'Scan/ketik kode bagging', placeholderKedua: 'Scan ulang tiap barang di dalam bagging',
        camModePertama: 'Mode: Scan Kode Bagging', camModeKedua: 'Mode: Scan Isi Bagging (berkali-kali)',
        kosongUtama: 'Scan Kode Bagging dulu', kosongSub: 'Sama seperti kode yang discan waktu Scan Pack.',
        validasi: async (kode) => {
          const snap = await getDocs(query(collection(db, 'bagging'), where('kode', '==', kode)));
          if (snap.empty) return { ok: false, pesan: `Kode bagging "${kode}" tidak ditemukan.` };
          return { ok: true, data: { id: snap.docs[0].id, ...snap.docs[0].data() } };
        }
      },
      validasiIsi: async (kode, locked) => {
        if (locked.unpack_hasil) return { ok: false, pesan: 'Bagging ini sudah ditutup (sudah di-Unpack sebelumnya) — tidak bisa discan ulang.' };
        const isi = Array.isArray(locked.isi) ? locked.isi : [];
        if (!isi.includes(kode)) return { ok: true, row: { kode, label: 'ASING — tidak ada di isi bagging saat Scan Pack', tagTxt: 'asing', tagCls: 'warn', asing: true } };
        return { ok: true, row: { kode, label: 'cocok', tagTxt: 'cocok', tagCls: 'ok', asing: false } };
      },
      padaUpload: async (rows, locked) => {
        const isi = Array.isArray(locked.isi) ? locked.isi : [];
        const dicocokkan = rows.filter(r => !r.asing).map(r => r.kode);
        const asingList = rows.filter(r => r.asing).map(r => r.kode);
        const hilang = isi.filter(k => !dicocokkan.includes(k));
        if (hilang.length || asingList.length) return { ok: false, pesan: `Belum lengkap: ${dicocokkan.length}/${isi.length} cocok` + (asingList.length ? `, ${asingList.length} asing` : '') + '. Scan sisanya, atau pakai "Paksa INKOMPLIT" di chip atas.' };
        return tulisTutupUnpack(locked, dicocokkan, asingList, hilang, true);
      },
      aksiEkstra: [{
        label: 'Paksa INKOMPLIT',
        aksi: async (locked) => {
          if (locked.unpack_hasil) { alert('Bagging ini sudah ditutup.'); return; }
          if (!confirm(`Tutup bagging "${locked.kode}" sebagai INKOMPLIT? Kode yang belum cocok akan dicatat hilang.`)) return;
          const isi = Array.isArray(locked.isi) ? locked.isi : [];
          const dicocokkan = unpackTerpadu.s.rows.filter(r => !r.asing).map(r => r.kode);
          const asingList = unpackTerpadu.s.rows.filter(r => r.asing).map(r => r.kode);
          const hilang = isi.filter(k => !dicocokkan.includes(k));
          const hasil = await tulisTutupUnpack(locked, dicocokkan, asingList, hilang, false);
          if (hasil.ok) unpackTerpadu.resetLock(); else alert(hasil.pesan);
        }
      }]
    });

    // Tunjuk Operator QC (popup gabungan, keputusan #6)
    const modalOperatorQcAktif = ref(false);
    function bukaOperatorQc() { modalOperatorQcAktif.value = true; }
    function tutupOperatorQc() { modalOperatorQcAktif.value = false; muat(); }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahFinishing(p.target, p.jumlah, p.alasan);
      await muat();
    });

    // Kelompokkan tampilan per batch supaya tidak 1 baris per pcs (bisa ratusan
    // pcs) — kartu per batch, jumlah pcs & status terima ditampilkan ringkas
    // (SAMA semangat "papan admin, bukan operator" seperti pos lain).
    const kelompokBatch = computed(() => {
      const peta = {};
      daftar.value.forEach(t => {
        const key = t.batch_id;
        if (!peta[key]) peta[key] = { batchId: key, kodeBatch: t.kode_batch, namaProduk: t.nama_produk, size: t.size, pcs: [], terimaPada: t.terima_pada, masukTahapPada: t.masuk_tahap_pada };
        peta[key].pcs.push(t);
      });
      return Object.values(peta);
    });

    // Toolbar global (wireframe §4.1, pola sama Sewing 3.1): Scan Sampai & Scan
    // Unpack global secara logic (tanpa parameter batch). Scan Masalah butuh 1
    // pcs target, jadi lewat popup "pilih batch dulu". "Tunjuk Operator QC"
    // tetap 1 tombol kontekstual per kartu, nonaktif kalau batch belum sampai.
    const pilihMasalah = ref(null); // { targetId: batchId }
    function bukaMasalahToolbar() {
      if (!kelompokBatch.value.length) { alert('Tidak ada batch di tab ini untuk dilaporkan.'); return; }
      pilihMasalah.value = { targetId: kelompokBatch.value[0].batchId };
    }
    function batalPilihMasalah() { pilihMasalah.value = null; }
    function konfirmasiPilihMasalah() {
      const g = kelompokBatch.value.find(x => x.batchId === pilihMasalah.value.targetId);
      pilihMasalah.value = null;
      if (g) bukaMasalah(g.pcs[0]);
    }

    onMounted(async () => { await window.authReady; await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, kelompokBatch, bolehProses, bolehOperator, formatQty, formatDiamSejak, tertahan,
      modalSampai, bukaScanSampai, tutupScanSampai, hasilScanSampai,
      unpackTerpadu,
      modalOperatorQcAktif, bukaOperatorQc, tutupOperatorQc,
      popupMasalah, batalMasalah, konfirmasiMasalah,
      pilihMasalah, bukaMasalahToolbar, batalPilihMasalah, konfirmasiPilihMasalah,
      aksiAktif
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <!-- Toolbar global — Scan Sampai & Scan Unpack global dari sisi logic, tampilannya
        dikumpulkan di sini. Scan Masalah lewat popup pilih-batch. -->
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <button v-if="bolehProses && aksiAktif('sub-pr-finishing','finishing_sampai')" @click="bukaScanSampai" class="btn-primary" style="flex:1; min-width:120px; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Sampai</button>
        <button v-if="bolehProses && aksiAktif('sub-pr-finishing','finishing_unpack')" @click="unpackTerpadu.buka" class="btn-outline" style="flex:1; min-width:120px; padding:9px;"><i class="fas fa-box-open" style="margin-right:6px;"></i>Scan Unpack</button>
        <button v-if="bolehProses" @click="bukaMasalahToolbar" class="btn-outline" style="flex:1; min-width:120px; padding:9px; color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>Scan Masalah</button>
      </div>
      <div v-if="kelompokBatch.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-inbox"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada batch yang perlu diproses</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="g in kelompokBatch" :key="g.batchId" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(g.masukTahapPada) ? 'var(--warn-light)' : '' }">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ g.kodeBatch }}</div>
            <span class="tag" :class="tertahan(g.masukTahapPada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(g.masukTahapPada) }}</span>
          </div>
          <div style="font-size:12px; color:var(--text-faint); margin-bottom:6px;">{{ g.namaProduk }} &middot; size {{ g.size || '-' }} &middot; {{ g.pcs.length }} pcs</div>
          <div style="font-size:10.5px; margin-bottom:10px;">
            <span class="tag" :class="g.terimaPada ? 'ok' : 'neutral'">{{ g.terimaPada ? 'sudah sampai' : 'belum sampai' }}</span>
          </div>
          <!--
            Satu tombol kontekstual (wireframe §4.1): Scan Operator QC, mati kalau batch belum
            sampai (kartu INKOMPLIT wireframe tidak menampilkan tombol apapun).
          -->
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button v-if="bolehOperator && aksiAktif('sub-pr-finishing','finishing_operator_qc_persiapan')" @click="bukaOperatorQc" :disabled="!g.terimaPada" class="btn-outline" style="flex:1; padding:8px; font-size:11.5px;" :style="{ opacity: g.terimaPada ? 1 : .5 }"><i class="fas fa-user-check" style="margin-right:4px;"></i>Scan Operator QC</button>
          </div>
        </div>
      </div>
    </template>

    <scan-generik :aktif="modalSampai.aktif" :judul="modalSampai.batch ? ('Scan kode bagging — tugas ' + modalSampai.batch.kode_tugas) : 'Scan Kode Tugas'" subjudul="Bisa discan berkali-kali (tiap kode bagging = 1 pack dari Serie)." @hasil="hasilScanSampai" @tutup="tutupScanSampai" />
    <div v-if="modalSampai.aktif && modalSampai.batch && modalSampai.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:280px;">
      <div v-for="(l,i) in modalSampai.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>

    <scan-terpadu-generik :c="unpackTerpadu" />

    <modal-tahap-qc :aktif="modalOperatorQcAktif" mode="operator" @tutup="tutupOperatorQc" />

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.target.kode_batch }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah (pcs)</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. kiriman dari Serie cacat"></div>
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
          <select v-model="pilihMasalah.targetId"><option v-for="g in kelompokBatch" :key="g.batchId" :value="g.batchId">{{ g.kodeBatch }} — {{ g.namaProduk }}</option></select>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="batalPilihMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiPilihMasalah" class="btn-primary" style="flex:1; padding:9px;">Lanjut</button>
        </div>
      </div>
    </div>
  `
};


// TAB 4.2: Sedang Finishing — 4 sub-tab horizontal (QC/Steam/Folding/ Packing,
// "sub-tab horizontal 4 tahap"). 1 komponen dipakai ULANG lewat factory, filter
// finishing_track by tahap_aktif.

function buatSubTabFinishing(tahap) {
  const ModalTahap = MODAL_PER_TAHAP[tahap];
  return {
    components: { ModalTahap },
    setup() {
      const memuat = ref(true);
      const daftar = ref([]);
      const menuId = 'proses_finishing';
      const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
      const bolehOperator = computed(() => picOwnerKeAtas(window.currentUser));

      async function muat() {
        memuat.value = true;
        try { daftar.value = saringMilikOperator((await muatSemuaFinishingTrack()).filter(t => t.status === 'sedang_finishing' && t.tahap_aktif === tahap), tahap); }
        catch (e) { console.error('Gagal muat Finishing > Sedang Finishing > ' + tahap + ':', e); daftar.value = []; }
        memuat.value = false;
      }

      const kelompokBatch = computed(() => {
        const peta = {};
        daftar.value.forEach(t => {
          const key = t.batch_id;
          if (!peta[key]) peta[key] = { batchId: key, kodeBatch: t.kode_batch, namaProduk: t.nama_produk, size: t.size, pcs: [], masukTahapPada: t.masuk_tahap_pada };
          peta[key].pcs.push(t);
        });
        return Object.values(peta);
      });

      const modalOperatorAktif = ref(false);
      const modalEntriAktif = ref(false);
      function bukaOperator() { modalOperatorAktif.value = true; }
      function tutupOperator() { modalOperatorAktif.value = false; muat(); }
      function bukaEntri() { modalEntriAktif.value = true; }
      function tutupEntri() { modalEntriAktif.value = false; muat(); }

      const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
        await kirimMasalahFinishing(p.target, p.jumlah, p.alasan);
        await muat();
      });

      onMounted(async () => { await window.authReady; await pastikanCachePilihanScan(); await muat(); });

      return {
        memuat, muat, kelompokBatch, bolehProses, bolehOperator, formatQty, formatDiamSejak, tertahan,
        modalOperatorAktif, bukaOperator, tutupOperator, modalEntriAktif, bukaEntri, tutupEntri,
        popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah,
        LABEL_TAHAP, tahap, aksiAktif,
        targetIdTahap: TARGET_ID_SEDANG_TAHAP[tahap], aksiOperatorTahap: AKSI_OPERATOR_SEDANG_TAHAP[tahap], aksiEntryTahap: AKSI_ENTRY_SEDANG_TAHAP[tahap]
      };
    },
    template: `
      <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <template v-else>
        <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
          <button v-if="bolehOperator && aksiAktif(targetIdTahap, aksiOperatorTahap)" @click="bukaOperator" class="btn-primary" style="flex:1; min-width:160px; padding:9px;"><i class="fas fa-user-check" style="margin-right:6px;"></i>Scan Operator (tunjuk)</button>
          <button v-if="bolehProses && aksiAktif(targetIdTahap, aksiEntryTahap)" @click="bukaEntri" class="btn-outline" style="flex:1; min-width:160px; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Entry (diri sendiri)</button>
        </div>
        <div v-if="kelompokBatch.length === 0" class="gc-kosong gc-card">
          <div class="lingkaran"><i class="fas fa-check-double"></i></div>
          <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada pcs di tahap {{ LABEL_TAHAP[tahap] }}</h3>
        </div>
        <div v-else style="display:flex; flex-direction:column; gap:12px;">
          <div v-for="g in kelompokBatch" :key="g.batchId" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
              <div class="gc-heading" style="font-weight:700; font-size:12.5px;">{{ g.kodeBatch }}</div>
              <span class="tag neutral">{{ g.pcs.length }} pcs</span>
            </div>
            <div style="font-size:11px; color:var(--text-faint); margin-bottom:8px;">{{ g.namaProduk }} size {{ g.size || '-' }}</div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              <div v-for="t in g.pcs" :key="t.id" style="display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:11px; padding:6px 8px; border-radius:10px;" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : 'transparent' }">
                <span class="gc-num" style="font-weight:700;">{{ t.kode_pcs }}</span>
                <span style="color:var(--text-faint);">progress {{ t.progress }}/4</span>
                <button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="padding:4px 8px; font-size:10px; color:var(--danger);"><i class="fas fa-triangle-exclamation"></i></button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <component :is="'ModalTahap'" :aktif="modalOperatorAktif" mode="operator" @tutup="tutupOperator" />
      <component :is="'ModalTahap'" :aktif="modalEntriAktif" mode="sendiri" @tutup="tutupEntri" />

      <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
        <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
          <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.target.kode_pcs }}</h3>
          <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah (pcs)</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
          <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. QC gagal - jahitan cacat"></div>
          <div style="display:flex; gap:8px;">
            <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
            <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
          </div>
        </div>
      </div>
    `
  };
}
const FinishingSedangQc = buatSubTabFinishing('qc');
const FinishingSedangSteam = buatSubTabFinishing('steam');
const FinishingSedangFolding = buatSubTabFinishing('folding');
const FinishingSedangPacking = buatSubTabFinishing('packing');


// TAB 4.3: Perlu Dikirim — Cetak Bagging + Kode Tugas -> Serie (keputusan #9).

const FinishingPerluDikirim = {
  components: { PopupPratinjauCetakLabel, ScanGenerik },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const sedangProses = ref(false);
    const menuId = 'proses_finishing';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);

    async function muat() {
      memuat.value = true;
      try { daftar.value = saringMilikOperatorSemuaTahap((await muatSemuaFinishingTrack()).filter(t => t.status === 'perlu_dikirim')); }
      catch (e) { console.error('Gagal muat Finishing > Perlu Dikirim:', e); daftar.value = []; }
      memuat.value = false;
    }
    const kelompokBatch = computed(() => {
      const peta = {};
      daftar.value.forEach(t => {
        const key = t.batch_id;
        if (!peta[key]) peta[key] = { batchId: key, kodeBatch: t.kode_batch, kodeSpk: t.kode_spk || [], namaProduk: t.nama_produk, size: t.size, pcs: [], sudahKirim: !!t.kode_tugas, masukTahapPada: t.masuk_tahap_pada };
        peta[key].pcs.push(t);
      });
      return Object.values(peta);
    });

    // Cetak Bagging + Kode Tugas (1 kode masing2, ditulis ke SEMUA pcs batch
    // itu, keputusan #9).
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    async function cetakBaggingTugas(g) {
      if (g.sudahKirim) { if (!confirm('Batch ini sudah pernah dicetak bagging + kode tugas. Cetak ULANG (kode baru)?')) return; }
      sedangProses.value = true;
      try {
        const kodeBag = await generateKodeHarianFormat('BAG', 'pengaturan_id_bagging');
        // kode_spk/kode_batch ditulis LANGSUNG saat dibuat — grup ini
        // sudah pasti 1 batch (kelompokBatch dikunci per batch_id).
        await addDoc(collection(db, 'bagging'), {
          kode: kodeBag, produk_label: `${g.kodeBatch} &middot; ${g.namaProduk}`, isi: [], ditutup_pada: null,
          kode_spk: g.kodeSpk || [], kode_batch: g.kodeBatch || null,
          dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
        });
        const kodeTugas = await generateKodeHarianFormat('TGS', 'pengaturan_id_tugas_kirim');
        await addDoc(collection(db, 'tugas_kirim'), {
          kode: kodeTugas, tlc_asal: TLC_ASAL_FINISHING, tlc_tujuan: TLC_TUJUAN_SERIE, pack: [],
          dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
        });
        await Promise.all(g.pcs.map(t => updateFinishingTrack(t.id, () => ({ kode_bagging: kodeBag, kode_tugas: kodeTugas }))));
        daftarLabelPreview.value = [
          { kode: kodeBag, nama: 'Kode Bagging', info: `${g.kodeBatch} &middot; ${g.namaProduk} &middot; ${g.pcs.length} pcs`, qrDataUrl: buatQrDataUrl(kodeBag) },
          { kode: kodeTugas, nama: 'Kode Tugas — Serie', info: `TLC-FIN &rarr; TLC-SER &middot; ${g.kodeBatch}`, qrDataUrl: buatQrDataUrl(kodeTugas) }
        ];
        popupCetakAktif.value = true;
        await muat();
      } catch (e) { console.error('Gagal cetak bagging + kode tugas Finishing:', e); alert('Gagal mencetak. Coba lagi.'); }
      sedangProses.value = false;
    }

    // Scan Pack: step1 kode bagging, step2 kode pcs berkali-kali
    const modalPack = reactive({ aktif: false, kodeBagging: null, log: [] });
    function bukaScanPack() { modalPack.kodeBagging = null; modalPack.log = []; modalPack.aktif = true; }
    function tutupScanPack() { modalPack.aktif = false; modalPack.kodeBagging = null; modalPack.log = []; muat(); }
    async function hasilScanPack(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      if (!modalPack.kodeBagging) {
        try {
          const snap = await getDocs(query(collection(db, 'bagging'), where('kode', '==', kode), where('ditutup_pada', '==', null)));
          if (snap.empty) { alert(`Kode bagging "${kode}" tidak ditemukan atau sudah ditutup.`); return; }
          modalPack.kodeBagging = kode;
        } catch (e) { console.error('Gagal cari kode bagging:', e); alert('Gagal mencari kode bagging. Coba lagi.'); }
        return;
      }
      try {
        const snap = await getDocs(query(collection(db, 'finishing_track'), where('kode_bagging', '==', modalPack.kodeBagging), where('kode_pcs', '==', kode)));
        if (snap.empty) { alert(`Kode pcs "${kode}" tidak terkait bagging ini.`); return; }
        await updateDoc(doc(db, 'bagging', (await getDocs(query(collection(db, 'bagging'), where('kode', '==', modalPack.kodeBagging)))).docs[0].id), { isi: arrayUnion(kode) });
        // riwayat_scan ditulis ADITIF.
        await updateFinishingTrack(snap.docs[0].id, () => ({
          riwayat_scan: arrayUnion({ aksi: 'pack', oleh: window.currentUser?.email || null, pada: new Date().toISOString(), qty: 1 })
        }));
        modalPack.log.unshift(kode + ' -> ' + modalPack.kodeBagging);
      } catch (e) { console.error('Gagal scan pack Finishing:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }
    async function tutupBaggingPack() {
      if (!modalPack.kodeBagging) return;
      try {
        const snap = await getDocs(query(collection(db, 'bagging'), where('kode', '==', modalPack.kodeBagging)));
        if (!snap.empty) await updateDoc(doc(db, 'bagging', snap.docs[0].id), { ditutup_pada: serverTimestamp() });
      } catch (e) { console.error('Gagal tutup bagging:', e); alert('Gagal menutup bagging. Coba lagi.'); }
      modalPack.kodeBagging = null;
    }

    // Scan Kirim: step1 kode tugas, step2 kode bagging
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
      const g = kelompokBatch.value.find(x => x.pcs[0] && x.pcs[0].kode_tugas === modalKirim.tugas.kode && x.pcs[0].kode_bagging === kode);
      if (!g) { alert(`Kode bagging "${kode}" tidak cocok dengan tugas ini.`); return; }
      try {
        // kode_spk/kode_batch ikut disalin ke pack[], dilepas oleh Scan
        // Sampai (sampai_pada).
        await updateDoc(doc(db, 'tugas_kirim', modalKirim.tugas.id), {
          pack: arrayUnion({ kode_bagging: kode, kode_spk: g.kodeSpk || [], kode_batch: g.kodeBatch || null, pada: new Date().toISOString(), sampai_pada: null })
        });
        const now = new Date().toISOString();
        const olehKirim = window.currentUser?.email || null;
        // riwayat_scan ditulis ADITIF.
        await Promise.all(g.pcs.map(t => updateFinishingTrack(t.id, () => ({ status: 'sedang_dikirim', masuk_tahap_pada: now, riwayat_scan: arrayUnion({ aksi: 'kirim', oleh: olehKirim, pada: now, qty: 1 }) }))));
        modalKirim.log.unshift(kode + ' -> ' + modalKirim.tugas.kode + ' (' + g.pcs.length + ' pcs pindah ke Sedang Kirim)');
        await muat();
      } catch (e) { console.error('Gagal scan kirim Finishing:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahFinishing(p.target, p.jumlah, p.alasan);
      await muat();
    });

    onMounted(async () => { await window.authReady; await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, kelompokBatch, bolehProses, bolehCetak, sedangProses, formatQty, formatDiamSejak, tertahan,
      popupCetakAktif, daftarLabelPreview, cetakBaggingTugas,
      modalPack, bukaScanPack, tutupScanPack, hasilScanPack, tutupBaggingPack,
      modalKirim, bukaScanKirim, tutupScanKirim, hasilScanKirim,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah,
      aksiAktif
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div v-if="bolehProses" style="display:flex; gap:8px; margin-bottom:12px;">
        <button v-if="aksiAktif('sub-pr-finishing','finishing_pack')" @click="bukaScanPack" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Pack</button>
        <button v-if="aksiAktif('sub-pr-finishing','finishing_kirim')" @click="bukaScanKirim" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-paper-plane" style="margin-right:6px;"></i>Scan Kirim</button>
      </div>
      <div v-if="kelompokBatch.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-box-open"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada batch yang perlu dikirim</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="g in kelompokBatch" :key="g.batchId" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(g.masukTahapPada) ? 'var(--warn-light)' : '' }">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ g.kodeBatch }}</div>
            <span class="tag" :class="tertahan(g.masukTahapPada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(g.masukTahapPada) }}</span>
          </div>
          <div style="font-size:12px; color:var(--text-faint); margin-bottom:6px;">{{ g.namaProduk }} &middot; size {{ g.size || '-' }} &middot; {{ g.pcs.length }} pcs</div>
          <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:10px;">
            <span v-if="g.pcs[0].kode_tugas" class="tag ok">{{ g.pcs[0].kode_tugas }} &rarr; Serie</span>
            <span v-else class="tag neutral">belum dicetak bagging/kode tugas</span>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button v-if="bolehCetak" @click="cetakBaggingTugas(g)" :disabled="sedangProses" class="btn-outline" style="flex:1; min-width:170px; padding:8px; font-size:11.5px;"><i class="fas fa-print" style="margin-right:4px;"></i>{{ g.sudahKirim ? 'Cetak Ulang' : 'Cetak' }} Bagging + Kode Tugas</button>
            <button v-if="bolehProses" @click="bukaMasalah(g.pcs[0])" class="btn-outline" style="flex:1; min-width:120px; padding:8px; font-size:11.5px; color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
          </div>
        </div>
      </div>
    </template>

    <!--
      jenis-cetak dipatok 'kode_bagging' — lihat catatan sama di vue-pp-cutting.js (cetak gabungan
      bagging+tugas 1 job cetak).
    -->
    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Bagging + Kode Tugas" :daftar-label="daftarLabelPreview" jenis-cetak="kode_bagging" @tutup="popupCetakAktif = false" />

    <scan-generik :aktif="modalPack.aktif" :judul="modalPack.kodeBagging ? ('Scan kode pcs — bagging ' + modalPack.kodeBagging) : 'Scan Kode Bagging'" subjudul="Bisa discan berkali-kali. Tutup lewat tombol di bawah kalau sudah selesai." @hasil="hasilScanPack" @tutup="tutupScanPack" />
    <div v-if="modalPack.aktif && modalPack.kodeBagging" style="position:fixed; left:16px; bottom:16px; z-index:10001; display:flex; flex-direction:column; gap:8px; max-width:260px;">
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
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah (pcs)</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. label pcs rusak"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};


// TAB 4.4: Sedang Kirim — read-only tracking per kode tugas.

const FinishingSedangKirim = {
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const menuId = 'proses_finishing';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try { daftar.value = saringMilikOperatorSemuaTahap((await muatSemuaFinishingTrack()).filter(t => t.status === 'sedang_dikirim')); }
      catch (e) { console.error('Gagal muat Finishing > Sedang Kirim:', e); daftar.value = []; }
      memuat.value = false;
    }
    const kelompokTugas = computed(() => {
      const peta = {};
      daftar.value.forEach(t => {
        const key = t.kode_tugas || '(tanpa kode tugas)';
        if (!peta[key]) peta[key] = { kodeTugas: key, pcs: [] };
        peta[key].pcs.push(t);
      });
      return Object.values(peta);
    });

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahFinishing(p.target, p.jumlah, p.alasan);
      await muat();
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return { muat, memuat, kelompokTugas, bolehProses, formatDiamSejak, tertahan, popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah };
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
            <div v-for="t in g.pcs" :key="t.id" style="display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:11px; padding:6px 8px; border-radius:10px;" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : 'transparent' }">
              <span class="gc-num" style="font-weight:700;">{{ t.kode_pcs }}</span>
              <span style="color:var(--text-faint);">{{ t.nama_produk }} size {{ t.size || '-' }}</span>
              <button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="padding:4px 8px; font-size:10px; color:var(--danger);"><i class="fas fa-triangle-exclamation"></i></button>
            </div>
          </div>
        </div>
      </div>
      <div style="margin-top:10px; font-size:10.5px; color:var(--text-faint); text-align:center;">Tab ini read-only — baris pindah ke Selesai otomatis begitu Serie melakukan Scan Sampai (Tab 2.9 Terima Finishing, modul Serie).</div>
    </template>

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.target.kode_pcs }}</h3>
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


// TAB 4.5: Selesai — riwayat per pcs, read-only, 4 operator per baris . Terisi
// begitu Serie Scan Sampai di 2.9 (SUDAH BISA).

const FinishingSelesai = {
  setup() {
    const memuat = ref(true);
    const semuaSelesai = ref([]);
    const kataKunci = ref('');
    const dariTanggal = ref('');
    const sampaiTanggal = ref('');

    async function muat() {
      memuat.value = true;
      try { semuaSelesai.value = saringMilikOperatorSemuaTahap((await muatSemuaFinishingTrack()).filter(t => t.status === 'selesai')).sort((a, b) => new Date(b.sampai_pada || 0) - new Date(a.sampai_pada || 0)); }
      catch (e) { console.error('Gagal muat Finishing > Selesai:', e); semuaSelesai.value = []; }
      memuat.value = false;
    }

    const selesaiHariIni = computed(() => semuaSelesai.value.filter(t => hariIniSama(t.sampai_pada)));
    const daftarUrut = computed(() => {
      let hasil = semuaSelesai.value;
      const kata = kataKunci.value.trim().toLowerCase();
      if (kata) hasil = hasil.filter(t => (t.kode_pcs || '').toLowerCase().includes(kata) || (t.kode_batch || '').toLowerCase().includes(kata) || (t.nama_produk || '').toLowerCase().includes(kata));
      if (dariTanggal.value) hasil = hasil.filter(t => t.sampai_pada && new Date(t.sampai_pada) >= new Date(dariTanggal.value));
      if (sampaiTanggal.value) hasil = hasil.filter(t => t.sampai_pada && new Date(t.sampai_pada) <= new Date(sampaiTanggal.value + 'T23:59:59'));
      return hasil;
    });

    function unduhCsv() {
      if (!daftarUrut.value.length) { alert('Tidak ada data untuk diunduh.'); return; }
      const header = ['Kode Pcs', 'Kode Batch', 'Produk', 'Size', 'Op QC', 'Op Steam', 'Op Folding', 'Op Packing', 'Kode Tugas', 'Selesai Pada'];
      const baris = daftarUrut.value.map(t => [t.kode_pcs, t.kode_batch, t.nama_produk, t.size, t.op_qc?.nama, t.op_steam?.nama, t.op_folding?.nama, t.op_packing?.nama, t.kode_tugas, formatWaktu(t.sampai_pada)]);
      const csv = [header, ...baris].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `finishing-selesai-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    onMounted(async () => { await window.authReady; await muat(); });

    return { muat, memuat, daftarUrut, selesaiHariIni, kataKunci, dariTanggal, sampaiTanggal, unduhCsv, formatWaktu };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div class="gc-card" style="padding:12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <div style="font-size:12px; color:var(--text-faint);">Selesai hari ini</div>
        <div class="gc-num" style="font-weight:700; font-size:16px;">{{ selesaiHariIni.length }}</div>
      </div>
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <input v-model="kataKunci" type="text" placeholder="Cari kode pcs / batch / produk..." style="flex:2; min-width:160px; padding:8px; background:var(--ivory-dim); border-radius:10px; border:1px solid var(--line);">
        <input v-model="dariTanggal" type="date" style="flex:1; min-width:130px; padding:8px; border-radius:10px; border:1px solid var(--line);">
        <input v-model="sampaiTanggal" type="date" style="flex:1; min-width:130px; padding:8px; border-radius:10px; border:1px solid var(--line);">
        <button @click="unduhCsv" class="btn-outline" style="padding:8px 14px; font-size:11.5px;"><i class="fas fa-download" style="margin-right:6px;"></i>Unduh CSV</button>
      </div>

      <div v-if="daftarUrut.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-circle-check"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada riwayat Selesai</h3>
        <p style="font-size:11px; color:var(--text-faint); margin-top:6px;">Tab ini terisi otomatis begitu Serie melakukan Scan Sampai di Tab 2.9 "Terima Finishing" — bukan error.</p>
      </div>
      <div v-else class="gc-card" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead><tr style="text-align:left; border-bottom:1px solid var(--line);">
            <th style="padding:6px 8px;">Kode Pcs</th><th style="padding:6px 8px;">Batch</th><th style="padding:6px 8px;">Produk</th>
            <th style="padding:6px 8px;">QC</th><th style="padding:6px 8px;">Steam</th><th style="padding:6px 8px;">Folding</th><th style="padding:6px 8px;">Packing</th>
            <th style="padding:6px 8px;">Selesai</th>
          </tr></thead>
          <tbody>
            <tr v-for="t in daftarUrut" :key="t.id" style="border-bottom:1px solid var(--line);">
              <td style="padding:6px 8px;" class="gc-num">{{ t.kode_pcs }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ t.kode_batch }}</td>
              <td style="padding:6px 8px;">{{ t.nama_produk }} {{ t.size }}</td>
              <td style="padding:6px 8px;">{{ t.op_qc?.nama || '-' }}</td>
              <td style="padding:6px 8px;">{{ t.op_steam?.nama || '-' }}</td>
              <td style="padding:6px 8px;">{{ t.op_folding?.nama || '-' }}</td>
              <td style="padding:6px 8px;">{{ t.op_packing?.nama || '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatWaktu(t.sampai_pada) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  `
};

// Mount ke index.html — LAZY, SAMA pola Cutting/Serie/Sewing.
let vmFinishingPerluDiProses = null;
window.pastikanMountFinishingPerluDiProses = function () {
  if (vmFinishingPerluDiProses) { if (typeof vmFinishingPerluDiProses.muat === 'function') vmFinishingPerluDiProses.muat(); return; }
  const mountPoint = document.getElementById('vue-finishing-perludiproses');
  if (mountPoint) vmFinishingPerluDiProses = createApp(FinishingPerluDiProses).mount('#vue-finishing-perludiproses');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaFinishingSampai = function () { window.pastikanMountFinishingPerluDiProses(); if (vmFinishingPerluDiProses) vmFinishingPerluDiProses.bukaScanSampai(); };
window.bukaFinishingUnpack = function () { window.pastikanMountFinishingPerluDiProses(); if (vmFinishingPerluDiProses) vmFinishingPerluDiProses.unpackTerpadu.buka(); };
window.bukaFinishingOperatorQcPersiapan = function () { window.pastikanMountFinishingPerluDiProses(); if (vmFinishingPerluDiProses) vmFinishingPerluDiProses.bukaOperatorQc(); };
let vmFinishingSedangQc = null;
window.pastikanMountFinishingSedangQc = function () {
  if (vmFinishingSedangQc) { if (typeof vmFinishingSedangQc.muat === 'function') vmFinishingSedangQc.muat(); return; }
  const mountPoint = document.getElementById('vue-finishing-sedangqc');
  if (mountPoint) vmFinishingSedangQc = createApp(FinishingSedangQc).mount('#vue-finishing-sedangqc');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaFinishingOperatorQc = function () { window.pastikanMountFinishingSedangQc(); if (vmFinishingSedangQc) vmFinishingSedangQc.bukaOperator(); };
window.bukaFinishingEntryQc = function () { window.pastikanMountFinishingSedangQc(); if (vmFinishingSedangQc) vmFinishingSedangQc.bukaEntri(); };
let vmFinishingSedangSteam = null;
window.pastikanMountFinishingSedangSteam = function () {
  if (vmFinishingSedangSteam) { if (typeof vmFinishingSedangSteam.muat === 'function') vmFinishingSedangSteam.muat(); return; }
  const mountPoint = document.getElementById('vue-finishing-sedangsteam');
  if (mountPoint) vmFinishingSedangSteam = createApp(FinishingSedangSteam).mount('#vue-finishing-sedangsteam');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaFinishingOperatorSteam = function () { window.pastikanMountFinishingSedangSteam(); if (vmFinishingSedangSteam) vmFinishingSedangSteam.bukaOperator(); };
window.bukaFinishingEntrySteam = function () { window.pastikanMountFinishingSedangSteam(); if (vmFinishingSedangSteam) vmFinishingSedangSteam.bukaEntri(); };
let vmFinishingSedangFolding = null;
window.pastikanMountFinishingSedangFolding = function () {
  if (vmFinishingSedangFolding) { if (typeof vmFinishingSedangFolding.muat === 'function') vmFinishingSedangFolding.muat(); return; }
  const mountPoint = document.getElementById('vue-finishing-sedangfolding');
  if (mountPoint) vmFinishingSedangFolding = createApp(FinishingSedangFolding).mount('#vue-finishing-sedangfolding');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaFinishingOperatorFolding = function () { window.pastikanMountFinishingSedangFolding(); if (vmFinishingSedangFolding) vmFinishingSedangFolding.bukaOperator(); };
window.bukaFinishingEntryFolding = function () { window.pastikanMountFinishingSedangFolding(); if (vmFinishingSedangFolding) vmFinishingSedangFolding.bukaEntri(); };
let vmFinishingSedangPacking = null;
window.pastikanMountFinishingSedangPacking = function () {
  if (vmFinishingSedangPacking) { if (typeof vmFinishingSedangPacking.muat === 'function') vmFinishingSedangPacking.muat(); return; }
  const mountPoint = document.getElementById('vue-finishing-sedangpacking');
  if (mountPoint) vmFinishingSedangPacking = createApp(FinishingSedangPacking).mount('#vue-finishing-sedangpacking');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaFinishingOperatorPacking = function () { window.pastikanMountFinishingSedangPacking(); if (vmFinishingSedangPacking) vmFinishingSedangPacking.bukaOperator(); };
window.bukaFinishingEntryPacking = function () { window.pastikanMountFinishingSedangPacking(); if (vmFinishingSedangPacking) vmFinishingSedangPacking.bukaEntri(); };
let vmFinishingPerluDikirim = null;
window.pastikanMountFinishingPerluDikirim = function () {
  if (vmFinishingPerluDikirim) { if (typeof vmFinishingPerluDikirim.muat === 'function') vmFinishingPerluDikirim.muat(); return; }
  const mountPoint = document.getElementById('vue-finishing-perludikirim');
  if (mountPoint) vmFinishingPerluDikirim = createApp(FinishingPerluDikirim).mount('#vue-finishing-perludikirim');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaFinishingPack = function () { window.pastikanMountFinishingPerluDikirim(); if (vmFinishingPerluDikirim) vmFinishingPerluDikirim.bukaScanPack(); };
window.bukaFinishingKirim = function () { window.pastikanMountFinishingPerluDikirim(); if (vmFinishingPerluDikirim) vmFinishingPerluDikirim.bukaScanKirim(); };
let vmFinishingSedangKirim = null;
window.pastikanMountFinishingSedangKirim = function () {
  if (vmFinishingSedangKirim) { if (typeof vmFinishingSedangKirim.muat === 'function') vmFinishingSedangKirim.muat(); return; }
  const mountPoint = document.getElementById('vue-finishing-sedangkirim');
  if (mountPoint) vmFinishingSedangKirim = createApp(FinishingSedangKirim).mount('#vue-finishing-sedangkirim');
};
let vmFinishingSelesai = null;
window.pastikanMountFinishingSelesai = function () {
  if (vmFinishingSelesai) { if (typeof vmFinishingSelesai.muat === 'function') vmFinishingSelesai.muat(); return; }
  const mountPoint = document.getElementById('vue-finishing-selesai');
  if (mountPoint) vmFinishingSelesai = createApp(FinishingSelesai).mount('#vue-finishing-selesai');
};
