// js/vue-pp-finishing.js
// ============================================================================
// Proses Produksi > Finishing — menu BARU (7 Sep 2026 malam lanjut lagi #4,
// setelah Cutting/Serie/Sewing selesai), wireframe handoff "03 - Proses
// Produksi / 04 - Finishing", dikerjakan via /design-terapkan-handoff,
// lanjut urutan penomoran folder Mockup/handoff/03 - Proses Produksi/
// (01-Cutting, 02-Serie, 03-Sewing sudah selesai, 04-Finishing berikutnya).
//
// ARSITEKTUR — PENTING, baca dulu sebelum ubah apapun di sini:
//
// Finishing MENERIMA kiriman dari Serie (Tab 2.7 "Kirim Finishing", yang
// SUDAH ADA & SUDAH BISA mencetak kode_tugas TLC-SER->TLC-FIN + REUSE
// kode_bagging dari Tab 2.3 milik Serie), memprosesnya lewat 4 TAHAP
// BERURUTAN per PCS (QC -> Steam -> Folding -> Packing, BEDA dari
// Sewing/Cutting yang trackingnya per BATCH — di sini granularitasnya per
// PCS, 1 dokumen finishing_track = 1 pcs, PERSIS seperti disebutkan SERAH-
// TERIMA bagian 5), lalu KIRIM BALIK ke Serie (Tab 2.9 "Terima Finishing"
// SUDAH ADA & SUDAH MENULIS ke finishing_track sejak modul Serie dibangun —
// lihat keputusan #1). TIDAK cetak label baru — pakai label_pcs dari Sewing
// (SERAH-TERIMA §4 Scope, §8 butir 4).
//
// Koleksi BARU: HANYA finishing_track (SERAH-TERIMA §5 "Perlu ditambah" cuma
// sebut ini 1 koleksi, TIDAK ada koleksi label/counter terpisah — beda dari
// Cutting/Serie/Sewing yang masing-masing juga punya counter harian sendiri,
// Finishing TIDAK butuh karena tidak menerbitkan kode label BARU, cuma
// menyalin kode_pcs yang SUDAH ADA dari label_pcs).
//   finishing_track — 1 dokumen PER PCS (BUKAN per batch). Field sesuai
//     SERAH-TERIMA: kode_pcs, batch_id, nama_produk, size, warna, tahap_aktif
//     (qc/steam/folding/packing/selesai), progress (0-4), op_qc/op_steam/
//     op_folding/op_packing ({uid,nama}|null), scan_qc_pada/.../
//     scan_packing_pada, status (5 nilai: perlu_diproses -> sedang_finishing
//     -> perlu_dikirim -> sedang_dikirim -> selesai — PERSIS 5 tab modul
//     ini, sama pola Sewing keputusan #3), kode_bagging, kode_tugas
//     (KEDUANYA TUNGGAL/STRING, BUKAN array — dikonfirmasi dari komentar
//     Serie js/vue-pp-serie.js baris ~1226 "kode_bagging di finishing_track
//     TUNGGAL", beda dari sewing_track yang array). TAMBAHAN (judgment
//     call, lihat keputusan #2): label_pcs_id, kode_batch, batch_id (FK ke
//     separating_batch — dikonfirmasi WAJIB dari komentar Serie: "Field
//     penghubung ke separating_batch: batch_id, dipakai SERAGAM utk 2 tab
//     ini [2.8 Setor Finishing baca via muatSemuaFinishingTrack, 2.9 Terima
//     Finishing update separating_batch via batch_id]"), terima_pada,
//     catatan_masalah, masuk_tahap_pada, sampai_pada (BUKAN ditulis modul
//     ini — ditulis Serie Tab 2.9 "Terima Finishing", MENUTUP status
//     'sedang_dikirim' -> Serie sendiri yang set status:'selesai' di
//     finishing_track, lihat keputusan #1), dibuat_pada/diperbarui_pada.
//
// KEPUTUSAN ARSITEKTUR (judgment call, DIDOKUMENTASIKAN karena SERAH-TERIMA
// tidak menjawab eksplisit atau baru jelas setelah cross-check ke KODE LIVE
// js/vue-pp-serie.js — bukan ditebak, per skill design-terapkan-handoff):
//
// 1. Siklus kirim/terima antara Serie<->Finishing SEPENUHNYA sudah dibangun
//    di sisi Serie sejak modul Serie selesai — dicek langsung ke
//    js/vue-pp-serie.js:
//    - `SerieKirimFinishing` (Tab 2.7): filter separating_batch status
//      'terima_sewing' (batch sudah balik dari Sewing) -> cetak kode_tugas
//      BARU (format SPJyymmdd-NNN, TLC-SER->TLC-FIN) TAPI REUSE kode_bagging
//      LAMA dari Tab 2.3 (bundle fisik sama, cuma surat jalan baru tiap
//      leg) -> scan kirim (kode_tugas lalu kode_bagging) -> set
//      separating_batch.status='kirim_finishing'.
//    - `SerieTerimaFinishing` (Tab 2.9): scan kode_tugas -> query LANGSUNG
//      ke koleksi `finishing_track` (BUKAN separating_batch) where
//      kode_tugas==kode -> untuk tiap dokumen yang belum 'selesai', tulis
//      status:'selesai', sampai_pada:now -> kumpulkan batch_id unik dari
//      dokumen2 itu -> angkat separating_batch (match by Firestore doc id)
//      ke status 'terima_finishing'.
//    KONSEKUENSI WAJIB buat modul ini: (a) finishing_track.kode_tugas HARUS
//    diisi modul INI sendiri (Tab 4.3, kirim KELUAR ke Serie) dengan nilai
//    yang SAMA persis di SEMUA dokumen pcs 1 batch yang dikirim bersamaan
//    (supaya query where('kode_tugas','==',kode) milik Serie menemukan
//    SEMUA pcs sekaligus, bukan cuma 1); (b) finishing_track.batch_id WAJIB
//    diisi = separating_batch punya id Firestore (BUKAN sewing_track punya
//    id) supaya Serie bisa updateSeparatingBatch(bid) dengan benar.
// 2. `batch_id` finishing_track = separating_batch punya id (BUKAN
//    sewing_track) — dikonfirmasi eksplisit dari komentar Serie baris
//    ~1220 "batch_id (Firestore doc id, ADA di skema sewing_track MAUPUN
//    finishing_track... dipakai SERAGAM utk 2 tab ini)". Karena finishing_
//    track granularitasnya per PCS, BANYAK dokumen finishing_track (semua
//    pcs 1 batch) akan berbagi batch_id yang SAMA — ini DISENGAJA, bukan
//    duplikasi data yang salah.
// 3. PENCARIAN PCS milik 1 batch (buat lazy-create finishing_track) —
//    SERAH-TERIMA tidak merinci rantai query-nya, jadi ditelusuri dari kode
//    live: separating_batch (id) -> sewing_track (match `batch_id` ===
//    separating_batch.id, dari js/vue-pp-sewing.js) -> label_pcs (match
//    `batch_id` === sewing_track.id, dari Tab 3.3 Sewing "Cetak Label
//    Pcs"). Rantai 2 loncatan ini WAJIB supaya tahu PERSIS pcs mana saja
//    yang perlu di-lazy-create jadi finishing_track.
// 4. `label_pcs.status` DIUPDATE modul ini jadi 'di_finishing' saat
//    finishing_track di-lazy-create (bukan nanti pas Scan Sampai) —
//    MENUTUP GAP DISENGAJA yang dicatat eksplisit di header js/vue-pp-
//    sewing.js ("Status selain 'dicetak' ... SEMUA ditulis modul lain
//    [Finishing/Gudang/Kasir] — GAP DISENGAJA"). `label_pcs_id` ditambah ke
//    skema finishing_track (TIDAK disebut SERAH-TERIMA) supaya update ini
//    tidak perlu query ulang by kode_pcs tiap kali.
// 5. LAZY-CREATE finishing_track dipicu oleh separating_batch.status ===
//    'kirim_finishing' (SAMA pola Sewing keputusan #8, dipicu 'kirim_
//    sewing') — SEBELUM Scan Sampai fisik terjadi, `terima_pada` masih
//    null (tampil badge "belum sampai"). Idempoten (`pastikanFinishing
//    TrackLengkap()`), aman dipanggil berkali-kali, dicek via `batch_id`
//    yang SUDAH py dokumen finishing_track supaya tidak dobel-create.
// 6. TAHAP 1 "operator QC" (SERAH-TERIMA §2, baris 4.1) — DIINTERPRETASI
//    sebagai invocation PERTAMA dari popup generik "Scan Operator + Entry
//    per Tahap" (lihat keputusan #7) dengan tahap dikunci 'qc', HANYA utk
//    pcs berstatus 'perlu_diproses' DAN sudah `terima_pada` (blokir kalau
//    belum, SAMA pola Sewing keputusan #9 "Tunjuk Operator diblokir kalau
//    terima_pada kosong"). Berhasil scan -> status berubah 'perlu_diproses'
//    -> 'sedang_finishing', tahap_aktif 'qc' -> langsung dianggap SELESAI
//    tahap itu (progress=1, tahap_aktif lanjut ke 'steam') — SERAH-TERIMA
//    tidak merinci apakah "assign operator" dan "selesai tahap" itu 2
//    kejadian terpisah atau 1 kejadian gabungan; dipilih GABUNG (1 scan =
//    assign + selesai) karena SERAH-TERIMA §3 eksplisit menyebut alur
//    tunggal "dropdown pilih tahap -> scan QR operator -> scan label pcs
//    berturut-turut" tanpa langkah ke-3 terpisah utk "tandai selesai".
// 7. POPUP 4.2a "Scan Operator per Tahap" (SERAH-TERIMA §3) — DIWUJUDKAN
//    sebagai 1 komponen scan 2-langkah dipakai ULANG di 4.1 (tahap dikunci
//    'qc') & tiap 4 sub-tab 4.2 (tahap dikunci sesuai sub-tab): langkah 1
//    scan QR PERSONAL operator (dicocokkan ke `users` by `kode_karyawan`
//    atau email QR, SAMA pola "scan QR operator" yang sudah dipakai
//    Persiapan Produksi Bahan/Acc — BUKAN PopupPinGenerik/PIN seperti
//    Cutting/Serie/Sewing, KARENA SERAH-TERIMA §3 & §8 Finishing eksplisit
//    menulis "scan QR operator" bukan "verifikasi PIN" — beda literal dari
//    kata yang dipakai SERAH-TERIMA Sewing/Cutting), langkah 2 scan kode_
//    pcs berkali-kali (tiap scan = 1 pcs selesai tahap itu). Gated PIC/PIC
//    Owner/Owner/Superuser (rule #4b PEDOMAN-SERAH-TERIMA.md).
// 8. SCAN ENTRY MANDIRI (operator, tanpa scan QR operator lain dulu) —
//    SERAH-TERIMA §3 "Admin di HP: picker 5 pilihan (4x scan operator per
//    tahap + masalah). Operator: picker 2 (entry + masalah)" — Operator
//    (role biasa, BUKAN PIC+) py jalur SENDIRI cuma 2 pilihan (entry +
//    masalah), TANPA scan-operator-lain. Diwujudkan sebagai tombol/aksi
//    TERPISAH "Scan Entry (diri sendiri)" yang skip langkah 1 (operator =
//    `window.currentUser` langsung, bukan hasil scan QR org lain), efeknya
//    ke DB SAMA PERSIS (op_<tahap>, scan_<tahap>_pada, progress++). Tersedia
//    utk SEMUA role yang py akses edit menu ini (termasuk Operator biasa,
//    BUKAN cuma PIC+ — beda dari langkah 7 yang gated PIC+).
// 9. BUNDLING Tab 4.3 "Perlu Dikirim": SATU kode_bagging + SATU kode_tugas
//    per BATCH (semua pcs 1 batch dikirim jadi 1 paket), SAMA prinsip
//    penyederhanaan Sewing keputusan #11 ("produk jadi hasil 1 batch
//    dianggap 1 paket fisik") — bedanya di sini nilainya ditulis ke BANYAK
//    dokumen finishing_track (1 per pcs) sekaligus, bukan 1 field array di
//    1 dokumen batch, KARENA finishing_track TIDAK py dokumen level-batch
//    (murni per pcs, sesuai keputusan #2).
// 10. Progress dots (SERAH-TERIMA §3 "●○○○ -> ●●○○ -> ... -> ●●●●") dihitung
//    dari field `progress` (0-4) tersimpan, BUKAN dihitung ulang dari 4
//    timestamp tiap render (lebih murah, dan urutan tahap SELALU linear
//    jadi progress==N setara "N timestamp pertama terisi").
// 11. Peran Scan Operator (langkah 7) HANYA PIC/PIC Owner/Owner/Superuser,
//    role gate DUA LAPIS sama pola Cutting/Serie/Sewing (tombol tidak
//    tampil di DOM utk role lain). Scan Masalah & Scan Entri mandiri
//    (langkah 8) tersedia siapapun yang py `cekIzinMenu(..,'edit')`.
// 12. QC gagal (SERAH-TERIMA §3 "QC gagal: scan masalah -> Persiapan
//    Masalah -> rework lewat Serie ke Sewing -> balik Finishing") — TIDAK
//    ada mekanisme rework OTOMATIS di modul ini (mis. auto-kirim balik ke
//    Sewing) — Scan Masalah cuma mengajukan ke `persiapan_masalah`
//    (`ajukanPersiapanMasalah()`, SAMA fungsi generik dipakai semua pos)
//    dengan `sumberJalur:'finishing'`; rework fisiknya lewat Serie manual
//    (Serie sudah py semua tab kirim/terima generik, tidak perlu logic
//    baru khusus rework di modul manapun) — SERAH-TERIMA §4 Scope juga
//    tidak masukkan mekanisme rework otomatis ke lingkup modul ini.
//
// GAP DISENGAJA (bukan bug):
// - Tab 4.4 "Sedang Kirim" TIDAK akan otomatis pindah ke Tab 4.5 "Selesai"
//   sampai Serie melakukan Scan Sampai di Tab 2.9 "Terima Finishing"
//   miliknya sendiri (SUDAH ADA & SUDAH BISA sejak modul Serie dibangun,
//   lihat keputusan #1) — begitu modul ini selesai dites, Guru WAJIB scan
//   di sisi Serie juga supaya siklus tertutup, SAMA pola Sewing.
// - `label_pcs.status` sesudah 'di_finishing' (di_gudang/terjual/
//   perlu_dicari/hilang) BELUM PUNYA PENULIS — tugas modul Gudang Barang
//   Jadi/Kasir (di luar cakupan modul ini).
//
// Print label & scan QR: PAKAI ULANG PopupPratinjauCetakLabel & ScanGenerik
// (js/vue-components.js, js/vue-scan-cetak.js) — TIDAK ada komponen visual
// baru ditulis di sini, konsisten dengan Cutting/Serie/Sewing.
// ============================================================================

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel } from './vue-components.js?v=5';
import { ScanGenerik, buatQrDataUrl, ajukanPersiapanMasalah } from './vue-scan-cetak.js?v=2';

// --- Format & hitung kecil (disalin pola dari Cutting/Serie/Sewing). --------
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
const TLC_ASAL_FINISHING = 'TLC-FIN';
const TLC_TUJUAN_SERIE = 'TLC-SER';
const URUTAN_TAHAP = ['qc', 'steam', 'folding', 'packing'];
const LABEL_TAHAP = { qc: 'QC', steam: 'Steam', folding: 'Folding', packing: 'Packing' };
const ICON_TAHAP = { qc: 'fa-magnifying-glass', steam: 'fa-wind', folding: 'fa-layer-group', packing: 'fa-box' };

// --- Baca koleksi mentah ----------------------------------------------------
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
// pastikanFinishingTrackLengkap — keputusan #3/#4/#5: rantai separating_batch
// -> sewing_track (batch_id cocok) -> label_pcs (batch_id cocok ke sewing_
// track), 1 finishing_track per label_pcs, idempoten.
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
          nama_produk: p.nama_produk || b.nama_produk || '', size: p.size || b.size || '', warna: p.warna || '',
          status: 'perlu_diproses', tahap_aktif: null, progress: 0,
          op_qc: null, op_steam: null, op_folding: null, op_packing: null,
          scan_qc_pada: null, scan_steam_pada: null, scan_folding_pada: null, scan_packing_pada: null,
          terima_pada: null, kode_bagging: null, kode_tugas: null, catatan_masalah: '',
          masuk_tahap_pada: now, sampai_pada: null,
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
// cariOperatorByKode — scan QR operator (keputusan #7): cocokkan ke `users`
// by email (isi QR pribadi karyawan SAMA seperti QR yang dipakai fitur lain,
// lihat Account > QR code pribadi, PETA-MENU.md).
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
}

// ============================================================================
// Popup gabungan "Scan Operator + Entry per Tahap" (wireframe 4.2a,
// keputusan #6/#7/#8) — dipakai ULANG di Tab 4.1 (tahap dikunci 'qc') & tiap
// sub-tab Tab 4.2. mode: 'operator' (scan QR operator dulu, gated PIC+) atau
// 'sendiri' (window.currentUser langsung, siapapun boleh akses menu edit).
// ============================================================================
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
          const patch = {
            ['op_' + tahap]: operatorTerpilih.value, ['scan_' + tahap + '_pada']: now,
            progress: progressBaru, tahap_aktif: tahapBerikut, masuk_tahap_pada: now
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

// ============================================================================
// TAB 4.1: Perlu Di Proses
// ============================================================================
const FinishingPerluDiProses = {
  components: { ScanGenerik, ModalTahapQc },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const menuId = 'proses_finishing';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehOperator = computed(() => picOwnerKeAtas(window.currentUser));

    async function muat() {
      memuat.value = true;
      try { daftar.value = (await pastikanFinishingTrackLengkap()).filter(t => t.status === 'perlu_diproses'); }
      catch (e) { console.error('Gagal muat Finishing > Perlu Di Proses:', e); daftar.value = []; }
      memuat.value = false;
    }

    // --- Scan Sampai: step1 kode_tugas, step2 kode_bagging berkali-kali,
    // dicocokkan ke `separating_batch` (mengikuti pola Sewing keputusan #2).
    const modalSampai = reactive({ aktif: false, batch: null, log: [] });
    function bukaScanSampai() { modalSampai.batch = null; modalSampai.log = []; modalSampai.aktif = true; }
    function tutupScanSampai() { modalSampai.aktif = false; modalSampai.batch = null; modalSampai.log = []; muat(); }
    async function hasilScanSampai(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      if (!modalSampai.batch) {
        try {
          const snap = await getDocs(query(collection(db, 'separating_batch'), where('kode_tugas', '==', kode)));
          if (snap.empty) { alert(`Kode tugas "${kode}" tidak ditemukan.`); return; }
          modalSampai.batch = { id: snap.docs[0].id, ...snap.docs[0].data() };
        } catch (e) { console.error('Gagal cari kode tugas:', e); }
        return;
      }
      const b = modalSampai.batch;
      if (!(b.kode_bagging || []).includes(kode)) { alert(`Kode bagging "${kode}" tidak cocok dengan tugas ini.`); return; }
      if (modalSampai.log.includes(kode)) { alert(`Kode bagging "${kode}" sudah discan sebelumnya di sesi ini.`); return; }
      modalSampai.log.unshift(kode);
      const sudahSemua = (b.kode_bagging || []).every(kb => modalSampai.log.includes(kb));
      if (sudahSemua) {
        try {
          const pcsBatch = daftar.value.filter(x => x.batch_id === b.id);
          if (!pcsBatch.length) { alert('Bagging cocok, tapi belum ada finishing_track untuk batch ini — coba tutup lalu buka lagi tab ini.'); return; }
          const now = new Date().toISOString();
          await Promise.all(pcsBatch.map(t => updateFinishingTrack(t.id, () => ({ terima_pada: now }))));
          modalSampai.log.unshift('SEMUA bagging sampai — batch ' + (b.kode_batch || '') + ' (' + pcsBatch.length + ' pcs) siap ditunjuk operator QC');
          await muat();
        } catch (e) { console.error('Gagal simpan scan sampai Finishing:', e); alert('Gagal menyimpan. Coba lagi.'); }
      }
    }

    // --- Scan Unpack: cari batch via separating_batch, tandai unpack log di
    // SEMUA finishing_track batch itu (field per-pcs, TIDAK ada di SERAH-
    // TERIMA — ditambah supaya konsisten dgn Cutting/Sewing, opsional dilihat
    // sebagai catatan bebas, tidak menghambat alur kalau tidak dipakai).
    const modalUnpackScan = reactive({ aktif: false });
    const popupUnpack = ref(null);
    function bukaScanUnpack() { modalUnpackScan.aktif = true; }
    function tutupScanUnpack() { modalUnpackScan.aktif = false; }
    async function hasilScanUnpack(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      try {
        const snap = await getDocs(query(collection(db, 'separating_batch'), where('kode_bagging', 'array-contains', kode)));
        if (snap.empty) { alert(`Kode bagging "${kode}" tidak ditemukan di batch manapun.`); return; }
        const b = { id: snap.docs[0].id, ...snap.docs[0].data() };
        const pcsBatch = daftar.value.filter(x => x.batch_id === b.id);
        if (!pcsBatch.length) { alert('Batch ditemukan tapi belum punya finishing_track di tab ini — coba muat ulang.'); return; }
        popupUnpack.value = { batch: b, jumlahPcs: pcsBatch.length, kodeBagging: kode, hasil: 'komplit' };
      } catch (e) { console.error('Gagal cari kode bagging (unpack):', e); alert('Gagal mencari. Coba lagi.'); }
    }
    async function konfirmasiUnpack() {
      const p = popupUnpack.value;
      if (!p) return;
      try {
        const catatan = 'Unpack ' + p.kodeBagging + ': ' + p.hasil.toUpperCase() + ' (' + new Date().toLocaleString('id-ID') + ')';
        const pcsBatch = daftar.value.filter(x => x.batch_id === p.batch.id);
        await Promise.all(pcsBatch.map(t => updateFinishingTrack(t.id, (data) => ({ catatan_masalah: p.hasil === 'inkomplit' ? ((data.catatan_masalah || '') + ' | ' + catatan) : data.catatan_masalah || '' }))));
        popupUnpack.value = null;
        await muat();
      } catch (e) { console.error('Gagal simpan unpack Finishing:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    // --- Tunjuk Operator QC (popup gabungan, keputusan #6) ------------------
    const modalOperatorQcAktif = ref(false);
    function bukaOperatorQc() { modalOperatorQcAktif.value = true; }
    function tutupOperatorQc() { modalOperatorQcAktif.value = false; muat(); }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahFinishing(p.target, p.jumlah, p.alasan);
      await muat();
    });

    // Kelompokkan tampilan per batch supaya tidak 1 baris per pcs (bisa
    // ratusan pcs) — kartu per batch, jumlah pcs & status terima ditampilkan
    // ringkas (SAMA semangat "papan admin, bukan operator" seperti pos lain).
    const kelompokBatch = computed(() => {
      const peta = {};
      daftar.value.forEach(t => {
        const key = t.batch_id;
        if (!peta[key]) peta[key] = { batchId: key, kodeBatch: t.kode_batch, namaProduk: t.nama_produk, size: t.size, pcs: [], terimaPada: t.terima_pada, masukTahapPada: t.masuk_tahap_pada };
        peta[key].pcs.push(t);
      });
      return Object.values(peta);
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, kelompokBatch, bolehProses, bolehOperator, formatQty, formatDiamSejak, tertahan,
      modalSampai, bukaScanSampai, tutupScanSampai, hasilScanSampai,
      modalUnpackScan, popupUnpack, bukaScanUnpack, tutupScanUnpack, hasilScanUnpack, konfirmasiUnpack,
      modalOperatorQcAktif, bukaOperatorQc, tutupOperatorQc,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
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
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button v-if="bolehProses" @click="bukaScanSampai" class="btn-primary" style="flex:1; min-width:120px; padding:8px; font-size:11.5px;"><i class="fas fa-qrcode" style="margin-right:4px;"></i>Scan Sampai</button>
            <button v-if="bolehProses" @click="bukaScanUnpack" class="btn-outline" style="flex:1; min-width:120px; padding:8px; font-size:11.5px;"><i class="fas fa-box-open" style="margin-right:4px;"></i>Scan Unpack</button>
            <button v-if="bolehOperator" @click="bukaOperatorQc" class="btn-outline" style="flex:1; min-width:150px; padding:8px; font-size:11.5px;"><i class="fas fa-user-check" style="margin-right:4px;"></i>Tunjuk Operator QC</button>
            <button v-if="bolehProses" @click="bukaMasalah(g.pcs[0])" class="btn-outline" style="flex:1; min-width:120px; padding:8px; font-size:11.5px; color:var(--danger, #b91c1c);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
          </div>
        </div>
      </div>
    </template>

    <scan-generik :aktif="modalSampai.aktif" :judul="modalSampai.batch ? ('Scan kode bagging — tugas ' + modalSampai.batch.kode_tugas) : 'Scan Kode Tugas'" subjudul="Bisa discan berkali-kali (tiap kode bagging = 1 pack dari Serie)." @hasil="hasilScanSampai" @tutup="tutupScanSampai" />
    <div v-if="modalSampai.aktif && modalSampai.batch && modalSampai.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:280px;">
      <div v-for="(l,i) in modalSampai.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>

    <scan-generik :aktif="modalUnpackScan.aktif" judul="Scan Kode Bagging (Unpack)" subjudul="Scan 1 kode bagging untuk ditandai KOMPLIT/INKOMPLIT." @hasil="hasilScanUnpack" @tutup="tutupScanUnpack" />
    <div v-if="popupUnpack" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Hasil Unpack — {{ popupUnpack.kodeBagging }} ({{ popupUnpack.jumlahPcs }} pcs)</h3>
        <div class="gc-field" style="margin-bottom:14px;"><label>Status</label>
          <select v-model="popupUnpack.hasil"><option value="komplit">KOMPLIT</option><option value="inkomplit">INKOMPLIT</option></select>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="popupUnpack = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiUnpack" class="btn-primary" style="flex:1; padding:9px;">Simpan</button>
        </div>
      </div>
    </div>

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
  `
};

// ============================================================================
// TAB 4.2: Sedang Finishing — 4 sub-tab horizontal (QC/Steam/Folding/
// Packing, SERAH-TERIMA §6 "sub-tab horizontal 4 tahap"). 1 komponen dipakai
// ULANG lewat factory, filter finishing_track by tahap_aktif.
// ============================================================================
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
        try { daftar.value = (await muatSemuaFinishingTrack()).filter(t => t.status === 'sedang_finishing' && t.tahap_aktif === tahap); }
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

      onMounted(async () => { await window.authReady; await muat(); });

      return {
        memuat, kelompokBatch, bolehProses, bolehOperator, formatQty, formatDiamSejak, tertahan,
        modalOperatorAktif, bukaOperator, tutupOperator, modalEntriAktif, bukaEntri, tutupEntri,
        popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah,
        LABEL_TAHAP, tahap
      };
    },
    template: `
      <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <template v-else>
        <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
          <button v-if="bolehOperator" @click="bukaOperator" class="btn-primary" style="flex:1; min-width:160px; padding:9px;"><i class="fas fa-user-check" style="margin-right:6px;"></i>Scan Operator (tunjuk)</button>
          <button v-if="bolehProses" @click="bukaEntri" class="btn-outline" style="flex:1; min-width:160px; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Entry (diri sendiri)</button>
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
                <button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="padding:4px 8px; font-size:10px; color:var(--danger, #b91c1c);"><i class="fas fa-triangle-exclamation"></i></button>
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

// ============================================================================
// TAB 4.3: Perlu Dikirim — Cetak Bagging + Kode Tugas -> Serie (keputusan #9).
// ============================================================================
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
      try { daftar.value = (await muatSemuaFinishingTrack()).filter(t => t.status === 'perlu_dikirim'); }
      catch (e) { console.error('Gagal muat Finishing > Perlu Dikirim:', e); daftar.value = []; }
      memuat.value = false;
    }
    const kelompokBatch = computed(() => {
      const peta = {};
      daftar.value.forEach(t => {
        const key = t.batch_id;
        if (!peta[key]) peta[key] = { batchId: key, kodeBatch: t.kode_batch, namaProduk: t.nama_produk, size: t.size, pcs: [], sudahKirim: !!t.kode_tugas, masukTahapPada: t.masuk_tahap_pada };
        peta[key].pcs.push(t);
      });
      return Object.values(peta);
    });

    // --- Cetak Bagging + Kode Tugas (1 kode masing2, ditulis ke SEMUA pcs
    // batch itu, keputusan #9). --------------------------------------------
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    async function cetakBaggingTugas(g) {
      if (g.sudahKirim) { if (!confirm('Batch ini sudah pernah dicetak bagging + kode tugas. Cetak ULANG (kode baru)?')) return; }
      sedangProses.value = true;
      try {
        const kodeBag = await generateKodeHarianFormat('BAG', 'pengaturan_id_bagging');
        await addDoc(collection(db, 'bagging'), {
          kode: kodeBag, produk_label: `${g.kodeBatch} &middot; ${g.namaProduk}`, isi: [], ditutup_pada: null,
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

    // --- Scan Pack: step1 kode bagging, step2 kode pcs berkali-kali ---------
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
        } catch (e) { console.error('Gagal cari kode bagging:', e); }
        return;
      }
      try {
        const snap = await getDocs(query(collection(db, 'finishing_track'), where('kode_bagging', '==', modalPack.kodeBagging), where('kode_pcs', '==', kode)));
        if (snap.empty) { alert(`Kode pcs "${kode}" tidak terkait bagging ini.`); return; }
        await updateDoc(doc(db, 'bagging', (await getDocs(query(collection(db, 'bagging'), where('kode', '==', modalPack.kodeBagging)))).docs[0].id), { isi: arrayUnion(kode) });
        modalPack.log.unshift(kode + ' -> ' + modalPack.kodeBagging);
      } catch (e) { console.error('Gagal scan pack Finishing:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }
    async function tutupBaggingPack() {
      if (!modalPack.kodeBagging) return;
      try {
        const snap = await getDocs(query(collection(db, 'bagging'), where('kode', '==', modalPack.kodeBagging)));
        if (!snap.empty) await updateDoc(doc(db, 'bagging', snap.docs[0].id), { ditutup_pada: serverTimestamp() });
      } catch (e) { console.error('Gagal tutup bagging:', e); }
      modalPack.kodeBagging = null;
    }

    // --- Scan Kirim: step1 kode tugas, step2 kode bagging -------------------
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
      const g = kelompokBatch.value.find(x => x.pcs[0] && x.pcs[0].kode_tugas === modalKirim.tugas.kode && x.pcs[0].kode_bagging === kode);
      if (!g) { alert(`Kode bagging "${kode}" tidak cocok dengan tugas ini.`); return; }
      try {
        await updateDoc(doc(db, 'tugas_kirim', modalKirim.tugas.id), { pack: arrayUnion({ kode_bagging: kode, pada: new Date().toISOString() }) });
        const now = new Date().toISOString();
        await Promise.all(g.pcs.map(t => updateFinishingTrack(t.id, () => ({ status: 'sedang_dikirim', masuk_tahap_pada: now }))));
        modalKirim.log.unshift(kode + ' -> ' + modalKirim.tugas.kode + ' (' + g.pcs.length + ' pcs pindah ke Sedang Kirim)');
        await muat();
      } catch (e) { console.error('Gagal scan kirim Finishing:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahFinishing(p.target, p.jumlah, p.alasan);
      await muat();
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, kelompokBatch, bolehProses, bolehCetak, sedangProses, formatQty, formatDiamSejak, tertahan,
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
            <button v-if="bolehProses" @click="bukaMasalah(g.pcs[0])" class="btn-outline" style="flex:1; min-width:120px; padding:8px; font-size:11.5px; color:var(--danger, #b91c1c);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
          </div>
        </div>
      </div>
    </template>

    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Bagging + Kode Tugas" :daftar-label="daftarLabelPreview" @tutup="popupCetakAktif = false" />

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

// ============================================================================
// TAB 4.4: Sedang Kirim — read-only tracking per kode tugas.
// ============================================================================
const FinishingSedangKirim = {
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const menuId = 'proses_finishing';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try { daftar.value = (await muatSemuaFinishingTrack()).filter(t => t.status === 'sedang_dikirim'); }
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

    return { memuat, kelompokTugas, bolehProses, formatDiamSejak, tertahan, popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah };
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
              <button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="padding:4px 8px; font-size:10px; color:var(--danger, #b91c1c);"><i class="fas fa-triangle-exclamation"></i></button>
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

// ============================================================================
// TAB 4.5: Selesai — riwayat per pcs, read-only, 4 operator per baris
// (SERAH-TERIMA §2). Terisi begitu Serie Scan Sampai di 2.9 (SUDAH BISA).
// ============================================================================
const FinishingSelesai = {
  setup() {
    const memuat = ref(true);
    const semuaSelesai = ref([]);
    const kataKunci = ref('');
    const dariTanggal = ref('');
    const sampaiTanggal = ref('');

    async function muat() {
      memuat.value = true;
      try { semuaSelesai.value = (await muatSemuaFinishingTrack()).filter(t => t.status === 'selesai').sort((a, b) => new Date(b.sampai_pada || 0) - new Date(a.sampai_pada || 0)); }
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

    return { memuat, daftarUrut, selesaiHariIni, kataKunci, dariTanggal, sampaiTanggal, unduhCsv, formatWaktu };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div class="gc-card" style="padding:12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <div style="font-size:12px; color:var(--text-faint);">Selesai hari ini</div>
        <div class="gc-num" style="font-weight:700; font-size:16px;">{{ selesaiHariIni.length }}</div>
      </div>
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <input v-model="kataKunci" type="text" placeholder="Cari kode pcs / batch / produk..." style="flex:2; min-width:160px; padding:8px; border-radius:10px; border:1px solid var(--border-soft);">
        <input v-model="dariTanggal" type="date" style="flex:1; min-width:130px; padding:8px; border-radius:10px; border:1px solid var(--border-soft);">
        <input v-model="sampaiTanggal" type="date" style="flex:1; min-width:130px; padding:8px; border-radius:10px; border:1px solid var(--border-soft);">
        <button @click="unduhCsv" class="btn-outline" style="padding:8px 14px; font-size:11.5px;"><i class="fas fa-download" style="margin-right:6px;"></i>Unduh CSV</button>
      </div>

      <div v-if="daftarUrut.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-circle-check"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada riwayat Selesai</h3>
        <p style="font-size:11px; color:var(--text-faint); margin-top:6px;">Tab ini terisi otomatis begitu Serie melakukan Scan Sampai di Tab 2.9 "Terima Finishing" — bukan error.</p>
      </div>
      <div v-else class="gc-card" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead><tr style="text-align:left; border-bottom:1px solid var(--border-soft);">
            <th style="padding:6px 8px;">Kode Pcs</th><th style="padding:6px 8px;">Batch</th><th style="padding:6px 8px;">Produk</th>
            <th style="padding:6px 8px;">QC</th><th style="padding:6px 8px;">Steam</th><th style="padding:6px 8px;">Folding</th><th style="padding:6px 8px;">Packing</th>
            <th style="padding:6px 8px;">Selesai</th>
          </tr></thead>
          <tbody>
            <tr v-for="t in daftarUrut" :key="t.id" style="border-bottom:1px solid var(--border-soft);">
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

// --- Mount ke index.html — LAZY, SAMA pola Cutting/Serie/Sewing. ------------
let vmFinishingPerluDiProses = null;
window.pastikanMountFinishingPerluDiProses = function () {
  if (vmFinishingPerluDiProses) return;
  const mountPoint = document.getElementById('vue-finishing-perludiproses');
  if (mountPoint) vmFinishingPerluDiProses = createApp(FinishingPerluDiProses).mount('#vue-finishing-perludiproses');
};
let vmFinishingSedangQc = null;
window.pastikanMountFinishingSedangQc = function () {
  if (vmFinishingSedangQc) return;
  const mountPoint = document.getElementById('vue-finishing-sedangqc');
  if (mountPoint) vmFinishingSedangQc = createApp(FinishingSedangQc).mount('#vue-finishing-sedangqc');
};
let vmFinishingSedangSteam = null;
window.pastikanMountFinishingSedangSteam = function () {
  if (vmFinishingSedangSteam) return;
  const mountPoint = document.getElementById('vue-finishing-sedangsteam');
  if (mountPoint) vmFinishingSedangSteam = createApp(FinishingSedangSteam).mount('#vue-finishing-sedangsteam');
};
let vmFinishingSedangFolding = null;
window.pastikanMountFinishingSedangFolding = function () {
  if (vmFinishingSedangFolding) return;
  const mountPoint = document.getElementById('vue-finishing-sedangfolding');
  if (mountPoint) vmFinishingSedangFolding = createApp(FinishingSedangFolding).mount('#vue-finishing-sedangfolding');
};
let vmFinishingSedangPacking = null;
window.pastikanMountFinishingSedangPacking = function () {
  if (vmFinishingSedangPacking) return;
  const mountPoint = document.getElementById('vue-finishing-sedangpacking');
  if (mountPoint) vmFinishingSedangPacking = createApp(FinishingSedangPacking).mount('#vue-finishing-sedangpacking');
};
let vmFinishingPerluDikirim = null;
window.pastikanMountFinishingPerluDikirim = function () {
  if (vmFinishingPerluDikirim) return;
  const mountPoint = document.getElementById('vue-finishing-perludikirim');
  if (mountPoint) vmFinishingPerluDikirim = createApp(FinishingPerluDikirim).mount('#vue-finishing-perludikirim');
};
let vmFinishingSedangKirim = null;
window.pastikanMountFinishingSedangKirim = function () {
  if (vmFinishingSedangKirim) return;
  const mountPoint = document.getElementById('vue-finishing-sedangkirim');
  if (mountPoint) vmFinishingSedangKirim = createApp(FinishingSedangKirim).mount('#vue-finishing-sedangkirim');
};
let vmFinishingSelesai = null;
window.pastikanMountFinishingSelesai = function () {
  if (vmFinishingSelesai) return;
  const mountPoint = document.getElementById('vue-finishing-selesai');
  if (mountPoint) vmFinishingSelesai = createApp(FinishingSelesai).mount('#vue-finishing-selesai');
};
