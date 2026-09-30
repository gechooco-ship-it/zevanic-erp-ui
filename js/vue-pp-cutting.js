// js/vue-pp-cutting.js
// Proses Produksi > Cutting. Bahan dari Collection, tiga tahap operator (ampar →
// pola → cutting), cetak label komponen, lalu kirim balik ke Collection.
// Koleksi & field:
// - cutting_track: 1 dokumen per SPK Grouping. grouping_id, kode_grouping_induk,
//   sku_produk_terlibat[] (untuk cari BOM), op_ampar/op_pola/op_cutting,
//   komponen_rincian[], kode_bagging[], kode_tugas, sampai_pada,
//   masuk_tahap_pada (dasar ambang tertahan 6 jam). Status: perlu_diproses →
//   sedang_ampar/pola/cutting → perlu_dikirim → sedang_dikirim → selesai.
// - bagging: 1 per bahan (cutting_track_id, pola_key, jumlah_target); tugas_kirim.dimuat[].
// - label_komponen: 1 per komponen per tumpukan, dicetak PER BAHAN (pola_key =
//   bahan_aksesoris_id::nama_pola), kode {kode_grouping bahan itu}-{nn}. Jumlah
//   = isi_pola_pcs x komponen.qty. Semua wajib di-scan sebelum Cutting Selesai.
// - spk_track.bahan_rincian[].gelar_jumlah/gelar_riwayat[]: 1 scan = 1 lembar amparan.
// Jebakan:
// - cutting_track dibuat LAZY saat Tab 1.1 dibuka (id = grouping_id, transaksi
//   jadi tidak dobel), ditolak selama bahan grouping itu belum dikirim
//   Collection (spk_track.bahan_rincian[].kirim_cutting_pada).
// - Scan Sampai Tab 1.1 satu-satunya penulis bahan_rincian[].sampai_cutting_pada.
//   bahan_rincian[].sampai_pada milik Scan Sampai Collection, jangan disentuh.

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel } from './vue-components.js?v=13';
import { ScanTerpaduGenerik, buatScanTerpadu, buatQrDataUrl, cariKaryawanByQr, ajukanPersiapanMasalah, ambilStatusUnpackBagging } from './vue-scan-cetak.js?v=16';
import { aksiAktif, pastikanCachePilihanScan } from './vue-popup-scan.js?v=8';

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
  return role === 'owner' || role === 'superuser' || role === 'pic' || role === 'pic_owner';
}
// saringMilikOperator — operator hanya lihat baris yang ditugaskan ke dirinya
// (lewat Scan Operator); role lain lihat semua baris. Gerbang TAMPILAN,
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
async function muatLabelUntukTrack(trackIds) {
  const hasil = [];
  for (let i = 0; i < trackIds.length; i += 30) {
    const snap = await getDocs(query(collection(db, 'label_komponen'), where('cutting_track_id', 'in', trackIds.slice(i, i + 30))));
    snap.docs.forEach(d => hasil.push({ id: d.id, ...d.data() }));
  }
  return hasil;
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
    // ID dokumen = id grouping, dibuat lewat transaksi hanya kalau belum ada:
    // dua layar yang membuka tab bersamaan tidak bisa membuat dokumen dobel.
    await Promise.all(siapDitulis.map(g => runTransaction(db, async (trx) => {
      const ref = doc(db, 'cutting_track', g.id);
      if ((await trx.get(ref)).exists()) return;
      trx.set(ref, {
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
      });
    })));
  }
  return await muatSemuaCuttingTrack();
}
// hitungKomponenRincian — komponen SEMUA baris bom_pola, tiap item membawa
// pola_key + nama_bahan supaya label bisa dicetak per bahan.
function kunciPola(p) { return (p.bahan_aksesoris_id || p.nama_bahan || '') + '::' + (p.nama_pola || ''); }
function hitungKomponenRincian(track, petaProduk) {
  const sku = (track.sku_produk_terlibat || [])[0];
  const produk = sku ? petaProduk[sku] : null;
  const semuaPola = (produk && Array.isArray(produk.bom_pola)) ? produk.bom_pola : [];
  const hasil = [];
  semuaPola.forEach(pola => {
    const isiPola = parseFloat(pola.isi_pola_pcs) || 0;
    const komponen = Array.isArray(pola.komponen) ? pola.komponen : [];
    if (isiPola <= 0) return;
    komponen.forEach(k => hasil.push({
      pola_key: kunciPola(pola), nama_pola: pola.nama_pola || '', bahan_aksesoris_id: pola.bahan_aksesoris_id || '',
      nama_bahan: [pola.nama_bahan, pola.warna_bahan].filter(Boolean).join(' ') || '-',
      nama_komponen: k.nama_komponen || '(tanpa nama)',
      qty_per_pola: parseFloat(k.qty) || 0,
      isi_pola_pcs: isiPola,
      jumlah_label: isiPola * (parseFloat(k.qty) || 0),
      label_dicetak_pada: null
    }));
  });
  return hasil;
}
// lengkapiRincianPerBahan — rincian lama (tanpa pola_key, cuma bom_pola[0])
// dihitung ulang dari BOM; status cetak lama dibawa ke bahan pertama.
function lengkapiRincianPerBahan(track, petaProduk) {
  const lama = track.komponen_rincian || [];
  if (lama.length && lama.every(k => k.pola_key)) return null;
  const baru = hitungKomponenRincian(track, petaProduk);
  if (!baru.length) return null;
  const kunciPertama = baru[0].pola_key;
  return baru.map(k => {
    const l = k.pola_key === kunciPertama ? lama.find(x => x.nama_komponen === k.nama_komponen) : null;
    return l ? { ...k, label_dicetak_pada: l.label_dicetak_pada || null } : k;
  });
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
// 1.1-1.4: `bahan` = 1 baris per bahan+pola BOM (amparan & kain dijumlah lintas
// separating), satu sub-baris per bahan di tabel. Tiap bahan membawa kode_bagging,
// satuan 'M', dan sampaiPada/kirimPada (dasar Diam Sejak per bahan).
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
      const perBahan = {};
      cocok.forEach(b => {
        const key = (b.bahan_aksesoris_id || b.bahan_nama) + '::' + (b.nama_pola || '');
        if (!perBahan[key]) perBahan[key] = { key, sku: [b.bahan_nama, b.bahan_warna].filter(Boolean).join(' ') || '-', panjangPola: b.panjang_pola || 0, isiPola: b.isi_pola_pcs || 0, amparan: 0, kebutuhanKain: 0, satuan: 'M', bagging: [], sampaiPada: null, kirimPada: null, semuaSampai: true };
        const x = perBahan[key];
        x.amparan += parseFloat(b.amparan) || 0;
        x.kebutuhanKain += parseFloat(b.kebutuhan_kain) || 0;
        if (b.kode_bagging && !x.bagging.includes(b.kode_bagging)) x.bagging.push(b.kode_bagging);
        if (!b.sampai_cutting_pada) x.semuaSampai = false;
        else if (!x.sampaiPada || b.sampai_cutting_pada > x.sampaiPada) x.sampaiPada = b.sampai_cutting_pada;
        if (b.kirim_cutting_pada && (!x.kirimPada || b.kirim_cutting_pada > x.kirimPada)) x.kirimPada = b.kirim_cutting_pada;
      });
      peta[t.id] = {
        bahan: Object.values(perBahan),
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
// bukaPilihBahan: opsinya SPK + bahan (dari komponen_rincian), untuk Scan Entry
// label komponen yang dikerjakan per bahan.
function pilihTargetMixin(daftarRef) {
  const pilihTarget = ref(null); // { opsi[{id, track, bahan, label}], targetId, labelPilih, judul, lanjut(track, bahan) }
  function buka(opsi, labelPilih, judul, lanjut) {
    if (!opsi.length) { alert('Tidak ada baris di tab ini untuk diproses.'); return; }
    pilihTarget.value = { opsi, targetId: opsi[0].id, labelPilih, judul, lanjut };
  }
  function bukaPilihTarget(judul, lanjut) {
    buka(daftarRef.value.map(t => ({ id: t.id, track: t, bahan: null, label: `${t.kode_grouping_induk} — ${t.nama_produk}` })), 'Pilih SPK Grouping', judul, lanjut);
  }
  function bukaPilihBahan(judul, lanjut) {
    const opsi = [];
    daftarRef.value.forEach(t => {
      const grup = [];
      (t.komponen_rincian || []).forEach(k => { if (k.pola_key && !grup.some(g => g.pola_key === k.pola_key)) grup.push({ pola_key: k.pola_key, nama_bahan: k.nama_bahan, nama_pola: k.nama_pola }); });
      if (!grup.length) opsi.push({ id: t.id, track: t, bahan: null, label: `${t.kode_grouping_induk} — ${t.nama_produk}` });
      grup.forEach(g => opsi.push({ id: t.id + '|' + g.pola_key, track: t, bahan: g, label: `${t.kode_grouping_induk} — ${g.nama_bahan}${g.nama_pola ? ' (' + g.nama_pola + ')' : ''}` }));
    });
    buka(opsi, 'Pilih SPK & Bahan', judul, lanjut);
  }
  function batalPilihTarget() { pilihTarget.value = null; }
  function konfirmasiPilihTarget() {
    const p = pilihTarget.value;
    const o = p.opsi.find(x => x.id === p.targetId);
    pilihTarget.value = null;
    if (o) p.lanjut(o.track, o.bahan);
  }
  return { pilihTarget, bukaPilihTarget, bukaPilihBahan, batalPilihTarget, konfirmasiPilihTarget };
}
// labelMilikBahan — label cetakan lama (tanpa pola_key) dianggap milik bahan
// pertama komponen_rincian, sama aturan Cetak Ulang.
function labelMilikBahan(label, track, bahan) {
  if (!bahan) return true;
  const kunciPertama = ((track.komponen_rincian || [])[0] || {}).pola_key;
  return (label.pola_key || kunciPertama) === bahan.pola_key;
}
function jamScan(d) { return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

// validasiBadgeOperator — langkah isi Scan Operator Ampar/Pola/Cutting: QR badge
// dibaca jadi { email, nama } operator yang BENAR-BENAR mengerjakan, bukan
// pemilik akun yang login. Satu sesi = satu operator.
async function validasiBadgeOperator(kode, _locked, rows) {
  if (rows.length) return { ok: false, pesan: 'Operator sudah discan — hapus dulu kalau salah orang.' };
  const k = await cariKaryawanByQr(kode);
  if (!k) return { ok: false, pesan: 'QR tidak dikenali — operator/tim tidak ditemukan.' };
  const user = { email: k.id, nama: k.nama || k.name || k.id };
  return { ok: true, row: { kode, label: user.nama, tagTxt: 'operator', tagCls: 'ok', _user: user } };
}

// buatScanOperator — SPK dipilih dulu (pilihTargetMixin), lalu badge discan di
// Scan Terpadu. terapkan(track, user) menulis; balas false kalau dibatalkan.
function buatScanOperator(judul, terapkan) {
  const ctx = { track: null };
  const c = buatScanTerpadu({
    judul, subjudul: 'Scan QR badge operator, lalu Upload',
    camMode: 'Mode: Scan Badge Operator', placeholder: 'Scan QR badge / ketik ID karyawan',
    validasiIsi: validasiBadgeOperator,
    padaUpload: async (rows) => {
      try {
        if (await terapkan(ctx.track, rows[0]._user) === false) return { ok: false, pesan: 'Dibatalkan.' };
        c.tutup();
        return { ok: true };
      } catch (e) { console.error('Gagal scan operator:', e); return { ok: false, pesan: 'Gagal menyimpan. Coba lagi.' }; }
    }
  });
  function buka(track) { ctx.track = track; c.cfg.judul = `${judul} — SPK ${track.kode_grouping_induk}`; c.buka(); }
  return { c, buka };
}

// buatEntryLabelKomponen — Scan Entry Pola/Cutting. SPK+bahan dipilih dulu,
// label komponen dikumpulkan di draft; status & jam ditulis saat Upload.
function buatEntryLabelKomponen({ judul, fieldStatus, fieldPada, catatan, semuaLabel }) {
  const ctx = { track: null, bahan: null };
  const c = buatScanTerpadu({
    judul, subjudul: 'Scan tiap label komponen, lalu Upload',
    camMode: 'Mode: Scan Label Komponen (berkali-kali)', placeholder: 'Scan QR label komponen / ketik kode',
    validasiIsi: async (kode) => {
      const snap = await getDocs(query(collection(db, 'label_komponen'), where('kode', '==', kode)));
      if (snap.empty) return { ok: false, pesan: `Label "${kode}" tidak ditemukan.` };
      const d = snap.docs[0], l = d.data();
      if (l.cutting_track_id !== ctx.track.id) return { ok: false, pesan: `Label "${kode}" bukan milik SPK ${ctx.track.kode_grouping_induk}.` };
      if (!labelMilikBahan(l, ctx.track, ctx.bahan)) return { ok: false, pesan: `Label "${kode}" (${l.nama_komponen}) bukan milik bahan ${ctx.bahan.nama_bahan}.` };
      if (l[fieldStatus] === 'selesai') return { ok: false, pesan: `Label "${kode}" sudah di-scan entry sebelumnya.` };
      const now = new Date();
      return { ok: true, row: { kode, label: l.nama_komponen || '-', meta: jamScan(now), _id: d.id, _nama: l.nama_komponen || '-', _pada: now.toISOString() } };
    },
    padaUpload: async (rows) => {
      try {
        for (const r of rows) await updateDoc(doc(db, 'label_komponen', r._id), { [fieldStatus]: 'selesai', [fieldPada]: r._pada });
        const ids = new Set(rows.map(r => r._id));
        semuaLabel.value = semuaLabel.value.map(l => ids.has(l.id) ? { ...l, [fieldStatus]: 'selesai' } : l);
        // riwayat_scan gagal tidak membatalkan status label yang sudah tertulis.
        try {
          await updateCuttingTrack(ctx.track.id, (data) => ({
            riwayat_scan: [...(data.riwayat_scan || []), ...rows.map(r => ({ aksi: 'entry', oleh: window.currentUser?.email || null, pada: r._pada, catatan: `${catatan} — komponen ${r._nama} (label ${r.kode})`, qty: null }))]
          }));
        } catch (e2) { console.error('Gagal catat riwayat_scan entry:', e2); }
        return { ok: true };
      } catch (e) { console.error('Gagal upload scan entry:', e); return { ok: false, pesan: 'Gagal menyimpan. Coba lagi.' }; }
    }
  });
  function buka(track, bahan) {
    ctx.track = track; ctx.bahan = bahan || null;
    c.cfg.judul = `${judul} — ${track.kode_grouping_induk}${bahan ? ' · ' + bahan.nama_bahan : ''}`;
    c.buka();
  }
  return { c, buka };
}

// Amparan per label bahan = jumlah lembar yang wajib discan (pecahan dibulatkan
// ke atas, kosong = 0 dan ditolak). Data lama tanpa gelar_jumlah tapi punya
// gelar_pada dihitung 1 lembar.
const JEDA_LEMBAR_MS = 3000;
function targetLembar(b) { const n = Math.ceil(parseFloat(b.amparan) || 0); return n > 0 ? n : 0; }
function jumlahGelar(b) { return b.gelar_jumlah != null ? (parseInt(b.gelar_jumlah, 10) || 0) : (b.gelar_pada ? 1 : 0); }
function kunciBarisBahan(b) { return (b.bahan_aksesoris_id || b.bahan_nama) + '::' + (b.nama_pola || ''); }
function namaBahanBaris(b) { return [b.bahan_nama, b.bahan_warna].filter(Boolean).join(' ') || b.kode_baris; }
async function cariLabelBahanAmpar(kode, daftarTrack) {
  for (const t of daftarTrack) {
    const semua = await barisBahanGrouping(t.grouping_id);
    const baris = semua.find(b => b.kode_baris === kode);
    if (baris) return { track: t, baris, semua, target: targetLembar(baris), sudah: jumlahGelar(baris) };
  }
  return null;
}
function kekuranganAmpar(semua) {
  return semua.filter(b => !targetLembar(b) || jumlahGelar(b) < targetLembar(b))
    .map(b => `- ${namaBahanBaris(b)} (${b.kode_baris}): ${targetLembar(b) ? jumlahGelar(b) + '/' + targetLembar(b) : 'amparan kosong'}`);
}
function pencatat() { return window.currentUser?.name || window.currentUser?.email || ''; }
// Markup popup pilihTarget — dipakai literal (copy) di template tiap tab,
// konsisten dengan pola file ini yang memang mengulang markup popup kecil per
// tab (lihat popupMasalah di 5 tab lain), bukan komponen global baru.


// TAB 1.1: Perlu Di Proses

const CuttingPerluDiProses = {
  components: { ScanTerpaduGenerik },
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
    const bolehOperator = ref(false); // diisi sesudah izinSiap: window.currentUser tidak reaktif
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
    // barisBahanTampil — sub-baris tabel per bahan; bagging yang tidak cocok ke
    // bahan mana pun ikut di sub-baris terakhir supaya tetap terlihat.
    function barisBahanTampil(t) {
      const info = bahanEnrich.value[t.id];
      const status = {};
      (unpackEnrich.value[t.kode_grouping_induk] || []).forEach(u => { status[u.kode] = u.unpack_hasil; });
      const baris = (info && info.bahan.length ? info.bahan : [{ key: '-', sku: '-', bagging: [] }]).map(b => ({ ...b, unpack: (b.bagging || []).map(k => ({ kode: k, unpack_hasil: status[k] || null })) }));
      const terpakai = new Set(baris.flatMap(b => b.bagging || []));
      Object.keys(status).filter(k => !terpakai.has(k)).forEach(k => baris[baris.length - 1].unpack.push({ kode: k, unpack_hasil: status[k] }));
      return baris;
    }
    function diamBahan(b) { return b.semuaSampai ? b.sampaiPada : b.kirimPada; }

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

    // Scan Operator Ampar: tombol PIC ke atas, operator dibaca dari QR badge
    const opAmpar = buatScanOperator('Scan Operator Ampar', terapkanOperatorAmpar);
    // Gerbang siapBahan mengunci TITIK MASUK pekerjaan fisik (Scan Operator Ampar),
    // bukan Scan Sampai/Scan Unpack — keduanya justru aksi yang membuat baris jadi
    // siap, mengunci itu bikin buntu. Tab 1.2-1.4 tidak perlu cek ulang.
    function bukaScanOperatorAmpar(track) {
      if (!siapBahan(track)) { alert(`SPK ${track.kode_grouping_induk} masih menunggu bahan dari Collection (kode bagging belum di-Scan Sampai). Scan Operator belum bisa dilakukan.`); return; }
      opAmpar.buka(track);
    }
    async function terapkanOperatorAmpar(track, user) {
      await updateCuttingTrack(track.id, (data) => ({
        op_ampar: { uid: user.email, nama: user.nama, riwayat: [...((data.op_ampar && data.op_ampar.riwayat) || []), { uid: user.email, nama: user.nama, pada: new Date().toISOString() }] },
        status: 'sedang_ampar', masuk_tahap_pada: new Date().toISOString(),
        riwayat_scan: [...(data.riwayat_scan || []), { aksi: 'operator', oleh: pencatat(), pada: new Date().toISOString(), catatan: 'Scan Operator Ampar: ' + user.nama, qty: track.qty_total ?? null }]
      }));
      await muat();
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
    function bukaScanOperatorAmparToolbar() { bukaPilihTarget('Pilih SPK — Scan Operator Ampar', (track) => bukaScanOperatorAmpar(track)); }

    onMounted(async () => { await window.authReady; await window.izinSiap; bolehOperator.value = picOwnerKeAtas(window.currentUser); await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, daftar, daftarTampil, bahanEnrich, unpackEnrich, bolehProses, bolehOperator, aksiAktif, formatQty, formatDiamSejak, tertahan, siapBahan, barisBahanTampil, diamBahan,
      sampaiTerpadu,
      unpackTerpadu,
      scanOpAmpar: opAmpar.c,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah,
      pilihTarget, batalPilihTarget, konfirmasiPilihTarget, bukaScanOperatorAmparToolbar
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
        <button v-if="bolehOperator && aksiAktif('sub-pr-cutting-perludiproses','cutting_operator_ampar')" @click="bukaScanOperatorAmparToolbar" class="btn-outline" style="flex:1; min-width:160px; padding:9px;"><i class="fas fa-user-check" style="margin-right:6px;"></i>Scan Operator Ampar</button>
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
            <template v-for="t in daftarTampil" :key="t.id">
              <tr v-for="(b, i) in barisBahanTampil(t)" :key="t.id + b.key" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : '', borderBottom: i === barisBahanTampil(t).length - 1 ? '1px solid var(--line)' : '' }">
                <template v-if="i === 0">
                  <td :rowspan="barisBahanTampil(t).length" style="padding:6px 8px; font-weight:700; vertical-align:middle;" class="gc-num">{{ t.kode_grouping_induk }}</td>
                  <!-- Status Bahan: lihat siapBahan -->
                  <td :rowspan="barisBahanTampil(t).length" style="padding:6px 8px; vertical-align:middle;"><span class="tag" :class="siapBahan(t) ? 'ok' : 'warn'">{{ siapBahan(t) ? 'Siap' : 'Menunggu Bahan' }}</span></td>
                  <td :rowspan="barisBahanTampil(t).length" style="padding:6px 8px; vertical-align:middle;">{{ t.nama_produk }}<span v-if="t.size" style="color:var(--text-faint);"> ({{ t.size }})</span></td>
                </template>
                <td style="padding:4px 8px; color:var(--text-faint); vertical-align:middle;">{{ b.sku }}</td>
                <td v-if="i === 0" :rowspan="barisBahanTampil(t).length" style="padding:6px 8px; vertical-align:middle;" class="gc-num">{{ formatQty(t.qty_total) }}</td>
                <td style="padding:4px 8px; vertical-align:middle;" class="gc-num">{{ b.key === '-' ? '-' : formatQty(b.panjangPola) }}</td>
                <td style="padding:4px 8px; vertical-align:middle;" class="gc-num">{{ b.key === '-' ? '-' : formatQty(b.isiPola) }}</td>
                <td style="padding:4px 8px; vertical-align:middle;" class="gc-num">{{ b.key === '-' ? '-' : formatQty(b.amparan) }}</td>
                <td style="padding:4px 8px; vertical-align:middle;" class="gc-num">{{ b.key === '-' ? '-' : formatQty(b.kebutuhanKain) }}</td>
                <td style="padding:4px 8px; vertical-align:middle;">{{ b.satuan || '-' }}</td>
                <td style="padding:4px 8px; vertical-align:middle;">
                  <span v-if="!b.unpack.length" class="tag neutral">belum</span>
                  <!-- Kartu Batch (design system): kode bagging + status Unpack, warna dot ikut unpack_hasil -->
                  <div v-else style="display:flex; flex-wrap:wrap; gap:4px;">
                    <span v-for="u in b.unpack" :key="u.kode" class="gc-batch-card" :class="{ inkomplit: u.unpack_hasil !== 'komplit' }" style="display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:999px; background:var(--ivory-dim);" :title="u.unpack_hasil || 'belum di-unpack'">
                      <span class="tag-dot" :style="{ color: u.unpack_hasil==='komplit' ? 'var(--ok)' : (u.unpack_hasil==='inkomplit' ? 'var(--warn)' : 'var(--text-faint)') }"></span>{{ u.kode }}
                    </span>
                  </div>
                </td>
                <td style="padding:4px 8px; vertical-align:middle;">
                  <span class="tag" :class="!b.semuaSampai || tertahan(diamBahan(b)) ? 'warn' : 'neutral'">{{ formatDiamSejak(diamBahan(b)) }}</span>
                  <div v-if="b.key !== '-'" style="font-size:9.5px; color:var(--text-faint); margin-top:2px;">{{ b.semuaSampai ? 'sejak sampai' : 'belum sampai' }}</div>
                </td>
                <td v-if="i === 0" :rowspan="barisBahanTampil(t).length" style="padding:6px 8px; vertical-align:middle;"><button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="padding:5px 9px; font-size:10.5px; color:var(--danger);" title="Scan Masalah"><i class="fas fa-triangle-exclamation"></i></button></td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>

    <scan-terpadu-generik :c="sampaiTerpadu" />

    <scan-terpadu-generik :c="unpackTerpadu" />

    <scan-terpadu-generik :c="scanOpAmpar" />

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
        <div class="gc-field" style="margin-bottom:14px;"><label>{{ pilihTarget.labelPilih }}</label>
          <select v-model="pilihTarget.targetId"><option v-for="o in pilihTarget.opsi" :key="o.id" :value="o.id">{{ o.label }}</option></select>
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
  components: { ScanTerpaduGenerik },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const bahanEnrich = ref({});
    const progAmpar = ref({}); // trackId -> { kunciBarisBahan: { sudah, target } }
    const menuId = 'cut_cutting';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehOperator = ref(false); // diisi sesudah izinSiap: window.currentUser tidak reaktif

    async function muat() {
      memuat.value = true;
      try {
        const [semuaTrack, groupingList] = await Promise.all([muatSemuaCuttingTrack(), muatSemuaGrouping()]);
        daftar.value = saringMilikOperator(semuaTrack.filter(t => t.status === 'sedang_ampar'), 'op_ampar');
        bahanEnrich.value = await enrichBahanUntukTrack(daftar.value, groupingList);
        const peta = {};
        await Promise.all(daftar.value.map(async (t) => {
          const p = {};
          (await barisBahanGrouping(t.grouping_id)).forEach(b => {
            const k = kunciBarisBahan(b);
            if (!p[k]) p[k] = { sudah: 0, target: 0 };
            p[k].sudah += jumlahGelar(b); p[k].target += targetLembar(b);
          });
          peta[t.id] = p;
        }));
        progAmpar.value = peta;
      } catch (e) { console.error('Gagal muat Cutting > Sedang Ampar:', e); daftar.value = []; }
      memuat.value = false;
    }
    function progBahan(t, b) { return (progAmpar.value[t.id] || {})[b.key] || null; }
    function gelarPenuh(t, b) { const p = progBahan(t, b); return !!(p && p.target && p.sudah >= p.target); }
    function teksGelar(t, b) { const p = progBahan(t, b); return p ? `${p.sudah}/${p.target}${gelarPenuh(t, b) ? ' ✓' : ''}` : '-'; }

    // Scan Entry Ampar: kunci 1 label bahan, lalu label yang SAMA discan tiap
    // 1 lembar selesai digelar (bolehUlang). Jam tiap lembar diambil saat scan;
    // batas amparan dicek ulang di dalam transaksi supaya 2 HP tidak melebihi.
    function labelKunciAmpar(d, sudah) { return `${d.baris.kode_baris} · ${namaBahanBaris(d.baris)} · SPK ${d.track.kode_grouping_induk} · ${sudah}/${d.target} lembar`; }
    const entryAmpar = buatScanTerpadu({
      judul: 'Scan Entry Ampar', subjudul: 'Kunci label bahan, lalu scan label yang sama tiap 1 lembar selesai digelar',
      bolehUlang: true,
      twoStep: {
        labelPertama: 'Label Bahan', labelKedua: 'Lembar',
        placeholderPertama: 'Scan QR label bahan / ketik kode (sekali di awal)', placeholderKedua: '',
        camModePertama: 'Mode: Kunci Label Bahan', camModeKedua: 'Mode: Scan tiap lembar selesai digelar',
        kosongUtama: 'Scan label bahan dulu', kosongSub: 'Scan kunci ini belum dihitung sebagai lembar.',
        manualHanyaKunci: true, tetapKunci: true,
        validasi: async (kode) => {
          try {
            const d = await cariLabelBahanAmpar(kode, daftar.value);
            if (!d) return { ok: false, pesan: `"${kode}" bukan label bahan SPK yang sedang Ampar.` };
            if (!d.baris.sampai_cutting_pada) return { ok: false, pesan: `${kode} belum di-Scan Sampai di Cutting.` };
            if (!d.target) return { ok: false, pesan: `Amparan label ${kode} kosong — isi dulu di Persiapan.` };
            if (d.sudah >= d.target) return { ok: false, pesan: `${namaBahanBaris(d.baris)} sudah ${d.sudah}/${d.target} digelar.` };
            return { ok: true, data: d, label: labelKunciAmpar(d, d.sudah) };
          } catch (e) { console.error('Gagal cari label bahan:', e); return { ok: false, pesan: 'Gagal mencari label bahan. Coba lagi.' }; }
        }
      },
      validasiIsi: async (kode, d, rows) => {
        if (kode !== d.baris.kode_baris) return { ok: false, pesan: 'Ini label bahan lain — tekan Ganti dulu untuk pindah bahan.' };
        const akhir = rows[rows.length - 1];
        if (akhir && Date.now() - akhir._ms < JEDA_LEMBAR_MS) return { ok: false, pesan: 'Terlalu cepat — tunggu 3 detik antar lembar.' };
        const n = d.sudah + rows.length + 1;
        if (n > d.target) return { ok: false, pesan: `${namaBahanBaris(d.baris)} sudah ${d.target}/${d.target} digelar.` };
        const now = new Date();
        return { ok: true, row: { kode, label: `Lembar ${n} dari ${d.target}`, meta: jamScan(now), _pada: now.toISOString(), _ms: now.getTime() } };
      },
      susunUlang: (rows, d) => rows.forEach((r, i) => { r.label = `Lembar ${d.sudah + i + 1} dari ${d.target}`; }),
      padaUpload: async (rows, d) => {
        const oleh = window.currentUser?.email || null;
        let total = 0;
        try {
          await runTransaction(db, async (trx) => {
            const ref = doc(db, 'spk_track', d.baris._trackId);
            const snap = await trx.get(ref);
            const arr = (snap.data().bahan_rincian || []).slice();
            const b = arr[d.baris._idx];
            if (!b || b.kode_baris !== d.baris.kode_baris) throw new Error('BARIS_BERGESER');
            total = jumlahGelar(b) + rows.length;
            if (total > targetLembar(b)) throw new Error('MELEBIHI');
            arr[d.baris._idx] = {
              ...b, gelar_jumlah: total, gelar_pada: b.gelar_pada || rows[0]._pada, gelar_oleh: b.gelar_oleh || oleh,
              gelar_riwayat: [...(b.gelar_riwayat || []), ...rows.map(r => ({ pada: r._pada, oleh }))],
              ...(total >= targetLembar(b) ? { gelar_selesai_pada: rows[rows.length - 1]._pada } : {})
            };
            trx.update(ref, { bahan_rincian: arr, diperbarui_pada: serverTimestamp() });
          });
        } catch (e) {
          if (e.message === 'MELEBIHI' || e.message === 'BARIS_BERGESER') return { ok: false, pesan: 'Data label ini berubah (mungkin HP lain ikut scan). Tutup lalu buka Scan Entry lagi.' };
          console.error('Gagal upload entry ampar:', e); return { ok: false, pesan: 'Gagal menyimpan. Coba lagi.' };
        }
        d.sudah = total;
        try {
          await updateCuttingTrack(d.track.id, (data) => ({
            entry_ampar_done: (parseFloat(data.entry_ampar_done) || 0) + rows.length,
            riwayat_scan: [...(data.riwayat_scan || []), { aksi: 'entry', oleh, pada: rows[rows.length - 1]._pada, catatan: `Gelar ${d.baris.kode_baris} lembar ${total - rows.length + 1}-${total} dari ${d.target}`, qty: rows.length }]
          }));
        } catch (e2) { console.error('Gagal catat riwayat_scan entry ampar:', e2); }
        if (total >= d.target) { alert(`${namaBahanBaris(d.baris)} selesai digelar (${total}/${d.target}).`); return { ok: true, lepasKunci: true }; }
        return { ok: true, lockedLabel: labelKunciAmpar(d, total) };
      }
    });

    // Ampar Selesai & Scan Operator Pola: SPK dikunci lewat salah satu label
    // bahannya, dan DITOLAK selama ada bahan yang amparannya belum penuh (kain
    // kurang diurus lewat Scan Masalah). Upload menghitung komponen_rincian dari BOM.
    const selesaiAmpar = buatScanTerpadu({
      judul: 'Ampar Selesai & Scan Operator Pola', subjudul: 'Scan salah satu label bahan SPK, lalu badge operator pola',
      twoStep: {
        labelPertama: 'SPK', labelKedua: 'Operator Pola',
        placeholderPertama: 'Scan QR label bahan SPK ini / ketik kode', placeholderKedua: 'Scan QR badge / ketik ID karyawan',
        camModePertama: 'Mode: Scan Label Bahan (kunci SPK)', camModeKedua: 'Mode: Scan Badge Operator Pola',
        kosongUtama: 'Scan label bahan SPK dulu', kosongSub: 'Semua bahan SPK itu wajib sudah penuh amparannya.',
        validasi: async (kode) => {
          try {
            const d = await cariLabelBahanAmpar(kode, daftar.value);
            if (!d) return { ok: false, pesan: `"${kode}" bukan label bahan SPK yang sedang Ampar.` };
            const kurang = kekuranganAmpar(d.semua);
            if (kurang.length) return { ok: false, pesan: `SPK ${d.track.kode_grouping_induk} belum bisa ke Sedang Pola — amparan belum penuh:\n${kurang.join('\n')}\n\nKain kurang? Pakai Scan Masalah untuk minta kekurangan bahan.` };
            return { ok: true, data: d.track, label: `${d.track.kode_grouping_induk} — ${d.track.nama_produk} · amparan penuh` };
          } catch (e) { console.error('Gagal cari label bahan:', e); return { ok: false, pesan: 'Gagal mencari label bahan. Coba lagi.' }; }
        }
      },
      validasiIsi: validasiBadgeOperator,
      padaUpload: async (rows, track) => {
        try {
          if (!(await terapkanOperatorPola(track, rows[0]._user))) return { ok: false, pesan: 'Dibatalkan.' };
          selesaiAmpar.tutup();
          return { ok: true };
        } catch (e) { console.error('Gagal scan operator pola:', e); return { ok: false, pesan: 'Gagal menyimpan. Coba lagi.' }; }
      }
    });
    async function terapkanOperatorPola(track, user) {
      const petaProduk = await ambilPetaProdukBySku();
      const komponen = hitungKomponenRincian(track, petaProduk);
      if (!komponen.length && !confirm('BOM Pola produk ini belum punya rincian Komponen (komponen semua baris master_produk.bom_pola kosong) — tidak ada label yang bisa dihitung. Lanjut ke Sedang Pola tanpa rincian komponen?')) return false;
      await updateCuttingTrack(track.id, (data) => ({
        op_pola: { uid: user.email, nama: user.nama, riwayat: [...((data.op_pola && data.op_pola.riwayat) || []), { uid: user.email, nama: user.nama, pada: new Date().toISOString() }] },
        komponen_rincian: komponen,
        status: 'sedang_pola', masuk_tahap_pada: new Date().toISOString(),
        riwayat_scan: [...(data.riwayat_scan || []), { aksi: 'operator', oleh: pencatat(), pada: new Date().toISOString(), catatan: 'Ampar Selesai & Scan Operator Pola: ' + user.nama, qty: track.qty_total ?? null }]
      }));
      await muat();
      return true;
    }

    // Scan Masalah Ampar = minta kekurangan bahan per label bahan. Lembar kurang
    // dikonversi ke meter (kebutuhan_kain / amparan label itu) supaya Masalah dan
    // Belanja membaca satuan yang sama dengan Persiapan Bahan.
    const popupMasalah = ref(null); // { track, opsi[], idx, lembar, jenis, alasan }
    function meterPerLembar(b) { const n = parseFloat(b.amparan) || 0; return n > 0 ? (parseFloat(b.kebutuhan_kain) || 0) / n : 0; }
    function meterKurang(p) { const b = p && p.opsi[p.idx]; return b ? Math.round(meterPerLembar(b) * (parseFloat(p.lembar) || 0) * 100) / 100 : 0; }
    async function bukaMasalah(track) {
      try {
        const opsi = await barisBahanGrouping(track.grouping_id);
        if (!opsi.length) { alert('Label bahan SPK ini tidak ditemukan.'); return; }
        const belum = opsi.findIndex(b => jumlahGelar(b) < targetLembar(b));
        popupMasalah.value = { track, opsi, idx: belum >= 0 ? belum : 0, lembar: 1, jenis: 'kurang', alasan: '' };
      } catch (e) { console.error('Gagal muat label bahan:', e); alert('Gagal memuat bahan. Coba lagi.'); }
    }
    function batalMasalah() { popupMasalah.value = null; }
    function teksOpsiBahan(b) { return `${namaBahanBaris(b)} · ${b.kode_baris} · ${jumlahGelar(b)}/${targetLembar(b)} lembar`; }
    async function konfirmasiMasalah() {
      const p = popupMasalah.value;
      const b = p.opsi[p.idx];
      const lembar = parseInt(p.lembar, 10) || 0;
      if (lembar <= 0) { alert('Jumlah lembar kurang wajib lebih dari 0.'); return; }
      if (!p.alasan.trim()) { alert('Alasan wajib diisi.'); return; }
      const meter = meterKurang(p);
      const catatan = `Kurang ${lembar} lembar amparan (${b.kode_baris}). ${p.alasan.trim()}`;
      try {
        await ajukanPersiapanMasalah({
          jenisMasalah: p.jenis, kodeLabelAsal: b.kode_baris, separatingId: b.separating_id || '', kodeSeparating: b.kode_separating || '', idOrder: b.id_order || '',
          tlcAsal: 'TLC-PTG', sumberJalur: 'cutting', trackId: b._trackId, lineIdx: b._idx,
          bahanAksesorisId: b.bahan_aksesoris_id, bahanNama: b.bahan_nama, bahanWarna: b.bahan_warna,
          satuan: meter > 0 ? 'm' : 'lembar', noSpk: p.track.kode_grouping_induk, qtyKurang: meter > 0 ? meter : lembar, alasan: catatan
        });
        try {
          await updateCuttingTrack(p.track.id, (data) => ({
            riwayat_scan: [...(data.riwayat_scan || []), { aksi: 'masalah', oleh: window.currentUser?.email || null, pada: new Date().toISOString(), catatan, qty: lembar }]
          }));
        } catch (e2) { console.error('Gagal catat riwayat_scan masalah:', e2); }
        popupMasalah.value = null;
        alert(`Permintaan kekurangan ${namaBahanBaris(b)} terkirim ke Masalah.`);
        await muat();
      } catch (e) { console.error('Gagal ajukan masalah ampar:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    function bukaScanEntryToolbar() { if (!daftar.value.length) { alert('Tidak ada SPK yang sedang Ampar.'); return; } entryAmpar.buka(); }
    function bukaScanOperatorPolaToolbar() { if (!daftar.value.length) { alert('Tidak ada SPK yang sedang Ampar.'); return; } selesaiAmpar.buka(); }

    onMounted(async () => { await window.authReady; await window.izinSiap; bolehOperator.value = picOwnerKeAtas(window.currentUser); await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, daftar, bahanEnrich, bolehProses, bolehOperator, aksiAktif, formatQty, formatDiamSejak, tertahan, teksGelar, gelarPenuh,
      entryAmpar, selesaiAmpar,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah, teksOpsiBahan, meterPerLembar, meterKurang,
      bukaScanEntryToolbar, bukaScanOperatorPolaToolbar
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <button v-if="bolehProses && aksiAktif('sub-pr-cutting-sedangampar','cutting_entry_ampar')" @click="bukaScanEntryToolbar" class="btn-primary" style="flex:1; min-width:130px; padding:9px;"><i class="fas fa-check" style="margin-right:6px;"></i>Scan Entry</button>
        <button v-if="bolehOperator && aksiAktif('sub-pr-cutting-sedangampar','cutting_operator_pola')" @click="bukaScanOperatorPolaToolbar" class="btn-outline" style="flex:1; min-width:200px; padding:9px;"><i class="fas fa-user-check" style="margin-right:6px;"></i>Ampar Selesai &amp; Scan Operator Pola</button>
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
            <th style="padding:6px 8px;" class="gc-num">Kbt Kain</th><th style="padding:6px 8px;" class="gc-num">Lembar</th>
            <th style="padding:6px 8px;">Op. Ampar</th><th style="padding:6px 8px;">Diam Sejak</th><th style="padding:6px 8px;">Aksi</th>
          </tr></thead>
          <tbody>
            <tr v-for="t in daftar" :key="t.id" style="border-bottom:1px solid var(--line); vertical-align:top;" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
              <td style="padding:6px 8px; font-weight:700;" class="gc-num">{{ t.kode_grouping_induk }}</td>
              <td style="padding:6px 8px;">{{ t.nama_produk }}<span v-if="t.size" style="color:var(--text-faint);"> ({{ t.size }})</span></td>
              <td style="padding:6px 8px; color:var(--text-faint);"><template v-if="bahanEnrich[t.id]"><div v-for="b in bahanEnrich[t.id].bahan" :key="b.key">{{ b.sku }}</div></template><template v-else>-</template></td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatQty(t.qty_total) }}</td>
              <td style="padding:6px 8px;" class="gc-num"><template v-if="bahanEnrich[t.id]"><div v-for="b in bahanEnrich[t.id].bahan" :key="b.key">{{ formatQty(b.panjangPola) }}</div></template><template v-else>-</template></td>
              <td style="padding:6px 8px;" class="gc-num"><template v-if="bahanEnrich[t.id]"><div v-for="b in bahanEnrich[t.id].bahan" :key="b.key">{{ formatQty(b.isiPola) }}</div></template><template v-else>-</template></td>
              <td style="padding:6px 8px;" class="gc-num"><template v-if="bahanEnrich[t.id]"><div v-for="b in bahanEnrich[t.id].bahan" :key="b.key">{{ formatQty(b.amparan) }}</div></template><template v-else>-</template></td>
              <td style="padding:6px 8px;" class="gc-num"><template v-if="bahanEnrich[t.id]"><div v-for="b in bahanEnrich[t.id].bahan" :key="b.key">{{ formatQty(b.kebutuhanKain) }}</div></template><template v-else>-</template></td>
              <td style="padding:6px 8px;" class="gc-num"><template v-if="bahanEnrich[t.id]"><div v-for="b in bahanEnrich[t.id].bahan" :key="b.key" :style="{ color: gelarPenuh(t, b) ? 'var(--ok)' : '' }">{{ teksGelar(t, b) }}</div></template><template v-else>{{ t.entry_ampar_done || 0 }}</template></td>
              <td style="padding:6px 8px;">{{ (t.op_ampar && t.op_ampar.nama) || '-' }}</td>
              <td style="padding:6px 8px;"><span class="tag" :class="tertahan(t.masuk_tahap_pada) ? 'warn' : 'neutral'">{{ formatDiamSejak(t.masuk_tahap_pada) }}</span></td>
              <td style="padding:6px 8px;"><button v-if="bolehProses" @click="bukaMasalah(t)" class="btn-outline" style="padding:5px 9px; font-size:10.5px; color:var(--danger);" title="Scan Masalah"><i class="fas fa-triangle-exclamation"></i></button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <scan-terpadu-generik :c="entryAmpar" @tutup="muat" />
    <scan-terpadu-generik :c="selesaiAmpar" />

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:380px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Minta Kekurangan Bahan — {{ popupMasalah.track.kode_grouping_induk }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Bahan</label>
          <select v-model.number="popupMasalah.idx"><option v-for="(b,i) in popupMasalah.opsi" :key="b.kode_baris" :value="i">{{ teksOpsiBahan(b) }}</option></select>
        </div>
        <div class="gc-field" style="margin-bottom:4px;"><label>Jumlah Lembar Kurang</label><input v-model.number="popupMasalah.lembar" type="number" min="1" step="1"></div>
        <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:8px;">
          <template v-if="meterPerLembar(popupMasalah.opsi[popupMasalah.idx])">± {{ formatQty(meterPerLembar(popupMasalah.opsi[popupMasalah.idx])) }} m per lembar &rarr; diminta {{ formatQty(meterKurang(popupMasalah)) }} m</template>
          <template v-else>Kebutuhan kain label ini kosong — diminta dalam satuan lembar.</template>
        </div>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jenis Masalah</label><select v-model="popupMasalah.jenis"><option value="kurang">Kurang</option><option value="cacat">Cacat</option><option value="hilang">Hilang</option></select></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. kain habis di gulungan, cacat, dst"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};


// TAB 1.3: Sedang Pola Cetak Label Komponen (4x2in thermal, lihat keputusan §4
// komentar besar atas file) + Scan Entry per label (menandai
// status_pola='selesai').

const CuttingSedangPola = {
  components: { ScanTerpaduGenerik, PopupPratinjauCetakLabel },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const semuaLabel = ref([]);
    const bahanEnrich = ref({});
    const menuId = 'cut_cutting';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);
    const bolehOperator = ref(false); // diisi sesudah izinSiap: window.currentUser tidak reaktif

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

    // Cetak Label Komponen PER BAHAN: tombol baris membuka daftar bahan, satu
    // klik mencetak komponen bahan itu saja dengan kode_grouping bahannya.
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    const sedangCetak = ref(false);
    const pilihBahanCetak = ref(null); // { track, grup: [{ pola_key, nama_bahan, nama_pola, jumlah, sudah }] }
    function grupBahanCetak(rincian) {
      const peta = {};
      rincian.forEach(k => {
        const g = peta[k.pola_key] || (peta[k.pola_key] = { pola_key: k.pola_key, nama_bahan: k.nama_bahan, nama_pola: k.nama_pola, jumlah: 0, sudah: true });
        g.jumlah += Math.max(1, Math.round(k.jumlah_label || 0));
        if (!k.label_dicetak_pada) g.sudah = false;
      });
      return Object.values(peta);
    }
    async function cetakLabelKomponen(track) {
      sedangCetak.value = true;
      try {
        let rincian = track.komponen_rincian || [];
        const lengkap = lengkapiRincianPerBahan(track, await ambilPetaProdukBySku());
        if (lengkap) {
          await updateCuttingTrack(track.id, () => ({ komponen_rincian: lengkap }));
          rincian = lengkap;
        }
        if (!rincian.length) { alert('BOM Pola produk ini belum punya rincian Komponen — tidak ada label yang bisa dicetak.'); return; }
        pilihBahanCetak.value = { track: { ...track, komponen_rincian: rincian }, grup: grupBahanCetak(rincian) };
      } catch (e) { console.error('Gagal siapkan cetak label komponen:', e); alert('Gagal memuat rincian komponen. Coba lagi.'); }
      finally { sedangCetak.value = false; }
    }
    async function cetakLabelBahan(g) {
      const track = pilihBahanCetak.value.track;
      const belum = track.komponen_rincian.filter(k => k.pola_key === g.pola_key && !k.label_dicetak_pada);
      if (!belum.length) { cetakUlangLabelBahan(track, g); return; }
      const target = belum;
      sedangCetak.value = true;
      try {
        const preview = [];
        const semuaBahan = await barisBahanGrouping(track.grouping_id);
        const bahan = semuaBahan.find(b => (b.bahan_aksesoris_id || '') + '::' + (b.nama_pola || '') === g.pola_key) || semuaBahan[0];
        const dasar = (bahan && bahan.kode_grouping) || track.kode_grouping_induk;
        let urut = semuaLabel.value.filter(l => l.cutting_track_id === track.id && (l.kode || '').startsWith(dasar + '-')).length;
        for (const k of target) {
          const n = Math.max(1, Math.round(k.jumlah_label || 0));
          for (let i = 0; i < n; i++) {
            urut++;
            const kode = `${dasar}-${String(urut).padStart(2, '0')}`;
            await addDoc(collection(db, 'label_komponen'), {
              kode, cutting_track_id: track.id, grouping_id: track.grouping_id || '', nama_komponen: k.nama_komponen,
              pola_key: g.pola_key, nama_bahan: g.nama_bahan,
              status_pola: 'belum', status_cutting: 'belum', pola_pada: null, cutting_pada: null,
              dibuat_pada: serverTimestamp()
            });
            preview.push({ kode, nama: k.nama_komponen, info: `${g.nama_bahan} &middot; ${track.nama_produk} size ${track.size || '-'}`, qrDataUrl: buatQrDataUrl(kode) });
          }
        }
        const kini = new Date().toISOString();
        await updateCuttingTrack(track.id, (data) => ({
          komponen_rincian: (data.komponen_rincian || []).map(k => k.pola_key === g.pola_key && target.some(b => b.nama_komponen === k.nama_komponen) ? { ...k, label_dicetak_pada: kini } : k)
        }));
        pilihBahanCetak.value = null;
        daftarLabelPreview.value = preview;
        popupCetakAktif.value = true;
        await muat();
      } catch (e) { console.error('Gagal cetak label komponen:', e); alert('Gagal mencetak. Coba lagi.'); }
      sedangCetak.value = false;
    }

    // Cetak ulang = kode LAMA yang sama, tanpa dokumen baru. Label tanpa
    // pola_key (dicetak sebelum per bahan) dianggap milik bahan pertama.
    function cetakUlangLabelBahan(track, g) {
      const kunciPertama = (track.komponen_rincian[0] || {}).pola_key;
      const lama = semuaLabel.value
        .filter(l => l.cutting_track_id === track.id && (l.pola_key || kunciPertama) === g.pola_key)
        .sort((x, y) => (x.kode || '').localeCompare(y.kode || ''));
      if (!lama.length) { alert(`Label ${g.nama_bahan} tidak ditemukan untuk dicetak ulang.`); return; }
      daftarLabelPreview.value = lama.map(l => ({ kode: l.kode, nama: l.nama_komponen, info: `${g.nama_bahan} &middot; ${track.nama_produk} size ${track.size || '-'}`, qrDataUrl: buatQrDataUrl(l.kode) }));
      pilihBahanCetak.value = null;
      popupCetakAktif.value = true;
    }

    // Scan Entry per label komponen (status_pola -> selesai)
    const entryPola = buatEntryLabelKomponen({ judul: 'Scan Entry Pola', fieldStatus: 'status_pola', fieldPada: 'pola_pada', catatan: 'Entry Pola', semuaLabel });

    // Tandai Pola Selesai & Scan Operator Cutting
    const opCutting = buatScanOperator('Pola Selesai & Scan Operator Cutting', terapkanOperatorCutting);
    function bukaScanOperatorCutting(track) {
      const p = progres(track);
      if (p.total > 0 && p.done < p.total && !confirm(`Progress label baru ${p.done}/${p.total}. Lanjut ke Sedang Cutting sekarang?`)) return;
      opCutting.buka(track);
    }
    async function terapkanOperatorCutting(track, user) {
      await updateCuttingTrack(track.id, (data) => ({
        op_cutting: { uid: user.email, nama: user.nama, riwayat: [...((data.op_cutting && data.op_cutting.riwayat) || []), { uid: user.email, nama: user.nama, pada: new Date().toISOString() }] },
        status: 'sedang_cutting', masuk_tahap_pada: new Date().toISOString(),
        riwayat_scan: [...(data.riwayat_scan || []), { aksi: 'operator', oleh: pencatat(), pada: new Date().toISOString(), catatan: 'Pola Selesai & Scan Operator Cutting: ' + user.nama, qty: track.qty_total ?? null }]
      }));
      await muat();
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahCutting(p.track, p.jumlah, p.alasan, p.jenis);
      await muat();
    });

    // Toolbar global — Scan Entry & Scan Operator Cutting jadi toolbar. "Cetak
    // Label Komponen" TETAP per-baris (wireframe §1.3: tombol di baris SPK, isinya
    // beda tiap baris).

    const { pilihTarget, bukaPilihTarget, bukaPilihBahan, batalPilihTarget, konfirmasiPilihTarget } = pilihTargetMixin(daftar);
    function bukaScanEntryToolbar() { bukaPilihBahan('Pilih Bahan — Scan Entry Pola', (track, bahan) => entryPola.buka(track, bahan)); }
    function bukaScanOperatorCuttingToolbar() { bukaPilihTarget('Pilih SPK — Pola Selesai & Scan Operator Cutting', (track) => bukaScanOperatorCutting(track)); }

    onMounted(async () => { await window.authReady; await window.izinSiap; bolehOperator.value = picOwnerKeAtas(window.currentUser); await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, daftar, bahanEnrich, bolehProses, bolehCetak, bolehOperator, aksiAktif, sedangCetak, formatQty, formatDiamSejak, tertahan, progres,
      popupCetakAktif, daftarLabelPreview, cetakLabelKomponen, pilihBahanCetak, cetakLabelBahan,
      entryPola: entryPola.c, scanOpCutting: opCutting.c,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah,
      pilihTarget, batalPilihTarget, konfirmasiPilihTarget, bukaScanEntryToolbar, bukaScanOperatorCuttingToolbar
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <button v-if="bolehProses && aksiAktif('sub-pr-cutting-sedangpola','cutting_entry_pola')" @click="bukaScanEntryToolbar" class="btn-primary" style="flex:1; min-width:130px; padding:9px;"><i class="fas fa-check" style="margin-right:6px;"></i>Scan Entry</button>
        <button v-if="bolehOperator && aksiAktif('sub-pr-cutting-sedangpola','cutting_operator_cutting')" @click="bukaScanOperatorCuttingToolbar" class="btn-outline" style="flex:1; min-width:220px; padding:9px;"><i class="fas fa-user-check" style="margin-right:6px;"></i>Pola Selesai &amp; Scan Operator Cutting</button>
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
            <tr v-for="t in daftar" :key="t.id" style="border-bottom:1px solid var(--line); vertical-align:top;" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
              <td style="padding:6px 8px; font-weight:700;" class="gc-num">{{ t.kode_grouping_induk }}</td>
              <td style="padding:6px 8px;">{{ t.nama_produk }}<span v-if="t.size" style="color:var(--text-faint);"> ({{ t.size }})</span></td>
              <td style="padding:6px 8px; color:var(--text-faint);"><template v-if="bahanEnrich[t.id]"><div v-for="b in bahanEnrich[t.id].bahan" :key="b.key">{{ b.sku }}</div></template><template v-else>-</template></td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatQty(t.qty_total) }}</td>
              <td style="padding:6px 8px;" class="gc-num"><template v-if="bahanEnrich[t.id]"><div v-for="b in bahanEnrich[t.id].bahan" :key="b.key">{{ formatQty(b.isiPola) }}</div></template><template v-else>-</template></td>
              <td style="padding:6px 8px;" class="gc-num"><template v-if="bahanEnrich[t.id]"><div v-for="b in bahanEnrich[t.id].bahan" :key="b.key">{{ formatQty(b.kebutuhanKain) }}</div></template><template v-else>-</template></td>
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

    <div v-if="pilihBahanCetak" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:380px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 4px;">Cetak Label Komponen — {{ pilihBahanCetak.track.kode_grouping_induk }}</h3>
        <div style="font-size:11px; color:var(--text-faint); margin-bottom:10px;">Pilih bahan yang mau dicetak labelnya.</div>
        <div v-for="g in pilihBahanCetak.grup" :key="g.pola_key" style="display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--line);">
          <div style="flex:1; min-width:0;">
            <div style="font-size:12px; font-weight:700;">{{ g.nama_bahan }}</div>
            <div style="font-size:10.5px; color:var(--text-faint);">{{ g.nama_pola || '-' }} &middot; {{ g.jumlah }} label</div>
          </div>
          <span class="tag" :class="g.sudah ? 'ok' : 'neutral'">{{ g.sudah ? 'Sudah' : 'Belum' }}</span>
          <button @click="cetakLabelBahan(g)" :disabled="sedangCetak" :class="g.sudah ? 'btn-outline' : 'btn-primary'" style="padding:5px 10px; font-size:10.5px;"><i class="fas" :class="g.sudah ? 'fa-rotate-right' : 'fa-print'"></i> {{ g.sudah ? 'Cetak Ulang' : 'Cetak' }}</button>
        </div>
        <button @click="pilihBahanCetak = null" class="btn-outline" style="width:100%; padding:9px; margin-top:12px;">Tutup</button>
      </div>
    </div>
    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Label Komponen" :daftar-label="daftarLabelPreview" jenis-cetak="label_komponen_cutting" @tutup="popupCetakAktif = false" />
    <scan-terpadu-generik :c="entryPola" @tutup="muat" />
    <scan-terpadu-generik :c="scanOpCutting" />

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
        <div class="gc-field" style="margin-bottom:14px;"><label>{{ pilihTarget.labelPilih }}</label>
          <select v-model="pilihTarget.targetId"><option v-for="o in pilihTarget.opsi" :key="o.id" :value="o.id">{{ o.label }}</option></select>
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
  components: { ScanTerpaduGenerik },
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

    // Scan Entry per label komponen (status_cutting -> selesai)
    const entryCutting = buatEntryLabelKomponen({ judul: 'Scan Entry Cutting', fieldStatus: 'status_cutting', fieldPada: 'cutting_pada', catatan: 'Entry Cutting', semuaLabel });

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
    const { pilihTarget, bukaPilihTarget, bukaPilihBahan, batalPilihTarget, konfirmasiPilihTarget } = pilihTargetMixin(daftar);
    function bukaScanEntryToolbar() { bukaPilihBahan('Pilih Bahan — Scan Entry Cutting', (track, bahan) => entryCutting.buka(track, bahan)); }

    onMounted(async () => { await window.authReady; await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, daftar, bahanEnrich, bolehProses, aksiAktif, formatQty, formatDiamSejak, tertahan, progres,
      entryCutting: entryCutting.c, tandaiSelesaiCutting,
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
            <tr v-for="t in daftar" :key="t.id" style="border-bottom:1px solid var(--line); vertical-align:top;" :style="{ background: tertahan(t.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
              <td style="padding:6px 8px; font-weight:700;" class="gc-num">{{ t.kode_grouping_induk }}</td>
              <td style="padding:6px 8px;">{{ t.nama_produk }}<span v-if="t.size" style="color:var(--text-faint);"> ({{ t.size }})</span></td>
              <td style="padding:6px 8px; color:var(--text-faint);"><template v-if="bahanEnrich[t.id]"><div v-for="b in bahanEnrich[t.id].bahan" :key="b.key">{{ b.sku }}</div></template><template v-else>-</template></td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatQty(t.qty_total) }}</td>
              <td style="padding:6px 8px;" class="gc-num"><template v-if="bahanEnrich[t.id]"><div v-for="b in bahanEnrich[t.id].bahan" :key="b.key">{{ formatQty(b.kebutuhanKain) }}</div></template><template v-else>-</template></td>
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

    <scan-terpadu-generik :c="entryCutting" @tutup="muat" />

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
        <div class="gc-field" style="margin-bottom:14px;"><label>{{ pilihTarget.labelPilih }}</label>
          <select v-model="pilihTarget.targetId"><option v-for="o in pilihTarget.opsi" :key="o.id" :value="o.id">{{ o.label }}</option></select>
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
    const labelTab = ref([]); // label_komponen milik SPK di tab ini
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
        labelTab.value = await muatLabelUntukTrack(daftar.value.map(t => t.id));
      } catch (e) { console.error('Gagal muat Cutting > Perlu Di Kirim:', e); daftar.value = []; daftarBaggingAktif.value = []; daftarTlc.value = []; labelTab.value = []; }
      memuat.value = false;
    }

    // Cetak Surat Jalan + Kode Bagging: 1 bagging per BAHAN (pola_key, sama
    // pembagian label komponen), isinya wajib label bahan itu saja. SPK yang
    // sudah punya kode_tugas dicetak ulang dengan kode yang sama, tidak dibuat baru.
    function bahanSpk(track) {
      const peta = {};
      (track.komponen_rincian || []).forEach(k => {
        const key = k.pola_key || '';
        if (!peta[key]) peta[key] = { pola_key: key, nama_bahan: k.nama_bahan || '-', nama_pola: k.nama_pola || '', rencana: 0 };
        peta[key].rencana += parseFloat(k.jumlah_label) || 0;
      });
      return Object.values(peta);
    }
    function labelBahanDiTab(trackId, polaKey) {
      const track = daftar.value.find(t => t.id === trackId);
      if (!track) return [];
      return labelTab.value.filter(l => l.cutting_track_id === trackId && (!polaKey || labelMilikBahan(l, track, { pola_key: polaKey })));
    }
    function targetBagging(bagging) {
      const n = labelBahanDiTab(bagging.cutting_track_id, bagging.pola_key).length;
      return n || parseFloat(bagging.jumlah_target) || 0;
    }
    function namaBahanBagging(b) { return b.nama_bahan + (b.nama_pola ? ' (' + b.nama_pola + ')' : ''); }

    const popupKirim = ref(null); // { track, tujuanAkhir, tlcTujuan }
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    async function bukaCetakKirim(track) {
      if (track.kode_tugas) { await cetakUlangKirim(track); return; }
      if (!daftarTlc.value.length) { alert('Belum ada data TLC (Titik Lokasi Cerdas). Tambah dulu di Zevanic House > TLC & Prefix.'); return; }
      popupKirim.value = { track, tujuanAkhir: 'Sewing', tlcTujuan: daftarTlc.value[0].kode };
    }
    async function cetakUlangKirim(track) {
      try {
        const kodeList = track.kode_bagging || [];
        const snaps = await Promise.all(kodeList.map(k => getDocs(query(collection(db, 'bagging'), where('kode', '==', k)))));
        const preview = snaps.filter(sn => !sn.empty).map(sn => {
          const d = sn.docs[0].data();
          return { kode: d.kode, nama: d.nama_bahan ? namaBahanBagging(d) : (d.produk_label || '').split('&middot;').pop().trim(), info: `Kode Bagging &middot; ${track.kode_grouping_induk}${d.jumlah_target ? ' &middot; ' + d.jumlah_target + ' label' : ''}`, qrDataUrl: buatQrDataUrl(d.kode) };
        });
        preview.push({ kode: track.kode_tugas, nama: 'Surat Jalan (Kode Tugas)', info: `Tujuan: ${track.tujuan_akhir || '-'} &middot; TLC-PTG`, qrDataUrl: buatQrDataUrl(track.kode_tugas) });
        daftarLabelPreview.value = preview;
        popupCetakAktif.value = true;
      } catch (e) { console.error('Gagal cetak ulang surat jalan:', e); alert('Gagal memuat kode lama. Coba lagi.'); }
    }
    async function konfirmasiCetakKirim() {
      const p = popupKirim.value;
      const track = p.track;
      const daftarBahan = bahanSpk(track);
      if (!daftarBahan.length) { alert('Grouping ini belum punya rincian komponen (BOM Pola kosong) — bagging per bahan tidak bisa dibuat.'); return; }
      sedangProses.value = true;
      try {
        const preview = [];
        const kodeBaggingBaru = [];
        for (const g of daftarBahan) {
          const kode = await generateKodeHarian('BAG', 'pengaturan_id_bagging');
          const target = labelBahanDiTab(track.id, g.pola_key).length || g.rencana;
          await addDoc(collection(db, 'bagging'), {
            kode, produk_label: `${track.kode_grouping_induk} &middot; ${namaBahanBagging(g)}`, isi: [], ditutup_pada: null,
            kode_grouping_induk: track.kode_grouping_induk || null, kode_separating: null,
            cutting_track_id: track.id, pola_key: g.pola_key, nama_bahan: g.nama_bahan, nama_pola: g.nama_pola, jumlah_target: target,
            dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
          });
          kodeBaggingBaru.push(kode);
          preview.push({ kode, nama: namaBahanBagging(g), info: `Kode Bagging &middot; ${track.kode_grouping_induk} &middot; ${target} label`, qrDataUrl: buatQrDataUrl(kode) });
        }
        const kodeTugas = await generateKodeHarian('TGS', 'pengaturan_id_tugas_kirim');
        // pack[] diisi saat cetak supaya Scan Sampai Serie bisa melepasnya; Scan
        // Kirim tidak menambah entri untuk kode yang sudah ada di sini.
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

    // baggingWajibTugas — bagging yang dicetak bersama surat jalan ini (pack[] diisi
    // saat cetak). Kode yatim di cutting_track.kode_bagging (dokumennya sudah
    // dihapus / dari cetakan lama) tidak ikut menahan perpindahan status.
    function baggingWajibTugas(tugas, track) {
      const diTugas = (tugas.pack || []).map(p => p.kode_bagging);
      const milikSpk = new Set(track.kode_bagging || []);
      const wajib = diTugas.filter(kb => milikSpk.has(kb));
      return wajib.length ? [...new Set(wajib)] : (track.kode_bagging || []);
    }
    // baggingSpk — bagging per bahan milik SPK (yang masih terbuka), untuk tag progres kartu.
    function baggingSpk(t) { return daftarBaggingAktif.value.filter(bg => bg.cutting_track_id === t.id); }
    // Scan Pack: kunci bagging, lalu label komponen. Bagging per bahan (punya
    // cutting_track_id) cuma menerima label SPK + bahan yang sama, sudah Entry
    // Cutting, dan belum ada di bagging lain. Bagging lama per komponen tetap
    // menerima label apa pun yang sudah dicetak, kecuali yang sudah di-pack.
    function labelKunciPack(b) {
      if (!b.cutting_track_id) return b.kode;
      return `${b.kode} · ${namaBahanBagging(b)} · ${(b.isi || []).length}/${targetBagging(b)} label`;
    }
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
          if (b.cutting_track_id && !daftar.value.some(t => t.id === b.cutting_track_id)) return { ok: false, pesan: `SPK bagging ${kode} tidak ada di Perlu Di Kirim.` };
          return { ok: true, data: b, label: labelKunciPack(b) };
        },
        tetapKunci: true
      },
      aksiEkstra: [{ label: 'Tutup Bagging Ini', aksi: async (bagging) => {
        if (!bagging) return;
        try { await updateDoc(doc(db, 'bagging', bagging.id), { ditutup_pada: serverTimestamp() }); packTerpadu.tutup(); await muat(); }
        catch (e) { console.error('Gagal tutup bagging:', e); alert('Gagal menutup bagging. Coba lagi.'); }
      } }],
      validasiIsi: async (kode, bagging, rows) => {
        try {
          const snap = await getDocs(query(collection(db, 'label_komponen'), where('kode', '==', kode)));
          if (snap.empty) return { ok: false, pesan: `Kode "${kode}" bukan label komponen yang dikenali.` };
          const l = snap.docs[0].data();
          const lain = await getDocs(query(collection(db, 'bagging'), where('isi', 'array-contains', kode)));
          if (!lain.empty) return { ok: false, pesan: `${kode} sudah masuk bagging ${lain.docs[0].data().kode}.` };
          if (bagging.cutting_track_id) {
            const track = daftar.value.find(t => t.id === bagging.cutting_track_id);
            if (l.cutting_track_id !== bagging.cutting_track_id) return { ok: false, pesan: `${kode} bukan milik SPK ${track ? track.kode_grouping_induk : 'bagging ini'}.` };
            if (bagging.pola_key && !labelMilikBahan(l, track, { pola_key: bagging.pola_key })) return { ok: false, pesan: `${kode} (${l.nama_komponen}) bahan ${l.nama_bahan || '-'} — bukan bahan bagging ini (${namaBahanBagging(bagging)}).` };
            if (l.status_cutting !== 'selesai') return { ok: false, pesan: `${kode} belum di-Scan Entry Cutting.` };
            const n = (bagging.isi || []).length + rows.length + 1;
            const target = targetBagging(bagging);
            if (target && n > target) return { ok: false, pesan: `Bagging ${namaBahanBagging(bagging)} sudah penuh (${target}/${target}).` };
            return { ok: true, row: { kode, label: l.nama_komponen || '-', tagTxt: `${n}/${target}`, tagCls: 'ok', _cuttingTrackId: l.cutting_track_id } };
          }
          return { ok: true, row: { kode, label: l.nama_komponen || '-', qty: '1', tagTxt: 'sudah dicetak', tagCls: 'ok', _cuttingTrackId: l.cutting_track_id || null } };
        } catch (e) { console.error('Gagal cari label komponen (pack):', e); return { ok: false, pesan: 'Gagal mencari. Coba lagi.' }; }
      },
      padaUpload: async (rows, bagging) => {
        try {
          await updateDoc(doc(db, 'bagging', bagging.id), { isi: arrayUnion(...rows.map(r => r.kode)) });
          bagging.isi = [...(bagging.isi || []), ...rows.map(r => r.kode)];
          // riwayat_scan ADITIF, digrup per cutting_track supaya 1 track cuma
          // kena 1x update walau beberapa labelnya discan dalam draft yang sama.
          const perTrack = {};
          rows.forEach(r => { if (r._cuttingTrackId) (perTrack[r._cuttingTrackId] = perTrack[r._cuttingTrackId] || []).push(r.kode); });
          for (const [trackId, kodeList] of Object.entries(perTrack)) {
            await updateCuttingTrack(trackId, (data) => ({
              riwayat_scan: [...(data.riwayat_scan || []), ...kodeList.map(k => ({ aksi: 'pack', oleh: window.currentUser?.email || null, pada: new Date().toISOString(), catatan: `Label ${k} -> bagging ${bagging.kode}`, qty: null }))]
            }));
          }
          return { ok: true, lockedLabel: labelKunciPack(bagging) };
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
            const sisa = baggingWajibTugas(tugas, track).filter(kb => !(tugas.dimuat || []).includes(kb)).length;
            return { ok: true, data: { tugas, track }, label: `${kode} · SPK ${track.kode_grouping_induk} · ${sisa} bagging belum dimuat` };
          } catch (e) { console.error('Gagal cari kode tugas:', e); return { ok: false, pesan: 'Gagal mencari kode tugas. Coba lagi.' }; }
        }
      },
      // Bagging per bahan wajib penuh (isi = jumlah label bahan itu); bagging
      // lama per komponen cukup tidak kosong.
      validasiIsi: async (kode, locked) => {
        if (!(locked.track.kode_bagging || []).includes(kode)) return { ok: false, pesan: `Kode bagging "${kode}" tidak cocok dengan tugas ini.` };
        try {
          const snap = await getDocs(query(collection(db, 'bagging'), where('kode', '==', kode)));
          if (snap.empty) return { ok: false, pesan: `Kode bagging "${kode}" tidak ditemukan.` };
          const bg = snap.docs[0].data();
          const isi = (bg.isi || []).length;
          if (bg.cutting_track_id) {
            const target = targetBagging(bg);
            if (isi < target) return { ok: false, pesan: `Bagging ${namaBahanBagging(bg)} baru ${isi}/${target} label — Scan Pack dulu sampai penuh.` };
            return { ok: true, row: { kode, label: namaBahanBagging(bg), tagTxt: `${isi}/${target}`, tagCls: 'ok' } };
          }
          if (!isi) return { ok: false, pesan: `Bagging ${kode} masih kosong — Scan Pack dulu.` };
          return { ok: true, row: { kode, label: 'Bagging -> ' + locked.track.kode_grouping_induk, qty: isi + ' label', tagTxt: 'cocok', tagCls: 'ok' } };
        } catch (e) { console.error('Gagal cek bagging (kirim):', e); return { ok: false, pesan: 'Gagal mencari. Coba lagi.' }; }
      },
      padaUpload: async (rows, locked) => {
        try {
          const { tugas, track } = locked;
          const sudahDiTugas = new Set((tugas.pack || []).map(p => p.kode_bagging));
          const baru = rows.filter(r => !sudahDiTugas.has(r.kode));
          if (baru.length) await updateDoc(doc(db, 'tugas_kirim', tugas.id), { pack: arrayUnion(...baru.map(r => ({ kode_bagging: r.kode, pada: new Date().toISOString() }))) });
          const dimuat = new Set([...(tugas.dimuat || []), ...rows.map(r => r.kode)]);
          await updateDoc(doc(db, 'tugas_kirim', tugas.id), { dimuat: [...dimuat] });
          const tugasSnap = await getDoc(doc(db, 'tugas_kirim', tugas.id));
          const sisa = baggingWajibTugas(tugasSnap.data(), track).filter(kb => !(tugasSnap.data().dimuat || []).includes(kb));
          const semuaSudah = sisa.length === 0;
          const now = new Date().toISOString();
          // riwayat_scan ADITIF, digabung 1 transaksi dengan transisi status
          // supaya cutting_track cuma kena 1x update walau banyak baris draft.
          await updateCuttingTrack(track.id, (data) => ({
            ...(semuaSudah ? { status: 'sedang_dikirim', masuk_tahap_pada: now, tlc_tujuan: tugas.tlc_tujuan || '' } : {}),
            riwayat_scan: [...(data.riwayat_scan || []), ...rows.map(r => ({ aksi: 'kirim', oleh: window.currentUser?.email || null, pada: now, catatan: `Bagging ${r.kode} -> tugas ${tugas.kode} (tujuan ${tugas.tlc_tujuan || '-'})`, qty: track.qty_total ?? null }))]
          }));
          await muat();
          alert(semuaSudah ? `Semua bagging SPK ${track.kode_grouping_induk} sudah dimuat — pindah ke Sedang Di Kirim.` : `Tersimpan. Masih ${sisa.length} bagging belum discan: ${sisa.join(', ')}`);
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
      popupKirim, bukaCetakKirim, konfirmasiCetakKirim, popupCetakAktif, daftarLabelPreview, baggingSpk, targetBagging, namaBahanBagging,
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
          <div v-if="baggingSpk(t).length" style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
            <span v-for="bg in baggingSpk(t)" :key="bg.kode" class="tag" :class="(bg.isi || []).length >= targetBagging(bg) ? 'ok' : 'warn'">{{ namaBahanBagging(bg) }} {{ (bg.isi || []).length }}/{{ targetBagging(bg) }}</span>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button v-if="bolehCetak" @click="bukaCetakKirim(t)" class="btn-outline" style="flex:1; min-width:170px; padding:8px; font-size:11.5px;"><i class="fas fa-print" style="margin-right:4px;"></i>{{ t.kode_tugas ? 'Cetak Ulang Surat Jalan + Bagging' : 'Cetak Surat Jalan + Kode Bagging' }}</button>
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

    <scan-terpadu-generik :c="packTerpadu" @tutup="muat" />
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
window.bukaCuttingOperatorAmpar = function () { window.pastikanMountCuttingPerluDiProses(); if (vmCuttingPerluDiProses) vmCuttingPerluDiProses.bukaScanOperatorAmparToolbar(); };
let vmCuttingSedangAmpar = null;
window.pastikanMountCuttingSedangAmpar = function () {
  if (vmCuttingSedangAmpar) { if (typeof vmCuttingSedangAmpar.muat === 'function') vmCuttingSedangAmpar.muat(); return; }
  const mountPoint = document.getElementById('vue-cutting-sedangampar');
  if (mountPoint) vmCuttingSedangAmpar = createApp(CuttingSedangAmpar).mount('#vue-cutting-sedangampar');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaCuttingEntryAmpar = function () { window.pastikanMountCuttingSedangAmpar(); if (vmCuttingSedangAmpar) vmCuttingSedangAmpar.bukaScanEntryToolbar(); };
window.bukaCuttingOperatorPola = function () { window.pastikanMountCuttingSedangAmpar(); if (vmCuttingSedangAmpar) vmCuttingSedangAmpar.bukaScanOperatorPolaToolbar(); };
let vmCuttingSedangPola = null;
window.pastikanMountCuttingSedangPola = function () {
  if (vmCuttingSedangPola) { if (typeof vmCuttingSedangPola.muat === 'function') vmCuttingSedangPola.muat(); return; }
  const mountPoint = document.getElementById('vue-cutting-sedangpola');
  if (mountPoint) vmCuttingSedangPola = createApp(CuttingSedangPola).mount('#vue-cutting-sedangpola');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaCuttingEntryPola = function () { window.pastikanMountCuttingSedangPola(); if (vmCuttingSedangPola) vmCuttingSedangPola.bukaScanEntryToolbar(); };
window.bukaCuttingOperatorCutting = function () { window.pastikanMountCuttingSedangPola(); if (vmCuttingSedangPola) vmCuttingSedangPola.bukaScanOperatorCuttingToolbar(); };
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
