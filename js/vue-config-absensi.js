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

    onMounted(async () => { await window.authReady; muat(); });
    return { daftarGudang, memuat, menyimpan, nama, tipeLokasi, lat, lng, radius, simpan, hapus };
  },
  template: `
    <div class="gc-card">
      <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:14px;"><i class="fas fa-map-marker-alt" style="color:var(--burgundy); margin-right:8px;"></i> Master Gudang & Titik Lokasi</h3>
      <div class="gc-field">
        <label>Nama gudang / cabang *</label>
        <input v-model="nama" type="text">
      </div>
      <div class="gc-field">
        <label>Jenis lokasi *</label>
        <select v-model="tipeLokasi">
          <option value="Tetap">Tetap (titik & radius pasti)</option>
          <option value="Dinamis">Dinamis (lapangan, lokasi bebas)</option>
        </select>
        <p style="font-size:10.5px; color:var(--text-faint); margin-top:5px;">Dinamis dipakai untuk orang lapangan yang visit ke mana saja — tidak ada validasi radius/koordinat saat Clock In.</p>
      </div>
      <div v-if="tipeLokasi === 'Tetap'">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div class="gc-field"><label>Latitude *</label><input v-model="lat" type="number" step="any"></div>
          <div class="gc-field"><label>Longitude *</label><input v-model="lng" type="number" step="any"></div>
        </div>
        <div class="gc-field"><label>Radius toleransi absen (meter) *</label><input v-model="radius" type="number"></div>
      </div>
      <button @click="simpan" :disabled="menyimpan" class="btn-primary block" style="margin-top:6px;">
        <i class="fas fa-save" style="margin-right:6px;"></i> Simpan master gudang
      </button>
      <div style="margin-top:18px; padding-top:16px; border-top:1px solid var(--line);">
        <h4 style="font-size:10px; font-weight:700; color:var(--text-faint); text-transform:uppercase; letter-spacing:.05em; margin-bottom:10px;">Daftar gudang tersimpan</h4>
        <div v-if="memuat" style="text-align:center; color:var(--text-faint); font-size:12px; padding:12px 0;">Memuat data...</div>
        <div v-else style="display:flex; flex-direction:column; gap:8px;">
          <div v-if="daftarGudang.length === 0" style="text-align:center; color:var(--text-faint); font-size:12px; padding:12px 0;">Belum ada data gudang terdaftar.</div>
          <div v-for="g in daftarGudang" :key="g.id" style="display:flex; justify-content:space-between; align-items:center; background:var(--ivory-dim); padding:10px 12px; border-radius:12px;">
            <div>
              <div style="font-weight:700; color:var(--burgundy-dark); font-size:12.5px;">{{ g.nama_gudang }}</div>
              <div style="font-size:10px; color:var(--text-muted); font-family:'Poppins',sans-serif; margin-top:2px;">
                <span v-if="g.tipe_lokasi === 'Dinamis'" class="tag blue">Dinamis — tanpa radius</span>
                <template v-else>Lat: {{ g.latitude }} &bull; Lng: {{ g.longitude }} &bull; <b style="color:var(--danger);">Radius: {{ g.radius }}m</b></template>
              </div>
            </div>
            <button @click="hapus(g.id)" class="icon-btn" style="color:var(--danger); flex-shrink:0;"><i class="fas fa-trash-alt"></i></button>
          </div>
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

    onMounted(async () => { await window.authReady; muat(); });
    return { daftarShift, memuat, menyimpan, nama, jamMasuk, jamKeluar, simpan, hapus };
  },
  template: `
    <div class="gc-card">
      <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:14px;"><i class="fas fa-clock" style="color:var(--burgundy); margin-right:8px;"></i> Master Shift Jam Kerja</h3>
      <div class="gc-field"><label>Nama shift *</label><input v-model="nama" type="text"></div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="gc-field"><label>Jam masuk (in) *</label><input v-model="jamMasuk" type="time"></div>
        <div class="gc-field"><label>Jam keluar (out) *</label><input v-model="jamKeluar" type="time"></div>
      </div>
      <button @click="simpan" :disabled="menyimpan" class="btn-primary block" style="margin-top:6px;">
        <i class="fas fa-save" style="margin-right:6px;"></i> Simpan master shift
      </button>
      <div style="margin-top:18px; padding-top:16px; border-top:1px solid var(--line);">
        <h4 style="font-size:10px; font-weight:700; color:var(--text-faint); text-transform:uppercase; letter-spacing:.05em; margin-bottom:10px;">Daftar shift tersimpan</h4>
        <div v-if="memuat" style="text-align:center; color:var(--text-faint); font-size:12px; padding:12px 0;">Memuat data...</div>
        <div v-else style="display:flex; flex-direction:column; gap:8px;">
          <div v-if="daftarShift.length === 0" style="text-align:center; color:var(--text-faint); font-size:12px; padding:12px 0;">Belum ada data shift terdaftar.</div>
          <div v-for="s in daftarShift" :key="s.id" style="display:flex; justify-content:space-between; align-items:center; background:var(--ivory-dim); padding:10px 12px; border-radius:12px;">
            <div>
              <div style="font-weight:700; color:var(--burgundy-dark); font-size:12.5px;">{{ s.nama_shift }}</div>
              <div style="font-size:10.5px; color:var(--text-muted); font-family:'Poppins',sans-serif; margin-top:2px;">In: <b style="color:var(--ok);">{{ s.jam_masuk }}</b> &bull; Out: <b style="color:var(--danger);">{{ s.jam_keluar }}</b></div>
            </div>
            <button @click="hapus(s.id)" class="icon-btn" style="color:var(--danger); flex-shrink:0;"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>
      </div>
    </div>
  `
};

const AppConfigAbsensi = {
  components: { MasterGudangManager, MasterShiftManager },
  data() {
    return { refreshKey: 0 };
  },
  template: `
    <div style="gap:14px;" class="grid grid-cols-1 md:grid-cols-2">
      <master-gudang-manager :key="'gudang-' + refreshKey" />
      <master-shift-manager :key="'shift-' + refreshKey" />
    </div>
  `
};

let vmConfigAbsensi = null;
// Sama seperti layar admin lain — mount() ditunda sampai benar-benar
// dinavigasi pertama kali. Karena anak-anaknya (Master Gudang, Master
// Shift) baru MUNCUL setelah induknya di-mount, menunda mount induk ini
// otomatis ikut menunda fetch pertama kedua anaknya juga.
window.pastikanMountConfigAbsensi = function() {
  if (vmConfigAbsensi) return;
  const mountPoint = document.getElementById('vue-config-absensi');
  if (mountPoint) vmConfigAbsensi = createApp(AppConfigAbsensi).mount('#vue-config-absensi');
};
window.refreshConfigAbsensi = function() { if (vmConfigAbsensi) vmConfigAbsensi.refreshKey++; };
