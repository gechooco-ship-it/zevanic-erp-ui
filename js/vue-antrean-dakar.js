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

    onMounted(async () => { await window.authReady; muatOpsi(); });
    return { form, opsiStatusKerja, opsiJenisPekerjaan, opsiJabatan, opsiStatusKaryawan, memproses, lihatFotoBesar, setujui, tolak };
  },
  template: `
    <div class="gc-card">
      <div style="display:flex; align-items:center; gap:12px; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:14px;">
        <img v-if="data.foto_ktp" :src="data.foto_ktp" @click="lihatFotoBesar" style="width:64px; height:48px; border-radius:10px; object-fit:cover; border:1px solid var(--line); cursor:pointer;">
        <div v-else style="width:64px; height:48px; background:var(--ivory-dim); border-radius:10px; display:flex; align-items:center; justify-content:center; color:var(--text-faint);"><i class="fas fa-id-card"></i></div>
        <div>
          <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ data.nama || 'Tanpa Nama' }}</h4>
          <p style="font-size:10.5px; color:var(--text-muted); font-family:'Poppins',sans-serif;">{{ data.email || emailId }} &bull; {{ data.hp || '-' }}</p>
          <p style="font-size:10.5px; color:var(--text-muted); font-family:'Poppins',sans-serif;">NIK: {{ data.nik || '-' }}</p>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
        <div class="gc-field" style="margin-bottom:0;">
          <label style="font-size:10.5px;">Status kerja</label>
          <select v-model="form.statusKerja" style="padding:7px 10px; font-size:12px;">
            <option v-for="o in opsiStatusKerja" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
        <div class="gc-field" style="margin-bottom:0;">
          <label style="font-size:10.5px;">Jenis pekerjaan</label>
          <select v-model="form.jenisPekerjaan" style="padding:7px 10px; font-size:12px;">
            <option v-for="o in opsiJenisPekerjaan" :key="o" :value="o">{{ o }}</option>
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
          <i class="fas fa-check-circle" style="margin-right:6px;"></i> Setujui & aktifkan
        </button>
        <button @click="tolak" :disabled="memproses" class="btn-rej">
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

    onMounted(async () => { await window.authReady; muat(); });
    return { daftarPending, memuat, muat };
  },
  template: `
    <div class="gc-card" style="display:flex; justify-content:space-between; align-items:center; background:var(--pink); border:none;">
      <div>
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; color:var(--burgundy-dark);"><i class="fas fa-user-clock" style="margin-right:8px;"></i> Antrean persetujuan karyawan baru</h3>
        <p style="font-size:10.5px; color:var(--mahogany-soft); margin-top:2px;">Pendaftar baru tidak bisa login sampai disetujui & dilengkapi datanya di sini.</p>
      </div>
      <button @click="muat" class="btn-outline filled"><i class="fas fa-sync-alt" style="margin-right:6px;"></i> Refresh</button>
    </div>

    <div v-if="memuat" style="text-align:center; padding:40px 0; color:var(--text-faint); font-size:12px; margin-top:16px;">
      <i class="fas fa-spinner fa-spin" style="font-size:26px; margin-bottom:10px; display:block;"></i>Memuat antrean karyawan baru...
    </div>
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

const mountPoint = document.getElementById('vue-antrean-dakar');
if (mountPoint) {
  createApp(AppAntreanDakar).mount('#vue-antrean-dakar');
}
