// js/app.js
window.pindahLayar = function(idTujuan) {
  const screens = ['screen-login', 'screen-register', 'screen-camera', 'screen-dashboard'];
  
  screens.forEach(screen => {
    document.getElementById(screen).classList.add('hidden');
    document.getElementById(screen).classList.remove('flex');
  });

  document.getElementById(idTujuan).classList.remove('hidden');
  document.getElementById(idTujuan).classList.add('flex');

  // Panggil fungsi kamera jika ke layar kamera
  if (idTujuan === 'screen-camera' && window.mulaiKamera) {
    window.mulaiKamera();
  } else if (window.matikanKamera) {
    window.matikanKamera();
  }
};

// Catatan: window.pindahTab sengaja TIDAK didefinisikan di sini.
// Fungsi ini dimiliki oleh js/dashboard.js (versi yang null-safe dan
// menangani sub-tab profil/admin-acc/superuser). Dulu ada definisi
// duplikat di file ini yang masih mereferensikan 'tab-riwayat' tanpa
// cek null — berbahaya jika dashboard.js gagal/terlambat dimuat.