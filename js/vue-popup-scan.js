// js/vue-popup-scan.js
// Bottom Sheet Picker "Mau scan apa?" — tombol QR navbar mobile. targetId =
// id CHILD TAB (mis. 'sub-pp-bahan-perludisiapkan'), 1 tab = 1 pengaturan
// sendiri — tiap tab beda tombol, tidak diseragamkan satu modul. Kandidat
// checkbox tiap child tetap SEMUA aksi milik modulnya (bebas nyalakan aksi
// apapun di tab manapun). Dipakai layar admin vue-pilihan-scan-config.js
// DAN tombol scan desktop tiap tab.
//
// Koleksi & field:
// - config_pilihan_scan/{targetId}: 1 dokumen = 1 CHILD TAB — item_ids[]
//   (urutan+aktif). Tanpa dokumen jatuh ke DEFAULT_PILIHAN, dicache 1x
//   getDocs/sesi. Tiap item cuma memanggil window.bukaXxx (boleh beda modul).
// Jebakan:
// - Desktop WAJIB `await pastikanCachePilihanScan()` sebelum render tombol
//   (`aksiAktif(targetId,id)`), kalau tidak selalu jatuh ke DEFAULT_PILIHAN.
// - Tiap window.bukaXxx WAJIB panggil pastikanMountXxx miliknya sendiri dulu
//   (idempoten) — aksi "asing" bisa dipicu dari tab yang belum pernah dibuka
//   user sesi ini, jadi vm pemiliknya belum tentu ter-mount.
// - Simpan/hapus admin WAJIB panggil invalidasiCachePilihanScan(), kalau
//   tidak sheet mobile DAN tombol desktop pakai cache lama.
import { createApp, ref } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { db } from './firebase-config.js';

// DAFTAR_AKSI_SCAN — katalog TETAP semua aksi scan yang bisa dimasukkan ke
// sheet mobile ATAU tombol desktop. Menambah titik scan baru = tambah 1
// entri di sini (fungsi = nama window.bukaXxx yang didefinisikan di file
// modul terkait) — baru setelah itu bisa dipasang ke child menu manapun
// lewat STRUKTUR_MENU_SCAN di bawah dan diatur ulang lewat layar admin.
export const DAFTAR_AKSI_SCAN = {
  operator_bahan: { icon: 'user', judul: 'Scan Operator', sub: 'Persiapan Bahan', gaya: 'aksen', fungsi: 'bukaScanOperatorBahan' },
  operator_sewing: { icon: 'user', judul: 'Scan Operator', sub: 'Acc Sewing', gaya: 'aksen', fungsi: 'bukaScanOperatorSewing' },
  operator_webbing: { icon: 'user', judul: 'Scan Operator', sub: 'Acc Webbing', gaya: 'aksen', fungsi: 'bukaScanOperatorWebbing' },
  operator_finishing: { icon: 'user', judul: 'Scan Operator', sub: 'Acc Finishing', gaya: 'aksen', fungsi: 'bukaScanOperatorFinishing' },
  cutting_sampai: { icon: 'barcode', judul: 'Scan Sampai', sub: 'Terima kiriman bahan', fungsi: 'bukaScanSampaiCutting' },
  cutting_unpack: { icon: 'box-open', judul: 'Scan Unpack', sub: 'Buka isi bagging', fungsi: 'bukaScanUnpackCutting' },
  cutting_pack: { icon: 'qrcode', judul: 'Scan Pack', sub: 'Kaitkan label ke bagging', fungsi: 'bukaScanPackCutting' },
  cutting_kirim: { icon: 'qrcode', judul: 'Scan Kirim', sub: 'Muat bagging ke tugas kirim', fungsi: 'bukaScanKirimCutting' },
  sampai_masalah_bahan: { icon: 'inbox', judul: 'Scan Sampai', sub: 'Terima balik Masalah — Bahan', fungsi: 'bukaSampaiMasalahBahan' },
  entry_bahan: { icon: 'qrcode', judul: 'Scan Entry', sub: 'Sedang Disiapkan — Bahan', fungsi: 'bukaEntryBahan' },
  masalah_bahan: { icon: 'triangle-exclamation', judul: 'Scan Masalah', sub: 'Sedang Disiapkan — Bahan', fungsi: 'bukaMasalahBahan' },
  pack_bahan: { icon: 'qrcode', judul: 'Scan Pack', sub: 'Perlu Dikirim — Bahan', fungsi: 'bukaPackBahan' },
  kirim_bahan: { icon: 'qrcode', judul: 'Scan Kirim', sub: 'Perlu Dikirim — Bahan', fungsi: 'bukaKirimBahan' },
  sampai_masalah_sewing: { icon: 'inbox', judul: 'Scan Sampai', sub: 'Terima balik Masalah — Acc Sewing', fungsi: 'bukaSampaiMasalahSewing' },
  entry_sewing: { icon: 'qrcode', judul: 'Scan Entry', sub: 'Sedang Disiapkan — Acc Sewing', fungsi: 'bukaEntrySewing' },
  masalah_sewing: { icon: 'triangle-exclamation', judul: 'Scan Masalah', sub: 'Sedang Disiapkan — Acc Sewing', fungsi: 'bukaMasalahSewing' },
  pack_sewing: { icon: 'qrcode', judul: 'Scan Pack', sub: 'Perlu Dikirim — Acc Sewing', fungsi: 'bukaPackSewing' },
  kirim_sewing: { icon: 'qrcode', judul: 'Scan Kirim', sub: 'Perlu Dikirim — Acc Sewing', fungsi: 'bukaKirimSewing' },
  sampai_masalah_webbing: { icon: 'inbox', judul: 'Scan Sampai', sub: 'Terima balik Masalah — Acc Webbing', fungsi: 'bukaSampaiMasalahWebbing' },
  entry_webbing: { icon: 'qrcode', judul: 'Scan Entry', sub: 'Sedang Disiapkan — Acc Webbing', fungsi: 'bukaEntryWebbing' },
  masalah_webbing: { icon: 'triangle-exclamation', judul: 'Scan Masalah', sub: 'Sedang Disiapkan — Acc Webbing', fungsi: 'bukaMasalahWebbing' },
  pack_webbing: { icon: 'qrcode', judul: 'Scan Pack', sub: 'Perlu Dikirim — Acc Webbing', fungsi: 'bukaPackWebbing' },
  kirim_webbing: { icon: 'qrcode', judul: 'Scan Kirim', sub: 'Perlu Dikirim — Acc Webbing', fungsi: 'bukaKirimWebbing' },
  sampai_masalah_finishing: { icon: 'inbox', judul: 'Scan Sampai', sub: 'Terima balik Masalah — Acc Finishing', fungsi: 'bukaSampaiMasalahFinishing' },
  entry_finishing: { icon: 'qrcode', judul: 'Scan Entry', sub: 'Sedang Disiapkan — Acc Finishing', fungsi: 'bukaEntryFinishing' },
  masalah_finishing: { icon: 'triangle-exclamation', judul: 'Scan Masalah', sub: 'Sedang Disiapkan — Acc Finishing', fungsi: 'bukaMasalahFinishing' },
  pack_finishing: { icon: 'qrcode', judul: 'Scan Pack', sub: 'Perlu Dikirim — Acc Finishing', fungsi: 'bukaPackFinishing' },
  kirim_finishing: { icon: 'qrcode', judul: 'Scan Kirim', sub: 'Perlu Dikirim — Acc Finishing', fungsi: 'bukaKirimFinishing' },
  operator_masalah: { icon: 'user', judul: 'Scan Operator', sub: 'Persiapan Masalah', gaya: 'aksen', fungsi: 'bukaOperatorMasalah' },
  entry_masalah: { icon: 'qrcode', judul: 'Scan Entry', sub: 'Sedang Disiapkan — Masalah', fungsi: 'bukaEntryMasalah' },
  masalah_masalah: { icon: 'triangle-exclamation', judul: 'Scan Masalah', sub: 'Sedang Disiapkan — Masalah', fungsi: 'bukaMasalahMasalah' },
  pack_masalah: { icon: 'qrcode', judul: 'Scan Pack', sub: 'Perlu Dikirim — Masalah', fungsi: 'bukaPackMasalah' },
  kirim_masalah: { icon: 'qrcode', judul: 'Scan Kirim', sub: 'Perlu Dikirim — Masalah', fungsi: 'bukaKirimMasalah' },
  operator_vendor: { icon: 'user', judul: 'Scan Operator', sub: 'Jalur Vendor', gaya: 'aksen', fungsi: 'bukaOperatorVendor' },
  entry_vendor: { icon: 'qrcode', judul: 'Scan Entry', sub: 'Jalur Vendor', fungsi: 'bukaEntryVendor' },
  masalah_vendor: { icon: 'triangle-exclamation', judul: 'Scan Masalah', sub: 'Jalur Vendor', fungsi: 'bukaMasalahVendor' },
  pack_vendor: { icon: 'qrcode', judul: 'Scan Pack', sub: 'Jalur Vendor', fungsi: 'bukaPackVendor' },
  kirim_vendor: { icon: 'qrcode', judul: 'Scan Kirim', sub: 'Jalur Vendor', fungsi: 'bukaKirimVendor' },
  sampai_vendor: { icon: 'qrcode', judul: 'Scan Sampai', sub: 'Jalur Vendor', fungsi: 'bukaSampaiVendor' },
  cutting_operator_ampar: { icon: 'user-check', judul: 'Scan Operator Ampar', sub: 'Cutting - Ampar', gaya: 'aksen', fungsi: 'bukaCuttingOperatorAmpar' },
  cutting_entry_ampar: { icon: 'check', judul: 'Scan Entry Ampar', sub: 'Cutting - Ampar', fungsi: 'bukaCuttingEntryAmpar' },
  cutting_operator_pola: { icon: 'user-check', judul: 'Scan Operator Pola', sub: 'Cutting - Pola', gaya: 'aksen', fungsi: 'bukaCuttingOperatorPola' },
  cutting_entry_pola: { icon: 'check', judul: 'Scan Entry Pola', sub: 'Cutting - Pola', fungsi: 'bukaCuttingEntryPola' },
  cutting_operator_cutting: { icon: 'user-check', judul: 'Scan Operator Cutting', sub: 'Cutting - Potong', gaya: 'aksen', fungsi: 'bukaCuttingOperatorCutting' },
  cutting_entry_cutting: { icon: 'check', judul: 'Scan Entry Cutting', sub: 'Cutting - Potong', fungsi: 'bukaCuttingEntryCutting' },
  serie_sampai: { icon: 'qrcode', judul: 'Scan Sampai', sub: 'Terima kiriman bagging', fungsi: 'bukaSerieSampai' },
  serie_unpack: { icon: 'box-open', judul: 'Scan Unpack', sub: 'Buka isi bagging dari Cutting', fungsi: 'bukaSerieUnpack' },
  serie_operator: { icon: 'user-check', judul: 'Scan Operator Serie', sub: 'Persiapan Separating', gaya: 'aksen', fungsi: 'bukaSerieOperator' },
  serie_entry: { icon: 'qrcode', judul: 'Scan Entry Serie', sub: 'Komponen selesai', fungsi: 'bukaSerieEntry' },
  serie_pack: { icon: 'qrcode', judul: 'Scan Pack', sub: 'Kaitkan komponen ke bagging', fungsi: 'bukaSeriePack' },
  serie_kirim_sewing: { icon: 'paper-plane', judul: 'Scan Kirim', sub: 'Serie → Sewing', fungsi: 'bukaSerieKirimSewing' },
  serie_kirim_finishing: { icon: 'paper-plane', judul: 'Scan Kirim', sub: 'Serie → Finishing', fungsi: 'bukaSerieKirimFinishing' },
  serie_kirim_gudang: { icon: 'paper-plane', judul: 'Scan Kirim', sub: 'Serie → Gudang Barang Jadi', fungsi: 'bukaSerieKirimGudang' },
  serie_terima_sampai_sewing: { icon: 'qrcode', judul: 'Scan Sampai', sub: 'Terima dari Sewing', fungsi: 'bukaSerieTerimaSampaiSewing' },
  serie_terima_sampai_finishing: { icon: 'qrcode', judul: 'Scan Sampai', sub: 'Terima dari Finishing', fungsi: 'bukaSerieTerimaSampaiFinishing' },
  serie_terima_unpack_sewing: { icon: 'box-open', judul: 'Scan Unpack', sub: 'Bagging dari Sewing', fungsi: 'bukaSerieTerimaUnpackSewing' },
  serie_terima_unpack_finishing: { icon: 'box-open', judul: 'Scan Unpack', sub: 'Bagging dari Finishing', fungsi: 'bukaSerieTerimaUnpackFinishing' },
  sewing_sampai: { icon: 'qrcode', judul: 'Scan Sampai', sub: 'Terima dari Serie', fungsi: 'bukaSewingSampai' },
  sewing_unpack: { icon: 'box-open', judul: 'Scan Unpack', sub: 'Buka isi bagging', fungsi: 'bukaSewingUnpack' },
  sewing_operator: { icon: 'user-check', judul: 'Scan Operator', sub: 'Persiapan Sewing', gaya: 'aksen', fungsi: 'bukaSewingOperator' },
  sewing_entry: { icon: 'qrcode', judul: 'Scan Entry', sub: 'Batch selesai dijahit', fungsi: 'bukaSewingEntry' },
  sewing_pack: { icon: 'qrcode', judul: 'Scan Pack', sub: 'Kaitkan pcs ke bagging', fungsi: 'bukaSewingPack' },
  sewing_kirim: { icon: 'paper-plane', judul: 'Scan Kirim', sub: 'Sewing → Serie', fungsi: 'bukaSewingKirim' },
  finishing_sampai: { icon: 'qrcode', judul: 'Scan Sampai', sub: 'Terima dari Serie', fungsi: 'bukaFinishingSampai' },
  finishing_unpack: { icon: 'box-open', judul: 'Scan Unpack', sub: 'Buka isi bagging', fungsi: 'bukaFinishingUnpack' },
  finishing_operator_qc_persiapan: { icon: 'user-check', judul: 'Scan Operator QC', sub: 'Persiapan QC', gaya: 'aksen', fungsi: 'bukaFinishingOperatorQcPersiapan' },
  finishing_operator_qc: { icon: 'user-check', judul: 'Scan Operator', sub: 'Tahap QC', gaya: 'aksen', fungsi: 'bukaFinishingOperatorQc' },
  finishing_entry_qc: { icon: 'qrcode', judul: 'Scan Entry', sub: 'Tahap QC', fungsi: 'bukaFinishingEntryQc' },
  finishing_operator_steam: { icon: 'user-check', judul: 'Scan Operator', sub: 'Tahap Steam', gaya: 'aksen', fungsi: 'bukaFinishingOperatorSteam' },
  finishing_entry_steam: { icon: 'qrcode', judul: 'Scan Entry', sub: 'Tahap Steam', fungsi: 'bukaFinishingEntrySteam' },
  finishing_operator_folding: { icon: 'user-check', judul: 'Scan Operator', sub: 'Tahap Folding', gaya: 'aksen', fungsi: 'bukaFinishingOperatorFolding' },
  finishing_entry_folding: { icon: 'qrcode', judul: 'Scan Entry', sub: 'Tahap Folding', fungsi: 'bukaFinishingEntryFolding' },
  finishing_operator_packing: { icon: 'user-check', judul: 'Scan Operator', sub: 'Tahap Packing', gaya: 'aksen', fungsi: 'bukaFinishingOperatorPacking' },
  finishing_entry_packing: { icon: 'qrcode', judul: 'Scan Entry', sub: 'Tahap Packing', fungsi: 'bukaFinishingEntryPacking' },
  finishing_pack: { icon: 'qrcode', judul: 'Scan Pack', sub: 'Kaitkan pcs ke bagging', fungsi: 'bukaFinishingPack' },
  finishing_kirim: { icon: 'paper-plane', judul: 'Scan Kirim', sub: 'Finishing → Serie', fungsi: 'bukaFinishingKirim' },
  gudang_sampai: { icon: 'qrcode', judul: 'Scan Sampai', sub: 'Terima batch dari Serie', fungsi: 'bukaGudangSampai' },
  gudang_unpack: { icon: 'box-open', judul: 'Scan Unpack', sub: 'Buka isi bagging', fungsi: 'bukaGudangUnpack' },
  gudang_masuk: { icon: 'qrcode', judul: 'Scan Masuk Gudang', sub: 'Simpan pcs jadi', fungsi: 'bukaGudangMasuk' },
};

// STRUKTUR_MENU_SCAN — SATU sumber untuk 3 hal: hierarki kartu admin (Group Menu >
// Sub Menu > Child Tab, dipakai vue-pilihan-scan-config.js), DAFTAR_KONTEKS, dan
// DEFAULT_PILIHAN (DUA terakhir diturunkan otomatis di bawah, jangan didaftar dobel).
// Pengaturan PER CHILD TAB (`childs[].targetId`) — tiap tab beda tombol, tidak bisa
// diseragamkan satu modul. Kandidat checkbox tiap child TETAP seluruh `aksiModul`
// (bukan cuma yang "native" ke tab itu) supaya admin bebas aktifkan aksi APA SAJA
// di tab MANA SAJA (mis. Scan Kirim tetap bisa dinyalakan dari tab Perlu Disiapkan
// untuk alur maju-mundur konveksi) — default semua aktif, admin yang mempersempit.
// Sub tanpa `aksiModul` (hub grouping SPK, Persiapan Belanja) memang tidak scan.
export const STRUKTUR_MENU_SCAN = [
  { group: 'Persiapan Produksi', subs: [
    { sub: 'Vendor', aksiModul: ['operator_vendor', 'entry_vendor', 'masalah_vendor', 'pack_vendor', 'kirim_vendor', 'sampai_vendor'], childs: [
      { label: 'Perlu Diproses', targetId: 'sub-pp-vendor-perludiproses' },
      { label: 'Sedang Diproses', targetId: 'sub-pp-vendor-sedangdiproses' },
      { label: 'Perlu Dikirim', targetId: 'sub-pp-vendor-perludikirim' },
      { label: 'Sedang Dikirim', targetId: 'sub-pp-vendor-sedangdikirim' },
      { label: 'Selesai', targetId: 'sub-pp-vendor-selesai' } ] },
    { sub: 'Perlu Disiapkan', childs: [{ label: '(hub grouping SPK)' }] },
    { sub: 'Bahan', aksiModul: ['operator_bahan', 'sampai_masalah_bahan', 'entry_bahan', 'masalah_bahan', 'pack_bahan', 'kirim_bahan'], childs: [
      { label: 'Perlu Disiapkan', targetId: 'sub-pp-bahan-perludisiapkan' },
      { label: 'Sedang Disiapkan', targetId: 'sub-pp-bahan-sedangdisiapkan' },
      { label: 'Perlu Dikirim', targetId: 'sub-pp-bahan-perludikirim' },
      { label: 'Sedang Dikirim', targetId: 'sub-pp-bahan-sedangdikirim' },
      { label: 'Selesai', targetId: 'sub-pp-bahan-selesai' } ] },
    { sub: 'Acc Sewing', aksiModul: ['operator_sewing', 'sampai_masalah_sewing', 'entry_sewing', 'masalah_sewing', 'pack_sewing', 'kirim_sewing'], childs: [
      { label: 'Perlu Disiapkan', targetId: 'sub-pp-sewing-perludisiapkan' },
      { label: 'Sedang Disiapkan', targetId: 'sub-pp-sewing-sedangdisiapkan' },
      { label: 'Perlu Dikirim', targetId: 'sub-pp-sewing-perludikirim' },
      { label: 'Sedang Dikirim', targetId: 'sub-pp-sewing-sedangdikirim' },
      { label: 'Selesai', targetId: 'sub-pp-sewing-selesai' } ] },
    { sub: 'Acc Webbing', aksiModul: ['operator_webbing', 'sampai_masalah_webbing', 'entry_webbing', 'masalah_webbing', 'pack_webbing', 'kirim_webbing'], childs: [
      { label: 'Perlu Disiapkan', targetId: 'sub-pp-webbing-perludisiapkan' },
      { label: 'Sedang Disiapkan', targetId: 'sub-pp-webbing-sedangdisiapkan' },
      { label: 'Perlu Dikirim', targetId: 'sub-pp-webbing-perludikirim' },
      { label: 'Sedang Dikirim', targetId: 'sub-pp-webbing-sedangdikirim' },
      { label: 'Selesai', targetId: 'sub-pp-webbing-selesai' } ] },
    { sub: 'Acc Finishing', aksiModul: ['operator_finishing', 'sampai_masalah_finishing', 'entry_finishing', 'masalah_finishing', 'pack_finishing', 'kirim_finishing'], childs: [
      { label: 'Perlu Disiapkan', targetId: 'sub-pp-finishing-perludisiapkan' },
      { label: 'Sedang Disiapkan', targetId: 'sub-pp-finishing-sedangdisiapkan' },
      { label: 'Perlu Dikirim', targetId: 'sub-pp-finishing-perludikirim' },
      { label: 'Sedang Dikirim', targetId: 'sub-pp-finishing-sedangdikirim' },
      { label: 'Selesai', targetId: 'sub-pp-finishing-selesai' } ] },
    { sub: 'Masalah', aksiModul: ['operator_masalah', 'entry_masalah', 'masalah_masalah', 'pack_masalah', 'kirim_masalah'], childs: [
      { label: 'Perlu Diajukan', targetId: 'sub-pp-masalah-perludiajukan' },
      { label: 'Menunggu Setuju', targetId: 'sub-pp-masalah-menunggusetuju' },
      { label: 'Perlu Disiapkan', targetId: 'sub-pp-masalah-perludisiapkan' },
      { label: 'Sedang Disiapkan', targetId: 'sub-pp-masalah-sedangdisiapkan' },
      { label: 'Perlu Dikirim', targetId: 'sub-pp-masalah-perludikirim' },
      { label: 'Sedang Dikirim', targetId: 'sub-pp-masalah-sedangdikirim' },
      { label: 'Selesai', targetId: 'sub-pp-masalah-selesai' } ] },
    { sub: 'Persiapan Belanja', childs: [{ label: 'Persiapan Admin' }, { label: 'Menunggu ACC' }, { label: 'List Order Driver' }, { label: 'Riwayat' }] },
  ] },
  { group: 'Proses Produksi', subs: [
    { sub: 'Cutting', aksiModul: ['cutting_sampai', 'cutting_unpack', 'cutting_operator_ampar', 'cutting_entry_ampar', 'cutting_operator_pola', 'cutting_entry_pola', 'cutting_operator_cutting', 'cutting_entry_cutting', 'cutting_pack', 'cutting_kirim'], childs: [
      { label: 'Perlu Di Proses', targetId: 'sub-pr-cutting-perludiproses' },
      { label: 'Sedang Ampar', targetId: 'sub-pr-cutting-sedangampar' },
      { label: 'Sedang Pola', targetId: 'sub-pr-cutting-sedangpola' },
      { label: 'Sedang Cutting', targetId: 'sub-pr-cutting-sedangcutting' },
      { label: 'Perlu Di Kirim', targetId: 'sub-pr-cutting-perludikirim' },
      { label: 'Sedang Di Kirim', targetId: 'sub-pr-cutting-sedangdikirim' },
      { label: 'Selesai', targetId: 'sub-pr-cutting-selesai' } ] },
    { sub: 'Serie', aksiModul: ['serie_sampai', 'serie_unpack', 'serie_operator', 'serie_entry', 'serie_pack', 'serie_kirim_sewing', 'serie_terima_sampai_sewing', 'serie_terima_unpack_sewing', 'serie_kirim_finishing', 'serie_terima_sampai_finishing', 'serie_terima_unpack_finishing', 'serie_kirim_gudang'], childs: [
      { label: 'Perlu Di Proses', targetId: 'sub-pr-serie-perludiproses' },
      { label: 'Sedang Di Proses', targetId: 'sub-pr-serie-sedangdiproses' },
      { label: 'Perlu Di Kirim', targetId: 'sub-pr-serie-perludikirim' },
      { label: 'Kirim Sewing', targetId: 'sub-pr-serie-kirimsewing' },
      { label: 'Setor Sewing', targetId: 'sub-pr-serie-setorsewing' },
      { label: 'Terima Sewing', targetId: 'sub-pr-serie-terimasewing' },
      { label: 'Kirim Finishing', targetId: 'sub-pr-serie-kirimfinishing' },
      { label: 'Setor Finishing', targetId: 'sub-pr-serie-setorfinishing' },
      { label: 'Terima Finishing', targetId: 'sub-pr-serie-terimafinishing' },
      { label: 'Kirim Gudang', targetId: 'sub-pr-serie-kirimgudang' },
      { label: 'Selesai', targetId: 'sub-pr-serie-selesai' } ] },
    { sub: 'Sewing', aksiModul: ['sewing_sampai', 'sewing_unpack', 'sewing_operator', 'sewing_entry', 'sewing_pack', 'sewing_kirim'], childs: [
      { label: 'Perlu Di Proses', targetId: 'sub-pr-sewing-perludiproses' },
      { label: 'Sedang Sewing', targetId: 'sub-pr-sewing-sedangsewing' },
      { label: 'Perlu Dikirim', targetId: 'sub-pr-sewing-perludikirim' },
      { label: 'Sedang Kirim', targetId: 'sub-pr-sewing-sedangkirim' },
      { label: 'Selesai', targetId: 'sub-pr-sewing-selesai' } ] },
    { sub: 'Finishing', aksiModul: ['finishing_sampai', 'finishing_unpack', 'finishing_operator_qc_persiapan', 'finishing_operator_qc', 'finishing_entry_qc', 'finishing_operator_steam', 'finishing_entry_steam', 'finishing_operator_folding', 'finishing_entry_folding', 'finishing_operator_packing', 'finishing_entry_packing', 'finishing_pack', 'finishing_kirim'], childs: [
      { label: 'Perlu Di Proses', targetId: 'sub-pr-finishing-perludiproses' },
      { label: 'Sedang QC', targetId: 'sub-pr-finishing-sedangqc' },
      { label: 'Sedang Steam', targetId: 'sub-pr-finishing-sedangsteam' },
      { label: 'Sedang Folding', targetId: 'sub-pr-finishing-sedangfolding' },
      { label: 'Sedang Packing', targetId: 'sub-pr-finishing-sedangpacking' },
      { label: 'Perlu Dikirim', targetId: 'sub-pr-finishing-perludikirim' },
      { label: 'Sedang Kirim', targetId: 'sub-pr-finishing-sedangkirim' },
      { label: 'Selesai', targetId: 'sub-pr-finishing-selesai' } ] },
    { sub: 'Gudang Barang Jadi', aksiModul: ['gudang_sampai', 'gudang_unpack', 'gudang_masuk'], childs: [
      { label: 'Perlu Disimpan', targetId: 'sub-pr-gudang-perludisimpan' },
      { label: 'Stok Tersedia', targetId: 'sub-pr-gudang-stoktersedia' },
      { label: 'Riwayat Keluar', targetId: 'sub-pr-gudang-riwayatkeluar' },
      { label: 'Scan Opname', targetId: 'sub-pr-gudang-scanopname' } ] },
  ] },
];

// Diturunkan dari STRUKTUR_MENU_SCAN — JANGAN edit manual, edit strukturnya di atas.
export const DAFTAR_KONTEKS = {};
export const DEFAULT_PILIHAN = {};
STRUKTUR_MENU_SCAN.forEach(g => g.subs.forEach(s => {
  if (!s.aksiModul || !s.aksiModul.length) return;
  s.childs.forEach(c => {
    if (!c.targetId) return;
    DAFTAR_KONTEKS[c.targetId] = `${g.group} > ${s.sub} > ${c.label}`;
    DEFAULT_PILIHAN[c.targetId] = s.aksiModul;
  });
}));

// Cache in-memory per sesi, hemat read Firestore — koleksinya kecil (jumlah
// konteks, bukan jumlah scan). null = belum dimuat sekalipun. _versiCache
// SENGAJA Vue ref kosong yang dibaca tiap idAksiUntukTarget(): tombol desktop
// yang sudah lama ter-mount (v-if="aksiAktif(...)" di template) baru ikut
// re-render otomatis saat versinya berubah — tanpa ini, perubahan admin cuma
// kepakai kalau layar itu di-reload/di-mount ulang.
let _cachePilihanScan = null;
let _janjiPilihanScan = null;
const _versiCache = ref(0);

// Diekspor — layar admin DAN setiap komponen desktop yang mau menggerbang
// tombolnya lewat aksiAktif() WAJIB await ini dulu di muat()/onMounted().
export async function pastikanCachePilihanScan() {
  if (_cachePilihanScan) return;
  if (_janjiPilihanScan) return _janjiPilihanScan;
  _janjiPilihanScan = (async () => {
    _cachePilihanScan = {};
    try {
      const snap = await getDocs(collection(db, 'config_pilihan_scan'));
      snap.docs.forEach(d => { _cachePilihanScan[d.id] = d.data(); });
    } catch (e) {
      console.error('Gagal muat config_pilihan_scan, pakai default kode:', e);
    }
    _versiCache.value++;
  })();
  await _janjiPilihanScan;
  _janjiPilihanScan = null;
}
// Dipanggil js/vue-pilihan-scan-config.js tiap simpan/hapus — muat ulang di
// background (bukan cuma null) supaya tombol yang sudah ter-mount ikut update
// sendiri lewat _versiCache, sheet mobile DAN tombol desktop sama-sama tidak
// nyangkut pakai cache lama sampai reload.
export function invalidasiCachePilihanScan() {
  _cachePilihanScan = null;
  pastikanCachePilihanScan();
}

function idAksiUntukTarget(targetId) {
  _versiCache.value;
  const dariFirestore = _cachePilihanScan && _cachePilihanScan[targetId];
  return dariFirestore ? (dariFirestore.item_ids || []) : (DEFAULT_PILIHAN[targetId] || []);
}
// aksiAktif — dipakai tombol DESKTOP lewat v-if. WAJIB pastikanCachePilihanScan()
// sudah selesai (await di muat()) sebelum baris pertama yang memanggil ini
// dirender, kalau tidak selalu jatuh ke DEFAULT_PILIHAN walau sudah diatur beda.
export function aksiAktif(targetId, aksiId) {
  return idAksiUntukTarget(targetId).includes(aksiId);
}

function ambilItemUntukTarget(targetId) {
  const ids = idAksiUntukTarget(targetId);
  if (!ids.length) return null;
  // Aksi tanpa bridge window.bukaXxx (belum ada fitur globalnya, cuma tombol
  // per-baris) sengaja disaring di sini — daripada tampil di sheet lalu diam
  // saat ditekan karena window[fungsi] belum ada.
  const item = ids.map(id => DAFTAR_AKSI_SCAN[id]).filter(a => a && typeof window[a.fungsi] === 'function').map(a => ({
    icon: a.icon, judul: a.judul, sub: a.sub, gaya: a.gaya,
    aksi: () => window[a.fungsi] && window[a.fungsi]()
  }));
  return item.length ? item : null;
}

function pilihanDefault() {
  return [{
    icon: 'qrcode',
    judul: 'Scan QR',
    gaya: 'aksen',
    aksi: () => { if (window.pindahTab) window.pindahTab('tab-scan-qr'); }
  }];
}

// Cari konteks aktif SEKARANG: sub-tab ter-track dulu (paling spesifik), baru
// tab top-level kalau tidak ketemu. Lihat js/dashboard.js utk bentuk
// window._riwayatNavAktif.
function ambilPilihanScanUntukKonteks() {
  const aktif = window._riwayatNavAktif;
  if (aktif && Array.isArray(aktif.subTabs)) {
    for (const entry of aktif.subTabs) {
      const item = ambilItemUntukTarget(entry.targetId);
      if (item) return item;
    }
  }
  if (aktif && aktif.tab) {
    const item = ambilItemUntukTarget(aktif.tab);
    if (item) return item;
  }
  return pilihanDefault();
}

const AppPopupScan = {
  setup() {
    const terbuka = ref(false);
    const judul = ref('Mau scan apa?');
    const daftarItem = ref([]);
    // Menandai apakah entry riwayat browser utk sheet ini SEDANG aktif —
    // dipakai supaya tutup() lewat tombol/backdrop (BUKAN tombol back HP)
    // ikut menetralkan entry itu (lihat tutup() di bawah). Sheet ini juga
    // ikut tertutup kalau tombol back HP ditekan selagi terbuka.
    let adaEntryHistory = false;

    async function buka() {
      await pastikanCachePilihanScan();
      daftarItem.value = ambilPilihanScanUntukKonteks();
      terbuka.value = true;
      try {
        history.pushState({ sheetPilihanScan: true }, '', location.href);
        adaEntryHistory = true;
      } catch (e) {
        console.error('Gagal catat riwayat sheet pilihan scan (tidak fatal):', e);
      }
    }
    function tutup() {
      terbuka.value = false;
      if (adaEntryHistory) {
        adaEntryHistory = false;
        // SENGAJA pakai replaceState (netralkan entry di tempat), BUKAN
        // history.back() — back() itu async (popstate baru terpicu
        // beberapa saat kemudian), kalau pilihItem() langsung memanggil
        // item.aksi() sesudah ini (yang bisa pushState LAGI, mis. lewat
        // pindahTab) urutannya jadi rawan tabrakan/race. replaceState
        // sinkron & tidak menavigasi apa-apa, jadi aman dipanggil
        // berurutan dengan pushState lain tepat sesudahnya.
        try { history.replaceState(null, '', location.href); } catch (e) {}
      }
    }
    // Dipanggil listener popstate (tombol back HP) — TIDAK boleh ikut
    // history.back() lagi (sudah dikonsumsi tombol back itu sendiri).
    function tutupDariPopstate() {
      terbuka.value = false;
      adaEntryHistory = false;
    }
    function pilihItem(item) {
      tutup();
      if (item.aksi) item.aksi();
    }

    return { terbuka, judul, daftarItem, buka, tutup, tutupDariPopstate, pilihItem };
  },
  template: `
    <div>
      <div v-if="terbuka" class="gc-sheet-backdrop" @click="tutup"></div>
      <div v-if="terbuka" class="gc-sheet">
        <div class="gc-sheet-gagang-area" @click="tutup"><div class="gc-sheet-gagang"></div></div>
        <div style="display:flex; align-items:baseline; gap:8px; margin-bottom:12px;">
          <span style="font:700 15px 'Poppins',sans-serif; color:var(--mahogany);">{{ judul }}</span>
          <span @click="tutup" style="margin-left:auto; font-size:11px; color:var(--text-faint); cursor:pointer;">tutup</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div v-for="(item, idx) in daftarItem" :key="idx" @click="pilihItem(item)"
               class="gc-card"
               :style="{padding:'11px 12px', display:'flex', gap:'10px', alignItems:'center', cursor:'pointer', borderRadius:'14px',
                        borderColor: item.gaya === 'aksen' ? 'var(--burgundy)' : undefined,
                        background: item.gaya === 'aksen' ? 'var(--burgundy-light)' : undefined}">
            <div :style="{width:'32px', height:'32px', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                          background: item.gaya === 'aksen' ? 'var(--burgundy)' : 'var(--ivory-dim)'}">
              <i class="fas" :class="'fa-' + item.icon" :style="{fontSize:'13px', color: item.gaya === 'aksen' ? '#FAF4E7' : 'var(--text-muted)'}"></i>
            </div>
            <div style="flex:1; min-width:0;">
              <div :style="{font:'600 12.5px Poppins,sans-serif', color: item.gaya === 'aksen' ? 'var(--burgundy)' : 'var(--text)'}">{{ item.judul }}</div>
              <div v-if="item.sub" style="font:400 10px 'Nunito Sans',sans-serif; color:var(--mahogany-soft); margin-top:1px;">{{ item.sub }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-popup-scan');
if (mountPoint) {
  const vm = createApp(AppPopupScan).mount('#vue-popup-scan');
  window.bukaPopupPilihanScan = function() { vm.buka(); };
  window.tutupPopupPilihanScan = function() { vm.tutup(); };

  // Tombol back HP/browser saat sheet ini terbuka — tutup sheetnya, JANGAN
  // biarkan lompat balik ke tab/layar sebelumnya (perilaku default browser
  // kalau tidak ditangani). Bentuk state {sheetPilihanScan:true} SENGAJA
  // beda dari state tab Dashboard ({tab:...}) & state layar terlacak
  // ({layarBack:...}, js/app.js) — listener popstate lain otomatis aman
  // mengabaikan bentuk ini.
  window.addEventListener('popstate', (e) => {
    const state = e.state;
    if (!state || !state.sheetPilihanScan) {
      // Back ditekan padahal state SEKARANG bukan sheet ini — tapi kalau
      // sheet MASIH kelihatan terbuka (jarang, race kondisi navigasi
      // cepat), tetap tutup paksa supaya tidak nyangkut menutupi layar.
      if (vm.terbuka) vm.tutupDariPopstate();
      return;
    }
  });

  // Jaring pengaman: dipanggil js/app.js pindahLayar() tiap pindah keluar
  // screen-dashboard (logout, buka kamera, dst) — pola SAMA seperti
  // window.tutupSheetProfil (js/vue-sheet-profil.js).
  window.tutupPaksaPopupPilihanScan = function() { vm.tutupDariPopstate(); };
}
