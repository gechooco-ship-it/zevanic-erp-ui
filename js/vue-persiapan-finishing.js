// js/vue-persiapan-finishing.js
// Persiapan Produksi > Acc Finishing. Pos barang cetak & kemasan (hangtag,
// label, kartu ukuran, polybag), satuan pcs; penahannya ketersediaan CETAKAN.
//
// Koleksi & field:
// - spk_track jalur:'finishing', finishing_rincian[] diisi
//   hitungFinishingRincian (vue-persiapan-produksi-v2.js) saat SPK Grouping
//   terbit: 1 baris per (komponen aksesoris x anak SPK) dari
//   master_produk.bom_aksesoris[] tahap_proses berisi "finishing".
// - Khas pos ini: varian_tipe/varian_jumlah, default 'tunggal'/1.
// - tlc_asal = 'TLC-FIN'; koleksi bagging/tugas_kirim/master_tlc generik.
//
// Jebakan:
// - Koleksi persiapan_komponen tidak dipakai lagi dan tidak dimigrasi.
// - keadaan_cetak/sisa_dicetak sengaja TIDAK disimpan di rincian — dihitung
//   live di kelompokKartuSpk dari stok terkini vs `butuh` supaya tidak basi.
// - Satu kartu = satu SPK Grouping (spk_track kode -FIN); tidak ada kumulatif
//   butuh/stok lintas grouping, cek stok per baris.
// - 1 scan pack/kirim bisa menandai banyak baris sekaligus lewat
//   updateBarisFinishingMassal; label 1 per ANAK SPK, QR cuma jejak cetak.

import { createApp, ref, reactive, computed, watch, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel, bangunLabelAksesoris } from './vue-components.js?v=15';
import { ScanGenerik, ScanTerpaduGenerik, buatScanTerpadu, buatScanEntryStok, PopupPinGenerik, buatQrDataUrl, muatJsQr, cariKaryawanByQr, ajukanPersiapanMasalah } from './vue-scan-cetak.js?v=13';
import { aksiAktif, pastikanCachePilihanScan } from './vue-popup-scan.js?v=7';

// picOwnerKeAtas — gerbang aksi "Scan Operator": WAJIB akun tier
// pic/pic_owner/owner/superuser, TANPA popup PIN: cukup tier akun yang login.
function picOwnerKeAtas(userData) {
  if (!userData) return false;
  const role = (userData.role || '').toLowerCase();
  return role === 'owner' || role === 'superuser' || role === 'pic';
}

// Konfigurasi khas pos ini (SATU-SATUNYA tempat yang beda antara file
// Sewing/Webbing/Finishing untuk bagian generik — field tambahan khas
// masing-masing pos ditangani terpisah di komponennya sendiri).
const JALUR = 'finishing';
const FIELD_RINCIAN = 'finishing_rincian';
const TLC_ASAL = 'TLC-FIN';
const MENU_ID = 'pp_finishing';
const ICON_KOSONG = 'fa-check-double';

// Format & hitung kecil
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

// buatQrDataUrl/muatJsQr/cariKaryawanByQr diimpor dari js/vue-scan-cetak.js.
// Kode harian berurut (bagging/tugas kirim): counter doc sengaja DIBAGI lintas
// pos supaya kode BAG/TGS unik global, bukan cuma unik per pos.
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

// Baca & ratakan spk_track jalur='sewing'
async function muatSemuaTrackFinishing() {
  const snap = await getDocs(query(collection(db, 'spk_track'), where('jalur', '==', JALUR)));
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
    (t[FIELD_RINCIAN] || []).forEach((b, idx) => {
      baris.push({ ...b, _trackId: t.id, _lineIdx: idx, kode_grouping_induk: t.kode_grouping_induk, kode_kit: t.kode_kit || b.kode_kit, kode_separating: t.kode_separating || b.kode_separating, separating_id: t.separating_id || b.separating_id, grouping_id: t.grouping_id, nama_produk: t.nama_produk });
    });
  });
  return baris;
}
function barisKey(b) { return b._trackId + '::' + b._lineIdx; }

// updateBarisFinishing — read-modify-write ATOMIK 1 baris (dipilih lewat index),
// SAMA pola seperti updateBarisBahan di vue-persiapan-bahan.js. Dipakai aksi
// yang menyentuh SATU baris komponen (Tunjuk 1-per-1 kalau sudah dipisah, entry,
// masalah, ganti operator).
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
// updateBarisFinishingMassal — BEDA dari versi 1-baris milik Bahan: patch SEMUA
// elemen yang lolos matchFn(elemen, index) dalam SATU transaksi. Perlu karena "1 kartu =
// 1 SPK Grouping", jadi 1 scan Tunjuk/Pack/Kirim bisa menandai banyak baris
// komponen sekaligus (semua komponen 1 anak SPK, atau semua ber-kode_bagging sama).
async function updateBarisFinishingMassal(trackId, matchFn, patchFn) {
  const refTrack = doc(db, 'spk_track', trackId);
  let kena = 0;
  await runTransaction(db, async (trx) => {
    const snap = await trx.get(refTrack);
    if (!snap.exists()) throw new Error('SPK Track tidak ditemukan (mungkin sudah dihapus).');
    const arr = Array.isArray(snap.data()[FIELD_RINCIAN]) ? [...snap.data()[FIELD_RINCIAN]] : [];
    for (let i = 0; i < arr.length; i++) {
      if (matchFn(arr[i], i)) { arr[i] = { ...arr[i], ...patchFn(arr[i]) }; kena++; }
    }
    if (kena === 0) return;
    trx.update(refTrack, { [FIELD_RINCIAN]: arr, diperbarui_pada: serverTimestamp() });
  });
  return kena;
}

// kodeLabelAcc — isi QR label kit/kartu jalur ini; dipakai cetak dan
// pencocokan scan. kode_kit lebih dulu, sisanya untuk data lama.
function kodeLabelAcc(b) { return b.kode_kit || b.kode_kartu || b.id_order; }

// kelompokKartuSpk — kelompokkan baris (SUDAH difilter status tertentu) jadi
// kartu per SPK TRACK (= per SPK Grouping, ). Beda dari kelompokKartuBahan di
// vue-persiapan-bahan.js: TIDAK ada alokasi greedy lintas kartu — tiap baris
// dicek CUKUP/KURANG independen terhadap stok live komponennya sendiri.
function kelompokKartuSpk(barisList, petaStokBahan) {
  const peta = {};
  barisList.forEach(b => {
    const key = b._trackId;
    if (!peta[key]) peta[key] = { trackId: key, kodeSpk: b.kode_kit || b.kode_grouping_induk, namaProduk: b.nama_produk, produkSize: b.produk_size, baris: [] };
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
      // "kurang", karena kekurangan barang cetak biasanya cuma menunggu cetakan
      // masuk .
      b._keadaanCetak = b._bisa ? 'stok_tetap' : 'menunggu_cetakan';
      b._sisaDicetak = b._bisa ? 0 : Math.max(0, (parseFloat(b.butuh) || 0) - b._stok);
    });
    k.adaKurang = k.baris.some(b => !b._bisa);
  });
  list.sort((a, b) => (a.adaKurang === b.adaKurang) ? 0 : (a.adaKurang ? -1 : 1));
  return list;
}

// kunciSepack — "syarat sepack" : PRODUK dan SIZE sama (beda dari Bahan — di
// sini komponennya sudah terikat SPK, jadi bukan pola dan bahan). Warna & no SPK
// boleh beda.
function kunciSepack(b) { return `${b.nama_produk}::${b.produk_size}`.toLowerCase(); }
function labelSepack(b) { return `${b.nama_produk} · size ${b.produk_size || '-'}`; }

// Komponen kamera fullscreen dipakai lewat ScanGenerik (js/vue-scan-cetak.js),
// diimpor bukan disalin — interface & perilakunya sama di 4 file Persiapan Produksi.


// Tab 1 memakai grid 1 kolom + 4 kotak KPI (SPK menunggu / baris komponen / stok
// kurang / siap dicetak). Bar ringkasan sticky dan cetak massal lintas kartu milik
// pos Bahan SENGAJA tidak dipakai di sini: checkbox di baris komponen cuma
// indikator "stoknya ada", bukan seleksi cetak — cetak tetap 1 SPK = 1 label.

const TAB_DEFS_FINISHING = [
  { target: 'sub-pp-finishing-perludisiapkan', icon: 'fa-inbox', label: 'Perlu Disiapkan' },
  { target: 'sub-pp-finishing-sedangdisiapkan', icon: 'fa-gears', label: 'Sedang Disiapkan' },
  { target: 'sub-pp-finishing-perludikirim', icon: 'fa-box-open', label: 'Perlu Di Kirim' },
  { target: 'sub-pp-finishing-sedangdikirim', icon: 'fa-truck-fast', label: 'Sedang Di Kirim' },
  { target: 'sub-pp-finishing-selesai', icon: 'fa-circle-check', label: 'Selesai' }
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

// TAB 1: Perlu Disiapkan — kartu per SPK Grouping (bukan per bahan seperti Bahan).
// 1a cek stok per baris + centang baris yang bisa jalan + cetak label; 1b badge
// "sudah dicetak" + cetak ulang (PIN+alasan); 1c penunjukan (scan operator lalu
// scan label anak SPK — 1 scan menandai SEMUA baris komponen anak SPK itu).

const PersiapanFinishingPerluDisiapkan = {
  components: { PopupPratinjauCetakLabel, ScanGenerik, ScanTerpaduGenerik, PopupPinGenerik },
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const petaStokBahan = ref({});
    const cari = ref('');
    const pilihanCetak = reactive({}); // barisKey -> bool (override manual)

    const MY_TARGET = 'sub-pp-finishing-perludisiapkan';
    // satu-satunya pemakai bolehProses di komponen ini adalah tombol "Tunjuk
    // Operator", jadi digerbang langsung PIC ke atas di sini.
    const bolehProses = computed(() => picOwnerKeAtas(window.currentUser) && window.cekIzinMenu(MENU_ID, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(MENU_ID, 'print') !== false);
    // bolehEdit — RETROFIT, gerbang tombol "Scan Sampai" global.
    const bolehEdit = computed(() => window.cekIzinMenu(MENU_ID, 'edit') !== false);

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
      const baris = saringMilikOperator(daftarBarisDariTrack(daftarTrack.value).filter(b => b.status === 'perlu_disiapkan'));
      let kartu = kelompokKartuSpk(baris, petaStokBahan.value);
      const kata = cari.value.trim().toLowerCase();
      if (kata) {
        kartu = kartu.filter(k => k.kodeSpk.toLowerCase().includes(kata) || k.namaProduk.toLowerCase().includes(kata) || k.baris.some(b => (b.id_order || '').toLowerCase().includes(kata)));
      }
      return kartu;
    });

    // kpiHeader — 4 kotak KPI khas Acc Sewing/Webbing/Finishing: SPK menunggu /
    // baris komponen / stok kurang / siap dicetak.
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

    // Cetak label: 1 label FISIK per BARIS aksesoris (kode_komponen), tidak digabung per
    // anak SPK — QR/kode_kartu yang sama berulang di tiap label. Isi label dari
    // bangunLabelAksesoris (js/vue-components.js, dipakai Acc Sewing/Webbing juga),
    // tapi rincian.varian dibangun per baris di sini; qrDataUrl ditambah di titik cetak.
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    let _pendingCetak = [];
    function bangunRincianFinishing(b) {
      return { varian: `${b.varian_tipe || 'tunggal'} x${b.varian_jumlah || 1}` };
    }
    function cetakLabelKartu(k) {
      if (typeof QRCode === 'undefined') { alert('Library pembuat QR belum siap dimuat. Refresh halaman (Ctrl+Shift+R) lalu ulangi.'); return; }
      const terpilih = k.baris.filter(b => isChecked(b) && b._bisa && !b.label_cetak_pada);
      if (!terpilih.length) { alert('Tidak ada baris yang bisa dicetak (stok belum cukup untuk baris manapun, atau sudah dicetak semua).'); return; }
      daftarLabelPreview.value = terpilih.map(b => {
        const lbl = bangunLabelAksesoris(b, formatQty);
        return { ...lbl, qrDataUrl: buatQrDataUrl(lbl.kode), rincian: bangunRincianFinishing(b) };
      });
      _pendingCetak = terpilih;
      popupCetakAktif.value = true;
    }
    async function onCetakSelesai() {
      const now = new Date().toISOString();
      try {
        // 1 aksi cetak bisa mencakup >1 baris DI DOKUMEN YANG SAMA (kartu = 1
        // dokumen) — cukup 1 updateBarisFinishingMassal per kartu, bukan N
        // transaksi terpisah per baris.
        const byTrack = {};
        _pendingCetak.forEach(b => { (byTrack[b._trackId] ||= []).push(b); });
        // Tandai per INDEX baris yang benar-benar dicetak — semua baris 1 kit
        // punya id_order/kode_kit sama, jadi pencocokan by value ikut menandai
        // baris yang stoknya belum ada.
        await Promise.all(Object.entries(byTrack).map(([trackId, barisGrup]) => {
          const idxSet = new Set(barisGrup.map(b => b._lineIdx));
          return updateBarisFinishingMassal(trackId, (x, i) => idxSet.has(i) && !x.label_cetak_pada, () => ({ label_cetak_pada: now }));
        }));
      } catch (e) { console.error('Gagal catat label_cetak_pada:', e); }
      _pendingCetak = [];
      await muat();
    }

    // Cetak ulang: alasan + PIN diverifikasi kriptografis lewat `PopupPinGenerik`
    // (js/vue-scan-cetak.js, rolesDiizinkan=null = semua admin-level) dan dicatat di
    // cetak_ulang_log — PIN siapa pun diterima, yang dicatat adalah pemilik PIN.
    // Baris yang mau dicetak ulang WAJIB dicentang satu-satu (pilihan mulai
    // kosong) — supaya tidak semua label kartu ikut tercetak ulang sekaligus
    // dan boros kertas.
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
      // Sama fungsi dgn cetakLabelKartu di atas (bangunLabelAksesoris bersama)
      // supaya label cetak-ulang PERSIS format cetak normal, tetap cocok dgn
      // scanOperator.validasiIsi/hasilScanAksi.
      const preview = sudahDicetak.map(b => {
        const lbl = bangunLabelAksesoris(b, formatQty, { cetakUlang: true });
        return { ...lbl, qrDataUrl: buatQrDataUrl(lbl.kode), rincian: bangunRincianFinishing(b) };
      });
      try {
        await addDoc(collection(db, 'cetak_ulang_log'), {
          kode_grouping_induk: p.kartu.kodeSpk,
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

    // Scan Operator — disebar dari PILOT #5 vue-persiapan-bahan.js (Draft/Upload),
    // gantikan modalTunjuk lama. Satu sumber kebenaran: cari di SEMUA kartu tab ini
    // (tombol per-kartu sudah dibuang, lihat bukaPenunjukanGlobal di bawah).
    // 1 scan anak SPK menandai SEMUA baris komponennya (beda dari Bahan 1 baris/anak SPK).
    function cariBarisSiapTunjuk(kode) {
      const kolamBaris = kartuList.value.flatMap(k => k.baris);
      return kolamBaris.filter(b => kodeLabelAcc(b) === kode && b.label_cetak_pada && b.status === 'perlu_disiapkan');
    }
    const scanOperator = buatScanTerpadu({
      judul: 'Scan Operator — Acc Finishing', subjudul: 'Scan QR operator/tim, lalu scan label anak SPK berkali-kali',
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
        return { ok: true, row: { kode, label: targets.length + ' komponen', tagTxt: 'siap', tagCls: 'ok' } };
      },
      // matchFn tulis Firestore WAJIB pakai fallback `kode_kartu || id_order`, sama
      // dengan validasiIsi; `kena` dicek eksplisit karena updateBarisFinishingMassal
      // commit-tanpa-perubahan tidak melempar exception.
      padaUpload: async (rows, locked) => {
        const now = new Date().toISOString();
        const gagal = [];
        try {
          for (const row of rows) {
            const targets = cariBarisSiapTunjuk(row.kode);
            if (!targets.length) { gagal.push(row.kode); continue; }
            const kena = await updateBarisFinishingMassal(targets[0]._trackId, (x) => kodeLabelAcc(x) === row.kode && x.status === 'perlu_disiapkan' && !!x.label_cetak_pada, (lama) => ({
              status: 'sedang_disiapkan', masuk_tahap_pada: now,
              operator_uid: locked.id, operator_nama: locked.nama, ditugaskan_pada: now,
              riwayat_operator: [...(lama.riwayat_operator || []), { operator_uid: locked.id, operator_nama: locked.nama, mulai_pada: now }]
            }));
            if (!kena) gagal.push(row.kode);
          }
          await muat();
          if (gagal.length) return { ok: false, pesan: `Gagal simpan untuk: ${gagal.join(', ')}. Muat ulang halaman lalu coba lagi.` };
          return { ok: true };
        } catch (e) { console.error('Gagal simpan Scan Operator:', e); return { ok: false, pesan: 'Gagal menyimpan. Coba lagi.' }; }
      }
    });
    // bukaPenunjukanGlobal — SATU-SATUNYA pemicu Scan Operator di tab ini:
    // tombol toolbar (desktop) dan bottom sheet (mobile). Tombol per-kartu
    // sudah dibuang supaya tidak dobel sumber kebenaran.
    function bukaPenunjukanGlobal() {
      const eligible = kartuList.value.some(k => k.baris.some(b => b.label_cetak_pada && b.status === 'perlu_disiapkan'));
      if (!eligible) { alert('Belum ada baris yang sudah dicetak labelnya di tab ini.'); return; }
      scanOperator.buka();
    }

    // Scan Sampai GLOBAL (temuan #1) — lihat komentar besar sama di
    // vue-persiapan-bahan.js untuk ASUMSI lengkap: konservatif, cuma
    // membersihkan catatan_masalah baris yang kode_bagging-nya cocok, TIDAK
    // menulis balik koleksi persiapan_masalah.
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
        await Promise.all([...trackIdSet].map(trackId => updateBarisFinishingMassal(trackId, (x) => x.kode_bagging === kode && !!x.catatan_masalah, () => ({ catatan_masalah: '' }))));
        modalScanSampai.log.unshift(`${kode} → ${cocok.length} baris diterima kembali`);
        await muat();
      } catch (e) { console.error('Gagal scan sampai:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-finishing-tahap'); await window.authReady; await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, kartuList, cari, isChecked, toggleCheck,
      bolehProses, bolehCetak, bolehEdit, formatQty, formatWaktu, ICON_KOSONG, aksiAktif,
      // `barisKey` dipakai sebagai :key v-for di template, jadi WAJIB ikut di-return
      // dari setup. Kalau tidak, begitu kartuList terisi Vue memanggil _ctx.barisKey
      // yang undefined -> render crash -> vnode lama ("Memuat..") tertahan di layar
      // tanpa pesan error yang kelihatan user.
      barisKey, bangunLabelAksesoris,
      TAB_DEFS_FINISHING, gantiTabPill, MY_TARGET, kpiHeader,
      popupCetakAktif, daftarLabelPreview, cetakLabelKartu, onCetakSelesai,
      popupCetakUlang, bukaCetakUlang, lanjutCetakUlang, pinCetakUlangAktif, pinCetakUlangSukses, batalPinCetakUlang, barisTerpilihCetakUlang,
      scanOperator, bukaPenunjukanGlobal,
      modalScanSampai, bukaScanSampaiGlobal, tutupScanSampai, hasilScanSampai
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Acc Finishing</h3>
          <div class="sub">{{ kpiHeader.spkMenunggu }} SPK menunggu &middot; {{ kpiHeader.siapDicetak }} siap dicetak</div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button v-if="bolehEdit && aksiAktif(MY_TARGET,'sampai_masalah_finishing')" @click="bukaScanSampaiGlobal" class="btn-outline" style="padding:8px 14px;"><i class="fas fa-inbox" style="margin-right:6px;"></i>Scan Sampai</button>
          <button v-if="bolehProses && aksiAktif(MY_TARGET,'operator_finishing')" @click="bukaPenunjukanGlobal" class="btn-primary hidden md:inline-block" style="padding:8px 14px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Operator</button>
        </div>
      </div>

      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_FINISHING" :key="t.target" type="button"
          :class="['sub-pp-finishing-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-finishing-tahap', t.target, $event)">
          <i :class="'fas ' + t.icon" style="margin-right:6px;"></i>{{ t.label }}
        </button>
      </div>

      <!-- RETROFIT (temuan #6) — 4 kotak KPI. -->
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
            <span v-if="k.adaKurang" class="tag warn" style="flex-shrink:0;">ada yang menunggu cetakan</span>
            <span v-else class="tag ok" style="flex-shrink:0;">stok cukup</span>
          </div>

          <!-- RETROFIT (temuan #4) — tabel SELALU TERBUKA, collapse "buka rincian" dihapus. -->
          <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
            <label v-for="b in k.baris" :key="barisKey(b)" style="display:flex; align-items:flex-start; gap:8px; font-size:11px; padding:8px; border-radius:10px;" :style="{ background: b.label_cetak_pada ? 'var(--ok-light)' : (b._bisa ? 'transparent' : 'var(--danger-light)') }">
              <input type="checkbox" :checked="isChecked(b)" :disabled="!b._bisa || !!b.label_cetak_pada" @change="toggleCheck(b)" style="margin-top:2px;">
              <div style="min-width:0; flex:1;">
                <div class="gc-num" style="font-weight:700;">{{ bangunLabelAksesoris(b, formatQty).kode }}</div>
                <div style="font-weight:600;">{{ bangunLabelAksesoris(b, formatQty).nama }}</div>
                <div style="color:var(--text-faint);" v-html="bangunLabelAksesoris(b, formatQty).info"></div>
                <div style="color:var(--text-faint); margin-top:2px;">
                  <span v-if="b.varian_jumlah > 1" class="tag neutral">{{ b.varian_jumlah }} varian</span>
                  <span class="gc-num" style="margin-left:4px;">stok {{ formatQty(b._stok) }}</span>
                </div>
              </div>
              <span v-if="b.label_cetak_pada" class="tag ok" style="margin-left:6px; flex-shrink:0;">sudah dicetak</span>
              <span v-else-if="b.catatan_masalah" class="tag warn" style="margin-left:6px; flex-shrink:0;">sudah diminta</span>
              <template v-else-if="!b._bisa">
                <span class="tag warn" style="margin-left:6px; flex-shrink:0;">sisa {{ formatQty(b._sisaDicetak) }} {{ b.satuan }} dicetak</span>
                <button @click.prevent.stop="bukaMasalahBaris(b)" class="btn-outline" style="margin-left:6px; flex-shrink:0; padding:3px 9px; font-size:10px; color:var(--danger); border-color:var(--danger);">Masalah</button>
              </template>
            </label>
          </div>

          <div v-if="bolehCetak" style="display:flex; gap:8px; border-top:1px solid var(--line); padding-top:10px;">
            <button @click="cetakLabelKartu(k)" class="btn-outline" style="flex:1; padding:9px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Label</button>
            <button v-if="k.baris.some(b=>b.label_cetak_pada)" @click="bukaCetakUlang(k)" class="btn-outline" style="flex:1; padding:9px; color:var(--warn); border-color:var(--warn);"><i class="fas fa-rotate" style="margin-right:6px;"></i>Cetak Ulang</button>
          </div>
        </div>
      </div>
    </div>

    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Label Anak SPK" :daftar-label="daftarLabelPreview" jenis-cetak="label_spk_acc_finishing" @tutup="popupCetakAktif = false" @cetak="onCetakSelesai" />

    <scan-generik :aktif="modalScanSampai.aktif" judul="Scan Sampai — kode bagging balik dari Masalah" subjudul="Bisa discan berkali-kali." @hasil="hasilScanSampai" @tutup="tutupScanSampai" />
    <div v-if="modalScanSampai.aktif && modalScanSampai.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:260px;">
      <div v-for="(l,i) in modalScanSampai.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>

    <div v-if="popupCetakUlang" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;"><i class="fas fa-rotate" style="margin-right:8px; color:var(--warn);"></i>Cetak Ulang Label</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0 0 10px;">{{ popupCetakUlang.kartu.kodeSpk }} — centang label yang mau dicetak ulang, dicatat di riwayat cetak ulang.</p>
        <div style="display:flex; flex-direction:column; gap:4px; max-height:220px; overflow-y:auto; border:1px solid var(--line); border-radius:12px; padding:8px; margin-bottom:12px;">
          <label v-for="b in popupCetakUlang.kartu.baris.filter(x => x.label_cetak_pada)" :key="barisKey(b)" style="display:flex; align-items:center; gap:8px; font-size:11px; padding:4px 2px;">
            <input type="checkbox" v-model="popupCetakUlang.pilihan[barisKey(b)]">
            <span class="gc-num" style="font-weight:700;">{{ bangunLabelAksesoris(b, formatQty).kode }}</span>
          </label>
        </div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupCetakUlang.alasan" type="text" placeholder="Mis. label rusak/hilang"></div>
        <div style="display:flex; gap:8px;">
          <button @click="popupCetakUlang = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="lanjutCetakUlang" :disabled="!barisTerpilihCetakUlang().length" class="btn-primary" style="flex:1; padding:9px;">Lanjut Verifikasi PIN</button>
        </div>
      </div>
    </div>
    <popup-pin-generik v-if="pinCetakUlangAktif" judul="Verifikasi PIN — Cetak Ulang Label" konteks="Acc Finishing - Cetak Ulang Label" @sukses="pinCetakUlangSukses" @batal="batalPinCetakUlang" />

    <scan-terpadu-generik :c="scanOperator" />
  `
};


// TAB 2: Sedang Disiapkan — dikelompokkan per operator lalu per SPK Grouping (`_trackId`).
// Scan Entry hanya menandai `entry_qty`, TIDAK memindah status; tombol "Disiapkan"
// memindah SEMUA baris SPK sekaligus, aktif hanya kalau semua baris SPK (lintas trackId)
// sudah sedang_disiapkan DAN ber-entry_qty. Scan Masalah: tlc_asal='TLC-FIN', jalur 'finishing'.

const PersiapanFinishingSedangDisiapkan = {
  components: { ScanGenerik, ScanTerpaduGenerik, PopupPratinjauCetakLabel, PopupPinGenerik },
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const sedangProses = reactive({});
    const sedangProsesBatch = reactive({});
    const MY_TARGET = 'sub-pp-finishing-sedangdisiapkan';
    const bolehProses = computed(() => window.cekIzinMenu(MENU_ID, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(MENU_ID, 'print') !== false);

    async function muat() {
      memuat.value = true;
      try { daftarTrack.value = await muatSemuaTrackFinishing(); }
      catch (e) { console.error('Gagal muat Acc Finishing > Sedang Disiapkan:', e); daftarTrack.value = []; }
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
        if (!peta[key].kelompokSpk[spkKey]) peta[key].kelompokSpk[spkKey] = { trackId: spkKey, kodeSpk: b.kode_kit || b.kode_grouping_induk, produk: ((b.nama_produk || '') + ' ' + (b.produk_warna || '')).trim(), idOrder: b.id_order || '', pelanggan: b.pelanggan_nama || '', baris: [] };
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
        await updateBarisFinishingMassal(g.trackId, (x) => x.status === 'sedang_disiapkan', () => ({ status: 'perlu_dikirim', masuk_tahap_pada: now }));
        await muat();
      } catch (e) { console.error('Gagal memindahkan batch Disiapkan:', e); alert('Gagal menyimpan. Coba lagi.'); }
      sedangProsesBatch[g.trackId] = false;
    }

    const modalAksi = reactive({ aktif: false, mode: null, baris: null }); // 'masalah' | 'ganti'
    function bukaAksi(mode, b) {
      if (sedangProses[barisKey(b)]) return;
      modalAksi.mode = mode; modalAksi.baris = b; modalAksi.aktif = true;
    }
    function tutupAksi() { modalAksi.aktif = false; modalAksi.mode = null; modalAksi.baris = null; }

    // Popup "jumlah kurang" + alasan
    const popupMasalah = ref(null); // { baris, jumlahKurang, alasan }
    function batalMasalah() { popupMasalah.value = null; }
    // Baris yang stoknya kurang tidak bisa dicetak, jadi tidak bisa discan juga.
    // Tombol ini satu-satunya jalan keluarnya: buka popup Masalah langsung tanpa
    // scan. Sekali diajukan `catatan_masalah` terisi dan tombolnya mati, supaya
    // Persiapan Belanja tidak dapat permintaan dobel untuk baris yang sama.
    function bukaMasalahBaris(b) {
      if (b.catatan_masalah || sedangProses[barisKey(b)]) return;
      const kurang = (parseFloat(b.butuh) || 0) - (parseFloat(b._stok) || 0);
      popupMasalah.value = { baris: b, jumlahKurang: kurang > 0 ? kurang : b.butuh, alasan: '', jenis: 'kurang' };
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
        const kebutuhan = parseFloat(b.butuh) || 0;
        await updateBarisFinishing(b._trackId, b._lineIdx, () => ({ catatan_masalah: p.alasan.trim() }));
        await ajukanPersiapanMasalah({
          jenisMasalah: p.jenis || 'kurang', kodeLabelAsal: kodeLabelAcc(b) || '', separatingId: b.separating_id || '', kodeSeparating: b.kode_separating || '', idOrder: b.id_order || '',
          tlcAsal: 'TLC-FIN', sumberJalur: 'finishing',
          trackId: b._trackId, lineIdx: b._lineIdx,
          bahanAksesorisId: b.bahan_aksesoris_id, bahanNama: b.nama_aksesoris, bahanWarna: b.warna,
          satuan: b.satuan, noSpk: b.id_order,
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
          await updateBarisFinishing(b._trackId, b._lineIdx, (lama) => ({
            operator_uid: karyawan.id, operator_nama: karyawan.nama || karyawan.name || karyawan.id, ditugaskan_pada: now,
            riwayat_operator: [...(lama.riwayat_operator || []), { operator_uid: karyawan.id, operator_nama: karyawan.nama || karyawan.name || karyawan.id, mulai_pada: now }]
          }));
          tutupAksi(); await muat();
        } catch (e) { console.error('Gagal ganti operator:', e); alert('Gagal menyimpan. Coba lagi.'); }
        sedangProses[key] = false;
        return;
      }
      // cocokkan ke kode_kartu (fallback id_order utk data lama), SAMA kode yg
      // dicetak (lihat cetakLabelKartu).
      const kodeLabelBaris = kodeLabelAcc(b);
      if (kode !== kodeLabelBaris) { alert(`Kode yang discan ("${kode}") tidak cocok dengan anak SPK ini (${kodeLabelBaris}).`); return; }
      if (modalAksi.mode === 'masalah') {
        tutupAksi();
        popupMasalah.value = { baris: b, jumlahKurang: b.butuh, alasan: '', jenis: 'kurang' };
        return;
      }
    }

    const barisEntry = ref(null);
    const entryStok = buatScanEntryStok({
      pos: 'Persiapan ACC Finishing', sumber: 'Scan Entry Persiapan ACC Finishing',
      ambilBaris: () => barisEntry.value, kodeLabel: kodeLabelAcc,
      bahanId: (b) => b.bahan_aksesoris_id, kebutuhan: (b) => parseFloat(b.butuh) || 0,
      namaBahan: (b) => `${b.nama_aksesoris || ''} ${b.warna || ''}`.trim(), satuan: (b) => b.satuan || '',
      jejak: (b) => ({ kode_baris: b.kode_baris || kodeLabelAcc(b), separating_id: b.separating_id || '', spk_track_id: b._trackId }),
      patchTrack: (b, patch) => ({ docId: b._trackId, field: FIELD_RINCIAN, lineIdx: b._lineIdx, patch }),
      padaSelesai: async () => { barisEntry.value = null; await muat(); }
    });
    // Cetak ulang label kit yang hilang/rusak setelah baris pindah ke tahap ini.
    // Pola sama dengan cetak ulang di Perlu Disiapkan: centang baris, alasan,
    // PIN, dicatat di cetak_ulang_log. Tidak mengubah data baris.
    const popupCetakUlang = ref(null); // { grup, alasan, pilihan: {barisKey: boolean} }
    const pinCetakUlangAktif = ref(false);
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    function bukaCetakUlang(g) { popupCetakUlang.value = { grup: g, alasan: '', pilihan: {} }; }
    function barisTerpilihCetakUlang() {
      const p = popupCetakUlang.value;
      return p ? p.grup.baris.filter(b => p.pilihan[barisKey(b)]) : [];
    }
    function lanjutCetakUlang() {
      const p = popupCetakUlang.value;
      if (!p) return;
      if (!p.alasan.trim()) { alert('Alasan cetak ulang wajib diisi.'); return; }
      if (!barisTerpilihCetakUlang().length) { alert('Pilih minimal 1 label yang mau dicetak ulang.'); return; }
      pinCetakUlangAktif.value = true;
    }
    async function pinCetakUlangSukses(user) {
      pinCetakUlangAktif.value = false;
      const p = popupCetakUlang.value;
      const terpilih = barisTerpilihCetakUlang();
      if (!p || !terpilih.length) { popupCetakUlang.value = null; return; }
      try {
        await addDoc(collection(db, 'cetak_ulang_log'), {
          kode_grouping_induk: p.grup.kodeSpk, bahan: p.grup.produk,
          alasan: p.alasan.trim(), pin_oleh: user.nama || user.email || '',
          pada: serverTimestamp()
        });
      } catch (e) { console.error('Gagal catat cetak_ulang_log:', e); }
      daftarLabelPreview.value = terpilih.map(b => {
        const lbl = bangunLabelAksesoris(b, formatQty, { cetakUlang: true });
        return { ...lbl, qrDataUrl: buatQrDataUrl(lbl.kode) };
      });
      popupCetakUlang.value = null;
      popupCetakAktif.value = true;
    }

    function bukaEntry(b) {
      if (sedangProses[barisKey(b)]) return;
      barisEntry.value = b; entryStok.buka();
    }

    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-finishing-tahap'); await window.authReady; await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, kelompokOperator, bolehProses, sedangProses, sedangProsesBatch, konfirmasiDisiapkan,
      formatQty, formatDiamSejak, tertahan, barisKey, aksiAktif,
      modalAksi, bukaAksi, tutupAksi, hasilScanAksi, entryStok, bukaEntry,
      popupMasalah, batalMasalah, konfirmasiMasalah, bukaMasalahBaris,
      bolehCetak, popupCetakUlang, pinCetakUlangAktif, popupCetakAktif, daftarLabelPreview, bukaCetakUlang, barisTerpilihCetakUlang, lanjutCetakUlang, pinCetakUlangSukses, bangunLabelAksesoris,
      TAB_DEFS_FINISHING, gantiTabPill, MY_TARGET
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Acc Finishing</h3>
          <div class="sub">{{ kelompokOperator.length }} operator sedang menyiapkan</div>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_FINISHING" :key="t.target" type="button"
          :class="['sub-pp-finishing-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-finishing-tahap', t.target, $event)">
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
              <div style="min-width:0;"><div class="gc-num" style="font-weight:700; font-size:12px;">{{ g.kodeSpk }}</div><div style="font-weight:700; font-size:13px; color:var(--burgundy);">Untuk: {{ g.produk || '-' }}</div><div style="font-size:10.5px; color:var(--text-faint);">{{ g.idOrder }}<span v-if="g.pelanggan"> &middot; {{ g.pelanggan }}</span></div></div>
              <button v-if="bolehCetak" @click="bukaCetakUlang(g)" class="btn-outline" style="flex:0 0 auto; margin-left:auto; padding:5px 9px; font-size:10.5px; color:var(--warn); border-color:var(--warn);" title="Cetak ulang label yang hilang/rusak"><i class="fas fa-rotate"></i></button>
              <span class="tag" :class="g.siap ? 'ok' : 'neutral'">{{ g.siap ? 'siap Disiapkan' : (g.baris.filter(b => b.entry_qty || b.entry_qty===0).length + '/' + g.baris.length + ' entry') }}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;">
              <div v-for="b in g.baris" :key="barisKey(b)" style="border:1px solid var(--line); border-radius:12px; padding:8px;" :style="{ background: tertahan(b.masuk_tahap_pada) ? 'var(--warn-light)' : 'transparent' }">
                <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:4px;">
                  <span style="font-weight:700; font-size:12px;">{{ b.nama_aksesoris }} {{ b.warna }}</span>
                  <span v-if="b.entry_qty || b.entry_qty===0" class="tag ok">sudah entry</span>
                  <span v-else class="tag" :class="tertahan(b.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(b.masuk_tahap_pada) }}</span>
                </div>
                <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:6px;">{{ formatQty(b.butuh) }} {{ b.satuan }}</div>
                <div v-if="b.catatan_masalah" style="font-size:10.5px; color:var(--danger); background:var(--danger-light); border-radius:8px; padding:5px 8px; margin-bottom:6px;"><i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>{{ b.catatan_masalah }}</div>
                <div v-if="bolehProses && !(b.entry_qty || b.entry_qty===0)" style="display:flex; gap:6px;">
                  <button v-if="aksiAktif(MY_TARGET,'entry_finishing')" @click="bukaEntry(b)" :disabled="sedangProses[barisKey(b)]" class="btn-primary" style="flex:1; padding:7px; font-size:11px;"><i class="fas fa-qrcode" style="margin-right:4px;"></i>Scan Entry</button>
                  <button v-if="aksiAktif(MY_TARGET,'masalah_finishing')" @click="bukaAksi('masalah', b)" :disabled="sedangProses[barisKey(b)]" class="btn-outline" style="flex:1; padding:7px; font-size:11px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Masalah</button>
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
      :judul="modalAksi.mode==='ganti' ? 'Scan QR operator pengganti' : ('Scan label ' + (modalAksi.baris?.id_order || ''))"
      :subjudul="modalAksi.mode==='masalah' ? 'Scan Masalah — akan diminta jumlah kurang & alasan.' : ''"
      @hasil="hasilScanAksi" @tutup="tutupAksi" />
    <scan-terpadu-generik :c="entryStok" />

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;"><i class="fas fa-triangle-exclamation" style="margin-right:8px; color:var(--danger);"></i>Ajukan Masalah — {{ popupMasalah.baris.id_order }}</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0 0 10px;">{{ popupMasalah.baris.nama_aksesoris }} {{ popupMasalah.baris.warna }} — akan masuk ke Persiapan Produksi &gt; Masalah utk diajukan ke Owner.</p>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah kurang ({{ popupMasalah.baris.satuan }})</label><input v-model="popupMasalah.jumlahKurang" type="number" min="0" step="1"></div>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jenis Masalah</label><select v-model="popupMasalah.jenis"><option value="kurang">Kurang</option><option value="cacat">Cacat</option><option value="hilang">Hilang</option></select></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="Mis. stok fisik kurang/rusak"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>

    <div v-if="popupCetakUlang" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;"><i class="fas fa-rotate" style="margin-right:8px; color:var(--warn);"></i>Cetak Ulang Label</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0 0 10px;">{{ popupCetakUlang.grup.kodeSpk }} — centang label yang hilang/rusak, dicatat di riwayat cetak ulang.</p>
        <div style="display:flex; flex-direction:column; gap:4px; max-height:220px; overflow-y:auto; border:1px solid var(--line); border-radius:12px; padding:8px; margin-bottom:12px;">
          <label v-for="b in popupCetakUlang.grup.baris" :key="barisKey(b)" style="display:flex; align-items:center; gap:8px; font-size:11px; padding:4px 2px;">
            <input type="checkbox" v-model="popupCetakUlang.pilihan[barisKey(b)]">
            <span>{{ b.nama_aksesoris }} {{ b.warna }} · <span class="gc-num" style="font-weight:700;">{{ bangunLabelAksesoris(b, formatQty).kode }}</span></span>
          </label>
        </div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupCetakUlang.alasan" type="text" placeholder="Mis. label rusak/hilang"></div>
        <div style="display:flex; gap:8px;">
          <button @click="popupCetakUlang = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="lanjutCetakUlang" :disabled="!barisTerpilihCetakUlang().length" class="btn-primary" style="flex:1; padding:9px;">Lanjut Verifikasi PIN</button>
        </div>
      </div>
    </div>
    <popup-pin-generik v-if="pinCetakUlangAktif" judul="Verifikasi PIN — Cetak Ulang Label" konteks="Acc Finishing - Cetak Ulang Label" @sukses="pinCetakUlangSukses" @batal="pinCetakUlangAktif = false" />
    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Ulang Label Anak SPK" :daftar-label="daftarLabelPreview" jenis-cetak="label_spk_acc_finishing" @tutup="popupCetakAktif = false" />
  `
};


// TAB 3: Perlu Di Kirim — hanya baris berstatus perlu_dikirim. Dua cetak (Kode
// Bagging tanpa TLC, Kode Tugas dengan tujuan TLC dropdown), dua scan (Pack, Kirim).
// SATU scan bisa menandai BEBERAPA baris komponen sekaligus (semua komponen 1 anak
// SPK saat pack, atau semua baris ber-kode_bagging sama saat kirim) — beda dari Bahan.

const PersiapanFinishingPerluDikirim = {
  components: { PopupPratinjauCetakLabel, ScanGenerik },
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const daftarBaggingAktif = ref([]);
    const daftarTlc = ref([]);
    const sedangProses = ref(false);
    const MY_TARGET = 'sub-pp-finishing-perludikirim';
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
      saringMilikOperator(barisTertahan.value).forEach(b => {
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
          // kode_grouping_induk/kode_separating — null sampai diisi Scan Pack.
          await addDoc(collection(db, 'bagging'), {
            kode, produk_label: grup.label, isi: [], ditutup_pada: null,
            kode_grouping_induk: null, kode_separating: null,
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
        ['TLC-BHN', 'Gudang Bahan'], ['TLC-SER', 'Collection'], ['TLC-SEW', 'Pos Acc Sewing'], ['TLC-WEB', 'Pos Acc Webbing'],
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

    // Scan Pack: step1 kode bagging, step2 anak SPK berkali-kali. 1 scan
    // anak SPK menandai SEMUA baris komponen anak SPK itu (bisa lintas beberapa
    // baris, tapi selalu di dalam kartu/dokumen yang sama).
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
      // label yang discan di sini adalah kartu yang SAMA dengan yang dicetak Tab 1
      // (`cetakLabelKartu` pakai `kode_kartu || id_order`), jadi pencocokan di sini
      // harus memakai fallback chain yang sama seperti `cariBarisSiapTunjuk`.
      const cocok = barisTertahan.value.filter(x => kodeLabelAcc(x) === kode && !x.kode_bagging);
      if (!cocok.length) { alert(`Kode "${kode}" tidak cocok anak SPK yang masih tertahan / sudah di-pack.`); return; }
      if (labelSepack(cocok[0]) !== modalPack.bagging.produk_label) {
        alert(`Kode "${kode}" bukan produk yang sama dengan bagging ini (${modalPack.bagging.produk_label}). Syarat sepack: produk dan size harus sama.`);
        return;
      }
      // scan PERTAMA jadi VALIDATOR: kode_grouping_induk dikunci ke dokumen `bagging`. Scan
      // berikutnya WAJIB kode_grouping_induk sama, kalau beda DITOLAK. Pos ini selalu level
      // grouping (kode_separating baru ada setelah Separating di Serie), jadi warna
      // tetap boleh campur.
      if (modalPack.bagging.kode_separating && cocok[0].kode_separating !== modalPack.bagging.kode_separating) {
        alert(`Kode "${kode}" dari Kode Separating berbeda (${cocok[0].kode_separating}) dari bagging ini (${modalPack.bagging.kode_separating}). 1 bagging cuma boleh 1 separating.`);
        return;
      }
      const byTrack = {};
      cocok.forEach(b => { (byTrack[b._trackId] ||= []).push(b); });
      try {
        // matchFn value-based .
        const hasil = await Promise.all(Object.entries(byTrack).map(([trackId, barisGrup]) => {
          return updateBarisFinishingMassal(trackId, (x) => kodeLabelAcc(x) === kode && !x.kode_bagging && x.status === 'perlu_dikirim', () => ({ kode_bagging: modalPack.bagging.kode }));
        }));
        if (hasil.every(k => k === 0)) { alert(`Kode "${kode}" cocok di layar tapi GAGAL disimpan ke database. Muat ulang halaman lalu coba lagi.`); return; }
        const patchBagging = { isi: arrayUnion(kode) };
        if (!modalPack.bagging.kode_separating) patchBagging.kode_separating = cocok[0].kode_separating || null;
        await updateDoc(doc(db, 'bagging', modalPack.bagging.id), patchBagging);
        if (!modalPack.bagging.kode_separating) modalPack.bagging.kode_separating = cocok[0].kode_separating || null;
        modalPack.log.unshift(kode + ` (${cocok.length} komponen) -> ` + modalPack.bagging.kode);
        cocok.forEach(b => { b.kode_bagging = modalPack.bagging.kode; });
      } catch (e) { console.error('Gagal scan pack:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }
    async function tutupBagging() {
      if (!modalPack.bagging) return;
      try { await updateDoc(doc(db, 'bagging', modalPack.bagging.id), { ditutup_pada: serverTimestamp() }); } catch (e) { console.error('Gagal tutup bagging:', e); alert('Gagal menutup bagging. Coba lagi.'); }
      modalPack.bagging = null;
    }

    // Scan Kirim: step1 kode tugas, step2 kode bagging tiap pack.
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
      const anggota = barisTertahan.value.filter(x => x.kode_bagging === kode);
      if (!anggota.length) { alert(`Kode bagging "${kode}" tidak ditemukan di antara yang masih tertahan (mungkin belum di-pack, atau sudah dikirim).`); return; }
      const now = new Date().toISOString();
      const byTrack = {};
      anggota.forEach(b => { (byTrack[b._trackId] ||= []).push(b); });
      try {
        // matchFn value-based (kode_bagging).
        await Promise.all(Object.entries(byTrack).map(([trackId, barisGrup]) => {
          return updateBarisFinishingMassal(trackId, (x) => x.kode_bagging === kode, () => ({
            status: 'sedang_dikirim', masuk_tahap_pada: now, kode_tugas: modalKirim.tugas.kode,
            tlc_tujuan: modalKirim.tugas.tlc_tujuan || ''
          }));
        }));
        // kode_separating ikut disalin ke pack[], dilepas oleh Scan Sampai (sampai_pada).
        await updateDoc(doc(db, 'tugas_kirim', modalKirim.tugas.id), {
          pack: arrayUnion({ kode_bagging: kode, kode_grouping_induk: null, kode_separating: anggota[0].kode_separating || null, pada: now, sampai_pada: null })
        });
        modalKirim.log.unshift(kode + ' (' + anggota.length + ' komponen) -> ' + modalKirim.tugas.kode);
      } catch (e) { console.error('Gagal scan kirim:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-finishing-tahap'); await window.authReady; await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, kelompokSepack, daftarTlc, bolehProses, bolehCetak, sedangProses,
      // sama seperti komponen "Perlu Disiapkan" di atas: barisKey dipakai
      // templat (key v-for) tapi lupa di-return.
      formatQty, formatDiamSejak, tertahan, barisKey, aksiAktif,
      popupBagging, bukaCetakBagging, konfirmasiCetakBagging,
      popupTugas, bukaCetakTugas, konfirmasiCetakTugas, isiTlcAwal,
      popupCetakAktif, daftarLabelPreview, jenisCetakAktif,
      modalPack, bukaScanPack, tutupScanPack, hasilScanPack, tutupBagging,
      modalKirim, bukaScanKirim, tutupScanKirim, hasilScanKirim,
      TAB_DEFS_FINISHING, gantiTabPill, MY_TARGET
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Acc Finishing</h3>
          <div class="sub">{{ kelompokSepack.length }} produk tertahan di Perlu Di Kirim</div>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_FINISHING" :key="t.target" type="button"
          :class="['sub-pp-finishing-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-finishing-tahap', t.target, $event)">
          <i :class="'fas ' + t.icon" style="margin-right:6px;"></i>{{ t.label }}
        </button>
      </div>

      <div v-if="bolehCetak" style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <button @click="bukaCetakBagging" class="btn-outline" style="flex:1; min-width:150px; padding:9px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Kode Bagging</button>
        <button @click="bukaCetakTugas" class="btn-outline" style="flex:1; min-width:150px; padding:9px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Kode Tugas</button>
      </div>
      <div v-if="bolehProses" style="display:flex; gap:8px; margin-bottom:12px;">
        <button v-if="aksiAktif(MY_TARGET,'pack_finishing')" @click="bukaScanPack" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Pack</button>
        <button v-if="aksiAktif(MY_TARGET,'kirim_finishing')" @click="bukaScanKirim" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Kirim</button>
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
              <span style="font-weight:700;">{{ ((b.nama_produk || '') + ' ' + (b.produk_warna || '')).trim() || b.id_order }}</span>
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


// TAB 4: Sedang Di Kirim — VIEW-ONLY, SAMA pola vue-persiapan-bahan.js.

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
      const baris = saringMilikOperator(daftarBarisDariTrack(daftarTrack.value).filter(b => b.status === 'sedang_dikirim'));
      const peta = {};
      baris.forEach(b => {
        const key = b.kode_tugas || '(tanpa kode tugas)';
        if (!peta[key]) peta[key] = { kodeTugas: key, baris: [] };
        peta[key].baris.push(b);
      });
      return Object.values(peta).sort((a, b) => a.kodeTugas.localeCompare(b.kodeTugas));
    });
    const MY_TARGET = 'sub-pp-finishing-sedangdikirim';
    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-finishing-tahap'); await window.authReady; await muat(); });
    return { muat, memuat, kelompokTugas, formatQty, formatDiamSejak, barisKey, TAB_DEFS_FINISHING, gantiTabPill, MY_TARGET };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Acc Finishing</h3>
          <div class="sub">{{ kelompokTugas.length }} kode tugas sedang di jalan</div>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_FINISHING" :key="t.target" type="button"
          :class="['sub-pp-finishing-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-finishing-tahap', t.target, $event)">
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
            <span style="font-weight:700;">{{ ((b.nama_produk || '') + ' ' + (b.produk_warna || '')).trim() || b.id_order }}</span>
            <span style="color:var(--text-faint);">{{ b.nama_aksesoris }} {{ b.warna }} &middot; {{ formatQty(b.butuh) }} {{ b.satuan }}</span>
            <span class="gc-num" style="color:var(--text-faint);">{{ b.kode_bagging }}</span>
          </div>
        </div>
      </div>
    </div>
    </div>
  `
};


// TAB 5: Selesai — baris pindah ke status 'selesai' saat DIVISI PENERIMA Scan
// Sampai, BUKAN saat pos ini Scan Kirim. Layar "Scan Sampai" di luar lingkup file
// ini, jadi tab ini hanya MEMBACA `status`/`sampai_pada` yang ditulis modul lain —
// selama modul itu belum ada tab ini kosong terus, dan itu bukan bug file ini.

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

    const MY_TARGET = 'sub-pp-finishing-selesai';
    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-finishing-tahap'); await window.authReady; await muat(); });

    return { muat,
      memuat, isOperatorSaja, barisSaya, daftarUrut, kpi,
      formatQty, formatWaktu, formatSiklus, siklusJam, keadaan, barisKey,
      TAB_DEFS_FINISHING, gantiTabPill, MY_TARGET
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
            <span style="font-weight:700; font-size:12px;">{{ ((b.nama_produk || '') + ' ' + (b.produk_warna || '')).trim() || b.id_order }}</span>
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

    <!--
      isOperatorSaja: versi "Riwayat Saya" TETAP tanpa gc-card-head/pill, sama alasan seperti
      vue-persiapan-bahan.js/vue-persiapan-sewing.js.
    -->
    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Acc Finishing</h3>
          <div class="sub">{{ kpi.selesai }} selesai hari ini</div>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_FINISHING" :key="t.target" type="button"
          :class="['sub-pp-finishing-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-finishing-tahap', t.target, $event)">
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
                <div class="gc-num" style="font-weight:700;">{{ b.id_order }}</div>
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

// Mount ke index.html — LAZY, SAMA pola vue-persiapan-bahan.js: fungsi
// window.pastikanMountPpFinishingXxx dipanggil oleh pindahSubTab (js/
// dashboard.js, peta `petaMount`) PERTAMA KALI tab itu dibuka.
let vmPpFinishingPerluDisiapkan = null;
window.pastikanMountPpFinishingPerluDisiapkan = function () {
  if (vmPpFinishingPerluDisiapkan) { if (typeof vmPpFinishingPerluDisiapkan.muat === 'function') vmPpFinishingPerluDisiapkan.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-finishing-perludisiapkan');
  if (mountPoint) vmPpFinishingPerluDisiapkan = createApp(PersiapanFinishingPerluDisiapkan).mount('#vue-pp-finishing-perludisiapkan');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js) — mobile: ini
// SATU-SATUNYA pemicu (tombol header di-hidden di mobile via CSS).
window.bukaScanOperatorFinishing = function () { window.pastikanMountPpFinishingPerluDisiapkan(); if (vmPpFinishingPerluDisiapkan) vmPpFinishingPerluDisiapkan.bukaPenunjukanGlobal(); };
window.bukaSampaiMasalahFinishing = function () { window.pastikanMountPpFinishingPerluDisiapkan(); if (vmPpFinishingPerluDisiapkan) vmPpFinishingPerluDisiapkan.bukaScanSampaiGlobal(); };
let vmPpFinishingSedangDisiapkan = null;
window.pastikanMountPpFinishingSedangDisiapkan = function () {
  if (vmPpFinishingSedangDisiapkan) { if (typeof vmPpFinishingSedangDisiapkan.muat === 'function') vmPpFinishingSedangDisiapkan.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-finishing-sedangdisiapkan');
  if (mountPoint) vmPpFinishingSedangDisiapkan = createApp(PersiapanFinishingSedangDisiapkan).mount('#vue-pp-finishing-sedangdisiapkan');
};
let vmPpFinishingPerluDikirim = null;
window.pastikanMountPpFinishingPerluDikirim = function () {
  if (vmPpFinishingPerluDikirim) { if (typeof vmPpFinishingPerluDikirim.muat === 'function') vmPpFinishingPerluDikirim.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-finishing-perludikirim');
  if (mountPoint) vmPpFinishingPerluDikirim = createApp(PersiapanFinishingPerluDikirim).mount('#vue-pp-finishing-perludikirim');
};
window.bukaPackFinishing = function () { window.pastikanMountPpFinishingPerluDikirim(); if (vmPpFinishingPerluDikirim) vmPpFinishingPerluDikirim.bukaScanPack(); };
window.bukaKirimFinishing = function () { window.pastikanMountPpFinishingPerluDikirim(); if (vmPpFinishingPerluDikirim) vmPpFinishingPerluDikirim.bukaScanKirim(); };
let vmPpFinishingSedangDikirim = null;
window.pastikanMountPpFinishingSedangDikirim = function () {
  if (vmPpFinishingSedangDikirim) { if (typeof vmPpFinishingSedangDikirim.muat === 'function') vmPpFinishingSedangDikirim.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-finishing-sedangdikirim');
  if (mountPoint) vmPpFinishingSedangDikirim = createApp(PersiapanFinishingSedangDikirim).mount('#vue-pp-finishing-sedangdikirim');
};
let vmPpFinishingSelesai = null;
window.pastikanMountPpFinishingSelesai = function () {
  if (vmPpFinishingSelesai) { if (typeof vmPpFinishingSelesai.muat === 'function') vmPpFinishingSelesai.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-finishing-selesai');
  if (mountPoint) vmPpFinishingSelesai = createApp(PersiapanFinishingSelesai).mount('#vue-pp-finishing-selesai');
};
