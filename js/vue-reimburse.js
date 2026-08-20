// js/vue-reimburse.js
// ============================================================================
// Fitur Reimburse — persetujuan berjenjang 3 tahap (rencana Hilman, 19 Agt
// 2026): Operator ajukan -> Admin Finance (role admin) ACC -> PIC (role
// pic) ACC -> Owner ACC (final).
//
// DESAIN KUNCI: 1 field `tahap` di dokumen `reimburse` yang jadi penanda
// tunggal ada di posisi mana pengajuannya — BUKAN 3 field status terpisah
// kayak Absensi masuk/keluar. Alasannya beda dari Absensi: di Reimburse
// SELALU cuma 1 tahap yang aktif di satu waktu (berurutan/sequential,
// tidak pernah 2 tahap sekaligus pending kayak Clock In+Out yang memang
// BISA bersamaan). Query jadi sesederhana where('tahap','==', tahapSaya).
//
// PENTING: ini fitur PERTAMA di seluruh app yang bikin role 'admin' dan
// 'pic' BENERAN beda perilaku (sebelumnya SELALU disamakan lewat
// isAdminLevel() — lihat diskusi sebelumnya di STATUS-PROYEK.md).
// 'admin' = Admin Finance (validator tahap 1), 'pic' = PIC (validator
// tahap 2). Keduanya di-scope ke gudang sendiri (window.bolehLihatData),
// PERSIS pola yang sudah baku dipakai di Antrean Absensi/Lembur/Dakar.
//
// Keamanan SEBENARNYA (anti-loncat-tahap) ada di firestore.rules —
// bagian sini cuma UI, kalau ada yang nekat panggil updateDoc() langsung
// dari Console browser, Firestore Rules yang jadi penjaga terakhir.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, addDoc, doc, updateDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { MasterDataCategory } from './vue-components.js';

// Kompresi gambar sisi klien — pola SAMA seperti js/camera.js (foto KTP),
// disalin di sini (bukan diimpor) karena kompresGambar di camera.js
// tidak di-export ke window, cuma dipakai internal file itu.
function kompresGambarReimburse(file, maxDimensi, kualitas) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        let { width, height } = img;
        if (width > maxDimensi || height > maxDimensi) {
          if (width > height) { height = Math.round(height * (maxDimensi / width)); width = maxDimensi; }
          else { width = Math.round(width * (maxDimensi / height)); height = maxDimensi; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', kualitas));
      };
      img.onerror = () => reject(new Error("Gagal memuat gambar."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}

// Diekspor juga (dipakai test + dipakai ulang di kartu antrean) — tentukan
// tahap SELANJUTNYA berdasar tahap SEKARANG + keputusan Accept/Reject.
export function tahapSelanjutnya(tahapSekarang, disetujui) {
  const alur = { menunggu_admin_finance: 'menunggu_pic', menunggu_pic: 'menunggu_owner', menunggu_owner: 'disetujui' };
  if (!disetujui) return 'ditolak';
  return alur[tahapSekarang] || null; // null = tahap tidak dikenal, jangan diproses
}

// Diekspor juga — field mana yang bertanggung jawab di tahap SEKARANG
// (dipakai buat validated_by_xxx/validated_at_xxx).
export function namaValidatorTahap(tahapSekarang) {
  const peta = { menunggu_admin_finance: 'admin_finance', menunggu_pic: 'pic', menunggu_owner: 'owner' };
  return peta[tahapSekarang] || null;
}

// Diekspor juga — role APA yang berwenang di tahap SEKARANG (dipakai
// cocokkan window.currentUser.role, DUPLIKAT sengaja dari firestore.rules
// supaya tombol Accept/Reject di UI cuma tampil buat yang benar berhak,
// walau penjaga SEBENARNYA tetap Rules — ini cuma cegah orang bingung
// lihat tombol yang toh bakal ditolak server).
export function rolesBolehProses(tahapSekarang) {
  const peta = {
    menunggu_admin_finance: ['admin', 'owner', 'superuser'],
    menunggu_pic: ['pic', 'owner', 'superuser'],
    menunggu_owner: ['owner', 'superuser']
  };
  return peta[tahapSekarang] || [];
}

export function formatRupiah(angka) {
  return 'Rp' + Number(angka || 0).toLocaleString('id-ID');
}

const LABEL_TAHAP = {
  menunggu_admin_finance: 'Menunggu Admin Finance',
  menunggu_pic: 'Sudah ACC Admin Finance — Menunggu PIC',
  menunggu_owner: 'Sudah ACC PIC — Menunggu Owner',
  disetujui: 'Disetujui (Selesai)',
  ditolak: 'Ditolak'
};
function warnaTahap(tahap) {
  if (tahap === 'disetujui') return 'ok';
  if (tahap === 'ditolak') return 'danger';
  return 'warn';
}

// ============================================================================
// KOMPONEN 1 — Tab "Ajukan Reimburse" (dipasang di Account Profile,
// diimpor & didaftarkan di vue-account-profile.js, BUKAN app mandiri).
// ============================================================================
export const AjukanReimburseTab = {
  setup() {
    const opsiKategori = ref([]);
    const form = reactive({ kategori: '', jumlah: '', keterangan: '', fotoBukti: '' });
    const mengirim = ref(false);
    const riwayatSaya = ref([]);
    const memuatRiwayat = ref(true);

    async function muatOpsiKategori() {
      opsiKategori.value = window.ambilMasterList ? await window.ambilMasterList('kategori_reimburse') : [];
      if (opsiKategori.value.length > 0 && !form.kategori) form.kategori = opsiKategori.value[0];
    }

    function pilihFoto(event) {
      const file = event.target.files[0];
      if (!file) return;
      kompresGambarReimburse(file, 1000, 0.75)
        .then(dataUrl => { form.fotoBukti = dataUrl; })
        .catch(e => { console.error("Gagal proses foto bukti:", e); alert("Gagal memproses foto, coba foto lain."); });
    }

    async function muatRiwayatSaya() {
      memuatRiwayat.value = true;
      try {
        const snap = await getDocs(query(collection(db, "reimburse"), where("email", "==", window.currentUser.email)));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.diajukan_pada?.toDate?.().getTime() || 0) - (a.diajukan_pada?.toDate?.().getTime() || 0));
        riwayatSaya.value = list;
      } catch (e) {
        console.error("Gagal muat riwayat reimburse saya:", e);
      }
      memuatRiwayat.value = false;
    }

    async function ajukan() {
      if (!form.kategori) return alert("Pilih kategori pengeluaran dulu.");
      const jumlahAngka = parseInt(String(form.jumlah).replace(/\D/g, ''), 10);
      if (!jumlahAngka || jumlahAngka <= 0) return alert("Isi jumlah reimburse yang benar (harus lebih dari 0).");
      if (!form.fotoBukti) return alert("Foto bukti/struk wajib dilampirkan.");

      mengirim.value = true;
      try {
        await addDoc(collection(db, "reimburse"), {
          email: window.currentUser.email,
          nama_pegawai: window.currentUser.name,
          jenis_pekerjaan: window.currentUser.jenis_pekerjaan || '',
          gudang: (window.currentUser.gudang_penempatan || [])[0] || '',
          kategori: form.kategori,
          jumlah: jumlahAngka,
          keterangan: form.keterangan || '',
          foto_bukti: form.fotoBukti,
          tahap: 'menunggu_admin_finance',
          diajukan_pada: serverTimestamp()
        });
        alert("Pengajuan reimburse berhasil dikirim, menunggu ACC Admin Finance.");
        form.jumlah = ''; form.keterangan = ''; form.fotoBukti = '';
        await muatRiwayatSaya();
      } catch (e) {
        console.error("Gagal ajukan reimburse:", e);
        alert("Gagal mengirim pengajuan. Coba lagi, atau hubungi Admin kalau terus gagal.");
      }
      mengirim.value = false;
    }

    function lihatFotoBesar(url) {
      if (url && window.bukaPreviewFoto) window.bukaPreviewFoto(url);
    }

    onMounted(async () => { await window.authReady; await muatOpsiKategori(); await muatRiwayatSaya(); });
    return {
      opsiKategori, form, mengirim, pilihFoto, ajukan, lihatFotoBesar,
      riwayatSaya, memuatRiwayat, LABEL_TAHAP, warnaTahap, formatRupiah
    };
  },
  template: `
    <div>
      <div class="gc-card" style="max-width:520px; margin:0 auto 16px;">
        <h4 class="gc-heading" style="font-weight:700; font-size:13px; margin-bottom:14px;"><i class="fas fa-receipt" style="color:var(--burgundy); margin-right:8px;"></i> Ajukan Reimburse Baru</h4>
        <div class="gc-field">
          <label>Kategori Pengeluaran</label>
          <select v-model="form.kategori"><option v-for="k in opsiKategori" :key="k" :value="k">{{ k }}</option></select>
        </div>
        <div class="gc-field">
          <label>Jumlah (Rp)</label>
          <input v-model="form.jumlah" type="number" min="1" placeholder="Contoh: 50000">
        </div>
        <div class="gc-field">
          <label>Keterangan</label>
          <textarea v-model="form.keterangan" rows="2" placeholder="Contoh: BBM antar barang ke SOG12"></textarea>
        </div>
        <div class="gc-field">
          <label>Foto Bukti / Struk *</label>
          <input type="file" accept="image/*" capture="environment" @change="pilihFoto">
          <img v-if="form.fotoBukti" :src="form.fotoBukti" style="margin-top:8px; width:100px; height:100px; object-fit:cover; border-radius:12px; border:1px solid var(--line);">
        </div>
        <button @click="ajukan" :disabled="mengirim" class="btn-primary block" style="margin-top:6px;">
          <i class="fas fa-paper-plane" style="margin-right:6px;"></i>{{ mengirim ? 'Mengirim...' : 'Ajukan Reimburse' }}
        </button>
      </div>

      <h4 class="gc-heading" style="font-weight:700; font-size:12.5px; margin-bottom:10px;">Riwayat Pengajuan Saya</h4>
      <div v-if="memuatRiwayat" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="riwayatSaya.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px; background:var(--surface); border:1px dashed var(--line); border-radius:14px;">Belum pernah mengajukan reimburse.</div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="r in riwayatSaya" :key="r.id" class="gc-card" style="padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
            <div>
              <b style="font-size:12.5px;">{{ r.kategori }}</b>
              <p style="font-size:11px; color:var(--text-muted); margin-top:2px;">{{ r.keterangan || '-' }}</p>
            </div>
            <b style="font-size:13px; white-space:nowrap;">{{ formatRupiah(r.jumlah) }}</b>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
            <span class="tag" :class="warnaTahap(r.tahap)">{{ LABEL_TAHAP[r.tahap] || r.tahap }}</span>
            <img v-if="r.foto_bukti" :src="r.foto_bukti" @click="lihatFotoBesar(r.foto_bukti)" style="width:32px; height:32px; object-fit:cover; border-radius:8px; cursor:pointer;">
          </div>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// KOMPONEN 2 — Kartu antrean (dipakai Admin Finance/PIC/Owner, tombolnya
// SAMA untuk ketiganya, tapi cuma efektif kalau role-nya cocok dengan
// tahap dokumen ini — dijaga rolesBolehProses() + firestore.rules).
// ============================================================================
const ReimburseCard = {
  props: { docId: { type: String, required: true }, data: { type: Object, required: true } },
  emits: ['diproses'],
  setup(props, { emit }) {
    const memproses = ref(false);
    const bolehProses = computed(() => rolesBolehProses(props.data.tahap).includes((window.currentUser.role || '').toLowerCase()));

    function lihatFotoBesar() {
      if (props.data.foto_bukti && window.bukaPreviewFoto) window.bukaPreviewFoto(props.data.foto_bukti);
    }

    async function proses(disetujui) {
      const tahapBaru = tahapSelanjutnya(props.data.tahap, disetujui);
      const namaValidator = namaValidatorTahap(props.data.tahap);
      if (!tahapBaru || !namaValidator) return; // tahap tidak dikenal/sudah final, jangan proses apapun

      memproses.value = true;
      try {
        const dataUpdate = {
          tahap: tahapBaru,
          [`validated_by_${namaValidator}`]: window.currentUser.name || window.currentUser.email,
          [`validated_at_${namaValidator}`]: serverTimestamp()
        };
        if (!disetujui) dataUpdate.ditolak_di_tahap = namaValidator;
        await updateDoc(doc(db, "reimburse", props.docId), dataUpdate);
        emit('diproses');
      } catch (e) {
        console.error("Gagal proses reimburse:", e);
        alert("Terjadi kesalahan sistem saat memproses. Kalau ini terus terjadi, mungkin Anda tidak berwenang di tahap ini.");
      }
      memproses.value = false;
    }

    return { memproses, bolehProses, lihatFotoBesar, proses, formatRupiah, LABEL_TAHAP, warnaTahap };
  },
  template: `
    <div class="gc-card">
      <div style="display:flex; align-items:center; gap:12px; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:14px;">
        <div style="width:44px; height:44px; border-radius:12px; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; color:var(--burgundy); flex-shrink:0;"><i class="fas fa-receipt"></i></div>
        <div>
          <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ data.nama_pegawai || 'Karyawan' }}</h4>
          <p style="font-size:10.5px; color:var(--text-muted);">{{ data.email || '-' }} &middot; {{ data.gudang || '-' }}</p>
          <span class="tag" :class="warnaTahap(data.tahap)" style="margin-top:5px;">{{ LABEL_TAHAP[data.tahap] || data.tahap }}</span>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:var(--ivory-dim); padding:14px; border-radius:14px; font-size:12px; margin-bottom:14px;">
        <div><span style="color:var(--text-faint); display:block; font-size:9.5px; text-transform:uppercase; margin-bottom:2px;">Kategori</span> <b>{{ data.kategori || '-' }}</b></div>
        <div><span style="color:var(--text-faint); display:block; font-size:9.5px; text-transform:uppercase; margin-bottom:2px;">Jumlah</span> <b style="color:var(--burgundy);">{{ formatRupiah(data.jumlah) }}</b></div>
        <div style="grid-column:1 / -1;"><span style="color:var(--text-faint); display:block; font-size:9.5px; text-transform:uppercase; margin-bottom:2px;">Keterangan</span> <b>{{ data.keterangan || '-' }}</b></div>
      </div>
      <img v-if="data.foto_bukti" :src="data.foto_bukti" @click="lihatFotoBesar" style="width:64px; height:64px; border-radius:12px; object-fit:cover; cursor:pointer; margin-bottom:14px; border:1px solid var(--line);">
      <div v-if="bolehProses" style="display:flex; gap:8px; padding-top:12px; border-top:1px solid var(--line);">
        <button @click="proses(true)" :disabled="memproses" class="btn-acc" style="flex:1;"><i class="fas fa-check-circle" style="margin-right:6px;"></i> Accept</button>
        <button @click="proses(false)" :disabled="memproses" class="btn-rej" style="flex:1;"><i class="fas fa-times-circle" style="margin-right:6px;"></i> Reject</button>
      </div>
      <p v-else style="text-align:center; font-size:11px; color:var(--text-faint); padding-top:10px; border-top:1px solid var(--line);">Menunggu validator tahap ini (bukan Anda).</p>
    </div>
  `
};

const AppAntreanReimburse = {
  components: { ReimburseCard },
  setup() {
    const daftarPending = ref([]);
    const memuat = ref(true);
    const errorMuat = ref('');

    function tahapUntukRoleSaya() {
      const role = (window.currentUser.role || '').toLowerCase();
      if (role === 'admin') return 'menunggu_admin_finance';
      if (role === 'pic') return 'menunggu_pic';
      if (['owner', 'superuser'].includes(role)) return 'menunggu_owner';
      return null; // Operator dkk tidak berwenang di antrean ini sama sekali
    }
    const labelTahapSaya = computed(() => LABEL_TAHAP[tahapUntukRoleSaya()] || '');

    async function muat() {
      memuat.value = true;
      errorMuat.value = '';
      try {
        const tahapSaya = tahapUntukRoleSaya();
        if (!tahapSaya) { daftarPending.value = []; memuat.value = false; return; }

        const snap = await getDocs(query(collection(db, "reimburse"), where("tahap", "==", tahapSaya)));
        const list = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          if (!window.bolehLihatData(d.jenis_pekerjaan, d.gudang)) return;
          list.push({ id: docSnap.id, data: d });
        });
        daftarPending.value = list;
      } catch (e) {
        console.error("Error muat antrean reimburse:", e);
        errorMuat.value = 'Gagal memuat data. Cek Console untuk detail (mungkin perlu index Firestore baru — lihat link di pesan error aslinya).';
      }
      memuat.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });
    return { daftarPending, memuat, errorMuat, muat, labelTahapSaya };
  },
  template: `
    <div class="gc-card" style="display:flex; justify-content:space-between; align-items:center; background:var(--pink); border:none; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
      <div>
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; color:var(--burgundy-dark);"><i class="fas fa-receipt" style="margin-right:8px;"></i> Antrean Reimburse</h3>
        <p v-if="labelTahapSaya" style="font-size:10.5px; color:var(--mahogany-soft); margin-top:2px;">Menampilkan yang menunggu Anda: {{ labelTahapSaya }}</p>
        <p v-else style="font-size:10.5px; color:var(--mahogany-soft); margin-top:2px;">Role Anda tidak berwenang memvalidasi reimburse.</p>
      </div>
      <button @click="muat" class="btn-outline filled"><i class="fas fa-sync-alt" style="margin-right:6px;"></i> Refresh</button>
    </div>

    <div v-if="memuat && daftarPending.length === 0" style="text-align:center; padding:40px 0; color:var(--text-faint);">
      <i class="fas fa-spinner fa-spin" style="font-size:26px; margin-bottom:10px; display:block;"></i><p style="font-size:12px;">Memuat antrean reimburse...</p>
    </div>
    <div v-else-if="errorMuat" style="text-align:center; padding:40px 0; color:var(--danger); font-size:12px; background:var(--danger-light); border-radius:18px;">{{ errorMuat }}</div>
    <div v-else-if="daftarPending.length === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px;">
      <i class="fas fa-glass-cheers" style="font-size:40px; color:var(--blue-deep); margin-bottom:12px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">Tidak ada antrean</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">Semua reimburse yang jadi tanggung jawab Anda sudah diproses.</p>
    </div>
    <div v-else style="gap:14px;" class="grid grid-cols-1 md:grid-cols-2">
      <reimburse-card v-for="item in daftarPending" :key="item.id" :doc-id="item.id" :data="item.data" @diproses="muat" />
    </div>
  `
};

let vmAntreanReimburse = null;
window.pastikanMountAntreanReimburse = function() {
  if (vmAntreanReimburse) return;
  const mountPoint = document.getElementById('vue-antrean-reimburse');
  if (mountPoint) vmAntreanReimburse = createApp(AppAntreanReimburse).mount('#vue-antrean-reimburse');
};
window.refreshAntreanReimburse = function() { if (vmAntreanReimburse) vmAntreanReimburse.muat(); };

// ============================================================================
// KOMPONEN 3 — Master Keuangan: cuma bungkus tipis MasterDataCategory yang
// SUDAH ADA (dipakai ulang, bukan bikin UI baru) — kelola daftar Kategori
// Pengeluaran (BBM, Tol, Parkir, dst) buat dropdown di form Ajukan Reimburse.
// ============================================================================
const AppMasterKeuangan = {
  components: { MasterDataCategory },
  template: `
    <div class="gc-card" style="margin-bottom:16px;">
      <h3 class="gc-heading" style="font-weight:700; font-size:13.5px;"><i class="fas fa-wallet" style="color:var(--burgundy); margin-right:8px;"></i> Master Keuangan</h3>
      <p style="font-size:10.5px; color:var(--text-muted); margin-top:3px;">Kelola kategori pengeluaran (dipakai form Ajukan Reimburse) dan kategori pemasukan.</p>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;" class="grid-cols-1 md:grid-cols-2">
      <master-data-category kategori="kategori_reimburse" label="Kategori Pengeluaran" menu-id="master_keuangan" />
      <master-data-category kategori="kategori_pemasukan" label="Kategori Pemasukan" menu-id="master_keuangan" />
    </div>
  `
};
let vmMasterKeuangan = null;
window.pastikanMountMasterKeuangan = function() {
  if (vmMasterKeuangan) return;
  const mountPoint = document.getElementById('vue-master-keuangan');
  if (mountPoint) vmMasterKeuangan = createApp(AppMasterKeuangan).mount('#vue-master-keuangan');
};
