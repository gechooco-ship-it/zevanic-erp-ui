// js/vue-header-mobile.js
// ============================================================================
// Header atas mobile — SATU komponen dipakai di semua halaman, tapi isinya
// berubah otomatis tergantung sedang di mana:
//   - Di Home: "Selamat [pagi/siang/sore/malam], [Nama]" (gaya kartu pink,
//     sama seperti prototype)
//   - Di halaman LAIN (Master Absensi, Profile, dst): "ERP Zevanic House"
//     / "[Nama Menu] - [Nama Sub-menu]" — supaya orang selalu tahu lagi
//     di mana tanpa perlu baca sub-tab (yang di mobile sengaja
//     disembunyikan, lihat index.html & dashboard.js).
//
// Diaktifkan lewat window.aturHeaderKonteks(tabId, subTabId) — dipanggil
// dari pindahTab/pindahSubTab (dashboard.js) tiap kali navigasi terjadi.
// TIDAK baca Firestore sama sekali untuk ganti konteks (murni cocokkan ID
// ke daftar label yang sudah ada di memori).
//
// DIROMBAK (28 Agt 2026, redesain "Gechoo Mobile Organic", mode 'home' SAJA)
// — mengikuti spec mockup (README.md §1 "Baris sapaan"): sekarang ada quote
// harian inline (dulu kartu QuoteCard terpisah di vue-home.js, DIHAPUS dari
// sana — lihat catatan di vue-home.js), lonceng notifikasi + badge, dan
// avatar inisial. Mode 'lainnya' (header di tab selain Home) TIDAK berubah
// sama sekali.
//
// Lonceng = Pengumuman (keputusan Guru: Pengumuman TIDAK lagi tampil sebagai
// carousel di body Beranda, dipindah jadi notifikasi lewat lonceng ini).
// Baca koleksi "pengumuman" (SAMA seperti PengumumanCarousel di
// vue-components.js, query sendiri di sini biar tidak perlu import carousel
// yang sekarang tidak dipakai lagi di mobile). Badge = jumlah pengumuman
// yang dibuat SETELAH waktu "terakhir dilihat" tersimpan di localStorage
// per-user (murni device-lokal, TIDAK ada tulis Firestore tambahan sama
// sekali demi hemat — lihat PRINSIP-HEMAT.md).
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, query, orderBy, limit, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
// BARU (29 Agt 2026, moodboard "Gechoo Mobile Organic", lihat PEDOMAN-GAYA-
// KERJA.md — pilot Antrean Absensi, disetujui Guru "test dulu Antrean
// Absensi") — mode 'lainnya' sekarang pakai HeaderLayar yang SAMA persis
// dipakai Menu Lengkap/Atur Favorit (tombol kembali bulat + kicker + judul),
// GANTI kartu pink + lingkaran dekoratif yang lama. Komponen ini GLOBAL
// (dipakai di SEMUA halaman selain Home), jadi perubahan ini otomatis
// berlaku ke semua halaman sekaligus, bukan cuma Antrean Absensi — itu
// sudah dikonfirmasi & dicatat di PEDOMAN-GAYA-KERJA.md sebelum diterapkan.
import { HeaderLayar } from './vue-components.js?v=5';

const LABEL_TAB = {
  'tab-home': 'Home',
  'tab-profil': 'Profile',
  'tab-admin-acc': 'Master Absensi',
  'tab-keuangan': 'Master Keuangan',
  'tab-superuser': 'Master Karyawan',
  'tab-whatsapp': 'WhatsApp Gateway',
  'tab-mail-gateway': 'Mail Gateway',
  'tab-device-kiosk': 'List Device Kiosk',
  'tab-scan-qr': 'Scan QR',
  'tab-progress': 'Progress',
  // BARU (27 Agt 2026, §27) — sebelumnya HILANG dari sini (celah lama,
  // ketauan pas Home mobile jadi jalur utama ke Zevanic House). Efeknya:
  // header mobile nongol kosong pas buka menu Zevanic House manapun.
  'tab-zevanic-house': 'Zevanic House'
};
const LABEL_SUBTAB = {
  'sub-absensi-config': 'Config Absensi',
  'sub-absensi-jadwal': 'Penjadwalan',
  'sub-absensi-accept': 'Antrean Absensi',
  'sub-absensi-lembur': 'Antrean Lembur',
  'sub-absensi-rekap': 'Riwayat All Absensi',
  'sub-keuangan-antrean': 'Antrean Reimburse',
  'sub-keuangan-kendaraan': 'Master Kendaraan',
  'sub-keuangan-kategori': 'Kategori Keuangan',
  'sub-keuangan-riwayat-reimburse': 'Riwayat Reimburse',
  'sub-keuangan-riwayat-bensin': 'Riwayat Isi Bensin',
  'sub-keuangan-riwayat-servis': 'Riwayat Servis',
  'sub-karyawan-antrean': 'Antrean Dakar',
  'sub-karyawan-data': 'Daftar Karyawan',
  'sub-karyawan-slip': 'Slip Gaji',
  'sub-karyawan-payroll': 'Payroll',
  'sub-karyawan-config': 'Config Karyawan',
  'sub-karyawan-info': 'Config Info',
  'sub-karyawan-hakakses': 'Hak Akses',
  'sub-karyawan-akses': 'Config Akses',
  // BARU (27 Agt 2026, §27) — sama seperti tab-zevanic-house di atas,
  // set ini sebelumnya HILANG total (celah lama, bukan cuma soal menu
  // baru §26). Ditambah sekalian semuanya supaya header mobile Zevanic
  // House selalu jelas lagi di mana, bukan cuma yang kepakai dari Home.
  'sub-zevanic-house-persiapan': 'Persiapan Masalah',
  'sub-zevanic-house-orderspk': 'Order SPK',
  'sub-zh-config-jenisbahan': 'Jenis Bahan',
  'sub-zh-config-jenisaksesoris': 'Jenis Aksesoris',
  'sub-zh-config-satuan': 'Data Satuan',
  'sub-zh-config-warna': 'Data Warna',
  'sub-zh-config-ukuran': 'Data Ukuran',
  'sub-zh-config-suplayer': 'Data Suplayer',
  'sub-zh-config-tahappersiapan': 'Persiapan Untuk Tahap',
  'sub-zh-databahan-entry': 'Entry Bahan & Aksesoris',
  'sub-zh-databahan-list': 'List Bahan & Aksesoris',
  'sub-zh-databahan-rak': 'Rak Penyimpanan',
  'sub-zh-stock-alias': 'Alias Pembelian',
  'sub-zh-stock-listorder': 'List Order Belanja',
  'sub-zh-stock-notaorder': 'Nota Order Belanja',
  'sub-zh-stock-riwayat': 'Riwayat Harga Pembelian',
  'sub-zh-stock-kartustok': 'Kartu Stok',
  'sub-zh-scan-opname': 'Scan Opname',
  'sub-zh-scan-persiapan': 'Scan Persiapan',
  // BARU (28 Agt 2026) — Persiapan Produksi (5 tab child).
  'sub-zh-persiapanproduksi-antrean': 'Perlu Disiapkan',
  'sub-zh-persiapanproduksi-bahan': 'Persiapan Bahan',
  'sub-zh-persiapanproduksi-sewing': 'Persiapan Acc Sewing',
  'sub-zh-persiapanproduksi-webbing': 'Persiapan Acc Webbing',
  'sub-zh-persiapanproduksi-finishing': 'Persiapan Acc Finishing'
};

const AppHeaderMobile = {
  components: { HeaderLayar },
  setup() {
    const konteks = reactive({ mode: 'home', menuLabel: '', subMenuLabel: '' });
    const sapaan = ref('Selamat datang');
    const nama = ref('');
    // Nama dibatasi maksimal 20 karakter di header (kartu kecil, banyak
    // nama karyawan panjang) — dipotong + "…" kalau lebih panjang dari
    // itu, nama ASLI tetap utuh di window.currentUser/Profile.
    const namaTampil = computed(() => nama.value.length > 20 ? nama.value.slice(0, 20).trim() + '…' : nama.value);

    function tentukanSapaan() {
      const jam = new Date().getHours();
      if (jam >= 4 && jam < 11) return 'Selamat pagi';
      if (jam >= 11 && jam < 15) return 'Selamat siang';
      if (jam >= 15 && jam < 18) return 'Selamat sore';
      return 'Selamat malam';
    }

    // ---- BARU (redesain, mode 'home' saja): quote harian inline ----
    // SAMA sumber data dengan QuoteCard lama (koleksi "quotes", field
    // tanggalTampil==hari ini) — cuma ditampilkan sebagai 1 baris kecil di
    // sini, bukan kartu terpisah lagi. QuoteCard sendiri TETAP ada di
    // vue-components.js (masih dipakai desktop, lihat vue-home-desktop.js).
    const quoteHariIni = ref('');
    async function muatQuote() {
      try {
        const hariIni = new Date().toISOString().split('T')[0];
        const q = query(collection(db, "quotes"), where("tanggalTampil", "==", hariIni), limit(1));
        const snap = await getDocs(q);
        quoteHariIni.value = snap.empty ? '' : (snap.docs[0].data().isi || '');
      } catch (e) {
        quoteHariIni.value = ''; // koleksi belum ada/kosong itu wajar
      }
    }

    // ---- BARU: lonceng notifikasi (Pengumuman) + badge ----
    const daftarNotif = ref([]);
    const memuatNotif = ref(true);
    const notifTerbuka = ref(false);
    const jumlahBelumDibaca = ref(0);
    const KUNCI_TERAKHIR_DILIHAT = 'zevanic_notif_terakhir_dilihat_';

    function kunciUser() { return KUNCI_TERAKHIR_DILIHAT + (window.currentUser?.email || ''); }

    async function muatNotif() {
      memuatNotif.value = true;
      try {
        const q = query(collection(db, "pengumuman"), orderBy("dibuat_pada", "desc"), limit(15));
        const snap = await getDocs(q);
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
        daftarNotif.value = []; // koleksi belum ada/kosong itu wajar, bukan error
        jumlahBelumDibaca.value = 0;
      }
      memuatNotif.value = false;
    }

    function toggleNotif() {
      notifTerbuka.value = !notifTerbuka.value;
      if (notifTerbuka.value) {
        // Ketuk lonceng = tandai semua SUDAH dibaca (badge hilang) — murni
        // localStorage, tidak ada tulis Firestore.
        localStorage.setItem(kunciUser(), new Date().toISOString());
        jumlahBelumDibaca.value = 0;
      }
    }
    function tutupNotif() { notifTerbuka.value = false; }

    function inisial(n) {
      const bersih = (n || '').trim();
      if (!bersih) return '?';
      const kata = bersih.split(/\s+/);
      return kata.length === 1 ? kata[0].slice(0, 2).toUpperCase() : (kata[0][0] + kata[kata.length - 1][0]).toUpperCase();
    }
    const inisialNama = computed(() => inisial(nama.value));

    function muatTampilan() {
      sapaan.value = tentukanSapaan();
      nama.value = window.currentUser?.name || window.currentUser?.nama || 'Karyawan';
      muatQuote();
      muatNotif();
    }

    // Dipanggil dari dashboard.js (pindahTab/pindahSubTab) — murni
    // cocokkan ID ke label, tidak ada baca Firestore.
    // BARU (28 Agt 2026, redesain) — layar baru "Menu Lengkap"/"Atur
    // Favorit" (js/vue-menu-lengkap.js, js/vue-atur-favorit.js) sudah py
    // header sendiri (HeaderLayar: tombol kembali+kicker+judul, lihat
    // vue-components.js) — kalau banner generik ini TETAP tampil di
    // atasnya jadi 2 header dobel. Mode 'tersembunyi' = komponen ini
    // tidak render apapun untuk tab-tab itu.
    const TAB_HEADER_SENDIRI = ['tab-menu-lengkap', 'tab-atur-favorit'];

    window.aturHeaderKonteks = function(tabId, subTabId) {
      if (tabId === 'tab-home') {
        konteks.mode = 'home';
        konteks.menuLabel = '';
        konteks.subMenuLabel = '';
      } else if (TAB_HEADER_SENDIRI.includes(tabId)) {
        konteks.mode = 'tersembunyi';
        konteks.menuLabel = '';
        konteks.subMenuLabel = '';
      } else {
        konteks.mode = 'lainnya';
        konteks.menuLabel = LABEL_TAB[tabId] || '';
        konteks.subMenuLabel = subTabId ? (LABEL_SUBTAB[subTabId] || '') : '';
      }
    };

    window.refreshHeaderMobile = muatTampilan;
    onMounted(async () => { await window.authReady; muatTampilan(); });

    return {
      konteks, sapaan, namaTampil, quoteHariIni, inisialNama,
      daftarNotif, memuatNotif, notifTerbuka, jumlahBelumDibaca, toggleNotif, tutupNotif
    };
  },
  template: `
    <div class="md:hidden" :style="konteks.mode === 'tersembunyi' ? '' : 'border-radius:22px; padding:9px 4px; position:relative; margin-bottom:10px;'">
      <template v-if="konteks.mode === 'home'">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
          <div style="min-width:0;">
            <p style="font-size:10px; color:var(--text-muted); font-weight:600; margin:0;">{{ sapaan }},</p>
            <h2 class="gc-heading" style="font-size:17px; font-weight:700; color:var(--aksen-ink); margin:1px 0 0 0; letter-spacing:-.015em;">{{ namaTampil }}</h2>
            <p v-if="quoteHariIni" style="font-size:9.5px; color:var(--text-muted); margin:3px 0 0 0; line-height:1.35; max-width:220px;">{{ quoteHariIni }}</p>
          </div>
          <div style="display:flex; align-items:center; gap:10px; flex-shrink:0; position:relative;">
            <button @click="toggleNotif" style="position:relative; background:none; border:none; cursor:pointer; color:var(--aksen-ink); width:34px; height:34px; display:flex; align-items:center; justify-content:center;" aria-label="Notifikasi">
              <i class="fas fa-bell" style="font-size:18px;"></i>
              <span v-if="jumlahBelumDibaca > 0" style="position:absolute; top:-2px; right:-3px; background:var(--burgundy); color:#fff; font-size:9px; font-weight:700; min-width:16px; height:16px; border-radius:999px; display:flex; align-items:center; justify-content:center; padding:0 3px;">{{ jumlahBelumDibaca > 9 ? '9+' : jumlahBelumDibaca }}</span>
            </button>
            <span style="width:44px; height:44px; border-radius:50%; background:var(--aksen-lembut); border:2px solid var(--surface); box-shadow:0 3px 10px rgba(110,30,44,.14); display:flex; align-items:center; justify-content:center; color:var(--aksen-ink); font-size:14px; font-weight:700;">{{ inisialNama }}</span>

            <div v-if="notifTerbuka" @click="tutupNotif" style="position:fixed; inset:0; z-index:60;"></div>
            <div v-if="notifTerbuka" class="fade-in" style="position:absolute; top:42px; right:0; width:280px; max-height:340px; overflow-y:auto; background:var(--surface); border:1px solid var(--line); border-radius:18px; box-shadow:0 14px 34px -10px rgba(31,22,17,.35); z-index:61; padding:6px;">
              <div style="padding:8px 10px 6px; font-size:11px; font-weight:700; color:var(--text); border-bottom:1px solid var(--line); margin-bottom:4px;">Pengumuman</div>
              <div v-if="memuatNotif" style="padding:16px; text-align:center; font-size:11px; color:var(--text-faint);">Memuat...</div>
              <div v-else-if="daftarNotif.length === 0" style="padding:16px; text-align:center; font-size:11px; color:var(--text-faint);"><i class="fas fa-bell-slash" style="display:block; font-size:18px; margin-bottom:6px;"></i>Belum ada pengumuman.</div>
              <div v-else v-for="p in daftarNotif" :key="p.id" style="padding:9px 10px; border-radius:12px;">
                <b style="font-size:11.5px; color:var(--text); display:block;">{{ p.judul }}</b>
                <p style="font-size:10.5px; color:var(--text-muted); margin:2px 0 0; line-height:1.4;">{{ p.isi }}</p>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template v-else-if="konteks.mode === 'lainnya'">
        <header-layar :kicker="konteks.menuLabel" :judul="konteks.subMenuLabel || konteks.menuLabel" tab-pulang="tab-home" />
      </template>
      <!-- mode 'tersembunyi': layar py header sendiri (HeaderLayar), tidak render apapun di sini -->
    </div>
  `
};

const mountPoint = document.getElementById('vue-header-mobile');
if (mountPoint) createApp(AppHeaderMobile).mount('#vue-header-mobile');
