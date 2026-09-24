// js/vue-pp-cutting.js
// Proses Produksi > Cutting. Bahan dari Collection, tiga tahap operator (ampar →
// pola → cutting), cetak label komponen, lalu kirim balik ke Collection.
// Koleksi & field:
// - cutting_track: 1 dokumen per SPK Grouping. grouping_id, kode_grouping_induk,
//   sku_produk_terlibat[] (untuk cari BOM), op_ampar/op_pola/op_cutting,
//   komponen_rincian[], kode_bagging[], kode_tugas, sampai_pada,
//   masuk_tahap_pada (dasar ambang tertahan 6 jam). Status: perlu_diproses →
//   sedang_ampar/pola/cutting → perlu_dikirim → sedang_dikirim → selesai.
// - label_komponen: 1 per komponen per tumpukan, kode {kode_grouping}-{nn}
//   (GR26092301-1203-01). Jumlah = isi_pola_pcs x komponen.qty; amparan cuma
//   jumlah lapis. Semua wajib di-scan Cutting sebelum Cutting Selesai.
// - spk_track.bahan_rincian[].gelar_pada: label bahan di-scan saat digelar.
//
// Jebakan:
// - cutting_track dibuat LAZY & idempoten saat Tab 1.1 dibuka, TAPI ditolak
//   ditulis selama bahan grouping itu belum dikirim Collection
//   (spk_track.bahan_rincian[].kirim_cutting_pada).
// - Scan Sampai Tab 1.1 satu-satunya penulis bahan_rincian[].sampai_cutting_pada.
//   bahan_rincian[].sampai_pada milik Scan Sampai Collection, jangan disentuh.

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel } from './vue-components.js?v=13';
import { ScanGenerik, ScanTerpaduGenerik, buatScanTerpadu, PopupPinGenerik, buatQrDataUrl, ajukanPersiapanMasalah, ambilStatusUnpackBagging } from './vue-scan-cetak.js?v=12';
import { aksiAktif, pastikanCachePilihanScan } from './vue-popup-scan.js?v=7';

// Format & hitung kecil (disalin pola dari 4 pos Persiapan Produksi, belum
// dipindah ke helper generik — lihat catatan "belum ada infrastruktur util
// generik lintas file" di modul-modul itu).
function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
const AMBANG_TERTAHAN_JAM = 6; // keputusan, sama semua pos — lihat catatan §8 di atas
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
// picOwnerKeAtas — BEDA dari tierOwnerKeAtas di vue-scan-cetak.js (itu
// mewajibkan pic_owner SPESIFIK, bukan pic biasa). Di sini SEMUA pic (owner ATAU
// pic_owner) diizinkan, sesuai "PIC/PIC Owner/Owner only" — lihat keputusan §3
// di komentar besar atas file ini.
function picOwnerKeAtas(userData) {
  if (!userData) return false;
  const role = (userData.role || '').toLowerCase();
  return role === 'owner' || role === 'superuser' || role === 'pic';
}
// saringMilikOperator — operator hanya lihat baris yang ditugaskan ke dirinya
// (lewat Tunjuk Operator); role lain lihat semua baris. Gerbang TAMPILAN,
// terpisah dari picOwnerKeAtas yang cuma menggerbang tombol aksi. Tab per tahap
// pakai fieldTahap; tab gabungan pakai saringMilikOperatorSemuaTahap.
const FIELD_OPERATOR_TAHAP = ['op_ampar', 'op_pola', 'op_cutting'];
function milikUserIni(track, field) {
  return !!(track[field] && track[field].uid && track[field].uid === window.currentUser?.email);
}
function saringMilikOperator(barisList, fieldTahap) {
  if ((window.currentUser?.role || '').toLowerCase() !== 'operator') return barisList;
  return barisList.filter(t => milikUserIni(t, fieldTahap));
}
function saringMilikOperatorSemuaTahap(barisList) {
  if ((window.currentUser?.role || '').toLowerCase() !== 'operator') return barisList;
  return barisList.filter(t => FIELD_OPERATOR_TAHAP.some(f => milikUserIni(t, f)));
}

// Baca gabungan spk_grouping + cutting_track
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
// ambilSemuaBahanRincian / cocokkanBahanUntukGrouping — baris bahan dicocokkan
// ke grouping lewat grouping_id spk_track-nya (satu order bisa terpecah ke
// beberapa grouping, jadi id_order tidak cukup). id_order cuma cadangan baris
// yang track-nya tanpa grouping_id.
async function ambilSemuaBahanRincian() {
  const snapSpkTrack = await getDocs(query(collection(db, 'spk_track'), where('jalur', '==', 'bahan')));
  const semuaBahanRincian = [];
  snapSpkTrack.forEach(d => { const gid = d.data().grouping_id || ''; (d.data().bahan_rincian || []).forEach(b => semuaBahanRincian.push({ ...b, _grouping_id: gid })); });
  return semuaBahanRincian;
}
function cocokkanBahanUntukGrouping(grouping, semuaBahanRincian) {
  if (!grouping) return [];
  const noSpkSet = new Set((Array.isArray(grouping.breakdown) ? grouping.breakdown : []).map(b => b.id_order));
  return semuaBahanRincian.filter(b => b._grouping_id ? b._grouping_id === grouping.id : noSpkSet.has(b.id_order));
}
// sudahDikirimUntukGrouping — semua baris bahan grouping sudah di-Scan Kirim
// Collection ke Cutting (kirim_cutting_pada). Kuantor sama dengan sudahDikirim
// di enrichBahanUntukTrack: every + cocok.length>0.
function sudahDikirimUntukGrouping(grouping, semuaBahanRincian) {
  const cocok = cocokkanBahanUntukGrouping(grouping, semuaBahanRincian);
  return cocok.length > 0 && cocok.every(b => !!b.kirim_cutting_pada);
}
// pastikanCuttingTrackLengkap — buat cutting_track untuk grouping yang belum
// punya: LAZY, idempoten, dipanggil tiap Tab 1.1 dibuka. Syarat addDoc: grouping
// sudah sudahDikirimUntukGrouping (bahan dikirim dari Collection). Belum
// dikirim = tidak dibuatkan cutting_track sama sekali.
async function pastikanCuttingTrackLengkap() {
  const [groupingList, trackList, semuaBahanRincian] = await Promise.all([
    muatSemuaGrouping(), muatSemuaCuttingTrack(), ambilSemuaBahanRincian()
  ]);
  const sudahAda = new Set(trackList.map(t => t.grouping_id));
  const belum = groupingList.filter(g => !sudahAda.has(g.id));
  const siapDitulis = belum.filter(g => sudahDikirimUntukGrouping(g, semuaBahanRincian));
  if (siapDitulis.length) {
    const now = new Date().toISOString();
    await Promise.all(siapDitulis.map(g => addDoc(collection(db, 'cutting_track'), {
      grouping_id: g.id, kode_grouping_induk: g.kode_grouping_induk || '', nama_produk: g.nama_produk || '',
      size: g.size || '', qty_total: parseFloat(g.qty_total) || 0,
      sku_produk_terlibat: g.sku_produk_terlibat || [],
      status: 'perlu_diproses',
      op_ampar: null, op_pola: null, op_cutting: null,
      unpack_log: [], entry_ampar_done: 0,
      // riwayat_scan — dicatat ADITIF.
      riwayat_scan: [],
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
// updateBarisBahan di 4 pos lain), dipakai tiap tulis balik cutting_track.
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
// progresLabel — hitung live dari label_komponen (BUKAN cache), konsisten pola
// "dihitung live" seperti hitungPakaiPerMinggu di vue-pp-masalah.js.
function progresLabel(track, semuaLabel, field) {
  const punya = semuaLabel.filter(l => l.cutting_track_id === track.id);
  const total = (track.komponen_rincian || []).reduce((s, k) => s + (k.jumlah_label || 0), 0);
  const selesai = punya.filter(l => l[field] === 'selesai').length;
  return { done: selesai, total: total || punya.length };
}

// barisBahanGrouping — baris label bahan milik satu grouping, dibaca fresh dari
// spk_track jalur bahan. Dipakai Scan Entry Ampar (gelar_pada) dan kode label
// komponen (kode_grouping per bahan).
async function barisBahanGrouping(groupingId) {
  const snap = await getDocs(query(collection(db, 'spk_track'), where('grouping_id', '==', groupingId)));
  const hasil = [];
  snap.docs.filter(d => d.data().jalur === 'bahan').forEach(d => (d.data().bahan_rincian || []).forEach((b, idx) => hasil.push({ ...b, _trackId: d.id, _idx: idx })));
  return hasil;
}

// Popup Scan Masalah generik (jumlah kurang + alasan) — SAMA persis pola popup
// yang dipakai retrofit 4 pos Persiapan Produksi, dipakai ULANG DI SINI lewat 1
// mixin kecil per komponen (bukan file terpisah — cukup fungsi factory karena
// semua tab butuh bentuk sama).
function popupMasalahMixin(kirimFn) {
  const popupMasalah = ref(null); // { track, jumlah, alasan }
  function bukaMasalah(track) { popupMasalah.value = { track, jumlah: track.qty_total || 0, alasan: '', jenis: 'kurang' }; }
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
async function kirimMasalahCutting(track, jumlah, alasan, jenis) {
  await ajukanPersiapanMasalah({
    tlcAsal: 'TLC-PTG', sumberJalur: 'cutting',
    trackId: track.id, noSpk: track.kode_grouping_induk,
    bahanNama: track.nama_produk, bahanWarna: track.size, satuan: 'pcs',
    qtyKurang: jumlah, alasan, jenisMasalah: jenis || 'kurang', kodeLabelAsal: track.kode_grouping_induk || '',
    separatingId: '' || '', kodeSeparating: '' || '', idOrder: '' || ''
  });
  // riwayat_scan — dicatat ADITIF. Dipanggil dari SEMUA 6 tab
  // (popupMasalahMixin dipakai ulang tiap tab) — 1 titik saja cukup utk cover
  // semua Scan Masalah Cutting.
  try {
    await updateCuttingTrack(track.id, (data) => ({
      riwayat_scan: [...(data.riwayat_scan || []), { aksi: 'masalah', oleh: window.currentUser?.email || null, pada: new Date().toISOString(), catatan: alasan, qty: track.qty_total ?? null }]
    }));
  } catch (e) { console.error('Gagal catat riwayat_scan masalah:', e); }
}


// (audit wireframe vs live, sesi ini) — dua helper dipakai bersama Tab
// 1.1-1.4 untuk retrofit tabel-kolom-penuh + toolbar-global sesuai wireframe
// (Cutting/wireframe.dc.html), TANPA mengubah field/koleksi/logic scan yang
// sudah ada (ATURAN KERJA sesi ini eksplisit: cuma pindah posisi/tampilan).


// enrichBahanUntukTrack — join READ-ONLY spk_track(jalur:'bahan').bahan_rincian[]
// via spk_grouping.breakdown[].id_order untuk kolom SKU/pola/amparan/kbt kain Tab
// 1.1-1.4: angka pola dari baris cocok pertama, amparan+kain dijumlah, satuan 'M'.
// siapDiproses = semua baris sampai_cutting_pada; sudahDikirim = semua kirim_cutting_pada.
async function enrichBahanUntukTrack(daftarTrack, daftarGrouping) {
  const peta = {};
  try {
    // ambilSemuaBahanRincian/cocokkanBahanUntukGrouping — sama persis fungsi
    // yang dipakai pastikanCuttingTrackLengkap supaya logic pencocokan id_order
    // TIDAK dobel-ditulis di 2 tempat (rawan drift kalau salah satu diubah tapi
    // yang lain lupa).
    const semuaBahanRincian = await ambilSemuaBahanRincian();
    const petaGrouping = {};
    (daftarGrouping || []).forEach(g => { petaGrouping[g.id] = g; });
    daftarTrack.forEach(t => {
      const g = petaGrouping[t.grouping_id];
      const cocok = cocokkanBahanUntukGrouping(g, semuaBahanRincian);
      // cocok.length===0 -> peta[t.id] TETAP null (bukan {siapDiproses:true}) supaya
      // Tab 1.1-1.4 tetap fallback '-' pada kolom SKU/pola. Gerbang tampil Tab 1.1
      // membaca null ini sebagai "belum dikirim" lewat tampilDiProses; jangan diubah
      // jadi {sudahDikirim:false} di sini.
      if (!cocok.length) { peta[t.id] = null; return; }
      const rep = cocok[0];
      peta[t.id] = {
        skuBahan: [rep.bahan_nama, rep.bahan_warna].filter(Boolean).join(' ') || '-',
        panjangPola: rep.panjang_pola || 0,
        isiPola: rep.isi_pola_pcs || 0,
        amparan: cocok.reduce((s, b) => s + (parseFloat(b.amparan) || 0), 0),
        kebutuhanKain: cocok.reduce((s, b) => s + (parseFloat(b.kebutuhan_kain) || 0), 0),
        satuan: 'M',
        siapDiproses: cocok.every(b => !!b.sampai_cutting_pada),
        sudahDikirim: cocok.every(b => !!b.kirim_cutting_pada)
      };
    });
  } catch (e) { console.error('Gagal enrich data bahan utk tabel Cutting:', e); }
  return peta;
}

// pilihTargetMixin — popup "pilih baris dulu" untuk tombol toolbar global (Scan
// Unpack / Scan Operator Ampar/Pola/Cutting / Scan Entry) di tab 1.1-1.4. Beda
// dari Gudang: kode yang discan di Cutting (kode bagging masuk atau kode SPK)
// tidak selalu bisa dicari balik ke satu cutting_track, jadi target dipilih dulu.
function pilihTargetMixin(daftarRef) {
  const pilihTarget = ref(null); // { targetId, judul, lanjut(track) }
  function bukaPilihTarget(judul, lanjut) {
    if (!daftarRef.value.length) { alert('Tidak ada baris di tab ini untuk diproses.'); return; }
    pilihTarget.value = { targetId: daftarRef.value[0].id, judul, lanjut };
  }
  function batalPilihTarget() { pilihTarget.value = null; }
  function konfirmasiPilihTarget() {
    const p = pilihTarget.value;
    const track = daftarRef.value.find(t => t.id === p.targetId);
    pilihTarget.value = null;
    if (track) p.lanjut(track);
  }
  return { pilihTarget, bukaPilihTarget, batalPilihTarget, konfirmasiPilihTarget };
}
// Markup popup pilihTarget — dipakai literal (copy) di template tiap tab,
// konsisten dengan pola file ini yang memang mengulang markup popup kecil per
// tab (lihat popupMasalah di 5 tab lain), bukan komponen global baru.


// TAB 1.1: Perlu Di Proses

const CuttingPerluDiProses = {
  components: { ScanTerpaduGenerik, PopupPinGenerik },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const bahanEnrich = ref({}); // kolom tabel penuh wireframe, lihat enrichBahanUntukTrack
    // unpackEnrich — menutup badge "Unpack" yang kosong sejak Scan Unpack lama
    // berhenti menulis t.unpack_log. Kunci: t.kode_grouping_induk -> [{kode, unpack_hasil}].
    // Perlu dicari lewat 2 field (kode_grouping_induk aktif + kode_grouping_induk_asal historis), lihat
    // ambilStatusUnpackBagging di vue-scan-cetak.js.
    const unpackEnrich = ref({});
    const menuId = 'cut_cutting';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehOperator = computed(() => picOwnerKeAtas(window.currentUser));
    // siapBahan(t) — null/tidak ada entri bahan (jalur 'bahan' tidak aktif) dianggap
    // siap; ada entri tapi siapDiproses===false berarti masih menunggu Scan Sampai.
    // Dipakai setelah baris lolos tampilDiProses, jadi fallback `!info` praktis tidak
    // terpakai — dibiarkan sebagai jaga-jaga.
    function siapBahan(t) { const info = bahanEnrich.value[t.id]; return !info || info.siapDiproses !== false; }
    // tampilDiProses(t) — (null/tidak ada entri bahan -> DIANGGAP
    // BELUM dikirim jadi DISEMBUNYIKAN .
    function tampilDiProses(t) { const info = bahanEnrich.value[t.id]; return !!(info && info.sudahDikirim); }
    // daftarTampil — daftar SETELAH gerbang tampilDiProses; `daftar` mentah
    // (semua cutting_track status perlu_diproses, TERMASUK yang belum dikirim)
    // tetap dipertahankan buat referensi internal .
    const daftarTampil = computed(() => daftar.value.filter(tampilDiProses));

    async function muat() {
      memuat.value = true;
      try {
        const [semuaTrack, groupingList] = await Promise.all([pastikanCuttingTrackLengkap(), muatSemuaGrouping()]);
        daftar.value = saringMilikOperatorSemuaTahap(semuaTrack.filter(t => t.status === 'perlu_diproses'));
        bahanEnrich.value = await enrichBahanUntukTrack(daftar.value, groupingList);
        unpackEnrich.value = await ambilStatusUnpackBagging('kode_grouping_induk', 'kode_grouping_induk_asal', daftar.value.map(t => t.kode_grouping_induk));
      } catch (e) { console.error('Gagal muat Cutting > Perlu Di Proses:', e); daftar.value = []; }
      memuat.value = false;
    }

    // Scan Sampai — Kode Tugas lalu Kode Bagging berkali-kali. Terima bahan yang
    // dikirim Collection (kirim_cutting_pada) dengan menulis sampai_cutting_pada.
    // cariBarisSampai dipanggil ulang FRESH saat Upload supaya idx tidak basi.
    async function cariBarisSampai(kode) {
      const snapTrack = await getDocs(query(collection(db, 'spk_track'), where('jalur', '==', 'bahan')));
      const hasil = [];
      snapTrack.forEach(d => {
        const data = d.data();
        const baris = Array.isArray(data.bahan_rincian) ? data.bahan_rincian : [];
        const idx = baris.findIndex(b => b.kode_bagging === kode && b.kirim_cutting_pada && !b.sampai_cutting_pada);
        if (idx >= 0) hasil.push({ id: d.id, kodeSpk: data.kode_grouping_induk, baris, idx });
      });
      return hasil;
    }
    const sampaiTerpadu = buatScanTerpadu({
      judul: 'Scan Sampai — Cutting', subjudul: 'Terima kiriman bahan dari Collection',
      twoStep: {
        labelPertama: 'Kode Tugas', labelKedua: 'Kode Bagging',
        placeholderPertama: 'Scan QR Kode Tugas / cari kode (sekali di awal)',
        placeholderKedua: 'Scan QR bagging yang tiba / cari kode (bisa berkali-kali)',
        camModePertama: 'Mode: Scan Kode Tugas (sekali)', camModeKedua: 'Mode: Scan Kode Bagging (berkali-kali)',
        kosongUtama: 'Scan Kode Tugas dulu', kosongSub: '1x scan untuk membuka penerimaan tugas kirim ini.',
        validasi: async (kode) => {
          try {
            const snap = await getDocs(query(collection(db, 'tugas_kirim'), where('kode', '==', kode)));
            if (snap.empty) return { ok: false, pesan: `Kode tugas "${kode}" tidak ditemukan.` };
            return { ok: true, data: { id: snap.docs[0].id, ...snap.docs[0].data() } };
          } catch (e) { console.error('Gagal cari kode tugas:', e); return { ok: false, pesan: 'Gagal mencari kode tugas. Coba lagi.' }; }
        }
      },
      validasiIsi: async (kode) => {
        try {
          const cocok = await cariBarisSampai(kode);
          if (!cocok.length) return { ok: false, pesan: `Kode bagging "${kode}" belum dikirim dari Collection / sudah pernah di-Scan Sampai.` };
          return { ok: true, row: { kode, label: 'SPK ' + cocok.map(c => c.kodeSpk).join(', '), qty: cocok.length + ' baris', tagTxt: 'cocok', tagCls: 'ok' } };
        } catch (e) { console.error('Gagal cari baris sampai:', e); return { ok: false, pesan: 'Gagal mencari. Coba lagi.' }; }
      },
      padaUpload: async (rows, tugas) => {
        try {
          const now = new Date().toISOString();
          for (const row of rows) {
            const cocok = await cariBarisSampai(row.kode);
            for (const c of cocok) {
              const barisBaru = c.baris.slice();
              barisBaru[c.idx] = { ...barisBaru[c.idx], sampai_cutting_pada: now };
              await updateDoc(doc(db, 'spk_track', c.id), { bahan_rincian: barisBaru });
            }
            // pack[] tugas_kirim ditulis sampai_pada juga (melepas kaitan
            // root1/root2/bagging yang dicatat Scan Kirim) — dibaca ulang per
            // baris supaya tidak menimpa update baris lain di loop yang sama.
            const tugasSnap = await getDoc(doc(db, 'tugas_kirim', tugas.id));
            const packArr = Array.isArray(tugasSnap.data().pack) ? tugasSnap.data().pack : [];
            const idxPack = packArr.findIndex(p => p.kode_bagging === row.kode && !p.sampai_pada);
            if (idxPack >= 0) {
              const packBaru = packArr.slice();
              packBaru[idxPack] = { ...packBaru[idxPack], sampai_pada: now };
              await updateDoc(doc(db, 'tugas_kirim', tugas.id), { pack: packBaru });
            }
          }
          await muat();
          return { ok: true };
        } catch (e) { console.error('Gagal upload scan sampai:', e); return { ok: false, pesan: 'Gagal menyimpan. Coba lagi.' }; }
      }
    });

    // Scan Unpack — konversi ke buatScanTerpadu (Draft/Upload), gantikan
    // buatUnpackUniversal lama. Kunci Kode Bagging dulu (twoStep tahap 1), lalu
    // scan ulang tiap isi bagging berkali-kali; Upload cuma menutup KOMPLIT kalau
    // semua isi cocok tanpa kode asing. Belum lengkap -> pakai "Paksa INKOMPLIT"
    // di chip atas (baca s.rows langsung, di luar jalur padaUpload).
    async function tulisTutupUnpack(b, dicocokkan, asing, hilang, cocokSemua) {
      const now = new Date().toISOString();
      try {
        await updateDoc(doc(db, 'bagging', b.id), {
          kode_grouping_induk: null, kode_separating: null,
          kode_grouping_induk_asal: b.kode_grouping_induk ?? null, kode_separating_asal: b.kode_separating ?? null,
          unpack_hasil: cocokSemua ? 'komplit' : 'inkomplit',
          unpack_pada: now, unpack_oleh: window.currentUser?.email || null,
          unpack_dicocokkan: dicocokkan, unpack_asing: asing, unpack_hilang: hilang
        });
        await muat();
        return { ok: true };
      } catch (e) { console.error('Gagal menutup Scan Unpack:', e); return { ok: false, pesan: 'Gagal menyimpan. Coba lagi.' }; }
    }
    const unpackTerpadu = buatScanTerpadu({
      judul: 'Scan Unpack — Bagging', subjudul: 'Kunci kode bagging, lalu scan ulang tiap isinya',
      twoStep: {
        labelPertama: 'Kode Bagging', labelKedua: 'Isi Bagging',
        placeholderPertama: 'Scan/ketik kode bagging', placeholderKedua: 'Scan ulang tiap barang di dalam bagging',
        camModePertama: 'Mode: Scan Kode Bagging', camModeKedua: 'Mode: Scan Isi Bagging (berkali-kali)',
        kosongUtama: 'Scan Kode Bagging dulu', kosongSub: 'Sama seperti kode yang discan waktu Scan Pack.',
        validasi: async (kode) => {
          const snap = await getDocs(query(collection(db, 'bagging'), where('kode', '==', kode)));
          if (snap.empty) return { ok: false, pesan: `Kode bagging "${kode}" tidak ditemukan.` };
          return { ok: true, data: { id: snap.docs[0].id, ...snap.docs[0].data() } };
        }
      },
      validasiIsi: async (kode, locked) => {
        if (locked.unpack_hasil) return { ok: false, pesan: 'Bagging ini sudah ditutup (sudah di-Unpack sebelumnya) — tidak bisa discan ulang.' };
        const isi = Array.isArray(locked.isi) ? locked.isi : [];
        if (!isi.includes(kode)) return { ok: true, row: { kode, label: 'ASING — tidak ada di isi bagging saat Scan Pack', tagTxt: 'asing', tagCls: 'warn', asing: true } };
        return { ok: true, row: { kode, label: 'cocok', tagTxt: 'cocok', tagCls: 'ok', asing: false } };
      },
      padaUpload: async (rows, locked) => {
        const isi = Array.isArray(locked.isi) ? locked.isi : [];
        const dicocokkan = rows.filter(r => !r.asing).map(r => r.kode);
        const asingList = rows.filter(r => r.asing).map(r => r.kode);
        const hilang = isi.filter(k => !dicocokkan.includes(k));
        if (hilang.length || asingList.length) return { ok: false, pesan: `Belum lengkap: ${dicocokkan.length}/${isi.length} cocok` + (asingList.length ? `, ${asingList.length} asing` : '') + '. Scan sisanya, atau pakai "Paksa INKOMPLIT" di chip atas.' };
        return tulisTutupUnpack(locked, dicocokkan, asingList, hilang, true);
      },
      aksiEkstra: [{
        label: 'Paksa INKOMPLIT',
        aksi: async (locked) => {
          if (locked.unpack_hasil) { alert('Bagging ini sudah ditutup.'); return; }
          if (!confirm(`Tutup bagging "${locked.kode}" sebagai INKOMPLIT? Kode yang belum cocok akan dicatat hilang.`)) return;
          const isi = Array.isArray(locked.isi) ? locked.isi : [];
          const dicocokkan = unpackTerpadu.s.rows.filter(r => !r.asing).map(r => r.kode);
          const asingList = unpackTerpadu.s.rows.filter(r => r.asing).map(r => r.kode);
          const hilang = isi.filter(k => !dicocokkan.includes(k));
          const hasil = await tulisTutupUnpack(locked, dicocokkan, asingList, hilang, false);
          if (hasil.ok) unpackTerpadu.resetLock(); else alert(hasil.pesan);
        }
      }]
    });

    // Tunjuk Operator Ampar (PIN, role PIC/PIC Owner/Owner)
    const popupPinAmpar = ref(null); // track
    // Gerbang siapBahan mengunci TITIK MASUK pekerjaan fisik (Tunjuk Operator Ampar),
    // bukan Scan Sampai/Scan Unpack — keduanya justru aksi yang membuat baris jadi
    // siap, mengunci itu bikin buntu. Tab 1.2-1.4 tidak perlu cek ulang.
    function bukaTunjukAmpar(track) {
      if (!siapBahan(track)) { alert(`SPK ${track.kode_grouping_induk} masih menunggu bahan dari Collection (kode bagging belum di-Scan Sampai). Tunjuk Operator belum bisa dilakukan.`); return; }
      popupPinAmpar.value = track;
    }
    async function pinSuksesAmpar(user) {
      const track = popupPinAmpar.value;
      popupPinAmpar.value = null;
      try {
        await updateCuttingTrack(track.id, (data) => ({
          op_ampar: { uid: user.email, nama: user.nama || user.name || user.email, riwayat: [...((data.op_ampar && data.op_ampar.riwayat) || []), { uid: user.email, nama: user.nama || user.name || user.email, pada: new Date().toISOString() }] },
          status: 'sedang_ampar', masuk_tahap_pada: new Date().toISOString(),
          // riwayat_scan — dicatat ADITIF.
          riwayat_scan: [...(data.riwayat_scan || []), { aksi: 'operator', oleh: user.nama || user.name || user.email, pada: new Date().toISOString(), catatan: 'Tunjuk Operator Ampar', qty: track.qty_total ?? null }]
        }));
        await muat();
      } catch (e) { console.error('Gagal tunjuk operator ampar:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahCutting(p.track, p.jumlah, p.alasan, p.jenis);
      await muat();
    });

    // Toolbar global: Scan Operator Ampar sekali per tab (wireframe §1.1 "Action
    // bar"). Scan Unpack tidak butuh picker — target dari kode_bagging yang discan.
    // pilihTargetMixin pakai daftarTampil, bukan daftar mentah, supaya grouping yang
    // bahannya belum dikirim tidak bisa dipilih dari toolbar.
    const { pilihTarget, bukaPilihTarget, batalPilihTarget, konfirmasiPilihTarget } = pilihTargetMixin(daftarTampil);
    function bukaTunjukAmparToolbar() { bukaPilihTarget('Pilih SPK — Scan Operator Ampar', (track) => bukaTunjukAmpar(track)); }

    onMounted(async () => { await window.authReady; await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, daftar, daftarTampil, bahanEnrich, unpackEnrich, bolehProses, bolehOperator, aksiAktif, formatQty, formatDiamSejak, tertahan, siapBahan,
      sampaiTerpadu,
      unpackTerpadu,
      popupPinAmpar, pinSuksesAmpar,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah,
      pilihTarget, batalPilihTarget, konfirmasiPilihTarget, bukaTunjukAmparToolbar
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <!--
        Toolbar global — Scan Sampai + Scan Unpack + Scan Operator Ampar.
        Scan Masalah TETAP per-baris (butuh target jumlah/track spesifik).
      -->
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <button v-if="bolehProses && aksiAktif('sub-pr-cutting-perludiproses','cutting_sampai')" @click="sampaiTerpadu.buka" class="btn-primary" style="flex:1; min-width:160px; padding:9px;"><i class="fas fa-barcode" style="margin-right:6px;"></i>Scan Kode Tugas (Sampai)</button>
        <button v-if="bolehProses && aksiAktif('sub-pr-cutting-perludiproses','cutting_unpack')" @click="unpackTerpadu.buka" class="btn-outline" style="flex:1; min-width:130px; padding:9px;"><i class="fas fa-box-open" style="margin-right:6px;"></i>Scan Unpack</button>
        <button v-if="bolehOperator && aksiAktif('sub-pr-cutting-perludiproses','cutting_operator_ampar')" @click="bukaTunjukAmparToolbar" class="btn-outline" style="flex:1; min-width:160px; padding:9px;"><i class="fas fa-user-check" style="margin-right:6px;"></i>Scan Operator Ampar</button>
      </div>
      <!--
        daftarTampil (bukan daftar mentah) — grouping yang bahannya belum di-Scan Kirim
        disembunyikan, lihat tampilDiProses di setup. Pesan "kosong" di sini generik.
      -->
      <div v-if="daftarTampil.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-inbox"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada SPK Grouping yang perlu diproses</h3>
      </div>
      <div v-else class="gc-card" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px; white-space:nowrap;">
          <thead><tr style="text-align:left; border-bottom:1px solid var(--line);">
            <th style="padding:6px 8px;">Kode SPK</th><th style="padding:6px 8px;">Status Bahan</th><th style="padding:6px 8px;">SKU Produk</th><th style="padding:6px 8px;">SKU Bahan</th>
            <th style="padding:6px 8px;" class="gc-num">Qty</th><th style="padding:6px 8px;" class="gc-num">Pjg Pola</th>
            <th style="padding:6px 8px;" class="gc-num">Isi Pola</th><th style="padding:6px 8px;" class="gc-num">Amparan</th>
            <th style="padding:6px 8px;" class="gc-num">Kbt Kain</th><th style="padding:6px 8px;">Satuan</th>
            <th style="padding:6px 8px;">Unpack</th><th style="padding:6px 8px;">Diam Sejak</th><th style="padding:6px 8px;">Aksi</th>
          </tr></thead>
          <tbody>
            <tr v-for="t in daftarTampil" :key="t.id" style="border-bottom:1px solid var(--line);" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
              <td style="padding:6px 8px; font-weight:700;" class="gc-num">{{ t.kode_grouping_induk }}</td>
              <!-- Status Bahan: lihat siapBahan -->
              <td style="padding:6px 8px;"><span class="tag" :class="siapBahan(t) ? 'ok' : 'warn'">{{ siapBahan(t) ? 'Siap' : 'Menunggu Bahan' }}</span></td>
              <td style="padding:6px 8px;">{{ t.nama_produk }}<span v-if="t.size" style="color:var(--text-faint);"> ({{ t.size }})</span></td>
              <td style="padding:6px 8px; color:var(--text-faint);">{{ (bahanEnrich[t.id] && bahanEnrich[t.id].skuBahan) || '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatQty(t.qty_total) }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ bahanEnrich[t.id] ? formatQty(bahanEnrich[t.id].panjangPola) : '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ bahanEnrich[t.id] ? formatQty(bahanEnrich[t.id].isiPola) : '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ bahanEnrich[t.id] ? formatQty(bahanEnrich[t.id].amparan) : '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ bahanEnrich[t.id] ? formatQty(bahanEnrich[t.id].kebutuhanKain) : '-' }}</td>
              <td style="padding:6px 8px;">{{ bahanEnrich[t.id] ? bahanEnrich[t.id].satuan : '-' }}</td>
              <td style="padding:6px 8px;">
                <span v-if="!(unpackEnrich[t.kode_grouping_induk] || []).length" class="tag neutral">belum</span>
                <!-- Kartu Batch (design system): kode bagging + status Unpack, warna dot ikut unpack_hasil -->
                <div v-else style="display:flex; flex-wrap:wrap; gap:4px;">
                  <span v-for="(u,i) in unpackEnrich[t.kode_grouping_induk]" :key="i" class="gc-batch-card" :class="{ inkomplit: u.unpack_hasil !== 'komplit' }" style="display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:999px; background:var(--ivory-dim);" :title="u.unpack_hasil || 'belum di-unpack'">
                    <span class="tag-dot" :style="{ color: u.unpack_hasil==='komplit' ? 'var(--ok)' : (u.unpack_hasil==='inkomplit' ? 'var(--warn)' : 'var(--text-faint)') }"></span>{{ u.kode }}
                  </span>
                </div>
              </td>
              <td style="padding:6px 8px;"><span class="tag" :class="tertahan(t.masuk_tahap_pada) ? 'warn' : 'neutral'">{{ formatDiamSejak(t.masuk_tahap_pada) }}</span></td>
              <td style="padding:6px 8px;"><button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="padding:5px 9px; font-size:10.5px; color:var(--danger);" title="Scan Masalah"><i class="fas fa-triangle-exclamation"></i></button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <scan-terpadu-generik :c="sampaiTerpadu" />

    <scan-terpadu-generik :c="unpackTerpadu" />

    <popup-pin-generik v-if="popupPinAmpar" judul="Verifikasi PIN — Operator Ampar" konteks="Cutting - Scan Operator Ampar" :roles-diizinkan="['owner','superuser','pic_owner','pic']" @sukses="pinSuksesAmpar" @batal="popupPinAmpar = null" />

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.track.kode_grouping_induk }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jenis Masalah</label><select v-model="popupMasalah.jenis"><option value="kurang">Kurang</option><option value="cacat">Cacat</option><option value="hilang">Hilang</option></select></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. kain cacat, sobek, dst"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>

    <div v-if="pilihTarget" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">{{ pilihTarget.judul }}</h3>
        <div class="gc-field" style="margin-bottom:14px;"><label>Pilih SPK Grouping</label>
          <!--
            daftarTampil (BUKAN daftar) —, konsisten dgn pilihTargetMixin(daftarTampil) di setup.
          -->
          <select v-model="pilihTarget.targetId"><option v-for="t in daftarTampil" :key="t.id" :value="t.id">{{ t.kode_grouping_induk }} — {{ t.nama_produk }}</option></select>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="batalPilihTarget" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiPilihTarget" class="btn-primary" style="flex:1; padding:9px;">Lanjut</button>
        </div>
      </div>
    </div>
  `
};


// TAB 1.2: Sedang Ampar

const CuttingSedangAmpar = {
  components: { ScanGenerik, PopupPinGenerik },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const bahanEnrich = ref({});
    const menuId = 'cut_cutting';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehOperator = computed(() => picOwnerKeAtas(window.currentUser));

    async function muat() {
      memuat.value = true;
      try {
        const [semuaTrack, groupingList] = await Promise.all([muatSemuaCuttingTrack(), muatSemuaGrouping()]);
        daftar.value = saringMilikOperator(semuaTrack.filter(t => t.status === 'sedang_ampar'), 'op_ampar');
        bahanEnrich.value = await enrichBahanUntukTrack(daftar.value, groupingList);
      } catch (e) { console.error('Gagal muat Cutting > Sedang Ampar:', e); daftar.value = []; }
      memuat.value = false;
    }

    // Scan Entry Ampar: tiap label bahan (Kode Separating-Kode Grouping-bahan)
    // di-scan saat kainnya digelar. Wajib dari grouping yang sama, sudah sampai
    // di Cutting, dan belum pernah digelar. Menulis bahan_rincian[].gelar_pada.
    const modalEntry = reactive({ aktif: false, track: null });
    function bukaScanEntry(track) { modalEntry.track = track; modalEntry.aktif = true; }
    function tutupScanEntry() { modalEntry.aktif = false; modalEntry.track = null; muat(); }
    async function hasilScanEntry(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      const track = modalEntry.track;
      try {
        const baris = (await barisBahanGrouping(track.grouping_id)).find(b => b.kode_baris === kode);
        if (!baris) { alert(`"${kode}" bukan label bahan grouping ${track.kode_grouping_induk}.`); return; }
        if (!baris.sampai_cutting_pada) { alert(`${kode} belum di-Scan Sampai di Cutting.`); return; }
        if (baris.gelar_pada) { alert(`${kode} sudah digelar.`); return; }
        const now = new Date().toISOString();
        await runTransaction(db, async (trx) => {
          const ref = doc(db, 'spk_track', baris._trackId);
          const snap = await trx.get(ref);
          const arr = (snap.data().bahan_rincian || []).slice();
          arr[baris._idx] = { ...arr[baris._idx], gelar_pada: now, gelar_oleh: window.currentUser?.email || null };
          trx.update(ref, { bahan_rincian: arr, diperbarui_pada: serverTimestamp() });
        });
        await updateCuttingTrack(track.id, (data) => ({
          entry_ampar_done: (parseFloat(data.entry_ampar_done) || 0) + 1,
          riwayat_scan: [...(data.riwayat_scan || []), { aksi: 'entry', oleh: window.currentUser?.email || null, pada: now, catatan: 'Gelar ' + kode, qty: null }]
        }));
        track.entry_ampar_done = (parseFloat(track.entry_ampar_done) || 0) + 1;
      } catch (e) { console.error('Gagal scan entry ampar:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    // Tandai Ampar Selesai & Tunjuk Operator Pola (hitung komponen_rincian
    // dari BOM)
    const popupPinPola = ref(null);
    async function bukaTunjukPola(track) {
      const baris = await barisBahanGrouping(track.grouping_id);
      const belum = baris.filter(b => !b.gelar_pada).length;
      if (belum && !confirm(`${belum} label bahan grouping ini belum digelar (Scan Entry). Lanjut ke Sedang Pola?`)) return;
      popupPinPola.value = track;
    }
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
          status: 'sedang_pola', masuk_tahap_pada: new Date().toISOString(),
          // riwayat_scan — dicatat ADITIF.
          riwayat_scan: [...(data.riwayat_scan || []), { aksi: 'operator', oleh: user.nama || user.name || user.email, pada: new Date().toISOString(), catatan: 'Ampar Selesai & Tunjuk Operator Pola', qty: track.qty_total ?? null }]
        }));
        await muat();
      } catch (e) { console.error('Gagal tunjuk operator pola:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahCutting(p.track, p.jumlah, p.alasan, p.jenis);
      await muat();
    });

    // Toolbar global — Scan Entry & Tunjuk Operator Pola dipindah
    // dari tombol per-kartu jadi toolbar. Handler bukaScanEntry(track)/
    // bukaTunjukPola(track) TIDAK diubah.
    const { pilihTarget, bukaPilihTarget, batalPilihTarget, konfirmasiPilihTarget } = pilihTargetMixin(daftar);
    function bukaScanEntryToolbar() { bukaPilihTarget('Pilih SPK — Scan Entry Ampar', (track) => bukaScanEntry(track)); }
    function bukaTunjukPolaToolbar() { bukaPilihTarget('Pilih SPK — Ampar Selesai & Tunjuk Operator Pola', (track) => bukaTunjukPola(track)); }

    onMounted(async () => { await window.authReady; await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, daftar, bahanEnrich, bolehProses, bolehOperator, aksiAktif, formatQty, formatDiamSejak, tertahan,
      modalEntry, tutupScanEntry, hasilScanEntry,
      popupPinPola, pinSuksesPola,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah,
      pilihTarget, batalPilihTarget, konfirmasiPilihTarget, bukaScanEntryToolbar, bukaTunjukPolaToolbar
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <button v-if="bolehProses && aksiAktif('sub-pr-cutting-sedangampar','cutting_entry_ampar')" @click="bukaScanEntryToolbar" class="btn-primary" style="flex:1; min-width:130px; padding:9px;"><i class="fas fa-check" style="margin-right:6px;"></i>Scan Entry</button>
        <button v-if="bolehOperator && aksiAktif('sub-pr-cutting-sedangampar','cutting_operator_pola')" @click="bukaTunjukPolaToolbar" class="btn-outline" style="flex:1; min-width:200px; padding:9px;"><i class="fas fa-user-check" style="margin-right:6px;"></i>Ampar Selesai &amp; Tunjuk Operator Pola</button>
      </div>
      <div v-if="daftar.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-gears"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang sedang digelar (ampar)</h3>
      </div>
      <div v-else class="gc-card" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px; white-space:nowrap;">
          <thead><tr style="text-align:left; border-bottom:1px solid var(--line);">
            <th style="padding:6px 8px;">Kode SPK</th><th style="padding:6px 8px;">SKU Produk</th><th style="padding:6px 8px;">SKU Bahan</th>
            <th style="padding:6px 8px;" class="gc-num">Qty</th><th style="padding:6px 8px;" class="gc-num">Pjg Pola</th>
            <th style="padding:6px 8px;" class="gc-num">Isi Pola</th><th style="padding:6px 8px;" class="gc-num">Amparan</th>
            <th style="padding:6px 8px;" class="gc-num">Kbt Kain</th><th style="padding:6px 8px;" class="gc-num">Entry</th>
            <th style="padding:6px 8px;">Op. Ampar</th><th style="padding:6px 8px;">Diam Sejak</th><th style="padding:6px 8px;">Aksi</th>
          </tr></thead>
          <tbody>
            <tr v-for="t in daftar" :key="t.id" style="border-bottom:1px solid var(--line);" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
              <td style="padding:6px 8px; font-weight:700;" class="gc-num">{{ t.kode_grouping_induk }}</td>
              <td style="padding:6px 8px;">{{ t.nama_produk }}<span v-if="t.size" style="color:var(--text-faint);"> ({{ t.size }})</span></td>
              <td style="padding:6px 8px; color:var(--text-faint);">{{ (bahanEnrich[t.id] && bahanEnrich[t.id].skuBahan) || '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatQty(t.qty_total) }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ bahanEnrich[t.id] ? formatQty(bahanEnrich[t.id].panjangPola) : '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ bahanEnrich[t.id] ? formatQty(bahanEnrich[t.id].isiPola) : '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ bahanEnrich[t.id] ? formatQty(bahanEnrich[t.id].amparan) : '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ bahanEnrich[t.id] ? formatQty(bahanEnrich[t.id].kebutuhanKain) : '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ t.entry_ampar_done || 0 }}</td>
              <td style="padding:6px 8px;">{{ (t.op_ampar && t.op_ampar.nama) || '-' }}</td>
              <td style="padding:6px 8px;"><span class="tag" :class="tertahan(t.masuk_tahap_pada) ? 'warn' : 'neutral'">{{ formatDiamSejak(t.masuk_tahap_pada) }}</span></td>
              <td style="padding:6px 8px;"><button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="padding:5px 9px; font-size:10.5px; color:var(--danger);" title="Scan Masalah"><i class="fas fa-triangle-exclamation"></i></button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <scan-generik :aktif="modalEntry.aktif" :judul="modalEntry.track ? ('Scan Entry — ' + modalEntry.track.kode_grouping_induk) : 'Scan Entry'" subjudul="Scan label bahan tiap kali kainnya digelar. Satu label sekali." @hasil="hasilScanEntry" @tutup="tutupScanEntry" />
    <popup-pin-generik v-if="popupPinPola" judul="Verifikasi PIN — Operator Pola" konteks="Cutting - Scan Operator Pola" :roles-diizinkan="['owner','superuser','pic_owner','pic']" @sukses="pinSuksesPola" @batal="popupPinPola = null" />

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.track.kode_grouping_induk }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jenis Masalah</label><select v-model="popupMasalah.jenis"><option value="kurang">Kurang</option><option value="cacat">Cacat</option><option value="hilang">Hilang</option></select></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. kain cacat, sobek, dst"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>

    <div v-if="pilihTarget" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">{{ pilihTarget.judul }}</h3>
        <div class="gc-field" style="margin-bottom:14px;"><label>Pilih SPK Grouping</label>
          <select v-model="pilihTarget.targetId"><option v-for="t in daftar" :key="t.id" :value="t.id">{{ t.kode_grouping_induk }} — {{ t.nama_produk }}</option></select>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="batalPilihTarget" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiPilihTarget" class="btn-primary" style="flex:1; padding:9px;">Lanjut</button>
        </div>
      </div>
    </div>
  `
};


// TAB 1.3: Sedang Pola Cetak Label Komponen (4x2in thermal, lihat keputusan §4
// komentar besar atas file) + Scan Entry per label (menandai
// status_pola='selesai').

const CuttingSedangPola = {
  components: { ScanGenerik, PopupPinGenerik, PopupPratinjauCetakLabel },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const semuaLabel = ref([]);
    const bahanEnrich = ref({});
    const menuId = 'cut_cutting';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);
    const bolehOperator = computed(() => picOwnerKeAtas(window.currentUser));

    async function muat() {
      memuat.value = true;
      try {
        const [tracks, label, groupingList] = await Promise.all([muatSemuaCuttingTrack(), muatSemuaLabelKomponen(), muatSemuaGrouping()]);
        daftar.value = saringMilikOperator(tracks.filter(t => t.status === 'sedang_pola'), 'op_pola');
        semuaLabel.value = label;
        bahanEnrich.value = await enrichBahanUntukTrack(daftar.value, groupingList);
      } catch (e) { console.error('Gagal muat Cutting > Sedang Pola:', e); daftar.value = []; semuaLabel.value = []; }
      memuat.value = false;
    }
    function progres(t) { return progresLabel(t, semuaLabel.value, 'status_pola'); }

    // Cetak Label Komponen: N label per komponen belum dicetak
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    const sedangCetak = ref(false);
    async function cetakLabelKomponen(track) {
      const belum = (track.komponen_rincian || []).filter(k => !k.label_dicetak_pada);
      if (!belum.length) { alert('Semua komponen produk ini sudah pernah dicetak labelnya.'); return; }
      sedangCetak.value = true;
      try {
        const preview = [];
        const bahan = (await barisBahanGrouping(track.grouping_id))[0];
        const dasar = (bahan && bahan.kode_grouping) || track.kode_grouping_induk;
        let urut = semuaLabel.value.filter(l => l.cutting_track_id === track.id).length;
        for (const k of belum) {
          const n = Math.max(1, Math.round(k.jumlah_label || 0));
          for (let i = 0; i < n; i++) {
            urut++;
            const kode = `${dasar}-${String(urut).padStart(2, '0')}`;
            await addDoc(collection(db, 'label_komponen'), {
              kode, cutting_track_id: track.id, grouping_id: track.grouping_id || '', nama_komponen: k.nama_komponen,
              status_pola: 'belum', status_cutting: 'belum', pola_pada: null, cutting_pada: null,
              dibuat_pada: serverTimestamp()
            });
            preview.push({ kode, nama: k.nama_komponen, info: `${track.kode_grouping_induk} &middot; ${track.nama_produk} size ${track.size || '-'}`, qrDataUrl: buatQrDataUrl(kode) });
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

    // Scan Entry per label komponen (status_pola -> selesai)
    const modalEntry = reactive({ aktif: false, track: null, log: [] });
    function bukaScanEntry(track) { modalEntry.track = track; modalEntry.log = []; modalEntry.aktif = true; }
    function tutupScanEntry() { modalEntry.aktif = false; modalEntry.track = null; modalEntry.log = []; muat(); }
    async function hasilScanEntry(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      try {
        const snap = await getDocs(query(collection(db, 'label_komponen'), where('kode', '==', kode)));
        if (snap.empty) { alert(`Label "${kode}" tidak ditemukan.`); return; }
        const d = snap.docs[0];
        if (d.data().cutting_track_id !== modalEntry.track.id) { alert(`Label "${kode}" bukan milik SPK ${modalEntry.track.kode_grouping_induk}.`); return; }
        await updateDoc(doc(db, 'label_komponen', d.id), { status_pola: 'selesai', pola_pada: new Date().toISOString() });
        modalEntry.log.unshift(kode + ' -> pola selesai');
        semuaLabel.value = semuaLabel.value.map(l => l.id === d.id ? { ...l, status_pola: 'selesai' } : l);
        // riwayat_scan — dicatat ADITIF. Ditulis TERPISAH ke
        // cutting_track (bukan label_komponen) supaya riwayat tetap terkumpul di
        // 1 dokumen per SPK Grouping — kegagalan di sini TIDAK membatalkan
        // update status_pola di atas (sudah berhasil), cuma dicatat ke console.
        try {
          await updateCuttingTrack(modalEntry.track.id, (data) => ({
            riwayat_scan: [...(data.riwayat_scan || []), { aksi: 'entry', oleh: window.currentUser?.email || null, pada: new Date().toISOString(), catatan: `Entry Pola — komponen ${d.data().nama_komponen} (label ${kode})`, qty: null }]
          }));
        } catch (e2) { console.error('Gagal catat riwayat_scan entry pola:', e2); }
      } catch (e) { console.error('Gagal scan entry pola:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    // Tandai Pola Selesai & Tunjuk Operator Cutting
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
          status: 'sedang_cutting', masuk_tahap_pada: new Date().toISOString(),
          // riwayat_scan — dicatat ADITIF.
          riwayat_scan: [...(data.riwayat_scan || []), { aksi: 'operator', oleh: user.nama || user.name || user.email, pada: new Date().toISOString(), catatan: 'Pola Selesai & Tunjuk Operator Cutting', qty: track.qty_total ?? null }]
        }));
        await muat();
      } catch (e) { console.error('Gagal tunjuk operator cutting:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahCutting(p.track, p.jumlah, p.alasan, p.jenis);
      await muat();
    });

    // Toolbar global — Scan Entry & Tunjuk Operator Cutting jadi toolbar. "Cetak
    // Label Komponen" TETAP per-baris (wireframe §1.3: tombol di baris SPK, isinya
    // beda tiap baris).

    const { pilihTarget, bukaPilihTarget, batalPilihTarget, konfirmasiPilihTarget } = pilihTargetMixin(daftar);
    function bukaScanEntryToolbar() { bukaPilihTarget('Pilih SPK — Scan Entry Pola', (track) => bukaScanEntry(track)); }
    function bukaTunjukCuttingToolbar() { bukaPilihTarget('Pilih SPK — Pola Selesai & Tunjuk Operator Cutting', (track) => bukaTunjukCutting(track)); }

    onMounted(async () => { await window.authReady; await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, daftar, bahanEnrich, bolehProses, bolehCetak, bolehOperator, aksiAktif, sedangCetak, formatQty, formatDiamSejak, tertahan, progres,
      popupCetakAktif, daftarLabelPreview, cetakLabelKomponen,
      modalEntry, tutupScanEntry, hasilScanEntry,
      popupPinCutting, pinSuksesCutting,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah,
      pilihTarget, batalPilihTarget, konfirmasiPilihTarget, bukaScanEntryToolbar, bukaTunjukCuttingToolbar
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <button v-if="bolehProses && aksiAktif('sub-pr-cutting-sedangpola','cutting_entry_pola')" @click="bukaScanEntryToolbar" class="btn-primary" style="flex:1; min-width:130px; padding:9px;"><i class="fas fa-check" style="margin-right:6px;"></i>Scan Entry</button>
        <button v-if="bolehOperator && aksiAktif('sub-pr-cutting-sedangpola','cutting_operator_cutting')" @click="bukaTunjukCuttingToolbar" class="btn-outline" style="flex:1; min-width:220px; padding:9px;"><i class="fas fa-user-check" style="margin-right:6px;"></i>Pola Selesai &amp; Tunjuk Operator Cutting</button>
      </div>
      <div v-if="daftar.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-shapes"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang sedang digambar pola</h3>
      </div>
      <div v-else class="gc-card" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px; white-space:nowrap;">
          <thead><tr style="text-align:left; border-bottom:1px solid var(--line);">
            <th style="padding:6px 8px;">Kode SPK</th><th style="padding:6px 8px;">SKU Produk</th><th style="padding:6px 8px;">SKU Bahan</th>
            <th style="padding:6px 8px;" class="gc-num">Qty</th><th style="padding:6px 8px;" class="gc-num">Isi Pola</th>
            <th style="padding:6px 8px;" class="gc-num">Kbt Kain</th><th style="padding:6px 8px;">Progress Komponen</th>
            <th style="padding:6px 8px;">Op. Ampar</th><th style="padding:6px 8px;">Op. Pola</th><th style="padding:6px 8px;">Cetak</th>
            <th style="padding:6px 8px;">Diam Sejak</th><th style="padding:6px 8px;">Aksi</th>
          </tr></thead>
          <tbody>
            <tr v-for="t in daftar" :key="t.id" style="border-bottom:1px solid var(--line);" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
              <td style="padding:6px 8px; font-weight:700;" class="gc-num">{{ t.kode_grouping_induk }}</td>
              <td style="padding:6px 8px;">{{ t.nama_produk }}<span v-if="t.size" style="color:var(--text-faint);"> ({{ t.size }})</span></td>
              <td style="padding:6px 8px; color:var(--text-faint);">{{ (bahanEnrich[t.id] && bahanEnrich[t.id].skuBahan) || '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatQty(t.qty_total) }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ bahanEnrich[t.id] ? formatQty(bahanEnrich[t.id].isiPola) : '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ bahanEnrich[t.id] ? formatQty(bahanEnrich[t.id].kebutuhanKain) : '-' }}</td>
              <td style="padding:6px 8px;">
                <div v-if="(t.komponen_rincian||[]).length">{{ progres(t).done }} / {{ progres(t).total }}</div>
                <div v-else style="color:var(--warn); font-size:10px;">BOM kosong</div>
              </td>
              <td style="padding:6px 8px;">{{ (t.op_ampar && t.op_ampar.nama) || '-' }}</td>
              <td style="padding:6px 8px;">{{ (t.op_pola && t.op_pola.nama) || '-' }}</td>
              <td style="padding:6px 8px;">
                <button v-if="bolehCetak" @click="cetakLabelKomponen(t)" :disabled="sedangCetak" class="btn-outline" style="padding:4px 8px; font-size:10px;"><i class="fas fa-print"></i></button>
              </td>
              <td style="padding:6px 8px;"><span class="tag" :class="tertahan(t.masuk_tahap_pada) ? 'warn' : 'neutral'">{{ formatDiamSejak(t.masuk_tahap_pada) }}</span></td>
              <td style="padding:6px 8px;"><button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="padding:5px 9px; font-size:10.5px; color:var(--danger);" title="Scan Masalah"><i class="fas fa-triangle-exclamation"></i></button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Label Komponen" :daftar-label="daftarLabelPreview" jenis-cetak="label_komponen_cutting" @tutup="popupCetakAktif = false" />
    <scan-generik :aktif="modalEntry.aktif" :judul="modalEntry.track ? ('Scan Entry Pola — ' + modalEntry.track.kode_grouping_induk) : 'Scan Entry Pola'" subjudul="Scan tiap label komponen yang sudah selesai digambar polanya." @hasil="hasilScanEntry" @tutup="tutupScanEntry" />
    <div v-if="modalEntry.aktif && modalEntry.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:260px;">
      <div v-for="(l,i) in modalEntry.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>
    <popup-pin-generik v-if="popupPinCutting" judul="Verifikasi PIN — Operator Cutting" konteks="Cutting - Scan Operator Cutting" :roles-diizinkan="['owner','superuser','pic_owner','pic']" @sukses="pinSuksesCutting" @batal="popupPinCutting = null" />

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.track.kode_grouping_induk }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jenis Masalah</label><select v-model="popupMasalah.jenis"><option value="kurang">Kurang</option><option value="cacat">Cacat</option><option value="hilang">Hilang</option></select></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. kain cacat, sobek, dst"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>

    <div v-if="pilihTarget" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">{{ pilihTarget.judul }}</h3>
        <div class="gc-field" style="margin-bottom:14px;"><label>Pilih SPK Grouping</label>
          <select v-model="pilihTarget.targetId"><option v-for="t in daftar" :key="t.id" :value="t.id">{{ t.kode_grouping_induk }} — {{ t.nama_produk }}</option></select>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="batalPilihTarget" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiPilihTarget" class="btn-primary" style="flex:1; padding:9px;">Lanjut</button>
        </div>
      </div>
    </div>
  `
};


// TAB 1.4: Sedang Cutting

const CuttingSedangCutting = {
  components: { ScanGenerik },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const semuaLabel = ref([]);
    const bahanEnrich = ref({});
    const menuId = 'cut_cutting';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const [tracks, label, groupingList] = await Promise.all([muatSemuaCuttingTrack(), muatSemuaLabelKomponen(), muatSemuaGrouping()]);
        daftar.value = saringMilikOperator(tracks.filter(t => t.status === 'sedang_cutting'), 'op_cutting');
        semuaLabel.value = label;
        bahanEnrich.value = await enrichBahanUntukTrack(daftar.value, groupingList);
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
        if (d.data().cutting_track_id !== modalEntry.track.id) { alert(`Label "${kode}" bukan milik SPK ${modalEntry.track.kode_grouping_induk}.`); return; }
        await updateDoc(doc(db, 'label_komponen', d.id), { status_cutting: 'selesai', cutting_pada: new Date().toISOString() });
        modalEntry.log.unshift(kode + ' -> cutting selesai');
        semuaLabel.value = semuaLabel.value.map(l => l.id === d.id ? { ...l, status_cutting: 'selesai' } : l);
        // riwayat_scan — dicatat ADITIF. Ditulis TERPISAH ke
        // cutting_track (bukan label_komponen), sama pola dgn Tab 1.3 —
        // kegagalan di sini TIDAK membatalkan update status_cutting di atas.
        try {
          await updateCuttingTrack(modalEntry.track.id, (data) => ({
            riwayat_scan: [...(data.riwayat_scan || []), { aksi: 'entry', oleh: window.currentUser?.email || null, pada: new Date().toISOString(), catatan: `Entry Cutting — komponen ${d.data().nama_komponen} (label ${kode})`, qty: null }]
          }));
        } catch (e2) { console.error('Gagal catat riwayat_scan entry cutting:', e2); }
      } catch (e) { console.error('Gagal scan entry cutting:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    async function tandaiSelesaiCutting(track) {
      const p = progres(track);
      if (p.total > 0 && p.done < p.total) { alert(`Baru ${p.done}/${p.total} label komponen ter-scan. Semua label wajib di-scan sebelum kirim ke Collection.`); return; }
      try {
        await updateCuttingTrack(track.id, () => ({ status: 'perlu_dikirim', masuk_tahap_pada: new Date().toISOString() }));
        await muat();
      } catch (e) { console.error('Gagal tandai cutting selesai:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahCutting(p.track, p.jumlah, p.alasan, p.jenis);
      await muat();
    });

    // Toolbar global — Scan Entry jadi toolbar. "Cutting Selesai" TETAP per-baris
    // (aksi penyelesaian 1 SPK tertentu, sama pola dengan "Cetak Label Komponen"
    // di Tab 1.3).
    const { pilihTarget, bukaPilihTarget, batalPilihTarget, konfirmasiPilihTarget } = pilihTargetMixin(daftar);
    function bukaScanEntryToolbar() { bukaPilihTarget('Pilih SPK — Scan Entry Cutting', (track) => bukaScanEntry(track)); }

    onMounted(async () => { await window.authReady; await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, daftar, bahanEnrich, bolehProses, aksiAktif, formatQty, formatDiamSejak, tertahan, progres,
      modalEntry, tutupScanEntry, hasilScanEntry, tandaiSelesaiCutting,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah,
      pilihTarget, batalPilihTarget, konfirmasiPilihTarget, bukaScanEntryToolbar
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <button v-if="bolehProses && aksiAktif('sub-pr-cutting-sedangcutting','cutting_entry_cutting')" @click="bukaScanEntryToolbar" class="btn-primary" style="flex:1; min-width:130px; padding:9px;"><i class="fas fa-check" style="margin-right:6px;"></i>Scan Entry</button>
      </div>
      <div v-if="daftar.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-scissors"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang sedang dipotong</h3>
      </div>
      <div v-else class="gc-card" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px; white-space:nowrap;">
          <thead><tr style="text-align:left; border-bottom:1px solid var(--line);">
            <th style="padding:6px 8px;">Kode SPK</th><th style="padding:6px 8px;">SKU Produk</th><th style="padding:6px 8px;">SKU Bahan</th>
            <th style="padding:6px 8px;" class="gc-num">Qty</th><th style="padding:6px 8px;" class="gc-num">Kbt Kain</th>
            <th style="padding:6px 8px;">Progress Komponen</th><th style="padding:6px 8px;">Op. Ampar</th>
            <th style="padding:6px 8px;">Op. Pola</th><th style="padding:6px 8px;">Op. Cutting</th>
            <th style="padding:6px 8px;">Diam Sejak</th><th style="padding:6px 8px;">Aksi</th>
          </tr></thead>
          <tbody>
            <tr v-for="t in daftar" :key="t.id" style="border-bottom:1px solid var(--line);" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
              <td style="padding:6px 8px; font-weight:700;" class="gc-num">{{ t.kode_grouping_induk }}</td>
              <td style="padding:6px 8px;">{{ t.nama_produk }}<span v-if="t.size" style="color:var(--text-faint);"> ({{ t.size }})</span></td>
              <td style="padding:6px 8px; color:var(--text-faint);">{{ (bahanEnrich[t.id] && bahanEnrich[t.id].skuBahan) || '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatQty(t.qty_total) }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ bahanEnrich[t.id] ? formatQty(bahanEnrich[t.id].kebutuhanKain) : '-' }}</td>
              <td style="padding:6px 8px;">{{ progres(t).done }} / {{ progres(t).total }}</td>
              <td style="padding:6px 8px;">{{ (t.op_ampar && t.op_ampar.nama) || '-' }}</td>
              <td style="padding:6px 8px;">{{ (t.op_pola && t.op_pola.nama) || '-' }}</td>
              <td style="padding:6px 8px;">{{ (t.op_cutting && t.op_cutting.nama) || '-' }}</td>
              <td style="padding:6px 8px;"><span class="tag" :class="tertahan(t.masuk_tahap_pada) ? 'warn' : 'neutral'">{{ formatDiamSejak(t.masuk_tahap_pada) }}</span></td>
              <td style="padding:6px 8px;">
                <div style="display:flex; gap:4px;">
                  <button v-if="bolehProses" @click="tandaiSelesaiCutting(t)" class="btn-outline" style="padding:4px 8px; font-size:10px;" title="Cutting Selesai"><i class="fas fa-circle-check"></i></button>
                  <button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="padding:4px 8px; font-size:10px; color:var(--danger);" title="Scan Masalah"><i class="fas fa-triangle-exclamation"></i></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <scan-generik :aktif="modalEntry.aktif" :judul="modalEntry.track ? ('Scan Entry Cutting — ' + modalEntry.track.kode_grouping_induk) : 'Scan Entry Cutting'" subjudul="Scan tiap label komponen yang sudah selesai dipotong." @hasil="hasilScanEntry" @tutup="tutupScanEntry" />
    <div v-if="modalEntry.aktif && modalEntry.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:260px;">
      <div v-for="(l,i) in modalEntry.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.track.kode_grouping_induk }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jenis Masalah</label><select v-model="popupMasalah.jenis"><option value="kurang">Kurang</option><option value="cacat">Cacat</option><option value="hilang">Hilang</option></select></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. kain cacat, sobek, dst"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>

    <div v-if="pilihTarget" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">{{ pilihTarget.judul }}</h3>
        <div class="gc-field" style="margin-bottom:14px;"><label>Pilih SPK Grouping</label>
          <select v-model="pilihTarget.targetId"><option v-for="t in daftar" :key="t.id" :value="t.id">{{ t.kode_grouping_induk }} — {{ t.nama_produk }}</option></select>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="batalPilihTarget" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiPilihTarget" class="btn-primary" style="flex:1; padding:9px;">Lanjut</button>
        </div>
      </div>
    </div>
  `
};


// TAB 1.5: Perlu Di Kirim — satu kartu satu SPK Grouping (beda dari Bahan yang
// satu kartu satu bahan+warna), jadi cukup daftar cutting_track langsung tanpa
// kelompokSepack. Cetak Surat Jalan + Kode Bagging digabung 1 aksi; dropdown
// tujuan pakai master_tlc, isi TLC dikelola di Zevanic House > TLC & Prefix.

const CuttingPerluDiKirim = {
  components: { PopupPratinjauCetakLabel, ScanTerpaduGenerik },
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
        daftar.value = saringMilikOperatorSemuaTahap(tracks.filter(t => t.status === 'perlu_dikirim'));
        daftarBaggingAktif.value = baggingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        daftarTlc.value = tlcSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) { console.error('Gagal muat Cutting > Perlu Di Kirim:', e); daftar.value = []; daftarBaggingAktif.value = []; daftarTlc.value = []; }
      memuat.value = false;
    }

    // Cetak Surat Jalan + Kode Bagging (1 aksi, bundle per jenis komponen)

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
            kode, produk_label: `${track.kode_grouping_induk} &middot; ${jenis}`, isi: [], ditutup_pada: null,
            kode_grouping_induk: track.kode_grouping_induk || null, kode_separating: null,
            dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
          });
          kodeBaggingBaru.push(kode);
          preview.push({ kode, nama: jenis, info: `Kode Bagging &middot; ${track.kode_grouping_induk}`, qrDataUrl: buatQrDataUrl(kode) });
        }
        const kodeTugas = await generateKodeHarian('TGS', 'pengaturan_id_tugas_kirim');
        // pack[] diisi LANGSUNG di sini (bukan lewat Scan Kirim terpisah seperti
        // 4 titik Persiapan) — 1 entri per kode bagging yang baru dicetak,
        // supaya Scan Sampai di Serie (hasilScanSampai grouping, cabang
        // cutting_track) bisa melepasnya, konsisten dgn titik lain.
        const nowKirim = new Date().toISOString();
        await addDoc(collection(db, 'tugas_kirim'), {
          kode: kodeTugas, tlc_asal: 'TLC-PTG', tlc_tujuan: p.tlcTujuan,
          pack: kodeBaggingBaru.map(kb => ({ kode_bagging: kb, kode_grouping_induk: track.kode_grouping_induk || null, kode_separating: null, pada: nowKirim, sampai_pada: null })),
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

    // Scan Pack — PILOT revisi ScanGenerik (lihat KEPUTUSAN.md > Scan & Cetak):
    // kamera tersemat + Draft->Upload, ganti overlay+tulis-langsung lama.
    // Step 1 kunci Kode Bagging (existing & belum ditutup), step 2 kumpulkan
    // Kode Label Komponen sebagai draft; Upload baru menulis isi[] + riwayat_scan
    // sekali jalan. label_komponen HANYA ada sejak dicetak (lihat
    // cetakLabelKomponen di atas) jadi "kode ditemukan" = "sudah dicetak" — tidak
    // perlu field cetak_pada terpisah untuk gerbang cetak_ok/cetak_no.
    const packTerpadu = buatScanTerpadu({
      judul: 'Scan Pack — Cutting', subjudul: 'Kaitkan label komponen ke satu kode bagging', gated: true,
      twoStep: {
        labelPertama: 'Kode Bagging', labelKedua: 'Kode Label Komponen',
        placeholderPertama: 'Scan QR Bagging / cari kode (sekali di awal)',
        placeholderKedua: 'Scan QR label komponen / cari kode (bisa berkali-kali)',
        camModePertama: 'Mode: Scan Kode Bagging (sekali)', camModeKedua: 'Mode: Scan Label Komponen (berkali-kali)',
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
      validasiIsi: async (kode) => {
        try {
          const snap = await getDocs(query(collection(db, 'label_komponen'), where('kode', '==', kode)));
          if (snap.empty) return { ok: false, pesan: `Kode "${kode}" bukan label komponen yang dikenali.` };
          const d = snap.docs[0];
          return { ok: true, row: { kode, label: d.data().nama_komponen || '-', qty: '1', tagTxt: 'sudah dicetak', tagCls: 'ok', _cuttingTrackId: d.data().cutting_track_id || null } };
        } catch (e) { console.error('Gagal cari label komponen (pack):', e); return { ok: false, pesan: 'Gagal mencari. Coba lagi.' }; }
      },
      padaUpload: async (rows, bagging) => {
        try {
          await updateDoc(doc(db, 'bagging', bagging.id), { isi: arrayUnion(...rows.map(r => r.kode)) });
          // riwayat_scan ADITIF, digrup per cutting_track supaya 1 track cuma
          // kena 1x update walau beberapa labelnya discan dalam draft yang sama.
          const perTrack = {};
          rows.forEach(r => { if (r._cuttingTrackId) (perTrack[r._cuttingTrackId] = perTrack[r._cuttingTrackId] || []).push(r.kode); });
          for (const [trackId, kodeList] of Object.entries(perTrack)) {
            await updateCuttingTrack(trackId, (data) => ({
              riwayat_scan: [...(data.riwayat_scan || []), ...kodeList.map(k => ({ aksi: 'pack', oleh: window.currentUser?.email || null, pada: new Date().toISOString(), catatan: `Label ${k} -> bagging ${bagging.kode}`, qty: null }))]
            }));
          }
          await muat();
          return { ok: true };
        } catch (e) { console.error('Gagal upload scan pack:', e); return { ok: false, pesan: 'Gagal menyimpan. Coba lagi.' }; }
      }
    });

    // Scan Kirim — PILOT #2, sama pola dengan Scan Pack di atas. Step 1 kunci
    // Kode Tugas (+ track yang punya kode_tugas itu), step 2 kumpulkan Kode
    // Bagging draft (harus ada di track.kode_bagging); Upload baru menulis
    // tugas_kirim.pack + status/riwayat_scan cutting_track sekali jalan.
    const kirimTerpadu = buatScanTerpadu({
      judul: 'Scan Kirim — Cutting', subjudul: 'Muat kode bagging ke satu tugas kirim', gated: true,
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
            const tugas = { id: snap.docs[0].id, ...snap.docs[0].data() };
            const track = daftar.value.find(t => t.kode_tugas === tugas.kode);
            if (!track) return { ok: false, pesan: `Kode tugas "${kode}" tidak terhubung ke SPK manapun yang masih Perlu Di Kirim.` };
            return { ok: true, data: { tugas, track } };
          } catch (e) { console.error('Gagal cari kode tugas:', e); return { ok: false, pesan: 'Gagal mencari kode tugas. Coba lagi.' }; }
        }
      },
      validasiIsi: async (kode, locked) => {
        if (!(locked.track.kode_bagging || []).includes(kode)) return { ok: false, pesan: `Kode bagging "${kode}" tidak cocok dengan tugas ini.` };
        return { ok: true, row: { kode, label: 'Bagging -> ' + locked.track.kode_grouping_induk, qty: '1', tagTxt: 'cocok', tagCls: 'ok' } };
      },
      padaUpload: async (rows, locked) => {
        try {
          const { tugas, track } = locked;
          await updateDoc(doc(db, 'tugas_kirim', tugas.id), { pack: arrayUnion(...rows.map(r => ({ kode_bagging: r.kode, pada: new Date().toISOString() }))) });
          const tugasSnap = await getDoc(doc(db, 'tugas_kirim', tugas.id));
          const semuaSudah = (track.kode_bagging || []).every(kb => (tugasSnap.data().pack || []).some(p => p.kode_bagging === kb));
          const now = new Date().toISOString();
          // riwayat_scan ADITIF, digabung 1 transaksi dengan transisi status
          // supaya cutting_track cuma kena 1x update walau banyak baris draft.
          await updateCuttingTrack(track.id, (data) => ({
            ...(semuaSudah ? { status: 'sedang_dikirim', masuk_tahap_pada: now, tlc_tujuan: tugas.tlc_tujuan || '' } : {}),
            riwayat_scan: [...(data.riwayat_scan || []), ...rows.map(r => ({ aksi: 'kirim', oleh: window.currentUser?.email || null, pada: now, catatan: `Bagging ${r.kode} -> tugas ${tugas.kode} (tujuan ${tugas.tlc_tujuan || '-'})`, qty: track.qty_total ?? null }))]
          }));
          await muat();
          return { ok: true };
        } catch (e) { console.error('Gagal upload scan kirim:', e); return { ok: false, pesan: 'Gagal menyimpan. Coba lagi.' }; }
      }
    });

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahCutting(p.track, p.jumlah, p.alasan, p.jenis);
      await muat();
    });

    onMounted(async () => { await window.authReady; await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, daftar, daftarTlc, bolehProses, bolehCetak, aksiAktif, sedangProses, formatQty, formatDiamSejak, tertahan,
      popupKirim, bukaCetakKirim, konfirmasiCetakKirim, popupCetakAktif, daftarLabelPreview,
      packTerpadu, kirimTerpadu,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div v-if="bolehProses" style="display:flex; gap:8px; margin-bottom:12px;">
        <button v-if="aksiAktif('sub-pr-cutting-perludikirim','cutting_pack')" @click="packTerpadu.buka" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Pack</button>
        <button v-if="aksiAktif('sub-pr-cutting-perludikirim','cutting_kirim')" @click="kirimTerpadu.buka" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Kirim</button>
      </div>
      <div v-if="daftar.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-box-open"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang tertahan di Perlu Di Kirim</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="t in daftar" :key="t.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ t.kode_grouping_induk }}</div>
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

    <!-- jenis-cetak dipatok 'kode_bagging' walau baris terakhir preview "Surat Jalan
      (Kode Tugas)": 1x cetak mencampur item bagging+tugas dalam 1 job fisik yang sama,
      jadi tidak bisa 2 ukuran berbeda — butuh redesain jadi 2x cetak terpisah. -->
    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Surat Jalan + Kode Bagging" :daftar-label="daftarLabelPreview" jenis-cetak="kode_bagging" @tutup="popupCetakAktif = false" />

    <div v-if="popupKirim" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Cetak Surat Jalan — {{ popupKirim.track.kode_grouping_induk }}</h3>
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

    <scan-terpadu-generik :c="packTerpadu" />
    <scan-terpadu-generik :c="kirimTerpadu" />

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.track.kode_grouping_induk }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jenis Masalah</label><select v-model="popupMasalah.jenis"><option value="kurang">Kurang</option><option value="cacat">Cacat</option><option value="hilang">Hilang</option></select></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. kain cacat, sobek, dst"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};


// TAB 1.6: Sedang Di Kirim Tracking read-only . BEDA dari pos Bahan (yang
// benar-benar tanpa tombol apapun di tab "Sedang Dikirim"-nya): Cutting §8 butir
// 3 eksplisit minta Scan Masalah ada di SEMUA tab "Sedang" TERMASUK tab ini —
// jadi 1 tombol Scan Masalah tetap ada, sisanya murni papan info.

const CuttingSedangDiKirim = {
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const menuId = 'cut_cutting';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try { daftar.value = saringMilikOperatorSemuaTahap((await muatSemuaCuttingTrack()).filter(t => t.status === 'sedang_dikirim')); }
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
      await kirimMasalahCutting(p.track, p.jumlah, p.alasan, p.jenis);
      await muat();
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return { muat, memuat, kelompokTugas, bolehProses, formatQty, formatDiamSejak, tertahan, popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah };
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
              <span class="gc-num" style="font-weight:700;">{{ t.kode_grouping_induk }}</span>
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
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.track.kode_grouping_induk }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jenis Masalah</label><select v-model="popupMasalah.jenis"><option value="kurang">Kurang</option><option value="cacat">Cacat</option><option value="hilang">Hilang</option></select></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. kain cacat, sobek, dst"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};


// TAB 1.7: Selesai — riwayat: cari, filter tanggal, unduh CSV. Tampil KOSONG
// sampai modul Serie menulis `sampai_pada` + `status:'selesai'` ke cutting_track.
// Gap disengaja, bukan bug modul ini.

const CuttingSelesai = {
  setup() {
    const memuat = ref(true);
    const semuaSelesai = ref([]);
    const kataKunci = ref('');
    const dariTanggal = ref('');
    const sampaiTanggal = ref('');

    async function muat() {
      memuat.value = true;
      try { semuaSelesai.value = saringMilikOperatorSemuaTahap((await muatSemuaCuttingTrack()).filter(t => t.status === 'selesai')).sort((a, b) => new Date(b.sampai_pada || 0) - new Date(a.sampai_pada || 0)); }
      catch (e) { console.error('Gagal muat Cutting > Selesai:', e); semuaSelesai.value = []; }
      memuat.value = false;
    }

    const selesaiHariIni = computed(() => semuaSelesai.value.filter(t => hariIniSama(t.sampai_pada)));

    const daftarUrut = computed(() => {
      let hasil = semuaSelesai.value;
      const kata = kataKunci.value.trim().toLowerCase();
      if (kata) hasil = hasil.filter(t => (t.kode_grouping_induk || '').toLowerCase().includes(kata) || (t.nama_produk || '').toLowerCase().includes(kata));
      if (dariTanggal.value) hasil = hasil.filter(t => t.sampai_pada && new Date(t.sampai_pada) >= new Date(dariTanggal.value));
      if (sampaiTanggal.value) hasil = hasil.filter(t => t.sampai_pada && new Date(t.sampai_pada) <= new Date(sampaiTanggal.value + 'T23:59:59'));
      return hasil;
    });

    function unduhCsv() {
      if (!daftarUrut.value.length) { alert('Tidak ada data untuk diunduh.'); return; }
      const header = ['Kode SPK', 'Produk', 'Size', 'Qty', 'Operator Ampar', 'Operator Pola', 'Operator Cutting', 'Kode Tugas', 'Tujuan Akhir', 'Selesai Pada'];
      const baris = daftarUrut.value.map(t => [
        t.kode_grouping_induk, t.nama_produk, t.size, t.qty_total,
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

    return { muat, memuat, daftarUrut, selesaiHariIni, kataKunci, dariTanggal, sampaiTanggal, unduhCsv, formatQty, formatWaktu };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div class="gc-card" style="padding:12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <div style="font-size:12px; color:var(--text-faint);">Selesai hari ini</div>
        <div class="gc-num" style="font-weight:700; font-size:16px;">{{ selesaiHariIni.length }}</div>
      </div>
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <input v-model="kataKunci" type="text" placeholder="Cari kode SPK / produk..." style="flex:2; min-width:160px; padding:8px; background:var(--ivory-dim); border-radius:10px; border:1px solid var(--line);">
        <input v-model="dariTanggal" type="date" style="flex:1; min-width:130px; padding:8px; border-radius:10px; border:1px solid var(--line);">
        <input v-model="sampaiTanggal" type="date" style="flex:1; min-width:130px; padding:8px; border-radius:10px; border:1px solid var(--line);">
        <button @click="unduhCsv" class="btn-outline" style="padding:8px 14px; font-size:11.5px;"><i class="fas fa-download" style="margin-right:6px;"></i>Unduh CSV</button>
      </div>

      <div v-if="daftarUrut.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-circle-check"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada riwayat Selesai</h3>
        <p style="font-size:11px; color:var(--text-faint); margin-top:6px;">Tab ini terisi otomatis begitu modul Serie (belum dibangun) menulis balik status selesai ke sini — bukan error.</p>
      </div>
      <div v-else class="gc-card" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead><tr style="text-align:left; border-bottom:1px solid var(--line);">
            <th style="padding:6px 8px;">Kode SPK</th><th style="padding:6px 8px;">Produk</th><th style="padding:6px 8px;">Qty</th>
            <th style="padding:6px 8px;">Op. Ampar</th><th style="padding:6px 8px;">Op. Pola</th><th style="padding:6px 8px;">Op. Cutting</th>
            <th style="padding:6px 8px;">Tujuan</th><th style="padding:6px 8px;">Selesai</th>
          </tr></thead>
          <tbody>
            <tr v-for="t in daftarUrut" :key="t.id" style="border-bottom:1px solid var(--line);">
              <td style="padding:6px 8px; font-weight:700;" class="gc-num">{{ t.kode_grouping_induk }}</td>
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

// Mount ke index.html — LAZY, SAMA pola seperti pos Persiapan Produksi lain:
// fungsi window.pastikanMountCuttingXxx dipanggil oleh pindahSubTab
// (js/dashboard.js, peta petaMount) PERTAMA KALI tab itu dibuka.
let vmCuttingPerluDiProses = null;
window.pastikanMountCuttingPerluDiProses = function () {
  if (vmCuttingPerluDiProses) { if (typeof vmCuttingPerluDiProses.muat === 'function') vmCuttingPerluDiProses.muat(); return; }
  const mountPoint = document.getElementById('vue-cutting-perludiproses');
  if (mountPoint) vmCuttingPerluDiProses = createApp(CuttingPerluDiProses).mount('#vue-cutting-perludiproses');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaScanSampaiCutting = function () { window.pastikanMountCuttingPerluDiProses(); if (vmCuttingPerluDiProses) vmCuttingPerluDiProses.sampaiTerpadu.buka(); };
window.bukaScanUnpackCutting = function () { window.pastikanMountCuttingPerluDiProses(); if (vmCuttingPerluDiProses) vmCuttingPerluDiProses.unpackTerpadu.buka(); };
window.bukaCuttingOperatorAmpar = function () { window.pastikanMountCuttingPerluDiProses(); if (vmCuttingPerluDiProses) vmCuttingPerluDiProses.bukaTunjukAmparToolbar(); };
let vmCuttingSedangAmpar = null;
window.pastikanMountCuttingSedangAmpar = function () {
  if (vmCuttingSedangAmpar) { if (typeof vmCuttingSedangAmpar.muat === 'function') vmCuttingSedangAmpar.muat(); return; }
  const mountPoint = document.getElementById('vue-cutting-sedangampar');
  if (mountPoint) vmCuttingSedangAmpar = createApp(CuttingSedangAmpar).mount('#vue-cutting-sedangampar');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaCuttingEntryAmpar = function () { window.pastikanMountCuttingSedangAmpar(); if (vmCuttingSedangAmpar) vmCuttingSedangAmpar.bukaScanEntryToolbar(); };
window.bukaCuttingOperatorPola = function () { window.pastikanMountCuttingSedangAmpar(); if (vmCuttingSedangAmpar) vmCuttingSedangAmpar.bukaTunjukPolaToolbar(); };
let vmCuttingSedangPola = null;
window.pastikanMountCuttingSedangPola = function () {
  if (vmCuttingSedangPola) { if (typeof vmCuttingSedangPola.muat === 'function') vmCuttingSedangPola.muat(); return; }
  const mountPoint = document.getElementById('vue-cutting-sedangpola');
  if (mountPoint) vmCuttingSedangPola = createApp(CuttingSedangPola).mount('#vue-cutting-sedangpola');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaCuttingEntryPola = function () { window.pastikanMountCuttingSedangPola(); if (vmCuttingSedangPola) vmCuttingSedangPola.bukaScanEntryToolbar(); };
window.bukaCuttingOperatorCutting = function () { window.pastikanMountCuttingSedangPola(); if (vmCuttingSedangPola) vmCuttingSedangPola.bukaTunjukCuttingToolbar(); };
let vmCuttingSedangCutting = null;
window.pastikanMountCuttingSedangCutting = function () {
  if (vmCuttingSedangCutting) { if (typeof vmCuttingSedangCutting.muat === 'function') vmCuttingSedangCutting.muat(); return; }
  const mountPoint = document.getElementById('vue-cutting-sedangcutting');
  if (mountPoint) vmCuttingSedangCutting = createApp(CuttingSedangCutting).mount('#vue-cutting-sedangcutting');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaCuttingEntryCutting = function () { window.pastikanMountCuttingSedangCutting(); if (vmCuttingSedangCutting) vmCuttingSedangCutting.bukaScanEntryToolbar(); };
let vmCuttingPerluDiKirim = null;
window.pastikanMountCuttingPerluDiKirim = function () {
  if (vmCuttingPerluDiKirim) { if (typeof vmCuttingPerluDiKirim.muat === 'function') vmCuttingPerluDiKirim.muat(); return; }
  const mountPoint = document.getElementById('vue-cutting-perludikirim');
  if (mountPoint) vmCuttingPerluDiKirim = createApp(CuttingPerluDiKirim).mount('#vue-cutting-perludikirim');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaScanPackCutting = function () { window.pastikanMountCuttingPerluDiKirim(); if (vmCuttingPerluDiKirim) vmCuttingPerluDiKirim.packTerpadu.buka(); };
window.bukaScanKirimCutting = function () { window.pastikanMountCuttingPerluDiKirim(); if (vmCuttingPerluDiKirim) vmCuttingPerluDiKirim.kirimTerpadu.buka(); };
let vmCuttingSedangDiKirim = null;
window.pastikanMountCuttingSedangDiKirim = function () {
  if (vmCuttingSedangDiKirim) { if (typeof vmCuttingSedangDiKirim.muat === 'function') vmCuttingSedangDiKirim.muat(); return; }
  const mountPoint = document.getElementById('vue-cutting-sedangdikirim');
  if (mountPoint) vmCuttingSedangDiKirim = createApp(CuttingSedangDiKirim).mount('#vue-cutting-sedangdikirim');
};
let vmCuttingSelesai = null;
window.pastikanMountCuttingSelesai = function () {
  if (vmCuttingSelesai) { if (typeof vmCuttingSelesai.muat === 'function') vmCuttingSelesai.muat(); return; }
  const mountPoint = document.getElementById('vue-cutting-selesai');
  if (mountPoint) vmCuttingSelesai = createApp(CuttingSelesai).mount('#vue-cutting-selesai');
};
