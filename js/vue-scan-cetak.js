// js/vue-scan-cetak.js
// Menu Scan & Cetak, sekaligus fondasi scan yang diimpor pos lain:
// PopupPinGenerik, ScanGenerik (overlay tulis-langsung), ScanTerpaduGenerik +
// buatScanTerpadu + KameraTersemat (Draft lalu Upload), buatScanEntryStok
// (Scan Entry Persiapan lewat ledger), buatUnpackUniversal.
//
// Koleksi & field:
// - riwayat_pin: { uid, nama_pengguna, menu, berhasil, waktu }, tiap percobaan
//   PIN. PIN cocok tapi role di luar rolesDiizinkan dicatat berhasil:false.
// - persiapan_masalah: dibuat HANYA lewat ajukanPersiapanMasalah di sini.
// - bagging: unpack_hasil, unpack_pada/oleh, unpack_dicocokkan[]/asing[]/hilang[].
//
// Jebakan:
// - buatScanTerpadu TIDAK menulis Firestore — semua lewat cfg.padaUpload.
// - buatScanEntryStok tidak memotong stok sendiri; semua lewat
//   catatScanEntryStok (satu transaksi) di vue-stock-pembelian.js.
// - KameraTersemat WAJIB watch({immediate:true}); FRAC_KOTAK_BACA satu angka
//   sumber kotak merah DAN area baca jsQR.

import { createApp, ref, reactive, watch, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, getDocs, updateDoc, query, where, orderBy, limit, startAfter, serverTimestamp, arrayUnion, runTransaction } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { resolveLabelStok, hitungAmbilLabelStok, catatScanEntryStok } from './vue-stock-pembelian.js?v=35';


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

// ajukanPersiapanMasalah — satu-satunya pembuat dokumen persiapan_masalah.
// Kode Masalah (MSL) lahir di sini, saat pos melapor, dan dipakai sampai
// barang pengganti di-Unpack lagi di pos itu (tlc_asal).
export async function ajukanPersiapanMasalah(opsi) {
  const now = new Date().toISOString();
  const oleh = window.currentUser?.email || '';
  const kurang = parseFloat(opsi.qtyKurang) || 0;
  const entryAsal = (opsi.qtyEntryAsal === null || opsi.qtyEntryAsal === undefined || isNaN(opsi.qtyEntryAsal)) ? null : parseFloat(opsi.qtyEntryAsal);
  const kodeMsl = await generateKodeHarianScan('MSL', 'pengaturan_id_persiapan_masalah');
  await addDoc(collection(db, 'persiapan_masalah'), {
    kode_msl: kodeMsl,
    jenis_masalah: opsi.jenisMasalah || 'kurang',
    kode_label_asal: opsi.kodeLabelAsal || '',
    tlc_asal: opsi.tlcAsal || '',
    sumber_jalur: opsi.sumberJalur || '',
    spk_track_id: opsi.trackId || '',
    baris_index: (opsi.lineIdx === undefined || opsi.lineIdx === null) ? null : opsi.lineIdx,
    separating_id: opsi.separatingId || '',
    kode_separating: opsi.kodeSeparating || '',
    bahan_aksesoris_id: opsi.bahanAksesorisId || '',
    bahan_nama: opsi.bahanNama || '',
    bahan_warna: opsi.bahanWarna || '',
    satuan: opsi.satuan || '',
    id_order: opsi.idOrder || opsi.noSpk || '',
    qty_kurang: kurang,
    qty_entry_asal: entryAsal,
    alasan_masalah: opsi.alasan || '',
    scan_oleh: oleh,
    scan_pada: now,
    status: 'perlu_diajukan',
    dibuat_pada: serverTimestamp()
  });
  return kodeMsl;
}

// generateKodeHarianScan — kode harian `{prefix}{yymmdd}-{nnn}` dengan counter
// per hari di koleksi counter sendiri; transaksi supaya tidak dobel.
export async function generateKodeHarianScan(prefix, koleksiCounter) {
  const now = new Date();
  const tanggalKey = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(2).replace(/-/g, '');
  const refDoc = doc(db, koleksiCounter, tanggalKey);
  return await runTransaction(db, async (trx) => {
    const snap = await trx.get(refDoc);
    const counterBaru = (snap.exists() ? (snap.data().counter || 0) : 0) + 1;
    if (snap.exists()) trx.update(refDoc, { counter: counterBaru });
    else trx.set(refDoc, { counter: counterBaru, dibuat_pada: tanggalKey });
    return `${prefix}${tanggalKey}-${String(counterBaru).padStart(3, '0')}`;
  });
}

// buatUnpackUniversal — satu factory Scan Unpack untuk SEMUA pos. Step 1: scan
// kode_bagging -> ambil dokumen `bagging` langsung. Step 2: scan tiap kode ISI,
// dicocokkan ke bagging.isi[]; kode di luar isi[] dihitung ASING. Pakai: spread
// hasilnya ke return setup, pasang <scan-generik> + panel kecil di template.

// tutup(paksaInkomplit): semua isi[] cocok & tidak ada asing -> KOMPLIT; belum
// lengkap/ada asing dengan paksaInkomplit=false -> DITOLAK tanpa menulis apa pun
// (hard block); true -> INKOMPLIT, kode HILANG + ASING dicatat. Keduanya menulis
// unpack_hasil/pada/oleh/dicocokkan/asing/hilang dan me-NULL kode_grouping_induk+kode_separating.

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
    // kode_grouping_induk/kode_separating DINULKAN di sini (melepas kaitan root1/root2), tapi
    // nilainya disalin dulu ke kode_grouping_induk_asal/kode_separating_asal supaya badge
    // riwayat di track masih bisa query. *_asal TIDAK PERNAH dipakai untuk
    // validasi/kunci — murni field baca-saja untuk histori tampilan.
    try {
      await updateDoc(doc(db, 'bagging', b.id), {
        kode_grouping_induk: null, kode_separating: null,
        kode_grouping_induk_asal: b.kode_grouping_induk ?? null, kode_separating_asal: b.kode_separating ?? null,
        unpack_hasil: cocokSemua ? 'komplit' : 'inkomplit',
        unpack_pada: now, unpack_oleh: window.currentUser?.email || null,
        unpack_dicocokkan: modalUnpack.dicocokkan.slice(),
        unpack_asing: modalUnpack.asing.slice(),
        unpack_hilang: hilang
      });
      modalUnpack.log.unshift('Bagging ' + (b.kode || '') + ' ditutup: ' + (cocokSemua ? 'KOMPLIT' : `INKOMPLIT (${hilang.length} hilang, ${modalUnpack.asing.length} asing)`));
      modalUnpack.bagging = { ...b, kode_grouping_induk: null, kode_separating: null, kode_grouping_induk_asal: b.kode_grouping_induk ?? null, kode_separating_asal: b.kode_separating ?? null, unpack_hasil: cocokSemua ? 'komplit' : 'inkomplit' };
      return true;
    } catch (e) { console.error('Gagal menutup Scan Unpack:', e); alert('Gagal menyimpan. Coba lagi.'); return false; }
  }

  return { modalUnpack, bukaScanUnpack, tutupScanUnpack, hasilScanUnpack, tutupUnpack };
}


// ambilStatusUnpackBagging — dipakai badge "Unpack" pp-cutting.js (kunci
// kode_grouping_induk) & pp-sewing.js (kunci kode_separating): cari semua bagging yang PERNAH
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


// FRAC_KOTAK_BACA + ukurKotakBaca — dipakai ScanGenerik & KameraTersemat.
// SATU angka ini jadi sumber baik untuk kotak merah yang kelihatan (kotakStyle)
// maupun area yang benar-benar diberikan ke jsQR (pindai) — QR di luar kotak
// TIDAK PERNAH ikut kebaca, jadi QR kedua yang nyempil di kamera tidak kebaca
// bareng QR utama. video.clientWidth/Height dipakai sebagai ukuran tampil
// (video mengisi penuh container-nya, object-fit:cover).
const FRAC_KOTAK_BACA = 0.72;
function ukurKotakBaca(video) {
  const cw = video.clientWidth, ch = video.clientHeight;
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!cw || !ch || !vw || !vh) return null;
  const sisiCss = Math.min(cw, ch) * FRAC_KOTAK_BACA;
  const skala = Math.max(vw / cw, vh / ch); // px video asli per px css (object-fit:cover)
  const sisiVideo = Math.round(sisiCss * skala);
  const offX = (vw - cw * skala) / 2, offY = (vh - ch * skala) / 2;
  return {
    css: { top: (ch - sisiCss) / 2, left: (cw - sisiCss) / 2, sisi: sisiCss },
    video: { x: Math.max(0, Math.round(offX + (cw * skala - sisiVideo) / 2)), y: Math.max(0, Math.round(offY + (ch * skala - sisiVideo) / 2)), sisi: sisiVideo }
  };
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
    const kotakStyle = ref({});
    let stream = null, frameId = null, timeoutId = null;
    // Anti scan-ganda: kode yang SAMA dengan hasil scan terakhir TIDAK di-emit
    // ulang selama kamera terus melihatnya. Tanpa ini, badge yang masih di depan
    // kamera ke-scan lagi 900ms kemudian padahal tahap sudah pindah, dan pesan
    // error jadi membingungkan. Kode dianggap baru lagi begitu QR hilang sekali.
    let kodeSebelumnya = null;

    function updateKotakStyle() {
      const k = videoEl.value && ukurKotakBaca(videoEl.value);
      kotakStyle.value = k ? { top: k.css.top + 'px', left: k.css.left + 'px', width: k.css.sisi + 'px', height: k.css.sisi + 'px' } : {};
    }

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
        updateKotakStyle();
        window.addEventListener('resize', updateKotakStyle);
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
        // Kotak baca: HANYA area kotak merah (ukurKotakBaca) yang diberikan ke
        // jsQR — QR lain yang ikut nyempil di kamera tidak pernah kebaca.
        const kotak = ukurKotakBaca(video);
        const gambar = kotak
          ? ctx.getImageData(kotak.video.x, kotak.video.y, kotak.video.sisi, kotak.video.sisi)
          : ctx.getImageData(0, 0, canvas.width, canvas.height);
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
      window.removeEventListener('resize', updateKotakStyle);
      error.value = '';
    }
    watch(() => props.aktif, (v) => { if (v) mulai(); else berhenti(); });
    onUnmounted(berhenti);
    return { videoEl, canvasEl, memuatKamera, error, kotakStyle, tutup: () => emit('tutup') };
  },
  template: `
    <div v-if="aktif" style="position:fixed; inset:0; background:rgba(0,0,0,.85); z-index:10000; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:16px;">
      <div style="width:100%; max-width:340px; aspect-ratio:1/1; background:#111; border-radius:12px; overflow:hidden; position:relative; margin-bottom:16px;">
        <video ref="videoEl" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover;" :class="{ hidden: memuatKamera }"></video>
        <canvas ref="canvasEl" class="hidden"></canvas>
        <div v-if="!memuatKamera" :style="{ position:'absolute', border:'3px solid #ff3b3b', borderRadius:'10px', boxShadow:'0 0 0 999px rgba(0,0,0,.4)', pointerEvents:'none', ...kotakStyle }"></div>
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


// KameraTersemat — sama pembaca QR dengan ScanGenerik (termasuk anti scan-
// ganda `kodeSebelumnya`), cuma bungkus tampilannya TERSEMAT di dalam kartu
// pemanggil (bukan fixed inset:0 penuh layar). Dipakai ScanTerpaduGenerik di
// bawah; bisa juga dipakai berdiri sendiri kalau ada layar lain yang butuh
// kamera tersemat tanpa alur Draft->Upload.

export const KameraTersemat = {
  props: { aktif: { type: Boolean, default: false }, mode: String },
  emits: ['hasil'],
  setup(props, { emit }) {
    const videoEl = ref(null), canvasEl = ref(null);
    const memuatKamera = ref(false), error = ref('');
    const kotakStyle = ref({});
    let stream = null, frameId = null, timeoutId = null;
    let kodeSebelumnya = null;

    function updateKotakStyle() {
      const k = videoEl.value && ukurKotakBaca(videoEl.value);
      kotakStyle.value = k ? { top: k.css.top + 'px', left: k.css.left + 'px', width: k.css.sisi + 'px', height: k.css.sisi + 'px' } : {};
    }

    async function mulai() {
      kodeSebelumnya = null;
      memuatKamera.value = true; error.value = '';
      try { await muatJsQr(); } catch (e) {
        error.value = 'Gagal memuat modul pembaca QR. Cek koneksi internet.'; memuatKamera.value = false; return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (videoEl.value) { videoEl.value.srcObject = stream; await videoEl.value.play(); }
        memuatKamera.value = false;
        updateKotakStyle();
        window.addEventListener('resize', updateKotakStyle);
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
        // Kotak baca: HANYA area kotak merah (ukurKotakBaca) yang diberikan ke
        // jsQR — QR lain yang ikut nyempil di kamera tidak pernah kebaca.
        const kotak = ukurKotakBaca(video);
        const gambar = kotak
          ? ctx.getImageData(kotak.video.x, kotak.video.y, kotak.video.sisi, kotak.video.sisi)
          : ctx.getImageData(0, 0, canvas.width, canvas.height);
        const kode = window.jsQR(gambar.data, gambar.width, gambar.height, { inversionAttempts: 'dontInvert' });
        if (kode && kode.data) {
          const teks = kode.data.trim();
          if (teks === kodeSebelumnya) {
            timeoutId = setTimeout(() => { if (stream) pindai(); }, 900);
            return;
          }
          kodeSebelumnya = teks;
          if (navigator.vibrate) navigator.vibrate(120);
          emit('hasil', teks);
          timeoutId = setTimeout(() => { if (stream) pindai(); }, 900);
          return;
        }
        kodeSebelumnya = null;
      }
      frameId = requestAnimationFrame(pindai);
    }
    function berhenti() {
      if (frameId) { cancelAnimationFrame(frameId); frameId = null; }
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      window.removeEventListener('resize', updateKotakStyle);
      error.value = '';
    }
    // immediate:true WAJIB di sini (beda dari ScanGenerik): ScanTerpaduGenerik
    // membungkus komponen ini di v-if, jadi tiap buka() MEMBUAT instance BARU
    // dengan aktif=true sejak render pertama — watch tanpa immediate tidak
    // pernah terpicu untuk itu, kamera diam hitam tanpa error.
    watch(() => props.aktif, (v) => { if (v) mulai(); else berhenti(); }, { immediate: true });
    onUnmounted(berhenti);
    return { videoEl, canvasEl, memuatKamera, error, kotakStyle };
  },
  template: `
    <div style="width:100%; height:145px; background:#111; border-radius:12px; overflow:hidden; position:relative;">
      <video ref="videoEl" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover;" :class="{ hidden: memuatKamera }"></video>
      <canvas ref="canvasEl" class="hidden"></canvas>
      <div v-if="!memuatKamera" :style="{ position:'absolute', border:'3px solid #ff3b3b', borderRadius:'8px', boxShadow:'0 0 0 999px rgba(0,0,0,.4)', pointerEvents:'none', ...kotakStyle }"></div>
      <div v-if="memuatKamera" style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#C9B4A4; text-align:center; padding:8px;">
        <i class="fas fa-qrcode" style="font-size:22px; margin-bottom:6px;"></i>
        <span v-if="error" style="color:#F2A0A0; font-size:10.5px;">{{ error }}</span>
        <span v-else style="font-size:10.5px;">Menyiapkan kamera...</span>
      </div>
      <div v-if="mode && !memuatKamera" style="position:absolute; left:8px; bottom:6px; background:rgba(0,0,0,.55); color:#fff; font-size:9.5px; padding:3px 8px; border-radius:8px;">{{ mode }}</div>
    </div>
  `
};


// buatScanTerpadu — factory alur Draft->Upload generik, pengganti tulis-
// langsung per scan (pola lama ScanGenerik). Cfg yang disuplai pemanggil:
//   judul, subjudul, gated (Boolean, tampilkan hint "sudah dicetak"),
//   twoStep: { labelPertama, labelKedua, placeholderPertama/Kedua,
//     camModePertama/Kedua, kosongUtama, kosongSub, validasi(kode) ->
//     {ok, pesan, data} } — OMIT untuk alur satu-input,
//   camMode, placeholder — dipakai kalau TIDAK twoStep,
//   validasiIsi(kode, lockedData, rowsSaatIni) -> {ok, pesan, row},
//   padaUpload(rows, lockedData) -> {ok, pesan} — SATU-SATUNYA titik tulis,
//   aksiEkstra: [{label, aksi(lockedData, lockedLabel)}] — tombol tambahan,
//   tampil hanya saat lockedData terisi (mis. "Tutup Bagging Ini").
// Factory ini SENGAJA tidak tahu Firestore — lihat Jebakan di atas file ini.

export function buatScanTerpadu(cfg) {
  const s = reactive({
    aktif: false, rows: [], lockedData: null, lockedLabel: '',
    manualInput: '', sedangProses: false, toastTeks: '', toastTampil: false
  });
  let toastTimer = null;
  function toast(teks) {
    s.toastTeks = teks; s.toastTampil = true;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { s.toastTampil = false; }, 1600);
  }
  function reset() { s.rows = []; s.lockedData = null; s.lockedLabel = ''; s.manualInput = ''; }
  function buka() { reset(); s.aktif = true; }
  function tutup() { s.aktif = false; reset(); }

  async function terimaKode(kodeMentah) {
    const kode = (kodeMentah || '').trim();
    if (!kode || s.sedangProses) return;
    if (cfg.twoStep && !s.lockedData) {
      s.sedangProses = true;
      try {
        const hasil = await cfg.twoStep.validasi(kode);
        if (!hasil.ok) { alert(hasil.pesan || `Kode "${kode}" tidak dikenali.`); return; }
        s.lockedData = hasil.data;
        s.lockedLabel = hasil.label || kode; // validasi boleh isi label sendiri (mis. nama+kode)
        toast('✓ ' + cfg.twoStep.labelPertama + ' ' + kode + ' dikunci — lanjut scan ' + cfg.twoStep.labelKedua);
      } finally { s.sedangProses = false; }
      return;
    }
    if (s.rows.some(r => r.kode === kode)) { alert(`"${kode}" sudah ada di daftar — hapus dulu kalau mau scan ulang.`); return; }
    s.sedangProses = true;
    try {
      const hasil = await cfg.validasiIsi(kode, s.lockedData, s.rows);
      if (!hasil.ok) { alert(hasil.pesan || `Kode "${kode}" tidak dikenali/ditolak.`); return; }
      s.rows.push({ ...hasil.row, id: 'r' + Date.now() + Math.random().toString(16).slice(2) });
      toast('✓ ' + kode + ' ditambahkan');
    } finally { s.sedangProses = false; }
  }
  function hapusBaris(id) { s.rows = s.rows.filter(r => r.id !== id); toast('Baris dihapus'); }
  function resetLock() {
    if (!cfg.twoStep) return;
    s.lockedData = null; s.lockedLabel = ''; s.rows = [];
    toast(cfg.twoStep.labelPertama + ' direset — scan ulang');
  }
  function batal() { reset(); }
  async function upload() {
    if (!s.rows.length || s.sedangProses) return;
    s.sedangProses = true;
    try {
      const hasil = await cfg.padaUpload(s.rows.slice(), s.lockedData);
      if (!hasil || hasil.ok === false) { alert((hasil && hasil.pesan) || 'Gagal upload. Coba lagi.'); return; }
      toast(`Diupload — ${s.rows.length} kode tersimpan`);
      reset();
    } finally { s.sedangProses = false; }
  }
  function kirimManual() {
    if (!s.manualInput.trim()) return;
    const v = s.manualInput.trim(); s.manualInput = '';
    terimaKode(v);
  }
  return { s, cfg, buka, tutup, terimaKode, hapusBaris, resetLock, batal, upload, kirimManual };
}


// buatScanEntryStok — Scan Entry Persiapan: pembuka = label kerja baris yang
// dipilih, isi = label barang fisik (Kode Lot / Kode Pak / ID Item) berkali-
// kali. Tiap baris tampil "stok − pakai = sisa"; label fisik TIDAK dicetak
// ulang, kodenya tetap dan angka sisa cukup dikoreksi tangan.
function angkaStok(n) { return (Math.round((parseFloat(n) || 0) * 100) / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 }); }
// Satuan panjang kecil (kain) tampil meter, 2 desimal dipotong ke bawah.
const KE_METER = { CM: 0.01, CENTIMETER: 0.01, SENTIMETER: 0.01, MM: 0.001, MILIMETER: 0.001 };
function badgeStok(stok, pakai, sisa, satuan) {
  const f = KE_METER[String(satuan || '').trim().toUpperCase()];
  if (!f) return `stok ${angkaStok(stok)} − pakai ${angkaStok(pakai)} = sisa ${angkaStok(sisa)} ${satuan}`.trim();
  const m = (n) => (Math.floor(Math.round(n * f * 1000) / 10) / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + 'm';
  return `stok ${m(stok)} − pakai ${m(pakai)} = sisa ${m(sisa)}`;
}
export function buatScanEntryStok(cfg) {
  const ctrl = buatScanTerpadu({
    judul: cfg.judul || ('Scan Entry — ' + cfg.pos), subjudul: 'Scan label kerja, lalu label stok yang dipakai',
    twoStep: {
      labelPertama: 'Label kerja', labelKedua: 'label stok (Kode Lot, Kode Pak, atau ID Item)',
      validasi: async (kode) => {
        const b = cfg.ambilBaris();
        if (!b) return { ok: false, pesan: 'Baris kerja belum dipilih.' };
        if (kode !== cfg.kodeLabel(b)) return { ok: false, pesan: `"${kode}" bukan label kerja baris ini (${cfg.kodeLabel(b)}).` };
        return { ok: true, data: b, label: kode + ' · butuh ' + cfg.kebutuhan(b) + ' ' + (cfg.satuan(b) || '') };
      }
    },
    validasiIsi: async (kode, b, rows) => {
      const hasil = await resolveLabelStok(kode);
      if (!hasil.ok) return hasil;
      if (hasil.lot && rows.some(r => r._lotId === hasil.lot.id)) return { ok: false, pesan: `${kode} sudah ada di daftar.` };
      const h = hitungAmbilLabelStok({ hasil, bahanIdDibutuhkan: cfg.bahanId(b), kebutuhan: cfg.kebutuhan(b), rows });
      if (!h.ok) return h;
      // stok sebelum = isi lot, atau stok item dikurangi yang sudah diambil baris item lain di sesi ini
      const stokAwal = hasil.lot ? (parseFloat(hasil.lot.qty_sisa) || 0)
        : (parseFloat(hasil.bahan.stok_akhir) || 0) - rows.filter(r => r._jenis === 'item').reduce((t, r) => t + (parseFloat(r._ambil) || 0), 0);
      const sisa = Math.round((stokAwal - h.ambil) * 100) / 100;
      const satuan = hasil.lot?.satuan || hasil.bahan.satuan_pemakaian || '';
      return { ok: true, row: {
        kode, label: (hasil.bahan.nama || '') + ' · ' + (hasil.jenis === 'item' ? 'ID Item' : hasil.jenis === 'pak' ? 'Pak' : 'Lot'),
        tagTxt: badgeStok(stokAwal, h.ambil, sisa, satuan), tagCls: sisa > 0 ? 'warn' : 'ok',
        _jenis: hasil.jenis, _lotId: hasil.lot ? hasil.lot.id : null, _ambil: h.ambil
      } };
    },
    padaUpload: async (rows, b) => {
      const total = Math.round(rows.reduce((t, r) => t + (parseFloat(r._ambil) || 0), 0) * 100) / 100;
      const butuh = Math.round((parseFloat(cfg.kebutuhan(b)) || 0) * 100) / 100;
      if (total !== butuh) return { ok: false, pesan: `Baru ${total} dari ${butuh}. Scan label stok lain, atau pakai Scan Masalah kalau stoknya memang kurang.` };
      try {
        await catatScanEntryStok({
          bahanId: cfg.bahanId(b), namaBahan: cfg.namaBahan(b), satuan: cfg.satuan(b), qty: butuh, rows,
          sumber: cfg.sumber, pos: cfg.pos, jejak: cfg.jejak(b),
          patchTrack: cfg.patchTrack(b, { entry_qty: butuh, entry_oleh: window.currentUser?.email || '', entry_pada: new Date().toISOString() })
        });
      } catch (e) { console.error('Gagal upload Scan Entry:', e); return { ok: false, pesan: e.message || 'Gagal menyimpan. Coba lagi.' }; }
      ctrl.tutup();
      if (cfg.padaSelesai) await cfg.padaSelesai();
      return { ok: true };
    }
  });
  return ctrl;
}

// ScanTerpaduGenerik — UI layar penuh utk buatScanTerpadu(): kamera tersemat
// (KameraTersemat) + chip kunci tahap-1 (twoStep) + input manual (label
// rusak/tidak terbaca) + daftar draft + footer Batal/Upload. Prop `c` adalah
// controller dari buatScanTerpadu — komponen ini CUMA baca/panggil methodnya.

export const ScanTerpaduGenerik = {
  components: { KameraTersemat },
  props: { c: { type: Object, required: true } },
  emits: ['tutup'],
  setup(props, { emit }) {
    function tutup() { props.c.tutup(); emit('tutup'); }
    return { tutup };
  },
  template: `
  <div v-if="c.s.aktif" style="position:fixed; inset:0; background:var(--ivory); z-index:9998; display:flex; flex-direction:column; padding:14px; overflow-y:auto;">
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
      <button @click="tutup" class="btn-outline" style="padding:6px 10px;"><i class="fas fa-arrow-left"></i></button>
      <div>
        <div class="gc-heading" style="font-size:13.5px; font-weight:700;">{{ c.cfg.judul }}</div>
        <div style="font-size:10.5px; color:var(--text-faint);">{{ (c.cfg.twoStep && c.s.lockedLabel) ? (c.cfg.subjudul + ' — ' + c.cfg.twoStep.labelPertama + ' ' + c.s.lockedLabel) : c.cfg.subjudul }}</div>
      </div>
    </div>

    <div v-if="c.cfg.twoStep && c.s.lockedLabel" class="gc-card" style="padding:8px 12px; display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; background:var(--ok-light); gap:8px; flex-wrap:wrap;">
      <div><span class="tag ok" style="margin-right:6px;">{{ c.cfg.twoStep.labelPertama }}</span><b class="gc-num">{{ c.s.lockedLabel }}</b></div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button v-for="a in (c.cfg.aksiEkstra || [])" :key="a.label" @click="a.aksi(c.s.lockedData, c.s.lockedLabel)" class="btn-outline" style="padding:5px 10px; font-size:10.5px;">{{ a.label }}</button>
        <button @click="c.resetLock()" class="btn-outline" style="padding:5px 10px; font-size:10.5px;">Ganti</button>
      </div>
    </div>

    <kamera-tersemat :aktif="c.s.aktif" :mode="c.cfg.twoStep ? (c.s.lockedLabel ? c.cfg.twoStep.camModeKedua : c.cfg.twoStep.camModePertama) : c.cfg.camMode" @hasil="c.terimaKode" style="margin-bottom:8px;" />

    <input v-model="c.s.manualInput" @keydown.enter="c.kirimManual()" type="text"
      :placeholder="c.cfg.twoStep ? (c.s.lockedLabel ? c.cfg.twoStep.placeholderKedua : c.cfg.twoStep.placeholderPertama) : c.cfg.placeholder"
      class="gc-field" style="margin-bottom:10px; padding:9px 12px; border-radius:10px; width:100%; box-sizing:border-box;">

    <div v-if="c.cfg.gated" style="font-size:10px; color:var(--text-faint); margin-bottom:8px;">Hanya kode yang labelnya sudah dicetak yang bisa discan di sini — kalau labelnya belum dicetak, scan ditolak.</div>

    <div style="flex:1; overflow-y:auto; margin-bottom:10px;">
      <div v-if="c.s.rows.length === 0" class="gc-kosong">
        <div class="lingkaran"><i class="fas fa-qrcode"></i></div>
        <h3 class="gc-heading" style="font-size:12.5px; font-weight:700; margin:0;">{{ (c.cfg.twoStep && !c.s.lockedLabel) ? c.cfg.twoStep.kosongUtama : 'Belum ada yang di-scan' }}</h3>
        <p v-if="c.cfg.twoStep && !c.s.lockedLabel" style="font-size:11px; color:var(--text-faint); margin:4px 0 0;">{{ c.cfg.twoStep.kosongSub }}</p>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:6px;">
        <div v-for="r in c.s.rows" :key="r.id" class="gc-card" style="padding:9px 12px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <div style="flex:1; min-width:0;">
            <div class="gc-num" style="font-weight:700; font-size:12px;">{{ r.kode }}</div>
            <div style="font-size:10.5px; color:var(--text-faint);">{{ r.label }}</div>
          </div>
          <div v-if="r.meta" style="font-size:10px; color:var(--text-faint); white-space:nowrap;">{{ r.meta }}</div>
          <span v-if="r.tagTxt" class="tag" :class="r.tagCls || 'ok'">{{ r.tagTxt }}</span>
          <div v-if="r.qty" class="gc-num" style="font-size:11px; white-space:nowrap;">{{ r.qty }}</div>
          <button @click="c.hapusBaris(r.id)" class="btn-outline" style="padding:4px 8px; font-size:10px;" title="Hapus, kalau kescan tidak sengaja"><i class="fas fa-xmark"></i></button>
        </div>
      </div>
    </div>

    <div style="display:flex; gap:8px; align-items:center;">
      <span v-if="c.s.rows.length" style="font-size:10.5px; color:var(--text-faint); flex:1;">{{ c.s.rows.length }} kode terkumpul — belum tersimpan sampai Upload</span>
      <button @click="tutup" class="btn-outline" style="padding:9px 16px;">Batal</button>
      <button @click="c.upload()" :disabled="!c.s.rows.length || c.s.sedangProses" class="btn-primary" style="padding:9px 20px;">{{ c.s.sedangProses ? 'Mengupload...' : 'Upload' }}</button>
    </div>

    <div v-if="c.s.toastTampil" style="position:fixed; top:18px; left:50%; transform:translateX(-50%); background:var(--text); color:var(--ivory); padding:9px 16px; border-radius:12px; font-size:11.5px; font-weight:600; box-shadow:0 8px 20px -8px rgba(0,0,0,.35); z-index:9999; pointer-events:none;">{{ c.s.toastTeks }}</div>
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
