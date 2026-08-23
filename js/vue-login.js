// js/vue-login.js
// ============================================================================
// DIROMBAK LAGI (18 Agt 2026, revisi ke-2 alur registrasi) — modal WAJIB
// GANTI PASSWORD sudah DIHAPUS dari file ini. Sudah tidak relevan lagi:
// password sekarang dipilih SENDIRI oleh karyawan sejak awal (lewat layar
// baru js/vue-buat-password.js, dibuka dari link email Antrean Dakar),
// bukan lagi dipaksa pakai NIK sebagai password sementara lalu wajib
// ganti di login pertama. BELUM PERNAH DITES sama sekali, WAJIB dites
// end-to-end sebelum dipakai karyawan sungguhan.
//
// URUTAN SETELAH EMAIL+PASSWORD BENAR:
//   1. Device belum pernah diverifikasi (localStorage) DAN toggle OTP aktif
//      -> modal OTP EMAIL dulu (window.kirimOtpEmail/verifikasiOtpEmail,
//      konteks 'perangkat_baru').
//   2. Lanjut langsung ke alur normal (cek status_approval/gudang/jam
//      kerja, dst — TIDAK diubah dari sebelumnya).
//
// TIDAK disentuh / tetap murni vanilla di auth.js:
// - onAuthStateChanged (sesi otomatis)
// - window.lupaPassword — TETAP membaca document.getElementById('input-email')
//   secara langsung; makanya input email di Vue ini WAJIB tetap pakai
//   id="input-email".
// - window.bukaFormRegistrasi, window.aturTampilanBerdasarkanRole,
//   window.pindahLayar, window.pindahTab, window.ambilMasterList,
//   window.pesanErrorAuth — semua dipanggil apa adanya dari sini.
// - window.kirimOtpEmail / window.verifikasiOtpEmail (vue-otp.js) — fondasi
//   OTP bersama, SAMA yang dipakai Registrasi.
// ============================================================================
import { createApp, ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

function isDesktopBrowser() {
  return !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Poin 4: cek ke server (bukan localStorage) apakah user ini sudah Clock In
// hari ini — Clock In terjadi di HP, desktop tidak akan pernah tahu soal itu
// lewat localStorage-nya sendiri.
// DIROMBAK TOTAL (19 Agt 2026) — versi LAMA cuma cek d.status ===
// "HADIR (CLOCK IN)" + d.waktu, yang itu FORMAT LAMA doang. Sejak Clock
// In/Out digabung jadi 1 dokumen (js/vue-camera.js, 18 Agt 2026),
// dokumen BARU pakai status:"HADIR" + waktu_masuk (BUKAN "HADIR (CLOCK
// IN)" / waktu lagi) — akibatnya SIAPAPUN yang Clock In pakai sistem
// baru TIDAK PERNAH terdeteksi di sini, walau beneran sudah Clock In di
// HP, login desktop tetap ditolak. Sekaligus dulu fetch SELURUH koleksi
// absensi tiap kali dicek — boros parah, sekarang query LANGSUNG scoped
// ke email+tanggal, dan cek KEDUA format (baru & lama) sekaligus.
// DIROMBAK LAGI (19 Agt 2026) — versi sebelumnya cek "Clock In HARI INI"
// pakai rentang tanggal kalender (00:00-23:59), yang PERSIS kena bug
// shift-malam yang sama seperti tombol Home dulu: kalau Clock In malam
// kemarin dan sekarang sudah lewat tengah malam, "hari ini" versi
// kalender jadi beda tanggal — walau orangnya masih aktif di shift yang
// SAMA belum Clock Out. Sekarang PAKAI ULANG window.cekStatusClockInSaya
// (auth.js) — satu sumber kebenaran yang SAMA dipakai tombol Home &
// Clock Out, sudah teruji tahan shift-malam & lintas-device. Juga lebih
// masuk akal secara bisnis: aturan "wajib Clock In dulu" itu maksudnya
// "sedang aktif di shift sekarang", bukan "pernah Clock In kapan saja
// hari ini" (kalau sudah Clock Out & pulang, mestinya memang tidak boleh
// remote-login ke sistem kantor lagi).
async function sudahClockInHariIniServer(email) {
  try {
    const status = await window.cekStatusClockInSaya(email);
    return status.aktif;
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
    // DIROMBAK (22 Agt 2026, revisi ke-2 dari Hilman) — "Absensi Melalui
    // QR" TERNYATA bukan layar terpisah dari Login, cuma MODE TAMPILAN
    // di form Login yang SAMA (email+password yang sama, proses login()
    // yang sama juga) — yang login di sini akun HP KIOSK (email/password
    // asli-nya, BUKAN PIN karyawan — PIN itu punya konsep beda, dipakai
    // nanti pas scan barcode di dalam screen-absensi-qr). Begitu akun
    // KIOSK berhasil login, auth.js YANG deteksi (jenis_akun==='kiosk')
    // dan otomatis lempar ke screen-absensi-qr — termasuk pas refresh,
    // karena Firebase Auth inget sesi login, bukan logic tambahan di sini.
    const modeKioskLogin = ref(false);
    function bukaAbsensiQr() { modeKioskLogin.value = true; }
    function kembaliKeLoginBiasa() { modeKioskLogin.value = false; }

    const izin = reactive({ tanggal: '', alasan: '', detail: '' });
    const opsiAlasanIzin = ref([]);

    // ---- OTP perangkat baru (EMAIL, lewat vue-otp.js — bukan WA lagi) ----
    const otpVisible = ref(false);
    const otpEmailAktif = ref(''); // email yang sedang diverifikasi
    const otpInput = ref('');
    const otpSudahDikirim = ref(false); // sebelum ini true, tombol "Kirim Kode OTP" yang tampil, bukan input kode
    const otpMengirim = ref(false);
    const otpMemverifikasi = ref(false);
    const otpCountdown = ref(0); // detik tersisa sebelum boleh kirim ulang
    let otpCountdownTimer = null;

    function formatCountdownOtp(detik) {
      const m = Math.floor(detik / 60);
      const s = detik % 60;
      return m + ':' + String(s).padStart(2, '0');
    }
    function mulaiCountdownOtp() {
      otpCountdown.value = 120; // 2 menit — cegah spam kirim ulang
      if (otpCountdownTimer) clearInterval(otpCountdownTimer);
      otpCountdownTimer = setInterval(() => {
        otpCountdown.value--;
        if (otpCountdown.value <= 0) {
          clearInterval(otpCountdownTimer);
          otpCountdownTimer = null;
          otpCountdown.value = 0;
        }
      }, 1000);
    }
    function hentikanCountdownOtp() {
      if (otpCountdownTimer) { clearInterval(otpCountdownTimer); otpCountdownTimer = null; }
      otpCountdown.value = 0;
    }

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
      // Dibaca auth.js setelah login sukses — validasi silang: kalau
      // orang coba login mode Kiosk pakai akun BUKAN Kiosk (atau
      // sebaliknya), auth.js yang tolak & logout paksa (lihat catatan
      // di auth.js kenapa validasi ini WAJIB di sana, bukan di sini).
      window._modeLoginKioskDicoba = modeKioskLogin.value;

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

      // Tahap 1: verifikasi perangkat baru (kalau perlu) — kode TIDAK
      // dikirim otomatis di sini, modal tampil dulu, user klik "Kirim
      // Kode OTP" secara manual (cegah pengiriman email berulang tanpa
      // sadar/disengaja).
      const perluOtp = await apakahOtpDiperlukan(emailInput);
      if (perluOtp) {
        otpEmailAktif.value = emailInput;
        otpInput.value = '';
        otpSudahDikirim.value = false;
        hentikanCountdownOtp();
        otpVisible.value = true;
        memproses.value = false;
        return; // nunggu interaksi modal OTP — dilanjut dari verifikasiOtpPerangkat()
      }

      await lanjutkanSetelahOtp(emailInput);
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

    // Dipanggil dari tombol "Kirim Kode OTP" (pertama kali) MAUPUN "Kirim
    // Ulang" (setelah countdown 2 menit habis) — logic-nya sama persis.
    async function kirimKodeOtpPerangkat() {
      if (otpMengirim.value || otpCountdown.value > 0) return; // jaga-jaga dobel klik
      otpMengirim.value = true;
      const hasil = await window.kirimOtpEmail(otpEmailAktif.value, 'perangkat_baru');
      otpMengirim.value = false;
      if (!hasil.sukses) {
        alert(hasil.pesan || "Gagal mengirim kode verifikasi.");
        return;
      }
      otpInput.value = '';
      otpSudahDikirim.value = true;
      mulaiCountdownOtp();
    }

    async function verifikasiOtpPerangkat() {
      if (!/^\d{6}$/.test(otpInput.value.trim())) {
        alert("Kode harus 6 angka.");
        return;
      }
      otpMemverifikasi.value = true;
      const hasil = await window.verifikasiOtpEmail(otpEmailAktif.value, otpInput.value.trim());
      otpMemverifikasi.value = false;
      if (!hasil.sukses) {
        alert(hasil.pesan);
        return;
      }
      localStorage.setItem('zevanic_device_verified_' + otpEmailAktif.value, 'true');
      otpVisible.value = false;
      hentikanCountdownOtp();
      memproses.value = true;
      await lanjutkanSetelahOtp(otpEmailAktif.value);
      memproses.value = false;
    }

    async function batalkanOtp() {
      otpVisible.value = false;
      hentikanCountdownOtp();
      await signOut(auth);
      window._manualLoginInProgress = false;
    }

    // Tahap 2: alur normal — SAMA PERSIS seperti versi sebelum perombakan
    // ini (status_approval, gudang, Clock In desktop/mobile, dst, TIDAK
    // diubah perilakunya). Nama fungsi dipertahankan "lanjutkanSetelahOtp"
    // (bukan sekadar alias) supaya titik panggilnya dari verifikasiOtpPerangkat()
    // tidak perlu ikut berubah.
    async function lanjutkanSetelahOtp(emailInput) {
      let dataUser = null;
      try {
        const userSnap = await getDoc(doc(db, "users", emailInput));
        if (!userSnap.exists()) {
          alert("Profil akun Anda tidak ditemukan. Silakan hubungi Owner/PIC.");
          await signOut(auth);
          window._manualLoginInProgress = false;
          return;
        }
        dataUser = userSnap.data();
      } catch (e) {
        console.error("Gagal ambil profil akun:", e);
        alert("Gagal memuat profil akun Anda. Coba login lagi.");
        await signOut(auth);
        window._manualLoginInProgress = false;
        return;
      }

      await lanjutkanSetelahLogin(emailInput, dataUser);
    }

    // Tahap 3: alur normal — SAMA PERSIS seperti versi sebelum perombakan
    // ini (status_approval, gudang, Clock In desktop/mobile, dst, TIDAK
    // diubah perilakunya). Terima dataUserSudahAda opsional supaya tidak
    // baca ulang Firestore kalau sudah sempat diambil di lanjutkanSetelahOtp().
    async function lanjutkanSetelahLogin(emailInput, dataUserSudahAda) {
      if (ingatSaya.value) {
        localStorage.setItem('zevanic_email', emailInput);
      } else {
        localStorage.removeItem('zevanic_email');
      }
      localStorage.removeItem('zevanic_pass');

      let d = dataUserSudahAda;
      if (!d) {
        const userSnap = await getDoc(doc(db, "users", emailInput));
        if (!userSnap.exists()) {
          alert("Profil akun Anda tidak ditemukan. Silakan hubungi Owner/PIC.");
          await signOut(auth);
          window._manualLoginInProgress = false;
          return;
        }
        d = userSnap.data();
      }

      let isOwnerRole = false;
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

      // BARU (22 Agt 2026) — validasi silang mode "Absensi Melalui QR":
      // 1) Coba mode Kiosk pakai akun BUKAN Kiosk terdaftar -> TOLAK.
      //    ("hanya device yang terdaftar yang bisa login disini")
      // 2) Akun Kiosk asli -> SELALU ke screen-absensi-qr, TIDAK PERNAH
      //    kena gerbang Clock In (kiosk bukan orang, tidak clock in).
      const iniAkunKiosk = d.jenis_akun === 'kiosk';
      if (window._modeLoginKioskDicoba && !iniAkunKiosk) {
        alert("Akun ini bukan Device Kiosk terdaftar. Gunakan menu Login biasa, atau hubungi Owner kalau device ini seharusnya terdaftar.");
        await signOut(auth);
        window._manualLoginInProgress = false;
        return;
      }

      if (d.status_approval && d.status_approval !== "APPROVED") {
        alert(d.status_approval === "PENDING"
          ? "Akun Anda masih menunggu persetujuan Owner/PIC. Silakan hubungi mereka."
          : "Akun Anda tidak disetujui untuk mengakses sistem. Silakan hubungi Owner/PIC.");
        await signOut(auth);
        window._manualLoginInProgress = false;
        return;
      }

      // BARU (19 Agt 2026, permintaan Hilman) — karyawan yang sudah
      // resign/nonaktif (status_kerja BUKAN "Aktif") TIDAK BOLEH login
      // lagi, walau akun & password-nya masih ada di Firebase Auth.
      // Owner/Superuser SENGAJA dikecualikan — supaya tidak ada resiko
      // kunci-mati total dari sistem sendiri kalau field ini kebetulan
      // salah/kosong di akun Owner sendiri (tidak ada orang lain yang
      // bisa perbaiki Firestore-nya kalau itu terjadi).
      if (!isOwnerRole && window.currentUser.status_kerja !== "Aktif") {
        alert("Akun ini berstatus \"" + window.currentUser.status_kerja + "\" (bukan Aktif) dan tidak bisa dipakai login. Kalau ini keliru, hubungi Admin/Owner.");
        await signOut(auth);
        window._manualLoginInProgress = false;
        return;
      }

      // DIUBAH (19 Agt 2026, permintaan Hilman) — SEBELUMNYA Owner/
      // Superuser dikecualikan dari syarat gudang ("perannya manajerial").
      // Sekarang WAJIB juga, tidak ada pengecualian — konsisten dengan
      // syarat Clock In yang juga sekarang berlaku ke Owner (lihat di
      // bawah). PENTING: kalau akun Owner belum ada gudang_penempatan
      // terisi, Owner akan TERKUNCI dari sistemnya sendiri sampai field
      // ini diisi — WAJIB dicek dulu sebelum file ini dipakai produksi.
      if (window.currentUser.gudang_penempatan.length === 0) {
        alert("Akun Anda belum ditautkan ke gudang manapun. Silakan hubungi Owner/PIC.");
        await signOut(auth);
        window._manualLoginInProgress = false;
        return;
      }

      await window.muatAksesConfigSaya(window.currentUser.role, window.currentUser.profil_akses);
      window.simpanKonteksSesi(); // biar reload berikutnya (F5, tab baru) tidak baca ulang users/akses_config

      // Akun Kiosk BERHENTI DI SINI — tidak pernah ke Dashboard/kamera
      // biasa, tidak kena gerbang Clock In apapun (desktop maupun
      // mobile), karena kiosk bukan orang yang absen buat dirinya
      // sendiri. "Terkunci" di screen-absensi-qr tercapai otomatis di
      // SETIAP reload juga — lihat blok serupa di onAuthStateChanged
      // utama (bawah file ini) buat kasus refresh/auto-reload.
      if (iniAkunKiosk) {
        window._manualLoginInProgress = false;
        window.pindahLayar('screen-absensi-qr');
        return;
      }

      window.aturTampilanBerdasarkanRole();
      if (window.refreshAccountProfileDisplay) window.refreshAccountProfileDisplay();
      if (window.refreshHome) window.refreshHome();
      if (window.refreshHeaderMobile) window.refreshHeaderMobile();

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
        window._manualLoginInProgress = false;
        return;
      }

      if (window.statusPilihanGlobal === "HADIR (CLOCK IN)" && sudahClockInLokal) {
        alert("Anda sudah Clock In hari ini. Mengalihkan langsung ke Dashboard...");
        window.pindahLayar('screen-dashboard');
        window.pindahTab('tab-home');
        window._manualLoginInProgress = false;
        return;
      }

      window._manualLoginInProgress = false;
      window.pindahLayar('screen-camera');
    }

    return {
      email, password, showPassword, ingatSaya, statusPilihan, memproses, isDesktop, bukaAbsensiQr, modeKioskLogin, kembaliKeLoginBiasa,
      izin, opsiAlasanIzin, bukaFormIzinDropdown,
      otpVisible, otpEmailAktif, otpInput, otpSudahDikirim, otpMengirim, otpMemverifikasi, otpCountdown, formatCountdownOtp,
      lupaPassword, bukaFormRegistrasi, login,
      batalkanOtp, kirimKodeOtpPerangkat, verifikasiOtpPerangkat
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

          <div v-if="!isDesktop && !modeKioskLogin" class="gc-field">
            <label>Pilih status kehadiran / pengajuan</label>
            <select v-model="statusPilihan" @change="bukaFormIzinDropdown">
              <option value="HADIR (CLOCK IN)">Hadir (Clock In pertama)</option>
              <option value="IZIN">Pengajuan izin (hari H)</option>
            </select>
          </div>

          <p v-if="modeKioskLogin" class="tag ok" style="display:block; margin-bottom:16px; padding:10px 14px; border-radius:12px;"><i class="fas fa-tablet-screen-button" style="margin-right:6px;"></i>Login akun HP Kiosk — isi email &amp; password Kiosk (bukan akun pribadi).</p>

          <p v-if="isDesktop" class="tag warn" style="display:block; margin-bottom:16px; padding:10px 14px; border-radius:12px;"><i class="fas fa-info-circle" style="margin-right:6px;"></i>Login lewat komputer hanya untuk masuk Dashboard setelah Clock In dari HP.</p>

          <div v-if="!isDesktop && !modeKioskLogin && statusPilihan === 'IZIN'" style="padding-top:8px; border-top:1px solid var(--line); margin-bottom:6px;">
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
            {{ memproses ? 'Memproses...' : (modeKioskLogin ? 'Login HP Kiosk' : 'Masuk') }} <i v-if="!memproses" class="fas fa-arrow-right" style="margin-left:8px;"></i>
          </button>

          <div v-if="!isDesktop" style="text-align:center; margin-top:16px;">
            <button v-if="!modeKioskLogin" @click="bukaAbsensiQr" style="background:none; border:none; color:var(--burgundy); font-weight:700; font-size:12.5px; cursor:pointer;">
              <i class="fas fa-qrcode" style="margin-right:6px;"></i>Absensi Melalui QR
            </button>
            <button v-else @click="kembaliKeLoginBiasa" style="background:none; border:none; color:var(--text-muted); font-weight:700; font-size:12.5px; cursor:pointer;">
              <i class="fas fa-arrow-left" style="margin-right:6px;"></i>Kembali ke Login biasa
            </button>
          </div>

          <div style="text-align:center; margin-top:24px; font-size:13px; color:var(--text-muted);">
            <p>Belum punya akun?</p>
            <button @click="bukaFormRegistrasi" style="background:none; border:none; margin-top:6px; color:var(--burgundy); font-weight:700; cursor:pointer; font-size:13px;">
              <i class="fas fa-user-plus" style="margin-right:6px;"></i>Daftar akun baru
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal OTP perangkat baru — EMAIL, bukan WhatsApp lagi -->
    <div v-if="otpVisible" style="position:fixed; inset:0; z-index:120; background:rgba(59,42,31,.6); display:flex; align-items:center; justify-content:center; padding:16px;" class="fade-in">
      <div style="background:var(--surface); width:100%; max-width:380px; padding:26px; border-radius:22px; text-align:center;">
        <i class="far fa-envelope" style="font-size:44px; color:var(--burgundy);"></i>
        <h3 class="gc-heading" style="font-weight:700; font-size:15px; margin-top:10px;">Verifikasi perangkat baru</h3>

        <template v-if="!otpSudahDikirim">
          <p style="font-size:12px; color:var(--text-muted); margin-top:6px;">Perangkat ini belum pernah diverifikasi. Klik tombol di bawah untuk kirim kode OTP ke EMAIL terdaftar Anda.</p>
          <button @click="kirimKodeOtpPerangkat" :disabled="otpMengirim" class="btn-primary block" style="margin-top:16px;">
            {{ otpMengirim ? 'Mengirim...' : 'Kirim Kode OTP' }}
          </button>
          <button @click="batalkanOtp" style="background:none; border:none; color:var(--text-faint); font-weight:700; cursor:pointer; margin-top:12px; font-size:12.5px;">Batal</button>
        </template>

        <template v-else>
          <p style="font-size:12px; color:var(--text-muted); margin-top:6px;">Kode OTP telah dikirim lewat email ke <b style="color:var(--text);">{{ otpEmailAktif }}</b></p>
          <input v-model="otpInput" type="text" maxlength="6" inputmode="numeric" placeholder="6 digit kode" style="width:100%; text-align:center; letter-spacing:.5em; font-size:18px; font-weight:700; padding:12px; margin-top:16px; border:1.5px solid var(--line); border-radius:12px; outline:none; font-family:'Poppins',sans-serif;">
          <button @click="verifikasiOtpPerangkat" :disabled="otpMemverifikasi" class="btn-primary block" style="margin-top:14px;">{{ otpMemverifikasi ? 'Memverifikasi...' : 'Verifikasi' }}</button>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; font-size:12.5px;">
            <button v-if="otpCountdown > 0" disabled style="background:none; border:none; color:var(--text-faint); font-weight:700; cursor:not-allowed;">Kirim ulang ({{ formatCountdownOtp(otpCountdown) }})</button>
            <button v-else @click="kirimKodeOtpPerangkat" :disabled="otpMengirim" style="background:none; border:none; color:var(--burgundy); font-weight:700; cursor:pointer;">{{ otpMengirim ? 'Mengirim...' : 'Kirim ulang' }}</button>
            <button @click="batalkanOtp" style="background:none; border:none; color:var(--text-faint); font-weight:700; cursor:pointer;">Batal</button>
          </div>
        </template>
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-login');
if (mountPoint) {
  createApp(AppLogin).mount('#vue-login');
}
