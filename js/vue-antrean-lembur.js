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

    return { memproses, proses, hapus, bolehEdit, bolehHapus };
  },
  template: `
    <div class="gc-card">
      <div style="display:flex; align-items:center; gap:12px; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:14px;">
        <div style="width:44px; height:44px; border-radius:12px; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; color:var(--burgundy); flex-shrink:0;"><i class="fas fa-business-time"></i></div>
        <div>
          <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ data.nama_pegawai || data.nama || 'Karyawan' }}</h4>
          <p style="font-size:10.5px; color:var(--text-muted);">{{ data.email || '-' }}</p>
          <span class="tag warn" style="margin-top:5px;"><span class="tag-dot"></span>Menunggu validasi</span>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:var(--ivory-dim); padding:14px; border-radius:14px; font-size:12px; margin-bottom:14px;">
        <div><span style="color:var(--text-faint); display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">Diajukan</span> <b>{{ data.waktu || '-' }}</b></div>
        <div><span style="color:var(--text-faint); display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">Gudang</span> <b>{{ data.gudang || '-' }}</b></div>
        <div><span style="color:var(--text-faint); display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">Jam Lembur Diajukan</span> <b style="color:var(--burgundy);">{{ data.lembur_mulai || '-' }} &ndash; {{ data.lembur_selesai || '-' }}</b></div>
        <div><span style="color:var(--text-faint); display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">Instruksi Kerja</span> <b>{{ data.lembur_instruksi || '-' }}</b></div>
        <div style="grid-column:1 / -1;"><span style="color:var(--text-faint); display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">Alasan</span> <b>{{ data.keterangan || '-' }}</b></div>
      </div>
      <div v-if="bolehEdit || bolehHapus" style="display:flex; gap:8px; padding-top:12px; border-top:1px solid var(--line);">
        <button v-if="bolehEdit" @click="proses('ACC')" :disabled="memproses" class="btn-acc" style="flex:1; display:flex; align-items:center; justify-content:center;">
          <i class="fas fa-check-circle" style="margin-right:6px;"></i> Setujui Lembur
        </button>
        <button v-if="bolehEdit" @click="proses('REJECT')" :disabled="memproses" class="btn-rej" style="flex:1; display:flex; align-items:center; justify-content:center;">
          <i class="fas fa-times-circle" style="margin-right:6px;"></i> Tolak
        </button>
        <button v-if="bolehHapus" @click="hapus" class="icon-btn" title="Hapus permanen">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    </div>
  `
};

const AppAntreanLembur = {
  components: { AntreanLemburCard },
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
      memuatDataLama, infoDataLama, cekDataSangatLama
    };
  },
  template: `
    <div class="gc-card" style="display:flex; justify-content:space-between; align-items:center; background:var(--pink); border:none; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
      <div>
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; color:var(--burgundy-dark);"><i class="fas fa-business-time" style="margin-right:8px;"></i> Antrean validasi Lembur</h3>
        <p style="font-size:10.5px; color:var(--mahogany-soft); margin-top:2px;">Approve di sini menentukan jam Clock Out yang dipakai untuk penggajian.</p>
      </div>
      <div style="display:flex; gap:8px;">
        <button @click="cekDataSangatLama" :disabled="memuatDataLama" class="btn-outline" title="Cek sekali data sangat lama yang mungkin belum kebaca"><i class="fas fa-magnifying-glass" style="margin-right:6px;"></i> Cek Data Sangat Lama</button>
        <button @click="muat" class="btn-outline filled"><i class="fas fa-sync-alt" style="margin-right:6px;"></i> Refresh</button>
      </div>
    </div>
    <p v-if="infoDataLama" style="font-size:11px; color:var(--text-muted); margin:-10px 0 16px; padding:8px 12px; background:var(--ivory-dim); border-radius:10px;">{{ infoDataLama }}</p>

    <div v-if="!memuat && daftarPending.length > 0" style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:16px;">
      <div style="position:relative; flex:1; min-width:200px;">
        <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
        <input v-model="cariNama" type="text" placeholder="Cari nama karyawan..." style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
      </div>
      <template v-if="isOwnerRole">
        <select v-model="filterJenisPekerjaanOwner" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
          <option value="ALL">Semua jenis pekerjaan</option>
          <option v-for="jp in opsiJenisPekerjaanOwner" :key="jp" :value="jp">{{ jp }}</option>
        </select>
        <select v-model="filterGudangOwner" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
          <option value="ALL">Semua gudang</option>
          <option v-for="g in opsiGudangOwner" :key="g" :value="g">{{ g }}</option>
        </select>
      </template>
    </div>

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
