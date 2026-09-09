// js/vue-antrean-lembur.js
// ============================================================================
// Master Absensi > Antrean Izin/Cuti/Lembur — validasi/approve pengajuan
// IZIN, CUTI, dan LEMBUR karyawan (terpisah dari Antrean Absensi biasa,
// mulai 17 Agt 2026 khusus utk Lembur).
//
// DIROMBAK TOTAL (9 Sep 2026) — instruksi Guru "lanjut profile dan
// management", spek handoff Master Absensi §2.4 minta 1 tab GABUNGAN
// "Antrean Izin / Cuti / Lembur" (bukan Lembur sendirian seperti
// sebelumnya). NAMA FILE INI SENGAJA TIDAK DIGANTI (tetap
// vue-antrean-lembur.js) — Guru upload manual drag-drop ke GitHub, ganti
// nama file = file lama menggantung di repo sampai dihapus manual lewat
// tampilan GitHub (lihat FONDASI.md). Nama fungsi global
// (window.pastikanMountAntreanLembur/refreshAntreanLembur), id mount HTML
// (#vue-antrean-lembur), DAN id permission (cekIzinMenu('antrean_lembur'))
// JUGA SENGAJA DIPERTAHANKAN SAMA PERSIS — supaya role yang sudah diberi
// akses menu "Antrean Lembur" di Akses & Keamanan TIDAK kehilangan
// aksesnya diam-diam (izin lama jadi yatim). Yang berubah CUMA label
// tampilan ("Antrean Izin/Cuti/Lembur") + isi/logic di dalam file ini.
//
// Field IZIN/CUTI/LEMBUR SEMUA sudah ditulis ke koleksi SAMA "absensi"
// sejak dulu (js/vue-camera.js, JALUR 3) — TIDAK ada koleksi baru,
// TIDAK ada migrasi data. Penggabungan ini murni di level query+tampilan:
//   - IZIN/CUTI: field tanggal_pengajuan + keterangan.
//   - LEMBUR (CLOCK IN): field lembur_mulai/lembur_selesai/keterangan/
//     lembur_instruksi + perbandingan Jam Shift vs Jam Lembur.
// Sebelum rombakan ini, IZIN/CUTI malah nyasar tampil di Antrean Absensi
// (js/vue-antrean-absensi.js) pakai kartu format-lama yang salah label
// "Hadir" dan TIDAK menampilkan tanggal_pengajuan/keterangan sama sekali
// — itu sudah diperbaiki bersamaan (lihat header file itu), IZIN/CUTI
// SEKARANG dikecualikan dari sana, cuma muncul di sini.
//
// PENTING — kenapa layar ini nyata dibutuhkan utk Lembur (bukan cuma
// kerapian UI): js/vue-camera.js (proses Clock Out) MEMBACA status_acc
// dokumen Lembur ini untuk menentukan batas jam kerja yang dipakai
// penggajian (jam_keluar_untuk_gaji) — kalau Lembur belum di-ACC di sini,
// Clock Out lewat jam shift akan otomatis dipotong ke jam shift, BUKAN
// jam lembur yang diajukan. TIDAK BERUBAH oleh rombakan ini — field &
// collection tulisnya (`absensi.status_acc`) SAMA PERSIS.
//
// DIROMBAK (18 Agt 2026):
// 1. HEMAT — where("status_acc","==","PENDING") LANGSUNG (IZIN/CUTI/
//    Lembur SELALU pakai status_acc tunggal, TIDAK ikut rombakan dokumen
//    gabungan vue-camera.js format Hadir), bukan fetch semua histori
//    absensi lagi.
// 2. PEDOMAN KERJA (lihat vue-antrean-absensi.js) — search box selalu
//    ada, filter Jenis Pekerjaan+Gudang cuma buat Owner/Superuser.
//
// DIROMBAK LAGI (29 Agt 2026, §44.18) — bug N+1 SAMA yang ketemu &
// diperbaiki di vue-antrean-absensi.js: tiap kartu pending dulu query
// SENDIRI ke master_shift (jam shift) begitu di-mount. Sekarang dihitung
// SEKALI di muat() (induk) buat seluruh daftar, chunked where(...,'in',...),
// dikirim ke tiap kartu lewat prop shiftInfo — kartu tidak query lagi.
// ============================================================================
import { createApp, ref, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
// BARU (29 Agt 2026, moodboard "Gechoo Mobile Organic" v2) — KolomCari
// (pil, dipakai juga di Antrean Absensi) GANTI kolom cari hand-rolled.
import { KolomCari } from './vue-components.js?v=5';

// Status mentah (field `status` di dokumen `absensi`) yang masuk cakupan
// tab gabungan ini — lihat header file utk kenapa 3 ini digabung.
const STATUS_DICAKUP = ["IZIN", "CUTI", "LEMBUR (CLOCK IN)"];

function jenisLabel(status) {
  if (status === "IZIN") return "Izin";
  if (status === "CUTI") return "Cuti";
  if (status === "LEMBUR (CLOCK IN)") return "Lembur";
  return status || "-";
}
function jenisWarnaTag(status) {
  if (status === "LEMBUR (CLOCK IN)") return "blue";
  return "warn"; // Izin/Cuti pakai warna sama dgn tag "Menunggu" existing
}

const AntreanIclCard = {
  props: {
    docId: { type: String, required: true },
    data: { type: Object, required: true },
    // BARU (29 Agt 2026, §44.18) — lihat catatan di jamShift di bawah:
    // prop ini GANTI query Firestore yang dulu jalan PER KARTU (N+1),
    // sekarang dihitung SEKALI di induk (AppAntreanIcl.muat()). Cuma
    // relevan buat kartu jenis Lembur (Izin/Cuti tidak pakai jam shift).
    shiftInfo: { type: Object, default: () => ({ masuk: null, keluar: null }) }
  },
  emits: ['diproses'],
  setup(props, { emit }) {
    const memproses = ref(false);
    const isLembur = computed(() => props.data.status === "LEMBUR (CLOCK IN)");

    async function proses(statusAcc) {
      // Permission id TETAP 'antrean_lembur' (lihat catatan header file)
      // supaya role yang sudah diberi akses tidak kehilangan izinnya.
      if (window.cekIzinMenu('antrean_lembur', 'edit') === false) {
        return alert('Anda tidak punya izin memproses ACC/Reject di sini. Hubungi Owner/PIC.');
      }
      memproses.value = true;
      try {
        await updateDoc(doc(db, "absensi", props.docId), {
          status_acc: statusAcc,
          validated_at: new Date().toISOString(),
          validated_by: window.currentUser.name || window.currentUser.nama || window.currentUser.email
        });
        alert(`Pengajuan ${jenisLabel(props.data.status)} berhasil di-${statusAcc}!`);
        emit('diproses');
      } catch (e) {
        console.error("Gagal update ACC:", e);
        alert("Terjadi kesalahan sistem saat memproses validasi.");
      }
      memproses.value = false;
    }

    function hapus() {
      if (window.cekIzinMenu('antrean_lembur', 'delete') === false) {
        return alert('Anda tidak punya izin menghapus data di sini. Hubungi Owner/PIC.');
      }
      if (window.hapusAbsensi) window.hapusAbsensi(props.docId).then(() => emit('diproses'));
    }

    const bolehEdit = computed(() => window.cekIzinMenu('antrean_lembur', 'edit') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu('antrean_lembur', 'delete') !== false);

    function lihatFotoBesar() {
      if (props.data.foto_selfie && window.bukaPreviewFoto) window.bukaPreviewFoto(props.data.foto_selfie);
    }

    // Jam Shift asli orangnya (buat dibandingkan sama Jam Lembur yang
    // diajukan) — lookup nama_shift->master_shift. Cuma dipakai kartu
    // Lembur, lihat catatan lengkap N+1 fix di AppAntreanIcl di bawah.
    const jamShift = computed(() => props.shiftInfo || { masuk: null, keluar: null });

    function formatTglSingkat(ts) {
      if (!ts || typeof ts.toDate !== 'function') return '-';
      return ts.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    }

    const menuAksiTerbuka = ref(false);
    function toggleMenuAksi() { menuAksiTerbuka.value = !menuAksiTerbuka.value; }
    function tutupMenuAksi() { menuAksiTerbuka.value = false; }

    return {
      memproses, proses, hapus, bolehEdit, bolehHapus, lihatFotoBesar,
      jamShift, formatTglSingkat, menuAksiTerbuka, toggleMenuAksi, tutupMenuAksi,
      isLembur, jenisLabel, jenisWarnaTag
    };
  },
  // ==========================================================================
  // Pola kartu padat SAMA dgn Antrean Absensi/Lembur lama (moodboard "Gechoo
  // Mobile Organic" v2) — cuma badge jenis (Izin/Cuti/Lembur) yang baru, dan
  // body-nya CABANG per jenis: Lembur tetap tampilkan perbandingan Jam
  // Shift vs Jam Lembur + Instruksi (persis kartu lama); Izin/Cuti tampilkan
  // Tanggal Pengajuan + Keterangan (field yang SUDAH ada di dokumen sejak
  // dulu tapi sebelumnya TIDAK PERNAH ditampilkan di kartu manapun).
  // ==========================================================================
  template: `
    <div class="gc-card" style="border-radius:20px;">
      <div style="display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--ivory-dim); padding-bottom:10px; margin-bottom:10px;">
        <img v-if="data.foto_selfie" :src="data.foto_selfie" @click="lihatFotoBesar" style="width:38px; height:38px; border-radius:14px; object-fit:cover; border:1px solid var(--line); cursor:pointer; flex-shrink:0;">
        <div v-else style="width:38px; height:38px; border-radius:14px; background:linear-gradient(135deg,var(--pink),var(--ivory-dim)); flex-shrink:0;"></div>
        <div style="flex:1; min-width:0;">
          <h4 class="gc-heading" style="font-weight:700; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ data.nama_pegawai || data.nama || 'Karyawan' }}</h4>
          <p style="font-size:9.5px; color:var(--text-faint); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ formatTglSingkat(data.waktu_ts) }}<span v-if="data.gudang"> &ndash; {{ data.gudang }}</span></p>
        </div>
        <span :class="'tag ' + jenisWarnaTag(data.status)" style="flex-shrink:0;"><span class="tag-dot"></span>{{ jenisLabel(data.status) }}</span>
        <div v-if="bolehHapus" style="position:relative; flex-shrink:0;">
          <button @click="toggleMenuAksi" class="icon-btn" style="border-radius:50%; border:none; background:none;" title="Aksi lainnya"><i class="fas fa-ellipsis-vertical"></i></button>
          <div v-if="menuAksiTerbuka" @click="tutupMenuAksi" style="position:fixed; inset:0; z-index:60;"></div>
          <div v-if="menuAksiTerbuka" style="position:absolute; right:0; top:34px; z-index:61; background:var(--surface); border:1px solid var(--line); border-radius:14px; box-shadow:0 10px 24px -6px rgba(31,22,17,.3); padding:6px; min-width:150px;">
            <button @click="tutupMenuAksi(); hapus();" style="width:100%; text-align:left; background:none; border:none; padding:9px 11px; border-radius:9px; font-size:12px; font-weight:600; color:var(--danger); cursor:pointer; display:flex; align-items:center; gap:8px;"><i class="fas fa-trash-alt"></i> Hapus permanen</button>
          </div>
        </div>
      </div>

      <template v-if="isLembur">
        <div style="display:flex; align-items:flex-start; gap:8px; padding:2px 0 8px;">
          <div style="text-align:left;"><span style="font-size:9px; color:var(--text-faint); display:block; text-transform:uppercase; letter-spacing:.04em;">Jam Shift</span><b style="font-size:11px;">{{ (jamShift.masuk && jamShift.keluar) ? (jamShift.masuk + '–' + jamShift.keluar) : '-' }}</b></div>
          <div style="text-align:right; margin-left:auto;"><span style="font-size:9px; color:var(--text-faint); display:block; text-transform:uppercase; letter-spacing:.04em;">Jam Lembur</span><b style="font-size:11px; color:var(--burgundy);">{{ data.lembur_mulai || '-' }}&ndash;{{ data.lembur_selesai || '-' }}</b></div>
        </div>
        <p v-if="data.lembur_instruksi" style="font-size:9.5px; color:var(--text-faint); padding:0 0 3px;"><b>Instruksi:</b> {{ data.lembur_instruksi }}</p>
        <p style="font-size:9.5px; color:var(--text-muted); padding:0 0 6px;">{{ data.keterangan || '-' }}</p>
      </template>
      <template v-else>
        <div style="padding:2px 0 8px;">
          <span style="font-size:9px; color:var(--text-faint); display:block; text-transform:uppercase; letter-spacing:.04em;">Tanggal Pengajuan</span>
          <b style="font-size:11px;">{{ data.tanggal_pengajuan || '-' }}</b>
        </div>
        <p style="font-size:9.5px; color:var(--text-muted); padding:0 0 6px;"><b>Keterangan:</b> {{ data.keterangan || '-' }}</p>
      </template>

      <div v-if="bolehEdit" class="approve-row">
        <button @click="proses('ACC')" :disabled="memproses" class="appr-btn ok"><i class="fas fa-check"></i> Setujui</button>
        <button @click="proses('REJECT')" :disabled="memproses" class="appr-btn danger"><i class="fas fa-times"></i> Tolak</button>
      </div>
    </div>
  `
};

const AppAntreanIcl = {
  components: { AntreanIclCard, KolomCari },
  setup() {
    const daftarPending = ref([]);
    const memuat = ref(true);
    const errorMuat = ref('');
    // BARU (29 Agt 2026, §44.18) — hasil batch jam shift buat SEMUA kartu
    // (dihitung sekali per muat(), lihat di bawah), dikirim turun ke tiap
    // AntreanIclCard lewat prop. Cuma relevan utk kartu jenis Lembur.
    const petaShiftInfo = ref({});

    const cariNama = ref('');
    const isOwnerRole = computed(() => ['owner', 'superuser'].includes((window.currentUser.role || '').toLowerCase()));
    const filterJenisPekerjaanOwner = ref('ALL');
    const filterGudangOwner = ref('ALL');
    const opsiJenisPekerjaanOwner = ref([]);
    const opsiGudangOwner = ref([]);
    // BARU (9 Sep 2026) — filter jenis pengajuan (Semua/Izin/Cuti/Lembur),
    // berguna karena sekarang 3 jenis tercampur di 1 daftar.
    const filterJenis = ref('ALL');
    const daftarPendingTersaring = computed(() => {
      let hasil = daftarPending.value;
      const cari = cariNama.value.trim().toLowerCase();
      if (cari) hasil = hasil.filter(item => (item.data.nama_pegawai || item.data.nama || '').toLowerCase().includes(cari));
      if (filterJenis.value !== 'ALL') hasil = hasil.filter(item => item.data.status === filterJenis.value);
      if (isOwnerRole.value) {
        if (filterJenisPekerjaanOwner.value !== 'ALL') hasil = hasil.filter(item => item.jenisPekerjaan === filterJenisPekerjaanOwner.value);
        if (filterGudangOwner.value !== 'ALL') hasil = hasil.filter(item => item.data.gudang === filterGudangOwner.value);
      }
      return hasil;
    });

    async function muat() {
      memuat.value = true;
      errorMuat.value = '';
      try {
        const snap = await getDocs(query(collection(db, "absensi"), where("status_acc", "==", "PENDING")));
        const dokRelevan = [];
        snap.forEach(d => { if (STATUS_DICAKUP.includes(d.data().status)) dokRelevan.push(d); });

        // DIROMBAK (19 Agt 2026) — sama persis pola vue-antrean-absensi.js:
        // users CUMA dibaca kalau ada dokumen pending yang belum punya
        // field jenis_pekerjaan sendiri (dokumen sangat lama). Lihat
        // catatan lengkap di sana.
        const emailPerluJP = [...new Set(
          dokRelevan.filter(d => !d.data().jenis_pekerjaan && d.data().email).map(d => d.data().email)
        )];
        let petaJenisPekerjaan = {};
        const UKURAN_POTONGAN_EMAIL = 30; // batas Firestore where(field,'in',[...])
        for (let i = 0; i < emailPerluJP.length; i += UKURAN_POTONGAN_EMAIL) {
          const potongan = emailPerluJP.slice(i, i + UKURAN_POTONGAN_EMAIL);
          const qUsers = await getDocs(query(collection(db, "users"), where("email", "in", potongan)));
          qUsers.forEach(u => { petaJenisPekerjaan[u.data().email] = u.data().jenis_pekerjaan || ''; });
        }
        function ambilJP(d) { return d.jenis_pekerjaan || petaJenisPekerjaan[d.email] || ''; }

        const list = [];
        dokRelevan.forEach(docSnap => {
          const d = docSnap.data();
          if (!window.bolehLihatData(ambilJP(d), d.gudang)) return;
          list.push({ id: docSnap.id, data: d, jenisPekerjaan: ambilJP(d) });
        });
        // BARU (29 Agt 2026, §44.18) — jam shift dihitung SEKALI di sini
        // buat SELURUH daftar sekaligus (bukan per-kartu lagi, lihat
        // catatan panjang di AntreanIclCard). Chunked where(...,'in',...)
        // pola sama seperti petaJenisPekerjaan di atas. Cuma dipakai kartu
        // Lembur, tapi dihitung utk semua nama_shift yg kepakai (murah,
        // tidak perlu cabang per jenis).
        const UKURAN_POTONGAN_SHIFT = 30; // batas Firestore where(field,'in',[...])
        const distinctShift = [...new Set(list.map(item => item.data.nama_shift).filter(Boolean))];
        const petaShift = {};
        for (let i = 0; i < distinctShift.length; i += UKURAN_POTONGAN_SHIFT) {
          const potongan = distinctShift.slice(i, i + UKURAN_POTONGAN_SHIFT);
          const snapShift = await getDocs(query(collection(db, "master_shift"), where("nama_shift", "in", potongan)));
          snapShift.forEach(s => {
            const sd = s.data();
            petaShift[sd.nama_shift] = { masuk: sd.jam_masuk || null, keluar: sd.jam_keluar || null };
          });
        }
        petaShiftInfo.value = petaShift;

        daftarPending.value = list;

        if (isOwnerRole.value) {
          opsiJenisPekerjaanOwner.value = window.ambilMasterList ? await window.ambilMasterList('jenis_pekerjaan') : [];
          const qGudang = await getDocs(collection(db, "master_gudang"));
          const listGudang = [];
          qGudang.forEach(g => listGudang.push(g.data().nama_gudang));
          opsiGudangOwner.value = listGudang;
        }
      } catch (e) {
        console.error("Error muat antrean izin/cuti/lembur:", e);
        errorMuat.value = 'Gagal memuat data. Cek Console untuk detail (mungkin perlu index Firestore baru — lihat link di pesan error aslinya).';
      }
      memuat.value = false;
    }

    // BARU (29 Agt 2026, moodboard "Gechoo Mobile Organic" v2) — dropdown
    // filter Owner + tombol Cek Data Sangat Lama/Refresh dipindah ke 1
    // menu "lainnya" oval titik-tiga di sebelah kolom cari (POLA SAMA
    // PERSIS vue-antrean-absensi.js), gantikan dropdown yang SELALU
    // tampil + 2 tombol lebar penuh di banner.
    const menuTerbuka = ref(false);
    function toggleMenuTerbuka() { menuTerbuka.value = !menuTerbuka.value; }
    const adaFilterAktif = computed(() => filterJenisPekerjaanOwner.value !== 'ALL' || filterGudangOwner.value !== 'ALL' || filterJenis.value !== 'ALL');

    const memuatDataLama = ref(false);
    const infoDataLama = ref('');
    async function cekDataSangatLama() {
      memuatDataLama.value = true;
      infoDataLama.value = '';
      try {
        const snap = await getDocs(collection(db, "absensi"));
        const perluDiperbaiki = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          if (!STATUS_DICAKUP.includes(d.status)) return;
          if (d.status_acc === undefined) perluDiperbaiki.push(docSnap.id);
        });
        if (perluDiperbaiki.length === 0) {
          infoDataLama.value = 'Tidak ada data Izin/Cuti/Lembur sangat lama yang perlu diperbaiki. Aman.';
        } else {
          for (const id of perluDiperbaiki) {
            updateDoc(doc(db, "absensi", id), { status_acc: "PENDING" }).catch(() => {});
          }
          infoDataLama.value = `Ketemu & diperbaiki ${perluDiperbaiki.length} data sangat lama. Klik Refresh buat lihat di daftar.`;
        }
      } catch (e) {
        console.error("Gagal cek data sangat lama:", e);
        infoDataLama.value = 'Gagal memeriksa data sangat lama.';
      }
      memuatDataLama.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });
    return {
      daftarPending, daftarPendingTersaring, memuat, errorMuat, muat,
      cariNama, isOwnerRole, filterJenisPekerjaanOwner, filterGudangOwner, opsiJenisPekerjaanOwner, opsiGudangOwner,
      filterJenis, menuTerbuka, toggleMenuTerbuka, adaFilterAktif,
      memuatDataLama, infoDataLama, cekDataSangatLama, petaShiftInfo
    };
  },
  // ==========================================================================
  // Pola sama persis vue-antrean-absensi.js (moodboard "Gechoo Mobile
  // Organic" v2). BARU (9 Sep 2026): filter pil jenis (Semua/Izin/Cuti/
  // Lembur) ditambah di panel "menu lainnya", karena sekarang 3 jenis
  // tercampur di 1 daftar.
  // ==========================================================================
  template: `
    <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
      <div style="flex:1; min-width:0;"><kolom-cari v-model="cariNama" placeholder="Cari nama karyawan..." /></div>
      <button @click="toggleMenuTerbuka" class="gc-overflow-btn" title="Menu lainnya">
        <i class="fas fa-ellipsis"></i>
        <span v-if="adaFilterAktif" class="gc-overflow-dot"></span>
      </button>
      <div v-if="menuTerbuka" @click="toggleMenuTerbuka" class="gc-overflow-backdrop"></div>
      <div v-if="menuTerbuka" class="gc-overflow-panel">
        <div class="gc-overflow-label">Jenis</div>
        <div style="padding:2px 6px 8px;">
          <select v-model="filterJenis" style="width:100%; padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
            <option value="ALL">Semua jenis</option>
            <option value="IZIN">Izin</option>
            <option value="CUTI">Cuti</option>
            <option value="LEMBUR (CLOCK IN)">Lembur</option>
          </select>
        </div>
        <template v-if="isOwnerRole">
          <hr class="gc-overflow-sep">
          <div class="gc-overflow-label">Filter</div>
          <div style="padding:2px 6px 8px;">
            <select v-model="filterJenisPekerjaanOwner" style="width:100%; margin-bottom:6px; padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
              <option value="ALL">Semua jenis pekerjaan</option>
              <option v-for="jp in opsiJenisPekerjaanOwner" :key="jp" :value="jp">{{ jp }}</option>
            </select>
            <select v-model="filterGudangOwner" style="width:100%; padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
              <option value="ALL">Semua gudang</option>
              <option v-for="g in opsiGudangOwner" :key="g" :value="g">{{ g }}</option>
            </select>
          </div>
        </template>
        <hr class="gc-overflow-sep">
        <button @click="toggleMenuTerbuka(); cekDataSangatLama();" :disabled="memuatDataLama" class="gc-overflow-item"><i class="fas fa-magnifying-glass"></i> Cek Data Sangat Lama</button>
        <button @click="toggleMenuTerbuka(); muat();" class="gc-overflow-item"><i class="fas fa-sync-alt"></i> Refresh</button>
      </div>
    </div>
    <div class="gc-card" style="display:flex; align-items:center; gap:8px; background:var(--pink); border:none; padding:9px 14px; margin-bottom:16px;">
      <i class="fas fa-calendar-check" style="color:var(--burgundy-dark); font-size:12px;"></i>
      <b style="font-size:11px; color:var(--burgundy-dark);">Antrean validasi Izin/Cuti/Lembur</b>
      <span class="gc-badge-count">{{ daftarPendingTersaring.length }}</span>
    </div>
    <p v-if="infoDataLama" style="font-size:11px; color:var(--text-muted); margin:-10px 0 16px; padding:8px 12px; background:var(--ivory-dim); border-radius:10px;">{{ infoDataLama }}</p>

    <div v-if="memuat" style="text-align:center; padding:40px 0; color:var(--text-faint);">
      <i class="fas fa-spinner fa-spin" style="font-size:26px; margin-bottom:10px; display:block;"></i><p style="font-size:12px;">Memuat antrean validasi Izin/Cuti/Lembur...</p>
    </div>
    <div v-else-if="errorMuat" style="text-align:center; padding:40px 0; color:var(--danger); font-size:12px; background:var(--danger-light); border-radius:18px;">{{ errorMuat }}</div>
    <div v-else-if="daftarPending.length === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px;">
      <i class="fas fa-glass-cheers" style="font-size:40px; color:var(--blue-deep); margin-bottom:12px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">Semua pengajuan Izin/Cuti/Lembur telah divalidasi</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">Tidak ada antrean baru yang perlu diperiksa.</p>
    </div>
    <div v-else-if="daftarPendingTersaring.length === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px;">
      <i class="fas fa-filter-circle-xmark" style="font-size:34px; color:var(--text-faint); margin-bottom:12px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">Tidak ada yang cocok</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">Coba ubah kata kunci pencarian atau filter yang aktif.</p>
    </div>
    <div v-else style="gap:14px;" class="grid grid-cols-1 md:grid-cols-2">
      <antrean-icl-card
        v-for="item in daftarPendingTersaring" :key="item.id"
        :doc-id="item.id" :data="item.data"
        :shift-info="petaShiftInfo[item.data.nama_shift] || {masuk:null,keluar:null}"
        @diproses="muat"
      />
    </div>
  `
};

// Nama fungsi global SENGAJA DIPERTAHANKAN (pastikanMountAntreanLembur,
// bukan diganti pastikanMountAntreanICL) — lihat catatan header file:
// dashboard.js petaMount['sub-absensi-lembur'] masih memanggil nama ini,
// tidak perlu diubah.
let vmAntreanICL = null;
window.pastikanMountAntreanLembur = function() {
  if (vmAntreanICL) return;
  const mountPoint = document.getElementById('vue-antrean-lembur');
  if (mountPoint) vmAntreanICL = createApp(AppAntreanIcl).mount('#vue-antrean-lembur');
};
window.refreshAntreanLembur = function() { if (vmAntreanICL) vmAntreanICL.muat(); };
