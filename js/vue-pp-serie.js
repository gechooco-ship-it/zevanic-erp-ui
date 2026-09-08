// js/vue-pp-serie.js
// ============================================================================
// Proses Produksi > Serie — menu BARU (7 Sep 2026 malam lanjut lagi, "lanjut
// lagi" setelah Cutting selesai), wireframe handoff "03 - Proses Produksi /
// 02 - Serie", dikerjakan via /design-terapkan-handoff. Instruksi Guru
// singkat ("lanjut lagi") — dilanjutkan sendiri ke folder handoff BERIKUTNYA
// per urutan penomoran folder (01-Cutting sudah selesai, 02-Serie berikutnya,
// BUKAN 03-Sewing/04-Finishing — folder Mockup/handoff/03 - Proses Produksi/
// diberi angka 01/02/03/04/05 = Cutting/Serie/Sewing/Finishing/Gudang Barang
// Jadi, urutan folder ini yang diikuti, bukan urutan §9.3 RENCANA lama yang
// sempat menyebut "Cutting -> Sewing -> Finishing -> Serie -> Gudang" — folder
// asli menaruh Serie di posisi ke-2, dan itu MASUK AKAL secara arsitektur:
// Serie = hub distribusi yang WAJIB ada sebelum Sewing/Finishing/Gudang bisa
// menerima apapun dari Cutting/Acc, jadi urutan folder inilah yang benar
// diikuti, bukan urutan §9.3 (dicatat sebagai koreksi urutan rencana, bukan
// penyimpangan tanpa alasan).
//
// ARSITEKTUR — PENTING, baca dulu sebelum ubah apapun di sini:
//
// Serie = HUB DISTRIBUSI, bukan pos kerja biasa. Semua perpindahan antar
// divisi (Cutting <-> Sewing <-> Finishing <-> Gudang) SELALU lewat Serie
// (PEDOMAN-SERAH-TERIMA.md aturan #11) — tidak ada jalur langsung. Serie
// MENERIMA dari 2 arah sekaligus (Cutting untuk komponen kain/pola, DAN
// langsung dari 3 pos Acc Persiapan Produksi -- Sewing/Webbing/Finishing --
// untuk komponen aksesoris, karena aksesoris tidak perlu dipotong), gabungkan
// jadi "batch separating" per produk, lalu estafet ke Sewing -> Finishing ->
// Gudang Barang Jadi (2 pos terakhir ini DAN Sewing BELUM DIBANGUN, lihat GAP
// DISENGAJA di bawah).
//
// Koleksi BARU (sesuai SERAH-TERIMA.md bagian 5 "Database > Perlu ditambah" —
// HANYA ini 2, TIDAK ada koleksi label terpisah seperti label_komponen di
// Cutting, lihat keputusan #4 di bawah):
//   separating_batch — 1 dokumen per batch hasil Generate Separating. Field:
//     kode_batch, spk_groupings[] (SPK Grouping sumber, bisa >1 kalau
//     bahan+warna+size sama digabung), nama_produk, size, qty, status (11
//     nilai: perlu_diproses -> sedang_diproses -> perlu_dikirim ->
//     kirim_sewing -> setor_sewing -> terima_sewing -> kirim_finishing ->
//     setor_finishing -> terima_finishing -> kirim_gudang -> selesai),
//     operator_uid/nama/riwayat[], komponen_rincian[] ({id_komponen, sumber,
//     nama_komponen, qty_setor, qty_per_pcs, satuan, status, entry_oleh,
//     entry_pada}), kode_bagging[], kode_tugas, tlc_tujuan, unpack_log[],
//     catatan_masalah, masuk_tahap_pada, sampai_pada (BELUM ADA PENULIS,
//     lihat GAP DISENGAJA), dibuat_pada/diperbarui_pada.
//   pengaturan_id_separating/{yymmdd} — counter harian, {counter,
//     dibuat_pada} — pola SAMA seperti pengaturan_id_bagging/tugas_kirim.
//
// KEPUTUSAN ARSITEKTUR (judgment call, DIDOKUMENTASIKAN karena SERAH-TERIMA
// tidak menjawab eksplisit atau baru jelas setelah baca wireframe.dc.html —
// lihat STATUS-PROYEK.md untuk versi lengkapnya):
//
// 1. TAB 2.1 "Perlu Di Proses" adalah PENUTUP EMPAT GAP SEKALIGUS yang
//    sengaja ditinggalkan modul-modul sebelumnya:
//      - Scan Sampai kode_bagging yang match `cutting_track.kode_bagging[]`
//        (array-contains) -> tulis cutting_track.status='selesai' +
//        sampai_pada=sekarang. INI MENUTUP GAP DISENGAJA Cutting (dicatat di
//        header js/vue-pp-cutting.js poin 6: "cutting_track.sampai_pada
//        BELUM ADA PENULIS -- itu tugas modul SERIE").
//      - Scan Sampai kode_bagging yang match salah satu baris
//        `spk_track.<sewing|webbing|finishing>_rincian[].kode_bagging` ->
//        tulis sampai_pada=sekarang di baris itu. INI MENUTUP GAP yang SAMA
//        di 3 pos Acc (field itu "TETAP BELUM PUNYA PENULIS" per catatan di
//        js/vue-pp-cutting.js poin 2 -- SEKARANG akhirnya ditutup di sini).
//    Pencarian dilakukan BERURUTAN (cutting_track dulu, baru 3 jalur Acc)
//    karena kode_bagging dijamin unik lintas pos (semua pos generate lewat
//    generateKodeHarian('BAG', 'pengaturan_id_bagging') yang SAMA).
// 2. Status KOMPLIT/INKOMPLIT per sumber (badge di kartu SPK) DIHITUNG LIVE,
//    BUKAN field tersimpan -- sama filosofi seperti progresLabel() di
//    Cutting. Cutting-sumber KOMPLIT kalau cutting_track.status==='selesai';
//    Acc-sumber KOMPLIT kalau SEMUA baris <jalur>_rincian milik SPK itu sudah
//    py sampai_pada. Sumber yang TIDAK ada di spk_grouping.jalur_aktif[]
//    tidak ditampilkan sama sekali (bukan INKOMPLIT -- memang tidak relevan
//    buat SPK itu, mis. produk tanpa Acc Webbing).
// 3. Scan Unpack HANYA diimplementasikan untuk barang dari Cutting (reuse
//    field cutting_track.unpack_log yang SUDAH ADA sejak modul Cutting --
//    dipakai DUA KALI oleh 2 pos berbeda: Cutting sendiri untuk unpack
//    kiriman dari Bahan, Serie di sini untuk unpack kiriman dari Cutting,
//    field yang sama generik "log unpack di titik manapun dokumen itu
//    diterima"). Barang dari 3 pos Acc TIDAK punya field unpack_log di
//    skema spk_track (SERAH-TERIMA Serie tidak merinci unpack per-sumber
//    berbeda) -- untuk Acc, Scan Sampai saja dianggap cukup, TIDAK ada
//    langkah Unpack terpisah. Kalau Guru menghendaki Unpack juga untuk Acc,
//    perlu keputusan skema tambahan (field baru di spk_track).
// 4. TIDAK ADA koleksi label terpisah untuk "ID Komponen" (beda dari Cutting
//    yang punya koleksi label_komponen sendiri) -- dicek ulang ke SERAH-
//    TERIMA.md bagian 5 "Database > Perlu ditambah", HANYA separating_batch +
//    pengaturan_id_separating yang disebutkan. `id_komponen` dihitung
//    DETERMINISTIK dari `${kode_batch}-${urutan 2 digit}`, disimpan sebagai
//    field di dalam `komponen_rincian[]` (bukan dokumen terpisah) -- Scan
//    Entry (2.2) mencocokkan kode yang discan ke id_komponen di array itu,
//    lalu update statusnya lewat read-modify-write (updateSeparatingBatch(),
//    pola sama seperti updateCuttingTrack()/updateBarisBahan()).
// 5. komponen_rincian SEBUAH BATCH digabung dari 4 kemungkinan SUMBER
//    (bahan/cutting, sewing, webbing, finishing) -- field `sumber` per baris
//    menandai asalnya. Diisi SEKALI saat Generate Separating (2.1a) dari:
//    cutting_track.komponen_rincian[] (match grouping via grouping_id) dan
//    spk_track.<jalur>_rincian[] (match grouping via cocokkan no_spk anggota
//    spk_grouping.breakdown[]) untuk tiap SPK Grouping yang dicentang. Qty
//    per baris komponen di-PRORATA sesuai porsi qty batch ini terhadap total
//    qty SPK Grouping asal (qty_setor = qty_komponen_asal * (qty_batch_ini /
//    qty_total_grouping_asal)) -- INI JUDGMENT CALL karena SERAH-TERIMA tidak
//    merinci rumus prorata saat 1 grouping dipecah ke banyak batch, cuma
//    contoh angka bulat (180 -> 4x25 pas habis dibagi rata per contoh
//    wireframe, TIDAK ada contoh SISA/pecahan) -- dibulatkan ke atas
//    (Math.ceil) supaya tidak kurang.
// 6. Validasi Generate Separating (2.1a): `jumlah_batch x isi_pcs_per_bundle`
//    WAJIB PERSIS SAMA DENGAN total qty SPK yang dicentang (keras, diblokir
//    kalau tidak sama -- ini satu-satunya validasi keras yang eksplisit dari
//    contoh wireframe 4x25=100). Validasi `isi_pcs_per_bundle` terhadap
//    `master_produk.moq_serie`/`kelipatan_isi_pola` HANYA PERINGATAN (bukan
//    blokir) -- rumus pastinya ("gendongan 2 komponen kiri+kanan, MOQ 25 ->
//    perlu 50 pcs gendongan") tidak sepenuhnya jelas dari teks SERAH-TERIMA,
//    jadi tidak dipaksakan jadi validasi keras yang bisa salah blokir kerja
//    Guru. Pengelompokan SPK yang "bahan+warna+size sama" boleh dicentang
//    bareng HANYA dicocokkan dari `nama_produk`+`size` (2 field native
//    spk_grouping) -- kecocokan WARNA butuh resolve lewat sku_produk_terlibat
//    ke master_produk yang lebih mahal & spk_grouping.nama_produk sendiri
//    SUDAH tidak menyertakan warna (per PETA-DATABASE.md) -- disederhanakan,
//    admin tetap yang pilih centang secara manual, sistem cuma menyaring
//    daftar per nama_produk+size supaya tidak tercampur produk yang jelas
//    beda.
// 7. `kode_batch` = `${kode_spk_grouping_pertama_yang_dicentang}-5${counter 3
//    digit}` -- counter dari `pengaturan_id_separating/{yymmdd}` (GLOBAL per
//    hari, BUKAN per-transaksi-generate seperti terkesan di contoh wireframe
//    5001/5002/5003/5004 yang look like nomor lokal per klik) -- dipilih
//    counter GLOBAL supaya kode_batch DIJAMIN tidak pernah tabrakan meski ada
//    2 Generate Separating berbeda di hari yang sama, sesuai prinsip "kode
//    yang diterbitkan tidak pernah dipakai dua kali dalam satu hari"
//    (PEDOMAN-SERAH-TERIMA.md, "Cara menilai hasilnya sudah benar" #4).
// 8. Tab 2.5 "Setor Sewing" & 2.8 "Setor Finishing" (read-only) membaca
//    koleksi `sewing_track`/`finishing_track` -- koleksi ini BUKAN ditulis
//    modul ini (scope Serie TIDAK termasuk Sewing/Finishing, SERAH-TERIMA
//    bagian 4 "Tidak masuk"), TAPI skemanya SUDAH didokumentasikan di
//    wireframe.dc.html milik Serie sendiri (catatan developer lintas-modul,
//    field: batch_id/kode_batch/nama_produk/qty/status/operator_uid/nama/
//    entry_pada/kode_bagging[]/kode_tugas/tujuan untuk sewing_track; kode_pcs/
//    batch_id/nama_produk/size/warna/tahap_aktif/progress/op_qc dst/status/
//    kode_bagging/kode_tugas untuk finishing_track) -- BUKAN skema yang
//    ditebak sendiri di sini, disalin dari dokumen desain yang sama.
//    Modul ini HANYA BACA (getDocs biasa), TIDAK PERNAH menulis ke 2 koleksi
//    itu. Tab-tab ini akan TAMPIL KOSONG sampai modul Sewing/Finishing
//    (Proses Produksi, belum dibangun) mulai menulis dokumennya -- BUKAN
//    bug, EKSPEKTASI (sama pola seperti tab Setor/Selesai yang menunggu
//    modul lain, lihat GAP DISENGAJA di bawah).
// 9. Tab 2.6 "Terima Sewing" & 2.9 "Terima Finishing": Scan Sampai mencari
//    dokumen `sewing_track`/`finishing_track` dengan `kode_tugas` yang cocok,
//    menulis `status:'selesai'` di dokumen itu (menutup "Sedang Dikirim" di
//    pos pengirim, PERSIS seperti disebutkan SERAH-TERIMA §3 "Terima balik:
//    scan sampai dari Sewing/Finishing. Menutup 'Sedang Kirim' di divisi
//    pengirim -> 'Selesai'"), LALU mengangkat status `separating_batch`
//    terkait (match lewat `kode_batch`) ke 'terima_sewing'/'terima_finishing'.
//    Sampai modul Sewing/Finishing benar-benar ada & menulis kode_tugas
//    miliknya sendiri, scan di sini TIDAK akan menemukan apapun (gap yang
//    sama seperti poin 8).
// 10. Peran: Admin bisa cetak+scan (kecuali scan operator); PIC/PIC
//    Owner/Owner/Superuser SATU-SATUNYA yang bisa scan operator -- pola
//    IDENTIK Cutting, reuse picOwnerKeAtas() (disalin, bukan diimpor, sama
//    konvensi semua file pos ini).
// 11. TLC: `TLC-SER` (asal Serie sendiri) dan `TLC-JHT`/`TLC-FIN`/`TLC-GBJ`
//    (tujuan Kirim Sewing/Finishing/Gudang) dipakai sebagai KONSTANTA LITERAL
//    (sama pola Cutting yang pakai 'TLC-PTG' literal, TIDAK di-seed otomatis
//    ke master_tlc) -- kalau kode-kode ini belum ada di Zevanic House > TLC &
//    Prefix, Guru WAJIB menambahkannya manual dulu sebelum cetak kode tugas
//    di modul ini bisa dipakai (sama seperti TLC-PTG untuk Cutting).
//
// GAP DISENGAJA (bukan bug, BUKAN yang pertama di app ini -- pola berulang):
// - `separating_batch.sampai_pada` (penanda Tab 2.11 Selesai) BELUM PUNYA
//   PENULIS -- tugas modul Gudang Barang Jadi (di luar cakupan SERAH-TERIMA
//   Serie), akan menulis balik status='selesai' begitu ia Scan Sampai dari
//   Kirim Gudang (2.10) -- PERSIS pola yang sama seperti Serie menutup gap
//   Cutting hari ini. Tab 2.11 TAMPIL KOSONG sampai Gudang dibangun.
// - Tab 2.5/2.8 (Setor Sewing/Finishing) TAMPIL KOSONG sampai modul Sewing/
//   Finishing (Proses Produksi) ada dan menulis `sewing_track`/
//   `finishing_track` (lihat poin 8 di atas).
// - Tab 2.6/2.9 (Terima Sewing/Finishing) TIDAK akan menemukan apapun untuk
//   di-scan sampai modul Sewing/Finishing bisa mengirim balik dengan
//   kode_tugas sendiri (lihat poin 9 di atas).
//
// Print label & scan QR: PAKAI ULANG PopupPratinjauCetakLabel & ScanGenerik
// (js/vue-components.js, js/vue-scan-cetak.js) -- TIDAK ada komponen visual
// baru ditulis di sini, konsisten dengan seluruh app & dengan Cutting.
// ============================================================================

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel } from './vue-components.js?v=5';
import { ScanGenerik, PopupPinGenerik, buatQrDataUrl, ajukanPersiapanMasalah } from './vue-scan-cetak.js?v=2';

// --- Format & hitung kecil (disalin pola dari Cutting/4 pos Persiapan
// Produksi, belum ada infrastruktur util generik lintas file). -------------
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
    return counterBaru;
  });
}
// generateKodeHarianFormat — VERSI KEDUA, mengembalikan STRING TERFORMAT
// penuh (`${prefix}${tanggalKey}-${counter 3 digit}`), sama persis dengan
// generateKodeHarian() versi Cutting yang ASLI. Ditambahkan terpisah karena
// generateKodeHarian() di file INI sudah diubah (keputusan #7 di komentar
// besar atas file) untuk mengembalikan angka counter MENTAH saja (dipakai
// khusus membentuk kode_batch custom `${kodeSpk}-5${counter}`). Fungsi kedua
// ini dipakai di tab 2.3/2.4/2.7/2.10 untuk kode bagging & kode tugas yang
// TETAP harus berformat standar app (BAG.../TGS...), sama seperti Cutting &
// pos Persiapan lain, supaya lintas modul konsisten dan gampang dibaca scan.
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
const TLC_ASAL_SERIE = 'TLC-SER';
const TLC_TUJUAN_SEWING = 'TLC-JHT';
const TLC_TUJUAN_FINISHING = 'TLC-FIN';
const TLC_TUJUAN_GUDANG = 'TLC-GBJ';
const JALUR_ACC = ['sewing', 'webbing', 'finishing'];

// --- Baca koleksi mentah ----------------------------------------------------
async function muatSemuaGrouping() {
  const snap = await getDocs(collection(db, 'spk_grouping'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function muatSemuaCuttingTrack() {
  const snap = await getDocs(collection(db, 'cutting_track'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function muatSpkTrackJalur(jalur) {
  const snap = await getDocs(query(collection(db, 'spk_track'), where('jalur', '==', jalur)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function muatSemuaSeparatingBatch() {
  const snap = await getDocs(collection(db, 'separating_batch'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function muatSemuaSewingTrack() {
  try { const snap = await getDocs(collection(db, 'sewing_track')); return snap.docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (e) { return []; } // koleksi mungkin belum ada rule-nya / belum ada dokumen — jangan sampai layar error
}
async function muatSemuaFinishingTrack() {
  try { const snap = await getDocs(collection(db, 'finishing_track')); return snap.docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (e) { return []; }
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
// updateSeparatingBatch — read-modify-write ATOMIK, pola sama seperti
// updateCuttingTrack()/updateBarisBahan() di modul lain.
async function updateSeparatingBatch(batchId, mutator) {
  const ref = doc(db, 'separating_batch', batchId);
  await runTransaction(db, async (trx) => {
    const snap = await trx.get(ref);
    if (!snap.exists()) throw new Error('Dokumen separating_batch tidak ditemukan.');
    const data = snap.data();
    const patch = mutator(data) || {};
    trx.update(ref, { ...patch, diperbarui_pada: serverTimestamp() });
  });
}

// --- Keputusan #2: KOMPLIT/INKOMPLIT per sumber, dihitung LIVE --------------
function statusSumberGrouping(grouping, cuttingList, spkTrackByJalur) {
  const hasil = {};
  const jalurAktif = Array.isArray(grouping.jalur_aktif) ? grouping.jalur_aktif : [];
  if (jalurAktif.includes('bahan')) {
    const ct = cuttingList.find(c => c.grouping_id === grouping.id);
    hasil.cutting = { ada: true, komplit: !!ct && ct.status === 'selesai', ref: ct || null };
  }
  JALUR_ACC.forEach(jalur => {
    if (!jalurAktif.includes(jalur)) return;
    const noSpkAnggota = (grouping.breakdown || []).map(b => b.no_spk);
    const tracks = (spkTrackByJalur[jalur] || []).filter(t => t.grouping_id === grouping.id);
    const semuaBaris = [];
    tracks.forEach(t => { (t[jalur + '_rincian'] || []).forEach(b => semuaBaris.push(b)); });
    const komplit = semuaBaris.length > 0 && semuaBaris.every(b => !!b.sampai_pada);
    hasil[jalur] = { ada: true, komplit, jumlahBaris: semuaBaris.length };
  });
  return hasil;
}
function semuaSumberKomplit(sumberMap) {
  const keys = Object.keys(sumberMap);
  if (!keys.length) return false;
  return keys.every(k => sumberMap[k].komplit);
}

// --- Keputusan #5: kumpulkan komponen_rincian dari 4 sumber untuk 1/lebih
// SPK Grouping yang dicentang, PRORATA ke qty batch ini. ---------------------
function kumpulkanKomponenUntukBatch(groupingIds, cuttingList, spkTrackByJalur, qtyBatch, qtyTotalDicentang) {
  const rasio = qtyTotalDicentang > 0 ? (qtyBatch / qtyTotalDicentang) : 0;
  const hasil = [];
  groupingIds.forEach(gid => {
    const ct = cuttingList.find(c => c.grouping_id === gid);
    (ct?.komponen_rincian || []).forEach(k => {
      hasil.push({ sumber: 'bahan', nama_komponen: k.nama_komponen, qty_per_pcs: k.qty_per_pola || 0, qty_setor: Math.ceil((k.jumlah_label || 0) * rasio), satuan: 'PCS' });
    });
    JALUR_ACC.forEach(jalur => {
      const tracks = (spkTrackByJalur[jalur] || []).filter(t => t.grouping_id === gid);
      tracks.forEach(t => {
        (t[jalur + '_rincian'] || []).forEach(b => {
          hasil.push({ sumber: jalur, nama_komponen: b.bahan_nama || '(tanpa nama)', qty_per_pcs: 1, qty_setor: Math.ceil((parseFloat(b.qty) || 0) * rasio), satuan: b.satuan || 'PCS' });
        });
      });
    });
  });
  return hasil;
}

// Popup Scan Masalah generik (jumlah kurang + alasan) — disalin pola sama
// seperti Cutting (popupMasalahMixin), sumberJalur:'serie'.
function popupMasalahMixin(kirimFn) {
  const popupMasalah = ref(null);
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
async function kirimMasalahSerie(batch, jumlah, alasan) {
  await ajukanPersiapanMasalah({
    tlcAsal: TLC_ASAL_SERIE, sumberJalur: 'serie',
    trackId: batch.id, noSpk: batch.kode_batch,
    bahanNama: batch.nama_produk, bahanWarna: batch.size, satuan: 'pcs',
    qtyKurang: jumlah, alasan
  });
}

// ============================================================================
// TAB 2.1: Perlu Di Proses + Pop up 2.1a Generate Separating
// ============================================================================
const SeriePerluDiProses = {
  components: { ScanGenerik, PopupPinGenerik, PopupPratinjauCetakLabel },
  setup() {
    const memuat = ref(true);
    const daftarGrouping = ref([]);
    const cuttingList = ref([]);
    const spkTrackByJalur = reactive({ sewing: [], webbing: [], finishing: [] });
    const separatingList = ref([]);
    const menuId = 'proses_serie';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehOperator = computed(() => picOwnerKeAtas(window.currentUser));

    const sudahDipisahkanIds = computed(() => {
      const set = new Set();
      separatingList.value.forEach(b => (b.spk_groupings || []).forEach(gid => set.add(gid)));
      return set;
    });

    async function muat() {
      memuat.value = true;
      try {
        const [grouping, ct, sew, web, fin, sep] = await Promise.all([
          muatSemuaGrouping(), muatSemuaCuttingTrack(),
          muatSpkTrackJalur('sewing'), muatSpkTrackJalur('webbing'), muatSpkTrackJalur('finishing'),
          muatSemuaSeparatingBatch()
        ]);
        cuttingList.value = ct;
        spkTrackByJalur.sewing = sew; spkTrackByJalur.webbing = web; spkTrackByJalur.finishing = fin;
        separatingList.value = sep;
        daftarGrouping.value = grouping.filter(g => !sudahDipisahkanIds.value.has(g.id) && (g.jalur_aktif || []).some(j => j === 'bahan' || JALUR_ACC.includes(j)));
      } catch (e) { console.error('Gagal muat Serie > Perlu Di Proses:', e); daftarGrouping.value = []; }
      memuat.value = false;
    }
    function sumber(g) { return statusSumberGrouping(g, cuttingList.value, spkTrackByJalur); }
    function bisaGenerate(g) { return semuaSumberKomplit(sumber(g)); }

    // --- Scan Sampai: cari cocok di cutting_track ATAU spk_track 3 jalur Acc,
    // MENUTUP GAP #1 (lihat komentar besar atas file). ------------------------
    const modalSampai = reactive({ aktif: false, log: [] });
    function bukaScanSampai() { modalSampai.log = []; modalSampai.aktif = true; }
    function tutupScanSampai() { modalSampai.aktif = false; modalSampai.log = []; muat(); }
    async function hasilScanSampai(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      const now = new Date().toISOString();
      try {
        // 1) coba cutting_track (array-contains kode_bagging)
        const snapCt = await getDocs(query(collection(db, 'cutting_track'), where('kode_bagging', 'array-contains', kode)));
        if (!snapCt.empty) {
          const d = snapCt.docs[0];
          if (d.data().status === 'selesai') { alert(`Bagging "${kode}" sudah pernah di-Scan Sampai sebelumnya.`); return; }
          await updateDoc(doc(db, 'cutting_track', d.id), { status: 'selesai', sampai_pada: now, diperbarui_pada: serverTimestamp() });
          modalSampai.log.unshift(kode + ' -> Cutting selesai');
          await muat();
          return;
        }
        // 2) coba 3 jalur Acc
        for (const jalur of JALUR_ACC) {
          const snapTrack = await getDocs(query(collection(db, 'spk_track'), where('jalur', '==', jalur)));
          let kena = false;
          for (const d of snapTrack.docs) {
            const data = d.data();
            const key = jalur + '_rincian';
            const baris = Array.isArray(data[key]) ? data[key] : [];
            const idx = baris.findIndex(b => b.kode_bagging === kode && !b.sampai_pada);
            if (idx < 0) continue;
            const barisBaru = baris.slice();
            barisBaru[idx] = { ...barisBaru[idx], sampai_pada: now };
            await updateDoc(doc(db, 'spk_track', d.id), { [key]: barisBaru });
            kena = true;
          }
          if (kena) { modalSampai.log.unshift(kode + ' -> Acc ' + jalur + ' selesai'); await muat(); return; }
        }
        alert(`Kode bagging "${kode}" tidak ditemukan / sudah pernah di-Scan Sampai di Cutting maupun 3 pos Acc.`);
      } catch (e) { console.error('Gagal scan sampai Serie:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    // --- Scan Unpack: HANYA untuk barang dari Cutting (reuse unpack_log,
    // lihat keputusan #3). ----------------------------------------------------
    const modalUnpack = reactive({ aktif: false });
    const popupUnpack = ref(null);
    function bukaScanUnpack() { modalUnpack.aktif = true; }
    function tutupScanUnpack() { modalUnpack.aktif = false; }
    function hasilScanUnpack(kodeMentah) {
      popupUnpack.value = { kodeBagging: (kodeMentah || '').trim(), hasil: 'komplit' };
    }
    async function konfirmasiUnpack() {
      const p = popupUnpack.value;
      if (!p) return;
      try {
        const snapCt = await getDocs(query(collection(db, 'cutting_track'), where('kode_bagging', 'array-contains', p.kodeBagging)));
        if (snapCt.empty) { alert(`Kode bagging "${p.kodeBagging}" tidak ditemukan di Cutting (Unpack hanya berlaku untuk kiriman dari Cutting, lihat catatan modul).`); popupUnpack.value = null; return; }
        await updateCuttingTrackLangsung(snapCt.docs[0].id, p.kodeBagging, p.hasil);
        popupUnpack.value = null;
        await muat();
      } catch (e) { console.error('Gagal simpan unpack Serie:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }
    async function updateCuttingTrackLangsung(id, kodeBagging, hasil) {
      await updateDoc(doc(db, 'cutting_track', id), { unpack_log: arrayUnion({ kode_bagging: kodeBagging, status: hasil, pada: new Date().toISOString(), oleh: 'Serie' }) });
    }

    // --- Tunjuk Operator Ampar (SESUNGGUHNYA "Scan Operator" generate
    // separating -- lihat popup 2.1a untuk aksi penuh). Popup Generate
    // Separating (2.1a). ------------------------------------------------------
    const popupGenerate = ref(null); // { calon:[grouping...], centang:{}, jumlahBatch, isiPcsPerBundle }
    function bukaGenerate(gAwal) {
      const calon = daftarGrouping.value.filter(g => g.nama_produk === gAwal.nama_produk && g.size === gAwal.size && bisaGenerate(g));
      const centang = {}; calon.forEach(g => { centang[g.id] = (g.id === gAwal.id); });
      popupGenerate.value = { calon, centang, jumlahBatch: 1, isiPcsPerBundle: 0 };
    }
    function batalGenerate() { popupGenerate.value = null; }
    const totalQtyCentang = computed(() => {
      const p = popupGenerate.value; if (!p) return 0;
      return p.calon.filter(g => p.centang[g.id]).reduce((s, g) => s + (parseFloat(g.qty_total) || 0), 0);
    });
    const sedangGenerate = ref(false);
    async function konfirmasiGenerate() {
      const p = popupGenerate.value;
      if (!p) return;
      const dipilih = p.calon.filter(g => p.centang[g.id]);
      if (!dipilih.length) { alert('Pilih minimal 1 SPK Grouping.'); return; }
      const jumlahBatch = parseInt(p.jumlahBatch) || 0;
      const isiPcs = parseFloat(p.isiPcsPerBundle) || 0;
      if (jumlahBatch <= 0 || isiPcs <= 0) { alert('Jumlah batch dan isi pcs per bundle wajib diisi (>0).'); return; }
      if (jumlahBatch * isiPcs !== totalQtyCentang.value) {
        alert(`Jumlah batch × isi pcs per bundle (${jumlahBatch} × ${isiPcs} = ${jumlahBatch * isiPcs}) harus PERSIS SAMA dengan total qty SPK yang dicentang (${totalQtyCentang.value}).`);
        return;
      }
      const petaProduk = await ambilPetaProdukBySku();
      const skuContoh = (dipilih[0].sku_produk_terlibat || [])[0];
      const produk = skuContoh ? petaProduk[skuContoh] : null;
      if (produk) {
        const moq = parseFloat(produk.moq_serie) || 0;
        const kelipatan = parseFloat(produk.kelipatan_isi_pola) || 0;
        if (moq > 0 && isiPcs < moq) { if (!confirm(`Isi pcs per bundle (${isiPcs}) di bawah MOQ Serie produk ini (${moq}). Lanjut?`)) return; }
        if (kelipatan > 0 && isiPcs % kelipatan !== 0) { if (!confirm(`Isi pcs per bundle (${isiPcs}) bukan kelipatan dari "Kelipatan Isi Pola" produk ini (${kelipatan}). Lanjut?`)) return; }
      }
      sedangGenerate.value = true;
      try {
        const groupingIds = dipilih.map(g => g.id);
        const preview = [];
        for (let i = 0; i < jumlahBatch; i++) {
          const counter = await generateKodeHarian('', 'pengaturan_id_separating');
          const kodeBatch = `${dipilih[0].kode_spk}-5${String(counter).padStart(3, '0')}`;
          const komponen = kumpulkanKomponenUntukBatch(groupingIds, cuttingList.value, spkTrackByJalur, isiPcs, totalQtyCentang.value)
            .map((k, idx) => ({ ...k, id_komponen: `${kodeBatch}-${String(idx + 1).padStart(2, '0')}`, status: 'belum', entry_oleh: '', entry_pada: null, label_dicetak_pada: null }));
          await addDoc(collection(db, 'separating_batch'), {
            kode_batch: kodeBatch, spk_groupings: groupingIds, nama_produk: dipilih[0].nama_produk, size: dipilih[0].size,
            qty: isiPcs, status: 'perlu_diproses', operator_uid: null, operator_nama: null, riwayat_operator: [],
            komponen_rincian: komponen, kode_bagging: [], kode_tugas: '', tlc_tujuan: '', unpack_log: [], catatan_masalah: '',
            masuk_tahap_pada: new Date().toISOString(), sampai_pada: null,
            dibuat_pada: serverTimestamp(), diperbarui_pada: serverTimestamp()
          });
          preview.push({ kode: kodeBatch, nama: dipilih[0].nama_produk, info: `size ${dipilih[0].size || '-'} · ${formatQty(isiPcs)} pcs`, qrDataUrl: buatQrDataUrl(kodeBatch) });
        }
        popupGenerate.value = null;
        daftarLabelBatch.value = preview;
        popupCetakBatch.value = true;
        await muat();
      } catch (e) { console.error('Gagal Generate Separating:', e); alert('Gagal menyimpan. Coba lagi.'); }
      sedangGenerate.value = false;
    }
    const popupCetakBatch = ref(false);
    const daftarLabelBatch = ref([]);

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahSerie({ id: p.target.id, kode_batch: p.target.kode_spk, nama_produk: p.target.nama_produk, size: p.target.size }, p.jumlah, p.alasan);
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, daftarGrouping, bolehProses, bolehOperator, formatQty, formatDiamSejak, tertahan, sumber, bisaGenerate,
      modalSampai, bukaScanSampai, tutupScanSampai, hasilScanSampai,
      modalUnpack, popupUnpack, bukaScanUnpack, tutupScanUnpack, hasilScanUnpack, konfirmasiUnpack,
      popupGenerate, bukaGenerate, batalGenerate, totalQtyCentang, sedangGenerate, konfirmasiGenerate,
      popupCetakBatch, daftarLabelBatch,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
        <button v-if="bolehProses" @click="bukaScanSampai" class="btn-primary" style="padding:8px 12px; font-size:11.5px;"><i class="fas fa-qrcode" style="margin-right:4px;"></i>Scan Sampai</button>
        <button v-if="bolehProses" @click="bukaScanUnpack" class="btn-outline" style="padding:8px 12px; font-size:11.5px;"><i class="fas fa-box-open" style="margin-right:4px;"></i>Scan Unpack (dari Cutting)</button>
      </div>
      <div v-if="daftarGrouping.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-inbox"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada SPK Grouping yang menunggu di Serie</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="g in daftarGrouping" :key="g.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ g.kode_spk }}</div>
            <span class="tag" :class="bisaGenerate(g) ? 'ok' : 'warn'">{{ bisaGenerate(g) ? 'KOMPLIT' : 'INKOMPLIT' }}</span>
          </div>
          <div style="font-size:12px; color:var(--text-faint); margin-bottom:8px;">{{ g.nama_produk }} &middot; size {{ g.size || '-' }} &middot; qty {{ formatQty(g.qty_total) }}</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
            <span v-for="(v,k) in sumber(g)" :key="k" class="tag" :class="v.komplit ? 'ok' : 'warn'" style="text-transform:capitalize;">{{ k }}: {{ v.komplit ? 'KOMPLIT' : 'INKOMPLIT' }}</span>
          </div>
          <button v-if="bolehProses" :disabled="!bisaGenerate(g)" @click="bukaGenerate(g)" class="btn-primary" style="width:100%; padding:9px; font-size:11.5px;"><i class="fas fa-object-ungroup" style="margin-right:4px;"></i>Generate Separating</button>
          <button v-if="bolehProses" @click="bukaMasalah(g)" class="btn-outline" style="width:100%; margin-top:6px; padding:8px; font-size:11px; color:var(--danger, #b91c1c);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
        </div>
      </div>
    </template>

    <scan-generik :aktif="modalSampai.aktif" judul="Scan Kode Bagging (Sampai)" subjudul="Bisa discan berkali-kali — dicocokkan otomatis ke Cutting atau 3 pos Acc." @hasil="hasilScanSampai" @tutup="tutupScanSampai" />
    <div v-if="modalSampai.aktif && modalSampai.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:280px;">
      <div v-for="(l,i) in modalSampai.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>

    <scan-generik :aktif="modalUnpack.aktif" judul="Scan Unpack (dari Cutting)" subjudul="Scan kode bagging yang datang dari Cutting." @hasil="hasilScanUnpack" @tutup="tutupScanUnpack" />
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

    <div v-if="popupGenerate" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px; overflow:auto;">
      <div class="gc-card" style="max-width:480px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Generate Separating</h3>
        <div style="background:var(--ivory-dim); border-radius:10px; padding:10px; margin-bottom:10px;">
          <div style="font-size:10px; color:var(--text-faint); margin-bottom:6px;">SPK TERPILIH (centang yang bahan+warna+size sama)</div>
          <div v-for="g in popupGenerate.calon" :key="g.id" style="display:flex; align-items:center; gap:8px; padding:4px 0; font-size:11.5px;">
            <input type="checkbox" v-model="popupGenerate.centang[g.id]">
            <span style="flex:1;">{{ g.kode_spk }}</span>
            <span class="gc-num">{{ formatQty(g.qty_total) }}</span>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:12px;"><span>Total qty gabungan</span><b class="gc-num">{{ formatQty(totalQtyCentang) }} PCS</b></div>
        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <div class="gc-field" style="flex:1;"><label>Jumlah Batch</label><input v-model.number="popupGenerate.jumlahBatch" type="number" min="1"></div>
          <div class="gc-field" style="flex:1;"><label>Isi Pcs per Bundle</label><input v-model.number="popupGenerate.isiPcsPerBundle" type="number" min="1"></div>
        </div>
        <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:12px;">Jumlah batch &times; isi pcs per bundle harus persis sama dengan total qty gabungan.</div>
        <div style="display:flex; gap:8px;">
          <button @click="batalGenerate" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiGenerate" :disabled="sedangGenerate" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-save" style="margin-right:4px;"></i>Simpan + Cetak</button>
        </div>
      </div>
    </div>

    <popup-pratinjau-cetak-label v-if="popupCetakBatch" :terbuka="popupCetakBatch" :daftar-label="daftarLabelBatch" judul="Cetak Batch Separating" jenis-cetak="batch_separating" @tutup="popupCetakBatch = false" />

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.target.kode_spk }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. komponen tidak lengkap"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// TAB 2.2: Sedang Di Proses — batch dikerjakan (cetak ID komponen, scan
// operator, scan entry per komponen, lintas 4 sumber sekaligus)
// ============================================================================
const SerieSedangDiProses = {
  components: { ScanGenerik, PopupPinGenerik, PopupPratinjauCetakLabel },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const ekspand = reactive({});
    const menuId = 'proses_serie';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);
    const bolehOperator = computed(() => picOwnerKeAtas(window.currentUser));

    async function muat() {
      memuat.value = true;
      try { daftar.value = (await muatSemuaSeparatingBatch()).filter(b => b.status === 'sedang_diproses'); }
      catch (e) { console.error('Gagal muat Serie > Sedang Di Proses:', e); daftar.value = []; }
      memuat.value = false;
    }
    function toggleEkspand(id) { ekspand[id] = !ekspand[id]; }
    function perSumber(batch) {
      const peta = {};
      (batch.komponen_rincian || []).forEach(k => { (peta[k.sumber] = peta[k.sumber] || []).push(k); });
      return peta;
    }
    function progres(batch) {
      const total = (batch.komponen_rincian || []).length;
      const selesai = (batch.komponen_rincian || []).filter(k => k.status === 'selesai').length;
      return { done: selesai, total };
    }

    // --- Cetak ID Komponen ---
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    const sedangCetak = ref(false);
    async function cetakIdKomponen(batch) {
      const belum = (batch.komponen_rincian || []).filter(k => !k.label_dicetak_pada);
      if (!belum.length) { alert('Semua komponen batch ini sudah pernah dicetak labelnya.'); return; }
      sedangCetak.value = true;
      try {
        await updateSeparatingBatch(batch.id, (data) => ({
          komponen_rincian: (data.komponen_rincian || []).map(k => belum.some(b => b.id_komponen === k.id_komponen) ? { ...k, label_dicetak_pada: new Date().toISOString() } : k)
        }));
        daftarLabelPreview.value = belum.map(k => ({ kode: k.id_komponen, nama: k.nama_komponen, info: `${batch.kode_batch} &middot; ${batch.nama_produk} size ${batch.size || '-'} &middot; sumber ${k.sumber}`, qrDataUrl: buatQrDataUrl(k.id_komponen) }));
        popupCetakAktif.value = true;
        await muat();
      } catch (e) { console.error('Gagal cetak ID komponen:', e); alert('Gagal mencetak. Coba lagi.'); }
      sedangCetak.value = false;
    }

    // --- Scan Operator (sekali per batch) ---
    const popupPinOperator = ref(null);
    function bukaScanOperator(batch) { popupPinOperator.value = batch; }
    async function pinSuksesOperator(user) {
      const batch = popupPinOperator.value;
      popupPinOperator.value = null;
      try {
        await updateSeparatingBatch(batch.id, (data) => ({
          operator_uid: user.email, operator_nama: user.nama || user.name || user.email,
          riwayat_operator: [...(data.riwayat_operator || []), { uid: user.email, nama: user.nama || user.name || user.email, pada: new Date().toISOString() }]
        }));
        await muat();
      } catch (e) { console.error('Gagal scan operator Serie:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    // --- Scan Entry per komponen ---
    const modalEntry = reactive({ aktif: false, batch: null, log: [] });
    function bukaScanEntry(batch) { modalEntry.batch = batch; modalEntry.log = []; modalEntry.aktif = true; }
    function tutupScanEntry() { modalEntry.aktif = false; modalEntry.batch = null; modalEntry.log = []; muat(); }
    async function hasilScanEntry(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      const batch = modalEntry.batch;
      try {
        const idx = (batch.komponen_rincian || []).findIndex(k => k.id_komponen === kode);
        if (idx < 0) { alert(`ID Komponen "${kode}" tidak ditemukan di batch ini.`); return; }
        if (batch.komponen_rincian[idx].status === 'selesai') { alert(`ID Komponen "${kode}" sudah pernah di-scan entry.`); return; }
        const oleh = window.currentUser?.email || '';
        const now = new Date().toISOString();
        await updateSeparatingBatch(batch.id, (data) => {
          const arr = (data.komponen_rincian || []).map(k => k.id_komponen === kode ? { ...k, status: 'selesai', entry_oleh: oleh, entry_pada: now } : k);
          const semuaSelesai = arr.length > 0 && arr.every(k => k.status === 'selesai');
          return { komponen_rincian: arr, ...(semuaSelesai ? { status: 'perlu_dikirim', masuk_tahap_pada: now } : {}) };
        });
        batch.komponen_rincian = batch.komponen_rincian.map(k => k.id_komponen === kode ? { ...k, status: 'selesai', entry_oleh: oleh, entry_pada: now } : k);
        modalEntry.log.unshift(kode + ' -> selesai');
      } catch (e) { console.error('Gagal scan entry Serie:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahSerie(p.target, p.jumlah, p.alasan);
      await muat();
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, daftar, bolehProses, bolehCetak, bolehOperator, formatQty, formatDiamSejak, tertahan, formatWaktu,
      ekspand, toggleEkspand, perSumber, progres,
      popupCetakAktif, daftarLabelPreview, sedangCetak, cetakIdKomponen,
      popupPinOperator, bukaScanOperator, pinSuksesOperator,
      modalEntry, bukaScanEntry, tutupScanEntry, hasilScanEntry,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div v-if="daftar.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-gears"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada batch yang sedang diproses</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="b in daftar" :key="b.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(b.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ b.kode_batch }}</div>
            <span class="tag" :class="tertahan(b.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(b.masuk_tahap_pada) }}</span>
          </div>
          <div style="font-size:12px; color:var(--text-faint); margin-bottom:6px;">{{ b.nama_produk }} &middot; size {{ b.size || '-' }} &middot; qty {{ formatQty(b.qty) }}</div>
          <div style="font-size:11px; color:var(--text-faint); margin-bottom:10px;">Operator: <b>{{ b.operator_nama || '-' }}</b> &middot; komponen {{ progres(b).done }}/{{ progres(b).total }}</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
            <button v-if="bolehCetak" @click="cetakIdKomponen(b)" :disabled="sedangCetak" class="btn-outline" style="flex:1; min-width:130px; padding:8px; font-size:11.5px;"><i class="fas fa-print" style="margin-right:4px;"></i>Cetak ID Komponen</button>
            <button v-if="bolehOperator" @click="bukaScanOperator(b)" class="btn-outline" style="flex:1; min-width:130px; padding:8px; font-size:11.5px;"><i class="fas fa-user-check" style="margin-right:4px;"></i>Scan Operator</button>
            <button v-if="bolehProses" @click="bukaScanEntry(b)" class="btn-primary" style="flex:1; min-width:130px; padding:8px; font-size:11.5px;"><i class="fas fa-qrcode" style="margin-right:4px;"></i>Scan Entry</button>
            <button v-if="bolehProses" @click="bukaMasalah(b)" class="btn-outline" style="flex:1; min-width:130px; padding:8px; font-size:11.5px; color:var(--danger, #b91c1c);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
          </div>
          <div @click="toggleEkspand(b.id)" style="cursor:pointer; font-size:11px; color:var(--accent); margin-bottom:6px;"><i class="fas" :class="ekspand[b.id] ? 'fa-chevron-up' : 'fa-chevron-down'" style="margin-right:4px;"></i>{{ ekspand[b.id] ? 'Sembunyikan' : 'Lihat' }} rincian komponen per sumber</div>
          <div v-if="ekspand[b.id]" style="display:flex; flex-direction:column; gap:8px;">
            <div v-for="(rows, sb) in perSumber(b)" :key="sb" style="background:var(--ivory-dim); border-radius:10px; padding:8px;">
              <div class="gc-heading" style="font-size:10px; font-weight:700; text-transform:uppercase; margin-bottom:5px;">{{ sb }}</div>
              <div v-for="k in rows" :key="k.id_komponen" style="display:flex; gap:6px; font-size:10.5px; padding:2px 0; align-items:center;">
                <span style="flex:1; color:var(--text-faint);">{{ k.id_komponen }}</span>
                <span style="flex:1;">{{ k.nama_komponen }}</span>
                <span class="gc-num" style="width:50px; text-align:right;">{{ formatQty(k.qty_setor) }} {{ k.satuan }}</span>
                <span class="tag" :class="k.status==='selesai' ? 'ok' : 'neutral'">{{ k.status }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <popup-pratinjau-cetak-label v-if="popupCetakAktif" :terbuka="popupCetakAktif" :daftar-label="daftarLabelPreview" judul="Cetak ID Komponen" jenis-cetak="id_komponen_serie" @tutup="popupCetakAktif = false" />
    <scan-generik :aktif="modalEntry.aktif" :judul="modalEntry.batch ? ('Scan Entry — ' + modalEntry.batch.kode_batch) : 'Scan Entry'" subjudul="Scan ID komponen satu per satu." @hasil="hasilScanEntry" @tutup="tutupScanEntry" />
    <popup-pin-generik v-if="popupPinOperator" judul="Verifikasi PIN — Operator Serie" konteks="Serie - Scan Operator" :roles-diizinkan="['owner','superuser','pic_owner','pic']" @sukses="pinSuksesOperator" @batal="popupPinOperator = null" />

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.target.kode_batch }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. komponen hilang"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// TAB 2.3: Perlu Di Kirim — cetak kode bagging (bundle per nama_komponen,
// sama pola seperti Cutting cetak surat jalan tapi TANPA kode tugas/tujuan
// di sini — kode tugas baru dicetak di tab 2.4, lihat keputusan pemisahan
// di komentar besar atas file) + Scan Pack (isi bagging dengan id_komponen).
// Reuse koleksi `bagging` yang SAMA dipakai Cutting & Persiapan Bahan.
// ============================================================================
const SeriePerluDiKirim = {
  components: { PopupPratinjauCetakLabel, ScanGenerik },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const daftarBaggingAktif = ref([]);
    const sedangProses = ref(false);
    const menuId = 'proses_serie';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const [batch, baggingSnap] = await Promise.all([
          muatSemuaSeparatingBatch(),
          getDocs(query(collection(db, 'bagging'), where('ditutup_pada', '==', null)))
        ]);
        daftar.value = batch.filter(b => b.status === 'perlu_dikirim');
        daftarBaggingAktif.value = baggingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) { console.error('Gagal muat Serie > Perlu Di Kirim:', e); daftar.value = []; daftarBaggingAktif.value = []; }
      memuat.value = false;
    }

    // --- Cetak Kode Bagging: bundle per nama_komponen, TIDAK ada popup
    // pilihan (tidak ada tujuan yang perlu dipilih di tab ini). -------------
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    async function cetakKodeBagging(batch) {
      if (batch.kode_bagging && batch.kode_bagging.length) { if (!confirm('Batch ini sudah pernah dicetak kode bagging. Cetak ulang tambahan?')) return; }
      const jenisKomponen = Array.from(new Set((batch.komponen_rincian || []).map(k => k.nama_komponen)));
      if (!jenisKomponen.length) { alert('Batch ini belum punya rincian komponen — tidak bisa dibundel.'); return; }
      sedangProses.value = true;
      try {
        const preview = [];
        const kodeBaru = [];
        for (const jenis of jenisKomponen) {
          const kode = await generateKodeHarianFormat('BAG', 'pengaturan_id_bagging');
          await addDoc(collection(db, 'bagging'), {
            kode, produk_label: `${batch.kode_batch} &middot; ${jenis}`, isi: [], ditutup_pada: null,
            dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
          });
          kodeBaru.push(kode);
          preview.push({ kode, nama: jenis, info: `Kode Bagging &middot; ${batch.kode_batch}`, qrDataUrl: buatQrDataUrl(kode) });
        }
        await updateSeparatingBatch(batch.id, (data) => ({ kode_bagging: [...(data.kode_bagging || []), ...kodeBaru] }));
        daftarLabelPreview.value = preview;
        popupCetakAktif.value = true;
        await muat();
      } catch (e) { console.error('Gagal cetak kode bagging Serie:', e); alert('Gagal mencetak. Coba lagi.'); }
      sedangProses.value = false;
    }

    // --- Scan Pack: step1 kode bagging, step2 id_komponen berkali-kali ------
    const modalPack = reactive({ aktif: false, bagging: null, batch: null, log: [] });
    function bukaScanPack() { modalPack.bagging = null; modalPack.batch = null; modalPack.log = []; modalPack.aktif = true; }
    function tutupScanPack() { modalPack.aktif = false; modalPack.bagging = null; modalPack.batch = null; modalPack.log = []; muat(); }
    async function hasilScanPack(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      if (!modalPack.bagging) {
        const b = daftarBaggingAktif.value.find(x => x.kode === kode);
        if (!b) { alert(`Kode bagging "${kode}" tidak ditemukan atau sudah ditutup.`); return; }
        const batch = daftar.value.find(bt => (bt.kode_bagging || []).includes(kode));
        if (!batch) { alert(`Kode bagging "${kode}" tidak terkait batch manapun di tab ini.`); return; }
        modalPack.bagging = b; modalPack.batch = batch;
        return;
      }
      const adaKomponen = (modalPack.batch.komponen_rincian || []).some(k => k.id_komponen === kode);
      if (!adaKomponen) { alert(`ID Komponen "${kode}" tidak ditemukan di batch ${modalPack.batch.kode_batch}.`); return; }
      try {
        await updateDoc(doc(db, 'bagging', modalPack.bagging.id), { isi: arrayUnion(kode) });
        modalPack.log.unshift(kode + ' -> ' + modalPack.bagging.kode);
      } catch (e) { console.error('Gagal scan pack Serie:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }
    async function tutupBagging() {
      if (!modalPack.bagging) return;
      try { await updateDoc(doc(db, 'bagging', modalPack.bagging.id), { ditutup_pada: serverTimestamp() }); } catch (e) { console.error('Gagal tutup bagging:', e); }
      modalPack.bagging = null; modalPack.batch = null;
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahSerie(p.target, p.jumlah, p.alasan);
      await muat();
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, daftar, bolehProses, bolehCetak, sedangProses, formatQty, formatDiamSejak, tertahan,
      popupCetakAktif, daftarLabelPreview, cetakKodeBagging,
      modalPack, bukaScanPack, tutupScanPack, hasilScanPack, tutupBagging,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div v-if="bolehProses" style="display:flex; gap:8px; margin-bottom:12px;">
        <button @click="bukaScanPack" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Pack</button>
      </div>
      <div v-if="daftar.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-box"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada batch yang perlu dikirim</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="b in daftar" :key="b.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(b.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ b.kode_batch }}</div>
            <span class="tag" :class="tertahan(b.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(b.masuk_tahap_pada) }}</span>
          </div>
          <div style="font-size:12px; color:var(--text-faint); margin-bottom:6px;">{{ b.nama_produk }} &middot; size {{ b.size || '-' }} &middot; qty {{ formatQty(b.qty) }}</div>
          <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:10px;">
            <span v-if="b.kode_bagging && b.kode_bagging.length" class="tag ok">{{ b.kode_bagging.length }} kode bagging dicetak</span>
            <span v-else class="tag neutral">belum dicetak kode bagging</span>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button v-if="bolehCetak" @click="cetakKodeBagging(b)" :disabled="sedangProses" class="btn-outline" style="flex:1; min-width:150px; padding:8px; font-size:11.5px;"><i class="fas fa-print" style="margin-right:4px;"></i>Cetak Kode Bagging</button>
            <button v-if="bolehProses" @click="bukaMasalah(b)" class="btn-outline" style="flex:1; min-width:120px; padding:8px; font-size:11.5px; color:var(--danger, #b91c1c);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
          </div>
        </div>
      </div>
    </template>

    <popup-pratinjau-cetak-label v-if="popupCetakAktif" :terbuka="popupCetakAktif" :daftar-label="daftarLabelPreview" judul="Cetak Kode Bagging" jenis-cetak="kode_bagging" @tutup="popupCetakAktif = false" />

    <scan-generik :aktif="modalPack.aktif" :judul="modalPack.bagging ? ('Scan ID komponen — bagging ' + modalPack.bagging.kode) : 'Scan Kode Bagging'" subjudul="Bisa discan berkali-kali. Tutup lewat tombol di bawah kalau sudah selesai." @hasil="hasilScanPack" @tutup="tutupScanPack" />
    <div v-if="modalPack.aktif && modalPack.bagging" style="position:fixed; left:16px; bottom:16px; z-index:10001; display:flex; flex-direction:column; gap:8px; max-width:260px;">
      <button @click="tutupBagging" class="btn-primary" style="padding:8px 14px; font-size:11px;">Tutup Bagging Ini</button>
      <div style="background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px;"><div v-for="(l,i) in modalPack.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div></div>
    </div>

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.target.kode_batch }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. bundle salah isi"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// FACTORY: Tab "Kirim <Tujuan>" (2.4 Kirim Sewing, 2.7 Kirim Finishing,
// 2.10 Kirim Gudang) — pola IDENTIK di 3 tab ini per SERAH-TERIMA/wireframe
// ("Pola sama dengan 2.4 Kirim Sewing" ditulis eksplisit utk 2.7 & 2.10),
// jadi ditulis SEKALI sebagai factory function dan dipanggil 3x dengan cfg
// beda, daripada disalin-tempel 3x nyaris identik (lebih gampang dirawat).
//
// Keputusan #12 (BARU, didokumentasikan di sini karena baru relevan mulai
// tab ini): status `setor_sewing`/`setor_finishing` yang ada di enum 11
// status separating_batch TIDAK PERNAH benar-benar ditulis oleh modul ini.
// Alasan: tab 2.5/2.8 "Setor Sewing/Finishing" murni read-only (baca
// sewing_track/finishing_track, SERAH-TERIMA §3 tegas "Serie cuma baca
// status, TIDAK ADA tombol aksi di situ") -- tidak ada aksi APAPUN di Serie
// yang logis memicu transisi ke status itu. Jadi alur nyata yang
// diimplementasikan: perlu_dikirim -> kirim_sewing (scan kirim tab 2.4) ->
// [lompat 'setor_sewing', Serie tidak pernah menulisnya] -> terima_sewing
// (scan sampai tab 2.6) -> kirim_finishing (scan kirim tab 2.7) -> [lompat
// 'setor_finishing'] -> terima_finishing (scan sampai tab 2.9) ->
// kirim_gudang (scan kirim tab 2.10) -> selesai (GAP DISENGAJA, ditulis
// modul Gudang Barang Jadi). Kode tugas dicetak ULANG di tiap tab Kirim
// (kode BEDA tiap leg pengiriman), TAPI kode_bagging dari tab 2.3 DIPAKAI
// ULANG di semua leg (bundle fisik sama, cuma surat jalan/kode tugas-nya
// yang baru tiap kali pindah divisi) -- sesuai wireframe 2.7 "scan kirim per
// bagging, pola sama dengan 2.4" yang TIDAK menyebut cetak bagging baru.
// ============================================================================
function buatTabKirim(cfg) {
  // cfg: { statusFilter, statusSetelah, tlcTujuan, namaTujuan, judul, kosongTeks, icon }
  return {
    components: { PopupPratinjauCetakLabel, ScanGenerik },
    setup() {
      const memuat = ref(true);
      const daftar = ref([]);
      const sedangProses = ref(false);
      const menuId = 'proses_serie';
      const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
      const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);

      async function muat() {
        memuat.value = true;
        try { daftar.value = (await muatSemuaSeparatingBatch()).filter(b => b.status === cfg.statusFilter); }
        catch (e) { console.error('Gagal muat Serie > ' + cfg.judul + ':', e); daftar.value = []; }
        memuat.value = false;
      }

      // --- Cetak Kode Tugas: TIDAK ada pilihan tujuan (sudah pasti per tab
      // ini), cuma tgl keberangkatan. Butuh kode_bagging (dicetak di 2.3). --
      const popupCetak = ref(null); // { batch, tglKeberangkatan }
      function bukaCetakTugas(batch) {
        if (!batch.kode_bagging || !batch.kode_bagging.length) { alert('Batch ini belum punya kode bagging (harus cetak di Perlu Di Kirim / hasil pack sebelumnya dulu).'); return; }
        popupCetak.value = { batch, tglKeberangkatan: new Date().toISOString().slice(0, 16) };
      }
      const popupCetakAktif = ref(false);
      const daftarLabelPreview = ref([]);
      async function konfirmasiCetakTugas() {
        const p = popupCetak.value;
        const batch = p.batch;
        sedangProses.value = true;
        try {
          const kodeTugas = await generateKodeHarianFormat('SPJ', 'pengaturan_id_tugas_kirim');
          await addDoc(collection(db, 'tugas_kirim'), {
            kode: kodeTugas, tlc_asal: TLC_ASAL_SERIE, tlc_tujuan: cfg.tlcTujuan, tgl_keberangkatan: p.tglKeberangkatan, pack: [],
            dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
          });
          await updateSeparatingBatch(batch.id, () => ({ kode_tugas: kodeTugas, tlc_tujuan: cfg.tlcTujuan }));
          daftarLabelPreview.value = [{
            kode: kodeTugas, nama: 'Kode Tugas — ' + cfg.namaTujuan,
            info: `Tujuan: ${cfg.namaTujuan} &middot; TLC-SER &rarr; ${cfg.tlcTujuan} &middot; ${batch.kode_batch}`,
            qrDataUrl: buatQrDataUrl(kodeTugas)
          }];
          popupCetak.value = null;
          popupCetakAktif.value = true;
          await muat();
        } catch (e) { console.error('Gagal cetak kode tugas Serie:', e); alert('Gagal mencetak. Coba lagi.'); }
        sedangProses.value = false;
      }

      // --- Scan Kirim: step1 kode tugas, step2 kode bagging tiap pack -------
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
        const batch = daftar.value.find(b => b.kode_tugas === modalKirim.tugas.kode && (b.kode_bagging || []).includes(kode));
        if (!batch) { alert(`Kode bagging "${kode}" tidak cocok dengan tugas ini.`); return; }
        try {
          await updateDoc(doc(db, 'tugas_kirim', modalKirim.tugas.id), { pack: arrayUnion({ kode_bagging: kode, pada: new Date().toISOString() }) });
          const tugasSnap = await getDoc(doc(db, 'tugas_kirim', modalKirim.tugas.id));
          const semuaSudah = (batch.kode_bagging || []).every(kb => (tugasSnap.data().pack || []).some(pk => pk.kode_bagging === kb));
          if (semuaSudah) { await updateSeparatingBatch(batch.id, () => ({ status: cfg.statusSetelah, masuk_tahap_pada: new Date().toISOString() })); }
          modalKirim.log.unshift(kode + ' -> ' + modalKirim.tugas.kode + (semuaSudah ? ' (semua bagging terkirim, status pindah)' : ''));
          await muat();
        } catch (e) { console.error('Gagal scan kirim Serie:', e); alert('Gagal menyimpan. Coba lagi.'); }
      }

      const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
        await kirimMasalahSerie(p.target, p.jumlah, p.alasan);
        await muat();
      });

      onMounted(async () => { await window.authReady; await muat(); });

      return {
        cfg, memuat, daftar, bolehProses, bolehCetak, sedangProses, formatQty, formatDiamSejak, tertahan,
        popupCetak, bukaCetakTugas, konfirmasiCetakTugas, popupCetakAktif, daftarLabelPreview,
        modalKirim, bukaScanKirim, tutupScanKirim, hasilScanKirim,
        popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah
      };
    },
    template: `
      <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <template v-else>
        <div v-if="bolehProses" style="display:flex; gap:8px; margin-bottom:12px;">
          <button @click="bukaScanKirim" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-paper-plane" style="margin-right:6px;"></i>Scan Kirim</button>
        </div>
        <div v-if="daftar.length === 0" class="gc-kosong gc-card">
          <div class="lingkaran"><i class="fas" :class="cfg.icon"></i></div>
          <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">{{ cfg.kosongTeks }}</h3>
        </div>
        <div v-else style="display:flex; flex-direction:column; gap:10px;">
          <div v-for="b in daftar" :key="b.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(b.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
            <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
              <div class="gc-num" style="font-weight:700; font-size:13px;">{{ b.kode_batch }}</div>
              <span class="tag" :class="tertahan(b.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(b.masuk_tahap_pada) }}</span>
            </div>
            <div style="font-size:12px; color:var(--text-faint); margin-bottom:6px;">{{ b.nama_produk }} &middot; size {{ b.size || '-' }} &middot; qty {{ formatQty(b.qty) }}</div>
            <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:10px;">
              <span v-if="b.kode_tugas" class="tag ok">{{ b.kode_tugas }} &rarr; {{ cfg.namaTujuan }}</span>
              <span v-else class="tag neutral">belum dicetak kode tugas</span>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button v-if="bolehCetak" @click="bukaCetakTugas(b)" class="btn-outline" style="flex:1; min-width:150px; padding:8px; font-size:11.5px;"><i class="fas fa-print" style="margin-right:4px;"></i>Cetak Kode Tugas</button>
              <button v-if="bolehProses" @click="bukaMasalah(b)" class="btn-outline" style="flex:1; min-width:120px; padding:8px; font-size:11.5px; color:var(--danger, #b91c1c);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
            </div>
          </div>
        </div>
      </template>

      <popup-pratinjau-cetak-label v-if="popupCetakAktif" :terbuka="popupCetakAktif" :daftar-label="daftarLabelPreview" :judul="'Cetak Kode Tugas — ' + cfg.namaTujuan" jenis-cetak="lembar_kode_tugas" @tutup="popupCetakAktif = false" />

      <div v-if="popupCetak" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
        <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
          <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Cetak Kode Tugas — {{ popupCetak.batch.kode_batch }}</h3>
          <div class="gc-field" style="margin-bottom:8px;"><label>Tujuan</label><input :value="cfg.namaTujuan + ' (' + cfg.tlcTujuan + ')'" disabled></div>
          <div class="gc-field" style="margin-bottom:14px;"><label>Tgl Keberangkatan</label><input v-model="popupCetak.tglKeberangkatan" type="datetime-local"></div>
          <div style="display:flex; gap:8px;">
            <button @click="popupCetak = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
            <button @click="konfirmasiCetakTugas" :disabled="sedangProses" class="btn-primary" style="flex:1; padding:9px;">Cetak</button>
          </div>
        </div>
      </div>

      <scan-generik :aktif="modalKirim.aktif" :judul="modalKirim.tugas ? ('Scan kode bagging — tugas ' + modalKirim.tugas.kode) : 'Scan Kode Tugas'" subjudul="Bisa discan berkali-kali (tiap kode bagging = 1 pack)." @hasil="hasilScanKirim" @tutup="tutupScanKirim" />
      <div v-if="modalKirim.aktif && modalKirim.tugas && modalKirim.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:280px;">
        <div v-for="(l,i) in modalKirim.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
      </div>

      <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
        <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
          <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.target.kode_batch }}</h3>
          <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
          <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. bagging rusak"></div>
          <div style="display:flex; gap:8px;">
            <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
            <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
          </div>
        </div>
      </div>
    `
  };
}
const SerieKirimSewing = buatTabKirim({
  statusFilter: 'perlu_dikirim', statusSetelah: 'kirim_sewing', tlcTujuan: TLC_TUJUAN_SEWING, namaTujuan: 'Sewing',
  judul: 'Kirim Sewing', kosongTeks: 'Tidak ada batch siap kirim ke Sewing', icon: 'fa-shirt'
});
const SerieKirimFinishing = buatTabKirim({
  statusFilter: 'terima_sewing', statusSetelah: 'kirim_finishing', tlcTujuan: TLC_TUJUAN_FINISHING, namaTujuan: 'Finishing',
  judul: 'Kirim Finishing', kosongTeks: 'Tidak ada batch siap kirim ke Finishing', icon: 'fa-spray-can-sparkles'
});
const SerieKirimGudang = buatTabKirim({
  statusFilter: 'terima_finishing', statusSetelah: 'kirim_gudang', tlcTujuan: TLC_TUJUAN_GUDANG, namaTujuan: 'Gudang Barang Jadi',
  judul: 'Kirim Gudang', kosongTeks: 'Tidak ada batch siap kirim ke Gudang', icon: 'fa-warehouse'
});

// ============================================================================
// FACTORY: Tab "Setor <Asal>" (2.5 Setor Sewing, 2.8 Setor Finishing) —
// READ-ONLY MURNI, tidak ada tombol aksi apapun (SERAH-TERIMA §3 & §8 butir
// 2 tegas). Baca sewing_track/finishing_track APA ADANYA, kosong sampai
// modul Sewing/Finishing dibangun (lihat GAP DISENGAJA di header file).
// ============================================================================
function buatTabSetor(cfg) {
  // cfg: { muatFn, judul, kosongTeks, icon, kolomStatus (fungsi ambil label status per doc) }
  return {
    setup() {
      const memuat = ref(true);
      const daftar = ref([]);
      async function muat() {
        memuat.value = true;
        try { daftar.value = await cfg.muatFn(); }
        catch (e) { console.error('Gagal muat Serie > ' + cfg.judul + ':', e); daftar.value = []; }
        memuat.value = false;
      }
      onMounted(async () => { await window.authReady; await muat(); });
      return { cfg, memuat, daftar, formatQty, formatWaktu };
    },
    template: `
      <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <template v-else>
        <div class="gc-card" style="padding:10px 12px; margin-bottom:10px; font-size:10.5px; color:var(--text-faint); background:var(--ivory-dim);">
          <i class="fas fa-circle-info" style="margin-right:6px;"></i>Read-only — status ditulis oleh divisi {{ cfg.namaAsal }} sendiri, Serie cuma menampilkan.
        </div>
        <div v-if="daftar.length === 0" class="gc-kosong gc-card">
          <div class="lingkaran"><i class="fas" :class="cfg.icon"></i></div>
          <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">{{ cfg.kosongTeks }}</h3>
          <p style="font-size:11px; color:var(--text-faint); margin-top:6px;">Terisi otomatis begitu modul {{ cfg.namaAsal }} (belum dibangun) mulai menulis status di sini — bukan error.</p>
        </div>
        <div v-else class="gc-card" style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:11px;">
            <thead><tr style="text-align:left; border-bottom:1px solid var(--border-soft);">
              <th style="padding:6px 8px;">Batch</th><th style="padding:6px 8px;">Produk</th><th style="padding:6px 8px;">Qty</th>
              <th style="padding:6px 8px;">Operator</th><th style="padding:6px 8px;">Status di {{ cfg.namaAsal }}</th><th style="padding:6px 8px;">Diperbarui</th>
            </tr></thead>
            <tbody>
              <tr v-for="t in daftar" :key="t.id" style="border-bottom:1px solid var(--border-soft);">
                <td style="padding:6px 8px;" class="gc-num">{{ t.kode_batch || '-' }}</td>
                <td style="padding:6px 8px;">{{ t.nama_produk }} {{ t.size || '' }}</td>
                <td style="padding:6px 8px;" class="gc-num">{{ formatQty(t.qty) }}</td>
                <td style="padding:6px 8px;">{{ (t.operator_nama) || '-' }}</td>
                <td style="padding:6px 8px;"><span class="tag" :class="t.status === 'selesai' ? 'ok' : 'warn'">{{ (t.status || '-').toUpperCase() }}</span></td>
                <td style="padding:6px 8px;" class="gc-num">{{ formatWaktu(t.entry_pada) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    `
  };
}
const SerieSetorSewing = buatTabSetor({ muatFn: muatSemuaSewingTrack, judul: 'Setor Sewing', namaAsal: 'Sewing', kosongTeks: 'Belum ada batch di Sewing', icon: 'fa-shirt' });
const SerieSetorFinishing = buatTabSetor({ muatFn: muatSemuaFinishingTrack, judul: 'Setor Finishing', namaAsal: 'Finishing', kosongTeks: 'Belum ada batch di Finishing', icon: 'fa-spray-can-sparkles' });

// ============================================================================
// FACTORY: Tab "Terima <Asal>" (2.6 Terima Sewing, 2.9 Terima Finishing) —
// Scan Sampai (cari sewing_track/finishing_track via kode_tugas, tandai
// status:'selesai' di situ = menutup "Sedang Dikirim" milik pos pengirim,
// PERSIS bahasa SERAH-TERIMA §3) + Scan Unpack (per kode_bagging, KOMPLIT/
// INKOMPLIT, dicatat ke separating_batch.unpack_log MILIK SERIE SENDIRI --
// beda dari tab 2.1 yang harus menulis ke koleksi ASING cutting_track/
// spk_track, di sini tidak perlu karena field unpack_log sudah ada bawaan
// separating_batch sejak dibuat). Field penghubung ke separating_batch:
// `batch_id` (Firestore doc id, ADA di skema sewing_track MAUPUN
// finishing_track per catatan developer di wireframe.dc.html Serie) --
// dipakai SERAGAM untuk 2 tab ini, TIDAK pakai kode_batch string (yang
// cuma ada eksplisit di skema sewing_track, tidak disebut di finishing_track
// karena finishing_track granularitasnya per PCS bukan per batch).
// `kode_bagging` di sewing_track ARRAY, di finishing_track TUNGGAL (per
// catatan skema masing-masing) -- makanya query dibedakan array-contains
// vs '==' lewat cfg.baggingArray.
// ============================================================================
function buatTabTerima(cfg) {
  // cfg: { koleksi, statusSetelah, namaAsal, judul, kosongTeks, icon, baggingArray, fieldBagging }
  return {
    components: { ScanGenerik },
    setup() {
      const memuat = ref(true);
      const daftar = ref([]);
      const menuId = 'proses_serie';
      const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);

      async function muat() {
        memuat.value = true;
        try { daftar.value = (await muatSemuaSeparatingBatch()).filter(b => b.status === cfg.statusMenunggu); }
        catch (e) { console.error('Gagal muat Serie > ' + cfg.judul + ':', e); daftar.value = []; }
        memuat.value = false;
      }

      const modalSampai = reactive({ aktif: false, log: [] });
      function bukaScanSampai() { modalSampai.log = []; modalSampai.aktif = true; }
      function tutupScanSampai() { modalSampai.aktif = false; modalSampai.log = []; muat(); }
      async function hasilScanSampai(kodeMentah) {
        const kode = (kodeMentah || '').trim();
        const now = new Date().toISOString();
        try {
          const snap = await getDocs(query(collection(db, cfg.koleksi), where('kode_tugas', '==', kode)));
          if (snap.empty) { alert(`Kode tugas "${kode}" tidak ditemukan di ${cfg.namaAsal} (mungkin modul ${cfg.namaAsal} belum mengirim, atau belum dibangun).`); return; }
          const batchIds = new Set();
          for (const d of snap.docs) {
            if (d.data().status === 'selesai') continue;
            await updateDoc(doc(db, cfg.koleksi, d.id), { status: 'selesai', sampai_pada: now });
            if (d.data().batch_id) batchIds.add(d.data().batch_id);
          }
          if (!batchIds.size) { alert(`Kode tugas "${kode}" sudah pernah di-Scan Sampai sebelumnya.`); return; }
          for (const bid of batchIds) {
            try { await updateSeparatingBatch(bid, () => ({ status: cfg.statusSetelah, masuk_tahap_pada: now })); }
            catch (e) { console.error('Gagal update separating_batch dari Terima ' + cfg.namaAsal + ':', e); }
          }
          modalSampai.log.unshift(kode + ' -> ' + cfg.namaAsal + ' selesai (' + batchIds.size + ' batch)');
          await muat();
        } catch (e) { console.error('Gagal scan sampai ' + cfg.judul + ':', e); alert('Gagal menyimpan. Coba lagi.'); }
      }

      const modalUnpack = reactive({ aktif: false });
      const popupUnpack = ref(null);
      function bukaScanUnpack() { modalUnpack.aktif = true; }
      function tutupScanUnpack() { modalUnpack.aktif = false; }
      function hasilScanUnpack(kodeMentah) { popupUnpack.value = { kodeBagging: (kodeMentah || '').trim(), hasil: 'komplit' }; }
      async function konfirmasiUnpack() {
        const p = popupUnpack.value;
        if (!p) return;
        try {
          const snap = await getDocs(query(collection(db, cfg.koleksi), where(cfg.fieldBagging, cfg.baggingArray ? 'array-contains' : '==', p.kodeBagging)));
          if (snap.empty) { alert(`Kode bagging "${p.kodeBagging}" tidak ditemukan di ${cfg.namaAsal}.`); popupUnpack.value = null; return; }
          const bid = snap.docs[0].data().batch_id;
          if (!bid) { alert('Dokumen ditemukan tapi tidak punya batch_id — tidak bisa dicatat ke Serie.'); popupUnpack.value = null; return; }
          await updateSeparatingBatch(bid, (data) => ({
            unpack_log: [...(data.unpack_log || []), { kode_bagging: p.kodeBagging, status: p.hasil, pada: new Date().toISOString(), oleh: cfg.namaAsal }]
          }));
          popupUnpack.value = null;
          await muat();
        } catch (e) { console.error('Gagal simpan unpack ' + cfg.judul + ':', e); alert('Gagal menyimpan. Coba lagi.'); }
      }

      const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
        await kirimMasalahSerie(p.target, p.jumlah, p.alasan);
        await muat();
      });

      onMounted(async () => { await window.authReady; await muat(); });

      return {
        cfg, memuat, daftar, bolehProses, formatQty, formatDiamSejak, tertahan,
        modalSampai, bukaScanSampai, tutupScanSampai, hasilScanSampai,
        modalUnpack, popupUnpack, bukaScanUnpack, tutupScanUnpack, hasilScanUnpack, konfirmasiUnpack,
        popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah
      };
    },
    template: `
      <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <template v-else>
        <div v-if="bolehProses" style="display:flex; gap:8px; margin-bottom:12px;">
          <button @click="bukaScanSampai" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Sampai</button>
          <button v-if="bolehProses" @click="bukaScanUnpack" class="btn-outline" style="flex:1; padding:9px;"><i class="fas fa-box-open" style="margin-right:6px;"></i>Scan Unpack</button>
        </div>
        <div v-if="daftar.length === 0" class="gc-kosong gc-card">
          <div class="lingkaran"><i class="fas" :class="cfg.icon"></i></div>
          <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">{{ cfg.kosongTeks }}</h3>
        </div>
        <div v-else style="display:flex; flex-direction:column; gap:10px;">
          <div v-for="b in daftar" :key="b.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(b.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
            <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
              <div class="gc-num" style="font-weight:700; font-size:13px;">{{ b.kode_batch }}</div>
              <span class="tag" :class="tertahan(b.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(b.masuk_tahap_pada) }}</span>
            </div>
            <div style="font-size:12px; color:var(--text-faint); margin-bottom:10px;">{{ b.nama_produk }} &middot; size {{ b.size || '-' }} &middot; qty {{ formatQty(b.qty) }} &middot; kode tugas {{ b.kode_tugas || '-' }}</div>
            <button v-if="bolehProses" @click="bukaMasalah(b)" class="btn-outline" style="width:100%; padding:8px; font-size:11px; color:var(--danger, #b91c1c);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
          </div>
        </div>
      </template>

      <scan-generik :aktif="modalSampai.aktif" :judul="'Scan Kode Tugas — dari ' + cfg.namaAsal" subjudul="Bisa discan berkali-kali." @hasil="hasilScanSampai" @tutup="tutupScanSampai" />
      <div v-if="modalSampai.aktif && modalSampai.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:280px;">
        <div v-for="(l,i) in modalSampai.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
      </div>

      <scan-generik :aktif="modalUnpack.aktif" :judul="'Scan Unpack — dari ' + cfg.namaAsal" subjudul="Scan kode bagging yang datang." @hasil="hasilScanUnpack" @tutup="tutupScanUnpack" />
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
}
const SerieTerimaSewing = buatTabTerima({
  koleksi: 'sewing_track', statusMenunggu: 'kirim_sewing', statusSetelah: 'terima_sewing', namaAsal: 'Sewing',
  judul: 'Terima Sewing', kosongTeks: 'Tidak ada batch yang sedang ditunggu dari Sewing', icon: 'fa-truck-ramp-box',
  baggingArray: true, fieldBagging: 'kode_bagging'
});
const SerieTerimaFinishing = buatTabTerima({
  koleksi: 'finishing_track', statusMenunggu: 'kirim_finishing', statusSetelah: 'terima_finishing', namaAsal: 'Finishing',
  judul: 'Terima Finishing', kosongTeks: 'Tidak ada batch yang sedang ditunggu dari Finishing', icon: 'fa-truck-ramp-box',
  baggingArray: false, fieldBagging: 'kode_bagging'
});

// ============================================================================
// TAB 2.11: Selesai — riwayat lengkap, read-only. Baris masuk saat Gudang
// Barang Jadi (belum dibangun) Scan Sampai dari Kirim Gudang (2.10) dan
// menulis `separating_batch.status = 'selesai'` + `sampai_pada` (GAP
// DISENGAJA, lihat header file). TAMPIL KOSONG sampai modul itu ada — bukan
// bug modul ini, pola SAMA seperti CuttingSelesai menunggu Serie.
// ============================================================================
const SerieSelesai = {
  setup() {
    const memuat = ref(true);
    const semuaSelesai = ref([]);
    const kataKunci = ref('');
    const dariTanggal = ref('');
    const sampaiTanggal = ref('');

    async function muat() {
      memuat.value = true;
      try { semuaSelesai.value = (await muatSemuaSeparatingBatch()).filter(b => b.status === 'selesai').sort((a, b) => new Date(b.sampai_pada || 0) - new Date(a.sampai_pada || 0)); }
      catch (e) { console.error('Gagal muat Serie > Selesai:', e); semuaSelesai.value = []; }
      memuat.value = false;
    }

    const selesaiHariIni = computed(() => semuaSelesai.value.filter(b => hariIniSama(b.sampai_pada)));

    const daftarUrut = computed(() => {
      let hasil = semuaSelesai.value;
      const kata = kataKunci.value.trim().toLowerCase();
      if (kata) hasil = hasil.filter(b => (b.kode_batch || '').toLowerCase().includes(kata) || (b.nama_produk || '').toLowerCase().includes(kata));
      if (dariTanggal.value) hasil = hasil.filter(b => b.sampai_pada && new Date(b.sampai_pada) >= new Date(dariTanggal.value));
      if (sampaiTanggal.value) hasil = hasil.filter(b => b.sampai_pada && new Date(b.sampai_pada) <= new Date(sampaiTanggal.value + 'T23:59:59'));
      return hasil;
    });

    function unduhCsv() {
      if (!daftarUrut.value.length) { alert('Tidak ada data untuk diunduh.'); return; }
      const header = ['Kode Batch', 'Produk', 'Size', 'Qty', 'Operator', 'Kode Tugas Terakhir', 'Selesai Pada'];
      const baris = daftarUrut.value.map(b => [b.kode_batch, b.nama_produk, b.size, b.qty, b.operator_nama, b.kode_tugas, formatWaktu(b.sampai_pada)]);
      const csv = [header, ...baris].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `serie-selesai-${new Date().toISOString().slice(0, 10)}.csv`;
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
        <input v-model="kataKunci" type="text" placeholder="Cari kode batch / produk..." style="flex:2; min-width:160px; padding:8px; border-radius:10px; border:1px solid var(--border-soft);">
        <input v-model="dariTanggal" type="date" style="flex:1; min-width:130px; padding:8px; border-radius:10px; border:1px solid var(--border-soft);">
        <input v-model="sampaiTanggal" type="date" style="flex:1; min-width:130px; padding:8px; border-radius:10px; border:1px solid var(--border-soft);">
        <button @click="unduhCsv" class="btn-outline" style="padding:8px 14px; font-size:11.5px;"><i class="fas fa-download" style="margin-right:6px;"></i>Unduh CSV</button>
      </div>

      <div v-if="daftarUrut.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-circle-check"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada riwayat Selesai</h3>
        <p style="font-size:11px; color:var(--text-faint); margin-top:6px;">Tab ini terisi otomatis begitu modul Gudang Barang Jadi (belum dibangun) menulis balik status selesai ke sini — bukan error.</p>
      </div>
      <div v-else class="gc-card" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead><tr style="text-align:left; border-bottom:1px solid var(--border-soft);">
            <th style="padding:6px 8px;">Kode Batch</th><th style="padding:6px 8px;">Produk</th><th style="padding:6px 8px;">Qty</th>
            <th style="padding:6px 8px;">Operator</th><th style="padding:6px 8px;">Kode Tugas Terakhir</th><th style="padding:6px 8px;">Selesai</th>
          </tr></thead>
          <tbody>
            <tr v-for="b in daftarUrut" :key="b.id" style="border-bottom:1px solid var(--border-soft);">
              <td style="padding:6px 8px;" class="gc-num">{{ b.kode_batch }}</td>
              <td style="padding:6px 8px;">{{ b.nama_produk }} {{ b.size }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatQty(b.qty) }}</td>
              <td style="padding:6px 8px;">{{ b.operator_nama || '-' }}</td>
              <td style="padding:6px 8px;">{{ b.kode_tugas || '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatWaktu(b.sampai_pada) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  `
};

// --- Mount ke index.html — LAZY, SAMA pola seperti Cutting: fungsi
// window.pastikanMountSerieXxx() dipanggil oleh pindahSubTab() (js/
// dashboard.js, peta petaMount) PERTAMA KALI tab itu dibuka. ----------------
let vmSeriePerluDiProses = null;
window.pastikanMountSeriePerluDiProses = function () {
  if (vmSeriePerluDiProses) return;
  const mountPoint = document.getElementById('vue-serie-perludiproses');
  if (mountPoint) vmSeriePerluDiProses = createApp(SeriePerluDiProses).mount('#vue-serie-perludiproses');
};
let vmSerieSedangDiProses = null;
window.pastikanMountSerieSedangDiProses = function () {
  if (vmSerieSedangDiProses) return;
  const mountPoint = document.getElementById('vue-serie-sedangdiproses');
  if (mountPoint) vmSerieSedangDiProses = createApp(SerieSedangDiProses).mount('#vue-serie-sedangdiproses');
};
let vmSeriePerluDiKirim = null;
window.pastikanMountSeriePerluDiKirim = function () {
  if (vmSeriePerluDiKirim) return;
  const mountPoint = document.getElementById('vue-serie-perludikirim');
  if (mountPoint) vmSeriePerluDiKirim = createApp(SeriePerluDiKirim).mount('#vue-serie-perludikirim');
};
let vmSerieKirimSewing = null;
window.pastikanMountSerieKirimSewing = function () {
  if (vmSerieKirimSewing) return;
  const mountPoint = document.getElementById('vue-serie-kirimsewing');
  if (mountPoint) vmSerieKirimSewing = createApp(SerieKirimSewing).mount('#vue-serie-kirimsewing');
};
let vmSerieSetorSewing = null;
window.pastikanMountSerieSetorSewing = function () {
  if (vmSerieSetorSewing) return;
  const mountPoint = document.getElementById('vue-serie-setorsewing');
  if (mountPoint) vmSerieSetorSewing = createApp(SerieSetorSewing).mount('#vue-serie-setorsewing');
};
let vmSerieTerimaSewing = null;
window.pastikanMountSerieTerimaSewing = function () {
  if (vmSerieTerimaSewing) return;
  const mountPoint = document.getElementById('vue-serie-terimasewing');
  if (mountPoint) vmSerieTerimaSewing = createApp(SerieTerimaSewing).mount('#vue-serie-terimasewing');
};
let vmSerieKirimFinishing = null;
window.pastikanMountSerieKirimFinishing = function () {
  if (vmSerieKirimFinishing) return;
  const mountPoint = document.getElementById('vue-serie-kirimfinishing');
  if (mountPoint) vmSerieKirimFinishing = createApp(SerieKirimFinishing).mount('#vue-serie-kirimfinishing');
};
let vmSerieSetorFinishing = null;
window.pastikanMountSerieSetorFinishing = function () {
  if (vmSerieSetorFinishing) return;
  const mountPoint = document.getElementById('vue-serie-setorfinishing');
  if (mountPoint) vmSerieSetorFinishing = createApp(SerieSetorFinishing).mount('#vue-serie-setorfinishing');
};
let vmSerieTerimaFinishing = null;
window.pastikanMountSerieTerimaFinishing = function () {
  if (vmSerieTerimaFinishing) return;
  const mountPoint = document.getElementById('vue-serie-terimafinishing');
  if (mountPoint) vmSerieTerimaFinishing = createApp(SerieTerimaFinishing).mount('#vue-serie-terimafinishing');
};
let vmSerieKirimGudang = null;
window.pastikanMountSerieKirimGudang = function () {
  if (vmSerieKirimGudang) return;
  const mountPoint = document.getElementById('vue-serie-kirimgudang');
  if (mountPoint) vmSerieKirimGudang = createApp(SerieKirimGudang).mount('#vue-serie-kirimgudang');
};
let vmSerieSelesai = null;
window.pastikanMountSerieSelesai = function () {
  if (vmSerieSelesai) return;
  const mountPoint = document.getElementById('vue-serie-selesai');
  if (mountPoint) vmSerieSelesai = createApp(SerieSelesai).mount('#vue-serie-selesai');
};
