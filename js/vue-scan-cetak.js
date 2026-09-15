// js/vue-scan-cetak.js
// Menu Scan & Cetak, sekaligus FONDASI generik yang diimpor pos lain
// (Persiapan Produksi dan 5 modul Proses Produksi): PopupPinGenerik,
// ScanGenerik, buatUnpackUniversal, ajukanPersiapanMasalah, helper QR.
//
// Koleksi & field:
// - riwayat_pin: { uid, nama_pengguna, menu, berhasil, waktu }, ditulis tiap
//   percobaan PIN. PIN cocok tapi role di luar rolesDiizinkan dicatat
//   berhasil:false dengan nama pemilik PIN; PIN tak dikenali dicatat uid:null.
// - persiapan_masalah: dibuat HANYA lewat ajukanPersiapanMasalah di sini, 1
//   dokumen per baris kekurangan, status awal 'perlu_diajukan'.
// - bagging: unpack_hasil ('komplit'|'inkomplit'), unpack_pada, unpack_oleh,
//   unpack_dicocokkan[], unpack_asing[], unpack_hilang[].
//
// Jebakan:
// - ajukanPersiapanMasalah dipanggil BERSAMA updateBaris<Pos>, bukan
//   menggantikannya — baris asal tetap menyimpan catatan_masalah sendiri.
// - buatUnpackUniversal menolak menutup bagging yang belum lengkap/ada kode
//   asing kecuali paksaInkomplit; penutupan me-NULL-kan kode_spk & kode_batch.
// - catatRiwayatPin best-effort: gagal tulis tidak menggagalkan alur pemanggil.

import { createApp, ref, reactive, watch, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, getDocs, updateDoc, query, where, orderBy, limit, startAfter, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";


// PIN per akun — SATU-SATUNYA salinan resmi hashPin/tierOwnerKeAtas/
// cariUserByPin, ditaruh di modul yang bisa diimpor supaya tidak disalin lagi
// per file. GERBANG PIN: semua aksi Owner/PIC Owner lewat sini.

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

// tagRole — dipakai khusus PopupPinGenerik utk cek `rolesDiizinkan`. Nilai yang
// mungkin: 'owner', 'superuser', 'pic_owner', 'pic', 'admin'.
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

// catatRiwayatPin — best-effort (kalau gagal tulis, JANGAN gagalkan alur utama
// pemanggil — cukup log ke console, sama pola dgn log lain di app ini yang
// sifatnya catatan/riwayat, bukan data transaksi inti).
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


// PopupPinGenerik — GERBANG PIN per akun (wireframe "05 - Scan dan Cetak" §4.0,
// 2 state: bersih & salah). Mencatat riwayat_pin di SETIAP percobaan, sukses
// maupun gagal. Props: judul, pesan, konteks (WAJIB — nama menu/aksi, ditulis ke
// field `menu`), rolesDiizinkan (null = semua PIN admin-level). Emits: sukses(user), batal

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
          <input v-model="pin" @keyup.enter="kirim" type="text" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="••••••" autofocus style="letter-spacing:6px; text-align:center; font-size:18px; -webkit-text-security:disc;">
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


// ajukanPersiapanMasalah — SATU-SATUNYA tempat pembuatan dokumen
// `persiapan_masalah` (skema pos Masalah 7-tahap, header js/vue-pp-masalah.js)
// dari "Scan Masalah" di 4 pos Persiapan Produksi. Dipanggil BERSAMA
// updateBaris<Pos> yang tetap menulis catatan_masalah; status baris tidak berubah.

// Field dokumen mengikuti skema di header js/vue-pp-masalah.js §5.18: tlc_asal,
// sumber_jalur, spk_track_id, baris_index, bahan_aksesoris_id/bahan_nama/
// bahan_warna/satuan/no_spk (snapshot), qty_kurang, qty_entry_asal,
// alasan_masalah, scan_oleh, scan_pada, status:'perlu_diajukan'.

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


// buatUnpackUniversal — satu factory Scan Unpack untuk SEMUA pos. Step 1: scan
// kode_bagging -> ambil dokumen `bagging` langsung. Step 2: scan tiap kode ISI,
// dicocokkan ke bagging.isi[]; kode di luar isi[] dihitung ASING. Pakai: spread
// hasilnya ke return setup, pasang <scan-generik> + panel kecil di template.

// tutup(paksaInkomplit): semua isi[] cocok & tidak ada asing -> KOMPLIT; belum
// lengkap/ada asing dengan paksaInkomplit=false -> DITOLAK tanpa menulis apa pun
// (hard block); true -> INKOMPLIT, kode HILANG + ASING dicatat. Keduanya menulis
// unpack_hasil/pada/oleh/dicocokkan/asing/hilang dan me-NULL kode_spk+kode_batch.

export function buatUnpackUniversal() {
  const modalUnpack = reactive({ aktif: false, bagging: null, dicocokkan: [], asing: [], log: [] });
  function resetIsiUnpack() { modalUnpack.bagging = null; modalUnpack.dicocokkan = []; modalUnpack.asing = []; modalUnpack.log = []; }
  function bukaScanUnpack() { resetIsiUnpack(); modalUnpack.aktif = true; }
  function tutupScanUnpack() { modalUnpack.aktif = false; resetIsiUnpack(); }

  async function hasilScanUnpack(kodeMentah) {
    const kode = (kodeMentah || '').trim();
    if (!modalUnpack.bagging) {
      try {
        const snap = await getDocs(query(collection(db, 'bagging'), where('kode', '==', kode)));
        if (snap.empty) { alert(`Kode bagging "${kode}" tidak ditemukan.`); return; }
        const b = { id: snap.docs[0].id, ...snap.docs[0].data() };
        if (b.unpack_hasil) {
          if (!confirm(`Bagging "${kode}" sudah pernah di-Unpack sebelumnya (${b.unpack_hasil.toUpperCase()}). Buka lagi cuma untuk lihat isinya (tidak akan menulis ulang)?`)) return;
        }
        modalUnpack.bagging = b; modalUnpack.dicocokkan = []; modalUnpack.asing = []; modalUnpack.log = [];
      } catch (e) { console.error('Gagal cari kode bagging (unpack):', e); alert('Gagal mencari. Coba lagi.'); }
      return;
    }
    const b = modalUnpack.bagging;
    if (b.unpack_hasil) { alert('Bagging ini sudah ditutup (sudah di-Unpack sebelumnya) — cuma bisa dilihat, tidak bisa discan ulang.'); return; }
    const isi = Array.isArray(b.isi) ? b.isi : [];
    if (modalUnpack.dicocokkan.includes(kode) || modalUnpack.asing.includes(kode)) { alert(`"${kode}" sudah discan sebelumnya di sesi unpack ini.`); return; }
    if (!isi.includes(kode)) {
      modalUnpack.asing.push(kode);
      modalUnpack.log.unshift(kode + ' -> ASING (tidak ada di isi bagging saat Scan Pack)');
      return;
    }
    modalUnpack.dicocokkan.push(kode);
    modalUnpack.log.unshift(kode + ' -> cocok (' + modalUnpack.dicocokkan.length + '/' + isi.length + ')');
  }

  async function tutupUnpack(paksaInkomplit) {
    const b = modalUnpack.bagging;
    if (!b) return false;
    if (b.unpack_hasil) { tutupScanUnpack(); return false; }
    const isi = Array.isArray(b.isi) ? b.isi : [];
    const hilang = isi.filter(k => !modalUnpack.dicocokkan.includes(k));
    const cocokSemua = hilang.length === 0 && !modalUnpack.asing.length;
    if (!cocokSemua && !paksaInkomplit) {
      alert(`Belum lengkap: ${modalUnpack.dicocokkan.length}/${isi.length} cocok` + (modalUnpack.asing.length ? `, ${modalUnpack.asing.length} asing` : '') + '. Scan sisanya, atau pilih "Paksa INKOMPLIT" kalau memang tidak lengkap.');
      return false;
    }
    const now = new Date().toISOString();
    // kode_spk/kode_batch DINULKAN di sini (melepas kaitan root1/root2), tapi
    // nilainya disalin dulu ke kode_spk_asal/kode_batch_asal supaya badge
    // riwayat di track masih bisa query. *_asal TIDAK PERNAH dipakai untuk
    // validasi/kunci — murni field baca-saja untuk histori tampilan.
    try {
      await updateDoc(doc(db, 'bagging', b.id), {
        kode_spk: null, kode_batch: null,
        kode_spk_asal: b.kode_spk ?? null, kode_batch_asal: b.kode_batch ?? null,
        unpack_hasil: cocokSemua ? 'komplit' : 'inkomplit',
        unpack_pada: now, unpack_oleh: window.currentUser?.email || null,
        unpack_dicocokkan: modalUnpack.dicocokkan.slice(),
        unpack_asing: modalUnpack.asing.slice(),
        unpack_hilang: hilang
      });
      modalUnpack.log.unshift('Bagging ' + (b.kode || '') + ' ditutup: ' + (cocokSemua ? 'KOMPLIT' : `INKOMPLIT (${hilang.length} hilang, ${modalUnpack.asing.length} asing)`));
      modalUnpack.bagging = { ...b, kode_spk: null, kode_batch: null, kode_spk_asal: b.kode_spk ?? null, kode_batch_asal: b.kode_batch ?? null, unpack_hasil: cocokSemua ? 'komplit' : 'inkomplit' };
      return true;
    } catch (e) { console.error('Gagal menutup Scan Unpack:', e); alert('Gagal menyimpan. Coba lagi.'); return false; }
  }

  return { modalUnpack, bukaScanUnpack, tutupScanUnpack, hasilScanUnpack, tutupUnpack };
}


// ambilStatusUnpackBagging — dipakai badge "Unpack" pp-cutting.js (kunci
// kode_spk) & pp-sewing.js (kunci kode_batch): cari semua bagging yang PERNAH
// terkait nilai kunci X, aktif maupun sudah di-unpack, supaya badge tidak kosong
// setelah tutupUnpack menulis null ke kuncinya.

// Query 2x (field aktif + field *_asal), digabung lalu dedupe by doc id (satu
// bagging bisa kena dua query kalau race). Di-chunk 10 nilai/query (batas
// Firestore 'in'). Return { [nilaiKunci]: [{kode, unpack_hasil}, ..] };
// nilaiKunci tanpa bagging tetap ada sebagai array kosong.

export async function ambilStatusUnpackBagging(fieldAktif, fieldAsal, nilaiList) {
  const nilaiUnik = [...new Set((nilaiList || []).filter(Boolean))];
  const peta = {};
  nilaiUnik.forEach(n => { peta[n] = []; });
  if (!nilaiUnik.length) return peta;
  const dedupe = new Map(); // doc.id -> {nilai, kode, unpack_hasil}
  async function ambil(field) {
    for (let i = 0; i < nilaiUnik.length; i += 10) {
      const chunk = nilaiUnik.slice(i, i + 10);
      try {
        const snap = await getDocs(query(collection(db, 'bagging'), where(field, 'in', chunk)));
        snap.forEach(d => {
          if (dedupe.has(d.id)) return;
          const data = d.data();
          dedupe.set(d.id, { nilai: data[field], kode: data.kode, unpack_hasil: data.unpack_hasil || null });
        });
      } catch (e) { console.error(`Gagal ambil status unpack bagging (${field}):`, e); }
    }
  }
  await ambil(fieldAktif);
  await ambil(fieldAsal);
  dedupe.forEach(({ nilai, kode, unpack_hasil }) => { if (peta[nilai]) peta[nilai].push({ kode, unpack_hasil }); });
  return peta;
}


// muatJsQr / buatQrDataUrl / cariKaryawanByQr — salinan resmi yang diimpor
// modul lain, jangan disalin ulang per file.

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


// ScanGenerik — komponen kamera/QR generik untuk semua pos Persiapan Produksi.
// SENGAJA tidak tahu apa-apa soal Firestore/validasi kode: cuma nyalakan kamera,
// baca QR, kembalikan teksnya lewat event `hasil`. Pemanggil yang memvalidasi
// kode dan menulis Firestore — "Scan Entry = satu-satunya titik pengurangan stok".

// Multi-shot: kamera tetap menyala dan auto-lanjut scan tiap 900ms selama
// `aktif` true. Props: aktif (Boolean; induk yang mengontrol on/off, BUKAN v-if
// di induk), judul, subjudul. Emits: hasil(kodeTeks) tiap decode berhasil;
// tutup saat user pencet Tutup (induk yang men-set aktif=false).

export const ScanGenerik = {
  props: { aktif: { type: Boolean, default: false }, judul: String, subjudul: String },
  emits: ['hasil', 'tutup'],
  setup(props, { emit }) {
    const videoEl = ref(null), canvasEl = ref(null);
    const memuatKamera = ref(false), error = ref('');
    let stream = null, frameId = null, timeoutId = null;
    // Anti scan-ganda: kode yang SAMA dengan hasil scan terakhir TIDAK di-emit
    // ulang selama kamera terus melihatnya. Tanpa ini, badge yang masih di depan
    // kamera ke-scan lagi 900ms kemudian padahal tahap sudah pindah, dan pesan
    // error jadi membingungkan. Kode dianggap baru lagi begitu QR hilang sekali.
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
            // Kode sama, badge/label belum sempat diangkat dari kamera — JANGAN
            // emit ulang (lihat catatan bug di atas). Tetap lanjut memindai
            // supaya begitu diganti, langsung kebaca.
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


// AppScanCetakRiwayatPin — layar Riwayat PIN, bagian dari grup PIN modul ini
// (bukan Config). Membaca koleksi riwayat_pin yang ditulis PopupPinGenerik.

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
  if (vmScanCetakRiwayatPin) { if (typeof vmScanCetakRiwayatPin.muat === 'function') vmScanCetakRiwayatPin.muat(); return; }
  const mountPoint = document.getElementById('vue-scan-cetak-riwayatpin');
  if (mountPoint) vmScanCetakRiwayatPin = createApp(AppScanCetakRiwayatPin).mount('#vue-scan-cetak-riwayatpin');
};
