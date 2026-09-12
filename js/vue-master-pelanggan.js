// js/vue-master-pelanggan.js
// ============================================================================
// Zevanic House > Master Pelanggan — menu BARU TOTAL (5 Sep 2026, wireframe
// handoff "Zevanic House.dc.html" grup 3 + `RENCANA-REKONSTRUKSI-2026-09.md`
// §6 langkah 4). Koleksi BARU `master_pelanggan` — TIDAK ADA satupun sisa
// modul lama yang dipindah/diganti di sini (beda dari Master Suplayer §5.12
// yang gabungan 2 tempat lama), jadi file ini SEMUANYA baru.
//
// Latar: Guru minta lanjut rekonstruksi besar sesuai urutan disarankan di
// `RENCANA-REKONSTRUKSI-2026-09.md` §6 — langkah 1 (push+uji Bahan/Acc) itu
// tugas Guru sendiri, langkah 2 (Publish rules) sudah selesai (Guru paste
// firestore.rules lengkap, dikonfirmasi 5 Sep 2026 — lihat STATUS-PROYEK.md
// §5.13). Langkah 3 (Infrastruktur PIN sungguhan) SENGAJA DILEWATI dulu atas
// pilihan eksplisit Guru (AskUserQuestion: "Lewati PIN dulu, lanjut langkah
// 4") — alasan: hash PIN yang aman butuh Cloud Function di repo TERPISAH
// (`zevanic-cloud-function`, Claude TIDAK punya akses baca/edit ke situ,
// lihat `PETA-INFRASTRUKTUR.md`), jadi ditunda sampai ada modul yang BENAR2
// butuh (Persiapan Belanja/Pesanan piutang, langkah 11-12).
//
// Langkah 4 sendiri (`RENCANA-REKONSTRUKSI-2026-09.md` §6): "Master Pelanggan
// + Master Suplayer (rebuild)". Master Suplayer REBUILD-nya SUDAH SELESAI
// duluan di §5.12 (lihat js/vue-master-suplayer.js — Entry+List/Alias & MOQ/
// Petakan Order, sudah dikirim ke folder Code, menunggu push+uji Guru) —
// JADI file ini HANYA mengerjakan sisa langkah 4 yang benar-benar belum ada:
// Master Pelanggan.
//
// Skema field mengikuti `Mockup/handoff/SPESIFIKASI-KOLEKSI-BARU.md` §1
// (master_pelanggan/{autoId}) PERSIS: nama*, telepon, alamat, email, tipe
// (retail/reseller/grosir), limit_piutang, saldo_piutang, catatan.
//
// **`saldo_piutang` SENGAJA TIDAK BISA diedit lewat form ini** (dibiarkan 0
// pas dibuat, TIDAK PERNAH ditulis ulang manual di sini) — spek eksplisit
// bilang "Dihitung: total sisa belum bayar. JANGAN tulis langsung — update
// lewat fungsi catat pembayaran". Fungsi catat pembayaran itu ADALAH bagian
// dari koleksi `piutang_pembayaran` + fitur Pesanan piutang, yang masuk
// langkah 12 (BELUM dikerjakan sesi ini) — jadi utang tiap pelanggan di
// modul ini akan tampil 0 terus sampai langkah 12 jadi, itu memang benar
// SEMENTARA, bukan bug.
//
// **TIDAK termasuk sesi ini** (di luar scope "data dasar" langkah 4):
// - Kasir (`js/vue-pesanan.js`) BELUM diubah untuk WAJIB pilih pelanggan
//   sebelum checkout — itu bagian langkah 12 (Pesanan piutang), butuh
//   `transaksi_kasir.pelanggan_id` dkk yang belum ada. Kolom `master_
//   pelanggan` di sini disiapkan berdiri sendiri dulu, siap dipakai nanti.
// - `transaksi_kasir.nama_pelanggan` (string bebas, sudah ada sejak fitur
//   Pesanan 30 Agt 2026) TIDAK diganti FK `pelanggan_id` di sini — itu juga
//   langkah 12.
// - Field `tipe` (retail/reseller/grosir) murni informasional di form ini —
//   spek sendiri menandai "Yang Belum Diputuskan: apakah tipe punya limit
//   piutang beda otomatis" — TIDAK ditebak, `limit_piutang` tetap manual
//   polos per pelanggan, tidak auto-terisi dari `tipe`.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// BARU (9 Sep 2026 malam, keputusan eksplisit Guru: "iyah kerjakan sesuai
// wireframe") — 2 kolom yang tadinya sengaja dilewati (lihat catatan
// RESTRUKTURISASI di template di bawah): "total pesanan" (dihitung LIVE
// dari transaksi_kasir, BUKAN field tersimpan — sesuai wireframe 4.1) dan
// "status aktif/nonaktif" (field BARU `status` di master_pelanggan, TIDAK
// ada sebelumnya — default 'aktif' kalau kosong/dokumen lama). Dihitung
// SEKALI (satu query ambil semua transaksi_kasir, dikelompokkan di sisi
// klien) — BUKAN 1 query per pelanggan, supaya List Pelanggan tidak
// melambat kalau jumlah pelanggan banyak.
async function ambilTotalPesananPerPelanggan() {
  const peta = new Map();
  try {
    const snap = await getDocs(collection(db, 'transaksi_kasir'));
    snap.forEach(d => {
      const t = d.data();
      if (!t.pelanggan_id) return;
      const cur = peta.get(t.pelanggan_id) || { jumlah: 0, total: 0 };
      cur.jumlah += 1;
      cur.total += parseFloat(t.total) || 0;
      peta.set(t.pelanggan_id, cur);
    });
  } catch (e) { console.error('Gagal hitung total pesanan per pelanggan:', e); }
  return peta;
}

// formatRupiah — disalin persis dari pola yang sama di js/vue-master-
// suplayer.js/vue-master-produk.js dkk (tiap file vue-*.js di proyek ini
// punya salinan lokalnya sendiri, tidak ada util currency global).
function formatRupiah(n) {
  const angka = parseFloat(n) || 0;
  return 'Rp ' + Math.round(angka).toLocaleString('id-ID');
}

const LABEL_TIPE = { retail: 'Retail', reseller: 'Reseller', grosir: 'Grosir' };
function labelTipe(t) { return LABEL_TIPE[t] || 'Retail'; }
const KELAS_TAG_TIPE = { retail: 'tag neutral', reseller: 'tag blue', grosir: 'tag pink' };
function kelasTagTipe(t) { return KELAS_TAG_TIPE[t] || 'tag neutral'; }

async function ambilDaftarPelanggan() {
  try {
    const snap = await getDocs(collection(db, 'master_pelanggan'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    return list;
  } catch (e) {
    console.error('Gagal ambil daftar Pelanggan:', e);
    return [];
  }
}

// ============================================================================
// 3.1 + 3.2 — List Pelanggan (kartu per pelanggan, saldo piutang) + Form
// pop up entry/edit (wireframe: "Form pelanggan — pop up entry/edit", BEDA
// dari pola Master Suplayer yang tambahnya inline — di sini SEMUA lewat 1
// popup yang sama, mode `tambah`/`edit` dibedakan lewat popupForm.mode).
// ============================================================================
const MasterPelangganManager = {
  setup() {
    const menuId = 'master_pelanggan';
    const bolehTambah = computed(() => window.cekIzinMenu(menuId, 'add') !== false);
    const bolehEdit = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu(menuId, 'delete') !== false);

    const memuat = ref(true);
    const daftar = ref([]);
    const petaPesanan = ref(new Map());
    const cari = ref('');
    const menyimpan = ref(false);
    const popupForm = ref(null); // { mode, id?, nama, telepon, alamat, email, tipe, limitPiutang, catatan, saldo_piutang, status }

    async function muat() {
      memuat.value = true;
      const [pelanggan, petaTx] = await Promise.all([ambilDaftarPelanggan(), ambilTotalPesananPerPelanggan()]);
      daftar.value = pelanggan;
      petaPesanan.value = petaTx;
      memuat.value = false;
    }
    function totalPesanan(p) { return (petaPesanan.value.get(p.id) || { total: 0 }).total; }
    function jumlahPesanan(p) { return (petaPesanan.value.get(p.id) || { jumlah: 0 }).jumlah; }
    function statusAktif(p) { return p.status !== 'nonaktif'; } // default aktif kalau field belum ada (dokumen lama)

    const daftarTampil = computed(() => {
      const kata = cari.value.trim().toLowerCase();
      let hasil = daftar.value.filter(p =>
        (p.nama || '').toLowerCase().includes(kata) ||
        (p.telepon || '').toLowerCase().includes(kata)
      );
      // Nonaktif ditampilkan abu DI BAWAH (wireframe 4.1) — bukan
      // disembunyikan, cuma diurutkan ke akhir + kelas visual beda.
      return [...hasil].sort((a, b) => {
        const aa = statusAktif(a) ? 0 : 1, bb = statusAktif(b) ? 0 : 1;
        if (aa !== bb) return aa - bb;
        return (a.nama || '').localeCompare(b.nama || '');
      });
    });

    function sudahAda(nama, kecualiId) {
      return daftar.value.some(p => p.id !== kecualiId && (p.nama || '').trim().toLowerCase() === nama.trim().toLowerCase());
    }

    function bukaTambah() {
      if (!bolehTambah.value) return alert('Anda tidak punya izin menambah di sini. Hubungi Owner/PIC.');
      popupForm.value = { mode: 'tambah', nama: '', telepon: '', alamat: '', email: '', tipe: 'retail', limitPiutang: '', catatan: '', saldo_piutang: 0, status: 'aktif' };
    }
    function bukaEdit(p) {
      if (!bolehEdit.value) return;
      popupForm.value = {
        mode: 'edit', id: p.id,
        nama: p.nama || '', telepon: p.telepon || '', alamat: p.alamat || '', email: p.email || '',
        tipe: p.tipe || 'retail', limitPiutang: p.limit_piutang || '', catatan: p.catatan || '',
        saldo_piutang: p.saldo_piutang || 0, status: p.status || 'aktif'
      };
    }
    function tutupPopup() { popupForm.value = null; }

    async function simpanPopup() {
      const f = popupForm.value;
      if (!f) return;
      const nama = f.nama.trim();
      if (!nama) return alert('Nama Pelanggan wajib diisi.');
      if (sudahAda(nama, f.id)) return alert('Nama Pelanggan ini sudah ada.');
      menyimpan.value = true;
      try {
        const payload = {
          nama,
          telepon: f.telepon.trim(),
          alamat: f.alamat.trim(),
          email: f.email.trim(),
          tipe: f.tipe || 'retail',
          status: f.status || 'aktif',
          limit_piutang: parseFloat(f.limitPiutang) || 0,
          catatan: f.catatan.trim()
        };
        if (f.mode === 'edit') {
          // saldo_piutang SENGAJA TIDAK ikut payload update — lihat catatan
          // panjang di atas file ini, field ini bukan urusan form ini sama
          // sekali (baik simpan baru maupun edit).
          await updateDoc(doc(db, 'master_pelanggan', f.id), payload);
        } else {
          payload.saldo_piutang = 0;
          payload.dibuat_pada = serverTimestamp();
          payload.dibuat_oleh = window.currentUser?.email || null;
          await addDoc(collection(db, 'master_pelanggan'), payload);
        }
        popupForm.value = null;
        await muat();
      } catch (e) { console.error('Gagal simpan Pelanggan:', e); alert('Gagal menyimpan.'); }
      menyimpan.value = false;
    }

    async function hapus(p) {
      if (!bolehHapus.value) return alert('Anda tidak punya izin menghapus di sini. Hubungi Owner/PIC.');
      // Guard jaga-jaga (belum ada penulis piutang_pembayaran sesi ini, jadi
      // saldo_piutang SELALU 0 untuk sekarang) — begitu langkah 12 (Pesanan
      // piutang) jadi & mulai ada saldo berjalan, penghapusan pelanggan yang
      // masih berutang harus ditolak supaya riwayat piutang tidak yatim.
      if ((p.saldo_piutang || 0) > 0) return alert(`Pelanggan "${p.nama}" masih punya saldo piutang berjalan (${formatRupiah(p.saldo_piutang)}) — lunasi dulu sebelum dihapus.`);
      if (!confirm(`Hapus Pelanggan "${p.nama}"?`)) return;
      try { await deleteDoc(doc(db, 'master_pelanggan', p.id)); await muat(); }
      catch (e) { console.error('Gagal hapus Pelanggan:', e); alert('Gagal menghapus.'); }
    }

    onMounted(async () => { await window.authReady; await muat(); });
    return {
      memuat, daftarTampil, cari, menyimpan, popupForm,
      bolehTambah, bolehEdit, bolehHapus,
      bukaTambah, bukaEdit, tutupPopup, simpanPopup, hapus,
      labelTipe, kelasTagTipe, formatRupiah, totalPesanan, jumlahPesanan, statusAktif
    };
  },
  template: `
    <div class="gc-card gc-card-menonjol" style="padding:16px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:4px; flex-wrap:wrap;">
        <div>
          <h3 class="gc-heading" style="font-weight:700; font-size:15px; margin-bottom:4px;"><i class="fas fa-address-book" style="color:var(--burgundy); margin-right:8px;"></i>Master Pelanggan</h3>
          <p style="font-size:11.5px; color:var(--text-faint); margin:0;">Data pelanggan &amp; saldo piutang — dipakai Penjualan Kasir &amp; Daftar Piutang (menyusul, belum aktif).</p>
        </div>
        <button v-if="bolehTambah" @click="bukaTambah" class="btn-primary" style="padding:9px 16px; flex-shrink:0;"><i class="fas fa-plus" style="margin-right:6px;"></i>Tambah Pelanggan</button>
      </div>

      <div style="display:flex; align-items:center; gap:9px; background:var(--ivory-dim); border:1px solid var(--line); border-radius:999px; padding:9px 13px; margin:14px 0 12px;">
        <i class="fas fa-magnifying-glass" style="font-size:14px; color:var(--text-faint);"></i>
        <input v-model="cari" type="text" placeholder="Cari nama/telepon..." style="flex:1; border:none; outline:none; background:none; font-size:12px;">
      </div>

      <div v-if="memuat" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="daftarTampil.length === 0" class="gc-kosong">
        <div class="lingkaran"><i class="fas fa-address-book"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada Pelanggan</h3>
      </div>
      <!-- RESTRUKTURISASI (9 Sep 2026, audit wireframe §4.1) — dulu grid
           kartu (auto-fill 260px) + tombol Edit/Hapus eksplisit per kartu.
           Wireframe minta SATU TABEL, klik baris untuk edit. Pakai class
           .gc-table yang SUDAH ADA di css/gechoo-design.css (dipakai juga
           modul lain, mis. Stock & Pembelian) — bukan style baru. Tombol
           Edit terpisah DIHAPUS — klik baris manapun langsung buka form
           edit (sama seperti bukaEdit() yang sudah ada, cuma pemicunya
           pindah).
           REVISI (9 Sep 2026 malam, keputusan Guru: "iyah kerjakan sesuai
           wireframe") — kolom "Total Pesanan" (dihitung live dari
           transaksi_kasir, lihat ambilTotalPesananPerPelanggan di atas
           file) dan "Status" (field BARU "status" di master_pelanggan)
           ditambahkan. Pelanggan nonaktif ditampilkan abu di baris
           (diurutkan ke bawah oleh daftarTampil, bukan disembunyikan). -->
      <div v-else class="gc-table-scroll">
        <table class="gc-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Telepon</th>
              <th>Alamat</th>
              <th>Tipe</th>
              <th style="text-align:right;">Total Pesanan</th>
              <th style="text-align:right;">Limit Piutang</th>
              <th style="text-align:right;">Saldo Piutang</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in daftarTampil" :key="p.id" @click="bukaEdit(p)" :style="{cursor: bolehEdit ? 'pointer' : 'default', opacity: statusAktif(p) ? 1 : .55}">
              <td><b>{{ p.nama }}</b></td>
              <td class="gc-cell-muted">{{ p.telepon || '-' }}</td>
              <td class="gc-cell-muted" style="white-space:normal; max-width:220px;">{{ p.alamat || '-' }}</td>
              <td><span :class="kelasTagTipe(p.tipe)" style="font-size:10.5px;">{{ labelTipe(p.tipe) }}</span></td>
              <td class="gc-num" style="text-align:right;">{{ formatRupiah(totalPesanan(p)) }}<div style="font-size:9.5px; color:var(--text-faint); font-weight:400;">{{ jumlahPesanan(p) }}x</div></td>
              <td class="gc-num" style="text-align:right; font-weight:600;">{{ formatRupiah(p.limit_piutang) }}</td>
              <td class="gc-num" style="text-align:right;" :style="{fontWeight:700, color: (p.saldo_piutang||0) > 0 ? 'var(--danger)' : 'inherit'}">{{ formatRupiah(p.saldo_piutang) }}</td>
              <td><span class="tag" :class="statusAktif(p) ? 'ok' : 'neutral'" style="font-size:10px;">{{ statusAktif(p) ? 'Aktif' : 'Nonaktif' }}</span></td>
              <td style="text-align:right;">
                <button v-if="bolehHapus" @click.stop="hapus(p)" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="popupForm" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="tutupPopup">
      <div class="gc-card" style="max-width:420px; width:100%; padding:18px; max-height:90vh; overflow-y:auto;">
        <h3 class="gc-heading" style="font-weight:700; font-size:14px; margin-bottom:12px;">{{ popupForm.mode === 'edit' ? 'Edit Pelanggan' : 'Tambah Pelanggan' }}</h3>
        <div class="gc-field"><label>Nama Pelanggan *</label><input v-model="popupForm.nama" type="text" placeholder="Nama lengkap/toko"></div>
        <div class="gc-field"><label>Telepon</label><input v-model="popupForm.telepon" type="text" placeholder="08..."></div>
        <div class="gc-field"><label>Alamat</label><input v-model="popupForm.alamat" type="text" placeholder="Alamat pengiriman"></div>
        <div class="gc-field"><label>Email</label><input v-model="popupForm.email" type="email" placeholder="nama@email.com"></div>
        <div class="gc-field">
          <label>Tipe</label>
          <select v-model="popupForm.tipe">
            <option value="retail">Retail</option>
            <option value="reseller">Reseller</option>
            <option value="grosir">Grosir</option>
          </select>
        </div>
        <div class="gc-field"><label>Limit Piutang <span style="font-weight:400; color:var(--text-faint);">(0 = tidak boleh piutang)</span></label><input v-model.number="popupForm.limitPiutang" type="number" min="0" placeholder="0"></div>
        <!-- BARU (9 Sep 2026 malam, keputusan eksplisit Guru: "iyah kerjakan
             sesuai wireframe") — toggle Status di sini adalah SATU-SATUNYA
             tempat popupForm.status bisa diubah user (sebelumnya cuma
             ditampilkan di tabel, belum ada kontrolnya). Hanya muncul saat
             edit — pelanggan baru selalu mulai 'aktif' (lihat bukaTambah). -->
        <div v-if="popupForm.mode === 'edit'" class="gc-field">
          <label>Status</label>
          <select v-model="popupForm.status">
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
        </div>
        <div v-if="popupForm.mode === 'edit'" class="gc-field">
          <label>Saldo Piutang <span style="font-weight:400; color:var(--text-faint);">(otomatis, belum aktif)</span></label>
          <input :value="formatRupiah(popupForm.saldo_piutang)" type="text" readonly style="background:var(--ivory-dim); color:var(--text-muted); cursor:not-allowed;">
        </div>
        <div class="gc-field"><label>Catatan</label><textarea v-model="popupForm.catatan" rows="2" placeholder="Opsional"></textarea></div>
        <div style="display:flex; gap:8px; margin-top:6px;">
          <button @click="simpanPopup" :disabled="menyimpan" class="btn-primary" style="flex:1;">Simpan</button>
          <button @click="tutupPopup" class="btn-outline" style="flex:1;">Batal</button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// Mount — lazy, dipanggil dashboard.js pindahSubTab() (pola sama semua
// child-tab lain di app ini). Single-view (tidak ada sub-tab di dalamnya,
// sama seperti Persiapan Masalah), jadi cuma 1 fungsi mount.
// ============================================================================
let vmMasterPelanggan = null;
window.pastikanMountMasterPelanggan = function () {
  if (vmMasterPelanggan) return;
  if (document.getElementById('vue-master-pelanggan')) vmMasterPelanggan = createApp(MasterPelangganManager).mount('#vue-master-pelanggan');
};
