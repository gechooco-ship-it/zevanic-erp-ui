// js/auth.js
import { doc, setDoc, getDoc, collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

window.statusPilihanGlobal = "HADIR (CLOCK IN)";
window.currentUser = { email: "", name: "", role: "operator", id_app: "", id_karyawan: "", jabatan: "", status_kerja: "aktif" };
window._manualLoginInProgress = false; // dicek oleh onAuthStateChanged, disetel oleh vue-login.js

// window.authReady — PERBAIKAN BUG: semua layar Master Absensi/Master
// Karyawan (Antrean Dakar, Config Karyawan, Config Absensi, Daftar
// Karyawan, Penjadwalan, Antrean Absensi, Riwayat All Absensi) sebelumnya
// langsung ambil data Firestore begitu Vue-nya ter-mount (onMounted) — TANPA
// menunggu Firebase Auth benar-benar selesai memastikan status login. Kalau
// itu terjadi SEBELUM Auth siap (terutama pas sesi otomatis, yang butuh
// waktu cek dulu), Firestore Rules menolak baca datanya (karena dianggap
// belum login), dan karena tidak ada percobaan ulang, tabelnya macet
// "Memuat data..." selamanya sampai halaman di-reload manual.
//
// Listener INI SENGAJA terpisah dari onAuthStateChanged besar di bawah
// (yang urus logic sesi-otomatis/navigasi layar) — supaya tidak mengganggu
// logic sensitif itu sama sekali. Fungsinya cuma satu: kasih sinyal "Auth
// sudah pasti tahu jawabannya (login atau tidak)", dipakai semua komponen
// Vue yang fetch data lewat `await window.authReady` sebelum mulai ambil.
window.authReady = new Promise((resolve) => {
  const lepasListener = onAuthStateChanged(auth, (user) => {
    lepasListener();
    resolve(user);
  });
});

// Pesan error Firebase Auth diterjemahkan ke Bahasa Indonesia yang ramah pengguna
function pesanErrorAuth(kode) {
  const peta = {
    "auth/email-already-in-use": "Email ini sudah terdaftar. Silakan login.",
    "auth/invalid-email": "Format email tidak valid.",
    "auth/weak-password": "Password terlalu lemah, minimal 6 karakter.",
    "auth/wrong-password": "Email atau password salah.",
    "auth/user-not-found": "Email atau password salah.",
    "auth/invalid-credential": "Email atau password salah.",
    "auth/too-many-requests": "Terlalu banyak percobaan gagal. Coba lagi beberapa saat lagi.",
    "auth/network-request-failed": "Gagal terhubung ke server. Cek koneksi internet Anda."
  };
  return peta[kode] || null;
}
window.pesanErrorAuth = pesanErrorAuth; // dipakai juga oleh js/vue-registrasi.js

// Helper bersama (dipakai juga oleh dashboard.js): gudang_penempatan dulu string
// tunggal, sekarang array (mendukung banyak gudang). Ini menormalkan keduanya.
window.normalisasiGudang = function(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

// Helper bersama (dipakai vue-riwayat-absensi.js, vue-account-profile.js,
// vue-whatsapp-gateway.js untuk sorting berdasarkan waktu): field `waktu` di
// Firestore disimpan sebagai string locale Indonesia dari
// new Date().toLocaleString('id-ID'), formatnya "D/M/YYYY, HH.MM.SS" (titik
// sebagai pemisah jam, BUKAN titik dua) — new Date(waktuStr) tidak bisa parse
// ini secara langsung, jadi perlu di-parse manual di sini.
window.parseWaktuIndo = function(waktuStr) {
  if (!waktuStr || typeof waktuStr !== 'string') return null;
  try {
    const [tglPart, jamPart] = waktuStr.split(',').map(s => s.trim());
    if (!tglPart) return null;
    const [tgl, bln, thn] = tglPart.split('/').map(Number);
    if (!tgl || !bln || !thn) return null;
    let jam = 0, mnt = 0, dtk = 0;
    if (jamPart) {
      const bagianJam = jamPart.split('.').map(Number);
      jam = bagianJam[0] || 0;
      mnt = bagianJam[1] || 0;
      dtk = bagianJam[2] || 0;
    }
    const hasil = new Date(thn, bln - 1, tgl, jam, mnt, dtk);
    return isNaN(hasil.getTime()) ? null : hasil;
  } catch (e) {
    return null;
  }
};

// isDesktopBrowser & sudahClockInHariIniServer sudah direplikasi di
// js/vue-login.js (dipakai murni untuk gerbang login).

// Poin 1: cek apakah waktu sekarang masih dalam jam shift yang di-assign ke karyawan ini
window.cekMasihJamKerja = async function(namaShift) {
  if (!namaShift) return false; // tidak ada shift ter-assign -> tidak bisa dipastikan, wajib login ulang
  try {
    const qShift = await getDocs(collection(db, "master_shift"));
    let shiftData = null;
    qShift.forEach(s => { if (s.data().nama_shift === namaShift) shiftData = s.data(); });
    if (!shiftData || !shiftData.jam_masuk || !shiftData.jam_keluar) return false;

    const sekarang = new Date();
    const [jamMasukH, jamMasukM] = shiftData.jam_masuk.split(':').map(Number);
    const [jamKeluarH, jamKeluarM] = shiftData.jam_keluar.split(':').map(Number);

    const mulai = new Date(sekarang); mulai.setHours(jamMasukH, jamMasukM, 0, 0);
    let selesai = new Date(sekarang); selesai.setHours(jamKeluarH, jamKeluarM, 0, 0);
    if (selesai <= mulai) selesai.setDate(selesai.getDate() + 1); // shift lewat tengah malam

    return sekarang >= mulai && sekarang <= selesai;
  } catch (e) {
    console.error("Gagal cek jam kerja:", e);
    return false;
  }
};

// =========================================================================
// WHATSAPP GATEWAY (Fonnte lewat Google Apps Script sebagai perantara aman).
// Konfigurasi (URL Apps Script + kunci rahasia) disimpan di Firestore
// config/whatsapp_gateway, diatur lewat Menu Karyawan > WhatsApp Gateway.
// Token Fonnte sendiri TIDAK PERNAH ada di kode ini — disimpan di Apps Script.
// =========================================================================
window.kirimPesanWhatsapp = async function(nomor, pesan, jenis) {
  jenis = jenis || "Lainnya";
  let sukses = false;
  let keterangan = "";
  try {
    const configSnap = await getDoc(doc(db, "config", "whatsapp_gateway"));
    if (!configSnap.exists()) {
      keterangan = "Konfigurasi WhatsApp Gateway belum diatur.";
      console.warn(keterangan);
    } else {
      const cfg = configSnap.data();
      if (!cfg.webapp_url || !cfg.shared_secret) {
        keterangan = "URL Apps Script atau kunci rahasia belum diisi.";
        console.warn(keterangan);
      } else {
        // Menumpang di Apps Script project WA Gateway yang sudah ada (bot produksi) —
        // routing pakai query string ?modul=absensi sesuai hook yang sudah disiapkan
        // di doPost() mereka, supaya satu nomor/token bisa dipakai berdampingan.
        const urlDenganModul = cfg.webapp_url + (cfg.webapp_url.includes('?') ? '&' : '?') + 'modul=absensi';
        // Content-Type text/plain sengaja dipakai supaya browser tidak melakukan
        // CORS preflight (OPTIONS) yang tidak ditangani baik oleh Apps Script Web App.
        const resp = await fetch(urlDenganModul, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ secret: cfg.shared_secret, target: nomor, message: pesan })
        });
        const hasil = await resp.json();
        sukses = !!hasil.sukses;
        keterangan = hasil.pesan || (sukses ? "Terkirim." : "Gagal tanpa keterangan.");
      }
    }
  } catch (e) {
    console.error("Gagal kirim WhatsApp:", e);
    keterangan = e.message || "Error tidak diketahui.";
  }

  // Catat ke log untuk panel Monitoring Respon (best-effort, tidak menghambat alur utama)
  try {
    await addDoc(collection(db, "wa_log"), {
      waktu: new Date().toLocaleString('id-ID'),
      target: nomor,
      jenis: jenis,
      pesan: pesan,
      sukses: sukses,
      keterangan: keterangan
    });
  } catch (e) {
    console.error("Gagal mencatat log WA:", e);
  }

  return sukses;
};

// Ambil template pesan yang bisa diedit Owner (Menu WhatsApp Gateway > Template
// Pesan). jenis: 'template_otp' | 'template_aktif' | 'template_pending'
const TEMPLATE_DEFAULT_AUTH = {
  template_otp: "Kode OTP login Zevanic ERP Anda: *{kode}*. Jangan bagikan kode ini ke siapapun. Berlaku 5 menit.",
  template_aktif: "Halo {nama}, akun Zevanic ERP Anda sudah *AKTIF*. Anda sekarang bisa login dan melakukan absensi.",
  template_pending: "Halo {nama}, pendaftaran Anda di Zevanic ERP telah diterima dan sedang *menunggu persetujuan*. Silakan hubungi Koordinator/PIC untuk aktivasi akun Anda."
};
async function ambilTemplateWA(jenis) {
  try {
    const snap = await getDoc(doc(db, "config", "whatsapp_templates"));
    if (snap.exists() && snap.data()[jenis]) return snap.data()[jenis];
  } catch (e) {
    console.error("Gagal ambil template WA:", e);
  }
  return TEMPLATE_DEFAULT_AUTH[jenis];
}
window.ambilTemplateWA = ambilTemplateWA; // dipakai juga oleh dashboard.js

// OTP login perangkat baru sudah pindah ke js/vue-login.js.


// =========================================================================
// Poin 1: SESI OTOMATIS — kalau browser ditutup lalu dibuka lagi, dan sesi
// Firebase masih tersimpan, dan user masih dalam jam kerja shift-nya, dan
// sudah Clock In hari ini -> langsung ke Dashboard tanpa isi ulang email/
// password. Ini HANYA jalan sekali saat aplikasi pertama kali dimuat, bukan
// setiap kali status auth berubah (supaya tidak bentrok dengan proses login
// manual di js/vue-login.js).
// =========================================================================
let sesiOtomatisSudahDicek = false;
onAuthStateChanged(auth, async (user) => {
  // Jangan proses kalau: sudah pernah selesai diproses SEBELUMNYA dengan user
  // nyata, ATAU sedang ada proses login manual aktif (window.js/vue-login.js
  // yang urus, supaya tidak bentrok/dobel navigasi).
  if (sesiOtomatisSudahDicek || window._manualLoginInProgress) return;

  if (!user || !user.email) {
    // PENTING: TIDAK mengunci di sini. Firebase kadang memanggil callback ini
    // dengan user=null SEMENTARA sebelum sesi tersimpan selesai dicek dari
    // penyimpanan lokal — kalau kita kunci di sini, sesi yang sebenarnya ada
    // tidak akan pernah diproses saat callback dipanggil ulang dengan user
    // yang benar. Layar loading tetap tampil untuk saat ini; kalau memang
    // tidak ada sesi tersimpan, callback ini tidak akan dipanggil lagi — jadi
    // kita beri sedikit toleransi lalu pindah ke layar Login sebagai fallback.
    setTimeout(() => {
      if (!sesiOtomatisSudahDicek && window.pindahLayar) window.pindahLayar('screen-login');
    }, 1200);
    return;
  }

  sesiOtomatisSudahDicek = true; // kunci HANYA setelah dapat user yang nyata
  let berhasilMasukDashboard = false;

  try {
    const userSnap = await getDoc(doc(db, "users", user.email));
    if (!userSnap.exists()) return;
    const d = userSnap.data();

    if (d.status_approval && d.status_approval !== "APPROVED") return;

    const roleUser = (d.role || "operator").toLowerCase();
    const isOwnerRole = (roleUser === 'owner' || roleUser === 'superuser');
    const gudangUser = window.normalisasiGudang(d.gudang_penempatan);

    if (!isOwnerRole) {
      if (gudangUser.length === 0) return;

      const hariIni = new Date().toLocaleDateString('id-ID');
      const statusLokal = localStorage.getItem('zevanic_absen_' + user.email);
      if (statusLokal !== hariIni) return; // belum Clock In hari ini -> tetap layar login

      const masihJamKerja = await window.cekMasihJamKerja(d.nama_shift);
      if (!masihJamKerja) return; // di luar jam kerja -> wajib login ulang
    }
    // Owner/Superuser: lewati semua syarat Clock In/gudang/jam kerja di atas —
    // perannya manajerial, boleh masuk kapan saja dari HP maupun komputer.

    // Semua syarat terpenuhi -> lewati layar login, langsung ke Dashboard
    window.currentUser = {
      ...d,
      email: user.email,
      name: d.nama || d.name || user.email,
      role: roleUser,
      id_app: d.id_app || "N/A",
      id_karyawan: d.id_karyawan || "N/A",
      jabatan: d.jabatan || "Staff",
      status_kerja: d.status_kerja || "Aktif",
      gudang_penempatan: gudangUser
    };
    if (window.aturTampilanBerdasarkanRole) window.aturTampilanBerdasarkanRole();
    if (window.refreshAccountProfileDisplay) window.refreshAccountProfileDisplay();
    if (window.pindahLayar) window.pindahLayar('screen-dashboard');
    if (window.pindahTab) window.pindahTab('tab-home');
    berhasilMasukDashboard = true;
  } catch (e) {
    console.error("Gagal cek sesi otomatis:", e);
  } finally {
    // Semua jalur yang TIDAK berhasil masuk Dashboard (profil tak ditemukan,
    // belum di-approve, belum Clock In, di luar jam shift, error) berakhir di
    // sini — pindah dari layar loading ke layar Login.
    if (!berhasilMasukDashboard && window.pindahLayar) window.pindahLayar('screen-login');
  }
});

// Prefill email "Ingat Saya" + deteksi desktop (sembunyikan dropdown status)
// sudah dipindah ke onMounted() di js/vue-login.js.

window.bukaFormRegistrasi = function() {
  window.pindahLayar('screen-register');
  if (window.resetFormRegistrasi) window.resetFormRegistrasi();
};

// Registrasi karyawan baru (form, dropdown Kabupaten/Kecamatan, submit +
// rollback akun jika simpan profil gagal) sudah pindah ke
// js/vue-registrasi.js.


// LOGIN (prosesLogin, lanjutkanSetelahLogin) + Modal OTP sudah pindah ke
// js/vue-login.js. window.prosesClockOut TETAP di bawah sini (dipanggil
// dari Vue Account Profile).


window.prosesClockOut = function() {
  const hariIni = new Date().toLocaleDateString('id-ID');
  const statusLokal = localStorage.getItem('zevanic_absen_' + window.currentUser.email);
  if (statusLokal !== hariIni) {
    alert("Anda belum Clock In hari ini, tidak bisa Clock Out.");
    return;
  }
  window.statusPilihanGlobal = "CLOCK OUT";
  document.getElementById('label-status-kamera').innerText = "Mode: CLOCK OUT";
  window.pindahLayar('screen-camera');
};

// Pengajuan Izin/Cuti/Lembur (form-nya) sudah pindah ke
// js/vue-account-profile.js. Variabel global (statusPilihanGlobal,
// tanggalIzinGlobal, keteranganIzinGlobal, lemburMulaiGlobal, dst) dan
// window.pindahLayar('screen-camera') TETAP dipakai — itu titik sambung ke
// alur kamera/geofencing yang belum dimigrasi. window.prosesClockOut TETAP
// di atas sini (dipanggil dari Vue).

// Lupa Password: pakai fitur bawaan Firebase Auth (kirim link reset ke email
// terdaftar). Tidak butuh WhatsApp/backend tambahan — ini paling aman & simpel.
window.lupaPassword = async function() {
  const email = document.getElementById('input-email').value.trim().toLowerCase();
  if (!email) {
    alert("Isi dulu email Anda di kolom Email/Akun Login di atas, baru klik \"Lupa Password?\".");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    alert("Link reset password sudah dikirim ke " + email + ". Cek inbox (atau folder Spam) email Anda.");
  } catch (e) {
    console.error("Gagal kirim reset password:", e);
    alert(pesanErrorAuth(e.code) || "Gagal mengirim link reset password: " + e.message);
  }
};

// Logout sungguhan: keluar dari sesi Firebase Auth, bukan cuma pindah layar
window.logout = async function() {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("Gagal logout dari Firebase Auth:", e);
  }
  window.currentUser = { email: "", name: "", role: "operator", id_app: "", id_karyawan: "", jabatan: "", status_kerja: "aktif" };
  window.pindahLayar('screen-login');
};

// js/auth.js (Bagian Aturan Tampilan Berdasarkan Role)

window.aturTampilanBerdasarkanRole = function() {
  document.getElementById('teks-nama-user').innerText = "Hi, " + window.currentUser.name;
  document.getElementById('label-role-sidebar').innerText = "Role: " + window.currentUser.role.toUpperCase();
  document.getElementById('label-badge-role').innerHTML = `<i class="far fa-clock mr-1.5"></i> ERP Portal - ${window.currentUser.role.toUpperCase()}`;

  const role = (window.currentUser.role || "operator").toLowerCase();

  const menuAdminAcc = document.getElementById('menu-admin-acc');
  const menuAdminAccBtn = document.getElementById('menu-admin-acc-btn');
  const menuSuperUser = document.getElementById('menu-superuser');
  const menuSuperUserBtn = document.getElementById('menu-superuser-btn');
  const menuWhatsapp = document.getElementById('menu-whatsapp');
  const menuWhatsappBtn = document.getElementById('menu-whatsapp-btn');
  const navMobileAdmin = document.getElementById('nav-mobile-admin');
  const navMobileSuper = document.getElementById('nav-mobile-super');
  const navMobileWhatsapp = document.getElementById('nav-mobile-whatsapp');

  [menuAdminAcc, menuAdminAccBtn, menuSuperUser, menuSuperUserBtn, menuWhatsapp, menuWhatsappBtn, navMobileAdmin, navMobileSuper, navMobileWhatsapp].forEach(el => {
    if (el) el.classList.add('hidden');
  });

  if (role === 'pic' || role === 'owner' || role === 'admin' || role === 'superuser') {
    if (menuAdminAcc) menuAdminAcc.classList.remove('hidden');
    if (menuAdminAccBtn) menuAdminAccBtn.classList.remove('hidden');
    if (navMobileAdmin) {
      navMobileAdmin.classList.remove('hidden');
      navMobileAdmin.classList.add('flex');
    }
  }

  if (role === 'owner' || role === 'superuser') {
    if (menuSuperUser) menuSuperUser.classList.remove('hidden');
    if (menuSuperUserBtn) menuSuperUserBtn.classList.remove('hidden');
    if (navMobileSuper) {
      navMobileSuper.classList.remove('hidden');
      navMobileSuper.classList.add('flex');
    }
    if (menuWhatsapp) menuWhatsapp.classList.remove('hidden');
    if (menuWhatsappBtn) menuWhatsappBtn.classList.remove('hidden');
    if (navMobileWhatsapp) {
      navMobileWhatsapp.classList.remove('hidden');
      navMobileWhatsapp.classList.add('flex');
    }
  }
};
