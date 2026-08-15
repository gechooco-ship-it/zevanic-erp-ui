// js/vue-whatsapp-gateway.js
// ============================================================================
// Halaman KEDELAPAN yang dimigrasi ke Vue: WhatsApp Gateway (Config API,
// Template Pesan, Monitoring Respon).
//
// window.kirimPesanWhatsapp (auth.js) TETAP dipanggil apa adanya dari sini —
// fungsi bersama, juga dipakai alur registrasi/approval yang belum dimigrasi.
// ============================================================================
import { createApp, ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
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
    const daftarLog = ref([]);
    const memuatLog = ref(true);

    async function muatMonitoring() {
      memuatLog.value = true;
      try {
        const snap = await getDocs(collection(db, "wa_log"));
        const list = [];
        snap.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
        list.sort((a, b) => (window.parseWaktuIndo(b.waktu)?.getTime() || 0) - (window.parseWaktuIndo(a.waktu)?.getTime() || 0));
        daftarLog.value = list.slice(0, 50);
      } catch (e) {
        console.error("Gagal memuat monitoring WA:", e);
      }
      memuatLog.value = false;
    }

    function pindahTab(nama) {
      tabAktif.value = nama;
      if (nama === 'config' && !webappUrl.value) muatKonfig();
      if (nama === 'template' && !template.otp) muatTemplate();
      if (nama === 'monitor') muatMonitoring();
    }

    onMounted(muatKonfig);

    return {
      tabAktif, pindahTab,
      webappUrl, secret, otpAktif, nomorTes, mengujiKirim, menyimpanKonfig, simpanKonfig, tesKirim,
      template, menyimpanTemplate, simpanTemplate,
      daftarLog, memuatLog, muatMonitoring
    };
  },
  template: `
    <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
      <div>
        <h2 class="text-lg font-black text-slate-800 flex items-center"><i class="fab fa-whatsapp text-green-500 mr-2.5"></i> WhatsApp Gateway</h2>
        <p class="text-xs text-gray-500 mt-0.5">Notifikasi WhatsApp (OTP, status akun) lewat Fonnte. Token Fonnte disimpan aman di Google Apps Script, tidak pernah ada di aplikasi ini.</p>
      </div>
      <div class="flex space-x-2 overflow-x-auto no-scrollbar pb-2 border-b border-gray-200 pt-2">
        <button @click="pindahTab('config')" :class="tabAktif === 'config' ? 'bg-slate-800 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'" class="px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition"><i class="fas fa-cogs mr-1.5"></i> Config API</button>
        <button @click="pindahTab('template')" :class="tabAktif === 'template' ? 'bg-slate-800 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'" class="px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition"><i class="fas fa-comment-dots mr-1.5"></i> Template Pesan</button>
        <button @click="pindahTab('monitor')" :class="tabAktif === 'monitor' ? 'bg-slate-800 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'" class="px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition"><i class="fas fa-chart-line mr-1.5"></i> Monitoring Respon</button>
      </div>
    </div>

    <div v-show="tabAktif === 'config'" class="mt-4">
      <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4 max-w-lg">
        <h3 class="text-sm font-bold text-slate-800 border-b pb-2">Koneksi API</h3>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">URL Web App Apps Script</label>
          <input v-model="webappUrl" type="text" placeholder="https://script.google.com/macros/s/xxxxx/exec" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-xs font-mono">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Kunci Rahasia (Shared Secret)</label>
          <input v-model="secret" type="text" placeholder="Samakan dengan ZEVANIC_SHARED_SECRET di Apps Script" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-xs font-mono">
        </div>
        <div class="flex items-center space-x-2">
          <input v-model="otpAktif" type="checkbox" id="wa-otp-aktif" class="rounded text-blue-600 w-4 h-4">
          <label for="wa-otp-aktif" class="text-xs font-semibold text-gray-600">Aktifkan verifikasi OTP saat login perangkat baru</label>
        </div>
        <button @click="simpanKonfig" :disabled="menyimpanKonfig" class="w-full bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition text-xs disabled:opacity-50">
          <i class="fas fa-save mr-1"></i> {{ menyimpanKonfig ? 'Menyimpan...' : 'Simpan Pengaturan' }}
        </button>
        <div class="pt-3 border-t space-y-2">
          <label class="block text-xs font-semibold text-gray-600 mb-1">Tes Kirim Pesan</label>
          <div class="flex space-x-2">
            <input v-model="nomorTes" type="text" placeholder="08xxxxxxxxxx" class="flex-1 px-3 py-2 bg-gray-50 border rounded-xl outline-none text-xs">
            <button @click="tesKirim" :disabled="mengujiKirim" class="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-900 transition whitespace-nowrap disabled:opacity-50">
              <i v-if="mengujiKirim" class="fas fa-spinner fa-spin"></i><span v-else>Kirim Tes</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-show="tabAktif === 'template'" class="mt-4">
      <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4 max-w-lg">
        <h3 class="text-sm font-bold text-slate-800 border-b pb-2">Template Pesan (Greeting)</h3>
        <p class="text-[11px] text-gray-500">Placeholder <code class="bg-gray-100 px-1 rounded">{nama}</code> dan <code class="bg-gray-100 px-1 rounded">{kode}</code> akan otomatis diganti sistem saat pesan dikirim.</p>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Pesan OTP Login</label>
          <textarea v-model="template.otp" rows="3" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-xs resize-none"></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Pesan Akun Disetujui</label>
          <textarea v-model="template.aktif" rows="3" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-xs resize-none"></textarea>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Pesan Akun Menunggu Persetujuan</label>
          <textarea v-model="template.pending" rows="3" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-xs resize-none"></textarea>
        </div>
        <button @click="simpanTemplate" :disabled="menyimpanTemplate" class="w-full bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition text-xs disabled:opacity-50">
          <i class="fas fa-save mr-1"></i> {{ menyimpanTemplate ? 'Menyimpan...' : 'Simpan Template' }}
        </button>
      </div>
    </div>

    <div v-show="tabAktif === 'monitor'" class="mt-4 space-y-4">
      <div class="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-center">
        <div>
          <h3 class="text-sm font-bold text-slate-800">Riwayat Pengiriman</h3>
          <p class="text-[10px] text-gray-500">50 pengiriman terakhir (OTP, notifikasi, tes).</p>
        </div>
        <button @click="muatMonitoring" class="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg font-bold"><i class="fas fa-sync-alt mr-1"></i> Refresh</button>
      </div>
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto w-full">
        <table class="w-full text-left border-collapse text-sm whitespace-nowrap min-w-max">
          <thead class="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0 z-10">
            <tr>
              <th class="p-3">Waktu</th>
              <th class="p-3">Jenis</th>
              <th class="p-3">Nomor Tujuan</th>
              <th class="p-3">Status</th>
              <th class="p-3">Keterangan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 text-gray-700 text-xs">
            <tr v-if="memuatLog"><td colspan="5" class="p-4 text-center text-gray-400">Memuat riwayat...</td></tr>
            <tr v-else-if="daftarLog.length === 0"><td colspan="5" class="p-4 text-center text-gray-400">Belum ada riwayat pengiriman.</td></tr>
            <tr v-for="log in daftarLog" :key="log.id" class="hover:bg-gray-50">
              <td class="p-3">{{ log.waktu || '-' }}</td>
              <td class="p-3 font-semibold">{{ log.jenis || '-' }}</td>
              <td class="p-3 font-mono">{{ log.target || '-' }}</td>
              <td class="p-3">
                <span v-if="log.sukses" class="px-2 py-0.5 bg-green-100 text-green-700 font-bold text-[10px] rounded-full">Terkirim</span>
                <span v-else class="px-2 py-0.5 bg-red-100 text-red-700 font-bold text-[10px] rounded-full">Gagal</span>
              </td>
              <td class="p-3 text-gray-500 max-w-[220px] truncate" :title="log.keterangan || ''">{{ log.keterangan || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-whatsapp-gateway');
if (mountPoint) {
  createApp(AppWhatsappGateway).mount('#vue-whatsapp-gateway');
}
