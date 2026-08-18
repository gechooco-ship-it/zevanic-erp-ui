// js/vue-antrean-dakar.js
// ============================================================================
// DIROMBAK LAGI (18 Agt 2026, revisi ke-2) — versi SEBELUMNYA di file ini
// bikin akun Auth LANGSUNG (password sementara = NIK) lewat instance
// Firebase kedua saat Admin klik "Setujui". SEKARANG diganti total:
// "Setujui" cuma generate TOKEN RAHASIA + kirim EMAIL berisi LINK
// "Buat Password" — akun Auth baru benar-benar dibuat NANTI oleh
// KARYAWAN SENDIRI (lewat js/vue-buat-password.js), begitu mereka klik
// link itu dan pilih password sendiri. BELUM PERNAH DITES sama sekali,
// WAJIB dites end-to-end sebelum dipakai karyawan sungguhan.
//
// KENAPA DIROMBAK: supaya karyawan pilih password SENDIRI (bukan
// dipaksa pakai NIK sebagai password sementara lalu wajib ganti) — lihat
// diskusi lengkap alasannya di STATUS-PROYEK.md.
//
// INSTANCE FIREBASE KEDUA (buatAkunTanpaGangguSesi) SUDAH DIHAPUS DARI
// FILE INI — sudah tidak relevan lagi, karena yang bikin akun sekarang
// KARYAWAN SENDIRI (belum login sebagai siapapun), bukan Admin. Tidak
// ada sesi Admin yang perlu dilindungi di titik approve ini lagi.
//
// ALUR BARU per dokumen pendaftaran_pending, 3 kemungkinan status:
//   1. BARU — belum ada token sama sekali. Tombol: Setujui (isi data
//      kerja, generate token, kirim link) / Tolak.
//   2. MENUNGGU BUAT PASSWORD — token ada & belum kadaluarsa (30 menit).
//      Tombol: Assign Ulang (generate token baru, kirim ulang link) /
//      Tolak. AMAN ditolak di status ini karena akun Auth memang belum
//      pernah dibuat.
//   3. KADALUARSA — token ada tapi sudah lewat 30 menit. Tombol sama
//      seperti status 2, cuma ditandai visual beda (badge merah).
// Begitu karyawan berhasil klik link & buat password, dokumen ini
// DIHAPUS SENDIRI oleh karyawan (bukan Admin) — jadi otomatis hilang
// dari daftar ini, tidak perlu status ke-4 "selesai".
//
// Verifikasi token pakai pola SAMA PERSIS seperti otp_email (lihat
// vue-otp.js) — lewat TULIS, bukan baca langsung. Lihat firestore.rules
// match /pendaftaran_pending/{email} untuk detail lengkapnya.
//
// Dipakai ulang: GudangCheckboxSelect (vue-components.js).
// ============================================================================
import { createApp, ref, reactive, computed, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { GudangCheckboxSelect } from './vue-components.js';

const MASA_BERLAKU_MENIT = 30; // disepakati 18 Agt 2026 — lihat STATUS-PROYEK.md

// Token acak yang cukup panjang (bukan dari Math.random() yang gampang
// ditebak polanya) — dipakai sebagai "kunci" di link email Buat Password.
function buatTokenAcak() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function kirimEmailLinkPassword(email, nama, token) {
  const link = `https://gechoo.online/?buatpassword=1&email=${encodeURIComponent(email)}&token=${token}`;
  let tpl = {};
  try {
    const snapTpl = await getDoc(doc(db, "config", "mail_templates"));
    tpl = snapTpl.exists() ? snapTpl.data() : {};
  } catch (e) { /* pakai fallback baku di bawah */ }
  const subjek = tpl.subjek_buat_password || "Buat Password Akun Zevanic ERP Anda";
  const isiTemplat = tpl.isi_buat_password || "Halo {nama},\n\nPendaftaran Anda sudah disetujui! Klik link di bawah untuk membuat password akun Anda sendiri (berlaku " + MASA_BERLAKU_MENIT + " menit):\n\n{link}\n\nKalau link ini kadaluarsa, hubungi Admin/Owner untuk dikirimkan ulang.";
  const isiEmail = isiTemplat
    .replace(/\{nama\}/g, nama || '')
    .replace(/\{link\}/g, link)
    .replace(/\{menit\}/g, String(MASA_BERLAKU_MENIT));
  await addDoc(collection(db, "mail"), {
    to: [email],
    message: { subject: subjek, text: isiEmail },
    dikirim_pada: serverTimestamp()
  });
}

const AntreanDakarCard = {
  components: { GudangCheckboxSelect },
  props: {
    emailId: { type: String, required: true },
    data: { type: Object, required: true }
  },
  emits: ['diproses'],
  setup(props, { emit }) {
    const form = reactive({
      statusKerja: 'Aktif',
      shift: '',
      jabatan: '',
      statusKaryawan: '',
      gudang: []
    });
    const opsiStatusKerja = ref([]);
    const daftarShift = ref([]);
    const opsiJabatan = ref([]);
    const opsiStatusKaryawan = ref([]);
    const memproses = ref(false);

    // Status pendaftaran ini — dihitung dari field token di data, BUKAN
    // disimpan sebagai state Vue terpisah, supaya selalu sinkron sama
    // Firestore begitu daftar di-refresh.
    const sudahDiSetujui = computed(() => !!props.data.token_buat_password);
    const sudahKadaluarsa = computed(() => {
      if (!props.data.token_kadaluarsa) return false;
      const kadaluarsaMs = props.data.token_kadaluarsa.toMillis ? props.data.token_kadaluarsa.toMillis() : props.data.token_kadaluarsa.seconds * 1000;
      return kadaluarsaMs <= detikSekarang.value;
    });

    // Countdown real-time — cuma buat TAMPILAN (bukan sumber kebenaran;
    // yang menentukan valid/tidaknya token tetap request.time di
    // Firestore Rules saat karyawan klik link-nya).
    const detikSekarang = ref(Date.now());
    let timerCountdown = null;
    onMounted(() => { timerCountdown = setInterval(() => { detikSekarang.value = Date.now(); }, 1000); });
    onUnmounted(() => { if (timerCountdown) clearInterval(timerCountdown); });

    const sisaWaktuTeks = computed(() => {
      if (!props.data.token_kadaluarsa) return '';
      const kadaluarsaMs = props.data.token_kadaluarsa.toMillis ? props.data.token_kadaluarsa.toMillis() : props.data.token_kadaluarsa.seconds * 1000;
      const sisaDetik = Math.max(0, Math.floor((kadaluarsaMs - detikSekarang.value) / 1000));
      const m = Math.floor(sisaDetik / 60);
      const s = sisaDetik % 60;
      return m + ':' + String(s).padStart(2, '0');
    });

    async function muatOpsi() {
      opsiStatusKerja.value = await window.ambilMasterList('status_kerja');
      const qShift = await getDocs(collection(db, "master_shift"));
      const listShift = [];
      qShift.forEach(docSnap => {
        const s = docSnap.data();
        if (window.bolehLihatJenisPekerjaan(s.jenis_pekerjaan)) listShift.push(s);
      });
      daftarShift.value = listShift;
      opsiJabatan.value = await window.ambilMasterList('jabatan');
      opsiStatusKaryawan.value = await window.ambilMasterList('status_karyawan');

      form.statusKerja = opsiStatusKerja.value.includes('Aktif') ? 'Aktif' : (opsiStatusKerja.value[0] || '');
      form.shift = daftarShift.value[0]?.nama_shift || '';
      form.jabatan = opsiJabatan.value[0] || '';
      form.statusKaryawan = opsiStatusKaryawan.value[0] || '';
    }

    function lihatFotoBesar() {
      if (props.data.foto_ktp && window.bukaPreviewFoto) window.bukaPreviewFoto(props.data.foto_ktp);
    }

    // "Setujui" — SEKARANG cuma simpan data kerja + generate token + kirim
    // link. TIDAK bikin akun Auth apapun di titik ini.
    async function setujui() {
      if (window.cekIzinMenu('antrean_dakar', 'add') === false) {
        return alert('Anda tidak punya izin menyetujui karyawan baru. Hubungi Owner/PIC.');
      }
      if (form.gudang.length === 0) {
        if (!confirm("Belum ada gudang dipilih. Karyawan ini TIDAK akan bisa login sampai gudang ditautkan (bisa diatur lagi lewat Daftar Karyawan > Edit). Lanjutkan?")) return;
      }

      memproses.value = true;
      try {
        const token = buatTokenAcak();
        const kadaluarsa = new Date(Date.now() + MASA_BERLAKU_MENIT * 60 * 1000);
        await updateDoc(doc(db, "pendaftaran_pending", props.emailId), {
          status_kerja: form.statusKerja,
          nama_shift: form.shift,
          jabatan: form.jabatan,
          status_karyawan: form.statusKaryawan,
          gudang_penempatan: form.gudang,
          token_buat_password: token,
          token_kadaluarsa: Timestamp.fromDate(kadaluarsa),
          token_terverifikasi: false,
          disetujui_pada: serverTimestamp(),
          disetujui_oleh: window.currentUser.name || window.currentUser.email
        });
        await kirimEmailLinkPassword(props.emailId, props.data.nama, token);
        alert("Link \"Buat Password\" sudah dikirim ke " + props.emailId + ". Berlaku " + MASA_BERLAKU_MENIT + " menit.");
        emit('diproses');
      } catch (e) {
        console.error("Gagal menyetujui karyawan:", e);
        alert("Gagal menyimpan persetujuan: " + e.message + ". Aman dicoba lagi, belum ada apapun yang berhasil disimpan.");
      }
      memproses.value = false;
    }

    // "Assign Ulang" — dipakai kalau link lama kadaluarsa atau karyawan
    // minta dikirim ulang. Data kerja yang SUDAH disimpan (status_kerja,
    // shift, dst) TIDAK diminta ulang — cuma token & waktu kadaluarsanya
    // yang di-generate baru.
    async function assignUlang() {
      if (window.cekIzinMenu('antrean_dakar', 'add') === false) {
        return alert('Anda tidak punya izin mengirim ulang link. Hubungi Owner/PIC.');
      }
      memproses.value = true;
      try {
        const token = buatTokenAcak();
        const kadaluarsa = new Date(Date.now() + MASA_BERLAKU_MENIT * 60 * 1000);
        await updateDoc(doc(db, "pendaftaran_pending", props.emailId), {
          token_buat_password: token,
          token_kadaluarsa: Timestamp.fromDate(kadaluarsa),
          token_terverifikasi: false
        });
        await kirimEmailLinkPassword(props.emailId, props.data.nama, token);
        alert("Link baru sudah dikirim ke " + props.emailId + ". Berlaku " + MASA_BERLAKU_MENIT + " menit lagi.");
        emit('diproses');
      } catch (e) {
        console.error("Gagal assign ulang:", e);
        alert("Gagal mengirim ulang link: " + e.message);
      }
      memproses.value = false;
    }

    // "Tolak" — AMAN dipakai di status manapun (BARU maupun MENUNGGU
    // BUAT PASSWORD/KADALUARSA), karena akun Auth memang belum pernah
    // dibuat sampai karyawan sendiri klik link & submit password.
    async function tolak() {
      if (window.cekIzinMenu('antrean_dakar', 'delete') === false) {
        return alert('Anda tidak punya izin menolak pendaftaran. Hubungi Owner/PIC.');
      }
      if (!confirm("Tolak pendaftaran karyawan ini? Data pendaftaran akan DIHAPUS PERMANEN (belum ada akun login yang perlu dibersihkan, karena memang belum pernah dibuat di alur ini).")) return;
      memproses.value = true;
      try {
        await deleteDoc(doc(db, "pendaftaran_pending", props.emailId));
        alert("Pendaftaran ditolak & dihapus.");
        emit('diproses');
      } catch (e) {
        console.error("Gagal menolak:", e);
        alert("Gagal memproses penolakan.");
      }
      memproses.value = false;
    }

    onMounted(async () => { await window.authReady; muatOpsi(); });
    return {
      form, opsiStatusKerja, daftarShift, opsiJabatan, opsiStatusKaryawan, memproses,
      sudahDiSetujui, sudahKadaluarsa, sisaWaktuTeks,
      lihatFotoBesar, setujui, assignUlang, tolak
    };
  },
  template: `
    <div class="gc-card">
      <div style="display:flex; align-items:center; gap:12px; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:14px;">
        <img v-if="data.foto_ktp" :src="data.foto_ktp" @click="lihatFotoBesar" style="width:64px; height:48px; border-radius:10px; object-fit:cover; border:1px solid var(--line); cursor:pointer;">
        <div v-else style="width:64px; height:48px; background:var(--ivory-dim); border-radius:10px; display:flex; align-items:center; justify-content:center; color:var(--text-faint);"><i class="fas fa-id-card"></i></div>
        <div style="flex:1;">
          <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ data.nama || 'Tanpa Nama' }}</h4>
          <p style="font-size:10.5px; color:var(--text-muted); font-family:'Poppins',sans-serif;">{{ data.email || emailId }} &bull; {{ data.hp || '-' }}</p>
          <p style="font-size:10.5px; color:var(--text-muted); font-family:'Poppins',sans-serif;">NIK: {{ data.nik || '-' }}</p>
        </div>
        <span v-if="sudahDiSetujui && sudahKadaluarsa" class="tag danger">Link kadaluarsa</span>
        <span v-else-if="sudahDiSetujui" class="tag warn">Menunggu Buat Password</span>
      </div>

      <template v-if="!sudahDiSetujui">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
          <div class="gc-field" style="margin-bottom:0;">
            <label style="font-size:10.5px;">Status kerja</label>
            <select v-model="form.statusKerja" style="padding:7px 10px; font-size:12px;">
              <option v-for="o in opsiStatusKerja" :key="o" :value="o">{{ o }}</option>
            </select>
          </div>
          <div class="gc-field" style="margin-bottom:0;">
            <label style="font-size:10.5px;">Jadwal shift</label>
            <select v-model="form.shift" style="padding:7px 10px; font-size:12px;">
              <option v-for="s in daftarShift" :key="s.nama_shift" :value="s.nama_shift">{{ s.nama_shift }} ({{ s.jam_masuk }} - {{ s.jam_keluar }})</option>
            </select>
          </div>
          <div class="gc-field" style="margin-bottom:0;">
            <label style="font-size:10.5px;">Jabatan</label>
            <select v-model="form.jabatan" style="padding:7px 10px; font-size:12px;">
              <option v-for="o in opsiJabatan" :key="o" :value="o">{{ o }}</option>
            </select>
          </div>
          <div class="gc-field" style="margin-bottom:0;">
            <label style="font-size:10.5px;">Status karyawan</label>
            <select v-model="form.statusKaryawan" style="padding:7px 10px; font-size:12px;">
              <option v-for="o in opsiStatusKaryawan" :key="o" :value="o">{{ o }}</option>
            </select>
          </div>
        </div>
        <div class="gc-field">
          <label style="font-size:10.5px;">Gudang penempatan (bisa lebih dari satu)</label>
          <gudang-checkbox-select v-model="form.gudang" />
        </div>
        <div style="display:flex; gap:8px; padding-top:12px; border-top:1px solid var(--line);">
          <button @click="setujui" :disabled="memproses" class="btn-acc" style="flex:1;">
            <i class="fas fa-paper-plane" style="margin-right:6px;"></i> {{ memproses ? 'Memproses...' : 'Setujui & Kirim Link' }}
          </button>
          <button @click="tolak" :disabled="memproses" class="btn-rej">
            <i class="fas fa-times"></i> Tolak
          </button>
        </div>
      </template>

      <template v-else>
        <div style="background:var(--ivory-dim); border-radius:12px; padding:12px 14px; margin-bottom:12px; font-size:11.5px; color:var(--text-muted); display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <div><b>Status kerja:</b> {{ data.status_kerja || '-' }}</div>
          <div><b>Shift:</b> {{ data.nama_shift || '-' }}</div>
          <div><b>Jabatan:</b> {{ data.jabatan || '-' }}</div>
          <div><b>Status karyawan:</b> {{ data.status_karyawan || '-' }}</div>
        </div>
        <p style="font-size:12px; text-align:center; margin-bottom:12px;">
          <i class="fas fa-hourglass-half" style="margin-right:6px; color:var(--warn);"></i>
          <span v-if="!sudahKadaluarsa">Link berlaku lagi <b>{{ sisaWaktuTeks }}</b></span>
          <span v-else style="color:var(--danger);">Link sudah kadaluarsa</span>
        </p>
        <div style="display:flex; gap:8px; padding-top:12px; border-top:1px solid var(--line);">
          <button @click="assignUlang" :disabled="memproses" class="btn-acc" style="flex:1;">
            <i class="fas fa-rotate" style="margin-right:6px;"></i> {{ memproses ? 'Memproses...' : 'Assign Ulang' }}
          </button>
          <button @click="tolak" :disabled="memproses" class="btn-rej">
            <i class="fas fa-times"></i> Tolak
          </button>
        </div>
      </template>
    </div>
  `
};

const AppAntreanDakar = {
  components: { AntreanDakarCard },
  setup() {
    // Dipakai buat catatan transparansi filter jenis pekerjaan di template
    // (LEWAT computed, BUKAN window.xxx langsung di template — lihat
    // STATUS-PROYEK.md §10.1).
    const isOwnerRole = computed(() => ['owner', 'superuser'].includes((window.currentUser.role || '').toLowerCase()));

    const daftarPending = ref([]);
    const memuat = ref(true);
    const errorMuat = ref('');

    async function muat() {
      memuat.value = true;
      errorMuat.value = '';
      try {
        const snap = await getDocs(collection(db, "pendaftaran_pending"));
        const list = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          if (window.bolehLihatData(d.jenis_pekerjaan, d.gudang_penempatan)) list.push({ id: docSnap.id, data: d });
        });
        daftarPending.value = list;
      } catch (e) {
        console.error("Gagal memuat antrean pendaftaran:", e);
        errorMuat.value = 'Gagal memuat data (' + (e.code || e.message) + '). Kemungkinan izin akses (role Anda) belum ter-refresh — coba Logout lalu Login lagi.';
      }
      memuat.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });
    return { isOwnerRole, daftarPending, memuat, errorMuat, muat };
  },
  template: `
    <div class="gc-card" style="display:flex; justify-content:space-between; align-items:center; background:var(--pink); border:none;">
      <div>
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; color:var(--burgundy-dark);"><i class="fas fa-user-clock" style="margin-right:8px;"></i> Antrean persetujuan karyawan baru</h3>
        <p style="font-size:10.5px; color:var(--mahogany-soft); margin-top:2px;">Pendaftar baru TIDAK punya akun login sama sekali sampai mereka sendiri membuat password lewat link email.</p>
        <p v-if="!isOwnerRole" style="font-size:10.5px; color:var(--mahogany-soft); margin-top:2px;"><i class="fas fa-filter" style="margin-right:5px;"></i>Cuma nampilin jenis pekerjaan yang sama dengan profil Anda.</p>
      </div>
      <button @click="muat" class="btn-outline filled"><i class="fas fa-sync-alt" style="margin-right:6px;"></i> Refresh</button>
    </div>

    <div v-if="memuat" style="text-align:center; padding:40px 0; color:var(--text-faint); font-size:12px; margin-top:16px;">
      <i class="fas fa-spinner fa-spin" style="font-size:26px; margin-bottom:10px; display:block;"></i>Memuat antrean karyawan baru...
    </div>
    <div v-else-if="errorMuat" style="text-align:center; padding:40px 0; color:var(--danger); font-size:12px; margin-top:16px; background:var(--danger-light); border-radius:18px;">{{ errorMuat }}</div>
    <div v-else-if="daftarPending.length === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px; margin-top:16px;">
      <i class="fas fa-user-check" style="font-size:34px; color:var(--ok); margin-bottom:10px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">Tidak ada antrean</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">Semua pendaftar sudah diproses.</p>
    </div>
    <div v-else style="gap:14px; margin-top:16px;" class="grid grid-cols-1 md:grid-cols-2">
      <antrean-dakar-card v-for="item in daftarPending" :key="item.id" :email-id="item.id" :data="item.data" @diproses="muat" />
    </div>
  `
};

let vmAntreanDakar = null;
// Perbaikan bug BESAR (dipertahankan dari versi lama): komponen ini BARU
// di-mount() saat dashboard.js pindahSubTab benar-benar memanggil
// window.pastikanMountAntreanDakar() — PERSIS saat tab ini pertama kali
// dibuka, bukan dari awal muat halaman.
window.pastikanMountAntreanDakar = function() {
  if (vmAntreanDakar) return; // sudah pernah di-mount, tidak perlu ulang
  const mountPoint = document.getElementById('vue-antrean-dakar');
  if (mountPoint) vmAntreanDakar = createApp(AppAntreanDakar).mount('#vue-antrean-dakar');
};
window.refreshAntreanDakar = function() { if (vmAntreanDakar) vmAntreanDakar.muat(); };
