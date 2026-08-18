// js/vue-buat-password.js
// ============================================================================
// BARU (18 Agt 2026, revisi ke-2 alur registrasi) — layar yang dibuka lewat
// LINK EMAIL dari Antrean Dakar (js/vue-antrean-dakar.js), bukan lewat
// navigasi normal di dalam app. URL: gechoo.online/?buatpassword=1&email=
// ...&token=... — dideteksi & dialihkan ke screen ini oleh js/auth.js
// SEBELUM logic sesi-otomatis biasa sempat jalan (lihat window._modeBuatPassword).
//
// BELUM PERNAH DITES SAMA SEKALI — WAJIB dites end-to-end sebelum dipakai
// karyawan sungguhan.
//
// ALUR, 2 tahap:
//   1. Verifikasi token — TULIS (bukan baca langsung) `tebakan_token` ke
//      pendaftaran_pending/{email}, pola SAMA PERSIS seperti otp_email
//      (lihat vue-otp.js). Kalau cocok & belum kadaluarsa, tulisan itu
//      berhasil DAN sekaligus set token_terverifikasi:true di dokumen —
//      itulah yang membuka izin baca (lihat firestore.rules). Kalau
//      salah/kadaluarsa, tulisan DITOLAK (permission-denied), ditangkap
//      di sini sebagai "link tidak valid".
//   2. Form password — begitu terverifikasi, tampilkan email/nama/HP
//      READ-ONLY (dari dokumen yang baru boleh dibaca), minta Password +
//      Konfirmasi. Submit -> createUserWithEmailAndPassword (TANPA
//      instance kedua — tidak ada sesi siapapun yang perlu dilindungi di
//      sini, orangnya belum login sebagai siapapun), tulis users/{email}
//      (field internal token_* SENGAJA dibuang, tidak ikut ke profil
//      final), hapus pendaftaran_pending SENDIRI, kirim email konfirmasi,
//      lalu SIGN OUT dan arahkan ke Login biasa — supaya login pertama
//      tetap lewat SATU jalur yang sama (vue-login.js, termasuk cek
//      device baru), bukan jalur pintas dari sini.
// ============================================================================
import { createApp, ref, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { doc, getDoc, updateDoc, setDoc, deleteDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

const AppBuatPassword = {
  setup() {
    const params = new URLSearchParams(window.location.search);
    const emailUrl = (params.get('email') || '').trim().toLowerCase();
    const tokenUrl = (params.get('token') || '').trim();

    const tahap = ref('memverifikasi'); // 'memverifikasi' | 'form' | 'gagal' | 'selesai'
    const pesanGagal = ref('');
    const dataKaryawan = ref(null);
    const passwordBaru = ref('');
    const passwordKonfirmasi = ref('');
    const showPassword = ref(false);
    const menyimpan = ref(false);

    async function verifikasiToken() {
      if (!emailUrl || !tokenUrl) {
        tahap.value = 'gagal';
        pesanGagal.value = 'Link tidak lengkap. Pastikan Anda membuka link PERSIS seperti yang dikirim lewat email (jangan disalin sebagian).';
        return;
      }
      try {
        // Verifikasi lewat TULIS — pola sama persis seperti otp_email.
        // Kalau token salah atau sudah kadaluarsa, baris ini yang akan
        // gagal (permission-denied dari Firestore Rules).
        await updateDoc(doc(db, "pendaftaran_pending", emailUrl), {
          tebakan_token: tokenUrl,
          token_terverifikasi: true
        });
        const snap = await getDoc(doc(db, "pendaftaran_pending", emailUrl));
        if (!snap.exists()) throw new Error('Dokumen pendaftaran tidak ditemukan.');
        dataKaryawan.value = snap.data();
        tahap.value = 'form';
      } catch (e) {
        console.error('Gagal verifikasi token buat password:', e);
        tahap.value = 'gagal';
        pesanGagal.value = 'Link ini tidak valid atau sudah kadaluarsa (berlaku 30 menit sejak dikirim). Hubungi Admin/Owner untuk dikirimkan link baru ("Assign Ulang" di Antrean Dakar).';
      }
    }

    async function buatPassword() {
      if (passwordBaru.value.length < 6) return alert('Password minimal 6 karakter!');
      if (passwordBaru.value !== passwordKonfirmasi.value) return alert('Konfirmasi password tidak sama dengan password baru!');

      menyimpan.value = true;
      try {
        // 1. Bikin akun Auth — otomatis login sebagai diri sendiri di
        // titik ini (tidak masalah, tidak ada sesi lain yang aktif).
        await createUserWithEmailAndPassword(auth, emailUrl, passwordBaru.value);

        // 2. Tulis profil users/{email} — buang field internal token_*
        // dan tebakan_token, JANGAN ikut ke profil final.
        const {
          token_buat_password, token_kadaluarsa, token_terverifikasi, tebakan_token,
          ...profilBersih
        } = dataKaryawan.value;
        await setDoc(doc(db, "users", emailUrl), {
          ...profilBersih,
          role: 'operator',
          status_approval: 'APPROVED'
        });

        // 3. Hapus dokumen pending SENDIRI (bukan Admin lagi).
        await deleteDoc(doc(db, "pendaftaran_pending", emailUrl));

        // 4. Email konfirmasi — best-effort, kalau gagal kirim akun TETAP
        // sudah jadi.
        try {
          await addDoc(collection(db, "mail"), {
            to: [emailUrl],
            message: {
              subject: 'Password Berhasil Dibuat - Zevanic ERP',
              text: `Halo ${profilBersih.nama || ''},\n\nPassword akun Zevanic ERP Anda berhasil dibuat. Silakan login di gechoo.online dengan email dan password yang baru saja Anda buat.`
            },
            dikirim_pada: serverTimestamp()
          });
        } catch (e) {
          console.error('Gagal kirim email konfirmasi (akun tetap berhasil dibuat):', e);
        }

        // 5. SENGAJA sign-out & arahkan ke Login biasa — supaya login
        // pertama tetap lewat SATU jalur yang sama (cek device baru, dst),
        // bukan jalur pintas dari layar ini.
        await signOut(auth);
        tahap.value = 'selesai';
      } catch (e) {
        console.error('Gagal membuat password:', e);
        if (e.code === 'auth/email-already-in-use') {
          alert('Email ini SUDAH punya akun aktif. Kemungkinan Anda sudah pernah membuat password sebelumnya — coba langsung Login.');
        } else if (e.code === 'auth/weak-password') {
          alert('Password terlalu lemah, minimal 6 karakter.');
        } else {
          alert('Gagal membuat akun: ' + e.message + '. Coba lagi, atau hubungi Admin/Owner kalau terus gagal.');
        }
      }
      menyimpan.value = false;
    }

    function keLogin() {
      window.location.href = window.location.origin + window.location.pathname;
    }

    onMounted(verifikasiToken);

    return {
      tahap, pesanGagal, dataKaryawan, emailUrl,
      passwordBaru, passwordKonfirmasi, showPassword, menyimpan,
      buatPassword, keLogin
    };
  },
  template: `
    <div style="width:100%; max-width:420px; background:var(--surface); border:1px solid var(--line); border-radius:22px; padding:34px; margin:20px auto;">

      <template v-if="tahap === 'memverifikasi'">
        <div style="text-align:center; padding:30px 0;">
          <i class="fas fa-spinner fa-spin" style="font-size:32px; color:var(--burgundy);"></i>
          <p style="font-size:12.5px; color:var(--text-muted); margin-top:14px;">Memeriksa link Anda...</p>
        </div>
      </template>

      <template v-else-if="tahap === 'gagal'">
        <div style="text-align:center; padding:16px 0;">
          <i class="fas fa-circle-exclamation" style="font-size:38px; color:var(--danger);"></i>
          <h2 class="gc-heading" style="font-size:16px; font-weight:700; margin-top:14px;">Link tidak valid</h2>
          <p style="font-size:12.5px; color:var(--text-muted); margin-top:8px; line-height:1.6;">{{ pesanGagal }}</p>
        </div>
      </template>

      <template v-else-if="tahap === 'form'">
        <div style="border-bottom:1px solid var(--line); padding-bottom:16px; margin-bottom:20px;">
          <h2 class="gc-heading" style="font-size:18px; font-weight:700;">Buat password Anda</h2>
          <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">Pendaftaran Anda sudah disetujui — buat password sendiri untuk mulai login.</p>
        </div>

        <div style="background:var(--ivory-dim); border-radius:14px; padding:14px 16px; margin-bottom:18px; font-size:12.5px;">
          <div style="margin-bottom:6px;"><span style="color:var(--text-faint);">Email:</span> <b>{{ dataKaryawan.email || emailUrl }}</b></div>
          <div style="margin-bottom:6px;"><span style="color:var(--text-faint);">Nama:</span> <b>{{ dataKaryawan.nama || '-' }}</b></div>
          <div><span style="color:var(--text-faint);">No. HP:</span> <b>{{ dataKaryawan.hp || '-' }}</b></div>
        </div>

        <div class="gc-field">
          <label>Password baru (min. 6 karakter)</label>
          <div style="position:relative;">
            <input v-model="passwordBaru" :type="showPassword ? 'text' : 'password'" placeholder="Password baru" style="padding-right:40px;">
            <button type="button" @click="showPassword = !showPassword" style="position:absolute; right:12px; top:12px; background:none; border:none; color:var(--text-faint); cursor:pointer;">
              <i :class="showPassword ? 'fa-eye' : 'fa-eye-slash'" class="fas"></i>
            </button>
          </div>
        </div>
        <div class="gc-field">
          <label>Konfirmasi password</label>
          <input v-model="passwordKonfirmasi" :type="showPassword ? 'text' : 'password'" placeholder="Ulangi password baru">
        </div>

        <button @click="buatPassword" :disabled="menyimpan" class="btn-primary block">
          {{ menyimpan ? 'Menyimpan...' : 'Buat Password & Aktifkan Akun' }}
        </button>
      </template>

      <template v-else-if="tahap === 'selesai'">
        <div style="text-align:center; padding:16px 0;">
          <i class="fas fa-circle-check" style="font-size:38px; color:var(--ok);"></i>
          <h2 class="gc-heading" style="font-size:16px; font-weight:700; margin-top:14px;">Akun Anda aktif!</h2>
          <p style="font-size:12.5px; color:var(--text-muted); margin-top:8px; line-height:1.6;">Password berhasil dibuat. Silakan login dengan email dan password yang baru saja Anda buat.</p>
          <button @click="keLogin" class="btn-primary block" style="margin-top:20px;">Ke Halaman Login</button>
        </div>
      </template>

    </div>
  `
};

const mountPoint = document.getElementById('vue-buat-password');
if (mountPoint) {
  createApp(AppBuatPassword).mount('#vue-buat-password');
}
