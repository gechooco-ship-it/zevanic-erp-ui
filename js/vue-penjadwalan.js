// js/vue-penjadwalan.js
// ============================================================================
// REBUILD (9 Sep 2026) — Master Absensi > Penjadwalan, mengikuti handoff
// "Management > Master Absensi" §2.2 (SERAH-TERIMA.md + wireframe.dc.html).
// Jawaban Guru (AskUserQuestion): "spek baru (kalender+timeline+rotasi) +
// bulk-update+Excel, rebuild sesuai spek" — jadi layar ini SEKARANG 2 tab:
//   1. Kalender  — BARU TOTAL, sesuai wireframe (toggle Mingguan/Bulanan,
//      klik sel utk ganti shift, drag utk bulk-assign, Template Rotasi).
//   2. Tabel & Excel — kode LAMA (ringkasan gudang, filter, checkbox massal,
//      update massal, export/import Excel) DIPERTAHANKAN UTUH, cuma
//      dipindah jadi tab kedua, TIDAK ADA logic yang diubah/dihapus.
//
// PENTING — status sambungan ke Ontime/Telat (WAJIB dibaca sebelum pakai fitur ini):
// Kalender BARU menulis ke koleksi BARU `jadwal_shift` (assignment per
// TANGGAL). Tab lama "Tabel & Excel" tetap menulis ke field lama
// `users.nama_shift` (SATU shift "default/utama" per karyawan, TANPA
// tanggal) — dipakai sebagai FALLBACK kalau tanggal itu belum diatur
// eksplisit lewat Kalender/Template Rotasi.
//
// UPDATE (9 Sep 2026, sore) — SUDAH DISAMBUNGKAN: Clock In/Out
// (js/vue-camera.js) sekarang memanggil window.ambilShiftEfektifHariIni
// (js/auth.js) di setiap titik tulis, yang mengecek dulu apakah HARI INI
// sudah diatur beda lewat koleksi `jadwal_shift` sebelum jatuh ke
// nama_shift default. Jadi kalau Guru pakai Kalender/Template Rotasi utk
// kasih shift BEDA dari default karyawan di tanggal tertentu, Antrean
// Absensi tanggal itu SEKARANG ikut menghitung ontime/telat berdasar
// shift hasil rotasi, bukan lagi shift default lama.
// Catatan perilaku: kalau sel Kalender diisi "OFF" tapi karyawan tetap
// Clock In hari itu, nama_shift tersimpan "OFF" apa adanya — Antrean
// Absensi tidak akan menampilkan badge ontime/telat sama sekali utk
// baris itu (karena "OFF" tidak cocok dengan entri manapun di
// master_shift), bukan bug, ini memang disengaja. Lihat juga banner di
// dalam tab Kalender.
//
// Untuk sel yang BELUM pernah diatur eksplisit lewat Kalender, tampilan sel
// FALLBACK ke nama_shift default karyawan itu (supaya kalender tidak
// tampil kosong total di hari pertama pakai) — ditandai lebih pudar
// (opacity) + label "(default)" di tooltip. Begitu sel itu diklik & diisi,
// baru jadi data eksplisit `jadwal_shift` utk tanggal itu.
//
// Koleksi baru (lihat SPESIFIKASI-KOLEKSI-BARU.md/SERAH-TERIMA.md §5 +
// firestore.rules yang sudah ditambah rule utk 2 koleksi ini):
//   - jadwal_shift/{email}_{YYYY-MM}: { email, bulan, hari:{ "1":"Pagi", ... } }
//     1 dokumen per karyawan PER BULAN (bukan per tanggal) — HEMAT baca,
//     pola sama dengan alasan hemat di tempat lain (STATUS-PROYEK.md §44.17).
//   - template_rotasi/{namaTemplate}: { nama, pola:[{shift,hari}, ...] } —
//     pola rotasi yang disimpan supaya bisa dipakai ulang (SERAH-TERIMA.md
//     §5 "bisa disimpan dan diterapkan batch").
//
// Warna shift: OTOMATIS dari urutan nama di master_shift (diurutkan A-Z
// supaya warnanya STABIL walau urutan hasil query Firestore berubah-ubah),
// dipetakan ke palet tetap (bukan field warna baru di master_shift — supaya
// tidak perlu migrasi data shift lama). 3 warna pertama SENGAJA disamakan
// persis dengan contoh di wireframe (Pagi/Siang/Malam = hijau sage/amber/
// burgundy, sama dengan token --ok/--warn/--burgundy proyek ini).
// ============================================================================
import { createApp, ref, reactive, computed, watch, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, setDoc, updateDoc, deleteField, writeBatch, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { GudangCheckboxSelect, GudangRingkas } from './vue-components.js';

const HARI_LIBUR_PILIHAN = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const PER_HALAMAN = 15;
const NILAI_TANPA_GUDANG = '__TANPA_GUDANG__';

// ---- Konstanta & util kalender (dipakai tab Kalender) ----
const NAMA_HARI_PENDEK = ['SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB', 'MIN'];
const NAMA_BULAN_INDO = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const KUNCI_OFF = 'OFF';
// Palet warna sel kalender — index diambil dari posisi nama shift di daftar
// yang SUDAH diurutkan A-Z (lihat daftarShiftUrut), BUKAN dari urutan hasil
// query Firestore (supaya warna tidak berubah-ubah tiap reload).
const PALET_WARNA_SHIFT = [
  { bg: 'rgba(94,124,79,.22)', fg: '#3f5636' },   // sage, = --ok
  { bg: 'rgba(184,134,58,.22)', fg: '#8a6420' },  // amber, = --warn
  { bg: 'rgba(110,30,44,.18)', fg: '#6E1E2C' },   // burgundy
  { bg: 'rgba(130,183,200,.28)', fg: '#2b5866' }, // biru, = --blue-deep
  { bg: 'rgba(227,173,166,.32)', fg: '#7a3d36' }, // pink, = --pink-deep
  { bg: 'rgba(110,70,48,.20)', fg: '#6E4630' }    // mahogany
];
const WARNA_OFF = { bg: 'rgba(59,42,31,.06)', fg: '#8C7A6B' };
const WARNA_KOSONG = { bg: 'transparent', fg: '#B3A493' };

function pad2(n) { return String(n).padStart(2, '0'); }
function tanggalISOStr(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function bulanKeyDari(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; }
function tambahHari(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function awalMinggu(d) { const x = new Date(d); const hari = x.getDay(); const offset = hari === 0 ? -6 : 1 - hari; return tambahHari(x, offset); }
function jumlahHariBulan(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
function awalBulan(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

const AppPenjadwalan = {
  components: { GudangCheckboxSelect, GudangRingkas },
  setup() {
    // Dipakai buat catatan transparansi filter jenis pekerjaan di template
    // (LEWAT computed, BUKAN window.xxx langsung di template — lihat
    // STATUS-PROYEK.md §10.1, sudah pernah kejadian bug diam-diam karena ini).
    const isOwnerRole = computed(() => ['owner', 'superuser'].includes((window.currentUser.role || '').toLowerCase()));

    // ==========================================================================
    // ---- DATA MASTER BERSAMA (dipakai tab Kalender MAUPUN tab Tabel & Excel) ----
    // ==========================================================================
    const semuaKaryawan = ref([]);
    const daftarGudang = ref([]);
    const petaJenisLokasi = ref({}); // nama gudang -> "Tetap"/"Dinamis", buat kolom Jenis Lokasi
    const daftarShift = ref([]);
    const daftarJenisPekerjaan = ref([]);
    const memuat = ref(true);

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
        // ringkasan per gudang, Pilih Semua + Update Massal, Export Excel,
        // dan SEKARANG kalender — semuanya beroperasi di atas SELURUH
        // hasil filter, bukan cuma 1 halaman, jadi TIDAK BISA dipotong
        // jadi paginasi cursor tanpa menghilangkan fitur itu). Yang BISA &
        // AMAN dihemat: jangan tarik akun NON-AKTIF (resign/ditolak) yang
        // toh dibuang lagi di JS — pindahkan filter itu ke where()
        // Firestore SEKARANG, supaya dokumen yang memang tidak relevan
        // tidak ikut terbaca dari server sama sekali.
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
        // BARU (9 Sep 2026) — diurutkan A-Z supaya warna sel Kalender (index
        // posisi di daftar ini) STABIL antar reload, tidak ikut acak
        // mengikuti urutan hasil query Firestore.
        listShift.sort((a, b) => (a.nama_shift || '').localeCompare(b.nama_shift || ''));
        daftarShift.value = listShift;

        daftarJenisPekerjaan.value = window.ambilMasterList ? await window.ambilMasterList('jenis_pekerjaan') : [];

        terpilih.clear();
        halaman.value = 1;
      } catch (e) {
        console.error("Gagal muat data Penjadwalan:", e);
      }
      memuat.value = false;
    }

    // Tab utama layar ini — BARU (9 Sep 2026). Default "kalender" (spek
    // baru), tab kedua "tabel" = fitur lama utuh (bulk update + Excel).
    const viewUtama = ref('kalender');

    // ==========================================================================
    // =====================  TAB 2: TABEL & EXCEL (LAMA)  =====================
    // Kode di bawah ini TIDAK DIUBAH sama sekali dari versi sebelum rebuild
    // (cuma dipindah jadi 1 tab, bukan satu-satunya tampilan) — beroperasi
    // di field lama users.nama_shift/gudang_penempatan/hari_libur.
    // ==========================================================================

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

    // ==========================================================================
    // ========================  TAB 1: KALENDER (BARU)  =======================
    // ==========================================================================
    const viewKalender = ref('mingguan'); // 'mingguan' | 'bulanan'
    const tanggalAcuan = ref(new Date());
    const filterGudangKalender = ref('ALL');
    const filterPekerjaanKalender = ref('ALL');
    const memuatKalender = ref(false);
    // Cache dokumen jadwal_shift yang sudah terbaca, key `${email}|${YYYY-MM}`
    // -> peta { "1":"Pagi", "2":"OFF", ... } (hasil field `hari` dokumen itu).
    const jadwalBulan = reactive({});

    const karyawanKalender = computed(() => semuaKaryawan.value.filter(d => {
      if (filterGudangKalender.value !== 'ALL' && !window.normalisasiGudang(d.gudang_penempatan).includes(filterGudangKalender.value)) return false;
      if (filterPekerjaanKalender.value !== 'ALL' && d.jenis_pekerjaan !== filterPekerjaanKalender.value) return false;
      return true;
    }));

    // Nama shift diurutkan A-Z — dasar index warna (lihat PALET_WARNA_SHIFT).
    const daftarShiftUrut = computed(() => daftarShift.value.map(s => s.nama_shift).filter(Boolean).sort());
    function warnaSel(nilai) {
      if (!nilai) return WARNA_KOSONG;
      if (nilai === KUNCI_OFF) return WARNA_OFF;
      const idx = daftarShiftUrut.value.indexOf(nilai);
      return PALET_WARNA_SHIFT[idx >= 0 ? idx % PALET_WARNA_SHIFT.length : 0];
    }

    // ---- Rentang hari yang ditampilkan ----
    const hariMingguan = computed(() => { const mulai = awalMinggu(tanggalAcuan.value); return Array.from({ length: 7 }, (_, i) => tambahHari(mulai, i)); });
    const hariBulanan = computed(() => { const mulai = awalBulan(tanggalAcuan.value); const n = jumlahHariBulan(tanggalAcuan.value); return Array.from({ length: n }, (_, i) => tambahHari(mulai, i)); });
    const hariTampil = computed(() => viewKalender.value === 'mingguan' ? hariMingguan.value : hariBulanan.value);
    const labelPeriode = computed(() => {
      if (viewKalender.value === 'mingguan') {
        const h = hariMingguan.value;
        const sama = h[0].getMonth() === h[6].getMonth();
        const kiri = sama ? h[0].getDate() : `${h[0].getDate()} ${NAMA_BULAN_INDO[h[0].getMonth()].slice(0, 3)}`;
        return `${kiri}–${h[6].getDate()} ${NAMA_BULAN_INDO[h[6].getMonth()]} ${h[6].getFullYear()}`;
      }
      return `${NAMA_BULAN_INDO[tanggalAcuan.value.getMonth()]} ${tanggalAcuan.value.getFullYear()}`;
    });
    function geserPeriode(arah) {
      if (viewKalender.value === 'mingguan') tanggalAcuan.value = tambahHari(tanggalAcuan.value, arah * 7);
      else tanggalAcuan.value = new Date(tanggalAcuan.value.getFullYear(), tanggalAcuan.value.getMonth() + arah, 1);
    }
    function keHariIni() { tanggalAcuan.value = new Date(); }
    function apakahHariIni(d) { const t = new Date(); return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate(); }

    // ---- Baca jadwal_shift (chunked where('in'), hemat baca) ----
    async function pastikanJadwalTerbaca() {
      const bulanSet = new Set(hariTampil.value.map(d => bulanKeyDari(d)));
      const emails = karyawanKalender.value.map(k => k.email);
      if (emails.length === 0 || bulanSet.size === 0) return;
      memuatKalender.value = true;
      try {
        for (const bulanKey of bulanSet) {
          const emailBelumAda = emails.filter(e => !(`${e}|${bulanKey}` in jadwalBulan));
          for (let i = 0; i < emailBelumAda.length; i += 10) {
            const potongan = emailBelumAda.slice(i, i + 10);
            if (potongan.length === 0) continue;
            const snap = await getDocs(query(collection(db, 'jadwal_shift'), where('bulan', '==', bulanKey), where('email', 'in', potongan)));
            const ketemu = new Set();
            snap.forEach(docSnap => {
              const data = docSnap.data();
              jadwalBulan[`${data.email}|${bulanKey}`] = data.hari || {};
              ketemu.add(data.email);
            });
            potongan.forEach(e => { if (!ketemu.has(e)) jadwalBulan[`${e}|${bulanKey}`] = {}; });
          }
        }
      } catch (e) {
        console.error('Gagal muat jadwal_shift:', e);
      }
      memuatKalender.value = false;
    }
    // Otomatis baca ulang begitu view/periode/daftar karyawan tampil berubah
    // (misal ganti minggu, ganti filter Gudang, atau data karyawan awal
    // selesai dimuat oleh muat() di atas).
    watch([viewKalender, tanggalAcuan, karyawanKalender], pastikanJadwalTerbaca);

    function segarkanKalender() {
      const bulanSet = new Set(hariTampil.value.map(d => bulanKeyDari(d)));
      karyawanKalender.value.forEach(k => bulanSet.forEach(b => { delete jadwalBulan[`${k.email}|${b}`]; }));
      pastikanJadwalTerbaca();
    }

    function jadwalHariEksplisit(email, tgl) {
      const peta = jadwalBulan[`${email}|${bulanKeyDari(tgl)}`] || {};
      return peta[String(tgl.getDate())]; // undefined = belum diatur eksplisit
    }
    // Nilai yang benar-benar ditampilkan di sel: eksplisit dari jadwal_shift
    // kalau ada, kalau tidak FALLBACK ke nama_shift default karyawan (lihat
    // catatan besar di atas file ini soal kenapa fallback ini ada).
    function shiftEfektif(karyawan, tgl) {
      const eksplisit = jadwalHariEksplisit(karyawan.email, tgl);
      if (eksplisit !== undefined) return { nilai: eksplisit, eksplisit: true };
      return { nilai: karyawan.nama_shift || null, eksplisit: false };
    }

    async function tulisJadwal(email, tgl, nilaiBaru) {
      const bulanKey = bulanKeyDari(tgl);
      const docId = `${email}_${bulanKey}`;
      try {
        await setDoc(doc(db, 'jadwal_shift', docId), { email, bulan: bulanKey, hari: { [String(tgl.getDate())]: nilaiBaru } }, { merge: true });
        jadwalBulan[`${email}|${bulanKey}`] = { ...(jadwalBulan[`${email}|${bulanKey}`] || {}), [String(tgl.getDate())]: nilaiBaru };
      } catch (e) {
        console.error('Gagal simpan jadwal:', email, tgl, e);
        alert('Gagal menyimpan perubahan jadwal.');
      }
    }
    async function hapusOverride(email, tgl) {
      const bulanKey = bulanKeyDari(tgl);
      const docId = `${email}_${bulanKey}`;
      try {
        await setDoc(doc(db, 'jadwal_shift', docId), { email, bulan: bulanKey, hari: { [String(tgl.getDate())]: deleteField() } }, { merge: true });
        const peta = { ...(jadwalBulan[`${email}|${bulanKey}`] || {}) };
        delete peta[String(tgl.getDate())];
        jadwalBulan[`${email}|${bulanKey}`] = peta;
      } catch (e) {
        console.error('Gagal hapus override jadwal:', email, tgl, e);
        alert('Gagal menghapus pengaturan sel ini.');
      }
    }

    function kunciSel(email, tgl) { return `${email}|${tanggalISOStr(tgl)}`; }
    function labelSel(karyawan, tgl) {
      const info = shiftEfektif(karyawan, tgl);
      if (!info.nilai) return '–';
      return info.nilai;
    }
    function tooltipSel(karyawan, tgl) {
      const info = shiftEfektif(karyawan, tgl);
      const tglStr = tanggalISOStr(tgl);
      if (!info.nilai) return `${karyawan.nama} — ${tglStr}: belum diatur`;
      return `${karyawan.nama} — ${tglStr}: ${info.nilai}${info.eksplisit ? '' : ' (default, belum diatur eksplisit di kalender)'}`;
    }
    function styleSel(karyawan, tgl) {
      const info = shiftEfektif(karyawan, tgl);
      const w = warnaSel(info.nilai);
      let s = `background:${w.bg}; color:${w.fg};`;
      if (!info.eksplisit && info.nilai) s += 'opacity:.55;';
      if (apakahHariIni(tgl)) s += 'outline:2px solid var(--burgundy); outline-offset:-2px;';
      if (selCells.has(kunciSel(karyawan.email, tgl))) s += 'box-shadow:inset 0 0 0 2px var(--burgundy);';
      return s;
    }

    // ---- Drag-select (mousedown -> mouseenter -> mouseup) ----
    const selCells = reactive(new Set());
    const sedangMenyeret = ref(false);
    const bulkSelShift = ref('');
    let selAwalKunci = null;

    function mulaiSeret(email, tgl) {
      sedangMenyeret.value = true;
      selCells.clear();
      const k = kunciSel(email, tgl);
      selCells.add(k);
      selAwalKunci = k;
    }
    function masukSeret(email, tgl) {
      if (!sedangMenyeret.value) return;
      selCells.add(kunciSel(email, tgl));
    }
    function selesaiSeret() {
      if (!sedangMenyeret.value) return;
      sedangMenyeret.value = false;
      if (selCells.size <= 1) {
        const [email, tglISO] = selAwalKunci.split('|');
        selCells.clear();
        bukaEditSel(email, tglISO);
      }
      // kalau > 1 sel, biarkan terisi -> toolbar bulk-assign otomatis muncul
      // (lihat v-if="selCells.size>0" di template).
    }
    function batalSel() { selCells.clear(); bulkSelShift.value = ''; }
    async function terapkanSel() {
      if (!bulkSelShift.value) return alert('Pilih shift atau OFF dulu.');
      if (!confirm(`Terapkan "${bulkSelShift.value}" ke ${selCells.size} sel terpilih?`)) return;
      const daftar = Array.from(selCells);
      for (const kunci of daftar) {
        const [email, tglISO] = kunci.split('|');
        await tulisJadwal(email, new Date(tglISO + 'T00:00:00'), bulkSelShift.value);
      }
      selCells.clear();
      bulkSelShift.value = '';
      alert('Bulk assign selesai.');
    }

    // ---- Popup edit 1 sel (hasil klik tunggal, bukan drag) ----
    const editSel = reactive({ tampil: false, email: '', nama: '', tglISO: '', eksplisit: false, nilaiPilih: '' });
    function bukaEditSel(email, tglISO) {
      const karyawan = karyawanKalender.value.find(x => x.email === email) || semuaKaryawan.value.find(x => x.email === email);
      const tgl = new Date(tglISO + 'T00:00:00');
      const info = shiftEfektif(karyawan || { email, nama_shift: null }, tgl);
      editSel.tampil = true;
      editSel.email = email;
      editSel.nama = karyawan?.nama || email;
      editSel.tglISO = tglISO;
      editSel.eksplisit = info.eksplisit;
      editSel.nilaiPilih = info.nilai || '';
    }
    function tutupEditSel() { editSel.tampil = false; }
    async function simpanEditSel() {
      if (!editSel.nilaiPilih) return alert('Pilih shift atau OFF dulu.');
      await tulisJadwal(editSel.email, new Date(editSel.tglISO + 'T00:00:00'), editSel.nilaiPilih);
      editSel.tampil = false;
    }
    async function hapusEditSel() {
      await hapusOverride(editSel.email, new Date(editSel.tglISO + 'T00:00:00'));
      editSel.tampil = false;
    }

    // ---- Popup Template Rotasi ----
    const daftarTemplateRotasi = ref([]);
    const cariKaryawanRotasi = ref('');
    const popupRotasi = reactive({
      tampil: false,
      karyawanTerpilih: new Set(),
      pola: [{ shift: '', hari: 5 }],
      tanggalMulai: tanggalISOStr(new Date()),
      jumlahHariTerapkan: 90,
      namaTemplateBaru: '',
      templateDipilih: '',
      menyimpan: false,
      menerapkan: false
    });
    const karyawanRotasiTersaring = computed(() => {
      const kata = cariKaryawanRotasi.value.trim().toLowerCase();
      return semuaKaryawan.value.filter(d => !kata || (d.nama || '').toLowerCase().includes(kata));
    });
    async function muatDaftarTemplateRotasi() {
      try {
        const snap = await getDocs(collection(db, 'template_rotasi'));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        daftarTemplateRotasi.value = list;
      } catch (e) {
        console.error('Gagal muat template_rotasi:', e);
      }
    }
    function bukaPopupRotasi() {
      popupRotasi.tampil = true;
      popupRotasi.karyawanTerpilih = new Set();
      popupRotasi.pola = [{ shift: daftarShift.value[0]?.nama_shift || '', hari: 5 }];
      popupRotasi.tanggalMulai = tanggalISOStr(new Date());
      popupRotasi.jumlahHariTerapkan = 90;
      popupRotasi.namaTemplateBaru = '';
      popupRotasi.templateDipilih = '';
      cariKaryawanRotasi.value = '';
      muatDaftarTemplateRotasi();
    }
    function tutupPopupRotasi() { popupRotasi.tampil = false; }
    function toggleKaryawanRotasi(email) {
      if (popupRotasi.karyawanTerpilih.has(email)) popupRotasi.karyawanTerpilih.delete(email);
      else popupRotasi.karyawanTerpilih.add(email);
    }
    function tambahBarisPola() { popupRotasi.pola.push({ shift: 'OFF', hari: 2 }); }
    function hapusBarisPola(idx) { if (popupRotasi.pola.length > 1) popupRotasi.pola.splice(idx, 1); }
    function muatDariTemplate(nama) {
      popupRotasi.templateDipilih = nama;
      const t = daftarTemplateRotasi.value.find(x => x.nama === nama);
      if (!t) return;
      popupRotasi.pola = (t.pola || []).map(p => ({ shift: p.shift, hari: p.hari }));
    }
    const totalSiklusHari = computed(() => popupRotasi.pola.reduce((a, p) => a + (Number(p.hari) || 0), 0));
    const previewSiklus = computed(() => {
      const arr = [];
      popupRotasi.pola.forEach(p => { for (let i = 0; i < (Number(p.hari) || 0); i++) arr.push(p.shift); });
      return arr;
    });
    async function simpanTemplateRotasi() {
      const nama = popupRotasi.namaTemplateBaru.trim();
      if (!nama) return alert('Isi nama template dulu untuk menyimpan.');
      if (totalSiklusHari.value === 0) return alert('Susun pola rotasi dulu sebelum disimpan.');
      popupRotasi.menyimpan = true;
      try {
        await setDoc(doc(db, 'template_rotasi', nama), { nama, pola: popupRotasi.pola.map(p => ({ shift: p.shift, hari: Number(p.hari) || 0 })) });
        alert(`Template rotasi "${nama}" tersimpan.`);
        popupRotasi.namaTemplateBaru = '';
        await muatDaftarTemplateRotasi();
      } catch (e) {
        console.error('Gagal simpan template_rotasi:', e);
        alert('Gagal menyimpan template rotasi.');
      }
      popupRotasi.menyimpan = false;
    }
    async function terapkanRotasi() {
      const emails = Array.from(popupRotasi.karyawanTerpilih);
      if (emails.length === 0) return alert('Pilih minimal 1 karyawan.');
      if (totalSiklusHari.value === 0) return alert('Susun pola rotasi dulu (minimal 1 baris, jumlah hari > 0).');
      const jumlahHari = Math.min(366, Math.max(1, Number(popupRotasi.jumlahHariTerapkan) || 90));
      if (!confirm(`Terapkan rotasi ini ke ${emails.length} karyawan, ${jumlahHari} hari ke depan mulai ${popupRotasi.tanggalMulai}? Jadwal yang sudah ada di tanggal-tanggal itu akan DITIMPA.`)) return;

      popupRotasi.menerapkan = true;
      try {
        const mulai = new Date(popupRotasi.tanggalMulai + 'T00:00:00');
        const siklus = previewSiklus.value;
        // Kumpulkan per (email, bulan) -> {email,bulan,hari:{tanggal:shift}}
        // supaya nulisnya per-DOKUMEN BULAN (hemat), bukan per hari.
        const perDoc = {};
        for (const email of emails) {
          for (let i = 0; i < jumlahHari; i++) {
            const tgl = tambahHari(mulai, i);
            const shift = siklus[i % siklus.length];
            const bulanKey = bulanKeyDari(tgl);
            const key = `${email}_${bulanKey}`;
            if (!perDoc[key]) perDoc[key] = { email, bulan: bulanKey, hari: {} };
            perDoc[key].hari[String(tgl.getDate())] = shift;
          }
        }
        const semuaKey = Object.keys(perDoc);
        for (let i = 0; i < semuaKey.length; i += 450) { // margin dari batas 500 tulis/batch
          const batch = writeBatch(db);
          semuaKey.slice(i, i + 450).forEach(key => {
            batch.set(doc(db, 'jadwal_shift', key), perDoc[key], { merge: true });
          });
          await batch.commit();
        }
        // Update cache lokal supaya kalender langsung berubah tanpa fetch ulang.
        semuaKey.forEach(key => {
          const cacheKey = `${perDoc[key].email}|${perDoc[key].bulan}`;
          jadwalBulan[cacheKey] = { ...(jadwalBulan[cacheKey] || {}), ...perDoc[key].hari };
        });
        alert(`Rotasi berhasil diterapkan ke ${emails.length} karyawan (${jumlahHari} hari ke depan).`);
        popupRotasi.tampil = false;
      } catch (e) {
        console.error('Gagal terapkan rotasi:', e);
        alert('Gagal menerapkan rotasi.');
      }
      popupRotasi.menerapkan = false;
    }

    onMounted(async () => {
      await window.authReady;
      muat();
      window.addEventListener('mouseup', selesaiSeret);
    });

    return {
      isOwnerRole, viewUtama,
      // -- shared --
      semuaKaryawan, daftarShift, daftarJenisPekerjaan, daftarGudang, memuat, muat,
      // -- tab Tabel & Excel (lama) --
      railRingkasan, geserRingkasan,
      cariNama, cekSudah, cekBelum, filterJenisPekerjaan, filterGudang, filterShift, filterLibur,
      terpilih, hasilFilter, potonganHalamanIni, infoHalaman, headerDicentang, halamanAman, totalHalaman,
      ringkasanKartu, klikKartuGudang,
      toggleCheckbox, toggleSemuaHalamanIni, pilihSemua, bersihkanPilihan,
      halamanSebelumnya, halamanBerikutnya,
      bulkGudang, bulkJenisPekerjaan, bulkShift, bulkLibur, memprosesBulk, terapkanBulkUpdate,
      exportExcel, importExcel,
      statusTerjadwal, tampilkanGudang, jenisLokasiKaryawan,
      HARI_LIBUR_PILIHAN,
      // -- tab Kalender (baru) --
      viewKalender, tanggalAcuan, filterGudangKalender, filterPekerjaanKalender, memuatKalender,
      karyawanKalender, daftarShiftUrut, PALET_WARNA_SHIFT, WARNA_OFF,
      hariTampil, labelPeriode, geserPeriode, keHariIni, apakahHariIni,
      segarkanKalender, tanggalISOStr, NAMA_HARI_PENDEK,
      styleSel, labelSel, tooltipSel, warnaSel,
      mulaiSeret, masukSeret, selCells, bulkSelShift, batalSel, terapkanSel,
      editSel, tutupEditSel, simpanEditSel, hapusEditSel,
      popupRotasi, bukaPopupRotasi, tutupPopupRotasi, toggleKaryawanRotasi,
      tambahBarisPola, hapusBarisPola, muatDariTemplate, daftarTemplateRotasi,
      cariKaryawanRotasi, karyawanRotasiTersaring, totalSiklusHari, previewSiklus,
      simpanTemplateRotasi, terapkanRotasi
    };
  },
  template: `
    <div>
      <!-- Tab utama: Kalender / Tabel & Excel -->
      <div style="display:flex; gap:6px; margin-bottom:12px;">
        <button :class="['gc-sub-tab-btn', viewUtama==='kalender' ? 'active' : '']" @click="viewUtama='kalender'"><i class="fas fa-calendar-days" style="margin-right:6px;"></i>Kalender</button>
        <button :class="['gc-sub-tab-btn', viewUtama==='tabel' ? 'active' : '']" @click="viewUtama='tabel'"><i class="fas fa-table-list" style="margin-right:6px;"></i>Tabel &amp; Excel</button>
      </div>

      <!-- ============================ TAB KALENDER ============================ -->
      <div v-if="viewUtama==='kalender'">
        <div class="gc-card" style="background:var(--blue); border:none; margin-bottom:14px;">
          <p style="font-size:11px; color:#1F5060; margin:0;"><i class="fas fa-circle-info" style="margin-right:6px;"></i> Kalender ini mengatur jadwal PER TANGGAL untuk perencanaan rotasi. Perhitungan Ontime/Telat di Antrean Absensi <b>sudah mengikuti rotasi di sini</b> — sel yang belum diatur eksplisit (tampil pudar) tetap jatuh ke Shift default (kolom "Shift" di tab Tabel &amp; Excel).</p>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
          <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
            <div style="display:flex; border:1.5px solid var(--line); border-radius:8px; overflow:hidden;">
              <button @click="viewKalender='mingguan'" :style="viewKalender==='mingguan' ? 'background:var(--burgundy); color:#fff;' : 'background:var(--surface);'" style="padding:6px 12px; font-size:11.5px; font-weight:700; border:none; cursor:pointer;">Mingguan</button>
              <button @click="viewKalender='bulanan'" :style="viewKalender==='bulanan' ? 'background:var(--burgundy); color:#fff;' : 'background:var(--surface);'" style="padding:6px 12px; font-size:11.5px; font-weight:700; border:none; cursor:pointer;">Bulanan</button>
            </div>
            <button @click="geserPeriode(-1)" class="icon-btn"><i class="fas fa-chevron-left"></i></button>
            <span style="font-size:12px; font-weight:700; min-width:170px; text-align:center;">{{ labelPeriode }}</span>
            <button @click="geserPeriode(1)" class="icon-btn"><i class="fas fa-chevron-right"></i></button>
            <button @click="keHariIni" class="btn-outline" style="padding:5px 10px; font-size:11px;">Hari ini</button>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button @click="segarkanKalender" class="btn-outline" style="padding:6px 12px; font-size:11.5px;"><i class="fas fa-sync-alt" style="margin-right:6px;"></i>Refresh</button>
            <button @click="bukaPopupRotasi" class="btn-primary" style="padding:6px 14px; font-size:11.5px;"><i class="fas fa-wand-magic-sparkles" style="margin-right:6px;"></i>Template Rotasi</button>
          </div>
        </div>

        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
          <select v-model="filterGudangKalender" style="padding:7px 10px; font-size:11.5px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
            <option value="ALL">Gudang: Semua</option>
            <option v-for="g in daftarGudang" :key="g" :value="g">{{ g }}</option>
          </select>
          <select v-if="isOwnerRole" v-model="filterPekerjaanKalender" style="padding:7px 10px; font-size:11.5px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
            <option value="ALL">Pekerjaan: Semua</option>
            <option v-for="j in daftarJenisPekerjaan" :key="j" :value="j">{{ j }}</option>
          </select>
          <p style="font-size:10.5px; color:var(--text-muted); margin:auto 0 auto 4px;">{{ karyawanKalender.length }} karyawan cocok filter. Belum ada paginasi — pakai filter kalau daftar terlalu panjang.</p>
        </div>

        <!-- Legenda warna shift -->
        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:10px; align-items:center;">
          <div v-for="(nama, idx) in daftarShiftUrut" :key="nama" style="display:flex; align-items:center; gap:5px;">
            <span :style="'width:13px;height:13px;border-radius:4px;display:inline-block;background:' + PALET_WARNA_SHIFT[idx % PALET_WARNA_SHIFT.length].bg"></span>
            <span style="font-size:10.5px; color:var(--text-muted);">{{ nama }}</span>
          </div>
          <div style="display:flex; align-items:center; gap:5px;">
            <span :style="'width:13px;height:13px;border-radius:4px;display:inline-block;background:' + WARNA_OFF.bg"></span>
            <span style="font-size:10.5px; color:var(--text-muted);">OFF</span>
          </div>
          <span style="font-size:10.5px; color:var(--text-faint);"><i class="fas fa-circle" style="font-size:7px; margin-right:3px; opacity:.5;"></i>Sel pudar = ikut Shift default (belum diatur eksplisit)</span>
        </div>

        <div class="gc-card" style="padding:14px; margin-bottom:14px;">
          <div v-if="memuat || memuatKalender" style="text-align:center; padding:30px 0; color:var(--text-faint);">
            <i class="fas fa-spinner fa-spin" style="font-size:22px; margin-bottom:8px; display:block;"></i>Memuat kalender...
          </div>
          <div v-else-if="karyawanKalender.length === 0" style="text-align:center; padding:30px 0; color:var(--text-faint);">Tidak ada karyawan yang cocok dengan filter.</div>
          <div v-else style="overflow-x:auto;">
            <div :style="'display:grid; grid-template-columns:140px repeat(' + hariTampil.length + ', minmax(' + (viewKalender==='mingguan' ? '72px' : '22px') + ',1fr)); gap:1px; background:var(--line); border-radius:8px; overflow:hidden; min-width:' + (viewKalender==='mingguan' ? '700px' : (140 + hariTampil.length*24) + 'px') + ';'">
              <div style="background:var(--surface); padding:6px 8px;"><span style="font-size:9px; font-weight:800; color:var(--text-faint); text-transform:uppercase;">Karyawan</span></div>
              <div v-for="h in hariTampil" :key="'kepala-'+tanggalISOStr(h)" :style="(apakahHariIni(h) ? 'background:var(--burgundy-light);' : 'background:var(--surface);') + 'padding:5px 2px; text-align:center;'">
                <div v-if="viewKalender==='mingguan'" style="font-size:9px; font-weight:800; color:var(--text-faint);">{{ NAMA_HARI_PENDEK[(h.getDay()+6)%7] }}</div>
                <div :style="'font-size:' + (viewKalender==='mingguan' ? '11px' : '7.5px') + '; font-weight:700;'">{{ h.getDate() }}</div>
              </div>
              <template v-for="k in karyawanKalender" :key="k.email">
                <div style="background:var(--surface); padding:6px 8px; display:flex; align-items:center;">
                  <span style="font-size:10.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ k.nama || k.email }}</span>
                </div>
                <div v-for="h in hariTampil" :key="k.email+'-'+tanggalISOStr(h)"
                     :style="'padding:' + (viewKalender==='mingguan' ? '6px 3px' : '3px 0') + '; text-align:center; cursor:pointer; user-select:none; ' + styleSel(k,h)"
                     :title="tooltipSel(k,h)"
                     @mousedown.prevent="mulaiSeret(k.email,h)"
                     @mouseenter="masukSeret(k.email,h)">
                  <span v-if="viewKalender==='mingguan'" style="font-size:9.5px; font-weight:700; white-space:nowrap;">{{ labelSel(k,h) }}</span>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Toolbar bulk-assign hasil drag-select -->
        <div v-if="selCells.size > 0" class="gc-card" style="border:1.5px solid var(--burgundy); display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:14px;">
          <span style="font-size:12px; font-weight:700;"><i class="fas fa-object-group" style="color:var(--burgundy); margin-right:6px;"></i>{{ selCells.size }} sel terpilih</span>
          <select v-model="bulkSelShift" style="padding:6px 10px; font-size:11.5px; border:1.5px solid var(--line); border-radius:8px;">
            <option value="">-- Pilih shift/OFF --</option>
            <option v-for="s in daftarShift" :key="s.nama_shift" :value="s.nama_shift">{{ s.nama_shift }}</option>
            <option value="OFF">OFF</option>
          </select>
          <button @click="terapkanSel" class="btn-primary" style="padding:6px 14px; font-size:11.5px;">Terapkan</button>
          <button @click="batalSel" class="btn-outline" style="padding:6px 14px; font-size:11.5px;">Batal</button>
        </div>

        <!-- Popup edit 1 sel -->
        <div v-if="editSel.tampil" style="position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="tutupEditSel">
          <div class="gc-card" style="width:100%; max-width:340px;">
            <h4 class="gc-heading" style="font-size:13px; font-weight:700; margin-bottom:4px;">{{ editSel.nama }}</h4>
            <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">{{ editSel.tglISO }}</p>
            <div class="gc-field">
              <label>Shift</label>
              <select v-model="editSel.nilaiPilih">
                <option value="">-- Pilih --</option>
                <option v-for="s in daftarShift" :key="s.nama_shift" :value="s.nama_shift">{{ s.nama_shift }}</option>
                <option value="OFF">OFF</option>
              </select>
            </div>
            <div style="display:flex; gap:8px; margin-top:8px;">
              <button @click="simpanEditSel" class="btn-primary" style="flex:1;">Simpan</button>
              <button @click="tutupEditSel" class="btn-outline" style="flex:1;">Batal</button>
            </div>
            <button v-if="editSel.eksplisit" @click="hapusEditSel" style="width:100%; margin-top:8px; background:none; border:none; color:var(--burgundy); font-weight:700; font-size:11px; cursor:pointer;">Hapus pengaturan (ikut Shift default lagi)</button>
          </div>
        </div>

        <!-- Popup Template Rotasi -->
        <div v-if="popupRotasi.tampil" style="position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="tutupPopupRotasi">
          <div class="gc-card" style="width:100%; max-width:460px; max-height:90vh; overflow-y:auto;">
            <h4 class="gc-heading" style="font-size:14px; font-weight:700; margin-bottom:2px;"><i class="fas fa-wand-magic-sparkles" style="color:var(--burgundy); margin-right:8px;"></i>Template Rotasi</h4>
            <p style="font-size:10.5px; color:var(--text-muted); margin-bottom:12px;">Susun pola berulang, auto-isi ke kalender. Tidak perlu klik satu-satu.</p>

            <div v-if="daftarTemplateRotasi.length > 0" class="gc-field">
              <label>Muat dari template tersimpan (opsional)</label>
              <select :value="popupRotasi.templateDipilih" @change="muatDariTemplate($event.target.value)">
                <option value="">-- Susun pola baru --</option>
                <option v-for="t in daftarTemplateRotasi" :key="t.id" :value="t.nama">{{ t.nama }}</option>
              </select>
            </div>

            <div class="gc-field">
              <label>Terapkan ke ({{ popupRotasi.karyawanTerpilih.size }} karyawan dipilih)</label>
              <input v-model="cariKaryawanRotasi" type="text" placeholder="Cari nama karyawan..." style="margin-bottom:6px;">
              <div style="max-height:130px; overflow-y:auto; border:1.5px solid var(--line); border-radius:10px; padding:6px 10px;">
                <label v-for="k in karyawanRotasiTersaring" :key="k.email" style="display:flex; align-items:center; gap:8px; font-size:11.5px; padding:4px 0; cursor:pointer;">
                  <input type="checkbox" :checked="popupRotasi.karyawanTerpilih.has(k.email)" @change="toggleKaryawanRotasi(k.email)" style="accent-color:var(--burgundy);">
                  {{ k.nama || k.email }}
                </label>
                <p v-if="karyawanRotasiTersaring.length===0" style="font-size:11px; color:var(--text-faint); padding:6px 0;">Tidak ada karyawan cocok pencarian.</p>
              </div>
            </div>

            <div class="gc-field">
              <label>Pola rotasi (berulang)</label>
              <div style="display:flex; flex-direction:column; gap:6px;">
                <div v-for="(p, idx) in popupRotasi.pola" :key="idx" style="display:flex; gap:6px; align-items:center;">
                  <select v-model="p.shift" style="flex:1; padding:6px 8px; font-size:11px; border:1.5px solid var(--line); border-radius:8px;">
                    <option value="">-- shift --</option>
                    <option v-for="s in daftarShift" :key="s.nama_shift" :value="s.nama_shift">{{ s.nama_shift }}</option>
                    <option value="OFF">OFF</option>
                  </select>
                  <span style="font-size:11px;">&times;</span>
                  <input v-model.number="p.hari" type="number" min="1" style="width:56px; padding:6px 8px; font-size:11px; border:1.5px solid var(--line); border-radius:8px; text-align:center;">
                  <span style="font-size:10px; color:var(--text-muted); white-space:nowrap;">hari</span>
                  <button @click="hapusBarisPola(idx)" style="background:none; border:none; color:var(--danger); cursor:pointer; padding:4px;"><i class="fas fa-xmark"></i></button>
                </div>
              </div>
              <button @click="tambahBarisPola" class="btn-outline" style="margin-top:8px; width:100%; padding:6px; font-size:11px;">+ Tambah baris pola</button>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div class="gc-field" style="margin-bottom:0;">
                <label>Mulai dari tanggal</label>
                <input v-model="popupRotasi.tanggalMulai" type="date">
              </div>
              <div class="gc-field" style="margin-bottom:0;">
                <label>Terapkan untuk berapa hari</label>
                <input v-model.number="popupRotasi.jumlahHariTerapkan" type="number" min="1" max="366">
              </div>
            </div>

            <div style="margin:12px 0; padding:8px 10px; background:var(--ivory-dim); border-radius:8px;">
              <div style="font-size:9.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">Preview siklus ({{ totalSiklusHari }} hari, berulang)</div>
              <div style="display:flex; gap:1px; flex-wrap:wrap;">
                <div v-for="(s, i) in previewSiklus" :key="i" :style="'width:9px;height:9px;border-radius:2px;background:' + warnaSel(s).bg"></div>
              </div>
            </div>

            <div class="gc-field">
              <label>Simpan pola ini sebagai template (opsional)</label>
              <div style="display:flex; gap:6px;">
                <input v-model="popupRotasi.namaTemplateBaru" type="text" placeholder="Nama template, mis. Rotasi 3 Shift" style="flex:1;">
                <button @click="simpanTemplateRotasi" :disabled="popupRotasi.menyimpan" class="btn-outline" style="padding:0 14px; font-size:11px; white-space:nowrap;">Simpan</button>
              </div>
            </div>

            <div style="display:flex; gap:8px; margin-top:6px;">
              <button @click="tutupPopupRotasi" class="btn-outline" style="flex:1;">Batal</button>
              <button @click="terapkanRotasi" :disabled="popupRotasi.menerapkan" class="btn-primary" style="flex:1;">
                <i class="fas fa-wand-magic-sparkles" style="margin-right:6px;"></i>{{ popupRotasi.menerapkan ? 'Menerapkan...' : 'Terapkan' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================ TAB TABEL & EXCEL (LAMA) ============================ -->
      <div v-if="viewUtama==='tabel'">
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
          <p style="font-size:10.5px; color:var(--text-muted); margin-bottom:12px;">Kosongkan kolom yang tidak ingin diubah. Berlaku untuk karyawan yang dicentang di tabel bawah (mengikuti filter/pencarian yang sedang aktif). Ini mengubah Shift <b>default</b> karyawan (bukan jadwal per-tanggal di tab Kalender).</p>
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
