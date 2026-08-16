// js/app.js
window.pindahLayar = function(idTujuan) {
  const screens = ['screen-loading', 'screen-login', 'screen-register', 'screen-camera', 'screen-dashboard'];

  // Ingat layar yang aktif SEBELUM pindah — dipakai tombol Batal/Kembali
  // di layar kamera (js/vue-camera.js) supaya tahu harus kembali ke mana:
  // ke Login (kalau masuk kamera dari alur Login pertama kali) atau ke
  // Dashboard (kalau masuk kamera dari shortcut Clock In/Izin/Cuti/Lembur
  // di Home, yang berarti sudah dalam sesi Dashboard).
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

  // PERBAIKAN REGRESI: nav mobile sekarang posisinya di LUAR
  // #screen-dashboard (dipindah untuk perbaikan bug sentuhan sebelumnya)
  // — akibatnya dia TIDAK LAGI otomatis ikut tersembunyi saat layar lain
  // (Login/Kamera/dst) aktif, karena dulu itu terjadi otomatis lewat
  // #screen-dashboard yang ditutup. Sekarang harus diatur eksplisit di
  // sini: nav CUMA muncul kalau tujuannya screen-dashboard.
  const navMobile = document.querySelector('.gc-mobile-nav');
  if (navMobile) {
    if (idTujuan === 'screen-dashboard') navMobile.classList.remove('hidden');
    else navMobile.classList.add('hidden');
  }

  // Panggil fungsi kamera jika ke layar kamera
  if (idTujuan === 'screen-camera' && window.mulaiKamera) {
    window.mulaiKamera();
  } else if (window.matikanKamera) {
    window.matikanKamera();
  }
};

// Nav mobile (Home/Absensi/Scan QR/Progress/Profile) — SENGAJA dipasang
// lewat addEventListener di sini, BUKAN onclick="..." langsung di HTML.
// Ditemukan lewat pengetesan panjang bersama user: onclick inline di
// tombol-tombol ini tidak merespon di lingkungan produksi mereka (diduga
// diblokir aturan keamanan browser/hosting), padahal panggil fungsi yang
// SAMA lewat Console atau lewat @click Vue selalu berhasil. Memasang
// listener lewat JS (persis seperti cara Vue mengikat @click di baliknya)
// menghindari masalah itu sepenuhnya, apapun penyebab pastinya.
window.addEventListener('DOMContentLoaded', () => {
  console.log('[DEBUG] DOMContentLoaded jalan, mulai pasang listener nav mobile...');

  const mnavHome = document.getElementById('mnav-home');
  console.log('[DEBUG] elemen mnav-home ditemukan?', !!mnavHome);
  if (mnavHome) mnavHome.addEventListener('click', () => {
    console.log('[DEBUG] tombol Home DIKLIK, panggil pindahTab...');
    window.pindahTab('tab-home');
    console.log('[DEBUG] pindahTab(tab-home) selesai dipanggil. tab-home hidden?', document.getElementById('tab-home').classList.contains('hidden'));
  });

  const mnavAbsensi = document.getElementById('mnav-absensi');
  console.log('[DEBUG] elemen mnav-absensi ditemukan?', !!mnavAbsensi);
  if (mnavAbsensi) mnavAbsensi.addEventListener('click', () => {
    console.log('[DEBUG] tombol Absensi DIKLIK, panggil pindahTab...');
    window.pindahTab('tab-profil', 'tab-profil-absensi');
    if (window.bukaTabAbsensiProfile) window.bukaTabAbsensiProfile();
    console.log('[DEBUG] Absensi selesai. tab-profil hidden?', document.getElementById('tab-profil').classList.contains('hidden'));
  });

  const mnavScanQr = document.getElementById('mnav-scanqr');
  if (mnavScanQr) mnavScanQr.addEventListener('click', () => window.pindahTab('tab-scan-qr'));

  const mnavProgress = document.getElementById('mnav-progress');
  if (mnavProgress) mnavProgress.addEventListener('click', () => window.pindahTab('tab-progress'));

  const mnavProfile = document.getElementById('mnav-profile');
  if (mnavProfile) mnavProfile.addEventListener('click', () => {
    if (window.matikanScanQr) window.matikanScanQr();
    if (window.bukaProfileDrawer) window.bukaProfileDrawer();
  });

  console.log('[DEBUG] semua listener nav mobile selesai dipasang.');
});

// Catatan: window.pindahTab sengaja TIDAK didefinisikan di sini.
// Fungsi ini dimiliki oleh js/dashboard.js (versi yang null-safe dan
// menangani sub-tab profil/admin-acc/superuser). Dulu ada definisi
// duplikat di file ini yang masih mereferensikan 'tab-riwayat' tanpa
// cek null — berbahaya jika dashboard.js gagal/terlambat dimuat.