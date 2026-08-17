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
import { createApp, ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

const LABEL_TAB = {
  'tab-home': 'Home',
  'tab-profil': 'Profile',
  'tab-admin-acc': 'Master Absensi',
  'tab-superuser': 'Master Karyawan',
  'tab-whatsapp': 'WhatsApp Gateway',
  'tab-scan-qr': 'Scan QR',
  'tab-progress': 'Progress'
};
const LABEL_SUBTAB = {
  'sub-absensi-config': 'Config Absensi',
  'sub-absensi-jadwal': 'Penjadwalan',
  'sub-absensi-accept': 'Antrean Absensi',
  'sub-absensi-lembur': 'Antrean Lembur',
  'sub-absensi-rekap': 'Riwayat All Absensi',
  'sub-karyawan-antrean': 'Antrean Dakar',
  'sub-karyawan-data': 'Daftar Karyawan',
  'sub-karyawan-slip': 'Slip Gaji',
  'sub-karyawan-payroll': 'Payroll',
  'sub-karyawan-config': 'Config Karyawan',
  'sub-karyawan-info': 'Config Info',
  'sub-karyawan-hakakses': 'Hak Akses',
  'sub-karyawan-akses': 'Config Akses'
};

const AppHeaderMobile = {
  setup() {
    const konteks = reactive({ mode: 'home', menuLabel: '', subMenuLabel: '' });
    const sapaan = ref('Selamat datang');
    const nama = ref('');

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

    return { konteks, sapaan, nama };
  },
  template: `
    <div class="md:hidden" style="background:var(--pink); border-radius:22px; padding:18px 20px; position:relative; overflow:hidden; margin-bottom:16px;">
      <div style="position:absolute; right:-30px; top:-30px; width:120px; height:120px; border-radius:50%; background:var(--blue); opacity:.3;"></div>
      <div style="position:relative; z-index:1;">
        <template v-if="konteks.mode === 'home'">
          <p style="font-size:12.5px; color:var(--mahogany-soft);">{{ sapaan }},</p>
          <h2 class="gc-heading" style="font-size:19px; font-weight:700; color:var(--mahogany);">{{ nama }}</h2>
        </template>
        <template v-else>
          <p style="font-size:12.5px; color:var(--mahogany-soft);">ERP Zevanic House</p>
          <h2 class="gc-heading" style="font-size:17px; font-weight:700; color:var(--mahogany);">{{ konteks.menuLabel }}<span v-if="konteks.subMenuLabel"> - {{ konteks.subMenuLabel }}</span></h2>
        </template>
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-header-mobile');
if (mountPoint) createApp(AppHeaderMobile).mount('#vue-header-mobile');
