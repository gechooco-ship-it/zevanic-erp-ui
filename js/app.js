// js/app.js

// BARU (10 Sep 2026) — Browser History API KHUSUS utk screen-camera &
// screen-absensi-qr. Pelengkap §39 (dashboard.js) yang cuma menangani
// tombol back HP di DALAM Dashboard (pindah tab) — layar TOP-LEVEL ini
// (di luar #screen-dashboard) sebelumnya SAMA SEKALI tidak tercakup:
// tombol back HP/browser saat kamera atau Absensi QR terbuka langsung
// "keluar" ke riwayat browser SEBELUM app ini dibuka (atau ke halaman
// sebelumnya), bukan balik ke layar sebelumnya seperti tombol Batal/
// Kembali bawaan layar itu. Lihat laporan gap mobile 10 Sep 2026 (temuan
// #3, Code\Claude\GAP-MOBILE-10SEP2026.md) untuk detail investigasinya.
//
// SENGAJA TIDAK diperluas ke Login/Register/Buat Password: alur auth itu
// linear, dan begitu sampai screen-dashboard, entry riwayat browser LAMA
// (Login/Register) MASIH ada di stack di bawahnya — History API tidak
// bisa "menghapus" entry lama, cuma me-replace yang di puncak. Kalau
// dipaksa ikut dilacak, back HP dari dalam Dashboard bisa nyasar balik ke
// layar Login padahal user SUDAH login (norak, seolah ter-logout). Perlu
// desain terpisah (collapse riwayat auth flow) kalau mau ditangani —
// JANGAN ditebak sepihak di sini.
//
// Cara kerja: `_LAYAR_TERLACAK_BACK` daftar layar yang dilacak. Tiap
// masuk salah satunya (BUKAN dari popstate) → 1 `history.pushState()`.
// Listener 'popstate' di bawah membaca balik `state.layarBack` (bentuk
// state INI beda dari state tab Dashboard `{tab:...}`, jadi listener
// popstate dashboard.js otomatis aman mengabaikannya — dia cuma baca
// `state.tab`/`subTabs`/`vueTabs`). `_sedangDiLayarTerlacak` menandai
// apakah layar yang SEDANG TAMPIL sekarang adalah salah satu yang
// dilacak — dipakai listener buat tahu apakah 1 popstate ini urusannya
// atau bukan (biar tidak ikut campur navigasi tab biasa di Dashboard).
const _LAYAR_TERLACAK_BACK = ['screen-camera', 'screen-absensi-qr'];
let _sedangDiLayarTerlacak = false;

window.addEventListener('popstate', (e) => {
  if (!_sedangDiLayarTerlacak) return; // bukan urusan kita, biarkan listener dashboard.js yang tangani
  const state = e.state;
  _sedangDiLayarTerlacak = false; // di-set ulang oleh pindahLayar() di bawah sesuai tujuan barunya
  if (state && state.layarBack) {
    window.pindahLayar(state.layarBack, true); // masih rantai layar terlacak (mis. Absensi QR -> Kamera -> back)
  } else {
    window.pindahLayar('screen-dashboard', true); // keluar dari SEMUA layar terlacak, balik ke Dashboard
  }
});

window.pindahLayar = function(idTujuan, _dariPopstate) {
  const screens = ['screen-loading', 'screen-login', 'screen-register', 'screen-buat-password', 'screen-camera', 'screen-absensi-qr', 'screen-dashboard'];

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

  // BARU (10 Sep 2026) — lihat komentar panjang di atas fungsi ini.
  const jadiLayarTerlacak = _LAYAR_TERLACAK_BACK.includes(idTujuan);
  if (!_dariPopstate) {
    if (jadiLayarTerlacak && layarAktifSaatIni !== idTujuan) {
      try {
        history.pushState({ layarBack: idTujuan }, '', location.href);
      } catch (e) {
        console.error('Gagal catat riwayat navigasi layar kamera/QR (tidak fatal, navigasi tetap lanjut):', e);
      }
    } else if (_sedangDiLayarTerlacak && !jadiLayarTerlacak) {
      // Keluar dari layar terlacak lewat jalur NORMAL (tombol Batal, submit
      // sukses, dst — bukan tombol back HP) — netralkan entry yang tadi
      // dipush, supaya back berikutnya tidak nyangkut di entry basi yang
      // sudah tidak relevan lagi.
      try { history.replaceState(null, '', location.href); } catch (e) {}
    }
  }
  _sedangDiLayarTerlacak = jadiLayarTerlacak;

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

  // FIX (28 Agt 2026, laporan Guru "klik logout, drawer masih buka tidak
  // langsung tutup, menu lainnya jadi bisa diklik") — Drawer Profile
  // (js/vue-profile-drawer.js) SAMA PERSIS kasusnya dengan .gc-mobile-nav
  // di atas: di-mount DI LUAR #screen-dashboard, jadi TIDAK ikut otomatis
  // tersembunyi waktu pindah layar (mis. logout -> screen-login). Kalau
  // drawer masih terbuka (state Vue `terbuka` internalnya, bukan cuma
  // class hidden) saat pindahLayar() dipanggil ke layar LAIN, paksa tutup
  // di sini — jaring pengaman buat SEMUA jalur pindah layar, bukan cuma
  // logout (kamera, absensi QR, dst kalau kelak dibuka juga dari drawer).
  // GANTI (28 Agt 2026, redesain "Gechoo Mobile Organic") — drawer lama
  // (window.tutupProfileDrawer) DIHAPUS TOTAL, ganti Bottom Sheet Profil
  // (js/vue-sheet-profil.js, window.tutupSheetProfil). Jaring pengaman
  // SAMA PERSIS seperti sebelumnya, cuma nama fungsinya beda.
  if (idTujuan !== 'screen-dashboard' && window.tutupSheetProfil) window.tutupSheetProfil();

  // BARU (10 Sep 2026) — jaring pengaman SAMA PERSIS utk Bottom Sheet
  // Picker "Mau scan apa?" (js/vue-popup-scan.js) — sheet ini juga
  // dimount DI LUAR #screen-dashboard.
  if (idTujuan !== 'screen-dashboard' && window.tutupPaksaPopupPilihanScan) window.tutupPaksaPopupPilihanScan();

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
  const mnavHome = document.getElementById('mnav-home');
  if (mnavHome) mnavHome.addEventListener('click', () => window.pindahTab('tab-home'));

  const mnavAbsensi = document.getElementById('mnav-absensi');
  if (mnavAbsensi) mnavAbsensi.addEventListener('click', () => {
    window.pindahTab('tab-profil', 'tab-profil-absensi');
    if (window.bukaTabAbsensiProfile) window.bukaTabAbsensiProfile();
  });

  // BARU (10 Sep 2026) — dulu langsung window.pindahTab('tab-scan-qr'),
  // SEKARANG buka Bottom Sheet Picker "Mau scan apa?" dulu (js/vue-popup-
  // scan.js, pola M2) — lihat komentar panjang di file itu. Kalau
  // konteks aktif belum ada pilihan spesifik, sheet tetap muncul dengan
  // 1 pilihan default yang PERSIS berperilaku sama seperti sebelumnya.
  const mnavScanQr = document.getElementById('mnav-scanqr');
  if (mnavScanQr) mnavScanQr.addEventListener('click', () => {
    if (window.bukaPopupPilihanScan) window.bukaPopupPilihanScan();
    else window.pindahTab('tab-scan-qr'); // jaring pengaman kalau file sheet gagal/telat dimuat
  });

  const mnavProgress = document.getElementById('mnav-progress');
  if (mnavProgress) mnavProgress.addEventListener('click', () => window.pindahTab('tab-progress'));

  // GANTI (28 Agt 2026, redesain "Gechoo Mobile Organic", keputusan Guru
  // "hapus total, ganti bersih") — window.bukaProfileDrawer (drawer geser
  // dari kanan) DIHAPUS TOTAL, ganti window.bukaSheetProfil (Bottom Sheet
  // naik dari bawah, js/vue-sheet-profil.js).
  const mnavProfile = document.getElementById('mnav-profile');
  if (mnavProfile) mnavProfile.addEventListener('click', () => {
    if (window.matikanScanQr) window.matikanScanQr();
    if (window.bukaSheetProfil) window.bukaSheetProfil();
  });
});

// Catatan: window.pindahTab sengaja TIDAK didefinisikan di sini.
// Fungsi ini dimiliki oleh js/dashboard.js (versi yang null-safe dan
// menangani sub-tab profil/admin-acc/superuser). Dulu ada definisi
// duplikat di file ini yang masih mereferensikan 'tab-riwayat' tanpa
// cek null — berbahaya jika dashboard.js gagal/terlambat dimuat.