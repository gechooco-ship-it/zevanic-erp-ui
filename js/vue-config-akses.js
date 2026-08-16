// js/vue-config-akses.js
// ============================================================================
// Master Karyawan > Config Akses — definisikan Visibility/Create/Read/Edit/
// Delete untuk setiap kombinasi Role x Menu/Sub-menu. Ini "cetak biru" hak
// akses; layar Hak Akses (js/vue-hak-akses.js) yang menghubungkan karyawan
// ke Role ini.
//
// PENTING (batas fitur ini): layar ini menyimpan konfigurasinya dengan rapi
// ke Firestore (koleksi "akses_config"), TAPI belum ada bagian lain di
// aplikasi yang MEMBACA/menerapkan nilai-nilai ini untuk benar-benar
// menyembunyikan menu atau memblokir aksi Create/Edit/Delete — itu pekerjaan
// SUSULAN yang jauh lebih besar (perlu ubah aturTampilanBerdasarkanRole di
// auth.js, semua tombol Create/Edit/Delete di semua layar, DAN Firestore
// Security Rules supaya benar-benar aman, bukan cuma sembunyi di tampilan).
// Layar ini murni tempat MENGATUR nilainya dulu.
// ============================================================================
import { createApp, ref, reactive, computed, watch, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const DAFTAR_ROLE = ['operator', 'pic', 'admin', 'owner', 'superuser'];

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

const KATEGORI_LIST = ['Umum', 'Master Absensi', 'Master Karyawan', 'Integrasi'];

// Default awal SENGAJA disamakan dengan perilaku hardcode yang sudah jalan
// sekarang (lihat auth.js: aturTampilanBerdasarkanRole) — supaya begitu
// fitur ini pertama kali dipakai, tidak ada perubahan visibilitas mendadak.
function bikinDefaultUntukRole(role, menuId) {
  const semuaBenar = { visibility: true, create: true, read: true, edit: true, delete: true };
  const kosong = { visibility: false, create: false, read: false, edit: false, delete: false };

  if (role === 'owner' || role === 'superuser') return { ...semuaBenar };

  const menuAbsensi = ['config_absensi', 'penjadwalan', 'antrean_absensi', 'riwayat_absensi'];
  if (role === 'pic' || role === 'admin') {
    if (menuId === 'dashboard') return { visibility: true, create: false, read: true, edit: false, delete: false };
    if (menuId === 'profile') return { visibility: true, create: true, read: true, edit: true, delete: false };
    if (menuAbsensi.includes(menuId)) return { ...semuaBenar };
    return { ...kosong };
  }

  // operator
  if (menuId === 'dashboard') return { visibility: true, create: false, read: true, edit: false, delete: false };
  if (menuId === 'profile') return { visibility: true, create: true, read: true, edit: true, delete: false };
  return { ...kosong };
}

const AppConfigAkses = {
  setup() {
    const daftarAkses = ref([]);
    const memuat = ref(true);

    const cari = ref('');
    const filterRole = ref('ALL');
    const filterKategori = ref('ALL');

    const terpilih = reactive(new Set());
    const bulkVisibility = ref('');
    const bulkCreate = ref('');
    const bulkRead = ref('');
    const bulkEdit = ref('');
    const bulkDelete = ref('');
    const memprosesBulk = ref(false);

    function idDokumen(role, menuId) { return role + '_' + menuId; }

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDocs(collection(db, "akses_config"));
        const peta = {};
        snap.forEach(d => { peta[d.id] = d.data(); });

        // Kalau koleksi kosong (pemakaian pertama kali) ATAU ada kombinasi
        // Role x Menu yang belum tersimpan (menu baru ditambahkan setelah
        // seed pertama), isi otomatis dengan default yang meniru perilaku
        // hardcode saat ini — supaya layar ini selalu lengkap 5 x 12 baris.
        const batch = writeBatch(db);
        let adaYangDiisi = false;
        const list = [];
        DAFTAR_ROLE.forEach(role => {
          DAFTAR_MENU.forEach(menu => {
            const id = idDokumen(role, menu.id);
            let data = peta[id];
            if (!data) {
              data = { role, menu: menu.id, ...bikinDefaultUntukRole(role, menu.id) };
              batch.set(doc(db, "akses_config", id), data);
              adaYangDiisi = true;
            }
            list.push({ id, role, menuId: menu.id, menuLabel: menu.label, kategori: menu.kategori, ...data });
          });
        });
        if (adaYangDiisi) await batch.commit();
        daftarAkses.value = list;
      } catch (e) {
        console.error("Gagal muat Config Akses:", e);
      }
      memuat.value = false;
    }

    const hasilFilter = computed(() => {
      const kata = cari.value.toLowerCase().trim();
      return daftarAkses.value.filter(d => {
        if (kata && !d.menuLabel.toLowerCase().includes(kata) && !d.role.toLowerCase().includes(kata)) return false;
        if (filterRole.value !== 'ALL' && d.role !== filterRole.value) return false;
        if (filterKategori.value !== 'ALL' && d.kategori !== filterKategori.value) return false;
        return true;
      });
    });

    function toggleCheckbox(id) {
      if (terpilih.has(id)) terpilih.delete(id); else terpilih.add(id);
    }
    function pilihSemua() { hasilFilter.value.forEach(d => terpilih.add(d.id)); }
    function bersihkanPilihan() { terpilih.clear(); }
    const headerDicentang = computed(() =>
      hasilFilter.value.length > 0 && hasilFilter.value.every(d => terpilih.has(d.id))
    );
    function toggleSemua() {
      if (headerDicentang.value) hasilFilter.value.forEach(d => terpilih.delete(d.id));
      else hasilFilter.value.forEach(d => terpilih.add(d.id));
    }

    // Toggle langsung per-sel (untuk perbaikan satu-dua titik saja, auto simpan)
    async function toggleLangsung(item, field) {
      const nilaiBaru = !item[field];
      try {
        await setDoc(doc(db, "akses_config", item.id), { [field]: nilaiBaru }, { merge: true });
        item[field] = nilaiBaru;
      } catch (e) {
        console.error("Gagal update akses:", e);
        alert("Gagal menyimpan perubahan.");
      }
    }

    async function terapkanBulkUpdate() {
      const daftarTerpilih = Array.from(terpilih);
      if (daftarTerpilih.length === 0) return alert("Belum ada baris yang dicentang/terpilih.");
      if (!bulkVisibility.value && !bulkCreate.value && !bulkRead.value && !bulkEdit.value && !bulkDelete.value) {
        return alert("Pilih minimal salah satu nilai (Visibility/Create/Read/Edit/Delete) untuk diterapkan.");
      }
      if (!confirm(`Terapkan perubahan ke ${daftarTerpilih.length} baris terpilih?`)) return;

      const dataUpdate = {};
      if (bulkVisibility.value) dataUpdate.visibility = bulkVisibility.value === 'ya';
      if (bulkCreate.value) dataUpdate.create = bulkCreate.value === 'ya';
      if (bulkRead.value) dataUpdate.read = bulkRead.value === 'ya';
      if (bulkEdit.value) dataUpdate.edit = bulkEdit.value === 'ya';
      if (bulkDelete.value) dataUpdate.delete = bulkDelete.value === 'ya';

      memprosesBulk.value = true;
      try {
        const batch = writeBatch(db);
        daftarTerpilih.forEach(id => batch.set(doc(db, "akses_config", id), dataUpdate, { merge: true }));
        await batch.commit();
        alert(`Berhasil diterapkan ke ${daftarTerpilih.length} baris.`);
      } catch (e) {
        console.error("Gagal update massal akses:", e);
        alert("Gagal menyimpan perubahan massal.");
      }
      memprosesBulk.value = false;
      bulkVisibility.value = ''; bulkCreate.value = ''; bulkRead.value = ''; bulkEdit.value = ''; bulkDelete.value = '';
      await muat();
    }

    onMounted(async () => { await window.authReady; muat(); });

    return {
      daftarAkses, memuat, muat, cari, filterRole, filterKategori, hasilFilter,
      DAFTAR_ROLE, KATEGORI_LIST,
      terpilih, toggleCheckbox, pilihSemua, bersihkanPilihan, headerDicentang, toggleSemua,
      toggleLangsung,
      bulkVisibility, bulkCreate, bulkRead, bulkEdit, bulkDelete, memprosesBulk, terapkanBulkUpdate
    };
  },
  template: `
    <div>
      <div class="gc-card" style="background:var(--blue); border:none; margin-bottom:16px;">
        <h4 class="gc-heading" style="font-weight:700; font-size:13px; color:#1F5060;"><i class="fas fa-shield-halved" style="margin-right:8px;"></i> Config Akses</h4>
        <p style="font-size:11px; color:#1F5060; margin-top:4px; opacity:.85;">Atur Visibility (menu tampil/tidak), Create, Read, Edit, Delete untuk tiap kombinasi Role &amp; Menu. Klik langsung salah satu tanda centang untuk ubah satu titik, atau centang beberapa baris lalu pakai Update Massal di bawah.</p>
      </div>

      <!-- Update Massal -->
      <div class="gc-card" style="margin-bottom:16px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:12px;"><i class="fas fa-layer-group" style="color:var(--burgundy); margin-right:8px;"></i> Update massal ({{ terpilih.size }} baris terpilih)</h3>
        <p style="font-size:10.5px; color:var(--text-muted); margin-bottom:12px;">Kosongkan (\"Tidak diubah\") kolom yang tidak ingin diubah. Berlaku untuk baris yang dicentang di tabel bawah.</p>
        <div style="gap:10px;" class="grid grid-cols-2 md:grid-cols-5">
          <div class="gc-field" style="margin-bottom:0;"><label>Visibility</label><select v-model="bulkVisibility"><option value="">Tidak diubah</option><option value="ya">Ya</option><option value="tidak">Tidak</option></select></div>
          <div class="gc-field" style="margin-bottom:0;"><label>Create</label><select v-model="bulkCreate"><option value="">Tidak diubah</option><option value="ya">Ya</option><option value="tidak">Tidak</option></select></div>
          <div class="gc-field" style="margin-bottom:0;"><label>Read</label><select v-model="bulkRead"><option value="">Tidak diubah</option><option value="ya">Ya</option><option value="tidak">Tidak</option></select></div>
          <div class="gc-field" style="margin-bottom:0;"><label>Edit</label><select v-model="bulkEdit"><option value="">Tidak diubah</option><option value="ya">Ya</option><option value="tidak">Tidak</option></select></div>
          <div class="gc-field" style="margin-bottom:0;"><label>Delete</label><select v-model="bulkDelete"><option value="">Tidak diubah</option><option value="ya">Ya</option><option value="tidak">Tidak</option></select></div>
        </div>
        <button @click="terapkanBulkUpdate" :disabled="memprosesBulk" class="btn-primary block" style="margin-top:14px;">
          <i class="fas fa-check-double" style="margin-right:8px;"></i> {{ memprosesBulk ? 'Memproses...' : 'Terapkan ke baris terpilih' }}
        </button>
      </div>

      <div class="gc-card">
        <div style="position:relative; margin-bottom:14px;">
          <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
          <input v-model="cari" type="text" placeholder="Cari role atau nama menu..." style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; outline:none;">
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
          <select v-model="filterRole" style="padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
            <option value="ALL">Semua role</option>
            <option v-for="r in DAFTAR_ROLE" :key="r" :value="r">{{ r }}</option>
          </select>
          <select v-model="filterKategori" style="padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
            <option value="ALL">Semua kategori</option>
            <option v-for="k in KATEGORI_LIST" :key="k" :value="k">{{ k }}</option>
          </select>
        </div>

        <div class="gc-table-scroll" style="border:1px solid var(--line);">
          <table class="gc-table">
            <thead>
              <tr>
                <th class="freeze freeze-left" style="width:36px;"><input type="checkbox" :checked="headerDicentang" @change="toggleSemua" style="accent-color:var(--burgundy);"></th>
                <th class="freeze freeze-left" style="left:36px;">Role</th>
                <th>Menu</th>
                <th>Kategori</th>
                <th style="text-align:center;">Visibility</th>
                <th style="text-align:center;">Create</th>
                <th style="text-align:center;">Read</th>
                <th style="text-align:center;">Edit</th>
                <th style="text-align:center;">Delete</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="memuat"><td colspan="9" style="text-align:center; padding:20px; color:var(--text-faint);">Memuat data...</td></tr>
              <tr v-else-if="hasilFilter.length === 0"><td colspan="9" style="text-align:center; padding:20px; color:var(--text-faint);">Tidak ada yang cocok dengan filter.</td></tr>
              <tr v-for="item in hasilFilter" :key="item.id">
                <td class="freeze freeze-left"><input type="checkbox" :checked="terpilih.has(item.id)" @change="toggleCheckbox(item.id)" style="accent-color:var(--burgundy);"></td>
                <td class="freeze freeze-left" style="left:36px; text-transform:uppercase; font-weight:700; font-family:'Poppins',sans-serif; font-size:11.5px;">{{ item.role }}</td>
                <td style="font-weight:600;">{{ item.menuLabel }}</td>
                <td class="gc-cell-muted">{{ item.kategori }}</td>
                <td style="text-align:center;"><input type="checkbox" :checked="item.visibility" @change="toggleLangsung(item, 'visibility')" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" :checked="item.create" @change="toggleLangsung(item, 'create')" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" :checked="item.read" @change="toggleLangsung(item, 'read')" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" :checked="item.edit" @change="toggleLangsung(item, 'edit')" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" :checked="item.delete" @change="toggleLangsung(item, 'delete')" style="accent-color:var(--ok); width:16px; height:16px;"></td>
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
