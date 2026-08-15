// js/vue-config-absensi.js
// ============================================================================
// Halaman KEDUA yang dimigrasi ke Vue: Master Absensi > Config Absensi
// (Master Gudang & Titik Lokasi + Master Shift Jam Kerja).
//
// PENTING: koleksi Firestore "master_gudang" dan "master_shift" dibaca
// langsung oleh banyak bagian lain yang BELUM dimigrasi (geofencing di
// camera.js, Penjadwalan, Daftar Karyawan, Antrean Dakar). Skema field di
// sini SENGAJA dipertahankan identik dengan versi lama supaya bagian-bagian
// itu tetap jalan normal tanpa perlu ikut diubah.
// ============================================================================
import { createApp, ref, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const MasterGudangManager = {
  setup() {
    const daftarGudang = ref([]);
    const memuat = ref(true);
    const menyimpan = ref(false);

    const nama = ref('');
    const tipeLokasi = ref('Tetap');
    const lat = ref('');
    const lng = ref('');
    const radius = ref('');

    async function muat() {
      memuat.value = true;
      const snap = await getDocs(collection(db, "master_gudang"));
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      daftarGudang.value = list;
      memuat.value = false;
    }

    function resetForm() {
      nama.value = '';
      tipeLokasi.value = 'Tetap';
      lat.value = '';
      lng.value = '';
      radius.value = '';
    }

    async function simpan() {
      if (!nama.value) return alert("Nama Gudang / Cabang harus diisi!");
      if (tipeLokasi.value === 'Tetap' && (!lat.value || !lng.value || !radius.value)) {
        return alert("Untuk lokasi Tetap, Latitude/Longitude/Radius harus diisi lengkap!");
      }

      menyimpan.value = true;
      try {
        await addDoc(collection(db, "master_gudang"), {
          nama_gudang: nama.value,
          tipe_lokasi: tipeLokasi.value,
          latitude: tipeLokasi.value === 'Tetap' ? lat.value : "",
          longitude: tipeLokasi.value === 'Tetap' ? lng.value : "",
          radius: tipeLokasi.value === 'Tetap' ? parseInt(radius.value) : 0
        });
        alert("Master Gudang Berhasil Disimpan!");
        resetForm();
        await muat();
      } catch (e) {
        console.error(e);
        alert("Gagal menyimpan data gudang ke Firebase.");
      }
      menyimpan.value = false;
    }

    async function hapus(id) {
      if (!confirm("Yakin ingin menghapus Gudang ini dari Master Data?")) return;
      await deleteDoc(doc(db, "master_gudang", id));
      await muat();
    }

    onMounted(muat);
    return { daftarGudang, memuat, menyimpan, nama, tipeLokasi, lat, lng, radius, simpan, hapus };
  },
  template: `
    <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
      <h3 class="text-sm font-bold text-slate-800 border-b pb-2"><i class="fas fa-map-marker-alt text-blue-500 mr-1.5"></i> Master Gudang & Titik Lokasi</h3>
      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold text-gray-600 mb-1">Nama Gudang / Cabang *</label>
          <input v-model="nama" type="text" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none">
        </div>
        <div>
          <label class="block font-semibold text-gray-600 mb-1">Jenis Lokasi *</label>
          <select v-model="tipeLokasi" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none">
            <option value="Tetap">Tetap (titik & radius pasti)</option>
            <option value="Dinamis">Dinamis (lapangan, lokasi bebas)</option>
          </select>
          <p class="text-[10px] text-gray-400 mt-1">Dinamis dipakai untuk orang lapangan yang visit ke mana saja — tidak ada validasi radius/koordinat saat Clock In.</p>
        </div>
        <div v-if="tipeLokasi === 'Tetap'" class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div><label class="block font-semibold text-gray-600 mb-1">Latitude *</label><input v-model="lat" type="number" step="any" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none"></div>
            <div><label class="block font-semibold text-gray-600 mb-1">Longitude *</label><input v-model="lng" type="number" step="any" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none"></div>
          </div>
          <div><label class="block font-semibold text-gray-600 mb-1">Radius Toleransi Absen (Meter) *</label><input v-model="radius" type="number" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none"></div>
        </div>
        <button @click="simpan" :disabled="menyimpan" class="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 transition shadow-sm mt-2 disabled:opacity-50">
          <i class="fas fa-save mr-1"></i> Simpan Master Gudang
        </button>
      </div>
      <div class="mt-4 pt-4 border-t">
        <h4 class="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider">Daftar Gudang Tersimpan</h4>
        <div v-if="memuat" class="text-center text-gray-400 text-xs py-3">Memuat data...</div>
        <div v-else class="overflow-x-auto rounded-xl border border-gray-100">
          <table class="w-full text-left text-[11px] text-gray-600">
            <tbody class="divide-y divide-gray-100">
              <tr v-if="daftarGudang.length === 0"><td class="p-2 text-center text-gray-400">Belum ada data gudang terdaftar.</td></tr>
              <tr v-for="g in daftarGudang" :key="g.id" class="hover:bg-gray-50 border-b border-gray-100 last:border-0">
                <td class="p-2 font-bold text-blue-800">{{ g.nama_gudang }}</td>
                <td class="p-2 text-[10px] text-gray-500 font-mono">
                  <span v-if="g.tipe_lokasi === 'Dinamis'" class="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 font-bold text-[9px] rounded-full">DINAMIS - Tanpa Radius</span>
                  <template v-else>Lat: {{ g.latitude }}<br>Lng: {{ g.longitude }}<br><span class="font-bold text-red-500">Radius: {{ g.radius }} m</span></template>
                </td>
                <td class="p-2 text-center">
                  <button @click="hapus(g.id)" class="text-red-500 hover:text-white hover:bg-red-500 font-bold px-2 py-1.5 bg-red-50 rounded-lg transition"><i class="fas fa-trash-alt"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
};

const MasterShiftManager = {
  setup() {
    const daftarShift = ref([]);
    const memuat = ref(true);
    const menyimpan = ref(false);

    const nama = ref('');
    const jamMasuk = ref('');
    const jamKeluar = ref('');

    async function muat() {
      memuat.value = true;
      const snap = await getDocs(collection(db, "master_shift"));
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      daftarShift.value = list;
      memuat.value = false;
    }

    async function simpan() {
      if (!nama.value || !jamMasuk.value || !jamKeluar.value) {
        return alert("Semua kolom Master Shift harus diisi lengkap!");
      }
      menyimpan.value = true;
      try {
        await addDoc(collection(db, "master_shift"), {
          nama_shift: nama.value,
          jam_masuk: jamMasuk.value,
          jam_keluar: jamKeluar.value
        });
        alert("Master Shift Berhasil Disimpan!");
        nama.value = ''; jamMasuk.value = ''; jamKeluar.value = '';
        await muat();
      } catch (e) {
        console.error(e);
        alert("Gagal menyimpan data shift.");
      }
      menyimpan.value = false;
    }

    async function hapus(id) {
      if (!confirm("Yakin ingin menghapus Shift ini dari Master Data?")) return;
      await deleteDoc(doc(db, "master_shift", id));
      await muat();
    }

    onMounted(muat);
    return { daftarShift, memuat, menyimpan, nama, jamMasuk, jamKeluar, simpan, hapus };
  },
  template: `
    <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
      <h3 class="text-sm font-bold text-slate-800 border-b pb-2"><i class="fas fa-clock text-amber-500 mr-1.5"></i> Master Shift Jam Kerja</h3>
      <div class="space-y-3 text-xs">
        <div><label class="block font-semibold text-gray-600 mb-1">Nama Shift *</label><input v-model="nama" type="text" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block font-semibold text-gray-600 mb-1">Jam Masuk (In) *</label><input v-model="jamMasuk" type="time" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none"></div>
          <div><label class="block font-semibold text-gray-600 mb-1">Jam Keluar (Out) *</label><input v-model="jamKeluar" type="time" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none"></div>
        </div>
        <button @click="simpan" :disabled="menyimpan" class="w-full bg-amber-500 text-white font-bold py-2.5 rounded-xl hover:bg-amber-600 transition shadow-sm mt-5 disabled:opacity-50">
          <i class="fas fa-save mr-1"></i> Simpan Master Shift
        </button>
      </div>
      <div class="mt-4 pt-4 border-t">
        <h4 class="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider">Daftar Shift Tersimpan</h4>
        <div v-if="memuat" class="text-center text-gray-400 text-xs py-3">Memuat data...</div>
        <div v-else class="overflow-x-auto rounded-xl border border-gray-100">
          <table class="w-full text-left text-[11px] text-gray-600">
            <tbody class="divide-y divide-gray-100">
              <tr v-if="daftarShift.length === 0"><td class="p-2 text-center text-gray-400">Belum ada data shift terdaftar.</td></tr>
              <tr v-for="s in daftarShift" :key="s.id" class="hover:bg-gray-50 border-b border-gray-100 last:border-0">
                <td class="p-2 font-bold text-amber-700">{{ s.nama_shift }}</td>
                <td class="p-2 text-[10px] text-gray-500 font-bold">In: <span class="text-green-600">{{ s.jam_masuk }}</span><br>Out: <span class="text-red-500">{{ s.jam_keluar }}</span></td>
                <td class="p-2 text-center">
                  <button @click="hapus(s.id)" class="text-red-500 hover:text-white hover:bg-red-500 font-bold px-2 py-1.5 bg-red-50 rounded-lg transition"><i class="fas fa-trash-alt"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
};

const AppConfigAbsensi = {
  components: { MasterGudangManager, MasterShiftManager },
  template: `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <master-gudang-manager />
      <master-shift-manager />
    </div>
  `
};

const mountPoint = document.getElementById('vue-config-absensi');
if (mountPoint) {
  createApp(AppConfigAbsensi).mount('#vue-config-absensi');
}
