// js/vue-pengaturan-cetak.js
// ============================================================================
// Pengaturan Cetak — dibangun 8 Sep 2026 (audit kode proyek), DIROMBAK lagi
// di sesi yang sama (Guru minta sistem GRUP, bukan 1 setingan per jenis).
//
// LATAR (versi awal): audit menemukan `PopupPratinjauCetakLabel` (vue-
// components.js) pakai SATU ukuran fisik hardcode (4x2 inch) untuk SEMUA
// jenis label di seluruh app — padahal PEDOMAN-SERAH-TERIMA.md §5
// mendokumentasikan ukuran BERBEDA per jenis (SPK Grouping 10x15cm, label
// kecil 4x2cm, dst) dan bagian "Setting cetak terpusat" PEDOMAN eksplisit
// minta 1 config per jenis cetak, diedit dari menu Scan & Cetak, otomatis
// berlaku ke semua pos pemakainya ("satu modul cetak, banyak pos").
//
// KENAPA DIROMBAK JADI GRUP (bukan 1 config per jenis seperti versi awal):
// Guru eksplisit minta bisa BIKIN GRUP sendiri dari layar ini — kasih nama,
// pilih jenis kertas (preset), field yang tampil, posisi QR — LALU petakan
// menu/titik cetak mana saja yang jadi anggota grup itu. Jadi kalau ada
// 16 titik cetak tapi cuma butuh beberapa "model" fisik kertas, Guru cukup
// bikin sedikit grup (bebas jumlahnya, tidak dipatok 4) dan atur SEKALI per
// grup — bukan 16x konfigurasi terpisah yang isinya sering sama.
//
// ARSITEKTUR PENTING:
// - KATALOG_CETAK di bawah = daftar TETAP 16 titik cetak yang benar-benar
//   ada di kode (tombol/layar sungguhan, id-nya dipakai persis di prop
//   `jenis-cetak` tiap pemanggil `PopupPratinjauCetakLabel`). Guru TIDAK
//   bisa menambah/menghapus/ubah titik cetak dari sini — itu berarti ubah
//   kode, bukan setingan. Yang BISA Guru atur cuma: grup mana jadi rumah
//   tiap titik cetak itu, dan setingan fisik grup tersebut.
// - Koleksi Firestore `pengaturan_cetak/{grupId}` — SEKARANG 1 dokumen =
//   1 GRUP (bukan 1 dokumen per jenis seperti versi awal sebelum dirombak).
//   Nama koleksi SENGAJA tidak diganti (masih `pengaturan_cetak`) supaya
//   rule Firestore yang sudah disiapkan Guru (allow read: login(), allow
//   write: isAdminLevel()) tetap berlaku tanpa perlu diubah lagi — aturan
//   itu general untuk id dokumen apapun di koleksi ini.
// - `ambilPengaturanCetak(jenisId)` — kontrak fungsi ini SENGAJA TIDAK
//   berubah dari versi awal (nama fungsi sama, bentuk hasil sama: {lebar_mm,
//   tinggi_mm, posisi_qr, rincian_aktif}) — jadi `PopupPratinjauCetakLabel`
//   (js/vue-components.js) dan SEMUA 19 file pemanggil yang sudah disambung
//   kemarin TIDAK PERLU diubah sama sekali. Yang berubah cuma ISI dalam
//   fungsi ini: sekarang cari dulu grup mana yang punya jenisId itu sebagai
//   anggota, baru pakai setingan grup itu. Titik cetak yang BELUM masuk grup
//   manapun tetap fallback ke DEFAULT_PENGATURAN (=ukuran lama 101.6x50.8mm,
//   supaya tidak ada cetakan yang tiba-tiba berubah sebelum Guru sempat
//   mengatur grupnya).
//
// PRESET_KERTAS — 4 pilihan sesuai keputusan Guru (bukan lagi cuma isi mm
// bebas): Kasir Roll (lebar saja, roll thermal panjang), Custom (isi manual
// mm, buat ukuran di luar 3 preset lain), Thermal 15x10cm (=150x100mm,
// sesuai PEDOMAN §5 utk SPK Grouping), Thermal 4x2cm (=40x20mm, sesuai
// PEDOMAN §5 utk label kecil — CATATAN: ini BEDA dari 4x2 INCH/101.6x50.8mm
// yang jadi default lama; Guru yang pilih preset ini SADAR itu ukuran cm,
// bukan inch, kalau salah pilih ukurannya kelihatan jomplang pas pratinjau).
//
// "Field yang tampil" per grup: daftar field TAMBAHAN opsional (di luar
// kode/nama/info dasar yang tetap ditentukan kode pemanggil, lihat komentar
// besar `PopupPratinjauCetakLabel` di vue-components.js) — sumbernya
// `rincianTersedia` tiap jenis di KATALOG_CETAK, digabung jadi 1 katalog
// field global (SEMUA_FIELD_TERSEDIA) supaya Guru bisa pilih bebas per grup,
// TIDAK dibatasi cuma field milik anggota yang KEBETULAN sudah dicentang.
// Kalau grup itu ada anggota yang datanya TIDAK punya field yang dicentang
// (mis. grup gabungan Acc Sewing + Acc Webbing, field "Roll" cuma dipunya
// Acc Webbing), baris itu OTOMATIS DILEWATI saat cetak utk anggota yang
// tidak punya datanya — BUKAN error, bukan baris kosong. Logika skip ini
// sudah ada dari awal di `PopupPratinjauCetakLabel.cetakSekarang()`, tidak
// perlu field "catatan" terpisah (itu yang ditanyakan Guru, dan itu memang
// sudah jadi perilaku bawaan, bukan sesuatu yang perlu dikonfigurasi).
//
// Field BARU (belum pernah dicatat sistem sama sekali di collection
// manapun) TIDAK BISA muncul di sini cuma dengan Guru menyebut namanya —
// field itu harus ditambah dulu pencatatannya di layar entry terkait
// (kode), baru bisa didaftarkan sebagai rincianTersedia jenis itu di
// KATALOG_CETAK, baru muncul sebagai pilihan di SEMUA_FIELD_TERSEDIA.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// KATALOG_CETAK — daftar TETAP semua titik cetak di app ini. Menambah titik
// cetak BARU di kemudian hari = tambah 1 entri di sini (id harus SAMA persis
// dengan yang dipakai pemanggil `PopupPratinjauCetakLabel :jenis-cetak="..."`).
// TIDAK berubah dari versi awal — cuma sekarang dipakai juga sebagai sumber
// checklist "anggota grup" + katalog field global, bukan lagi kunci dokumen
// setingan langsung.
export const KATALOG_CETAK = {
  label_spk_bahan: {
    label: 'Label SPK Grouping — Bahan', kategori: 'Persiapan Produksi',
    keterangan: 'Persiapan Produksi > Bahan, tiap tahap. 1 label per bahan.',
    rincianTersedia: []
  },
  label_spk_acc_sewing: {
    label: 'Label SPK Grouping — Acc Sewing', kategori: 'Persiapan Produksi',
    keterangan: 'Persiapan Produksi > Acc Sewing. 1 SPK = 1 label.',
    rincianTersedia: []
  },
  label_spk_acc_webbing: {
    label: 'Label SPK Grouping — Acc Webbing', kategori: 'Persiapan Produksi',
    keterangan: 'Persiapan Produksi > Acc Webbing. 1 SPK = 1 label.',
    rincianTersedia: [
      { key: 'roll', label: 'Roll' },
      { key: 'kode_webbing2', label: 'Kode Webbing 2' },
      { key: 'kode_webbing3', label: 'Kode Webbing 3' }
    ]
  },
  label_spk_acc_finishing: {
    label: 'Label SPK Grouping — Acc Finishing', kategori: 'Persiapan Produksi',
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
    label: 'Label No. SPK', kategori: 'Zevanic House',
    keterangan: 'Zevanic House > Order SPK (master data No. SPK dari spreadsheet lama).',
    rincianTersedia: []
  },
  label_roll_pembelian: {
    label: 'Label Roll Pembelian', kategori: 'Stok & Pembelian',
    keterangan: 'Stok & Pembelian > Nota Order Belanja, cetak label per roll/lot yang diterima.',
    rincianTersedia: []
  },
  struk_kasir: {
    label: 'Struk Kasir', kategori: 'Pesanan',
    keterangan: 'Pesanan > Penjualan Kasir. Kertas roll (lebar saja). BELUM disambungkan ke komponen popup manapun (menyusul) — atur grupnya boleh, tapi belum ada efek cetak sungguhan.',
    rincianTersedia: [],
    strukRoll: true
  }
};

// SEMUA_FIELD_TERSEDIA — katalog field tambahan GLOBAL, gabungan dari
// rincianTersedia semua jenis di atas, dedup by key. Dipakai sebagai pilihan
// "field yang tampil" di form grup — Guru bebas pilih dari sini utk grup
// manapun, TIDAK dibatasi cuma field milik anggota yang sedang dicentang di
// grup itu (lihat catatan besar di atas soal kenapa).
export const SEMUA_FIELD_TERSEDIA = Object.values(KATALOG_CETAK)
  .flatMap(j => j.rincianTersedia || [])
  .reduce((acc, f) => (acc.some(x => x.key === f.key) ? acc : [...acc, f]), []);

// PRESET_KERTAS — 4 pilihan sesuai keputusan Guru (sesi 8 Sep 2026).
export const PRESET_KERTAS = {
  kasir_roll: { label: 'Kasir Roll (lebar saja)', lebar_mm: 80, tinggi_mm: 0, isRoll: true },
  custom: { label: 'Custom (isi manual mm)', lebar_mm: 101.6, tinggi_mm: 50.8, isRoll: false },
  thermal_15x10: { label: 'Thermal 15 x 10 cm', lebar_mm: 150, tinggi_mm: 100, isRoll: false },
  thermal_4x2: { label: 'Thermal 4 x 2 cm', lebar_mm: 40, tinggi_mm: 20, isRoll: false }
};

// Fallback kalau suatu jenisId BELUM dimasukkan ke grup manapun — SAMA
// PERSIS dengan ukuran yang sudah berjalan sekarang (4x2 inch = 101.6x
// 50.8mm), supaya tidak ada cetakan berubah tiba-tiba sebelum Guru sempat
// mengatur grupnya.
const DEFAULT_PENGATURAN = { lebar_mm: 101.6, tinggi_mm: 50.8, posisi_qr: 'kiri', rincian_aktif: [] };
const DEFAULT_STRUK = { lebar_mm: 80, tinggi_mm: 0, posisi_qr: 'kiri', rincian_aktif: [] };

// Cache in-memory per sesi (PELAJARAN.md — hemat read Firestore). Koleksi
// `pengaturan_cetak` kecil (jumlah grup, bukan jumlah titik cetak), jadi 1x
// getDocs cukup utk semua lookup jenisId->grup sepanjang sesi.
let _cacheGrup = null; // array [{id, ...data}] setelah dimuat, null = belum dimuat
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

// ambilPengaturanCetak — KONTRAK TIDAK BERUBAH dari versi awal (nama fungsi,
// parameter, bentuk hasil {lebar_mm, tinggi_mm, posisi_qr, rincian_aktif}
// SAMA PERSIS) — dipanggil `PopupPratinjauCetakLabel` (vue-components.js).
// Yang berubah cuma isinya: sekarang cari grup pemilik jenisId dulu.
export async function ambilPengaturanCetak(jenisId) {
  await pastikanCacheGrup();
  const grup = _petaJenisKeGrup.get(jenisId);
  const fallback = (KATALOG_CETAK[jenisId] && KATALOG_CETAK[jenisId].strukRoll) ? DEFAULT_STRUK : DEFAULT_PENGATURAN;
  if (!grup) return { ...fallback };
  return {
    lebar_mm: parseFloat(grup.lebar_mm) || fallback.lebar_mm,
    tinggi_mm: parseFloat(grup.tinggi_mm) || fallback.tinggi_mm,
    posisi_qr: grup.posisi_qr || fallback.posisi_qr,
    rincian_aktif: grup.field_tampil || []
  };
}

// ---------------------------------------------------------------------------
// AppPengaturanCetak — layar admin, mount di Scan & Cetak > Cetak. Sekarang
// kelola GRUP (bikin/edit/hapus bebas, jumlahnya terserah Guru), bukan lagi
// 1 form per jenis tetap.
// ---------------------------------------------------------------------------
export const AppPengaturanCetak = {
  setup() {
    const memuat = ref(true);
    const daftarGrup = ref([]); // [{id, nama, jenis_kertas, lebar_mm, tinggi_mm, posisi_qr, field_tampil, anggota_jenis}]
    const editAktif = ref(null); // null | '__baru__' | grupId
    const formEdit = reactive({ nama: '', jenis_kertas: 'custom', lebar_mm: 101.6, tinggi_mm: 50.8, posisi_qr: 'kiri', field_tampil: [], anggota_jenis: [] });
    const menyimpan = ref(false);

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDocs(collection(db, 'pengaturan_cetak'));
        daftarGrup.value = snap.docs.map(d => ({ id: d.id, ...d.data(), anggota_jenis: d.data().anggota_jenis || [], field_tampil: d.data().field_tampil || [] }));
        // Sinkronkan cache modul (dipakai ambilPengaturanCetak) sekalian,
        // supaya popup cetak yang dibuka setelah ini langsung dapat data baru
        // tanpa nunggu reload halaman.
        _cacheGrup = daftarGrup.value;
        _petaJenisKeGrup = new Map();
        for (const g of _cacheGrup) for (const j of g.anggota_jenis) _petaJenisKeGrup.set(j, g);
      } catch (e) {
        console.error('Gagal muat pengaturan_cetak (grup):', e);
        alert('Gagal memuat Pengaturan Cetak. Coba refresh.');
      }
      memuat.value = false;
    }

    // Titik cetak yang belum masuk grup manapun — supaya Guru lihat apa
    // yang masih perlu dipetakan.
    const jenisBelumPunyaGrup = computed(() => {
      const terpakai = new Set(daftarGrup.value.flatMap(g => g.anggota_jenis));
      return Object.keys(KATALOG_CETAK).filter(id => !terpakai.has(id));
    });

    // Peta jenisId -> nama grup pemiliknya (dipakai form edit utk kasih
    // hint "saat ini di grup X" pas Guru centang anggota).
    const petaPemilikSaatIni = computed(() => {
      const peta = {};
      daftarGrup.value.forEach(g => { g.anggota_jenis.forEach(j => { peta[j] = g; }); });
      return peta;
    });

    // Daftar jenis dikelompokkan per kategori, buat checklist anggota di
    // form (lebih gampang dibaca daripada 16 baris polos).
    const jenisPerKategori = computed(() => {
      const peta = {};
      Object.entries(KATALOG_CETAK).forEach(([id, j]) => {
        (peta[j.kategori] ||= []).push({ id, ...j });
      });
      return peta;
    });

    function bukaTambah() {
      editAktif.value = '__baru__';
      formEdit.nama = '';
      formEdit.jenis_kertas = 'custom';
      formEdit.lebar_mm = PRESET_KERTAS.custom.lebar_mm;
      formEdit.tinggi_mm = PRESET_KERTAS.custom.tinggi_mm;
      formEdit.posisi_qr = 'kiri';
      formEdit.field_tampil = [];
      formEdit.anggota_jenis = [];
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
    }
    function tutupEdit() { editAktif.value = null; }

    // pilihPreset — pilih preset TIMPA lebar/tinggi dengan nilai presetnya.
    // Kalau pilih 'custom', nilai lama dibiarkan (supaya Guru bisa isi bebas
    // tanpa ketimpa balik ke default tiap ganti-ganti pilihan).
    function pilihPreset(key) {
      formEdit.jenis_kertas = key;
      if (key !== 'custom') {
        formEdit.lebar_mm = PRESET_KERTAS[key].lebar_mm;
        formEdit.tinggi_mm = PRESET_KERTAS[key].tinggi_mm;
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

    // toggleAnggota — 1 titik cetak = 1 grup saja (keputusan Guru). Centang
    // di sini TIDAK langsung mengeluarkan dari grup lain (baru kejadian pas
    // Simpan) — supaya Guru masih bisa Batal tanpa efek samping ke grup lain.
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
      KATALOG_CETAK, PRESET_KERTAS, SEMUA_FIELD_TERSEDIA,
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
              </div>
              <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:5px;">
                <span v-for="j in g.anggota_jenis" :key="j" class="tag" style="font-size:10px;">{{ KATALOG_CETAK[j]?.label || j }}</span>
                <span v-if="!g.anggota_jenis.length" style="font-size:10.5px; color:var(--text-faint);">Belum ada anggota.</span>
              </div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
              <button @click="bukaEdit(g)" class="btn-outline" style="padding:7px 12px; font-size:11px;"><i class="fas fa-pen" style="margin-right:5px;"></i>Edit</button>
              <button @click="hapusGrup(g)" class="icon-btn" style="padding:7px 10px; color:var(--danger, #b3261e);"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        </div>
        <div v-if="!daftarGrup.length" class="gc-kosong">Belum ada grup. Buat 1 grup dulu supaya titik cetak bisa diatur ukurannya.</div>

        <div v-if="jenisBelumPunyaGrup.length" class="gc-card" style="padding:12px 14px; background:var(--ivory-dim);">
          <div style="font-weight:700; font-size:11.5px; margin-bottom:6px;"><i class="fas fa-triangle-exclamation" style="margin-right:6px; color:#b8860b;"></i>Belum masuk grup manapun ({{ jenisBelumPunyaGrup.length }}) — masih pakai ukuran default 4x2 inch:</div>
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
