// js/vue-components.js
// ============================================================================
// Komponen Vue yang dipakai BARENG di berbagai layar. Ini fondasi migrasi
// bertahap dari vanilla JS ke Vue — tujuannya supaya pola yang sama (misal
// "1 kategori master data: tambah/lihat/hapus") tidak ditulis ulang beda-beda
// di tiap layar seperti pola lama, tapi cukup 1 komponen dipakai berkali-kali.
//
// Dipakai via CDN (tanpa build step) — import langsung dari unpkg, sama
// seperti pola import Firebase yang sudah ada di app ini.
// ============================================================================
import { ref, computed, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// ---------------------------------------------------------------------------
// MasterDataCategory — kartu 1 kategori Master Data (tambah/lihat/hapus item).
// Baca data (termasuk seeding default kalau belum ada) tetap lewat
// window.ambilMasterList supaya SATU sumber logic dipakai bareng dengan
// bagian aplikasi yang belum dimigrasi (Antrean Dakar, Edit Karyawan, dll).
// ---------------------------------------------------------------------------
export const MasterDataCategory = {
  props: {
    kategori: { type: String, required: true },
    label: { type: String, required: true }
  },
  setup(props) {
    const items = ref([]);
    const inputBaru = ref('');
    const memuat = ref(true);
    const menyimpan = ref(false);

    async function muat() {
      memuat.value = true;
      try {
        items.value = await window.ambilMasterList(props.kategori);
      } catch (e) {
        console.error('Gagal muat master data:', props.kategori, e);
      }
      memuat.value = false;
    }

    async function simpanKeFirestore() {
      menyimpan.value = true;
      try {
        await setDoc(doc(db, 'master_data', props.kategori), { items: items.value });
      } catch (e) {
        console.error('Gagal simpan master data:', props.kategori, e);
        alert('Gagal menyimpan perubahan. Coba lagi.');
      }
      menyimpan.value = false;
    }

    async function tambah() {
      const nilai = inputBaru.value.trim();
      if (!nilai) return;
      if (items.value.includes(nilai)) { alert('Item ini sudah ada di daftar.'); return; }
      items.value.push(nilai);
      inputBaru.value = '';
      await simpanKeFirestore();
    }

    async function hapus(nilai) {
      items.value = items.value.filter(i => i !== nilai);
      await simpanKeFirestore();
    }

    onMounted(async () => { await window.authReady; muat(); });

    return { items, inputBaru, memuat, menyimpan, tambah, hapus };
  },
  template: `
    <div class="gc-card" style="padding:16px;">
      <h4 class="gc-heading" style="font-size:12.5px; font-weight:700; margin-bottom:10px;">{{ label }}</h4>
      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <input v-model="inputBaru" @keyup.enter="tambah" type="text" placeholder="Tambah item baru..." style="flex:1; padding:8px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; outline:none;">
        <button @click="tambah" :disabled="menyimpan" class="btn-primary" style="padding:8px 14px;">
          <i class="fas fa-plus"></i>
        </button>
      </div>
      <div v-if="memuat" style="font-size:11px; color:var(--text-faint);">Memuat...</div>
      <div v-else style="display:flex; flex-wrap:wrap; gap:6px;">
        <span v-if="items.length === 0" style="font-size:11px; color:var(--text-faint);">Belum ada data.</span>
        <span v-for="item in items" :key="item" class="tag neutral" style="gap:8px;">
          {{ item }}
          <button @click="hapus(item)" style="background:none; border:none; color:var(--danger); cursor:pointer; padding:0; font-size:11px;"><i class="fas fa-times"></i></button>
        </span>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// DuaBaris — pola "2 baris per sel" yang dipakai berulang kali di berbagai
// tabel (Daftar Karyawan, Antrean Absensi, Riwayat All Absensi): baris atas
// bold/besar, baris bawah kecil/abu-abu. 1 komponen, dipakai di mana-mana.
// ---------------------------------------------------------------------------
export const DuaBaris = {
  props: {
    a: { type: [String, Number], default: '' },
    b: { type: [String, Number], default: '' }
  },
  template: `
    <span>
      <b style="color:var(--text);">{{ a || '-' }}</b><br>
      <span style="font-size:11px; color:var(--text-muted); font-weight:400;">{{ b || '-' }}</span>
    </span>
  `
};

// ---------------------------------------------------------------------------
// GudangCheckboxSelect — pilih gudang (bisa lebih dari satu) via checkbox.
// Dipakai lewat v-model, contoh: <gudang-checkbox-select v-model="gudangTerpilih" />
// ---------------------------------------------------------------------------
export const GudangCheckboxSelect = {
  props: {
    modelValue: { type: Array, default: () => [] }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const daftarGudang = ref([]);
    const memuat = ref(true);
    const terbuka = ref(false);

    async function muat() {
      const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
      const snap = await getDocs(collection(db, 'master_gudang'));
      const list = [];
      snap.forEach(d => list.push(d.data().nama_gudang));
      daftarGudang.value = list;
      memuat.value = false;
    }

    function toggle(nama, dicentang) {
      const nilaiBaru = [...props.modelValue];
      const idx = nilaiBaru.indexOf(nama);
      if (dicentang && idx === -1) nilaiBaru.push(nama);
      if (!dicentang && idx > -1) nilaiBaru.splice(idx, 1);
      emit('update:modelValue', nilaiBaru);
    }

    function toggleDropdown() { terbuka.value = !terbuka.value; }
    function pilihSemua() { emit('update:modelValue', [...daftarGudang.value]); }
    function kosongkanSemua() { emit('update:modelValue', []); }

    const teksRingkasan = computed(() => {
      if (props.modelValue.length === 0) return 'Pilih gudang...';
      if (props.modelValue.length <= 2) return props.modelValue.join(', ');
      return `${props.modelValue.length} gudang dipilih`;
    });

    onMounted(async () => { await window.authReady; muat(); });
    return { daftarGudang, memuat, terbuka, toggle, toggleDropdown, pilihSemua, kosongkanSemua, teksRingkasan };
  },
  template: `
    <div style="position:relative;">
      <button type="button" @click="toggleDropdown" style="width:100%; display:flex; justify-content:space-between; align-items:center; padding:10px 13px; background:var(--surface); border:1.5px solid var(--line); border-radius:12px; font-size:12.5px; cursor:pointer; text-align:left;" :style="modelValue.length === 0 ? 'color:var(--text-faint);' : 'color:var(--text);'">
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ teksRingkasan }}</span>
        <i class="fas" :class="terbuka ? 'fa-chevron-up' : 'fa-chevron-down'" style="color:var(--text-faint); flex-shrink:0; margin-left:8px;"></i>
      </button>
      <div v-if="terbuka" style="position:absolute; z-index:20; top:calc(100% + 4px); left:0; right:0; background:var(--surface); border:1.5px solid var(--line); border-radius:12px; padding:10px; box-shadow:0 8px 20px rgba(59,42,31,.12); max-height:240px; overflow-y:auto;">
        <div v-if="memuat" style="font-size:11px; color:var(--text-faint); padding:6px;">Memuat gudang...</div>
        <div v-else-if="daftarGudang.length === 0" style="font-size:11px; color:var(--text-faint); padding:6px;">Belum ada Master Gudang. Buat dulu di Config Absensi.</div>
        <template v-else>
          <div style="display:flex; justify-content:flex-end; gap:10px; padding-bottom:8px; margin-bottom:6px; border-bottom:1px solid var(--line);">
            <button type="button" @click="pilihSemua" style="background:none; border:none; color:var(--burgundy); font-weight:700; font-size:11px; cursor:pointer;">Select All</button>
            <button type="button" @click="kosongkanSemua" style="background:none; border:none; color:var(--text-muted); font-weight:700; font-size:11px; cursor:pointer;">Clear All</button>
          </div>
          <label v-for="g in daftarGudang" :key="g" style="display:flex; align-items:center; gap:8px; padding:7px 6px; font-size:12.5px; cursor:pointer; border-radius:8px;">
            <input type="checkbox" :checked="modelValue.includes(g)" @change="toggle(g, $event.target.checked)" style="accent-color:var(--burgundy); width:15px; height:15px;">
            <span>{{ g }}</span>
          </label>
        </template>
      </div>
    </div>
  `
};
// ---------------------------------------------------------------------------
// KecamatanManager — khusus, bertingkat per Kabupaten/Kota.
// ---------------------------------------------------------------------------
export const KecamatanManager = {
  setup() {
    const daftarKabupaten = ref([]);
    const kabupatenTerpilih = ref('');
    const kecamatanList = ref([]);
    const inputBaru = ref('');
    const memuat = ref(true);

    async function muatKabupaten() {
      daftarKabupaten.value = await window.ambilMasterList('kabupaten');
      if (daftarKabupaten.value.length > 0 && !kabupatenTerpilih.value) {
        kabupatenTerpilih.value = daftarKabupaten.value[0];
      }
    }

    async function muatKecamatan() {
      if (!kabupatenTerpilih.value) { kecamatanList.value = []; return; }
      memuat.value = true;
      try {
        kecamatanList.value = await window.ambilKecamatanUntukKabupaten(kabupatenTerpilih.value);
      } catch (e) {
        console.error('Gagal muat kecamatan:', e);
      }
      memuat.value = false;
    }

    async function ambilPetaSekarang() {
      const snap = await getDoc(doc(db, 'master_data', 'kecamatan'));
      return (snap.exists() && snap.data().map) ? snap.data().map : {};
    }

    async function tambah() {
      const nilai = inputBaru.value.trim();
      if (!nilai || !kabupatenTerpilih.value) return;
      if (kecamatanList.value.includes(nilai)) { alert('Sudah ada.'); return; }
      const map = await ambilPetaSekarang();
      if (!map[kabupatenTerpilih.value]) map[kabupatenTerpilih.value] = [];
      map[kabupatenTerpilih.value].push(nilai);
      await setDoc(doc(db, 'master_data', 'kecamatan'), { map });
      kecamatanList.value = map[kabupatenTerpilih.value];
      inputBaru.value = '';
    }

    async function hapus(nilai) {
      const map = await ambilPetaSekarang();
      if (map[kabupatenTerpilih.value]) {
        map[kabupatenTerpilih.value] = map[kabupatenTerpilih.value].filter(i => i !== nilai);
      }
      await setDoc(doc(db, 'master_data', 'kecamatan'), { map });
      kecamatanList.value = map[kabupatenTerpilih.value] || [];
    }

    watch(kabupatenTerpilih, muatKecamatan);
    onMounted(async () => { await window.authReady; await muatKabupaten(); await muatKecamatan(); });

    return { daftarKabupaten, kabupatenTerpilih, kecamatanList, inputBaru, memuat, tambah, hapus };
  },
  template: `
    <div class="gc-card" style="padding:16px;">
      <h4 class="gc-heading" style="font-size:12.5px; font-weight:700; margin-bottom:10px;">Kecamatan (per kabupaten/kota)</h4>
      <select v-model="kabupatenTerpilih" style="width:100%; padding:8px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; margin-bottom:8px;">
        <option v-for="k in daftarKabupaten" :key="k" :value="k">{{ k }}</option>
      </select>
      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <input v-model="inputBaru" @keyup.enter="tambah" type="text" placeholder="Tambah kecamatan untuk kabupaten di atas..." style="flex:1; padding:8px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; outline:none;">
        <button @click="tambah" class="btn-primary" style="padding:8px 14px;"><i class="fas fa-plus"></i></button>
      </div>
      <div v-if="memuat" style="font-size:11px; color:var(--text-faint);">Memuat...</div>
      <div v-else style="display:flex; flex-wrap:wrap; gap:6px;">
        <span v-if="kecamatanList.length === 0" style="font-size:11px; color:var(--text-faint);">Belum ada kecamatan untuk kabupaten ini.</span>
        <span v-for="item in kecamatanList" :key="item" class="tag neutral" style="gap:8px;">
          {{ item }}
          <button @click="hapus(item)" style="background:none; border:none; color:var(--danger); cursor:pointer; padding:0; font-size:11px;"><i class="fas fa-times"></i></button>
        </span>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// GudangRingkas — tampilkan daftar gudang karyawan secara ringkas di tabel.
// Kalau cuma 1-2 gudang, tampil penuh. Kalau lebih, dipersingkat + link
// "lihat semua" yang buka popup daftar lengkapnya (popup dikelola sendiri
// di komponen ini, orang tua tidak perlu urus state apa-apa).
// Dipakai: <gudang-ringkas :gudang="d.gudang_penempatan" :nama="d.nama" />
// (terima array MAUPUN string lama — dinormalkan otomatis lewat
// window.normalisasiGudang, jadi aman untuk data lama/baru sekaligus.)
// ---------------------------------------------------------------------------
export const GudangRingkas = {
  props: {
    gudang: { type: [Array, String], default: () => [] },
    nama: { type: String, default: '' }
  },
  setup(props) {
    const popupTerbuka = ref(false);
    const daftar = computed(() => window.normalisasiGudang(props.gudang));
    const teksSingkat = computed(() => {
      if (daftar.value.length === 0) return '-';
      if (daftar.value.length <= 2) return daftar.value.join(', ');
      return daftar.value.slice(0, 1).join(', ') + ` +${daftar.value.length - 1} lainnya`;
    });
    const perluPopup = computed(() => daftar.value.length > 2);
    function buka() { popupTerbuka.value = true; }
    function tutup() { popupTerbuka.value = false; }
    return { daftar, teksSingkat, perluPopup, popupTerbuka, buka, tutup };
  },
  template: `
    <span>
      {{ teksSingkat }}
      <button v-if="perluPopup" @click="buka" style="background:none; border:none; color:var(--burgundy); font-weight:700; cursor:pointer; font-size:11px; margin-left:4px; text-decoration:underline;">lihat semua</button>
      <div v-if="popupTerbuka" @click="tutup" style="position:fixed; inset:0; background:rgba(59,42,31,.6); z-index:100; display:flex; align-items:center; justify-content:center; padding:16px;" class="fade-in">
        <div @click.stop style="background:var(--surface); width:100%; max-width:360px; padding:22px; border-radius:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:14px;">
            <h3 class="gc-heading" style="font-weight:700; font-size:13.5px;">Semua gudang{{ nama ? ' — ' + nama : '' }}</h3>
            <button @click="tutup" style="background:none; border:none; color:var(--text-faint); font-size:16px; cursor:pointer;"><i class="fas fa-times"></i></button>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            <span v-for="g in daftar" :key="g" class="tag pink">{{ g }}</span>
          </div>
        </div>
      </div>
    </span>
  `
};

// ---------------------------------------------------------------------------
// daftarMenuGroups(role) — REGISTRY MENU TERPUSAT. Satu sumber kebenaran
// untuk struktur "menu apa masuk grup apa, siapa boleh lihat, dan aksinya
// pindah ke mana" — dipakai Home mobile (js/vue-home.js) sekarang, dan bisa
// dipakai ulang untuk desktop nanti kalau strukturnya mau disamakan (sesuai
// arahan: "kalau ada yg bisa jadi function bersama vue, hajar update
// component"). Ubah/tambah menu di SINI SATU TEMPAT SAJA, otomatis
// ke-reflect di semua tempat yang memakai fungsi ini.
// ---------------------------------------------------------------------------
export function daftarMenuGroups(role) {
  const r = (role || 'operator').toLowerCase();
  const semuaGroup = [
    {
      nama: 'Absensi',
      roleBoleh: ['pic', 'admin', 'owner', 'superuser'],
      items: [
        { label: 'Antrean Absensi', icon: 'fa-clipboard-check', aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-accept', null); } },
        { label: 'Riwayat All Absensi', icon: 'fa-clock-rotate-left', aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-rekap', null); } },
        { label: 'Penjadwalan', icon: 'fa-calendar-days', aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-jadwal', null); } },
        { label: 'Config', icon: 'fa-gear', aksi: () => { window.pindahTab('tab-admin-acc'); window.pindahSubTab('sub-absensi', 'sub-absensi-config', null); } }
      ]
    },
    {
      nama: 'Master Karyawan',
      roleBoleh: ['owner', 'superuser'],
      items: [
        { label: 'Antrean Dakar', icon: 'fa-user-clock', aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-antrean', null); } },
        { label: 'Daftar Karyawan', icon: 'fa-users', aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-data', null); } },
        { label: 'Slip Gaji', icon: 'fa-file-invoice-dollar', aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-slip', null); } },
        { label: 'Payroll', icon: 'fa-money-check-dollar', aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-payroll', null); } },
        { label: 'Config Karyawan', icon: 'fa-sliders', aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-config', null); } },
        // Hak Akses & Config Akses SENGAJA dikunci Owner asli saja (lihat
        // roleBoleh per-item di bawah) — Superuser tetap lihat 5 item lain
        // di grup ini, tapi bukan 2 ini, konsisten dengan gerbang yang
        // sudah ada di auth.js/index.html.
        { label: 'Hak Akses', icon: 'fa-user-shield', roleBoleh: ['owner'], aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-hakakses', null); } },
        { label: 'Config Akses', icon: 'fa-shield-halved', roleBoleh: ['owner'], aksi: () => { window.pindahTab('tab-superuser'); window.pindahSubTab('sub-karyawan', 'sub-karyawan-akses', null); } }
      ]
    },
    {
      nama: 'Whatsapp',
      roleBoleh: ['owner', 'superuser'],
      items: [
        { label: 'Monitoring Respon', icon: 'fa-chart-line', aksi: () => { window.pindahTab('tab-whatsapp'); if (window.bukaSubTabWhatsapp) window.bukaSubTabWhatsapp('monitor'); } },
        { label: 'Template Pesan', icon: 'fa-comment-dots', aksi: () => { window.pindahTab('tab-whatsapp'); if (window.bukaSubTabWhatsapp) window.bukaSubTabWhatsapp('template'); } },
        { label: 'Config API', icon: 'fa-plug', aksi: () => { window.pindahTab('tab-whatsapp'); if (window.bukaSubTabWhatsapp) window.bukaSubTabWhatsapp('config'); } }
      ]
    }
  ];

  return semuaGroup
    .filter(g => !g.roleBoleh || g.roleBoleh.includes(r))
    .map(g => ({ ...g, items: g.items.filter(i => !i.roleBoleh || i.roleBoleh.includes(r)) }))
    .filter(g => g.items.length > 0);
}
