// js/vue-paginasi.js
// ============================================================================
// usePaginasiFirestore — composable Vue untuk paginasi Firestore SUNGGUHAN
// (cursor-based, bukan "ambil semua lalu potong di JS"). Dipakai lewat
// import, BUKAN komponen UI — tiap tabel tetap render kolomnya sendiri,
// cuma LOGIC ambil-datanya yang dipakai bersama di sini.
//
// AturanTABEL SERAGAM di app ini mulai sekarang (baca sebelum bikin layar
// tabel baru):
//   1. Browsing polos (tanpa cari/filter)     -> paginasi biasa (hemat)
//   2. Filter dropdown pilihan tetap aktif    -> paginasi + where() (masih
//      hemat, selama filternya cuma SATU jenis dalam satu waktu)
//   3. Kotak cari (nama dsb) diisi            -> paginasi + pencarian
//      AWALAN (prefix match) via cariTeks/cariField di bawah (masih hemat)
//   4. Filter dropdown + cari AKTIF BERSAMAAN  -> BALIK ke cara lama (fetch
//      semua, filter di JS) — Firestore butuh "index gabungan" khusus
//      untuk tiap kombinasi where()+orderBy(), bikin index utk SEMUA
//      kemungkinan kombinasi filter itu tidak praktis. Ini SATU-SATUNYA
//      kondisi yang masih boros, dan itu sudah paling jarang terjadi.
//
// KETERBATASAN pencarian awalan (prefix search) — WAJIB tahu sebelum pakai:
//   - Firestore TIDAK BISA cari "teks di TENGAH nama", cuma "nama yang
//     DIAWALI teks ini" (mirip autocomplete, bukan mirip Ctrl+F).
//   - PEKA HURUF BESAR/KECIL (case-sensitive) — cari "budi" TIDAK akan
//     ketemu kalau tersimpan "Budi". Kalau field yang dicari nilainya
//     tidak konsisten kapitalisasinya, pertimbangkan simpan field
//     tambahan huruf-kecil-semua (mis. nama_lower) khusus buat dicari.
//
// Cara pakai dasar:
//   import { usePaginasiFirestore } from './vue-paginasi.js';
//   const paginasi = usePaginasiFirestore(db, 'users', {
//     perHalaman: 15,
//     urutkanField: 'nama',
//     cariField: 'nama',              // opsional, aktifkan kotak cari awalan
//     petakan: (id, d) => ({ id, ...d })
//   });
//   onMounted(() => paginasi.muatUlang());
//   // Template kotak cari (WAJIB pakai pola ini, BUKAN v-model biasa,
//   // supaya query Firestore didebounce 400ms — tidak nembak server di
//   // SETIAP ketukan huruf):
//   //   <input :value="paginasi.cariTeks"
//   //          @input="paginasi.cariDenganDebounce($event.target.value)">
//
// Cara pakai dengan filter dropdown pilihan tetap (opsional):
//   const filterRole = ref('ALL');
//   const paginasi = usePaginasiFirestore(db, 'users', {
//     ...,
//     constraintTambahan: () => filterRole.value === 'ALL' ? [] : [where('role', '==', filterRole.value)]
//   });
//   watch(filterRole, () => paginasi.muatUlang());
//
// PEDOMAN KERJA (18 Agt 2026) — filter otomatis role+jenis_pekerjaan+gudang:
//   const paginasi = usePaginasiFirestore(db, 'users', {
//     ...,
//     filterPeran: true   // cukup ini, TIDAK PERLU tulis where() manual
//   });
// Tabel BARU yang nampilin data karyawan/gudang WAJIB pakai opsi ini dari
// awal (sama seperti aturan §6.8 "menu baru default Owner-only" di
// STATUS-PROYEK.md) — TIDAK PERLU tulis ulang filternya tiap tabel.
//
// PENTING beda dari window.bolehLihatData (auth.js, dipakai tabel yang
// MASIH fetch-semua): fungsi itu client-side & PUNYA jatuh-aman (data
// belum ditag tetap tampil). Filter DI SINI jalan lewat where()
// Firestore SUNGGUHAN (server-side) — TIDAK PUNYA jatuh-aman, karena
// where() Firestore cuma bisa cocokkan field yang ADA nilainya.
// Karyawan/gudang lama yang BELUM ditag jenis_pekerjaan/gudang TIDAK
// AKAN muncul sampai ditag. Trade-off SADAR, disepakati 18 Agt 2026 demi
// paginasi cursor sungguhan tetap jalan benar (filter di JS SETELAH
// ambil per halaman akan merusak hitungan "ada halaman berikutnya").
//
// Kemungkinan besar Firestore minta INDEX GABUNGAN BARU pertama kali opsi
// ini dipakai di koleksi tertentu — errornya muncul di Console browser
// lengkap dengan LINK buat bikin index itu sekali klik (bukan bug, itu
// memang cara kerja Firestore untuk query gabungan where()+where()+orderBy()).
// ============================================================================
import { ref } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, query, orderBy, limit, startAfter, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Diekspor juga (bukan cuma dipakai internal composable ini) supaya kode
// yang MASIH fetch-semua manual (belum sempat dimigrasi ke paginasi) bisa
// pakai pola filter YANG SAMA tanpa tulis ulang logicnya — lihat
// STATUS-PROYEK.md soal daftar tabel yang masih perlu dimigrasi.
export function bangunConstraintFilterPeran(opsiField = {}) {
  const fieldJenisPekerjaan = opsiField.fieldJenisPekerjaan || 'jenis_pekerjaan';
  const fieldGudang = opsiField.fieldGudang === undefined ? 'gudang_penempatan' : opsiField.fieldGudang; // null = koleksi ini tidak punya dimensi gudang (mis. master_shift)
  const role = (window.currentUser.role || '').toLowerCase();
  if (role === 'owner' || role === 'superuser') return [];
  const constraints = [];
  if (window.currentUser.jenis_pekerjaan) {
    constraints.push(where(fieldJenisPekerjaan, '==', window.currentUser.jenis_pekerjaan));
  }
  if (fieldGudang) {
    const gudangAdmin = window.normalisasiGudang(window.currentUser.gudang_penempatan);
    if (gudangAdmin.length > 0) {
      // Firestore array-contains-any MAKSIMAL 10 nilai per query.
      constraints.push(where(fieldGudang, 'array-contains-any', gudangAdmin.slice(0, 10)));
    }
  }
  return constraints;
}

export function usePaginasiFirestore(db, namaKoleksi, opsi = {}) {
  const perHalaman = opsi.perHalaman || 15;
  const urutkanField = opsi.urutkanField || '__name__';
  const urutkanArah = opsi.urutkanArah || 'asc';
  const cariField = opsi.cariField || null; // null = fitur cari tidak aktif
  const ambilConstraintTambahan = opsi.constraintTambahan || (() => []); // filter dropdown, fungsi -> array where()
  const petakan = opsi.petakan || ((id, data) => ({ id, ...data }));
  const filterPeran = opsi.filterPeran || false; // BARU — lihat PEDOMAN KERJA di atas
  const filterPeranField = opsi.filterPeranField || {};

  const dataHalaman = ref([]);
  const memuat = ref(true);
  const nomorHalaman = ref(1);
  const adaBerikutnya = ref(false);
  const errorPaginasi = ref('');
  const cariTeks = ref('');

  let cursorStack = [];
  let timerDebounce = null;

  function bangunConstraints() {
    const teks = cariTeks.value.trim();
    const sedangCari = cariField && teks.length > 0;
    // Saat sedang cari-awalan, HARUS urut berdasarkan field yang sama yang
    // dicari (aturan Firestore: field pertama orderBy harus sama dengan
    // field yang dipakai filter rentang >=/<=).
    const fieldUrutDipakai = sedangCari ? cariField : urutkanField;

    const constraints = [];
    if (sedangCari) {
      constraints.push(where(cariField, '>=', teks));
      constraints.push(where(cariField, '<=', teks + '\uf8ff'));
    }
    if (filterPeran) constraints.push(...bangunConstraintFilterPeran(filterPeranField));
    constraints.push(...ambilConstraintTambahan());
    constraints.push(orderBy(fieldUrutDipakai, urutkanArah));
    return constraints;
  }

  async function ambilHalaman(nomorTarget) {
    memuat.value = true;
    errorPaginasi.value = '';
    try {
      const constraints = bangunConstraints();
      let q;
      if (nomorTarget === 1) {
        q = query(collection(db, namaKoleksi), ...constraints, limit(perHalaman + 1));
      } else {
        const cursor = cursorStack[nomorTarget - 2];
        if (!cursor) throw new Error('Cursor halaman sebelumnya tidak ditemukan — coba muat ulang dari halaman 1.');
        q = query(collection(db, namaKoleksi), ...constraints, startAfter(cursor), limit(perHalaman + 1));
      }
      const snap = await getDocs(q);
      const docs = snap.docs;
      adaBerikutnya.value = docs.length > perHalaman;
      const docsDipakai = docs.slice(0, perHalaman);

      if (docsDipakai.length > 0) cursorStack[nomorTarget - 1] = docsDipakai[docsDipakai.length - 1];
      dataHalaman.value = docsDipakai.map(d => petakan(d.id, d.data()));
      nomorHalaman.value = nomorTarget;
    } catch (e) {
      console.error(`Gagal memuat halaman paginasi (${namaKoleksi}):`, e);
      errorPaginasi.value = 'Gagal memuat data. Cek Console untuk detail (mungkin perlu index Firestore baru — lihat link di pesan error aslinya).';
    }
    memuat.value = false;
  }

  function halamanBerikutnya() {
    if (adaBerikutnya.value && !memuat.value) ambilHalaman(nomorHalaman.value + 1);
  }
  function halamanSebelumnya() {
    if (nomorHalaman.value > 1 && !memuat.value) ambilHalaman(nomorHalaman.value - 1);
  }
  function muatUlang() {
    cursorStack = [];
    ambilHalaman(1);
  }

  return {
    dataHalaman, memuat, nomorHalaman, adaBerikutnya, errorPaginasi, cariTeks,
    halamanBerikutnya, halamanSebelumnya, muatUlang,
    // Dipanggil dari @input di template sebagai pengganti v-model biasa,
    // supaya pencarian di-debounce (tidak query Firestore di SETIAP
    // ketukan huruf, cuma 400ms setelah orang berhenti mengetik).
    cariDenganDebounce(nilai) {
      cariTeks.value = nilai;
      if (timerDebounce) clearTimeout(timerDebounce);
      timerDebounce = setTimeout(() => { cursorStack = []; ambilHalaman(1); }, 400);
    }
  };
}
