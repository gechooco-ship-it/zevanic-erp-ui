// js/vue-pesanan.js
// ============================================================================
// Pesanan — grup top-level (30 Agt 2026), sejajar Zevanic House/Persiapan
// Produksi. Lihat riwayat lengkap fitur Kasir/Menunggu Proses versi lama di
// STATUS-PROYEK.md §5 (30 Agt) dan §5.14 (7 Sep, guard harga_perlu_konfirmasi).
//
// ============================================================================
// REKONSTRUKSI BESAR (7 Sep 2026) — handoff wireframe Guru, folder Mockup/
// handoff/01 - Pesanan dan Transaksi/. GANTI TOTAL 3 sub-menu ringkasan lama
// (Proses Persiapan/Produksi/Pengiriman, baca-saja, "ditarik dari Persiapan
// Produksi") jadi 2 sub-menu baru: "Daftar Pesanan" (3.1/3.2/3.2.1, pipeline
// per pelanggan) dan "Transaksi Keuangan" (4.1/4.1.1/4.2.1/4.2.2, piutang
// BARU TOTAL). Penjualan Kasir (1.1/1.2) dan Menunggu Proses (2.1/2.2) DITULIS
// ULANG ISINYA (bukan cuma ditambah) — Menunggu Proses BUKAN LAGI form CRUD
// SPK manual (fungsi itu DIHAPUS, sesuai wireframe: layar ini eksklusif
// keputusan QO Owner/PIC Owner, tidak ada tombol tambah/edit/hapus/cetak
// manual lagi di sini).
//
// KEPUTUSAN GURU (AskUserQuestion, 2 ronde + 1 ronde susulan sesudah temuan
// kontradiksi di kode live — SEMUA dijawab eksplisit SEBELUM baris kode di
// bawah ditulis, sesuai wajib skill design-terapkan-handoff):
//   D1. Katalog Kasir (1.1) — TIDAK disambungkan ke scan QR label pcs / Stok
//       Gudang Barang Jadi (itu wewenang modul Proses Produksi yang belum
//       dibangun, walau screenshot 05 & PEDOMAN aturan #3b/#9 menyinggungnya).
//       Kasir 30 Agt 2026 (katalog dari master_produk, tidak ada Stok Gudang)
//       DIPERTAHANKAN APA ADANYA — cuma disiapkan supaya gampang disambung
//       nanti (lihat catatan "HOOK MASA DEPAN" di bawah).
//   D2. Format `no_transaksi` — DIPERTAHANKAN (TRX{yymmdd}{counter harian}),
//       BUKAN diganti format wireframe (TRX-DDMM-{counter global}) — supaya
//       tidak breaking change ke `pengaturan_id_transaksi_kasir` yang sudah
//       berjalan.
//   D3. Tombol "Proses" massal di Menunggu Proses (2.1) — SETELAH ditemukan
//       `order_spk.status_grouping` ternyata field HIDUP milik mesin grouping
//       Persiapan Produksi (diisi OTOMATIS oleh layar Perlu Disiapkan, nilai
//       ''/'sebagian'/'tergrouping', dibarengi qty_tergrouping & grouping_ids)
//       — Guru SETUJU: tombol Proses di sini HANYA mengubah `order_spk.
//       qty_order` dari RO jadi QO terpilih. `status_grouping` TIDAK PERNAH
//       disentuh dari file ini, tetap 100% milik Persiapan Produksi.
//   D4. PIN "Catat pembayaran" (4.1.1) DAN PIN "Proses massal" (2.1, sesuai
//       label wireframe "Aksi utama: Proses massal (PIN Owner/PIC Owner)") —
//       SELALU wajib PopupPin, TERMASUK kalau yang login sudah Owner sendiri
//       (beda dari pola sayaOwnerKeAtas-skip di vue-stock-pembelian.js).
//   D5. Algoritma kotak QO (2.1) — "4 kelipatan pertama yang >= RO", BUKAN
//       "2 di bawah + 2 di atas titik tengah" (data contoh di wireframe
//       sendiri tidak konsisten antar baris, Guru pilih versi paling
//       sederhana & sesuai 2 dari 3 baris contohnya).
//   D6. Cicilan — BUKAN metode checkout terpisah dengan jadwal otomatis N
//       bulan (wireframe 1.2 sendiri cuma menggambar 3 status bayar: Lunas/
//       DP/Tempo). "Cicilan" adalah status_bayar yang MUNCUL SENDIRI begitu
//       ada pembayaran susulan yang belum melunasi (lihat CATAT_PEMBAYARAN
//       di bawah) — BUKAN pilihan checkout. Guru: piutang dibatasi lewat
//       `master_pelanggan.limit_piutang` yang SUDAH ADA (bukan field/mesin
//       baru) — checkout DIBLOKIR TOTAL kalau (saldo_piutang berjalan + sisa
//       piutang transaksi baru) > limit_piutang pelanggan itu.
//   D7. `dp_persen` — DIHITUNG OTOMATIS dari nominal DP yang diketik kasir
//       (bukan diinput manual), dibagi total transaksi.
//
// KEPUTUSAN SUSULAN (9 Sep 2026, tindak lanjut audit handoff — 3 item §7
// "Yang Belum Diputuskan" dijawab lewat AskUserQuestion SEBELUM kode ditulis):
//   D8. Diskon (§7) — DIBANGUN, PER ITEM keranjang (bukan per transaksi).
//       Tiap baris punya `diskon_tipe` ('rp'|'persen') + `diskon_nilai`
//       (default 'rp'/0). Tipe Rp-vs-persen TIDAK ditanyakan eksplisit ke
//       Guru (pertanyaan cuma "per item atau per transaksi") — dibuat
//       toggle keduanya supaya kasir bebas pilih, bukan menebak salah satu.
//   D9. Denda keterlambatan cicilan (§7) — TIDAK dibangun (Guru pilih
//       "tetap tidak ada denda"). Tidak ada field/logic denda di file ini.
//   D10. Cetak struk (§7 "format apa") — DISAMBUNGKAN ke sistem Pengaturan
//       Cetak (`js/vue-pengaturan-cetak.js`, jenis `struk_kasir`, sudah ada
//       di KATALOG_CETAK sejak 8 Sep tapi belum ada pemanggilnya). Struk
//       TETAP pakai template khusus struk (`PopupPratinjauCetakStruk`,
//       bukan `PopupPratinjauCetakLabel`) karena bentuk kontennya beda total
//       (daftar item + total, bukan 1 kartu per label) — yang disambungkan
//       CUMA lebar kertas roll (`ambilPengaturanCetak('struk_kasir').
//       lebar_mm`, default 80mm kalau belum diatur Guru — sama dengan
//       DEFAULT_STRUK di vue-pengaturan-cetak.js). Cetak juga
//       DIPERBAIKI dari `window.print()` polos (yang sebelumnya mencetak
//       SELURUH halaman di belakang popup, bukan cuma struknya — tidak ada
//       CSS print sama sekali) jadi buka window baru + `@page{size:...}`,
//       pola SAMA seperti `cetakSekarang()` di `PopupPratinjauCetakLabel`
//       (vue-components.js) supaya konsisten satu proyek.
//
// PENYIMPANGAN/TAMBAHAN TEKNIS YANG BELUM PERNAH EKSPLISIT DIKONFIRMASI GURU
// (diputuskan sendiri di sini dengan alasan teknis murni, DIFLAG di
// STATUS-PROYEK.md & pesan laporan — bukan ditebak diam-diam, pola yang sama
// dipakai di komentar lama file ini untuk 3 hal serupa):
//   T1. `order_spk` dapat 3 field BARU yang TIDAK ada di SERAH-TERIMA.md:
//       `qo_diproses` (boolean, default false) + `qo_diproses_pada` +
//       `qo_oleh`. WAJIB ADA supaya baris yang sudah diputuskan QO-nya bisa
//       "keluar dari antrean Menunggu Proses" (wireframe §2.2: "Tombol Proses
//       ... hanya memindahkan baris keluar dari Menunggu Proses") — TANPA
//       field ini, tidak ada cara membedakan "baris belum diputus QO" dari
//       "baris sudah, tinggal nunggu digrouping" karena keduanya sama-sama
//       status_grouping kosong. Field MINIMAL, tidak mengubah/menyentuh
//       status_grouping sama sekali (lihat D3 di atas).
//   T2. `order_spk` juga dapat snapshot `pelanggan_id`, `pelanggan_nama`,
//       `transaksi_kasir_id`, `no_transaksi`, `status_bayar` — supaya
//       Menunggu Proses (kelompok per transaksi) dan Daftar Pesanan
//       (kelompok per pelanggan) tidak perlu query balik ke transaksi_kasir
//       satu-satu per baris (PRINSIP-HEMAT.md).
//   T3. Pipeline "Daftar Pesanan" (3.1) — SENGAJA DISEDERHANAKAN. Setelah
//       SPK digabung jadi satu SPK Grouping (klaster bisa berisi SPK dari
//       BEBERAPA pelanggan sekaligus kalau produk+pola sama), `spk_track`
//       melacak progres PER GROUPING PER JALUR, BUKAN per pelanggan asal —
//       tidak ada cara memecah balik "berapa pcs milik pelanggan X" dari
//       progres klaster campuran tanpa membangun mesin atribusi proporsional
//       baru (di luar lingkup handoff ini). Jadi kotak "menunggu persiapan"
//       (akurat, dihitung dari order_spk yang qo_diproses tapi belum
//       status_grouping) TETAP presisi, tapi 5 jalur Pipeline Persiapan
//       (Vendor/Bahan/Sewing/Webbing/Finishing) sesudah SPK masuk grouping
//       ditampilkan "—" dengan keterangan "cek detail per jalur di Persiapan
//       Produksi" — BUKAN angka yang dipaksakan presisi padahal sebenarnya
//       tebakan. "Pos sekarang" di 3.2 (rincian per anak SPK) & lini masa di
//       3.2.1 pakai pendekatan sama: jalur PALING AWAL yang belum 'selesai'
//       (urutan tetap vendor→bahan→sewing→webbing→finishing) dari spk_track
//       yang match ke `kode_spk_grouping` snapshot SPK itu.
//   T4. Cetak struk (1.2 "Selesai & Cetak") — belum ada infrastruktur
//       thermal-printer di proyek ini (beda dari cetak LABEL yang sudah
//       dikelola PopupPratinjauCetakLabel). Diimplementasi sebagai pratinjau
//       struk on-screen + `window.print()` browser biasa (bukan integrasi
//       printer kasir sungguhan) — cukup buat MVP, BUKAN diklaim setara
//       thermal print asli.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
// storageRef/uploadBytes/getDownloadURL — DISALIN dari js/vue-stock-pembelian.js
// (konvensi proyek: salin, jangan impor silang). Dipakai HANYA buat 1 hal baru
// (audit 9 Sep, poin 6): foto bukti transfer/QRIS di popup Catat Pembayaran
// (4.1.1) — TIDAK menyentuh perhitungan uang sama sekali, cuma lampiran.
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { db, storage } from "./firebase-config.js";
import { ambilSemuaProduk } from './vue-master-produk.js';
import { ambilPengaturanCetak } from './vue-pengaturan-cetak.js';

// ============================================================================
// SUSULAN AUDIT WIREFRAME (9 Sep 2026 malam) — Guru sudah setuju 6 poin di
// audit `wireframe.dc.html` vs kode live, dikerjakan sekali jalan tanpa
// menyentuh logic uang/Firestore (query/hitung total/simpan transaksi),
// HANYA render/susunan tampilan (kecuali poin 6, yang secara eksplisit minta
// field tangkapan BARU — bukan perhitungan — lihat catatan di titiknya):
//   S1. 1.1 — indikator STEPPER 2 langkah ("LangkahStepper" di bawah, dipakai
//       ulang di step 1 & 2) + blok pelanggan diubah dari <select> polos jadi
//       kotak "terkunci" ber-ikon 🔒 begitu pelanggan sudah dipilih dari
//       database (tombol "ubah" buat balik ke mode pilih). TIDAK mengubah
//       jadi 3-panel sejajar (sidebar di wireframe = chrome nav aplikasi, di
//       luar kendali file ini) — cuma 2 hal yang diminta eksplisit di poin
//       audit: stepper + kotak pelanggan.
//   S2. 1.2 — grid nominal cepat (Uang Pas + 5 pecahan umum) di dekat input
//       "Uang Diterima". ASUMSI: tombol pecahan (50rb/dst) MENAMBAH ke uang
//       diterima (bukan menimpa) — meniru cara kasir fisik menumpuk lembar
//       uang, beda dari pola "Lunasi semua" di popup 4.1.1 yang MENIMPA
//       (itu 1 keputusan nominal, bukan tumpukan lembar).
//   S3. 2.1 — kolom "jumlah order (Rp)" per baris (qty terpilih × harga
//       jual), keterangan "dari Rp X" (basis RO) HANYA muncul kalau angkanya
//       beda dari RO — sebelumnya cuma ada di footer sticky total.
//   S4. 3.2.1 — baris 5 kotak statistik + 3 tab (lini masa/kebutuhan bahan/
//       masalah) + timeline SATU KOLOM urut waktu (GANTI TOTAL dari daftar
//       kartu per jalur). ASUMSI: order_spk tidak punya timestamp "masuk
//       grouping" sendiri — `qo_diproses_pada` dipakai sebagai proxy titik
//       masuk "Perlu Disiapkan". "pernah tertahan" dihitung dari jumlah
//       spk_track grouping ini yang SAAT INI punya `catatan_masalah` terisi
//       (tidak ada log riwayat "pernah tertahan" terpisah — ini hitungan
//       kondisi sekarang, bukan akumulasi historis penuh). Tab "kebutuhan
//       bahan" cuma daftar NAMA bahan/aksesoris dari BOM produk (bukan
//       kuantitas presisi — rumus kelipatan/panjang/isi_pola_pcs itu logic
//       Persiapan Produksi di luar lingkup poin audit ini, menyalin mentah
//       berisiko salah hitung dan menyesatkan).
//   S5. 4.1/4.2.1/4.2.2 — GANTI dari 3 tab eksklusif jadi 1 halaman scroll
//       berurutan (Kas Besar → Rincian Transaksi → Rincian Piutang) dengan
//       filter pelanggan BERSAMA (ref baru `filterPelangganId`) yang mengalir
//       ke ketiga bagian, plus 3 pil navigasi cepat (anchor scroll, BUKAN tab
//       exclusive). Semua computed query/hitung total TIDAK disentuh — cuma
//       ditambah 1 syarat filter pelanggan_id di awal filter yang sudah ada.
//   S6. 4.1.1 — blok "bukti & catatan" WAJIB (no. referensi + lampirkan
//       foto) khusus Transfer/QRIS. INI SATU-SATUNYA poin yang menambah
//       FIELD BARU ke Firestore (`no_referensi`, `bukti_foto_url` di
//       `piutang_pembayaran`) — bukan perhitungan, cuma lampiran/tangkapan
//       data tambahan; total_dibayar/sisa_piutang/saldo_piutang TIDAK
//       tersentuh sama sekali.
// ============================================================================

function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
// formatRupiah — DISALIN dari js/vue-master-produk.js (konvensi "salin logic
// kecil per-file" proyek ini, tidak ada util currency global).
function formatRupiah(n) {
  const angka = parseFloat(n) || 0;
  return 'Rp ' + Math.round(angka).toLocaleString('id-ID');
}
function formatRupiahJuta(n) {
  const angka = parseFloat(n) || 0;
  return (angka / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' jt';
}
function formatTanggalPendek(iso) {
  if (!iso) return '-';
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }); }
  catch (e) { return iso; }
}

// ---------------------------------------------------------------------------
// PIN per akun — DISALIN PERSIS dari js/vue-stock-pembelian.js (hashPin/
// tierOwnerKeAtas/cariUserByPin/PopupPin/MAKS_PERCOBAAN_PIN), konvensi proyek
// ini: tiap file salin sendiri, tidak impor silang. Dipakai di 2 titik file
// ini: "Proses massal" (Menunggu Proses) dan "Catat pembayaran" (Transaksi
// Keuangan) — KEDUANYA SELALU tampilkan PopupPin (TIDAK ADA jalur skip untuk
// Owner yang sedang login sendiri, lihat D4 di komentar besar atas file ini
// — beda dari pola sayaOwnerKeAtas-skip di vue-stock-pembelian.js).
// ---------------------------------------------------------------------------
async function hashPin(pin, email) {
  const data = new TextEncoder().encode(pin + '|' + email);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
const MAKS_PERCOBAAN_PIN = 3;
function tierOwnerKeAtas(userData) {
  if (!userData) return false;
  const role = (userData.role || '').toLowerCase();
  if (role === 'owner' || role === 'superuser') return true;
  return role === 'pic' && (userData.profil_akses || '').toLowerCase() === 'pic_owner';
}
async function cariUserByPin(pinInput) {
  const snap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['owner', 'superuser', 'pic', 'admin'])));
  for (const d of snap.docs) {
    const u = d.data();
    if (!u.pin_hash) continue;
    const hash = await hashPin(pinInput, d.id);
    if (hash === u.pin_hash) return { email: d.id, ...u };
  }
  return null;
}
const PopupPin = {
  props: { judul: { type: String, default: 'Masukkan PIN' }, pesan: { type: String, default: '' } },
  emits: ['sukses', 'batal'],
  setup(props, { emit }) {
    const pin = ref(''); const error = ref(''); const percobaan = ref(0);
    const terkunci = ref(false); const memverifikasi = ref(false);
    async function kirim() {
      if (terkunci.value) return;
      if (!/^\d{6}$/.test(pin.value)) { error.value = 'PIN wajib 6 angka.'; return; }
      memverifikasi.value = true; error.value = '';
      try {
        const user = await cariUserByPin(pin.value);
        if (user) { pin.value = ''; percobaan.value = 0; emit('sukses', user); return; }
        percobaan.value++;
        if (percobaan.value >= MAKS_PERCOBAAN_PIN) { terkunci.value = true; error.value = `PIN salah ${MAKS_PERCOBAAN_PIN}x berturut-turut. Tutup popup ini dan coba lagi.`; }
        else { error.value = `PIN salah. Sisa percobaan: ${MAKS_PERCOBAAN_PIN - percobaan.value}.`; }
        pin.value = '';
      } catch (e) { console.error('Gagal verifikasi PIN:', e); error.value = 'Terjadi kesalahan sistem, coba lagi.'; }
      memverifikasi.value = false;
    }
    return { pin, error, percobaan, terkunci, memverifikasi, kirim };
  },
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:10000; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="!terkunci && $emit('batal')">
      <div class="gc-card" style="max-width:360px; width:100%;">
        <h3 style="font-weight:700; font-size:14px; margin-bottom:6px;"><i class="fas fa-lock" style="color:var(--burgundy); margin-right:8px;"></i>{{ judul }}</h3>
        <p v-if="pesan" style="font-size:11.5px; color:var(--text-faint); margin-bottom:12px; line-height:1.5;">{{ pesan }}</p>
        <div v-if="!terkunci" class="gc-field">
          <label>PIN (6 angka)</label>
          <input v-model="pin" @keyup.enter="kirim" type="password" inputmode="numeric" maxlength="6" placeholder="••••••" autofocus style="letter-spacing:6px; text-align:center; font-size:18px;">
        </div>
        <p v-if="error" style="color:var(--danger); font-size:11px; margin-bottom:10px;">{{ error }}</p>
        <div style="display:flex; gap:8px;">
          <button v-if="!terkunci" @click="kirim" :disabled="memverifikasi || pin.length !== 6" class="btn-primary" style="flex:1;">{{ memverifikasi ? 'Memeriksa...' : 'Kirim' }}</button>
          <button @click="$emit('batal')" class="btn-outline" style="flex:1;">{{ terkunci ? 'Tutup' : 'Batal' }}</button>
        </div>
      </div>
    </div>
  `
};

// ---------------------------------------------------------------------------
// Master Pelanggan — DISALIN (bukan diimpor) dari js/vue-master-pelanggan.js
// sebatas fungsi baca yang dibutuhkan file ini (ambilDaftarPelanggan). Form
// tambah/edit pelanggan TETAP di Zevanic House, tidak dibangun ulang di sini.
// ---------------------------------------------------------------------------
async function ambilDaftarPelanggan() {
  try {
    const snap = await getDocs(collection(db, 'master_pelanggan'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    return list;
  } catch (e) { console.error('Gagal ambil daftar Pelanggan:', e); return []; }
}

// ---------------------------------------------------------------------------
// uploadFotoBuktiTransfer — S6, DISALIN dari kompresFotoKeBlob/uploadFotoBon
// di js/vue-stock-pembelian.js (700px/kualitas 0.7, cukup buat foto bukti
// transfer, bukan dokumen resolusi tinggi). Path Storage terpisah dari
// pesanan_pembelian supaya tidak campur folder.
// ---------------------------------------------------------------------------
function kompresFotoBuktiKeBlob(file, maxDimensi, kualitas) {
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
async function uploadFotoBuktiTransfer(transaksiKasirId, file) {
  const blob = await kompresFotoBuktiKeBlob(file, 900, 0.7);
  const pathFile = `piutang_pembayaran/${transaksiKasirId}/bukti_${Date.now()}.jpg`;
  const refFile = storageRef(storage, pathFile);
  await uploadBytes(refFile, blob);
  return await getDownloadURL(refFile);
}

// ---------------------------------------------------------------------------
// catatPembayaranSusulan — 1 fungsi dipakai HANYA oleh popup "Catat
// Pembayaran" (Transaksi Keuangan 4.1.1), untuk pembayaran SESUDAH transaksi
// checkout (DP saat kasir/Lunas saat kasir DITULIS LANGSUNG oleh buatOrder()
// di PesananKasirManager, TIDAK lewat fungsi ini — lihat catatan T di bawah).
// Efek: 1 dokumen piutang_pembayaran baru + transaksi_kasir.total_dibayar/
// sisa_piutang/status_bayar + master_pelanggan.saldo_piutang (SATU-SATUNYA
// titik pengurang saldo_piutang, sesuai SPESIFIKASI-KOLEKSI-BARU.md §2 "JANGAN
// tulis langsung — update lewat fungsi catat pembayaran").
// ---------------------------------------------------------------------------
async function catatPembayaranSusulan({ transaksiKasirId, pelangganId, pelangganNama, noTransaksi, jumlah, metode, tanggal, catatan, dicatatOleh, pinPemilik, noReferensi, buktiFotoUrl }) {
  // S6 — no_referensi/bukti_foto_url FIELD BARU (aditif), TIDAK dipakai di
  // perhitungan apa pun di bawah ini (total_dibayar/sisa_piutang/saldo_piutang
  // tetap murni dari `jumlah`, sama persis seperti sebelum poin S6 ada).
  await addDoc(collection(db, 'piutang_pembayaran'), {
    transaksi_kasir_id: transaksiKasirId, pelanggan_id: pelangganId || '', pelanggan_nama: pelangganNama || '',
    no_transaksi: noTransaksi || '', jenis: 'cicilan', jumlah, metode, tanggal, catatan: catatan || '',
    no_referensi: noReferensi || null, bukti_foto_url: buktiFotoUrl || null,
    dicatat_oleh: dicatatOleh, pin_pemilik: pinPemilik || null, dibuat_pada: serverTimestamp()
  });
  const refTrx = doc(db, 'transaksi_kasir', transaksiKasirId);
  const snapTrx = await getDoc(refTrx);
  if (snapTrx.exists()) {
    const d = snapTrx.data();
    const totalDibayarBaru = (d.total_dibayar || 0) + jumlah;
    const sisaBaru = Math.max(0, (d.total || 0) - totalDibayarBaru);
    await updateDoc(refTrx, { total_dibayar: totalDibayarBaru, sisa_piutang: sisaBaru, status_bayar: sisaBaru <= 0 ? 'lunas' : 'cicilan' });
  }
  if (pelangganId) {
    const refPel = doc(db, 'master_pelanggan', pelangganId);
    const snapPel = await getDoc(refPel);
    if (snapPel.exists()) {
      const saldoBaru = Math.max(0, (snapPel.data().saldo_piutang || 0) - jumlah);
      await updateDoc(refPel, { saldo_piutang: saldoBaru });
    }
  }
}

// ============================================================================
// 1. PENJUALAN KASIR (1.1 pilih barang & pelanggan, 1.2 bayar & cetak).
// HOOK MASA DEPAN (lihat D1) — begitu modul Proses Produksi > Gudang Barang
// Jadi dibangun, titik sambung scan QR label pcs ada di `tambahKeKeranjang()`
// (baru) dan aksi checkout `buatOrder()` (potong stok) — TIDAK ADA sekarang.
// ============================================================================
const METODE_PEMBAYARAN_OPSI = ['Tunai', 'Transfer', 'QRIS'];
const STATUS_BAYAR_OPSI = [
  { v: 'lunas', label: 'Lunas' },
  { v: 'dp', label: 'DP' },
  { v: 'tempo', label: 'Tempo' }
];
const JATUH_TEMPO_PRESET = [
  { label: '+7 hari', hari: 7 }, { label: '+14 hari', hari: 14 }, { label: '+30 hari', hari: 30 }
];

async function generateNoTransaksiKasir() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const tanggalKey = `${yy}${mm}${dd}`;
  const refDoc = doc(db, 'pengaturan_id_transaksi_kasir', tanggalKey);
  return await runTransaction(db, async (trx) => {
    const snap = await trx.get(refDoc);
    const counterBaru = (snap.exists() ? (snap.data().counter || 0) : 0) + 1;
    if (snap.exists()) trx.update(refDoc, { counter: counterBaru });
    else trx.set(refDoc, { counter: counterBaru, dibuat_pada: tanggalKey });
    return `TRX${tanggalKey}${String(counterBaru).padStart(3, '0')}`;
  });
}

function formatLabelProduk(p) {
  return [p.nama, p.warna, p.size].filter(Boolean).join(' ');
}
function tanggalPlusHari(hari) {
  const d = new Date(); d.setDate(d.getDate() + hari);
  return d.toISOString().slice(0, 10);
}

// PopupPratinjauCetakStruk — D10 (lihat komentar besar atas file): preview
// on-screen TETAP template struk khusus (bukan PopupPratinjauCetakLabel,
// bentuk kontennya beda total), tapi tombol Cetak sekarang buka window baru
// dengan `@page{size:${lebar}mm auto}` — lebar diambil dari Pengaturan Cetak
// jenis `struk_kasir` (prop `struk.lebarMm`, diisi PesananKasirManager dari
// `ambilPengaturanCetak('struk_kasir')`) — pola sama seperti cetakSekarang()
// di PopupPratinjauCetakLabel (vue-components.js), supaya konsisten dan
// supaya print SUNGGUHAN cuma berisi struk (bukan seluruh halaman di
// belakang popup seperti window.print() polos yang lama).
const PopupPratinjauCetakStruk = {
  props: ['struk'], emits: ['tutup'],
  setup(props, { emit }) {
    function cetakSekarang() {
      const s = props.struk;
      const lebar = parseFloat(s.lebarMm) || 80;
      const w = window.open('', '_blank');
      if (!w) { alert('Popup diblokir browser. Izinkan popup untuk mencetak struk.'); return; }
      const itemsHtml = s.items.map(it => `
        <div class="baris"><span>${it.qty}x ${it.nama_produk}</span><span>${(it.subtotal || 0).toLocaleString('id-ID')}</span></div>
      `).join('');
      w.document.write(`<html><head><title>Struk ${s.noTransaksi}</title>
        <style>
          @page { size: ${lebar}mm auto; margin: 0; }
          *{ box-sizing:border-box; }
          body{ font-family:'Courier New',monospace; font-size:12px; margin:0; padding:2mm 3mm; width:${lebar}mm; }
          .judul{ text-align:center; font-weight:700; margin-bottom:4px; }
          .sub{ text-align:center; font-size:10.5px; margin-bottom:8px; }
          .garis{ border-top:1px dashed #333; margin:6px 0; }
          .baris{ display:flex; justify-content:space-between; gap:8px; margin-bottom:3px; }
          .total{ display:flex; justify-content:space-between; font-weight:700; }
        </style>
        </head><body>
          <div class="judul">ZEVANIC</div>
          <div class="sub">${s.noTransaksi} &middot; ${s.tanggal}</div>
          <div class="garis"></div>
          ${itemsHtml}
          <div class="garis"></div>
          ${s.diskonTotal > 0 ? `<div class="baris"><span>Diskon</span><span>-${s.diskonTotal.toLocaleString('id-ID')}</span></div>` : ''}
          <div class="total"><span>TOTAL</span><span>${(s.total || 0).toLocaleString('id-ID')}</span></div>
          <div class="baris"><span>Status</span><span>${s.statusLabel}</span></div>
          ${s.dp > 0 ? `<div class="baris"><span>Dibayar (DP)</span><span>${s.dp.toLocaleString('id-ID')}</span></div>` : ''}
          ${s.sisa > 0 ? `<div class="baris"><span>Sisa Piutang</span><span>${s.sisa.toLocaleString('id-ID')}</span></div>` : ''}
          ${s.jatuhTempo ? `<div class="baris"><span>Jatuh Tempo</span><span>${s.jatuhTempo}</span></div>` : ''}
          <div class="sub" style="margin-top:10px;">Pelanggan: ${s.pelanggan}</div>
          <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };<\/script>
        </body></html>`);
      w.document.close();
      emit('cetak');
    }
    return { cetakSekarang };
  },
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="$emit('tutup')">
      <div class="gc-card" style="max-width:340px; width:100%; padding:0; overflow:hidden;">
        <div id="area-cetak-struk" style="padding:18px; font-family: 'Courier New', monospace; font-size:12px;">
          <div style="text-align:center; font-weight:700; margin-bottom:6px;">ZEVANIC</div>
          <div style="text-align:center; font-size:10.5px; margin-bottom:10px;">{{ struk.noTransaksi }} · {{ struk.tanggal }}</div>
          <div style="border-top:1px dashed #333; margin:6px 0;"></div>
          <div v-for="it in struk.items" :key="it.sku_produk" style="display:flex; justify-content:space-between; gap:8px; margin-bottom:3px;">
            <span>{{ it.qty }}x {{ it.nama_produk }}</span><span>{{ (it.subtotal||0).toLocaleString('id-ID') }}</span>
          </div>
          <div style="border-top:1px dashed #333; margin:6px 0;"></div>
          <div v-if="struk.diskonTotal > 0" style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted);"><span>Diskon</span><span>-{{ struk.diskonTotal.toLocaleString('id-ID') }}</span></div>
          <div style="display:flex; justify-content:space-between; font-weight:700;"><span>TOTAL</span><span>{{ (struk.total||0).toLocaleString('id-ID') }}</span></div>
          <div style="display:flex; justify-content:space-between;"><span>Status</span><span>{{ struk.statusLabel }}</span></div>
          <div v-if="struk.dp > 0" style="display:flex; justify-content:space-between;"><span>Dibayar (DP)</span><span>{{ struk.dp.toLocaleString('id-ID') }}</span></div>
          <div v-if="struk.sisa > 0" style="display:flex; justify-content:space-between;"><span>Sisa Piutang</span><span>{{ struk.sisa.toLocaleString('id-ID') }}</span></div>
          <div v-if="struk.jatuhTempo" style="display:flex; justify-content:space-between;"><span>Jatuh Tempo</span><span>{{ struk.jatuhTempo }}</span></div>
          <div style="text-align:center; margin-top:10px; font-size:10px;">Pelanggan: {{ struk.pelanggan }}</div>
        </div>
        <div style="display:flex; gap:8px; padding:12px 18px;">
          <button @click="cetakSekarang" class="btn-primary" style="flex:1;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak</button>
          <button @click="$emit('tutup')" class="btn-outline" style="flex:1;">Tutup</button>
        </div>
      </div>
    </div>
  `
};

// LangkahStepper — S1, indikator 2 langkah "1 Pilih Barang & Pelanggan ·
// 2 Bayar & Cetak" (wireframe 1.1/1.2). Dipakai di step 1 (aktif=1) dan step
// 2 (aktif=2) PesananKasirManager — komponen lokal file ini, TIDAK diekspor
// (konvensi "salin, jangan impor silang" kalau file lain butuh serupa nanti).
const LangkahStepper = {
  props: { aktif: { type: Number, default: 1 } },
  template: `
    <div style="display:flex; align-items:center; gap:10px;">
      <div style="flex:1; display:flex; align-items:center; gap:8px; min-width:0;">
        <span style="width:20px; height:20px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700;" :style="{background: aktif>=1 ? 'var(--burgundy)' : 'var(--ivory-dim)', color: aktif>=1 ? '#fff' : 'var(--text-faint)'}">1</span>
        <span style="font-size:11px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" :style="{color: aktif===1 ? 'var(--burgundy)' : 'var(--text-faint)'}">Pilih Barang &amp; Pelanggan</span>
        <div style="flex:1; height:2px; border-radius:1px; min-width:12px;" :style="{background: aktif>=1 ? 'var(--burgundy)' : 'var(--line)'}"></div>
      </div>
      <div style="flex:1; display:flex; align-items:center; gap:8px; min-width:0;">
        <span style="width:20px; height:20px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700;" :style="{background: aktif>=2 ? 'var(--burgundy)' : 'var(--ivory-dim)', color: aktif>=2 ? '#fff' : 'var(--text-faint)'}">2</span>
        <span style="font-size:11px; font-weight:600; white-space:nowrap;" :style="{color: aktif===2 ? 'var(--burgundy)' : 'var(--text-faint)'}">Bayar &amp; Cetak</span>
        <div style="flex:1; height:2px; border-radius:1px; min-width:12px;" :style="{background: aktif>=2 ? 'var(--burgundy)' : 'var(--line)'}"></div>
      </div>
    </div>
  `
};

const PesananKasirManager = {
  components: { PopupPratinjauCetakStruk, LangkahStepper },
  setup() {
    const menuId = 'pesanan_kasir';
    const bolehTambah = computed(() => window.cekIzinMenu(menuId, 'add') !== false);

    const memuatProduk = ref(true);
    const daftarProduk = ref([]);
    const kategoriAktif = ref('Semua');
    const cariProduk = ref('');

    const daftarKategori = computed(() => {
      const set = new Set(daftarProduk.value.map(p => p.jenis_produk).filter(Boolean));
      return ['Semua', ...Array.from(set).sort()];
    });
    const produkTampil = computed(() => {
      const kata = cariProduk.value.trim().toLowerCase();
      return daftarProduk.value.filter(p => {
        if (kategoriAktif.value !== 'Semua' && p.jenis_produk !== kategoriAktif.value) return false;
        if (!kata) return true;
        return formatLabelProduk(p).toLowerCase().includes(kata) || (p.sku || '').toLowerCase().includes(kata);
      });
    });

    const keranjang = reactive({});
    const daftarKeranjang = computed(() => Object.values(keranjang));
    // D8 (lihat komentar besar atas file) — diskon PER ITEM, toggle Rp/%.
    // subtotalItem() = subtotal SETELAH diskon, diklem tidak boleh negatif
    // (diskon Rp lebih besar dari harga tetap dianggap 0, bukan minus).
    function subtotalItem(i) {
      const kotor = i.qty * i.harga_satuan;
      const nilai = Math.max(0, parseFloat(i.diskon_nilai) || 0);
      const potongan = i.diskon_tipe === 'persen' ? kotor * (Math.min(100, nilai) / 100) : nilai;
      return Math.max(0, kotor - potongan);
    }
    const totalBelanja = computed(() => daftarKeranjang.value.reduce((total, i) => total + subtotalItem(i), 0));
    const totalKotorBelanja = computed(() => daftarKeranjang.value.reduce((total, i) => total + (i.qty * i.harga_satuan), 0));
    const diskonTotalBelanja = computed(() => Math.max(0, totalKotorBelanja.value - totalBelanja.value));
    const totalItem = computed(() => daftarKeranjang.value.reduce((total, i) => total + i.qty, 0));

    function tambahKeKeranjang(produk) {
      if (keranjang[produk.sku]) { keranjang[produk.sku].qty++; return; }
      keranjang[produk.sku] = { sku: produk.sku, nama: formatLabelProduk(produk), harga_satuan: parseFloat(produk.harga_jual) || 0, qty: 1, diskon_tipe: 'rp', diskon_nilai: 0 };
    }
    function tambahQty(sku) { if (keranjang[sku]) keranjang[sku].qty++; }
    function kurangiQty(sku) { if (!keranjang[sku]) return; keranjang[sku].qty--; if (keranjang[sku].qty <= 0) delete keranjang[sku]; }
    function hapusDariKeranjang(sku) { delete keranjang[sku]; }
    function kosongkanKeranjang() { Object.keys(keranjang).forEach(k => delete keranjang[k]); }

    // --- 1.1 Pelanggan (WAJIB dipilih, lihat SERAH-TERIMA.md §2) -----------
    const memuatPelanggan = ref(true);
    const daftarPelanggan = ref([]);
    const cariPelanggan = ref('');
    const pelangganTerpilihId = ref('');
    // S1 — mode edit pelanggan: false (default) begitu sudah dipilih berarti
    // TAMPIL sebagai kotak terkunci; klik "ubah" -> true balik ke <select>.
    const modeGantiPelanggan = ref(false);
    const pelangganTerpilih = computed(() => daftarPelanggan.value.find(p => p.id === pelangganTerpilihId.value) || null);
    const pelangganTampil = computed(() => {
      const kata = cariPelanggan.value.trim().toLowerCase();
      if (!kata) return daftarPelanggan.value;
      return daftarPelanggan.value.filter(p => (p.nama || '').toLowerCase().includes(kata));
    });

    // --- 1.2 Bayar & cetak ---------------------------------------------------
    const step = ref(1); // 1 = pilih barang, 2 = bayar
    const metode = ref('Tunai');
    const statusBayar = ref('lunas'); // lunas | dp | tempo
    const uangDiterima = ref(0);
    const dpNominal = ref(0);
    const jatuhTempo = ref(tanggalPlusHari(14));
    const menyimpan = ref(false);
    const strukTampil = ref(null);

    const dibayarSekarang = computed(() => statusBayar.value === 'lunas' ? totalBelanja.value : (statusBayar.value === 'dp' ? (parseFloat(dpNominal.value) || 0) : 0));
    const sisaPiutang = computed(() => Math.max(0, totalBelanja.value - dibayarSekarang.value));
    const dpPersen = computed(() => statusBayar.value === 'dp' && totalBelanja.value > 0 ? Math.round((dibayarSekarang.value / totalBelanja.value) * 100) : 0);
    // Kembalian: Lunas dihitung terhadap total, DP dihitung terhadap nominal DP
    // saja (BUKAN terhadap total) — persis kalimat wireframe 1.2.
    const kembalian = computed(() => {
      const acuan = statusBayar.value === 'dp' ? dibayarSekarang.value : (statusBayar.value === 'lunas' ? totalBelanja.value : 0);
      return Math.max(0, (parseFloat(uangDiterima.value) || 0) - acuan);
    });

    // S2 — grid nominal cepat dekat "Uang Diterima". Pecahan MENAMBAH
    // (bukan menimpa) uang diterima — meniru kasir menumpuk lembar uang
    // fisik satu-satu (lihat komentar susulan audit di atas file).
    const NOMINAL_CEPAT = [50000, 100000, 150000, 200000, 500000];
    function labelNominalRb(n) { return n >= 1000000 ? (n / 1000000) + ' jt' : (n / 1000) + 'rb'; }
    function tambahNominalUang(n) { uangDiterima.value = (parseFloat(uangDiterima.value) || 0) + n; }
    function nominalUangPas() {
      const acuan = statusBayar.value === 'dp' ? dibayarSekarang.value : (statusBayar.value === 'lunas' ? totalBelanja.value : 0);
      uangDiterima.value = acuan;
    }

    function lanjutKePembayaran() {
      if (daftarKeranjang.value.length === 0) return alert('Keranjang masih kosong. Pilih produk dulu.');
      if (!pelangganTerpilih.value) return alert('Pilih pelanggan dulu — piutang menempel ke nama pelanggan.');
      step.value = 2;
    }
    function kembaliKeKeranjang() { step.value = 1; }

    async function bahanTerblokirDiKeranjang() {
      const idBahanDipakai = new Set();
      daftarKeranjang.value.forEach(item => {
        const produk = daftarProduk.value.find(p => p.sku === item.sku);
        if (!produk) return;
        (produk.bom_pola || []).forEach(b => { if (b && b.bahan_aksesoris_id) idBahanDipakai.add(b.bahan_aksesoris_id); });
        (produk.bom_aksesoris || []).forEach(b => { if (b && b.bahan_aksesoris_id) idBahanDipakai.add(b.bahan_aksesoris_id); });
      });
      if (idBahanDipakai.size === 0) return [];
      try {
        const snap = await getDocs(query(collection(db, 'master_bahan_aksesoris'), where('harga_perlu_konfirmasi', '==', true)));
        const terblokir = [];
        snap.forEach(d => { if (idBahanDipakai.has(d.id)) terblokir.push(d.data().nama || d.id); });
        return terblokir;
      } catch (e) { console.error('Gagal cek guard harga_perlu_konfirmasi:', e); return []; }
    }

    // Guard limit piutang (D6) — DIBLOKIR TOTAL kalau (saldo berjalan + sisa
    // piutang transaksi baru) melebihi master_pelanggan.limit_piutang.
    // limit_piutang = 0 otomatis ikut tertangkap logika yang sama ("0 = tidak
    // boleh piutang", spek §1 — sisa apapun > 0 pasti > limit 0).
    function piutangTerblokir() {
      if (sisaPiutang.value <= 0) return null;
      const p = pelangganTerpilih.value;
      if (!p) return null;
      const limit = parseFloat(p.limit_piutang) || 0;
      const saldoBerjalan = parseFloat(p.saldo_piutang) || 0;
      if ((saldoBerjalan + sisaPiutang.value) > limit) {
        return `Checkout diblokir — piutang pelanggan "${p.nama}" akan jadi ${formatRupiah(saldoBerjalan + sisaPiutang.value)}, melebihi batas piutang ${formatRupiah(limit)}. Kurangi qty, minta DP lebih besar, atau lunasi piutang lama dulu.`;
      }
      return null;
    }

    async function buatOrder() {
      if (daftarKeranjang.value.length === 0) return alert('Keranjang masih kosong. Pilih produk dulu.');
      if (!pelangganTerpilih.value) return alert('Pilih pelanggan dulu.');
      const namaBahanTerblokir = await bahanTerblokirDiKeranjang();
      if (namaBahanTerblokir.length > 0) {
        alert(`Checkout diblokir — harga bahan berikut sedang menunggu konfirmasi Owner di Riwayat Harga Pembelian:\n\n${namaBahanTerblokir.join(', ')}\n\nHubungi Owner/PIC Owner untuk menerapkan atau menolak harga baru dulu.`);
        return;
      }
      const pesanBlokirPiutang = piutangTerblokir();
      if (pesanBlokirPiutang) { alert(pesanBlokirPiutang); return; }

      menyimpan.value = true;
      try {
        const noTransaksi = await generateNoTransaksiKasir();
        // D8 — subtotal per item SUDAH bersih diskon (subtotalItem), snapshot
        // diskon_tipe/diskon_nilai ikut disimpan supaya struk & histori bisa
        // menunjukkan rinciannya, bukan cuma angka akhir.
        const itemsSiap = daftarKeranjang.value.map(i => ({
          sku_produk: i.sku, nama_produk: i.nama, qty: i.qty, harga_satuan: i.harga_satuan,
          diskon_tipe: (parseFloat(i.diskon_nilai) || 0) > 0 ? i.diskon_tipe : null,
          diskon_nilai: (parseFloat(i.diskon_nilai) || 0) > 0 ? (parseFloat(i.diskon_nilai) || 0) : 0,
          subtotal: subtotalItem(i)
        }));
        const totalSiap = itemsSiap.reduce((t, i) => t + i.subtotal, 0);
        const diskonTotalSiap = diskonTotalBelanja.value;
        const pel = pelangganTerpilih.value;
        const sisaSiap = Math.max(0, totalSiap - dibayarSekarang.value);
        const kasirEmail = window.currentUser?.email || null;

        const trxRef = await addDoc(collection(db, 'transaksi_kasir'), {
          no_transaksi: noTransaksi,
          pelanggan_id: pel.id,
          nama_pelanggan: pel.nama,
          metode_pembayaran: metode.value,
          items: itemsSiap,
          total: totalSiap,
          diskon_total: diskonTotalSiap,
          status: 'Aktif',
          status_bayar: statusBayar.value,
          dp_persen: statusBayar.value === 'dp' ? dpPersen.value : 0,
          total_dibayar: dibayarSekarang.value,
          sisa_piutang: sisaSiap,
          jatuh_tempo: statusBayar.value === 'lunas' ? null : jatuhTempo.value,
          dibuat_pada: serverTimestamp(),
          dibuat_oleh: kasirEmail
        });

        const tanggalHariIni = new Date().toISOString().slice(0, 10);
        await Promise.all(itemsSiap.map((it, idx) => addDoc(collection(db, 'order_spk'), {
          no_spk: `${noTransaksi}-${idx + 1}`,
          sku_produk: it.sku_produk,
          nama_produk: it.nama_produk,
          qty_order: it.qty,
          tanggal: tanggalHariIni,
          status: 'Aktif',
          // T1/T2 (lihat komentar besar atas file) — field baru, TIDAK
          // menyentuh status_grouping (milik Persiapan Produksi).
          qo_diproses: false,
          transaksi_kasir_id: trxRef.id,
          no_transaksi: noTransaksi,
          pelanggan_id: pel.id,
          pelanggan_nama: pel.nama,
          status_bayar: statusBayar.value,
          dibuat_pada: serverTimestamp(),
          dibuat_oleh: kasirEmail
        })));

        // Catatan audit trail pembayaran SAAT KASIR (bukan lewat popup Catat
        // Pembayaran) — TIDAK memanggil catatPembayaranSusulan() (itu HANYA
        // untuk pembayaran SESUDAH checkout) supaya saldo_piutang tidak
        // dikurangi dua kali. saldo_piutang di sini HANYA bertambah sebesar
        // sisa yang jadi piutang (kalau ada).
        if (dibayarSekarang.value > 0) {
          await addDoc(collection(db, 'piutang_pembayaran'), {
            transaksi_kasir_id: trxRef.id, pelanggan_id: pel.id, pelanggan_nama: pel.nama, no_transaksi: noTransaksi,
            jenis: statusBayar.value === 'lunas' ? 'tunai_lunas' : 'dp', jumlah: dibayarSekarang.value, metode: metode.value,
            tanggal: tanggalHariIni, catatan: 'Dibayar saat kasir', dicatat_oleh: kasirEmail, pin_pemilik: null, dibuat_pada: serverTimestamp()
          });
        }
        if (sisaSiap > 0) {
          const refPel = doc(db, 'master_pelanggan', pel.id);
          const snapPel = await getDoc(refPel);
          if (snapPel.exists()) await updateDoc(refPel, { saldo_piutang: (parseFloat(snapPel.data().saldo_piutang) || 0) + sisaSiap });
        }

        strukTampil.value = {
          noTransaksi, tanggal: new Date().toLocaleString('id-ID'), items: itemsSiap, total: totalSiap,
          diskonTotal: diskonTotalSiap,
          statusLabel: STATUS_BAYAR_OPSI.find(s => s.v === statusBayar.value)?.label || '',
          dp: statusBayar.value === 'dp' ? dibayarSekarang.value : 0, sisa: sisaSiap,
          jatuhTempo: statusBayar.value !== 'lunas' ? jatuhTempo.value : null, pelanggan: pel.nama,
          // D10 — lebar kertas roll dari Pengaturan Cetak jenis `struk_kasir`,
          // dimuat sekali saat mount (lihat onMounted di bawah).
          lebarMm: parseFloat(pengaturanStruk.value?.lebar_mm) || 80
        };
        kosongkanKeranjang();
        pelangganTerpilihId.value = ''; modeGantiPelanggan.value = false; metode.value = 'Tunai'; statusBayar.value = 'lunas';
        uangDiterima.value = 0; dpNominal.value = 0; jatuhTempo.value = tanggalPlusHari(14);
        step.value = 1;
        await muatPelanggan();
      } catch (e) {
        console.error('Gagal membuat Order Kasir:', e);
        alert('Gagal membuat order. Coba lagi.');
      }
      menyimpan.value = false;
    }

    async function muatPelanggan() { memuatPelanggan.value = true; daftarPelanggan.value = await ambilDaftarPelanggan(); memuatPelanggan.value = false; }

    // D10 — pengaturan cetak jenis `struk_kasir` (lebar roll), dimuat sekali
    // per sesi mount (bukan tiap checkout) — cukup, ukuran kertas jarang
    // ganti di tengah sesi kasir. ambilPengaturanCetak() sendiri sudah punya
    // cache in-memory (lihat js/vue-pengaturan-cetak.js), jadi tidak nambah
    // read Firestore kalau layar lain sudah memuatnya duluan.
    const pengaturanStruk = ref(null);

    onMounted(async () => {
      await window.authReady;
      memuatProduk.value = true;
      try { daftarProduk.value = await ambilSemuaProduk(); } catch (e) { console.error('Gagal muat daftar produk buat Kasir:', e); }
      memuatProduk.value = false;
      await muatPelanggan();
      try { pengaturanStruk.value = await ambilPengaturanCetak('struk_kasir'); } catch (e) { console.error('Gagal muat pengaturan cetak struk_kasir:', e); }
    });

    return {
      bolehTambah, memuatProduk, daftarProduk, kategoriAktif, cariProduk,
      daftarKategori, produkTampil, keranjang, daftarKeranjang, totalBelanja, totalKotorBelanja, diskonTotalBelanja, totalItem,
      subtotalItem, tambahKeKeranjang, tambahQty, kurangiQty, hapusDariKeranjang, kosongkanKeranjang,
      memuatPelanggan, daftarPelanggan, cariPelanggan, pelangganTerpilihId, pelangganTerpilih, pelangganTampil,
      modeGantiPelanggan,
      step, metode, METODE_PEMBAYARAN_OPSI, statusBayar, STATUS_BAYAR_OPSI, JATUH_TEMPO_PRESET,
      uangDiterima, dpNominal, jatuhTempo, dibayarSekarang, sisaPiutang, dpPersen, kembalian,
      NOMINAL_CEPAT, labelNominalRb, tambahNominalUang, nominalUangPas,
      lanjutKePembayaran, kembaliKeKeranjang, menyimpan, buatOrder, strukTampil,
      formatRupiah, tanggalPlusHariHelper: tanggalPlusHari
    };
  },
  template: `
    <div v-if="!bolehTambah" class="gc-card" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12.5px;">Akun ini tidak punya izin untuk Penjualan Kasir.</div>
    <div v-else-if="step === 1" style="display:flex; flex-direction:column; gap:14px;">
      <div class="gc-card" style="padding:14px; border-radius:20px;">
        <langkah-stepper :aktif="1" style="margin-bottom:14px;" />
        <div style="display:flex; align-items:center; gap:9px; background:var(--ivory-dim); border:1px solid var(--line); border-radius:999px; padding:9px 13px; margin-bottom:12px; max-width:360px;">
          <i class="fas fa-magnifying-glass" style="font-size:13px; color:var(--text-faint); flex-shrink:0;"></i>
          <input v-model="cariProduk" type="text" placeholder="Cari produk / SKU..." style="flex:1; min-width:0; border:none; outline:none; background:none; font-size:12px; color:var(--text);">
        </div>
        <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:4px; margin-bottom:12px;" class="no-scrollbar">
          <button v-for="k in daftarKategori" :key="k" @click="kategoriAktif = k" class="btn-outline" :class="{filled: kategoriAktif === k}" style="font-size:11.5px; padding:6px 14px; white-space:nowrap; flex-shrink:0;">{{ k }}</button>
        </div>
        <div v-if="memuatProduk" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat produk...</div>
        <div v-else-if="produkTampil.length === 0" class="gc-kosong">
          <div class="lingkaran"><i class="fas fa-box-open"></i></div>
          <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada produk cocok</h3>
        </div>
        <div v-else style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:10px;">
          <button v-for="p in produkTampil" :key="p.sku" @click="tambahKeKeranjang(p)" type="button" class="gc-card" style="padding:10px; border-radius:16px; text-align:left; cursor:pointer; border:1.5px solid var(--line);">
            <img v-if="p.foto" :src="p.foto" style="width:100%; height:84px; object-fit:cover; border-radius:10px; margin-bottom:8px;">
            <div v-else style="width:100%; height:84px; border-radius:10px; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; margin-bottom:8px;"><i class="fas fa-tshirt" style="color:var(--text-faint); font-size:20px;"></i></div>
            <div style="font-weight:700; font-size:12px; line-height:1.3; margin-bottom:2px;">{{ p.nama }}</div>
            <div style="font-size:10.5px; color:var(--text-muted); margin-bottom:4px;">{{ p.warna }} &middot; {{ p.size }}</div>
            <div style="font-weight:700; font-size:12.5px; color:var(--burgundy);">{{ p.harga_jual > 0 ? formatRupiah(p.harga_jual) : 'Harga belum diisi' }}</div>
          </button>
        </div>
      </div>

      <div class="gc-card" style="padding:14px; border-radius:20px;">
        <h3 style="font-weight:700; font-size:13.5px; margin-bottom:10px;"><i class="fas fa-cash-register" style="color:var(--aksen-ink); margin-right:8px;"></i>Keranjang ({{ totalItem }})</h3>
        <div v-if="daftarKeranjang.length === 0" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;">Keranjang masih kosong — klik produk di atas buat menambahkan.</div>
        <div v-else style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;">
          <div v-for="i in daftarKeranjang" :key="i.sku" style="display:flex; flex-direction:column; gap:6px; background:var(--ivory-dim); border-radius:12px; padding:8px 10px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="flex:1; min-width:0;">
                <div style="font-weight:700; font-size:12px;">{{ i.nama }}</div>
                <div style="font-size:10.5px; color:var(--text-muted);">{{ formatRupiah(i.harga_satuan) }} / pcs</div>
              </div>
              <button @click="kurangiQty(i.sku)" type="button" class="icon-btn" style="width:26px; height:26px;"><i class="fas fa-minus" style="font-size:10px;"></i></button>
              <span style="font-size:12.5px; font-weight:700; min-width:22px; text-align:center;">{{ i.qty }}</span>
              <button @click="tambahQty(i.sku)" type="button" class="icon-btn" style="width:26px; height:26px;"><i class="fas fa-plus" style="font-size:10px;"></i></button>
              <div style="font-weight:700; font-size:12px; min-width:80px; text-align:right;">{{ formatRupiah(subtotalItem(i)) }}</div>
              <button @click="hapusDariKeranjang(i.sku)" type="button" class="icon-btn" style="width:26px; height:26px; color:var(--danger);"><i class="fas fa-trash-alt" style="font-size:10px;"></i></button>
            </div>
            <div style="display:flex; align-items:center; gap:6px; padding-left:2px;">
              <span style="font-size:10px; color:var(--text-faint); flex-shrink:0;">Diskon</span>
              <select v-model="i.diskon_tipe" style="font-size:10.5px; padding:3px 6px; border-radius:6px; border:1px solid var(--line); background:#fff;">
                <option value="rp">Rp</option>
                <option value="persen">%</option>
              </select>
              <input v-model.number="i.diskon_nilai" type="number" min="0" :max="i.diskon_tipe==='persen' ? 100 : null" placeholder="0" style="width:76px; font-size:10.5px; padding:3px 6px; border-radius:6px; border:1px solid var(--line);">
              <span v-if="i.diskon_nilai > 0" style="font-size:10px; color:var(--text-faint);">hemat {{ formatRupiah((i.qty*i.harga_satuan) - subtotalItem(i)) }}</span>
            </div>
          </div>
        </div>

        <div class="gc-field" style="margin-bottom:14px;">
          <div style="display:flex; align-items:baseline; gap:6px; margin-bottom:4px;">
            <label style="margin:0;">Pelanggan <span style="color:var(--danger);">*</span></label>
            <span v-if="pelangganTerpilihId && !modeGantiPelanggan" @click="modeGantiPelanggan = true" style="margin-left:auto; font-size:10.5px; color:var(--burgundy); cursor:pointer; text-decoration:underline;">ubah</span>
          </div>
          <!-- S1: begitu pelanggan sudah dipilih DARI DATABASE, tampil sebagai
               kotak terkunci ber-ikon 🔒 (bukan <select> polos lagi) — persis
               blok "pelanggan · terkunci" di wireframe 1.1. -->
          <template v-if="!pelangganTerpilihId || modeGantiPelanggan">
            <select v-model="pelangganTerpilihId" @change="modeGantiPelanggan = false">
              <option value="" disabled>{{ memuatPelanggan ? 'Memuat...' : 'Pilih pelanggan...' }}</option>
              <option v-for="p in daftarPelanggan" :key="p.id" :value="p.id">{{ p.nama }}{{ p.saldo_piutang > 0 ? ' — piutang ' + formatRupiah(p.saldo_piutang) : '' }}</option>
            </select>
            <p v-if="daftarPelanggan.length === 0 && !memuatPelanggan" style="font-size:10.5px; color:var(--danger); margin-top:4px;">Belum ada data Pelanggan — tambah dulu di Zevanic House &gt; Master Pelanggan.</p>
          </template>
          <div v-else class="gc-card" style="background:rgba(var(--burgundy-rgb),.06); border-color:var(--burgundy); padding:8px 10px; display:flex; align-items:center; gap:8px;">
            <div style="flex:1; min-width:0;">
              <div style="font-weight:700; font-size:12px;">{{ pelangganTerpilih.nama }}</div>
              <div style="font-size:9.5px; color:var(--text-faint);">{{ pelangganTerpilih.saldo_piutang > 0 ? 'piutang berjalan ' + formatRupiah(pelangganTerpilih.saldo_piutang) : 'dari database pelanggan' }}</div>
            </div>
            <span title="Dipilih dari database — terkunci, piutang menempel ke nama ini" style="font-size:12px;">🔒</span>
          </div>
          <p style="font-size:9px; color:var(--text-faint); margin-top:4px;">piutang menempel ke nama ini</p>
        </div>

        <div style="padding-top:12px; border-top:1px solid var(--line); margin-bottom:12px;">
          <div v-if="diskonTotalBelanja > 0" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
            <span style="font-size:11.5px; color:var(--text-faint);">Diskon</span>
            <span style="font-size:12px; color:var(--text-faint);">-{{ formatRupiah(diskonTotalBelanja) }}</span>
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <span style="font-weight:700; font-size:13.5px;">Total</span>
            <span style="font-weight:700; font-size:18px; color:var(--burgundy);">{{ formatRupiah(totalBelanja) }}</span>
          </div>
        </div>
        <button @click="lanjutKePembayaran" :disabled="daftarKeranjang.length === 0" class="btn-primary" style="width:100%; padding:13px;"><i class="fas fa-arrow-right" style="margin-right:6px;"></i>Lanjut ke Pembayaran</button>
      </div>
    </div>

    <div v-else class="gc-card" style="padding:16px; border-radius:20px; max-width:560px; margin:0 auto;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
        <button @click="kembaliKeKeranjang" class="icon-btn"><i class="fas fa-arrow-left"></i></button>
        <div>
          <h3 style="font-weight:700; font-size:14px; margin:0;">Bayar &amp; Cetak</h3>
          <p style="font-size:10.5px; color:var(--text-faint); margin:0;">{{ totalItem }} item &middot; pelanggan: {{ pelangganTerpilih ? pelangganTerpilih.nama : '-' }}</p>
        </div>
      </div>
      <langkah-stepper :aktif="2" style="margin-bottom:14px;" />

      <div class="gc-field">
        <label>Metode Pembayaran</label>
        <div style="display:flex; gap:8px;">
          <button v-for="m in METODE_PEMBAYARAN_OPSI" :key="m" @click="metode = m" type="button" class="btn-outline" :class="{filled: metode === m}" style="flex:1; padding:8px;">{{ m }}</button>
        </div>
      </div>
      <div class="gc-field">
        <label>Status Pembayaran</label>
        <div style="display:flex; gap:8px;">
          <button v-for="s in STATUS_BAYAR_OPSI" :key="s.v" @click="statusBayar = s.v" type="button" class="btn-outline" :class="{filled: statusBayar === s.v}" style="flex:1; padding:8px;">{{ s.label }}</button>
        </div>
      </div>

      <div style="display:flex; align-items:baseline; justify-content:space-between; padding:12px 0; border-top:1px dashed var(--line);">
        <span style="font-size:12.5px; color:var(--text-faint);">Total Tagihan</span>
        <span style="font-weight:700; font-size:19px;">{{ formatRupiah(totalBelanja) }}</span>
      </div>

      <div v-if="statusBayar === 'dp'" class="gc-field">
        <label>Nominal DP</label>
        <input v-model.number="dpNominal" type="number" min="0" placeholder="0">
        <p style="font-size:10.5px; color:var(--text-faint); margin-top:4px;">= {{ dpPersen }}% dari total (dihitung otomatis)</p>
      </div>

      <div v-if="statusBayar !== 'lunas'" class="gc-field">
        <label>Jatuh Tempo</label>
        <div style="display:flex; gap:6px; margin-bottom:6px;">
          <button v-for="j in JATUH_TEMPO_PRESET" :key="j.hari" @click="jatuhTempo = tanggalPlusHariHelper(j.hari)" type="button" class="btn-outline" style="flex:1; font-size:11px; padding:6px;">{{ j.label }}</button>
        </div>
        <input v-model="jatuhTempo" type="date">
      </div>

      <div v-if="statusBayar !== 'tempo'" class="gc-field">
        <label>Uang Diterima {{ statusBayar === 'dp' ? '(terhadap nominal DP)' : '' }}</label>
        <input v-model.number="uangDiterima" type="number" min="0" placeholder="0">
        <!-- S2: keypad nominal cepat — Uang Pas + 5 pecahan umum (menambah,
             bukan menimpa, lihat komentar susulan audit di atas file). -->
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-top:6px;">
          <button @click="nominalUangPas" type="button" class="btn-outline" style="padding:7px 4px; font-size:10.5px;">Uang Pas</button>
          <button v-for="n in NOMINAL_CEPAT" :key="n" @click="tambahNominalUang(n)" type="button" class="btn-outline" style="padding:7px 4px; font-size:10.5px;">+{{ labelNominalRb(n) }}</button>
        </div>
      </div>

      <div v-if="statusBayar !== 'tempo'" class="gc-card" style="background:var(--ivory-dim); padding:10px 12px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; font-size:12.5px;"><span>Kembalian{{ statusBayar === 'dp' ? ' atas DP' : '' }}</span><span style="font-weight:700;">{{ formatRupiah(kembalian) }}</span></div>
      </div>

      <div v-if="sisaPiutang > 0" class="gc-card" style="border-color:var(--warn); background:rgba(var(--warn-rgb),.08); padding:10px 12px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; font-size:12.5px;"><span>Sisa jadi Piutang</span><span style="font-weight:700; color:var(--warn-text);">{{ formatRupiah(sisaPiutang) }}</span></div>
        <div v-if="pelangganTerpilih" style="font-size:10.5px; color:var(--warn-text); margin-top:4px;">Piutang {{ pelangganTerpilih.nama }} saat ini: {{ formatRupiah(pelangganTerpilih.saldo_piutang || 0) }} dari batas {{ formatRupiah(pelangganTerpilih.limit_piutang || 0) }}</div>
      </div>

      <button @click="buatOrder" :disabled="menyimpan" class="btn-primary" style="width:100%; padding:13px;"><i class="fas fa-check" style="margin-right:6px;"></i>{{ menyimpan ? 'Memproses...' : 'Selesai & Cetak' }}</button>
    </div>

    <popup-pratinjau-cetak-struk v-if="strukTampil" :struk="strukTampil" @tutup="strukTampil = null" />
  `
};

// ============================================================================
// 2. MENUNGGU PROSES (2.1 antrean & keputusan QO, 2.2 catatan alur ke
// Persiapan Produksi). GANTI TOTAL dari form CRUD SPK manual versi lama (lihat
// komentar besar atas file ini) — layar ini SEKARANG eksklusif Owner/PIC Owner
// memutuskan QO, TIDAK ADA lagi tambah/edit/hapus/cetak SPK manual di sini.
// ============================================================================
function opsiQO(ro, kelipatan) {
  if (!(kelipatan > 0)) return [];
  const pertama = Math.ceil((parseFloat(ro) || 0) / kelipatan) * kelipatan || kelipatan;
  return [pertama, pertama + kelipatan, pertama + 2 * kelipatan, pertama + 3 * kelipatan];
}

const PesananMenungguManager = {
  components: { PopupPin },
  setup() {
    const menuId = 'pesanan_menunggu';
    const bolehLihat = computed(() => window.cekIzinMenu(menuId, 'add') !== false);
    const sayaOwnerKeAtas = computed(() => tierOwnerKeAtas(window.currentUser));

    const memuat = ref(true);
    const daftarSpk = ref([]);
    const daftarProduk = ref([]);

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDocs(query(collection(db, 'order_spk'), where('status', '==', 'Aktif')));
        daftarSpk.value = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => s.qo_diproses !== true); // T1 — baris yg sudah diputus QO keluar dari antrean
      } catch (e) { console.error('Gagal muat antrean Menunggu Proses:', e); daftarSpk.value = []; }
      memuat.value = false;
    }

    function produkDari(sku) { return daftarProduk.value.find(p => p.sku === sku) || null; }

    // Kelompok per TRANSAKSI (sesuai tampilan wireframe 2.1 — 1 header per
    // TRX, bisa berisi >1 baris produk).
    const kelompokTransaksi = computed(() => {
      const peta = new Map();
      daftarSpk.value.forEach(s => {
        const key = s.transaksi_kasir_id || s.no_transaksi || s.id;
        if (!peta.has(key)) peta.set(key, { key, no_transaksi: s.no_transaksi || '-', pelanggan_nama: s.pelanggan_nama || '(tanpa pelanggan)', status_bayar: s.status_bayar || '', dibuat_oleh: s.dibuat_oleh || '', dibuat_pada: s.dibuat_pada, baris: [] });
        peta.get(key).baris.push(s);
      });
      return Array.from(peta.values()).sort((a, b) => (a.no_transaksi || '').localeCompare(b.no_transaksi || ''));
    });

    // pilihan[id] = angka QO terpilih (truthy = baris tercentang), null/0 = lepas
    const pilihan = reactive({});
    function opsiUntuk(baris) {
      const p = produkDari(baris.sku_produk);
      const kelipatan = p && p.kelipatan > 0 ? p.kelipatan : 0;
      return { kelipatan, opsi: opsiQO(baris.qty_order, kelipatan) };
    }
    function pilihAngka(id, angka) { pilihan[id] = (pilihan[id] === angka) ? null : angka; }
    // S3 — "jumlah order (Rp)" per baris: qty terpilih (atau RO kalau belum
    // dipilih) × harga jual. "dariRo" cuma ditampilkan kalau beda dari RO
    // (baris belum konsisten dengan angka RO-nya, biar tidak berisik dobel
    // angka yang sama).
    function jumlahOrderRp(baris) {
      const p = produkDari(baris.sku_produk);
      const harga = p ? (parseFloat(p.harga_jual) || 0) : 0;
      const qtyPilih = pilihan[baris.id] > 0 ? pilihan[baris.id] : baris.qty_order;
      return { nilai: qtyPilih * harga, dariRo: baris.qty_order * harga, beda: pilihan[baris.id] > 0 && pilihan[baris.id] !== baris.qty_order };
    }
    function pilihManual(baris) {
      const jawab = prompt(`Ketik jumlah QO manual untuk "${baris.nama_produk}" (RO: ${formatQty(baris.qty_order)}):`, pilihan[baris.id] || baris.qty_order);
      if (jawab === null) return;
      const angka = parseFloat(jawab);
      if (!(angka > 0)) return alert('Isi angka yang valid (lebih dari 0).');
      pilihan[baris.id] = angka;
    }

    const barisTercentang = computed(() => daftarSpk.value.filter(s => pilihan[s.id] > 0));
    const totalHargaTercentang = computed(() => barisTercentang.value.reduce((t, s) => {
      const p = produkDari(s.sku_produk);
      return t + (pilihan[s.id] || 0) * (p ? (parseFloat(p.harga_jual) || 0) : 0);
    }, 0));

    const popupPinTampil = ref(false);
    const memproses = ref(false);
    function klikProsesMasal() {
      if (barisTercentang.value.length === 0) return;
      popupPinTampil.value = true;
    }
    async function pinProsesSukses(user) {
      popupPinTampil.value = false;
      if (!tierOwnerKeAtas(user)) { alert(`PIN ini bukan PIN Owner/PIC Owner/Superuser (peran: ${user.role}). Hanya Owner/PIC Owner yang boleh memproses QO.`); return; }
      memproses.value = true;
      try {
        await Promise.all(barisTercentang.value.map(s => updateDoc(doc(db, 'order_spk', s.id), {
          qty_order: pilihan[s.id],
          qo_diproses: true,
          qo_diproses_pada: serverTimestamp(),
          qo_oleh: user.email
        })));
        Object.keys(pilihan).forEach(k => delete pilihan[k]);
        alert(`${barisTercentang.value.length} SPK diproses — QO terkunci, masuk antrean "menunggu persiapan" di Daftar Pesanan & siap digrouping di Persiapan Produksi.`);
        await muat();
      } catch (e) { console.error('Gagal memproses QO massal:', e); alert('Gagal memproses. Coba lagi.'); }
      memproses.value = false;
    }

    onMounted(async () => {
      await window.authReady;
      daftarProduk.value = await ambilSemuaProduk();
      await muat();
    });

    return {
      bolehLihat, sayaOwnerKeAtas, memuat, kelompokTransaksi, pilihan, opsiUntuk, produkDari,
      pilihAngka, pilihManual, jumlahOrderRp, barisTercentang, totalHargaTercentang,
      popupPinTampil, memproses, klikProsesMasal, pinProsesSukses,
      formatQty, formatRupiah
    };
  },
  template: `
    <div v-if="!bolehLihat" class="gc-card" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12.5px;">Akun ini tidak punya izin untuk Menunggu Proses.</div>
    <div v-else-if="!sayaOwnerKeAtas" class="gc-card" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12.5px;"><i class="fas fa-lock" style="margin-right:6px;"></i>Menu ini khusus Owner / PIC Owner — keputusan QO adalah wewenang mereka (lihat PEDOMAN-SERAH-TERIMA.md aturan #8).</div>
    <div v-else style="display:flex; flex-direction:column; gap:14px;">
      <div class="gc-card" style="padding:14px 16px; border-radius:20px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <div>
          <h3 style="font-weight:700; font-size:14px; margin:0;">Menunggu Proses &middot; keputusan QO</h3>
          <p style="font-size:10.5px; color:var(--text-faint); margin:2px 0 0;">{{ barisTercentang.length }} dari {{ kelompokTransaksi.reduce((t,k)=>t+k.baris.length,0) }} baris dipilih &middot; memproses di sini sekaligus jadi persetujuannya</p>
        </div>
        <button @click="klikProsesMasal" :disabled="barisTercentang.length === 0 || memproses" class="btn-primary" style="margin-left:auto; padding:10px 18px;"><i class="fas fa-check-double" style="margin-right:6px;"></i>{{ memproses ? 'Memproses...' : ('PROSES ' + barisTercentang.length + ' ORDERAN') }}</button>
      </div>

      <div v-if="memuat" class="gc-card" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="kelompokTransaksi.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-clipboard-check"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada SPK menunggu keputusan QO</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:16px;">
        <div v-for="grp in kelompokTransaksi" :key="grp.key" class="gc-card" style="padding:14px; border-radius:18px;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding-bottom:10px; margin-bottom:10px; border-bottom:1px dashed var(--line);">
            <span style="font-weight:700; font-size:13px;">{{ grp.pelanggan_nama }}</span>
            <span v-if="grp.status_bayar" class="tag neutral" style="font-size:10px;">{{ grp.status_bayar.toUpperCase() }}</span>
            <span style="margin-left:auto; font-size:10px; color:var(--text-faint);">{{ grp.no_transaksi }} &middot; kasir {{ grp.dibuat_oleh }}</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div v-for="baris in grp.baris" :key="baris.id" class="gc-card" style="padding:10px 12px; display:flex; flex-wrap:wrap; gap:10px; align-items:center;" :style="{background: pilihan[baris.id] ? 'rgba(var(--burgundy-rgb),.05)' : 'transparent'}">
              <div style="width:16px; height:16px; flex-shrink:0; border-radius:4px; border:1.5px solid var(--line); display:flex; align-items:center; justify-content:center;" :style="{background: pilihan[baris.id] ? 'var(--burgundy)' : 'transparent', borderColor: pilihan[baris.id] ? 'var(--burgundy)' : undefined}">
                <i v-if="pilihan[baris.id]" class="fas fa-check" style="font-size:9px; color:#fff;"></i>
              </div>
              <div style="flex:1; min-width:140px;">
                <div style="font-weight:700; font-size:12px;">{{ baris.nama_produk }}</div>
                <div style="font-size:10px; color:var(--text-faint);">{{ produkDari(baris.sku_produk) ? formatRupiah(produkDari(baris.sku_produk).harga_jual) : '-' }} &middot; kelipatan {{ opsiUntuk(baris).kelipatan || '-' }}</div>
              </div>
              <div style="width:60px; text-align:center; flex-shrink:0;">
                <div style="font-size:9px; color:var(--text-faint);">diminta</div>
                <div style="font-weight:700; font-size:13px;">{{ formatQty(baris.qty_order) }}</div>
              </div>
              <div v-if="opsiUntuk(baris).opsi.length > 0" style="display:flex; gap:5px; flex-wrap:wrap;">
                <button v-for="op in opsiUntuk(baris).opsi" :key="op" @click="pilihAngka(baris.id, op)" type="button" class="btn-outline" :class="{filled: pilihan[baris.id] === op}" style="padding:6px 10px; font-size:11.5px;">{{ formatQty(op) }}</button>
                <button @click="pilihManual(baris)" type="button" class="icon-btn" title="Isi manual" style="width:30px; height:30px;"><i class="fas fa-pen" style="font-size:10px;"></i></button>
              </div>
              <div v-else style="font-size:10.5px; color:var(--danger);">Produk belum punya "kelipatan" (BOM Pola belum lengkap) — <button @click="pilihManual(baris)" type="button" style="color:var(--burgundy); text-decoration:underline; background:none; border:none; cursor:pointer; font-size:10.5px;">isi manual</button></div>
              <!-- S3 — kolom "jumlah order (Rp)" per baris, dulu cuma ada di
                   footer sticky total. -->
              <div style="width:112px; text-align:right; flex-shrink:0;">
                <div style="font-size:9px; color:var(--text-faint);">jumlah order</div>
                <div style="font-weight:700; font-size:12px;">{{ formatRupiah(jumlahOrderRp(baris).nilai) }}</div>
                <div v-if="jumlahOrderRp(baris).beda" style="font-size:8.5px; color:var(--text-faint);">dari {{ formatRupiah(jumlahOrderRp(baris).dariRo) }}</div>
              </div>
              <div style="width:60px; text-align:right; flex-shrink:0;" v-if="pilihan[baris.id]">
                <div style="font-size:9px; color:var(--text-faint);">+{{ formatQty(pilihan[baris.id] - baris.qty_order) }} pcs</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="barisTercentang.length > 0" class="gc-card" style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; position:sticky; bottom:12px; border-color:var(--burgundy);">
        <span style="font-size:12px; color:var(--text-faint);">{{ barisTercentang.length }} baris tercentang</span>
        <span style="font-weight:700; font-size:16px; color:var(--burgundy);">{{ formatRupiah(totalHargaTercentang) }}</span>
      </div>
    </div>

    <popup-pin v-if="popupPinTampil" judul="PIN Owner / PIC Owner" pesan="Memproses QO sekaligus jadi persetujuan pesanan — wajib PIN Owner/PIC Owner." @sukses="pinProsesSukses" @batal="popupPinTampil = false" />
  `
};

// ============================================================================
// 3. DAFTAR PESANAN (3.1 ringkasan per pelanggan, 3.2 rincian anak SPK, 3.2.1
// lini masa). BARU TOTAL — GANTI 3 sub-menu ringkasan lama (Proses Persiapan/
// Produksi/Pengiriman, dihapus, lihat mount lama di bagian akhir file versi
// sebelumnya). Lihat T3 di komentar besar atas file ini untuk keterbatasan
// pipeline yang disengaja SETELAH SPK masuk grouping campuran.
// ============================================================================
const JALUR_URUTAN = ['vendor', 'bahan', 'sewing', 'webbing', 'finishing'];
const JALUR_LABEL_PENDEK = { vendor: 'Vendor', bahan: 'Bahan', sewing: 'Acc Sewing', webbing: 'Acc Webbing', finishing: 'Acc Finishing' };

// --- S4: helper lini masa 3.2.1 (dipakai HANYA di popup timeline) ----------
// tglFleksibel — riwayat_scan[].pada disimpan sebagai string ISO biasa
// (lihat pemakaian lama `new Date(r.pada)`), sedangkan order_spk.dibuat_pada/
// qo_diproses_pada Firestore Timestamp (dari serverTimestamp()). Helper ini
// menerima keduanya.
function tglFleksibel(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function formatDurasiMs(ms) {
  if (ms == null || ms < 0) return '-';
  const totalMenit = Math.floor(ms / 60000);
  const hari = Math.floor(totalMenit / 1440);
  const jam = Math.floor((totalMenit % 1440) / 60);
  const menit = totalMenit % 60;
  if (hari > 0) return `${hari}h ${jam}j`;
  if (jam > 0) return `${jam}j ${menit}m`;
  return `${menit}m`;
}
// bangunTimelineSpk — merangkai SATU kolom kejadian urut waktu (wireframe
// 3.2.1): Pesanan masuk -> Perlu Disiapkan (ASUMSI: pakai qo_diproses_pada
// sebagai proxy, lihat komentar susulan audit S4 di atas file) -> tiap jalur
// produksi yang py track -> 2 simpul masa depan tetap (Proses Produksi
// Cutting, Selesai/terkirim) yang belum dibangun modulnya.
function bangunTimelineSpk(spk, tracks) {
  const kejadian = [];
  kejadian.push({
    kunci: 'masuk', judul: 'Pesanan masuk', waktu: tglFleksibel(spk.dibuat_pada),
    keterangan: `${spk.no_transaksi || '-'} &middot; kasir ${spk.dibuat_oleh || '-'}${spk.status_bayar ? ' &middot; ' + spk.status_bayar.toUpperCase() : ''}`,
    selesai: true, tercapai: true
  });
  if (spk.qo_diproses === true) {
    kejadian.push({
      kunci: 'perlu_disiapkan', judul: 'Perlu Disiapkan', waktu: tglFleksibel(spk.qo_diproses_pada),
      keterangan: `QO diputuskan ${spk.qo_oleh || '-'}${spk.status_grouping ? ' · sudah digabung grouping' : ' · menunggu digabung grouping'}`,
      selesai: !!spk.status_grouping, tercapai: true
    });
  }
  JALUR_URUTAN.forEach(j => {
    const t = tracks.find(tt => tt.jalur === j);
    if (t) {
      const riwayat = t.riwayat_scan || [];
      const waktuMulai = riwayat.length ? tglFleksibel(riwayat[0].pada) : null;
      const keterangan = riwayat.length
        ? riwayat.map(r => `${r.aksi || 'scan'}${r.catatan ? ' — ' + r.catatan : ''} (${r.oleh || '-'})`).join(' · ')
        : 'belum ada aktivitas scan tercatat';
      kejadian.push({ kunci: j, judul: JALUR_LABEL_PENDEK[j], waktu: waktuMulai, keterangan, selesai: t.status === 'selesai', tercapai: true, masalah: t.catatan_masalah || null });
    } else {
      kejadian.push({ kunci: j, judul: JALUR_LABEL_PENDEK[j], waktu: null, keterangan: 'belum tercapai', selesai: false, tercapai: false });
    }
  });
  kejadian.push({ kunci: 'produksi', judul: 'Proses Produksi · Cutting', waktu: null, keterangan: 'modulnya belum dibangun', selesai: false, tercapai: false, segeraHadir: true });
  kejadian.push({ kunci: 'terkirim', judul: 'Selesai · terkirim ke pelanggan', waktu: null, keterangan: 'belum tercapai', selesai: false, tercapai: false });

  const idxSekarang = kejadian.findIndex(k => k.tercapai && !k.selesai);
  const now = new Date();
  kejadian.forEach((k, i) => {
    if (!k.tercapai || !k.waktu) return;
    k.sedang = (i === idxSekarang);
    let waktuAkhir = null;
    for (let j = i + 1; j < kejadian.length; j++) { if (kejadian[j].tercapai && kejadian[j].waktu) { waktuAkhir = kejadian[j].waktu; break; } }
    if (!waktuAkhir && k.sedang) waktuAkhir = now;
    k.durasi = waktuAkhir ? formatDurasiMs(waktuAkhir - k.waktu) : null;
  });
  return kejadian;
}

const PesananDaftarManager = {
  setup() {
    const menuId = 'pesanan_daftar';
    const bolehLihat = computed(() => window.cekIzinMenu(menuId, 'add') !== false);

    const memuat = ref(true);
    const semuaOrderSpk = ref([]);
    const semuaTransaksi = ref([]);
    const semuaTrack = ref([]);
    const cari = ref('');
    const kartuTerbuka = reactive({});
    // S4 — daftar produk HANYA dipakai buat tab "kebutuhan bahan" di popup
    // lini masa (nama BOM produk), tidak ikut query/hitung apa pun yang lain.
    const daftarProdukLini = ref([]);

    async function muat() {
      memuat.value = true;
      try {
        const [snapSpk, snapTrx, snapTrack, produk] = await Promise.all([
          getDocs(collection(db, 'order_spk')),
          getDocs(collection(db, 'transaksi_kasir')),
          getDocs(collection(db, 'spk_track')),
          ambilSemuaProduk()
        ]);
        semuaOrderSpk.value = snapSpk.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.pelanggan_id);
        semuaTransaksi.value = snapTrx.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.pelanggan_id);
        semuaTrack.value = snapTrack.docs.map(d => ({ id: d.id, ...d.data() }));
        daftarProdukLini.value = produk || [];
      } catch (e) { console.error('Gagal muat Daftar Pesanan:', e); }
      memuat.value = false;
    }

    const trackByKode = computed(() => {
      const peta = new Map();
      semuaTrack.value.forEach(t => { if (!peta.has(t.kode_spk)) peta.set(t.kode_spk, []); peta.get(t.kode_spk).push(t); });
      return peta;
    });

    // posSekarang / keadaanBaris — lihat T3: pendekatan disederhanakan.
    function posSekarang(spk) {
      if (spk.qo_diproses !== true) return 'Menunggu Proses';
      if (!spk.status_grouping) return 'Perlu Disiapkan';
      const tracks = trackByKode.value.get(spk.kode_spk_grouping) || [];
      if (tracks.length === 0) return 'Perlu Disiapkan';
      for (const j of JALUR_URUTAN) {
        const t = tracks.find(tt => tt.jalur === j);
        if (t && t.status !== 'selesai') return JALUR_LABEL_PENDEK[j];
      }
      return 'Terkirim';
    }
    function keadaanBaris(spk) {
      const tracks = trackByKode.value.get(spk.kode_spk_grouping) || [];
      const tertahan = tracks.find(t => t.status !== 'selesai' && t.catatan_masalah);
      if (tertahan) return { label: 'tertahan · ' + tertahan.catatan_masalah, kelas: 'warn' };
      const pos = posSekarang(spk);
      if (pos === 'Menunggu Proses') return { label: 'menunggu keputusan QO', kelas: 'neutral' };
      if (pos === 'Perlu Disiapkan') return { label: 'menunggu', kelas: 'neutral' };
      if (pos === 'Terkirim') return { label: 'selesai', kelas: 'ok' };
      return { label: 'berjalan', kelas: 'ok' };
    }

    // Ringkasan menyeluruh (6 kotak) — lihat komentar T3 utk kenapa
    // "menunggu proses" & "menunggu persiapan" presisi tapi jalur sesudahnya
    // tidak dipecah per pelanggan.
    function hitungRingkasan(daftarSpk, daftarTrx) {
      return {
        pesanan: new Set(daftarTrx.map(t => t.id)).size,
        produkTerjual: daftarSpk.reduce((t, s) => t + (parseFloat(s.qty_order) || 0), 0),
        terkirim: daftarSpk.filter(s => posSekarang(s) === 'Terkirim').length,
        menungguPersiapan: daftarSpk.filter(s => s.qo_diproses === true && !s.status_grouping).length,
        menungguProses: daftarSpk.filter(s => s.qo_diproses !== true).length,
        belumBayar: daftarTrx.reduce((t, tr) => t + (parseFloat(tr.sisa_piutang) || 0), 0)
      };
    }
    const ringkasanMenyeluruh = computed(() => hitungRingkasan(semuaOrderSpk.value, semuaTransaksi.value));

    const kartuPelanggan = computed(() => {
      const kata = cari.value.trim().toLowerCase();
      const peta = new Map();
      semuaTransaksi.value.forEach(t => {
        if (!peta.has(t.pelanggan_id)) peta.set(t.pelanggan_id, { id: t.pelanggan_id, nama: t.nama_pelanggan, transaksi: [], spk: [] });
        peta.get(t.pelanggan_id).transaksi.push(t);
      });
      semuaOrderSpk.value.forEach(s => {
        if (!peta.has(s.pelanggan_id)) peta.set(s.pelanggan_id, { id: s.pelanggan_id, nama: s.pelanggan_nama, transaksi: [], spk: [] });
        peta.get(s.pelanggan_id).spk.push(s);
      });
      let list = Array.from(peta.values()).map(p => ({ ...p, ...hitungRingkasan(p.spk, p.transaksi), noTransaksiList: p.transaksi.map(t => t.no_transaksi).join(' · ') }));
      if (kata) list = list.filter(p => (p.nama || '').toLowerCase().includes(kata) || p.noTransaksiList.toLowerCase().includes(kata));
      list.sort((a, b) => b.belumBayar - a.belumBayar);
      return list;
    });

    // Pipeline Persiapan per pelanggan — 5 jalur, dihitung dari DISTINCT
    // kode_spk_grouping milik pelanggan ini yang punya track aktif di jalur
    // itu (lihat T3 — angka ini menghitung GROUPING yang tersentuh, BUKAN
    // pecahan qty per pelanggan dalam grouping campuran; kalau grouping
    // digabung lintas pelanggan, jalur di sini bisa tampak "aktif" untuk
    // >1 pelanggan sekaligus).
    function pipelinePersiapan(p) {
      const kodeSet = new Set(p.spk.filter(s => s.status_grouping && s.kode_spk_grouping).map(s => s.kode_spk_grouping));
      const hasil = {};
      JALUR_URUTAN.forEach(j => {
        let n = 0;
        kodeSet.forEach(kode => { const t = (trackByKode.value.get(kode) || []).find(tt => tt.jalur === j); if (t && t.status !== 'selesai') n++; });
        hasil[j] = n;
      });
      return hasil;
    }

    // --- 3.2 popup rincian per pelanggan --------------------------------
    const popupRincian = ref(null); // { pelanggan, cariProduk, cariSpk }
    function bukaRincian(p) { popupRincian.value = { pelanggan: p, cariProduk: '', cariSpk: '' }; }
    const rincianBarisTampil = computed(() => {
      if (!popupRincian.value) return [];
      const p = popupRincian.value;
      return p.pelanggan.spk.filter(s => {
        if (p.cariProduk && !(s.nama_produk || '').toLowerCase().includes(p.cariProduk.toLowerCase())) return false;
        if (p.cariSpk && !(s.no_spk || '').toLowerCase().includes(p.cariSpk.toLowerCase())) return false;
        return true;
      }).map(s => ({ ...s, pos: posSekarang(s), keadaan: keadaanBaris(s) }));
    });

    // --- 3.2.1 popup lini masa satu anak SPK (S4 — REKONSTRUKSI TOTAL,
    // lihat komentar susulan audit di atas file) -------------------------
    const popupTimeline = ref(null); // { spk, tracks, kejadian, stat, bahanList, masalahList, tab }
    function bukaTimeline(spk) {
      const tracks = spk.kode_spk_grouping ? (trackByKode.value.get(spk.kode_spk_grouping) || []) : [];
      const kejadian = bangunTimelineSpk(spk, tracks);

      const now = new Date();
      const waktuMasuk = tglFleksibel(spk.dibuat_pada);
      const jalurSelesai = JALUR_URUTAN.filter(j => { const t = tracks.find(tt => tt.jalur === j); return t && t.status === 'selesai'; }).length;
      const nodeSekarang = kejadian.find(k => k.sedang);
      const stat = {
        umur: waktuMasuk ? formatDurasiMs(now - waktuMasuk) : '-',
        posPersiapan: `${jalurSelesai} dari ${JALUR_URUTAN.length} dilewati`,
        posSekarang: posSekarang(spk),
        diPosIni: (nodeSekarang && nodeSekarang.waktu) ? formatDurasiMs(now - nodeSekarang.waktu) : '-',
        // "pernah tertahan" = jumlah track grouping ini yang SAAT INI py
        // catatan_masalah (bukan akumulasi historis, lihat asumsi S4).
        pernahTertahan: tracks.filter(t => t.catatan_masalah).length
      };

      const produk = daftarProdukLini.value.find(p => p.sku === spk.sku_produk) || null;
      const bahanList = produk ? [
        ...(produk.bom_pola || []).filter(b => b.nama_bahan || b.nama_pola).map(b => ({ nama: [b.nama_bahan, b.warna_bahan].filter(Boolean).join(' ') || b.nama_pola, ket: b.tipe === 'vendor' ? 'Vendor' : 'Internal' })),
        ...(produk.bom_aksesoris || []).filter(a => a.nama_aksesoris).map(a => ({ nama: [a.nama_aksesoris, a.warna].filter(Boolean).join(' '), ket: a.satuan || '-' }))
      ] : [];

      const masalahList = tracks.filter(t => t.catatan_masalah).map(t => {
        const riwayat = t.riwayat_scan || [];
        const terakhir = riwayat[riwayat.length - 1] || null;
        return { jalur: JALUR_LABEL_PENDEK[t.jalur] || t.jalur, catatan: t.catatan_masalah, oleh: terakhir?.oleh || '-', pada: terakhir?.pada ? new Date(terakhir.pada).toLocaleString('id-ID') : '-' };
      });

      popupTimeline.value = { spk, tracks, kejadian, stat, bahanList, masalahList, tab: 'lini_masa' };
    }
    function pindahTabTimeline(tab) { if (popupTimeline.value) popupTimeline.value.tab = tab; }

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      bolehLihat, memuat, cari, kartuTerbuka, ringkasanMenyeluruh, kartuPelanggan,
      pipelinePersiapan, popupRincian, bukaRincian, rincianBarisTampil,
      popupTimeline, bukaTimeline, pindahTabTimeline, JALUR_URUTAN, JALUR_LABEL_PENDEK,
      formatQty, formatRupiah, formatRupiahJuta
    };
  },
  template: `
    <div v-if="!bolehLihat" class="gc-card" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12.5px;">Akun ini tidak punya izin untuk Daftar Pesanan.</div>
    <div v-else style="display:flex; flex-direction:column; gap:14px;">
      <div class="gc-card" style="padding:14px 16px; border-radius:20px;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
          <h3 style="font-weight:700; font-size:15px; margin:0;">Daftar Pesanan</h3>
          <div style="display:flex; align-items:center; gap:8px; background:var(--ivory-dim); border:1px solid var(--line); border-radius:999px; padding:7px 12px; margin-left:auto; max-width:260px;">
            <i class="fas fa-magnifying-glass" style="font-size:12px; color:var(--text-faint);"></i>
            <input v-model="cari" type="text" placeholder="Cari No. pesanan / pelanggan..." style="flex:1; min-width:0; border:none; outline:none; background:none; font-size:12px;">
          </div>
        </div>
        <div v-if="memuat" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;">Memuat...</div>
        <div v-else style="display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:8px; background:var(--ivory-dim); border-radius:14px; padding:12px;">
          <div><div style="font-size:9.5px; color:var(--text-faint);">pesanan</div><div style="font-weight:700; font-size:20px;">{{ ringkasanMenyeluruh.pesanan }}</div></div>
          <div><div style="font-size:9.5px; color:var(--text-faint);">produk terjual</div><div style="font-weight:700; font-size:20px;">{{ formatQty(ringkasanMenyeluruh.produkTerjual) }} <span style="font-size:10px;">pcs</span></div></div>
          <div><div style="font-size:9.5px; color:var(--text-faint);">terkirim</div><div style="font-weight:700; font-size:20px;">{{ ringkasanMenyeluruh.terkirim }} <span style="font-size:10px;">SPK</span></div></div>
          <div><div style="font-size:9.5px; color:var(--text-faint);">menunggu persiapan</div><div style="font-weight:700; font-size:20px;">{{ ringkasanMenyeluruh.menungguPersiapan }} <span style="font-size:10px;">SPK</span></div></div>
          <div><div style="font-size:9.5px; color:var(--text-faint);">menunggu proses</div><div style="font-weight:700; font-size:20px;">{{ ringkasanMenyeluruh.menungguProses || '—' }}</div></div>
          <div><div style="font-size:9.5px; color:var(--warn-text);">belum bayar</div><div style="font-weight:700; font-size:20px; color:var(--warn-text);">{{ formatRupiahJuta(ringkasanMenyeluruh.belumBayar) }}</div></div>
        </div>
      </div>

      <div v-if="!memuat && kartuPelanggan.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-receipt"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada pesanan</h3>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="p in kartuPelanggan" :key="p.id" class="gc-card" style="border-radius:18px; overflow:hidden; padding:0;">
          <div @click="kartuTerbuka[p.id] = !kartuTerbuka[p.id]" style="padding:12px 16px; display:flex; align-items:center; gap:12px; cursor:pointer; flex-wrap:wrap;">
            <div style="flex:1; min-width:160px;">
              <div style="font-weight:700; font-size:13.5px;">{{ p.nama || '(tanpa pelanggan)' }}</div>
              <div style="font-size:9.5px; color:var(--text-faint);">{{ p.noTransaksiList }}</div>
            </div>
            <span style="font-size:9.5px; color:var(--text-faint);">{{ p.pesanan }} pesanan</span>
            <span style="font-weight:700; font-size:13px; color:var(--warn-text);">{{ formatRupiahJuta(p.belumBayar) }}</span>
            <i class="fas" :class="kartuTerbuka[p.id] ? 'fa-chevron-up' : 'fa-chevron-down'" style="font-size:11px; color:var(--text-faint);"></i>
          </div>
          <div v-if="kartuTerbuka[p.id]" style="display:flex; flex-wrap:wrap; gap:0; border-top:1px solid var(--line);">
            <div style="width:220px; flex:none; padding:14px 16px; border-right:1px solid var(--line);">
              <div style="font-size:9.5px; color:var(--text-faint); margin-bottom:6px;">keadaan pelanggan ini</div>
              <div style="display:flex; justify-content:space-between; padding:5px 0; border-top:1px solid var(--line); font-size:12px;"><span style="color:var(--text-faint);">pesanan</span><span style="font-weight:700;">{{ p.pesanan }}</span></div>
              <div style="display:flex; justify-content:space-between; padding:5px 0; border-top:1px solid var(--line); font-size:12px;"><span style="color:var(--text-faint);">produk terjual</span><span style="font-weight:700;">{{ formatQty(p.produkTerjual) }} pcs</span></div>
              <div style="display:flex; justify-content:space-between; padding:5px 0; border-top:1px solid var(--line); font-size:12px;"><span style="color:var(--text-faint);">terkirim</span><span style="font-weight:700;">{{ p.terkirim }} SPK</span></div>
              <div style="display:flex; justify-content:space-between; padding:5px 0; border-top:1px solid var(--line); font-size:12px;"><span style="color:var(--text-faint);">menunggu persiapan</span><span style="font-weight:700;">{{ p.menungguPersiapan }} SPK</span></div>
              <div style="display:flex; justify-content:space-between; padding:5px 0; border-top:1px solid var(--line); font-size:12px;"><span style="color:var(--text-faint);">menunggu proses</span><span style="font-weight:700;">{{ p.menungguProses || '—' }}</span></div>
              <div style="display:flex; justify-content:space-between; padding:5px 0; border-top:1px solid var(--line); font-size:12px;"><span style="color:var(--warn-text);">belum bayar</span><span style="font-weight:700; color:var(--warn-text);">{{ formatRupiahJuta(p.belumBayar) }}</span></div>
            </div>
            <div style="flex:1; min-width:260px; padding:14px 16px; display:flex; flex-direction:column; gap:12px;">
              <div>
                <div style="display:flex; align-items:baseline; gap:8px; margin-bottom:10px;"><span style="font-weight:700; font-size:12px;">Pipeline Persiapan</span><span class="tag neutral" style="font-size:9.5px;">{{ p.menungguPersiapan }} SPK menunggu</span></div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <div style="text-align:center; flex:1; min-width:70px;"><div style="width:34px; height:34px; border-radius:50%; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; margin:0 auto 4px; font-weight:700;">{{ p.menungguPersiapan }}</div><div style="font-size:9px; color:var(--text-faint);">Perlu Disiapkan</div></div>
                  <div v-for="j in JALUR_URUTAN" :key="j" style="text-align:center; flex:1; min-width:70px;"><div style="width:34px; height:34px; border-radius:50%; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; margin:0 auto 4px; font-weight:700;">{{ pipelinePersiapan(p)[j] || '—' }}</div><div style="font-size:9px; color:var(--text-faint);">{{ JALUR_LABEL_PENDEK[j] }}</div></div>
                </div>
                <p style="font-size:9px; color:var(--text-faint); margin-top:6px;">angka per jalur = grouping yang tersentuh (bisa gabungan lintas pelanggan) — detail presisi ada di Persiapan Produksi.</p>
              </div>
              <div class="gc-card" style="background:var(--ivory-dim); padding:10px 12px;">
                <div style="display:flex; align-items:baseline; gap:8px;"><span style="font-size:11px; color:var(--text-faint);">Pipeline Proses Produksi</span><span class="tag neutral" style="font-size:9px;">segera hadir</span></div>
                <div style="display:flex; margin-top:6px;"><div style="flex:1; text-align:center; font-size:11px; color:var(--text-faint);">Cutting<br>—</div><div style="flex:1; text-align:center; font-size:11px; color:var(--text-faint);">Sewing<br>—</div><div style="flex:1; text-align:center; font-size:11px; color:var(--text-faint);">Webbing<br>—</div><div style="flex:1; text-align:center; font-size:11px; color:var(--text-faint);">Finishing<br>—</div></div>
              </div>
              <button @click="bukaRincian(p)" class="btn-outline" style="align-self:flex-start; padding:7px 14px; font-size:11.5px;"><i class="fas fa-list" style="margin-right:6px;"></i>Lihat rincian pesanan</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="popupRincian" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="popupRincian = null">
      <div class="gc-card" style="max-width:900px; width:100%; max-height:88vh; overflow-y:auto; padding:18px;">
        <div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:12px;">
          <div><h3 style="font-weight:700; font-size:14px; margin:0;">Rincian pesanan &middot; {{ popupRincian.pelanggan.nama }}</h3><p style="font-size:10px; color:var(--text-faint); margin:2px 0 0;">{{ rincianBarisTampil.length }} anak SPK &middot; barangnya, bukan uangnya</p></div>
          <button @click="popupRincian = null" class="icon-btn" style="margin-left:auto;"><i class="fas fa-xmark"></i></button>
        </div>
        <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
          <input v-model="popupRincian.cariProduk" type="text" placeholder="Cari produk..." class="gc-field-input" style="flex:1; min-width:160px; padding:8px 10px; border:1px solid var(--line); border-radius:8px; font-size:12px;">
          <input v-model="popupRincian.cariSpk" type="text" placeholder="Cari kode anak SPK..." style="flex:1; min-width:160px; padding:8px 10px; border:1px solid var(--line); border-radius:8px; font-size:12px;">
        </div>
        <div class="gc-table-scroll">
          <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead><tr style="text-align:left; color:var(--text-faint); font-size:10px;"><th style="padding:6px;">anak SPK</th><th style="padding:6px;">qty</th><th style="padding:6px;">pos sekarang</th><th style="padding:6px;">keadaan</th><th></th></tr></thead>
            <tbody>
              <tr v-for="b in rincianBarisTampil" :key="b.id" style="border-top:1px solid var(--line); cursor:pointer;" @click="bukaTimeline(b)">
                <td style="padding:7px 6px;"><div style="font-weight:700;">{{ b.no_spk }}</div><div style="font-size:10px; color:var(--text-faint);">{{ b.nama_produk }}</div></td>
                <td style="padding:7px 6px;">{{ formatQty(b.qty_order) }}</td>
                <td style="padding:7px 6px;">{{ b.pos }}</td>
                <td style="padding:7px 6px;"><span class="tag" :class="b.keadaan.kelas">{{ b.keadaan.label }}</span></td>
                <td style="padding:7px 6px; text-align:right; color:var(--text-faint);"><i class="fas fa-chevron-right" style="font-size:10px;"></i></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style="font-size:9.5px; color:var(--text-faint); margin-top:10px;">Uang pesanan ini tidak dibahas di sini — buka menu Transaksi Keuangan untuk rincian transaksi & piutang.</p>
      </div>
    </div>

    <!-- S4 — REKONSTRUKSI TOTAL popup lini masa 3.2.1: 5 kotak statistik +
         3 tab (lini masa/kebutuhan bahan/masalah) + timeline SATU KOLOM urut
         waktu (dulu: daftar kartu per jalur, tanpa stat/tab). -->
    <div v-if="popupTimeline" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:10001; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="popupTimeline = null">
      <div class="gc-card" style="max-width:600px; width:100%; max-height:86vh; overflow-y:auto; padding:18px;">
        <div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:12px;">
          <div><h3 style="font-weight:700; font-size:14px; margin:0;">{{ popupTimeline.spk.no_spk }}</h3><p style="font-size:10px; color:var(--text-faint); margin:2px 0 0;">{{ popupTimeline.spk.nama_produk }} &middot; {{ formatQty(popupTimeline.spk.qty_order) }} pcs &middot; {{ popupTimeline.spk.pelanggan_nama }} &middot; {{ popupTimeline.spk.no_transaksi }}</p></div>
          <button @click="popupTimeline = null" class="icon-btn" style="margin-left:auto;"><i class="fas fa-xmark"></i></button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px; margin-bottom:12px;">
          <div class="gc-card" style="padding:7px 9px;"><div style="font-size:8.5px; color:var(--text-faint);">umur SPK</div><div style="font-weight:700; font-size:13px; margin-top:2px;">{{ popupTimeline.stat.umur }}</div></div>
          <div class="gc-card" style="padding:7px 9px;"><div style="font-size:8.5px; color:var(--text-faint);">pos persiapan</div><div style="font-weight:700; font-size:11px; margin-top:2px;">{{ popupTimeline.stat.posPersiapan }}</div></div>
          <div class="gc-card" style="padding:7px 9px; border-color:var(--burgundy);"><div style="font-size:8.5px; color:var(--text-faint);">pos sekarang</div><div style="font-weight:700; font-size:11px; margin-top:2px;">{{ popupTimeline.stat.posSekarang }}</div></div>
          <div class="gc-card" style="padding:7px 9px;"><div style="font-size:8.5px; color:var(--text-faint);">di pos ini</div><div style="font-weight:700; font-size:13px; margin-top:2px;">{{ popupTimeline.stat.diPosIni }}</div></div>
          <div class="gc-card" style="padding:7px 9px;"><div style="font-size:8.5px; color:var(--text-faint);">pernah tertahan</div><div style="font-weight:700; font-size:13px; margin-top:2px;">{{ popupTimeline.stat.pernahTertahan }} <span style="font-size:9px; font-weight:400;">kali</span></div></div>
        </div>

        <div style="display:flex; gap:6px; align-items:center; margin-bottom:12px; flex-wrap:wrap;">
          <button @click="pindahTabTimeline('lini_masa')" type="button" class="btn-outline" :class="{filled: popupTimeline.tab === 'lini_masa'}" style="padding:5px 13px; font-size:11px; border-radius:999px;">lini masa</button>
          <button @click="pindahTabTimeline('kebutuhan_bahan')" type="button" class="btn-outline" :class="{filled: popupTimeline.tab === 'kebutuhan_bahan'}" style="padding:5px 13px; font-size:11px; border-radius:999px;">kebutuhan bahan</button>
          <button @click="pindahTabTimeline('masalah')" type="button" class="btn-outline" :class="{filled: popupTimeline.tab === 'masalah'}" style="padding:5px 13px; font-size:11px; border-radius:999px;">masalah<span v-if="popupTimeline.masalahList.length" style="margin-left:4px; color:var(--danger);">({{ popupTimeline.masalahList.length }})</span></button>
          <span style="margin-left:auto; font-size:9px; color:var(--text-faint);">tiap baris lahir dari scan &middot; tidak ada yang diketik</span>
        </div>

        <div v-if="popupTimeline.tab === 'lini_masa'" style="display:flex; flex-direction:column;">
          <div v-for="(k, idx) in popupTimeline.kejadian" :key="k.kunci" style="display:flex; gap:10px; align-items:flex-start;">
            <div style="width:58px; flex-shrink:0; text-align:right; padding-top:2px;">
              <div style="font-size:9.5px; color:var(--text-faint);">{{ k.waktu ? k.waktu.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '—' }}</div>
              <div style="font-size:8px; color:var(--text-faint);">{{ k.waktu ? k.waktu.toLocaleDateString('id-ID', {day:'numeric', month:'short'}) : '' }}</div>
            </div>
            <div style="width:14px; flex-shrink:0; display:flex; flex-direction:column; align-items:center; align-self:stretch;">
              <div style="width:11px; height:11px; border-radius:50%; flex-shrink:0;" :style="{background: k.sedang ? 'var(--burgundy)' : (k.tercapai ? 'rgba(110,30,44,.35)' : '#fff'), border: !k.tercapai ? '1.5px solid var(--line)' : 'none'}"></div>
              <div v-if="idx < popupTimeline.kejadian.length - 1" style="flex:1; width:1px; min-height:22px;" :style="{background: k.tercapai ? 'rgba(110,30,44,.3)' : 'var(--line)'}"></div>
            </div>
            <div style="flex:1; min-width:0; padding-bottom:14px;">
              <div style="display:flex; align-items:baseline; gap:7px; flex-wrap:wrap;">
                <span style="font-weight:700; font-size:11.5px;" :style="{color: k.tercapai ? 'var(--text)' : 'var(--text-faint)'}">{{ k.judul }}</span>
                <span v-if="k.sedang" class="tag" style="font-size:8.5px;">sedang di sini</span>
                <span v-if="k.segeraHadir" class="tag neutral" style="font-size:8.5px;">segera hadir</span>
                <span v-if="k.durasi" style="margin-left:auto; font-size:9px; color:var(--text-faint);">{{ k.durasi }}{{ k.sedang ? ' berjalan' : '' }}</span>
              </div>
              <div style="font-size:10px; color:var(--text-faint); margin-top:2px; line-height:1.5;">{{ k.keterangan }}</div>
              <div v-if="k.masalah" style="font-size:10.5px; color:var(--danger); margin-top:3px;"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>{{ k.masalah }}</div>
            </div>
          </div>
        </div>

        <div v-else-if="popupTimeline.tab === 'kebutuhan_bahan'">
          <div v-if="popupTimeline.bahanList.length === 0" class="gc-kosong"><div class="lingkaran"><i class="fas fa-swatchbook"></i></div><h3 class="gc-heading" style="font-size:12.5px; font-weight:700; margin:0;">Data BOM produk ini belum lengkap</h3></div>
          <div v-else style="display:flex; flex-direction:column; gap:6px;">
            <div v-for="(b, idx) in popupTimeline.bahanList" :key="idx" style="display:flex; align-items:center; gap:8px; padding:7px 10px; background:var(--ivory-dim); border-radius:10px;">
              <span style="flex:1; font-size:11.5px; font-weight:600;">{{ b.nama || '(tanpa nama)' }}</span>
              <span class="tag neutral" style="font-size:9.5px;">{{ b.ket }}</span>
            </div>
            <p style="font-size:9px; color:var(--text-faint); margin-top:4px;">nama bahan/aksesoris dari BOM produk — rincian kuantitas presisi ada di Persiapan Produksi.</p>
          </div>
        </div>

        <div v-else-if="popupTimeline.tab === 'masalah'">
          <div v-if="popupTimeline.masalahList.length === 0" class="gc-kosong"><div class="lingkaran"><i class="fas fa-check"></i></div><h3 class="gc-heading" style="font-size:12.5px; font-weight:700; margin:0;">Berjalan lancar — tidak pernah tertahan</h3></div>
          <div v-else style="display:flex; flex-direction:column; gap:8px;">
            <div v-for="(m, idx) in popupTimeline.masalahList" :key="idx" class="gc-card" style="border-color:var(--danger); background:rgba(179,58,58,.05); padding:9px 11px;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;"><span class="tag neutral" style="font-size:9.5px;">{{ m.jalur }}</span><span style="margin-left:auto; font-size:9px; color:var(--text-faint);">{{ m.oleh }} &middot; {{ m.pada }}</span></div>
              <div style="font-size:11px; color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:5px;"></i>{{ m.catatan }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// 4. TRANSAKSI KEUANGAN (4.1 kas besar, 4.1.1 catat pembayaran, 4.2.1 rincian
// transaksi, 4.2.2 rincian piutang). BARU TOTAL — koleksi `piutang_pembayaran`
// baru (lihat SPESIFIKASI-KOLEKSI-BARU.md §2). "Catat pembayaran" tampil HANYA
// untuk Owner/PIC Owner (tombolnya sendiri, sesuai teks wireframe 4.1) DAN
// tetap wajib PopupPin sesudah diklik (D4 — dua lapis, bukan salah satu saja).
// ============================================================================
const PesananTransaksiManager = {
  components: { PopupPin },
  setup() {
    const menuId = 'pesanan_transaksi';
    const bolehLihat = computed(() => window.cekIzinMenu(menuId, 'add') !== false);
    const sayaOwnerKeAtas = computed(() => tierOwnerKeAtas(window.currentUser));

    // S5 — GANTI dari 3 tab eksklusif jadi 1 halaman scroll berurutan (lihat
    // komentar susulan audit di atas file). `tabAktif` TIDAK dipakai lagi
    // buat exclusive-render, cuma dipertahankan sebagai target anchor pil
    // navigasi cepat di header (scroll ke section, bukan ganti tampilan).
    const memuat = ref(true);
    const semuaTransaksi = ref([]);
    const semuaPembayaran = ref([]);
    const cari = ref('');
    // filterPelangganId — REF BARU (S5), 1 filter pelanggan bersama yang
    // mengalir ke ketiga bagian (Kas Besar/Rincian Transaksi/Rincian
    // Piutang). Tidak mengubah computed hitung total yang sudah ada, cuma
    // ditambah SATU syarat lagi di awal filter masing-masing.
    const filterPelangganId = ref('');
    const daftarPelangganTransaksi = computed(() => {
      const peta = new Map();
      semuaTransaksi.value.forEach(t => { if (t.pelanggan_id && !peta.has(t.pelanggan_id)) peta.set(t.pelanggan_id, t.nama_pelanggan); });
      return Array.from(peta.entries()).map(([id, nama]) => ({ id, nama })).sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    });
    function lompatKe(idSeksi) {
      const el = document.getElementById(idSeksi);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function muat() {
      memuat.value = true;
      try {
        const [snapTrx, snapBayar] = await Promise.all([
          getDocs(collection(db, 'transaksi_kasir')),
          getDocs(collection(db, 'piutang_pembayaran'))
        ]);
        semuaTransaksi.value = snapTrx.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.pelanggan_id);
        semuaPembayaran.value = snapBayar.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.dibuat_pada?.seconds || 0) - (a.dibuat_pada?.seconds || 0));
      } catch (e) { console.error('Gagal muat Transaksi Keuangan:', e); }
      memuat.value = false;
    }

    function keadaanTempo(t) {
      if ((t.sisa_piutang || 0) <= 0) return { label: 'lunas', kelas: 'ok' };
      if (!t.jatuh_tempo) return { label: t.status_bayar === 'dp' ? ('DP ' + (t.dp_persen || 0) + '%') : (t.status_bayar || '-'), kelas: 'neutral' };
      const hariIni = new Date().toISOString().slice(0, 10);
      if (t.jatuh_tempo < hariIni) {
        const lewat = Math.round((new Date(hariIni) - new Date(t.jatuh_tempo)) / 86400000);
        return { label: `lewat tempo ${lewat} hari`, kelas: 'warn' };
      }
      const sisaHari = Math.round((new Date(t.jatuh_tempo) - new Date(hariIni)) / 86400000);
      if (sisaHari <= 3) return { label: 'jatuh tempo dekat', kelas: 'warn' };
      return { label: 'tempo ' + formatTanggalPendek(t.jatuh_tempo), kelas: 'neutral' };
    }

    // --- 4.1 kas besar — kelompok per pelanggan -----------------------------
    const kasBesar = computed(() => {
      const kata = cari.value.trim().toLowerCase();
      const peta = new Map();
      semuaTransaksi.value.forEach(t => {
        if (filterPelangganId.value && t.pelanggan_id !== filterPelangganId.value) return;
        if (!peta.has(t.pelanggan_id)) peta.set(t.pelanggan_id, { id: t.pelanggan_id, nama: t.nama_pelanggan, transaksi: [] });
        peta.get(t.pelanggan_id).transaksi.push(t);
      });
      let list = Array.from(peta.values()).map(p => {
        const nilai = p.transaksi.reduce((t, x) => t + (x.total || 0), 0);
        const sudahDibayar = p.transaksi.reduce((t, x) => t + (x.total_dibayar || 0), 0);
        const sisa = p.transaksi.reduce((t, x) => t + (x.sisa_piutang || 0), 0);
        const trxTertahan = p.transaksi.filter(x => (x.sisa_piutang || 0) > 0).sort((a, b) => (a.jatuh_tempo || '9999').localeCompare(b.jatuh_tempo || '9999'))[0];
        return { ...p, jumlah: p.transaksi.length, nilai, sudahDibayar, sisa, keadaan: trxTertahan ? keadaanTempo(trxTertahan) : { label: 'lunas', kelas: 'ok' } };
      });
      if (kata) list = list.filter(p => (p.nama || '').toLowerCase().includes(kata));
      list.sort((a, b) => b.sisa - a.sisa);
      return list;
    });
    const totalKasBesar = computed(() => ({
      nilai: kasBesar.value.reduce((t, p) => t + p.nilai, 0),
      sudahDibayar: kasBesar.value.reduce((t, p) => t + p.sudahDibayar, 0),
      sisa: kasBesar.value.reduce((t, p) => t + p.sisa, 0)
    }));

    // --- 4.1.1 popup catat pembayaran ---------------------------------------
    const popupBayar = ref(null); // { pelanggan, transaksiId, jumlah, metode, tanggal, catatan, noReferensi, buktiFile, buktiNamaFile }
    function bukaCatatPembayaran(p) {
      const belumLunas = p.transaksi.filter(x => (x.sisa_piutang || 0) > 0);
      if (belumLunas.length === 0) return;
      popupBayar.value = { pelanggan: p, transaksiId: belumLunas[0].id, jumlah: 0, metode: 'Tunai', tanggal: new Date().toISOString().slice(0, 10), catatan: '', noReferensi: '', buktiFile: null, buktiNamaFile: '', belumLunas };
    }
    const transaksiTerpilihBayar = computed(() => popupBayar.value ? popupBayar.value.belumLunas.find(x => x.id === popupBayar.value.transaksiId) : null);
    const riwayatBayarTerpilih = computed(() => transaksiTerpilihBayar.value ? semuaPembayaran.value.filter(b => b.transaksi_kasir_id === transaksiTerpilihBayar.value.id) : []);
    const sisaSesudahDicatat = computed(() => transaksiTerpilihBayar.value ? Math.max(0, (transaksiTerpilihBayar.value.sisa_piutang || 0) - (parseFloat(popupBayar.value.jumlah) || 0)) : 0);
    function lunasiSemua() { if (transaksiTerpilihBayar.value) popupBayar.value.jumlah = transaksiTerpilihBayar.value.sisa_piutang; }
    // S6 — bukti wajib Transfer/QRIS (lihat komentar susulan audit di atas
    // file). Tunai TETAP boleh kosong, persis wireframe 4.1.1.
    const buktiWajib = computed(() => !!popupBayar.value && popupBayar.value.metode !== 'Tunai');
    function pilihFotoBukti(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      popupBayar.value.buktiFile = file;
      popupBayar.value.buktiNamaFile = file.name;
    }

    const popupPinBayarTampil = ref(false);
    const menyimpanBayar = ref(false);
    function klikSimpanBayar() {
      if (!(parseFloat(popupBayar.value.jumlah) > 0)) return alert('Isi jumlah dibayar dulu.');
      if (parseFloat(popupBayar.value.jumlah) > (transaksiTerpilihBayar.value.sisa_piutang || 0)) return alert('Jumlah melebihi sisa piutang transaksi ini.');
      if (buktiWajib.value) {
        if (!popupBayar.value.noReferensi || !popupBayar.value.noReferensi.trim()) return alert('Isi nomor referensi transfer dulu — wajib untuk Transfer/QRIS.');
        if (!popupBayar.value.buktiFile) return alert('Lampirkan foto bukti transfer dulu — wajib untuk Transfer/QRIS.');
      }
      popupPinBayarTampil.value = true;
    }
    async function pinBayarSukses(user) {
      popupPinBayarTampil.value = false;
      if (!tierOwnerKeAtas(user)) { alert(`PIN ini bukan PIN Owner/PIC Owner/Superuser (peran: ${user.role}). Hanya Owner/PIC Owner yang boleh mencatat pembayaran.`); return; }
      menyimpanBayar.value = true;
      try {
        // S6 — upload foto bukti (kalau ada) SEBELUM catat pembayaran. Ini
        // lampiran, bukan bagian perhitungan uang — total_dibayar/
        // sisa_piutang/saldo_piutang di catatPembayaranSusulan tetap murni
        // dari `jumlah` seperti sebelumnya.
        let buktiFotoUrl = null;
        if (popupBayar.value.buktiFile) {
          buktiFotoUrl = await uploadFotoBuktiTransfer(transaksiTerpilihBayar.value.id, popupBayar.value.buktiFile);
        }
        await catatPembayaranSusulan({
          transaksiKasirId: transaksiTerpilihBayar.value.id, pelangganId: popupBayar.value.pelanggan.id, pelangganNama: popupBayar.value.pelanggan.nama,
          noTransaksi: transaksiTerpilihBayar.value.no_transaksi, jumlah: parseFloat(popupBayar.value.jumlah), metode: popupBayar.value.metode,
          tanggal: popupBayar.value.tanggal, catatan: popupBayar.value.catatan, dicatatOleh: user.email, pinPemilik: user.email,
          noReferensi: popupBayar.value.noReferensi, buktiFotoUrl
        });
        alert('Pembayaran tersimpan.');
        popupBayar.value = null;
        await muat();
      } catch (e) { console.error('Gagal catat pembayaran:', e); alert('Gagal menyimpan pembayaran. Coba lagi.'); }
      menyimpanBayar.value = false;
    }

    // --- 4.2.1 rincian transaksi (kas kecil) --------------------------------
    const rincianTransaksiTampil = computed(() => {
      const kata = cari.value.trim().toLowerCase();
      let list = semuaPembayaran.value;
      if (filterPelangganId.value) list = list.filter(b => b.pelanggan_id === filterPelangganId.value);
      if (kata) list = list.filter(b => (b.pelanggan_nama || '').toLowerCase().includes(kata) || (b.no_transaksi || '').toLowerCase().includes(kata));
      return list;
    });
    const totalPerMetode = computed(() => {
      const peta = { Tunai: 0, Transfer: 0, QRIS: 0 };
      rincianTransaksiTampil.value.forEach(b => { peta[b.metode] = (peta[b.metode] || 0) + (b.jumlah || 0); });
      return peta;
    });
    const totalUangMasuk = computed(() => rincianTransaksiTampil.value.reduce((t, b) => t + (b.jumlah || 0), 0));

    // --- 4.2.2 rincian piutang ----------------------------------------------
    const rincianPiutangTampil = computed(() => {
      const kata = cari.value.trim().toLowerCase();
      let list = semuaTransaksi.value.filter(t => (t.sisa_piutang || 0) > 0);
      if (filterPelangganId.value) list = list.filter(t => t.pelanggan_id === filterPelangganId.value);
      if (kata) list = list.filter(t => (t.nama_pelanggan || '').toLowerCase().includes(kata) || (t.no_transaksi || '').toLowerCase().includes(kata));
      return list.map(t => ({ ...t, keadaan: keadaanTempo(t) })).sort((a, b) => (a.jatuh_tempo || '9999').localeCompare(b.jatuh_tempo || '9999'));
    });

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      bolehLihat, sayaOwnerKeAtas, memuat, cari,
      filterPelangganId, daftarPelangganTransaksi, lompatKe,
      kasBesar, totalKasBesar, bukaCatatPembayaran,
      popupBayar, transaksiTerpilihBayar, riwayatBayarTerpilih, sisaSesudahDicatat, lunasiSemua,
      buktiWajib, pilihFotoBukti,
      popupPinBayarTampil, menyimpanBayar, klikSimpanBayar, pinBayarSukses,
      rincianTransaksiTampil, totalPerMetode, totalUangMasuk,
      rincianPiutangTampil,
      formatRupiah, formatRupiahJuta, formatTanggalPendek,
      METODE_PEMBAYARAN_OPSI
    };
  },
  template: `
    <div v-if="!bolehLihat" class="gc-card" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12.5px;">Akun ini tidak punya izin untuk Transaksi Keuangan.</div>
    <div v-else style="display:flex; flex-direction:column; gap:14px;">
      <!-- S5: GANTI dari 3 tab eksklusif jadi 1 halaman scroll berurutan
           (Kas Besar -> Rincian Transaksi -> Rincian Piutang) dengan pil
           navigasi cepat (anchor scroll, bukan tab exclusive) + 1 filter
           pelanggan bersama yang mengalir ke ketiga bagian. -->
      <div class="gc-card" style="padding:12px 14px; border-radius:16px; display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button @click="lompatKe('seksi-kas-besar')" type="button" class="btn-outline" style="padding:6px 13px; font-size:11px; border-radius:999px;">↓ Kas Besar</button>
          <button @click="lompatKe('seksi-rincian-transaksi')" type="button" class="btn-outline" style="padding:6px 13px; font-size:11px; border-radius:999px;">↓ Rincian Transaksi</button>
          <button @click="lompatKe('seksi-rincian-piutang')" type="button" class="btn-outline" style="padding:6px 13px; font-size:11px; border-radius:999px;">↓ Rincian Piutang</button>
        </div>
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:9px; background:var(--ivory-dim); border:1px solid var(--line); border-radius:999px; padding:9px 13px; flex:1; min-width:220px; max-width:320px;">
            <i class="fas fa-magnifying-glass" style="font-size:13px; color:var(--text-faint);"></i>
            <input v-model="cari" type="text" placeholder="Cari pelanggan / No. transaksi..." style="flex:1; min-width:0; border:none; outline:none; background:none; font-size:12px;">
          </div>
          <select v-model="filterPelangganId" style="flex:1; min-width:180px; max-width:260px; padding:9px 10px; border-radius:999px; border:1px solid var(--line); background:#fff; font-size:11.5px;">
            <option value="">Semua pelanggan</option>
            <option v-for="p in daftarPelangganTransaksi" :key="p.id" :value="p.id">{{ p.nama }}</option>
          </select>
          <span v-if="filterPelangganId" @click="filterPelangganId = ''" style="font-size:10.5px; color:var(--burgundy); cursor:pointer; text-decoration:underline;">reset filter pelanggan</span>
        </div>
      </div>

      <div v-if="memuat" class="gc-card" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

      <template v-else>
        <div id="seksi-kas-besar" class="gc-card" style="padding:14px 16px; border-radius:20px; scroll-margin-top:16px;">
          <h3 style="font-weight:700; font-size:13.5px; margin-bottom:10px;"><i class="fas fa-sack-dollar" style="color:var(--aksen-ink); margin-right:8px;"></i>Kas Besar</h3>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(100px,1fr)); gap:8px; background:var(--ivory-dim); border-radius:14px; padding:12px; margin-bottom:14px;">
            <div><div style="font-size:9.5px; color:var(--text-faint);">nilai penjualan</div><div style="font-weight:700; font-size:17px;">{{ formatRupiahJuta(totalKasBesar.nilai) }}</div></div>
            <div><div style="font-size:9.5px; color:var(--text-faint);">sudah dibayar</div><div style="font-weight:700; font-size:17px;">{{ formatRupiahJuta(totalKasBesar.sudahDibayar) }}</div></div>
            <div><div style="font-size:9.5px; color:var(--warn-text);">sisa piutang</div><div style="font-weight:700; font-size:17px; color:var(--warn-text);">{{ formatRupiahJuta(totalKasBesar.sisa) }}</div></div>
            <div><div style="font-size:9.5px; color:var(--text-faint);">pelanggan</div><div style="font-weight:700; font-size:17px;">{{ kasBesar.length }}</div></div>
          </div>
          <div v-if="kasBesar.length === 0" class="gc-kosong"><div class="lingkaran"><i class="fas fa-sack-dollar"></i></div><h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada transaksi</h3></div>
          <div v-else style="display:flex; flex-direction:column; gap:8px;">
            <div v-for="p in kasBesar" :key="p.id" class="gc-card" style="padding:10px 14px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
              <div style="flex:1; min-width:160px;"><div style="font-weight:700; font-size:12.5px;">{{ p.nama }}</div><div style="font-size:9.5px; color:var(--text-faint);">{{ p.jumlah }} pesanan</div></div>
              <div style="text-align:right; min-width:100px;"><div style="font-size:9px; color:var(--text-faint);">nilai</div><div style="font-weight:700; font-size:12px;">{{ formatRupiah(p.nilai) }}</div></div>
              <div style="text-align:right; min-width:100px;"><div style="font-size:9px; color:var(--text-faint);">sudah dibayar</div><div style="font-size:11.5px;">{{ formatRupiah(p.sudahDibayar) }}</div></div>
              <div style="text-align:right; min-width:100px;"><div style="font-size:9px; color:var(--warn-text);">sisa</div><div style="font-weight:700; font-size:12.5px; color:var(--warn-text);">{{ formatRupiah(p.sisa) }}</div></div>
              <span class="tag" :class="p.keadaan.kelas" style="font-size:10px;">{{ p.keadaan.label }}</span>
              <button v-if="sayaOwnerKeAtas && p.sisa > 0" @click="bukaCatatPembayaran(p)" class="btn-primary" style="padding:7px 12px; font-size:11px;">Catat pembayaran</button>
            </div>
          </div>
        </div>

        <div id="seksi-rincian-transaksi" class="gc-card" style="padding:14px 16px; border-radius:20px; scroll-margin-top:16px;">
          <h3 style="font-weight:700; font-size:13.5px; margin-bottom:10px;"><i class="fas fa-receipt" style="color:var(--aksen-ink); margin-right:8px;"></i>Rincian Transaksi</h3>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(90px,1fr)); gap:8px; margin-bottom:14px;">
            <div class="gc-card" style="padding:8px 10px;"><div style="font-size:9px; color:var(--text-faint);">uang masuk</div><div style="font-weight:700; font-size:15px;">{{ formatRupiahJuta(totalUangMasuk) }}</div></div>
            <div class="gc-card" style="padding:8px 10px;"><div style="font-size:9px; color:var(--text-faint);">tunai</div><div style="font-weight:700; font-size:15px;">{{ formatRupiahJuta(totalPerMetode.Tunai) }}</div></div>
            <div class="gc-card" style="padding:8px 10px;"><div style="font-size:9px; color:var(--text-faint);">transfer</div><div style="font-weight:700; font-size:15px;">{{ formatRupiahJuta(totalPerMetode.Transfer) }}</div></div>
            <div class="gc-card" style="padding:8px 10px;"><div style="font-size:9px; color:var(--text-faint);">QRIS</div><div style="font-weight:700; font-size:15px;">{{ formatRupiahJuta(totalPerMetode.QRIS) }}</div></div>
          </div>
          <div v-if="rincianTransaksiTampil.length === 0" class="gc-kosong"><div class="lingkaran"><i class="fas fa-receipt"></i></div><h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada catatan</h3></div>
          <div v-else class="gc-table-scroll">
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
              <thead><tr style="text-align:left; color:var(--text-faint); font-size:10px;"><th style="padding:6px;">pelanggan &amp; pesanan</th><th style="padding:6px;">cara</th><th style="padding:6px;">nilai</th><th style="padding:6px;">dicatat oleh</th></tr></thead>
              <tbody>
                <tr v-for="b in rincianTransaksiTampil" :key="b.id" style="border-top:1px solid var(--line);">
                  <td style="padding:7px 6px;"><div style="font-weight:700;">{{ b.pelanggan_nama }}</div><div style="font-size:10px; color:var(--text-faint);">{{ b.no_transaksi }} &middot; {{ b.jenis }}</div></td>
                  <td style="padding:7px 6px;">{{ b.metode }}</td>
                  <td style="padding:7px 6px; font-weight:700;">{{ formatRupiah(b.jumlah) }}</td>
                  <td style="padding:7px 6px; color:var(--text-faint);">{{ b.dicatat_oleh }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style="font-size:9.5px; color:var(--text-faint); margin-top:10px;">Hanya dibaca — baris lahir otomatis dari Kasir atau popup Catat Pembayaran.</p>
        </div>

        <div id="seksi-rincian-piutang" class="gc-card" style="padding:14px 16px; border-radius:20px; scroll-margin-top:16px;">
          <h3 style="font-weight:700; font-size:13.5px; margin-bottom:10px;"><i class="fas fa-file-invoice-dollar" style="color:var(--aksen-ink); margin-right:8px;"></i>Rincian Piutang</h3>
          <div v-if="rincianPiutangTampil.length === 0" class="gc-kosong"><div class="lingkaran"><i class="fas fa-check"></i></div><h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada piutang berjalan</h3></div>
          <div v-else class="gc-table-scroll">
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
              <thead><tr style="text-align:left; color:var(--text-faint); font-size:10px;"><th style="padding:6px;">no. pesanan</th><th style="padding:6px;">pelanggan</th><th style="padding:6px;">total</th><th style="padding:6px;">dibayar</th><th style="padding:6px;">sisa</th><th style="padding:6px;">keadaan</th></tr></thead>
              <tbody>
                <tr v-for="t in rincianPiutangTampil" :key="t.id" style="border-top:1px solid var(--line);">
                  <td style="padding:7px 6px; font-weight:700;">{{ t.no_transaksi }}</td>
                  <td style="padding:7px 6px;">{{ t.nama_pelanggan }}</td>
                  <td style="padding:7px 6px;">{{ formatRupiah(t.total) }}</td>
                  <td style="padding:7px 6px;">{{ formatRupiah(t.total_dibayar) }}</td>
                  <td style="padding:7px 6px; font-weight:700; color:var(--warn-text);">{{ formatRupiah(t.sisa_piutang) }}</td>
                  <td style="padding:7px 6px;"><span class="tag" :class="t.keadaan.kelas">{{ t.keadaan.label }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style="font-size:9.5px; color:var(--text-faint); margin-top:10px;">Isinya otomatis — pesanan berstatus DP/Tempo/Cicilan, yang Lunas tidak muncul.</p>
        </div>
      </template>
    </div>

    <div v-if="popupBayar" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="popupBayar = null">
      <div class="gc-card" style="max-width:440px; width:100%; max-height:88vh; overflow-y:auto; padding:18px;">
        <div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:10px;">
          <div><h3 style="font-weight:700; font-size:14px; margin:0;">Catat pembayaran</h3><p style="font-size:10px; color:var(--text-faint); margin:2px 0 0;">{{ popupBayar.pelanggan.nama }}</p></div>
          <button @click="popupBayar = null" class="icon-btn" style="margin-left:auto;"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="gc-field"><label>Pilih Transaksi</label>
          <select v-model="popupBayar.transaksiId">
            <option v-for="t in popupBayar.belumLunas" :key="t.id" :value="t.id">{{ t.no_transaksi }} — sisa {{ formatRupiah(t.sisa_piutang) }}</option>
          </select>
        </div>
        <div v-if="transaksiTerpilihBayar" style="display:flex; gap:8px; margin-bottom:10px;">
          <div class="gc-card" style="flex:1; padding:7px 9px;"><div style="font-size:9px; color:var(--text-faint);">total</div><div style="font-weight:700;">{{ formatRupiah(transaksiTerpilihBayar.total) }}</div></div>
          <div class="gc-card" style="flex:1; padding:7px 9px;"><div style="font-size:9px; color:var(--text-faint);">sudah dibayar</div><div style="font-weight:700;">{{ formatRupiah(transaksiTerpilihBayar.total_dibayar) }}</div></div>
        </div>
        <div class="gc-card" style="background:rgba(var(--burgundy-rgb),.05); border-color:var(--burgundy); padding:9px 11px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:baseline;">
          <span style="font-size:10px; color:var(--text-faint);">sisa piutang</span><span style="font-weight:700; font-size:19px;">{{ formatRupiah(transaksiTerpilihBayar ? transaksiTerpilihBayar.sisa_piutang : 0) }}</span>
        </div>
        <div v-if="riwayatBayarTerpilih.length > 0" style="margin-bottom:12px;">
          <div style="font-size:10px; color:var(--text-faint); margin-bottom:6px;">riwayat pembayaran ({{ riwayatBayarTerpilih.length }} catatan)</div>
          <div v-for="(r, idx) in riwayatBayarTerpilih" :key="r.id" style="display:flex; gap:8px; font-size:11px; padding:5px 7px; background:var(--ivory-dim); border-radius:6px; margin-bottom:4px;">
            <span style="width:70px; flex-shrink:0; color:var(--text-faint);">{{ r.tanggal }}</span>
            <span style="flex:1;">{{ r.jenis === 'dp' ? 'DP saat kasir' : (r.jenis === 'tunai_lunas' ? 'Bayar penuh' : ('Cicilan ke-' + idx)) }} &middot; {{ r.metode }}</span>
            <span style="font-weight:700;">{{ formatRupiah(r.jumlah) }}</span>
          </div>
          <p style="font-size:8.5px; color:var(--text-faint);">tidak bisa dihapus &middot; pembatalan belum didukung di versi ini</p>
        </div>
        <div class="gc-field"><label>Jumlah dibayar sekarang</label>
          <input v-model.number="popupBayar.jumlah" type="number" min="0">
          <div style="display:flex; gap:6px; margin-top:6px;">
            <button @click="popupBayar.jumlah = 1000000" type="button" class="btn-outline" style="flex:1; padding:5px; font-size:10.5px;">1 jt</button>
            <button @click="popupBayar.jumlah = 2500000" type="button" class="btn-outline" style="flex:1; padding:5px; font-size:10.5px;">2,5 jt</button>
            <button @click="popupBayar.jumlah = 5000000" type="button" class="btn-outline" style="flex:1; padding:5px; font-size:10.5px;">5 jt</button>
            <button @click="lunasiSemua" type="button" class="btn-outline filled" style="flex:1; padding:5px; font-size:10.5px;">Lunasi semua</button>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <div class="gc-field" style="flex:1;"><label>Cara Bayar</label>
            <select v-model="popupBayar.metode"><option v-for="m in METODE_PEMBAYARAN_OPSI" :key="m" :value="m">{{ m }}</option></select>
          </div>
          <div class="gc-field" style="flex:1;"><label>Tanggal Terima</label><input v-model="popupBayar.tanggal" type="date"></div>
        </div>
        <div class="gc-field"><label>Catatan</label><input v-model="popupBayar.catatan" type="text" placeholder="Opsional"></div>
        <!-- S6 — blok "bukti & catatan" WAJIB khusus Transfer/QRIS (no.
             referensi transfer + lampirkan foto). Tunai TETAP boleh kosong. -->
        <div class="gc-card" style="padding:9px 11px; margin-bottom:12px;" :style="{borderColor: buktiWajib ? 'var(--burgundy)' : 'var(--line)'}">
          <label style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--text-faint); display:block; margin-bottom:6px;">Bukti &amp; Catatan <span v-if="buktiWajib" style="color:var(--danger);">* wajib</span></label>
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            <input v-model="popupBayar.noReferensi" type="text" placeholder="no. referensi transfer" style="flex:1; min-width:140px; padding:8px 10px; border:1px solid var(--line); border-radius:8px; font-size:11.5px;">
            <label class="btn-outline" :class="{filled: popupBayar.buktiFile}" style="padding:8px 12px; font-size:10.5px; cursor:pointer; margin:0;">
              <i class="fas fa-camera" style="margin-right:6px;"></i>{{ popupBayar.buktiFile ? 'Foto terpilih' : 'Lampirkan foto' }}
              <input type="file" accept="image/*" @change="pilihFotoBukti" style="display:none;">
            </label>
          </div>
          <div v-if="popupBayar.buktiNamaFile" style="font-size:9.5px; color:var(--text-faint); margin-top:5px;"><i class="fas fa-paperclip" style="margin-right:4px;"></i>{{ popupBayar.buktiNamaFile }}</div>
          <p style="font-size:8.5px; color:var(--text-faint); margin-top:5px; margin-bottom:0;">wajib untuk Transfer dan QRIS &middot; Tunai boleh kosong</p>
        </div>
        <div class="gc-card" style="background:rgba(var(--ok-rgb),.06); border-color:var(--ok); padding:9px 11px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between;"><span style="font-size:10px; color:#4a6540;">sisa sesudah dicatat</span><span style="font-weight:700; font-size:16px;">{{ formatRupiah(sisaSesudahDicatat) }}</span></div>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="popupBayar = null" class="btn-outline" style="flex:1;">Batal</button>
          <button @click="klikSimpanBayar" :disabled="menyimpanBayar" class="btn-primary" style="flex:1;">{{ menyimpanBayar ? 'Menyimpan...' : 'Simpan' }}</button>
        </div>
      </div>
    </div>

    <popup-pin v-if="popupPinBayarTampil" judul="PIN Owner / PIC Owner" pesan="Mencatat pembayaran wajib PIN Owner/PIC Owner." @sukses="pinBayarSukses" @batal="popupPinBayarTampil = false" />
  `
};

// ============================================================================
// Mount functions — 1 per sub-tab, dipanggil window.pastikanMountXxx() dari
// js/dashboard.js (petaMount). "Persiapan"/"Produksi"/"Pengiriman" (ringkasan
// lama) DIHAPUS TOTAL, diganti pastikanMountPesananDaftar/Transaksi.
// ============================================================================
const AppPesananKasir = { components: { PesananKasirManager }, template: `<pesanan-kasir-manager />` };
let vmPesananKasir = null;
window.pastikanMountPesananKasir = function() {
  if (vmPesananKasir) return;
  const mountPoint = document.getElementById('vue-pesanan-kasir');
  if (mountPoint) vmPesananKasir = createApp(AppPesananKasir).mount('#vue-pesanan-kasir');
};

const AppPesananMenunggu = { components: { PesananMenungguManager }, template: `<pesanan-menunggu-manager />` };
let vmPesananMenunggu = null;
window.pastikanMountPesananMenunggu = function() {
  if (vmPesananMenunggu) return;
  const mountPoint = document.getElementById('vue-pesanan-menunggu');
  if (mountPoint) vmPesananMenunggu = createApp(AppPesananMenunggu).mount('#vue-pesanan-menunggu');
};

const AppPesananDaftar = { components: { PesananDaftarManager }, template: `<pesanan-daftar-manager />` };
let vmPesananDaftar = null;
window.pastikanMountPesananDaftar = function() {
  if (vmPesananDaftar) return;
  const mountPoint = document.getElementById('vue-pesanan-daftar');
  if (mountPoint) vmPesananDaftar = createApp(AppPesananDaftar).mount('#vue-pesanan-daftar');
};

const AppPesananTransaksi = { components: { PesananTransaksiManager }, template: `<pesanan-transaksi-manager />` };
let vmPesananTransaksi = null;
window.pastikanMountPesananTransaksi = function() {
  if (vmPesananTransaksi) return;
  const mountPoint = document.getElementById('vue-pesanan-transaksi');
  if (mountPoint) vmPesananTransaksi = createApp(AppPesananTransaksi).mount('#vue-pesanan-transaksi');
};
