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

const STATUS_SPK_OPSI = ['Aktif', 'Selesai'];

function formStateKosong() {
  return reactive({
    no_spk: '',
    nama_produk: '',
    qty_target: '',
    tanggal: new Date().toISOString().slice(0, 10),
    status: 'Aktif'
  });
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

// cetakSpkList — BARU (27 Agt 2026, §26.6). Cetak 1 label fisik per SPK
// (QR berisi `no_spk` + teks No. SPK/Nama Produk/Qty Target/Tanggal),
// dipakai 2 tempat: (a) tombol "Simpan + Cetak" di form entry (1 label,
// SPK yang baru saja disimpan), (b) tombol "Cetak" di tabel daftar
// (banyak label sekaligus, dari baris yang DICENTANG). Pola window
// cetak/CSS label SAMA PERSIS `CetakLabelManager.cetak()` di
// `vue-stock-pembelian.js` (§26.3) — disalin, bukan diimpor (beda file).
// QR-nya inilah yang nanti dibaca tombol "Scan" No. SPK BARU di menu
// Scan Persiapan (`vue-scan-persiapan.js`, lihat catatan di sana).
// SENGAJA TIDAK menulis log cetak ke koleksi `log_cetak_label` — koleksi
// itu domainnya khusus label Bahan/Aksesoris (field `nama_barang`),
// mencampur No. SPK ke situ bikin "Riwayat Cetak Label" di menu Cetak
// Label jadi rancu. Order SPK TIDAK punya riwayat cetak tersendiri untuk
// sekarang (bisa ditambah nanti kalau Guru minta).
function cetakSpkList(daftarSpk) {
  if (typeof QRCode === 'undefined') {
    alert('Library pembuat QR belum siap dimuat. Coba refresh halaman (Ctrl+Shift+R) lalu ulangi.');
    return;
  }
  if (!Array.isArray(daftarSpk) || daftarSpk.length === 0) return;
  const labelsHtml = daftarSpk.map(s => {
    const qrDataUrl = buatQrDataUrl(s.no_spk);
    const qrHtml = qrDataUrl
      ? `<img src="${qrDataUrl}" width="80" height="80" alt="QR ${s.no_spk}" />`
      : `<div style="font-size:9px;">(QR gagal dibuat)</div>`;
    return `
    <div class="label">
      <div class="qr">${qrHtml}</div>
      <div class="teks">
        <div class="kode">${s.no_spk}</div>
        <div class="nama">${s.nama_produk || ''}</div>
        <div class="info">Qty Target: ${formatQty(s.qty_target)} &middot; ${s.tanggal || ''}</div>
      </div>
    </div>`;
  }).join('');
  const w = window.open('', '_blank');
  if (!w) { alert('Popup diblokir browser. Izinkan popup untuk mencetak label.'); return; }
  w.document.write(`<html><head><title>Label No. SPK</title>
    <style>
      body{font-family:Arial,sans-serif; margin:0; padding:12px;}
      .label{display:inline-flex; align-items:center; gap:10px; border:1px dashed #999; border-radius:6px; padding:8px 12px; margin:4px; width:280px; box-sizing:border-box; page-break-inside:avoid; vertical-align:top;}
      .qr{width:80px; height:80px; flex-shrink:0; display:flex; align-items:center; justify-content:center;}
      .qr img{width:80px; height:80px; display:block;}
      .teks{font-size:11px; line-height:1.4;}
      .kode{font-weight:700; font-size:13px;}
      .nama{font-size:11px;}
      .info{font-size:10px; color:#555;}
    </style>
    </head><body>
    ${labelsHtml}
    <script>
      window.onload = function() { setTimeout(function () { window.print(); }, 300); };
    <\/script>
    </body></html>`);
  w.document.close();
}

const OrderSpkManager = {
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

    const paginasi = usePaginasiFirestore(db, 'order_spk', {
      perHalaman: 15,
      urutkanField: 'no_spk',
      cariField: 'no_spk',
      petakan: (id, d) => ({ id, ...d })
    });

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
        no_spk: item.no_spk || '', nama_produk: item.nama_produk || '',
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
    });

    return {
      form, STATUS_SPK_OPSI, menyimpan, sedangEditId,
      simpan, bukaEdit, batalEdit, hapus, paginasi, formatQty,
      bolehTambah, bolehHapus, bolehCetak, mencetak,
      dicentangTabel, spkTercentang, toggleSemuaTabel, cetakTerpilih,
      cetakSpkList // fungsi modul biasa (bukan reactive), diekspos apa
      // adanya ke template supaya tombol cetak per-baris di tabel bisa
      // panggil langsung `cetakSpkList([item])` tanpa perlu wrapper baru
    };
  },
  template: `
    <div class="gc-card" style="margin-bottom:16px;">
      <h3 style="font-weight:700; font-size:13.5px; margin-bottom:4px;"><i class="fas fa-clipboard-list" style="color:var(--burgundy); margin-right:8px;"></i>{{ sedangEditId ? 'Edit Order SPK' : 'Tambah Order SPK' }}</h3>
      <p style="font-size:10.5px; color:var(--text-faint); margin:2px 0 12px;">Pencatatan No. SPK dasar (migrasi bertahap dari catatan spreadsheet). No. SPK ini nanti dipakai dropdown "No SPK" di menu Scan Persiapan.</p>

      <div v-if="bolehTambah" style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px;" class="grid-cols-1 md:grid-cols-2">
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
    <div class="gc-card" style="padding:0; overflow:hidden;">
      <div v-if="paginasi.memuat.value" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="paginasi.errorPaginasi.value" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasi.errorPaginasi.value }}</div>
      <div v-else-if="paginasi.dataHalaman.value.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada Order SPK terdaftar.</div>
      <div v-else class="gc-table-scroll">
        <table class="gc-table">
          <thead>
            <tr>
              <th v-if="bolehCetak" style="width:32px;"></th>
              <th>No. SPK</th><th>Nama Produk / Keterangan</th><th>Qty Target</th><th>Tanggal</th><th>Status</th>
              <th class="freeze freeze-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in paginasi.dataHalaman.value" :key="item.id">
              <td v-if="bolehCetak"><input type="checkbox" v-model="dicentangTabel[item.id]" style="accent-color:var(--burgundy); width:14px; height:14px;"></td>
              <td><b>{{ item.no_spk }}</b></td>
              <td>{{ item.nama_produk }}</td>
              <td>{{ formatQty(item.qty_target) }}</td>
              <td>{{ item.tanggal }}</td>
              <td><span class="tag" :class="item.status === 'Aktif' ? 'ok' : 'neutral'">{{ item.status }}</span></td>
              <td class="freeze freeze-right">
                <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                  <button v-if="bolehTambah" @click="bukaEdit(item)" class="icon-btn" title="Edit"><i class="fas fa-pen"></i></button>
                  <button v-if="bolehCetak" @click="cetakSpkList([item])" class="icon-btn" title="Cetak label SPK ini"><i class="fas fa-print"></i></button>
                  <button v-if="bolehHapus" @click="hapus(item)" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-if="!paginasi.memuat.value && paginasi.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin:16px 0;">
      <button class="icon-btn" :disabled="paginasi.nomorHalaman.value <= 1" @click="paginasi.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
      <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasi.nomorHalaman.value }}</span>
      <button class="icon-btn" :disabled="!paginasi.adaBerikutnya.value" @click="paginasi.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
    </div>
  `
};

const AppOrderSpk = { components: { OrderSpkManager }, template: `<order-spk-manager />` };
let vmOrderSpk = null;
window.pastikanMountOrderSpk = function() {
  if (vmOrderSpk) return;
  const mountPoint = document.getElementById('vue-order-spk');
  if (mountPoint) vmOrderSpk = createApp(AppOrderSpk).mount('#vue-order-spk');
};
