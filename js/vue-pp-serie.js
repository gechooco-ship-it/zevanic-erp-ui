// js/vue-pp-serie.js
// Collection > Pengumpulan + Serie — hub: bahan dari Persiapan dikirim ke
// Cutting, potongan + kit SEW/WEB jadi Serie Sewing, hasil Sewing + kit FIN
// jadi Serie Finishing, lalu Kirim Gudang.
//
// Koleksi & field:
// - spk_separating: status perlu_disiapkan → sedang_diproses → perlu_dikirim →
//   kirim_sewing → terima_sewing → kirim_finishing → terima_finishing →
//   kirim_gudang → selesai (ditulis Gudang). komponen_rincian[] dibuat saat
//   Mulai Serie; fin_terpasang_pada saat semua label_pcs dapat ACC finishing.
// - spk_track.bahan_rincian[]: sampai_pada (tiba di Collection),
//   kirim_cutting_pada + kode_tugas_cutting (Scan Kirim ke Cutting).
// - label_pcs.acc_finishing_pada + kode_kit_finishing (Serie Finishing).
//
// Jebakan:
// - TLC Collection tetap 'TLC-SER' (dipakai Sewing/Finishing/Config).
// - Kit ACC dikenali dari kode_kit berakhiran -SEW/-WEB/-FIN; kit yang
//   tertukar jalur ditolak saat scan.
// - Kirim Finishing ditolak selama kit -FIN ada tapi fin_terpasang_pada kosong.

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel } from './vue-components.js?v=13';
import { ScanGenerik, ScanTerpaduGenerik, buatScanTerpadu, PopupPinGenerik, buatQrDataUrl, ajukanPersiapanMasalah } from './vue-scan-cetak.js?v=13';
import { aksiAktif, pastikanCachePilihanScan } from './vue-popup-scan.js?v=7';

// Format & hitung kecil (disalin pola dari Cutting/4 pos Persiapan Produksi,
// belum ada infrastruktur util generik lintas file).
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
// generateKodeHarianFormat — mengembalikan STRING terformat penuh
// (`${prefix}${tanggalKey}-${counter 3 digit}`), beda dari generateKodeHarian di
// file ini yang mengembalikan angka counter mentah. Dipakai tab 2.3/2.4/2.7/2.10
// untuk kode bagging & kode tugas berformat standar app (BAG../TGS..).
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
// saringMilikOperator — operator hanya lihat baris yang ditugaskan ke dirinya
// (lewat Tunjuk Operator); role lain lihat semua baris. Gerbang TAMPILAN,
// terpisah dari picOwnerKeAtas yang cuma menggerbang tombol aksi.
function saringMilikOperator(barisList) {
  if ((window.currentUser?.role || '').toLowerCase() !== 'operator') return barisList;
  return barisList.filter(b => b.operator_uid && b.operator_uid === window.currentUser?.email);
}
const TLC_ASAL_SERIE = 'TLC-SER'; // TLC Collection (nama lama Serie dipertahankan supaya tugas lama tetap cocok)
const TLC_TUJUAN_SEWING = 'TLC-JHT';
const TLC_TUJUAN_FINISHING = 'TLC-FIN';
const TLC_TUJUAN_GUDANG = 'TLC-GBJ';
const JALUR_ACC = ['sewing', 'webbing', 'finishing'];

// Baca koleksi mentah
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
  const snap = await getDocs(collection(db, 'spk_separating'));
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
// resolveWarnaGrouping — ambil SKU pertama grouping -> master_produk.warna lewat
// ambilPetaProdukBySku. Return '' kalau tidak bisa diresolve (SKU kosong/produk
// tidak ketemu); keputusannya di pemanggil — bukaGenerate MELEWATI filter warna
// saat resolve gagal, bukan mengosongkan daftar calon.
function resolveWarnaGrouping(g, petaProduk) {
  const sku = (g.sku_produk_terlibat || [])[0];
  const p = sku ? petaProduk[sku] : null;
  return ((p && p.warna) || '').trim();
}
// updateSeparatingBatch — read-modify-write ATOMIK, pola sama seperti
// updateCuttingTrack/updateBarisBahan di modul lain.
async function updateSeparatingBatch(batchId, mutator) {
  const ref = doc(db, 'spk_separating', batchId);
  await runTransaction(db, async (trx) => {
    const snap = await trx.get(ref);
    if (!snap.exists()) throw new Error('Dokumen spk_separating tidak ditemukan.');
    const data = snap.data();
    const patch = mutator(data) || {};
    trx.update(ref, { ...patch, diperbarui_pada: serverTimestamp() });
  });
}

// Popup Scan Masalah generik (jumlah kurang + alasan) — disalin pola sama
// seperti Cutting (popupMasalahMixin), sumberJalur:'serie'.
function popupMasalahMixin(kirimFn) {
  const popupMasalah = ref(null);
  function bukaMasalah(target) { popupMasalah.value = { target, jumlah: target.qty || 0, alasan: '', jenis: 'kurang' }; }
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
async function kirimMasalahSerie(batch, jumlah, alasan, jenis) {
  await ajukanPersiapanMasalah({
    tlcAsal: TLC_ASAL_SERIE, sumberJalur: 'serie',
    trackId: batch.id, noSpk: batch.kode_separating,
    bahanNama: batch.nama_produk, bahanWarna: batch.size, satuan: 'pcs',
    qtyKurang: jumlah, alasan, jenisMasalah: jenis || 'kurang', kodeLabelAsal: batch.kode_separating || '',
    separatingId: batch.id || '', kodeSeparating: batch.kode_separating || '', idOrder: batch.id_order || ''
  });
  // riwayat_scan aksi 'masalah' — dicatat ADITIF di samping
  // persiapan_masalah (yang sudah ada dan TIDAK diubah) supaya riwayat_scan
  // tetap jadi 1 log lengkap per batch.
  try {
    const oleh = window.currentUser?.email || null;
    await updateSeparatingBatch(batch.id, (data) => ({
      catatan_masalah: alasan || data.catatan_masalah || '',
      riwayat_scan: [...(data.riwayat_scan || []), { aksi: 'masalah', oleh, pada: new Date().toISOString(), catatan: alasan, qty: jumlah }]
    }));
  } catch (e) { console.error('Gagal catat riwayat_scan masalah Serie:', e); }
}


// TAB Collection › Perlu Diterima (+ Kirim ke Cutting, Serie Sewing)

// sumberSeparating — kelengkapan bahan per Kode Separating untuk Serie Sewing,
// dihitung LIVE: potongan dari Cutting (cutting_track grouping-nya sudah
// Sampai di Collection) + kit -SEW/-WEB separating itu (semua baris sampai).
// Kit -FIN tidak ikut syarat; dipasang nanti di Serie Finishing.
function sumberSeparating(sep, cuttingList, spkTrackByJalur) {
  const hasil = {};
  const jalur = Array.isArray(sep.jalur_aktif) ? sep.jalur_aktif : [];
  if (jalur.includes('bahan')) {
    const ct = cuttingList.find(c => sep.grouping_id && c.grouping_id === sep.grouping_id);
    hasil.cutting = { komplit: !!ct && ct.status === 'selesai', ref: ct || null,
      baris: (ct?.komponen_rincian || []).map(k => ({ nama: k.nama_komponen, qty: k.jumlah_label || 0, ok: !!ct && ct.status === 'selesai' })) };
  }
  ['sewing', 'webbing', 'finishing'].forEach(j => {
    if (!jalur.includes(j)) return;
    const t = (spkTrackByJalur[j] || []).find(x => x.separating_id === sep.id);
    const rows = t ? (t[j + '_rincian'] || []) : [];
    hasil[j] = { komplit: rows.length > 0 && rows.every(b => !!b.sampai_pada), ref: t || null, wajib: j !== 'finishing',
      baris: rows.map(b => ({ nama: b.nama_aksesoris || '(tanpa nama)', qty: b.qty || 0, ok: !!b.sampai_pada })) };
  });
  return hasil;
}
function bisaMulaiSerie(sumber) {
  const wajib = Object.entries(sumber).filter(([k, v]) => k === 'cutting' || v.wajib);
  return wajib.length > 0 && wajib.every(([, v]) => v.komplit);
}

const SeriePerluDiProses = {
  components: { ScanGenerik, ScanTerpaduGenerik, PopupPinGenerik, PopupPratinjauCetakLabel },
  setup() {
    const memuat = ref(true);
    const daftarSep = ref([]);
    const cuttingList = ref([]);
    const groupingList = ref([]);
    const trackBahan = ref([]);
    const daftarTlc = ref([]);
    const spkTrackByJalur = reactive({ sewing: [], webbing: [], finishing: [] });
    const menuId = 'proses_serie';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehOperator = computed(() => picOwnerKeAtas(window.currentUser));

    async function muat() {
      memuat.value = true;
      try {
        const [grouping, ct, sew, web, fin, sep, bhn, tlcSnap] = await Promise.all([
          muatSemuaGrouping(), muatSemuaCuttingTrack(),
          muatSpkTrackJalur('sewing'), muatSpkTrackJalur('webbing'), muatSpkTrackJalur('finishing'),
          muatSemuaSeparatingBatch(), muatSpkTrackJalur('bahan'), getDocs(collection(db, 'master_tlc'))
        ]);
        groupingList.value = grouping; cuttingList.value = ct; trackBahan.value = bhn;
        daftarTlc.value = tlcSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        spkTrackByJalur.sewing = sew; spkTrackByJalur.webbing = web; spkTrackByJalur.finishing = fin;
        daftarSep.value = sep.filter(s => s.status === 'perlu_disiapkan' || s.status === 'disiapkan');
      } catch (e) { console.error('Gagal muat Collection > Perlu Diterima:', e); daftarSep.value = []; }
      memuat.value = false;
    }
    function sumber(sep) { return sumberSeparating(sep, cuttingList.value, spkTrackByJalur); }
    function bisaMulai(sep) { return bisaMulaiSerie(sumber(sep)); }
    const expandedIds = ref(new Set());
    function toggleExpand(id) { const s = new Set(expandedIds.value); if (s.has(id)) s.delete(id); else s.add(id); expandedIds.value = s; }
    const LABEL_SUMBER = { cutting: 'Potongan Cutting', sewing: 'Kit ACC Sewing', webbing: 'Kit ACC Webbing', finishing: 'Kit ACC Finishing (untuk Serie Finishing)' };

    // Scan Sampai — bagging yang tiba di Collection dari Persiapan Bahan (label
    // bahan, menutup Persiapan Bahan), Cutting, atau kit ACC. Bagging bahan TIDAK
    // di-Unpack di sini: diteruskan utuh ke Cutting lewat Kirim ke Cutting.
    async function lepasPackTugasKirim(kode, now) {
      try {
        const snapTugas = await getDocs(query(collection(db, 'tugas_kirim'), where('tlc_tujuan', '==', TLC_ASAL_SERIE)));
        for (const d of snapTugas.docs) {
          const packArr = Array.isArray(d.data().pack) ? d.data().pack : [];
          const idx = packArr.findIndex(p => p.kode_bagging === kode && !p.sampai_pada);
          if (idx < 0) continue;
          const packBaru = packArr.slice();
          packBaru[idx] = { ...packBaru[idx], sampai_pada: now };
          await updateDoc(doc(db, 'tugas_kirim', d.id), { pack: packBaru });
          return;
        }
      } catch (e) { console.error('Gagal lepas pack tugas_kirim (Collection):', e); }
    }
    const modalSampai = reactive({ aktif: false, log: [] });
    function bukaScanSampai() { modalSampai.log = []; modalSampai.aktif = true; }
    function tutupScanSampai() { modalSampai.aktif = false; modalSampai.log = []; muat(); }
    async function hasilScanSampai(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      const now = new Date().toISOString();
      try {
        const snapCt = await getDocs(query(collection(db, 'cutting_track'), where('kode_bagging', 'array-contains', kode)));
        if (!snapCt.empty) {
          const d = snapCt.docs[0];
          if (d.data().status === 'selesai') { alert(`Bagging "${kode}" sudah pernah di-Scan Sampai sebelumnya.`); return; }
          await updateDoc(doc(db, 'cutting_track', d.id), { status: 'selesai', sampai_pada: now, diperbarui_pada: serverTimestamp() });
          await lepasPackTugasKirim(kode, now);
          modalSampai.log.unshift(kode + ' -> potongan Cutting diterima');
          await muat(); return;
        }
        for (const jalur of ['bahan', 'sewing', 'webbing', 'finishing']) {
          const snapTrack = await getDocs(query(collection(db, 'spk_track'), where('jalur', '==', jalur)));
          let kena = 0;
          for (const d of snapTrack.docs) {
            const key = jalur + '_rincian';
            const baris = Array.isArray(d.data()[key]) ? d.data()[key] : [];
            if (!baris.some(b => b.kode_bagging === kode && !b.sampai_pada)) continue;
            const barisBaru = baris.map(b => (b.kode_bagging === kode && !b.sampai_pada) ? { ...b, sampai_pada: now } : b);
            await updateDoc(doc(db, 'spk_track', d.id), { [key]: barisBaru, diperbarui_pada: serverTimestamp() });
            kena++;
          }
          if (kena) {
            await lepasPackTugasKirim(kode, now);
            modalSampai.log.unshift(kode + (jalur === 'bahan' ? ' -> label bahan diterima, teruskan ke Cutting' : ' -> kit ACC ' + jalur + ' diterima'));
            await muat(); return;
          }
        }
        alert(`Kode bagging "${kode}" tidak ditemukan / sudah pernah di-Scan Sampai.`);
      } catch (e) { console.error('Gagal scan sampai Collection:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    // Scan Unpack — kit ACC dan potongan Cutting; isi dicocokkan ke bagging.isi.
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
        if (hilang.length || asingList.length) return { ok: false, pesan: `Belum lengkap: ${dicocokkan.length}/${isi.length} cocok` + (asingList.length ? `, ${asingList.length} asing` : '') + '. Scan sisanya, atau pakai "Paksa INKOMPLIT" lalu Scan Masalah jenis hilang.' };
        return tulisTutupUnpack(locked, dicocokkan, asingList, hilang, true);
      },
      aksiEkstra: [{
        label: 'Paksa INKOMPLIT',
        aksi: async (locked) => {
          if (locked.unpack_hasil) { alert('Bagging ini sudah ditutup.'); return; }
          if (!confirm(`Tutup bagging "${locked.kode}" sebagai INKOMPLIT? Kode yang belum cocok dicatat hilang; ajukan lewat Scan Masalah.`)) return;
          const isi = Array.isArray(locked.isi) ? locked.isi : [];
          const dicocokkan = unpackTerpadu.s.rows.filter(r => !r.asing).map(r => r.kode);
          const asingList = unpackTerpadu.s.rows.filter(r => r.asing).map(r => r.kode);
          const hilang = isi.filter(k => !dicocokkan.includes(k));
          const hasil = await tulisTutupUnpack(locked, dicocokkan, asingList, hilang, false);
          if (hasil.ok) unpackTerpadu.resetLock(); else alert(hasil.pesan);
        }
      }]
    });

    // Kirim ke Cutting — label bahan satu grouping yang SEMUA sudah Sampai di
    // Collection diteruskan dengan Kode Tugas baru; baris bahan dapat
    // kirim_cutting_pada (gerbang cutting_track dibuat).
    const groupingSiapCutting = computed(() => {
      const peta = {};
      trackBahan.value.forEach(t => {
        const rows = t.bahan_rincian || [];
        if (!rows.length || !rows.every(b => !!b.sampai_pada) || rows.every(b => !!b.kirim_cutting_pada)) return;
        peta[t.grouping_id] = { groupingId: t.grouping_id, kode: t.kode_grouping_induk, nama: t.nama_produk, bagging: Array.from(new Set(rows.map(b => b.kode_bagging).filter(Boolean))) };
      });
      return Object.values(peta);
    });
    const popupTugasCutting = ref(null);
    const popupCetakTugas = ref(false);
    const daftarLabelTugas = ref([]);
    function bukaTugasCutting() {
      const opsi = daftarTlc.value.filter(t => (t.kode || '').startsWith('TLC-PTG'));
      popupTugasCutting.value = { tlcTujuan: (opsi[0] || daftarTlc.value[0] || {}).kode || 'TLC-PTG-01' };
    }
    async function konfirmasiTugasCutting() {
      const p = popupTugasCutting.value; if (!p) return;
      try {
        const kode = await generateKodeHarianFormat('TGS', 'pengaturan_id_tugas_kirim');
        await addDoc(collection(db, 'tugas_kirim'), { kode, tlc_asal: TLC_ASAL_SERIE, tlc_tujuan: p.tlcTujuan, pack: [], dibuat_oleh: window.currentUser?.email || null, dibuat_pada: serverTimestamp() });
        daftarLabelTugas.value = [{ kode, nama: 'Kode Tugas Kirim', info: `${TLC_ASAL_SERIE} &rarr; ${p.tlcTujuan}`, qrDataUrl: buatQrDataUrl(kode) }];
        popupTugasCutting.value = null; popupCetakTugas.value = true;
      } catch (e) { console.error('Gagal buat Kode Tugas ke Cutting:', e); alert('Gagal membuat Kode Tugas. Coba lagi.'); }
    }
    const kirimCuttingTerpadu = buatScanTerpadu({
      judul: 'Scan Kirim — ke Cutting', subjudul: 'Muat bagging label bahan ke satu tugas kirim',
      twoStep: {
        labelPertama: 'Kode Tugas', labelKedua: 'Kode Bagging',
        validasi: async (kode) => {
          const snap = await getDocs(query(collection(db, 'tugas_kirim'), where('kode', '==', kode)));
          if (snap.empty) return { ok: false, pesan: `Kode tugas "${kode}" tidak ditemukan.` };
          return { ok: true, data: { id: snap.docs[0].id, ...snap.docs[0].data() } };
        }
      },
      validasiIsi: async (kode) => {
        const g = groupingSiapCutting.value.find(x => x.bagging.includes(kode));
        if (!g) return { ok: false, pesan: `Bagging "${kode}" bukan label bahan grouping yang sudah lengkap di Collection.` };
        return { ok: true, row: { kode, label: g.kode + ' · ' + g.nama, tagTxt: 'siap', tagCls: 'ok', _groupingId: g.groupingId } };
      },
      padaUpload: async (rows, tugas) => {
        try {
          const now = new Date().toISOString();
          const kodeSet = new Set(rows.map(r => r.kode));
          for (const t of trackBahan.value.filter(x => rows.some(r => r._groupingId === x.grouping_id))) {
            const arr = (t.bahan_rincian || []).map(b => kodeSet.has(b.kode_bagging) ? { ...b, kirim_cutting_pada: now, kode_tugas_cutting: tugas.kode } : b);
            await updateDoc(doc(db, 'spk_track', t.id), { bahan_rincian: arr, diperbarui_pada: serverTimestamp() });
          }
          await updateDoc(doc(db, 'tugas_kirim', tugas.id), { pack: arrayUnion(...rows.map(r => ({ kode_bagging: r.kode, kode_grouping_induk: null, kode_separating: null, pada: now, sampai_pada: null }))) });
          await muat();
          return { ok: true };
        } catch (e) { console.error('Gagal kirim ke Cutting:', e); return { ok: false, pesan: 'Gagal menyimpan. Coba lagi.' }; }
      }
    });

    // Mulai Serie Sewing — separating yang potongan + kit SEW/WEB-nya lengkap
    // dibuka jadi kartu Serie: komponen potongan dibagi prorata qty separating /
    // qty grouping; baris kit memakai kode_kit sebagai kode_scan.
    const sedangMulai = reactive({});
    async function mulaiSerie(sep) {
      if (sedangMulai[sep.id] || !bisaMulai(sep)) return;
      sedangMulai[sep.id] = true;
      try {
        const src = sumber(sep);
        const g = groupingList.value.find(x => x.id === sep.grouping_id);
        const rasio = g && parseFloat(g.qty_total) > 0 ? (parseFloat(sep.qty) || 0) / parseFloat(g.qty_total) : 1;
        const komponen = [];
        (src.cutting?.ref?.komponen_rincian || []).forEach(k => komponen.push({ sumber: 'bahan', nama_komponen: k.nama_komponen, qty_per_pcs: k.qty_per_pola || 0, qty_setor: Math.ceil((k.jumlah_label || 0) * rasio), satuan: 'PCS', kode_scan: '', pic_asal: src.cutting.ref.op_pola?.nama || null, ref_asal: src.cutting.ref.id }));
        ['sewing', 'webbing'].forEach(j => {
          const t = src[j]?.ref; if (!t) return;
          (t[j + '_rincian'] || []).forEach(b => komponen.push({ sumber: j, nama_komponen: b.nama_aksesoris || '(tanpa nama)', qty_per_pcs: b.qty_per_pcs || 1, qty_setor: parseFloat(b.butuh) || 0, satuan: b.satuan || 'PCS', kode_scan: t.kode_kit || '', pic_asal: b.operator_nama || null, ref_asal: t.id }));
        });
        const now = new Date().toISOString();
        await updateSeparatingBatch(sep.id, () => ({
          komponen_rincian: komponen.map((k, i) => ({ ...k, id_komponen: `${sep.kode_separating}-${String(i + 1).padStart(2, '0')}`, status: 'belum', entry_oleh: '', entry_pada: null, label_dicetak_pada: null })),
          status: 'sedang_diproses', operator_uid: null, operator_nama: null, riwayat_operator: [],
          kode_bagging: [], kode_tugas: '', tlc_tujuan: '', unpack_log: [], riwayat_scan: [], catatan_masalah: '',
          masuk_tahap_pada: now, sampai_pada: null
        }));
        await muat();
      } catch (e) { console.error('Gagal mulai Serie:', e); alert('Gagal membuka Serie. Coba lagi.'); }
      sedangMulai[sep.id] = false;
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahSerie(p.target, p.jumlah, p.alasan, p.jenis);
    });

    onMounted(async () => { await window.authReady; await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, daftarSep, bolehProses, bolehOperator, formatQty, sumber, bisaMulai, expandedIds, toggleExpand, LABEL_SUMBER,
      modalSampai, bukaScanSampai, tutupScanSampai, hasilScanSampai, unpackTerpadu,
      groupingSiapCutting, popupTugasCutting, bukaTugasCutting, konfirmasiTugasCutting, popupCetakTugas, daftarLabelTugas, daftarTlc, kirimCuttingTerpadu,
      sedangMulai, mulaiSerie,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah,
      aksiAktif
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
        <button v-if="bolehProses && aksiAktif('sub-pr-serie-perludiproses','serie_sampai')" @click="bukaScanSampai" class="btn-primary" style="padding:8px 12px; font-size:11.5px;"><i class="fas fa-qrcode" style="margin-right:4px;"></i>Scan Sampai</button>
        <button v-if="bolehProses && aksiAktif('sub-pr-serie-perludiproses','serie_unpack')" @click="unpackTerpadu.buka" class="btn-outline" style="padding:8px 12px; font-size:11.5px;"><i class="fas fa-box-open" style="margin-right:4px;"></i>Scan Unpack</button>
      </div>

      <div v-if="groupingSiapCutting.length" class="gc-card" style="padding:12px 14px; border-radius:16px; margin-bottom:10px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          <b style="font-size:12px;">Kirim ke Cutting</b>
          <span class="tag neutral">{{ groupingSiapCutting.length }} grouping</span>
          <button v-if="bolehProses" @click="bukaTugasCutting" class="btn-outline" style="margin-left:auto; padding:5px 10px; font-size:11px;"><i class="fas fa-print" style="margin-right:4px;"></i>Kode Tugas</button>
          <button v-if="bolehProses" @click="kirimCuttingTerpadu.buka" class="btn-primary" style="padding:5px 10px; font-size:11px;"><i class="fas fa-truck-fast" style="margin-right:4px;"></i>Scan Kirim</button>
        </div>
        <div v-for="g in groupingSiapCutting" :key="g.groupingId" style="font-size:11px; color:var(--text-muted); padding:3px 0; border-top:1px solid var(--line);">
          <span class="gc-num" style="font-weight:700;">{{ g.kode }}</span> &middot; {{ g.nama }} &middot; bagging {{ g.bagging.join(', ') }}
        </div>
      </div>

      <div v-if="daftarSep.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-inbox"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada separating yang menunggu di Collection</h3>
      </div>
      <div v-else class="gc-card" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px; white-space:nowrap;">
          <thead><tr style="text-align:left; border-bottom:1px solid var(--line);">
            <th style="padding:6px 8px; width:24px;"></th>
            <th style="padding:6px 8px;">Kode Separating</th><th style="padding:6px 8px;" class="gc-num">Qty</th>
            <th style="padding:6px 8px;">Produk</th><th style="padding:6px 8px;">Status</th><th style="padding:6px 8px;">Aksi</th>
          </tr></thead>
          <tbody>
            <template v-for="s in daftarSep" :key="s.id">
              <tr style="border-bottom:1px solid var(--line); cursor:pointer;" @click="toggleExpand(s.id)">
                <td style="padding:6px 8px; text-align:center;">{{ expandedIds.has(s.id) ? '▼' : '▶' }}</td>
                <td style="padding:6px 8px; font-weight:700;" class="gc-num">{{ s.kode_separating }}<div style="font-weight:400; font-size:10px; color:var(--text-faint);">{{ s.id_order }}</div></td>
                <td style="padding:6px 8px;" class="gc-num">{{ formatQty(s.qty) }}</td>
                <td style="padding:6px 8px;">{{ s.nama_produk }}<span style="color:var(--text-faint);"> {{ s.warna }} {{ s.size }}</span></td>
                <td style="padding:6px 8px;"><span class="tag" :class="bisaMulai(s) ? 'ok' : 'warn'">{{ bisaMulai(s) ? 'KOMPLIT' : 'MENUNGGU' }}</span></td>
                <td style="padding:6px 8px;" @click.stop>
                  <div style="display:flex; gap:4px;">
                    <button v-if="bolehProses" :disabled="!bisaMulai(s) || sedangMulai[s.id]" @click="mulaiSerie(s)" class="btn-primary" style="padding:5px 9px; font-size:10.5px;"><i class="fas fa-object-group" style="margin-right:4px;"></i>Serie Sewing</button>
                    <button v-if="bolehProses" @click="bukaMasalah(s)" class="btn-outline" style="padding:5px 9px; font-size:10.5px; color:var(--danger);" title="Scan Masalah"><i class="fas fa-triangle-exclamation"></i></button>
                  </div>
                </td>
              </tr>
              <tr v-if="expandedIds.has(s.id)">
                <td colspan="6" style="padding:0 8px 10px 32px; border-bottom:1px solid var(--line);">
                  <div v-for="(v,k) in sumber(s)" :key="k" class="gc-card" style="padding:8px 10px; margin-top:6px; border-radius:10px;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                      <b style="font-size:10.5px;">{{ LABEL_SUMBER[k] || k }}</b>
                      <span class="tag" :class="v.komplit ? 'ok' : 'warn'" style="margin-left:auto;">{{ v.komplit ? 'SUDAH DI COLLECTION' : 'BELUM' }}</span>
                    </div>
                    <div v-for="(b,i) in v.baris" :key="i" style="display:flex; gap:8px; font-size:10px; border-top:1px solid var(--line); padding:3px 0;">
                      <span style="flex:1;">{{ b.nama }}</span><span class="gc-num">{{ formatQty(b.qty) }}</span>
                      <span :style="{ color: b.ok ? 'var(--ok)' : 'var(--warn)' }">{{ b.ok ? 'ada' : 'belum' }}</span>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>

    <scan-generik :aktif="modalSampai.aktif" judul="Scan Kode Bagging (Sampai)" subjudul="Dari Persiapan Bahan, Cutting, kit ACC — dicocokkan otomatis." @hasil="hasilScanSampai" @tutup="tutupScanSampai" />
    <div v-if="modalSampai.aktif && modalSampai.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:280px;">
      <div v-for="(l,i) in modalSampai.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>
    <scan-terpadu-generik :c="unpackTerpadu" />
    <scan-terpadu-generik :c="kirimCuttingTerpadu" />

    <div v-if="popupTugasCutting" class="gc-dialog-backdrop">
      <div class="gc-dialog" style="max-width:360px;">
        <h3 class="gc-heading" style="font-size:14px; font-weight:700; margin:0 0 10px;">Kode Tugas ke Cutting</h3>
        <div class="gc-field"><label>Tujuan (TLC)</label>
          <select v-model="popupTugasCutting.tlcTujuan"><option v-for="t in daftarTlc" :key="t.id" :value="t.kode">{{ t.kode }} — {{ t.nama }}</option></select>
        </div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button @click="popupTugasCutting=null" class="btn-outline" style="flex:1;">Batal</button>
          <button @click="konfirmasiTugasCutting" class="btn-primary" style="flex:1;">Buat + Cetak</button>
        </div>
      </div>
    </div>
    <popup-pratinjau-cetak-label :terbuka="popupCetakTugas" :daftar-label="daftarLabelTugas" judul="Cetak Kode Tugas" jenis-cetak="lembar_kode_tugas" @tutup="popupCetakTugas = false" />

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.target.kode_separating }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jenis Masalah</label><select v-model="popupMasalah.jenis"><option value="kurang">Kurang</option><option value="cacat">Cacat</option><option value="hilang">Hilang</option></select></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. komponen tidak lengkap"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};


// TAB 2.2: Sedang Di Proses — batch dikerjakan (cetak ID komponen, scan
// operator, scan entry per komponen, lintas 4 sumber sekaligus)

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

    // Sesuai wireframe 2.2: tabel bisa di-expand per baris (bukan kartu polos).
    const expandedIds = ref(new Set());
    function toggleExpand(id) {
      const s = new Set(expandedIds.value);
      if (s.has(id)) s.delete(id); else s.add(id);
      expandedIds.value = s;
    }

    async function muat() {
      memuat.value = true;
      try { daftar.value = saringMilikOperator((await muatSemuaSeparatingBatch()).filter(b => b.status === 'sedang_diproses')); }
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

    // Cetak ID Komponen
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
        daftarLabelPreview.value = belum.map(k => ({ kode: k.id_komponen, nama: k.nama_komponen, info: `${batch.kode_separating} &middot; ${batch.nama_produk} size ${batch.size || '-'} &middot; sumber ${k.sumber}`, qrDataUrl: buatQrDataUrl(k.id_komponen) }));
        popupCetakAktif.value = true;
        await muat();
      } catch (e) { console.error('Gagal cetak ID komponen:', e); alert('Gagal mencetak. Coba lagi.'); }
      sedangCetak.value = false;
    }

    // Scan Operator (sekali per batch)
    const popupPinOperator = ref(null);
    function bukaScanOperator(batch) { popupPinOperator.value = batch; }
    async function pinSuksesOperator(user) {
      const batch = popupPinOperator.value;
      popupPinOperator.value = null;
      try {
        const namaOperator = user.nama || user.name || user.email;
        const pada = new Date().toISOString();
        await updateSeparatingBatch(batch.id, (data) => ({
          operator_uid: user.email, operator_nama: namaOperator,
          riwayat_operator: [...(data.riwayat_operator || []), { uid: user.email, nama: namaOperator, pada }],
          // riwayat_scan — dicatat ADITIF.
          riwayat_scan: [...(data.riwayat_scan || []), { aksi: 'operator', oleh: namaOperator, pada, qty: data.qty ?? null }]
        }));
        await muat();
      } catch (e) { console.error('Gagal scan operator Serie:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    // Scan Entry per komponen
    const modalEntry = reactive({ aktif: false, batch: null, log: [] });
    function bukaScanEntry(batch) { modalEntry.batch = batch; modalEntry.log = []; modalEntry.aktif = true; }
    function tutupScanEntry() { modalEntry.aktif = false; modalEntry.batch = null; modalEntry.log = []; muat(); }
    // Scan Entry Serie — isi yang diterima: ID komponen hasil cetak, Kode Kit
    // ACC (menandai semua baris kit itu), atau label komponen Cutting milik
    // cutting_track asal (menandai satu baris potongan dengan nama sama).
    async function cariTargetEntry(batch, kode) {
      const arr = batch.komponen_rincian || [];
      if (arr.some(k => k.id_komponen === kode)) return arr.filter(k => k.id_komponen === kode);
      const kit = arr.filter(k => k.kode_scan && k.kode_scan === kode);
      if (kit.length) return kit;
      const snap = await getDocs(query(collection(db, 'label_komponen'), where('kode', '==', kode)));
      if (snap.empty) return [];
      const lbl = snap.docs[0].data();
      const cocok = arr.find(k => k.sumber === 'bahan' && k.ref_asal === lbl.cutting_track_id && k.nama_komponen === lbl.nama_komponen && k.status !== 'selesai');
      return cocok ? [cocok] : [];
    }
    async function hasilScanEntry(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      const batch = modalEntry.batch;
      try {
        const target = await cariTargetEntry(batch, kode);
        if (!target.length) { alert(`"${kode}" bukan komponen, kit, atau label potongan milik separating ini.`); return; }
        if (target.every(k => k.status === 'selesai')) { alert(`"${kode}" sudah pernah di-scan entry.`); return; }
        const ids = new Set(target.map(k => k.id_komponen));
        const oleh = window.currentUser?.email || '';
        const now = new Date().toISOString();
        await updateSeparatingBatch(batch.id, (data) => {
          const arr = (data.komponen_rincian || []).map(k => ids.has(k.id_komponen) ? { ...k, status: 'selesai', entry_oleh: oleh, entry_pada: now } : k);
          const semuaSelesai = arr.length > 0 && arr.every(k => k.status === 'selesai');
          const riwayatBaru = semuaSelesai ? [...(data.riwayat_scan || []), { aksi: 'entry', oleh, pada: now, qty: data.qty ?? null }] : (data.riwayat_scan || []);
          return { komponen_rincian: arr, riwayat_scan: riwayatBaru, ...(semuaSelesai ? { status: 'perlu_dikirim', masuk_tahap_pada: now } : {}) };
        });
        batch.komponen_rincian = batch.komponen_rincian.map(k => ids.has(k.id_komponen) ? { ...k, status: 'selesai', entry_oleh: oleh, entry_pada: now } : k);
        try { await addDoc(collection(db, 'log_scan'), { operator_uid: oleh, operator_nama: window.currentUser?.nama || oleh, dicatat_oleh: oleh, aksi: 'scan_entry', pos: 'Collection Serie', kode, koleksi: 'spk_separating', doc_id: batch.id, separating_id: batch.id, pada: serverTimestamp() }); }
        catch (e) { console.error('Gagal catat log_scan Serie:', e); }
        modalEntry.log.unshift(kode + ` -> ${target.length} komponen selesai`);
      } catch (e) { console.error('Gagal scan entry Serie:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahSerie(p.target, p.jumlah, p.alasan, p.jenis);
      await muat();
    });

    // Wireframe 2.2 memindahkan "Scan Operator" & "Scan Entry" ke toolbar atas
    // (bukan diulang di tiap baris). Karena kedua handler butuh target batch
    // yang spesifik, tambahkan popup "pilih target dulu" — pola sama seperti
    // vue-pp-gudang.js/vue-pp-cutting.js — TANPA mengubah handler aslinya.
    const pilihTarget = ref(null); // { targetId, judul, lanjut(batch) }
    function bukaPilihTarget(judul, lanjut) {
      if (!daftar.value.length) { alert('Tidak ada batch di tab ini untuk diproses.'); return; }
      pilihTarget.value = { targetId: daftar.value[0].id, judul, lanjut };
    }
    function batalPilihTarget() { pilihTarget.value = null; }
    function konfirmasiPilihTarget() {
      const p = pilihTarget.value;
      const batch = daftar.value.find(b => b.id === p.targetId);
      pilihTarget.value = null;
      if (batch) p.lanjut(batch);
    }
    function bukaScanOperatorToolbar() { bukaPilihTarget('Pilih batch untuk Scan Operator', bukaScanOperator); }
    function bukaScanEntryToolbar() { bukaPilihTarget('Pilih batch untuk Scan Entry', bukaScanEntry); }

    onMounted(async () => { await window.authReady; await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, daftar, bolehProses, bolehCetak, bolehOperator, formatQty, formatDiamSejak, tertahan, formatWaktu,
      ekspand, toggleEkspand, perSumber, progres,
      expandedIds, toggleExpand,
      popupCetakAktif, daftarLabelPreview, sedangCetak, cetakIdKomponen,
      popupPinOperator, bukaScanOperator, pinSuksesOperator,
      modalEntry, bukaScanEntry, tutupScanEntry, hasilScanEntry,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah,
      pilihTarget, bukaPilihTarget, batalPilihTarget, konfirmasiPilihTarget,
      bukaScanOperatorToolbar, bukaScanEntryToolbar,
      aksiAktif
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
        <button v-if="bolehOperator && aksiAktif('sub-pr-serie-sedangdiproses','serie_operator')" @click="bukaScanOperatorToolbar" class="btn-outline" style="padding:9px 14px; font-size:12px;"><i class="fas fa-user-check" style="margin-right:6px;"></i>Scan Operator</button>
        <button v-if="bolehProses && aksiAktif('sub-pr-serie-sedangdiproses','serie_entry')" @click="bukaScanEntryToolbar" class="btn-primary" style="padding:9px 14px; font-size:12px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Entry</button>
      </div>
      <div v-if="daftar.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-gears"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada batch yang sedang diproses</h3>
      </div>
      <div v-else class="gc-card" style="padding:0; overflow-x:auto; border-radius:16px;">
        <table style="width:100%; border-collapse:collapse; font-size:11.5px; min-width:640px;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid var(--line);">
              <th style="padding:8px;"></th>
              <th style="padding:8px;">Kode Batch</th>
              <th style="padding:8px;">SKU Produk</th>
              <th style="padding:8px;">Qty</th>
              <th style="padding:8px;">Operator</th>
              <th style="padding:8px;">Komponen</th>
              <th style="padding:8px;">Status</th>
              <th style="padding:8px;">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="b in daftar" :key="b.id">
              <tr style="border-bottom:1px solid var(--line); cursor:pointer;" @click="toggleExpand(b.id)" :style="{ background: tertahan(b.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
                <td style="padding:8px;"><i class="fas" :class="expandedIds.has(b.id) ? 'fa-chevron-up' : 'fa-chevron-down'"></i></td>
                <td style="padding:8px;" class="gc-num">{{ b.kode_separating }}</td>
                <td style="padding:8px;">{{ b.nama_produk }} <span style="color:var(--text-faint);">size {{ b.size || '-' }}</span></td>
                <td style="padding:8px;" class="gc-num">{{ formatQty(b.qty) }}</td>
                <td style="padding:8px;">{{ b.operator_nama || '-' }}</td>
                <td style="padding:8px;" class="gc-num">{{ progres(b).done }}/{{ progres(b).total }}</td>
                <td style="padding:8px;"><span class="tag" :class="tertahan(b.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(b.masuk_tahap_pada) }}</span></td>
                <td style="padding:8px;" @click.stop>
                  <button v-if="bolehCetak" @click="cetakIdKomponen(b)" :disabled="sedangCetak" class="btn-outline" style="padding:5px 8px; font-size:10px;" title="Cetak ID Komponen"><i class="fas fa-print"></i></button>
                  <button v-if="bolehProses" @click="bukaMasalah(b)" class="btn-outline" style="padding:5px 8px; font-size:10px; color:var(--danger);" title="Scan Masalah"><i class="fas fa-triangle-exclamation"></i></button>
                </td>
              </tr>
              <tr v-if="expandedIds.has(b.id)" :key="b.id + '-detail'">
                <td colspan="8" style="padding:10px 14px; background:var(--ivory-dim);">
                  <div v-for="(rows, sb) in perSumber(b)" :key="sb" style="margin-bottom:8px;">
                    <div class="gc-heading" style="font-size:10px; font-weight:700; text-transform:uppercase; margin-bottom:5px;">{{ sb }}</div>
                    <table style="width:100%; border-collapse:collapse; font-size:10.5px;">
                      <thead>
                        <tr style="text-align:left; color:var(--text-faint);">
                          <th style="padding:3px 6px;">ID Komponen</th>
                          <th style="padding:3px 6px;">Komponen</th>
                          <th style="padding:3px 6px;">Qty Setor</th>
                          <th style="padding:3px 6px;">Satuan</th>
                          <th style="padding:3px 6px;" title="Siapa yang menyiapkan baris ini di divisi asal — dipakai buat audit kalau barang hilang.">PIC Asal</th>
                          <th style="padding:3px 6px;">Entry</th>
                          <th style="padding:3px 6px;">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="k in rows" :key="k.id_komponen">
                          <td style="padding:3px 6px; color:var(--text-faint);">{{ k.id_komponen }}</td>
                          <td style="padding:3px 6px;">{{ k.nama_komponen }}</td>
                          <td style="padding:3px 6px;" class="gc-num">{{ formatQty(k.qty_setor) }}</td>
                          <td style="padding:3px 6px;">{{ k.satuan }}</td>
                          <td style="padding:3px 6px; color:var(--text-faint);">{{ k.pic_asal || '–' }}</td>
                          <td style="padding:3px 6px;">{{ k.entry_pada ? 'sudah' : '–' }}</td>
                          <td style="padding:3px 6px;"><span class="tag" :class="k.status==='selesai' ? 'ok' : 'neutral'">{{ k.status }}</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>

    <div v-if="pilihTarget" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">{{ pilihTarget.judul }}</h3>
        <div class="gc-field" style="margin-bottom:14px;">
          <label>Kode Batch</label>
          <select v-model="pilihTarget.targetId">
            <option v-for="b in daftar" :key="b.id" :value="b.id">{{ b.kode_separating }} — {{ b.nama_produk }}</option>
          </select>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="batalPilihTarget" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiPilihTarget" class="btn-primary" style="flex:1; padding:9px;">Lanjut</button>
        </div>
      </div>
    </div>

    <popup-pratinjau-cetak-label v-if="popupCetakAktif" :terbuka="popupCetakAktif" :daftar-label="daftarLabelPreview" judul="Cetak ID Komponen" jenis-cetak="id_komponen_serie" @tutup="popupCetakAktif = false" />
    <scan-generik :aktif="modalEntry.aktif" :judul="modalEntry.batch ? ('Scan Entry — ' + modalEntry.batch.kode_separating) : 'Scan Entry'" subjudul="Scan ID komponen satu per satu." @hasil="hasilScanEntry" @tutup="tutupScanEntry" />
    <popup-pin-generik v-if="popupPinOperator" judul="Verifikasi PIN — Operator Serie" konteks="Serie - Scan Operator" :roles-diizinkan="['owner','superuser','pic_owner','pic']" @sukses="pinSuksesOperator" @batal="popupPinOperator = null" />

    <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.target.kode_separating }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jenis Masalah</label><select v-model="popupMasalah.jenis"><option value="kurang">Kurang</option><option value="cacat">Cacat</option><option value="hilang">Hilang</option></select></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. komponen hilang"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};


// TAB 2.3: Perlu Di Kirim — cetak kode bagging (bundle per nama_komponen, tanpa
// kode tugas/tujuan; kode tugas baru dicetak di tab 2.4) + Scan Pack (isi bagging
// dengan id_komponen). Reuse koleksi `bagging` yang sama dipakai Cutting & Bahan.

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
        daftar.value = saringMilikOperator(batch.filter(b => b.status === 'perlu_dikirim'));
        daftarBaggingAktif.value = baggingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) { console.error('Gagal muat Serie > Perlu Di Kirim:', e); daftar.value = []; daftarBaggingAktif.value = []; }
      memuat.value = false;
    }

    // Cetak Kode Bagging: bundle per nama_komponen, TIDAK ada popup pilihan
    // (tidak ada tujuan yang perlu dipilih di tab ini).
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
            kode, produk_label: `${batch.kode_separating} &middot; ${jenis}`, isi: [], ditutup_pada: null,
            kode_grouping_induk: batch.kode_grouping_induk || '', kode_separating: batch.kode_separating || null,
            dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
          });
          kodeBaru.push(kode);
          preview.push({ kode, nama: jenis, info: `Kode Bagging &middot; ${batch.kode_separating}`, qrDataUrl: buatQrDataUrl(kode) });
        }
        await updateSeparatingBatch(batch.id, (data) => ({ kode_bagging: [...(data.kode_bagging || []), ...kodeBaru] }));
        daftarLabelPreview.value = preview;
        popupCetakAktif.value = true;
        await muat();
      } catch (e) { console.error('Gagal cetak kode bagging Serie:', e); alert('Gagal mencetak. Coba lagi.'); }
      sedangProses.value = false;
    }

    // Scan Pack: step1 kode bagging, step2 id_komponen berkali-kali
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
      if (!adaKomponen) { alert(`ID Komponen "${kode}" tidak ditemukan di batch ${modalPack.batch.kode_separating}.`); return; }
      try {
        await updateDoc(doc(db, 'bagging', modalPack.bagging.id), { isi: arrayUnion(kode) });
        modalPack.log.unshift(kode + ' -> ' + modalPack.bagging.kode);
      } catch (e) { console.error('Gagal scan pack Serie:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }
    async function tutupBagging() {
      if (!modalPack.bagging) return;
      try {
        await updateDoc(doc(db, 'bagging', modalPack.bagging.id), { ditutup_pada: serverTimestamp() });
        // riwayat_scan aksi 'pack' — dicatat SEKALI saat 1 bagging
        // ditutup (bukan per komponen yang di-scan masuk), pasangan dari aksi
        // 'unpack' yang sudah ada (unpack_log[] milik spk_separating).
        if (modalPack.batch) {
          const oleh = window.currentUser?.email || null;
          await updateSeparatingBatch(modalPack.batch.id, (data) => ({
            riwayat_scan: [...(data.riwayat_scan || []), { aksi: 'pack', oleh, pada: new Date().toISOString(), catatan: modalPack.bagging.kode, qty: data.qty ?? null }]
          }));
        }
      } catch (e) { console.error('Gagal tutup bagging:', e); alert('Gagal menutup bagging. Coba lagi.'); }
      modalPack.bagging = null; modalPack.batch = null;
    }

    const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
      await kirimMasalahSerie(p.target, p.jumlah, p.alasan, p.jenis);
      await muat();
    });

    onMounted(async () => { await window.authReady; await pastikanCachePilihanScan(); await muat(); });

    return { muat,
      memuat, daftar, bolehProses, bolehCetak, sedangProses, formatQty, formatDiamSejak, tertahan,
      popupCetakAktif, daftarLabelPreview, cetakKodeBagging,
      modalPack, bukaScanPack, tutupScanPack, hasilScanPack, tutupBagging,
      popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah,
      aksiAktif
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div v-if="bolehProses" style="display:flex; gap:8px; margin-bottom:12px;">
        <button v-if="aksiAktif('sub-pr-serie-perludikirim','serie_pack')" @click="bukaScanPack" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Pack</button>
      </div>
      <div v-if="daftar.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-box"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada batch yang perlu dikirim</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="b in daftar" :key="b.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(b.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ b.kode_separating }}</div>
            <span class="tag" :class="tertahan(b.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(b.masuk_tahap_pada) }}</span>
          </div>
          <div style="font-size:12px; color:var(--text-faint); margin-bottom:6px;">{{ b.nama_produk }} &middot; size {{ b.size || '-' }} &middot; qty {{ formatQty(b.qty) }}</div>
          <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:10px;">
            <span v-if="b.kode_bagging && b.kode_bagging.length" class="tag ok">{{ b.kode_bagging.length }} kode bagging dicetak</span>
            <span v-else class="tag neutral">belum dicetak kode bagging</span>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button v-if="bolehCetak" @click="cetakKodeBagging(b)" :disabled="sedangProses" class="btn-outline" style="flex:1; min-width:150px; padding:8px; font-size:11.5px;"><i class="fas fa-print" style="margin-right:4px;"></i>Cetak Kode Bagging</button>
            <button v-if="bolehProses" @click="bukaMasalah(b)" class="btn-outline" style="flex:1; min-width:120px; padding:8px; font-size:11.5px; color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
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
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.target.kode_separating }}</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
        <div class="gc-field" style="margin-bottom:8px;"><label>Jenis Masalah</label><select v-model="popupMasalah.jenis"><option value="kurang">Kurang</option><option value="cacat">Cacat</option><option value="hilang">Hilang</option></select></div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Alasan</label><input v-model="popupMasalah.alasan" type="text" placeholder="mis. bundle salah isi"></div>
        <div style="display:flex; gap:8px;">
          <button @click="batalMasalah" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiMasalah" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};


// FACTORY: Tab "Kirim <Tujuan>" (2.4 Sewing, 2.7 Finishing, 2.10 Gudang), pola
// identik dipanggil 3x dengan cfg beda. Status setor_sewing/setor_finishing di
// enum spk_separating TIDAK PERNAH ditulis modul ini. Kode tugas dicetak ulang
// tiap leg; kode_bagging dari tab 2.3 DIPAKAI ULANG di semua leg.

function buatTabKirim(cfg) {
  // cfg: { statusFilter, statusSetelah, tlcTujuan, namaTujuan, judul,
  // kosongTeks, icon, targetIdScan, aksiIdKirim } — 2 field terakhir untuk
  // gerbang tombol Scan Kirim lewat aksiAktif (beda per tujuan).
  return {
    components: { PopupPratinjauCetakLabel, ScanGenerik, ScanTerpaduGenerik },
    setup() {
      const memuat = ref(true);
      const daftar = ref([]);
      const sedangProses = ref(false);
      const menuId = 'proses_serie';
      const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
      const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);

      async function muat() {
        memuat.value = true;
        try {
          daftar.value = saringMilikOperator((await muatSemuaSeparatingBatch()).filter(b => b.status === cfg.statusFilter));
          if (cfg.serieFinishing) {
            const snap = await getDocs(query(collection(db, 'spk_track'), where('jalur', '==', 'finishing')));
            kitFin.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          }
        }
        catch (e) { console.error('Gagal muat Serie > ' + cfg.judul + ':', e); daftar.value = []; }
        memuat.value = false;
      }

      // Cetak Kode Tugas: TIDAK ada pilihan tujuan (sudah pasti per tab
      // ini), cuma tgl keberangkatan. Butuh kode_bagging (dicetak di 2.3). --
      const popupCetak = ref(null); // { batch, tglKeberangkatan }
      function bukaCetakTugas(batch) {
        if (!batch.kode_bagging || !batch.kode_bagging.length) { alert('Batch ini belum punya kode bagging (harus cetak di Perlu Di Kirim / hasil pack sebelumnya dulu).'); return; }
        if (perluSerieFin(batch)) { alert('Serie Finishing belum selesai: scan kit -FIN lalu semua label pcs dulu.'); return; }
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
            info: `Tujuan: ${cfg.namaTujuan} &middot; TLC-SER &rarr; ${cfg.tlcTujuan} &middot; ${batch.kode_separating}`,
            qrDataUrl: buatQrDataUrl(kodeTugas)
          }];
          popupCetak.value = null;
          popupCetakAktif.value = true;
          await muat();
        } catch (e) { console.error('Gagal cetak kode tugas Serie:', e); alert('Gagal mencetak. Coba lagi.'); }
        sedangProses.value = false;
      }

      // Scan Kirim: step1 kode tugas, step2 kode bagging tiap pack
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
        const batch = daftar.value.find(b => b.kode_tugas === modalKirim.tugas.kode && (b.kode_bagging || []).includes(kode));
        if (!batch) { alert(`Kode bagging "${kode}" tidak cocok dengan tugas ini.`); return; }
        try {
          // kode_grouping_induk/kode_separating ikut disalin ke pack[], dilepas oleh Scan
          // Sampai (sampai_pada).
          await updateDoc(doc(db, 'tugas_kirim', modalKirim.tugas.id), {
            pack: arrayUnion({ kode_bagging: kode, kode_grouping_induk: batch.kode_grouping_induk || '', kode_separating: batch.kode_separating || null, pada: new Date().toISOString(), sampai_pada: null })
          });
          const tugasSnap = await getDoc(doc(db, 'tugas_kirim', modalKirim.tugas.id));
          const semuaSudah = (batch.kode_bagging || []).every(kb => (tugasSnap.data().pack || []).some(pk => pk.kode_bagging === kb));
          if (semuaSudah) {
            const oleh = window.currentUser?.email || null;
            const pada = new Date().toISOString();
            // riwayat_scan aksi 'kirim' — dicatat ADITIF.
            await updateSeparatingBatch(batch.id, (data) => ({
              status: cfg.statusSetelah, masuk_tahap_pada: pada,
              riwayat_scan: [...(data.riwayat_scan || []), { aksi: 'kirim', oleh, pada, catatan: cfg.namaTujuan, qty: data.qty ?? null }]
            }));
          }
          modalKirim.log.unshift(kode + ' -> ' + modalKirim.tugas.kode + (semuaSudah ? ' (semua bagging terkirim, status pindah)' : ''));
          await muat();
        } catch (e) { console.error('Gagal scan kirim Serie:', e); alert('Gagal menyimpan. Coba lagi.'); }
      }

      // Serie Finishing — kit -FIN dikunci dulu, lalu tiap label pcs separating
      // itu discan. Semua pcs terpasang → fin_terpasang_pada, baru boleh kirim.
      const kitFin = ref([]);
      const kitFinDari = (b) => kitFin.value.find(t => t.separating_id === b.id);
      const perluSerieFin = (b) => !!(cfg.serieFinishing && kitFinDari(b) && !b.fin_terpasang_pada);
      const serieFinishing = cfg.serieFinishing ? buatScanTerpadu({
        judul: 'Serie Finishing', subjudul: 'Scan Kode Kit -FIN, lalu tiap label pcs',
        twoStep: {
          labelPertama: 'Kode Kit', labelKedua: 'Label Pcs',
          validasi: async (kode) => {
            const t = kitFin.value.find(x => x.kode_kit === kode);
            if (!t) return { ok: false, pesan: `"${kode}" bukan Kode Kit Finishing (akhiran -FIN).` };
            const sep = daftar.value.find(b => b.id === t.separating_id);
            if (!sep) return { ok: false, pesan: `Separating kit ${kode} belum ada di tab ini (belum setor Sewing).` };
            const snap = await getDocs(query(collection(db, 'label_pcs'), where('separating_id', '==', sep.id)));
            return { ok: true, label: kode + ' · ' + sep.kode_separating, data: { kit: t, sep, pcs: snap.docs.map(d => ({ id: d.id, ...d.data() })) } };
          }
        },
        validasiIsi: async (kode, kunci) => {
          const p = kunci.pcs.find(x => x.kode_pcs === kode);
          if (!p) return { ok: false, pesan: `Label pcs "${kode}" bukan milik ${kunci.sep.kode_separating}.` };
          if (p.acc_finishing_pada) return { ok: false, pesan: `${kode} sudah dipasang ACC finishing.` };
          return { ok: true, row: { kode, label: kode, tagTxt: 'pasang', tagCls: 'ok', _pcsId: p.id } };
        },
        padaUpload: async (rows, kunci) => {
          try {
            const now = new Date().toISOString();
            const oleh = window.currentUser?.email || null;
            for (const r of rows) await updateDoc(doc(db, 'label_pcs', r._pcsId), { acc_finishing_pada: now, kode_kit_finishing: kunci.kit.kode_kit });
            for (const r of rows) await addDoc(collection(db, 'log_scan'), { kode: r.kode, pos: 'serie_finishing', aksi: 'pasang_acc_finishing', kode_kit: kunci.kit.kode_kit, separating_id: kunci.sep.id, operator_email: oleh, operator_uid: window.currentUser?.uid || null, pada: serverTimestamp() });
            const sisa = kunci.pcs.filter(p => !p.acc_finishing_pada && !rows.some(r => r._pcsId === p.id)).length;
            if (sisa === 0) await updateSeparatingBatch(kunci.sep.id, () => ({ fin_terpasang_pada: now }));
            await muat();
            return { ok: true };
          } catch (e) { console.error('Gagal Serie Finishing:', e); return { ok: false, pesan: 'Gagal menyimpan. Coba lagi.' }; }
        }
      }) : null;

      const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
        await kirimMasalahSerie(p.target, p.jumlah, p.alasan, p.jenis);
        await muat();
      });

      onMounted(async () => { await window.authReady; await pastikanCachePilihanScan(); await muat(); });

      return {
        cfg, memuat, muat, daftar, bolehProses, bolehCetak, sedangProses, formatQty, formatDiamSejak, tertahan,
        popupCetak, bukaCetakTugas, konfirmasiCetakTugas, popupCetakAktif, daftarLabelPreview,
        modalKirim, bukaScanKirim, tutupScanKirim, hasilScanKirim,
        popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah,
        aksiAktif, serieFinishing, kitFinDari, perluSerieFin
      };
    },
    template: `
      <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <template v-else>
        <div v-if="bolehProses" style="display:flex; gap:8px; margin-bottom:12px;">
          <button v-if="serieFinishing" @click="serieFinishing.buka()" class="btn-outline" style="flex:1; padding:9px;"><i class="fas fa-tags" style="margin-right:6px;"></i>Serie Finishing</button>
          <button v-if="aksiAktif(cfg.targetIdScan, cfg.aksiIdKirim)" @click="bukaScanKirim" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-paper-plane" style="margin-right:6px;"></i>Scan Kirim</button>
        </div>
        <div v-if="daftar.length === 0" class="gc-kosong gc-card">
          <div class="lingkaran"><i class="fas" :class="cfg.icon"></i></div>
          <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">{{ cfg.kosongTeks }}</h3>
        </div>
        <div v-else style="display:flex; flex-direction:column; gap:10px;">
          <div v-for="b in daftar" :key="b.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(b.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
            <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
              <div class="gc-num" style="font-weight:700; font-size:13px;">{{ b.kode_separating }}</div>
              <span class="tag" :class="tertahan(b.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(b.masuk_tahap_pada) }}</span>
            </div>
            <div style="font-size:12px; color:var(--text-faint); margin-bottom:6px;">{{ b.nama_produk }} &middot; size {{ b.size || '-' }} &middot; qty {{ formatQty(b.qty) }}</div>
            <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:10px;">
              <span v-if="b.kode_tugas" class="tag ok">{{ b.kode_tugas }} &rarr; {{ cfg.namaTujuan }}</span>
              <span v-else class="tag neutral">belum dicetak kode tugas</span>
              <span v-if="cfg.serieFinishing && kitFinDari(b)" class="tag" :class="b.fin_terpasang_pada ? 'ok' : 'warn'" style="margin-left:4px;">{{ b.fin_terpasang_pada ? 'ACC finishing terpasang' : 'belum Serie Finishing' }}</span>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button v-if="bolehCetak" @click="bukaCetakTugas(b)" class="btn-outline" style="flex:1; min-width:150px; padding:8px; font-size:11.5px;"><i class="fas fa-print" style="margin-right:4px;"></i>Cetak Kode Tugas</button>
              <button v-if="bolehProses" @click="bukaMasalah(b)" class="btn-outline" style="flex:1; min-width:120px; padding:8px; font-size:11.5px; color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
            </div>
          </div>
        </div>
      </template>

      <popup-pratinjau-cetak-label v-if="popupCetakAktif" :terbuka="popupCetakAktif" :daftar-label="daftarLabelPreview" :judul="'Cetak Kode Tugas — ' + cfg.namaTujuan" jenis-cetak="lembar_kode_tugas" @tutup="popupCetakAktif = false" />

      <div v-if="popupCetak" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
        <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
          <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Cetak Kode Tugas — {{ popupCetak.batch.kode_separating }}</h3>
          <div class="gc-field" style="margin-bottom:8px;"><label>Tujuan</label><input :value="cfg.namaTujuan + ' (' + cfg.tlcTujuan + ')'" disabled></div>
          <div class="gc-field" style="margin-bottom:14px;"><label>Tgl Keberangkatan</label><input v-model="popupCetak.tglKeberangkatan" type="datetime-local"></div>
          <div style="display:flex; gap:8px;">
            <button @click="popupCetak = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
            <button @click="konfirmasiCetakTugas" :disabled="sedangProses" class="btn-primary" style="flex:1; padding:9px;">Cetak</button>
          </div>
        </div>
      </div>

      <scan-terpadu-generik v-if="serieFinishing" :c="serieFinishing" />
      <scan-generik :aktif="modalKirim.aktif" :judul="modalKirim.tugas ? ('Scan kode bagging — tugas ' + modalKirim.tugas.kode) : 'Scan Kode Tugas'" subjudul="Bisa discan berkali-kali (tiap kode bagging = 1 pack)." @hasil="hasilScanKirim" @tutup="tutupScanKirim" />
      <div v-if="modalKirim.aktif && modalKirim.tugas && modalKirim.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:280px;">
        <div v-for="(l,i) in modalKirim.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
      </div>

      <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
        <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
          <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.target.kode_separating }}</h3>
          <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
          <div class="gc-field" style="margin-bottom:8px;"><label>Jenis Masalah</label><select v-model="popupMasalah.jenis"><option value="kurang">Kurang</option><option value="cacat">Cacat</option><option value="hilang">Hilang</option></select></div>
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
  judul: 'Kirim Sewing', kosongTeks: 'Tidak ada batch siap kirim ke Sewing', icon: 'fa-shirt',
  targetIdScan: 'sub-pr-serie-kirimsewing', aksiIdKirim: 'serie_kirim_sewing'
});
const SerieKirimFinishing = buatTabKirim({
  statusFilter: 'terima_sewing', statusSetelah: 'kirim_finishing', tlcTujuan: TLC_TUJUAN_FINISHING, namaTujuan: 'Finishing',
  judul: 'Kirim Finishing', kosongTeks: 'Tidak ada batch siap kirim ke Finishing', icon: 'fa-spray-can-sparkles',
  targetIdScan: 'sub-pr-serie-kirimfinishing', aksiIdKirim: 'serie_kirim_finishing', serieFinishing: true
});
const SerieKirimGudang = buatTabKirim({
  statusFilter: 'terima_finishing', statusSetelah: 'kirim_gudang', tlcTujuan: TLC_TUJUAN_GUDANG, namaTujuan: 'Gudang Barang Jadi',
  judul: 'Kirim Gudang', kosongTeks: 'Tidak ada batch siap kirim ke Gudang', icon: 'fa-warehouse',
  targetIdScan: 'sub-pr-serie-kirimgudang', aksiIdKirim: 'serie_kirim_gudang'
});


// FACTORY: Tab "Setor <Asal>" (2.5 Setor Sewing, 2.8 Setor Finishing) —
// READ-ONLY MURNI, tidak ada tombol aksi apapun . Baca
// sewing_track/finishing_track APA ADANYA, kosong sampai modul Sewing/Finishing
// dibangun (lihat GAP DISENGAJA di header file).

function buatTabSetor(cfg) {
  // cfg: { muatFn, judul, kosongTeks, icon, kolomStatus (fungsi ambil label
  // status per doc) }
  return {
    setup() {
      const memuat = ref(true);
      const daftar = ref([]);
      async function muat() {
        memuat.value = true;
        try { daftar.value = saringMilikOperator(await cfg.muatFn()); }
        catch (e) { console.error('Gagal muat Serie > ' + cfg.judul + ':', e); daftar.value = []; }
        memuat.value = false;
      }
      onMounted(async () => { await window.authReady; await muat(); });
      return { cfg, memuat, muat, daftar, formatQty, formatWaktu };
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
            <thead><tr style="text-align:left; border-bottom:1px solid var(--line);">
              <th style="padding:6px 8px;">Batch</th><th style="padding:6px 8px;">Produk</th><th style="padding:6px 8px;">Qty</th>
              <th style="padding:6px 8px;">Operator</th><th style="padding:6px 8px;">Status di {{ cfg.namaAsal }}</th><th style="padding:6px 8px;">Diperbarui</th>
            </tr></thead>
            <tbody>
              <tr v-for="t in daftar" :key="t.id" style="border-bottom:1px solid var(--line);">
                <td style="padding:6px 8px;" class="gc-num">{{ t.kode_separating || '-' }}</td>
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


// FACTORY: Tab "Terima <Asal>" (2.6 Sewing, 2.9 Finishing) — Scan Sampai (cari
// sewing_track/finishing_track via kode_tugas, set status:'selesai' di situ) +
// Scan Unpack per kode_bagging ke spk_separating.unpack_log sendiri. Penghubung
// `separating_id`; kode_bagging ARRAY di sewing_track, TUNGGAL di finishing_track.

function buatTabTerima(cfg) {
  // cfg: { koleksi, statusSetelah, namaAsal, judul, kosongTeks, icon,
  // baggingArray, fieldBagging, targetIdScan, aksiIdSampai, aksiIdUnpack } —
  // 3 field terakhir untuk gerbang tombol Scan Sampai/Unpack lewat aksiAktif.
  return {
    components: { ScanGenerik, ScanTerpaduGenerik },
    setup() {
      const memuat = ref(true);
      const daftar = ref([]);
      const menuId = 'proses_serie';
      const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);

      async function muat() {
        memuat.value = true;
        try { daftar.value = saringMilikOperator((await muatSemuaSeparatingBatch()).filter(b => b.status === cfg.statusMenunggu)); }
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
          const kodeBaggingSampai = new Set();
          for (const d of snap.docs) {
            if (d.data().status === 'selesai') continue;
            await updateDoc(doc(db, cfg.koleksi, d.id), { status: 'selesai', sampai_pada: now });
            if (d.data().separating_id) batchIds.add(d.data().separating_id);
            // kumpulkan kode_bagging milik dokumen ini (array di sewing_track,
            // string tunggal di finishing_track — lihat cfg.baggingArray).
            const kb = d.data()[cfg.fieldBagging];
            (cfg.baggingArray ? (Array.isArray(kb) ? kb : []) : (kb ? [kb] : [])).forEach(k => kodeBaggingSampai.add(k));
          }
          if (!batchIds.size) { alert(`Kode tugas "${kode}" sudah pernah di-Scan Sampai sebelumnya.`); return; }
          // leg ${namaAsal} -> Serie: kode di sini SAMA dengan kode_tugas =
          // tugas_kirim.kode, jadi cari langsung 1 dokumen dan lepas pack[]
          // milik kode_bagging yang baru sampai.
          if (kodeBaggingSampai.size) {
            try {
              const snapTugas = await getDocs(query(collection(db, 'tugas_kirim'), where('kode', '==', kode)));
              if (!snapTugas.empty) {
                const dt = snapTugas.docs[0];
                const packArr = Array.isArray(dt.data().pack) ? dt.data().pack : [];
                const packBaru = packArr.map(p => (kodeBaggingSampai.has(p.kode_bagging) && !p.sampai_pada) ? { ...p, sampai_pada: now } : p);
                await updateDoc(doc(db, 'tugas_kirim', dt.id), { pack: packBaru });
              }
            } catch (e) { console.error('Gagal lepas pack tugas_kirim (Terima ' + cfg.namaAsal + '):', e); }
          }
          const oleh = window.currentUser?.email || null;
          for (const bid of batchIds) {
            try {
              // riwayat_scan aksi 'sampai' — dicatat ADITIF.
              await updateSeparatingBatch(bid, (data) => ({
                status: cfg.statusSetelah, masuk_tahap_pada: now,
                riwayat_scan: [...(data.riwayat_scan || []), { aksi: 'sampai', oleh, pada: now, catatan: cfg.namaAsal, qty: data.qty ?? null }]
              }));
            }
            catch (e) { console.error('Gagal update spk_separating dari Terima ' + cfg.namaAsal + ':', e); }
          }
          modalSampai.log.unshift(kode + ' -> ' + cfg.namaAsal + ' selesai (' + batchIds.size + ' batch)');
          await muat();
        } catch (e) { console.error('Gagal scan sampai ' + cfg.judul + ':', e); alert('Gagal menyimpan. Coba lagi.'); }
      }

      // Scan Unpack: lewat bagging.isi[] langsung,
      // Scan Unpack — konversi ke buatScanTerpadu (Draft/Upload), gantikan
      // buatUnpackUniversal lama. Sama persis pola vue-pp-cutting.js: kunci Kode
      // Bagging dulu, scan ulang isi berkali-kali, Upload cuma menutup KOMPLIT
      // kalau semua isi cocok tanpa kode asing — kalau tidak, pakai "Paksa
      // INKOMPLIT" di chip atas.
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

      const { popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah } = popupMasalahMixin(async (p) => {
        await kirimMasalahSerie(p.target, p.jumlah, p.alasan, p.jenis);
        await muat();
      });

      onMounted(async () => { await window.authReady; await pastikanCachePilihanScan(); await muat(); });

      return {
        cfg, memuat, muat, daftar, bolehProses, formatQty, formatDiamSejak, tertahan,
        modalSampai, bukaScanSampai, tutupScanSampai, hasilScanSampai,
        unpackTerpadu,
        popupMasalah, bukaMasalah, batalMasalah, konfirmasiMasalah,
        aksiAktif
      };
    },
    template: `
      <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <template v-else>
        <div v-if="bolehProses" style="display:flex; gap:8px; margin-bottom:12px;">
          <button v-if="aksiAktif(cfg.targetIdScan, cfg.aksiIdSampai)" @click="bukaScanSampai" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Sampai</button>
          <button v-if="aksiAktif(cfg.targetIdScan, cfg.aksiIdUnpack)" @click="unpackTerpadu.buka" class="btn-outline" style="flex:1; padding:9px;"><i class="fas fa-box-open" style="margin-right:6px;"></i>Scan Unpack</button>
        </div>
        <div v-if="daftar.length === 0" class="gc-kosong gc-card">
          <div class="lingkaran"><i class="fas" :class="cfg.icon"></i></div>
          <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">{{ cfg.kosongTeks }}</h3>
        </div>
        <div v-else style="display:flex; flex-direction:column; gap:10px;">
          <div v-for="b in daftar" :key="b.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ background: tertahan(b.masuk_tahap_pada) ? 'var(--warn-light)' : '' }">
            <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
              <div class="gc-num" style="font-weight:700; font-size:13px;">{{ b.kode_separating }}</div>
              <span class="tag" :class="tertahan(b.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(b.masuk_tahap_pada) }}</span>
            </div>
            <div style="font-size:12px; color:var(--text-faint); margin-bottom:10px;">{{ b.nama_produk }} &middot; size {{ b.size || '-' }} &middot; qty {{ formatQty(b.qty) }} &middot; kode tugas {{ b.kode_tugas || '-' }}</div>
            <button v-if="bolehProses" @click="bukaMasalah(b)" class="btn-outline" style="width:100%; padding:8px; font-size:11px; color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Scan Masalah</button>
          </div>
        </div>
      </template>

      <scan-generik :aktif="modalSampai.aktif" :judul="'Scan Kode Tugas — dari ' + cfg.namaAsal" subjudul="Bisa discan berkali-kali." @hasil="hasilScanSampai" @tutup="tutupScanSampai" />
      <div v-if="modalSampai.aktif && modalSampai.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:280px;">
        <div v-for="(l,i) in modalSampai.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
      </div>

      <scan-terpadu-generik :c="unpackTerpadu" />

      <div v-if="popupMasalah" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
        <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
          <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Ajukan Masalah — {{ popupMasalah.target.kode_separating }}</h3>
          <div class="gc-field" style="margin-bottom:8px;"><label>Jumlah Kurang/Bermasalah</label><input v-model.number="popupMasalah.jumlah" type="number" min="0"></div>
          <div class="gc-field" style="margin-bottom:8px;"><label>Jenis Masalah</label><select v-model="popupMasalah.jenis"><option value="kurang">Kurang</option><option value="cacat">Cacat</option><option value="hilang">Hilang</option></select></div>
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
  baggingArray: true, fieldBagging: 'kode_bagging',
  targetIdScan: 'sub-pr-serie-terimasewing', aksiIdSampai: 'serie_terima_sampai_sewing', aksiIdUnpack: 'serie_terima_unpack_sewing'
});
const SerieTerimaFinishing = buatTabTerima({
  koleksi: 'finishing_track', statusMenunggu: 'kirim_finishing', statusSetelah: 'terima_finishing', namaAsal: 'Finishing',
  judul: 'Terima Finishing', kosongTeks: 'Tidak ada batch yang sedang ditunggu dari Finishing', icon: 'fa-truck-ramp-box',
  baggingArray: false, fieldBagging: 'kode_bagging',
  targetIdScan: 'sub-pr-serie-terimafinishing', aksiIdSampai: 'serie_terima_sampai_finishing', aksiIdUnpack: 'serie_terima_unpack_finishing'
});


// TAB 2.11: Selesai — riwayat lengkap, read-only. Baris masuk saat Gudang Barang
// Jadi menulis `spk_separating.status = 'selesai'` + `sampai_pada`. Modul itu
// belum ada, jadi tab ini tampil kosong — gap disengaja, bukan bug modul ini.

const SerieSelesai = {
  setup() {
    const memuat = ref(true);
    const semuaSelesai = ref([]);
    const kataKunci = ref('');
    const dariTanggal = ref('');
    const sampaiTanggal = ref('');

    async function muat() {
      memuat.value = true;
      try { semuaSelesai.value = saringMilikOperator((await muatSemuaSeparatingBatch()).filter(b => b.status === 'selesai')).sort((a, b) => new Date(b.sampai_pada || 0) - new Date(a.sampai_pada || 0)); }
      catch (e) { console.error('Gagal muat Serie > Selesai:', e); semuaSelesai.value = []; }
      memuat.value = false;
    }

    const selesaiHariIni = computed(() => semuaSelesai.value.filter(b => hariIniSama(b.sampai_pada)));

    const daftarUrut = computed(() => {
      let hasil = semuaSelesai.value;
      const kata = kataKunci.value.trim().toLowerCase();
      if (kata) hasil = hasil.filter(b => (b.kode_separating || '').toLowerCase().includes(kata) || (b.nama_produk || '').toLowerCase().includes(kata));
      if (dariTanggal.value) hasil = hasil.filter(b => b.sampai_pada && new Date(b.sampai_pada) >= new Date(dariTanggal.value));
      if (sampaiTanggal.value) hasil = hasil.filter(b => b.sampai_pada && new Date(b.sampai_pada) <= new Date(sampaiTanggal.value + 'T23:59:59'));
      return hasil;
    });

    function unduhCsv() {
      if (!daftarUrut.value.length) { alert('Tidak ada data untuk diunduh.'); return; }
      const header = ['Kode Batch', 'Produk', 'Size', 'Qty', 'Operator', 'Kode Tugas Terakhir', 'Selesai Pada'];
      const baris = daftarUrut.value.map(b => [b.kode_separating, b.nama_produk, b.size, b.qty, b.operator_nama, b.kode_tugas, formatWaktu(b.sampai_pada)]);
      const csv = [header, ...baris].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `serie-selesai-${new Date().toISOString().slice(0, 10)}.csv`;
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
        <input v-model="kataKunci" type="text" placeholder="Cari kode batch / produk..." style="flex:2; min-width:160px; padding:8px; background:var(--ivory-dim); border-radius:10px; border:1px solid var(--line);">
        <input v-model="dariTanggal" type="date" style="flex:1; min-width:130px; padding:8px; border-radius:10px; border:1px solid var(--line);">
        <input v-model="sampaiTanggal" type="date" style="flex:1; min-width:130px; padding:8px; border-radius:10px; border:1px solid var(--line);">
        <button @click="unduhCsv" class="btn-outline" style="padding:8px 14px; font-size:11.5px;"><i class="fas fa-download" style="margin-right:6px;"></i>Unduh CSV</button>
      </div>

      <div v-if="daftarUrut.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-circle-check"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada riwayat Selesai</h3>
        <p style="font-size:11px; color:var(--text-faint); margin-top:6px;">Tab ini terisi otomatis begitu modul Gudang Barang Jadi (belum dibangun) menulis balik status selesai ke sini — bukan error.</p>
      </div>
      <div v-else class="gc-card" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead><tr style="text-align:left; border-bottom:1px solid var(--line);">
            <th style="padding:6px 8px;">Kode Batch</th><th style="padding:6px 8px;">Produk</th><th style="padding:6px 8px;">Qty</th>
            <th style="padding:6px 8px;">Operator</th><th style="padding:6px 8px;">Kode Tugas Terakhir</th><th style="padding:6px 8px;">Selesai</th>
          </tr></thead>
          <tbody>
            <tr v-for="b in daftarUrut" :key="b.id" style="border-bottom:1px solid var(--line);">
              <td style="padding:6px 8px;" class="gc-num">{{ b.kode_separating }}</td>
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

// Mount ke index.html — LAZY, SAMA pola seperti Cutting: fungsi
// window.pastikanMountSerieXxx dipanggil oleh pindahSubTab (js/ dashboard.js,
// peta petaMount) PERTAMA KALI tab itu dibuka.
let vmSeriePerluDiProses = null;
window.pastikanMountSeriePerluDiProses = function () {
  if (vmSeriePerluDiProses) { if (typeof vmSeriePerluDiProses.muat === 'function') vmSeriePerluDiProses.muat(); return; }
  const mountPoint = document.getElementById('vue-serie-perludiproses');
  if (mountPoint) vmSeriePerluDiProses = createApp(SeriePerluDiProses).mount('#vue-serie-perludiproses');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaSerieSampai = function () { window.pastikanMountSeriePerluDiProses(); if (vmSeriePerluDiProses) vmSeriePerluDiProses.bukaScanSampai(); };
window.bukaSerieUnpack = function () { window.pastikanMountSeriePerluDiProses(); if (vmSeriePerluDiProses) vmSeriePerluDiProses.unpackTerpadu.buka(); };
let vmSerieSedangDiProses = null;
window.pastikanMountSerieSedangDiProses = function () {
  if (vmSerieSedangDiProses) { if (typeof vmSerieSedangDiProses.muat === 'function') vmSerieSedangDiProses.muat(); return; }
  const mountPoint = document.getElementById('vue-serie-sedangdiproses');
  if (mountPoint) vmSerieSedangDiProses = createApp(SerieSedangDiProses).mount('#vue-serie-sedangdiproses');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaSerieOperator = function () { window.pastikanMountSerieSedangDiProses(); if (vmSerieSedangDiProses) vmSerieSedangDiProses.bukaScanOperatorToolbar(); };
window.bukaSerieEntry = function () { window.pastikanMountSerieSedangDiProses(); if (vmSerieSedangDiProses) vmSerieSedangDiProses.bukaScanEntryToolbar(); };
let vmSeriePerluDiKirim = null;
window.pastikanMountSeriePerluDiKirim = function () {
  if (vmSeriePerluDiKirim) { if (typeof vmSeriePerluDiKirim.muat === 'function') vmSeriePerluDiKirim.muat(); return; }
  const mountPoint = document.getElementById('vue-serie-perludikirim');
  if (mountPoint) vmSeriePerluDiKirim = createApp(SeriePerluDiKirim).mount('#vue-serie-perludikirim');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaSeriePack = function () { window.pastikanMountSeriePerluDiKirim(); if (vmSeriePerluDiKirim) vmSeriePerluDiKirim.bukaScanPack(); };
let vmSerieKirimSewing = null;
window.pastikanMountSerieKirimSewing = function () {
  if (vmSerieKirimSewing) { if (typeof vmSerieKirimSewing.muat === 'function') vmSerieKirimSewing.muat(); return; }
  const mountPoint = document.getElementById('vue-serie-kirimsewing');
  if (mountPoint) vmSerieKirimSewing = createApp(SerieKirimSewing).mount('#vue-serie-kirimsewing');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaSerieKirimSewing = function () { window.pastikanMountSerieKirimSewing(); if (vmSerieKirimSewing) vmSerieKirimSewing.bukaScanKirim(); };
let vmSerieSetorSewing = null;
window.pastikanMountSerieSetorSewing = function () {
  if (vmSerieSetorSewing) { if (typeof vmSerieSetorSewing.muat === 'function') vmSerieSetorSewing.muat(); return; }
  const mountPoint = document.getElementById('vue-serie-setorsewing');
  if (mountPoint) vmSerieSetorSewing = createApp(SerieSetorSewing).mount('#vue-serie-setorsewing');
};
let vmSerieTerimaSewing = null;
window.pastikanMountSerieTerimaSewing = function () {
  if (vmSerieTerimaSewing) { if (typeof vmSerieTerimaSewing.muat === 'function') vmSerieTerimaSewing.muat(); return; }
  const mountPoint = document.getElementById('vue-serie-terimasewing');
  if (mountPoint) vmSerieTerimaSewing = createApp(SerieTerimaSewing).mount('#vue-serie-terimasewing');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaSerieTerimaSampaiSewing = function () { window.pastikanMountSerieTerimaSewing(); if (vmSerieTerimaSewing) vmSerieTerimaSewing.bukaScanSampai(); };
window.bukaSerieTerimaUnpackSewing = function () { window.pastikanMountSerieTerimaSewing(); if (vmSerieTerimaSewing) vmSerieTerimaSewing.unpackTerpadu.buka(); };
let vmSerieKirimFinishing = null;
window.pastikanMountSerieKirimFinishing = function () {
  if (vmSerieKirimFinishing) { if (typeof vmSerieKirimFinishing.muat === 'function') vmSerieKirimFinishing.muat(); return; }
  const mountPoint = document.getElementById('vue-serie-kirimfinishing');
  if (mountPoint) vmSerieKirimFinishing = createApp(SerieKirimFinishing).mount('#vue-serie-kirimfinishing');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaSerieKirimFinishing = function () { window.pastikanMountSerieKirimFinishing(); if (vmSerieKirimFinishing) vmSerieKirimFinishing.bukaScanKirim(); };
let vmSerieSetorFinishing = null;
window.pastikanMountSerieSetorFinishing = function () {
  if (vmSerieSetorFinishing) { if (typeof vmSerieSetorFinishing.muat === 'function') vmSerieSetorFinishing.muat(); return; }
  const mountPoint = document.getElementById('vue-serie-setorfinishing');
  if (mountPoint) vmSerieSetorFinishing = createApp(SerieSetorFinishing).mount('#vue-serie-setorfinishing');
};
let vmSerieTerimaFinishing = null;
window.pastikanMountSerieTerimaFinishing = function () {
  if (vmSerieTerimaFinishing) { if (typeof vmSerieTerimaFinishing.muat === 'function') vmSerieTerimaFinishing.muat(); return; }
  const mountPoint = document.getElementById('vue-serie-terimafinishing');
  if (mountPoint) vmSerieTerimaFinishing = createApp(SerieTerimaFinishing).mount('#vue-serie-terimafinishing');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaSerieTerimaSampaiFinishing = function () { window.pastikanMountSerieTerimaFinishing(); if (vmSerieTerimaFinishing) vmSerieTerimaFinishing.bukaScanSampai(); };
window.bukaSerieTerimaUnpackFinishing = function () { window.pastikanMountSerieTerimaFinishing(); if (vmSerieTerimaFinishing) vmSerieTerimaFinishing.unpackTerpadu.buka(); };
let vmSerieKirimGudang = null;
window.pastikanMountSerieKirimGudang = function () {
  if (vmSerieKirimGudang) { if (typeof vmSerieKirimGudang.muat === 'function') vmSerieKirimGudang.muat(); return; }
  const mountPoint = document.getElementById('vue-serie-kirimgudang');
  if (mountPoint) vmSerieKirimGudang = createApp(SerieKirimGudang).mount('#vue-serie-kirimgudang');
};
// Jembatan Bottom Sheet Pilihan Scan (js/vue-popup-scan.js).
window.bukaSerieKirimGudang = function () { window.pastikanMountSerieKirimGudang(); if (vmSerieKirimGudang) vmSerieKirimGudang.bukaScanKirim(); };
let vmSerieSelesai = null;
window.pastikanMountSerieSelesai = function () {
  if (vmSerieSelesai) { if (typeof vmSerieSelesai.muat === 'function') vmSerieSelesai.muat(); return; }
  const mountPoint = document.getElementById('vue-serie-selesai');
  if (mountPoint) vmSerieSelesai = createApp(SerieSelesai).mount('#vue-serie-selesai');
};
