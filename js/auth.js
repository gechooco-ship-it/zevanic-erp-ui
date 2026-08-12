// js/auth.js
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

window.statusPilihanGlobal = "HADIR (CLOCK IN)";
window.currentUser = { email: "", name: "", role: "operator", id_app: "", id_karyawan: "", jabatan: "", status_kerja: "aktif" };

window.addEventListener('DOMContentLoaded', () => {
  const savedEmail = localStorage.getItem('zevanic_email');
  const savedPass = localStorage.getItem('zevanic_pass');
  if (savedEmail && savedPass) {
    document.getElementById('input-email').value = savedEmail;
    document.getElementById('input-pass').value = savedPass;
    document.getElementById('check-ingat').checked = true;
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

window.simpanPendaftaranBaru = async function() {
  const nama = document.getElementById('reg-nama').value;
  const nik = document.getElementById('reg-nik').value;
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const hp = document.getElementById('reg-hp').value;

  if(!nama || !nik || !email || !hp || !window.ktpBase64Global) {
    alert("Mohon lengkapi data wajib (Nama, NIK, Email, No HP, dan Foto KTP)!");
    return;
  }

  try {
    await setDoc(doc(db, "users", email), {
      id_karyawan: document.getElementById('reg-id').value,
      id_app: document.getElementById('reg-idapp').value,
      qr_code: "QR-" + document.getElementById('reg-idapp').value,
      status_kerja: "aktif",
      role: "operator",
      jabatan: "Staff",
      nama: nama,
      nik: nik,
      gender: document.getElementById('reg-gender').value,
      tempat_lahir: document.getElementById('reg-tempatlahir').value,
      tgl_lahir: document.getElementById('reg-tgl').value,
      foto_ktp: window.ktpBase64Global,
      email: email,
      hp: hp,
      alamat_tinggal: { kabupaten: document.getElementById('reg-tinggal-kab').value, kecamatan: document.getElementById('reg-tinggal-kec').value, detail: document.getElementById('reg-tinggal-detail').value },
      alamat_ktp: { kabupaten: document.getElementById('reg-ktp-kab').value, kecamatan: document.getElementById('reg-ktp-kec').value, detail: document.getElementById('reg-ktp-detail').value },
      status_nikah: document.getElementById('reg-nikah').value,
      tanggungan: document.getElementById('reg-tanggungan').value,
      pendidikan: { tingkat: document.getElementById('reg-pendidikan').value, sekolah: document.getElementById('reg-sekolah').value, jurusan: document.getElementById('reg-jurusan').value },
      bank: { nama: document.getElementById('reg-bank').value, norek: document.getElementById('reg-norek').value, atas_nama: document.getElementById('reg-namarek').value },
      kontak_darurat: { nama: document.getElementById('reg-darurat-nama').value, hp: document.getElementById('reg-darurat-hp').value, hubungan: document.getElementById('reg-darurat-hub').value },
      tanggal_daftar: new Date().toLocaleDateString('id-ID')
    });
    alert("Registrasi Karyawan Berhasil! Silakan login.");
    window.pindahLayar('screen-login');
  } catch (e) {
    console.error("Gagal daftar:", e);
    alert("Gagal menyimpan ke database.");
  }
};

window.prosesLogin = async function() {
  const emailInput = document.getElementById('input-email').value.trim().toLowerCase();
  const passInput = document.getElementById('input-pass').value;
  const ingatChecked = document.getElementById('check-ingat').checked;
  window.statusPilihanGlobal = document.getElementById('pilihan-status').value;

  if (!emailInput) {
    alert("Masukkan email terlebih dahulu!");
    return;
  }

  // Simpan Sesi Email
  if (ingatChecked) {
    localStorage.setItem('zevanic_email', emailInput);
    localStorage.setItem('zevanic_pass', passInput);
  } else {
    localStorage.removeItem('zevanic_email');
    localStorage.removeItem('zevanic_pass');
  }

  // Tarik Data User
  const userRef = doc(db, "users", emailInput);
  const userSnap = await getDoc(userRef);

  window.currentUser = { email: emailInput, name: emailInput, role: "operator", id_app: "N/A", id_karyawan: "N/A", jabatan: "Staff", status_kerja: "Aktif" };

  if (userSnap.exists()) {
    const dataU = userSnap.data();
    window.currentUser = {
      email: emailInput,
      name: dataU.nama || emailInput,
      role: dataU.role || "operator",
      id_app: dataU.id_app || "N/A",
      id_karyawan: dataU.id_karyawan || "N/A",
      jabatan: dataU.jabatan || "Staff",
      status_kerja: dataU.status_kerja || "Aktif"
    };
  } else {
    if (emailInput.includes('super')) window.currentUser.role = "superuser";
    else if (emailInput.includes('admin')) window.currentUser.role = "admin";
  }

  window.aturTampilanBerdasarkanRole();

  // ====== LOGIKA PINTAR: BYPASS KAMERA ======
  const hariIni = new Date().toLocaleDateString('id-ID');
  const statusLokal = localStorage.getItem('zevanic_absen_' + emailInput);

  // Jika sengaja pilih "Hanya Masuk Dashboard"
  if (window.statusPilihanGlobal === "MASUK DASHBOARD") {
      window.pindahLayar('screen-dashboard');
      window.pindahTab('tab-home');
      return;
  }

  // Jika pilih "Hadir" tapi sistem mendeteksi hari ini SUDAH HADIR
  if (window.statusPilihanGlobal === "HADIR (CLOCK IN)" && statusLokal === hariIni) {
      alert("Anda sudah Clock In hari ini. Mengalihkan langsung ke Dashboard...");
      window.pindahLayar('screen-dashboard');
      window.pindahTab('tab-home');
      return;
  }
  // ==========================================

  // Jika belum absen, lanjut buka kamera
  document.getElementById('label-status-kamera').innerText = "Mode: " + window.statusPilihanGlobal;
  window.pindahLayar('screen-camera');
};

window.prosesClockOut = function() {
  window.statusPilihanGlobal = "CLOCK OUT";
  document.getElementById('label-status-kamera').innerText = "Mode: CLOCK OUT";
  window.pindahLayar('screen-camera');
};

window.aturTampilanBerdasarkanRole = function() {
  document.getElementById('teks-nama-user').innerText = "Hi, " + window.currentUser.name;
  document.getElementById('label-role-sidebar').innerText = "Role: " + window.currentUser.role.toUpperCase();
  document.getElementById('label-badge-role').innerHTML = `<i class="far fa-clock mr-1.5"></i> ERP PORTAL - ${window.currentUser.role.toUpperCase()}`;

  const menuAdminAcc = document.getElementById('menu-admin-acc');
  const menuSuperUser = document.getElementById('menu-superuser');
  const navMobileAdmin = document.getElementById('nav-mobile-admin');
  const navMobileSuper = document.getElementById('nav-mobile-super');

  menuAdminAcc.classList.add('hidden');
  menuSuperUser.classList.add('hidden');
  navMobileAdmin.classList.add('hidden');
  navMobileSuper.classList.add('hidden');

  if (window.currentUser.role === 'admin' || window.currentUser.role === 'superuser') {
    menuAdminAcc.classList.remove('hidden');
    navMobileAdmin.classList.remove('hidden');
    navMobileAdmin.classList.add('flex'); 
  }
  if (window.currentUser.role === 'superuser') {
    menuSuperUser.classList.remove('hidden');
    navMobileSuper.classList.remove('hidden');
    navMobileSuper.classList.add('flex');
  }
};
