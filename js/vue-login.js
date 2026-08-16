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
      window._manualLoginInProgress = true; // beri tahu listener sesi-otomatis di auth.js: mundur, biar alur manual ini yang urus
      try {
        await signInWithEmailAndPassword(auth, emailInput, passInput);
      } catch (e) {
        console.error("Gagal login:", e);
        alert((window.pesanErrorAuth && window.pesanErrorAuth(e.code)) || "Gagal login: " + e.message);
        memproses.value = false;
        window._manualLoginInProgress = false;
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
      if (window.refreshAccountProfileDisplay) window.refreshAccountProfileDisplay();

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
    <div class="login-wrap">
      <div class="login-brand" style="background:var(--pink); position:relative; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between; padding:48px; border-right:1px solid var(--pink-deep);">
        <div style="position:absolute; right:-60px; top:-60px; width:260px; height:260px; border-radius:50%; background:var(--blue); opacity:.25;"></div>
        <div style="position:absolute; left:-40px; bottom:-40px; width:180px; height:180px; border-radius:50%; background:#fff; opacity:.4;"></div>
        <div style="position:relative; z-index:1;">
          <div class="gc-heading" style="font-size:22px; font-weight:700; color:var(--burgundy); margin-bottom:18px;">Gechoo &hearts;</div>
          <div class="gc-heading" style="font-size:30px; font-weight:700; color:var(--mahogany); line-height:1.25;">Sistem operasional<br>gudang &amp; presensi</div>
          <p style="font-size:13.5px; color:var(--mahogany-soft); margin-top:12px; max-width:300px; line-height:1.65; opacity:.85;">Kelola kehadiran, penjadwalan, dan proses kerja karyawan dari satu tempat.</p>
        </div>
      </div>

      <div style="display:flex; align-items:center; justify-content:center; padding:32px; background:var(--ivory);">
        <div style="width:100%; max-width:380px;">
          <h1 class="gc-heading" style="font-size:22px; font-weight:700; margin-bottom:5px;">Masuk ke akun Anda</h1>
          <p style="color:var(--text-muted); font-size:13.5px; margin-bottom:30px;">Isi email dan kata sandi untuk melanjutkan.</p>

          <div class="gc-field">
            <label>Email / akun login</label>
            <div style="position:relative;">
              <i class="far fa-envelope" style="position:absolute; left:14px; top:14px; color:var(--text-faint); font-size:13px;"></i>
              <input v-model="email" id="input-email" type="email" placeholder="nama@gechoo.co" style="padding-left:40px;">
            </div>
          </div>

          <div class="gc-field">
            <label>Password</label>
            <div style="position:relative;">
              <i class="fas fa-lock" style="position:absolute; left:14px; top:14px; color:var(--text-faint); font-size:13px;"></i>
              <input v-model="password" id="input-pass" :type="showPassword ? 'text' : 'password'" placeholder="••••••••" style="padding-left:40px; padding-right:40px;">
              <button type="button" @click="showPassword = !showPassword" style="position:absolute; right:12px; top:12px; background:none; border:none; color:var(--text-faint); cursor:pointer;">
                <i :class="showPassword ? 'fa-eye' : 'fa-eye-slash'" class="fas"></i>
              </button>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:22px; font-size:12.5px;">
            <label style="display:flex; align-items:center; gap:7px; color:var(--text-muted); font-weight:600; cursor:pointer;">
              <input v-model="ingatSaya" type="checkbox" style="width:14px; height:14px; accent-color:var(--burgundy);">Ingat saya
            </label>
            <button type="button" @click="lupaPassword" style="background:none; border:none; color:var(--burgundy); font-weight:700; cursor:pointer;">Lupa sandi?</button>
          </div>

          <div v-if="!isDesktop" class="gc-field">
            <label>Pilih status kehadiran / pengajuan</label>
            <select v-model="statusPilihan" @change="bukaFormIzinDropdown">
              <option value="HADIR (CLOCK IN)">Hadir (Clock In pertama)</option>
              <option value="IZIN">Pengajuan izin (hari H)</option>
            </select>
          </div>

          <p v-if="isDesktop" class="tag warn" style="display:block; margin-bottom:16px; padding:10px 14px; border-radius:12px;"><i class="fas fa-info-circle" style="margin-right:6px;"></i>Login lewat komputer hanya untuk masuk Dashboard setelah Clock In dari HP.</p>

          <div v-if="!isDesktop && statusPilihan === 'IZIN'" style="padding-top:8px; border-top:1px solid var(--line); margin-bottom:6px;">
            <div class="gc-field"><label>Tanggal pengajuan</label><input v-model="izin.tanggal" type="date"></div>
            <div class="gc-field">
              <label>Alasan</label>
              <select v-model="izin.alasan">
                <option value="">-- Pilih --</option>
                <option v-for="a in opsiAlasanIzin" :key="a" :value="a">{{ a }}</option>
              </select>
            </div>
            <div class="gc-field"><label>Detail tambahan (opsional)</label><textarea v-model="izin.detail" rows="2" placeholder="Keterangan lebih lanjut jika perlu..."></textarea></div>
          </div>

          <button @click="login" :disabled="memproses" class="btn-primary block" style="margin-top:8px;">
            {{ memproses ? 'Memproses...' : 'Masuk' }} <i v-if="!memproses" class="fas fa-arrow-right" style="margin-left:8px;"></i>
          </button>

          <div style="text-align:center; margin-top:24px; font-size:13px; color:var(--text-muted);">
            <p>Belum punya akun?</p>
            <button @click="bukaFormRegistrasi" style="background:none; border:none; margin-top:6px; color:var(--burgundy); font-weight:700; cursor:pointer; font-size:13px;">
              <i class="fas fa-user-plus" style="margin-right:6px;"></i>Daftar akun baru
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="otpVisible" style="position:fixed; inset:0; z-index:120; background:rgba(59,42,31,.6); display:flex; align-items:center; justify-content:center; padding:16px;" class="fade-in">
      <div style="background:var(--surface); width:100%; max-width:380px; padding:26px; border-radius:22px; text-align:center;">
        <i class="fab fa-whatsapp" style="font-size:44px; color:var(--ok);"></i>
        <h3 class="gc-heading" style="font-weight:700; font-size:15px; margin-top:10px;">Verifikasi perangkat baru</h3>
        <p style="font-size:12px; color:var(--text-muted); margin-top:6px;">Kode OTP telah dikirim lewat WhatsApp ke nomor <b style="color:var(--text);">{{ otpNomorMasked }}</b></p>
        <input v-model="otpInput" type="text" maxlength="6" inputmode="numeric" placeholder="6 digit kode" style="width:100%; text-align:center; letter-spacing:.5em; font-size:18px; font-weight:700; padding:12px; margin-top:16px; border:1.5px solid var(--line); border-radius:12px; outline:none; font-family:'Poppins',sans-serif;">
        <button @click="verifikasiOtpDanLanjut" class="btn-primary block" style="margin-top:14px; background:var(--ok);">Verifikasi</button>
        <div style="display:flex; justify-content:space-between; margin-top:12px; font-size:12.5px;">
          <button @click="kirimUlangOtp" style="background:none; border:none; color:var(--burgundy); font-weight:700; cursor:pointer;">Kirim ulang</button>
          <button @click="batalkanOtp" style="background:none; border:none; color:var(--text-faint); font-weight:700; cursor:pointer;">Batal</button>
        </div>
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-login');
if (mountPoint) {
  createApp(AppLogin).mount('#vue-login');
}
