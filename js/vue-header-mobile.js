// js/vue-header-mobile.js
// ============================================================================
// Header atas mobile — SATU komponen dipakai di semua halaman, tapi isinya
// berubah otomatis tergantung sedang di mana:
//   - Di Home: "Selamat [pagi/siang/sore/malam], [Nama]" (gaya kartu pink,
//     sama seperti prototype)
//   - Di halaman LAIN (Master Absensi, Profile, dst): "ERP Zevanic House"
//     / "[Nama Menu] - [Nama Sub-menu]" — supaya orang selalu tahu lagi
//     di mana tanpa perlu baca sub-tab (yang di mobile sengaja
//     disembunyikan, lihat index.html & dashboard.js).
//
// Diaktifkan lewat window.aturHeaderKonteks(tabId, subTabId) — dipanggil
// dari pindahTab/pindahSubTab (dashboard.js) tiap kali navigasi terjadi.
// TIDAK baca Firestore sama sekali untuk ganti konteks (murni cocokkan ID
// ke daftar label yang sudah ada di memori).
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

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
  // BARU (27 Agt 2026, §27) — sebelumnya HILANG dari sini (celah lama,
  // ketauan pas Home mobile jadi jalur utama ke Zevanic House). Efeknya:
  // header mobile nongol kosong pas buka menu Zevanic House manapun.
  'tab-zevanic-house': 'Zevanic House'
};
const LABEL_SUBTAB = {
  'sub-absensi-config': 'Config Absensi',
  'sub-absensi-jadwal': 'Penjadwalan',
  'sub-absensi-accept': 'Antrean Absensi',
  'sub-absensi-lembur': 'Antrean Lembur',
  'sub-absensi-rekap': 'Riwayat All Absensi',
  'sub-keuangan-antrean': 'Antrean Reimburse',
  'sub-keuangan-kendaraan': 'Master Kendaraan',
  'sub-keuangan-kategori': 'Kategori Keuangan',
  'sub-keuangan-riwayat-reimburse': 'Riwayat Reimburse',
  'sub-keuangan-riwayat-bensin': 'Riwayat Isi Bensin',
  'sub-keuangan-riwayat-servis': 'Riwayat Servis',
  'sub-karyawan-antrean': 'Antrean Dakar',
  'sub-karyawan-data': 'Daftar Karyawan',
  'sub-karyawan-slip': 'Slip Gaji',
  'sub-karyawan-payroll': 'Payroll',
  'sub-karyawan-config': 'Config Karyawan',
  'sub-karyawan-info': 'Config Info',
  'sub-karyawan-hakakses': 'Hak Akses',
  'sub-karyawan-akses': 'Config Akses',
  // BARU (27 Agt 2026, §27) — sama seperti tab-zevanic-house di atas,
  // set ini sebelumnya HILANG total (celah lama, bukan cuma soal menu
  // baru §26). Ditambah sekalian semuanya supaya header mobile Zevanic
  // House selalu jelas lagi di mana, bukan cuma yang kepakai dari Home.
  'sub-zevanic-house-persiapan': 'Persiapan Masalah',
  'sub-zevanic-house-orderspk': 'Order SPK',
  'sub-zh-config-jenisbahan': 'Jenis Bahan',
  'sub-zh-config-jenisaksesoris': 'Jenis Aksesoris',
  'sub-zh-config-satuan': 'Data Satuan',
  'sub-zh-config-warna': 'Data Warna',
  'sub-zh-config-ukuran': 'Data Ukuran',
  'sub-zh-config-suplayer': 'Data Suplayer',
  'sub-zh-config-tahappersiapan': 'Persiapan Untuk Tahap',
  'sub-zh-databahan-entry': 'Entry Bahan & Aksesoris',
  'sub-zh-databahan-list': 'List Bahan & Aksesoris',
  'sub-zh-databahan-rak': 'Rak Penyimpanan',
  'sub-zh-stock-alias': 'Alias Pembelian',
  'sub-zh-stock-listorder': 'List Order Belanja',
  'sub-zh-stock-notaorder': 'Nota Order Belanja',
  'sub-zh-stock-riwayat': 'Riwayat Harga Pembelian',
  'sub-zh-stock-kartustok': 'Kartu Stok',
  'sub-zh-scan-opname': 'Scan Opname',
  'sub-zh-scan-persiapan': 'Scan Persiapan',
  // BARU (28 Agt 2026) — Persiapan Produksi (5 tab child).
  'sub-zh-persiapanproduksi-antrean': 'Perlu Disiapkan',
  'sub-zh-persiapanproduksi-bahan': 'Persiapan Bahan',
  'sub-zh-persiapanproduksi-sewing': 'Persiapan Acc Sewing',
  'sub-zh-persiapanproduksi-webbing': 'Persiapan Acc Webbing',
  'sub-zh-persiapanproduksi-finishing': 'Persiapan Acc Finishing'
};

const AppHeaderMobile = {
  setup() {
    const konteks = reactive({ mode: 'home', menuLabel: '', subMenuLabel: '' });
    const sapaan = ref('Selamat datang');
    const nama = ref('');
    // Nama dibatasi maksimal 20 karakter di header (kartu kecil, banyak
    // nama karyawan panjang) — dipotong + "…" kalau lebih panjang dari
    // itu, nama ASLI tetap utuh di window.currentUser/Profile.
    const namaTampil = computed(() => nama.value.length > 20 ? nama.value.slice(0, 20).trim() + '…' : nama.value);

    function tentukanSapaan() {
      const jam = new Date().getHours();
      if (jam >= 4 && jam < 11) return 'Selamat pagi';
      if (jam >= 11 && jam < 15) return 'Selamat siang';
      if (jam >= 15 && jam < 18) return 'Selamat sore';
      return 'Selamat malam';
    }

    function muatTampilan() {
      sapaan.value = tentukanSapaan();
      nama.value = window.currentUser?.name || window.currentUser?.nama || 'Karyawan';
    }

    // Dipanggil dari dashboard.js (pindahTab/pindahSubTab) — murni
    // cocokkan ID ke label, tidak ada baca Firestore.
    window.aturHeaderKonteks = function(tabId, subTabId) {
      if (tabId === 'tab-home') {
        konteks.mode = 'home';
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

    return { konteks, sapaan, namaTampil };
  },
  template: `
    <div class="md:hidden" style="background:var(--pink); border-radius:22px; padding:14px 16px; position:relative; overflow:hidden; margin-bottom:14px;">
      <div style="position:absolute; right:-30px; top:-30px; width:120px; height:120px; border-radius:50%; background:var(--blue); opacity:.3;"></div>
      <div style="position:relative; z-index:1;">
        <template v-if="konteks.mode === 'home'">
          <p style="font-size:12.5px; color:var(--mahogany-soft); margin:0;">{{ sapaan }},</p>
          <h2 class="gc-heading" style="font-size:19px; font-weight:700; color:var(--mahogany); margin:2px 0 0 0;">{{ namaTampil }}</h2>
        </template>
        <template v-else>
          <p style="font-size:12.5px; color:var(--mahogany-soft); margin:0;">ERP Zevanic House</p>
          <h2 class="gc-heading" style="font-size:17px; font-weight:700; color:var(--mahogany); margin:2px 0 0 0;">{{ konteks.menuLabel }}<span v-if="konteks.subMenuLabel"> - {{ konteks.subMenuLabel }}</span></h2>
        </template>
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-header-mobile');
if (mountPoint) createApp(AppHeaderMobile).mount('#vue-header-mobile');
