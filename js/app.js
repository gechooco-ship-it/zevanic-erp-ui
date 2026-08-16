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