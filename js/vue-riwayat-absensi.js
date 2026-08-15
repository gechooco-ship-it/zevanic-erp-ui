// js/vue-riwayat-absensi.js
// ============================================================================
// Halaman KEENAM yang dimigrasi ke Vue: Master Absensi > Riwayat All Absensi
// (laporan lengkap semua data absensi + edit/hapus/assign ulang + export CSV).
//
// Dipakai ulang: DuaBaris (dari migrasi Daftar Karyawan) — tabel 10 kolom ini
// pakai pola yang sama persis tanpa ditulis ulang.
// window.hapusAbsensi TETAP dipanggil dari sini (fungsi bersama, juga dipakai
// oleh Antrean Absensi yang sudah dimigrasi).
// ============================================================================
import { createApp, ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DuaBaris } from './vue-components.js';

const EditAbsensiModal = {
  props: {
    item: { type: Object, required: true }
  },
  emits: ['tutup', 'tersimpan'],
  setup(props, { emit }) {
    const form = reactive({
      statusKehadiran: props.item.status_kehadiran || '',
      seragam: props.item.seragam || 'Sesuai',
      statusAcc: props.item.status_acc || 'PENDING'
    });
    const opsiStatusKehadiran = ref([]);
    const menyimpan = ref(false);

    async function muatOpsi() {
      opsiStatusKehadiran.value = window.ambilMasterList ? await window.ambilMasterList('status_kehadiran') : ["Ontime", "Terlambat", "Tidak Absen"];
    }

    async function simpan() {
      menyimpan.value = true;
      try {
        await updateDoc(doc(db, "absensi", props.item.id), {
          status_kehadiran: form.statusKehadiran,
          seragam: form.seragam,
          status_acc: form.statusAcc
        });
        alert("Data absensi berhasil diperbarui!");
        emit('tersimpan');
      } catch (e) {
        console.error("Gagal edit absensi:", e);
        alert("Gagal menyimpan perubahan.");
      }
      menyimpan.value = false;
    }

    onMounted(muatOpsi);
    return { form, opsiStatusKehadiran, menyimpan, simpan };
  },
  template: `
    <div class="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 fade-in">
      <div class="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
        <div class="flex justify-between items-center border-b pb-3">
          <h3 class="text-sm font-bold text-gray-800"><i class="fas fa-edit text-blue-600 mr-2"></i> Edit Data Absensi</h3>
          <button @click="$emit('tutup')" class="text-gray-400 hover:text-red-500"><i class="fas fa-times text-lg"></i></button>
        </div>
        <p class="text-xs text-gray-500">Karyawan: <b class="text-slate-800">{{ item.nama_pegawai || item.nama || '-' }}</b></p>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Status Kehadiran</label>
          <select v-model="form.statusKehadiran" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-sm">
            <option v-for="s in opsiStatusKehadiran" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Seragam</label>
          <select v-model="form.seragam" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-sm">
            <option value="Sesuai">Sesuai</option>
            <option value="Tidak Sesuai">Tidak Sesuai</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Status Persetujuan</label>
          <select v-model="form.statusAcc" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none text-sm">
            <option value="ACC">ACC</option>
            <option value="REJECT">REJECT</option>
            <option value="PENDING">PENDING</option>
          </select>
        </div>
        <button @click="simpan" :disabled="menyimpan" class="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 transition text-sm disabled:opacity-50">
          <i class="fas fa-save mr-1"></i> {{ menyimpan ? 'Menyimpan...' : 'Simpan Perubahan' }}
        </button>
      </div>
    </div>
  `
};

const AppRiwayatAbsensi = {
  components: { DuaBaris, EditAbsensiModal },
  setup() {
    const listData = ref([]);
    const memuat = ref(true);
    const itemSedangDiedit = ref(null);

    async function muat() {
      memuat.value = true;
      try {
        // Cross-reference No. HP dari koleksi users (record absensi tidak simpan hp langsung)
        const qUsers = await getDocs(collection(db, "users"));
        const petaHp = {};
        qUsers.forEach(u => { petaHp[u.data().email] = u.data().hp || '-'; });

        const snap = await getDocs(collection(db, "absensi"));
        const list = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          d.id = docSnap.id;
          d.hpDicariDariUsers = petaHp[d.email] || d.email || '-';
          list.push(d);
        });

        list.sort((a, b) => (window.parseWaktuIndo(b.waktu)?.getTime() || 0) - (window.parseWaktuIndo(a.waktu)?.getTime() || 0));
        listData.value = list;
      } catch (e) {
        console.error("Gagal muat rekap global:", e);
      }
      memuat.value = false;
    }

    function pisahTanggalWaktu(waktu) {
      const [tgl, jam] = (waktu || '-, -').split(', ');
      return { tgl, jam };
    }

    function lihatFotoBesar(url) {
      if (url && window.bukaPreviewFoto) window.bukaPreviewFoto(url);
    }

    function bukaEdit(item) { itemSedangDiedit.value = item; }
    function tutupEdit() { itemSedangDiedit.value = null; }
    async function selesaiSimpan() { itemSedangDiedit.value = null; await muat(); }

    function hapus(docId) {
      // Fungsi bersama (juga dipakai Antrean Absensi)
      if (window.hapusAbsensi) window.hapusAbsensi(docId).then(muat);
    }

    async function assignUlang(docId) {
      if (!confirm("Kembalikan data ini ke Antrean Absensi untuk diperiksa ulang?")) return;
      try {
        await updateDoc(doc(db, "absensi", docId), { status_acc: "PENDING" });
        alert("Data berhasil di-assign ulang ke Antrean Absensi.");
        await muat();
      } catch (e) {
        console.error("Gagal assign ulang:", e);
        alert("Gagal memproses assign ulang.");
      }
    }

    function exportCSV() {
      if (listData.value.length === 0) return alert("Tidak ada data untuk di-export saat ini.");

      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Nama Pegawai,Email,Waktu Presensi,Tipe Presensi,Lokasi Gudang,Shift,Seragam,Status Persetujuan\n";

      listData.value.forEach(row => {
        const nama = `"${(row.nama_pegawai || row.nama || '').replace(/"/g, '""')}"`;
        const email = `"${(row.email || '').replace(/"/g, '""')}"`;
        const waktu = `"${row.waktu || ''}"`;
        const status = `"${row.status || 'HADIR'}"`;
        const gudang = `"${row.gudang || '-'}"`;
        const shift = `"${row.shift || '-'}"`;
        const seragam = `"${row.seragam || 'Sesuai'}"`;
        const statusAcc = `"${row.status_acc || 'PENDING'}"`;
        csvContent += `${nama},${email},${waktu},${status},${gudang},${shift},${seragam},${statusAcc}\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Data_Absensi_Zevanic_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    onMounted(muat);
    return { listData, memuat, itemSedangDiedit, muat, pisahTanggalWaktu, lihatFotoBesar, bukaEdit, tutupEdit, selesaiSimpan, hapus, assignUlang, exportCSV };
  },
  template: `
    <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex justify-between items-center mb-4">
      <div>
         <h3 class="font-black text-slate-800 text-sm"><i class="fas fa-database text-purple-600 mr-2"></i> Riwayat All Absensi</h3>
         <p class="text-[10px] text-gray-500 mt-1">Laporan lengkap seluruh karyawan. Anda bisa mengunduhnya untuk keperluan Payroll.</p>
      </div>
      <button @click="exportCSV" class="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-md flex items-center space-x-2">
          <i class="fas fa-file-excel text-sm"></i><span>Unduh Excel (CSV)</span>
      </button>
    </div>

    <div v-if="memuat" class="text-center py-10 text-gray-400 text-xs"><i class="fas fa-spinner fa-spin text-3xl mb-3"></i><p>Menyiapkan Riwayat All Absensi...</p></div>

    <div v-else class="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm bg-white">
      <table class="w-full text-left text-xs text-gray-600 whitespace-nowrap">
        <thead class="bg-slate-800 text-white font-bold border-b text-[10px] uppercase">
          <tr>
            <th class="p-3">Persetujuan / Tipe Absen</th>
            <th class="p-3">Shift / Gudang</th>
            <th class="p-3">Tanggal / Waktu</th>
            <th class="p-3">Foto</th>
            <th class="p-3">Nama / No HP</th>
            <th class="p-3">Status Kehadiran / Seragam</th>
            <th class="p-3">Sanggahan Karyawan</th>
            <th class="p-3">Aju Banding</th>
            <th class="p-3">Pemeriksa</th>
            <th class="p-3 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="listData.length === 0"><td colspan="10" class="p-4 text-center text-gray-400">Belum ada data absensi.</td></tr>
          <tr v-for="item in listData" :key="item.id" class="hover:bg-blue-50 transition">
            <td class="p-3">
              <b>
                <span v-if="item.status_acc === 'ACC'" class="text-green-600">ACC</span>
                <span v-else-if="item.status_acc === 'REJECT'" class="text-red-500">REJECT</span>
                <span v-else class="text-amber-500">PENDING</span>
              </b><br>
              <span class="text-[10px] text-gray-400 font-normal">{{ item.status || 'HADIR' }}</span>
            </td>
            <td class="p-3"><dua-baris :a="item.shift" :b="item.gudang" /></td>
            <td class="p-3"><dua-baris :a="pisahTanggalWaktu(item.waktu).tgl" :b="pisahTanggalWaktu(item.waktu).jam" /></td>
            <td class="p-3">
              <img v-if="item.foto_selfie || item.foto" :src="item.foto_selfie || item.foto" @click="lihatFotoBesar(item.foto_selfie || item.foto)" class="w-10 h-10 rounded-lg object-cover border cursor-pointer hover:scale-105 transition">
              <span v-else class="text-gray-300">-</span>
            </td>
            <td class="p-3"><dua-baris :a="item.nama_pegawai || item.nama" :b="item.hpDicariDariUsers" /></td>
            <td class="p-3"><dua-baris :a="item.status_kehadiran" :b="item.seragam || 'Sesuai'" /></td>
            <td class="p-3 max-w-[160px] truncate" :title="item.catatan_banding || ''">{{ item.catatan_banding || '-' }}</td>
            <td class="p-3">
              <span v-if="item.catatan_banding" class="px-2 py-0.5 bg-amber-100 text-amber-700 font-bold text-[9px] rounded-full">Ada Aju Banding</span>
              <span v-else class="text-gray-300">-</span>
            </td>
            <td class="p-3">{{ item.validated_by || '-' }}</td>
            <td class="p-3 text-center">
              <div class="flex items-center justify-center gap-1">
                <button @click="bukaEdit(item)" class="bg-blue-50 text-blue-600 px-2 py-1.5 rounded-lg text-[10px] font-bold hover:bg-blue-100" title="Edit"><i class="fas fa-edit"></i></button>
                <button @click="hapus(item.id)" class="bg-red-50 text-red-600 px-2 py-1.5 rounded-lg text-[10px] font-bold hover:bg-red-100" title="Hapus"><i class="fas fa-trash-alt"></i></button>
                <button v-if="item.catatan_banding" @click="assignUlang(item.id)" class="bg-amber-50 text-amber-600 px-2 py-1.5 rounded-lg text-[10px] font-bold hover:bg-amber-100" title="Assign ulang ke Antrean Absensi"><i class="fas fa-undo"></i></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <edit-absensi-modal v-if="itemSedangDiedit" :item="itemSedangDiedit" @tutup="tutupEdit" @tersimpan="selesaiSimpan" />
  `
};

const mountPoint = document.getElementById('vue-riwayat-absensi');
if (mountPoint) {
  createApp(AppRiwayatAbsensi).mount('#vue-riwayat-absensi');
}
