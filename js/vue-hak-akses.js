// js/vue-hak-akses.js
// Master Karyawan > Akses & Keamanan pill Assign (Hak Akses) — pasangkan
// karyawan ke Role/profil akses, satuan maupun massal.
//
// Koleksi & field:
// - users: role (5 tingkat baku, dibaca Rules & auth.js) + profil_akses (nama
//   profil), id dokumen = email, gudang_penempatan untuk kolom Gudang.
// - akses_config: daftar profil + tingkatKeamanan-nya; DAFTAR_ROLE_BAKU cuma
//   cadangan kalau koleksi ini masih kosong.
// - master_gudang: nama_gudang untuk filter dan tampilan ringkas.
//
// Jebakan:
// - Perubahan di sini langsung berefek ke Rules (field role), tidak seperti
//   Config Akses yang cuma cetak biru izin tampilan.
// - Tabel pakai usePaginasiFirestore + filterPeran, jadi "Pilih Semua" hanya
//   mencentang baris di halaman yang tampil; centangan lintas halaman tidak
//   direset saat pindah halaman.
// - Kartu ringkasan dihitung getCountFromServer per kartu dari field role saja,
//   bukan profilEfektif — angkanya bisa beda dari badge di tabel.

import { createApp, ref, reactive, computed, watch, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, query, where, getDocs, getCountFromServer, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { GudangRingkas } from './vue-components.js';
import { usePaginasiFirestore, bangunConstraintFilterPeran } from './vue-paginasi.js';

const DAFTAR_ROLE_BAKU = ['operator', 'pic', 'admin', 'owner', 'superuser']; // cadangan kalau koleksi akses_config belum ada isinya sama sekali
const NILAI_BELUM_DIATUR = '__BELUM_DIATUR__';

function isOwnerRole() {
  return ['owner', 'superuser'].includes((window.currentUser.role || '').toLowerCase());
}

const AppHakAkses = {
  components: { GudangRingkas },
  setup() {
    const daftarGudang = ref([]);
    const DAFTAR_ROLE = ref([...DAFTAR_ROLE_BAKU]); // diisi ulang dari akses_config saat muat
    // petaTingkatKeamanan: profil (nama bebas) -> tingkat keamanan baku
    // (operator/pic/admin/owner/superuser) — INI yang ditulis ke field "role"
    // karyawan (dipakai Firestore Rules & custom claim). Nama profilnya ditulis
    // terpisah ke "profil_akses" (cari izin tampilan). Lihat vue-config-akses.js.
    const petaTingkatKeamanan = reactive({});

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
        for (const r of DAFTAR_ROLE.value) {
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

      // Daftar role diambil LANGSUNG dari koleksi akses_config yang sama dengan
      // Config Akses, jadi profil baru di sana otomatis muncul di sini tanpa ubah
      // kode. "owner" ditambahkan manual: Config Akses mengecualikannya dari yang
      // bisa diedit, tapi di Hak Akses ia tetap harus bisa dipilih sebagai role.
      try {
        const qProfil = await getDocs(collection(db, "akses_config"));
        const namaProfil = [];
        petaTingkatKeamanan.operator = 'operator';
        petaTingkatKeamanan.pic = 'pic';
        petaTingkatKeamanan.admin = 'admin';
        petaTingkatKeamanan.owner = 'owner';
        petaTingkatKeamanan.superuser = 'superuser';
        qProfil.forEach(d => {
          namaProfil.push(d.id);
          const data = d.data();
          // Fallback aman: profil lama yang dibuat SEBELUM fitur tingkatKeamanan
          // ada, anggap 'operator' (paling rendah) — supaya tidak ada yang
          // tiba-tiba dapat akses tulis lebih luas dari yang seharusnya cuma
          // karena datanya belum lengkap.
          petaTingkatKeamanan[d.id] = data.tingkatKeamanan || (DAFTAR_ROLE_BAKU.includes(d.id) ? d.id : 'operator');
        });
        const gabungan = [...new Set([...DAFTAR_ROLE_BAKU, ...namaProfil, 'owner'])].sort();
        DAFTAR_ROLE.value = gabungan;
      } catch (e) {
        console.error("Gagal sinkron daftar role dari Config Akses, pakai daftar baku:", e);
      }
    }

    async function muat() {
      terpilih.clear();
      await muatMeta();
      await Promise.all([muatRingkasan(), paginasi.muatUlang()]);
    }

    // profilEfektif: nama profil yang dipakai untuk BADGE TABEL (beda dari kartu
    // ringkasan yang pakai field role langsung). Karyawan yang sudah diatur punya
    // profil_akses tersendiri (bisa custom, mis. "admin_finance"); yang belum cuma
    // punya field role — fallback ke situ supaya tetap tampil benar.
    function profilEfektif(d) { return d.profil_akses || d.role || ''; }

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
    // kosongkan. "roleBaru" sebenarnya NAMA PROFIL, bukan tingkat keamanan, jadi
    // WAJIB tulis 2 field: "role" (dari petaTingkatKeamanan, dipakai Firestore
    // Rules) dan "profil_akses" (nama aslinya). Lihat vue-config-akses.js.
    async function ubahRoleLangsung(item, profilBaru) {
      const roleLama = item.role;
      const profilLama = item.profil_akses;
      const tingkat = profilBaru ? (petaTingkatKeamanan[profilBaru] || 'operator') : '';
      item.role = tingkat;
      item.profil_akses = profilBaru || '';
      try {
        await updateDoc(doc(db, "users", item.email), { role: tingkat, profil_akses: profilBaru || '' });
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
      const profilBaru = bulkRole.value === '__KOSONGKAN__' ? '' : bulkRole.value;
      const tingkat = profilBaru ? (petaTingkatKeamanan[profilBaru] || 'operator') : '';
      const labelKonfirmasi = profilBaru || '(dikosongkan / belum diatur)';
      if (!confirm(`Ubah Role ${daftarTerpilih.length} karyawan terpilih menjadi "${labelKonfirmasi}"?`)) return;

      memprosesBulk.value = true;
      let sukses = 0, gagal = 0;
      for (const email of daftarTerpilih) {
        try {
          await updateDoc(doc(db, "users", email), { role: tingkat, profil_akses: profilBaru });
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
      ubahRoleLangsung, profilEfektif,
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
                  <span v-if="profilEfektif(d)" class="tag pink" style="text-transform:uppercase;">{{ profilEfektif(d) }}</span>
                  <span v-else class="tag neutral">Belum diatur</span>
                </td>
                <td>
                  <select :value="profilEfektif(d)" @change="ubahRoleLangsung(d, $event.target.value)" style="padding:6px 10px; font-size:11.5px; border:1.5px solid var(--line); border-radius:8px; background:var(--surface);">
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
