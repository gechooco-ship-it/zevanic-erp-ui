// js/vue-login.js
// ============================================================================
// Migrasi layar Login (+ modal OTP) ke Vue. INI BAGIAN PALING SENSITIF DI
// SELURUH APLIKASI — autentikasi, sesi, dan gerbang akses. Setiap logic di
// bawah ini SENGAJA direplikasi PERSIS SAMA dengan versi vanilla sebelumnya,
// tidak ada perubahan perilaku.
//
// TIDAK disentuh / tetap murni vanilla di auth.js:
// - onAuthStateChanged (sesi otomatis) — berjalan independen di level modul,
//   tidak bergantung pada elemen form manapun, jadi aman dibiarkan apa adanya.
// - window.lupaPassword — TETAP membaca document.getElementById('input-email')
//   secara langsung; makanya input email di Vue ini WAJIB tetap pakai
//   id="input-email" (v-model tetap menjaga .value DOM-nya sinkron).
// - window.bukaFormRegistrasi, window.aturTampilanBerdasarkanRole,
//   window.pindahLayar, window.pindahTab, window.ambilMasterList,
//   window.kirimPesanWhatsapp, window.ambilTemplateWA, window.pesanErrorAuth
//   — semua dipanggil apa adanya dari sini.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

function isDesktopBrowser() {
  return !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Poin 4: cek ke server (bukan localStorage) apakah user ini sudah Clock In
// hari ini — Clock In terjadi di HP, desktop tidak akan pernah tahu soal itu
// lewat localStorage-nya sendiri.
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
    return false; // gagal cek -> anggap belum, lebih aman (fail-safe)
  }
}

const AppLogin = {
  setup() {
    const email = ref('');
    const password = ref('');
    const showPassword = ref(false);
    const ingatSaya = ref(false);
    const statusPilihan = ref('HADIR (CLOCK IN)');
    const memproses = ref(false);
    const isDesktop = ref(isDesktopBrowser());

    const izin = reactive({ tanggal: '', alasan: '', detail: '' });
    const opsiAlasanIzin = ref([]);

    // ---- OTP ----
    const otpVisible = ref(false);
    const otpNomorMasked = ref('****');
    const otpInput = ref('');
    const otpState = reactive({ kode: null, email: null, kadaluarsa: null });

    onMounted(() => {
      const savedEmail = localStorage.getItem('zevanic_email');
      if (savedEmail) {
        email.value = savedEmail;
        ingatSaya.value = true;
      }
      localStorage.removeItem('zevanic_pass'); // bersihkan sisa password lama (bug keamanan versi lampau)
    });

    async function bukaFormIzinDropdown() {
      if (statusPilihan.value === 'IZIN' && opsiAlasanIzin.value.length === 0 && window.ambilMasterList) {
        opsiAlasanIzin.value = await window.ambilMasterList('alasan_izin');
      }
    }

    function lupaPassword() {
      if (window.lupaPassword) window.lupaPassword();
    }

    function bukaFormRegistrasi() {
      if (window.bukaFormRegistrasi) window.bukaFormRegistrasi();
    }

    async function login() {
      const emailInput = email.value.trim().toLowerCase();
      const passInput = password.value;
      window.statusPilihanGlobal = isDesktop.value ? 'HADIR (CLOCK IN)' : statusPilihan.value;

      window.tanggalIzinGlobal = izin.tanggal;
      const keterangan = izin.detail.trim() ? `${izin.alasan} - ${izin.detail.trim()}` : izin.alasan;
      window.keteranganIzinGlobal = keterangan;

      if (!emailInput || !passInput) {
        alert("Masukkan email dan password terlebih dahulu!");
        return;
      }

      if (window.statusPilihanGlobal === "IZIN") {
        if (!window.tanggalIzinGlobal || !window.keteranganIzinGlobal) {
          alert("Harap isi Tanggal dan Keterangan untuk pengajuan Izin/Cuti!");
          return;
        }
      }

      memproses.value = true;
      try {
        await signInWithEmailAndPassword(auth, emailInput, passInput);
      } catch (e) {
        console.error("Gagal login:", e);
        alert((window.pesanErrorAuth && window.pesanErrorAuth(e.code)) || "Gagal login: " + e.message);
        memproses.value = false;
        return;
      }

      // Verifikasi OTP WhatsApp — hanya untuk login PERTAMA di perangkat ini.
      const otpDiperlukan = await apakahOtpDiperlukan(emailInput);
      if (otpDiperlukan) {
        const terkirim = await mulaiVerifikasiOtp(emailInput);
        if (!terkirim) await signOut(auth);
        memproses.value = false;
        return;
      }

      await lanjutkanSetelahLogin(emailInput);
      memproses.value = false;
    }

    async function apakahOtpDiperlukan(emailCek) {
      try {
        const configSnap = await getDoc(doc(db, "config", "whatsapp_gateway"));
        if (!configSnap.exists() || !configSnap.data().otp_aktif) return false;
      } catch (e) {
        console.error("Gagal cek konfigurasi OTP:", e);
        return false;
      }
      const sudahTerverifikasi = localStorage.getItem('zevanic_device_verified_' + emailCek) === 'true';
      return !sudahTerverifikasi;
    }

    async function mulaiVerifikasiOtp(emailOtp) {
      const kode = String(Math.floor(100000 + Math.random() * 900000));
      Object.assign(otpState, { kode, email: emailOtp, kadaluarsa: Date.now() + 5 * 60 * 1000 });

      let nomorHp = "";
      try {
        const userSnap = await getDoc(doc(db, "users", emailOtp));
        if (userSnap.exists()) nomorHp = userSnap.data().hp || "";
      } catch (e) { console.error(e); }

      if (!nomorHp) {
        alert("Nomor HP Anda belum terdaftar di sistem, tidak bisa mengirim OTP. Hubungi Owner/PIC.");
        return false;
      }

      const templateOtp = window.ambilTemplateWA ? await window.ambilTemplateWA('template_otp') : "Kode OTP Anda: *{kode}*";
      const terkirim = window.kirimPesanWhatsapp ? await window.kirimPesanWhatsapp(nomorHp, templateOtp.replace(/\{kode\}/g, kode), "OTP") : false;
      if (!terkirim) {
        alert("Gagal mengirim kode OTP lewat WhatsApp. Coba lagi atau hubungi Owner/PIC.");
        return false;
      }

      otpNomorMasked.value = nomorHp.replace(/(\d{4})\d+(\d{3})/, '$1****$2');
      otpInput.value = '';
      otpVisible.value = true;
      return true;
    }

    async function batalkanOtp() {
      otpVisible.value = false;
      await signOut(auth);
    }

    function kirimUlangOtp() {
      if (otpState.email) mulaiVerifikasiOtp(otpState.email);
    }

    async function verifikasiOtpDanLanjut() {
      if (!otpState.kode || Date.now() > otpState.kadaluarsa) {
        alert("Kode OTP sudah kadaluarsa. Silakan kirim ulang.");
        return;
      }
      if (otpInput.value.trim() !== otpState.kode) {
        alert("Kode OTP salah. Silakan coba lagi.");
        return;
      }
      localStorage.setItem('zevanic_device_verified_' + otpState.email, 'true');
      otpVisible.value = false;
      await lanjutkanSetelahLogin(otpState.email);
    }

    async function lanjutkanSetelahLogin(emailInput) {
      if (ingatSaya.value) {
        localStorage.setItem('zevanic_email', emailInput);
      } else {
        localStorage.removeItem('zevanic_email');
      }
      localStorage.removeItem('zevanic_pass');

      const userRef = doc(db, "users", emailInput);
      const userSnap = await getDoc(userRef);

      let isOwnerRole = false;

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
        isOwnerRole = (window.currentUser.role === 'owner' || window.currentUser.role === 'superuser');

        if (d.status_approval && d.status_approval !== "APPROVED") {
          alert(d.status_approval === "PENDING"
            ? "Akun Anda masih menunggu persetujuan Owner/PIC. Silakan hubungi mereka."
            : "Akun Anda tidak disetujui untuk mengakses sistem. Silakan hubungi Owner/PIC.");
          await signOut(auth);
          return;
        }

        // Owner/Superuser tidak wajib ditautkan ke gudang manapun — perannya
        // manajerial, bukan operasional lapangan.
        if (window.currentUser.gudang_penempatan.length === 0 && !isOwnerRole) {
          alert("Akun Anda belum ditautkan ke gudang manapun. Silakan hubungi Owner/PIC.");
          await signOut(auth);
          return;
        }
      } else {
        alert("Profil akun Anda tidak ditemukan. Silakan hubungi Owner/PIC.");
        await signOut(auth);
        return;
      }

      window.aturTampilanBerdasarkanRole();

      // Owner/Superuser: langsung ke Dashboard dari HP maupun komputer,
      // tanpa syarat Clock In sama sekali — perannya tidak melakukan presensi
      // lapangan seperti karyawan operasional.
      if (isOwnerRole) {
        window.pindahLayar('screen-dashboard');
        window.pindahTab('tab-home');
        return;
      }

      const hariIni = new Date().toLocaleDateString('id-ID');
      const statusLokal = localStorage.getItem('zevanic_absen_' + emailInput);
      const sudahClockInLokal = statusLokal === hariIni;

      if (isDesktop.value) {
        const sudahClockInServer = await sudahClockInHariIniServer(emailInput);
        if (sudahClockInServer) {
          window.pindahLayar('screen-dashboard');
          window.pindahTab('tab-home');
        } else {
          alert("Login lewat komputer cuma bisa dipakai kalau Anda sudah Clock In hari ini. Silakan Clock In dari HP terlebih dahulu, atau ajukan Izin/Cuti dari HP.");
          await signOut(auth);
        }
        return;
      }

      if (window.statusPilihanGlobal === "HADIR (CLOCK IN)" && sudahClockInLokal) {
        alert("Anda sudah Clock In hari ini. Mengalihkan langsung ke Dashboard...");
        window.pindahLayar('screen-dashboard');
        window.pindahTab('tab-home');
        return;
      }

      document.getElementById('label-status-kamera').innerText = "Mode: " + window.statusPilihanGlobal;
      window.pindahLayar('screen-camera');
    }

    return {
      email, password, showPassword, ingatSaya, statusPilihan, memproses, isDesktop,
      izin, opsiAlasanIzin, bukaFormIzinDropdown,
      otpVisible, otpNomorMasked, otpInput,
      lupaPassword, bukaFormRegistrasi, login,
      batalkanOtp, kirimUlangOtp, verifikasiOtpDanLanjut
    };
  },
  template: `
    <div class="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-gray-100 my-6">
      <div class="text-center mb-6">
        <h1 class="text-3xl font-black tracking-tight text-gray-900">ZEVANIC HOUSE</h1>
        <p class="text-xs tracking-widest text-gray-500 font-bold uppercase mt-1">ERP System & Mgmt</p>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Email / Akun Login</label>
          <div class="relative">
            <i class="far fa-envelope absolute left-4 top-3 text-gray-400"></i>
            <input v-model="email" id="input-email" type="email" placeholder="contoh@zevanic.com" class="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm">
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Password</label>
          <div class="relative flex items-center">
            <i class="fas fa-lock absolute left-4 text-gray-400"></i>
            <input v-model="password" id="input-pass" :type="showPassword ? 'text' : 'password'" placeholder="••••••••" class="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm">
            <button type="button" @click="showPassword = !showPassword" class="absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none">
              <i :class="showPassword ? 'fa-eye' : 'fa-eye-slash'" class="fas"></i>
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between text-xs">
          <label class="flex items-center space-x-2 cursor-pointer">
            <input v-model="ingatSaya" type="checkbox" class="rounded text-blue-600 focus:ring-blue-500 w-4 h-4">
            <span class="text-gray-600 font-medium">Ingatkan Saya</span>
          </label>
          <button type="button" @click="lupaPassword" class="text-blue-600 font-semibold hover:underline">Lupa Password?</button>
        </div>

        <div v-if="!isDesktop">
          <label class="block text-xs font-semibold text-gray-600 mb-1">Pilih Status Kehadiran / Pengajuan</label>
          <select v-model="statusPilihan" @change="bukaFormIzinDropdown" class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-medium text-gray-700">
            <option value="HADIR (CLOCK IN)">🟢 Hadir (Clock In Pertama)</option>
            <option value="IZIN">🟡 Pengajuan Izin (Hari H)</option>
          </select>
        </div>

        <p v-if="isDesktop" class="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5"><i class="fas fa-info-circle mr-1"></i> Login lewat komputer hanya untuk masuk Dashboard setelah Clock In dari HP. Untuk Clock In / Izin / Cuti, gunakan HP.</p>

        <div v-if="!isDesktop && statusPilihan === 'IZIN'" class="space-y-4 pt-2 border-t border-gray-100">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">Tanggal Pengajuan</label>
            <input v-model="izin.tanggal" type="date" class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">Alasan</label>
            <select v-model="izin.alasan" class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm">
              <option value="">-- Pilih --</option>
              <option v-for="a in opsiAlasanIzin" :key="a" :value="a">{{ a }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">Detail Tambahan (opsional)</label>
            <textarea v-model="izin.detail" rows="2" placeholder="Keterangan lebih lanjut jika perlu..." class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-sm resize-none"></textarea>
          </div>
        </div>

        <button @click="login" :disabled="memproses" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95 mt-2 flex items-center justify-center text-sm disabled:opacity-50">
          {{ memproses ? 'Memproses...' : 'Masuk / Lanjut' }} <i v-if="!memproses" class="fas fa-arrow-right ml-2"></i>
        </button>

        <div class="text-center pt-3 border-t border-gray-100">
          <p class="text-xs text-gray-500">Belum punya akun?</p>
          <button @click="bukaFormRegistrasi" class="mt-1.5 text-blue-600 font-bold text-xs hover:underline flex items-center justify-center w-full">
            <i class="fas fa-user-plus mr-1.5"></i> Daftar Akun Baru (Registrasi)
          </button>
        </div>
      </div>
    </div>

    <div v-if="otpVisible" class="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4 fade-in">
      <div class="bg-white w-full max-w-sm p-6 rounded-3xl shadow-2xl space-y-4 text-center">
        <i class="fab fa-whatsapp text-5xl text-green-500"></i>
        <div>
          <h3 class="font-bold text-gray-800 text-sm">Verifikasi Perangkat Baru</h3>
          <p class="text-[11px] text-gray-500 mt-1">Kode OTP telah dikirim lewat WhatsApp ke nomor <span class="font-bold text-gray-700">{{ otpNomorMasked }}</span></p>
        </div>
        <input v-model="otpInput" type="text" maxlength="6" inputmode="numeric" placeholder="6 digit kode" class="w-full text-center tracking-[0.5em] text-lg font-bold px-3 py-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-green-500">
        <button @click="verifikasiOtpDanLanjut" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-sm transition">Verifikasi</button>
        <div class="flex justify-between text-xs pt-1">
          <button @click="kirimUlangOtp" class="text-blue-600 font-semibold hover:underline">Kirim Ulang</button>
          <button @click="batalkanOtp" class="text-gray-400 font-semibold hover:underline">Batal</button>
        </div>
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-login');
if (mountPoint) {
  createApp(AppLogin).mount('#vue-login');
}
