// js/vue-persiapan-bahan.js
// Persiapan Produksi > Bahan. Pos penyiapan KAIN: satu kartu = satu bahan +
// warna (pos acc lain satu kartu satu SPK), karena satu kain dipakai bareng
// beberapa anak SPK. 5 tab, Perlu Disiapkan sampai Selesai.
//
// Koleksi & field:
// - spk_track (jalur=='bahan'), dibaca semua status dokumen. Isi kerjanya di
//   array bahan_rincian[], 1 baris per (bahan x anak SPK): status, qty,
//   kebutuhan_kain, masuk_tahap_pada, operator_uid, riwayat_operator[],
//   entry_qty, kode_bagging, kode_tugas.
// - master_bahan_aksesoris.stok_akhir: dikurangi saat scan entry.
// - bagging, tugas_kirim, master_tlc, cetak_ulang_log: kemasan, kiriman
//   antar TLC, dan log cetak ulang label.
//
// Jebakan:
// - Progres UI dibaca dari `status` PER BARIS bahan_rincian, bukan status
//   dokumen; satu dokumen bisa punya baris di tahap berbeda sekaligus.
// - Tulis balik wajib runTransaction read-modify-write (updateBarisBahan),
//   bukan arrayUnion. Scan entry menulis spk_track + master_bahan_aksesoris
//   dalam satu transaksi. Ambang tertahan >6 jam sejak masuk_tahap_pada.

import { createApp, ref, reactive, computed, watch, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel, bangunInfoLabelAnakSpk } from './vue-components.js?v=13';
import { ScanGenerik, ScanTerpaduGenerik, buatScanTerpadu, PopupPinGenerik, buatQrDataUrl, muatJsQr, cariKaryawanByQr, ajukanPersiapanMasalah } from './vue-scan-cetak.js?v=9';
import { aksiAktif, pastikanCachePilihanScan } from './vue-popup-scan.js?v=6';

// picOwnerKeAtas — gerbang aksi "Scan Operator": WAJIB akun tier PIC ke atas
// (pic/pic_owner/owner/superuser), TANPA popup PIN — cukup akun yang login
// memang tier itu.
function picOwnerKeAtas(userData) {
  if (!userData) return false;
  const role = (userData.role || '').toLowerCase();
  return role === 'owner' || role === 'superuser' || role === 'pic';
}

// Format & hitung kecil
function formatMeter(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' m';
}
function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
const AMBANG_TERTAHAN_JAM = 6; // keputusan, — sama semua tab/pos
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
// hariIniSama — dipakai KPI Tab 5 (Selesai), bandingkan tanggal LOKAL device .
function hariIniSama(iso) {
  if (!iso) return false;
  const d = new Date(iso), now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
// siklusJam — : "jam cetak label -> jam scan sampai", ikut menghitung lama
// menunggu ditugaskan (mengukur pos INI, bukan pos penerima). null kalau salah
// satu jam belum ada.
function siklusJam(b) {
  if (!b.label_cetak_pada || !b.sampai_pada) return null;
  return (new Date(b.sampai_pada).getTime() - new Date(b.label_cetak_pada).getTime()) / 3600000;
}
function formatSiklus(jam) {
  if (jam === null || jam === undefined || isNaN(jam)) return '-';
  if (jam < 1) return Math.max(1, Math.round(jam * 60)) + ' menit';
  return jam.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jam';
}

// Kode harian berurut (bagging & tugas kirim). Counter doc TERPISAH per JENIS
// supaya bagging & tugas kirim tidak berebut angka.
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

// Baca & ratakan spk_track jalur='bahan'. Query cuma equality 1 field (jalur) ->
// kepakai single-field index bawaan Firestore, TIDAK butuh index composite baru
// (beda dari 4 jalur lain yang query where('jalur')+where('status')).
async function muatSemuaTrackBahan() {
  const snap = await getDocs(query(collection(db, 'spk_track'), where('jalur', '==', 'bahan')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
// saringMilikOperator — operator hanya lihat baris yang ditugaskan ke dirinya
// (lewat Scan Operator); role lain lihat semua baris.
function saringMilikOperator(barisList) {
  if ((window.currentUser?.role || '').toLowerCase() !== 'operator') return barisList;
  return barisList.filter(b => b.operator_uid && b.operator_uid === window.currentUser?.email);
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

// updateBarisBahan — read-modify-write ATOMIK 1 elemen
// spk_track.bahan_rincian[N]. arrayUnion/arrayRemove tidak dipakai karena yang
// diubah elemen yang SUDAH ADA, dan Firestore tidak punya "update elemen array
// ke-N". runTransaction mencegah 2 scan hampir bersamaan saling menimpa.
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

// updateBarisBahanMassal — patch SEMUA elemen bahan_rincian[] yang lolos matchFn
// dalam SATU transaksi; dipakai tombol "Disiapkan" yang memindahkan seluruh
// baris satu trackId sekaligus.
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

// konfirmasiEntry — SATU-SATUNYA tempat stok master_bahan_aksesoris berkurang.
// Transaksi rangkap 2 dokumen (spk_track + master_bahan_aksesoris) supaya
// atomik. Status baris TETAP 'sedang_disiapkan' sesudah entry — perpindahan
// tahap dilakukan konfirmasiDisiapkan (batch 1 trackId), lihat Tab 2 di bawah.
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

// kelompokKartuBahan — kelompokkan baris (sudah difilter status) jadi kartu per
// bahan+pola; "butuh" = jumlah kebutuhan_kain kartu itu, kumulatif LINTAS SPK.
// "stok" dikunci ke bahan_aksesoris_id MENTAH (stok fisik per bahan, bukan per
// pola) — RISIKO: 2 kartu pola beda yang berbagi bahan bisa sama-sama "cukup".
function kelompokKartuBahan(barisList, petaStokBahan) {
  const peta = {};
  barisList.forEach(b => {
    const bahanId = b.bahan_aksesoris_id;
    if (!bahanId) return;
    const key = bahanId + '::' + (b.nama_pola || '');
    if (!peta[key]) {
      const info = petaStokBahan[bahanId] || {};
      peta[key] = {
        kartuKey: key, bahanAksesorisId: bahanId, nama: b.bahan_nama, warna: b.bahan_warna,
        // namaProduk diambil dari baris pertama kartu — kartu ini pasti 1 pola
        // yang sama, tapi produk/size masih bisa beda antar anak SPK; rincian
        // akurat per-produk ada di baris anak SPK masing-masing.
        namaProduk: b.nama_produk || '',
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
  // stok masih menutupi kumulatif berjalan — dukung "kalau stok cuma cukup buat
  // sebagian, sebagian itu boleh jalan dulu" .
  list.forEach(k => {
    const urut = [...k.baris].sort((a, b2) => (a.kebutuhan_kain || 0) - (b2.kebutuhan_kain || 0));
    let sisa = k.stok;
    urut.forEach(b => { b._bisa = sisa >= (b.kebutuhan_kain || 0); if (b._bisa) sisa -= (b.kebutuhan_kain || 0); });
  });
  // urut kartu: stok kurang dulu
  list.sort((a, b) => (a.cukup === b.cukup) ? (a.selisih - b.selisih) : (a.cukup ? 1 : -1));
  return list;
}

// kunciSepack — "syarat sepack" : pola, BAHAN (nama, bukan warna), dan size
// sama; warna & no SPK boleh beda.
function kunciSepack(b) { return `${b.nama_pola}::${b.bahan_nama}::${b.produk_size}`.toLowerCase(); }
function labelSepack(b) { return `${b.nama_pola} · ${b.bahan_nama} · ${b.produk_size || '-'}`; }

// Komponen kamera fullscreen dipakai lewat ScanGenerik di js/vue-scan-cetak.js,
// diimpor bersama oleh file-file Persiapan Produksi.


// Pill tab di bawah dirender DI DALAM card tiap komponen memakai class
// 'sub-pp-bahan-tahap-btn' + data-target PERSIS SAMA dengan baris tombol asli di
// index.html — window.pindahSubTab men-toggle 'active' lewat querySelectorAll,
// jadi keduanya sinkron. Baris tombol asli disembunyikan runtime lewat DOM.

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

// TAB 1: Perlu Disiapkan. Kartu per bahan+warna: cek stok + centang baris yang
// bisa jalan + cetak label, badge "sudah dicetak" + cetak ulang (PIN+alasan),
// lalu penunjukan (scan operator + scan label anak SPK berkali-kali).

const PersiapanBahanPerluDisiapkan = {
  components: { PopupPratinjauCetakLabel, ScanGenerik, ScanTerpaduGenerik, PopupPinGenerik },
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const petaStokBahan = ref({});
    const cari = ref('');
    const pilihanCetak = reactive({}); // barisKey -> bool (override manual)
    const sedangProses = reactive({});

    const menuId = 'pp_bahan';
    const MY_TARGET = 'sub-pp-bahan-perludisiapkan';
    // satu-satunya pemakai bolehProses di komponen ini adalah tombol "Scan
    // Operator", jadi digerbang langsung PIC ke atas di sini.
    const bolehProses = computed(() => picOwnerKeAtas(window.currentUser) && window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);
    // bolehEdit — gerbang tombol "Scan Sampai": Admin BOLEH scan masalah/sampai
    // di tab ini tapi TIDAK BOLEH scan operator (itu PIC ke atas lewat
    // bolehProses), jadi sengaja dipisah dari bolehProses.
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
      const baris = saringMilikOperator(daftarBarisDariTrack(daftarTrack.value).filter(b => b.status === 'perlu_disiapkan'));
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

    // jumlahSiapDicetak — dipakai subjudul gc-card-head.
    const jumlahSiapDicetak = computed(() => kartuList.value.filter(k => k.baris.some(b => b._bisa && !b.label_cetak_pada)).length);

    // ringkasanTerpilih — dasar bar footer sticky, dihitung LINTAS SEMUA kartu
    // yang lagi tampil (bukan cuma 1 kartu).
    const ringkasanTerpilih = computed(() => {
      let jumlah = 0, meter = 0; const bahanSet = new Set();
      kartuList.value.forEach(k => {
        k.baris.forEach(b => {
          if (isChecked(b) && b._bisa && !b.label_cetak_pada) { jumlah++; meter += (parseFloat(b.kebutuhan_kain) || 0); bahanSet.add(k.bahanAksesorisId); }
        });
      });
      return { jumlah, meter, bahan: bahanSet.size };
    });

    // Cetak label (1a -> 1b)
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    let _pendingCetak = [];
    // bangunLabelBahan — dipakai jalur cetak (normal & ulang) DAN template kartu
    // di bawah, supaya kartu di layar & label fisik selalu identik. Sengaja
    // tanpa qrDataUrl (mahal per render) — pemanggil cetak menambah sendiri.
    // `rincian.lokasi_rak` tampil/tidak diatur rincian_aktif di Pengaturan Cetak.
    function bangunLabelBahan(b, opsi = {}) {
      const kodeInduk = b.kode_spk;
      // kode label (teks besar + isi QR): kode_komponen = level PALING DETAIL
      // (per anak SPK), fallback berturut ke level lebih kasar untuk data lama.
      // Fallback chain ini WAJIB PERSIS SAMA dengan cocokLabel/hasilScanAksi,
      // supaya yang dicetak selalu cocok dengan yang discan.
      const kodeLabel = b.kode_komponen || b.kode_anak_spk || b.kode_kartu || `${kodeInduk}-${b.bahan_aksesoris_id}`;
      // b.nama_produk disalin dari level spk_track oleh daftarBarisDariTrack —
      // SUDAH nama murni, BUKAN string komposit "Nama Warna Size" seperti
      // order_spk.nama_produk.
      const namaProduk = `${b.nama_produk || ''} ${b.produk_warna || ''}`.trim() || kodeInduk;
      const baris3 = b.bahan_nama || '(tanpa nama bahan)';
      // formatMeter SUDAH menambahkan satuan " m" di belakang angka, jadi tidak
      // perlu field satuan terpisah (Bahan/kain SELALU diukur meter).
      const baris4 = `${b.bahan_warna || '-'} &middot; ${formatMeter(b.kebutuhan_kain || 0)}`;
      return {
        kode: kodeLabel,
        nama: namaProduk,
        info: bangunInfoLabelAnakSpk([baris3, baris4], b.pelanggan_nama, opsi),
        rincian: { lokasi_rak: b.rak_label || '' }
      };
    }
    // bangunPreviewDariBaris — 1 label = 1 ANAK SPK, TIDAK PERNAH digabung (tiap
    // anak SPK dilacak sendiri saat pack/unpack/kirim/sampai/operator). Beda dari
    // kartu di layar (kelompokKartuBahan) yang boleh menggabung banyak anak SPK.
    // qrDataUrl ditambah di sini supaya QR digambar cuma untuk label yang dicetak.
    function bangunPreviewDariBaris(daftarBaris) {
      return daftarBaris.map(b => {
        const lbl = bangunLabelBahan(b);
        return { ...lbl, qrDataUrl: buatQrDataUrl(lbl.kode) };
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
    // cetakSemuaTercentang — versi LINTAS KARTU dari cetakLabelKartu, dipicu
    // tombol footer sticky; cetak per-kartu TETAP ADA, ini tambahan.
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

    // Cetak ulang: alasan + PIN diverifikasi kriptografis, dicatat ke koleksi
    // cetak_ulang_log. Baris yang mau dicetak ulang WAJIB dicentang satu-satu
    // (pilihan mulai kosong) — supaya tidak semua label kartu ikut tercetak
    // ulang sekaligus dan boros kertas.
    const popupCetakUlang = ref(null); // { kartu, alasan, pilihan: {barisKey: boolean} }
    const pinCetakUlangAktif = ref(false);
    function bukaCetakUlang(k) {
      if (!k.baris.some(b => b.label_cetak_pada)) return;
      popupCetakUlang.value = { kartu: k, alasan: '', pilihan: {} };
    }
    function barisTerpilihCetakUlang() {
      const p = popupCetakUlang.value;
      if (!p) return [];
      return p.kartu.baris.filter(b => b.label_cetak_pada && p.pilihan[barisKey(b)]);
    }
    function lanjutCetakUlang() {
      const p = popupCetakUlang.value;
      if (!p) return;
      if (!p.alasan.trim()) { alert('Alasan cetak ulang wajib diisi.'); return; }
      if (!barisTerpilihCetakUlang().length) { alert('Pilih minimal 1 label yang mau dicetak ulang.'); return; }
      pinCetakUlangAktif.value = true;
    }
    function batalPinCetakUlang() { pinCetakUlangAktif.value = false; }
    async function pinCetakUlangSukses(user) {
      pinCetakUlangAktif.value = false;
      const p = popupCetakUlang.value;
      if (!p) return;
      const sudahDicetak = barisTerpilihCetakUlang(); // HANYA yang dicentang, bukan semua isi kartu
      if (!sudahDicetak.length) { popupCetakUlang.value = null; return; }
      // 1 label per anak SPK, dibangun lewat bangunLabelBahan bersama
      // (opsi.cetakUlang:true menambah "(CETAK ULANG)") supaya formatnya persis
      // sama dengan cetak normal; qrDataUrl ditambah di sini.
      const preview = sudahDicetak.map(b => {
        const lbl = bangunLabelBahan(b, { cetakUlang: true });
        return { ...lbl, qrDataUrl: buatQrDataUrl(lbl.kode) };
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

    // Scan Operator — PILOT #5 (Draft/Upload), gantikan modalTunjuk lama.
    // kartuAktifTunjuk null = cari di SEMUA kartu tab ini (tombol toolbar),
    // object = kartu spesifik (tombol per-kartu) — diset SEBELUM buka() lewat
    // closure, karena buatScanTerpadu.buka() sendiri tidak menerima parameter.
    // "Ganti" di chip mengosongkan draft juga (belum ada yang tertulis kalau
    // belum Upload), beda dari versi lama yang niatnya (tidak pernah jalan)
    // mempertahankan baris lama saat ganti operator di tengah sesi.
    let kartuAktifTunjuk = null;
    function cariBarisSiapTunjuk(kode) {
      const kolamBaris = kartuAktifTunjuk ? (kartuAktifTunjuk.baris || []) : kartuList.value.flatMap(k => k.baris);
      const cocokLabel = (b) => (b.kode_komponen || b.kode_anak_spk || b.kode_kartu || `${b.kode_spk}-${b.bahan_aksesoris_id}`) === kode;
      return kolamBaris.filter(b => cocokLabel(b) && b.label_cetak_pada && b.status === 'perlu_disiapkan');
    }
    const scanOperator = buatScanTerpadu({
      judul: 'Scan Operator — Bahan', subjudul: 'Scan QR operator/tim, lalu scan label anak SPK berkali-kali',
      twoStep: {
        labelPertama: 'Operator/Tim', labelKedua: 'Label Anak SPK',
        placeholderPertama: 'Scan QR badge operator/tim / cari kode (sekali di awal)',
        placeholderKedua: 'Scan label anak SPK yang sudah dicetak / cari kode (bisa berkali-kali)',
        camModePertama: 'Mode: Scan QR Operator (sekali)', camModeKedua: 'Mode: Scan Label Anak SPK (berkali-kali)',
        kosongUtama: 'Scan QR Operator/Tim dulu', kosongSub: '1x scan untuk mengunci operator yang ditunjuk.',
        validasi: async (kode) => {
          const karyawan = await cariKaryawanByQr(kode);
          if (!karyawan) return { ok: false, pesan: 'QR tidak dikenali — operator/tim tidak ditemukan.' };
          const nama = karyawan.nama || karyawan.name || '';
          return { ok: true, data: { id: karyawan.id, nama: nama || karyawan.id }, label: nama ? (nama + ' (' + kode + ')') : kode };
        }
      },
      validasiIsi: async (kode) => {
        const targets = cariBarisSiapTunjuk(kode);
        if (!targets.length) {
          const karyawanTerbaca = await cariKaryawanByQr(kode);
          if (karyawanTerbaca) return { ok: false, pesan: `Kode "${kode}" itu badge OPERATOR (${karyawanTerbaca.nama || karyawanTerbaca.name || kode}), BUKAN label SPK. Scan LABEL SPK anak yang sudah dicetak.` };
          return { ok: false, pesan: `Kode "${kode}" tidak cocok baris manapun yang sudah dicetak labelnya (mungkin belum dicetak, sudah ditunjuk, atau sudah ada di draft).` };
        }
        return { ok: true, row: { kode, label: targets.length + ' baris: ' + targets.map(b => b.no_spk).join(', '), tagTxt: 'siap', tagCls: 'ok' } };
      },
      padaUpload: async (rows, locked) => {
        try {
          const now = new Date().toISOString();
          for (const row of rows) {
            const targets = cariBarisSiapTunjuk(row.kode);
            await Promise.all(targets.map(b => updateBarisBahan(b._trackId, b._lineIdx, (lama) => ({
              status: 'sedang_disiapkan', masuk_tahap_pada: now,
              operator_uid: locked.id, operator_nama: locked.nama, ditugaskan_pada: now,
              riwayat_operator: [...(lama.riwayat_operator || []), { operator_uid: locked.id, operator_nama: locked.nama, mulai_pada: now }]
            }))));
          }
          await muat();
          return { ok: true };
        } catch (e) { console.error('Gagal simpan Scan Operator:', e); return { ok: false, pesan: 'Gagal menyimpan. Coba lagi.' }; }
      }
    });
    function bukaPenunjukan(k) {
      const eligible = k.baris.filter(b => b.label_cetak_pada && b.status === 'perlu_disiapkan');
      if (!eligible.length) { alert('Belum ada baris yang sudah dicetak labelnya di kartu ini.'); return; }
      kartuAktifTunjuk = k;
      scanOperator.buka();
    }
    // bukaPenunjukanGlobal — versi toolbar header: TIDAK terkunci ke 1 kartu,
    // mencari baris cocok di SEMUA kartu yang tampil di tab ini. Tombol
    // per-kartu TETAP ADA, ini tambahan.
    function bukaPenunjukanGlobal() {
      const eligible = kartuList.value.some(k => k.baris.some(b => b.label_cetak_pada && b.status === 'perlu_disiapkan'));
      if (!eligible) { alert('Belum ada baris yang sudah dicetak labelnya di tab ini.'); return; }
      kartuAktifTunjuk = null;
      scanOperator.buka();
    }

    // Scan Sampai GLOBAL — satu-satunya scan di tab ini yang bukan penunjukan
    // tugas; menutup pack yang dikirim balik dari Masalah (TLC BHN-TRB). Scan
    // kode bagging -> bersihkan `catatan_masalah` baris yang cocok. SENGAJA TIDAK
    // menulis status dokumen `persiapan_masalah` (milik js/vue-pp-masalah.js).
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

    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-bahan-tahap'); await window.authReady; await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, kartuList, cari, isChecked, toggleCheck, bangunLabelBahan, barisKey,
      bolehProses, bolehCetak, bolehEdit, formatMeter, formatQty, formatWaktu, aksiAktif,
      TAB_DEFS_BAHAN, gantiTabPill, MY_TARGET, jumlahSiapDicetak, ringkasanTerpilih,
      popupCetakAktif, daftarLabelPreview, cetakLabelKartu, cetakSemuaTercentang, onCetakSelesai,
      popupCetakUlang, bukaCetakUlang, lanjutCetakUlang, pinCetakUlangAktif, pinCetakUlangSukses, batalPinCetakUlang, barisTerpilihCetakUlang,
      scanOperator, bukaPenunjukan, bukaPenunjukanGlobal,
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
          <button v-if="bolehEdit && aksiAktif(MY_TARGET,'sampai_masalah_bahan')" @click="bukaScanSampaiGlobal" class="btn-outline" style="padding:8px 14px;"><i class="fas fa-inbox" style="margin-right:6px;"></i>Scan Sampai</button>
          <button v-if="bolehProses && aksiAktif(MY_TARGET,'operator_bahan')" @click="bukaPenunjukanGlobal" class="btn-primary" style="padding:8px 14px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Operator</button>
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

      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="k in kartuList" :key="k.kartuKey" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
            <div style="min-width:0;">
              <!-- Header kartu: baris atas nama produk + size, baris bawah nama bahan +
                warna bahan (+rak). -->
              <div class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ k.namaProduk || '(tanpa nama produk)' }} <span style="color:var(--text-faint); font-weight:600;">size {{ k.produkSize || '-' }}</span></div>
              <div style="font-size:11px; color:var(--text-faint); margin-top:2px;">{{ k.nama }} <span style="font-weight:600;">{{ k.warna }}</span> &middot; rak {{ k.rakId || '-' }}</div>
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

          <!-- Baris anak SPK tampil PERSIS urutan bangunLabelBahan (kode / nama produk+warna /
            nama bahan / warna+butuh / pelanggan) supaya operator bisa cocokkan layar vs label
            fisik yang sudah ditempel di gudang. -->
          <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
            <label v-for="b in k.baris" :key="b._trackId + '-' + b._lineIdx" style="display:flex; align-items:flex-start; gap:8px; font-size:11px; padding:8px; border-radius:10px;" :style="{ background: b.label_cetak_pada ? 'var(--ok-light)' : (b._bisa ? 'transparent' : 'var(--danger-light)') }">
              <input type="checkbox" :checked="isChecked(b)" :disabled="!b._bisa || !!b.label_cetak_pada" @change="toggleCheck(b)" style="margin-top:2px;">
              <div style="min-width:0; flex:1;">
                <div class="gc-num" style="font-weight:700;">{{ bangunLabelBahan(b).kode }}</div>
                <div style="font-weight:600;">{{ bangunLabelBahan(b).nama }}</div>
                <div style="color:var(--text-faint);" v-html="bangunLabelBahan(b).info"></div>
              </div>
              <span v-if="b.label_cetak_pada" class="tag ok" style="margin-left:6px; flex-shrink:0;">sudah dicetak</span>
              <span v-else-if="b.catatan_masalah" class="tag warn" style="margin-left:6px; flex-shrink:0;">sudah diminta</span>
              <template v-else-if="!b._bisa">
                <span class="tag warn" style="margin-left:6px; flex-shrink:0;">stok kurang</span>
                <button @click.prevent.stop="bukaMasalahBaris(b)" class="btn-outline" style="margin-left:6px; flex-shrink:0; padding:3px 9px; font-size:10px; color:var(--danger); border-color:var(--danger);">Masalah</button>
              </template>
            </label>
          </div>

          <div v-if="bolehCetak" style="display:flex; gap:8px; border-top:1px solid var(--line); padding-top:10px;">
            <button @click="cetakLabelKartu(k)" class="btn-outline" style="flex:1; padding:9px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Label</button>
            <button v-if="k.baris.some(b=>b.label_cetak_pada)" @click="bukaCetakUlang(k)" class="btn-outline" style="flex:1; padding:9px; color:var(--warn); border-color:var(--warn);"><i class="fas fa-rotate" style="margin-right:6px;"></i>Cetak Ulang</button>
            <button v-if="bolehProses && aksiAktif(MY_TARGET,'operator_bahan') && k.baris.some(b=>b.label_cetak_pada && b.status==='perlu_disiapkan')" @click="bukaPenunjukan(k)" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Operator</button>
          </div>
        </div>
      </div>

      <!-- Bar ringkasan sticky + cetak massal lintas kartu; tombol cetak per-kartu di atas
        TETAP ADA. Hanya di modul Bahan — checkbox di 3 file Acc cuma indikator kesiapan,
        bukan seleksi cetak. -->
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
        <p style="font-size:11px; color:var(--text-faint); margin:0 0 10px;">{{ popupCetakUlang.kartu.nama }} {{ popupCetakUlang.kartu.warna }} — centang label yang mau dicetak ulang, dicatat di riwayat cetak ulang.</p>
        <div style="display:flex; flex-direction:column; gap:4px; max-height:220px; overflow-y:auto; border:1px solid var(--line); border-radius:12px; padding:8px; margin-bottom:12px;">
          <label v-for="b in popupCetakUlang.kartu.baris.filter(x => x.label_cetak_pada)" :key="barisKey(b)" style="display:flex; align-items:center; gap:8px; font-size:11px; padding:4px 2px;">
            <input type="checkbox" v-model="popupCetakUlang.pilihan[barisKey(b)]">
            <span class="gc-num" style="font-weight:700;">{{ bangunLabelBahan(b).kode }}</span>
          </label>
        </div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupCetakUlang.alasan" type="text" placeholder="Mis. label rusak/hilang"></div>
        <div style="display:flex; gap:8px;">
          <button @click="popupCetakUlang = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="lanjutCetakUlang" :disabled="!barisTerpilihCetakUlang().length" class="btn-primary" style="flex:1; padding:9px;">Lanjut Verifikasi PIN</button>
        </div>
      </div>
    </div>
    <popup-pin-generik v-if="pinCetakUlangAktif" judul="Verifikasi PIN — Cetak Ulang Label" konteks="Persiapan Bahan - Cetak Ulang Label" @sukses="pinCetakUlangSukses" @batal="batalPinCetakUlang" />

    <scan-terpadu-generik :c="scanOperator" />
  `
};


// TAB 2: Sedang Disiapkan. Papan dikelompokkan per OPERATOR (bukan per bahan);
// "diam sejak" dihitung dari masuk_tahap_pada. Scan Entry cuma mengurangi stok +
// mengisi entry_qty TANPA memindahkan status — pindah tahap massal lewat tombol
// "Disiapkan" per trackId, syaratnya lihat siapBatch di bawah.

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
      const baris = saringMilikOperator(semuaBaris.filter(b => b.status === 'sedang_disiapkan'));
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

    // Scan Entry / Scan Masalah / Ganti Operator (per baris)
    const modalAksi = reactive({ aktif: false, mode: null, baris: null }); // mode: 'entry' | 'masalah' | 'ganti'
    function bukaAksi(mode, b) {
      if (sedangProses[barisKey(b)]) return;
      modalAksi.mode = mode; modalAksi.baris = b; modalAksi.aktif = true;
    }
    function tutupAksi() { modalAksi.aktif = false; modalAksi.mode = null; modalAksi.baris = null; }

    // Popup "jumlah kurang" + alasan, dibuka SETELAH scan label cocok
    const popupMasalah = ref(null); // { baris, jumlahKurang, alasan }
    function batalMasalah() { popupMasalah.value = null; }
    // Baris yang stoknya kurang tidak bisa dicetak, jadi tidak bisa discan juga.
    // Tombol ini satu-satunya jalan keluarnya: buka popup Masalah langsung tanpa
    // scan. Alokasi di sini per kartu (greedy), bukan per baris, jadi jumlah yang
    // diminta default sebesar kebutuhan baris itu — operator boleh mengubahnya.
    function bukaMasalahBaris(b) {
      if (b.catatan_masalah || sedangProses[barisKey(b)]) return;
      popupMasalah.value = { baris: b, jumlahKurang: b.kebutuhan_kain, alasan: '' };
    }
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
      // entry / masalah: kode yang discan WAJIB label baris ini sendiri. Fallback
      // chain kode label PERSIS SAMA dengan bangunPreviewDariBaris supaya yang
      // discan selalu cocok dengan yang dicetak.
      const kodeLabelBaris = b.kode_komponen || b.kode_anak_spk || b.kode_kartu || `${b.kode_spk}-${b.bahan_aksesoris_id}`;
      if (kode !== kodeLabelBaris) { alert(`Kode yang discan ("${kode}") tidak cocok dengan label bahan baris ini (${kodeLabelBaris}).`); return; }
      if (modalAksi.mode === 'masalah') {
        // Jangan langsung tulis: buka popup jumlah kurang + alasan dulu.
        // Konfirmasinya menulis catatan_masalah DAN membuat 1 dokumen baru di
        // koleksi `persiapan_masalah` (status 'perlu_diajukan', tlc_asal
        // 'TLC-BHN', sumber_jalur 'bahan'); status baris sendiri tidak berubah.
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

    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-bahan-tahap'); await window.authReady; await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, kelompokOperator, bolehProses, sedangProses, sedangProsesBatch, konfirmasiDisiapkan, aksiAktif,
      formatMeter, formatQty, formatDiamSejak, tertahan, barisKey,
      modalAksi, bukaAksi, tutupAksi, hasilScanAksi,
      popupMasalah, batalMasalah, konfirmasiMasalah, bukaMasalahBaris,
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
                  <button v-if="aksiAktif(MY_TARGET,'entry_bahan')" @click="bukaAksi('entry', b)" :disabled="sedangProses[barisKey(b)]" class="btn-primary" style="flex:1; padding:7px; font-size:11px;"><i class="fas fa-qrcode" style="margin-right:4px;"></i>Scan Entry</button>
                  <button v-if="aksiAktif(MY_TARGET,'masalah_bahan')" @click="bukaAksi('masalah', b)" :disabled="sedangProses[barisKey(b)]" class="btn-outline" style="flex:1; padding:7px; font-size:11px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Masalah</button>
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


// TAB 3: Perlu Di Kirim — hanya baris berstatus perlu_dikirim. Dua cetak: Kode
// Bagging (blank, tanpa TLC, terbit N label sekaligus) dan Kode Tugas (tujuan
// TLC dari dropdown). Dua scan: Scan Pack (kode bagging + anak SPK, syarat
// sepack pola+bahan+size sama) dan Scan Kirim (kode tugas + kode bagging).

const PersiapanBahanPerluDikirim = {
  components: { PopupPratinjauCetakLabel, ScanTerpaduGenerik },
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
      saringMilikOperator(barisTertahan.value).forEach(b => {
        const key = kunciSepack(b);
        if (!peta[key]) peta[key] = { key, label: labelSepack(b), baris: [] };
        peta[key].baris.push(b);
      });
      return Object.values(peta).sort((a, b) => b.baris.length - a.baris.length);
    });

    // Cetak Kode Bagging (blank, batch N label, tanpa TLC)
    const popupBagging = ref(null); // { sepackKey, jumlah }
    function bukaCetakBagging() {
      if (!kelompokSepack.value.length) { alert('Tidak ada baris di tab ini.'); return; }
      popupBagging.value = { sepackKey: kelompokSepack.value[0].key, jumlah: 1 };
    }
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    // jenisCetakAktif — popup di bawah dipakai BERGANTIAN oleh
    // konfirmasiCetakBagging (kode_bagging) & konfirmasiCetakTugas
    // (lembar_kode_tugas); diset saat masing-masing mengisi daftarLabelPreview.
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
          // kode_spk/kode_batch null dulu, diisi Scan Pack pertama (lihat
          // hasilScanPack di bawah).
          await addDoc(collection(db, 'bagging'), {
            kode, produk_label: grup.label, isi: [], ditutup_pada: null,
            kode_spk: null, kode_batch: null,
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

    // Cetak Kode Tugas (tujuan TLC dari dropdown, tanpa daftar pack)
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

    // Seed master_tlc (kalau kosong) — daftar dari
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

    // Scan Pack — buatScanTerpadu (kamera tersemat + Draft->Upload), ganti
    // overlay+tulis-langsung lama. Step1 kunci Kode Bagging, step2 kumpulkan
    // anak SPK sebagai draft; Upload baru menulis kode_bagging tiap baris +
    // bagging.isi[]/kode_spk sekali jalan. kode_spk grouping dikunci dari
    // scan PERTAMA ke bagging ini (di draft atau sudah tersimpan sebelumnya),
    // scan berikutnya (draft ini maupun sesi lain) wajib kode_spk yang sama.
    const packTerpadu = buatScanTerpadu({
      judul: 'Scan Pack — Bahan', subjudul: 'Kaitkan anak SPK ke satu kode bagging',
      twoStep: {
        labelPertama: 'Kode Bagging', labelKedua: 'Kode Anak SPK',
        placeholderPertama: 'Scan QR Bagging / cari kode (sekali di awal)',
        placeholderKedua: 'Scan QR anak SPK / cari kode (bisa berkali-kali)',
        camModePertama: 'Mode: Scan Kode Bagging (sekali)', camModeKedua: 'Mode: Scan Anak SPK (berkali-kali)',
        kosongUtama: 'Scan Kode Bagging dulu', kosongSub: '1x scan untuk membuka sesi pack ini.',
        validasi: async (kode) => {
          const b = daftarBaggingAktif.value.find(x => x.kode === kode);
          if (!b) return { ok: false, pesan: `Kode bagging "${kode}" tidak ditemukan atau sudah ditutup.` };
          return { ok: true, data: b };
        }
      },
      aksiEkstra: [{ label: 'Tutup Bagging Ini', aksi: async (bagging) => {
        if (!bagging) return;
        try { await updateDoc(doc(db, 'bagging', bagging.id), { ditutup_pada: serverTimestamp() }); packTerpadu.tutup(); await muat(); }
        catch (e) { console.error('Gagal tutup bagging:', e); alert('Gagal menutup bagging. Coba lagi.'); }
      } }],
      validasiIsi: async (kode, bagging, rowsSaatIni) => {
        const target = barisTertahan.value.find(x => x.no_spk === kode && !x.kode_bagging);
        if (!target) return { ok: false, pesan: `Kode "${kode}" tidak cocok anak SPK yang masih tertahan / sudah di-pack.` };
        // syarat sepack : pola+bahan+size harus sama dengan produk yang dipilih
        // SAAT kode bagging ini dicetak (bagging.produk_label = labelSepack
        // persis, lihat konfirmasiCetakBagging). Warna & no SPK boleh beda ->
        // makanya dibandingkan labelnya, bukan bahan_aksesoris_id.
        if (labelSepack(target) !== bagging.produk_label) {
          return { ok: false, pesan: `Kode "${kode}" bukan produk yang sama dengan bagging ini (${bagging.produk_label}). Syarat sepack: pola, bahan, dan size harus sama.` };
        }
        const kodeSpkTerkunci = bagging.kode_spk || rowsSaatIni[0]?._kodeSpk || null;
        if (kodeSpkTerkunci && target.kode_spk !== kodeSpkTerkunci) {
          return { ok: false, pesan: `Kode "${kode}" dari SPK Grouping berbeda (${target.kode_spk}) dari bagging ini (${kodeSpkTerkunci}). 1 bagging cuma boleh 1 grouping.` };
        }
        return { ok: true, row: { kode, label: target.bahan_nama + ' ' + (target.bahan_warna || ''), qty: '1', tagTxt: 'cocok', tagCls: 'ok', _trackId: target._trackId, _lineIdx: target._lineIdx, _kodeSpk: target.kode_spk || null } };
      },
      padaUpload: async (rows, bagging) => {
        try {
          const kodeSpkBaru = bagging.kode_spk || rows[0]._kodeSpk || null;
          await Promise.all(rows.map(r => updateBarisBahan(r._trackId, r._lineIdx, () => ({ kode_bagging: bagging.kode }))));
          const patchBagging = { isi: arrayUnion(...rows.map(r => r.kode)) };
          if (!bagging.kode_spk) patchBagging.kode_spk = kodeSpkBaru;
          await updateDoc(doc(db, 'bagging', bagging.id), patchBagging);
          await muat();
          return { ok: true };
        } catch (e) { console.error('Gagal upload scan pack:', e); return { ok: false, pesan: 'Gagal menyimpan. Coba lagi.' }; }
      }
    });

    // Scan Kirim — sama pola dengan Scan Pack di atas. Step1 kunci Kode
    // Tugas, step2 kumpulkan kode bagging draft (1 baris draft = 1 kode
    // bagging, mewakili SEMUA anak SPK di dalamnya); Upload baru menulis
    // status/kode_tugas/tlc_tujuan tiap anak SPK + tugas_kirim.pack sekali
    // jalan per kode bagging.
    const kirimTerpadu = buatScanTerpadu({
      judul: 'Scan Kirim — Bahan', subjudul: 'Muat kode bagging ke satu tugas kirim',
      twoStep: {
        labelPertama: 'Kode Tugas', labelKedua: 'Kode Bagging',
        placeholderPertama: 'Scan QR Kode Tugas / cari kode (sekali di awal)',
        placeholderKedua: 'Scan QR bagging / cari kode (bisa berkali-kali)',
        camModePertama: 'Mode: Scan Kode Tugas (sekali)', camModeKedua: 'Mode: Scan Kode Bagging (berkali-kali)',
        kosongUtama: 'Scan Kode Tugas dulu', kosongSub: '1x scan untuk membuka tugas kirim ini.',
        validasi: async (kode) => {
          try {
            const snap = await getDocs(query(collection(db, 'tugas_kirim'), where('kode', '==', kode)));
            if (snap.empty) return { ok: false, pesan: `Kode tugas "${kode}" tidak ditemukan.` };
            return { ok: true, data: { id: snap.docs[0].id, ...snap.docs[0].data() } };
          } catch (e) { console.error('Gagal cari kode tugas:', e); return { ok: false, pesan: 'Gagal mencari kode tugas. Coba lagi.' }; }
        }
      },
      validasiIsi: async (kode) => {
        const anggota = barisTertahan.value.filter(x => x.kode_bagging === kode);
        if (!anggota.length) return { ok: false, pesan: `Kode bagging "${kode}" tidak ditemukan di antara yang masih tertahan (mungkin belum di-pack, atau sudah dikirim).` };
        return { ok: true, row: { kode, label: anggota.length + ' item', qty: String(anggota.length), tagTxt: 'cocok', tagCls: 'ok' } };
      },
      padaUpload: async (rows, tugas) => {
        try {
          const now = new Date().toISOString();
          for (const r of rows) {
            const anggota = barisTertahan.value.filter(x => x.kode_bagging === r.kode);
            await Promise.all(anggota.map(b => updateBarisBahan(b._trackId, b._lineIdx, () => ({
              status: 'sedang_dikirim', masuk_tahap_pada: now, kode_tugas: tugas.kode,
              // snapshot tujuan TLC di baris itu sendiri (bukan cuma kode_tugas),
              // supaya Tab 5 (Selesai) tidak perlu query balik ke tugas_kirim buat
              // tampilkan kolom "tujuan TLC".
              tlc_tujuan: tugas.tlc_tujuan || ''
            }))));
            // kode_spk/kode_batch ikut disalin ke tiap entri pack[], diambil dari
            // baris anggota (pasti satu grouping, dikunci sejak Scan Pack) — pos ini
            // tidak pernah punya kode_batch.
            await updateDoc(doc(db, 'tugas_kirim', tugas.id), {
              pack: arrayUnion({ kode_bagging: r.kode, kode_spk: anggota[0]?.kode_spk || null, kode_batch: null, pada: now, sampai_pada: null })
            });
          }
          await muat();
          return { ok: true };
        } catch (e) { console.error('Gagal upload scan kirim:', e); return { ok: false, pesan: 'Gagal menyimpan. Coba lagi.' }; }
      }
    });

    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-bahan-tahap'); await window.authReady; await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, kelompokSepack, daftarTlc, bolehProses, bolehCetak, sedangProses, aksiAktif,
      formatMeter, formatQty, formatDiamSejak, tertahan,
      popupBagging, bukaCetakBagging, konfirmasiCetakBagging,
      popupTugas, bukaCetakTugas, konfirmasiCetakTugas, isiTlcAwal,
      popupCetakAktif, daftarLabelPreview, jenisCetakAktif,
      packTerpadu, kirimTerpadu,
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
        <button v-if="aksiAktif(MY_TARGET,'pack_bahan')" @click="packTerpadu.buka" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Pack</button>
        <button v-if="aksiAktif(MY_TARGET,'kirim_bahan')" @click="kirimTerpadu.buka" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Kirim</button>
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

    <scan-terpadu-generik :c="packTerpadu" />
    <scan-terpadu-generik :c="kirimTerpadu" />
  `
};


// TAB 4: Sedang Di Kirim — VIEW-ONLY dengan sengaja. Baris keluar dari sini
// lewat layar scan sampai milik divisi penerima, bukan dari tab ini, jadi TIDAK
// ada tombol aksi apapun — cuma papan info dikelompokkan per kode tugas.

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
      const baris = saringMilikOperator(daftarBarisDariTrack(daftarTrack.value).filter(b => b.status === 'sedang_dikirim'));
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
    return { muat, memuat, kelompokTugas, formatMeter, formatQty, formatDiamSejak, TAB_DEFS_BAHAN, gantiTabPill, MY_TARGET };
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


// TAB 5: Selesai — riwayat. Baris pindah ke status 'selesai' saat DIVISI
// PENERIMA scan sampai (mis. Proses Produksi > Potong), BUKAN saat pos ini Scan
// Kirim. Tab ini HANYA MEMBACA `status`/`sampai_pada` yang ditulis modul lain —
// selama modul penerima belum ada, tab ini kosong terus dan itu BUKAN bug.

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

    // Operator biasa (bukan admin/pic/owner/superuser) HANYA melihat baris yang
    // PERNAH ia scan sendiri — bukan soal izin menu (operator MEMANG boleh buka
    // menu ini), tapi soal cakupan tampilan. Admin-level tetap lihat papan
    // riwayat penuh + KPI.
    const isOperatorSaja = computed(() => (window.currentUser?.role || '').toLowerCase() === 'operator');

    const semuaSelesai = computed(() => daftarBarisDariTrack(daftarTrack.value).filter(b => b.status === 'selesai'));
    const barisSaya = computed(() => semuaSelesai.value.filter(b => b.operator_uid && b.operator_uid === window.currentUser?.email)
      .sort((a, b) => new Date(b.sampai_pada || 0) - new Date(a.sampai_pada || 0)));

    // KPI di-scope "hari ini" — dasar tanggalnya `sampai_pada` (kapan baris itu
    // BENAR-BENAR tuntas).
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

    return { muat,
      memuat, isOperatorSaja, barisSaya, daftarUrut, kpi,
      formatMeter, formatQty, formatWaktu, formatSiklus, siklusJam, keadaan,
      TAB_DEFS_BAHAN, gantiTabPill, MY_TARGET
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <!-- isOperatorSaja: versi mobile "Riwayat Saya" SENGAJA tanpa gc-card-head/tab pill —
      layar operator tersendiri (bukti kerja), beda dari versi admin di bawah yang bertab. -->
    <template v-else-if="isOperatorSaja">
      <!--
        Versi mobile/operator: "Riwayat Saya" — tanpa tombol, tanpa KPI. Bukti kerja, bukan tempat
        memperbaiki .
      -->
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
      <!-- Versi admin/pic: KPI + papan riwayat penuh . -->
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

// Mount LAZY: window.pastikanMountPpBahanXxx dipanggil pindahSubTab
// (js/dashboard.js, peta `petaMount`) saat tab itu PERTAMA KALI dibuka — bukan
// mount 5 komponen sekaligus waktu halaman dimuat.
let vmPpBahanPerluDisiapkan = null;
window.pastikanMountPpBahanPerluDisiapkan = function () {
  if (vmPpBahanPerluDisiapkan) { if (typeof vmPpBahanPerluDisiapkan.muat === 'function') vmPpBahanPerluDisiapkan.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-bahan-perludisiapkan');
  if (mountPoint) vmPpBahanPerluDisiapkan = createApp(PersiapanBahanPerluDisiapkan).mount('#vue-pp-bahan-perludisiapkan');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js) — panggil varian
// toolbar global (kartuAktifTunjuk null), sama seperti klik tombol toolbar.
window.bukaScanOperatorBahan = function () { window.pastikanMountPpBahanPerluDisiapkan(); if (vmPpBahanPerluDisiapkan) vmPpBahanPerluDisiapkan.bukaPenunjukanGlobal(); };
window.bukaSampaiMasalahBahan = function () { window.pastikanMountPpBahanPerluDisiapkan(); if (vmPpBahanPerluDisiapkan) vmPpBahanPerluDisiapkan.bukaScanSampaiGlobal(); };
let vmPpBahanSedangDisiapkan = null;
window.pastikanMountPpBahanSedangDisiapkan = function () {
  if (vmPpBahanSedangDisiapkan) { if (typeof vmPpBahanSedangDisiapkan.muat === 'function') vmPpBahanSedangDisiapkan.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-bahan-sedangdisiapkan');
  if (mountPoint) vmPpBahanSedangDisiapkan = createApp(PersiapanBahanSedangDisiapkan).mount('#vue-pp-bahan-sedangdisiapkan');
};
// entry_bahan/masalah_bahan TIDAK dijembatani ke Bottom Sheet: Scan Entry &
// Scan Masalah di tab ini terikat ke SATU baris yang tombolnya diklik dulu
// (bukaAksi(mode, b)), tidak ada varian pencarian global seperti Scan
// Operator/Scan Pack. Tombolnya tetap digerbang aksiAktif.
let vmPpBahanPerluDikirim = null;
window.pastikanMountPpBahanPerluDikirim = function () {
  if (vmPpBahanPerluDikirim) { if (typeof vmPpBahanPerluDikirim.muat === 'function') vmPpBahanPerluDikirim.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-bahan-perludikirim');
  if (mountPoint) vmPpBahanPerluDikirim = createApp(PersiapanBahanPerluDikirim).mount('#vue-pp-bahan-perludikirim');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaPackBahan = function () { window.pastikanMountPpBahanPerluDikirim(); if (vmPpBahanPerluDikirim) vmPpBahanPerluDikirim.packTerpadu.buka(); };
window.bukaKirimBahan = function () { window.pastikanMountPpBahanPerluDikirim(); if (vmPpBahanPerluDikirim) vmPpBahanPerluDikirim.kirimTerpadu.buka(); };
let vmPpBahanSedangDikirim = null;
window.pastikanMountPpBahanSedangDikirim = function () {
  if (vmPpBahanSedangDikirim) { if (typeof vmPpBahanSedangDikirim.muat === 'function') vmPpBahanSedangDikirim.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-bahan-sedangdikirim');
  if (mountPoint) vmPpBahanSedangDikirim = createApp(PersiapanBahanSedangDikirim).mount('#vue-pp-bahan-sedangdikirim');
};
let vmPpBahanSelesai = null;
window.pastikanMountPpBahanSelesai = function () {
  if (vmPpBahanSelesai) { if (typeof vmPpBahanSelesai.muat === 'function') vmPpBahanSelesai.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-bahan-selesai');
  if (mountPoint) vmPpBahanSelesai = createApp(PersiapanBahanSelesai).mount('#vue-pp-bahan-selesai');
};

// Tab pertama ("Perlu Disiapkan") ke-mount sendiri: tombol #menu-pp-bahan-btn di
// index.html sudah memanggil pindahSubTab ke sub-pp-bahan-perludisiapkan, yang
// lewat petaMount memanggil pastikanMountPpBahanPerluDisiapkan di atas — tidak
// perlu dipanggil manual di sini.
