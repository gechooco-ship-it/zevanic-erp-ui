// js/vue-pp-gudang.js
// ============================================================================
// BARU ("lanjut lagi" #5, 7 Sep 2026 — sesi ini, setelah Finishing) — Proses
// Produksi > Gudang Barang Jadi. Titik akhir rantai produksi: 4 tab (5.1
// Perlu Disimpan, 5.2 Stok Tersedia, 5.3 Riwayat Keluar, 5.4 Scan Opname +
// popup 5.4a). SERAH-TERIMA §7 "Yang Belum Diputuskan: (Tidak ada.)" — modul
// ini fully-specified, TIDAK ada keputusan Guru yang perlu ditanya duluan.
//
// SUMBER: handoff/03 - Proses Produksi/05 - Gudang Barang Jadi/SERAH-TERIMA.md
// (dibaca penuh sebelum menulis modul ini) + cross-check LIVE CODE ke js/
// vue-pp-serie.js (kontrak separating_batch/kirim_gudang) dan js/vue-pp-
// sewing.js (skema label_pcs — koleksi ini DITERBITKAN Sewing, lihat header
// besar file itu §7/§GAP DISENGAJA) dan js/vue-pesanan.js (skema order_spk
// utk alokasi FIFO).
//
// KEPUTUSAN/CATATAN ARSITEKTUR (didokumentasikan di sini per konvensi proyek
// "jangan tebak diam-diam, catat alasannya"):
//
// 1. TIDAK ADA koleksi tracking baru untuk modul ini (BEDA dari Cutting/
//    Serie/Sewing/Finishing yang masing-masing punya *_track sendiri) —
//    SERAH-TERIMA §5 eksplisit: "Stok produk jadi = view collection (derived
//    dari label_pcs status). Tidak perlu koleksi terpisah." Jadi modul ini
//    beroperasi LANGSUNG di atas `label_pcs` (koleksi milik Sewing) + field
//    baru `opname_produk_jadi` (opsional, log sesi opname).
//
// 2. `label_pcs.status` 6 nilai (ditetapkan Sewing sendiri, lihat js/vue-pp-
//    sewing.js keputusan #7): dicetak -> di_finishing -> di_gudang ->
//    terjual -> perlu_dicari -> hilang. Modul Finishing (SUDAH DIBANGUN sesi
//    ini) menulis 'di_finishing'. Modul INI menulis 'di_gudang' (scan masuk
//    gudang), 'perlu_dicari' (opname tidak ketemu), 'hilang' (konfirmasi PIN
//    Owner — SOFT status, dokumen TIDAK dihapus fisik, konsisten dengan
//    seluruh app yang TIDAK PERNAH pakai deleteDoc di modul manapun — audit
//    trail tetap ada). Modul Kasir (BELUM DIBANGUN, di luar cakupan) nanti
//    menulis 'terjual' + `terjual_pada` + `transaksi_kasir_id`.
//
// 3. Field BARU `sampai_pada` ditambah ke `label_pcs` (TIDAK ada di SERAH-
//    TERIMA, judgment call konsisten dengan preseden Sewing menambah
//    `label_pcs_dicetak_pada` di sewing_track tanpa diminta spek eksplisit).
//    Alasan: SERAH-TERIMA §3 memerintahkan urutan "Scan sampai, unpack, scan
//    masuk gudang per pcs" di Tab 5.1 — scan masuk gudang (per pcs) harus
//    bisa dibedakan dari pcs yang masih di jalan (belum discan sampai dari
//    Serie). Karena TIDAK ADA koleksi tracking baru (keputusan #1), field
//    penanda ini ditaruh LANGSUNG di label_pcs. Diisi begitu batch yang
//    memuatnya lolos Scan Sampai (lihat #4).
//
// 4. Scan Sampai (5.1) MENUTUP GAP yang sudah diperingatkan eksplisit di
//    js/vue-pp-serie.js (komentar "GAP DISENGAJA" di baris ~167-170 & ~982-
//    983 & ~1375-1377 file itu): begitu modul ini Scan Sampai dari Kirim
//    Gudang (Serie Tab 2.10), modul ini WAJIB menulis balik
//    `separating_batch.status = 'selesai'` + `sampai_pada` — PERSIS pola
//    yang sama dipakai Serie sendiri menutup gap Cutting/Sewing/Finishing
//    (baca lewat kode_tugas, filter status:'kirim_gudang', tutup begitu
//    SEMUA kode_bagging batch itu discan — 2 langkah: kode tugas dulu, lalu
//    kode bagging berkali-kali, SAMA pola FinishingPerluDiProses.
//    hasilScanSampai()). `separating_batch` ditulis LANGSUNG (updateDoc),
//    TIDAK lewat helper transaksi Serie (helper itu module-scoped, tidak
//    di-export — konsisten dengan Finishing yang juga tidak mengimpor apapun
//    dari vue-pp-serie.js, cukup baca/tulis koleksi bersama secara langsung).
//
//    Sesudah batch ditutup, rantai pencarian pcs miliknya: separating_batch.
//    id -> sewing_track (match `batch_id`===separating_batch.id) -> label_
//    pcs (match `batch_id`===sewing_track.id) — SAMA 2-hop yang dipakai
//    Finishing (lihat header besar file itu). Bedanya: di sini hop ini CUMA
//    dipakai SEKALI saat Scan Sampai (untuk menandai `sampai_pada` di semua
//    label_pcs terkait) — sesudah itu Tab 5.1 bekerja LANGSUNG dari `label_
//    pcs.sampai_pada`/`status`, tidak perlu jalan-jalan hop lagi.
//
// 5. Scan Unpack (5.1): TIDAK ada koleksi/field per-pcs baru untuk unpack log
//    (beda dari Finishing yang menulis ke `finishing_track.catatan_masalah`
//    karena finishing_track memang ada) — modul ini menumpuk ke field
//    `separating_batch.unpack_log` yang SUDAH ADA & SUDAH DIPAKAI Serie
//    sendiri di buatTabTerima() (array generik {kode_bagging, status, pada,
//    oleh}) — konsisten memakai field bersama yang sudah ada, bukan bikin
//    field baru untuk hal yang sama.
//
// 6. Scan Masalah ditambahkan di seksi "Batch Menunggu Sampai" Tab 5.1
//    walau tabel ringkas SERAH-TERIMA §2 tidak menulisnya eksplisit untuk
//    5.1 — PEDOMAN-SERAH-TERIMA.md §4c ("scan masalah wajib di tahap Perlu
//    kalau tahap Sedang punya") tidak 1:1 berlaku di sini (modul ini tidak
//    punya tab "Sedang" terpisah), TAPI preseden KONSISTEN dipakai semua tab
//    "Perlu terima kiriman" lain di app ini (Cutting 1.1, Serie 2.1/2.6/2.9,
//    Sewing 3.1, Finishing 4.1) — SEMUA punya Scan Masalah untuk laporkan
//    kekurangan/cacat kiriman saat diterima. Konsisten dengan itu, bukan
//    ditambah sembarangan.
//
// 7. Alokasi PO FIFO (§3 "Alokasi PO FIFO... urut dibuat_pada. Sisa MOQ jadi
//    stok bebas") — cross-check LIVE CODE ke js/vue-pesanan.js: koleksi
//    `order_spk` MASIH AKTIF ditulis di sana (Penjualan Kasir, fungsi
//    checkout) walau ADA entry lama "DIPENSIUNKAN" di DAFTAR_MENU js/vue-
//    config-akses.js — entry itu cuma menu ADMIN LAMA yang dipensiunkan
//    (diganti "Pesanan > Menunggu Proses"), BUKAN koleksi Firestore-nya,
//    yang tetap koleksi hidup. Field yang dipakai: `sku_produk`, `status`
//    ('Aktif'), `qty_order`, `dibuat_pada`. TIDAK ADA field "sudah
//    teralokasi berapa" di order_spk — dihitung derived (query label_pcs
//    where order_spk_id===id, hitung .size) tiap kali alokasi jalan, BUKAN
//    disimpan counter terpisah — konsisten dengan prinsip "Cara Menilai
//    Hasilnya Benar #2" milik modul ini sendiri ("angka kumulatif dihitung
//    ulang dari sumbernya, tidak disimpan ganda"). `order_spk` TIDAK punya
//    field size/warna terpisah (beda dari label_pcs) — asumsi 1 sku_produk
//    = 1 kombinasi size+warna spesifik (konsisten dengan cara Sewing mencetak
//    label_pcs per SKU), jadi `sku_produk` cukup sebagai kunci pencocokan.
//
// 8. "Alert PO di kasir" (§3) & "Koneksi ke Pesanan 1.1" (§3) EKSPLISIT DI
//    LUAR SCOPE modul ini (§4 Scope: "Tidak masuk: ... Kasir UI (canvas
//    Pesanan)") — modul ini CUMA menulis `label_pcs.order_spk_id` dengan
//    benar supaya modul Kasir (belum dibangun, di luar cakupan sesi ini)
//    bisa membaca & menampilkan alert-nya sendiri nanti. TIDAK ada alert
//    warna kuning di modul ini sendiri.
//
// 9. Scan Opname (5.4) — SENGAJA TIDAK memakai ulang js/vue-scan-opname.js
//    (modul itu domain BEDA: opname bahan/aksesoris per-item/per-roll, pakai
//    kamera jsQR mentah miliknya sendiri, ditulis SEBELUM konvensi
//    ScanGenerik ada). Modul ini dibangun baru pakai `ScanGenerik` (popup
//    scan berulang, SAMA komponen yang dipakai semua tab Proses Produksi
//    lain) supaya konsisten dengan Cutting/Serie/Sewing/Finishing, BUKAN
//    dengan Scan Opname bahan yang lebih tua. Alur sesi: buka sesi (in-
//    memory Set kode_pcs yang sudah discan, SAMA konvensi "riwayat sesi...
//    in-memory saja" milik vue-scan-opname.js sendiri) -> scan berkali-kali
//    -> "Selesaikan Sesi" men-diff scan vs `label_pcs` berstatus 'di_gudang'/
//    'perlu_dicari': yang TIDAK discan (status 'di_gudang') -> 'perlu_dicari'.
//    Yang discan TAPI berstatus 'perlu_dicari' -> kembali 'di_gudang'
//    (ditemukan). Log ringkas ditulis ke koleksi opsional
//    `opname_produk_jadi/{autoId}` (tanggal, oleh, durasi, jumlah dicek/
//    cocok/perlu dicari/ditemukan kembali) — field "jumlah dihapus" yang
//    disebut SERAH-TERIMA §5 TIDAK diisi di sini (konfirmasi hilang per pcs
//    di popup 5.4a adalah aksi TERPISAH & belakangan, jumlahnya tidak
//    diketahui saat sesi opname selesai) — deviasi kecil, didokumentasikan
//    di sini, bukan ditebak diam-diam.
//
// 10. Popup 5.4a "Konfirmasi Hilang" — pakai `PopupPinGenerik` (SAMA
//    komponen dipakai Sewing utk Scan Operator) dengan `:roles-diizinkan=
//    "['owner']"` PERSIS sesuai kalimat SERAH-TERIMA "Konfirmasi hapus per
//    pcs: PIN Owner" (bukan PIC+ seperti gerbang operator pos lain).
//
// 11. Tab 5.3 "Riwayat Keluar" menambah pencarian+rentang tanggal+Unduh CSV
//    (TIDAK diminta eksplisit di SERAH-TERIMA §2, cuma bilang "read-only")
//    — preseden KONSISTEN dipakai SEMUA tab riwayat/selesai di app ini
//    (Sewing 3.5, Finishing 4.5) — bukan fitur baru yang ditebak sendiri.
//    Ditambah lookup ringan ke `transaksi_kasir` (map id->no_transaksi/
//    nama_pelanggan) supaya baris riwayat lebih berguna daripada cuma ID
//    mentah — modul Kasir belum dibangun jadi tab ini realistis akan KOSONG
//    sampai modul itu ada, bukan bug.
//
// 12. Tidak ada Tunjuk Operator/PIN operator di modul ini — SERAH-TERIMA
//    tidak menyebut konsep operator sama sekali untuk Gudang (beda dari
//    Cutting/Sewing/Finishing yang semua punya penunjukan operator per
//    tahap) — semua aksi cukup gerbang `cekIzinMenu(menuId,'edit')` biasa.
//
// GAP DISENGAJA (bukan bug):
// - Tab 5.3 "Riwayat Keluar" & alokasi `order_spk_id` di Tab 5.1 akan
//   tampak "kosong"/"selalu stok bebas" sampai modul Kasir (Penjualan Kasir
//   rework, di luar cakupan sesi ini) benar-benar menulis order_spk & scan
//   label_pcs saat checkout — field-field itu SUDAH DISEDIAKAN modul ini,
//   tinggal menunggu modul Kasir memakainya.
// ============================================================================

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { ScanGenerik, PopupPinGenerik, ajukanPersiapanMasalah } from './vue-scan-cetak.js?v=3';

// --- Format & hitung kecil (disalin pola dari Cutting/Serie/Sewing/Finishing). --
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
const TLC_ASAL_GUDANG = 'TLC-GBJ'; // sama literal dgn TLC_TUJUAN_GUDANG milik Serie (js/vue-pp-serie.js)

// --- Baca koleksi mentah -----------------------------------------------------
async function muatSemuaSeparatingBatch() {
  const snap = await getDocs(collection(db, 'separating_batch'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function muatSemuaSewingTrack() {
  const snap = await getDocs(collection(db, 'sewing_track'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function muatSemuaLabelPcs() {
  const snap = await getDocs(collection(db, 'label_pcs'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// --- Alokasi FIFO ke order_spk (keputusan #7) --------------------------------
async function alokasikanKePoFifo(pcs) {
  if (!pcs.sku_produk) return null;
  try {
    const snap = await getDocs(query(collection(db, 'order_spk'), where('sku_produk', '==', pcs.sku_produk), where('status', '==', 'Aktif')));
    const daftarOrder = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.dibuat_pada?.seconds || 0) - (b.dibuat_pada?.seconds || 0));
    for (const o of daftarOrder) {
      const snapAlokasi = await getDocs(query(collection(db, 'label_pcs'), where('order_spk_id', '==', o.id)));
      if (snapAlokasi.size < (parseFloat(o.qty_order) || 0)) return o.id;
    }
    return null;
  } catch (e) { console.error('Gagal alokasi FIFO ke order_spk:', e); return null; }
}

// --- Scan Sampai (keputusan #4): tutup separating_batch + tandai label_pcs --
async function prosesScanSampaiBatch(batch) {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'separating_batch', batch.id), { status: 'selesai', sampai_pada: now });
  const sewingCocok = (await muatSemuaSewingTrack()).filter(s => s.batch_id === batch.id);
  if (!sewingCocok.length) return 0;
  const pcsSnaps = await Promise.all(sewingCocok.map(s => getDocs(query(collection(db, 'label_pcs'), where('batch_id', '==', s.id)))));
  const daftarPcs = pcsSnaps.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
  await Promise.all(daftarPcs.map(p => updateDoc(doc(db, 'label_pcs', p.id), { sampai_pada: now })));
  return daftarPcs.length;
}

// Popup Scan Masalah generik (jumlah kurang + alasan) — sumberJalur:'gudang'.
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
async function kirimMasalahGudang(b, jumlah, alasan) {
  await ajukanPersiapanMasalah({
    tlcAsal: TLC_ASAL_GUDANG, sumberJalur: 'gudang',
    trackId: b.id, noSpk: b.kode_batch,
    bahanNama: b.nama_produk, bahanWarna: b.size || '', satuan: 'pcs',
    qtyKurang: jumlah, alasan
  });
}

// ============================================================================
// TAB 5.1: Perlu Disimpan — dua seksi: (a) Batch Menunggu Sampai (dari
// separating_batch status 'kirim_gudang', Scan Sampai + Unpack + Masalah),
// (b) Pcs Siap Disimpan (dari label_pcs sudah sampai_pada tapi belum
// status:'di_gudang', Scan Masuk Gudang per pcs). Lihat keputusan #3/#4/#5/#6.
// ============================================================================
const GudangPerluDisimpan = {
  components: { ScanGenerik },
  setup() {
    const memuat = ref(true);
    const daftarBatch = ref([]); // menunggu sampai (separating_batch)
    const semuaLabelPcs = ref([]); // seluruh label_pcs, dipakai utk 2 keperluan (siap disimpan + hitung progres X/Y per batch)
    const menuId = 'proses_gudang';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const [batchList, pcsList] = await Promise.all([muatSemuaSeparatingBatch(), muatSemuaLabelPcs()]);
        daftarBatch.value = batchList.filter(b => b.status === 'kirim_gudang');
        semuaLabelPcs.value = pcsList;
      } catch (e) { console.error('Gagal muat Gudang > Perlu Disimpan:', e); daftarBatch.value = []; semuaLabelPcs.value = []; }
      memuat.value = false;
    }

    // --- Seksi (b): pcs sudah sampai_pada, belum masuk gudang, dikelompokkan
    // per kode_batch + hitung progres X/Y dari SELURUH label_pcs batch itu
    // (bukan cuma yang belum, supaya penyebutnya benar). --------------------
    const kelompokSiapDisimpan = computed(() => {
      const peta = {};
      semuaLabelPcs.value.forEach(p => {
        if (!p.sampai_pada) return;
        const key = p.kode_batch || '(tanpa kode batch)';
        if (!peta[key]) peta[key] = { kodeBatch: key, namaProduk: p.nama_produk, size: p.size, warna: p.warna, total: 0, sudahMasuk: 0, pending: [] };
        peta[key].total++;
        if (p.status === 'di_gudang' || p.status === 'terjual' || p.status === 'perlu_dicari' || p.status === 'hilang') peta[key].sudahMasuk++;
        else peta[key].pending.push(p);
      });
      return Object.values(peta).filter(g => g.pending.length > 0);
    });

    // --- Scan Sampai: step1 kode_tugas, step2 kode_bagging berkali-kali,
    // dicocokkan ke separating_batch (SAMA pola Finishing/Sewing). Begitu
    // SEMUA kode_bagging cocok discan -> tutup batch (keputusan #4). --------
    const modalSampai = reactive({ aktif: false, batch: null, log: [] });
    function bukaScanSampai() { modalSampai.batch = null; modalSampai.log = []; modalSampai.aktif = true; }
    function tutupScanSampai() { modalSampai.aktif = false; modalSampai.batch = null; modalSampai.log = []; muat(); }
    async function hasilScanSampai(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      if (!modalSampai.batch) {
        const b = daftarBatch.value.find(x => x.kode_tugas === kode);
        if (!b) { alert(`Kode tugas "${kode}" tidak ditemukan di antara batch yang sedang dikirim ke Gudang.`); return; }
        modalSampai.batch = b;
        return;
      }
      const b = modalSampai.batch;
      if (!(b.kode_bagging || []).includes(kode)) { alert(`Kode bagging "${kode}" tidak cocok dengan tugas ini.`); return; }
      if (modalSampai.log.includes(kode)) { alert(`Kode bagging "${kode}" sudah discan sebelumnya di sesi ini.`); return; }
      modalSampai.log.unshift(kode);
      const sudahSemua = (b.kode_bagging || []).every(kb => modalSampai.log.includes(kb));
      if (sudahSemua) {
        try {
          const jumlahPcs = await prosesScanSampaiBatch(b);
          modalSampai.log.unshift('SEMUA bagging sampai — batch ' + (b.kode_batch || '') + ' (' + jumlahPcs + ' pcs) siap discan masuk gudang. Batch ditutup di Serie.');
          await muat();
        } catch (e) { console.error('Gagal tutup batch Gudang:', e); alert('Gagal menyimpan. Coba lagi.'); }
      }
    }

    // --- Scan Unpack: cari batch via separating_batch, tambah unpack_log
    // (field BERSAMA milik Serie, keputusan #5). ----------------------------
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
        popupUnpack.value = { batch: b, kodeBagging: kode, hasil: 'komplit' };
      } catch (e) { console.error('Gagal cari kode bagging (unpack):', e); alert('Gagal mencari. Coba lagi.'); }
    }
    async function konfirmasiUnpack() {
      const p = popupUnpack.value;
      if (!p) return;
      try {
        await updateDoc(doc(db, 'separating_batch', p.batch.id), {
          unpack_log: arrayUnion({ kode_bagging: p.kodeBagging, status: p.hasil, pada: new Date().toISOString(), oleh: 'Gudang Barang Jadi' })
        });
        popupUnpack.value = null;
        await muat();
      } catch (e) { console.error('Gagal simpan unpack Gudang:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    // --- Scan Masuk Gudang: scan 1 kode_pcs, alokasi FIFO, set status. -----
    const modalMasuk = reactive({ aktif: false, log: [] });
    function bukaScanMasuk() { modalMasuk.log = []; modalMasuk.aktif = true; }
    function tutupScanMasuk() { modalMasuk.aktif = false; modalMasuk.log = []; muat(); }
    async function hasilScanMasuk(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      try {
        const p = semuaLabelPcs.value.find(x => x.kode_pcs === kode);
        if (!p) { alert(`Kode pcs "${kode}" tidak ditemukan.`); return; }
        if (p.status === 'di_gudang') { alert(`Pcs "${kode}" sudah tercatat masuk gudang sebelumnya.`); return; }
        if (p.status === 'terjual' || p.status === 'hilang' || p.status === 'perlu_dicari') { alert(`Pcs "${kode}" berstatus "${p.status}" — tidak bisa discan masuk gudang lagi.`); return; }
        if (!p.sampai_pada) { alert(`Pcs "${kode}" belum discan Scan Sampai dari Serie — scan sampai batch-nya dulu.`); return; }
        const now = new Date().toISOString();
        const orderSpkId = await alokasikanKePoFifo(p);
        await updateDoc(doc(db, 'label_pcs', p.id), { status: 'di_gudang', gudang_masuk_pada: now, order_spk_id: orderSpkId });
        modalMasuk.log.unshift(kode + (orderSpkId ? ' -> masuk gudang (teralokasi ke PO)' : ' -> masuk gudang (stok bebas)'));
        p.status = 'di_gudang'; p.sampai_pada = p.sampai_pada; // update lokal ringan supaya progres kartu langsung berubah tanpa muat ulang penuh
        await muat();
      } catch (e) { console.error('Gagal scan masuk gudang:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahGudang(p.target, p.jumlah, p.alasan);
      await muat();
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, daftarBatch, kelompokSiapDisimpan, bolehProses, formatQty, formatDiamSejak, tertahan,
      modalSampai, bukaScanSampai, tutupScanSampai, hasilScanSampai,
      modalUnpackScan, popupUnpack, bukaScanUnpack, tutupScanUnpack, hasilScanUnpack, konfirmasiUnpack,
      modalMasuk, bukaScanMasuk, tutupScanMasuk, hasilScanMasuk,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <h3 class="gc-heading" style="font-size:12.5px; font-weight:700; margin:0 0 8px;"><i class="fas fa-truck-ramp-box" style="margin-right:6px;"></i>Batch Menunggu Sampai dari Serie</h3>
      <div v-if="bolehProses" style="display:flex; gap:8px; margin-bottom:12px;">
        <button @click="bukaScanSampai" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Sampai</button>
        <button @click="bukaScanUnpack" class="btn-outline" style="flex:1; padding:9px;"><i class="fas fa-box-open" style="margin-right:6px;"></i>Scan Unpack</button>
      </div>
      <div v-if="daftarBatch.length === 0" class="gc-kosong gc-card" style="margin-bottom:16px;">
        <div class="lingkaran"><i class="fas fa-inbox"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada batch yang sedang ditunggu dari Serie</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
        <div v-for="b in daftarBatch" :key="b.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(b.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ b.kode_batch }}</div>
            <span class="tag" :class="tertahan(b.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(b.masuk_tahap_pada) }}</span>
          </div>
          <div style="font-size:12px; color:var(--text-faint); margin-bottom:10px;">{{ b.nama_produk }} &middot; size {{ b.size || '-' }} &middot; qty {{ formatQty(b.qty) }} &middot; kode tugas {{ b.kode_tugas || '-' }}</div>
          <button v-if="bolehProses" @click="bukaMasalah(b)" class="btn-outline" style="width:100%; padding:8px; font-size:11px; color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
        </div>
      </div>

      <h3 class="gc-heading" style="font-size:12.5px; font-weight:700; margin:0 0 8px;"><i class="fas fa-warehouse" style="margin-right:6px;"></i>Pcs Siap Disimpan</h3>
      <div v-if="bolehProses" style="margin-bottom:12px;">
        <button @click="bukaScanMasuk" class="btn-primary" style="width:100%; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Masuk Gudang</button>
      </div>
      <div v-if="kelompokSiapDisimpan.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-box-open"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada pcs yang menunggu discan masuk gudang</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="g in kelompokSiapDisimpan" :key="g.kodeBatch" class="gc-card" style="padding:14px; border-radius:20px;">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ g.kodeBatch }}</div>
            <span class="tag ok">{{ g.sudahMasuk }}/{{ g.total }} masuk</span>
          </div>
          <div style="font-size:12px; color:var(--text-faint);">{{ g.namaProduk }} &middot; size {{ g.size || '-' }} &middot; warna {{ g.warna || '-' }} &middot; sisa {{ g.pending.length }} pcs</div>
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
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Hasil Unpack — {{ popupUnpack.kodeBagging }}</h3>
        <div class="gc-field" style="margin-bottom:14px;"><label>Status</label>
          <select v-model="popupUnpack.hasil"><option value="komplit">KOMPLIT</option><option value="inkomplit">INKOMPLIT</option></select>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="popupUnpack = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiUnpack" class="btn-primary" style="flex:1; padding:9px;">Simpan</button>
        </div>
      </div>
    </div>

    <scan-generik :aktif="modalMasuk.aktif" judul="Scan Masuk Gudang" subjudul="Scan QR label pcs satu per satu. Bisa berkali-kali." @hasil="hasilScanMasuk" @tutup="tutupScanMasuk" />
    <div v-if="modalMasuk.aktif && modalMasuk.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:280px;">
      <div v-for="(l,i) in modalMasuk.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.target.kode_batch }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. produk cacat dari luar"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// TAB 5.2: Stok Tersedia — view read-only, derived dari label_pcs status
// 'di_gudang', dikelompokkan per produk+size+warna (keputusan #1/#7).
// ============================================================================
const GudangStokTersedia = {
  setup() {
    const memuat = ref(true);
    const kataKunci = ref('');
    const kelompok = ref([]);

    async function muat() {
      memuat.value = true;
      try {
        const semua = (await muatSemuaLabelPcs()).filter(p => p.status === 'di_gudang');
        const peta = {};
        semua.forEach(p => {
          const key = (p.sku_produk || p.nama_produk || '-') + '|' + (p.size || '-') + '|' + (p.warna || '-');
          if (!peta[key]) peta[key] = { sku: p.sku_produk || '-', namaProduk: p.nama_produk || '-', size: p.size || '-', warna: p.warna || '-', jumlah: 0, teralokasi: 0 };
          peta[key].jumlah++;
          if (p.order_spk_id) peta[key].teralokasi++;
        });
        kelompok.value = Object.values(peta).sort((a, b) => a.namaProduk.localeCompare(b.namaProduk));
      } catch (e) { console.error('Gagal muat Gudang > Stok Tersedia:', e); kelompok.value = []; }
      memuat.value = false;
    }

    const kelompokTersaring = computed(() => {
      const kata = kataKunci.value.trim().toLowerCase();
      if (!kata) return kelompok.value;
      return kelompok.value.filter(g => g.namaProduk.toLowerCase().includes(kata) || g.sku.toLowerCase().includes(kata));
    });
    const totalStok = computed(() => kelompok.value.reduce((a, g) => a + g.jumlah, 0));

    onMounted(async () => { await window.authReady; await muat(); });

    return { memuat, kelompokTersaring, totalStok, kataKunci, formatQty };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div class="gc-card" style="padding:12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <div style="font-size:12px; color:var(--text-faint);">Total pcs di gudang</div>
        <div class="gc-num" style="font-weight:700; font-size:16px;">{{ formatQty(totalStok) }}</div>
      </div>
      <input v-model="kataKunci" type="text" placeholder="Cari produk / SKU..." style="width:100%; margin-bottom:12px; padding:8px; background:var(--ivory-dim); border-radius:10px; border:1px solid var(--line);">
      <div v-if="kelompokTersaring.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-boxes-stacked"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada stok produk jadi di gudang</h3>
        <p style="font-size:11px; color:var(--text-faint); margin-top:6px;">Terisi otomatis begitu ada pcs discan masuk gudang di Tab "Perlu Disimpan".</p>
      </div>
      <div v-else class="gc-card" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead><tr style="text-align:left; border-bottom:1px solid var(--line);">
            <th style="padding:6px 8px;">SKU</th><th style="padding:6px 8px;">Produk</th><th style="padding:6px 8px;">Size</th><th style="padding:6px 8px;">Warna</th>
            <th style="padding:6px 8px;">Jumlah</th><th style="padding:6px 8px;">Teralokasi PO</th><th style="padding:6px 8px;">Bebas</th>
          </tr></thead>
          <tbody>
            <tr v-for="g in kelompokTersaring" :key="g.sku + g.size + g.warna" style="border-bottom:1px solid var(--line);">
              <td style="padding:6px 8px;">{{ g.sku }}</td>
              <td style="padding:6px 8px;">{{ g.namaProduk }}</td>
              <td style="padding:6px 8px;">{{ g.size }}</td>
              <td style="padding:6px 8px;">{{ g.warna }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatQty(g.jumlah) }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatQty(g.teralokasi) }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatQty(g.jumlah - g.teralokasi) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  `
};

// ============================================================================
// TAB 5.3: Riwayat Keluar — read-only, label_pcs status 'terjual' (keputusan
// #11). Realistis kosong sampai modul Kasir dibangun (GAP DISENGAJA).
// ============================================================================
const GudangRiwayatKeluar = {
  setup() {
    const memuat = ref(true);
    const semuaTerjual = ref([]);
    const petaTransaksi = ref({});
    const kataKunci = ref('');
    const dariTanggal = ref('');
    const sampaiTanggal = ref('');

    async function muat() {
      memuat.value = true;
      try {
        const [pcsList, trxSnap] = await Promise.all([
          muatSemuaLabelPcs(),
          getDocs(collection(db, 'transaksi_kasir')).catch(() => ({ docs: [] }))
        ]);
        semuaTerjual.value = pcsList.filter(p => p.status === 'terjual').sort((a, b) => new Date(b.terjual_pada || 0) - new Date(a.terjual_pada || 0));
        const peta = {};
        (trxSnap.docs || []).forEach(d => { peta[d.id] = d.data(); });
        petaTransaksi.value = peta;
      } catch (e) { console.error('Gagal muat Gudang > Riwayat Keluar:', e); semuaTerjual.value = []; }
      memuat.value = false;
    }

    function infoTransaksi(p) {
      const t = petaTransaksi.value[p.transaksi_kasir_id];
      return t ? (t.no_transaksi || p.transaksi_kasir_id) + (t.nama_pelanggan ? ' — ' + t.nama_pelanggan : '') : (p.transaksi_kasir_id || '-');
    }

    const daftarUrut = computed(() => {
      let hasil = semuaTerjual.value;
      const kata = kataKunci.value.trim().toLowerCase();
      if (kata) hasil = hasil.filter(p => (p.kode_pcs || '').toLowerCase().includes(kata) || (p.nama_produk || '').toLowerCase().includes(kata));
      if (dariTanggal.value) hasil = hasil.filter(p => p.terjual_pada && new Date(p.terjual_pada) >= new Date(dariTanggal.value));
      if (sampaiTanggal.value) hasil = hasil.filter(p => p.terjual_pada && new Date(p.terjual_pada) <= new Date(sampaiTanggal.value + 'T23:59:59'));
      return hasil;
    });

    function unduhCsv() {
      if (!daftarUrut.value.length) { alert('Tidak ada data untuk diunduh.'); return; }
      const header = ['Kode Pcs', 'Produk', 'Size', 'Warna', 'Transaksi', 'Terjual Pada'];
      const baris = daftarUrut.value.map(p => [p.kode_pcs, p.nama_produk, p.size, p.warna, infoTransaksi(p), formatWaktu(p.terjual_pada)]);
      const csv = [header, ...baris].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `gudang-riwayat-keluar-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    onMounted(async () => { await window.authReady; await muat(); });

    return { memuat, daftarUrut, kataKunci, dariTanggal, sampaiTanggal, unduhCsv, infoTransaksi, formatWaktu };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <input v-model="kataKunci" type="text" placeholder="Cari kode pcs / produk..." style="flex:2; min-width:160px; padding:8px; background:var(--ivory-dim); border-radius:10px; border:1px solid var(--line);">
        <input v-model="dariTanggal" type="date" style="flex:1; min-width:130px; padding:8px; border-radius:10px; border:1px solid var(--line);">
        <input v-model="sampaiTanggal" type="date" style="flex:1; min-width:130px; padding:8px; border-radius:10px; border:1px solid var(--line);">
        <button @click="unduhCsv" class="btn-outline" style="padding:8px 14px; font-size:11.5px;"><i class="fas fa-download" style="margin-right:6px;"></i>Unduh CSV</button>
      </div>
      <div v-if="daftarUrut.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-receipt"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada riwayat penjualan</h3>
        <p style="font-size:11px; color:var(--text-faint); margin-top:6px;">Terisi begitu Kasir (Pesanan &gt; Penjualan Kasir) scan QR label pcs — modul itu belum selesai dibangun, jadi wajar kosong untuk saat ini.</p>
      </div>
      <div v-else class="gc-card" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead><tr style="text-align:left; border-bottom:1px solid var(--line);">
            <th style="padding:6px 8px;">Kode Pcs</th><th style="padding:6px 8px;">Produk</th><th style="padding:6px 8px;">Transaksi</th><th style="padding:6px 8px;">Terjual Pada</th>
          </tr></thead>
          <tbody>
            <tr v-for="p in daftarUrut" :key="p.id" style="border-bottom:1px solid var(--line);">
              <td style="padding:6px 8px;" class="gc-num">{{ p.kode_pcs }}</td>
              <td style="padding:6px 8px;">{{ p.nama_produk }} {{ p.size }} {{ p.warna }}</td>
              <td style="padding:6px 8px;">{{ infoTransaksi(p) }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatWaktu(p.terjual_pada) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  `
};

// ============================================================================
// TAB 5.4: Scan Opname + popup 5.4a — sesi scan berulang (keputusan #9/#10).
// ============================================================================
const GudangScanOpname = {
  components: { ScanGenerik, PopupPinGenerik },
  setup() {
    const memuat = ref(true);
    const daftarAktif = ref([]); // status 'di_gudang' atau 'perlu_dicari' — universe fisik yang relevan
    const menuId = 'proses_gudang';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try { daftarAktif.value = (await muatSemuaLabelPcs()).filter(p => p.status === 'di_gudang' || p.status === 'perlu_dicari'); }
      catch (e) { console.error('Gagal muat Gudang > Scan Opname:', e); daftarAktif.value = []; }
      memuat.value = false;
    }

    const daftarPerluDicari = computed(() => daftarAktif.value.filter(p => p.status === 'perlu_dicari'));

    // --- Sesi opname (in-memory, keputusan #9) -----------------------------
    const sesi = reactive({ aktif: false, mulaiPada: null, scanned: new Set(), log: [] });
    function mulaiSesi() { sesi.aktif = true; sesi.mulaiPada = Date.now(); sesi.scanned = new Set(); sesi.log = []; }
    const modalScanAktif = ref(false);
    function bukaScan() { modalScanAktif.value = true; }
    function tutupScan() { modalScanAktif.value = false; }
    function hasilScanOpname(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      const p = daftarAktif.value.find(x => x.kode_pcs === kode);
      if (!p) { alert(`Kode "${kode}" tidak dikenali sebagai stok gudang aktif (bukan status di_gudang/perlu_dicari).`); return; }
      if (sesi.scanned.has(kode)) { alert(`Pcs "${kode}" sudah discan di sesi ini.`); return; }
      sesi.scanned.add(kode);
      sesi.log.unshift(kode + (p.status === 'perlu_dicari' ? ' (sebelumnya perlu dicari — akan ditemukan kembali)' : ' (cocok)'));
    }
    async function selesaikanSesi() {
      if (!confirm(`Selesaikan sesi opname? ${sesi.scanned.size} dari ${daftarAktif.value.length} pcs sudah discan. Yang TIDAK discan (status di_gudang) akan ditandai "Perlu Dicari".`)) return;
      try {
        const akanDicari = daftarAktif.value.filter(p => p.status === 'di_gudang' && !sesi.scanned.has(p.kode_pcs));
        const akanDitemukan = daftarAktif.value.filter(p => p.status === 'perlu_dicari' && sesi.scanned.has(p.kode_pcs));
        const cocok = daftarAktif.value.filter(p => p.status === 'di_gudang' && sesi.scanned.has(p.kode_pcs)).length;
        await Promise.all([
          ...akanDicari.map(p => updateDoc(doc(db, 'label_pcs', p.id), { status: 'perlu_dicari' })),
          ...akanDitemukan.map(p => updateDoc(doc(db, 'label_pcs', p.id), { status: 'di_gudang' }))
        ]);
        await addDoc(collection(db, 'opname_produk_jadi'), {
          tanggal: new Date().toISOString().slice(0, 10),
          oleh: window.currentUser?.email || '',
          durasi_detik: Math.round((Date.now() - sesi.mulaiPada) / 1000),
          jumlah_dicek: sesi.scanned.size,
          jumlah_cocok: cocok,
          jumlah_perlu_dicari: akanDicari.length,
          jumlah_ditemukan_kembali: akanDitemukan.length,
          dibuat_pada: serverTimestamp()
        });
        alert(`Sesi selesai. Cocok: ${cocok}. Perlu dicari (baru): ${akanDicari.length}. Ditemukan kembali: ${akanDitemukan.length}.`);
        sesi.aktif = false; sesi.mulaiPada = null; sesi.scanned = new Set(); sesi.log = [];
        await muat();
      } catch (e) { console.error('Gagal selesaikan sesi opname:', e); alert('Gagal menyimpan hasil opname. Coba lagi.'); }
    }
    function batalSesi() { sesi.aktif = false; sesi.mulaiPada = null; sesi.scanned = new Set(); sesi.log = []; }

    // --- Popup 5.4a: Konfirmasi Hilang, PIN Owner (keputusan #10) ----------
    const targetHilang = ref(null);
    const popupPinAktif = ref(false);
    function bukaKonfirmasiHilang(p) { targetHilang.value = p; popupPinAktif.value = true; }
    async function pinSuksesHilang() {
      popupPinAktif.value = false;
      const p = targetHilang.value;
      targetHilang.value = null;
      if (!p) return;
      try { await updateDoc(doc(db, 'label_pcs', p.id), { status: 'hilang' }); await muat(); }
      catch (e) { console.error('Gagal set status hilang:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, daftarAktif, daftarPerluDicari, bolehProses,
      sesi, mulaiSesi, modalScanAktif, bukaScan, tutupScan, hasilScanOpname, selesaikanSesi, batalSesi,
      targetHilang, popupPinAktif, bukaKonfirmasiHilang, pinSuksesHilang
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div class="gc-card" style="padding:14px; margin-bottom:14px;">
        <p style="font-size:11px; color:var(--text-faint); margin-bottom:12px; line-height:1.5;">Scan semua pcs fisik yang ada di gudang untuk dicocokkan ke sistem. Pcs yang tidak discan sampai sesi selesai akan ditandai "Perlu Dicari".</p>
        <div v-if="!sesi.aktif">
          <button v-if="bolehProses" @click="mulaiSesi" class="btn-primary" style="padding:10px 20px;"><i class="fas fa-play" style="margin-right:6px;"></i>Mulai Sesi Opname</button>
        </div>
        <div v-else>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span class="gc-num" style="font-weight:700; font-size:14px;">{{ sesi.scanned.size }} / {{ daftarAktif.length }} dicek</span>
            <button @click="bukaScan" class="btn-primary" style="padding:8px 16px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan</button>
          </div>
          <div style="display:flex; gap:8px;">
            <button @click="selesaikanSesi" class="btn-primary" style="flex:1; padding:9px;">Selesaikan Sesi</button>
            <button @click="batalSesi" class="btn-outline" style="padding:9px 16px;">Batal</button>
          </div>
          <div v-if="sesi.log.length" style="margin-top:12px; max-height:160px; overflow-y:auto; font-size:11px; color:var(--text-faint);">
            <div v-for="(l,i) in sesi.log.slice(0,20)" :key="i">{{ l }}</div>
          </div>
        </div>
      </div>

      <h3 class="gc-heading" style="font-size:12.5px; font-weight:700; margin:0 0 8px;">Perlu Dicari</h3>
      <div v-if="daftarPerluDicari.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-magnifying-glass"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada pcs yang perlu dicari</h3>
      </div>
      <div v-else class="gc-card" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead><tr style="text-align:left; border-bottom:1px solid var(--line);">
            <th style="padding:6px 8px;">Kode Pcs</th><th style="padding:6px 8px;">Produk</th><th style="padding:6px 8px;"></th>
          </tr></thead>
          <tbody>
            <tr v-for="p in daftarPerluDicari" :key="p.id" style="border-bottom:1px solid var(--line);">
              <td style="padding:6px 8px;" class="gc-num">{{ p.kode_pcs }}</td>
              <td style="padding:6px 8px;">{{ p.nama_produk }} {{ p.size }} {{ p.warna }}</td>
              <td style="padding:6px 8px;"><button @click="bukaKonfirmasiHilang(p)" class="btn-outline" style="padding:5px 12px; font-size:10.5px; color:var(--danger);">Konfirmasi Hilang</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <scan-generik :aktif="modalScanAktif" judul="Scan Opname — Pcs Fisik" subjudul="Scan QR label pcs satu per satu, bisa berkali-kali." @hasil="hasilScanOpname" @tutup="tutupScan" />

    <popup-pin-generik v-if="popupPinAktif" judul="Konfirmasi Hilang — PIN Owner" konteks="Gudang Barang Jadi - Konfirmasi Hilang" :roles-diizinkan="['owner']" @sukses="pinSuksesHilang" @batal="popupPinAktif = false" />
  `
};

// --- Mount ke index.html — LAZY, SAMA pola Cutting/Serie/Sewing/Finishing. --
let vmGudangPerluDisimpan = null;
window.pastikanMountGudangPerluDisimpan = function () {
  if (vmGudangPerluDisimpan) return;
  const mountPoint = document.getElementById('vue-gudang-perludisimpan');
  if (mountPoint) vmGudangPerluDisimpan = createApp(GudangPerluDisimpan).mount('#vue-gudang-perludisimpan');
};
let vmGudangStokTersedia = null;
window.pastikanMountGudangStokTersedia = function () {
  if (vmGudangStokTersedia) return;
  const mountPoint = document.getElementById('vue-gudang-stoktersedia');
  if (mountPoint) vmGudangStokTersedia = createApp(GudangStokTersedia).mount('#vue-gudang-stoktersedia');
};
let vmGudangRiwayatKeluar = null;
window.pastikanMountGudangRiwayatKeluar = function () {
  if (vmGudangRiwayatKeluar) return;
  const mountPoint = document.getElementById('vue-gudang-riwayatkeluar');
  if (mountPoint) vmGudangRiwayatKeluar = createApp(GudangRiwayatKeluar).mount('#vue-gudang-riwayatkeluar');
};
let vmGudangScanOpname = null;
window.pastikanMountGudangScanOpname = function () {
  if (vmGudangScanOpname) return;
  const mountPoint = document.getElementById('vue-gudang-scanopname');
  if (mountPoint) vmGudangScanOpname = createApp(GudangScanOpname).mount('#vue-gudang-scanopname');
};
