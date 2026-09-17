// js/vue-pengaturan-cetak.js
// Pengaturan Cetak (Scan & Cetak > Cetak) — kelola GRUP cetak (preset kertas,
// field tampil, posisi QR) lalu petakan titik cetak jadi anggotanya. Ekspor
// KATALOG_CETAK, SEMUA_FIELD_TERSEDIA, PRESET_KERTAS, ambilPengaturanCetak().
//
// Koleksi & field:
// - pengaturan_cetak/{grupId}: 1 dokumen = 1 grup — anggota_jenis[], lebar_mm,
//   tinggi_mm, posisi_qr, field_tampil[], font_kode_mm/font_nama_mm/
//   font_info_mm, rotasi_90. Dibaca 1x getDocs lalu dicache seumur sesi.
//
// Jebakan:
// - Kontrak ambilPengaturanCetak(jenisId) tetap {lebar_mm, tinggi_mm,
//   posisi_qr, rincian_aktif, font_*, rotasi_90}; PopupPratinjauCetakLabel dan
//   belasan pemanggilnya bergantung pada bentuk itu.
// - KATALOG_CETAK daftar TETAP titik cetak yang ada di kode; id-nya sama persis
//   dengan prop `jenis-cetak` tiap pemanggil. Menambah titik = ubah kode.
// - Jenis yang belum masuk grup manapun jatuh ke DEFAULT_PENGATURAN
//   (101,6x50,8mm), atau DEFAULT_STRUK untuk jenis bertanda strukRoll.
// - Cache grup in-memory: setiap simpan/hapus wajib invalidasiCacheGrup().

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// KATALOG_CETAK — daftar TETAP semua titik cetak di app ini. Menambah titik
// cetak = tambah 1 entri (id harus SAMA persis dengan yang dipakai pemanggil
// `PopupPratinjauCetakLabel:jenis-cetak=".."`). Dipakai sebagai sumber checklist
// "anggota grup" + katalog field global, bukan kunci dokumen setingan.
export const KATALOG_CETAK = {
  label_spk_bahan: {
    label: 'Label Kode Grouping — Bahan', kategori: 'Persiapan Produksi',
    keterangan: 'Persiapan Produksi > Bahan, tiap tahap. 1 label per bahan.',
    // lokasi_rak — sumbernya master_bahan_aksesoris.rak_label dari fitur Rak
    // Penyimpanan; lihat rak_label di hitungBahanRincian
    // (js/vue-persiapan-produksi-v2.js).
    rincianTersedia: [
      { key: 'lokasi_rak', label: 'Lokasi Rak' }
    ]
  },
  label_spk_acc_sewing: {
    label: 'Label Kode Grouping — Acc Sewing', kategori: 'Persiapan Produksi',
    keterangan: 'Persiapan Produksi > Acc Sewing. 1 SPK = 1 label.',
    rincianTersedia: []
  },
  label_spk_acc_webbing: {
    label: 'Label Kode Grouping — Acc Webbing', kategori: 'Persiapan Produksi',
    keterangan: 'Persiapan Produksi > Acc Webbing. 1 SPK = 1 label.',
    rincianTersedia: [
      { key: 'roll', label: 'Roll' },
      { key: 'kode_webbing2', label: 'Kode Webbing 2' },
      { key: 'kode_webbing3', label: 'Kode Webbing 3' }
    ]
  },
  label_spk_acc_finishing: {
    label: 'Label Kode Grouping — Acc Finishing', kategori: 'Persiapan Produksi',
    keterangan: 'Persiapan Produksi > Acc Finishing. 1 SPK = 1 label.',
    rincianTersedia: [
      { key: 'varian', label: 'Varian & Jumlah' }
    ]
  },
  label_masalah: {
    label: 'Label — Persiapan Masalah', kategori: 'Persiapan Produksi',
    keterangan: 'Persiapan Produksi > Masalah, 1 label per baris kekurangan.',
    rincianTersedia: []
  },
  label_spk_terbit: {
    label: 'Label SPK Baru Terbit', kategori: 'Persiapan Produksi',
    keterangan: 'Persiapan Produksi > Perlu Disiapkan, langsung setelah tombol Buat SPK Grouping ditekan (ringkasan lintas jalur).',
    rincianTersedia: []
  },
  label_komponen_cutting: {
    label: 'Label Komponen — Cutting', kategori: 'Proses Produksi',
    keterangan: 'Proses Produksi > Cutting, per bom pola x isi pola.',
    rincianTersedia: []
  },
  kode_bagging: {
    label: 'Kode Bagging', kategori: 'Proses Produksi',
    keterangan: 'Dipakai bareng: Cutting, Serie, Sewing, Finishing, Vendor (Persiapan Produksi).',
    rincianTersedia: []
  },
  lembar_kode_tugas: {
    label: 'Lembar Kode Tugas', kategori: 'Proses Produksi',
    keterangan: 'Dipakai bareng: Serie, Sewing, Finishing, Vendor (Persiapan Produksi).',
    rincianTersedia: []
  },
  id_komponen_serie: {
    label: 'ID Komponen — Serie', kategori: 'Proses Produksi',
    keterangan: 'Proses Produksi > Serie, per komponen per batch separating.',
    rincianTersedia: []
  },
  batch_separating: {
    label: 'Cetak Batch Separating — Serie', kategori: 'Proses Produksi',
    keterangan: 'Proses Produksi > Serie.',
    rincianTersedia: []
  },
  label_pcs_sewing: {
    label: 'Label per Pcs — Sewing', kategori: 'Proses Produksi',
    keterangan: 'Proses Produksi > Sewing. QR + SKU + produk + ukuran + warna + kode pcs + kode batch — sekaligus barcode jual.',
    rincianTersedia: []
  },
  label_bahan_aksesoris: {
    label: 'Label Bahan & Aksesoris', kategori: 'Zevanic House',
    keterangan: 'Zevanic House > Master Bahan & Aksesoris.',
    rincianTersedia: []
  },
  label_no_spk: {
    label: 'Label ID Order', kategori: 'Zevanic House',
    keterangan: 'Zevanic House > Order SPK (master data ID Order dari spreadsheet lama).',
    rincianTersedia: []
  },
  label_roll_pembelian: {
    label: 'Label Roll Pembelian', kategori: 'Stok & Pembelian',
    keterangan: 'Stok & Pembelian > Nota Order Belanja, cetak label per roll/lot yang diterima.',
    rincianTersedia: []
  },
  label_rak_penyimpanan: {
    label: 'Label Rak Penyimpanan', kategori: 'Stok & Pembelian',
    keterangan: 'Stok & Pembelian > Rak Penyimpanan — label fisik ditempel di rak (QR kode rak). Otomatis tampil begitu Rak baru disimpan, atau dicetak ulang manual lewat tombol printer per baris (10 Sep 2026).',
    rincianTersedia: []
  },
  struk_kasir: {
    label: 'Struk Kasir', kategori: 'Pesanan',
    keterangan: 'Pesanan > Penjualan Kasir. Kertas roll (lebar saja). Disambungkan 9 Sep 2026 (js/vue-pesanan.js, PopupPratinjauCetakStruk) — CUMA lebar roll yang ikut setingan grup ini, isi struk (item/total/status bayar) tetap dari template struk sendiri, bukan dari field_tampil grup.',
    rincianTersedia: [],
    strukRoll: true
  }
};

// SEMUA_FIELD_TERSEDIA — katalog field tambahan GLOBAL, gabungan rincianTersedia
// semua jenis di atas, dedup by key. Jadi pilihan "field yang tampil" di form
// grup: bebas dipilih untuk grup manapun, TIDAK dibatasi field milik anggota
// yang sedang dicentang.
export const SEMUA_FIELD_TERSEDIA = Object.values(KATALOG_CETAK)
  .flatMap(j => j.rincianTersedia || [])
  .reduce((acc, f) => (acc.some(x => x.key === f.key) ? acc : [...acc, f]), []);

// PRESET_KERTAS — 4 pilihan ukuran kertas. Tiap preset punya default font
// sendiri (font_kode_mm/font_nama_mm/font_info_mm) dalam mm, ikut satuan
// lebar/tinggi supaya ukuran fisiknya konsisten dan akurat di pratinjau. Font
// ini masih bebas ditimpa manual per grup.
export const PRESET_KERTAS = {
  kasir_roll: { label: 'Kasir Roll (lebar saja)', lebar_mm: 80, tinggi_mm: 0, isRoll: true },
  custom: { label: 'Custom (isi manual mm)', lebar_mm: 101.6, tinggi_mm: 50.8, isRoll: false, font_kode_mm: 4.5, font_nama_mm: 3.5, font_info_mm: 2.9 },
  thermal_15x10: { label: 'Thermal 15 x 10 cm', lebar_mm: 150, tinggi_mm: 100, isRoll: false, font_kode_mm: 6, font_nama_mm: 4.5, font_info_mm: 3.5 },
  thermal_4x2: { label: 'Thermal 4 x 2 cm', lebar_mm: 40, tinggi_mm: 20, isRoll: false, font_kode_mm: 2.6, font_nama_mm: 2, font_info_mm: 1.7 }
};

// Fallback kalau suatu jenisId BELUM dimasukkan ke grup manapun: 4x2 inch
// (101.6 x 50.8mm), ukuran yang berlaku umum di app ini.
const DEFAULT_PENGATURAN = { lebar_mm: 101.6, tinggi_mm: 50.8, posisi_qr: 'kiri', rincian_aktif: [], font_kode_mm: PRESET_KERTAS.custom.font_kode_mm, font_nama_mm: PRESET_KERTAS.custom.font_nama_mm, font_info_mm: PRESET_KERTAS.custom.font_info_mm, rotasi_90: false };
const DEFAULT_STRUK = { lebar_mm: 80, tinggi_mm: 0, posisi_qr: 'kiri', rincian_aktif: [], rotasi_90: false };

// DUMMY_CONTOH_LABEL — data contoh dipakai pratinjau live Edit Grup Cetak (BUKAN
// data sungguhan) supaya bisa lihat kira-kira hasil cetak SEBELUM simpan,
// termasuk kasus kode panjang yang paling gampang menumpuk.
const DUMMY_CONTOH_LABEL = {
  kode: 'G26R0913P003-120302-01',
  nama: 'POLYFOAM 5MM PUTIH',
  info: 'Jahid &middot; SUNNIE',
  rincian: { roll: '12', kode_webbing2: 'W2-045', kode_webbing3: 'W3-012', varian: 'Hitam x 20', lokasi_rak: 'A3-02' }
};

// Cache in-memory per sesi, hemat read Firestore. Koleksi
// `pengaturan_cetak` kecil (jumlah grup, bukan jumlah titik cetak), jadi 1x
// getDocs cukup utk semua lookup jenisId->grup sepanjang sesi.
let _cacheGrup = null; // array [{id, ..data}] setelah dimuat, null = belum dimuat
let _petaJenisKeGrup = null; // Map jenisId -> grup

async function pastikanCacheGrup() {
  if (_cacheGrup) return;
  try {
    const snap = await getDocs(collection(db, 'pengaturan_cetak'));
    _cacheGrup = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Gagal muat pengaturan_cetak (grup):', e);
    _cacheGrup = [];
  }
  _petaJenisKeGrup = new Map();
  for (const g of _cacheGrup) {
    for (const jenisId of (g.anggota_jenis || [])) _petaJenisKeGrup.set(jenisId, g);
  }
}

function invalidasiCacheGrup() {
  _cacheGrup = null;
  _petaJenisKeGrup = null;
}

// ambilPengaturanCetak — dipanggil `PopupPratinjauCetakLabel`
// (vue-components.js). Mencari grup pemilik jenisId lalu mengembalikan
// {lebar_mm, tinggi_mm, posisi_qr, rincian_aktif}.
export async function ambilPengaturanCetak(jenisId) {
  await pastikanCacheGrup();
  const grup = _petaJenisKeGrup.get(jenisId);
  const fallback = (KATALOG_CETAK[jenisId] && KATALOG_CETAK[jenisId].strukRoll) ? DEFAULT_STRUK : DEFAULT_PENGATURAN;
  if (!grup) return { ...fallback };
  return {
    lebar_mm: parseFloat(grup.lebar_mm) || fallback.lebar_mm,
    tinggi_mm: parseFloat(grup.tinggi_mm) || fallback.tinggi_mm,
    posisi_qr: grup.posisi_qr || fallback.posisi_qr,
    rincian_aktif: grup.field_tampil || [],
    font_kode_mm: parseFloat(grup.font_kode_mm) || fallback.font_kode_mm || DEFAULT_PENGATURAN.font_kode_mm,
    font_nama_mm: parseFloat(grup.font_nama_mm) || fallback.font_nama_mm || DEFAULT_PENGATURAN.font_nama_mm,
    font_info_mm: parseFloat(grup.font_info_mm) || fallback.font_info_mm || DEFAULT_PENGATURAN.font_info_mm,
    // rotasi_90 — driver printer label kecil kadang portrait tetap walau ukuran
    // fisiknya landscape, hasil cetak jadi vertical. Kalau grup ditandai
    // rotasi_90, PopupPratinjauCetakLabel membalik @page jadi tinggi x lebar
    // lalu memutar isi label 90 derajat. Default false.
    rotasi_90: !!grup.rotasi_90
  };
}


// AppPengaturanCetak — layar admin, mount di Scan & Cetak > Cetak. Sekarang
// kelola GRUP, bukan lagi 1 form per jenis tetap.

export const AppPengaturanCetak = {
  setup() {
    const memuat = ref(true);
    const daftarGrup = ref([]); // [{id, nama, jenis_kertas, lebar_mm, tinggi_mm, posisi_qr, field_tampil, anggota_jenis}]
    const editAktif = ref(null); // null | '__baru__' | grupId
    const formEdit = reactive({ nama: '', jenis_kertas: 'custom', lebar_mm: 101.6, tinggi_mm: 50.8, posisi_qr: 'kiri', field_tampil: [], anggota_jenis: [], font_kode_mm: PRESET_KERTAS.custom.font_kode_mm, font_nama_mm: PRESET_KERTAS.custom.font_nama_mm, font_info_mm: PRESET_KERTAS.custom.font_info_mm, rotasi_90: false });
    const menyimpan = ref(false);

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDocs(collection(db, 'pengaturan_cetak'));
        daftarGrup.value = snap.docs.map(d => ({ id: d.id, ...d.data(), anggota_jenis: d.data().anggota_jenis || [], field_tampil: d.data().field_tampil || [] }));
        // Sinkronkan cache modul (dipakai ambilPengaturanCetak) sekalian,
        // supaya popup cetak yang dibuka sesudah ini langsung dapat data
        // terkini tanpa nunggu reload halaman.
        _cacheGrup = daftarGrup.value;
        _petaJenisKeGrup = new Map();
        for (const g of _cacheGrup) for (const j of g.anggota_jenis) _petaJenisKeGrup.set(j, g);
      } catch (e) {
        console.error('Gagal muat pengaturan_cetak (grup):', e);
        alert('Gagal memuat Pengaturan Cetak. Coba refresh.');
      }
      memuat.value = false;
    }

    // Titik cetak yang belum masuk grup manapun — supaya lihat apa yang masih
    // perlu dipetakan.
    const jenisBelumPunyaGrup = computed(() => {
      const terpakai = new Set(daftarGrup.value.flatMap(g => g.anggota_jenis));
      return Object.keys(KATALOG_CETAK).filter(id => !terpakai.has(id));
    });

    // Peta jenisId -> nama grup pemiliknya .
    const petaPemilikSaatIni = computed(() => {
      const peta = {};
      daftarGrup.value.forEach(g => { g.anggota_jenis.forEach(j => { peta[j] = g; }); });
      return peta;
    });

    // Daftar jenis dikelompokkan per kategori, buat checklist anggota di form
    // (lebih gampang dibaca daripada 16 baris polos).
    const jenisPerKategori = computed(() => {
      const peta = {};
      Object.entries(KATALOG_CETAK).forEach(([id, j]) => {
        (peta[j.kategori] ||= []).push({ id, ...j });
      });
      return peta;
    });

    // Pratinjau live di form Edit Grup Cetak, DISKALA dari ukuran fisik
    // (lebar_mm/tinggi_mm) memakai rumus padding/gap/QR/font yang SAMA PERSIS
    // dengan `PopupPratinjauCetakLabel.cetakSekarang`. Teks yang menumpuk atau
    // kepotong di sini akan menumpuk juga di kertas beneran.
    const skalaPreview = computed(() => {
      const lebar = parseFloat(formEdit.lebar_mm) || 1;
      const tinggiRaw = formEdit.jenis_kertas === 'kasir_roll' ? lebar * 0.6 : (parseFloat(formEdit.tinggi_mm) || 1);
      const skala = Math.min(260 / lebar, 220 / tinggiRaw);
      return Math.max(0.5, Math.min(skala, 8));
    });
    const previewGeo = computed(() => {
      const lebar = parseFloat(formEdit.lebar_mm) || 1;
      const tinggi = formEdit.jenis_kertas === 'kasir_roll' ? lebar * 0.6 : (parseFloat(formEdit.tinggi_mm) || 1);
      const sisiPendek = Math.min(lebar, tinggi);
      const padding = Math.max(1.5, sisiPendek * 0.11);
      const gap = Math.max(1.5, sisiPendek * 0.1);
      const qrSize = sisiPendek * 0.42;
      const s = skalaPreview.value;
      return {
        lebarPx: lebar * s, tinggiPx: tinggi * s,
        paddingPx: padding * s, gapPx: gap * s, qrSizePx: qrSize * s,
        fontKodePx: (parseFloat(formEdit.font_kode_mm) || 1) * s,
        fontNamaPx: (parseFloat(formEdit.font_nama_mm) || 1) * s,
        fontInfoPx: (parseFloat(formEdit.font_info_mm) || 1) * s,
        flexDir: formEdit.posisi_qr === 'kanan' ? 'row-reverse' : (formEdit.posisi_qr === 'atas' ? 'column' : 'row')
      };
    });
    // Rincian contoh dipilih di form ini, diisi nilai DUMMY (bukan data
    // sungguhan) sekadar simulasi tampilan.
    const rincianPreviewAktif = computed(() =>
      formEdit.field_tampil
        .map(key => SEMUA_FIELD_TERSEDIA.find(r => r.key === key))
        .filter(Boolean)
        .map(r => ({ ...r, nilai: DUMMY_CONTOH_LABEL.rincian[r.key] ?? '(contoh)' }))
    );

    function bukaTambah() {
      editAktif.value = '__baru__';
      formEdit.nama = '';
      formEdit.jenis_kertas = 'custom';
      formEdit.lebar_mm = PRESET_KERTAS.custom.lebar_mm;
      formEdit.tinggi_mm = PRESET_KERTAS.custom.tinggi_mm;
      formEdit.posisi_qr = 'kiri';
      formEdit.field_tampil = [];
      formEdit.anggota_jenis = [];
      formEdit.font_kode_mm = PRESET_KERTAS.custom.font_kode_mm;
      formEdit.font_nama_mm = PRESET_KERTAS.custom.font_nama_mm;
      formEdit.font_info_mm = PRESET_KERTAS.custom.font_info_mm;
      formEdit.rotasi_90 = false;
    }
    function bukaEdit(g) {
      editAktif.value = g.id;
      formEdit.nama = g.nama || '';
      formEdit.jenis_kertas = g.jenis_kertas || 'custom';
      formEdit.lebar_mm = g.lebar_mm;
      formEdit.tinggi_mm = g.tinggi_mm;
      formEdit.posisi_qr = g.posisi_qr || 'kiri';
      formEdit.field_tampil = [...(g.field_tampil || [])];
      formEdit.anggota_jenis = [...(g.anggota_jenis || [])];
      // Grup lama (dibuat sebelum font mm ada) belum punya field ini — fallback
      // ke default preset-nya sendiri, bukan custom, supaya grup kecil lama
      // tidak tiba-tiba dianggap punya font besar 4x2inch.
      const presetFont = PRESET_KERTAS[g.jenis_kertas] || PRESET_KERTAS.custom;
      formEdit.font_kode_mm = parseFloat(g.font_kode_mm) || presetFont.font_kode_mm;
      formEdit.font_nama_mm = parseFloat(g.font_nama_mm) || presetFont.font_nama_mm;
      formEdit.font_info_mm = parseFloat(g.font_info_mm) || presetFont.font_info_mm;
      formEdit.rotasi_90 = !!g.rotasi_90;
    }
    function tutupEdit() { editAktif.value = null; }

    // pilihPreset — pilih preset TIMPA lebar/tinggi/font dgn nilai presetnya
    // (font ikut ukuran preset, sudah ditakar biar tidak menumpuk — lihat
    // komentar PRESET_KERTAS). Kalau pilih 'custom', nilai lama dibiarkan .
    function pilihPreset(key) {
      formEdit.jenis_kertas = key;
      if (key !== 'custom') {
        formEdit.lebar_mm = PRESET_KERTAS[key].lebar_mm;
        formEdit.tinggi_mm = PRESET_KERTAS[key].tinggi_mm;
        if (PRESET_KERTAS[key].font_kode_mm) {
          formEdit.font_kode_mm = PRESET_KERTAS[key].font_kode_mm;
          formEdit.font_nama_mm = PRESET_KERTAS[key].font_nama_mm;
          formEdit.font_info_mm = PRESET_KERTAS[key].font_info_mm;
        }
      }
    }

    function toggleField(key) {
      const idx = formEdit.field_tampil.indexOf(key);
      if (idx >= 0) formEdit.field_tampil.splice(idx, 1);
      else formEdit.field_tampil.push(key);
    }
    function naikkanField(key) {
      const idx = formEdit.field_tampil.indexOf(key);
      if (idx > 0) { const t = formEdit.field_tampil[idx - 1]; formEdit.field_tampil[idx - 1] = formEdit.field_tampil[idx]; formEdit.field_tampil[idx] = t; }
    }
    function turunkanField(key) {
      const idx = formEdit.field_tampil.indexOf(key);
      if (idx >= 0 && idx < formEdit.field_tampil.length - 1) { const t = formEdit.field_tampil[idx + 1]; formEdit.field_tampil[idx + 1] = formEdit.field_tampil[idx]; formEdit.field_tampil[idx] = t; }
    }

    // toggleAnggota — 1 titik cetak = 1 grup saja. Centang di sini TIDAK
    // langsung mengeluarkan dari grup lain; itu terjadi saat Simpan, supaya
    // Batal tidak meninggalkan efek samping ke grup lain.
    function toggleAnggota(jenisId) {
      const idx = formEdit.anggota_jenis.indexOf(jenisId);
      if (idx >= 0) formEdit.anggota_jenis.splice(idx, 1);
      else formEdit.anggota_jenis.push(jenisId);
    }

    async function simpanGrup() {
      if (!formEdit.nama.trim()) return alert('Nama grup wajib diisi.');
      if (!(parseFloat(formEdit.lebar_mm) > 0)) return alert('Lebar kertas harus lebih dari 0 mm.');
      const isRoll = formEdit.jenis_kertas === 'kasir_roll';
      if (!isRoll && !(parseFloat(formEdit.tinggi_mm) > 0)) return alert('Tinggi kertas harus lebih dari 0 mm.');
      menyimpan.value = true;
      try {
        const grupId = editAktif.value === '__baru__' ? doc(collection(db, 'pengaturan_cetak')).id : editAktif.value;
        const data = {
          nama: formEdit.nama.trim(),
          jenis_kertas: formEdit.jenis_kertas,
          lebar_mm: parseFloat(formEdit.lebar_mm) || 0,
          tinggi_mm: isRoll ? 0 : (parseFloat(formEdit.tinggi_mm) || 0),
          posisi_qr: formEdit.posisi_qr,
          field_tampil: [...formEdit.field_tampil],
          anggota_jenis: [...formEdit.anggota_jenis],
          font_kode_mm: parseFloat(formEdit.font_kode_mm) || PRESET_KERTAS.custom.font_kode_mm,
          font_nama_mm: parseFloat(formEdit.font_nama_mm) || PRESET_KERTAS.custom.font_nama_mm,
          font_info_mm: parseFloat(formEdit.font_info_mm) || PRESET_KERTAS.custom.font_info_mm,
          rotasi_90: isRoll ? false : !!formEdit.rotasi_90,
          diubah_pada: serverTimestamp(),
          diubah_oleh: (window.currentUser && (window.currentUser.nama || window.currentUser.email)) || '-'
        };
        // Tegakkan "1 titik cetak = 1 grup saja" — keluarkan anggota yang
        // dipindah dari grup lamanya (kalau ada), SEBELUM menulis grup ini.
        const tulisan = [];
        for (const g of daftarGrup.value) {
          if (g.id === grupId) continue;
          const masihAda = (g.anggota_jenis || []).filter(j => !data.anggota_jenis.includes(j));
          if (masihAda.length !== (g.anggota_jenis || []).length) {
            tulisan.push(setDoc(doc(db, 'pengaturan_cetak', g.id), { anggota_jenis: masihAda }, { merge: true }));
          }
        }
        tulisan.push(setDoc(doc(db, 'pengaturan_cetak', grupId), data, { merge: false }));
        await Promise.all(tulisan);
        invalidasiCacheGrup();
        editAktif.value = null;
        await muat();
        alert('Grup cetak disimpan.');
      } catch (e) {
        console.error('Gagal simpan grup cetak:', e);
        alert('Gagal menyimpan. Coba lagi.');
      }
      menyimpan.value = false;
    }

    async function hapusGrup(g) {
      if (!confirm(`Hapus grup "${g.nama}"? ${g.anggota_jenis.length} titik cetak anggotanya akan balik ke ukuran default (4x2 inch) sampai dimasukkan ke grup lain.`)) return;
      try {
        await deleteDoc(doc(db, 'pengaturan_cetak', g.id));
        invalidasiCacheGrup();
        await muat();
      } catch (e) { console.error('Gagal hapus grup cetak:', e); alert('Gagal menghapus. Coba lagi.'); }
    }

    onMounted(muat);

    return {
      memuat, daftarGrup, editAktif, formEdit, menyimpan,
      jenisBelumPunyaGrup, petaPemilikSaatIni, jenisPerKategori,
      KATALOG_CETAK, PRESET_KERTAS, SEMUA_FIELD_TERSEDIA, DUMMY_CONTOH_LABEL,
      previewGeo, rincianPreviewAktif,
      bukaTambah, bukaEdit, tutupEdit, pilihPreset,
      toggleField, naikkanField, turunkanField, toggleAnggota,
      simpanGrup, hapusGrup
    };
  },
  template: `
    <div>
      <div style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <div>
          <h3 class="gc-heading" style="font-size:14px; font-weight:700; margin:0 0 4px;">Pengaturan Cetak</h3>
          <p style="font-size:11px; color:var(--text-faint); margin:0;">Bikin grup bebas (nama, jenis kertas, field yang tampil, posisi QR), lalu tentukan titik cetak mana saja jadi anggotanya. 1 titik cetak cuma boleh masuk 1 grup.</p>
        </div>
        <button @click="bukaTambah" class="btn-primary" style="flex-shrink:0; padding:8px 14px; font-size:11.5px;"><i class="fas fa-plus" style="margin-right:6px;"></i>Grup Baru</button>
      </div>

      <div v-if="memuat" class="gc-kosong">Memuat...</div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="g in daftarGrup" :key="g.id" class="gc-card" style="padding:12px 14px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
            <div style="min-width:0;">
              <div style="font-weight:700; font-size:12.5px;">{{ g.nama }}</div>
              <div class="gc-num" style="font-size:11px; margin-top:4px; color:var(--text-muted);">
                {{ PRESET_KERTAS[g.jenis_kertas]?.label || g.jenis_kertas }} &middot;
                <span v-if="g.jenis_kertas==='kasir_roll'">lebar {{ g.lebar_mm }}mm</span>
                <span v-else>{{ g.lebar_mm }} x {{ g.tinggi_mm }} mm</span>
                &middot; QR di {{ g.posisi_qr }}
                <span v-if="g.field_tampil.length"> &middot; {{ g.field_tampil.length }} field tambahan</span>
                <span v-if="g.rotasi_90"> &middot; <i class="fas fa-rotate" style="font-size:9px;"></i> putar 90&deg;</span>
              </div>
              <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:5px;">
                <span v-for="j in g.anggota_jenis" :key="j" class="tag" style="font-size:10px;">{{ KATALOG_CETAK[j]?.label || j }}</span>
                <span v-if="!g.anggota_jenis.length" style="font-size:10.5px; color:var(--text-faint);">Belum ada anggota.</span>
              </div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button @click="bukaEdit(g)" class="btn-outline" style="padding:7px 12px; font-size:11px;"><i class="fas fa-pen" style="margin-right:5px;"></i>Edit</button>
              <button @click="hapusGrup(g)" class="icon-btn" style="padding:7px 10px; color:var(--danger);"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        </div>
        <div v-if="!daftarGrup.length" class="gc-kosong">Belum ada grup. Buat 1 grup dulu supaya titik cetak bisa diatur ukurannya.</div>

        <div v-if="jenisBelumPunyaGrup.length" class="gc-card" style="padding:12px 14px; background:var(--ivory-dim);">
          <div style="font-weight:700; font-size:11.5px; margin-bottom:6px;"><i class="fas fa-triangle-exclamation" style="margin-right:6px; color:var(--warn);"></i>Belum masuk grup manapun ({{ jenisBelumPunyaGrup.length }}) — masih pakai ukuran default 4x2 inch:</div>
          <div style="display:flex; flex-wrap:wrap; gap:5px;">
            <span v-for="j in jenisBelumPunyaGrup" :key="j" class="tag neutral" style="font-size:10px;">{{ KATALOG_CETAK[j].label }}</span>
          </div>
        </div>
      </div>

      <div v-if="editAktif" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="tutupEdit">
        <div class="gc-card" style="max-width:520px; width:100%; max-height:90vh; overflow-y:auto; padding:18px;">
          <h3 class="gc-heading" style="font-size:14px; font-weight:700; margin:0 0 12px;">{{ editAktif==='__baru__' ? 'Grup Cetak Baru' : 'Edit Grup Cetak' }}</h3>

          <div class="gc-field">
            <label>Nama Grup</label>
            <input v-model="formEdit.nama" type="text" placeholder="mis. Label Kecil Produksi">
          </div>

          <div class="gc-field">
            <label>Jenis Kertas</label>
            <select :value="formEdit.jenis_kertas" @change="pilihPreset($event.target.value)">
              <option v-for="(p,key) in PRESET_KERTAS" :key="key" :value="key">{{ p.label }}</option>
            </select>
          </div>

          <div v-if="formEdit.jenis_kertas==='kasir_roll'" class="gc-field">
            <label>Lebar Roll (mm)</label>
            <input v-model.number="formEdit.lebar_mm" type="number" min="1">
          </div>
          <div v-else style="display:flex; gap:10px;">
            <div class="gc-field" style="flex:1;"><label>Lebar (mm)</label><input v-model.number="formEdit.lebar_mm" type="number" min="1"></div>
            <div class="gc-field" style="flex:1;"><label>Tinggi (mm)</label><input v-model.number="formEdit.tinggi_mm" type="number" min="1"></div>
          </div>

          <div class="gc-field">
            <label>Posisi QR</label>
            <select v-model="formEdit.posisi_qr">
              <option value="kiri">Kiri</option>
              <option value="kanan">Kanan</option>
              <option value="atas">Atas</option>
            </select>
          </div>

          <div v-if="formEdit.jenis_kertas !== 'kasir_roll'" style="margin-bottom:14px; padding:10px 12px; background:var(--ivory-dim); border-radius:10px;">
            <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
              <input type="checkbox" v-model="formEdit.rotasi_90">
              Putar konten 90&deg; saat cetak
            </label>
            <p style="font-size:10px; color:var(--text-faint); margin:6px 0 0;">Aktifkan HANYA kalau printer untuk grup ini selalu mencetak vertical (portrait) walau Lebar/Tinggi di atas sudah benar landscape &mdash; driver printernya yang paksa orientasi tetap, bukan ukurannya yang salah. Tidak mengubah proporsi label, cuma memutar hasil cetaknya.</p>
          </div>

          <template v-if="formEdit.jenis_kertas !== 'kasir_roll'">
            <div style="margin-bottom:14px;">
              <label style="font-size:11px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">Ukuran Font (mm) — kecilkan kalau teks menumpuk</label>
              <div style="display:flex; gap:8px;">
                <div class="gc-field" style="flex:1; margin-bottom:0;"><label style="font-size:10px;">Kode</label><input v-model.number="formEdit.font_kode_mm" type="number" min="1" step="0.1"></div>
                <div class="gc-field" style="flex:1; margin-bottom:0;"><label style="font-size:10px;">Nama</label><input v-model.number="formEdit.font_nama_mm" type="number" min="1" step="0.1"></div>
                <div class="gc-field" style="flex:1; margin-bottom:0;"><label style="font-size:10px;">Info & Rincian</label><input v-model.number="formEdit.font_info_mm" type="number" min="1" step="0.1"></div>
              </div>
            </div>

            <div style="margin-bottom:16px;">
              <label style="font-size:11px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">Pratinjau (contoh data, bukan data sungguhan)</label>
              <div style="display:flex; justify-content:center; padding:14px; background:var(--surface); border-radius:10px;">
                <div :style="{width: previewGeo.lebarPx + 'px', height: previewGeo.tinggiPx + 'px', padding: previewGeo.paddingPx + 'px', display:'flex', flexDirection: previewGeo.flexDir, alignItems:'center', justifyContent: formEdit.posisi_qr==='atas' ? 'center' : 'flex-start', gap: previewGeo.gapPx + 'px', background:'#fff', border:'1.5px dashed var(--line)', boxSizing:'border-box', overflow:'hidden'}">
                  <div :style="{width: previewGeo.qrSizePx + 'px', height: previewGeo.qrSizePx + 'px', flexShrink:0, background:'repeating-linear-gradient(45deg,#222,#222 2px,#fff 2px,#fff 4px)'}"></div>
                  <div :style="{minWidth:0, overflow:'hidden', lineHeight:1.35, textAlign: formEdit.posisi_qr==='atas' ? 'center' : 'left', fontFamily:'Arial,sans-serif'}">
                    <div :style="{fontWeight:700, fontSize: previewGeo.fontKodePx + 'px', marginBottom:'2px', wordBreak:'break-all', color:'#111'}">{{ DUMMY_CONTOH_LABEL.kode }}</div>
                    <div :style="{fontSize: previewGeo.fontNamaPx + 'px', color:'#111'}">{{ DUMMY_CONTOH_LABEL.nama }}</div>
                    <div :style="{fontSize: previewGeo.fontInfoPx + 'px', color:'#555', marginTop:'1px'}" v-html="DUMMY_CONTOH_LABEL.info"></div>
                    <div v-for="r in rincianPreviewAktif" :key="r.key" :style="{fontSize: previewGeo.fontInfoPx + 'px', color:'#444', marginTop:'1px'}"><b>{{ r.label }}:</b> {{ r.nilai }}</div>
                  </div>
                </div>
              </div>
              <p style="font-size:10px; color:var(--text-faint); margin:6px 0 0; text-align:center;">Kotak putus-putus = ukuran label sebenarnya ({{ formEdit.lebar_mm }} x {{ formEdit.jenis_kertas==='kasir_roll' ? '...' : formEdit.tinggi_mm }} mm). Teks yang terpotong/tumpang tindih di sini akan sama persis saat dicetak.</p>
            </div>
          </template>

          <div style="margin-top:6px; margin-bottom:14px;">
            <label style="font-size:11px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:4px;">Field tambahan yang ditampilkan (urutan dari atas = urutan cetak)</label>
            <p style="font-size:10px; color:var(--text-faint); margin:0 0 6px;">Field yang datanya kosong untuk suatu titik cetak otomatis dilewati saat cetak (bukan error, bukan baris kosong).</p>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <div v-for="r in SEMUA_FIELD_TERSEDIA" :key="r.key" style="display:flex; align-items:center; gap:8px; font-size:11.5px; padding:6px 8px; border-radius:8px; background:var(--ivory-dim);">
                <input type="checkbox" :checked="formEdit.field_tampil.includes(r.key)" @change="toggleField(r.key)">
                <span style="flex:1;">{{ r.label }}</span>
                <button v-if="formEdit.field_tampil.includes(r.key)" type="button" @click="naikkanField(r.key)" class="icon-btn" style="padding:2px 6px;"><i class="fas fa-arrow-up"></i></button>
                <button v-if="formEdit.field_tampil.includes(r.key)" type="button" @click="turunkanField(r.key)" class="icon-btn" style="padding:2px 6px;"><i class="fas fa-arrow-down"></i></button>
              </div>
              <div v-if="!SEMUA_FIELD_TERSEDIA.length" style="font-size:10.5px; color:var(--text-faint);">Belum ada field tambahan yang tercatat sistem.</div>
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <label style="font-size:11px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">Anggota grup (titik cetak)</label>
            <div v-for="(daftar, kategori) in jenisPerKategori" :key="kategori" style="margin-bottom:10px;">
              <div style="font-size:10px; font-weight:700; color:var(--text-faint); text-transform:uppercase; letter-spacing:.03em; margin-bottom:4px;">{{ kategori }}</div>
              <div v-for="j in daftar" :key="j.id" style="display:flex; align-items:center; gap:8px; font-size:11.5px; padding:5px 8px; border-radius:8px;" :style="{background: formEdit.anggota_jenis.includes(j.id) ? 'var(--ivory-dim)' : 'transparent'}">
                <input type="checkbox" :checked="formEdit.anggota_jenis.includes(j.id)" @change="toggleAnggota(j.id)">
                <span style="flex:1;">{{ j.label }}</span>
                <span v-if="petaPemilikSaatIni[j.id] && petaPemilikSaatIni[j.id].id !== editAktif" style="font-size:9.5px; color:var(--text-faint);">saat ini di: {{ petaPemilikSaatIni[j.id].nama }}</span>
              </div>
            </div>
          </div>

          <div style="display:flex; gap:8px;">
            <button @click="simpanGrup" :disabled="menyimpan" class="btn-primary" style="flex:1; padding:10px;">{{ menyimpan ? 'Menyimpan...' : 'Simpan' }}</button>
            <button @click="tutupEdit" type="button" class="btn-outline" style="flex:1; padding:10px;">Batal</button>
          </div>
        </div>
      </div>
    </div>
  `
};

let _appPengaturanCetak = null;
window.pastikanMountPengaturanCetak = function () {
  const el = document.getElementById('vue-pengaturan-cetak');
  if (!el || el.dataset.mounted === '1') return;
  _appPengaturanCetak = createApp(AppPengaturanCetak);
  _appPengaturanCetak.mount('#vue-pengaturan-cetak');
  el.dataset.mounted = '1';
};
