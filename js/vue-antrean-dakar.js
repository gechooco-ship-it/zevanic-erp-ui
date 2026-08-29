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
// Dipakai ulang: KolomCari (vue-components.js). GudangCheckboxSelect TIDAK
// dipakai lagi di sini sejak 29 Agt 2026 v2 (lihat catatan di
// AntreanDakarCard — Gudang penempatan dilepas dari form approval ini).
// ============================================================================
import { createApp, ref, reactive, computed, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
// BARU (29 Agt 2026 v2) — GudangCheckboxSelect DILEPAS dari sini (form
// approval tidak lagi input Gudang, lihat catatan di AntreanDakarCard di
// bawah) — KolomCari (pil) dipakai buat baris cari, pola sama modul lain.
import { KolomCari } from './vue-components.js?v=5';

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
  return link; // BARU — supaya Admin bisa lihat/salin link LANGSUNG, tidak cuma andalkan email masuk
}

const AntreanDakarCard = {
  props: {
    emailId: { type: String, required: true },
    data: { type: Object, required: true }
  },
  emits: ['diproses'],
  setup(props, { emit }) {
    // DIROMBAK (29 Agt 2026, moodboard "Gechoo Mobile Organic" v2,
    // permintaan Guru — PERUBAHAN LOGIC, bukan cuma tampilan) — form
    // approval SEKARANG cuma isi Jadwal Shift + Jabatan. Status Kerja
    // LANGSUNG hardcode 'Aktif' di setujui() (bukan dipilih manual lagi).
    // Status Karyawan & Gudang penempatan DILEPAS dari form ini SAMA
    // SEKALI — jadi Owner-only lewat Daftar Karyawan > Edit (menu
    // Config). Field form.statusKerja/statusKaryawan/gudang DIHAPUS
    // (bukan cuma disembunyikan) karena memang tidak dipakai input
    // apapun lagi di sini.
    const form = reactive({
      shift: '',
      jabatan: ''
    });
    const daftarShift = ref([]);
    const opsiJabatan = ref([]);
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
      const qShift = await getDocs(collection(db, "master_shift"));
      const listShift = [];
      qShift.forEach(docSnap => {
        const s = docSnap.data();
        if (window.bolehLihatJenisPekerjaan(s.jenis_pekerjaan)) listShift.push(s);
      });
      daftarShift.value = listShift;

      // BARU (29 Agt 2026 v2) — Jabatan DIBATASI cuma Operator/Admin di
      // form approval ini (permintaan Guru eksplisit). Jabatan lain (mis.
      // Warehouse, lihat seed default di dashboard.js) TETAP bisa diatur
      // Owner belakangan lewat Daftar Karyawan > Edit, TIDAK bisa dipilih
      // di sini.
      const semuaJabatan = window.ambilMasterList ? await window.ambilMasterList('jabatan') : [];
      opsiJabatan.value = semuaJabatan.filter(j => j === 'Operator' || j === 'Admin');
      if (opsiJabatan.value.length === 0) {
        // Jaring pengaman — kalau Master Data > Jabatan TIDAK punya entri
        // persis "Operator"/"Admin" (ejaan beda dsb), form ini akan
        // kosong tanpa pilihan sama sekali. Bukan ditebak diam-diam —
        // sengaja diteriakkan di Console biar ketahuan pas testing.
        console.warn('[Antrean Dakar] Master Data > Jabatan tidak punya entri persis "Operator"/"Admin" — dropdown Jabatan di form approval ini akan kosong. Cek ejaan di Master Data > Jabatan.');
      }

      form.shift = daftarShift.value[0]?.nama_shift || '';
      form.jabatan = opsiJabatan.value[0] || '';
    }

    function lihatFotoBesar() {
      if (props.data.foto_ktp && window.bukaPreviewFoto) window.bukaPreviewFoto(props.data.foto_ktp);
    }

    // BARU — link ditampilkan LANGSUNG di kartu (bukan cuma dikirim lewat
    // email), supaya Admin bisa tes/bagikan manual (WhatsApp, dsb) tanpa
    // bergantung ke email masuk atau tidak (bisa nyangkut Spam, dsb).
    const linkTerakhir = ref('');
    const linkTersalin = ref(false);
    function salinLink() {
      navigator.clipboard.writeText(linkTerakhir.value).then(() => {
        linkTersalin.value = true;
        setTimeout(() => { linkTersalin.value = false; }, 2000);
      });
    }

    // "Setujui" — SEKARANG cuma simpan data kerja + generate token + kirim
    // link. TIDAK bikin akun Auth apapun di titik ini.
    async function setujui() {
      if (window.cekIzinMenu('antrean_dakar', 'add') === false) {
        return alert('Anda tidak punya izin menyetujui karyawan baru. Hubungi Owner/PIC.');
      }
      // DIHAPUS (29 Agt 2026 v2) — dulu ada confirm() "belum pilih gudang,
      // lanjutkan?" cuma buat kasus admin LUPA isi. SEKARANG gudang memang
      // SELALU kosong di titik ini (field-nya dilepas dari form), jadi
      // confirm() itu akan muncul TIAP KALI approve (mengganggu) — diganti
      // catatan tetap di dalam form (lihat template, sebelum tombol
      // Setujui) yang SELALU kelihatan, bukan popup berulang.

      memproses.value = true;
      try {
        const token = buatTokenAcak();
        const kadaluarsa = new Date(Date.now() + MASA_BERLAKU_MENIT * 60 * 1000);
        await updateDoc(doc(db, "pendaftaran_pending", props.emailId), {
          // BARU (29 Agt 2026 v2, permintaan Guru eksplisit) — Status
          // Kerja LANGSUNG 'Aktif' begitu diklik Setujui (tidak dipilih
          // manual lagi). Status Karyawan & Gudang penempatan SENGAJA
          // dikosongkan di sini — wajib dilengkapi Owner lewat Daftar
          // Karyawan > Edit SEBELUM karyawan ini bisa login (gerbang
          // gudang_penempatan.length===0 di js/vue-login.js TIDAK
          // disentuh/tidak berubah, cuma titik pengisiannya yang pindah).
          status_kerja: 'Aktif',
          nama_shift: form.shift,
          jabatan: form.jabatan,
          status_karyawan: '',
          gudang_penempatan: [],
          token_buat_password: token,
          token_kadaluarsa: Timestamp.fromDate(kadaluarsa),
          token_terverifikasi: false,
          disetujui_pada: serverTimestamp(),
          disetujui_oleh: window.currentUser.name || window.currentUser.email
        });
        linkTerakhir.value = await kirimEmailLinkPassword(props.emailId, props.data.nama, token);
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
        linkTerakhir.value = await kirimEmailLinkPassword(props.emailId, props.data.nama, token);
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
      form, daftarShift, opsiJabatan, memproses,
      sudahDiSetujui, sudahKadaluarsa, sisaWaktuTeks, linkTerakhir, linkTersalin, salinLink,
      lihatFotoBesar, setujui, assignUlang, tolak
    };
  },
  // ==========================================================================
  // TEMPLATE DIROMBAK (29 Agt 2026, moodboard "Gechoo Mobile Organic" v2,
  // dari mockup gechoo-mobile-organic-rollout.html §Antrean Dakar) — header
  // kartu dirapikan (foto KTP 52x40, radius 12px) + badge status ("Baru"
  // buat yang belum diproses sama sekali). Foto KTP TETAP persegi panjang
  // (bukan avatar bulat) — ini KTP, bukan foto wajah, TIDAK berubah.
  // Email/HP TETAP ditampilkan (baris kecil terpisah dari NIK) — mockup
  // v2 cuma gambar NIK buat hemat ruang, tapi info kontak sengaja TIDAK
  // dihilangkan dari kartu sungguhan karena masih relevan buat admin yang
  // approve. Alur token-email-link TIDAK disentuh sama sekali.
  // ==========================================================================
  template: `
    <div class="gc-card" style="border-radius:20px;">
      <div style="display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--ivory-dim); padding-bottom:10px; margin-bottom:10px;">
        <img v-if="data.foto_ktp" :src="data.foto_ktp" @click="lihatFotoBesar" style="width:52px; height:40px; border-radius:12px; object-fit:cover; border:2px solid var(--surface); box-shadow:0 2px 8px rgba(91,56,38,.1); cursor:pointer; flex-shrink:0;">
        <div v-else style="width:52px; height:40px; background:var(--ivory-dim); border-radius:12px; display:flex; align-items:center; justify-content:center; color:var(--text-faint); flex-shrink:0;"><i class="fas fa-id-card"></i></div>
        <div style="flex:1; min-width:0;">
          <h4 class="gc-heading" style="font-weight:700; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ data.nama || 'Tanpa Nama' }}</h4>
          <p style="font-size:9.5px; color:var(--text-faint); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">NIK {{ data.nik || '-' }}</p>
          <p style="font-size:9.5px; color:var(--text-faint); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ data.email || emailId }} &middot; {{ data.hp || '-' }}</p>
        </div>
        <span v-if="sudahDiSetujui && sudahKadaluarsa" class="tag danger" style="flex-shrink:0;">Link kadaluarsa</span>
        <span v-else-if="sudahDiSetujui" class="tag warn" style="flex-shrink:0;">Menunggu Password</span>
        <span v-else class="tag warn" style="flex-shrink:0;">Baru</span>
      </div>

      <div v-if="linkTerakhir" style="background:var(--ok-light); border:1px dashed var(--ok); border-radius:12px; padding:12px 14px; margin-bottom:14px;">
        <p style="font-size:10.5px; font-weight:700; color:var(--ok); margin-bottom:6px;"><i class="fas fa-link" style="margin-right:5px;"></i> Link "Buat Password" (juga sudah coba dikirim lewat email):</p>
        <div style="display:flex; gap:8px; align-items:center;">
          <input :value="linkTerakhir" readonly onclick="this.select()" style="flex:1; font-size:10.5px; padding:7px 10px; border:1px solid var(--line); border-radius:8px; background:var(--surface); color:var(--text-muted); font-family:monospace;">
          <button @click="salinLink" class="icon-btn" style="flex-shrink:0;"><i :class="linkTersalin ? 'fa-check' : 'fa-copy'" class="fas"></i></button>
        </div>
        <p style="font-size:10px; color:var(--text-faint); margin-top:6px;">Bisa dibagikan manual (WhatsApp, dsb) — berguna kalau emailnya belum/tidak masuk.</p>
      </div>

      <template v-if="!sudahDiSetujui">
        <p style="font-size:9px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px;">Isi penempatan sebelum setujui &darr;</p>
        <div style="display:grid; gap:8px; margin-bottom:10px;" class="grid-cols-1 md:grid-cols-2">
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
        </div>
        <!-- BARU (29 Agt 2026 v2) — gantikan confirm() popup lama yang
             muncul TIAP KALI approve. Sekarang gudang/status karyawan
             MEMANG selalu dilewatkan di sini (Owner-only, lewat Config),
             jadi catatannya ditaruh tetap di form, bukan popup berulang. -->
        <p style="font-size:10px; color:var(--warn); background:var(--warn-light); border-radius:10px; padding:8px 10px; margin-bottom:10px;"><i class="fas fa-triangle-exclamation" style="margin-right:5px;"></i>Gudang &amp; Status Karyawan BELUM diisi di sini — karyawan ini TIDAK BISA login sampai Owner melengkapinya lewat <b>Daftar Karyawan &gt; Edit</b>.</p>
        <div class="approve-row" style="margin-top:2px;">
          <button @click="setujui" :disabled="memproses" class="appr-btn ok" style="flex:2;"><i class="fas fa-paper-plane"></i> {{ memproses ? 'Memproses...' : 'Setujui & Kirim Link' }}</button>
          <button @click="tolak" :disabled="memproses" class="appr-btn danger"><i class="fas fa-times"></i> Tolak</button>
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
  components: { AntreanDakarCard, KolomCari },
  setup() {
    // Dipakai buat catatan transparansi filter jenis pekerjaan di template
    // (LEWAT computed, BUKAN window.xxx langsung di template — lihat
    // STATUS-PROYEK.md §10.1).
    const isOwnerRole = computed(() => ['owner', 'superuser'].includes((window.currentUser.role || '').toLowerCase()));

    const daftarPending = ref([]);
    const memuat = ref(true);
    const errorMuat = ref('');
    const memprosesUji = ref(false);

    // PEDOMAN KERJA §16 — search box selalu ada, filter Jenis Pekerjaan+
    // Gudang cuma buat Owner/Superuser (Admin biasa sudah otomatis
    // kefilter lewat window.bolehLihatData di muat()).
    const cariNama = ref('');
    const filterJenisPekerjaanOwner = ref('ALL');
    const filterGudangOwner = ref('ALL');
    const opsiJenisPekerjaanOwner = ref([]);
    const opsiGudangOwner = ref([]);
    // BARU (29 Agt 2026, moodboard "Gechoo Mobile Organic" v2) — dropdown
    // filter Owner + Buat Data Uji dipindah ke 1 menu "lainnya" oval
    // titik-tiga di sebelah kolom cari, pola sama Absensi/Lembur.
    const menuTerbuka = ref(false);
    function toggleMenuTerbuka() { menuTerbuka.value = !menuTerbuka.value; }
    const adaFilterAktif = computed(() => filterJenisPekerjaanOwner.value !== 'ALL' || filterGudangOwner.value !== 'ALL');
    const daftarPendingTersaring = computed(() => {
      let hasil = daftarPending.value;
      const cari = cariNama.value.trim().toLowerCase();
      if (cari) hasil = hasil.filter(item => (item.data.nama || '').toLowerCase().includes(cari));
      if (isOwnerRole.value) {
        if (filterJenisPekerjaanOwner.value !== 'ALL') hasil = hasil.filter(item => item.data.jenis_pekerjaan === filterJenisPekerjaanOwner.value);
        // Sebelum Setujui, gudang_penempatan BELUM ada sama sekali (baru
        // diisi Admin saat approve) — item begitu WAJAR tidak cocok
        // filter gudang manapun, bukan bug.
        if (filterGudangOwner.value !== 'ALL') hasil = hasil.filter(item => (item.data.gudang_penempatan || []).includes(filterGudangOwner.value));
      }
      return hasil;
    });

    // BARU — supaya bisa tes alur Setujui -> token -> link "Buat Password"
    // TANPA perlu tunggu ada orang benar-benar daftar & lolos OTP dulu.
    // Cuma Owner (dicek juga via Firestore Rules: create pendaftaran_pending
    // sekarang boleh isAdminLevel() langsung, tidak wajib lolos OTP lagi).
    async function buatDataUji() {
      if (!confirm("Buat 1 data pendaftaran PALSU buat testing? Nanti muncul di daftar di bawah, proses Setujui/Tolak SAMA seperti data asli — tinggal dihapus (Tolak) kalau sudah selesai tes.")) return;
      memprosesUji.value = true;
      try {
        const stempel = Date.now();
        const emailUji = `data.uji.${stempel}@zevanic.test`;
        const opsiJp = window.ambilMasterList ? await window.ambilMasterList('jenis_pekerjaan') : [];
        await setDoc(doc(db, "pendaftaran_pending", emailUji), {
          email: emailUji,
          nama: "DATA UJI " + new Date(stempel).toLocaleString('id-ID'),
          nik: "3200000000" + String(stempel).slice(-6),
          hp: "0812" + String(stempel).slice(-8),
          jenis_pekerjaan: opsiJp[0] || '',
          foto_ktp: '',
          dibuat_pada: serverTimestamp()
        });
        alert("Data uji dibuat: " + emailUji + "\n\nSekarang muncul di daftar di bawah — coba klik Setujui seperti biasa buat lihat link \"Buat Password\"-nya.");
        muat();
      } catch (e) {
        console.error("Gagal membuat data uji:", e);
        alert("Gagal membuat data uji: " + e.message);
      }
      memprosesUji.value = false;
    }

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

        if (isOwnerRole.value) {
          opsiJenisPekerjaanOwner.value = window.ambilMasterList ? await window.ambilMasterList('jenis_pekerjaan') : [];
          const qGudang = await getDocs(collection(db, "master_gudang"));
          const listGudang = [];
          qGudang.forEach(g => listGudang.push(g.data().nama_gudang));
          opsiGudangOwner.value = listGudang;
        }
      } catch (e) {
        console.error("Gagal memuat antrean pendaftaran:", e);
        errorMuat.value = 'Gagal memuat data (' + (e.code || e.message) + '). Kemungkinan izin akses (role Anda) belum ter-refresh — coba Logout lalu Login lagi.';
      }
      memuat.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });
    return {
      isOwnerRole, daftarPending, daftarPendingTersaring, memuat, errorMuat, muat, memprosesUji, buatDataUji,
      cariNama, filterJenisPekerjaanOwner, filterGudangOwner, opsiJenisPekerjaanOwner, opsiGudangOwner,
      menuTerbuka, toggleMenuTerbuka, adaFilterAktif
    };
  },
  // ==========================================================================
  // DIROMBAK (29 Agt 2026, moodboard "Gechoo Mobile Organic" v2, dari cek
  // live Guru di HP) — banner dipadatkan & dipindah ke bawah kolom cari,
  // dropdown filter Owner + Buat Data Uji + Refresh masuk ke menu oval
  // titik-tiga (.gc-overflow-btn) — pola sama persis Absensi/Lembur. Logic
  // query/filter/bolehLihatData TIDAK berubah sama sekali.
  // ==========================================================================
  template: `
    <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
      <div style="flex:1; min-width:0;"><kolom-cari v-model="cariNama" placeholder="Cari nama pendaftar..." /></div>
      <button @click="toggleMenuTerbuka" class="gc-overflow-btn" title="Menu lainnya">
        <i class="fas fa-ellipsis"></i>
        <span v-if="adaFilterAktif" class="gc-overflow-dot"></span>
      </button>
      <div v-if="menuTerbuka" @click="toggleMenuTerbuka" class="gc-overflow-backdrop"></div>
      <div v-if="menuTerbuka" class="gc-overflow-panel">
        <template v-if="isOwnerRole">
          <div class="gc-overflow-label">Filter</div>
          <div style="padding:2px 6px 8px;">
            <select v-model="filterJenisPekerjaanOwner" style="width:100%; margin-bottom:6px; padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
              <option value="ALL">Semua jenis pekerjaan</option>
              <option v-for="jp in opsiJenisPekerjaanOwner" :key="jp" :value="jp">{{ jp }}</option>
            </select>
            <select v-model="filterGudangOwner" style="width:100%; padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
              <option value="ALL">Semua gudang</option>
              <option v-for="g in opsiGudangOwner" :key="g" :value="g">{{ g }}</option>
            </select>
          </div>
          <hr class="gc-overflow-sep">
        </template>
        <button v-if="isOwnerRole" @click="toggleMenuTerbuka(); buatDataUji();" :disabled="memprosesUji" class="gc-overflow-item"><i class="fas fa-flask"></i> Buat Data Uji</button>
        <button @click="toggleMenuTerbuka(); muat();" class="gc-overflow-item"><i class="fas fa-sync-alt"></i> Refresh</button>
      </div>
    </div>
    <div class="gc-card" style="display:flex; align-items:center; gap:8px; background:var(--pink); border:none; padding:9px 14px; margin-bottom:16px;">
      <i class="fas fa-user-clock" style="color:var(--burgundy-dark); font-size:12px;"></i>
      <b style="font-size:11px; color:var(--burgundy-dark);">Antrean karyawan baru</b>
      <span class="gc-badge-count">{{ daftarPendingTersaring.length }}</span>
    </div>
    <p v-if="!isOwnerRole" style="font-size:10.5px; color:var(--text-muted); margin:-10px 0 16px;"><i class="fas fa-filter" style="margin-right:5px;"></i>Cuma nampilin jenis pekerjaan yang sama dengan profil Anda.</p>

    <div v-if="memuat && daftarPending.length === 0" style="text-align:center; padding:40px 0; color:var(--text-faint); font-size:12px; margin-top:16px;">
      <i class="fas fa-spinner fa-spin" style="font-size:26px; margin-bottom:10px; display:block;"></i>Memuat antrean karyawan baru...
    </div>
    <div v-else-if="errorMuat" style="text-align:center; padding:40px 0; color:var(--danger); font-size:12px; margin-top:16px; background:var(--danger-light); border-radius:18px;">{{ errorMuat }}</div>
    <div v-else-if="daftarPending.length === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px; margin-top:16px;">
      <i class="fas fa-user-check" style="font-size:34px; color:var(--ok); margin-bottom:10px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">Tidak ada antrean</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">Semua pendaftar sudah diproses.</p>
    </div>
    <div v-else-if="daftarPendingTersaring.length === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px; margin-top:16px;">
      <i class="fas fa-filter-circle-xmark" style="font-size:34px; color:var(--text-faint); margin-bottom:10px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">Tidak ada yang cocok</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">Coba ubah kata kunci pencarian atau filter yang aktif.</p>
    </div>
    <div v-else style="gap:14px; margin-top:16px;" class="grid grid-cols-1 md:grid-cols-2">
      <antrean-dakar-card v-for="item in daftarPendingTersaring" :key="item.id" :email-id="item.id" :data="item.data" @diproses="muat" />
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
