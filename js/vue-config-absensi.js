// js/vue-config-absensi.js
// ============================================================================
// Halaman KEDUA yang dimigrasi ke Vue: Master Absensi > Config Absensi.
//
// DIROMBAK (18 Agt 2026) — dulu Master Gudang & Master Shift tampil
// BARENGAN begitu Config Absensi dibuka (2 kartu sebelahan), jadi KEDUA
// koleksi ("master_gudang" DAN "master_shift") kebaca sekaligus walau
// orangnya cuma mau lihat salah satu. SEKARANG dipecah jadi 3 sub-tab
// (Master Gudang / Master Shift / Jenis Pekerjaan) — tiap koleksi CUMA
// dibaca begitu sub-tab-nya benar-benar dibuka pertama kali (pola
// "mount sekali, sisanya tinggal show/hide" — v-if buat mount pertama,
// v-show buat pindah-pindah selanjutnya TANPA fetch ulang).
//
// Sub-tab "Jenis Pekerjaan" PAKAI ULANG komponen bersama
// MasterDataCategory (vue-components.js, sama yang dipakai 9 kategori
// lain di Config Karyawan) — BUKAN komponen baru. Prop menuId="config_absensi"
// WAJIB disertakan supaya izinnya dicek ke menu yang benar (lihat catatan
// di vue-components.js kenapa prop ini ditambahkan).
//
// PENTING: koleksi Firestore "master_gudang" dan "master_shift" dibaca
// langsung oleh banyak bagian lain yang BELUM dimigrasi (geofencing di
// camera.js, Penjadwalan, Daftar Karyawan, Antrean Dakar). Skema field di
// sini SENGAJA dipertahankan identik dengan versi lama supaya bagian-bagian
// itu tetap jalan normal tanpa perlu ikut diubah.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { MasterDataCategory } from './vue-components.js';
import { pakaiRiwayatTabVue } from './vue-riwayat-tab.js?v=1';

const MasterGudangManager = {
  setup() {
    const daftarGudang = ref([]);
    const memuat = ref(true);
    const menyimpan = ref(false);
    const opsiJenisPekerjaan = ref([]);

    const nama = ref('');
    const tipeLokasi = ref('Tetap');
    const lat = ref('');
    const lng = ref('');
    const radius = ref('');
    // BARU (18 Agt 2026) — 1 gudang bisa dipakai LEBIH DARI 1 jenis
    // pekerjaan (misal Operator Gudang & Checker sama-sama kerja di
    // gudang yang sama), jadi array (checkbox), bukan dropdown 1 pilihan.
    // Dipakai Penjadwalan/Antrean Dakar buat nyaring dropdown gudang
    // sesuai jenis pekerjaan Admin yang login (lihat PETA-DATABASE.md).
    const jenisPekerjaanBaru = ref([]);

    // ---- Edit jenis pekerjaan untuk data yang SUDAH ADA sebelumnya ----
    const sedangEditId = ref(null);
    const editNama = ref('');
    const editJenisPekerjaan = ref([]);
    const menyimpanEdit = ref(false);

    // PENERAPAN NYATA Config Akses — kunci dropdown Jenis Lokasi kalau
    // role ini SENGAJA dilarang mengubahnya (fitur "ubah_jenis_lokasi" di
    // menu config_absensi, diatur lewat Config Akses). Sama seperti
    // pengaman lain: kalau BELUM DIATUR sama sekali (null), dianggap
    // BOLEH — supaya tidak ada yang tiba-tiba terkunci keluar cuma
    // karena Config Akses belum sempat dibuat untuk role itu.
    const bolehUbahJenisLokasi = computed(() => {
      const izin = window.cekFiturAkses('config_absensi', 'ubah_jenis_lokasi');
      return izin === false ? false : true;
    });

    async function muat() {
      memuat.value = true;
      const snap = await getDocs(collection(db, "master_gudang"));
      const list = [];
      // BARU (18 Agt 2026) — PEDOMAN KERJA: Admin cuma lihat gudang yang
      // jenis pekerjaannya cocok DAN nama gudangnya ada di gudang_penempatan
      // dia sendiri. Owner/Superuser tetap lihat semua (bypass di dalam
      // bolehLihatData).
      snap.forEach(d => {
        const g = d.data();
        if (window.bolehLihatData(g.jenis_pekerjaan, [g.nama_gudang])) list.push({ id: d.id, ...g });
      });
      daftarGudang.value = list;
      opsiJenisPekerjaan.value = window.ambilMasterList ? await window.ambilMasterList('jenis_pekerjaan') : [];
      memuat.value = false;
    }

    function resetForm() {
      nama.value = '';
      tipeLokasi.value = 'Tetap';
      lat.value = '';
      lng.value = '';
      radius.value = '';
      jenisPekerjaanBaru.value = [];
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
          radius: tipeLokasi.value === 'Tetap' ? parseInt(radius.value) : 0,
          jenis_pekerjaan: jenisPekerjaanBaru.value
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
      if (window.cekIzinMenu('config_absensi', 'delete') === false) {
        return alert('Anda tidak punya izin menghapus data di sini. Hubungi Owner/PIC.');
      }
      if (!confirm("Yakin ingin menghapus Gudang ini dari Master Data?")) return;
      await deleteDoc(doc(db, "master_gudang", id));
      await muat();
    }

    function mulaiEdit(g) {
      sedangEditId.value = g.id;
      editNama.value = g.nama_gudang || '';
      editJenisPekerjaan.value = [...(g.jenis_pekerjaan || [])];
    }
    function batalEdit() {
      sedangEditId.value = null;
      editNama.value = '';
      editJenisPekerjaan.value = [];
    }
    // Ganti nama dari "simpanEditJenisPekerjaan" -> "simpanEdit" (sekarang
    // simpan Nama Gudang JUGA, bukan cuma jenis pekerjaan — permintaan
    // checklist rebuild 18 Agt 2026). Nama fungsi lama dipertahankan
    // sebagai alias di bawah biar titik panggil template tidak perlu ikut
    // berubah semua.
    async function simpanEdit(id) {
      if (!editNama.value.trim()) return alert("Nama Gudang tidak boleh kosong!");
      menyimpanEdit.value = true;
      try {
        await updateDoc(doc(db, "master_gudang", id), { nama_gudang: editNama.value.trim(), jenis_pekerjaan: editJenisPekerjaan.value });
        sedangEditId.value = null;
        await muat();
      } catch (e) {
        console.error("Gagal simpan perubahan gudang:", e);
        alert("Gagal menyimpan perubahan.");
      }
      menyimpanEdit.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });
    const bolehHapus = computed(() => window.cekIzinMenu('config_absensi', 'delete') !== false);
    const bolehEdit = computed(() => window.cekIzinMenu('config_absensi', 'edit') !== false);

    return {
      daftarGudang, memuat, menyimpan, nama, tipeLokasi, lat, lng, radius, opsiJenisPekerjaan, jenisPekerjaanBaru,
      simpan, hapus, bolehUbahJenisLokasi, bolehHapus, bolehEdit,
      sedangEditId, editNama, editJenisPekerjaan, menyimpanEdit, mulaiEdit, batalEdit, simpanEdit
    };
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
        <select v-model="tipeLokasi" :disabled="!bolehUbahJenisLokasi">
          <option value="Tetap">Tetap (titik & radius pasti)</option>
          <option value="Dinamis">Dinamis (lapangan, lokasi bebas)</option>
        </select>
        <p v-if="!bolehUbahJenisLokasi" style="font-size:10.5px; color:var(--danger); margin-top:5px;"><i class="fas fa-lock" style="margin-right:4px;"></i>Cuma Owner yang bisa ubah Jenis Lokasi. Hubungi Owner kalau perlu diubah.</p>
        <p v-else style="font-size:10.5px; color:var(--text-faint); margin-top:5px;">Dinamis dipakai untuk orang lapangan yang visit ke mana saja — tidak ada validasi radius/koordinat saat Clock In.</p>
      </div>
      <div v-if="tipeLokasi === 'Tetap'">
        <div style="display:grid; gap:12px;" class="grid-cols-1 md:grid-cols-2">
          <div class="gc-field"><label>Latitude *</label><input v-model="lat" type="number" step="any"></div>
          <div class="gc-field"><label>Longitude *</label><input v-model="lng" type="number" step="any"></div>
        </div>
        <div class="gc-field"><label>Radius toleransi absen (meter) *</label><input v-model="radius" type="number"></div>
      </div>
      <div class="gc-field">
        <label>Jenis pekerjaan yang pakai gudang ini <span style="font-weight:400; color:var(--text-faint);">(boleh lebih dari 1)</span></label>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          <label v-for="jp in opsiJenisPekerjaan" :key="jp" style="display:flex; align-items:center; gap:5px; font-size:11.5px; background:var(--ivory-dim); padding:5px 10px; border-radius:20px; cursor:pointer;">
            <input type="checkbox" :value="jp" v-model="jenisPekerjaanBaru" style="accent-color:var(--burgundy);">{{ jp }}
          </label>
        </div>
      </div>
      <button @click="simpan" :disabled="menyimpan" class="btn-primary block" style="margin-top:6px;">
        <i class="fas fa-save" style="margin-right:6px;"></i> Simpan master gudang
      </button>
      <div style="margin-top:18px; padding-top:16px; border-top:1px solid var(--line);">
        <h4 style="font-size:10px; font-weight:700; color:var(--text-faint); text-transform:uppercase; letter-spacing:.05em; margin-bottom:10px;">Daftar gudang tersimpan</h4>
        <div v-if="memuat" style="text-align:center; color:var(--text-faint); font-size:12px; padding:12px 0;">Memuat data...</div>
        <div v-else style="display:flex; flex-direction:column; gap:8px;">
          <div v-if="daftarGudang.length === 0" style="text-align:center; color:var(--text-faint); font-size:12px; padding:12px 0;">Belum ada data gudang terdaftar.</div>
          <div v-for="g in daftarGudang" :key="g.id" style="background:var(--ivory-dim); padding:10px 12px; border-radius:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:700; color:var(--burgundy-dark); font-size:12.5px;">{{ g.nama_gudang }}</div>
                <div style="font-size:10px; color:var(--text-muted); font-family:'Poppins',sans-serif; margin-top:2px;">
                  <span v-if="g.tipe_lokasi === 'Dinamis'" class="tag blue">Dinamis — tanpa radius</span>
                  <template v-else>Lat: {{ g.latitude }} &bull; Lng: {{ g.longitude }} &bull; <b style="color:var(--danger);">Radius: {{ g.radius }}m</b></template>
                </div>
                <div style="margin-top:5px;">
                  <span v-if="(g.jenis_pekerjaan || []).length === 0" class="tag neutral" style="font-size:9px;">Belum ada jenis pekerjaan</span>
                  <span v-for="jp in (g.jenis_pekerjaan || [])" :key="jp" class="tag" style="font-size:9px; margin-right:4px; background:var(--pink); color:var(--burgundy-dark);">{{ jp }}</span>
                </div>
              </div>
              <div style="display:flex; gap:6px; flex-shrink:0;">
                <button v-if="bolehEdit" @click="mulaiEdit(g)" class="icon-btn"><i class="fas fa-tags"></i></button>
                <button v-if="bolehHapus" @click="hapus(g.id)" class="icon-btn" style="color:var(--danger);"><i class="fas fa-trash-alt"></i></button>
              </div>
            </div>
            <div v-if="sedangEditId === g.id" style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--line);">
              <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">Edit nama gudang:</label>
              <input v-model="editNama" type="text" style="width:100%; padding:7px 10px; font-size:12px; border:1px solid var(--line); border-radius:8px; margin-bottom:10px;">
              <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">Edit jenis pekerjaan untuk gudang ini:</label>
              <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                <label v-for="jp in opsiJenisPekerjaan" :key="jp" style="display:flex; align-items:center; gap:5px; font-size:11.5px; background:var(--surface); padding:5px 10px; border-radius:20px; cursor:pointer; border:1px solid var(--line);">
                  <input type="checkbox" :value="jp" v-model="editJenisPekerjaan" style="accent-color:var(--burgundy);">{{ jp }}
                </label>
              </div>
              <div style="display:flex; gap:8px;">
                <button @click="simpanEdit(g.id)" :disabled="menyimpanEdit" class="btn-primary" style="padding:6px 16px; font-size:11.5px;">{{ menyimpanEdit ? 'Menyimpan...' : 'Simpan' }}</button>
                <button @click="batalEdit" style="background:none; border:none; color:var(--text-faint); font-weight:700; cursor:pointer; font-size:11.5px;">Batal</button>
              </div>
            </div>
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
    const opsiJenisPekerjaan = ref([]);

    const nama = ref('');
    const jamMasuk = ref('');
    const jamKeluar = ref('');
    // BARU (18 Agt 2026) — sama seperti Master Gudang: 1 shift bisa
    // dipakai LEBIH DARI 1 jenis pekerjaan, array bukan dropdown tunggal.
    const jenisPekerjaanBaru = ref([]);

    // ---- Edit jenis pekerjaan untuk data yang SUDAH ADA sebelumnya ----
    const sedangEditId = ref(null);
    const editNama = ref('');
    const editJenisPekerjaan = ref([]);
    const menyimpanEdit = ref(false);

    async function muat() {
      memuat.value = true;
      const snap = await getDocs(collection(db, "master_shift"));
      const list = [];
      // BARU (18 Agt 2026) — PEDOMAN KERJA: cuma dimensi jenis pekerjaan
      // (Master Shift tidak punya field gudang sama sekali).
      snap.forEach(d => {
        const s = d.data();
        if (window.bolehLihatJenisPekerjaan(s.jenis_pekerjaan)) list.push({ id: d.id, ...s });
      });
      daftarShift.value = list;
      opsiJenisPekerjaan.value = window.ambilMasterList ? await window.ambilMasterList('jenis_pekerjaan') : [];
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
          jam_keluar: jamKeluar.value,
          jenis_pekerjaan: jenisPekerjaanBaru.value
        });
        alert("Master Shift Berhasil Disimpan!");
        nama.value = ''; jamMasuk.value = ''; jamKeluar.value = ''; jenisPekerjaanBaru.value = [];
        await muat();
      } catch (e) {
        console.error(e);
        alert("Gagal menyimpan data shift.");
      }
      menyimpan.value = false;
    }

    async function hapus(id) {
      if (window.cekIzinMenu('config_absensi', 'delete') === false) {
        return alert('Anda tidak punya izin menghapus data di sini. Hubungi Owner/PIC.');
      }
      if (!confirm("Yakin ingin menghapus Shift ini dari Master Data?")) return;
      await deleteDoc(doc(db, "master_shift", id));
      await muat();
    }

    function mulaiEdit(s) {
      sedangEditId.value = s.id;
      editNama.value = s.nama_shift || '';
      editJenisPekerjaan.value = [...(s.jenis_pekerjaan || [])];
    }
    function batalEdit() {
      sedangEditId.value = null;
      editNama.value = '';
      editJenisPekerjaan.value = [];
    }
    async function simpanEdit(id) {
      if (!editNama.value.trim()) return alert("Nama Shift tidak boleh kosong!");
      menyimpanEdit.value = true;
      try {
        await updateDoc(doc(db, "master_shift", id), { nama_shift: editNama.value.trim(), jenis_pekerjaan: editJenisPekerjaan.value });
        sedangEditId.value = null;
        await muat();
      } catch (e) {
        console.error("Gagal simpan perubahan shift:", e);
        alert("Gagal menyimpan perubahan.");
      }
      menyimpanEdit.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });
    const bolehHapus = computed(() => window.cekIzinMenu('config_absensi', 'delete') !== false);
    const bolehEdit = computed(() => window.cekIzinMenu('config_absensi', 'edit') !== false);

    return {
      daftarShift, memuat, menyimpan, nama, jamMasuk, jamKeluar, opsiJenisPekerjaan, jenisPekerjaanBaru,
      simpan, hapus, bolehHapus, bolehEdit,
      sedangEditId, editNama, editJenisPekerjaan, menyimpanEdit, mulaiEdit, batalEdit, simpanEdit
    };
  },
  template: `
    <div class="gc-card">
      <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:14px;"><i class="fas fa-clock" style="color:var(--burgundy); margin-right:8px;"></i> Master Shift Jam Kerja</h3>
      <div class="gc-field"><label>Nama shift *</label><input v-model="nama" type="text"></div>
      <div style="display:grid; gap:12px;" class="grid-cols-1 md:grid-cols-2">
        <div class="gc-field"><label>Jam masuk (in) *</label><input v-model="jamMasuk" type="time"></div>
        <div class="gc-field"><label>Jam keluar (out) *</label><input v-model="jamKeluar" type="time"></div>
      </div>
      <div class="gc-field">
        <label>Jenis pekerjaan yang pakai shift ini <span style="font-weight:400; color:var(--text-faint);">(boleh lebih dari 1)</span></label>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          <label v-for="jp in opsiJenisPekerjaan" :key="jp" style="display:flex; align-items:center; gap:5px; font-size:11.5px; background:var(--ivory-dim); padding:5px 10px; border-radius:20px; cursor:pointer;">
            <input type="checkbox" :value="jp" v-model="jenisPekerjaanBaru" style="accent-color:var(--burgundy);">{{ jp }}
          </label>
        </div>
      </div>
      <button @click="simpan" :disabled="menyimpan" class="btn-primary block" style="margin-top:6px;">
        <i class="fas fa-save" style="margin-right:6px;"></i> Simpan master shift
      </button>
      <div style="margin-top:18px; padding-top:16px; border-top:1px solid var(--line);">
        <h4 style="font-size:10px; font-weight:700; color:var(--text-faint); text-transform:uppercase; letter-spacing:.05em; margin-bottom:10px;">Daftar shift tersimpan</h4>
        <div v-if="memuat" style="text-align:center; color:var(--text-faint); font-size:12px; padding:12px 0;">Memuat data...</div>
        <div v-else style="display:flex; flex-direction:column; gap:8px;">
          <div v-if="daftarShift.length === 0" style="text-align:center; color:var(--text-faint); font-size:12px; padding:12px 0;">Belum ada data shift terdaftar.</div>
          <div v-for="s in daftarShift" :key="s.id" style="background:var(--ivory-dim); padding:10px 12px; border-radius:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:700; color:var(--burgundy-dark); font-size:12.5px;">{{ s.nama_shift }}</div>
                <div style="font-size:10.5px; color:var(--text-muted); font-family:'Poppins',sans-serif; margin-top:2px;">In: <b style="color:var(--ok);">{{ s.jam_masuk }}</b> &bull; Out: <b style="color:var(--danger);">{{ s.jam_keluar }}</b></div>
                <div style="margin-top:5px;">
                  <span v-if="(s.jenis_pekerjaan || []).length === 0" class="tag neutral" style="font-size:9px;">Belum ada jenis pekerjaan</span>
                  <span v-for="jp in (s.jenis_pekerjaan || [])" :key="jp" class="tag" style="font-size:9px; margin-right:4px; background:var(--pink); color:var(--burgundy-dark);">{{ jp }}</span>
                </div>
              </div>
              <div style="display:flex; gap:6px; flex-shrink:0;">
                <button v-if="bolehEdit" @click="mulaiEdit(s)" class="icon-btn"><i class="fas fa-tags"></i></button>
                <button v-if="bolehHapus" @click="hapus(s.id)" class="icon-btn" style="color:var(--danger);"><i class="fas fa-trash-alt"></i></button>
              </div>
            </div>
            <div v-if="sedangEditId === s.id" style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--line);">
              <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">Edit nama shift:</label>
              <input v-model="editNama" type="text" style="width:100%; padding:7px 10px; font-size:12px; border:1px solid var(--line); border-radius:8px; margin-bottom:10px;">
              <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">Edit jenis pekerjaan untuk shift ini:</label>
              <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                <label v-for="jp in opsiJenisPekerjaan" :key="jp" style="display:flex; align-items:center; gap:5px; font-size:11.5px; background:var(--surface); padding:5px 10px; border-radius:20px; cursor:pointer; border:1px solid var(--line);">
                  <input type="checkbox" :value="jp" v-model="editJenisPekerjaan" style="accent-color:var(--burgundy);">{{ jp }}
                </label>
              </div>
              <div style="display:flex; gap:8px;">
                <button @click="simpanEdit(s.id)" :disabled="menyimpanEdit" class="btn-primary" style="padding:6px 16px; font-size:11.5px;">{{ menyimpanEdit ? 'Menyimpan...' : 'Simpan' }}</button>
                <button @click="batalEdit" style="background:none; border:none; color:var(--text-faint); font-weight:700; cursor:pointer; font-size:11.5px;">Batal</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};

const AppConfigAbsensi = {
  components: { MasterGudangManager, MasterShiftManager, MasterDataCategory },
  setup() {
    const tabAktif = ref('gudang');
    pakaiRiwayatTabVue('config-absensi-tab', tabAktif);
    // Tab pertama (gudang) langsung true karena otomatis aktif & harus
    // langsung muat begitu Config Absensi dibuka. shift/jenispekerjaan
    // baru jadi true SEKALI begitu tab-nya diklik pertama kali — dan
    // TETAP true selamanya setelah itu (v-show yang urus tampil/
    // sembunyi selanjutnya, BUKAN v-if lagi, jadi tidak fetch ulang).
    const dibukaSekali = reactive({ gudang: true, shift: false, jenispekerjaan: false });
    const refreshKey = ref(0);

    function pindahTab(nama) {
      tabAktif.value = nama;
      dibukaSekali[nama] = true;
    }

    return { tabAktif, dibukaSekali, refreshKey, pindahTab };
  },
  template: `
    <div class="gc-card">
      <h3 class="gc-heading" style="font-size:13.5px; font-weight:700;"><i class="fas fa-sliders" style="color:var(--burgundy); margin-right:8px;"></i> Config Absensi</h3>
      <div class="flex space-x-2 overflow-x-auto no-scrollbar" style="padding-top:14px; margin-top:14px; border-top:1px solid var(--line);">
        <button @click="pindahTab('gudang')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'gudang' }"><i class="fas fa-map-marker-alt" style="margin-right:6px;"></i> Master Gudang</button>
        <button @click="pindahTab('shift')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'shift' }"><i class="fas fa-clock" style="margin-right:6px;"></i> Master Shift</button>
        <button @click="pindahTab('jenispekerjaan')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'jenispekerjaan' }"><i class="fas fa-briefcase" style="margin-right:6px;"></i> Jenis Pekerjaan</button>
      </div>
    </div>

    <div style="margin-top:16px;">
      <master-gudang-manager v-if="dibukaSekali.gudang" v-show="tabAktif === 'gudang'" :key="'gudang-' + refreshKey" />
      <master-shift-manager v-if="dibukaSekali.shift" v-show="tabAktif === 'shift'" :key="'shift-' + refreshKey" />
      <master-data-category v-if="dibukaSekali.jenispekerjaan" v-show="tabAktif === 'jenispekerjaan'" :key="'jp-' + refreshKey" kategori="jenis_pekerjaan" label="Jenis Pekerjaan" menu-id="config_absensi" />
    </div>
  `
};

let vmConfigAbsensi = null;
// Sama seperti layar admin lain — mount() ditunda sampai benar-benar
// dinavigasi pertama kali. Setelah induk ter-mount, sub-tab pertama
// (Master Gudang) langsung ikut muat; Master Shift & Jenis Pekerjaan baru
// muat begitu sub-tabnya sendiri diklik pertama kali (lihat dibukaSekali
// di AppConfigAbsensi).
window.pastikanMountConfigAbsensi = function() {
  if (vmConfigAbsensi) return;
  const mountPoint = document.getElementById('vue-config-absensi');
  if (mountPoint) vmConfigAbsensi = createApp(AppConfigAbsensi).mount('#vue-config-absensi');
};
window.refreshConfigAbsensi = function() { if (vmConfigAbsensi) vmConfigAbsensi.refreshKey++; };
