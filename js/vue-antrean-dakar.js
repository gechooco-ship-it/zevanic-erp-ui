// js/vue-antrean-dakar.js
// ============================================================================
// Halaman KEEMPAT yang dimigrasi ke Vue: Master Karyawan > Antrean Dakar
// (antrean persetujuan karyawan baru). Dengan ini seluruh "Master Karyawan"
// sudah 100% Vue.
//
// Dipakai ulang: GudangCheckboxSelect (dibangun saat migrasi Daftar Karyawan)
// — bukti nyata pola komponen bersama berhasil, tidak ditulis ulang lagi.
// ============================================================================
import { createApp, ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { GudangCheckboxSelect } from './vue-components.js';

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
      jenisPekerjaan: '',
      jabatan: '',
      statusKaryawan: '',
      gudang: []
    });
    const opsiStatusKerja = ref([]);
    const opsiJenisPekerjaan = ref([]);
    const opsiJabatan = ref([]);
    const opsiStatusKaryawan = ref([]);
    const memproses = ref(false);

    async function muatOpsi() {
      opsiStatusKerja.value = await window.ambilMasterList('status_kerja');
      opsiJenisPekerjaan.value = await window.ambilMasterList('jenis_pekerjaan');
      opsiJabatan.value = await window.ambilMasterList('jabatan');
      opsiStatusKaryawan.value = await window.ambilMasterList('status_karyawan');

      form.statusKerja = opsiStatusKerja.value.includes('Aktif') ? 'Aktif' : (opsiStatusKerja.value[0] || '');
      form.jenisPekerjaan = opsiJenisPekerjaan.value[0] || '';
      form.jabatan = opsiJabatan.value[0] || '';
      form.statusKaryawan = opsiStatusKaryawan.value[0] || '';
    }

    function lihatFotoBesar() {
      if (props.data.foto_ktp && window.bukaPreviewFoto) window.bukaPreviewFoto(props.data.foto_ktp);
    }

    async function setujui() {
      if (form.gudang.length === 0) {
        if (!confirm("Belum ada gudang dipilih. Karyawan ini TIDAK akan bisa login sampai gudang ditautkan (bisa diatur lagi lewat Daftar Karyawan > Edit). Lanjutkan?")) return;
      }
      memproses.value = true;
      try {
        await updateDoc(doc(db, "users", props.emailId), {
          status_kerja: form.statusKerja,
          jenis_pekerjaan: form.jenisPekerjaan,
          // Role/Status Pengguna SENGAJA tidak diset di sini — supaya siapapun
          // yang approve tidak bisa memberi akses Owner ke akun baru. Role
          // hanya bisa diubah Owner lewat Master Karyawan > Daftar Karyawan.
          role: "operator",
          jabatan: form.jabatan,
          status_karyawan: form.statusKaryawan,
          gudang_penempatan: form.gudang,
          status_approval: "APPROVED"
        });

        // Notifikasi WA (fungsi global, belum dimigrasi — dipanggil apa adanya)
        try {
          const userSnap = await getDoc(doc(db, "users", props.emailId));
          if (userSnap.exists()) {
            const d = userSnap.data();
            if (d.hp && window.kirimPesanWhatsapp && window.ambilTemplateWA) {
              const templateAktif = await window.ambilTemplateWA('template_aktif');
              window.kirimPesanWhatsapp(d.hp, templateAktif.replace(/\{nama\}/g, d.nama || ''), "Akun Aktif")
                .catch(e => console.error("Gagal kirim notifikasi WA aktivasi:", e));
            }
          }
        } catch (e) { console.error("Gagal ambil data untuk notifikasi WA:", e); }

        alert("Karyawan berhasil disetujui dan diaktifkan!");
        emit('diproses');
      } catch (e) {
        console.error("Gagal menyetujui karyawan:", e);
        alert("Gagal menyimpan persetujuan.");
      }
      memproses.value = false;
    }

    async function tolak() {
      if (!confirm("Tolak pendaftaran karyawan ini? Karyawan tidak akan bisa login. Bisa diaktifkan lagi nanti lewat Daftar Karyawan jika berubah pikiran.")) return;
      memproses.value = true;
      try {
        await updateDoc(doc(db, "users", props.emailId), { status_approval: "REJECTED" });
        alert("Pendaftaran ditolak.");
        emit('diproses');
      } catch (e) {
        console.error("Gagal menolak:", e);
        alert("Gagal memproses penolakan.");
      }
      memproses.value = false;
    }

    onMounted(muatOpsi);
    return { form, opsiStatusKerja, opsiJenisPekerjaan, opsiJabatan, opsiStatusKaryawan, memproses, lihatFotoBesar, setujui, tolak };
  },
  template: `
    <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
      <div class="flex items-center space-x-3 border-b pb-3">
        <img v-if="data.foto_ktp" :src="data.foto_ktp" @click="lihatFotoBesar" class="w-16 h-12 rounded-lg object-cover border cursor-pointer hover:scale-105 transition">
        <div v-else class="w-16 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300"><i class="fas fa-id-card"></i></div>
        <div>
          <h4 class="font-bold text-slate-800 text-sm">{{ data.nama || 'Tanpa Nama' }}</h4>
          <p class="text-[10px] text-gray-400 font-mono">{{ data.email || emailId }} &bull; {{ data.hp || '-' }}</p>
          <p class="text-[10px] text-gray-400 font-mono">NIK: {{ data.nik || '-' }}</p>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Status Kerja</label>
          <select v-model="form.statusKerja" class="w-full px-2 py-1.5 bg-gray-50 border rounded-lg text-xs">
            <option v-for="o in opsiStatusKerja" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Jenis Pekerjaan</label>
          <select v-model="form.jenisPekerjaan" class="w-full px-2 py-1.5 bg-gray-50 border rounded-lg text-xs">
            <option v-for="o in opsiJenisPekerjaan" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Jabatan</label>
          <select v-model="form.jabatan" class="w-full px-2 py-1.5 bg-gray-50 border rounded-lg text-xs">
            <option v-for="o in opsiJabatan" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Status Karyawan</label>
          <select v-model="form.statusKaryawan" class="w-full px-2 py-1.5 bg-gray-50 border rounded-lg text-xs">
            <option v-for="o in opsiStatusKaryawan" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
      </div>
      <div>
        <label class="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase">Gudang Penempatan (bisa lebih dari satu)</label>
        <gudang-checkbox-select v-model="form.gudang" />
      </div>
      <div class="flex space-x-2 pt-2 border-t">
        <button @click="setujui" :disabled="memproses" class="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition text-xs disabled:opacity-50">
          <i class="fas fa-check-circle mr-1"></i> Setujui & Aktifkan
        </button>
        <button @click="tolak" :disabled="memproses" class="bg-red-50 text-red-600 font-bold px-4 py-2.5 rounded-xl hover:bg-red-100 transition text-xs disabled:opacity-50">
          <i class="fas fa-times"></i> Tolak
        </button>
      </div>
    </div>
  `
};

const AppAntreanDakar = {
  components: { AntreanDakarCard },
  setup() {
    const daftarPending = ref([]);
    const memuat = ref(true);

    async function muat() {
      memuat.value = true;
      const snap = await getDocs(collection(db, "users"));
      const list = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        if (d.status_approval === "PENDING") list.push({ id: docSnap.id, data: d });
      });
      daftarPending.value = list;
      memuat.value = false;
    }

    onMounted(muat);
    return { daftarPending, memuat, muat };
  },
  template: `
    <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex justify-between items-center shadow-sm">
      <div>
        <h3 class="text-sm font-bold text-amber-700 mb-0.5"><i class="fas fa-user-clock mr-2"></i> Antrean Persetujuan Karyawan Baru</h3>
        <p class="text-[10px] text-amber-600">Pendaftar baru tidak bisa login sampai disetujui & dilengkapi datanya di sini.</p>
      </div>
      <button @click="muat" class="bg-amber-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-amber-700 transition"><i class="fas fa-sync-alt mr-1"></i> Refresh</button>
    </div>

    <div v-if="memuat" class="text-center py-10 text-gray-400 text-xs mt-4">
      <i class="fas fa-spinner fa-spin text-2xl mb-2"></i><p>Memuat antrean karyawan baru...</p>
    </div>
    <div v-else-if="daftarPending.length === 0" class="text-center py-16 text-gray-400 bg-white rounded-3xl border border-dashed mt-4">
      <i class="fas fa-user-check text-4xl text-green-300 mb-3"></i>
      <h4 class="font-bold text-gray-700 text-sm">Tidak Ada Antrean</h4>
      <p class="text-xs text-gray-400 mt-1">Semua pendaftar sudah diproses.</p>
    </div>
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <antrean-dakar-card v-for="item in daftarPending" :key="item.id" :email-id="item.id" :data="item.data" @diproses="muat" />
    </div>
  `
};

const mountPoint = document.getElementById('vue-antrean-dakar');
if (mountPoint) {
  createApp(AppAntreanDakar).mount('#vue-antrean-dakar');
}
