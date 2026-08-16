// js/vue-antrean-absensi.js
// ============================================================================
// Halaman KELIMA yang dimigrasi ke Vue: Master Absensi > Antrean Absensi
// (validasi/approve pengajuan absensi karyawan).
//
// PENTING: window.hapusAbsensi (dipanggil di sini) juga dipakai oleh Riwayat
// All Absensi yang belum dimigrasi — TIDAK dihapus dari dashboard.js, tetap
// dipanggil apa adanya lewat window.
// ============================================================================
import { createApp, ref, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const AntreanAbsensiCard = {
  props: {
    docId: { type: String, required: true },
    data: { type: Object, required: true },
    daftarStatusKehadiran: { type: Array, required: true }
  },
  emits: ['diproses'],
  setup(props, { emit }) {
    const statusKehadiran = ref(props.data.status_kehadiran || '');
    const seragam = ref(props.data.seragam || 'Sesuai');
    const memproses = ref(false);

    function lihatFotoBesar() {
      const url = props.data.foto_selfie || props.data.foto;
      if (url && window.bukaPreviewFoto) window.bukaPreviewFoto(url);
    }

    async function proses(statusAcc) {
      memproses.value = true;
      try {
        await updateDoc(doc(db, "absensi", props.docId), {
          status_acc: statusAcc,
          status_kehadiran: statusKehadiran.value,
          seragam: seragam.value,
          validated_at: new Date().toISOString(),
          validated_by: window.currentUser.name || window.currentUser.nama || window.currentUser.email
        });
        alert(`Absensi berhasil di-${statusAcc}! Data telah berpindah ke Riwayat All Absensi.`);
        emit('diproses');
      } catch (e) {
        console.error("Gagal update ACC:", e);
        alert("Terjadi kesalahan sistem saat memproses validasi.");
      }
      memproses.value = false;
    }

    function hapus() {
      // Fungsi bersama (juga dipakai Riwayat All Absensi yang belum dimigrasi)
      if (window.hapusAbsensi) window.hapusAbsensi(props.docId).then(() => emit('diproses'));
    }

    return { statusKehadiran, seragam, memproses, lihatFotoBesar, proses, hapus };
  },
  template: `
    <div class="gc-card">
      <div style="display:flex; align-items:center; gap:12px; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:14px;">
        <img :src="data.foto_selfie || data.foto || 'https://via.placeholder.com/150'" @click="lihatFotoBesar" style="width:64px; height:64px; border-radius:14px; object-fit:cover; border:2px solid var(--surface); box-shadow:0 2px 8px rgba(91,56,38,.1); cursor:pointer;">
        <div>
          <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ data.nama_pegawai || data.nama || 'Karyawan' }}</h4>
          <p style="font-size:10.5px; color:var(--text-muted); font-family:'Poppins',sans-serif;">{{ data.email || '-' }}</p>
          <span class="tag warn" style="margin-top:5px;"><span class="tag-dot"></span>Menunggu validasi</span>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:var(--ivory-dim); padding:14px; border-radius:14px; font-size:12px; margin-bottom:14px;">
        <div><span style="color:var(--text-faint); display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">Status</span> <b>{{ data.status || 'HADIR' }}</b></div>
        <div><span style="color:var(--text-faint); display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">Waktu</span> <b>{{ data.waktu || '-' }}</b></div>
        <div><span style="color:var(--text-faint); display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">Gudang</span> <b>{{ data.gudang || '-' }}</b></div>
        <div><span style="color:var(--text-faint); display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">Shift</span> <b>{{ data.shift || '-' }}</b></div>
        <div>
          <span style="color:var(--text-faint); display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">Koordinat</span>
          <b v-if="data.koordinat">
            {{ data.koordinat.lat.toFixed(5) }}, {{ data.koordinat.lng.toFixed(5) }}<br>
            <a :href="'https://www.google.com/maps?q=' + data.koordinat.lat + ',' + data.koordinat.lng" target="_blank" style="color:var(--burgundy); font-size:9.5px; font-weight:600;"><i class="fas fa-map-marker-alt"></i> Lihat di peta</a>
          </b>
          <span v-else style="color:var(--text-faint);">-</span>
        </div>
        <div>
          <span style="color:var(--text-faint); display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">Status radius</span>
          <span v-if="data.status_radius === 'DALAM RADIUS'" class="tag ok">Dalam radius ({{ data.jarak_meter || 0 }}m)</span>
          <span v-else-if="data.status_radius === 'DI LUAR RADIUS'" class="tag danger">Di luar radius ({{ data.jarak_meter || 0 }}m)</span>
          <span v-else-if="data.status_radius === 'LOKASI DINAMIS'" class="tag blue">Lokasi dinamis</span>
          <span v-else style="color:var(--text-faint);">-</span>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
        <div class="gc-field" style="margin-bottom:0;">
          <label style="font-size:10.5px;">Status kehadiran</label>
          <select v-model="statusKehadiran" style="padding:8px 10px; font-size:12px; font-weight:600;">
            <option v-for="s in daftarStatusKehadiran" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="gc-field" style="margin-bottom:0;">
          <label style="font-size:10.5px;">Seragam</label>
          <select v-model="seragam" style="padding:8px 10px; font-size:12px; font-weight:600;">
            <option value="Sesuai">Sesuai</option>
            <option value="Tidak Sesuai">Tidak Sesuai</option>
          </select>
        </div>
      </div>
      <div style="display:flex; gap:8px; padding-top:12px; border-top:1px solid var(--line);">
        <button @click="proses('ACC')" :disabled="memproses" class="btn-acc" style="flex:1; display:flex; align-items:center; justify-content:center;">
          <i class="fas fa-check-circle" style="margin-right:6px;"></i> Accept
        </button>
        <button @click="proses('REJECT')" :disabled="memproses" class="btn-rej" style="flex:1; display:flex; align-items:center; justify-content:center;">
          <i class="fas fa-times-circle" style="margin-right:6px;"></i> Reject
        </button>
        <button @click="hapus" class="icon-btn" title="Hapus permanen">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    </div>
  `
};

const AppAntreanAbsensi = {
  components: { AntreanAbsensiCard },
  setup() {
    const daftarPending = ref([]);
    const daftarStatusKehadiran = ref(["Ontime", "Terlambat", "Tidak Absen"]);
    const memuat = ref(true);

    async function muat() {
      memuat.value = true;
      try {
        daftarStatusKehadiran.value = window.ambilMasterList ? await window.ambilMasterList('status_kehadiran') : daftarStatusKehadiran.value;
        const snap = await getDocs(collection(db, "absensi"));
        const list = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          if (!d.status_acc || d.status_acc === "PENDING") list.push({ id: docSnap.id, data: d });
        });
        daftarPending.value = list;
      } catch (e) {
        console.error("Error muat antrean absensi:", e);
      }
      memuat.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });
    return { daftarPending, daftarStatusKehadiran, memuat, muat };
  },
  template: `
    <div class="gc-card" style="display:flex; justify-content:space-between; align-items:center; background:var(--pink); border:none; margin-bottom:16px;">
      <div>
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; color:var(--burgundy-dark);"><i class="fas fa-clock" style="margin-right:8px;"></i> Antrean validasi absensi</h3>
        <p style="font-size:10.5px; color:var(--mahogany-soft); margin-top:2px;">Klik Refresh untuk melihat pengajuan absensi terbaru.</p>
      </div>
      <button @click="muat" class="btn-outline filled"><i class="fas fa-sync-alt" style="margin-right:6px;"></i> Refresh</button>
    </div>

    <div v-if="memuat" style="text-align:center; padding:40px 0; color:var(--text-faint);">
      <i class="fas fa-spinner fa-spin" style="font-size:26px; margin-bottom:10px; display:block;"></i><p style="font-size:12px;">Memuat antrean validasi absensi...</p>
    </div>
    <div v-else-if="daftarPending.length === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px;">
      <i class="fas fa-glass-cheers" style="font-size:40px; color:var(--blue-deep); margin-bottom:12px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">Semua absensi telah tervalidasi</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">Tidak ada antrean absensi baru yang perlu diperiksa.</p>
    </div>
    <div v-else style="gap:14px;" class="grid grid-cols-1 md:grid-cols-2">
      <antrean-absensi-card
        v-for="item in daftarPending" :key="item.id"
        :doc-id="item.id" :data="item.data" :daftar-status-kehadiran="daftarStatusKehadiran"
        @diproses="muat"
      />
    </div>
  `
};

const mountPoint = document.getElementById('vue-antrean-absensi');
if (mountPoint) {
  createApp(AppAntreanAbsensi).mount('#vue-antrean-absensi');
}
