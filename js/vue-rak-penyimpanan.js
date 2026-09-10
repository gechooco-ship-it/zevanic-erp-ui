// js/vue-rak-penyimpanan.js
// ============================================================================
// Stock & Pembelian > "Rak Penyimpanan" — sub-tab ke-4.
//
// RIWAYAT:
//   - §24 (lama): Kode/Baris/Kolom Rak = 3 dropdown master data LEPAS
//     langsung di form Bahan/Aksesoris, tanpa dimensi/kapasitas apapun.
//   - §25 (25 Agt 2026): dirombak jadi menu tersendiri "Rak Penyimpanan" di
//     Zevanic House > Data Bahan & Aksesoris. Kode/Baris/Kolom Rak MASIH 3
//     dropdown master data ('kode_rak'/'baris_rak'/'kolom_rak', dikelola
//     lewat panel Pengaturan/gear di Entry Bahan & Aksesoris), digabung jadi
//     `rak_label` dash-joined ("A-2-3") buat ditampilkan & dipakai sebagai
//     opsi dropdown "Pilih Rak" di form Bahan/Aksesoris (rak_id + rak_label
//     didenormalisasi ke situ, lihat js/vue-bahan-aksesoris.js).
//   - §26.1 (27 Agt 2026): panel Pengaturan di Entry Bahan & Aksesoris
//     DIROMBAK — 3 kategori master_data 'kode_rak'/'baris_rak'/'kolom_rak'
//     DIHAPUS TOTAL dari panel itu (bukan dipindah), karena sudah dianggap
//     redundan dengan menu Rak Penyimpanan ini. Makanya waktu ronde INI
//     (7 Sep 2026) dicek ulang ke kode live, window.ambilMasterList untuk
//     3 kategori itu SUDAH TIDAK dipanggil dari manapun lagi selain file
//     ini sendiri — jadi PANGGILANNYA DIHAPUS DI SINI JUGA (lihat poin 3
//     di bawah). Dokumen master_data/kode_rak, master_data/baris_rak,
//     master_data/kolom_rak di Firestore (kalau pernah keisi) jadi data
//     YATIM murni, TIDAK dibaca/ditulis siapapun lagi setelah ronde ini —
//     aman dibiarkan (bukan tanggung jawab modul ini untuk membersihkannya).
//
// RONDE INI (7 Sep 2026, wireframe handoff "04 - Stok dan Pembelian" §6.1,
// keputusan Guru: "Ikuti wireframe (migrasi model data)"):
//   1. PINDAH lokasi menu — dari Zevanic House > Data Bahan & Aksesoris ke
//      Stock & Pembelian (sub-tab ke-4, setelah Kartu Stok). Lihat
//      index.html, js/dashboard.js (tabel mount), js/vue-config-akses.js
//      (menu-id baru 'stock_rak_penyimpanan', id lama 'bahan_aksesoris_rak'
//      dipensiunkan supaya izin lama tidak yatim).
//   2. MIGRASI MODEL DATA kode rak — SEBELUMNYA 3 dropdown master-list
//      lepas (kode_rak/baris_rak/kolom_rak, masing-masing dipilih dari
//      daftar terkelola), digabung jadi `rak_label` dash-joined ("A-2-3").
//      SEKARANG 3 input TEKS BEBAS (field baru `rak`, plus `baris_rak`/
//      `kolom_rak` yang sekarang teks bebas juga, bukan lagi dropdown),
//      digabung LANGSUNG tanpa pemisah jadi 1 `kode_rak` (mis. "E"+"1"+"1"
//      = "E11") — sesuai wireframe persis ("kode rak otomatis ... rak +
//      baris + kolom, wajib unik"). `kode_rak` di ronde ini BERUBAH MAKNA:
//      dulu cuma "segmen rak" (mis. "A"), SEKARANG kode gabungan penuh
//      (mis. "E11"). `rak_label` DIPERTAHANKAN sebagai alias dari
//      `kode_rak` baru (SAMA NILAINYA) — field itu masih jadi sumber opsi
//      dropdown "Pilih Rak" & pengurutan di js/vue-bahan-aksesoris.js,
//      TIDAK ada perubahan kode di file itu (dicek langsung — cukup ganti
//      NILAI rak_label, formatnya generik string, bukan diparse).
//   3. DOKUMEN LAMA (dibuat sebelum ronde ini, field kode_rak = cuma segmen
//      "A" bukan kode gabungan) — sempat ditangani via fallback baca
//      (skemaBaru/kodeTampilRak/segmenRakTampil cek field `rak` dulu
//      sebelum menafsirkan kode_rak). GURU KONFIRMASI (10 Sep 2026): semua
//      dokumen Rak lama itu SUDAH DIHAPUS manual dari Firestore produksi —
//      seluruh dokumen `master_rak_penyimpanan` yang tersisa sekarang pasti
//      skema baru (field `rak` selalu ada). Fallback skema-lama DIHAPUS di
//      ronde ini (lihat skemaBaru/kodeTampilRak/segmenRakTampil di bawah —
//      sekarang baca field baru langsung, tanpa cabang lama) — bukan hilang
//      diam-diam, memang sengaja disederhanakan karena datanya sudah tidak
//      ada lagi.
//   4. VOLUME — field `volume_rak` TETAP tersimpan cm³ (TIDAK diubah unit
//      penyimpanannya) karena field ini juga dibaca js/vue-bahan-
//      aksesoris.js (hint dimensi rak di dropdown "Pilih Rak", 2 tempat:
//      Entry & Edit form, teks "Kapasitas: X cm³") — kalau unit simpannya
//      diganti ke m³ tapi label teks di file itu tidak ikut diubah, angka
//      yang tampil di sana jadi SALAH (kelihatan cm³ tapi isinya m³).
//      Opsi diambil: SIMPAN cm³ apa adanya (tidak ada perubahan di file
//      itu, nol risiko regresi di sana), KONVERSI ke m³ CUMA di layar ini
//      (÷1.000.000) buat tampilan — sesuai wireframe ("0,48 m³"). Field
//      `volume_barang` di master_bahan_aksesoris (volume PER SATUAN 1
//      item, beda konsep dari volume_rak) JUGA tetap cm³ apa adanya,
//      dipakai bareng buat hitung kapasitas di poin 5.
//   5. KAPASITAS BAR (terpakai/sisa/%) — BARU, logic-nya SEBELUMNYA
//      sengaja belum dikerjakan (lihat riwayat §25 & catatan di js/vue-
//      bahan-aksesoris.js: "Peringatan overstok BELUM dikerjakan di
//      sini"). FORMULA yang dipakai (BELUM PERNAH dikonfirmasi eksplisit
//      ke Guru, level risiko tinggi kalau salah asumsi — TOLONG DICEK):
//        terpakai (1 item, cm³) = stok_akhir(item) × volume_barang(item)
//        terpakai (1 rak, cm³) = SUM terpakai semua item yang rak_id-nya
//                                 menunjuk ke rak itu (rak bisa dipakai
//                                 bareng > 1 item — realistis di gudang
//                                 nyata; bar kapasitas jadi properti RAK,
//                                 SAMA nilainya di semua baris item yang
//                                 berbagi rak yang sama, bukan per-item)
//        sisa (cm³) = volume_rak − terpakai (rak) — BISA NEGATIF (over
//                     kapasitas, lihat state ekstrem di bawah)
//        persen = terpakai / volume_rak × 100 (kalau volume_rak = 0,
//                 dianggap 100% kalau ada isinya, 0% kalau kosong —
//                 hindari bagi nol)
//        warna bar: <50% ok (hijau) · 50–79% warn (kuning/amber) · ≥80%
//                   danger (merah) — dicocokkan ke contoh warna di
//                   wireframe (72%→amber, 88%→merah, 45%/30%/15%→hijau).
//      ASUMSI ini genuinely BARU (bukan port dari logic lama yang memang
//      belum ada) — kalau Guru punya definisi "terpakai" yang beda (mis.
//      berdasar qty roll/lot, bukan stok_akhir polos), tolong dikoreksi.
//   6. Query item-rak — pakai where('rak_id','>','') (bukan fetch SEMUA
//      master_bahan_aksesoris) supaya HANYA baca dokumen yang benar-benar
//      punya rak_id terisi (item tanpa Rak tidak ikut kebaca) — selaras
//      PRINSIP-HEMAT.md (baca Firestore seminim mungkin), sekaligus
//      menghindari fetch field `foto` (base64) semua item yang tidak
//      relevan di layar ini. Query 1-filter begini biasanya TIDAK perlu
//      index komposit baru, tapi tetap dibungkus try/catch dgn pesan
//      "buat index" (pola sama js/vue-config.js) untuk jaga-jaga.
//   7. Panel Pengaturan (gear) di Entry Bahan & Aksesoris — DICEK ULANG ke
//      kode live (js/vue-bahan-aksesoris.js, komponen
//      PengaturanBahanAksesoris): TERNYATA SUDAH DIROMBAK sejak §26.1 (27
//      Agt 2026, sebelum ronde ini), SUDAH TIDAK ADA config Rak/Kode/Baris/
//      Kolom apapun di sana lagi (cuma sisa Prefix ID). Jadi TIDAK ADA
//      yang perlu dihapus/dipensiunkan di file itu untuk ronde ini — sudah
//      beres duluan. Catatan lama di komentar file ini/vue-bahan-
//      aksesoris.js yang masih menyebut "3 kategori master_data dipakai
//      di panel Pengaturan" itu SENDIRI SUDAH BASI (ketinggalan update
//      dari §26.1) — dikoreksi di komentar ini.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel } from './vue-components.js?v=7';

// buatQrDataUrl — copy persis pola SAMA yang sudah dipakai di banyak file
// lain (vue-bahan-aksesoris.js, vue-stock-pembelian.js, dst) — konvensi
// proyek ini: fungsi bantu generate-QR kecil DISALIN per file, bukan
// diimpor lintas file (lihat catatan panjang di vue-bahan-aksesoris.js).
// `qrcodejs` (global `QRCode`) sudah dimuat sekali di index.html.
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

const TAMBAH_TAMPIL = 20; // "Muat N lagi", sama seperti wireframe

function formStateKosong() {
  return reactive({
    rak: '',
    baris_rak: '',
    kolom_rak: '',
    tinggi_rak: '',
    panjang_rak: '',
    lebar_rak: ''
  });
}

function formatAngka(n, digit = 2) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: digit });
}

// kodeRakBaru — gabung 3 segmen APA ADANYA (trim, segmen `rak` di-uppercase
// biar konsisten "E"/"A"/dst, baris & kolom TIDAK diubah casing-nya), TANPA
// pemisah — persis pola wireframe "E"+"1"+"1" = "E11".
function kodeRakBaru(rak, baris, kolom) {
  const r = (rak || '').trim().toUpperCase();
  const b = (baris || '').trim();
  const k = (kolom || '').trim();
  return r + b + k;
}

// kodeTampilRak — kode buat badge "kode" di tabel (gabungan rapat, mis.
// "E11"). Dokumen Rak lama (skema pra-7 Sep 2026) sudah dihapus semua dari
// Firestore (Guru konfirmasi 10 Sep 2026) — jadi tidak perlu lagi fallback
// baca skema lama di sini.
function kodeTampilRak(rakDoc) {
  return rakDoc ? (rakDoc.kode_rak || '') : '';
}

// segmenRakTampil — 3 kolom rak/baris/kolom di tabel.
function segmenRakTampil(rakDoc) {
  if (!rakDoc) return { rak: '', baris: '', kolom: '' };
  return {
    rak: rakDoc.rak || '',
    baris: rakDoc.baris_rak || '',
    kolom: rakDoc.kolom_rak || ''
  };
}

function pesanErrorMuat(e) {
  if (e && e.code === 'failed-precondition') {
    return 'Perlu index Firestore baru — buka Console browser (F12), cari link "Create composite index" dari error ini, klik untuk bikin index-nya sekali, lalu muat ulang halaman ini.';
  }
  if (e && e.code === 'permission-denied') {
    return 'Tidak punya izin membaca data Rak Penyimpanan. Hubungi Owner/Admin kalau ini tidak seharusnya terjadi.';
  }
  return 'Gagal memuat data Rak Penyimpanan. Coba lagi.';
}

const RakPenyimpananManager = {
  components: { PopupPratinjauCetakLabel },
  setup() {
    const memuat = ref(true);
    const errorMuat = ref('');
    const racks = ref([]);       // semua dokumen master_rak_penyimpanan
    const itemsDenganRak = ref([]); // item master_bahan_aksesoris yg rak_id-nya terisi

    const cari = ref('');
    const batasTampil = ref(TAMBAH_TAMPIL);

    // ------------------------------------------------------------------
    // Popup Tambah/Edit Rak
    // ------------------------------------------------------------------
    const popupTerbuka = ref(false);
    const form = formStateKosong();
    const menyimpan = ref(false);
    const sedangEditId = ref(null);

    const kodePreview = computed(() => kodeRakBaru(form.rak, form.baris_rak, form.kolom_rak));
    const volumeRakCm3 = computed(() => {
      const t = parseFloat(form.tinggi_rak) || 0;
      const p = parseFloat(form.panjang_rak) || 0;
      const l = parseFloat(form.lebar_rak) || 0;
      return t * p * l;
    });
    const volumeRakM3 = computed(() => volumeRakCm3.value / 1e6);

    function resetForm() {
      Object.assign(form, formStateKosong());
      sedangEditId.value = null;
    }
    function bukaTambah() { resetForm(); popupTerbuka.value = true; }
    function bukaEdit(rakDoc) {
      sedangEditId.value = rakDoc.id;
      const seg = segmenRakTampil(rakDoc);
      Object.assign(form, {
        rak: seg.rak, baris_rak: seg.baris, kolom_rak: seg.kolom,
        tinggi_rak: rakDoc.tinggi_rak || '', panjang_rak: rakDoc.panjang_rak || '', lebar_rak: rakDoc.lebar_rak || ''
      });
      popupTerbuka.value = true;
    }
    function tutupPopup() { popupTerbuka.value = false; resetForm(); }

    // ------------------------------------------------------------------
    // Cetak Label Rak (10 Sep 2026, permintaan Guru poin 4) — pakai sistem
    // cetak terpusat yang sama dengan modul lain (KATALOG_CETAK di
    // js/vue-pengaturan-cetak.js, jenis baru 'label_rak_penyimpanan';
    // PopupPratinjauCetakLabel di js/vue-components.js). Otomatis kebuka
    // sekali begitu Rak BARU (bukan edit) disimpan, dan bisa dipicu manual
    // lewat tombol printer per baris (item-centric grid & "Rak belum
    // terisi").
    // ------------------------------------------------------------------
    const popupCetakLabelAktif = ref(false);
    const daftarLabelPreview = ref([]);
    function cetakLabelRak(rakDoc) {
      if (!rakDoc) return;
      daftarLabelPreview.value = [{
        kode: rakDoc.kode_rak || '',
        nama: 'Rak ' + (rakDoc.kode_rak || ''),
        info: `Baris ${rakDoc.baris_rak || '-'} · Kolom ${rakDoc.kolom_rak || '-'}`,
        qrDataUrl: buatQrDataUrl(rakDoc.kode_rak || '')
      }];
      popupCetakLabelAktif.value = true;
    }
    function tutupPopupCetakLabel() { popupCetakLabelAktif.value = false; }

    async function muatSemua() {
      memuat.value = true;
      errorMuat.value = '';
      try {
        const [snapRak, snapItem] = await Promise.all([
          // Racks: koleksi kecil (realistis puluhan), aman fetch semua —
          // pola sama seperti ambilDaftarRak() di vue-bahan-aksesoris.js.
          getDocs(collection(db, 'master_rak_penyimpanan')),
          // Item: HANYA yang rak_id terisi (lihat catatan poin 6 di atas)
          // — hemat baca Firestore, hindari fetch foto base64 item yg
          // tidak relevan di layar ini.
          getDocs(query(collection(db, 'master_bahan_aksesoris'), where('rak_id', '>', '')))
        ]);
        racks.value = snapRak.docs.map(d => ({ id: d.id, ...d.data() }));
        itemsDenganRak.value = snapItem.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error('Gagal muat Rak Penyimpanan:', e);
        errorMuat.value = pesanErrorMuat(e);
      }
      memuat.value = false;
    }

    async function simpan() {
      const rakTrim = (form.rak || '').trim();
      const barisTrim = (form.baris_rak || '').trim();
      const kolomTrim = (form.kolom_rak || '').trim();
      if (!rakTrim) return alert('Isi Rak dulu (mis. huruf A/B/C).');
      if (!barisTrim) return alert('Isi Baris dulu.');
      if (!kolomTrim) return alert('Isi Kolom dulu.');
      if (!(parseFloat(form.tinggi_rak) > 0)) return alert('Isi Tinggi Rak dulu (harus lebih dari 0).');
      if (!(parseFloat(form.panjang_rak) > 0)) return alert('Isi Panjang Rak dulu (harus lebih dari 0).');
      if (!(parseFloat(form.lebar_rak) > 0)) return alert('Isi Lebar Rak dulu (harus lebih dari 0).');

      const kodeBaru = kodeRakBaru(form.rak, form.baris_rak, form.kolom_rak);
      const dobel = racks.value.some(r => r.id !== sedangEditId.value && kodeTampilRak(r) === kodeBaru);
      if (dobel) {
        return alert(`Kode Rak "${kodeBaru}" sudah terdaftar. Edit yang sudah ada kalau mau ubah dimensinya, atau pakai kombinasi rak/baris/kolom lain.`);
      }

      menyimpan.value = true;
      try {
        const data = {
          rak: rakTrim.toUpperCase(),
          baris_rak: barisTrim,
          kolom_rak: kolomTrim,
          kode_rak: kodeBaru,
          rak_label: kodeBaru, // alias — dibaca vue-bahan-aksesoris.js (dropdown "Pilih Rak")
          tinggi_rak: parseFloat(form.tinggi_rak) || 0,
          panjang_rak: parseFloat(form.panjang_rak) || 0,
          lebar_rak: parseFloat(form.lebar_rak) || 0,
          volume_rak: volumeRakCm3.value // cm³ — lihat catatan poin 4 di atas
        };
        const rakBaruDibuat = !sedangEditId.value;
        if (sedangEditId.value) {
          await updateDoc(doc(db, 'master_rak_penyimpanan', sedangEditId.value), {
            ...data, diedit_pada: serverTimestamp(), diedit_oleh: window.currentUser?.email || null
          });
          alert('Perubahan Rak tersimpan.');
        } else {
          await addDoc(collection(db, 'master_rak_penyimpanan'), {
            ...data, dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
          });
        }
        tutupPopup();
        await muatSemua();
        // Rak BARU (bukan edit) — langsung buka popup cetak label, sesuai
        // permintaan Guru: "saat tambah lalu simpan harus cetak label buat
        // rak". Edit TIDAK memicu ini (rak itu sudah pernah dicetak;
        // cetak ulang tetap bisa lewat tombol printer manual per baris).
        if (rakBaruDibuat) cetakLabelRak(data);
      } catch (e) {
        console.error('Gagal simpan Rak Penyimpanan:', e);
        alert('Gagal menyimpan data Rak. Coba lagi.');
      }
      menyimpan.value = false;
    }

    async function hapus(rakDoc) {
      const kode = kodeTampilRak(rakDoc);
      const jumlahDipakai = itemsDenganRak.value.filter(it => it.rak_id === rakDoc.id).length;
      let pesan = `Hapus Rak "${kode}" secara permanen?`;
      if (jumlahDipakai > 0) {
        pesan += `\n\n⚠️ PERINGATAN: ${jumlahDipakai} data Bahan/Aksesoris SAAT INI masih menunjuk ke Rak ini — kalau dihapus, field Rak di data itu TIDAK otomatis kosong (jadi menunjuk ke Rak yang sudah tidak ada, akan tampil sebagai "Rak tidak ditemukan"). Pertimbangkan pindahkan dulu data itu ke Rak lain (lewat Edit di Data Bahan & Aksesoris) sebelum menghapus.`;
      }
      if (!confirm(pesan)) return;
      try {
        await deleteDoc(doc(db, 'master_rak_penyimpanan', rakDoc.id));
        await muatSemua();
      } catch (e) {
        console.error('Gagal hapus Rak Penyimpanan:', e);
        alert('Gagal menghapus data Rak.');
      }
    }

    // ------------------------------------------------------------------
    // Baris tabel item-centric + kapasitas bar (lihat formula poin 5 di
    // catatan atas file).
    // ------------------------------------------------------------------
    const terpakaiPerRak = computed(() => {
      const peta = new Map(); // rak_id -> total terpakai (cm³)
      itemsDenganRak.value.forEach(it => {
        const cm3 = (parseFloat(it.stok_akhir) || 0) * (parseFloat(it.volume_barang) || 0);
        peta.set(it.rak_id, (peta.get(it.rak_id) || 0) + cm3);
      });
      return peta;
    });

    function baseBaris(it) {
      const rakDoc = racks.value.find(r => r.id === it.rak_id) || null;
      const rakHilang = !rakDoc;
      const volumeCm3 = rakDoc ? (parseFloat(rakDoc.volume_rak) || 0) : 0;
      const terpakaiCm3 = terpakaiPerRak.value.get(it.rak_id) || 0;
      const sisaCm3 = volumeCm3 - terpakaiCm3;
      const persen = volumeCm3 > 0 ? (terpakaiCm3 / volumeCm3 * 100) : (terpakaiCm3 > 0 ? 100 : 0);
      const seg = segmenRakTampil(rakDoc);
      return {
        item: it,
        rakDoc,
        rakHilang,
        kodeTampil: rakHilang ? '' : kodeTampilRak(rakDoc),
        segRak: seg.rak, segBaris: seg.baris, segKolom: seg.kolom,
        volumeM3: volumeCm3 / 1e6,
        terpakaiM3: terpakaiCm3 / 1e6,
        sisaM3: sisaCm3 / 1e6,
        persen: Math.round(persen),
        overKapasitas: !rakHilang && sisaCm3 < 0,
        levelWarna: persen >= 80 ? 'danger' : (persen >= 50 ? 'warn' : 'ok')
      };
    }

    const semuaBaris = computed(() => itemsDenganRak.value.map(baseBaris));

    const barisTerfilter = computed(() => {
      const q = cari.value.trim().toLowerCase();
      if (!q) return semuaBaris.value;
      return semuaBaris.value.filter(b =>
        (b.item.nama || '').toLowerCase().includes(q) ||
        (b.item.id_tampil || '').toLowerCase().includes(q) ||
        (b.kodeTampil || '').toLowerCase().includes(q)
      );
    });

    const barisTampil = computed(() => barisTerfilter.value.slice(0, batasTampil.value));
    const adaLebihBanyak = computed(() => barisTerfilter.value.length > batasTampil.value);
    function muatLebihBanyak() { batasTampil.value += TAMBAH_TAMPIL; }

    // Rak yang belum punya item sama sekali — tetap perlu bisa di-Edit/
    // Hapus walau tidak muncul di tabel item-centric utama (lihat catatan
    // "Rak belum terisi" di bawah template).
    const rakBelumTerisi = computed(() => {
      const dipakai = new Set(itemsDenganRak.value.map(it => it.rak_id));
      return racks.value.filter(r => !dipakai.has(r.id));
    });

    // Ringkasan footer (mengacu ke Rak yang MUNCUL di tabel terfilter,
    // pola sama seperti footer wireframe "5 rak · total volume ... m³ ·
    // rata-rata terpakai ...%").
    const ringkasan = computed(() => {
      const rakUnik = new Map();
      barisTerfilter.value.forEach(b => { if (b.rakDoc) rakUnik.set(b.rakDoc.id, b); });
      const daftar = Array.from(rakUnik.values());
      const totalVolume = daftar.reduce((s, b) => s + b.volumeM3, 0);
      const rataPersen = daftar.length ? Math.round(daftar.reduce((s, b) => s + b.persen, 0) / daftar.length) : 0;
      return { jumlahRak: daftar.length, totalVolume, rataPersen };
    });

    onMounted(async () => {
      await window.authReady;
      await muatSemua();
    });

    return {
      memuat, errorMuat, cari,
      popupTerbuka, form, menyimpan, sedangEditId, kodePreview, volumeRakCm3, volumeRakM3,
      bukaTambah, bukaEdit, tutupPopup, simpan, hapus,
      barisTampil, barisTerfilter, adaLebihBanyak, muatLebihBanyak,
      rakBelumTerisi, ringkasan, muatSemua,
      popupCetakLabelAktif, daftarLabelPreview, cetakLabelRak, tutupPopupCetakLabel,
      formatAngka
    };
  },
  template: `
    <div class="gc-card" style="margin-bottom:14px;">
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <h3 style="font-weight:700; font-size:13.5px; margin:0;"><i class="fas fa-warehouse" style="color:var(--burgundy); margin-right:8px;"></i>Rak Penyimpanan</h3>
        <button @click="bukaTambah" class="btn-primary" style="margin-left:auto; padding:8px 16px; font-size:12px;"><i class="fas fa-plus" style="margin-right:6px;"></i>Rak</button>
      </div>
      <div style="display:flex; align-items:center; gap:9px; background:var(--ivory-dim); border:1px solid var(--line); border-radius:999px; padding:9px 13px; margin-top:12px;">
        <i class="fas fa-magnifying-glass" style="font-size:14px; color:var(--text-faint);"></i>
        <input v-model="cari" type="text" placeholder="Cari kode rak / nama item..." style="flex:1; border:none; outline:none; background:none; font-size:12px;">
      </div>
    </div>

    <!-- state: loading -->
    <div v-if="memuat" class="gc-card" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Memuat data Rak Penyimpanan...</div>

    <!-- state: error -->
    <div v-else-if="errorMuat" class="gc-card" style="padding:20px;">
      <div style="display:flex; gap:10px; align-items:flex-start;">
        <i class="fas fa-triangle-exclamation" style="color:var(--danger); font-size:16px; margin-top:2px;"></i>
        <div style="flex:1;">
          <div style="font-weight:700; font-size:12.5px; color:var(--danger); margin-bottom:4px;">Gagal memuat data</div>
          <div style="font-size:11.5px; color:var(--text-muted);">{{ errorMuat }}</div>
          <button @click="muatSemua" class="btn-outline" style="margin-top:10px; padding:7px 14px; font-size:11.5px;"><i class="fas fa-rotate-right" style="margin-right:6px;"></i>Coba Lagi</button>
        </div>
      </div>
    </div>

    <!-- state: kosong -->
    <div v-else-if="barisTerfilter.length === 0 && rakBelumTerisi.length === 0" class="gc-kosong">
      <div class="lingkaran"><i class="fas fa-warehouse"></i></div>
      <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0 0 4px;">Belum ada Rak terdaftar</h3>
      <p style="font-size:11.5px; color:var(--text-faint); margin:0;">Tambah Rak dulu, lalu pilih Rak itu di form Data Bahan &amp; Aksesoris supaya muncul di sini.</p>
    </div>
    <div v-else-if="barisTerfilter.length === 0" class="gc-kosong">
      <div class="lingkaran"><i class="fas fa-warehouse"></i></div>
      <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0 0 4px;">Belum ada item yang menempati Rak</h3>
      <p style="font-size:11.5px; color:var(--text-faint); margin:0;">Sudah ada {{ rakBelumTerisi.length }} Rak terdaftar, tapi belum ada item Bahan/Aksesoris yang memilih Rak itu — atur lewat "Pilih Rak" di form Data Bahan &amp; Aksesoris.</p>
    </div>

    <!-- state: ideal/populated + ekstrem (per-baris) -->
    <!-- GANTI (9 Sep 2026, audit wireframe §6.1 "grid modern") — dulu
         <table class="gc-table"> literal, SEKARANG grid kartu rounded per
         item dengan bar kapasitas berwarna (hijau/kuning/merah). Data yang
         ditampilkan & formula persen/warna (baseBaris(), levelWarna,
         overKapasitas, dst di atas) TIDAK diubah sama sekali — cuma
         pembungkus tampilannya. -->
    <template v-else>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:12px;">
        <div v-for="b in barisTampil" :key="b.item.id" class="gc-card" style="padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">
            <div style="min-width:0;">
              <div style="font-weight:700; font-size:12.5px; overflow-wrap:anywhere;">{{ b.item.nama }}<span v-if="b.item.warna"> · {{ b.item.warna }}</span></div>
              <div style="font-size:10.5px; color:var(--text-faint);">{{ b.item.id_tampil || '-' }} · {{ b.item.kategori_utama || '-' }}</div>
            </div>
            <span v-if="!b.rakHilang" class="tag" :class="b.levelWarna" style="font-weight:700; white-space:nowrap;">{{ b.kodeTampil }}</span>
          </div>

          <template v-if="b.rakHilang">
            <span class="tag danger" style="display:block; margin-top:6px;"><i class="fas fa-triangle-exclamation" style="margin-right:5px;"></i>Rak tidak ditemukan (sudah dihapus) — ubah Rak item ini di Data Bahan &amp; Aksesoris.</span>
          </template>
          <template v-else>
            <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:10px;">Rak {{ b.segRak }} · Baris {{ b.segBaris }} · Kolom {{ b.segKolom }}</div>

            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <div style="flex:1; height:8px; border-radius:999px; background:var(--ivory-dim); overflow:hidden;">
                <div :style="{ height:'100%', width: Math.min(100, b.persen) + '%', background: 'var(--' + b.levelWarna + ')' }"></div>
              </div>
              <span style="font-size:11.5px; font-weight:700; min-width:34px; text-align:right;">{{ b.persen }}%</span>
            </div>
            <div v-if="b.overKapasitas" style="font-size:9.5px; color:var(--danger); margin-bottom:6px;"><i class="fas fa-circle-exclamation" style="margin-right:3px;"></i>Melebihi kapasitas Rak</div>

            <div style="display:flex; flex-wrap:wrap; gap:4px 12px; font-size:10.5px; color:var(--text-faint); margin:8px 0 10px;">
              <span>Terpakai <b style="color:var(--text-muted);">{{ formatAngka(b.terpakaiM3) }} m&sup3;</b></span>
              <span :style="{ color: b.overKapasitas ? 'var(--danger)' : null }">Sisa <b>{{ formatAngka(b.sisaM3) }} m&sup3;</b></span>
              <span>Volume <b style="color:var(--text-muted);">{{ formatAngka(b.volumeM3) }} m&sup3;</b></span>
            </div>

            <div style="display:flex; gap:6px; justify-content:flex-end; border-top:1px solid var(--line); padding-top:8px;">
              <button @click="cetakLabelRak(b.rakDoc)" class="icon-btn" title="Cetak Label Rak"><i class="fas fa-print"></i></button>
              <button @click="bukaEdit(b.rakDoc)" class="icon-btn" title="Edit Rak"><i class="fas fa-pen"></i></button>
              <button @click="hapus(b.rakDoc)" class="icon-btn" style="color:var(--danger);" title="Hapus Rak"><i class="fas fa-trash-alt"></i></button>
            </div>
          </template>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:12px;">
        <span style="font-size:10.5px; color:var(--text-faint);">{{ ringkasan.jumlahRak }} rak · total volume {{ formatAngka(ringkasan.totalVolume) }} m&sup3; · rata-rata terpakai {{ ringkasan.rataPersen }}%<span v-if="rakBelumTerisi.length"> · {{ rakBelumTerisi.length }} rak belum terisi item</span></span>
        <button v-if="adaLebihBanyak" @click="muatLebihBanyak" class="btn-outline" style="margin-left:auto; padding:6px 14px; font-size:11px; border-radius:999px;">Muat 20 lagi</button>
      </div>
    </template>

    <!-- Rak yang belum ditempati item apapun — tetap perlu bisa dikelola
         (Edit/Hapus) walau tidak tampil di tabel item-centric di atas
         (tabel di atas HANYA menampilkan Rak yang sudah dipilih minimal 1
         item, sesuai spek "1 baris per item" — bukan celah, ini memang
         penambahan sengaja supaya Admin tetap bisa membetulkan dimensi
         Rak yang salah ketik SEBELUM ada item yang memakainya). -->
    <div v-if="!memuat && !errorMuat && rakBelumTerisi.length > 0" class="gc-card" style="margin-top:14px;">
      <h4 style="font-weight:700; font-size:12px; margin:0 0 10px; color:var(--text-muted);"><i class="fas fa-inbox" style="margin-right:6px;"></i>Rak belum terisi item ({{ rakBelumTerisi.length }})</h4>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div v-for="r in rakBelumTerisi" :key="r.id" style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px; background:var(--ivory-dim);">
          <span class="tag ok" style="font-weight:700;">{{ r.kode_rak }}</span>
          <span style="font-size:11px; color:var(--text-faint); flex:1;">{{ formatAngka(r.volume_rak / 1e6) }} m&sup3; kapasitas</span>
          <button @click="cetakLabelRak(r)" class="icon-btn" title="Cetak Label Rak"><i class="fas fa-print"></i></button>
          <button @click="bukaEdit(r)" class="icon-btn" title="Edit Rak"><i class="fas fa-pen"></i></button>
          <button @click="hapus(r)" class="icon-btn" style="color:var(--danger);" title="Hapus Rak"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>
    </div>

    <!-- Popup Tambah/Edit Rak -->
    <div v-if="popupTerbuka" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;" @click.self="tutupPopup">
      <div class="gc-card" style="max-width:420px; width:100%; max-height:90vh; overflow-y:auto;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
          <h3 style="font-weight:700; font-size:15px; margin:0;">{{ sedangEditId ? 'Edit Rak' : 'Tambah Rak' }}</h3>
          <span @click="tutupPopup" style="margin-left:auto; font-size:11px; color:var(--burgundy); cursor:pointer;">tutup &times;</span>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:10px;">
          <div class="gc-field" style="margin-bottom:0;"><label>Rak</label><input v-model="form.rak" type="text" maxlength="6" placeholder="Mis. E"></div>
          <div class="gc-field" style="margin-bottom:0;"><label>Baris</label><input v-model="form.baris_rak" type="text" inputmode="numeric" maxlength="6" placeholder="Mis. 1"></div>
          <div class="gc-field" style="margin-bottom:0;"><label>Kolom</label><input v-model="form.kolom_rak" type="text" inputmode="numeric" maxlength="6" placeholder="Mis. 1"></div>
        </div>
        <div style="background:var(--ivory-dim); border-radius:10px; padding:10px 12px; margin-bottom:14px;">
          <span style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Kode rak otomatis</span>
          <div style="font-size:18px; font-weight:700; color:var(--burgundy); margin-top:2px;">{{ kodePreview || '—' }}</div>
          <div style="font-size:9.5px; color:var(--text-faint); margin-top:2px;">rak + baris + kolom · wajib unik</div>
        </div>

        <div style="height:1px; background:var(--line); margin-bottom:14px;"></div>

        <p style="font-size:11px; font-weight:700; color:var(--text-muted); margin:0 0 8px;"><i class="fas fa-cube" style="margin-right:6px;"></i>Dimensi Rak (untuk estimasi kapasitas)</p>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:10px;">
          <div class="gc-field" style="margin-bottom:0;"><label>Tinggi (cm)</label><input v-model.number="form.tinggi_rak" type="number" min="0" placeholder="0"></div>
          <div class="gc-field" style="margin-bottom:0;"><label>Panjang (cm)</label><input v-model.number="form.panjang_rak" type="number" min="0" placeholder="0"></div>
          <div class="gc-field" style="margin-bottom:0;"><label>Lebar (cm)</label><input v-model.number="form.lebar_rak" type="number" min="0" placeholder="0"></div>
        </div>
        <div style="background:var(--ivory-dim); border-radius:10px; padding:10px 12px; margin-bottom:16px;">
          <span style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Volume rak otomatis</span>
          <div style="font-size:18px; font-weight:700; color:var(--burgundy); margin-top:2px;">{{ formatAngka(volumeRakM3) }} m&sup3;</div>
          <div style="font-size:9.5px; color:var(--text-faint); margin-top:2px;">{{ formatAngka(form.tinggi_rak||0,0) }} &times; {{ formatAngka(form.panjang_rak||0,0) }} &times; {{ formatAngka(form.lebar_rak||0,0) }} cm ({{ formatAngka(volumeRakCm3,0) }} cm&sup3;)</div>
        </div>

        <div style="display:flex; gap:8px;">
          <button @click="tutupPopup" class="btn-outline" style="flex:1; padding:11px;">Batal</button>
          <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="flex:1.4; padding:11px;"><i class="fas fa-floppy-disk" style="margin-right:6px;"></i>{{ menyimpan ? 'Menyimpan...' : 'Simpan' }}</button>
        </div>
      </div>
    </div>

    <!-- Popup Cetak Label Rak — otomatis kebuka setelah Tambah Rak baru,
         atau dipicu manual lewat tombol printer per baris. -->
    <popup-pratinjau-cetak-label
      :terbuka="popupCetakLabelAktif"
      judul="Cetak Label Rak"
      :daftar-label="daftarLabelPreview"
      jenis-cetak="label_rak_penyimpanan"
      @tutup="tutupPopupCetakLabel"
    />
  `
};

const AppRakPenyimpanan = { components: { RakPenyimpananManager }, template: `<rak-penyimpanan-manager />` };
let vmRakPenyimpanan = null;
window.pastikanMountRakPenyimpanan = function() {
  if (vmRakPenyimpanan) return;
  const mountPoint = document.getElementById('vue-rak-penyimpanan');
  if (mountPoint) vmRakPenyimpanan = createApp(AppRakPenyimpanan).mount('#vue-rak-penyimpanan');
};
