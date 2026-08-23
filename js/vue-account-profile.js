// js/vue-account-profile.js
// ============================================================================
// Halaman KESEMBILAN & TERBESAR yang dimigrasi ke Vue: seluruh Account
// Profile (Account/QR, Data Karyawan, Absensi dengan Izin/Cuti/Lembur +
// riwayat + Aju Banding, Pencapaian, Keamanan).
//
// PENTING — titik sambung ke bagian yang BELUM dimigrasi (kamera/geofencing,
// vanilla): window.pindahLayar('screen-camera'), window.statusPilihanGlobal,
// window.tanggalIzinGlobal, window.keteranganIzinGlobal,
// window.lemburMulaiGlobal/lemburSelesaiGlobal/lemburAlasanGlobal/
// lemburInstruksiGlobal — SEMUA variabel global ini tetap dipakai apa adanya
// supaya alur ambil-foto & Clock In (Izin/Cuti/Lembur) tetap berjalan normal.
// window.currentUser (auth.js) tetap jadi satu-satunya sumber data user.
// window.exportKeCSV & window.dataRiwayatGlobal TETAP dipertahankan di
// dashboard.js karena dipakai bareng laporan ini.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { reauthenticateWithCredential, EmailAuthProvider, updatePassword } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db, auth } from "./firebase-config.js";
import { DuaBaris } from './vue-components.js';
import { formatBaris } from './vue-riwayat-absensi.js';
import { AjukanReimburseTab } from './vue-reimburse.js';

// ---------------------------------------------------------------------------
// Aju Banding modal (dipakai dari dalam tab Absensi)
// ---------------------------------------------------------------------------
const AjuBandingModal = {
  props: { docId: { type: String, required: true } },
  emits: ['tutup', 'terkirim'],
  setup(props, { emit }) {
    const alasan = ref('');
    const fileInfo = ref('');
    const fileData = ref(null); // { dataUrl, tipe, nama }
    const mengirim = ref(false);
    const BATAS_1MB = 1024 * 1024;

    function pilihFile(event) {
      const file = event.target.files[0];
      if (!file) { fileData.value = null; fileInfo.value = ''; return; }

      if (file.size > BATAS_1MB) {
        alert(`File terlalu besar (${Math.round(file.size / 1024)}KB). Maksimal 1MB.`);
        event.target.value = '';
        fileData.value = null;
        fileInfo.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        fileData.value = { dataUrl: e.target.result, tipe: file.type.startsWith('video') ? 'video' : 'foto', nama: file.name };
        fileInfo.value = `${file.name} (${Math.round(file.size / 1024)}KB) siap diunggah`;
      };
      reader.readAsDataURL(file);
    }

    async function kirim() {
      if (!alasan.value) return alert("Harap isi alasan sanggahan Anda!");
      mengirim.value = true;
      try {
        const dataBanding = { catatan_banding: alasan.value, tgl_banding: new Date().toISOString() };
        if (fileData.value) {
          dataBanding.lampiran_banding = fileData.value.dataUrl;
          dataBanding.lampiran_banding_tipe = fileData.value.tipe;
        }
        await updateDoc(doc(db, "absensi", props.docId), dataBanding);
        alert("Sanggahan berhasil dikirimkan ke Admin / Owner untuk ditinjau ulang.");
        emit('terkirim');
      } catch (e) {
        console.error("Gagal kirim banding:", e);
        alert("Gagal mengirimkan sanggahan ke server. Kalau ada lampiran, coba kirim tanpa lampiran atau pakai file lebih kecil.");
      }
      mengirim.value = false;
    }

    return { alasan, fileInfo, mengirim, pilihFile, kirim };
  },
  template: `
    <div style="position:fixed; inset:0; background:rgba(59,42,31,.6); z-index:50; display:flex; align-items:center; justify-content:center; padding:16px;" class="fade-in">
      <div style="background:var(--surface); width:100%; max-width:420px; padding:22px; border-radius:20px; max-height:90vh; overflow-y:auto; font-size:12.5px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:14px;">
          <h3 class="gc-heading" style="font-weight:700; font-size:14px;"><i class="fas fa-gavel" style="color:var(--warn); margin-right:8px;"></i> Form Pengajuan Sanggahan / Aju Banding</h3>
          <button @click="$emit('tutup')" style="background:none; border:none; color:var(--text-faint); font-size:16px; cursor:pointer;"><i class="fas fa-times"></i></button>
        </div>
        <p style="font-size:11px; color:var(--text-muted); margin-bottom:14px;">Sampaikan alasan sanggahan Anda kepada Admin / Owner apabila status presensi atau catatan seragam Anda perlu dikoreksi.</p>
        <div class="gc-field">
          <label>Alasan / catatan sanggahan *</label>
          <textarea v-model="alasan" rows="3" placeholder="Jelaskan alasan atau bukti penyesuaian..."></textarea>
        </div>
        <div class="gc-field">
          <label>Lampiran foto/video (opsional, maks 1MB)</label>
          <input type="file" accept="image/*,video/*" @change="pilihFile" style="font-size:11px; color:var(--text-muted);">
          <p style="font-size:10.5px; color:var(--text-faint); margin-top:5px;"><i v-if="fileInfo" class="fas fa-check-circle" style="color:var(--ok); margin-right:4px;"></i>{{ fileInfo }}</p>
        </div>
        <div style="display:flex; gap:10px; padding-top:8px;">
          <button @click="$emit('tutup')" class="btn-outline" style="flex:1;">Batal</button>
          <button @click="kirim" :disabled="mengirim" class="btn-primary" style="flex:1; background:var(--warn);">{{ mengirim ? 'Mengirim...' : 'Kirim sanggahan' }}</button>
        </div>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// App utama
// ---------------------------------------------------------------------------
const AppAccountProfile = {
  components: { DuaBaris, AjuBandingModal, AjukanReimburseTab },
  setup() {
    const tabAktif = ref('account');

    // ---- Keamanan: Update Password ----
    const passwordLama = ref('');
    const passwordBaruKeamanan = ref('');
    const menyimpanPasswordKeamanan = ref(false);

    async function updatePasswordKeamanan() {
      if (!passwordLama.value || !passwordBaruKeamanan.value) return alert("Isi password lama dan password baru!");
      if (passwordBaruKeamanan.value.length < 6) return alert("Password baru minimal 6 karakter!");
      menyimpanPasswordKeamanan.value = true;
      try {
        // Reauthenticate DULU pakai password lama — supaya updatePassword tidak
        // ditolak Firebase karena sesi dianggap "tidak baru login" (sama
        // seperti risiko auth/requires-recent-login yang dicatat di vue-login.js).
        const credential = EmailAuthProvider.credential(window.currentUser.email, passwordLama.value);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, passwordBaruKeamanan.value);
        alert("Password berhasil diperbarui!");
        passwordLama.value = '';
        passwordBaruKeamanan.value = '';
      } catch (e) {
        console.error("Gagal update password:", e);
        if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
          alert("Password lama salah.");
        } else if (e.code === 'auth/weak-password') {
          alert("Password baru terlalu lemah, minimal 6 karakter.");
        } else if (e.code === 'auth/too-many-requests') {
          alert("Terlalu banyak percobaan gagal. Coba lagi beberapa saat.");
        } else {
          alert("Gagal memperbarui password: " + e.message);
        }
      }
      menyimpanPasswordKeamanan.value = false;
    }

    // ---- Keamanan: PIN (BARU, 22 Agt 2026, permintaan Hilman) ----
    // Dipakai buat "Absensi Melalui QR" — HP Kiosk di gudang scan barcode
    // karyawan, lalu minta PIN buat pastikan bukan orang lain yang absen
    // pakai barcode yang dipinjam/dicuri. TIDAK PERNAH simpan PIN mentah
    // — cuma hash SHA-256 (Web Crypto API bawaan browser, tanpa library
    // tambahan) + di-salt pakai email pemiliknya sendiri, supaya PIN yang
    // SAMA antar 2 karyawan beda tetap hasilkan hash BEDA (anti rainbow-
    // table sederhana). WAJIB re-auth password dulu sebelum PIN
    // dipasang/diubah — sama persis pola Update Password di atas.
    const subTabKeamanan = ref('password'); // 'password' | 'pin'
    const pinStatusTerpasang = ref(false);
    const pinBaru = ref('');
    const konfirmasiPin = ref('');
    const passwordUntukPin = ref('');
    const menyimpanPin = ref(false);

    function muatStatusPin() {
      pinStatusTerpasang.value = !!(window.currentUser && window.currentUser.pin_hash);
    }

    async function hashPin(pin, email) {
      const data = new TextEncoder().encode(pin + '|' + email);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function simpanPin() {
      if (!/^\d{6}$/.test(pinBaru.value)) return alert("PIN wajib PERSIS 6 angka (0-9 saja).");
      if (pinBaru.value !== konfirmasiPin.value) return alert("Konfirmasi PIN tidak cocok dengan PIN baru.");
      if (!passwordUntukPin.value) return alert("Masukkan password Anda dulu buat konfirmasi.");
      menyimpanPin.value = true;
      try {
        // Reauthenticate DULU — PERSIS pola updatePasswordKeamanan di atas,
        // supaya orang lain yang kebetulan pegang sesi login tidak bisa
        // ganti PIN tanpa tahu password aslinya.
        const credential = EmailAuthProvider.credential(window.currentUser.email, passwordUntukPin.value);
        await reauthenticateWithCredential(auth.currentUser, credential);
        const hash = await hashPin(pinBaru.value, window.currentUser.email);
        await updateDoc(doc(db, "users", window.currentUser.email), { pin_hash: hash });
        window.currentUser.pin_hash = hash; // biar badge langsung update tanpa reload
        // BUG (ditemukan 22 Agt 2026): tanpa baris ini, cache sesi di
        // localStorage (window.simpanKonteksSesi, auth.js) TETAP versi
        // LAMA (belum ada pin_hash) — begitu halaman di-refresh, app
        // baca dari cache basi itu (bukan Firestore lagi, demi hemat
        // read), badge balik jadi "Belum Terpasang" walau di Firestore
        // sebenarnya SUDAH tersimpan benar. WAJIB refresh cache setiap
        // kali window.currentUser diubah di tengah sesi, bukan cuma pas
        // login pertama kali.
        if (window.simpanKonteksSesi) window.simpanKonteksSesi();
        const sudahAdaSebelumnya = pinStatusTerpasang.value;
        pinStatusTerpasang.value = true;
        alert(sudahAdaSebelumnya ? "PIN berhasil diperbarui!" : "PIN berhasil dipasang!");
        pinBaru.value = ''; konfirmasiPin.value = ''; passwordUntukPin.value = '';
      } catch (e) {
        console.error("Gagal simpan PIN:", e);
        if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
          alert("Password salah.");
        } else if (e.code === 'auth/too-many-requests') {
          alert("Terlalu banyak percobaan gagal. Coba lagi beberapa saat lagi.");
        } else {
          alert("Terjadi kesalahan sistem saat menyimpan PIN.");
        }
      }
      menyimpanPin.value = false;
    }

    // ---- Account (QR/ID) ----
    // PENTING: window.currentUser adalah objek biasa (bukan reactive Vue),
    // dan Vue app ini ter-mount di awal load halaman — SEBELUM proses login
    // selesai. Kalau pakai computed() biasa, nilainya "terkunci" kosong
    // selamanya (computed cuma jalan sekali, tidak tahu window.currentUser
    // berubah). Makanya di sini pakai ref() yang di-refresh eksplisit setiap
    // kali tab ini dibuka (lihat muatAccountDisplay + pindahTab di bawah).
    const namaTampil = ref('User');
    const idAppTampil = ref('ID Tidak Ditemukan');
    const jabatanTampil = ref('Staff');
    const qrUrl = ref('');

    function muatAccountDisplay() {
      namaTampil.value = window.currentUser?.name || window.currentUser?.nama || 'User';
      idAppTampil.value = window.currentUser?.id_app || 'ID Tidak Ditemukan';
      jabatanTampil.value = window.currentUser?.jabatan || window.currentUser?.role || 'Staff';
      // DIPERBAIKI (23 Agt 2026) — BUG LAMA baru ketahuan lewat fitur
      // Kiosk: auth.js/vue-login.js isi window.currentUser.id_app dengan
      // literal string "N/A" (BUKAN kosong/falsy) kalau field id_app di
      // Firestore memang kosong (kasus nyata: akun Owner yang dibuat
      // manual lewat Firebase Console, id_app tidak sempat diisi).
      // "N/A" itu STRING BENERAN (truthy) — `|| email` TIDAK PERNAH
      // kepakai, QR jadi isinya literal teks "N/A", tidak bisa ditemukan
      // di database manapun saat di-scan. WAJIB kecualikan "N/A" secara
      // eksplisit di sini, bukan cuma cek falsy biasa.
      const idAppAsli = (window.currentUser?.id_app && window.currentUser.id_app !== 'N/A') ? window.currentUser.id_app : null;
      const qrData = idAppAsli || window.currentUser?.email || '';
      qrUrl.value = qrData ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}` : '';
      muatRoleTampil();
    }

    function clockOut() {
      if (window.prosesClockOut) window.prosesClockOut();
    }

    // HARUS lewat fungsi begini, bukan "window.logout()" langsung di
    // template — sama seperti bug yang ditemukan di vue-profile-drawer.js.
    function keluar() { if (window.logout) window.logout(); }

    // Buat menu pintasan Admin di tab Account (pengganti akses lewat bottom
    // nav mobile yang sekarang dipakai buat Home/Absensi/Scan QR/Progress
    // universal semua role) — computed, bukan re-baca window.currentUser
    // langsung di template (Vue tidak reaktif ke situ, sudah pernah kena
    // bug ini sebelumnya).
    // roleTampil masih dipertahankan (dipakai muatRoleTampil di
    // muatAccountDisplay) sekalipun computed turunan Admin/Owner-nya sudah
    // tidak dipakai lagi di sini — menu admin sudah pindah ke Home
    // (js/vue-home.js, lewat daftarMenuGroups).
    const roleTampil = ref('');
    function muatRoleTampil() { roleTampil.value = (window.currentUser?.role || '').toLowerCase(); }

    // ---- Data Karyawan (self-edit) ----
    const form = reactive({
      nama: '', nik: '', jk: '', tempatLahir: '', tglLahir: '', hp: '', email: '',
      ktpKab: '', ktpKec: '', ktpDetail: '',
      domKab: '', domKec: '', domDetail: '',
      pendidikan: '', sekolah: '', jurusan: '', nikah: '', tanggungan: '',
      daruratNama: '', daruratHub: '', daruratHp: '',
      bank: '', norek: '', namarek: ''
    });
    const menyimpanForm = ref(false);

    function muatFormDariCurrentUser() {
      const cu = window.currentUser || {};
      form.nama = cu.name || cu.nama || '';
      form.nik = cu.nik || '';
      form.jk = cu.jk || cu.gender || '';
      form.tempatLahir = cu.tempatLahir || '';
      form.tglLahir = cu.tglLahir || cu.tgl || '';
      form.hp = cu.hp || '';
      form.email = cu.email || '';
      form.ktpKab = cu.ktpKab || '';
      form.ktpKec = cu.ktpKec || '';
      form.ktpDetail = cu.ktpDetail || '';
      form.domKab = cu.domisiliKab || cu.tinggalKab || '';
      form.domKec = cu.domisiliKec || cu.tinggalKec || '';
      form.domDetail = cu.domisiliDetail || cu.tinggalDetail || '';
      form.pendidikan = cu.pendidikan || '';
      form.sekolah = cu.sekolah || '';
      form.jurusan = cu.jurusan || '';
      form.nikah = cu.statusNikah || cu.nikah || '';
      form.tanggungan = cu.tanggungan || '';
      form.daruratNama = cu.daruratNama || '';
      form.daruratHub = cu.daruratHub || '';
      form.daruratHp = cu.daruratHp || '';
      form.bank = cu.bank || '';
      form.norek = cu.noRek || cu.norek || '';
      form.namarek = cu.atasNamaRek || cu.namarek || '';
    }

    async function simpanDataDiri() {
      menyimpanForm.value = true;
      try {
        const dataUpdate = {
          nama: form.nama, name: form.nama, nik: form.nik, gender: form.jk,
          tempatLahir: form.tempatLahir, tglLahir: form.tglLahir, hp: form.hp,
          ktpKab: form.ktpKab, ktpKec: form.ktpKec, ktpDetail: form.ktpDetail,
          tinggalKab: form.domKab, tinggalKec: form.domKec, tinggalDetail: form.domDetail,
          pendidikan: form.pendidikan, sekolah: form.sekolah, jurusan: form.jurusan,
          statusNikah: form.nikah, tanggungan: form.tanggungan,
          daruratNama: form.daruratNama, daruratHub: form.daruratHub, daruratHp: form.daruratHp,
          bank: form.bank, noRek: form.norek, atasNamaRek: form.namarek
        };
        await updateDoc(doc(db, "users", window.currentUser.email), dataUpdate);
        Object.assign(window.currentUser, dataUpdate);
        alert("Seluruh pembaruan data diri Anda berhasil disimpan secara sistem!");
      } catch (e) {
        console.error(e);
        alert("Gagal memperbarui data. Pastikan koneksi internet stabil.");
      }
      menyimpanForm.value = false;
    }

    // ---- Absensi: Pengajuan Izin/Cuti/Lembur ----
    const formTerbuka = ref(null); // 'izin' | 'cuti' | 'lembur' | null
    const opsiAlasanIzin = ref([]);
    const opsiAlasanCuti = ref([]);
    const izin = reactive({ tanggal: '', alasan: '', detail: '' });
    const cuti = reactive({ tanggal: '', alasan: '', detail: '' });
    const lembur = reactive({ mulai: '', selesai: '', alasan: '', instruksi: '' });

    async function bukaFormIzin() {
      formTerbuka.value = 'izin';
      if (opsiAlasanIzin.value.length === 0 && window.ambilMasterList) {
        opsiAlasanIzin.value = await window.ambilMasterList('alasan_izin');
      }
    }
    function tutupFormIzin() { formTerbuka.value = null; izin.tanggal = ''; izin.alasan = ''; izin.detail = ''; }
    function ajukanIzin() {
      if (!izin.tanggal || !izin.alasan) return alert("Harap isi Tanggal dan pilih Alasan Izin!");
      const keterangan = izin.detail.trim() ? `${izin.alasan} - ${izin.detail.trim()}` : izin.alasan;
      window.statusPilihanGlobal = "IZIN";
      window.tanggalIzinGlobal = izin.tanggal;
      window.keteranganIzinGlobal = keterangan;
      tutupFormIzin();
      // Label diatur otomatis oleh vue-camera.js (modeLabel).
      window.pindahLayar('screen-camera');
    }

    async function bukaFormCuti() {
      formTerbuka.value = 'cuti';
      if (opsiAlasanCuti.value.length === 0 && window.ambilMasterList) {
        opsiAlasanCuti.value = await window.ambilMasterList('alasan_cuti');
      }
    }
    function tutupFormCuti() { formTerbuka.value = null; cuti.tanggal = ''; cuti.alasan = ''; cuti.detail = ''; }
    function ajukanCuti() {
      if (!cuti.tanggal || !cuti.alasan) return alert("Harap isi Tanggal dan pilih Alasan Cuti!");
      const tglPilih = new Date(cuti.tanggal);
      const tglSekarang = new Date();
      tglSekarang.setHours(0, 0, 0, 0);
      const selisihHari = (tglPilih - tglSekarang) / (1000 * 60 * 60 * 24);
      if (selisihHari < 3) return alert("Pengajuan Cuti minimal H-3 dari tanggal hari ini!");

      const keterangan = cuti.detail.trim() ? `${cuti.alasan} - ${cuti.detail.trim()}` : cuti.alasan;
      window.statusPilihanGlobal = "CUTI";
      window.tanggalIzinGlobal = cuti.tanggal;
      window.keteranganIzinGlobal = keterangan;
      tutupFormCuti();
      // Label diatur otomatis oleh vue-camera.js (modeLabel).
      window.pindahLayar('screen-camera');
    }

    function bukaFormLembur() { formTerbuka.value = 'lembur'; }
    function tutupFormLembur() { formTerbuka.value = null; lembur.mulai = ''; lembur.selesai = ''; lembur.alasan = ''; lembur.instruksi = ''; }
    function ajukanLembur() {
      if (!lembur.mulai || !lembur.alasan) return alert("Harap isi minimal Waktu Mulai Lembur dan Alasan!");
      window.statusPilihanGlobal = "LEMBUR (CLOCK IN)";
      window.lemburMulaiGlobal = lembur.mulai;
      window.lemburSelesaiGlobal = lembur.selesai;
      window.lemburAlasanGlobal = lembur.alasan;
      window.lemburInstruksiGlobal = lembur.instruksi;
      tutupFormLembur();
      // Label diatur otomatis oleh vue-camera.js (modeLabel).
      window.pindahLayar('screen-camera');
    }

    // ---- Absensi: Filter, Statistik, Riwayat ----
    const filterTglMulai = ref('');
    const filterTglSelesai = ref('');
    const filterGudang = ref('ALL');
    const filterShift = ref('ALL');
    const filterStatusKehadiran = ref('ALL');
    const opsiGudangFilter = ref([]);
    const opsiShiftFilter = ref([]);
    const opsiStatusKehadiranFilter = ref([]);

    const stat = reactive({ hadir: 0, acc: 0, seragamBeda: 0, izin: 0 });
    const listRiwayat = ref([]);
    const memuatRiwayat = ref(true);
    const docIdSedangDibanding = ref(null);

    async function muatOpsiFilter() {
      const qGudang = await getDocs(collection(db, "master_gudang"));
      opsiGudangFilter.value = [];
      qGudang.forEach(d => opsiGudangFilter.value.push(d.data().nama_gudang));

      const qShift = await getDocs(collection(db, "master_shift"));
      opsiShiftFilter.value = [];
      qShift.forEach(d => opsiShiftFilter.value.push(d.data().nama_shift));

      opsiStatusKehadiranFilter.value = window.ambilMasterList ? await window.ambilMasterList('status_kehadiran') : ["Ontime", "Terlambat", "Tidak Absen"];
    }

    async function muatRiwayat() {
      memuatRiwayat.value = true;
      try {
        // PERBAIKAN HEMAT PALING PENTING: dulu ambil SELURUH koleksi
        // "absensi" (punya SEMUA orang) baru difilter cari punya sendiri
        // di JavaScript — dipakai oleh SEMUA karyawan (bukan cuma admin),
        // jadi ini paling boros dan MAKIN MAHAL tiap hari seiring absensi
        // menumpuk. Sekarang query where(email==...) di Firestore sendiri
        // — cuma dokumen milik orang ini yang benar-benar ditarik dari
        // server, siapapun banyaknya karyawan lain / berapa lama app ini
        // sudah jalan.
        const q = query(collection(db, "absensi"), where("email", "==", window.currentUser.email));
        const snap = await getDocs(q);
        let countHadir = 0, countACC = 0, countSeragamBeda = 0, countIzin = 0;
        const list = [];

        snap.forEach(docSnap => {
          const data = docSnap.data();
          data.id = docSnap.id;
          const f = formatBaris(data); // seragamkan format lama/baru — lihat vue-riwayat-absensi.js

          // Waktu buat filter tanggal & sortir: pakai yang PALING AKHIR
          // terjadi (keluar kalau ada, jatuh-aman ke masuk).
          const waktuAcuan = f.waktuKeluar || f.waktuMasuk;
          let lolosTgl = true;
          if (waktuAcuan) {
            const w = window.parseWaktuIndo(waktuAcuan);
            if (w) {
              const tglData = `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, '0')}-${String(w.getDate()).padStart(2, '0')}`;
              if (filterTglMulai.value && tglData < filterTglMulai.value) lolosTgl = false;
              if (filterTglSelesai.value && tglData > filterTglSelesai.value) lolosTgl = false;
            }
          }
          const lolosGudang = (filterGudang.value === 'ALL' || data.gudang === filterGudang.value);
          const lolosShift = (filterShift.value === 'ALL' || data.shift === filterShift.value);
          const lolosStatusKehadiran = (filterStatusKehadiran.value === 'ALL' || f.statusKehadiranMasuk === filterStatusKehadiran.value || f.statusKehadiranKeluar === filterStatusKehadiran.value);
          if (!lolosTgl || !lolosGudang || !lolosShift || !lolosStatusKehadiran) return;

          list.push(data);
          if (data.status === "HADIR" || data.status === "HADIR (CLOCK IN)") countHadir++;
          else countIzin++;
          if (f.statusAccMasuk === "ACC" || f.statusAccKeluar === "ACC") countACC++;
          if (f.seragamMasuk === "Tidak Sesuai" || f.seragamKeluar === "Tidak Sesuai") countSeragamBeda++;
        });

        stat.hadir = countHadir; stat.acc = countACC; stat.seragamBeda = countSeragamBeda; stat.izin = countIzin;

        list.sort((a, b) => {
          const fa = formatBaris(a), fb = formatBaris(b);
          const wa = fa.waktuKeluar || fa.waktuMasuk, wb = fb.waktuKeluar || fb.waktuMasuk;
          return (window.parseWaktuIndo(wb)?.getTime() || 0) - (window.parseWaktuIndo(wa)?.getTime() || 0);
        });
        listRiwayat.value = list;
        window.dataRiwayatGlobal = list; // dipakai bareng window.exportKeCSV
      } catch (e) {
        console.error("Error muat riwayat personal:", e);
      }
      memuatRiwayat.value = false;
    }

    function pisahTanggalWaktu(waktu) {
      const [tgl, jam] = (waktu || '-, -').split(', ');
      return { tgl, jam };
    }
    function lihatFotoBesar(url) {
      if (url && window.bukaPreviewFoto) window.bukaPreviewFoto(url);
    }
    function bolehBanding(item) {
      const f = formatBaris(item);
      return (f.statusAccMasuk === "REJECT" || f.statusAccKeluar === "REJECT" || f.seragamMasuk === "Tidak Sesuai" || f.seragamKeluar === "Tidak Sesuai");
    }
    function bukaBanding(docId) { docIdSedangDibanding.value = docId; }
    function tutupBanding() { docIdSedangDibanding.value = null; }
    async function selesaiBanding() { docIdSedangDibanding.value = null; await muatRiwayat(); }

    function exportCSV() {
      if (window.exportKeCSV) window.exportKeCSV();
    }

    // ---- Navigasi antar sub-tab ----
    function pindahTab(nama) {
      tabAktif.value = nama;
      muatAccountDisplay(); // selalu refresh — murah (baca objek lokal, tanpa network)
      if (nama === 'datadiri') muatFormDariCurrentUser();
      if (nama === 'absensi' && listRiwayat.value.length === 0) muatRiwayat();
    }

    // DIPERBAIKI (23 Agt 2026, bug ditemukan Hilman: QR yang di-generate
    // dari mobile tidak bisa di-scan padahal dari desktop aman — lihat
    // STATUS-PROYEK.md §19.6) — SEBELUMNYA muatAccountDisplay() (yang
    // mengisi idAppTampil & qrUrl, sumber QR yang ditampilkan) dipanggil
    // LANGSUNG di sini begitu komponen mount, TANPA cek window.currentUser
    // sudah terisi atau belum. Pola ini PERSIS yang sudah dibongkar di
    // §19.2/§19.5 (window.authReady TIDAK menjamin window.currentUser
    // sudah lengkap data Firestore, dua hal beda — lihat §10 poin 4).
    // Kalau mount terjadi SEBELUM window.currentUser terisi (device/
    // jaringan tertentu lebih lambat resolve auth-nya, makanya mobile
    // lebih sering kena daripada desktop — timing-dependent, bukan
    // deterministik), QR ke-generate dari data KOSONG/sebelumnya. Karena
    // 'account' adalah sub-tab AKTIF DEFAULT (tabAktif='account'), user
    // yang buka Profile lewat drawer (bukan klik sub-tab manual) TIDAK
    // PERNAH memicu pindahTab('account') buat refresh ulang — QR yang
    // salah itu bisa terus tampil sampai user pindah sub-tab lalu balik
    // lagi. Perbaikannya: SAMA seperti vue-home.js — di sini CUMA muat
    // kalau window.currentUser SUDAH ada isinya; kalau belum, JANGAN muat
    // apapun, biarkan window.refreshAccountProfileDisplay() (bridge yang
    // sudah benar, dipanggil dari auth.js/vue-login.js TEPAT setelah
    // currentUser lengkap) yang mengisi qrUrl/idAppTampil dengan data
    // yang benar.
    onMounted(async () => {
      if (window.currentUser && window.currentUser.email) {
        muatAccountDisplay();
        muatStatusPin();
      }
      if (window.mulaiHitungJamKerja) window.mulaiHitungJamKerja();
      await window.authReady;
      await muatOpsiFilter();
      await muatRiwayat();
    });

    return {
      tabAktif, pindahTab, muatAccountDisplay, muatStatusPin,
      namaTampil, idAppTampil, jabatanTampil, qrUrl, clockOut, keluar,
      passwordLama, passwordBaruKeamanan, menyimpanPasswordKeamanan, updatePasswordKeamanan,
      subTabKeamanan, pinStatusTerpasang, pinBaru, konfirmasiPin, passwordUntukPin, menyimpanPin, simpanPin,
      form, menyimpanForm, simpanDataDiri,
      formTerbuka, opsiAlasanIzin, opsiAlasanCuti, izin, cuti, lembur,
      bukaFormIzin, tutupFormIzin, ajukanIzin,
      bukaFormCuti, tutupFormCuti, ajukanCuti,
      bukaFormLembur, tutupFormLembur, ajukanLembur,
      filterTglMulai, filterTglSelesai, filterGudang, filterShift, filterStatusKehadiran, opsiGudangFilter, opsiShiftFilter, opsiStatusKehadiranFilter,
      stat, listRiwayat, memuatRiwayat, muatRiwayat, exportCSV,
      pisahTanggalWaktu, lihatFotoBesar, bolehBanding, formatBaris,
      docIdSedangDibanding, bukaBanding, tutupBanding, selesaiBanding
    };
  },
  template: `
    <div class="gc-card hidden md:block">
      <div>
        <h2 class="gc-heading" style="font-size:16.5px; font-weight:700; display:flex; align-items:center;"><i class="fas fa-user-circle" style="color:var(--burgundy); margin-right:10px;"></i> Profile</h2>
      </div>
      <div style="display:flex; align-items:center; gap:8px; border-top:1px solid var(--line); padding-top:14px; margin-top:14px; overflow-x:auto;" class="hide-scrollbar">
        <button @click="pindahTab('account')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'account' }" style="border-radius:16px;">
          <i class="fas fa-qrcode" style="margin-right:6px;"></i> Account
        </button>
        <button @click="pindahTab('datadiri')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'datadiri' }" style="border-radius:16px;">
          <i class="fas fa-user-edit" style="margin-right:6px;"></i> Data Karyawan
        </button>
        <button @click="pindahTab('absensi')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'absensi' }" style="border-radius:16px;">
          <i class="fas fa-history" style="margin-right:6px;"></i> Absensi
        </button>
        <button @click="pindahTab('reimburse')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'reimburse' }" style="border-radius:16px;">
          <i class="fas fa-receipt" style="margin-right:6px;"></i> Reimburse
        </button>
        <button @click="pindahTab('pencapaian')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'pencapaian' }" style="border-radius:16px;">
          <i class="fas fa-trophy" style="margin-right:6px;"></i> Pencapaian
        </button>
        <button @click="pindahTab('keamanan')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'keamanan' }" style="border-radius:16px;">
          <i class="fas fa-key" style="margin-right:6px;"></i> Keamanan
        </button>
      </div>
    </div>

    <!-- Tab: Account -->
    <div v-show="tabAktif === 'account'" style="margin-top:16px;">
      <div class="gc-card" style="display:flex; flex-direction:column; align-items:center; text-align:center; max-width:380px; margin:0 auto;">
        <div style="width:130px; height:130px; padding:8px; background:var(--ivory-dim); border-radius:18px; border:2px dashed var(--pink-deep);">
          <img :src="qrUrl" alt="QR Code" style="width:100%; height:100%; object-fit:contain;">
        </div>
        <div style="margin-top:14px;">
          <h2 class="gc-heading" style="font-size:19px; font-weight:700;">{{ namaTampil }}</h2>
          <p style="font-size:13px; font-weight:700; color:var(--burgundy); font-family:'Poppins',sans-serif; margin-top:4px;">{{ idAppTampil }}</p>
          <span class="tag ok" style="margin-top:8px;">{{ jabatanTampil }}</span>
        </div>
        <p style="font-size:10.5px; color:var(--text-faint); max-width:200px; line-height:1.6; margin-top:10px;">Tunjukkan QR ini saat melakukan absensi fisik atau verifikasi proses SPK.</p>
      </div>
      <div class="gc-card" style="max-width:380px; margin:14px auto 0;">
        <p style="font-size:11px; color:var(--text-muted); text-align:center;">Clock Out dan pengajuan Izin/Cuti/Lembur sekarang ada di tab <b>Absensi</b>.</p>
      </div>

      <div class="md:hidden" style="max-width:380px; margin:14px auto 0;">
        <button @click="keluar" class="btn-outline block" style="color:var(--danger); border-color:var(--danger);">
          <i class="fas fa-sign-out-alt" style="margin-right:8px;"></i> Logout
        </button>
      </div>
    </div>

    <!-- Tab: Data Karyawan -->
    <div v-show="tabAktif === 'datadiri'" class="max-w-4xl mx-auto w-full" style="margin-top:16px;">
      <div class="gc-card" style="font-size:12.5px;">
        <div style="display:flex; align-items:center; border-bottom:1px solid var(--line); padding-bottom:14px; margin-bottom:18px;">
          <i class="fas fa-user-edit" style="color:var(--burgundy); font-size:20px; margin-right:12px;"></i>
          <div>
            <h3 class="gc-heading" style="font-weight:700; font-size:14px;">Lengkapi / Perbarui Data Diri</h3>
            <p style="font-size:10.5px; color:var(--text-muted); margin-top:2px;">Pastikan seluruh data selaras dengan identitas KTP dan data pendaftaran awal.</p>
          </div>
        </div>

        <div style="background:var(--ivory-dim); padding:16px; border-radius:16px; margin-bottom:16px;">
          <h4 style="font-weight:700; color:var(--text); margin-bottom:12px; border-bottom:1px solid var(--line); padding-bottom:6px;">1. Identitas Pribadi</h4>
          <div style="gap:14px;" class="grid grid-cols-1 md:grid-cols-3">
            <div class="gc-field" style="margin-bottom:0;"><label>Nama Lengkap (Sesuai KTP)</label><input v-model="form.nama" type="text"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>NIK</label><input v-model="form.nik" type="text"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Jenis Kelamin</label><select v-model="form.jk"><option value="">-- Pilih --</option><option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option></select></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Tempat Lahir</label><input v-model="form.tempatLahir" type="text"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Tanggal Lahir</label><input v-model="form.tglLahir" type="date"></div>
          </div>
        </div>

        <div style="background:var(--ivory-dim); padding:16px; border-radius:16px; margin-bottom:16px;">
          <h4 style="font-weight:700; color:var(--text); margin-bottom:12px; border-bottom:1px solid var(--line); padding-bottom:6px;">2. Informasi Kontak</h4>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
            <div class="gc-field" style="margin-bottom:0;"><label>No. Handphone (WhatsApp)</label><input v-model="form.hp" type="text"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Email Aktif (Identitas Login)</label><input :value="form.email" disabled style="background:var(--ivory-dim); color:var(--text-faint); cursor:not-allowed;" title="Hubungi Admin untuk ubah Email"></div>
          </div>
        </div>

        <div style="background:var(--ivory-dim); padding:16px; border-radius:16px; margin-bottom:16px;">
          <h4 style="font-weight:700; color:var(--text); margin-bottom:12px; border-bottom:1px solid var(--line); padding-bottom:6px;">3. Alamat Lengkap</h4>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            <div>
              <label style="display:block; font-weight:700; color:var(--burgundy); margin-bottom:8px;">A. Alamat Sesuai KTP</label>
              <div class="gc-field"><label>Kabupaten/Kota</label><input v-model="form.ktpKab" type="text"></div>
              <div class="gc-field"><label>Kecamatan</label><input v-model="form.ktpKec" type="text"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Alamat Detail (Jalan/RT/RW)</label><textarea v-model="form.ktpDetail" rows="2"></textarea></div>
            </div>
            <div>
              <label style="display:block; font-weight:700; color:var(--ok); margin-bottom:8px;">B. Alamat Domisili Saat Ini</label>
              <div class="gc-field"><label>Kabupaten/Kota</label><input v-model="form.domKab" type="text"></div>
              <div class="gc-field"><label>Kecamatan</label><input v-model="form.domKec" type="text"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Alamat Detail (Jalan/RT/RW)</label><textarea v-model="form.domDetail" rows="2"></textarea></div>
            </div>
          </div>
        </div>

        <div style="background:var(--ivory-dim); padding:16px; border-radius:16px; margin-bottom:16px;">
          <h4 style="font-weight:700; color:var(--text); margin-bottom:12px; border-bottom:1px solid var(--line); padding-bottom:6px;">4. Latar Belakang & Keluarga</h4>
          <div style="gap:14px;" class="grid grid-cols-1 md:grid-cols-3">
            <div class="gc-field" style="margin-bottom:0;"><label>Pendidikan Terakhir</label><select v-model="form.pendidikan"><option value="">-- Pilih --</option><option value="SD">SD</option><option value="SMP">SMP</option><option value="SMA/SMK">SMA/SMK</option><option value="D3">D3</option><option value="S1">S1</option><option value="S2">S2</option></select></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Nama Sekolah / Kampus</label><input v-model="form.sekolah" type="text"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Jurusan</label><input v-model="form.jurusan" type="text"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Status Pernikahan</label><select v-model="form.nikah"><option value="">-- Pilih --</option><option value="Belum Menikah">Belum Menikah</option><option value="Menikah">Menikah</option><option value="Cerai">Cerai</option></select></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Jumlah Tanggungan (Orang)</label><input v-model="form.tanggungan" type="number" min="0"></div>
          </div>
        </div>

        <div style="background:var(--ivory-dim); padding:16px; border-radius:16px; margin-bottom:16px;">
          <h4 style="font-weight:700; color:var(--text); margin-bottom:12px; border-bottom:1px solid var(--line); padding-bottom:6px;">5. Kontak Darurat</h4>
          <div style="gap:14px;" class="grid grid-cols-1 md:grid-cols-3">
            <div class="gc-field" style="margin-bottom:0;"><label>Nama Kontak Darurat</label><input v-model="form.daruratNama" type="text"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Hubungan</label><input v-model="form.daruratHub" type="text" placeholder="Ibu / Ayah / Suami / dll"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>No. HP Darurat</label><input v-model="form.daruratHp" type="text"></div>
          </div>
        </div>

        <div style="background:var(--ivory-dim); padding:16px; border-radius:16px; margin-bottom:18px;">
          <h4 style="font-weight:700; color:var(--text); margin-bottom:12px; border-bottom:1px solid var(--line); padding-bottom:6px;">6. Data Rekening Bank</h4>
          <div style="gap:14px;" class="grid grid-cols-1 md:grid-cols-3">
            <div class="gc-field" style="margin-bottom:0;"><label>Nama Bank</label><input v-model="form.bank" type="text" placeholder="BCA / Mandiri / BRI / dll"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>No. Rekening</label><input v-model="form.norek" type="text"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Atas Nama Rekening</label><input v-model="form.namarek" type="text"></div>
          </div>
        </div>

        <button @click="simpanDataDiri" :disabled="menyimpanForm" class="btn-primary block">
          <i class="fas fa-save" style="margin-right:8px;"></i> {{ menyimpanForm ? 'Menyimpan...' : 'Simpan Seluruh Pembaruan Data' }}
        </button>
      </div>
    </div>

    <!-- Tab: Absensi -->
    <div v-show="tabAktif === 'absensi'" style="margin-top:16px;">
      <div class="gc-card" style="max-width:520px; margin:0 auto 14px;">
        <h3 style="font-size:11.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:12px;">Pengajuan</h3>
        <button @click="clockOut" class="btn-primary block" style="background:var(--danger); padding:12px; margin-bottom:12px;">
          <i class="fas fa-sign-out-alt" style="margin-right:8px;"></i> Clock Out (Pulang)
        </button>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px;">
          <button @click="bukaFormIzin" style="background:var(--warn-light); color:var(--warn); font-weight:700; padding:10px; border-radius:14px; font-size:12px; display:flex; flex-direction:column; align-items:center; gap:4px; border:1px solid #EAD7B0; cursor:pointer;">
            <i class="fas fa-file-signature"></i> Izin
          </button>
          <button @click="bukaFormCuti" style="background:var(--blue); color:#1F5060; font-weight:700; padding:10px; border-radius:14px; font-size:12px; display:flex; flex-direction:column; align-items:center; gap:4px; border:none; cursor:pointer;">
            <i class="fas fa-calendar-alt"></i> Cuti
          </button>
          <button @click="bukaFormLembur" style="background:var(--pink); color:var(--burgundy-dark); font-weight:700; padding:10px; border-radius:14px; font-size:12px; display:flex; flex-direction:column; align-items:center; gap:4px; border:none; cursor:pointer;">
            <i class="fas fa-business-time"></i> Lembur
          </button>
        </div>
      </div>

      <div v-if="formTerbuka === 'izin'" class="gc-card" style="max-width:520px; margin:0 auto 14px;">
        <h3 style="font-size:11.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:12px;">Form Pengajuan Izin (Hari H)</h3>
        <div class="gc-field"><label>Tanggal</label><input v-model="izin.tanggal" type="date"></div>
        <div class="gc-field"><label>Alasan</label><select v-model="izin.alasan"><option value="">-- Pilih --</option><option v-for="a in opsiAlasanIzin" :key="a" :value="a">{{ a }}</option></select></div>
        <div class="gc-field"><label>Detail Tambahan (opsional)</label><textarea v-model="izin.detail" rows="2"></textarea></div>
        <div style="display:flex; gap:8px;">
          <button @click="tutupFormIzin" class="btn-outline" style="flex:1;">Batal</button>
          <button @click="ajukanIzin" class="btn-primary" style="flex:1; background:var(--warn);">Lanjut Foto</button>
        </div>
      </div>

      <div v-if="formTerbuka === 'cuti'" class="gc-card" style="max-width:520px; margin:0 auto 14px;">
        <h3 style="font-size:11.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:12px;">Form Pengajuan Cuti (Minimal H-3)</h3>
        <div class="gc-field"><label>Tanggal Cuti</label><input v-model="cuti.tanggal" type="date"></div>
        <div class="gc-field"><label>Alasan</label><select v-model="cuti.alasan"><option value="">-- Pilih --</option><option v-for="a in opsiAlasanCuti" :key="a" :value="a">{{ a }}</option></select></div>
        <div class="gc-field"><label>Detail Tambahan (opsional)</label><textarea v-model="cuti.detail" rows="2"></textarea></div>
        <div style="display:flex; gap:8px;">
          <button @click="tutupFormCuti" class="btn-outline" style="flex:1;">Batal</button>
          <button @click="ajukanCuti" class="btn-primary" style="flex:1;">Lanjut Foto</button>
        </div>
      </div>

      <div v-if="formTerbuka === 'lembur'" class="gc-card" style="max-width:520px; margin:0 auto 14px;">
        <h3 style="font-size:11.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:12px;">Form Pengajuan Jam Lembur</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div class="gc-field"><label>Mulai Lembur</label><input v-model="lembur.mulai" type="datetime-local"></div>
          <div class="gc-field"><label>Selesai (perkiraan)</label><input v-model="lembur.selesai" type="datetime-local"></div>
        </div>
        <div class="gc-field"><label>Alasan Lembur</label><textarea v-model="lembur.alasan" rows="2" placeholder="Kenapa perlu lembur..."></textarea></div>
        <div class="gc-field"><label>Instruksi / Tugas yang Dikerjakan</label><textarea v-model="lembur.instruksi" rows="2" placeholder="Instruksi dari atasan / tugas yang dikerjakan..."></textarea></div>
        <div style="display:flex; gap:8px;">
          <button @click="tutupFormLembur" class="btn-outline" style="flex:1;">Batal</button>
          <button @click="ajukanLembur" class="btn-primary" style="flex:1; background:#6B4FA0;">Clock In Lembur (Foto)</button>
        </div>
      </div>

      <div class="gc-card md:flex-row md:items-center md:justify-between" style="display:flex; flex-direction:column; gap:10px; margin-bottom:14px;">
        <div>
          <h3 class="gc-heading" style="font-size:14px; font-weight:700; display:flex; align-items:center;"><i class="fas fa-file-invoice" style="color:var(--burgundy); margin-right:8px;"></i> Laporan Riwayat & Rekapitulasi Absensi</h3>
          <p style="font-size:11px; color:var(--text-muted); margin-top:3px;">Filter laporan kehadiran, pantau statistik, dan unduh file rekapitulasi.</p>
        </div>
        <button @click="exportCSV" class="btn-outline filled" style="display:flex; align-items:center; justify-content:center; gap:8px;">
          <i class="fas fa-file-excel"></i><span>Export Laporan CSV</span>
        </button>
      </div>

      <div class="gc-card" style="font-size:12px; margin-bottom:14px;">
        <h4 style="font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:12px;"><i class="fas fa-filter" style="margin-right:6px;"></i> Filter Parameter Laporan</h4>
        <div style="gap:12px;" class="grid grid-cols-2 md:grid-cols-5">
          <div class="gc-field" style="margin-bottom:0;"><label>Dari Tanggal</label><input v-model="filterTglMulai" type="date"></div>
          <div class="gc-field" style="margin-bottom:0;"><label>Sampai Tanggal</label><input v-model="filterTglSelesai" type="date"></div>
          <div class="gc-field" style="margin-bottom:0;"><label>Filter Gudang</label><select v-model="filterGudang"><option value="ALL">Semua Gudang</option><option v-for="g in opsiGudangFilter" :key="g" :value="g">{{ g }}</option></select></div>
          <div class="gc-field" style="margin-bottom:0;"><label>Filter Shift</label><select v-model="filterShift"><option value="ALL">Semua Shift</option><option v-for="s in opsiShiftFilter" :key="s" :value="s">{{ s }}</option></select></div>
          <div class="gc-field" style="margin-bottom:0;"><label>Status Kehadiran</label><select v-model="filterStatusKehadiran"><option value="ALL">Semua Status</option><option v-for="s in opsiStatusKehadiranFilter" :key="s" :value="s">{{ s }}</option></select></div>
        </div>
        <div style="display:flex; justify-content:flex-end; padding-top:10px;">
          <button @click="muatRiwayat" class="btn-primary" style="display:flex; align-items:center; gap:8px;">
            <i class="fas fa-search"></i><span>Tampilkan Laporan</span>
          </button>
        </div>
      </div>

      <div style="gap:12px; margin-bottom:14px;" class="grid grid-cols-2 md:grid-cols-4">
        <div class="kpi"><div class="label">Total Hadir</div><div class="val" style="color:var(--ok); font-size:19px;">{{ stat.hadir }}</div></div>
        <div class="kpi"><div class="label">ACC Valid</div><div class="val" style="color:var(--burgundy); font-size:19px;">{{ stat.acc }}</div></div>
        <div class="kpi"><div class="label">Seragam Beda</div><div class="val" style="color:var(--warn); font-size:19px;">{{ stat.seragamBeda }}</div></div>
        <div class="kpi"><div class="label">Izin/Cuti/Tolak</div><div class="val" style="color:var(--danger); font-size:19px;">{{ stat.izin }}</div></div>
      </div>

      <div v-if="memuatRiwayat" style="text-align:center; padding:40px 0; color:var(--text-faint); font-size:12px;"><i class="fas fa-spinner fa-spin" style="font-size:24px; margin-bottom:8px; display:block;"></i>Memuat laporan absensi Anda...</div>
      <div v-else-if="listRiwayat.length === 0" style="text-align:center; padding:40px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px; color:var(--text-faint); font-size:12px;"><i class="fas fa-folder-open" style="font-size:28px; margin-bottom:10px; display:block; color:var(--text-faint);"></i>Belum ada riwayat absensi yang tercatat untuk Anda.</div>
      <div v-else class="gc-table-scroll" style="background:var(--surface); border:1px solid var(--line);">
        <table class="gc-table">
          <thead>
            <tr>
              <th>Persetujuan / Tipe Absen</th>
              <th>Nama / No HP</th>
              <th>Gudang / Shift</th>
              <th>Tanggal / Waktu</th>
              <th>Foto</th>
              <th>Status Kehadiran / Seragam</th>
              <th>Sanggahan Karyawan</th>
              <th>Status Aju Banding</th>
              <th class="freeze freeze-right">Aksi Aju Banding</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in listRiwayat" :key="item.id">
              <td>
                <b>
                  <span v-if="formatBaris(item).statusAccMasuk === 'ACC'" style="color:var(--ok);">Masuk: ACC</span>
                  <span v-else-if="formatBaris(item).statusAccMasuk === 'REJECT'" style="color:var(--danger);">Masuk: REJECT</span>
                  <span v-else-if="formatBaris(item).statusAccMasuk === 'PENDING'" style="color:var(--warn);">Masuk: PENDING</span>
                </b>
                <br v-if="formatBaris(item).statusAccMasuk && formatBaris(item).statusAccKeluar">
                <b>
                  <span v-if="formatBaris(item).statusAccKeluar === 'ACC'" style="color:var(--ok);">Keluar: ACC</span>
                  <span v-else-if="formatBaris(item).statusAccKeluar === 'REJECT'" style="color:var(--danger);">Keluar: REJECT</span>
                  <span v-else-if="formatBaris(item).statusAccKeluar === 'PENDING'" style="color:var(--warn);">Keluar: PENDING</span>
                </b>
                <br><span style="font-size:10.5px; color:var(--text-muted); font-weight:400;">{{ item.status || 'HADIR' }}</span>
              </td>
              <td><dua-baris :a="item.nama_pegawai || item.nama" :b="form.hp" /></td>
              <td><dua-baris :a="item.gudang" :b="item.shift" /></td>
              <td><dua-baris :a="pisahTanggalWaktu(formatBaris(item).waktuKeluar || formatBaris(item).waktuMasuk).tgl" :b="pisahTanggalWaktu(formatBaris(item).waktuKeluar || formatBaris(item).waktuMasuk).jam" /></td>
              <td>
                <img v-if="formatBaris(item).fotoMasuk || formatBaris(item).fotoKeluar" :src="formatBaris(item).fotoKeluar || formatBaris(item).fotoMasuk" @click="lihatFotoBesar(formatBaris(item).fotoKeluar || formatBaris(item).fotoMasuk)" style="width:40px; height:40px; border-radius:10px; object-fit:cover; border:1px solid var(--line); cursor:pointer;">
                <span v-else style="color:var(--text-faint);">-</span>
              </td>
              <td><dua-baris :a="formatBaris(item).statusKehadiranMasuk || formatBaris(item).statusKehadiranKeluar" :b="formatBaris(item).seragamMasuk || formatBaris(item).seragamKeluar || 'Sesuai'" /></td>
              <td class="gc-cell-muted" style="max-width:150px; overflow:hidden; text-overflow:ellipsis;" :title="item.catatan_banding || ''">{{ item.catatan_banding || '-' }}</td>
              <td style="text-align:center;">
                <span v-if="item.catatan_banding" class="tag warn">Sudah Diajukan</span>
                <span v-else style="color:var(--text-faint);">-</span>
              </td>
              <td class="freeze freeze-right">
                <span v-if="item.catatan_banding" style="font-size:10.5px; color:var(--text-muted);"><i class="fas fa-check" style="color:var(--ok); margin-right:4px;"></i>Terkirim</span>
                <button v-else-if="bolehBanding(item)" @click="bukaBanding(item.id)" class="btn-outline" style="padding:6px 12px; font-size:10.5px; white-space:nowrap;"><i class="fas fa-gavel" style="margin-right:4px;"></i>Aju Banding</button>
                <span v-else style="color:var(--text-faint); font-size:10.5px;">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab: Reimburse -->
    <div v-show="tabAktif === 'reimburse'" style="margin-top:16px;">
      <ajukan-reimburse-tab v-if="tabAktif === 'reimburse'" />
    </div>

    <!-- Tab: Pencapaian -->
    <div v-show="tabAktif === 'pencapaian'" style="margin-top:16px;">
      <div class="gc-card" style="text-align:center; padding:44px 20px; color:var(--text-muted);">
        <i class="fas fa-trophy" style="font-size:34px; color:#E0B84A; margin-bottom:12px; display:block;"></i>
        <h3 class="gc-heading" style="font-weight:700; font-size:14px; color:var(--text);">Modul Pencapaian & Penilaian SPK</h3>
        <p style="font-size:12px; margin-top:4px;">Sedang dalam pengembangan operasional.</p>
      </div>
    </div>

    <!-- Tab: Estimasi Gaji -->
    <div v-show="tabAktif === 'gaji'" style="margin-top:16px;">
      <div class="gc-card" style="text-align:center; padding:44px 20px; color:var(--text-muted);">
        <i class="fas fa-sack-dollar" style="font-size:34px; color:var(--ok); margin-bottom:12px; display:block;"></i>
        <h3 class="gc-heading" style="font-weight:700; font-size:14px; color:var(--text);">Modul Estimasi Gaji</h3>
        <p style="font-size:12px; margin-top:4px;">Akan datang pada pembaruan finansial berikutnya.</p>
      </div>
    </div>

    <!-- Tab: Keamanan -->
    <div v-show="tabAktif === 'keamanan'" class="max-w-md mx-auto w-full" style="margin-top:16px;">
      <div style="display:flex; gap:6px; margin-bottom:14px;">
        <button @click="subTabKeamanan = 'password'" class="gc-sub-tab-btn" :class="{ active: subTabKeamanan === 'password' }" style="flex:1;">Password</button>
        <button @click="subTabKeamanan = 'pin'" class="gc-sub-tab-btn" :class="{ active: subTabKeamanan === 'pin' }" style="flex:1;">
          PIN <span class="tag" :class="pinStatusTerpasang ? 'ok' : 'warn'" style="margin-left:6px; font-size:9px;">{{ pinStatusTerpasang ? 'Terpasang' : 'Belum' }}</span>
        </button>
      </div>

      <div v-if="subTabKeamanan === 'password'" class="gc-card" style="font-size:12.5px;">
        <h3 style="font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:14px;"><i class="fas fa-shield-alt" style="color:var(--danger); margin-right:8px;"></i> Update Password</h3>
        <p style="font-size:10.5px; color:var(--text-muted); margin-bottom:14px;">Ubah kata sandi Anda secara berkala untuk menjaga keamanan akun.</p>
        <div class="gc-field"><label>Password Lama</label><input v-model="passwordLama" type="password"></div>
        <div class="gc-field"><label>Password Baru (min. 6 karakter)</label><input v-model="passwordBaruKeamanan" type="password"></div>
        <button @click="updatePasswordKeamanan" :disabled="menyimpanPasswordKeamanan" class="btn-primary block" style="background:var(--danger);">{{ menyimpanPasswordKeamanan ? 'Menyimpan...' : 'Update Password' }}</button>
      </div>

      <div v-else class="gc-card" style="font-size:12.5px;">
        <h3 style="font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:14px;"><i class="fas fa-shield-halved" style="color:var(--burgundy); margin-right:8px;"></i> PIN Absensi
          <span class="tag" :class="pinStatusTerpasang ? 'ok' : 'warn'" style="margin-left:8px;">{{ pinStatusTerpasang ? 'Terpasang' : 'Belum Terpasang' }}</span>
        </h3>
        <p style="font-size:10.5px; color:var(--text-muted); margin-bottom:14px;">PIN 6 angka ini dipakai buat "Absensi Melalui QR" — waktu barcode Anda di-scan HP Kiosk gudang, PIN ini yang memastikan bukan orang lain yang absen memakainya.</p>
        <div class="gc-field"><label>PIN Baru (6 angka)</label><input v-model="pinBaru" type="password" inputmode="numeric" maxlength="6" placeholder="••••••"></div>
        <div class="gc-field"><label>Konfirmasi PIN Baru</label><input v-model="konfirmasiPin" type="password" inputmode="numeric" maxlength="6" placeholder="••••••"></div>
        <div class="gc-field"><label>Password Anda (konfirmasi identitas)</label><input v-model="passwordUntukPin" type="password"></div>
        <button @click="simpanPin" :disabled="menyimpanPin" class="btn-primary block">{{ menyimpanPin ? 'Menyimpan...' : (pinStatusTerpasang ? 'Perbarui PIN' : 'Pasang PIN') }}</button>
      </div>
    </div>

    <aju-banding-modal v-if="docIdSedangDibanding" :doc-id="docIdSedangDibanding" @tutup="tutupBanding" @terkirim="selesaiBanding" />
  `
};

const mountPoint = document.getElementById('vue-account-profile');
if (mountPoint) {
  const vm = createApp(AppAccountProfile).mount('#vue-account-profile');
  // Jembatan ke vanilla: dipanggil dari dashboard.js (kirimDataKeCloud) setelah
  // submit Hadir/Izin/Cuti/Lembur berhasil, supaya user langsung diarahkan ke
  // tab Absensi dan lihat pengajuannya (menggantikan window.pindahSubProfile lama).
  window.bukaTabAbsensiProfile = function() {
    vm.pindahTab('absensi');
    vm.muatRiwayat(); // paksa refresh — bukan cuma buka tab — supaya pengajuan yang baru dikirim langsung kelihatan
  };
  // Jembatan ke vanilla: dipanggil dari auth.js (sesi otomatis) & vue-login.js
  // (login manual) TEPAT setelah window.currentUser terisi data asli —
  // supaya nama/ID/jabatan/QR di tab Account tidak "kekunci" kosong/lama
  // (Vue app ini ter-mount di awal load, sebelum login selesai, dan
  // window.currentUser bukan objek reactive jadi tidak ke-track otomatis).
  window.refreshAccountProfileDisplay = function() {
    vm.muatAccountDisplay();
    // DIPERBAIKI (23 Agt 2026) — badge status PIN sempat salah tampil
    // "Belum Terpasang" pas refresh halaman, walau PIN aslinya sudah
    // terpasang & berfungsi normal. ROOT CAUSE SEBENARNYA: window.authReady
    // (dipakai di onMounted komponen ini) cuma nunggu Firebase AUTH tau
    // siapa yang login (cepat) — TIDAK nunggu window.currentUser BENERAN
    // terisi data profil Firestore (termasuk pin_hash). Yang mengisi
    // window.currentUser sungguhan itu proses TERPISAH (sesi-otomatis di
    // auth.js / login manual di vue-login.js, keduanya ASYNC baca cache
    // atau Firestore) — dan proses itu SUDAH memanggil jembatan INI
    // (window.refreshAccountProfileDisplay) TEPAT setelah currentUser
    // benar-benar lengkap (lihat auth.js baris ~516, komentar
    // "Jembatan ke vanilla"). Jadi titik paling benar buat baca ulang
    // status PIN itu DI SINI, bukan di onMounted/authReady. Percobaan
    // fix pertama (taruh muatStatusPin() kedua setelah authReady di
    // onMounted) TERBUKTI TIDAK CUKUP — sudah dilepas lagi, jangan
    // ditambahkan balik. Lihat STATUS-PROYEK.md §19.2 untuk kronologinya.
    vm.muatStatusPin();
  };
  // Jembatan BARU ke layar Home (js/vue-home.js) — pintasan "Izin"/"Cuti"/
  // "Lembur" di Home langsung buka tab Absensi profil INI dan langsung
  // munculkan form yang relevan, tanpa orang harus klik 2 kali (buka
  // Profile dulu, baru klik Absensi, baru klik Izin/dst).
  window.bukaFormIzinDariHome = function() { window.pindahTab('tab-profil'); vm.pindahTab('absensi'); vm.bukaFormIzin(); };
  window.bukaFormCutiDariHome = function() { window.pindahTab('tab-profil'); vm.pindahTab('absensi'); vm.bukaFormCuti(); };
  window.bukaFormLemburDariHome = function() { window.pindahTab('tab-profil'); vm.pindahTab('absensi'); vm.bukaFormLembur(); };
  // Reimburse TIDAK perlu "buka form" terpisah kayak Izin/Cuti/Lembur —
  // form-nya SELALU tampil di atas tab (lihat AjukanReimburseTab di
  // vue-reimburse.js), jadi cukup pindah ke tab-nya saja.
  window.bukaReimburseDariHome = function() { window.pindahTab('tab-profil'); vm.pindahTab('reimburse'); };
  // Jembatan BARU ke drawer Profile mobile (js/vue-profile-drawer.js) —
  // dipakai untuk lompat langsung ke sub-tab manapun (Data Karyawan,
  // Estimasi Gaji, Pencapaian, Keamanan) dari link teks di drawer.
  window.pindahTabAccountProfile = function(nama) { vm.pindahTab(nama); };
}