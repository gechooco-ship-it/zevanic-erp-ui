// js/auth.js
import { doc, setDoc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
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

// Poin 4: deteksi perangkat desktop (bukan HP/tablet)
function isDesktopBrowser() {
  return !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Poin 4: cek ke server (bukan localStorage) apakah user ini sudah Clock In hari ini —
// harus ke server karena Clock In wajib dari HP, lalu login berikutnya boleh dari desktop.
async function sudahClockInHariIniServer(email) {
  const hariIni = new Date().toLocaleDateString('id-ID');
  try {
    const querySnapshot = await getDocs(collection(db, "absensi"));
    let ditemukan = false;
    querySnapshot.forEach(docSnap => {
      const d = docSnap.data();
      if (d.email === email && d.status === "HADIR (CLOCK IN)" && d.waktu) {
        const tglRecord = d.waktu.split(', ')[0];
        if (tglRecord === hariIni) ditemukan = true;
      }
    });
    return ditemukan;
  } catch (e) {
    console.error("Gagal cek status clock-in:", e);
    return false; // gagal cek -> anggap belum, lebih aman (fail-safe, bukan fail-open)
  }
}

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
window.kirimPesanWhatsapp = async function(nomor, pesan) {
  try {
    const configSnap = await getDoc(doc(db, "config", "whatsapp_gateway"));
    if (!configSnap.exists()) {
      console.warn("Konfigurasi WhatsApp Gateway belum diatur.");
      return false;
    }
    const cfg = configSnap.data();
    if (!cfg.webapp_url || !cfg.shared_secret) {
      console.warn("URL Apps Script atau kunci rahasia belum diisi.");
      return false;
    }
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
    return !!hasil.sukses;
  } catch (e) {
    console.error("Gagal kirim WhatsApp:", e);
    return false;
  }
};

// ---- OTP login perangkat baru (Poin 1: sekali per perangkat) ----
window._otpState = { kode: null, email: null, kadaluarsa: null };

window.apakahOtpDiperlukan = async function(email) {
  try {
    const configSnap = await getDoc(doc(db, "config", "whatsapp_gateway"));
    if (!configSnap.exists() || !configSnap.data().otp_aktif) return false;
  } catch (e) {
    console.error("Gagal cek konfigurasi OTP:", e);
    return false; // gagal cek konfigurasi -> jangan halangi login
  }
  const sudahTerverifikasi = localStorage.getItem('zevanic_device_verified_' + email) === 'true';
  return !sudahTerverifikasi;
};

window.mulaiVerifikasiOtp = async function(email) {
  const kode = String(Math.floor(100000 + Math.random() * 900000));
  window._otpState = { kode, email, kadaluarsa: Date.now() + 5 * 60 * 1000 };

  let nomorHp = "";
  try {
    const userSnap = await getDoc(doc(db, "users", email));
    if (userSnap.exists()) nomorHp = userSnap.data().hp || "";
  } catch (e) { console.error(e); }

  if (!nomorHp) {
    alert("Nomor HP Anda belum terdaftar di sistem, tidak bisa mengirim OTP. Hubungi Owner/PIC.");
    return false;
  }

  const terkirim = await window.kirimPesanWhatsapp(
    nomorHp,
    `Kode OTP login Zevanic ERP Anda: *${kode}*. Jangan bagikan kode ini ke siapapun. Berlaku 5 menit.`
  );
  if (!terkirim) {
    alert("Gagal mengirim kode OTP lewat WhatsApp. Coba lagi atau hubungi Owner/PIC.");
    return false;
  }

  const infoNomor = document.getElementById('otp-info-nomor');
  if (infoNomor) infoNomor.innerText = nomorHp.replace(/(\d{4})\d+(\d{3})/, '$1****$2');
  const otpInput = document.getElementById('otp-input');
  if (otpInput) otpInput.value = '';
  document.getElementById('modal-otp').classList.remove('hidden');
  return true;
};

window.batalkanOtp = async function() {
  document.getElementById('modal-otp').classList.add('hidden');
  await signOut(auth);
};

window.kirimUlangOtp = function() {
  if (window._otpState.email) window.mulaiVerifikasiOtp(window._otpState.email);
};

window.verifikasiOtpDanLanjut = async function() {
  const kodeInput = document.getElementById('otp-input').value.trim();
  if (!window._otpState.kode || Date.now() > window._otpState.kadaluarsa) {
    alert("Kode OTP sudah kadaluarsa. Silakan kirim ulang.");
    return;
  }
  if (kodeInput !== window._otpState.kode) {
    alert("Kode OTP salah. Silakan coba lagi.");
    return;
  }
  localStorage.setItem('zevanic_device_verified_' + window._otpState.email, 'true');
  document.getElementById('modal-otp').classList.add('hidden');
  await window.lanjutkanSetelahLogin(window._otpState.email);
};

// =========================================================================
// Poin 1: SESI OTOMATIS — kalau browser ditutup lalu dibuka lagi, dan sesi
// Firebase masih tersimpan, dan user masih dalam jam kerja shift-nya, dan
// sudah Clock In hari ini -> langsung ke Dashboard tanpa isi ulang email/
// password. Ini HANYA jalan sekali saat aplikasi pertama kali dimuat, bukan
// setiap kali status auth berubah (supaya tidak bentrok dengan proses login
// manual di prosesLogin()).
// =========================================================================
let sesiOtomatisSudahDicek = false;
onAuthStateChanged(auth, async (user) => {
  if (sesiOtomatisSudahDicek) return;
  sesiOtomatisSudahDicek = true;
  if (!user || !user.email) return; // tidak ada sesi tersimpan -> layar login tampil normal

  try {
    const userSnap = await getDoc(doc(db, "users", user.email));
    if (!userSnap.exists()) return;
    const d = userSnap.data();

    if (d.status_approval && d.status_approval !== "APPROVED") return;

    const gudangUser = window.normalisasiGudang(d.gudang_penempatan);
    if (gudangUser.length === 0) return;

    const hariIni = new Date().toLocaleDateString('id-ID');
    const statusLokal = localStorage.getItem('zevanic_absen_' + user.email);
    if (statusLokal !== hariIni) return; // belum Clock In hari ini -> tetap layar login

    const masihJamKerja = await window.cekMasihJamKerja(d.nama_shift);
    if (!masihJamKerja) return; // di luar jam kerja -> wajib login ulang

    // Semua syarat terpenuhi -> lewati layar login, langsung ke Dashboard
    window.currentUser = {
      ...d,
      email: user.email,
      name: d.nama || d.name || user.email,
      role: (d.role || "operator").toLowerCase(),
      id_app: d.id_app || "N/A",
      id_karyawan: d.id_karyawan || "N/A",
      jabatan: d.jabatan || "Staff",
      status_kerja: d.status_kerja || "Aktif",
      gudang_penempatan: gudangUser
    };
    if (window.aturTampilanBerdasarkanRole) window.aturTampilanBerdasarkanRole();
    if (window.pindahLayar) window.pindahLayar('screen-dashboard');
    if (window.pindahTab) window.pindahTab('tab-home');
  } catch (e) {
    console.error("Gagal cek sesi otomatis:", e);
  }
});

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

  // Desktop tidak dipakai untuk Clock In/Izin/Cuti (semua butuh selfie via kamera).
  // Sembunyikan seluruh dropdown pilihan status, jangan paksa ke opsi manapun.
  // Login desktop cuma untuk masuk Dashboard setelah Clock In dari HP.
  if (isDesktopBrowser()) {
    const wadahStatus = document.getElementById('wadah-pilihan-status');
    const formIzin = document.getElementById('form-izin-cuti');
    const infoDesktop = document.getElementById('info-desktop-login');
    if (wadahStatus) wadahStatus.classList.add('hidden');
    if (formIzin) formIzin.classList.add('hidden');
    if (infoDesktop) infoDesktop.classList.remove('hidden');
    window.statusPilihanGlobal = "HADIR (CLOCK IN)"; // nilai internal saja, tidak dipakai untuk apapun di desktop
  }

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

    // Notifikasi WA (Poin 4): akun berhasil diajukan, menunggu persetujuan
    window.kirimPesanWhatsapp(
      hp,
      `Halo ${nama}, pendaftaran Anda di Zevanic ERP telah diterima dan sedang *menunggu persetujuan*. Silakan hubungi Koordinator/PIC untuk aktivasi akun Anda.`
    ).catch(e => console.error("Gagal kirim notifikasi WA pendaftaran:", e));

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

  // Verifikasi OTP WhatsApp — hanya untuk login PERTAMA di perangkat ini.
  // Kalau perlu, alur login "dijeda" di sini (modal OTP tampil) dan akan
  // dilanjutkan oleh verifikasiOtpDanLanjut() setelah kode benar.
  const otpDiperlukan = await window.apakahOtpDiperlukan(emailInput);
  if (otpDiperlukan) {
    const terkirim = await window.mulaiVerifikasiOtp(emailInput);
    if (!terkirim) await signOut(auth); // gagal kirim OTP -> jangan biarkan sesi menggantung
    return;
  }

  await window.lanjutkanSetelahLogin(emailInput);
};

// Sisa proses login (gerbang perangkat, approval, gudang, routing ke dashboard/kamera).
// Dipanggil langsung dari prosesLogin() kalau OTP tidak diperlukan, atau dipanggil
// dari verifikasiOtpDanLanjut() setelah kode OTP benar.
window.lanjutkanSetelahLogin = async function(emailInput) {
  // Simpan/hapus sesi email (password TIDAK PERNAH disimpan)
  const ingatChecked = document.getElementById('check-ingat').checked;
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

  const hariIni = new Date().toLocaleDateString('id-ID');
  const statusLokal = localStorage.getItem('zevanic_absen_' + emailInput);
  const sudahClockInHariIni = statusLokal === hariIni;

  // Desktop: satu-satunya jalan masuk adalah kalau sudah Clock In hari ini
  // (lewat HP). Tidak ada alur kamera/Izin/Cuti sama sekali di desktop.
  if (isDesktopBrowser()) {
    if (sudahClockInHariIni) {
      window.pindahLayar('screen-dashboard');
      window.pindahTab('tab-home');
    } else {
      alert("Login lewat komputer cuma bisa dipakai kalau Anda sudah Clock In hari ini. Silakan Clock In dari HP terlebih dahulu, atau ajukan Izin/Cuti dari HP.");
      await signOut(auth);
    }
    return;
  }

  // ---- Mulai di sini: alur khusus perangkat mobile (butuh kamera) ----
  if (window.statusPilihanGlobal === "MASUK DASHBOARD") {
      window.pindahLayar('screen-dashboard');
      window.pindahTab('tab-home');
      return;
  }

  if (window.statusPilihanGlobal === "HADIR (CLOCK IN)" && sudahClockInHariIni) {
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

// Poin 10: Ajukan Cuti sekarang lewat Account Profile > ID & QR (bukan dropdown login lagi)
window.bukaFormCutiProfil = function() {
  document.getElementById('form-cuti-profil').classList.remove('hidden');
};
window.tutupFormCutiProfil = function() {
  document.getElementById('form-cuti-profil').classList.add('hidden');
  document.getElementById('profil-cuti-tanggal').value = '';
  document.getElementById('profil-cuti-keterangan').value = '';
};
window.ajukanCutiDariProfil = function() {
  const tanggal = document.getElementById('profil-cuti-tanggal').value;
  const keterangan = document.getElementById('profil-cuti-keterangan').value;

  if (!tanggal || !keterangan) {
    alert("Harap isi Tanggal dan Keterangan Cuti!");
    return;
  }

  const tglPilih = new Date(tanggal);
  const tglSekarang = new Date();
  tglSekarang.setHours(0, 0, 0, 0);
  const selisihHari = (tglPilih - tglSekarang) / (1000 * 60 * 60 * 24);
  if (selisihHari < 3) {
    alert("Pengajuan Cuti minimal H-3 dari tanggal hari ini!");
    return;
  }

  window.statusPilihanGlobal = "CUTI";
  window.tanggalIzinGlobal = tanggal;
  window.keteranganIzinGlobal = keterangan;
  window.tutupFormCutiProfil();
  document.getElementById('label-status-kamera').innerText = "Mode: CUTI";
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
