// js/vue-whatsapp-gateway.js
// ============================================================================
// Halaman KEDELAPAN yang dimigrasi ke Vue: WhatsApp Gateway (Config API,
// Template Pesan, Monitoring Respon).
//
// window.kirimPesanWhatsapp (auth.js) TETAP dipanggil apa adanya dari sini —
// fungsi bersama, juga dipakai alur registrasi/approval yang belum dimigrasi.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const TEMPLATE_DEFAULT = {
  template_otp: "Kode OTP login Zevanic ERP Anda: *{kode}*. Jangan bagikan kode ini ke siapapun. Berlaku 5 menit.",
  template_aktif: "Halo {nama}, akun Zevanic ERP Anda sudah *AKTIF*. Anda sekarang bisa login dan melakukan absensi.",
  template_pending: "Halo {nama}, pendaftaran Anda di Zevanic ERP telah diterima dan sedang *menunggu persetujuan*. Silakan hubungi Koordinator/PIC untuk aktivasi akun Anda."
};

const AppWhatsappGateway = {
  setup() {
    const tabAktif = ref('config');

    // ---- Config API ----
    const webappUrl = ref('');
    const secret = ref('');
    const otpAktif = ref(false);
    const nomorTes = ref('');
    const mengujiKirim = ref(false);
    const menyimpanKonfig = ref(false);

    async function muatKonfig() {
      try {
        const snap = await getDoc(doc(db, "config", "whatsapp_gateway"));
        if (snap.exists()) {
          const cfg = snap.data();
          webappUrl.value = cfg.webapp_url || '';
          secret.value = cfg.shared_secret || '';
          otpAktif.value = !!cfg.otp_aktif;
        }
      } catch (e) {
        console.error("Gagal memuat konfigurasi WhatsApp:", e);
      }
    }

    async function simpanKonfig() {
      if (!webappUrl.value.trim() || !secret.value.trim()) {
        alert("URL Web App dan Kunci Rahasia wajib diisi!");
        return;
      }
      menyimpanKonfig.value = true;
      try {
        await setDoc(doc(db, "config", "whatsapp_gateway"), {
          webapp_url: webappUrl.value.trim(),
          shared_secret: secret.value.trim(),
          otp_aktif: otpAktif.value
        });
        alert("Pengaturan WhatsApp Gateway berhasil disimpan!");
      } catch (e) {
        console.error("Gagal menyimpan konfigurasi WhatsApp:", e);
        alert("Gagal menyimpan pengaturan.");
      }
      menyimpanKonfig.value = false;
    }

    async function tesKirim() {
      if (!nomorTes.value.trim()) return alert("Masukkan nomor HP tujuan tes terlebih dahulu!");
      mengujiKirim.value = true;
      const berhasil = await window.kirimPesanWhatsapp(
        nomorTes.value.trim(),
        "Ini pesan tes dari Zevanic ERP. Jika Anda menerima ini, WhatsApp Gateway sudah tersambung dengan benar. \u2705",
        "Tes"
      );
      mengujiKirim.value = false;
      alert(berhasil ? "Pesan tes berhasil dikirim! Cek WhatsApp di nomor tersebut." : "Gagal mengirim pesan tes. Cek kembali URL Web App & Kunci Rahasia, pastikan sudah disimpan, dan cek Script Properties di Apps Script.");
    }

    // ---- Template Pesan ----
    const template = reactive({ otp: '', aktif: '', pending: '' });
    const menyimpanTemplate = ref(false);

    async function muatTemplate() {
      try {
        const snap = await getDoc(doc(db, "config", "whatsapp_templates"));
        const tpl = snap.exists() ? snap.data() : {};
        template.otp = tpl.template_otp || TEMPLATE_DEFAULT.template_otp;
        template.aktif = tpl.template_aktif || TEMPLATE_DEFAULT.template_aktif;
        template.pending = tpl.template_pending || TEMPLATE_DEFAULT.template_pending;
      } catch (e) {
        console.error("Gagal memuat template WA:", e);
      }
    }

    async function simpanTemplate() {
      menyimpanTemplate.value = true;
      try {
        await setDoc(doc(db, "config", "whatsapp_templates"), {
          template_otp: template.otp,
          template_aktif: template.aktif,
          template_pending: template.pending
        });
        alert("Template pesan berhasil disimpan!");
      } catch (e) {
        console.error("Gagal menyimpan template WA:", e);
        alert("Gagal menyimpan template.");
      }
      menyimpanTemplate.value = false;
    }

    // ---- Monitoring Respon ----
    // DIROMBAK (29 Agt 2026, §44.17, hemat) — dulu FULL FETCH seluruh
    // koleksi wa_log (bisa ribuan dokumen, notifikasi WA terus tercatat
    // tiap OTP/status akun terkirim) cuma buat tampilkan 50 teratas —
    // baca ribuan demi tampilkan puluhan, paling boros dari semua yang
    // ditemukan (STATUS-PROYEK.md §44.16). Sekarang pakai `waktu_ts`
    // (Timestamp asli, baru ditambahkan di js/auth.js — lihat catatan di
    // sana) + `orderBy()+limit()` SUNGGUHAN, dengan "Muat Lagi" (cursor
    // startAfter, nambah ke daftar yang sudah ada — BUKAN ganti halaman)
    // sesuai permintaan Guru: "boleh dimuat sebagian, muat lagi secara
    // bertahap tapi irit".
    //
    // KETERBATASAN JUJUR: dokumen wa_log dari SEBELUM perbaikan ini tidak
    // punya `waktu_ts` sama sekali — Firestore otomatis TIDAK
    // menyertakan dokumen yang field urutnya kosong dalam query
    // orderBy(waktu_ts), jadi log LAMA tidak akan muncul di daftar utama
    // ini lagi. Disediakan tombol terpisah "Lihat Log Sebelum
    // Pembaruan" (fetch manual, SEKALI diklik, BUKAN otomatis) buat
    // tetap bisa melihatnya kalau perlu — pola SAMA seperti "Cek Data
    // Sangat Lama" di Antrean Absensi/Lembur.
    const UKURAN_MUAT_LOG = 50;
    const daftarLog = ref([]);
    const memuatLog = ref(true);
    const memuatLogLagi = ref(false);
    const adaLogBerikutnya = ref(false);
    let cursorLogTerakhir = null;
    const filterStatus = ref('ALL');
    const daftarLogTersaring = computed(() => {
      if (filterStatus.value === 'ALL') return daftarLog.value;
      const cariSukses = filterStatus.value === 'Terkirim';
      return daftarLog.value.filter(log => !!log.sukses === cariSukses);
    });

    async function muatMonitoring() {
      memuatLog.value = true;
      daftarLog.value = [];
      cursorLogTerakhir = null;
      adaLogBerikutnya.value = false;
      try {
        const snap = await getDocs(query(collection(db, "wa_log"), orderBy("waktu_ts", "desc"), limit(UKURAN_MUAT_LOG)));
        const docs = snap.docs;
        daftarLog.value = docs.map(d => ({ id: d.id, ...d.data() }));
        if (docs.length > 0) cursorLogTerakhir = docs[docs.length - 1];
        adaLogBerikutnya.value = docs.length === UKURAN_MUAT_LOG;
      } catch (e) {
        console.error("Gagal memuat monitoring WA:", e);
      }
      memuatLog.value = false;
    }

    async function muatLagiLog() {
      if (!cursorLogTerakhir || memuatLogLagi.value) return;
      memuatLogLagi.value = true;
      try {
        const snap = await getDocs(query(collection(db, "wa_log"), orderBy("waktu_ts", "desc"), startAfter(cursorLogTerakhir), limit(UKURAN_MUAT_LOG)));
        const docs = snap.docs;
        daftarLog.value = [...daftarLog.value, ...docs.map(d => ({ id: d.id, ...d.data() }))];
        if (docs.length > 0) cursorLogTerakhir = docs[docs.length - 1];
        adaLogBerikutnya.value = docs.length === UKURAN_MUAT_LOG;
      } catch (e) {
        console.error("Gagal memuat log WA berikutnya:", e);
      }
      memuatLogLagi.value = false;
    }

    // Jaring pengaman MANUAL (bukan otomatis) — lihat log dari SEBELUM
    // waktu_ts ada, TIDAK tersentuh oleh orderBy(waktu_ts) di atas. Fetch-
    // semua SEKALI kalau diklik, sama seperti "Cek Data Sangat Lama".
    const memuatLogLama = ref(false);
    const daftarLogLama = ref([]);
    const sudahCekLogLama = ref(false);
    async function muatLogLama() {
      memuatLogLama.value = true;
      try {
        const snap = await getDocs(collection(db, "wa_log"));
        const list = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          if (!d.waktu_ts) list.push({ id: docSnap.id, ...d });
        });
        list.sort((a, b) => (window.parseWaktuIndo(b.waktu)?.getTime() || 0) - (window.parseWaktuIndo(a.waktu)?.getTime() || 0));
        daftarLogLama.value = list;
        sudahCekLogLama.value = true;
      } catch (e) {
        console.error("Gagal memuat log WA lama:", e);
      }
      memuatLogLama.value = false;
    }

    function pindahTab(nama) {
      tabAktif.value = nama;
      if (nama === 'config' && !webappUrl.value) muatKonfig();
      if (nama === 'template' && !template.otp) muatTemplate();
      if (nama === 'monitor') muatMonitoring();
    }

    onMounted(async () => { await window.authReady; muatKonfig(); });

    return {
      tabAktif, pindahTab,
      webappUrl, secret, otpAktif, nomorTes, mengujiKirim, menyimpanKonfig, simpanKonfig, tesKirim,
      template, menyimpanTemplate, simpanTemplate,
      daftarLog, daftarLogTersaring, filterStatus, memuatLog, muatMonitoring,
      adaLogBerikutnya, memuatLogLagi, muatLagiLog,
      memuatLogLama, daftarLogLama, sudahCekLogLama, muatLogLama
    };
  },
  template: `
    <div class="gc-card">
      <div>
        <h2 class="gc-heading" style="font-size:16.5px; font-weight:700; display:flex; align-items:center;"><i class="fab fa-whatsapp" style="color:var(--ok); margin-right:10px;"></i> WhatsApp Gateway</h2>
        <p style="font-size:12px; color:var(--text-muted); margin-top:3px;">Notifikasi WhatsApp (OTP, status akun) lewat Fonnte. Token Fonnte disimpan aman di Google Apps Script, tidak pernah ada di aplikasi ini.</p>
      </div>
      <div class="flex space-x-2 overflow-x-auto no-scrollbar" style="padding-top:14px; margin-top:14px; border-top:1px solid var(--line);">
        <button @click="pindahTab('config')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'config' }"><i class="fas fa-cogs" style="margin-right:6px;"></i> Config API</button>
        <button @click="pindahTab('template')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'template' }"><i class="fas fa-comment-dots" style="margin-right:6px;"></i> Template Pesan</button>
        <button @click="pindahTab('monitor')" class="gc-sub-tab-btn" :class="{ active: tabAktif === 'monitor' }"><i class="fas fa-chart-line" style="margin-right:6px;"></i> Monitoring Respon</button>
      </div>
    </div>

    <div v-show="tabAktif === 'config'" style="margin-top:16px;">
      <div class="gc-card" style="max-width:480px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:14px;">Koneksi API</h3>
        <div class="gc-field">
          <label>URL Web App Apps Script</label>
          <input v-model="webappUrl" type="text" placeholder="https://script.google.com/macros/s/xxxxx/exec" style="font-family:'Poppins',sans-serif; font-size:11.5px;">
        </div>
        <div class="gc-field">
          <label>Kunci rahasia (shared secret)</label>
          <input v-model="secret" type="text" placeholder="Samakan dengan ZEVANIC_SHARED_SECRET di Apps Script" style="font-family:'Poppins',sans-serif; font-size:11.5px;">
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
          <input v-model="otpAktif" type="checkbox" id="wa-otp-aktif" style="width:16px; height:16px; accent-color:var(--burgundy);">
          <label for="wa-otp-aktif" style="font-size:12px; font-weight:600; color:var(--text-muted);">Aktifkan verifikasi OTP saat login perangkat baru</label>
        </div>
        <button @click="simpanKonfig" :disabled="menyimpanKonfig" class="btn-primary block" style="background:var(--ok);">
          <i class="fas fa-save" style="margin-right:6px;"></i> {{ menyimpanKonfig ? 'Menyimpan...' : 'Simpan pengaturan' }}
        </button>
        <div style="padding-top:14px; margin-top:14px; border-top:1px solid var(--line);">
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:8px; font-family:'Poppins',sans-serif;">Tes kirim pesan</label>
          <div style="display:flex; gap:8px;">
            <input v-model="nomorTes" type="text" placeholder="08xxxxxxxxxx" style="flex:1; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
            <button @click="tesKirim" :disabled="mengujiKirim" class="btn-primary" style="white-space:nowrap;">
              <i v-if="mengujiKirim" class="fas fa-spinner fa-spin"></i><span v-else>Kirim tes</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-show="tabAktif === 'template'" style="margin-top:16px;">
      <div class="gc-card" style="max-width:480px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:14px;">Template Pesan (Greeting)</h3>
        <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">Placeholder <code style="background:var(--ivory-dim); padding:1px 5px; border-radius:4px;">{nama}</code> dan <code style="background:var(--ivory-dim); padding:1px 5px; border-radius:4px;">{kode}</code> akan otomatis diganti sistem saat pesan dikirim.</p>
        <div class="gc-field">
          <label>Pesan OTP login</label>
          <textarea v-model="template.otp" rows="3" style="font-size:12px;"></textarea>
        </div>
        <div class="gc-field">
          <label>Pesan akun disetujui</label>
          <textarea v-model="template.aktif" rows="3" style="font-size:12px;"></textarea>
        </div>
        <div class="gc-field">
          <label>Pesan akun menunggu persetujuan</label>
          <textarea v-model="template.pending" rows="3" style="font-size:12px;"></textarea>
        </div>
        <button @click="simpanTemplate" :disabled="menyimpanTemplate" class="btn-primary block" style="background:var(--ok);">
          <i class="fas fa-save" style="margin-right:6px;"></i> {{ menyimpanTemplate ? 'Menyimpan...' : 'Simpan template' }}
        </button>
      </div>
    </div>

    <div v-show="tabAktif === 'monitor'" style="margin-top:16px;">
      <div class="gc-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
        <div>
          <h3 class="gc-heading" style="font-size:13.5px; font-weight:700;">Riwayat pengiriman</h3>
          <p style="font-size:10.5px; color:var(--text-muted); margin-top:2px;">Termuat {{ daftarLog.length }} pengiriman terbaru — klik "Muat Lagi" di bawah untuk yang lebih lama.</p>
        </div>
        <button @click="muatMonitoring" class="btn-outline"><i class="fas fa-sync-alt" style="margin-right:6px;"></i> Refresh</button>
      </div>
      <div style="margin-bottom:12px;">
        <select v-model="filterStatus" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
          <option value="ALL">Semua status kirim</option>
          <option value="Terkirim">Terkirim</option>
          <option value="Gagal">Gagal</option>
        </select>
      </div>
      <div class="gc-table-scroll" style="background:var(--surface); border:1px solid var(--line);">
        <table class="gc-table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Jenis</th>
              <th>Nomor Tujuan</th>
              <th>Status</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="memuatLog"><td colspan="5" style="text-align:center; padding:20px; color:var(--text-faint);">Memuat riwayat...</td></tr>
            <tr v-else-if="daftarLog.length === 0"><td colspan="5" style="text-align:center; padding:20px; color:var(--text-faint);">Belum ada riwayat pengiriman.</td></tr>
            <tr v-else-if="daftarLogTersaring.length === 0"><td colspan="5" style="text-align:center; padding:20px; color:var(--text-faint);">Tidak ada yang cocok filter.</td></tr>
            <tr v-for="log in daftarLogTersaring" :key="log.id">
              <td class="gc-cell-muted">{{ log.waktu || '-' }}</td>
              <td style="font-weight:600;">{{ log.jenis || '-' }}</td>
              <td style="font-family:'Poppins',sans-serif; font-size:11.5px;">{{ log.target || '-' }}</td>
              <td>
                <span v-if="log.sukses" class="tag ok">Terkirim</span>
                <span v-else class="tag danger">Gagal</span>
              </td>
              <td class="gc-cell-muted" style="max-width:220px; overflow:hidden; text-overflow:ellipsis;" :title="log.keterangan || ''">{{ log.keterangan || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="adaLogBerikutnya" style="text-align:center; margin-top:14px;">
        <button @click="muatLagiLog" :disabled="memuatLogLagi" class="btn-outline filled">
          <i class="fas" :class="memuatLogLagi ? 'fa-spinner fa-spin' : 'fa-rotate-right'" style="margin-right:6px;"></i>
          {{ memuatLogLagi ? 'Memuat...' : 'Muat Lagi (50 berikutnya)' }}
        </button>
      </div>

      <!-- Jaring pengaman: log dari SEBELUM waktu_ts ada (lihat catatan
           di muatLogLama(), js/vue-whatsapp-gateway.js) — manual, tidak
           otomatis. -->
      <div class="gc-card" style="margin-top:16px;">
        <button v-if="!sudahCekLogLama" @click="muatLogLama" :disabled="memuatLogLama" class="btn-outline" style="font-size:11px; padding:7px 12px;" title="Fetch manual sekali — cari log dari sebelum pembaruan hemat ini (tidak otomatis, di luar 'Muat Lagi' di atas)">
          <i class="fas fa-magnifying-glass" style="margin-right:5px;"></i>{{ memuatLogLama ? 'Memeriksa...' : 'Lihat Log Sebelum Pembaruan' }}
        </button>
        <div v-else>
          <p style="font-size:11px; color:var(--text-muted); margin-bottom:10px; font-style:italic;"><i class="fas fa-circle-info" style="margin-right:5px;"></i>Ketemu {{ daftarLogLama.length }} log dari sebelum pembaruan ini (dicatat dengan waktu teks, bukan Timestamp — diurutkan best-effort).</p>
          <div v-if="daftarLogLama.length > 0" class="gc-table-scroll" style="background:var(--surface); border:1px solid var(--line);">
            <table class="gc-table">
              <thead><tr><th>Waktu</th><th>Jenis</th><th>Nomor Tujuan</th><th>Status</th><th>Keterangan</th></tr></thead>
              <tbody>
                <tr v-for="log in daftarLogLama" :key="log.id">
                  <td class="gc-cell-muted">{{ log.waktu || '-' }}</td>
                  <td style="font-weight:600;">{{ log.jenis || '-' }}</td>
                  <td style="font-family:'Poppins',sans-serif; font-size:11.5px;">{{ log.target || '-' }}</td>
                  <td><span v-if="log.sukses" class="tag ok">Terkirim</span><span v-else class="tag danger">Gagal</span></td>
                  <td class="gc-cell-muted" style="max-width:220px; overflow:hidden; text-overflow:ellipsis;" :title="log.keterangan || ''">{{ log.keterangan || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
};

let vmWhatsapp = null;
// Sama seperti layar admin lain — mount() ditunda sampai benar-benar
// dinavigasi pertama kali (lihat catatan panjang di vue-antrean-dakar.js).
window.pastikanMountWhatsapp = function() {
  if (vmWhatsapp) return;
  const mountPoint = document.getElementById('vue-whatsapp-gateway');
  if (mountPoint) vmWhatsapp = createApp(AppWhatsappGateway).mount('#vue-whatsapp-gateway');
};
window.bukaSubTabWhatsapp = function(nama) { if (vmWhatsapp) vmWhatsapp.pindahTab(nama); };
