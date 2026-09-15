// js/vue-config-karyawan.js
// Master Karyawan > Config Karyawan. Accordion 3 section (Pekerjaan & Status,
// Wilayah, Absensi) berisi komponen MasterDataCategory + KecamatanManager.
//
// Koleksi & field:
// - Tidak menyentuh Firestore langsung; semua baca/tulis lewat
//   MasterDataCategory & KecamatanManager (vue-components.js) ke dokumen
//   master_data/{kategori} field `items` dan master_data/kecamatan field `map`.
//
// Jebakan:
// - KATEGORI_SEDERHANA masih memuat departemen, seragam, agama,
//   pendidikan_terakhir, tapi KELOMPOK_KATEGORI tidak menampilkannya — nilai
//   baru 4 kategori itu tidak bisa ditambah lewat UI mana pun.
// - Daftar role TIDAK dikelola di sini; satu-satunya tempat adalah Config Akses
//   (akses_config) + Hak Akses. Jangan tambahkan kategori role di sini.
// - jenis_pekerjaan juga tampil di Config Absensi lewat komponen yang sama —
//   dokumen master_data-nya identik, bukan salinan.
// - Mount ditunda lewat window.pastikanMountConfigKaryawan supaya kategori di
//   dalamnya tidak fetch saat halaman baru dimuat.

import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { MasterDataCategory, KecamatanManager } from './vue-components.js';

const KATEGORI_SEDERHANA = [
  { kategori: 'jenis_pekerjaan', label: 'Jenis Pekerjaan' },
  { kategori: 'status_kerja', label: 'Status Kerja' },
  // 'Status Pengguna (Role Akses)' tidak dikelola di sini. Role dikelola satu
  // tempat saja: Config Akses (buat profil baru) + Hak Akses (pasangkan ke
  // karyawan), keduanya baca dari koleksi akses_config yang sama — begitu juga
  // dropdown Role di modal Edit Karyawan (Daftar Karyawan).
  { kategori: 'jabatan', label: 'Jabatan' },
  { kategori: 'status_karyawan', label: 'Status Karyawan' },
  { kategori: 'kabupaten', label: 'Kabupaten/Kota' },
  { kategori: 'alasan_izin', label: 'Alasan Izin' },
  { kategori: 'alasan_cuti', label: 'Alasan Cuti' },
  { kategori: 'status_kehadiran', label: 'Status Kehadiran' },
  // 4 kategori dari spek Master Karyawan. Gudang & shift tidak di sini: keduanya
  // punya rumah sendiri (master_gudang/master_shift, dikelola dari Config
  // Absensi). Kategori status_kerja, kabupaten, alasan_izin, alasan_cuti,
  // status_kehadiran dipertahankan karena aktif dipakai fitur lain.
  { kategori: 'departemen', label: 'Departemen' },
  { kategori: 'seragam', label: 'Seragam' },
  { kategori: 'agama', label: 'Agama' },
  { kategori: 'pendidikan_terakhir', label: 'Pendidikan Terakhir' }
];

// Peta kategori -> label, dipakai grup di bawah supaya label tidak perlu ditulis
// ulang dua kali (sumber tunggal tetap KATEGORI_SEDERHANA di atas).
const PETA_LABEL = Object.fromEntries(KATEGORI_SEDERHANA.map(k => [k.kategori, k.label]));

// Pengelompokan tema mengikuti wireframe 1.5 (3 section). Kategori departemen/
// seragam/agama/pendidikan_terakhir tetap ada di KATEGORI_SEDERHANA di atas,
// tapi tidak punya UI kelola di sini — jadi nilai baru untuk kategori itu belum
// bisa ditambahkan lewat UI manapun.
const KELOMPOK_KATEGORI = [
  { key: 'pekerjaan_status', label: 'Pekerjaan & Status', icon: 'fa-briefcase', kategori: ['jenis_pekerjaan', 'status_kerja', 'jabatan', 'status_karyawan'] },
  { key: 'wilayah', label: 'Wilayah', icon: 'fa-map-location-dot', kategori: ['kabupaten'], pakaiKecamatan: true },
  { key: 'absensi', label: 'Absensi', icon: 'fa-clipboard-list', kategori: ['alasan_izin', 'alasan_cuti', 'status_kehadiran'] }
];

const AppConfigKaryawan = {
  components: { MasterDataCategory, KecamatanManager },
  data() {
    return {
      kelompok: KELOMPOK_KATEGORI,
      refreshKey: 0,
      // Semua section default TERBUKA — kolaps cuma buat yang mau meringkas
      // tampilan, bukan menyembunyikan sesuatu secara default.
      sectionTerbuka: {
        pekerjaan_status: true,
        wilayah: true,
        absensi: true,
        lainnya: true
      }
    };
  },
  methods: {
    labelKategori(kk) { return PETA_LABEL[kk] || kk; },
    jumlahItemGrup(grp) { return grp.kategori.length + (grp.pakaiKecamatan ? 1 : 0); },
    toggleSection(key) { this.sectionTerbuka[key] = !this.sectionTerbuka[key]; }
  },
  template: `
    <div class="gc-card" style="background:var(--blue); border:none;">
      <h4 class="gc-heading" style="font-weight:700; font-size:13px; color:var(--teal-text);"><i class="fas fa-database" style="margin-right:8px;"></i> Master Data</h4>
      <p style="font-size:11px; color:var(--teal-text); margin-top:4px; opacity:.85;">Kelola pilihan yang muncul di dropdown seluruh aplikasi (Antrean Dakar, Edit Karyawan, Registrasi, dll). Ketik lalu Enter/klik + untuk menambah, klik &times; pada item untuk menghapus.</p>
    </div>

    <div style="display:flex; flex-direction:column; gap:14px; margin-top:16px;">
      <div v-for="grp in kelompok" :key="grp.key" style="border:1.5px solid var(--line); border-radius:16px; overflow:hidden; background:var(--surface);">
        <button type="button" @click="toggleSection(grp.key)" style="width:100%; display:flex; align-items:center; gap:10px; padding:12px 16px; background:var(--ivory-dim); border:none; cursor:pointer; text-align:left;">
          <i class="fas" :class="grp.icon" style="color:var(--burgundy); font-size:13px; width:16px; text-align:center;"></i>
          <span style="font-weight:700; font-size:12.5px; color:var(--text);">{{ grp.label }}</span>
          <span style="margin-left:auto; font-size:10px; color:var(--text-faint); font-weight:400;">{{ jumlahItemGrup(grp) }} kategori</span>
          <i class="fas" :class="sectionTerbuka[grp.key] ? 'fa-chevron-up' : 'fa-chevron-down'" style="color:var(--text-faint); font-size:11px;"></i>
        </button>
        <div v-show="sectionTerbuka[grp.key]" style="padding:14px 16px; display:grid; gap:14px;" class="grid grid-cols-1 md:grid-cols-2">
          <master-data-category
            v-for="kk in grp.kategori"
            :key="kk + '-' + refreshKey"
            :kategori="kk"
            :label="labelKategori(kk)"
          />
          <kecamatan-manager v-if="grp.pakaiKecamatan" :key="'kecamatan-' + refreshKey" class="md:col-span-2" />
        </div>
      </div>
    </div>
  `
};

// Vue cuma mount ke div ini — sisanya (tab switching, dst) tetap dikontrol oleh
// app.js/dashboard.js seperti biasa.
let vmConfigKaryawan = null;
// Sama seperti Config Absensi — mount ditunda sampai benar-benar dinavigasi
// pertama kali, supaya 9x MasterDataCategory + KecamatanManager di dalamnya
// tidak ikut fetch on-load kalau layar ini belum pernah dibuka.
window.pastikanMountConfigKaryawan = function() {
  if (vmConfigKaryawan) { vmConfigKaryawan.refreshKey++; return; }
  const mountPoint = document.getElementById('vue-config-karyawan');
  if (mountPoint) vmConfigKaryawan = createApp(AppConfigKaryawan).mount('#vue-config-karyawan');
};
window.refreshConfigKaryawan = function() { if (vmConfigKaryawan) vmConfigKaryawan.refreshKey++; };
