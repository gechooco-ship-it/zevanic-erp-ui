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
// tahap 2). Keduanya di-scope ke jenis_pekerjaan+gudang (window.bolehLihatData,
// PERSIS pola yang sudah baku dipakai di Antrean Absensi/Lembur/Dakar.
//
// Keamanan SEBENARNYA (anti-loncat-tahap) ada di firestore.rules —
// bagian sini cuma UI, kalau ada yang nekat panggil updateDoc() langsung
// dari Console browser, Firestore Rules yang jadi penjaga terakhir.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
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
    const form = reactive({ kategori: '', jumlah: '', keterangan: '', fotoBukti: '', kendaraanId: '' });
    const daftarKendaraan = ref([]);

    async function muatDaftarKendaraan() {
      try {
        const snap = await getDocs(collection(db, "master_kendaraan"));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.plat_nomor || '').localeCompare(b.plat_nomor || ''));
        daftarKendaraan.value = list;
      } catch (e) {
        console.error("Gagal muat daftar kendaraan:", e);
      }
    }
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
        const kendaraanDipilih = daftarKendaraan.value.find(k => k.id === form.kendaraanId);
        await addDoc(collection(db, "reimburse"), {
          email: window.currentUser.email,
          nama_pegawai: window.currentUser.name,
          jenis_pekerjaan: window.currentUser.jenis_pekerjaan || '',
          gudang: (window.currentUser.gudang_penempatan || [])[0] || '',
          kategori: form.kategori,
          jumlah: jumlahAngka,
          keterangan: form.keterangan || '',
          foto_bukti: form.fotoBukti,
          // Kendaraan OPSIONAL — dititip plat+nama langsung (denormalisasi,
          // pola sama seperti jenis_pekerjaan/hp/status_kerja di absensi)
          // supaya Antrean Reimburse & laporan nanti TIDAK perlu baca
          // master_kendaraan lagi cuma buat tampilkan plat nomornya.
          kendaraan_id: form.kendaraanId || '',
          kendaraan_plat: kendaraanDipilih ? kendaraanDipilih.plat_nomor : '',
          tahap: 'menunggu_admin_finance',
          diajukan_pada: serverTimestamp()
        });
        alert("Pengajuan reimburse berhasil dikirim, menunggu ACC Admin Finance.");
        form.jumlah = ''; form.keterangan = ''; form.fotoBukti = ''; form.kendaraanId = '';
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

    onMounted(async () => { await window.authReady; await muatOpsiKategori(); await muatDaftarKendaraan(); await muatRiwayatSaya(); });
    return {
      opsiKategori, form, mengirim, pilihFoto, ajukan, lihatFotoBesar, daftarKendaraan,
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
          <label>Kendaraan (opsional — isi kalau terkait bensin/servis mobil)</label>
          <select v-model="form.kendaraanId">
            <option value="">Tidak terkait kendaraan</option>
            <option v-for="k in daftarKendaraan" :key="k.id" :value="k.id">{{ k.plat_nomor }}{{ k.nama_kendaraan ? ' - ' + k.nama_kendaraan : '' }}</option>
          </select>
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
        <div v-if="data.kendaraan_plat"><span style="color:var(--text-faint); display:block; font-size:9.5px; text-transform:uppercase; margin-bottom:2px;">Kendaraan</span> <b><i class="fas fa-truck" style="margin-right:4px; color:var(--text-faint);"></i>{{ data.kendaraan_plat }}</b></div>
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
    const totalMentahSebelumFilter = ref(0); // diagnostik, lihat catatan di muat()
    const memuat = ref(true);
    const errorMuat = ref('');
    const isOwnerRole = computed(() => ['owner', 'superuser'].includes((window.currentUser.role || '').toLowerCase()));

    // BARU (19 Agt 2026, permintaan Hilman) — Owner TIDAK dibatasi 1 tahap
    // lagi (dulu cuma lihat menunggu_owner) — Owner sekarang bisa lihat
    // SEMUA tahap sekaligus, buat lacak "reimburse ini nyangkut di tahap
    // mana" pas lagi debug. Admin Finance/PIC TETAP dibatasi 1 tahap
    // (sesuai wewenang mereka di firestore.rules, tidak berubah).
    function tahapUntukRoleSaya() {
      const role = (window.currentUser.role || '').toLowerCase();
      if (role === 'admin') return 'menunggu_admin_finance';
      if (role === 'pic') return 'menunggu_pic';
      if (isOwnerRole.value) return null; // null = TIDAK dibatasi where(), lihat muat()
      return 'TIDAK_BERWENANG'; // Operator dkk — beda dari Owner punya null, biar tidak ketuker
    }
    const labelTahapSaya = computed(() => {
      if (isOwnerRole.value) return 'Semua tahap (Owner bisa lihat semua)';
      return LABEL_TAHAP[tahapUntukRoleSaya()] || '';
    });

    // Search box + filter tahap — filter tahap CUMA relevan/tampil buat
    // Owner (Admin Finance/PIC sudah otomatis di-scope 1 tahap lewat
    // query, dropdown lagi cuma bikin bingung). Default "Pengajuan PIC"
    // (menunggu_owner) — itu tahap yang jadi tanggung jawab Owner
    // sendiri, paling relevan dibuka duluan tanpa perlu ganti-ganti.
    const cariNama = ref('');
    const filterTahapOwner = ref('menunggu_owner');
    const OPSI_FILTER_TAHAP = [
      { value: 'SEMUA', label: 'Semua tahap' },
      { value: 'menunggu_admin_finance', label: 'Pengajuan Operator (baru diajukan)' },
      { value: 'menunggu_pic', label: 'Pengajuan Admin (sudah ACC Admin Finance)' },
      { value: 'menunggu_owner', label: 'Pengajuan PIC (sudah ACC PIC)' }
    ];

    // Filter Kendaraan — buat monitoring biaya per kendaraan (permintaan
    // Hilman 19 Agt 2026). Client-side, dari data yang SUDAH ketarik
    // (tidak nambah baca Firestore) — antrean ini kecil (cuma yang
    // pending), jadi aman disaring di browser.
    const filterKendaraan = ref('ALL');
    const opsiKendaraan = computed(() => {
      const set = new Set();
      daftarPending.value.forEach(item => { if (item.data.kendaraan_plat) set.add(item.data.kendaraan_plat); });
      return [...set].sort();
    });
    const daftarPendingTersaring = computed(() => {
      let hasil = daftarPending.value;
      const kata = cariNama.value.trim().toLowerCase();
      if (kata) hasil = hasil.filter(item => (item.data.nama_pegawai || '').toLowerCase().includes(kata));
      if (isOwnerRole.value && filterTahapOwner.value !== 'SEMUA') {
        hasil = hasil.filter(item => item.data.tahap === filterTahapOwner.value);
      }
      if (filterKendaraan.value !== 'ALL') hasil = hasil.filter(item => item.data.kendaraan_plat === filterKendaraan.value);
      return hasil;
    });

    async function muat() {
      memuat.value = true;
      errorMuat.value = '';
      try {
        const tahapSaya = tahapUntukRoleSaya();
        if (tahapSaya === 'TIDAK_BERWENANG') { daftarPending.value = []; memuat.value = false; return; }

        // Owner (tahapSaya === null): fetch SELURUH collection reimburse,
        // TANPA where() tahap — sengaja, buat diagnostik "lihat semua".
        // Admin Finance/PIC: tetap query 1 tahap seperti biasa (hemat,
        // sesuai wewenang mereka).
        const snap = tahapSaya === null
          ? await getDocs(collection(db, "reimburse"))
          : await getDocs(query(collection(db, "reimburse"), where("tahap", "==", tahapSaya)));
        totalMentahSebelumFilter.value = snap.size; // diagnostik: sebelum kena filter jenis_pekerjaan+gudang
        const list = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          // jenis_pekerjaan di app ini = BIDANG USAHA (Konveksi/Retail/
          // Logistik) — WAJIB dicocokkan, supaya Admin Finance bisnis
          // Konveksi TIDAK bisa lihat reimburse bisnis Logistik.
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
    return {
      daftarPending, daftarPendingTersaring, totalMentahSebelumFilter, memuat, errorMuat, muat, labelTahapSaya,
      isOwnerRole, cariNama, filterTahapOwner, OPSI_FILTER_TAHAP, filterKendaraan, opsiKendaraan
    };
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

    <div v-if="!memuat && daftarPending.length > 0" style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:16px;">
      <div style="position:relative; flex:1; min-width:200px;">
        <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
        <input v-model="cariNama" type="text" placeholder="Cari nama karyawan..." style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
      </div>
      <select v-if="isOwnerRole" v-model="filterTahapOwner" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
        <option v-for="opsi in OPSI_FILTER_TAHAP" :key="opsi.value" :value="opsi.value">{{ opsi.label }}</option>
      </select>
    </div>

    <div v-if="!memuat && opsiKendaraan.length > 0" style="margin-bottom:16px;">
      <select v-model="filterKendaraan" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
        <option value="ALL">Semua kendaraan</option>
        <option v-for="plat in opsiKendaraan" :key="plat" :value="plat"><i class="fas fa-truck"></i> {{ plat }}</option>
      </select>
    </div>

    <div v-if="memuat && daftarPending.length === 0" style="text-align:center; padding:40px 0; color:var(--text-faint);">
      <i class="fas fa-spinner fa-spin" style="font-size:26px; margin-bottom:10px; display:block;"></i><p style="font-size:12px;">Memuat antrean reimburse...</p>
    </div>
    <div v-else-if="errorMuat" style="text-align:center; padding:40px 0; color:var(--danger); font-size:12px; background:var(--danger-light); border-radius:18px;">{{ errorMuat }}</div>
    <div v-else-if="daftarPending.length === 0 && totalMentahSebelumFilter === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px;">
      <i class="fas fa-glass-cheers" style="font-size:40px; color:var(--blue-deep); margin-bottom:12px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ isOwnerRole ? 'Belum ada reimburse sama sekali di sistem' : 'Tidak ada antrean' }}</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">{{ isOwnerRole ? 'Belum ada satupun pengajuan reimburse dibuat.' : 'Semua reimburse yang jadi tanggung jawab Anda sudah diproses.' }}</p>
    </div>
    <div v-else-if="daftarPending.length === 0 && totalMentahSebelumFilter > 0" style="text-align:center; padding:56px 0; background:var(--warn-light); border:1.5px solid var(--warn); border-radius:18px;">
      <i class="fas fa-triangle-exclamation" style="font-size:34px; color:var(--warn); margin-bottom:12px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">Ada {{ totalMentahSebelumFilter }} reimburse {{ isOwnerRole ? 'di sistem' : 'menunggu tahap Anda' }}, tapi tidak ada yang cocok profil Anda</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px; max-width:360px; margin-left:auto; margin-right:auto;">Kemungkinan besar Jenis Pekerjaan atau Gudang di profil Anda beda (walau kelihatan sama, sering ada spasi/huruf beda tipis) dari yang mengajukan. Cek ulang di Daftar Karyawan / Hak Akses.</p>
    </div>
    <div v-else-if="daftarPendingTersaring.length === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px;">
      <i class="fas fa-filter-circle-xmark" style="font-size:34px; color:var(--text-faint); margin-bottom:12px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">Tidak ada yang cocok</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">Coba ubah kata kunci pencarian, filter tahap, atau filter kendaraan yang aktif.</p>
    </div>
    <div v-else style="gap:14px;" class="grid grid-cols-1 md:grid-cols-2">
      <reimburse-card v-for="item in daftarPendingTersaring" :key="item.id" :doc-id="item.id" :data="item.data" @diproses="muat" />
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

// ============================================================================
// KOMPONEN 4 — Master Kendaraan: daftar kendaraan + supir pemegang SAAT
// INI (bisa di-assign ulang kapan saja — rotasi antar supir, permintaan
// eksplisit Hilman 19 Agt 2026). Dipakai form Ajukan Reimburse supaya
// Admin Finance/PIC/Owner bisa monitor biaya bensin+servis PER KENDARAAN,
// bukan cuma per orang (supir bisa gonta-ganti kendaraan dari waktu ke
// waktu, kendaraan yang jadi acuan biaya, bukan orangnya).
//
// SENGAJA 1 dokumen per kendaraan (bukan 1 dokumen array semua kendaraan,
// pola master_data biasa) — supaya assign ulang supir 1 kendaraan TIDAK
// perlu baca+tulis ulang SELURUH daftar kendaraan (hindari resiko
// tabrakan kalau 2 Admin assign kendaraan BEDA di waktu bersamaan),
// PERSIS alasan yang sama kenapa master_gudang/master_shift juga begitu.
// ============================================================================
const MasterKendaraanManager = {
  setup() {
    const daftarKendaraan = ref([]);
    const memuat = ref(true);
    const platBaru = ref('');
    const namaBaru = ref('');
    const menyimpan = ref(false);
    const daftarOperator = ref([]);

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDocs(collection(db, "master_kendaraan"));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.plat_nomor || '').localeCompare(b.plat_nomor || ''));
        daftarKendaraan.value = list;
      } catch (e) {
        console.error("Gagal muat master kendaraan:", e);
      }
      memuat.value = false;
    }

    async function muatOperator() {
      try {
        // Dropdown assign supir dari SEMUA operator (bukan cuma Driver/
        // Kurir) — konsisten dengan dropdown Kendaraan di form Reimburse
        // yang juga terbuka buat semua operator.
        const snap = await getDocs(query(collection(db, "users"), where("role", "==", "operator")));
        const list = [];
        snap.forEach(d => list.push({ email: d.id, nama: d.data().name || d.data().nama || d.id }));
        list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
        daftarOperator.value = list;
      } catch (e) {
        console.error("Gagal muat daftar operator:", e);
      }
    }

    async function tambah() {
      if (!platBaru.value.trim()) return alert("Isi plat nomor dulu.");
      menyimpan.value = true;
      try {
        await addDoc(collection(db, "master_kendaraan"), {
          plat_nomor: platBaru.value.trim().toUpperCase(),
          nama_kendaraan: namaBaru.value.trim(),
          supir_pemegang_email: '',
          supir_pemegang_nama: ''
        });
        platBaru.value = ''; namaBaru.value = '';
        await muat();
      } catch (e) {
        console.error("Gagal tambah kendaraan:", e);
        alert("Gagal menambah kendaraan.");
      }
      menyimpan.value = false;
    }

    // Assign/rotasi supir — dipanggil tiap dropdown supir di 1 baris
    // kendaraan berubah. TIDAK menyentuh kendaraan LAIN sama sekali
    // (1 dokumen per kendaraan, lihat catatan di atas).
    async function assignSupir(kendaraanId, emailSupir) {
      const operator = daftarOperator.value.find(o => o.email === emailSupir);
      try {
        await updateDoc(doc(db, "master_kendaraan", kendaraanId), {
          supir_pemegang_email: emailSupir || '',
          supir_pemegang_nama: operator ? operator.nama : ''
        });
        await muat();
      } catch (e) {
        console.error("Gagal assign supir:", e);
        alert("Gagal mengubah supir pemegang.");
      }
    }

    async function hapus(id) {
      if (!confirm("Hapus data kendaraan ini secara permanen?")) return;
      try {
        await deleteDoc(doc(db, "master_kendaraan", id));
        await muat();
      } catch (e) {
        console.error("Gagal hapus kendaraan:", e);
        alert("Gagal menghapus kendaraan.");
      }
    }

    onMounted(async () => { await window.authReady; await muat(); await muatOperator(); });
    return { daftarKendaraan, memuat, platBaru, namaBaru, menyimpan, daftarOperator, tambah, assignSupir, hapus };
  },
  template: `
    <div class="gc-card">
      <h3 class="gc-heading" style="font-weight:700; font-size:13.5px; margin-bottom:14px;"><i class="fas fa-truck" style="color:var(--burgundy); margin-right:8px;"></i> Master Kendaraan</h3>
      <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
        <input v-model="platBaru" type="text" placeholder="Plat nomor (contoh: D 1234 AB)" style="flex:1; min-width:160px; padding:8px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
        <input v-model="namaBaru" type="text" placeholder="Nama/jenis kendaraan (opsional)" style="flex:1; min-width:160px; padding:8px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
        <button @click="tambah" :disabled="menyimpan" class="btn-primary" style="padding:8px 16px;"><i class="fas fa-plus" style="margin-right:6px;"></i>Tambah</button>
      </div>

      <div v-if="memuat" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="daftarKendaraan.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px; background:var(--ivory-dim); border-radius:14px;">Belum ada kendaraan terdaftar.</div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="k in daftarKendaraan" :key="k.id" style="display:flex; align-items:center; gap:12px; padding:12px 14px; background:var(--ivory-dim); border-radius:12px; flex-wrap:wrap;">
          <div style="flex:1; min-width:140px;">
            <b style="font-size:12.5px;">{{ k.plat_nomor }}</b>
            <p style="font-size:10.5px; color:var(--text-muted);">{{ k.nama_kendaraan || '-' }}</p>
          </div>
          <select :value="k.supir_pemegang_email" @change="assignSupir(k.id, $event.target.value)" style="padding:7px 10px; font-size:11.5px; border:1.5px solid var(--line); border-radius:8px; min-width:160px;">
            <option value="">(Belum ada supir)</option>
            <option v-for="o in daftarOperator" :key="o.email" :value="o.email">{{ o.nama }}</option>
          </select>
          <button @click="hapus(k.id)" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>
    </div>
  `
};

const AppMasterKendaraan = { components: { MasterKendaraanManager }, template: `<master-kendaraan-manager />` };
let vmMasterKendaraan = null;
window.pastikanMountMasterKendaraan = function() {
  if (vmMasterKendaraan) return;
  const mountPoint = document.getElementById('vue-master-kendaraan');
  if (mountPoint) vmMasterKendaraan = createApp(AppMasterKendaraan).mount('#vue-master-kendaraan');
};
