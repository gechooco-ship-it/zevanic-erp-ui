// js/vue-scan-cetak.js
// ============================================================================
// DIPERBARUI (7 Sep 2026, lanjutan §5.18) — ditambah `ajukanPersiapanMasalah()`,
// dipakai retrofit Scan Masalah 4 pos Persiapan Produksi supaya benar-benar
// membuat dokumen `persiapan_masalah` skema baru (lihat komentar di fungsi
// itu sendiri, di bawah). Bukan bagian dari cakupan asli menu Scan & Cetak,
// cuma numpang di file ini karena ini FONDASI generik lintas pos.
// ============================================================================
// Menu BARU top-level "Scan & Cetak" (7 Sep 2026, handoff "05 - Scan dan
// Cetak", dikerjakan via /design-terapkan-handoff atas instruksi Guru:
// "kerjakan terapkan dan seluruh turunannya"). Sejajar Zevanic House/
// Pesanan/Persiapan Produksi (keputusan Guru via AskUserQuestion).
//
// FILE INI = FONDASI yang dipakai modul lain (Persiapan Produksi yang
// direfaktor, dan modul Proses Produksi baru: Cutting/Sewing/Finishing/
// Serie/Gudang Barang Jadi) — bukan cuma isi menu Scan & Cetak itu sendiri.
// Wireframe grup 4 (PIN) & bagian scan generik grup 2 SECARA EKSPLISIT
// minta "komponen generik, bikin sekali panggil di mana-mana" — BEDA dari
// konvensi lama proyek ini yang menyalin fungsi kecil (hashPin dst) di
// setiap file yang butuh. Ini folder file BARU yang genuinely di-import
// (pola sama seperti PopupPratinjauCetakLabel/KolomCari di vue-
// components.js), bukan disalin lagi.
//
// PENTING (batas cakupan, biar tidak salah paham): PopupPinGenerik &
// ScanGenerik di file ini WAJIB dipakai oleh semua kode BARU yang ditulis
// sesudah ini (Persiapan Produksi yang direfaktor, 5 modul Proses Produksi
// baru). File-file LAMA yang sudah punya PopupPin/hashPin sendiri (vue-
// pesanan.js, vue-stock-pembelian.js, vue-absensi-qr.js, vue-account-
// profile.js, vue-camera.js) TIDAK ikut dirombak di sini — migrasi mereka
// ke komponen generik ini adalah pekerjaan terpisah (disebutkan sebagai
// dependensi belum terpenuhi di laporan penutup), supaya modul yang sudah
// stabil & berjalan tidak ikut berisiko disentuh di luar cakupan tugas ini.
//
// Koleksi `riwayat_pin` — SUDAH ADA di Firestore (dibuat pagi ini, §5.13,
// AppConfigRiwayatPin di js/vue-config.js), TAPI belum ada satupun kode
// yang MENULIS ke situ (dicek: grep "riwayat_pin'" cuma nemu pembaca).
// PopupPinGenerik di sini PERTAMA KALI benar-benar menulis ke koleksi ini.
// Bentuk field ikut dokumentasi "tebakan terbaik" yang sudah ditulis di
// vue-config.js (UNCONFIRMED, forward-compatible):
//   { uid, nama_pengguna, menu, berhasil, waktu }
// KEPUTUSAN implementasi (tidak eksplisit di SERAH-TERIMA manapun, dibuat
// di sini karena cuma soal bentuk log internal, bukan perilaku user-facing
// — kalau Guru mau bentuk lain, tabel Riwayat PIN tinggal disesuaikan):
//   - PIN cocok & berwenang -> nama_pengguna = pemilik PIN, berhasil:true.
//   - PIN cocok TAPI role tidak termasuk rolesDiizinkan -> berhasil:false,
//     nama_pengguna = pemilik PIN (biar kelihatan SIAPA yang PIN-nya
//     dipakai tapi ditolak, bukan disamakan dengan "PIN salah total").
//   - PIN tidak cocok siapapun -> nama_pengguna = 'Tidak dikenali (PIN
//     salah)', uid = null.
// ============================================================================
import { createApp, ref, reactive, watch, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, getDocs, query, where, orderBy, limit, startAfter, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

// ---------------------------------------------------------------------------
// PIN per akun — DIPINDAH ke sini sebagai SATU-SATUNYA salinan "resmi" baru
// (lihat catatan besar di atas). Logic identik dengan hashPin/tierOwnerKeAtas/
// cariUserByPin di js/vue-stock-pembelian.js (disalin, sudah dipakai di 4
// titik lain sebelum ini) — TIDAK diubah, cuma dipindah ke modul yang bisa
// diimpor supaya kode baru selanjutnya tidak perlu salin lagi.
// ---------------------------------------------------------------------------
export async function hashPin(pin, email) {
  const data = new TextEncoder().encode(pin + '|' + email);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
const MAKS_PERCOBAAN_PIN = 3;

export function tierOwnerKeAtas(userData) {
  if (!userData) return false;
  const role = (userData.role || '').toLowerCase();
  if (role === 'owner' || role === 'superuser') return true;
  return role === 'pic' && (userData.profil_akses || '').toLowerCase() === 'pic_owner';
}

// tagRole — dipakai khusus PopupPinGenerik utk cek `rolesDiizinkan`. Nilai
// yang mungkin: 'owner', 'superuser', 'pic_owner', 'pic', 'admin'.
function tagRole(userData) {
  const role = (userData.role || '').toLowerCase();
  if (role === 'pic' && (userData.profil_akses || '').toLowerCase() === 'pic_owner') return 'pic_owner';
  return role;
}

export async function cariUserByPin(pinInput) {
  const snap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['owner', 'superuser', 'pic', 'admin'])));
  for (const d of snap.docs) {
    const u = d.data();
    if (!u.pin_hash) continue;
    const hash = await hashPin(pinInput, d.id);
    if (hash === u.pin_hash) return { email: d.id, ...u };
  }
  return null;
}

// catatRiwayatPin — best-effort (kalau gagal tulis, JANGAN gagalkan alur
// utama pemanggil — cukup log ke console, sama pola dgn log lain di app
// ini yang sifatnya catatan/riwayat, bukan data transaksi inti).
export async function catatRiwayatPin(menu, berhasil, user) {
  try {
    await addDoc(collection(db, 'riwayat_pin'), {
      uid: user ? (user.email || null) : null,
      nama_pengguna: user ? (user.nama || user.name || user.email) : 'Tidak dikenali (PIN salah)',
      menu: menu || '-',
      berhasil: !!berhasil,
      waktu: serverTimestamp()
    });
  } catch (e) {
    console.error('Gagal mencatat riwayat_pin:', menu, e);
  }
}

// ---------------------------------------------------------------------------
// PopupPinGenerik — komponen generik verifikasi PIN "per akun" (wireframe
// "05 - Scan dan Cetak" §4.0, DRAWN — 2 state: bersih & salah). Visual TETAP
// pakai gc-card/style resmi proyek (BUKAN direka dari warna/ukuran wireframe
// low-fi) — sama konvensi PopupPin lama, cuma sekarang genuinely importable
// + mencatat riwayat_pin di setiap percobaan (sukses maupun gagal).
//
// Props:
//   judul            - default 'Verifikasi PIN'
//   pesan            - keterangan tambahan di bawah judul (opsional)
//   konteks          - WAJIB, string nama menu/aksi (dicatat sbg field
//                      `menu` di riwayat_pin), mis. 'Cutting - Scan Operator'
//   rolesDiizinkan   - Array opsional, mis. ['owner','pic_owner']. null/
//                      undefined = semua PIN admin-level (owner/superuser/
//                      pic/admin) diterima (perilaku PopupPin lama).
// Emits: sukses(user), batal
// ---------------------------------------------------------------------------
export const PopupPinGenerik = {
  props: {
    judul: { type: String, default: 'Verifikasi PIN' },
    pesan: { type: String, default: '' },
    konteks: { type: String, required: true },
    rolesDiizinkan: { type: Array, default: null }
  },
  emits: ['sukses', 'batal'],
  setup(props, { emit }) {
    const pin = ref('');
    const error = ref('');
    const percobaan = ref(0);
    const terkunci = ref(false);
    const memverifikasi = ref(false);
    async function kirim() {
      if (terkunci.value) return;
      if (!/^\d{6}$/.test(pin.value)) { error.value = 'PIN wajib 6 angka.'; return; }
      memverifikasi.value = true;
      error.value = '';
      try {
        const user = await cariUserByPin(pin.value);
        if (user) {
          const berwenang = !props.rolesDiizinkan || props.rolesDiizinkan.includes(tagRole(user));
          if (berwenang) {
            pin.value = ''; percobaan.value = 0;
            await catatRiwayatPin(props.konteks, true, user);
            emit('sukses', user);
            memverifikasi.value = false;
            return;
          } else {
            await catatRiwayatPin(props.konteks, false, user);
            error.value = `PIN benar (${user.nama || user.email}), tapi role ini tidak berwenang untuk aksi ini.`;
            pin.value = '';
            memverifikasi.value = false;
            return;
          }
        }
        percobaan.value++;
        await catatRiwayatPin(props.konteks, false, null);
        if (percobaan.value >= MAKS_PERCOBAAN_PIN) {
          terkunci.value = true;
          error.value = `PIN salah ${MAKS_PERCOBAAN_PIN}x berturut-turut. Tutup popup ini dan coba lagi.`;
        } else {
          error.value = `PIN salah. Sisa percobaan: ${MAKS_PERCOBAAN_PIN - percobaan.value}.`;
        }
        pin.value = '';
      } catch (e) {
        console.error('Gagal verifikasi PIN:', e);
        error.value = 'Terjadi kesalahan sistem, coba lagi.';
      }
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
// ajukanPersiapanMasalah — retrofit (7 Sep 2026, lanjutan §5.18) — SATU
// tempat yang benar-benar membuat dokumen `persiapan_masalah` (skema BARU
// pos Masalah 7-tahap, lihat header js/vue-pp-masalah.js) dari "Scan
// Masalah" di 4 pos Persiapan Produksi (Bahan/Acc Sewing/Acc Webbing/Acc
// Finishing). SEBELUM retrofit ini, Scan Masalah di 4 pos itu CUMA
// mencatat `catatan_masalah` teks bebas di baris spk_track — TIDAK PERNAH
// membuat dokumen apapun, jadi modul Masalah (§5.18) selalu tampil kosong
// walau ada kekurangan sungguhan. Ini fungsi TAMBAHAN, dipanggil BERSAMA
// (bukan menggantikan) updateBaris<Pos>() yang tetap menulis catatan_
// masalah seperti sebelumnya (baris TETAP tampil dengan badge merah di pos
// asalnya, TIDAK berubah status — operator masih bisa Scan Entry normal
// begitu kekurangan itu terpenuhi lewat alur Masalah/stok manual; menghapus
// catatan_masalah lagi saat itu BUKAN bagian retrofit ini, SERAH-TERIMA
// tidak memintanya).
//
// Field dokumen mengikuti skema yang SUDAH didokumentasikan di header
// js/vue-pp-masalah.js §5.18 (ditulis SEBELUM retrofit ini, bukan ditebak
// sekarang): tlc_asal, sumber_jalur, spk_track_id, baris_index,
// bahan_aksesoris_id/bahan_nama/bahan_warna/satuan/no_spk (snapshot),
// qty_kurang, qty_entry_asal, alasan_masalah, scan_oleh, scan_pada,
// status:'perlu_diajukan'. Tiap pemanggil (4 pos) menyuplai tlcAsal/
// sumberJalur miliknya sendiri (literal, bukan lookup tabel — tiap file
// pos cuma tahu 1 jalur, tidak perlu peta 4 jalur sekaligus).
// ---------------------------------------------------------------------------
export async function ajukanPersiapanMasalah(opsi) {
  const now = new Date().toISOString();
  const oleh = window.currentUser?.email || '';
  const kurang = parseFloat(opsi.qtyKurang) || 0;
  const entryAsal = (opsi.qtyEntryAsal === null || opsi.qtyEntryAsal === undefined || isNaN(opsi.qtyEntryAsal)) ? null : parseFloat(opsi.qtyEntryAsal);
  await addDoc(collection(db, 'persiapan_masalah'), {
    tlc_asal: opsi.tlcAsal || '',
    sumber_jalur: opsi.sumberJalur || '',
    spk_track_id: opsi.trackId || '',
    baris_index: (opsi.lineIdx === undefined || opsi.lineIdx === null) ? null : opsi.lineIdx,
    bahan_aksesoris_id: opsi.bahanAksesorisId || '',
    bahan_nama: opsi.bahanNama || '',
    bahan_warna: opsi.bahanWarna || '',
    satuan: opsi.satuan || '',
    no_spk: opsi.noSpk || '',
    qty_kurang: kurang,
    qty_entry_asal: entryAsal,
    alasan_masalah: opsi.alasan || '',
    scan_oleh: oleh,
    scan_pada: now,
    status: 'perlu_diajukan',
    dibuat_pada: serverTimestamp()
  });
}

// ---------------------------------------------------------------------------
// muatJsQr / buatQrDataUrl / cariKaryawanByQr — DIPINDAH dari js/vue-
// persiapan-produksi-v2.js (logic identik, cuma sekarang diimpor, bukan
// disalin lagi oleh modul-modul BARU sesudah ini).
// ---------------------------------------------------------------------------
export function muatJsQr() {
  return new Promise((resolve, reject) => {
    if (window.jsQR) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
export function buatQrDataUrl(teks) {
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
export async function cariKaryawanByQr(qrData) {
  const qSnap = await getDocs(query(collection(db, 'users'), where('id_app', '==', qrData)));
  if (!qSnap.empty) return { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
  const docSnap = await getDoc(doc(db, 'users', qrData));
  if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
  return null;
}

// ---------------------------------------------------------------------------
// ScanGenerik — komponen kamera/QR generik (wireframe grup 2, 6 jenis scan
// Persiapan Produksi + turunannya di Cutting/Serie/Sewing/Finishing/Gudang).
// SENGAJA tidak tahu apa-apa soal Firestore/mode/validasi kode — cuma
// "nyalakan kamera, baca QR, kembalikan teksnya" lewat event `hasil`.
// Pemanggil-lah yang memvalidasi kode (kode_spk/kode_bagging/kode_tugas/
// kode_pcs/dst — beda-beda tiap pos) dan menulis ke Firestore-nya sendiri —
// ini SENGAJA (wireframe 2.2: "Scan Entry = satu-satunya titik pengurangan
// stok", tiap pos punya aturan sendiri soal APA yang harus terjadi setelah
// scan, bukan sesuatu yang bisa digeneralisir ke 1 fungsi).
//
// INTERFACE (revisi 7 Sep 2026, refactor 4 pos Persiapan Produksi): dibuat
// PERSIS SAMA dengan `ModalScanQr` yang sebelumnya disalin identik di 4 file
// vue-persiapan-{bahan,sewing,webbing,finishing}.js — BUKAN interface lama
// (judul/instruksi, emit hasil+batal, single-shot). Alasan: Persiapan
// Produksi butuh "scan berkali-kali tanpa buka-tutup kamera manual" (mis.
// Tunjuk Operator lalu scan N anak-SPK berturut-turut, atau Scan Pack/Scan
// Kirim per bagging/tugas) — interface lama berhenti setelah 1 hasil, tidak
// cukup. Karena belum ada satupun kode produksi yang memakai interface lama
// ini (baru didaftarkan, belum diimpor di mana-mana), aman diganti total
// tanpa breaking change.
//
// Props: aktif (Boolean, default false — kontrol on/off kamera dari induk
// via v-model/computed, BUKAN v-if di induk — video tag di dalam template
// ini sendiri yang v-if="aktif"), judul (baris tebal), subjudul (opsional,
// baris kecil di bawahnya).
// Emits: hasil(kodeTeks) — ditembak SETIAP kali berhasil decode, kamera
// TETAP menyala (auto-lanjut scan lagi setelah jeda 900ms) selama `aktif`
// masih true; tutup — user pencet tombol Tutup, induk yang set aktif=false.
// ---------------------------------------------------------------------------
export const ScanGenerik = {
  props: { aktif: { type: Boolean, default: false }, judul: String, subjudul: String },
  emits: ['hasil', 'tutup'],
  setup(props, { emit }) {
    const videoEl = ref(null), canvasEl = ref(null);
    const memuatKamera = ref(false), error = ref('');
    let stream = null, frameId = null, timeoutId = null;
    // FIX BUG (10 Sep 2026, laporan Guru — "Tunjuk Operator" salah tunjuk,
    // muncul "Kode 'ZMS-4733' tidak cocok baris manapun..."). Root cause:
    // kamera auto-lanjut scan tiap 900ms TANPA cek apakah QR yang kelihatan
    // MASIH SAMA (badge/label masih di depan kamera, belum sempat diganti).
    // "ZMS..." adalah prefix id_app KARYAWAN (lihat idAcak('ZMS') di
    // vue-registrasi.js) — kode operator yang baru dipakai untuk tahap
    // "operator" ke-scan ULANG 900ms kemudian, tapi tahap sudah pindah ke
    // "anak" -> dicocokkan ke no_spk, gagal, pesan error jadi membingungkan.
    // Ini bug di ScanGenerik sendiri (dipakai semua pos scan: Tunjuk
    // Operator, Scan Pack, Scan Kirim, dst), BUKAN salah kode/data. Fix:
    // kode yang SAMA dengan hasil scan sebelumnya TIDAK di-emit ulang
    // selama kamera terus-menerus melihatnya; begitu kamera sempat TIDAK
    // mendeteksi QR sama sekali (badge/label sudah diangkat/diganti), kode
    // berikutnya (termasuk kode yang sama, kalau memang sengaja discan
    // lagi) dianggap scan baru. Interval 900ms & alur multi-scan lain tidak
    // diubah.
    let kodeSebelumnya = null;

    async function mulai() {
      kodeSebelumnya = null; // sesi kamera baru -> kode apa pun (termasuk sisa sesi lalu) dianggap scan baru
      memuatKamera.value = true; error.value = '';
      try { await muatJsQr(); } catch (e) {
        error.value = 'Gagal memuat modul pembaca QR. Cek koneksi internet.'; memuatKamera.value = false; return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (videoEl.value) { videoEl.value.srcObject = stream; await videoEl.value.play(); }
        memuatKamera.value = false;
        pindai();
      } catch (e) {
        error.value = 'Gagal mengakses kamera. Pastikan izin kamera diaktifkan.'; memuatKamera.value = false;
      }
    }
    function pindai() {
      if (!stream) return;
      const video = videoEl.value, canvas = canvasEl.value;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const gambar = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const kode = window.jsQR(gambar.data, gambar.width, gambar.height, { inversionAttempts: 'dontInvert' });
        if (kode && kode.data) {
          const teks = kode.data.trim();
          if (teks === kodeSebelumnya) {
            // Kode sama, badge/label belum sempat diangkat dari kamera —
            // JANGAN emit ulang (lihat catatan bug di atas). Tetap lanjut
            // memindai supaya begitu diganti, langsung kebaca.
            timeoutId = setTimeout(() => { if (stream) pindai(); }, 900);
            return;
          }
          kodeSebelumnya = teks;
          if (navigator.vibrate) navigator.vibrate(120);
          emit('hasil', teks);
          timeoutId = setTimeout(() => { if (stream) pindai(); }, 900);
          return;
        }
        kodeSebelumnya = null; // kamera tidak melihat QR apa pun -> scan berikutnya dianggap baru lagi
      }
      frameId = requestAnimationFrame(pindai);
    }
    function berhenti() {
      if (frameId) { cancelAnimationFrame(frameId); frameId = null; }
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      error.value = '';
    }
    watch(() => props.aktif, (v) => { if (v) mulai(); else berhenti(); });
    onUnmounted(berhenti);
    return { videoEl, canvasEl, memuatKamera, error, tutup: () => emit('tutup') };
  },
  template: `
    <div v-if="aktif" style="position:fixed; inset:0; background:rgba(0,0,0,.85); z-index:10000; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:16px;">
      <div style="width:100%; max-width:340px; aspect-ratio:1/1; background:#111; border-radius:12px; overflow:hidden; position:relative; margin-bottom:16px;">
        <video ref="videoEl" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover;" :class="{ hidden: memuatKamera }"></video>
        <canvas ref="canvasEl" class="hidden"></canvas>
        <div v-if="memuatKamera" style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#C9B4A4; text-align:center; padding:16px;">
          <i class="fas fa-qrcode" style="font-size:36px; margin-bottom:10px;"></i>
          <span v-if="error" style="color:#F2A0A0; font-size:12px;">{{ error }}</span>
          <span v-else style="font-size:12.5px;">Menyiapkan kamera...</span>
        </div>
      </div>
      <p style="color:#fff; font-size:12.5px; margin-bottom:4px; text-align:center; font-weight:700;">{{ judul }}</p>
      <p v-if="subjudul" style="color:#C9B4A4; font-size:11.5px; margin-bottom:14px; text-align:center; max-width:320px;">{{ subjudul }}</p>
      <button @click="tutup" class="btn-outline" style="padding:8px 24px; background:#fff;">Tutup</button>
    </div>
  `
};

// ---------------------------------------------------------------------------
// AppScanCetakRiwayatPin — DIPINDAH APA ADANYA dari js/vue-config.js
// (AppConfigRiwayatPin, dulu di Zevanic House > Config > Riwayat PIN).
// Keputusan Guru (7 Sep 2026, konfirmasi ulang saat bangun menu Scan &
// Cetak): pindah ke "Scan & Cetak > PIN" (§4.1 wireframe modul ini),
// karena Riwayat PIN memang bagian dari grup PIN, bukan Config. Logic
// TIDAK diubah sama sekali dari versi Config — cuma nama komponen &
// fungsi mount + id mount point yang berubah.
// ---------------------------------------------------------------------------
const UKURAN_MUAT_RIWAYAT_PIN = 30;
export const AppScanCetakRiwayatPin = {
  setup() {
    const memuat = ref(true);
    const memuatLagi = ref(false);
    const daftar = ref([]);
    const adaLagi = ref(false);
    const error = ref('');
    let cursorTerakhir = null;

    function pesanError(e) {
      return e && e.code === 'failed-precondition'
        ? 'Perlu index Firestore baru — buka Console browser (F12), cari link "Create composite index" dari error ini, klik untuk bikin index-nya sekali.'
        : (e && e.code === 'permission-denied')
          ? 'Tidak punya izin membaca riwayat PIN. Hubungi Owner/PIC kalau ini tidak seharusnya terjadi.'
          : 'Gagal memuat riwayat PIN. Coba lagi.';
    }

    async function muat() {
      memuat.value = true;
      error.value = '';
      daftar.value = [];
      cursorTerakhir = null;
      adaLagi.value = false;
      try {
        const snap = await getDocs(query(collection(db, 'riwayat_pin'), orderBy('waktu', 'desc'), limit(UKURAN_MUAT_RIWAYAT_PIN)));
        const docs = snap.docs;
        daftar.value = docs.map(d => ({ id: d.id, ...d.data() }));
        if (docs.length > 0) cursorTerakhir = docs[docs.length - 1];
        adaLagi.value = docs.length === UKURAN_MUAT_RIWAYAT_PIN;
      } catch (e) {
        console.error('Gagal muat riwayat_pin:', e);
        error.value = pesanError(e);
      }
      memuat.value = false;
    }

    async function muatLagi() {
      if (!cursorTerakhir || memuatLagi.value) return;
      memuatLagi.value = true;
      try {
        const snap = await getDocs(query(collection(db, 'riwayat_pin'), orderBy('waktu', 'desc'), startAfter(cursorTerakhir), limit(UKURAN_MUAT_RIWAYAT_PIN)));
        const docs = snap.docs;
        daftar.value = [...daftar.value, ...docs.map(d => ({ id: d.id, ...d.data() }))];
        if (docs.length > 0) cursorTerakhir = docs[docs.length - 1];
        adaLagi.value = docs.length === UKURAN_MUAT_RIWAYAT_PIN;
      } catch (e) {
        console.error('Gagal muat riwayat_pin (lanjutan):', e);
        error.value = pesanError(e);
      }
      memuatLagi.value = false;
    }

    function formatWaktu(w) {
      return (w && typeof w.toDate === 'function') ? w.toDate().toLocaleString('id-ID') : '-';
    }

    onMounted(async () => { await window.authReady; await muat(); });
    return { memuat, memuatLagi, daftar, adaLagi, error, muat, muatLagi, formatWaktu };
  },
  template: `
    <div>
      <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Riwayat PIN</label>
      <p style="font-size:11px; color:var(--text-faint); margin:-4px 0 10px;">Catatan siapa memakai PIN, di menu/aksi apa, dan hasil verifikasinya (sukses/gagal) — diurut dari yang terbaru. Sejak menu Scan &amp; Cetak ini dibangun, SEMUA popup PIN baru (Cutting/Sewing/Finishing/Serie/Gudang Barang Jadi, dan Persiapan Produksi yang direfaktor) mencatat ke sini. Popup PIN di layar lain yang lebih lama (Pesanan, Stock & Pembelian, dst) BELUM ikut mencatat ke sini — lihat catatan migrasi di js/vue-scan-cetak.js.</p>

      <div v-if="error" style="padding:12px 14px; border-radius:10px; background:var(--danger-light); color:var(--danger); font-size:11.5px; margin-bottom:12px;">
        <i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>{{ error }}
        <button @click="muat" class="btn-outline" style="margin-left:8px; padding:3px 10px; font-size:11px;">Coba lagi</button>
      </div>

      <div v-if="memuat" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;"><i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i>Memuat riwayat PIN...</div>

      <div v-else-if="!error && daftar.length === 0" class="gc-kosong">
        <div class="lingkaran"><i class="fas fa-key"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada riwayat PIN tercatat</h3>
      </div>

      <template v-else-if="!error">
        <div class="gc-table-scroll">
          <table class="gc-table">
            <thead><tr><th style="width:48px;">No</th><th>Waktu</th><th>Nama Pengguna</th><th>Menu</th><th style="width:90px;">Hasil</th></tr></thead>
            <tbody>
              <tr v-for="(d, i) in daftar" :key="d.id">
                <td>{{ i + 1 }}</td>
                <td class="gc-cell-muted" style="white-space:nowrap;">{{ formatWaktu(d.waktu) }}</td>
                <td>{{ d.nama_pengguna || '-' }}</td>
                <td>{{ d.menu || '-' }}</td>
                <td>
                  <span v-if="d.berhasil" class="tag ok">Sukses</span>
                  <span v-else class="tag danger">Gagal</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="adaLagi" style="text-align:center; margin-top:14px;">
          <button @click="muatLagi" :disabled="memuatLagi" class="btn-outline filled">
            <i class="fas" :class="memuatLagi ? 'fa-spinner fa-spin' : 'fa-rotate-right'" style="margin-right:6px;"></i>
            {{ memuatLagi ? 'Memuat...' : 'Muat Lagi (30 berikutnya)' }}
          </button>
        </div>
      </template>
    </div>
  `
};

let vmScanCetakRiwayatPin = null;
window.pastikanMountScanCetakRiwayatPin = function() {
  if (vmScanCetakRiwayatPin) return;
  const mountPoint = document.getElementById('vue-scan-cetak-riwayatpin');
  if (mountPoint) vmScanCetakRiwayatPin = createApp(AppScanCetakRiwayatPin).mount('#vue-scan-cetak-riwayatpin');
};
