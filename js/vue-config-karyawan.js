// js/vue-config-karyawan.js
// ============================================================================
// Halaman PERTAMA yang dimigrasi ke Vue (Master Karyawan > Config Karyawan).
// Layar lain masih pakai kode lama (vanilla JS) sampai giliran masing-masing
// dimigrasi — Vue di sini cuma "menempel" di 1 div, tidak mengganggu bagian
// lain dari aplikasi.
//
// REDESIGN (9 Sep 2026) — mengikuti wireframe handoff "07 - Management /
// 01 - Master Karyawan" butir 1.5: dulu grid 2 kolom FLAT (semua kategori
// sejajar, tidak dikelompokkan). SEKARANG dibungkus jadi GROUPED SECTIONS
// (accordion, collapse/expand per section) sesuai tema yang PERSIS disebut
// di wireframe:
//   - "Pekerjaan & Status" (4 kategori): Jenis Pekerjaan, Status Kerja,
//     Jabatan, Status Karyawan
//   - "Wilayah" (2 kategori): Kabupaten/Kota + Kecamatan (bertingkat)
//   - "Absensi" (3 kategori): Alasan Izin, Alasan Cuti, Status Kehadiran
// Wireframe eksplisit bilang "8 kategori" (3 section di atas = 4+2+3 = 9
// item termasuk Kecamatan, atau 8 kalau Kecamatan dihitung nempel ke
// Kabupaten) — SAMA PERSIS dengan 8 kategori MasterDataCategory yang lama
// (tidak termasuk 4 kategori baru di bawah).
//
// ASUMSI (kategori BARU 9 Sep 2026 tidak disebut di wireframe): Departemen,
// Seragam, Agama, Pendidikan Terakhir ditambahkan SETELAH wireframe ini
// dibuat, jadi tidak masuk ke 3 tema di atas. Daripada dipaksakan ke tema
// yang tidak cocok (bukan "Pekerjaan & Status", bukan "Wilayah", bukan
// "Absensi"), 4 kategori ini dikumpulkan di section ke-4 tambahan ("Data
// Tambahan Karyawan") — section EKSTRA di luar wireframe, bukan pengganti
// section yang sudah didefinisikan wireframe. Isi/logic tiap kategori TIDAK
// berubah sama sekali, cuma dibungkus struktur accordion baru.
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
  { kategori: 'status_kehadiran', label: 'Status Kehadiran' },
  // BARU (9 Sep 2026) — 4 kategori dari spek handoff "Master Karyawan"
  // yang GENUINELY belum ada sebelumnya. Selaras dengan permintaan Guru
  // "ikuti persis 8 kategori spek", TAPI 2 item spek (Gudang/Cabang,
  // Shift) SENGAJA TIDAK diduplikasi ke sini — keduanya sudah punya
  // rumah sendiri (master_gudang/master_shift, dikelola dari Config
  // Absensi) dan menaruhnya di 2 tempat melanggar aturan single source
  // of truth proyek ini. Kategori LAMA yang tidak disebut spek (status_
  // kerja, kabupaten, alasan_izin, alasan_cuti, status_kehadiran) JUGA
  // dipertahankan — semuanya aktif dipakai fitur lain (Profile Izin/
  // Cuti, dropdown alamat, dst); menghapusnya akan mematahkan fitur yang
  // sudah jalan tanpa pengganti. Detail lengkap ada di STATUS-PROYEK.md.
  { kategori: 'departemen', label: 'Departemen' },
  { kategori: 'seragam', label: 'Seragam' },
  { kategori: 'agama', label: 'Agama' },
  { kategori: 'pendidikan_terakhir', label: 'Pendidikan Terakhir' }
];

// Peta kategori -> label, dipakai grup di bawah supaya label tidak perlu
// ditulis ulang dua kali (sumber tunggal tetap KATEGORI_SEDERHANA di atas).
const PETA_LABEL = Object.fromEntries(KATEGORI_SEDERHANA.map(k => [k.kategori, k.label]));

// Pengelompokan tema — PERSIS mengikuti wireframe 1.5 (3 section pertama);
// section ke-4 adalah tambahan (lihat catatan ASUMSI di atas file).
const KELOMPOK_KATEGORI = [
  { key: 'pekerjaan_status', label: 'Pekerjaan & Status', icon: 'fa-briefcase', kategori: ['jenis_pekerjaan', 'status_kerja', 'jabatan', 'status_karyawan'] },
  { key: 'wilayah', label: 'Wilayah', icon: 'fa-map-location-dot', kategori: ['kabupaten'], pakaiKecamatan: true },
  { key: 'absensi', label: 'Absensi', icon: 'fa-clipboard-list', kategori: ['alasan_izin', 'alasan_cuti', 'status_kehadiran'] },
  { key: 'lainnya', label: 'Data Tambahan Karyawan', icon: 'fa-id-card', kategori: ['departemen', 'seragam', 'agama', 'pendidikan_terakhir'] }
];

const AppConfigKaryawan = {
  components: { MasterDataCategory, KecamatanManager },
  data() {
    return {
      kelompok: KELOMPOK_KATEGORI,
      refreshKey: 0,
      // Semua section default TERBUKA — kolaps cuma buat yang mau
      // meringkas tampilan, bukan menyembunyikan sesuatu secara default.
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
