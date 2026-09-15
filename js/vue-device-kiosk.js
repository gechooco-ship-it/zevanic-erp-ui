// js/vue-device-kiosk.js
// Device Kiosk — kelola akun HP/tablet kiosk gudang (buat, aktif/nonaktif,
// hapus). Hanya Owner yang bisa membuka menu ini (digerbang auth.js + rules).
//
// Koleksi & field:
// - users (id dokumen = email): jenis_akun 'kiosk' sebagai penanda, role tetap
//   'operator', nama, gudang_penempatan (array), status_kerja, status_approval,
//   dibuat_pada, dibuat_oleh.
//
// Jebakan:
// - Pembuatan akun pakai INSTANCE FIREBASE KEDUA lalu deleteApp; kalau pakai
//   instance utama, createUserWithEmailAndPassword melempar sesi Owner logout.
// - Daftar dibaca TANPA where jenis_akun (ambil seluruh users, saring di JS) —
//   query berfilter ke koleksi users ditolak Rules.
// - Nonaktif = status_kerja bukan 'Aktif'; yang menolak login adalah
//   vue-login.js/auth.js, tidak ada logika blokir tersendiri di sini.
// - Hapus cuma membuang dokumen users; akun Firebase Auth-nya tetap ada.
// - Search + paginasi client-side, 15 baris per halaman.

import { createApp, ref, reactive, computed, watch, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { db } from "./firebase-config.js";
import { firebaseConfig } from "./firebase-config.js";
import { GudangCheckboxSelect } from './vue-components.js';

const AppDeviceKiosk = {
  components: { GudangCheckboxSelect },
  setup() {
    const daftarKiosk = ref([]);
    const memuat = ref(true);
    const pesanErrorMuat = ref('');
    // Tiap menu bertabel WAJIB punya search + paginasi. Pola client-side
    // PERSIS sama dengan Master Kendaraan (vue-reimburse.js).
    const cariKiosk = ref('');
    const PER_HALAMAN = 15;
    const halamanSaatIni = ref(1);
    watch(cariKiosk, () => { halamanSaatIni.value = 1; });
    const daftarKioskTersaring = computed(() => {
      if (!cariKiosk.value.trim()) return daftarKiosk.value;
      const kw = cariKiosk.value.toLowerCase();
      return daftarKiosk.value.filter(k => (k.nama || '').toLowerCase().includes(kw) || (k.email || '').toLowerCase().includes(kw));
    });
    const totalHalaman = computed(() => Math.max(1, Math.ceil(daftarKioskTersaring.value.length / PER_HALAMAN)));
    const daftarKioskHalaman = computed(() => {
      const mulai = (halamanSaatIni.value - 1) * PER_HALAMAN;
      return daftarKioskTersaring.value.slice(mulai, mulai + PER_HALAMAN);
    });
    function gantiHalaman(delta) { halamanSaatIni.value = Math.min(totalHalaman.value, Math.max(1, halamanSaatIni.value + delta)); }
    const menyimpan = ref(false);

    const form = reactive({
      namaDevice: '',
      email: '',
      password: '',
      gudang: []
    });

    async function muat() {
      memuat.value = true;
      pesanErrorMuat.value = '';
      try {
        // Baca SELURUH collection users TANPA filter lalu saring jenis_akun di
        // JavaScript, bukan lewat query Firestore. Query berfilter kena aturan baca
        // users yang rumit (isKiosk pakai get); pola tanpa filter ini sama dengan
        // Master Kendaraan (vue-reimburse.js, MasterKendaraanManager.muat).
        const snap = await getDocs(collection(db, "users"));
        const list = [];
        snap.forEach(d => {
          const data = d.data();
          if (data.jenis_akun === 'kiosk') list.push({ id: d.id, ...data });
        });
        list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
        daftarKiosk.value = list;
      } catch (e) {
        console.error("Gagal muat daftar device kiosk:", e);
        pesanErrorMuat.value = `Gagal memuat daftar Device Kiosk: ${e.code || e.message || 'error tidak diketahui'}`;
      }
      memuat.value = false;
    }

    async function tambahKiosk() {
      if (!form.namaDevice.trim()) return alert("Isi nama device dulu (contoh: Kiosk SOG12 Pintu Depan).");
      if (!form.email.trim()) return alert("Isi email buat akun kiosk ini.");
      if (!form.password || form.password.length < 6) return alert("Password minimal 6 karakter.");
      if (form.gudang.length === 0) return alert("Pilih minimal 1 gudang buat kiosk ini.");

      menyimpan.value = true;
      // Instance Firebase KEDUA — SEMENTARA, cuma hidup buat 1 kali proses bikin
      // akun ini, langsung dibuang (deleteApp) sesudahnya. Sesi Owner di
      // instance UTAMA (import { auth } dari firebase-config.js) SAMA SEKALI
      // tidak tersentuh proses ini.
      const appKedua = initializeApp(firebaseConfig, 'kiosk-creator-' + Date.now());
      const authKedua = getAuth(appKedua);
      try {
        await createUserWithEmailAndPassword(authKedua, form.email.trim(), form.password);
        // role TETAP 'operator' — wajib salah satu dari 5 nama baku yang dipakai
        // custom claim/syncRoleClaim + isAdminLevel/isOwnerLevel di firestore.rules.
        // Penanda kiosk ada di field TERPISAH `jenis_akun`, dicek firestore.rules
        // lewat isKiosk/gudangKiosk (get dokumen, bukan custom claim).
        await setDoc(doc(db, "users", form.email.trim()), {
          role: 'operator',
          jenis_akun: 'kiosk',
          nama: form.namaDevice.trim(),
          email: form.email.trim(),
          gudang_penempatan: form.gudang,
          status_kerja: 'Aktif',
          status_approval: 'APPROVED',
          dibuat_pada: new Date().toISOString(),
          dibuat_oleh: window.currentUser.email
        });
        alert("Device Kiosk berhasil dibuat!");
        form.namaDevice = ''; form.email = ''; form.password = ''; form.gudang = [];
        await muat();
      } catch (e) {
        console.error("Gagal bikin device kiosk:", e);
        if (e.code === 'auth/email-already-in-use') {
          alert("Email ini sudah dipakai akun lain.");
        } else if (e.code === 'auth/weak-password') {
          alert("Password terlalu lemah, minimal 6 karakter.");
        } else if (e.code === 'auth/invalid-email') {
          alert("Format email tidak valid.");
        } else {
          // Tampilkan kode error aslinya (misal 'permission-denied' dari Firestore
          // Rules); pesan generik menyembunyikan info yang paling penting buat debug.
          alert(`Gagal membuat device kiosk: ${e.code || e.message || 'error tidak diketahui'}`);
        }
      } finally {
        await deleteApp(appKedua); // WAJIB dibuang — jangan biarkan instance kedua menumpuk di memori
      }
      menyimpan.value = false;
    }

    async function toggleAktif(k) {
      const statusBaru = k.status_kerja === 'Aktif' ? 'Nonaktif' : 'Aktif';
      if (!confirm(`${statusBaru === 'Nonaktif' ? 'Nonaktifkan' : 'Aktifkan'} kiosk "${k.nama}"?`)) return;
      try {
        await updateDoc(doc(db, "users", k.id), { status_kerja: statusBaru });
        await muat();
      } catch (e) {
        console.error("Gagal ubah status kiosk:", e);
        alert("Gagal mengubah status device kiosk.");
      }
    }

    async function hapusKiosk(k) {
      if (!confirm(`Hapus PERMANEN device kiosk "${k.nama}"? Ini tidak menghapus akun Firebase Auth-nya (perlu dihapus manual dari Firebase Console kalau mau bersih total), cuma menghapus data profilnya di sini.`)) return;
      try {
        await deleteDoc(doc(db, "users", k.id));
        await muat();
      } catch (e) {
        console.error("Gagal hapus device kiosk:", e);
        alert("Gagal menghapus device kiosk.");
      }
    }

    onMounted(async () => { await window.authReady; await muat(); });
    return {
      daftarKiosk, memuat, menyimpan, form, tambahKiosk, toggleAktif, hapusKiosk,
      cariKiosk, halamanSaatIni, totalHalaman, gantiHalaman, daftarKioskHalaman,
      daftarKioskTersaring, pesanErrorMuat, muat
    };
  },
  template: `
    <div class="gc-card" style="margin-bottom:16px;">
      <h3 class="gc-heading" style="font-weight:700; font-size:13.5px; margin-bottom:6px;"><i class="fas fa-tablet-screen-button" style="color:var(--burgundy); margin-right:8px;"></i> Device Kiosk</h3>
      <p style="font-size:10.5px; color:var(--text-muted); margin-bottom:16px;">HP/tablet yang digantung tetap di gudang, dipakai fitur "Absensi Melalui QR" — karyawan tanpa HP/HP rusak bisa absen lewat sini (scan barcode + PIN).</p>

      <div style="display:grid; gap:10px; margin-bottom:12px;" class="grid-cols-1 md:grid-cols-2">
        <div class="gc-field" style="margin-bottom:0;"><label>Nama Device</label><input v-model="form.namaDevice" type="text" placeholder="Kiosk SOG12 Pintu Depan"></div>
        <div class="gc-field" style="margin-bottom:0;"><label>Gudang (bisa lebih dari 1)</label><gudang-checkbox-select v-model="form.gudang" /></div>
        <div class="gc-field" style="margin-bottom:0;"><label>Email Akun Kiosk</label><input v-model="form.email" type="email" placeholder="kiosk-sog12@zevanic-erp.com"></div>
        <div class="gc-field" style="margin-bottom:0;"><label>Password</label><input v-model="form.password" type="password" placeholder="Min. 6 karakter"></div>
      </div>
      <button @click="tambahKiosk" :disabled="menyimpan" class="btn-primary"><i class="fas fa-plus" style="margin-right:6px;"></i>{{ menyimpan ? 'Membuat...' : 'Buat Device Kiosk' }}</button>
    </div>

    <div style="position:relative; margin-bottom:14px; max-width:320px;">
      <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
      <input v-model="cariKiosk" type="text" placeholder="Cari nama device atau email..." style="width:100%; padding:9px 13px 9px 34px; background:var(--ivory-dim); border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
    </div>

    <div v-if="pesanErrorMuat" class="gc-card" style="padding:16px; background:#FBE3DE; margin-bottom:14px;">
      <p style="font-size:11.5px; color:var(--danger); font-weight:700; margin-bottom:8px;"><i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>{{ pesanErrorMuat }}</p>
      <button @click="muat" class="icon-btn" style="font-size:11px; padding:5px 12px; border:1px solid var(--danger); border-radius:8px;">Coba Lagi</button>
    </div>
    <div v-if="memuat" class="gc-card" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <div v-else-if="daftarKiosk.length === 0" class="gc-card" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada Device Kiosk terdaftar.</div>
    <div v-else-if="daftarKioskHalaman.length === 0" class="gc-card" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Tidak ada yang cocok dengan pencarian.</div>
    <div v-else style="display:flex; flex-direction:column; gap:10px;">
      <div v-for="k in daftarKioskHalaman" :key="k.id" class="gc-card" style="padding:14px;">
        <div style="display:flex; gap:12px; align-items:flex-start; margin-bottom:12px;">
          <div style="width:44px; height:44px; border-radius:10px; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; flex-shrink:0;"><i class="fas fa-tablet-screen-button" style="color:var(--burgundy); font-size:16px;"></i></div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:13.5px;">{{ k.nama }}</div>
          </div>
          <span class="tag" :class="k.status_kerja === 'Aktif' ? 'ok' : 'danger'" style="flex-shrink:0;">{{ k.status_kerja }}</span>
        </div>
        <div class="kartu-rows" style="display:flex; flex-direction:column; gap:5px; background:var(--ivory-dim); border-radius:10px; padding:10px 12px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span style="color:var(--text-faint); flex-shrink:0;">Email</span><span style="font-weight:700; text-align:right; word-break:break-all;">{{ k.email }}</span></div>
          <div style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span style="color:var(--text-faint); flex-shrink:0;">Gudang</span><span style="font-weight:700; text-align:right;">{{ (k.gudang_penempatan || []).join(', ') || '-' }}</span></div>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="toggleAktif(k)" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 12px;"><i class="fas" :class="k.status_kerja === 'Aktif' ? 'fa-toggle-off' : 'fa-toggle-on'" style="margin-right:6px;"></i>{{ k.status_kerja === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan' }}</button>
          <button @click="hapusKiosk(k)" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 12px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-trash-alt" style="margin-right:6px;"></i>Hapus</button>
        </div>
      </div>
    </div>
    <div v-if="!memuat && daftarKioskTersaring.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
      <button class="icon-btn" :disabled="halamanSaatIni <= 1" @click="gantiHalaman(-1)"><i class="fas fa-chevron-left"></i></button>
      <span style="font-size:12px; color:var(--text-muted);">Halaman {{ halamanSaatIni }} / {{ totalHalaman }} &middot; {{ daftarKioskTersaring.length }} device</span>
      <button class="icon-btn" :disabled="halamanSaatIni >= totalHalaman" @click="gantiHalaman(1)"><i class="fas fa-chevron-right"></i></button>
    </div>
  `
};

// Mount ditunda sampai tab-device-kiosk benar-benar dinavigasi (lihat
// dashboard.js), mengikuti pola window.pastikanMountXxx di semua layar admin.
// Mount top-level memboroskan 1 baca Firestore tiap pemuatan halaman siapapun
// dan memicu race condition dengan window.authReady (tabel "Memuat.." macet).
let vmDeviceKiosk = null;
window.pastikanMountDeviceKiosk = function() {
  if (vmDeviceKiosk) { if (typeof vmDeviceKiosk.muat === 'function') vmDeviceKiosk.muat(); return; }
  const mountPoint = document.getElementById('vue-device-kiosk');
  if (mountPoint) vmDeviceKiosk = createApp(AppDeviceKiosk).mount('#vue-device-kiosk');
};
