// js/vue-stock-pembelian.js
// ============================================================================
// Zevanic House > Stock & Pembelian — fitur BARU (24 Agt 2026). 3 menu:
//   1. Alias Pembelian (AliasPembelianManager) — pemetaan nama barang di
//      nota suplayer (bisa beda-beda tiap suplayer) ke 1 item internal di
//      Data Bahan & Aksesoris.
//   2. List Order Belanja (OrderBelanjaScreen, mode-nota=false) — layar
//      "kasir": Group 1 "Daftar Permintaan Bahan & Aksesoris" (REFERENSI
//      SAJA, sumber dari Persiapan Masalah, TIDAK bisa diklik-tambah),
//      Group 2 "Daftar Order Belanja" — entry manual Suplayer(terkunci
//      sampai diganti)+Qty+Nama Barang, hasilnya masuk tabel "Daftar
//      Pesanan Pembelian".
//   3. Nota Order Belanja (OrderBelanjaScreen, mode-nota=true) — SAMA
//      seperti List Order Belanja, TAPI Group 1 dilabel ulang "Daftar
//      Pesanan Bahan & Aksesoris" dan tiap barisnya punya tombol (+) yang
//      LANGSUNG menambah ke "Daftar Pesanan Pembelian" (butuh Suplayer
//      sudah dipilih dulu) — begitu masuk, request Persiapan Masalah
//      terkait otomatis ditandai "sudah_dipesan".
//
// KEPUTUSAN DESAIN (AskUserQuestion, 24 Agt 2026 — lihat STATUS-PROYEK.md
// §21 untuk detail & alasan lengkap):
//   - Q2: kolom cross-check "stok sebelum" di tabel Daftar Pesanan
//     Pembelian DISKIP dulu (belum ada modul stok) — bisa ditambah nanti.
//   - Q3 (rekomendasi Claude, sudah dikonfirmasi arahnya oleh Hilman lewat
//     jawaban "Pending = simpan sebagai draft"): 1 koleksi `pesanan_pembelian`
//     dengan field `status`: 'draft' (tombol PENDING, boleh belum lengkap)
//     -> 'final' (tombol SIMPAN, order dianggap resmi/jadi). TIDAK ada
//     tombol DR.PENDING (dihapus sesuai permintaan). Belum ada tahap
//     approval terpisah (mis. owner approve) di versi ini — status hanya
//     draft/final — KARENA belum ada dampak ke stok (Qty belum menambah
//     stok apapun, poin Q2), jadi belum mendesak. Kalau nanti stok mulai
//     kepengaruh, `status` ini dirancang gampang ditambah 1 tahap lagi
//     (mis. 'menunggu_approval') tanpa bongkar struktur, sama seperti pola
//     `tahap` di koleksi `reimburse`.
//   - Q4: Master Suplayer dikelola pakai MasterDataTabelManager yang sudah
//     ada (vue-components.js), diperluas 1 kolom opsional (field3Key/Label,
//     lihat perubahan di file itu) untuk Kontak/Alamat.
//   - No. Pembelian (contoh "NP001") pola SAMA seperti ID Bahan/Aksesoris:
//     prefix diatur admin, counter naik otomatis via runTransaction,
//     koleksi baru `pengaturan_id_pembelian`.
//   - Dropdown "No. Pembelian" di atas form MERANGKAP jadi daftar draft
//     tersimpan ("didalamnya nanti ada daftar jg yg masih draft" — jawaban
//     Hilman) — pilih "Buat Baru" atau salah satu draft untuk lanjut edit.
//   - Item per Pesanan Pembelian disimpan sebagai ARRAY di dalam 1 dokumen
//     (bukan sub-koleksi terpisah) — jumlah baris per order wajar kecil,
//     lebih sederhana dibaca/ditulis sekaligus (konsisten prinsip hemat).
//
// UPDATE (25 Agt 2026, §25.2) — Qty per Roll/Lot. Arahan Hilman (persis):
// "1. untuk qty per lot bantu jalankan (fifo nanti saja) 2. pakai tombol
// pop up disimpan per baris dan kolomnya paling depan. tombol aktif jika
// dia memang menurut data wajib entry qty per lot". Diimplementasikan:
//   - Kolom BARU paling kiri di tabel "Daftar Pesanan Pembelian" (sebelum
//     kolom centang), isinya 1 tombol per baris (ikon layer-group).
//   - Tombol HANYA aktif kalau item baris itu ditandai `pakai_lot_tracking`
//     di Data Bahan & Aksesoris (field BARU, lihat vue-bahan-aksesoris.js)
//     — didenormalisasi ke tiap baris lewat buatBarisPesanan() di bawah.
//     Kalau tidak ditandai, sel tampil "-" (tidak bisa diklik).
//   - Klik tombol -> buka popup (PopupQtyPerLot, pola SAMA seperti
//     PopupKonversiBerjenjang di vue-bahan-aksesoris.js) — isi qty tiap
//     roll/lot satu-satu (SEBELUM Nota/List disimpan, sesuai arahan Guru
//     "ketika nota datang input langsung sebelum simpan"). Hasil disimpan
//     ke field BARU `detail_lot` (array {qty, keterangan}) di baris itu,
//     ikut tersimpan ke `pesanan_pembelian.items[].detail_lot` pas
//     Simpan/Pending — TIDAK ada dokumen lot terpisah dulu.
//   - FIFO / logic konsumsi per-lot (dipakai barang lama dulu baru baru)
//     SENGAJA BELUM dikerjakan ronde ini (arahan Guru: "fifo nanti saja").
//     Konsekuensi yang PERLU DIKETAHUI: begitu "Catat Pemakaian" manual di
//     Kartu Stok (js/vue-kartu-stok.js) dipakai, stok_akhir agregat
//     berkurang TAPI qty per-lot di sini TIDAK ikut berkurang — jadi
//     invarian "total lot = stok_akhir" cuma pasti benar TEPAT SETELAH
//     barang diterima, lalu bisa "meleset" begitu ada pemakaian, sampai
//     FIFO benar-benar dikerjakan. Ini keterbatasan SEMENTARA yang
//     disengaja, dicatat juga di STATUS-PROYEK.md §25.2.
//
// UPDATE (25 Agt 2026, §25.3) — FIFO dijalankan (arahan Guru: "stok saat
// dipakai bantu sync dlu langsung pangkas aja bisa? walau data rak belum
// ada?" — dikonfirmasi lewat AskUserQuestion: pakai form "Catat Pemakaian"
// yang SUDAH ADA di Kartu Stok, TIDAK menunggu modul SPK/produksi yang
// belum ada). Ditambahkan:
//   - Koleksi BARU `lot_bahan_aksesoris` — 1 dokumen = 1 roll/lot individual
//     (`qty_awal`, `qty_sisa`, `tanggal_masuk`, dst). Dibuat OTOMATIS begitu
//     Nota Order Belanja di-final-kan untuk item `pakai_lot_tracking` yang
//     `detail_lot`-nya sudah diisi (lihat `catatPergerakanKartuStok()` di
//     bawah, param baru `lotBaru`) — DALAM transaksi yang SAMA dengan
//     update `stok_akhir` & ledger `kartu_stok_bahan_aksesoris`, supaya
//     ketiganya SELALU konsisten sekaligus.
//   - Fungsi BARU `catatPemakaianDenganFifo()` (export, dipakai
//     `js/vue-kartu-stok.js` di form "Catat Pemakaian") — untuk item
//     `pakai_lot_tracking`, potong dari roll/lot TERLAMA dulu (urut
//     `tanggal_masuk` ASC), dalam 1 `runTransaction()` (baca semua lot dulu
//     lewat `tx.get()`, baru tulis — aturan wajib Firestore transaction).
//     Kalau BELUM ADA data lot sama sekali -> lempar error `LOT_KOSONG`
//     (BLOKIR, sesuai keputusan Guru — jangan proses pemakaian tanpa data
//     lot). Kalau total lot AKTIF < qty diminta -> lempar error `LOT_KURANG`
//     (bawa info `totalTersedia`) — TIDAK diblokir diam-diam, `vue-kartu-
//     stok.js` menangkap ini dan menampilkan popup 3 opsi keputusan (kurangi
//     jumlah / proses sebagian + sisanya masuk Persiapan Masalah / tunggu
//     dulu, sisanya tetap masuk Persiapan Masalah) — SEMUA lewat koleksi
//     `persiapan_masalah` yang SUDAH ADA apa adanya (TIDAK ada field/skema
//     baru di sana, cukup 1 entri normal seperti alur "butuh beli barang"
//     yang sudah berjalan).
//
// UPDATE (25 Agt 2026, Tahap 2 — GANTI pendekatan §25.3) — arahan Guru
// (persis): "per lot punya id bahan/aksesoris masing2 jadi nanti saat
// ngambil karyawan cari kode yg sama (atau saat pengambilan scan qr id
// bahan yg mau dipakai lalu ambil yg mau dipakainya)". FIFO OTOMATIS
// (`catatPemakaianDenganFifo`, §25.3) DIGANTI jadi FIFO SEBAGAI SARAN
// DEFAULT saja — karyawan yang pilih SENDIRI roll/lot mana yang benar-benar
// diambil (cari kode ATAU scan QR label roll), lewat form "Catat Pemakaian"
// di `js/vue-kartu-stok.js`. Dikonfirmasi lewat AskUserQuestion (3
// pertanyaan): (1) "Langsung ke Tahap 2, cetak label + scan QR" — TIDAK
// mulai dari versi manual tanpa kamera; (2) kalau roll yang dipilih BUKAN
// yang tertua -> "Beri peringatan dulu" (konfirmasi, bukan blokir) — lihat
// `vue-kartu-stok.js`; (3) untuk item BUKAN lot, scan/cari kode "Cuma buka
// form Catat Pemakaian lebih cepat" — TIDAK ada perubahan logic stok untuk
// item biasa.
// Ditambahkan:
//   - Field BARU `kode_lot` di `lot_bahan_aksesoris` (mis. "BHN-0001-L003")
//     — dibuat OTOMATIS di `catatPergerakanKartuStok()` (di bawah) lewat
//     counter BARU `lot_counter` di `master_bahan_aksesoris`, di-increment
//     ATOMIK dalam transaksi yang SAMA (baca+tulis 1x, tidak ada race
//     antar-lot). `catatPergerakanKartuStok()` SEKARANG me-RETURN
//     `{ lotDibuat: [...] }` (id, kode_lot, qty, tanggal_masuk, keterangan)
//     supaya pemanggilnya (OrderBelanjaScreen.simpan(), di bawah) bisa
//     menawarkan cetak label fisik (QR) begitu Nota Order Belanja
//     di-final-kan.
//   - Fungsi BARU (export) `ambilLotAktif(bahanId)`, `cariLotByKode(kodeLot)`,
//     `cariBahanByIdTampil(idTampil)`, `ambilBahanById(bahanId)` — dipakai
//     `vue-kartu-stok.js` untuk mengisi tabel pilihan roll & untuk fitur
//     "Scan Barang"/"Scan Roll". PENTING: `bahanId` (ID dokumen Firestore,
//     auto-generated) dan `id_tampil` (ID manusia-terbaca mis. "BHN-0001",
//     field TERPISAH di master_bahan_aksesoris — lihat PETA-DATABASE.md)
//     itu 2 hal BEDA — makanya ada 2 fungsi cari yang beda juga
//     (`cariBahanByIdTampil` query field `id_tampil`, `ambilBahanById`
//     getDoc langsung lewat ID dokumen).
//   - `catatPemakaianDenganFifo()` DIHAPUS, GANTI `catatPemakaianDariAlokasi()`
//     — alokasi (`{lotId, qty}[]`) sudah ditentukan pemanggil (FIFO cuma
//     saran default, editable), fungsi ini HANYA validasi total cocok +
//     eksekusi transaksional (baca ulang semua lot FRESH lewat tx.get()
//     sebelum tulis, sama seperti pola §25.3, supaya tetap aman dari race
//     kalau ada 2 orang catat pemakaian bersamaan).
//   - Cek LOT_KOSONG/LOT_KURANG (belum ada data lot / lot aktif < qty
//     diminta) SEKARANG dilakukan `vue-kartu-stok.js` SENDIRI (baca
//     `ambilLotAktif()` dulu SEBELUM buka tabel alokasi) — bukan dilempar
//     dari `catatPemakaianDariAlokasi()` lagi. 3 opsi keputusan PIC saat
//     kurang (kurangi/proses sebagian/tunggu) TETAP SAMA seperti §25.3.
//   - Cetak label roll (QR): tombol BARU "Cetak Label Roll" di
//     OrderBelanjaScreen (mode Nota), muncul begitu Nota di-final-kan DAN
//     ada `lotDibuat`. FIX §25.8 (QR sempat tidak muncul di label
//     tercetak): library pembuat QR (`qrcodejs`, davidshimjs) SEKARANG
//     dimuat SEKALI di index.html (sama seperti `jsQR`) — BUKAN lagi
//     lewat document.write() di window cetak. Tiap QR digambar & diambil
//     jadi gambar base64 DI WINDOW UTAMA (lihat `buatQrDataUrl()`, dekat
//     `cetakLabelLot()` di bawah), window cetak cuma terima <img> statis
//     — tidak butuh internet lagi saat mencetak.
//   - Scan QR (baca) pakai `jsQR` (CDN), pola SAMA PERSIS seperti yang
//     sudah ada di `js/vue-scan-qr.js` — disalin ulang ke `vue-kartu-stok.js`
//     (konsisten dengan pola "salin logic kecil per-file" yang sudah
//     dipakai di proyek ini, BUKAN import lintas file).
// ============================================================================
import { createApp, ref, reactive, computed, onMounted, watch, nextTick } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDoc, getDocs, setDoc, serverTimestamp, runTransaction, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
// MasterDataTabelManager TIDAK diimpor lagi di sini (27 Agt 2026, §26.1) —
// dulu dipakai MasterSuplayerManager (gear Stock & Pembelian), sekarang
// CRUD Suplayer pindah ke menu Config (vue-config.js). Lihat catatan di
// PengaturanStockPembelian di bawah.
import { DropdownCari } from './vue-components.js?v=2';
import { usePaginasiFirestore } from './vue-paginasi.js';

// --- helper: ambil semua Bahan+Aksesoris (disalin dari vue-bahan-aksesoris.js
// / vue-persiapan-masalah.js secara sengaja — lihat catatan di file itu). ---
async function ambilDaftarBahanAksesorisLengkap() {
  try {
    const snap = await getDocs(collection(db, 'master_bahan_aksesoris'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    return list;
  } catch (e) {
    console.error('Gagal ambil daftar Bahan/Aksesoris:', e);
    return [];
  }
}
async function ambilDaftarSuplayer() {
  try {
    const snap = await getDocs(collection(db, 'master_suplayer'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    return list;
  } catch (e) {
    console.error('Gagal ambil daftar Suplayer:', e);
    return [];
  }
}
function formatRupiah(n) {
  const angka = parseFloat(n) || 0;
  return 'Rp ' + Math.round(angka).toLocaleString('id-ID');
}
// formatNamaBahan — BARU (25 Agt 2026) — gabungkan `nama` + `warna` (mis.
// "DUSKY CRINKLE BLUSH PINK") buat ditampilkan di dropdown pencarian item
// (Alias Pembelian, List/Nota Order Belanja — lihat opsiNamaInternal &
// opsiNamaBarang di bawah). Sebelum ini dropdown cuma tampil `nama` polos
// — kalau ada beberapa item dengan `nama` SAMA tapi `warna` beda (kasus
// normal, warna itu field terpisah di Data Bahan & Aksesoris), item-itemnya
// TIDAK BISA dibedakan di dropdown, DAN pemilihan salah satu bisa
// nyantol ke varian warna yang SALAH (dulu di-cocokkan cuma dari `nama`
// lewat `.find()`, selalu ambil hasil PERTAMA yang cocok — silent bug,
// diperbaiki sekalian di sini karena satu akar masalah yang sama).
function formatNamaBahan(b) {
  return (b.nama || '') + (b.warna ? ` ${b.warna}` : '');
}
// buatQrDataUrl — DIPINDAH ke level modul (27 Agt 2026, §26.3, Tahap 3)
// dari dalam OrderBelanjaScreen.setup() supaya bisa dipakai BARENG oleh
// cetakLabelLot() (di OrderBelanjaScreen, sudah ada) DAN CetakLabelManager
// (menu baru "Cetak Label", di bawah) — TIDAK ada perubahan logic, cuma
// posisi (dari closure jadi fungsi modul biasa), karena keduanya di FILE
// YANG SAMA (bukan pelanggaran konvensi "disalin bukan diimpor silang",
// itu cuma berlaku ANTAR file .js berbeda). Lihat komentar panjang
// aslinya (soal kenapa qrcodejs digambar sinkron di window utama, bukan
// document.write() di window print) di dekat cetakLabelLot() di bawah.
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
// opsiSatuanBeliUntuk / faktorKonversiUntukSatuan — BARU (27 Agt 2026,
// §25.13, permintaan Guru: "kadang beli dus, kadang beli pak, kadang
// beli pcs > satuan yg muncul sesuai yg diinput di konversi banyak
// tingkat"). Bahan/Aksesoris yang diisi lewat popup "Bantu Hitung
// Konversi Berjenjang" (vue-bahan-aksesoris.js) NYIMPAN SELURUH rantai
// tingkatnya di `konversi_bertingkat` (array `{dari, jumlah, ke, harga}`
// per tingkat, mis. tingkat 1 = {dari:"DUS", jumlah:10, ke:"PACK"},
// tingkat 2 = {dari:"PACK", jumlah:12, ke:"PCS"}) — BUKAN cuma 1 angka
// `isi_konversi_pembelian` gabungan seperti yang dipakai selama ini di
// Order Belanja. Dua fungsi ini baca rantai itu buat kasih PILIHAN
// satuan beli (tiap `dari` di rantai, PLUS satuan akhir/`satuan_pemakaian`
// kalau mau beli langsung di satuan dasarnya) & hitung faktor konversi
// yang BENAR buat satuan manapun yang dipilih (bukan selalu pakai faktor
// tingkat PALING ATAS/`isi_konversi_pembelian`, yang cuma benar kalau
// beli di satuan_pembelian aslinya).
function opsiSatuanBeliUntuk(item) {
  const tingkat = Array.isArray(item.konversi_bertingkat) ? item.konversi_bertingkat : [];
  if (tingkat.length === 0) {
    // Item lama / 1-tingkat (belum pernah diisi lewat popup berjenjang)
    // — cuma ada 1 satuan beli yang diketahui, sama seperti perilaku
    // sebelum §25.13.
    return item.satuan_pembelian ? [item.satuan_pembelian] : [];
  }
  const opsi = [];
  tingkat.forEach(t => { if (t.dari && !opsi.includes(t.dari)) opsi.push(t.dari); });
  const akhir = tingkat[tingkat.length - 1].ke;
  if (akhir && !opsi.includes(akhir)) opsi.push(akhir); // beli langsung di satuan dasar (faktor 1)
  return opsi;
}
function faktorKonversiUntukSatuan(item, satuanDipilih) {
  const tingkat = Array.isArray(item.konversi_bertingkat) ? item.konversi_bertingkat : [];
  if (tingkat.length === 0) return parseFloat(item.isi_konversi_pembelian) || 1;
  const idx = tingkat.findIndex(t => t.dari === satuanDipilih);
  if (idx === -1) {
    // Bukan salah satu titik "dari" di rantai — cek apakah itu satuan
    // AKHIR/dasar (beli langsung di satuan_pemakaian, faktor = 1).
    if (satuanDipilih && satuanDipilih === tingkat[tingkat.length - 1].ke) return 1;
    // Fallback aman: satuan tidak dikenali sama sekali (seharusnya tidak
    // terjadi lewat UI, cuma jaring pengaman) — pakai faktor gabungan
    // penuh (perilaku lama).
    return parseFloat(item.isi_konversi_pembelian) || 1;
  }
  // Faktor = perkalian `jumlah` MULAI dari tingkat satuan yang dipilih
  // SAMPAI akhir rantai (BUKAN dari tingkat paling atas) — ini yang
  // beda dari `isi_konversi_pembelian` polos, yang selalu itung dari
  // tingkat PALING ATAS.
  return tingkat.slice(idx).reduce((total, t) => total * (parseFloat(t.jumlah) || 1), 1);
}
// hargaUntukSatuan — BARU (27 Agt 2026, §25.14, permintaan Guru: "harga
// menurut satuan awal adalah harga saat pembelian... misal ada 3 jenjang
// artinya ada 3 harga dengan 3 satuan awal"). Prefill "Harga Aktual" di
// baris pesanan SEKARANG ambil harga TINGKAT yang SUNGGUHAN dipilih di
// field Satuan (dari `konversi_bertingkat`, mis. harga PACK bukan harga
// DUS kalau yang dipilih PACK) — bukan selalu `harga_pembelian` (harga
// tingkat teratas) seperti sebelumnya. Field ini TETAP bisa diedit admin
// di tabel Nota (tidak berubah) — ini cuma nilai DEFAULT/perkiraan awal.
function hargaUntukSatuan(item, satuanDipilih) {
  const tingkat = Array.isArray(item.konversi_bertingkat) ? item.konversi_bertingkat : [];
  if (tingkat.length === 0) return parseFloat(item.harga_pembelian) || 0;
  const cocok = tingkat.find(t => t.dari === satuanDipilih);
  if (cocok && parseFloat(cocok.harga) > 0) return parseFloat(cocok.harga);
  // Satuan dipilih = satuan akhir/dasar (satuan_pemakaian, tidak punya
  // baris "dari" sendiri) — pakai Harga Modal (`harga_modal`, sudah
  // dihitung otomatis di Data Bahan & Aksesoris = harga TERMAHAL di
  // antara implikasi per-satuan-akhir semua tingkat, lihat §25.14 di
  // vue-bahan-aksesoris.js/hitungHargaPerSatuanAkhir()).
  if (satuanDipilih && satuanDipilih === tingkat[tingkat.length - 1].ke) {
    return Math.round(parseFloat(item.harga_modal) || 0);
  }
  return parseFloat(item.harga_pembelian) || 0; // fallback aman (seharusnya tidak kejadian lewat UI)
}
// hitungHargaPerSatuanAkhir — SAMA PERSIS dengan fungsi nama sama di
// vue-bahan-aksesoris.js (disalin, BUKAN diimpor silang — konvensi yang
// sudah dipakai di file ini utk ambilDaftarBahanAksesorisLengkap() juga,
// lihat catatan di atas: supaya 2 file ini tetap bisa berdiri
// sendiri-sendiri kalau salah satu diedit). Dipakai `perbaruiHargaMasterDariRiwayat()`
// di bawah (§25.14) — kalau diubah, WAJIB diubah bareng versi di
// vue-bahan-aksesoris.js juga supaya rumusnya tetap sama antara popup
// Konversi Berjenjang & auto-update dari Nota final.
function hitungHargaPerSatuanAkhir(baris) {
  let maxHarga = 0;
  baris.forEach((b, i) => {
    const h = parseFloat(b.harga);
    if (!(h > 0)) return;
    const faktor = baris.slice(i).reduce((t, x) => t * (parseFloat(x.jumlah) || 0), 1);
    if (!(faktor > 0)) return;
    const impliedHargaAkhir = h / faktor;
    if (impliedHargaAkhir > maxHarga) maxHarga = impliedHargaAkhir;
  });
  return maxHarga;
}
// generateNoPembelian — pola SAMA seperti generateIdBerurutan di
// vue-bahan-aksesoris.js, cuma 1 kunci saja (tidak per-kategori).
async function generateNoPembelian() {
  const refDoc = doc(db, 'pengaturan_id_pembelian', 'pembelian');
  return await runTransaction(db, async (trx) => {
    const snap = await trx.get(refDoc);
    const data = snap.exists() ? snap.data() : null;
    if (!data || !data.prefix) {
      throw new Error('Prefix No. Pembelian belum diatur. Buka tombol "Pengaturan" (ikon gear) dulu untuk mengatur prefix-nya, baru simpan lagi.');
    }
    const counterBaru = (data.counter || 0) + 1;
    if (snap.exists()) trx.update(refDoc, { counter: counterBaru });
    else trx.set(refDoc, { prefix: data.prefix, counter: counterBaru });
    return `${data.prefix}${String(counterBaru).padStart(3, '0')}`;
  });
}

// ---------------------------------------------------------------------------
// PopupTambahSuplayerCepat — BARU (27 Agt 2026, §26.1). Shortcut "+" nempel
// di sebelah dropdown-cari Suplayer (Alias Pembelian, List/Nota Order
// Belanja) — permintaan Guru: "ringkas dan mudah dimengerti operator",
// popup MINI 2 field PERSIS sama seperti yang dulu ada di MasterDataTabelManager
// (Nama Suplayer + Kontak/Alamat opsional), simpan LANGSUNG ke koleksi
// master_suplayer TANPA pindah halaman ke Config. Begitu simpan sukses,
// emit 'tersimpan' bawa nama Suplayer baru — komponen pemanggil yang
// tanggung jawab auto-pilih di dropdown & refresh daftarnya sendiri
// (lihat onSuplayerBaruTersimpan() di AliasPembelianManager/
// OrderBelanjaScreen).
// ---------------------------------------------------------------------------
const PopupTambahSuplayerCepat = {
  emits: ['tersimpan', 'tutup'],
  setup(props, { emit }) {
    const nama = ref('');
    const kontak = ref('');
    const menyimpan = ref(false);
    async function simpan() {
      const namaTrim = nama.value.trim();
      if (!namaTrim) return alert('Isi Nama Suplayer dulu.');
      menyimpan.value = true;
      try {
        await addDoc(collection(db, 'master_suplayer'), {
          nama: namaTrim,
          kontak: kontak.value.trim(),
          keterangan: '',
          dibuat_pada: serverTimestamp()
        });
        emit('tersimpan', namaTrim);
      } catch (e) {
        console.error('Gagal tambah Suplayer cepat:', e);
        alert('Gagal menambah Suplayer. Coba lagi.');
      }
      menyimpan.value = false;
    }
    return { nama, kontak, menyimpan, simpan };
  },
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="$emit('tutup')">
      <div class="gc-card" style="max-width:380px; width:100%;">
        <h3 style="font-weight:700; font-size:14px; margin-bottom:12px;"><i class="fas fa-truck-fast" style="color:var(--burgundy); margin-right:8px;"></i>Tambah Suplayer Baru</h3>
        <div class="gc-field">
          <label>Nama Suplayer <span style="color:var(--danger);">*</span></label>
          <input v-model="nama" @keyup.enter="simpan" type="text" placeholder="Nama Suplayer" autofocus>
        </div>
        <div class="gc-field">
          <label>Kontak/Alamat (opsional)</label>
          <input v-model="kontak" @keyup.enter="simpan" type="text" placeholder="Kontak/Alamat">
        </div>
        <div style="display:flex; gap:8px; margin-top:6px;">
          <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="flex:1;">{{ menyimpan ? 'Menyimpan...' : 'Simpan' }}</button>
          <button @click="$emit('tutup')" class="btn-outline" style="flex:1;">Batal</button>
        </div>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// PengaturanStockPembelian — panel gear: atur prefix No. Pembelian.
//
// RIWAYAT (27 Agt 2026, §26.1) — sebelumnya panel ini JUGA kelola Master
// Suplayer (dulu lewat MasterSuplayerManager, pembungkus tipis
// MasterDataTabelManager). Keputusan Guru: CRUD lengkap Suplayer DIPINDAH
// ke menu baru "Config" (Zevanic House > Config > Data Suplayer, lihat
// js/vue-config.js) — TIDAK diimpor silang dari sini (konsisten pola
// "disalin, bukan diimpor silang"), Config panggil MasterDataTabelManager
// langsung. Panel gear ini sekarang cuma Prefix No. Pembelian. Sebagai
// gantinya, form yang butuh tambah Suplayer cepat (Alias Pembelian, List/
// Nota Order Belanja) SEKARANG punya tombol "+" shortcut sendiri di
// sebelah dropdown Suplayer — lihat PopupTambahSuplayerCepat di bawah.
// ---------------------------------------------------------------------------
const PengaturanStockPembelian = {
  emits: ['tutup'],
  setup(props, { emit }) {
    const prefix = ref('');
    const counter = ref(0);
    const memuat = ref(true);
    const menyimpan = ref(false);

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDoc(doc(db, 'pengaturan_id_pembelian', 'pembelian'));
        if (snap.exists()) { prefix.value = snap.data().prefix || ''; counter.value = snap.data().counter || 0; }
      } catch (e) {
        console.error('Gagal muat pengaturan No. Pembelian:', e);
      }
      memuat.value = false;
    }
    async function simpan() {
      if (!prefix.value.trim()) return alert('Isi prefix No. Pembelian dulu (contoh: NP).');
      menyimpan.value = true;
      try {
        await setDoc(doc(db, 'pengaturan_id_pembelian', 'pembelian'), { prefix: prefix.value.trim().toUpperCase() }, { merge: true });
        alert('Pengaturan tersimpan.');
      } catch (e) {
        console.error('Gagal simpan pengaturan No. Pembelian:', e);
        alert('Gagal menyimpan.');
      }
      menyimpan.value = false;
    }
    onMounted(muat);
    return { prefix, counter, memuat, menyimpan, simpan };
  },
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="$emit('tutup')">
      <div class="gc-card" style="max-width:480px; width:100%; max-height:90vh; overflow-y:auto;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:14px;"><i class="fas fa-gear" style="color:var(--burgundy); margin-right:8px;"></i>Pengaturan Stock &amp; Pembelian</h3>
        <div v-if="memuat" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;">Memuat...</div>
        <template v-else>
          <p style="font-size:11.5px; font-weight:700; color:var(--text-muted); margin-bottom:8px;">Prefix No. Pembelian (contoh: NP) — nomor urut naik otomatis.</p>
          <div class="gc-field">
            <label>Prefix</label>
            <input v-model="prefix" type="text" placeholder="Contoh: NP" style="text-transform:uppercase;">
            <p style="font-size:10px; color:var(--text-faint); margin-top:4px;">Sudah terpakai: {{ counter }}. Nomor berikutnya: {{ (prefix||'...').toUpperCase() }}{{ String(counter+1).padStart(3,'0') }}</p>
          </div>
          <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="width:100%;">{{ menyimpan ? 'Menyimpan...' : 'Simpan Prefix' }}</button>
          <p style="font-size:10.5px; color:var(--text-faint); margin-top:10px;"><i class="fas fa-circle-info" style="margin-right:4px;"></i>Kelola Data Suplayer sekarang lewat menu <b>Zevanic House &gt; Config</b>.</p>
        </template>
        <button @click="$emit('tutup')" class="btn-outline" style="width:100%; margin-top:18px;">Tutup</button>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// AliasPembelianManager — menu "Alias Pembelian"
// ---------------------------------------------------------------------------
const AliasPembelianManager = {
  components: { DropdownCari, PengaturanStockPembelian, PopupTambahSuplayerCepat },
  setup() {
    const daftarBahan = ref([]);
    const daftarSuplayer = ref([]);
    const daftarAlias = ref([]);
    const memuat = ref(true);
    const menyimpan = ref(false);
    const tampilPengaturan = ref(false);
    // BARU (27 Agt 2026, §26.1) — shortcut "+" tambah Suplayer cepat tanpa
    // pindah ke Config, lihat PopupTambahSuplayerCepat.
    const tampilTambahSuplayer = ref(false);
    async function onSuplayerBaruTersimpan(namaBaru) {
      tampilTambahSuplayer.value = false;
      daftarSuplayer.value = await ambilDaftarSuplayer();
      form.suplayerNama = namaBaru;
    }

    const form = reactive({ suplayerNama: '', namaInternal: '', namaDiNota: '' });
    // BARU (25 Agt 2026) — tampilkan nama+warna (formatNamaBahan(), lihat
    // atas) supaya item dengan `nama` sama tapi `warna` beda bisa
    // dibedakan di dropdown, DAN tidak salah nyantol (lihat catatan di
    // tambah() di bawah).
    const opsiNamaInternal = computed(() => daftarBahan.value.map(formatNamaBahan));
    const opsiSuplayer = computed(() => daftarSuplayer.value.map(s => s.nama));

    const bolehTambah = computed(() => window.cekIzinMenu('stock_alias_pembelian', 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu('stock_alias_pembelian', 'delete') !== false);

    async function muatSemua() {
      memuat.value = true;
      try {
        const [bahan, suplayer, snapAlias] = await Promise.all([
          ambilDaftarBahanAksesorisLengkap(),
          ambilDaftarSuplayer(),
          getDocs(collection(db, 'alias_pembelian'))
        ]);
        daftarBahan.value = bahan;
        daftarSuplayer.value = suplayer;
        const list = []; snapAlias.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.suplayer_nama || '').localeCompare(b.suplayer_nama || ''));
        daftarAlias.value = list;
      } catch (e) {
        console.error('Gagal muat Alias Pembelian:', e);
      }
      memuat.value = false;
    }

    async function tambah() {
      if (!bolehTambah.value) return alert('Anda tidak punya izin menambah di sini. Hubungi Owner/PIC.');
      const suplayer = daftarSuplayer.value.find(s => s.nama === form.suplayerNama);
      // GANTI (25 Agt 2026) — cocokkan lewat formatNamaBahan() (nama+warna),
      // BUKAN `nama` polos lagi — dulu kalau ada 2+ item `nama` sama beda
      // `warna`, ini selalu ambil yang PERTAMA cocok (bisa salah varian
      // warna, silent bug).
      const bahan = daftarBahan.value.find(b => formatNamaBahan(b) === form.namaInternal);
      if (!suplayer) return alert('Pilih Suplayer dulu. Kalau belum ada, tambahkan lewat tombol Pengaturan.');
      if (!bahan) return alert('Pilih Nama Bahan/Aksesoris (internal) dulu.');
      const namaDiNota = form.namaDiNota.trim();
      if (!namaDiNota) return alert('Isi nama barang persis seperti di nota Suplayer.');
      if (daftarAlias.value.some(a => a.suplayer_id === suplayer.id && (a.nama_di_nota || '').toLowerCase() === namaDiNota.toLowerCase())) {
        return alert('Alias ini sudah ada untuk Suplayer tersebut.');
      }
      menyimpan.value = true;
      try {
        await addDoc(collection(db, 'alias_pembelian'), {
          suplayer_id: suplayer.id, suplayer_nama: suplayer.nama,
          // FIX (25 Agt 2026, revisi tabel) — SEBELUMNYA `bahan_aksesoris_nama`
          // disimpan dari `bahan.nama` POLOS (tanpa warna), jadi walau dropdown
          // di atas sudah bisa bedakan nama+warna, tabel Alias tetap tidak
          // bisa. Sekarang disimpan `formatNamaBahan(bahan)` (nama+warna) —
          // dipakai sebagai FALLBACK ARSIP kalau item internalnya suatu saat
          // dihapus (lihat namaInternalTampil() di bawah, yang tampilan
          // utamanya tetap baca LIVE dari daftarBahan supaya kalau nama/warna
          // item diedit belakangan, alias lama ikut ke-update tampilannya).
          bahan_aksesoris_id: bahan.id, bahan_aksesoris_nama: formatNamaBahan(bahan),
          nama_di_nota: namaDiNota,
          dibuat_pada: serverTimestamp()
        });
        form.namaInternal = ''; form.namaDiNota = '';
        await muatSemua();
      } catch (e) {
        console.error('Gagal simpan Alias Pembelian:', e);
        alert('Gagal menyimpan.');
      }
      menyimpan.value = false;
    }

    // namaInternalTampil — BARU (25 Agt 2026, revisi tabel Alias Pembelian,
    // permintaan Guru: kolom "Nama Internal" tabel JUGA tampilkan Nama+Warna,
    // bukan cuma dropdown entry-nya). Cari LIVE ke daftarBahan (bukan baca
    // field `bahan_aksesoris_nama` yang tersimpan statis) — supaya kalau
    // nama/warna item internal diedit belakangan di Data Bahan & Aksesoris,
    // alias lama ikut tampil update, bukan data beku saat alias dibuat.
    // Fallback ke `bahan_aksesoris_nama` yang tersimpan HANYA kalau item
    // internalnya sudah tidak ada lagi (terhapus).
    function namaInternalTampil(a) {
      const b = daftarBahan.value.find(x => x.id === a.bahan_aksesoris_id);
      return b ? formatNamaBahan(b) : (a.bahan_aksesoris_nama || '-');
    }

    async function hapus(item) {
      if (!bolehHapus.value) return alert('Anda tidak punya izin menghapus di sini. Hubungi Owner/PIC.');
      if (!confirm(`Hapus alias "${item.nama_di_nota}" -> "${item.bahan_aksesoris_nama}"?`)) return;
      try {
        await deleteDoc(doc(db, 'alias_pembelian', item.id));
        await muatSemua();
      } catch (e) {
        console.error('Gagal hapus Alias Pembelian:', e);
        alert('Gagal menghapus.');
      }
    }

    onMounted(async () => { await window.authReady; muatSemua(); });
    return { daftarAlias, memuat, menyimpan, form, opsiNamaInternal, opsiSuplayer, bolehTambah, bolehHapus, tampilPengaturan, tambah, hapus, namaInternalTampil, tampilTambahSuplayer, onSuplayerBaruTersimpan };
  },
  template: `
    <div class="gc-card" style="padding:16px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
        <h3 style="font-weight:700; font-size:15px;"><i class="fas fa-tags" style="color:var(--burgundy); margin-right:8px;"></i>Alias Pembelian</h3>
        <button @click="tampilPengaturan = true" class="icon-btn" title="Pengaturan"><i class="fas fa-gear"></i></button>
      </div>
      <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Petakan nama barang di nota Suplayer (bisa beda-beda tiap Suplayer) ke 1 item internal di Data Bahan &amp; Aksesoris — supaya pencarian di Order Belanja lebih gampang.</p>
      <!-- REVISI (25 Agt 2026, permintaan Guru) — urutan field entry SEKARANG
           Suplayer, Nama di Nota Suplayer, Nama Internal (Nama + Warna),
           tombol Tambah jadi kolom grid terpisah di akhir (pola sama seperti
           entry Daftar Pesanan di OrderBelanjaScreen di bawah). SEBELUMNYA
           urutannya Suplayer, Nama Internal, Nama di Nota (+ tombol nempel
           di kolom itu). -->
      <div v-if="bolehTambah" style="display:grid; grid-template-columns:1fr 1fr 1fr auto; gap:8px; align-items:end; margin-bottom:14px;">
        <div class="gc-field" style="margin-bottom:0;">
          <label>Suplayer</label>
          <div style="display:flex; gap:6px;">
            <dropdown-cari v-model="form.suplayerNama" :opsi="opsiSuplayer" placeholder="Pilih Suplayer..." />
            <button @click="tampilTambahSuplayer = true" type="button" class="icon-btn" style="flex-shrink:0;" title="Tambah Suplayer baru"><i class="fas fa-plus"></i></button>
          </div>
        </div>
        <div class="gc-field" style="margin-bottom:0;"><label>Nama di Nota Suplayer</label><input v-model="form.namaDiNota" type="text" placeholder="Persis seperti di nota" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;"></div>
        <div class="gc-field" style="margin-bottom:0;"><label>Nama Internal (Nama + Warna)</label><dropdown-cari v-model="form.namaInternal" :opsi="opsiNamaInternal" placeholder="Pilih item internal..." /></div>
        <button @click="tambah" :disabled="menyimpan" class="btn-primary" style="padding:0 18px; height:38px;"><i class="fas fa-plus"></i></button>
      </div>
      <div v-if="memuat" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="daftarAlias.length === 0" style="font-size:11.5px; color:var(--text-faint);">Belum ada alias.</div>
      <div v-else style="overflow-x:auto;">
        <table class="gc-table" style="width:100%; font-size:12px;">
          <!-- REVISI (25 Agt 2026) — kolom SEKARANG Suplayer, Nama di Nota,
               Nama Internal (Nama + Warna) — SEBELUMNYA kolom ke-3 cuma
               "Item Internal" & isinya nama polos tanpa warna (lihat fix
               namaInternalTampil() & tambah() di atas). -->
          <thead><tr><th>Suplayer</th><th>Nama di Nota</th><th>Nama Internal (Nama + Warna)</th><th></th></tr></thead>
          <tbody>
            <tr v-for="a in daftarAlias" :key="a.id">
              <td>{{ a.suplayer_nama }}</td><td><b>{{ a.nama_di_nota }}</b></td><td>{{ namaInternalTampil(a) }}</td>
              <td><button v-if="bolehHapus" @click="hapus(a)" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <pengaturan-stock-pembelian v-if="tampilPengaturan" @tutup="tampilPengaturan = false" />
      <popup-tambah-suplayer-cepat v-if="tampilTambahSuplayer" @tersimpan="onSuplayerBaruTersimpan" @tutup="tampilTambahSuplayer = false" />
    </div>
  `
};

// ---------------------------------------------------------------------------
// OrderBelanjaScreen — dipakai BARENG oleh "List Order Belanja" (mode-nota
// false) dan "Nota Order Belanja" (mode-nota true).
//
// DIPERTEGAS (malam 24 Agt 2026, revisi Guru) — 2 mode ini punya MAKNA
// BISNIS beda, bukan cuma beda label:
// - "List Order Belanja" (modeNota=false) — ESTIMASI belanja yang dibuat
//   SUPIR, lalu di-approve OWNER, SEBELUM belanja sungguhan terjadi. Harga
//   di sini CUMA ikut Data Bahan & Aksesoris apa adanya (read-only, lihat
//   kolom Harga di template) — TIDAK memicu Riwayat Harga Pembelian atau
//   auto-update harga master (lihat simpan()).
// - "Nota Order Belanja" (modeNota=true) — CATATAN PEMBELIAN NYATA
//   (harga aktual sesuai nota fisik), harga per baris BISA diedit admin,
//   DAN memicu catatRiwayatHargaDanUpdateMaster() begitu di-final-kan.
// ---------------------------------------------------------------------------

// BARU (malam 24 Agt 2026) — Kartu Stok Bahan/Aksesoris. Module-level
// (BUKAN di dalam setup() manapun) & di-export SUPAYA bisa dipakai BARENG
// oleh hook pembelian di catatRiwayatHargaDanUpdateMaster() (bawah, dalam
// file yang sama) MAUPUN form "Pemakaian Manual" di js/vue-kartu-stok.js
// (file terpisah) — 1 fungsi tunggal biar stok_akhir master & saldo_setelah
// di tiap baris kartu SELALU dihitung dari 1 jalur runTransaction() yang
// sama, tidak ada 2 cara beda yang bisa bikin angkanya meleset satu sama
// lain. `qty` WAJIB sudah dalam satuan_pemakaian (bukan satuan_pembelian)
// — stok SATU satuan konsisten walau tiap pembelian bisa beda satuan beli.
export async function catatPergerakanKartuStok({ bahanId, namaBahan, tanggal, jenis, qty, satuan, sumber, noPembelian, keterangan, lotBaru }) {
  const refBahan = doc(db, 'master_bahan_aksesoris', bahanId);
  const lotDibuat = [];
  await runTransaction(db, async (tx) => {
    const snapBahan = await tx.get(refBahan);
    const dataBahan = snapBahan.exists() ? snapBahan.data() : {};
    const stokSebelum = parseFloat(dataBahan.stok_akhir) || 0;
    const stokSetelah = jenis === 'masuk' ? stokSebelum + qty : stokSebelum - qty;
    const updateBahan = { stok_akhir: stokSetelah };

    const refGerak = doc(collection(db, 'kartu_stok_bahan_aksesoris'));
    tx.set(refGerak, {
      bahan_aksesoris_id: bahanId, nama_bahan: namaBahan, tanggal, jenis, qty,
      satuan: satuan || '', sumber: sumber || '', no_pembelian: noPembelian || '',
      keterangan: keterangan || '', saldo_setelah: stokSetelah,
      dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
    });
    // BARU (25 Agt 2026, §25.3, kode_lot ditambah Tahap 2) — kalau ada data
    // lot baru (masuk lewat Nota untuk item `pakai_lot_tracking`), tulis 1
    // dokumen `lot_bahan_aksesoris` per baris DALAM transaksi yang SAMA —
    // supaya stok_akhir, ledger kartu stok, dan data lot SELALU konsisten
    // sekaligus (tidak ada celah antara 1 tulis sukses & yang lain gagal).
    // `kode_lot` (mis. "BHN-0001-L003") dibuat dari `id_tampil` BAHAN
    // (field id manusia-terbaca di master_bahan_aksesoris, mis. "BHN-0001"
    // — BUKAN `bahanId`/ID dokumen Firestore-nya yang auto-generated dan
    // TIDAK enak dibaca/di-scan, lihat PETA-DATABASE.md) + counter BARU
    // `lot_counter` di master_bahan_aksesoris, di-increment di TRANSAKSI
    // YANG SAMA (pakai data snapBahan yang SAMA dengan stok_akhir di atas —
    // tidak ada baca tambahan) supaya tidak ada 2 lot kebagian kode yang
    // sama walau dibuat nyaris bersamaan. Fallback ke `bahanId` kalau
    // `id_tampil` entah kenapa kosong (data lama/rusak) — supaya kode_lot
    // tetap unik walau kurang rapi tampilannya.
    if (jenis === 'masuk' && Array.isArray(lotBaru) && lotBaru.length > 0) {
      let counterLot = parseInt(dataBahan.lot_counter) || 0;
      const prefixLot = dataBahan.id_tampil || bahanId;
      lotBaru.forEach(l => {
        const qtyLot = parseFloat(l.qty) || 0;
        if (qtyLot <= 0) return;
        counterLot += 1;
        const kodeLot = `${prefixLot}-L${String(counterLot).padStart(3, '0')}`;
        const refLot = doc(collection(db, 'lot_bahan_aksesoris'));
        tx.set(refLot, {
          bahan_aksesoris_id: bahanId, nama_bahan: namaBahan, kode_lot: kodeLot,
          qty_awal: qtyLot, qty_sisa: qtyLot, satuan: satuan || '',
          tanggal_masuk: tanggal, no_pembelian: noPembelian || '',
          keterangan: l.keterangan || '', status: 'aktif',
          dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
        });
        lotDibuat.push({ id: refLot.id, kode_lot: kodeLot, qty: qtyLot, tanggal_masuk: tanggal, keterangan: l.keterangan || '' });
      });
      updateBahan.lot_counter = counterLot;
    }
    tx.set(refBahan, updateBahan, { merge: true });
  });
  return { lotDibuat };
}

// ambilLotAktif — BARU (Tahap 2). Baca semua lot AKTIF milik 1 bahan, urut
// FIFO (tanggal_masuk ASC, sama seperti bekas catatPemakaianDenganFifo()).
// Dipakai `vue-kartu-stok.js` untuk (a) cek cepat kosong/tidaknya data lot
// SEBELUM buka tabel alokasi, (b) isi tabel alokasi & saran FIFO default,
// (c) cari suggestion saat karyawan mengetik kode roll manual.
export async function ambilLotAktif(bahanId) {
  const snap = await getDocs(query(collection(db, 'lot_bahan_aksesoris'), where('bahan_aksesoris_id', '==', bahanId), where('status', '==', 'aktif')));
  const lots = []; snap.forEach(d => lots.push({ id: d.id, ...d.data() }));
  lots.sort((a, b) => (a.tanggal_masuk || '').localeCompare(b.tanggal_masuk || '') || ((a.dibuat_pada?.seconds || 0) - (b.dibuat_pada?.seconds || 0)));
  return lots;
}

// cariLotByKode — cari 1 lot AKTIF lewat `kode_lot` PERSIS (hasil scan QR
// label fisik roll, atau diketik manual). null kalau tidak ketemu/lot itu
// sudah habis (status bukan 'aktif' lagi, jadi tidak muncul di query ini).
export async function cariLotByKode(kodeLot) {
  if (!kodeLot) return null;
  const snap = await getDocs(query(collection(db, 'lot_bahan_aksesoris'), where('kode_lot', '==', String(kodeLot).trim()), where('status', '==', 'aktif')));
  let hasil = null;
  snap.forEach(d => { if (!hasil) hasil = { id: d.id, ...d.data() }; });
  return hasil;
}

// cariLotByKodeSemuaStatus — BARU (27 Agt 2026, §26.4, Tahap 4). SAMA
// PERSIS seperti `cariLotByKode()` di atas TAPI TANPA filter status —
// dipakai KHUSUS Scan Opname (`vue-scan-opname.js`), yang justru perlu
// bisa nemuin roll berstatus 'habis' juga: skenario nyatanya, karyawan
// scan label fisik roll yang di SISTEM sudah tercatat 'habis', tapi
// TERNYATA masih ada sisa fisiknya (opname justru buat nangkep selisih
// kayak gini). Kalau dipakai `cariLotByKode()` yang lama (filter aktif
// saja), roll begini TIDAK AKAN ketemu sama sekali lewat scan.
export async function cariLotByKodeSemuaStatus(kodeLot) {
  if (!kodeLot) return null;
  const snap = await getDocs(query(collection(db, 'lot_bahan_aksesoris'), where('kode_lot', '==', String(kodeLot).trim())));
  let hasil = null;
  snap.forEach(d => { if (!hasil) hasil = { id: d.id, ...d.data() }; });
  return hasil;
}

// cariBahanByIdTampil — cari 1 dokumen master_bahan_aksesoris lewat field
// `id_tampil` (ID manusia-terbaca, mis. "BHN-0001", DENORMALISASI/BEDA dari
// ID dokumen Firestore-nya sendiri yang auto-generated — lihat catatan di
// catatPergerakanKartuStok() di atas & PETA-DATABASE.md). WAJIB query
// (bukan getDoc langsung) karena id_tampil BUKAN ID dokumennya. Dipakai
// fitur "Scan Barang" di vue-kartu-stok.js — (a) untuk buka item dari
// bahan_aksesoris_id hasil cariLotByKode() (di situ SUDAH ID dokumen asli,
// dipetik via getDoc langsung — lihat pemanggilnya), (b) fallback kalau
// kode yang di-scan BUKAN kode_lot & dicoba sebagai id_tampil bahan itu
// sendiri.
export async function cariBahanByIdTampil(idTampil) {
  if (!idTampil) return null;
  const snap = await getDocs(query(collection(db, 'master_bahan_aksesoris'), where('id_tampil', '==', String(idTampil).trim())));
  let hasil = null;
  snap.forEach(d => { if (!hasil) hasil = { id: d.id, ...d.data() }; });
  return hasil;
}

// ambilBahanById — getDoc LANGSUNG lewat ID dokumen Firestore asli (dipakai
// utamanya utk resolve `lot.bahan_aksesoris_id` hasil cariLotByKode(), yang
// SUDAH ID dokumen, BUKAN id_tampil — beda dari cariBahanByIdTampil() di
// atas). Export terpisah supaya pemanggil (vue-kartu-stok.js) tidak salah
// pakai fungsi utk 2 jenis ID yang beda ini.
export async function ambilBahanById(bahanId) {
  if (!bahanId) return null;
  const snap = await getDoc(doc(db, 'master_bahan_aksesoris', bahanId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// catatPemakaianDariAlokasi — GANTI (Tahap 2) dari catatPemakaianDenganFifo()
// versi §25.3. `alokasi` (array {lotId, qty}) sudah ditentukan pemanggil
// (vue-kartu-stok.js) — FIFO cuma jadi SARAN DEFAULT yang otomatis diisi di
// sana (bangunAlokasiFifo()), karyawan boleh ganti/tambah lewat cari kode
// atau scan QR label roll. Fungsi ini HANYA validasi total alokasi cocok
// dengan qty pemakaian, lalu eksekusi transaksional — SEMUA lot yang
// dialokasikan dibaca ULANG lewat tx.get() (data FRESH) sebelum ada
// tulisan apapun (aturan wajib Firestore transaction), sama seperti pola
// §25.3, supaya tetap aman kalau ada 2 orang catat pemakaian bersamaan.
//
// Peringatan "bukan roll tertua" (keputusan Guru: "Beri peringatan dulu
// kalau bukan yang tertua") DITAMPILKAN vue-kartu-stok.js SEBELUM fungsi
// ini dipanggil — fungsi backend ini SENGAJA tidak menolak alokasi yang
// menyimpang dari FIFO, cuma pastikan datanya valid & konsisten.
//
// Cek LOT_KOSONG/LOT_KURANG (belum ada data lot / lot aktif < qty diminta)
// SEKARANG dilakukan vue-kartu-stok.js SENDIRI lewat ambilLotAktif() SEBELUM
// tabel alokasi dibuka — TIDAK dilempar dari sini lagi. `LOT_BERUBAH` tetap
// dilempar dari sini kalau data lot berubah persis di antara alokasi
// disusun & transaksi ini dieksekusi (jaga-jaga race).
//
// Param BARU (27 Agt 2026, §26.5, Tahap 5) — `sumber` (OPSIONAL, default
// TETAP string lama persis di bawah, supaya pemanggil lama di
// vue-kartu-stok.js yang TIDAK mengirim param ini otomatis tidak berubah
// perilakunya sama sekali). Ditambah supaya `vue-scan-persiapan.js` bisa
// tulis label sumber yang beda ("Pemakaian (Scan Persiapan)") — biar
// gampang dibedakan di kolom "Sumber" Kartu Stok Detail, bukan cuma lewat
// baca teks Keterangan.
export async function catatPemakaianDariAlokasi({ bahanId, namaBahan, tanggal, qty, satuan, keterangan, alokasi, sumber }) {
  if (!Array.isArray(alokasi) || alokasi.length === 0) {
    throw new Error('Belum ada roll/lot yang dipilih untuk pemakaian ini.');
  }
  const totalAlokasi = alokasi.reduce((t, a) => t + (parseFloat(a.qty) || 0), 0);
  if (Math.round((totalAlokasi - qty) * 100) !== 0) {
    throw new Error(`Total qty roll/lot yang dipilih (${totalAlokasi}) tidak sama dengan jumlah pemakaian (${qty}).`);
  }

  const refBahan = doc(db, 'master_bahan_aksesoris', bahanId);
  const rincianHasil = [];
  let stokSetelahFinal = 0;
  await runTransaction(db, async (tx) => {
    const snapBahan = await tx.get(refBahan);
    const lotRefs = alokasi.map(a => doc(db, 'lot_bahan_aksesoris', a.lotId));
    const lotSnaps = [];
    for (const ref of lotRefs) lotSnaps.push(await tx.get(ref)); // WAJIB berurutan/di-await 1-1 dalam transaction (bukan Promise.all) — konsisten dengan cara tx.get() dipakai di tempat lain

    const stokSebelum = snapBahan.exists() ? (parseFloat(snapBahan.data().stok_akhir) || 0) : 0;
    const stokSetelah = stokSebelum - qty;
    tx.set(refBahan, { stok_akhir: stokSetelah }, { merge: true });

    let totalTerpotongUlang = 0;
    alokasi.forEach((a, i) => {
      const lotSnap = lotSnaps[i];
      if (!lotSnap.exists()) {
        throw Object.assign(new Error('Salah satu roll/lot yang dipilih sudah tidak ada, coba pilih ulang roll/lot-nya.'), { kode: 'LOT_BERUBAH' });
      }
      const dataLot = lotSnap.data();
      const sisaSekarang = parseFloat(dataLot.qty_sisa) || 0;
      const diminta = parseFloat(a.qty) || 0;
      const ambilFix = Math.min(diminta, sisaSekarang);
      const sisaBaru = sisaSekarang - ambilFix;
      tx.update(lotRefs[i], { qty_sisa: sisaBaru, status: sisaBaru <= 0 ? 'habis' : 'aktif' });
      rincianHasil.push({ lot_id: a.lotId, kode_lot: dataLot.kode_lot || '', tanggal_masuk: dataLot.tanggal_masuk || '', dipotong: ambilFix, sisa_setelah: sisaBaru });
      totalTerpotongUlang += ambilFix;
    });
    // Jaga-jaga langka: kalau data lot berubah persis di antara alokasi
    // disusun (di UI) & transaksi ini dieksekusi (mis. ada pemakaian lain
    // nyelip di roll yang sama) sampai totalnya jadi tidak cukup lagi —
    // batalkan transaksi ini dengan pesan jelas, JANGAN diam-diam catat
    // kurang dari qty yang diminta.
    if (Math.round((totalTerpotongUlang - qty) * 100) !== 0) {
      throw Object.assign(new Error('Data roll/lot berubah saat diproses (mungkin dipakai bersamaan di perangkat lain), coba pilih ulang roll/lot-nya.'), { kode: 'LOT_BERUBAH' });
    }

    const refGerak = doc(collection(db, 'kartu_stok_bahan_aksesoris'));
    tx.set(refGerak, {
      bahan_aksesoris_id: bahanId, nama_bahan: namaBahan, tanggal, jenis: 'keluar', qty,
      satuan: satuan || '', sumber: sumber || 'Pemakaian Manual (Pilih Roll/Lot)', no_pembelian: '',
      keterangan: keterangan || '', saldo_setelah: stokSetelah, rincian_lot: rincianHasil,
      dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
    });
    stokSetelahFinal = stokSetelah;
  });

  return { rincian: rincianHasil, stokSetelah: stokSetelahFinal };
}

// ===========================================================================
// catatPenyesuaianOpnameItem / catatPenyesuaianOpnameLot — BARU (27 Agt
// 2026, §26.4, Tahap 4). Dipakai Scan Opname (`vue-scan-opname.js`).
//
// KEPUTUSAN GURU (§26.0 poin 5, "Opsi B"): efek Scan Opname ke stok BUKAN
// override diam-diam — SELALU tercatat sebagai pergerakan "Penyesuaian" di
// `kartu_stok_bahan_aksesoris` (ledger yang SUDAH ADA, dipakai bareng
// semua pergerakan lain — masuk dari Nota, keluar dari Pemakaian, sekarang
// + Penyesuaian dari Opname), supaya auditable & konsisten — BUKAN koleksi
// baru terpisah.
//
// Sesuai aturan yang SUDAH didokumentasikan di `catatPergerakanKartuStok()`
// di atas ("JANGAN PERNAH update stok_akhir langsung dari tempat lain"),
// KEDUA fungsi ini — BUKAN kode ad-hoc di `vue-scan-opname.js` — adalah
// SATU-SATUNYA jalur yang boleh mengubah stok_akhir/qty_sisa akibat
// opname, konsisten dengan `catatPergerakanKartuStok()`/
// `catatPemakaianDariAlokasi()` di atas.
//
// Input-nya SENGAJA "qty fisik yang ditemukan" (bukan selisihnya) — lebih
// natural buat karyawan yang lagi hitung fisik ("saya hitung ketemu 12",
// bukan "sistem kurang 3 dari fisik") — delta dihitung OTOMATIS di sini
// (fisik - sistem). Kalau delta 0 (stok sudah sesuai), TIDAK ADA yang
// ditulis sama sekali (tidak ada baris pergerakan buat "tidak ada
// perubahan") — pemanggil (vue-scan-opname.js) cukup tampilkan pesan
// "sudah sesuai" ke user.
// ---------------------------------------------------------------------------

// catatPenyesuaianOpnameItem — item BUKAN lot (opname per ITEM, bandingkan
// ke `stok_akhir` langsung).
export async function catatPenyesuaianOpnameItem({ bahanId, namaBahan, satuan, qtyFisik, keterangan }) {
  const refBahan = doc(db, 'master_bahan_aksesoris', bahanId);
  let hasil = { delta: 0, stokSebelum: 0, stokSetelah: 0 };
  await runTransaction(db, async (tx) => {
    const snapBahan = await tx.get(refBahan);
    const stokSebelum = snapBahan.exists() ? (parseFloat(snapBahan.data().stok_akhir) || 0) : 0;
    const delta = Math.round((qtyFisik - stokSebelum) * 100) / 100;
    hasil = { delta, stokSebelum, stokSetelah: qtyFisik };
    if (delta === 0) return; // sudah sesuai, tidak menulis apapun
    tx.set(refBahan, { stok_akhir: qtyFisik }, { merge: true });
    const refGerak = doc(collection(db, 'kartu_stok_bahan_aksesoris'));
    tx.set(refGerak, {
      bahan_aksesoris_id: bahanId, nama_bahan: namaBahan,
      tanggal: new Date().toISOString().slice(0, 10),
      jenis: delta > 0 ? 'masuk' : 'keluar', qty: Math.abs(delta),
      satuan: satuan || '', sumber: 'Penyesuaian (Scan Opname)', no_pembelian: '',
      keterangan: (keterangan ? keterangan + ' — ' : '') + `Opname: sistem ${stokSebelum} -> fisik ${qtyFisik}`,
      saldo_setelah: qtyFisik,
      dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
    });
  });
  return hasil;
}

// catatPenyesuaianOpnameLot — item LOT (opname PER ROLL, keputusan Guru
// §26.0 poin 5 — "tiap kode_lot dihitung ulang sendiri-sendiri, bukan 1
// angka gabungan per bahan"). qty_sisa roll itu SENDIRI diganti ke qty
// fisik, `stok_akhir` bahan induknya ikut bergeser sebesar delta yang SAMA
// (karena stok_akhir = jumlah SEMUA roll aktifnya).
export async function catatPenyesuaianOpnameLot({ lotId, qtyFisik, keterangan }) {
  const refLot = doc(db, 'lot_bahan_aksesoris', lotId);
  let hasil = { delta: 0, kodeLot: '', qtySisaSebelum: 0, qtySisaSetelah: 0 };
  await runTransaction(db, async (tx) => {
    const snapLot = await tx.get(refLot);
    if (!snapLot.exists()) throw new Error('Data roll/lot ini sudah tidak ada (mungkin dihapus). Coba scan ulang.');
    const dataLot = snapLot.data();
    const refBahan = doc(db, 'master_bahan_aksesoris', dataLot.bahan_aksesoris_id);
    const snapBahan = await tx.get(refBahan);
    const qtySisaSebelum = parseFloat(dataLot.qty_sisa) || 0;
    const delta = Math.round((qtyFisik - qtySisaSebelum) * 100) / 100;
    hasil = { delta, kodeLot: dataLot.kode_lot || '', qtySisaSebelum, qtySisaSetelah: qtyFisik };
    if (delta === 0) return; // sudah sesuai, tidak menulis apapun
    tx.update(refLot, { qty_sisa: qtyFisik, status: qtyFisik <= 0 ? 'habis' : 'aktif' });
    const stokAkhirSebelum = snapBahan.exists() ? (parseFloat(snapBahan.data().stok_akhir) || 0) : 0;
    const stokAkhirSetelah = stokAkhirSebelum + delta;
    tx.set(refBahan, { stok_akhir: stokAkhirSetelah }, { merge: true });
    const refGerak = doc(collection(db, 'kartu_stok_bahan_aksesoris'));
    tx.set(refGerak, {
      bahan_aksesoris_id: dataLot.bahan_aksesoris_id, nama_bahan: dataLot.nama_bahan || '',
      tanggal: new Date().toISOString().slice(0, 10),
      jenis: delta > 0 ? 'masuk' : 'keluar', qty: Math.abs(delta),
      satuan: dataLot.satuan || '', sumber: 'Penyesuaian (Scan Opname per Roll)', no_pembelian: '',
      keterangan: (keterangan ? keterangan + ' — ' : '') + `Roll ${dataLot.kode_lot || ''}: sistem ${qtySisaSebelum} -> fisik ${qtyFisik}`,
      saldo_setelah: stokAkhirSetelah,
      rincian_lot: [{ lot_id: lotId, kode_lot: dataLot.kode_lot || '', sisa_setelah: qtyFisik }],
      dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
    });
  });
  return hasil;
}

// ---------------------------------------------------------------------------
// PopupQtyPerLot — BARU (25 Agt 2026, §25.2). Popup isi qty per roll/lot
// untuk 1 baris di "Daftar Pesanan Pembelian", pola SAMA seperti
// PopupKonversiBerjenjang di vue-bahan-aksesoris.js (state diedit di
// komponen induk OrderBelanjaScreen lewat props, emit 'tambah'/'hapus'/
// 'terapkan'/'tutup' — bukan disimpan ganda di sini).
// ---------------------------------------------------------------------------
const PopupQtyPerLot = {
  props: {
    baris: { type: Array, required: true },
    total: { type: Number, required: true },
    target: { type: Number, default: 0 },
    satuan: { type: String, default: '' },
    namaBarang: { type: String, default: '' }
  },
  emits: ['tambah', 'hapus', 'terapkan', 'tutup'],
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="$emit('tutup')">
      <div class="gc-card" style="max-width:520px; width:100%; max-height:90vh; overflow-y:auto;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:6px;"><i class="fas fa-layer-group" style="color:var(--burgundy); margin-right:8px;"></i>Qty per Roll/Lot — {{ namaBarang }}</h3>
        <p style="font-size:11px; color:var(--text-faint); margin-bottom:14px;">Isi qty tiap roll/kones satu per satu (qtynya bisa beda-beda tiap roll). Total dijumlah otomatis. Catatan: FIFO/pemakaian per-lot belum aktif — ronde ini baru mencatat qty per roll saat barang diterima.</p>
        <div style="display:grid; grid-template-columns:40px 1fr 1fr 30px; gap:6px; margin-bottom:4px;">
          <span style="font-size:10px; font-weight:700; color:var(--text-faint);">NO</span>
          <span style="font-size:10px; font-weight:700; color:var(--text-faint);">QTY ({{ satuan || 'satuan' }})</span>
          <span style="font-size:10px; font-weight:700; color:var(--text-faint);">KETERANGAN (opsional)</span>
          <span></span>
        </div>
        <div v-for="(b, i) in baris" :key="i" style="display:grid; grid-template-columns:40px 1fr 1fr 30px; gap:6px; align-items:center; margin-bottom:8px;">
          <span style="font-size:11.5px; color:var(--text-muted); text-align:center;">{{ i + 1 }}</span>
          <input v-model.number="b.qty" type="number" min="0" placeholder="0" style="width:100%; padding:7px 6px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
          <input v-model="b.keterangan" type="text" placeholder="Mis. no. roll" style="width:100%; padding:7px 6px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
          <button @click="$emit('hapus', i)" class="icon-btn" style="color:var(--danger);" title="Hapus baris"><i class="fas fa-trash-alt"></i></button>
        </div>
        <button @click="$emit('tambah')" class="btn-outline" style="font-size:11.5px; padding:6px 14px; margin-bottom:16px;"><i class="fas fa-plus" style="margin-right:5px;"></i>Tambah Roll/Lot</button>
        <div style="background:var(--ivory-dim); border-radius:10px; padding:10px 14px; margin-bottom:16px; font-size:12.5px;">
          <div style="display:flex; justify-content:space-between;">
            <span style="color:var(--text-muted);">Total {{ baris.length }} roll/lot:</span><b>{{ total }} {{ satuan }}</b>
          </div>
          <div v-if="target > 0" style="display:flex; justify-content:space-between; margin-top:4px; padding-top:4px; border-top:1px dashed var(--line);">
            <span style="color:var(--text-muted);">Qty di baris pesanan:</span>
            <b :style="{color: total === target ? 'var(--text-muted)' : 'var(--danger)'}">{{ target }} {{ satuan }}{{ total !== target ? ' (beda dengan total roll!)' : '' }}</b>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="$emit('terapkan')" class="btn-primary" style="flex:1;">Terapkan</button>
          <button @click="$emit('tutup')" class="btn-outline" style="flex:1;">Batal</button>
        </div>
      </div>
    </div>
  `
};

const OrderBelanjaScreen = {
  components: { DropdownCari, PengaturanStockPembelian, PopupQtyPerLot, PopupTambahSuplayerCepat },
  props: { modeNota: { type: Boolean, default: false } },
  setup(props) {
    const menuId = props.modeNota ? 'stock_nota_order_belanja' : 'stock_list_order_belanja';
    const daftarBahan = ref([]);
    const daftarSuplayer = ref([]);
    const daftarPermintaan = ref([]); // dari persiapan_masalah, status menunggu
    const daftarDraft = ref([]);
    // BARU (26 Agt 2026, permintaan Guru) — alias_pembelian, supaya dropdown
    // "Nama Barang" (List & Nota Order Belanja) JUGA bisa dicari lewat nama
    // di nota Suplayer (bukan cuma nama+warna internal) — lihat
    // opsiNamaBarangMap di bawah.
    const daftarAlias = ref([]);
    const memuat = ref(true);
    const tampilPengaturan = ref(false);
    // BARU (27 Agt 2026, §26.1) — shortcut "+" tambah Suplayer cepat, sama
    // pola seperti AliasPembelianManager di atas.
    const tampilTambahSuplayer = ref(false);
    async function onSuplayerBaruTersimpan(namaBaru) {
      tampilTambahSuplayer.value = false;
      daftarSuplayer.value = await ambilDaftarSuplayer();
      suplayerEntry.value = namaBaru;
    }

    const draftDocId = ref(null);
    const noPembelianAktif = ref('');
    const tanggal = ref(new Date().toISOString().slice(0, 10));
    const suplayerEntry = ref('');
    const qtyEntry = ref('');
    const namaBarangEntry = ref('');
    const daftarPesanan = ref([]);
    const sumberPermintaanIds = ref([]);
    const menyimpan = ref(false);
    // BARU (Tahap 2) — roll/lot baru yang barusan dibuat dari Nota yang
    // di-final-kan (diisi simpan(), lihat catatan di sana), dipakai tombol
    // "Cetak Label Roll" (cetakLabelLot(), di bawah dekat cetak()).
    const lotUntukCetak = ref([]);

    // BARU (25 Agt 2026, §25.2) — Popup "Qty per Roll/Lot". indexBarisLot
    // menyimpan INDEX baris di daftarPesanan yang sedang diedit lewat
    // popup (bukan reference langsung, supaya gampang dibatalkan tanpa
    // menyentuh data asli sebelum "Terapkan" diklik).
    const tampilPopupLot = ref(false);
    const indexBarisLot = ref(-1);
    const barisLotSementara = ref([]);
    function bukaPopupLot(i) {
      const it = daftarPesanan.value[i];
      if (!it || !it.pakai_lot_tracking) return;
      indexBarisLot.value = i;
      barisLotSementara.value = (it.detail_lot && it.detail_lot.length > 0)
        ? JSON.parse(JSON.stringify(it.detail_lot))
        : [{ qty: '', keterangan: '' }];
      tampilPopupLot.value = true;
    }
    function tutupPopupLot() { tampilPopupLot.value = false; indexBarisLot.value = -1; }
    function tambahBarisLot() { barisLotSementara.value.push({ qty: '', keterangan: '' }); }
    function hapusBarisLot(i) {
      if (barisLotSementara.value.length <= 1) return;
      barisLotSementara.value.splice(i, 1);
    }
    const totalQtyLot = computed(() => barisLotSementara.value.reduce((t, b) => t + (parseFloat(b.qty) || 0), 0));
    const barisLotTarget = computed(() => (indexBarisLot.value >= 0 && daftarPesanan.value[indexBarisLot.value]) ? (parseFloat(daftarPesanan.value[indexBarisLot.value].qty_s) || 0) : 0);
    const barisLotSatuan = computed(() => (indexBarisLot.value >= 0 && daftarPesanan.value[indexBarisLot.value]) ? (daftarPesanan.value[indexBarisLot.value].satuan || '') : '');
    const barisLotNama = computed(() => (indexBarisLot.value >= 0 && daftarPesanan.value[indexBarisLot.value]) ? (daftarPesanan.value[indexBarisLot.value].nama || '') : '');
    function terapkanLot() {
      const tidakLengkap = barisLotSementara.value.some(b => !(parseFloat(b.qty) > 0));
      if (tidakLengkap) { alert('Isi Qty tiap roll/lot dulu (harus lebih dari 0). Hapus baris yang tidak dipakai.'); return; }
      if (indexBarisLot.value >= 0 && daftarPesanan.value[indexBarisLot.value]) {
        daftarPesanan.value[indexBarisLot.value].detail_lot = JSON.parse(JSON.stringify(barisLotSementara.value));
      }
      tampilPopupLot.value = false;
      indexBarisLot.value = -1;
    }

    const bolehSimpan = computed(() => window.cekIzinMenu(menuId, 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu(menuId, 'delete') !== false);

    const opsiSuplayer = computed(() => daftarSuplayer.value.map(s => s.nama));
    // BARU (25 Agt 2026) — tampilkan nama+warna (formatNamaBahan(), lihat
    // atas dekat formatRupiah) supaya item dengan `nama` sama tapi `warna`
    // beda bisa dibedakan di dropdown "Nama Barang" (List & Nota Order
    // Belanja, komponen SAMA-SAMA lewat OrderBelanjaScreen ini), DAN tidak
    // salah nyantol ke varian warna lain — lihat catatan di
    // tambahItemManual() di bawah.
    //
    // DIPERLUAS (26 Agt 2026, §25.10, permintaan Guru): "field nama barang
    // ... data alias tidak muncul, harusnya nama internal + warna dan atau
    // nama alias juga muncul saat pencarian". SEBELUMNYA dropdown ini
    // CUMA berisi nama+warna internal — alias (nama di nota Suplayer,
    // menu Alias Pembelian) TIDAK bisa dicari/dipilih sama sekali di sini.
    //
    // REVISI LAGI (26 Agt 2026, §25.11, permintaan Guru langsung setelah
    // §25.10) — 2 penyesuaian: (a) opsi alias SEKARANG DIBATASI cuma
    // punya Suplayer yang SEDANG dipilih di field Suplayer (SEBELUMNYA
    // semua alias dari semua Suplayer ikut muncul) — supaya "tidak
    // acak2an"; (b) label alias di dropdown SEKARANG cuma nama alias
    // POLOS (`nama_di_nota` apa adanya), TANPA embel2
    // "(alias {suplayer} -> ...)" lagi — lebih rapi. Karena SUDAH
    // dibatasi per-Suplayer, tabrakan nama antar-Suplayer tidak mungkin
    // lagi terjadi di opsi yang tampil (makanya label polos aman dipakai).
    //
    // Dipakai sebagai Map<label, {bahan, namaAlias}> (bukan cuma array
    // string) SUPAYA baik nama internal MAUPUN nama alias yang dipilih
    // bisa langsung di-resolve balik ke item bahan yang benar TANPA
    // re-matching rawan-ambigu (lihat tambahItemManual() di bawah), DAN
    // `namaAlias` ikut terbawa buat kolom baru "Nama Alias" di tabel
    // Daftar Pesanan Pembelian (kosong kalau item dipilih lewat nama
    // internal langsung, bukan lewat alias). Alias yang bahan internalnya
    // sudah kehapus SENGAJA di-skip (tidak mungkin di-resolve balik lagi).
    // Alias TIDAK muncul sama sekali kalau belum ada Suplayer dipilih.
    const opsiNamaBarangMap = computed(() => {
      const map = new Map();
      daftarBahan.value.forEach(b => {
        const label = formatNamaBahan(b);
        if (!map.has(label)) map.set(label, { bahan: b, namaAlias: '' });
      });
      const suplayerAktif = daftarSuplayer.value.find(s => s.nama === suplayerEntry.value);
      if (suplayerAktif) {
        daftarAlias.value
          .filter(a => a.suplayer_id === suplayerAktif.id)
          .forEach(a => {
            const bahan = daftarBahan.value.find(b => b.id === a.bahan_aksesoris_id);
            if (!bahan) return;
            const label = a.nama_di_nota;
            if (!map.has(label)) map.set(label, { bahan, namaAlias: a.nama_di_nota });
          });
      }
      return map;
    });
    const opsiNamaBarang = computed(() => Array.from(opsiNamaBarangMap.value.keys()));
    // BARU (26 Agt 2026, §25.11), DIBUKA JADI BISA PILIH (27 Agt 2026,
    // §25.13, permintaan Guru: "kadang beli dus, kadang beli pak, kadang
    // beli pcs > satuan yg muncul sesuai yg diinput di konversi banyak
    // tingkat"). SEBELUMNYA field ini read-only, selalu ikut
    // `satuan_pembelian` (tingkat PALING ATAS di Master) — sekarang jadi
    // dropdown-cari SUNGGUHAN, opsinya diambil dari rantai
    // `konversi_bertingkat` item yang dipilih (lihat opsiSatuanBeliUntuk
    // di atas), supaya kalau item itu bisa dibeli dalam beberapa tingkat
    // (mis. DUS/PACK/PCS), admin bisa pilih sesuai yang SUNGGUHAN dibeli
    // hari itu — BUKAN dipaksa selalu satuan_pembelian teratas.
    // `satuanEntryManual` nyimpan pilihan AKTIF user, di-set OTOMATIS ke
    // default (satuan_pembelian, tingkat teratas) tiap kali item di
    // dropdown Nama Barang berganti (lihat watch(namaBarangEntry) di
    // bawah), TAPI boleh ditimpa manual lewat dropdown-nya sendiri.
    const satuanEntryManual = ref('');
    const opsiSatuanEntry = computed(() => {
      const dipilih = opsiNamaBarangMap.value.get(namaBarangEntry.value);
      return dipilih ? opsiSatuanBeliUntuk(dipilih.bahan) : [];
    });
    watch(namaBarangEntry, (val) => {
      const dipilih = opsiNamaBarangMap.value.get(val);
      satuanEntryManual.value = dipilih ? (dipilih.bahan.satuan_pembelian || '') : '';
    });
    // BARU (26 Agt 2026, §25.11, permintaan Guru: "1 nota = 1 suplayer...
    // saat tambah entry data pertama pada nota order belanja field
    // suplayer lock sampai di klik disimpan") — HANYA berlaku Nota
    // (modeNota true); List Order Belanja TETAP boleh multi-Suplayer per
    // dokumen (TIDAK berubah). Dasarnya `daftarPesanan.length > 0` — jadi
    // otomatis lepas lagi begitu simpan() sukses & formKosong() ngosongin
    // daftarPesanan (tidak perlu state terpisah).
    const suplayerTerkunci = computed(() => props.modeNota && daftarPesanan.value.length > 0);
    // BARU (26 Agt 2026, §25.11) — ref input Qty, dipakai fokuskan
    // cursor ke situ lagi begitu tombol Tambah diklik (permintaan Guru).
    const qtyEntryEl = ref(null);
    // BARU (malam 24 Agt 2026) — dihitung LIVE dari qty*harga (bukan baca
    // field `jumlah` statis lagi), supaya begitu admin edit Harga Aktual
    // di tabel, Estimasi Biaya Belanja di atas langsung ikut update.
    const estimasiBiaya = computed(() => daftarPesanan.value.reduce((t, i) => t + (parseFloat(i.qty) || 0) * (parseFloat(i.harga) || 0), 0));
    const adaTerpilih = computed(() => daftarPesanan.value.some(i => i.dicentang));

    const labelGroup1 = props.modeNota ? 'Daftar Pesanan Bahan & Aksesoris' : 'Daftar Permintaan Bahan & Aksesoris';

    async function muatSemua() {
      memuat.value = true;
      try {
        // BARU (26 Agt 2026) — ikut muat `alias_pembelian` (query TANPA
        // where, sama seperti AliasPembelianManager) supaya opsiNamaBarang
        // di atas bisa gabung nama internal + nama alias.
        const [bahan, suplayer, snapPermintaan, snapDraft, snapAlias] = await Promise.all([
          ambilDaftarBahanAksesorisLengkap(),
          ambilDaftarSuplayer(),
          getDocs(query(collection(db, 'persiapan_masalah'), where('status', '==', 'menunggu'))),
          getDocs(query(collection(db, 'pesanan_pembelian'), where('status', '==', 'draft'))),
          getDocs(collection(db, 'alias_pembelian'))
        ]);
        daftarBahan.value = bahan;
        daftarSuplayer.value = suplayer;
        const listPermintaan = []; snapPermintaan.forEach(d => listPermintaan.push({ id: d.id, ...d.data() }));
        listPermintaan.sort((a, b) => (b.dibuat_pada?.seconds || 0) - (a.dibuat_pada?.seconds || 0));
        daftarPermintaan.value = listPermintaan;
        const listDraft = []; snapDraft.forEach(d => listDraft.push({ id: d.id, ...d.data() }));
        listDraft.sort((a, b) => (b.dibuat_pada?.seconds || 0) - (a.dibuat_pada?.seconds || 0));
        daftarDraft.value = listDraft;
        const listAlias = []; snapAlias.forEach(d => listAlias.push({ id: d.id, ...d.data() }));
        daftarAlias.value = listAlias;
      } catch (e) {
        console.error('Gagal muat Order Belanja:', e);
      }
      memuat.value = false;
    }

    // BARU (malam 24 Agt 2026, fitur Riwayat Harga Pembelian) — field
    // `harga` di baris pesanan SEKARANG "Harga Aktual": diisi OTOMATIS
    // dari harga_pembelian master data sebagai DEFAULT/perkiraan, TAPI
    // admin BOLEH TIMPA sesuai angka SUNGGUHAN di nota (harga sering
    // naik-turun tiap beli). `isi_konversi` disimpan sebagai SNAPSHOT
    // (bukan dihitung ulang dari master data nanti) supaya Riwayat Harga
    // Pembelian tetap akurat meski konversi master data berubah di masa
    // depan. `jumlah` SENGAJA TIDAK disimpan di sini lagi — dihitung
    // ulang live tiap kali harga diedit (lihat estimasiBiaya computed &
    // template kolom Jumlah), baru di-final-kan pas simpan().
    // BARU (27 Agt 2026, §25.13) — param ke-5 `satuanBeliPilihan`: satuan
    // BELI yang SUNGGUHAN dipilih user di field Satuan (bisa beda dari
    // satuan_pembelian teratas Master, mis. beli PACK padahal Master-nya
    // DUS — lihat opsiSatuanBeliUntuk/faktorKonversiUntukSatuan di atas).
    // Kosong/undefined (dipanggil dari tambahDariPermintaan, yang belum
    // punya UI pilih satuan) — fallback ke satuan_pembelian Master seperti
    // perilaku lama.
    function buatBarisPesanan(item, qty, keterangan, namaAlias, satuanBeliPilihan) {
      const suplayer = daftarSuplayer.value.find(s => s.nama === suplayerEntry.value);
      const satuanDipakai = satuanBeliPilihan || item.satuan_pembelian || '';
      // FIX (27 Agt 2026, §25.13) — SEBELUMNYA selalu pakai
      // `item.isi_konversi_pembelian` (faktor gabungan dari tingkat
      // PALING ATAS), padahal itu CUMA benar kalau beli persis di
      // satuan_pembelian teratas. Sekarang hitung faktor yang BENAR
      // sesuai satuan yang SUNGGUHAN dipilih (faktorKonversiUntukSatuan,
      // baca rantai konversi_bertingkat) — supaya Qty Pakai tetap akurat
      // walau beli di tingkat berbeda (mis. PACK, bukan DUS).
      const isiKonversi = faktorKonversiUntukSatuan(item, satuanDipakai);
      return {
        dicentang: false,
        suplayer_id: suplayer ? suplayer.id : '', suplayer_nama: suplayerEntry.value,
        // FIX (26 Agt 2026, §25.11) — `sku` SEBELUMNYA `item.id` (ID
        // dokumen Firestore auto-generated, BUKAN human-readable — lihat
        // catatan id_tampil vs ID dokumen di PETA-DATABASE.md), jadi kolom
        // ini selama ini menampilkan ID mentah yang tidak enak dibaca.
        // Sekarang pakai `item.id_tampil` (mis. "BHN-0001"), fallback ke
        // `item.id` HANYA kalau id_tampil entah kenapa kosong (data lama/
        // rusak) — kolom tabelnya juga di-rename jadi "ID Bahan &
        // Aksesoris" (lihat template) supaya konsisten.
        // FIX (27 Agt 2026, laporan Guru) — `nama` SEBELUMNYA `item.nama`
        // POLOS (tanpa warna), jadi kolom "Nama Barang" di tabel List/Nota
        // Order Belanja (dan Nota cetak) TIDAK bisa bedakan 2+ item nama
        // sama beda warna — padahal dropdown pemilihannya SUDAH pakai
        // formatNamaBahan() (nama+warna, lihat opsiNamaBarangMap di atas).
        // Sekarang disimpan formatNamaBahan(item) juga, konsisten dengan
        // Alias Pembelian (§25.9). Ini snapshot nama SAAT baris dibuat —
        // sama seperti field lain di sini (harga, isi_konversi, dst), TIDAK
        // ikut berubah otomatis kalau nama/warna item diedit belakangan.
        bahan_aksesoris_id: item.id, sku: item.id_tampil || item.id, nama: formatNamaBahan(item),
        // BARU (26 Agt 2026, §25.11) — nama alias (nota Suplayer) yang
        // dipakai buat MEMILIH item ini lewat dropdown "Nama Barang",
        // kalau ada (lihat opsiNamaBarangMap/tambahItemManual di atas) —
        // kosong kalau dipilih langsung lewat nama+warna internal. Dipakai
        // kolom baru "Nama Alias" di tabel Daftar Pesanan Pembelian.
        nama_alias: namaAlias || '',
        qty: qty, satuan_bahan: satuanDipakai,
        qty_s: Math.round((qty * isiKonversi) * 100) / 100, satuan: item.satuan_pemakaian || '',
        isi_konversi: isiKonversi,
        // GANTI (27 Agt 2026, §25.14, permintaan Guru: "harga menurut
        // satuan awal adalah harga saat pembelian... ada 3 harga dengan
        // 3 satuan awal") — SEBELUMNYA prefill "Harga Aktual" SELALU dari
        // `item.harga_pembelian` (harga tingkat TERATAS/satuan_pembelian
        // saja), walau yang dibeli sekarang PACK atau PCS. Sekarang pakai
        // hargaUntukSatuan() — ambil harga TINGKAT yang SUNGGUHAN dipilih
        // (dari konversi_bertingkat item itu), fallback ke Harga Modal
        // kalau beli langsung di satuan dasar/pemakaian.
        harga: hargaUntukSatuan(item, satuanDipakai),
        keterangan: keterangan || '',
        // BARU (25 Agt 2026, §25.2) — denormalisasi flag dari Data Bahan &
        // Aksesoris (item.pakai_lot_tracking) supaya tombol popup "Qty per
        // Roll/Lot" di tabel tahu harus aktif/tidak TANPA perlu lookup
        // ulang tiap render. `detail_lot` mulai kosong, diisi lewat popup
        // (lihat bukaPopupLot/terapkanLot di bawah).
        pakai_lot_tracking: !!item.pakai_lot_tracking,
        detail_lot: []
      };
    }

    function tambahItemManual() {
      if (!suplayerEntry.value) return alert('Pilih Suplayer dulu.');
      // GANTI (26 Agt 2026) — resolve lewat opsiNamaBarangMap (bukan
      // re-matching formatNamaBahan()) — SEKARANG value yang dipilih bisa
      // berasal dari nama+warna internal ATAU dari label alias (lihat
      // opsiNamaBarangMap di atas), Map ini yang jadi satu-satunya sumber
      // kebenaran buat resolve balik ke item bahan yang benar, jadi tidak
      // ada 2 jalur re-matching yang bisa saling tidak sinkron.
      const dipilih = opsiNamaBarangMap.value.get(namaBarangEntry.value);
      if (!dipilih) return alert('Pilih Nama Barang dari daftar dulu (bukan teks bebas). Kalau nama di nota Suplayer beda, catat dulu di menu Alias Pembelian.');
      // BARU (27 Agt 2026, §25.13) — Satuan sekarang WAJIB dipilih (bukan
      // otomatis lagi selalu benar) — biasanya sudah ke-isi otomatis
      // (default satuan_pembelian, lihat watch(namaBarangEntry)), ini
      // jaring pengaman kalau somehow kosong.
      if (!satuanEntryManual.value) return alert('Pilih Satuan Beli dulu.');
      const qty = parseFloat(qtyEntry.value);
      if (!(qty > 0)) return alert('Isi Qty dengan angka lebih dari 0.');
      daftarPesanan.value.push(buatBarisPesanan(dipilih.bahan, qty, '', dipilih.namaAlias, satuanEntryManual.value));
      qtyEntry.value = ''; namaBarangEntry.value = ''; // Suplayer SENGAJA tidak direset (terkunci); satuanEntryManual ikut ke-reset via watch(namaBarangEntry)
      // BARU (26 Agt 2026, §25.11, permintaan Guru) — fokus balik ke
      // field Qty begitu Tambah diklik, biar entry item berikutnya lebih
      // cepat (tidak perlu klik manual ke Qty lagi). nextTick supaya
      // fokus dipasang SETELAH input Qty ke-render ulang (kosong lagi).
      nextTick(() => { qtyEntryEl.value?.focus(); });
    }

    // Khusus Nota Order Belanja: klik (+) di baris Group 1 -> langsung masuk
    // tabel Daftar Pesanan Pembelian, request terkait ditandai sudah_dipesan.
    async function tambahDariPermintaan(p) {
      if (!suplayerEntry.value) return alert('Pilih Suplayer dulu (di panel "Daftar Order Belanja") sebelum menambah dari daftar ini.');
      const item = daftarBahan.value.find(b => b.id === p.bahan_aksesoris_id);
      if (!item) return alert('Data Bahan/Aksesoris sumber permintaan ini sudah tidak ditemukan (mungkin sudah dihapus).');
      daftarPesanan.value.push(buatBarisPesanan(item, p.qty, p.keterangan || ''));
      sumberPermintaanIds.value.push(p.id);
      try {
        await updateDoc(doc(db, 'persiapan_masalah', p.id), { status: 'sudah_dipesan' });
        daftarPermintaan.value = daftarPermintaan.value.filter(x => x.id !== p.id);
      } catch (e) {
        console.error('Gagal tandai Persiapan Masalah sudah dipesan:', e);
      }
    }

    function hapusTerpilih() {
      if (!adaTerpilih.value) return;
      if (!confirm('Hapus baris yang dicentang dari daftar (belum tersimpan permanen)?')) return;
      daftarPesanan.value = daftarPesanan.value.filter(i => !i.dicentang);
    }

    function formKosong() {
      draftDocId.value = null;
      noPembelianAktif.value = '';
      tanggal.value = new Date().toISOString().slice(0, 10);
      suplayerEntry.value = ''; qtyEntry.value = ''; namaBarangEntry.value = '';
      daftarPesanan.value = []; sumberPermintaanIds.value = [];
    }

    function pilihNoPembelian(idDraft) {
      if (!idDraft) { formKosong(); return; }
      const d = daftarDraft.value.find(x => x.id === idDraft);
      if (!d) return;
      draftDocId.value = d.id;
      noPembelianAktif.value = d.no_pembelian || '';
      tanggal.value = d.tanggal || new Date().toISOString().slice(0, 10);
      // BARU (25 Agt 2026, §25.2) — fallback pakai_lot_tracking/detail_lot
      // buat draft LAMA (dibuat sebelum field ini ada) supaya tetap aman
      // dibuka & tidak error di template.
      daftarPesanan.value = JSON.parse(JSON.stringify(d.items || [])).map(i => ({
        ...i, dicentang: false,
        pakai_lot_tracking: !!i.pakai_lot_tracking, detail_lot: i.detail_lot || []
      }));
      sumberPermintaanIds.value = d.sumber_permintaan_ids || [];
    }

    function batal() {
      if (daftarPesanan.value.length > 0 && !confirm('Batalkan? Data yang belum disimpan (Simpan/Pending) akan hilang.')) return;
      formKosong();
    }

    async function simpan(statusBaru) {
      if (!bolehSimpan.value) return alert('Anda tidak punya izin menyimpan di sini. Hubungi Owner/PIC.');
      if (daftarPesanan.value.length === 0) return alert('Belum ada item di Daftar Pesanan Pembelian.');
      menyimpan.value = true;
      try {
        let noPembelian = noPembelianAktif.value;
        if (!noPembelian) noPembelian = await generateNoPembelian();
        // `jumlah` di-final-kan di sini (qty*harga saat ini) — SEBELUMNYA
        // dihitung sekali waktu baris ditambah, SEKARANG dihitung ulang
        // pas simpan supaya ikut angka Harga Aktual terakhir yang diedit
        // admin (lihat catatan buatBarisPesanan()).
        const itemsFinal = daftarPesanan.value.map(({ dicentang, ...rest }) => ({
          ...rest, jumlah: Math.round((parseFloat(rest.qty) || 0) * (parseFloat(rest.harga) || 0))
        }));
        const payload = {
          no_pembelian: noPembelian,
          tanggal: tanggal.value,
          items: itemsFinal,
          estimasi_biaya_belanja: estimasiBiaya.value,
          status: statusBaru, // 'draft' (tombol Pending) atau 'final' (tombol Simpan)
          sumber_permintaan_ids: sumberPermintaanIds.value,
          dibuat_oleh: window.currentUser?.email || null,
          diupdate_pada: serverTimestamp()
        };
        if (draftDocId.value) {
          await updateDoc(doc(db, 'pesanan_pembelian', draftDocId.value), payload);
        } else {
          payload.dibuat_pada = serverTimestamp();
          const refBaru = await addDoc(collection(db, 'pesanan_pembelian'), payload);
          draftDocId.value = refBaru.id;
        }
        noPembelianAktif.value = noPembelian;
        // BARU (malam 24 Agt 2026) — begitu pesanan di-FINAL-kan (bukan
        // draft), catat tiap item jadi 1 baris Riwayat Harga Pembelian +
        // update otomatis Harga Pembelian di Data Bahan & Aksesoris
        // (aturan: tanggal terbaru, termahal per Satuan Pemakaian kalau
        // beda satuan — lihat catatRiwayatHargaDanUpdateMaster()).
        // SENGAJA di-try/catch TERPISAH — kalau ini gagal, pesanan_
        // pembelian yang SUDAH tersimpan sukses TIDAK boleh ikut dianggap
        // gagal ke Guru, cukup dicatat di Console buat ditelusuri nanti.
        //
        // DIPERBAIKI (malam 24 Agt 2026, revisi Guru) — SEBELUMNYA jalan
        // buat KEDUA mode (List & Nota), TERNYATA salah: "List Order
        // Belanja" itu ESTIMASI belanja dipakai supir + di-approve Owner
        // (harga di situ CUMA ikut apa adanya dari Data Bahan &
        // Aksesoris, lihat komentar props modeNota & template Harga di
        // bawah — read-only). Yang benar-benar jadi CATATAN PEMBELIAN
        // NYATA (harga aktual sesuai nota) cuma "Nota Order Belanja" —
        // makanya riwayat & auto-update harga SEKARANG cuma jalan kalau
        // props.modeNota true.
        if (statusBaru === 'final' && props.modeNota) {
          try {
            const lotBaruDariNota = await catatRiwayatHargaDanUpdateMaster(itemsFinal, tanggal.value, noPembelian);
            // BARU (Tahap 2) — kalau ada roll/lot baru dibuat dari Nota ini,
            // tawarkan cetak label (tombol muncul di bawah form, lihat
            // template) — TIDAK auto-cetak, biar admin yang putuskan kapan.
            if (Array.isArray(lotBaruDariNota) && lotBaruDariNota.length > 0) {
              lotUntukCetak.value = lotBaruDariNota;
            }
          } catch (e) {
            console.error('Pesanan tersimpan, TAPI gagal catat Riwayat Harga Pembelian:', e);
          }
        }
        alert(statusBaru === 'final' ? `Pesanan Pembelian ${noPembelian} tersimpan (final).` : `Disimpan sebagai draft (${noPembelian}).`);
        if (statusBaru === 'final') formKosong();
        await muatSemua();
      } catch (e) {
        console.error('Gagal simpan Pesanan Pembelian:', e);
        alert(e.message && e.message.includes('Prefix') ? e.message : 'Gagal menyimpan. Coba lagi.');
      }
      menyimpan.value = false;
    }

    // BARU (malam 24 Agt 2026) — Riwayat Harga Pembelian: 1 baris per item
    // yang benar-benar dibeli (Nota/List Order Belanja di-final-kan), lalu
    // otomatis cek ulang & update Harga Pembelian di Data Bahan & Aksesoris
    // supaya selalu ikut harga TERBARU (dan kalau ada beberapa harga di
    // tanggal yang sama, dipilih yang TERMAHAL — sengaja konservatif,
    // supaya modal/harga jual tidak ketinggalan pas harga bahan naik).
    async function catatRiwayatHargaDanUpdateMaster(items, tanggalPembelian, noPembelianRef) {
      // BARU (Tahap 2) — kumpulkan lot BARU yang dibuat (dari catatPergerakanKartuStok()
      // di bawah, param lotBaru) sepanjang loop item ini, supaya simpan() bisa
      // menawarkan "Cetak Label Roll" begitu Nota selesai di-final-kan.
      const lotDibuatSemua = [];
      for (const it of items) {
        if (!it.bahan_aksesoris_id || !(parseFloat(it.harga) > 0)) continue;
        const isiKonversi = parseFloat(it.isi_konversi) || 1;
        const hargaPerSatuanPemakaian = parseFloat(it.harga) / isiKonversi;
        try {
          await addDoc(collection(db, 'riwayat_harga_pembelian'), {
            bahan_aksesoris_id: it.bahan_aksesoris_id,
            nama_bahan: it.nama,
            tanggal: tanggalPembelian,
            satuan: it.satuan_bahan || '',
            harga: parseFloat(it.harga) || 0,
            isi_konversi: isiKonversi,
            satuan_pemakaian: it.satuan || '',
            harga_per_satuan_pemakaian: hargaPerSatuanPemakaian,
            no_pembelian: noPembelianRef,
            suplayer_nama: it.suplayer_nama || '',
            dibuat_pada: serverTimestamp(),
            dibuat_oleh: window.currentUser?.email || null
          });
          await perbaruiHargaMasterDariRiwayat(it.bahan_aksesoris_id);
        } catch (e) {
          console.error(`Gagal catat Riwayat Harga Pembelian / update master untuk "${it.nama}":`, e);
        }
        // BARU (malam 24 Agt 2026) — Kartu Stok: pembelian (Nota final)
        // JUGA dicatat sebagai 1 baris "masuk" di kartu_stok_bahan_
        // aksesoris, dalam satuan_pemakaian (qty_s, sudah dikonversi
        // waktu baris ditambah) — bukan satuan_bahan, biar stok SATU
        // satuan konsisten walau tiap pembelian bisa beda satuan beli.
        // Dibungkus try/catch TERPISAH LAGI dari riwayat harga di atas —
        // supaya kartu stok gagal tidak ikut menggagalkan riwayat harga
        // yang sudah berhasil (dan sebaliknya).
        try {
          const qtyMasuk = parseFloat(it.qty_s) || 0;
          if (qtyMasuk > 0) {
            const hasilGerak = await catatPergerakanKartuStok({
              bahanId: it.bahan_aksesoris_id, namaBahan: it.nama, tanggal: tanggalPembelian,
              jenis: 'masuk', qty: qtyMasuk, satuan: it.satuan || '',
              sumber: 'Nota Order Belanja', noPembelian: noPembelianRef, keterangan: '',
              // BARU (25 Agt 2026, §25.3) — kalau item ini pakai_lot_tracking
              // DAN sudah diisi lewat popup "Qty per Roll/Lot" (§25.2), ikut
              // buatkan dokumen lot_bahan_aksesoris (lihat catatan di
              // catatPergerakanKartuStok() di atas).
              lotBaru: (it.pakai_lot_tracking && Array.isArray(it.detail_lot) && it.detail_lot.length > 0) ? it.detail_lot : undefined
            });
            if (hasilGerak && Array.isArray(hasilGerak.lotDibuat) && hasilGerak.lotDibuat.length > 0) {
              hasilGerak.lotDibuat.forEach(l => lotDibuatSemua.push({ ...l, nama_bahan: it.nama, satuan: it.satuan || '' }));
            }
          }
        } catch (e) {
          console.error(`Gagal catat Kartu Stok (masuk) untuk "${it.nama}":`, e);
        }
      }
      return lotDibuatSemua;
    }

    // Ambil SEMUA riwayat item ini, cari tanggal PALING BARU, di antara
    // yang tanggalnya sama itu ambil yang harga-per-Satuan-Pemakaian-nya
    // PALING MAHAL (apple-to-apple meski satuan beli beda-beda tiap
    // pembelian) — lalu timpa harga_pembelian di master data (dikonversi
    // balik ke satuan pembelian item itu SEKARANG, supaya harga_modal
    // hasil bagi tetap konsisten dengan isi_konversi_pembelian yang ada).
    // GANTI (27 Agt 2026, §25.14, permintaan Guru: "misal ada 3 jenjang
    // artinya ada 3 harga dengan 3 satuan awal... ternyata ada nota
    // pembelian 1 dus jadi 1,1jt > artinya update data jg pada data
    // bahan & aksesoris"). SEBELUMNYA fungsi ini cuma menormalkan SEMUA
    // riwayat pembelian (apapun satuannya) ke 1 angka `harga_pembelian`
    // tunggal (di satuan_pembelian/tingkat teratas) — TIDAK PERNAH
    // menyentuh `konversi_bertingkat` (harga per tingkat di situ TETAP
    // beku sejak diisi manual lewat popup, walau ada pembelian nyata di
    // tingkat itu dengan harga BEDA). SEKARANG, item yang PUNYA
    // `konversi_bertingkat`: tiap TINGKAT di-cek & di-update SENDIRI
    // (harga NYATA termahal di satuan tingkat itu, kalau ada pembelian
    // baru) — supaya "1 Dus jadi Rp 1,1jt" BENERAN mengubah data Master,
    // bukan cuma tercatat di Riwayat doang. `harga_pembelian`/`harga_modal`
    // lalu dihitung ULANG dari tingkat-tingkat yang SUDAH ter-update itu,
    // pakai rumus yang SAMA dengan popup Konversi Berjenjang
    // (hitungHargaPerSatuanAkhir — PALING MAHAL di antara implikasi
    // semua tingkat, lihat §25.14 di atas). Item LAMA/1-tingkat (TANPA
    // konversi_bertingkat) TETAP pakai cara lama (normalisasi ke satuan
    // pemakaian) — TIDAK ADA yang berubah buat data lama.
    async function perbaruiHargaMasterDariRiwayat(bahanId) {
      const snap = await getDocs(query(collection(db, 'riwayat_harga_pembelian'), where('bahan_aksesoris_id', '==', bahanId)));
      const semua = []; snap.forEach(d => semua.push(d.data()));
      if (semua.length === 0) return;

      const refBahan = doc(db, 'master_bahan_aksesoris', bahanId);
      const snapBahan = await getDoc(refBahan);
      if (!snapBahan.exists()) return;
      const bahan = snapBahan.data();
      const tingkat = Array.isArray(bahan.konversi_bertingkat) ? bahan.konversi_bertingkat : [];

      // Dari SEMUA riwayat pembelian yang satuannya PERSIS `satuan` ini,
      // ambil tanggal PALING BARU, lalu di antara yang tanggalnya sama
      // ambil yang harganya (MENTAH — sudah same-satuan, apple-to-apple
      // tanpa perlu normalisasi lagi) PALING MAHAL.
      function termahalUntukSatuan(satuan) {
        const cocokSatuan = semua.filter(r => (r.satuan || '') === satuan && parseFloat(r.harga) > 0);
        if (cocokSatuan.length === 0) return null;
        const tgl = cocokSatuan.reduce((max, r) => (r.tanggal > max ? r.tanggal : max), cocokSatuan[0].tanggal);
        const kandidat = cocokSatuan.filter(r => r.tanggal === tgl);
        return kandidat.reduce((max, r) => (parseFloat(r.harga) > parseFloat(max.harga) ? r : max), kandidat[0]);
      }

      let hargaPembelianBaru, hargaModalBaru, konversiBertingkatBaru;
      if (tingkat.length > 0) {
        konversiBertingkatBaru = tingkat.map(t => {
          const t2 = termahalUntukSatuan(t.dari);
          return t2 ? { ...t, harga: parseFloat(t2.harga) } : { ...t };
        });
        // BARU — pembelian langsung di satuan dasar/pemakaian (tidak
        // lewat kemasan sama sekali, mis. beli Pcs eceran) tidak punya
        // baris tingkat sendiri, tapi TETAP ikut jadi kandidat "harga per
        // satuan akhir" (faktor konversinya = 1, sudah di satuan dasar).
        const satuanAkhir = konversiBertingkatBaru[konversiBertingkatBaru.length - 1].ke;
        const satuanAkhirTermahal = termahalUntukSatuan(satuanAkhir);
        const hargaSatuanAkhirBaru = Math.max(
          hitungHargaPerSatuanAkhir(konversiBertingkatBaru),
          satuanAkhirTermahal ? parseFloat(satuanAkhirTermahal.harga) : 0
        );
        const isiKonversiSaatIni = parseFloat(bahan.isi_konversi_pembelian) || 1;
        hargaPembelianBaru = Math.round(hargaSatuanAkhirBaru * isiKonversiSaatIni);
        hargaModalBaru = hargaSatuanAkhirBaru;
      } else {
        // Item LAMA/1-tingkat — PERSIS perilaku sebelum §25.14, TIDAK berubah.
        const tanggalTerbaru = semua.reduce((max, r) => (r.tanggal > max ? r.tanggal : max), semua[0].tanggal);
        const kandidat = semua.filter(r => r.tanggal === tanggalTerbaru);
        const termahal = kandidat.reduce((max, r) => (r.harga_per_satuan_pemakaian > max.harga_per_satuan_pemakaian ? r : max), kandidat[0]);
        const isiKonversiSaatIni = parseFloat(bahan.isi_konversi_pembelian) || 1;
        hargaPembelianBaru = Math.round(termahal.harga_per_satuan_pemakaian * isiKonversiSaatIni);
        hargaModalBaru = isiKonversiSaatIni > 0 ? hargaPembelianBaru / isiKonversiSaatIni : 0;
      }

      const marginModal = parseFloat(bahan.margin_modal) || 0;
      const payload = {
        harga_pembelian: hargaPembelianBaru,
        harga_modal: hargaModalBaru,
        margin_modal: marginModal,
        harga_pemakaian: hargaModalBaru + marginModal,
        harga_diupdate_dari_riwayat_pada: serverTimestamp()
      };
      if (konversiBertingkatBaru) payload.konversi_bertingkat = konversiBertingkatBaru;
      await updateDoc(refBahan, payload);
    }

    function cetak() {
      if (daftarPesanan.value.length === 0) return alert('Belum ada item untuk dicetak.');
      const w = window.open('', '_blank');
      if (!w) return alert('Popup diblokir browser. Izinkan popup untuk mencetak.');
      const baris = daftarPesanan.value.map((it, i) => `<tr>
        <td>${i + 1}</td><td>${it.suplayer_nama || '-'}</td><td>${it.sku || '-'}</td><td>${it.nama || '-'}</td>
        <td>${it.qty} ${it.satuan_bahan || ''}</td><td>${formatRupiah(it.harga)}</td><td>${formatRupiah((parseFloat(it.qty) || 0) * (parseFloat(it.harga) || 0))}</td><td>${it.keterangan || ''}</td>
      </tr>`).join('');
      w.document.write(`<html><head><title>${noPembelianAktif.value || 'Order Belanja'}</title>
        <style>body{font-family:Arial,sans-serif;padding:24px;color:#222;} table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px;} th,td{border:1px solid #999;padding:6px 8px;text-align:left;} th{background:#f2f2f2;} h2{margin-bottom:2px;}</style>
        </head><body>
        <h2>Nota Order Belanja ${noPembelianAktif.value || '(belum tersimpan)'}</h2>
        <p>Tanggal: ${tanggal.value}</p>
        <table><thead><tr><th>No</th><th>Suplayer</th><th>SKU</th><th>Nama Barang</th><th>Qty</th><th>Harga</th><th>Jumlah</th><th>Keterangan</th></tr></thead><tbody>${baris}</tbody></table>
        <p style="margin-top:16px;"><b>Estimasi Total: ${formatRupiah(estimasiBiaya.value)}</b></p>
        <script>window.print();<\/script>
        </body></html>`);
      w.document.close();
    }

    // cetakLabelLot — BARU (Tahap 2). 1 label per roll/lot BARU (kode_lot +
    // QR + nama/qty/tanggal), dipakai buat ditempel fisik di roll-nya
    // sendiri supaya nanti bisa di-scan pas "Catat Pemakaian" (vue-kartu-
    // stok.js).
    //
    // FIX §25.8 (Guru lapor: "cetak label roll sudah bisa tapi kode qr nya
    // ga ada") — versi SEBELUMNYA memuat library `qrcodejs` lewat
    // <script src="...cdnjs..."> DI DALAM document.write() window print
    // yang baru dibuka. Sudah dicek: URL library-nya SENDIRI valid (dites
    // via fetch langsung, isinya benar kode qrcodejs). Tapi pola "muat
    // script eksternal lewat document.write() di window kosong" itu beda
    // dari satu-satunya pola yang SUDAH terbukti jalan di app ini (jsQR,
    // yang dimuat lewat <script> biasa di index.html, BUKAN document.write
    // di popup) — dan pola document.write() begini punya beberapa cara
    // gagal nyata: (1) intervensi bawaan Chrome yang BISA membatalkan
    // eksekusi <script> lintas-domain yang disisipkan lewat document.write
    // di koneksi lambat, (2) proses internal qrcodejs mengubah canvas jadi
    // <img> lewat callback ASYNC (canvas.toDataURL -> Image.onload) yang
    // bisa saja belum selesai saat window.print() keburu jalan.
    //
    // PERBAIKAN: qrcodejs sekarang dimuat SEKALI di index.html (sama
    // seperti jsQR — lihat komentar di sana), lalu tiap kode QR digambar
    // DI WINDOW UTAMA (bukan di window print) ke sebuah <div> tersembunyi,
    // diambil hasilnya sebagai gambar base64 (canvas.toDataURL langsung
    // sesudah new QRCode(), SINKRON — tidak perlu menunggu proses async
    // internal library), baru dikirim ke window print sebagai <img> statis
    // biasa. Window print jadi tidak butuh apa pun dari internet lagi, jadi
    // tidak ada lagi race atau ketergantungan CDN pada saat mencetak.
    // `buatQrDataUrl()` sendiri DIPINDAH ke level modul (§26.3, Tahap 3,
    // lihat komentar di sana) — dipakai langsung dari closure di sini,
    // tidak perlu didefinisikan ulang.
    function cetakLabelLot(daftarLot) {
      if (!daftarLot || daftarLot.length === 0) return;
      if (typeof QRCode === 'undefined') {
        alert('Library pembuat QR belum siap dimuat. Coba refresh halaman (Ctrl+Shift+R) lalu ulangi.');
        return;
      }
      const labelsHtml = daftarLot.map((l) => {
        const qrDataUrl = buatQrDataUrl(l.kode_lot);
        const qrHtml = qrDataUrl
          ? `<img src="${qrDataUrl}" width="80" height="80" alt="QR ${l.kode_lot}" />`
          : `<div style="font-size:9px;">(QR gagal dibuat)</div>`;
        return `
        <div class="label">
          <div class="qr">${qrHtml}</div>
          <div class="teks">
            <div class="kode">${l.kode_lot}</div>
            <div class="nama">${l.nama_bahan || ''}</div>
            <div class="info">${l.qty} ${l.satuan || ''} &middot; ${l.tanggal_masuk || ''}</div>
          </div>
        </div>`;
      }).join('');
      const w = window.open('', '_blank');
      if (!w) return alert('Popup diblokir browser. Izinkan popup untuk mencetak label.');
      w.document.write(`<html><head><title>Label Roll/Lot</title>
        <style>
          body{font-family:Arial,sans-serif; margin:0; padding:12px;}
          .label{display:inline-flex; align-items:center; gap:10px; border:1px dashed #999; border-radius:6px; padding:8px 12px; margin:4px; width:280px; box-sizing:border-box; page-break-inside:avoid; vertical-align:top;}
          .qr{width:80px; height:80px; flex-shrink:0; display:flex; align-items:center; justify-content:center;}
          .qr img{width:80px; height:80px; display:block;}
          .teks{font-size:11px; line-height:1.4;}
          .kode{font-weight:700; font-size:13px;}
          .nama{font-size:11px;}
          .info{font-size:10px; color:#555;}
        </style>
        </head><body>
        ${labelsHtml}
        <script>
          window.onload = function() { setTimeout(function () { window.print(); }, 300); };
        <\/script>
        </body></html>`);
      w.document.close();
    }

    onMounted(async () => { await window.authReady; muatSemua(); });
    return {
      daftarPermintaan, daftarDraft, memuat, tampilPengaturan, labelGroup1,
      draftDocId, noPembelianAktif, tanggal, suplayerEntry, qtyEntry, namaBarangEntry,
      daftarPesanan, menyimpan, bolehSimpan, bolehHapus, opsiSuplayer, opsiNamaBarang,
      estimasiBiaya, adaTerpilih, formatRupiah,
      tambahItemManual, tambahDariPermintaan, hapusTerpilih, pilihNoPembelian, batal, simpan, cetak,
      // BARU (25 Agt 2026, §25.2) — Popup Qty per Roll/Lot.
      tampilPopupLot, barisLotSementara, totalQtyLot, barisLotTarget, barisLotSatuan, barisLotNama,
      bukaPopupLot, tutupPopupLot, tambahBarisLot, hapusBarisLot, terapkanLot,
      // BARU (Tahap 2) — Cetak Label Roll.
      lotUntukCetak, cetakLabelLot,
      // BARU (26 Agt 2026, §25.11) — revisi posisi field + kunci Suplayer
      // Nota + fokus otomatis ke Qty + tampilan Satuan read-only entry.
      satuanEntryManual, opsiSatuanEntry, suplayerTerkunci, qtyEntryEl,
      // BARU (27 Agt 2026, §26.1) — shortcut "+" tambah Suplayer cepat.
      tampilTambahSuplayer, onSuplayerBaruTersimpan
    };
  },
  template: `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
        <h3 style="font-weight:700; font-size:16px;"><i class="fas fa-cart-shopping" style="color:var(--burgundy); margin-right:8px;"></i>{{ modeNota ? 'Nota Order Belanja' : 'List Order Belanja' }}</h3>
        <button @click="tampilPengaturan = true" class="icon-btn" title="Pengaturan"><i class="fas fa-gear"></i></button>
      </div>

      <div v-if="memuat" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <template v-else>
        <!-- Group 1: Daftar Permintaan/Pesanan Bahan & Aksesoris (referensi dari Persiapan Masalah) -->
        <div class="gc-card" style="padding:14px; margin-bottom:14px;">
          <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">{{ labelGroup1 }} ({{ daftarPermintaan.length }})</label>
          <div v-if="daftarPermintaan.length === 0" style="font-size:11.5px; color:var(--text-faint);">Tidak ada permintaan menunggu (lihat menu Persiapan Masalah).</div>
          <div v-else style="overflow-x:auto;">
            <table class="gc-table" style="width:100%; font-size:12px;">
              <thead><tr><th>Nama</th><th>Qty</th><th>Satuan</th><th>Keterangan</th><th v-if="modeNota"></th></tr></thead>
              <tbody>
                <tr v-for="p in daftarPermintaan" :key="p.id">
                  <td>{{ p.nama_bahan }}</td><td>{{ p.qty }}</td><td>{{ p.satuan }}</td><td style="color:var(--text-muted);">{{ p.keterangan || '-' }}</td>
                  <td v-if="modeNota"><button @click="tambahDariPermintaan(p)" class="icon-btn" style="color:var(--burgundy);" title="Tambah ke Daftar Order Belanja"><i class="fas fa-circle-plus"></i></button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Group 2: Daftar Order Belanja (entry + tabel Daftar Pesanan Pembelian) -->
        <div class="gc-card" style="padding:14px;">
          <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Daftar Order Belanja</label>

          <!-- REVISI (26 Agt 2026, §25.11, permintaan Guru) — baris 1 SEKARANG
               No. Pembelian, Tanggal, Suplayer (3 grid) KHUSUS Nota — Suplayer
               dipindah ke sini dari baris entry di bawah, karena "1 nota = 1
               suplayer" (lihat suplayerTerkunci). List Order Belanja TETAP
               boleh multi-Suplayer per dokumen (field per-baris di bawah,
               TIDAK berubah) — jadi kolom Suplayer di baris 1 ini DIHILANGKAN
               khusus List (v-else, 2 grid saja). -->
          <div v-if="modeNota" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:14px;">
            <div class="gc-field" style="margin-bottom:0;">
              <label>No. Pembelian</label>
              <select :value="draftDocId" @change="pilihNoPembelian($event.target.value)" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
                <option value="">+ Buat Baru{{ noPembelianAktif && !draftDocId ? '' : '' }}</option>
                <option v-for="d in daftarDraft" :key="d.id" :value="d.id">{{ d.no_pembelian }} (draft)</option>
              </select>
              <p v-if="noPembelianAktif" style="font-size:10px; color:var(--text-faint); margin-top:4px;">Nomor aktif: <b>{{ noPembelianAktif }}</b></p>
            </div>
            <div class="gc-field" style="margin-bottom:0;"><label>Tanggal</label><input v-model="tanggal" type="date" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;"></div>
            <div class="gc-field" style="margin-bottom:0;">
              <label>Suplayer{{ suplayerTerkunci ? ' (terkunci — 1 Nota = 1 Suplayer)' : '' }}</label>
              <div style="display:flex; gap:6px;">
                <dropdown-cari v-model="suplayerEntry" :opsi="opsiSuplayer" :disabled="suplayerTerkunci" placeholder="Pilih Suplayer..." />
                <button v-if="!suplayerTerkunci" @click="tampilTambahSuplayer = true" type="button" class="icon-btn" style="flex-shrink:0;" title="Tambah Suplayer baru"><i class="fas fa-plus"></i></button>
              </div>
            </div>
          </div>
          <div v-else style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
            <div class="gc-field" style="margin-bottom:0;">
              <label>No. Pembelian</label>
              <select :value="draftDocId" @change="pilihNoPembelian($event.target.value)" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
                <option value="">+ Buat Baru{{ noPembelianAktif && !draftDocId ? '' : '' }}</option>
                <option v-for="d in daftarDraft" :key="d.id" :value="d.id">{{ d.no_pembelian }} (draft)</option>
              </select>
              <p v-if="noPembelianAktif" style="font-size:10px; color:var(--text-faint); margin-top:4px;">Nomor aktif: <b>{{ noPembelianAktif }}</b></p>
            </div>
            <div class="gc-field" style="margin-bottom:0;"><label>Tanggal</label><input v-model="tanggal" type="date" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;"></div>
          </div>

          <!-- REVISI (26 Agt 2026, §25.11) — Estimasi Biaya Belanja SEKARANG
               baris sendiri (bukan lagi 1 dari 3 kolom grid), ukuran field
               diperbesar ~1.5x (font-size & padding) sesuai permintaan Guru. -->
          <div class="gc-field" style="margin-bottom:14px;">
            <label>Estimasi Biaya Belanja</label>
            <div style="padding:14px 18px; background:var(--ivory-dim); border-radius:15px; font-weight:700; font-size:19px; color:var(--burgundy);">{{ formatRupiah(estimasiBiaya) }}</div>
          </div>

          <!-- REVISI (26 Agt 2026, §25.11) — baris entry SEKARANG Qty, Satuan
               (BARU, read-only — ikut item yang dipilih di Nama Barang),
               Nama Barang, Tambah — Suplayer DIPINDAH ke baris 1 di atas
               KHUSUS Nota (lihat catatan di atas); List TETAP punya field
               Suplayer di sini (per-baris, TIDAK berubah dari sebelumnya). -->
          <div v-if="modeNota" style="display:grid; grid-template-columns:100px 100px 1fr auto; gap:8px; align-items:end; margin-bottom:16px;">
            <div class="gc-field" style="margin-bottom:0;"><label>Qty</label><input ref="qtyEntryEl" v-model.number="qtyEntry" type="number" min="0" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Satuan</label><dropdown-cari v-model="satuanEntryManual" :opsi="opsiSatuanEntry" :disabled="opsiSatuanEntry.length === 0" placeholder="Satuan..." /></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Nama Barang</label><dropdown-cari v-model="namaBarangEntry" :opsi="opsiNamaBarang" placeholder="Cari & pilih..." /></div>
            <button @click="tambahItemManual" class="btn-primary" style="padding:0 18px; height:38px;"><i class="fas fa-plus" style="margin-right:5px;"></i>Tambah</button>
          </div>
          <div v-else style="display:grid; grid-template-columns:1fr 100px 100px 1fr auto; gap:8px; align-items:end; margin-bottom:16px;">
            <div class="gc-field" style="margin-bottom:0;">
              <label>Suplayer</label>
              <div style="display:flex; gap:6px;">
                <dropdown-cari v-model="suplayerEntry" :opsi="opsiSuplayer" placeholder="Pilih Suplayer..." />
                <button @click="tampilTambahSuplayer = true" type="button" class="icon-btn" style="flex-shrink:0;" title="Tambah Suplayer baru"><i class="fas fa-plus"></i></button>
              </div>
            </div>
            <div class="gc-field" style="margin-bottom:0;"><label>Qty</label><input ref="qtyEntryEl" v-model.number="qtyEntry" type="number" min="0" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Satuan</label><dropdown-cari v-model="satuanEntryManual" :opsi="opsiSatuanEntry" :disabled="opsiSatuanEntry.length === 0" placeholder="Satuan..." /></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Nama Barang</label><dropdown-cari v-model="namaBarangEntry" :opsi="opsiNamaBarang" placeholder="Cari & pilih..." /></div>
            <button @click="tambahItemManual" class="btn-primary" style="padding:0 18px; height:38px;"><i class="fas fa-plus" style="margin-right:5px;"></i>Tambah</button>
          </div>

          <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Daftar Pesanan Pembelian ({{ daftarPesanan.length }})</label>
          <div v-if="daftarPesanan.length === 0" style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Belum ada item.</div>
          <!-- REVISI (26 Agt 2026, §25.11) — urutan kolom tabel sesuai
               permintaan Guru: Aksi(qty per lot), Checkbox, No, Suplayer
               (List saja — Nota hilangkan, karena sudah 1 Suplayer di
               header), ID Bahan & Aksesoris (rename dari "SKU", isinya
               SEKARANG id_tampil bukan ID dokumen mentah — lihat
               buatBarisPesanan()), Qty Beli, Satuan Beli, Qty Pakai,
               Satuan Pakai, Nama Alias (BARU), Nama Barang, Harga, Jumlah,
               Keterangan. -->
          <div v-else style="overflow-x:auto; margin-bottom:14px;">
            <table class="gc-table" style="width:100%; font-size:11.5px;">
              <thead><tr>
                <th title="Qty per Roll/Lot"><i class="fas fa-layer-group"></i></th>
                <th><i class="fas fa-square-check"></i></th><th>No</th><th v-if="!modeNota">Suplayer</th><th>ID Bahan &amp; Aksesoris</th>
                <th>Qty Beli</th><th>Satuan Beli</th><th>Qty Pakai</th><th>Satuan Pakai</th><th>Nama Alias</th><th>Nama Barang</th><th>Harga</th><th>Jumlah</th><th>Keterangan</th>
              </tr></thead>
              <tbody>
                <tr v-for="(it, i) in daftarPesanan" :key="i">
                  <td>
                    <button v-if="it.pakai_lot_tracking" @click="bukaPopupLot(i)" class="icon-btn"
                      :style="{color: (it.detail_lot && it.detail_lot.length) ? 'var(--burgundy)' : 'var(--text-faint)'}"
                      :title="(it.detail_lot && it.detail_lot.length) ? ('Qty per Roll/Lot: ' + it.detail_lot.length + ' lot terisi') : 'Isi Qty per Roll/Lot'">
                      <i class="fas fa-layer-group"></i>
                    </button>
                    <span v-else style="color:var(--text-faint); font-size:11px;" title="Item ini tidak ditandai perlu Qty per Roll/Lot (atur di Data Bahan & Aksesoris)">-</span>
                  </td>
                  <td><input type="checkbox" v-model="it.dicentang" style="accent-color:var(--burgundy);"></td>
                  <td>{{ i + 1 }}</td><td v-if="!modeNota">{{ it.suplayer_nama }}</td><td>{{ it.sku }}</td>
                  <td>{{ it.qty }}</td><td>{{ it.satuan_bahan }}</td><td>{{ it.qty_s }}</td><td>{{ it.satuan }}</td>
                  <td style="color:var(--text-muted);">{{ it.nama_alias || '-' }}</td><td>{{ it.nama }}</td>
                  <td>
                    <input v-if="modeNota" v-model.number="it.harga" type="number" min="0" style="width:90px; padding:4px 6px; border:1px solid var(--line); border-radius:6px; font-size:11px;">
                    <span v-else :title="'Ikut Data Bahan & Aksesoris — List Order Belanja cuma estimasi, harga tidak bisa diedit di sini'">{{ formatRupiah(it.harga) }}</span>
                  </td>
                  <td>{{ formatRupiah((parseFloat(it.qty)||0) * (parseFloat(it.harga)||0)) }}</td>
                  <td><input v-model="it.keterangan" type="text" style="width:100%; padding:4px 6px; border:1px solid var(--line); border-radius:6px; font-size:11px;"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button @click="simpan('final')" :disabled="menyimpan" class="btn-primary" style="flex:1; min-width:110px;">{{ menyimpan ? 'Menyimpan...' : 'Simpan' }}</button>
            <button @click="batal" class="btn-outline" style="flex:1; min-width:90px;">Batal</button>
            <button v-if="bolehHapus" @click="hapusTerpilih" :disabled="!adaTerpilih" class="btn-outline" style="flex:1; min-width:90px; color:var(--danger); border-color:var(--danger);">Hapus Terpilih</button>
            <button @click="cetak" class="btn-outline" style="flex:1; min-width:90px;">Cetak</button>
            <button @click="simpan('draft')" :disabled="menyimpan" class="btn-outline" style="flex:1; min-width:90px;">Pending</button>
          </div>

          <!-- BARU (Tahap 2) — muncul begitu Nota di-final-kan DAN ada
               roll/lot baru dibuat (item pakai_lot_tracking + detail_lot
               terisi). TIDAK auto-cetak, admin yang putuskan kapan cetak
               (mis. sekalian tempel labelnya ke roll fisiknya). -->
          <div v-if="modeNota && lotUntukCetak.length > 0" style="margin-top:12px; background:var(--ivory-dim); border-radius:10px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <span style="font-size:12px;"><i class="fas fa-tags" style="color:var(--burgundy); margin-right:6px;"></i>{{ lotUntukCetak.length }} roll/lot baru dibuat dari Nota ini — cetak labelnya (QR) untuk ditempel ke roll fisiknya.</span>
            <button @click="cetakLabelLot(lotUntukCetak)" class="btn-primary" style="padding:8px 16px; font-size:12px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Label Roll</button>
          </div>
        </div>
      </template>
      <pengaturan-stock-pembelian v-if="tampilPengaturan" @tutup="tampilPengaturan = false" />
      <popup-qty-per-lot v-if="tampilPopupLot" :baris="barisLotSementara" :total="totalQtyLot" :target="barisLotTarget" :satuan="barisLotSatuan" :nama-barang="barisLotNama"
        @tambah="tambahBarisLot" @hapus="hapusBarisLot" @terapkan="terapkanLot" @tutup="tutupPopupLot" />
      <popup-tambah-suplayer-cepat v-if="tampilTambahSuplayer" @tersimpan="onSuplayerBaruTersimpan" @tutup="tampilTambahSuplayer = false" />
    </div>
  `
};

// ---------------------------------------------------------------------------
// RiwayatHargaPembelianManager — menu "Riwayat Harga Pembelian" (BARU, malam
// 24 Agt 2026). Tabel READ-ONLY, cursor-based paginasi (WAJIB sesuai
// PRINSIP-HEMAT.md), diisi otomatis oleh catatRiwayatHargaDanUpdateMaster()
// tiap kali Nota/List Order Belanja di-final-kan. Cari berdasarkan nama
// bahan (awalan), urut tanggal terbaru dulu.
// ---------------------------------------------------------------------------
const RiwayatHargaPembelianManager = {
  setup() {
    const paginasi = usePaginasiFirestore(db, 'riwayat_harga_pembelian', {
      perHalaman: 15,
      urutkanField: 'tanggal',
      urutkanArah: 'desc',
      cariField: 'nama_bahan',
      petakan: (id, d) => ({ id, ...d })
    });
    onMounted(async () => { await window.authReady; await paginasi.muatUlang(); });
    return { paginasi, formatRupiah };
  },
  template: `
    <div class="gc-card" style="padding:14px;">
      <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Riwayat Harga Pembelian</label>
      <p style="font-size:11px; color:var(--text-faint); margin-bottom:12px;">Tercatat otomatis tiap kali Nota / List Order Belanja di-final-kan. Harga Pembelian di Data Bahan &amp; Aksesoris otomatis mengikuti baris dengan tanggal PALING BARU (kalau ada beberapa di tanggal sama, yang PALING MAHAL per Satuan Pemakaian).</p>

      <div style="position:relative; max-width:320px; margin-bottom:12px;">
        <i class="fas fa-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-faint); font-size:12px;"></i>
        <input :value="paginasi.cariTeks.value" @input="paginasi.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari nama bahan (awalan)..." style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
      </div>

      <div v-if="paginasi.memuat.value" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="paginasi.errorPaginasi.value" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasi.errorPaginasi.value }}</div>
      <div v-else-if="paginasi.dataHalaman.value.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada riwayat pembelian.</div>
      <div v-else style="overflow-x:auto;">
        <table class="gc-table" style="width:100%; font-size:11.5px;">
          <thead><tr>
            <th>Tanggal</th><th>Nama Bahan</th><th>Suplayer</th><th>Satuan Beli</th><th>Harga</th><th>Isi Konversi</th><th>Satuan Pemakaian</th><th>Harga / Satuan Pemakaian</th><th>No. Pembelian</th>
          </tr></thead>
          <tbody>
            <tr v-for="r in paginasi.dataHalaman.value" :key="r.id">
              <td>{{ r.tanggal }}</td><td>{{ r.nama_bahan }}</td><td>{{ r.suplayer_nama || '-' }}</td>
              <td>{{ r.satuan }}</td><td>{{ formatRupiah(r.harga) }}</td><td>{{ r.isi_konversi }}</td>
              <td>{{ r.satuan_pemakaian }}</td><td style="color:var(--burgundy); font-weight:700;">{{ formatRupiah(r.harga_per_satuan_pemakaian) }}</td>
              <td>{{ r.no_pembelian || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!paginasi.memuat.value && paginasi.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
        <button class="icon-btn" :disabled="paginasi.nomorHalaman.value <= 1" @click="paginasi.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
        <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasi.nomorHalaman.value }}</span>
        <button class="icon-btn" :disabled="!paginasi.adaBerikutnya.value" @click="paginasi.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// CetakLabelManager — menu "Cetak Label" (BARU, 27 Agt 2026, §26.3,
// Tahap 3). Cari 1 item Bahan/Aksesoris (dropdown-cari) lalu cetak label
// fisik (QR + teks) buat ditempel:
//   - Item `pakai_lot_tracking` (qty roll): tampilkan tabel checkbox
//     SEMUA roll/lot-nya (AKTIF *dan* SUDAH HABIS — Guru eksplisit: biar
//     bisa cetak ULANG label yang hilang fisik walau datanya sudah habis
//     di sistem), centang 1/lebih lalu cetak — 1 label per kode_lot,
//     PERSIS format `cetakLabelLot()` di OrderBelanjaScreen di atas.
//   - Item BUKAN lot (checkbox di sini SENGAJA tidak dimunculkan sama
//     sekali, bukan cuma disabled — Guru: "kalau yg tidak qty roll maka
//     dropdown cari checkbox jangan aktif"): cetak 1 label ITEM (bukan
//     roll), QR isinya `id_tampil` — barang jenis ini SEBELUMNYA TIDAK
//     PERNAH punya kode/QR sama sekali (prasyarat yang disepakati di
//     §26.0 poin 6), jadi ini QR PERTAMA buat item non-lot, dipakai nanti
//     buat discan di Scan Opname/Scan Persiapan (§26, Tahap 4/5).
// Tiap kali tombol Cetak ditekan, 1 baris log ditulis ke koleksi BARU
// `log_cetak_label` (tanggal, nama barang, jumlah label, jenis, dicetak
// oleh) — Guru KONFIRMASI oke pakai koleksi baru (§26.0 poin 4). Riwayat
// log ditampilkan sebagai tabel READ-ONLY paginasi di bawah form (pola
// sama seperti RiwayatHargaPembelianManager di atas).
// ---------------------------------------------------------------------------
const MENU_ID_CETAK_LABEL = 'stock_cetak_label';
// ambilSemuaLotByBahan — BEDA dari `ambilLotAktif()` (export di atas,
// dipakai Kartu Stok) yang CUMA ambil status:'aktif'. Di sini SENGAJA
// ambil SEMUA status (aktif + habis) karena tujuannya reprint label fisik
// yang hilang, termasuk buat roll yang datanya sudah habis di sistem.
// TIDAK diekspor — cuma dipakai di komponen ini, tidak ada file lain yang
// butuh varian "semua status" ini.
async function ambilSemuaLotByBahan(bahanId) {
  const snap = await getDocs(query(collection(db, 'lot_bahan_aksesoris'), where('bahan_aksesoris_id', '==', bahanId)));
  const lots = []; snap.forEach(d => lots.push({ id: d.id, ...d.data() }));
  lots.sort((a, b) => (b.tanggal_masuk || '').localeCompare(a.tanggal_masuk || '') || ((b.dibuat_pada?.seconds || 0) - (a.dibuat_pada?.seconds || 0)));
  return lots;
}
function formatTanggalLog(ts) {
  if (ts && typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toLocaleString('id-ID');
  return '-';
}
const CetakLabelManager = {
  components: { DropdownCari },
  setup() {
    const daftarBahan = ref([]);
    const bahanEntry = ref('');
    const memuatDaftarBahan = ref(false);
    const opsiBahanMap = computed(() => {
      const map = new Map();
      daftarBahan.value.forEach(b => {
        const label = formatNamaBahan(b) + (b.id_tampil ? ` (${b.id_tampil})` : '');
        map.set(label, b);
      });
      return map;
    });
    const opsiBahanNama = computed(() => Array.from(opsiBahanMap.value.keys()));
    const bahanTerpilih = computed(() => opsiBahanMap.value.get(bahanEntry.value) || null);

    const daftarLot = ref([]);
    const memuatLot = ref(false);
    const lotDicentang = reactive({});
    async function muatUlangLot() {
      lotDicentang && Object.keys(lotDicentang).forEach(k => delete lotDicentang[k]);
      if (!bahanTerpilih.value || !bahanTerpilih.value.pakai_lot_tracking) { daftarLot.value = []; return; }
      memuatLot.value = true;
      try { daftarLot.value = await ambilSemuaLotByBahan(bahanTerpilih.value.id); }
      catch (e) { console.error('Gagal ambil daftar lot:', e); daftarLot.value = []; }
      memuatLot.value = false;
    }
    watch(bahanEntry, muatUlangLot);
    const lotTercentang = computed(() => daftarLot.value.filter(l => lotDicentang[l.id]));
    function toggleSemuaLot(v) { daftarLot.value.forEach(l => { lotDicentang[l.id] = v; }); }

    const menuId = MENU_ID_CETAK_LABEL;
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);
    const mencetak = ref(false);

    const paginasiLog = usePaginasiFirestore(db, 'log_cetak_label', {
      perHalaman: 10, urutkanField: 'tanggal', urutkanArah: 'desc', cariField: 'nama_barang',
      petakan: (id, d) => ({ id, ...d })
    });

    async function catatLog(namaBarang, jumlah, jenis) {
      try {
        await addDoc(collection(db, 'log_cetak_label'), {
          tanggal: serverTimestamp(), nama_barang: namaBarang, jumlah_label: jumlah, jenis,
          dicetak_oleh: window.currentUser?.email || null
        });
        await paginasiLog.muatUlang();
      } catch (e) { console.error('Gagal catat log Cetak Label:', e); }
    }

    async function cetak() {
      if (!bahanTerpilih.value) return alert('Cari & pilih Bahan/Aksesoris dulu.');
      if (typeof QRCode === 'undefined') {
        alert('Library pembuat QR belum siap dimuat. Coba refresh halaman (Ctrl+Shift+R) lalu ulangi.');
        return;
      }
      const b = bahanTerpilih.value;
      let daftarCetak = [];
      let jenis = '';
      if (b.pakai_lot_tracking) {
        if (lotTercentang.value.length === 0) return alert('Centang minimal 1 roll/lot yang mau dicetak labelnya dulu.');
        jenis = 'roll';
        daftarCetak = lotTercentang.value.map(l => ({
          kode: l.kode_lot,
          nama: formatNamaBahan(b),
          info: `${l.qty ?? ''} ${b.satuan_pemakaian || ''} &middot; ${l.tanggal_masuk || ''}${l.status !== 'aktif' ? ' &middot; SUDAH HABIS (cetak ulang)' : ''}`
        }));
      } else {
        if (!b.id_tampil) return alert('Item ini belum punya ID Tampil (id_tampil kosong) — cek ulang data Bahan/Aksesorisnya.');
        jenis = 'item';
        daftarCetak = [{
          kode: b.id_tampil,
          nama: formatNamaBahan(b),
          info: b.satuan_pemakaian || ''
        }];
      }
      mencetak.value = true;
      try {
        const labelsHtml = daftarCetak.map(l => {
          const qrDataUrl = buatQrDataUrl(l.kode);
          const qrHtml = qrDataUrl
            ? `<img src="${qrDataUrl}" width="80" height="80" alt="QR ${l.kode}" />`
            : `<div style="font-size:9px;">(QR gagal dibuat)</div>`;
          return `
          <div class="label">
            <div class="qr">${qrHtml}</div>
            <div class="teks">
              <div class="kode">${l.kode}</div>
              <div class="nama">${l.nama}</div>
              <div class="info">${l.info}</div>
            </div>
          </div>`;
        }).join('');
        const w = window.open('', '_blank');
        if (!w) { alert('Popup diblokir browser. Izinkan popup untuk mencetak label.'); return; }
        w.document.write(`<html><head><title>Label ${jenis === 'roll' ? 'Roll/Lot' : 'Barang'}</title>
          <style>
            body{font-family:Arial,sans-serif; margin:0; padding:12px;}
            .label{display:inline-flex; align-items:center; gap:10px; border:1px dashed #999; border-radius:6px; padding:8px 12px; margin:4px; width:280px; box-sizing:border-box; page-break-inside:avoid; vertical-align:top;}
            .qr{width:80px; height:80px; flex-shrink:0; display:flex; align-items:center; justify-content:center;}
            .qr img{width:80px; height:80px; display:block;}
            .teks{font-size:11px; line-height:1.4;}
            .kode{font-weight:700; font-size:13px;}
            .nama{font-size:11px;}
            .info{font-size:10px; color:#555;}
          </style>
          </head><body>
          ${labelsHtml}
          <script>
            window.onload = function() { setTimeout(function () { window.print(); }, 300); };
          <\/script>
          </body></html>`);
        w.document.close();
        await catatLog(formatNamaBahan(b), daftarCetak.length, jenis);
      } finally {
        mencetak.value = false;
      }
    }

    onMounted(async () => {
      await window.authReady;
      memuatDaftarBahan.value = true;
      daftarBahan.value = await ambilDaftarBahanAksesorisLengkap();
      memuatDaftarBahan.value = false;
      await paginasiLog.muatUlang();
    });

    return {
      daftarBahan, bahanEntry, memuatDaftarBahan, opsiBahanNama, bahanTerpilih,
      daftarLot, memuatLot, lotDicentang, lotTercentang, toggleSemuaLot,
      bolehCetak, mencetak, cetak, paginasiLog, formatTanggalLog
    };
  },
  template: `
    <div class="gc-card" style="padding:14px; margin-bottom:14px;">
      <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Cetak Label</label>
      <p style="font-size:11px; color:var(--text-faint); margin-bottom:12px;">Cari Bahan/Aksesoris, lalu cetak ulang label fisiknya (QR). Untuk item dengan Qty per Roll/Lot, pilih dulu roll mana yang mau dicetak (bisa lebih dari 1, termasuk roll yang datanya sudah habis kalau labelnya hilang). Untuk item biasa, langsung cetak 1 label per item.</p>

      <div class="gc-field" style="max-width:420px; margin-bottom:14px;">
        <label>Bahan / Aksesoris</label>
        <dropdown-cari v-model="bahanEntry" :opsi="opsiBahanNama" placeholder="Cari nama barang..." />
      </div>

      <div v-if="bahanTerpilih">
        <div v-if="bahanTerpilih.pakai_lot_tracking">
          <div v-if="memuatLot" style="font-size:12px; color:var(--text-faint); padding:8px 0;">Memuat daftar roll/lot...</div>
          <div v-else-if="daftarLot.length === 0" style="font-size:12px; color:var(--text-faint); padding:8px 0;">Belum ada roll/lot tercatat untuk item ini.</div>
          <div v-else style="overflow-x:auto; margin-bottom:12px;">
            <div style="margin-bottom:6px;">
              <button @click="toggleSemuaLot(true)" class="btn-outline" style="padding:4px 10px; font-size:11px; margin-right:6px;">Pilih Semua</button>
              <button @click="toggleSemuaLot(false)" class="btn-outline" style="padding:4px 10px; font-size:11px;">Kosongkan</button>
            </div>
            <table class="gc-table" style="width:100%; font-size:11.5px;">
              <thead><tr><th style="width:32px;"></th><th>Kode Lot</th><th>Qty Sisa</th><th>Tanggal Masuk</th><th>Status</th></tr></thead>
              <tbody>
                <tr v-for="l in daftarLot" :key="l.id">
                  <td><input type="checkbox" v-model="lotDicentang[l.id]" style="accent-color:var(--burgundy); width:14px; height:14px;"></td>
                  <td>{{ l.kode_lot }}</td>
                  <td>{{ l.qty_sisa ?? l.qty ?? '-' }}</td>
                  <td>{{ l.tanggal_masuk || '-' }}</td>
                  <td><span class="tag" :class="l.status === 'aktif' ? 'ok' : 'neutral'">{{ l.status === 'aktif' ? 'Aktif' : 'Habis' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p v-else style="font-size:11.5px; color:var(--text-faint); margin-bottom:12px;"><i class="fas fa-info-circle" style="margin-right:4px;"></i>Item ini bukan item Qty per Roll/Lot — cetak 1 label untuk item ini (kode: {{ bahanTerpilih.id_tampil || '-' }}).</p>

        <button v-if="bolehCetak" @click="cetak" :disabled="mencetak" class="btn-primary" style="padding:9px 18px; font-size:12.5px;"><i class="fas fa-print" style="margin-right:6px;"></i>{{ mencetak ? 'Mencetak...' : 'Cetak Label' }}</button>
        <p v-else style="font-size:11.5px; color:var(--text-faint);">Akun ini tidak punya izin cetak untuk menu ini.</p>
      </div>
    </div>

    <div class="gc-card" style="padding:14px;">
      <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Riwayat Cetak Label</label>

      <div style="position:relative; max-width:320px; margin-bottom:12px;">
        <i class="fas fa-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-faint); font-size:12px;"></i>
        <input :value="paginasiLog.cariTeks.value" @input="paginasiLog.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari nama barang (awalan)..." style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
      </div>

      <div v-if="paginasiLog.memuat.value" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="paginasiLog.errorPaginasi.value" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasiLog.errorPaginasi.value }}</div>
      <div v-else-if="paginasiLog.dataHalaman.value.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada riwayat cetak label.</div>
      <div v-else style="overflow-x:auto;">
        <table class="gc-table" style="width:100%; font-size:11.5px;">
          <thead><tr><th>Tanggal</th><th>Nama Barang</th><th>Jumlah Label</th><th>Jenis</th><th>Dicetak Oleh</th></tr></thead>
          <tbody>
            <tr v-for="r in paginasiLog.dataHalaman.value" :key="r.id">
              <td>{{ formatTanggalLog(r.tanggal) }}</td>
              <td>{{ r.nama_barang }}</td>
              <td>{{ r.jumlah_label }}</td>
              <td>{{ r.jenis === 'roll' ? 'Roll/Lot' : 'Item' }}</td>
              <td>{{ r.dicetak_oleh || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!paginasiLog.memuat.value && paginasiLog.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
        <button class="icon-btn" :disabled="paginasiLog.nomorHalaman.value <= 1" @click="paginasiLog.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
        <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasiLog.nomorHalaman.value }}</span>
        <button class="icon-btn" :disabled="!paginasiLog.adaBerikutnya.value" @click="paginasiLog.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// Mount functions — 1 per sub-menu (pola sama seperti file Zevanic House lain)
// ---------------------------------------------------------------------------
const AppAliasPembelian = { components: { AliasPembelianManager }, template: `<alias-pembelian-manager />` };
let vmAliasPembelian = null;
window.pastikanMountAliasPembelian = function() {
  if (vmAliasPembelian) return;
  const mountPoint = document.getElementById('vue-alias-pembelian');
  if (mountPoint) vmAliasPembelian = createApp(AppAliasPembelian).mount('#vue-alias-pembelian');
};

const AppListOrderBelanja = { components: { OrderBelanjaScreen }, template: `<order-belanja-screen :mode-nota="false" />` };
let vmListOrderBelanja = null;
window.pastikanMountListOrderBelanja = function() {
  if (vmListOrderBelanja) return;
  const mountPoint = document.getElementById('vue-list-order-belanja');
  if (mountPoint) vmListOrderBelanja = createApp(AppListOrderBelanja).mount('#vue-list-order-belanja');
};

const AppNotaOrderBelanja = { components: { OrderBelanjaScreen }, template: `<order-belanja-screen :mode-nota="true" />` };
let vmNotaOrderBelanja = null;
window.pastikanMountNotaOrderBelanja = function() {
  if (vmNotaOrderBelanja) return;
  const mountPoint = document.getElementById('vue-nota-order-belanja');
  if (mountPoint) vmNotaOrderBelanja = createApp(AppNotaOrderBelanja).mount('#vue-nota-order-belanja');
};

const AppRiwayatHargaPembelian = { components: { RiwayatHargaPembelianManager }, template: `<riwayat-harga-pembelian-manager />` };
let vmRiwayatHargaPembelian = null;
window.pastikanMountRiwayatHargaPembelian = function() {
  if (vmRiwayatHargaPembelian) return;
  const mountPoint = document.getElementById('vue-riwayat-harga-pembelian');
  if (mountPoint) vmRiwayatHargaPembelian = createApp(AppRiwayatHargaPembelian).mount('#vue-riwayat-harga-pembelian');
};

// BARU (27 Agt 2026, §26.3, Tahap 3) — Cetak Label.
const AppCetakLabel = { components: { CetakLabelManager }, template: `<cetak-label-manager />` };
let vmCetakLabel = null;
window.pastikanMountCetakLabel = function() {
  if (vmCetakLabel) return;
  const mountPoint = document.getElementById('vue-cetak-label');
  if (mountPoint) vmCetakLabel = createApp(AppCetakLabel).mount('#vue-cetak-label');
};
