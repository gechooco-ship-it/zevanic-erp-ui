// js/vue-home-desktop.js
// ============================================================================
// REDESAIN TOTAL (30 Agt 2026) — dulu file ini cuma mount PengumumanCarousel
// + QuoteCard (komponen bersama vue-components.js) ke 2 target kecil di
// bawah banner "Selamat datang" statis. SEKARANG jadi 1 komponen penuh
// `BerandaDesktop` — dashboard sungguhan untuk layar Beranda desktop (KPI,
// Pipeline Persiapan, Pipeline Produksi, Perlu Tindakan Anda, kartu Quote,
// notif lonceng di topbar) — hasil adaptasi paket design handoff
// `design_handoff_zevanic_desktop` + 3 ronde revisi mockup artefak "Zevanic
// Desktop Adaptasi" (izin eksplisit Guru buat mulai koding, 30 Agt 2026).
// Mount ke #vue-beranda-desktop (index.html, di dalam #tab-home, hidden
// md:block) — GANTI TOTAL #vue-pengumuman-desktop/#vue-quote-desktop lama
// (dicopot dari index.html, TIDAK dipakai lagi).
//
// KEPUTUSAN via AskUserQuestion (Guru, 30 Agt 2026), WAJIB dibaca sebelum
// ubah file ini:
// 1. Cakupan: Beranda dashboard PENUH (bukan cuma shell kosong).
// 2. Pipeline Produksi (jalur Cutting/Serie/Sewing/Finishing) BELUM ada
//    skema data di spk_track — sengaja UI-only, angka "–" + label "Segera
//    Hadir", TIDAK baca Firestore sama sekali. Jangan diisi angka contoh
//    seakan-akan data asli.
// 3. "Serie" = proses PENGGABUNGAN dari Bahan + Acc Sewing + Acc Webbing +
//    Acc Vendor (kalau ada) — dicatat di sini biar tidak hilang konteksnya
//    kalau nanti skema datanya benar-benar dibangun.
// 4. Warna kartu KPI & Quote SENGAJA gradien maroon (.gc-kartu-gradien,
//    SAMA seperti kartu shift mobile) — PENGECUALIAN dari aturan porsi
//    warna "burgundy dijaga ketat 5%" (PETA-DESAIN.md), KHUSUS Beranda
//    desktop, permintaan eksplisit Guru. Tampilan MOBILE (vue-home.js)
//    TIDAK BOLEH ikut berubah sama sekali — file itu tidak disentuh.
//
// REVISI (30 Agt 2026, sesi lanjutan) — permintaan eksplisit Guru:
// "jam shift dan erp portal hapus ganti dengan yg sesuai mockup, lalu
// kartu absen dari mobil bisa diambil tempel di dashboard. aktifitas
// terbaru tampilkan mockup dan pintasan keyboard juga. anggap mockup yg
// dilivekan." Ini MEMBALIK keputusan saya sendiri sebelumnya (lihat riwayat
// git) yang SENGAJA tidak membangun 2 kartu di bawah. Sekarang dibangun,
// TAPI tetap jujur soal sifatnya:
// 5. Kartu Absen (kolom kanan, paling atas) — REAL, bukan ilustratif. Logic
//    & style diambil PERSIS dari kartu shift mobile (js/vue-home.js
//    muatShift() + window.cekStatusClockInSaya()) — read-only, TANPA
//    tombol Clock In/Out (clock in/scan QR tetap di app mobile, sesuai teks
//    keterangan kartu ini sendiri).
// 6. "Aktivitas Terbaru" & "Pintasan Papan Tik" (kolom kanan, bawah Quote)
//    — KONTEN STATIS/ILUSTRATIF (persis isi mockup, BUKAN data live). Tidak
//    ada koleksi log aktivitas lintas-modul di skema data sungguhan
//    (PETA-DATABASE.md) dan tidak ada command palette Ctrl+K sungguhan di
//    app ini — jadi 2 kartu ini SENGAJA berisi data contoh, atas instruksi
//    eksplisit Guru ("anggap mockup yg dilivekan"), BUKAN diam-diam
//    dianggap data asli. Kalau nanti mau versi live beneran, itu perlu
//    koleksi log aktivitas baru — proyek terpisah, belum diminta.
// 7. Topbar (index.html, bukan file ini) — "ERP Portal" statis + badge
//    countdown shift (dulu ditimpa js/dashboard.js mulaiHitungJamKerja(),
//    asumsi jam shift "01:00" utk SEMUA orang — TIDAK akurat) DICOPOT,
//    diganti breadcrumb gaya mockup ("Umum › Beranda", statis dulu karena
//    baru Beranda yang dibangun). #label-badge-role dihapus dari DOM;
//    js/auth.js (baris pengisi innerHTML-nya) DIBERI null-guard supaya
//    tidak crash kalau elemen itu dicari lagi nanti.
//
// EFISIENSI BACA FIRESTORE (WAJIB — lihat STATUS-PROYEK.md §6, pelajaran
// "boros baca N+1/full-collection-scan" yang pernah kejadian nyata di App
// ini di skala ~500 karyawan): SEMUA KPI di bawah pakai getCountFromServer()
// (1 baca per query, TIDAK tarik dokumennya), KECUALI "Perlu Disiapkan" —
// itu SATU-SATUNYA yang tetap getDocs() biasa, karena meniru PERSIS query
// PersiapanDisiapkanManager (js/vue-persiapan-produksi-v2.js): filter
// "belum ada id_spk_grouping" itu dilakukan DI CLIENT (Firestore tidak
// bisa where() field yang tidak ada), bukan sesuatu yang saya lupa
// optimalkan.
//
// APROKSIMASI yang disengaja & didokumentasikan (bukan tebakan):
// - KPI "Antrean Reimburse" pakai pemetaan role->tahap SAMA seperti
//   `tahapUntukRoleSaya()` di js/vue-reimburse.js, TAPI untuk Owner/
//   Superuser saya hitung cuma tahap 'menunggu_owner' (bukan seluruh
//   koleksi tanpa where() seperti layar detailnya) — supaya arti KPI-nya
//   konsisten "berapa yang perlu SAYA proses", bukan "semua data reimburse
//   yang pernah ada". Filter dimensi gudang/jenis_pekerjaan
//   (`window.bolehLihatData`) TIDAK ikut diterapkan di angka KPI ini (itu
//   filter client-side setelah fetch penuh, tidak bisa dipakai bareng
//   getCountFromServer) — jadi angka KPI ini bisa SEDIKIT lebih tinggi
//   dari yang benar-benar terlihat begitu Guru buka layar Antrean
//   Reimburse aslinya. Trade-off sadar: hemat baca vs presisi 100%.
// - KPI "Antrean Absensi" = jumlah dokumen `ada_pending==true` DITAMBAH
//   `status_acc=='PENDING'` (2 query count terpisah dijumlah) — meniru
//   persis 2 query di js/vue-antrean-absensi.js (format baru vs lama).
// ============================================================================
import { createApp, ref, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, query, where, getDocs, getCountFromServer, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const JALUR_PERSIAPAN = [
  { key: 'vendor', label: 'Vendor', ico: 'fa-truck-field', ket: 'Menunggu diproses jalur Vendor' },
  { key: 'bahan', label: 'Bahan', ico: 'fa-swatchbook', ket: 'Menunggu diproses jalur Bahan' },
  { key: 'sewing', label: 'Acc Sewing', ico: 'fa-link', ket: 'Menunggu diproses jalur Acc Sewing' },
  { key: 'webbing', label: 'Acc Webbing', ico: 'fa-ribbon', ket: 'Menunggu diproses jalur Acc Webbing' },
  { key: 'finishing', label: 'Acc Finishing', ico: 'fa-broom', ket: 'Menunggu diproses jalur Acc Finishing' }
];
const STATUS_BELUM_SELESAI = ['perlu_diproses', 'sedang_diproses', 'perlu_dikirim', 'sedang_dikirim'];
const PRODUKSI_PLACEHOLDER = [
  { label: 'Cutting', ico: 'fa-scissors' },
  { label: 'Serie', ico: 'fa-list-ol' },
  { label: 'Sewing', ico: 'fa-shirt' },
  { label: 'Finishing', ico: 'fa-check-double' }
];

// KONTEN STATIS/ILUSTRATIF (bukan Firestore) — lihat poin 6 di komentar
// header file ini soal kenapa & atas instruksi siapa.
const AKTIVITAS_ILUSTRATIF = [
  { warna: 'var(--ok)', teks: 'Rina Wulandari absen masuk — Gudang Utama', jam: '09:02' },
  { warna: 'var(--warn)', teks: 'SPKG260830004 pindah ke Sedang Diproses', jam: '08:47' },
  { warna: 'var(--ok)', teks: 'Reimburse bensin Rp 180.000 disetujui', jam: '08:31' },
  { warna: 'var(--text-faint)', teks: 'Order SPK-2608-021 dibuat Admin Gudang', jam: '08:15' },
  { warna: 'var(--danger)', teks: 'Persiapan Masalah baru: kain kurang 12 m', jam: '07:58' }
];
const PINTASAN_ILUSTRATIF = [
  { k: 'Ctrl K', teks: 'Lompat ke menu apa saja' },
  { k: '/', teks: 'Fokus ke kolom cari' },
  { k: 'N', teks: 'Tambah data baru' },
  { k: 'J / K', teks: 'Pindah kartu naik-turun' },
  { k: 'Esc', teks: 'Tutup panel kanan' }
];

const BerandaDesktop = {
  setup() {
    // ---- KPI (4 kartu atas) ----
    const kpiMasalah = ref(null);
    const kpiDakar = ref(null);
    const kpiAbsensi = ref(null);
    const kpiReimburse = ref(null);

    async function muatKpiMasalah() {
      try {
        const snap = await getCountFromServer(query(collection(db, 'persiapan_masalah'), where('status', '==', 'menunggu')));
        kpiMasalah.value = snap.data().count;
      } catch (e) { console.error('KPI Persiapan Masalah gagal dimuat:', e); kpiMasalah.value = null; }
    }
    async function muatKpiDakar() {
      try {
        const snap = await getCountFromServer(collection(db, 'pendaftaran_pending'));
        kpiDakar.value = snap.data().count;
      } catch (e) { console.error('KPI Antrean Dakar gagal dimuat:', e); kpiDakar.value = null; }
    }
    async function muatKpiAbsensi() {
      try {
        const [a, b] = await Promise.all([
          getCountFromServer(query(collection(db, 'absensi'), where('ada_pending', '==', true))),
          getCountFromServer(query(collection(db, 'absensi'), where('status_acc', '==', 'PENDING')))
        ]);
        kpiAbsensi.value = a.data().count + b.data().count;
      } catch (e) { console.error('KPI Antrean Absensi gagal dimuat:', e); kpiAbsensi.value = null; }
    }
    async function muatKpiReimburse() {
      try {
        const role = (window.currentUser?.role || '').toLowerCase();
        let tahap = null;
        if (role === 'admin') tahap = 'menunggu_admin_finance';
        else if (role === 'pic') tahap = 'menunggu_pic';
        else if (role === 'owner' || role === 'superuser') tahap = 'menunggu_owner';
        else { kpiReimburse.value = 0; return; } // operator dkk: tidak berwenang approve reimburse
        const snap = await getCountFromServer(query(collection(db, 'reimburse'), where('tahap', '==', tahap)));
        kpiReimburse.value = snap.data().count;
      } catch (e) { console.error('KPI Antrean Reimburse gagal dimuat:', e); kpiReimburse.value = null; }
    }

    // ---- Pipeline Persiapan (6 kartu real: Perlu Disiapkan + 5 jalur) ----
    const persiapanDisiapkan = ref(null);
    const persiapanJalur = ref(JALUR_PERSIAPAN.map(j => ({ ...j, n: null })));

    async function muatPerluDisiapkan() {
      try {
        // SAMA PERSIS logic PersiapanDisiapkanManager (vue-persiapan-produksi-v2.js):
        // tarik order_spk status Aktif, buang yang SUDAH punya id_spk_grouping.
        const snap = await getDocs(query(collection(db, 'order_spk'), where('status', '==', 'Aktif')));
        let n = 0;
        snap.forEach(d => { if (!d.data().id_spk_grouping) n++; });
        persiapanDisiapkan.value = n;
      } catch (e) { console.error('Pipeline Perlu Disiapkan gagal dimuat:', e); persiapanDisiapkan.value = null; }
    }
    async function muatJalurPersiapan() {
      // SENGAJA 4 query where('jalur','==',x).where('status','==',y) TERPISAH
      // per jalur (dijumlah di client), BUKAN 1 query where('status','in',[...]).
      // Alasan: where(jalur=='x').where(status=='y') itu pola yang SAMA PERSIS
      // sudah jalan di JalurTahapManager (vue-persiapan-produksi-v2.js) —
      // dipastikan sudah ke-index otomatis (equality-only). Kombinasi
      // equality + 'in' pada field BERBEDA biasanya butuh COMPOSITE INDEX
      // baru yang belum tentu ada di Firestore Console — daripada resiko
      // dashboard error "query requires an index" begitu Guru buka
      // gechoo.online, lebih baik 4x getCountFromServer (tetap murah, count
      // query = 1 baca per panggilan berapa pun besar koleksinya).
      await Promise.all(persiapanJalur.value.map(async (j) => {
        try {
          const hasil = await Promise.all(STATUS_BELUM_SELESAI.map(st =>
            getCountFromServer(query(collection(db, 'spk_track'), where('jalur', '==', j.key), where('status', '==', st)))
          ));
          j.n = hasil.reduce((total, snap) => total + snap.data().count, 0);
        } catch (e) { console.error('Pipeline jalur ' + j.key + ' gagal dimuat:', e); j.n = null; }
      }));
    }

    const totalPersiapan = () => {
      const angka = [persiapanDisiapkan.value, ...persiapanJalur.value.map(j => j.n)];
      if (angka.some(a => a === null)) return null;
      return angka.reduce((a, b) => a + b, 0);
    };

    // ---- Kartu Absen (REAL, kolom kanan paling atas) — logic & style
    // diambil PERSIS dari kartu shift mobile (js/vue-home.js muatShift() +
    // window.cekStatusClockInSaya()), read-only (tanpa tombol Clock
    // In/Out — itu tetap di app mobile). ----
    const shiftAbsen = ref({ nama: '', jamMasuk: '', jamKeluar: '', gudang: '-' });
    const sudahAbsenHariIni = ref(false);
    async function muatKartuAbsen() {
      try {
        const status = await window.cekStatusClockInSaya(window.currentUser?.email || '');
        sudahAbsenHariIni.value = status.aktif;
      } catch (e) { console.error('Status absen (desktop) gagal dimuat:', e); }
      try {
        const gudangList = window.normalisasiGudang ? window.normalisasiGudang(window.currentUser?.gudang_penempatan) : [];
        shiftAbsen.value.gudang = gudangList.length > 0 ? gudangList.join(', ') : '-';
        const namaShift = window.currentUser?.nama_shift;
        if (!namaShift) return;
        const snap = await getDocs(collection(db, 'master_shift'));
        snap.forEach(d => {
          const s = d.data();
          if (s.nama_shift === namaShift) {
            shiftAbsen.value.nama = s.nama_shift;
            shiftAbsen.value.jamMasuk = s.jam_masuk || '';
            shiftAbsen.value.jamKeluar = s.jam_keluar || '';
          }
        });
      } catch (e) { console.error('Kartu Absen (desktop) gagal dimuat shift:', e); }
    }

    // ---- Kartu Quote (data SAMA seperti QuoteCard bersama, warna beda) ----
    // BUG DITEMUKAN & DIPERBAIKI (30 Agt 2026, sesi lanjutan lagi) — sama
    // persis akar masalahnya dengan QuoteCard bersama di vue-components.js
    // (baca komentar bug-fix lengkap di sana): hariIni dulu pakai
    // toISOString() (UTC), bukan tanggal LOKAL device — meleset 7 jam tiap
    // hari 00:00-06:59 WIB dibanding tanggal yang dilihat admin di form
    // Quote Harian. Fix sama: pakai getFullYear/getMonth/getDate.
    const quote = ref(null);
    const memuatQuote = ref(true);
    async function muatQuote() {
      memuatQuote.value = true;
      try {
        // REVISI (30 Agt 2026, sesi lanjutan lagi) — dipertegas pakai
        // timezone Asia/Jakarta EKSPLISIT (bukan ngikut timezone device
        // apa adanya), lihat komentar lengkap di vue-components.js.
        const hariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        const snap = await getDocs(query(collection(db, 'quotes'), where('tanggalTampil', '==', hariIni), limit(1)));
        quote.value = snap.empty ? null : snap.docs[0].data();
      } catch (e) { quote.value = null; }
      memuatQuote.value = false;
    }

    // ---- Notif lonceng Pengumuman (POLA SAMA PERSIS js/vue-header-mobile.js,
    // termasuk key localStorage — SENGAJA sama, biar status "sudah dibaca"
    // konsisten antara lonceng mobile & lonceng desktop) ----
    const daftarNotif = ref([]);
    const memuatNotif = ref(true);
    const notifTerbuka = ref(false);
    const jumlahBelumDibaca = ref(0);
    const KUNCI_TERAKHIR_DILIHAT = 'zevanic_notif_terakhir_dilihat_';
    function kunciUser() { return KUNCI_TERAKHIR_DILIHAT + (window.currentUser?.email || ''); }

    async function muatNotif() {
      memuatNotif.value = true;
      try {
        const snap = await getDocs(query(collection(db, 'pengumuman'), orderBy('dibuat_pada', 'desc'), limit(15)));
        const roleSaya = (window.currentUser?.role || 'operator').toLowerCase();
        const list = [];
        snap.forEach(d => {
          const data = d.data();
          const rolesTampil = data.rolesTampil || [];
          if (rolesTampil.length === 0 || rolesTampil.includes(roleSaya)) list.push({ id: d.id, ...data });
        });
        daftarNotif.value = list;
        const terakhirDilihat = localStorage.getItem(kunciUser());
        jumlahBelumDibaca.value = terakhirDilihat
          ? list.filter(p => (p.dibuat_pada?.toDate ? p.dibuat_pada.toDate().toISOString() : p.dibuat_pada) > terakhirDilihat).length
          : list.length;
      } catch (e) {
        console.error('Notif Pengumuman (desktop) gagal dimuat:', e);
        daftarNotif.value = []; jumlahBelumDibaca.value = 0;
      }
      memuatNotif.value = false;
    }
    function toggleNotif() {
      notifTerbuka.value = !notifTerbuka.value;
      if (notifTerbuka.value) {
        localStorage.setItem(kunciUser(), new Date().toISOString());
        jumlahBelumDibaca.value = 0;
      }
    }
    function tutupNotif() { notifTerbuka.value = false; }

    onMounted(async () => {
      await window.authReady;
      muatKpiMasalah(); muatKpiDakar(); muatKpiAbsensi(); muatKpiReimburse();
      muatPerluDisiapkan(); muatJalurPersiapan();
      muatQuote(); muatNotif(); muatKartuAbsen();
    });

    return {
      kpiMasalah, kpiDakar, kpiAbsensi, kpiReimburse,
      persiapanDisiapkan, persiapanJalur, totalPersiapan, produksiPlaceholder: PRODUKSI_PLACEHOLDER,
      shiftAbsen, sudahAbsenHariIni,
      quote, memuatQuote,
      aktivitasIlustratif: AKTIVITAS_ILUSTRATIF, pintasanIlustratif: PINTASAN_ILUSTRATIF,
      daftarNotif, memuatNotif, notifTerbuka, jumlahBelumDibaca, toggleNotif, tutupNotif
    };
  },
  template: `
    <div>
      <div class="gc-kpi-row">
        <div class="gc-kpi-card gc-kartu-gradien">
          <div class="gc-kpi-top"><div class="gc-kpi-ico"><i class="fas fa-triangle-exclamation"></i></div></div>
          <div class="gc-kpi-val gc-num">{{ kpiMasalah === null ? '–' : kpiMasalah }}</div>
          <div class="gc-kpi-label">Persiapan Masalah</div>
        </div>
        <div class="gc-kpi-card gc-kartu-gradien">
          <div class="gc-kpi-top"><div class="gc-kpi-ico"><i class="fas fa-user-plus"></i></div></div>
          <div class="gc-kpi-val gc-num">{{ kpiDakar === null ? '–' : kpiDakar }}</div>
          <div class="gc-kpi-label">Antrean Dakar</div>
        </div>
        <div class="gc-kpi-card gc-kartu-gradien">
          <div class="gc-kpi-top"><div class="gc-kpi-ico"><i class="fas fa-clipboard-list"></i></div></div>
          <div class="gc-kpi-val gc-num">{{ kpiAbsensi === null ? '–' : kpiAbsensi }}</div>
          <div class="gc-kpi-label">Antrean Absensi</div>
        </div>
        <div class="gc-kpi-card gc-kartu-gradien">
          <div class="gc-kpi-top"><div class="gc-kpi-ico"><i class="fas fa-file-invoice-dollar"></i></div></div>
          <div class="gc-kpi-val gc-num">{{ kpiReimburse === null ? '–' : kpiReimburse }}</div>
          <div class="gc-kpi-label">Antrean Reimburse</div>
        </div>
      </div>

      <div class="gc-dash-grid">
        <div>
          <div class="gc-pipeline-card">
            <div class="gc-pipeline-head">
              <i class="fas fa-diagram-project" style="color:var(--aksen-ink);"></i>
              <b>Pipeline Persiapan</b>
              <span class="gc-pipeline-tot gc-num">{{ totalPersiapan() === null ? '…' : totalPersiapan() + ' SPK' }}</span>
            </div>
            <div class="gc-pipeline-desc">Perlu Disiapkan, Vendor, Bahan, Acc Sewing, Acc Webbing, Acc Finishing</div>
            <div class="gc-pipeline-steps" style="grid-template-columns:repeat(6,minmax(0,1fr));">
              <div class="gc-pipeline-step">
                <div class="gc-pipeline-bar" style="background:var(--warn);"></div>
                <div class="gc-pipeline-n gc-num">{{ persiapanDisiapkan === null ? '…' : persiapanDisiapkan }}</div>
                <div class="gc-pipeline-lbl">Perlu Disiapkan</div>
              </div>
              <div class="gc-pipeline-step" v-for="j in persiapanJalur" :key="j.key">
                <div class="gc-pipeline-bar" :style="{background: j.n ? 'var(--warn)' : 'var(--ok)'}"></div>
                <div class="gc-pipeline-n gc-num">{{ j.n === null ? '…' : j.n }}</div>
                <div class="gc-pipeline-lbl">{{ j.label }}</div>
              </div>
            </div>
          </div>

          <div class="gc-pipeline-card">
            <div class="gc-pipeline-head">
              <i class="fas fa-diagram-project" style="color:var(--text-faint);"></i>
              <b>Pipeline Produksi</b>
              <span class="gc-pipeline-tot gc-num">Segera Hadir</span>
            </div>
            <div class="gc-pipeline-desc">Jalur Cutting, Serie, Sewing dan Finishing — diusulkan, skema data &amp; menunya belum dibangun.</div>
            <div class="gc-pipeline-steps" style="grid-template-columns:repeat(4,minmax(0,1fr)); opacity:.55;">
              <div class="gc-pipeline-step" v-for="p in produksiPlaceholder" :key="p.label">
                <div class="gc-pipeline-bar" style="background:var(--line);"></div>
                <div class="gc-pipeline-n">–</div>
                <div class="gc-pipeline-lbl">{{ p.label }}</div>
                <div class="gc-pipeline-segera">Segera hadir</div>
              </div>
            </div>
          </div>

          <!-- REVISI (30 Agt 2026, sesi lanjutan lagi) — "Perlu Tindakan
               Anda" DIPECAH jadi 2 grup/grid (permintaan Guru): grid 1
               Persiapan (data REAL, sama seperti Pipeline Persiapan di
               atas — Perlu Disiapkan + 5 jalur), grid 2 Produksi. Grup
               Produksi SENGAJA placeholder "Segera hadir" (chip "–", opacity
               diredupkan lewat .gc-tindak-segera) — KONSISTEN dengan kartu
               Pipeline Produksi di atas: belum ada skema data Cutting/
               Serie/Sewing/Finishing (keputusan Guru §5.9, belum diminta
               dibangun), jadi TIDAK dibuat angka/chip hitung palsu di sini. -->
          <div class="gc-pipeline-card" style="margin-bottom:0;">
            <div class="gc-pipeline-head" style="margin-bottom:6px;"><b>Perlu Tindakan Anda</b></div>

            <div class="gc-tindak-subgrup">Persiapan</div>
            <div class="gc-tindak-row">
              <div class="gc-tindak-ico"><i class="fas fa-layer-group"></i></div>
              <div class="gc-tindak-txt"><b>Perlu Disiapkan</b><span>Klaster SPK siap digrouping</span></div>
              <span class="gc-tindak-chip gc-num">{{ persiapanDisiapkan === null ? '…' : persiapanDisiapkan }}</span>
            </div>
            <div class="gc-tindak-row" v-for="j in persiapanJalur" :key="'tindak-persiapan-'+j.key">
              <div class="gc-tindak-ico"><i class="fas" :class="j.ico"></i></div>
              <div class="gc-tindak-txt"><b>{{ j.label }}</b><span>{{ j.ket }}</span></div>
              <span class="gc-tindak-chip gc-num">{{ j.n === null ? '…' : j.n }}</span>
            </div>

            <div class="gc-tindak-subgrup">Produksi</div>
            <div class="gc-tindak-row gc-tindak-segera" v-for="p in produksiPlaceholder" :key="'tindak-produksi-'+p.label">
              <div class="gc-tindak-ico"><i class="fas" :class="p.ico"></i></div>
              <div class="gc-tindak-txt"><b>{{ p.label }}</b><span>Segera hadir — skema data belum dibangun</span></div>
              <span class="gc-tindak-chip">–</span>
            </div>
          </div>
        </div>

        <div>
          <div v-if="shiftAbsen.nama" class="gc-kartu-gradien gc-absen-desktop">
            <div class="gc-deco-lingkaran" style="right:-34px; top:-24px; width:160px; height:160px;"></div>
            <div class="gc-deco-lingkaran" style="right:2px; top:8px; width:100px; height:100px;"></div>
            <div style="position:relative; z-index:1;">
              <p class="lbl">Shift hari ini &middot; {{ shiftAbsen.gudang }}</p>
              <p class="jam gc-num">{{ shiftAbsen.jamMasuk }} &ndash; {{ shiftAbsen.jamKeluar }}</p>
              <span class="gc-pil-status">
                <i class="fas" :class="sudahAbsenHariIni ? 'fa-circle-check' : 'fa-circle-exclamation'"></i>
                {{ sudahAbsenHariIni ? 'Sudah absen masuk' : 'Belum absen masuk' }}
              </span>
              <div class="ket">Clock in dan scan QR dikerjakan di aplikasi mobile. Desktop untuk memantau dan memproses datanya.</div>
            </div>
          </div>

          <div v-if="!memuatQuote && quote" class="gc-quote-desktop gc-kartu-gradien">
            <h4><i class="fas fa-quote-left"></i> {{ quote.judul }}</h4>
            <p>{{ quote.isi }}</p>
          </div>

          <!-- Konten ILUSTRATIF (statis, bukan Firestore) — lihat poin 6 komentar header file ini -->
          <div class="gc-pipeline-card">
            <div class="gc-pipeline-head" style="margin-bottom:6px;"><b>Aktivitas Terbaru</b></div>
            <div class="gc-aktivitas-row" v-for="(a,i) in aktivitasIlustratif" :key="'akt-'+i">
              <div class="gc-aktivitas-dot" :style="{background: a.warna}"></div>
              <div class="gc-aktivitas-txt">{{ a.teks }}<span class="gc-aktivitas-jam gc-num">{{ a.jam }}</span></div>
            </div>
          </div>

          <div class="gc-pipeline-card" style="margin-bottom:0;">
            <div class="gc-pipeline-head" style="margin-bottom:6px;"><b>Pintasan Papan Tik</b></div>
            <div class="gc-pintasan-row" v-for="(p,i) in pintasanIlustratif" :key="'pin-'+i">
              <kbd>{{ p.k }}</kbd><span>{{ p.teks }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};

const mountBeranda = document.getElementById('vue-beranda-desktop');
let appBerandaDesktop = null;
if (mountBeranda) appBerandaDesktop = createApp(BerandaDesktop).mount('#vue-beranda-desktop');

// ---- Lonceng notifikasi Pengumuman di TOPBAR (index.html, di luar
// #tab-home — makanya diwire terpisah dari komponen Vue di atas, bukan
// karena datanya beda, cuma titik mount HTML-nya bukan bagian dashboard). ----
(function wireNotifTopbar() {
  const btnBell = document.getElementById('btnNotifDesktop');
  if (!btnBell || !appBerandaDesktop) return; // topbar/dashboard tidak ada di layar ini
  const panel = document.getElementById('notifPanelDesktop');
  const backdrop = document.getElementById('notifBackdropDesktop');
  const dot = document.getElementById('notifDotDesktop');
  const list = document.getElementById('notifListDesktop');

  function render() {
    dot.hidden = appBerandaDesktop.jumlahBelumDibaca <= 0;
    dot.textContent = appBerandaDesktop.jumlahBelumDibaca > 9 ? '9+' : appBerandaDesktop.jumlahBelumDibaca;
    if (appBerandaDesktop.memuatNotif) {
      list.innerHTML = '<div class="gc-notif-empty">Memuat...</div>';
    } else if (!appBerandaDesktop.daftarNotif.length) {
      list.innerHTML = '<div class="gc-notif-empty"><i class="fas fa-bell-slash"></i>Belum ada pengumuman.</div>';
    } else {
      list.innerHTML = appBerandaDesktop.daftarNotif.map(p =>
        '<div class="gc-notif-item"><b>' + (p.judul || '') + '</b><p>' + (p.isi || '') + '</p></div>'
      ).join('');
    }
  }
  btnBell.addEventListener('click', function () {
    if (panel.hidden) { appBerandaDesktop.toggleNotif(); panel.hidden = false; backdrop.hidden = false; }
    else { appBerandaDesktop.tutupNotif(); panel.hidden = true; backdrop.hidden = true; }
    render();
  });
  backdrop.addEventListener('click', function () {
    appBerandaDesktop.tutupNotif(); panel.hidden = true; backdrop.hidden = true; render();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) { appBerandaDesktop.tutupNotif(); panel.hidden = true; backdrop.hidden = true; render(); }
  });
  // Poll ringan (bukan realtime listener — hemat) sampai data notif awal siap.
  const cek = setInterval(function () {
    if (!appBerandaDesktop.memuatNotif) { render(); clearInterval(cek); }
  }, 250);
})();
