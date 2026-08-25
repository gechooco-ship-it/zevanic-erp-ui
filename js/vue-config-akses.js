// js/vue-config-akses.js
// ============================================================================
// Master Karyawan > Config Akses — buat & atur PROFIL AKSES bernama bebas
// (bukan cuma 5 role baku). Tiap profil punya izin View/Add/Edit/Delete/
// Print per menu, dikelompokkan per kategori (bisa dilipat/dibuka).
//
// PENERAPAN (update 17 Agt 2026): View menu (Home mobile) dan tombol Add/
// Edit/Delete/Print di beberapa layar SUDAH menerapkan izin dari sini
// secara nyata (lihat window.cekIzinMenu/cekFiturAkses di auth.js, dan
// STATUS-PROYEK.md untuk daftar layar mana saja yang sudah/belum). Ini
// murni PENERAPAN DI TAMPILAN (client-side) — keputusan sadar, BUKAN
// jadi batas keamanan Firestore Rules (itu tetap di 4 tingkat role baku,
// biar tidak nambah biaya baca per operasi tulis).
//
// KARENA rules tetap di tingkat role baku, tapi profil di sini boleh
// bernama BEBAS (mis. "admin_finance") — tiap profil WAJIB pilih 1 dari
// 5 tingkat baku sebagai "tingkatKeamanan"-nya (lihat bagian atas form).
// Itu yang benar-benar dikirim ke Firestore Rules lewat custom claim;
// nama profil sendiri cuma dipakai buat cari izin tampilan di sini.
//
// Akses ke layar ini SENGAJA dibatasi khusus Owner (lihat auth.js).
// ============================================================================
import { createApp, ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const TINGKAT_KEAMANAN_BAKU = ['operator', 'pic', 'admin', 'owner', 'superuser'];

const DAFTAR_MENU = [
  { id: 'dashboard', label: 'Dashboard', kategori: 'Umum' },
  { id: 'profile', label: 'Profile', kategori: 'Umum' },
  // fiturList = kontrol granular OPSIONAL per menu, di luar View/Add/Edit/
  // Delete/Print baku — dipakai buat kunci field/dropdown SPESIFIK di
  // dalam form menu itu (bukan seluruh menunya). Contoh nyata: dropdown
  // "Jenis Lokasi" di form Master Gudang, defaultnya Tetap untuk non-
  // Owner, cuma Owner yang bisa buka opsi Dinamis. Kalau nanti ada
  // kebutuhan serupa (kunci field lain), TAMBAHKAN entry baru di
  // fiturList menu terkait di sini — JANGAN bikin mekanisme baru,
  // panggil window.cekFiturAkses(menuId, fiturKey) di titik yang mau
  // dikunci (lihat auth.js untuk definisi fungsinya).
  { id: 'config_absensi', label: 'Config Absensi', kategori: 'Master Absensi', fiturList: [
    { key: 'ubah_jenis_lokasi', label: 'Boleh ubah Jenis Lokasi gudang (Tetap/Dinamis)' }
  ] },
  { id: 'penjadwalan', label: 'Penjadwalan', kategori: 'Master Absensi' },
  { id: 'antrean_absensi', label: 'Antrean Absensi', kategori: 'Master Absensi' },
  { id: 'antrean_lembur', label: 'Antrean Lembur', kategori: 'Master Absensi' },
  { id: 'antrean_reimburse', label: 'Antrean Reimburse', kategori: 'Master Keuangan' },
  { id: 'master_kendaraan', label: 'Master Kendaraan', kategori: 'Master Keuangan' },
  { id: 'riwayat_reimburse', label: 'Riwayat Reimburse', kategori: 'Master Keuangan' },
  { id: 'riwayat_bensin', label: 'Riwayat Isi Bensin', kategori: 'Master Keuangan' },
  { id: 'riwayat_servis', label: 'Riwayat Servis', kategori: 'Master Keuangan' },
  { id: 'master_keuangan', label: 'Master Keuangan', kategori: 'Master Keuangan' },
  { id: 'riwayat_absensi', label: 'Riwayat All Absensi', kategori: 'Master Absensi' },
  { id: 'antrean_dakar', label: 'Antrean Dakar', kategori: 'Master Karyawan' },
  { id: 'config_karyawan', label: 'Config Karyawan', kategori: 'Master Karyawan' },
  { id: 'daftar_karyawan', label: 'Daftar Karyawan', kategori: 'Master Karyawan' },
  { id: 'config_info', label: 'Config Info', kategori: 'Master Karyawan' },
  { id: 'slip_gaji', label: 'Slip Gaji', kategori: 'Master Karyawan' },
  { id: 'payroll', label: 'Payroll', kategori: 'Master Karyawan' },
  { id: 'config_akses', label: 'Config Akses', kategori: 'Master Karyawan' },
  { id: 'hak_akses', label: 'Hak Akses', kategori: 'Master Karyawan' },
  { id: 'whatsapp_gateway', label: 'WhatsApp Gateway', kategori: 'Master Integrasi' },
  { id: 'mail_gateway', label: 'Mail Gateway', kategori: 'Master Integrasi' },
  { id: 'device_kiosk', label: 'List Device Kiosk', kategori: 'Master Integrasi' },
  // BARU (23 Agt 2026) — Zevanic House > Master Bahan & Aksesoris. id
  // SENGAJA TIDAK diubah (masih bahan_aksesoris_entry/list) walau labelnya
  // di sidebar sekarang "Data Bahan & Aksesoris" — supaya akses_config yang
  // sudah tersimpan sebelumnya (per-user) TIDAK ikut kereset/hilang.
  { id: 'bahan_aksesoris_entry', label: 'Entry Bahan & Aksesoris', kategori: 'Zevanic House' },
  { id: 'bahan_aksesoris_list', label: 'List Bahan & Aksesoris', kategori: 'Zevanic House' },
  // BARU (25 Agt 2026, §25) — Rak Penyimpanan.
  { id: 'bahan_aksesoris_rak', label: 'Rak Penyimpanan', kategori: 'Zevanic House' },
  // BARU (24 Agt 2026) — Persiapan Masalah + Stock & Pembelian.
  { id: 'persiapan_masalah', label: 'Persiapan Masalah', kategori: 'Zevanic House' },
  { id: 'master_suplayer', label: 'Master Suplayer (lewat Pengaturan)', kategori: 'Zevanic House' },
  { id: 'stock_alias_pembelian', label: 'Alias Pembelian', kategori: 'Zevanic House' },
  { id: 'stock_list_order_belanja', label: 'List Order Belanja', kategori: 'Zevanic House' },
  { id: 'stock_nota_order_belanja', label: 'Nota Order Belanja', kategori: 'Zevanic House' }
];

const KATEGORI_URUTAN = ['Umum', 'Master Absensi', 'Master Keuangan', 'Master Karyawan', 'Master Integrasi', 'Zevanic House'];
const KOSONG_IZIN = () => ({ view: false, add: false, edit: false, delete: false, print: false });

// Default awal untuk 5 profil baku SENGAJA disamakan dengan perilaku
// hardcode yang sudah jalan sekarang (lihat auth.js) — supaya profil ini
// begitu pertama dibuka sudah masuk akal, bukan kosong semua.
function bikinDefaultProfil(namaProfil) {
  const menus = {};
  DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN(); });

  const semua = (id) => { menus[id] = { view: true, add: true, edit: true, delete: true, print: true }; };
  const lihatSaja = (id) => { menus[id].view = true; };

  if (namaProfil === 'owner') {
    DAFTAR_MENU.forEach(m => semua(m.id));
  } else if (namaProfil === 'superuser') {
    // ATURAN TETAP (18 Agt 2026, permintaan eksplisit): menu BARU yang
    // ditambahkan ke DAFTAR_MENU TIDAK LAGI otomatis ikut ke sini. Dulu
    // Superuser = Owner untuk SEMUA menu (blanket, ikut DAFTAR_MENU
    // apapun isinya) — sekarang daftar di bawah ini FIXED/snapshot,
    // cuma menu yang SUDAH ADA per tanggal ini. Menu baru ke depan
    // default-nya CUMA Owner yang bisa akses, sampai Owner atur manual
    // lewat Config Akses kalau memang mau dibagikan ke Superuser juga.
    // JANGAN tambahkan menu baru ke daftar ini secara otomatis — biarkan
    // Owner yang putuskan & atur sendiri lewat tampilan Config Akses.
    [
      'dashboard', 'profile',
      'config_absensi', 'penjadwalan', 'antrean_absensi', 'antrean_lembur', 'riwayat_absensi',
      'antrean_dakar', 'config_karyawan', 'daftar_karyawan', 'config_info', 'slip_gaji', 'payroll',
      'whatsapp_gateway', 'mail_gateway'
      // SENGAJA TIDAK termasuk: config_akses, hak_akses — khusus Owner
      // asli, sudah begitu sejak awal fitur ini dibuat, bukan hal baru.
    ].forEach(semua);
  } else if (namaProfil === 'pic' || namaProfil === 'admin') {
    lihatSaja('dashboard');
    menus.profile = { view: true, add: true, edit: true, delete: false, print: false };
    ['config_absensi', 'penjadwalan', 'antrean_absensi', 'antrean_lembur', 'riwayat_absensi'].forEach(semua);
    // Contoh nyata pemakaian fitur granular: Admin/PIC boleh kelola
    // Master Gudang sepenuhnya (view/add/edit/delete/print semua true di
    // atas), TAPI khusus dropdown "Jenis Lokasi"-nya tetap terkunci ke
    // Tetap — cuma Owner yang bisa buka opsi Dinamis.
    menus.config_absensi.fitur = { ubah_jenis_lokasi: false };
  } else {
    lihatSaja('dashboard');
    menus.profile = { view: true, add: true, edit: true, delete: false, print: false };
  }
  return menus;
}

const PROFIL_BAKU = ['operator', 'pic', 'admin', 'owner', 'superuser'];

const AppConfigAkses = {
  setup() {
    const daftarProfil = ref([]); // nama-nama profil yang sudah pernah disimpan
    const memuat = ref(true);
    const menyimpan = ref(false);

    const namaAkses = ref('');
    const profilDipilih = ref('');
    // tingkatKeamanan: 1 dari 5 nama baku, INI yang benar-benar dikirim
    // ke Firestore Rules lewat custom claim (field "role" di data
    // karyawan). Nama profil di "namaAkses" cuma dipakai buat cari izin
    // TAMPILAN, tidak pernah sampai ke Rules. Default 'operator' (paling
    // rendah) — sengaja bukan default tinggi, biar profil baru yang lupa
    // diatur tidak tiba-tiba dapat akses tulis luas.
    const tingkatKeamanan = ref('operator');
    const menus = reactive({});
    // pastikanFiturAda: kalau menu ini punya fiturList (kontrol granular
    // tambahan), pastikan menus[id].fitur SELALU ada sebagai objek —
    // supaya template (v-model="menus[m.id].fitur[f.key]") tidak error
    // kalau datanya belum pernah tersimpan sama sekali.
    function pastikanFiturAda(menuId) {
      const def = DAFTAR_MENU.find(m => m.id === menuId);
      if (def && def.fiturList && !menus[menuId].fitur) menus[menuId].fitur = {};
    }
    DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN(); pastikanFiturAda(m.id); });

    const kategoriTerbuka = reactive({});
    KATEGORI_URUTAN.forEach(k => { kategoriTerbuka[k] = true; });
    function toggleKategori(k) { kategoriTerbuka[k] = !kategoriTerbuka[k]; }

    const cariMenu = ref('');
    function menuUntukKategori(kategori) {
      const kata = cariMenu.value.trim().toLowerCase();
      return DAFTAR_MENU.filter(m => m.kategori === kategori && (!kata || m.label.toLowerCase().includes(kata)));
    }

    // Checkbox "pilih semua" di header kolom (View/Add/Edit/Delete/Print) —
    // cakupannya cuma menu-menu di dalam kategori itu saja, tidak ikut
    // menyentuh kategori lain.
    function semuaTercentangKolom(kategori, field) {
      const daftarMenu = menuUntukKategori(kategori);
      return daftarMenu.length > 0 && daftarMenu.every(m => menus[m.id][field]);
    }
    function toggleKolomKategori(kategori, field) {
      const nilaiBaru = !semuaTercentangKolom(kategori, field);
      menuUntukKategori(kategori).forEach(m => { menus[m.id][field] = nilaiBaru; });
    }

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDocs(collection(db, "akses_config"));
        const namaTersimpan = [];
        snap.forEach(d => namaTersimpan.push(d.id));
        // Gabungkan dengan profil baku (biar selalu muncul di daftar
        // pilihan meski belum pernah disimpan sekalipun) — KECUALI "owner",
        // sengaja disembunyikan dari daftar pilih/edit karena Owner wajib
        // selalu punya akses penuh ke segalanya, tidak boleh dikonfigurasi
        // (dikecilkan) lewat layar ini sama sekali.
        const gabungan = [...new Set([...PROFIL_BAKU, ...namaTersimpan])]
          .filter(nama => nama !== 'owner')
          .sort();
        daftarProfil.value = gabungan;

        if (!profilDipilih.value && gabungan.length > 0) {
          await pilihProfil(gabungan[0]);
        }
      } catch (e) {
        console.error("Gagal muat daftar profil akses:", e);
      }
      memuat.value = false;
    }

    async function pilihProfil(nama) {
      if (!nama) { mulaiProfilBaru(); return; }
      profilDipilih.value = nama;
      namaAkses.value = nama;
      try {
        const snap = await getDoc(doc(db, "akses_config", nama));
        const data = snap.exists() ? snap.data() : null;
        const dataMenus = data ? (data.menus || {}) : null;
        // Profil baku (operator/pic/admin/owner/superuser): tingkat
        // keamanannya SAMA DENGAN namanya sendiri, kecuali sudah pernah
        // disimpan beda secara eksplisit. Profil kustom yang belum pernah
        // diatur: default 'operator' (paling aman/rendah).
        tingkatKeamanan.value = data?.tingkatKeamanan || (PROFIL_BAKU.includes(nama) ? nama : 'operator');
        DAFTAR_MENU.forEach(m => {
          menus[m.id] = dataMenus && dataMenus[m.id] ? { ...KOSONG_IZIN(), ...dataMenus[m.id] } : (
            PROFIL_BAKU.includes(nama) ? bikinDefaultProfil(nama)[m.id] : KOSONG_IZIN()
          );
          pastikanFiturAda(m.id);
        });
      } catch (e) {
        console.error("Gagal muat profil akses:", nama, e);
      }
    }

    function mulaiProfilBaru() {
      profilDipilih.value = '';
      namaAkses.value = '';
      tingkatKeamanan.value = 'operator';
      DAFTAR_MENU.forEach(m => { menus[m.id] = KOSONG_IZIN(); pastikanFiturAda(m.id); });
    }

    async function simpan() {
      const nama = namaAkses.value.trim();
      if (!nama) return alert("Nama Akses harus diisi!");
      if (nama.toLowerCase() === 'owner') {
        return alert("Nama \"owner\" tidak boleh dipakai — Owner wajib selalu punya akses penuh dan tidak boleh dikonfigurasi lewat layar ini.");
      }

      menyimpan.value = true;
      try {
        const menusPolos = {};
        DAFTAR_MENU.forEach(m => { menusPolos[m.id] = { ...menus[m.id] }; });
        await setDoc(doc(db, "akses_config", nama), { nama, tingkatKeamanan: tingkatKeamanan.value, menus: menusPolos });
        alert(`Profil akses "${nama}" berhasil disimpan!`);
        profilDipilih.value = nama;
        await muat();
      } catch (e) {
        console.error("Gagal simpan profil akses:", e);
        alert("Gagal menyimpan profil akses.");
      }
      menyimpan.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });

    return {
      daftarProfil, memuat, menyimpan, muat,
      namaAkses, profilDipilih, pilihProfil, mulaiProfilBaru, simpan,
      tingkatKeamanan, TINGKAT_KEAMANAN_BAKU,
      menus, KATEGORI_URUTAN, kategoriTerbuka, toggleKategori, menuUntukKategori, cariMenu,
      semuaTercentangKolom, toggleKolomKategori
    };
  },
  template: `
    <div>
      <div class="gc-card" style="background:var(--blue); border:none; margin-bottom:16px;">
        <h4 class="gc-heading" style="font-weight:700; font-size:13px; color:#1F5060;"><i class="fas fa-shield-halved" style="margin-right:8px;"></i> Config Akses</h4>
        <p style="font-size:11px; color:#1F5060; margin-top:4px; opacity:.85;">Buat atau ubah profil akses — tiap profil punya izin View/Add/Edit/Delete/Print sendiri per menu. Profil ini nanti dipilih untuk tiap karyawan di tab Hak Akses.</p>
      </div>

      <div class="gc-card" style="margin-bottom:16px; border:1.5px solid var(--burgundy);">
        <h4 class="gc-heading" style="font-size:12.5px; font-weight:700; margin-bottom:6px;"><i class="fas fa-shield-halved" style="color:var(--burgundy); margin-right:8px;"></i> Tingkat Keamanan Dasar</h4>
        <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">Profil ini boleh dinamai bebas, tapi untuk KEAMANAN DATA (Firestore Rules), harus setara dengan salah satu dari 5 tingkat baku berikut. Ini yang menentukan bisa/tidaknya karyawan dengan profil ini benar-benar MENYIMPAN data (bukan cuma soal tampil/sembunyi menu).</p>
        <div class="gc-field" style="margin-bottom:0; max-width:280px;">
          <label>Setara dengan tingkat</label>
          <select v-model="tingkatKeamanan">
            <option v-for="t in TINGKAT_KEAMANAN_BAKU" :key="t" :value="t">{{ t.toUpperCase() }}</option>
          </select>
        </div>
      </div>

      <div class="gc-card" style="margin-bottom:16px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;" class="md:grid-cols-2">
          <div class="gc-field" style="margin-bottom:0;">
            <label>Pilih profil untuk diedit (atau buat baru)</label>
            <select :value="profilDipilih" @change="pilihProfil($event.target.value)">
              <option value="">+ Buat profil baru</option>
              <option v-for="p in daftarProfil" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
          <div class="gc-field" style="margin-bottom:0;">
            <label>Nama akses{{ profilDipilih ? ' (nama profil yang sedang diedit, tidak bisa diganti di sini)' : '' }}</label>
            <input v-model="namaAkses" type="text" placeholder="Contoh: admin_gudang_utama" :disabled="!!profilDipilih" :style="profilDipilih ? 'background:var(--ivory-dim); color:var(--text-muted); cursor:not-allowed;' : ''">
          </div>
        </div>
        <button @click="simpan" :disabled="menyimpan" class="btn-primary block">
          <i class="fas" :class="profilDipilih ? 'fa-rotate' : 'fa-save'" style="margin-right:8px;"></i>
          {{ menyimpan ? 'Menyimpan...' : (profilDipilih ? 'Update profil akses' : 'Simpan profil akses (baru)') }}
        </button>
      </div>

      <div v-if="memuat" style="text-align:center; padding:40px 0; color:var(--text-faint);">
        <i class="fas fa-spinner fa-spin" style="font-size:24px; margin-bottom:8px; display:block;"></i>Memuat...
      </div>

      <div v-else style="position:relative; margin-bottom:14px;">
        <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
        <input v-model="cariMenu" type="text" placeholder="Cari nama menu..." style="width:100%; max-width:320px; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
      </div>

      <div v-if="!memuat" v-for="kategori in KATEGORI_URUTAN" :key="kategori" class="gc-card" style="margin-bottom:12px; padding:0; overflow:hidden;">
        <div @click="toggleKategori(kategori)" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; cursor:pointer; background:var(--ivory-dim);">
          <h3 class="gc-heading" style="font-size:13px; font-weight:700;">{{ kategori }}</h3>
          <i class="fas" :class="kategoriTerbuka[kategori] ? 'fa-chevron-up' : 'fa-chevron-down'" style="color:var(--text-muted);"></i>
        </div>
        <div v-show="kategoriTerbuka[kategori]" class="gc-table-scroll">
          <table class="gc-table" style="table-layout:fixed; min-width:640px;">
            <thead>
              <tr>
                <th class="freeze freeze-left" style="width:220px;">Nama menu</th>
                <th style="width:84px; text-align:center;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="checkbox" :checked="semuaTercentangKolom(kategori, 'view')" @change="toggleKolomKategori(kategori, 'view')" style="accent-color:var(--burgundy); width:14px; height:14px;">
                    <span>View</span>
                  </div>
                </th>
                <th style="width:84px; text-align:center;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="checkbox" :checked="semuaTercentangKolom(kategori, 'add')" @change="toggleKolomKategori(kategori, 'add')" style="accent-color:var(--burgundy); width:14px; height:14px;">
                    <span>Add</span>
                  </div>
                </th>
                <th style="width:84px; text-align:center;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="checkbox" :checked="semuaTercentangKolom(kategori, 'edit')" @change="toggleKolomKategori(kategori, 'edit')" style="accent-color:var(--burgundy); width:14px; height:14px;">
                    <span>Edit</span>
                  </div>
                </th>
                <th style="width:84px; text-align:center;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="checkbox" :checked="semuaTercentangKolom(kategori, 'delete')" @change="toggleKolomKategori(kategori, 'delete')" style="accent-color:var(--burgundy); width:14px; height:14px;">
                    <span>Delete</span>
                  </div>
                </th>
                <th style="width:84px; text-align:center;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="checkbox" :checked="semuaTercentangKolom(kategori, 'print')" @change="toggleKolomKategori(kategori, 'print')" style="accent-color:var(--burgundy); width:14px; height:14px;">
                    <span>Print</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in menuUntukKategori(kategori)" :key="m.id">
                <td class="freeze freeze-left" style="font-weight:600;">{{ m.label }}</td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].view" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].add" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].edit" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].delete" style="accent-color:var(--ok); width:16px; height:16px;"></td>
                <td style="text-align:center;"><input type="checkbox" v-model="menus[m.id].print" style="accent-color:var(--ok); width:16px; height:16px;"></td>
              </tr>
              <tr v-for="m in menuUntukKategori(kategori).filter(x => x.fiturList)" :key="m.id + '-fitur'">
                <td colspan="6" style="background:var(--ivory-dim); padding:10px 12px;">
                  <div style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.03em; margin-bottom:6px;">Kontrol tambahan — {{ m.label }}</div>
                  <label v-for="f in m.fiturList" :key="f.key" style="display:flex; align-items:center; gap:8px; font-size:12px; padding:4px 0; cursor:pointer;">
                    <input type="checkbox" v-model="menus[m.id].fitur[f.key]" style="accent-color:var(--ok); width:15px; height:15px;">
                    {{ f.label }}
                  </label>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
};

let vmConfigAkses = null;
// Perbaikan bug BESAR: komponen ini dulu langsung di-mount() begitu file ini
// dimuat (artinya SETIAP kali halaman dibuka, oleh SIAPAPUN, termasuk yang
// tidak punya akses ke layar ini) — onMounted-nya otomatis mencoba fetch
// Firestore walau orangnya tidak pernah membuka tab ini sama sekali. Itu
// yang bikin console penuh "Missing or insufficient permissions" dan baca
// Firestore boros. Sekarang mount() BARU terjadi saat dashboard.js
// pindahSubTab benar-benar memanggil window.pastikanMountConfigAkses() —
// yaitu PERSIS saat tab ini pertama kali dibuka, bukan dari awal muat
// halaman.
window.pastikanMountConfigAkses = function() {
  if (vmConfigAkses) return; // sudah pernah di-mount, tidak perlu ulang
  const mountPoint = document.getElementById('vue-config-akses');
  if (mountPoint) vmConfigAkses = createApp(AppConfigAkses).mount('#vue-config-akses');
};
window.refreshConfigAkses = function() { if (vmConfigAkses) vmConfigAkses.muat(); };
