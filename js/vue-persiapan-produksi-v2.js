// js/vue-persiapan-produksi-v2.js
// ============================================================================
// Persiapan Produksi V2 — menu BARU (29 Agt 2026, koreksi arsitektur menu).
// GANTI TOTAL dari js/vue-persiapan-produksi.js (DITINGGALKAN, tidak lagi
// dimuat di index.html — file lama TIDAK dihapus dari disk, cuma tidak
// dipakai lagi, keputusan Guru "ditulis ulang bersih dari nol").
//
// Latar: alur produksi BARU (permintaan Guru, lihat RENCANA-PERSIAPAN-
// PRODUKSI-V2.md untuk desain lengkap) —
//   1. "Perlu Disiapkan": SPK-SPK aktif (order_spk) yang PRODUK & POLA-nya
//      SAMA (nama produk dasar sama, panjang+isi pola BOM sama — supaya
//      kainnya bisa "gelar bersamaan > potong bersamaan") DIKELOMPOKKAN
//      jadi 1 kode "SPK Grouping" (format SPKyymmdd + urutan 3 digit,
//      GLOBAL per hari lintas produk — keputusan Guru, AskUserQuestion).
//   2. Dari 1 SPK Grouping itu, produksi jalan di 5 JALUR PARALEL independen
//      (Vendor/Bahan/Acc Sewing/Acc Webbing/Acc Finishing), masing-masing
//      5 TAHAP (Perlu Diproses -> Sedang Diproses -> Perlu Dikirim -> Sedang
//      Dikirim -> Selesai), digerakkan lewat cetak label + scan (Label SPK
//      Grouping -> Scan Operator, Scan Entry/Scan Masalah, Label Bagging ->
//      Scan Pack, Label Tugas -> Scan Kirim, Scan Sampai -> Selesai).
//
// STATUS PER FASE (lihat RENCANA-PERSIAPAN-PRODUKSI-V2.md §7):
// - Fase 1 — "Perlu Disiapkan" (generator SPK Grouping) — SELESAI.
// - Fase 2 — jalur Bahan (5 tahap + scan, komponen reusable
//   `JalurTahapManager`) — SELESAI.
// - Fase 3 (29 Agt 2026 malam) — 3 jalur Acc (Sewing/Webbing/Finishing) —
//   SELESAI. TIDAK ADA komponen baru: `JalurTahapManager` dipakai APA
//   ADANYA, cuma parameter `jalur` beda (persis sesuai rencana §7 poin 3)
//   — lihat blok mount di bawah `buatAppJalurTahap()`.
// - Fase 4 (29 Agt 2026 malam) — jalur Vendor — SELESAI. §5.D terjawab
//   Guru (driver internal yang sudah biasa belanja = juga jadi kurir
//   kirim+sampai barang vendor, akun+QR yang SAMA, bukan portal terpisah)
//   — 5-tahap generic yang sudah ada CUKUP, TIDAK ada tahap/label
//   tambahan. §5.C SEBAGIAN masih terbuka (field BOM buat deteksi
//   OTOMATIS jalur Vendor + jenis vendor) — jalur Vendor SEMENTARA cuma
//   bisa diaktifkan MANUAL (checkbox "+ Jalur Vendor (manual)", sudah ada
//   sejak Fase 1), belum otomatis dari BOM Aksesoris.
// - Fase 5 — audit menyeluruh referensi lama — belum dimulai.
//
// Kunci grouping — CATATAN PENTING (nyaris jadi bug, ketemu lewat riset
// kode SEBELUM ditulis, lihat STATUS-PROYEK.md §44.13): `order_spk.
// nama_produk` itu STRING GABUNGAN "Nama Warna Size" (lihat vue-order-
// spk.js, pilihProdukSpk()) — TIDAK BISA dipakai langsung buat cocokkan
// "nama produk sama" (2 varian warna beda "nama_produk"-nya walau
// sebenarnya harus tetap bisa digroup, sesuai Guru: "nama produk sama
// walau beda asal bahan sama"). Makanya di sini nama dasar diambil dari
// `master_produk.nama` (field TERPISAH dari warna/size), via `sku_produk`
// tiap SPK. SPK yang TIDAK terhubung ke Master Produk (sku_produk kosong,
// migrasi lama dari spreadsheet) TIDAK BISA dikelompokkan otomatis — tetap
// bisa lanjut sebagai grouping isi 1 SPK sendiri (lihat bagian "Belum Bisa
// Dikelompokkan Otomatis" di UI).
//
// Kunci pola — dari `master_produk.bom_pola[].panjang` + `.isi_pola_pcs`
// (dipakai JUGA oleh field `kelipatan`/KPK di vue-master-produk.js, field
// yang SAMA, cuma cara pakainya beda: kelipatan = KPK semua isi_pola_pcs,
// di sini = tanda-tangan SET pola buat cocokkan antar SKU/produk).
//
// jalur_aktif — dideteksi OTOMATIS dari BOM produk (bom_pola ada isi ->
// jalur 'bahan' aktif; bom_aksesoris.tahap_proses mengandung kata Sewing/
// Webbing/Finishing -> jalur itu aktif). Jalur 'vendor' TIDAK PUNYA sumber
// data BOM yang jelas (field BOM utk vendor MASIH pertanyaan terbuka,
// lihat RENCANA-PERSIAPAN-PRODUKSI-V2.md §5.C — vendor di sini artinya
// pekerjaan sublim/sablon/bordir, BUKAN bom_pola.tipe==='vendor' yang
// sempat jadi dugaan awal KELIRU) — makanya jalur Vendor cuma checkbox
// MANUAL di form pembuatan grouping, bukan hasil deteksi.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel, KolomCari } from './vue-components.js?v=5';
import { ambilSemuaProduk } from './vue-master-produk.js';

// ============================================================================
// REDESAIN "Perlu Disiapkan" (31 Agt 2026) — handoff wireframe Guru, folder
// Mockup/handoff/Persiapan Produksi - Perlu Disiapkan/. GANTI TOTAL layar
// "Perlu Disiapkan" lama (kartu klaster + tombol langsung) dengan tata letak
// 2 kolom (desktop 1440: daftar klaster kiri + panel "Grouping baru" kanan
// sticky; mobile 390: 1 kolom + panel jadi bar mengambang di atas nav).
// JALUR/TAHAP di bawahnya (JalurTahapManager, jalur Vendor/Bahan/Sewing/
// Webbing/Finishing, 5 tahap tiap jalur) TIDAK DISENTUH SAMA SEKALI — cuma
// generator SPK Grouping ini yang dibangun ulang. Keputusan (AskUserQuestion
// ke Guru sebelum coding, jangan ditebak — 3 "Yang Belum Diputuskan" dari
// SERAH-TERIMA.md SEMUANYA sudah dijawab langsung):
//  1. Relasi ke V2 lama -> GANTI TOTAL (bukan modul baru berdampingan).
//  2. Belum ada data live spk_grouping/spk_track sungguhan -> aman, tidak
//     perlu migrasi apapun.
//  3. Riwayat: begitu grouping terbit, baris klaster HILANG TOTAL dari
//     antrean (TIDAK ada tab Selesai/Riwayat di layar ini) -> section
//     "SPK Grouping Terbaru" yang PERSISTEN di versi lama DIHAPUS, diganti
//     dialog konfirmasi SEKALI TAMPIL (konfirmasiTerbit) begitu grouping
//     berhasil dibuat, sesuai kalimat SERAH-TERIMA.md §3 "kode yang terbit
//     ditampilkan sekali sebagai konfirmasi".
//  4. Pembatalan grouping -> DITUNDA, tidak dibangun versi ini.
//  5. Jalur Vendor -> TETAP ADA (bukan dihapus meski wireframe cuma gambar
//     4 chip Bahan/Acc Sewing/Acc Webbing/Acc Finishing) — checkbox manual
//     "+ Jalur Vendor" dipertahankan di panel & di baris "Buat Grouping
//     Sendiri", cuma dipindah ke bawah kotak 4 chip (bukan hilang).
//  6. Deteksi 4 pos tujuan -> TETAP otomatis dari BOM (jalurOtomatisProduk,
//     TIDAK diubah jadi "semua 4 pos selalu", walau kalimat wireframe
//     "otomatis, bukan pilihan" sekilas menyiratkan itu — Guru konfirmasi
//     "bukan pilihan" artinya Owner tidak bisa UNCHECK manual, BUKAN semua
//     pos pasti kebagian).
//  7. BARU (di luar SERAH-TERIMA.md, kebutuhan tambahan dari Guru saat
//     diskusi): 1 SPK BOLEH ikut LEBIH DARI 1 SPK Grouping — dipecah
//     sebagian qty. order_spk dapat 2 field baru: `qty_tergrouping` (number,
//     akumulatif, BUKAN ditimpa) + `grouping_ids` (array, arrayUnion tiap
//     ikut grouping baru). `id_spk_grouping`/`kode_spk_grouping` lama TETAP
//     ditulis (kompatibilitas tampilan lain yang mungkin baca field itu) —
//     isinya grouping TERAKHIR yang mengambil SPK ini, bukan satu-satunya.
//     `status_grouping` sekarang 3 nilai: '' (belum) / 'sebagian' / 'tergrouping'
//     (habis). Antrean (`muat()`) filter berdasarkan sisa qty (qty_order -
//     qty_tergrouping) > 0, BUKAN lagi berdasarkan id_spk_grouping kosong.
//
// Kunci klaster DITEGASKAN ULANG Guru (31 Agt 2026): "nama_produk + size +
// panjang pola + isi_pola_pcs" — DICEK LANGSUNG ke kode lama sebelum
// diedit: versi SEBELUMNYA TERNYATA TIDAK memasukkan `size` sama sekali ke
// kunci (cuma nama+kunciPola) — gap nyata, bukan cuma persepsi Guru salah.
// Diperbaiki di sini lewat `kunciGrupProduk()` (BARU, di bawah), field
// `master_produk.size` (sudah ada, lihat PETA-DATABASE.md) ditambahkan ke
// tanda-tangan kunci. `kunciPolaProduk()` sendiri (panjang+isi_pola_pcs)
// TIDAK diubah — dipakai juga oleh JalurTahapManager & jalurOtomatisProduk
// yang tidak disentuh.
//
// Sumber "warna" per baris (wireframe: "Rincian per warna: Burgundy 40 ·
// Purple 24 · Cream 12") — order_spk TIDAK punya field warna sendiri
// (nama_produk-nya STRING GABUNGAN "Nama Warna Size", lihat catatan lama di
// atas file ini) — dipakai `master_produk.warna` (field terpisah, resolve
// lewat sku_produk) supaya tidak perlu parsing teks yang rapuh. SPK tanpa
// SKU (tidak resolve ke produk) tidak masuk hitungan rincian warna.
// ============================================================================

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
// hitungKelipatan() di vue-master-produk.js.
function kunciPolaProduk(produk) {
  const baris = (produk?.bom_pola || [])
    .map(b => ({ p: parseFloat(b.panjang) || 0, i: parseFloat(b.isi_pola_pcs) || 0 }))
    .filter(b => b.p > 0 || b.i > 0)
    .sort((a, b) => (a.p - b.p) || (a.i - b.i));
  if (baris.length === 0) return '';
  return baris.map(b => `${b.p}x${b.i}`).join('|');
}

// kunciGrupProduk — BARU (31 Agt 2026). Tanda-tangan LENGKAP klaster:
// nama + SIZE + kunci pola. `size` ditambahkan di sini (lihat catatan
// besar di atas file ini) — kalau kunci pola kosong (BOM Pola belum
// lengkap/pola belum dikunci), return '' supaya produk itu TIDAK ikut
// klaster manapun (ditampilkan terpisah sebagai "pola belum dikunci").
function kunciGrupProduk(produk) {
  const kp = kunciPolaProduk(produk);
  if (!kp) return '';
  const nama = (produk?.nama || '').trim().toLowerCase();
  const size = (produk?.size || '').trim().toLowerCase();
  return `${nama}::${size}::${kp}`;
}

// jalurOtomatisProduk — lihat catatan panjang "jalur_aktif" di atas file
// ini. `tahap_proses` field TEKS BEBAS (bukan strict-select, lihat vue-
// master-produk.js) — dicocokkan longgar (contains, case-insensitive)
// supaya variasi kecil penulisan ("Sewing"/"sewing "/"SEWING") tetap
// kena, TIDAK menggagalkan deteksi cuma karena beda kapital/spasi.
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

// generateKodeSpkGrouping — pola SAMA seperti generateIdBerurutan() di
// vue-bahan-aksesoris.js (runTransaction, wajib supaya counter tidak
// dobel kalau 2 admin generate BERSAMAAN persis di waktu yang sama), TAPI
// counter doc-nya di-KEY per TANGGAL (bukan per kategori) — otomatis
// "reset" tiap hari (keputusan Guru: "Global per hari, lintas produk"),
// tidak perlu job reset manual apapun karena doc baru dibuat begitu
// tanggal berganti.
async function generateKodeSpkGrouping() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const tanggalKey = `${yy}${mm}${dd}`;
  const refDoc = doc(db, 'pengaturan_id_spk_grouping', tanggalKey);
  return await runTransaction(db, async (trx) => {
    const snap = await trx.get(refDoc);
    const counterBaru = (snap.exists() ? (snap.data().counter || 0) : 0) + 1;
    if (snap.exists()) trx.update(refDoc, { counter: counterBaru });
    else trx.set(refDoc, { counter: counterBaru, dibuat_pada: tanggalKey });
    return `SPK${tanggalKey}${String(counterBaru).padStart(3, '0')}`;
  });
}

// buatSpkTrackUntukGrouping — BARU (Fase 2, 29 Agt 2026 malam). Begitu 1
// SPK Grouping selesai dibuat, langsung buat 1 dokumen `spk_track` per
// jalur di `jalur_aktif`-nya (status awal SELALU 'perlu_diproses') —
// bukan cuma untuk jalur yang UI-nya sudah jadi (Bahan). Alasan: kalau
// track CUMA dibuat untuk jalur yang kebetulan sudah punya UI saat itu,
// begitu Fase 3/4 mengisi jalur lain nanti, grouping-grouping LAMA yang
// dibuat sebelum Fase itu jalan tidak akan punya track-nya — perlu
// backfill manual. Membuat semua track di awal (murah, cuma beberapa
// dokumen per grouping) menghindari masalah itu sama sekali. Field
// ditulis DENORMALISASI (kode_spk/nama_produk/qty_total disalin dari
// grouping) supaya daftar per-tahap (`JalurTahapManager` di bawah) bisa
// query+tampilkan langsung tanpa baca balik ke `spk_grouping` per baris
// (hemat baca Firestore, PRINSIP-HEMAT).
async function buatSpkTrackUntukGrouping(groupingId, kodeSpk, namaProduk, qtyTotal, jalurAktif, bahanRincian, sewingRincian, webbingRincian, finishingRincian) {
  await Promise.all((jalurAktif || []).map(jalur => addDoc(collection(db, 'spk_track'), {
    grouping_id: groupingId,
    kode_spk: kodeSpk,
    nama_produk: namaProduk,
    qty_total: qtyTotal,
    jalur,
    status: 'perlu_diproses',
    operator_id: '',
    operator_nama: '',
    kode_bagging: '',
    kode_tugas: '',
    riwayat_scan: [],
    catatan_masalah: '',
    // bahan_rincian — BARU (31 Agt 2026, modul Persiapan Produksi > Bahan,
    // lihat hitungBahanRincian() di atas). CUMA diisi buat jalur 'bahan' —
    // rincian kebutuhan kain PER BAHAN PER ANAK SPK, karena tahap Bahan
    // butuh ketelitian sampai level itu (lihat wireframe.dc.html: "scan
    // label ANAK SPK berkali-kali", "satu scan menutup SATU BARIS
    // KOMPONEN") sedangkan spk_track sendiri cuma 1 dokumen per grouping
    // per jalur.
    bahan_rincian: (jalur === 'bahan' && Array.isArray(bahanRincian)) ? bahanRincian : [],
    // sewing_rincian / webbing_rincian / finishing_rincian — BARU (1 Sep
    // 2026, modul Persiapan Produksi > Acc Sewing/Webbing/Finishing).
    // Field TAMBAHAN yang SAMA POLA seperti bahan_rincian di atas, TAPI
    // per-jalur sendiri-sendiri (bukan 1 field digilir 4 jalur) supaya tiap
    // pos hanya baca field miliknya sendiri — pola ini SENGAJA dipilih
    // (bukan generik `rincian` tunggal) supaya field bahan_rincian yang
    // sudah ada TIDAK perlu diubah bentuknya (hindari migrasi data yang
    // sudah terlanjur tersimpan sejak 31 Agt 2026). Jalur 'vendor' tidak
    // dapat rincian apapun — di luar lingkup 4 modul kartu-per-komponen ini.
    sewing_rincian: (jalur === 'sewing' && Array.isArray(sewingRincian)) ? sewingRincian : [],
    webbing_rincian: (jalur === 'webbing' && Array.isArray(webbingRincian)) ? webbingRincian : [],
    finishing_rincian: (jalur === 'finishing' && Array.isArray(finishingRincian)) ? finishingRincian : [],
    dibuat_pada: serverTimestamp(),
    diperbarui_pada: serverTimestamp()
  })));
}

// ambilPetaBahanAksesoris — cache modul-level, dipakai hitungBahanRincian()
// saat grouping jalur 'bahan' diterbitkan. Koleksinya kecil (semua Bahan &
// Aksesoris toko), pola query DISALIN dari js/vue-scan-persiapan.js.
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

// hitungBahanRincian — BARU (31 Agt 2026, modul Persiapan Produksi > Bahan).
// Dari daftar anak SPK yang ikut grouping ({order_spk_id, no_spk, qty,
// _produk}) + peta master_bahan_aksesoris (id -> {nama, warna, ...}),
// hasilkan satu baris PER BAHAN PER ANAK SPK — inilah yang disimpan
// denormalisasi di spk_track.bahan_rincian[] (hemat baca Firestore, PRINSIP-
// HEMAT, pola sama seperti buatSpkTrackUntukGrouping).
//
// Sumber BOM: `master_produk.bom_pola[]` — BUKAN `bom_aksesoris[]` (itu punya
// Acc Sewing/Webbing/Finishing, bukan kain). Cuma baris tipe:'internal' yang
// dipakai (tipe:'vendor' dipotong vendor sendiri, tidak lewat gudang/pos
// Bahan). Rumus dari SERAH-TERIMA Bahan §3 "Aturan khas pos ini":
//   amparan     = qty anak SPK / isi_pola_pcs, dibulatkan ke ATAS
//   kebutuhan_kain (meter) = (panjang pola dalam cm / 100) x amparan
function hitungBahanRincian(anggotaList, petaBahan) {
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
        order_spk_id: a.order_spk_id, no_spk: a.no_spk, qty,
        bahan_aksesoris_id: b.bahan_aksesoris_id,
        bahan_nama: bhn.nama || '', bahan_warna: bhn.warna || '',
        nama_pola: b.nama_pola || '',
        // produk_size — BARU, dipakai js/vue-persiapan-bahan.js buat "syarat
        // sepack" (SERAH-TERIMA Bahan §3: "pola, bahan, dan size sama; warna
        // & no SPK boleh beda"). spk_track sendiri TIDAK simpan size (cuma
        // nama_produk), jadi diambil di sini dari produk anak SPK-nya.
        produk_size: (produk && produk.size) || '',
        panjang_pola: panjangCm, isi_pola_pcs: isiPola,
        amparan, kebutuhan_kain: kebutuhanKain,
        // status per BARIS (bukan per grouping) — inilah yang dipakai
        // js/vue-persiapan-bahan.js buat nentuin baris ini ada di tab mana:
        // perlu_disiapkan -> sedang_disiapkan -> perlu_dikirim ->
        // sedang_dikirim -> selesai.
        status: 'perlu_disiapkan',
        // masuk_tahap_pada — string ISO (BUKAN serverTimestamp(): Firestore
        // tidak izinkan sentinel serverTimestamp() di dalam elemen array,
        // cuma di field top-level dokumen — sama seperti field `pada` di
        // riwayat_scan versi lama). Diperbarui tiap kali `status` baris ini
        // pindah tahap — dasar hitung "diam sejak" / ambang tertahan (>6 jam,
        // keputusan Guru 31 Agt 2026) di setiap tab.
        masuk_tahap_pada: new Date().toISOString(),
        label_cetak_pada: null,
        operator_uid: '', operator_nama: '', ditugaskan_pada: null,
        // riwayat_operator — estafet shift (keputusan Guru 31 Agt 2026:
        // "boleh diganti operator di tengah jalan, bukan dipegang 2 sekaligus
        // bersamaan"). Tiap kali baris ini di-scan-tunjuk ulang oleh operator
        // LAIN sebelum selesai, entry baru ditambah di sini (bukan menimpa)
        // supaya riwayat siapa-pegang-apa-jam-berapa tetap kebaca di kartu.
        riwayat_operator: [],
        entry_qty: null, entry_oleh: '', entry_pada: null,
        catatan_masalah: '',
        kode_bagging: '', kode_tugas: ''
      });
    });
  });
  return baris;
}

// hitungSewingRincian / hitungWebbingRincian / hitungFinishingRincian — BARU
// (1 Sep 2026, wireframe handoff "Persiapan Produksi - Acc Sewing/Webbing/
// Finishing", 3 modul dikerjakan sekaligus atas instruksi Guru 1 Sep 2026,
// menyimpang dari urutan satu-modul-per-sesi yang ditulis README paket
// handoff — lihat STATUS-PROYEK.md buat catatan penyimpangan ini).
//
// SAMA POLA seperti hitungBahanRincian() di atas (1 baris per komponen per
// anak SPK, disimpan denormalisasi di spk_track), TAPI sumber BOM-nya
// `master_produk.bom_aksesoris[]` (BUKAN bom_pola[] — itu punya Bahan),
// disaring `tahap_proses` (teks bebas, dicocokkan longgar `.includes()` —
// SAMA seperti jalurOtomatisProduk() di atas, supaya konsisten: kalau
// sebuah baris BOM Aksesoris kehitung sebagai jalur 'sewing' di sana, baris
// yang SAMA juga harus muncul di sini, bukan aturan pencocokan berbeda).
//
// PERBEDAAN KARTU dari Bahan — PENTING: pos Bahan "satu kartu satu bahan +
// warna" (kartu dikumpulkan LINTAS dokumen spk_track, lihat catatan besar
// di vue-persiapan-bahan.js). 3 pos Acc ini SEBALIKNYA: "satu kartu satu
// SPK Grouping" (SERAH-TERIMA §2, semua 3 modul) — kartunya = SATU dokumen
// spk_track itu sendiri, isinya rincian_nya. Makanya di sini TIDAK ada
// kelompokKartuBahan()-style "kumulatif lintas grouping" — cek stok cukup
// dilakukan PER BARIS independen terhadap stok live (lihat js/vue-
// persiapan-{sewing,webbing,finishing}.js), bukan dialokasikan greedy
// lintas kartu seperti Bahan (SERAH-TERIMA 3 modul ini TIDAK menyebut
// "kumulatif" sebagai aturan khas, beda dari Bahan yang eksplisit
// menyebutnya).
function _butuhAksesorisDasar(a, qty) {
  return {
    order_spk_id: a.order_spk_id, no_spk: a.no_spk, qty,
    bahan_aksesoris_id: '', nama_aksesoris: '', warna: '',
    status: 'perlu_disiapkan',
    masuk_tahap_pada: new Date().toISOString(),
    label_cetak_pada: null,
    operator_uid: '', operator_nama: '', ditugaskan_pada: null,
    riwayat_operator: [],
    entry_qty: null, entry_oleh: '', entry_pada: null,
    catatan_masalah: '',
    kode_bagging: '', kode_tugas: ''
  };
}
function hitungSewingRincian(anggotaList, petaBahan) {
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
        // sepack" (SERAH-TERIMA Acc §3: "produk dan size sama").
        produk_size: (produk && produk.size) || '',
        qty_per_pcs: qtyPerPcs, satuan: (k.satuan || 'pcs').trim() || 'pcs',
        butuh: qtyPerPcs * qty
      });
    });
  });
  return baris;
}
// hitungWebbingRincian — sama seperti hitungSewingRincian, TAMBAH kolom
// khas pos ini (SERAH-TERIMA Acc Webbing §3/§5): panjang_per_pcs/
// butuh_meter (meter, bukan pcs), roll (butuh_meter / panjang_roll master
// bahan, dibulatkan ke atas — NULL kalau master_bahan_aksesoris.panjang_roll
// belum diisi Guru, BUKAN ditebak jadi angka salah), kode_webbing2/3
// (snapshot bom_aksesoris.webbing2/.webbing3 SAAT SPK Grouping terbit —
// teks bebas, boleh kosong, TIDAK menghalangi cetak per SERAH-TERIMA).
function hitungWebbingRincian(anggotaList, petaBahan) {
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
  return baris;
}
// hitungFinishingRincian — sama seperti hitungSewingRincian, TAMBAH kolom
// khas pos ini (SERAH-TERIMA Acc Finishing §3/§5): varian_tipe/
// varian_jumlah, keadaan_cetak/sisa_dicetak.
//
// KEPUTUSAN (Yang Belum Diputuskan §7 SERAH-TERIMA — belum dijawab Guru,
// dipilih default paling aman dulu, JANGAN dianggap final):
//   - varian_tipe/varian_jumlah default 'tunggal'/1 SAAT GENERATE — BOM
//     Aksesoris tidak (belum) punya field pemisah varian (§3 vue-master-
//     produk.js: cuma tahap_proses/bahan_aksesoris_id/nama/warna/qty/satuan/
//     webbing2/webbing3), jadi satu baris BOM = satu varian tunggal sampai
//     Guru menjawab §7 dan field varian ditambah ke BOM Aksesoris.
//   - keadaan_cetak/sisa_dicetak SENGAJA TIDAK disimpan di sini (statis,
//     bisa basi begitu stok berubah) — dihitung LIVE di js/vue-persiapan-
//     finishing.js dari stok terkini vs `butuh`, sama pola seperti kolom
//     "cukup/selisih" Bahan (kelompokKartuBahan()).
function hitungFinishingRincian(anggotaList, petaBahan) {
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
  return baris;
}

// cariKaryawanByQr — DISALIN dari js/vue-absensi-qr.js (prosesHasilScan(),
// baris ~190-200; konvensi "salin logic kecil per-file" proyek ini). QR
// pribadi tiap akun isinya id_app (prioritas) ATAU email (fallback, lihat
// vue-account-profile.js muatAccountDisplay) — email JUGA jadi document
// ID koleksi users, makanya dicoba id_app dulu (query), baru fallback
// getDoc langsung pakai hasil scan sebagai email/doc id.
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

const PersiapanDisiapkanManager = {
  components: { PopupPratinjauCetakLabel, KolomCari },
  setup() {
    const memuat = ref(true);
    const daftarOrder = ref([]);
    const cari = ref('');
    const filterAktif = ref('semua'); // 'semua' | 'sepola' | 'belum_terkunci'
    const klasterTerbuka = reactive({}); // kunciGrup -> bool ("buka rincian")
    const panelKlasterKey = ref(null); // kunciGrup klaster yang lagi disiapkan di panel kanan/bar mobile
    const pilihanCentang = reactive({}); // orderId -> bool (ikut/tidak di panel)
    const pilihanQty = reactive({}); // orderId -> number (qty yang diambil, <= sisa qty SPK itu)
    const vendorManualPanel = ref(false);
    const previewKode = ref('');
    const sedangProses = reactive({}); // key klaster -> bool
    const sedangProsesSingle = reactive({}); // orderId -> bool ("Buat Grouping Sendiri")
    const vendorManualSingle = reactive({}); // orderId -> bool
    const konfirmasiTerbit = ref(null); // {kode, namaProduk, qtyTotal, jalurAktif, groupingId} — tampil SEKALI setelah terbit
    const popupCetakLabelAktif = ref(false);
    const daftarLabelPreview = ref([]);

    const menuId = 'pp_disiapkan';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'add') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const snapOrder = await getDocs(query(collection(db, 'order_spk'), where('status', '==', 'Aktif')));
        const produk = await ambilSemuaProduk();
        const petaProduk = {};
        produk.forEach(p => { if (p.sku) petaProduk[p.sku] = p; });
        const list = [];
        snapOrder.forEach(d => {
          const data = d.data();
          const qtyOrder = parseFloat(data.qty_order) || 0;
          const qtyTergrouping = parseFloat(data.qty_tergrouping) || 0;
          const sisaQty = qtyOrder - qtyTergrouping;
          // Sudah HABIS dipakai grouping (sebagian atau seluruhnya) -> tidak
          // ikut antrean lagi. SPK yang baru tergrouping SEBAGIAN (sisaQty
          // masih > 0) TETAP tampil untuk sisa qty-nya (BARU, dukung split-qty).
          if (sisaQty <= 0) return;
          const p = data.sku_produk ? (petaProduk[data.sku_produk] || null) : null;
          const kp = p ? kunciPolaProduk(p) : '';
          const namaBase = p ? (p.nama || '').trim() : '';
          list.push({
            id: d.id, ...data,
            _produk: p,
            _sisaQty: sisaQty,
            _kunciGrup: p ? kunciGrupProduk(p) : '',
            _namaBase: namaBase || data.nama_produk || '(tanpa nama)',
            _size: p ? (p.size || '') : '',
            _warna: p ? (p.warna || '') : '',
            _kunciPolaLabel: kp
          });
        });
        daftarOrder.value = list;
      } catch (e) {
        console.error('Gagal muat antrean Perlu Disiapkan:', e);
        daftarOrder.value = [];
      }
      memuat.value = false;
    }

    // rincianWarna — dari SET order (`master_produk.warna`, resolve lewat
    // SKU) — lihat catatan besar di atas file soal kenapa bukan parsing teks.
    function rincianWarna(anggota) {
      const peta = {};
      anggota.forEach(o => {
        const w = o._warna || '-';
        peta[w] = (peta[w] || 0) + o._sisaQty;
      });
      return Object.entries(peta).map(([warna, qty]) => ({ warna, qty }));
    }

    // daftarBaris — SATU daftar gabungan (sesuai wireframe: bukan 2 section
    // terpisah lagi) — 3 jenis baris tercampur, disaring lewat kolom cari +
    // 2 filter pill ("sepola" / "pola belum dikunci"):
    //   'groupable'         — >=1 SPK berbagi kunciGrup penuh (nama+size+pola)
    //   'pola_belum_dikunci'— SKU terhubung TAPI BOM Pola kosong/tidak lengkap
    //   'tanpa_sku'         — SPK belum terhubung Master Produk sama sekali
    const daftarBaris = computed(() => {
      const petaGroupable = {}, petaBelumDikunci = {};
      const tanpaSku = [];
      daftarOrder.value.forEach(o => {
        if (o._kunciGrup) {
          if (!petaGroupable[o._kunciGrup]) petaGroupable[o._kunciGrup] = { tipe: 'groupable', kunciGrup: o._kunciGrup, namaBase: o._namaBase, size: o._size, kunciPolaLabel: o._kunciPolaLabel, anggota: [] };
          petaGroupable[o._kunciGrup].anggota.push(o);
        } else if (o._produk) {
          const key = 'nk::' + o._namaBase.toLowerCase() + '::' + (o._size || '').toLowerCase();
          if (!petaBelumDikunci[key]) petaBelumDikunci[key] = { tipe: 'pola_belum_dikunci', kunciGrup: key, namaBase: o._namaBase, size: o._size, anggota: [] };
          petaBelumDikunci[key].anggota.push(o);
        } else {
          tanpaSku.push({ tipe: 'tanpa_sku', kunciGrup: 'single-' + o.id, namaBase: o._namaBase, size: '', anggota: [o] });
        }
      });
      const groupable = Object.values(petaGroupable).map(k => ({
        ...k,
        qtyTotal: k.anggota.reduce((s, o) => s + o._sisaQty, 0),
        jalurOtomatis: Array.from(new Set(k.anggota.flatMap(o => Array.from(jalurOtomatisProduk(o._produk))))),
        rincianWarna: rincianWarna(k.anggota)
      }));
      const belumDikunci = Object.values(petaBelumDikunci).map(k => ({
        ...k, qtyTotal: k.anggota.reduce((s, o) => s + o._sisaQty, 0)
      }));
      let semua = [...groupable, ...belumDikunci, ...tanpaSku];

      const kata = cari.value.trim().toLowerCase();
      if (kata) {
        semua = semua.filter(b => b.namaBase.toLowerCase().includes(kata) || b.anggota.some(o => (o.no_spk || '').toLowerCase().includes(kata)));
      }
      if (filterAktif.value === 'sepola') semua = semua.filter(b => b.tipe === 'groupable');
      else if (filterAktif.value === 'belum_terkunci') semua = semua.filter(b => b.tipe !== 'groupable');

      return semua.sort((a, b) => {
        if (a.tipe !== b.tipe) return a.tipe === 'groupable' ? -1 : (b.tipe === 'groupable' ? 1 : 0);
        return (b.anggota.length - a.anggota.length) || a.namaBase.localeCompare(b.namaBase);
      });
    });

    function toggleRincian(b) { klasterTerbuka[b.kunciGrup] = !klasterTerbuka[b.kunciGrup]; }
    function toggleFilter(nilai) { filterAktif.value = (filterAktif.value === nilai) ? 'semua' : nilai; }

    // --- Panel "Grouping baru" (kanan desktop / bar mengambang mobile) ---
    async function muatPreviewKode() {
      try {
        const now = new Date();
        const tanggalKey = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const snap = await getDoc(doc(db, 'pengaturan_id_spk_grouping', tanggalKey));
        const nextCounter = (snap.exists() ? (snap.data().counter || 0) : 0) + 1;
        previewKode.value = `SPK${tanggalKey}${String(nextCounter).padStart(3, '0')}`;
      } catch (e) {
        previewKode.value = ''; // preview gagal dimuat bukan error fatal — kode SEBENARNYA tetap digenerate transaksional saat submit
      }
    }
    function bukaPanel(klaster) {
      panelKlasterKey.value = klaster.kunciGrup;
      klaster.anggota.forEach(o => { pilihanCentang[o.id] = true; pilihanQty[o.id] = o._sisaQty; });
      vendorManualPanel.value = false;
      muatPreviewKode();
    }
    function toggleKlasterDipilih(klaster) {
      if (panelKlasterKey.value === klaster.kunciGrup) panelKlasterKey.value = null;
      else bukaPanel(klaster);
    }
    function ubahQtyPilihan(order, nilai) {
      let v = parseFloat(nilai) || 0;
      if (v > order._sisaQty) v = order._sisaQty;
      if (v < 0) v = 0;
      pilihanQty[order.id] = v;
      if (v <= 0) pilihanCentang[order.id] = false;
    }

    const klasterPanel = computed(() => daftarBaris.value.find(b => b.tipe === 'groupable' && b.kunciGrup === panelKlasterKey.value) || null);
    const anggotaTerpilih = computed(() => klasterPanel.value ? klasterPanel.value.anggota.filter(o => pilihanCentang[o.id] && (parseFloat(pilihanQty[o.id]) || 0) > 0) : []);
    const ringkasanPanel = computed(() => {
      const list = anggotaTerpilih.value;
      return {
        jumlahSpk: list.length,
        qtyTotal: list.reduce((s, o) => s + (parseFloat(pilihanQty[o.id]) || 0), 0),
        jumlahWarna: new Set(list.map(o => o._warna || '-')).size
      };
    });
    const jalurOtomatisPanel = computed(() => klasterPanel.value ? Array.from(new Set(anggotaTerpilih.value.flatMap(o => Array.from(jalurOtomatisProduk(o._produk))))) : []);

    async function buatGroupingDariPanel() {
      const klaster = klasterPanel.value;
      if (!klaster) return;
      const anggota = anggotaTerpilih.value;
      if (anggota.length === 0) { alert('Pilih minimal 1 SPK dulu.'); return; }
      const key = klaster.kunciGrup;
      if (sedangProses[key]) return;
      sedangProses[key] = true;
      try {
        const kode = await generateKodeSpkGrouping();
        const jalurAktif = Array.from(new Set([...jalurOtomatisPanel.value, ...(vendorManualPanel.value ? ['vendor'] : [])]));
        const breakdown = anggota.map(o => ({ order_spk_id: o.id, no_spk: o.no_spk, sku_produk: o.sku_produk || '', nama_produk: o.nama_produk, qty: parseFloat(pilihanQty[o.id]) || 0 }));
        const qtyTotal = breakdown.reduce((s, b) => s + b.qty, 0);
        const skuTerlibat = Array.from(new Set(anggota.map(o => o.sku_produk).filter(Boolean)));
        const refGrouping = await addDoc(collection(db, 'spk_grouping'), {
          kode_spk: kode,
          nama_produk: klaster.namaBase,
          size: klaster.size || '',
          kunci_pola: klaster.kunciPolaLabel || '',
          sku_produk_terlibat: skuTerlibat,
          qty_total: qtyTotal,
          breakdown,
          jalur_aktif: jalurAktif,
          label_grouping_dicetak: false,
          tanggal_generate: serverTimestamp(),
          dibuat_oleh: window.currentUser?.email || null
        });
        // qty_tergrouping BERTAMBAH (bukan ditimpa) — dukung split-qty:
        // 1 order_spk bisa ikut >1 grouping sepanjang sisa qty-nya masih ada.
        await Promise.all(anggota.map(o => {
          const ambil = parseFloat(pilihanQty[o.id]) || 0;
          const tergroupingBaru = (parseFloat(o.qty_tergrouping) || 0) + ambil;
          const habis = tergroupingBaru >= (parseFloat(o.qty_order) || 0);
          return updateDoc(doc(db, 'order_spk', o.id), {
            qty_tergrouping: tergroupingBaru,
            grouping_ids: arrayUnion(refGrouping.id),
            id_spk_grouping: refGrouping.id, // grouping TERAKHIR (kompatibilitas tampilan lama), BUKAN satu-satunya
            kode_spk_grouping: kode,
            status_grouping: habis ? 'tergrouping' : 'sebagian'
          });
        }));
        let bahanRincian = [], sewingRincian = [], webbingRincian = [], finishingRincian = [];
        if (jalurAktif.some(j => ['bahan', 'sewing', 'webbing', 'finishing'].includes(j))) {
          const petaBahan = await ambilPetaBahanAksesoris();
          const anggotaBaris = anggota.map(o => ({ order_spk_id: o.id, no_spk: o.no_spk, qty: parseFloat(pilihanQty[o.id]) || 0, _produk: o._produk }));
          if (jalurAktif.includes('bahan')) bahanRincian = hitungBahanRincian(anggotaBaris, petaBahan);
          if (jalurAktif.includes('sewing')) sewingRincian = hitungSewingRincian(anggotaBaris, petaBahan);
          if (jalurAktif.includes('webbing')) webbingRincian = hitungWebbingRincian(anggotaBaris, petaBahan);
          if (jalurAktif.includes('finishing')) finishingRincian = hitungFinishingRincian(anggotaBaris, petaBahan);
        }
        await buatSpkTrackUntukGrouping(refGrouping.id, kode, klaster.namaBase, qtyTotal, jalurAktif, bahanRincian, sewingRincian, webbingRincian, finishingRincian);
        konfirmasiTerbit.value = { kode, namaProduk: klaster.namaBase, qtyTotal, jalurAktif, groupingId: refGrouping.id };
        panelKlasterKey.value = null;
        await muat();
      } catch (e) {
        console.error('Gagal buat SPK Grouping:', e);
        alert('Gagal membuat SPK Grouping. Coba lagi.');
      }
      sedangProses[key] = false;
    }

    // buatGroupingSendiri — baris "tanpa_sku" (belum terhubung Master
    // Produk) — tidak lewat panel (tidak ada anggota lain buat dikombinasi),
    // langsung ambil SELURUH sisa qty SPK itu, sama seperti versi lama.
    async function buatGroupingSendiri(order) {
      const key = order.id;
      if (sedangProsesSingle[key]) return;
      sedangProsesSingle[key] = true;
      try {
        const kode = await generateKodeSpkGrouping();
        const jalurAktif = order._produk ? Array.from(jalurOtomatisProduk(order._produk)) : [];
        if (vendorManualSingle[key]) jalurAktif.push('vendor');
        const jalurUnik = Array.from(new Set(jalurAktif));
        const qty = order._sisaQty;
        const refGrouping = await addDoc(collection(db, 'spk_grouping'), {
          kode_spk: kode,
          nama_produk: order._namaBase,
          size: order._size || '',
          kunci_pola: order._kunciPolaLabel || '',
          sku_produk_terlibat: order.sku_produk ? [order.sku_produk] : [],
          qty_total: qty,
          breakdown: [{ order_spk_id: order.id, no_spk: order.no_spk, sku_produk: order.sku_produk || '', nama_produk: order.nama_produk, qty }],
          jalur_aktif: jalurUnik,
          label_grouping_dicetak: false,
          tanggal_generate: serverTimestamp(),
          dibuat_oleh: window.currentUser?.email || null
        });
        const tergroupingBaru = (parseFloat(order.qty_tergrouping) || 0) + qty;
        await updateDoc(doc(db, 'order_spk', order.id), {
          qty_tergrouping: tergroupingBaru,
          grouping_ids: arrayUnion(refGrouping.id),
          id_spk_grouping: refGrouping.id, kode_spk_grouping: kode, status_grouping: 'tergrouping'
        });
        let bahanRincianSendiri = [], sewingRincianSendiri = [], webbingRincianSendiri = [], finishingRincianSendiri = [];
        if (jalurUnik.some(j => ['bahan', 'sewing', 'webbing', 'finishing'].includes(j))) {
          const petaBahan = await ambilPetaBahanAksesoris();
          const anggotaBaris = [{ order_spk_id: order.id, no_spk: order.no_spk, qty, _produk: order._produk }];
          if (jalurUnik.includes('bahan')) bahanRincianSendiri = hitungBahanRincian(anggotaBaris, petaBahan);
          if (jalurUnik.includes('sewing')) sewingRincianSendiri = hitungSewingRincian(anggotaBaris, petaBahan);
          if (jalurUnik.includes('webbing')) webbingRincianSendiri = hitungWebbingRincian(anggotaBaris, petaBahan);
          if (jalurUnik.includes('finishing')) finishingRincianSendiri = hitungFinishingRincian(anggotaBaris, petaBahan);
        }
        await buatSpkTrackUntukGrouping(refGrouping.id, kode, order._namaBase, qty, jalurUnik, bahanRincianSendiri, sewingRincianSendiri, webbingRincianSendiri, finishingRincianSendiri);
        konfirmasiTerbit.value = { kode, namaProduk: order._namaBase, qtyTotal: qty, jalurAktif: jalurUnik, groupingId: refGrouping.id };
        delete vendorManualSingle[key];
        await muat();
      } catch (e) {
        console.error('Gagal buat SPK Grouping (mandiri):', e);
        alert('Gagal membuat SPK Grouping. Coba lagi.');
      }
      sedangProsesSingle[key] = false;
    }

    function cetakLabelDariKonfirmasi() {
      if (!konfirmasiTerbit.value) return;
      if (typeof QRCode === 'undefined') { alert('Library pembuat QR belum siap dimuat. Coba refresh halaman (Ctrl+Shift+R) lalu ulangi.'); return; }
      const k = konfirmasiTerbit.value;
      daftarLabelPreview.value = [{
        kode: k.kode, nama: k.namaProduk,
        info: `Qty Total: ${formatQty(k.qtyTotal)} &middot; ${(k.jalurAktif || []).map(j => PETA_JALUR[j]?.label || j).join(', ')}`,
        qrDataUrl: buatQrDataUrl(k.kode)
      }];
      popupCetakLabelAktif.value = true;
      if (k.groupingId) updateDoc(doc(db, 'spk_grouping', k.groupingId), { label_grouping_dicetak: true }).catch(e => console.error('Gagal catat status cetak label SPK Grouping:', e));
      konfirmasiTerbit.value = null;
    }

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, daftarOrder, daftarBaris, cari, filterAktif, klasterTerbuka, toggleRincian, toggleFilter,
      panelKlasterKey, klasterPanel, anggotaTerpilih, ringkasanPanel, jalurOtomatisPanel,
      pilihanCentang, pilihanQty, vendorManualPanel, previewKode, ubahQtyPilihan, toggleKlasterDipilih,
      sedangProses, sedangProsesSingle, vendorManualSingle, bolehProses, bolehCetak,
      buatGroupingDariPanel, buatGroupingSendiri,
      konfirmasiTerbit, cetakLabelDariKonfirmasi,
      popupCetakLabelAktif, daftarLabelPreview,
      formatQty, PETA_JALUR
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else class="gc-pp-layout">
      <div style="min-width:0;">
        <kolom-cari v-model="cari" placeholder="Cari produk / No. SPK..." />
        <div style="display:flex; gap:8px; margin:-4px 0 12px; flex-wrap:wrap;">
          <button type="button" class="gc-sub-tab-btn" :class="{active: filterAktif==='sepola'}" @click="toggleFilter('sepola')">Sepola</button>
          <button type="button" class="gc-sub-tab-btn" :class="{active: filterAktif==='belum_terkunci'}" @click="toggleFilter('belum_terkunci')">Pola belum dikunci</button>
        </div>

        <div v-if="daftarBaris.length === 0" class="gc-kosong gc-card gc-card-menonjol">
          <div class="lingkaran"><i class="fas fa-circle-check"></i></div>
          <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada SPK aktif yang cocok</h3>
        </div>

        <div v-else style="display:flex; flex-direction:column; gap:10px;">
          <div v-for="b in daftarBaris" :key="b.kunciGrup" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
              <div style="min-width:0;">
                <div class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ b.namaBase }}<span v-if="b.size"> &middot; ukuran {{ b.size }}</span></div>
                <div v-if="b.tipe==='groupable'" style="font-size:10.5px; color:var(--text-faint); margin-top:2px;">kunci: nama + ukuran + pola {{ b.kunciPolaLabel }}</div>
                <div v-else-if="b.tipe==='pola_belum_dikunci'" style="font-size:10.5px; color:var(--text-faint); margin-top:2px;">pola belum ada versi &mdash; tidak bisa digabung sampai pola dikunci</div>
                <div v-else style="font-size:10.5px; color:var(--text-faint); margin-top:2px;">{{ b.anggota[0].nama_produk }} &middot; belum terhubung Master Produk</div>
              </div>
              <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex-shrink:0;">
                <span class="tag" :class="b.tipe==='groupable' ? 'ok' : (b.tipe==='pola_belum_dikunci' ? 'warn' : 'neutral')">
                  {{ b.tipe==='groupable' ? (b.anggota.length + ' SPK') : (b.tipe==='pola_belum_dikunci' ? 'pola belum dikunci' : 'belum ada SKU') }}
                </span>
                <button v-if="b.tipe==='groupable' && bolehProses" type="button" class="btn-outline" :class="{filled: panelKlasterKey===b.kunciGrup}" style="padding:6px 12px; font-size:11px;" @click="toggleKlasterDipilih(b)">
                  <i class="fas" :class="panelKlasterKey===b.kunciGrup ? 'fa-check' : 'fa-plus'"></i> {{ panelKlasterKey===b.kunciGrup ? 'Dipilih' : 'Pilih' }}
                </button>
              </div>
            </div>

            <div style="font-size:11.5px; color:var(--text-muted); margin-bottom:6px;">{{ b.anggota.length }} SPK &middot; {{ formatQty(b.qtyTotal) }} pcs</div>
            <div v-if="b.tipe==='groupable' && b.rincianWarna.length" style="font-size:11px; color:var(--text-faint); margin-bottom:6px;">{{ b.rincianWarna.map(r => r.warna + ' ' + formatQty(r.qty)).join(' &middot; ') }}</div>
            <div v-if="b.tipe==='groupable'" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
              <span v-for="j in b.jalurOtomatis" :key="j" class="tag" :class="PETA_JALUR[j].tag"><i class="fas" :class="PETA_JALUR[j].icon"></i> {{ PETA_JALUR[j].label }}</span>
            </div>

            <button type="button" @click="toggleRincian(b)" style="background:none; border:none; padding:0; color:var(--aksen-ink); font-size:11px; font-weight:700; cursor:pointer;">
              {{ klasterTerbuka[b.kunciGrup] ? 'Tutup rincian' : 'Buka rincian' }} <i class="fas" :class="klasterTerbuka[b.kunciGrup] ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
            </button>
            <div v-if="klasterTerbuka[b.kunciGrup]" style="display:flex; flex-direction:column; gap:4px; background:var(--ivory-dim); border-radius:10px; padding:8px 12px; margin-top:8px;">
              <div v-for="o in b.anggota" :key="o.id" style="display:flex; justify-content:space-between; gap:10px; font-size:11.5px;">
                <span style="color:var(--text-faint);">{{ o.no_spk }}</span>
                <span style="font-weight:700;">{{ formatQty(o._sisaQty) }} pcs</span>
              </div>
            </div>

            <button v-if="b.tipe==='tanpa_sku' && bolehProses" type="button" @click="buatGroupingSendiri(b.anggota[0])" :disabled="sedangProsesSingle[b.anggota[0].id]" class="btn-outline" style="width:100%; padding:9px; margin-top:10px;">
              <i class="fas fa-layer-group" style="margin-right:6px;"></i>{{ sedangProsesSingle[b.anggota[0].id] ? 'Memproses...' : 'Buat Grouping Sendiri' }}
            </button>
            <label v-if="b.tipe==='tanpa_sku' && bolehProses" style="display:flex; align-items:center; gap:6px; font-size:11px; cursor:pointer; color:var(--text-muted); margin-top:8px;">
              <input type="checkbox" v-model="vendorManualSingle[b.anggota[0].id]" class="gc-chk"> + Jalur Vendor (manual)
            </label>
          </div>
        </div>
      </div>

      <!-- Panel "Grouping baru" — desktop kanan sticky -->
      <div class="gc-pp-panel gc-card gc-card-menonjol" style="padding:16px; border-radius:20px;" v-if="klasterPanel">
        <h3 class="gc-heading" style="font-weight:700; font-size:14px; margin:0 0 2px;">Grouping baru</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0 0 12px;">{{ ringkasanPanel.jumlahSpk }} SPK dipilih &middot; {{ formatQty(ringkasanPanel.qtyTotal) }} pcs &middot; {{ ringkasanPanel.jumlahWarna }} warna</p>

        <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">
          <div v-for="o in klasterPanel.anggota" :key="o.id" style="display:flex; align-items:center; gap:8px; font-size:11.5px;">
            <input type="checkbox" v-model="pilihanCentang[o.id]" class="gc-chk">
            <span style="flex:1; min-width:0; color:var(--text-muted);">{{ o._warna || o.no_spk }}</span>
            <input type="number" min="0" :max="o._sisaQty" :value="pilihanQty[o.id]" @input="ubahQtyPilihan(o, $event.target.value)" :disabled="!pilihanCentang[o.id]" style="width:58px; padding:5px 7px; border:1.5px solid var(--line); border-radius:8px; font-size:11px; text-align:right; font-family:'Nunito Sans',sans-serif;">
          </div>
        </div>

        <div style="border:1px solid var(--burgundy); border-radius:12px; padding:10px 12px; margin-bottom:12px;">
          <div style="font-size:9.5px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.05em; margin-bottom:4px;">Kode yang akan diterbitkan</div>
          <div class="gc-heading gc-num" style="font-size:18px; font-weight:700;">{{ previewKode || '...' }}</div>
          <p style="font-size:9.5px; color:var(--text-faint); margin:4px 0 0; line-height:1.4;">SPK + tanggal + urut hari ini &middot; nomor anak tiap SPK mengikuti kode ini</p>
        </div>

        <div style="border:1px dashed var(--line); border-radius:12px; padding:10px 12px; margin-bottom:8px;">
          <div style="font-size:9.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px;">Akan masuk ke &mdash; otomatis</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            <span v-for="j in jalurOtomatisPanel" :key="j" class="tag" :class="PETA_JALUR[j].tag"><i class="fas" :class="PETA_JALUR[j].icon"></i> {{ PETA_JALUR[j].label }}</span>
            <span v-if="jalurOtomatisPanel.length===0" style="font-size:10.5px; color:var(--text-faint);">-</span>
          </div>
          <p style="font-size:9.5px; color:var(--text-faint); margin:6px 0 0;">Terdeteksi otomatis dari BOM produk &middot; bukan pilihan</p>
          <label style="display:flex; align-items:center; gap:6px; font-size:11px; cursor:pointer; color:var(--text-muted); margin-top:8px;">
            <input type="checkbox" v-model="vendorManualPanel" class="gc-chk"> + Jalur Vendor (manual)
          </label>
        </div>

        <div style="border:1px dashed var(--line); border-radius:12px; padding:10px 12px; margin-bottom:14px;">
          <div style="font-size:9.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:4px;">Tidak dikerjakan di sini</div>
          <p style="font-size:9.5px; color:var(--text-faint); margin:0;">Cek stok &amp; cetak label ada di tiap pos persiapan</p>
        </div>

        <button v-if="bolehProses" type="button" @click="buatGroupingDariPanel" :disabled="sedangProses[klasterPanel.kunciGrup] || ringkasanPanel.jumlahSpk===0" class="btn-primary" style="width:100%; padding:11px;">
          <i class="fas fa-layer-group" style="margin-right:6px;"></i>{{ sedangProses[klasterPanel.kunciGrup] ? 'Memproses...' : 'Buat SPK Grouping' }}
        </button>
        <p style="font-size:9.5px; color:var(--text-faint); margin:8px 0 0; text-align:center;">Sekali diterbitkan, kode ini yang dipakai seluruh pos sampai selesai</p>
      </div>
    </div>

    <!-- Bar mengambang — mobile, tampil kalau ada klaster dipilih -->
    <div v-if="klasterPanel" class="gc-pp-panel-mobile">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px;">
        <div style="font-size:11px; color:var(--text-muted);">{{ ringkasanPanel.jumlahSpk }} SPK dipilih &middot; {{ formatQty(ringkasanPanel.qtyTotal) }} pcs</div>
        <button type="button" @click="panelKlasterKey=null" style="background:none; border:none; padding:0; color:var(--text-faint); font-size:14px;"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="gc-heading gc-num" style="font-size:15px; font-weight:700; margin-bottom:8px;">{{ previewKode || '...' }}</div>
      <button v-if="bolehProses" type="button" @click="buatGroupingDariPanel" :disabled="sedangProses[klasterPanel.kunciGrup] || ringkasanPanel.jumlahSpk===0" class="btn-primary" style="width:100%; padding:11px;">
        {{ sedangProses[klasterPanel.kunciGrup] ? 'Memproses...' : 'Buat SPK Grouping' }}
      </button>
    </div>

    <!-- Konfirmasi terbit — tampil SEKALI, tidak ada riwayat persisten -->
    <div v-if="konfirmasiTerbit" class="gc-dialog-backdrop" @click="konfirmasiTerbit=null">
      <div class="gc-dialog" @click.stop>
        <div style="width:56px; height:56px; border-radius:50%; background:var(--ok-light); display:flex; align-items:center; justify-content:center; margin:0 auto 14px; color:var(--ok); font-size:24px;"><i class="fas fa-circle-check"></i></div>
        <h3 class="gc-heading" style="font-size:16px; font-weight:700; margin:0;">SPK Grouping Diterbitkan</h3>
        <p class="gc-heading gc-num" style="font-size:19px; font-weight:700; margin:8px 0 2px;">{{ konfirmasiTerbit.kode }}</p>
        <p style="font-size:11.5px; color:var(--text-muted); margin:0 0 18px;">{{ konfirmasiTerbit.namaProduk }} &middot; {{ formatQty(konfirmasiTerbit.qtyTotal) }} pcs</p>
        <div style="display:flex; gap:8px;">
          <button v-if="bolehCetak" @click="cetakLabelDariKonfirmasi" class="btn-primary" style="flex:1;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Label</button>
          <button @click="konfirmasiTerbit=null" class="btn-outline" style="flex:1;">Tutup</button>
        </div>
      </div>
    </div>

    <popup-pratinjau-cetak-label :terbuka="popupCetakLabelAktif" judul="Cetak Label SPK Grouping" :daftar-label="daftarLabelPreview" @tutup="popupCetakLabelAktif = false" />
  `
};

const AppPersiapanDisiapkan = { components: { PersiapanDisiapkanManager }, template: `<persiapan-disiapkan-manager />` };
let vmPpDisiapkan = null;
window.pastikanMountPpDisiapkan = function() {
  if (vmPpDisiapkan) return;
  const mountPoint = document.getElementById('vue-pp-disiapkan');
  if (mountPoint) vmPpDisiapkan = createApp(AppPersiapanDisiapkan).mount('#vue-pp-disiapkan');
};

// ============================================================================
// JalurTahapManager — Fase 2 (29 Agt 2026 malam), jalur Bahan. Komponen
// REUSABLE (prop `jalur`) — sengaja ditulis generik dari awal (bukan
// khusus "bahan") supaya Fase 3 (Acc Sewing/Webbing/Finishing) tinggal
// pasang mount baru dengan `jalur` beda, TIDAK perlu tulis ulang
// komponen ini (sama semangatnya dengan PersiapanKomponenListManager di
// sistem lama yang direuse lewat prop `tipe`).
//
// 1 instance = 1 TAHAP (dipasang 5x independen, 1 per div child-tab,
// sama pola mount-on-demand seperti Config's 8 tab child) — bukan 1
// instance mengurus semua 5 tahap sekaligus, supaya tiap tahap cuma
// query & render kartu yang relevan buat dirinya sendiri.
//
// Target scan per aksi (KEPUTUSAN SEPIHAK, catat di sini biar gampang
// dikoreksi Guru kalau meleset — konsisten pola "keputusan sepihak"
// proyek ini): SEMUA aksi scan (kecuali Scan Operator) scan LABEL FISIK
// yang menempel di batch pada tahap itu (Label SPK Grouping utk Entry/
// Masalah, Label Bagging utk Pack, Label Tugas utk Kirim/Sampai) — bukan
// scan barang/roll individual seperti Scan Persiapan (vue-scan-
// persiapan.js). Alasannya: jalur Bahan ini kerjanya per-BATCH gabungan
// (1 SPK Grouping = 1 hamparan kain), bukan per-item, jadi yang di-scan
// utk konfirmasi ya label batch itu sendiri, bukan makna "pemakaian
// barang" seperti Scan Persiapan yang sudah ada.
// ============================================================================
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

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDocs(query(collection(db, 'spk_track'), where('jalur', '==', props.jalur), where('status', '==', props.tahap)));
        daftarTrack.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error(`Gagal muat spk_track (jalur=${props.jalur}, tahap=${props.tahap}):`, e);
        daftarTrack.value = [];
      }
      memuat.value = false;
    }

    // --- Cetak Label Bagging / Label Tugas (perlu_dikirim / sedang_dikirim) ---
    const popupCetakLabelAktif = ref(false);
    const daftarLabelPreview = ref([]);
    function cetakLabelBagging(track) {
      if (typeof QRCode === 'undefined') { alert('Library pembuat QR belum siap dimuat. Coba refresh halaman (Ctrl+Shift+R) lalu ulangi.'); return; }
      const kodeBagging = track.kode_spk + '-BAG';
      updateDoc(doc(db, 'spk_track', track.id), { kode_bagging: kodeBagging, diperbarui_pada: serverTimestamp() })
        .then(muat)
        .catch(e => console.error('Gagal simpan kode_bagging:', e));
      daftarLabelPreview.value = [{ kode: kodeBagging, nama: track.nama_produk, info: `${track.kode_spk} &middot; Bagging`, qrDataUrl: buatQrDataUrl(kodeBagging) }];
      popupCetakLabelAktif.value = true;
    }
    function cetakLabelTugas(track) {
      if (typeof QRCode === 'undefined') { alert('Library pembuat QR belum siap dimuat. Coba refresh halaman (Ctrl+Shift+R) lalu ulangi.'); return; }
      const kodeTugas = track.kode_spk + '-TGS';
      updateDoc(doc(db, 'spk_track', track.id), { kode_tugas: kodeTugas, diperbarui_pada: serverTimestamp() })
        .then(muat)
        .catch(e => console.error('Gagal simpan kode_tugas:', e));
      daftarLabelPreview.value = [{ kode: kodeTugas, nama: track.nama_produk, info: `${track.kode_spk} &middot; Tugas`, qrDataUrl: buatQrDataUrl(kodeTugas) }];
      popupCetakLabelAktif.value = true;
    }

    // --- Kamera/QR — pola SAMA seperti vue-scan-persiapan.js. ---
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

        if (mode === 'operator') {
          // Gerbang: Label SPK Grouping WAJIB sudah dicetak dulu (Guru:
          // "Label SPK Grouping -> Scan Operator") sebelum operator bisa
          // ditugaskan.
          const groupSnap = await getDoc(doc(db, 'spk_grouping', track.grouping_id));
          if (!groupSnap.exists() || !groupSnap.data().label_grouping_dicetak) {
            alert('Label SPK Grouping belum dicetak. Cetak dulu di menu "Perlu Disiapkan" sebelum Scan Operator.');
            return;
          }
          const karyawan = await cariKaryawanByQr(kode);
          if (!karyawan) { alert('QR tidak dikenali — karyawan tidak ditemukan.'); return; }
          await updateDoc(doc(db, 'spk_track', track.id), {
            operator_id: karyawan.id, operator_nama: karyawan.nama || karyawan.name || karyawan.id,
            status: 'sedang_diproses', diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'operator', oleh: karyawan.nama || karyawan.name || karyawan.id, pada })
          });
        } else if (mode === 'entry') {
          if (kode !== track.kode_spk) { alert(`Kode yang discan ("${kode}") tidak cocok dengan SPK Grouping ini (${track.kode_spk}).`); return; }
          await updateDoc(doc(db, 'spk_track', track.id), {
            status: 'perlu_dikirim', diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'entry', oleh, pada })
          });
        } else if (mode === 'masalah') {
          if (kode !== track.kode_spk) { alert(`Kode yang discan ("${kode}") tidak cocok dengan SPK Grouping ini (${track.kode_spk}).`); return; }
          const catatan = prompt('Jelaskan masalahnya:');
          if (!catatan || !catatan.trim()) return;
          await updateDoc(doc(db, 'spk_track', track.id), {
            catatan_masalah: catatan.trim(), diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'masalah', oleh, pada, catatan: catatan.trim() })
          });
        } else if (mode === 'pack') {
          if (kode !== track.kode_bagging) { alert(`Kode yang discan ("${kode}") tidak cocok dengan Label Bagging SPK ini (${track.kode_bagging}).`); return; }
          await updateDoc(doc(db, 'spk_track', track.id), {
            status: 'sedang_dikirim', diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'pack', oleh, pada })
          });
        } else if (mode === 'kirim') {
          if (kode !== track.kode_tugas) { alert(`Kode yang discan ("${kode}") tidak cocok dengan Label Tugas SPK ini (${track.kode_tugas}).`); return; }
          // Status TETAP "Sedang Dikirim" (Guru: "SCAN SAMPAI pada proses
          // selanjutnya" yang baru mengubah status) — cuma catat riwayat.
          await updateDoc(doc(db, 'spk_track', track.id), {
            diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'kirim', oleh, pada })
          });
        } else if (mode === 'sampai') {
          if (kode !== track.kode_tugas) { alert(`Kode yang discan ("${kode}") tidak cocok dengan Label Tugas SPK ini (${track.kode_tugas}).`); return; }
          await updateDoc(doc(db, 'spk_track', track.id), {
            status: 'selesai', diperbarui_pada: serverTimestamp(),
            riwayat_scan: arrayUnion({ aksi: 'sampai', oleh, pada })
          });
        }
        await muat();
      } catch (e) {
        console.error('Gagal proses hasil scan:', mode, e);
        alert('Gagal memproses hasil scan. Coba lagi.');
      }
      sedangProses[track.id] = false;
    }

    onMounted(async () => { await window.authReady; await muat(); });
    onUnmounted(tutupScan);

    return {
      memuat, daftarTrack, sedangProses, bolehProses, bolehCetak,
      cetakLabelBagging, cetakLabelTugas, popupCetakLabelAktif, daftarLabelPreview,
      modeScan, trackAktifScan, videoScanEl, canvasScanEl, scanMemuatKamera, scanError,
      bukaScan, tutupScan, LABEL_AKSI_SCAN, formatQty
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
            <div class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ t.kode_spk }}</div>
            <div style="font-size:11px; color:var(--text-faint); margin-top:2px;">{{ t.nama_produk }} &middot; {{ formatQty(t.qty_total) }} pcs</div>
          </div>
          <span class="tag pink" style="flex-shrink:0;">{{ labelJalur }}</span>
        </div>

        <div v-if="t.operator_nama" style="font-size:11.5px; color:var(--text-muted); margin-bottom:8px;"><i class="fas fa-user" style="margin-right:6px; color:var(--aksen-ink);"></i>Operator: <b>{{ t.operator_nama }}</b></div>
        <div v-if="t.catatan_masalah" style="font-size:11.5px; color:var(--danger); margin-bottom:8px; background:var(--danger-light); border-radius:8px; padding:6px 10px;"><i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>{{ t.catatan_masalah }}</div>

        <!-- Perlu Diproses -->
        <button v-if="tahap==='perlu_diproses' && bolehProses" @click="bukaScan('operator', t)" :disabled="sedangProses[t.id]" class="btn-primary" style="width:100%; padding:10px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Operator</button>

        <!-- Sedang Diproses -->
        <div v-if="tahap==='sedang_diproses' && bolehProses" style="display:flex; gap:8px;">
          <button @click="bukaScan('entry', t)" :disabled="sedangProses[t.id]" class="btn-primary" style="flex:1; padding:10px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Entry</button>
          <button @click="bukaScan('masalah', t)" :disabled="sedangProses[t.id]" class="btn-outline" style="flex:1; padding:10px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>Scan Masalah</button>
        </div>

        <!-- Perlu Dikirim -->
        <template v-if="tahap==='perlu_dikirim' && bolehProses">
          <button v-if="!t.kode_bagging" @click="cetakLabelBagging(t)" class="btn-outline" style="width:100%; padding:10px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Label Bagging</button>
          <button v-else @click="bukaScan('pack', t)" :disabled="sedangProses[t.id]" class="btn-primary" style="width:100%; padding:10px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Pack ({{ t.kode_bagging }})</button>
        </template>

        <!-- Sedang Dikirim -->
        <template v-if="tahap==='sedang_dikirim' && bolehProses">
          <button v-if="!t.kode_tugas" @click="cetakLabelTugas(t)" class="btn-outline" style="width:100%; padding:10px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Label Tugas</button>
          <div v-else style="display:flex; gap:8px;">
            <button @click="bukaScan('kirim', t)" :disabled="sedangProses[t.id]" class="btn-outline" style="flex:1; padding:10px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Kirim</button>
            <button @click="bukaScan('sampai', t)" :disabled="sedangProses[t.id]" class="btn-primary" style="flex:1; padding:10px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Sampai</button>
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

    <popup-pratinjau-cetak-label :terbuka="popupCetakLabelAktif" judul="Cetak Label" :daftar-label="daftarLabelPreview" @tutup="popupCetakLabelAktif = false" />
  `
};

function buatAppJalurTahap(jalur, labelJalur, tahap, labelTahap) {
  return {
    components: { JalurTahapManager },
    template: `<jalur-tahap-manager jalur="${jalur}" label-jalur="${labelJalur}" tahap="${tahap}" label-tahap="${labelTahap}" />`
  };
}

let vmPpBahanPerluDiproses = null;
window.pastikanMountPpBahanPerluDiproses = function() {
  if (vmPpBahanPerluDiproses) return;
  const mountPoint = document.getElementById('vue-pp-bahan-perludiproses');
  if (mountPoint) vmPpBahanPerluDiproses = createApp(buatAppJalurTahap('bahan', 'Bahan', 'perlu_diproses', 'Perlu Diproses')).mount('#vue-pp-bahan-perludiproses');
};
let vmPpBahanSedangDiproses = null;
window.pastikanMountPpBahanSedangDiproses = function() {
  if (vmPpBahanSedangDiproses) return;
  const mountPoint = document.getElementById('vue-pp-bahan-sedangdiproses');
  if (mountPoint) vmPpBahanSedangDiproses = createApp(buatAppJalurTahap('bahan', 'Bahan', 'sedang_diproses', 'Sedang Diproses')).mount('#vue-pp-bahan-sedangdiproses');
};
let vmPpBahanPerluDikirim = null;
window.pastikanMountPpBahanPerluDikirim = function() {
  if (vmPpBahanPerluDikirim) return;
  const mountPoint = document.getElementById('vue-pp-bahan-perludikirim');
  if (mountPoint) vmPpBahanPerluDikirim = createApp(buatAppJalurTahap('bahan', 'Bahan', 'perlu_dikirim', 'Perlu Dikirim')).mount('#vue-pp-bahan-perludikirim');
};
let vmPpBahanSedangDikirim = null;
window.pastikanMountPpBahanSedangDikirim = function() {
  if (vmPpBahanSedangDikirim) return;
  const mountPoint = document.getElementById('vue-pp-bahan-sedangdikirim');
  if (mountPoint) vmPpBahanSedangDikirim = createApp(buatAppJalurTahap('bahan', 'Bahan', 'sedang_dikirim', 'Sedang Dikirim')).mount('#vue-pp-bahan-sedangdikirim');
};
let vmPpBahanSelesai = null;
window.pastikanMountPpBahanSelesai = function() {
  if (vmPpBahanSelesai) return;
  const mountPoint = document.getElementById('vue-pp-bahan-selesai');
  if (mountPoint) vmPpBahanSelesai = createApp(buatAppJalurTahap('bahan', 'Bahan', 'selesai', 'Selesai')).mount('#vue-pp-bahan-selesai');
};

// ============================================================================
// Fase 3 (29 Agt 2026, malam) — 3 jalur Acc (Sewing/Webbing/Finishing).
// TIDAK ADA komponen baru ditulis — persis seperti diperkirakan di
// RENCANA-PERSIAPAN-PRODUKSI-V2.md §7 poin 3 ("state machine-nya sama
// persis dengan Fase 2, tinggal parametrisasi jalur"): JalurTahapManager +
// buatAppJalurTahap() (di atas) dipakai APA ADANYA, cuma parameter `jalur`/
// `labelJalur` yang beda. 15 mount function baru (3 jalur x 5 tahap),
// ditulis eksplisit satu-satu (bukan loop) — konsisten gaya kode proyek
// ini (gampang di-grep, gampang ditelusuri 1:1 ke index.html/dashboard.js).
// ============================================================================
let vmPpSewingPerluDiproses = null;
window.pastikanMountPpSewingPerluDiproses = function() {
  if (vmPpSewingPerluDiproses) return;
  const mountPoint = document.getElementById('vue-pp-sewing-perludiproses');
  if (mountPoint) vmPpSewingPerluDiproses = createApp(buatAppJalurTahap('sewing', 'Acc Sewing', 'perlu_diproses', 'Perlu Diproses')).mount('#vue-pp-sewing-perludiproses');
};
let vmPpSewingSedangDiproses = null;
window.pastikanMountPpSewingSedangDiproses = function() {
  if (vmPpSewingSedangDiproses) return;
  const mountPoint = document.getElementById('vue-pp-sewing-sedangdiproses');
  if (mountPoint) vmPpSewingSedangDiproses = createApp(buatAppJalurTahap('sewing', 'Acc Sewing', 'sedang_diproses', 'Sedang Diproses')).mount('#vue-pp-sewing-sedangdiproses');
};
let vmPpSewingPerluDikirim = null;
window.pastikanMountPpSewingPerluDikirim = function() {
  if (vmPpSewingPerluDikirim) return;
  const mountPoint = document.getElementById('vue-pp-sewing-perludikirim');
  if (mountPoint) vmPpSewingPerluDikirim = createApp(buatAppJalurTahap('sewing', 'Acc Sewing', 'perlu_dikirim', 'Perlu Dikirim')).mount('#vue-pp-sewing-perludikirim');
};
let vmPpSewingSedangDikirim = null;
window.pastikanMountPpSewingSedangDikirim = function() {
  if (vmPpSewingSedangDikirim) return;
  const mountPoint = document.getElementById('vue-pp-sewing-sedangdikirim');
  if (mountPoint) vmPpSewingSedangDikirim = createApp(buatAppJalurTahap('sewing', 'Acc Sewing', 'sedang_dikirim', 'Sedang Dikirim')).mount('#vue-pp-sewing-sedangdikirim');
};
let vmPpSewingSelesai = null;
window.pastikanMountPpSewingSelesai = function() {
  if (vmPpSewingSelesai) return;
  const mountPoint = document.getElementById('vue-pp-sewing-selesai');
  if (mountPoint) vmPpSewingSelesai = createApp(buatAppJalurTahap('sewing', 'Acc Sewing', 'selesai', 'Selesai')).mount('#vue-pp-sewing-selesai');
};

let vmPpWebbingPerluDiproses = null;
window.pastikanMountPpWebbingPerluDiproses = function() {
  if (vmPpWebbingPerluDiproses) return;
  const mountPoint = document.getElementById('vue-pp-webbing-perludiproses');
  if (mountPoint) vmPpWebbingPerluDiproses = createApp(buatAppJalurTahap('webbing', 'Acc Webbing', 'perlu_diproses', 'Perlu Diproses')).mount('#vue-pp-webbing-perludiproses');
};
let vmPpWebbingSedangDiproses = null;
window.pastikanMountPpWebbingSedangDiproses = function() {
  if (vmPpWebbingSedangDiproses) return;
  const mountPoint = document.getElementById('vue-pp-webbing-sedangdiproses');
  if (mountPoint) vmPpWebbingSedangDiproses = createApp(buatAppJalurTahap('webbing', 'Acc Webbing', 'sedang_diproses', 'Sedang Diproses')).mount('#vue-pp-webbing-sedangdiproses');
};
let vmPpWebbingPerluDikirim = null;
window.pastikanMountPpWebbingPerluDikirim = function() {
  if (vmPpWebbingPerluDikirim) return;
  const mountPoint = document.getElementById('vue-pp-webbing-perludikirim');
  if (mountPoint) vmPpWebbingPerluDikirim = createApp(buatAppJalurTahap('webbing', 'Acc Webbing', 'perlu_dikirim', 'Perlu Dikirim')).mount('#vue-pp-webbing-perludikirim');
};
let vmPpWebbingSedangDikirim = null;
window.pastikanMountPpWebbingSedangDikirim = function() {
  if (vmPpWebbingSedangDikirim) return;
  const mountPoint = document.getElementById('vue-pp-webbing-sedangdikirim');
  if (mountPoint) vmPpWebbingSedangDikirim = createApp(buatAppJalurTahap('webbing', 'Acc Webbing', 'sedang_dikirim', 'Sedang Dikirim')).mount('#vue-pp-webbing-sedangdikirim');
};
let vmPpWebbingSelesai = null;
window.pastikanMountPpWebbingSelesai = function() {
  if (vmPpWebbingSelesai) return;
  const mountPoint = document.getElementById('vue-pp-webbing-selesai');
  if (mountPoint) vmPpWebbingSelesai = createApp(buatAppJalurTahap('webbing', 'Acc Webbing', 'selesai', 'Selesai')).mount('#vue-pp-webbing-selesai');
};

let vmPpFinishingPerluDiproses = null;
window.pastikanMountPpFinishingPerluDiproses = function() {
  if (vmPpFinishingPerluDiproses) return;
  const mountPoint = document.getElementById('vue-pp-finishing-perludiproses');
  if (mountPoint) vmPpFinishingPerluDiproses = createApp(buatAppJalurTahap('finishing', 'Acc Finishing', 'perlu_diproses', 'Perlu Diproses')).mount('#vue-pp-finishing-perludiproses');
};
let vmPpFinishingSedangDiproses = null;
window.pastikanMountPpFinishingSedangDiproses = function() {
  if (vmPpFinishingSedangDiproses) return;
  const mountPoint = document.getElementById('vue-pp-finishing-sedangdiproses');
  if (mountPoint) vmPpFinishingSedangDiproses = createApp(buatAppJalurTahap('finishing', 'Acc Finishing', 'sedang_diproses', 'Sedang Diproses')).mount('#vue-pp-finishing-sedangdiproses');
};
let vmPpFinishingPerluDikirim = null;
window.pastikanMountPpFinishingPerluDikirim = function() {
  if (vmPpFinishingPerluDikirim) return;
  const mountPoint = document.getElementById('vue-pp-finishing-perludikirim');
  if (mountPoint) vmPpFinishingPerluDikirim = createApp(buatAppJalurTahap('finishing', 'Acc Finishing', 'perlu_dikirim', 'Perlu Dikirim')).mount('#vue-pp-finishing-perludikirim');
};
let vmPpFinishingSedangDikirim = null;
window.pastikanMountPpFinishingSedangDikirim = function() {
  if (vmPpFinishingSedangDikirim) return;
  const mountPoint = document.getElementById('vue-pp-finishing-sedangdikirim');
  if (mountPoint) vmPpFinishingSedangDikirim = createApp(buatAppJalurTahap('finishing', 'Acc Finishing', 'sedang_dikirim', 'Sedang Dikirim')).mount('#vue-pp-finishing-sedangdikirim');
};
let vmPpFinishingSelesai = null;
window.pastikanMountPpFinishingSelesai = function() {
  if (vmPpFinishingSelesai) return;
  const mountPoint = document.getElementById('vue-pp-finishing-selesai');
  if (mountPoint) vmPpFinishingSelesai = createApp(buatAppJalurTahap('finishing', 'Acc Finishing', 'selesai', 'Selesai')).mount('#vue-pp-finishing-selesai');
};
// Lihat STATUS-PROYEK.md §44.19 untuk detail Fase 3 (validasi, cross-check
// mount-div/petaMount, catatan uji manual yang masih diperlukan).

// ============================================================================
// Fase 4 (29 Agt 2026, malam) — jalur Vendor. SAMA seperti Fase 3: TIDAK
// ADA komponen baru, `JalurTahapManager` dipakai apa adanya dengan
// jalur='vendor'. Blocker §5.D RENCANA-PERSIAPAN-PRODUKSI-V2.md
// (apakah alur 5-tahap tetap sama walau barang fisik keluar lokasi ke
// vendor luar) SEKARANG TERJAWAB oleh Guru: *"vendor yg scan driver yg
// biasa belanja, karena dia jg kurir yg kirim dan sampai barang"* —
// driver INTERNAL (akun karyawan biasa, QR pribadi yang sama, BUKAN akun
// vendor eksternal terpisah) yang scan SEMUA aksi jalur ini (dia juga
// yang antar-jemput fisik ke vendor), jadi 5-tahap generic yang sudah ada
// (Scan Operator/Entry/Pack/Kirim/Sampai) SUDAH CUKUP tanpa tahap/label
// tambahan — persis pola Bahan/Acc, bukan alur baru.
//
// §5.C SEBAGIAN terjawab (siapa yang scan) — TAPI bagian lain §5.C
// (field baru di BOM Aksesoris Master Produk buat deteksi OTOMATIS jalur
// Vendor + jenis vendor Sublim/Sablon/Bordir) BELUM dijawab Guru, jadi
// SENGAJA BELUM dibangun (bukan lupa) — jalur Vendor tetap pakai jalur
// OPT-IN MANUAL yang sudah ada sejak Fase 1 (checkbox "+ Jalur Vendor
// (manual)" di form pembuatan grouping, `vendorManual`), BUKAN deteksi
// otomatis dari BOM. Ini sudah cukup buat jalur Vendor berfungsi
// end-to-end sekarang — deteksi otomatis BOM cuma kenyamanan tambahan
// buat nanti kalau Guru mau, bukan syarat wajib.
// ============================================================================
let vmPpVendorPerluDiproses = null;
window.pastikanMountPpVendorPerluDiproses = function() {
  if (vmPpVendorPerluDiproses) return;
  const mountPoint = document.getElementById('vue-pp-vendor-perludiproses');
  if (mountPoint) vmPpVendorPerluDiproses = createApp(buatAppJalurTahap('vendor', 'Vendor', 'perlu_diproses', 'Perlu Diproses')).mount('#vue-pp-vendor-perludiproses');
};
let vmPpVendorSedangDiproses = null;
window.pastikanMountPpVendorSedangDiproses = function() {
  if (vmPpVendorSedangDiproses) return;
  const mountPoint = document.getElementById('vue-pp-vendor-sedangdiproses');
  if (mountPoint) vmPpVendorSedangDiproses = createApp(buatAppJalurTahap('vendor', 'Vendor', 'sedang_diproses', 'Sedang Diproses')).mount('#vue-pp-vendor-sedangdiproses');
};
let vmPpVendorPerluDikirim = null;
window.pastikanMountPpVendorPerluDikirim = function() {
  if (vmPpVendorPerluDikirim) return;
  const mountPoint = document.getElementById('vue-pp-vendor-perludikirim');
  if (mountPoint) vmPpVendorPerluDikirim = createApp(buatAppJalurTahap('vendor', 'Vendor', 'perlu_dikirim', 'Perlu Dikirim')).mount('#vue-pp-vendor-perludikirim');
};
let vmPpVendorSedangDikirim = null;
window.pastikanMountPpVendorSedangDikirim = function() {
  if (vmPpVendorSedangDikirim) return;
  const mountPoint = document.getElementById('vue-pp-vendor-sedangdikirim');
  if (mountPoint) vmPpVendorSedangDikirim = createApp(buatAppJalurTahap('vendor', 'Vendor', 'sedang_dikirim', 'Sedang Dikirim')).mount('#vue-pp-vendor-sedangdikirim');
};
let vmPpVendorSelesai = null;
window.pastikanMountPpVendorSelesai = function() {
  if (vmPpVendorSelesai) return;
  const mountPoint = document.getElementById('vue-pp-vendor-selesai');
  if (mountPoint) vmPpVendorSelesai = createApp(buatAppJalurTahap('vendor', 'Vendor', 'selesai', 'Selesai')).mount('#vue-pp-vendor-selesai');
};
// Lihat STATUS-PROYEK.md §44.20 untuk detail Fase 4.
