// js/vue-header-mobile.js
// Header atas mobile, satu komponen untuk semua halaman. Mode 'home': sapaan +
// quote harian inline + lonceng pengumuman + avatar inisial. Mode 'lainnya':
// komponen HeaderLayar (tombol kembali + kicker + judul menu/sub-menu).
//
// Koleksi & field:
// - quotes: where tanggalTampil == tanggal hari ini, limit 1 (judul, isi).
// - pengumuman: orderBy dibuat_pada desc limit 15; rolesTampil disaring lokal
//   dari window.currentUser.role, bukan lewat where.
//
// Jebakan:
// - Badge lonceng dihitung dari timestamp "terakhir dilihat" di localStorage
//   per-user; TIDAK ada tulis Firestore sama sekali — jangan diganti jadi
//   penanda di dokumen users.
// - Ganti konteks judul lewat window.aturHeaderKonteks(tabId, subTabId) yang
//   dipanggil dashboard.js; murni cocokkan ID ke LABEL_TAB di memori, menu baru
//   harus didaftarkan di peta label itu atau judulnya kosong.
// - Mode 'lainnya' memakai HeaderLayar yang global — mengubahnya berdampak ke
//   SEMUA halaman selain Home sekaligus.

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
// mode 'lainnya' memakai HeaderLayar yang sama dengan Menu Lengkap/Atur Favorit
// (tombol kembali bulat + kicker + judul). Komponen ini GLOBAL, dipakai di semua
// halaman selain Home, jadi perubahan di sini otomatis berlaku ke semua halaman
// sekaligus.
import { HeaderLayar } from './vue-components.js?v=13';

const LABEL_TAB = {
  'tab-home': 'Home',
  'tab-profil': 'Profile',
  'tab-admin-acc': 'Master Absensi',
  'tab-keuangan': 'Master Keuangan',
  'tab-superuser': 'Master Karyawan',
  'tab-whatsapp': 'WhatsApp Gateway',
  'tab-mail-gateway': 'Mail Gateway',
  'tab-device-kiosk': 'List Device Kiosk',
  'tab-scan-qr': 'Scan QR',
  'tab-progress': 'Progress',
  // sebelumnya HILANG dari sini (celah lama, ketauan pas Home mobile jadi jalur
  // utama ke Zevanic House). Efeknya: header mobile nongol kosong pas buka menu
  // Zevanic House manapun.
  'tab-zevanic-house': 'Zevanic House',
  // grup top-level. Sama seperti tab-zevanic-house di atas, WAJIB didaftarkan
  // di sini juga (celah yang sama) supaya header mobile tidak nongol kosong.
  'tab-persiapan-produksi': 'Persiapan Produksi',
  // 'tab-pesanan' ikut dipetakan di sini; tanpa entri ini header mobile tampil
  // kosong saat membuka menu Pesanan manapun.
  'tab-pesanan': 'Pesanan',
  // grup top-level baru "Scan & Cetak", lihat js/vue-scan-cetak.js.
  'tab-scan-cetak': 'Scan & Cetak',
  // grup top-level baru "Stok dan Pembelian", dipisah dari Zevanic House > Stock
  // & Pembelian (lihat index.html).
  'tab-stok-pembelian': 'Stok dan Pembelian'
};
const LABEL_SUBTAB = {
  'sub-absensi-config': 'Config Absensi',
  'sub-absensi-jadwal': 'Penjadwalan',
  'sub-absensi-accept': 'Antrean Absensi',
  'sub-absensi-lembur': 'Antrean Izin/Cuti/Lembur',
  'sub-absensi-rekap': 'Riwayat All Absensi',
  'sub-keuangan-antrean': 'Antrean Reimburse',
  'sub-keuangan-kendaraan': 'Master Kendaraan',
  'sub-keuangan-kategori': 'Kategori Keuangan',
  'sub-keuangan-riwayat-reimburse': 'Riwayat Keuangan',
  'sub-karyawan-antrean': 'Antrean Dakar',
  'sub-karyawan-data': 'Daftar Karyawan',
  'sub-karyawan-slip': 'Slip Gaji',
  'sub-karyawan-payroll': 'Payroll',
  'sub-karyawan-config': 'Config Karyawan',
  'sub-karyawan-info': 'Config Info',
  'sub-karyawan-hakakses': 'Hak Akses',
  'sub-karyawan-akses': 'Config Akses',
  // Semua sub-tab Zevanic House dipetakan, bukan cuma yang dipakai dari Home,
  // supaya header mobile selalu jelas posisinya. 'sub-zevanic-house-persiapan'
  // tidak ada karena modulnya sudah tidak ada; Master Pelanggan ada di
  // js/vue-master-pelanggan.js.
  'sub-zevanic-house-pelanggan': 'Master Pelanggan',
  'sub-zevanic-house-orderspk': 'Order SPK',
  'sub-zh-config-jenisbahan': 'Jenis Bahan',
  'sub-zh-config-jenisaksesoris': 'Jenis Aksesoris',
  'sub-zh-config-satuan': 'Data Satuan',
  'sub-zh-config-warna': 'Data Warna',
  'sub-zh-config-ukuran': 'Data Ukuran',
  // CRUD Suplayer ada di 3 entry 'sub-zh-suplayer-*' di bawah, bukan di Config.
  'sub-zh-config-tlc': 'TLC & Prefix',
  'sub-zh-config-tahappersiapan': 'Persiapan Untuk Tahap',
  'sub-zh-databahan-entry': 'Entry Bahan & Aksesoris',
  'sub-zh-databahan-list': 'List Bahan & Aksesoris',
  'sub-zh-databahan-rak': 'Rak Penyimpanan',
  // Master Suplayer (3 sub-tab), lihat js/vue-master- suplayer.js dari
  // 'sub-zh-stock-alias': 'Alias Pembelian' di bawah (DIHAPUS, pindah ke sini
  // sebagai 'sub-zh-suplayer-alias-moq').
  'sub-zh-suplayer-entry': 'Master Suplayer',
  'sub-zh-suplayer-alias-moq': 'Alias & MOQ',
  'sub-zh-suplayer-petakan': 'Petakan Order',
  // DIHAPUS — 'sub-zh-stock-listorder': 'List Order Belanja' (tab dihapus total,
  // lihat vue-stock-pembelian.js).
  'sub-zh-stock-notaorder': 'Daftar Nota',
  'sub-zh-stock-riwayat': 'Riwayat Harga Pembelian',
  'sub-zh-stock-kartustok': 'Kartu Stok',
  // DITAMBAH .
  'sub-zh-stock-rak': 'Rak Penyimpanan',
  'sub-zh-stock-repack': 'Repack',
  // Scan Opname/Persiapan ada di bawah menu top-level "Scan & Cetak"
  // (tab-scan-cetak), lihat entry 'sub-scancetak-stok-*' di bawah.
  'sub-scan-cetak-stok': 'Scan Stok',
  'sub-scancetak-stok-opname': 'Scan Opname',
  'sub-scancetak-stok-persiapan': 'Scan Persiapan',
  'sub-scan-cetak-referensi': 'Referensi Scan',
  'sub-scan-cetak-cetak': 'Cetak',
  'sub-scan-cetak-pin': 'Riwayat PIN',
  // 'sub-zh-persiapanproduksi-*' tidak dipakai lagi — jangan dihidupkan ulang.
  // Yang berlaku grup top-level "Persiapan Produksi" di bawah (6 sub-menu +
  // 25 child-tab, 5 jalur x 5 tahap).
  'sub-pp-disiapkan': 'Perlu Disiapkan',
  'sub-pp-vendor': 'Vendor',
  'sub-pp-bahan': 'Bahan',
  'sub-pp-sewing': 'Acc Sewing',
  'sub-pp-webbing': 'Acc Webbing',
  'sub-pp-finishing': 'Acc Finishing',
  'sub-pp-vendor-perludiproses': 'Vendor - Perlu Diproses',
  'sub-pp-vendor-sedangdiproses': 'Vendor - Sedang Diproses',
  'sub-pp-vendor-perludikirim': 'Vendor - Perlu Dikirim',
  'sub-pp-vendor-sedangdikirim': 'Vendor - Sedang Dikirim',
  'sub-pp-vendor-selesai': 'Vendor - Selesai',
  'sub-pp-bahan-perludiproses': 'Bahan - Perlu Diproses',
  'sub-pp-bahan-sedangdiproses': 'Bahan - Sedang Diproses',
  'sub-pp-bahan-perludikirim': 'Bahan - Perlu Dikirim',
  'sub-pp-bahan-sedangdikirim': 'Bahan - Sedang Dikirim',
  'sub-pp-bahan-selesai': 'Bahan - Selesai',
  'sub-pp-sewing-perludiproses': 'Acc Sewing - Perlu Diproses',
  'sub-pp-sewing-sedangdiproses': 'Acc Sewing - Sedang Diproses',
  'sub-pp-sewing-perludikirim': 'Acc Sewing - Perlu Dikirim',
  'sub-pp-sewing-sedangdikirim': 'Acc Sewing - Sedang Dikirim',
  'sub-pp-sewing-selesai': 'Acc Sewing - Selesai',
  'sub-pp-webbing-perludiproses': 'Acc Webbing - Perlu Diproses',
  'sub-pp-webbing-sedangdiproses': 'Acc Webbing - Sedang Diproses',
  'sub-pp-webbing-perludikirim': 'Acc Webbing - Perlu Dikirim',
  'sub-pp-webbing-sedangdikirim': 'Acc Webbing - Sedang Dikirim',
  'sub-pp-webbing-selesai': 'Acc Webbing - Selesai',
  'sub-pp-finishing-perludiproses': 'Acc Finishing - Perlu Diproses',
  'sub-pp-finishing-sedangdiproses': 'Acc Finishing - Sedang Diproses',
  'sub-pp-finishing-perludikirim': 'Acc Finishing - Perlu Dikirim',
  'sub-pp-finishing-sedangdikirim': 'Acc Finishing - Sedang Dikirim',
  'sub-pp-finishing-selesai': 'Acc Finishing - Selesai'
};

const AppHeaderMobile = {
  components: { HeaderLayar },
  setup() {
    const konteks = reactive({ mode: 'home', menuLabel: '', subMenuLabel: '' });
    const sapaan = ref('Selamat datang');
    const nama = ref('');
    // Nama dibatasi maksimal 20 karakter di header (kartu kecil, banyak nama
    // karyawan panjang) — dipotong + "…" kalau lebih panjang dari itu, nama ASLI
    // tetap utuh di window.currentUser/Profile.
    const namaTampil = computed(() => nama.value.length > 20 ? nama.value.slice(0, 20).trim() + '…' : nama.value);

    function tentukanSapaan() {
      const jam = new Date().getHours();
      if (jam >= 4 && jam < 11) return 'Selamat pagi';
      if (jam >= 11 && jam < 15) return 'Selamat siang';
      if (jam >= 15 && jam < 18) return 'Selamat sore';
      return 'Selamat malam';
    }

    // Quote harian inline (mode 'home'): sumber data sama dengan QuoteCard —
    // koleksi "quotes", field tanggalTampil == hari ini — cuma ditampilkan sebagai
    // 1 baris kecil. hariIni WAJIB dari getFullYear/getMonth/getDate, bukan
    // toISOString (UTC), supaya tidak meleset dari tanggal lokal 00:00-06:59 WIB.
    const quoteHariIni = ref('');
    async function muatQuote() {
      try {
        // dipertegas pakai timezone Asia/Jakarta EKSPLISIT, lihat komentar
        // lengkap di vue-components.js.
        const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        const q = query(collection(db, "quotes"), where("tanggalTampil", "==", hariIni), limit(1));
        const snap = await getDocs(q);
        quoteHariIni.value = snap.empty ? '' : (snap.docs[0].data().isi || '');
      } catch (e) {
        quoteHariIni.value = ''; // koleksi belum ada/kosong itu wajar
      }
    }

    // Lonceng notifikasi (Pengumuman) + badge
    const daftarNotif = ref([]);
    const memuatNotif = ref(true);
    const notifTerbuka = ref(false);
    const jumlahBelumDibaca = ref(0);
    const KUNCI_TERAKHIR_DILIHAT = 'zevanic_notif_terakhir_dilihat_';

    function kunciUser() { return KUNCI_TERAKHIR_DILIHAT + (window.currentUser?.email || ''); }

    async function muatNotif() {
      memuatNotif.value = true;
      try {
        const q = query(collection(db, "pengumuman"), orderBy("dibuat_pada", "desc"), limit(15));
        const snap = await getDocs(q);
        const roleSaya = (window.currentUser?.role || 'operator').toLowerCase();
        const list = [];
        snap.forEach(d => {
          const data = d.data();
          const rolesTampil = data.rolesTampil || [];
          if (rolesTampil.length === 0 || rolesTampil.includes(roleSaya)) list.push({ id: d.id, ...data });
        });
        daftarNotif.value = list;
        const terakhirDilihat = localStorage.getItem(kunciUser());
        jumlahBelumDibaca.value = terakhirDilihat
          ? list.filter(p => (p.dibuat_pada?.toDate ? p.dibuat_pada.toDate().toISOString() : p.dibuat_pada) > terakhirDilihat).length
          : list.length;
      } catch (e) {
        daftarNotif.value = []; // koleksi belum ada/kosong itu wajar, bukan error
        jumlahBelumDibaca.value = 0;
      }
      memuatNotif.value = false;
    }

    function toggleNotif() {
      notifTerbuka.value = !notifTerbuka.value;
      if (notifTerbuka.value) {
        // Ketuk lonceng = tandai semua SUDAH dibaca (badge hilang) — murni
        // localStorage, tidak ada tulis Firestore.
        localStorage.setItem(kunciUser(), new Date().toISOString());
        jumlahBelumDibaca.value = 0;
      }
    }
    function tutupNotif() { notifTerbuka.value = false; }

    function inisial(n) {
      const bersih = (n || '').trim();
      if (!bersih) return '?';
      const kata = bersih.split(/\s+/);
      return kata.length === 1 ? kata[0].slice(0, 2).toUpperCase() : (kata[0][0] + kata[kata.length - 1][0]).toUpperCase();
    }
    const inisialNama = computed(() => inisial(nama.value));

    function muatTampilan() {
      sapaan.value = tentukanSapaan();
      nama.value = window.currentUser?.name || window.currentUser?.nama || 'Karyawan';
      muatQuote();
      muatNotif();
    }

    // Dipanggil dari dashboard.js (pindahTab/pindahSubTab) — murni cocokkan ID ke
    // label, tidak ada baca Firestore. Layar Menu Lengkap/Atur Favorit sudah punya
    // HeaderLayar sendiri, jadi banner generik ini harus mode 'tersembunyi' untuk
    // tab-tab itu supaya tidak jadi 2 header dobel.
    const TAB_HEADER_SENDIRI = ['tab-menu-lengkap', 'tab-atur-favorit'];

    window.aturHeaderKonteks = function(tabId, subTabId) {
      if (tabId === 'tab-home') {
        konteks.mode = 'home';
        konteks.menuLabel = '';
        konteks.subMenuLabel = '';
      } else if (TAB_HEADER_SENDIRI.includes(tabId)) {
        konteks.mode = 'tersembunyi';
        konteks.menuLabel = '';
        konteks.subMenuLabel = '';
      } else {
        konteks.mode = 'lainnya';
        konteks.menuLabel = LABEL_TAB[tabId] || '';
        konteks.subMenuLabel = subTabId ? (LABEL_SUBTAB[subTabId] || '') : '';
      }
    };

    window.refreshHeaderMobile = muatTampilan;
    onMounted(async () => { await window.authReady; muatTampilan(); });

    return {
      konteks, sapaan, namaTampil, quoteHariIni, inisialNama,
      daftarNotif, memuatNotif, notifTerbuka, jumlahBelumDibaca, toggleNotif, tutupNotif
    };
  },
  template: `
    <div class="md:hidden" :style="konteks.mode === 'tersembunyi' ? '' : 'border-radius:22px; padding:9px 4px; position:relative; margin-bottom:10px;'">
      <template v-if="konteks.mode === 'home'">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
          <div style="min-width:0;">
            <p style="font-size:10px; color:var(--text-muted); font-weight:600; margin:0;">{{ sapaan }},</p>
            <h2 class="gc-heading" style="font-size:17px; font-weight:700; color:var(--aksen-ink); margin:1px 0 0 0; letter-spacing:-.015em;">{{ namaTampil }}</h2>
            <p v-if="quoteHariIni" style="font-size:9.5px; color:var(--text-muted); margin:3px 0 0 0; line-height:1.35; max-width:220px;">{{ quoteHariIni }}</p>
          </div>
          <div style="display:flex; align-items:center; gap:10px; flex-shrink:0; position:relative;">
            <button @click="toggleNotif" style="position:relative; background:none; border:none; cursor:pointer; color:var(--aksen-ink); width:34px; height:34px; display:flex; align-items:center; justify-content:center;" aria-label="Notifikasi">
              <i class="fas fa-bell" style="font-size:18px;"></i>
              <span v-if="jumlahBelumDibaca > 0" style="position:absolute; top:-2px; right:-3px; background:var(--burgundy); color:#fff; font-size:9px; font-weight:700; min-width:16px; height:16px; border-radius:999px; display:flex; align-items:center; justify-content:center; padding:0 3px;">{{ jumlahBelumDibaca > 9 ? '9+' : jumlahBelumDibaca }}</span>
            </button>
            <span style="width:44px; height:44px; border-radius:50%; background:var(--aksen-lembut); border:2px solid var(--surface); box-shadow:0 3px 10px rgba(var(--burgundy-rgb),.14); display:flex; align-items:center; justify-content:center; color:var(--aksen-ink); font-size:14px; font-weight:700;">{{ inisialNama }}</span>

            <div v-if="notifTerbuka" @click="tutupNotif" style="position:fixed; inset:0; z-index:60;"></div>
            <div v-if="notifTerbuka" class="fade-in" style="position:absolute; top:42px; right:0; width:280px; max-height:340px; overflow-y:auto; background:var(--surface); border:1px solid var(--line); border-radius:18px; box-shadow:0 14px 34px -10px rgba(31,22,17,.35); z-index:61; padding:6px;">
              <div style="padding:8px 10px 6px; font-size:11px; font-weight:700; color:var(--text); border-bottom:1px solid var(--line); margin-bottom:4px;">Pengumuman</div>
              <div v-if="memuatNotif" style="padding:16px; text-align:center; font-size:11px; color:var(--text-faint);">Memuat...</div>
              <div v-else-if="daftarNotif.length === 0" style="padding:16px; text-align:center; font-size:11px; color:var(--text-faint);"><i class="fas fa-bell-slash" style="display:block; font-size:18px; margin-bottom:6px;"></i>Belum ada pengumuman.</div>
              <div v-else v-for="p in daftarNotif" :key="p.id" style="padding:9px 10px; border-radius:12px;">
                <b style="font-size:11.5px; color:var(--text); display:block;">{{ p.judul }}</b>
                <p style="font-size:10.5px; color:var(--text-muted); margin:2px 0 0; line-height:1.4;">{{ p.isi }}</p>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template v-else-if="konteks.mode === 'lainnya'">
        <header-layar :kicker="konteks.menuLabel" :judul="konteks.subMenuLabel || konteks.menuLabel" tab-pulang="tab-home" />
      </template>
      <!--
        mode 'tersembunyi': layar py header sendiri (HeaderLayar), tidak render apapun di sini
      -->
    </div>
  `
};

const mountPoint = document.getElementById('vue-header-mobile');
if (mountPoint) createApp(AppHeaderMobile).mount('#vue-header-mobile');
