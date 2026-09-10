// js/vue-persiapan-sewing.js
// ============================================================================
// Persiapan Produksi > Acc Sewing — menu BARU (1 Sep 2026, wireframe handoff
// "Persiapan Produksi - Acc Sewing", modul ke-3 dari paket F:\ZEVANIC HOUSE\
// FOUNDATION\Mockup\handoff\). Dikerjakan BERSAMA Acc Webbing & Acc Finishing
// dalam satu sesi atas instruksi eksplisit Guru (1 Sep 2026) — MENYIMPANG
// dari aturan "satu modul per sesi, urutan tidak boleh dibalik" yang ditulis
// README paket handoff. Guru sudah diberi tahu soal penyimpangan ini (lihat
// STATUS-PROYEK.md). Sewing dikerjakan LEBIH DULU dari Webbing/Finishing
// (paling sederhana, tanpa kolom khas) — Webbing & Finishing MENUMPANG pola
// file ini, sama seperti niat urutan asli README.
//
// Pos yang menyiapkan KOMPONEN JAHIT — zipper, buckle, D-ring, cord lock,
// elastis. Satuannya pcs.
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
// buatSpkTrackUntukGrouping()). Dokumen jalur:'sewing' punya field TAMBAHAN
// `sewing_rincian[]` (diisi function hitungSewingRincian() di file itu SAAT
// SPK Grouping diterbitkan) — SATU BARIS per (komponen aksesoris x anak
// SPK), sumber BOM-nya `master_produk.bom_aksesoris[]` disaring
// tahap_proses mengandung "sewing":
//   order_spk_id, no_spk, qty, bahan_aksesoris_id, nama_aksesoris, warna,
//   produk_size, qty_per_pcs, satuan, butuh, status, masuk_tahap_pada,
//   label_cetak_pada, operator_uid, operator_nama, ditugaskan_pada,
//   riwayat_operator[], entry_qty, entry_oleh, entry_pada, catatan_masalah,
//   kode_bagging, kode_tugas, tlc_tujuan (ditulis saat Scan Kirim, lihat Tab
//   3), sampai_pada (ditulis MODUL LAIN, lihat catatan TAB 5 di bawah).
//
// PERBEDAAN KARTU dari Bahan — PENTING: Bahan "satu kartu satu bahan+warna"
// (kartu dikumpulkan LINTAS dokumen spk_track). Pos ini SEBALIKNYA: "satu
// kartu satu SPK Grouping" (SERAH-TERIMA §2) — kartu = SATU dokumen
// spk_track itu sendiri (kode kartu berakhiran -SEW), isinya baris-baris
// komponennya. Konsekuensinya: TIDAK ada "kumulatif butuh/stok lintas
// grouping" seperti Bahan (SERAH-TERIMA Sewing tidak menyebut itu sebagai
// aturan khas) — cek stok cukup dilakukan PER BARIS independen terhadap
// stok live (lihat kelompokKartuSpk()).
//
// Label fisik: "1 SPK = 1 label" (SERAH-TERIMA §3/§5) dibaca sebagai 1 LABEL
// PER ANAK SPK (bukan per grouping) — beda dari Bahan yang per grouping,
// karena grouping di sini bisa berisi >1 anak SPK dan tiap anak SPK butuh
// label fisiknya sendiri di jalur produksi (baris-baris komponennya
// dirinci di 1 label yang sama). Kode yang di-QR-kan cuma jejak cetak
// (traceability) — yang benar-benar DISCAN BALIK di Tunjuk Operator/Scan
// Entry/Scan Pack selalu `no_spk` polos (tag fisik anak SPK yang SUDAH ADA
// dari modul "Perlu Disiapkan", pola SAMA seperti vue-persiapan-bahan.js).
//
// Satu scan pack/kirim di sini BISA menandai BEBERAPA baris komponen
// sekaligus (semua komponen milik 1 anak SPK, atau semua baris ber-
// kode_bagging sama) — beda dari Bahan yang 1 scan = 1 baris (karena kartu
// Bahan = 1 bahan, jadi 1 anak SPK cuma punya 1 baris per kartu). Makanya
// di sini ada updateBarisSewingMassal() TAMBAHAN di samping
// updateBarisSewing() (versi 1-baris, dipakai penunjukan/entry/masalah/
// ganti-operator tunggal).
//
// Koleksi bagging/tugas_kirim/master_tlc/cetak_ulang_log — SUDAH ADA di
// repo (ditambahkan modul Bahan, 31 Agt 2026), DIPAKAI ULANG APA ADANYA
// (generik lintas jalur, TIDAK perlu tambahan firestore.rules baru).
// tlc_asal pos ini = 'TLC-SEW' (sudah ada di daftar seed TLC bawaan Bahan).
//
// Print label, scan QR, kode harian, ambang tertahan, PIN cetak ulang,
// estafet operator — SEMUA pola SAMA PERSIS seperti vue-persiapan-bahan.js
// (disalin, konvensi "salin logic kecil per-file" proyek ini). Baca komentar
// besar di file itu untuk detail alasan tiap keputusan yang tidak diulang
// di sini.
// ============================================================================

import { createApp, ref, reactive, computed, watch, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel } from './vue-components.js?v=7';
import { ScanGenerik, PopupPinGenerik, buatQrDataUrl, muatJsQr, cariKaryawanByQr, ajukanPersiapanMasalah } from './vue-scan-cetak.js?v=3';

// picOwnerKeAtas — REVISI 8 Sep 2026 (keputusan Guru, audit kode). Aksi
// "Tunjuk Operator" WAJIB akun PIC ke atas (pic/pic_owner/owner/superuser)
// — TANPA popup PIN, cukup akun yang login memang tier itu. Pola SAMA
// dengan picOwnerKeAtas() di vue-pp-cutting.js/vue-pp-sewing.js/
// vue-pp-finishing.js/vue-pp-serie.js (Proses Produksi).
function picOwnerKeAtas(userData) {
  if (!userData) return false;
  const role = (userData.role || '').toLowerCase();
  return role === 'owner' || role === 'superuser' || role === 'pic';
}

// --- Konfigurasi khas pos ini (SATU-SATUNYA tempat yang beda antara file
// Sewing/Webbing/Finishing untuk bagian generik — field tambahan khas
// masing-masing pos ditangani terpisah di komponennya sendiri). -----------
const JALUR = 'sewing';
const FIELD_RINCIAN = 'sewing_rincian';
const SUFFIX_LABEL = 'SEW';
const TLC_ASAL = 'TLC-SEW';
const MENU_ID = 'pp_sewing';
const ICON_KOSONG = 'fa-scissors';

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

// buatQrDataUrl/muatJsQr/cariKaryawanByQr DIPINDAH jadi fungsi generik
// di js/vue-scan-cetak.js (refactor 7 Sep 2026) — sekarang diimpor,
// bukan disalin lagi. Logic TIDAK berubah.
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
async function muatSemuaTrackSewing() {
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

// updateBarisSewing — read-modify-write ATOMIK 1 baris (dipilih lewat
// index), SAMA pola seperti updateBarisBahan() di vue-persiapan-bahan.js.
// Dipakai aksi yang menyentuh SATU baris komponen (Tunjuk 1-per-1 kalau
// sudah dipisah, entry, masalah, ganti operator).
async function updateBarisSewing(trackId, lineIdx, patchFn) {
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
// updateBarisSewingMassal — BARU (beda dari Bahan): patch SEMUA elemen
// array yang lolos matchFn() dalam SATU transaksi. Diperlukan karena "1
// kartu = 1 SPK Grouping" (bukan 1 kartu = 1 bahan+warna macam Bahan): 1
// scan Tunjuk/Pack/Kirim di sini bisa menandai BEBERAPA baris komponen
// sekaligus (semua komponen milik 1 anak SPK, atau semua baris ber-
// kode_bagging sama) — SATU dokumen, banyak baris kena sekaligus.
async function updateBarisSewingMassal(trackId, matchFn, patchFn) {
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
// DIPERBAIKI (7 Sep 2026, task #94 "gerbang batch", keputusan Guru: "ubah
// jadi gerbang per-SPK sesuai wireframe") — dulu baris LANGSUNG pindah
// 'perlu_dikirim' begitu di-entry sendiri-sendiri (penyederhanaan awal).
// SEKARANG status TETAP 'sedang_disiapkan' sesudah entry — baris baru
// benar-benar pindah tahap lewat konfirmasiDisiapkan() (batch SEMUA baris
// 1 SPK Grouping/trackId sekaligus), lihat komponen Tab 2 di bawah.
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
// lintas kartu (SERAH-TERIMA Sewing tidak menyebut "kumulatif" sebagai
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

// Komponen kamera fullscreen (dulu bernama lokal ModalScanQr, disalin
// identik di 4 file Persiapan Produksi) sekarang jadi ScanGenerik di
// js/vue-scan-cetak.js — genuinely diimpor, interface & perilaku PERSIS
// SAMA, tidak disalin lagi (refactor 7 Sep 2026).

// ============================================================================
// RETROFIT 9 Sep 2026 (audit wireframe vs kode live, Guru sudah setuju
// termasuk alur) — pola & alasan PERSIS SAMA seperti blok sejenis di
// vue-persiapan-bahan.js (baca komentar besar di sana untuk detail
// lengkap, tidak diulang di sini) — disalin, TIDAK diimpor silang.
// Beda Sewing dari Bahan yang relevan di sini: grid Tab 1 SUDAH 1 kolom
// dari awal (flex-direction:column, dicek ke wireframe Acc Sewing —
// SESUAI, tidak perlu diubah), dan Tab 1 dapat TAMBAHAN 4 kotak KPI (SPK
// menunggu/baris komponen/stok kurang/siap dicetak — wireframe baris
// ~155-158) yang TIDAK ada di Bahan. Bar ringkasan sticky + cetak massal
// (temuan #5 Bahan) SENGAJA TIDAK disalin ke sini — dicek ke wireframe
// Acc Sewing, tidak ada bar/tombol cetak-massal lintas kartu di sana
// (checkbox di baris komponen cuma indikator "stoknya ada", bukan seleksi
// cetak; cetaknya "1 SPK = 1 label" per kartu, sudah ada).
// ============================================================================
const TAB_DEFS_SEWING = [
  { target: 'sub-pp-sewing-perludisiapkan', icon: 'fa-inbox', label: 'Perlu Disiapkan' },
  { target: 'sub-pp-sewing-sedangdisiapkan', icon: 'fa-gears', label: 'Sedang Disiapkan' },
  { target: 'sub-pp-sewing-perludikirim', icon: 'fa-box-open', label: 'Perlu Di Kirim' },
  { target: 'sub-pp-sewing-sedangdikirim', icon: 'fa-truck-fast', label: 'Sedang Di Kirim' },
  { target: 'sub-pp-sewing-selesai', icon: 'fa-circle-check', label: 'Selesai' }
];
function sembunyikanBarisTabAsli(grupKelas) {
  const contoh = document.querySelector('.' + grupKelas + '-btn');
  const baris = contoh ? contoh.parentElement : null;
  if (baris && baris.dataset.gcCardHeadHide !== '1') {
    baris.style.display = 'none';
    baris.dataset.gcCardHeadHide = '1';
  }
}
function gantiTabPill(grupKelas, targetId, ev) {
  if (window.pindahSubTab) window.pindahSubTab(grupKelas, targetId, (ev && ev.currentTarget) || null, { catatRiwayat: true });
}
// ============================================================================
// TAB 1: Perlu Disiapkan (langkah wireframe 1a -> 1b -> 1c)
// Kartu per SPK Grouping (bukan per bahan seperti Bahan). 1a: cek stok per
// baris + centang baris yang bisa jalan + cetak label (1 label per anak
// SPK). 1b: badge "sudah dicetak" + cetak ulang (PIN+alasan). 1c: penunjukan
// (scan operator + scan berkali-kali label anak SPK — 1 scan anak SPK
// menandai SEMUA baris komponen anak SPK itu sekaligus).
// ============================================================================
const PersiapanSewingPerluDisiapkan = {
  components: { PopupPratinjauCetakLabel, ScanGenerik, PopupPinGenerik },
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const petaStokBahan = ref({});
    const cari = ref('');
    const pilihanCetak = reactive({}); // barisKey -> bool (override manual)

    const MY_TARGET = 'sub-pp-sewing-perludisiapkan';
    // REVISI 8 Sep 2026 (keputusan Guru, audit kode) — satu-satunya
    // pemakai bolehProses di komponen ini adalah tombol "Tunjuk Operator",
    // jadi digerbang langsung PIC ke atas di sini.
    const bolehProses = computed(() => picOwnerKeAtas(window.currentUser) && window.cekIzinMenu(MENU_ID, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(MENU_ID, 'print') !== false);
    // bolehEdit — RETROFIT 9 Sep 2026, gerbang tombol "Scan Sampai" global
    // (lihat catatan sama di vue-persiapan-bahan.js).
    const bolehEdit = computed(() => window.cekIzinMenu(MENU_ID, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const [tracks, stokSnap] = await Promise.all([
          muatSemuaTrackSewing(),
          getDocs(collection(db, 'master_bahan_aksesoris'))
        ]);
        daftarTrack.value = tracks;
        const peta = {}; stokSnap.forEach(d => { peta[d.id] = d.data(); });
        petaStokBahan.value = peta;
      } catch (e) {
        console.error('Gagal muat Acc Sewing > Perlu Disiapkan:', e);
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

    // kpiHeader — RETROFIT 9 Sep 2026 (temuan #6, KHUSUS Acc Sewing/Webbing/
    // Finishing): 4 kotak KPI persis wireframe baris ~155-158 ("SPK
    // menunggu / baris komponen / stok kurang / siap dicetak").
    const kpiHeader = computed(() => {
      let barisKomponen = 0, stokKurang = 0, siapDicetak = 0;
      kartuList.value.forEach(k => {
        barisKomponen += k.baris.length;
        stokKurang += k.baris.filter(b => !b._bisa).length;
        if (!k.adaKurang) siapDicetak++;
      });
      return { spkMenunggu: kartuList.value.length, barisKomponen, stokKurang, siapDicetak };
    });

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
      // FIX (10 Sep 2026, keputusan Guru — "kode yang tampil pas cetak label
      // harusnya kode SPK Grouping, biar sama kayak Bahan") — kode BESAR di
      // label sekarang `kode_spk` (SAMA pola seperti vue-persiapan-bahan.js).
      // QR & matching TETAP pakai noSpk (unik per anak SPK, TIDAK diubah) —
      // hasilScanAksi()/onCetakSelesai() di bawah match by no_spk, mengubah
      // itu beresiko scan salah baris kalau 1 grouping isi >1 anak SPK. Info
      // dikasih noSpk di depan supaya anak SPK-nya tetap kelihatan di label.
      const preview = Object.entries(perAnak).map(([noSpk, barisGrup]) => ({
        kode: barisGrup[0].kode_spk,
        nama: k.namaProduk,
        info: `${noSpk} &middot; ` + barisGrup.map(b => `${b.nama_aksesoris} ${b.warna} &middot; ${formatQty(b.butuh)} ${b.satuan}`).join(' | '),
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
        // 1 dokumen) — cukup 1 updateBarisSewingMassal per kartu, bukan N
        // transaksi terpisah per baris.
        const byTrack = {};
        _pendingCetak.forEach(b => { (byTrack[b._trackId] ||= []).push(b); });
        // DIPERBAIKI (9 Sep 2026 malam) — matchFn lama `(b, i) => idxSet.has(i)`
        // TIDAK PERNAH benar: updateBarisSewingMassal cuma memanggil
        // matchFn(arr[i]) TANPA index kedua, jadi `i` selalu undefined dan
        // baris TIDAK PERNAH tertandai (gagal diam-diam, sama pola bug
        // "Tunjuk Operator" yang sudah diperbaiki lanjutan 9). Diganti
        // matching by value (no_spk) — semua baris 1 anak SPK memang
        // dicetak/ditandai bersamaan, jadi cocok secara semantik juga.
        await Promise.all(Object.entries(byTrack).map(([trackId, barisGrup]) => {
          const noSpkSet = new Set(barisGrup.map(b => b.no_spk));
          return updateBarisSewingMassal(trackId, (x) => noSpkSet.has(x.no_spk), () => ({ label_cetak_pada: now }));
        }));
      } catch (e) { console.error('Gagal catat label_cetak_pada:', e); }
      _pendingCetak = [];
      await muat();
    }

    // --- Cetak ulang (alasan + PIN diverifikasi kriptografis, dicatat
    // cetak_ulang_log). DIPERBAIKI (7 Sep 2026, task #94 "4 gap kekurangan")
    // — dulu PIN cuma teks bebas tanpa verifikasi (infra belum ada saat modul
    // ini ditulis). Sekarang pakai `PopupPinGenerik` (js/vue-scan-cetak.js,
    // rolesDiizinkan=null = semua admin-level), SESUAI SPESIFIKASI-KOLEKSI-
    // BARU.md §4 poin 3 ("PIN siapa pun diterima, yang dicatat = pemilik
    // PIN") — sama pola vue-persiapan-bahan.js. ---
    const popupCetakUlang = ref(null); // { kartu, alasan }
    const pinCetakUlangAktif = ref(false);
    function bukaCetakUlang(k) {
      if (!k.baris.some(b => b.label_cetak_pada)) return;
      popupCetakUlang.value = { kartu: k, alasan: '' };
    }
    function lanjutCetakUlang() {
      const p = popupCetakUlang.value;
      if (!p) return;
      if (!p.alasan.trim()) { alert('Alasan cetak ulang wajib diisi.'); return; }
      pinCetakUlangAktif.value = true;
    }
    function batalPinCetakUlang() { pinCetakUlangAktif.value = false; }
    async function pinCetakUlangSukses(user) {
      pinCetakUlangAktif.value = false;
      const p = popupCetakUlang.value;
      if (!p) return;
      const sudahDicetak = p.kartu.baris.filter(b => b.label_cetak_pada);
      const perAnak = {};
      sudahDicetak.forEach(b => { (perAnak[b.no_spk] ||= []).push(b); });
      // FIX (10 Sep 2026) — sama seperti cetakLabelKartu() di atas: kode
      // besar = kode_spk, QR tetap noSpk (tidak diubah).
      const preview = Object.entries(perAnak).map(([noSpk, barisGrup]) => ({
        kode: barisGrup[0].kode_spk, nama: p.kartu.namaProduk,
        info: `CETAK ULANG &middot; ${noSpk} &middot; ` + barisGrup.map(b => `${b.nama_aksesoris} ${b.warna}`).join(' | '),
        qrDataUrl: buatQrDataUrl(`${noSpk}-${SUFFIX_LABEL}`)
      }));
      try {
        await addDoc(collection(db, 'cetak_ulang_log'), {
          kode_spk: p.kartu.kodeSpk,
          bahan: p.kartu.namaProduk,
          alasan: p.alasan.trim(), pin_oleh: user.nama || user.email || '',
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
    const modalTunjuk = reactive({ aktif: false, kartu: null, global: false, operator: null, tahap: 'operator', log: [] });
    function bukaPenunjukan(k) {
      const eligible = k.baris.filter(b => b.label_cetak_pada && b.status === 'perlu_disiapkan');
      if (!eligible.length) { alert('Belum ada baris yang sudah dicetak labelnya di kartu ini.'); return; }
      modalTunjuk.kartu = k; modalTunjuk.global = false; modalTunjuk.operator = null; modalTunjuk.tahap = 'operator'; modalTunjuk.log = [];
      modalTunjuk.aktif = true;
    }
    // bukaPenunjukanGlobal — RETROFIT 9 Sep 2026 (temuan #1), lihat catatan
    // sama di vue-persiapan-bahan.js. Tombol per-kartu TETAP DIPERTAHANKAN.
    function bukaPenunjukanGlobal() {
      const eligible = kartuList.value.some(k => k.baris.some(b => b.label_cetak_pada && b.status === 'perlu_disiapkan'));
      if (!eligible) { alert('Belum ada baris yang sudah dicetak labelnya di tab ini.'); return; }
      modalTunjuk.kartu = null; modalTunjuk.global = true; modalTunjuk.operator = null; modalTunjuk.tahap = 'operator'; modalTunjuk.log = [];
      modalTunjuk.aktif = true;
    }
    function tutupPenunjukan() { modalTunjuk.aktif = false; modalTunjuk.kartu = null; modalTunjuk.global = false; modalTunjuk.operator = null; modalTunjuk.log = []; }
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
      // Mode global: cari DI SEMUA kartu; mode per-kartu: cari DI KARTU ITU
      // SAJA (perilaku lama, tidak berubah).
      const kolamBaris = modalTunjuk.global ? kartuList.value.flatMap(k => k.baris) : (modalTunjuk.kartu?.baris || []);
      const cocok = kolamBaris.filter(b => b.no_spk === kode && b.label_cetak_pada && b.status === 'perlu_disiapkan');
      if (!cocok.length) {
        // FIX (10 Sep 2026, laporan Guru — masih salah tunjuk setelah fix
        // dedup kamera) — akar SEBENARNYA: user scan ULANG badge operator
        // di tahap "anak" (kira harus scan badge lagi), bukan scan label
        // SPK yang tercetak. Pesan lama tidak bilang itu badge operator,
        // jadi kelihatan seperti bug padahal salah scan target. Sekarang
        // dicek eksplisit: kalau kode yang gagal cocok itu TERNYATA id_app
        // karyawan, kasih pesan yang jelas nunjuk masalahnya.
        const karyawanTerbaca = await cariKaryawanByQr(kode);
        if (karyawanTerbaca) {
          alert(`Kode "${kode}" itu badge OPERATOR (${karyawanTerbaca.nama || karyawanTerbaca.name || kode}), BUKAN label SPK. Scan LABEL SPK anak yang sudah dicetak (bukan badge operator lagi).`);
          return;
        }
        alert(`Kode "${kode}" tidak cocok baris manapun yang sudah dicetak labelnya (mungkin belum dicetak, atau sudah ditunjuk).`);
        return;
      }
      const now = new Date().toISOString();
      const trackId = cocok[0]._trackId;
      // CATATAN BUG (ditemukan 9 Sep 2026 saat generalisasi ke mode global,
      // DIPERBAIKI DI SINI): pola lama di seluruh file ini
      // ("updateBarisSewingMassal(trackId, (b, i) => idxSet.has(i), ...)")
      // TIDAK PERNAH cocok — matchFn dipanggil dengan SATU argumen saja
      // (lihat definisi updateBarisSewingMassal di atas, matchFn(arr[i])),
      // jadi parameter kedua "i" selalu undefined dan idxSet.has(i) selalu
      // false -> tulisan Firestore GAGAL DIAM-DIAM (kena===0). Fungsi INI
      // sekarang cocok LEWAT NILAI (no_spk+status+label_cetak_pada) — tidak
      // butuh index sama sekali. Pola idxSet yang SAMA masih ada di
      // onCetakSelesai()/hasilScanPack()/hasilScanKirim() pada file ini
      // (di luar cakupan sesi ini, TIDAK disentuh) — dicatat sebagai gap
      // ke CHECKLIST-TEST.md, bukan diperbaiki diam-diam di luar delta.
      try {
        await updateBarisSewingMassal(trackId, (x) => x.no_spk === kode && x.status === 'perlu_disiapkan' && !!x.label_cetak_pada, (lama) => ({
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

    // --- Scan Sampai GLOBAL (temuan #1) — lihat komentar besar sama di
    // vue-persiapan-bahan.js untuk ASUMSI lengkap: konservatif, cuma
    // membersihkan catatan_masalah baris yang kode_bagging-nya cocok, TIDAK
    // menulis balik koleksi persiapan_masalah. ---
    const modalScanSampai = reactive({ aktif: false, log: [] });
    function bukaScanSampaiGlobal() { modalScanSampai.log = []; modalScanSampai.aktif = true; }
    function tutupScanSampai() { modalScanSampai.aktif = false; modalScanSampai.log = []; muat(); }
    async function hasilScanSampai(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      if (!kode) return;
      const semuaBaris = daftarBarisDariTrack(daftarTrack.value);
      const cocok = semuaBaris.filter(b => b.kode_bagging === kode && b.catatan_masalah);
      if (!cocok.length) { alert(`Kode "${kode}" tidak ditemukan di antara baris yang sedang menunggu kiriman balik Masalah.`); return; }
      try {
        const trackIdSet = new Set(cocok.map(b => b._trackId));
        await Promise.all([...trackIdSet].map(trackId => updateBarisSewingMassal(trackId, (x) => x.kode_bagging === kode && !!x.catatan_masalah, () => ({ catatan_masalah: '' }))));
        modalScanSampai.log.unshift(`${kode} → ${cocok.length} baris diterima kembali`);
        await muat();
      } catch (e) { console.error('Gagal scan sampai:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-sewing-tahap'); await window.authReady; await muat(); });

    return {
      memuat, kartuList, cari, isChecked, toggleCheck,
      bolehProses, bolehCetak, bolehEdit, formatQty, formatWaktu, ICON_KOSONG,
      // FIX (10 Sep 2026, laporan Guru "Acc Sewing stuck Memuat...") — templat
      // di bawah pakai `barisKey(b)` sebagai :key v-for (baris 653-an), tapi
      // fungsinya lupa diikutkan di return setup() ini. Selama kartuList
      // kosong ini tidak kelihatan (baris k.baris tidak pernah dirender) —
      // begitu ada data sungguhan, Vue coba panggil `_ctx.barisKey` yang
      // undefined -> "TypeError: barisKey is not a function" -> render
      // crash -> Vue TAHAN vnode LAMA (yang masih nampilkan "Memuat...") di
      // layar selamanya, tanpa pesan error yang kelihatan user.
      barisKey,
      TAB_DEFS_SEWING, gantiTabPill, MY_TARGET, kpiHeader,
      popupCetakAktif, daftarLabelPreview, cetakLabelKartu, onCetakSelesai,
      popupCetakUlang, bukaCetakUlang, lanjutCetakUlang, pinCetakUlangAktif, pinCetakUlangSukses, batalPinCetakUlang,
      modalTunjuk, bukaPenunjukan, bukaPenunjukanGlobal, tutupPenunjukan, hasilScanTunjuk, selesaiPenunjukan,
      modalScanSampai, bukaScanSampaiGlobal, tutupScanSampai, hasilScanSampai
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Acc Sewing</h3>
          <div class="sub">{{ kpiHeader.spkMenunggu }} SPK menunggu &middot; {{ kpiHeader.siapDicetak }} siap dicetak</div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button v-if="bolehEdit" @click="bukaScanSampaiGlobal" class="btn-outline" style="padding:8px 14px;"><i class="fas fa-inbox" style="margin-right:6px;"></i>Scan Sampai</button>
          <button v-if="bolehProses" @click="bukaPenunjukanGlobal" class="btn-primary" style="padding:8px 14px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Operator</button>
        </div>
      </div>

      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_SEWING" :key="t.target" type="button"
          :class="['sub-pp-sewing-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-sewing-tahap', t.target, $event)">
          <i :class="'fas ' + t.icon" style="margin-right:6px;"></i>{{ t.label }}
        </button>
      </div>

      <!-- RETROFIT 9 Sep 2026 (temuan #6) — 4 kotak KPI, wireframe ~155-158. -->
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px;">
        <div style="flex:1; min-width:110px; border:1px dashed var(--line); border-radius:12px; padding:8px 10px; background:var(--ivory-dim);">
          <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">SPK menunggu</div>
          <div class="gc-num" style="font-size:16px; font-weight:700;">{{ kpiHeader.spkMenunggu }}</div>
        </div>
        <div style="flex:1; min-width:110px; border:1px dashed var(--line); border-radius:12px; padding:8px 10px; background:var(--ivory-dim);">
          <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Baris komponen</div>
          <div class="gc-num" style="font-size:16px; font-weight:700;">{{ kpiHeader.barisKomponen }}</div>
        </div>
        <div style="flex:1; min-width:110px; border:1px dashed var(--line); border-radius:12px; padding:8px 10px;" :style="{ background: kpiHeader.stokKurang ? 'var(--warn-light)' : 'var(--ivory-dim)' }">
          <div style="font-size:9.5px; text-transform:uppercase; letter-spacing:.04em;" :style="{ color: kpiHeader.stokKurang ? 'var(--warn)' : 'var(--text-faint)' }">Stok kurang</div>
          <div class="gc-num" :style="{ fontSize:'16px', fontWeight:700, color: kpiHeader.stokKurang ? 'var(--warn)' : 'inherit' }">{{ kpiHeader.stokKurang }}</div>
        </div>
        <div style="flex:1; min-width:110px; border:1px dashed var(--line); border-radius:12px; padding:8px 10px; background:var(--ivory-dim);">
          <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Siap dicetak</div>
          <div class="gc-num" style="font-size:16px; font-weight:700;">{{ kpiHeader.siapDicetak }}</div>
        </div>
      </div>

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
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
            <div style="min-width:0;">
              <div class="gc-heading gc-num" style="font-weight:700; font-size:13.5px;">{{ k.kodeSpk }}</div>
              <div style="font-size:11px; color:var(--text-faint); margin-top:2px;">{{ k.namaProduk }} &middot; size {{ k.produkSize || '-' }} &middot; {{ k.baris.length }} komponen</div>
            </div>
            <span v-if="k.adaKurang" class="tag warn" style="flex-shrink:0;">ada stok kurang</span>
            <span v-else class="tag ok" style="flex-shrink:0;">stok cukup</span>
          </div>

          <!-- RETROFIT 9 Sep 2026 (temuan #4) — tabel 7 kolom SELALU
               TERBUKA, collapse "buka rincian" dihapus. -->
          <div style="display:flex; gap:8px; padding:0 7px 5px; font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.03em;">
            <span style="flex:1;">aksesoris</span>
            <span style="width:55px; text-align:right;">butuh</span>
            <span style="width:55px; text-align:right;">stok</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
            <label v-for="b in k.baris" :key="barisKey(b)" style="display:flex; align-items:center; gap:8px; font-size:11px; padding:6px 8px; border-radius:10px; flex-wrap:wrap;" :style="{ background: b.label_cetak_pada ? 'var(--ok-light)' : (b._bisa ? 'transparent' : 'var(--danger-light)') }">
              <input type="checkbox" :checked="isChecked(b)" :disabled="!b._bisa || !!b.label_cetak_pada" @change="toggleCheck(b)">
              <span style="flex:1; min-width:120px;">{{ b.nama_aksesoris }} <span style="color:var(--text-faint);">{{ b.warna }}</span> <span class="gc-num" style="color:var(--text-faint); font-size:10px;">{{ b.no_spk }}</span></span>
              <span class="gc-num" style="width:55px; text-align:right; color:var(--text-faint);">{{ formatQty(b.butuh) }} {{ b.satuan }}</span>
              <span class="gc-num" style="width:55px; text-align:right; color:var(--text-faint);">{{ formatQty(b._stok) }}</span>
              <span v-if="b.label_cetak_pada" class="tag ok" style="margin-left:6px;">sudah dicetak</span>
              <span v-else-if="!b._bisa" class="tag warn" style="margin-left:6px;">stok kurang</span>
            </label>
          </div>

          <div v-if="bolehCetak" style="display:flex; gap:8px; border-top:1px solid var(--line); padding-top:10px;">
            <button @click="cetakLabelKartu(k)" class="btn-outline" style="flex:1; padding:9px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Label</button>
            <button v-if="k.baris.some(b=>b.label_cetak_pada)" @click="bukaCetakUlang(k)" class="btn-outline" style="flex:1; padding:9px; color:var(--warn); border-color:var(--warn);"><i class="fas fa-rotate" style="margin-right:6px;"></i>Cetak Ulang</button>
            <button v-if="bolehProses && k.baris.some(b=>b.label_cetak_pada && b.status==='perlu_disiapkan')" @click="bukaPenunjukan(k)" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Tunjuk Operator</button>
          </div>
        </div>
      </div>
    </div>

    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Label Anak SPK" :daftar-label="daftarLabelPreview" jenis-cetak="label_spk_acc_sewing" @tutup="popupCetakAktif = false" @cetak="onCetakSelesai" />

    <scan-generik :aktif="modalScanSampai.aktif" judul="Scan Sampai — kode bagging balik dari Masalah" subjudul="Bisa discan berkali-kali." @hasil="hasilScanSampai" @tutup="tutupScanSampai" />
    <div v-if="modalScanSampai.aktif && modalScanSampai.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:260px;">
      <div v-for="(l,i) in modalScanSampai.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>

    <div v-if="popupCetakUlang" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;"><i class="fas fa-rotate" style="margin-right:8px; color:var(--warn);"></i>Cetak Ulang Label</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0 0 10px;">{{ popupCetakUlang.kartu.kodeSpk }} — dicatat di riwayat cetak ulang.</p>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupCetakUlang.alasan" type="text" placeholder="Mis. label rusak/hilang"></div>
        <div style="display:flex; gap:8px;">
          <button @click="popupCetakUlang = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="lanjutCetakUlang" class="btn-primary" style="flex:1; padding:9px;">Lanjut Verifikasi PIN</button>
        </div>
      </div>
    </div>
    <popup-pin-generik v-if="pinCetakUlangAktif" judul="Verifikasi PIN — Cetak Ulang Label" konteks="Acc Sewing - Cetak Ulang Label" @sukses="pinCetakUlangSukses" @batal="batalPinCetakUlang" />

    <scan-generik :aktif="modalTunjuk.aktif"
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
//
// DIPERBARUI (7 Sep 2026, retrofit lanjutan §5.18) — Scan Masalah SEKARANG
// juga membuat dokumen `persiapan_masalah` (via ajukanPersiapanMasalah(),
// js/vue-scan-cetak.js) lewat popup jumlah kurang + alasan, SAMA persis
// pola vue-persiapan-bahan.js Tab 2 (lihat komentar besar di sana untuk
// detail) — tlc_asal='TLC-SEW', sumber_jalur='sewing'.
//
// DIPERBAIKI LAGI (7 Sep 2026, task #94 "gerbang batch" — keputusan Guru:
// "ubah jadi gerbang per-SPK sesuai wireframe"): dulu Scan Entry per baris
// LANGSUNG memindahkan baris itu sendiri ke Perlu Dikirim (penyederhanaan
// awal). SEKARANG baris per operator dikelompokkan LAGI per SPK Grouping
// (`_trackId`), Scan Entry cuma menandai baris `entry_qty` tanpa pindah
// status, dan baru pindah SEMUA baris SPK itu sekaligus ke Perlu Dikirim
// lewat tombol "Disiapkan" per kelompok SPK — aktif hanya kalau SEMUA baris
// SPK itu (lintas seluruh trackId) sudah minimal masuk sedang_disiapkan DAN
// semua yang sedang_disiapkan sudah ber-entry_qty (SERAH-TERIMA §8
// uji-terima #5, sama pola vue-persiapan-webbing.js).
// ============================================================================
const PersiapanSewingSedangDisiapkan = {
  components: { ScanGenerik },
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const sedangProses = reactive({});
    const sedangProsesBatch = reactive({});
    const MY_TARGET = 'sub-pp-sewing-sedangdisiapkan';
    const bolehProses = computed(() => window.cekIzinMenu(MENU_ID, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try { daftarTrack.value = await muatSemuaTrackSewing(); }
      catch (e) { console.error('Gagal muat Acc Sewing > Sedang Disiapkan:', e); daftarTrack.value = []; }
      memuat.value = false;
    }

    const kelompokOperator = computed(() => {
      const semuaBaris = daftarBarisDariTrack(daftarTrack.value); // SEMUA status, perlu utk cek gerbang lengkap per SPK
      const petaTrack = {};
      semuaBaris.forEach(b => { (petaTrack[b._trackId] ||= []).push(b); });
      function siapBatch(trackId) {
        const semua = petaTrack[trackId] || [];
        if (semua.some(x => x.status === 'perlu_disiapkan')) return false;
        return semua.filter(x => x.status === 'sedang_disiapkan').every(x => x.entry_qty || x.entry_qty === 0);
      }
      const baris = semuaBaris.filter(b => b.status === 'sedang_disiapkan');
      const peta = {};
      baris.forEach(b => {
        const key = b.operator_uid || b.operator_nama || '-';
        if (!peta[key]) peta[key] = { operatorNama: b.operator_nama || '(tanpa nama)', kelompokSpk: {} };
        const spkKey = b._trackId;
        if (!peta[key].kelompokSpk[spkKey]) peta[key].kelompokSpk[spkKey] = { trackId: spkKey, kodeSpk: b.kode_spk, baris: [] };
        peta[key].kelompokSpk[spkKey].baris.push(b);
      });
      return Object.values(peta).map(op => {
        const kelompokSpk = Object.values(op.kelompokSpk).map(g => ({ ...g, siap: siapBatch(g.trackId) }));
        kelompokSpk.sort((a, b) => b.baris.length - a.baris.length);
        return { operatorNama: op.operatorNama, kelompokSpk, totalBaris: kelompokSpk.reduce((s, g) => s + g.baris.length, 0) };
      }).sort((a, b) => b.totalBaris - a.totalBaris);
    });

    async function konfirmasiDisiapkan(g) {
      if (!g.siap || sedangProsesBatch[g.trackId]) return;
      sedangProsesBatch[g.trackId] = true;
      try {
        const now = new Date().toISOString();
        await updateBarisSewingMassal(g.trackId, (x) => x.status === 'sedang_disiapkan', () => ({ status: 'perlu_dikirim', masuk_tahap_pada: now }));
        await muat();
      } catch (e) { console.error('Gagal memindahkan batch Disiapkan:', e); alert('Gagal menyimpan. Coba lagi.'); }
      sedangProsesBatch[g.trackId] = false;
    }

    const modalAksi = reactive({ aktif: false, mode: null, baris: null }); // 'entry' | 'masalah' | 'ganti'
    function bukaAksi(mode, b) {
      if (sedangProses[barisKey(b)]) return;
      modalAksi.mode = mode; modalAksi.baris = b; modalAksi.aktif = true;
    }
    function tutupAksi() { modalAksi.aktif = false; modalAksi.mode = null; modalAksi.baris = null; }

    // --- Popup "jumlah kurang" + alasan (retrofit §5.18 lanjutan) ---
    const popupMasalah = ref(null); // { baris, jumlahKurang, alasan }
    function batalMasalah() { popupMasalah.value = null; }
    async function konfirmasiMasalah() {
      const p = popupMasalah.value;
      if (!p) return;
      const jumlah = parseFloat(p.jumlahKurang);
      if (!(jumlah > 0)) { alert('Jumlah kurang wajib diisi angka lebih dari 0.'); return; }
      if (!p.alasan.trim()) { alert('Alasan wajib diisi.'); return; }
      const b = p.baris;
      const key = barisKey(b);
      sedangProses[key] = true;
      try {
        const kebutuhan = parseFloat(b.butuh) || 0;
        await updateBarisSewing(b._trackId, b._lineIdx, () => ({ catatan_masalah: p.alasan.trim() }));
        await ajukanPersiapanMasalah({
          tlcAsal: 'TLC-SEW', sumberJalur: 'sewing',
          trackId: b._trackId, lineIdx: b._lineIdx,
          bahanAksesorisId: b.bahan_aksesoris_id, bahanNama: b.nama_aksesoris, bahanWarna: b.warna,
          satuan: b.satuan, noSpk: b.no_spk,
          qtyKurang: jumlah, qtyEntryAsal: Math.max(0, kebutuhan - jumlah),
          alasan: p.alasan.trim()
        });
        popupMasalah.value = null;
        await muat();
      } catch (e) { console.error('Gagal mengajukan masalah:', e); alert('Gagal menyimpan. Coba lagi.'); }
      sedangProses[key] = false;
    }

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
          await updateBarisSewing(b._trackId, b._lineIdx, (lama) => ({
            operator_uid: karyawan.id, operator_nama: karyawan.nama || karyawan.name || karyawan.id, ditugaskan_pada: now,
            riwayat_operator: [...(lama.riwayat_operator || []), { operator_uid: karyawan.id, operator_nama: karyawan.nama || karyawan.name || karyawan.id, mulai_pada: now }]
          }));
          tutupAksi(); await muat();
        } catch (e) { console.error('Gagal ganti operator:', e); alert('Gagal menyimpan. Coba lagi.'); }
        sedangProses[key] = false;
        return;
      }
      if (kode !== b.no_spk) { alert(`Kode yang discan ("${kode}") tidak cocok dengan anak SPK ini (${b.no_spk}).`); return; }
      if (modalAksi.mode === 'masalah') {
        tutupAksi();
        popupMasalah.value = { baris: b, jumlahKurang: b.butuh, alasan: '' };
        return;
      }
      const key = barisKey(b); sedangProses[key] = true;
      try {
        if (modalAksi.mode === 'entry') {
          await konfirmasiEntry(b);
        }
        tutupAksi(); await muat();
      } catch (e) { console.error('Gagal proses scan:', modalAksi.mode, e); alert('Gagal memproses. Coba lagi.'); }
      sedangProses[key] = false;
    }

    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-sewing-tahap'); await window.authReady; await muat(); });

    return {
      memuat, kelompokOperator, bolehProses, sedangProses, sedangProsesBatch, konfirmasiDisiapkan,
      formatQty, formatDiamSejak, tertahan, barisKey,
      modalAksi, bukaAksi, tutupAksi, hasilScanAksi,
      popupMasalah, batalMasalah, konfirmasiMasalah,
      TAB_DEFS_SEWING, gantiTabPill, MY_TARGET
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Acc Sewing</h3>
          <div class="sub">{{ kelompokOperator.length }} operator sedang menyiapkan</div>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_SEWING" :key="t.target" type="button"
          :class="['sub-pp-sewing-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-sewing-tahap', t.target, $event)">
          <i :class="'fas ' + t.icon" style="margin-right:6px;"></i>{{ t.label }}
        </button>
      </div>

    <div v-if="kelompokOperator.length === 0" class="gc-kosong gc-card">
      <div class="lingkaran"><i class="fas fa-gears"></i></div>
      <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang sedang disiapkan</h3>
    </div>

    <div v-else style="display:flex; flex-direction:column; gap:10px;">
      <div v-for="op in kelompokOperator" :key="op.operatorNama" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
          <i class="fas fa-user" style="color:var(--aksen-ink);"></i>
          <span class="gc-heading" style="font-weight:700; font-size:13px;">{{ op.operatorNama }}</span>
          <span class="tag pink" style="margin-left:auto;">{{ op.totalBaris }} baris</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div v-for="g in op.kelompokSpk" :key="g.trackId" style="border:1px solid var(--line); border-radius:14px; padding:10px;" :style="{ background: g.siap ? 'var(--ok-light)' : 'transparent' }">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
              <span class="gc-num" style="font-weight:700; font-size:12px;">{{ g.kodeSpk }}</span>
              <span class="tag" :class="g.siap ? 'ok' : 'neutral'">{{ g.siap ? 'siap Disiapkan' : (g.baris.filter(b => b.entry_qty || b.entry_qty===0).length + '/' + g.baris.length + ' entry') }}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;">
              <div v-for="b in g.baris" :key="barisKey(b)" style="border:1px solid var(--line); border-radius:12px; padding:8px;" :style="{ background: tertahan(b.masuk_tahap_pada) ? 'var(--warn-light)' : 'transparent' }">
                <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:4px;">
                  <span class="gc-num" style="font-weight:700; font-size:11.5px;">{{ b.no_spk }}</span>
                  <span v-if="b.entry_qty || b.entry_qty===0" class="tag ok">sudah entry</span>
                  <span v-else class="tag" :class="tertahan(b.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(b.masuk_tahap_pada) }}</span>
                </div>
                <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:6px;">{{ b.nama_aksesoris }} {{ b.warna }} &middot; {{ formatQty(b.butuh) }} {{ b.satuan }} &middot; {{ b.nama_produk }}</div>
                <div v-if="b.catatan_masalah" style="font-size:10.5px; color:var(--danger); background:var(--danger-light); border-radius:8px; padding:5px 8px; margin-bottom:6px;"><i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>{{ b.catatan_masalah }}</div>
                <div v-if="bolehProses && !(b.entry_qty || b.entry_qty===0)" style="display:flex; gap:6px;">
                  <button @click="bukaAksi('entry', b)" :disabled="sedangProses[barisKey(b)]" class="btn-primary" style="flex:1; padding:7px; font-size:11px;"><i class="fas fa-qrcode" style="margin-right:4px;"></i>Scan Entry</button>
                  <button @click="bukaAksi('masalah', b)" :disabled="sedangProses[barisKey(b)]" class="btn-outline" style="flex:1; padding:7px; font-size:11px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Masalah</button>
                  <button @click="bukaAksi('ganti', b)" :disabled="sedangProses[barisKey(b)]" class="btn-outline" style="flex:0 0 auto; padding:7px 9px; font-size:11px;" title="Ganti Operator (estafet shift)"><i class="fas fa-arrow-right-arrow-left"></i></button>
                </div>
              </div>
            </div>
            <button v-if="bolehProses" @click="konfirmasiDisiapkan(g)" :disabled="!g.siap || sedangProsesBatch[g.trackId]" class="btn-primary" style="width:100%; padding:8px;"><i class="fas fa-check" style="margin-right:6px;"></i>{{ g.siap ? 'Disiapkan — Pindah ke Perlu Dikirim' : 'Menunggu semua baris ber-entry' }}</button>
          </div>
        </div>
      </div>
    </div>
    </div>

    <scan-generik :aktif="modalAksi.aktif"
      :judul="modalAksi.mode==='ganti' ? 'Scan QR operator pengganti' : ('Scan label ' + (modalAksi.baris?.no_spk || ''))"
      :subjudul="modalAksi.mode==='entry' ? 'Scan Entry — stok akan berkurang.' : (modalAksi.mode==='masalah' ? 'Scan Masalah — akan diminta jumlah kurang & alasan.' : '')"
      @hasil="hasilScanAksi" @tutup="tutupAksi" />

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;"><i class="fas fa-triangle-exclamation" style="margin-right:8px; color:var(--danger);"></i>Ajukan Masalah — {{ popupMasalah.baris.no_spk }}</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0 0 10px;">{{ popupMasalah.baris.nama_aksesoris }} {{ popupMasalah.baris.warna }} — akan masuk ke Persiapan Produksi &gt; Masalah utk diajukan ke Owner.</p>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah kurang ({{ popupMasalah.baris.satuan }})</label><input v-model="popupMasalah.jumlahKurang" type="number" min="0" step="1"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="Mis. stok fisik kurang/rusak"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
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
const PersiapanSewingPerluDikirim = {
  components: { PopupPratinjauCetakLabel, ScanGenerik },
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const daftarBaggingAktif = ref([]);
    const daftarTlc = ref([]);
    const sedangProses = ref(false);
    const MY_TARGET = 'sub-pp-sewing-perludikirim';
    const bolehProses = computed(() => window.cekIzinMenu(MENU_ID, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(MENU_ID, 'print') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const [tracks, baggingSnap, tlcSnap] = await Promise.all([
          muatSemuaTrackSewing(),
          getDocs(query(collection(db, 'bagging'), where('ditutup_pada', '==', null))),
          getDocs(collection(db, 'master_tlc'))
        ]);
        daftarTrack.value = tracks;
        daftarBaggingAktif.value = baggingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        daftarTlc.value = tlcSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error('Gagal muat Acc Sewing > Perlu Di Kirim:', e);
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
    // jenisCetakAktif — lihat catatan sama di vue-persiapan-bahan.js.
    const jenisCetakAktif = ref('kode_bagging');
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
        jenisCetakAktif.value = 'kode_bagging';
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
        jenisCetakAktif.value = 'lembar_kode_tugas';
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
        // DIPERBAIKI (9 Sep 2026 malam) — matchFn lama pakai idxSet.has(i)
        // yang selalu undefined (lihat catatan besar di onCetakSelesai di
        // atas). `cocok` sudah difilter persis pakai kode+!kode_bagging di
        // atas — dipakai lagi di sini sebagai matchFn (value-based, bukan
        // index) supaya tidak perlu bikin key baru.
        await Promise.all(Object.entries(byTrack).map(([trackId, barisGrup]) => {
          return updateBarisSewingMassal(trackId, (x) => x.no_spk === kode && !x.kode_bagging, () => ({ kode_bagging: modalPack.bagging.kode }));
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
        // DIPERBAIKI (9 Sep 2026 malam) — matchFn value-based (kode_bagging),
        // sama alasan seperti onCetakSelesai/hasilScanPack di atas.
        await Promise.all(Object.entries(byTrack).map(([trackId, barisGrup]) => {
          return updateBarisSewingMassal(trackId, (x) => x.kode_bagging === kode, () => ({
            status: 'sedang_dikirim', masuk_tahap_pada: now, kode_tugas: modalKirim.tugas.kode,
            tlc_tujuan: modalKirim.tugas.tlc_tujuan || ''
          }));
        }));
        await updateDoc(doc(db, 'tugas_kirim', modalKirim.tugas.id), { pack: arrayUnion({ kode_bagging: kode, pada: now }) });
        modalKirim.log.unshift(kode + ' (' + anggota.length + ' komponen) -> ' + modalKirim.tugas.kode);
      } catch (e) { console.error('Gagal scan kirim:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-sewing-tahap'); await window.authReady; await muat(); });

    return {
      memuat, kelompokSepack, daftarTlc, bolehProses, bolehCetak, sedangProses,
      // FIX (10 Sep 2026) — sama seperti komponen "Perlu Disiapkan" di atas:
      // barisKey dipakai templat (:key v-for) tapi lupa di-return.
      formatQty, formatDiamSejak, tertahan, barisKey,
      popupBagging, bukaCetakBagging, konfirmasiCetakBagging,
      popupTugas, bukaCetakTugas, konfirmasiCetakTugas, isiTlcAwal,
      popupCetakAktif, daftarLabelPreview, jenisCetakAktif,
      modalPack, bukaScanPack, tutupScanPack, hasilScanPack, tutupBagging,
      modalKirim, bukaScanKirim, tutupScanKirim, hasilScanKirim,
      TAB_DEFS_SEWING, gantiTabPill, MY_TARGET
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Acc Sewing</h3>
          <div class="sub">{{ kelompokSepack.length }} produk tertahan di Perlu Di Kirim</div>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_SEWING" :key="t.target" type="button"
          :class="['sub-pp-sewing-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-sewing-tahap', t.target, $event)">
          <i :class="'fas ' + t.icon" style="margin-right:6px;"></i>{{ t.label }}
        </button>
      </div>

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
    </div>

    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Kode" :daftar-label="daftarLabelPreview" :jenis-cetak="jenisCetakAktif" @tutup="popupCetakAktif = false" />

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

    <scan-generik :aktif="modalPack.aktif" :judul="modalPack.bagging ? ('Scan anak SPK — bagging ' + modalPack.bagging.kode) : 'Scan Kode Bagging'" subjudul="Bisa discan berkali-kali. Tutup lewat tombol di bawah kalau sudah selesai." @hasil="hasilScanPack" @tutup="tutupScanPack" />
    <div v-if="modalPack.aktif && modalPack.bagging" style="position:fixed; left:16px; bottom:16px; z-index:10001; display:flex; flex-direction:column; gap:8px; max-width:260px;">
      <button @click="tutupBagging" class="btn-primary" style="padding:8px 14px; font-size:11px;">Tutup Bagging Ini</button>
      <div style="background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px;"><div v-for="(l,i) in modalPack.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div></div>
    </div>

    <scan-generik :aktif="modalKirim.aktif" :judul="modalKirim.tugas ? ('Scan kode bagging — tugas ' + modalKirim.tugas.kode) : 'Scan Kode Tugas'" subjudul="Bisa discan berkali-kali (tiap kode bagging = 1 pack)." @hasil="hasilScanKirim" @tutup="tutupScanKirim" />
    <div v-if="modalKirim.aktif && modalKirim.tugas && modalKirim.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:260px;">
      <div v-for="(l,i) in modalKirim.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>
  `
};

// ============================================================================
// TAB 4: Sedang Di Kirim — VIEW-ONLY, SAMA pola vue-persiapan-bahan.js.
// ============================================================================
const PersiapanSewingSedangDikirim = {
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    async function muat() {
      memuat.value = true;
      try { daftarTrack.value = await muatSemuaTrackSewing(); }
      catch (e) { console.error('Gagal muat Acc Sewing > Sedang Di Kirim:', e); daftarTrack.value = []; }
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
    const MY_TARGET = 'sub-pp-sewing-sedangdikirim';
    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-sewing-tahap'); await window.authReady; await muat(); });
    return { memuat, kelompokTugas, formatQty, formatDiamSejak, barisKey, TAB_DEFS_SEWING, gantiTabPill, MY_TARGET };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Acc Sewing</h3>
          <div class="sub">{{ kelompokTugas.length }} kode tugas sedang di jalan</div>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_SEWING" :key="t.target" type="button"
          :class="['sub-pp-sewing-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-sewing-tahap', t.target, $event)">
          <i :class="'fas ' + t.icon" style="margin-right:6px;"></i>{{ t.label }}
        </button>
      </div>

    <div v-if="kelompokTugas.length === 0" class="gc-kosong gc-card">
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
const PersiapanSewingSelesai = {
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);

    async function muat() {
      memuat.value = true;
      try { daftarTrack.value = await muatSemuaTrackSewing(); }
      catch (e) { console.error('Gagal muat Acc Sewing > Selesai:', e); daftarTrack.value = []; }
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

    const MY_TARGET = 'sub-pp-sewing-selesai';
    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-sewing-tahap'); await window.authReady; await muat(); });

    return {
      memuat, isOperatorSaja, barisSaya, daftarUrut, kpi,
      formatQty, formatWaktu, formatSiklus, siklusJam, keadaan, barisKey,
      TAB_DEFS_SEWING, gantiTabPill, MY_TARGET
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <!-- isOperatorSaja: versi "Riwayat Saya" TETAP tanpa gc-card-head/pill,
         sama alasan seperti vue-persiapan-bahan.js. -->
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

    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Acc Sewing</h3>
          <div class="sub">{{ kpi.selesai }} selesai hari ini</div>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_SEWING" :key="t.target" type="button"
          :class="['sub-pp-sewing-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-sewing-tahap', t.target, $event)">
          <i :class="'fas ' + t.icon" style="margin-right:6px;"></i>{{ t.label }}
        </button>
      </div>
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
    </div>
  `
};

// --- Mount ke index.html — LAZY, SAMA pola vue-persiapan-bahan.js: fungsi
// window.pastikanMountPpSewingXxx() dipanggil oleh pindahSubTab() (js/
// dashboard.js, peta `petaMount`) PERTAMA KALI tab itu dibuka. --------------
let vmPpSewingPerluDisiapkan = null;
window.pastikanMountPpSewingPerluDisiapkan = function () {
  if (vmPpSewingPerluDisiapkan) return;
  const mountPoint = document.getElementById('vue-pp-sewing-perludisiapkan');
  if (mountPoint) vmPpSewingPerluDisiapkan = createApp(PersiapanSewingPerluDisiapkan).mount('#vue-pp-sewing-perludisiapkan');
};
let vmPpSewingSedangDisiapkan = null;
window.pastikanMountPpSewingSedangDisiapkan = function () {
  if (vmPpSewingSedangDisiapkan) return;
  const mountPoint = document.getElementById('vue-pp-sewing-sedangdisiapkan');
  if (mountPoint) vmPpSewingSedangDisiapkan = createApp(PersiapanSewingSedangDisiapkan).mount('#vue-pp-sewing-sedangdisiapkan');
};
let vmPpSewingPerluDikirim = null;
window.pastikanMountPpSewingPerluDikirim = function () {
  if (vmPpSewingPerluDikirim) return;
  const mountPoint = document.getElementById('vue-pp-sewing-perludikirim');
  if (mountPoint) vmPpSewingPerluDikirim = createApp(PersiapanSewingPerluDikirim).mount('#vue-pp-sewing-perludikirim');
};
let vmPpSewingSedangDikirim = null;
window.pastikanMountPpSewingSedangDikirim = function () {
  if (vmPpSewingSedangDikirim) return;
  const mountPoint = document.getElementById('vue-pp-sewing-sedangdikirim');
  if (mountPoint) vmPpSewingSedangDikirim = createApp(PersiapanSewingSedangDikirim).mount('#vue-pp-sewing-sedangdikirim');
};
let vmPpSewingSelesai = null;
window.pastikanMountPpSewingSelesai = function () {
  if (vmPpSewingSelesai) return;
  const mountPoint = document.getElementById('vue-pp-sewing-selesai');
  if (mountPoint) vmPpSewingSelesai = createApp(PersiapanSewingSelesai).mount('#vue-pp-sewing-selesai');
};
