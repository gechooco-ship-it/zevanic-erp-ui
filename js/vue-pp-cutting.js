// js/vue-pp-cutting.js
// ============================================================================
// Proses Produksi > Cutting — menu BARU (7 Sep 2026 malam lanjut lagi,
// wireframe handoff "03 - Proses Produksi / 01 - Cutting", dikerjakan atas
// instruksi eksplisit Guru: "retrofit Scan Masalah supaya clear lanjut ke
// proses produksi" — retrofit Scan Masalah SUDAH SELESAI (lihat js/vue-
// scan-cetak.js, js/vue-persiapan-{bahan,sewing,webbing,finishing}.js), file
// ini adalah bagian "lanjut ke proses produksi"-nya.
//
// PENYIMPANGAN URUTAN (dicatat, BUKAN pelanggaran diam-diam) — lihat
// claude/RENCANA-REKONSTRUKSI-2026-09.md §6: urutan yang disarankan Guru
// sendiri (7 Sep 2026 sore) adalah menyelesaikan SELURUH Persiapan Produksi
// (langkah 5-9: Kekurangan Bahan/Acc lain, Persiapan Belanja, Vendor) DULU
// sebelum masuk Proses Produksi/Cutting (langkah 10). Instruksi Guru malam
// ini ("lanjut ke proses produksi") LONCAT dari urutan itu — SAMA POLA
// dengan langkah 15 (Pesanan piutang) yang juga sudah pernah loncat urutan
// atas permintaan eksplisit. Dicatat di STATUS-PROYEK.md, bukan ditolak
// ataupun disembunyikan.
//
// ARSITEKTUR DATA — PENTING, baca dulu sebelum ubah apapun di sini:
//
// Proses Produksi punya koleksi TERPISAH dari Persiapan (BUKAN extend
// spk_track) — dikonfirmasi dari wireframe.dc.html sendiri ("Persiapan
// operasi per bahan/aksesoris; Proses operasi per produk jadi"). Koleksi
// BARU (belum ada di repo sebelum file ini, lihat firestore.rules):
//   cutting_track — 1 dokumen per SPK Grouping yang masuk Cutting. Field:
//     grouping_id, kode_spk, nama_produk, size, qty_total,
//     sku_produk_terlibat[] (disalin dari spk_grouping, dipakai cari BOM),
//     status (7 nilai: perlu_diproses -> sedang_ampar -> sedang_pola ->
//     sedang_cutting -> perlu_dikirim -> sedang_dikirim -> selesai),
//     op_ampar/op_pola/op_cutting ({uid,nama,riwayat[]} atau null — CUMA
//     PIC/PIC Owner/Owner boleh mengisi, lihat catatan role di bawah),
//     unpack_log[] ({kode_bagging,status,pada}), komponen_rincian[]
//     ({nama_komponen,qty_per_pola,isi_pola_pcs,jumlah_label,
//     label_dicetak_pada}), kode_bagging[], kode_tugas, tlc_tujuan,
//     tujuan_akhir, catatan_masalah, masuk_tahap_pada (ISO string, ganti
//     tiap pindah status — dasar ambang tertahan), sampai_pada (BELUM ADA
//     PENULIS — lihat catatan "GAP disengaja" di bawah), dibuat_pada/
//     diperbarui_pada (serverTimestamp()).
//   label_komponen — 1 dokumen per label komponen (4x2in thermal, BUKAN
//     4x2cm yang disebut wireframe — ikuti keputusan lama Guru 28 Agt 2026,
//     lihat catatan sama di js/vue-persiapan-bahan.js, PopupPratinjauCetakLabel).
//     Field: kode (format KMPyymmdd-NNN, SAMA pola dgn BAG/TGS — bukan
//     literal "KMP+yymmdd+NNN" dari SERAH-TERIMA, itu cuma notasi deskriptif),
//     cutting_track_id, nama_komponen, status_pola/status_cutting
//     ('belum'|'selesai'), pola_pada/cutting_pada (ISO), dibuat_pada.
//   pengaturan_id_label_komponen/{yymmdd} — counter harian, {counter,
//     dibuat_pada} — pola SAMA seperti pengaturan_id_bagging/tugas_kirim.
//
// KEPUTUSAN ARSITEKTUR (judgment call, DIDOKUMENTASIKAN karena SERAH-TERIMA
// tidak menjawab eksplisit — lihat STATUS-PROYEK.md §5.20 untuk versi
// lengkapnya):
//
// 1. KAPAN cutting_track DIBUAT — TIDAK dihook ke buatSpkTrackUntukGrouping()
//    (js/vue-persiapan-produksi-v2.js, file YANG SUDAH STABIL & LIVE). Function
//    itu SENGAJA TIDAK disentuh di sini — resiko regresi ke alur penerbitan
//    SPK Grouping yang sudah teruji tidak sepadan dengan manfaatnya. Sebagai
//    gantinya, cutting_track dibuat LAZY oleh Tab 1.1 (Perlu Di Proses) itu
//    sendiri: setiap kali tab ini dibuka, baca SEMUA `spk_grouping` + SEMUA
//    `cutting_track`, untuk grouping yang belum punya track, buat baru
//    (status:'perlu_diproses') saat itu juga. Idempoten (dicek dulu sebelum
//    membuat), aman dipanggil berkali-kali. Efek: kalau Guru belum pernah
//    membuka tab Cutting, grouping-grouping lama TIDAK otomatis punya
//    cutting_track — baru muncul begitu tab ini dibuka pertama kali (BUKAN
//    bug, konsekuensi keputusan ini, dicatat supaya tidak dikira error).
// 2. Scan Sampai (1.1) — dari sisi TEKNIS, dirancang meniru pasangan Scan
//    Kirim di pos Bahan (js/vue-persiapan-bahan.js Tab 3: kode_tugas lalu
//    kode_bagging berkali-kali). Setiap kode_bagging yang discan dicocokkan
//    ke `spk_track` (jalur:'bahan') baris `bahan_rincian[]` yang
//    `kode_bagging` sama, lalu ditulis `sampai_pada = sekarang` — inilah
//    yang MENUTUP Persiapan Bahan (field itu sebelumnya TIDAK PERNAH ADA
//    PENULISNYA, lihat catatan besar di js/vue-persiapan-bahan.js &
//    RENCANA-REKONSTRUKSI-2026-09.md §9.3 — modul inilah penulis pertamanya).
// 3. Scan Operator (ampar/pola/cutting) — role HARUS PIC atau PIC Owner atau
//    Owner (SUPERUSER ikut diizinkan juga — di app ini superuser SELALU
//    setara-atau-di-atas Owner di semua gerbang lain, mengecualikannya di
//    sini akan jadi satu-satunya tempat yang beda sendiri, jadi diikutkan
//    juga sebagai judgment call), TIDAK tampil untuk Admin/Operator (SERAH-
//    TERIMA §3). Diimplementasikan DUA LAPIS: (a) tombol "Tunjuk Operator"
//    di-v-if berdasarkan role user yang SEDANG LOGIN (window.currentUser) —
//    kalau bukan pic/owner/superuser, tombolnya TIDAK ADA sama sekali di
//    DOM: (b) begitu diklik, WAJIB verifikasi identitas lewat PIN
//    (PopupPinGenerik, js/vue-scan-cetak.js — komponen ini SUDAH menyebut
//    contoh konteks "Cutting - Scan Operator" di komentarnya sendiri sejak
//    ditulis 7 Sep 2026, jadi ini BUKAN penemuan API baru, cuma memenuhi
//    yang sudah disiapkan) dengan rolesDiizinkan:['owner','superuser',
//    'pic_owner','pic'] — PIN inilah yang benar-benar menentukan SIAPA
//    (individu) yang tercatat sebagai operator (device/login bisa dipakai
//    bersama, PIN membedakan orangnya).
// 4. Sumber BOM komponen (label Cetak Label Komponen) — `master_produk`
//    dicari lewat field `sku` yang match salah satu `sku_produk_terlibat`
//    grouping (ambil index [0], sama pola seperti "Pola Utama" di js/vue-
//    master-produk.js — grouping SPK selalu diklaster dari SKU dengan
//    kunci_pola yang SAMA, jadi bom_pola SKU manapun dalam grouping itu
//    identik). Rumus jumlah label PER KOMPONEN = isi_pola_pcs (dari
//    bom_pola[0]) x komponen.qty — SUDAH DIVERIFIKASI cocok dengan contoh
//    angka konkret di wireframe (qty_order 180, isi_pola 5, amparan 36,
//    "4 komponen isi pola 5 -> 20 label"). Dicetak SEKALI per cutting_track
//    (bukan per amparan/lot — amparan cuma menentukan berapa lapis kain
//    ditumpuk sebelum dipotong bersamaan, bukan pengali jumlah label).
// 5. Mobile UX — wireframe menggambar navbar bawah "QR-centric" (5 slot:
//    Tugas/Riwayat/QR/Masalah/Saya) yang TIDAK ADA presedennya di 4 pos
//    Persiapan Produksi yang sudah live. Per PEDOMAN-SERAH-TERIMA.md
//    ("wireframe = acuan struktur, BUKAN acuan visual, komponen visual
//    WAJIB pakai yang sudah ada"), navbar QR itu dianggap MENGGAMBARKAN
//    interaksi yang SAMA (tap untuk scan berkonteks kartu), bukan komponen
//    baru yang wajib dibangun ulang — file ini memakai pola kartu+tombol
//    responsif yang SAMA seperti Bahan/Acc Sewing/Webbing/Finishing
//    (satu tampilan, desktop maupun HP), BUKAN navbar QR terpisah.
// 6. GAP DISENGAJA (bukan bug) — persis simetris dengan gap Bahan yang baru
//    ditutup modul ini: field `sampai_pada` di `cutting_track` sendiri
//    (penanda Tab 1.7 Selesai) BELUM PUNYA PENULIS di sesi ini — itu tugas
//    modul SERIE (di luar cakupan SERAH-TERIMA Cutting, lihat §4 Scope:
//    "Serie, Sewing, Finishing, Gudang — sub menu terpisah"). Tab 1.7
//    (Selesai) di modul ini akan TAMPIL KOSONG sampai Serie dibangun dan
//    menulis field itu — SAMA POLA seperti Masalah kosong sampai retrofit,
//    BUKAN error.
// 7. Scan Masalah — SEMUA tab (termasuk 1.1 & tab "Sedang" 1.2-1.4 & 1.6,
//    SERAH-TERIMA §8 butir 3) memanggil `ajukanPersiapanMasalah()` (js/vue-
//    scan-cetak.js) dengan `sumberJalur:'cutting'` — NILAI BARU, field
//    `persiapan_masalah.sumber_jalur` di komentar lama vue-pp-masalah.js
//    cuma menyebut 4 nilai (bahan/sewing/webbing/finishing) karena ditulis
//    SEBELUM Cutting ada; sudah dicek silang ke kode Masalah (vue-pp-
//    masalah.js) — field itu dipakai 100% generik (kunci pengelompokan +
//    teks tampilan), TIDAK ada percabangan yang membatasi ke 4 nilai lama,
//    jadi nilai baru 'cutting' aman dipakai tanpa mengubah file itu.
// 8. Ambang "tertahan" tetap 6 jam hardcode (AMBANG_TERTAHAN_JAM), SAMA
//    seperti 4 pos lain — menu config per-pos (RENCANA §9.1) belum dibangun
//    di modul manapun, bukan sesuatu yang khusus ketinggalan di sini.
//
// Print label & scan QR: PAKAI ULANG PopupPratinjauCetakLabel & ScanGenerik
// (js/vue-components.js, js/vue-scan-cetak.js) — TIDAK ada komponen visual
// baru ditulis di sini, konsisten dengan seluruh app.
// ============================================================================

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel } from './vue-components.js?v=5';
import { ScanGenerik, PopupPinGenerik, buatQrDataUrl, ajukanPersiapanMasalah } from './vue-scan-cetak.js?v=2';

// --- Format & hitung kecil (disalin pola dari 4 pos Persiapan Produksi,
// belum dipindah ke helper generik — lihat catatan "belum ada infrastruktur
// util generik lintas file" di modul-modul itu). ---------------------------
function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
const AMBANG_TERTAHAN_JAM = 6; // keputusan Guru 31 Agt 2026, sama semua pos — lihat catatan §8 di atas
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
// picOwnerKeAtas — BEDA dari tierOwnerKeAtas() di vue-scan-cetak.js (itu
// mewajibkan pic_owner SPESIFIK, bukan pic biasa). Di sini SEMUA pic
// (owner ATAU pic_owner) diizinkan, sesuai SERAH-TERIMA §3 "PIC/PIC
// Owner/Owner only" — lihat keputusan §3 di komentar besar atas file ini.
function picOwnerKeAtas(userData) {
  if (!userData) return false;
  const role = (userData.role || '').toLowerCase();
  return role === 'owner' || role === 'superuser' || role === 'pic';
}

// --- Baca gabungan spk_grouping + cutting_track -----------------------------
async function muatSemuaGrouping() {
  const snap = await getDocs(collection(db, 'spk_grouping'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function muatSemuaCuttingTrack() {
  const snap = await getDocs(collection(db, 'cutting_track'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function muatSemuaLabelKomponen() {
  const snap = await getDocs(collection(db, 'label_komponen'));
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
// pastikanCuttingTrackLengkap — keputusan §1 di komentar besar atas file:
// buat cutting_track utk grouping yang belum punya, LAZY, idempoten.
async function pastikanCuttingTrackLengkap() {
  const [groupingList, trackList] = await Promise.all([muatSemuaGrouping(), muatSemuaCuttingTrack()]);
  const sudahAda = new Set(trackList.map(t => t.grouping_id));
  const belum = groupingList.filter(g => !sudahAda.has(g.id));
  if (belum.length) {
    const now = new Date().toISOString();
    await Promise.all(belum.map(g => addDoc(collection(db, 'cutting_track'), {
      grouping_id: g.id, kode_spk: g.kode_spk || '', nama_produk: g.nama_produk || '',
      size: g.size || '', qty_total: parseFloat(g.qty_total) || 0,
      sku_produk_terlibat: g.sku_produk_terlibat || [],
      status: 'perlu_diproses',
      op_ampar: null, op_pola: null, op_cutting: null,
      unpack_log: [], entry_ampar_done: 0,
      komponen_rincian: [], kode_bagging: [], kode_tugas: '', tlc_tujuan: '', tujuan_akhir: '',
      catatan_masalah: '', masuk_tahap_pada: now, sampai_pada: null,
      dibuat_pada: serverTimestamp(), diperbarui_pada: serverTimestamp()
    })));
  }
  return await muatSemuaCuttingTrack();
}
// hitungKomponenRincian — keputusan §4 di komentar besar atas file.
function hitungKomponenRincian(track, petaProduk) {
  const sku = (track.sku_produk_terlibat || [])[0];
  const produk = sku ? petaProduk[sku] : null;
  const pola = (produk && Array.isArray(produk.bom_pola)) ? produk.bom_pola[0] : null;
  if (!pola) return [];
  const isiPola = parseFloat(pola.isi_pola_pcs) || 0;
  const komponen = Array.isArray(pola.komponen) ? pola.komponen : [];
  if (isiPola <= 0 || !komponen.length) return [];
  return komponen.map(k => ({
    nama_komponen: k.nama_komponen || '(tanpa nama)',
    qty_per_pola: parseFloat(k.qty) || 0,
    isi_pola_pcs: isiPola,
    jumlah_label: isiPola * (parseFloat(k.qty) || 0),
    label_dicetak_pada: null
  }));
}
// updateCuttingTrack — read-modify-write ATOMIK (pola sama seperti
// updateBarisBahan() di 4 pos lain), dipakai tiap tulis balik cutting_track.
async function updateCuttingTrack(trackId, mutator) {
  const ref = doc(db, 'cutting_track', trackId);
  await runTransaction(db, async (trx) => {
    const snap = await trx.get(ref);
    if (!snap.exists()) throw new Error('Dokumen cutting_track tidak ditemukan.');
    const data = snap.data();
    const patch = mutator(data) || {};
    trx.update(ref, { ...patch, diperbarui_pada: serverTimestamp() });
  });
}
// progresLabel — hitung live dari label_komponen (BUKAN cache), konsisten
// pola "dihitung live" seperti hitungPakaiPerMinggu() di vue-pp-masalah.js.
function progresLabel(track, semuaLabel, field) {
  const punya = semuaLabel.filter(l => l.cutting_track_id === track.id);
  const total = (track.komponen_rincian || []).reduce((s, k) => s + (k.jumlah_label || 0), 0);
  const selesai = punya.filter(l => l[field] === 'selesai').length;
  return { done: selesai, total: total || punya.length };
}

// Popup Scan Masalah generik (jumlah kurang + alasan) — SAMA persis pola
// popup yang dipakai retrofit 4 pos Persiapan Produksi (7 Sep 2026, §5.19),
// dipakai ULANG DI SINI lewat 1 mixin kecil per komponen (bukan file
// terpisah — cukup fungsi factory karena semua tab butuh bentuk sama).
function popupMasalahMixin(kirimFn) {
  const popupMasalah = ref(null); // { track, jumlah, alasan }
  function bukaMasalah(track) { popupMasalah.value = { track, jumlah: track.qty_total || 0, alasan: '' }; }
  function batalMasalah() { popupMasalah.value = null; }
  async function konfirmasiMasalah() {
    const p = popupMasalah.value;
    if (!p) return;
    if (!p.alasan.trim()) { alert('Alasan wajib diisi.'); return; }
    try {
      await kirimFn(p);
      popupMasalah.value = null;
    } catch (e) { console.error('Gagal ajukan masalah:', e); alert('Gagal menyimpan. Coba lagi.'); }
  }
  return { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah };
}
async function kirimMasalahCutting(track, jumlah, alasan) {
  await ajukanPersiapanMasalah({
    tlcAsal: 'TLC-PTG', sumberJalur: 'cutting',
    trackId: track.id, noSpk: track.kode_spk,
    bahanNama: track.nama_produk, bahanWarna: track.size, satuan: 'pcs',
    qtyKurang: jumlah, alasan
  });
}

// ============================================================================
// TAB 1.1: Perlu Di Proses
// ============================================================================
const CuttingPerluDiProses = {
  components: { ScanGenerik, PopupPinGenerik },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const menuId = 'cut_cutting';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehOperator = computed(() => picOwnerKeAtas(window.currentUser));

    async function muat() {
      memuat.value = true;
      try { daftar.value = (await pastikanCuttingTrackLengkap()).filter(t => t.status === 'perlu_diproses'); }
      catch (e) { console.error('Gagal muat Cutting > Perlu Di Proses:', e); daftar.value = []; }
      memuat.value = false;
    }

    // --- Scan Sampai: step1 kode_tugas, step2 kode_bagging berkali-kali ---
    // Menutup Persiapan Bahan: tulis sampai_pada ke spk_track.bahan_rincian[]
    // yang kode_bagging-nya cocok (lihat keputusan §2 komentar besar atas file).
    const modalSampai = reactive({ aktif: false, tugas: null, log: [] });
    function bukaScanSampai() { modalSampai.tugas = null; modalSampai.log = []; modalSampai.aktif = true; }
    function tutupScanSampai() { modalSampai.aktif = false; modalSampai.tugas = null; modalSampai.log = []; muat(); }
    async function hasilScanSampai(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      if (!modalSampai.tugas) {
        try {
          const snap = await getDocs(query(collection(db, 'tugas_kirim'), where('kode', '==', kode)));
          if (snap.empty) { alert(`Kode tugas "${kode}" tidak ditemukan.`); return; }
          modalSampai.tugas = { id: snap.docs[0].id, ...snap.docs[0].data() };
        } catch (e) { console.error('Gagal cari kode tugas:', e); }
        return;
      }
      try {
        const snapTrack = await getDocs(query(collection(db, 'spk_track'), where('jalur', '==', 'bahan')));
        const now = new Date().toISOString();
        let kena = 0;
        for (const d of snapTrack.docs) {
          const data = d.data();
          const baris = Array.isArray(data.bahan_rincian) ? data.bahan_rincian : [];
          const idx = baris.findIndex(b => b.kode_bagging === kode && !b.sampai_pada);
          if (idx < 0) continue;
          const barisBaru = baris.slice();
          barisBaru[idx] = { ...barisBaru[idx], sampai_pada: now };
          await updateDoc(doc(db, 'spk_track', d.id), { bahan_rincian: barisBaru });
          kena++;
        }
        if (!kena) { alert(`Kode bagging "${kode}" tidak ditemukan / sudah pernah di-Scan Sampai.`); return; }
        modalSampai.log.unshift(kode + ' -> sampai (' + kena + ' baris)');
      } catch (e) { console.error('Gagal scan sampai:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    // --- Scan Unpack: per bagging, KOMPLIT/INKOMPLIT ---
    const popupUnpack = ref(null); // { track, kodeBagging, hasil }
    const modalUnpackScan = reactive({ aktif: false, track: null });
    function bukaScanUnpack(track) { modalUnpackScan.track = track; modalUnpackScan.aktif = true; }
    function tutupScanUnpack() { modalUnpackScan.aktif = false; modalUnpackScan.track = null; }
    function hasilScanUnpack(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      popupUnpack.value = { track: modalUnpackScan.track, kodeBagging: kode, hasil: 'komplit' };
    }
    async function konfirmasiUnpack() {
      const p = popupUnpack.value;
      if (!p) return;
      try {
        await updateCuttingTrack(p.track.id, () => ({
          unpack_log: arrayUnion({ kode_bagging: p.kodeBagging, status: p.hasil, pada: new Date().toISOString() })
        }));
        popupUnpack.value = null;
        await muat();
      } catch (e) { console.error('Gagal simpan unpack:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    // --- Tunjuk Operator Ampar (PIN, role PIC/PIC Owner/Owner) ---
    const popupPinAmpar = ref(null); // track
    function bukaTunjukAmpar(track) { popupPinAmpar.value = track; }
    async function pinSuksesAmpar(user) {
      const track = popupPinAmpar.value;
      popupPinAmpar.value = null;
      try {
        await updateCuttingTrack(track.id, (data) => ({
          op_ampar: { uid: user.email, nama: user.nama || user.name || user.email, riwayat: [...((data.op_ampar && data.op_ampar.riwayat) || []), { uid: user.email, nama: user.nama || user.name || user.email, pada: new Date().toISOString() }] },
          status: 'sedang_ampar', masuk_tahap_pada: new Date().toISOString()
        }));
        await muat();
      } catch (e) { console.error('Gagal tunjuk operator ampar:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahCutting(p.track, p.jumlah, p.alasan);
      await muat();
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, daftar, bolehProses, bolehOperator, formatQty, formatDiamSejak, tertahan,
      modalSampai, bukaScanSampai, tutupScanSampai, hasilScanSampai,
      popupUnpack, modalUnpackScan, bukaScanUnpack, tutupScanUnpack, hasilScanUnpack, konfirmasiUnpack,
      popupPinAmpar, bukaTunjukAmpar, pinSuksesAmpar,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div v-if="daftar.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-inbox"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada SPK Grouping yang perlu diproses</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="t in daftar" :key="t.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ t.kode_spk }}</div>
            <span class="tag" :class="tertahan(t.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(t.masuk_tahap_pada) }}</span>
          </div>
          <div style="font-size:12px; color:var(--text-faint); margin-bottom:10px;">{{ t.nama_produk }} &middot; size {{ t.size || '-' }} &middot; qty {{ formatQty(t.qty_total) }}</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button v-if="bolehProses" @click="bukaScanSampai" class="btn-primary" style="flex:1; min-width:120px; padding:8px; font-size:11.5px;"><i class="fas fa-qrcode" style="margin-right:4px;"></i>Scan Sampai</button>
            <button v-if="bolehProses" @click="bukaScanUnpack(t)" class="btn-outline" style="flex:1; min-width:120px; padding:8px; font-size:11.5px;"><i class="fas fa-box-open" style="margin-right:4px;"></i>Scan Unpack</button>
            <button v-if="bolehOperator" @click="bukaTunjukAmpar(t)" class="btn-outline" style="flex:1; min-width:120px; padding:8px; font-size:11.5px;"><i class="fas fa-user-check" style="margin-right:4px;"></i>Tunjuk Operator Ampar</button>
            <button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="flex:1; min-width:120px; padding:8px; font-size:11.5px; color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
          </div>
          <div v-if="t.unpack_log && t.unpack_log.length" style="margin-top:8px; font-size:10.5px; color:var(--text-faint);">
            Unpack: <span v-for="(u,i) in t.unpack_log" :key="i" class="tag" :class="u.status==='komplit' ? 'ok' : 'warn'" style="margin-right:4px;">{{ u.kode_bagging }}: {{ u.status }}</span>
          </div>
        </div>
      </div>
    </template>

    <scan-generik :aktif="modalSampai.aktif" :judul="modalSampai.tugas ? ('Scan kode bagging — tugas ' + modalSampai.tugas.kode) : 'Scan Kode Tugas'" subjudul="Bisa discan berkali-kali (tiap kode bagging = 1 pack dari Bahan)." @hasil="hasilScanSampai" @tutup="tutupScanSampai" />
    <div v-if="modalSampai.aktif && modalSampai.tugas && modalSampai.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:260px;">
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

    <popup-pin-generik v-if="popupPinAmpar" judul="Verifikasi PIN — Operator Ampar" konteks="Cutting - Scan Operator Ampar" :roles-diizinkan="['owner','superuser','pic_owner','pic']" @sukses="pinSuksesAmpar" @batal="popupPinAmpar = null" />

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.track.kode_spk }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. kain cacat, sobek, dst"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// TAB 1.2: Sedang Ampar
// ============================================================================
const CuttingSedangAmpar = {
  components: { ScanGenerik, PopupPinGenerik },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const menuId = 'cut_cutting';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehOperator = computed(() => picOwnerKeAtas(window.currentUser));

    async function muat() {
      memuat.value = true;
      try { daftar.value = (await muatSemuaCuttingTrack()).filter(t => t.status === 'sedang_ampar'); }
      catch (e) { console.error('Gagal muat Cutting > Sedang Ampar:', e); daftar.value = []; }
      memuat.value = false;
    }

    // --- Scan Entry: gelar kain per SPK, counter naik tiap scan ---
    const modalEntry = reactive({ aktif: false, track: null });
    function bukaScanEntry(track) { modalEntry.track = track; modalEntry.aktif = true; }
    function tutupScanEntry() { modalEntry.aktif = false; modalEntry.track = null; muat(); }
    async function hasilScanEntry(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      const track = modalEntry.track;
      if (kode !== track.kode_spk) { alert(`Kode "${kode}" tidak cocok dengan SPK ${track.kode_spk}.`); return; }
      try {
        await updateCuttingTrack(track.id, (data) => ({ entry_ampar_done: (parseFloat(data.entry_ampar_done) || 0) + 1 }));
        track.entry_ampar_done = (parseFloat(track.entry_ampar_done) || 0) + 1;
      } catch (e) { console.error('Gagal scan entry ampar:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    // --- Tandai Ampar Selesai & Tunjuk Operator Pola (hitung komponen_rincian dari BOM) ---
    const popupPinPola = ref(null);
    function bukaTunjukPola(track) { popupPinPola.value = track; }
    async function pinSuksesPola(user) {
      const track = popupPinPola.value;
      popupPinPola.value = null;
      try {
        const petaProduk = await ambilPetaProdukBySku();
        const komponen = hitungKomponenRincian(track, petaProduk);
        if (!komponen.length) {
          if (!confirm('BOM Pola produk ini belum punya rincian Komponen (master_produk.bom_pola[0].komponen kosong) — tidak ada label yang bisa dihitung. Lanjut ke Sedang Pola tanpa rincian komponen?')) return;
        }
        await updateCuttingTrack(track.id, (data) => ({
          op_pola: { uid: user.email, nama: user.nama || user.name || user.email, riwayat: [...((data.op_pola && data.op_pola.riwayat) || []), { uid: user.email, nama: user.nama || user.name || user.email, pada: new Date().toISOString() }] },
          komponen_rincian: komponen,
          status: 'sedang_pola', masuk_tahap_pada: new Date().toISOString()
        }));
        await muat();
      } catch (e) { console.error('Gagal tunjuk operator pola:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahCutting(p.track, p.jumlah, p.alasan);
      await muat();
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, daftar, bolehProses, bolehOperator, formatQty, formatDiamSejak, tertahan,
      modalEntry, bukaScanEntry, tutupScanEntry, hasilScanEntry,
      popupPinPola, bukaTunjukPola, pinSuksesPola,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div v-if="daftar.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-gears"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang sedang digelar (ampar)</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="t in daftar" :key="t.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ t.kode_spk }}</div>
            <span class="tag" :class="tertahan(t.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(t.masuk_tahap_pada) }}</span>
          </div>
          <div style="font-size:12px; color:var(--text-faint); margin-bottom:6px;">{{ t.nama_produk }} &middot; size {{ t.size || '-' }} &middot; qty {{ formatQty(t.qty_total) }}</div>
          <div style="font-size:11px; color:var(--text-faint); margin-bottom:10px;">Operator ampar: <b>{{ (t.op_ampar && t.op_ampar.nama) || '-' }}</b> &middot; entry {{ t.entry_ampar_done || 0 }}</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button v-if="bolehProses" @click="bukaScanEntry(t)" class="btn-primary" style="flex:1; min-width:120px; padding:8px; font-size:11.5px;"><i class="fas fa-qrcode" style="margin-right:4px;"></i>Scan Entry</button>
            <button v-if="bolehOperator" @click="bukaTunjukPola(t)" class="btn-outline" style="flex:1; min-width:150px; padding:8px; font-size:11.5px;"><i class="fas fa-user-check" style="margin-right:4px;"></i>Ampar Selesai &amp; Tunjuk Operator Pola</button>
            <button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="flex:1; min-width:120px; padding:8px; font-size:11.5px; color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
          </div>
        </div>
      </div>
    </template>

    <scan-generik :aktif="modalEntry.aktif" :judul="modalEntry.track ? ('Scan Entry — ' + modalEntry.track.kode_spk) : 'Scan Entry'" subjudul="Scan kode SPK tiap kali satu lot kain digelar. Bisa berkali-kali." @hasil="hasilScanEntry" @tutup="tutupScanEntry" />
    <popup-pin-generik v-if="popupPinPola" judul="Verifikasi PIN — Operator Pola" konteks="Cutting - Scan Operator Pola" :roles-diizinkan="['owner','superuser','pic_owner','pic']" @sukses="pinSuksesPola" @batal="popupPinPola = null" />

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.track.kode_spk }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. kain cacat, sobek, dst"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// TAB 1.3: Sedang Pola
// Cetak Label Komponen (4x2in thermal, lihat keputusan §4 komentar besar
// atas file) + Scan Entry per label (menandai status_pola='selesai').
// ============================================================================
const CuttingSedangPola = {
  components: { ScanGenerik, PopupPinGenerik, PopupPratinjauCetakLabel },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const semuaLabel = ref([]);
    const menuId = 'cut_cutting';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);
    const bolehOperator = computed(() => picOwnerKeAtas(window.currentUser));

    async function muat() {
      memuat.value = true;
      try {
        const [tracks, label] = await Promise.all([muatSemuaCuttingTrack(), muatSemuaLabelKomponen()]);
        daftar.value = tracks.filter(t => t.status === 'sedang_pola');
        semuaLabel.value = label;
      } catch (e) { console.error('Gagal muat Cutting > Sedang Pola:', e); daftar.value = []; semuaLabel.value = []; }
      memuat.value = false;
    }
    function progres(t) { return progresLabel(t, semuaLabel.value, 'status_pola'); }

    // --- Cetak Label Komponen: N label per komponen belum dicetak ---
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    const sedangCetak = ref(false);
    async function cetakLabelKomponen(track) {
      const belum = (track.komponen_rincian || []).filter(k => !k.label_dicetak_pada);
      if (!belum.length) { alert('Semua komponen produk ini sudah pernah dicetak labelnya.'); return; }
      sedangCetak.value = true;
      try {
        const preview = [];
        for (const k of belum) {
          const n = Math.max(1, Math.round(k.jumlah_label || 0));
          for (let i = 0; i < n; i++) {
            const kode = await generateKodeHarian('KMP', 'pengaturan_id_label_komponen');
            await addDoc(collection(db, 'label_komponen'), {
              kode, cutting_track_id: track.id, nama_komponen: k.nama_komponen,
              status_pola: 'belum', status_cutting: 'belum', pola_pada: null, cutting_pada: null,
              dibuat_pada: serverTimestamp()
            });
            preview.push({ kode, nama: k.nama_komponen, info: `${track.kode_spk} &middot; ${track.nama_produk} size ${track.size || '-'}`, qrDataUrl: buatQrDataUrl(kode) });
          }
        }
        await updateCuttingTrack(track.id, (data) => ({
          komponen_rincian: (data.komponen_rincian || []).map(k => belum.some(b => b.nama_komponen === k.nama_komponen) ? { ...k, label_dicetak_pada: new Date().toISOString() } : k)
        }));
        daftarLabelPreview.value = preview;
        popupCetakAktif.value = true;
        await muat();
      } catch (e) { console.error('Gagal cetak label komponen:', e); alert('Gagal mencetak. Coba lagi.'); }
      sedangCetak.value = false;
    }

    // --- Scan Entry per label komponen (status_pola -> selesai) ---
    const modalEntry = reactive({ aktif: false, track: null, log: [] });
    function bukaScanEntry(track) { modalEntry.track = track; modalEntry.log = []; modalEntry.aktif = true; }
    function tutupScanEntry() { modalEntry.aktif = false; modalEntry.track = null; modalEntry.log = []; muat(); }
    async function hasilScanEntry(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      try {
        const snap = await getDocs(query(collection(db, 'label_komponen'), where('kode', '==', kode)));
        if (snap.empty) { alert(`Label "${kode}" tidak ditemukan.`); return; }
        const d = snap.docs[0];
        if (d.data().cutting_track_id !== modalEntry.track.id) { alert(`Label "${kode}" bukan milik SPK ${modalEntry.track.kode_spk}.`); return; }
        await updateDoc(doc(db, 'label_komponen', d.id), { status_pola: 'selesai', pola_pada: new Date().toISOString() });
        modalEntry.log.unshift(kode + ' -> pola selesai');
        semuaLabel.value = semuaLabel.value.map(l => l.id === d.id ? { ...l, status_pola: 'selesai' } : l);
      } catch (e) { console.error('Gagal scan entry pola:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    // --- Tandai Pola Selesai & Tunjuk Operator Cutting ---
    const popupPinCutting = ref(null);
    function bukaTunjukCutting(track) {
      const p = progres(track);
      if (p.total > 0 && p.done < p.total && !confirm(`Progress label baru ${p.done}/${p.total}. Lanjut ke Sedang Cutting sekarang?`)) return;
      popupPinCutting.value = track;
    }
    async function pinSuksesCutting(user) {
      const track = popupPinCutting.value;
      popupPinCutting.value = null;
      try {
        await updateCuttingTrack(track.id, (data) => ({
          op_cutting: { uid: user.email, nama: user.nama || user.name || user.email, riwayat: [...((data.op_cutting && data.op_cutting.riwayat) || []), { uid: user.email, nama: user.nama || user.name || user.email, pada: new Date().toISOString() }] },
          status: 'sedang_cutting', masuk_tahap_pada: new Date().toISOString()
        }));
        await muat();
      } catch (e) { console.error('Gagal tunjuk operator cutting:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahCutting(p.track, p.jumlah, p.alasan);
      await muat();
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, daftar, bolehProses, bolehCetak, bolehOperator, sedangCetak, formatQty, formatDiamSejak, tertahan, progres,
      popupCetakAktif, daftarLabelPreview, cetakLabelKomponen,
      modalEntry, bukaScanEntry, tutupScanEntry, hasilScanEntry,
      popupPinCutting, bukaTunjukCutting, pinSuksesCutting,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div v-if="daftar.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-shapes"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang sedang digambar pola</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="t in daftar" :key="t.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ t.kode_spk }}</div>
            <span class="tag" :class="tertahan(t.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(t.masuk_tahap_pada) }}</span>
          </div>
          <div style="font-size:12px; color:var(--text-faint); margin-bottom:6px;">{{ t.nama_produk }} &middot; size {{ t.size || '-' }} &middot; qty {{ formatQty(t.qty_total) }}</div>
          <div style="font-size:11px; color:var(--text-faint); margin-bottom:6px;">Operator pola: <b>{{ (t.op_pola && t.op_pola.nama) || '-' }}</b> &middot; label {{ progres(t).done }}/{{ progres(t).total }}</div>
          <div v-if="(t.komponen_rincian||[]).length" style="font-size:10.5px; color:var(--text-faint); margin-bottom:10px;">
            <span v-for="(k,i) in t.komponen_rincian" :key="i" class="tag neutral" style="margin-right:4px;">{{ k.nama_komponen }}: {{ k.jumlah_label }} label{{ k.label_dicetak_pada ? ' (dicetak)' : '' }}</span>
          </div>
          <div v-else style="font-size:10.5px; color:var(--warn); margin-bottom:10px;">BOM Pola belum punya rincian Komponen — cek Master Produk.</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button v-if="bolehCetak" @click="cetakLabelKomponen(t)" :disabled="sedangCetak" class="btn-outline" style="flex:1; min-width:130px; padding:8px; font-size:11.5px;"><i class="fas fa-print" style="margin-right:4px;"></i>Cetak Label Komponen</button>
            <button v-if="bolehProses" @click="bukaScanEntry(t)" class="btn-primary" style="flex:1; min-width:120px; padding:8px; font-size:11.5px;"><i class="fas fa-qrcode" style="margin-right:4px;"></i>Scan Entry</button>
            <button v-if="bolehOperator" @click="bukaTunjukCutting(t)" class="btn-outline" style="flex:1; min-width:150px; padding:8px; font-size:11.5px;"><i class="fas fa-user-check" style="margin-right:4px;"></i>Pola Selesai &amp; Tunjuk Operator Cutting</button>
            <button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="flex:1; min-width:120px; padding:8px; font-size:11.5px; color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
          </div>
        </div>
      </div>
    </template>

    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Label Komponen" :daftar-label="daftarLabelPreview" jenis-cetak="label_komponen_cutting" @tutup="popupCetakAktif = false" />
    <scan-generik :aktif="modalEntry.aktif" :judul="modalEntry.track ? ('Scan Entry Pola — ' + modalEntry.track.kode_spk) : 'Scan Entry Pola'" subjudul="Scan tiap label komponen yang sudah selesai digambar polanya." @hasil="hasilScanEntry" @tutup="tutupScanEntry" />
    <div v-if="modalEntry.aktif && modalEntry.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:260px;">
      <div v-for="(l,i) in modalEntry.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>
    <popup-pin-generik v-if="popupPinCutting" judul="Verifikasi PIN — Operator Cutting" konteks="Cutting - Scan Operator Cutting" :roles-diizinkan="['owner','superuser','pic_owner','pic']" @sukses="pinSuksesCutting" @batal="popupPinCutting = null" />

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.track.kode_spk }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. kain cacat, sobek, dst"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// TAB 1.4: Sedang Cutting
// ============================================================================
const CuttingSedangCutting = {
  components: { ScanGenerik },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const semuaLabel = ref([]);
    const menuId = 'cut_cutting';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const [tracks, label] = await Promise.all([muatSemuaCuttingTrack(), muatSemuaLabelKomponen()]);
        daftar.value = tracks.filter(t => t.status === 'sedang_cutting');
        semuaLabel.value = label;
      } catch (e) { console.error('Gagal muat Cutting > Sedang Cutting:', e); daftar.value = []; semuaLabel.value = []; }
      memuat.value = false;
    }
    function progres(t) { return progresLabel(t, semuaLabel.value, 'status_cutting'); }

    const modalEntry = reactive({ aktif: false, track: null, log: [] });
    function bukaScanEntry(track) { modalEntry.track = track; modalEntry.log = []; modalEntry.aktif = true; }
    function tutupScanEntry() { modalEntry.aktif = false; modalEntry.track = null; modalEntry.log = []; muat(); }
    async function hasilScanEntry(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      try {
        const snap = await getDocs(query(collection(db, 'label_komponen'), where('kode', '==', kode)));
        if (snap.empty) { alert(`Label "${kode}" tidak ditemukan.`); return; }
        const d = snap.docs[0];
        if (d.data().cutting_track_id !== modalEntry.track.id) { alert(`Label "${kode}" bukan milik SPK ${modalEntry.track.kode_spk}.`); return; }
        await updateDoc(doc(db, 'label_komponen', d.id), { status_cutting: 'selesai', cutting_pada: new Date().toISOString() });
        modalEntry.log.unshift(kode + ' -> cutting selesai');
        semuaLabel.value = semuaLabel.value.map(l => l.id === d.id ? { ...l, status_cutting: 'selesai' } : l);
      } catch (e) { console.error('Gagal scan entry cutting:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    async function tandaiSelesaiCutting(track) {
      const p = progres(track);
      if (p.total > 0 && p.done < p.total && !confirm(`Progress cutting baru ${p.done}/${p.total} label. Lanjut ke Perlu Di Kirim sekarang?`)) return;
      try {
        await updateCuttingTrack(track.id, () => ({ status: 'perlu_dikirim', masuk_tahap_pada: new Date().toISOString() }));
        await muat();
      } catch (e) { console.error('Gagal tandai cutting selesai:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahCutting(p.track, p.jumlah, p.alasan);
      await muat();
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, daftar, bolehProses, formatQty, formatDiamSejak, tertahan, progres,
      modalEntry, bukaScanEntry, tutupScanEntry, hasilScanEntry, tandaiSelesaiCutting,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div v-if="daftar.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-scissors"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang sedang dipotong</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="t in daftar" :key="t.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ t.kode_spk }}</div>
            <span class="tag" :class="tertahan(t.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(t.masuk_tahap_pada) }}</span>
          </div>
          <div style="font-size:12px; color:var(--text-faint); margin-bottom:6px;">{{ t.nama_produk }} &middot; size {{ t.size || '-' }} &middot; qty {{ formatQty(t.qty_total) }}</div>
          <div style="font-size:11px; color:var(--text-faint); margin-bottom:10px;">Operator cutting: <b>{{ (t.op_cutting && t.op_cutting.nama) || '-' }}</b> &middot; label {{ progres(t).done }}/{{ progres(t).total }}</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button v-if="bolehProses" @click="bukaScanEntry(t)" class="btn-primary" style="flex:1; min-width:120px; padding:8px; font-size:11.5px;"><i class="fas fa-qrcode" style="margin-right:4px;"></i>Scan Entry</button>
            <button v-if="bolehProses" @click="tandaiSelesaiCutting(t)" class="btn-outline" style="flex:1; min-width:140px; padding:8px; font-size:11.5px;"><i class="fas fa-circle-check" style="margin-right:4px;"></i>Cutting Selesai</button>
            <button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="flex:1; min-width:120px; padding:8px; font-size:11.5px; color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
          </div>
        </div>
      </div>
    </template>

    <scan-generik :aktif="modalEntry.aktif" :judul="modalEntry.track ? ('Scan Entry Cutting — ' + modalEntry.track.kode_spk) : 'Scan Entry Cutting'" subjudul="Scan tiap label komponen yang sudah selesai dipotong." @hasil="hasilScanEntry" @tutup="tutupScanEntry" />
    <div v-if="modalEntry.aktif && modalEntry.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:260px;">
      <div v-for="(l,i) in modalEntry.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.track.kode_spk }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. kain cacat, sobek, dst"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// TAB 1.5: Perlu Di Kirim
// "Satu kartu satu SPK Grouping" (BEDA dari Bahan yang "satu kartu satu
// bahan+warna lintas dokumen") — jadi TIDAK perlu kelompokSepack() seperti
// Bahan, cukup daftar cutting_track langsung, SAMA pola dengan 3 pos Acc
// (Sewing/Webbing/Finishing). Cetak Surat Jalan + Kode Bagging digabung 1
// aksi (SERAH-TERIMA §3), dropdown tujuan pakai master_tlc (SAMA pola
// seperti Bahan) — "Sewing/Sablon/Webbing" cuma CONTOH label tujuan di
// SERAH-TERIMA, isi TLC sesungguhnya tetap dikelola bebas oleh Guru sendiri
// di Zevanic House > TLC & Prefix (TIDAK di-hardcode di sini).
// ============================================================================
const CuttingPerluDiKirim = {
  components: { PopupPratinjauCetakLabel, ScanGenerik },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const daftarBaggingAktif = ref([]);
    const daftarTlc = ref([]);
    const sedangProses = ref(false);
    const menuId = 'cut_cutting';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const [tracks, baggingSnap, tlcSnap] = await Promise.all([
          muatSemuaCuttingTrack(),
          getDocs(query(collection(db, 'bagging'), where('ditutup_pada', '==', null))),
          getDocs(collection(db, 'master_tlc'))
        ]);
        daftar.value = tracks.filter(t => t.status === 'perlu_dikirim');
        daftarBaggingAktif.value = baggingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        daftarTlc.value = tlcSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) { console.error('Gagal muat Cutting > Perlu Di Kirim:', e); daftar.value = []; daftarBaggingAktif.value = []; daftarTlc.value = []; }
      memuat.value = false;
    }

    // --- Cetak Surat Jalan + Kode Bagging (1 aksi, bundle per jenis komponen) ---
    const popupKirim = ref(null); // { track, tujuanAkhir, tlcTujuan }
    function bukaCetakKirim(track) {
      if (!daftarTlc.value.length) { alert('Belum ada data TLC (Titik Lokasi Cerdas). Tambah dulu di Zevanic House > TLC & Prefix.'); return; }
      popupKirim.value = { track, tujuanAkhir: 'Sewing', tlcTujuan: daftarTlc.value[0].kode };
    }
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    async function konfirmasiCetakKirim() {
      const p = popupKirim.value;
      const track = p.track;
      const jenisKomponen = Array.from(new Set((track.komponen_rincian || []).map(k => k.nama_komponen)));
      if (!jenisKomponen.length) { alert('Grouping ini belum punya rincian komponen (BOM Pola kosong) — tidak bisa dibundel per jenis komponen.'); return; }
      sedangProses.value = true;
      try {
        const preview = [];
        const kodeBaggingBaru = [];
        for (const jenis of jenisKomponen) {
          const kode = await generateKodeHarian('BAG', 'pengaturan_id_bagging');
          await addDoc(collection(db, 'bagging'), {
            kode, produk_label: `${track.kode_spk} &middot; ${jenis}`, isi: [], ditutup_pada: null,
            dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
          });
          kodeBaggingBaru.push(kode);
          preview.push({ kode, nama: jenis, info: `Kode Bagging &middot; ${track.kode_spk}`, qrDataUrl: buatQrDataUrl(kode) });
        }
        const kodeTugas = await generateKodeHarian('TGS', 'pengaturan_id_tugas_kirim');
        await addDoc(collection(db, 'tugas_kirim'), {
          kode: kodeTugas, tlc_asal: 'TLC-PTG', tlc_tujuan: p.tlcTujuan, pack: [],
          dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
        });
        preview.push({ kode: kodeTugas, nama: 'Surat Jalan (Kode Tugas)', info: `Tujuan: ${p.tujuanAkhir} &middot; TLC-PTG &rarr; ${p.tlcTujuan}`, qrDataUrl: buatQrDataUrl(kodeTugas) });
        await updateCuttingTrack(track.id, (data) => ({
          kode_bagging: [...(data.kode_bagging || []), ...kodeBaggingBaru],
          kode_tugas: kodeTugas, tujuan_akhir: p.tujuanAkhir
        }));
        daftarLabelPreview.value = preview;
        popupKirim.value = null;
        popupCetakAktif.value = true;
        await muat();
      } catch (e) { console.error('Gagal cetak surat jalan + kode bagging:', e); alert('Gagal mencetak. Coba lagi.'); }
      sedangProses.value = false;
    }

    // --- Scan Pack: step1 kode bagging, step2 kode label komponen berkali-kali ---
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
      try {
        const snap = await getDocs(query(collection(db, 'label_komponen'), where('kode', '==', kode)));
        if (snap.empty) { alert(`Kode "${kode}" bukan label komponen yang dikenali.`); return; }
        await updateDoc(doc(db, 'bagging', modalPack.bagging.id), { isi: arrayUnion(kode) });
        modalPack.log.unshift(kode + ' -> ' + modalPack.bagging.kode);
      } catch (e) { console.error('Gagal scan pack:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }
    async function tutupBagging() {
      if (!modalPack.bagging) return;
      try { await updateDoc(doc(db, 'bagging', modalPack.bagging.id), { ditutup_pada: serverTimestamp() }); } catch (e) { console.error('Gagal tutup bagging:', e); }
      modalPack.bagging = null;
    }

    // --- Scan Kirim: step1 kode tugas, step2 kode bagging tiap pack ---
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
      const track = daftar.value.find(t => t.kode_tugas === modalKirim.tugas.kode && (t.kode_bagging || []).includes(kode));
      if (!track) { alert(`Kode bagging "${kode}" tidak cocok dengan tugas ini.`); return; }
      try {
        await updateDoc(doc(db, 'tugas_kirim', modalKirim.tugas.id), { pack: arrayUnion({ kode_bagging: kode, pada: new Date().toISOString() }) });
        const tugasSnap = await getDoc(doc(db, 'tugas_kirim', modalKirim.tugas.id));
        const semuaSudah = (track.kode_bagging || []).every(kb => (tugasSnap.data().pack || []).some(p => p.kode_bagging === kb));
        if (semuaSudah) {
          await updateCuttingTrack(track.id, () => ({ status: 'sedang_dikirim', masuk_tahap_pada: new Date().toISOString(), tlc_tujuan: modalKirim.tugas.tlc_tujuan || '' }));
        }
        modalKirim.log.unshift(kode + ' -> ' + modalKirim.tugas.kode + (semuaSudah ? ' (semua pack terkirim, status pindah)' : ''));
        await muat();
      } catch (e) { console.error('Gagal scan kirim:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahCutting(p.track, p.jumlah, p.alasan);
      await muat();
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, daftar, daftarTlc, bolehProses, bolehCetak, sedangProses, formatQty, formatDiamSejak, tertahan,
      popupKirim, bukaCetakKirim, konfirmasiCetakKirim, popupCetakAktif, daftarLabelPreview,
      modalPack, bukaScanPack, tutupScanPack, hasilScanPack, tutupBagging,
      modalKirim, bukaScanKirim, tutupScanKirim, hasilScanKirim,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div v-if="bolehProses" style="display:flex; gap:8px; margin-bottom:12px;">
        <button @click="bukaScanPack" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Pack</button>
        <button @click="bukaScanKirim" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Kirim</button>
      </div>
      <div v-if="daftar.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-box-open"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang tertahan di Perlu Di Kirim</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="t in daftar" :key="t.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ t.kode_spk }}</div>
            <span class="tag" :class="tertahan(t.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(t.masuk_tahap_pada) }}</span>
          </div>
          <div style="font-size:12px; color:var(--text-faint); margin-bottom:6px;">{{ t.nama_produk }} &middot; size {{ t.size || '-' }} &middot; qty {{ formatQty(t.qty_total) }}</div>
          <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:10px;">
            <span v-if="t.kode_tugas" class="tag ok">{{ t.kode_tugas }} &rarr; {{ t.tujuan_akhir }}</span>
            <span v-else class="tag neutral">belum dicetak surat jalan</span>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button v-if="bolehCetak" @click="bukaCetakKirim(t)" class="btn-outline" style="flex:1; min-width:170px; padding:8px; font-size:11.5px;"><i class="fas fa-print" style="margin-right:4px;"></i>Cetak Surat Jalan + Kode Bagging</button>
            <button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="flex:1; min-width:120px; padding:8px; font-size:11.5px; color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
          </div>
        </div>
      </div>
    </template>

    <!-- BARU (8 Sep 2026) — jenis-cetak dipatok 'kode_bagging' (bukan
         dinamis) walau baris terakhir preview-nya "Surat Jalan (Kode
         Tugas)" (lembar_kode_tugas) — SENGAJA, karena 1x cetak ini
         mencampur item bagging+tugas dalam 1 job cetak yang sama (dicetak
         berurutan di printer/roll fisik yang sama), jadi tidak bisa pakai
         2 ukuran berbeda dalam 1x cetak. Kalau nanti Guru butuh ukuran
         beda utk baris Surat Jalan di sini, perlu redesain alur ini jadi
         2x cetak terpisah — belum termasuk cakupan sekarang. -->
    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Surat Jalan + Kode Bagging" :daftar-label="daftarLabelPreview" jenis-cetak="kode_bagging" @tutup="popupCetakAktif = false" />

    <div v-if="popupKirim" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Cetak Surat Jalan — {{ popupKirim.track.kode_spk }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Tujuan (label, fisik selalu lewat Serie)</label>
          <select v-model="popupKirim.tujuanAkhir"><option>Sewing</option><option>Sablon</option><option>Webbing</option></select>
        </div>
        <div class="gc-field" style="margin-bottom:14px;"><label>TLC Tujuan</label>
          <select v-model="popupKirim.tlcTujuan"><option v-for="t in daftarTlc" :key="t.id" :value="t.kode">{{ t.kode }} — {{ t.nama }}</option></select>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="popupKirim = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiCetakKirim" :disabled="sedangProses" class="btn-primary" style="flex:1; padding:9px;">Cetak</button>
        </div>
      </div>
    </div>

    <scan-generik :aktif="modalPack.aktif" :judul="modalPack.bagging ? ('Scan label komponen — bagging ' + modalPack.bagging.kode) : 'Scan Kode Bagging'" subjudul="Bisa discan berkali-kali. Tutup lewat tombol di bawah kalau sudah selesai." @hasil="hasilScanPack" @tutup="tutupScanPack" />
    <div v-if="modalPack.aktif && modalPack.bagging" style="position:fixed; left:16px; bottom:16px; z-index:10001; display:flex; flex-direction:column; gap:8px; max-width:260px;">
      <button @click="tutupBagging" class="btn-primary" style="padding:8px 14px; font-size:11px;">Tutup Bagging Ini</button>
      <div style="background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px;"><div v-for="(l,i) in modalPack.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div></div>
    </div>

    <scan-generik :aktif="modalKirim.aktif" :judul="modalKirim.tugas ? ('Scan kode bagging — tugas ' + modalKirim.tugas.kode) : 'Scan Kode Tugas'" subjudul="Bisa discan berkali-kali (tiap kode bagging = 1 pack)." @hasil="hasilScanKirim" @tutup="tutupScanKirim" />
    <div v-if="modalKirim.aktif && modalKirim.tugas && modalKirim.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:260px;">
      <div v-for="(l,i) in modalKirim.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.track.kode_spk }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. kain cacat, sobek, dst"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// TAB 1.6: Sedang Di Kirim
// Tracking read-only (SERAH-TERIMA §3: "pindah Selesai saat penerima scan
// sampai" — penerima = Serie, DI LUAR cakupan modul ini). BEDA dari pos
// Bahan (yang benar-benar tanpa tombol apapun di tab "Sedang Dikirim"-nya):
// SERAH-TERIMA Cutting §8 butir 3 eksplisit minta Scan Masalah ada di
// SEMUA tab "Sedang" TERMASUK tab ini — jadi 1 tombol Scan Masalah tetap
// ada, sisanya murni papan info.
// ============================================================================
const CuttingSedangDiKirim = {
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const menuId = 'cut_cutting';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try { daftar.value = (await muatSemuaCuttingTrack()).filter(t => t.status === 'sedang_dikirim'); }
      catch (e) { console.error('Gagal muat Cutting > Sedang Di Kirim:', e); daftar.value = []; }
      memuat.value = false;
    }

    const kelompokTugas = computed(() => {
      const peta = {};
      daftar.value.forEach(t => {
        const key = t.kode_tugas || '(tanpa kode tugas)';
        if (!peta[key]) peta[key] = { kodeTugas: key, tujuan: t.tlc_tujuan || '-', tujuanAkhir: t.tujuan_akhir || '-', daftar: [] };
        peta[key].daftar.push(t);
      });
      return Object.values(peta);
    });

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahCutting(p.track, p.jumlah, p.alasan);
      await muat();
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return { memuat, kelompokTugas, bolehProses, formatQty, formatDiamSejak, tertahan, popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah };
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
          <div class="gc-heading" style="font-weight:700; font-size:12.5px; margin-bottom:8px;">{{ g.kodeTugas }} &rarr; {{ g.tujuan }} ({{ g.tujuanAkhir }})</div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div v-for="t in g.daftar" :key="t.id" style="display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:11px; padding:6px 8px; border-radius:10px;" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : 'transparent' }">
              <span class="gc-num" style="font-weight:700;">{{ t.kode_spk }}</span>
              <span style="color:var(--text-faint);">{{ t.nama_produk }} size {{ t.size || '-' }}</span>
              <span class="gc-num" style="color:var(--text-faint);">diam {{ formatDiamSejak(t.masuk_tahap_pada) }}</span>
              <button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="padding:4px 8px; font-size:10px; color:var(--danger);"><i class="fas fa-triangle-exclamation"></i></button>
            </div>
          </div>
        </div>
      </div>
      <div style="margin-top:10px; font-size:10.5px; color:var(--text-faint); text-align:center;">Tab ini read-only — baris pindah ke Selesai otomatis begitu Serie melakukan Scan Sampai (modul Serie, belum dibangun).</div>
    </template>

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.track.kode_spk }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. kain cacat, sobek, dst"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// TAB 1.7: Selesai
// Riwayat: cari, filter tanggal, unduh CSV — pola SAMA seperti Tab 5 di 4
// pos Persiapan Produksi. AKAN TAMPIL KOSONG sampai modul Serie (di luar
// cakupan SERAH-TERIMA ini) menulis `sampai_pada` + `status:'selesai'` ke
// cutting_track — lihat keputusan §6 (GAP DISENGAJA) di komentar besar atas
// file. Ini BUKAN bug modul ini.
// ============================================================================
const CuttingSelesai = {
  setup() {
    const memuat = ref(true);
    const semuaSelesai = ref([]);
    const kataKunci = ref('');
    const dariTanggal = ref('');
    const sampaiTanggal = ref('');

    async function muat() {
      memuat.value = true;
      try { semuaSelesai.value = (await muatSemuaCuttingTrack()).filter(t => t.status === 'selesai').sort((a, b) => new Date(b.sampai_pada || 0) - new Date(a.sampai_pada || 0)); }
      catch (e) { console.error('Gagal muat Cutting > Selesai:', e); semuaSelesai.value = []; }
      memuat.value = false;
    }

    const selesaiHariIni = computed(() => semuaSelesai.value.filter(t => hariIniSama(t.sampai_pada)));

    const daftarUrut = computed(() => {
      let hasil = semuaSelesai.value;
      const kata = kataKunci.value.trim().toLowerCase();
      if (kata) hasil = hasil.filter(t => (t.kode_spk || '').toLowerCase().includes(kata) || (t.nama_produk || '').toLowerCase().includes(kata));
      if (dariTanggal.value) hasil = hasil.filter(t => t.sampai_pada && new Date(t.sampai_pada) >= new Date(dariTanggal.value));
      if (sampaiTanggal.value) hasil = hasil.filter(t => t.sampai_pada && new Date(t.sampai_pada) <= new Date(sampaiTanggal.value + 'T23:59:59'));
      return hasil;
    });

    function unduhCsv() {
      if (!daftarUrut.value.length) { alert('Tidak ada data untuk diunduh.'); return; }
      const header = ['Kode SPK', 'Produk', 'Size', 'Qty', 'Operator Ampar', 'Operator Pola', 'Operator Cutting', 'Kode Tugas', 'Tujuan Akhir', 'Selesai Pada'];
      const baris = daftarUrut.value.map(t => [
        t.kode_spk, t.nama_produk, t.size, t.qty_total,
        (t.op_ampar && t.op_ampar.nama) || '', (t.op_pola && t.op_pola.nama) || '', (t.op_cutting && t.op_cutting.nama) || '',
        t.kode_tugas, t.tujuan_akhir, formatWaktu(t.sampai_pada)
      ]);
      const csv = [header, ...baris].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `cutting-selesai-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    onMounted(async () => { await window.authReady; await muat(); });

    return { memuat, daftarUrut, selesaiHariIni, kataKunci, dariTanggal, sampaiTanggal, unduhCsv, formatQty, formatWaktu };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div class="gc-card" style="padding:12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <div style="font-size:12px; color:var(--text-faint);">Selesai hari ini</div>
        <div class="gc-num" style="font-weight:700; font-size:16px;">{{ selesaiHariIni.length }}</div>
      </div>
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <input v-model="kataKunci" type="text" placeholder="Cari kode SPK / produk..." style="flex:2; min-width:160px; padding:8px; border-radius:10px; border:1px solid var(--border-soft);">
        <input v-model="dariTanggal" type="date" style="flex:1; min-width:130px; padding:8px; border-radius:10px; border:1px solid var(--border-soft);">
        <input v-model="sampaiTanggal" type="date" style="flex:1; min-width:130px; padding:8px; border-radius:10px; border:1px solid var(--border-soft);">
        <button @click="unduhCsv" class="btn-outline" style="padding:8px 14px; font-size:11.5px;"><i class="fas fa-download" style="margin-right:6px;"></i>Unduh CSV</button>
      </div>

      <div v-if="daftarUrut.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-circle-check"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada riwayat Selesai</h3>
        <p style="font-size:11px; color:var(--text-faint); margin-top:6px;">Tab ini terisi otomatis begitu modul Serie (belum dibangun) menulis balik status selesai ke sini — bukan error.</p>
      </div>
      <div v-else class="gc-card" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead><tr style="text-align:left; border-bottom:1px solid var(--border-soft);">
            <th style="padding:6px 8px;">Kode SPK</th><th style="padding:6px 8px;">Produk</th><th style="padding:6px 8px;">Qty</th>
            <th style="padding:6px 8px;">Op. Ampar</th><th style="padding:6px 8px;">Op. Pola</th><th style="padding:6px 8px;">Op. Cutting</th>
            <th style="padding:6px 8px;">Tujuan</th><th style="padding:6px 8px;">Selesai</th>
          </tr></thead>
          <tbody>
            <tr v-for="t in daftarUrut" :key="t.id" style="border-bottom:1px solid var(--border-soft);">
              <td style="padding:6px 8px;" class="gc-num" style="font-weight:700;">{{ t.kode_spk }}</td>
              <td style="padding:6px 8px;">{{ t.nama_produk }} {{ t.size }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatQty(t.qty_total) }}</td>
              <td style="padding:6px 8px;">{{ (t.op_ampar && t.op_ampar.nama) || '-' }}</td>
              <td style="padding:6px 8px;">{{ (t.op_pola && t.op_pola.nama) || '-' }}</td>
              <td style="padding:6px 8px;">{{ (t.op_cutting && t.op_cutting.nama) || '-' }}</td>
              <td style="padding:6px 8px;">{{ t.tujuan_akhir || '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatWaktu(t.sampai_pada) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  `
};

// --- Mount ke index.html — LAZY, SAMA pola seperti pos Persiapan Produksi
// lain: fungsi window.pastikanMountCuttingXxx() dipanggil oleh pindahSubTab()
// (js/dashboard.js, peta petaMount) PERTAMA KALI tab itu dibuka. ------------
let vmCuttingPerluDiProses = null;
window.pastikanMountCuttingPerluDiProses = function () {
  if (vmCuttingPerluDiProses) return;
  const mountPoint = document.getElementById('vue-cutting-perludiproses');
  if (mountPoint) vmCuttingPerluDiProses = createApp(CuttingPerluDiProses).mount('#vue-cutting-perludiproses');
};
let vmCuttingSedangAmpar = null;
window.pastikanMountCuttingSedangAmpar = function () {
  if (vmCuttingSedangAmpar) return;
  const mountPoint = document.getElementById('vue-cutting-sedangampar');
  if (mountPoint) vmCuttingSedangAmpar = createApp(CuttingSedangAmpar).mount('#vue-cutting-sedangampar');
};
let vmCuttingSedangPola = null;
window.pastikanMountCuttingSedangPola = function () {
  if (vmCuttingSedangPola) return;
  const mountPoint = document.getElementById('vue-cutting-sedangpola');
  if (mountPoint) vmCuttingSedangPola = createApp(CuttingSedangPola).mount('#vue-cutting-sedangpola');
};
let vmCuttingSedangCutting = null;
window.pastikanMountCuttingSedangCutting = function () {
  if (vmCuttingSedangCutting) return;
  const mountPoint = document.getElementById('vue-cutting-sedangcutting');
  if (mountPoint) vmCuttingSedangCutting = createApp(CuttingSedangCutting).mount('#vue-cutting-sedangcutting');
};
let vmCuttingPerluDiKirim = null;
window.pastikanMountCuttingPerluDiKirim = function () {
  if (vmCuttingPerluDiKirim) return;
  const mountPoint = document.getElementById('vue-cutting-perludikirim');
  if (mountPoint) vmCuttingPerluDiKirim = createApp(CuttingPerluDiKirim).mount('#vue-cutting-perludikirim');
};
let vmCuttingSedangDiKirim = null;
window.pastikanMountCuttingSedangDiKirim = function () {
  if (vmCuttingSedangDiKirim) return;
  const mountPoint = document.getElementById('vue-cutting-sedangdikirim');
  if (mountPoint) vmCuttingSedangDiKirim = createApp(CuttingSedangDiKirim).mount('#vue-cutting-sedangdikirim');
};
let vmCuttingSelesai = null;
window.pastikanMountCuttingSelesai = function () {
  if (vmCuttingSelesai) return;
  const mountPoint = document.getElementById('vue-cutting-selesai');
  if (mountPoint) vmCuttingSelesai = createApp(CuttingSelesai).mount('#vue-cutting-selesai');
};
