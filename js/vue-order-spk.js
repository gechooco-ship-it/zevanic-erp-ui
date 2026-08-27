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
// CATATAN buat Scan Persiapan (§26 Tahap 5, BELUM dikerjakan): dropdown
// "No SPK" di sana rencananya baca koleksi `order_spk` ini, DIFILTER
// status "aktif" saja — lihat STATUS-PROYEK.md §26 & §26.2.
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

const OrderSpkManager = {
  setup() {
    const form = formStateKosong();
    const menyimpan = ref(false);
    const sedangEditId = ref(null);

    const menuId = 'order_spk';
    const bolehTambah = computed(() => window.cekIzinMenu(menuId, 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu(menuId, 'delete') !== false);

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

    async function simpan() {
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
          alert('Perubahan Order SPK tersimpan.');
        } else {
          await addDoc(collection(db, 'order_spk'), {
            ...data, dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
          });
          alert('Order SPK baru tersimpan.');
        }
        resetForm();
        await paginasi.muatUlang();
      } catch (e) {
        console.error('Gagal simpan Order SPK:', e);
        alert('Gagal menyimpan data Order SPK. Coba lagi.');
      }
      menyimpan.value = false;
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
      bolehTambah, bolehHapus
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

      <div v-if="bolehTambah" style="display:flex; gap:8px; margin-top:14px;">
        <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="flex:1; padding:12px;"><i class="fas fa-floppy-disk" style="margin-right:6px;"></i>{{ menyimpan ? 'Menyimpan...' : (sedangEditId ? 'Simpan Perubahan' : 'Simpan Order SPK') }}</button>
        <button v-if="sedangEditId" @click="batalEdit" class="btn-outline" style="flex:1; padding:12px;">Batal Edit</button>
      </div>
    </div>

    <div class="gc-card" style="padding:14px 14px 4px;">
      <div style="position:relative; max-width:280px; margin-bottom:12px;">
        <i class="fas fa-search" style="position:absolute; left:11px; top:11px; color:var(--text-faint); font-size:11px;"></i>
        <input :value="paginasi.cariTeks.value" @input="paginasi.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari No. SPK..." style="width:100%; padding:8px 10px 8px 28px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px; outline:none;">
      </div>
    </div>
    <div class="gc-card" style="padding:0; overflow:hidden;">
      <div v-if="paginasi.memuat.value" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="paginasi.errorPaginasi.value" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasi.errorPaginasi.value }}</div>
      <div v-else-if="paginasi.dataHalaman.value.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada Order SPK terdaftar.</div>
      <div v-else class="gc-table-scroll">
        <table class="gc-table">
          <thead>
            <tr>
              <th>No. SPK</th><th>Nama Produk / Keterangan</th><th>Qty Target</th><th>Tanggal</th><th>Status</th>
              <th class="freeze freeze-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in paginasi.dataHalaman.value" :key="item.id">
              <td><b>{{ item.no_spk }}</b></td>
              <td>{{ item.nama_produk }}</td>
              <td>{{ formatQty(item.qty_target) }}</td>
              <td>{{ item.tanggal }}</td>
              <td><span class="tag" :class="item.status === 'Aktif' ? 'ok' : 'neutral'">{{ item.status }}</span></td>
              <td class="freeze freeze-right">
                <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                  <button v-if="bolehTambah" @click="bukaEdit(item)" class="icon-btn" title="Edit"><i class="fas fa-pen"></i></button>
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
