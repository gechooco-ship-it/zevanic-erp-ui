// js/vue-registrasi.js
// ============================================================================
// Migrasi layar Registrasi Karyawan Baru ke Vue.
//
// PENTING — titik sambung ke bagian yang masih vanilla:
// - window.pindahLayar (app.js) untuk pindah layar login <-> register
// - window.previewKTP / window.ktpBase64Global (camera.js) untuk kompresi
//   foto KTP — TIDAK diduplikasi di sini, dipanggil apa adanya
// - window.ambilMasterList, window.ambilKecamatanUntukKabupaten (dashboard.js)
// - window.kirimPesanWhatsapp, window.ambilTemplateWA, window.pesanErrorAuth
//   (auth.js) — dipertahankan sebagai fungsi bersama
// - window.bukaPreviewFoto (dashboard.js) untuk klik-perbesar foto KTP
//
// Jembatan BARU ke vanilla: window.resetFormRegistrasi() dipanggil dari
// auth.js (window.bukaFormRegistrasi, dipicu tombol "Daftar Akun Baru" di
// layar Login) supaya ID Karyawan/ID APP otomatis di-generate ulang di dalam
// state Vue setiap kali form registrasi dibuka.
// ============================================================================
import { createApp, ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { createUserWithEmailAndPassword, deleteUser } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db, auth } from "./firebase-config.js";

function idAcak(prefix) {
  return prefix + "-" + Math.floor(1000 + Math.random() * 9000);
}

const AppRegistrasi = {
  setup() {
    const idKaryawan = ref('');
    const idApp = ref('');
    const ktpPreview = ref('');
    const menyimpan = ref(false);
    const sudahDaftar = ref(false);

    const daftarKabupaten = ref([]);
    const daftarKecTinggal = ref([]);
    const daftarKecKtp = ref([]);
    const samaAlamat = ref(false);

    const form = reactive({
      nik: '', nama: '', email: '', hp: '', pass: '', confirmPass: '',
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
      if (!form.nama.trim() || !form.nik.trim() || !form.email.trim() || !form.hp.trim() || !form.pass || !form.confirmPass || !window.ktpBase64Global) {
        alert("Mohon lengkapi data wajib (Nama, NIK, Email, No HP, Password, dan Foto KTP)!");
        return;
      }
      if (form.pass !== form.confirmPass) return alert("Konfirmasi password tidak sama dengan password!");
      if (form.pass.length < 6) return alert("Password minimal 6 karakter!");

      const perkiraanUkuranKtpKB = Math.round((window.ktpBase64Global.length * 0.75) / 1024);
      if (perkiraanUkuranKtpKB > 700) {
        return alert(`Foto KTP masih terlalu besar (\u00b1${perkiraanUkuranKtpKB}KB). Silakan pilih ulang/ambil ulang foto KTP-nya.`);
      }

      const email = form.email.trim().toLowerCase();
      menyimpan.value = true;
      let userCredential = null;
      try {
        userCredential = await createUserWithEmailAndPassword(auth, email, form.pass);

        try {
          await setDoc(doc(db, "users", email), {
            id_karyawan: idKaryawan.value,
            id_app: idApp.value,
            qr_code: "QR-" + idApp.value,
            status_approval: "PENDING",
            status_kerja: "Menunggu Persetujuan",
            role: "operator",
            jenis_pekerjaan: "",
            jabatan: "",
            status_karyawan: "",
            gudang_penempatan: [],
            nama_shift: "",

            email: email,
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

            tanggal_daftar: new Date().toLocaleDateString('id-ID')
          });
        } catch (errSimpanProfil) {
          try {
            await deleteUser(userCredential.user);
          } catch (errRollback) {
            console.error("Gagal rollback akun Auth setelah simpan profil gagal:", errRollback);
          }
          throw errSimpanProfil;
        }

        (async () => {
          try {
            if (window.ambilTemplateWA && window.kirimPesanWhatsapp) {
              const templatePending = await window.ambilTemplateWA('template_pending');
              await window.kirimPesanWhatsapp(form.hp.trim(), templatePending.replace(/\{nama\}/g, form.nama.trim()), "Akun Menunggu");
            }
          } catch (e) {
            console.error("Gagal kirim notifikasi WA pendaftaran:", e);
          }
        })();

        alert("Registrasi Berhasil! Akun Anda menunggu persetujuan Owner/PIC sebelum bisa dipakai login.");
        window.pindahLayar('screen-login');
      } catch (e) {
        console.error("Gagal daftar:", e);
        alert((window.pesanErrorAuth && window.pesanErrorAuth(e.code)) || "Gagal menyimpan pendaftaran: " + e.message);
      }
      menyimpan.value = false;
    }

    function tutup() {
      window.pindahLayar('screen-login');
    }

    async function resetForm() {
      generateId();
      Object.assign(form, {
        nik: '', nama: '', email: '', hp: '', pass: '', confirmPass: '',
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
      if (!sudahDaftar.value) {
        await muatKabupaten();
        sudahDaftar.value = true;
      }
    }

    onMounted(resetForm);

    return {
      idKaryawan, idApp, ktpPreview, menyimpan, form, samaAlamat,
      daftarKabupaten, daftarKecTinggal, daftarKecKtp,
      muatKecTinggal, muatKecKtp, salinAlamat,
      pilihFotoKtp, lihatFotoBesar, daftar, tutup, resetForm
    };
  },
  template: `
    <div class="reg-card" style="width:100%; max-width:720px; background:var(--surface); border:1px solid var(--line); border-radius:22px; padding:34px; margin:20px auto;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--line); padding-bottom:16px; margin-bottom:24px;">
        <div>
          <h2 class="gc-heading" style="font-size:18.5px; font-weight:700;">Formulir pendaftaran karyawan</h2>
          <p style="font-size:12.5px; color:var(--text-muted); margin-top:3px;">Sesuai standar operasional Gechoo</p>
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
            <div class="gc-field"><label>Email aktif (identitas login) *</label><input v-model="form.email" type="email" required placeholder="email@gechoo.co"></div>
            <div class="gc-field"><label>No. handphone (WhatsApp) *</label><input v-model="form.hp" type="text" required placeholder="08xxxxxxxxxx"></div>
            <div class="gc-field"><label>Kata sandi (password) *</label><input v-model="form.pass" type="password" required placeholder="Buat password login"></div>
            <div class="gc-field"><label>Konfirmasi kata sandi *</label><input v-model="form.confirmPass" type="password" required placeholder="Ulangi password"></div>
          </div>
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
