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
// §26 Tahap 5), Nama Produk/Keterangan, Qty Order (GANTI NAMA dari "Qty
// Target", 28 Agt 2026, §42.3), Tanggal, Status (Aktif/Selesai).
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
// tampilkan "Rekomendasi Kelipatan Order" di samping Qty Order.
import { ambilSemuaProduk } from './vue-master-produk.js';

const STATUS_SPK_OPSI = ['Aktif', 'Selesai'];

function formStateKosong() {
  return reactive({
    no_spk: '',
    // sku_produk — BARU (28 Agt 2026, permintaan Guru). FK opsional ke
    // master_produk.sku — kalau diisi (lewat dropdown "Pilih Produk
    // [SKU]"), `nama_produk` di bawah OTOMATIS terisi dari situ (tetap
    // bisa diedit manual setelahnya) & field `kelipatan` produk itu
    // dipakai tampilkan "Rekomendasi Kelipatan Order" di samping Qty Order.
    // SENGAJA opsional (boleh kosong) — SPK migrasi dari spreadsheet lama
    // belum tentu produknya sudah ada di Master Produk, `nama_produk`
    // manual TETAP jalan seperti sebelumnya kalau tidak dihubungkan.
    sku_produk: '',
    nama_produk: '',
    // qty_order — GANTI NAMA (28 Agt 2026, permintaan Guru) dari
    // `qty_target`. Field Firestore-nya JUGA ganti nama jadi `qty_order`
    // (lihat simpan()), TAPI dokumen LAMA yang masih pakai `qty_target`
    // TETAP kebaca normal lewat fallback di `petakan` paginasi di bawah
    // (`d.qty_order ?? d.qty_target`) — begitu dokumen lama itu
    // diedit+disimpan ulang, otomatis pindah ke field baru. Tidak perlu
    // migrasi manual data lama.
    qty_order: '',
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

// buatAntreanPersiapanProduksi — DIPENSIUNKAN (29 Agt 2026, koreksi
// arsitektur menu Persiapan Produksi, lihat STATUS-PROYEK.md §44.13).
// DULU dipanggil otomatis begitu SPK baru disimpan, menulis ke koleksi
// `persiapan_produksi` (antrean kartu 1 versi LAMA). Koleksi itu (+
// `persiapan_komponen`) DITINGGALKAN TANPA MIGRASI (keputusan Guru,
// AskUserQuestion — dibangun 28 Agt 2026, belum sempat dipakai produksi
// nyata) — UI-nya sudah dicopot dari index.html, jadi TIDAK ADA LAGI yang
// membaca koleksi itu. Fungsi & pemanggilannya DIHAPUS dari sini supaya
// tidak lagi menulis data yang tidak pernah dibaca siapapun (PRINSIP-
// HEMAT). Alur BARU: SPK aktif dikelompokkan MANUAL lewat menu baru
// "Persiapan Produksi > Perlu Disiapkan" (js/vue-persiapan-produksi-v2.js,
// baca `order_spk` where status=='Aktif' langsung, TIDAK butuh antrean
// terpisah lagi).

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
        info: `Qty Order: ${formatQty(s.qty_order ?? s.qty_target)} &middot; ${s.tanggal || ''}`,
        qrDataUrl: buatQrDataUrl(s.no_spk)
      }));
      popupCetakLabelAktif.value = true;
    }

    const paginasi = usePaginasiFirestore(db, 'order_spk', {
      perHalaman: 15,
      urutkanField: 'no_spk',
      cariField: 'no_spk',
      // qty_order — normalisasi SATU TEMPAT di sini (28 Agt 2026, lihat
      // catatan formStateKosong() di atas): dokumen LAMA yang cuma punya
      // `qty_target` otomatis "kebaca" seolah sudah `qty_order` di semua
      // pemakaian SETELAH titik ini (tabel, cetakSpkList, bukaEdit) — TIDAK
      // perlu fallback berulang di tiap tempat pakai.
      petakan: (id, d) => ({ id, ...d, qty_order: d.qty_order ?? d.qty_target ?? 0 })
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
      if (!(parseFloat(form.qty_order) > 0)) return alert('Isi Qty Order dulu (harus lebih dari 0).');
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
          // qty_order — GANTI NAMA dari qty_target (lihat catatan
          // formStateKosong() & petakan paginasi di atas file ini). Dokumen
          // yang ditulis/ditimpa MULAI SEKARANG pakai field baru ini saja
          // (dokumen lama yang masih `qty_target` tetap kebaca normal
          // sampai diedit+disimpan ulang, otomatis pindah ke field baru).
          qty_order: parseFloat(form.qty_order) || 0,
          tanggal: form.tanggal,
          status: form.status
        };
        if (sedangEditId.value) {
          await updateDoc(doc(db, 'order_spk', sedangEditId.value), {
            ...data, diedit_pada: serverTimestamp(), diedit_oleh: window.currentUser?.email || null
          });
          if (!jugaCetak) alert('Perubahan Order SPK tersimpan.');
        } else {
          // DIPENSIUNKAN (29 Agt 2026) — dulu di sini ada panggilan
          // buatAntreanPersiapanProduksi() (auto-masuk antrean lama).
          // SEKARANG SPK baru otomatis muncul di menu baru "Persiapan
          // Produksi > Perlu Disiapkan" TANPA perlu tulis apapun di sini —
          // menu itu baca langsung dari order_spk (status=='Aktif' &
          // belum ada id_spk_grouping). Lihat js/vue-persiapan-produksi-
          // v2.js & STATUS-PROYEK.md §44.13.
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
        qty_order: item.qty_order || '', tanggal: item.tanggal || '',
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
    <div class="gc-card" style="margin-bottom:16px; border-radius:20px;">
      <h3 style="font-weight:700; font-size:13.5px; margin-bottom:4px;"><i class="fas fa-clipboard-list" style="color:var(--aksen-ink); margin-right:8px;"></i>{{ sedangEditId ? 'Edit Order SPK' : 'Tambah Order SPK' }}</h3>
      <p style="font-size:10.5px; color:var(--text-faint); margin:2px 0 12px;">Pencatatan No. SPK dasar (migrasi bertahap dari catatan spreadsheet). No. SPK ini nanti dipakai dropdown "No SPK" di menu Scan Persiapan.</p>

      <div v-if="bolehTambah" style="display:grid; gap:10px;" class="grid-cols-1 md:grid-cols-2">
        <!-- Pilih Produk (SKU) — BARU (28 Agt 2026, permintaan Guru:
             "sambungkan Order SPK dengan Master Produk > SKU"). OPSIONAL
             (SPK migrasi spreadsheet lama boleh tetap isi Nama
             Produk/Keterangan manual tanpa menghubungkan ke SKU manapun).
             Begitu produk dipilih: Nama Produk/Keterangan OTOMATIS terisi
             (tetap boleh diedit manual sesudahnya) & kalau produk itu
             punya field Kelipatan (KPK Isi Pola BOM > 0), muncul info
             "Rekomendasi Kelipatan Order" di bawah Qty Order. -->
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
        <!-- Qty Order — GANTI NAMA (28 Agt 2026, permintaan Guru) dari
             "Qty Target". Lihat catatan lengkap soal field Firestore-nya
             (juga ganti nama, dengan fallback baca data lama) di
             formStateKosong() & petakan paginasi, atas file ini. -->
        <div class="gc-field">
          <label>Qty Order <span style="color:var(--danger);">*</span></label>
          <input v-model.number="form.qty_order" type="number" min="0" placeholder="0">
          <!-- Rekomendasi Kelipatan Order — GANTI LABEL (28 Agt 2026,
               permintaan Guru: "ada rekomendasi kelipatan Order disamping
               field qty order") dari "Acuan Minimal Order" sebelumnya, isi
               & logic TIDAK berubah. Cuma tampil kalau produk terhubung
               PUNYA kelipatan (>0, ada Isi Pola BOM terisi) — kalau tidak
               terhubung/belum ada BOM Pola, tidak ada hint sama sekali
               (bukan dianggap error). Warning lembut (bukan alert/block
               simpan) kalau Qty Order yang diisi BUKAN kelipatan bulat
               dari angka rekomendasi — keputusan tetap di tangan Guru, ini
               cuma pengingat visual. -->
          <p v-if="produkTerpilih && produkTerpilih.kelipatan > 0" style="font-size:10.5px; color:var(--burgundy); margin-top:4px;">
            <i class="fas fa-circle-info" style="margin-right:4px;"></i>Rekomendasi Kelipatan Order: {{ produkTerpilih.kelipatan }} pcs (dari Isi Pola BOM)
            <template v-if="form.qty_order > 0 && (form.qty_order % produkTerpilih.kelipatan) !== 0">
              — Qty saat ini bukan kelipatan {{ produkTerpilih.kelipatan }}, sisa {{ form.qty_order % produkTerpilih.kelipatan }} pcs berpotensi boros pola.
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

    <div class="gc-card" style="padding:14px 14px 4px; border-radius:20px;">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
        <!-- Kolom cari pil — DISESUAIKAN (28 Agt 2026, redesain "Gechoo Mobile
             Organic", pola sama seperti vue-persiapan-produksi.js). Tetap
             pakai cariDenganDebounce (bukan komponen KolomCari — beda kontrak
             v-model tanpa debounce), cuma bungkusnya diganti gaya pil. -->
        <div style="display:flex; align-items:center; gap:9px; background:var(--ivory-dim); border:1px solid var(--line); border-radius:999px; padding:9px 13px; flex:1; min-width:200px; max-width:320px;">
          <i class="fas fa-magnifying-glass" style="font-size:13px; color:var(--text-faint); flex-shrink:0;"></i>
          <input :value="paginasi.cariTeks.value" @input="paginasi.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari No. SPK..." style="flex:1; min-width:0; border:none; outline:none; background:none; font-size:12px; color:var(--text);">
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
    <div v-else-if="paginasi.dataHalaman.value.length === 0" class="gc-kosong gc-card">
      <div class="lingkaran"><i class="fas fa-clipboard-list"></i></div>
      <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada Order SPK terdaftar</h3>
    </div>
    <div v-else style="display:flex; flex-direction:column; gap:10px;">
      <div v-for="item in paginasi.dataHalaman.value" :key="item.id" class="gc-card" style="padding:14px; border-radius:20px;">
        <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:12px;">
          <input v-if="bolehCetak" type="checkbox" v-model="dicentangTabel[item.id]" style="accent-color:var(--burgundy); width:16px; height:16px; margin-top:2px; flex-shrink:0;" title="Pilih buat cetak label">
          <div style="flex:1; min-width:0;">
            <div class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ item.no_spk }}</div>
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
          <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Qty Order</span><span style="font-weight:700;">{{ formatQty(item.qty_order) }}</span></div>
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
