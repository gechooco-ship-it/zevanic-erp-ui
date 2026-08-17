// js/vue-mail-gateway.js
// ============================================================================
// Mail Gateway — mirip WhatsApp Gateway (3 tab: Config, Template Pesan,
// Monitoring), tapi urus pengiriman EMAIL (lewat Extension "Trigger Email",
// bukan Apps Script seperti WhatsApp). Tab Config JUGA jadi tempat uji coba
// 3 skenario OTP (kode benar/salah/kadaluarsa) — lihat catatan di
// js/vue-otp.js buat model keamanannya.
//
// window.kirimOtpEmail / window.verifikasiOtpEmail (vue-otp.js) TETAP
// dipanggil apa adanya dari sini — fungsi bersama, juga dipakai alur
// Registrasi & login perangkat baru.
//
// UPDATE (18 Agt 2026): tambah 1 template baru "Aktivasi Akun" — dipakai
// js/vue-antrean-dakar.js untuk kirim email cara login (email + password
// sementara = NIK) begitu Admin/Owner approve pendaftaran karyawan baru.
// Sama seperti template lain di sini: kalau belum pernah diatur di
// Firestore (config/mail_templates), fallback ke teks baku otomatis.
// ============================================================================
import { createApp, ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const TEMPLATE_DEFAULT = {
  subjek_registrasi: "Kode Verifikasi Pendaftaran - Zevanic ERP",
  isi_registrasi: "Terima kasih sudah mendaftar di Zevanic ERP.\n\nKode verifikasi email Anda: {kode}\n\nMasukkan kode ini di aplikasi untuk melanjutkan pendaftaran. Kode berlaku 10 menit.",
  subjek_perangkat: "Kode Verifikasi Login Perangkat Baru - Zevanic ERP",
  isi_perangkat: "Ada percobaan login ke akun Zevanic ERP Anda dari perangkat baru.\n\nKode verifikasi Anda: {kode}\n\nKode berlaku 10 menit. Kalau ini bukan Anda, abaikan email ini dan segera ganti password.",
  subjek_aktivasi: "Akun Zevanic ERP Anda Sudah Aktif",
  isi_aktivasi: "Halo {nama},\n\nAkun Zevanic ERP Anda sudah disetujui dan aktif.\n\nLogin di gechoo.online dengan:\nEmail: {email}\nPassword sementara: {password}\n\nAnda akan diminta mengganti password ini saat login pertama kali."
};

const AppMailGateway = {
  setup() {
    const tabAktif = ref('config');

    // ---- Config + Tes OTP ----
    const emailTes = ref('');
    const kodeTes = ref('');
    const mengirimTes = ref(false);
    const memverifikasiTes = ref(false);
    const hasilTes = ref(''); // teks status terakhir, ditampilkan apa adanya

    async function kirimKodeTes() {
      if (!emailTes.value.trim()) return alert("Masukkan email tujuan tes dulu!");
      mengirimTes.value = true;
      hasilTes.value = '';
      const hasil = await window.kirimOtpEmail(emailTes.value.trim(), 'registrasi');
      mengirimTes.value = false;
      hasilTes.value = hasil.sukses
        ? `✅ Kode terkirim ke ${emailTes.value.trim()}. Cek inbox (atau folder spam) email itu, lalu masukkan kodenya di bawah untuk uji verifikasi.`
        : `❌ Gagal kirim: ${hasil.pesan}`;
    }

    async function verifikasiKodeTes() {
      if (!emailTes.value.trim() || !kodeTes.value.trim()) return alert("Isi email dan kode dulu!");
      memverifikasiTes.value = true;
      const hasil = await window.verifikasiOtpEmail(emailTes.value.trim(), kodeTes.value.trim());
      memverifikasiTes.value = false;
      hasilTes.value = hasil.sukses
        ? `✅ Kode BENAR — verifikasi berhasil!`
        : `❌ Kode ditolak: ${hasil.pesan}`;
    }

    // ---- Template Pesan ----
    const template = reactive({ ...TEMPLATE_DEFAULT });
    const menyimpanTemplate = ref(false);

    async function muatTemplate() {
      try {
        const snap = await getDoc(doc(db, "config", "mail_templates"));
        const tpl = snap.exists() ? snap.data() : {};
        Object.keys(TEMPLATE_DEFAULT).forEach(k => { template[k] = tpl[k] || TEMPLATE_DEFAULT[k]; });
      } catch (e) {
        console.error("Gagal memuat template email:", e);
      }
    }

    async function simpanTemplate() {
      menyimpanTemplate.value = true;
      try {
        await setDoc(doc(db, "config", "mail_templates"), { ...template });
        alert("Template email berhasil disimpan! Berlaku untuk pengiriman berikutnya.");
      } catch (e) {
        console.error("Gagal menyimpan template email:", e);
        alert("Gagal menyimpan template.");
      }
      menyimpanTemplate.value = false;
    }

    // ---- Monitoring ----
    const daftarLog = ref([]);
    const memuatLog = ref(true);

    async function muatMonitoring() {
      memuatLog.value = true;
      try {
        // "mail" cuma nyimpan input awal (buat Extension baca) + Extension
        // sendiri yang nambahkan field "delivery" (status kirim) SETELAH
        // dicoba. Diurutkan dari yang terbaru dulu, ambil 50 saja.
        const q = query(collection(db, "mail"), orderBy("dikirim_pada", "desc"), limit(50));
        const snap = await getDocs(q);
        const list = [];
        snap.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
        daftarLog.value = list;
      } catch (e) {
        console.error("Gagal memuat monitoring email:", e);
      }
      memuatLog.value = false;
    }

    function pindahTab(nama) {
      tabAktif.value = nama;
      if (nama === 'template' && template.subjek_registrasi === TEMPLATE_DEFAULT.subjek_registrasi) muatTemplate();
      if (nama === 'monitor') muatMonitoring();
    }

    onMounted(async () => { await window.authReady; });

    return {
      tabAktif, pindahTab,
      emailTes, kodeTes, mengirimTes, memverifikasiTes, hasilTes, kirimKodeTes, verifikasiKodeTes,
      template, menyimpanTemplate, simpanTemplate,
      daftarLog, memuatLog, muatMonitoring
    };
  },
  template: `
    <div class="gc-card">
      <div>
        <h2 class="gc-heading" style="font-size:16.5px; font-weight:700; display:flex; align-items:center;"><i class="fas fa-envelope" style="color:var(--burgundy); margin-right:10px;"></i> Mail Gateway</h2>
        <p style="font-size:12px; color:var(--text-muted); margin-top:3px;">Pengiriman email OTP (registrasi & login perangkat baru) & aktivasi akun lewat Firebase Extension "Trigger Email". Konfigurasi SMTP-nya sendiri (App Password, dsb) diatur di Firebase Console, bukan di sini.</p>
      </div>
      <div class="flex space-x-2 overflow-x-auto no-scrollbar" style="padding-top:14px; margin-top:14px; border-top:1px solid var(--line);">
        <button @click="pindahTab('config')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'config' }"><i class="fas fa-vial" style="margin-right:6px;"></i> Config &amp; Tes OTP</button>
        <button @click="pindahTab('template')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'template' }"><i class="fas fa-comment-dots" style="margin-right:6px;"></i> Template Pesan</button>
        <button @click="pindahTab('monitor')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'monitor' }"><i class="fas fa-chart-line" style="margin-right:6px;"></i> Monitoring</button>
      </div>
    </div>

    <div v-show="tabAktif === 'config'" style="margin-top:16px;">
      <div class="gc-card" style="max-width:480px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:6px;">Uji Coba OTP</h3>
        <p style="font-size:11px; color:var(--text-muted); margin-bottom:14px;">Tes 3 skenario sebelum dipakai sungguhan: (1) kode benar, (2) kode salah, (3) kode kadaluarsa (tunggu 10 menit lalu coba verifikasi lagi).</p>

        <div class="gc-field">
          <label>Email tujuan tes</label>
          <input v-model="emailTes" type="email" placeholder="email.anda@gmail.com">
        </div>
        <button @click="kirimKodeTes" :disabled="mengirimTes" class="btn-primary block" style="margin-bottom:16px;">
          <i class="fas fa-paper-plane" style="margin-right:6px;"></i> {{ mengirimTes ? 'Mengirim...' : '1. Kirim Kode Tes' }}
        </button>

        <div class="gc-field">
          <label>Kode yang diterima (6 digit)</label>
          <input v-model="kodeTes" type="text" maxlength="6" placeholder="123456" style="letter-spacing:4px; font-weight:700;">
        </div>
        <button @click="verifikasiKodeTes" :disabled="memverifikasiTes" class="btn-primary block" style="background:var(--ok);">
          <i class="fas fa-check-circle" style="margin-right:6px;"></i> {{ memverifikasiTes ? 'Memverifikasi...' : '2. Verifikasi Kode' }}
        </button>

        <div v-if="hasilTes" style="margin-top:14px; padding:12px; border-radius:12px; background:var(--ivory-dim); font-size:12.5px; line-height:1.5;">{{ hasilTes }}</div>
      </div>
    </div>

    <div v-show="tabAktif === 'template'" style="margin-top:16px;">
      <div class="gc-card" style="max-width:480px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:14px;">Template Pesan</h3>
        <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">Placeholder <code style="background:var(--ivory-dim); padding:1px 5px; border-radius:4px;">{kode}</code>/<code style="background:var(--ivory-dim); padding:1px 5px; border-radius:4px;">{nama}</code>/<code style="background:var(--ivory-dim); padding:1px 5px; border-radius:4px;">{email}</code>/<code style="background:var(--ivory-dim); padding:1px 5px; border-radius:4px;">{password}</code> otomatis diganti sistem saat email dikirim (tidak semua template pakai semua placeholder).</p>

        <div style="font-size:11px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; margin-bottom:8px;">OTP Registrasi</div>
        <div class="gc-field">
          <label>Subjek</label>
          <input v-model="template.subjek_registrasi" type="text">
        </div>
        <div class="gc-field">
          <label>Isi pesan</label>
          <textarea v-model="template.isi_registrasi" rows="4" style="font-size:12px;"></textarea>
        </div>

        <div style="font-size:11px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; margin:16px 0 8px;">OTP Perangkat Baru</div>
        <div class="gc-field">
          <label>Subjek</label>
          <input v-model="template.subjek_perangkat" type="text">
        </div>
        <div class="gc-field">
          <label>Isi pesan</label>
          <textarea v-model="template.isi_perangkat" rows="4" style="font-size:12px;"></textarea>
        </div>

        <div style="font-size:11px; font-weight:700; color:var(--burgundy); text-transform:uppercase; letter-spacing:.03em; margin:16px 0 8px;">Aktivasi Akun (dikirim dari Antrean Dakar)</div>
        <div class="gc-field">
          <label>Subjek</label>
          <input v-model="template.subjek_aktivasi" type="text">
        </div>
        <div class="gc-field">
          <label>Isi pesan</label>
          <textarea v-model="template.isi_aktivasi" rows="5" style="font-size:12px;"></textarea>
        </div>

        <button @click="simpanTemplate" :disabled="menyimpanTemplate" class="btn-primary block" style="background:var(--ok);">
          <i class="fas fa-save" style="margin-right:6px;"></i> {{ menyimpanTemplate ? 'Menyimpan...' : 'Simpan template' }}
        </button>
      </div>
    </div>

    <div v-show="tabAktif === 'monitor'" style="margin-top:16px;">
      <div class="gc-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <div>
          <h3 class="gc-heading" style="font-size:13.5px; font-weight:700;">Riwayat pengiriman</h3>
          <p style="font-size:10.5px; color:var(--text-muted); margin-top:2px;">50 email terakhir yang diminta kirim (OTP, aktivasi, tes).</p>
        </div>
        <button @click="muatMonitoring" class="btn-outline"><i class="fas fa-sync-alt" style="margin-right:6px;"></i> Refresh</button>
      </div>
      <div class="gc-table-scroll" style="background:var(--surface); border:1px solid var(--line);">
        <table class="gc-table">
          <thead>
            <tr>
              <th>Tujuan</th>
              <th>Subjek</th>
              <th>Status Kirim</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="memuatLog"><td colspan="4" style="text-align:center; padding:20px; color:var(--text-faint);">Memuat riwayat...</td></tr>
            <tr v-else-if="daftarLog.length === 0"><td colspan="4" style="text-align:center; padding:20px; color:var(--text-faint);">Belum ada riwayat pengiriman.</td></tr>
            <tr v-for="log in daftarLog" :key="log.id">
              <td style="font-family:'Poppins',sans-serif; font-size:11.5px;">{{ (log.to && log.to[0]) || '-' }}</td>
              <td class="gc-cell-muted">{{ (log.message && log.message.subject) || '-' }}</td>
              <td>
                <span v-if="log.delivery && log.delivery.state === 'SUCCESS'" class="tag ok">Terkirim</span>
                <span v-else-if="log.delivery && log.delivery.state === 'ERROR'" class="tag danger">Gagal</span>
                <span v-else class="tag warn">Diproses...</span>
              </td>
              <td class="gc-cell-muted" style="max-width:220px; overflow:hidden; text-overflow:ellipsis;" :title="(log.delivery && log.delivery.error) || ''">{{ (log.delivery && log.delivery.error) || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
};

let vmMailGateway = null;
// Sama seperti layar admin lain — mount() ditunda sampai benar-benar
// dinavigasi pertama kali (lihat catatan panjang di vue-antrean-dakar.js).
window.pastikanMountMailGateway = function() {
  if (vmMailGateway) return;
  const mountPoint = document.getElementById('vue-mail-gateway');
  if (mountPoint) vmMailGateway = createApp(AppMailGateway).mount('#vue-mail-gateway');
};
window.bukaSubTabMailGateway = function(nama) { if (vmMailGateway) vmMailGateway.pindahTab(nama); };
