// js/vue-order-spk.js
// ============================================================================
// Zevanic House > Order SPK — menu BARU (27 Agt 2026, §26.2, Tahap 2 dari
// rencana besar §26). Master data SPK (Surat Perintah Kerja/produksi)
// MINIMAL — Guru infokan SPK ini SUDAH JALAN nyata di lapangan tapi masih
// via spreadsheet, rencana migrasi bertahap ke sistem ini (BUKAN modul
// produksi lengkap, cuma pencatatan No. SPK + info dasarnya).
//
// Field (disepakati Guru, boleh direvisi/ditambah nanti kalau kebutuhan
// migrasi dari spreadsheet ternyata lebih detail): No. SPK (unik, WAJIB
// dicek dobel — dipakai sebagai kunci pencarian nanti dari Scan Persiapan,
// §26 Tahap 5), Nama Produk/Keterangan, Qty Target, Tanggal, Status
// (Aktif/Selesai).
//
// Kenapa BUKAN sub-menu di dalam Config, walau formatnya sama
// (entry+searchbox+table) — Guru EKSPLISIT minta sub-menu SENDIRI,
// sejajar Config/Data Bahan & Aksesoris/dst, langsung di bawah parent
// Zevanic House (bukan child Config) — beda dari Jenis Bahan/Satuan/dst
// yang memang murni "data referensi kecil", Order SPK punya bobot lebih
// besar (bakal jadi sumber utama Scan Persiapan nanti).
//
// Pola file: SAMA PERSIS seperti vue-rak-penyimpanan.js (menu CRUD mandiri
// dengan entry form + tabel paginasi cursor-based via usePaginasiFirestore,
// cariField aktif buat searchbox) — dipilih karena "Order SPK" butuh field
// lebih dari 2 kolom (beda dari MasterDataCategory/MasterDataTabelManager
// yang dipakai Config, itu buat data referensi simpel 1-3 kolom saja).
//
// CATATAN buat Scan Persiapan (§26 Tahap 5, SUDAH dikerjakan): dropdown
// "No SPK" di sana baca koleksi `order_spk` ini, DIFILTER status "Aktif"
// saja — lihat STATUS-PROYEK.md §26 & §26.2. **BARU (27 Agt 2026, §26.6,
// setelah Tahap 5)**: Guru minta tambahan Cetak Label No. SPK (QR berisi
// `no_spk`, dibaca scan-nya oleh tombol scan BARU di Scan Persiapan) —
// prasyarat teknis ini yang TADINYA belum ada (§26.5 "keputusan sepihak
// a" sempat menganggap No. SPK tidak akan pernah punya barcode) SEKARANG
// ADA, lihat catatan lengkap di dekat `cetakSpkList()` di bawah.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { usePaginasiFirestore } from './vue-paginasi.js';
import { PopupPratinjauCetakLabel, DropdownCari } from './vue-components.js?v=5';
// ambilSemuaProduk — BARU (28 Agt 2026, permintaan Guru: "sambungkan Order
// SPK dengan Master Produk > SKU"). Impor lintas file (bare, konvensi SAMA
// seperti impor fungsi baca-koleksi besar lain di app ini, mis. dari
// vue-stock-pembelian.js) — dipakai isi dropdown "Pilih Produk (SKU)" di
// bawah, dan field `kelipatan` tiap produk (KPK Isi Pola BOM-nya) dipakai
// tampilkan "Acuan Minimal Order" di samping Qty Target.
import { ambilSemuaProduk } from './vue-master-produk.js';

const STATUS_SPK_OPSI = ['Aktif', 'Selesai'];

function formStateKosong() {
  return reactive({
    no_spk: '',
    // sku_produk — BARU (28 Agt 2026, permintaan Guru). FK opsional ke
    // master_produk.sku — kalau diisi (lewat dropdown "Pilih Produk
    // [SKU]"), `nama_produk` di bawah OTOMATIS terisi dari situ (tetap
    // bisa diedit manual setelahnya) & field `kelipatan` produk itu
    // dipakai tampilkan "Acuan Minimal Order" di samping Qty Target.
    // SENGAJA opsional (boleh kosong) — SPK migrasi dari spreadsheet lama
    // belum tentu produknya sudah ada di Master Produk, `nama_produk`
    // manual TETAP jalan seperti sebelumnya kalau tidak dihubungkan.
    sku_produk: '',
    nama_produk: '',
    qty_target: '',
    tanggal: new Date().toISOString().slice(0, 10),
    status: 'Aktif'
  });
}

// formatLabelProduk — label tampilan dropdown "Pilih Produk (SKU)":
// "SKU — Nama Warna Size", dipakai BARENG buat isi opsi & buat
// merekonstruksi label produk yang lagi kepilih (DropdownCari kerja
// dengan array string polos, bukan objek — lihat vue-components.js).
function formatLabelProduk(p) {
  return `${p.sku} — ${[p.nama, p.warna, p.size].filter(Boolean).join(' ')}`;
}

function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

// buatQrDataUrl — DISALIN dari `vue-stock-pembelian.js` (§26.3 — logic
// SAMA PERSIS, `qrcodejs` [davidshimjs] sudah dimuat SEKALI secara global
// di index.html, dipakai lewat variabel global `QRCode`). File INI
// TIDAK impor dari `vue-stock-pembelian.js` — konvensi "salin logic kecil
// per-file" proyek ini (fungsi bantu generate-QR bukan termasuk daftar
// "fungsi shared" yang boleh diimpor lintas file, itu KHUSUS fungsi
// baca/tulis lot & stok — lihat catatan di `vue-stock-pembelian.js`).
function buatQrDataUrl(teks) {
  if (typeof QRCode === 'undefined') return '';
  const tmp = document.createElement('div');
  tmp.style.cssText = 'position:absolute; left:-9999px; top:-9999px; width:160px; height:160px;';
  document.body.appendChild(tmp);
  let dataUrl = '';
  try {
    new QRCode(tmp, { text: String(teks || ''), width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M });
    const canvas = tmp.querySelector('canvas');
    if (canvas) dataUrl = canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Gagal generate QR:', teks, e);
  }
  document.body.removeChild(tmp);
  return dataUrl;
}

// cetakSpkList — GANTI (28 Agt 2026, §41.3, permintaan Guru: pratinjau +
// config sebelum cetak, ukuran fisik 4x2 inch thermal roll, SAMA seperti
// perubahan analog di `vue-stock-pembelian.js`, §41.2). DULU fungsi modul
// biasa yang LANGSUNG window.print() dengan kotak dashed banyak-per-
// halaman kertas biasa. SEKARANG jadi closure DI DALAM `OrderSpkManager.
// setup()` (butuh set state reactive popup lokal), dipakai 2 tempat SAMA
// seperti sebelumnya: (a) tombol "Simpan + Cetak", (b) tombol "Cetak" di
// tabel (banyak SPK dicentang) — cuma siapkan `daftarLabelPreview`
// (kode/nama/info/qrDataUrl, QR digambar sinkron seperti sebelumnya) lalu
// buka `PopupPratinjauCetakLabel` (vue-components.js, dipakai BARENG 3
// tempat cetak label di app ini — lihat komentar panjang di definisinya).
// TETAP SENGAJA TIDAK menulis ke `log_cetak_label` (koleksi itu domainnya
// khusus label Bahan/Aksesoris, field `nama_barang` — beda skema).
const OrderSpkManager = {
  components: { PopupPratinjauCetakLabel, DropdownCari },
  setup() {
    const form = formStateKosong();
    const menyimpan = ref(false);
    const sedangEditId = ref(null);

    const menuId = 'order_spk';
    const bolehTambah = computed(() => window.cekIzinMenu(menuId, 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu(menuId, 'delete') !== false);
    // BARU (27 Agt 2026, §26.6) — kolom izin 'print' (SUDAH ADA di skema
    // KOSONG_IZIN sejak Cetak Label, §26.3, itu menu PERTAMA yang
    // memakainya — Order SPK menu KEDUA).
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);
    const mencetak = ref(false);
    const popupCetakLabelAktif = ref(false);
    const daftarLabelPreview = ref([]);
    function cetakSpkList(daftarSpk) {
      if (typeof QRCode === 'undefined') {
        alert('Library pembuat QR belum siap dimuat. Coba refresh halaman (Ctrl+Shift+R) lalu ulangi.');
        return;
      }
      if (!Array.isArray(daftarSpk) || daftarSpk.length === 0) return;
      daftarLabelPreview.value = daftarSpk.map(s => ({
        kode: s.no_spk,
        nama: s.nama_produk || '',
        info: `Qty Target: ${formatQty(s.qty_target)} &middot; ${s.tanggal || ''}`,
        qrDataUrl: buatQrDataUrl(s.no_spk)
      }));
      popupCetakLabelAktif.value = true;
    }

    const paginasi = usePaginasiFirestore(db, 'order_spk', {
      perHalaman: 15,
      urutkanField: 'no_spk',
      cariField: 'no_spk',
      petakan: (id, d) => ({ id, ...d })
    });

    // --- Sambungan ke Master Produk lewat SKU (BARU 28 Agt 2026, permintaan
    // Guru) --------------------------------------------------------------
    // daftarProduk dimuat SEKALI (onMounted, di bawah) — cukup buat isi
    // dropdown pencarian, pola sama seperti ambilDaftarNama() dipakai di
    // tempat lain (bukan koleksi besar, aman diambil semua sekaligus).
    const daftarProduk = ref([]);
    const opsiProdukLabel = computed(() => daftarProduk.value.map(formatLabelProduk));
    const produkTerpilih = computed(() => daftarProduk.value.find(p => p.sku === form.sku_produk) || null);
    // labelProdukTerpilih — dipakai :model-value DropdownCari (butuh STRING
    // yang PERSIS sama dengan salah satu opsi, bukan objek/sku polos).
    const labelProdukTerpilih = computed(() => produkTerpilih.value ? formatLabelProduk(produkTerpilih.value) : '');
    function pilihProdukSpk(label) {
      const p = daftarProduk.value.find(x => formatLabelProduk(x) === label);
      if (!p) { form.sku_produk = ''; return; }
      form.sku_produk = p.sku;
      // Nama Produk/Keterangan OTOMATIS terisi dari produk yang dipilih —
      // TETAP boleh diedit manual sesudahnya (bukan readonly), kalau Guru
      // mau tambah keterangan lain (mis. "Kaos Polo Navy L - batch 2").
      form.nama_produk = [p.nama, p.warna, p.size].filter(Boolean).join(' ');
    }
    function lepasProdukSpk() { form.sku_produk = ''; }

    function resetForm() {
      Object.assign(form, formStateKosong());
      sedangEditId.value = null;
    }

    async function cekNoSpkDobel() {
      const q = query(collection(db, 'order_spk'), where('no_spk', '==', form.no_spk.trim()));
      const snap = await getDocs(q);
      // Kalau sedang EDIT, dokumen dirinya sendiri boleh muncul di hasil
      // query (No. SPK-nya sendiri belum tentu diubah) — jangan dianggap
      // dobel kalau yang ketemu cuma dirinya sendiri.
      return snap.docs.some(d => d.id !== sedangEditId.value);
    }

    // simpan — BARU (27 Agt 2026, §26.6) terima param `jugaCetak`
    // (opsional, default false/undefined = perilaku LAMA persis). Kalau
    // `true` (tombol "Simpan + Cetak"): lewati alert() "tersimpan" biasa
    // (popup cetak sendiri sudah jadi konfirmasi visual, 2 interupsi
    // beruntun jadi berlebihan) lalu langsung panggil `cetakSpkList()`
    // dengan data yang BARU disimpan.
    async function simpan(jugaCetak) {
      const noSpkTrim = form.no_spk.trim();
      if (!noSpkTrim) return alert('Isi No. SPK dulu.');
      if (!form.nama_produk.trim()) return alert('Isi Nama Produk/Keterangan dulu.');
      if (!(parseFloat(form.qty_target) > 0)) return alert('Isi Qty Target dulu (harus lebih dari 0).');
      if (!form.tanggal) return alert('Isi Tanggal dulu.');

      menyimpan.value = true;
      try {
        if (await cekNoSpkDobel()) {
          alert(`No. SPK "${noSpkTrim}" sudah terdaftar. Edit yang sudah ada kalau mau ubah datanya, atau pakai nomor lain.`);
          menyimpan.value = false;
          return;
        }
        const data = {
          no_spk: noSpkTrim,
          // sku_produk — BARU (28 Agt 2026), lihat catatan formStateKosong()
          // di atas file ini.
          sku_produk: form.sku_produk || '',
          nama_produk: form.nama_produk.trim(),
          qty_target: parseFloat(form.qty_target) || 0,
          tanggal: form.tanggal,
          status: form.status
        };
        if (sedangEditId.value) {
          await updateDoc(doc(db, 'order_spk', sedangEditId.value), {
            ...data, diedit_pada: serverTimestamp(), diedit_oleh: window.currentUser?.email || null
          });
          if (!jugaCetak) alert('Perubahan Order SPK tersimpan.');
        } else {
          await addDoc(collection(db, 'order_spk'), {
            ...data, dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
          });
          if (!jugaCetak) alert('Order SPK baru tersimpan.');
        }
        resetForm();
        await paginasi.muatUlang();
        if (jugaCetak) cetakSpkList([data]);
      } catch (e) {
        console.error('Gagal simpan Order SPK:', e);
        alert('Gagal menyimpan data Order SPK. Coba lagi.');
      }
      menyimpan.value = false;
    }

    // --- BARU (27 Agt 2026, §26.6) — checkbox pilih-banyak di tabel
    // daftar, buat cetak ULANG label banyak SPK sekaligus (mis. label
    // fisik hilang/rusak, atau baru migrasi banyak SPK lama dari
    // spreadsheet sekaligus). Dikunci per `item.id`, cuma berlaku buat
    // baris yang SEDANG TAMPIL di halaman aktif (tabel ini paginasi
    // cursor-based, bukan load semua data) — pindah halaman/cari TIDAK
    // otomatis mengosongkan centangan lama (biar bisa "kumpulkan" pilihan
    // dari beberapa halaman kalau perlu), tombol "Kosongkan" buat reset
    // manual.
    const dicentangTabel = reactive({});
    const spkTercentang = computed(() => paginasi.dataHalaman.value.filter(s => dicentangTabel[s.id]));
    function toggleSemuaTabel(v) {
      paginasi.dataHalaman.value.forEach(s => { dicentangTabel[s.id] = v; });
    }
    function cetakTerpilih() {
      if (spkTercentang.value.length === 0) return;
      mencetak.value = true;
      try {
        cetakSpkList(spkTercentang.value);
      } finally {
        mencetak.value = false;
      }
    }

    function bukaEdit(item) {
      sedangEditId.value = item.id;
      Object.assign(form, {
        no_spk: item.no_spk || '', sku_produk: item.sku_produk || '', nama_produk: item.nama_produk || '',
        qty_target: item.qty_target || '', tanggal: item.tanggal || '',
        status: item.status || 'Aktif'
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function batalEdit() { resetForm(); }

    async function hapus(item) {
      if (!confirm(`Hapus Order SPK "${item.no_spk}" secara permanen?`)) return;
      try {
        await deleteDoc(doc(db, 'order_spk', item.id));
        await paginasi.muatUlang();
      } catch (e) {
        console.error('Gagal hapus Order SPK:', e);
        alert('Gagal menghapus data Order SPK.');
      }
    }

    onMounted(async () => {
      await window.authReady;
      await paginasi.muatUlang();
      // daftarProduk — dimuat sekali di sini, BUKAN nunggu user buka
      // dropdown, supaya label produk yang lagi kepilih (mode Edit) bisa
      // langsung kerekonstruksi tanpa jeda/loading tambahan.
      daftarProduk.value = await ambilSemuaProduk();
    });

    return {
      form, STATUS_SPK_OPSI, menyimpan, sedangEditId,
      simpan, bukaEdit, batalEdit, hapus, paginasi, formatQty,
      bolehTambah, bolehHapus, bolehCetak, mencetak,
      dicentangTabel, spkTercentang, toggleSemuaTabel, cetakTerpilih,
      cetakSpkList, popupCetakLabelAktif, daftarLabelPreview,
      opsiProdukLabel, produkTerpilih, labelProdukTerpilih, pilihProdukSpk, lepasProdukSpk
    };
  },
  template: `
    <div class="gc-card" style="margin-bottom:16px;">
      <h3 style="font-weight:700; font-size:13.5px; margin-bottom:4px;"><i class="fas fa-clipboard-list" style="color:var(--burgundy); margin-right:8px;"></i>{{ sedangEditId ? 'Edit Order SPK' : 'Tambah Order SPK' }}</h3>
      <p style="font-size:10.5px; color:var(--text-faint); margin:2px 0 12px;">Pencatatan No. SPK dasar (migrasi bertahap dari catatan spreadsheet). No. SPK ini nanti dipakai dropdown "No SPK" di menu Scan Persiapan.</p>

      <div v-if="bolehTambah" style="display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-2">
        <!-- Pilih Produk (SKU) — BARU (28 Agt 2026, permintaan Guru:
             "sambungkan Order SPK dengan Master Produk > SKU"). OPSIONAL
             (SPK migrasi spreadsheet lama boleh tetap isi Nama
             Produk/Keterangan manual tanpa menghubungkan ke SKU manapun).
             Begitu produk dipilih: Nama Produk/Keterangan OTOMATIS terisi
             (tetap boleh diedit manual sesudahnya) & kalau produk itu
             punya field Kelipatan (KPK Isi Pola BOM > 0), muncul info
             "Acuan Minimal Order" di bawah Qty Target. -->
        <div class="gc-field" style="grid-column:1 / -1;">
          <label>Pilih Produk (SKU) <span style="font-weight:400; color:var(--text-faint);">(opsional — hubungkan ke Master Produk)</span></label>
          <dropdown-cari :model-value="labelProdukTerpilih" :opsi="opsiProdukLabel" placeholder="Cari SKU / Nama / Warna / Size produk..." @update:modelValue="pilihProdukSpk" />
          <button v-if="form.sku_produk" @click="lepasProdukSpk" type="button" class="btn-outline" style="font-size:10.5px; padding:3px 8px; margin-top:6px;">Lepas Sambungan SKU</button>
        </div>
        <div class="gc-field">
          <label>No. SPK <span style="color:var(--danger);">*</span></label>
          <input v-model="form.no_spk" type="text" placeholder="Contoh: SPK-0001">
        </div>
        <div class="gc-field">
          <label>Nama Produk / Keterangan <span style="color:var(--danger);">*</span></label>
          <input v-model="form.nama_produk" type="text" placeholder="Contoh: Kaos Polo Navy L">
        </div>
        <div class="gc-field">
          <label>Qty Target <span style="color:var(--danger);">*</span></label>
          <input v-model.number="form.qty_target" type="number" min="0" placeholder="0">
          <!-- Acuan Minimal Order — BARU (28 Agt 2026, permintaan Guru:
               "harus diinfoakan disamping qty order sebagai acuan minimal
               order"). Cuma tampil kalau produk terhubung PUNYA kelipatan
               (>0, ada Isi Pola BOM terisi) — kalau tidak terhubung/belum
               ada BOM Pola, tidak ada hint sama sekali (bukan dianggap
               error). Warning lembut (bukan alert/block simpan) kalau Qty
               Target yang diisi BUKAN kelipatan bulat dari angka acuan —
               keputusan tetap di tangan Guru, ini cuma pengingat visual.-->
          <p v-if="produkTerpilih && produkTerpilih.kelipatan > 0" style="font-size:10.5px; color:var(--burgundy); margin-top:4px;">
            <i class="fas fa-circle-info" style="margin-right:4px;"></i>Acuan Minimal Order: kelipatan {{ produkTerpilih.kelipatan }} pcs (dari Isi Pola BOM)
            <template v-if="form.qty_target > 0 && (form.qty_target % produkTerpilih.kelipatan) !== 0">
              — Qty saat ini bukan kelipatan {{ produkTerpilih.kelipatan }}, sisa {{ form.qty_target % produkTerpilih.kelipatan }} pcs berpotensi boros pola.
            </template>
          </p>
        </div>
        <div class="gc-field">
          <label>Tanggal <span style="color:var(--danger);">*</span></label>
          <input v-model="form.tanggal" type="date">
        </div>
        <div class="gc-field" style="grid-column:1 / -1;">
          <label>Status</label>
          <div style="display:flex; gap:16px;">
            <label v-for="s in STATUS_SPK_OPSI" :key="s" style="display:flex; align-items:center; gap:6px; font-size:12.5px; cursor:pointer;">
              <input type="radio" :value="s" v-model="form.status" style="accent-color:var(--burgundy);">{{ s }}
            </label>
          </div>
        </div>
      </div>

      <div v-if="bolehTambah" style="display:flex; gap:8px; margin-top:14px; flex-wrap:wrap;">
        <button v-if="bolehCetak" @click="simpan(true)" :disabled="menyimpan" class="btn-primary" style="flex:1; min-width:160px; padding:12px;"><i class="fas fa-print" style="margin-right:6px;"></i>{{ menyimpan ? 'Menyimpan...' : 'Simpan + Cetak' }}</button>
        <button @click="simpan(false)" :disabled="menyimpan" class="btn-outline" style="flex:1; min-width:120px; padding:12px;"><i class="fas fa-floppy-disk" style="margin-right:6px;"></i>{{ menyimpan ? 'Menyimpan...' : (sedangEditId ? 'Simpan Perubahan' : 'Simpan') }}</button>
        <button v-if="sedangEditId" @click="batalEdit" class="btn-outline" style="flex:1; min-width:100px; padding:12px;">Batal Edit</button>
      </div>
      <p v-if="bolehTambah && !bolehCetak" style="font-size:10.5px; color:var(--text-faint); margin-top:8px;">Akun ini tidak punya izin cetak untuk menu ini — cuma tombol "Simpan" yang tersedia.</p>
    </div>

    <div class="gc-card" style="padding:14px 14px 4px;">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
        <div style="position:relative; max-width:280px; flex:1; min-width:200px;">
          <i class="fas fa-search" style="position:absolute; left:11px; top:11px; color:var(--text-faint); font-size:11px;"></i>
          <input :value="paginasi.cariTeks.value" @input="paginasi.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari No. SPK..." style="width:100%; padding:8px 10px 8px 28px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; outline:none;">
        </div>
        <div v-if="bolehCetak" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          <button @click="toggleSemuaTabel(true)" class="btn-outline" style="padding:5px 10px; font-size:11px;">Pilih Semua</button>
          <button @click="toggleSemuaTabel(false)" class="btn-outline" style="padding:5px 10px; font-size:11px;">Kosongkan</button>
          <button @click="cetakTerpilih" :disabled="spkTercentang.length === 0 || mencetak" class="btn-primary" style="padding:6px 14px; font-size:11.5px;"><i class="fas fa-print" style="margin-right:6px;"></i>{{ mencetak ? 'Mencetak...' : ('Cetak (' + spkTercentang.length + ')') }}</button>
        </div>
      </div>
      <p v-if="bolehCetak" style="font-size:10.5px; color:var(--text-faint); margin:-4px 0 10px;">Centang baris di tabel bawah buat cetak ulang label banyak No. SPK sekaligus (cuma baris yang lagi tampil di halaman ini).</p>
    </div>
    <!-- GANTI (28 Agt 2026) — dulu tabel scroll horizontal (7 kolom), SEKARANG
         kartu (pola sama seperti List Bahan/Aksesoris), di HP MAUPUN desktop.
         Checkbox pilih-banyak buat cetak label (dicentangTabel) DIPERTAHANKAN
         di header tiap kartu, bukan dihilangkan. -->
    <div v-if="paginasi.memuat.value" class="gc-card" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <div v-else-if="paginasi.errorPaginasi.value" class="gc-card" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasi.errorPaginasi.value }}</div>
    <div v-else-if="paginasi.dataHalaman.value.length === 0" class="gc-card" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada Order SPK terdaftar.</div>
    <div v-else style="display:flex; flex-direction:column; gap:10px;">
      <div v-for="item in paginasi.dataHalaman.value" :key="item.id" class="gc-card" style="padding:14px;">
        <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:12px;">
          <input v-if="bolehCetak" type="checkbox" v-model="dicentangTabel[item.id]" style="accent-color:var(--burgundy); width:16px; height:16px; margin-top:2px; flex-shrink:0;" title="Pilih buat cetak label">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:13.5px;">{{ item.no_spk }}</div>
          </div>
          <span class="tag" :class="item.status === 'Aktif' ? 'ok' : 'neutral'" style="flex-shrink:0;">{{ item.status }}</span>
        </div>

        <div class="kartu-rows" style="display:flex; flex-direction:column; gap:5px; background:var(--ivory-dim); border-radius:10px; padding:10px 12px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span style="color:var(--text-faint); flex-shrink:0;">Nama Produk / Keterangan</span><span style="font-weight:700; text-align:right;">{{ item.nama_produk }}</span></div>
          <!-- SKU Produk — BARU (28 Agt 2026), cuma tampil kalau SPK ini
               terhubung ke Master Produk (sku_produk terisi). SPK lama
               (migrasi spreadsheet) yang belum terhubung TIDAK tampilkan
               baris ini sama sekali. -->
          <div v-if="item.sku_produk" style="display:flex; justify-content:space-between; gap:10px; font-size:12px;"><span style="color:var(--text-faint); flex-shrink:0;">SKU Produk</span><span style="font-weight:700; text-align:right;">{{ item.sku_produk }}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Qty Target</span><span style="font-weight:700;">{{ formatQty(item.qty_target) }}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Tanggal</span><span style="font-weight:700;">{{ item.tanggal }}</span></div>
        </div>

        <div style="display:flex; gap:8px;">
          <button v-if="bolehTambah" @click="bukaEdit(item)" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 10px;"><i class="fas fa-pen" style="margin-right:6px;"></i>Edit</button>
          <button v-if="bolehCetak" @click="cetakSpkList([item])" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 10px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak</button>
          <button v-if="bolehHapus" @click="hapus(item)" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 10px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-trash-alt" style="margin-right:6px;"></i>Hapus</button>
        </div>
      </div>
    </div>
    <div v-if="!paginasi.memuat.value && paginasi.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin:16px 0;">
      <button class="icon-btn" :disabled="paginasi.nomorHalaman.value <= 1" @click="paginasi.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
      <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasi.nomorHalaman.value }}</span>
      <button class="icon-btn" :disabled="!paginasi.adaBerikutnya.value" @click="paginasi.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
    </div>
    <popup-pratinjau-cetak-label :terbuka="popupCetakLabelAktif" judul="Cetak Label No. SPK" :daftar-label="daftarLabelPreview" @tutup="popupCetakLabelAktif = false" />
  `
};

const AppOrderSpk = { components: { OrderSpkManager }, template: `<order-spk-manager />` };
let vmOrderSpk = null;
window.pastikanMountOrderSpk = function() {
  if (vmOrderSpk) return;
  const mountPoint = document.getElementById('vue-order-spk');
  if (mountPoint) vmOrderSpk = createApp(AppOrderSpk).mount('#vue-order-spk');
};
