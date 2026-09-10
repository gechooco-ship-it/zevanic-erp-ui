// js/vue-persiapan-belanja.js
// ============================================================================
// BARU (7 Sep 2026 — sesi ini) — Persiapan Produksi > Persiapan Belanja
// (group 8, folder terakhir per PEDOMAN-SERAH-TERIMA.md §"Urutan yang
// disarankan"). Alur: admin input nota belanja -> cek pengajuan dari Masalah
// -> keyboard-first entry -> menunggu ACC Owner -> generate order ke HP
// driver per suplayer -> driver beli/pending -> nota masuk ke Stok &
// Pembelian.
//
// SUMBER: handoff/02 - Persiapan Produksi/08 - Persiapan Belanja/SERAH-
// TERIMA.md (dibaca penuh) + handoff/SPESIFIKASI-KOLEKSI-BARU.md §3 (skema
// order_belanja_driver/pending_driver, field tambahan pesanan_pembelian/
// master_suplayer/alias_pembelian) + cross-check LIVE CODE ke js/vue-stock-
// pembelian.js (skema & alur pesanan_pembelian, keyboard-first entry 3.2a-
// 3.2e yang jadi acuan §2 "pola sama dengan Stok 3.2") dan js/vue-master-
// suplayer.js (KABAR BAIK: field bank/nama_rek/no_rek/no_wa di master_
// suplayer DAN moq/moq_satuan/lead_time_hari/is_default_order di alias_
// pembelian SUDAH DIBANGUN sesi sebelumnya — persis menyiapkan modul ini,
// TIDAK perlu ditambah lagi di sini) dan js/vue-pp-masalah.js (status
// `diajukan_belanja` SUDAH ADA sebagai jalur keluar Masalah -> Persiapan
// Belanja, field qty_beli sudah dihitung Owner di sana).
//
// KEPUTUSAN/CATATAN ARSITEKTUR:
//
// 1. TIDAK reuse UI Daftar Nota Stok (js/vue-stock-pembelian.js) — SERAH-
//    TERIMA §2 eksplisit modul ini punya layar SENDIRI (8.1/8.1.2), yang
//    DIPAKAI ULANG cuma KOLEKSI-nya (`pesanan_pembelian`, field `status`
//    dapat NILAI BARU 'menunggu_acc'/'disetujui'/'siap_finalisasi' selain
//    'draft'/'final' yang sudah dipakai Stok — Vue merender string tak
//    dikenal dengan aman/tanpa error, cuma tanpa styling tag khusus, tidak
//    breaking) dan `pengaturan_id_pembelian` (counter no_pembelian, counter
//    SAMA dipakai bersama Stok — SATU urutan nomor, bukan dua paralel).
//
// 2. Keyboard-first entry (8.1.2) — DISEDERHANAKAN dari versi penuh Stok
//    3.2a-3.2e (search -> Enter -> Tab buka Qty -> Tab buka Satuan -> Tab
//    buka Harga+PIN). Versi Stok penuh berurusan dengan HARGA AKTUAL +
//    konversi satuan bertingkat + lot tracking — SEMUA itu tugas
//    "Finalisasi nota (harga aktual)" yang SERAH-TERIMA §4 Scope EKSPLISIT
//    taruh di luar cakupan modul ini ("di Stok dan Pembelian"). Modul ini
//    cuma butuh ESTIMASI (qty + satuan pembelian + harga estimasi opsional)
//    untuk keperluan generate order ke driver — jadi rantai Tab
//    disederhanakan: search -> Enter tambah (qty 1, satuan_pembelian
//    default) -> Tab buka pop up Qty -> Enter konfirmasi -> fokus balik ke
//    search. TIDAK ada popup Satuan/Harga+PIN terpisah (qty & harga
//    estimasi bisa diedit langsung di baris tabel). Interaksi "ketik selalu
//    cari lagi, Tab selalu lanjut" (wireframe 3.2b) TETAP dipertahankan —
//    yang dipangkas cuma JUMLAH langkahnya, bukan pola dasarnya.
//
//    REVISI 9 Sep 2026 (audit wireframe.dc.html "08 - Persiapan Belanja"
//    §8.1 vs kode live, keputusan Guru) — struktur layar 8.1 diganti total
//    ke pola "Nota Order" wireframe: KIRI grid kartu produk (cari/browse,
//    chip Semua/Bahan/Aksesoris, klik kartu = tambah), KANAN panel "Item
//    Nota" berbentuk KARTU per item dengan stepper qty +/- dan chip sumber
//    ("bahan kurang" dari Cek Pengajuan) — BUKAN lagi tabel HTML datar. Pop
//    up Qty terpisah (tampilPopupQty/qtyInput/konfirmasiQty) DIHAPUS karena
//    kartu Item Nota sudah punya stepper qty inline, jadi tidak perlu pop
//    up lagi — bukan kehilangan fungsi, cuma pindah tempat sesuai wireframe.
//    Enter di kotak cari tetap menambah match pertama (semangat "keyboard-
//    first" tetap ada), klik kartu grid = cara tambah utama yang baru.
//    HITUNGAN item (qty*harga_estimasi=subtotal, totalEstimasi) dan fungsi
//    simpan()/muat()/bukaCekPengajuan()/masukkanPengajuanTerpilih() TIDAK
//    DIUBAH SAMA SEKALI — cuma tampilannya yang berubah.
//
//    Chip sumber "stok kritis" di wireframe (8.1.1) TIDAK diimplementasikan
//    — tidak ada field ambang stok minimum (stok_minimum/ambang_stok/dst)
//    yang terverifikasi ada di master_bahan_aksesoris atau di mana pun di
//    kode live (sudah digrep, nihil). Menebak angka ambang "kritis" sendiri
//    berisiko salah untuk modul pembelian — jadi HANYA sumber "bahan
//    kurang" (dari_masalah_id, dari Cek Pengajuan) yang ditandai chip;
//    item yang ditambah manual dari grid tidak diberi chip. GAP
//    DISENGAJA, dilaporkan ke Guru, bukan ditebak.
//
//    Suplayer OTOMATIS dari Petakan Order (alias_pembelian.is_default_order,
//    js/vue-master-suplayer.js — MEKANISME INI SUDAH ADA & SUDAH DIPAKAI
//    vue-pp-masalah.js untuk MOQ) — DISAMBUNGKAN untuk SARAN, bukan
//    dipaksakan: begitu item PERTAMA ditambah ke nota kosong, suplayerId
//    nota di-auto-isi dari alias is_default_order milik bahan itu (kalau
//    ada). Dropdown suplayer manual TETAP ADA (TIDAK dihapus) untuk koreksi
//    — field `suplayer_id` di `pesanan_pembelian` TETAP SATU per nota
//    (arsitektur TIDAK diubah, lihat keputusan #1 di atas). Kalau item
//    BERIKUTNYA punya default suplayer BEDA dari suplayer nota saat ini,
//    kartu item itu menampilkan chip peringatan "suplayer beda" — TIDAK
//    auto-pecah jadi banyak order, karena Tab Menunggu ACC/List Order
//    Driver di bawah masih berasumsi 1 nota = 1 suplayer (order_belanja_
//    driver dibuat dari SATU suplayer_id per nota). Wireframe menggambarkan
//    1 nota bisa berisi item dari BEBERAPA suplayer sekaligus (di-generate
//    jadi order terpisah per suplayer) — itu PERUBAHAN ARSITEKTUR pembelian
//    yang lebih besar (pesanan_pembelian/order_belanja_driver perlu pecah
//    per suplayer saat Generate Order) dan TIDAK ditebak di sesi ini
//    (modul uang/pembelian) — KEPUTUSAN TERBUKA, dilaporkan ke Guru.
//
// 3. Alur status BARU utk `pesanan_pembelian` khusus dokumen yang berasal
//    dari modul ini (dibedakan dari nota manual Stok lewat field
//    `order_driver_id` != null SEJAK AWAL — beda dari nota manual Stok yang
//    field itu SELALU null sampai fitur ini ada, persis seperti yang
//    diantisipasi komentar besar vue-stock-pembelian.js poin 3): draft (admin
//    masih edit) -> menunggu_acc (diajukan admin) -> disetujui (Owner ACC,
//    `order_belanja_driver` DIGENERATE saat ini) -> siap_finalisasi (driver
//    klik Beli, foto bon terupload, item final). SENGAJA TIDAK memakai
//    literal 'final' di titik driver-Beli walau SERAH-TERIMA §3 menulis
//    "Beli (driver) -> pesanan_pembelian (final)" — status Stok sendiri
//    'final' MEMICU EFEK SAMPING (`catatRiwayatHargaDanUpdateMaster`,
//    menambah stok_akhir + riwayat harga master) yang HANYA boleh dipanggil
//    dari vue-stock-pembelian.js sendiri (aturan "JANGAN PERNAH update
//    stok_akhir langsung dari tempat lain", didokumentasikan di file itu
//    sendiri) — fungsi itu TIDAK di-export, dan §4 Scope modul ini sendiri
//    EKSPLISIT mengecualikan "Finalisasi nota (harga aktual)". Jadi 'final'
//    SUNGGUHAN tetap ditekan lewat tombol Finalkan MILIK Stok sendiri (tidak
//    diubah), sesudah Owner/Admin membuka nota `siap_finalisasi` itu di sana
//    dan mengecek harga aktual dari foto bon. Penyimpangan kecil dari kata
//    "(final)" di tabel SERAH-TERIMA — didokumentasikan di sini, bukan
//    ditebak diam-diam.
//
// 4. `order_belanja_driver` ditambah field `pesanan_pembelian_id` (TIDAK ADA
//    di SPESIFIKASI-KOLEKSI-BARU.md, judgment call) — link balik wajib
//    supaya aksi "Beli" driver (§3: item final + foto bon masuk ke
//    `pesanan_pembelian`) tahu dokumen MANA yang harus ditulis (skema resmi
//    cuma menyebut order_belanja_driver PUNYA items sendiri, tanpa link
//    eksplisit ke pesanan_pembelian sumbernya — tanpa field ini alur "Beli"
//    tidak bisa jalan).
//
// 5. "Cek Pengajuan" (8.1.1) — kandidat = `persiapan_masalah` status
//    'diajukan_belanja' (ditulis modul Masalah, js/vue-pp-masalah.js, sudah
//    berjalan) DIKURANGI yang id-nya SUDAH tercatat di
//    `sumber_masalah_ids` milik SALAH SATU nota `pesanan_pembelian` yang
//    masih aktif (status draft/menunggu_acc/disetujui/siap_finalisasi,
//    bukan yang sudah lama final) — supaya 1 pengajuan Masalah tidak
//    tertarik dobel ke 2 nota berbeda. TIDAK menulis status baru ke
//    persiapan_masalah sendiri (modul Masalah tidak punya tahap ke-8 untuk
//    itu, `diajukan_belanja` memang status TERMINAL dari sisi Masalah per
//    komentar besar file itu sendiri) — pengecekan dobel dilakukan di sisi
//    modul INI saja, bukan mengubah kontrak modul Masalah.
//
// 6. Format WA order (§7 "apakah template bisa diedit admin" — BELUM
//    diputuskan) — didefault FIXED (template tetap, tidak bisa diedit per-
//    order) — risiko rendah & reversibel, konsisten dengan gaya "format
//    baku" yang dipakai cetak label/lembar di seluruh app (semua lewat
//    Scan & Cetak, bukan diedit manual per transaksi).
//
// 7. "Apakah driver bisa menambah item di luar order" (§7 — BELUM
//    diputuskan) — didefault TIDAK BISA. Driver cuma bisa: kurangi qty
//    (tombol minus), pindah ke Pending, atau Beli apa adanya. Tabel §3
//    Fungsi modul ini sendiri tidak menyebut aksi "tambah item" milik
//    driver — konsisten dengan itu, bukan ditambah sendiri.
//
// 8. "Batas waktu ACC sebelum auto-cancel" (§7 — BELUM diputuskan) —
//    TIDAK diimplementasikan (sama alasan seperti auto-eskalasi Masalah:
//    tidak ada infrastruktur cron/Cloud Functions di app ini). Nota yang
//    lama menunggu ACC cukup terlihat "diam sejak X hari" di Tab Menunggu
//    ACC (dihitung dari `dibuat_pada`/`diajukan_pada`) — Owner yang
//    memutuskan kapan approve/tolak secara manual.
//
// 9. "Assign Ulang" (pending_driver.suplayer_baru_id) — diimplementasikan
//    MINIMAL sesuai field yang ADA di skema resmi: set `suplayer_baru_id` +
//    `status:'reassigned'`. TIDAK auto-generate order_belanja_driver BARU ke
//    suplayer baru itu (skema resmi tidak menyebut mekanisme itu, dan tidak
//    ada wireframe tergambar untuk memverifikasi alurnya) — Admin
//    menindaklanjuti item yang di-assign-ulang secara manual lewat nota
//    baru di Tab 8.1 kalau perlu. GAP DISENGAJA, didokumentasikan.
//
// 10. Gerbang peran: ACC (Setuju/Tolak) HANYA Owner/PIC Owner/Superuser
//    (`tierOwnerKeAtas`, diimpor dari js/vue-scan-cetak.js — SUDAH dipakai
//    js/vue-pp-masalah.js untuk gerbang yang SAMA persis, "Owner / PIC
//    Owner approve" sesuai SERAH-TERIMA §2). Aksi Admin (input nota, ajukan
//    ACC) & Driver (List Order Driver) cukup `cekIzinMenu(menuId,'edit')`
//    biasa — TIDAK ada role sistem terpisah "driver" (preseden Vendor Fase
//    4, js/vue-persiapan-produksi-v2.js: "driver = akun karyawan biasa").
//
// 11. TIDAK ada komponen Scan/QR di modul ini sama sekali (beda dari SEMUA
//    modul Proses/Persiapan Produksi lain) — SERAH-TERIMA §2/§3 modul ini
//    tidak menyebut satu pun aksi scan; semua aksi berupa form/tombol
//    biasa. Konsisten dengan cakupan yang diminta, bukan ditambah sendiri.
// ============================================================================

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { db, storage } from "./firebase-config.js";
import { tierOwnerKeAtas } from './vue-scan-cetak.js?v=2';

const MENU_ID = 'pp_belanja';

// --- Format & helper kecil (disalin pola dari modul lain, konvensi "salin
// logic kecil per-file"). ----------------------------------------------------
function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
function formatRupiah(n) {
  const angka = parseFloat(n) || 0;
  return 'Rp' + Math.round(angka).toLocaleString('id-ID');
}
function formatWaktu(iso) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return '-'; }
}
function jamSejak(iso) {
  if (!iso) return null;
  const d = iso?.seconds ? new Date(iso.seconds * 1000) : new Date(iso);
  return (Date.now() - d.getTime()) / 3600000;
}
function formatDiamSejak(iso) {
  const j = jamSejak(iso);
  if (j === null) return '-';
  if (j < 24) return Math.max(1, Math.round(j)) + ' jam';
  return Math.round(j / 24) + ' hari';
}
async function ambilDaftarBahanAksesorisLengkap() {
  try {
    const snap = await getDocs(collection(db, 'master_bahan_aksesoris'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    return list;
  } catch (e) { console.error('Gagal ambil daftar Bahan/Aksesoris:', e); return []; }
}
function formatNamaBahan(b) {
  if (!b) return '-';
  return (b.nama || '') + (b.warna ? ` ${b.warna}` : '');
}
async function ambilDaftarSuplayer() {
  try {
    const snap = await getDocs(collection(db, 'master_suplayer'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    return list;
  } catch (e) { console.error('Gagal ambil daftar Suplayer:', e); return []; }
}
async function ambilDaftarAlias() {
  try {
    const snap = await getDocs(collection(db, 'alias_pembelian'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error('Gagal ambil daftar Alias Pembelian:', e); return []; }
}

// --- No. Pembelian — SAMA counter dengan Stok & Pembelian (satu urutan). ---
async function generateNoPembelian() {
  const refDoc = doc(db, 'pengaturan_id_pembelian', 'pembelian');
  return await runTransaction(db, async (trx) => {
    const snap = await trx.get(refDoc);
    const data = snap.exists() ? snap.data() : null;
    if (!data || !data.prefix) throw new Error('Prefix No. Pembelian belum diatur di Stok & Pembelian > Pengaturan.');
    const counterBaru = (data.counter || 0) + 1;
    trx.update(refDoc, { counter: counterBaru });
    return `${data.prefix}${String(counterBaru).padStart(3, '0')}`;
  });
}
// --- Kode Order (driver) — counter harian SENDIRI, pola SAMA seperti
// generateKodeHarianFormat di modul Proses Produksi lain. -------------------
async function generateKodeOrderDriver() {
  const now = new Date();
  const tanggalKey = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const refDoc = doc(db, 'pengaturan_id_order_belanja_driver', tanggalKey);
  return await runTransaction(db, async (trx) => {
    const snap = await trx.get(refDoc);
    const counterBaru = (snap.exists() ? (snap.data().counter || 0) : 0) + 1;
    if (snap.exists()) trx.update(refDoc, { counter: counterBaru });
    else trx.set(refDoc, { counter: counterBaru, dibuat_pada: tanggalKey });
    return `ORD${tanggalKey}-${String(counterBaru).padStart(3, '0')}`;
  });
}
async function uploadFotoBonLokal(noPembelianAtauKode, file) {
  const pathFile = `pesanan_pembelian/${noPembelianAtauKode}/bon_${Date.now()}.jpg`;
  const refFile = storageRef(storage, pathFile);
  await uploadBytes(refFile, file);
  return await getDownloadURL(refFile);
}

// --- Baca koleksi mentah -----------------------------------------------------
async function muatSemuaPesananPembelian() {
  const snap = await getDocs(collection(db, 'pesanan_pembelian'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function muatSemuaOrderBelanjaDriver() {
  const snap = await getDocs(collection(db, 'order_belanja_driver'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function muatSemuaPendingDriver() {
  const snap = await getDocs(collection(db, 'pending_driver'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function muatMasalahDiajukanBelanja() {
  const snap = await getDocs(query(collection(db, 'persiapan_masalah'), where('status', '==', 'diajukan_belanja')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ============================================================================
// TAB 1 (8.1): Persiapan Admin — daftar draft/menunggu-acc milik admin +
// form input nota (keyboard-first sederhana, keputusan #2) + Cek Pengajuan
// (keputusan #5).
// ============================================================================
const PersiapanAdminBelanja = {
  setup() {
    const menuId = MENU_ID;
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const memuat = ref(true);
    const mode = ref('list'); // 'list' | 'form'
    const daftarNota = ref([]);
    const daftarSuplayer = ref([]);
    const daftarBahan = ref([]);
    const daftarAlias = ref([]);

    async function muat() {
      memuat.value = true;
      try {
        const [semua, suplayer, bahan, alias] = await Promise.all([
          muatSemuaPesananPembelian(), ambilDaftarSuplayer(), ambilDaftarBahanAksesorisLengkap(), ambilDaftarAlias()
        ]);
        daftarNota.value = semua.filter(p => p.order_driver_id !== undefined && (p.status === 'draft' || p.status === 'ditolak_acc'))
          .sort((a, b) => (b.dibuat_pada?.seconds || 0) - (a.dibuat_pada?.seconds || 0));
        daftarSuplayer.value = suplayer;
        daftarBahan.value = bahan;
        daftarAlias.value = alias;
        muatBadgePengajuan();
      } catch (e) { console.error('Gagal muat Persiapan Belanja > Persiapan Admin:', e); daftarNota.value = []; }
      memuat.value = false;
    }

    // --- Form nota ----------------------------------------------------------
    const draftDocId = ref(null);
    const suplayerId = ref('');
    const items = ref([]); // {bahan_aksesoris_id, nama_internal, nama_alias, qty, satuan, harga_estimasi, subtotal, dari_masalah_id}
    const sumberMasalahIds = ref([]);
    const suplayerAktif = computed(() => daftarSuplayer.value.find(s => s.id === suplayerId.value) || null);
    const totalEstimasi = computed(() => items.value.reduce((a, it) => a + (parseFloat(it.qty) || 0) * (parseFloat(it.harga_estimasi) || 0), 0));

    function formKosong() {
      draftDocId.value = null; suplayerId.value = ''; items.value = []; sumberMasalahIds.value = [];
      cariItemTeks.value = ''; kategoriFilter.value = 'semua';
    }
    function bukaFormBaru() { formKosong(); mode.value = 'form'; }
    function bukaFormEdit(n) {
      draftDocId.value = n.id;
      suplayerId.value = n.suplayer_id || '';
      items.value = (n.items || []).map(it => ({ ...it }));
      sumberMasalahIds.value = n.sumber_masalah_ids || [];
      mode.value = 'form';
    }
    function batalForm() {
      if (items.value.length > 0 && !confirm('Batalkan? Perubahan belum tersimpan akan hilang.')) return;
      mode.value = 'list';
      muat();
    }

    // --- Petakan Order (alias_pembelian.is_default_order) — SARAN suplayer
    // otomatis per bahan, lihat catatan besar §REVISI 9 Sep 2026 di atas.
    // Mekanisme is_default_order SUDAH ADA (dibangun sesi Master Suplayer,
    // dipakai juga oleh vue-pp-masalah.js untuk MOQ) — di sini cuma dibaca.
    function suplayerDefaultUntukBahan(bahanId) {
      // HANYA alias yang EKSPLISIT ditandai is_default_order:true di
      // Petakan Order yang dipakai — TIDAK menebak dari alias pertama yang
      // ketemu kalau belum ada yang ditandai default (itu keputusan Admin
      // di Master Suplayer, bukan urutan sembarang di sini).
      const dipilih = daftarAlias.value.find(a => a.bahan_aksesoris_id === bahanId && a.is_default_order);
      return dipilih?.suplayer_id ? { id: dipilih.suplayer_id, nama: dipilih.suplayer_nama || '' } : null;
    }
    function tambahBahanKeItem(bahan, qtyTambah, extra) {
      const idxAda = items.value.findIndex(it => it.bahan_aksesoris_id === bahan.id);
      if (idxAda >= 0) {
        items.value[idxAda].qty = (parseFloat(items.value[idxAda].qty) || 0) + qtyTambah;
      } else {
        const def = suplayerDefaultUntukBahan(bahan.id);
        items.value.push({
          bahan_aksesoris_id: bahan.id, nama_internal: formatNamaBahan(bahan), nama_alias: extra?.namaAlias || '',
          qty: qtyTambah, satuan: bahan.satuan_pembelian || '', harga_estimasi: parseFloat(bahan.harga_modal) || 0,
          suplayer_default_id: def?.id || '', suplayer_default_nama: def?.nama || '',
          ...(extra?.dariMasalahId ? { dari_masalah_id: extra.dariMasalahId } : {})
        });
        // Suplayer nota (suplayerId) TETAP diisi dari item PERTAMA — dipakai
        // sebagai suplayer FALLBACK untuk item yang tidak punya default di
        // Petakan Order (lihat kelompokPerSuplayer/REVISI 9 Sep malam di
        // bawah). Sejak revisi ini nota BOLEH berisi item multi-suplayer:
        // tiap item yang PUNYA default sendiri (suplayer_default_id) akan
        // dikelompokkan ke suplayernya masing-masing saat Setuju ACC —
        // suplayerId di sini bukan lagi "suplayer satu-satunya", cuma
        // fallback + nilai default form. Chip "suplayer beda" di template
        // tetap dipertahankan sebagai indikator visual saat mengisi form.
        if (!suplayerId.value && def?.id) suplayerId.value = def.id;
      }
    }
    function hapusBaris(idx) { items.value.splice(idx, 1); }
    function ubahQtyItem(idx, delta) {
      const it = items.value[idx]; if (!it) return;
      it.qty = Math.max(0, (parseFloat(it.qty) || 0) + delta);
    }

    // --- Grid produk kiri (cari/browse, chip kategori) — pengganti tabel
    // typeahead 1 kolom, sesuai wireframe §8.1 pola "Nota Order". -----------
    const elCari = ref(null);
    const cariItemTeks = ref('');
    const kategoriFilter = ref('semua'); // 'semua' | 'Bahan' | 'Aksesoris'
    const daftarGrid = computed(() => {
      const kata = cariItemTeks.value.trim().toLowerCase();
      return daftarBahan.value.filter(b => {
        if (kategoriFilter.value !== 'semua' && b.kategori_utama !== kategoriFilter.value) return false;
        if (!kata) return true;
        if (formatNamaBahan(b).toLowerCase().includes(kata)) return true;
        return daftarAlias.value.some(a => a.bahan_aksesoris_id === b.id && (a.nama_di_nota || '').toLowerCase().includes(kata));
      });
    });
    function jumlahDiNota(bahanId) { const it = items.value.find(x => x.bahan_aksesoris_id === bahanId); return it ? (parseFloat(it.qty) || 0) : 0; }
    function tambahDariGrid(b) { tambahBahanKeItem(b, 1); }
    function onKeydownCari(e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (daftarGrid.value.length > 0) tambahDariGrid(daftarGrid.value[0]);
    }

    // --- Cek Pengajuan (8.1.1, keputusan #5) --------------------------------
    const popupPengajuanAktif = ref(false);
    const daftarPengajuan = ref([]);
    const pengajuanDicentang = reactive({});
    async function bukaCekPengajuan() {
      try {
        const [semuaMasalah, semuaNota] = await Promise.all([muatMasalahDiajukanBelanja(), muatSemuaPesananPembelian()]);
        const notaAktif = semuaNota.filter(n => n.order_driver_id !== undefined && ['draft', 'menunggu_acc', 'disetujui', 'siap_finalisasi'].includes(n.status));
        const sudahDipakai = new Set(notaAktif.flatMap(n => n.sumber_masalah_ids || []));
        daftarPengajuan.value = semuaMasalah.filter(m => !sudahDipakai.has(m.id));
        Object.keys(pengajuanDicentang).forEach(k => delete pengajuanDicentang[k]);
        popupPengajuanAktif.value = true;
      } catch (e) { console.error('Gagal muat Cek Pengajuan:', e); alert('Gagal memuat daftar pengajuan.'); }
    }
    // Preload ringan hitungan badge "Cek Pengajuan" di header grid — TANPA
    // membuka pop up, cuma menghitung supaya admin lihat ada berapa sebelum
    // klik (wireframe: badge angka merah di tombol Cek Pengajuan).
    const badgePengajuan = ref(0);
    async function muatBadgePengajuan() {
      try {
        const [semuaMasalah, semuaNota] = await Promise.all([muatMasalahDiajukanBelanja(), muatSemuaPesananPembelian()]);
        const notaAktif = semuaNota.filter(n => n.order_driver_id !== undefined && ['draft', 'menunggu_acc', 'disetujui', 'siap_finalisasi'].includes(n.status));
        const sudahDipakai = new Set(notaAktif.flatMap(n => n.sumber_masalah_ids || []));
        badgePengajuan.value = semuaMasalah.filter(m => !sudahDipakai.has(m.id)).length;
      } catch (e) { console.error('Gagal hitung badge Cek Pengajuan:', e); badgePengajuan.value = 0; }
    }
    function masukkanPengajuanTerpilih() {
      const terpilih = daftarPengajuan.value.filter(m => pengajuanDicentang[m.id]);
      if (!terpilih.length) { popupPengajuanAktif.value = false; return; }
      terpilih.forEach(m => {
        const idxAda = items.value.findIndex(it => it.bahan_aksesoris_id === m.bahan_aksesoris_id);
        if (idxAda >= 0) items.value[idxAda].qty = (parseFloat(items.value[idxAda].qty) || 0) + (parseFloat(m.qty_beli) || 0);
        else {
          const def = suplayerDefaultUntukBahan(m.bahan_aksesoris_id);
          items.value.push({
            bahan_aksesoris_id: m.bahan_aksesoris_id, nama_internal: m.bahan_nama + (m.bahan_warna ? ' ' + m.bahan_warna : ''),
            nama_alias: '', qty: parseFloat(m.qty_beli) || 0, satuan: m.satuan || '', harga_estimasi: 0, dari_masalah_id: m.id,
            suplayer_default_id: def?.id || '', suplayer_default_nama: def?.nama || ''
          });
          if (!suplayerId.value && def?.id) suplayerId.value = def.id;
        }
        if (!sumberMasalahIds.value.includes(m.id)) sumberMasalahIds.value.push(m.id);
      });
      popupPengajuanAktif.value = false;
    }

    // --- Simpan Draft / Ajukan ACC ------------------------------------------
    const menyimpan = ref(false);
    async function simpan(statusBaru) {
      if (!bolehProses.value) return alert('Anda tidak punya izin di menu ini.');
      if (!suplayerId.value) return alert('Pilih Suplayer dulu.');
      if (!items.value.length) return alert('Belum ada item di nota.');
      menyimpan.value = true;
      try {
        let noPembelian = draftDocId.value ? (await getDoc(doc(db, 'pesanan_pembelian', draftDocId.value))).data()?.no_pembelian : null;
        if (!noPembelian) noPembelian = await generateNoPembelian();
        const s = suplayerAktif.value;
        const payload = {
          no_pembelian: noPembelian, tanggal: new Date().toISOString().slice(0, 10),
          suplayer_id: suplayerId.value, suplayer_nama: s?.nama || '',
          items: items.value.map(it => ({ ...it })),
          estimasi_biaya_belanja: totalEstimasi.value,
          status: statusBaru,
          sumber_masalah_ids: sumberMasalahIds.value,
          foto_bon: '', order_driver_id: null,
          dibuat_oleh: window.currentUser?.email || null,
          diupdate_pada: serverTimestamp(),
          ...(statusBaru === 'menunggu_acc' ? { diajukan_pada: new Date().toISOString(), diajukan_oleh: window.currentUser?.email || '' } : {})
        };
        if (draftDocId.value) await updateDoc(doc(db, 'pesanan_pembelian', draftDocId.value), payload);
        else { payload.dibuat_pada = serverTimestamp(); await addDoc(collection(db, 'pesanan_pembelian'), payload); }
        alert(statusBaru === 'menunggu_acc' ? `Nota ${noPembelian} diajukan ke Owner untuk ACC.` : `Draft ${noPembelian} tersimpan.`);
        mode.value = 'list';
        await muat();
      } catch (e) { console.error('Gagal simpan nota Persiapan Belanja:', e); alert(e.message || 'Gagal menyimpan. Coba lagi.'); }
      menyimpan.value = false;
    }

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      bolehProses, memuat, mode, daftarNota, daftarSuplayer, suplayerAktif,
      draftDocId, suplayerId, items, totalEstimasi, bukaFormBaru, bukaFormEdit, batalForm, hapusBaris, ubahQtyItem,
      elCari, cariItemTeks, kategoriFilter, daftarGrid, jumlahDiNota, tambahDariGrid, onKeydownCari,
      popupPengajuanAktif, daftarPengajuan, pengajuanDicentang, bukaCekPengajuan, masukkanPengajuanTerpilih, badgePengajuan,
      menyimpan, simpan, formatQty, formatRupiah, formatDiamSejak
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else-if="mode === 'list'">
      <div v-if="bolehProses" style="margin-bottom:12px;">
        <button @click="bukaFormBaru" class="btn-primary" style="padding:9px 18px;"><i class="fas fa-plus" style="margin-right:6px;"></i>Nota Baru</button>
      </div>
      <div v-if="daftarNota.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-cart-shopping"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada draft nota belanja</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="n in daftarNota" :key="n.id" class="gc-card" style="padding:14px; border-radius:20px; cursor:pointer;" @click="bukaFormEdit(n)">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ n.no_pembelian }}</div>
            <span class="tag" :class="n.status === 'ditolak_acc' ? 'danger' : 'neutral'">{{ n.status === 'ditolak_acc' ? 'ditolak, edit lagi' : 'draft' }}</span>
          </div>
          <div style="font-size:12px; color:var(--text-faint);">{{ n.suplayer_nama }} &middot; {{ (n.items||[]).length }} item &middot; est. {{ formatRupiah(n.estimasi_biaya_belanja) }}</div>
        </div>
      </div>
    </template>
    <template v-else>
      <!-- Layar Nota Order — 2 kolom sesuai wireframe §8.1: kiri grid produk
      (cari/browse), kanan panel Item Nota berkartu dengan stepper qty.
      Suplayer TIDAK jadi field pertama yang wajib diisi lagi (otomatis dari
      Petakan Order saat item pertama ditambah) — dropdown tetap ada di atas
      panel kanan untuk koreksi manual, lihat catatan besar §REVISI di atas. -->
      <div style="display:flex; gap:14px; flex-wrap:wrap; align-items:flex-start;">
        <div style="flex:2; min-width:280px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; gap:8px; align-items:center;">
            <input ref="elCari" v-model="cariItemTeks" @keydown="onKeydownCari" type="text" placeholder="Cari item / scan barcode..." style="flex:1; padding:9px 12px; background:var(--ivory-dim); border-radius:10px; border:1.5px solid var(--line);">
            <button @click="bukaCekPengajuan" class="btn-outline" style="padding:9px 14px; font-size:11.5px; white-space:nowrap; position:relative;">
              <i class="fas fa-inbox" style="margin-right:6px;"></i>Cek Pengajuan
              <span v-if="badgePengajuan > 0" style="position:absolute; top:-6px; right:-6px; min-width:18px; height:18px; padding:0 4px; border-radius:999px; background:var(--danger); color:#fff; font-size:9.5px; font-weight:700; display:flex; align-items:center; justify-content:center;">{{ badgePengajuan }}</span>
            </button>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button @click="kategoriFilter='semua'" class="btn-outline" :class="{ 'btn-primary': kategoriFilter==='semua' }" style="padding:5px 12px; font-size:11px; border-radius:999px;">Semua</button>
            <button @click="kategoriFilter='Bahan'" class="btn-outline" :class="{ 'btn-primary': kategoriFilter==='Bahan' }" style="padding:5px 12px; font-size:11px; border-radius:999px;">Bahan</button>
            <button @click="kategoriFilter='Aksesoris'" class="btn-outline" :class="{ 'btn-primary': kategoriFilter==='Aksesoris' }" style="padding:5px 12px; font-size:11px; border-radius:999px;">Aksesoris</button>
          </div>
          <div v-if="daftarGrid.length === 0" class="gc-kosong gc-card" style="padding:16px;">
            <p style="font-size:11.5px; color:var(--text-faint); margin:0;">Tidak ada bahan/aksesoris yang cocok.</p>
          </div>
          <div v-else style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:8px;">
            <div v-for="b in daftarGrid" :key="b.id" @click="tambahDariGrid(b)" class="gc-card" style="padding:10px; border-radius:14px; cursor:pointer; text-align:center; position:relative;" :style="{ borderColor: jumlahDiNota(b.id) > 0 ? 'var(--burgundy, #6E1E2C)' : undefined }">
              <span v-if="jumlahDiNota(b.id) > 0" style="position:absolute; top:6px; right:6px; width:18px; height:18px; border-radius:50%; background:var(--burgundy, #6E1E2C); color:#fff; font-size:9.5px; font-weight:700; display:flex; align-items:center; justify-content:center;">{{ formatQty(jumlahDiNota(b.id)) }}</span>
              <div style="font-size:11px; font-weight:600; margin-bottom:2px;">{{ b.nama }} <span v-if="b.warna" style="color:var(--text-faint); font-weight:400;">{{ b.warna }}</span></div>
              <div style="font-size:9.5px; color:var(--text-faint);">{{ b.satuan_pembelian || '-' }}</div>
            </div>
          </div>
        </div>

        <div style="flex:1; min-width:260px; display:flex; flex-direction:column; gap:9px; position:sticky; top:8px;">
          <div style="display:flex; align-items:baseline; gap:8px;">
            <span class="gc-heading" style="font-weight:700; font-size:13px;">Item Nota</span>
            <span style="padding:2px 8px; border-radius:999px; background:var(--ivory-dim); font-size:10.5px;">{{ items.length }} item</span>
          </div>
          <div class="gc-field" style="margin-bottom:0;">
            <label style="font-size:10px;">Suplayer <span style="font-weight:400; color:var(--text-faint);">(otomatis dari Petakan Order, bisa diganti)</span></label>
            <select v-model="suplayerId" style="width:100%; padding:8px; border-radius:10px; border:1.5px solid var(--line); font-size:12px;">
              <option value="">— pilih suplayer —</option>
              <option v-for="s in daftarSuplayer" :key="s.id" :value="s.id">{{ s.nama }}</option>
            </select>
          </div>

          <div v-if="items.length === 0" class="gc-kosong gc-card" style="padding:14px;">
            <p style="font-size:11.5px; color:var(--text-faint); margin:0;">Belum ada item — klik kartu produk di kiri.</p>
          </div>
          <div v-else style="display:flex; flex-direction:column; gap:7px; max-height:52vh; overflow-y:auto;">
            <div v-for="(it,idx) in items" :key="idx" class="gc-card" style="padding:9px 10px; border-radius:12px;">
              <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:5px;">
                <div style="min-width:0;">
                  <div style="font-size:11.5px; font-weight:600;">{{ it.nama_alias || it.nama_internal }}</div>
                  <div v-if="it.suplayer_default_nama" style="font-size:9.5px; color:var(--text-faint);">{{ it.suplayer_default_nama }}<span v-if="suplayerAktif && it.suplayer_default_nama !== suplayerAktif.nama" style="color:var(--warn); margin-left:4px;">&middot; suplayer beda dari nota</span></div>
                </div>
                <button @click="hapusBaris(idx)" style="border:none; background:none; color:var(--text-faint); cursor:pointer; font-size:12px; flex-shrink:0;"><i class="fas fa-xmark"></i></button>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <button @click="ubahQtyItem(idx, -1)" class="btn-outline" style="padding:3px 9px; font-size:12px;">-</button>
                <input v-model.number="it.qty" type="number" min="0" class="gc-num" style="width:52px; text-align:center; border:1px solid var(--line); border-radius:7px; padding:4px;">
                <button @click="ubahQtyItem(idx, 1)" class="btn-outline" style="padding:3px 9px; font-size:12px;">+</button>
                <span style="font-size:10px; color:var(--text-faint);">{{ it.satuan }}</span>
                <span style="font-size:10px; color:var(--text-faint); margin-left:auto;">×</span>
                <input v-model.number="it.harga_estimasi" type="number" min="0" class="gc-num" style="width:78px; text-align:right; border:1px solid var(--line); border-radius:7px; padding:4px; font-size:11px;">
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                <span v-if="it.dari_masalah_id" style="display:inline-flex; padding:1px 7px; border:1px dashed var(--burgundy, #6E1E2C); border-radius:999px; font-size:9px; color:var(--burgundy, #6E1E2C);">bahan kurang</span>
                <span v-else></span>
                <span class="gc-num" style="font-weight:700; font-size:11.5px;">{{ formatRupiah((it.qty||0) * (it.harga_estimasi||0)) }}</span>
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:baseline; border-top:1.5px solid var(--line); padding-top:9px;">
            <span style="font-size:11px; color:var(--text-faint);">TOTAL</span>
            <span class="gc-num" style="font-weight:700; font-size:16px;">{{ formatRupiah(totalEstimasi) }}</span>
          </div>
          <div style="display:flex; gap:8px;">
            <button @click="batalForm" :disabled="menyimpan" class="btn-outline" style="flex:1; padding:9px; font-size:11.5px;">Batal</button>
            <button @click="simpan('draft')" :disabled="menyimpan" class="btn-outline" style="flex:1; padding:9px; font-size:11.5px;">Simpan Draft</button>
            <button @click="simpan('menunggu_acc')" :disabled="menyimpan" class="btn-primary" style="flex:1; padding:9px; font-size:11.5px;">Generate Order</button>
          </div>
        </div>
      </div>
    </template>

    <div v-if="popupPengajuanAktif" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:480px; width:100%; padding:18px; border-radius:18px; max-height:80vh; overflow-y:auto;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Cek Pengajuan dari Masalah</h3>
        <div v-if="daftarPengajuan.length === 0" style="font-size:12px; color:var(--text-faint); margin-bottom:12px;">Tidak ada pengajuan yang menunggu dibelikan.</div>
        <div v-else style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">
          <label v-for="m in daftarPengajuan" :key="m.id" style="display:flex; align-items:center; gap:8px; padding:8px; border-radius:8px; background:var(--ivory-dim); font-size:12px;">
            <input type="checkbox" v-model="pengajuanDicentang[m.id]" class="gc-chk">
            <span>{{ m.bahan_nama }}<span v-if="m.bahan_warna"> {{ m.bahan_warna }}</span> — {{ formatQty(m.qty_beli) }} {{ m.satuan }} <span style="color:var(--text-faint);">({{ m.no_spk }})</span></span>
          </label>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="popupPengajuanAktif = false" class="btn-outline" style="flex:1; padding:9px;">Tutup</button>
          <button @click="masukkanPengajuanTerpilih" class="btn-primary" style="flex:1; padding:9px;">Masukkan ke Nota</button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// TAB 2 (8.1.3): Menunggu ACC — Owner/PIC Owner Setuju/Tolak, generate
// order_belanja_driver saat Setuju (keputusan #3/#4/#10).
//
// REVISI (9 Sep 2026 malam, permintaan Guru) — nota BOLEH multi-suplayer.
// Sebelumnya 1 nota -> 1 order_belanja_driver (suplayer tunggal dari
// suplayerId nota). Sekarang tiap item dikelompokkan ke suplayer DEFAULT-nya
// sendiri (suplayer_default_id, dari Petakan Order/alias_pembelian.
// is_default_order, disnapshot saat item ditambahkan di Persiapan Admin —
// lihat tambahBahanKeItem/masukkanPengajuanTerpilih). Item TANPA default
// (suplayer_default_id kosong) jatuh ke kelompok fallback = suplayer nota
// (suplayerId/suplayer_nama) — supaya tidak ada item yang "hilang" tanpa
// tujuan. kelompokPerSuplayer() dipakai untuk DUA hal: (a) ringkasan visual
// di kartu Menunggu ACC (wireframe 8.1.2: "ringkasan per suplayer: jumlah
// item, total estimasi"), (b) split nyata jadi banyak order_belanja_driver
// saat Setuju — List Order Driver & Riwayat Belanja SUDAH baca langsung dari
// koleksi order_belanja_driver (bukan lewat pesanan_pembelian.order_driver_id
// tunggal), jadi otomatis tampil "kartu per suplayer" begitu displit di sini,
// TANPA perlu ubah kode di ListOrderDriver/RiwayatBelanja.
// ============================================================================
function kelompokPerSuplayer(n) {
  const map = new Map();
  (n.items || []).forEach(it => {
    const pakaiDefault = !!it.suplayer_default_id;
    const key = pakaiDefault ? it.suplayer_default_id : ('__fallback_' + (n.suplayer_id || ''));
    const nama = pakaiDefault ? (it.suplayer_default_nama || '-') : (n.suplayer_nama || 'Tanpa suplayer');
    const suplayerId = pakaiDefault ? it.suplayer_default_id : (n.suplayer_id || '');
    if (!map.has(key)) map.set(key, { suplayer_id: suplayerId, suplayer_nama: nama, items: [], total: 0, jumlahItem: 0 });
    const grp = map.get(key);
    grp.items.push(it);
    grp.jumlahItem++;
    grp.total += (parseFloat(it.qty) || 0) * (parseFloat(it.harga_estimasi) || 0);
  });
  return Array.from(map.values());
}
const MenungguAccBelanja = {
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const sayaOwnerKeAtas = computed(() => tierOwnerKeAtas(window.currentUser));

    async function muat() {
      memuat.value = true;
      try {
        daftar.value = (await muatSemuaPesananPembelian())
          .filter(n => n.order_driver_id !== undefined && n.status === 'menunggu_acc')
          .sort((a, b) => new Date(a.diajukan_pada || 0) - new Date(b.diajukan_pada || 0))
          .map(n => ({ ...n, _kelompok: kelompokPerSuplayer(n) }));
      }
      catch (e) { console.error('Gagal muat Menunggu ACC:', e); daftar.value = []; }
      memuat.value = false;
    }

    const sedangProses = reactive({});
    async function setujui(n) {
      if (!sayaOwnerKeAtas.value) return alert('Hanya Owner/PIC Owner yang boleh menyetujui.');
      const kelompok = n._kelompok && n._kelompok.length ? n._kelompok : kelompokPerSuplayer(n);
      const pesanKonfirmasi = kelompok.length > 1
        ? `Setujui nota ${n.no_pembelian}? Akan dipecah jadi ${kelompok.length} order driver (per suplayer): ${kelompok.map(g => g.suplayer_nama).join(', ')}.`
        : `Setujui nota ${n.no_pembelian} dan generate order ke driver?`;
      if (!confirm(pesanKonfirmasi)) return;
      sedangProses[n.id] = true;
      try {
        const now = new Date().toISOString();
        const idOrderBaru = [];
        // Sengaja SEKUENSIAL (bukan Promise.all) — generateKodeOrderDriver()
        // pakai runTransaction pada 1 dokumen counter yang sama, aman
        // dipanggil berurutan tapi TIDAK aman diparalelkan (race condition
        // pada baca-tulis counter yang sama).
        for (const g of kelompok) {
          const kodeOrder = await generateKodeOrderDriver();
          const refOrder = await addDoc(collection(db, 'order_belanja_driver'), {
            kode_order: kodeOrder, suplayer_id: g.suplayer_id, suplayer_nama: g.suplayer_nama,
            items: g.items.map(it => ({
              bahan_aksesoris_id: it.bahan_aksesoris_id, nama_internal: it.nama_internal, nama_alias: it.nama_alias || '',
              qty: it.qty, satuan: it.satuan, harga_estimasi: it.harga_estimasi || 0, subtotal: (it.qty || 0) * (it.harga_estimasi || 0)
            })),
            total_estimasi: g.total,
            status: 'disetujui',
            sumber_masalah_ids: n.sumber_masalah_ids || [],
            pesanan_pembelian_id: n.id,
            dibuat_oleh: n.dibuat_oleh || '',
            disetujui_oleh: window.currentUser?.email || '', disetujui_pada: now,
            dibuat_pada: serverTimestamp()
          });
          idOrderBaru.push(refOrder.id);
        }
        await updateDoc(doc(db, 'pesanan_pembelian', n.id), {
          status: 'disetujui',
          order_driver_id: idOrderBaru[0] || null, // dipertahankan (kompatibel lama, order pertama)
          order_driver_ids: idOrderBaru, // BARU — daftar LENGKAP kalau displit multi-suplayer
          disetujui_oleh: window.currentUser?.email || '', disetujui_pada: now
        });
        await muat();
      } catch (e) { console.error('Gagal setujui nota belanja:', e); alert('Gagal menyimpan. Coba lagi.'); }
      sedangProses[n.id] = false;
    }
    async function tolak(n) {
      if (!sayaOwnerKeAtas.value) return alert('Hanya Owner/PIC Owner yang boleh menolak.');
      const catatan = prompt('Alasan ditolak (opsional):') || '';
      sedangProses[n.id] = true;
      try {
        await updateDoc(doc(db, 'pesanan_pembelian', n.id), { status: 'ditolak_acc', catatan_tolak: catatan.trim(), ditolak_oleh: window.currentUser?.email || '', ditolak_pada: new Date().toISOString() });
        await muat();
      } catch (e) { console.error('Gagal tolak nota belanja:', e); alert('Gagal menyimpan. Coba lagi.'); }
      sedangProses[n.id] = false;
    }

    onMounted(async () => { await window.authReady; await muat(); });

    return { memuat, daftar, sayaOwnerKeAtas, sedangProses, setujui, tolak, formatRupiah, formatDiamSejak };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div v-if="daftar.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-hourglass-half"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada nota yang menunggu ACC</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="n in daftar" :key="n.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ n.no_pembelian }}</div>
            <span class="tag warn">diajukan {{ formatDiamSejak(n.diajukan_pada) }} lalu</span>
          </div>
          <div v-if="n._kelompok.length > 1" style="margin-bottom:8px; display:flex; flex-direction:column; gap:4px;">
            <div v-for="g in n._kelompok" :key="g.suplayer_id || g.suplayer_nama" style="display:flex; justify-content:space-between; font-size:11.5px; background:var(--ivory-dim); border-radius:8px; padding:5px 9px;">
              <span style="font-weight:600;">{{ g.suplayer_nama }}</span>
              <span style="color:var(--text-faint);">{{ g.jumlahItem }} item &middot; {{ formatRupiah(g.total) }}</span>
            </div>
          </div>
          <div v-else style="font-size:12px; color:var(--text-faint); margin-bottom:6px;">{{ n.suplayer_nama }} &middot; {{ (n.items||[]).length }} item &middot; est. {{ formatRupiah(n.estimasi_biaya_belanja) }}</div>
          <div style="font-size:11px; color:var(--text-faint); margin-bottom:10px;">diajukan oleh {{ n.diajukan_oleh || '-' }}<span v-if="n._kelompok.length > 1"> &middot; total {{ n._kelompok.length }} suplayer, est. {{ formatRupiah(n.estimasi_biaya_belanja) }}</span></div>
          <div v-if="sayaOwnerKeAtas" style="display:flex; gap:8px;">
            <button @click="tolak(n)" :disabled="sedangProses[n.id]" class="btn-outline" style="flex:1; padding:9px; color:var(--danger);">Tolak</button>
            <button @click="setujui(n)" :disabled="sedangProses[n.id]" class="btn-primary" style="flex:1; padding:9px;">Setujui</button>
          </div>
          <p v-else style="font-size:11px; color:var(--text-faint);">Hanya Owner/PIC Owner yang bisa memutuskan.</p>
        </div>
      </div>
    </template>
  `
};

// ============================================================================
// TAB 3 (8.2): List Order Driver — mobile-first, 2 sub-tab internal (List
// Order / List Pending). Titik tiga -> format WA (keputusan #6), Pending,
// Beli (upload bon, keputusan #3).
// ============================================================================
const ListOrderDriver = {
  setup() {
    const menuId = MENU_ID;
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const memuat = ref(true);
    const subTab = ref('order'); // 'order' | 'pending'
    const daftarOrder = ref([]);
    const daftarPending = ref([]);
    const petaSuplayer = ref({});

    async function muat() {
      memuat.value = true;
      try {
        const [order, pending, suplayer] = await Promise.all([muatSemuaOrderBelanjaDriver(), muatSemuaPendingDriver(), ambilDaftarSuplayer()]);
        daftarOrder.value = order.filter(o => o.status === 'disetujui');
        daftarPending.value = pending.filter(p => p.status === 'pending');
        const peta = {}; suplayer.forEach(s => { peta[s.id] = s; }); petaSuplayer.value = peta;
      } catch (e) { console.error('Gagal muat List Order Driver:', e); daftarOrder.value = []; daftarPending.value = []; }
      memuat.value = false;
    }

    const menuTerbuka = ref(null);
    function toggleMenu(id) { menuTerbuka.value = menuTerbuka.value === id ? null : id; }

    // --- Format WA (keputusan #6, template tetap) ---------------------------
    function bukaFormatWa(o) {
      menuTerbuka.value = null;
      const s = petaSuplayer.value[o.suplayer_id];
      const baris = (o.items || []).map((it, i) => `${i + 1}. ${it.nama_alias || it.nama_internal} - ${it.qty} ${it.satuan}`).join('\n');
      const teks = `Halo ${o.suplayer_nama}, mohon disiapkan pesanan berikut:\n${baris}\n\nTotal estimasi: ${formatRupiah(o.total_estimasi)}\nTerima kasih.`;
      const nomor = (s?.no_wa || '').replace(/[^0-9]/g, '');
      if (!nomor) { alert('Nomor WA suplayer ini belum diisi (Zevanic House > Master Suplayer).'); return; }
      window.open(`https://wa.me/${nomor}?text=${encodeURIComponent(teks)}`, '_blank');
    }

    // --- Ubah qty (minus, keputusan #7: tidak bisa tambah item baru) --------
    function kurangiQty(o, it) {
      if (!bolehProses.value) return;
      it.qty = Math.max(0, (parseFloat(it.qty) || 0) - 1);
      updateDoc(doc(db, 'order_belanja_driver', o.id), { items: o.items }).catch(e => console.error('Gagal update qty order driver:', e));
    }

    // --- Pending ---------------------------------------------------------
    const popupPending = ref(null);
    function bukaPending(o, it) { menuTerbuka.value = null; popupPending.value = { order: o, item: it }; }
    async function konfirmasiPending() {
      const p = popupPending.value;
      if (!p) return;
      try {
        await addDoc(collection(db, 'pending_driver'), {
          order_driver_id: p.order.id, bahan_aksesoris_id: p.item.bahan_aksesoris_id, nama_item: p.item.nama_alias || p.item.nama_internal,
          qty: p.item.qty, satuan: p.item.satuan, suplayer_asal_id: p.order.suplayer_id, suplayer_baru_id: null,
          status: 'pending', dicatat_oleh: window.currentUser?.email || '', dibuat_pada: serverTimestamp()
        });
        p.order.items = p.order.items.filter(it => it !== p.item);
        await updateDoc(doc(db, 'order_belanja_driver', p.order.id), { items: p.order.items });
        popupPending.value = null;
        await muat();
      } catch (e) { console.error('Gagal catat pending:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    // --- Assign ulang (keputusan #9, minimal) -------------------------------
    const popupAssign = ref(null);
    const daftarSuplayerSemua = ref([]);
    function bukaAssign(p) { popupAssign.value = { pending: p, suplayerBaruId: '' }; }
    async function konfirmasiAssign() {
      const a = popupAssign.value;
      if (!a || !a.suplayerBaruId) { alert('Pilih suplayer baru dulu.'); return; }
      try {
        await updateDoc(doc(db, 'pending_driver', a.pending.id), { suplayer_baru_id: a.suplayerBaruId, status: 'reassigned' });
        popupAssign.value = null;
        await muat();
      } catch (e) { console.error('Gagal assign ulang:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    // --- Beli (upload bon, keputusan #3) ------------------------------------
    const popupBeli = ref(null);
    const fotoBonFile = ref(null);
    const menyimpanBeli = ref(false);
    function bukaBeli(o) { menuTerbuka.value = null; fotoBonFile.value = null; popupBeli.value = o; }
    function pilihFotoBon(e) { fotoBonFile.value = e.target.files?.[0] || null; }
    async function konfirmasiBeli() {
      const o = popupBeli.value;
      if (!o) return;
      if (!fotoBonFile.value) { alert('Upload foto bon dulu.'); return; }
      menyimpanBeli.value = true;
      try {
        const urlBon = await uploadFotoBonLokal(o.kode_order, fotoBonFile.value);
        const now = new Date().toISOString();
        await updateDoc(doc(db, 'order_belanja_driver', o.id), { status: 'dibeli', foto_bon: urlBon, dibeli_oleh: window.currentUser?.email || '', dibeli_pada: now });
        if (o.pesanan_pembelian_id) {
          await updateDoc(doc(db, 'pesanan_pembelian', o.pesanan_pembelian_id), {
            items: o.items, foto_bon: urlBon, status: 'siap_finalisasi', dibeli_oleh: window.currentUser?.email || '', dibeli_pada: now
          });
        }
        alert(`Order ${o.kode_order} tercatat dibeli. Nota siap difinalkan di Stok & Pembelian.`);
        popupBeli.value = null;
        await muat();
      } catch (e) { console.error('Gagal simpan Beli:', e); alert('Gagal menyimpan. Coba lagi.'); }
      menyimpanBeli.value = false;
    }

    onMounted(async () => {
      await window.authReady;
      daftarSuplayerSemua.value = await ambilDaftarSuplayer();
      await muat();
    });

    return {
      bolehProses, memuat, subTab, daftarOrder, daftarPending, daftarSuplayerSemua,
      menuTerbuka, toggleMenu, bukaFormatWa, kurangiQty,
      popupPending, bukaPending, konfirmasiPending,
      popupAssign, bukaAssign, konfirmasiAssign,
      popupBeli, bukaBeli, pilihFotoBon, konfirmasiBeli, menyimpanBeli,
      formatQty, formatRupiah
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <button @click="subTab = 'order'" class="btn-outline" :class="{ 'btn-primary': subTab === 'order' }" style="flex:1; padding:9px;">List Order</button>
        <button @click="subTab = 'pending'" class="btn-outline" :class="{ 'btn-primary': subTab === 'pending' }" style="flex:1; padding:9px;">List Pending</button>
      </div>

      <template v-if="subTab === 'order'">
        <div v-if="daftarOrder.length === 0" class="gc-kosong gc-card">
          <div class="lingkaran"><i class="fas fa-truck"></i></div>
          <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada order yang perlu dibeli</h3>
        </div>
        <div v-else style="display:flex; flex-direction:column; gap:10px;">
          <div v-for="o in daftarOrder" :key="o.id" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px; position:relative;">
            <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:8px;">
              <div class="gc-num" style="font-weight:700; font-size:13px;">{{ o.suplayer_nama }}</div>
              <button @click="toggleMenu(o.id)" class="btn-outline" style="padding:4px 10px;"><i class="fas fa-ellipsis-vertical"></i></button>
            </div>
            <div v-if="menuTerbuka === o.id" style="position:absolute; right:14px; top:44px; z-index:20; background:var(--surface, #fff); border:1px solid var(--line); border-radius:10px; box-shadow:0 4px 12px rgba(0,0,0,.12); overflow:hidden;">
              <button @click="bukaFormatWa(o)" style="display:block; width:100%; text-align:left; padding:10px 16px; font-size:12px; background:none; border:none;"><i class="fab fa-whatsapp" style="margin-right:8px; color:#25D366;"></i>Format WA</button>
            </div>
            <div v-for="it in o.items" :key="it.bahan_aksesoris_id" style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--line); font-size:12px;">
              <span>{{ it.nama_alias || it.nama_internal }}</span>
              <div style="display:flex; align-items:center; gap:6px;">
                <button v-if="bolehProses" @click="kurangiQty(o, it)" class="btn-outline" style="padding:2px 8px; font-size:11px;">-</button>
                <span class="gc-num">{{ formatQty(it.qty) }} {{ it.satuan }}</span>
                <button v-if="bolehProses" @click="bukaPending(o, it)" class="btn-outline" style="padding:3px 8px; font-size:10px; color:var(--warn);">Pending</button>
              </div>
            </div>
            <div style="display:flex; justify-content:space-between; margin:10px 0;">
              <span style="font-size:11.5px; color:var(--text-faint);">Total estimasi</span>
              <span class="gc-num" style="font-weight:700;">{{ formatRupiah(o.total_estimasi) }}</span>
            </div>
            <button v-if="bolehProses" @click="bukaBeli(o)" class="btn-primary" style="width:100%; padding:9px;"><i class="fas fa-bag-shopping" style="margin-right:6px;"></i>Beli</button>
          </div>
        </div>
      </template>

      <template v-else>
        <div v-if="daftarPending.length === 0" class="gc-kosong gc-card">
          <div class="lingkaran"><i class="fas fa-clock"></i></div>
          <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada item pending</h3>
        </div>
        <div v-else style="display:flex; flex-direction:column; gap:10px;">
          <div v-for="p in daftarPending" :key="p.id" class="gc-card" style="padding:14px; border-radius:20px;">
            <div class="gc-num" style="font-weight:700; font-size:13px; margin-bottom:4px;">{{ p.nama_item }}</div>
            <div style="font-size:12px; color:var(--text-faint); margin-bottom:10px;">{{ formatQty(p.qty) }} {{ p.satuan }}</div>
            <button v-if="bolehProses" @click="bukaAssign(p)" class="btn-outline" style="width:100%; padding:8px; font-size:11.5px;">Assign Ulang Suplayer</button>
          </div>
        </div>
      </template>
    </template>

    <div v-if="popupPending" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:340px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Pindah ke Pending?</h3>
        <p style="font-size:12px; color:var(--text-faint); margin-bottom:14px;">"{{ popupPending.item.nama_alias || popupPending.item.nama_internal }}" tidak tersedia di suplayer ini — pindah ke daftar Pending.</p>
        <div style="display:flex; gap:8px;">
          <button @click="popupPending = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiPending" class="btn-primary" style="flex:1; padding:9px;">Ya, Pending</button>
        </div>
      </div>
    </div>

    <div v-if="popupAssign" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:340px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Assign Ulang — {{ popupAssign.pending.nama_item }}</h3>
        <div class="gc-field" style="margin-bottom:14px;">
          <label>Suplayer Baru</label>
          <select v-model="popupAssign.suplayerBaruId" style="width:100%; padding:9px; border-radius:10px; border:1.5px solid var(--line);">
            <option value="">— pilih suplayer —</option>
            <option v-for="s in daftarSuplayerSemua" :key="s.id" :value="s.id">{{ s.nama }}</option>
          </select>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="popupAssign = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiAssign" class="btn-primary" style="flex:1; padding:9px;">Simpan</button>
        </div>
      </div>
    </div>

    <div v-if="popupBeli" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:380px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Beli — {{ popupBeli.suplayer_nama }}</h3>
        <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:10px;">Upload foto bon sesudah bayar. Nota akan diteruskan ke Stok &amp; Pembelian untuk difinalkan.</p>
        <input type="file" accept="image/*" @change="pilihFotoBon" style="margin-bottom:14px;">
        <div style="display:flex; gap:8px;">
          <button @click="popupBeli = null" :disabled="menyimpanBeli" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiBeli" :disabled="menyimpanBeli" class="btn-primary" style="flex:1; padding:9px;">{{ menyimpanBeli ? 'Menyimpan...' : 'Konfirmasi Beli' }}</button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// TAB 4 (8.3): Riwayat Belanja — read-only, kartu per order_belanja_driver
// berstatus dibeli/selesai.
// ============================================================================
const RiwayatBelanja = {
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const kataKunci = ref('');

    async function muat() {
      memuat.value = true;
      try { daftar.value = (await muatSemuaOrderBelanjaDriver()).filter(o => o.status === 'dibeli' || o.status === 'selesai').sort((a, b) => new Date(b.dibeli_pada || 0) - new Date(a.dibeli_pada || 0)); }
      catch (e) { console.error('Gagal muat Riwayat Belanja:', e); daftar.value = []; }
      memuat.value = false;
    }
    const daftarTersaring = computed(() => {
      const kata = kataKunci.value.trim().toLowerCase();
      if (!kata) return daftar.value;
      return daftar.value.filter(o => (o.suplayer_nama || '').toLowerCase().includes(kata) || (o.kode_order || '').toLowerCase().includes(kata));
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return { memuat, daftarTersaring, kataKunci, formatRupiah, formatWaktu, formatQty };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <template v-else>
      <input v-model="kataKunci" type="text" placeholder="Cari kode order / suplayer..." style="width:100%; margin-bottom:12px; padding:8px; background:var(--ivory-dim); border-radius:10px; border:1px solid var(--line);">
      <div v-if="daftarTersaring.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-receipt"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada riwayat belanja</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="o in daftarTersaring" :key="o.id" class="gc-card" style="padding:14px; border-radius:20px;">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;">
            <div class="gc-num" style="font-weight:700; font-size:13px;">{{ o.kode_order }}</div>
            <span class="tag ok">{{ o.status }}</span>
          </div>
          <div style="font-size:12px; color:var(--text-faint); margin-bottom:6px;">{{ o.suplayer_nama }} &middot; {{ (o.items||[]).length }} item &middot; {{ formatRupiah(o.total_estimasi) }}</div>
          <div style="font-size:11px; color:var(--text-faint); margin-bottom:8px;">dibeli oleh {{ o.dibeli_oleh || '-' }} &middot; {{ formatWaktu(o.dibeli_pada) }}</div>
          <a v-if="o.foto_bon" :href="o.foto_bon" target="_blank" class="btn-outline" style="display:inline-block; padding:6px 14px; font-size:11px;"><i class="fas fa-receipt" style="margin-right:6px;"></i>Lihat Foto Bon</a>
        </div>
      </div>
    </template>
  `
};

// --- Mount ke index.html — LAZY, SAMA pola modul lain. -----------------------
let vmPpBelanjaPersiapanAdmin = null;
window.pastikanMountPpBelanjaPersiapanAdmin = function () {
  if (vmPpBelanjaPersiapanAdmin) return;
  const mountPoint = document.getElementById('vue-pp-belanja-persiapanadmin');
  if (mountPoint) vmPpBelanjaPersiapanAdmin = createApp(PersiapanAdminBelanja).mount('#vue-pp-belanja-persiapanadmin');
};
let vmPpBelanjaMenungguAcc = null;
window.pastikanMountPpBelanjaMenungguAcc = function () {
  if (vmPpBelanjaMenungguAcc) return;
  const mountPoint = document.getElementById('vue-pp-belanja-menungguacc');
  if (mountPoint) vmPpBelanjaMenungguAcc = createApp(MenungguAccBelanja).mount('#vue-pp-belanja-menungguacc');
};
let vmPpBelanjaListOrderDriver = null;
window.pastikanMountPpBelanjaListOrderDriver = function () {
  if (vmPpBelanjaListOrderDriver) return;
  const mountPoint = document.getElementById('vue-pp-belanja-listorderdriver');
  if (mountPoint) vmPpBelanjaListOrderDriver = createApp(ListOrderDriver).mount('#vue-pp-belanja-listorderdriver');
};
let vmPpBelanjaRiwayat = null;
window.pastikanMountPpBelanjaRiwayat = function () {
  if (vmPpBelanjaRiwayat) return;
  const mountPoint = document.getElementById('vue-pp-belanja-riwayat');
  if (mountPoint) vmPpBelanjaRiwayat = createApp(RiwayatBelanja).mount('#vue-pp-belanja-riwayat');
};
