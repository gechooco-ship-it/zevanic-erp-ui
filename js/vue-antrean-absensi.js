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
    <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
      <div class="flex items-center space-x-3 border-b pb-3">
        <img :src="data.foto_selfie || data.foto || 'https://via.placeholder.com/150'" @click="lihatFotoBesar" class="w-16 h-16 rounded-xl object-cover border-2 border-gray-100 shadow-sm cursor-pointer">
        <div>
          <h4 class="font-bold text-slate-800 text-sm">{{ data.nama_pegawai || data.nama || 'Karyawan' }}</h4>
          <p class="text-[10px] text-gray-400 font-mono">{{ data.email || '-' }}</p>
          <span class="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-bold rounded-full mt-1"><i class="fas fa-clock mr-1"></i>Menunggu Validasi</span>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2 text-[11px] bg-gray-50 p-3 rounded-2xl text-gray-600">
        <div><span class="text-gray-400 block text-[9px] uppercase tracking-wider">Status</span> <b class="text-slate-800">{{ data.status || 'HADIR' }}</b></div>
        <div><span class="text-gray-400 block text-[9px] uppercase tracking-wider">Waktu</span> <b class="text-slate-800">{{ data.waktu || '-' }}</b></div>
        <div><span class="text-gray-400 block text-[9px] uppercase tracking-wider">Gudang</span> <b class="text-slate-800">{{ data.gudang || '-' }}</b></div>
        <div><span class="text-gray-400 block text-[9px] uppercase tracking-wider">Shift</span> <b class="text-slate-800">{{ data.shift || '-' }}</b></div>
        <div>
          <span class="text-gray-400 block text-[9px] uppercase tracking-wider">Koordinat</span>
          <b v-if="data.koordinat" class="text-slate-800">
            {{ data.koordinat.lat.toFixed(5) }}, {{ data.koordinat.lng.toFixed(5) }}<br>
            <a :href="'https://www.google.com/maps?q=' + data.koordinat.lat + ',' + data.koordinat.lng" target="_blank" class="text-blue-500 text-[9px]"><i class="fas fa-map-marker-alt"></i> Lihat di Peta</a>
          </b>
          <span v-else>-</span>
        </div>
        <div>
          <span class="text-gray-400 block text-[9px] uppercase tracking-wider">Status Radius</span>
          <span v-if="data.status_radius === 'DALAM RADIUS'" class="inline-block px-2 py-0.5 bg-green-100 text-green-700 font-bold text-[9px] rounded-full">Dalam Radius ({{ data.jarak_meter || 0 }}m)</span>
          <span v-else-if="data.status_radius === 'DI LUAR RADIUS'" class="inline-block px-2 py-0.5 bg-red-100 text-red-700 font-bold text-[9px] rounded-full">Di Luar Radius ({{ data.jarak_meter || 0 }}m)</span>
          <span v-else-if="data.status_radius === 'LOKASI DINAMIS'" class="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 font-bold text-[9px] rounded-full">Lokasi Dinamis</span>
          <span v-else class="text-gray-300">-</span>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 pt-2">
        <div>
          <label class="block text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-wider">Status Kehadiran</label>
          <select v-model="statusKehadiran" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none font-bold text-slate-700 text-xs">
            <option v-for="s in daftarStatusKehadiran" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div>
          <label class="block text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-wider">Seragam</label>
          <select v-model="seragam" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none font-bold text-slate-700 text-xs">
            <option value="Sesuai">Sesuai</option>
            <option value="Tidak Sesuai">Tidak Sesuai</option>
          </select>
        </div>
      </div>
      <div class="flex space-x-2 pt-2 border-t">
        <button @click="proses('ACC')" :disabled="memproses" class="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition shadow-sm text-xs flex items-center justify-center disabled:opacity-50">
          <i class="fas fa-check-circle mr-1"></i> Accept
        </button>
        <button @click="proses('REJECT')" :disabled="memproses" class="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-xl hover:bg-red-600 transition shadow-sm text-xs flex items-center justify-center disabled:opacity-50">
          <i class="fas fa-times-circle mr-1"></i> Reject
        </button>
        <button @click="hapus" class="bg-gray-100 text-gray-500 font-bold px-3.5 py-2.5 rounded-xl hover:bg-gray-200 transition text-xs" title="Hapus Permanen">
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

    onMounted(muat);
    return { daftarPending, daftarStatusKehadiran, memuat, muat };
  },
  template: `
    <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex justify-between items-center shadow-sm mb-4">
      <div>
        <h3 class="text-sm font-bold text-slate-700 mb-0.5"><i class="fas fa-clock mr-2"></i> Antrean Validasi Absensi</h3>
        <p class="text-[10px] text-slate-500">Klik Refresh untuk melihat pengajuan absensi terbaru.</p>
      </div>
      <button @click="muat" class="bg-slate-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-slate-900 transition"><i class="fas fa-sync-alt mr-1"></i> Refresh</button>
    </div>

    <div v-if="memuat" class="text-center py-10 text-gray-400">
      <i class="fas fa-spinner fa-spin text-3xl mb-3"></i><p class="text-xs">Memuat antrean validasi absensi...</p>
    </div>
    <div v-else-if="daftarPending.length === 0" class="text-center py-16 text-gray-400 bg-white rounded-3xl border border-dashed">
      <i class="fas fa-glass-cheers text-5xl text-blue-300 mb-4"></i>
      <h4 class="font-bold text-gray-700 text-sm">Semua Absensi Telah Tervalidasi</h4>
      <p class="text-xs text-gray-400 mt-1">Tidak ada antrean absensi baru yang perlu diperiksa.</p>
    </div>
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
