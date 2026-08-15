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
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DuaBaris } from './vue-components.js';

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
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 fade-in">
      <div class="bg-white w-full max-w-md p-6 rounded-3xl shadow-2xl space-y-4 text-xs max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center border-b pb-3">
          <h3 class="font-bold text-gray-800 text-sm"><i class="fas fa-gavel text-amber-500 mr-1.5"></i> Form Pengajuan Sanggahan / Aju Banding</h3>
          <button @click="$emit('tutup')" class="text-gray-400 hover:text-red-500"><i class="fas fa-times text-base"></i></button>
        </div>
        <p class="text-[11px] text-gray-500">Sampaikan alasan sanggahan Anda kepada Admin / Owner apabila status presensi atau catatan seragam Anda perlu dikoreksi.</p>
        <div>
          <label class="block font-semibold text-gray-600 mb-1">Alasan / Catatan Sanggahan *</label>
          <textarea v-model="alasan" rows="3" placeholder="Jelaskan alasan atau bukti penyesuaian..." class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-amber-500"></textarea>
        </div>
        <div>
          <label class="block font-semibold text-gray-600 mb-1">Lampiran Foto/Video (opsional, maks 1MB)</label>
          <input type="file" accept="image/*,video/*" @change="pilihFile" class="w-full text-[11px] text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100">
          <p class="text-[10px] text-gray-400 mt-1"><i v-if="fileInfo" class="fas fa-check-circle text-green-500 mr-1"></i>{{ fileInfo }}</p>
        </div>
        <div class="flex space-x-2 pt-2">
          <button @click="$emit('tutup')" class="w-1/2 bg-gray-100 font-bold py-2.5 rounded-xl text-gray-600 hover:bg-gray-200 transition">Batal</button>
          <button @click="kirim" :disabled="mengirim" class="w-1/2 bg-amber-500 font-bold py-2.5 rounded-xl text-white hover:bg-amber-600 transition shadow-sm disabled:opacity-50">{{ mengirim ? 'Mengirim...' : 'Kirim Sanggahan' }}</button>
        </div>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// App utama
// ---------------------------------------------------------------------------
const AppAccountProfile = {
  components: { DuaBaris, AjuBandingModal },
  setup() {
    const tabAktif = ref('account');

    // ---- Account (QR/ID) ----
    const namaTampil = computed(() => window.currentUser?.name || window.currentUser?.nama || 'User');
    const idAppTampil = computed(() => window.currentUser?.id_app || 'ID Tidak Ditemukan');
    const jabatanTampil = computed(() => window.currentUser?.jabatan || window.currentUser?.role || 'Staff');
    const qrUrl = computed(() => {
      const qrData = window.currentUser?.id_app || window.currentUser?.email || '';
      return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrData}`;
    });

    function clockOut() {
      if (window.prosesClockOut) window.prosesClockOut();
    }

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
      document.getElementById('label-status-kamera').innerText = "Mode: IZIN";
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
      document.getElementById('label-status-kamera').innerText = "Mode: CUTI";
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
      document.getElementById('label-status-kamera').innerText = "Mode: LEMBUR";
      window.pindahLayar('screen-camera');
    }

    // ---- Absensi: Filter, Statistik, Riwayat ----
    const filterTglMulai = ref('');
    const filterTglSelesai = ref('');
    const filterGudang = ref('ALL');
    const filterShift = ref('ALL');
    const opsiGudangFilter = ref([]);
    const opsiShiftFilter = ref([]);

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
    }

    async function muatRiwayat() {
      memuatRiwayat.value = true;
      try {
        const snap = await getDocs(collection(db, "absensi"));
        let countHadir = 0, countACC = 0, countSeragamBeda = 0, countIzin = 0;
        const list = [];

        snap.forEach(docSnap => {
          const data = docSnap.data();
          data.id = docSnap.id;
          if (data.email !== window.currentUser.email) return;

          let lolosTgl = true;
          if (data.waktu) {
            const w = window.parseWaktuIndo(data.waktu);
            if (w) {
              const tglData = `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, '0')}-${String(w.getDate()).padStart(2, '0')}`;
              if (filterTglMulai.value && tglData < filterTglMulai.value) lolosTgl = false;
              if (filterTglSelesai.value && tglData > filterTglSelesai.value) lolosTgl = false;
            }
          }
          const lolosGudang = (filterGudang.value === 'ALL' || data.gudang === filterGudang.value);
          const lolosShift = (filterShift.value === 'ALL' || data.shift === filterShift.value);
          if (!lolosTgl || !lolosGudang || !lolosShift) return;

          list.push(data);
          if (data.status === "HADIR" || data.status === "HADIR (CLOCK IN)") countHadir++;
          else countIzin++;
          if (data.status_acc === "ACC") countACC++;
          if (data.seragam === "Tidak Sesuai") countSeragamBeda++;
        });

        stat.hadir = countHadir; stat.acc = countACC; stat.seragamBeda = countSeragamBeda; stat.izin = countIzin;

        list.sort((a, b) => (window.parseWaktuIndo(b.waktu)?.getTime() || 0) - (window.parseWaktuIndo(a.waktu)?.getTime() || 0));
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
      return (item.status_acc === "REJECT" || item.seragam === "Tidak Sesuai");
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
      if (nama === 'datadiri') muatFormDariCurrentUser();
      if (nama === 'absensi' && listRiwayat.value.length === 0) muatRiwayat();
    }

    onMounted(async () => {
      if (window.mulaiHitungJamKerja) window.mulaiHitungJamKerja();
      await muatOpsiFilter();
      await muatRiwayat();
    });

    return {
      tabAktif, pindahTab,
      namaTampil, idAppTampil, jabatanTampil, qrUrl, clockOut,
      form, menyimpanForm, simpanDataDiri,
      formTerbuka, opsiAlasanIzin, opsiAlasanCuti, izin, cuti, lembur,
      bukaFormIzin, tutupFormIzin, ajukanIzin,
      bukaFormCuti, tutupFormCuti, ajukanCuti,
      bukaFormLembur, tutupFormLembur, ajukanLembur,
      filterTglMulai, filterTglSelesai, filterGudang, filterShift, opsiGudangFilter, opsiShiftFilter,
      stat, listRiwayat, memuatRiwayat, muatRiwayat, exportCSV,
      pisahTanggalWaktu, lihatFotoBesar, bolehBanding,
      docIdSedangDibanding, bukaBanding, tutupBanding, selesaiBanding
    };
  },
  template: `
    <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
      <div>
        <h2 class="text-lg font-black text-slate-800 flex items-center"><i class="fas fa-user-circle text-blue-600 mr-2.5"></i> Profile</h2>
      </div>
      <div class="flex items-center space-x-2 border-t pt-4 overflow-x-auto hide-scrollbar">
        <button @click="pindahTab('account')" :class="tabAktif === 'account' ? 'bg-slate-800 text-white font-bold shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold'" class="px-4 py-2.5 rounded-2xl text-xs whitespace-nowrap transition flex items-center">
          <i class="fas fa-qrcode mr-1.5"></i> Account
        </button>
        <button @click="pindahTab('datadiri')" :class="tabAktif === 'datadiri' ? 'bg-slate-800 text-white font-bold shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold'" class="px-4 py-2.5 rounded-2xl text-xs whitespace-nowrap transition flex items-center">
          <i class="fas fa-user-edit mr-1.5"></i> Data Karyawan
        </button>
        <button @click="pindahTab('absensi')" :class="tabAktif === 'absensi' ? 'bg-slate-800 text-white font-bold shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold'" class="px-4 py-2.5 rounded-2xl text-xs whitespace-nowrap transition flex items-center">
          <i class="fas fa-history mr-1.5"></i> Absensi
        </button>
        <button @click="pindahTab('pencapaian')" :class="tabAktif === 'pencapaian' ? 'bg-slate-800 text-white font-bold shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold'" class="px-4 py-2.5 rounded-2xl text-xs whitespace-nowrap transition flex items-center">
          <i class="fas fa-trophy mr-1.5"></i> Pencapaian
        </button>
        <button @click="pindahTab('keamanan')" :class="tabAktif === 'keamanan' ? 'bg-slate-800 text-white font-bold shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold'" class="px-4 py-2.5 rounded-2xl text-xs whitespace-nowrap transition flex items-center">
          <i class="fas fa-key mr-1.5"></i> Keamanan
        </button>
      </div>
    </div>

    <!-- Tab: Account -->
    <div v-show="tabAktif === 'account'" class="mt-4">
      <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center max-w-sm mx-auto text-center space-y-4">
        <div class="w-32 h-32 p-2 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
          <img :src="qrUrl" alt="QR Code" class="w-full h-full object-contain">
        </div>
        <div>
          <h2 class="text-xl font-black text-slate-800">{{ namaTampil }}</h2>
          <p class="text-sm font-mono font-bold text-blue-600 mt-1">{{ idAppTampil }}</p>
          <span class="inline-block px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full mt-2">{{ jabatanTampil }}</span>
        </div>
        <p class="text-[10px] text-gray-400 max-w-[200px] leading-relaxed">Tunjukkan QR ini saat melakukan absensi fisik atau verifikasi proses SPK.</p>
      </div>
      <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm max-w-sm mx-auto w-full space-y-3 mt-4">
        <h3 class="text-xs font-bold text-gray-700 border-b pb-2">Aksi Absensi</h3>
        <button @click="clockOut" class="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center transition">
          <i class="fas fa-sign-out-alt mr-2"></i> Clock Out (Pulang)
        </button>
        <p class="text-[10px] text-gray-400 text-center">Pengajuan Izin/Cuti/Lembur sekarang ada di tab <b>Absensi</b>.</p>
      </div>
    </div>

    <!-- Tab: Data Karyawan -->
    <div v-show="tabAktif === 'datadiri'" class="mt-4 max-w-4xl mx-auto w-full">
      <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-6 text-xs">
        <div class="flex items-center border-b pb-3">
          <i class="fas fa-user-edit text-blue-600 text-xl mr-3"></i>
          <div>
            <h3 class="font-bold text-gray-800 text-sm">Lengkapi / Perbarui Data Diri</h3>
            <p class="text-[10px] text-gray-500">Pastikan seluruh data selaras dengan identitas KTP dan data pendaftaran awal.</p>
          </div>
        </div>

        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
          <h4 class="font-bold text-gray-700 mb-3 border-b pb-1">1. Identitas Pribadi</h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label class="block font-semibold text-gray-600 mb-1">Nama Lengkap (Sesuai KTP)</label><input v-model="form.nama" type="text" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">NIK</label><input v-model="form.nik" type="text" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Jenis Kelamin</label><select v-model="form.jk" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"><option value="">-- Pilih --</option><option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option></select></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Tempat Lahir</label><input v-model="form.tempatLahir" type="text" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Tanggal Lahir</label><input v-model="form.tglLahir" type="date" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
          </div>
        </div>

        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
          <h4 class="font-bold text-gray-700 mb-3 border-b pb-1">2. Informasi Kontak</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label class="block font-semibold text-gray-600 mb-1">No. Handphone (WhatsApp)</label><input v-model="form.hp" type="text" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Email Aktif (Identitas Login)</label><input :value="form.email" disabled class="w-full px-3 py-2 bg-gray-200 border rounded-xl outline-none text-gray-500 cursor-not-allowed" title="Hubungi Admin untuk ubah Email"></div>
          </div>
        </div>

        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
          <h4 class="font-bold text-gray-700 mb-3 border-b pb-1">3. Alamat Lengkap</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-3">
              <label class="block font-bold text-gray-800 text-xs text-blue-600">A. Alamat Sesuai KTP</label>
              <div><label class="block font-semibold text-gray-600 mb-1">Kabupaten/Kota</label><input v-model="form.ktpKab" type="text" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div><label class="block font-semibold text-gray-600 mb-1">Kecamatan</label><input v-model="form.ktpKec" type="text" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div><label class="block font-semibold text-gray-600 mb-1">Alamat Detail (Jalan/RT/RW)</label><textarea v-model="form.ktpDetail" rows="2" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></textarea></div>
            </div>
            <div class="space-y-3">
              <label class="block font-bold text-gray-800 text-xs text-green-600">B. Alamat Domisili Saat Ini</label>
              <div><label class="block font-semibold text-gray-600 mb-1">Kabupaten/Kota</label><input v-model="form.domKab" type="text" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div><label class="block font-semibold text-gray-600 mb-1">Kecamatan</label><input v-model="form.domKec" type="text" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
              <div><label class="block font-semibold text-gray-600 mb-1">Alamat Detail (Jalan/RT/RW)</label><textarea v-model="form.domDetail" rows="2" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></textarea></div>
            </div>
          </div>
        </div>

        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
          <h4 class="font-bold text-gray-700 mb-3 border-b pb-1">4. Latar Belakang & Keluarga</h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label class="block font-semibold text-gray-600 mb-1">Pendidikan Terakhir</label><select v-model="form.pendidikan" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"><option value="">-- Pilih --</option><option value="SD">SD</option><option value="SMP">SMP</option><option value="SMA/SMK">SMA/SMK</option><option value="D3">D3</option><option value="S1">S1</option><option value="S2">S2</option></select></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Nama Sekolah / Kampus</label><input v-model="form.sekolah" type="text" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Jurusan</label><input v-model="form.jurusan" type="text" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Status Pernikahan</label><select v-model="form.nikah" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"><option value="">-- Pilih --</option><option value="Belum Menikah">Belum Menikah</option><option value="Menikah">Menikah</option><option value="Cerai">Cerai</option></select></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Jumlah Tanggungan (Orang)</label><input v-model="form.tanggungan" type="number" min="0" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
          </div>
        </div>

        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
          <h4 class="font-bold text-gray-700 mb-3 border-b pb-1">5. Kontak Darurat</h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label class="block font-semibold text-gray-600 mb-1">Nama Kontak Darurat</label><input v-model="form.daruratNama" type="text" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Hubungan</label><input v-model="form.daruratHub" type="text" placeholder="Ibu / Ayah / Suami / dll" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">No. HP Darurat</label><input v-model="form.daruratHp" type="text" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
          </div>
        </div>

        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
          <h4 class="font-bold text-gray-700 mb-3 border-b pb-1">6. Data Rekening Bank</h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label class="block font-semibold text-gray-600 mb-1">Nama Bank</label><input v-model="form.bank" type="text" placeholder="BCA / Mandiri / BRI / dll" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">No. Rekening</label><input v-model="form.norek" type="text" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Atas Nama Rekening</label><input v-model="form.namarek" type="text" class="w-full px-3 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"></div>
          </div>
        </div>

        <button @click="simpanDataDiri" :disabled="menyimpanForm" class="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition shadow-md mt-4 flex justify-center items-center text-sm disabled:opacity-50">
          <i class="fas fa-save mr-2"></i> {{ menyimpanForm ? 'Menyimpan...' : 'Simpan Seluruh Pembaruan Data' }}
        </button>
      </div>
    </div>

    <!-- Tab: Absensi -->
    <div v-show="tabAktif === 'absensi'" class="mt-4 space-y-4">
      <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm max-w-lg mx-auto w-full space-y-3">
        <h3 class="text-xs font-bold text-gray-700 border-b pb-2">Pengajuan</h3>
        <div class="grid grid-cols-3 gap-2">
          <button @click="bukaFormIzin" class="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-bold py-2.5 rounded-xl text-xs flex flex-col items-center justify-center transition border border-yellow-200">
            <i class="fas fa-file-signature mb-1"></i> Izin
          </button>
          <button @click="bukaFormCuti" class="bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold py-2.5 rounded-xl text-xs flex flex-col items-center justify-center transition border border-blue-200">
            <i class="fas fa-calendar-alt mb-1"></i> Cuti
          </button>
          <button @click="bukaFormLembur" class="bg-purple-50 hover:bg-purple-100 text-purple-600 font-bold py-2.5 rounded-xl text-xs flex flex-col items-center justify-center transition border border-purple-200">
            <i class="fas fa-business-time mb-1"></i> Lembur
          </button>
        </div>
      </div>

      <div v-if="formTerbuka === 'izin'" class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm max-w-lg mx-auto w-full space-y-3">
        <h3 class="text-xs font-bold text-gray-700 border-b pb-2">Form Pengajuan Izin (Hari H)</h3>
        <div><label class="block text-[11px] font-semibold text-gray-600 mb-1">Tanggal</label><input v-model="izin.tanggal" type="date" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-sm"></div>
        <div><label class="block text-[11px] font-semibold text-gray-600 mb-1">Alasan</label><select v-model="izin.alasan" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-sm"><option value="">-- Pilih --</option><option v-for="a in opsiAlasanIzin" :key="a" :value="a">{{ a }}</option></select></div>
        <div><label class="block text-[11px] font-semibold text-gray-600 mb-1">Detail Tambahan (opsional)</label><textarea v-model="izin.detail" rows="2" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-sm resize-none"></textarea></div>
        <div class="flex space-x-2 pt-1">
          <button @click="tutupFormIzin" class="w-1/2 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl text-xs">Batal</button>
          <button @click="ajukanIzin" class="w-1/2 bg-yellow-500 text-white font-bold py-2.5 rounded-xl text-xs">Lanjut Foto</button>
        </div>
      </div>

      <div v-if="formTerbuka === 'cuti'" class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm max-w-lg mx-auto w-full space-y-3">
        <h3 class="text-xs font-bold text-gray-700 border-b pb-2">Form Pengajuan Cuti (Minimal H-3)</h3>
        <div><label class="block text-[11px] font-semibold text-gray-600 mb-1">Tanggal Cuti</label><input v-model="cuti.tanggal" type="date" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-sm"></div>
        <div><label class="block text-[11px] font-semibold text-gray-600 mb-1">Alasan</label><select v-model="cuti.alasan" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-sm"><option value="">-- Pilih --</option><option v-for="a in opsiAlasanCuti" :key="a" :value="a">{{ a }}</option></select></div>
        <div><label class="block text-[11px] font-semibold text-gray-600 mb-1">Detail Tambahan (opsional)</label><textarea v-model="cuti.detail" rows="2" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-sm resize-none"></textarea></div>
        <div class="flex space-x-2 pt-1">
          <button @click="tutupFormCuti" class="w-1/2 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl text-xs">Batal</button>
          <button @click="ajukanCuti" class="w-1/2 bg-blue-600 text-white font-bold py-2.5 rounded-xl text-xs">Lanjut Foto</button>
        </div>
      </div>

      <div v-if="formTerbuka === 'lembur'" class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm max-w-lg mx-auto w-full space-y-3">
        <h3 class="text-xs font-bold text-gray-700 border-b pb-2">Form Pengajuan Jam Lembur</h3>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-[11px] font-semibold text-gray-600 mb-1">Mulai Lembur</label><input v-model="lembur.mulai" type="datetime-local" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-sm"></div>
          <div><label class="block text-[11px] font-semibold text-gray-600 mb-1">Selesai (perkiraan)</label><input v-model="lembur.selesai" type="datetime-local" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-sm"></div>
        </div>
        <div><label class="block text-[11px] font-semibold text-gray-600 mb-1">Alasan Lembur</label><textarea v-model="lembur.alasan" rows="2" placeholder="Kenapa perlu lembur..." class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-sm resize-none"></textarea></div>
        <div><label class="block text-[11px] font-semibold text-gray-600 mb-1">Instruksi / Tugas yang Dikerjakan</label><textarea v-model="lembur.instruksi" rows="2" placeholder="Instruksi dari atasan / tugas yang dikerjakan..." class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-sm resize-none"></textarea></div>
        <div class="flex space-x-2 pt-1">
          <button @click="tutupFormLembur" class="w-1/2 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl text-xs">Batal</button>
          <button @click="ajukanLembur" class="w-1/2 bg-purple-600 text-white font-bold py-2.5 rounded-xl text-xs">Clock In Lembur (Foto)</button>
        </div>
      </div>

      <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 class="text-sm font-bold text-slate-800 flex items-center"><i class="fas fa-file-invoice text-blue-600 mr-2"></i> Laporan Riwayat & Rekapitulasi Absensi</h3>
          <p class="text-[11px] text-gray-500 mt-0.5">Filter laporan kehadiran, pantau statistik, dan unduh file rekapitulasi.</p>
        </div>
        <button @click="exportCSV" class="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-sm flex items-center justify-center space-x-1.5">
          <i class="fas fa-file-excel"></i><span>Export Laporan CSV</span>
        </button>
      </div>

      <div class="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3 text-xs">
        <h4 class="font-bold text-gray-700 border-b pb-2"><i class="fas fa-filter text-slate-600 mr-1"></i> Filter Parameter Laporan</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div><label class="block text-[11px] font-semibold text-gray-600 mb-1">Dari Tanggal</label><input v-model="filterTglMulai" type="date" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none"></div>
          <div><label class="block text-[11px] font-semibold text-gray-600 mb-1">Sampai Tanggal</label><input v-model="filterTglSelesai" type="date" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none"></div>
          <div><label class="block text-[11px] font-semibold text-gray-600 mb-1">Filter Gudang</label><select v-model="filterGudang" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none"><option value="ALL">Semua Gudang</option><option v-for="g in opsiGudangFilter" :key="g" :value="g">{{ g }}</option></select></div>
          <div><label class="block text-[11px] font-semibold text-gray-600 mb-1">Filter Shift</label><select v-model="filterShift" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none"><option value="ALL">Semua Shift</option><option v-for="s in opsiShiftFilter" :key="s" :value="s">{{ s }}</option></select></div>
        </div>
        <div class="flex justify-end pt-1">
          <button @click="muatRiwayat" class="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-sm flex items-center space-x-1.5">
            <i class="fas fa-search"></i><span>Tampilkan Laporan</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm"><span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Total Hadir</span><span class="text-lg font-black text-green-600 mt-0.5 block">{{ stat.hadir }}</span></div>
        <div class="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm"><span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">ACC Valid</span><span class="text-lg font-black text-blue-600 mt-0.5 block">{{ stat.acc }}</span></div>
        <div class="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm"><span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Seragam Beda</span><span class="text-lg font-black text-amber-500 mt-0.5 block">{{ stat.seragamBeda }}</span></div>
        <div class="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm"><span class="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Izin/Cuti/Tolak</span><span class="text-lg font-black text-red-500 mt-0.5 block">{{ stat.izin }}</span></div>
      </div>

      <div v-if="memuatRiwayat" class="text-center py-10 text-gray-400 text-xs"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><p>Memuat laporan absensi Anda...</p></div>
      <div v-else-if="listRiwayat.length === 0" class="text-center py-10 bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400 text-xs"><i class="fas fa-folder-open text-3xl mb-3 text-gray-300"></i><br>Belum ada riwayat absensi yang tercatat untuk Anda.</div>
      <div v-else class="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
        <table class="w-full text-left text-xs text-gray-600 whitespace-nowrap">
          <thead class="bg-gray-50 text-gray-700 font-bold border-b text-[10px] uppercase">
            <tr>
              <th class="p-3">Persetujuan / Tipe Absen</th>
              <th class="p-3">Shift / Gudang</th>
              <th class="p-3">Tanggal / Waktu</th>
              <th class="p-3">Foto</th>
              <th class="p-3">Nama / No HP</th>
              <th class="p-3">Status Kehadiran / Seragam</th>
              <th class="p-3">Sanggahan Karyawan</th>
              <th class="p-3">Status Aju Banding</th>
              <th class="p-3 text-center">Aksi Aju Banding</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="item in listRiwayat" :key="item.id" class="hover:bg-gray-50 transition">
              <td class="p-3">
                <b><span v-if="item.status_acc === 'ACC'" class="text-green-600">ACC</span><span v-else-if="item.status_acc === 'REJECT'" class="text-red-500">REJECT</span><span v-else class="text-amber-500">PENDING</span></b><br>
                <span class="text-[10px] text-gray-400 font-normal">{{ item.status || 'HADIR' }}</span>
              </td>
              <td class="p-3"><dua-baris :a="item.shift" :b="item.gudang" /></td>
              <td class="p-3"><dua-baris :a="pisahTanggalWaktu(item.waktu).tgl" :b="pisahTanggalWaktu(item.waktu).jam" /></td>
              <td class="p-3">
                <img v-if="item.foto_selfie || item.foto" :src="item.foto_selfie || item.foto" @click="lihatFotoBesar(item.foto_selfie || item.foto)" class="w-10 h-10 rounded-lg object-cover border cursor-pointer hover:scale-105 transition">
                <span v-else class="text-gray-300">-</span>
              </td>
              <td class="p-3"><dua-baris :a="item.nama_pegawai || item.nama" :b="form.hp" /></td>
              <td class="p-3"><dua-baris :a="item.status_kehadiran" :b="item.seragam || 'Sesuai'" /></td>
              <td class="p-3 max-w-[150px] truncate" :title="item.catatan_banding || ''">{{ item.catatan_banding || '-' }}</td>
              <td class="p-3 text-center">
                <span v-if="item.catatan_banding" class="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 font-bold text-[9px] rounded-full">Sudah Diajukan</span>
                <span v-else class="text-gray-300">-</span>
              </td>
              <td class="p-3 text-center">
                <span v-if="item.catatan_banding" class="text-[10px] text-gray-500"><i class="fas fa-check mr-1 text-green-500"></i>Terkirim</span>
                <button v-else-if="bolehBanding(item)" @click="bukaBanding(item.id)" class="px-3 py-1.5 bg-white border border-amber-300 text-amber-600 font-bold text-[10px] rounded-lg hover:bg-amber-50 transition shadow-sm"><i class="fas fa-gavel mr-1"></i>Aju Banding</button>
                <span v-else class="text-gray-300 text-[10px]">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab: Pencapaian -->
    <div v-show="tabAktif === 'pencapaian'" class="mt-4">
      <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm text-center text-gray-500 py-10">
        <i class="fas fa-trophy text-4xl text-yellow-300 mb-3"></i>
        <h3 class="font-bold text-gray-800 text-sm">Modul Pencapaian & Penilaian SPK</h3>
        <p class="text-xs mt-1">Sedang dalam pengembangan operasional.</p>
      </div>
    </div>

    <!-- Tab: Keamanan -->
    <div v-show="tabAktif === 'keamanan'" class="mt-4 max-w-md mx-auto w-full">
      <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4 text-xs">
        <h3 class="font-bold text-gray-800 border-b pb-2"><i class="fas fa-shield-alt text-red-500 mr-2"></i> Update Password</h3>
        <p class="text-[10px] text-gray-500">Ubah kata sandi Anda secara berkala untuk menjaga keamanan akun.</p>
        <div><label class="block font-semibold text-gray-600 mb-1">Password Lama</label><input type="password" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-red-500"></div>
        <div><label class="block font-semibold text-gray-600 mb-1">Password Baru</label><input type="password" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-red-500"></div>
        <button class="w-full bg-slate-800 text-white font-bold py-2.5 rounded-xl hover:bg-slate-900 transition shadow-sm mt-2">Update Password</button>
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
}
