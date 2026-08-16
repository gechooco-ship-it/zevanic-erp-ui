// js/vue-config-akses.js
// ============================================================================
// Master Karyawan > Config Akses — buat & atur PROFIL AKSES bernama bebas
// (bukan cuma 5 role baku). Tiap profil punya izin View/Add/Edit/Delete/
// Print per menu, dikelompokkan per kategori (bisa dilipat/dibuka).
//
// PENTING (batas fitur ini): layar ini menyimpan konfigurasinya dengan rapi
// ke Firestore (koleksi "akses_config"), TAPI belum ada bagian lain di
// aplikasi yang MEMBACA/menerapkan nilai-nilai ini untuk benar-benar
// menyembunyikan menu atau memblokir aksi Add/Edit/Delete/Print — itu
// pekerjaan SUSULAN yang jauh lebih besar (perlu ubah
// aturTampilanBerdasarkanRole di auth.js, semua tombol aksi di semua
// layar, DAN Firestore Security Rules supaya benar-benar aman, bukan cuma
// sembunyi di tampilan). Layar ini murni tempat MENGATUR nilainya dulu.
//
// Akses ke layar ini SENGAJA dibatasi khusus Owner (lihat auth.js).
// ============================================================================
import { createApp, ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const DAFTAR_MENU = [
  { id: 'dashboard', label: 'Dashboard', kategori: 'Umum' },
  { id: 'profile', label: 'Profile', kategori: 'Umum' },
  { id: 'config_absensi', label: 'Config Absensi', kategori: 'Master Absensi' },
  { id: 'penjadwalan', label: 'Penjadwalan', kategori: 'Master Absensi' },
  { id: 'antrean_absensi', label: 'Antrean Absensi', kategori: 'Master Absensi' },
  { id: 'riwayat_absensi', label: 'Riwayat All Absensi', kategori: 'Master Absensi' },
  { id: 'antrean_dakar', label: 'Antrean Dakar', kategori: 'Master Karyawan' },
  { id: 'config_karyawan', label: 'Config Karyawan', kategori: 'Master Karyawan' },
  { id: 'daftar_karyawan', label: 'Daftar Karyawan', kategori: 'Master Karyawan' },
  { id: 'config_akses', label: 'Config Akses', kategori: 'Master Karyawan' },
  { id: 'hak_akses', label: 'Hak Akses', kategori: 'Master Karyawan' },
  { id: 'whatsapp_gateway', label: 'WhatsApp Gateway', kategori: 'Integrasi' }
];

const KATEGORI_URUTAN = ['Umum', 'Master Absensi', 'Master Karyawan', 'Integrasi'];
const KOSONG_IZIN = () => ({ view: false, add: false, edit: false, delete: false, print: false });

// Default awal untuk 5 profil baku SENGAJA disamakan dengan perilaku
// hardcode yang sudah jalan sekarang (lihat auth.js) — supaya profil ini
// begitu pertama dibuka sudah masuk akal, bukan kosong semua.
function bikinDefaultProfil(namaProfil) {
  const menus = {};
  DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN(); });

  const semua = (id) => { menus[id] = { view: true, add: true, edit: true, delete: true, print: true }; };
  const lihatSaja = (id) => { menus[id].view = true; };

  if (namaProfil === 'owner' || namaProfil === 'superuser') {
    DAFTAR_MENU.forEach(m => semua(m.id));
  } else if (namaProfil === 'pic' || namaProfil === 'admin') {
    lihatSaja('dashboard');
    menus.profile = { view: true, add: true, edit: true, delete: false, print: false };
    ['config_absensi', 'penjadwalan', 'antrean_absensi', 'riwayat_absensi'].forEach(semua);
  } else {
    lihatSaja('dashboard');
    menus.profile = { view: true, add: true, edit: true, delete: false, print: false };
  }
  return menus;
}

const PROFIL_BAKU = ['operator', 'pic', 'admin', 'owner', 'superuser'];

const AppConfigAkses = {
  setup() {
    const daftarProfil = ref([]); // nama-nama profil yang sudah pernah disimpan
    const memuat = ref(true);
    const menyimpan = ref(false);

    const namaAkses = ref('');
    const profilDipilih = ref('');
    const menus = reactive({});
    DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN(); });

    const kategoriTerbuka = reactive({});
    KATEGORI_URUTAN.forEach(k => { kategoriTerbuka[k] = true; });
    function toggleKategori(k) { kategoriTerbuka[k] = !kategoriTerbuka[k]; }

    function menuUntukKategori(kategori) {
      return DAFTAR_MENU.filter(m => m.kategori === kategori);
    }

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDocs(collection(db, "akses_config"));
        const namaTersimpan = [];
        snap.forEach(d => namaTersimpan.push(d.id));
        // Gabungkan dengan profil baku (biar selalu muncul di daftar
        // pilihan meski belum pernah disimpan sekalipun) — KECUALI "owner",
        // sengaja disembunyikan dari daftar pilih/edit karena Owner wajib
        // selalu punya akses penuh ke segalanya, tidak boleh dikonfigurasi
        // (dikecilkan) lewat layar ini sama sekali.
        const gabungan = [...new Set([...PROFIL_BAKU, ...namaTersimpan])]
          .filter(nama => nama !== 'owner')
          .sort();
        daftarProfil.value = gabungan;

        if (!profilDipilih.value && gabungan.length > 0) {
          await pilihProfil(gabungan[0]);
        }
      } catch (e) {
        console.error("Gagal muat daftar profil akses:", e);
      }
      memuat.value = false;
    }

    async function pilihProfil(nama) {
      if (!nama) { mulaiProfilBaru(); return; }
      profilDipilih.value = nama;
      namaAkses.value = nama;
      try {
        const snap = await getDoc(doc(db, "akses_config", nama));
        const dataMenus = snap.exists() ? (snap.data().menus || {}) : null;
        DAFTAR_MENU.forEach(m => {
          menus[m.id] = dataMenus && dataMenus[m.id] ? { ...KOSONG_IZIN(), ...dataMenus[m.id] } : (
            PROFIL_BAKU.includes(nama) ? bikinDefaultProfil(nama)[m.id] : KOSONG_IZIN()
          );
        });
      } catch (e) {
        console.error("Gagal muat profil akses:", nama, e);
      }
    }

    function mulaiProfilBaru() {
      profilDipilih.value = '';
      namaAkses.value = '';
      DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN(); });
    }

    async function simpan() {
      const nama = namaAkses.value.trim();
      if (!nama) return alert("Nama Akses harus diisi!");
      if (nama.toLowerCase() === 'owner') {
        return alert("Nama \"owner\" tidak boleh dipakai — Owner wajib selalu punya akses penuh dan tidak boleh dikonfigurasi lewat layar ini.");
      }

      menyimpan.value = true;
      try {
        const menusPolos = {};
        DAFTAR_MENU.forEach(m => { menusPolos[m.id] = { ...menus[m.id] }; });
        await setDoc(doc(db, "akses_config", nama), { nama, menus: menusPolos });
        alert(`Profil akses "${nama}" berhasil disimpan!`);
        profilDipilih.value = nama;
        await muat();
      } catch (e) {
        console.error("Gagal simpan profil akses:", e);
        alert("Gagal menyimpan profil akses.");
      }
      menyimpan.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });

    return {
      daftarProfil, memuat, menyimpan, muat,
      namaAkses, profilDipilih, pilihProfil, mulaiProfilBaru, simpan,
      menus, KATEGORI_URUTAN, kategoriTerbuka, toggleKategori, menuUntukKategori
    };
  },
  template: `
    <div>
      <div class="gc-card" style="background:var(--blue); border:none; margin-bottom:16px;">
        <h4 class="gc-heading" style="font-weight:700; font-size:13px; color:#1F5060;"><i class="fas fa-shield-halved" style="margin-right:8px;"></i> Config Akses</h4>
        <p style="font-size:11px; color:#1F5060; margin-top:4px; opacity:.85;">Buat atau ubah profil akses — tiap profil punya izin View/Add/Edit/Delete/Print sendiri per menu. Profil ini nanti dipilih untuk tiap karyawan di tab Hak Akses.</p>
      </div>

      <div class="gc-card" style="margin-bottom:16px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;" class="md:grid-cols-2">
          <div class="gc-field" style="margin-bottom:0;">
            <label>Pilih profil untuk diedit (atau buat baru)</label>
            <select :value="profilDipilih" @change="pilihProfil($event.target.value)">
              <option value="">+ Buat profil baru</option>
              <option v-for="p in daftarProfil" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
          <div class="gc-field" style="margin-bottom:0;">
            <label>Nama akses{{ profilDipilih ? ' (nama profil yang sedang diedit, tidak bisa diganti di sini)' : '' }}</label>
            <input v-model="namaAkses" type="text" placeholder="Contoh: admin_gudang_utama" :disabled="!!profilDipilih" :style="profilDipilih ? 'background:var(--ivory-dim); color:var(--text-muted); cursor:not-allowed;' : ''">
          </div>
        </div>
        <button @click="simpan" :disabled="menyimpan" class="btn-primary block">
          <i class="fas" :class="profilDipilih ? 'fa-rotate' : 'fa-save'" style="margin-right:8px;"></i>
          {{ menyimpan ? 'Menyimpan...' : (profilDipilih ? 'Update profil akses' : 'Simpan profil akses (baru)') }}
        </button>
      </div>

      <div v-if="memuat" style="text-align:center; padding:40px 0; color:var(--text-faint);">
        <i class="fas fa-spinner fa-spin" style="font-size:24px; margin-bottom:8px; display:block;"></i>Memuat...
      </div>

      <div v-else v-for="kategori in KATEGORI_URUTAN" :key="kategori" class="gc-card" style="margin-bottom:12px; padding:0; overflow:hidden;">
        <div @click="toggleKategori(kategori)" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; cursor:pointer; background:var(--ivory-dim);">
          <h3 class="gc-heading" style="font-size:13px; font-weight:700;">{{ kategori }}</h3>
          <i class="fas" :class="kategoriTerbuka[kategori] ? 'fa-chevron-up' : 'fa-chevron-down'" style="color:var(--text-muted);"></i>
        </div>
        <div v-show="kategoriTerbuka[kategori]" class="gc-table-scroll">
          <table class="gc-table">
            <thead>
              <tr>
                <th class="freeze freeze-left">Nama menu</th>
                <th style="text-align:center;">View</th>
                <th style="text-align:center;">Add</th>
                <th style="text-align:center;">Edit</th>
                <th style="text-align:center;">Delete</th>
                <th style="text-align:center;">Print</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in menuUntukKategori(kategori)" :key="m.id">
                <td class="freeze freeze-left" style="font-weight:600;">{{ m.label }}</td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].view" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].add" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].edit" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].delete" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].print" style="accent-color:var(--ok); width:16px; height:16px;"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-config-akses');
if (mountPoint) {
  const vm = createApp(AppConfigAkses).mount('#vue-config-akses');
  window.refreshConfigAkses = function() { vm.muat(); };
}
