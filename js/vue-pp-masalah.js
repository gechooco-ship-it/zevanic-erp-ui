// js/vue-pp-masalah.js
// ============================================================================
// Persiapan Produksi > Masalah — menu BARU (7 Sep 2026, §5.18, wireframe
// handoff "Persiapan Produksi - Masalah", langkah 6 rencana rekonstruksi).
// REBUILD TOTAL dari fitur "Persiapan Masalah" versi lama (papan manual
// bebas-teks, sekarang js/vue-persiapan-masalah.js, koleksi datanya SUDAH
// DIPINDAH ke `permintaan_bahan_manual` — lihat komentar di file itu) jadi
// alur 7 tahap yang menangani KEKURANGAN bahan/aksesoris yang terdeteksi
// OTOMATIS lewat "Scan Masalah" di pos lain (Bahan/Acc Sewing/Acc Webbing/
// Acc Finishing) — TIDAK ADA form input manual di modul ini.
//
// ARSITEKTUR DATA:
// Koleksi `persiapan_masalah` — nama SAMA seperti skema lama, tapi SKEMA
// BARU total (keputusan Hilman: "satu koleksi, yang lama hapus total, data
// aman karena belum ada data juga"). 1 DOKUMEN = 1 baris kekurangan (BUKAN
// array rincian bersarang seperti spk_track — lebih simpel, tulis langsung
// updateDoc/runTransaction 1 dokumen). Field (SPESIFIKASI-KOLEKSI-BARU.md
// + field umum yang dibutuhkan alur 7 tahap):
//   tlc_asal, sumber_jalur ('bahan'|'sewing'|'webbing'|'finishing'),
//   spk_track_id, baris_index — FK balik ke baris asal yang kekurangan.
//   bahan_aksesoris_id, bahan_nama, bahan_warna, satuan, no_spk (snapshot),
//   qty_kurang, qty_entry_asal (opsional — berapa yang SEMPAT ke-entry di
//   pos asal sebelum kekurangan, kolom "entry" di 6.1/6.2, bisa kosong),
//   alasan_masalah, scan_oleh, scan_pada.
//   status: perlu_diajukan -> menunggu_setuju -> (perlu_disiapkan ->
//     sedang_disiapkan -> perlu_dikirim -> sedang_dikirim -> selesai)
//     ATAU diajukan_belanja (keluar ke Persiapan Belanja, group 8, belum
//     dibangun) ATAU balik ke perlu_diajukan (ditolak).
//   diajukan_oleh/pada (6.1->6.2), qty_beli (kelipatan MOQ, bisa diedit),
//   qty_disetujui, disetujui_oleh/pada, ditolak_oleh/pada, catatan_tolak,
//   diajukan_belanja_oleh/pada, kode_msl, label_cetak_pada, operator_uid,
//   operator_nama, ditugaskan_pada, riwayat_operator[], masuk_tahap_pada,
//   catatan_masalah, entry_qty, entry_oleh, entry_pada, kode_bagging,
//   kode_tugas, tlc_tujuan, sampai_pada (DITULIS MODUL LAIN, lihat TAB 7).
//
// SUMBER "Scan Masalah" (retrofit ke 4 pos Persiapan Produksi yang mengisi
// koleksi ini): SEMPAT sengaja ditunda sesi §5.18 ("Modul Masalah dulu,
// retrofit menyusul"), SEKARANG SUDAH DIKERJAKAN (7 Sep 2026, lanjutan,
// §5.19) — `ajukanPersiapanMasalah()` di js/vue-scan-cetak.js dipanggil
// dari Scan Masalah di 4 pos (vue-persiapan-{bahan,sewing,webbing,
// finishing}.js Tab 2 "Sedang Disiapkan"), popup kecil minta jumlah kurang
// + alasan lalu membuat 1 dokumen BARU di sini (status 'perlu_diajukan').
// Modul ini SEKARANG benar-benar bisa terisi data begitu ada Scan Masalah
// sungguhan — TAPI masih 0 data SAMPAI ada pengujian browser/scan nyata
// (BELUM ditest sama sekali, sama seperti sisi Masalah-nya sendiri).
//
// KEPUTUSAN/ASUMSI yang TIDAK eksplisit tertulis di SERAH-TERIMA/wireframe
// (dicatat di sini biar Hilman bisa koreksi kalau salah tafsir — bukan
// ditebak diam-diam, PEDOMAN §"Yang Belum Diputuskan" menandai 2 poin ini
// terbuka):
//   1. "Ajukan" di 6.1: wireframe menyebut tahap ini "papan info" TAPI
//      namanya "Perlu Diajukan" (butuh aksi submit) dan §7 menyinggung
//      "batas waktu sebelum auto-eskalasi" (belum diputuskan) — TIDAK ada
//      infrastruktur auto-eskalasi terjadwal di app ini (no Cloud
//      Functions/cron), jadi diimplementasikan sebagai tombol manual
//      "Ajukan" PER KARTU BAHAN (kumulatif) yang memindahkan SEMUA baris di
//      kartu itu ke Menunggu Setuju sekaligus. Auto-eskalasi TIDAK dibangun.
//   2. 3 tombol keputusan di 6.2 (bukan cuma 2 seperti "swipe kiri/kanan"
//      di teks §2 — itu utk mobile Setuju/Tolak; "Ajukan Belanja" adalah
//      aksi ke-3 terpisah, sesuai tabel Fungsi §3 yang eksplisit memisahkan
//      "Setujui -> masuk Perlu Disiapkan" dari "Ajukan belanja -> masuk
//      Persiapan Belanja (group 8)" sebagai 2 baris berbeda): Setujui =
//      dipenuhi dari stok yang sudah ada (lanjut ke 6.3, alur internal,
//      SAMA seperti pos Bahan). Ajukan Belanja = perlu beli ke suplayer,
//      KELUAR dari modul ini menuju Persiapan Belanja (group 8, belum
//      dibangun — status 'diajukan_belanja' disiapkan sebagai pintu
//      keluar/masuknya nanti). Tolak = balik ke Perlu Diajukan.
//   3. Kolom "estimasi" & "sisa jadi stok" (6.2) ditafsirkan murni dari
//      SISI QTY (bukan biaya — tidak ada field "harga terakhir" yang
//      terverifikasi ada di master_bahan_aksesoris/alias_pembelian):
//      estimasi = stok saat ini + qty beli; sisa jadi stok = estimasi -
//      kurang (surplus yang jadi stok bebas, PEDOMAN aturan #12).
//   4. "pakai/minggu" (keputusan Hilman: dihitung LIVE dari riwayat, BUKAN
//      field tersimpan) — dihitung dari rata-rata entry_qty di
//      spk_track.<jalur>_rincian[] milik bahan yang sama dalam jendela
//      MINGGU_JENDELA_PAKAI minggu terakhir (konstanta di bawah, gampang
//      diubah, BELUM ada keputusan Hilman soal lebar jendela persisnya).
//   5. Scan Masalah di 6.3/6.4 (pos ini SENDIRI ikut mengalami kekurangan
//      lagi) HANYA mencatat catatan_masalah di baris yang sama (MIRROR
//      persis pola pos Bahan — TIDAK bikin dokumen persiapan_masalah baru/
//      rekursif; SERAH-TERIMA §3 tabel Fungsi modul ini sendiri tidak
//      menyebutkan aksi ini sama sekali, jadi disamakan dengan pos lain
//      biar konsisten, bukan dihilangkan — PEDOMAN #4c mewajibkan tahap
//      "Sedang" yang punya scan masalah, tahap "Perlu" di atasnya ikut).
//
// Cetak label & scan QR: pakai infrastruktur generik yang SAMA seperti 4
// pos lain (ScanGenerik, PopupPratinjauCetakLabel, buatQrDataUrl,
// generateKodeHarian, bagging/tugas_kirim/master_tlc) — TIDAK ada yang baru
// dari sisi cetak/scan, cuma koleksi datanya beda.
// ============================================================================
import { createApp, ref, reactive, computed, watch, onMounted, onUnmounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, addDoc, doc, getDoc, updateDoc, getDocs, query, where, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { PopupPratinjauCetakLabel } from './vue-components.js?v=6';
import { ScanGenerik, buatQrDataUrl, muatJsQr, cariKaryawanByQr, tierOwnerKeAtas } from './vue-scan-cetak.js?v=2';

// picOwnerKeAtas — REVISI 8 Sep 2026 (keputusan Guru, audit kode). BEDA
// dari `tierOwnerKeAtas` (diimpor di atas, dipakai Setuju/Tolak/Ajukan
// Belanja — WAJIB Owner/PIC Owner spesifik): ini untuk aksi "Tunjuk
// Operator" yang cukup PIC ke atas (pic biasa ikut, bukan cuma PIC
// Owner) — TANPA popup PIN. Pola SAMA dengan picOwnerKeAtas() di
// vue-pp-cutting.js/vue-pp-sewing.js/vue-pp-finishing.js/vue-pp-serie.js.
function picOwnerKeAtas(userData) {
  if (!userData) return false;
  const role = (userData.role || '').toLowerCase();
  return role === 'owner' || role === 'superuser' || role === 'pic';
}

// --- Format & hitung kecil (SAMA pola dengan vue-persiapan-bahan.js) --------
function formatQty(n) {
  const angka = parseFloat(n) || 0;
  return angka.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}
const AMBANG_TERTAHAN_JAM = 6; // sama semua tab/pos Persiapan Produksi
function jamSejak(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return ms / 3600000;
}
function tertahan(iso) {
  const j = jamSejak(iso);
  return j !== null && j > AMBANG_TERTAHAN_JAM;
}
function formatDiamSejak(iso) {
  const j = jamSejak(iso);
  if (j === null) return '-';
  if (j < 1) return Math.max(1, Math.round(j * 60)) + ' menit';
  return j.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jam';
}
function formatWaktu(iso) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return '-'; }
}
function hariIniSama(iso) {
  if (!iso) return false;
  const d = new Date(iso), now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
// siklusJam versi Masalah — "umur" dari SAAT MASALAH DISCAN (scan_pada) sampai
// SCAN SAMPAI di pos asal (sampai_pada), BEDA dari pos Bahan (label_cetak_pada
// -> sampai_pada) karena yang mau diukur di sini termasuk waktu Owner
// memutuskan (6.2), bukan cuma waktu proses internal pos ini.
function siklusJam(b) {
  if (!b.scan_pada || !b.sampai_pada) return null;
  return (new Date(b.sampai_pada).getTime() - new Date(b.scan_pada).getTime()) / 3600000;
}
function formatSiklus(jam) {
  if (jam === null || jam === undefined || isNaN(jam)) return '-';
  if (jam < 1) return Math.max(1, Math.round(jam * 60)) + ' menit';
  return jam.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jam';
}

// --- Kode harian berurut (label pos ini) — SAMA pola bagging/tugas_kirim ---
async function generateKodeHarian(prefix, koleksiCounter) {
  const now = new Date();
  const tanggalKey = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const refDoc = doc(db, koleksiCounter, tanggalKey);
  return await runTransaction(db, async (trx) => {
    const snap = await trx.get(refDoc);
    const counterBaru = (snap.exists() ? (snap.data().counter || 0) : 0) + 1;
    if (snap.exists()) trx.update(refDoc, { counter: counterBaru });
    else trx.set(refDoc, { counter: counterBaru, dibuat_pada: tanggalKey });
    return `${prefix}${tanggalKey}-${String(counterBaru).padStart(3, '0')}`;
  });
}

// --- Baca persiapan_masalah per status --------------------------------------
async function muatMasalahStatus(status) {
  const snap = await getDocs(query(collection(db, 'persiapan_masalah'), where('status', '==', status)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function patchMasalah(id, patch) {
  await updateDoc(doc(db, 'persiapan_masalah', id), { ...patch, diperbarui_pada: serverTimestamp() });
}

// kelompokKumulatifPerBahan — SEDERHANA dibanding kelompokKartuBahan pos
// Bahan: TIDAK ada cek stok/alokasi greedy (itu baru relevan di 6.2 lewat
// qty beli, bukan di sini) — cuma jumlah "butuh" (qty_kurang) per bahan,
// dihitung ULANG dari sumbernya tiap kali dipanggil (PEDOMAN acceptance #3).
function kelompokKumulatifPerBahan(list) {
  const peta = {};
  list.forEach(d => {
    const key = d.bahan_aksesoris_id;
    if (!key) return;
    if (!peta[key]) peta[key] = { bahanAksesorisId: key, nama: d.bahan_nama, warna: d.bahan_warna, satuan: d.satuan, butuh: 0, jumlah: 0, docs: [] };
    peta[key].butuh += (parseFloat(d.qty_kurang) || 0);
    peta[key].jumlah += 1;
    peta[key].docs.push(d);
  });
  return Object.values(peta).sort((a, b) => b.butuh - a.butuh);
}

// --- MOQ (alias_pembelian) & pakai/minggu (live, spk_track) -----------------
async function ambilMoqUntukBahan(bahanId) {
  try {
    const snap = await getDocs(query(collection(db, 'alias_pembelian'), where('bahan_aksesoris_id', '==', bahanId)));
    if (snap.empty) return { moq: 0, moqSatuan: '' };
    let dipilih = null;
    snap.forEach(d => { const v = d.data(); if (!dipilih || v.is_default_order) dipilih = v; });
    return { moq: parseFloat(dipilih?.moq) || 0, moqSatuan: dipilih?.moq_satuan || '' };
  } catch (e) { console.error('Gagal ambil MOQ:', e); return { moq: 0, moqSatuan: '' }; }
}
const JALUR_RINCIAN_FIELD = { bahan: 'bahan_rincian', sewing: 'sewing_rincian', webbing: 'webbing_rincian', finishing: 'finishing_rincian' };
const JALUR_TLC = { bahan: 'TLC-BHN', sewing: 'TLC-SEW', webbing: 'TLC-WEB', finishing: 'TLC-FIN' };
const MINGGU_JENDELA_PAKAI = 8; // asumsi jendela hitung live, lihat catatan §keputusan 4 di atas
async function hitungPakaiPerMinggu(bahanId, jalur) {
  const field = JALUR_RINCIAN_FIELD[jalur];
  if (!field || !bahanId) return null;
  try {
    const snap = await getDocs(query(collection(db, 'spk_track'), where('jalur', '==', jalur)));
    const batasWaktu = Date.now() - MINGGU_JENDELA_PAKAI * 7 * 86400000;
    let total = 0;
    snap.forEach(docSnap => {
      const arr = docSnap.data()[field] || [];
      arr.forEach(b => {
        if (b.bahan_aksesoris_id === bahanId && b.entry_pada && new Date(b.entry_pada).getTime() >= batasWaktu) {
          total += parseFloat(b.entry_qty) || 0;
        }
      });
    });
    return total / MINGGU_JENDELA_PAKAI;
  } catch (e) { console.error('Gagal hitung pakai/minggu:', e); return null; }
}
function hitungQtyBeliDefault(kurang, moq) {
  const k = parseFloat(kurang) || 0;
  return moq > 0 ? Math.ceil(k / moq) * moq : k;
}

// konfirmasiEntryMasalah — SATU-SATUNYA tempat stok master_bahan_aksesoris
// berkurang di pos ini (SAMA aturan seperti semua pos Persiapan Produksi:
// stok berkurang tepat saat scan entry). qty yang dikurangi = qty_disetujui
// (dikunci Owner di 6.2) kalau ada, fallback ke qty_kurang.
async function konfirmasiEntryMasalah(item) {
  const refMasalah = doc(db, 'persiapan_masalah', item.id);
  const refBahan = doc(db, 'master_bahan_aksesoris', item.bahan_aksesoris_id);
  const now = new Date().toISOString();
  const oleh = window.currentUser?.email || '';
  const qty = parseFloat(item.qty_disetujui) || parseFloat(item.qty_kurang) || 0;
  await runTransaction(db, async (trx) => {
    const [snapMasalah, snapBahan] = await Promise.all([trx.get(refMasalah), trx.get(refBahan)]);
    if (!snapMasalah.exists()) throw new Error('Data masalah tidak ditemukan (mungkin sudah dihapus).');
    trx.update(refMasalah, {
      status: 'perlu_dikirim', masuk_tahap_pada: now,
      entry_qty: qty, entry_oleh: oleh, entry_pada: now,
      diperbarui_pada: serverTimestamp()
    });
    if (snapBahan.exists()) {
      const stokBaru = (parseFloat(snapBahan.data().stok_akhir) || 0) - qty;
      trx.update(refBahan, { stok_akhir: stokBaru });
    }
  });
}

// ============================================================================
// TAB 1: Perlu Diajukan — REVISI 9 Sep 2026 (audit wireframe.dc.html "06 -
// Masalah" §6.1 vs kode live, keputusan Guru). Wireframe: SATU TABEL datar
// (urut TERTUA di atas — scan_pada ascending) dengan CHECKBOX MULTI-SELECT
// LINTAS-BAHAN, SATU tombol "Ajukan belanja" di header (bukan per-kartu), dan
// panel "Kumulatif per bahan" TERPISAH di bawah tabel (bukan kotak kecil di
// kepala tiap kartu accordion). Kolom tabel PERSIS wireframe: kode grouping
// child (no_spk), tgl scan, tertahan, TLC asal, scan oleh, alasan masalah,
// butuh, entry, kurang.
//   butuh  = qty_kurang + qty_entry_asal (total kebutuhan sebelum kekurangan)
//   entry  = qty_entry_asal (yang sempat ke-entry di pos asal)
//   kurang = qty_kurang (field utama yang sudah ada, TIDAK diubah artinya)
//
// FUNGSI "AJUKAN" TETAP SAMA PERSIS (HATI-HATI — modul uang/pembelian):
// tetap patchMasalah(d.id, { status:'menunggu_setuju', diajukan_oleh, ... })
// untuk tiap baris terpilih — cuma dipicu dari SATU tombol massal (bisa
// lintas-bahan sekaligus), bukan per-kartu-per-bahan seperti sebelumnya.
// TAMBAHAN field baru (aman, tidak mengubah hitungan uang/stok apa pun):
//   kode_pengajuan — SATU kode baru (prefix PGJ, counter HARIAN sendiri)
//     dibuat SEKALI per klik tombol "Ajukan belanja", ditulis ke SEMUA baris
//     yang diajukan bersamaan (lintas bahan sekalipun) — dipakai TAB 2 untuk
//     mengelompokkan jadi "1 kartu = 1 pengajuan" sesuai wireframe §6.2.
//     Field BARU (belum ada di dokumen lama manapun — modul ini 0 data
//     produksi per komentar besar file ini), jadi TIDAK ada risiko salah
//     kelompok data lama (PEDOMAN design-terapkan-handoff: field pengikat
//     baru boleh ditambah untuk alur MAJU, bukan dipaksakan ke data lama).
//   catatan_ajuan — teks opsional (wireframe: "catatan (boleh kosong)" di
//     pop up Ajukan belanja). TIDAK dipakai perhitungan apa pun.
// "butuh dipakai" (tanggal kebutuhan) di pop up wireframe SENGAJA TIDAK
// dibangun — tidak ada field tanggal semacam itu di skema persiapan_masalah
// atau spk_track yang terverifikasi, menebak field baru untuk itu berisiko
// salah asumsi alur produksi (bukan ranah modul uang, tapi tetap gap yang
// dilaporkan, bukan ditebak).
// ============================================================================
function butuhAwal(d) { return (parseFloat(d.qty_kurang) || 0) + (parseFloat(d.qty_entry_asal) || 0); }

const MasalahPerluDiajukan = {
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const cari = ref('');
    const terpilih = reactive({}); // docId -> boolean
    const sedangProses = ref(false);
    const menuId = 'pp_masalah';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try { daftar.value = await muatMasalahStatus('perlu_diajukan'); }
      catch (e) { console.error('Gagal muat Masalah > Perlu Diajukan:', e); daftar.value = []; }
      memuat.value = false;
    }

    // Urut TERTUA di atas (scan_pada ascending) — sesuai wireframe §6.1.
    const daftarTersaring = computed(() => {
      const kata = cari.value.trim().toLowerCase();
      let list = daftar.value;
      if (kata) list = list.filter(d => (d.bahan_nama + ' ' + (d.bahan_warna || '')).toLowerCase().includes(kata) || (d.no_spk || '').toLowerCase().includes(kata) || (d.tlc_asal || '').toLowerCase().includes(kata));
      return [...list].sort((a, b) => new Date(a.scan_pada || 0) - new Date(b.scan_pada || 0));
    });

    // Panel "Kumulatif per bahan" — SEMUA baris yang tampil (tidak tergantung
    // centang), persis fungsi lama, cuma dipindah ke bawah tabel (bukan lagi
    // kotak kecil di kepala kartu accordion).
    const kumulatifSemua = computed(() => kelompokKumulatifPerBahan(daftarTersaring.value));

    function toggleSatu(d) { terpilih[d.id] = !terpilih[d.id]; }
    const jumlahTerpilih = computed(() => daftarTersaring.value.filter(d => terpilih[d.id]).length);
    const semuaTerpilih = computed(() => daftarTersaring.value.length > 0 && daftarTersaring.value.every(d => terpilih[d.id]));
    function toggleSemua() {
      const nilai = !semuaTerpilih.value;
      daftarTersaring.value.forEach(d => { terpilih[d.id] = nilai; });
    }

    // --- Pop up Ajukan Belanja (multi-select, bisa lintas bahan) ------------
    const popupAjukan = ref(null); // { catatan }
    const dokTerpilih = computed(() => daftarTersaring.value.filter(d => terpilih[d.id]));
    const kumulatifTerpilih = computed(() => kelompokKumulatifPerBahan(dokTerpilih.value));
    function bukaPopupAjukan() {
      if (!bolehProses.value) return;
      if (!dokTerpilih.value.length) { alert('Centang minimal satu baris kekurangan dulu.'); return; }
      popupAjukan.value = { catatan: '' };
    }
    async function konfirmasiAjukan() {
      const terpilihDoc = dokTerpilih.value;
      if (!terpilihDoc.length) { popupAjukan.value = null; return; }
      sedangProses.value = true;
      const now = new Date().toISOString();
      const oleh = window.currentUser?.email || '';
      const catatan = (popupAjukan.value?.catatan || '').trim();
      try {
        // SATU kode_pengajuan dipakai bersama seluruh baris yang diajukan
        // dalam klik ini (lihat catatan besar §TAB 1 di atas).
        const kodePengajuan = await generateKodeHarian('PGJ', 'pengaturan_id_persiapan_masalah_pengajuan');
        await Promise.all(terpilihDoc.map(d => patchMasalah(d.id, {
          status: 'menunggu_setuju', diajukan_oleh: oleh, diajukan_pada: now,
          kode_pengajuan: kodePengajuan, catatan_ajuan: catatan
        })));
        popupAjukan.value = null;
        Object.keys(terpilih).forEach(k => delete terpilih[k]);
        await muat();
      } catch (e) { console.error('Gagal ajukan:', e); alert('Gagal mengajukan. Coba lagi.'); }
      sedangProses.value = false;
    }

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, daftarTersaring, cari, kumulatifSemua, terpilih, toggleSatu, toggleSemua,
      jumlahTerpilih, semuaTerpilih, sedangProses, bolehProses,
      popupAjukan, bukaPopupAjukan, konfirmasiAjukan, kumulatifTerpilih,
      formatQty, formatWaktu, formatDiamSejak, tertahan, butuhAwal
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <template v-else>
      <div style="display:flex; gap:9px; flex-wrap:wrap; align-items:center; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:9px; background:var(--surface); border:1px solid var(--line); border-radius:999px; padding:9px 13px; flex:1; min-width:200px;">
          <i class="fas fa-magnifying-glass" style="font-size:15px; color:var(--text-faint); flex-shrink:0;"></i>
          <input v-model="cari" type="text" placeholder="Cari bahan, warna, TLC asal, atau no. SPK..." style="flex:1; min-width:0; border:none; outline:none; background:none; font-size:12px; color:var(--text);">
        </div>
        <button v-if="bolehProses" @click="bukaPopupAjukan" :disabled="!jumlahTerpilih" class="btn-primary" style="padding:9px 16px; white-space:nowrap;"><i class="fas fa-paper-plane" style="margin-right:6px;"></i>Ajukan belanja &middot; {{ jumlahTerpilih }} terpilih</button>
      </div>

      <div v-if="daftarTersaring.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-triangle-exclamation"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0 0 4px;">Tidak ada kekurangan yang perlu diajukan</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0;">Baris muncul otomatis dari Scan Masalah di pos Bahan/Acc Sewing/Webbing/Finishing.</p>
      </div>

      <template v-else>
        <div class="gc-table-scroll" style="margin-bottom:14px;">
          <table style="width:100%; border-collapse:collapse; font-size:11px;">
            <thead>
              <tr style="text-align:left; color:var(--text-faint); border-bottom:1px solid var(--line);">
                <th style="padding:6px 8px;"><input type="checkbox" :checked="semuaTerpilih" @change="toggleSemua" v-if="bolehProses"></th>
                <th style="padding:6px 8px;">Kode grouping child</th>
                <th style="padding:6px 8px;">Tgl scan</th>
                <th style="padding:6px 8px;">Tertahan</th>
                <th style="padding:6px 8px;">TLC asal</th>
                <th style="padding:6px 8px;">Scan oleh</th>
                <th style="padding:6px 8px;">Alasan masalah</th>
                <th style="padding:6px 8px; text-align:right;">Butuh</th>
                <th style="padding:6px 8px; text-align:right;">Entry</th>
                <th style="padding:6px 8px; text-align:right;">Kurang</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in daftarTersaring" :key="d.id" style="border-bottom:1px solid var(--border-soft);" :style="{ background: tertahan(d.scan_pada) ? 'var(--warn-light)' : 'transparent' }">
                <td style="padding:6px 8px;"><input v-if="bolehProses" type="checkbox" :checked="!!terpilih[d.id]" @change="toggleSatu(d)"></td>
                <td style="padding:6px 8px;">
                  <div class="gc-num" style="font-weight:700;">{{ d.no_spk || '-' }}</div>
                  <div style="color:var(--text-faint); font-size:10px;">{{ d.bahan_nama }} {{ d.bahan_warna }}</div>
                </td>
                <td style="padding:6px 8px;" class="gc-num">{{ formatWaktu(d.scan_pada) }}</td>
                <td style="padding:6px 8px;"><span class="tag" :class="tertahan(d.scan_pada) ? 'warn' : 'neutral'">{{ formatDiamSejak(d.scan_pada) }}</span></td>
                <td style="padding:6px 8px;">{{ d.tlc_asal || '-' }}</td>
                <td style="padding:6px 8px;">{{ d.scan_oleh || '-' }}</td>
                <td style="padding:6px 8px;">{{ d.alasan_masalah || '-' }}</td>
                <td style="padding:6px 8px; text-align:right;" class="gc-num">{{ formatQty(butuhAwal(d)) }}</td>
                <td style="padding:6px 8px; text-align:right;" class="gc-num">{{ d.qty_entry_asal != null ? formatQty(d.qty_entry_asal) : '-' }}</td>
                <td style="padding:6px 8px; text-align:right; color:var(--danger);" class="gc-num">{{ formatQty(d.qty_kurang) }} {{ d.satuan }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="gc-card" style="padding:12px 14px; border-radius:16px; border:1px dashed var(--line);">
          <div class="gc-heading" style="font-weight:700; font-size:12px; margin-bottom:2px;">Kumulatif per bahan</div>
          <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:8px;">Bahan yang sama dari SPK berbeda dijumlahkan — ini yang dikirim ke Owner saat diajukan.</div>
          <div v-for="k in kumulatifSemua" :key="k.bahanAksesorisId" style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:6px 8px; border-radius:8px; background:var(--ivory-dim); margin-bottom:5px; font-size:11.5px;">
            <span>{{ k.nama }} <span style="color:var(--text-faint);">{{ k.warna }}</span></span>
            <span style="color:var(--text-faint); font-size:10px;">{{ k.jumlah }} SPK</span>
            <span class="gc-num" style="font-weight:700;">{{ formatQty(k.butuh) }} {{ k.satuan }}</span>
          </div>
        </div>
      </template>
    </template>

    <div v-if="popupAjukan" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:420px; width:100%; padding:18px; border-radius:18px; max-height:82vh; overflow-y:auto;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 4px;">Ajukan belanja</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0 0 10px;">{{ jumlahTerpilih }} kekurangan terpilih &middot; digabung per bahan &middot; {{ kumulatifTerpilih.length }} jenis</p>
        <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">
          <div v-for="k in kumulatifTerpilih" :key="k.bahanAksesorisId" style="display:flex; justify-content:space-between; gap:8px; padding:7px 9px; border-radius:8px; background:var(--ivory-dim); font-size:11.5px;">
            <div><b>{{ k.nama }}</b> <span style="color:var(--text-faint);">{{ k.warna }}</span><div style="font-size:9.5px; color:var(--text-faint);">{{ k.jumlah }} SPK</div></div>
            <span class="gc-num" style="font-weight:700;">{{ formatQty(k.butuh) }} {{ k.satuan }}</span>
          </div>
        </div>
        <div class="gc-field" style="margin-bottom:14px;">
          <label>Catatan (boleh kosong)</label>
          <textarea v-model="popupAjukan.catatan" rows="2" style="width:100%; padding:8px; border-radius:10px; border:1.5px solid var(--line); font-size:12px;"></textarea>
        </div>
        <p style="font-size:10.5px; color:var(--text-faint); margin:0 0 12px;">Pengajuan masuk ke Menunggu Setuju. Yang menyetujui Owner / PIC Owner.</p>
        <div style="display:flex; gap:8px;">
          <button @click="popupAjukan = null" :disabled="sedangProses" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiAjukan" :disabled="sedangProses" class="btn-primary" style="flex:1; padding:9px;">Ajukan</button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// TAB 2: Menunggu Setuju — REVISI 9 Sep 2026 (audit wireframe.dc.html "06 -
// Masalah" §6.2 vs kode live, keputusan Guru). Wireframe: SATU KARTU per
// PENGAJUAN (bisa berisi BEBERAPA baris SPK sekaligus, dikelompokkan lewat
// kode_pengajuan yang dibuat TAB 1 di atas), Setujui/Tolak menutup SELURUH
// pengajuan sekaligus (satu klik = satu keputusan untuk semua baris di kartu
// itu), dan tampilannya dipisah: blok "detail masalah" (apa yang kurang, per
// SPK) vs panel "Kumulatif per bahan" (MOQ, pakai/minggu, qty beli EDITABLE,
// estimasi, sisa jadi stok — hitungan belanja, bukan detail masalah).
//
// HATI-HATI (modul uang/pembelian) — HITUNGAN PER BARIS TIDAK DIUBAH SAMA
// SEKALI. Setujui/Tolak/Ajukan Belanja tingkat KARTU cuma me-LOOP fungsi yang
// PERSIS SAMA seperti sebelum revisi ini (patchMasalah per dokumen dengan
// qty_disetujui/qty_beli dari infoTambahan[d.id].qtyBeli masing-masing baris)
// — jadi satu klik "Setujui" di kartu = beberapa kali write per-baris dengan
// angka yang identik dengan versi sebelumnya, cuma dipicu bareng.
//
// KEPUTUSAN TERBUKA (dilaporkan, BUKAN ditebak) — "qty beli" gabungan saat
// SATU bahan muncul di LEBIH DARI SATU baris DALAM SATU pengajuan yang sama:
// wireframe menggambarkan qty beli sebagai SATU angka gabungan per bahan
// (dibulatkan ke kelipatan MOQ), tapi skema data ini menyimpan qty_disetujui/
// qty_beli PER DOKUMEN (per baris/SPK), dan proses hilir (entry stok di Tab
// 4, serta item baris di Persiapan Belanja) membaca angka itu PER DOKUMEN.
// Memecah satu angka gabungan yang diedit Owner kembali jadi pecahan per
// baris (berapa ke SPK mana) adalah keputusan pembagian uang/stok yang tidak
// ada dasarnya di skema resmi — TIDAK ditebak. Jadi: kalau sebuah bahan
// hanya muncul di SATU baris dalam pengajuan itu (kasus paling umum, sesuai
// contoh wireframe), panel Kumulatif menampilkan qty beli EDITABLE seperti
// biasa (langsung ke baris itu). Kalau bahan yang sama muncul di BEBERAPA
// baris dalam satu pengajuan, panel menampilkan TOTAL sebagai angka
// INFORMASI (read-only) dan mengarahkan Owner mengedit qty beli per baris di
// blok detail masalah di atasnya (fallback aman, edit tetap ada, tidak ada
// kalkulasi pembagian yang ditebak).
// ============================================================================
const MasalahMenungguSetuju = {
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const petaStokBahan = ref({});
    const infoTambahan = reactive({}); // docId -> { moq, moqSatuan, pakaiPerMinggu, qtyBeli }
    const prosesKartu = reactive({}); // groupKey -> boolean
    const sayaOwnerKeAtas = computed(() => tierOwnerKeAtas(window.currentUser));

    async function muat() {
      memuat.value = true;
      try {
        const [list, stokSnap] = await Promise.all([
          muatMasalahStatus('menunggu_setuju'),
          getDocs(collection(db, 'master_bahan_aksesoris'))
        ]);
        const peta = {}; stokSnap.forEach(d => { peta[d.id] = d.data(); });
        petaStokBahan.value = peta;
        daftar.value = list;
        // muat info tambahan (MOQ + pakai/minggu) per bahan UNIK dulu, baru
        // sebar ke tiap baris — hemat query dibanding per-baris kalau ada
        // beberapa baris bahan yang sama. TIDAK BERUBAH dari versi sebelumnya.
        const bahanUnik = [...new Set(list.map(d => d.bahan_aksesoris_id).filter(Boolean))];
        await Promise.all(bahanUnik.map(async (bahanId) => {
          const docSample = list.find(d => d.bahan_aksesoris_id === bahanId);
          const [moqInfo, pakaiPerMinggu] = await Promise.all([
            ambilMoqUntukBahan(bahanId),
            hitungPakaiPerMinggu(bahanId, docSample?.sumber_jalur)
          ]);
          list.filter(d => d.bahan_aksesoris_id === bahanId).forEach(d => {
            infoTambahan[d.id] = {
              moq: moqInfo.moq, moqSatuan: moqInfo.moqSatuan, pakaiPerMinggu,
              qtyBeli: hitungQtyBeliDefault(d.qty_kurang, moqInfo.moq)
            };
          });
        }));
      } catch (e) { console.error('Gagal muat Masalah > Menunggu Setuju:', e); daftar.value = []; }
      memuat.value = false;
    }

    function stokSaatIni(d) { return parseFloat(petaStokBahan.value[d.bahan_aksesoris_id]?.stok_akhir) || 0; }
    function ubahQtyBeli(d, delta) {
      const info = infoTambahan[d.id]; if (!info) return;
      const langkah = info.moq > 0 ? info.moq : 1;
      info.qtyBeli = Math.max(0, (parseFloat(info.qtyBeli) || 0) + delta * langkah);
    }
    function estimasi(d) { const info = infoTambahan[d.id]; return info ? (stokSaatIni(d) + (parseFloat(info.qtyBeli) || 0)) : null; }
    function sisaJadiStok(d) { const e = estimasi(d); return e === null ? null : (e - (parseFloat(d.qty_kurang) || 0)); }

    // --- Kelompok kartu per PENGAJUAN (kode_pengajuan) ----------------------
    // Fallback docId sendiri untuk baris tanpa kode_pengajuan (misal dokumen
    // dari sebelum revisi ini ada) — TIDAK dipaksa gabung, tampil sebagai
    // kartu tunggal sendiri, aman dari salah kelompok.
    const kartuPengajuan = computed(() => {
      const peta = {};
      daftar.value.forEach(d => {
        const key = d.kode_pengajuan || ('solo-' + d.id);
        if (!peta[key]) peta[key] = { key, kodePengajuan: d.kode_pengajuan || null, docs: [] };
        peta[key].docs.push(d);
      });
      return Object.values(peta).map(k => {
        const diajukanPadaMin = k.docs.reduce((min, d) => {
          const t = new Date(d.diajukan_pada || d.scan_pada || 0).getTime();
          return (min === null || t < min) ? t : min;
        }, null);
        return {
          ...k,
          diajukanOleh: k.docs[0]?.diajukan_oleh || '-',
          diajukanPadaIso: diajukanPadaMin ? new Date(diajukanPadaMin).toISOString() : null,
          jumlahBahan: new Set(k.docs.map(d => d.bahan_aksesoris_id)).size,
          kumulatif: kelompokKumulatifPerBahan(k.docs)
        };
      }).sort((a, b) => new Date(a.diajukanPadaIso || 0) - new Date(b.diajukanPadaIso || 0));
    });

    function qtyBeliBahan(m) {
      if (m.docs.length === 1) return infoTambahan[m.docs[0].id]?.qtyBeli;
      return m.docs.reduce((s, d) => s + (parseFloat(infoTambahan[d.id]?.qtyBeli) || 0), 0);
    }
    function estimasiBahan(m) {
      if (m.docs.length === 1) return estimasi(m.docs[0]);
      const stok = stokSaatIni(m.docs[0]);
      return stok + qtyBeliBahan(m);
    }
    function sisaBahan(m) { return estimasiBahan(m) - m.butuh; }

    async function setujuiKartu(k) {
      if (!sayaOwnerKeAtas.value) return alert('Hanya Owner/PIC Owner yang boleh menyetujui.');
      if (!confirm(`Setujui pengajuan ${k.kodePengajuan || ''} (${k.docs.length} baris)? Seluruh baris di pengajuan ini akan pindah ke Perlu Disiapkan.`)) return;
      prosesKartu[k.key] = true;
      const now = new Date().toISOString();
      const oleh = window.currentUser?.email || '';
      try {
        await Promise.all(k.docs.map(d => patchMasalah(d.id, {
          status: 'perlu_disiapkan',
          qty_disetujui: parseFloat(infoTambahan[d.id]?.qtyBeli) || parseFloat(d.qty_kurang) || 0,
          disetujui_oleh: oleh, disetujui_pada: now
        })));
        await muat();
      } catch (e) { console.error('Gagal setujui pengajuan:', e); alert('Gagal menyimpan. Coba lagi.'); }
      prosesKartu[k.key] = false;
    }
    async function tolakKartu(k) {
      if (!sayaOwnerKeAtas.value) return alert('Hanya Owner/PIC Owner yang boleh menolak.');
      const catatan = prompt(`Alasan menolak pengajuan ${k.kodePengajuan || ''} (opsional):`) || '';
      prosesKartu[k.key] = true;
      const now = new Date().toISOString();
      const oleh = window.currentUser?.email || '';
      try {
        await Promise.all(k.docs.map(d => patchMasalah(d.id, {
          status: 'perlu_diajukan', catatan_tolak: catatan.trim(),
          ditolak_oleh: oleh, ditolak_pada: now
        })));
        await muat();
      } catch (e) { console.error('Gagal tolak pengajuan:', e); alert('Gagal menyimpan. Coba lagi.'); }
      prosesKartu[k.key] = false;
    }
    async function ajukanBelanjaKartu(k) {
      if (!sayaOwnerKeAtas.value) return alert('Hanya Owner/PIC Owner yang boleh mengajukan belanja.');
      if (!confirm(`Ajukan belanja seluruh ${k.docs.length} baris di pengajuan ${k.kodePengajuan || ''} ke Persiapan Belanja?`)) return;
      prosesKartu[k.key] = true;
      const now = new Date().toISOString();
      const oleh = window.currentUser?.email || '';
      try {
        await Promise.all(k.docs.map(d => patchMasalah(d.id, {
          status: 'diajukan_belanja',
          qty_beli: parseFloat(infoTambahan[d.id]?.qtyBeli) || parseFloat(d.qty_kurang) || 0,
          diajukan_belanja_oleh: oleh, diajukan_belanja_pada: now
        })));
        await muat();
      } catch (e) { console.error('Gagal ajukan belanja pengajuan:', e); alert('Gagal menyimpan. Coba lagi.'); }
      prosesKartu[k.key] = false;
    }

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, daftar, kartuPengajuan, infoTambahan, prosesKartu, sayaOwnerKeAtas,
      stokSaatIni, ubahQtyBeli, estimasi, sisaJadiStok,
      qtyBeliBahan, estimasiBahan, sisaBahan,
      setujuiKartu, tolakKartu, ajukanBelanjaKartu,
      formatQty, formatWaktu, formatDiamSejak, tertahan
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else-if="!sayaOwnerKeAtas" class="gc-card" style="padding:14px; border-radius:16px; background:var(--warn-light); color:var(--warn); font-size:11.5px; margin-bottom:12px;">
      <i class="fas fa-lock" style="margin-right:6px;"></i>Tab ini khusus Owner/PIC Owner — Anda bisa melihat daftarnya tapi tidak bisa memutuskan.
    </div>

    <div v-if="!memuat && kartuPengajuan.length === 0" class="gc-kosong gc-card">
      <div class="lingkaran"><i class="fas fa-hourglass-half"></i></div>
      <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang menunggu persetujuan</h3>
    </div>

    <div v-else style="display:flex; flex-direction:column; gap:12px;">
      <div v-for="k in kartuPengajuan" :key="k.key" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;" :style="{ borderColor: tertahan(k.diajukanPadaIso) ? 'var(--warn)' : undefined }">
        <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:2px; flex-wrap:wrap;">
          <div class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ k.kodePengajuan || 'Pengajuan (baris tunggal)' }}</div>
          <span class="tag" :class="tertahan(k.diajukanPadaIso) ? 'warn' : 'neutral'">diajukan {{ formatDiamSejak(k.diajukanPadaIso) }} lalu</span>
        </div>
        <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:10px;">diajukan {{ k.diajukanOleh }} &middot; {{ k.docs.length }} SPK &middot; {{ k.jumlahBahan }} bahan</div>

        <!-- Blok detail masalah — per SPK, TANPA kontrol qty beli (pindah ke panel Kumulatif) -->
        <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
          <div v-for="d in k.docs" :key="d.id" style="font-size:11px; padding:8px 10px; border-radius:10px; background:var(--ivory-dim);">
            <div style="display:flex; justify-content:space-between; gap:8px;">
              <span class="gc-num" style="font-weight:700;">{{ d.no_spk || '-' }}</span>
              <span style="color:var(--text-faint);">{{ d.bahan_nama }} <span>{{ d.bahan_warna }}</span></span>
              <span class="gc-num" style="color:var(--danger); font-weight:700;">{{ formatQty(d.qty_kurang) }} {{ d.satuan }}</span>
            </div>
            <div style="color:var(--text-faint); margin-top:3px; font-size:10px;">{{ d.tlc_asal || '-' }} &middot; scan {{ formatWaktu(d.scan_pada) }} oleh {{ d.scan_oleh || '-' }}</div>
            <div v-if="d.alasan_masalah" style="margin-top:3px;">{{ d.alasan_masalah }}</div>
          </div>
        </div>

        <!-- Panel Kumulatif per bahan — hitungan belanja, terpisah dari detail masalah -->
        <div class="gc-card" style="padding:10px 12px; border-radius:14px; border:1px dashed var(--line); margin-bottom:10px;">
          <div class="gc-heading" style="font-weight:700; font-size:11.5px; margin-bottom:8px;">Kumulatif per bahan</div>
          <div v-for="m in k.kumulatif" :key="m.bahanAksesorisId" style="border-top:1px solid var(--border-soft); padding-top:8px; margin-top:8px;" :style="{ borderTop: k.kumulatif[0]===m ? 'none' : undefined, marginTop: k.kumulatif[0]===m ? 0 : undefined, paddingTop: k.kumulatif[0]===m ? 0 : undefined }">
            <div style="font-size:11.5px; font-weight:700; margin-bottom:6px;">{{ m.nama }} <span style="color:var(--text-faint); font-weight:600;">{{ m.warna }}</span> <span style="color:var(--text-faint); font-size:9.5px; font-weight:400;">&middot; {{ m.jumlah }} SPK</span></div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(85px, 1fr)); gap:8px;">
              <div style="border:1px dashed var(--line); border-radius:10px; padding:6px 8px;">
                <div style="font-size:9px; color:var(--text-faint); text-transform:uppercase;">Kurang</div>
                <div class="gc-num" style="font-size:12px; font-weight:700; color:var(--danger);">{{ formatQty(m.butuh) }} {{ m.satuan }}</div>
              </div>
              <div style="border:1px dashed var(--line); border-radius:10px; padding:6px 8px;">
                <div style="font-size:9px; color:var(--text-faint); text-transform:uppercase;">MOQ</div>
                <div class="gc-num" style="font-size:12px; font-weight:700;">{{ infoTambahan[m.docs[0].id]?.moq > 0 ? formatQty(infoTambahan[m.docs[0].id].moq) + ' ' + (infoTambahan[m.docs[0].id].moqSatuan || '') : '-' }}</div>
              </div>
              <div style="border:1px dashed var(--line); border-radius:10px; padding:6px 8px;">
                <div style="font-size:9px; color:var(--text-faint); text-transform:uppercase;">Pakai/minggu</div>
                <div class="gc-num" style="font-size:12px; font-weight:700;">{{ infoTambahan[m.docs[0].id]?.pakaiPerMinggu != null ? formatQty(infoTambahan[m.docs[0].id].pakaiPerMinggu) : '-' }}</div>
              </div>
              <div style="border:1px dashed var(--line); border-radius:10px; padding:6px 8px;">
                <div style="font-size:9px; color:var(--text-faint); text-transform:uppercase;">Qty Beli</div>
                <div v-if="m.docs.length === 1 && sayaOwnerKeAtas" style="display:flex; align-items:center; gap:4px;">
                  <button @click="ubahQtyBeli(m.docs[0], -1)" class="btn-outline" style="padding:2px 7px; font-size:11px;">-</button>
                  <input v-model.number="infoTambahan[m.docs[0].id].qtyBeli" type="number" class="gc-num" style="width:56px; text-align:center; border:1px solid var(--line); border-radius:6px; padding:3px; font-size:11px;">
                  <button @click="ubahQtyBeli(m.docs[0], 1)" class="btn-outline" style="padding:2px 7px; font-size:11px;">+</button>
                </div>
                <div v-else class="gc-num" style="font-size:12px; font-weight:700;">{{ formatQty(qtyBeliBahan(m)) }}</div>
              </div>
              <div style="border:1px dashed var(--line); border-radius:10px; padding:6px 8px;">
                <div style="font-size:9px; color:var(--text-faint); text-transform:uppercase;">Estimasi</div>
                <div class="gc-num" style="font-size:12px; font-weight:700;">{{ formatQty(estimasiBahan(m)) }}</div>
              </div>
              <div style="border:1px dashed var(--line); border-radius:10px; padding:6px 8px;">
                <div style="font-size:9px; color:var(--text-faint); text-transform:uppercase;">Sisa jadi stok</div>
                <div class="gc-num" style="font-size:12px; font-weight:700; color:var(--ok);">{{ formatQty(sisaBahan(m)) }}</div>
              </div>
            </div>
            <p v-if="m.docs.length > 1" style="font-size:9.5px; color:var(--text-faint); margin:6px 0 0;">Bahan ini ada di {{ m.docs.length }} SPK dalam pengajuan yang sama — qty beli di atas adalah TOTAL (info). Edit per SPK belum didukung di sini (keputusan terbuka, lihat komentar kode) — kalau perlu diedit, tolak dulu lalu ajukan ulang per baris.</p>
          </div>
        </div>

        <div v-if="sayaOwnerKeAtas" style="display:flex; gap:6px;">
          <button @click="setujuiKartu(k)" :disabled="prosesKartu[k.key]" class="btn-primary" style="flex:1; padding:8px; font-size:11px;"><i class="fas fa-check" style="margin-right:4px;"></i>Setujui</button>
          <button @click="ajukanBelanjaKartu(k)" :disabled="prosesKartu[k.key]" class="btn-outline" style="flex:1; padding:8px; font-size:11px;"><i class="fas fa-cart-shopping" style="margin-right:4px;"></i>Ajukan Belanja</button>
          <button @click="tolakKartu(k)" :disabled="prosesKartu[k.key]" class="btn-outline" style="flex:0 0 auto; padding:8px 12px; font-size:11px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-xmark"></i></button>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// TAB 3: Perlu Disiapkan — mirror pos Bahan tab 1 (cetak label lalu tunjuk
// operator), TANPA cek stok/alokasi greedy (itu sudah diputuskan Owner di
// 6.2 lewat qty_disetujui) dan TANPA cetak-ulang (tidak disebut SERAH-TERIMA
// modul ini, beda dari pos Bahan yang eksplisit memintanya).
// ============================================================================
const MasalahPerluDisiapkan = {
  components: { PopupPratinjauCetakLabel, ScanGenerik },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const kartuTerbuka = reactive({});
    const pilihanCetak = reactive({});
    const menuId = 'pp_masalah';
    // REVISI 8 Sep 2026 (keputusan Guru, audit kode) — satu-satunya
    // pemakai bolehProses di komponen ini adalah tombol "Tunjuk Operator",
    // jadi digerbang langsung PIC ke atas di sini.
    const bolehProses = computed(() => picOwnerKeAtas(window.currentUser) && window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);

    async function muat() {
      memuat.value = true;
      try { daftar.value = await muatMasalahStatus('perlu_disiapkan'); }
      catch (e) { console.error('Gagal muat Masalah > Perlu Disiapkan:', e); daftar.value = []; }
      memuat.value = false;
    }
    const kartuList = computed(() => kelompokKumulatifPerBahan(daftar.value));
    function toggleKartu(k) { kartuTerbuka[k.bahanAksesorisId] = !kartuTerbuka[k.bahanAksesorisId]; }
    function isChecked(d) { return d.id in pilihanCetak ? pilihanCetak[d.id] : !d.label_cetak_pada; }
    function toggleCheck(d) { if (d.label_cetak_pada) return; pilihanCetak[d.id] = !isChecked(d); }

    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    const sedangProses = ref(false);
    async function cetakLabelKartu(k) {
      if (typeof QRCode === 'undefined') { alert('Library pembuat QR belum siap dimuat. Refresh halaman (Ctrl+Shift+R) lalu ulangi.'); return; }
      const terpilih = k.docs.filter(d => isChecked(d) && !d.label_cetak_pada);
      if (!terpilih.length) { alert('Tidak ada baris yang bisa dicetak (sudah dicetak semua, atau tidak ada yang dicentang).'); return; }
      sedangProses.value = true;
      try {
        const preview = [];
        for (const d of terpilih) {
          const kode = await generateKodeHarian('MSL', 'pengaturan_id_persiapan_masalah');
          await patchMasalah(d.id, { kode_msl: kode, label_cetak_pada: new Date().toISOString() });
          preview.push({ kode, nama: `${k.nama} ${k.warna || ''}`.trim(), info: `${d.no_spk || '-'} &middot; ${formatQty(d.qty_disetujui || d.qty_kurang)} ${d.satuan || ''} &middot; kembali ke ${d.tlc_asal || d.sumber_jalur || '-'}`, qrDataUrl: buatQrDataUrl(kode) });
        }
        daftarLabelPreview.value = preview;
        popupCetakAktif.value = true;
        await muat();
      } catch (e) { console.error('Gagal cetak label Masalah:', e); alert('Gagal mencetak. Coba lagi.'); }
      sedangProses.value = false;
    }

    const modalTunjuk = reactive({ aktif: false, kartu: null, operator: null, tahap: 'operator', log: [] });
    function bukaPenunjukan(k) {
      const eligible = k.docs.filter(d => d.label_cetak_pada && d.status === 'perlu_disiapkan');
      if (!eligible.length) { alert('Belum ada baris yang sudah dicetak labelnya di kartu ini.'); return; }
      modalTunjuk.kartu = k; modalTunjuk.operator = null; modalTunjuk.tahap = 'operator'; modalTunjuk.log = [];
      modalTunjuk.aktif = true;
    }
    function tutupPenunjukan() { modalTunjuk.aktif = false; modalTunjuk.kartu = null; modalTunjuk.operator = null; modalTunjuk.log = []; }
    async function hasilScanTunjuk(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      if (!kode) return;
      if (modalTunjuk.tahap === 'operator') {
        const karyawan = await cariKaryawanByQr(kode);
        if (!karyawan) { alert('QR tidak dikenali — operator/tim tidak ditemukan.'); return; }
        modalTunjuk.operator = { id: karyawan.id, nama: karyawan.nama || karyawan.name || karyawan.id };
        modalTunjuk.tahap = 'anak';
        return;
      }
      const target = (modalTunjuk.kartu?.docs || []).find(d => d.kode_msl === kode && d.label_cetak_pada && d.status === 'perlu_disiapkan');
      if (!target) { alert(`Kode "${kode}" tidak cocok baris manapun di kartu ini.`); return; }
      const now = new Date().toISOString();
      try {
        await patchMasalah(target.id, {
          status: 'sedang_disiapkan', masuk_tahap_pada: now,
          operator_uid: modalTunjuk.operator.id, operator_nama: modalTunjuk.operator.nama, ditugaskan_pada: now,
          riwayat_operator: arrayUnion({ operator_uid: modalTunjuk.operator.id, operator_nama: modalTunjuk.operator.nama, mulai_pada: now })
        });
        modalTunjuk.log.unshift(`${target.no_spk || target.kode_msl} -> ${modalTunjuk.operator.nama}`);
        target.status = 'sedang_disiapkan';
      } catch (e) { console.error('Gagal simpan penunjukan:', e); alert('Gagal menyimpan penunjukan. Coba lagi.'); }
    }
    async function selesaiPenunjukan() { tutupPenunjukan(); await muat(); }

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, kartuList, kartuTerbuka, toggleKartu, isChecked, toggleCheck,
      bolehProses, bolehCetak, sedangProses, formatQty, formatWaktu,
      popupCetakAktif, daftarLabelPreview, cetakLabelKartu,
      modalTunjuk, bukaPenunjukan, tutupPenunjukan, hasilScanTunjuk, selesaiPenunjukan
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <template v-else>
      <div v-if="kartuList.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-list-check"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang perlu disiapkan</h3>
      </div>

      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="k in kartuList" :key="k.bahanAksesorisId" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px; cursor:pointer;" @click="toggleKartu(k)">
            <div class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ k.nama }} <span style="color:var(--text-faint); font-weight:600;">{{ k.warna }}</span></div>
            <i class="fas" :class="kartuTerbuka[k.bahanAksesorisId] ? 'fa-chevron-up' : 'fa-chevron-down'" style="color:var(--text-faint);"></i>
          </div>
          <div style="font-size:11px; color:var(--text-faint); margin-bottom:8px;">{{ k.jumlah }} baris &middot; total {{ formatQty(k.butuh) }} {{ k.satuan }}</div>

          <div v-if="kartuTerbuka[k.bahanAksesorisId]" style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
            <label v-for="d in k.docs" :key="d.id" style="display:flex; align-items:center; gap:8px; font-size:11px; padding:6px 8px; border-radius:10px;" :style="{ background: d.label_cetak_pada ? 'var(--ok-light)' : 'transparent' }">
              <input type="checkbox" :checked="isChecked(d)" :disabled="!!d.label_cetak_pada" @change="toggleCheck(d)">
              <span class="gc-num" style="font-weight:700; min-width:100px;">{{ d.no_spk || '-' }}</span>
              <span class="gc-num">{{ formatQty(d.qty_disetujui || d.qty_kurang) }} {{ d.satuan }}</span>
              <span v-if="d.label_cetak_pada" class="tag ok" style="margin-left:auto;">{{ d.kode_msl }}</span>
            </label>
          </div>

          <div style="display:flex; gap:8px; border-top:1px solid var(--line); padding-top:10px;">
            <button v-if="bolehCetak" @click="cetakLabelKartu(k)" :disabled="sedangProses" class="btn-outline" style="flex:1; padding:9px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Label</button>
            <button v-if="bolehProses && k.docs.some(d=>d.label_cetak_pada && d.status==='perlu_disiapkan')" @click="bukaPenunjukan(k)" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Tunjuk Operator</button>
          </div>
        </div>
      </div>
    </template>

    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Label Masalah" :daftar-label="daftarLabelPreview" jenis-cetak="label_masalah" @tutup="popupCetakAktif = false" />

    <scan-generik :aktif="modalTunjuk.aktif"
      :judul="modalTunjuk.tahap==='operator' ? 'Scan QR Operator/Tim' : ('Scan label — operator: ' + (modalTunjuk.operator?.nama || ''))"
      :subjudul="modalTunjuk.tahap==='anak' ? 'Bisa discan berkali-kali. Scan QR operator lain buat ganti operator aktif.' : ''"
      @hasil="hasilScanTunjuk" @tutup="selesaiPenunjukan" />
    <div v-if="modalTunjuk.aktif && modalTunjuk.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:260px;">
      <div v-for="(l,i) in modalTunjuk.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>
  `
};

// ============================================================================
// TAB 4: Sedang Disiapkan — mirror pos Bahan tab 2 (per operator, Scan
// Entry/Masalah/Ganti). Scan Masalah di sini HANYA catat catatan_masalah di
// baris yang sama, TIDAK rekursif bikin dokumen baru (lihat keputusan §5).
// ============================================================================
const MasalahSedangDisiapkan = {
  components: { ScanGenerik },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const sedangProses = reactive({});
    const menuId = 'pp_masalah';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);

    async function muat() {
      memuat.value = true;
      try { daftar.value = await muatMasalahStatus('sedang_disiapkan'); }
      catch (e) { console.error('Gagal muat Masalah > Sedang Disiapkan:', e); daftar.value = []; }
      memuat.value = false;
    }

    const kelompokOperator = computed(() => {
      const peta = {};
      daftar.value.forEach(d => {
        const key = d.operator_uid || d.operator_nama || '-';
        if (!peta[key]) peta[key] = { operatorNama: d.operator_nama || '(tanpa nama)', docs: [] };
        peta[key].docs.push(d);
      });
      return Object.values(peta).sort((a, b) => b.docs.length - a.docs.length);
    });

    const modalAksi = reactive({ aktif: false, mode: null, item: null }); // mode: 'entry' | 'masalah' | 'ganti'
    function bukaAksi(mode, d) { if (sedangProses[d.id]) return; modalAksi.mode = mode; modalAksi.item = d; modalAksi.aktif = true; }
    function tutupAksi() { modalAksi.aktif = false; modalAksi.mode = null; modalAksi.item = null; }
    async function hasilScanAksi(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      const d = modalAksi.item;
      if (!kode || !d) return;
      if (modalAksi.mode === 'ganti') {
        const karyawan = await cariKaryawanByQr(kode);
        if (!karyawan) { alert('QR tidak dikenali — operator/tim tidak ditemukan.'); return; }
        sedangProses[d.id] = true;
        try {
          const now = new Date().toISOString();
          await patchMasalah(d.id, {
            operator_uid: karyawan.id, operator_nama: karyawan.nama || karyawan.name || karyawan.id, ditugaskan_pada: now,
            riwayat_operator: arrayUnion({ operator_uid: karyawan.id, operator_nama: karyawan.nama || karyawan.name || karyawan.id, mulai_pada: now })
          });
          tutupAksi(); await muat();
        } catch (e) { console.error('Gagal ganti operator:', e); alert('Gagal menyimpan. Coba lagi.'); }
        sedangProses[d.id] = false;
        return;
      }
      // entry/masalah: kode HARUS scan label kode_msl baris ini sendiri.
      if (kode !== d.kode_msl) { alert(`Kode yang discan ("${kode}") tidak cocok dengan label baris ini (${d.kode_msl}).`); return; }
      sedangProses[d.id] = true;
      try {
        if (modalAksi.mode === 'entry') {
          await konfirmasiEntryMasalah(d);
        } else if (modalAksi.mode === 'masalah') {
          const catatan = prompt('Jelaskan masalahnya:');
          if (!catatan || !catatan.trim()) { sedangProses[d.id] = false; return; }
          await patchMasalah(d.id, { catatan_masalah: catatan.trim() });
        }
        tutupAksi(); await muat();
      } catch (e) { console.error('Gagal proses scan:', modalAksi.mode, e); alert('Gagal memproses. Coba lagi.'); }
      sedangProses[d.id] = false;
    }

    onMounted(async () => { await window.authReady; await muat(); });

    return { memuat, kelompokOperator, bolehProses, sedangProses, formatQty, formatDiamSejak, tertahan, modalAksi, bukaAksi, tutupAksi, hasilScanAksi };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else-if="kelompokOperator.length === 0" class="gc-kosong gc-card">
      <div class="lingkaran"><i class="fas fa-gears"></i></div>
      <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang sedang disiapkan</h3>
    </div>

    <div v-else style="display:flex; flex-direction:column; gap:10px;">
      <div v-for="op in kelompokOperator" :key="op.operatorNama" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
          <i class="fas fa-user" style="color:var(--aksen-ink);"></i>
          <span class="gc-heading" style="font-weight:700; font-size:13px;">{{ op.operatorNama }}</span>
          <span class="tag pink" style="margin-left:auto;">{{ op.docs.length }} baris</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div v-for="d in op.docs" :key="d.id" style="border:1px solid var(--line); border-radius:14px; padding:10px;" :style="{ background: tertahan(d.masuk_tahap_pada) ? 'var(--warn-light)' : 'transparent' }">
            <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:4px;">
              <span class="gc-num" style="font-weight:700; font-size:11.5px;">{{ d.kode_msl || d.no_spk }}</span>
              <span class="tag" :class="tertahan(d.masuk_tahap_pada) ? 'warn' : 'neutral'">diam {{ formatDiamSejak(d.masuk_tahap_pada) }}</span>
            </div>
            <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:6px;">{{ d.bahan_nama }} {{ d.bahan_warna }} &middot; {{ formatQty(d.qty_disetujui || d.qty_kurang) }} {{ d.satuan }} &middot; kembali ke {{ d.tlc_asal || d.sumber_jalur }}</div>
            <div v-if="d.catatan_masalah" style="font-size:10.5px; color:var(--danger); background:var(--danger-light); border-radius:8px; padding:5px 8px; margin-bottom:6px;"><i class="fas fa-triangle-exclamation" style="margin-right:6px;"></i>{{ d.catatan_masalah }}</div>
            <div v-if="bolehProses" style="display:flex; gap:6px;">
              <button @click="bukaAksi('entry', d)" :disabled="sedangProses[d.id]" class="btn-primary" style="flex:1; padding:7px; font-size:11px;"><i class="fas fa-qrcode" style="margin-right:4px;"></i>Scan Entry</button>
              <button @click="bukaAksi('masalah', d)" :disabled="sedangProses[d.id]" class="btn-outline" style="flex:1; padding:7px; font-size:11px; color:var(--danger); border-color:var(--danger);"><i class="fas fa-triangle-exclamation" style="margin-right:4px;"></i>Masalah</button>
              <button @click="bukaAksi('ganti', d)" :disabled="sedangProses[d.id]" class="btn-outline" style="flex:0 0 auto; padding:7px 9px; font-size:11px;" title="Ganti Operator"><i class="fas fa-arrow-right-arrow-left"></i></button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <scan-generik :aktif="modalAksi.aktif"
      :judul="modalAksi.mode==='ganti' ? 'Scan QR operator pengganti' : ('Scan label ' + (modalAksi.item?.kode_msl || ''))"
      :subjudul="modalAksi.mode==='entry' ? 'Scan Entry — stok akan berkurang.' : (modalAksi.mode==='masalah' ? 'Scan Masalah — akan diminta catatan.' : '')"
      @hasil="hasilScanAksi" @tutup="tutupAksi" />
  `
};

// ============================================================================
// TAB 5: Perlu Di Kirim — mirror pos Bahan tab 3 (cetak Kode Bagging + Kode
// Tugas, Scan Pack + Scan Kirim), TAPI dikelompokkan per TUJUAN (sumber_jalur
// + tlc_asal) bukan per pola/bahan/size — karena yang dikirim di sini
// beragam bahan yang KEMBALI ke pos asal yang sama, bukan produk sejenis
// yang dipack bersama. Kode Tugas default tujuan = TLC pos asal (JALUR_TLC).
// ============================================================================
function kunciKirimMasalah(d) { return (d.sumber_jalur || '') + '::' + (d.tlc_asal || ''); }
function labelKirimMasalah(d) { return 'Kembali ke ' + (d.tlc_asal || d.sumber_jalur || 'pos asal (tidak diketahui)'); }

const MasalahPerluDiKirim = {
  components: { PopupPratinjauCetakLabel, ScanGenerik },
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    const daftarBaggingAktif = ref([]);
    const daftarTlc = ref([]);
    const sedangProses = ref(false);
    const menuId = 'pp_masalah';
    const bolehProses = computed(() => window.cekIzinMenu(menuId, 'edit') !== false);
    const bolehCetak = computed(() => window.cekIzinMenu(menuId, 'print') !== false);

    async function muat() {
      memuat.value = true;
      try {
        const [list, baggingSnap, tlcSnap] = await Promise.all([
          muatMasalahStatus('perlu_dikirim'),
          getDocs(query(collection(db, 'bagging'), where('ditutup_pada', '==', null))),
          getDocs(collection(db, 'master_tlc'))
        ]);
        daftar.value = list;
        daftarBaggingAktif.value = baggingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        daftarTlc.value = tlcSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error('Gagal muat Masalah > Perlu Di Kirim:', e);
        daftar.value = []; daftarBaggingAktif.value = []; daftarTlc.value = [];
      }
      memuat.value = false;
    }

    const kelompokTujuan = computed(() => {
      const peta = {};
      daftar.value.forEach(d => {
        const key = kunciKirimMasalah(d);
        if (!peta[key]) peta[key] = { key, label: labelKirimMasalah(d), docs: [] };
        peta[key].docs.push(d);
      });
      return Object.values(peta);
    });

    const popupBagging = ref(null);
    function bukaCetakBagging() {
      if (!kelompokTujuan.value.length) { alert('Tidak ada baris di tab ini.'); return; }
      popupBagging.value = { tujuanKey: kelompokTujuan.value[0].key, jumlah: 1 };
    }
    const popupCetakAktif = ref(false);
    const daftarLabelPreview = ref([]);
    // jenisCetakAktif — lihat catatan sama di vue-persiapan-bahan.js.
    const jenisCetakAktif = ref('kode_bagging');
    async function konfirmasiCetakBagging() {
      const p = popupBagging.value;
      const grup = kelompokTujuan.value.find(g => g.key === p.tujuanKey);
      if (!grup) return;
      const n = Math.max(1, parseInt(p.jumlah) || 1);
      sedangProses.value = true;
      try {
        const preview = [];
        for (let i = 0; i < n; i++) {
          const kode = await generateKodeHarian('BAG', 'pengaturan_id_bagging');
          await addDoc(collection(db, 'bagging'), {
            kode, produk_label: grup.label, isi: [], ditutup_pada: null,
            dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
          });
          preview.push({ kode, nama: grup.label, info: 'Kode Bagging &middot; belum diisi', qrDataUrl: buatQrDataUrl(kode) });
        }
        daftarLabelPreview.value = preview;
        jenisCetakAktif.value = 'kode_bagging';
        popupBagging.value = null;
        popupCetakAktif.value = true;
        await muat();
      } catch (e) { console.error('Gagal cetak kode bagging:', e); alert('Gagal membuat kode bagging. Coba lagi.'); }
      sedangProses.value = false;
    }

    const popupTugas = ref(null);
    function bukaCetakTugas() {
      if (!daftarTlc.value.length) { alert('Belum ada data TLC (Titik Lokasi Cerdas). Tambah dulu lewat menu Bahan atau Firestore master_tlc.'); return; }
      const defaultJalur = daftar.value[0]?.sumber_jalur;
      const defaultKode = JALUR_TLC[defaultJalur];
      const cocok = daftarTlc.value.find(t => t.kode === defaultKode);
      popupTugas.value = { tlcTujuan: cocok ? cocok.kode : daftarTlc.value[0].kode };
    }
    async function konfirmasiCetakTugas() {
      const p = popupTugas.value;
      sedangProses.value = true;
      try {
        const kode = await generateKodeHarian('TGS', 'pengaturan_id_tugas_kirim');
        await addDoc(collection(db, 'tugas_kirim'), {
          kode, tlc_asal: 'TLC-MSL', tlc_tujuan: p.tlcTujuan, pack: [],
          dibuat_pada: serverTimestamp(), dibuat_oleh: window.currentUser?.email || null
        });
        daftarLabelPreview.value = [{ kode, nama: 'Kode Tugas Kirim', info: `TLC-MSL &rarr; ${p.tlcTujuan}`, qrDataUrl: buatQrDataUrl(kode) }];
        jenisCetakAktif.value = 'lembar_kode_tugas';
        popupTugas.value = null;
        popupCetakAktif.value = true;
      } catch (e) { console.error('Gagal cetak kode tugas:', e); alert('Gagal membuat kode tugas. Coba lagi.'); }
      sedangProses.value = false;
    }

    const modalPack = reactive({ aktif: false, bagging: null, log: [] });
    function bukaScanPack() { modalPack.bagging = null; modalPack.log = []; modalPack.aktif = true; }
    function tutupScanPack() { modalPack.aktif = false; modalPack.bagging = null; modalPack.log = []; muat(); }
    async function hasilScanPack(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      if (!modalPack.bagging) {
        const b = daftarBaggingAktif.value.find(x => x.kode === kode);
        if (!b) { alert(`Kode bagging "${kode}" tidak ditemukan atau sudah ditutup.`); return; }
        modalPack.bagging = b;
        return;
      }
      const target = daftar.value.find(x => (x.kode_msl === kode || x.no_spk === kode) && !x.kode_bagging);
      if (!target) { alert(`Kode "${kode}" tidak cocok baris manapun yang masih tertahan / sudah di-pack.`); return; }
      if (labelKirimMasalah(target) !== modalPack.bagging.produk_label) {
        alert(`Kode "${kode}" tujuannya beda dengan bagging ini (${modalPack.bagging.produk_label}).`);
        return;
      }
      try {
        await patchMasalah(target.id, { kode_bagging: modalPack.bagging.kode });
        await updateDoc(doc(db, 'bagging', modalPack.bagging.id), { isi: arrayUnion(target.kode_msl || target.no_spk) });
        modalPack.log.unshift((target.kode_msl || target.no_spk) + ' -> ' + modalPack.bagging.kode);
        target.kode_bagging = modalPack.bagging.kode;
      } catch (e) { console.error('Gagal scan pack:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }
    async function tutupBagging() {
      if (!modalPack.bagging) return;
      try { await updateDoc(doc(db, 'bagging', modalPack.bagging.id), { ditutup_pada: serverTimestamp() }); } catch (e) { console.error('Gagal tutup bagging:', e); }
      modalPack.bagging = null;
    }

    const modalKirim = reactive({ aktif: false, tugas: null, log: [] });
    function bukaScanKirim() { modalKirim.tugas = null; modalKirim.log = []; modalKirim.aktif = true; }
    function tutupScanKirim() { modalKirim.aktif = false; modalKirim.tugas = null; modalKirim.log = []; muat(); }
    async function hasilScanKirim(kodeMentah) {
      const kode = (kodeMentah || '').trim();
      if (!modalKirim.tugas) {
        try {
          const snap = await getDocs(query(collection(db, 'tugas_kirim'), where('kode', '==', kode)));
          if (snap.empty) { alert(`Kode tugas "${kode}" tidak ditemukan.`); return; }
          modalKirim.tugas = { id: snap.docs[0].id, ...snap.docs[0].data() };
        } catch (e) { console.error('Gagal cari kode tugas:', e); }
        return;
      }
      const anggota = daftar.value.filter(x => x.kode_bagging === kode);
      if (!anggota.length) { alert(`Kode bagging "${kode}" tidak ditemukan di antara yang masih tertahan.`); return; }
      const now = new Date().toISOString();
      try {
        await Promise.all(anggota.map(d => patchMasalah(d.id, {
          status: 'sedang_dikirim', masuk_tahap_pada: now, kode_tugas: modalKirim.tugas.kode,
          tlc_tujuan: modalKirim.tugas.tlc_tujuan || ''
        })));
        await updateDoc(doc(db, 'tugas_kirim', modalKirim.tugas.id), { pack: arrayUnion({ kode_bagging: kode, pada: now }) });
        modalKirim.log.unshift(kode + ' (' + anggota.length + ' item) -> ' + modalKirim.tugas.kode);
      } catch (e) { console.error('Gagal scan kirim:', e); alert('Gagal menyimpan. Coba lagi.'); }
    }

    onMounted(async () => { await window.authReady; await muat(); });

    return {
      memuat, kelompokTujuan, daftarTlc, bolehProses, bolehCetak, sedangProses, formatQty,
      popupBagging, bukaCetakBagging, konfirmasiCetakBagging,
      popupTugas, bukaCetakTugas, konfirmasiCetakTugas,
      popupCetakAktif, daftarLabelPreview, jenisCetakAktif,
      modalPack, bukaScanPack, tutupScanPack, hasilScanPack, tutupBagging,
      modalKirim, bukaScanKirim, tutupScanKirim, hasilScanKirim
    };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <template v-else>
      <div v-if="bolehCetak" style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <button @click="bukaCetakBagging" class="btn-outline" style="flex:1; min-width:150px; padding:9px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Kode Bagging</button>
        <button @click="bukaCetakTugas" class="btn-outline" style="flex:1; min-width:150px; padding:9px;"><i class="fas fa-print" style="margin-right:6px;"></i>Cetak Kode Tugas</button>
      </div>
      <div v-if="bolehProses" style="display:flex; gap:8px; margin-bottom:12px;">
        <button @click="bukaScanPack" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Pack</button>
        <button @click="bukaScanKirim" class="btn-primary" style="flex:1; padding:9px;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Scan Kirim</button>
      </div>

      <div v-if="kelompokTujuan.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-box-open"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang tertahan di Perlu Di Kirim</h3>
      </div>

      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="g in kelompokTujuan" :key="g.key" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
          <div class="gc-heading" style="font-weight:700; font-size:12.5px; margin-bottom:8px;">{{ g.label }}</div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div v-for="d in g.docs" :key="d.id" style="display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:11px; padding:6px 8px; border-radius:10px;">
              <span class="gc-num" style="font-weight:700;">{{ d.kode_msl || d.no_spk }}</span>
              <span style="color:var(--text-faint);">{{ d.bahan_nama }} {{ d.bahan_warna }} &middot; {{ formatQty(d.qty_disetujui || d.qty_kurang) }} {{ d.satuan }}</span>
              <span v-if="d.kode_bagging" class="tag ok">{{ d.kode_bagging }}</span>
              <span v-else class="tag neutral">belum di-pack</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <popup-pratinjau-cetak-label :terbuka="popupCetakAktif" judul="Cetak Kode" :daftar-label="daftarLabelPreview" :jenis-cetak="jenisCetakAktif" @tutup="popupCetakAktif = false" />

    <div v-if="popupBagging" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Cetak Kode Bagging</h3>
        <div class="gc-field" style="margin-bottom:8px;"><label>Tujuan</label>
          <select v-model="popupBagging.tujuanKey"><option v-for="g in kelompokTujuan" :key="g.key" :value="g.key">{{ g.label }}</option></select>
        </div>
        <div class="gc-field" style="margin-bottom:14px;"><label>Jumlah Label</label><input v-model.number="popupBagging.jumlah" type="number" min="1"></div>
        <div style="display:flex; gap:8px;">
          <button @click="popupBagging = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiCetakBagging" :disabled="sedangProses" class="btn-primary" style="flex:1; padding:9px;">Cetak</button>
        </div>
      </div>
    </div>

    <div v-if="popupTugas" style="position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
      <div class="gc-card" style="max-width:360px; width:100%; padding:18px; border-radius:18px;">
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; margin:0 0 10px;">Cetak Kode Tugas</h3>
        <div class="gc-field" style="margin-bottom:14px;"><label>Tujuan (TLC)</label>
          <select v-model="popupTugas.tlcTujuan"><option v-for="t in daftarTlc" :key="t.id" :value="t.kode">{{ t.kode }} — {{ t.nama }}</option></select>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="popupTugas = null" class="btn-outline" style="flex:1; padding:9px;">Batal</button>
          <button @click="konfirmasiCetakTugas" :disabled="sedangProses" class="btn-primary" style="flex:1; padding:9px;">Cetak</button>
        </div>
      </div>
    </div>

    <scan-generik :aktif="modalPack.aktif" :judul="modalPack.bagging ? ('Scan baris — bagging ' + modalPack.bagging.kode) : 'Scan Kode Bagging'" subjudul="Bisa discan berkali-kali. Tutup lewat tombol di bawah kalau sudah selesai." @hasil="hasilScanPack" @tutup="tutupScanPack" />
    <div v-if="modalPack.aktif && modalPack.bagging" style="position:fixed; left:16px; bottom:16px; z-index:10001; display:flex; flex-direction:column; gap:8px; max-width:260px;">
      <button @click="tutupBagging" class="btn-primary" style="padding:8px 14px; font-size:11px;">Tutup Bagging Ini</button>
      <div style="background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px;"><div v-for="(l,i) in modalPack.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div></div>
    </div>

    <scan-generik :aktif="modalKirim.aktif" :judul="modalKirim.tugas ? ('Scan kode bagging — tugas ' + modalKirim.tugas.kode) : 'Scan Kode Tugas'" subjudul="Bisa discan berkali-kali (tiap kode bagging = 1 pack)." @hasil="hasilScanKirim" @tutup="tutupScanKirim" />
    <div v-if="modalKirim.aktif && modalKirim.tugas && modalKirim.log.length" style="position:fixed; left:16px; bottom:16px; z-index:10001; background:rgba(0,0,0,.75); border-radius:12px; padding:10px 14px; max-width:260px;">
      <div v-for="(l,i) in modalKirim.log.slice(0,5)" :key="i" style="font-size:10.5px; color:#fff;">{{ l }}</div>
    </div>
  `
};

// ============================================================================
// TAB 6: Sedang Di Kirim — VIEW-ONLY (SAMA seperti pos Bahan tab 4): baris
// keluar dari sini lewat "Scan Sampai" di POS ASAL (pop up 2.1.4 di
// wireframe Bahan), BUKAN dari modul ini — jadi tidak ada tombol aksi.
// ============================================================================
const MasalahSedangDiKirim = {
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    async function muat() {
      memuat.value = true;
      try { daftar.value = await muatMasalahStatus('sedang_dikirim'); }
      catch (e) { console.error('Gagal muat Masalah > Sedang Di Kirim:', e); daftar.value = []; }
      memuat.value = false;
    }
    const kelompokTugas = computed(() => {
      const peta = {};
      daftar.value.forEach(d => {
        const key = d.kode_tugas || '(tanpa kode tugas)';
        if (!peta[key]) peta[key] = { kodeTugas: key, docs: [] };
        peta[key].docs.push(d);
      });
      return Object.values(peta).sort((a, b) => a.kodeTugas.localeCompare(b.kodeTugas));
    });
    onMounted(async () => { await window.authReady; await muat(); });
    return { memuat, kelompokTugas, formatQty, formatDiamSejak };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <div v-else-if="kelompokTugas.length === 0" class="gc-kosong gc-card">
      <div class="lingkaran"><i class="fas fa-truck-fast"></i></div>
      <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0;">Tidak ada yang sedang dikirim</h3>
    </div>

    <div v-else style="display:flex; flex-direction:column; gap:10px;">
      <div v-for="g in kelompokTugas" :key="g.kodeTugas" class="gc-card gc-card-menonjol" style="padding:14px; border-radius:20px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <i class="fas fa-route" style="color:var(--aksen-ink);"></i>
          <span class="gc-num gc-heading" style="font-weight:700; font-size:12.5px;">{{ g.kodeTugas }}</span>
          <span class="tag pink" style="margin-left:auto;">{{ g.docs.length }} item &middot; menunggu diterima pos asal</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:5px;">
          <div v-for="d in g.docs" :key="d.id" style="display:flex; justify-content:space-between; gap:8px; font-size:11px;">
            <span class="gc-num" style="font-weight:700;">{{ d.kode_msl || d.no_spk }}</span>
            <span style="color:var(--text-faint);">{{ d.bahan_nama }} {{ d.bahan_warna }} &middot; {{ formatQty(d.qty_disetujui || d.qty_kurang) }} {{ d.satuan }}</span>
            <span class="gc-num" style="color:var(--text-faint);">{{ d.kode_bagging }}</span>
          </div>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// TAB 7: Selesai — riwayat + KPI. Baris pindah ke sini SAAT POS ASAL scan
// sampai (pop up 2.1.4, BELUM DIBANGUN — dependensi lintas modul yang sama
// seperti Selesai pos Bahan). Sampai modul itu ada, tab ini akan KOSONG
// terus — bukan bug di file ini. "Umur" dihitung scan_pada -> sampai_pada
// (BEDA dari pos Bahan yang pakai label_cetak_pada -> sampai_pada, karena
// di sini yang mau diukur termasuk lama menunggu keputusan Owner di 6.2).
// ============================================================================
const MasalahSelesai = {
  setup() {
    const memuat = ref(true);
    const daftar = ref([]);
    async function muat() {
      memuat.value = true;
      try { daftar.value = await muatMasalahStatus('selesai'); }
      catch (e) { console.error('Gagal muat Masalah > Selesai:', e); daftar.value = []; }
      memuat.value = false;
    }
    const isOperatorSaja = computed(() => (window.currentUser?.role || '').toLowerCase() === 'operator');
    const barisSaya = computed(() => daftar.value.filter(d => d.operator_uid && d.operator_uid === window.currentUser?.email)
      .sort((a, b) => new Date(b.sampai_pada || 0) - new Date(a.sampai_pada || 0)));

    const selesaiHariIni = computed(() => daftar.value.filter(d => hariIniSama(d.sampai_pada)));
    const kpi = computed(() => {
      const list = selesaiHariIni.value;
      const totalMasuk = list.reduce((s, d) => s + (parseFloat(d.entry_qty) || 0), 0);
      const siklusList = list.map(siklusJam).filter(j => j !== null);
      const rataSiklus = siklusList.length ? (siklusList.reduce((a, b) => a + b, 0) / siklusList.length) : null;
      const adaMasalahLagi = list.filter(d => !!d.catatan_masalah).length;
      const operatorSet = new Set(list.map(d => d.operator_uid).filter(Boolean));
      return { selesai: list.length, totalMasuk, rataSiklus, adaMasalahLagi, operatorTerlibat: operatorSet.size };
    });

    const daftarUrut = computed(() => [...daftar.value].sort((a, b) => new Date(b.sampai_pada || 0) - new Date(a.sampai_pada || 0)));
    function keadaan(d) { return d.catatan_masalah ? 'kurang' : 'lengkap'; }

    onMounted(async () => { await window.authReady; await muat(); });

    return { memuat, isOperatorSaja, barisSaya, daftarUrut, kpi, formatQty, formatWaktu, formatSiklus, siklusJam, keadaan };
  },
  template: `
    <div v-if="memuat" class="gc-card gc-card-menonjol" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>

    <template v-else-if="isOperatorSaja">
      <div v-if="barisSaya.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-clock-rotate-left"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0 0 4px;">Belum ada riwayat</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0;">Baris yang pernah Anda scan entry akan muncul di sini setelah tuntas diterima pos asal.</p>
      </div>
      <div v-else style="display:flex; flex-direction:column; gap:8px;">
        <div v-for="d in barisSaya" :key="d.id" class="gc-card gc-card-menonjol" style="padding:12px; border-radius:16px;">
          <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:4px;">
            <span class="gc-num" style="font-weight:700; font-size:12px;">{{ d.kode_msl || d.no_spk }}</span>
            <span class="tag" :class="keadaan(d)==='lengkap' ? 'ok' : 'warn'">{{ keadaan(d) }}</span>
          </div>
          <div style="font-size:10.5px; color:var(--text-faint); margin-bottom:6px;">{{ d.bahan_nama }} {{ d.bahan_warna }} &middot; {{ formatQty(d.entry_qty) }} {{ d.satuan }}</div>
          <div style="display:flex; gap:14px; font-size:10.5px;">
            <div><span style="color:var(--text-faint);">Entry:</span> <span class="gc-num">{{ formatWaktu(d.entry_pada) }}</span></div>
            <div><span style="color:var(--text-faint);">Sampai:</span> <span class="gc-num">{{ formatWaktu(d.sampai_pada) }}</span></div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
        <div style="flex:1; min-width:110px; border:1px dashed var(--line); border-radius:12px; padding:8px 10px; background:var(--ivory-dim);">
          <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Selesai hari ini</div>
          <div class="gc-num" style="font-size:16px; font-weight:700;">{{ kpi.selesai }}</div>
        </div>
        <div style="flex:1; min-width:110px; border:1px dashed var(--line); border-radius:12px; padding:8px 10px; background:var(--ivory-dim);">
          <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Total masuk</div>
          <div class="gc-num" style="font-size:16px; font-weight:700;">{{ formatQty(kpi.totalMasuk) }}</div>
        </div>
        <div style="flex:1; min-width:110px; border:1px dashed var(--line); border-radius:12px; padding:8px 10px; background:var(--ivory-dim);">
          <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Rata-rata umur</div>
          <div class="gc-num" style="font-size:16px; font-weight:700;">{{ formatSiklus(kpi.rataSiklus) }}</div>
        </div>
        <div style="flex:1; min-width:110px; border:1px dashed var(--line); border-radius:12px; padding:8px 10px; background:var(--ivory-dim);">
          <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Masalah lagi</div>
          <div class="gc-num" :style="{ fontSize:'16px', fontWeight:700, color: kpi.adaMasalahLagi ? 'var(--warn)' : 'inherit' }">{{ kpi.adaMasalahLagi }}</div>
        </div>
        <div style="flex:1; min-width:110px; border:1px dashed var(--line); border-radius:12px; padding:8px 10px; background:var(--ivory-dim);">
          <div style="font-size:9.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:.04em;">Operator terlibat</div>
          <div class="gc-num" style="font-size:16px; font-weight:700;">{{ kpi.operatorTerlibat }}</div>
        </div>
      </div>

      <div v-if="daftarUrut.length === 0" class="gc-kosong gc-card">
        <div class="lingkaran"><i class="fas fa-circle-check"></i></div>
        <h3 class="gc-heading" style="font-size:13px; font-weight:700; margin:0 0 4px;">Belum ada yang selesai</h3>
        <p style="font-size:11px; color:var(--text-faint); margin:0;">Baris masuk ke sini otomatis saat pos asal Scan Sampai — bukan saat pos ini Scan Kirim.</p>
      </div>

      <div v-else class="gc-table-scroll">
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead>
            <tr style="text-align:left; color:var(--text-faint); border-bottom:1px solid var(--line);">
              <th style="padding:6px 8px;">Kode</th>
              <th style="padding:6px 8px;">Bahan</th>
              <th style="padding:6px 8px;">Entry</th>
              <th style="padding:6px 8px;">Disiapkan oleh</th>
              <th style="padding:6px 8px;">Pack</th>
              <th style="padding:6px 8px;">Tujuan TLC</th>
              <th style="padding:6px 8px;">Sampai</th>
              <th style="padding:6px 8px;">Umur</th>
              <th style="padding:6px 8px;">Keadaan</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in daftarUrut" :key="d.id" style="border-bottom:1px solid var(--line);">
              <td style="padding:6px 8px;">
                <div class="gc-num" style="font-weight:700;">{{ d.kode_msl || d.no_spk }}</div>
                <div style="font-size:9.5px; color:var(--text-faint);">scan {{ formatWaktu(d.scan_pada) }}</div>
              </td>
              <td style="padding:6px 8px;">{{ d.bahan_nama }} {{ d.bahan_warna }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatWaktu(d.entry_pada) }}</td>
              <td style="padding:6px 8px;">{{ d.operator_nama || '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ d.kode_bagging || '-' }}</td>
              <td style="padding:6px 8px;">{{ d.tlc_tujuan || '-' }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatWaktu(d.sampai_pada) }}</td>
              <td style="padding:6px 8px;" class="gc-num">{{ formatSiklus(siklusJam(d)) }}</td>
              <td style="padding:6px 8px;"><span class="tag" :class="keadaan(d)==='lengkap' ? 'ok' : 'warn'">{{ keadaan(d) }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  `
};

// --- Mount ke index.html — LAZY, SAMA pola seperti 4 pos lain: fungsi
// window.pastikanMountPpMasalahXxx() dipanggil oleh pindahSubTab() (js/
// dashboard.js, peta petaMount) PERTAMA KALI tab itu dibuka. ---------------
let vmPpMasalahPerluDiajukan = null;
window.pastikanMountPpMasalahPerluDiajukan = function () {
  if (vmPpMasalahPerluDiajukan) return;
  const mountPoint = document.getElementById('vue-pp-masalah-perludiajukan');
  if (mountPoint) vmPpMasalahPerluDiajukan = createApp(MasalahPerluDiajukan).mount('#vue-pp-masalah-perludiajukan');
};
let vmPpMasalahMenungguSetuju = null;
window.pastikanMountPpMasalahMenungguSetuju = function () {
  if (vmPpMasalahMenungguSetuju) return;
  const mountPoint = document.getElementById('vue-pp-masalah-menunggusetuju');
  if (mountPoint) vmPpMasalahMenungguSetuju = createApp(MasalahMenungguSetuju).mount('#vue-pp-masalah-menunggusetuju');
};
let vmPpMasalahPerluDisiapkan = null;
window.pastikanMountPpMasalahPerluDisiapkan = function () {
  if (vmPpMasalahPerluDisiapkan) return;
  const mountPoint = document.getElementById('vue-pp-masalah-perludisiapkan');
  if (mountPoint) vmPpMasalahPerluDisiapkan = createApp(MasalahPerluDisiapkan).mount('#vue-pp-masalah-perludisiapkan');
};
let vmPpMasalahSedangDisiapkan = null;
window.pastikanMountPpMasalahSedangDisiapkan = function () {
  if (vmPpMasalahSedangDisiapkan) return;
  const mountPoint = document.getElementById('vue-pp-masalah-sedangdisiapkan');
  if (mountPoint) vmPpMasalahSedangDisiapkan = createApp(MasalahSedangDisiapkan).mount('#vue-pp-masalah-sedangdisiapkan');
};
let vmPpMasalahPerluDiKirim = null;
window.pastikanMountPpMasalahPerluDiKirim = function () {
  if (vmPpMasalahPerluDiKirim) return;
  const mountPoint = document.getElementById('vue-pp-masalah-perludikirim');
  if (mountPoint) vmPpMasalahPerluDiKirim = createApp(MasalahPerluDiKirim).mount('#vue-pp-masalah-perludikirim');
};
let vmPpMasalahSedangDiKirim = null;
window.pastikanMountPpMasalahSedangDiKirim = function () {
  if (vmPpMasalahSedangDiKirim) return;
  const mountPoint = document.getElementById('vue-pp-masalah-sedangdikirim');
  if (mountPoint) vmPpMasalahSedangDiKirim = createApp(MasalahSedangDiKirim).mount('#vue-pp-masalah-sedangdikirim');
};
let vmPpMasalahSelesai = null;
window.pastikanMountPpMasalahSelesai = function () {
  if (vmPpMasalahSelesai) return;
  const mountPoint = document.getElementById('vue-pp-masalah-selesai');
  if (mountPoint) vmPpMasalahSelesai = createApp(MasalahSelesai).mount('#vue-pp-masalah-selesai');
};
