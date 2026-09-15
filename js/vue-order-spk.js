// js/vue-order-spk.js
// Komponen OrderSpkManager (dibungkus AppOrderSpk) — Zevanic House > Order SPK.
// Pencatatan No. SPK + info dasarnya, bukan modul produksi lengkap. Mount lewat
// window.pastikanMountOrderSpk ke #vue-order-spk.
//
// Koleksi & field:
// - order_spk: no_spk (unik, dicek dobel sebelum simpan), sku_produk (FK
//   opsional ke master_produk.sku), nama_produk, qty_order, tanggal, status
//   (Aktif/Selesai). Tabel pakai usePaginasiFirestore, urut & cari di no_spk.
// - master_produk lewat ambilSemuaProduk(): isi dropdown "Pilih Produk (SKU)"
//   dan angka kelipatan untuk Rekomendasi Kelipatan Order.
//
// Jebakan:
// - Dokumen lama memakai qty_target; fallback `d.qty_order ?? d.qty_target`
//   wajib dipertahankan selama belum semua dokumen disimpan ulang.
// - Persiapan Produksi dan Scan Persiapan membaca order_spk dengan filter
//   status=='Aktif' — jangan ganti nilai status jadi label lain.
// - cetakSpkList membuat QR berisi no_spk polos; itu yang dipindai tombol scan
//   di Scan Persiapan, jadi isinya tidak boleh diberi prefiks/format lain.

import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { usePaginasiFirestore } from './vue-paginasi.js';
import { PopupPratinjauCetakLabel, DropdownCari } from './vue-components.js?v=13';
// ambilSemuaProduk — impor lintas file, konvensi sama seperti fungsi
// baca-koleksi besar lain (mis. vue-stock-pembelian.js). Mengisi dropdown
// "Pilih Produk (SKU)"; field `kelipatan` tiap produk (KPK Isi Pola BOM)
// dipakai menampilkan "Rekomendasi Kelipatan Order" di samping Qty Order.
import { ambilSemuaProduk } from './vue-master-produk.js';

const STATUS_SPK_OPSI = ['Aktif', 'Selesai'];

function formStateKosong() {
  return reactive({
    no_spk: '',
    // sku_produk — FK OPSIONAL ke master_produk.sku. Kalau diisi lewat dropdown
    // "Pilih Produk [SKU]", `nama_produk` otomatis terisi (masih bisa diedit
    // manual) dan `kelipatan` produk dipakai untuk "Rekomendasi Kelipatan Order".
    // Boleh kosong: SPK hasil migrasi spreadsheet jalan dengan nama_produk manual.
    sku_produk: '',
    nama_produk: '',
    // qty_order — nama field Firestore resmi. Dokumen yang masih pakai
    // `qty_target` tetap kebaca lewat fallback `d.qty_order ?? d.qty_target` di
    // `petakan` paginasi; begitu dokumen itu disimpan ulang ia ikut pindah
    // sendiri, jadi tidak perlu migrasi manual.
    qty_order: '',
    tanggal: new Date().toISOString().slice(0, 10),
    status: 'Aktif'
  });
}

// formatLabelProduk — label dropdown "Pilih Produk (SKU)": "SKU — Nama Warna
// Size". Dipakai bersama untuk mengisi opsi sekaligus merekonstruksi label yang
// sedang terpilih (DropdownCari bekerja dengan array string polos, bukan objek).
function formatLabelProduk(p) {
  return `${p.sku} — ${[p.nama, p.warna, p.size].filter(Boolean).join(' ')}`;
}

function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

// Simpan SPK TIDAK menulis antrean apa pun. Koleksi `persiapan_produksi` dan
// `persiapan_komponen` ditinggalkan tanpa migrasi, tidak ada yang membacanya.
// SPK aktif dikelompokkan MANUAL di menu "Persiapan Produksi > Perlu Disiapkan"
// (js/vue-persiapan-produksi-v2.js, baca `order_spk` where status=='Aktif').

// buatQrDataUrl — salinan lokal dari vue-stock-pembelian.js, sesuai konvensi
// "salin logic kecil per-file" (yang boleh diimpor lintas file cuma fungsi
// baca/tulis lot & stok). `qrcodejs` dimuat SEKALI global di index.html dan
// dipakai lewat variabel global `QRCode`.
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

// cetakSpkList closure DI DALAM `OrderSpkManager.setup` (butuh state reactive
// popup lokal). Dipakai tombol "Simpan + Cetak" dan tombol "Cetak" di tabel:
// menyiapkan `daftarLabelPreview` (kode/nama/info/qrDataUrl) lalu membuka
// PopupPratinjauCetakLabel. SENGAJA tidak menulis `log_cetak_label` (beda skema).
const OrderSpkManager = {
  components: { PopupPratinjauCetakLabel, DropdownCari },
  setup() {
    const form = formStateKosong();
    const menyimpan = ref(false);
    const sedangEditId = ref(null);

    const menuId = 'order_spk';
    const bolehTambah = computed(() => window.cekIzinMenu(menuId, 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu(menuId, 'delete') !== false);
    // kolom izin 'print' (SUDAH ADA di skema KOSONG_IZIN sejak Cetak Label,
    // §26.3, itu menu PERTAMA yang memakainya — Order SPK menu KEDUA).
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
      // qty_order — normalisasi SATU TEMPAT: dokumen yang cuma punya
      // `qty_target` otomatis kebaca sebagai `qty_order` di semua pemakaian
      // sesudah titik ini (tabel, cetakSpkList, bukaEdit), jadi tidak perlu
      // fallback berulang.
      petakan: (id, d) => ({ id, ...d, qty_order: d.qty_order ?? d.qty_target ?? 0 })
    });

    // Sambungan ke Master Produk lewat SKU

    // daftarProduk dimuat SEKALI (onMounted, di bawah) — cukup buat isi dropdown
    // pencarian, pola sama seperti ambilDaftarNama dipakai di tempat lain (bukan
    // koleksi besar, aman diambil semua sekaligus).
    const daftarProduk = ref([]);
    const opsiProdukLabel = computed(() => daftarProduk.value.map(formatLabelProduk));
    const produkTerpilih = computed(() => daftarProduk.value.find(p => p.sku === form.sku_produk) || null);
    // labelProdukTerpilih — dipakai:model-value DropdownCari (butuh STRING yang
    // PERSIS sama dengan salah satu opsi, bukan objek/sku polos).
    const labelProdukTerpilih = computed(() => produkTerpilih.value ? formatLabelProduk(produkTerpilih.value) : '');
    function pilihProdukSpk(label) {
      const p = daftarProduk.value.find(x => formatLabelProduk(x) === label);
      if (!p) { form.sku_produk = ''; return; }
      form.sku_produk = p.sku;
      // Nama Produk/Keterangan OTOMATIS terisi dari produk yang dipilih — TETAP
      // boleh diedit manual sesudahnya (bukan readonly), kalau mau tambah
      // keterangan lain (mis. "Kaos Polo Navy L - batch 2").
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
      // Kalau sedang EDIT, dokumen dirinya sendiri boleh muncul di hasil query
      // (No. SPK-nya sendiri belum tentu diubah) — jangan dianggap dobel kalau
      // yang ketemu cuma dirinya sendiri.
      return snap.docs.some(d => d.id !== sedangEditId.value);
    }

    // simpan — param `jugaCetak` opsional (default false). Kalau true (tombol
    // "Simpan + Cetak"): lewati alert "tersimpan" karena popup cetak sudah jadi
    // konfirmasi visual, lalu langsung panggil `cetakSpkList` dengan data yang
    // barusan disimpan.
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
          // sku_produk — lihat catatan formStateKosong di atas file ini.
          sku_produk: form.sku_produk || '',
          nama_produk: form.nama_produk.trim(),
          // qty_order — satu-satunya field qty yang ditulis. Dokumen yang masih
          // `qty_target` tetap kebaca lewat fallback di petakan paginasi.
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
          // Tidak ada tulisan antrean di sini. SPK yang disimpan otomatis
          // muncul di menu "Persiapan Produksi > Perlu Disiapkan", yang baca
          // langsung order_spk (status=='Aktif' & belum ada id_spk_grouping).
          // Lihat js/vue-persiapan-produksi-v2.js.
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

    // Checkbox pilih-banyak di tabel, untuk cetak ulang label banyak SPK
    // sekaligus. Dikunci per `item.id` dan cuma berlaku untuk baris yang SEDANG
    // tampil (paginasi cursor-based). Pindah halaman/cari sengaja TIDAK
    // mengosongkan centangan — reset manual lewat tombol "Kosongkan".
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

    async function muat() {
      await paginasi.muatUlang();
      // daftarProduk dimuat ulang di sini (bukan cuma sekali) supaya tambahan
      // dari Master Produk ikut kebaca begitu tab ini diklik ulang, tanpa
      // reload halaman.
      daftarProduk.value = await ambilSemuaProduk();
    }
    onMounted(async () => { await window.authReady; await muat(); });

    return {
      form, STATUS_SPK_OPSI, menyimpan, sedangEditId, muat,
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
        <!-- Pilih Produk (SKU) — OPSIONAL: SPK boleh isi Nama Produk/Keterangan manual tanpa
          terhubung ke SKU manapun. Begitu produk dipilih, Nama Produk/Keterangan otomatis terisi
          (masih boleh diedit) dan kalau produk punya Kelipatan (KPK Isi Pola BOM > 0) muncul info
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
        <!-- Qty Order — field Firestore qty_order; fallback baca dokumen qty_target ada di
          formStateKosong & petakan paginasi di atas file ini. -->
        <div class="gc-field">
          <label>Qty Order <span style="color:var(--danger);">*</span></label>
          <input v-model.number="form.qty_order" type="number" min="0" placeholder="0">
          <!-- Rekomendasi Kelipatan Order cuma tampil kalau produk terhubung punya kelipatan
            (>0, Isi Pola BOM terisi); tanpa BOM Pola tidak ada hint sama sekali, bukan error.
            Qty Order yang bukan kelipatan bulat cuma diberi warning lembut, tidak memblok
            simpan — keputusan tetap di tangan pengguna. -->
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
        <!--
          Kolom cari pil — DISESUAIKAN . Tetap pakai cariDenganDebounce (bukan komponen KolomCari
          — beda kontrak v-model tanpa debounce), cuma bungkusnya diganti gaya pil.
        -->
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
    <!--
      Checkbox pilih-banyak buat cetak label (dicentangTabel) DIPERTAHANKAN di header tiap kartu,
      bukan dihilangkan.
    -->
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
          <!-- SKU Produk cuma tampil kalau SPK ini terhubung ke Master Produk (sku_produk
            terisi). SPK yang belum terhubung tidak menampilkan baris ini sama sekali. -->
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
    <popup-pratinjau-cetak-label :terbuka="popupCetakLabelAktif" judul="Cetak Label No. SPK" :daftar-label="daftarLabelPreview" jenis-cetak="label_no_spk" @tutup="popupCetakLabelAktif = false" />
  `
};

const AppOrderSpk = { components: { OrderSpkManager }, template: `<order-spk-manager ref="mgr" />` };
let vmOrderSpk = null;
window.pastikanMountOrderSpk = function() {
  if (vmOrderSpk) {
    const mgr = vmOrderSpk.$refs && vmOrderSpk.$refs.mgr;
    if (mgr && typeof mgr.muat === 'function') mgr.muat();
    return;
  }
  const mountPoint = document.getElementById('vue-order-spk');
  if (mountPoint) vmOrderSpk = createApp(AppOrderSpk).mount('#vue-order-spk');
};
