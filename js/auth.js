// js/auth.js
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

window.statusPilihanGlobal = "HADIR (CLOCK IN)";
window.currentUser = { email: "", name: "", role: "operator", id_app: "", id_karyawan: "", jabatan: "", status_kerja: "aktif" };

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

// Helper bersama (dipakai juga oleh dashboard.js): gudang_penempatan dulu string
// tunggal, sekarang array (mendukung banyak gudang). Ini menormalkan keduanya.
window.normalisasiGudang = function(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

window.addEventListener('DOMContentLoaded', () => {
  // Catatan: password TIDAK PERNAH disimpan di localStorage (dulu iya, ini bug keamanan).
  // "Ingat Saya" sekarang hanya mengingat alamat email untuk kenyamanan pengisian form.
  const savedEmail = localStorage.getItem('zevanic_email');
  if (savedEmail) {
    document.getElementById('input-email').value = savedEmail;
    document.getElementById('check-ingat').checked = true;
  }
  // Bersihkan sisa password lama yang mungkin masih tersimpan dari versi sebelumnya
  localStorage.removeItem('zevanic_pass');

  if (document.getElementById('reg-tinggal-kab')) window.updateKecamatanTinggal();
  if (document.getElementById('reg-ktp-kab')) window.updateKecamatanKTP();
});

window.bukaFormRegistrasi = function() {
  document.getElementById('reg-id').value = "ZVN-" + Math.floor(1000 + Math.random() * 9000);
  document.getElementById('reg-idapp').value = "ZMS-" + Math.floor(1000 + Math.random() * 9000);
  window.pindahLayar('screen-register');
};

window.updateKecamatanTinggal = function() {
  const kab = document.getElementById('reg-tinggal-kab').value;
  const kec = document.getElementById('reg-tinggal-kec');
  if(!kec) return;
  kec.innerHTML = "";
  let list = kab === "Bandung" ? ["Cimaung", "Banjaran", "Soreang"] : (kab === "Bandung Barat" ? ["Lembang", "Padalarang", "Ngamprah"] : ["Cimahi Utara", "Cimahi Tengah", "Cimahi Selatan"]);
  list.forEach(k => kec.innerHTML += `<option value="${k}">${k}</option>`);
};

window.updateKecamatanKTP = function() {
  const kab = document.getElementById('reg-ktp-kab').value;
  const kec = document.getElementById('reg-ktp-kec');
  if(!kec) return;
  kec.innerHTML = "";
  let list = kab === "Bandung" ? ["Cimaung", "Banjaran", "Soreang"] : (kab === "Bandung Barat" ? ["Lembang", "Padalarang", "Ngamprah"] : ["Cimahi Utara", "Cimahi Tengah", "Cimahi Selatan"]);
  list.forEach(k => kec.innerHTML += `<option value="${k}">${k}</option>`);
};

window.salinAlamat = function() {
  if(document.getElementById('check-sama-alamat').checked) {
    document.getElementById('reg-ktp-kab').value = document.getElementById('reg-tinggal-kab').value;
    window.updateKecamatanKTP();
    document.getElementById('reg-ktp-kec').value = document.getElementById('reg-tinggal-kec').value;
    document.getElementById('reg-ktp-detail').value = document.getElementById('reg-tinggal-detail').value;
  }
};

// ============================================================================
// REGISTRASI: membuat akun Firebase Auth sungguhan + menyimpan profil lengkap
// Skema field profil di sini SENGAJA disamakan persis dengan yang dibaca/ditulis
// oleh js/dashboard.js (pindahSubProfile & simpanUpdateDataDiriLengkap), supaya
// data yang diisi saat registrasi langsung muncul kembali di tab "Data Diri".
// ============================================================================
window.simpanPendaftaranBaru = async function() {
  const btn = event.currentTarget;
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
  btn.disabled = true;

  const nama = document.getElementById('reg-nama').value.trim();
  const nik = document.getElementById('reg-nik').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const hp = document.getElementById('reg-hp').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const confirmPass = document.getElementById('reg-confirm-pass').value;

  if (!nama || !nik || !email || !hp || !pass || !confirmPass || !window.ktpBase64Global) {
    alert("Mohon lengkapi data wajib (Nama, NIK, Email, No HP, Password, dan Foto KTP)!");
    btn.innerHTML = originalText;
    btn.disabled = false;
    return;
  }

  if (pass !== confirmPass) {
    alert("Konfirmasi password tidak sama dengan password!");
    btn.innerHTML = originalText;
    btn.disabled = false;
    return;
  }

  if (pass.length < 6) {
    alert("Password minimal 6 karakter!");
    btn.innerHTML = originalText;
    btn.disabled = false;
    return;
  }

  try {
    // 1. Buat akun autentikasi sungguhan di Firebase Auth
    await createUserWithEmailAndPassword(auth, email, pass);

    // 2. Simpan profil lengkap ke Firestore (skema flat, sama dengan dashboard.js)
    // Akun baru MASUK ANTREAN dulu — PIC/Owner wajib approve & lengkapi
    // status kerja, role akses, jabatan, tipe karyawan, dan gudang penempatan
    // lewat Menu Karyawan > Antrean Karyawan sebelum akun ini bisa dipakai.
    await setDoc(doc(db, "users", email), {
      id_karyawan: document.getElementById('reg-id').value,
      id_app: document.getElementById('reg-idapp').value,
      qr_code: "QR-" + document.getElementById('reg-idapp').value,
      status_approval: "PENDING",
      status_kerja: "Menunggu Persetujuan",
      role: "operator",
      jabatan: "",
      status_karyawan: "",
      gudang_penempatan: [],
      nama_shift: "",

      email: email,
      nama: nama,
      name: nama,
      nik: nik,
      hp: hp,
      gender: document.getElementById('reg-gender').value,
      tempatLahir: document.getElementById('reg-tempatlahir').value,
      tglLahir: document.getElementById('reg-tgl').value,
      foto_ktp: window.ktpBase64Global,

      tinggalKab: document.getElementById('reg-tinggal-kab').value,
      tinggalKec: document.getElementById('reg-tinggal-kec').value,
      tinggalDetail: document.getElementById('reg-tinggal-detail').value,

      ktpKab: document.getElementById('reg-ktp-kab').value,
      ktpKec: document.getElementById('reg-ktp-kec').value,
      ktpDetail: document.getElementById('reg-ktp-detail').value,

      statusNikah: document.getElementById('reg-nikah').value,
      tanggungan: document.getElementById('reg-tanggungan').value,

      pendidikan: document.getElementById('reg-pendidikan').value,
      sekolah: document.getElementById('reg-sekolah').value,
      jurusan: document.getElementById('reg-jurusan').value,

      bank: document.getElementById('reg-bank').value,
      noRek: document.getElementById('reg-norek').value,
      atasNamaRek: document.getElementById('reg-namarek').value,

      daruratNama: document.getElementById('reg-darurat-nama').value,
      daruratHp: document.getElementById('reg-darurat-hp').value,
      daruratHub: document.getElementById('reg-darurat-hub').value,

      tanggal_daftar: new Date().toLocaleDateString('id-ID')
    });

    alert("Registrasi Berhasil! Akun Anda menunggu persetujuan Owner/PIC sebelum bisa dipakai login.");
    window.pindahLayar('screen-login');
  } catch (e) {
    console.error("Gagal daftar:", e);
    alert(pesanErrorAuth(e.code) || "Gagal menyimpan pendaftaran: " + e.message);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

// ============================================================================
// LOGIN: memverifikasi email + password sungguhan lewat Firebase Auth.
// Tidak ada lagi "tebak role dari email" — akses hanya diberikan setelah
// autentikasi berhasil, dan role diambil dari data Firestore yang tersimpan.
// ============================================================================
window.prosesLogin = async function() {
  const emailInput = document.getElementById('input-email').value.trim().toLowerCase();
  const passInput = document.getElementById('input-pass').value;
  const ingatChecked = document.getElementById('check-ingat').checked;
  window.statusPilihanGlobal = document.getElementById('pilihan-status').value;

  // Tangkap Data Form Ekstra
  window.tanggalIzinGlobal = document.getElementById('input-tgl-izin') ? document.getElementById('input-tgl-izin').value : "";
  window.keteranganIzinGlobal = document.getElementById('input-ket-izin') ? document.getElementById('input-ket-izin').value : "";

  if (!emailInput || !passInput) {
    alert("Masukkan email dan password terlebih dahulu!");
    return;
  }

  // Validasi Izin & Cuti
  if (window.statusPilihanGlobal === "IZIN" || window.statusPilihanGlobal === "CUTI") {
    if (!window.tanggalIzinGlobal || !window.keteranganIzinGlobal) {
      alert("Harap isi Tanggal dan Keterangan untuk pengajuan Izin/Cuti!");
      return;
    }

    if (window.statusPilihanGlobal === "CUTI") {
      const tglPilih = new Date(window.tanggalIzinGlobal);
      const tglSekarang = new Date();
      tglSekarang.setHours(0,0,0,0);

      const selisihHari = (tglPilih - tglSekarang) / (1000 * 60 * 60 * 24);
      if (selisihHari < 3) {
        alert("Pengajuan Cuti minimal H-3 dari tanggal hari ini!");
        return;
      }
    }
  }

  // Verifikasi email + password sungguhan ke Firebase Auth
  try {
    await signInWithEmailAndPassword(auth, emailInput, passInput);
  } catch (e) {
    console.error("Gagal login:", e);
    alert(pesanErrorAuth(e.code) || "Gagal login: " + e.message);
    return;
  }

  // Simpan/hapus sesi email (password TIDAK PERNAH disimpan)
  if (ingatChecked) {
    localStorage.setItem('zevanic_email', emailInput);
  } else {
    localStorage.removeItem('zevanic_email');
  }
  localStorage.removeItem('zevanic_pass');

  // Tarik profil lengkap dari Firestore
  const userRef = doc(db, "users", emailInput);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const d = userSnap.data();
    window.currentUser = {
      ...d,
      email: emailInput,
      name: d.nama || d.name || emailInput,
      role: (d.role || "operator").toLowerCase(),
      id_app: d.id_app || "N/A",
      id_karyawan: d.id_karyawan || "N/A",
      jabatan: d.jabatan || "Staff",
      status_kerja: d.status_kerja || "Aktif",
      gudang_penempatan: window.normalisasiGudang(d.gudang_penempatan)
    };

    // Gerbang persetujuan: akun yang belum di-approve (atau ditolak) tidak boleh masuk.
    // Akun lama yang belum pernah lewat alur Antrean Karyawan (tidak punya field ini)
    // tetap diizinkan, supaya tidak mengunci akun-akun yang sudah aktif sebelumnya.
    if (d.status_approval && d.status_approval !== "APPROVED") {
      alert(d.status_approval === "PENDING"
        ? "Akun Anda masih menunggu persetujuan Owner/PIC. Silakan hubungi mereka."
        : "Akun Anda tidak disetujui untuk mengakses sistem. Silakan hubungi Owner/PIC.");
      await signOut(auth);
      return;
    }

    // Gerbang gudang: karyawan yang belum ditautkan ke gudang manapun tidak bisa login.
    if (window.currentUser.gudang_penempatan.length === 0) {
      alert("Akun Anda belum ditautkan ke gudang manapun. Silakan hubungi Owner/PIC.");
      await signOut(auth);
      return;
    }
  } else {
    // Akun Auth ada tapi profil Firestore-nya tidak ditemukan — jangan beri akses.
    alert("Profil akun Anda tidak ditemukan. Silakan hubungi Owner/PIC.");
    await signOut(auth);
    return;
  }

  window.aturTampilanBerdasarkanRole();

  // Bypass Kamera
  const hariIni = new Date().toLocaleDateString('id-ID');
  const statusLokal = localStorage.getItem('zevanic_absen_' + emailInput);

  if (window.statusPilihanGlobal === "MASUK DASHBOARD") {
      window.pindahLayar('screen-dashboard');
      window.pindahTab('tab-home');
      return;
  }

  if (window.statusPilihanGlobal === "HADIR (CLOCK IN)" && statusLokal === hariIni) {
      alert("Anda sudah Clock In hari ini. Mengalihkan langsung ke Dashboard...");
      window.pindahLayar('screen-dashboard');
      window.pindahTab('tab-home');
      return;
  }

  // Lanjut Buka Kamera
  document.getElementById('label-status-kamera').innerText = "Mode: " + window.statusPilihanGlobal;
  window.pindahLayar('screen-camera');
};

window.prosesClockOut = function() {
  window.statusPilihanGlobal = "CLOCK OUT";
  document.getElementById('label-status-kamera').innerText = "Mode: CLOCK OUT";
  window.pindahLayar('screen-camera');
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
  document.getElementById('label-badge-role').innerHTML = `<i class="far fa-clock mr-1.5"></i> ERP PORTAL - ${window.currentUser.role.toUpperCase()}`;

  const role = (window.currentUser.role || "operator").toLowerCase();

  const menuAdminAcc = document.getElementById('menu-admin-acc');
  const menuSuperUser = document.getElementById('menu-superuser');
  const navMobileAdmin = document.getElementById('nav-mobile-admin');
  const navMobileSuper = document.getElementById('nav-mobile-super');

  if (menuAdminAcc) menuAdminAcc.classList.add('hidden');
  if (menuSuperUser) menuSuperUser.classList.add('hidden');
  if (navMobileAdmin) navMobileAdmin.classList.add('hidden');
  if (navMobileSuper) navMobileSuper.classList.add('hidden');

  if (role === 'pic' || role === 'owner' || role === 'admin' || role === 'superuser') {
    if (menuAdminAcc) menuAdminAcc.classList.remove('hidden');
    if (navMobileAdmin) {
      navMobileAdmin.classList.remove('hidden');
      navMobileAdmin.classList.add('flex');
    }
  }

  if (role === 'owner' || role === 'superuser') {
    if (menuSuperUser) menuSuperUser.classList.remove('hidden');
    if (navMobileSuper) {
      navMobileSuper.classList.remove('hidden');
      navMobileSuper.classList.add('flex');
    }
  }
};
