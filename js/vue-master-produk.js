// js/vue-master-produk.js
// ============================================================================
// Zevanic House > Master Produk — fitur BARU (27 Agt 2026, §28), Bill of
// Material (BOM) untuk produksi konveksi. Dasar dari mockup React yang
// dikirim Hilman (mockupformbomproduk.jsx), diskusikan & disepakati lewat
// 4 ronde AskUserQuestion sebelum ditulis (lihat STATUS-PROYEK.md §28 untuk
// catatan lengkap keputusan). Ringkasan keputusan kunci yang membentuk kode
// di bawah:
//   1. SEMUA field "Nama Bahan/Aksesoris/Komponen" (termasuk Kode Webbing
//      2/3) WAJIB pilih dari Data Bahan & Aksesoris (master_bahan_
//      aksesoris) lewat DropdownCari — TIDAK BOLEH teks bebas. Pola resolve
//      nama->id SAMA seperti js/vue-persiapan-masalah.js.
//   2. Tujuannya fondasi produksi (nanti dipakai potong stok otomatis) —
//      BUKAN cuma dokumentasi, makanya link ke master_bahan_aksesoris
//      di atas WAJIB (bukan opsional) supaya datanya bisa disambung nanti.
//   3. BOM Pola & BOM Vendor DIGABUNG jadi 1 tab dengan toggle Internal/
//      Vendor PER BARIS (beda dari mockup yang pisah 2 tab) — field jenis
//      vendor cuma tampil kalau baris itu ditandai Vendor.
//   4. Foto (produk & tiap baris Pola/Vendor) pakai Firebase Storage
//      (path `master_produk/{id}/...`), BUKAN base64-in-Firestore seperti
//      modul lain — ini modul KEDUA yang pakai Storage (sebelumnya cuma
//      pengumuman, lihat js/vue-config-info.js buat pola upload yang sama
//      dipakai di sini). Storage Rules-nya baru (belum ada sebelumnya),
//      lihat storage.rules di root repo — WAJIB ditempel manual di Firebase
//      Console > Storage > Rules (sama seperti alur firestore.rules).
//   5. SKU: field TERSENDIRI (bukan cuma string tampilan turunan seperti di
//      mockup), disarankan otomatis dari Nama-Warna-Size tapi BOLEH diedit
//      manual, WAJIB unik (dicek query sebelum simpan, pola SAMA seperti
//      cekNoSpkDobel() di js/vue-order-spk.js). SENGAJA TIDAK pakai id_
//      tampil sekuensial (mis. PRD-0001) seperti master_bahan_aksesoris —
//      SKU inilah kode utamanya, sesuai desain mockup asli, supaya tidak
//      dobel-kode yang membingungkan.
//   6. "Isi Pola (Pcs)" = hasil potong per pcs produk jadi dari 1x potong
//      pola itu. "Kode Webbing 2/3" = REFERENSI ke aksesoris/bahan lain
//      (bukan catatan teks bebas) — makanya juga DropdownCari, opsional.
//   7. Posisi menu: Zevanic House > setelah "Stock & Pembelian", sebelum
//      "Order SPK".
//   8. Dikerjakan SEKALIGUS SEMUA (bukan bertahap) — keputusan eksplisit
//      Hilman, BUKAN saran default (saran awal Claude adalah bertahap).
//
// CATATAN GRID RESPONSIVE (support mobile+desktop, wajib per permintaan
// Hilman): modul-modul LAIN di app ini (vue-bahan-aksesoris.js, vue-order-
// spk.js) pakai `style="display:grid; grid-template-columns:...;"` INLINE
// BERSAMAAN dengan class `grid-cols-1 md:grid-cols-N` — secara CSS
// specificity, style inline itu SELALU menang atas class, jadi class
// grid-cols-nya sebenarnya TIDAK PERNAH benar-benar aktif (grid tetap multi-
// kolom di HP). Di file INI classnya dipakai TANPA grid-template-columns
// inline (cuma `display:grid` + `gap` inline, kolom count murni dari class
// grid-cols-1/md:grid-cols-N) — supaya BENAR-BENAR collapse ke 1 kolom di
// HP. Lihat STATUS-PROYEK.md §28 kalau mau samakan pola ini ke modul lama.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, doc, setDoc, updateDoc, deleteDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { db, storage } from "./firebase-config.js";
import { DropdownCari } from './vue-components.js?v=2';
import { usePaginasiFirestore } from './vue-paginasi.js';

// ambilDaftarBahanAksesorisLengkap — disalin (bukan diimpor silang) dari
// pola yang sama di js/vue-persiapan-masalah.js / vue-stock-pembelian.js /
// vue-scan-opname.js / vue-scan-persiapan.js — tiap file berdiri sendiri.
async function ambilDaftarBahanAksesorisLengkap() {
  try {
    const snap = await getDocs(collection(db, 'master_bahan_aksesoris'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    return list;
  } catch (e) {
    console.error('Gagal ambil daftar Bahan/Aksesoris:', e);
    return [];
  }
}

// ambilDaftarNama — pola SAMA seperti js/vue-bahan-aksesoris.js, dipakai
// buat opsi DropdownCari Warna (master_warna) & Satuan (master_satuan).
async function ambilDaftarNama(koleksi) {
  try {
    const snap = await getDocs(collection(db, koleksi));
    const list = [];
    snap.forEach(d => { if (d.data().nama) list.push(d.data().nama); });
    list.sort((a, b) => a.localeCompare(b));
    return list;
  } catch (e) {
    console.error(`Gagal ambil daftar ${koleksi}:`, e);
    return [];
  }
}

// formatNamaBahan — disalin (bukan diimpor silang) dari js/vue-stock-
// pembelian.js: gabung nama+warna jadi 1 string tampilan/pilihan, mis.
// "Kain Katun Merah". WAJIB dipakai (bukan b.nama polos) karena item
// Bahan/Aksesoris yang NAMANYA sama tapi WARNA beda itu NORMAL (warna
// field terpisah di Data Bahan & Aksesoris) — kalau opsi dropdown &
// resolveBahan cuma pakai nama polos, varian-varian warna itu TIDAK BISA
// dibedakan di dropdown, dan .find() selalu ambil hasil PERTAMA yang
// cocok (silent bug, bisa nyantol ke warna yang salah). DIPERBAIKI
// (28 Agt 2026, atas masukan Hilman) — sebelumnya modul ini pakai b.nama
// polos + field "Warna Bahan"/"Warna" terpisah, sekarang digabung jadi 1
// field pilihan, sama seperti bug yang sudah lebih dulu diperbaiki di
// vue-stock-pembelian.js (§25.7/§25.11).
function formatNamaBahan(b) {
  return (b.nama || '') + (b.warna ? ` ${b.warna}` : '');
}

// resolveBahan — cari item Bahan/Aksesoris yang KOMBINASI nama+warna-nya
// (lewat formatNamaBahan) persis cocok dengan teks yang dipilih lewat
// DropdownCari. Dipakai buat validasi "wajib pilih dari daftar, bukan
// teks bebas" (keputusan #1) di setiap baris BOM.
function resolveBahan(daftarBahan, namaText) {
  if (!namaText) return null;
  return daftarBahan.find(b => formatNamaBahan(b) === namaText) || null;
}

// --- Kompresi & upload foto ke Firebase Storage --------------------------
// Kompresi sisi klien pakai <canvas> (pola SAMA seperti kompresGambarBahan
// di vue-bahan-aksesoris.js — 500px/kualitas 0.65, foto katalog/dokumentasi
// bukan bukti resolusi tinggi) tapi hasil akhirnya Blob (bukan dataURL)
// karena tujuannya diupload ke Storage, bukan disimpan langsung di field
// Firestore (keputusan #4).
function kompresFotoKeBlob(file, maxDimensi, kualitas) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        let { width, height } = img;
        if (width > maxDimensi || height > maxDimensi) {
          if (width > height) { height = Math.round(height * (maxDimensi / width)); width = maxDimensi; }
          else { width = Math.round(width * (maxDimensi / height)); height = maxDimensi; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Gagal buat blob foto')), 'image/jpeg', kualitas);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// uploadFotoProduk — path pattern SAMA seperti js/vue-config-info.js
// (`pengumuman/{id}/media_{timestamp}.{ext}`), disesuaikan jadi
// `master_produk/{produkId}/{segmen}_{timestamp}.jpg`.
async function uploadFotoProduk(produkId, segmen, file) {
  const blob = await kompresFotoKeBlob(file, 700, 0.7);
  const pathFile = `master_produk/${produkId}/${segmen}_${Date.now()}.jpg`;
  const refFile = storageRef(storage, pathFile);
  await uploadBytes(refFile, blob);
  return await getDownloadURL(refFile);
}
async function hapusFotoProdukLama(url) {
  if (!url) return;
  try { await deleteObject(storageRef(storage, url)); } catch (e) { /* file lama mungkin sudah tidak ada, abaikan */ }
}

function buatSkuOtomatis(nama, warna, size) {
  return [nama, warna, size].filter(Boolean).join('-').toUpperCase().replace(/\s+/g, '');
}

// cekSkuDobel — pola SAMA seperti cekNoSpkDobel() di js/vue-order-spk.js.
async function cekSkuDobel(sku, idSedangEdit) {
  const q = query(collection(db, 'master_produk'), where('sku', '==', sku));
  const snap = await getDocs(q);
  return snap.docs.some(d => d.id !== idSedangEdit);
}

// --- Baris kosong per kategori BOM ----------------------------------------
function barisJasaKosong() { return { nama: '', harga: '' }; }
function barisPolaKosong() {
  return {
    tipe: 'internal', // 'internal' | 'vendor' — keputusan #3, gabung 1 tab + toggle
    foto: '', fotoFile: null, fotoPreview: '', fotoDihapus: false,
    nama_pola: '',
    bahan_pilih: '', bahan_aksesoris_id: '', // GANTI (28 Agt 2026): warna_bahan_pilih dihapus, digabung ke bahan_pilih (lihat formatNamaBahan)
    panjang: '', isi_pola_pcs: '', jasa_cutting: '', jasa_serie: '',
    jenis_vendor: '',
    komponen: []
  };
}
function barisKomponenKosong() { return { pilih: '', bahan_aksesoris_id: '', qty: '' }; }
function barisAksesorisKosong() {
  return {
    tahap_proses: '',
    aksesoris_pilih: '', bahan_aksesoris_id: '', // GANTI (28 Agt 2026): warna_pilih dihapus, digabung ke aksesoris_pilih (lihat formatNamaBahan)
    qty: '', satuan_pilih: '',
    webbing2_pilih: '', webbing2_id: '',
    webbing3_pilih: '', webbing3_id: ''
  };
}

// ---------------------------------------------------------------------------
// KelolaKomponenModal — modal "Kelola Komponen" per baris BOM Pola/Vendor.
// Pola prop SAMA seperti PopupKonversiBerjenjang (vue-bahan-aksesoris.js):
// `baris` dikirim SEBAGAI REFERENSI (array reactive), dimutasi langsung di
// sini — tidak perlu event update:modelValue bolak-balik tiap field.
// ---------------------------------------------------------------------------
const KelolaKomponenModal = {
  components: { DropdownCari },
  props: {
    komponen: { type: Array, required: true },
    namaPola: { type: String, default: '' },
    opsiNamaBahan: { type: Array, default: () => [] },
    daftarBahan: { type: Array, default: () => [] }
  },
  emits: ['tutup'],
  methods: {
    tambah() { this.komponen.push(barisKomponenKosong()); },
    hapus(i) { this.komponen.splice(i, 1); },
    saatPilih(baris) {
      const item = resolveBahan(this.daftarBahan, baris.pilih);
      baris.bahan_aksesoris_id = item ? item.id : '';
    }
  },
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="$emit('tutup')">
      <div class="gc-card" style="max-width:560px; width:100%; max-height:90vh; overflow-y:auto;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:4px;"><i class="fas fa-puzzle-piece" style="color:var(--burgundy); margin-right:8px;"></i>Kelola Komponen</h3>
        <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Komponen untuk pola "{{ namaPola || '(belum diberi nama)' }}". Nama Komponen wajib pilih dari Data Bahan &amp; Aksesoris.</p>
        <div v-for="(k, i) in komponen" :key="i" style="display:grid; gap:8px; grid-template-columns:2fr 1fr 30px; align-items:center; margin-bottom:8px;">
          <dropdown-cari v-model="k.pilih" :opsi="opsiNamaBahan" placeholder="Cari & pilih komponen..." @update:modelValue="saatPilih(k)" />
          <input v-model.number="k.qty" type="number" min="0" placeholder="Qty" style="width:100%; padding:8px 10px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; box-sizing:border-box;">
          <button @click="hapus(i)" class="icon-btn" style="color:var(--danger);" title="Hapus komponen"><i class="fas fa-trash-alt"></i></button>
        </div>
        <button @click="tambah" class="btn-outline" style="font-size:11.5px; padding:6px 14px; margin-bottom:16px;"><i class="fas fa-plus" style="margin-right:5px;"></i>Tambah Komponen</button>
        <button @click="$emit('tutup')" class="btn-primary block">Selesai</button>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// FormEntryProdukBOM — form lengkap Data Produk Utama + 4 kategori BOM.
// Dipakai DUA tempat: MasterProdukEntryManager (mode create, halaman biasa)
// & modal edit di MasterProdukListManager (mode edit, dataAwal terisi) —
// sengaja dipisah jadi 1 komponen (BEDA dari pola lama vue-bahan-
// aksesoris.js yang duplikat form Entry & modal Edit) karena form BOM ini
// jauh lebih besar/kompleks, duplikasi ~500 baris bukan pilihan masuk akal.
// ---------------------------------------------------------------------------
const FormEntryProdukBOM = {
  components: { DropdownCari, KelolaKomponenModal },
  props: { dataAwal: { type: Object, default: null } },
  emits: ['tersimpan', 'batal'],
  setup(props, { emit }) {
    const modeEdit = computed(() => !!props.dataAwal);
    const menyimpan = ref(false);
    const mengupload = ref(false);
    const tabAktif = ref('jasa'); // 'jasa' | 'pola' | 'aksesoris'

    const daftarBahan = ref([]);
    const opsiNamaBahan = computed(() => daftarBahan.value.map(b => formatNamaBahan(b)));
    const opsiWarna = ref([]);
    const opsiSatuan = ref([]);

    const idProduk = props.dataAwal?.id || doc(collection(db, 'master_produk')).id;

    const form = reactive({
      nama: props.dataAwal?.nama || '',
      warna_pilih: props.dataAwal?.warna || '',
      size: props.dataAwal?.size || '',
      sku: props.dataAwal?.sku || '',
      foto: props.dataAwal?.foto || '',
      bom_jasa: props.dataAwal?.bom_jasa ? JSON.parse(JSON.stringify(props.dataAwal.bom_jasa)) : [],
      bom_pola: props.dataAwal?.bom_pola ? JSON.parse(JSON.stringify(props.dataAwal.bom_pola)).map(b => ({
        ...barisPolaKosong(), ...b,
        // GANTI (28 Agt 2026) — dulu Nama Bahan & Warna Bahan 2 field
        // terpisah, SEKARANG 1 field gabungan (formatNamaBahan) biar
        // varian warna beda bisa dibedakan di dropdown. bahan_pilih
        // direkonstruksi dari nama_bahan+warna_bahan yang TERSIMPAN (2
        // field itu TETAP disimpan terpisah di Firestore, cuma UI-nya
        // digabung jadi 1 dropdown).
        bahan_pilih: formatNamaBahan({ nama: b.nama_bahan, warna: b.warna_bahan }),
        fotoFile: null, fotoPreview: '',
        // penting: komponen tersimpan cuma punya nama_komponen (bukan
        // "pilih") — kalau tidak dipetakan ulang, DropdownCari-nya bakal
        // kosong waktu edit padahal datanya ada, dan validasi() akan
        // salah kira belum dipilih (nolak simpan padahal cuma tampilan).
        komponen: (b.komponen || []).map(k => ({ ...barisKomponenKosong(), ...k, pilih: k.nama_komponen || '' }))
      })) : [],
      // GANTI (28 Agt 2026) — aksesoris_pilih SEKARANG direkonstruksi dari
      // nama_aksesoris+warna gabungan (sama alasan seperti bom_pola di
      // atas). webbing2/3_pilih TIDAK berubah caranya (webbing2_nama/
      // webbing3_nama SEKARANG disimpan sebagai nama+warna gabungan juga,
      // lihat simpan() — jadi otomatis cocok tanpa perlu formatNamaBahan
      // di sini lagi).
      bom_aksesoris: props.dataAwal?.bom_aksesoris ? JSON.parse(JSON.stringify(props.dataAwal.bom_aksesoris)).map(a => ({ ...barisAksesorisKosong(), ...a, aksesoris_pilih: formatNamaBahan({ nama: a.nama_aksesoris, warna: a.warna }), satuan_pilih: a.satuan || '', webbing2_pilih: a.webbing2_nama || '', webbing3_pilih: a.webbing3_nama || '' })) : []
    });

    const skuDieditManual = ref(modeEdit.value); // kalau edit data lama, jangan timpa SKU otomatis
    watch([() => form.nama, () => form.warna_pilih, () => form.size], () => {
      if (!skuDieditManual.value) form.sku = buatSkuOtomatis(form.nama, form.warna_pilih, form.size);
    });
    function saatEditSku() { skuDieditManual.value = true; }

    const fotoProdukFile = ref(null);
    const fotoProdukPreview = ref(props.dataAwal?.foto || '');
    // fotoProdukDihapus — BARU: tanda "foto lama SENGAJA dihapus, jangan
    // dipertahankan waktu simpan" (beda dari sekadar belum pernah ada foto).
    // Tanpa ini, klik "Hapus Foto" cuma mengosongkan tampilan, tapi file
    // lama di Storage tidak pernah ikut dihapus (jadi file yatim) — pola
    // sama seperti alasan hapus(item) di js/vue-config-info.js.
    const fotoProdukDihapus = ref(false);
    function pilihFotoProduk(ev) {
      const file = ev.target.files[0];
      if (!file) return;
      fotoProdukFile.value = file;
      fotoProdukPreview.value = URL.createObjectURL(file);
      fotoProdukDihapus.value = false;
    }
    function hapusFotoProduk() { fotoProdukFile.value = null; fotoProdukPreview.value = ''; fotoProdukDihapus.value = true; }

    function pilihFotoPola(baris, ev) {
      const file = ev.target.files[0];
      if (!file) return;
      baris.fotoFile = file;
      baris.fotoPreview = URL.createObjectURL(file);
      baris.fotoDihapus = false;
    }
    function hapusFotoPola(baris) { baris.fotoFile = null; baris.fotoPreview = ''; baris.fotoDihapus = true; }

    // Modal Kelola Komponen
    const modalKomponenAktif = ref(null); // index baris pola yang sedang dibuka
    function bukaKomponen(i) { modalKomponenAktif.value = i; }
    function tutupKomponen() { modalKomponenAktif.value = null; }

    async function muatOpsi() {
      const [bahan, warna, satuan] = await Promise.all([
        ambilDaftarBahanAksesorisLengkap(),
        ambilDaftarNama('master_warna'),
        ambilDaftarNama('master_satuan')
      ]);
      daftarBahan.value = bahan;
      opsiWarna.value = warna;
      opsiSatuan.value = satuan;
    }
    onMounted(async () => { await window.authReady; await muatOpsi(); });

    function saatPilihBahanPola(baris) {
      const item = resolveBahan(daftarBahan.value, baris.bahan_pilih);
      baris.bahan_aksesoris_id = item ? item.id : '';
    }
    function saatPilihAksesoris(baris) {
      const item = resolveBahan(daftarBahan.value, baris.aksesoris_pilih);
      baris.bahan_aksesoris_id = item ? item.id : '';
    }
    function saatPilihWebbing(baris, nomor) {
      const teks = nomor === 2 ? baris.webbing2_pilih : baris.webbing3_pilih;
      const item = resolveBahan(daftarBahan.value, teks);
      if (nomor === 2) baris.webbing2_id = item ? item.id : '';
      else baris.webbing3_id = item ? item.id : '';
    }

    function tambahJasa() { form.bom_jasa.push(barisJasaKosong()); }
    function hapusJasa(i) { form.bom_jasa.splice(i, 1); }
    function tambahPola() { form.bom_pola.push(barisPolaKosong()); }
    function hapusPola(i) { form.bom_pola.splice(i, 1); }
    function tambahAksesoris() { form.bom_aksesoris.push(barisAksesorisKosong()); }
    function hapusAksesoris(i) { form.bom_aksesoris.splice(i, 1); }

    function validasi() {
      if (!form.nama.trim()) return 'Isi Nama Produk dulu.';
      if (!form.warna_pilih.trim()) return 'Pilih Warna dulu.';
      if (!form.size.trim()) return 'Isi Size dulu.';
      if (!form.sku.trim()) return 'SKU tidak boleh kosong.';
      for (const b of form.bom_pola) {
        const adaIsi = b.nama_pola || b.bahan_pilih || b.panjang || b.isi_pola_pcs;
        if (!adaIsi) continue;
        if (!resolveBahan(daftarBahan.value, b.bahan_pilih)) {
          return `BOM ${b.tipe === 'vendor' ? 'Vendor' : 'Pola'} "${b.nama_pola || '(tanpa nama)'}": pilih Nama Bahan dari daftar dulu (bukan teks bebas). Kalau belum ada, tambahkan dulu di menu Data Bahan & Aksesoris.`;
        }
        for (const k of b.komponen) {
          if (!k.pilih && !k.qty) continue;
          if (!resolveBahan(daftarBahan.value, k.pilih)) return `Komponen di BOM "${b.nama_pola || '(tanpa nama)'}": pilih Nama Komponen dari daftar dulu.`;
        }
      }
      for (const a of form.bom_aksesoris) {
        const adaIsi = a.aksesoris_pilih || a.tahap_proses || a.qty;
        if (!adaIsi) continue;
        if (!resolveBahan(daftarBahan.value, a.aksesoris_pilih)) {
          return `BOM Aksesoris "${a.tahap_proses || '(tanpa tahap)'}": pilih Nama Aksesoris dari daftar dulu.`;
        }
        if (a.webbing2_pilih && !resolveBahan(daftarBahan.value, a.webbing2_pilih)) return 'Kode Webbing 2 harus dipilih dari daftar Bahan & Aksesoris (atau dikosongkan).';
        if (a.webbing3_pilih && !resolveBahan(daftarBahan.value, a.webbing3_pilih)) return 'Kode Webbing 3 harus dipilih dari daftar Bahan & Aksesoris (atau dikosongkan).';
      }
      return '';
    }

    async function simpan() {
      const pesanError = validasi();
      if (pesanError) return alert(pesanError);
      menyimpan.value = true;
      try {
        if (await cekSkuDobel(form.sku.trim(), props.dataAwal?.id)) {
          alert(`SKU "${form.sku.trim()}" sudah terdaftar di produk lain. Ubah SKU-nya, atau edit produk yang sudah ada kalau mau ubah datanya.`);
          menyimpan.value = false;
          return;
        }

        mengupload.value = true;
        let fotoUrl = form.foto;
        if (fotoProdukFile.value) {
          const lama = fotoUrl;
          fotoUrl = await uploadFotoProduk(idProduk, 'foto', fotoProdukFile.value);
          await hapusFotoProdukLama(lama);
        } else if (fotoProdukDihapus.value) {
          await hapusFotoProdukLama(fotoUrl);
          fotoUrl = '';
        }

        const bomPolaSiap = [];
        for (let i = 0; i < form.bom_pola.length; i++) {
          const b = form.bom_pola[i];
          let fotoPolaUrl = b.foto;
          if (b.fotoFile) {
            const lama = fotoPolaUrl;
            fotoPolaUrl = await uploadFotoProduk(idProduk, `pola${i}`, b.fotoFile);
            await hapusFotoProdukLama(lama);
          } else if (b.fotoDihapus) {
            await hapusFotoProdukLama(fotoPolaUrl);
            fotoPolaUrl = '';
          }
          const bahanItem = resolveBahan(daftarBahan.value, b.bahan_pilih);
          bomPolaSiap.push({
            tipe: b.tipe,
            foto: fotoPolaUrl,
            nama_pola: (b.nama_pola || '').trim(),
            bahan_aksesoris_id: bahanItem ? bahanItem.id : '',
            nama_bahan: bahanItem ? bahanItem.nama : '',
            // GANTI (28 Agt 2026) — warna_bahan SEKARANG auto-ikut dari
            // item yang dipilih (field warna_bahan_pilih terpisah sudah
            // dihapus), BUKAN dipilih manual lagi.
            warna_bahan: bahanItem ? (bahanItem.warna || '') : '',
            panjang: parseFloat(b.panjang) || 0,
            isi_pola_pcs: parseFloat(b.isi_pola_pcs) || 0,
            jasa_cutting: parseFloat(b.jasa_cutting) || 0,
            jasa_serie: parseFloat(b.jasa_serie) || 0,
            jenis_vendor: b.tipe === 'vendor' ? (b.jenis_vendor || '').trim() : '',
            komponen: (b.komponen || []).filter(k => k.pilih).map(k => {
              const item = resolveBahan(daftarBahan.value, k.pilih);
              // nama_komponen disimpan nama+warna gabungan (formatNamaBahan)
              // — field ini dari awal tidak punya pasangan "warna_komponen"
              // terpisah, jadi digabung langsung di sini (bukan skema baru,
              // cuma cara isinya yang berubah).
              return { bahan_aksesoris_id: item ? item.id : '', nama_komponen: item ? formatNamaBahan(item) : '', qty: parseFloat(k.qty) || 0 };
            })
          });
        }

        const bomAksesorisSiap = form.bom_aksesoris.map(a => {
          const item = resolveBahan(daftarBahan.value, a.aksesoris_pilih);
          const w2 = resolveBahan(daftarBahan.value, a.webbing2_pilih);
          const w3 = resolveBahan(daftarBahan.value, a.webbing3_pilih);
          return {
            tahap_proses: (a.tahap_proses || '').trim(),
            bahan_aksesoris_id: item ? item.id : '',
            nama_aksesoris: item ? item.nama : '',
            // GANTI (28 Agt 2026) — warna SEKARANG auto-ikut dari item yang
            // dipilih (field warna_pilih terpisah sudah dihapus), BUKAN
            // dipilih manual lagi — sama alasan seperti warna_bahan di atas.
            warna: item ? (item.warna || '') : '',
            qty: parseFloat(a.qty) || 0,
            satuan: (a.satuan_pilih || '').trim(),
            // webbing2_nama/webbing3_nama SEKARANG disimpan nama+warna
            // gabungan (formatNamaBahan) biar tampilannya tetap jelas warna
            // apa yang dipilih (dulu cuma nama polos, warnanya hilang).
            webbing2_id: w2 ? w2.id : '', webbing2_nama: w2 ? formatNamaBahan(w2) : '',
            webbing3_id: w3 ? w3.id : '', webbing3_nama: w3 ? formatNamaBahan(w3) : ''
          };
        });

        const bomJasaSiap = form.bom_jasa.filter(j => j.nama).map(j => ({ nama: (j.nama || '').trim(), harga: parseFloat(j.harga) || 0 }));

        const payload = {
          sku: form.sku.trim(),
          nama: form.nama.trim(),
          warna: form.warna_pilih.trim(),
          size: form.size.trim(),
          foto: fotoUrl,
          bom_jasa: bomJasaSiap,
          bom_pola: bomPolaSiap,
          bom_aksesoris: bomAksesorisSiap
        };

        if (modeEdit.value) {
          payload.diedit_pada = serverTimestamp();
          payload.diedit_oleh = window.currentUser?.email || null;
          await updateDoc(doc(db, 'master_produk', props.dataAwal.id), payload);
        } else {
          payload.dibuat_pada = serverTimestamp();
          payload.dibuat_oleh = window.currentUser?.email || null;
          await setDoc(doc(db, 'master_produk', idProduk), payload);
        }
        mengupload.value = false;
        emit('tersimpan');
      } catch (e) {
        console.error('Gagal simpan Master Produk:', e);
        alert('Gagal menyimpan produk. Coba lagi.');
      }
      mengupload.value = false;
      menyimpan.value = false;
    }

    return {
      modeEdit, menyimpan, mengupload, tabAktif, form, opsiNamaBahan, opsiWarna, opsiSatuan,
      skuDieditManual, saatEditSku,
      fotoProdukPreview, pilihFotoProduk, hapusFotoProduk,
      pilihFotoPola, hapusFotoPola,
      modalKomponenAktif, bukaKomponen, tutupKomponen,
      daftarBahan,
      saatPilihBahanPola, saatPilihAksesoris, saatPilihWebbing,
      tambahJasa, hapusJasa, tambahPola, hapusPola, tambahAksesoris, hapusAksesoris,
      simpan
    };
  },
  template: `
    <div>
      <div class="gc-card" style="margin-bottom:16px;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:14px;"><i class="fas fa-shirt" style="color:var(--burgundy); margin-right:8px;"></i>Data Produk Utama</h3>
        <div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap; margin-bottom:4px;">
          <div>
            <div v-if="fotoProdukPreview" style="margin-bottom:8px;">
              <img :src="fotoProdukPreview" style="width:96px; height:96px; object-fit:cover; border-radius:12px; border:1.5px solid var(--line);">
            </div>
            <div class="gc-field" style="margin-bottom:0; width:200px;">
              <label>Foto Produk</label>
              <input type="file" accept="image/*" @change="pilihFotoProduk">
              <button v-if="fotoProdukPreview" @click="hapusFotoProduk" type="button" class="btn-outline" style="font-size:11px; padding:5px 10px; margin-top:6px;">Hapus Foto</button>
            </div>
          </div>
          <div style="flex:1; min-width:240px; display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-3">
            <div class="gc-field" style="margin-bottom:0;"><label>Nama Produk</label><input v-model="form.nama" type="text" placeholder="Mis. Tas Ransel Kanvas"></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Warna</label><dropdown-cari v-model="form.warna_pilih" :opsi="opsiWarna" placeholder="Cari & pilih Warna..." /></div>
            <div class="gc-field" style="margin-bottom:0;"><label>Size</label><input v-model="form.size" type="text" placeholder="Mis. All Size / L / 30x40cm"></div>
          </div>
        </div>
        <div class="gc-field" style="max-width:320px;">
          <label>SKU <span style="font-weight:400; color:var(--text-faint);">(otomatis dari Nama-Warna-Size, boleh diubah)</span></label>
          <input v-model="form.sku" @input="saatEditSku" type="text" style="text-transform:uppercase;">
        </div>
      </div>

      <div class="gc-card">
        <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
          <button @click="tabAktif='jasa'" type="button" class="btn-outline" :class="{filled: tabAktif==='jasa'}" style="font-size:12px;"><i class="fas fa-hand-holding-dollar" style="margin-right:6px;"></i>BOM Jasa ({{ form.bom_jasa.length }})</button>
          <button @click="tabAktif='pola'" type="button" class="btn-outline" :class="{filled: tabAktif==='pola'}" style="font-size:12px;"><i class="fas fa-scissors" style="margin-right:6px;"></i>BOM Pola &amp; Vendor ({{ form.bom_pola.length }})</button>
          <button @click="tabAktif='aksesoris'" type="button" class="btn-outline" :class="{filled: tabAktif==='aksesoris'}" style="font-size:12px;"><i class="fas fa-gem" style="margin-right:6px;"></i>BOM Aksesoris ({{ form.bom_aksesoris.length }})</button>
        </div>

        <!-- BOM Jasa -->
        <div v-show="tabAktif==='jasa'">
          <div v-for="(j, i) in form.bom_jasa" :key="i" style="display:grid; gap:8px; grid-template-columns:2fr 1fr 30px; align-items:center; margin-bottom:8px;">
            <div class="gc-field" style="margin-bottom:0;"><input v-model="j.nama" type="text" placeholder="Nama Jasa (mis. Jasa Jahit)"></div>
            <div class="gc-field" style="margin-bottom:0;"><input v-model.number="j.harga" type="number" min="0" placeholder="Harga"></div>
            <button @click="hapusJasa(i)" type="button" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button>
          </div>
          <button @click="tambahJasa" type="button" class="btn-outline" style="font-size:11.5px;"><i class="fas fa-plus" style="margin-right:5px;"></i>Tambah Jasa</button>
        </div>

        <!-- BOM Pola & Vendor (digabung, keputusan #3) -->
        <div v-show="tabAktif==='pola'">
          <div v-for="(b, i) in form.bom_pola" :key="i" class="gc-card" style="margin-bottom:12px; background:var(--ivory-dim);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div style="display:flex; gap:6px;">
                <button @click="b.tipe='internal'" type="button" class="btn-outline" :class="{filled: b.tipe==='internal'}" style="font-size:11px; padding:6px 12px;">Internal (Pola)</button>
                <button @click="b.tipe='vendor'" type="button" class="btn-outline" :class="{filled: b.tipe==='vendor'}" style="font-size:11px; padding:6px 12px;">Vendor</button>
              </div>
              <button @click="hapusPola(i)" type="button" class="icon-btn" style="color:var(--danger);" title="Hapus baris"><i class="fas fa-trash-alt"></i></button>
            </div>
            <div style="display:flex; gap:14px; flex-wrap:wrap;">
              <div>
                <img v-if="!b.fotoDihapus && (b.fotoPreview || b.foto)" :src="b.fotoPreview || b.foto" style="width:76px; height:76px; object-fit:cover; border-radius:10px; border:1.5px solid var(--line); margin-bottom:6px; display:block;">
                <div class="gc-field" style="margin-bottom:0; width:170px;">
                  <label>{{ b.tipe==='vendor' ? 'Foto Proses' : 'Foto' }}</label>
                  <input type="file" accept="image/*" @change="ev => pilihFotoPola(b, ev)">
                  <button v-if="!b.fotoDihapus && (b.fotoPreview || b.foto)" @click="hapusFotoPola(b)" type="button" class="btn-outline" style="font-size:10.5px; padding:4px 8px; margin-top:5px;">Hapus Foto</button>
                </div>
              </div>
              <div style="flex:1; min-width:260px; display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-2">
                <div class="gc-field" style="margin-bottom:0;"><label>Nama Pola</label><input v-model="b.nama_pola" type="text"></div>
                <div class="gc-field" style="margin-bottom:0;"><label>Bahan (Nama + Warna)</label><dropdown-cari v-model="b.bahan_pilih" :opsi="opsiNamaBahan" placeholder="Cari & pilih bahan..." @update:modelValue="saatPilihBahanPola(b)" /></div>
                <div class="gc-field" style="margin-bottom:0;"><label>Panjang</label><input v-model.number="b.panjang" type="number" min="0"></div>
                <div class="gc-field" style="margin-bottom:0;"><label>Isi Pola (Pcs)</label><input v-model.number="b.isi_pola_pcs" type="number" min="0" placeholder="Hasil potong per pcs produk"></div>
                <div class="gc-field" style="margin-bottom:0;"><label>Jasa Cutting</label><input v-model.number="b.jasa_cutting" type="number" min="0"></div>
                <div class="gc-field" style="margin-bottom:0;"><label>Jasa Serie</label><input v-model.number="b.jasa_serie" type="number" min="0"></div>
                <div v-if="b.tipe==='vendor'" class="gc-field" style="margin-bottom:0;"><label>Jenis Vendor</label><input v-model="b.jenis_vendor" type="text"></div>
              </div>
            </div>
            <button @click="bukaKomponen(i)" type="button" class="btn-outline" style="font-size:11.5px; margin-top:10px;"><i class="fas fa-puzzle-piece" style="margin-right:5px;"></i>Kelola Komponen ({{ b.komponen.length }})</button>
          </div>
          <button @click="tambahPola" type="button" class="btn-outline" style="font-size:11.5px;"><i class="fas fa-plus" style="margin-right:5px;"></i>Tambah Baris Pola/Vendor</button>
        </div>

        <!-- BOM Aksesoris -->
        <div v-show="tabAktif==='aksesoris'">
          <div v-for="(a, i) in form.bom_aksesoris" :key="i" class="gc-card" style="margin-bottom:12px; background:var(--ivory-dim);">
            <div style="display:flex; justify-content:flex-end; margin-bottom:6px;">
              <button @click="hapusAksesoris(i)" type="button" class="icon-btn" style="color:var(--danger);" title="Hapus baris"><i class="fas fa-trash-alt"></i></button>
            </div>
            <div style="display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-3">
              <div class="gc-field" style="margin-bottom:0;"><label>Tahap Proses</label><input v-model="a.tahap_proses" type="text"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Aksesoris (Nama + Warna)</label><dropdown-cari v-model="a.aksesoris_pilih" :opsi="opsiNamaBahan" placeholder="Cari & pilih..." @update:modelValue="saatPilihAksesoris(a)" /></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Qty</label><input v-model.number="a.qty" type="number" min="0"></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Satuan</label><dropdown-cari v-model="a.satuan_pilih" :opsi="opsiSatuan" placeholder="Cari & pilih..." /></div>
              <div></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Kode Webbing 2 <span style="font-weight:400; color:var(--text-faint);">(opsional)</span></label><dropdown-cari v-model="a.webbing2_pilih" :opsi="opsiNamaBahan" placeholder="Cari & pilih..." @update:modelValue="saatPilihWebbing(a, 2)" /></div>
              <div class="gc-field" style="margin-bottom:0;"><label>Kode Webbing 3 <span style="font-weight:400; color:var(--text-faint);">(opsional)</span></label><dropdown-cari v-model="a.webbing3_pilih" :opsi="opsiNamaBahan" placeholder="Cari & pilih..." @update:modelValue="saatPilihWebbing(a, 3)" /></div>
            </div>
          </div>
          <button @click="tambahAksesoris" type="button" class="btn-outline" style="font-size:11.5px;"><i class="fas fa-plus" style="margin-right:5px;"></i>Tambah Baris Aksesoris</button>
        </div>
      </div>

      <div style="display:flex; gap:8px; margin-top:16px;">
        <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="flex:1;">{{ mengupload ? 'Mengupload foto...' : (menyimpan ? 'Menyimpan...' : (modeEdit ? 'Simpan Perubahan' : 'Simpan Produk')) }}</button>
        <button v-if="modeEdit" @click="$emit('batal')" type="button" class="btn-outline" style="flex:1;">Batal</button>
      </div>

      <kelola-komponen-modal
        v-if="modalKomponenAktif !== null"
        :komponen="form.bom_pola[modalKomponenAktif].komponen"
        :nama-pola="form.bom_pola[modalKomponenAktif].nama_pola"
        :opsi-nama-bahan="opsiNamaBahan"
        :daftar-bahan="daftarBahan"
        @tutup="tutupKomponen" />
    </div>
  `
};

// ---------------------------------------------------------------------------
// MasterProdukEntryManager — halaman "Entry Produk" (selalu mode CREATE,
// pola sama seperti BahanAksesorisEntryManager: form direset kosong lagi
// setelah simpan sukses, biar bisa langsung entry produk berikutnya).
// ---------------------------------------------------------------------------
const MasterProdukEntryManager = {
  components: { FormEntryProdukBOM },
  setup() {
    const kunciForm = ref(0); // ganti :key buat "reset" form total setelah simpan
    function saatTersimpan() {
      alert('Produk berhasil disimpan.');
      kunciForm.value++;
    }
    return { kunciForm, saatTersimpan };
  },
  template: `
    <div>
      <h3 class="gc-heading" style="font-weight:700; font-size:15px; margin-bottom:4px;"><i class="fas fa-box-open" style="color:var(--burgundy); margin-right:8px;"></i>Entry Produk (BOM)</h3>
      <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Data produk jadi konveksi lengkap dengan Bill of Material (Jasa, Pola/Vendor, Aksesoris) — jadi fondasi produksi.</p>
      <form-entry-produk-b-o-m :key="kunciForm" @tersimpan="saatTersimpan" />
    </div>
  `
};

// ---------------------------------------------------------------------------
// MasterProdukListManager — halaman "List Produk": cari+paginasi+tabel,
// modal edit (pakai ulang FormEntryProdukBOM), hapus (termasuk hapus foto
// di Storage kalau ada, biar tidak numpuk file yatim — pola sama seperti
// hapus() di js/vue-config-info.js).
// ---------------------------------------------------------------------------
const MasterProdukListManager = {
  components: { FormEntryProdukBOM },
  setup() {
    const bolehHapus = computed(() => window.cekIzinMenu('master_produk_list', 'delete') !== false);

    const paginasi = usePaginasiFirestore(db, 'master_produk', {
      perHalaman: 15,
      urutkanField: 'nama',
      cariField: 'nama',
      petakan: (id, d) => ({ id, ...d })
    });

    const sedangEdit = ref(null); // objek produk (termasuk id) yang lagi diedit, null = modal tertutup

    function bukaEdit(item) { sedangEdit.value = item; }
    function tutupEdit() { sedangEdit.value = null; }
    function saatTersimpanEdit() {
      sedangEdit.value = null;
      paginasi.muatUlang();
    }

    async function hapus(item) {
      if (!bolehHapus.value) return alert('Anda tidak punya izin menghapus di sini. Hubungi Owner/PIC.');
      if (!confirm(`Hapus produk "${item.nama}" (SKU: ${item.sku})? Foto yang sudah diupload juga akan dihapus.`)) return;
      try {
        await deleteDoc(doc(db, 'master_produk', item.id));
        if (item.foto) await hapusFotoProdukLama(item.foto);
        for (const b of (item.bom_pola || [])) { if (b.foto) await hapusFotoProdukLama(b.foto); }
        await paginasi.muatUlang();
      } catch (e) {
        console.error('Gagal hapus Master Produk:', e);
        alert('Gagal menghapus.');
      }
    }

    onMounted(async () => { await window.authReady; await paginasi.muatUlang(); });

    return { paginasi, sedangEdit, bukaEdit, tutupEdit, saatTersimpanEdit, hapus, bolehHapus };
  },
  template: `
    <div>
      <h3 class="gc-heading" style="font-weight:700; font-size:15px; margin-bottom:12px;"><i class="fas fa-list" style="color:var(--burgundy); margin-right:8px;"></i>List Produk</h3>

      <div style="margin-bottom:12px; max-width:320px;">
        <input :value="paginasi.cariTeks.value" @input="paginasi.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari nama produk (awalan)..." style="width:100%; padding:10px 14px; border:1.5px solid var(--line); border-radius:12px; font-size:13px; box-sizing:border-box;">
      </div>

      <div v-if="paginasi.memuat.value" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="paginasi.errorPaginasi.value" style="text-align:center; padding:24px; color:var(--danger); font-size:12px;">{{ paginasi.errorPaginasi.value }}</div>
      <template v-else>
        <!-- Desktop: tabel -->
        <div class="hidden md:block" style="overflow-x:auto;">
          <table class="gc-table" style="width:100%; border-collapse:collapse; font-size:12.5px;">
            <thead>
              <tr style="text-align:left; color:var(--text-faint); font-size:11px; text-transform:uppercase;">
                <th style="padding:8px;">Foto</th>
                <th style="padding:8px;">SKU</th>
                <th style="padding:8px;">Nama</th>
                <th style="padding:8px;">Warna</th>
                <th style="padding:8px;">Size</th>
                <th style="padding:8px;">BOM</th>
                <th class="freeze freeze-right" style="padding:8px;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginasi.dataHalaman.value" :key="item.id" style="border-top:1px solid var(--line);">
                <td style="padding:8px;"><img v-if="item.foto" :src="item.foto" style="width:40px; height:40px; object-fit:cover; border-radius:8px;"><span v-else style="color:var(--text-faint);">-</span></td>
                <td style="padding:8px; font-weight:700;">{{ item.sku }}</td>
                <td style="padding:8px;">{{ item.nama }}</td>
                <td style="padding:8px;">{{ item.warna }}</td>
                <td style="padding:8px;">{{ item.size }}</td>
                <td style="padding:8px;">
                  <span class="tag neutral" style="margin-right:4px;">{{ (item.bom_jasa||[]).length }} Jasa</span>
                  <span class="tag neutral" style="margin-right:4px;">{{ (item.bom_pola||[]).length }} Pola/Vendor</span>
                  <span class="tag neutral">{{ (item.bom_aksesoris||[]).length }} Aksesoris</span>
                </td>
                <td class="freeze freeze-right" style="padding:8px; text-align:center;">
                  <button @click="bukaEdit(item)" class="icon-btn" title="Edit"><i class="fas fa-pen"></i></button>
                  <button v-if="bolehHapus" @click="hapus(item)" class="icon-btn" style="color:var(--danger); margin-left:4px;" title="Hapus"><i class="fas fa-trash-alt"></i></button>
                </td>
              </tr>
              <tr v-if="paginasi.dataHalaman.value.length === 0"><td colspan="7" style="padding:20px; text-align:center; color:var(--text-faint);">Belum ada produk.</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile: kartu -->
        <div class="md:hidden" style="display:flex; flex-direction:column; gap:10px;">
          <div v-for="item in paginasi.dataHalaman.value" :key="item.id" class="gc-card" style="padding:12px; display:flex; gap:10px;">
            <img v-if="item.foto" :src="item.foto" style="width:56px; height:56px; object-fit:cover; border-radius:10px; flex-shrink:0;">
            <div style="flex:1; min-width:0;">
              <div style="font-weight:700; font-size:13px;">{{ item.nama }}</div>
              <div style="font-size:11.5px; color:var(--text-muted);">{{ item.sku }} &middot; {{ item.warna }} &middot; {{ item.size }}</div>
              <div style="margin-top:6px; display:flex; gap:8px;">
                <button @click="bukaEdit(item)" class="btn-outline" style="font-size:11px; padding:5px 12px;">Edit</button>
                <button v-if="bolehHapus" @click="hapus(item)" class="btn-outline" style="font-size:11px; padding:5px 12px; color:var(--danger); border-color:var(--danger);">Hapus</button>
              </div>
            </div>
          </div>
          <div v-if="paginasi.dataHalaman.value.length === 0" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Belum ada produk.</div>
        </div>

        <div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-top:16px;">
          <button @click="paginasi.halamanSebelumnya" :disabled="paginasi.nomorHalaman.value <= 1" class="icon-btn"><i class="fas fa-chevron-left"></i></button>
          <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasi.nomorHalaman.value }}</span>
          <button @click="paginasi.halamanBerikutnya" :disabled="!paginasi.adaBerikutnya.value" class="icon-btn"><i class="fas fa-chevron-right"></i></button>
        </div>
      </template>

      <div v-if="sedangEdit" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9998; display:flex; align-items:flex-start; justify-content:center; padding:16px; overflow-y:auto;" @click.self="tutupEdit">
        <div style="max-width:900px; width:100%; margin:24px 0;">
          <form-entry-produk-b-o-m :data-awal="sedangEdit" @tersimpan="saatTersimpanEdit" @batal="tutupEdit" />
        </div>
      </div>
    </div>
  `
};

// --- Mount, pola SAMA seperti js/vue-order-spk.js / vue-bahan-aksesoris.js -
const AppMasterProdukEntry = { components: { MasterProdukEntryManager }, template: `<master-produk-entry-manager />` };
let vmMasterProdukEntry = null;
window.pastikanMountProdukEntry = function() {
  if (vmMasterProdukEntry) return;
  const mountPoint = document.getElementById('vue-master-produk-entry');
  if (mountPoint) vmMasterProdukEntry = createApp(AppMasterProdukEntry).mount('#vue-master-produk-entry');
};

const AppMasterProdukList = { components: { MasterProdukListManager }, template: `<master-produk-list-manager />` };
let vmMasterProdukList = null;
window.pastikanMountProdukList = function() {
  if (vmMasterProdukList) return;
  const mountPoint = document.getElementById('vue-master-produk-list');
  if (mountPoint) vmMasterProdukList = createApp(AppMasterProdukList).mount('#vue-master-produk-list');
};
