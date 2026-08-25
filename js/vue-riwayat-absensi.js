// js/vue-riwayat-absensi.js
// ============================================================================
// Halaman KEENAM yang dimigrasi ke Vue: Master Absensi > Riwayat All Absensi
// (laporan lengkap semua data absensi + edit/hapus/assign ulang + export CSV).
//
// DIROMBAK (18 Agt 2026) — tabel ini WAJIB nampilin 2 BENTUK dokumen
// sekaligus (LAMA: 1 baris = 1 event Clock In ATAU Clock Out terpisah;
// BARU: 1 baris = gabungan Clock In+Out, lihat js/vue-camera.js). Kolom
// "Tanggal/Waktu" yang dulu 1 kolom SEKARANG dipecah jadi 2 kolom
// terpisah — "Tanggal-Waktu Clock In" dan "Tanggal-Waktu Clock Out"
// (permintaan checklist rebuild 18 Agt 2026) — supaya kelihatan jelas
// jam masuk & keluar karyawan di 1 baris yang sama untuk dokumen format
// baru, TANPA kehilangan kompatibilitas ke dokumen format lama (yang
// otomatis cuma isi SALAH SATU kolom itu, sesuai jenis event-nya).
//
// formatBaris() di bawah adalah "penerjemah" 1 fungsi tunggal yang
// menyeragamkan KEDUA bentuk dokumen jadi 1 bentuk tampilan yang sama —
// SEMUA bagian template baca lewat fungsi ini, TIDAK ada cabang if/else
// format lama/baru tersebar di banyak tempat template (lebih gampang
// dirawat & diuji terpisah dari Vue).
//
// Ditambah filter TETAP "Status Kerja = Aktif" (permintaan checklist) —
// karyawan nonaktif/resign tidak perlu muncul di laporan operasional ini.
//
// Dipakai ulang: DuaBaris (dari migrasi Daftar Karyawan).
// window.hapusAbsensi TETAP dipanggil dari sini (fungsi bersama, juga
// dipakai oleh Antrean Absensi).
// ============================================================================
import { createApp, ref, reactive, computed, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, updateDoc, writeBatch, Timestamp, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DuaBaris } from './vue-components.js';

// Diekspor juga (dipakai test) — seragamkan dokumen LAMA (1 event/baris)
// dan BARU (gabungan masuk+keluar) jadi 1 bentuk tampilan yang sama.
export function formatBaris(item) {
  const adalahBaru = item.status_acc_masuk !== undefined;
  if (adalahBaru) {
    return {
      waktuMasuk: item.waktu_masuk || null,
      waktuKeluar: item.waktu_keluar || null,
      statusAccMasuk: item.status_acc_masuk || null,
      statusAccKeluar: item.status_acc_keluar !== undefined ? item.status_acc_keluar : null,
      fotoMasuk: item.foto_selfie_masuk || null,
      fotoKeluar: item.foto_selfie_keluar || null,
      statusKehadiranMasuk: item.status_kehadiran_masuk || '',
      statusKehadiranKeluar: item.status_kehadiran_keluar || '',
      seragamMasuk: item.seragam_masuk || 'Sesuai',
      seragamKeluar: item.seragam_keluar || null
    };
  }
  // Format LAMA — 1 baris = 1 event tunggal (Clock In ATAU Clock Out
  // ATAU Izin/Cuti/Lembur, tidak pernah gabungan).
  const iniKeluar = item.status === 'CLOCK OUT';
  return {
    waktuMasuk: iniKeluar ? null : (item.waktu || null),
    waktuKeluar: iniKeluar ? (item.waktu || null) : null,
    statusAccMasuk: iniKeluar ? null : (item.status_acc || null),
    statusAccKeluar: iniKeluar ? (item.status_acc || null) : null,
    fotoMasuk: iniKeluar ? null : (item.foto_selfie || item.foto || null),
    fotoKeluar: iniKeluar ? (item.foto_selfie || item.foto || null) : null,
    statusKehadiranMasuk: iniKeluar ? '' : (item.status_kehadiran || ''),
    statusKehadiranKeluar: iniKeluar ? (item.status_kehadiran || '') : '',
    seragamMasuk: iniKeluar ? 'Sesuai' : (item.seragam || 'Sesuai'),
    seragamKeluar: iniKeluar ? (item.seragam || 'Sesuai') : null
  };
}

// Waktu sortir gabungan — pakai yang paling akhir terjadi (keluar kalau
// ada, jatuh-aman ke masuk kalau belum Clock Out).
function waktuUntukSortir(item) {
  if (item.status_acc_masuk !== undefined) return item.waktu_keluar || item.waktu_masuk || '';
  return item.waktu || '';
}

const EditAbsensiModal = {
  props: {
    item: { type: Object, required: true }
  },
  emits: ['tutup', 'tersimpan'],
  setup(props, { emit }) {
    const adalahBaru = props.item.status_acc_masuk !== undefined;
    const form = reactive({
      statusKehadiran: props.item.status_kehadiran || props.item.status_kehadiran_masuk || '',
      seragam: props.item.seragam || props.item.seragam_masuk || 'Sesuai',
      statusAcc: props.item.status_acc || props.item.status_acc_masuk || 'PENDING'
    });
    const opsiStatusKehadiran = ref([]);
    const menyimpan = ref(false);

    async function muatOpsi() {
      opsiStatusKehadiran.value = window.ambilMasterList ? await window.ambilMasterList('status_kehadiran') : ["Ontime", "Terlambat", "Tidak Absen"];
    }

    async function simpan() {
      menyimpan.value = true;
      try {
        // Dokumen BARU: edit di sini WAJIB ke field_masuk (form Edit cuma
        // 1 set kolom — kalau butuh edit sisi Keluar, dilakukan lewat
        // Antrean Absensi sebelum di-ACC, bukan dari sini).
        const dataUpdate = adalahBaru
          ? { status_kehadiran_masuk: form.statusKehadiran, seragam_masuk: form.seragam, status_acc_masuk: form.statusAcc }
          : { status_kehadiran: form.statusKehadiran, seragam: form.seragam, status_acc: form.statusAcc };
        await updateDoc(doc(db, "absensi", props.item.id), dataUpdate);
        alert("Data absensi berhasil diperbarui!");
        emit('tersimpan');
      } catch (e) {
        console.error("Gagal edit absensi:", e);
        alert("Gagal menyimpan perubahan.");
      }
      menyimpan.value = false;
    }

    onMounted(async () => { await window.authReady; muatOpsi(); });
    return { form, opsiStatusKehadiran, menyimpan, simpan };
  },
  template: `
    <div style="position:fixed; inset:0; z-index:100; background:rgba(59,42,31,.6); display:flex; align-items:center; justify-content:center; padding:16px;" class="fade-in">
      <div style="background:var(--surface); border-radius:22px; padding:22px; width:100%; max-width:380px; font-size:12.5px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:14px;">
          <h3 class="gc-heading" style="font-weight:700; font-size:14px;"><i class="fas fa-edit" style="color:var(--burgundy); margin-right:8px;"></i> Edit Data Absensi</h3>
          <button @click="$emit('tutup')" style="background:none; border:none; color:var(--text-faint); font-size:16px; cursor:pointer;"><i class="fas fa-times"></i></button>
        </div>
        <p style="font-size:11.5px; color:var(--text-muted); margin-bottom:12px;">Karyawan: <b style="color:var(--text);">{{ item.nama_pegawai || item.nama || '-' }}</b></p>
        <div class="gc-field">
          <label>Status Kehadiran</label>
          <select v-model="form.statusKehadiran"><option v-for="s in opsiStatusKehadiran" :key="s" :value="s">{{ s }}</option></select>
        </div>
        <div class="gc-field">
          <label>Seragam</label>
          <select v-model="form.seragam"><option value="Sesuai">Sesuai</option><option value="Tidak Sesuai">Tidak Sesuai</option></select>
        </div>
        <div class="gc-field">
          <label>Status Persetujuan</label>
          <select v-model="form.statusAcc"><option value="ACC">ACC</option><option value="REJECT">REJECT</option><option value="PENDING">PENDING</option></select>
        </div>
        <button @click="simpan" :disabled="menyimpan" class="btn-primary block">
          <i class="fas fa-save" style="margin-right:6px;"></i> {{ menyimpan ? 'Menyimpan...' : 'Simpan Perubahan' }}
        </button>
      </div>
    </div>
  `
};

const AppRiwayatAbsensi = {
  components: { DuaBaris, EditAbsensiModal },
  setup() {
    const listData = ref([]);
    const cariNama = ref('');
    const listDataTersaring = computed(() => {
      const kata = cariNama.value.trim().toLowerCase();
      if (!kata) return listData.value;
      return listData.value.filter(item => (item.nama_pegawai || item.nama || '').toLowerCase().includes(kata));
    });
    // Paginasi TAMPILAN (bukan re-query Firestore per halaman) — aman
    // dilakukan di browser karena listData SUDAH dibatasi rentang
    // tanggal duluan (lihat muat() di bawah), jadi ukurannya sudah wajar
    // untuk dipotong-potong di sini, bukan ribuan baris sekaligus.
    const totalHalaman = computed(() => Math.max(1, Math.ceil(listDataTersaring.value.length / PER_HALAMAN)));
    const listDataTerpaginasi = computed(() => {
      const mulai = (halamanSaatIni.value - 1) * PER_HALAMAN;
      return listDataTersaring.value.slice(mulai, mulai + PER_HALAMAN);
    });
    function gantiHalaman(delta) {
      halamanSaatIni.value = Math.min(totalHalaman.value, Math.max(1, halamanSaatIni.value + delta));
    }
    const memuat = ref(true);
    const itemSedangDiedit = ref(null);

    // ---- BARU (19 Agt 2026) — Filter Tanggal jadi QUERY SUNGGUHAN ----
    // Defaultnya "Hari Ini" — inilah hemat-nya: buka halaman pertama kali
    // TIDAK LAGI fetch SELURUH riwayat sepanjang masa, cuma tarik yang
    // beneran relevan hari itu. Preset lain (Kemarin/7/30 hari) atau
    // rentang bebas tinggal ganti nilai where() di bawah — TETAP query,
    // bukan fetch-semua-lalu-buang di JS.
    const filterTanggalPreset = ref('hari_ini');
    const tglMulaiCustom = ref('');
    const tglSelesaiCustom = ref('');
    const PER_HALAMAN = 20;
    const halamanSaatIni = ref(1);

    function hitungRentangTanggal(preset, customMulai, customSelesai) {
      const s = new Date();
      const hariIniMulai = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0);
      const hariIniSelesai = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 23, 59, 59, 999);
      if (preset === 'kemarin') {
        const m = new Date(hariIniMulai); m.setDate(m.getDate() - 1);
        const sl = new Date(hariIniSelesai); sl.setDate(sl.getDate() - 1);
        return { mulai: m, selesai: sl };
      }
      if (preset === '7_hari') {
        const m = new Date(hariIniMulai); m.setDate(m.getDate() - 6);
        return { mulai: m, selesai: hariIniSelesai };
      }
      if (preset === '30_hari') {
        const m = new Date(hariIniMulai); m.setDate(m.getDate() - 29);
        return { mulai: m, selesai: hariIniSelesai };
      }
      if (preset === 'custom' && customMulai && customSelesai) {
        const [ym, mm, dm] = customMulai.split('-').map(Number);
        const [ys, ms, ds] = customSelesai.split('-').map(Number);
        return { mulai: new Date(ym, mm - 1, dm, 0, 0, 0, 0), selesai: new Date(ys, ms - 1, ds, 23, 59, 59, 999) };
      }
      return { mulai: hariIniMulai, selesai: hariIniSelesai }; // default & fallback aman: Hari Ini
    }

    const LABEL_PRESET = { hari_ini: 'Hari Ini', kemarin: 'Kemarin', '7_hari': '7 Hari Terakhir', '30_hari': '30 Hari Terakhir', custom: 'Rentang Pilihan' };
    function formatTglCaption(d) { return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); }
    const captionRentang = computed(() => {
      const { mulai, selesai } = hitungRentangTanggal(filterTanggalPreset.value, tglMulaiCustom.value, tglSelesaiCustom.value);
      const sama = mulai.toDateString() === selesai.toDateString();
      const teksTgl = sama ? formatTglCaption(mulai) : `${formatTglCaption(mulai)} — ${formatTglCaption(selesai)}`;
      return `Menampilkan riwayat: ${LABEL_PRESET[filterTanggalPreset.value] || ''} (${teksTgl})`;
    });

    // ---- Migrasi waktu_ts — SEKARANG jadi pengecekan MANUAL (tombol),
    // bukan otomatis tiap buka halaman lagi. Kenapa: query rentang
    // tanggal di bawah TIDAK BISA "melihat" dokumen yang belum punya
    // waktu_ts/waktu_masuk_ts sama sekali (Firestore tidak bisa cocokkan
    // rentang tanggal ke field yang tidak ada) — jadi deteksinya perlu
    // fetch-semua terpisah, SEKALI diklik, bukan dibebankan ke query
    // utama yang justru mau dibikin hemat.
    const migrasi = reactive({ totalBelumMigrasi: 0, sedangProses: false, sudahDicek: false, hasilTerakhir: '' });
    let dokumenBelumMigrasi = [];
    async function cekDataBelumMigrasi() {
      migrasi.sedangProses = true;
      try {
        const snap = await getDocs(collection(db, "absensi"));
        dokumenBelumMigrasi = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          const belumAdaWaktuTs = d.status_acc_masuk !== undefined ? !d.waktu_masuk_ts : !d.waktu_ts;
          if (belumAdaWaktuTs) dokumenBelumMigrasi.push({ id: docSnap.id, waktu: d.waktu || d.waktu_masuk, formatBaru: d.status_acc_masuk !== undefined });
        });
        migrasi.totalBelumMigrasi = dokumenBelumMigrasi.length;
        migrasi.sudahDicek = true;
      } catch (e) {
        console.error("Gagal cek data belum migrasi:", e);
      }
      migrasi.sedangProses = false;
    }

    // BARU (malam 24 Agt 2026) — Migrasi field `nama_shift` (bug ditemukan
    // Guru: "Shift" tidak pernah tampil di Antrean Absensi/Riwayat All
    // Absensi/CSV — root cause: field ini TIDAK PERNAH dititip ke dokumen
    // `absensi` sebelum ronde ini, lihat catatan di js/vue-camera.js).
    // Pola SAMA PERSIS seperti migrasi waktu_ts di atas — tombol manual,
    // aman diulang, dokumen yang sudah punya nama_shift dilewati.
    //
    // KETERBATASAN JUJUR (WAJIB dikasih tau ke Guru, bukan disembunyikan):
    // migrasi ini pakai `nama_shift` KARYAWAN SAAT INI (dari users/{email})
    // sebagai isian dokumen LAMA — BUKAN shift yang sebenarnya berlaku
    // waktu absensi itu terjadi (sistem tidak pernah mencatat itu, tidak
    // bisa dipulihkan). Kalau shift karyawan pernah pindah sejak saat itu,
    // hasil migrasinya BISA MELESET — best-effort, bukan 100% akurat.
    const migrasiShift = reactive({ totalBelumMigrasi: 0, sedangProses: false, sudahDicek: false, hasilTerakhir: '' });
    let dokumenBelumMigrasiShift = [];
    async function cekDataBelumMigrasiShift() {
      migrasiShift.sedangProses = true;
      try {
        const snap = await getDocs(collection(db, "absensi"));
        dokumenBelumMigrasiShift = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          if (!d.nama_shift && d.email) dokumenBelumMigrasiShift.push({ id: docSnap.id, email: d.email });
        });
        migrasiShift.totalBelumMigrasi = dokumenBelumMigrasiShift.length;
        migrasiShift.sudahDicek = true;
      } catch (e) {
        console.error("Gagal cek data belum migrasi nama_shift:", e);
      }
      migrasiShift.sedangProses = false;
    }

    async function jalankanMigrasiShift() {
      if (migrasiShift.totalBelumMigrasi === 0) return;
      if (!confirm(`Migrasi ${migrasiShift.totalBelumMigrasi} dokumen lama sekarang? Isian nama_shift diambil dari shift KARYAWAN SAAT INI (bukan histori) — lihat catatan keterbatasan di atas tombol ini. Proses ini aman diulang kalau terputus.`)) return;

      migrasiShift.sedangProses = true;
      migrasiShift.hasilTerakhir = '';
      let sukses = 0, dilewatiTanpaShift = 0;
      const UKURAN_BATCH = 400;
      const UKURAN_POTONGAN = 30; // batas Firestore where(field,'in',[...])

      try {
        // 1. Kumpulkan nama_shift TERKINI tiap email yang perlu (1x fetch
        // batch, bukan 1 getDoc per dokumen — hemat, pola sama seperti
        // muat() di atas buat jenis_pekerjaan/status_kerja/hp).
        const daftarEmail = [...new Set(dokumenBelumMigrasiShift.map(d => d.email))];
        const petaNamaShift = {};
        for (let i = 0; i < daftarEmail.length; i += UKURAN_POTONGAN) {
          const potongan = daftarEmail.slice(i, i + UKURAN_POTONGAN);
          const qUsers = await getDocs(query(collection(db, "users"), where("email", "in", potongan)));
          qUsers.forEach(u => { petaNamaShift[u.data().email] = u.data().nama_shift || ''; });
        }

        // 2. Tulis batch — dokumen yang emailnya TIDAK ketemu nama_shift
        // apapun (karyawan sudah dihapus, atau memang belum ditugaskan
        // shift) DILEWATI, bukan dipaksa isi string kosong.
        for (let i = 0; i < dokumenBelumMigrasiShift.length; i += UKURAN_BATCH) {
          const potongan = dokumenBelumMigrasiShift.slice(i, i + UKURAN_BATCH);
          const batch = writeBatch(db);
          potongan.forEach(d => {
            const namaShift = petaNamaShift[d.email];
            if (!namaShift) { dilewatiTanpaShift++; return; }
            batch.update(doc(db, "absensi", d.id), { nama_shift: namaShift });
            sukses++;
          });
          await batch.commit();
        }
        migrasiShift.hasilTerakhir = `Selesai! ${sukses} dokumen berhasil dimigrasi.` + (dilewatiTanpaShift > 0 ? ` ${dilewatiTanpaShift} dokumen dilewati (karyawannya saat ini belum/tidak punya nama_shift — bisa dicek manual di Firestore Console kalau perlu).` : '');
        await muat();
      } catch (e) {
        console.error("Gagal migrasi nama_shift:", e);
        migrasiShift.hasilTerakhir = 'Migrasi terhenti karena error: ' + e.message + ' — aman dijalankan ulang, dokumen yang sudah selesai tidak akan diproses dobel.';
      }
      migrasiShift.sedangProses = false;
    }

    async function muat() {
      memuat.value = true;
      try {
        const { mulai, selesai } = hitungRentangTanggal(filterTanggalPreset.value, tglMulaiCustom.value, tglSelesaiCustom.value);
        const tsMulai = Timestamp.fromDate(mulai);
        const tsSelesai = Timestamp.fromDate(selesai);

        // 2 query TERPISAH by DESAIN — dokumen format BARU pakai
        // waktu_masuk_ts, format LAMA pakai waktu_ts (field beda nama,
        // Firestore tidak bisa "OR" antar field beda dalam 1 query).
        // Dokumen yang BELUM py field ini sama sekali (belum migrasi)
        // OTOMATIS tidak ketemu di sini — itu tugas cekDataBelumMigrasi().
        const [snapBaru, snapLama] = await Promise.all([
          getDocs(query(collection(db, "absensi"), where("waktu_masuk_ts", ">=", tsMulai), where("waktu_masuk_ts", "<=", tsSelesai))),
          getDocs(query(collection(db, "absensi"), where("waktu_ts", ">=", tsMulai), where("waktu_ts", "<=", tsSelesai)))
        ]);
        const semuaDok = [];
        snapBaru.forEach(d => semuaDok.push(d));
        snapLama.forEach(d => semuaDok.push(d));

        // DIROMBAK (19 Agt 2026) — dulu SELALU fetch-semua "users" duluan.
        // SEKARANG js/vue-camera.js sudah titip jenis_pekerjaan/status_kerja/
        // hp LANGSUNG di tiap dokumen absensi baru — jadi users CUMA
        // dibaca buat email yang dokumennya masih BOLONG (data lama).
        const emailPerluDicari = new Set();
        semuaDok.forEach(docSnap => {
          const d = docSnap.data();
          if (!d.jenis_pekerjaan || !d.status_kerja || d.hp === undefined) emailPerluDicari.add(d.email);
        });

        const petaHp = {}, petaJenisPekerjaan = {}, petaStatusKerja = {};
        if (emailPerluDicari.size > 0) {
          const daftarEmail = [...emailPerluDicari];
          const UKURAN_POTONGAN = 30; // batas Firestore where(field,'in',[...])
          for (let i = 0; i < daftarEmail.length; i += UKURAN_POTONGAN) {
            const potongan = daftarEmail.slice(i, i + UKURAN_POTONGAN);
            const qUsers = await getDocs(query(collection(db, "users"), where("email", "in", potongan)));
            qUsers.forEach(u => {
              const du = u.data();
              petaHp[du.email] = du.hp || '-';
              petaJenisPekerjaan[du.email] = du.jenis_pekerjaan || '';
              petaStatusKerja[du.email] = du.status_kerja || '';
            });
          }
        }
        function ambilJP(d) { return d.jenis_pekerjaan || petaJenisPekerjaan[d.email] || ''; }
        function ambilStatusKerja(d) { return d.status_kerja || petaStatusKerja[d.email] || ''; }
        function ambilHp(d) { return d.hp || petaHp[d.email] || d.email || '-'; }

        const list = [];
        semuaDok.forEach(docSnap => {
          const d = docSnap.data();
          if (!window.bolehLihatData(ambilJP(d), d.gudang)) return;
          // BARU (permintaan checklist) — karyawan nonaktif/resign tidak
          // perlu muncul di laporan operasional ini.
          if (ambilStatusKerja(d) !== 'Aktif') return;
          d.id = docSnap.id;
          d.hpDicariDariUsers = ambilHp(d);
          list.push(d);
        });

        list.sort((a, b) => (window.parseWaktuIndo(waktuUntukSortir(b))?.getTime() || 0) - (window.parseWaktuIndo(waktuUntukSortir(a))?.getTime() || 0));
        listData.value = list;
        halamanSaatIni.value = 1; // reset ke halaman 1 tiap filter tanggal/cari berubah
      } catch (e) {
        console.error("Gagal muat rekap global:", e);
      }
      memuat.value = false;
    }

    async function jalankanMigrasi() {
      if (migrasi.totalBelumMigrasi === 0) return;
      if (!confirm(`Migrasi ${migrasi.totalBelumMigrasi} dokumen lama sekarang? Proses ini aman diulang kalau terputus di tengah jalan (dokumen yang sudah selesai tidak akan diproses ulang).`)) return;

      migrasi.sedangProses = true;
      migrasi.hasilTerakhir = '';
      let sukses = 0, gagalParsing = 0;
      const UKURAN_BATCH = 400;

      try {
        for (let i = 0; i < dokumenBelumMigrasi.length; i += UKURAN_BATCH) {
          const potongan = dokumenBelumMigrasi.slice(i, i + UKURAN_BATCH);
          const batch = writeBatch(db);
          potongan.forEach(d => {
            const tanggalTerurai = window.parseWaktuIndo(d.waktu);
            if (!tanggalTerurai) { gagalParsing++; return; }
            // Field target waktu_ts vs waktu_masuk_ts sudah ditentukan
            // pas dikumpulkan di cekDataBelumMigrasi() (d.formatBaru) —
            // JANGAN cari lagi di listData.value, karena sekarang
            // listData sudah dibatasi rentang tanggal (19 Agt 2026),
            // dokumen lama yang mau dimigrasi kemungkinan besar TIDAK
            // ADA di situ (sumber data beda: fetch-semua vs date-scoped).
            const fieldTarget = d.formatBaru ? 'waktu_masuk_ts' : 'waktu_ts';
            batch.update(doc(db, "absensi", d.id), { [fieldTarget]: Timestamp.fromDate(tanggalTerurai) });
            sukses++;
          });
          await batch.commit();
        }
        migrasi.hasilTerakhir = `Selesai! ${sukses} dokumen berhasil dimigrasi.` + (gagalParsing > 0 ? ` ${gagalParsing} dokumen dilewati (format tanggal lama tidak terbaca — bisa dicek manual di Firestore Console kalau perlu).` : '');
        await muat();
      } catch (e) {
        console.error("Gagal migrasi waktu_ts:", e);
        migrasi.hasilTerakhir = 'Migrasi terhenti karena error: ' + e.message + ' — aman dijalankan ulang, dokumen yang sudah selesai tidak akan diproses dobel.';
      }
      migrasi.sedangProses = false;
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
      if (window.hapusAbsensi) window.hapusAbsensi(docId).then(muat);
    }

    async function assignUlang(docId) {
      if (!confirm("Kembalikan data ini ke Antrean Absensi untuk diperiksa ulang?")) return;
      try {
        const item = listData.value.find(x => x.id === docId);
        const adalahBaru = item && item.status_acc_masuk !== undefined;
        // Dokumen BARU: assign ulang KEDUA sisi (masuk & keluar kalau
        // ada) — lebih aman daripada nebak sisi mana yang dimaksud.
        const dataUpdate = adalahBaru
          ? { status_acc_masuk: 'PENDING', ada_pending: true, ...(item.waktu_keluar ? { status_acc_keluar: 'PENDING' } : {}) }
          : { status_acc: 'PENDING' };
        await updateDoc(doc(db, "absensi", docId), dataUpdate);
        alert("Data berhasil di-assign ulang ke Antrean Absensi.");
        await muat();
      } catch (e) {
        console.error("Gagal assign ulang:", e);
        alert("Gagal memproses assign ulang.");
      }
    }

    function exportCSV() {
      if (listDataTersaring.value.length === 0) return alert("Tidak ada data untuk di-export sesuai filter tanggal/cari yang aktif.");

      let csvContent = "data:text/csv;charset=utf-8,";
      // BARU (19 Agt 2026) — baris caption di awal CSV, biar siapapun yang
      // buka filenya nanti (tanpa lihat aplikasi) tetap tau ini data
      // rentang tanggal berapa & sedang dicari nama apa (kalau ada).
      csvContent += `"${captionRentang.value}${cariNama.value.trim() ? ' | Cari: ' + cariNama.value.trim() : ''}"\n\n`;
      csvContent += "Nama Pegawai,Email,Tipe Absen,Gudang,Shift,Waktu Clock In,Status ACC Masuk,Waktu Clock Out,Status ACC Keluar,Seragam\n";

      listDataTersaring.value.forEach(row => {
        const f = formatBaris(row);
        const nama = `"${(row.nama_pegawai || row.nama || '').replace(/"/g, '""')}"`;
        const email = `"${(row.email || '').replace(/"/g, '""')}"`;
        const status = `"${row.status || 'HADIR'}"`;
        const gudang = `"${row.gudang || '-'}"`;
        const shift = `"${row.nama_shift || '-'}"`;
        const waktuMasuk = `"${f.waktuMasuk || '-'}"`;
        const accMasuk = `"${f.statusAccMasuk || '-'}"`;
        const waktuKeluar = `"${f.waktuKeluar || '-'}"`;
        const accKeluar = `"${f.statusAccKeluar || '-'}"`;
        const seragam = `"${f.seragamMasuk || f.seragamKeluar || 'Sesuai'}"`;
        csvContent += `${nama},${email},${status},${gudang},${shift},${waktuMasuk},${accMasuk},${waktuKeluar},${accKeluar},${seragam}\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Data_Absensi_Zevanic_${filterTanggalPreset.value}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    watch(cariNama, () => { halamanSaatIni.value = 1; });
    watch([filterTanggalPreset, tglMulaiCustom, tglSelesaiCustom], () => {
      // Rentang custom: JANGAN re-fetch sebelum DUA tanggal terisi —
      // hindari query aneh (mis. cuma tglMulai terisi, tglSelesai kosong).
      if (filterTanggalPreset.value === 'custom' && (!tglMulaiCustom.value || !tglSelesaiCustom.value)) return;
      muat();
    });

    onMounted(async () => { await window.authReady; muat(); });
    return {
      listData, listDataTersaring, listDataTerpaginasi, cariNama, memuat, itemSedangDiedit, muat, pisahTanggalWaktu, lihatFotoBesar,
      bukaEdit, tutupEdit, selesaiSimpan, hapus, assignUlang, exportCSV, migrasi, jalankanMigrasi, cekDataBelumMigrasi,
      migrasiShift, jalankanMigrasiShift, cekDataBelumMigrasiShift,
      formatBaris,
      filterTanggalPreset, tglMulaiCustom, tglSelesaiCustom, captionRentang,
      halamanSaatIni, totalHalaman, gantiHalaman
    };
  },
  template: `
    <div class="gc-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <div>
         <h3 class="gc-heading" style="font-weight:700; font-size:13.5px;"><i class="fas fa-database" style="color:var(--burgundy); margin-right:8px;"></i> Riwayat All Absensi</h3>
         <p style="font-size:10.5px; color:var(--text-muted); margin-top:3px;">Laporan lengkap seluruh karyawan. Anda bisa mengunduhnya untuk keperluan Payroll.</p>
      </div>
      <button @click="exportCSV" class="btn-outline filled" style="display:flex; align-items:center; gap:8px;">
          <i class="fas fa-file-excel"></i><span>Unduh Excel (CSV)</span>
      </button>
    </div>

    <div class="gc-card" style="margin-bottom:16px;">
      <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
        <select v-model="filterTanggalPreset" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface); font-weight:600;">
          <option value="hari_ini">Hari Ini</option>
          <option value="kemarin">Kemarin</option>
          <option value="7_hari">7 Hari Terakhir</option>
          <option value="30_hari">30 Hari Terakhir</option>
          <option value="custom">Pilih Tanggal Sendiri...</option>
        </select>
        <template v-if="filterTanggalPreset === 'custom'">
          <input v-model="tglMulaiCustom" type="date" style="padding:7px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px;">
          <span style="color:var(--text-faint); font-size:12px;">s/d</span>
          <input v-model="tglSelesaiCustom" type="date" style="padding:7px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px;">
        </template>
        <button @click="cekDataBelumMigrasi" :disabled="migrasi.sedangProses" class="btn-outline" style="margin-left:auto; font-size:11px; padding:7px 12px;" title="Cek sekali data sangat lama yang belum ke-migrasi (tidak otomatis, di luar rentang tanggal di atas)">
          <i class="fas fa-magnifying-glass" style="margin-right:5px;"></i>Cek Data Belum Migrasi
        </button>
        <button @click="cekDataBelumMigrasiShift" :disabled="migrasiShift.sedangProses" class="btn-outline" style="font-size:11px; padding:7px 12px;" title="Cek data lama yang belum punya nama Shift (bug BARU diperbaiki 24 Agt 2026 — lihat catatan di banner kalau ketemu)">
          <i class="fas fa-users-rectangle" style="margin-right:5px;"></i>Cek Data Belum Punya Shift
        </button>
      </div>
      <p style="font-size:11px; color:var(--text-muted); margin-top:10px; font-style:italic;"><i class="fas fa-circle-info" style="margin-right:5px;"></i>{{ captionRentang }}</p>
    </div>

    <div v-if="migrasi.sudahDicek && migrasi.totalBelumMigrasi > 0" class="gc-card" style="background:var(--warn-light); border:1.5px solid var(--warn); margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap;">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <i class="fas fa-clock-rotate-left" style="color:var(--warn); font-size:18px; margin-top:2px;"></i>
          <div>
            <h4 class="gc-heading" style="font-weight:700; font-size:12.5px;">{{ migrasi.totalBelumMigrasi }} data lama belum punya Timestamp asli</h4>
            <p style="font-size:11px; color:var(--text-muted); margin-top:3px; max-width:480px;">Data ini masih tersimpan sebagai teks — belum bisa muncul lewat filter tanggal di atas sampai dimigrasi. Migrasi ini AMAN dijalankan kapan saja, boleh diulang kalau terputus.</p>
            <p v-if="migrasi.hasilTerakhir" style="font-size:11px; color:var(--text); margin-top:6px; font-weight:600;">{{ migrasi.hasilTerakhir }}</p>
          </div>
        </div>
        <button @click="jalankanMigrasi" :disabled="migrasi.sedangProses" class="btn-outline filled" style="flex-shrink:0;">
          {{ migrasi.sedangProses ? 'Sedang migrasi...' : 'Jalankan Migrasi' }}
        </button>
      </div>
    </div>

    <div v-if="migrasiShift.sudahDicek && migrasiShift.totalBelumMigrasi > 0" class="gc-card" style="background:var(--warn-light); border:1.5px solid var(--warn); margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap;">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <i class="fas fa-users-rectangle" style="color:var(--warn); font-size:18px; margin-top:2px;"></i>
          <div>
            <h4 class="gc-heading" style="font-weight:700; font-size:12.5px;">{{ migrasiShift.totalBelumMigrasi }} data lama belum punya nama Shift</h4>
            <p style="font-size:11px; color:var(--text-muted); margin-top:3px; max-width:520px;">Kolom "Shift" data ini kosong karena bug lama (baru diperbaiki 24 Agt 2026) yang belum sempat menyimpan nama shift. Migrasi ini isi nama_shift pakai shift karyawan SAAT INI (bukan histori — kalau shift-nya pernah pindah, hasilnya bisa meleset). AMAN dijalankan kapan saja, boleh diulang kalau terputus.</p>
            <p v-if="migrasiShift.hasilTerakhir" style="font-size:11px; color:var(--text); margin-top:6px; font-weight:600;">{{ migrasiShift.hasilTerakhir }}</p>
          </div>
        </div>
        <button @click="jalankanMigrasiShift" :disabled="migrasiShift.sedangProses" class="btn-outline filled" style="flex-shrink:0;">
          {{ migrasiShift.sedangProses ? 'Sedang migrasi...' : 'Jalankan Migrasi' }}
        </button>
      </div>
    </div>

    <div v-if="memuat" style="text-align:center; padding:40px 0; color:var(--text-faint); font-size:12px;"><i class="fas fa-spinner fa-spin" style="font-size:26px; margin-bottom:10px; display:block;"></i>Menyiapkan Riwayat All Absensi...</div>

    <div v-if="!memuat && listData.length > 0" style="position:relative; margin-bottom:14px; max-width:320px;">
      <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
      <input v-model="cariNama" type="text" placeholder="Cari nama karyawan..." style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
    </div>

    <div v-if="!memuat" class="gc-table-scroll" style="background:var(--surface); border:1px solid var(--line);">
      <table class="gc-table">
        <thead>
          <tr>
            <th>Persetujuan / Tipe Absen</th>
            <th>Nama / No HP</th>
            <th>Gudang / Shift</th>
            <th>Tanggal - Waktu Clock In</th>
            <th>Tanggal - Waktu Clock Out</th>
            <th>Foto</th>
            <th>Status Kehadiran / Seragam</th>
            <th>Sanggahan Karyawan</th>
            <th>Pemeriksa</th>
            <th class="freeze freeze-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="listData.length === 0"><td colspan="10" style="text-align:center; padding:20px; color:var(--text-faint);">Tidak ada data absensi pada rentang tanggal ini.</td></tr>
          <tr v-else-if="listDataTersaring.length === 0"><td colspan="10" style="text-align:center; padding:20px; color:var(--text-faint);">Tidak ada nama yang cocok dicari.</td></tr>
          <tr v-for="item in listDataTerpaginasi" :key="item.id">
            <td>
              <b>
                <span v-if="formatBaris(item).statusAccMasuk === 'ACC'" style="color:var(--ok);">Masuk: ACC</span>
                <span v-else-if="formatBaris(item).statusAccMasuk === 'REJECT'" style="color:var(--danger);">Masuk: REJECT</span>
                <span v-else-if="formatBaris(item).statusAccMasuk === 'PENDING'" style="color:var(--warn);">Masuk: PENDING</span>
              </b>
              <br v-if="formatBaris(item).statusAccMasuk && formatBaris(item).statusAccKeluar">
              <b>
                <span v-if="formatBaris(item).statusAccKeluar === 'ACC'" style="color:var(--ok);">Keluar: ACC</span>
                <span v-else-if="formatBaris(item).statusAccKeluar === 'REJECT'" style="color:var(--danger);">Keluar: REJECT</span>
                <span v-else-if="formatBaris(item).statusAccKeluar === 'PENDING'" style="color:var(--warn);">Keluar: PENDING</span>
              </b>
              <br><span style="font-size:10.5px; color:var(--text-muted); font-weight:400;">{{ item.status || 'HADIR' }}</span>
            </td>
            <td><dua-baris :a="item.nama_pegawai || item.nama" :b="item.hpDicariDariUsers" /></td>
            <td><dua-baris :a="item.gudang" :b="item.nama_shift" /></td>
            <td><dua-baris :a="pisahTanggalWaktu(formatBaris(item).waktuMasuk).tgl" :b="pisahTanggalWaktu(formatBaris(item).waktuMasuk).jam" /></td>
            <td><dua-baris :a="pisahTanggalWaktu(formatBaris(item).waktuKeluar).tgl" :b="pisahTanggalWaktu(formatBaris(item).waktuKeluar).jam" /></td>
            <td>
              <img v-if="formatBaris(item).fotoMasuk || formatBaris(item).fotoKeluar" :src="formatBaris(item).fotoMasuk || formatBaris(item).fotoKeluar" @click="lihatFotoBesar(formatBaris(item).fotoMasuk || formatBaris(item).fotoKeluar)" style="width:40px; height:40px; border-radius:10px; object-fit:cover; border:1px solid var(--line); cursor:pointer;">
              <span v-else style="color:var(--text-faint);">-</span>
            </td>
            <td><dua-baris :a="formatBaris(item).statusKehadiranMasuk || formatBaris(item).statusKehadiranKeluar" :b="formatBaris(item).seragamMasuk || formatBaris(item).seragamKeluar || 'Sesuai'" /></td>
            <td class="gc-cell-muted" style="max-width:160px; overflow:hidden; text-overflow:ellipsis;" :title="item.catatan_banding || ''">{{ item.catatan_banding || '-' }}</td>
            <td class="gc-cell-muted">{{ item.validated_by || item.validated_by_masuk || item.validated_by_keluar || '-' }}</td>
            <td class="freeze freeze-right">
              <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                <button @click="bukaEdit(item)" class="icon-btn" title="Edit"><i class="fas fa-edit"></i></button>
                <button @click="hapus(item.id)" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button>
                <button v-if="item.catatan_banding" @click="assignUlang(item.id)" class="icon-btn" style="color:var(--warn);" title="Assign ulang ke Antrean Absensi"><i class="fas fa-undo"></i></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!memuat && listDataTersaring.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
      <button class="icon-btn" :disabled="halamanSaatIni <= 1" @click="gantiHalaman(-1)"><i class="fas fa-chevron-left"></i></button>
      <span style="font-size:12px; color:var(--text-muted);">Halaman {{ halamanSaatIni }} / {{ totalHalaman }} &middot; {{ listDataTersaring.length }} baris</span>
      <button class="icon-btn" :disabled="halamanSaatIni >= totalHalaman" @click="gantiHalaman(1)"><i class="fas fa-chevron-right"></i></button>
    </div>

    <edit-absensi-modal v-if="itemSedangDiedit" :item="itemSedangDiedit" @tutup="tutupEdit" @tersimpan="selesaiSimpan" />
  `
};

let vmRiwayatAbsensi = null;
window.pastikanMountRiwayatAbsensi = function() {
  if (vmRiwayatAbsensi) return;
  const mountPoint = document.getElementById('vue-riwayat-absensi');
  if (mountPoint) vmRiwayatAbsensi = createApp(AppRiwayatAbsensi).mount('#vue-riwayat-absensi');
};
window.refreshRiwayatAbsensi = function() { if (vmRiwayatAbsensi) vmRiwayatAbsensi.muat(); };
