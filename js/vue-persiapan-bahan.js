// js/vue-persiapan-bahan.js
// ============================================================================
// Persiapan Produksi > Bahan — menu BARU (31 Agt 2026, wireframe handoff
// "Persiapan Produksi - Bahan", modul ke-2 dari paket F:\ZEVANIC HOUSE\
// FOUNDATION\Mockup\handoff\). Pos yang menyiapkan KAIN: SATU KARTU SATU
// BAHAN + WARNA (beda dari 3 pos acc lain yang satu kartu satu SPK) —
// karena kain yang disiapkan bisa dipakai bareng oleh beberapa anak SPK
// sekaligus ("gelar bersamaan, potong bersamaan").
//
// ARSITEKTUR DATA — PENTING, baca dulu sebelum ubah apapun di sini:
//
// SERAH-TERIMA.md modul ini menyebut koleksi `persiapan_komponen` sebagai
// sumber datanya ("sudah ada di repo"). ITU SUDAH TIDAK BENAR — koleksi itu
// DITINGGALKAN Guru 29 Agt 2026 tanpa migrasi (lihat komentar besar di
// js/vue-order-spk.js sekitar baris ~91-103, "belum sempat dipakai produksi
// nyata"). Sudah diverifikasi ke kode live (31 Agt 2026, obrolan sesi ini)
// sebelum modul ini ditulis — BUKAN tebakan.
//
// Yang benar-benar dipakai sekarang: `spk_track` (dibuat js/vue-persiapan-
// produksi-v2.js function buatSpkTrackUntukGrouping(), 1 dokumen per SPK
// Grouping per jalur). Dokumen jalur:'bahan' punya field TAMBAHAN
// `bahan_rincian[]` (diisi function hitungBahanRincian() di file itu SAAT
// SPK Grouping diterbitkan) — SATU BARIS per (bahan x anak SPK):
//   order_spk_id, no_spk, qty, bahan_aksesoris_id, bahan_nama, bahan_warna,
//   nama_pola, produk_size, panjang_pola, isi_pola_pcs, amparan,
//   kebutuhan_kain, status, masuk_tahap_pada, label_cetak_pada,
//   operator_uid, operator_nama, ditugaskan_pada, riwayat_operator[],
//   entry_qty, entry_oleh, entry_pada, catatan_masalah, kode_bagging,
//   kode_tugas, tlc_tujuan (BARU, 1 Sep 2026 — snapshot tujuan TLC saat
//   Scan Kirim, dari tugas_kirim.tlc_tujuan, biar tab Selesai tidak perlu
//   join balik ke tugas_kirim), sampai_pada (BARU, 1 Sep 2026 — jam divisi
//   penerima Scan Sampai; field ini DITULIS OLEH MODUL LAIN, lihat catatan
//   TAB 5 di bawah, BUKAN oleh file ini).
//
// File ini BACA baris-baris itu (query spk_track where jalur=='bahan' —
// SEMUA status dokumen, karena progres yang dipakai UI ini adalah `status`
// PER BARIS bukan status dokumen; 1 dokumen grouping bisa punya baris-baris
// di tahap berbeda-beda sekaligus kalau bahannya lebih dari satu), GABUNGKAN
// jadi kartu per bahan (+warna) buat tab Perlu Disiapkan, dan SARING per
// `status` baris buat 4 tab lain.
//
// TULIS balik: read-modify-write ATOMIK per dokumen lewat runTransaction
// (lihat updateBarisBahan()) — BUKAN arrayUnion, karena yang dibutuhkan
// adalah UBAH elemen array yang sudah ada, bukan cuma nambah. Scan entry
// (yang mengurangi stok) menggabungkan transaksi ke DUA dokumen sekaligus
// (spk_track + master_bahan_aksesoris) dalam SATU runTransaction supaya
// atomik (lihat konfirmasiEntry()).
//
// Koleksi BARU (belum ada di repo, lihat firestore-rules-tambahan-
// persiapan-produksi-bahan.txt yang dikirim terpisah ke Guru buat ditempel
// ke firestore.rules):
//   bagging       — {kode, produk_label, isi[] (no_spk), ditutup_pada, dibuat_pada, dibuat_oleh}
//   tugas_kirim   — {kode, tlc_asal, tlc_tujuan, pack[] ({kode_bagging,pada}), dibuat_pada, dibuat_oleh}
//   master_tlc    — {kode, nama, tipe} — daftar Titik Lokasi Cerdas/tempat
//   cetak_ulang_log — {kode_spk, bahan, alasan, pin_oleh, pada}
//
// Print label: PAKAI ULANG PopupPratinjauCetakLabel (vue-components.js) —
// SAMA seperti seluruh app, ukuran fisik cetak 4x2in thermal (keputusan
// Guru 28 Agt 2026, lihat komentar besar di komponen itu) — BUKAN 10x15cm/
// 4x2cm yang disebut wireframe ("wireframe = acuan struktur, bukan kode",
// PEDOMAN-SERAH-TERIMA.md §1 — dan itu sudah keputusan lama yang berlaku
// utuh, bukan sesuatu yang perlu ditulis ulang khusus buat pos ini).
//
// Scan QR: pakai komponen generik `ScanGenerik` (js/vue-scan-cetak.js,
// refactor 7 Sep 2026 — sebelumnya komponen lokal `ModalScanQr` yang
// disalin identik di 4 file Persiapan Produksi, sekarang genuinely
// diimpor, interface & perilaku TIDAK berubah) — dibuka dari tombol di
// kartu/baris, SAMA di desktop maupun HP (konvensi proyek ini; BUKAN
// tombol QR navbar global generik yang disebut wireframe — itu scan
// lintas-menu, bukan scan berkonteks kartu/baris seperti yang dibutuhkan
// modul ini). ScanGenerik auto-lanjut scan berikutnya selama masih terbuka
// (dukung "scan berkali-kali" tanpa buka-tutup kamera berulang).
//
// Ambang "tertahan": >6 jam sejak `masuk_tahap_pada` (keputusan Guru, 31
// Agt 2026), SAMA buat semua tab & semua pos Persiapan — ditandai warna
// (lihat tertahan()/AMBANG_TERTAHAN_JAM).
//
// Operator: individu ATAU tim — TIDAK ada field baru buat ini, tim cukup
// didaftarkan sebagai identitas sendiri di `users` (QR-nya sendiri), sama
// seperti individu (keputusan Guru 31 Agt 2026). Estafet shift: operator
// BOLEH diganti di tengah jalan sebelum baris selesai — scan ulang operator
// baru + baris yang sama, riwayat disimpan di `riwayat_operator[]` (bukan
// menimpa) supaya kebaca kalau ada reject/masalah (keputusan Guru, sama
// tanggal).
//
// PIN admin (cetak ulang label, SERAH-TERIMA §3 "1b") — DIPERBAIKI (7 Sep
// 2026, task #94 "4 gap kekurangan"): waktu ditulis (31 Agt 2026) BELUM ADA
// infrastruktur verifikasi PIN generik, jadi PIN cuma DICATAT sebagai teks
// bebas tanpa diverifikasi. Infrastrukturnya SEKARANG SUDAH ADA
// (`PopupPinGenerik`/`hashPin`/`cariUserByPin`, js/vue-scan-cetak.js, dibangun
// 7 Sep 2026 sore utk modul Scan & Cetak) — dipakai konsisten di semua PIN
// baru sejak itu (Gudang Konfirmasi Hilang, dst). Cetak ulang di sini SEKARANG
// pakai `PopupPinGenerik` (rolesDiizinkan=null = semua admin-level, SESUAI
// SPESIFIKASI-KOLEKSI-BARU.md §4 poin 3: "Cetak ulang label — PIN siapa pun
// diterima, yang dicatat = pemilik PIN") — `pin_oleh` di `cetak_ulang_log`
// sekarang identitas PEMILIK PIN YANG SUNGGUHAN TERVERIFIKASI, bukan lagi
// user yang sedang login. Bukan tebakan baru — cuma menerapkan infra & spesifikasi
// yang sudah ada ke gap yang sudah didokumentasikan sejak awal.
// ============================================================================

import { createApp, ref, reactive, computed, watch, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel } from './vue-components.js?v=6';
import { ScanGenerik, PopupPinGenerik, buatQrDataUrl, muatJsQr, cariKaryawanByQr, ajukanPersiapanMasalah } from './vue-scan-cetak.js?v=2';

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

// --- Format & hitung kecil --------------------------------------------------
function formatMeter(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' m';
}
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
// hariIniSama — dipakai KPI Tab 5 (Selesai), bandingkan tanggal LOKAL device
// (bukan UTC — pola sama seperti fix bug Quote timezone Asia/Jakarta, 30
// Agt 2026, cukup akurat buat KPI harian non-finansial di sini).
function hariIniSama(iso) {
  if (!iso) return false;
  const d = new Date(iso), now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
// siklusJam — SERAH-TERIMA §2: "jam cetak label -> jam scan sampai", ikut
// menghitung lama menunggu ditugaskan (mengukur pos INI, bukan pos
// penerima). null kalau salah satu jam belum ada.
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
// --- Kode harian berurut (bagging/tugas kirim) — SAMA pola seperti
// generateKodeSpkGrouping() di vue-persiapan-produksi-v2.js, counter doc
// terpisah per JENIS supaya bagging & tugas kirim tidak berebut angka. ---
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

// --- Baca & ratakan spk_track jalur='bahan' ---------------------------------
// Query cuma equality 1 field (jalur) -> kepakai single-field index bawaan
// Firestore, TIDAK butuh index composite baru (beda dari 4 jalur lain yang
// query where('jalur')+where('status') -> itu sudah punya index sendiri,
// lihat js/vue-persiapan-produksi-v2.js JalurTahapManager).
async function muatSemuaTrackBahan() {
  const snap = await getDocs(query(collection(db, 'spk_track'), where('jalur', '==', 'bahan')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
function daftarBarisDariTrack(daftarTrack) {
  const baris = [];
  daftarTrack.forEach(t => {
    (t.bahan_rincian || []).forEach((b, idx) => {
      baris.push({ ...b, _trackId: t.id, _lineIdx: idx, kode_spk: t.kode_spk, grouping_id: t.grouping_id, nama_produk: t.nama_produk });
    });
  });
  return baris;
}
function barisKey(b) { return b._trackId + '::' + b._lineIdx; }

// updateBarisBahan — read-modify-write ATOMIK 1 baris di dalam
// spk_track.bahan_rincian[N]. Dipilih ketimbang arrayUnion/arrayRemove
// karena perlu UBAH elemen yang SUDAH ADA (bukan cuma nambah), dan
// Firestore tidak punya "update elemen array ke-N" langsung. runTransaction
// mencegah 2 scan nyaris bersamaan saling menimpa.
async function updateBarisBahan(trackId, lineIdx, patchFn) {
  const refTrack = doc(db, 'spk_track', trackId);
  await runTransaction(db, async (trx) => {
    const snap = await trx.get(refTrack);
    if (!snap.exists()) throw new Error('SPK Track tidak ditemukan (mungkin sudah dihapus).');
    const arr = Array.isArray(snap.data().bahan_rincian) ? [...snap.data().bahan_rincian] : [];
    if (!arr[lineIdx]) throw new Error('Baris bahan tidak ditemukan — coba muat ulang halaman.');
    arr[lineIdx] = { ...arr[lineIdx], ...patchFn(arr[lineIdx]) };
    trx.update(refTrack, { bahan_rincian: arr, diperbarui_pada: serverTimestamp() });
  });
}

// updateBarisBahanMassal — BARU (7 Sep 2026, task #94 "gerbang batch"),
// disalin dari pola updateBarisWebbingMassal/updateBarisSewingMassal/
// updateBarisFinishingMassal (Bahan sebelumnya tidak butuh ini karena tiap
// baris pindah tahap sendiri-sendiri — sekarang tombol "Disiapkan" perlu
// memindahkan SEMUA baris satu SPK Grouping/trackId sekaligus, SATU
// transaksi). patch SEMUA elemen bahan_rincian[] yang lolos matchFn().
async function updateBarisBahanMassal(trackId, matchFn, patchFn) {
  const refTrack = doc(db, 'spk_track', trackId);
  let kena = 0;
  await runTransaction(db, async (trx) => {
    const snap = await trx.get(refTrack);
    if (!snap.exists()) throw new Error('SPK Track tidak ditemukan (mungkin sudah dihapus).');
    const arr = Array.isArray(snap.data().bahan_rincian) ? [...snap.data().bahan_rincian] : [];
    for (let i = 0; i < arr.length; i++) {
      if (matchFn(arr[i])) { arr[i] = { ...arr[i], ...patchFn(arr[i]) }; kena++; }
    }
    if (kena === 0) return;
    trx.update(refTrack, { bahan_rincian: arr, diperbarui_pada: serverTimestamp() });
  });
  return kena;
}

// konfirmasiEntry — SATU-SATUNYA tempat stok master_bahan_aksesoris
// berkurang (SERAH-TERIMA §8 uji-terima #3: "Scan entry mengurangi stok;
// cetak label dan scan kirim tidak"). Transaksi rangkap 2 dokumen (spk_track
// + master_bahan_aksesoris) supaya atomik.
// DIPERBAIKI (7 Sep 2026, task #94 "gerbang batch", keputusan Guru: "ubah
// jadi gerbang per-SPK sesuai wireframe") — dulu baris LANGSUNG pindah
// 'perlu_dikirim' begitu di-entry sendiri-sendiri (penyederhanaan awal,
// dicatat di komentar lama sbg "dicatat biar Guru bisa koreksi kalau
// perlu"). SEKARANG status TETAP 'sedang_disiapkan' sesudah entry — baris
// baru benar-benar pindah tahap lewat konfirmasiDisiapkan() (batch SEMUA
// baris 1 SPK Grouping/trackId sekaligus), lihat komponen Tab 2 di bawah.
async function konfirmasiEntry(b) {
  const refTrack = doc(db, 'spk_track', b._trackId);
  const refBahan = doc(db, 'master_bahan_aksesoris', b.bahan_aksesoris_id);
  const now = new Date().toISOString();
  const oleh = window.currentUser?.email || '';
  await runTransaction(db, async (trx) => {
    const [snapTrack, snapBahan] = await Promise.all([trx.get(refTrack), trx.get(refBahan)]);
    if (!snapTrack.exists()) throw new Error('SPK Track tidak ditemukan.');
    const arr = Array.isArray(snapTrack.data().bahan_rincian) ? [...snapTrack.data().bahan_rincian] : [];
    if (!arr[b._lineIdx]) throw new Error('Baris sudah berubah — muat ulang halaman.');
    arr[b._lineIdx] = {
      ...arr[b._lineIdx],
      entry_qty: arr[b._lineIdx].kebutuhan_kain, entry_oleh: oleh, entry_pada: now
    };
    trx.update(refTrack, { bahan_rincian: arr, diperbarui_pada: serverTimestamp() });
    if (snapBahan.exists()) {
      const stokBaru = (parseFloat(snapBahan.data().stok_akhir) || 0) - (parseFloat(b.kebutuhan_kain) || 0);
      trx.update(refBahan, { stok_akhir: stokBaru });
    }
  });
}

// kelompokKartuBahan — kelompokkan baris (SUDAH difilter status tertentu)
// jadi kartu per bahan (bahan_aksesoris_id, artinya per bahan+warna sekalian
// karena 1 warna = 1 dokumen master_bahan_aksesoris sendiri). "butuh" =
// jumlah kebutuhan_kain SEMUA baris LINTAS grouping/SPK (SERAH-TERIMA §3
// "Aturan khas pos ini: Kumulatif"). "stok" diambil LIVE dari peta
// master_bahan_aksesoris (bukan disimpan di baris — stok berubah tiap saat,
// harus akurat).
function kelompokKartuBahan(barisList, petaStokBahan) {
  const peta = {};
  barisList.forEach(b => {
    const key = b.bahan_aksesoris_id;
    if (!key) return;
    if (!peta[key]) {
      const info = petaStokBahan[key] || {};
      peta[key] = {
        bahanAksesorisId: key, nama: b.bahan_nama, warna: b.bahan_warna,
        namaPola: b.nama_pola, produkSize: b.produk_size,
        stok: parseFloat(info.stok_akhir) || 0, rakId: info.rak_id || '',
        butuh: 0, jumlahAnak: 0, baris: []
      };
    }
    peta[key].butuh += (parseFloat(b.kebutuhan_kain) || 0);
    peta[key].jumlahAnak += 1;
    peta[key].baris.push(b);
  });
  const list = Object.values(peta).map(k => ({ ...k, selisih: k.stok - k.butuh, cukup: k.stok >= k.butuh }));
  // alokasi greedy per kartu: urut butuh terkecil dulu, tandai `_bisa` selama
  // stok masih menutupi kumulatif berjalan — dukung "kalau stok cuma cukup
  // buat sebagian, sebagian itu boleh jalan dulu" (SERAH-TERIMA §3 "Cetak").
  list.forEach(k => {
    const urut = [...k.baris].sort((a, b2) => (a.kebutuhan_kain || 0) - (b2.kebutuhan_kain || 0));
    let sisa = k.stok;
    urut.forEach(b => { b._bisa = sisa >= (b.kebutuhan_kain || 0); if (b._bisa) sisa -= (b.kebutuhan_kain || 0); });
  });
  // urut kartu: stok kurang dulu (SERAH-TERIMA §2 "Diurut stok kurang dulu")
  list.sort((a, b) => (a.cukup === b.cukup) ? (a.selisih - b.selisih) : (a.cukup ? 1 : -1));
  return list;
}

// kunciSepack — "syarat sepack" (SERAH-TERIMA §3 "Aturan khas pos ini"):
// pola, BAHAN (nama, bukan warna), dan size sama; warna & no SPK boleh beda.
function kunciSepack(b) { return `${b.nama_pola}::${b.bahan_nama}::${b.produk_size}`.toLowerCase(); }
function labelSepack(b) { return `${b.nama_pola} · ${b.bahan_nama} · ${b.produk_size || '-'}`; }

// Komponen kamera fullscreen (dulu bernama lokal ModalScanQr, disalin
// identik di 4 file Persiapan Produksi) sekarang jadi ScanGenerik di
// js/vue-scan-cetak.js — genuinely diimpor, interface & perilaku PERSIS
// SAMA, tidak disalin lagi (refactor 7 Sep 2026).

// ============================================================================
// RETROFIT 9 Sep 2026 (audit wireframe vs kode live, Guru sudah setuju
// termasuk alur) — 3 potongan dipakai SEMUA 5 komponen tab di bawah:
//
// 1) TAB_DEFS_BAHAN + gantiTabPill()/sembunyikanBarisTabAsli() — wireframe
//    menaruh pill tab (Perlu Disiapkan/dst) DI DALAM 1 card yang sama
//    dengan konten (nempel di gc-card-head, css/gechoo-design.css — class
//    itu SUDAH ADA tapi belum dipakai markup manapun sebelum ini, ini
//    pemakaian PERTAMA). Baris tombol tab ASLI ada di index.html, DI LUAR
//    card manapun (sibling sebelum 5 div konten) — index.html TIDAK BOLEH
//    disentuh sesi ini, jadi baris asli itu TIDAK bisa dipindah beneran.
//    Solusinya: pill BARU di bawah dirender DI DALAM card tiap
//    komponen tab, PAKAI CLASS & data-target PERSIS SAMA dengan tombol
//    asli ('sub-pp-bahan-tahap-btn', data-target sama) — window.
//    pindahSubTab() (js/dashboard.js) toggle class 'active' lewat
//    querySelectorAll(class), jadi pill baru & tombol asli OTOMATIS
//    sinkron tanpa kode tambahan. Baris tombol ASLI lalu disembunyikan
//    lewat DOM (bukan edit index.html) oleh sembunyikanBarisTabAsli(),
//    idempoten, dipanggil dari onMounted tiap komponen (siapa pun mount
//    duluan di antara 5 tab yang lazy-mount). File index.html sendiri
//    TIDAK berubah sebyte pun — ini manipulasi DOM saat runtime.
//
// 2) Header kartu (gc-card-head): judul + hitung ringkas, SAMA pola di
//    kelima tab. Tombol AKSI GLOBAL (Scan Sampai, Scan Operator) HANYA di
//    tab Perlu Disiapkan — dicek ke wireframe.dc.html baris ~144-146,
//    kedua tombol itu cuma muncul di header tab ini, tab lain punya
//    toolbar kanan yang beda/tanpa toolbar.
//
// 3) "Scan Operator" GLOBAL (beda dari tombol "Tunjuk Operator" per-kartu
//    yang SUDAH ADA — TETAP dipertahankan, tombol global ini TAMBAHAN)
//    membuka modal penunjukan yang sama tapi tanpa kartu terkunci —
//    hasilScanTunjuk() mencari baris cocok DI SEMUA kartu tab ini, bukan
//    cuma 1 kartu (SERAH-TERIMA/wireframe: "bekerja untuk semua kartu").
//
// "Scan Sampai" GLOBAL (baru, wireframe baris ~1486: pack balik dari
// Persiapan Masalah/TLC BHN-TRB ditutup di sini) — ASUMSI JUJUR dicatat di
// komponen Tab 1 di bawah: diimplementasi KONSERVATIF, cuma membersihkan
// `catatan_masalah` di baris spk_track yang kode_bagging-nya cocok hasil
// scan (field itu SUDAH ada & dibaca-tulis file ini). TIDAK menulis balik
// status dokumen `persiapan_masalah` (koleksi itu single-source-of-truth
// milik js/vue-pp-masalah.js, sesi ini tidak diberi wewenang mengubah
// kontrak tulisnya) — rekonsiliasi penuh lintas modul itu perlu keputusan
// Guru terpisah, dicatat sebagai gap di laporan akhir sesi ini.
// ============================================================================
const TAB_DEFS_BAHAN = [
  { target: 'sub-pp-bahan-perludisiapkan', icon: 'fa-inbox', label: 'Perlu Disiapkan' },
  { target: 'sub-pp-bahan-sedangdisiapkan', icon: 'fa-gears', label: 'Sedang Disiapkan' },
  { target: 'sub-pp-bahan-perludikirim', icon: 'fa-box-open', label: 'Perlu Di Kirim' },
  { target: 'sub-pp-bahan-sedangdikirim', icon: 'fa-truck-fast', label: 'Sedang Di Kirim' },
  { target: 'sub-pp-bahan-selesai', icon: 'fa-circle-check', label: 'Selesai' }
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
// Kartu per bahan+warna. 1a: cek stok + centang baris yang bisa jalan +
// cetak label. 1b: badge "sudah dicetak" + cetak ulang (PIN+alasan). 1c:
// penunjukan (scan operator + scan berkali-kali label anak SPK).
// ============================================================================
const PersiapanBahanPerluDisiapkan = {
  components: { PopupPratinjauCetakLabel, ScanGenerik, PopupPinGenerik },
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const petaStokBahan = ref({});
    const cari = ref('');
    const pilihanCetak = reactive({}); // barisKey -> bool (override manual)
    const sedangProses = reactive({});

    const menuId = 'pp_bahan';
    const MY_TARGET = 'sub-pp-bahan-perludisiapkan';
    // REVISI 8 Sep 2026 (keputusan Guru, audit kode) — satu-satunya
    // pemakai bolehProses di komponen ini adalah tombol "Tunjuk Operator",
    // jadi digerbang langsung PIC ke atas di sini.
    const bolehProses = computed(() => picOwnerKeAtas(window.currentUser) && window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);
    // bolehEdit — RETROFIT 9 Sep 2026, dipakai gerbang tombol "Scan Sampai"
    // (global, baru): wireframe §"Peran" bilang Admin BOLEH scan masalah/
    // sampai di tab ini, TIDAK BOLEH scan operator (itu PIC ke atas via
    // bolehProses) — jadi sengaja dipisah dari bolehProses.
    const bolehEdit = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const [tracks, stokSnap] = await Promise.all([
          muatSemuaTrackBahan(),
          getDocs(collection(db, 'master_bahan_aksesoris'))
        ]);
        daftarTrack.value = tracks;
        const peta = {}; stokSnap.forEach(d => { peta[d.id] = d.data(); });
        petaStokBahan.value = peta;
      } catch (e) {
        console.error('Gagal muat Bahan > Perlu Disiapkan:', e);
        daftarTrack.value = [];
      }
      memuat.value = false;
    }

    const kartuList = computed(() => {
      const baris = daftarBarisDariTrack(daftarTrack.value).filter(b => b.status === 'perlu_disiapkan');
      let kartu = kelompokKartuBahan(baris, petaStokBahan.value);
      const kata = cari.value.trim().toLowerCase();
      if (kata) {
        kartu = kartu.filter(k => (k.nama + ' ' + k.warna).toLowerCase().includes(kata) || k.baris.some(b => (b.no_spk || '').toLowerCase().includes(kata) || (b.kode_spk || '').toLowerCase().includes(kata)));
      }
      return kartu;
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

    // jumlahSiapDicetak — RETROFIT 9 Sep 2026, dipakai subjudul gc-card-head
    // ("N bahan menunggu · M siap dicetak", wireframe mobile §2.1.1).
    const jumlahSiapDicetak = computed(() => kartuList.value.filter(k => k.baris.some(b => b._bisa && !b.label_cetak_pada)).length);

    // ringkasanTerpilih — RETROFIT 9 Sep 2026 (temuan #5): dasar bar footer
    // sticky "terpilih: N anak SPK · X m · Y bahan" (wireframe baris ~348).
    // Dihitung LINTAS SEMUA kartu yang lagi tampil (bukan cuma 1 kartu).
    const ringkasanTerpilih = computed(() => {
      let jumlah = 0, meter = 0; const bahanSet = new Set();
      kartuList.value.forEach(k => {
        k.baris.forEach(b => {
          if (isChecked(b) && b._bisa && !b.label_cetak_pada) { jumlah++; meter += (parseFloat(b.kebutuhan_kain) || 0); bahanSet.add(k.bahanAksesorisId); }
        });
      });
      return { jumlah, meter, bahan: bahanSet.size };
    });

    // --- Cetak label (1a -> 1b) ---
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    let _pendingCetak = [];
    // bangunPreviewDariBaris — RETROFIT 9 Sep 2026, diekstrak dari isi lama
    // cetakLabelKartu() supaya bisa dipakai ULANG oleh cetakSemuaTercentang()
    // (temuan #5, cetak massal lintas kartu) TANPA duplikasi logic. Kunci
    // dikelompokkan grouping_id+bahan_aksesoris_id (BUKAN cuma grouping_id)
    // supaya kalau cetak massal mencakup >1 bahan dalam 1 grouping yang sama,
    // tetap 1 label PER BAHAN (SERAH-TERIMA §3), bukan tergabung.
    function bangunPreviewDariBaris(daftarBaris) {
      const perLabel = {};
      daftarBaris.forEach(b => { (perLabel[b.grouping_id + '::' + b.bahan_aksesoris_id] ||= []).push(b); });
      return Object.values(perLabel).map(barisGrup => {
        const kodeInduk = barisGrup[0].kode_spk;
        const kodeLabel = `${kodeInduk}-${barisGrup[0].bahan_aksesoris_id}`;
        return {
          kode: kodeInduk,
          nama: `${barisGrup[0].bahan_nama || ''} ${barisGrup[0].bahan_warna || ''}`.trim(),
          info: `${barisGrup.map(b => b.no_spk).join(', ')} &middot; ${formatMeter(barisGrup.reduce((s, b) => s + (b.kebutuhan_kain || 0), 0))} &middot; ${barisGrup[0].nama_pola || ''}`,
          qrDataUrl: buatQrDataUrl(kodeLabel)
        };
      });
    }
    function cetakLabelKartu(k) {
      if (typeof QRCode === 'undefined') { alert('Library pembuat QR belum siap dimuat. Refresh halaman (Ctrl+Shift+R) lalu ulangi.'); return; }
      const terpilih = k.baris.filter(b => isChecked(b) && b._bisa && !b.label_cetak_pada);
      if (!terpilih.length) { alert('Tidak ada baris yang bisa dicetak (stok belum cukup untuk baris manapun, atau sudah dicetak semua).'); return; }
      daftarLabelPreview.value = bangunPreviewDariBaris(terpilih);
      _pendingCetak = terpilih;
      popupCetakAktif.value = true;
    }
    // cetakSemuaTercentang — RETROFIT 9 Sep 2026 (temuan #5): versi LINTAS
    // KARTU dari cetakLabelKartu() di atas, dipicu tombol footer sticky.
    // Fitur cetak per-kartu yang SUDAH ADA TETAP DIPERTAHANKAN — ini
    // TAMBAHAN, bukan pengganti.
    function cetakSemuaTercentang() {
      if (typeof QRCode === 'undefined') { alert('Library pembuat QR belum siap dimuat. Refresh halaman (Ctrl+Shift+R) lalu ulangi.'); return; }
      const terpilih = [];
      kartuList.value.forEach(k => k.baris.forEach(b => { if (isChecked(b) && b._bisa && !b.label_cetak_pada) terpilih.push(b); }));
      if (!terpilih.length) { alert('Tidak ada baris tercentang yang bisa dicetak.'); return; }
      daftarLabelPreview.value = bangunPreviewDariBaris(terpilih);
      _pendingCetak = terpilih;
      popupCetakAktif.value = true;
    }
    async function onCetakSelesai() {
      const now = new Date().toISOString();
      try {
        await Promise.all(_pendingCetak.map(b => updateBarisBahan(b._trackId, b._lineIdx, () => ({ label_cetak_pada: now }))));
      } catch (e) { console.error('Gagal catat label_cetak_pada:', e); }
      _pendingCetak = [];
      await muat();
    }

    // --- Cetak ulang (alasan + PIN diverifikasi kriptografis, dicatat
    // cetak_ulang_log — lihat komentar besar di atas soal perbaikan 7 Sep) ---
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
      const perGrouping = {};
      sudahDicetak.forEach(b => { (perGrouping[b.grouping_id] ||= []).push(b); });
      const preview = Object.values(perGrouping).map(barisGrup => {
        const kodeInduk = barisGrup[0].kode_spk;
        return {
          kode: kodeInduk, nama: `${p.kartu.nama} ${p.kartu.warna}`.trim(),
          info: `CETAK ULANG &middot; ${barisGrup.map(b => b.no_spk).join(', ')}`,
          qrDataUrl: buatQrDataUrl(`${kodeInduk}-${p.kartu.bahanAksesorisId}`)
        };
      });
      try {
        await addDoc(collection(db, 'cetak_ulang_log'), {
          kode_spk: sudahDicetak.map(b => b.kode_spk).join(', '),
          bahan: `${p.kartu.nama} ${p.kartu.warna}`.trim(),
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
    // SPK di kartu ini (harus sudah dicetak, status masih perlu_disiapkan).
    // "Ganti operator" = scan QR operator lain lagi -> operator aktif
    // berganti, baris yang SUDAH kena scan sebelumnya TETAP punya operator
    // lama (tidak ditimpa mundur). ---
    const modalTunjuk = reactive({ aktif: false, kartu: null, global: false, operator: null, tahap: 'operator', log: [] });
    function bukaPenunjukan(k) {
      const eligible = k.baris.filter(b => b.label_cetak_pada && b.status === 'perlu_disiapkan');
      if (!eligible.length) { alert('Belum ada baris yang sudah dicetak labelnya di kartu ini.'); return; }
      modalTunjuk.kartu = k; modalTunjuk.global = false; modalTunjuk.operator = null; modalTunjuk.tahap = 'operator'; modalTunjuk.log = [];
      modalTunjuk.aktif = true;
    }
    // bukaPenunjukanGlobal — RETROFIT 9 Sep 2026 (temuan #1): versi header
    // toolbar dari "Tunjuk Operator" di atas — TIDAK terkunci ke 1 kartu,
    // mencari baris cocok DI SEMUA kartu yang lagi tampil di tab ini
    // (wireframe: tombol "Scan operator" global bekerja lintas kartu).
    // Tombol per-kartu yang sudah ada TETAP DIPERTAHANKAN, ini tambahan.
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
      // tahap 'anak' — cari baris yang no_spk cocok, belum ditunjuk, labelnya
      // sudah dicetak. Mode global: cari DI SEMUA kartu; mode per-kartu:
      // cari DI KARTU ITU SAJA (perilaku lama, tidak berubah).
      const kolamBaris = modalTunjuk.global ? kartuList.value.flatMap(k => k.baris) : (modalTunjuk.kartu?.baris || []);
      const target = kolamBaris.find(b => b.no_spk === kode && b.label_cetak_pada && b.status === 'perlu_disiapkan');
      if (!target) { alert(`Kode "${kode}" tidak cocok baris manapun yang sudah dicetak labelnya (mungkin belum dicetak, atau sudah ditunjuk).`); return; }
      const now = new Date().toISOString();
      try {
        await updateBarisBahan(target._trackId, target._lineIdx, (lama) => ({
          status: 'sedang_disiapkan', masuk_tahap_pada: now,
          operator_uid: modalTunjuk.operator.id, operator_nama: modalTunjuk.operator.nama, ditugaskan_pada: now,
          riwayat_operator: [...(lama.riwayat_operator || []), { operator_uid: modalTunjuk.operator.id, operator_nama: modalTunjuk.operator.nama, mulai_pada: now }]
        }));
        modalTunjuk.log.unshift(`${target.no_spk} -> ${modalTunjuk.operator.nama}`);
        target.status = 'sedang_disiapkan'; // optimistik, biar kartu di modal langsung update tanpa nunggu muat()
      } catch (e) {
        console.error('Gagal simpan penunjukan:', e);
        alert('Gagal menyimpan penunjukan. Coba lagi.');
      }
    }
    async function selesaiPenunjukan() { tutupPenunjukan(); await muat(); }

    // --- Scan Sampai GLOBAL (temuan #1, wireframe baris ~144/1486) — "Satu-
    // satunya scan di sub menu ini yang bukan penunjukan tugas. Pack yang
    // dikirim balik dari Persiapan Masalah (TLC BHN-TRB) ditutup di sini."
    // ASUMSI KONSERVATIF (dicatat juga di komentar besar atas file): scan
    // kode bagging yang balik -> bersihkan `catatan_masalah` baris spk_track
    // yang kode_bagging-nya cocok (field yang SUDAH dibaca-tulis file ini),
    // supaya baris itu tidak lagi tertandai bermasalah di Tab 2. TIDAK
    // menulis balik status dokumen `persiapan_masalah` — itu single-source-
    // of-truth js/vue-pp-masalah.js, rekonsiliasi penuh perlu keputusan Guru
    // terpisah (dicatat sebagai gap, bukan diselesaikan diam-diam di sini).
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
        await Promise.all([...trackIdSet].map(trackId => updateBarisBahanMassal(trackId, (x) => x.kode_bagging === kode && !!x.catatan_masalah, () => ({ catatan_masalah: '' }))));
        modalScanSampai.log.unshift(`${kode} → ${cocok.length} baris diterima kembali`);
        await muat();
      } catch (e) { console.error('Gagal scan sampai:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-bahan-tahap'); await window.authReady; await muat(); });

    return {
      memuat, kartuList, cari, isChecked, toggleCheck,
      bolehProses, bolehCetak, bolehEdit, formatMeter, formatQty, formatWaktu,
      TAB_DEFS_BAHAN, gantiTabPill, MY_TARGET, jumlahSiapDicetak, ringkasanTerpilih,
      popupCetakAktif, daftarLabelPreview, cetakLabelKartu, cetakSemuaTercentang, onCetakSelesai,
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
          <h3 class="gc-heading">Persiapan Bahan</h3>
          <div class="sub">{{ kartuList.length }} bahan menunggu &middot; {{ jumlahSiapDicetak }} siap dicetak</div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button v-if="bolehEdit" @click="bukaScanSampaiGlobal" class="btn-outline" style="padding:8px 14px;"><i class="fas fa-inbox" style="margin-right:6px;"></i>Scan Sampai</button>
          <button v-if="bolehProses" @click="bukaPenunjukanGlobal" class="btn-primary" style="padding:8px 14px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Operator</button>
        </div>
      </div>

      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_BAHAN" :key="t.target" type="button"
          :class="['sub-pp-bahan-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-bahan-tahap', t.target, $event)">
          <i :class="'fas ' + t.icon" style="margin-right:6px;"></i>{{ t.label }}
        </button>
      </div>

      <div style="display:flex; align-items:center; gap:9px; background:var(--surface); border:1px solid var(--line); border-radius:999px; padding:9px 13px; margin-bottom:12px;">
        <i class="fas fa-magnifying-glass" style="font-size:15px; color:var(--text-faint); flex-shrink:0;"></i>
        <input v-model="cari" type="text" placeholder="Cari bahan, warna, atau no. SPK..." style="flex:1; min-width:0; border:none; outline:none; background:none; font-size:12px; color:var(--text);">
      </div>

      <div v-if="kartuList.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-scroll"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada bahan yang perlu disiapkan</h3>
      </div>

      <div v-else style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px,1fr)); gap:12px;">
        <div v-for="k in kartuList" :key="k.bahanAksesorisId" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
            <div style="min-width:0;">
              <div class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ k.nama }} <span style="color:var(--text-faint); font-weight:600;">{{ k.warna }}</span></div>
              <div style="font-size:11px; color:var(--text-faint); margin-top:2px;">{{ k.namaPola }} &middot; size {{ k.produkSize || '-' }} &middot; rak {{ k.rakId || '-' }}</div>
            </div>
          </div>

          <div style="display:flex; gap:8px; margin-bottom:10px;">
            <div style="flex:1; border:1px dashed var(--line); border-radius:12px; padding:8px 10px; background:var(--ivory-dim);">
              <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Butuh</div>
              <div class="gc-num" style="font-size:14px; font-weight:700;">{{ formatMeter(k.butuh) }}</div>
              <div style="font-size:10px; color:var(--text-faint);">{{ k.jumlahAnak }} anak</div>
            </div>
            <div style="flex:1; border:1px dashed var(--line); border-radius:12px; padding:8px 10px; background:var(--ivory-dim);">
              <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Stok</div>
              <div class="gc-num" style="font-size:14px; font-weight:700;">{{ formatMeter(k.stok) }}</div>
              <div class="gc-num" :style="{ fontSize:'10px', color: k.cukup ? 'var(--ok)' : 'var(--danger)' }">{{ k.cukup ? ('lebih ' + formatMeter(k.selisih)) : ('kurang ' + formatMeter(-k.selisih)) }}</div>
            </div>
          </div>
          <div style="height:6px; border-radius:999px; background:var(--ivory-dim); overflow:hidden; margin-bottom:10px;">
            <div :style="{ height:'100%', width: Math.min(100, k.butuh>0 ? (k.stok/k.butuh*100) : 100) + '%', background: k.cukup ? 'var(--ok)' : 'var(--warn)' }"></div>
          </div>

          <!-- RETROFIT 9 Sep 2026 (temuan #4) — tabel anak SPK SELALU
               TERBUKA sesuai wireframe, collapse "buka rincian" dihapus. -->
          <div style="display:flex; gap:8px; padding:0 7px 5px; font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.03em;">
            <span style="flex:1;">anak spk</span>
            <span style="width:60px; text-align:right;">qty</span>
            <span style="width:70px; text-align:right;">butuh</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
            <label v-for="b in k.baris" :key="b._trackId + '-' + b._lineIdx" style="display:flex; align-items:center; gap:8px; font-size:11px; padding:6px 8px; border-radius:10px;" :style="{ background: b.label_cetak_pada ? 'var(--ok-light)' : (b._bisa ? 'transparent' : 'var(--danger-light)') }">
              <input type="checkbox" :checked="isChecked(b)" :disabled="!b._bisa || !!b.label_cetak_pada" @change="toggleCheck(b)">
              <span class="gc-num" style="font-weight:700; min-width:110px; flex:1;">{{ b.no_spk }}</span>
              <span class="gc-num" style="width:60px; text-align:right;">{{ formatQty(b.qty) }} pcs</span>
              <span class="gc-num" style="width:70px; text-align:right; color:var(--text-faint);">{{ formatMeter(b.kebutuhan_kain) }}</span>
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

      <!-- RETROFIT 9 Sep 2026 (temuan #5) — bar ringkasan sticky + cetak
           massal lintas kartu. TAMBAHAN, tombol cetak per-kartu di atas
           TETAP ADA. Hanya di modul Bahan — dicek ke wireframe.dc.html Acc
           Sewing, bar sejenis TIDAK ada di sana (checkbox di sana cuma
           indikator kesiapan, bukan seleksi cetak), jadi TIDAK disalin ke
           3 file Acc. -->
      <div v-if="ringkasanTerpilih.jumlah > 0" style="position:sticky; bottom:0; margin:14px -20px -20px; padding:12px 20px; background:var(--ivory); border-top:1px solid var(--line); border-radius:0 0 20px 20px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; z-index:5;">
        <div>
          <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">terpilih</div>
          <div class="gc-num" style="font-size:12.5px; font-weight:700;">{{ ringkasanTerpilih.jumlah }} anak SPK &middot; {{ formatMeter(ringkasanTerpilih.meter) }} &middot; {{ ringkasanTerpilih.bahan }} bahan</div>
        </div>
        <button v-if="bolehCetak" @click="cetakSemuaTercentang" class="btn-primary" style="margin-left:auto; padding:10px 18px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Semua yang Tercentang</button>
      </div>
    </div>

    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Label SPK Grouping" :daftar-label="daftarLabelPreview" jenis-cetak="label_spk_bahan" @tutup="popupCetakAktif = false" @cetak="onCetakSelesai" />

    <scan-generik :aktif="modalScanSampai.aktif" judul="Scan Sampai — kode bagging balik dari Masalah" subjudul="Bisa discan berkali-kali." @hasil="hasilScanSampai" @tutup="tutupScanSampai" />
    <div v-if="modalScanSampai.aktif && modalScanSampai.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:260px;">
      <div v-for="(l,i) in modalScanSampai.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>

    <div v-if="popupCetakUlang" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;"><i class="fas fa-rotate" style="margin-right:8px; color:var(--warn);"></i>Cetak Ulang Label</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0 0 10px;">{{ popupCetakUlang.kartu.nama }} {{ popupCetakUlang.kartu.warna }} — dicatat di riwayat cetak ulang.</p>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupCetakUlang.alasan" type="text" placeholder="Mis. label rusak/hilang"></div>
        <div style="display:flex; gap:8px;">
          <button @click="popupCetakUlang = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="lanjutCetakUlang" class="btn-primary" style="flex:1; padding:9px;">Lanjut Verifikasi PIN</button>
        </div>
      </div>
    </div>
    <popup-pin-generik v-if="pinCetakUlangAktif" judul="Verifikasi PIN — Cetak Ulang Label" konteks="Persiapan Bahan - Cetak Ulang Label" @sukses="pinCetakUlangSukses" @batal="batalPinCetakUlang" />

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
// Papan dikelompokkan PER OPERATOR (bukan per bahan) — "diam sejak" per
// baris dihitung dari masuk_tahap_pada (= saat ditunjuk / saat estafet
// terakhir). Per baris: Scan Entry (mengurangi stok, menandai entry_qty),
// Scan Masalah (catatan + ajukan ke modul Masalah, baris TETAP di sini),
// Ganti Operator (estafet shift — scan operator baru, riwayat_operator
// nambah baris baru).
//
// Awalnya (31 Agt 2026) tiap AKSI Entry LANGSUNG memindahkan baris itu
// sendiri ke Perlu Dikirim — penyederhanaan dari wireframe, dicatat saat
// itu "biar Guru bisa koreksi kalau perlu". DIPERBAIKI (7 Sep 2026, task
// #94 "gerbang batch" — keputusan Guru: "ubah jadi gerbang per-SPK sesuai
// wireframe"): sekarang baris per operator dikelompokkan LAGI per SPK
// Grouping (`_trackId`, SAMA konsep "1 kartu 1 SPK" yang dipakai 3 pos Acc
// walau Tab 1 Bahan sendiri berkartu per-bahan bukan per-SPK — lihat
// komentar arsitektur di atas). Scan Entry cuma menandai `entry_qty` tanpa
// pindah status; baris baru pindah SEMUA sekaligus ke Perlu Dikirim lewat
// tombol "Disiapkan" per kelompok SPK, aktif hanya kalau SEMUA baris
// bahan_rincian SPK itu (lintas seluruh trackId, termasuk yang mungkin
// masih di kartu bahan lain kalau SPK ini butuh >1 bahan) sudah minimal
// masuk sedang_disiapkan DAN semua yang sedang_disiapkan sudah ber-
// entry_qty (SERAH-TERIMA §8 uji-terima #5).
//
// DIPERBARUI (7 Sep 2026, retrofit lanjutan §5.18) — Scan Masalah dulu CUMA
// nulis `catatan_masalah` teks bebas (baris tidak pernah benar-benar masuk
// alur Masalah). SEKARANG: setelah scan label dikonfirmasi, popup kecil
// minta "jumlah kurang" (default = seluruh kebutuhan_kain baris ini, bisa
// diedit — baris ini belum pernah di-entry sama sekali jadi wajar defaultnya
// penuh) + alasan, lalu DUA hal terjadi: (1) catatan_masalah tetap ditulis
// ke baris ini (perilaku lama, badge merah tetap tampil di sini), (2)
// `ajukanPersiapanMasalah()` (js/vue-scan-cetak.js) membuat 1 dokumen BARU
// di koleksi `persiapan_masalah` skema 7-tahap (status 'perlu_diajukan'),
// tlc_asal='TLC-BHN', sumber_jalur='bahan'. Baris TIDAK berubah status —
// operator masih bisa Scan Entry normal begitu kekurangan itu terpenuhi
// (via alur Masalah atau stok manual); menghapus catatan_masalah lagi saat
// itu BUKAN bagian retrofit ini (SERAH-TERIMA tidak memintanya).
// ============================================================================
const PersiapanBahanSedangDisiapkan = {
  components: { ScanGenerik },
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const sedangProses = reactive({});
    const sedangProsesBatch = reactive({});
    const menuId = 'pp_bahan';
    const MY_TARGET = 'sub-pp-bahan-sedangdisiapkan';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try { daftarTrack.value = await muatSemuaTrackBahan(); }
      catch (e) { console.error('Gagal muat Bahan > Sedang Disiapkan:', e); daftarTrack.value = []; }
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
        await updateBarisBahanMassal(g.trackId, (x) => x.status === 'sedang_disiapkan', () => ({ status: 'perlu_dikirim', masuk_tahap_pada: now }));
        await muat();
      } catch (e) { console.error('Gagal memindahkan batch Disiapkan:', e); alert('Gagal menyimpan. Coba lagi.'); }
      sedangProsesBatch[g.trackId] = false;
    }

    // --- Scan Entry / Scan Masalah / Ganti Operator (per baris) ---
    const modalAksi = reactive({ aktif: false, mode: null, baris: null }); // mode: 'entry' | 'masalah' | 'ganti'
    function bukaAksi(mode, b) {
      if (sedangProses[barisKey(b)]) return;
      modalAksi.mode = mode; modalAksi.baris = b; modalAksi.aktif = true;
    }
    function tutupAksi() { modalAksi.aktif = false; modalAksi.mode = null; modalAksi.baris = null; }

    // --- Popup "jumlah kurang" + alasan, dibuka SETELAH scan label cocok
    // (retrofit §5.18 lanjutan — lihat komentar besar TAB 2 di atas) ---
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
        const kebutuhan = parseFloat(b.kebutuhan_kain) || 0;
        await updateBarisBahan(b._trackId, b._lineIdx, () => ({ catatan_masalah: p.alasan.trim() }));
        await ajukanPersiapanMasalah({
          tlcAsal: 'TLC-BHN', sumberJalur: 'bahan',
          trackId: b._trackId, lineIdx: b._lineIdx,
          bahanAksesorisId: b.bahan_aksesoris_id, bahanNama: b.bahan_nama, bahanWarna: b.bahan_warna,
          satuan: 'm', noSpk: b.no_spk,
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
          await updateBarisBahan(b._trackId, b._lineIdx, (lama) => ({
            operator_uid: karyawan.id, operator_nama: karyawan.nama || karyawan.name || karyawan.id, ditugaskan_pada: now,
            riwayat_operator: [...(lama.riwayat_operator || []), { operator_uid: karyawan.id, operator_nama: karyawan.nama || karyawan.name || karyawan.id, mulai_pada: now }]
          }));
          tutupAksi(); await muat();
        } catch (e) { console.error('Gagal ganti operator:', e); alert('Gagal menyimpan. Coba lagi.'); }
        sedangProses[key] = false;
        return;
      }
      // entry / masalah: kode HARUS scan label baris ini sendiri (konfirmasi
      // "yang mau diproses memang barang ini").
      if (kode !== b.no_spk) { alert(`Kode yang discan ("${kode}") tidak cocok dengan anak SPK ini (${b.no_spk}).`); return; }
      if (modalAksi.mode === 'masalah') {
        // Retrofit §5.18 lanjutan — jangan langsung tulis, buka popup jumlah
        // kurang + alasan dulu (lihat komentar besar TAB 2 di atas).
        tutupAksi();
        popupMasalah.value = { baris: b, jumlahKurang: b.kebutuhan_kain, alasan: '' };
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

    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-bahan-tahap'); await window.authReady; await muat(); });

    return {
      memuat, kelompokOperator, bolehProses, sedangProses, sedangProsesBatch, konfirmasiDisiapkan,
      formatMeter, formatQty, formatDiamSejak, tertahan, barisKey,
      modalAksi, bukaAksi, tutupAksi, hasilScanAksi,
      popupMasalah, batalMasalah, konfirmasiMasalah,
      TAB_DEFS_BAHAN, gantiTabPill, MY_TARGET
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Bahan</h3>
          <div class="sub">{{ kelompokOperator.length }} operator sedang menyiapkan</div>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_BAHAN" :key="t.target" type="button"
          :class="['sub-pp-bahan-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-bahan-tahap', t.target, $event)">
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
                <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:6px;">{{ b.bahan_nama }} {{ b.bahan_warna }} &middot; {{ formatMeter(b.kebutuhan_kain) }} &middot; {{ b.nama_produk }}</div>
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
        <p style="font-size:11px; color:var(--text-faint); margin:0 0 10px;">{{ popupMasalah.baris.bahan_nama }} {{ popupMasalah.baris.bahan_warna }} — akan masuk ke Persiapan Produksi &gt; Masalah utk diajukan ke Owner.</p>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah kurang (m)</label><input v-model="popupMasalah.jumlahKurang" type="number" min="0" step="0.1"></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="Mis. roll rusak/stok fisik kurang"></div>
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
// Papan hanya baris berstatus perlu_dikirim ("masih tertahan"). Dua cetak:
// Kode Bagging (blank, tanpa TLC, terbit N label sekaligus) dan Kode Tugas
// (tujuan TLC dari dropdown). Dua scan: Scan Pack (kode bagging + scan
// anak SPK berkali-kali, syarat sepack pola+bahan+size sama) dan Scan
// Kirim (kode tugas + scan kode bagging tiap pack -> baris pindah ke
// Sedang Dikirim).
// ============================================================================
const PersiapanBahanPerluDikirim = {
  components: { PopupPratinjauCetakLabel, ScanGenerik },
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const daftarBaggingAktif = ref([]); // bagging belum ditutup
    const daftarTlc = ref([]);
    const sedangProses = ref(false);
    const menuId = 'pp_bahan';
    const MY_TARGET = 'sub-pp-bahan-perludikirim';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const [tracks, baggingSnap, tlcSnap] = await Promise.all([
          muatSemuaTrackBahan(),
          getDocs(query(collection(db, 'bagging'), where('ditutup_pada', '==', null))),
          getDocs(collection(db, 'master_tlc'))
        ]);
        daftarTrack.value = tracks;
        daftarBaggingAktif.value = baggingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        daftarTlc.value = tlcSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error('Gagal muat Bahan > Perlu Di Kirim:', e);
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

    // --- Cetak Kode Bagging (blank, batch N label, tanpa TLC) ---
    const popupBagging = ref(null); // { sepackKey, jumlah }
    function bukaCetakBagging() {
      if (!kelompokSepack.value.length) { alert('Tidak ada baris di tab ini.'); return; }
      popupBagging.value = { sepackKey: kelompokSepack.value[0].key, jumlah: 1 };
    }
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    // jenisCetakAktif — BARU (8 Sep 2026) — popup di bawah dipakai BERGANTIAN
    // oleh konfirmasiCetakBagging (kode_bagging) & konfirmasiCetakTugas
    // (lembar_kode_tugas), jadi jenis-cetak-nya ikut nilai ref ini, diset
    // pas masing2 fungsi ngisi daftarLabelPreview.
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

    // --- Cetak Kode Tugas (tujuan TLC dari dropdown, tanpa daftar pack) ---
    const popupTugas = ref(null); // { tlcTujuan }
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
          kode, tlc_asal: 'TLC-BHN', tlc_tujuan: p.tlcTujuan, pack: [],
          dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
        });
        daftarLabelPreview.value = [{ kode, nama: 'Kode Tugas Kirim', info: `TLC-BHN &rarr; ${p.tlcTujuan}`, qrDataUrl: buatQrDataUrl(kode) }];
        jenisCetakAktif.value = 'lembar_kode_tugas';
        popupTugas.value = null;
        popupCetakAktif.value = true;
      } catch (e) { console.error('Gagal cetak kode tugas:', e); alert('Gagal membuat kode tugas. Coba lagi.'); }
      sedangProses.value = false;
    }

    // --- Seed master_tlc (kalau kosong) — daftar dari SERAH-TERIMA §5 ---
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

    // --- Scan Pack: step1 kode bagging, step2 anak SPK berkali-kali ---
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
      const target = barisTertahan.value.find(x => x.no_spk === kode && !x.kode_bagging);
      if (!target) { alert(`Kode "${kode}" tidak cocok anak SPK yang masih tertahan / sudah di-pack.`); return; }
      // syarat sepack (SERAH-TERIMA §3): pola+bahan+size harus sama dengan
      // produk yang dipilih SAAT kode bagging ini dicetak (bagging.produk_label
      // = labelSepack() persis, lihat konfirmasiCetakBagging). Warna & no SPK
      // boleh beda -> makanya dibandingkan labelnya, bukan bahan_aksesoris_id.
      if (labelSepack(target) !== modalPack.bagging.produk_label) {
        alert(`Kode "${kode}" bukan produk yang sama dengan bagging ini (${modalPack.bagging.produk_label}). Syarat sepack: pola, bahan, dan size harus sama.`);
        return;
      }
      try {
        await updateBarisBahan(target._trackId, target._lineIdx, () => ({ kode_bagging: modalPack.bagging.kode }));
        await updateDoc(doc(db, 'bagging', modalPack.bagging.id), { isi: arrayUnion(target.no_spk) });
        modalPack.log.unshift(target.no_spk + ' -> ' + modalPack.bagging.kode);
        target.kode_bagging = modalPack.bagging.kode;
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
      const anggota = barisTertahan.value.filter(x => x.kode_bagging === kode);
      if (!anggota.length) { alert(`Kode bagging "${kode}" tidak ditemukan di antara yang masih tertahan (mungkin belum di-pack, atau sudah dikirim).`); return; }
      const now = new Date().toISOString();
      try {
        await Promise.all(anggota.map(b => updateBarisBahan(b._trackId, b._lineIdx, () => ({
          status: 'sedang_dikirim', masuk_tahap_pada: now, kode_tugas: modalKirim.tugas.kode,
          // BARU (1 Sep 2026) — snapshot tujuan TLC di baris itu sendiri
          // (bukan cuma kode_tugas), supaya Tab 5 (Selesai) tidak perlu
          // query balik ke tugas_kirim buat tampilkan kolom "tujuan TLC".
          tlc_tujuan: modalKirim.tugas.tlc_tujuan || ''
        }))));
        await updateDoc(doc(db, 'tugas_kirim', modalKirim.tugas.id), { pack: arrayUnion({ kode_bagging: kode, pada: now }) });
        modalKirim.log.unshift(kode + ' (' + anggota.length + ' item) -> ' + modalKirim.tugas.kode);
      } catch (e) { console.error('Gagal scan kirim:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-bahan-tahap'); await window.authReady; await muat(); });

    return {
      memuat, kelompokSepack, daftarTlc, bolehProses, bolehCetak, sedangProses,
      formatMeter, formatQty, formatDiamSejak, tertahan,
      popupBagging, bukaCetakBagging, konfirmasiCetakBagging,
      popupTugas, bukaCetakTugas, konfirmasiCetakTugas, isiTlcAwal,
      popupCetakAktif, daftarLabelPreview, jenisCetakAktif,
      modalPack, bukaScanPack, tutupScanPack, hasilScanPack, tutupBagging,
      modalKirim, bukaScanKirim, tutupScanKirim, hasilScanKirim,
      TAB_DEFS_BAHAN, gantiTabPill, MY_TARGET
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Bahan</h3>
          <div class="sub">{{ kelompokSepack.length }} produk tertahan di Perlu Di Kirim</div>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_BAHAN" :key="t.target" type="button"
          :class="['sub-pp-bahan-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-bahan-tahap', t.target, $event)">
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
            <div v-for="b in g.baris" :key="b._trackId+'-'+b._lineIdx" style="display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:11px; padding:6px 8px; border-radius:10px;" :style="{ background: tertahan(b.masuk_tahap_pada) ? 'var(--warn-light)' : 'transparent' }">
              <span class="gc-num" style="font-weight:700;">{{ b.no_spk }}</span>
              <span style="color:var(--text-faint);">{{ b.bahan_nama }} {{ b.bahan_warna }}</span>
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
// TAB 4: Sedang Di Kirim (langkah wireframe 4a -> 4b)
// VIEW-ONLY dengan sengaja — "Layar scan sampai (divisi penerima)" ada di
// luar lingkup modul ini (SERAH-TERIMA §4 Scope: "belum digambar"). Baris
// keluar dari sini nanti lewat layar itu, BUKAN dari sini — jadi TIDAK ada
// tombol aksi apapun di tab ini, cuma papan info dikelompokkan per kode
// tugas (SERAH-TERIMA §3: "satu tugas boleh jalan sebagian").
// ============================================================================
const PersiapanBahanSedangDikirim = {
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    async function muat() {
      memuat.value = true;
      try { daftarTrack.value = await muatSemuaTrackBahan(); }
      catch (e) { console.error('Gagal muat Bahan > Sedang Di Kirim:', e); daftarTrack.value = []; }
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
    const MY_TARGET = 'sub-pp-bahan-sedangdikirim';
    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-bahan-tahap'); await window.authReady; await muat(); });
    return { memuat, kelompokTugas, formatMeter, formatQty, formatDiamSejak, TAB_DEFS_BAHAN, gantiTabPill, MY_TARGET };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Bahan</h3>
          <div class="sub">{{ kelompokTugas.length }} kode tugas sedang di jalan</div>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_BAHAN" :key="t.target" type="button"
          :class="['sub-pp-bahan-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-bahan-tahap', t.target, $event)">
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
          <div v-for="b in g.baris" :key="b._trackId+'-'+b._lineIdx" style="display:flex; justify-content:space-between; gap:8px; font-size:11px;">
            <span class="gc-num" style="font-weight:700;">{{ b.no_spk }}</span>
            <span style="color:var(--text-faint);">{{ b.bahan_nama }} {{ b.bahan_warna }} &middot; {{ formatMeter(b.kebutuhan_kain) }}</span>
            <span class="gc-num" style="color:var(--text-faint);">{{ b.kode_bagging }}</span>
          </div>
        </div>
      </div>
    </div>
    </div>
  `
};

// ============================================================================
// TAB 5: Selesai — riwayat (BARU, 1 Sep 2026, retrofit dari SERAH-TERIMA.md
// yang diperbarui Guru — sebelumnya placeholder kosong sejak 31 Agt 2026).
//
// PENTING — batas tanggung jawab file ini: baris pindah ke status 'selesai'
// SAAT DIVISI PENERIMA SCAN SAMPAI (mis. Proses Produksi > Potong), BUKAN
// saat pos ini Scan Kirim (SERAH-TERIMA §2/§3: "selama pack di jalan
// tanggung jawabnya belum lepas" dari pos Bahan). Layar "Scan Sampai" itu
// SENDIRI secara eksplisit DI LUAR LINGKUP modul ini (SERAH-TERIMA §4:
// "Layar scan sampai | divisi penerima (belum digambar)") — jadi tab ini
// HANYA MEMBACA field `status`/`sampai_pada` yang nantinya ditulis modul
// LAIN yang belum dibangun di manapun di sistem ini. Sampai modul itu ada,
// tab ini akan tampil KOSONG terus — itu BUKAN bug di file ini.
//
// Sesuai instruksi Guru (1 Sep 2026, "bangun sekarang, retrofit ke Bahan"):
// dibangun PENUH sesuai kolom+KPI+siklus di SERAH-TERIMA §2, ditambah versi
// mobile "Riwayat Saya" (operator hanya lihat baris yang PERNAH ia scan,
// tanpa tombol aksi apapun — ini bukti kerja, bukan tempat memperbaiki).
// Retensi data: BELUM ditentukan Guru (SERAH-TERIMA §7 masih menandainya
// "belum diputuskan") — diasumsikan TANPA batas waktu dulu (tidak dihapus
// otomatis), sampai Guru tentukan lain.
// ============================================================================
const PersiapanBahanSelesai = {
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);

    async function muat() {
      memuat.value = true;
      try { daftarTrack.value = await muatSemuaTrackBahan(); }
      catch (e) { console.error('Gagal muat Bahan > Selesai:', e); daftarTrack.value = []; }
      memuat.value = false;
    }

    // Operator biasa (bukan admin/pic/owner/superuser) HANYA melihat baris
    // yang PERNAH ia scan sendiri (SERAH-TERIMA §2 "Riwayat saya") — bukan
    // soal izin menu (operator MEMANG boleh buka menu ini), tapi soal cakupan
    // tampilan. Admin-level tetap lihat papan riwayat penuh + KPI.
    const isOperatorSaja = computed(() => (window.currentUser?.role || '').toLowerCase() === 'operator');

    const semuaSelesai = computed(() => daftarBarisDariTrack(daftarTrack.value).filter(b => b.status === 'selesai'));
    const barisSaya = computed(() => semuaSelesai.value.filter(b => b.operator_uid && b.operator_uid === window.currentUser?.email)
      .sort((a, b) => new Date(b.sampai_pada || 0) - new Date(a.sampai_pada || 0)));

    // KPI di-scope "hari ini" (SERAH-TERIMA §2: "selesai hari itu, ...") —
    // dasar tanggalnya `sampai_pada` (kapan baris itu BENAR-BENAR tuntas).
    const selesaiHariIni = computed(() => semuaSelesai.value.filter(b => hariIniSama(b.sampai_pada)));
    const kpi = computed(() => {
      const list = selesaiHariIni.value;
      const kainTerpakai = list.reduce((s, b) => s + (parseFloat(b.entry_qty) || 0), 0);
      const siklusList = list.map(siklusJam).filter(j => j !== null);
      const rataSiklus = siklusList.length ? (siklusList.reduce((a, b) => a + b, 0) / siklusList.length) : null;
      const terpaksaKurang = list.filter(b => !!b.catatan_masalah).length;
      const operatorSet = new Set(list.map(b => b.operator_uid).filter(Boolean));
      return {
        selesai: list.length, kainTerpakai, rataSiklus,
        terpaksaKurang, operatorTerlibat: operatorSet.size
      };
    });

    const daftarUrut = computed(() => [...semuaSelesai.value].sort((a, b) => new Date(b.sampai_pada || 0) - new Date(a.sampai_pada || 0)));

    function keadaan(b) { return b.catatan_masalah ? 'kurang' : 'lengkap'; }

    const MY_TARGET = 'sub-pp-bahan-selesai';
    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-bahan-tahap'); await window.authReady; await muat(); });

    return {
      memuat, isOperatorSaja, barisSaya, daftarUrut, kpi,
      formatMeter, formatQty, formatWaktu, formatSiklus, siklusJam, keadaan,
      TAB_DEFS_BAHAN, gantiTabPill, MY_TARGET
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <!-- isOperatorSaja: versi mobile "Riwayat Saya" TETAP TANPA gc-card-head/
         tab pill (wireframe menggambarkannya sbg layar operator tersendiri,
         "bukti kerja", bukan dashboard bertab — beda dari versi admin di
         bawah yang memang wireframe-nya bertab). -->
    <template v-else-if="isOperatorSaja">
      <!-- Versi mobile/operator: "Riwayat Saya" — tanpa tombol, tanpa KPI.
           Bukti kerja, bukan tempat memperbaiki (SERAH-TERIMA §2). -->
      <div v-if="barisSaya.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-clock-rotate-left"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0 0 4px;">Belum ada riwayat</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0;">Baris yang pernah Anda scan entry akan muncul di sini setelah tuntas diterima.</p>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:8px;">
        <div v-for="b in barisSaya" :key="b._trackId+'-'+b._lineIdx" class="gc-card gc-card-menonjol" style="padding:12px; border-radius:16px;">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:4px;">
            <span class="gc-num" style="font-weight:700; font-size:12px;">{{ b.no_spk }}</span>
            <span class="tag" :class="keadaan(b)==='lengkap' ? 'ok' : 'warn'">{{ keadaan(b) }}</span>
          </div>
          <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:6px;">{{ b.bahan_nama }} {{ b.bahan_warna }} &middot; {{ formatMeter(b.kebutuhan_kain) }}</div>
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
          <h3 class="gc-heading">Persiapan Bahan</h3>
          <div class="sub">{{ kpi.selesai }} selesai hari ini</div>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_BAHAN" :key="t.target" type="button"
          :class="['sub-pp-bahan-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-bahan-tahap', t.target, $event)">
          <i :class="'fas ' + t.icon" style="margin-right:6px;"></i>{{ t.label }}
        </button>
      </div>
      <!-- Versi admin/pic: KPI + papan riwayat penuh (SERAH-TERIMA §2). -->
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
        <div style="flex:1; min-width:110px; border:1px dashed var(--line); border-radius:12px; padding:8px 10px; background:var(--ivory-dim);">
          <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Selesai hari ini</div>
          <div class="gc-num" style="font-size:16px; font-weight:700;">{{ kpi.selesai }}</div>
        </div>
        <div style="flex:1; min-width:110px; border:1px dashed var(--line); border-radius:12px; padding:8px 10px; background:var(--ivory-dim);">
          <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Kain terpakai</div>
          <div class="gc-num" style="font-size:16px; font-weight:700;">{{ formatMeter(kpi.kainTerpakai) }}</div>
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
            <tr v-for="b in daftarUrut" :key="b._trackId+'-'+b._lineIdx" style="border-bottom:1px solid var(--line);">
              <td style="padding:6px 8px;">
                <div class="gc-num" style="font-weight:700;">{{ b.kode_spk }}</div>
                <div style="font-size:9.5px; color:var(--text-faint);">label {{ formatWaktu(b.label_cetak_pada) }}</div>
              </td>
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

// --- Mount ke index.html — LAZY, SAMA pola seperti 4 jalur lain
// (JalurTahapManager di vue-persiapan-produksi-v2.js): fungsi
// window.pastikanMountPpBahanXxx() dipanggil oleh pindahSubTab() (js/
// dashboard.js, peta `petaMount`) PERTAMA KALI tab itu dibuka — bukan
// mount semua 5 sekaligus saat halaman dimuat (hemat, konsisten). ---------
let vmPpBahanPerluDisiapkan = null;
window.pastikanMountPpBahanPerluDisiapkan = function () {
  if (vmPpBahanPerluDisiapkan) return;
  const mountPoint = document.getElementById('vue-pp-bahan-perludisiapkan');
  if (mountPoint) vmPpBahanPerluDisiapkan = createApp(PersiapanBahanPerluDisiapkan).mount('#vue-pp-bahan-perludisiapkan');
};
let vmPpBahanSedangDisiapkan = null;
window.pastikanMountPpBahanSedangDisiapkan = function () {
  if (vmPpBahanSedangDisiapkan) return;
  const mountPoint = document.getElementById('vue-pp-bahan-sedangdisiapkan');
  if (mountPoint) vmPpBahanSedangDisiapkan = createApp(PersiapanBahanSedangDisiapkan).mount('#vue-pp-bahan-sedangdisiapkan');
};
let vmPpBahanPerluDikirim = null;
window.pastikanMountPpBahanPerluDikirim = function () {
  if (vmPpBahanPerluDikirim) return;
  const mountPoint = document.getElementById('vue-pp-bahan-perludikirim');
  if (mountPoint) vmPpBahanPerluDikirim = createApp(PersiapanBahanPerluDikirim).mount('#vue-pp-bahan-perludikirim');
};
let vmPpBahanSedangDikirim = null;
window.pastikanMountPpBahanSedangDikirim = function () {
  if (vmPpBahanSedangDikirim) return;
  const mountPoint = document.getElementById('vue-pp-bahan-sedangdikirim');
  if (mountPoint) vmPpBahanSedangDikirim = createApp(PersiapanBahanSedangDikirim).mount('#vue-pp-bahan-sedangdikirim');
};
let vmPpBahanSelesai = null;
window.pastikanMountPpBahanSelesai = function () {
  if (vmPpBahanSelesai) return;
  const mountPoint = document.getElementById('vue-pp-bahan-selesai');
  if (mountPoint) vmPpBahanSelesai = createApp(PersiapanBahanSelesai).mount('#vue-pp-bahan-selesai');
};

// Tab pertama ("Perlu Disiapkan") ke-mount begitu menu Bahan dibuka —
// tombol #menu-pp-bahan-btn (index.html) sudah eksplisit manggil
// pindahSubTab('sub-pp-bahan-tahap','sub-pp-bahan-perludisiapkan', ...),
// yang lewat petaMount (js/dashboard.js) memanggil pastikanMountPpBahan-
// PerluDisiapkan() di atas — TIDAK perlu dipanggil manual di sini (pola
// SAMA seperti pastikanMountPpDisiapkan di vue-persiapan-produksi-v2.js).
