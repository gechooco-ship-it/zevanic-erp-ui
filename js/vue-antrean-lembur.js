// js/vue-antrean-lembur.js
// ============================================================================
// Master Absensi > Antrean Lembur — validasi/approve pengajuan LEMBUR
// karyawan (terpisah dari Antrean Absensi biasa, 17 Agt 2026).
//
// KENAPA TERPISAH dari Antrean Absensi: pengajuan Lembur punya info yang
// beda sama sekali (jam mulai/selesai diajukan, alasan, instruksi) — bukan
// radius/koordinat/seragam seperti absensi Hadir biasa.
//
// PENTING — kenapa layar ini nyata dibutuhkan (bukan cuma kerapian UI):
// js/vue-camera.js (proses Clock Out) MEMBACA status_acc dokumen Lembur
// ini untuk menentukan batas jam kerja yang dipakai penggajian
// (jam_keluar_untuk_gaji) — kalau Lembur belum di-ACC di sini, Clock Out
// lewat jam shift akan otomatis dipotong ke jam shift, BUKAN jam lembur
// yang diajukan.
//
// DIROMBAK (18 Agt 2026):
// 1. HEMAT — where("status_acc","==","PENDING") LANGSUNG (Lembur SELALU
//    pakai status_acc tunggal, TIDAK ikut rombakan dokumen gabungan
//    vue-camera.js), bukan fetch semua histori absensi lagi.
// 2. PEDOMAN KERJA (lihat vue-antrean-absensi.js) — search box selalu
//    ada, filter Jenis Pekerjaan+Gudang cuma buat Owner/Superuser.
// ============================================================================
import { createApp, ref, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
// BARU (29 Agt 2026, moodboard "Gechoo Mobile Organic" v2) — KolomCari
// (pil, dipakai juga di Antrean Absensi) GANTI kolom cari hand-rolled.
import { KolomCari } from './vue-components.js?v=5';

const AntreanLemburCard = {
  props: {
    docId: { type: String, required: true },
    data: { type: Object, required: true }
  },
  emits: ['diproses'],
  setup(props, { emit }) {
    const memproses = ref(false);

    async function proses(statusAcc) {
      if (window.cekIzinMenu('antrean_lembur', 'edit') === false) {
        return alert('Anda tidak punya izin memproses ACC/Reject Lembur di sini. Hubungi Owner/PIC.');
      }
      memproses.value = true;
      try {
        await updateDoc(doc(db, "absensi", props.docId), {
          status_acc: statusAcc,
          validated_at: new Date().toISOString(),
          validated_by: window.currentUser.name || window.currentUser.nama || window.currentUser.email
        });
        alert(`Pengajuan Lembur berhasil di-${statusAcc}!`);
        emit('diproses');
      } catch (e) {
        console.error("Gagal update ACC Lembur:", e);
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

    // BARU (29 Agt 2026, moodboard "Gechoo Mobile Organic" v2, cek live
    // Guru di HP) — avatar dari foto_selfie: field INI SUDAH ADA di setiap
    // dokumen Lembur (dicek langsung di vue-camera.js — kamera yang sama
    // dipakai Hadir/Clock Out juga dipakai pengajuan Lembur), cuma belum
    // pernah ditampilkan di kartu ini sebelumnya.
    function lihatFotoBesar() {
      if (props.data.foto_selfie && window.bukaPreviewFoto) window.bukaPreviewFoto(props.data.foto_selfie);
    }

    // Jam Shift asli orangnya (buat dibandingkan sama Jam Lembur yang
    // diajukan) — lookup nama_shift->master_shift, POLA SAMA PERSIS
    // dengan js/vue-antrean-absensi.js (muatJamShift), Lembur belum
    // pernah punya info ini ditampilkan sebelumnya.
    const jamShift = ref({ masuk: null, keluar: null });
    async function muatJamShift() {
      if (!props.data.nama_shift) return;
      try {
        const qShift = await getDocs(query(collection(db, "master_shift"), where("nama_shift", "==", props.data.nama_shift)));
        if (!qShift.empty) {
          const s = qShift.docs[0].data();
          jamShift.value = { masuk: s.jam_masuk || null, keluar: s.jam_keluar || null };
        }
      } catch (e) {
        console.error("Gagal muat jam shift Lembur:", e);
      }
    }

    // Tanggal pengajuan singkat ("28 Agt") dari waktu_ts (Firestore
    // Timestamp, SUDAH ada di dataKirim vue-camera.js) — dulu dipakai
    // data.waktu (string toLocaleString mentah, kepanjangan buat baris
    // padat "{tanggal} - {gudang}" yang baru).
    function formatTglSingkat(ts) {
      if (!ts || typeof ts.toDate !== 'function') return '-';
      return ts.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    }

    const menuAksiTerbuka = ref(false);
    function toggleMenuAksi() { menuAksiTerbuka.value = !menuAksiTerbuka.value; }
    function tutupMenuAksi() { menuAksiTerbuka.value = false; }

    onMounted(() => { muatJamShift(); });

    return {
      memproses, proses, hapus, bolehEdit, bolehHapus, lihatFotoBesar,
      jamShift, formatTglSingkat, menuAksiTerbuka, toggleMenuAksi, tutupMenuAksi
    };
  },
  // ==========================================================================
  // TEMPLATE DIROMBAK (29 Agt 2026, moodboard "Gechoo Mobile Organic" v2,
  // dari cek live Guru di HP + mockup gechoo-mobile-organic-rollout.html
  // §Antrean Lembur) — kartu besar grid 2 kolom + tombol lebar penuh diganti
  // pola padat SAMA dengan Antrean Absensi: avatar (foto_selfie, BARU
  // ditampilkan), baris "{tanggal} - {gudang}" gantikan "Diajukan"+"Gudang"
  // terpisah, baris Jam Shift (kiri) vs Jam Lembur (kanan) buat gampang
  // dibandingkan, approve-row 2 tombol (Setujui/Tolak — Lembur TIDAK
  // punya konsep Sesuai/Tidak Sesuai seperti Absensi). Instruksi Kerja
  // TETAP ditampilkan (baris kecil terpisah) — TIDAK di mockup awal, tapi
  // sengaja tidak dihilangkan karena info operasional buat penyetuju,
  // cuma dibikin sekecil mungkin biar tetap padat.
  // Field/logic Firestore, cekIzinMenu, proses/hapus — TIDAK ada yang
  // berubah, cuma tampilannya.
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
        <span class="tag warn" style="flex-shrink:0;"><span class="tag-dot"></span>Menunggu</span>
        <div v-if="bolehHapus" style="position:relative; flex-shrink:0;">
          <button @click="toggleMenuAksi" class="icon-btn" style="border-radius:50%; border:none; background:none;" title="Aksi lainnya"><i class="fas fa-ellipsis-vertical"></i></button>
          <div v-if="menuAksiTerbuka" @click="tutupMenuAksi" style="position:fixed; inset:0; z-index:60;"></div>
          <div v-if="menuAksiTerbuka" style="position:absolute; right:0; top:34px; z-index:61; background:var(--surface); border:1px solid var(--line); border-radius:14px; box-shadow:0 10px 24px -6px rgba(31,22,17,.3); padding:6px; min-width:150px;">
            <button @click="tutupMenuAksi(); hapus();" style="width:100%; text-align:left; background:none; border:none; padding:9px 11px; border-radius:9px; font-size:12px; font-weight:600; color:var(--danger); cursor:pointer; display:flex; align-items:center; gap:8px;"><i class="fas fa-trash-alt"></i> Hapus permanen</button>
          </div>
        </div>
      </div>

      <div style="display:flex; align-items:flex-start; gap:8px; padding:2px 0 8px;">
        <div style="text-align:left;"><span style="font-size:9px; color:var(--text-faint); display:block; text-transform:uppercase; letter-spacing:.04em;">Jam Shift</span><b style="font-size:11px;">{{ (jamShift.masuk && jamShift.keluar) ? (jamShift.masuk + '–' + jamShift.keluar) : '-' }}</b></div>
        <div style="text-align:right; margin-left:auto;"><span style="font-size:9px; color:var(--text-faint); display:block; text-transform:uppercase; letter-spacing:.04em;">Jam Lembur</span><b style="font-size:11px; color:var(--burgundy);">{{ data.lembur_mulai || '-' }}&ndash;{{ data.lembur_selesai || '-' }}</b></div>
      </div>
      <p v-if="data.lembur_instruksi" style="font-size:9.5px; color:var(--text-faint); padding:0 0 3px;"><b>Instruksi:</b> {{ data.lembur_instruksi }}</p>
      <p style="font-size:9.5px; color:var(--text-muted); padding:0 0 6px;">{{ data.keterangan || '-' }}</p>

      <div v-if="bolehEdit" class="approve-row">
        <button @click="proses('ACC')" :disabled="memproses" class="appr-btn ok"><i class="fas fa-check"></i> Setujui</button>
        <button @click="proses('REJECT')" :disabled="memproses" class="appr-btn danger"><i class="fas fa-times"></i> Tolak</button>
      </div>
    </div>
  `
};

const AppAntreanLembur = {
  components: { AntreanLemburCard, KolomCari },
  setup() {
    const daftarPending = ref([]);
    const memuat = ref(true);
    const errorMuat = ref('');

    const cariNama = ref('');
    const isOwnerRole = computed(() => ['owner', 'superuser'].includes((window.currentUser.role || '').toLowerCase()));
    const filterJenisPekerjaanOwner = ref('ALL');
    const filterGudangOwner = ref('ALL');
    const opsiJenisPekerjaanOwner = ref([]);
    const opsiGudangOwner = ref([]);
    const daftarPendingTersaring = computed(() => {
      let hasil = daftarPending.value;
      const cari = cariNama.value.trim().toLowerCase();
      if (cari) hasil = hasil.filter(item => (item.data.nama_pegawai || item.data.nama || '').toLowerCase().includes(cari));
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
        const dokLembur = [];
        snap.forEach(d => { if (d.data().status === "LEMBUR (CLOCK IN)") dokLembur.push(d); });

        // DIROMBAK (19 Agt 2026) — sama persis pola vue-antrean-absensi.js:
        // users CUMA dibaca kalau ada dokumen Lembur pending yang belum
        // punya field jenis_pekerjaan sendiri (dokumen sangat lama). Lihat
        // catatan lengkap di sana.
        const adaYangBelumPunyaJP = dokLembur.some(d => !d.data().jenis_pekerjaan);
        let petaJenisPekerjaan = {};
        if (adaYangBelumPunyaJP) {
          const qUsers = await getDocs(collection(db, "users"));
          qUsers.forEach(u => { petaJenisPekerjaan[u.data().email] = u.data().jenis_pekerjaan || ''; });
        }
        function ambilJP(d) { return d.jenis_pekerjaan || petaJenisPekerjaan[d.email] || ''; }

        const list = [];
        dokLembur.forEach(docSnap => {
          const d = docSnap.data();
          if (!window.bolehLihatData(ambilJP(d), d.gudang)) return;
          list.push({ id: docSnap.id, data: d, jenisPekerjaan: ambilJP(d) });
        });
        daftarPending.value = list;

        if (isOwnerRole.value) {
          opsiJenisPekerjaanOwner.value = window.ambilMasterList ? await window.ambilMasterList('jenis_pekerjaan') : [];
          const qGudang = await getDocs(collection(db, "master_gudang"));
          const listGudang = [];
          qGudang.forEach(g => listGudang.push(g.data().nama_gudang));
          opsiGudangOwner.value = listGudang;
        }
      } catch (e) {
        console.error("Error muat antrean lembur:", e);
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
    const adaFilterAktif = computed(() => filterJenisPekerjaanOwner.value !== 'ALL' || filterGudangOwner.value !== 'ALL');

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
          if (d.status !== "LEMBUR (CLOCK IN)") return;
          if (d.status_acc === undefined) perluDiperbaiki.push(docSnap.id);
        });
        if (perluDiperbaiki.length === 0) {
          infoDataLama.value = 'Tidak ada data Lembur sangat lama yang perlu diperbaiki. Aman.';
        } else {
          for (const id of perluDiperbaiki) {
            updateDoc(doc(db, "absensi", id), { status_acc: "PENDING" }).catch(() => {});
          }
          infoDataLama.value = `Ketemu & diperbaiki ${perluDiperbaiki.length} data Lembur sangat lama. Klik Refresh buat lihat di daftar.`;
        }
      } catch (e) {
        console.error("Gagal cek data lembur sangat lama:", e);
        infoDataLama.value = 'Gagal memeriksa data sangat lama.';
      }
      memuatDataLama.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });
    return {
      daftarPending, daftarPendingTersaring, memuat, errorMuat, muat,
      cariNama, isOwnerRole, filterJenisPekerjaanOwner, filterGudangOwner, opsiJenisPekerjaanOwner, opsiGudangOwner,
      menuTerbuka, toggleMenuTerbuka, adaFilterAktif,
      memuatDataLama, infoDataLama, cekDataSangatLama
    };
  },
  // ==========================================================================
  // DIROMBAK (29 Agt 2026, moodboard "Gechoo Mobile Organic" v2, dari cek
  // live Guru di HP) — Lembur BELUM PERNAH ikut redesain sebelumnya, jadi
  // ini penerapan POLA LENGKAP pertama kalinya di sini: KolomCari (pil),
  // banner dipadatkan & dipindah ke bawah kolom cari, dropdown filter Owner
  // + Cek Data Sangat Lama/Refresh masuk ke menu oval titik-tiga
  // (.gc-overflow-btn) — sama persis pola vue-antrean-absensi.js. Logic
  // Firestore/query/proses('ACC'/'REJECT') TIDAK berubah sama sekali.
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
        <template v-if="isOwnerRole">
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
          <hr class="gc-overflow-sep">
        </template>
        <button @click="toggleMenuTerbuka(); cekDataSangatLama();" :disabled="memuatDataLama" class="gc-overflow-item"><i class="fas fa-magnifying-glass"></i> Cek Data Sangat Lama</button>
        <button @click="toggleMenuTerbuka(); muat();" class="gc-overflow-item"><i class="fas fa-sync-alt"></i> Refresh</button>
      </div>
    </div>
    <div class="gc-card" style="display:flex; align-items:center; gap:8px; background:var(--pink); border:none; padding:9px 14px; margin-bottom:16px;">
      <i class="fas fa-business-time" style="color:var(--burgundy-dark); font-size:12px;"></i>
      <b style="font-size:11px; color:var(--burgundy-dark);">Antrean validasi Lembur</b>
      <span class="gc-badge-count">{{ daftarPendingTersaring.length }}</span>
    </div>
    <p v-if="infoDataLama" style="font-size:11px; color:var(--text-muted); margin:-10px 0 16px; padding:8px 12px; background:var(--ivory-dim); border-radius:10px;">{{ infoDataLama }}</p>

    <div v-if="memuat" style="text-align:center; padding:40px 0; color:var(--text-faint);">
      <i class="fas fa-spinner fa-spin" style="font-size:26px; margin-bottom:10px; display:block;"></i><p style="font-size:12px;">Memuat antrean validasi lembur...</p>
    </div>
    <div v-else-if="errorMuat" style="text-align:center; padding:40px 0; color:var(--danger); font-size:12px; background:var(--danger-light); border-radius:18px;">{{ errorMuat }}</div>
    <div v-else-if="daftarPending.length === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px;">
      <i class="fas fa-glass-cheers" style="font-size:40px; color:var(--blue-deep); margin-bottom:12px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">Semua pengajuan lembur telah divalidasi</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">Tidak ada antrean lembur baru yang perlu diperiksa.</p>
    </div>
    <div v-else-if="daftarPendingTersaring.length === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px;">
      <i class="fas fa-filter-circle-xmark" style="font-size:34px; color:var(--text-faint); margin-bottom:12px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">Tidak ada yang cocok</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">Coba ubah kata kunci pencarian atau filter yang aktif.</p>
    </div>
    <div v-else style="gap:14px;" class="grid grid-cols-1 md:grid-cols-2">
      <antrean-lembur-card
        v-for="item in daftarPendingTersaring" :key="item.id"
        :doc-id="item.id" :data="item.data"
        @diproses="muat"
      />
    </div>
  `
};

let vmAntreanLembur = null;
window.pastikanMountAntreanLembur = function() {
  if (vmAntreanLembur) return;
  const mountPoint = document.getElementById('vue-antrean-lembur');
  if (mountPoint) vmAntreanLembur = createApp(AppAntreanLembur).mount('#vue-antrean-lembur');
};
window.refreshAntreanLembur = function() { if (vmAntreanLembur) vmAntreanLembur.muat(); };
