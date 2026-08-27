// js/vue-config-akses.js
// ============================================================================
// Master Karyawan > Config Akses — buat & atur PROFIL AKSES bernama bebas
// (bukan cuma 5 role baku). Tiap profil punya izin View/Add/Edit/Delete/
// Print per menu, dikelompokkan per kategori (bisa dilipat/dibuka).
//
// PENERAPAN (update 17 Agt 2026): View menu (Home mobile) dan tombol Add/
// Edit/Delete/Print di beberapa layar SUDAH menerapkan izin dari sini
// secara nyata (lihat window.cekIzinMenu/cekFiturAkses di auth.js, dan
// STATUS-PROYEK.md untuk daftar layar mana saja yang sudah/belum). Ini
// murni PENERAPAN DI TAMPILAN (client-side) — keputusan sadar, BUKAN
// jadi batas keamanan Firestore Rules (itu tetap di 4 tingkat role baku,
// biar tidak nambah biaya baca per operasi tulis).
//
// KARENA rules tetap di tingkat role baku, tapi profil di sini boleh
// bernama BEBAS (mis. "admin_finance") — tiap profil WAJIB pilih 1 dari
// 5 tingkat baku sebagai "tingkatKeamanan"-nya (lihat bagian atas form).
// Itu yang benar-benar dikirim ke Firestore Rules lewat custom claim;
// nama profil sendiri cuma dipakai buat cari izin tampilan di sini.
//
// Akses ke layar ini SENGAJA dibatasi khusus Owner (lihat auth.js).
// ============================================================================
import { createApp, ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const TINGKAT_KEAMANAN_BAKU = ['operator', 'pic', 'admin', 'owner', 'superuser'];

// BARU (27 Agt 2026, §27 — Redesain Home Mobile) — tiap menu SEKARANG juga
// punya `icon` (kelas FontAwesome) dan `aksi` (function pindah tab/sub-tab,
// SAMA PERSIS dengan yang dipanggil tombol sidebar-nya masing-masing di
// index.html). INI YANG BIKIN DAFTAR_MENU BENERAN "satu sumber kebenaran":
// grid menu Home mobile (js/vue-home.js, lewat daftarMenuGroups() di
// vue-components.js) sekarang MEMBACA icon+aksi langsung dari sini, BUKAN
// disalin tangan ke daftar terpisah lagi seperti sebelumnya (itu yang bikin
// Home mobile ketinggalan — lihat STATUS-PROYEK.md §27). Tambah menu baru
// di sini SATU TEMPAT SAJA (kasih icon+aksi-nya sekalian) -> otomatis
// nongol juga di Home mobile, tanpa perlu file lain diubah.
//
// `deprecated: true` = menu ini SENGAJA disembunyikan dari Home mobile
// (entry-nya dibiarkan di sini biar data izin lama tidak yatim, sama
// seperti alasan aslinya) — TIDAK butuh icon/aksi.
// `wajibOwner: true` = TAMBAHAN pengunci di ATAS izin Config Akses biasa —
// menu ini di Home mobile TETAP terkunci utk siapapun SELAIN role 'owner'
// asli, APAPUN hasil Config Akses-nya. Dipakai cuma utk 2 menu yang
// memang sudah lama begini di sidebar desktop (Config Akses & Hak Akses,
// lihat id="btn-sub-karyawan-akses"/"btn-sub-karyawan-hakakses" di
// index.html) + Device Kiosk (List Device Kiosk) — supaya perilakunya
// konsisten sama di mobile.
const DAFTAR_MENU = [
  { id: 'dashboard', label: 'Dashboard', kategori: 'Umum' },
  { id: 'profile', label: 'Profile', kategori: 'Umum' },
  // fiturList = kontrol granular OPSIONAL per menu, di luar View/Add/Edit/
  // Delete/Print baku — dipakai buat kunci field/dropdown SPESIFIK di
  // dalam form menu itu (bukan seluruh menunya). Contoh nyata: dropdown
  // "Jenis Lokasi" di form Master Gudang, defaultnya Tetap untuk non-
  // Owner, cuma Owner yang bisa buka opsi Dinamis. Kalau nanti ada
  // kebutuhan serupa (kunci field lain), TAMBAHKAN entry baru di
  // fiturList menu terkait di sini — JANGAN bikin mekanisme baru,
  // panggil window.cekFiturAkses(menuId, fiturKey) di titik yang mau
  // dikunci (lihat auth.js untuk definisi fungsinya).
  { id: 'config_absensi', label: 'Config Absensi', kategori: 'Master Absensi', icon: 'fa-gear',
    aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-config', null); },
    fiturList: [
    { key: 'ubah_jenis_lokasi', label: 'Boleh ubah Jenis Lokasi gudang (Tetap/Dinamis)' }
  ] },
  { id: 'penjadwalan', label: 'Penjadwalan', kategori: 'Master Absensi', icon: 'fa-calendar-days',
    aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-jadwal', null); } },
  { id: 'antrean_absensi', label: 'Antrean Absensi', kategori: 'Master Absensi', icon: 'fa-clipboard-check',
    aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-accept', null); } },
  { id: 'antrean_lembur', label: 'Antrean Lembur', kategori: 'Master Absensi', icon: 'fa-business-time',
    aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-lembur', null); } },
  { id: 'antrean_reimburse', label: 'Antrean Reimburse', kategori: 'Master Keuangan', icon: 'fa-receipt',
    aksi: () => { window.pindahTab('tab-keuangan'); window.pindahSubTab('sub-keuangan', 'sub-keuangan-antrean', null); } },
  { id: 'master_kendaraan', label: 'Master Kendaraan', kategori: 'Master Keuangan', icon: 'fa-truck',
    aksi: () => { window.pindahTab('tab-keuangan'); window.pindahSubTab('sub-keuangan', 'sub-keuangan-kendaraan', null); } },
  { id: 'riwayat_reimburse', label: 'Riwayat Reimburse', kategori: 'Master Keuangan', icon: 'fa-clock-rotate-left',
    aksi: () => { window.pindahTab('tab-keuangan'); window.pindahSubTab('sub-keuangan', 'sub-keuangan-riwayat-reimburse', null); } },
  { id: 'riwayat_bensin', label: 'Riwayat Isi Bensin', kategori: 'Master Keuangan', icon: 'fa-gas-pump',
    aksi: () => { window.pindahTab('tab-keuangan'); window.pindahSubTab('sub-keuangan', 'sub-keuangan-riwayat-bensin', null); } },
  { id: 'riwayat_servis', label: 'Riwayat Servis', kategori: 'Master Keuangan', icon: 'fa-wrench',
    aksi: () => { window.pindahTab('tab-keuangan'); window.pindahSubTab('sub-keuangan', 'sub-keuangan-riwayat-servis', null); } },
  { id: 'master_keuangan', label: 'Master Keuangan', kategori: 'Master Keuangan', icon: 'fa-tags',
    aksi: () => { window.pindahTab('tab-keuangan'); window.pindahSubTab('sub-keuangan', 'sub-keuangan-kategori', null); } },
  { id: 'riwayat_absensi', label: 'Riwayat All Absensi', kategori: 'Master Absensi', icon: 'fa-clock-rotate-left',
    aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-rekap', null); } },
  { id: 'antrean_dakar', label: 'Antrean Dakar', kategori: 'Master Karyawan', icon: 'fa-user-clock',
    aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-antrean', null); } },
  { id: 'config_karyawan', label: 'Config Karyawan', kategori: 'Master Karyawan', icon: 'fa-sliders',
    aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-config', null); } },
  { id: 'daftar_karyawan', label: 'Daftar Karyawan', kategori: 'Master Karyawan', icon: 'fa-users',
    aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-data', null); } },
  { id: 'config_info', label: 'Config Info', kategori: 'Master Karyawan', icon: 'fa-bullhorn',
    aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-info', null); } },
  { id: 'slip_gaji', label: 'Slip Gaji', kategori: 'Master Karyawan', icon: 'fa-file-invoice-dollar',
    aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-slip', null); } },
  { id: 'payroll', label: 'Payroll', kategori: 'Master Karyawan', icon: 'fa-money-check-dollar',
    aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-payroll', null); } },
  { id: 'config_akses', label: 'Config Akses', kategori: 'Master Karyawan', icon: 'fa-shield-halved', wajibOwner: true,
    aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-akses', null); } },
  { id: 'hak_akses', label: 'Hak Akses', kategori: 'Master Karyawan', icon: 'fa-user-shield', wajibOwner: true,
    aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-hakakses', null); } },
  { id: 'whatsapp_gateway', label: 'WhatsApp Gateway', kategori: 'Master Integrasi', icon: 'fa-comment-dots',
    aksi: () => { window.pindahTab('tab-whatsapp'); if (window.bukaSubTabWhatsapp) window.bukaSubTabWhatsapp('monitor'); } },
  { id: 'mail_gateway', label: 'Mail Gateway', kategori: 'Master Integrasi', icon: 'fa-envelope',
    aksi: () => { window.pindahTab('tab-mail-gateway'); } },
  { id: 'device_kiosk', label: 'List Device Kiosk', kategori: 'Master Integrasi', icon: 'fa-tablet-screen-button', wajibOwner: true,
    aksi: () => { window.pindahTab('tab-device-kiosk'); } },
  // BARU (23 Agt 2026) — Zevanic House > Master Bahan & Aksesoris. id
  // SENGAJA TIDAK diubah (masih bahan_aksesoris_entry/list) walau labelnya
  // di sidebar sekarang "Data Bahan & Aksesoris" — supaya akses_config yang
  // sudah tersimpan sebelumnya (per-user) TIDAK ikut kereset/hilang.
  // BARU (27 Agt 2026, §26.1) — Zevanic House > Config (6 tab child: Jenis
  // Bahan, Jenis Aksesoris, Data Satuan, Data Warna, Data Ukuran, Data
  // Suplayer). 1 menu-id dipakai bareng ke-6nya (pola sama seperti
  // 'config_karyawan'), lihat js/vue-config.js.
  { id: 'config_master_data', label: 'Config', kategori: 'Zevanic House', icon: 'fa-sliders',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-config', null); window.pindahSubTab('sub-zh-config', 'sub-zh-config-jenisbahan', null); } },
  { id: 'bahan_aksesoris_entry', label: 'Entry Bahan & Aksesoris', kategori: 'Zevanic House', icon: 'fa-boxes-stacked',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-databahan', null); window.pindahSubTab('sub-zh-databahan', 'sub-zh-databahan-entry', null); } },
  { id: 'bahan_aksesoris_list', label: 'List Bahan & Aksesoris', kategori: 'Zevanic House', icon: 'fa-list',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-databahan', null); window.pindahSubTab('sub-zh-databahan', 'sub-zh-databahan-list', null); } },
  // BARU (25 Agt 2026, §25) — Rak Penyimpanan.
  { id: 'bahan_aksesoris_rak', label: 'Rak Penyimpanan', kategori: 'Zevanic House', icon: 'fa-warehouse',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-databahan', null); window.pindahSubTab('sub-zh-databahan', 'sub-zh-databahan-rak', null); } },
  // BARU (24 Agt 2026) — Persiapan Masalah + Stock & Pembelian.
  { id: 'persiapan_masalah', label: 'Persiapan Masalah', kategori: 'Zevanic House', icon: 'fa-triangle-exclamation',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-persiapan', null); } },
  // DIPENSIUNKAN (27 Agt 2026, §26.1) — CRUD Suplayer sekarang di
  // 'config_master_data' (menu Config), BUKAN lagi lewat gear Stock &
  // Pembelian. Entry ini SENGAJA dibiarkan (bukan dihapus) supaya data
  // izin lama di Firestore tidak yatim tanpa penjelasan — sudah tidak
  // dipakai komponen manapun. `deprecated: true` (BARU §27) supaya juga
  // tidak ikut nongol sebagai tile basi di grid Home mobile.
  { id: 'master_suplayer', label: 'Master Suplayer (DIPENSIUNKAN, lihat Config)', kategori: 'Zevanic House', deprecated: true },
  { id: 'stock_alias_pembelian', label: 'Alias Pembelian', kategori: 'Zevanic House', icon: 'fa-tags',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-stock', null); window.pindahSubTab('sub-zh-stock', 'sub-zh-stock-alias', null); } },
  { id: 'stock_list_order_belanja', label: 'List Order Belanja', kategori: 'Zevanic House', icon: 'fa-cart-shopping',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-stock', null); window.pindahSubTab('sub-zh-stock', 'sub-zh-stock-listorder', null); } },
  { id: 'stock_nota_order_belanja', label: 'Nota Order Belanja', kategori: 'Zevanic House', icon: 'fa-receipt',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-stock', null); window.pindahSubTab('sub-zh-stock', 'sub-zh-stock-notaorder', null); } },
  // BARU (27 Agt 2026, §26.3) — Cetak Label: lihat CetakLabelManager di
  // js/vue-stock-pembelian.js. Aksi cetak dicek lewat kolom 'print' (SUDAH
  // ADA di KOSONG_IZIN, tapi baru menu INI yang benar-benar memakainya).
  { id: 'stock_cetak_label', label: 'Cetak Label', kategori: 'Zevanic House', icon: 'fa-print',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-stock', null); window.pindahSubTab('sub-zh-stock', 'sub-zh-stock-cetaklabel', null); } },
  // BARU (27 Agt 2026, §26.2) — Order SPK: lihat js/vue-order-spk.js.
  { id: 'order_spk', label: 'Order SPK', kategori: 'Zevanic House', icon: 'fa-clipboard-list',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-orderspk', null); } },
  // BARU (27 Agt 2026, §26.4) — Scan > Scan Opname: lihat js/vue-scan-
  // opname.js. Aksi catat penyesuaian dicek lewat kolom 'edit'. Gating
  // "mobile-only untuk non-Owner" TIDAK lewat kolom izin ini — itu
  // hardcode `window.currentUser.role === 'owner'` di file itu sendiri
  // (pola sama seperti Config Akses/Hak Akses/Device Kiosk di auth.js),
  // menu-id ini CUMA buat kontrol boleh/tidaknya menyimpan (di atas
  // gerbang mobile itu, bukan pengganti).
  { id: 'scan_opname', label: 'Scan Opname', kategori: 'Zevanic House', icon: 'fa-qrcode',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-scan', null); window.pindahSubTab('sub-zh-scan', 'sub-zh-scan-opname', null); } },
  // BARU (27 Agt 2026, §26.5, Tahap 5 — TAHAP TERAKHIR) — Scan > Scan
  // Persiapan: lihat js/vue-scan-persiapan.js. Aksi catat pemakaian dicek
  // lewat kolom 'edit'. Gating "mobile-only utk non-Owner" TETAP hardcode
  // role === 'owner' di file itu sendiri (SAMA seperti Scan Opname) —
  // menu-id ini CUMA buat kontrol boleh/tidaknya menyimpan, bukan
  // pengganti gerbang mobile itu.
  { id: 'scan_persiapan', label: 'Scan Persiapan', kategori: 'Zevanic House', icon: 'fa-boxes-stacked',
    aksi: () => { window.pindahTab('tab-zevanic-house'); window.pindahSubTab('sub-zevanic-house', 'sub-zevanic-house-scan', null); window.pindahSubTab('sub-zh-scan', 'sub-zh-scan-persiapan', null); } }
];

export const KATEGORI_URUTAN = ['Umum', 'Master Absensi', 'Master Keuangan', 'Master Karyawan', 'Master Integrasi', 'Zevanic House'];
export { DAFTAR_MENU };
const KOSONG_IZIN = () => ({ view: false, add: false, edit: false, delete: false, print: false });

// Default awal untuk 5 profil baku SENGAJA disamakan dengan perilaku
// hardcode yang sudah jalan sekarang (lihat auth.js) — supaya profil ini
// begitu pertama dibuka sudah masuk akal, bukan kosong semua.
function bikinDefaultProfil(namaProfil) {
  const menus = {};
  DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN(); });

  const semua = (id) => { menus[id] = { view: true, add: true, edit: true, delete: true, print: true }; };
  const lihatSaja = (id) => { menus[id].view = true; };

  if (namaProfil === 'owner') {
    DAFTAR_MENU.forEach(m => semua(m.id));
  } else if (namaProfil === 'superuser') {
    // ATURAN TETAP (18 Agt 2026, permintaan eksplisit): menu BARU yang
    // ditambahkan ke DAFTAR_MENU TIDAK LAGI otomatis ikut ke sini. Dulu
    // Superuser = Owner untuk SEMUA menu (blanket, ikut DAFTAR_MENU
    // apapun isinya) — sekarang daftar di bawah ini FIXED/snapshot,
    // cuma menu yang SUDAH ADA per tanggal ini. Menu baru ke depan
    // default-nya CUMA Owner yang bisa akses, sampai Owner atur manual
    // lewat Config Akses kalau memang mau dibagikan ke Superuser juga.
    // JANGAN tambahkan menu baru ke daftar ini secara otomatis — biarkan
    // Owner yang putuskan & atur sendiri lewat tampilan Config Akses.
    [
      'dashboard', 'profile',
      'config_absensi', 'penjadwalan', 'antrean_absensi', 'antrean_lembur', 'riwayat_absensi',
      'antrean_dakar', 'config_karyawan', 'daftar_karyawan', 'config_info', 'slip_gaji', 'payroll',
      'whatsapp_gateway', 'mail_gateway'
      // SENGAJA TIDAK termasuk: config_akses, hak_akses — khusus Owner
      // asli, sudah begitu sejak awal fitur ini dibuat, bukan hal baru.
    ].forEach(semua);
  } else if (namaProfil === 'pic' || namaProfil === 'admin') {
    lihatSaja('dashboard');
    menus.profile = { view: true, add: true, edit: true, delete: false, print: false };
    ['config_absensi', 'penjadwalan', 'antrean_absensi', 'antrean_lembur', 'riwayat_absensi'].forEach(semua);
    // Contoh nyata pemakaian fitur granular: Admin/PIC boleh kelola
    // Master Gudang sepenuhnya (view/add/edit/delete/print semua true di
    // atas), TAPI khusus dropdown "Jenis Lokasi"-nya tetap terkunci ke
    // Tetap — cuma Owner yang bisa buka opsi Dinamis.
    menus.config_absensi.fitur = { ubah_jenis_lokasi: false };
  } else {
    lihatSaja('dashboard');
    menus.profile = { view: true, add: true, edit: true, delete: false, print: false };
  }
  return menus;
}

const PROFIL_BAKU = ['operator', 'pic', 'admin', 'owner', 'superuser'];

const AppConfigAkses = {
  setup() {
    const daftarProfil = ref([]); // nama-nama profil yang sudah pernah disimpan
    const memuat = ref(true);
    const menyimpan = ref(false);

    const namaAkses = ref('');
    const profilDipilih = ref('');
    // tingkatKeamanan: 1 dari 5 nama baku, INI yang benar-benar dikirim
    // ke Firestore Rules lewat custom claim (field "role" di data
    // karyawan). Nama profil di "namaAkses" cuma dipakai buat cari izin
    // TAMPILAN, tidak pernah sampai ke Rules. Default 'operator' (paling
    // rendah) — sengaja bukan default tinggi, biar profil baru yang lupa
    // diatur tidak tiba-tiba dapat akses tulis luas.
    const tingkatKeamanan = ref('operator');
    const menus = reactive({});
    // pastikanFiturAda: kalau menu ini punya fiturList (kontrol granular
    // tambahan), pastikan menus[id].fitur SELALU ada sebagai objek —
    // supaya template (v-model="menus[m.id].fitur[f.key]") tidak error
    // kalau datanya belum pernah tersimpan sama sekali.
    function pastikanFiturAda(menuId) {
      const def = DAFTAR_MENU.find(m => m.id === menuId);
      if (def && def.fiturList && !menus[menuId].fitur) menus[menuId].fitur = {};
    }
    DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN(); pastikanFiturAda(m.id); });

    const kategoriTerbuka = reactive({});
    KATEGORI_URUTAN.forEach(k => { kategoriTerbuka[k] = true; });
    function toggleKategori(k) { kategoriTerbuka[k] = !kategoriTerbuka[k]; }

    // BARU (27 Agt 2026, §27 — Redesain Home Mobile) — Urutan Menu di Home
    // Mobile. Home mobile cuma nampilkan 5 menu PALING ATAS per kategori
    // (sisanya lewat "Lihat Semua") — urutan 5 teratas itu diatur di sini,
    // bukan ditebak. Disimpan 1 dokumen tunggal, dibaca vue-home.js tiap
    // kali Home dimuat (1x getDoc, hemat baca). Menu yang belum pernah
    // diatur otomatis ikut urutan asli DAFTAR_MENU di posisi paling akhir
    // (self-healing kalau ada menu baru ditambah belakangan).
    const urutanMenu = reactive({});
    const urutanTerbuka = reactive({});
    const menyimpanUrutan = ref(false);
    function labelMenu(id) { const m = DAFTAR_MENU.find(x => x.id === id); return m ? m.label : id; }
    async function muatUrutanMenu() {
      const kategoriDipakai = KATEGORI_URUTAN.filter(k => k !== 'Umum');
      kategoriDipakai.forEach(k => { urutanTerbuka[k] = false; });
      let perKategoriTersimpan = {};
      try {
        const snap = await getDoc(doc(db, 'pengaturan_sistem', 'urutan_menu_home'));
        if (snap.exists()) perKategoriTersimpan = snap.data().perKategori || {};
      } catch (e) {
        console.error('Gagal muat urutan menu Home mobile:', e);
      }
      kategoriDipakai.forEach(k => {
        const idsAsli = DAFTAR_MENU.filter(m => m.kategori === k && !m.deprecated).map(m => m.id);
        const tersimpan = (perKategoriTersimpan[k] || []).filter(id => idsAsli.includes(id));
        const belumAda = idsAsli.filter(id => !tersimpan.includes(id));
        urutanMenu[k] = [...tersimpan, ...belumAda];
      });
    }
    function naikkanUrutan(kategori, idx) {
      if (idx <= 0) return;
      const arr = urutanMenu[kategori];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    }
    function turunkanUrutan(kategori, idx) {
      const arr = urutanMenu[kategori];
      if (idx >= arr.length - 1) return;
      [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
    }
    async function simpanUrutanMenu() {
      menyimpanUrutan.value = true;
      try {
        const perKategori = {};
        KATEGORI_URUTAN.filter(k => k !== 'Umum').forEach(k => { perKategori[k] = urutanMenu[k] || []; });
        await setDoc(doc(db, 'pengaturan_sistem', 'urutan_menu_home'), { perKategori });
        alert('Urutan menu Home mobile berhasil disimpan!');
      } catch (e) {
        console.error('Gagal simpan urutan menu Home mobile:', e);
        alert('Gagal menyimpan urutan menu.');
      }
      menyimpanUrutan.value = false;
    }

    const cariMenu = ref('');
    function menuUntukKategori(kategori) {
      const kata = cariMenu.value.trim().toLowerCase();
      return DAFTAR_MENU.filter(m => m.kategori === kategori && (!kata || m.label.toLowerCase().includes(kata)));
    }

    // Checkbox "pilih semua" di header kolom (View/Add/Edit/Delete/Print) —
    // cakupannya cuma menu-menu di dalam kategori itu saja, tidak ikut
    // menyentuh kategori lain.
    function semuaTercentangKolom(kategori, field) {
      const daftarMenu = menuUntukKategori(kategori);
      return daftarMenu.length > 0 && daftarMenu.every(m => menus[m.id][field]);
    }
    function toggleKolomKategori(kategori, field) {
      const nilaiBaru = !semuaTercentangKolom(kategori, field);
      menuUntukKategori(kategori).forEach(m => { menus[m.id][field] = nilaiBaru; });
    }

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDocs(collection(db, "akses_config"));
        const namaTersimpan = [];
        snap.forEach(d => namaTersimpan.push(d.id));
        // Gabungkan dengan profil baku (biar selalu muncul di daftar
        // pilihan meski belum pernah disimpan sekalipun) — KECUALI "owner",
        // sengaja disembunyikan dari daftar pilih/edit karena Owner wajib
        // selalu punya akses penuh ke segalanya, tidak boleh dikonfigurasi
        // (dikecilkan) lewat layar ini sama sekali.
        const gabungan = [...new Set([...PROFIL_BAKU, ...namaTersimpan])]
          .filter(nama => nama !== 'owner')
          .sort();
        daftarProfil.value = gabungan;

        if (!profilDipilih.value && gabungan.length > 0) {
          await pilihProfil(gabungan[0]);
        }
      } catch (e) {
        console.error("Gagal muat daftar profil akses:", e);
      }
      memuat.value = false;
    }

    async function pilihProfil(nama) {
      if (!nama) { mulaiProfilBaru(); return; }
      profilDipilih.value = nama;
      namaAkses.value = nama;
      try {
        const snap = await getDoc(doc(db, "akses_config", nama));
        const data = snap.exists() ? snap.data() : null;
        const dataMenus = data ? (data.menus || {}) : null;
        // Profil baku (operator/pic/admin/owner/superuser): tingkat
        // keamanannya SAMA DENGAN namanya sendiri, kecuali sudah pernah
        // disimpan beda secara eksplisit. Profil kustom yang belum pernah
        // diatur: default 'operator' (paling aman/rendah).
        tingkatKeamanan.value = data?.tingkatKeamanan || (PROFIL_BAKU.includes(nama) ? nama : 'operator');
        DAFTAR_MENU.forEach(m => {
          menus[m.id] = dataMenus && dataMenus[m.id] ? { ...KOSONG_IZIN(), ...dataMenus[m.id] } : (
            PROFIL_BAKU.includes(nama) ? bikinDefaultProfil(nama)[m.id] : KOSONG_IZIN()
          );
          pastikanFiturAda(m.id);
        });
      } catch (e) {
        console.error("Gagal muat profil akses:", nama, e);
      }
    }

    function mulaiProfilBaru() {
      profilDipilih.value = '';
      namaAkses.value = '';
      tingkatKeamanan.value = 'operator';
      DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN(); pastikanFiturAda(m.id); });
    }

    async function simpan() {
      const nama = namaAkses.value.trim();
      if (!nama) return alert("Nama Akses harus diisi!");
      if (nama.toLowerCase() === 'owner') {
        return alert("Nama \"owner\" tidak boleh dipakai — Owner wajib selalu punya akses penuh dan tidak boleh dikonfigurasi lewat layar ini.");
      }

      menyimpan.value = true;
      try {
        const menusPolos = {};
        DAFTAR_MENU.forEach(m => { menusPolos[m.id] = { ...menus[m.id] }; });
        await setDoc(doc(db, "akses_config", nama), { nama, tingkatKeamanan: tingkatKeamanan.value, menus: menusPolos });
        alert(`Profil akses "${nama}" berhasil disimpan!`);
        profilDipilih.value = nama;
        await muat();
      } catch (e) {
        console.error("Gagal simpan profil akses:", e);
        alert("Gagal menyimpan profil akses.");
      }
      menyimpan.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); muatUrutanMenu(); });

    return {
      daftarProfil, memuat, menyimpan, muat,
      namaAkses, profilDipilih, pilihProfil, mulaiProfilBaru, simpan,
      tingkatKeamanan, TINGKAT_KEAMANAN_BAKU,
      menus, KATEGORI_URUTAN, kategoriTerbuka, toggleKategori, menuUntukKategori, cariMenu,
      semuaTercentangKolom, toggleKolomKategori,
      urutanMenu, urutanTerbuka, menyimpanUrutan, labelMenu, naikkanUrutan, turunkanUrutan, simpanUrutanMenu
    };
  },
  template: `
    <div>
      <div class="gc-card" style="background:var(--blue); border:none; margin-bottom:16px;">
        <h4 class="gc-heading" style="font-weight:700; font-size:13px; color:#1F5060;"><i class="fas fa-shield-halved" style="margin-right:8px;"></i> Config Akses</h4>
        <p style="font-size:11px; color:#1F5060; margin-top:4px; opacity:.85;">Buat atau ubah profil akses — tiap profil punya izin View/Add/Edit/Delete/Print sendiri per menu. Profil ini nanti dipilih untuk tiap karyawan di tab Hak Akses.</p>
      </div>

      <div class="gc-card" style="margin-bottom:16px; border:1.5px solid var(--burgundy);">
        <h4 class="gc-heading" style="font-size:12.5px; font-weight:700; margin-bottom:6px;"><i class="fas fa-shield-halved" style="color:var(--burgundy); margin-right:8px;"></i> Tingkat Keamanan Dasar</h4>
        <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">Profil ini boleh dinamai bebas, tapi untuk KEAMANAN DATA (Firestore Rules), harus setara dengan salah satu dari 5 tingkat baku berikut. Ini yang menentukan bisa/tidaknya karyawan dengan profil ini benar-benar MENYIMPAN data (bukan cuma soal tampil/sembunyi menu).</p>
        <div class="gc-field" style="margin-bottom:0; max-width:280px;">
          <label>Setara dengan tingkat</label>
          <select v-model="tingkatKeamanan">
            <option v-for="t in TINGKAT_KEAMANAN_BAKU" :key="t" :value="t">{{ t.toUpperCase() }}</option>
          </select>
        </div>
      </div>

      <div class="gc-card" style="margin-bottom:16px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;" class="md:grid-cols-2">
          <div class="gc-field" style="margin-bottom:0;">
            <label>Pilih profil untuk diedit (atau buat baru)</label>
            <select :value="profilDipilih" @change="pilihProfil($event.target.value)">
              <option value="">+ Buat profil baru</option>
              <option v-for="p in daftarProfil" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
          <div class="gc-field" style="margin-bottom:0;">
            <label>Nama akses{{ profilDipilih ? ' (nama profil yang sedang diedit, tidak bisa diganti di sini)' : '' }}</label>
            <input v-model="namaAkses" type="text" placeholder="Contoh: admin_gudang_utama" :disabled="!!profilDipilih" :style="profilDipilih ? 'background:var(--ivory-dim); color:var(--text-muted); cursor:not-allowed;' : ''">
          </div>
        </div>
        <button @click="simpan" :disabled="menyimpan" class="btn-primary block">
          <i class="fas" :class="profilDipilih ? 'fa-rotate' : 'fa-save'" style="margin-right:8px;"></i>
          {{ menyimpan ? 'Menyimpan...' : (profilDipilih ? 'Update profil akses' : 'Simpan profil akses (baru)') }}
        </button>
      </div>

      <div class="gc-card" style="margin-bottom:16px; border:1.5px solid var(--burgundy);">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:6px; flex-wrap:wrap;">
          <h4 class="gc-heading" style="font-size:12.5px; font-weight:700;"><i class="fas fa-arrow-down-wide-short" style="color:var(--burgundy); margin-right:8px;"></i> Urutan Menu di Home Mobile</h4>
          <button @click="simpanUrutanMenu" :disabled="menyimpanUrutan" class="btn-primary" style="padding:8px 16px; font-size:11.5px;">
            <i class="fas" :class="menyimpanUrutan ? 'fa-spinner fa-spin' : 'fa-save'" style="margin-right:6px;"></i>{{ menyimpanUrutan ? 'Menyimpan...' : 'Simpan Urutan' }}
          </button>
        </div>
        <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">Grid Home mobile cuma nampilkan 5 menu paling atas per kategori duluan (sisanya lewat "Lihat Semua") — atur urutannya di sini pakai panah naik/turun. Tidak mempengaruhi urutan sidebar desktop.</p>
        <div v-for="kategori in KATEGORI_URUTAN.filter(k => k !== 'Umum')" :key="'urutan-'+kategori" style="margin-bottom:10px; border:1px solid var(--line); border-radius:12px; overflow:hidden;">
          <div @click="urutanTerbuka[kategori] = !urutanTerbuka[kategori]" style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; cursor:pointer; background:var(--ivory-dim);">
            <span style="font-size:12px; font-weight:700;">{{ kategori }} <span style="font-size:10px; color:var(--text-faint); font-weight:600;">({{ (urutanMenu[kategori]||[]).length }} menu)</span></span>
            <i class="fas" :class="urutanTerbuka[kategori] ? 'fa-chevron-up' : 'fa-chevron-down'" style="color:var(--text-muted); font-size:11px;"></i>
          </div>
          <div v-show="urutanTerbuka[kategori]" style="padding:8px 10px;">
            <div v-for="(id, idx) in (urutanMenu[kategori] || [])" :key="id" style="display:flex; align-items:center; justify-content:space-between; padding:6px 8px; border-bottom:1px solid var(--line); gap:8px;">
              <span style="font-size:12px; flex:1;">
                <span style="display:inline-block; width:20px; color:var(--text-faint); font-weight:700;">{{ idx + 1 }}.</span>
                {{ labelMenu(id) }}
                <span v-if="idx < 5" style="font-size:9px; font-weight:800; color:var(--ok); background:var(--ok-light); padding:1px 6px; border-radius:999px; margin-left:6px; white-space:nowrap;">tampil duluan</span>
              </span>
              <span style="display:flex; gap:4px; flex:none;">
                <button @click="naikkanUrutan(kategori, idx)" :disabled="idx===0" style="background:var(--surface); border:1px solid var(--line); border-radius:6px; width:26px; height:26px; cursor:pointer;" :style="idx===0 ? 'opacity:.3;' : ''"><i class="fas fa-arrow-up" style="font-size:10px;"></i></button>
                <button @click="turunkanUrutan(kategori, idx)" :disabled="idx === (urutanMenu[kategori]||[]).length - 1" style="background:var(--surface); border:1px solid var(--line); border-radius:6px; width:26px; height:26px; cursor:pointer;" :style="idx === (urutanMenu[kategori]||[]).length - 1 ? 'opacity:.3;' : ''"><i class="fas fa-arrow-down" style="font-size:10px;"></i></button>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="memuat" style="text-align:center; padding:40px 0; color:var(--text-faint);">
        <i class="fas fa-spinner fa-spin" style="font-size:24px; margin-bottom:8px; display:block;"></i>Memuat...
      </div>

      <div v-else style="position:relative; margin-bottom:14px;">
        <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
        <input v-model="cariMenu" type="text" placeholder="Cari nama menu..." style="width:100%; max-width:320px; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
      </div>

      <div v-if="!memuat" v-for="kategori in KATEGORI_URUTAN" :key="kategori" class="gc-card" style="margin-bottom:12px; padding:0; overflow:hidden;">
        <div @click="toggleKategori(kategori)" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; cursor:pointer; background:var(--ivory-dim);">
          <h3 class="gc-heading" style="font-size:13px; font-weight:700;">{{ kategori }}</h3>
          <i class="fas" :class="kategoriTerbuka[kategori] ? 'fa-chevron-up' : 'fa-chevron-down'" style="color:var(--text-muted);"></i>
        </div>
        <div v-show="kategoriTerbuka[kategori]" class="gc-table-scroll">
          <table class="gc-table" style="table-layout:fixed; min-width:640px;">
            <thead>
              <tr>
                <th class="freeze freeze-left" style="width:220px;">Nama menu</th>
                <th style="width:84px; text-align:center;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="checkbox" :checked="semuaTercentangKolom(kategori, 'view')" @change="toggleKolomKategori(kategori, 'view')" style="accent-color:var(--burgundy); width:14px; height:14px;">
                    <span>View</span>
                  </div>
                </th>
                <th style="width:84px; text-align:center;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="checkbox" :checked="semuaTercentangKolom(kategori, 'add')" @change="toggleKolomKategori(kategori, 'add')" style="accent-color:var(--burgundy); width:14px; height:14px;">
                    <span>Add</span>
                  </div>
                </th>
                <th style="width:84px; text-align:center;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="checkbox" :checked="semuaTercentangKolom(kategori, 'edit')" @change="toggleKolomKategori(kategori, 'edit')" style="accent-color:var(--burgundy); width:14px; height:14px;">
                    <span>Edit</span>
                  </div>
                </th>
                <th style="width:84px; text-align:center;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="checkbox" :checked="semuaTercentangKolom(kategori, 'delete')" @change="toggleKolomKategori(kategori, 'delete')" style="accent-color:var(--burgundy); width:14px; height:14px;">
                    <span>Delete</span>
                  </div>
                </th>
                <th style="width:84px; text-align:center;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="checkbox" :checked="semuaTercentangKolom(kategori, 'print')" @change="toggleKolomKategori(kategori, 'print')" style="accent-color:var(--burgundy); width:14px; height:14px;">
                    <span>Print</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in menuUntukKategori(kategori)" :key="m.id">
                <td class="freeze freeze-left" style="font-weight:600;">{{ m.label }}</td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].view" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].add" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].edit" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].delete" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].print" style="accent-color:var(--ok); width:16px; height:16px;"></td>
              </tr>
              <tr v-for="m in menuUntukKategori(kategori).filter(x => x.fiturList)" :key="m.id + '-fitur'">
                <td colspan="6" style="background:var(--ivory-dim); padding:10px 12px;">
                  <div style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.03em; margin-bottom:6px;">Kontrol tambahan — {{ m.label }}</div>
                  <label v-for="f in m.fiturList" :key="f.key" style="display:flex; align-items:center; gap:8px; font-size:12px; padding:4px 0; cursor:pointer;">
                    <input type="checkbox" v-model="menus[m.id].fitur[f.key]" style="accent-color:var(--ok); width:15px; height:15px;">
                    {{ f.label }}
                  </label>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
};

let vmConfigAkses = null;
// Perbaikan bug BESAR: komponen ini dulu langsung di-mount() begitu file ini
// dimuat (artinya SETIAP kali halaman dibuka, oleh SIAPAPUN, termasuk yang
// tidak punya akses ke layar ini) — onMounted-nya otomatis mencoba fetch
// Firestore walau orangnya tidak pernah membuka tab ini sama sekali. Itu
// yang bikin console penuh "Missing or insufficient permissions" dan baca
// Firestore boros. Sekarang mount() BARU terjadi saat dashboard.js
// pindahSubTab benar-benar memanggil window.pastikanMountConfigAkses() —
// yaitu PERSIS saat tab ini pertama kali dibuka, bukan dari awal muat
// halaman.
window.pastikanMountConfigAkses = function() {
  if (vmConfigAkses) return; // sudah pernah di-mount, tidak perlu ulang
  const mountPoint = document.getElementById('vue-config-akses');
  if (mountPoint) vmConfigAkses = createApp(AppConfigAkses).mount('#vue-config-akses');
};
window.refreshConfigAkses = function() { if (vmConfigAkses) vmConfigAkses.muat(); };
