// js/vue-hak-akses.js
// Master Karyawan > Akses & Keamanan pill Assign (Hak Akses) — pasangkan
// karyawan ke salah satu dari 5 role baku, satuan maupun massal.
//
// Koleksi & field:
// - users: role (5 role baku, dibaca Rules, custom claim, dan auth.js), id
//   dokumen = email, gudang_penempatan untuk kolom Gudang.
// - master_gudang: nama_gudang untuk filter dan tampilan ringkas.
//
// Jebakan:
// - DAFTAR_ROLE_BAKU adalah satu-satunya nilai sah untuk field role. Nilainya
//   wajib tanpa spasi (pic_owner) — kalau tidak, Firestore Rules dan
//   functions/index.js tidak akan pernah cocok.
// - Perubahan di sini langsung berefek ke Rules, tidak seperti Config Akses
//   yang cuma cetak biru izin tampilan.
// - profil_akses SELALU dikosongkan saat menyimpan. Sisa nilai lama di dokumen
//   membuat auth.js mencari akses_config dengan kunci profil, bukan role, jadi
//   perubahan role di sini tidak terasa apa-apa di layar.
// - Tabel pakai usePaginasiFirestore + filterPeran, jadi "Pilih Semua" hanya
//   mencentang baris di halaman yang tampil.

import { createApp, ref, reactive, computed, watch, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, query, where, getDocs, getCountFromServer, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
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
    // Daftar role TETAP, tidak lagi dibaca dari akses_config. Menambah nama
    // bebas di Config Akses tidak boleh melahirkan role baru — izin per menu
    // diatur di Config Akses, tingkat kuasanya cuma 5 ini.
    const DAFTAR_ROLE = DAFTAR_ROLE_BAKU;

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
      cariField: 'nama',
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
    watch([filterRole, filterGudang], () => paginasi.muatUlang());

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
    }

    async function muatMeta() {
      const qGudang = await getDocs(collection(db, "master_gudang"));
      const listGudang = [];
      qGudang.forEach(docSnap => listGudang.push(docSnap.data().nama_gudang));
      daftarGudang.value = listGudang;
    }

    async function muat() {
      terpilih.clear();
      await muatMeta();
      await Promise.all([muatRingkasan(), paginasi.muatUlang()]);
    }

    // Badge tabel dan kartu ringkasan sekarang membaca sumber yang SAMA (field
    // role). profil_akses sengaja diabaikan supaya nilai lama yang belum
    // tertimpa tidak menampilkan role yang berbeda dari yang dipakai Rules.
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

    // Ubah role 1 karyawan langsung dari tabel (tanpa centang+bulk); "" berarti
    // kosongkan. roleBaru sudah berupa nilai role baku apa adanya — tidak ada
    // pemetaan lagi. profil_akses ikut dikosongkan supaya auth.js memakai role
    // sebagai kunci akses_config (lihat Jebakan di blok atas).
    async function ubahRoleLangsung(item, roleBaru) {
      const roleLama = item.role;
      const profilLama = item.profil_akses;
      item.role = roleBaru || '';
      item.profil_akses = '';
      try {
        await updateDoc(doc(db, "users", item.email), { role: roleBaru || '', profil_akses: '' });
        muatRingkasan(); // angka kartu ikut berubah, tidak perlu tunggu Refresh manual
      } catch (e) {
        console.error("Gagal ubah role:", e);
        item.role = roleLama;
        item.profil_akses = profilLama;
        alert("Gagal menyimpan perubahan role.");
      }
    }

    async function terapkanBulkRole() {
      const daftarTerpilih = Array.from(terpilih);
      if (daftarTerpilih.length === 0) return alert("Belum ada karyawan yang dicentang/terpilih.");
      if (bulkRole.value === '__TIDAK_DIUBAH__') return alert("Pilih Role yang ingin diterapkan (atau \"Kosongkan\" untuk hapus role).");
      const roleBaru = bulkRole.value === '__KOSONGKAN__' ? '' : bulkRole.value;
      const labelKonfirmasi = roleBaru || '(dikosongkan / belum diatur)';
      if (!confirm(`Ubah Role ${daftarTerpilih.length} karyawan terpilih menjadi "${labelKonfirmasi}"?`)) return;

      memprosesBulk.value = true;
      let sukses = 0, gagal = 0;
      for (const email of daftarTerpilih) {
        try {
          await updateDoc(doc(db, "users", email), { role: roleBaru, profil_akses: '' });
          sukses++;
        } catch (e) {
          console.error("Gagal ubah role untuk", email, e);
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
      filterRole, filterGudang, DAFTAR_ROLE, NILAI_BELUM_DIATUR,
      railRingkasan, geserRingkasan, ringkasanKartu, memuatRingkasan, errorRingkasan, klikKartuRingkasan,
      terpilih, headerDicentang,
      toggleCheckbox, toggleSemuaHalamanIni, pilihSemua, bersihkanPilihan,
      ubahRoleLangsung, roleEfektif,
      bulkRole, memprosesBulk, terapkanBulkRole
    };
  },
  template: `
    <div>
      <div class="gc-card" style="background:var(--blue); border:none; margin-bottom:16px;">
        <h4 class="gc-heading" style="font-weight:700; font-size:13px; color:var(--teal-text);"><i class="fas fa-user-shield" style="margin-right:8px;"></i> Hak Akses</h4>
        <p style="font-size:11px; color:var(--teal-text); margin-top:4px; opacity:.85;">Hubungkan karyawan ke Role (izinnya diatur di tab Config Akses). Ubah 1 karyawan langsung lewat dropdown di tabel, atau centang beberapa lalu pakai Update Massal.</p>
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
          <div style="display:grid; gap:8px;" class="grid-cols-1 md:grid-cols-2">
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
              <tr v-if="paginasi.memuat"><td colspan="6" style="text-align:center; padding:20px; color:var(--text-faint);">Memuat data...</td></tr>
              <tr v-else-if="paginasi.errorPaginasi"><td colspan="6" style="text-align:center; padding:20px; color:var(--danger);">{{ paginasi.errorPaginasi }}</td></tr>
              <tr v-else-if="paginasi.dataHalaman.length === 0"><td colspan="6" style="text-align:center; padding:20px; color:var(--text-faint);">Tidak ada karyawan yang cocok dengan filter.</td></tr>
              <tr v-for="d in paginasi.dataHalaman" :key="d.email">
                <td class="freeze freeze-left"><input type="checkbox" :checked="terpilih.has(d.email)" @change="toggleCheckbox(d.email)" style="accent-color:var(--burgundy);"></td>
                <td class="freeze freeze-left" style="left:36px;"><b>{{ d.nama || '-' }}</b><br><span style="font-size:10.5px; color:var(--text-muted);">{{ d.email }}</span></td>
                <td class="gc-cell-muted">{{ d.jenis_pekerjaan || '-' }}</td>
                <td class="gc-cell-muted"><gudang-ringkas :gudang="d.gudang_penempatan" :nama="d.nama" /></td>
                <td style="text-align:center;">
                  <span v-if="roleEfektif(d)" class="tag pink" style="text-transform:uppercase;">{{ roleEfektif(d) }}</span>
                  <span v-else class="tag neutral">Belum diatur</span>
                </td>
                <td>
                  <select :value="roleEfektif(d)" @change="ubahRoleLangsung(d, $event.target.value)" style="padding:6px 10px; font-size:11.5px; border:1.5px solid var(--line); border-radius:8px; background:var(--surface);">
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
