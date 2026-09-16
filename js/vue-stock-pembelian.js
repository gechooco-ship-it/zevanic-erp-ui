// js/vue-stock-pembelian.js
// Stok dan Pembelian — Daftar Nota (entry keyboard-first ala kasir), Riwayat
// Harga Pembelian, plus fungsi bersama pencatatan stok untuk modul lain.
//
// Koleksi & field:
// - pesanan_pembelian: items[] ARRAY dalam 1 dokumen (bukan sub-koleksi),
//   status 'draft'/'final'. Counter nomor nota: pengaturan_id_pembelian.
// - lot_bahan_aksesoris: 1 dokumen = 1 roll/lot, dibuat saat nota difinalkan
//   untuk item ber-pakai_lot_tracking yang detail_lot[]-nya terisi.
// - master_bahan_aksesoris: harga_perlu_konfirmasi + harga_pending{} = banner.
//
// Jebakan:
// - harga_pemakaian = harga_modal x (1 + margin_modal/100), margin_modal
//   PERSEN; perbaruiHargaMasterDariRiwayat pakai rumus sama tiap nota final.
// - Item konversi_bertingkat: "Terapkan" di Riwayat Harga cuma memperbarui
//   harga_modal tier terakhir, TIDAK seluruh rantai. Verifikasi manual.
// - Finalisasi nota dan "Terapkan" butuh PIN (users.pin_hash, cariUserByPin,
//   tierOwnerKeAtas, kunci 3x salah); user tanpa pin_hash terkunci.
// - catatPemakaianDariAlokasi juga dipanggil js/vue-scan-persiapan.js —
//   jangan ubah tanda tangannya tanpa cek pemanggil itu.

import { createApp, ref, reactive, computed, onMounted, watch, nextTick } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDoc, getDocs, setDoc, serverTimestamp, runTransaction, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
// foto_bon diupload ke Firebase Storage, pola SAMA PERSIS seperti
// uploadFotoProduk di vue-master-produk.js (disalin, bukan diimpor silang —
// konvensi proyek ini). `storage` ikut diimpor dari firebase-config.js (sudah
// di-export di sana, dipakai file lain).
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { db, storage } from "./firebase-config.js";
// MasterDataTabelManager TIDAK diimpor lagi di sini — dulu dipakai
// MasterSuplayerManager (gear Stock & Pembelian), sekarang CRUD Suplayer pindah
// ke menu Config (vue-config.js). Lihat catatan di PengaturanStockPembelian di
// bawah.
import { DropdownCari, PopupPratinjauCetakLabel } from './vue-components.js?v=13';
import { usePaginasiFirestore } from './vue-paginasi.js?v=1';

// helper: ambil semua Bahan+Aksesoris (disalin dari vue-bahan-aksesoris.js /
// vue-persiapan-masalah.js secara sengaja — lihat catatan di file itu).
async function ambilDaftarBahanAksesorisLengkap() {
  try {
    const snap = await getDocs(collection(db, 'master_bahan_aksesoris'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    return list;
  } catch (e) {
    console.error('Gagal ambil daftar Bahan/Aksesoris:', e);
    return [];
  }
}
async function ambilDaftarSuplayer() {
  try {
    const snap = await getDocs(collection(db, 'master_suplayer'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    return list;
  } catch (e) {
    console.error('Gagal ambil daftar Suplayer:', e);
    return [];
  }
}
function formatRupiah(n) {
  const angka = parseFloat(n) || 0;
  return 'Rp ' + Math.round(angka).toLocaleString('id-ID');
}
// formatNamaBahan — gabung `nama` + `warna` untuk label item di dropdown.
// Beberapa item bisa punya `nama` SAMA dengan `warna` beda; mencocokkan hanya
// lewat `nama` (`.find` ambil hasil pertama) menyantolkan pilihan ke varian
// warna yang salah tanpa error apa pun.
function formatNamaBahan(b) {
  return (b.nama || '') + (b.warna ? ` ${b.warna}` : '');
}
// buatQrDataUrl — di level modul supaya dipakai bareng cetakLabelLot dan
// CetakLabelManager di file ini. Alasan QR digambar sinkron di window utama
// (bukan document.write di window print) ada di catatan cetakLabelLot.
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
// opsiSatuanBeliUntuk / faktorKonversiUntukSatuan — baca `konversi_bertingkat`
// (array `{dari, jumlah, ke, harga}` per tingkat). Pilihan satuan beli = tiap
// `dari` di rantai + `satuan_pemakaian`; faktor dihitung per satuan terpilih.
// Memakai `isi_konversi_pembelian` saja cuma benar di satuan_pembelian teratas.
function opsiSatuanBeliUntuk(item) {
  const tingkat = Array.isArray(item.konversi_bertingkat) ? item.konversi_bertingkat : [];
  if (tingkat.length === 0) {
    // Item lama / 1-tingkat (belum pernah diisi lewat popup berjenjang) — cuma
    // ada 1 satuan beli yang diketahui, sama seperti perilaku sebelum §25.13.
    return item.satuan_pembelian ? [item.satuan_pembelian] : [];
  }
  const opsi = [];
  tingkat.forEach(t => { if (t.dari && !opsi.includes(t.dari)) opsi.push(t.dari); });
  const akhir = tingkat[tingkat.length - 1].ke;
  if (akhir && !opsi.includes(akhir)) opsi.push(akhir); // beli langsung di satuan dasar (faktor 1)
  return opsi;
}
function faktorKonversiUntukSatuan(item, satuanDipilih) {
  const tingkat = Array.isArray(item.konversi_bertingkat) ? item.konversi_bertingkat : [];
  if (tingkat.length === 0) return parseFloat(item.isi_konversi_pembelian) || 1;
  const idx = tingkat.findIndex(t => t.dari === satuanDipilih);
  if (idx === -1) {
    // Bukan salah satu titik "dari" di rantai — cek apakah itu satuan
    // AKHIR/dasar (beli langsung di satuan_pemakaian, faktor = 1).
    if (satuanDipilih && satuanDipilih === tingkat[tingkat.length - 1].ke) return 1;
    // Fallback aman: satuan tidak dikenali sama sekali (seharusnya tidak terjadi
    // lewat UI, cuma jaring pengaman) — pakai faktor gabungan penuh (perilaku
    // lama).
    return parseFloat(item.isi_konversi_pembelian) || 1;
  }
  // Faktor = perkalian `jumlah` MULAI dari tingkat satuan yang dipilih SAMPAI
  // akhir rantai (BUKAN dari tingkat paling atas) — ini yang beda dari
  // `isi_konversi_pembelian` polos, yang selalu itung dari tingkat PALING ATAS.
  return tingkat.slice(idx).reduce((total, t) => total * (parseFloat(t.jumlah) || 1), 1);
}
// hargaUntukSatuan — prefill "Harga Aktual" ambil harga TINGKAT yang dipilih di
// field Satuan (dari `konversi_bertingkat`), bukan `harga_pembelian` tingkat
// teratas. Nilai ini cuma default; admin tetap bisa edit di tabel Nota.
function hargaUntukSatuan(item, satuanDipilih) {
  const tingkat = Array.isArray(item.konversi_bertingkat) ? item.konversi_bertingkat : [];
  if (tingkat.length === 0) return parseFloat(item.harga_pembelian) || 0;
  const cocok = tingkat.find(t => t.dari === satuanDipilih);
  if (cocok && parseFloat(cocok.harga) > 0) return parseFloat(cocok.harga);
  // Satuan akhir/dasar (satuan_pemakaian) tidak punya baris "dari" sendiri —
  // pakai `harga_modal`, yaitu harga TERMAHAL di antara implikasi
  // per-satuan-akhir semua tingkat (hitungHargaPerSatuanAkhir).
  if (satuanDipilih && satuanDipilih === tingkat[tingkat.length - 1].ke) {
    return Math.round(parseFloat(item.harga_modal) || 0);
  }
  return parseFloat(item.harga_pembelian) || 0; // fallback aman (seharusnya tidak kejadian lewat UI)
}
// hitungHargaPerSatuanAkhir — salinan fungsi bernama sama di
// vue-bahan-aksesoris.js (disalin, BUKAN diimpor silang). Kalau rumusnya
// diubah, WAJIB diubah bareng di kedua file supaya popup Konversi Berjenjang
// dan auto-update harga dari Nota final tidak berbeda hasil.
function hitungHargaPerSatuanAkhir(baris) {
  let maxHarga = 0;
  baris.forEach((b, i) => {
    const h = parseFloat(b.harga);
    if (!(h > 0)) return;
    const faktor = baris.slice(i).reduce((t, x) => t * (parseFloat(x.jumlah) || 0), 1);
    if (!(faktor > 0)) return;
    const impliedHargaAkhir = h / faktor;
    if (impliedHargaAkhir > maxHarga) maxHarga = impliedHargaAkhir;
  });
  return maxHarga;
}

// PIN per akun — siapa pun boleh mengetik PIN di popup ini; sistem yang mencari
// PIN itu milik siapa, BUKAN dicocokkan ke window.currentUser yang login.
// `hashPin` disalin persis dari vue-account-profile.js dan vue-camera.js —
// tiap file punya salinannya sendiri, bukan impor silang.
async function hashPin(pin, email) {
  const data = new TextEncoder().encode(pin + '|' + email);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
// MAKS_PERCOBAAN_PIN — SAMA seperti MAKS_PERCOBAAN_PIN_KIOSK di vue-camera.js
// (batas 3x salah lalu popup dikunci, wajib dibuka ulang).
const MAKS_PERCOBAAN_PIN = 3;

// tierOwnerKeAtas — 5 role baku: owner/pic_owner/pic/admin/operator. pic_owner
// role sungguhan, bukan lagi profil di atas role 'pic'.
function tierOwnerKeAtas(userData) {
  if (!userData) return false;
  const role = (userData.role || '').toLowerCase();
  return role === 'owner' || role === 'pic_owner';
}

// cariUserByPin — PIN yang diketik di-hash ulang pakai EMAIL tiap kandidat
// (garam = email sendiri) lalu dibanding `pin_hash`; user pertama yang cocok
// adalah pemilik PIN. User yang belum pasang PIN (pin_hash kosong) TIDAK PERNAH
// bisa match. Query dibatasi role admin-level; operator dilewati.
async function cariUserByPin(pinInput) {
  const snap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['owner', 'pic_owner', 'pic', 'admin'])));
  for (const d of snap.docs) {
    const u = d.data();
    if (!u.pin_hash) continue;
    const hash = await hashPin(pinInput, d.id); // doc id koleksi users = email
    if (hash === u.pin_hash) return { email: d.id, ...u };
  }
  return null;
}

// tandaiHargaPerluKonfirmasi / bukaBlokirHargaKonfirmasi — kelola field
// `harga_perlu_konfirmasi` (boolean) + `harga_pending` { harga_baru, harga_lama,
// tanggal, no_pembelian, suplayer, satuan_asal, sumber } di
// master_bahan_aksesoris. harga_baru & harga_lama SATU basis dengan harga_modal.
async function tandaiHargaPerluKonfirmasi(bahanId, pending) {
  try {
    await updateDoc(doc(db, 'master_bahan_aksesoris', bahanId), {
      harga_perlu_konfirmasi: true,
      harga_pending: pending
    });
  } catch (e) { console.error('Gagal menandai harga_perlu_konfirmasi:', bahanId, e); }
}


// PopupPin — popup verifikasi PIN per akun. Emit 'sukses' bawa {email, role,
// ..} pemilik PIN, TERMASUK saat pemiliknya bukan Owner-tier —
// pemanggil yang memutuskan cabangnya lewat tierOwnerKeAtas. PIN yang tidak
// cocok dengan siapa pun menaikkan counter; terkunci di percobaan ke-3.

const PopupPin = {
  props: {
    judul: { type: String, default: 'Masukkan PIN' },
    pesan: { type: String, default: '' }
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
          pin.value = ''; percobaan.value = 0;
          emit('sukses', user);
          return;
        }
        percobaan.value++;
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
        <p v-if="error" :style="{color: terkunci ? 'var(--danger)' : 'var(--danger)', fontSize:'11px', marginBottom:'10px'}">{{ error }}</p>
        <div style="display:flex; gap:8px;">
          <button v-if="!terkunci" @click="kirim" :disabled="memverifikasi || pin.length !== 6" class="btn-primary" style="flex:1;">{{ memverifikasi ? 'Memeriksa...' : 'Kirim' }}</button>
          <button @click="$emit('batal')" class="btn-outline" style="flex:1;">{{ terkunci ? 'Tutup' : 'Batal' }}</button>
        </div>
      </div>
    </div>
  `
};

// Kompresi & upload foto bon ke Firebase Storage
// Pola SAMA PERSIS seperti kompresFotoKeBlob/uploadFotoProduk di js/vue-
// master-produk.js (disalin, bukan diimpor silang) — 700px/kualitas 0.7, cukup
// buat foto bon fisik (bukan dokumen resolusi tinggi).
function kompresFotoKeBlob(file, maxDimensi, kualitas) {
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
async function uploadFotoBon(noPembelianAtauTemp, file) {
  const blob = await kompresFotoKeBlob(file, 900, 0.7);
  const pathFile = `pesanan_pembelian/${noPembelianAtauTemp}/bon_${Date.now()}.jpg`;
  const refFile = storageRef(storage, pathFile);
  await uploadBytes(refFile, blob);
  return await getDownloadURL(refFile);
}
async function hapusFotoBonLama(url) {
  if (!url) return;
  try { await deleteObject(storageRef(storage, url)); } catch (e) { /* file lama mungkin sudah tidak ada, abaikan */ }
}

// generateNoPembelian — pola SAMA seperti generateIdBerurutan di
// vue-bahan-aksesoris.js, cuma 1 kunci saja (tidak per-kategori).
async function generateNoPembelian() {
  const refDoc = doc(db, 'pengaturan_id_pembelian', 'pembelian');
  return await runTransaction(db, async (trx) => {
    const snap = await trx.get(refDoc);
    const data = snap.exists() ? snap.data() : null;
    if (!data || !data.prefix) {
      throw new Error('Prefix No. Pembelian belum diatur. Buka tombol "Pengaturan" (ikon gear) dulu untuk mengatur prefix-nya, baru simpan lagi.');
    }
    const counterBaru = (data.counter || 0) + 1;
    if (snap.exists()) trx.update(refDoc, { counter: counterBaru });
    else trx.set(refDoc, { prefix: data.prefix, counter: counterBaru });
    return `${data.prefix}${String(counterBaru).padStart(3, '0')}`;
  });
}


// PopupTambahSuplayerCepat — shortcut "+" di sebelah dropdown-cari Suplayer.
// Emit 'tersimpan' bawa nama Suplayer baru; komponen pemanggil yang auto-pilih
// di dropdown & refresh daftarnya sendiri.

const PopupTambahSuplayerCepat = {
  emits: ['tersimpan', 'tutup'],
  setup(props, { emit }) {
    const nama = ref('');
    const kontak = ref('');
    const menyimpan = ref(false);
    async function simpan() {
      const namaTrim = nama.value.trim();
      if (!namaTrim) return alert('Isi Nama Suplayer dulu.');
      menyimpan.value = true;
      try {
        await addDoc(collection(db, 'master_suplayer'), {
          nama: namaTrim,
          kontak: kontak.value.trim(),
          keterangan: '',
          dibuat_pada: serverTimestamp()
        });
        emit('tersimpan', namaTrim);
      } catch (e) {
        console.error('Gagal tambah Suplayer cepat:', e);
        alert('Gagal menambah Suplayer. Coba lagi.');
      }
      menyimpan.value = false;
    }
    return { nama, kontak, menyimpan, simpan };
  },
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="$emit('tutup')">
      <div class="gc-card" style="max-width:380px; width:100%;">
        <h3 style="font-weight:700; font-size:14px; margin-bottom:12px;"><i class="fas fa-truck-fast" style="color:var(--burgundy); margin-right:8px;"></i>Tambah Suplayer Baru</h3>
        <div class="gc-field">
          <label>Nama Suplayer <span style="color:var(--danger);">*</span></label>
          <input v-model="nama" @keyup.enter="simpan" type="text" placeholder="Nama Suplayer" autofocus>
        </div>
        <div class="gc-field">
          <label>Kontak/Alamat (opsional)</label>
          <input v-model="kontak" @keyup.enter="simpan" type="text" placeholder="Kontak/Alamat">
        </div>
        <div style="display:flex; gap:8px; margin-top:6px;">
          <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="flex:1;">{{ menyimpan ? 'Menyimpan...' : 'Simpan' }}</button>
          <button @click="$emit('tutup')" class="btn-outline" style="flex:1;">Batal</button>
        </div>
      </div>
    </div>
  `
};


// PengaturanStockPembelian — panel gear: atur prefix No. Pembelian.

const PengaturanStockPembelian = {
  emits: ['tutup'],
  setup(props, { emit }) {
    const prefix = ref('');
    const counter = ref(0);
    const memuat = ref(true);
    const menyimpan = ref(false);

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDoc(doc(db, 'pengaturan_id_pembelian', 'pembelian'));
        if (snap.exists()) { prefix.value = snap.data().prefix || ''; counter.value = snap.data().counter || 0; }
      } catch (e) {
        console.error('Gagal muat pengaturan No. Pembelian:', e);
      }
      memuat.value = false;
    }
    async function simpan() {
      if (!prefix.value.trim()) return alert('Isi prefix No. Pembelian dulu (contoh: NP).');
      menyimpan.value = true;
      try {
        await setDoc(doc(db, 'pengaturan_id_pembelian', 'pembelian'), { prefix: prefix.value.trim().toUpperCase() }, { merge: true });
        alert('Pengaturan tersimpan.');
      } catch (e) {
        console.error('Gagal simpan pengaturan No. Pembelian:', e);
        alert('Gagal menyimpan.');
      }
      menyimpan.value = false;
    }
    onMounted(muat);
    return { prefix, counter, memuat, menyimpan, simpan };
  },
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="$emit('tutup')">
      <div class="gc-card" style="max-width:480px; width:100%; max-height:90vh; overflow-y:auto;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:14px;"><i class="fas fa-gear" style="color:var(--burgundy); margin-right:8px;"></i>Pengaturan Stock &amp; Pembelian</h3>
        <div v-if="memuat" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;">Memuat...</div>
        <template v-else>
          <p style="font-size:11.5px; font-weight:700; color:var(--text-muted); margin-bottom:8px;">Prefix No. Pembelian (contoh: NP) — nomor urut naik otomatis.</p>
          <div class="gc-field">
            <label>Prefix</label>
            <input v-model="prefix" type="text" placeholder="Contoh: NP" style="text-transform:uppercase;">
            <p style="font-size:10px; color:var(--text-faint); margin-top:4px;">Sudah terpakai: {{ counter }}. Nomor berikutnya: {{ (prefix||'...').toUpperCase() }}{{ String(counter+1).padStart(3,'0') }}</p>
          </div>
          <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="width:100%;">{{ menyimpan ? 'Menyimpan...' : 'Simpan Prefix' }}</button>
          <p style="font-size:10.5px; color:var(--text-faint); margin-top:10px;"><i class="fas fa-circle-info" style="margin-right:4px;"></i>Kelola Data Suplayer sekarang lewat menu <b>Zevanic House &gt; Config</b>.</p>
        </template>
        <button @click="$emit('tutup')" class="btn-outline" style="width:100%; margin-top:18px;">Tutup</button>
      </div>
    </div>
  `
};


// AliasPembelianManager — tidak dipakai lagi; tab & mount sudah dicopot dari
// index.html dan petaMount. Fungsinya ada di AliasMoqManager
// (js/vue-master-suplayer.js); struktur dokumen `alias_pembelian` tidak berubah.

const AliasPembelianManager = {
  components: { DropdownCari, PengaturanStockPembelian, PopupTambahSuplayerCepat },
  setup() {
    const daftarBahan = ref([]);
    const daftarSuplayer = ref([]);
    const daftarAlias = ref([]);
    const memuat = ref(true);
    const menyimpan = ref(false);
    const tampilPengaturan = ref(false);
    // shortcut "+" tambah Suplayer cepat tanpa pindah ke Config, lihat
    // PopupTambahSuplayerCepat.
    const tampilTambahSuplayer = ref(false);
    async function onSuplayerBaruTersimpan(namaBaru) {
      tampilTambahSuplayer.value = false;
      daftarSuplayer.value = await ambilDaftarSuplayer();
      form.suplayerNama = namaBaru;
    }

    const form = reactive({ suplayerNama: '', namaInternal: '', namaDiNota: '' });
    // tampilkan nama+warna (formatNamaBahan, lihat atas) supaya item dengan
    // `nama` sama tapi `warna` beda bisa dibedakan di dropdown, DAN tidak salah
    // nyantol (lihat catatan di tambah di bawah).
    const opsiNamaInternal = computed(() => daftarBahan.value.map(formatNamaBahan));
    const opsiSuplayer = computed(() => daftarSuplayer.value.map(s => s.nama));

    const bolehTambah = computed(() => window.cekIzinMenu('stock_alias_pembelian', 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu('stock_alias_pembelian', 'delete') !== false);

    async function muatSemua() {
      memuat.value = true;
      try {
        const [bahan, suplayer, snapAlias] = await Promise.all([
          ambilDaftarBahanAksesorisLengkap(),
          ambilDaftarSuplayer(),
          getDocs(collection(db, 'alias_pembelian'))
        ]);
        daftarBahan.value = bahan;
        daftarSuplayer.value = suplayer;
        const list = []; snapAlias.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.suplayer_nama || '').localeCompare(b.suplayer_nama || ''));
        daftarAlias.value = list;
      } catch (e) {
        console.error('Gagal muat Alias Pembelian:', e);
      }
      memuat.value = false;
    }

    async function tambah() {
      if (!bolehTambah.value) return alert('Anda tidak punya izin menambah di sini. Hubungi Owner/PIC.');
      const suplayer = daftarSuplayer.value.find(s => s.nama === form.suplayerNama);
      // cocokkan lewat formatNamaBahan (nama+warna), BUKAN `nama` polos lagi —
      // dulu kalau ada 2+ item `nama` sama beda `warna`, ini selalu ambil yang
      // PERTAMA cocok (bisa salah varian warna, silent bug).
      const bahan = daftarBahan.value.find(b => formatNamaBahan(b) === form.namaInternal);
      if (!suplayer) return alert('Pilih Suplayer dulu. Kalau belum ada, tambahkan lewat tombol Pengaturan.');
      if (!bahan) return alert('Pilih Nama Bahan/Aksesoris (internal) dulu.');
      const namaDiNota = form.namaDiNota.trim();
      if (!namaDiNota) return alert('Isi nama barang persis seperti di nota Suplayer.');
      if (daftarAlias.value.some(a => a.suplayer_id === suplayer.id && (a.nama_di_nota || '').toLowerCase() === namaDiNota.toLowerCase())) {
        return alert('Alias ini sudah ada untuk Suplayer tersebut.');
      }
      menyimpan.value = true;
      try {
        await addDoc(collection(db, 'alias_pembelian'), {
          suplayer_id: suplayer.id, suplayer_nama: suplayer.nama,
          // `bahan_aksesoris_nama` disimpan sebagai `formatNamaBahan(bahan)`
          // (nama+warna) dan dipakai FALLBACK ARSIP kalau item internalnya
          // dihapus; tampilan utamanya baca LIVE dari daftarBahan (lihat
          // namaInternalTampil).
          bahan_aksesoris_id: bahan.id, bahan_aksesoris_nama: formatNamaBahan(bahan),
          nama_di_nota: namaDiNota,
          dibuat_pada: serverTimestamp()
        });
        form.namaInternal = ''; form.namaDiNota = '';
        await muatSemua();
      } catch (e) {
        console.error('Gagal simpan Alias Pembelian:', e);
        alert('Gagal menyimpan.');
      }
      menyimpan.value = false;
    }

    // namaInternalTampil — cari LIVE ke daftarBahan, bukan field
    // `bahan_aksesoris_nama` yang tersimpan statis, supaya alias lama ikut
    // update kalau nama/warna item diedit. Fallback ke field tersimpan HANYA
    // kalau item internalnya sudah terhapus.
    function namaInternalTampil(a) {
      const b = daftarBahan.value.find(x => x.id === a.bahan_aksesoris_id);
      return b ? formatNamaBahan(b) : (a.bahan_aksesoris_nama || '-');
    }

    async function hapus(item) {
      if (!bolehHapus.value) return alert('Anda tidak punya izin menghapus di sini. Hubungi Owner/PIC.');
      if (!confirm(`Hapus alias "${item.nama_di_nota}" -> "${item.bahan_aksesoris_nama}"?`)) return;
      try {
        await deleteDoc(doc(db, 'alias_pembelian', item.id));
        await muatSemua();
      } catch (e) {
        console.error('Gagal hapus Alias Pembelian:', e);
        alert('Gagal menghapus.');
      }
    }

    onMounted(async () => { await window.authReady; muatSemua(); });
    return { daftarAlias, memuat, menyimpan, form, opsiNamaInternal, opsiSuplayer, bolehTambah, bolehHapus, tampilPengaturan, tambah, hapus, namaInternalTampil, tampilTambahSuplayer, onSuplayerBaruTersimpan };
  },
  template: `
    <div class="gc-card" style="padding:16px;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
        <h3 style="font-weight:700; font-size:15px;"><i class="fas fa-tags" style="color:var(--burgundy); margin-right:8px;"></i>Alias Pembelian</h3>
        <button @click="tampilPengaturan = true" class="icon-btn" title="Pengaturan"><i class="fas fa-gear"></i></button>
      </div>
      <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Petakan nama barang di nota Suplayer (bisa beda-beda tiap Suplayer) ke 1 item internal di Data Bahan &amp; Aksesoris — supaya pencarian di Order Belanja lebih gampang.</p>
      <div v-if="bolehTambah" class="grid-cols-1 md:grid-cols-4" style="display:grid; gap:8px; align-items:end; margin-bottom:14px;">
        <div class="gc-field" style="margin-bottom:0;">
          <label>Suplayer</label>
          <div style="display:flex; gap:6px;">
            <dropdown-cari v-model="form.suplayerNama" :opsi="opsiSuplayer" placeholder="Pilih Suplayer..." />
            <button @click="tampilTambahSuplayer = true" type="button" class="icon-btn" style="flex-shrink:0;" title="Tambah Suplayer baru"><i class="fas fa-plus"></i></button>
          </div>
        </div>
        <div class="gc-field" style="margin-bottom:0;"><label>Nama di Nota Suplayer</label><input v-model="form.namaDiNota" type="text" placeholder="Persis seperti di nota" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;"></div>
        <div class="gc-field" style="margin-bottom:0;"><label>Nama Internal (Nama + Warna)</label><dropdown-cari v-model="form.namaInternal" :opsi="opsiNamaInternal" placeholder="Pilih item internal..." /></div>
        <button @click="tambah" :disabled="menyimpan" class="btn-primary" style="padding:0 18px; height:38px;"><i class="fas fa-plus"></i></button>
      </div>
      <div v-if="memuat" style="text-align:center; padding:16px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="daftarAlias.length === 0" style="font-size:11.5px; color:var(--text-faint);">Belum ada alias.</div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="a in daftarAlias" :key="a.id" class="gc-card" style="padding:14px;">
          <div style="margin-bottom:10px;">
            <div style="font-weight:700; font-size:13.5px;">{{ namaInternalTampil(a) }}</div>
            <div style="font-size:11.5px; color:var(--text-muted);">{{ a.suplayer_nama }}</div>
          </div>
          <div class="kartu-rows" style="display:flex; flex-direction:column; gap:5px; background:var(--ivory-dim); border-radius:10px; padding:10px 12px;" :style="{marginBottom: bolehHapus ? '10px' : '0'}">
            <div style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Nama di Nota</span><span style="font-weight:700;">{{ a.nama_di_nota }}</span></div>
          </div>
          <div v-if="bolehHapus" style="display:flex; gap:8px;">
            <button @click="hapus(a)" class="btn-outline" style="flex:1; font-size:11.5px; padding:7px 12px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-trash-alt" style="margin-right:6px;"></i>Hapus</button>
          </div>
        </div>
      </div>
      <pengaturan-stock-pembelian v-if="tampilPengaturan" @tutup="tampilPengaturan = false" />
      <popup-tambah-suplayer-cepat v-if="tampilTambahSuplayer" @tersimpan="onSuplayerBaruTersimpan" @tutup="tampilTambahSuplayer = false" />
    </div>
  `
};


// OrderBelanjaScreen — modeNota=false ("List Order Belanja") = ESTIMASI supir
// sebelum belanja: harga read-only, TIDAK memicu Riwayat Harga Pembelian
// maupun auto-update harga master. modeNota=true ("Nota Order Belanja") =
// pembelian nyata: harga bisa diedit dan memicu catatRiwayatHargaDanUpdateMaster.


// catatPergerakanKartuStok — Kartu Stok Bahan/Aksesoris. SATU-SATUNYA jalur
// yang boleh mengubah `stok_akhir` master; dipakai bareng hook pembelian di
// file ini dan form "Pemakaian Manual" di js/vue-kartu-stok.js lewat
// runTransaction yang sama. `qty` WAJIB sudah dalam satuan_pemakaian.
export async function catatPergerakanKartuStok({ bahanId, namaBahan, tanggal, jenis, qty, satuan, sumber, noPembelian, keterangan, lotBaru }) {
  const refBahan = doc(db, 'master_bahan_aksesoris', bahanId);
  const lotDibuat = [];
  await runTransaction(db, async (tx) => {
    const snapBahan = await tx.get(refBahan);
    const dataBahan = snapBahan.exists() ? snapBahan.data() : {};
    const stokSebelum = parseFloat(dataBahan.stok_akhir) || 0;
    const stokSetelah = jenis === 'masuk' ? stokSebelum + qty : stokSebelum - qty;
    const updateBahan = { stok_akhir: stokSetelah };

    const refGerak = doc(collection(db, 'kartu_stok_bahan_aksesoris'));
    tx.set(refGerak, {
      bahan_aksesoris_id: bahanId, nama_bahan: namaBahan, tanggal, jenis, qty,
      satuan: satuan || '', sumber: sumber || '', no_pembelian: noPembelian || '',
      keterangan: keterangan || '', saldo_setelah: stokSetelah,
      dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
    });
    // Lot baru (item `pakai_lot_tracking`) ditulis 1 dokumen
    // `lot_bahan_aksesoris` per baris DALAM transaksi yang SAMA. `kode_lot`
    // dibentuk dari `id_tampil` bahan (BUKAN ID dokumen Firestore) + counter
    // `lot_counter` yang di-increment di transaksi ini; fallback ke `bahanId`.
    if (jenis === 'masuk' && Array.isArray(lotBaru) && lotBaru.length > 0) {
      let counterLot = parseInt(dataBahan.lot_counter) || 0;
      const prefixLot = dataBahan.id_tampil || bahanId;
      lotBaru.forEach(l => {
        const qtyLot = parseFloat(l.qty) || 0;
        if (qtyLot <= 0) return;
        counterLot += 1;
        const kodeLot = `${prefixLot}-L${String(counterLot).padStart(3, '0')}`;
        const refLot = doc(collection(db, 'lot_bahan_aksesoris'));
        tx.set(refLot, {
          bahan_aksesoris_id: bahanId, nama_bahan: namaBahan, kode_lot: kodeLot,
          qty_awal: qtyLot, qty_sisa: qtyLot, satuan: satuan || '',
          tanggal_masuk: tanggal, no_pembelian: noPembelian || '',
          keterangan: l.keterangan || '', status: 'aktif',
          dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
        });
        lotDibuat.push({ id: refLot.id, kode_lot: kodeLot, qty: qtyLot, tanggal_masuk: tanggal, keterangan: l.keterangan || '' });
      });
      updateBahan.lot_counter = counterLot;
    }
    tx.set(refBahan, updateBahan, { merge: true });
  });
  return { lotDibuat };
}

// ambilLotAktif — baca lot AKTIF milik 1 bahan, urut FIFO (tanggal_masuk ASC).
// Dipakai vue-kartu-stok.js: cek kosong/tidaknya data lot, isi tabel alokasi &
// saran FIFO default, dan suggestion saat karyawan mengetik kode roll.
export async function ambilLotAktif(bahanId) {
  const snap = await getDocs(query(collection(db, 'lot_bahan_aksesoris'), where('bahan_aksesoris_id', '==', bahanId), where('status', '==', 'aktif')));
  const lots = []; snap.forEach(d => lots.push({ id: d.id, ...d.data() }));
  lots.sort((a, b) => (a.tanggal_masuk || '').localeCompare(b.tanggal_masuk || '') || ((a.dibuat_pada?.seconds || 0) - (b.dibuat_pada?.seconds || 0)));
  return lots;
}

// cariLotByKode — cari 1 lot AKTIF lewat `kode_lot` PERSIS (hasil scan QR label
// fisik roll, atau diketik manual). null kalau tidak ketemu/lot itu sudah habis
// (status bukan 'aktif' lagi, jadi tidak muncul di query ini).
export async function cariLotByKode(kodeLot) {
  if (!kodeLot) return null;
  const snap = await getDocs(query(collection(db, 'lot_bahan_aksesoris'), where('kode_lot', '==', String(kodeLot).trim()), where('status', '==', 'aktif')));
  let hasil = null;
  snap.forEach(d => { if (!hasil) hasil = { id: d.id, ...d.data() }; });
  return hasil;
}

// cariLotByKodeSemuaStatus — seperti `cariLotByKode` TAPI TANPA filter status,
// khusus Scan Opname (`vue-scan-opname.js`): roll yang di sistem sudah 'habis'
// tapi fisiknya ternyata masih ada harus tetap ketemu saat di-scan.
export async function cariLotByKodeSemuaStatus(kodeLot) {
  if (!kodeLot) return null;
  const snap = await getDocs(query(collection(db, 'lot_bahan_aksesoris'), where('kode_lot', '==', String(kodeLot).trim())));
  let hasil = null;
  snap.forEach(d => { if (!hasil) hasil = { id: d.id, ...d.data() }; });
  return hasil;
}

// ambilSemuaLotByBahan — SENGAJA ambil SEMUA status (aktif + habis), beda dari
// `ambilLotAktif`, karena dipakai reprint label roll yang datanya sudah habis
// di sistem. Di-export untuk `vue-bahan-aksesoris.js`.
export async function ambilSemuaLotByBahan(bahanId) {
  const snap = await getDocs(query(collection(db, 'lot_bahan_aksesoris'), where('bahan_aksesoris_id', '==', bahanId)));
  const lots = []; snap.forEach(d => lots.push({ id: d.id, ...d.data() }));
  lots.sort((a, b) => (b.tanggal_masuk || '').localeCompare(a.tanggal_masuk || '') || ((b.dibuat_pada?.seconds || 0) - (b.dibuat_pada?.seconds || 0)));
  return lots;
}

// catatLogCetakLabel — koleksi `log_cetak_label` tetap dimiliki file ini,
// di-`export` karena sekarang dipanggil dari file lain.
export async function catatLogCetakLabel(namaBarang, jumlah, jenis) {
  try {
    await addDoc(collection(db, 'log_cetak_label'), {
      tanggal: serverTimestamp(), nama_barang: namaBarang, jumlah_label: jumlah, jenis,
      dicetak_oleh: window.currentUser?.email || null
    });
  } catch (e) { console.error('Gagal catat log Cetak Label:', e); }
}

// cariBahanByIdTampil — cari master_bahan_aksesoris lewat field `id_tampil`
// (ID manusia-terbaca, mis. "BHN-0001"), BUKAN ID dokumen Firestore-nya, jadi
// WAJIB query bukan getDoc. Dipakai "Scan Barang" di vue-kartu-stok.js sebagai
// fallback kalau kode yang di-scan bukan kode_lot.
export async function cariBahanByIdTampil(idTampil) {
  if (!idTampil) return null;
  const snap = await getDocs(query(collection(db, 'master_bahan_aksesoris'), where('id_tampil', '==', String(idTampil).trim())));
  let hasil = null;
  snap.forEach(d => { if (!hasil) hasil = { id: d.id, ...d.data() }; });
  return hasil;
}

// ambilBahanById — getDoc LANGSUNG lewat ID dokumen Firestore asli (resolve
// `lot.bahan_aksesoris_id` hasil cariLotByKode), beda dari cariBahanByIdTampil.
// Dipisah supaya pemanggil tidak tertukar antara 2 jenis ID ini.
export async function ambilBahanById(bahanId) {
  if (!bahanId) return null;
  const snap = await getDoc(doc(db, 'master_bahan_aksesoris', bahanId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// catatPemakaianDariAlokasi — `alokasi` (array {lotId, qty}) ditentukan
// pemanggil; fungsi ini validasi total alokasi cocok dengan qty pemakaian,
// lalu SEMUA lot dibaca ULANG lewat tx.get sebelum ada tulisan apa pun. Lempar
// `LOT_BERUBAH` kalau data lot berubah. Param `sumber` opsional, default lama.
export async function catatPemakaianDariAlokasi({ bahanId, namaBahan, tanggal, qty, satuan, keterangan, alokasi, sumber }) {
  if (!Array.isArray(alokasi) || alokasi.length === 0) {
    throw new Error('Belum ada roll/lot yang dipilih untuk pemakaian ini.');
  }
  const totalAlokasi = alokasi.reduce((t, a) => t + (parseFloat(a.qty) || 0), 0);
  if (Math.round((totalAlokasi - qty) * 100) !== 0) {
    throw new Error(`Total qty roll/lot yang dipilih (${totalAlokasi}) tidak sama dengan jumlah pemakaian (${qty}).`);
  }

  const refBahan = doc(db, 'master_bahan_aksesoris', bahanId);
  const rincianHasil = [];
  let stokSetelahFinal = 0;
  await runTransaction(db, async (tx) => {
    const snapBahan = await tx.get(refBahan);
    const lotRefs = alokasi.map(a => doc(db, 'lot_bahan_aksesoris', a.lotId));
    const lotSnaps = [];
    for (const ref of lotRefs) lotSnaps.push(await tx.get(ref)); // WAJIB berurutan/di-await 1-1 dalam transaction (bukan Promise.all) — konsisten dengan cara tx.get dipakai di tempat lain

    const stokSebelum = snapBahan.exists() ? (parseFloat(snapBahan.data().stok_akhir) || 0) : 0;
    const stokSetelah = stokSebelum - qty;
    tx.set(refBahan, { stok_akhir: stokSetelah }, { merge: true });

    let totalTerpotongUlang = 0;
    alokasi.forEach((a, i) => {
      const lotSnap = lotSnaps[i];
      if (!lotSnap.exists()) {
        throw Object.assign(new Error('Salah satu roll/lot yang dipilih sudah tidak ada, coba pilih ulang roll/lot-nya.'), { kode: 'LOT_BERUBAH' });
      }
      const dataLot = lotSnap.data();
      const sisaSekarang = parseFloat(dataLot.qty_sisa) || 0;
      const diminta = parseFloat(a.qty) || 0;
      const ambilFix = Math.min(diminta, sisaSekarang);
      const sisaBaru = sisaSekarang - ambilFix;
      tx.update(lotRefs[i], { qty_sisa: sisaBaru, status: sisaBaru <= 0 ? 'habis' : 'aktif' });
      rincianHasil.push({ lot_id: a.lotId, kode_lot: dataLot.kode_lot || '', tanggal_masuk: dataLot.tanggal_masuk || '', dipotong: ambilFix, sisa_setelah: sisaBaru });
      totalTerpotongUlang += ambilFix;
    });
    // Jaga-jaga langka: kalau data lot berubah persis di antara alokasi disusun
    // (di UI) & transaksi ini dieksekusi (mis. ada pemakaian lain nyelip di roll
    // yang sama) sampai totalnya jadi tidak cukup lagi — batalkan transaksi ini
    // dengan pesan jelas, JANGAN diam-diam catat kurang dari qty yang diminta.
    if (Math.round((totalTerpotongUlang - qty) * 100) !== 0) {
      throw Object.assign(new Error('Data roll/lot berubah saat diproses (mungkin dipakai bersamaan di perangkat lain), coba pilih ulang roll/lot-nya.'), { kode: 'LOT_BERUBAH' });
    }

    const refGerak = doc(collection(db, 'kartu_stok_bahan_aksesoris'));
    tx.set(refGerak, {
      bahan_aksesoris_id: bahanId, nama_bahan: namaBahan, tanggal, jenis: 'keluar', qty,
      satuan: satuan || '', sumber: sumber || 'Pemakaian Manual (Pilih Roll/Lot)', no_pembelian: '',
      keterangan: keterangan || '', saldo_setelah: stokSetelah, rincian_lot: rincianHasil,
      dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
    });
    stokSetelahFinal = stokSetelah;
  });

  return { rincian: rincianHasil, stokSetelah: stokSetelahFinal };
}


// catatPenyesuaianOpnameItem / catatPenyesuaianOpnameLot — SATU-SATUNYA jalur
// yang boleh mengubah stok_akhir/qty_sisa akibat opname; selalu tercatat
// sebagai pergerakan "Penyesuaian" di `kartu_stok_bahan_aksesoris`. Input =
// qty FISIK yang ditemukan (bukan selisih); delta 0 -> tidak menulis apa pun.


// catatPenyesuaianOpnameItem — item BUKAN lot (opname per ITEM, bandingkan ke
// `stok_akhir` langsung).
export async function catatPenyesuaianOpnameItem({ bahanId, namaBahan, satuan, qtyFisik, keterangan }) {
  const refBahan = doc(db, 'master_bahan_aksesoris', bahanId);
  let hasil = { delta: 0, stokSebelum: 0, stokSetelah: 0 };
  await runTransaction(db, async (tx) => {
    const snapBahan = await tx.get(refBahan);
    const stokSebelum = snapBahan.exists() ? (parseFloat(snapBahan.data().stok_akhir) || 0) : 0;
    const delta = Math.round((qtyFisik - stokSebelum) * 100) / 100;
    hasil = { delta, stokSebelum, stokSetelah: qtyFisik };
    if (delta === 0) return; // sudah sesuai, tidak menulis apapun
    tx.set(refBahan, { stok_akhir: qtyFisik }, { merge: true });
    const refGerak = doc(collection(db, 'kartu_stok_bahan_aksesoris'));
    tx.set(refGerak, {
      bahan_aksesoris_id: bahanId, nama_bahan: namaBahan,
      tanggal: new Date().toISOString().slice(0, 10),
      jenis: delta > 0 ? 'masuk' : 'keluar', qty: Math.abs(delta),
      satuan: satuan || '', sumber: 'Penyesuaian (Scan Opname)', no_pembelian: '',
      keterangan: (keterangan ? keterangan + ' — ' : '') + `Opname: sistem ${stokSebelum} -> fisik ${qtyFisik}`,
      saldo_setelah: qtyFisik,
      dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
    });
  });
  return hasil;
}

// catatPenyesuaianOpnameLot — item LOT . qty_sisa roll itu SENDIRI diganti ke
// qty fisik, `stok_akhir` bahan induknya ikut bergeser sebesar delta yang SAMA
// (karena stok_akhir = jumlah SEMUA roll aktifnya).
export async function catatPenyesuaianOpnameLot({ lotId, qtyFisik, keterangan }) {
  const refLot = doc(db, 'lot_bahan_aksesoris', lotId);
  let hasil = { delta: 0, kodeLot: '', qtySisaSebelum: 0, qtySisaSetelah: 0 };
  await runTransaction(db, async (tx) => {
    const snapLot = await tx.get(refLot);
    if (!snapLot.exists()) throw new Error('Data roll/lot ini sudah tidak ada (mungkin dihapus). Coba scan ulang.');
    const dataLot = snapLot.data();
    const refBahan = doc(db, 'master_bahan_aksesoris', dataLot.bahan_aksesoris_id);
    const snapBahan = await tx.get(refBahan);
    const qtySisaSebelum = parseFloat(dataLot.qty_sisa) || 0;
    const delta = Math.round((qtyFisik - qtySisaSebelum) * 100) / 100;
    hasil = { delta, kodeLot: dataLot.kode_lot || '', qtySisaSebelum, qtySisaSetelah: qtyFisik };
    if (delta === 0) return; // sudah sesuai, tidak menulis apapun
    tx.update(refLot, { qty_sisa: qtyFisik, status: qtyFisik <= 0 ? 'habis' : 'aktif' });
    const stokAkhirSebelum = snapBahan.exists() ? (parseFloat(snapBahan.data().stok_akhir) || 0) : 0;
    const stokAkhirSetelah = stokAkhirSebelum + delta;
    tx.set(refBahan, { stok_akhir: stokAkhirSetelah }, { merge: true });
    const refGerak = doc(collection(db, 'kartu_stok_bahan_aksesoris'));
    tx.set(refGerak, {
      bahan_aksesoris_id: dataLot.bahan_aksesoris_id, nama_bahan: dataLot.nama_bahan || '',
      tanggal: new Date().toISOString().slice(0, 10),
      jenis: delta > 0 ? 'masuk' : 'keluar', qty: Math.abs(delta),
      satuan: dataLot.satuan || '', sumber: 'Penyesuaian (Scan Opname per Roll)', no_pembelian: '',
      keterangan: (keterangan ? keterangan + ' — ' : '') + `Roll ${dataLot.kode_lot || ''}: sistem ${qtySisaSebelum} -> fisik ${qtyFisik}`,
      saldo_setelah: stokAkhirSetelah,
      rincian_lot: [{ lot_id: lotId, kode_lot: dataLot.kode_lot || '', sisa_setelah: qtyFisik }],
      dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
    });
  });
  return hasil;
}


// PopupQtyPerLot — isi qty per roll/lot untuk 1 baris "Daftar Pesanan
// Pembelian". State diedit di induk OrderBelanjaScreen lewat props + emit
// 'tambah'/'hapus'/'terapkan'/'tutup', tidak disimpan ganda di sini.

const PopupQtyPerLot = {
  props: {
    baris: { type: Array, required: true },
    total: { type: Number, required: true },
    target: { type: Number, default: 0 },
    satuan: { type: String, default: '' },
    namaBarang: { type: String, default: '' }
  },
  emits: ['tambah', 'hapus', 'terapkan', 'tutup'],
  template: `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="$emit('tutup')">
      <div class="gc-card" style="max-width:520px; width:100%; max-height:90vh; overflow-y:auto;">
        <h3 style="font-weight:700; font-size:15px; margin-bottom:6px;"><i class="fas fa-layer-group" style="color:var(--burgundy); margin-right:8px;"></i>Qty per Roll/Lot — {{ namaBarang }}</h3>
        <p style="font-size:11px; color:var(--text-faint); margin-bottom:14px;">Isi qty tiap roll/kones satu per satu (qtynya bisa beda-beda tiap roll). Total dijumlah otomatis. Catatan: FIFO/pemakaian per-lot belum aktif — ronde ini baru mencatat qty per roll saat barang diterima.</p>
        <!-- Header kolom pakai "hidden md:flex": class ".md:grid" TIDAK ada di
             gechoo-design.css/index.html, jadi "hidden md:grid" bikin header
             permanen display:none bahkan di desktop. -->
        <div class="hidden md:flex" style="gap:6px; margin-bottom:4px;">
          <span style="flex:1; font-size:10px; font-weight:700; color:var(--text-faint);">NO</span>
          <span style="flex:1; font-size:10px; font-weight:700; color:var(--text-faint);">QTY ({{ satuan || 'satuan' }})</span>
          <span style="flex:1; font-size:10px; font-weight:700; color:var(--text-faint);">KETERANGAN (opsional)</span>
          <span style="flex:1;"></span>
        </div>
        <div v-for="(b, i) in baris" :key="i" class="grid-cols-1 md:grid-cols-4" style="display:grid; gap:6px; align-items:center; margin-bottom:8px;">
          <div><span class="gc-row-label">No</span><span style="font-size:11.5px; color:var(--text-muted);">{{ i + 1 }}</span></div>
          <div><span class="gc-row-label">Qty ({{ satuan || 'satuan' }})</span><input v-model.number="b.qty" type="number" min="0" placeholder="0" style="width:100%; padding:7px 6px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;"></div>
          <div><span class="gc-row-label">Keterangan (opsional)</span><input v-model="b.keterangan" type="text" placeholder="Mis. no. roll" style="width:100%; padding:7px 6px; border:1.5px solid var(--line); border-radius:8px; font-size:12px;"></div>
          <div style="display:flex; justify-content:flex-end;"><button @click="$emit('hapus', i)" class="icon-btn" style="color:var(--danger);" title="Hapus baris"><i class="fas fa-trash-alt"></i></button></div>
        </div>
        <button @click="$emit('tambah')" class="btn-outline" style="font-size:11.5px; padding:6px 14px; margin-bottom:16px;"><i class="fas fa-plus" style="margin-right:5px;"></i>Tambah Roll/Lot</button>
        <div style="background:var(--ivory-dim); border-radius:10px; padding:10px 14px; margin-bottom:16px; font-size:12.5px;">
          <div style="display:flex; justify-content:space-between;">
            <span style="color:var(--text-muted);">Total {{ baris.length }} roll/lot:</span><b>{{ total }} {{ satuan }}</b>
          </div>
          <div v-if="target > 0" style="display:flex; justify-content:space-between; margin-top:4px; padding-top:4px; border-top:1px dashed var(--line);">
            <span style="color:var(--text-muted);">Qty di baris pesanan:</span>
            <b :style="{color: total === target ? 'var(--text-muted)' : 'var(--danger)'}">{{ target }} {{ satuan }}{{ total !== target ? ' (beda dengan total roll!)' : '' }}</b>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="$emit('terapkan')" class="btn-primary" style="flex:1;">Terapkan</button>
          <button @click="$emit('tutup')" class="btn-outline" style="flex:1;">Batal</button>
        </div>
      </div>
    </div>
  `
};


// DaftarNotaScreen — Daftar Nota + form dalam 1 sub-tab, selalu berperilaku
// seperti Nota (harga manual, riwayat harga otomatis). Finalisasi Nota hanya
// Owner/PIC Owner; edit harga baris draft: PIN Owner-tier langsung
// berlaku, tier lain diqueue ke Riwayat Harga tanpa mengubah baris.

const DaftarNotaScreen = {
  components: { DropdownCari, PengaturanStockPembelian, PopupQtyPerLot, PopupTambahSuplayerCepat, PopupPratinjauCetakLabel, PopupPin },
  setup() {
    const menuId = 'stock_nota_order_belanja';
    const bolehSimpan = computed(() => window.cekIzinMenu(menuId, 'add') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu(menuId, 'delete') !== false);
    // sayaOwnerKeAtas — kalau user yang LOGIN SENDIRI sudah Owner/PIC Owner,
    // finalisasi TIDAK perlu minta PIN lagi (sesi login-nya sendiri
    // sudah membuktikan identitas — lihat instruksi tugas §Part 2 "kalau user
    // yang login sudah punya role itu, boleh skip PIN fresh").
    const sayaOwnerKeAtas = computed(() => tierOwnerKeAtas(window.currentUser));

    // Data referensi (dimuat sekali)
    const daftarBahan = ref([]);
    const daftarSuplayer = ref([]);
    const daftarPermintaan = ref([]); // dari persiapan_masalah, status menunggu
    const daftarAlias = ref([]);
    const memuatReferensi = ref(true);
    const tampilPengaturan = ref(false);
    const tampilTambahSuplayer = ref(false);
    async function onSuplayerBaruTersimpan(namaBaru) {
      tampilTambahSuplayer.value = false;
      daftarSuplayer.value = await ambilDaftarSuplayer();
      suplayerEntry.value = namaBaru;
    }
    async function muatReferensi() {
      memuatReferensi.value = true;
      try {
        const [bahan, suplayer, snapPermintaan, snapAlias] = await Promise.all([
          ambilDaftarBahanAksesorisLengkap(),
          ambilDaftarSuplayer(),
          // NAMA KOLEKSI: 'persiapan_masalah' -> 'permintaan_bahan_manual' —
          // nama lama dibebaskan utk skema TRB baru pos Masalah
          // (js/vue-pp-masalah.js). Fungsi tidak berubah.
          getDocs(query(collection(db, 'permintaan_bahan_manual'), where('status', '==', 'menunggu'))),
          getDocs(collection(db, 'alias_pembelian'))
        ]);
        daftarBahan.value = bahan;
        daftarSuplayer.value = suplayer;
        const listPermintaan = []; snapPermintaan.forEach(d => listPermintaan.push({ id: d.id, ...d.data() }));
        listPermintaan.sort((a, b) => (b.dibuat_pada?.seconds || 0) - (a.dibuat_pada?.seconds || 0));
        daftarPermintaan.value = listPermintaan;
        const listAlias = []; snapAlias.forEach(d => listAlias.push({ id: d.id, ...d.data() }));
        daftarAlias.value = listAlias;
      } catch (e) {
        console.error('Gagal muat data referensi Daftar Nota:', e);
      }
      memuatReferensi.value = false;
    }

    // MODE
    // LIST — wireframe step 2+3 ("Daftar Nota")

    const mode = ref('list'); // 'list' | 'form'
    const filterSumber = ref('semua'); // 'semua' | 'manual' | 'driver'
    const paginasiNota = usePaginasiFirestore(db, 'pesanan_pembelian', {
      perHalaman: 15,
      urutkanField: 'dibuat_pada',
      urutkanArah: 'desc',
      cariField: 'no_pembelian',
      constraintTambahan: () => filterSumber.value === 'manual' ? [where('order_driver_id', '==', null)] : [],
      petakan: (id, d) => ({ id, ...d })
    });
    function muatDaftarNota() {
      if (filterSumber.value === 'driver') return; // lihat catatan poin 3 di atas — SELALU kosong, belum ada fitur pengisinya
      paginasiNota.muatUlang();
    }
    watch(filterSumber, muatDaftarNota);
    function bukaNotaBaru() {
      formKosong();
      mode.value = 'form';
    }
    async function bukaNota(row) {
      try {
        const snap = await getDoc(doc(db, 'pesanan_pembelian', row.id));
        if (!snap.exists()) return alert('Nota ini sudah tidak ada (mungkin terhapus).');
        muatFormDariDoc(snap.id, snap.data());
        mode.value = 'form';
      } catch (e) {
        console.error('Gagal buka Nota:', e);
        alert('Gagal membuka Nota. Coba lagi.');
      }
    }
    function kembaliKeDaftar() {
      if (mode.value === 'form' && statusNota.value === 'draft' && daftarPesanan.value.length > 0 &&
        !confirm('Kembali ke Daftar Nota? Perubahan yang belum disimpan (Simpan Draft/Finalkan) akan hilang.')) return;
      mode.value = 'list';
      muatDaftarNota();
    }

    // MODE
    // FORM — wireframe step 3.1 (form) + 3.2 (entry keyboard-first)

    const draftDocId = ref(null);
    const noPembelianAktif = ref('');
    const statusNota = ref('draft');
    const tanggal = ref(new Date().toISOString().slice(0, 10));
    const suplayerEntry = ref('');
    const daftarPesanan = ref([]);
    const sumberPermintaanIds = ref([]);
    const orderDriverId = ref(null); // BARU — selalu null sekarang, lihat catatan poin 3
    const menyimpan = ref(false);
    const lotUntukCetak = ref([]);

    // foto_bon
    const fotoBonUrlTersimpan = ref(''); // URL yang SUDAH di Storage (dari doc lama)
    const fotoBonFile = ref(null); // File baru dipilih, belum diupload
    const fotoBonPreview = ref(''); // Preview lokal (objectURL) ATAU URL tersimpan
    const fotoBonDihapus = ref(false);
    function pilihFotoBon(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      fotoBonFile.value = file;
      fotoBonPreview.value = URL.createObjectURL(file);
      fotoBonDihapus.value = false;
    }
    function hapusFotoBon() {
      fotoBonFile.value = null; fotoBonPreview.value = ''; fotoBonDihapus.value = true;
    }

    const suplayerTerkunci = computed(() => daftarPesanan.value.length > 0);
    const estimasiBiaya = computed(() => daftarPesanan.value.reduce((t, i) => t + (parseFloat(i.qty) || 0) * (parseFloat(i.harga) || 0), 0));
    const adaTerpilih = computed(() => daftarPesanan.value.some(i => i.dicentang));
    const formReadOnly = computed(() => statusNota.value === 'final');

    const opsiSuplayer = computed(() => daftarSuplayer.value.map(s => s.nama));
    const opsiNamaBarangMap = computed(() => {
      const map = new Map();
      daftarBahan.value.forEach(b => {
        const label = formatNamaBahan(b);
        if (!map.has(label)) map.set(label, { bahan: b, namaAlias: '' });
      });
      const suplayerAktif = daftarSuplayer.value.find(s => s.nama === suplayerEntry.value);
      if (suplayerAktif) {
        daftarAlias.value
          .filter(a => a.suplayer_id === suplayerAktif.id)
          .forEach(a => {
            const bahan = daftarBahan.value.find(b => b.id === a.bahan_aksesoris_id);
            if (!bahan) return;
            const label = a.nama_di_nota;
            if (!map.has(label)) map.set(label, { bahan, namaAlias: a.nama_di_nota });
          });
      }
      return map;
    });

    function buatBarisPesanan(item, qty, keterangan, namaAlias, satuanBeliPilihan) {
      const suplayer = daftarSuplayer.value.find(s => s.nama === suplayerEntry.value);
      const satuanDipakai = satuanBeliPilihan || item.satuan_pembelian || '';
      const isiKonversi = faktorKonversiUntukSatuan(item, satuanDipakai);
      const hargaAwal = hargaUntukSatuan(item, satuanDipakai);
      return {
        dicentang: false,
        suplayer_id: suplayer ? suplayer.id : '', suplayer_nama: suplayerEntry.value,
        bahan_aksesoris_id: item.id, sku: item.id_tampil || item.id, nama: formatNamaBahan(item),
        nama_alias: namaAlias || '',
        qty: qty, satuan_bahan: satuanDipakai,
        qty_s: Math.round((qty * isiKonversi) * 100) / 100, satuan: item.satuan_pemakaian || '',
        isi_konversi: isiKonversi,
        harga: hargaAwal,
        // harga_asli — snapshot harga DEFAULT (belum diedit tangan) dipakai buat
        // mendeteksi "apakah harga baris ini diedit manual" (lihat
        // mulaiEditHarga di bawah).
        harga_asli: hargaAwal,
        keterangan: keterangan || '',
        pakai_lot_tracking: !!item.pakai_lot_tracking,
        detail_lot: []
      };
    }
    function itemAsliDariBaris(baris) {
      return daftarBahan.value.find(b => b.id === baris.bahan_aksesoris_id) || null;
    }

    // Keyboard-first entry (wireframe 3.2a-3.2e)
    const elCariItem = ref(null);
    const cariItemTeks = ref('');
    const indexSorot = ref(0);
    const hasilPencarian = computed(() => {
      const kata = cariItemTeks.value.trim().toLowerCase();
      if (!kata) return [];
      const hasil = [];
      const suplayerAktif = daftarSuplayer.value.find(s => s.nama === suplayerEntry.value);
      daftarBahan.value.forEach(b => {
        const label = formatNamaBahan(b);
        if (label.toLowerCase().includes(kata)) hasil.push({ label, sub: `${b.id_tampil || ''} · ${b.satuan_pembelian || ''}`, bahan: b, namaAlias: '' });
      });
      if (suplayerAktif) {
        daftarAlias.value
          .filter(a => a.suplayer_id === suplayerAktif.id && (a.nama_di_nota || '').toLowerCase().includes(kata))
          .forEach(a => {
            const bahan = daftarBahan.value.find(x => x.id === a.bahan_aksesoris_id);
            if (!bahan) return;
            hasil.push({ label: a.nama_di_nota, sub: `alias · ${formatNamaBahan(bahan)}`, bahan, namaAlias: a.nama_di_nota });
          });
      }
      return hasil.slice(0, 8);
    });
    watch(cariItemTeks, (val) => {
      indexSorot.value = 0;
      if (val) { barisAktifIndex.value = -1; tahapBarisAktif.value = 'selesai'; }
    });

    // barisAktifIndex/tahapBarisAktif — melacak baris yang baru masuk supaya
    // Tab (bukan mengetik) lanjut buka pop up berikutnya untuk baris ITU:
    // qty -> satuan -> harga+PIN. Mengetik di search box membatalkan rantai.
    const barisAktifIndex = ref(-1);
    const tahapBarisAktif = ref('selesai'); // 'baru' | 'qty' | 'satuan' | 'selesai'

    function opsiQtyCepatUntuk(baris) {
      const suplayerAktif = daftarSuplayer.value.find(s => s.nama === suplayerEntry.value);
      const alias = suplayerAktif && daftarAlias.value.find(a => a.bahan_aksesoris_id === baris.bahan_aksesoris_id && a.suplayer_id === suplayerAktif.id);
      const moq = alias && parseFloat(alias.moq) > 0 ? parseFloat(alias.moq) : 0;
      if (moq > 0) return [moq, moq * 2, moq * 5, moq * 10];
      return [1, 2, 5, 10, 50, 100];
    }

    function tambahItemDariPencarian(hasil) {
      if (!suplayerEntry.value) { alert('Pilih Suplayer dulu sebelum menambah item.'); return; }
      // Duplikat (bahan yang SAMA sudah ada di nota) -> qty++ pada baris yang
      // sudah ada, MIRROR tambahKeKeranjang di vue-pesanan.js (baris ~176-184) —
      // konsisten dengan pola "tambah lagi = qty naik" yang sudah dipakai di
      // Kasir.
      const idxAda = daftarPesanan.value.findIndex(b => b.bahan_aksesoris_id === hasil.bahan.id);
      if (idxAda >= 0) {
        daftarPesanan.value[idxAda].qty = (parseFloat(daftarPesanan.value[idxAda].qty) || 0) + 1;
        const item = itemAsliDariBaris(daftarPesanan.value[idxAda]);
        daftarPesanan.value[idxAda].qty_s = Math.round(daftarPesanan.value[idxAda].qty * faktorKonversiUntukSatuan(item, daftarPesanan.value[idxAda].satuan_bahan) * 100) / 100;
        barisAktifIndex.value = idxAda;
      } else {
        daftarPesanan.value.push(buatBarisPesanan(hasil.bahan, 1, '', hasil.namaAlias, hasil.bahan.satuan_pembelian));
        barisAktifIndex.value = daftarPesanan.value.length - 1;
      }
      tahapBarisAktif.value = 'baru';
      cariItemTeks.value = '';
      indexSorot.value = 0;
      nextTick(() => { elCariItem.value?.focus(); });
    }
    // Katalog grid kiri — jalur TAMBAHAN buat klik/browse produk; alur
    // keyboard-first di search box TETAP ADA apa adanya. Filter grid pakai
    // teks pencarian YANG SAMA (cariItemTeks), tidak ada state kedua.
    const daftarBahanTampilGrid = computed(() => {
      const kata = cariItemTeks.value.trim().toLowerCase();
      if (!kata) return daftarBahan.value;
      return daftarBahan.value.filter(b => formatNamaBahan(b).toLowerCase().includes(kata));
    });
    // qtyDiNota — badge kecil di kartu produk (grid kiri) kalau item itu SUDAH
    // ada di Item Nota (kanan), pola sama seperti badge bulat merah di wireframe
    // 3.1 ("2" di kartu Tafeta Cream).
    function qtyDiNota(bahanId) {
      const baris = daftarPesanan.value.find(b => b.bahan_aksesoris_id === bahanId);
      return baris ? (parseFloat(baris.qty) || 0) : 0;
    }
    // tambahItemGrid — logic "tambah/qty++" SAMA PERSIS dengan
    // tambahItemDariPencarian, cuma dipicu klik. Item pakai_lot_tracking TETAP
    // WAJIB lewat popup Qty per Roll/Lot — qty-nya selalu dari total lot.
    function tambahItemGrid(bahan) {
      if (!suplayerEntry.value) { alert('Pilih Suplayer dulu sebelum menambah item.'); return; }
      const idxAda = daftarPesanan.value.findIndex(b => b.bahan_aksesoris_id === bahan.id);
      if (idxAda >= 0) {
        const barisAda = daftarPesanan.value[idxAda];
        if (barisAda.pakai_lot_tracking) { bukaPopupLot(idxAda); return; }
        barisAda.qty = (parseFloat(barisAda.qty) || 0) + 1;
        const item = itemAsliDariBaris(barisAda);
        barisAda.qty_s = Math.round(barisAda.qty * faktorKonversiUntukSatuan(item, barisAda.satuan_bahan) * 100) / 100;
        return;
      }
      daftarPesanan.value.push(buatBarisPesanan(bahan, 1, '', '', bahan.satuan_pembelian));
      const idxBaru = daftarPesanan.value.length - 1;
      if (daftarPesanan.value[idxBaru].pakai_lot_tracking) bukaPopupLot(idxBaru);
    }
    // tambahQtyKartu/kurangiQtyKartu — rumus qty_s SAMA PERSIS dengan
    // konfirmasiQty (faktorKonversiUntukSatuan), cuma tanpa popup. Item
    // pakai_lot_tracking DIKECUALIKAN (qty selalu dari total Qty per Roll/Lot);
    // tombolnya disembunyikan di template, fungsi ini no-op kalau terpanggil.
    function tambahQtyKartu(i) {
      const baris = daftarPesanan.value[i];
      if (!baris || baris.pakai_lot_tracking) return;
      baris.qty = (parseFloat(baris.qty) || 0) + 1;
      const item = itemAsliDariBaris(baris);
      baris.qty_s = Math.round(baris.qty * faktorKonversiUntukSatuan(item, baris.satuan_bahan) * 100) / 100;
    }
    function kurangiQtyKartu(i) {
      const baris = daftarPesanan.value[i];
      if (!baris || baris.pakai_lot_tracking) return;
      const qtyBaru = (parseFloat(baris.qty) || 0) - 1;
      if (qtyBaru <= 0) {
        if (!confirm('Qty jadi 0 — hapus item "' + baris.nama + '" dari nota ini?')) return;
        daftarPesanan.value.splice(i, 1);
        if (barisAktifIndex.value === i) { barisAktifIndex.value = -1; tahapBarisAktif.value = 'selesai'; }
        return;
      }
      baris.qty = qtyBaru;
      const item = itemAsliDariBaris(baris);
      baris.qty_s = Math.round(qtyBaru * faktorKonversiUntukSatuan(item, baris.satuan_bahan) * 100) / 100;
    }
    function onKeydownCari(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); indexSorot.value = Math.min(indexSorot.value + 1, hasilPencarian.value.length - 1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); indexSorot.value = Math.max(indexSorot.value - 1, 0); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (hasilPencarian.value.length > 0) tambahItemDariPencarian(hasilPencarian.value[indexSorot.value]);
        return;
      }
      if (e.key === 'Tab' && !cariItemTeks.value && barisAktifIndex.value >= 0 && tahapBarisAktif.value !== 'selesai') {
        e.preventDefault();
        bukaTahapBerikutnya();
      }
    }
    function bukaTahapBerikutnya() {
      const baris = daftarPesanan.value[barisAktifIndex.value];
      if (!baris) { tahapBarisAktif.value = 'selesai'; return; }
      if (tahapBarisAktif.value === 'baru') {
        if (baris.pakai_lot_tracking) { bukaPopupLot(barisAktifIndex.value); return; }
        bukaPopupQty();
      } else if (tahapBarisAktif.value === 'qty') {
        bukaPopupSatuan();
      } else if (tahapBarisAktif.value === 'satuan') {
        mulaiEditHarga(barisAktifIndex.value, true);
      }
    }

    // Pop up Qty cepat
    const tampilPopupQty = ref(false);
    const qtyManualInput = ref('');
    function bukaPopupQty() {
      const baris = daftarPesanan.value[barisAktifIndex.value];
      qtyManualInput.value = String(baris.qty);
      tampilPopupQty.value = true;
    }
    function konfirmasiQty(nilai) {
      const qtyBaru = parseFloat(nilai);
      if (!(qtyBaru > 0)) { alert('Qty wajib angka lebih dari 0.'); return; }
      const baris = daftarPesanan.value[barisAktifIndex.value];
      if (baris) {
        baris.qty = qtyBaru;
        const item = itemAsliDariBaris(baris);
        baris.qty_s = Math.round(qtyBaru * faktorKonversiUntukSatuan(item, baris.satuan_bahan) * 100) / 100;
      }
      tampilPopupQty.value = false;
      tahapBarisAktif.value = 'qty';
      nextTick(() => { elCariItem.value?.focus(); });
    }
    function tutupPopupQtyTanpaUbah() { tampilPopupQty.value = false; tahapBarisAktif.value = 'qty'; nextTick(() => { elCariItem.value?.focus(); }); }

    // Pop up Satuan
    const tampilPopupSatuan = ref(false);
    const satuanPilihanAktif = ref('');
    const opsiSatuanAktif = ref([]);
    function bukaPopupSatuan() {
      const baris = daftarPesanan.value[barisAktifIndex.value];
      const item = itemAsliDariBaris(baris);
      opsiSatuanAktif.value = item ? opsiSatuanBeliUntuk(item) : [];
      // Default "satu tingkat dari satuan akhir" (wireframe 3.2d) — BEDA dari
      // default saat item pertama masuk (yang ikut satuan_pembelian, tingkat
      // teratas) — ini SENGAJA, mengikuti wireframe persis.
      satuanPilihanAktif.value = opsiSatuanAktif.value.length >= 2
        ? opsiSatuanAktif.value[opsiSatuanAktif.value.length - 2]
        : (opsiSatuanAktif.value[0] || baris.satuan_bahan);
      tampilPopupSatuan.value = true;
    }
    function konfirmasiSatuan(nilai) {
      const baris = daftarPesanan.value[barisAktifIndex.value];
      const item = itemAsliDariBaris(baris);
      if (baris && item && nilai) {
        baris.satuan_bahan = nilai;
        const isiKonversi = faktorKonversiUntukSatuan(item, nilai);
        baris.isi_konversi = isiKonversi;
        baris.qty_s = Math.round((parseFloat(baris.qty) || 0) * isiKonversi * 100) / 100;
        // Harga ikut menyesuaikan default tingkat baru (wireframe: "harga ikut
        // menyesuaikan") — HANYA kalau baris belum pernah diedit manual (harga
        // masih = harga_asli lama), supaya harga yang SUDAH dikonfirmasi
        // Owner/di-PIN tidak tertimpa diam-diam.
        if (Math.round(baris.harga) === Math.round(baris.harga_asli)) {
          const hargaBaru = hargaUntukSatuan(item, nilai);
          baris.harga = hargaBaru; baris.harga_asli = hargaBaru;
        }
      }
      tampilPopupSatuan.value = false;
      tahapBarisAktif.value = 'satuan';
      nextTick(() => { elCariItem.value?.focus(); });
    }
    function tutupPopupSatuanTanpaUbah() { tampilPopupSatuan.value = false; tahapBarisAktif.value = 'satuan'; nextTick(() => { elCariItem.value?.focus(); }); }

    // Edit Harga + PIN (wireframe 3.2e) — bisa
    // dipicu 2 cara: (a) rantai Tab ketiga sesudah item baru ditambahkan
    // (dariRantaiTab=true), (b) tombol pensil manual di baris mana pun selama
    // nota masih draft (dariRantaiTab=false).
    const tampilEditHarga = ref(false);
    const indexEditHarga = ref(-1);
    const hargaBaruInput = ref('');
    const dariRantaiTabHarga = ref(false);
    function mulaiEditHarga(i, dariRantaiTab) {
      const baris = daftarPesanan.value[i];
      if (!baris) return;
      indexEditHarga.value = i;
      hargaBaruInput.value = String(baris.harga);
      dariRantaiTabHarga.value = !!dariRantaiTab;
      tampilEditHarga.value = true;
    }
    function lewatiEditHarga() {
      tampilEditHarga.value = false;
      if (dariRantaiTabHarga.value) { tahapBarisAktif.value = 'selesai'; barisAktifIndex.value = -1; nextTick(() => { elCariItem.value?.focus(); }); }
    }
    const tampilPinHarga = ref(false);
    function ajukanHargaBaru() {
      const baris = daftarPesanan.value[indexEditHarga.value];
      if (!baris) return;
      const nilai = parseFloat(hargaBaruInput.value);
      if (!(nilai >= 0)) { alert('Harga wajib angka.'); return; }
      if (Math.round(nilai) === Math.round(baris.harga)) { lewatiEditHarga(); return; } // tidak berubah, tidak perlu PIN
      tampilPinHarga.value = true; // popup PIN, lihat template
    }
    async function pinHargaSukses(user) {
      tampilPinHarga.value = false;
      const i = indexEditHarga.value;
      const baris = daftarPesanan.value[i];
      const nilaiBaru = parseFloat(hargaBaruInput.value);
      if (!baris) { tampilEditHarga.value = false; return; }
      if (tierOwnerKeAtas(user)) {
        baris.harga = nilaiBaru; baris.diedit_oleh = user.email;
        alert(`Harga diperbarui oleh ${user.email} (${user.role}).`);
      } else {
        // Admin-tier: harga TIDAK diterapkan ke baris nota, cuma diqueue ke
        // Riwayat Harga menunggu Owner. SENGAJA unconditional (naik ATAU
        // turun), beda dari deteksi kenaikan otomatis saat finalisasi.
        const item = itemAsliDariBaris(baris);
        const isiKonversi = parseFloat(baris.isi_konversi) || 1;
        const hargaBaruPerSatuanPemakaian = nilaiBaru / isiKonversi;
        let hargaLama = 0;
        try {
          const snapBahan = await getDoc(doc(db, 'master_bahan_aksesoris', baris.bahan_aksesoris_id));
          hargaLama = snapBahan.exists() ? (parseFloat(snapBahan.data().harga_modal) || 0) : 0;
        } catch (e) { /* abaikan, tetap lanjut queue dengan harga_lama 0 */ }
        await tandaiHargaPerluKonfirmasi(baris.bahan_aksesoris_id, {
          harga_baru: hargaBaruPerSatuanPemakaian, harga_lama: hargaLama,
          tanggal: tanggal.value, no_pembelian: noPembelianAktif.value || '(draft, belum final)',
          suplayer: suplayerEntry.value, satuan_asal: baris.satuan_bahan, sumber: 'edit_draft'
        });
        alert(`PIN ini bukan PIN Owner/PIC Owner/Superuser (${user.role}). Perubahan harga TIDAK diterapkan ke Nota ini — dicatat sebagai usulan menunggu review Owner di Riwayat Harga Pembelian.`);
      }
      tampilEditHarga.value = false;
      lewatiEditHarga();
    }

    // Sumber permintaan (Persiapan Masalah)
    async function tambahDariPermintaan(p) {
      if (!suplayerEntry.value) return alert('Pilih Suplayer dulu (di panel Suplayer) sebelum menambah dari daftar ini.');
      const item = daftarBahan.value.find(b => b.id === p.bahan_aksesoris_id);
      if (!item) return alert('Data Bahan/Aksesoris sumber permintaan ini sudah tidak ditemukan (mungkin sudah dihapus).');
      daftarPesanan.value.push(buatBarisPesanan(item, p.qty, p.keterangan || ''));
      sumberPermintaanIds.value.push(p.id);
      try {
        await updateDoc(doc(db, 'permintaan_bahan_manual', p.id), { status: 'sudah_dipesan' });
        daftarPermintaan.value = daftarPermintaan.value.filter(x => x.id !== p.id);
      } catch (e) {
        console.error('Gagal tandai Persiapan Masalah sudah dipesan:', e);
      }
    }

    function hapusTerpilih() {
      if (!adaTerpilih.value) return;
      if (!confirm('Hapus baris yang dicentang dari daftar (belum tersimpan permanen)?')) return;
      daftarPesanan.value = daftarPesanan.value.filter(i => !i.dicentang);
    }

    // Pop up Qty per Roll/Lot (SAMA seperti sebelumnya, TIDAK diubah) -
    const tampilPopupLot = ref(false);
    const indexBarisLot = ref(-1);
    const barisLotSementara = ref([]);
    function bukaPopupLot(i) {
      const it = daftarPesanan.value[i];
      if (!it || !it.pakai_lot_tracking) return;
      indexBarisLot.value = i;
      barisLotSementara.value = (it.detail_lot && it.detail_lot.length > 0)
        ? JSON.parse(JSON.stringify(it.detail_lot))
        : [{ qty: '', keterangan: '' }];
      tampilPopupLot.value = true;
    }
    function tutupPopupLot() {
      tampilPopupLot.value = false;
      // Kalau ini bagian dari rantai Tab keyboard (Tab pertama pada item
      // lot-tracking), Batal tetap lanjutkan ke tahap satuan (item sudah masuk
      // qty 1 default) — konsisten dengan tutupPopupQtyTanpaUbah.
      if (indexBarisLot.value === barisAktifIndex.value) { tahapBarisAktif.value = 'qty'; nextTick(() => { elCariItem.value?.focus(); }); }
      indexBarisLot.value = -1;
    }
    function tambahBarisLot() { barisLotSementara.value.push({ qty: '', keterangan: '' }); }
    function hapusBarisLot(i) {
      if (barisLotSementara.value.length <= 1) return;
      barisLotSementara.value.splice(i, 1);
    }
    const totalQtyLot = computed(() => barisLotSementara.value.reduce((t, b) => t + (parseFloat(b.qty) || 0), 0));
    const barisLotTarget = computed(() => (indexBarisLot.value >= 0 && daftarPesanan.value[indexBarisLot.value]) ? (parseFloat(daftarPesanan.value[indexBarisLot.value].qty_s) || 0) : 0);
    const barisLotSatuan = computed(() => (indexBarisLot.value >= 0 && daftarPesanan.value[indexBarisLot.value]) ? (daftarPesanan.value[indexBarisLot.value].satuan || '') : '');
    const barisLotNama = computed(() => (indexBarisLot.value >= 0 && daftarPesanan.value[indexBarisLot.value]) ? (daftarPesanan.value[indexBarisLot.value].nama || '') : '');
    function terapkanLot() {
      const tidakLengkap = barisLotSementara.value.some(b => !(parseFloat(b.qty) > 0));
      if (tidakLengkap) { alert('Isi Qty tiap roll/lot dulu (harus lebih dari 0). Hapus baris yang tidak dipakai.'); return; }
      const idx = indexBarisLot.value;
      if (idx >= 0 && daftarPesanan.value[idx]) {
        daftarPesanan.value[idx].detail_lot = JSON.parse(JSON.stringify(barisLotSementara.value));
        daftarPesanan.value[idx].qty_s = totalQtyLot.value;
        daftarPesanan.value[idx].qty = totalQtyLot.value; // item lot: qty beli = qty pakai (1 roll dianggap 1 satuan beli)
      }
      tampilPopupLot.value = false;
      if (idx === barisAktifIndex.value) { tahapBarisAktif.value = 'qty'; nextTick(() => { elCariItem.value?.focus(); }); }
      indexBarisLot.value = -1;
    }

    // Form
    // kosong / muat draft / batal

    function formKosong() {
      draftDocId.value = null;
      noPembelianAktif.value = '';
      statusNota.value = 'draft';
      tanggal.value = new Date().toISOString().slice(0, 10);
      suplayerEntry.value = ''; cariItemTeks.value = '';
      daftarPesanan.value = []; sumberPermintaanIds.value = [];
      orderDriverId.value = null;
      fotoBonUrlTersimpan.value = ''; fotoBonFile.value = null; fotoBonPreview.value = ''; fotoBonDihapus.value = false;
      barisAktifIndex.value = -1; tahapBarisAktif.value = 'selesai';
      lotUntukCetak.value = [];
    }
    function muatFormDariDoc(id, d) {
      draftDocId.value = id;
      noPembelianAktif.value = d.no_pembelian || '';
      statusNota.value = d.status || 'draft';
      tanggal.value = d.tanggal || new Date().toISOString().slice(0, 10);
      suplayerEntry.value = d.items && d.items[0] ? d.items[0].suplayer_nama : '';
      daftarPesanan.value = JSON.parse(JSON.stringify(d.items || [])).map(i => ({
        ...i, dicentang: false,
        pakai_lot_tracking: !!i.pakai_lot_tracking, detail_lot: i.detail_lot || [],
        harga_asli: i.harga_asli === undefined ? i.harga : i.harga_asli
      }));
      sumberPermintaanIds.value = d.sumber_permintaan_ids || [];
      orderDriverId.value = d.order_driver_id || null;
      fotoBonUrlTersimpan.value = d.foto_bon || ''; fotoBonFile.value = null;
      fotoBonPreview.value = d.foto_bon || ''; fotoBonDihapus.value = false;
      barisAktifIndex.value = -1; tahapBarisAktif.value = 'selesai';
      lotUntukCetak.value = [];
    }
    function batal() {
      if (daftarPesanan.value.length > 0 && !confirm('Batalkan? Data yang belum disimpan akan hilang.')) return;
      formKosong();
      mode.value = 'list';
      muatDaftarNota();
    }


    // Simpan (Draft / Finalkan) — Finalkan SEKARANG digerbangi PIN/role
    // (TIGHTENED dari sebelumnya: dulu siapa pun dengan izin 'add' menu ini bisa
    // memfinalkan: hanya Owner/PIC Owner boleh finalisasi Nota, per tabel
    // peran wireframe).

    async function simpanDraft() { await simpan('draft'); }
    async function klikFinalkan() {
      if (!bolehSimpan.value) return alert('Anda tidak punya izin menyimpan di sini. Hubungi Owner/PIC.');
      if (daftarPesanan.value.length === 0) return alert('Belum ada item di Daftar Pesanan Pembelian.');
      if (!suplayerEntry.value) return alert('Pilih Suplayer dulu.');
      if (sayaOwnerKeAtas.value) { await simpan('final'); return; }
      tampilPinFinalisasi.value = true;
    }
    const tampilPinFinalisasi = ref(false);
    async function pinFinalisasiSukses(user) {
      tampilPinFinalisasi.value = false;
      if (!tierOwnerKeAtas(user)) {
        alert(`PIN ini bukan PIN Owner/PIC Owner/Superuser (peran: ${user.role}). Admin hanya bisa menyimpan Draft, tidak bisa memfinalkan Nota.`);
        return;
      }
      await simpan('final', { difinalisasi_oleh_pin: user.email });
    }

    async function simpan(statusBaru, opsiTambahan) {
      if (!bolehSimpan.value) return alert('Anda tidak punya izin menyimpan di sini. Hubungi Owner/PIC.');
      if (daftarPesanan.value.length === 0) return alert('Belum ada item di Daftar Pesanan Pembelian.');
      if (!suplayerEntry.value) return alert('Pilih Suplayer dulu.');
      menyimpan.value = true;
      try {
        let noPembelian = noPembelianAktif.value;
        if (!noPembelian) noPembelian = await generateNoPembelian();

        // Upload foto_bon (kalau ada file baru dipilih) — path pakai
        // no_pembelian yang SUDAH pasti ada di titik ini.
        let fotoBonUrlFinal = fotoBonUrlTersimpan.value;
        if (fotoBonFile.value) {
          if (fotoBonUrlTersimpan.value) await hapusFotoBonLama(fotoBonUrlTersimpan.value);
          fotoBonUrlFinal = await uploadFotoBon(noPembelian, fotoBonFile.value);
        } else if (fotoBonDihapus.value) {
          await hapusFotoBonLama(fotoBonUrlTersimpan.value);
          fotoBonUrlFinal = '';
        }

        const itemsFinal = daftarPesanan.value.map(({ dicentang, ...rest }) => ({
          ...rest, jumlah: Math.round((parseFloat(rest.qty) || 0) * (parseFloat(rest.harga) || 0))
        }));
        const payload = {
          no_pembelian: noPembelian,
          tanggal: tanggal.value,
          items: itemsFinal,
          estimasi_biaya_belanja: estimasiBiaya.value,
          status: statusBaru,
          sumber_permintaan_ids: sumberPermintaanIds.value,
          foto_bon: fotoBonUrlFinal, // BARU
          order_driver_id: orderDriverId.value, // BARU — selalu null sekarang
          dibuat_oleh: window.currentUser?.email || null,
          diupdate_pada: serverTimestamp(),
          ...(opsiTambahan || {})
        };
        if (draftDocId.value) {
          await updateDoc(doc(db, 'pesanan_pembelian', draftDocId.value), payload);
        } else {
          payload.dibuat_pada = serverTimestamp();
          const refBaru = await addDoc(collection(db, 'pesanan_pembelian'), payload);
          draftDocId.value = refBaru.id;
        }
        noPembelianAktif.value = noPembelian;
        fotoBonUrlTersimpan.value = fotoBonUrlFinal; fotoBonFile.value = null; fotoBonDihapus.value = false;
        statusNota.value = statusBaru;

        if (statusBaru === 'final') {
          try {
            const lotBaruDariNota = await catatRiwayatHargaDanUpdateMaster(itemsFinal, tanggal.value, noPembelian, suplayerEntry.value);
            if (Array.isArray(lotBaruDariNota) && lotBaruDariNota.length > 0) lotUntukCetak.value = lotBaruDariNota;
          } catch (e) {
            console.error('Pesanan tersimpan, TAPI gagal catat Riwayat Harga Pembelian:', e);
          }
        }
        alert(statusBaru === 'final' ? `Nota ${noPembelian} difinalkan (stok bertambah, tidak bisa diubah lagi).` : `Disimpan sebagai draft (${noPembelian}).`);
        if (statusBaru === 'final' && lotUntukCetak.value.length === 0) { mode.value = 'list'; muatDaftarNota(); }
      } catch (e) {
        console.error('Gagal simpan Nota:', e);
        alert(e.message && e.message.includes('Prefix') ? e.message : 'Gagal menyimpan. Coba lagi.');
      }
      menyimpan.value = false;
    }

    // `perbaruiHargaMasterDariRiwayat` HANYA dipanggil kalau harga baru BUKAN
    // kenaikan (sama/turun). Kalau lebih TINGGI dari harga_modal master ->
    // master tidak diupdate, ditandai `harga_perlu_konfirmasi` +
    // `harga_pending` sampai Owner menekan "Terapkan & buka blokir" lewat PIN.
    async function catatRiwayatHargaDanUpdateMaster(items, tanggalPembelian, noPembelianRef, suplayerNamaRef) {
      const lotDibuatSemua = [];
      for (const it of items) {
        if (!it.bahan_aksesoris_id || !(parseFloat(it.harga) > 0)) continue;
        const isiKonversi = parseFloat(it.isi_konversi) || 1;
        const hargaPerSatuanPemakaian = parseFloat(it.harga) / isiKonversi;
        try {
          await addDoc(collection(db, 'riwayat_harga_pembelian'), {
            bahan_aksesoris_id: it.bahan_aksesoris_id,
            nama_bahan: it.nama,
            tanggal: tanggalPembelian,
            satuan: it.satuan_bahan || '',
            harga: parseFloat(it.harga) || 0,
            isi_konversi: isiKonversi,
            satuan_pemakaian: it.satuan || '',
            harga_per_satuan_pemakaian: hargaPerSatuanPemakaian,
            no_pembelian: noPembelianRef,
            suplayer_nama: it.suplayer_nama || suplayerNamaRef || '',
            dibuat_pada: serverTimestamp(),
            dibuat_oleh: window.currentUser?.email || null
          });
          const snapBahan = await getDoc(doc(db, 'master_bahan_aksesoris', it.bahan_aksesoris_id));
          const hargaModalSaatIni = snapBahan.exists() ? (parseFloat(snapBahan.data().harga_modal) || 0) : 0;
          if (hargaModalSaatIni > 0 && hargaPerSatuanPemakaian > hargaModalSaatIni) {
            await tandaiHargaPerluKonfirmasi(it.bahan_aksesoris_id, {
              harga_baru: hargaPerSatuanPemakaian, harga_lama: hargaModalSaatIni,
              tanggal: tanggalPembelian, no_pembelian: noPembelianRef,
              suplayer: it.suplayer_nama || suplayerNamaRef || '', satuan_asal: it.satuan_bahan || '',
              sumber: 'finalize'
            });
          } else {
            await perbaruiHargaMasterDariRiwayat(it.bahan_aksesoris_id);
          }
        } catch (e) {
          console.error(`Gagal catat Riwayat Harga Pembelian / update master untuk "${it.nama}":`, e);
        }
        try {
          const qtyMasuk = parseFloat(it.qty_s) || 0;
          if (qtyMasuk > 0) {
            const hasilGerak = await catatPergerakanKartuStok({
              bahanId: it.bahan_aksesoris_id, namaBahan: it.nama, tanggal: tanggalPembelian,
              jenis: 'masuk', qty: qtyMasuk, satuan: it.satuan || '',
              sumber: 'Nota Order Belanja', noPembelian: noPembelianRef, keterangan: '',
              lotBaru: (it.pakai_lot_tracking && Array.isArray(it.detail_lot) && it.detail_lot.length > 0) ? it.detail_lot : undefined
            });
            if (hasilGerak && Array.isArray(hasilGerak.lotDibuat) && hasilGerak.lotDibuat.length > 0) {
              hasilGerak.lotDibuat.forEach(l => lotDibuatSemua.push({ ...l, nama_bahan: it.nama, satuan: it.satuan || '' }));
            }
          }
        } catch (e) {
          console.error(`Gagal catat Kartu Stok (masuk) untuk "${it.nama}":`, e);
        }
      }
      return lotDibuatSemua;
    }

    // perbaruiHargaMasterDariRiwayat — TIDAK DIUBAH rumusnya sama sekali dari
    // versi lama (lihat riwayat komentar §25.14 di atas file ini) — cuma titik
    // PEMANGGILANNYA sekarang digerbangi (lihat catatan di atas).
    async function perbaruiHargaMasterDariRiwayat(bahanId) {
      const snap = await getDocs(query(collection(db, 'riwayat_harga_pembelian'), where('bahan_aksesoris_id', '==', bahanId)));
      const semua = []; snap.forEach(d => semua.push(d.data()));
      if (semua.length === 0) return;

      const refBahan = doc(db, 'master_bahan_aksesoris', bahanId);
      const snapBahan = await getDoc(refBahan);
      if (!snapBahan.exists()) return;
      const bahan = snapBahan.data();
      const tingkat = Array.isArray(bahan.konversi_bertingkat) ? bahan.konversi_bertingkat : [];

      function termahalUntukSatuan(satuan) {
        const cocokSatuan = semua.filter(r => (r.satuan || '') === satuan && parseFloat(r.harga) > 0);
        if (cocokSatuan.length === 0) return null;
        const tgl = cocokSatuan.reduce((max, r) => (r.tanggal > max ? r.tanggal : max), cocokSatuan[0].tanggal);
        const kandidat = cocokSatuan.filter(r => r.tanggal === tgl);
        return kandidat.reduce((max, r) => (parseFloat(r.harga) > parseFloat(max.harga) ? r : max), kandidat[0]);
      }

      let hargaPembelianBaru, hargaModalBaru, konversiBertingkatBaru;
      if (tingkat.length > 0) {
        konversiBertingkatBaru = tingkat.map(t => {
          const t2 = termahalUntukSatuan(t.dari);
          return t2 ? { ...t, harga: parseFloat(t2.harga) } : { ...t };
        });
        const satuanAkhir = konversiBertingkatBaru[konversiBertingkatBaru.length - 1].ke;
        const satuanAkhirTermahal = termahalUntukSatuan(satuanAkhir);
        const hargaSatuanAkhirBaru = Math.max(
          hitungHargaPerSatuanAkhir(konversiBertingkatBaru),
          satuanAkhirTermahal ? parseFloat(satuanAkhirTermahal.harga) : 0
        );
        const isiKonversiSaatIni = parseFloat(bahan.isi_konversi_pembelian) || 1;
        hargaPembelianBaru = Math.round(hargaSatuanAkhirBaru * isiKonversiSaatIni);
        hargaModalBaru = hargaSatuanAkhirBaru;
      } else {
        const tanggalTerbaru = semua.reduce((max, r) => (r.tanggal > max ? r.tanggal : max), semua[0].tanggal);
        const kandidat = semua.filter(r => r.tanggal === tanggalTerbaru);
        const termahal = kandidat.reduce((max, r) => (r.harga_per_satuan_pemakaian > max.harga_per_satuan_pemakaian ? r : max), kandidat[0]);
        const isiKonversiSaatIni = parseFloat(bahan.isi_konversi_pembelian) || 1;
        hargaPembelianBaru = Math.round(termahal.harga_per_satuan_pemakaian * isiKonversiSaatIni);
        hargaModalBaru = isiKonversiSaatIni > 0 ? hargaPembelianBaru / isiKonversiSaatIni : 0;
      }

      const marginModal = parseFloat(bahan.margin_modal) || 0;
      const payload = {
        harga_pembelian: hargaPembelianBaru,
        harga_modal: hargaModalBaru,
        margin_modal: marginModal,
        harga_pemakaian: hargaModalBaru + (hargaModalBaru * marginModal / 100),
        harga_diupdate_dari_riwayat_pada: serverTimestamp()
      };
      if (konversiBertingkatBaru) payload.konversi_bertingkat = konversiBertingkatBaru;
      await updateDoc(refBahan, payload);
    }

    function cetak() {
      if (daftarPesanan.value.length === 0) return alert('Belum ada item untuk dicetak.');
      const w = window.open('', '_blank');
      if (!w) return alert('Popup diblokir browser. Izinkan popup untuk mencetak.');
      const baris = daftarPesanan.value.map((it, i) => `<tr>
        <td>${i + 1}</td><td>${it.sku || '-'}</td><td>${it.nama || '-'}</td>
        <td>${it.qty} ${it.satuan_bahan || ''}</td><td>${formatRupiah(it.harga)}</td><td>${formatRupiah((parseFloat(it.qty) || 0) * (parseFloat(it.harga) || 0))}</td><td>${it.keterangan || ''}</td>
      </tr>`).join('');
      w.document.write(`<html><head><title>${noPembelianAktif.value || 'Nota'}</title>
        <style>body{font-family:Arial,sans-serif;padding:24px;color:#222;} table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px;} th,td{border:1px solid #999;padding:6px 8px;text-align:left;} th{background:#f2f2f2;} h2{margin-bottom:2px;}</style>
        </head><body>
        <h2>Nota Order Belanja ${noPembelianAktif.value || '(belum tersimpan)'}</h2>
        <p>Tanggal: ${tanggal.value} &middot; Suplayer: ${suplayerEntry.value}</p>
        <table><thead><tr><th>No</th><th>SKU</th><th>Nama Barang</th><th>Qty</th><th>Harga</th><th>Jumlah</th><th>Keterangan</th></tr></thead><tbody>${baris}</tbody></table>
        <p style="margin-top:16px;"><b>Total: ${formatRupiah(estimasiBiaya.value)}</b></p>
        <script>window.print();<\/script>
        </body></html>`);
      w.document.close();
    }

    const popupCetakLabelAktif = ref(false);
    const daftarLabelPreview = ref([]);
    function cetakLabelLot(daftarLot) {
      if (!daftarLot || daftarLot.length === 0) return;
      if (typeof QRCode === 'undefined') {
        alert('Library pembuat QR belum siap dimuat. Coba refresh halaman (Ctrl+Shift+R) lalu ulangi.');
        return;
      }
      daftarLabelPreview.value = daftarLot.map((l) => ({
        kode: l.kode_lot,
        nama: l.nama_bahan || '',
        info: `${l.qty} ${l.satuan || ''} &middot; ${l.tanggal_masuk || ''}`,
        qrDataUrl: buatQrDataUrl(l.kode_lot)
      }));
      popupCetakLabelAktif.value = true;
    }
    function selesaiSetelahCetakLabel() {
      popupCetakLabelAktif.value = false;
      mode.value = 'list';
      muatDaftarNota();
    }

    onMounted(async () => { await window.authReady; await muatReferensi(); await muatDaftarNota(); });
    return {
      // referensi & izin
      memuatReferensi, tampilPengaturan, bolehSimpan, bolehHapus, sayaOwnerKeAtas,
      tampilTambahSuplayer, onSuplayerBaruTersimpan, daftarPermintaan,
      // list
      mode, filterSumber, paginasiNota, bukaNotaBaru, bukaNota, kembaliKeDaftar,
      // form
      draftDocId, noPembelianAktif, statusNota, formReadOnly, tanggal, suplayerEntry, suplayerTerkunci,
      daftarPesanan, opsiSuplayer, opsiNamaBarangMap, estimasiBiaya, adaTerpilih, formatRupiah,
      tambahDariPermintaan, hapusTerpilih, batal, simpanDraft, klikFinalkan, menyimpan, cetak,
      orderDriverId,
      // foto bon
      fotoBonPreview, pilihFotoBon, hapusFotoBon,
      // keyboard entry
      elCariItem, cariItemTeks, hasilPencarian, indexSorot, onKeydownCari, tambahItemDariPencarian,
      // katalog grid kiri (split-screen §3.1) + qty +/- kartu kanan
      daftarBahanTampilGrid, qtyDiNota, tambahItemGrid, tambahQtyKartu, kurangiQtyKartu,
      // pop up qty
      tampilPopupQty, qtyManualInput, opsiQtyCepatUntuk, konfirmasiQty, tutupPopupQtyTanpaUbah, barisAktifIndex,
      // pop up satuan
      tampilPopupSatuan, satuanPilihanAktif, opsiSatuanAktif, konfirmasiSatuan, tutupPopupSatuanTanpaUbah,
      // edit harga + PIN
      tampilEditHarga, indexEditHarga, hargaBaruInput, mulaiEditHarga, lewatiEditHarga, ajukanHargaBaru,
      tampilPinHarga, pinHargaSukses,
      // finalisasi + PIN
      tampilPinFinalisasi, pinFinalisasiSukses,
      // pop up lot
      tampilPopupLot, barisLotSementara, totalQtyLot, barisLotTarget, barisLotSatuan, barisLotNama,
      bukaPopupLot, tutupPopupLot, tambahBarisLot, hapusBarisLot, terapkanLot,
      // cetak label roll
      lotUntukCetak, cetakLabelLot, popupCetakLabelAktif, daftarLabelPreview, selesaiSetelahCetakLabel
    };
  },
  template: `
    <div>
      <!-- MODE LIST (wireframe 2+3) -->
      <div v-if="mode === 'list'" class="gc-card" style="padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap; margin-bottom:4px;">
          <h3 style="font-weight:700; font-size:16px;"><i class="fas fa-receipt" style="color:var(--burgundy); margin-right:8px;"></i>Daftar Nota</h3>
          <div style="display:flex; gap:8px; align-items:center;">
            <button @click="tampilPengaturan = true" class="icon-btn" title="Pengaturan"><i class="fas fa-gear"></i></button>
            <button v-if="bolehSimpan" @click="bukaNotaBaru" class="btn-primary" style="padding:8px 16px; font-size:12.5px;"><i class="fas fa-plus" style="margin-right:6px;"></i>Nota Baru</button>
          </div>
        </div>
        <p style="font-size:11.5px; color:var(--text-faint); margin-bottom:12px;">Nota manual DAN nota dari driver (List Order Driver — belum tersedia, lihat chip "Dari Driver" di bawah). Status <b>final</b> = stok sudah bertambah, Riwayat Harga sudah tertulis, tidak bisa diubah. <b>Draft</b> = belum ada efek samping, masih bisa diedit.</p>

        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
          <button @click="filterSumber = 'semua'" class="btn-outline" :class="{filled: filterSumber === 'semua'}" style="font-size:11.5px; padding:6px 14px;">Semua</button>
          <button @click="filterSumber = 'manual'" class="btn-outline" :class="{filled: filterSumber === 'manual'}" style="font-size:11.5px; padding:6px 14px;">Manual</button>
          <button @click="filterSumber = 'driver'" class="btn-outline" :class="{filled: filterSumber === 'driver'}" style="font-size:11.5px; padding:6px 14px;">Dari Driver</button>
        </div>

        <div style="position:relative; max-width:320px; margin-bottom:12px;" v-if="filterSumber !== 'driver'">
          <i class="fas fa-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-faint); font-size:12px;"></i>
          <input :value="paginasiNota.cariTeks.value" @input="paginasiNota.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari No. Nota (awalan)..." style="width:100%; padding:9px 13px 9px 34px; background:var(--ivory-dim); border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
        </div>

        <div v-if="filterSumber === 'driver'" class="gc-kosong">
          <div class="lingkaran"><i class="fas fa-truck"></i></div>
          <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0 0 6px;">Belum ada Nota dari Driver</h3>
          <p style="font-size:11.5px; color:var(--text-faint); max-width:340px; margin:0 auto;">Fitur "List Order Driver" (Persiapan Produksi &gt; Persiapan Belanja) belum dibangun — sub-tab ini akan otomatis terisi begitu driver klik Beli di fitur itu nanti.</p>
        </div>
        <div v-else-if="paginasiNota.memuat.value" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Memuat...</div>
        <div v-else-if="paginasiNota.errorPaginasi.value" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasiNota.errorPaginasi.value }}</div>
        <div v-else-if="paginasiNota.dataHalaman.value.length === 0" class="gc-kosong">
          <div class="lingkaran"><i class="fas fa-receipt"></i></div>
          <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Belum ada Nota</h3>
          <p style="font-size:11.5px; color:var(--text-faint);">Klik "Nota Baru" untuk mulai mencatat pembelian.</p>
        </div>
        <div v-else style="display:flex; flex-direction:column; gap:8px;">
          <div v-for="n in paginasiNota.dataHalaman.value" :key="n.id" class="gc-card" style="padding:12px 14px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <div style="flex:1; min-width:160px;">
              <div style="font-weight:700; font-size:13px;">{{ n.no_pembelian }}</div>
              <div style="font-size:11px; color:var(--text-muted);">{{ n.tanggal }} &middot; {{ (n.items && n.items[0] && n.items[0].suplayer_nama) || '-' }}</div>
            </div>
            <span class="tag neutral">{{ (n.items || []).length }} item</span>
            <span style="font-weight:700; font-size:12.5px; min-width:100px; text-align:right;">{{ formatRupiah(n.estimasi_biaya_belanja) }}</span>
            <span class="tag" :class="n.status === 'final' ? 'ok' : 'warn'">{{ n.status === 'final' ? 'final' : 'draft' }}</span>
            <span class="tag" :class="n.order_driver_id ? 'blue' : 'neutral'">{{ n.order_driver_id ? 'Dari Driver' : 'Manual' }}</span>
            <button @click="bukaNota(n)" class="btn-outline" style="font-size:11px; padding:6px 12px;">Buka</button>
          </div>
        </div>
        <div v-if="filterSumber !== 'driver' && !paginasiNota.memuat.value && paginasiNota.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
          <button class="icon-btn" :disabled="paginasiNota.nomorHalaman.value <= 1" @click="paginasiNota.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
          <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasiNota.nomorHalaman.value }}</span>
          <button class="icon-btn" :disabled="!paginasiNota.adaBerikutnya.value" @click="paginasiNota.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
        </div>
      </div>

      <!-- MODE FORM (wireframe 3.1 + 3.2) -->
      <div v-else>
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
          <div>
            <button @click="kembaliKeDaftar" class="btn-outline" style="font-size:11px; padding:5px 12px; margin-bottom:8px;"><i class="fas fa-arrow-left" style="margin-right:6px;"></i>Daftar Nota</button>
            <h3 style="font-weight:700; font-size:16px;"><i class="fas fa-receipt" style="color:var(--burgundy); margin-right:8px;"></i>{{ noPembelianAktif || 'Nota Baru' }}
              <span class="tag" :class="statusNota === 'final' ? 'ok' : 'warn'" style="margin-left:8px;">{{ statusNota }}</span>
              <span class="tag" :class="orderDriverId ? 'blue' : 'neutral'" style="margin-left:6px;">{{ orderDriverId ? 'Dari Driver' : 'Manual' }}</span>
            </h3>
          </div>
        </div>

        <div v-if="memuatReferensi" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Memuat data referensi...</div>
        <template v-else>
          <!--
            Sumber permintaan (Persiapan Masalah) — hanya relevan waktu masih draft & belum final
          -->
          <div v-if="!formReadOnly" class="gc-card" style="padding:14px; margin-bottom:14px;">
            <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Dari Persiapan Masalah ({{ daftarPermintaan.length }})</label>
            <div v-if="daftarPermintaan.length === 0" style="font-size:11.5px; color:var(--text-faint);">Tidak ada permintaan menunggu.</div>
            <div v-else style="display:flex; flex-direction:column; gap:8px;">
              <div v-for="p in daftarPermintaan" :key="p.id" class="gc-card" style="padding:10px 12px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <div style="flex:1; min-width:120px; font-weight:700; font-size:12.5px;">{{ p.nama_bahan }}</div>
                <span class="tag neutral">{{ p.qty }} {{ p.satuan }}</span>
                <button @click="tambahDariPermintaan(p)" class="btn-outline" style="font-size:11px; padding:5px 10px; color:var(--burgundy); border-color:var(--burgundy);"><i class="fas fa-circle-plus" style="margin-right:5px;"></i>Tambah</button>
              </div>
            </div>
          </div>

          <!-- Split-screen: KIRI katalog produk (klik = tambah), KANAN Item Nota
               sebagai kartu + qty +/-. Alur keyboard-first tetap ada di panel
               kiri; cara hitung total & simpan ke Firestore tidak disentuh. -->
          <div style="display:flex; gap:14px; flex-wrap:wrap; align-items:flex-start;">
            <!-- KIRI: katalog produk -->
            <div v-if="!formReadOnly" class="gc-card" style="flex:1.3; min-width:280px; padding:14px;">
              <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">Cari &amp; Tambah Item <span style="font-weight:400; color:var(--text-faint);">(ketik nama internal/alias suplayer — ↑↓ pilih, Enter masukkan, Tab lanjut isi qty/satuan/harga — atau klik langsung kartu produk di bawah)</span></label>
              <div style="position:relative; margin-bottom:12px;">
                <input ref="elCariItem" v-model="cariItemTeks" @keydown="onKeydownCari" type="text" :disabled="!suplayerEntry"
                  :placeholder="suplayerEntry ? 'Ketik nama bahan/aksesoris atau nama di nota suplayer...' : 'Pilih Suplayer dulu di bawah...'"
                  style="width:100%; padding:11px 14px; border:1.5px solid var(--line); border-radius:10px; font-size:13px;">
                <div v-if="hasilPencarian.length > 0" class="gc-card" style="position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:20; padding:6px; max-height:280px; overflow-y:auto;">
                  <div v-for="(h, i) in hasilPencarian" :key="i" @mousedown.prevent="tambahItemDariPencarian(h)"
                    :style="{padding:'8px 10px', borderRadius:'8px', cursor:'pointer', background: i === indexSorot ? 'var(--ivory-dim)' : 'transparent'}">
                    <div style="font-weight:700; font-size:12.5px;">{{ h.label }}</div>
                    <div style="font-size:10.5px; color:var(--text-faint);">{{ h.sub }}</div>
                  </div>
                </div>
              </div>

              <label style="font-size:11px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Katalog Item ({{ daftarBahanTampilGrid.length }})</label>
              <div v-if="!suplayerEntry" style="font-size:11.5px; color:var(--text-faint);">Pilih Suplayer dulu sebelum menambah item.</div>
              <div v-else-if="daftarBahanTampilGrid.length === 0" style="font-size:11.5px; color:var(--text-faint);">Tidak ada item cocok.</div>
              <div v-else style="display:grid; grid-template-columns:repeat(auto-fill, minmax(118px, 1fr)); gap:8px; max-height:560px; overflow-y:auto; padding-right:2px;">
                <button v-for="b in daftarBahanTampilGrid" :key="b.id" @click="tambahItemGrid(b)" type="button" class="gc-card" style="position:relative; padding:8px; border-radius:14px; text-align:left; cursor:pointer; border:1.5px solid var(--line);">
                  <span v-if="qtyDiNota(b.id) > 0" style="position:absolute; top:6px; right:6px; min-width:18px; height:18px; padding:0 4px; border-radius:9px; background:var(--burgundy); color:#fff; font-size:9.5px; font-weight:700; display:flex; align-items:center; justify-content:center;">{{ qtyDiNota(b.id) }}</span>
                  <div style="width:100%; height:42px; border-radius:8px; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; margin-bottom:6px;"><i class="fas fa-box" style="color:var(--text-faint); font-size:16px;"></i></div>
                  <div style="font-weight:700; font-size:11px; line-height:1.3; margin-bottom:2px;">{{ b.nama }}<span v-if="b.warna"> {{ b.warna }}</span></div>
                  <div style="font-size:9.5px; color:var(--text-faint);">{{ b.id_tampil || '-' }} &middot; {{ b.satuan_pembelian || '-' }}</div>
                </button>
              </div>
            </div>

            <!-- KANAN: Item Nota (keranjang) + Suplayer/Tanggal/Foto/Total/Aksi -->
            <div class="gc-card" style="flex:1; min-width:280px; padding:14px;">
              <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Item Nota ({{ daftarPesanan.length }})</label>
              <div v-if="daftarPesanan.length === 0" style="font-size:11.5px; color:var(--text-faint); margin-bottom:14px;">Belum ada item{{ formReadOnly ? '.' : ' — klik produk di kiri atau cari lewat kotak di atas.' }}</div>
              <div v-else style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;">
                <div v-for="(it, i) in daftarPesanan" :key="i" class="gc-card" :style="{padding:'10px 12px', background: i === barisAktifIndex ? 'rgba(var(--burgundy-rgb),.08)' : 'var(--ivory-dim)'}">
                  <div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:6px;">
                    <input v-if="!formReadOnly" type="checkbox" v-model="it.dicentang" style="accent-color:var(--burgundy); margin-top:3px; flex-shrink:0;">
                    <div style="flex:1; min-width:0;">
                      <div style="font-weight:700; font-size:12px;">{{ it.nama }}</div>
                      <div style="font-size:10px; color:var(--text-faint);">{{ it.sku }}<span v-if="it.nama_alias"> &middot; alias: {{ it.nama_alias }}</span></div>
                    </div>
                    <button v-if="it.pakai_lot_tracking" @click="bukaPopupLot(i)" class="icon-btn" style="flex-shrink:0;"
                      :style="{color: (it.detail_lot && it.detail_lot.length) ? 'var(--burgundy)' : 'var(--text-faint)'}"
                      :title="(it.detail_lot && it.detail_lot.length) ? ('Qty per Roll/Lot: ' + it.detail_lot.length + ' lot terisi') : 'Isi Qty per Roll/Lot'">
                      <i class="fas fa-layer-group"></i>
                    </button>
                  </div>

                  <div v-if="it.pakai_lot_tracking" style="font-size:10.5px; color:var(--text-muted); margin-bottom:6px;">{{ it.detail_lot ? it.detail_lot.length : 0 }} lot &middot; {{ it.qty_s }} {{ it.satuan }}</div>
                  <div v-else style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                    <template v-if="!formReadOnly">
                      <button @click="kurangiQtyKartu(i)" type="button" class="icon-btn" style="width:24px; height:24px;"><i class="fas fa-minus" style="font-size:9px;"></i></button>
                      <span style="font-size:12.5px; font-weight:700; min-width:26px; text-align:center;">{{ it.qty }}</span>
                      <button @click="tambahQtyKartu(i)" type="button" class="icon-btn" style="width:24px; height:24px;"><i class="fas fa-plus" style="font-size:9px;"></i></button>
                    </template>
                    <span v-else style="font-size:12.5px; font-weight:700;">{{ it.qty }}</span>
                    <span style="font-size:10.5px; color:var(--text-faint);">{{ it.satuan_bahan }} &middot; = {{ it.qty_s }} {{ it.satuan }}</span>
                  </div>

                  <div style="display:flex; align-items:baseline; gap:6px; margin-bottom:6px;">
                    <span style="font-size:10.5px; color:var(--text-faint);">{{ formatRupiah(it.harga) }} / {{ it.satuan_bahan }}</span>
                    <button v-if="!formReadOnly" @click="mulaiEditHarga(i, false)" class="icon-btn" style="width:20px; height:20px;" title="Edit harga (perlu PIN)"><i class="fas fa-pen" style="font-size:9px;"></i></button>
                    <span style="margin-left:auto; font-weight:700; font-size:12px;">{{ formatRupiah((parseFloat(it.qty)||0) * (parseFloat(it.harga)||0)) }}</span>
                  </div>

                  <input v-if="!formReadOnly" v-model="it.keterangan" type="text" placeholder="Keterangan (opsional)" style="width:100%; padding:5px 8px; border:1px solid var(--line); border-radius:6px; font-size:10.5px;">
                  <div v-else-if="it.keterangan" style="font-size:10px; color:var(--text-faint);">{{ it.keterangan }}</div>
                </div>
              </div>

              <div class="grid-cols-1 md:grid-cols-2" style="display:grid; gap:10px; margin-bottom:14px;">
                <div class="gc-field" style="margin-bottom:0;">
                  <label>Suplayer{{ suplayerTerkunci ? ' (terkunci — 1 Nota = 1 Suplayer)' : '' }} <span style="color:var(--burgundy);">wajib</span></label>
                  <div style="display:flex; gap:6px;">
                    <dropdown-cari v-model="suplayerEntry" :opsi="opsiSuplayer" :disabled="suplayerTerkunci || formReadOnly" placeholder="Pilih Suplayer..." />
                    <button v-if="!suplayerTerkunci && !formReadOnly" @click="tampilTambahSuplayer = true" type="button" class="icon-btn" style="flex-shrink:0;" title="Tambah Suplayer baru"><i class="fas fa-plus"></i></button>
                  </div>
                </div>
                <div class="gc-field" style="margin-bottom:0;"><label>Tanggal</label><input v-model="tanggal" type="date" :disabled="formReadOnly" style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;"></div>
              </div>

              <!-- Foto Bon (opsional) -->
              <div class="gc-field">
                <label>Foto Bon <span style="font-weight:400; color:var(--text-faint);">(opsional — foto nota fisik)</span></label>
                <div v-if="fotoBonPreview" style="margin-bottom:8px;">
                  <img :src="fotoBonPreview" style="width:120px; height:120px; object-fit:cover; border-radius:12px; border:1.5px solid var(--line);">
                </div>
                <div v-if="!formReadOnly" style="display:flex; gap:8px; align-items:center;">
                  <input type="file" accept="image/*" @change="pilihFotoBon" style="font-size:11.5px;">
                  <button v-if="fotoBonPreview" @click="hapusFotoBon" type="button" class="btn-outline" style="font-size:11px; padding:5px 10px;">Hapus Foto</button>
                </div>
              </div>

              <div class="gc-field" style="margin-bottom:14px;">
                <label>Total</label>
                <div style="padding:14px 18px; background:var(--ivory-dim); border-radius:15px; font-weight:700; font-size:19px; color:var(--burgundy);">{{ formatRupiah(estimasiBiaya) }}</div>
              </div>

              <div v-if="!formReadOnly" style="display:flex; gap:8px; flex-wrap:wrap;">
                <button v-if="bolehSimpan" @click="klikFinalkan" :disabled="menyimpan" class="btn-primary" style="flex:1; min-width:110px;">{{ menyimpan ? 'Menyimpan...' : 'Finalkan' }}</button>
                <button @click="batal" class="btn-outline" style="flex:1; min-width:90px;">Batal</button>
                <button v-if="bolehHapus" @click="hapusTerpilih" :disabled="!adaTerpilih" class="btn-outline" style="flex:1; min-width:90px; color:var(--danger); border-color:var(--danger);">Hapus Terpilih</button>
                <button @click="cetak" class="btn-outline" style="flex:1; min-width:90px;">Cetak</button>
                <button v-if="bolehSimpan" @click="simpanDraft" :disabled="menyimpan" class="btn-outline" style="flex:1; min-width:90px;">Simpan Draft</button>
              </div>
              <div v-else style="display:flex; gap:8px;">
                <button @click="cetak" class="btn-outline" style="flex:1;">Cetak</button>
              </div>
              <p v-if="!formReadOnly" style="font-size:10.5px; color:var(--text-faint); text-align:center; margin-top:8px;">Finalkan = stok bertambah, Riwayat Harga tertulis, tidak bisa diubah lagi. Hanya Owner/PIC Owner/Superuser yang bisa memfinalkan (Admin butuh PIN Owner).</p>

              <div v-if="lotUntukCetak.length > 0" style="margin-top:12px; background:var(--ivory-dim); border-radius:10px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <span style="font-size:12px;"><i class="fas fa-tags" style="color:var(--burgundy); margin-right:6px;"></i>{{ lotUntukCetak.length }} roll/lot baru dibuat dari Nota ini — cetak labelnya (QR) untuk ditempel ke roll fisiknya.</span>
                <button @click="cetakLabelLot(lotUntukCetak)" class="btn-primary" style="padding:8px 16px; font-size:12px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Label Roll</button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <pengaturan-stock-pembelian v-if="tampilPengaturan" @tutup="tampilPengaturan = false" />
      <popup-tambah-suplayer-cepat v-if="tampilTambahSuplayer" @tersimpan="onSuplayerBaruTersimpan" @tutup="tampilTambahSuplayer = false" />
      <popup-qty-per-lot v-if="tampilPopupLot" :baris="barisLotSementara" :total="totalQtyLot" :target="barisLotTarget" :satuan="barisLotSatuan" :nama-barang="barisLotNama"
        @tambah="tambahBarisLot" @hapus="hapusBarisLot" @terapkan="terapkanLot" @tutup="tutupPopupLot" />
      <popup-pratinjau-cetak-label :terbuka="popupCetakLabelAktif" judul="Cetak Label Roll" :daftar-label="daftarLabelPreview" jenis-cetak="label_roll_pembelian" @tutup="selesaiSetelahCetakLabel" />

      <!-- Pop up Qty (wireframe 3.2c) -->
      <div v-if="tampilPopupQty" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="tutupPopupQtyTanpaUbah">
        <div class="gc-card" style="max-width:380px; width:100%;">
          <h3 style="font-weight:700; font-size:14px; margin-bottom:10px;"><i class="fas fa-cubes" style="color:var(--burgundy); margin-right:8px;"></i>Pilih Qty</h3>
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
            <button v-for="q in opsiQtyCepatUntuk(daftarPesanan[barisAktifIndex] || {})" :key="q" @click="konfirmasiQty(q)" class="btn-outline" style="padding:6px 14px; font-size:12.5px;">{{ q }}</button>
          </div>
          <div class="gc-field">
            <label>Atau ketik manual</label>
            <input v-model="qtyManualInput" @keyup.enter="konfirmasiQty(qtyManualInput)" type="number" min="0" autofocus style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:13px;">
          </div>
          <div style="display:flex; gap:8px; margin-top:6px;">
            <button @click="konfirmasiQty(qtyManualInput)" class="btn-primary" style="flex:1;">Enter · Konfirmasi</button>
            <button @click="tutupPopupQtyTanpaUbah" class="btn-outline" style="flex:1;">Lewati</button>
          </div>
        </div>
      </div>

      <!-- Pop up Satuan (wireframe 3.2d) -->
      <div v-if="tampilPopupSatuan" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="tutupPopupSatuanTanpaUbah">
        <div class="gc-card" style="max-width:380px; width:100%;">
          <h3 style="font-weight:700; font-size:14px; margin-bottom:10px;"><i class="fas fa-ruler" style="color:var(--burgundy); margin-right:8px;"></i>Pilih Satuan</h3>
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
            <button v-for="s in opsiSatuanAktif" :key="s" @click="satuanPilihanAktif = s" class="btn-outline" :class="{filled: satuanPilihanAktif === s}" style="padding:6px 14px; font-size:12.5px;">{{ s }}</button>
          </div>
          <div style="display:flex; gap:8px;">
            <button @click="konfirmasiSatuan(satuanPilihanAktif)" class="btn-primary" style="flex:1;">Enter · Konfirmasi</button>
            <button @click="tutupPopupSatuanTanpaUbah" class="btn-outline" style="flex:1;">Lewati</button>
          </div>
        </div>
      </div>

      <!-- Edit Harga (wireframe 3.2e, langkah 1: input harga baru) -->
      <div v-if="tampilEditHarga" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="lewatiEditHarga">
        <div class="gc-card" style="max-width:380px; width:100%;">
          <h3 style="font-weight:700; font-size:14px; margin-bottom:6px;"><i class="fas fa-pen" style="color:var(--burgundy); margin-right:8px;"></i>Edit Harga</h3>
          <p style="font-size:11px; color:var(--text-faint); margin-bottom:10px;">Mengubah harga nota memerlukan PIN Owner/PIC Owner. PIN Admin akan masuk sebagai usulan menunggu review Owner di Riwayat Harga Pembelian.</p>
          <div class="gc-field">
            <label>Harga baru</label>
            <input v-model="hargaBaruInput" @keyup.enter="ajukanHargaBaru" type="number" min="0" autofocus style="width:100%; padding:9px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:13px;">
          </div>
          <div style="display:flex; gap:8px; margin-top:6px;">
            <button @click="ajukanHargaBaru" class="btn-primary" style="flex:1;">Lanjut · PIN</button>
            <button @click="lewatiEditHarga" class="btn-outline" style="flex:1;">Lewati</button>
          </div>
        </div>
      </div>
      <popup-pin v-if="tampilPinHarga" judul="PIN Edit Harga" pesan="Owner/PIC Owner/Superuser -> harga langsung berlaku. Peran lain -> usulan masuk Riwayat Harga menunggu review Owner." @sukses="pinHargaSukses" @batal="tampilPinHarga = false" />
      <popup-pin v-if="tampilPinFinalisasi" judul="PIN Finalisasi Nota" pesan="Hanya PIN Owner/PIC Owner/Superuser yang bisa memfinalkan Nota." @sukses="pinFinalisasiSukses" @batal="tampilPinFinalisasi = false" />
    </div>
  `
};


// RiwayatHargaPembelianManager — tabel READ-ONLY, paginasi cursor-based
// (WAJIB), diisi otomatis oleh catatRiwayatHargaDanUpdateMaster tiap kali Nota
// difinalkan. Cari berdasarkan nama bahan (awalan), urut dari tanggal terbaru.

const RiwayatHargaPembelianManager = {
  components: { PopupPin },
  setup() {
    const paginasi = usePaginasiFirestore(db, 'riwayat_harga_pembelian', {
      perHalaman: 15,
      urutkanField: 'tanggal',
      urutkanArah: 'desc',
      cariField: 'nama_bahan',
      petakan: (id, d) => ({ id, ...d })
    });

    // Banner "harga perlu konfirmasi" — query TERPISAH dari paginasi riwayat:
    // equality single-field (`harga_perlu_konfirmasi == true`), tidak butuh
    // index komposit dan tidak membaca seluruh master_bahan_aksesoris.
    const daftarPending = ref([]);
    const memuatPending = ref(true);
    async function muatDaftarPending() {
      memuatPending.value = true;
      try {
        const snap = await getDocs(query(collection(db, 'master_bahan_aksesoris'), where('harga_perlu_konfirmasi', '==', true)));
        const list = []; snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        daftarPending.value = list;
      } catch (e) {
        console.error('Gagal muat daftar harga_perlu_konfirmasi:', e);
      }
      memuatPending.value = false;
    }

    const tampilPinTerapkan = ref(false);
    const bahanAktifTerapkan = ref(null);
    function bukaTerapkan(bahan) { bahanAktifTerapkan.value = bahan; tampilPinTerapkan.value = true; }
    async function pinTerapkanSukses(user) {
      tampilPinTerapkan.value = false;
      const bahan = bahanAktifTerapkan.value;
      bahanAktifTerapkan.value = null;
      if (!bahan) return;
      if (!tierOwnerKeAtas(user)) {
        alert(`PIN ini bukan PIN Owner/PIC Owner/Superuser (peran: ${user.role}). Tidak berwenang menerapkan harga baru — hubungi Owner/PIC Owner.`);
        return;
      }
      const pending = bahan.harga_pending || {};
      const hargaModalBaru = parseFloat(pending.harga_baru) || 0;
      if (!(hargaModalBaru > 0)) { alert('Data harga pending tidak valid, tidak bisa diterapkan.'); return; }
      const marginModal = parseFloat(bahan.margin_modal) || 0;
      const isiKonversiSaatIni = parseFloat(bahan.isi_konversi_pembelian) || 1;
      // Untuk bahan dengan konversi_bertingkat, ini HANYA memperbarui
      // harga_modal di tingkat akhir (basis yang sama dipakai saat deteksi
      // kenaikan), TIDAK menghitung ulang seluruh rantai tingkat seperti
      // perbaruiHargaMasterDariRiwayat.
      try {
        await updateDoc(doc(db, 'master_bahan_aksesoris', bahan.id), {
          harga_modal: hargaModalBaru,
          harga_pembelian: Math.round(hargaModalBaru * isiKonversiSaatIni),
          harga_pemakaian: hargaModalBaru + (hargaModalBaru * marginModal / 100),
          harga_diupdate_dari_riwayat_pada: serverTimestamp(),
          harga_perlu_konfirmasi: false,
          harga_pending: null
        });
        alert(`Harga "${bahan.nama || bahan.id}" diperbarui & blokir checkout dibuka.`);
        await muatDaftarPending();
      } catch (e) {
        console.error('Gagal menerapkan harga pending:', e);
        alert('Gagal menerapkan harga. Coba lagi.');
      }
    }

    async function muat() { await paginasi.muatUlang(); await muatDaftarPending(); }
    onMounted(async () => { await window.authReady; await muat(); });
    return { paginasi, muat, formatRupiah, daftarPending, memuatPending, tampilPinTerapkan, bukaTerapkan, pinTerapkanSukses };
  },
  template: `
    <div>
      <!-- Banner harga perlu konfirmasi (wireframe §3.4/§4) -->
      <div v-if="!memuatPending && daftarPending.length > 0" class="gc-card" style="padding:14px; margin-bottom:14px; border:1.5px solid var(--warn); background:rgba(var(--warn-rgb),.06);">
        <h3 style="font-weight:700; font-size:13px; margin-bottom:8px;"><i class="fas fa-triangle-exclamation" style="margin-right:8px;"></i>{{ daftarPending.length }} Harga Perlu Konfirmasi Owner</h3>
        <p style="font-size:11px; color:var(--text-faint); margin-bottom:10px;">Harga baru LEBIH TINGGI dari harga master saat ini — belum diperbarui, dan checkout Pesanan untuk produk yang memakai bahan ini DIBLOKIR sampai diterapkan atau ditolak.</p>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div v-for="b in daftarPending" :key="b.id" class="gc-card" style="padding:10px 12px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <div style="flex:1; min-width:140px;">
              <div style="font-weight:700; font-size:12.5px;">{{ b.nama }}</div>
              <div style="font-size:10.5px; color:var(--text-faint);">{{ (b.harga_pending && b.harga_pending.no_pembelian) || '-' }} &middot; {{ (b.harga_pending && b.harga_pending.suplayer) || '-' }} &middot; {{ (b.harga_pending && b.harga_pending.tanggal) || '-' }}</div>
            </div>
            <div style="text-align:right; font-size:11.5px;">
              <span style="color:var(--text-faint); text-decoration:line-through;">{{ formatRupiah(b.harga_pending && b.harga_pending.harga_lama) }}</span>
              <i class="fas fa-arrow-right" style="margin:0 6px; color:var(--text-faint); font-size:10px;"></i>
              <span style="font-weight:700; color:var(--danger);">{{ formatRupiah(b.harga_pending && b.harga_pending.harga_baru) }}</span>
            </div>
            <button @click="bukaTerapkan(b)" class="btn-primary" style="font-size:11px; padding:6px 12px;">Terapkan &amp; Buka Blokir</button>
          </div>
        </div>
      </div>

      <popup-pin v-if="tampilPinTerapkan" judul="PIN Terapkan Harga" pesan="Hanya PIN Owner/PIC Owner/Superuser yang bisa menerapkan harga baru & membuka blokir checkout." @sukses="pinTerapkanSukses" @batal="tampilPinTerapkan = false" />

      <div class="gc-card" style="padding:14px;">
      <label style="font-size:12px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Riwayat Harga Pembelian</label>
      <p style="font-size:11px; color:var(--text-faint); margin-bottom:12px;">Tercatat otomatis tiap kali Nota / List Order Belanja di-final-kan. Harga Pembelian di Data Bahan &amp; Aksesoris otomatis mengikuti baris dengan tanggal PALING BARU (kalau ada beberapa di tanggal sama, yang PALING MAHAL per Satuan Pemakaian) — KECUALI kalau kenaikan itu sedang menunggu konfirmasi Owner (lihat banner di atas).</p>

      <div style="position:relative; max-width:320px; margin-bottom:12px;">
        <i class="fas fa-search" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-faint); font-size:12px;"></i>
        <input :value="paginasi.cariTeks.value" @input="paginasi.cariDenganDebounce($event.target.value)" type="text" placeholder="Cari nama bahan (awalan)..." style="width:100%; padding:9px 13px 9px 34px; background:var(--ivory-dim); border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
      </div>

      <div v-if="paginasi.memuat.value" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="paginasi.errorPaginasi.value" style="text-align:center; padding:20px; color:var(--danger); font-size:12px;">{{ paginasi.errorPaginasi.value }}</div>
      <div v-else-if="paginasi.dataHalaman.value.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada riwayat pembelian.</div>
      <div v-else style="overflow-x:auto;">
        <table class="gc-table" style="width:100%; font-size:11.5px;">
          <thead><tr>
            <th>Tanggal</th><th>Nama Bahan</th><th>Suplayer</th><th>Satuan Beli</th><th>Harga</th><th>Isi Konversi</th><th>Satuan Pemakaian</th><th>Harga / Satuan Pemakaian</th><th>No. Pembelian</th>
          </tr></thead>
          <tbody>
            <tr v-for="r in paginasi.dataHalaman.value" :key="r.id">
              <td>{{ r.tanggal }}</td><td>{{ r.nama_bahan }}</td><td>{{ r.suplayer_nama || '-' }}</td>
              <td>{{ r.satuan }}</td><td>{{ formatRupiah(r.harga) }}</td><td>{{ r.isi_konversi }}</td>
              <td>{{ r.satuan_pemakaian }}</td><td style="color:var(--burgundy); font-weight:700;">{{ formatRupiah(r.harga_per_satuan_pemakaian) }}</td>
              <td>{{ r.no_pembelian || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!paginasi.memuat.value && paginasi.dataHalaman.value.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
        <button class="icon-btn" :disabled="paginasi.nomorHalaman.value <= 1" @click="paginasi.halamanSebelumnya"><i class="fas fa-chevron-left"></i></button>
        <span style="font-size:12px; color:var(--text-muted);">Halaman {{ paginasi.nomorHalaman.value }}</span>
        <button class="icon-btn" :disabled="!paginasi.adaBerikutnya.value" @click="paginasi.halamanBerikutnya"><i class="fas fa-chevron-right"></i></button>
      </div>
      </div>
    </div>
  `
};


// Mount functions — 1 per sub-menu (pola sama seperti file Zevanic House lain)

const AppAliasPembelian = { components: { AliasPembelianManager }, template: `<alias-pembelian-manager />` };
let vmAliasPembelian = null;
window.pastikanMountAliasPembelian = function() {
  if (vmAliasPembelian) return;
  const mountPoint = document.getElementById('vue-alias-pembelian');
  if (mountPoint) vmAliasPembelian = createApp(AppAliasPembelian).mount('#vue-alias-pembelian');
};

// id internal `vue-nota-order-belanja` / `pastikanMountNotaOrderBelanja` /
// `sub-zh-stock-notaorder` SENGAJA dipertahankan walau label tab-nya "Daftar
// Nota", dan menu-id Config Akses tetap `stock_nota_order_belanja`, supaya izin
// yang sudah diatur Owner tidak ikut ter-reset.
const AppDaftarNota = { components: { DaftarNotaScreen }, template: `<daftar-nota-screen />` };
let vmDaftarNota = null;
window.pastikanMountNotaOrderBelanja = function() {
  if (vmDaftarNota) return;
  const mountPoint = document.getElementById('vue-nota-order-belanja');
  if (mountPoint) vmDaftarNota = createApp(AppDaftarNota).mount('#vue-nota-order-belanja');
};

const AppRiwayatHargaPembelian = { components: { RiwayatHargaPembelianManager }, template: `<riwayat-harga-pembelian-manager ref="mgr" />` };
let vmRiwayatHargaPembelian = null;
window.pastikanMountRiwayatHargaPembelian = function() {
  if (vmRiwayatHargaPembelian) {
    const mgr = vmRiwayatHargaPembelian.$refs && vmRiwayatHargaPembelian.$refs.mgr;
    if (mgr && typeof mgr.muat === 'function') mgr.muat();
    return;
  }
  const mountPoint = document.getElementById('vue-riwayat-harga-pembelian');
  if (mountPoint) vmRiwayatHargaPembelian = createApp(AppRiwayatHargaPembelian).mount('#vue-riwayat-harga-pembelian');
};

// Cetak label Bahan/Aksesoris ada di tombol per-kartu di
// `vue-bahan-aksesoris.js`; tab & mount "Cetak Label" di sini sudah tidak ada.
