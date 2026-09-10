// js/vue-pp-sewing.js
// ============================================================================
// Proses Produksi > Sewing — menu BARU (7 Sep 2026 malam lanjut lagi, "lanjut
// lagi" #3, setelah Cutting & Serie selesai), wireframe handoff "03 - Proses
// Produksi / 03 - Sewing", dikerjakan via /design-terapkan-handoff, lanjut
// urutan penomoran folder Mockup/handoff/03 - Proses Produksi/ (01-Cutting,
// 02-Serie sudah selesai, 03-Sewing berikutnya — BUKAN loncat ke 04-Finishing).
//
// ARSITEKTUR — PENTING, baca dulu sebelum ubah apapun di sini:
//
// Sewing MENERIMA batch dari Serie (Tab 2.4 "Kirim Sewing", yang mencetak
// kode_bagging di Serie Tab 2.3 + kode_tugas di Serie Tab 2.4, keduanya
// disimpan di `separating_batch` milik Serie — BUKAN disalin ke sewing_track
// di sini, lihat keputusan #2), menjahitnya jadi produk jadi (1 operator per
// batch, bukan 3 tahap seperti Cutting ampar/pola/cutting), lalu KIRIM BALIK
// ke Serie (Tab 2.6 "Terima Sewing" milik Serie SUDAH ADA & SUDAH MENULIS ke
// koleksi sewing_track ini sejak modul Serie dibangun — lihat keputusan #1).
// Lima tab, SATU koleksi baru untuk tracking + SATU koleksi baru untuk label
// pcs (per SERAH-TERIMA bagian 5 "Database > Perlu ditambah" — cuma 2 ini).
//
// Koleksi BARU:
//   sewing_track — 1 dokumen per batch (separating_batch) yang masuk Sewing.
//     Field: batch_id (id dokumen separating_batch terkait), kode_batch,
//     nama_produk, size, sku_produk, warna (2 field TAMBAHAN di luar daftar
//     SERAH-TERIMA, lihat keputusan #4 — dibutuhkan buat cetak label pcs),
//     qty, status (5 nilai: perlu_diproses -> sedang_sewing -> perlu_dikirim
//     -> sedang_dikirim -> selesai — PERSIS 5 tab modul ini, lihat keputusan
//     #3), operator_uid/nama/riwayat_operator[], kode_bagging[]/kode_tugas
//     (OUTGOING ke Serie, dicetak Tab 3.3 — lihat keputusan #2, BUKAN
//     kode_bagging/kode_tugas yang datang DARI Serie), tujuan (selalu
//     'Serie', string konstan tanpa dropdown), unpack_log[], catatan_masalah,
//     terima_pada (ditulis MODUL INI Tab 3.1 Scan Sampai — lihat keputusan
//     #2), mulai_sewing_pada + entry_pada (2 field TAMBAHAN, lihat keputusan
//     #5, dasar hitung KPI "rata-rata waktu per batch"), label_pcs_dicetak_pada
//     (TAMBAHAN, cegah cetak dobel — lihat keputusan #6), masuk_tahap_pada
//     (dasar ambang tertahan, ganti tiap pindah status), sampai_pada (BUKAN
//     ditulis modul ini — ditulis Serie Tab 2.6 "Terima Sewing", MENUTUP
//     status 'sedang_dikirim' -> 'selesai', lihat keputusan #1),
//     dibuat_pada/diperbarui_pada.
//   label_pcs — 1 dokumen per pcs produk jadi (dicetak Tab 3.3). Field:
//     kode_pcs (format PCSyymmdd-NNN, counter pengaturan_id_label_pcs — pola
//     SAMA seperti BAG/TGS/SPJ, bukan literal "PCS+yymmdd+NNN" dari SERAH-
//     TERIMA yang cuma notasi deskriptif), batch_id, kode_batch (TAMBAHAN,
//     display), sku_produk, nama_produk, size, warna, status (6 nilai:
//     dicetak -> di_finishing -> di_gudang -> terjual -> perlu_dicari ->
//     hilang — lihat keputusan #7 soal perbedaan jumlah nilai), order_spk_id
//     (alokasi PO FIFO — GAP DISENGAJA, lihat di bawah, TIDAK diisi modul
//     ini), gudang_masuk_pada, terjual_pada, transaksi_kasir_id (3 field
//     terakhir ini ditulis modul LAIN yang belum dibangun — Finishing/
//     Gudang/Kasir — GAP DISENGAJA), dibuat_pada.
//   pengaturan_id_label_pcs/{yymmdd} — counter harian, pola SAMA seperti
//     pengaturan_id_bagging/tugas_kirim/label_komponen/separating.
//
// KEPUTUSAN ARSITEKTUR (judgment call, DIDOKUMENTASIKAN karena SERAH-TERIMA
// tidak menjawab eksplisit atau baru jelas setelah baca wireframe.dc.html):
//
// 1. `sewing_track.status='selesai'` + `sampai_pada` BUKAN ditulis modul ini
//    — sudah ditulis Serie sejak modul Serie dibangun (js/vue-pp-serie.js,
//    fungsi factory `buatTabTerima()`, dipakai Tab 2.6 "Terima Sewing": Scan
//    Sampai di Serie mencari `sewing_track` yang `kode_tugas`-nya cocok,
//    menulis `status:'selesai', sampai_pada:sekarang`). Field ini TIDAK
//    PERNAH ditulis modul ini — Tab 3.5 "Selesai" di sini murni membaca hasil
//    tulisan Serie, PERSIS pola CuttingSelesai menunggu Serie / SerieSelesai
//    menunggu Gudang Barang Jadi. Konsekuensi: `kode_tugas` yang tersimpan di
//    `sewing_track` (diisi modul INI di Tab 3.3, lihat keputusan #2) HARUS
//    sama persis dengan yang dicari Serie Tab 2.6 — sudah dicek ke kode Serie
//    (buatTabTerima query `where('kode_tugas','==',kode)` pada koleksi
//    `sewing_track` langsung), jadi kode_tugas WAJIB ditulis ke sewing_track,
//    bukan cuma ke dokumen `tugas_kirim`.
// 2. `sewing_track.kode_bagging[]`/`kode_tugas` HANYA untuk pengiriman
//    KELUAR (Sewing -> Serie, dicetak Tab 3.3) — BUKAN diisi dari kode_bagging
//    /kode_tugas yang datang DARI Serie (yang tersimpan di
//    `separating_batch.kode_bagging[]`/`kode_tugas` milik Serie sendiri, Tab
//    2.3/2.4). Ini SIMETRIS dengan pola cutting_track/separating_batch:
//    field kode_bagging/kode_tugas SEBUAH track SELALU berarti "pengiriman
//    keluar pos ini", TIDAK PERNAH dipakai ulang utk pengiriman masuk yang
//    sudah ditutup. Konsekuensi: Tab 3.1 "Scan Sampai" (menutup kiriman
//    MASUK dari Serie) query LANGSUNG ke koleksi `separating_batch` (kode_
//    tugas dulu, lalu kode_bagging[] milik dokumen itu) — BUKAN ke
//    sewing_track — begitu KOMPLIT, baru menulis `terima_pada` (field BARU,
//    BUKAN `sampai_pada` — lihat keputusan #1, dua field beda arti: sampai_
//    pada = Serie terima balik hasil Sewing, terima_pada = Sewing terima
//    kiriman awal dari Serie, dua peristiwa beda di siklus hidup dokumen yang
//    SAMA, harus beda nama field supaya tidak saling timpa). Sama untuk Scan
//    Unpack (3.1): query `separating_batch` (kode_bagging array-contains),
//    lalu tulis unpack_log ke `sewing_track` yang `batch_id`-nya cocok.
// 3. Status 5 nilai PERSIS 5 tab modul ini (perlu_diproses/sedang_sewing/
//    perlu_dikirim/sedang_dikirim/selesai) — SERAH-TERIMA cuma bilang "status
//    (5 nilai)" tanpa merinci, tapi 5 tab + posisi tiap status di alur (masuk
//    diproses -> dijahit -> siap kirim -> dalam pengiriman -> selesai) sudah
//    unik & tidak ambigu, sama pola seperti Cutting (7 status = 7 tab).
// 4. `sku_produk`/`warna` DITAMBAH ke skema sewing_track (di luar daftar
//    SERAH-TERIMA yang cuma sebut kode_batch/nama_produk/qty) — diresolve
//    SEKALI saat lazy-create (lihat keputusan #8) lewat rantai
//    separating_batch.spk_groupings[0] -> spk_grouping.sku_produk_terlibat[0]
//    -> master_produk.warna (pola SAMA seperti resolusi warna "Rincian per
//    warna" di js/vue-persiapan-produksi-v2.js — order_spk/spk_grouping TIDAK
//    punya field warna sendiri, warna field terpisah di master_produk,
//    resolve by SKU). Field ini WAJIB ada di sewing_track (bukan diresolve
//    ulang tiap kali cetak label pcs di Tab 3.3) supaya Tab 3.3 tidak perlu
//    baca 2 koleksi tambahan tiap kali tombol cetak diklik.
// 5. `mulai_sewing_pada` (ditulis saat Scan Operator, Tab 3.1) + `entry_pada`
//    (ditulis saat Scan Entry, Tab 3.2) — 2 field TAMBAHAN di luar daftar
//    SERAH-TERIMA (yang cuma sebut entry_pada) — dibutuhkan supaya KPI Tab
//    3.2 "rata-rata waktu per batch" (wireframe, papan admin dikelompokkan
//    per operator, mirip Cutting 1.4/Persiapan 3.2.1) tetap bisa dihitung
//    SETELAH batch pindah status ke perlu_dikirim/sedang_dikirim/selesai —
//    kalau cuma pakai `masuk_tahap_pada` (yang DITIMPA tiap pindah status,
//    sama seperti semua pos lain), durasi "waktu di Sedang Sewing" akan
//    hilang begitu batch lanjut ke tahap berikutnya. TIDAK ADA preseden
//    "papan per operator + KPI" di modul manapun di app ini (sudah dicek ke
//    CuttingSedangAmpar sebagai kandidat rujukan — ternyata cuma daftar
//    datar, tidak ada pengelompokan operator) — desain baru, bukan salin
//    tempel dari modul lain.
// 6. `label_pcs_dicetak_pada` — flag SEKALI cetak per batch (TIDAK ada di
//    SERAH-TERIMA, ditambah supaya tidak dobel-cetak `qty` label pcs yang
//    otomatis jadi DOBEL CATATAN STOK kalau diklik 2x tanpa sengaja — beda
//    dari "Cetak Label Komponen" Cutting yang boleh cetak ulang bertahap per
//    komponen karena flag ada di TIAP baris komponen, bukan 1 flag per
//    track). Tombol Cetak Label Pcs berubah jadi "Cetak Ulang" begitu sudah
//    pernah dicetak — cetak ulang MEMBACA ULANG label_pcs yang SUDAH ADA di
//    DB (tidak addDoc baru), supaya tidak menghasilkan stok bayangan ganda.
// 7. `label_pcs.status` PAKAI 6 nilai (dicetak -> di_finishing -> di_gudang
//    -> terjual -> perlu_dicari -> hilang) sesuai SERAH-TERIMA MILIK MODUL
//    INI SENDIRI (bagian 5), BUKAN 4 nilai versi ringkas yang sempat dicatat
//    di ringkasan lintas-modul Serie (dicetak/di_finishing/di_gudang/
//    terjual saja) — modul inilah yang menerbitkan koleksi ini pertama kali
//    (SERAH-TERIMA §5 "Perlu ditambah"), jadi versinya yang lebih lengkap &
//    otoritatif dipakai (perlu_dicari/hilang relevan buat proses audit stok
//    fisik di Gudang, wajar tidak disebut di ringkasan Serie yang scope-nya
//    cuma perlu tahu 4 status utama alur). Status selain 'dicetak' (nilai
//    awal saat cetak di Tab 3.3) SEMUA ditulis modul lain (Finishing/Gudang/
//    Kasir) — GAP DISENGAJA, lihat di bawah.
// 8. KAPAN sewing_track DIBUAT — LAZY, SAMA persis pola cutting_track: Tab
//    3.1 "Perlu Di Proses", tiap dibuka, baca SEMUA `separating_batch`
//    berstatus 'kirim_sewing' + SEMUA `sewing_track` (match via `batch_id`),
//    buat baru (status:'perlu_diproses') untuk yang belum punya. Idempoten,
//    aman dipanggil berkali-kali (`pastikanSewingTrackLengkap()`).
// 9. Peran: Scan Operator (Tab 3.1) HANYA PIC/PIC Owner/Owner/Superuser (SERAH
//    -TERIMA §8 butir 4 "Scan operator hanya PIC/PIC Owner/Owner"), via PIN
//    (PopupPinGenerik) — role gate DUA LAPIS sama pola Cutting/Serie
//    (tombol tidak tampil di DOM utk role lain, PIN verifikasi identitas
//    individu). TAMBAHAN (judgment call): tombol Scan Operator diblokir
//    (alert saat diklik) kalau `terima_pada` batch itu belum terisi — tidak
//    logis menunjuk operator sebelum batch fisik dikonfirmasi sampai (Scan
//    Sampai). SERAH-TERIMA tidak menyebut urutan wajib ini secara eksplisit,
//    tapi ini konsisten dengan prinsip umum app "satu jalan masuk data, satu
//    jejak" (PEDOMAN-SERAH-TERIMA.md aturan #2) — kalau salah, Guru tinggal
//    minta longgarkan.
// 10. Scan Masalah ditambahkan di SEMUA tab operasional (3.1/3.2/3.3/3.4) —
//    SERAH-TERIMA tabel ringkas cuma eksplisit sebut "scan masalah" di 3.1 &
//    3.2, TAPI PEDOMAN-SERAH-TERIMA.md aturan #4c ("scan masalah wajib ada
//    di tahap Perlu kalau tahap Sedang punya scan masalah") mewajibkan 3.3
//    "Perlu Dikirim" ikut punya (karena 3.2 "Sedang Sewing" punya) — dan
//    3.4 "Sedang Kirim" mengikuti preseden KONSISTEN di seluruh app (Cutting
//    1.6 SedangDiKirim & SEMUA tab buatTabKirim() milik Serie tetap punya
//    Scan Masalah meski cuma tab tracking read-only) — bukan tebakan, dua-
//    duanya berdasar aturan/preseden tertulis, bukan diputuskan sendiri.
// 11. Bundling kode bagging KELUAR (Tab 3.3): SATU kode bagging per batch,
//    membundel SEMUA label_pcs batch itu jadi satu paket fisik — SERAH-
//    TERIMA TIDAK merinci aturan bundling seperti Cutting ("bundle per
//    jenis komponen"), jadi disederhanakan jadi 1:1 batch:bagging (produk
//    jadi hasil 1 batch dianggap 1 paket fisik yang dikirim bersamaan ke
//    Serie, beda dari Cutting yang harus pisah per jenis komponen karena itu
//    bahan MENTAH belum jadi produk). Konsekuensi teknis: Scan Kirim (3.3)
//    TIDAK perlu cek "semua bagging sudah di-scan" seperti Cutting/Serie
//    (yang bisa >1 bagging per shipment) — begitu SATU kode bagging itu
//    cocok, status langsung pindah 'sedang_dikirim'.
// 12. Cetak Label Pcs & Cetak Bagging+Kode Tugas DIGABUNG DALAM SATU TAB 3.3
//    "Perlu Dikirim" (BEDA dari Serie yang split Kirim Sewing/Finishing/
//    Gudang jadi tab TERPISAH dari Perlu Di Kirim) — SERAH-TERIMA Sewing
//    memang cuma 5 tab (bukan 11 seperti Serie), dan wireframe menulis
//    ketiganya ("Cetak label pcs..., bagging, kode tugas -> Serie") sebagai
//    SATU baris aksi di tab yang sama — jadi 3 tombol berbeda dalam 1 tab,
//    bukan dipecah jadi tab baru yang tidak diminta.
// 13. TLC: `TLC-JHT` (asal Sewing sendiri — KEBETULAN SAMA dengan tujuan yang
//    dipakai Serie Tab 2.4 "Kirim Sewing", memang literal yang sama karena
//    dia menunjuk lokasi fisik yang sama, Sewing) dan `TLC-SER` (tujuan balik
//    ke Serie) dipakai sebagai KONSTANTA LITERAL, TIDAK di-seed otomatis ke
//    master_tlc — kode-kode ini KEMUNGKINAN BESAR SUDAH ADA (Serie Tab 2.4
//    sudah memakai TLC-JHT sebagai tujuan sejak modul Serie dibangun), tapi
//    Guru tetap WAJIB memastikan sudah ada di Zevanic House > TLC & Prefix
//    sebelum cetak kode tugas di modul ini dipakai, sama seperti pos lain.
//
// GAP DISENGAJA (bukan bug):
// - `label_pcs.status` selain 'dicetak' (di_finishing/di_gudang/terjual/
//   perlu_dicari/hilang) BELUM PUNYA PENULIS — tugas modul Finishing/Gudang
//   Barang Jadi/Kasir (semua di luar cakupan SERAH-TERIMA Sewing, lihat §4
//   Scope) — field-field ini akan diisi begitu modul-modul itu mulai men-scan
//   label_pcs. `order_spk_id`/`gudang_masuk_pada`/`terjual_pada`/
//   `transaksi_kasir_id` sama, tetap null/kosong sampai modul terkait ada.
// - Tab 3.4 "Sedang Kirim" TIDAK akan otomatis pindah ke Tab 3.5 "Selesai"
//   sampai Serie (SUDAH ADA & SUDAH BISA, lihat keputusan #1) melakukan Scan
//   Sampai di Tab 2.6 "Terima Sewing" miliknya sendiri — begitu modul ini
//   selesai dites, Guru WAJIB scan di sisi Serie juga supaya siklus tertutup.
//
// Print label & scan QR: PAKAI ULANG PopupPratinjauCetakLabel & ScanGenerik
// (js/vue-components.js, js/vue-scan-cetak.js) — TIDAK ada komponen visual
// baru ditulis di sini, konsisten dengan seluruh app & dengan Cutting/Serie.
// ============================================================================

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel } from './vue-components.js?v=7';
import { ScanGenerik, PopupPinGenerik, buatQrDataUrl, ajukanPersiapanMasalah } from './vue-scan-cetak.js?v=3';

// --- Format & hitung kecil (disalin pola dari Cutting/Serie, belum ada
// infrastruktur util generik lintas file). ----------------------------------
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
// (hasil selisih 2 timestamp yang sudah dihitung), bukan 1 ISO string vs
// sekarang — dipakai KPI "rata-rata waktu per batch" Tab 3.2 (keputusan #5).
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

// --- Baca koleksi mentah ----------------------------------------------------
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
// resolveSkuWarnaBatch — keputusan #4: rantai separating_batch.spk_groupings
// [0] -> spk_grouping.sku_produk_terlibat[0] -> master_produk.warna.
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
        batch_id: b.id, kode_batch: b.kode_batch || '', nama_produk: b.nama_produk || '', size: b.size || '',
        sku_produk, warna, qty: parseFloat(b.qty) || 0,
        status: 'perlu_diproses',
        operator_uid: null, operator_nama: null, riwayat_operator: [],
        kode_bagging: [], kode_tugas: '', tujuan: 'Serie',
        unpack_log: [], catatan_masalah: '',
        terima_pada: null, mulai_sewing_pada: null, entry_pada: null, label_pcs_dicetak_pada: null,
        masuk_tahap_pada: now, sampai_pada: null,
        dibuat_pada: serverTimestamp(), diperbarui_pada: serverTimestamp()
      });
    }));
  }
  return await muatSemuaSewingTrack();
}
// updateSewingTrack — read-modify-write ATOMIK, pola sama seperti
// updateCuttingTrack()/updateSeparatingBatch() di modul lain.
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
}

// ============================================================================
// TAB 3.1: Perlu Di Proses
// ============================================================================
const SewingPerluDiProses = {
  components: { ScanGenerik, PopupPinGenerik },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const menuId = 'proses_sewing';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehOperator = computed(() => picOwnerKeAtas(window.currentUser));

    async function muat() {
      memuat.value = true;
      try { daftar.value = (await pastikanSewingTrackLengkap()).filter(t => t.status === 'perlu_diproses'); }
      catch (e) { console.error('Gagal muat Sewing > Perlu Di Proses:', e); daftar.value = []; }
      memuat.value = false;
    }

    // --- Scan Sampai: step1 kode_tugas, step2 kode_bagging berkali-kali —
    // KEDUANYA dicocokkan ke `separating_batch` (BUKAN sewing_track sendiri,
    // lihat keputusan #2). Begitu KOMPLIT, tulis `terima_pada` di sewing_track
    // yang batch_id-nya cocok. ------------------------------------------------
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
          const t = daftar.value.find(x => x.batch_id === b.id);
          if (!t) { alert('Bagging cocok, tapi sewing_track untuk batch ini belum ada — coba tutup lalu buka lagi tab ini.'); return; }
          await updateSewingTrack(t.id, () => ({ terima_pada: new Date().toISOString() }));
          modalSampai.log.unshift('SEMUA bagging sampai — batch ' + (b.kode_batch || '') + ' siap ditunjuk operator');
          await muat();
        } catch (e) { console.error('Gagal simpan scan sampai Sewing:', e); alert('Gagal menyimpan. Coba lagi.'); }
      }
    }

    // --- Scan Unpack: cari batch via separating_batch (kode_bagging array-
    // contains), lalu tulis unpack_log ke sewing_track yang batch_id cocok. --
    const modalUnpackScan = reactive({ aktif: false });
    const popupUnpack = ref(null); // { track, kodeBagging, hasil }
    function bukaScanUnpack() { modalUnpackScan.aktif = true; }
    function tutupScanUnpack() { modalUnpackScan.aktif = false; }
    async function hasilScanUnpack(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      try {
        const snap = await getDocs(query(collection(db, 'separating_batch'), where('kode_bagging', 'array-contains', kode)));
        if (snap.empty) { alert(`Kode bagging "${kode}" tidak ditemukan di batch manapun.`); return; }
        const b = { id: snap.docs[0].id, ...snap.docs[0].data() };
        const t = daftar.value.find(x => x.batch_id === b.id);
        if (!t) { alert('Batch ditemukan tapi belum punya sewing_track di tab ini — coba muat ulang.'); return; }
        popupUnpack.value = { track: t, kodeBagging: kode, hasil: 'komplit' };
      } catch (e) { console.error('Gagal cari kode bagging (unpack):', e); alert('Gagal mencari. Coba lagi.'); }
    }
    async function konfirmasiUnpack() {
      const p = popupUnpack.value;
      if (!p) return;
      try {
        await updateSewingTrack(p.track.id, () => ({
          unpack_log: arrayUnion({ kode_bagging: p.kodeBagging, status: p.hasil, pada: new Date().toISOString() })
        }));
        popupUnpack.value = null;
        await muat();
      } catch (e) { console.error('Gagal simpan unpack Sewing:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    // --- Tunjuk Operator (PIN, role PIC/PIC Owner/Owner) — keputusan #9:
    // diblokir kalau belum Scan Sampai (terima_pada kosong). -----------------
    const popupPinOperator = ref(null); // track
    function bukaTunjukOperator(track) {
      if (!track.terima_pada) { alert('Batch ini belum di-Scan Sampai — lakukan Scan Sampai dulu sebelum menunjuk operator.'); return; }
      popupPinOperator.value = track;
    }
    async function pinSuksesOperator(user) {
      const track = popupPinOperator.value;
      popupPinOperator.value = null;
      try {
        await updateSewingTrack(track.id, (data) => ({
          operator_uid: user.email, operator_nama: user.nama || user.name || user.email,
          riwayat_operator: [...(data.riwayat_operator || []), { uid: user.email, nama: user.nama || user.name || user.email, pada: new Date().toISOString() }],
          status: 'sedang_sewing', mulai_sewing_pada: new Date().toISOString(), masuk_tahap_pada: new Date().toISOString()
        }));
        await muat();
      } catch (e) { console.error('Gagal tunjuk operator Sewing:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahSewing(p.target, p.jumlah, p.alasan);
      await muat();
    });

    // --- Toolbar global (BARU, audit wireframe vs live sesi ini): wireframe
    // §3.1 cuma taruh SATU tombol kontekstual per kartu ("Scan Operator",
    // mati kalau belum komplit — lihat "role-box"/"Gerbang" wireframe.dc.html)
    // — Scan Sampai & Scan Unpack SUDAH GLOBAL secara logic sebelumnya (fungsi
    // tidak menerima parameter track, target dicari sendiri dari kode yang
    // discan — persis pola Gudang), cuma TAMPILANNYA diulang di tiap kartu.
    // Scan Masalah butuh target+jumlah spesifik per batch, jadi dipindah ke
    // toolbar lewat popup "pilih dulu" (SAMA pola pilihTargetMixin milik
    // js/vue-pp-cutting.js — file ini tidak impor lintas modul, jadi ditulis
    // ulang ringan di sini). Handler bukaMasalah(track)/hasilScanSampai/
    // hasilScanUnpack TIDAK diubah. --------------------------------------
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

    return {
      memuat, daftar, bolehProses, bolehOperator, formatQty, formatDiamSejak, tertahan,
      modalSampai, bukaScanSampai, tutupScanSampai, hasilScanSampai,
      modalUnpackScan, popupUnpack, bukaScanUnpack, tutupScanUnpack, hasilScanUnpack, konfirmasiUnpack,
      popupPinOperator, bukaTunjukOperator, pinSuksesOperator,
      popupMasalah, batalMasalah, konfirmasiMasalah,
      pilihMasalah, bukaMasalahToolbar, batalPilihMasalah, konfirmasiPilihMasalah
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <!-- Toolbar global (BARU) — Scan Sampai & Scan Unpack sudah global dari
           sisi logic sebelumnya, cuma dipindah tampilannya ke sini. Scan
           Masalah lewat popup pilih-target dulu (butuh 1 batch spesifik). -->
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
          <!-- Satu tombol kontekstual (wireframe §3.1): Scan Operator, mati
               kalau belum sampai/komplit. Guard alert di bukaTunjukOperator()
               tetap ada (TIDAK diubah) sebagai jaring kedua. -->
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button v-if="bolehOperator" @click="bukaTunjukOperator(t)" :disabled="!t.terima_pada" class="btn-outline" style="flex:1; padding:8px; font-size:11.5px;" :style="{ opacity: t.terima_pada ? 1 : .5 }"><i class="fas fa-user-check" style="margin-right:4px;"></i>Scan Operator</button>
          </div>
          <div v-if="t.unpack_log && t.unpack_log.length" style="margin-top:8px; font-size:10.5px; color:var(--text-faint);">
            Unpack: <span v-for="(u,i) in t.unpack_log" :key="i" class="tag" :class="u.status==='komplit' ? 'ok' : 'warn'" style="margin-right:4px;">{{ u.kode_bagging }}: {{ u.status }}</span>
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

// ============================================================================
// TAB 3.2: Sedang Sewing — dikelompokkan per operator + KPI (keputusan #5).
// ============================================================================
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

    // --- Scan Entry: satu scan kode_batch = batch selesai dijahit. ----------
    const modalEntry = reactive({ aktif: false, log: [] });
    function bukaScanEntry() { modalEntry.log = []; modalEntry.aktif = true; }
    function tutupScanEntry() { modalEntry.aktif = false; modalEntry.log = []; muat(); }
    async function hasilScanEntry(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      const t = daftar.value.find(x => x.kode_batch === kode);
      if (!t) { alert(`Kode batch "${kode}" tidak ditemukan di Sedang Sewing.`); return; }
      try {
        const now = new Date().toISOString();
        await updateSewingTrack(t.id, () => ({ status: 'perlu_dikirim', entry_pada: now, masuk_tahap_pada: now }));
        modalEntry.log.unshift(kode + ' -> selesai dijahit');
        await muat();
      } catch (e) { console.error('Gagal scan entry Sewing:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahSewing(p.target, p.jumlah, p.alasan);
      await muat();
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return {
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

// ============================================================================
// TAB 3.3: Perlu Dikirim — Cetak Label Pcs, Cetak Bagging+Kode Tugas, Scan
// Pack, Scan Kirim, Scan Masalah (keputusan #6/#7/#11/#12).
// ============================================================================
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

    // --- Cetak Label Pcs (keputusan #6: sekali cetak, cetak ulang baca yang
    // sudah ada, tidak addDoc baru). ------------------------------------------
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

    // --- Cetak Bagging + Kode Tugas (1 aksi gabungan, keputusan #11/#12) ----
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    async function cetakBaggingTugas(t) {
      if (!t.label_pcs_dicetak_pada) { alert('Cetak Label Pcs dulu sebelum cetak bagging + kode tugas.'); return; }
      if (t.kode_bagging && t.kode_bagging.length) { if (!confirm('Batch ini sudah pernah dicetak bagging + kode tugas. Cetak ULANG (kode baru)?')) return; }
      sedangProses.value = true;
      try {
        const kodeBag = await generateKodeHarianFormat('BAG', 'pengaturan_id_bagging');
        await addDoc(collection(db, 'bagging'), {
          kode: kodeBag, produk_label: `${t.kode_batch} &middot; ${t.nama_produk}`, isi: [], ditutup_pada: null,
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

    // --- Scan Pack: step1 kode bagging, step2 kode pcs berkali-kali ---------
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
      try { await updateDoc(doc(db, 'bagging', modalPack.bagging.id), { ditutup_pada: serverTimestamp() }); } catch (e) { console.error('Gagal tutup bagging:', e); }
      modalPack.bagging = null; modalPack.batch = null;
    }

    // --- Scan Kirim: step1 kode tugas, step2 kode bagging (1x cukup, lihat
    // keputusan #11 — satu batch = satu bagging). ----------------------------
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
      const t = daftar.value.find(x => x.kode_tugas === modalKirim.tugas.kode && (x.kode_bagging || []).includes(kode));
      if (!t) { alert(`Kode bagging "${kode}" tidak cocok dengan tugas ini.`); return; }
      try {
        await updateDoc(doc(db, 'tugas_kirim', modalKirim.tugas.id), { pack: arrayUnion({ kode_bagging: kode, pada: new Date().toISOString() }) });
        await updateSewingTrack(t.id, () => ({ status: 'sedang_dikirim', masuk_tahap_pada: new Date().toISOString() }));
        modalKirim.log.unshift(kode + ' -> ' + modalKirim.tugas.kode + ' (status pindah ke Sedang Kirim)');
        await muat();
      } catch (e) { console.error('Gagal scan kirim Sewing:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahSewing(p.target, p.jumlah, p.alasan);
      await muat();
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return {
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
    <!-- jenis-cetak dipatok 'kode_bagging' — lihat catatan sama di
         vue-pp-cutting.js (cetak gabungan bagging+tugas 1 job cetak). -->
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

// ============================================================================
// TAB 3.4: Sedang Kirim — read-only tracking, dikelompokkan per kode tugas
// (mirip CuttingSedangDiKirim), + Scan Masalah (keputusan #10).
// ============================================================================
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

// ============================================================================
// TAB 3.5: Selesai — riwayat, read-only. Baris masuk saat Serie (Tab 2.6
// Terima Sewing, SUDAH ADA) Scan Sampai dan menulis `sewing_track.status =
// 'selesai'` + `sampai_pada` (lihat keputusan #1). TIDAK KOSONG dari awal
// seperti gap Cutting/Serie — Serie SUDAH BISA menulis ini sejak modul Serie
// dibangun, jadi begitu siklus pertama selesai (Guru scan sampai di sisi
// Serie), baris akan langsung muncul di sini.
// ============================================================================
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

// --- Mount ke index.html — LAZY, SAMA pola seperti Cutting/Serie: fungsi
// window.pastikanMountSewingXxx() dipanggil oleh pindahSubTab() (js/
// dashboard.js, peta petaMount) PERTAMA KALI tab itu dibuka. ----------------
let vmSewingPerluDiProses = null;
window.pastikanMountSewingPerluDiProses = function () {
  if (vmSewingPerluDiProses) return;
  const mountPoint = document.getElementById('vue-sewing-perludiproses');
  if (mountPoint) vmSewingPerluDiProses = createApp(SewingPerluDiProses).mount('#vue-sewing-perludiproses');
};
let vmSewingSedangSewing = null;
window.pastikanMountSewingSedangSewing = function () {
  if (vmSewingSedangSewing) return;
  const mountPoint = document.getElementById('vue-sewing-sedangsewing');
  if (mountPoint) vmSewingSedangSewing = createApp(SewingSedangSewing).mount('#vue-sewing-sedangsewing');
};
let vmSewingPerluDikirim = null;
window.pastikanMountSewingPerluDikirim = function () {
  if (vmSewingPerluDikirim) return;
  const mountPoint = document.getElementById('vue-sewing-perludikirim');
  if (mountPoint) vmSewingPerluDikirim = createApp(SewingPerluDikirim).mount('#vue-sewing-perludikirim');
};
let vmSewingSedangKirim = null;
window.pastikanMountSewingSedangKirim = function () {
  if (vmSewingSedangKirim) return;
  const mountPoint = document.getElementById('vue-sewing-sedangkirim');
  if (mountPoint) vmSewingSedangKirim = createApp(SewingSedangKirim).mount('#vue-sewing-sedangkirim');
};
let vmSewingSelesai = null;
window.pastikanMountSewingSelesai = function () {
  if (vmSewingSelesai) return;
  const mountPoint = document.getElementById('vue-sewing-selesai');
  if (mountPoint) vmSewingSelesai = createApp(SewingSelesai).mount('#vue-sewing-selesai');
};
