// js/vue-rak-penyimpanan.js
// ============================================================================
// Zevanic House > Data Bahan & Aksesoris > "Rak Penyimpanan" — menu BARU
// (25 Agt 2026, §25), menggantikan pendekatan sebelumnya (§24) yang naruh
// Kode Rak/Baris Rak/Kolom Rak sebagai 3 dropdown master data LEPAS
// langsung di form Bahan/Aksesoris (tanpa data dimensi/kapasitas apapun).
//
// KEPUTUSAN Hilman (AskUserQuestion, 25 Agt 2026):
//   1. Field Kode/Baris/Kolom Rak di form Bahan/Aksesoris DIGANTI jadi 1
//      dropdown "Pilih Rak" yang nunjuk ke RECORD di menu ini (bukan 3
//      dropdown lepas lagi) — lihat vue-bahan-aksesoris.js.
//   2. "Volume" di sini BEDA dari "Volume Barang" (§24, di form Bahan/
//      Aksesoris) — di sini Volume = kapasitas RAK ITU SENDIRI (dimensi
//      fisik raknya), dipakai nanti buat cek over-stok (bandingkan total
//      Volume Barang × qty yang ditaruh di 1 rak vs Volume Rak-nya) —
//      logic itu BELUM dikerjakan di sini, cuma disiapkan datanya.
//
// Karena belum ada data nyata sama sekali di kolom kode_rak/baris_rak/
// kolom_rak lama (§24 belum sempat dites), penggantian ini AMAN, bukan
// migrasi data.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { DropdownCari } from './vue-components.js';
import { usePaginasiFirestore } from './vue-paginasi.js';

function formStateKosong() {
  return reactive({
    kode_rak: '',
    baris_rak: '',
    kolom_rak: '',
    tinggi_rak: '',
    panjang_rak: '',
    lebar_rak: ''
  });
}

function formatAngka(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

// buatLabelRak — format tampilan gabungan Kode-Baris-Kolom, dipakai
// sebagai "nama" rak di dropdown vue-bahan-aksesoris.js & tabel di sini.
function buatLabelRak(kode, baris, kolom) {
  return [kode, baris, kolom].filter(Boolean).join('-');
}

const RakPenyimpananManager = {
  components: { DropdownCari },
  setup() {
    const form = formStateKosong();
    const opsiKodeRak = ref([]);
    const opsiBarisRak = ref([]);
    const opsiKolomRak = ref([]);
    const menyimpan = ref(false);
    const sedangEditId = ref(null);

    async function muatOpsiRak() {
      [opsiKodeRak.value, opsiBarisRak.value, opsiKolomRak.value] = await Promise.all([
        window.ambilMasterList ? window.ambilMasterList('kode_rak') : [],
        window.ambilMasterList ? window.ambilMasterList('baris_rak') : [],
        window.ambilMasterList ? window.ambilMasterList('kolom_rak') : []
      ]);
    }

    const volumeRak = computed(() => {
      const t = parseFloat(form.tinggi_rak) || 0;
      const p = parseFloat(form.panjang_rak) || 0;
      const l = parseFloat(form.lebar_rak) || 0;
      return t * p * l;
    });

    const paginasi = usePaginasiFirestore(db, 'master_rak_penyimpanan', {
      perHalaman: 15,
      urutkanField: 'kode_rak',
      cariField: 'kode_rak',
      petakan: (id, d) => ({ id, ...d })
    });

    function resetForm() {
      Object.assign(form, formStateKosong());
      sedangEditId.value = null;
    }

    async function cekKombinasiDobel() {
      const q = query(collection(db, 'master_rak_penyimpanan'),
        where('kode_rak', '==', form.kode_rak),
        where('baris_rak', '==', form.baris_rak),
        where('kolom_rak', '==', form.kolom_rak));
      const snap = await getDocs(q);
      // Kalau sedang EDIT, dokumen dirinya sendiri boleh muncul di hasil
      // query (kombinasinya sendiri belum tentu diubah) — jangan dianggap
      // dobel kalau yang ketemu cuma dirinya sendiri.
      return snap.docs.some(d => d.id !== sedangEditId.value);
    }

    async function simpan() {
      if (!form.kode_rak) return alert('Pilih Kode Rak dulu.');
      if (!form.baris_rak) return alert('Pilih Baris Rak dulu.');
      if (!form.kolom_rak) return alert('Pilih Kolom Rak dulu.');
      if (!(parseFloat(form.tinggi_rak) > 0)) return alert('Isi Tinggi Rak dulu (harus lebih dari 0).');
      if (!(parseFloat(form.panjang_rak) > 0)) return alert('Isi Panjang Rak dulu (harus lebih dari 0).');
      if (!(parseFloat(form.lebar_rak) > 0)) return alert('Isi Lebar Rak dulu (harus lebih dari 0).');

      menyimpan.value = true;
      try {
        if (await cekKombinasiDobel()) {
          alert(`Kombinasi Rak "${buatLabelRak(form.kode_rak, form.baris_rak, form.kolom_rak)}" sudah terdaftar. Edit yang sudah ada kalau mau ubah dimensinya, atau pilih kombinasi lain.`);
          menyimpan.value = false;
          return;
        }
        const data = {
          kode_rak: form.kode_rak,
          baris_rak: form.baris_rak,
          kolom_rak: form.kolom_rak,
          rak_label: buatLabelRak(form.kode_rak, form.baris_rak, form.kolom_rak),
          tinggi_rak: parseFloat(form.tinggi_rak) || 0,
          panjang_rak: parseFloat(form.panjang_rak) || 0,
          lebar_rak: parseFloat(form.lebar_rak) || 0,
          volume_rak: volumeRak.value
        };
        if (sedangEditId.value) {
          await updateDoc(doc(db, 'master_rak_penyimpanan', sedangEditId.value), {
            ...data, diedit_pada: serverTimestamp(), diedit_oleh: window.currentUser?.email || null
          });
          alert('Perubahan Rak tersimpan.');
        } else {
          await addDoc(collection(db, 'master_rak_penyimpanan'), {
            ...data, dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
          });
          alert('Rak baru tersimpan.');
        }
        resetForm();
        await paginasi.muatUlang();
      } catch (e) {
        console.error('Gagal simpan Rak Penyimpanan:', e);
        alert('Gagal menyimpan data Rak. Coba lagi.');
      }
      menyimpan.value = false;
    }

    function bukaEdit(item) {
      sedangEditId.value = item.id;
      Object.assign(form, {
        kode_rak: item.kode_rak || '', baris_rak: item.baris_rak || '', kolom_rak: item.kolom_rak || '',
        tinggi_rak: item.tinggi_rak || '', panjang_rak: item.panjang_rak || '', lebar_rak: item.lebar_rak || ''
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function batalEdit() { resetForm(); }

    async function hapus(item) {
      let pesan = `Hapus Rak "${item.rak_label}" secara permanen?`;
      try {
        const snapDipakai = await getDocs(query(collection(db, 'master_bahan_aksesoris'), where('rak_id', '==', item.id)));
        if (!snapDipakai.empty) {
          pesan += `\n\n⚠️ PERINGATAN: ${snapDipakai.size} data Bahan/Aksesoris SAAT INI masih menunjuk ke Rak ini — kalau dihapus, field Rak di data itu TIDAK otomatis kosong (jadi menunjuk ke Rak yang sudah tidak ada). Pertimbangkan pindahkan dulu data itu ke Rak lain sebelum menghapus.`;
        }
      } catch (e) {
        console.error('Gagal cek pemakaian Rak:', e);
      }
      if (!confirm(pesan)) return;
      try {
        await deleteDoc(doc(db, 'master_rak_penyimpanan', item.id));
        await paginasi.muatUlang();
      } catch (e) {
        console.error('Gagal hapus Rak Penyimpanan:', e);
        alert('Gagal menghapus data Rak.');
      }
    }

    onMounted(async () => {
      await window.authReady;
      muatOpsiRak();
      await paginasi.muatUlang();
    });

    return {
      form, opsiKodeRak, opsiBarisRak, opsiKolomRak, volumeRak, menyimpan, sedangEditId,
      simpan, bukaEdit, batalEdit, hapus, paginasi, formatAngka
    };
  },
  template: `
    <div class="gc-card" style="margin-bottom:16px;">
      <h3 style="font-weight:700; font-size:13.5px; margin-bottom:4px;"><i class="fas fa-warehouse" style="color:var(--burgundy); margin-right:8px;"></i>{{ sedangEditId ? 'Edit Rak' : 'Tambah Rak Penyimpanan' }}</h3>
      <p style="font-size:10.5px; color:var(--text-faint); margin:2px 0 12px;">Kode/Baris/Kolom Rak dikelola lewat Pengaturan di menu Entry Bahan &amp; Aksesoris (ikon gear). Dimensi di sini = dimensi FISIK rak itu sendiri (buat hitung kapasitas) — BEDA dari "Volume Barang" di form Bahan/Aksesoris (yang itu dimensi 1 satuan barangnya).</p>

      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;" class="grid-cols-1 md:grid-cols-3">
        <div class="gc-field">
          <label>Kode Rak <span style="color:var(--danger);">*</span></label>
          <dropdown-cari v-model="form.kode_rak" :opsi="opsiKodeRak" placeholder="Cari & pilih Kode Rak..." />
        </div>
        <div class="gc-field">
          <label>Baris Rak <span style="color:var(--danger);">*</span></label>
          <dropdown-cari v-model="form.baris_rak" :opsi="opsiBarisRak" placeholder="Cari & pilih Baris Rak..." />
        </div>
        <div class="gc-field">
          <label>Kolom Rak <span style="color:var(--danger);">*</span></label>
          <dropdown-cari v-model="form.kolom_rak" :opsi="opsiKolomRak" placeholder="Cari & pilih Kolom Rak..." />
        </div>
      </div>

      <p style="font-size:11.5px; font-weight:700; color:var(--text-muted); margin:14px 0 8px;"><i class="fas fa-cube" style="margin-right:6px;"></i>Dimensi Rak (untuk estimasi kapasitas)</p>
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;" class="grid-cols-1 md:grid-cols-3">
        <div class="gc-field">
          <label>Tinggi (cm) <span style="color:var(--danger);">*</span></label>
          <input v-model.number="form.tinggi_rak" type="number" min="0" placeholder="0">
        </div>
        <div class="gc-field">
          <label>Panjang (cm) <span style="color:var(--danger);">*</span></label>
          <input v-model.number="form.panjang_rak" type="number" min="0" placeholder="0">
        </div>
        <div class="gc-field">
          <label>Lebar (cm) <span style="color:var(--danger);">*</span></label>
          <input v-model.number="form.lebar_rak" type="number" min="0" placeholder="0">
        </div>
      </div>

      <div style="background:var(--ivory-dim); border-radius:12px; padding:12px 16px; margin:16px 0;">
        <span style="font-size:10.5px; color:var(--text-faint); display:block;">Estimasi Volume / Kapasitas Rak (otomatis)</span>
        <b style="font-size:16px; color:var(--burgundy);">{{ formatAngka(volumeRak) }} cm&sup3;</b>
      </div>

      <div style="display:flex; gap:8px;">
        <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="flex:1; padding:12px;"><i class="fas fa-floppy-disk" style="margin-right:6px;"></i>{{ menyimpan ? 'Menyimpan...' : (sedangEditId ? 'Simpan Perubahan' : 'Simpan Rak') }}</button>
        <button v-if="sedangEditId" @click="batalEdit" class="btn-outline" style="flex:1; padding:12px;">Batal Edit</button>
      </div>
    </div>

    <div class="gc-card" style="padding:0; overflow:hidden;">
      <div v-if="paginasi.memuat.value" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="paginasi.errorPaginasi.value" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasi.errorPaginasi.value }}</div>
      <div v-else-if="paginasi.dataHalaman.value.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada Rak terdaftar.</div>
      <div v-else class="gc-table-scroll">
        <table class="gc-table">
          <thead>
            <tr>
              <th>Kode Rak</th><th>Lokasi (Rak/Baris/Kolom)</th><th>Dimensi (T&times;P&times;L, cm)</th><th>Volume (cm&sup3;)</th>
              <th class="freeze freeze-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in paginasi.dataHalaman.value" :key="item.id">
              <td><b>{{ item.rak_label }}</b></td>
              <td>{{ item.kode_rak }} / {{ item.baris_rak }} / {{ item.kolom_rak }}</td>
              <td>{{ formatAngka(item.tinggi_rak) }} &times; {{ formatAngka(item.panjang_rak) }} &times; {{ formatAngka(item.lebar_rak) }}</td>
              <td><b>{{ formatAngka(item.volume_rak) }}</b></td>
              <td class="freeze freeze-right">
                <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                  <button @click="bukaEdit(item)" class="icon-btn" title="Edit"><i class="fas fa-pen"></i></button>
                  <button @click="hapus(item)" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-if="!paginasi.memuat.value && paginasi.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
      <button class="icon-btn" :disabled="paginasi.nomorHalaman.value <= 1" @click="paginasi.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
      <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasi.nomorHalaman.value }}</span>
      <button class="icon-btn" :disabled="!paginasi.adaBerikutnya.value" @click="paginasi.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
    </div>
  `
};

const AppRakPenyimpanan = { components: { RakPenyimpananManager }, template: `<rak-penyimpanan-manager />` };
let vmRakPenyimpanan = null;
window.pastikanMountRakPenyimpanan = function() {
  if (vmRakPenyimpanan) return;
  const mountPoint = document.getElementById('vue-rak-penyimpanan');
  if (mountPoint) vmRakPenyimpanan = createApp(AppRakPenyimpanan).mount('#vue-rak-penyimpanan');
};
