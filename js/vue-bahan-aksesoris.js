// js/vue-bahan-aksesoris.js
// ============================================================================
// Zevanic House > Master Bahan & Aksesoris — fitur BARU (23 Agt 2026, awal
// pembangunan modul Konveksi). 2 menu di dalamnya:
//   1. "Bahan / Aksesoris" (BahanAksesorisEntryManager) — form entry data.
//   2. "List Bahan / Aksesoris" (BahanAksesorisListManager) — tabel paginasi
//      + edit + hapus.
//
// KEPUTUSAN DESAIN yang sudah dikonfirmasi Hilman (AskUserQuestion,
// 23 Agt 2026) — lihat STATUS-PROYEK.md §20 untuk detail lengkap:
//   1. Harga Modal & Harga Pemakaian DIHITUNG OTOMATIS (readonly), BUKAN
//      diisi manual — cuma Harga Pembelian, Isi Konversi Pembelian, dan
//      Margin Modal yang diisi manual.
//        Harga Modal     = Harga Pembelian / Isi Konversi Pembelian
//        Harga Pemakaian = Harga Modal + Margin Modal   (Margin = NOMINAL
//        Rupiah, BUKAN persen — asumsi ini, konfirmasi ke Hilman terpisah)
//   2. Popup konversi berjenjang (Dus > Pack > Pcs, dst) DISIMPAN PERMANEN
//      sebagai array `konversi_bertingkat` di dokumen, bukan cuma kalkulator
//      sekali pakai.
//   3. ID Bahan/Aksesoris SEQUENTIAL (bukan acak seperti idAcak() di
//      vue-registrasi.js) — prefix terpisah per kategori (Bahan/Aksesoris),
//      diatur lewat panel Pengaturan (ikon gear di menu Entry), counter
//      naik otomatis pakai runTransaction() (koleksi baru
//      `pengaturan_id_bahan_aksesoris`, BUKAN numpang di koleksi `config`
//      yang di firestore.rules cuma boleh ditulis Owner/Superuser — di
//      sini level admin ke atas WAJIB bisa atur & pakai).
//   4. Menu baru "Zevanic House" di sidebar, admin ke atas (isAdminLevel()
//      — pic/admin/owner/superuser), sejajar Master Absensi/Keuangan/
//      Karyawan/Integrasi.
//
// ASUMSI TAMBAHAN (belum eksplisit ditanyakan ke Hilman, level risiko
// rendah/gampang diubah — lihat catatan di STATUS-PROYEK.md §20):
//   - Field "Jenis Bahan / Aksesoris" (wajib) diimplementasi sebagai daftar
//     master data yang bisa diedit admin (pakai MasterDataCategory yang
//     SUDAH ADA di vue-components.js, pola sama seperti Jenis Pekerjaan/
//     Jabatan/dst) — TAPI dipisah jadi 2 kategori master_data berbeda:
//     'jenis_bahan' dan 'jenis_aksesoris', dipilih otomatis sesuai field
//     baru "Kategori Utama" (Bahan/Aksesoris) di bawah.
//   - Field "Kategori Utama" (Bahan / Aksesoris) BARU, TIDAK ADA di daftar
//     13 field asli permintaan Hilman — ditambahkan karena SECARA STRUKTUR
//     wajib ada: field ini yang menentukan prefix ID mana dipakai (poin 3
//     di atas) dan kategori Jenis mana yang muncul di dropdown (poin di
//     atas), juga dipakai buat filter di List.
//   - Satuan Pembelian & Satuan Pemakaian sengaja dibuat TEKS BEBAS (bukan
//     dropdown master data) — satuan konveksi terlalu beragam (meter, yard,
//     roll, kg, dus, pack, pcs, dst), teks bebas lebih fleksibel di tahap
//     awal ini.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDoc, getDocs, setDoc, serverTimestamp, runTransaction, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { MasterDataCategory, MasterDataTabelManager, DropdownCari } from './vue-components.js';
import { usePaginasiFirestore } from './vue-paginasi.js';

const KATEGORI_UTAMA_OPSI = ['Bahan', 'Aksesoris'];

function kategoriMasterData(kategoriUtama) {
  return kategoriUtama === 'Aksesoris' ? 'jenis_aksesoris' : 'jenis_bahan';
}
function kunciPengaturanId(kategoriUtama) {
  return kategoriUtama === 'Aksesoris' ? 'aksesoris' : 'bahan';
}

// ambilDaftarNama — BARU (23 Agt 2026), dipakai buat isi opsi DropdownCari
// (Warna, Satuan Pembelian, Satuan Pemakaian) dari koleksi MasterDataTabelManager
// (master_satuan/master_warna, lihat vue-components.js) — beda dari
// window.ambilMasterList (dashboard.js) yang bacanya dari 1 dokumen
// `master_data/{kategori}` berisi array, koleksi ini 1 dokumen per item.
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

// Kompresi gambar sisi klien — pola SAMA seperti js/camera.js (foto KTP) &
// js/vue-reimburse.js (foto bukti), disalin di sini (bukan diimpor) karena
// tidak di-export ke window, cuma dipakai internal file masing-masing.
// Dimensi lebih kecil (500px) & kualitas lebih rendah (0.65) dibanding
// reimburse — ini foto KATALOG bahan (thumbnail), bukan bukti nota, jadi
// TIDAK perlu resolusi tinggi, prioritas dokumen tetap kecil (banyak baris).
function kompresGambarBahan(file, maxDimensi, kualitas) {
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
        resolve(canvas.toDataURL('image/jpeg', kualitas));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// generateIdBerurutan — inti poin 3 keputusan desain di atas. runTransaction
// WAJIB dipakai di sini (beda dari idAcak() lama di vue-registrasi.js yang
// random jadi tidak butuh ini) supaya counter tidak pernah dobel/tabrakan
// walau 2 admin submit BERSAMAAN persis di waktu yang sama.
async function generateIdBerurutan(kategoriUtama) {
  const kunci = kunciPengaturanId(kategoriUtama);
  const refDoc = doc(db, 'pengaturan_id_bahan_aksesoris', kunci);
  return await runTransaction(db, async (trx) => {
    const snap = await trx.get(refDoc);
    const data = snap.exists() ? snap.data() : null;
    if (!data || !data.prefix) {
      throw new Error(`Prefix ID untuk kategori "${kategoriUtama}" belum diatur. Buka tombol "Pengaturan" (ikon gear di pojok atas) dulu untuk mengatur prefix-nya, baru simpan lagi.`);
    }
    const counterBaru = (data.counter || 0) + 1;
    if (snap.exists()) trx.update(refDoc, { counter: counterBaru });
    else trx.set(refDoc, { prefix: data.prefix, counter: counterBaru });
    return `${data.prefix}-${String(counterBaru).padStart(4, '0')}`;
  });
}

function formStateKosong() {
  return reactive({
    kategori_utama: '',
    jenis: '',
    foto: '',
    nama: '',
    warna: '',
    harga_pembelian: '',
    satuan_pembelian: '',
    isi_konversi_pembelian: '',
    satuan_pemakaian: '',
    margin_modal: '',
    konversi_bertingkat: []
  });
}

// useKonversiBerjenjang — logic popup "bantu hitung konversi banyak tingkat"
// (mis. Dus > Pack > Pcs), dipakai BARENG oleh form Entry & form Edit (di
// modal List) lewat 1 fungsi ini supaya logicnya tidak ditulis 2x beda-beda.
function useKonversiBerjenjang(form) {
  const tampilPopupKonversi = ref(false);
  const barisKonversi = ref([]);

  function bukaPopupKonversi() {
    barisKonversi.value = (form.konversi_bertingkat && form.konversi_bertingkat.length > 0)
      ? JSON.parse(JSON.stringify(form.konversi_bertingkat))
      : [{ dari: form.satuan_pembelian || '', jumlah: '', ke: '' }];
    tampilPopupKonversi.value = true;
  }
  function tutupPopupKonversi() { tampilPopupKonversi.value = false; }
  function tambahBarisKonversi() {
    const terakhir = barisKonversi.value[barisKonversi.value.length - 1];
    barisKonversi.value.push({ dari: terakhir ? terakhir.ke : '', jumlah: '', ke: '' });
  }
  function hapusBarisKonversi(i) {
    if (barisKonversi.value.length <= 1) return;
    barisKonversi.value.splice(i, 1);
  }
  const totalKonversiBerjenjang = computed(() =>
    barisKonversi.value.reduce((total, b) => total * (parseFloat(b.jumlah) || 0), 1)
  );
  function terapkanKonversi() {
    const tidakLengkap = barisKonversi.value.some(b => !b.dari.trim() || !b.ke.trim() || !(parseFloat(b.jumlah) > 0));
    if (tidakLengkap) { alert('Lengkapi semua baris dulu: satuan awal, jumlah (angka > 0), dan satuan tujuan.'); return; }
    form.isi_konversi_pembelian = totalKonversiBerjenjang.value;
    form.konversi_bertingkat = JSON.parse(JSON.stringify(barisKonversi.value));
    const barisTerakhir = barisKonversi.value[barisKonversi.value.length - 1];
    if (barisTerakhir && barisTerakhir.ke && !form.satuan_pemakaian) form.satuan_pemakaian = barisTerakhir.ke;
    tampilPopupKonversi.value = false;
  }
  return { tampilPopupKonversi, barisKonversi, bukaPopupKonversi, tutupPopupKonversi, tambahBarisKonversi, hapusBarisKonversi, totalKonversiBerjenjang, terapkanKonversi };
}

function formatRupiah(n) {
  const angka = parseFloat(n) || 0;
  return 'Rp ' + Math.round(angka).toLocaleString('id-ID');
}

// ---------------------------------------------------------------------------
// PengaturanBahanAksesoris — panel (dibuka lewat ikon gear) berisi 2 hal:
// atur prefix ID per kategori (poin 3), dan kelola daftar Jenis Bahan/
// Jenis Aksesoris (pakai MasterDataCategory yang sudah ada, dipakai ulang).
// ---------------------------------------------------------------------------
const PengaturanBahanAksesoris = {
  components: { MasterDataCategory, MasterDataTabelManager },
  emits: ['tutup'],
  setup(props, { emit }) {
    const prefixBahan = ref('');
    const prefixAksesoris = ref('');
    const counterBahan = ref(0);
    const counterAksesoris = ref(0);
    const memuat = ref(true);
    const menyimpan = ref(false);

    async function muat() {
      memuat.value = true;
      try {
        const [snapBahan, snapAksesoris] = await Promise.all([
          getDoc(doc(db, 'pengaturan_id_bahan_aksesoris', 'bahan')),
          getDoc(doc(db, 'pengaturan_id_bahan_aksesoris', 'aksesoris'))
        ]);
        if (snapBahan.exists()) { prefixBahan.value = snapBahan.data().prefix || ''; counterBahan.value = snapBahan.data().counter || 0; }
        if (snapAksesoris.exists()) { prefixAksesoris.value = snapAksesoris.data().prefix || ''; counterAksesoris.value = snapAksesoris.data().counter || 0; }
      } catch (e) {
        console.error('Gagal muat pengaturan ID Bahan/Aksesoris:', e);
      }
      memuat.value = false;
    }

    async function simpan() {
      if (!prefixBahan.value.trim() || !prefixAksesoris.value.trim()) {
        alert('Isi prefix untuk Bahan maupun Aksesoris dulu (tidak boleh kosong).');
        return;
      }
      menyimpan.value = true;
      try {
        // merge:true WAJIB — supaya field `counter` yang sudah jalan TIDAK
        // ikut tertimpa balik ke kosong tiap kali prefix disimpan ulang.
        await setDoc(doc(db, 'pengaturan_id_bahan_aksesoris', 'bahan'), { prefix: prefixBahan.value.trim().toUpperCase() }, { merge: true });
        await setDoc(doc(db, 'pengaturan_id_bahan_aksesoris', 'aksesoris'), { prefix: prefixAksesoris.value.trim().toUpperCase() }, { merge: true });
        alert('Pengaturan tersimpan.');
        emit('tutup');
      } catch (e) {
        console.error('Gagal simpan pengaturan ID:', e);
        alert('Gagal menyimpan pengaturan. Coba lagi.');
      }
      menyimpan.value = false;
    }

    onMounted(muat);
    return { prefixBahan, prefixAksesoris, counterBahan, counterAksesoris, memuat, menyimpan, simpan };
  },
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="$emit('tutup')">
      <div class="gc-card" style="max-width:480px; width:100%; max-height:90vh; overflow-y:auto;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:14px;"><i class="fas fa-gear" style="color:var(--burgundy); margin-right:8px;"></i>Pengaturan Bahan & Aksesoris</h3>
        <div v-if="memuat" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;">Memuat...</div>
        <template v-else>
          <p style="font-size:11.5px; font-weight:700; color:var(--text-muted); margin-bottom:8px;">Prefix ID (contoh: BHN, AKS) — nomor urut naik otomatis, TIDAK bisa diubah manual di sini.</p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px;">
            <div class="gc-field" style="margin-bottom:0;">
              <label>Prefix Bahan</label>
              <input v-model="prefixBahan" type="text" placeholder="Contoh: BHN" style="text-transform:uppercase;">
              <p style="font-size:10px; color:var(--text-faint); margin-top:4px;">Sudah terpakai: {{ counterBahan }}. ID berikutnya: {{ (prefixBahan||'...').toUpperCase() }}-{{ String(counterBahan+1).padStart(4,'0') }}</p>
            </div>
            <div class="gc-field" style="margin-bottom:0;">
              <label>Prefix Aksesoris</label>
              <input v-model="prefixAksesoris" type="text" placeholder="Contoh: AKS" style="text-transform:uppercase;">
              <p style="font-size:10px; color:var(--text-faint); margin-top:4px;">Sudah terpakai: {{ counterAksesoris }}. ID berikutnya: {{ (prefixAksesoris||'...').toUpperCase() }}-{{ String(counterAksesoris+1).padStart(4,'0') }}</p>
            </div>
          </div>
          <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="width:100%; margin-bottom:20px;">{{ menyimpan ? 'Menyimpan...' : 'Simpan Prefix' }}</button>

          <hr style="border-color:var(--line); margin-bottom:16px;">
          <master-data-category kategori="jenis_bahan" label="Jenis Bahan" menu-id="bahan_aksesoris_entry" />
          <div style="height:14px;"></div>
          <master-data-category kategori="jenis_aksesoris" label="Jenis Aksesoris" menu-id="bahan_aksesoris_entry" />

          <hr style="border-color:var(--line); margin:18px 0 16px;">
          <!-- BARU (23 Agt 2026) — Data Satuan & Data Warna DIPAKAI di form
               Bahan/Aksesoris (jadi opsi DropdownCari). Data Ukuran BELUM
               dipakai di field manapun di form ini (tidak ada field "Ukuran"
               di 13 field asli) — disiapkan di sini duluan buat dipakai menu
               lain nanti, sesuai permintaan. -->
          <div class="gc-card" style="padding:14px; margin-bottom:12px;">
            <master-data-tabel-manager koleksi="master_satuan" label-singular="Satuan" label-nama="Nama Satuan" />
          </div>
          <div class="gc-card" style="padding:14px; margin-bottom:12px;">
            <master-data-tabel-manager koleksi="master_warna" label-singular="Warna" label-nama="Nama Warna" />
          </div>
          <div class="gc-card" style="padding:14px; margin-bottom:12px;">
            <master-data-tabel-manager koleksi="master_ukuran" label-singular="Ukuran" label-nama="Nama Ukuran" />
            <p style="font-size:10px; color:var(--text-faint); margin-top:8px;"><i class="fas fa-circle-info" style="margin-right:4px;"></i>Belum dipakai di form Bahan/Aksesoris manapun saat ini — disiapkan untuk menu lain ke depan.</p>
          </div>
        </template>
        <button @click="$emit('tutup')" class="btn-outline" style="width:100%; margin-top:18px;">Tutup</button>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// PopupKonversiBerjenjang — dipakai BARENG oleh Entry & Edit lewat props,
// emit 'terapkan'/'tutup' supaya state konversi tetap dipegang komponen
// induk masing-masing (form Entry / form Edit), bukan disimpan ganda di sini.
// ---------------------------------------------------------------------------
const PopupKonversiBerjenjang = {
  props: { baris: { type: Array, required: true }, total: { type: Number, required: true } },
  emits: ['tambah', 'hapus', 'terapkan', 'tutup'],
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="$emit('tutup')">
      <div class="gc-card" style="max-width:520px; width:100%; max-height:90vh; overflow-y:auto;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:6px;"><i class="fas fa-calculator" style="color:var(--burgundy); margin-right:8px;"></i>Bantu Hitung Konversi Berjenjang</h3>
        <p style="font-size:11px; color:var(--text-faint); margin-bottom:14px;">Contoh: 1 Dus = 12 Pack, 1 Pack = 12 Pcs. Tambah baris kalau tingkatnya lebih dari 1. Hasil akhir akan otomatis mengisi "Isi Konversi Pembelian".</p>
        <div v-for="(b, i) in baris" :key="i" style="display:flex; align-items:center; gap:6px; margin-bottom:8px; flex-wrap:wrap;">
          <span style="font-size:11px; color:var(--text-faint); width:14px;">1</span>
          <input v-model="b.dari" type="text" placeholder="Satuan awal (mis. Dus)" style="flex:1; min-width:100px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
          <span style="font-size:12px; color:var(--text-faint);">=</span>
          <input v-model.number="b.jumlah" type="number" min="0" placeholder="Jumlah" style="width:80px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
          <input v-model="b.ke" type="text" placeholder="Satuan tujuan (mis. Pack)" style="flex:1; min-width:100px; padding:7px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;">
          <button @click="$emit('hapus', i)" class="icon-btn" style="color:var(--danger);" title="Hapus baris"><i class="fas fa-trash-alt"></i></button>
        </div>
        <button @click="$emit('tambah')" class="btn-outline" style="font-size:11.5px; padding:6px 14px; margin-bottom:16px;"><i class="fas fa-plus" style="margin-right:5px;"></i>Tambah Tingkat</button>
        <div style="background:var(--ivory-dim); border-radius:10px; padding:10px 14px; margin-bottom:16px; font-size:12.5px; display:flex; justify-content:space-between;">
          <span style="color:var(--text-muted);">Total 1 satuan awal =</span><b>{{ total || 0 }} satuan akhir</b>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="$emit('terapkan')" class="btn-primary" style="flex:1;">Terapkan</button>
          <button @click="$emit('tutup')" class="btn-outline" style="flex:1;">Batal</button>
        </div>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// BahanAksesorisEntryManager — menu "Bahan / Aksesoris" (form entry data baru)
// ---------------------------------------------------------------------------
const BahanAksesorisEntryManager = {
  components: { PopupKonversiBerjenjang, PengaturanBahanAksesoris, DropdownCari },
  setup() {
    const form = formStateKosong();
    const opsiJenis = ref([]);
    const opsiSatuan = ref([]);
    const opsiWarna = ref([]);
    const menyimpan = ref(false);
    const tampilPengaturan = ref(false);

    async function muatOpsiSatuanWarna() {
      [opsiSatuan.value, opsiWarna.value] = await Promise.all([
        ambilDaftarNama('master_satuan'),
        ambilDaftarNama('master_warna')
      ]);
    }

    const hargaModal = computed(() => {
      const hp = parseFloat(form.harga_pembelian) || 0;
      const ik = parseFloat(form.isi_konversi_pembelian) || 0;
      return ik > 0 ? hp / ik : 0;
    });
    const hargaPemakaian = computed(() => hargaModal.value + (parseFloat(form.margin_modal) || 0));

    async function muatOpsiJenis() {
      if (!form.kategori_utama) { opsiJenis.value = []; return; }
      opsiJenis.value = window.ambilMasterList ? await window.ambilMasterList(kategoriMasterData(form.kategori_utama)) : [];
    }
    watch(() => form.kategori_utama, () => { form.jenis = ''; muatOpsiJenis(); });

    onMounted(muatOpsiSatuanWarna);

    function pilihFoto(event) {
      const file = event.target.files[0];
      if (!file) return;
      kompresGambarBahan(file, 500, 0.65)
        .then(dataUrl => { form.foto = dataUrl; })
        .catch(e => { console.error('Gagal proses foto:', e); alert('Gagal memproses foto, coba foto lain.'); });
    }
    function hapusFoto() { form.foto = ''; }

    const konversi = useKonversiBerjenjang(form);

    function resetForm() {
      const kategoriDipertahankan = form.kategori_utama;
      Object.assign(form, formStateKosong());
      form.kategori_utama = kategoriDipertahankan; // biar tidak usah pilih ulang tiap entry berturut-turut
    }

    // simpanData(duplikat) — BARU (23 Agt 2026): 1 fungsi dipakai 2 tombol.
    // duplikat=false (tombol "Simpan"): form direset kosong setelah sukses
    // (perilaku LAMA, tetap dipertahankan). duplikat=true (tombol "Simpan &
    // Duplikat"): form TIDAK direset — semua field DIPERTAHANKAN APA ADANYA
    // (kecuali Foto, sengaja dikosongkan — varian warna baru biasanya butuh
    // foto baru juga) supaya admin tinggal ubah sedikit detail yang beda
    // (paling umum: Warna, tapi bisa juga Harga/Satuan/dll — bebas) lalu
    // simpan lagi jadi entri BARU (ID baru lagi, BUKAN update entri lama).
    async function simpanData(duplikat) {
      if (!form.kategori_utama) return alert('Pilih Kategori Utama (Bahan/Aksesoris) dulu.');
      if (!form.jenis) return alert('Pilih Jenis Bahan/Aksesoris dulu.');
      if (!form.nama.trim()) return alert('Isi Nama Bahan/Aksesoris dulu.');
      if (!form.warna.trim()) return alert('Pilih Warna dulu.');
      if (!(parseFloat(form.harga_pembelian) > 0)) return alert('Isi Harga Pembelian dulu (harus lebih dari 0).');
      if (!form.satuan_pembelian.trim()) return alert('Pilih Satuan Pembelian dulu.');
      if (!(parseFloat(form.isi_konversi_pembelian) > 0)) return alert('Isi Isi Konversi Pembelian dulu (harus lebih dari 0) — bisa pakai tombol "Bantu Hitung Konversi Berjenjang" kalau tingkatnya banyak.');
      if (!form.satuan_pemakaian.trim()) return alert('Pilih Satuan Pemakaian dulu.');
      if (form.margin_modal === '' || form.margin_modal === null) return alert('Isi Margin Modal dulu (boleh 0 kalau memang tidak ada margin).');

      menyimpan.value = true;
      try {
        const idBaru = await generateIdBerurutan(form.kategori_utama);
        await addDoc(collection(db, 'master_bahan_aksesoris'), {
          id_tampil: idBaru,
          kategori_utama: form.kategori_utama,
          jenis: form.jenis,
          foto: form.foto || null,
          nama: form.nama.trim(),
          warna: form.warna.trim(),
          harga_pembelian: parseFloat(form.harga_pembelian) || 0,
          satuan_pembelian: form.satuan_pembelian.trim(),
          isi_konversi_pembelian: parseFloat(form.isi_konversi_pembelian) || 0,
          satuan_pemakaian: form.satuan_pemakaian.trim(),
          harga_modal: hargaModal.value,
          margin_modal: parseFloat(form.margin_modal) || 0,
          harga_pemakaian: hargaPemakaian.value,
          konversi_bertingkat: form.konversi_bertingkat || [],
          dibuat_pada: serverTimestamp(),
          dibuat_oleh: window.currentUser?.email || null
        });
        if (duplikat) {
          form.foto = '';
          alert(`Tersimpan! ID: ${idBaru}\n\nForm DIPERTAHANKAN untuk Duplikat — ubah detail yang beda (misal Warna), lalu Simpan / Simpan & Duplikat lagi.`);
        } else {
          alert(`Tersimpan! ID: ${idBaru}`);
          resetForm();
        }
      } catch (e) {
        console.error('Gagal simpan Bahan/Aksesoris:', e);
        alert(e.message && e.message.includes('Prefix ID') ? e.message : 'Gagal menyimpan data. Coba lagi.');
      }
      menyimpan.value = false;
    }
    function simpan() { return simpanData(false); }
    function simpanDanDuplikat() { return simpanData(true); }

    return {
      form, opsiJenis, opsiSatuan, opsiWarna, KATEGORI_UTAMA_OPSI, menyimpan, hargaModal, hargaPemakaian, formatRupiah,
      pilihFoto, hapusFoto, simpan, simpanDanDuplikat, tampilPengaturan, muatOpsiJenis, muatOpsiSatuanWarna,
      ...konversi
    };
  },
  template: `
    <div class="gc-card" style="margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h3 style="font-weight:700; font-size:13.5px;"><i class="fas fa-boxes-stacked" style="color:var(--burgundy); margin-right:8px;"></i>Entry Bahan / Aksesoris</h3>
        <button @click="tampilPengaturan = true" class="icon-btn" title="Pengaturan (prefix ID & Jenis)"><i class="fas fa-gear"></i></button>
      </div>

      <div class="gc-field">
        <label>Kategori Utama <span style="color:var(--danger);">*</span></label>
        <div style="display:flex; gap:16px;">
          <label v-for="k in KATEGORI_UTAMA_OPSI" :key="k" style="display:flex; align-items:center; gap:6px; font-size:12.5px; cursor:pointer;">
            <input type="radio" :value="k" v-model="form.kategori_utama" style="accent-color:var(--burgundy);">{{ k }}
          </label>
        </div>
      </div>

      <p style="font-size:10.5px; color:var(--text-faint); margin:2px 0 12px;">Tanggal Entry & ID akan dibuat OTOMATIS saat disimpan.</p>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;" class="grid-cols-1 md:grid-cols-2">
        <div class="gc-field">
          <label>Jenis Bahan / Aksesoris <span style="color:var(--danger);">*</span></label>
          <dropdown-cari v-model="form.jenis" :opsi="opsiJenis" :disabled="!form.kategori_utama" :placeholder="form.kategori_utama ? 'Cari & pilih Jenis...' : 'Pilih Kategori Utama dulu'" />
        </div>
        <div class="gc-field">
          <label>Nama Bahan / Aksesoris <span style="color:var(--danger);">*</span></label>
          <input v-model="form.nama" type="text" placeholder="Contoh: Katun Combed 30s">
        </div>
        <div class="gc-field">
          <label>Warna <span style="color:var(--danger);">*</span></label>
          <dropdown-cari v-model="form.warna" :opsi="opsiWarna" placeholder="Cari & pilih Warna..." />
        </div>
        <div class="gc-field">
          <label>Foto (opsional)</label>
          <input type="file" accept="image/*" @change="pilihFoto">
        </div>
      </div>
      <div v-if="form.foto" style="margin-bottom:12px;">
        <img :src="form.foto" style="width:80px; height:80px; object-fit:cover; border-radius:10px; border:1.5px solid var(--line);">
        <button @click="hapusFoto" style="background:none; border:none; color:var(--danger); font-size:11px; font-weight:700; cursor:pointer; margin-left:8px;">Hapus foto</button>
      </div>

      <hr style="border-color:var(--line); margin:14px 0;">

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;" class="grid-cols-1 md:grid-cols-2">
        <div class="gc-field">
          <label>Harga Pembelian (Rp) <span style="color:var(--danger);">*</span></label>
          <input v-model.number="form.harga_pembelian" type="number" min="0" placeholder="0">
        </div>
        <div class="gc-field">
          <label>Satuan Pembelian <span style="color:var(--danger);">*</span></label>
          <dropdown-cari v-model="form.satuan_pembelian" :opsi="opsiSatuan" placeholder="Cari & pilih Satuan..." />
        </div>
        <div class="gc-field" style="grid-column:1/-1;">
          <label>Isi Konversi Pembelian <span style="color:var(--danger);">*</span></label>
          <div style="display:flex; gap:8px;">
            <input v-model.number="form.isi_konversi_pembelian" type="number" min="0" placeholder="Contoh: 144" style="flex:1;">
            <button @click="bukaPopupKonversi" class="btn-outline" style="white-space:nowrap; font-size:11.5px; padding:0 14px;"><i class="fas fa-calculator" style="margin-right:5px;"></i>Konversi Banyak Tingkat</button>
          </div>
          <p v-if="form.konversi_bertingkat && form.konversi_bertingkat.length > 0" style="font-size:10px; color:var(--text-faint); margin-top:4px;">
            Rincian: {{ form.konversi_bertingkat.map(b => '1 ' + b.dari + ' = ' + b.jumlah + ' ' + b.ke).join(', ') }}
          </p>
        </div>
        <div class="gc-field">
          <label>Satuan Pemakaian <span style="color:var(--danger);">*</span></label>
          <dropdown-cari v-model="form.satuan_pemakaian" :opsi="opsiSatuan" placeholder="Cari & pilih Satuan..." />
        </div>
        <div class="gc-field">
          <label>Margin Modal (Rp) <span style="color:var(--danger);">*</span></label>
          <input v-model.number="form.margin_modal" type="number" min="0" placeholder="0">
        </div>
      </div>

      <div style="background:var(--ivory-dim); border-radius:12px; padding:12px 16px; display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
        <div><span style="font-size:10.5px; color:var(--text-faint); display:block;">Harga Modal (otomatis)</span><b style="font-size:14px;">{{ formatRupiah(hargaModal) }}</b></div>
        <div><span style="font-size:10.5px; color:var(--text-faint); display:block;">Harga Pemakaian (otomatis)</span><b style="font-size:14px; color:var(--burgundy);">{{ formatRupiah(hargaPemakaian) }}</b></div>
      </div>

      <div style="display:flex; gap:8px;">
        <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="flex:1; padding:12px;"><i class="fas fa-floppy-disk" style="margin-right:6px;"></i>{{ menyimpan ? 'Menyimpan...' : 'Simpan' }}</button>
        <button @click="simpanDanDuplikat" :disabled="menyimpan" class="btn-outline" style="flex:1; padding:12px;" title="Simpan sebagai entri baru, TAPI form tidak dikosongkan — tinggal ubah detail yang beda (misal Warna) lalu simpan lagi"><i class="fas fa-copy" style="margin-right:6px;"></i>Simpan &amp; Duplikat</button>
      </div>
    </div>

    <popup-konversi-berjenjang v-if="tampilPopupKonversi" :baris="barisKonversi" :total="totalKonversiBerjenjang"
      @tambah="tambahBarisKonversi" @hapus="hapusBarisKonversi" @terapkan="terapkanKonversi" @tutup="tutupPopupKonversi" />
    <pengaturan-bahan-aksesoris v-if="tampilPengaturan" @tutup="tampilPengaturan = false; muatOpsiJenis(); muatOpsiSatuanWarna()" />
  `
};

// ---------------------------------------------------------------------------
// BahanAksesorisListManager — menu "List Bahan / Aksesoris" (tabel paginasi
// cursor-based, WAJIB sesuai PRINSIP-HEMAT.md — bukan fetch-semua-lalu-
// potong-di-JS seperti MasterKendaraanManager lama).
// ---------------------------------------------------------------------------
const BahanAksesorisListManager = {
  components: { PopupKonversiBerjenjang, DropdownCari },
  setup() {
    const filterKategori = ref('ALL');
    const paginasi = usePaginasiFirestore(db, 'master_bahan_aksesoris', {
      perHalaman: 15,
      urutkanField: 'nama',
      cariField: 'nama',
      constraintTambahan: () => filterKategori.value === 'ALL' ? [] : [where('kategori_utama', '==', filterKategori.value)],
      petakan: (id, d) => ({ id, ...d })
    });
    watch(filterKategori, () => paginasi.muatUlang());

    const sedangEditId = ref(null);
    const formEdit = formStateKosong();
    const opsiJenisEdit = ref([]);
    const opsiSatuanEdit = ref([]);
    const opsiWarnaEdit = ref([]);
    const menyimpanEdit = ref(false);

    async function muatOpsiSatuanWarnaEdit() {
      [opsiSatuanEdit.value, opsiWarnaEdit.value] = await Promise.all([
        ambilDaftarNama('master_satuan'),
        ambilDaftarNama('master_warna')
      ]);
    }

    const hargaModalEdit = computed(() => {
      const hp = parseFloat(formEdit.harga_pembelian) || 0;
      const ik = parseFloat(formEdit.isi_konversi_pembelian) || 0;
      return ik > 0 ? hp / ik : 0;
    });
    const hargaPemakaianEdit = computed(() => hargaModalEdit.value + (parseFloat(formEdit.margin_modal) || 0));
    async function muatOpsiJenisEdit() {
      opsiJenisEdit.value = window.ambilMasterList ? await window.ambilMasterList(kategoriMasterData(formEdit.kategori_utama)) : [];
    }
    watch(() => formEdit.kategori_utama, () => { if (sedangEditId.value) muatOpsiJenisEdit(); });

    const konversiEdit = useKonversiBerjenjang(formEdit);

    function bukaEdit(item) {
      sedangEditId.value = item.id;
      Object.assign(formEdit, {
        kategori_utama: item.kategori_utama || '', jenis: item.jenis || '', foto: item.foto || '',
        nama: item.nama || '', warna: item.warna || '', harga_pembelian: item.harga_pembelian || '',
        satuan_pembelian: item.satuan_pembelian || '', isi_konversi_pembelian: item.isi_konversi_pembelian || '',
        satuan_pemakaian: item.satuan_pemakaian || '', margin_modal: item.margin_modal ?? '',
        konversi_bertingkat: item.konversi_bertingkat || []
      });
      muatOpsiJenisEdit();
      muatOpsiSatuanWarnaEdit();
    }
    function batalEdit() { sedangEditId.value = null; }

    function pilihFotoEdit(event) {
      const file = event.target.files[0];
      if (!file) return;
      kompresGambarBahan(file, 500, 0.65)
        .then(dataUrl => { formEdit.foto = dataUrl; })
        .catch(e => { console.error('Gagal proses foto:', e); alert('Gagal memproses foto, coba foto lain.'); });
    }

    async function simpanEdit() {
      if (!formEdit.jenis || !formEdit.nama.trim() || !formEdit.warna.trim() || !(parseFloat(formEdit.harga_pembelian) > 0) ||
          !formEdit.satuan_pembelian.trim() || !(parseFloat(formEdit.isi_konversi_pembelian) > 0) || !formEdit.satuan_pemakaian.trim() ||
          formEdit.margin_modal === '' || formEdit.margin_modal === null) {
        alert('Lengkapi semua field wajib dulu.');
        return;
      }
      menyimpanEdit.value = true;
      try {
        // CATATAN: id_tampil, kategori_utama, dan dibuat_pada SENGAJA TIDAK
        // ikut diupdate di sini — ID & kategori yang menentukan prefix ID
        // tidak boleh berubah setelah dibuat (kalau kategorinya salah pilih,
        // lebih aman hapus & entry ulang daripada ID jadi tidak konsisten
        // dengan prefix kategori aslinya).
        await updateDoc(doc(db, 'master_bahan_aksesoris', sedangEditId.value), {
          jenis: formEdit.jenis, foto: formEdit.foto || null, nama: formEdit.nama.trim(), warna: formEdit.warna.trim(),
          harga_pembelian: parseFloat(formEdit.harga_pembelian) || 0, satuan_pembelian: formEdit.satuan_pembelian.trim(),
          isi_konversi_pembelian: parseFloat(formEdit.isi_konversi_pembelian) || 0, satuan_pemakaian: formEdit.satuan_pemakaian.trim(),
          harga_modal: hargaModalEdit.value, margin_modal: parseFloat(formEdit.margin_modal) || 0, harga_pemakaian: hargaPemakaianEdit.value,
          konversi_bertingkat: formEdit.konversi_bertingkat || [],
          diedit_pada: serverTimestamp(), diedit_oleh: window.currentUser?.email || null
        });
        sedangEditId.value = null;
        await paginasi.muatUlang();
      } catch (e) {
        console.error('Gagal simpan edit Bahan/Aksesoris:', e);
        alert('Gagal menyimpan perubahan. Coba lagi.');
      }
      menyimpanEdit.value = false;
    }

    async function hapus(id) {
      if (!confirm('Hapus data ini secara permanen? Nomor ID yang sudah terpakai TIDAK akan dipakai ulang.')) return;
      try {
        await deleteDoc(doc(db, 'master_bahan_aksesoris', id));
        await paginasi.muatUlang();
      } catch (e) {
        console.error('Gagal hapus Bahan/Aksesoris:', e);
        alert('Gagal menghapus data.');
      }
    }

    onMounted(async () => { await window.authReady; await paginasi.muatUlang(); });

    return {
      filterKategori, paginasi, formatRupiah,
      sedangEditId, formEdit, opsiJenisEdit, opsiSatuanEdit, opsiWarnaEdit, menyimpanEdit, hargaModalEdit, hargaPemakaianEdit,
      bukaEdit, batalEdit, pilihFotoEdit, simpanEdit, hapus,
      tampilPopupKonversiEdit: konversiEdit.tampilPopupKonversi, barisKonversiEdit: konversiEdit.barisKonversi,
      bukaPopupKonversiEdit: konversiEdit.bukaPopupKonversi, tutupPopupKonversiEdit: konversiEdit.tutupPopupKonversi,
      tambahBarisKonversiEdit: konversiEdit.tambahBarisKonversi, hapusBarisKonversiEdit: konversiEdit.hapusBarisKonversi,
      totalKonversiBerjenjangEdit: konversiEdit.totalKonversiBerjenjang, terapkanKonversiEdit: konversiEdit.terapkanKonversi
    };
  },
  template: `
    <div style="display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap:wrap;">
      <div style="position:relative; flex:1; min-width:220px;">
        <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
        <input :value="paginasi.cariTeks.value" @input="paginasi.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari nama (awalan)..." style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
      </div>
      <select v-model="filterKategori" style="padding:9px 13px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
        <option value="ALL">Semua Kategori</option>
        <option value="Bahan">Bahan</option>
        <option value="Aksesoris">Aksesoris</option>
      </select>
    </div>

    <div class="gc-card" style="padding:0; overflow:hidden;">
      <div v-if="paginasi.memuat.value" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="paginasi.errorPaginasi.value" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasi.errorPaginasi.value }}</div>
      <div v-else-if="paginasi.dataHalaman.value.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada data.</div>
      <div v-else class="gc-table-scroll">
        <table class="gc-table">
          <thead>
            <tr>
              <th>ID / Tanggal</th><th>Kategori / Jenis</th><th>Foto</th><th>Nama / Warna</th>
              <th>Beli</th><th>Konversi</th><th>Pakai</th><th>Modal</th><th>Margin</th><th>Harga Pakai</th>
              <th class="freeze freeze-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in paginasi.dataHalaman.value" :key="item.id">
              <tr>
                <td><b>{{ item.id_tampil || '-' }}</b><br><span class="gc-cell-muted">{{ item.dibuat_pada?.toDate ? item.dibuat_pada.toDate().toLocaleDateString('id-ID') : '-' }}</span></td>
                <td>{{ item.kategori_utama }}<br><span class="gc-cell-muted">{{ item.jenis }}</span></td>
                <td><img v-if="item.foto" :src="item.foto" style="width:36px; height:36px; object-fit:cover; border-radius:6px;"><span v-else class="gc-cell-muted">-</span></td>
                <td><b>{{ item.nama }}</b><br><span class="gc-cell-muted">{{ item.warna }}</span></td>
                <td>{{ formatRupiah(item.harga_pembelian) }}<br><span class="gc-cell-muted">/ {{ item.satuan_pembelian }}</span></td>
                <td>{{ item.isi_konversi_pembelian }}</td>
                <td>{{ item.satuan_pemakaian }}</td>
                <td>{{ formatRupiah(item.harga_modal) }}</td>
                <td>{{ formatRupiah(item.margin_modal) }}</td>
                <td><b>{{ formatRupiah(item.harga_pemakaian) }}</b></td>
                <td class="freeze freeze-right">
                  <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                    <button @click="bukaEdit(item)" class="icon-btn" title="Edit"><i class="fas fa-pen"></i></button>
                    <button @click="hapus(item.id)" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
    <div v-if="!paginasi.memuat.value && paginasi.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
      <button class="icon-btn" :disabled="paginasi.nomorHalaman.value <= 1" @click="paginasi.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
      <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasi.nomorHalaman.value }}</span>
      <button class="icon-btn" :disabled="!paginasi.adaBerikutnya.value" @click="paginasi.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
    </div>

    <div v-if="sedangEditId" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="batalEdit">
      <div class="gc-card" style="max-width:560px; width:100%; max-height:90vh; overflow-y:auto;">
        <h3 style="font-weight:700; font-size:14px; margin-bottom:14px;">Edit Bahan / Aksesoris</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;" class="grid-cols-1 md:grid-cols-2">
          <div class="gc-field">
            <label>Jenis</label>
            <dropdown-cari v-model="formEdit.jenis" :opsi="opsiJenisEdit" placeholder="Cari & pilih Jenis..." />
          </div>
          <div class="gc-field"><label>Nama</label><input v-model="formEdit.nama" type="text"></div>
          <div class="gc-field"><label>Warna</label><dropdown-cari v-model="formEdit.warna" :opsi="opsiWarnaEdit" placeholder="Cari & pilih Warna..." /></div>
          <div class="gc-field"><label>Foto</label><input type="file" accept="image/*" @change="pilihFotoEdit"></div>
        </div>
        <div v-if="formEdit.foto" style="margin-bottom:12px;"><img :src="formEdit.foto" style="width:70px; height:70px; object-fit:cover; border-radius:10px; border:1.5px solid var(--line);"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;" class="grid-cols-1 md:grid-cols-2">
          <div class="gc-field"><label>Harga Pembelian (Rp)</label><input v-model.number="formEdit.harga_pembelian" type="number" min="0"></div>
          <div class="gc-field"><label>Satuan Pembelian</label><dropdown-cari v-model="formEdit.satuan_pembelian" :opsi="opsiSatuanEdit" placeholder="Cari & pilih Satuan..." /></div>
          <div class="gc-field" style="grid-column:1/-1;">
            <label>Isi Konversi Pembelian</label>
            <div style="display:flex; gap:8px;">
              <input v-model.number="formEdit.isi_konversi_pembelian" type="number" min="0" style="flex:1;">
              <button @click="bukaPopupKonversiEdit" class="btn-outline" style="white-space:nowrap; font-size:11.5px; padding:0 14px;"><i class="fas fa-calculator" style="margin-right:5px;"></i>Konversi Berjenjang</button>
            </div>
          </div>
          <div class="gc-field"><label>Satuan Pemakaian</label><dropdown-cari v-model="formEdit.satuan_pemakaian" :opsi="opsiSatuanEdit" placeholder="Cari & pilih Satuan..." /></div>
          <div class="gc-field"><label>Margin Modal (Rp)</label><input v-model.number="formEdit.margin_modal" type="number" min="0"></div>
        </div>
        <div style="background:var(--ivory-dim); border-radius:12px; padding:12px 16px; display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
          <div><span style="font-size:10.5px; color:var(--text-faint); display:block;">Harga Modal (otomatis)</span><b>{{ formatRupiah(hargaModalEdit) }}</b></div>
          <div><span style="font-size:10.5px; color:var(--text-faint); display:block;">Harga Pemakaian (otomatis)</span><b style="color:var(--burgundy);">{{ formatRupiah(hargaPemakaianEdit) }}</b></div>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="simpanEdit" :disabled="menyimpanEdit" class="btn-primary" style="flex:1;">{{ menyimpanEdit ? 'Menyimpan...' : 'Simpan Perubahan' }}</button>
          <button @click="batalEdit" class="btn-outline" style="flex:1;">Batal</button>
        </div>
      </div>
    </div>
    <popup-konversi-berjenjang v-if="tampilPopupKonversiEdit" :baris="barisKonversiEdit" :total="totalKonversiBerjenjangEdit"
      @tambah="tambahBarisKonversiEdit" @hapus="hapusBarisKonversiEdit" @terapkan="terapkanKonversiEdit" @tutup="tutupPopupKonversiEdit" />
  `
};

const AppBahanAksesorisEntry = { components: { BahanAksesorisEntryManager }, template: `<bahan-aksesoris-entry-manager />` };
let vmBahanAksesorisEntry = null;
window.pastikanMountBahanAksesorisEntry = function() {
  if (vmBahanAksesorisEntry) return;
  const mountPoint = document.getElementById('vue-bahan-aksesoris-entry');
  if (mountPoint) vmBahanAksesorisEntry = createApp(AppBahanAksesorisEntry).mount('#vue-bahan-aksesoris-entry');
};

const AppBahanAksesorisList = { components: { BahanAksesorisListManager }, template: `<bahan-aksesoris-list-manager />` };
let vmBahanAksesorisList = null;
window.pastikanMountBahanAksesorisList = function() {
  if (vmBahanAksesorisList) return;
  const mountPoint = document.getElementById('vue-bahan-aksesoris-list');
  if (mountPoint) vmBahanAksesorisList = createApp(AppBahanAksesorisList).mount('#vue-bahan-aksesoris-list');
};
