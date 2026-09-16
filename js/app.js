// js/app.js
// Router layar tingkat atas (bukan tab): menyembunyikan/menampilkan #screen-*
// dan memasang listener nav bawah mobile. Tanpa Vue, tanpa Firestore.
//
// Koleksi & field:
// - Tidak menyentuh Firestore; murni manipulasi DOM + state global window.
//
// Jebakan:
// - .gc-mobile-nav, Bottom Sheet Profil, dan Bottom Sheet Pilihan Scan
//   di-mount DI LUAR #screen-dashboard, jadi tidak ikut tersembunyi sendiri —
//   pindahLayar wajib menutup ketiganya eksplisit.
// - window._layarSebelumKamera diisi di sini; tombol Batal di vue-camera.js
//   bergantung penuh padanya untuk tahu harus kembali ke Login atau Dashboard.
// - Tombol nav diikat lewat addEventListener, BUKAN onclick inline di HTML —
//   onclick inline tidak merespon di lingkungan produksi. Jangan dikembalikan.
// - window.pindahTab bukan milik file ini (ada di dashboard.js). Jangan
//   didefinisikan ulang di sini.
window.pindahLayar = function(idTujuan) {
  const screens = ['screen-loading', 'screen-login', 'screen-register', 'screen-buat-password', 'screen-camera', 'screen-absensi-qr', 'screen-dashboard'];

  // Ingat layar aktif SEBELUM pindah — dipakai tombol Batal/Kembali di layar
  // kamera (js/vue-camera.js) supaya tahu balik ke Login (masuk dari alur login)
  // atau ke Dashboard (masuk dari shortcut Clock In/Izin/Cuti/Lembur di Home).
  const layarAktifSaatIni = screens.find(s => {
    const el = document.getElementById(s);
    return el && !el.classList.contains('hidden');
  });
  if (layarAktifSaatIni && layarAktifSaatIni !== idTujuan) {
    window._layarSebelumKamera = layarAktifSaatIni;
  }

  screens.forEach(screen => {
    document.getElementById(screen).classList.add('hidden');
    document.getElementById(screen).classList.remove('flex');
  });

  document.getElementById(idTujuan).classList.remove('hidden');
  document.getElementById(idTujuan).classList.add('flex');

  // Nav mobile di-mount DI LUAR #screen-dashboard, jadi tidak ikut tersembunyi
  // otomatis saat layar lain aktif. Harus diatur eksplisit di sini: nav cuma
  // muncul kalau tujuannya screen-dashboard.
  const navMobile = document.querySelector('.gc-mobile-nav');
  if (navMobile) {
    if (idTujuan === 'screen-dashboard') navMobile.classList.remove('hidden');
    else navMobile.classList.add('hidden');
  }

  // Bottom Sheet Profil (js/vue-sheet-profil.js) di-mount DI LUAR
  // #screen-dashboard, jadi tidak ikut tersembunyi saat pindah layar. Kalau
  // masih terbuka (state Vue `terbuka`) saat pindah ke layar lain, paksa tutup
  // lewat window.tutupSheetProfil — jaring pengaman semua jalur pindah layar.
  if (idTujuan !== 'screen-dashboard' && window.tutupSheetProfil) window.tutupSheetProfil();

  // Sama seperti Sheet Profil di atas — Bottom Sheet Pilihan Scan
  // (js/vue-popup-scan.js) juga di luar #screen-dashboard, jaring pengaman
  // yang sama supaya tidak nyangkut terbuka saat pindah ke layar kamera dst.
  if (idTujuan !== 'screen-dashboard' && window.tutupPaksaPopupPilihanScan) window.tutupPaksaPopupPilihanScan();

  // Panggil fungsi kamera jika ke layar kamera
  if (idTujuan === 'screen-camera' && window.mulaiKamera) {
    window.mulaiKamera();
  } else if (window.matikanKamera) {
    window.matikanKamera();
  }
};

// Nav mobile (Home/Absensi/Scan QR/Progress/Profile) dipasang lewat
// addEventListener, BUKAN onclick inline di HTML: onclick inline tidak merespon
// di lingkungan produksi, sedangkan listener via JS selalu jalan. Jangan
// dikembalikan ke onclick inline.
window.addEventListener('DOMContentLoaded', () => {
  const mnavHome = document.getElementById('mnav-home');
  if (mnavHome) mnavHome.addEventListener('click', () => window.pindahTab('tab-home'));

  const mnavAbsensi = document.getElementById('mnav-absensi');
  if (mnavAbsensi) mnavAbsensi.addEventListener('click', () => {
    window.pindahTab('tab-profil', 'tab-profil-absensi');
    if (window.bukaTabAbsensiProfile) window.bukaTabAbsensiProfile();
  });

  // Tombol QR: buka Bottom Sheet "Mau scan apa?" (js/vue-popup-scan.js) dulu,
  // BUKAN lompat langsung ke tab-scan-qr — sheet itu sendiri yang lanjut ke
  // tab-scan-qr sebagai pilihan default kalau konteks aktif tidak match
  // modul manapun di PETA_PILIHAN_SCAN.
  const mnavScanQr = document.getElementById('mnav-scanqr');
  if (mnavScanQr) mnavScanQr.addEventListener('click', () => {
    if (window.bukaPopupPilihanScan) window.bukaPopupPilihanScan();
    else window.pindahTab('tab-scan-qr');
  });

  const mnavProgress = document.getElementById('mnav-progress');
  if (mnavProgress) mnavProgress.addEventListener('click', () => window.pindahTab('tab-progress'));

  // window.bukaProfileDrawer (drawer geser dari kanan) DIHAPUS TOTAL, ganti
  // window.bukaSheetProfil (Bottom Sheet naik dari bawah,
  // js/vue-sheet-profil.js).
  const mnavProfile = document.getElementById('mnav-profile');
  if (mnavProfile) mnavProfile.addEventListener('click', () => {
    if (window.matikanScanQr) window.matikanScanQr();
    if (window.bukaSheetProfil) window.bukaSheetProfil();
  });
});

// window.pindahTab sengaja TIDAK didefinisikan di sini. Fungsi ini milik
// js/dashboard.js (versi null-safe yang menangani sub-tab profil/admin-acc/
// superuser). Definisi duplikat di sini berbahaya kalau dashboard.js telat muat.