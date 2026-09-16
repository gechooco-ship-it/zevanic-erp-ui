// js/vue-persiapan-webbing.js
// Persiapan Produksi > Acc Webbing. Pos webbing & tali, satuan METER tapi
// diambil per ROLL: tiap baris punya butuh_meter DAN roll, plus kolom teks
// bebas Kode Webbing 2 & 3.
//
// Koleksi & field:
// - spk_track jalur:'webbing', webbing_rincian[] diisi hitungWebbingRincian
//   (vue-persiapan-produksi-v2.js) saat SPK Grouping terbit: 1 baris per
//   (komponen aksesoris x anak SPK) dari bom_aksesoris tahap "webbing".
// - Khas pos ini: panjang_per_pcs, butuh_meter, roll, kode_webbing2/3
//   (snapshot bom_aksesoris, teks bebas, boleh kosong, tak menghalangi cetak).
// - roll_sisa_webbing + pengaturan_id_roll_sisa koleksi sendiri, butuh entri
//   firestore.rules pola isAdminLevel (lihat konfirmasiEntry).
//
// Jebakan:
// - roll = butuh_meter / master_bahan_aksesoris.panjang_roll dibulatkan ke
//   atas. panjang_roll OPSIONAL; kalau kosong roll NULL dan kartu tampil "-"
//   plus tag peringatan — jangan ditebak jadi angka.
// - Satu kartu = satu SPK Grouping (kode -WEB), tidak ada kumulatif butuh/
//   stok lintas grouping; updateBarisWebbingMassal menandai banyak baris.

import { createApp, ref, reactive, computed, watch, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel, bangunLabelAksesoris } from './vue-components.js?v=13';
import { ScanGenerik, ScanTerpaduGenerik, buatScanTerpadu, PopupPinGenerik, buatQrDataUrl, muatJsQr, cariKaryawanByQr, ajukanPersiapanMasalah } from './vue-scan-cetak.js?v=7';

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
const JALUR = 'webbing';
const FIELD_RINCIAN = 'webbing_rincian';
const TLC_ASAL = 'TLC-WEB';
const MENU_ID = 'pp_webbing';
const ICON_KOSONG = 'fa-ribbon';

// Format & hitung kecil
function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
// formatRoll — khas pos ini. null TAMPIL "-", BUKAN angka hasil tebakan.
function formatRoll(n) {
  if (n === null || n === undefined) return '-';
  return Math.round(n) + ' roll';
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
async function muatSemuaTrackWebbing() {
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

// updateBarisWebbing — read-modify-write ATOMIK 1 baris (dipilih lewat index),
// SAMA pola seperti updateBarisBahan di vue-persiapan-bahan.js. Dipakai aksi
// yang menyentuh SATU baris komponen (Tunjuk 1-per-1 kalau sudah dipisah, entry,
// masalah, ganti operator).
async function updateBarisWebbing(trackId, lineIdx, patchFn) {
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
// updateBarisWebbingMassal — BEDA dari versi 1-baris milik Bahan: patch SEMUA
// elemen array yang lolos matchFn dalam SATU transaksi. Perlu karena "1 kartu =
// 1 SPK Grouping", jadi 1 scan Tunjuk/Pack/Kirim bisa menandai banyak baris
// komponen sekaligus (semua komponen 1 anak SPK, atau semua ber-kode_bagging sama).
async function updateBarisWebbingMassal(trackId, matchFn, patchFn) {
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

// konfirmasiEntry — SATU-SATUNYA tempat stok master_bahan_aksesoris berkurang;
// stok_akhir dikurangi PERSIS sebesar butuh_meter, BUKAN b.roll x panjang_roll. Sisa
// pembulatan roll (> 0,01 m) cuma dicatat di `roll_sisa_webbing` (prefix 'RS') sebagai
// traceability, bukan koreksi stok. Status sesudah entry tetap 'sedang_disiapkan'.
async function konfirmasiEntry(b) {
  const refTrack = doc(db, 'spk_track', b._trackId);
  const refBahan = doc(db, 'master_bahan_aksesoris', b.bahan_aksesoris_id);
  const now = new Date().toISOString();
  const oleh = window.currentUser?.email || '';

  // Hitung & siapkan kode roll sisa DI LUAR transaksi utama (generateKodeHarian
  // punya transaksi counter sendiri — Firestore tidak boleh nested transaction).
  // refRollSisa juga dibuat di luar supaya kalau transaksi utama di bawah retry
  // (kontensi), doc ref-nya tetap SAMA (idempotent), tidak dobel.
  let kodeRollSisa = null;
  let sisaMeterHitung = 0;
  let refRollSisa = null;
  if (b.roll !== null && b.roll !== undefined) {
    try {
      const snapBahanAwal = await getDoc(refBahan);
      const panjangRoll = parseFloat(snapBahanAwal.data()?.panjang_roll) || 0;
      if (panjangRoll > 0) {
        sisaMeterHitung = Math.round(((b.roll * panjangRoll) - (parseFloat(b.butuh) || 0)) * 100) / 100;
        if (sisaMeterHitung > 0.01) {
          kodeRollSisa = await generateKodeHarian('RS', 'pengaturan_id_roll_sisa');
          refRollSisa = doc(collection(db, 'roll_sisa_webbing'));
        }
      }
    } catch (e) { console.error('Gagal hitung roll sisa (tidak menghalangi entry):', e); }
  }

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
    if (refRollSisa) {
      trx.set(refRollSisa, {
        kode: kodeRollSisa,
        bahan_aksesoris_id: b.bahan_aksesoris_id,
        nama_aksesoris: b.nama_aksesoris || '',
        warna: b.warna || '',
        sisa_meter: sisaMeterHitung,
        asal_no_spk: b.no_spk || '',
        asal_trackId: b._trackId,
        status: 'tersedia',
        dibuat_oleh: oleh,
        dibuat_pada: serverTimestamp()
      });
    }
  });
}

// kelompokKartuSpk — kelompokkan baris (SUDAH difilter status tertentu) jadi
// kartu per SPK TRACK (= per SPK Grouping, ). Beda dari kelompokKartuBahan di
// vue-persiapan-bahan.js: TIDAK ada alokasi greedy lintas kartu — tiap baris
// dicek CUKUP/KURANG independen terhadap stok live komponennya sendiri.
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

const TAB_DEFS_WEBBING = [
  { target: 'sub-pp-webbing-perludisiapkan', icon: 'fa-inbox', label: 'Perlu Disiapkan' },
  { target: 'sub-pp-webbing-sedangdisiapkan', icon: 'fa-gears', label: 'Sedang Disiapkan' },
  { target: 'sub-pp-webbing-perludikirim', icon: 'fa-box-open', label: 'Perlu Di Kirim' },
  { target: 'sub-pp-webbing-sedangdikirim', icon: 'fa-truck-fast', label: 'Sedang Di Kirim' },
  { target: 'sub-pp-webbing-selesai', icon: 'fa-circle-check', label: 'Selesai' }
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

const PersiapanWebbingPerluDisiapkan = {
  components: { PopupPratinjauCetakLabel, ScanGenerik, ScanTerpaduGenerik, PopupPinGenerik },
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const petaStokBahan = ref({});
    const cari = ref('');
    const pilihanCetak = reactive({}); // barisKey -> bool (override manual)
    const daftarRollSisa = ref([]); // gap #3 "roll sisa" — read-only, lihat konfirmasiEntry
    const rollSisaTerbuka = ref(false);

    const MY_TARGET = 'sub-pp-webbing-perludisiapkan';
    // satu-satunya pemakai bolehProses di komponen ini adalah tombol "Tunjuk
    // Operator", jadi digerbang langsung PIC ke atas di sini.
    const bolehProses = computed(() => picOwnerKeAtas(window.currentUser) && window.cekIzinMenu(MENU_ID, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(MENU_ID, 'print') !== false);
    // bolehEdit — RETROFIT, gerbang tombol "Scan Sampai" global (lihat catatan
    // sama di vue-persiapan-bahan.js/vue-persiapan-sewing.js).
    const bolehEdit = computed(() => window.cekIzinMenu(MENU_ID, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const [tracks, stokSnap, rollSisaSnap] = await Promise.all([
          muatSemuaTrackWebbing(),
          getDocs(collection(db, 'master_bahan_aksesoris')),
          getDocs(query(collection(db, 'roll_sisa_webbing'), where('status', '==', 'tersedia')))
        ]);
        daftarTrack.value = tracks;
        const peta = {}; stokSnap.forEach(d => { peta[d.id] = d.data(); });
        petaStokBahan.value = peta;
        daftarRollSisa.value = rollSisaSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error('Gagal muat Acc Webbing > Perlu Disiapkan:', e);
        daftarTrack.value = [];
        daftarRollSisa.value = [];
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
    // bangunLabelAksesoris (js/vue-components.js, dipakai Acc Sewing/Finishing juga),
    // tapi rincian.roll/kode_webbing2/kode_webbing3 per baris; qrDataUrl di titik cetak.
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    let _pendingCetak = [];
    function bangunRincianWebbing(b) {
      return { roll: formatRoll(b.roll), kode_webbing2: b.kode_webbing2 || '-', kode_webbing3: b.kode_webbing3 || '-' };
    }
    function cetakLabelKartu(k) {
      if (typeof QRCode === 'undefined') { alert('Library pembuat QR belum siap dimuat. Refresh halaman (Ctrl+Shift+R) lalu ulangi.'); return; }
      const terpilih = k.baris.filter(b => isChecked(b) && b._bisa && !b.label_cetak_pada);
      if (!terpilih.length) { alert('Tidak ada baris yang bisa dicetak (stok belum cukup untuk baris manapun, atau sudah dicetak semua).'); return; }
      daftarLabelPreview.value = terpilih.map(b => {
        const lbl = bangunLabelAksesoris(b, formatQty);
        return { ...lbl, qrDataUrl: buatQrDataUrl(lbl.kode), rincian: bangunRincianWebbing(b) };
      });
      _pendingCetak = terpilih;
      popupCetakAktif.value = true;
    }
    async function onCetakSelesai() {
      const now = new Date().toISOString();
      try {
        // 1 aksi cetak bisa mencakup >1 baris DI DOKUMEN YANG SAMA (kartu = 1
        // dokumen) — cukup 1 updateBarisWebbingMassal per kartu, bukan N
        // transaksi terpisah per baris.
        const byTrack = {};
        _pendingCetak.forEach(b => { (byTrack[b._trackId] ||= []).push(b); });
        // matchFn lama `(b, i) => idxSet.has(i)` TIDAK PERNAH benar:
        // updateBarisWebbingMassal cuma memanggil matchFn(arr[i]) TANPA index
        // kedua, jadi `i` selalu undefined dan baris TIDAK PERNAH tertandai .
        // Diganti matching by value (no_spk).
        await Promise.all(Object.entries(byTrack).map(([trackId, barisGrup]) => {
          const noSpkSet = new Set(barisGrup.map(b => b.no_spk));
          return updateBarisWebbingMassal(trackId, (x) => noSpkSet.has(x.no_spk), () => ({ label_cetak_pada: now }));
        }));
      } catch (e) { console.error('Gagal catat label_cetak_pada:', e); }
      _pendingCetak = [];
      await muat();
    }

    // Cetak ulang: alasan + PIN diverifikasi kriptografis lewat `PopupPinGenerik`
    // (js/vue-scan-cetak.js, rolesDiizinkan=null = semua admin-level) dan dicatat di
    // cetak_ulang_log — PIN siapa pun diterima, yang dicatat adalah pemilik PIN.
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
      // Sama fungsi dgn cetakLabelKartu di atas (bangunLabelAksesoris bersama)
      // supaya label cetak-ulang PERSIS format cetak normal, tetap cocok dgn
      // scanOperator.validasiIsi/hasilScanAksi.
      const preview = sudahDicetak.map(b => {
        const lbl = bangunLabelAksesoris(b, formatQty, { cetakUlang: true });
        return { ...lbl, qrDataUrl: buatQrDataUrl(lbl.kode), rincian: bangunRincianWebbing(b) };
      });
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

    // Scan Operator — disebar dari PILOT #5 vue-persiapan-bahan.js (Draft/Upload),
    // gantikan modalTunjuk lama. kartuAktifTunjuk null = cari di SEMUA kartu tab ini
    // (tombol toolbar), object = kartu spesifik — diset SEBELUM buka() lewat closure.
    // 1 scan anak SPK menandai SEMUA baris komponennya (beda dari Bahan 1 baris/anak SPK).
    let kartuAktifTunjuk = null;
    function cariBarisSiapTunjuk(kode) {
      const kolamBaris = kartuAktifTunjuk ? (kartuAktifTunjuk.baris || []) : kartuList.value.flatMap(k => k.baris);
      return kolamBaris.filter(b => (b.kode_kartu || b.no_spk) === kode && b.label_cetak_pada && b.status === 'perlu_disiapkan');
    }
    const scanOperator = buatScanTerpadu({
      judul: 'Scan Operator — Acc Webbing', subjudul: 'Scan QR operator/tim, lalu scan label anak SPK berkali-kali',
      twoStep: {
        labelPertama: 'Operator/Tim', labelKedua: 'Label Anak SPK',
        placeholderPertama: 'Scan QR badge operator/tim / cari kode (sekali di awal)',
        placeholderKedua: 'Scan label anak SPK yang sudah dicetak / cari kode (bisa berkali-kali)',
        camModePertama: 'Mode: Scan QR Operator (sekali)', camModeKedua: 'Mode: Scan Label Anak SPK (berkali-kali)',
        kosongUtama: 'Scan QR Operator/Tim dulu', kosongSub: '1x scan untuk mengunci operator yang ditunjuk.',
        validasi: async (kode) => {
          const karyawan = await cariKaryawanByQr(kode);
          if (!karyawan) return { ok: false, pesan: 'QR tidak dikenali — operator/tim tidak ditemukan.' };
          return { ok: true, data: { id: karyawan.id, nama: karyawan.nama || karyawan.name || karyawan.id } };
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
      // matchFn tulis Firestore WAJIB pakai fallback `kode_kartu || no_spk`, sama
      // dengan validasiIsi; `kena` dicek eksplisit karena updateBarisWebbingMassal
      // commit-tanpa-perubahan tidak melempar exception.
      padaUpload: async (rows, locked) => {
        const now = new Date().toISOString();
        const gagal = [];
        try {
          for (const row of rows) {
            const targets = cariBarisSiapTunjuk(row.kode);
            if (!targets.length) { gagal.push(row.kode); continue; }
            const kena = await updateBarisWebbingMassal(targets[0]._trackId, (x) => (x.kode_kartu || x.no_spk) === row.kode && x.status === 'perlu_disiapkan' && !!x.label_cetak_pada, (lama) => ({
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
    function bukaPenunjukan(k) {
      const eligible = k.baris.filter(b => b.label_cetak_pada && b.status === 'perlu_disiapkan');
      if (!eligible.length) { alert('Belum ada baris yang sudah dicetak labelnya di kartu ini.'); return; }
      kartuAktifTunjuk = k;
      scanOperator.buka();
    }
    // bukaPenunjukanGlobal — versi toolbar header: TIDAK terkunci ke 1 kartu,
    // mencari baris cocok di SEMUA kartu tampil di tab ini. Tombol per-kartu TETAP ADA.
    function bukaPenunjukanGlobal() {
      const eligible = kartuList.value.some(k => k.baris.some(b => b.label_cetak_pada && b.status === 'perlu_disiapkan'));
      if (!eligible) { alert('Belum ada baris yang sudah dicetak labelnya di tab ini.'); return; }
      kartuAktifTunjuk = null;
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
        await Promise.all([...trackIdSet].map(trackId => updateBarisWebbingMassal(trackId, (x) => x.kode_bagging === kode && !!x.catatan_masalah, () => ({ catatan_masalah: '' }))));
        modalScanSampai.log.unshift(`${kode} → ${cocok.length} baris diterima kembali`);
        await muat();
      } catch (e) { console.error('Gagal scan sampai:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-webbing-tahap'); await window.authReady; await muat(); });

    return { muat,
      memuat, kartuList, cari, isChecked, toggleCheck,
      bolehProses, bolehCetak, bolehEdit, formatQty, formatWaktu, formatRoll, ICON_KOSONG,
      // `barisKey` dipakai sebagai :key v-for di template, jadi WAJIB ikut di-return
      // dari setup. Kalau tidak, begitu kartuList terisi Vue memanggil _ctx.barisKey
      // yang undefined -> render crash -> vnode lama ("Memuat..") tertahan di layar.
      barisKey, bangunLabelAksesoris,
      TAB_DEFS_WEBBING, gantiTabPill, MY_TARGET, kpiHeader,
      popupCetakAktif, daftarLabelPreview, cetakLabelKartu, onCetakSelesai,
      popupCetakUlang, bukaCetakUlang, lanjutCetakUlang, pinCetakUlangAktif, pinCetakUlangSukses, batalPinCetakUlang,
      scanOperator, bukaPenunjukan, bukaPenunjukanGlobal,
      modalScanSampai, bukaScanSampaiGlobal, tutupScanSampai, hasilScanSampai,
      daftarRollSisa, rollSisaTerbuka
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Acc Webbing</h3>
          <div class="sub">{{ kpiHeader.spkMenunggu }} SPK menunggu &middot; {{ kpiHeader.siapDicetak }} siap dicetak</div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button v-if="bolehEdit" @click="bukaScanSampaiGlobal" class="btn-outline" style="padding:8px 14px;"><i class="fas fa-inbox" style="margin-right:6px;"></i>Scan Sampai</button>
          <button v-if="bolehProses" @click="bukaPenunjukanGlobal" class="btn-primary" style="padding:8px 14px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Operator</button>
        </div>
      </div>

      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_WEBBING" :key="t.target" type="button"
          :class="['sub-pp-webbing-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-webbing-tahap', t.target, $event)">
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

      <div v-if="daftarRollSisa.length" class="gc-card" style="padding:10px 14px; border-radius:16px; margin-bottom:12px; border-color:var(--warn);">
        <div style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;" @click="rollSisaTerbuka = !rollSisaTerbuka">
          <div style="font-size:12px; font-weight:700; color:var(--warn);"><i class="fas fa-scroll" style="margin-right:6px;"></i>Roll Sisa Tersedia ({{ daftarRollSisa.length }})</div>
          <i class="fas" :class="rollSisaTerbuka ? 'fa-chevron-up' : 'fa-chevron-down'" style="color:var(--text-faint);"></i>
        </div>
        <div v-if="rollSisaTerbuka" style="display:flex; flex-direction:column; gap:5px; margin-top:8px;">
          <div v-for="r in daftarRollSisa" :key="r.id" style="display:flex; align-items:center; gap:8px; font-size:11px; padding:5px 0; border-top:1px solid var(--line);">
            <span class="gc-num" style="font-weight:700; min-width:90px;">{{ r.kode }}</span>
            <span>{{ r.nama_aksesoris }} <span style="color:var(--text-faint);">{{ r.warna }}</span></span>
            <span class="gc-num" style="margin-left:auto; color:var(--text-faint);">sisa {{ formatQty(r.sisa_meter) }} m</span>
            <span style="color:var(--text-faint);">dari {{ r.asal_no_spk }}</span>
          </div>
        </div>
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

          <!-- RETROFIT (temuan #4) — tabel SELALU TERBUKA, collapse "buka rincian" dihapus. -->
          <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
            <label v-for="b in k.baris" :key="barisKey(b)" style="display:flex; align-items:flex-start; gap:8px; font-size:11px; padding:8px; border-radius:10px;" :style="{ background: b.label_cetak_pada ? 'var(--ok-light)' : (b._bisa ? 'transparent' : 'var(--danger-light)') }">
              <input type="checkbox" :checked="isChecked(b)" :disabled="!b._bisa || !!b.label_cetak_pada" @change="toggleCheck(b)" style="margin-top:2px;">
              <div style="min-width:0; flex:1;">
                <div class="gc-num" style="font-weight:700;">{{ bangunLabelAksesoris(b, formatQty).kode }}</div>
                <div style="font-weight:600;">{{ bangunLabelAksesoris(b, formatQty).nama }}</div>
                <div style="color:var(--text-faint);" v-html="bangunLabelAksesoris(b, formatQty).info"></div>
                <div style="color:var(--text-faint); margin-top:2px;">
                  <span :class="{ 'tag warn': b.roll === null }">{{ formatRoll(b.roll) }}</span>
                  <span v-if="b.kode_webbing2" class="tag neutral" style="margin-left:4px;">web2: {{ b.kode_webbing2 }}</span>
                  <span v-if="b.kode_webbing3" class="tag neutral" style="margin-left:4px;">web3: {{ b.kode_webbing3 }}</span>
                  <span class="gc-num" style="margin-left:4px;">stok {{ formatQty(b._stok) }}</span>
                </div>
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
            <button v-if="bolehProses && k.baris.some(b=>b.label_cetak_pada && b.status==='perlu_disiapkan')" @click="bukaPenunjukan(k)" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Operator</button>
          </div>
        </div>
      </div>
    </div>

    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Label Anak SPK" :daftar-label="daftarLabelPreview" jenis-cetak="label_spk_acc_webbing" @tutup="popupCetakAktif = false" @cetak="onCetakSelesai" />

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
    <popup-pin-generik v-if="pinCetakUlangAktif" judul="Verifikasi PIN — Cetak Ulang Label" konteks="Acc Webbing - Cetak Ulang Label" @sukses="pinCetakUlangSukses" @batal="batalPinCetakUlang" />

    <scan-terpadu-generik :c="scanOperator" />
  `
};


// TAB 2: Sedang Disiapkan — dikelompokkan per operator lalu per SPK Grouping (`_trackId`).
// Scan Entry hanya menandai `entry_qty`, TIDAK memindah status; tombol "Disiapkan"
// memindah SEMUA baris SPK sekaligus, aktif hanya kalau semua baris SPK (lintas trackId)
// sudah sedang_disiapkan DAN ber-entry_qty. Scan Masalah: tlc_asal='TLC-WEB', jalur 'webbing'.

const PersiapanWebbingSedangDisiapkan = {
  components: { ScanGenerik },
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const sedangProses = reactive({});
    const sedangProsesBatch = reactive({});
    const MY_TARGET = 'sub-pp-webbing-sedangdisiapkan';
    const bolehProses = computed(() => window.cekIzinMenu(MENU_ID, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try { daftarTrack.value = await muatSemuaTrackWebbing(); }
      catch (e) { console.error('Gagal muat Acc Webbing > Sedang Disiapkan:', e); daftarTrack.value = []; }
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
        await updateBarisWebbingMassal(g.trackId, (x) => x.status === 'sedang_disiapkan', () => ({ status: 'perlu_dikirim', masuk_tahap_pada: now }));
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
      popupMasalah.value = { baris: b, jumlahKurang: kurang > 0 ? kurang : b.butuh, alasan: '' };
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
        await updateBarisWebbing(b._trackId, b._lineIdx, () => ({ catatan_masalah: p.alasan.trim() }));
        await ajukanPersiapanMasalah({
          tlcAsal: 'TLC-WEB', sumberJalur: 'webbing',
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
          await updateBarisWebbing(b._trackId, b._lineIdx, (lama) => ({
            operator_uid: karyawan.id, operator_nama: karyawan.nama || karyawan.name || karyawan.id, ditugaskan_pada: now,
            riwayat_operator: [...(lama.riwayat_operator || []), { operator_uid: karyawan.id, operator_nama: karyawan.nama || karyawan.name || karyawan.id, mulai_pada: now }]
          }));
          tutupAksi(); await muat();
        } catch (e) { console.error('Gagal ganti operator:', e); alert('Gagal menyimpan. Coba lagi.'); }
        sedangProses[key] = false;
        return;
      }
      // cocokkan ke kode_kartu (fallback no_spk utk data lama), SAMA kode yg
      // dicetak (lihat cetakLabelKartu).
      const kodeLabelBaris = b.kode_kartu || b.no_spk;
      if (kode !== kodeLabelBaris) { alert(`Kode yang discan ("${kode}") tidak cocok dengan anak SPK ini (${kodeLabelBaris}).`); return; }
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

    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-webbing-tahap'); await window.authReady; await muat(); });

    return { muat,
      memuat, kelompokOperator, bolehProses, sedangProses, sedangProsesBatch, konfirmasiDisiapkan,
      formatQty, formatRoll, formatDiamSejak, tertahan, barisKey,
      modalAksi, bukaAksi, tutupAksi, hasilScanAksi,
      popupMasalah, batalMasalah, konfirmasiMasalah, bukaMasalahBaris,
      TAB_DEFS_WEBBING, gantiTabPill, MY_TARGET
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Acc Webbing</h3>
          <div class="sub">{{ kelompokOperator.length }} operator sedang menyiapkan</div>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_WEBBING" :key="t.target" type="button"
          :class="['sub-pp-webbing-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-webbing-tahap', t.target, $event)">
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
                <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:6px;">{{ b.nama_aksesoris }} {{ b.warna }} &middot; {{ formatQty(b.butuh) }} {{ b.satuan }} &middot; {{ formatRoll(b.roll) }} &middot; {{ b.nama_produk }}</div>
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
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="Mis. roll rusak/stok fisik kurang"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};


// TAB 3: Perlu Di Kirim — hanya baris berstatus perlu_dikirim. Dua cetak (Kode
// Bagging tanpa TLC, Kode Tugas dengan tujuan TLC dropdown), dua scan (Pack, Kirim).
// SATU scan bisa menandai BEBERAPA baris komponen sekaligus (semua komponen 1 anak
// SPK saat pack, atau semua baris ber-kode_bagging sama saat kirim) — beda dari Bahan.

const PersiapanWebbingPerluDikirim = {
  components: { PopupPratinjauCetakLabel, ScanTerpaduGenerik },
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const daftarBaggingAktif = ref([]);
    const daftarTlc = ref([]);
    const sedangProses = ref(false);
    const MY_TARGET = 'sub-pp-webbing-perludikirim';
    const bolehProses = computed(() => window.cekIzinMenu(MENU_ID, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(MENU_ID, 'print') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const [tracks, baggingSnap, tlcSnap] = await Promise.all([
          muatSemuaTrackWebbing(),
          getDocs(query(collection(db, 'bagging'), where('ditutup_pada', '==', null))),
          getDocs(collection(db, 'master_tlc'))
        ]);
        daftarTrack.value = tracks;
        daftarBaggingAktif.value = baggingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        daftarTlc.value = tlcSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error('Gagal muat Acc Webbing > Perlu Di Kirim:', e);
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
          // kode_spk/kode_batch — null sampai diisi Scan Pack.
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

    // Scan Pack — buatScanTerpadu (kamera tersemat + Draft->Upload), ganti
    // overlay+tulis-langsung lama. Step1 kunci Kode Bagging, step2 kumpulkan
    // kode kartu sebagai draft; Upload baru menulis kode_bagging tiap baris +
    // bagging.isi[]/kode_spk sekali jalan. 1 kartu bisa menandai SEMUA baris
    // komponen di dalamnya (lintas beberapa baris, satu track/dokumen yang
    // sama) — label yang discan sama dengan yang dicetak Tab 1 (`kode_kartu
    // || no_spk`, sama fallback chain seperti `cariBarisSiapTunjuk`).
    const packTerpadu = buatScanTerpadu({
      judul: 'Scan Pack — Acc Webbing', subjudul: 'Kaitkan kartu ke satu kode bagging',
      twoStep: {
        labelPertama: 'Kode Bagging', labelKedua: 'Kode Kartu',
        placeholderPertama: 'Scan QR Bagging / cari kode (sekali di awal)',
        placeholderKedua: 'Scan QR kartu / cari kode (bisa berkali-kali)',
        camModePertama: 'Mode: Scan Kode Bagging (sekali)', camModeKedua: 'Mode: Scan Kode Kartu (berkali-kali)',
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
        const cocok = barisTertahan.value.filter(x => (x.kode_kartu || x.no_spk) === kode && !x.kode_bagging);
        if (!cocok.length) return { ok: false, pesan: `Kode "${kode}" tidak cocok anak SPK yang masih tertahan / sudah di-pack.` };
        if (labelSepack(cocok[0]) !== bagging.produk_label) {
          return { ok: false, pesan: `Kode "${kode}" bukan produk yang sama dengan bagging ini (${bagging.produk_label}). Syarat sepack: produk dan size harus sama.` };
        }
        const kodeSpkTerkunci = bagging.kode_spk || rowsSaatIni[0]?._kodeSpk || null;
        if (kodeSpkTerkunci && cocok[0].kode_spk !== kodeSpkTerkunci) {
          return { ok: false, pesan: `Kode "${kode}" dari SPK Grouping berbeda (${cocok[0].kode_spk}) dari bagging ini (${kodeSpkTerkunci}). 1 bagging cuma boleh 1 grouping.` };
        }
        return { ok: true, row: { kode, label: cocok[0].nama_aksesoris + ' ' + (cocok[0].warna || ''), qty: String(cocok.length), tagTxt: 'cocok', tagCls: 'ok', _kodeSpk: cocok[0].kode_spk || null } };
      },
      padaUpload: async (rows, bagging) => {
        try {
          const kodeSpkBaru = bagging.kode_spk || rows[0]._kodeSpk || null;
          for (const r of rows) {
            const cocok = barisTertahan.value.filter(x => (x.kode_kartu || x.no_spk) === r.kode && !x.kode_bagging);
            const byTrack = {};
            cocok.forEach(b => { (byTrack[b._trackId] ||= []).push(b); });
            const hasil = await Promise.all(Object.keys(byTrack).map(trackId =>
              updateBarisWebbingMassal(trackId, (x) => (x.kode_kartu || x.no_spk) === r.kode && !x.kode_bagging, () => ({ kode_bagging: bagging.kode }))
            ));
            if (hasil.every(k => k === 0)) return { ok: false, pesan: `Kode "${r.kode}" gagal disimpan (mungkin sudah dipack sesi lain). Muat ulang halaman lalu coba lagi.` };
          }
          const patchBagging = { isi: arrayUnion(...rows.map(r => r.kode)) };
          if (!bagging.kode_spk) patchBagging.kode_spk = kodeSpkBaru;
          await updateDoc(doc(db, 'bagging', bagging.id), patchBagging);
          await muat();
          return { ok: true };
        } catch (e) { console.error('Gagal upload scan pack:', e); return { ok: false, pesan: 'Gagal menyimpan. Coba lagi.' }; }
      }
    });

    // Scan Kirim — sama pola dengan Scan Pack di atas. Step1 kunci Kode
    // Tugas, step2 kumpulkan kode bagging draft; Upload baru menulis
    // status/kode_tugas/tlc_tujuan semua baris terkait + tugas_kirim.pack
    // sekali jalan per kode bagging.
    const kirimTerpadu = buatScanTerpadu({
      judul: 'Scan Kirim — Acc Webbing', subjudul: 'Muat kode bagging ke satu tugas kirim',
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
        return { ok: true, row: { kode, label: anggota.length + ' komponen', qty: String(anggota.length), tagTxt: 'cocok', tagCls: 'ok' } };
      },
      padaUpload: async (rows, tugas) => {
        try {
          const now = new Date().toISOString();
          for (const r of rows) {
            const anggota = barisTertahan.value.filter(x => x.kode_bagging === r.kode);
            const byTrack = {};
            anggota.forEach(b => { (byTrack[b._trackId] ||= []).push(b); });
            await Promise.all(Object.keys(byTrack).map(trackId =>
              updateBarisWebbingMassal(trackId, (x) => x.kode_bagging === r.kode, () => ({
                status: 'sedang_dikirim', masuk_tahap_pada: now, kode_tugas: tugas.kode, tlc_tujuan: tugas.tlc_tujuan || ''
              }))
            ));
            // kode_spk/kode_batch ikut disalin ke pack[], dilepas oleh Scan Sampai
            // (sampai_pada).
            await updateDoc(doc(db, 'tugas_kirim', tugas.id), {
              pack: arrayUnion({ kode_bagging: r.kode, kode_spk: anggota[0]?.kode_spk || null, kode_batch: null, pada: now, sampai_pada: null })
            });
          }
          await muat();
          return { ok: true };
        } catch (e) { console.error('Gagal upload scan kirim:', e); return { ok: false, pesan: 'Gagal menyimpan. Coba lagi.' }; }
      }
    });

    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-webbing-tahap'); await window.authReady; await muat(); });

    return { muat,
      memuat, kelompokSepack, daftarTlc, bolehProses, bolehCetak, sedangProses,
      // sama seperti komponen "Perlu Disiapkan" di atas: barisKey dipakai
      // templat (key v-for) tapi lupa di-return.
      formatQty, formatDiamSejak, tertahan, barisKey,
      popupBagging, bukaCetakBagging, konfirmasiCetakBagging,
      popupTugas, bukaCetakTugas, konfirmasiCetakTugas, isiTlcAwal,
      popupCetakAktif, daftarLabelPreview, jenisCetakAktif,
      packTerpadu, kirimTerpadu,
      TAB_DEFS_WEBBING, gantiTabPill, MY_TARGET
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Acc Webbing</h3>
          <div class="sub">{{ kelompokSepack.length }} produk tertahan di Perlu Di Kirim</div>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_WEBBING" :key="t.target" type="button"
          :class="['sub-pp-webbing-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-webbing-tahap', t.target, $event)">
          <i :class="'fas ' + t.icon" style="margin-right:6px;"></i>{{ t.label }}
        </button>
      </div>

      <div v-if="bolehCetak" style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <button @click="bukaCetakBagging" class="btn-outline" style="flex:1; min-width:150px; padding:9px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Kode Bagging</button>
        <button @click="bukaCetakTugas" class="btn-outline" style="flex:1; min-width:150px; padding:9px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Kode Tugas</button>
      </div>
      <div v-if="bolehProses" style="display:flex; gap:8px; margin-bottom:12px;">
        <button @click="packTerpadu.buka" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Pack</button>
        <button @click="kirimTerpadu.buka" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Kirim</button>
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

    <scan-terpadu-generik :c="packTerpadu" />
    <scan-terpadu-generik :c="kirimTerpadu" />
  `
};


// TAB 4: Sedang Di Kirim — VIEW-ONLY, SAMA pola vue-persiapan-bahan.js.

const PersiapanWebbingSedangDikirim = {
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    async function muat() {
      memuat.value = true;
      try { daftarTrack.value = await muatSemuaTrackWebbing(); }
      catch (e) { console.error('Gagal muat Acc Webbing > Sedang Di Kirim:', e); daftarTrack.value = []; }
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
    const MY_TARGET = 'sub-pp-webbing-sedangdikirim';
    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-webbing-tahap'); await window.authReady; await muat(); });
    return { muat, memuat, kelompokTugas, formatQty, formatDiamSejak, barisKey, TAB_DEFS_WEBBING, gantiTabPill, MY_TARGET };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Acc Webbing</h3>
          <div class="sub">{{ kelompokTugas.length }} kode tugas sedang di jalan</div>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_WEBBING" :key="t.target" type="button"
          :class="['sub-pp-webbing-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-webbing-tahap', t.target, $event)">
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


// TAB 5: Selesai — baris pindah ke status 'selesai' saat DIVISI PENERIMA Scan
// Sampai, BUKAN saat pos ini Scan Kirim. Layar "Scan Sampai" di luar lingkup file
// ini, jadi tab ini hanya MEMBACA `status`/`sampai_pada` yang ditulis modul lain —
// selama modul itu belum ada tab ini kosong terus, dan itu bukan bug file ini.

const PersiapanWebbingSelesai = {
  setup() {
    const memuat = ref(true);
    const daftarTrack = ref([]);

    async function muat() {
      memuat.value = true;
      try { daftarTrack.value = await muatSemuaTrackWebbing(); }
      catch (e) { console.error('Gagal muat Acc Webbing > Selesai:', e); daftarTrack.value = []; }
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

    const MY_TARGET = 'sub-pp-webbing-selesai';
    onMounted(async () => { sembunyikanBarisTabAsli('sub-pp-webbing-tahap'); await window.authReady; await muat(); });

    return { muat,
      memuat, isOperatorSaja, barisSaya, daftarUrut, kpi,
      formatQty, formatRoll, formatWaktu, formatSiklus, siklusJam, keadaan, barisKey,
      TAB_DEFS_WEBBING, gantiTabPill, MY_TARGET
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

    <!--
      isOperatorSaja: versi "Riwayat Saya" TETAP tanpa gc-card-head/pill, sama alasan seperti
      vue-persiapan-bahan.js/vue-persiapan-sewing.js.
    -->
    <div v-else class="gc-card gc-card-menonjol" style="padding:20px; border-radius:20px;">
      <div class="gc-card-head">
        <div>
          <h3 class="gc-heading">Persiapan Acc Webbing</h3>
          <div class="sub">{{ kpi.selesai }} selesai hari ini</div>
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        <button v-for="t in TAB_DEFS_WEBBING" :key="t.target" type="button"
          :class="['sub-pp-webbing-tahap-btn','gc-sub-tab-btn', t.target===MY_TARGET ? 'active' : '']"
          :data-target="t.target" @click="gantiTabPill('sub-pp-webbing-tahap', t.target, $event)">
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
              <th style="padding:6px 8px;">Roll</th>
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
              <td style="padding:6px 8px;" class="gc-num">{{ formatRoll(b.roll) }}</td>
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
// window.pastikanMountPpWebbingXxx dipanggil oleh pindahSubTab (js/
// dashboard.js, peta `petaMount`) PERTAMA KALI tab itu dibuka.
let vmPpWebbingPerluDisiapkan = null;
window.pastikanMountPpWebbingPerluDisiapkan = function () {
  if (vmPpWebbingPerluDisiapkan) { if (typeof vmPpWebbingPerluDisiapkan.muat === 'function') vmPpWebbingPerluDisiapkan.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-webbing-perludisiapkan');
  if (mountPoint) vmPpWebbingPerluDisiapkan = createApp(PersiapanWebbingPerluDisiapkan).mount('#vue-pp-webbing-perludisiapkan');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js) — panggil varian
// toolbar global (kartuAktifTunjuk null), sama seperti klik tombol toolbar.
window.bukaScanOperatorWebbing = function () { if (vmPpWebbingPerluDisiapkan) vmPpWebbingPerluDisiapkan.bukaPenunjukanGlobal(); };
let vmPpWebbingSedangDisiapkan = null;
window.pastikanMountPpWebbingSedangDisiapkan = function () {
  if (vmPpWebbingSedangDisiapkan) { if (typeof vmPpWebbingSedangDisiapkan.muat === 'function') vmPpWebbingSedangDisiapkan.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-webbing-sedangdisiapkan');
  if (mountPoint) vmPpWebbingSedangDisiapkan = createApp(PersiapanWebbingSedangDisiapkan).mount('#vue-pp-webbing-sedangdisiapkan');
};
let vmPpWebbingPerluDikirim = null;
window.pastikanMountPpWebbingPerluDikirim = function () {
  if (vmPpWebbingPerluDikirim) { if (typeof vmPpWebbingPerluDikirim.muat === 'function') vmPpWebbingPerluDikirim.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-webbing-perludikirim');
  if (mountPoint) vmPpWebbingPerluDikirim = createApp(PersiapanWebbingPerluDikirim).mount('#vue-pp-webbing-perludikirim');
};
let vmPpWebbingSedangDikirim = null;
window.pastikanMountPpWebbingSedangDikirim = function () {
  if (vmPpWebbingSedangDikirim) { if (typeof vmPpWebbingSedangDikirim.muat === 'function') vmPpWebbingSedangDikirim.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-webbing-sedangdikirim');
  if (mountPoint) vmPpWebbingSedangDikirim = createApp(PersiapanWebbingSedangDikirim).mount('#vue-pp-webbing-sedangdikirim');
};
let vmPpWebbingSelesai = null;
window.pastikanMountPpWebbingSelesai = function () {
  if (vmPpWebbingSelesai) { if (typeof vmPpWebbingSelesai.muat === 'function') vmPpWebbingSelesai.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-webbing-selesai');
  if (mountPoint) vmPpWebbingSelesai = createApp(PersiapanWebbingSelesai).mount('#vue-pp-webbing-selesai');
};
