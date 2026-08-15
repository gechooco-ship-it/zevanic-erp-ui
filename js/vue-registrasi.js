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
    <div class="w-full max-w-2xl bg-white p-8 rounded-3xl shadow-xl border border-gray-100 my-auto">
      <div class="flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h2 class="text-xl font-black text-gray-900">Formulir Pendaftaran Karyawan</h2>
          <p class="text-xs text-gray-500">Sesuai standar operasional Zevanic ERP</p>
        </div>
        <button @click="tutup" class="text-gray-400 hover:text-gray-600 text-sm font-bold"><i class="fas fa-times text-lg"></i></button>
      </div>

      <div class="space-y-4 text-xs">
        <div class="grid grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
          <div><label class="block font-bold text-blue-800 mb-1">ID Karyawan (Auto)</label><input :value="idKaryawan" readonly class="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl font-mono text-gray-600"></div>
          <div><label class="block font-bold text-blue-800 mb-1">ID APP (Auto)</label><input :value="idApp" readonly class="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl font-mono text-gray-600"></div>
        </div>

        <div class="space-y-3 pt-2">
          <h3 class="font-bold text-gray-900 text-sm border-b pb-1"><i class="fas fa-id-card text-blue-600 mr-2"></i> Data Identitas Personal</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block font-semibold text-gray-600 mb-1">Upload Foto KTP (Wajib) *</label>
              <div class="flex items-center space-x-3">
                <input type="file" accept="image/*" @change="pilihFotoKtp" class="text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
                <img v-if="ktpPreview" :src="ktpPreview" @click="lihatFotoBesar" class="w-12 h-12 object-cover rounded-lg border shadow-sm cursor-pointer hover:scale-105 transition" title="Klik untuk memperbesar KTP">
              </div>
            </div>
            <div><label class="block font-semibold text-gray-600 mb-1">NIK KTP (16 Angka) *</label><input v-model="form.nik" type="text" maxlength="16" placeholder="3204xxxxxxxxxxxx" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Nama Lengkap (Sesuai KTP) *</label><input v-model="form.nama" type="text" placeholder="Nama lengkap" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
            <div><label class="block font-semibold text-gray-600 mb-1">Email Aktif (Identitas Login) *</label><input v-model="form.email" type="email" required placeholder="email@domain.com" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">No. Handphone (WhatsApp) *</label><input v-model="form.hp" type="text" required placeholder="08xxxxxxxxxx" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Kata Sandi (Password) *</label><input v-model="form.pass" type="password" required placeholder="Buat password login" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Konfirmasi Kata Sandi *</label><input v-model="form.confirmPass" type="password" required placeholder="Ulangi password" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
          </div>

          <div class="space-y-3 pt-2">
            <h3 class="font-bold text-gray-900 text-sm border-b pb-1"><i class="fas fa-map-marker-alt text-blue-600 mr-2"></i> Domisili</h3>
            <div class="grid grid-cols-3 gap-3">
              <div><label class="block font-semibold text-gray-600 mb-1">Jenis Kelamin *</label><select v-model="form.gender" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"><option value="Pria">Pria</option><option value="Wanita">Wanita</option></select></div>
              <div><label class="block font-semibold text-gray-600 mb-1">Tempat Lahir *</label><input v-model="form.tempatLahir" type="text" placeholder="Kota Kelahiran" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"></div>
              <div><label class="block font-semibold text-gray-600 mb-1">Tanggal Lahir *</label><input v-model="form.tgl" type="date" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"></div>
            </div>
          </div>

          <div class="p-3 bg-gray-50 rounded-2xl border space-y-2">
            <span class="font-bold text-gray-700">Alamat Tempat Tinggal Sekarang</span>
            <div class="grid grid-cols-2 gap-2">
              <select v-model="form.tinggalKab" @change="muatKecTinggal" class="px-3 py-2 bg-white border rounded-xl"><option v-for="k in daftarKabupaten" :key="k" :value="k">{{ k }}</option></select>
              <select v-model="form.tinggalKec" class="px-3 py-2 bg-white border rounded-xl"><option v-for="k in daftarKecTinggal" :key="k" :value="k">{{ k }}</option></select>
            </div>
            <input v-model="form.tinggalDetail" type="text" placeholder="Nama Jalan, RT/RW, No. Rumah" class="w-full px-3 py-2 bg-white border rounded-xl">
          </div>
          <div class="p-3 bg-gray-50 rounded-2xl border space-y-2">
            <div class="flex justify-between items-center">
              <span class="font-bold text-gray-700">Alamat Sesuai KTP</span>
              <label class="flex items-center space-x-1 cursor-pointer text-[11px] text-blue-600 font-semibold"><input v-model="samaAlamat" @change="salinAlamat" type="checkbox" class="rounded"><span>Sama dengan tempat tinggal</span></label>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <select v-model="form.ktpKab" @change="muatKecKtp" class="px-3 py-2 bg-white border rounded-xl"><option v-for="k in daftarKabupaten" :key="k" :value="k">{{ k }}</option></select>
              <select v-model="form.ktpKec" class="px-3 py-2 bg-white border rounded-xl"><option v-for="k in daftarKecKtp" :key="k" :value="k">{{ k }}</option></select>
            </div>
            <input v-model="form.ktpDetail" type="text" placeholder="Nama Jalan, RT/RW, No. Rumah" class="w-full px-3 py-2 bg-white border rounded-xl">
          </div>
        </div>

        <div class="space-y-3 pt-2">
          <h3 class="font-bold text-gray-900 text-sm border-b pb-1"><i class="fas fa-graduation-cap text-blue-600 mr-2"></i> Status Pernikahan & Pendidikan</h3>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="block font-semibold text-gray-600 mb-1">Status Pernikahan *</label><select v-model="form.nikah" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"><option value="Lajang">Lajang</option><option value="Menikah">Menikah</option><option value="Duda/Janda">Duda / Janda</option></select></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Jumlah Tanggungan *</label><input v-model="form.tanggungan" type="text" placeholder="Contoh: 0 atau Istri dan 2 Anak" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"></div>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div><label class="block font-semibold text-gray-600 mb-1">Pendidikan Terakhir *</label><select v-model="form.pendidikan" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"><option value="SMA/SMK">SMA / SMK</option><option value="D3">Diploma (D3)</option><option value="S1">Sarjana (S1)</option></select></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Nama Sekolah / Kampus *</label><input v-model="form.sekolah" type="text" placeholder="Nama instansi" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Jurusan *</label><input v-model="form.jurusan" type="text" placeholder="Jurusan" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"></div>
          </div>
        </div>

        <div class="space-y-3 pt-2">
          <h3 class="font-bold text-gray-900 text-sm border-b pb-1"><i class="fas fa-university text-blue-600 mr-2"></i> Perbankan & Kontak Darurat</h3>
          <div class="grid grid-cols-3 gap-2">
            <div><label class="block font-semibold text-gray-600 mb-1">Bank *</label><select v-model="form.bank" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"><option value="BCA">BCA</option><option value="Mandiri">Mandiri</option><option value="BNI">BNI</option><option value="BRI">BRI</option></select></div>
            <div><label class="block font-semibold text-gray-600 mb-1">No. Rekening *</label><input v-model="form.norek" type="text" placeholder="Nomor Rekening" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Atas Nama Rekening *</label><input v-model="form.namarek" type="text" placeholder="Nama pemilik" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"></div>
          </div>
          <div class="grid grid-cols-3 gap-2 pt-2">
            <div><label class="block font-semibold text-gray-600 mb-1">Nama Kontak Darurat *</label><input v-model="form.daruratNama" type="text" placeholder="Keluarga/Kerabat" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">No. HP Darurat *</label><input v-model="form.daruratHp" type="text" placeholder="08xxxxxxxxxx" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Hubungan *</label><input v-model="form.daruratHub" type="text" placeholder="Contoh: Ayah / Kakak" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none"></div>
          </div>
        </div>

        <button @click="daftar" :disabled="menyimpan" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg transition mt-4 disabled:opacity-50">
          {{ menyimpan ? 'Memproses...' : 'Daftarkan Akun Karyawan' }} <i v-if="!menyimpan" class="fas fa-check ml-1"></i>
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
