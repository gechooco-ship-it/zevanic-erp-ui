// js/vue-config-karyawan.js
// ============================================================================
// Halaman PERTAMA yang dimigrasi ke Vue (Master Karyawan > Config Karyawan).
// Layar lain masih pakai kode lama (vanilla JS) sampai giliran masing-masing
// dimigrasi — Vue di sini cuma "menempel" di 1 div, tidak mengganggu bagian
// lain dari aplikasi.
// ============================================================================
import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { MasterDataCategory, KecamatanManager } from './vue-components.js';

const KATEGORI_SEDERHANA = [
  { kategori: 'jenis_pekerjaan', label: 'Jenis Pekerjaan' },
  { kategori: 'status_kerja', label: 'Status Kerja' },
  { kategori: 'status_pengguna', label: 'Status Pengguna (Role Akses)' },
  { kategori: 'jabatan', label: 'Jabatan' },
  { kategori: 'status_karyawan', label: 'Status Karyawan' },
  { kategori: 'kabupaten', label: 'Kabupaten/Kota' },
  { kategori: 'alasan_izin', label: 'Alasan Izin' },
  { kategori: 'alasan_cuti', label: 'Alasan Cuti' },
  { kategori: 'status_kehadiran', label: 'Status Kehadiran' }
];

const AppConfigKaryawan = {
  components: { MasterDataCategory, KecamatanManager },
  data() {
    return { kategoriList: KATEGORI_SEDERHANA, refreshKey: 0 };
  },
  template: `
    <div class="gc-card" style="background:var(--blue); border:none;">
      <h4 class="gc-heading" style="font-weight:700; font-size:13px; color:#1F5060;"><i class="fas fa-database" style="margin-right:8px;"></i> Master Data</h4>
      <p style="font-size:11px; color:#1F5060; margin-top:4px; opacity:.85;">Kelola pilihan yang muncul di dropdown seluruh aplikasi (Antrean Dakar, Edit Karyawan, Registrasi, dll). Ketik lalu Enter/klik + untuk menambah, klik &times; pada item untuk menghapus.</p>
    </div>
    <div style="gap:14px; margin-top:16px;" class="grid grid-cols-1 md:grid-cols-2">
      <master-data-category
        v-for="k in kategoriList"
        :key="k.kategori + '-' + refreshKey"
        :kategori="k.kategori"
        :label="k.label"
      />
      <kecamatan-manager :key="'kecamatan-' + refreshKey" class="md:col-span-2" />
    </div>
  `
};

// Vue cuma mount ke div ini — sisanya (tab switching, dst) tetap dikontrol
// oleh app.js/dashboard.js seperti biasa.
const mountPoint = document.getElementById('vue-config-karyawan');
if (mountPoint) {
  const vm = createApp(AppConfigKaryawan).mount('#vue-config-karyawan');
  // Jembatan ke vanilla: dipanggil dari auth.js/vue-login.js tepat setelah
  // login berhasil. Komponen di sini semuanya anak (MasterDataCategory x9,
  // KecamatanManager) tanpa fungsi muat() sendiri di induknya — jadi caranya
  // beda dari layar lain: ganti `key` supaya Vue "lahir ulang" semua anaknya
  // dari nol, otomatis mengulang onMounted (dan fetch) masing-masing.
  window.refreshConfigKaryawan = function() { vm.refreshKey++; };
}
