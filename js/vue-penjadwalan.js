// js/vue-penjadwalan.js
// ============================================================================
// Halaman KETUJUH & TERBESAR yang dimigrasi ke Vue: Master Absensi >
// Penjadwalan (ringkasan per-gudang, cari, filter, pilih massal via
// checkbox, update massal, pagination, export/import Excel).
//
// Dengan ini, SELURUH Master Absensi sudah 100% Vue.
//
// Dipakai ulang: GudangCheckboxSelect (dari migrasi Daftar Karyawan) untuk
// panel Gudang di Update Massal — menggantikan pola lama
// renderGudangCheckboxes/bacaGudangCheckboxes.
//
// Excel: memakai library global XLSX (sudah dimuat lewat <script> CDN di
// index.html sejak awal fitur Excel dibangun) — tidak perlu import ulang.
// ============================================================================
import { createApp, ref, reactive, computed, watch, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { GudangCheckboxSelect } from './vue-components.js';

const HARI_LIBUR_PILIHAN = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const PER_HALAMAN = 15;
const NILAI_TANPA_GUDANG = '__TANPA_GUDANG__';

const AppPenjadwalan = {
  components: { GudangCheckboxSelect },
  setup() {
    // ---- State mentah ----
    const semuaKaryawan = ref([]);
    const daftarGudang = ref([]);
    const daftarShift = ref([]);
    const daftarJenisPekerjaan = ref([]);
    const memuat = ref(true);

    // ---- Filter & pencarian ----
    const cariNama = ref('');
    const cekSudah = ref(true);
    const cekBelum = ref(true);
    const filterJenisPekerjaan = ref('ALL');
    const filterGudang = ref('ALL');
    const filterShift = ref('ALL');
    const filterLibur = ref('ALL');

    // ---- Seleksi & pagination ----
    const terpilih = reactive(new Set());
    const halaman = ref(1);

    // ---- Form update massal ----
    const bulkGudang = ref([]);
    const bulkShift = ref('');
    const bulkLibur = ref('');
    const memprosesBulk = ref(false);

    function statusTerjadwal(d) {
      const gudang = window.normalisasiGudang(d.gudang_penempatan);
      return (gudang.length > 0 && !!d.nama_shift);
    }

    async function muat() {
      memuat.value = true;
      try {
        const qKaryawan = await getDocs(collection(db, "users"));
        const listKaryawan = [];
        qKaryawan.forEach(docSnap => {
          const d = docSnap.data();
          if (d.role !== 'owner') listKaryawan.push({ email: docSnap.id, ...d });
        });
        semuaKaryawan.value = listKaryawan;

        const qGudang = await getDocs(collection(db, "master_gudang"));
        const listGudang = [];
        qGudang.forEach(docSnap => listGudang.push(docSnap.data().nama_gudang));
        daftarGudang.value = listGudang;

        const qShift = await getDocs(collection(db, "master_shift"));
        const listShift = [];
        qShift.forEach(docSnap => listShift.push(docSnap.data()));
        daftarShift.value = listShift;

        daftarJenisPekerjaan.value = window.ambilMasterList ? await window.ambilMasterList('jenis_pekerjaan') : [];

        terpilih.clear();
        halaman.value = 1;
      } catch (e) {
        console.error("Gagal muat data Penjadwalan:", e);
      }
      memuat.value = false;
    }

    // ---- Hasil filter (computed, otomatis update kalau salah satu dependensi berubah) ----
    const hasilFilter = computed(() => {
      const kataKunci = cariNama.value.toLowerCase().trim();
      return semuaKaryawan.value.filter(d => {
        if (kataKunci && !(d.nama || '').toLowerCase().includes(kataKunci)) return false;

        const sudah = statusTerjadwal(d);
        if (sudah && !cekSudah.value) return false;
        if (!sudah && !cekBelum.value) return false;

        if (filterJenisPekerjaan.value !== 'ALL' && d.jenis_pekerjaan !== filterJenisPekerjaan.value) return false;

        const gudangKaryawan = window.normalisasiGudang(d.gudang_penempatan);
        if (filterGudang.value === NILAI_TANPA_GUDANG) {
          if (gudangKaryawan.length > 0) return false;
        } else if (filterGudang.value !== 'ALL' && !gudangKaryawan.includes(filterGudang.value)) {
          return false;
        }

        if (filterShift.value !== 'ALL' && d.nama_shift !== filterShift.value) return false;
        if (filterLibur.value !== 'ALL' && d.hari_libur !== filterLibur.value) return false;

        return true;
      });
    });

    // Reset ke halaman 1 setiap kali hasil filter berubah (meniru perilaku lama)
    watch(hasilFilter, () => { halaman.value = 1; });

    const totalHalaman = computed(() => Math.max(1, Math.ceil(hasilFilter.value.length / PER_HALAMAN)));
    const halamanAman = computed(() => Math.min(halaman.value, totalHalaman.value));
    const potonganHalamanIni = computed(() => {
      const mulai = (halamanAman.value - 1) * PER_HALAMAN;
      return hasilFilter.value.slice(mulai, mulai + PER_HALAMAN);
    });
    const infoHalaman = computed(() => {
      if (hasilFilter.value.length === 0) return 'Tidak ada data';
      return `Halaman ${halamanAman.value} dari ${totalHalaman.value} (${hasilFilter.value.length} karyawan cocok filter)`;
    });
    const headerDicentang = computed(() =>
      potonganHalamanIni.value.length > 0 && potonganHalamanIni.value.every(d => terpilih.has(d.email))
    );

    // ---- Ringkasan per-gudang (kartu scroll horizontal, bisa diklik) ----
    const ringkasanKartu = computed(() => {
      const hitung = (list) => {
        const total = list.length;
        const sudah = list.filter(statusTerjadwal).length;
        return { total, sudah, belum: total - sudah };
      };
      const semua = semuaKaryawan.value;
      const kartu = [{ label: 'Semua Gudang', nilaiFilter: 'ALL', angka: hitung(semua) }];
      daftarGudang.value.forEach(g => {
        const list = semua.filter(d => window.normalisasiGudang(d.gudang_penempatan).includes(g));
        kartu.push({ label: g, nilaiFilter: g, angka: hitung(list) });
      });
      const tanpaGudang = semua.filter(d => window.normalisasiGudang(d.gudang_penempatan).length === 0);
      kartu.push({ label: 'Tanpa Gudang', nilaiFilter: NILAI_TANPA_GUDANG, angka: hitung(tanpaGudang) });
      return kartu;
    });

    function klikKartuGudang(nilaiFilter) {
      filterGudang.value = nilaiFilter;
    }

    // ---- Seleksi ----
    function toggleCheckbox(email) {
      if (terpilih.has(email)) terpilih.delete(email);
      else terpilih.add(email);
    }
    function toggleSemuaHalamanIni() {
      const dicentangSemua = headerDicentang.value;
      potonganHalamanIni.value.forEach(d => {
        if (dicentangSemua) terpilih.delete(d.email); else terpilih.add(d.email);
      });
    }
    function pilihSemua() {
      hasilFilter.value.forEach(d => terpilih.add(d.email));
    }
    function bersihkanPilihan() {
      terpilih.clear();
    }

    function halamanSebelumnya() { if (halamanAman.value > 1) halaman.value = halamanAman.value - 1; }
    function halamanBerikutnya() { if (halamanAman.value < totalHalaman.value) halaman.value = halamanAman.value + 1; }

    // ---- Update massal ----
    async function terapkanBulkUpdate() {
      const daftarTerpilih = Array.from(terpilih);
      if (daftarTerpilih.length === 0) return alert("Belum ada karyawan yang dicentang/terpilih.");
      if (bulkGudang.value.length === 0 && !bulkShift.value && !bulkLibur.value) {
        return alert("Isi minimal salah satu: Gudang, Shift, atau Hari Libur untuk diterapkan.");
      }
      if (!confirm(`Terapkan perubahan ke ${daftarTerpilih.length} karyawan terpilih?`)) return;

      const dataUpdate = {};
      if (bulkGudang.value.length > 0) dataUpdate.gudang_penempatan = bulkGudang.value;
      if (bulkShift.value) dataUpdate.nama_shift = bulkShift.value;
      if (bulkLibur.value) dataUpdate.hari_libur = bulkLibur.value;

      memprosesBulk.value = true;
      let sukses = 0, gagal = 0;
      for (const email of daftarTerpilih) {
        try {
          await updateDoc(doc(db, "users", email), dataUpdate);
          sukses++;
        } catch (e) {
          console.error("Gagal update jadwal untuk", email, e);
          gagal++;
        }
      }
      memprosesBulk.value = false;

      alert(`Update massal selesai. Berhasil: ${sukses}, Gagal: ${gagal}.`);
      bulkGudang.value = [];
      bulkShift.value = '';
      bulkLibur.value = '';
      await muat();
    }

    // ---- Export / Import Excel (pakai library global XLSX) ----
    function exportExcel() {
      const data = hasilFilter.value.map(d => ({
        'Email (jangan diubah)': d.email,
        'Nama': d.nama || '',
        'Jenis Pekerjaan': d.jenis_pekerjaan || '',
        'Gudang (pisahkan koma jika lebih dari satu)': window.normalisasiGudang(d.gudang_penempatan).join(', '),
        'Shift': d.nama_shift || '',
        'Hari Libur': d.hari_libur || ''
      }));
      if (data.length === 0) return alert("Tidak ada data untuk diunduh (sesuai filter aktif).");

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Penjadwalan");
      XLSX.writeFile(wb, `Penjadwalan_Zevanic_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    function importExcel(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function(e) {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws);

          if (rows.length === 0) { alert("File Excel kosong atau format tidak dikenali."); return; }
          if (!confirm(`Ditemukan ${rows.length} baris data. Terapkan update ke semua karyawan di file ini?`)) {
            event.target.value = '';
            return;
          }

          let sukses = 0, gagal = 0, dilewati = 0;
          for (const row of rows) {
            const email = row['Email (jangan diubah)'];
            if (!email) { dilewati++; continue; }

            const dataUpdate = {};
            if (row['Gudang (pisahkan koma jika lebih dari satu)']) {
              dataUpdate.gudang_penempatan = String(row['Gudang (pisahkan koma jika lebih dari satu)']).split(',').map(g => g.trim()).filter(Boolean);
            }
            if (row['Shift']) dataUpdate.nama_shift = String(row['Shift']).trim();
            if (row['Hari Libur']) dataUpdate.hari_libur = String(row['Hari Libur']).trim();

            if (Object.keys(dataUpdate).length === 0) { dilewati++; continue; }

            try {
              await updateDoc(doc(db, "users", email), dataUpdate);
              sukses++;
            } catch (err) {
              console.error("Gagal update baris untuk", email, err);
              gagal++;
            }
          }

          alert(`Import selesai. Berhasil: ${sukses}, Gagal: ${gagal}, Dilewati (email kosong/tidak ada perubahan): ${dilewati}.`);
          event.target.value = '';
          await muat();
        } catch (err) {
          console.error("Gagal membaca file Excel:", err);
          alert("Gagal membaca file Excel. Pastikan formatnya sesuai hasil unduhan dari sistem ini.");
          event.target.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    }

    onMounted(muat);

    return {
      semuaKaryawan, daftarShift, daftarJenisPekerjaan, memuat,
      cariNama, cekSudah, cekBelum, filterJenisPekerjaan, filterGudang, filterShift, filterLibur,
      terpilih, hasilFilter, potonganHalamanIni, infoHalaman, headerDicentang, halamanAman, totalHalaman,
      ringkasanKartu, klikKartuGudang,
      toggleCheckbox, toggleSemuaHalamanIni, pilihSemua, bersihkanPilihan,
      halamanSebelumnya, halamanBerikutnya,
      bulkGudang, bulkShift, bulkLibur, memprosesBulk, terapkanBulkUpdate,
      exportExcel, importExcel,
      statusTerjadwal,
      HARI_LIBUR_PILIHAN
    };
  },
  template: `
    <div class="space-y-4">
      <!-- 0. Ringkasan per-gudang: scroll horizontal, bisa diklik -->
      <div class="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        <div v-for="k in ringkasanKartu" :key="k.nilaiFilter"
             @click="klikKartuGudang(k.nilaiFilter)"
             class="flex-shrink-0 w-40 bg-white p-4 rounded-2xl border-2 cursor-pointer hover:border-blue-300 transition"
             :class="filterGudang === k.nilaiFilter ? 'border-blue-500 shadow-md' : 'border-gray-100 shadow-sm'">
          <h4 class="text-[11px] font-bold text-slate-800 truncate mb-2" :title="k.label">{{ k.label }}</h4>
          <div class="space-y-1 text-[10px]">
            <div class="flex justify-between"><span class="text-gray-400">Total</span><b class="text-slate-800">{{ k.angka.total }}</b></div>
            <div class="flex justify-between"><span class="text-gray-400">Sudah</span><b class="text-green-600">{{ k.angka.sudah }}</b></div>
            <div class="flex justify-between"><span class="text-gray-400">Belum</span><b class="text-red-500">{{ k.angka.belum }}</b></div>
          </div>
        </div>
      </div>

      <!-- 3. Update Massal -->
      <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
        <h3 class="text-sm font-bold text-slate-800 border-b pb-2"><i class="fas fa-layer-group text-blue-600 mr-1.5"></i> Update Massal ({{ terpilih.size }} Karyawan Terpilih)</h3>
        <p class="text-[10px] text-gray-400">Kosongkan kolom yang tidak ingin diubah. Berlaku untuk karyawan yang dicentang di tabel bawah (mengikuti filter/pencarian yang sedang aktif).</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label class="block font-semibold text-gray-600 mb-1">Gudang Penempatan (kosongkan = tidak diubah)</label>
            <gudang-checkbox-select v-model="bulkGudang" />
          </div>
          <div>
            <label class="block font-semibold text-gray-600 mb-1">Shift</label>
            <select v-model="bulkShift" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none">
              <option value="">-- Tidak Diubah --</option>
              <option v-for="s in daftarShift" :key="s.nama_shift" :value="s.nama_shift">{{ s.nama_shift }} ({{ s.jam_masuk }} - {{ s.jam_keluar }})</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-gray-600 mb-1">Hari Libur</label>
            <select v-model="bulkLibur" class="w-full px-3 py-2 bg-gray-50 border rounded-xl outline-none">
              <option value="">-- Tidak Diubah --</option>
              <option v-for="h in HARI_LIBUR_PILIHAN" :key="h" :value="h">{{ h }}</option>
            </select>
          </div>
        </div>
        <button @click="terapkanBulkUpdate" :disabled="memprosesBulk" class="w-full bg-slate-800 text-white font-bold py-2.5 rounded-xl hover:bg-slate-900 transition shadow-sm disabled:opacity-50">
          <i class="fas fa-check-double mr-1"></i> {{ memprosesBulk ? 'Memproses...' : 'Terapkan ke Karyawan Terpilih' }}
        </button>
      </div>

      <!-- 4. Excel Export/Import -->
      <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-3">
        <h3 class="text-sm font-bold text-slate-800 border-b pb-2"><i class="fas fa-file-excel text-green-600 mr-1.5"></i> Edit Lewat Excel</h3>
        <p class="text-[10px] text-gray-400">Unduh data (mengikuti filter aktif), edit kolom Gudang/Shift/Hari Libur di Excel, lalu unggah ulang untuk update massal.</p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button @click="exportExcel" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-sm flex items-center justify-center space-x-1.5">
            <i class="fas fa-download"></i><span>Unduh Excel</span>
          </button>
          <label class="bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 font-bold py-2.5 rounded-xl text-xs transition shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer">
            <i class="fas fa-upload"></i><span>Unggah Excel</span>
            <input type="file" accept=".xlsx,.xls" @change="importExcel" class="hidden">
          </label>
        </div>
      </div>

      <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <!-- 1. Pencarian -->
        <div class="relative">
          <i class="fas fa-search absolute left-3 top-2.5 text-gray-400 text-xs"></i>
          <input v-model="cariNama" type="text" placeholder="Cari nama karyawan..." autocomplete="off" class="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs">
        </div>

        <!-- 2. Filter -->
        <div class="bg-gray-50 rounded-2xl p-3.5 space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-gray-600"><i class="fas fa-filter mr-1"></i> Filter & Seleksi</h4>
            <div class="flex gap-2">
              <button @click="pilihSemua" class="text-blue-600 font-bold hover:underline text-[11px]">Select All</button>
              <span class="text-gray-300">|</span>
              <button @click="bersihkanPilihan" class="text-gray-500 font-bold hover:underline text-[11px]">Clear All</button>
            </div>
          </div>
          <div class="flex flex-wrap gap-4">
            <label class="flex items-center gap-1.5 font-semibold text-gray-600"><input type="checkbox" v-model="cekSudah"> Sudah Dijadwalkan</label>
            <label class="flex items-center gap-1.5 font-semibold text-gray-600"><input type="checkbox" v-model="cekBelum"> Belum Dijadwalkan</label>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select v-model="filterJenisPekerjaan" class="px-2.5 py-2 bg-white border rounded-xl outline-none">
              <option value="ALL">Semua Jenis Pekerjaan</option>
              <option v-for="v in daftarJenisPekerjaan" :key="v" :value="v">{{ v }}</option>
            </select>
            <select v-model="filterGudang" class="px-2.5 py-2 bg-white border rounded-xl outline-none">
              <option value="ALL">Semua Gudang</option>
              <option v-for="k in ringkasanKartu.slice(1, -1)" :key="k.nilaiFilter" :value="k.nilaiFilter">{{ k.label }}</option>
              <option value="__TANPA_GUDANG__">Tanpa Gudang</option>
            </select>
            <select v-model="filterShift" class="px-2.5 py-2 bg-white border rounded-xl outline-none">
              <option value="ALL">Semua Shift</option>
              <option v-for="s in daftarShift" :key="s.nama_shift" :value="s.nama_shift">{{ s.nama_shift }}</option>
            </select>
            <select v-model="filterLibur" class="px-2.5 py-2 bg-white border rounded-xl outline-none">
              <option value="ALL">Semua Hari Libur</option>
              <option v-for="h in HARI_LIBUR_PILIHAN" :key="h" :value="h">{{ h }}</option>
            </select>
          </div>
        </div>

        <!-- Daftar Karyawan (checkbox) -->
        <div class="overflow-x-auto rounded-xl border border-gray-100">
          <table class="w-full text-left text-xs text-gray-600 whitespace-nowrap">
            <thead class="bg-gray-50 text-gray-700 font-bold border-b text-[10px] uppercase">
              <tr>
                <th class="p-3"><input type="checkbox" :checked="headerDicentang" @change="toggleSemuaHalamanIni"></th>
                <th class="p-3">Karyawan</th>
                <th class="p-3">Jenis Pekerjaan</th>
                <th class="p-3">Gudang</th>
                <th class="p-3">Shift</th>
                <th class="p-3">Hari Libur</th>
                <th class="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-if="memuat"><td colspan="7" class="p-4 text-center text-gray-400">Memuat data...</td></tr>
              <tr v-else-if="potonganHalamanIni.length === 0"><td colspan="7" class="p-4 text-center text-gray-400">Tidak ada karyawan yang cocok dengan filter.</td></tr>
              <tr v-for="d in potonganHalamanIni" :key="d.email" class="hover:bg-gray-50">
                <td class="p-3"><input type="checkbox" :checked="terpilih.has(d.email)" @change="toggleCheckbox(d.email)"></td>
                <td class="p-3"><b class="text-slate-800">{{ d.nama || '-' }}</b><br><span class="text-[10px] text-gray-400">{{ d.email }}</span></td>
                <td class="p-3">{{ d.jenis_pekerjaan || '-' }}</td>
                <td class="p-3">{{ (d.gudang_penempatan && d.gudang_penempatan.length) ? d.gudang_penempatan.join(', ') : '-' }}</td>
                <td class="p-3">{{ d.nama_shift || '-' }}</td>
                <td class="p-3">{{ d.hari_libur || '-' }}</td>
                <td class="p-3 text-center">
                  <span v-if="statusTerjadwal(d)" class="inline-block px-2 py-0.5 bg-green-100 text-green-700 font-bold text-[9px] rounded-full">Sudah</span>
                  <span v-else class="inline-block px-2 py-0.5 bg-red-100 text-red-600 font-bold text-[9px] rounded-full">Belum</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="flex items-center justify-between text-xs pt-1">
          <span class="text-gray-400">{{ infoHalaman }}</span>
          <div class="flex gap-2">
            <button @click="halamanSebelumnya" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold"><i class="fas fa-chevron-left"></i></button>
            <button @click="halamanBerikutnya" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold"><i class="fas fa-chevron-right"></i></button>
          </div>
        </div>
      </div>
    </div>
  `
};

const mountPoint = document.getElementById('vue-penjadwalan');
if (mountPoint) {
  createApp(AppPenjadwalan).mount('#vue-penjadwalan');
}
