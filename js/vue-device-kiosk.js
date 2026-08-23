// js/vue-device-kiosk.js
// ============================================================================
// Device Kiosk — kelola akun HP/tablet Kiosk gudang (dipakai fitur "Absensi
// Melalui QR", Fase 5 rencana Hilman 22 Agt 2026). HANYA OWNER (bukan
// Superuser) yang bisa buka menu ini — sudah digerbang di auth.js & rules.
//
// Bikin akun Firebase Auth pakai INSTANCE FIREBASE KEDUA (pola yang sama
// persis dengan buatAkunTanpaGangguSesi yang dulu dipakai vue-antrean-dakar.js
// sebelum redesign self-registrasi) — supaya createUserWithEmailAndPassword
// TIDAK "melempar" logout sesi Owner yang sedang aktif di instance UTAMA.
//
// Nonaktifkan kiosk = ubah status_kerja jadi bukan "Aktif" — REUSE 100%
// gerbang login yang SUDAH ADA (vue-login.js & auth.js sudah menolak login
// siapapun yang status_kerja bukan "Aktif"), tidak perlu logic baru.
// ============================================================================
import { createApp, ref, reactive, computed, watch, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
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
    // PEDOMAN §17 (STATUS-PROYEK.md) — search+paginasi WAJIB tiap menu
    // baru bertabel, pola client-side PERSIS sama dengan Master
    // Kendaraan (vue-reimburse.js).
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
        // BARU: cari via jenis_akun (BUKAN role — role kiosk TETAP
        // 'operator', nilai baku, lihat catatan di tambahKiosk() bawah).
        const snap = await getDocs(query(collection(db, "users"), where("jenis_akun", "==", "kiosk")));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
        daftarKiosk.value = list;
      } catch (e) {
        // DIPERBAIKI (22 Agt 2026) — SEBELUMNYA cuma console.error, user
        // TIDAK PERNAH tahu ada yang gagal (tabel kelihatan "kosong"
        // padahal sebenarnya QUERY DITOLAK). Sekarang error tampil jelas
        // di layar, bukan cuma di console yang jarang dicek.
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
      // Instance Firebase KEDUA — SEMENTARA, cuma hidup buat 1 kali proses
      // bikin akun ini, langsung dibuang (deleteApp) sesudahnya. Sesi Owner
      // di instance UTAMA (import { auth } dari firebase-config.js) SAMA
      // SEKALI tidak tersentuh proses ini.
      const appKedua = initializeApp(firebaseConfig, 'kiosk-creator-' + Date.now());
      const authKedua = getAuth(appKedua);
      try {
        await createUserWithEmailAndPassword(authKedua, form.email.trim(), form.password);
        // role TETAP 'operator' — WAJIB salah satu dari 5 nama baku
        // (STATUS-PROYEK.md §6.2, dipakai custom claim/syncRoleClaim +
        // isAdminLevel/isOwnerLevel di firestore.rules). Penanda kiosk
        // ada di field TERPISAH `jenis_akun`, dicek firestore.rules
        // lewat isKiosk()/gudangKiosk() (get() dokumen, bukan custom
        // claim) — supaya TIDAK menambah nilai ke-6 yang tidak dikenal
        // sistem role manapun.
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
          // DIPERBAIKI — SEBELUMNYA pesan generik menyembunyikan kode
          // error asli (misal 'permission-denied' dari Firestore Rules)
          // yang justru paling penting buat debug.
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
      pesanErrorMuat, muat
    };
  },
  template: `
    <div class="gc-card" style="margin-bottom:16px;">
      <h3 class="gc-heading" style="font-weight:700; font-size:13.5px; margin-bottom:6px;"><i class="fas fa-tablet-screen-button" style="color:var(--burgundy); margin-right:8px;"></i> Device Kiosk</h3>
      <p style="font-size:10.5px; color:var(--text-muted); margin-bottom:16px;">HP/tablet yang digantung tetap di gudang, dipakai fitur "Absensi Melalui QR" — karyawan tanpa HP/HP rusak bisa absen lewat sini (scan barcode + PIN).</p>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;" class="grid-cols-1 md:grid-cols-2">
        <div class="gc-field" style="margin-bottom:0;"><label>Nama Device</label><input v-model="form.namaDevice" type="text" placeholder="Kiosk SOG12 Pintu Depan"></div>
        <div class="gc-field" style="margin-bottom:0;"><label>Gudang (bisa lebih dari 1)</label><gudang-checkbox-select v-model="form.gudang" /></div>
        <div class="gc-field" style="margin-bottom:0;"><label>Email Akun Kiosk</label><input v-model="form.email" type="email" placeholder="kiosk-sog12@zevanic-erp.com"></div>
        <div class="gc-field" style="margin-bottom:0;"><label>Password</label><input v-model="form.password" type="password" placeholder="Min. 6 karakter"></div>
      </div>
      <button @click="tambahKiosk" :disabled="menyimpan" class="btn-primary"><i class="fas fa-plus" style="margin-right:6px;"></i>{{ menyimpan ? 'Membuat...' : 'Buat Device Kiosk' }}</button>
    </div>

    <div style="position:relative; margin-bottom:14px; max-width:320px;">
      <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
      <input v-model="cariKiosk" type="text" placeholder="Cari nama device atau email..." style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
    </div>

    <div class="gc-card" style="padding:0; overflow:hidden;">
      <div v-if="pesanErrorMuat" style="padding:16px; background:#FBE3DE; margin:14px; border-radius:12px;">
        <p style="font-size:11.5px; color:var(--danger); font-weight:700; margin-bottom:8px;"><i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>{{ pesanErrorMuat }}</p>
        <button @click="muat" class="icon-btn" style="font-size:11px; padding:5px 12px; border:1px solid var(--danger); border-radius:8px;">Coba Lagi</button>
      </div>
      <div v-if="memuat" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="daftarKiosk.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada Device Kiosk terdaftar.</div>
      <div v-else-if="daftarKioskHalaman.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Tidak ada yang cocok dengan pencarian.</div>
      <div v-else class="gc-table-scroll">
        <table class="gc-table">
          <thead><tr><th>Nama Device</th><th>Email</th><th>Gudang</th><th>Status</th><th class="freeze freeze-right">Aksi</th></tr></thead>
          <tbody>
            <tr v-for="k in daftarKioskHalaman" :key="k.id">
              <td><b>{{ k.nama }}</b></td>
              <td>{{ k.email }}</td>
              <td>{{ (k.gudang_penempatan || []).join(', ') }}</td>
              <td><span class="tag" :class="k.status_kerja === 'Aktif' ? 'ok' : 'danger'">{{ k.status_kerja }}</span></td>
              <td class="freeze freeze-right">
                <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                  <button @click="toggleAktif(k)" class="icon-btn" :title="k.status_kerja === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'"><i class="fas" :class="k.status_kerja === 'Aktif' ? 'fa-toggle-on' : 'fa-toggle-off'"></i></button>
                  <button @click="hapusKiosk(k)" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-if="!memuat && daftarKioskTersaring.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
      <button class="icon-btn" :disabled="halamanSaatIni <= 1" @click="gantiHalaman(-1)"><i class="fas fa-chevron-left"></i></button>
      <span style="font-size:12px; color:var(--text-muted);">Halaman {{ halamanSaatIni }} / {{ totalHalaman }} &middot; {{ daftarKioskTersaring.length }} device</span>
      <button class="icon-btn" :disabled="halamanSaatIni >= totalHalaman" @click="gantiHalaman(1)"><i class="fas fa-chevron-right"></i></button>
    </div>
  `
};

const mountPoint = document.getElementById('vue-device-kiosk');
if (mountPoint) createApp(AppDeviceKiosk).mount('#vue-device-kiosk');
