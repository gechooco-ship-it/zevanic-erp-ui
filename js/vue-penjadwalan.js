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
import { collection, getDocs, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { GudangCheckboxSelect, GudangRingkas } from './vue-components.js';

const HARI_LIBUR_PILIHAN = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const PER_HALAMAN = 15;
const NILAI_TANPA_GUDANG = '__TANPA_GUDANG__';

const AppPenjadwalan = {
  components: { GudangCheckboxSelect, GudangRingkas },
  setup() {
    // Dipakai buat catatan transparansi filter jenis pekerjaan di template
    // (LEWAT computed, BUKAN window.xxx langsung di template — lihat
    // STATUS-PROYEK.md §10.1, sudah pernah kejadian bug diam-diam karena ini).
    const isOwnerRole = computed(() => ['owner', 'superuser'].includes((window.currentUser.role || '').toLowerCase()));

    // ---- State mentah ----
    const semuaKaryawan = ref([]);
    const daftarGudang = ref([]);
    const petaJenisLokasi = ref({}); // nama gudang -> "Tetap"/"Dinamis", buat kolom Jenis Lokasi
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
    const bulkJenisPekerjaan = ref('');
    const bulkShift = ref('');
    const bulkLibur = ref('');
    const memprosesBulk = ref(false);

    // Jenis Lokasi karyawan — kalau gudangnya campur Tetap & Dinamis,
    // tampilkan "Campuran"; kalau semua sama, tampilkan itu; kalau belum
    // ada gudang sama sekali, "-".
    function jenisLokasiKaryawan(d) {
      const list = window.normalisasiGudang(d.gudang_penempatan);
      if (list.length === 0) return '-';
      const jenisUnik = [...new Set(list.map(g => petaJenisLokasi.value[g] || 'Tetap'))];
      return jenisUnik.length > 1 ? 'Campuran' : jenisUnik[0];
    }

    function statusTerjadwal(d) {
      const gudang = window.normalisasiGudang(d.gudang_penempatan);
      return (gudang.length > 0 && !!d.nama_shift);
    }

    // Pembungkus window.normalisasiGudang untuk ditampilkan di template —
    // HARUS lewat fungsi begini, bukan "window.xxx" langsung di template.
    function tampilkanGudang(d) {
      return window.normalisasiGudang(d.gudang_penempatan).join(', ') || '-';
    }

    async function muat() {
      memuat.value = true;
      try {
        // DIPERBAIKI (29 Agt 2026, §44.17, hemat) — layar ini SECARA
        // FUNGSI memang butuh SEMUA karyawan aktif sekaligus (kartu
        // ringkasan per gudang, Pilih Semua + Update Massal, Export Excel
        // — semuanya beroperasi di atas SELURUH hasil filter, bukan cuma
        // 1 halaman, jadi TIDAK BISA dipotong jadi paginasi cursor tanpa
        // menghilangkan fitur itu). Yang BISA & AMAN dihemat: jangan tarik
        // akun NON-AKTIF (resign/ditolak) yang toh dibuang lagi di JS
        // (baris "d.status_kerja === 'Aktif'" di bawah) — pindahkan
        // filter itu ke where() Firestore SEKARANG, supaya dokumen yang
        // memang tidak relevan tidak ikut terbaca dari server sama sekali.
        const qKaryawan = await getDocs(query(collection(db, "users"), where("status_kerja", "==", "Aktif")));
        const listKaryawan = [];
        qKaryawan.forEach(docSnap => {
          const d = docSnap.data();
          // DIUBAH (19 Agt 2026) — eksklusi "d.role !== 'owner'" DIBUANG,
          // konsisten dengan keputusan Hilman: Owner sekarang WAJIB ikut
          // alur operasional yang sama (gudang/Clock In/jam kerja), jadi
          // WAJAR juga muncul di Penjadwalan kalau memang ditempatkan di
          // gudang tertentu.
          if (window.bolehLihatData(d.jenis_pekerjaan, d.gudang_penempatan)) listKaryawan.push({ email: docSnap.id, ...d });
        });
        semuaKaryawan.value = listKaryawan;

        const qGudang = await getDocs(collection(db, "master_gudang"));
        const listGudang = [];
        const petaJenis = {};
        qGudang.forEach(docSnap => {
          const g = docSnap.data();
          if (!window.bolehLihatData(g.jenis_pekerjaan, [g.nama_gudang])) return;
          listGudang.push(g.nama_gudang);
          petaJenis[g.nama_gudang] = g.tipe_lokasi || 'Tetap';
        });
        daftarGudang.value = listGudang;
        petaJenisLokasi.value = petaJenis;

        const qShift = await getDocs(collection(db, "master_shift"));
        const listShift = [];
        qShift.forEach(docSnap => {
          const s = docSnap.data();
          if (window.bolehLihatJenisPekerjaan(s.jenis_pekerjaan)) listShift.push(s);
        });
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

    // ---- Scroll kartu ringkasan (tombol panah, karena scrollbar disembunyikan) ----
    const railRingkasan = ref(null);
    function geserRingkasan(arah) {
      if (railRingkasan.value) railRingkasan.value.scrollBy({ left: arah * 240, behavior: 'smooth' });
    }

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

    // Perbaikan bug yang sama dengan Hak Akses: kartu ringkasan cuma
    // menghitung berdasarkan Gudang, tidak ikut memperhitungkan filter lain
    // (cariNama, cekSudah/cekBelum, Jenis Pekerjaan, Shift, Hari Libur) yang
    // mungkin masih aktif — bisa bikin tabel kosong walau kartu bilang ada
    // datanya. Klik kartu sekarang reset filter lain juga.
    function klikKartuGudang(nilaiFilter) {
      filterGudang.value = nilaiFilter;
      cariNama.value = '';
      cekSudah.value = true;
      cekBelum.value = true;
      filterJenisPekerjaan.value = 'ALL';
      filterShift.value = 'ALL';
      filterLibur.value = 'ALL';
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
      if (bulkGudang.value.length === 0 && !bulkJenisPekerjaan.value && !bulkShift.value && !bulkLibur.value) {
        return alert("Isi minimal salah satu: Gudang, Jenis Pekerjaan, Shift, atau Hari Libur untuk diterapkan.");
      }
      if (!confirm(`Terapkan perubahan ke ${daftarTerpilih.length} karyawan terpilih?`)) return;

      const dataUpdate = {};
      if (bulkGudang.value.length > 0) dataUpdate.gudang_penempatan = bulkGudang.value;
      if (bulkJenisPekerjaan.value) dataUpdate.jenis_pekerjaan = bulkJenisPekerjaan.value;
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
      bulkJenisPekerjaan.value = '';
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

    onMounted(async () => { await window.authReady; muat(); });

    return {
      isOwnerRole,
      semuaKaryawan, daftarShift, daftarJenisPekerjaan, memuat, muat,
      railRingkasan, geserRingkasan,
      cariNama, cekSudah, cekBelum, filterJenisPekerjaan, filterGudang, filterShift, filterLibur,
      terpilih, hasilFilter, potonganHalamanIni, infoHalaman, headerDicentang, halamanAman, totalHalaman,
      ringkasanKartu, klikKartuGudang,
      toggleCheckbox, toggleSemuaHalamanIni, pilihSemua, bersihkanPilihan,
      halamanSebelumnya, halamanBerikutnya,
      bulkGudang, bulkJenisPekerjaan, bulkShift, bulkLibur, memprosesBulk, terapkanBulkUpdate,
      exportExcel, importExcel,
      statusTerjadwal, tampilkanGudang, jenisLokasiKaryawan,
      HARI_LIBUR_PILIHAN
    };
  },
  template: `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <p v-if="!isOwnerRole" style="font-size:10.5px; color:var(--text-muted); margin:0;"><i class="fas fa-filter" style="margin-right:5px;"></i>Cuma nampilin jenis pekerjaan yang sama dengan profil Anda.</p>
        <div v-else></div>
        <button @click="muat" class="btn-outline"><i class="fas fa-sync-alt" style="margin-right:6px;"></i> Refresh</button>
      </div>
      <!-- 0. Ringkasan per-gudang: scroll horizontal, bisa diklik -->
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
        <button @click="geserRingkasan(-1)" class="icon-btn" style="flex-shrink:0;" aria-label="Geser kiri"><i class="fas fa-chevron-left"></i></button>
        <div ref="railRingkasan" style="display:flex; gap:12px; overflow-x:auto; padding-bottom:8px; scroll-behavior:smooth;" class="no-scrollbar">
        <div v-for="k in ringkasanKartu" :key="k.nilaiFilter"
             @click="klikKartuGudang(k.nilaiFilter)"
             style="flex-shrink:0; width:150px; background:var(--surface); padding:14px; border-radius:16px; cursor:pointer; transition:.15s;"
             :style="filterGudang === k.nilaiFilter ? 'border:2px solid var(--burgundy); box-shadow:0 4px 10px rgba(110,30,44,.1);' : 'border:1px solid var(--line);'">
          <h4 :title="k.label" style="font-size:11.5px; font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:8px;">{{ k.label }}</h4>
          <div style="display:flex; flex-direction:column; gap:4px; font-size:10.5px;">
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-faint);">Total</span><b>{{ k.angka.total }}</b></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-faint);">Sudah</span><b style="color:var(--ok);">{{ k.angka.sudah }}</b></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-faint);">Belum</span><b style="color:var(--danger);">{{ k.angka.belum }}</b></div>
          </div>
        </div>
        </div>
        <button @click="geserRingkasan(1)" class="icon-btn" style="flex-shrink:0;" aria-label="Geser kanan"><i class="fas fa-chevron-right"></i></button>
      </div>

      <!-- 3. Update Massal -->
      <div class="gc-card" style="margin-bottom:16px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:12px;"><i class="fas fa-layer-group" style="color:var(--burgundy); margin-right:8px;"></i> Update massal ({{ terpilih.size }} karyawan terpilih)</h3>
        <p style="font-size:10.5px; color:var(--text-muted); margin-bottom:12px;">Kosongkan kolom yang tidak ingin diubah. Berlaku untuk karyawan yang dicentang di tabel bawah (mengikuti filter/pencarian yang sedang aktif).</p>
        <div style="gap:12px;" class="grid grid-cols-1 md:grid-cols-4">
          <div class="gc-field" style="margin-bottom:0;">
            <label>Gudang penempatan (kosongkan = tidak diubah)</label>
            <gudang-checkbox-select v-model="bulkGudang" />
          </div>
          <div class="gc-field" style="margin-bottom:0;">
            <label>Jenis pekerjaan</label>
            <select v-model="bulkJenisPekerjaan">
              <option value="">-- Tidak diubah --</option>
              <option v-for="j in daftarJenisPekerjaan" :key="j" :value="j">{{ j }}</option>
            </select>
          </div>
          <div class="gc-field" style="margin-bottom:0;">
            <label>Shift</label>
            <select v-model="bulkShift">
              <option value="">-- Tidak diubah --</option>
              <option v-for="s in daftarShift" :key="s.nama_shift" :value="s.nama_shift">{{ s.nama_shift }} ({{ s.jam_masuk }} - {{ s.jam_keluar }})</option>
            </select>
          </div>
          <div class="gc-field" style="margin-bottom:0;">
            <label>Hari libur</label>
            <select v-model="bulkLibur">
              <option value="">-- Tidak diubah --</option>
              <option v-for="h in HARI_LIBUR_PILIHAN" :key="h" :value="h">{{ h }}</option>
            </select>
          </div>
        </div>
        <button @click="terapkanBulkUpdate" :disabled="memprosesBulk" class="btn-primary block" style="margin-top:14px;">
          <i class="fas fa-check-double" style="margin-right:8px;"></i> {{ memprosesBulk ? 'Memproses...' : 'Terapkan ke karyawan terpilih' }}
        </button>
      </div>

      <!-- 4. Excel Export/Import -->
      <div class="gc-card" style="margin-bottom:16px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:12px;"><i class="fas fa-file-excel" style="color:var(--ok); margin-right:8px;"></i> Edit lewat Excel</h3>
        <p style="font-size:10.5px; color:var(--text-muted); margin-bottom:12px;">Unduh data (mengikuti filter aktif), edit kolom Gudang/Shift/Hari Libur di Excel, lalu unggah ulang untuk update massal.</p>
        <div style="display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-2">
          <button @click="exportExcel" class="btn-outline filled" style="display:flex; align-items:center; justify-content:center; gap:8px;">
            <i class="fas fa-download"></i><span>Unduh Excel</span>
          </button>
          <label class="btn-outline" style="display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer;">
            <i class="fas fa-upload"></i><span>Unggah Excel</span>
            <input type="file" accept=".xlsx,.xls" @change="importExcel" class="hidden">
          </label>
        </div>
      </div>

      <div class="gc-card">
        <!-- 1. Pencarian -->
        <div style="position:relative; margin-bottom:14px;">
          <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
          <input v-model="cariNama" type="text" placeholder="Cari nama karyawan..." autocomplete="off" style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; outline:none;">
        </div>

        <!-- 2. Filter -->
        <div style="background:var(--ivory-dim); border-radius:16px; padding:14px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4 style="font-weight:700; color:var(--text-muted); font-size:12px;"><i class="fas fa-filter" style="margin-right:6px;"></i> Filter & Seleksi</h4>
            <div style="display:flex; gap:8px;">
              <button @click="pilihSemua" style="background:none; border:none; color:var(--burgundy); font-weight:700; font-size:11px; cursor:pointer;">Select All</button>
              <span style="color:var(--text-faint);">|</span>
              <button @click="bersihkanPilihan" style="background:none; border:none; color:var(--text-muted); font-weight:700; font-size:11px; cursor:pointer;">Clear All</button>
            </div>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:16px; margin-bottom:10px;">
            <label style="display:flex; align-items:center; gap:6px; font-weight:600; color:var(--text-muted); font-size:12px;"><input type="checkbox" v-model="cekSudah" style="accent-color:var(--burgundy);"> Sudah dijadwalkan</label>
            <label style="display:flex; align-items:center; gap:6px; font-weight:600; color:var(--text-muted); font-size:12px;"><input type="checkbox" v-model="cekBelum" style="accent-color:var(--burgundy);"> Belum dijadwalkan</label>
          </div>
          <div style="gap:8px;" class="grid grid-cols-2 md:grid-cols-4">
            <template v-if="isOwnerRole">
              <select v-model="filterJenisPekerjaan" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
                <option value="ALL">Semua jenis pekerjaan</option>
                <option v-for="v in daftarJenisPekerjaan" :key="v" :value="v">{{ v }}</option>
              </select>
              <select v-model="filterGudang" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
                <option value="ALL">Semua gudang</option>
                <option v-for="k in ringkasanKartu.slice(1, -1)" :key="k.nilaiFilter" :value="k.nilaiFilter">{{ k.label }}</option>
                <option value="__TANPA_GUDANG__">Tanpa gudang</option>
              </select>
            </template>
            <select v-model="filterShift" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
              <option value="ALL">Semua shift</option>
              <option v-for="s in daftarShift" :key="s.nama_shift" :value="s.nama_shift">{{ s.nama_shift }}</option>
            </select>
            <select v-model="filterLibur" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
              <option value="ALL">Semua hari libur</option>
              <option v-for="h in HARI_LIBUR_PILIHAN" :key="h" :value="h">{{ h }}</option>
            </select>
          </div>
        </div>

        <!-- Daftar Karyawan (checkbox) — kolom Karyawan di-freeze saat scroll ke samping -->
        <div class="gc-table-scroll" style="border:1px solid var(--line);">
          <table class="gc-table">
            <thead>
              <tr>
                <th class="freeze freeze-left" style="width:36px;"><input type="checkbox" :checked="headerDicentang" @change="toggleSemuaHalamanIni" style="accent-color:var(--burgundy);"></th>
                <th class="freeze freeze-left" style="left:36px;">Karyawan</th>
                <th>Jenis Pekerjaan</th>
                <th>Jenis Lokasi</th>
                <th>Gudang</th>
                <th>Shift</th>
                <th>Hari Libur</th>
                <th style="text-align:center;">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="memuat"><td colspan="8" style="text-align:center; padding:20px; color:var(--text-faint);">Memuat data...</td></tr>
              <tr v-else-if="potonganHalamanIni.length === 0"><td colspan="8" style="text-align:center; padding:20px; color:var(--text-faint);">Tidak ada karyawan yang cocok dengan filter.</td></tr>
              <tr v-for="d in potonganHalamanIni" :key="d.email">
                <td class="freeze freeze-left"><input type="checkbox" :checked="terpilih.has(d.email)" @change="toggleCheckbox(d.email)" style="accent-color:var(--burgundy);"></td>
                <td class="freeze freeze-left" style="left:36px;"><b>{{ d.nama || '-' }}</b><br><span style="font-size:10.5px; color:var(--text-muted);">{{ d.email }}</span></td>
                <td class="gc-cell-muted">{{ d.jenis_pekerjaan || '-' }}</td>
                <td>
                  <span v-if="jenisLokasiKaryawan(d) === 'Tetap'" class="tag neutral">Tetap</span>
                  <span v-else-if="jenisLokasiKaryawan(d) === 'Dinamis'" class="tag blue">Dinamis</span>
                  <span v-else-if="jenisLokasiKaryawan(d) === 'Campuran'" class="tag warn">Campuran</span>
                  <span v-else class="gc-cell-muted">-</span>
                </td>
                <td class="gc-cell-muted"><gudang-ringkas :gudang="d.gudang_penempatan" :nama="d.nama" /></td>
                <td class="gc-cell-muted">{{ d.nama_shift || '-' }}</td>
                <td class="gc-cell-muted">{{ d.hari_libur || '-' }}</td>
                <td style="text-align:center;">
                  <span v-if="statusTerjadwal(d)" class="tag ok">Sudah</span>
                  <span v-else class="tag danger">Belum</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; font-size:12px;">
          <span style="color:var(--text-faint);">{{ infoHalaman }}</span>
          <div style="display:flex; gap:8px;">
            <button @click="halamanSebelumnya" class="icon-btn"><i class="fas fa-chevron-left"></i></button>
            <button @click="halamanBerikutnya" class="icon-btn"><i class="fas fa-chevron-right"></i></button>
          </div>
        </div>
      </div>
    </div>
  `
};

let vmPenjadwalan = null;
// Perbaikan bug BESAR: komponen ini dulu langsung di-mount() begitu file ini
// dimuat (artinya SETIAP kali halaman dibuka, oleh SIAPAPUN, termasuk yang
// tidak punya akses ke layar ini) — onMounted-nya otomatis mencoba fetch
// Firestore walau orangnya tidak pernah membuka tab ini sama sekali. Itu
// yang bikin console penuh "Missing or insufficient permissions" dan baca
// Firestore boros. Sekarang mount() BARU terjadi saat dashboard.js
// pindahSubTab benar-benar memanggil window.pastikanMountPenjadwalan() —
// yaitu PERSIS saat tab ini pertama kali dibuka, bukan dari awal muat
// halaman.
window.pastikanMountPenjadwalan = function() {
  if (vmPenjadwalan) return; // sudah pernah di-mount, tidak perlu ulang
  const mountPoint = document.getElementById('vue-penjadwalan');
  if (mountPoint) vmPenjadwalan = createApp(AppPenjadwalan).mount('#vue-penjadwalan');
};
window.refreshPenjadwalan = function() { if (vmPenjadwalan) vmPenjadwalan.muat(); };
