// js/vue-hak-akses.js
// Master Karyawan > Akses & Keamanan pill Assign — pasangkan karyawan ke
// JABATAN, satuan maupun massal. Role tidak dipilih di sini.
//
// Koleksi & field:
// - users: jabatan, plus role & jenis_pekerjaan yang DISALIN dari jabatan itu
//   (Rules & custom claim membaca users, bukan jabatan). nama_lower untuk cari.
// - akses_jabatan/{jabatan}: sumber role + jenis_pekerjaan tiap jabatan.
// - master_data/jabatan: daftar nama jabatan. master_gudang: kolom Gudang.
//
// Jebakan:
// - Jabatan yang BELUM diatur di pill Jabatan tidak punya role/jenis_pekerjaan,
//   jadi tidak bisa dipasang di sini — atur dulu di sana, kalau dipaksa role
//   karyawan jadi kosong dan Firestore Rules menolak semuanya.
// - Nilai role wajib tanpa spasi (pic_owner), kalau tidak tidak akan pernah
//   cocok dengan firestore.rules maupun functions/index.js.
// - profil_akses SELALU dikosongkan saat menyimpan; field itu sudah pensiun.
// - Tabel pakai usePaginasiFirestore + filterPeran, jadi "Pilih Semua" hanya
//   mencentang baris di halaman yang tampil.

import { createApp, ref, reactive, computed, watch, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, query, where, getDocs, getDoc, getCountFromServer, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { GudangRingkas } from './vue-components.js';
import { usePaginasiFirestore, bangunConstraintFilterPeran } from './vue-paginasi.js';

const DAFTAR_ROLE_BAKU = ['operator', 'admin', 'pic', 'pic_owner', 'owner']; // 5 role baku, satu-satunya nilai sah untuk field `role`
const NILAI_BELUM_DIATUR = '__BELUM_DIATUR__';

function isOwnerRole() {
  return ['owner', 'pic_owner'].includes((window.currentUser.role || '').toLowerCase());
}

const AppHakAkses = {
  components: { GudangRingkas },
  setup() {
    const daftarGudang = ref([]);
    const DAFTAR_ROLE = DAFTAR_ROLE_BAKU; // cuma untuk kartu ringkasan & filter role
    const daftarJabatan = ref([]);
    // petaJabatan: nama jabatan -> { role, jenis_pekerjaan } dari akses_jabatan.
    // Jabatan yang belum diatur di pill Jabatan TIDAK masuk peta ini.
    const petaJabatan = reactive({});
    const filterJabatan = ref('ALL');

    const ringkasanKartu = ref([]);
    const memuatRingkasan = ref(true);
    const errorRingkasan = ref('');

    const filterRole = ref('ALL');
    const filterGudang = ref('ALL');

    const terpilih = reactive(new Set());

    const bulkRole = ref('');
    const memprosesBulk = ref(false);

    // Scroll rail ringkasan (sama seperti Penjadwalan)
    const railRingkasan = ref(null);
    function geserRingkasan(arah) {
      if (railRingkasan.value) railRingkasan.value.scrollBy({ left: arah * 240, behavior: 'smooth' });
    }

    // TABEL: paginasi cursor Firestore sungguhan
    const paginasi = reactive(usePaginasiFirestore(db, 'users', {
      perHalaman: 15,
      urutkanField: 'nama',
      cariField: 'nama_lower',
      cariHurufKecil: true,
      constraintTambahan: () => {
        // Dimensi jenis pekerjaan dari filterPeran dipakai manual di sini
        // (fieldGudang:null) supaya bisa digabung fleksibel dengan filterGudang
        // tanpa bentrok "cuma boleh 1 operator array per query" punya Firestore
        // (array-contains DAN array-contains-any tidak boleh dipakai bersamaan).
        const cs = [...bangunConstraintFilterPeran({ fieldGudang: null })];
        // cuma tampilkan karyawan yang status_kerja-nya "Aktif". Karyawan
        // nonaktif/resign tidak perlu muncul di Hak Akses (tidak relevan diatur
        // role-nya).
        cs.push(where('status_kerja', '==', 'Aktif'));
        if (filterGudang.value !== 'ALL') {
          cs.push(where('gudang_penempatan', 'array-contains', filterGudang.value));
        } else if (!isOwnerRole()) {
          const gudangAdmin = window.normalisasiGudang(window.currentUser.gudang_penempatan);
          if (gudangAdmin.length > 0) cs.push(where('gudang_penempatan', 'array-contains-any', gudangAdmin.slice(0, 10)));
        }
        if (filterJabatan.value !== 'ALL') cs.push(where('jabatan', '==', filterJabatan.value));
        if (filterRole.value === NILAI_BELUM_DIATUR) {
          // Keterbatasan: cuma cocok dokumen yang field role-nya PERSIS string
          // kosong. Dokumen lama yang field role-nya HILANG TOTAL (bukan string
          // kosong) tidak akan ketemu lewat where ini.
          cs.push(where('role', '==', ''));
        } else if (filterRole.value !== 'ALL') {
          cs.push(where('role', '==', filterRole.value));
        }
        return cs;
      },
      petakan: (id, d) => ({ email: id, ...d })
    }));
    watch([filterRole, filterGudang, filterJabatan], () => paginasi.muatUlang());

    // KARTU RINGKASAN: getCountFromServer terpisah per kartu
    async function muatRingkasan() {
      memuatRingkasan.value = true;
      errorRingkasan.value = '';
      try {
        const csDasar = [...bangunConstraintFilterPeran({ fieldGudang: null })];
        csDasar.push(where('status_kerja', '==', 'Aktif')); // sinkron dengan filter tabel utama
        if (!isOwnerRole()) {
          const gudangAdmin = window.normalisasiGudang(window.currentUser.gudang_penempatan);
          if (gudangAdmin.length > 0) csDasar.push(where('gudang_penempatan', 'array-contains-any', gudangAdmin.slice(0, 10)));
        }
        const snapSemua = await getCountFromServer(query(collection(db, 'users'), ...csDasar));
        const kartu = [{ label: 'Semua', nilaiFilter: 'ALL', angka: snapSemua.data().count }];
        for (const r of DAFTAR_ROLE) {
          const snap = await getCountFromServer(query(collection(db, 'users'), ...csDasar, where('role', '==', r)));
          kartu.push({ label: r, nilaiFilter: r, angka: snap.data().count });
        }
        const snapKosong = await getCountFromServer(query(collection(db, 'users'), ...csDasar, where('role', '==', '')));
        kartu.push({ label: 'Belum diatur', nilaiFilter: NILAI_BELUM_DIATUR, angka: snapKosong.data().count });
        ringkasanKartu.value = kartu;
      } catch (e) {
        console.error('Gagal muat ringkasan Hak Akses:', e);
        // Error WAJIB tampil ke layar, bukan cuma console.error: tanpa itu area
        // Ringkasan jadi blank total kalau query gagal (paling sering karena butuh
        // index Firestore gabungan yang belum dibuat, sebab query di atas
        // menggabung beberapa where sekaligus).
        errorRingkasan.value = e.code === 'failed-precondition'
          ? 'Ringkasan gagal dimuat — butuh index Firestore baru. Buka Console browser (F12), cari link "Create composite index" dari error ini, klik untuk bikin index-nya sekali.'
          : 'Ringkasan gagal dimuat (' + (e.code || e.message) + ').';
      }
      memuatRingkasan.value = false;
    }

    function klikKartuRingkasan(nilaiFilter) {
      filterRole.value = nilaiFilter;
      filterGudang.value = 'ALL';
      filterJabatan.value = 'ALL';
    }

    async function muatMeta() {
      const qGudang = await getDocs(collection(db, "master_gudang"));
      const listGudang = [];
      qGudang.forEach(docSnap => listGudang.push(docSnap.data().nama_gudang));
      daftarGudang.value = listGudang;

      const snapMaster = await getDoc(doc(db, 'master_data', 'jabatan'));
      daftarJabatan.value = snapMaster.exists() ? (snapMaster.data().items || []) : [];

      Object.keys(petaJabatan).forEach(k => delete petaJabatan[k]);
      const snapAkses = await getDocs(collection(db, 'akses_jabatan'));
      snapAkses.forEach(d => {
        const x = d.data();
        if (x.nama && x.role) petaJabatan[x.nama] = { role: x.role, jenis_pekerjaan: x.jenis_pekerjaan || '' };
      });
    }

    function jabatanSiap(nama) { return !!petaJabatan[nama]; }

    async function muat() {
      terpilih.clear();
      await muatMeta();
      await Promise.all([muatRingkasan(), paginasi.muatUlang()]);
    }

    // Badge tabel dan kartu ringkasan membaca sumber yang SAMA (field role di
    // users), yaitu salinan dari jabatan. profil_akses sudah pensiun.
    function roleEfektif(d) { return d.role || ''; }

    const headerDicentang = computed(() =>
      paginasi.dataHalaman.length > 0 && paginasi.dataHalaman.every(d => terpilih.has(d.email))
    );
    function toggleCheckbox(email) {
      if (terpilih.has(email)) terpilih.delete(email);
      else terpilih.add(email);
    }
    function toggleSemuaHalamanIni() {
      const dicentangSemua = headerDicentang.value;
      paginasi.dataHalaman.forEach(d => {
        if (dicentangSemua) terpilih.delete(d.email); else terpilih.add(d.email);
      });
    }
    // "pilihSemua" cuma memilih baris di HALAMAN yang sedang tampil, bukan semua
    // yang cocok filter lintas halaman. Nama fungsi dipertahankan supaya titik
    // panggil di template tidak perlu ikut berubah.
    function pilihSemua() { paginasi.dataHalaman.forEach(d => terpilih.add(d.email)); }
    function bersihkanPilihan() { terpilih.clear(); }

    // Ubah jabatan 1 karyawan langsung dari tabel; "" berarti kosongkan. role dan
    // jenis_pekerjaan DISALIN dari jabatan, tidak pernah diketik di sini.
    async function ubahJabatanLangsung(item, jabatanBaru) {
      if (jabatanBaru && !jabatanSiap(jabatanBaru)) {
        alert(`Jabatan "${jabatanBaru}" belum diatur di pill Jabatan (belum punya Role dan Jenis Usaha). Atur dulu di sana.`);
        paginasi.muatUlang();
        return;
      }
      const lama = { jabatan: item.jabatan, role: item.role, jenis_pekerjaan: item.jenis_pekerjaan };
      const def = jabatanBaru ? petaJabatan[jabatanBaru] : { role: '', jenis_pekerjaan: '' };
      item.jabatan = jabatanBaru || '';
      item.role = def.role;
      item.jenis_pekerjaan = def.jenis_pekerjaan;
      try {
        await updateDoc(doc(db, "users", item.email), {
          jabatan: jabatanBaru || '', role: def.role, jenis_pekerjaan: def.jenis_pekerjaan, profil_akses: ''
        });
        muatRingkasan(); // angka kartu ikut berubah, tidak perlu tunggu Refresh manual
      } catch (e) {
        console.error("Gagal ubah jabatan:", e);
        item.jabatan = lama.jabatan;
        item.role = lama.role;
        item.jenis_pekerjaan = lama.jenis_pekerjaan;
        alert("Gagal menyimpan perubahan jabatan.");
      }
    }

    async function terapkanBulkRole() {
      const daftarTerpilih = Array.from(terpilih);
      if (daftarTerpilih.length === 0) return alert("Belum ada karyawan yang dicentang/terpilih.");
      if (bulkRole.value === '__TIDAK_DIUBAH__') return alert("Pilih Jabatan yang ingin diterapkan (atau \"Kosongkan\").");
      const jabatanBaru = bulkRole.value === '__KOSONGKAN__' ? '' : bulkRole.value;
      if (jabatanBaru && !jabatanSiap(jabatanBaru)) {
        return alert(`Jabatan "${jabatanBaru}" belum diatur di pill Jabatan. Atur Role dan Jenis Usaha-nya dulu di sana.`);
      }
      const def = jabatanBaru ? petaJabatan[jabatanBaru] : { role: '', jenis_pekerjaan: '' };
      const labelKonfirmasi = jabatanBaru || '(dikosongkan / belum diatur)';
      if (!confirm(`Ubah Jabatan ${daftarTerpilih.length} karyawan terpilih menjadi "${labelKonfirmasi}" (role ${def.role || '-'}, usaha ${def.jenis_pekerjaan || '-'})?`)) return;

      memprosesBulk.value = true;
      let sukses = 0, gagal = 0;
      for (const email of daftarTerpilih) {
        try {
          await updateDoc(doc(db, "users", email), {
            jabatan: jabatanBaru, role: def.role, jenis_pekerjaan: def.jenis_pekerjaan, profil_akses: ''
          });
          sukses++;
        } catch (e) {
          console.error("Gagal ubah jabatan untuk", email, e);
          gagal++;
        }
      }
      memprosesBulk.value = false;
      alert(`Update massal selesai. Berhasil: ${sukses}, Gagal: ${gagal}.`);
      bulkRole.value = '__TIDAK_DIUBAH__';
      terpilih.clear();
      await Promise.all([muatRingkasan(), paginasi.muatUlang()]);
    }

    onMounted(async () => { await window.authReady; muat(); });

    return {
      paginasi, daftarGudang,
      cariNama: computed({ get: () => paginasi.cariTeks, set: (v) => paginasi.cariDenganDebounce(v) }),
      filterRole, filterGudang, filterJabatan, DAFTAR_ROLE, daftarJabatan, jabatanSiap, NILAI_BELUM_DIATUR,
      railRingkasan, geserRingkasan, ringkasanKartu, memuatRingkasan, errorRingkasan, klikKartuRingkasan,
      terpilih, headerDicentang,
      toggleCheckbox, toggleSemuaHalamanIni, pilihSemua, bersihkanPilihan,
      ubahJabatanLangsung, roleEfektif,
      bulkRole, memprosesBulk, terapkanBulkRole
    };
  },
  template: `
    <div>
      <div class="gc-card" style="background:var(--blue); border:none; margin-bottom:16px;">
        <h4 class="gc-heading" style="font-weight:700; font-size:13px; color:var(--teal-text);"><i class="fas fa-user-shield" style="margin-right:8px;"></i> Hak Akses</h4>
        <p style="font-size:11px; color:var(--teal-text); margin-top:4px; opacity:.85;">Pasang <b>Jabatan</b> ke karyawan — Role dan Jenis Usaha ikut otomatis dari jabatan itu. Ubah 1 karyawan langsung lewat dropdown di tabel, atau centang beberapa lalu pakai Update Massal. Jabatan baru diatur dulu di pill Jabatan.</p>
      </div>

      <!-- Rail ringkasan per-role -->
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
        <button @click="geserRingkasan(-1)" class="icon-btn" style="flex-shrink:0;" aria-label="Geser kiri"><i class="fas fa-chevron-left"></i></button>
        <div ref="railRingkasan" style="display:flex; gap:12px; overflow-x:auto; padding-bottom:8px; scroll-behavior:smooth;" class="no-scrollbar">
          <div v-if="memuatRingkasan" style="flex-shrink:0; width:130px; text-align:center; color:var(--text-faint); font-size:11px; padding:20px 0;">Menghitung...</div>
          <div v-else-if="errorRingkasan" style="flex-shrink:0; width:280px; background:var(--danger-light); color:var(--danger); font-size:11px; padding:12px 14px; border-radius:14px;">{{ errorRingkasan }}</div>
          <div v-for="k in ringkasanKartu" :key="k.nilaiFilter"
               @click="klikKartuRingkasan(k.nilaiFilter)"
               style="flex-shrink:0; width:130px; background:var(--surface); padding:14px; border-radius:16px; cursor:pointer; transition:.15s;"
               :style="filterRole === k.nilaiFilter ? 'border:2px solid var(--burgundy); box-shadow:0 4px 10px rgba(var(--burgundy-rgb),.1);' : 'border:1px solid var(--line);'">
            <h4 style="font-size:11.5px; font-weight:700; color:var(--text); text-transform:uppercase; margin-bottom:8px;">{{ k.label }}</h4>
            <div class="num" style="font-family:'Poppins',sans-serif; font-size:22px; font-weight:700; color:var(--burgundy);">{{ k.angka }}</div>
          </div>
        </div>
        <button @click="geserRingkasan(1)" class="icon-btn" style="flex-shrink:0;" aria-label="Geser kanan"><i class="fas fa-chevron-right"></i></button>
      </div>

      <!-- Massal -->
      <div class="gc-card" style="margin-bottom:16px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; border-bottom:1px solid var(--line); padding-bottom:10px; margin-bottom:12px;"><i class="fas fa-layer-group" style="color:var(--burgundy); margin-right:8px;"></i> Update massal ({{ terpilih.size }} karyawan terpilih)</h3>
        <div style="display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
          <div class="gc-field" style="margin-bottom:0; flex:1; min-width:200px;">
            <label>Jabatan baru</label>
            <select v-model="bulkRole">
              <option value="__TIDAK_DIUBAH__">-- Pilih jabatan --</option>
              <option value="__KOSONGKAN__">(Kosongkan / belum diatur)</option>
              <option v-for="j in daftarJabatan" :key="j" :value="j" :disabled="!jabatanSiap(j)">{{ j }}{{ jabatanSiap(j) ? '' : ' — belum diatur' }}</option>
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
          <input :value="paginasi.cariTeks" @input="paginasi.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari nama karyawan (awalan nama)..." autocomplete="off" style="width:100%; padding:9px 13px 9px 34px; background:var(--ivory-dim); border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; outline:none;">
        </div>

        <!-- Filter -->
        <div style="background:var(--ivory-dim); border-radius:16px; padding:14px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4 style="font-weight:700; color:var(--text-muted); font-size:12px;"><i class="fas fa-filter" style="margin-right:6px;"></i> Filter & Seleksi</h4>
            <div style="display:flex; gap:8px;">
              <button @click="pilihSemua" style="background:none; border:none; color:var(--burgundy); font-weight:700; font-size:11px; cursor:pointer;">Pilih Semua (halaman ini)</button>
              <span style="color:var(--text-faint);">|</span>
              <button @click="bersihkanPilihan" style="background:none; border:none; color:var(--text-muted); font-weight:700; font-size:11px; cursor:pointer;">Clear All</button>
            </div>
          </div>
          <div style="display:grid; gap:8px;" class="grid-cols-1 md:grid-cols-3">
            <select v-model="filterJabatan" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
              <option value="ALL">Semua jabatan</option>
              <option v-for="j in daftarJabatan" :key="j" :value="j">{{ j }}</option>
            </select>
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
                <th style="text-align:center;">Jabatan / Role</th>
                <th>Ubah Jabatan</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="paginasi.memuat"><td colspan="6" style="text-align:center; padding:20px; color:var(--text-faint);">Memuat data...</td></tr>
              <tr v-else-if="paginasi.errorPaginasi"><td colspan="6" style="text-align:center; padding:20px; color:var(--danger);">{{ paginasi.errorPaginasi }}</td></tr>
              <tr v-else-if="paginasi.dataHalaman.length === 0"><td colspan="6" style="text-align:center; padding:20px; color:var(--text-faint);">Tidak ada karyawan yang cocok dengan filter.</td></tr>
              <tr v-for="d in paginasi.dataHalaman" :key="d.email">
                <td class="freeze freeze-left"><input type="checkbox" :checked="terpilih.has(d.email)" @change="toggleCheckbox(d.email)" style="accent-color:var(--burgundy);"></td>
                <td class="freeze freeze-left" style="left:36px;"><b>{{ d.nama || '-' }}</b><br><span style="font-size:10.5px; color:var(--text-muted);">{{ d.email }}</span></td>
                <td class="gc-cell-muted">{{ d.jenis_pekerjaan || '-' }}</td>
                <td class="gc-cell-muted"><gudang-ringkas :gudang="d.gudang_penempatan" :nama="d.nama" /></td>
                <td style="text-align:center;">
                  <span v-if="d.jabatan" class="tag pink">{{ d.jabatan }}</span>
                  <span v-else class="tag neutral">Belum diatur</span>
                  <br><span style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">{{ roleEfektif(d) || '-' }}</span>
                </td>
                <td>
                  <select :value="d.jabatan || ''" @change="ubahJabatanLangsung(d, $event.target.value)" style="padding:6px 10px; font-size:11.5px; border:1.5px solid var(--line); border-radius:8px; background:var(--surface);">
                    <option value="">(Belum diatur)</option>
                    <option v-for="j in daftarJabatan" :key="j" :value="j" :disabled="!jabatanSiap(j)">{{ j }}{{ jabatanSiap(j) ? '' : ' — belum diatur' }}</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; font-size:12px;">
          <span style="color:var(--text-faint);">Halaman {{ paginasi.nomorHalaman }}</span>
          <div style="display:flex; gap:8px;">
            <button @click="paginasi.halamanSebelumnya" :disabled="paginasi.nomorHalaman <= 1 || paginasi.memuat" class="icon-btn"><i class="fas fa-chevron-left"></i></button>
            <button @click="paginasi.halamanBerikutnya" :disabled="!paginasi.adaBerikutnya || paginasi.memuat" class="icon-btn"><i class="fas fa-chevron-right"></i></button>
          </div>
        </div>
      </div>
    </div>
  `
};

let vmHakAkses = null;
// Komponen ini TIDAK di-mount saat file dimuat. Mount baru terjadi ketika
// dashboard.js pindahSubTab memanggil window.pastikanMountHakAkses, yaitu saat
// tab ini pertama kali dibuka. Mount di awal membuat onMounted fetch Firestore
// untuk siapapun: "Missing or insufficient permissions" dan baca Firestore boros.
window.pastikanMountHakAkses = function() {
  if (vmHakAkses) { if (typeof vmHakAkses.muat === 'function') vmHakAkses.muat(); return; }
  const mountPoint = document.getElementById('vue-hak-akses');
  if (mountPoint) vmHakAkses = createApp(AppHakAkses).mount('#vue-hak-akses');
};
window.refreshHakAkses = function() { if (vmHakAkses) vmHakAkses.muat(); };
