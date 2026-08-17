// js/vue-registrasi.js
// ============================================================================
// DIBANGUN ULANG (18 Agt 2026, sesi lanjutan) — versi SEBELUMNYA (1 langkah,
// pakai password, langsung bikin akun Auth) TERNYATA TIDAK PERNAH BERHASIL
// ter-push ke GitHub malam itu (lihat STATUS-PROYEK.md §3.5.5). File ini
// dibangun ulang dari SPESIFIKASI di STATUS-PROYEK.md §3.5.1 — BELUM PERNAH
// DITES sama sekali, WAJIB dites end-to-end sebelum dipakai karyawan
// sungguhan (lihat checklist testing).
//
// ALUR BARU, 3 tahap — TANPA PASSWORD SAMA SEKALI:
//   1. Email -> kirim kode OTP (window.kirimOtpEmail, lihat vue-otp.js)
//   2. Masukkan kode OTP -> verifikasi (window.verifikasiOtpEmail)
//   3. BARU form data lengkap muncul (NIK, KTP, alamat, dst) -> submit
//      simpan ke koleksi "pendaftaran_pending", BUKAN "users" — dan BELUM
//      ADA akun Firebase Auth sama sekali di titik ini. Akun Auth baru
//      dibuat NANTI oleh Admin di Antrean Dakar (vue-antrean-dakar.js)
//      SETELAH data ini diperiksa & disetujui.
//
// KENAPA INI MENGHILANGKAN BUG "EMAIL NYANGKUT" LAMA TOTAL: dulu (versi
// sebelumnya) akun Auth dibuat DULU baru simpan profil — kalau simpan
// profil gagal, akun Auth bisa "nyangkut" (ada login tapi tanpa profil).
// Sekarang TIDAK ADA createUserWithEmailAndPassword di file ini sama
// sekali — kegagalan simpan pendaftaran cuma berarti dokumen
// "pendaftaran_pending" gagal tersimpan, TIDAK ADA akun Auth yang perlu
// di-rollback. Kelas bug ini otomatis tidak mungkin terjadi lagi di alur
// ini.
//
// PENTING — titik sambung ke bagian yang masih vanilla:
// - window.pindahLayar (app.js) untuk pindah layar login <-> register
// - window.previewKTP / window.ktpBase64Global (camera.js) untuk kompresi
//   foto KTP — TIDAK diduplikasi di sini, dipanggil apa adanya
// - window.ambilMasterList, window.ambilKecamatanUntukKabupaten (dashboard.js)
// - window.bukaPreviewFoto (dashboard.js) untuk klik-perbesar foto KTP
// - window.kirimOtpEmail / window.verifikasiOtpEmail (vue-otp.js) — fondasi
//   OTP bersama, JUGA dipakai verifikasi perangkat baru saat Login
//
// Jembatan ke vanilla: window.resetFormRegistrasi() dipanggil dari
// auth.js (window.bukaFormRegistrasi, dipicu tombol "Daftar Akun Baru" di
// layar Login) supaya ID Karyawan/ID APP + tahap form di-reset ulang di
// dalam state Vue setiap kali form registrasi dibuka.
// ============================================================================
import { createApp, ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

function idAcak(prefix) {
  return prefix + "-" + Math.floor(1000 + Math.random() * 9000);
}

const AppRegistrasi = {
  setup() {
    const tahap = ref('email'); // 'email' | 'otp' | 'form'

    // ---- Tahap 1: Email ----
    const emailInput = ref('');
    const mengirimOtp = ref(false);

    // ---- Tahap 2: OTP ----
    const kodeOtp = ref('');
    const memverifikasiOtp = ref(false);
    const otpCountdown = ref(0);
    let otpCountdownTimer = null;

    function formatCountdownOtp(detik) {
      const m = Math.floor(detik / 60);
      const s = detik % 60;
      return m + ':' + String(s).padStart(2, '0');
    }
    function mulaiCountdownOtp() {
      otpCountdown.value = 120; // 2 menit, cegah spam kirim ulang
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

    async function kirimOtp() {
      const emailBersih = emailInput.value.trim().toLowerCase();
      if (!emailBersih || !emailBersih.includes('@')) {
        alert("Masukkan email yang valid terlebih dahulu!");
        return;
      }
      mengirimOtp.value = true;
      const hasil = await window.kirimOtpEmail(emailBersih, 'registrasi');
      mengirimOtp.value = false;
      if (!hasil.sukses) {
        alert(hasil.pesan || "Gagal mengirim kode verifikasi. Coba lagi.");
        return;
      }
      emailInput.value = emailBersih;
      kodeOtp.value = '';
      tahap.value = 'otp';
      mulaiCountdownOtp();
    }

    async function kirimUlangOtp() {
      if (mengirimOtp.value || otpCountdown.value > 0) return;
      mengirimOtp.value = true;
      const hasil = await window.kirimOtpEmail(emailInput.value, 'registrasi');
      mengirimOtp.value = false;
      if (!hasil.sukses) {
        alert(hasil.pesan || "Gagal mengirim ulang kode.");
        return;
      }
      kodeOtp.value = '';
      mulaiCountdownOtp();
      alert("Kode baru sudah dikirim ke " + emailInput.value);
    }

    async function verifikasiOtp() {
      if (!/^\d{6}$/.test(kodeOtp.value.trim())) {
        alert("Kode harus 6 angka.");
        return;
      }
      memverifikasiOtp.value = true;
      const hasil = await window.verifikasiOtpEmail(emailInput.value, kodeOtp.value.trim());
      memverifikasiOtp.value = false;
      if (!hasil.sukses) {
        alert(hasil.pesan);
        return;
      }
      hentikanCountdownOtp();
      generateId();
      tahap.value = 'form';
      if (daftarKabupaten.value.length === 0) await muatKabupaten();
    }

    function gantiEmail() {
      hentikanCountdownOtp();
      tahap.value = 'email';
      kodeOtp.value = '';
    }

    // ---- Tahap 3: Form data lengkap (TANPA password) ----
    const idKaryawan = ref('');
    const idApp = ref('');
    const ktpPreview = ref('');
    const menyimpan = ref(false);

    const daftarKabupaten = ref([]);
    const daftarKecTinggal = ref([]);
    const daftarKecKtp = ref([]);
    const samaAlamat = ref(false);

    const form = reactive({
      nik: '', nama: '', hp: '',
      gender: 'Pria', tempatLahir: '', tgl: '',
      tinggalKab: '', tinggalKec: '', tinggalDetail: '',
      ktpKab: '', ktpKec: '', ktpDetail: '',
      nikah: 'Lajang', tanggungan: '',
      pendidikan: 'SMA/SMK', sekolah: '', jurusan: '',
      bank: 'BCA', norek: '', namarek: '',
      daruratNama: '', daruratHp: '', daruratHub: ''
    });

    function generateId() {
      idKaryawan.value = idAcak('ZVN');
      idApp.value = idAcak('ZMS');
    }

    async function muatKabupaten() {
      daftarKabupaten.value = window.ambilMasterList ? await window.ambilMasterList('kabupaten') : [];
      if (daftarKabupaten.value.length > 0) {
        form.tinggalKab = daftarKabupaten.value[0];
        form.ktpKab = daftarKabupaten.value[0];
        await muatKecTinggal();
        await muatKecKtp();
      }
    }
    async function muatKecTinggal() {
      daftarKecTinggal.value = window.ambilKecamatanUntukKabupaten ? await window.ambilKecamatanUntukKabupaten(form.tinggalKab) : [];
      form.tinggalKec = daftarKecTinggal.value[0] || '';
    }
    async function muatKecKtp() {
      daftarKecKtp.value = window.ambilKecamatanUntukKabupaten ? await window.ambilKecamatanUntukKabupaten(form.ktpKab) : [];
      form.ktpKec = daftarKecKtp.value[0] || '';
    }
    async function salinAlamat() {
      if (!samaAlamat.value) return;
      form.ktpKab = form.tinggalKab;
      await muatKecKtp();
      form.ktpKec = form.tinggalKec;
      form.ktpDetail = form.tinggalDetail;
    }

    async function pilihFotoKtp(event) {
      if (window.previewKTP) await window.previewKTP(event);
      ktpPreview.value = window.ktpBase64Global || '';
    }
    function lihatFotoBesar() {
      if (ktpPreview.value && window.bukaPreviewFoto) window.bukaPreviewFoto(ktpPreview.value);
    }

    async function daftar() {
      if (!form.nama.trim() || !form.nik.trim() || !form.hp.trim() || !window.ktpBase64Global) {
        alert("Mohon lengkapi data wajib (Nama, NIK, No HP, dan Foto KTP)!");
        return;
      }
      // NIK dipakai sebagai PASSWORD SEMENTARA nanti saat Admin approve
      // (lihat vue-antrean-dakar.js) — WAJIB tepat 16 digit angka, bukan
      // cuma "ada isinya".
      if (!/^\d{16}$/.test(form.nik.trim())) {
        alert("NIK KTP harus tepat 16 digit angka!");
        return;
      }

      const perkiraanUkuranKtpKB = Math.round((window.ktpBase64Global.length * 0.75) / 1024);
      if (perkiraanUkuranKtpKB > 700) {
        return alert(`Foto KTP masih terlalu besar (\u00b1${perkiraanUkuranKtpKB}KB). Silakan pilih ulang/ambil ulang foto KTP-nya.`);
      }

      menyimpan.value = true;
      try {
        await setDoc(doc(db, "pendaftaran_pending", emailInput.value), {
          id_karyawan: idKaryawan.value,
          id_app: idApp.value,
          qr_code: "QR-" + idApp.value,

          email: emailInput.value,
          nama: form.nama.trim(),
          name: form.nama.trim(),
          nik: form.nik.trim(),
          hp: form.hp.trim(),
          gender: form.gender,
          tempatLahir: form.tempatLahir,
          tglLahir: form.tgl,
          foto_ktp: window.ktpBase64Global,

          tinggalKab: form.tinggalKab,
          tinggalKec: form.tinggalKec,
          tinggalDetail: form.tinggalDetail,

          ktpKab: form.ktpKab,
          ktpKec: form.ktpKec,
          ktpDetail: form.ktpDetail,

          statusNikah: form.nikah,
          tanggungan: form.tanggungan,

          pendidikan: form.pendidikan,
          sekolah: form.sekolah,
          jurusan: form.jurusan,

          bank: form.bank,
          noRek: form.norek,
          atasNamaRek: form.namarek,

          daruratNama: form.daruratNama,
          daruratHp: form.daruratHp,
          daruratHub: form.daruratHub,

          tanggal_daftar: new Date().toLocaleDateString('id-ID'),
          dibuat_pada: serverTimestamp()
        });

        alert("Registrasi berhasil! Data Anda menunggu diperiksa & disetujui oleh Admin/Owner. Anda akan menerima EMAIL berisi cara login begitu disetujui — pastikan cek folder Spam juga.");
        window.pindahLayar('screen-login');
      } catch (e) {
        console.error("Gagal simpan pendaftaran:", e);
        alert("Gagal menyimpan pendaftaran. Kemungkinan verifikasi email Anda sudah kadaluarsa (berlaku 10 menit) — silakan mulai lagi dari awal (kirim kode OTP ulang).");
      }
      menyimpan.value = false;
    }

    function tutup() {
      window.pindahLayar('screen-login');
    }

    function resetForm() {
      tahap.value = 'email';
      emailInput.value = '';
      kodeOtp.value = '';
      hentikanCountdownOtp();
      Object.assign(form, {
        nik: '', nama: '', hp: '',
        gender: 'Pria', tempatLahir: '', tgl: '',
        tinggalDetail: '', ktpDetail: '',
        nikah: 'Lajang', tanggungan: '',
        pendidikan: 'SMA/SMK', sekolah: '', jurusan: '',
        bank: 'BCA', norek: '', namarek: '',
        daruratNama: '', daruratHp: '', daruratHub: ''
      });
      ktpPreview.value = '';
      window.ktpBase64Global = '';
      samaAlamat.value = false;
    }

    onMounted(resetForm);

    return {
      tahap, emailInput, mengirimOtp, kirimOtp, kirimUlangOtp, gantiEmail,
      kodeOtp, memverifikasiOtp, verifikasiOtp, otpCountdown, formatCountdownOtp,
      idKaryawan, idApp, ktpPreview, menyimpan, form, samaAlamat,
      daftarKabupaten, daftarKecTinggal, daftarKecKtp,
      muatKecTinggal, muatKecKtp, salinAlamat,
      pilihFotoKtp, lihatFotoBesar, daftar, tutup, resetForm
    };
  },
  template: `
    <div class="reg-card" style="width:100%; max-width:520px; background:var(--surface); border:1px solid var(--line); border-radius:22px; padding:34px; margin:20px auto;" v-if="tahap !== 'form'">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--line); padding-bottom:16px; margin-bottom:24px;">
        <div>
          <h2 class="gc-heading" style="font-size:18.5px; font-weight:700;">Daftar akun karyawan</h2>
          <p style="font-size:12.5px; color:var(--text-muted); margin-top:3px;">{{ tahap === 'email' ? 'Langkah 1 dari 3 — Verifikasi email' : 'Langkah 2 dari 3 — Masukkan kode OTP' }}</p>
        </div>
        <button @click="tutup" style="background:none; border:none; color:var(--text-faint); font-size:18px; cursor:pointer;"><i class="fas fa-times"></i></button>
      </div>

      <template v-if="tahap === 'email'">
        <div class="gc-field">
          <label>Email aktif (dipakai untuk login nanti) *</label>
          <input v-model="emailInput" type="email" placeholder="email@gechoo.co" @keyup.enter="kirimOtp">
        </div>
        <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:16px;">Kode verifikasi 6 digit akan dikirim ke email ini. Pastikan email aktif & bisa diakses sekarang.</p>
        <button @click="kirimOtp" :disabled="mengirimOtp" class="btn-primary block">
          {{ mengirimOtp ? 'Mengirim...' : 'Kirim Kode Verifikasi' }} <i v-if="!mengirimOtp" class="fas fa-paper-plane" style="margin-left:6px;"></i>
        </button>
      </template>

      <template v-else-if="tahap === 'otp'">
        <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:14px;">Kode verifikasi sudah dikirim ke <b style="color:var(--text);">{{ emailInput }}</b>. Cek inbox (atau folder Spam), lalu masukkan kodenya di bawah.</p>
        <div class="gc-field">
          <label>Kode OTP (6 digit)</label>
          <input v-model="kodeOtp" type="text" maxlength="6" inputmode="numeric" placeholder="123456" style="text-align:center; letter-spacing:.5em; font-size:18px; font-weight:700;" @keyup.enter="verifikasiOtp">
        </div>
        <button @click="verifikasiOtp" :disabled="memverifikasiOtp" class="btn-primary block" style="margin-bottom:12px;">
          {{ memverifikasiOtp ? 'Memverifikasi...' : 'Verifikasi & Lanjutkan' }}
        </button>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
          <button v-if="otpCountdown > 0" disabled style="background:none; border:none; color:var(--text-faint); font-weight:700; cursor:not-allowed;">Kirim ulang ({{ formatCountdownOtp(otpCountdown) }})</button>
          <button v-else @click="kirimUlangOtp" :disabled="mengirimOtp" style="background:none; border:none; color:var(--burgundy); font-weight:700; cursor:pointer;">{{ mengirimOtp ? 'Mengirim...' : 'Kirim ulang kode' }}</button>
          <button @click="gantiEmail" style="background:none; border:none; color:var(--text-faint); font-weight:700; cursor:pointer;">Ganti email</button>
        </div>
      </template>
    </div>

    <div class="reg-card" style="width:100%; max-width:720px; background:var(--surface); border:1px solid var(--line); border-radius:22px; padding:34px; margin:20px auto;" v-else>
      <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--line); padding-bottom:16px; margin-bottom:24px;">
        <div>
          <h2 class="gc-heading" style="font-size:18.5px; font-weight:700;">Formulir pendaftaran karyawan</h2>
          <p style="font-size:12.5px; color:var(--text-muted); margin-top:3px;">Langkah 3 dari 3 — Data lengkap · Email {{ emailInput }} sudah terverifikasi</p>
        </div>
        <button @click="tutup" style="background:none; border:none; color:var(--text-faint); font-size:18px; cursor:pointer;"><i class="fas fa-times"></i></button>
      </div>

      <div style="font-size:13px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; background:var(--blue); opacity:.9; padding:16px; border-radius:14px; margin-bottom:20px;">
          <div><label style="display:block; font-weight:700; color:#1F5060; font-size:12px; margin-bottom:4px;">ID Karyawan (Auto)</label><input :value="idKaryawan" readonly style="width:100%; padding:9px 12px; background:var(--surface); border:1px solid var(--blue-deep); border-radius:10px; font-family:'Poppins',sans-serif; color:var(--text);"></div>
          <div><label style="display:block; font-weight:700; color:#1F5060; font-size:12px; margin-bottom:4px;">ID APP (Auto)</label><input :value="idApp" readonly style="width:100%; padding:9px 12px; background:var(--surface); border:1px solid var(--blue-deep); border-radius:10px; font-family:'Poppins',sans-serif; color:var(--text);"></div>
        </div>

        <div style="margin-bottom:22px;">
          <h3 class="gc-heading" style="font-size:12.5px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; border-bottom:1px solid var(--pink); padding-bottom:8px; margin-bottom:14px;"><i class="fas fa-id-card" style="margin-right:8px;"></i>Data identitas personal</h3>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
            <div class="gc-field" style="grid-column:1/-1;">
              <label>Upload foto KTP (wajib) *</label>
              <div style="display:flex; align-items:center; gap:12px;">
                <input type="file" accept="image/*" @change="pilihFotoKtp" style="font-size:12px; color:var(--text-muted);">
                <img v-if="ktpPreview" :src="ktpPreview" @click="lihatFotoBesar" style="width:48px; height:48px; object-fit:cover; border-radius:10px; border:1px solid var(--line); cursor:pointer;" title="Klik untuk memperbesar KTP">
              </div>
            </div>
            <div class="gc-field"><label>NIK KTP (16 angka) *</label><input v-model="form.nik" type="text" maxlength="16" placeholder="3204xxxxxxxxxxxx"></div>
            <div class="gc-field"><label>Nama lengkap (sesuai KTP) *</label><input v-model="form.nama" type="text" placeholder="Nama lengkap"></div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; padding-top:12px; border-top:1px solid var(--line); margin-top:8px;">
            <div class="gc-field"><label>Email login</label><input :value="emailInput" type="email" readonly style="background:var(--ivory-dim); color:var(--text-muted);"></div>
            <div class="gc-field"><label>No. handphone (WhatsApp) *</label><input v-model="form.hp" type="text" required placeholder="08xxxxxxxxxx"></div>
          </div>
          <p style="font-size:10.5px; color:var(--text-faint); margin-top:-4px;"><i class="fas fa-circle-info" style="margin-right:4px;"></i>Tidak perlu buat password sekarang — password sementara (NIK Anda) akan aktif begitu Admin/Owner menyetujui pendaftaran ini, dan Anda WAJIB menggantinya saat login pertama kali.</p>
        </div>

        <div style="margin-bottom:22px;">
          <h3 class="gc-heading" style="font-size:12.5px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; border-bottom:1px solid var(--pink); padding-bottom:8px; margin-bottom:14px;"><i class="fas fa-map-marker-alt" style="margin-right:8px;"></i>Domisili</h3>
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:14px;">
            <div class="gc-field"><label>Jenis kelamin *</label><select v-model="form.gender"><option value="Pria">Pria</option><option value="Wanita">Wanita</option></select></div>
            <div class="gc-field"><label>Tempat lahir *</label><input v-model="form.tempatLahir" type="text" placeholder="Kota kelahiran"></div>
            <div class="gc-field"><label>Tanggal lahir *</label><input v-model="form.tgl" type="date"></div>
          </div>

          <div style="background:var(--ivory-dim); border-radius:14px; padding:14px; margin-bottom:12px;">
            <span class="gc-heading" style="font-weight:700; font-size:12.5px; color:var(--text);">Alamat tempat tinggal sekarang</span>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
              <select v-model="form.tinggalKab" @change="muatKecTinggal" style="padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);"><option v-for="k in daftarKabupaten" :key="k" :value="k">{{ k }}</option></select>
              <select v-model="form.tinggalKec" style="padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);"><option v-for="k in daftarKecTinggal" :key="k" :value="k">{{ k }}</option></select>
            </div>
            <input v-model="form.tinggalDetail" type="text" placeholder="Nama jalan, RT/RW, no. rumah" style="width:100%; margin-top:10px; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
          </div>
          <div style="background:var(--ivory-dim); border-radius:14px; padding:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="gc-heading" style="font-weight:700; font-size:12.5px; color:var(--text);">Alamat sesuai KTP</span>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:11.5px; color:var(--burgundy); font-weight:600;"><input v-model="samaAlamat" @change="salinAlamat" type="checkbox" style="accent-color:var(--burgundy);">Sama dengan tempat tinggal</label>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
              <select v-model="form.ktpKab" @change="muatKecKtp" style="padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);"><option v-for="k in daftarKabupaten" :key="k" :value="k">{{ k }}</option></select>
              <select v-model="form.ktpKec" style="padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);"><option v-for="k in daftarKecKtp" :key="k" :value="k">{{ k }}</option></select>
            </div>
            <input v-model="form.ktpDetail" type="text" placeholder="Nama jalan, RT/RW, no. rumah" style="width:100%; margin-top:10px; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
          </div>
        </div>

        <div style="margin-bottom:22px;">
          <h3 class="gc-heading" style="font-size:12.5px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; border-bottom:1px solid var(--pink); padding-bottom:8px; margin-bottom:14px;"><i class="fas fa-graduation-cap" style="margin-right:8px;"></i>Status pernikahan & pendidikan</h3>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:12px;">
            <div class="gc-field"><label>Status pernikahan *</label><select v-model="form.nikah"><option value="Lajang">Lajang</option><option value="Menikah">Menikah</option><option value="Duda/Janda">Duda / Janda</option></select></div>
            <div class="gc-field"><label>Jumlah tanggungan *</label><input v-model="form.tanggungan" type="text" placeholder="Contoh: 0 atau Istri dan 2 Anak"></div>
          </div>
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px;">
            <div class="gc-field"><label>Pendidikan terakhir *</label><select v-model="form.pendidikan"><option value="SMA/SMK">SMA / SMK</option><option value="D3">Diploma (D3)</option><option value="S1">Sarjana (S1)</option></select></div>
            <div class="gc-field"><label>Nama sekolah / kampus *</label><input v-model="form.sekolah" type="text" placeholder="Nama instansi"></div>
            <div class="gc-field"><label>Jurusan *</label><input v-model="form.jurusan" type="text" placeholder="Jurusan"></div>
          </div>
        </div>

        <div style="margin-bottom:22px;">
          <h3 class="gc-heading" style="font-size:12.5px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; border-bottom:1px solid var(--pink); padding-bottom:8px; margin-bottom:14px;"><i class="fas fa-university" style="margin-right:8px;"></i>Perbankan & kontak darurat</h3>
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:12px;">
            <div class="gc-field"><label>Bank *</label><select v-model="form.bank"><option value="BCA">BCA</option><option value="Mandiri">Mandiri</option><option value="BNI">BNI</option><option value="BRI">BRI</option></select></div>
            <div class="gc-field"><label>No. rekening *</label><input v-model="form.norek" type="text" placeholder="Nomor rekening"></div>
            <div class="gc-field"><label>Atas nama rekening *</label><input v-model="form.namarek" type="text" placeholder="Nama pemilik"></div>
          </div>
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px;">
            <div class="gc-field"><label>Nama kontak darurat *</label><input v-model="form.daruratNama" type="text" placeholder="Keluarga/kerabat"></div>
            <div class="gc-field"><label>No. HP darurat *</label><input v-model="form.daruratHp" type="text" placeholder="08xxxxxxxxxx"></div>
            <div class="gc-field"><label>Hubungan *</label><input v-model="form.daruratHub" type="text" placeholder="Contoh: Ayah / Kakak"></div>
          </div>
        </div>

        <button @click="daftar" :disabled="menyimpan" class="btn-primary block">
          {{ menyimpan ? 'Memproses...' : 'Daftarkan akun karyawan' }} <i v-if="!menyimpan" class="fas fa-check" style="margin-left:6px;"></i>
        </button>
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-registrasi');
if (mountPoint) {
  const vm = createApp(AppRegistrasi).mount('#vue-registrasi');
  window.resetFormRegistrasi = function() {
    vm.resetForm();
  };
}
