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
    return { kategoriList: KATEGORI_SEDERHANA };
  },
  template: `
    <div class="bg-blue-50 border border-blue-100 p-4 rounded-2xl">
      <h4 class="font-bold text-blue-800 text-sm"><i class="fas fa-database mr-1.5"></i> Master Data</h4>
      <p class="text-[11px] text-blue-600 mt-0.5">Kelola pilihan yang muncul di dropdown seluruh aplikasi (Antrean Dakar, Edit Karyawan, Registrasi, dll). Ketik lalu Enter/klik + untuk menambah, klik &times; pada item untuk menghapus.</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <master-data-category
        v-for="k in kategoriList"
        :key="k.kategori"
        :kategori="k.kategori"
        :label="k.label"
      />
      <kecamatan-manager class="md:col-span-2" />
    </div>
  `
};

// Vue cuma mount ke div ini — sisanya (tab switching, dst) tetap dikontrol
// oleh app.js/dashboard.js seperti biasa.
const mountPoint = document.getElementById('vue-config-karyawan');
if (mountPoint) {
  createApp(AppConfigKaryawan).mount('#vue-config-karyawan');
}
