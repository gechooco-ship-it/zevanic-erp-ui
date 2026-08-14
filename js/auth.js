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
  // Generate ID Otomatis
  document.getElementById('reg-id').value = "ZVN-" + Math.floor(1000 + Math.random() * 9000);
  document.getElementById('reg-idapp').value = "ZMS-" + Math.floor(1000 + Math.random() * 9000);
  window.pindahLayar('screen-register');
};

// Data Dummy Kecamatan untuk Registrasi (Bisa dikembangkan via API nanti)
window.updateKecamatanTinggal = function() {
  const kab = document.getElementById('reg-tinggal-kab').value;
  const kec = document.getElementById('reg-tinggal-kec');
  kec.innerHTML = "";
  let opsi = [];
  if (kab === "Bandung") opsi = ["Baleendah", "Banjaran", "Bojongsoang", "Cimaung", "Dayeuhkolot", "Pameungpeuk"];
  else if (kab === "Bandung Barat") opsi = ["Lembang", "Padalarang", "Cimareme"];
  else if (kab === "Cimahi") opsi = ["Cimahi Selatan", "Cimahi Tengah", "Cimahi Utara"];
  else if (kab === "Garut") opsi = ["Tarogong", "Leles", "Kadungora"];
  opsi.forEach(k => kec.innerHTML += `<option value="${k}">${k}</option>`);
};

window.updateKecamatanKTP = function() {
  const kab = document.getElementById('reg-ktp-kab').value;
  const kec = document.getElementById('reg-ktp-kec');
  kec.innerHTML = "";
  let opsi = [];
  if (kab === "Bandung") opsi = ["Baleendah", "Banjaran", "Bojongsoang", "Cimaung", "Dayeuhkolot", "Pameungpeuk"];
  else if (kab === "Bandung Barat") opsi = ["Lembang", "Padalarang", "Cimareme"];
  else if (kab === "Cimahi") opsi = ["Cimahi Selatan", "Cimahi Tengah", "Cimahi Utara"];
  else if (kab === "Garut") opsi = ["Tarogong", "Leles", "Kadungora"];
  opsi.forEach(k => kec.innerHTML += `<option value="${k}">${k}</option>`);
};

window.salinAlamat = function() {
  const isChecked = document.getElementById('check-sama-alamat').checked;
  if (isChecked) {
    document.getElementById('reg-ktp-kab').value = document.getElementById('reg-tinggal-kab').value;
    window.updateKecamatanKTP();
    setTimeout(() => {
      document.getElementById('reg-ktp-kec').value = document.getElementById('reg-tinggal-kec').value;
    }, 100);
    document.getElementById('reg-ktp-detail').value = document.getElementById('reg-tinggal-detail').value;
  } else {
    document.getElementById('reg-ktp-detail').value = "";
  }
};

window.simpanPendaftaranBaru = async function() {
  const btn = document.querySelector('#screen-register button[onclick="simpanPendaftaranBaru()"]');
  const oldText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Memproses Pendaftaran...';
  btn.disabled = true;

  try {
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    const confirmPass = document.getElementById('reg-confirm-pass').value;

    // VALIDASI PASSWORD KEAMANAN LOGIN
    if (!email || !pass || !confirmPass) {
      alert("Email dan Kata Sandi wajib diisi!");
      btn.innerHTML = oldText; btn.disabled = false; return;
    }
    if (pass !== confirmPass) {
      alert("Kata sandi dan Konfirmasi Kata Sandi tidak cocok! Harap periksa kembali.");
      btn.innerHTML = oldText; btn.disabled = false; return;
    }
    if (pass.length < 6) {
      alert("Kata sandi minimal harus 6 karakter untuk keamanan sistem.");
      btn.innerHTML = oldText; btn.disabled = false; return;
    }

    const userData = {
      nama: document.getElementById('reg-nama').value,
      nik: document.getElementById('reg-nik').value,
      tempatLahir: document.getElementById('reg-tempatlahir').value,
      tglLahir: document.getElementById('reg-tgl').value,
      gender: document.getElementById('reg-gender').value,
      hp: document.getElementById('reg-hp').value,
      email: email,
      password: pass, // Disimpan untuk validasi Login Manual
      
      ktpKab: document.getElementById('reg-ktp-kab').value,
      ktpKec: document.getElementById('reg-ktp-kec').value,
      ktpDetail: document.getElementById('reg-ktp-detail').value,
      tinggalKab: document.getElementById('reg-tinggal-kab').value,
      tinggalKec: document.getElementById('reg-tinggal-kec').value,
      tinggalDetail: document.getElementById('reg-tinggal-detail').value,
      
      pendidikan: document.getElementById('reg-pendidikan').value,
      sekolah: document.getElementById('reg-sekolah').value,
      jurusan: document.getElementById('reg-jurusan').value,
      nikah: document.getElementById('reg-nikah').value,
      tanggungan: document.getElementById('reg-tanggungan').value,
      
      daruratNama: document.getElementById('reg-darurat-nama').value,
      daruratHub: document.getElementById('reg-darurat-hub').value,
      daruratHp: document.getElementById('reg-darurat-hp').value,
      
      bank: document.getElementById('reg-bank').value,
      norek: document.getElementById('reg-norek').value,
      namarek: document.getElementById('reg-namarek').value,
      
      id_karyawan: document.getElementById('reg-id').value,
      id_app: document.getElementById('reg-idapp').value,
      role: 'operator',
      jabatan: 'Staff',
      status_kerja: 'aktif',
      tgl_daftar: new Date().toISOString(),
      ktp_base64: window.ktpBase64Global || ""
    };

    await setDoc(doc(db, "users", email), userData);

    alert("Pendaftaran Karyawan Berhasil! Silakan login menggunakan Email dan Kata Sandi Anda.");
    window.pindahLayar('screen-login');
  } catch (error) {
    console.error("Error Registrasi:", error);
    alert("Terjadi kesalahan saat mendaftar. Pastikan koneksi internet stabil.");
  } finally {
    btn.innerHTML = oldText;
    btn.disabled = false;
  }
};



window.prosesLogin = async function() {
  const emailInput = document.getElementById('input-email').value;
  const passInput = document.getElementById('input-pass').value;
  const remember = document.getElementById('check-ingat').checked;

  try {
    const userSnap = await getDoc(doc(db, "users", emailInput));
    if (userSnap.exists()) {
      const data = userSnap.data();
      
      // FIX BUG PASSWORD: 
      // Jika akun lama tidak punya password di database, izinkan masuk sementara.
      // Tapi jika ada password, wajib cocok!
      if (data.password) {
        if (data.password !== passInput) {
          alert("Kata sandi salah! Silakan coba lagi.");
          return;
        }
      } else {
         console.warn("Akun lama terdeteksi (belum ada password di DB). Melanjutkan login...");
      }

      if (data.status_kerja === "tidak aktif") {
        alert("Akun Anda saat ini dinonaktifkan. Hubungi Admin.");
        return;
      }

      window.currentUser = data;

      if (remember) {
        localStorage.setItem('zevanic_email', emailInput);
        localStorage.setItem('zevanic_pass', passInput);
      } else {
        localStorage.removeItem('zevanic_email');
        localStorage.removeItem('zevanic_pass');
      }

      aturHakAksesRole();
      window.pindahLayar('screen-dashboard');
      window.pindahTab('tab-home');

    } else {
      alert("Akun tidak ditemukan! Silakan daftar terlebih dahulu.");
    }
  } catch (error) {
    console.error("Login Error:", error);
    alert("Koneksi gagal. Cek jaringan Anda.");
  }
};

window.prosesLogout = function() {
  window.currentUser = null;
  window.pindahLayar('screen-login');
};

function aturHakAksesRole() {
  document.getElementById('role-badge').innerText = `ERP PORTAL - ${window.currentUser.role.toUpperCase()}`;

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
}

window.bukaPreviewFoto = function(srcUrl) {
  const modal = document.createElement('div');
  modal.className = "fixed inset-0 z-[99] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in";
  modal.innerHTML = `
    <div class="relative w-full max-w-lg">
      <button onclick="this.parentElement.parentElement.remove()" class="absolute -top-10 right-0 text-white hover:text-red-500 text-3xl transition"><i class="fas fa-times"></i></button>
      <img src="${srcUrl}" class="w-full h-auto rounded-2xl shadow-2xl object-contain bg-white">
    </div>
  `;
  document.body.appendChild(modal);
};