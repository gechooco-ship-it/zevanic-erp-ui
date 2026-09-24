// js/vue-persiapan-produksi-v2.js
// Persiapan Produksi. (1) Perlu Persiapan: tiap ID Order dipecah per kelipatan order jadi
// SPK Separating `S{YY}R{MM}{DD}P{nnn}` + kartu ACC/Vendor per separating;
// (2) PanelGroupingBahan (diekspor, dipasang di Bahan) menggabung separating
// sepola jadi SPK Grouping `GR{yymmdd}{nn}`; (3) JalurTahapManager = Vendor.
//
// Koleksi & field:
// - order: qty_terseparating (akumulatif), separating_ids[], status_separating.
// - spk_separating: 1 dokumen per Kode Separating (qty, jalur_aktif, grouping_id,
//   status: perlu_disiapkan, lalu status Collection sampai selesai di Gudang).
// - spk_track: ACC/Vendor per separating (kode_kit = kode + -SEW/-WEB/-FIN/-VDR);
//   Bahan per grouping (separating_ids[], bahan_rincian per separating per bahan).
//
// Jebakan:
// - Kunci grouping = nama + ukuran + pola dari master_produk lewat sku_produk,
//   BUKAN order.nama_produk (string gabungan nama warna size).
// - kode_baris adalah isi QR label: Bahan `{S…}-{GR…}-{tujuan}{nn}`, ACC
//   `{S…}-{tujuan}{nn}`; daftar_kode[] disalin ke spk_track untuk pencarian scan.
// - Menu-id 'pp_disiapkan' dan id mount lama dipertahankan (izin role tetap).

import { createApp, ref, reactive, computed, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel, KolomCari } from './vue-components.js?v=13';
import { ambilSemuaProduk } from './vue-master-produk.js';
import { aksiAktif, pastikanCachePilihanScan } from './vue-popup-scan.js?v=7';

// picOwnerKeAtas — "Buat SPK Grouping" dan "Tunjuk/Scan Operator" wajib akun
// tier pic/pic_owner/owner/superuser, TANPA popup PIN: cukup tier akun yang
// login. Beda dari `tierOwnerKeAtas` (vue-pesanan.js) yang menuntut Owner/PIC
// Owner spesifik — di sini PIC biasa sudah cukup.
function picOwnerKeAtas(userData) {
  if (!userData) return false;
  const role = (userData.role || '').toLowerCase();
  return role === 'owner' || role === 'superuser' || role === 'pic';
}


// 1 SPK boleh ikut >1 grouping: order_spk.qty_tergrouping AKUMULATIF (jangan
// ditimpa), grouping_ids arrayUnion, status_grouping ''|'sebagian'|'tergrouping',
// id_spk_grouping = grouping TERAKHIR saja; antrean filter sisa qty > 0. Warna
// baris diambil dari master_produk.warna (order_spk tidak punya field warna).


const PETA_JALUR = {
  vendor: { label: 'Vendor', icon: 'fa-handshake', tag: 'pink' },
  bahan: { label: 'Bahan', icon: 'fa-scroll', tag: 'blue' },
  sewing: { label: 'Acc Sewing', icon: 'fa-scissors', tag: 'ok' },
  webbing: { label: 'Acc Webbing', icon: 'fa-ribbon', tag: 'ok' },
  finishing: { label: 'Acc Finishing', icon: 'fa-check-double', tag: 'ok' }
};

function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

// kunciPolaProduk — tanda-tangan SET pola (panjang+isi_pola_pcs, diurutkan
// supaya urutan input di form Master Produk tidak mempengaruhi hasil
// cocok/tidaknya), baris kosong (panjang=0 & isi=0) diabaikan sama seperti
// hitungKelipatan di vue-master-produk.js.
function kunciPolaProduk(produk) {
  const baris = (produk?.bom_pola || [])
    .map(b => ({ p: parseFloat(b.panjang) || 0, i: parseFloat(b.isi_pola_pcs) || 0 }))
    .filter(b => b.p > 0 || b.i > 0)
    .sort((a, b) => (a.p - b.p) || (a.i - b.i));
  if (baris.length === 0) return '';
  return baris.map(b => `${b.p}x${b.i}`).join('|');
}

// kunciGrupProduk — tanda-tangan klaster: nama + SIZE + kunci pola. Kalau kunci
// pola kosong (BOM Pola belum lengkap) return '' supaya produk itu tidak ikut
// klaster manapun dan tampil terpisah sebagai "pola belum dikunci".
function kunciGrupProduk(produk) {
  const kp = kunciPolaProduk(produk);
  if (!kp) return '';
  const nama = (produk?.nama || '').trim().toLowerCase();
  const size = (produk?.size || '').trim().toLowerCase();
  return `${nama}::${size}::${kp}`;
}

// jalurOtomatisProduk — `tahap_proses` adalah teks bebas (bukan strict-select),
// dicocokkan longgar (contains, case-insensitive) supaya variasi penulisan
// "Sewing"/"sewing "/"SEWING" tetap terdeteksi.
function jalurOtomatisProduk(produk) {
  const jalur = new Set();
  const adaBahan = (produk?.bom_pola || []).some(b => (parseFloat(b.panjang) || 0) > 0 || (parseFloat(b.isi_pola_pcs) || 0) > 0);
  if (adaBahan) jalur.add('bahan');
  (produk?.bom_aksesoris || []).forEach(a => {
    const t = (a.tahap_proses || '').trim().toLowerCase();
    if (!t) return;
    if (t.includes('sewing')) jalur.add('sewing');
    else if (t.includes('webbing')) jalur.add('webbing');
    else if (t.includes('finishing')) jalur.add('finishing');
  });
  return jalur;
}

function buatQrDataUrl(teks) {
  if (typeof QRCode === 'undefined') return '';
  const tmp = document.createElement('div');
  tmp.style.cssText = 'position:absolute; left:-9999px; top:-9999px; width:160px; height:160px;';
  document.body.appendChild(tmp);
  let dataUrl = '';
  try {
    new QRCode(tmp, { text: String(teks || ''), width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M });
    const canvas = tmp.querySelector('canvas');
    if (canvas) dataUrl = canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Gagal generate QR:', teks, e);
  }
  document.body.removeChild(tmp);
  return dataUrl;
}

// kodeTanggal — yymmdd tanggal WIB, dipakai semua counter harian file ini.
function kodeTanggal() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(2).replace(/-/g, '');
}

// generateKodeSeparating — `S{YY}R{MM}{DD}P{nnn}`, counter per hari di
// pengaturan_id_spk_separating (transaksi supaya 2 PIC tidak dapat nomor sama).
async function generateKodeSeparating() {
  const t = kodeTanggal();
  const refDoc = doc(db, 'pengaturan_id_spk_separating', t);
  return await runTransaction(db, async (trx) => {
    const snap = await trx.get(refDoc);
    const n = (snap.exists() ? (snap.data().counter || 0) : 0) + 1;
    if (snap.exists()) trx.update(refDoc, { counter: n }); else trx.set(refDoc, { counter: n, dibuat_pada: t });
    return `S${t.slice(0, 2)}R${t.slice(2, 4)}${t.slice(4, 6)}P${String(n).padStart(3, '0')}`;
  });
}

// generateKodeGroupingInduk — `GR{yymmdd}{nn}`, counter per hari di
// pengaturan_id_spk_grouping. Hanya jalur Bahan yang digrouping.
async function generateKodeGroupingInduk() {
  const t = kodeTanggal();
  const refDoc = doc(db, 'pengaturan_id_spk_grouping', t);
  return await runTransaction(db, async (trx) => {
    const snap = await trx.get(refDoc);
    const n = (snap.exists() ? (snap.data().counter || 0) : 0) + 1;
    if (snap.exists()) trx.update(refDoc, { counter: n }); else trx.set(refDoc, { counter: n, dibuat_pada: t });
    return `GR${t}${String(n).padStart(2, '0')}`;
  });
}

// AKHIRAN_KIT — akhiran Kode Kit ACC per jalur. Kode kit unik lintas jalur
// supaya kit yang tertukar ditolak saat scan.
const AKHIRAN_KIT = { sewing: 'SEW', webbing: 'WEB', finishing: 'FIN', vendor: 'VDR' };

// usulPecahanMoq — 30 pcs, kelipatan 10 → [10,10,10]. Kelipatan kosong/0 →
// satu separating berisi semua.
export function usulPecahanMoq(qty, moq) {
  const total = Math.max(0, Math.floor(parseFloat(qty) || 0));
  const m = Math.floor(parseFloat(moq) || 0);
  if (!total) return [];
  if (!(m > 0) || m >= total) return [total];
  const hasil = [];
  let sisa = total;
  while (sisa >= m) { hasil.push(m); sisa -= m; }
  if (sisa > 0) hasil.push(sisa);
  return hasil;
}

// buatSpkTrackSeparating — 1 dokumen spk_track per jalur ACC/Vendor per
// separating. kode_kit = Kode Separating + akhiran jalur, itu yang dicetak.
async function buatSpkTrackSeparating(sep, jalur, rincian) {
  const kodeKit = `${sep.kode_separating}-${AKHIRAN_KIT[jalur] || jalur.toUpperCase()}`;
  const field = jalur + '_rincian';
  const baris = (rincian || []).map(b => ({ ...b, kode_kit: kodeKit }));
  await addDoc(collection(db, 'spk_track'), {
    jalur, separating_id: sep.id, kode_separating: sep.kode_separating, kode_kit: kodeKit,
    separating_ids: [sep.id], order_id: sep.order_id, id_order: sep.id_order,
    grouping_id: '', kode_grouping_induk: '',
    nama_produk: sep.nama_produk, qty_total: sep.qty,
    status: 'perlu_diproses', operator_id: '', operator_nama: '',
    kode_bagging: '', kode_tugas: '', riwayat_scan: [], catatan_masalah: '',
    bahan_rincian: [], sewing_rincian: [], webbing_rincian: [], finishing_rincian: [],
    [field]: jalur === 'vendor' ? [] : baris,
    daftar_kode: [kodeKit, ...baris.map(b => b.kode_baris).filter(Boolean)],
    dibuat_pada: serverTimestamp(), diperbarui_pada: serverTimestamp()
  });
}

// ambilPetaBahanAksesoris — cache modul-level, dipakai hitungBahanRincian saat
// grouping jalur 'bahan' diterbitkan. Koleksinya kecil (semua Bahan & Aksesoris
// toko), pola query DISALIN dari js/vue-scan-persiapan.js.
let _cachePetaBahanAksesoris = null;
async function ambilPetaBahanAksesoris() {
  if (_cachePetaBahanAksesoris) return _cachePetaBahanAksesoris;
  const peta = {};
  try {
    const snap = await getDocs(collection(db, 'master_bahan_aksesoris'));
    snap.forEach(d => { peta[d.id] = d.data(); });
  } catch (e) {
    console.error('Gagal ambil master_bahan_aksesoris:', e);
  }
  _cachePetaBahanAksesoris = peta;
  return peta;
}

// ambilPetaKodeTujuanDivisi — kode_tujuan 2 digit per jalur dari
// `master_prefix_divisi` (doc id = jalur, BUKAN field jalur_key di data).
let _cachePetaKodeTujuan = null;
async function ambilPetaKodeTujuanDivisi() {
  if (_cachePetaKodeTujuan) return _cachePetaKodeTujuan;
  const peta = {};
  try {
    const snap = await getDocs(collection(db, 'master_prefix_divisi'));
    snap.forEach(d => { const x = d.data(); if (x.kode_tujuan) peta[d.id] = x.kode_tujuan; });
  } catch (e) { console.error('Gagal ambil master_prefix_divisi (kode tujuan):', e); }
  _cachePetaKodeTujuan = peta;
  return peta;
}

// tandaiKodeBahan — kode_grouping `{GR}-{tujuan}{nn}` per bahan+pola dalam satu
// grouping; kode_baris (label bahan) `{kode_separating}-{kode_grouping}`, satu
// per separating per bahan. kode_kartu/kode_komponen diisi untuk pembaca lama.
function tandaiKodeBahan(baris, kodeGr, kodeTujuan) {
  const urut = {};
  baris.forEach(b => {
    const key = b.bahan_aksesoris_id + '::' + (b.nama_pola || '');
    if (!(key in urut)) urut[key] = Object.keys(urut).length + 1;
    b.kode_grouping = `${kodeGr}-${kodeTujuan || '00'}${String(urut[key]).padStart(2, '0')}`;
    b.kode_baris = `${b.kode_separating}-${b.kode_grouping}`;
    b.kode_kartu = b.kode_grouping; b.kode_anak_spk = null; b.kode_komponen = b.kode_baris;
  });
  return baris;
}
// tandaiKodeAcc — kode_baris `{kode_separating}-{tujuan}{nn}` per baris
// aksesoris satu separating. Label fisik kit memakai kode_kit, bukan ini.
function tandaiKodeAcc(baris, kodeTujuan) {
  baris.forEach((b, i) => {
    b.kode_baris = `${b.kode_separating}-${kodeTujuan || '00'}${String(i + 1).padStart(2, '0')}`;
    b.kode_kartu = null; b.kode_anak_spk = null; b.kode_komponen = b.kode_baris;
  });
  return baris;
}

// hitungBahanRincian — 1 baris per BAHAN per ANAK SPK, disimpan denormalisasi di
// spk_track.bahan_rincian[]. Sumber BOM `master_produk.bom_pola[]` (BUKAN
// bom_aksesoris[]), hanya baris tipe:'internal'. Rumus: amparan = qty anak SPK /
// isi_pola_pcs dibulatkan KE ATAS; kebutuhan_kain(m) = (panjang pola cm/100) x amparan.
function hitungBahanRincian(anggotaList, petaBahan, kodeGr, kodeTujuan) {
  const baris = [];
  (anggotaList || []).forEach(a => {
    const produk = a._produk || null;
    const bomPola = (produk && Array.isArray(produk.bom_pola)) ? produk.bom_pola : [];
    bomPola.forEach(b => {
      if ((b.tipe || 'internal') !== 'internal') return; // baris vendor bukan urusan pos Bahan
      if (!b.bahan_aksesoris_id) return; // baris BOM belum terhubung Bahan & Aksesoris -> tidak bisa dihitung
      const isiPola = parseFloat(b.isi_pola_pcs) || 0;
      if (isiPola <= 0) return;
      const panjangCm = parseFloat(b.panjang) || 0;
      const qty = parseFloat(a.qty) || 0;
      const amparan = Math.ceil(qty / isiPola);
      const kebutuhanKain = (panjangCm / 100) * amparan;
      const bhn = petaBahan[b.bahan_aksesoris_id] || {};
      baris.push({
        order_id: a.order_id, id_order: a.id_order, qty,
        separating_id: a.separating_id, kode_separating: a.kode_separating,
        // pelanggan_nama — snapshot dari order (lihat anggotaBaris di
        // atas file), dipakai kartu "ANAK SPK" & label cetak
        // js/vue-persiapan-bahan.js supaya PIC langsung tahu orderan siapa tanpa
        // perlu tampilkan kode TRX mentah.
        pelanggan_nama: a.pelanggan_nama || '',
        bahan_aksesoris_id: b.bahan_aksesoris_id,
        bahan_nama: bhn.nama || '', bahan_warna: bhn.warna || '',
        // rak_label — sumber master_bahan_aksesoris (field sudah ada
        // dari fitur Rak Penyimpanan, lihat js/vue-rak-penyimpanan.js).
        // ambilPetaBahanAksesoris spread seluruh dokumen jadi bhn di atas SUDAH
        // punya field ini — tinggal disalin ke baris tanpa query baru.
        rak_label: bhn.rak_label || '',
        nama_pola: b.nama_pola || '',
        // produk_size — dipakai js/vue-persiapan-bahan.js buat "syarat
        // sepack" . spk_track sendiri TIDAK simpan size (cuma nama_produk), jadi
        // diambil di sini dari produk anak SPK-nya.
        produk_size: (produk && produk.size) || '',
        // produk_warna — SAMA POLA seperti produk_size di atas, diambil
        // dari produk anak SPK-nya, bukan dari bahan (bahan_warna sudah ada
        // terpisah, itu warna KAIN, bukan warna produknya).
        produk_warna: (produk && produk.warna) || '',
        panjang_pola: panjangCm, isi_pola_pcs: isiPola,
        amparan, kebutuhan_kain: kebutuhanKain,
        // status per BARIS (bukan per grouping) — inilah yang dipakai
        // js/vue-persiapan-bahan.js buat nentuin baris ini ada di tab mana:
        // perlu_disiapkan -> sedang_disiapkan -> perlu_dikirim -> sedang_dikirim
        // -> selesai.
        status: 'perlu_disiapkan',
        // masuk_tahap_pada — string ISO, BUKAN serverTimestamp: Firestore tidak
        // izinkan sentinel serverTimestamp di dalam elemen array. Diperbarui tiap
        // `status` baris pindah tahap; dasar hitung "diam sejak"/ambang tertahan.
        masuk_tahap_pada: new Date().toISOString(),
        label_cetak_pada: null,
        operator_uid: '', operator_nama: '', ditugaskan_pada: null,
        // riwayat_operator — estafet shift . Tiap kali baris ini di-scan-tunjuk
        // ulang oleh operator LAIN sebelum selesai, entry baru ditambah di sini
        // (bukan menimpa) supaya riwayat siapa-pegang-apa-jam-berapa tetap
        // kebaca di kartu.
        riwayat_operator: [],
        entry_qty: null, entry_oleh: '', entry_pada: null,
        catatan_masalah: '',
        kode_bagging: '', kode_tugas: '',
        kode_kartu: null, kode_anak_spk: null, kode_komponen: null // diisi tandaiKodeGrouping di bawah
      });
    });
  });
  return tandaiKodeBahan(baris, kodeGr, kodeTujuan);
}

// hitungSewingRincian / hitungWebbingRincian / hitungFinishingRincian — pola sama dengan
// hitungBahanRincian tapi sumber `master_produk.bom_aksesoris[]`, disaring `tahap_proses`
// dengan pencocokan longgar yang SAMA dengan jalurOtomatisProduk. Kartu = SATU dokumen
// spk_track (bukan kumulatif lintas grouping seperti Bahan): cek stok per baris vs stok live.
function _butuhAksesorisDasar(a, qty) {
  const produk = a._produk || null;
  return {
    order_id: a.order_id, id_order: a.id_order, qty,
    separating_id: a.separating_id, kode_separating: a.kode_separating,
    // pelanggan_nama — sama pola seperti hitungBahanRincian di atas, dipakai
    // kartu & label cetak Acc Sewing/Webbing/Finishing.
    pelanggan_nama: a.pelanggan_nama || '',
    // produk_warna — sama pola seperti hitungBahanRincian: diambil dari produk
    // anak SPK-nya (bukan dari aksesoris), dipakai label cetak supaya kolom
    // "nama produk + warna produk" konsisten dengan Bahan (lihat
    // bangunLabelAksesoris di js/vue-components.js).
    produk_warna: (produk && produk.warna) || '',
    bahan_aksesoris_id: '', nama_aksesoris: '', warna: '',
    status: 'perlu_disiapkan',
    masuk_tahap_pada: new Date().toISOString(),
    label_cetak_pada: null,
    operator_uid: '', operator_nama: '', ditugaskan_pada: null,
    riwayat_operator: [],
    entry_qty: null, entry_oleh: '', entry_pada: null,
    catatan_masalah: '',
    kode_bagging: '', kode_tugas: '',
    kode_kartu: null, kode_anak_spk: null, kode_komponen: null // diisi tandaiKodeGrouping di bawah
  };
}
function hitungSewingRincian(anggotaList, petaBahan, kodeTujuan) {
  const baris = [];
  (anggotaList || []).forEach(a => {
    const produk = a._produk || null;
    const bomAks = (produk && Array.isArray(produk.bom_aksesoris)) ? produk.bom_aksesoris : [];
    const qty = parseFloat(a.qty) || 0;
    bomAks.forEach(k => {
      const t = (k.tahap_proses || '').trim().toLowerCase();
      if (!t.includes('sewing')) return;
      if (!k.bahan_aksesoris_id) return; // baris BOM belum terhubung Bahan & Aksesoris -> tidak bisa dihitung
      const qtyPerPcs = parseFloat(k.qty) || 0;
      const bhn = petaBahan[k.bahan_aksesoris_id] || {};
      baris.push({
        ..._butuhAksesorisDasar(a, qty),
        bahan_aksesoris_id: k.bahan_aksesoris_id,
        nama_aksesoris: bhn.nama || '', warna: bhn.warna || '',
        // produk_size — SAMA alasan seperti hitungBahanRincian: dipakai "syarat
        // sepack" .
        produk_size: (produk && produk.size) || '',
        qty_per_pcs: qtyPerPcs, satuan: (k.satuan || 'pcs').trim() || 'pcs',
        butuh: qtyPerPcs * qty
      });
    });
  });
  return tandaiKodeAcc(baris, kodeTujuan);
}
// hitungWebbingRincian — sama seperti hitungSewingRincian, TAMBAH kolom khas pos
// ini : panjang_per_pcs/ butuh_meter (meter, bukan pcs), roll, kode_webbing2/3
// (snapshot bom_aksesoris.webbing2/.webbing3 SAAT SPK Grouping terbit — teks
// bebas, boleh kosong, TIDAK menghalangi cetak per ).
function hitungWebbingRincian(anggotaList, petaBahan, kodeTujuan) {
  const baris = [];
  (anggotaList || []).forEach(a => {
    const produk = a._produk || null;
    const bomAks = (produk && Array.isArray(produk.bom_aksesoris)) ? produk.bom_aksesoris : [];
    const qty = parseFloat(a.qty) || 0;
    bomAks.forEach(k => {
      const t = (k.tahap_proses || '').trim().toLowerCase();
      if (!t.includes('webbing')) return;
      if (!k.bahan_aksesoris_id) return;
      const panjangPerPcs = parseFloat(k.qty) || 0;
      const butuhMeter = panjangPerPcs * qty;
      const bhn = petaBahan[k.bahan_aksesoris_id] || {};
      const panjangRoll = parseFloat(bhn.panjang_roll) || 0;
      baris.push({
        ..._butuhAksesorisDasar(a, qty),
        bahan_aksesoris_id: k.bahan_aksesoris_id,
        nama_aksesoris: bhn.nama || '', warna: bhn.warna || '',
        produk_size: (produk && produk.size) || '',
        qty_per_pcs: panjangPerPcs, satuan: 'meter',
        butuh: butuhMeter,
        panjang_per_pcs: panjangPerPcs, butuh_meter: butuhMeter,
        roll: panjangRoll > 0 ? Math.ceil(butuhMeter / panjangRoll) : null,
        kode_webbing2: (k.webbing2 || '').trim(), kode_webbing3: (k.webbing3 || '').trim()
      });
    });
  });
  return tandaiKodeAcc(baris, kodeTujuan);
}
// hitungFinishingRincian — seperti hitungSewingRincian, tambah kolom khas pos ini:
// varian_tipe/varian_jumlah (default 'tunggal'/1 saat generate karena BOM Aksesoris
// belum punya field pemisah varian) dan keadaan_cetak/sisa_dicetak yang SENGAJA
// tidak disimpan — dihitung live di vue-persiapan-finishing.js dari stok vs `butuh`.
function hitungFinishingRincian(anggotaList, petaBahan, kodeTujuan) {
  const baris = [];
  (anggotaList || []).forEach(a => {
    const produk = a._produk || null;
    const bomAks = (produk && Array.isArray(produk.bom_aksesoris)) ? produk.bom_aksesoris : [];
    const qty = parseFloat(a.qty) || 0;
    bomAks.forEach(k => {
      const t = (k.tahap_proses || '').trim().toLowerCase();
      if (!t.includes('finishing')) return;
      if (!k.bahan_aksesoris_id) return;
      const qtyPerPcs = parseFloat(k.qty) || 0;
      const bhn = petaBahan[k.bahan_aksesoris_id] || {};
      baris.push({
        ..._butuhAksesorisDasar(a, qty),
        bahan_aksesoris_id: k.bahan_aksesoris_id,
        nama_aksesoris: bhn.nama || '', warna: bhn.warna || '',
        produk_size: (produk && produk.size) || '',
        qty_per_pcs: qtyPerPcs, satuan: (k.satuan || 'pcs').trim() || 'pcs',
        butuh: qtyPerPcs * qty,
        varian_tipe: 'tunggal', varian_jumlah: 1
      });
    });
  });
  return tandaiKodeAcc(baris, kodeTujuan);
}

// cariKaryawanByQr — QR pribadi berisi id_app (prioritas) ATAU email (fallback).
// Email juga dipakai sebagai document ID koleksi users, makanya dicoba query
// id_app dulu, baru getDoc langsung memakai hasil scan sebagai email/doc id.
async function cariKaryawanByQr(qrData) {
  const qSnap = await getDocs(query(collection(db, 'users'), where('id_app', '==', qrData)));
  if (!qSnap.empty) return { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
  const docSnap = await getDoc(doc(db, 'users', qrData));
  if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
  return null;
}

// muatJsQr — DISALIN dari js/vue-scan-persiapan.js (konvensi yang sama).
function muatJsQr() {
  return new Promise((resolve, reject) => {
    if (window.jsQR) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// cekPecahan — aturan pecahan separating: total WAJIB = qty keputusan QO yang
// tersisa, tiap pecahan kelipatan acuan order (master_produk.kelipatan). QO
// sendiri sudah dikunci kelipatan di Menunggu Proses, jadi tidak ada sisa.
// MOQ suplayer (master_suplayer) urusan belanja, tidak dipakai di sini.
export function cekPecahan(pecahan, sisaQo, kelipatan) {
  const angka = (pecahan || []).map(x => parseFloat(x) || 0);
  if (!angka.length || angka.some(x => x <= 0 || !Number.isInteger(x))) return 'Tiap pecahan wajib angka bulat lebih dari 0.';
  const k = Math.floor(parseFloat(kelipatan) || 0);
  if (k > 0 && sisaQo % k !== 0) return `Keputusan QO ${sisaQo} pcs bukan kelipatan ${k}. QO wajib kelipatan acuan order.`;
  const total = angka.reduce((t, x) => t + x, 0);
  if (total !== sisaQo) return `Total pecahan ${total} harus sama dengan keputusan QO ${sisaQo} pcs.`;
  if (k > 0 && angka.some(x => x % k !== 0)) return `Tiap pecahan wajib kelipatan ${k} (acuan order Master Produk).`;
  return '';
}

// PerluPersiapanManager — tab Perlu Persiapan. Satu kartu = satu ID Order
// (sudah diputus QO) yang masih punya sisa qty. "Buat SPK Separating" memecah
// qty per kelipatan acuan order (cekPecahan), lalu tiap separating langsung
// dapat kartu ACC/Vendor per jalur. Tidak mencetak label di sini.
const PerluPersiapanManager = {
  components: { KolomCari },
  setup() {
    const memuat = ref(true);
    const daftarOrder = ref([]);
    const cari = ref('');
    const editor = reactive({}); // orderId -> { pecahan:[number], vendor:bool }
    const sedangProses = reactive({});
    const hasilTerbit = ref(null); // { idOrder, kode:[...] }

    const menuId = 'pp_disiapkan';
    const bolehProses = computed(() => picOwnerKeAtas(window.currentUser) && window.cekIzinMenu(menuId, 'add') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const [snapOrder, produk] = await Promise.all([
          getDocs(query(collection(db, 'order'), where('status', '==', 'Aktif'), where('qo_diproses', '==', true))),
          ambilSemuaProduk()
        ]);
        const petaProduk = {};
        produk.forEach(p => { if (p.sku) petaProduk[p.sku] = p; });
        const list = [];
        snapOrder.forEach(d => {
          const data = d.data();
          const sisa = (parseFloat(data.qty_order) || 0) - (parseFloat(data.qty_terseparating) || 0);
          if (sisa <= 0) return;
          const p = data.sku_produk ? (petaProduk[data.sku_produk] || null) : null;
          list.push({ id: d.id, ...data, _produk: p, _sisaQty: sisa, _kelipatan: p ? (parseFloat(p.kelipatan) || 0) : 0,
            _jalur: p ? Array.from(jalurOtomatisProduk(p)) : [] });
        });
        list.sort((a, b) => (a.id_order || '').localeCompare(b.id_order || ''));
        daftarOrder.value = list;
      } catch (e) { console.error('Gagal muat Perlu Persiapan:', e); alert('Gagal memuat Perlu Persiapan. Coba lagi.'); daftarOrder.value = []; }
      memuat.value = false;
    }

    const daftarTampil = computed(() => {
      const kata = cari.value.trim().toLowerCase();
      if (!kata) return daftarOrder.value;
      return daftarOrder.value.filter(o => (o.id_order || '').toLowerCase().includes(kata) || (o.nama_produk || '').toLowerCase().includes(kata) || (o.pelanggan_nama || '').toLowerCase().includes(kata));
    });

    function bukaEditor(o) {
      editor[o.id] = { pecahan: usulPecahanMoq(o._sisaQty, o._kelipatan), vendor: false };
    }
    function tutupEditor(o) { delete editor[o.id]; }
    function totalPecahan(o) { return (editor[o.id]?.pecahan || []).reduce((t, x) => t + (parseFloat(x) || 0), 0); }
    function tambahPecahan(o) { editor[o.id].pecahan.push(o._kelipatan || 0); }
    function galatPecahan(o) { return editor[o.id] ? cekPecahan(editor[o.id].pecahan, o._sisaQty, o._kelipatan) : ''; }
    function hapusPecahan(o, i) { editor[o.id].pecahan.splice(i, 1); }

    async function buatSeparating(o) {
      const ed = editor[o.id];
      if (!ed || sedangProses[o.id]) return;
      const galat = cekPecahan(ed.pecahan, o._sisaQty, o._kelipatan);
      if (galat) { alert(galat); return; }
      const pecahan = ed.pecahan.map(x => parseFloat(x) || 0);
      const total = pecahan.reduce((t, x) => t + x, 0);
      if (!o._produk && !ed.vendor) { alert('Order ini belum terhubung Master Produk: jalur tidak terdeteksi. Hubungkan SKU dulu, atau centang Vendor.'); return; }
      const jalurAktif = Array.from(new Set([...o._jalur, ...(ed.vendor ? ['vendor'] : [])]));
      if (!jalurAktif.length) { alert('Tidak ada jalur produksi terdeteksi dari BOM produk ini.'); return; }
      sedangProses[o.id] = true;
      const kodeTerbit = [];
      try {
        const petaBahan = await ambilPetaBahanAksesoris();
        const petaTujuan = await ambilPetaKodeTujuanDivisi();
        const idBaru = [];
        for (let i = 0; i < pecahan.length; i++) {
          const kode = await generateKodeSeparating();
          const data = {
            kode_separating: kode, order_id: o.id, id_order: o.id_order, pesanan_id: o.pesanan_id || '', no_pesanan: o.no_pesanan || '',
            pelanggan_nama: o.pelanggan_nama || '', sku_produk: o.sku_produk || '', nama_produk: o._produk?.nama || o.nama_produk || '',
            warna: o._produk?.warna || '', size: o._produk?.size || '',
            qty: pecahan[i], urutan: i + 1, jumlah_pecahan: pecahan.length, jalur_aktif: jalurAktif,
            grouping_id: '', kode_grouping_induk: '', status: 'perlu_disiapkan',
            komponen_rincian: [], label_dicetak_pada: null,
            dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
          };
          const ref = await addDoc(collection(db, 'spk_separating'), data);
          const sep = { id: ref.id, ...data };
          idBaru.push(ref.id); kodeTerbit.push(kode);
          const anggota = [{ order_id: o.id, id_order: o.id_order, qty: pecahan[i], _produk: o._produk, pelanggan_nama: o.pelanggan_nama || '', separating_id: ref.id, kode_separating: kode }];
          for (const j of jalurAktif) {
            if (j === 'bahan') continue;
            let rincian = [];
            if (j === 'sewing') rincian = hitungSewingRincian(anggota, petaBahan, petaTujuan.sewing);
            if (j === 'webbing') rincian = hitungWebbingRincian(anggota, petaBahan, petaTujuan.webbing);
            if (j === 'finishing') rincian = hitungFinishingRincian(anggota, petaBahan, petaTujuan.finishing);
            await buatSpkTrackSeparating(sep, j, rincian);
          }
        }
        const terseparating = (parseFloat(o.qty_terseparating) || 0) + total;
        await updateDoc(doc(db, 'order', o.id), {
          qty_terseparating: terseparating, separating_ids: arrayUnion(...idBaru),
          status_separating: terseparating >= (parseFloat(o.qty_order) || 0) ? 'terseparating' : 'sebagian'
        });
        hasilTerbit.value = { idOrder: o.id_order, kode: kodeTerbit, jalur: jalurAktif };
        tutupEditor(o);
        await muat();
      } catch (e) {
        console.error('Gagal buat SPK Separating:', e);
        alert(`Gagal membuat SPK Separating${kodeTerbit.length ? ' (sebagian sudah terbit: ' + kodeTerbit.join(', ') + ')' : ''}. Coba lagi.`);
      }
      sedangProses[o.id] = false;
    }

    onMounted(async () => { await window.authReady; await muat(); });
    return { memuat, muat, cari, daftarTampil, editor, bukaEditor, tutupEditor, totalPecahan, tambahPecahan, hapusPecahan, galatPecahan,
      buatSeparating, sedangProses, bolehProses, hasilTerbit, formatQty, PETA_JALUR };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <div v-else>
      <kolom-cari v-model="cari" placeholder="Cari ID Order / produk / pelanggan..." />
      <div v-if="daftarTampil.length === 0" class="gc-kosong gc-card gc-card-menonjol">
        <div class="lingkaran"><i class="fas fa-circle-check"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada order yang perlu dipersiapkan</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="o in daftarTampil" :key="o.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
            <div style="min-width:0;">
              <div class="gc-num" style="font-weight:700; font-size:12.5px;">{{ o.id_order }}</div>
              <div class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ o.nama_produk }}</div>
              <div style="font-size:11px; color:var(--text-faint);">{{ o.pelanggan_nama || '(tanpa pelanggan)' }} &middot; QO {{ formatQty(o._sisaQty) }} pcs &middot; kelipatan order {{ o._kelipatan || '-' }}</div>
            </div>
            <button v-if="bolehProses && !editor[o.id]" type="button" class="btn-primary" style="padding:7px 12px; font-size:11px; flex-shrink:0;" @click="bukaEditor(o)"><i class="fas fa-layer-group" style="margin-right:5px;"></i>Buat SPK Separating</button>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
            <span v-for="j in o._jalur" :key="j" class="tag" :class="PETA_JALUR[j].tag"><i class="fas" :class="PETA_JALUR[j].icon"></i> {{ PETA_JALUR[j].label }}</span>
            <span v-if="!o._produk" class="tag warn">belum terhubung Master Produk</span>
          </div>
          <div v-if="editor[o.id]" style="margin-top:12px; border:1px dashed var(--line); border-radius:12px; padding:10px 12px;">
            <div style="font-size:10.5px; color:var(--text-muted); margin-bottom:8px;">Pecahan kelipatan {{ o._kelipatan || '-' }} (acuan order Master Produk, boleh diubah). Total {{ formatQty(totalPecahan(o)) }} dari QO {{ formatQty(o._sisaQty) }} pcs.</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
              <div v-for="(x, i) in editor[o.id].pecahan" :key="i" style="display:flex; align-items:center; gap:4px;">
                <span style="font-size:10px; color:var(--text-faint);">#{{ i + 1 }}</span>
                <input type="number" min="1" v-model.number="editor[o.id].pecahan[i]" style="width:64px; padding:5px 7px; border:1.5px solid var(--line); border-radius:8px; font-size:11px; text-align:right;">
                <button type="button" @click="hapusPecahan(o, i)" class="btn-ghost" style="padding:2px 6px;" title="Hapus"><i class="fas fa-xmark"></i></button>
              </div>
              <button type="button" @click="tambahPecahan(o)" class="btn-outline" style="padding:4px 10px; font-size:11px;"><i class="fas fa-plus"></i> pecahan</button>
            </div>
            <div v-if="galatPecahan(o)" style="font-size:10.5px; color:var(--danger); margin-bottom:8px;"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>{{ galatPecahan(o) }}</div>
            <div v-else-if="!o._kelipatan" style="font-size:10.5px; color:var(--warn-text); margin-bottom:8px;">Produk ini belum punya kelipatan acuan order di Master Produk — pecahan tidak dicek kelipatannya.</div>
            <label style="display:flex; align-items:center; gap:6px; font-size:11px; cursor:pointer; color:var(--text-muted); margin-bottom:10px;">
              <input type="checkbox" v-model="editor[o.id].vendor" class="gc-chk"> + Jalur Vendor
            </label>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn-outline" style="flex:1;" @click="tutupEditor(o)">Batal</button>
              <button type="button" class="btn-primary" style="flex:1.4;" :disabled="sedangProses[o.id] || !!galatPecahan(o)" @click="buatSeparating(o)">{{ sedangProses[o.id] ? 'Memproses...' : 'Terbitkan ' + editor[o.id].pecahan.filter(x => x > 0).length + ' SPK Separating' }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="hasilTerbit" class="gc-dialog-backdrop" @click="hasilTerbit=null">
      <div class="gc-dialog" @click.stop>
        <div style="width:56px; height:56px; border-radius:50%; background:var(--ok-light); display:flex; align-items:center; justify-content:center; margin:0 auto 14px; color:var(--ok); font-size:24px;"><i class="fas fa-circle-check"></i></div>
        <h3 class="gc-heading" style="font-size:16px; font-weight:700; margin:0;">SPK Separating Diterbitkan</h3>
        <p style="font-size:11.5px; color:var(--text-muted); margin:6px 0 10px;">{{ hasilTerbit.idOrder }}</p>
        <div class="gc-num" style="font-size:13px; font-weight:700; line-height:1.7; margin-bottom:12px;">{{ hasilTerbit.kode.join(' · ') }}</div>
        <p style="font-size:10.5px; color:var(--text-faint); margin:0 0 14px;">Label dicetak di tiap jalur: {{ hasilTerbit.jalur.map(j => PETA_JALUR[j]?.label || j).join(', ') }}.</p>
        <button @click="hasilTerbit=null" class="btn-primary" style="width:100%;">Tutup</button>
      </div>
    </div>
  `
};

// PanelGroupingBahan — dipasang di Bahan › Disiapkan Bahan. Separating jalur
// Bahan yang belum digrouping dikelompokkan per nama + ukuran + pola; PIC
// memilih lalu "Buat SPK Grouping" menerbitkan GR… dan kartu Bahan
// (bahan_rincian per separating per bahan, label bahan = kode_baris).
export const PanelGroupingBahan = {
  components: { KolomCari },
  emits: ['terbit'],
  setup(props, { emit }) {
    const memuat = ref(true);
    const daftarSep = ref([]);
    const pilih = reactive({});
    const sedangProses = ref(false);
    const hasilTerbit = ref(null);
    const bolehProses = computed(() => picOwnerKeAtas(window.currentUser) && window.cekIzinMenu('pp_bahan', 'add') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const [snap, produk] = await Promise.all([
          getDocs(query(collection(db, 'spk_separating'), where('grouping_id', '==', ''))),
          ambilSemuaProduk()
        ]);
        const petaProduk = {};
        produk.forEach(p => { if (p.sku) petaProduk[p.sku] = p; });
        daftarSep.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(sp => (sp.jalur_aktif || []).includes('bahan'))
          .map(sp => { const p = petaProduk[sp.sku_produk] || null; return { ...sp, _produk: p, _kunci: p ? kunciGrupProduk(p) : '' }; });
      } catch (e) { console.error('Gagal muat separating untuk grouping:', e); daftarSep.value = []; }
      memuat.value = false;
    }
    const klaster = computed(() => {
      const peta = {};
      daftarSep.value.forEach(sp => {
        const key = sp._kunci || ('single-' + sp.id);
        if (!peta[key]) peta[key] = { key, nama: sp.nama_produk, size: sp.size, pola: sp._produk ? kunciPolaProduk(sp._produk) : '', anggota: [] };
        peta[key].anggota.push(sp);
      });
      return Object.values(peta).sort((a, b) => b.anggota.length - a.anggota.length);
    });
    function terpilih(k) { return k.anggota.filter(sp => pilih[sp.id]); }

    async function buatGrouping(k) {
      const anggota = terpilih(k);
      if (!anggota.length || sedangProses.value) return;
      sedangProses.value = true;
      try {
        const kodeGr = await generateKodeGroupingInduk();
        const petaBahan = await ambilPetaBahanAksesoris();
        const petaTujuan = await ambilPetaKodeTujuanDivisi();
        const qtyTotal = anggota.reduce((t, sp) => t + (parseFloat(sp.qty) || 0), 0);
        const breakdown = anggota.map(sp => ({ separating_id: sp.id, kode_separating: sp.kode_separating, order_id: sp.order_id, id_order: sp.id_order, sku_produk: sp.sku_produk || '', qty: sp.qty }));
        const refGr = await addDoc(collection(db, 'spk_grouping'), {
          kode_grouping_induk: kodeGr, nama_produk: k.nama, size: k.size || '', kunci_pola: k.pola || '',
          sku_produk_terlibat: Array.from(new Set(anggota.map(sp => sp.sku_produk).filter(Boolean))),
          separating_ids: anggota.map(sp => sp.id), qty_total: qtyTotal, breakdown, jalur_aktif: ['bahan'],
          tanggal_generate: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
        });
        const anggotaBaris = anggota.map(sp => ({ order_id: sp.order_id, id_order: sp.id_order, qty: parseFloat(sp.qty) || 0, _produk: sp._produk, pelanggan_nama: sp.pelanggan_nama || '', separating_id: sp.id, kode_separating: sp.kode_separating }));
        const rincian = hitungBahanRincian(anggotaBaris, petaBahan, kodeGr, petaTujuan.bahan);
        await addDoc(collection(db, 'spk_track'), {
          jalur: 'bahan', grouping_id: refGr.id, kode_grouping_induk: kodeGr, separating_ids: anggota.map(sp => sp.id),
          nama_produk: k.nama, qty_total: qtyTotal, status: 'perlu_diproses', operator_id: '', operator_nama: '',
          kode_bagging: '', kode_tugas: '', riwayat_scan: [], catatan_masalah: '',
          bahan_rincian: rincian, sewing_rincian: [], webbing_rincian: [], finishing_rincian: [],
          daftar_kode: rincian.map(b => b.kode_baris), dibuat_pada: serverTimestamp(), diperbarui_pada: serverTimestamp()
        });
        await Promise.all(anggota.map(sp => updateDoc(doc(db, 'spk_separating', sp.id), { grouping_id: refGr.id, kode_grouping_induk: kodeGr })));
        anggota.forEach(sp => { delete pilih[sp.id]; });
        hasilTerbit.value = { kode: kodeGr, jumlah: anggota.length, label: rincian.length };
        await muat();
        emit('terbit');
      } catch (e) { console.error('Gagal buat SPK Grouping:', e); alert('Gagal membuat SPK Grouping. Coba lagi.'); }
      sedangProses.value = false;
    }
    onMounted(async () => { await window.authReady; await muat(); });
    return { memuat, muat, klaster, pilih, terpilih, buatGrouping, sedangProses, bolehProses, hasilTerbit, formatQty };
  },
  template: `
    <div class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px; margin-bottom:12px;">
      <div class="gc-heading" style="font-weight:700; font-size:13.5px; margin-bottom:2px;">Buat SPK Grouping</div>
      <p style="font-size:10.5px; color:var(--text-faint); margin:0 0 10px;">Separating jalur Bahan yang belum digrouping, dikelompokkan per nama + ukuran + pola.</p>
      <div v-if="memuat" style="font-size:11px; color:var(--text-faint);">Memuat...</div>
      <div v-else-if="klaster.length === 0" style="font-size:11px; color:var(--text-faint);">Tidak ada separating yang menunggu grouping.</div>
      <div v-else style="display:flex; flex-direction:column; gap:8px;">
        <div v-for="k in klaster" :key="k.key" style="border:1px solid var(--line); border-radius:12px; padding:10px;">
          <div style="font-weight:700; font-size:12px;">{{ k.nama }}<span v-if="k.size"> &middot; ukuran {{ k.size }}</span></div>
          <div style="font-size:10px; color:var(--text-faint); margin-bottom:6px;">{{ k.pola ? 'pola ' + k.pola : 'pola belum dikunci — grouping sendiri' }}</div>
          <label v-for="sp in k.anggota" :key="sp.id" style="display:flex; align-items:center; gap:8px; font-size:11.5px; padding:3px 0; cursor:pointer;">
            <input type="checkbox" v-model="pilih[sp.id]" class="gc-chk" :disabled="!bolehProses">
            <span class="gc-num" style="font-weight:700;">{{ sp.kode_separating }}</span>
            <span style="color:var(--text-faint);">{{ sp.id_order }} &middot; {{ sp.warna }}</span>
            <span style="margin-left:auto; font-weight:700;">{{ formatQty(sp.qty) }} pcs</span>
          </label>
          <button v-if="bolehProses" type="button" class="btn-primary" style="width:100%; margin-top:8px; padding:8px;" :disabled="sedangProses || terpilih(k).length === 0" @click="buatGrouping(k)">
            <i class="fas fa-layer-group" style="margin-right:6px;"></i>{{ sedangProses ? 'Memproses...' : 'Buat SPK Grouping (' + terpilih(k).length + ' separating)' }}
          </button>
        </div>
      </div>
      <div v-if="hasilTerbit" style="margin-top:10px; background:var(--ok-light); border-radius:10px; padding:8px 12px; font-size:11.5px;">
        <b class="gc-num">{{ hasilTerbit.kode }}</b> terbit: {{ hasilTerbit.jumlah }} separating, {{ hasilTerbit.label }} label bahan. Cetak label bahan di kartu di bawah.
        <button type="button" class="btn-ghost" style="padding:0 6px;" @click="hasilTerbit=null"><i class="fas fa-xmark"></i></button>
      </div>
    </div>
  `
};

const AppPersiapanDisiapkan = { components: { PerluPersiapanManager }, template: `<perlu-persiapan-manager ref="mgr" />` };
let vmPpDisiapkan = null;
// PerluPersiapanManager.muat dipanggil ulang lewat $refs kalau komponennya
// sudah ke-mount; menu-id dan id mount lama dipertahankan supaya izin role tetap.
window.pastikanMountPpDisiapkan = function() {
  if (vmPpDisiapkan) {
    const mgr = vmPpDisiapkan.$refs && vmPpDisiapkan.$refs.mgr;
    if (mgr && typeof mgr.muat === 'function') mgr.muat();
    return;
  }
  const mountPoint = document.getElementById('vue-pp-disiapkan');
  if (mountPoint) vmPpDisiapkan = createApp(AppPersiapanDisiapkan).mount('#vue-pp-disiapkan');
};


// JalurTahapManager — komponen reusable lewat prop `jalur`, 1 instance = 1 TAHAP
// (dipasang 5x independen, satu per child-tab) supaya tiap tahap hanya query dan
// render kartu miliknya sendiri. Semua aksi scan kecuali Scan Operator menyasar
// LABEL FISIK batch pada tahap itu, bukan barang/roll individual.

const TAHAP_URUTAN = ['perlu_diproses', 'sedang_diproses', 'perlu_dikirim', 'sedang_dikirim', 'selesai'];
const LABEL_AKSI_SCAN = {
  operator: 'Scan Operator', entry: 'Scan Entry', masalah: 'Scan Masalah',
  pack: 'Scan Pack', kirim: 'Scan Kirim', sampai: 'Scan Sampai'
};

const JalurTahapManager = {
  components: { PopupPratinjauCetakLabel },
  props: {
    jalur: { type: String, required: true },
    labelJalur: { type: String, required: true },
    tahap: { type: String, required: true },
    labelTahap: { type: String, required: true }
  },
  setup(props) {
    const memuat = ref(true);
    const daftarTrack = ref([]);
    const sedangProses = reactive({});
    const menuId = 'pp_' + props.jalur;
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);
    // tombol "Scan Operator" (menugaskan) wajib akun PIC ke atas. Sengaja computed
    // TERPISAH dari `bolehProses` supaya Scan Entry/Masalah/Pack/Kirim/Sampai/Cetak
    // di tahap lain tidak ikut kena gerbang PIC.
    const bolehTunjukOperator = computed(() => picOwnerKeAtas(window.currentUser));
    // Pilihan Scan per CHILD TAB (bukan per modul) — targetId turunan jalur+tahap,
    // 1 tahap = 1 pengaturan sendiri, kandidat checkbox tetap semua aksi jalur ini.
    const MY_TARGET = computed(() => `sub-pp-${props.jalur}-${props.tahap.replace(/_/g, '')}`);

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDocs(query(collection(db, 'spk_track'), where('jalur', '==', props.jalur), where('status', '==', props.tahap)));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Operator hanya lihat SPK yang ditugaskan ke dirinya lewat Scan
        // Operator (operator_id = doc id users = email); role lain lihat semua.
        const isOperatorSaja = (window.currentUser?.role || '').toLowerCase() === 'operator';
        daftarTrack.value = isOperatorSaja
          ? list.filter(t => t.operator_id && t.operator_id === window.currentUser?.email)
          : list;
      } catch (e) {
        console.error(`Gagal muat spk_track (jalur=${props.jalur}, tahap=${props.tahap}):`, e);
        daftarTrack.value = [];
      }
      memuat.value = false;
    }

    // Cetak Label Bagging / Label Tugas (perlu_dikirim / sedang_dikirim)
    const popupCetakLabelAktif = ref(false);
    const daftarLabelPreview = ref([]);
    // jenisCetakAktif — lihat catatan sama di vue-persiapan-bahan.js.
    const jenisCetakAktif = ref('kode_bagging');
    function cetakLabelKit(track) {
      if (typeof QRCode === 'undefined') { alert('Library pembuat QR belum siap dimuat. Coba refresh halaman (Ctrl+Shift+R) lalu ulangi.'); return; }
      updateDoc(doc(db, 'spk_track', track.id), { label_dicetak_pada: new Date().toISOString(), diperbarui_pada: serverTimestamp() })
        .then(muat)
        .catch(e => { console.error('Gagal simpan label_dicetak_pada:', e); alert('Gagal mencatat cetak label. Coba lagi.'); });
      daftarLabelPreview.value = [{ kode: track.kode_kit, nama: track.nama_produk, info: `${track.kode_separating} &middot; ${track.id_order || ''} &middot; ${formatQty(track.qty_total)} pcs`, qrDataUrl: buatQrDataUrl(track.kode_kit) }];
      jenisCetakAktif.value = 'label_spk_terbit';
      popupCetakLabelAktif.value = true;
    }
    function cetakLabelBagging(track) {
      if (typeof QRCode === 'undefined') { alert('Library pembuat QR belum siap dimuat. Coba refresh halaman (Ctrl+Shift+R) lalu ulangi.'); return; }
      const kodeBagging = track.kode_kit + '-BAG';
      updateDoc(doc(db, 'spk_track', track.id), { kode_bagging: kodeBagging, diperbarui_pada: serverTimestamp() })
        .then(muat)
        .catch(e => console.error('Gagal simpan kode_bagging:', e));
      daftarLabelPreview.value = [{ kode: kodeBagging, nama: track.nama_produk, info: `${track.kode_kit} &middot; Bagging`, qrDataUrl: buatQrDataUrl(kodeBagging) }];
      jenisCetakAktif.value = 'kode_bagging';
      popupCetakLabelAktif.value = true;
    }
    function cetakLabelTugas(track) {
      if (typeof QRCode === 'undefined') { alert('Library pembuat QR belum siap dimuat. Coba refresh halaman (Ctrl+Shift+R) lalu ulangi.'); return; }
      const kodeTugas = track.kode_kit + '-TGS';
      updateDoc(doc(db, 'spk_track', track.id), { kode_tugas: kodeTugas, diperbarui_pada: serverTimestamp() })
        .then(muat)
        .catch(e => console.error('Gagal simpan kode_tugas:', e));
      daftarLabelPreview.value = [{ kode: kodeTugas, nama: track.nama_produk, info: `${track.kode_kit} &middot; Tugas`, qrDataUrl: buatQrDataUrl(kodeTugas) }];
      jenisCetakAktif.value = 'lembar_kode_tugas';
      popupCetakLabelAktif.value = true;
    }

    // Kamera/QR — pola SAMA seperti vue-scan-persiapan.js.
    const modeScan = ref(null); // salah satu key LABEL_AKSI_SCAN, atau null
    const trackAktifScan = ref(null);
    const videoScanEl = ref(null);
    const canvasScanEl = ref(null);
    const scanMemuatKamera = ref(false);
    const scanError = ref('');
    let streamScan = null;
    let frameScanId = null;

    async function bukaScan(mode, track) {
      if (sedangProses[track.id]) return;
      modeScan.value = mode;
      trackAktifScan.value = track;
      scanMemuatKamera.value = true;
      scanError.value = '';
      try { await muatJsQr(); } catch (e) {
        scanError.value = 'Gagal memuat modul pembaca QR. Cek koneksi internet.';
        scanMemuatKamera.value = false;
        return;
      }
      try {
        streamScan = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (videoScanEl.value) { videoScanEl.value.srcObject = streamScan; await videoScanEl.value.play(); }
        scanMemuatKamera.value = false;
        pindaiFrameScan();
      } catch (e) {
        scanError.value = 'Gagal mengakses kamera. Pastikan izin kamera diaktifkan.';
        scanMemuatKamera.value = false;
      }
    }
    function pindaiFrameScan() {
      if (!streamScan || !modeScan.value) return;
      const video = videoScanEl.value, canvas = canvasScanEl.value;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const gambar = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const kode = window.jsQR(gambar.data, gambar.width, gambar.height, { inversionAttempts: 'dontInvert' });
        if (kode && kode.data) {
          if (navigator.vibrate) navigator.vibrate(120);
          tangkapHasilScan(kode.data);
          return;
        }
      }
      frameScanId = requestAnimationFrame(pindaiFrameScan);
    }
    function tutupScan() {
      if (frameScanId) { cancelAnimationFrame(frameScanId); frameScanId = null; }
      if (streamScan) { streamScan.getTracks().forEach(t => t.stop()); streamScan = null; }
      modeScan.value = null;
      trackAktifScan.value = null;
      scanError.value = '';
    }

    async function tangkapHasilScan(kodeMentah) {
      const mode = modeScan.value;
      const track = trackAktifScan.value;
      tutupScan();
      const kode = (kodeMentah || '').trim();
      if (!kode || !track) return;
      sedangProses[track.id] = true;
      try {
        const oleh = window.currentUser?.email || null;
        const pada = new Date().toISOString();
        // qty — diisi dari qty_total milik track ini (spk_track belum punya
        // breakdown qty per-baris di jalur ini) supaya audit qty per-scan bisa
        // dilakukan tanpa join balik ke spk_grouping.
        const qty = track.qty_total ?? null;

        if (mode === 'operator') {
          // Gerbang: label Kode Kit WAJIB sudah dicetak sebelum operator ditunjuk.
          if (!track.label_dicetak_pada) { alert('Label Kode Kit belum dicetak. Cetak dulu sebelum Scan Operator.'); return; }
          const karyawan = await cariKaryawanByQr(kode);
          if (!karyawan) { alert('QR tidak dikenali — karyawan tidak ditemukan.'); return; }
          await updateDoc(doc(db, 'spk_track', track.id), {
            operator_id: karyawan.id, operator_nama: karyawan.nama || karyawan.name || karyawan.id,
            status: 'sedang_diproses', diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'operator', oleh: karyawan.nama || karyawan.name || karyawan.id, pada, qty })
          });
        } else if (mode === 'entry') {
          if (kode !== track.kode_kit) { alert(`Kode yang discan ("${kode}") tidak cocok dengan Kode Kit ini (${track.kode_kit}).`); return; }
          await updateDoc(doc(db, 'spk_track', track.id), {
            status: 'perlu_dikirim', diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'entry', oleh, pada, qty })
          });
        } else if (mode === 'masalah') {
          if (kode !== track.kode_kit) { alert(`Kode yang discan ("${kode}") tidak cocok dengan Kode Kit ini (${track.kode_kit}).`); return; }
          const catatan = prompt('Jelaskan masalahnya:');
          if (!catatan || !catatan.trim()) return;
          await updateDoc(doc(db, 'spk_track', track.id), {
            catatan_masalah: catatan.trim(), diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'masalah', oleh, pada, catatan: catatan.trim(), qty })
          });
        } else if (mode === 'pack') {
          if (kode !== track.kode_bagging) { alert(`Kode yang discan ("${kode}") tidak cocok dengan Label Bagging SPK ini (${track.kode_bagging}).`); return; }
          await updateDoc(doc(db, 'spk_track', track.id), {
            status: 'sedang_dikirim', diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'pack', oleh, pada, qty })
          });
        } else if (mode === 'kirim') {
          if (kode !== track.kode_tugas) { alert(`Kode yang discan ("${kode}") tidak cocok dengan Label Tugas SPK ini (${track.kode_tugas}).`); return; }
          // Status TETAP "Sedang Dikirim" — cuma catat riwayat.
          await updateDoc(doc(db, 'spk_track', track.id), {
            diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'kirim', oleh, pada, qty })
          });
        } else if (mode === 'sampai') {
          if (kode !== track.kode_tugas) { alert(`Kode yang discan ("${kode}") tidak cocok dengan Label Tugas SPK ini (${track.kode_tugas}).`); return; }
          await updateDoc(doc(db, 'spk_track', track.id), {
            status: 'selesai', diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'sampai', oleh, pada, qty })
          });
        }
        await muat();
      } catch (e) {
        console.error('Gagal proses hasil scan:', mode, e);
        alert('Gagal memproses hasil scan. Coba lagi.');
      }
      sedangProses[track.id] = false;
    }

    // pastikanCachePilihanScan WAJIB selesai sebelum render pertama yang
    // memanggil aksiAktif() di template (tombol Scan Operator/Entry/dst) —
    // kalau tidak, tombol jatuh ke DEFAULT_PILIHAN walau admin sudah atur beda.
    onMounted(async () => { await window.authReady; await pastikanCachePilihanScan(); await muat(); });
    onUnmounted(tutupScan);

    return {
      memuat, muat, daftarTrack, sedangProses, bolehProses, bolehCetak, bolehTunjukOperator,
      cetakLabelKit, cetakLabelBagging, cetakLabelTugas, popupCetakLabelAktif, daftarLabelPreview, jenisCetakAktif,
      modeScan, trackAktifScan, videoScanEl, canvasScanEl, scanMemuatKamera, scanError,
      bukaScan, tutupScan, LABEL_AKSI_SCAN, formatQty, aksiAktif, MY_TARGET
    };
  },
  template: `
    <div v-if="memuat" class="gc-card" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else-if="daftarTrack.length === 0" class="gc-kosong gc-card">
      <div class="lingkaran"><i class="fas fa-inbox"></i></div>
      <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada SPK di tahap {{ labelTahap }}</h3>
    </div>

    <div v-else style="display:flex; flex-direction:column; gap:10px;">
      <div v-for="t in daftarTrack" :key="t.id" class="gc-card" style="padding:14px; border-radius:20px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
          <div style="min-width:0;">
            <div class="gc-heading gc-num" style="font-weight:700; font-size:13.5px;">{{ t.kode_kit || t.kode_grouping_induk }}</div>
            <div style="font-size:11px; color:var(--text-faint); margin-top:2px;">{{ t.nama_produk }} &middot; {{ formatQty(t.qty_total) }} pcs</div>
          </div>
          <span class="tag pink" style="flex-shrink:0;">{{ labelJalur }}</span>
        </div>

        <div v-if="t.operator_nama" style="font-size:11.5px; color:var(--text-muted); margin-bottom:8px;"><i class="fas fa-user" style="margin-right:6px; color:var(--aksen-ink);"></i>Operator: <b>{{ t.operator_nama }}</b></div>
        <div v-if="t.catatan_masalah" style="font-size:11.5px; color:var(--danger); margin-bottom:8px; background:var(--danger-light); border-radius:8px; padding:6px 10px;"><i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>{{ t.catatan_masalah }}</div>

        <!-- Perlu Diproses -->
        <button v-if="tahap==='perlu_diproses' && bolehCetak" @click="cetakLabelKit(t)" class="btn-outline" style="width:100%; padding:10px; margin-bottom:8px;"><i class="fas fa-print" style="margin-right:6px;"></i>{{ t.label_dicetak_pada ? 'Cetak Ulang Label Kode Kit' : 'Cetak Label Kode Kit' }}</button>
        <button v-if="tahap==='perlu_diproses' && bolehProses && bolehTunjukOperator && aksiAktif(MY_TARGET, 'operator_vendor')" @click="bukaScan('operator', t)" :disabled="sedangProses[t.id]" class="btn-primary" style="width:100%; padding:10px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Operator</button>

        <!-- Sedang Diproses -->
        <div v-if="tahap==='sedang_diproses' && bolehProses" style="display:flex; gap:8px;">
          <button v-if="aksiAktif(MY_TARGET, 'entry_vendor')" @click="bukaScan('entry', t)" :disabled="sedangProses[t.id]" class="btn-primary" style="flex:1; padding:10px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Entry</button>
          <button v-if="aksiAktif(MY_TARGET, 'masalah_vendor')" @click="bukaScan('masalah', t)" :disabled="sedangProses[t.id]" class="btn-outline" style="flex:1; padding:10px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>Scan Masalah</button>
        </div>

        <!-- Perlu Dikirim -->
        <template v-if="tahap==='perlu_dikirim' && bolehProses">
          <button v-if="!t.kode_bagging" @click="cetakLabelBagging(t)" class="btn-outline" style="width:100%; padding:10px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Label Bagging</button>
          <button v-else-if="aksiAktif(MY_TARGET, 'pack_vendor')" @click="bukaScan('pack', t)" :disabled="sedangProses[t.id]" class="btn-primary" style="width:100%; padding:10px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Pack ({{ t.kode_bagging }})</button>
        </template>

        <!-- Sedang Dikirim -->
        <template v-if="tahap==='sedang_dikirim' && bolehProses">
          <button v-if="!t.kode_tugas" @click="cetakLabelTugas(t)" class="btn-outline" style="width:100%; padding:10px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Label Tugas</button>
          <div v-else style="display:flex; gap:8px;">
            <button v-if="aksiAktif(MY_TARGET, 'kirim_vendor')" @click="bukaScan('kirim', t)" :disabled="sedangProses[t.id]" class="btn-outline" style="flex:1; padding:10px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Kirim</button>
            <button v-if="aksiAktif(MY_TARGET, 'sampai_vendor')" @click="bukaScan('sampai', t)" :disabled="sedangProses[t.id]" class="btn-primary" style="flex:1; padding:10px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Sampai</button>
          </div>
          <p style="font-size:10px; color:var(--text-faint); margin-top:6px;">Scan Kirim = dikirim dari sini. Scan Sampai = dikonfirmasi diterima pihak penerima (dilakukan di sini juga untuk Fase 2 — belum ada layar penerima terpisah).</p>
        </template>

        <!-- Selesai: riwayat -->
        <div v-if="tahap==='selesai' && t.riwayat_scan && t.riwayat_scan.length" style="margin-top:6px; display:flex; flex-direction:column; gap:4px;">
          <div v-for="(r, i) in t.riwayat_scan" :key="i" style="font-size:10.5px; color:var(--text-faint); display:flex; justify-content:space-between; gap:8px;">
            <span>{{ LABEL_AKSI_SCAN[r.aksi] || r.aksi }}{{ r.oleh ? ' — ' + r.oleh : '' }}</span>
            <span>{{ r.pada ? new Date(r.pada).toLocaleString('id-ID') : '' }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="modeScan" style="position:fixed; inset:0; background:rgba(0,0,0,.85); z-index:10000; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:16px;">
      <div style="width:100%; max-width:340px; aspect-ratio:1/1; background:#111; border-radius:12px; overflow:hidden; position:relative; margin-bottom:16px;">
        <video ref="videoScanEl" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover;" :class="{ hidden: scanMemuatKamera }"></video>
        <canvas ref="canvasScanEl" class="hidden"></canvas>
        <div v-if="scanMemuatKamera" style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#C9B4A4; text-align:center; padding:16px;">
          <i class="fas fa-qrcode" style="font-size:36px; margin-bottom:10px;"></i>
          <span v-if="scanError" style="color:#F2A0A0; font-size:12px;">{{ scanError }}</span>
          <span v-else style="font-size:12.5px;">Menyiapkan kamera...</span>
        </div>
      </div>
      <p style="color:#fff; font-size:12.5px; margin-bottom:14px; text-align:center;">{{ LABEL_AKSI_SCAN[modeScan] }} — arahkan kamera ke {{ modeScan==='operator' ? 'QR pribadi karyawan' : 'label QR SPK/Bagging/Tugas' }}</p>
      <button @click="tutupScan" class="btn-outline" style="padding:8px 24px; background:#fff;">Batal</button>
    </div>

    <popup-pratinjau-cetak-label :terbuka="popupCetakLabelAktif" judul="Cetak Label" :daftar-label="daftarLabelPreview" :jenis-cetak="jenisCetakAktif" @tutup="popupCetakLabelAktif = false" />
  `
};

function buatAppJalurTahap(jalur, labelJalur, tahap, labelTahap) {
  return {
    components: { JalurTahapManager },
    template: `<jalur-tahap-manager ref="mgr" jalur="${jalur}" label-jalur="${labelJalur}" tahap="${tahap}" label-tahap="${labelTahap}" />`
  };
}

// Bahan/Sewing/Webbing/Finishing TIDAK mount JalurTahapManager di sini —
// window.pastikanMountPpXxxYyy versi jalur itu didefinisikan ULANG oleh
// vue-persiapan-bahan/sewing/webbing/finishing.js (dimuat belakangan di
// index.html) dan menimpa punya file ini. Sisa pemakai generik: Vendor.


// Jalur Vendor memakai `JalurTahapManager` dengan jalur='vendor' tanpa komponen
// baru: yang scan semua aksi adalah driver INTERNAL (akun karyawan biasa, QR
// pribadi yang sama, bukan akun vendor eksternal), jadi 5 tahap generik cukup.
// Jalur ini OPT-IN MANUAL lewat checkbox `vendorManual`, bukan deteksi dari BOM.

let vmPpVendorPerluDiproses = null;
window.pastikanMountPpVendorPerluDiproses = function() {
  if (vmPpVendorPerluDiproses) { const mgr = vmPpVendorPerluDiproses.$refs && vmPpVendorPerluDiproses.$refs.mgr; if (mgr && typeof mgr.muat === 'function') mgr.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-vendor-perludiproses');
  if (mountPoint) vmPpVendorPerluDiproses = createApp(buatAppJalurTahap('vendor', 'Vendor', 'perlu_diproses', 'Perlu Diproses')).mount('#vue-pp-vendor-perludiproses');
};
let vmPpVendorSedangDiproses = null;
window.pastikanMountPpVendorSedangDiproses = function() {
  if (vmPpVendorSedangDiproses) { const mgr = vmPpVendorSedangDiproses.$refs && vmPpVendorSedangDiproses.$refs.mgr; if (mgr && typeof mgr.muat === 'function') mgr.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-vendor-sedangdiproses');
  if (mountPoint) vmPpVendorSedangDiproses = createApp(buatAppJalurTahap('vendor', 'Vendor', 'sedang_diproses', 'Sedang Diproses')).mount('#vue-pp-vendor-sedangdiproses');
};
let vmPpVendorPerluDikirim = null;
window.pastikanMountPpVendorPerluDikirim = function() {
  if (vmPpVendorPerluDikirim) { const mgr = vmPpVendorPerluDikirim.$refs && vmPpVendorPerluDikirim.$refs.mgr; if (mgr && typeof mgr.muat === 'function') mgr.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-vendor-perludikirim');
  if (mountPoint) vmPpVendorPerluDikirim = createApp(buatAppJalurTahap('vendor', 'Vendor', 'perlu_dikirim', 'Perlu Dikirim')).mount('#vue-pp-vendor-perludikirim');
};
let vmPpVendorSedangDikirim = null;
window.pastikanMountPpVendorSedangDikirim = function() {
  if (vmPpVendorSedangDikirim) { const mgr = vmPpVendorSedangDikirim.$refs && vmPpVendorSedangDikirim.$refs.mgr; if (mgr && typeof mgr.muat === 'function') mgr.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-vendor-sedangdikirim');
  if (mountPoint) vmPpVendorSedangDikirim = createApp(buatAppJalurTahap('vendor', 'Vendor', 'sedang_dikirim', 'Sedang Dikirim')).mount('#vue-pp-vendor-sedangdikirim');
};
let vmPpVendorSelesai = null;
window.pastikanMountPpVendorSelesai = function() {
  if (vmPpVendorSelesai) { const mgr = vmPpVendorSelesai.$refs && vmPpVendorSelesai.$refs.mgr; if (mgr && typeof mgr.muat === 'function') mgr.muat(); return; }
  const mountPoint = document.getElementById('vue-pp-vendor-selesai');
  if (mountPoint) vmPpVendorSelesai = createApp(buatAppJalurTahap('vendor', 'Vendor', 'selesai', 'Selesai')).mount('#vue-pp-vendor-selesai');
};

// Bridge "Pilihan Scan" (sheet mobile & tombol desktop js/vue-popup-scan.js) —
// JalurTahapManager BELUM migrasi ke buatScanTerpadu (beda dari Bahan/Sewing
// dkk), jadi tidak ada alur identifikasi-dari-scan: bukaScan(mode, track) yang
// sudah ada WAJIB tahu kartu mana duluan. Kartu tunggal di tab itu langsung
// jalan; kartu jamak diminta pilih manual dari daftar supaya tidak salah SPK.
function _bukaScanVendorDariTab(vm, mode, labelTahap, filterFn) {
  const mgr = vm && vm.$refs && vm.$refs.mgr;
  if (!mgr) return;
  const daftar = (mgr.daftarTrack || []).filter(filterFn || (() => true));
  if (daftar.length === 0) { alert(`Tidak ada SPK Vendor yang siap di tahap ${labelTahap}.`); return; }
  if (daftar.length > 1) { alert(`Ada ${daftar.length} SPK Vendor di tahap ${labelTahap} — buka dari kartu masing-masing di layar supaya tidak salah SPK.`); return; }
  mgr.bukaScan(mode, daftar[0]);
}
window.bukaOperatorVendor = function () { window.pastikanMountPpVendorPerluDiproses(); _bukaScanVendorDariTab(vmPpVendorPerluDiproses, 'operator', 'Perlu Diproses'); };
window.bukaEntryVendor = function () { window.pastikanMountPpVendorSedangDiproses(); _bukaScanVendorDariTab(vmPpVendorSedangDiproses, 'entry', 'Sedang Diproses'); };
window.bukaMasalahVendor = function () { window.pastikanMountPpVendorSedangDiproses(); _bukaScanVendorDariTab(vmPpVendorSedangDiproses, 'masalah', 'Sedang Diproses'); };
window.bukaPackVendor = function () { window.pastikanMountPpVendorPerluDikirim(); _bukaScanVendorDariTab(vmPpVendorPerluDikirim, 'pack', 'Perlu Dikirim', t => !!t.kode_bagging); };
window.bukaKirimVendor = function () { window.pastikanMountPpVendorSedangDikirim(); _bukaScanVendorDariTab(vmPpVendorSedangDikirim, 'kirim', 'Sedang Dikirim', t => !!t.kode_tugas); };
window.bukaSampaiVendor = function () { window.pastikanMountPpVendorSedangDikirim(); _bukaScanVendorDariTab(vmPpVendorSedangDikirim, 'sampai', 'Sedang Dikirim', t => !!t.kode_tugas); };
