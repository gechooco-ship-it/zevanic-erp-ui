// js/vue-profile-drawer.js
// Komponen AppProfileDrawer — drawer Profile mobile yang geser dari kanan: QR
// karyawan (klik untuk zoom) + link ke sub-tab Data Karyawan, Absensi,
// Reimburse, Estimasi Gaji, Pencapaian, Keamanan. FILE YATIM: tidak dimuat
// index.html dan tidak ada elemen #vue-profile-drawer di sana — perannya
// dipegang js/vue-sheet-profil.js (Bottom Sheet Profil).
//
// Koleksi & field:
// - Tidak menyentuh Firestore; murni UI navigasi, data dari window.currentUser.
//
// Jebakan:
// - Isi file hanya jalan kalau #vue-profile-drawer ada; tanpa elemen itu
//   window.bukaProfileDrawer/tutupProfileDrawer tidak pernah terdaftar dan
//   pemanggil di js/app.js melewatinya diam-diam.
// - Urutan link mengikuti baris tab desktop vue-account-profile.js; sub-tab
//   yang tidak didaftarkan di sini tidak bisa dibuka dari mobile sama sekali
//   karena baris tab itu disembunyikan di layar kecil.
// - Navigasi lewat window.pindahTab + window.pindahTabAccountProfile
//   (vue-account-profile.js), bukan href.

import { createApp, ref } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

const AppProfileDrawer = {
  setup() {
    const terbuka = ref(false);
    const zoomTerbuka = ref(false);
    const qrUrl = ref('');
    const nama = ref('');
    const jabatan = ref('');

    function muatData() {
      const qrData = window.currentUser?.id_app || window.currentUser?.email || '';
      qrUrl.value = qrData ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}` : '';
      nama.value = window.currentUser?.name || window.currentUser?.nama || 'User';
      jabatan.value = window.currentUser?.jabatan || window.currentUser?.role || 'Staff';
    }

    function buka() { muatData(); terbuka.value = true; }
    function tutup() { terbuka.value = false; }
    function bukaZoom() { zoomTerbuka.value = true; }
    function tutupZoom() { zoomTerbuka.value = false; }

    function navigasi(subtab) {
      tutup();
      window.pindahTab('tab-profil', 'tab-profil');
      if (window.pindahTabAccountProfile) window.pindahTabAccountProfile(subtab);
    }

    // HARUS lewat fungsi, bukan "window.logout" langsung di template — Vue
    // menganggap "window" properti komponen, tombol jadi diam. tutup() dipanggil
    // LANGSUNG karena signOut(auth) async: tanpa itu drawer masih bisa diklik
    // selama logout berjalan dan navigasinya tabrakan dengan proses logout.
    function keluar() { tutup(); if (window.logout) window.logout(); }

    return { terbuka, zoomTerbuka, qrUrl, nama, jabatan, buka, tutup, bukaZoom, tutupZoom, navigasi, keluar };
  },
  template: `
    <div>
      <div v-if="terbuka" @click="tutup" class="gc-drawer-backdrop fade-in"></div>
      <div class="gc-drawer" :class="{ open: terbuka }">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:18px 18px 0;">
          <h3 class="gc-heading" style="font-weight:700; font-size:15px;">Profile</h3>
          <button @click="tutup" style="background:none; border:none; color:var(--text-faint); font-size:18px; cursor:pointer;"><i class="fas fa-times"></i></button>
        </div>

        <div style="padding:18px;">
          <div @click="bukaZoom" style="width:100%; aspect-ratio:1/1; padding:14px; background:var(--ivory-dim); border-radius:18px; border:2px dashed var(--pink-deep); cursor:pointer;">
            <img :src="qrUrl" alt="QR Code" style="width:100%; height:100%; object-fit:contain;">
          </div>
          <div style="text-align:center; margin-top:12px;">
            <h4 class="gc-heading" style="font-weight:700; font-size:15px;">{{ nama }}</h4>
            <span class="tag ok" style="margin-top:6px;">{{ jabatan }}</span>
          </div>
        </div>

        <div style="border-top:1px solid var(--line); padding:8px 10px;">
          <button @click="navigasi('datadiri')" class="gc-drawer-link"><i class="fas fa-id-card"></i> Data Karyawan <i class="fas fa-chevron-right" style="margin-left:auto; font-size:11px; color:var(--text-faint);"></i></button>
          <button @click="navigasi('absensi')" class="gc-drawer-link"><i class="fas fa-history"></i> Absensi <i class="fas fa-chevron-right" style="margin-left:auto; font-size:11px; color:var(--text-faint);"></i></button>
          <button @click="navigasi('reimburse')" class="gc-drawer-link"><i class="fas fa-receipt"></i> Reimburse <i class="fas fa-chevron-right" style="margin-left:auto; font-size:11px; color:var(--text-faint);"></i></button>
          <button @click="navigasi('gaji')" class="gc-drawer-link"><i class="fas fa-sack-dollar"></i> Estimasi Gaji <i class="fas fa-chevron-right" style="margin-left:auto; font-size:11px; color:var(--text-faint);"></i></button>
          <button @click="navigasi('pencapaian')" class="gc-drawer-link"><i class="fas fa-trophy"></i> Pencapaian <i class="fas fa-chevron-right" style="margin-left:auto; font-size:11px; color:var(--text-faint);"></i></button>
          <button @click="navigasi('keamanan')" class="gc-drawer-link"><i class="fas fa-shield-alt"></i> Keamanan <i class="fas fa-chevron-right" style="margin-left:auto; font-size:11px; color:var(--text-faint);"></i></button>
        </div>

        <div style="padding:14px 18px; margin-top:auto;">
          <button @click="keluar" class="btn-outline block" style="color:var(--danger); border-color:var(--danger);">
            <i class="fas fa-sign-out-alt" style="margin-right:8px;"></i> Logout
          </button>
        </div>
      </div>

      <div v-if="zoomTerbuka" @click="tutupZoom" style="position:fixed; inset:0; background:rgba(59,42,31,.8); z-index:200; display:flex; align-items:center; justify-content:center; padding:24px;" class="fade-in">
        <div @click.stop style="position:relative; background:var(--surface); padding:20px; border-radius:20px; max-width:340px; width:100%;">
          <button @click="tutupZoom" style="position:absolute; top:-14px; right:-14px; width:34px; height:34px; border-radius:50%; background:var(--surface); border:1px solid var(--line); color:var(--mahogany); display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 8px rgba(91,56,38,.15);"><i class="fas fa-times"></i></button>
          <img :src="qrUrl" alt="QR Code besar" style="width:100%; height:auto;">
        </div>
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-profile-drawer');
if (mountPoint) {
  const vm = createApp(AppProfileDrawer).mount('#vue-profile-drawer');
  window.bukaProfileDrawer = function() { vm.buka(); };
  // Drawer di-mount DI LUAR #screen-dashboard, jadi TIDAK ikut tersembunyi saat
  // pindahLayar ganti layar (mis. ke screen-login pas logout) — akar masalah
  // yang sama seperti .gc-mobile-nav. Fungsi tutup diekspos supaya pindahLayar
  // bisa memaksa drawer tertutup tiap pindah ke layar SELAIN dashboard.
  window.tutupProfileDrawer = function() { vm.tutup(); };
}
