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
  // "Status Pengguna (Role Akses)" SENGAJA dihapus dari sini (17 Agt
  // 2026) — dulu ini daftar role TERPISAH dan TIDAK SINKRON dengan Config
  // Akses/Hak Akses, berisiko bentrok (2 tempat kelola "role apa saja
  // yang ada", tidak saling tahu). Sekarang role dikelola SATU tempat
  // saja: Config Akses (buat profil baru) + Hak Akses (pasangkan ke
  // karyawan) — keduanya sudah baca dari koleksi akses_config yang sama,
  // begitu juga dropdown Role di modal Edit Karyawan (Daftar Karyawan).
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
let vmConfigKaryawan = null;
// Sama seperti Config Absensi — mount() ditunda sampai benar-benar
// dinavigasi pertama kali, supaya 9x MasterDataCategory + KecamatanManager
// di dalamnya tidak ikut fetch on-load kalau layar ini belum pernah dibuka.
window.pastikanMountConfigKaryawan = function() {
  if (vmConfigKaryawan) return;
  const mountPoint = document.getElementById('vue-config-karyawan');
  if (mountPoint) vmConfigKaryawan = createApp(AppConfigKaryawan).mount('#vue-config-karyawan');
};
window.refreshConfigKaryawan = function() { if (vmConfigKaryawan) vmConfigKaryawan.refreshKey++; };
