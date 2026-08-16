// js/vue-hak-akses.js
// ============================================================================
// Master Karyawan > Hak Akses — hubungkan Karyawan ke Role (yang nilai
// izinnya diatur di Config Akses, js/vue-config-akses.js). Field yang
// diubah di sini adalah `role` pada dokumen users/{email} — field yang SAMA
// PERSIS dipakai window.aturTampilanBerdasarkanRole (auth.js) dan Firestore
// Security Rules — jadi mengubah Role di sini punya efek nyata & langsung,
// tidak seperti Config Akses yang baru "cetak biru" saja.
//
// Tampilan & pola interaksi (rail ringkasan bisa diklik+digeser, cari,
// filter, centang massal, Update Massal, paginasi) SENGAJA disamakan
// dengan js/vue-penjadwalan.js sesuai permintaan.
//
// Akses ke layar ini SENGAJA dibatasi khusus Owner (lihat auth.js).
// ============================================================================
import { createApp, ref, reactive, computed, watch, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const DAFTAR_ROLE = ['operator', 'pic', 'admin', 'owner', 'superuser'];
const NILAI_BELUM_DIATUR = '__BELUM_DIATUR__';
const PER_HALAMAN = 15;

const AppHakAkses = {
  setup() {
    const semuaKaryawan = ref([]);
    const daftarGudang = ref([]);
    const memuat = ref(true);

    const cariNama = ref('');
    const filterRole = ref('ALL');
    const filterGudang = ref('ALL');

    const terpilih = reactive(new Set());
    const halaman = ref(1);

    const bulkRole = ref('');
    const memprosesBulk = ref(false);

    // ---- Scroll rail ringkasan (sama seperti Penjadwalan) ----
    const railRingkasan = ref(null);
    function geserRingkasan(arah) {
      if (railRingkasan.value) railRingkasan.value.scrollBy({ left: arah * 240, behavior: 'smooth' });
    }

    async function muat() {
      memuat.value = true;
      try {
        const qKaryawan = await getDocs(collection(db, "users"));
        const list = [];
        qKaryawan.forEach(docSnap => {
          const d = docSnap.data();
          list.push({ email: docSnap.id, ...d });
        });
        semuaKaryawan.value = list;

        const qGudang = await getDocs(collection(db, "master_gudang"));
        const listGudang = [];
        qGudang.forEach(docSnap => listGudang.push(docSnap.data().nama_gudang));
        daftarGudang.value = listGudang;

        terpilih.clear();
        halaman.value = 1;
      } catch (e) {
        console.error("Gagal muat data Hak Akses:", e);
      }
      memuat.value = false;
    }

    // ---- Ringkasan per-role (kartu scroll horizontal, bisa diklik) ----
    const ringkasanKartu = computed(() => {
      const semua = semuaKaryawan.value;
      const kartu = [{ label: 'Semua', nilaiFilter: 'ALL', angka: semua.length }];
      DAFTAR_ROLE.forEach(r => {
        kartu.push({ label: r, nilaiFilter: r, angka: semua.filter(d => (d.role || '') === r).length });
      });
      kartu.push({ label: 'Belum diatur', nilaiFilter: NILAI_BELUM_DIATUR, angka: semua.filter(d => !d.role).length });
      return kartu;
    });
    // Perbaikan bug: kartu ringkasan cuma menghitung berdasarkan Role, TIDAK
    // ikut memperhitungkan filter Gudang/pencarian yang mungkin masih aktif
    // dari sebelumnya — jadi kalau keduanya digabung (Role=owner DAN
    // Gudang=tertentu), hasilnya bisa 0 walau kartu bilang 4 (Owner
    // biasanya memang tidak ditautkan ke gudang manapun). Klik kartu
    // sekarang RESET filter lain, supaya tabel selalu persis sama dengan
    // angka yang tertulis di kartunya.
    function klikKartuRingkasan(nilaiFilter) {
      filterRole.value = nilaiFilter;
      filterGudang.value = 'ALL';
      cariNama.value = '';
    }

    const hasilFilter = computed(() => {
      const kataKunci = cariNama.value.toLowerCase().trim();
      return semuaKaryawan.value.filter(d => {
        if (kataKunci && !(d.nama || '').toLowerCase().includes(kataKunci)) return false;
        if (filterRole.value === NILAI_BELUM_DIATUR) {
          if (d.role) return false;
        } else if (filterRole.value !== 'ALL' && (d.role || '') !== filterRole.value) {
          return false;
        }
        if (filterGudang.value !== 'ALL') {
          const gudangKaryawan = window.normalisasiGudang(d.gudang_penempatan);
          if (!gudangKaryawan.includes(filterGudang.value)) return false;
        }
        return true;
      });
    });

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
    function pilihSemua() { hasilFilter.value.forEach(d => terpilih.add(d.email)); }
    function bersihkanPilihan() { terpilih.clear(); }

    function halamanSebelumnya() { if (halamanAman.value > 1) halaman.value = halamanAman.value - 1; }
    function halamanBerikutnya() { if (halamanAman.value < totalHalaman.value) halaman.value = halamanAman.value + 1; }

    // Ubah role 1 karyawan langsung dari tabel (tanpa perlu centang+bulk).
    // Nilai "" (blank) berarti kosongkan/belum diatur.
    async function ubahRoleLangsung(item, roleBaru) {
      const roleLama = item.role;
      item.role = roleBaru || '';
      try {
        await updateDoc(doc(db, "users", item.email), { role: roleBaru || '' });
      } catch (e) {
        console.error("Gagal ubah role:", e);
        item.role = roleLama;
        alert("Gagal menyimpan perubahan role.");
      }
    }

    async function terapkanBulkRole() {
      const daftarTerpilih = Array.from(terpilih);
      if (daftarTerpilih.length === 0) return alert("Belum ada karyawan yang dicentang/terpilih.");
      if (bulkRole.value === '__TIDAK_DIUBAH__') return alert("Pilih Role yang ingin diterapkan (atau \"Kosongkan\" untuk hapus role).");
      const nilaiRole = bulkRole.value === '__KOSONGKAN__' ? '' : bulkRole.value;
      const labelKonfirmasi = nilaiRole || '(dikosongkan / belum diatur)';
      if (!confirm(`Ubah Role ${daftarTerpilih.length} karyawan terpilih menjadi "${labelKonfirmasi}"?`)) return;

      memprosesBulk.value = true;
      let sukses = 0, gagal = 0;
      for (const email of daftarTerpilih) {
        try {
          await updateDoc(doc(db, "users", email), { role: nilaiRole });
          sukses++;
        } catch (e) {
          console.error("Gagal ubah role untuk", email, e);
          gagal++;
        }
      }
      memprosesBulk.value = false;
      alert(`Update massal selesai. Berhasil: ${sukses}, Gagal: ${gagal}.`);
      bulkRole.value = '__TIDAK_DIUBAH__';
      await muat();
    }

    onMounted(async () => { await window.authReady; muat(); });

    return {
      semuaKaryawan, daftarGudang, memuat, muat,
      cariNama, filterRole, filterGudang, DAFTAR_ROLE, NILAI_BELUM_DIATUR,
      railRingkasan, geserRingkasan, ringkasanKartu, klikKartuRingkasan,
      terpilih, hasilFilter, potonganHalamanIni, infoHalaman, headerDicentang, halamanAman, totalHalaman,
      toggleCheckbox, toggleSemuaHalamanIni, pilihSemua, bersihkanPilihan,
      halamanSebelumnya, halamanBerikutnya,
      ubahRoleLangsung,
      bulkRole, memprosesBulk, terapkanBulkRole
    };
  },
  template: `
    <div>
      <div class="gc-card" style="background:var(--blue); border:none; margin-bottom:16px;">
        <h4 class="gc-heading" style="font-weight:700; font-size:13px; color:#1F5060;"><i class="fas fa-user-shield" style="margin-right:8px;"></i> Hak Akses</h4>
        <p style="font-size:11px; color:#1F5060; margin-top:4px; opacity:.85;">Hubungkan karyawan ke Role (izinnya diatur di tab Config Akses). Ubah 1 karyawan langsung lewat dropdown di tabel, atau centang beberapa lalu pakai Update Massal.</p>
      </div>

      <!-- Rail ringkasan per-role -->
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
        <button @click="geserRingkasan(-1)" class="icon-btn" style="flex-shrink:0;" aria-label="Geser kiri"><i class="fas fa-chevron-left"></i></button>
        <div ref="railRingkasan" style="display:flex; gap:12px; overflow-x:auto; padding-bottom:8px; scroll-behavior:smooth;" class="no-scrollbar">
          <div v-for="k in ringkasanKartu" :key="k.nilaiFilter"
               @click="klikKartuRingkasan(k.nilaiFilter)"
               style="flex-shrink:0; width:130px; background:var(--surface); padding:14px; border-radius:16px; cursor:pointer; transition:.15s;"
               :style="filterRole === k.nilaiFilter ? 'border:2px solid var(--burgundy); box-shadow:0 4px 10px rgba(110,30,44,.1);' : 'border:1px solid var(--line);'">
            <h4 style="font-size:11.5px; font-weight:700; color:var(--text); text-transform:uppercase; margin-bottom:8px;">{{ k.label }}</h4>
            <div class="num" style="font-family:'Poppins',sans-serif; font-size:22px; font-weight:700; color:var(--burgundy);">{{ k.angka }}</div>
          </div>
        </div>
        <button @click="geserRingkasan(1)" class="icon-btn" style="flex-shrink:0;" aria-label="Geser kanan"><i class="fas fa-chevron-right"></i></button>
      </div>

      <!-- Update Massal -->
      <div class="gc-card" style="margin-bottom:16px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:12px;"><i class="fas fa-layer-group" style="color:var(--burgundy); margin-right:8px;"></i> Update massal ({{ terpilih.size }} karyawan terpilih)</h3>
        <div style="display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
          <div class="gc-field" style="margin-bottom:0; flex:1; min-width:200px;">
            <label>Role baru</label>
            <select v-model="bulkRole">
              <option value="__TIDAK_DIUBAH__">-- Pilih role --</option>
              <option value="__KOSONGKAN__">(Kosongkan / belum diatur)</option>
              <option v-for="r in DAFTAR_ROLE" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
          <button @click="terapkanBulkRole" :disabled="memprosesBulk" class="btn-primary" style="white-space:nowrap;">
            <i class="fas fa-check-double" style="margin-right:8px;"></i> {{ memprosesBulk ? 'Memproses...' : 'Terapkan ke karyawan terpilih' }}
          </button>
        </div>
      </div>

      <div class="gc-card">
        <!-- Pencarian -->
        <div style="position:relative; margin-bottom:14px;">
          <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
          <input v-model="cariNama" type="text" placeholder="Cari nama karyawan..." autocomplete="off" style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; outline:none;">
        </div>

        <!-- Filter -->
        <div style="background:var(--ivory-dim); border-radius:16px; padding:14px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4 style="font-weight:700; color:var(--text-muted); font-size:12px;"><i class="fas fa-filter" style="margin-right:6px;"></i> Filter & Seleksi</h4>
            <div style="display:flex; gap:8px;">
              <button @click="pilihSemua" style="background:none; border:none; color:var(--burgundy); font-weight:700; font-size:11px; cursor:pointer;">Select All</button>
              <span style="color:var(--text-faint);">|</span>
              <button @click="bersihkanPilihan" style="background:none; border:none; color:var(--text-muted); font-weight:700; font-size:11px; cursor:pointer;">Clear All</button>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <select v-model="filterRole" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
              <option value="ALL">Semua role</option>
              <option :value="NILAI_BELUM_DIATUR">(Belum diatur)</option>
              <option v-for="r in DAFTAR_ROLE" :key="r" :value="r">{{ r }}</option>
            </select>
            <select v-model="filterGudang" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
              <option value="ALL">Semua gudang</option>
              <option v-for="g in daftarGudang" :key="g" :value="g">{{ g }}</option>
            </select>
          </div>
        </div>

        <!-- Tabel -->
        <div class="gc-table-scroll" style="border:1px solid var(--line);">
          <table class="gc-table">
            <thead>
              <tr>
                <th class="freeze freeze-left" style="width:36px;"><input type="checkbox" :checked="headerDicentang" @change="toggleSemuaHalamanIni" style="accent-color:var(--burgundy);"></th>
                <th class="freeze freeze-left" style="left:36px;">Karyawan</th>
                <th>Jenis Pekerjaan</th>
                <th>Gudang</th>
                <th style="text-align:center;">Role saat ini</th>
                <th>Ubah Role</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="memuat"><td colspan="6" style="text-align:center; padding:20px; color:var(--text-faint);">Memuat data...</td></tr>
              <tr v-else-if="potonganHalamanIni.length === 0"><td colspan="6" style="text-align:center; padding:20px; color:var(--text-faint);">Tidak ada karyawan yang cocok dengan filter.</td></tr>
              <tr v-for="d in potonganHalamanIni" :key="d.email">
                <td class="freeze freeze-left"><input type="checkbox" :checked="terpilih.has(d.email)" @change="toggleCheckbox(d.email)" style="accent-color:var(--burgundy);"></td>
                <td class="freeze freeze-left" style="left:36px;"><b>{{ d.nama || '-' }}</b><br><span style="font-size:10.5px; color:var(--text-muted);">{{ d.email }}</span></td>
                <td class="gc-cell-muted">{{ d.jenis_pekerjaan || '-' }}</td>
                <td class="gc-cell-muted">{{ window.normalisasiGudang(d.gudang_penempatan).join(', ') || '-' }}</td>
                <td style="text-align:center;">
                  <span v-if="d.role" class="tag pink" style="text-transform:uppercase;">{{ d.role }}</span>
                  <span v-else class="tag neutral">Belum diatur</span>
                </td>
                <td>
                  <select :value="d.role || ''" @change="ubahRoleLangsung(d, $event.target.value)" style="padding:6px 10px; font-size:11.5px; border:1.5px solid var(--line); border-radius:8px; background:var(--surface);">
                    <option value="">(Belum diatur)</option>
                    <option v-for="r in DAFTAR_ROLE" :key="r" :value="r">{{ r }}</option>
                  </select>
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

const mountPoint = document.getElementById('vue-hak-akses');
if (mountPoint) {
  const vm = createApp(AppHakAkses).mount('#vue-hak-akses');
  window.refreshHakAkses = function() { vm.muat(); };
}
