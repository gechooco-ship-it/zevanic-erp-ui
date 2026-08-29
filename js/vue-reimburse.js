// js/vue-reimburse.js
// ============================================================================
// Fitur Reimburse — persetujuan berjenjang 3 tahap (rencana Hilman, 19 Agt
// 2026): Operator ajukan -> Admin Finance (role admin) ACC -> PIC (role
// pic) ACC -> Owner ACC (final).
//
// DESAIN KUNCI: 1 field `tahap` di dokumen `reimburse` yang jadi penanda
// tunggal ada di posisi mana pengajuannya — BUKAN 3 field status terpisah
// kayak Absensi masuk/keluar. Alasannya beda dari Absensi: di Reimburse
// SELALU cuma 1 tahap yang aktif di satu waktu (berurutan/sequential,
// tidak pernah 2 tahap sekaligus pending kayak Clock In+Out yang memang
// BISA bersamaan). Query jadi sesederhana where('tahap','==', tahapSaya).
//
// PENTING: ini fitur PERTAMA di seluruh app yang bikin role 'admin' dan
// 'pic' BENERAN beda perilaku (sebelumnya SELALU disamakan lewat
// isAdminLevel() — lihat diskusi sebelumnya di STATUS-PROYEK.md).
// 'admin' = Admin Finance (validator tahap 1), 'pic' = PIC (validator
// tahap 2). Keduanya di-scope ke jenis_pekerjaan+gudang (window.bolehLihatData,
// PERSIS pola yang sudah baku dipakai di Antrean Absensi/Lembur/Dakar.
//
// Keamanan SEBENARNYA (anti-loncat-tahap) ada di firestore.rules —
// bagian sini cuma UI, kalau ada yang nekat panggil updateDoc() langsung
// dari Console browser, Firestore Rules yang jadi penjaga terakhir.
// ============================================================================
import { createApp, ref, reactive, computed, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { MasterDataCategory, KolomCari } from './vue-components.js?v=5';
import { pakaiRiwayatTabVue } from './vue-riwayat-tab.js?v=1';

// Kompresi gambar sisi klien — pola SAMA seperti js/camera.js (foto KTP),
// disalin di sini (bukan diimpor) karena kompresGambar di camera.js
// tidak di-export ke window, cuma dipakai internal file itu.
function kompresGambarReimburse(file, maxDimensi, kualitas) {
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
      img.onerror = () => reject(new Error("Gagal memuat gambar."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}

// Diekspor juga (dipakai test + dipakai ulang di kartu antrean) — tentukan
// tahap SELANJUTNYA berdasar tahap SEKARANG + keputusan Accept/Reject.
export function tahapSelanjutnya(tahapSekarang, disetujui) {
  const alur = { menunggu_admin_finance: 'menunggu_pic', menunggu_pic: 'menunggu_owner', menunggu_owner: 'disetujui' };
  if (!disetujui) return 'ditolak';
  return alur[tahapSekarang] || null; // null = tahap tidak dikenal, jangan diproses
}

// Diekspor juga — field mana yang bertanggung jawab di tahap SEKARANG
// (dipakai buat validated_by_xxx/validated_at_xxx).
export function namaValidatorTahap(tahapSekarang) {
  const peta = { menunggu_admin_finance: 'admin_finance', menunggu_pic: 'pic', menunggu_owner: 'owner' };
  return peta[tahapSekarang] || null;
}

// Diekspor juga — role APA yang berwenang di tahap SEKARANG (dipakai
// cocokkan window.currentUser.role, DUPLIKAT sengaja dari firestore.rules
// supaya tombol Accept/Reject di UI cuma tampil buat yang benar berhak,
// walau penjaga SEBENARNYA tetap Rules — ini cuma cegah orang bingung
// lihat tombol yang toh bakal ditolak server).
export function rolesBolehProses(tahapSekarang) {
  const peta = {
    menunggu_admin_finance: ['admin', 'owner', 'superuser'],
    menunggu_pic: ['pic', 'owner', 'superuser'],
    menunggu_owner: ['owner', 'superuser']
  };
  return peta[tahapSekarang] || [];
}

export function formatRupiah(angka) {
  return 'Rp' + Number(angka || 0).toLocaleString('id-ID');
}

const LABEL_TAHAP = {
  menunggu_admin_finance: 'Menunggu Admin Finance',
  menunggu_pic: 'Sudah ACC Admin Finance — Menunggu PIC',
  menunggu_owner: 'Sudah ACC PIC — Menunggu Owner',
  disetujui: 'Disetujui (Selesai)',
  ditolak: 'Ditolak'
};
function warnaTahap(tahap) {
  if (tahap === 'disetujui') return 'ok';
  if (tahap === 'ditolak') return 'danger';
  return 'warn';
}

// ============================================================================
// KOMPONEN 1 — Tab "Ajukan Reimburse" (dipasang di Account Profile,
// diimpor & didaftarkan di vue-account-profile.js, BUKAN app mandiri).
// ============================================================================
export const AjukanReimburseTab = {
  setup() {
    const opsiKategori = ref([]);
    // DIROMBAK (29 Agt 2026, moodboard "Gechoo Mobile Organic" v2,
    // permintaan Guru) — 1 field kmSaatIsi (odometer tunggal) GANTI jadi
    // 3 field: odoSebelum, odoSesudah (rentang trip SEJAK isi bensin
    // terakhir) + literBensin (jumlah BBM dibeli), dipakai hitung
    // efisiensi (km/L) di ReimburseCard. Rumus & sumbernya lihat
    // STATUS-PROYEK.md / mockup gechoo-mobile-organic-rollout.html
    // (dicari referensinya ke Auto2000, BUKAN tebakan).
    const form = reactive({
      kategori: '', jumlah: '', keterangan: '', fotoBukti: '', gudang: '',
      kendaraanId: '', odoSebelum: '', odoSesudah: '', literBensin: '',
      itemServis: [{ namaBarang: '', qty: 1, harga: '' }]
    });
    const opsiGudangSaya = window.normalisasiGudang ? window.normalisasiGudang(window.currentUser.gudang_penempatan) : (window.currentUser.gudang_penempatan || []);
    if (opsiGudangSaya.length === 1) form.gudang = opsiGudangSaya[0]; // 1 gudang saja -> otomatis

    // BARU (19 Agt 2026, permintaan Hilman) — cuma kendaraan yang
    // DIKAITKAN ke SAYA SENDIRI (via supir_pemegang di Master Kendaraan)
    // yang muncul di sini. Kalau tidak dikaitkan ke kendaraan APAPUN,
    // seluruh bagian "Jenis Pengajuan/Bensin/Servis" TIDAK tampil sama
    // sekali — cuma dapat form Reimburse Umum biasa.
    const kendaraanSaya = ref([]);
    const jenisPengajuan = ref('umum'); // 'umum' | 'bensin' | 'servis'
    // Tab internal genuine (saklar Umum/Bensin/Servis dalam 1 komponen) —
    // di-wire ke riwayat tombol back HP (§39, lihat js/vue-riwayat-tab.js).
    pakaiRiwayatTabVue('reimburse-mode', jenisPengajuan);

    async function muatKendaraanSaya() {
      try {
        const snap = await getDocs(collection(db, "master_kendaraan"));
        const list = [];
        snap.forEach(d => {
          const data = d.data();
          const supirArr = Array.isArray(data.supir_pemegang) ? data.supir_pemegang
            : (data.supir_pemegang_email ? [{ email: data.supir_pemegang_email }] : []);
          if (supirArr.some(s => s.email === window.currentUser.email)) list.push({ id: d.id, plat_nomor: data.plat_nomor, nama_kendaraan: data.nama_kendaraan });
        });
        kendaraanSaya.value = list;
        // 1 kendaraan saja -> otomatis terpilih, tidak perlu ganggu orang
        // milih (permintaan eksplisit: "gak usah isi plat nomor kecuali
        // dia multi mobil").
        if (list.length === 1) form.kendaraanId = list[0].id;
      } catch (e) {
        console.error("Gagal muat kendaraan milik saya:", e);
      }
    }

    const mengirim = ref(false);
    const riwayatSaya = ref([]);
    const memuatRiwayat = ref(true);

    async function muatOpsiKategori() {
      opsiKategori.value = window.ambilMasterList ? await window.ambilMasterList('kategori_reimburse') : [];
      if (opsiKategori.value.length > 0 && !form.kategori) form.kategori = opsiKategori.value[0];
    }

    function pilihFoto(event) {
      const file = event.target.files[0];
      if (!file) return;
      kompresGambarReimburse(file, 1000, 0.75)
        .then(dataUrl => { form.fotoBukti = dataUrl; })
        .catch(e => { console.error("Gagal proses foto bukti:", e); alert("Gagal memproses foto, coba foto lain."); });
    }

    async function muatRiwayatSaya() {
      memuatRiwayat.value = true;
      try {
        const snap = await getDocs(query(collection(db, "reimburse"), where("email", "==", window.currentUser.email)));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.diajukan_pada?.toDate?.().getTime() || 0) - (a.diajukan_pada?.toDate?.().getTime() || 0));
        riwayatSaya.value = list;
      } catch (e) {
        console.error("Gagal muat riwayat reimburse saya:", e);
      }
      memuatRiwayat.value = false;
    }

    // ---- Item Servis (bisa nambah baris terus ke bawah) ----
    function tambahBarisServis() { form.itemServis.push({ namaBarang: '', qty: 1, harga: '' }); }
    function hapusBarisServis(idx) {
      if (form.itemServis.length <= 1) return; // minimal 1 baris tetap ada
      form.itemServis.splice(idx, 1);
    }
    function jumlahBarisServis(item) {
      const qty = parseInt(item.qty) || 0;
      const harga = parseInt(String(item.harga).replace(/\D/g, '')) || 0;
      return qty * harga;
    }
    const totalServis = computed(() => form.itemServis.reduce((sum, item) => sum + jumlahBarisServis(item), 0));

    function resetForm() {
      form.jumlah = ''; form.keterangan = ''; form.fotoBukti = '';
      form.odoSebelum = ''; form.odoSesudah = ''; form.literBensin = '';
      form.itemServis = [{ namaBarang: '', qty: 1, harga: '' }];
      if (opsiKategori.value.length > 0) form.kategori = opsiKategori.value[0];
      jenisPengajuan.value = 'umum';
    }

    async function ajukan() {
      if (opsiGudangSaya.length > 0 && !form.gudang) return alert("Pilih gudang yang relevan buat pengajuan ini dulu.");
      if (!form.fotoBukti) return alert("Foto bukti/struk wajib dilampirkan.");

      let dataKirim = {
        email: window.currentUser.email,
        nama_pegawai: window.currentUser.name,
        jenis_pekerjaan: window.currentUser.jenis_pekerjaan || '',
        gudang: form.gudang || '',
        keterangan: form.keterangan || '',
        foto_bukti: form.fotoBukti,
        tahap: 'menunggu_admin_finance',
        diajukan_pada: serverTimestamp()
      };

      if (jenisPengajuan.value === 'bensin') {
        if (!form.kendaraanId) return alert("Pilih kendaraan dulu.");
        const jumlahAngka = parseInt(String(form.jumlah).replace(/\D/g, ''), 10);
        if (!jumlahAngka || jumlahAngka <= 0) return alert("Isi jumlah reimburse yang benar (harus lebih dari 0).");
        const odoSebelumAngka = parseInt(form.odoSebelum, 10) || 0;
        const odoSesudahAngka = parseInt(form.odoSesudah, 10) || 0;
        if (!odoSebelumAngka || !odoSesudahAngka) return alert("Isi Odometer Sebelum & Sesudah mengisi bensin.");
        if (odoSesudahAngka <= odoSebelumAngka) return alert("Odometer Sesudah harus lebih besar dari Odometer Sebelum.");
        const literAngka = parseFloat(String(form.literBensin).replace(',', '.'));
        if (!literAngka || literAngka <= 0) return alert("Isi jumlah BBM yang dibeli (liter) dengan benar.");
        const kendaraanDipilih = kendaraanSaya.value.find(k => k.id === form.kendaraanId);
        dataKirim = {
          ...dataKirim,
          kategori: 'BBM', jenis_entry_kendaraan: 'bensin',
          jumlah: jumlahAngka,
          odo_sebelum: odoSebelumAngka, odo_sesudah: odoSesudahAngka, liter_bensin: literAngka,
          kendaraan_id: form.kendaraanId, kendaraan_plat: kendaraanDipilih ? kendaraanDipilih.plat_nomor : ''
        };
      } else if (jenisPengajuan.value === 'servis') {
        if (!form.kendaraanId) return alert("Pilih kendaraan dulu.");
        const itemValid = form.itemServis.filter(i => i.namaBarang.trim() && parseInt(i.qty) > 0 && jumlahBarisServis(i) > 0);
        if (itemValid.length === 0) return alert("Isi minimal 1 item servis dengan lengkap (nama barang, qty, harga).");
        const kendaraanDipilih = kendaraanSaya.value.find(k => k.id === form.kendaraanId);
        dataKirim = {
          ...dataKirim,
          kategori: 'Servis Kendaraan', jenis_entry_kendaraan: 'servis',
          jumlah: totalServis.value,
          item_servis: itemValid.map(i => ({ nama_barang: i.namaBarang.trim(), qty: parseInt(i.qty) || 0, harga: parseInt(String(i.harga).replace(/\D/g, '')) || 0, jumlah: jumlahBarisServis(i) })),
          kendaraan_id: form.kendaraanId, kendaraan_plat: kendaraanDipilih ? kendaraanDipilih.plat_nomor : ''
        };
      } else {
        if (!form.kategori) return alert("Pilih kategori pengeluaran dulu.");
        const jumlahAngka = parseInt(String(form.jumlah).replace(/\D/g, ''), 10);
        if (!jumlahAngka || jumlahAngka <= 0) return alert("Isi jumlah reimburse yang benar (harus lebih dari 0).");
        dataKirim = { ...dataKirim, kategori: form.kategori, jumlah: jumlahAngka };
      }

      mengirim.value = true;
      try {
        await addDoc(collection(db, "reimburse"), dataKirim);
        alert("Pengajuan reimburse berhasil dikirim, menunggu ACC Admin Finance.");
        resetForm();
        await muatRiwayatSaya();
      } catch (e) {
        console.error("Gagal ajukan reimburse:", e);
        alert("Gagal mengirim pengajuan. Coba lagi, atau hubungi Admin kalau terus gagal.");
      }
      mengirim.value = false;
    }

    function lihatFotoBesar(url) {
      if (url && window.bukaPreviewFoto) window.bukaPreviewFoto(url);
    }

    onMounted(async () => { await window.authReady; await muatOpsiKategori(); await muatKendaraanSaya(); await muatRiwayatSaya(); });
    return {
      opsiKategori, form, mengirim, pilihFoto, ajukan, lihatFotoBesar, opsiGudangSaya,
      kendaraanSaya, jenisPengajuan, tambahBarisServis, hapusBarisServis, jumlahBarisServis, totalServis,
      riwayatSaya, memuatRiwayat, LABEL_TAHAP, warnaTahap, formatRupiah
    };
  },
  template: `
    <div>
      <div class="gc-card" style="max-width:520px; margin:0 auto 16px;">
        <h4 class="gc-heading" style="font-weight:700; font-size:13px; margin-bottom:14px;"><i class="fas fa-receipt" style="color:var(--burgundy); margin-right:8px;"></i> Ajukan Reimburse Baru</h4>

        <div class="gc-field" v-if="opsiGudangSaya.length > 1">
          <label>Gudang <span style="color:var(--danger);">*</span> (Anda ditempatkan di beberapa gudang, pilih yang relevan buat pengajuan ini)</label>
          <select v-model="form.gudang">
            <option value="" disabled>Pilih gudang...</option>
            <option v-for="g in opsiGudangSaya" :key="g" :value="g">{{ g }}</option>
          </select>
        </div>

        <div class="gc-field" v-if="kendaraanSaya.length > 0">
          <label>Jenis Pengajuan</label>
          <div style="display:flex; gap:6px;">
            <button type="button" @click="jenisPengajuan = 'umum'" :class="{ active: jenisPengajuan === 'umum' }" class="gc-sub-tab-btn" style="flex:1; font-size:11px; padding:8px 4px;">Umum</button>
            <button type="button" @click="jenisPengajuan = 'bensin'" :class="{ active: jenisPengajuan === 'bensin' }" class="gc-sub-tab-btn" style="flex:1; font-size:11px; padding:8px 4px;"><i class="fas fa-gas-pump" style="margin-right:4px;"></i>Bensin</button>
            <button type="button" @click="jenisPengajuan = 'servis'" :class="{ active: jenisPengajuan === 'servis' }" class="gc-sub-tab-btn" style="flex:1; font-size:11px; padding:8px 4px;"><i class="fas fa-wrench" style="margin-right:4px;"></i>Servis</button>
          </div>
        </div>

        <!-- ============ BENSIN ============ -->
        <template v-if="jenisPengajuan === 'bensin' && kendaraanSaya.length > 0">
          <div class="gc-field" v-if="kendaraanSaya.length > 1">
            <label>Kendaraan</label>
            <select v-model="form.kendaraanId"><option value="" disabled>Pilih kendaraan...</option><option v-for="k in kendaraanSaya" :key="k.id" :value="k.id">{{ k.plat_nomor }}{{ k.nama_kendaraan ? ' - ' + k.nama_kendaraan : '' }}</option></select>
          </div>
          <p v-else style="font-size:11.5px; color:var(--text-muted); background:var(--ivory-dim); padding:8px 12px; border-radius:10px; margin-bottom:12px;"><i class="fas fa-truck" style="margin-right:6px;"></i>Kendaraan: <b>{{ kendaraanSaya[0].plat_nomor }}</b></p>
          <!-- DIROMBAK (29 Agt 2026 v2) — KM (Odometer) Saat Mengisi TUNGGAL
               diganti 2 field (Sebelum/Sesudah) + Liter Dibeli, dipakai
               ReimburseCard hitung efisiensi BBM (km/L) otomatis. -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div class="gc-field">
              <label>Odometer Sebelum (km)</label>
              <input v-model="form.odoSebelum" type="number" min="1" placeholder="Contoh: 45120">
            </div>
            <div class="gc-field">
              <label>Odometer Sesudah (km)</label>
              <input v-model="form.odoSesudah" type="number" min="1" placeholder="Contoh: 45320">
            </div>
          </div>
          <div class="gc-field">
            <label>BBM Dibeli (liter)</label>
            <input v-model="form.literBensin" type="number" min="0.1" step="0.1" placeholder="Contoh: 10">
          </div>
          <div class="gc-field">
            <label>Jumlah (Rp)</label>
            <input v-model="form.jumlah" type="number" min="1" placeholder="Contoh: 100000">
          </div>
        </template>

        <!-- ============ SERVIS ============ -->
        <template v-else-if="jenisPengajuan === 'servis' && kendaraanSaya.length > 0">
          <div class="gc-field" v-if="kendaraanSaya.length > 1">
            <label>Kendaraan</label>
            <select v-model="form.kendaraanId"><option value="" disabled>Pilih kendaraan...</option><option v-for="k in kendaraanSaya" :key="k.id" :value="k.id">{{ k.plat_nomor }}{{ k.nama_kendaraan ? ' - ' + k.nama_kendaraan : '' }}</option></select>
          </div>
          <p v-else style="font-size:11.5px; color:var(--text-muted); background:var(--ivory-dim); padding:8px 12px; border-radius:10px; margin-bottom:12px;"><i class="fas fa-truck" style="margin-right:6px;"></i>Kendaraan: <b>{{ kendaraanSaya[0].plat_nomor }}</b></p>
          <label style="font-size:12.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Rincian Item Servis</label>
          <div v-for="(item, idx) in form.itemServis" :key="idx" style="display:flex; gap:6px; margin-bottom:8px; align-items:center;">
            <input v-model="item.namaBarang" type="text" placeholder="Nama barang/jasa" style="flex:2; padding:7px 9px; border:1.5px solid var(--line); border-radius:8px; font-size:11.5px;">
            <input v-model="item.qty" type="number" min="1" placeholder="Qty" style="width:50px; padding:7px 9px; border:1.5px solid var(--line); border-radius:8px; font-size:11.5px;">
            <input v-model="item.harga" type="number" min="0" placeholder="Harga" style="width:90px; padding:7px 9px; border:1.5px solid var(--line); border-radius:8px; font-size:11.5px;">
            <span style="font-size:10.5px; color:var(--text-faint); width:70px; text-align:right;">{{ formatRupiah(jumlahBarisServis(item)) }}</span>
            <button type="button" @click="hapusBarisServis(idx)" :disabled="form.itemServis.length <= 1" style="background:none; border:none; color:var(--danger); cursor:pointer; padding:4px;"><i class="fas fa-times"></i></button>
          </div>
          <button type="button" @click="tambahBarisServis" style="font-size:11px; color:var(--burgundy); background:none; border:1px dashed var(--line); border-radius:8px; padding:6px 12px; cursor:pointer; margin-bottom:12px;"><i class="fas fa-plus" style="margin-right:5px;"></i>Tambah Item</button>
          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--ivory-dim); padding:10px 14px; border-radius:10px; margin-bottom:14px;">
            <span style="font-size:12px; font-weight:700;">Total</span>
            <b style="font-size:14px; color:var(--burgundy);">{{ formatRupiah(totalServis) }}</b>
          </div>
        </template>

        <!-- ============ UMUM (default, atau tidak dikaitkan kendaraan apapun) ============ -->
        <template v-else>
          <div class="gc-field">
            <label>Kategori Pengeluaran</label>
            <select v-model="form.kategori"><option v-for="k in opsiKategori" :key="k" :value="k">{{ k }}</option></select>
          </div>
          <div class="gc-field">
            <label>Jumlah (Rp)</label>
            <input v-model="form.jumlah" type="number" min="1" placeholder="Contoh: 50000">
          </div>
        </template>

        <div class="gc-field">
          <label>Keterangan</label>
          <textarea v-model="form.keterangan" rows="2" placeholder="Contoh: BBM antar barang ke SOG12"></textarea>
        </div>
        <div class="gc-field">
          <label>Foto Bukti / Struk *</label>
          <input type="file" accept="image/*" capture="environment" @change="pilihFoto">
          <img v-if="form.fotoBukti" :src="form.fotoBukti" style="margin-top:8px; width:100px; height:100px; object-fit:cover; border-radius:12px; border:1px solid var(--line);">
        </div>
        <button @click="ajukan" :disabled="mengirim" class="btn-primary block" style="margin-top:6px;">
          <i class="fas fa-paper-plane" style="margin-right:6px;"></i>{{ mengirim ? 'Mengirim...' : 'Ajukan Reimburse' }}
        </button>
      </div>

      <h4 class="gc-heading" style="font-weight:700; font-size:12.5px; margin-bottom:10px;">Riwayat Pengajuan Saya</h4>
      <div v-if="memuatRiwayat" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
      <div v-else-if="riwayatSaya.length === 0" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px; background:var(--surface); border:1px dashed var(--line); border-radius:14px;">Belum pernah mengajukan reimburse.</div>
      <div v-else style="display:flex; flex-direction:column; gap:10px;">
        <div v-for="r in riwayatSaya" :key="r.id" class="gc-card" style="padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
            <div>
              <b style="font-size:12.5px;">{{ r.kategori }}</b>
              <p v-if="r.kendaraan_plat" style="font-size:10.5px; color:var(--text-faint); margin-top:1px;"><i class="fas fa-truck" style="margin-right:4px;"></i>{{ r.kendaraan_plat }}<span v-if="r.odo_sebelum && r.odo_sesudah"> &middot; {{ r.odo_sebelum.toLocaleString('id-ID') }}&rarr;{{ r.odo_sesudah.toLocaleString('id-ID') }} km</span><span v-else-if="r.km_saat_isi"> &middot; {{ r.km_saat_isi.toLocaleString('id-ID') }} km</span></p>
              <p style="font-size:11px; color:var(--text-muted); margin-top:2px;">{{ r.keterangan || '-' }}</p>
            </div>
            <b style="font-size:13px; white-space:nowrap;">{{ formatRupiah(r.jumlah) }}</b>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
            <span class="tag" :class="warnaTahap(r.tahap)">{{ LABEL_TAHAP[r.tahap] || r.tahap }}</span>
            <img v-if="r.foto_bukti" :src="r.foto_bukti" @click="lihatFotoBesar(r.foto_bukti)" style="width:32px; height:32px; object-fit:cover; border-radius:8px; cursor:pointer;">
          </div>
        </div>
      </div>
    </div>
  `
};

// ============================================================================
// KOMPONEN 2 — Kartu antrean (dipakai Admin Finance/PIC/Owner, tombolnya
// SAMA untuk ketiganya, tapi cuma efektif kalau role-nya cocok dengan
// tahap dokumen ini — dijaga rolesBolehProses() + firestore.rules).
// ============================================================================
const ReimburseCard = {
  props: { docId: { type: String, required: true }, data: { type: Object, required: true } },
  emits: ['diproses'],
  setup(props, { emit }) {
    const memproses = ref(false);
    // BARU (19 Agt 2026) — cerminan larangan self-approval yang SEBENARNYA
    // dijaga firestore.rules (lihat catatan di sana). Di sini cuma
    // supaya tombol Accept/Reject TIDAK MUNCUL buat pengajuan sendiri
    // (bukan muncul lalu ditolak server, pengalaman lebih jelas).
    const punyaSendiri = computed(() => props.data.email === window.currentUser.email);
    const bolehProses = computed(() => {
      if (punyaSendiri.value) return false;
      return rolesBolehProses(props.data.tahap).includes((window.currentUser.role || '').toLowerCase());
    });

    function lihatFotoBesar() {
      if (props.data.foto_bukti && window.bukaPreviewFoto) window.bukaPreviewFoto(props.data.foto_bukti);
    }

    // BARU (29 Agt 2026, moodboard "Gechoo Mobile Organic" v2, permintaan
    // Guru) — efisiensi BBM (km/L) dihitung LANGSUNG di UI dari
    // odo_sebelum/odo_sesudah/liter_bensin (field baru, isi manual saat
    // pengajuan — lihat AjukanReimburseTab), TIDAK disimpan field
    // terpisah di Firestore. Rumus: Jarak Tempuh (Odo Sesudah - Odo
    // Sebelum) / Liter Dibeli — metode "isi penuh ke isi penuh", DICARI
    // referensinya (bukan tebakan): https://auto2000.co.id/berita-dan-tips/cara-menghitung-bensin-mobil-per-kilometer
    const efisiensiBBM = computed(() => {
      const d = props.data;
      if (d.jenis_entry_kendaraan !== 'bensin' || !d.odo_sebelum || !d.odo_sesudah || !d.liter_bensin) return null;
      const jarak = d.odo_sesudah - d.odo_sebelum;
      if (jarak <= 0 || d.liter_bensin <= 0) return null;
      return Math.round((jarak / d.liter_bensin) * 10) / 10; // 1 desimal
    });

    // Tanggal polos ("29 Agt 2026") gantikan label "Diajukan" di depan
    // tanggal (permintaan Guru — labelnya dilepas, tanggalnya tetap ada).
    function formatTgl(ts) {
      if (!ts || !ts.toDate) return '-';
      return ts.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    async function proses(disetujui) {
      const tahapBaru = tahapSelanjutnya(props.data.tahap, disetujui);
      const namaValidator = namaValidatorTahap(props.data.tahap);
      if (!tahapBaru || !namaValidator) return; // tahap tidak dikenal/sudah final, jangan proses apapun

      memproses.value = true;
      try {
        const dataUpdate = {
          tahap: tahapBaru,
          [`validated_by_${namaValidator}`]: window.currentUser.name || window.currentUser.email,
          [`validated_at_${namaValidator}`]: serverTimestamp()
        };
        if (!disetujui) dataUpdate.ditolak_di_tahap = namaValidator;
        await updateDoc(doc(db, "reimburse", props.docId), dataUpdate);
        emit('diproses');
      } catch (e) {
        console.error("Gagal proses reimburse:", e);
        alert("Terjadi kesalahan sistem saat memproses. Kalau ini terus terjadi, mungkin Anda tidak berwenang di tahap ini.");
      }
      memproses.value = false;
    }

    return { memproses, bolehProses, punyaSendiri, lihatFotoBesar, proses, efisiensiBBM, formatTgl, formatRupiah, LABEL_TAHAP, warnaTahap };
  },
  // ==========================================================================
  // TEMPLATE DIROMBAK (29 Agt 2026, moodboard "Gechoo Mobile Organic" v2,
  // dari mockup gechoo-mobile-organic-rollout.html §Reimburse) — foto bukti
  // (dulu thumbnail besar terpisah 64x64) jadi ikon kecil di header kartu
  // (38x38, tetap bisa diklik lihat besar); label "Diajukan" dilepas,
  // tanggal polos langsung ("29 Agt 2026"); Accept/Reject ikut
  // .approve-row ("Setuju"/"Tolak"). Rincian Servis TETAP (nol perubahan).
  // Badge tahap TETAP jadi info utama (paling penting di modul ini).
  // Khusus kategori Isi Bensin: blok Odometer + badge efisiensi (km/L)
  // BARU. Logic Firestore 3-tahap tahapSelanjutnya()/proses() TIDAK
  // disentuh sama sekali.
  // ==========================================================================
  template: `
    <div class="gc-card" style="border-radius:20px;">
      <div style="display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--ivory-dim); padding-bottom:10px; margin-bottom:10px;">
        <div v-if="!data.foto_bukti" style="width:38px; height:38px; border-radius:14px; background:var(--ivory-dim); flex-shrink:0; display:flex; align-items:center; justify-content:center; color:var(--text-faint);"><i class="fas fa-receipt"></i></div>
        <img v-else :src="data.foto_bukti" @click="lihatFotoBesar" style="width:38px; height:38px; border-radius:14px; object-fit:cover; border:1px solid var(--line); cursor:pointer; flex-shrink:0;">
        <div style="flex:1; min-width:0;">
          <h4 class="gc-heading" style="font-weight:700; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ data.nama_pegawai || 'Karyawan' }}</h4>
          <p style="font-size:9.5px; color:var(--text-faint); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ data.gudang || '-' }} &middot; {{ data.kategori || '-' }}</p>
        </div>
        <span class="tag" :class="warnaTahap(data.tahap)" style="flex-shrink:0;">{{ LABEL_TAHAP[data.tahap] || data.tahap }}</span>
      </div>

      <div style="display:flex; align-items:center; gap:8px; padding:2px 0 6px;">
        <span style="font-size:9.5px; color:var(--text-faint);">{{ formatTgl(data.diajukan_pada) }}</span>
        <span style="font-size:12px; color:var(--burgundy); font-weight:800; margin-left:auto;">{{ formatRupiah(data.jumlah) }}<span v-if="data.jenis_entry_kendaraan === 'bensin' && data.liter_bensin"> &middot; {{ data.liter_bensin }}L</span></span>
      </div>

      <div v-if="data.kendaraan_plat" style="font-size:9.5px; color:var(--text-faint); padding-bottom:4px;"><i class="fas fa-truck" style="margin-right:4px;"></i>{{ data.kendaraan_plat }}</div>

      <!-- Khusus Isi Bensin — odometer + badge efisiensi (km/L) BARU. -->
      <div v-if="data.jenis_entry_kendaraan === 'bensin' && data.odo_sebelum && data.odo_sesudah" style="background:var(--ivory-dim); border-radius:10px; padding:8px 10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <div><span style="color:var(--text-faint); display:block; font-size:9px; text-transform:uppercase; letter-spacing:.04em;">Odometer</span><b style="font-size:10.5px;">{{ data.odo_sebelum.toLocaleString('id-ID') }} &rarr; {{ data.odo_sesudah.toLocaleString('id-ID') }} km</b></div>
        <span v-if="efisiensiBBM" class="tag ok">{{ efisiensiBBM }} km/L</span>
      </div>

      <p style="font-size:9.5px; color:var(--text-muted); padding:0 0 4px;">{{ data.keterangan || '-' }}</p>

      <div v-if="data.jenis_entry_kendaraan === 'servis' && data.item_servis && data.item_servis.length > 0" style="margin-bottom:8px;">
        <span style="color:var(--text-faint); display:block; font-size:9px; text-transform:uppercase; letter-spacing:.04em; margin-bottom:4px;">Rincian Servis</span>
        <div v-for="(item, idx) in data.item_servis" :key="idx" style="display:flex; justify-content:space-between; font-size:11px; padding:4px 0; border-bottom:1px dashed var(--line);">
          <span>{{ item.nama_barang }} <span style="color:var(--text-faint);">&times;{{ item.qty }}</span></span>
          <b>{{ formatRupiah(item.jumlah) }}</b>
        </div>
      </div>

      <div v-if="bolehProses" class="approve-row">
        <button @click="proses(true)" :disabled="memproses" class="appr-btn ok"><i class="fas fa-check"></i> Setuju</button>
        <button @click="proses(false)" :disabled="memproses" class="appr-btn danger"><i class="fas fa-times"></i> Tolak</button>
      </div>
      <p v-else-if="punyaSendiri" style="text-align:center; font-size:11px; color:var(--text-faint); padding-top:8px; border-top:1px solid var(--ivory-dim); margin-top:2px;"><i class="fas fa-lock" style="margin-right:5px;"></i>Ini pengajuan Anda sendiri — tidak bisa Accept/Reject sendiri.</p>
      <p v-else style="text-align:center; font-size:11px; color:var(--text-faint); padding-top:8px; border-top:1px solid var(--ivory-dim); margin-top:2px;">Menunggu validator tahap ini (bukan Anda).</p>
    </div>
  `
};

const AppAntreanReimburse = {
  components: { ReimburseCard, KolomCari },
  setup() {
    const daftarPending = ref([]);
    const totalMentahSebelumFilter = ref(0); // diagnostik, lihat catatan di muat()
    const memuat = ref(true);
    const errorMuat = ref('');
    const isOwnerRole = computed(() => ['owner', 'superuser'].includes((window.currentUser.role || '').toLowerCase()));

    // BARU (19 Agt 2026, permintaan Hilman) — Owner TIDAK dibatasi 1 tahap
    // lagi (dulu cuma lihat menunggu_owner) — Owner sekarang bisa lihat
    // SEMUA tahap sekaligus, buat lacak "reimburse ini nyangkut di tahap
    // mana" pas lagi debug. Admin Finance/PIC TETAP dibatasi 1 tahap
    // (sesuai wewenang mereka di firestore.rules, tidak berubah).
    function tahapUntukRoleSaya() {
      const role = (window.currentUser.role || '').toLowerCase();
      if (role === 'admin') return 'menunggu_admin_finance';
      if (role === 'pic') return 'menunggu_pic';
      if (isOwnerRole.value) return null; // null = TIDAK dibatasi where(), lihat muat()
      return 'TIDAK_BERWENANG'; // Operator dkk — beda dari Owner punya null, biar tidak ketuker
    }
    const labelTahapSaya = computed(() => {
      if (isOwnerRole.value) return 'Semua tahap (Owner bisa lihat semua)';
      return LABEL_TAHAP[tahapUntukRoleSaya()] || '';
    });

    // Search box + filter tahap — filter tahap CUMA relevan/tampil buat
    // Owner (Admin Finance/PIC sudah otomatis di-scope 1 tahap lewat
    // query, dropdown lagi cuma bikin bingung). Default "Pengajuan PIC"
    // (menunggu_owner) — itu tahap yang jadi tanggung jawab Owner
    // sendiri, paling relevan dibuka duluan tanpa perlu ganti-ganti.
    const cariNama = ref('');
    const filterTahapOwner = ref('menunggu_owner');
    const OPSI_FILTER_TAHAP = [
      { value: 'SEMUA', label: 'Semua tahap' },
      { value: 'menunggu_admin_finance', label: 'Pengajuan Operator (baru diajukan)' },
      { value: 'menunggu_pic', label: 'Pengajuan Admin (sudah ACC Admin Finance)' },
      { value: 'menunggu_owner', label: 'Pengajuan PIC (sudah ACC PIC)' }
    ];

    // Filter Kendaraan — buat monitoring biaya per kendaraan (permintaan
    // Hilman 19 Agt 2026). Client-side, dari data yang SUDAH ketarik
    // (tidak nambah baca Firestore) — antrean ini kecil (cuma yang
    // pending), jadi aman disaring di browser.
    const filterKendaraan = ref('ALL');
    const opsiKendaraan = computed(() => {
      const set = new Set();
      daftarPending.value.forEach(item => { if (item.data.kendaraan_plat) set.add(item.data.kendaraan_plat); });
      return [...set].sort();
    });
    const daftarPendingTersaring = computed(() => {
      let hasil = daftarPending.value;
      const kata = cariNama.value.trim().toLowerCase();
      if (kata) hasil = hasil.filter(item => (item.data.nama_pegawai || '').toLowerCase().includes(kata));
      if (isOwnerRole.value && filterTahapOwner.value !== 'SEMUA') {
        hasil = hasil.filter(item => item.data.tahap === filterTahapOwner.value);
      }
      if (filterKendaraan.value !== 'ALL') hasil = hasil.filter(item => item.data.kendaraan_plat === filterKendaraan.value);
      return hasil;
    });

    // BARU (29 Agt 2026, moodboard "Gechoo Mobile Organic" v2) — dropdown
    // filter Tahap (Owner) & Kendaraan dipindah ke 1 menu "lainnya" oval
    // titik-tiga di sebelah kolom cari, pola sama modul lain.
    const menuTerbuka = ref(false);
    function toggleMenuTerbuka() { menuTerbuka.value = !menuTerbuka.value; }
    const adaFilterAktif = computed(() => (isOwnerRole.value && filterTahapOwner.value !== 'SEMUA') || filterKendaraan.value !== 'ALL');

    async function muat() {
      memuat.value = true;
      errorMuat.value = '';
      try {
        const tahapSaya = tahapUntukRoleSaya();
        if (tahapSaya === 'TIDAK_BERWENANG') { daftarPending.value = []; memuat.value = false; return; }

        // Owner (tahapSaya === null): fetch SELURUH collection reimburse,
        // TANPA where() tahap — sengaja, buat diagnostik "lihat semua".
        // Admin Finance/PIC: tetap query 1 tahap seperti biasa (hemat,
        // sesuai wewenang mereka).
        const snap = tahapSaya === null
          ? await getDocs(collection(db, "reimburse"))
          : await getDocs(query(collection(db, "reimburse"), where("tahap", "==", tahapSaya)));
        totalMentahSebelumFilter.value = snap.size; // diagnostik: sebelum kena filter jenis_pekerjaan+gudang
        const list = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          // jenis_pekerjaan di app ini = BIDANG USAHA (Konveksi/Retail/
          // Logistik) — WAJIB dicocokkan, supaya Admin Finance bisnis
          // Konveksi TIDAK bisa lihat reimburse bisnis Logistik.
          if (!window.bolehLihatData(d.jenis_pekerjaan, d.gudang)) return;
          list.push({ id: docSnap.id, data: d });
        });
        daftarPending.value = list;
      } catch (e) {
        console.error("Error muat antrean reimburse:", e);
        errorMuat.value = 'Gagal memuat data. Cek Console untuk detail (mungkin perlu index Firestore baru — lihat link di pesan error aslinya).';
      }
      memuat.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });
    return {
      daftarPending, daftarPendingTersaring, totalMentahSebelumFilter, memuat, errorMuat, muat, labelTahapSaya,
      isOwnerRole, cariNama, filterTahapOwner, OPSI_FILTER_TAHAP, filterKendaraan, opsiKendaraan,
      menuTerbuka, toggleMenuTerbuka, adaFilterAktif
    };
  },
  // ==========================================================================
  // DIROMBAK (29 Agt 2026, moodboard "Gechoo Mobile Organic" v2, dari cek
  // live Guru di HP — PRIORITAS TERAKHIR, dikerjakan setelah Absensi/Lembur/
  // Dakar terbukti aman, sesuai catatan risiko mockup) — banner dipadatkan
  // & dipindah ke bawah kolom cari, dropdown filter Tahap (Owner)+Kendaraan
  // masuk ke menu oval titik-tiga — pola sama persis 3 modul lain. Logic
  // query 3-tahap/muat()/bolehLihatData TIDAK berubah sama sekali.
  // ==========================================================================
  template: `
    <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
      <div style="flex:1; min-width:0;"><kolom-cari v-model="cariNama" placeholder="Cari nama pemohon..." /></div>
      <button @click="toggleMenuTerbuka" class="gc-overflow-btn" title="Menu lainnya">
        <i class="fas fa-ellipsis"></i>
        <span v-if="adaFilterAktif" class="gc-overflow-dot"></span>
      </button>
      <div v-if="menuTerbuka" @click="toggleMenuTerbuka" class="gc-overflow-backdrop"></div>
      <div v-if="menuTerbuka" class="gc-overflow-panel">
        <template v-if="isOwnerRole">
          <div class="gc-overflow-label">Filter tahap</div>
          <div style="padding:2px 6px 8px;">
            <select v-model="filterTahapOwner" style="width:100%; padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
              <option v-for="opsi in OPSI_FILTER_TAHAP" :key="opsi.value" :value="opsi.value">{{ opsi.label }}</option>
            </select>
          </div>
        </template>
        <template v-if="opsiKendaraan.length > 0">
          <div class="gc-overflow-label">Filter kendaraan</div>
          <div style="padding:2px 6px 8px;">
            <select v-model="filterKendaraan" style="width:100%; padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
              <option value="ALL">Semua kendaraan</option>
              <option v-for="plat in opsiKendaraan" :key="plat" :value="plat">{{ plat }}</option>
            </select>
          </div>
        </template>
        <hr v-if="isOwnerRole || opsiKendaraan.length > 0" class="gc-overflow-sep">
        <button @click="toggleMenuTerbuka(); muat();" class="gc-overflow-item"><i class="fas fa-sync-alt"></i> Refresh</button>
      </div>
    </div>
    <div class="gc-card" style="display:flex; align-items:center; gap:8px; background:var(--pink); border:none; padding:9px 14px; margin-bottom:16px; flex-wrap:wrap;">
      <i class="fas fa-receipt" style="color:var(--burgundy-dark); font-size:12px;"></i>
      <b style="font-size:11px; color:var(--burgundy-dark);">Antrean Reimburse</b>
      <span class="gc-badge-count">{{ daftarPendingTersaring.length }}</span>
      <span style="width:100%; font-size:9.5px; color:var(--mahogany-soft);">{{ labelTahapSaya || 'Role Anda tidak berwenang memvalidasi reimburse.' }}</span>
    </div>

    <div v-if="memuat && daftarPending.length === 0" style="text-align:center; padding:40px 0; color:var(--text-faint);">
      <i class="fas fa-spinner fa-spin" style="font-size:26px; margin-bottom:10px; display:block;"></i><p style="font-size:12px;">Memuat antrean reimburse...</p>
    </div>
    <div v-else-if="errorMuat" style="text-align:center; padding:40px 0; color:var(--danger); font-size:12px; background:var(--danger-light); border-radius:18px;">{{ errorMuat }}</div>
    <div v-else-if="daftarPending.length === 0 && totalMentahSebelumFilter === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px;">
      <i class="fas fa-glass-cheers" style="font-size:40px; color:var(--blue-deep); margin-bottom:12px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">{{ isOwnerRole ? 'Belum ada reimburse sama sekali di sistem' : 'Tidak ada antrean' }}</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">{{ isOwnerRole ? 'Belum ada satupun pengajuan reimburse dibuat.' : 'Semua reimburse yang jadi tanggung jawab Anda sudah diproses.' }}</p>
    </div>
    <div v-else-if="daftarPending.length === 0 && totalMentahSebelumFilter > 0" style="text-align:center; padding:56px 0; background:var(--warn-light); border:1.5px solid var(--warn); border-radius:18px;">
      <i class="fas fa-triangle-exclamation" style="font-size:34px; color:var(--warn); margin-bottom:12px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">Ada {{ totalMentahSebelumFilter }} reimburse {{ isOwnerRole ? 'di sistem' : 'menunggu tahap Anda' }}, tapi tidak ada yang cocok profil Anda</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px; max-width:360px; margin-left:auto; margin-right:auto;">Kemungkinan besar Jenis Pekerjaan atau Gudang di profil Anda beda (walau kelihatan sama, sering ada spasi/huruf beda tipis) dari yang mengajukan. Cek ulang di Daftar Karyawan / Hak Akses.</p>
    </div>
    <div v-else-if="daftarPendingTersaring.length === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px;">
      <i class="fas fa-filter-circle-xmark" style="font-size:34px; color:var(--text-faint); margin-bottom:12px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">Tidak ada yang cocok</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">Coba ubah kata kunci pencarian, filter tahap, atau filter kendaraan yang aktif.</p>
    </div>
    <div v-else style="gap:14px;" class="grid grid-cols-1 md:grid-cols-2">
      <reimburse-card v-for="item in daftarPendingTersaring" :key="item.id" :doc-id="item.id" :data="item.data" @diproses="muat" />
    </div>
  `
};

let vmAntreanReimburse = null;
window.pastikanMountAntreanReimburse = function() {
  if (vmAntreanReimburse) return;
  const mountPoint = document.getElementById('vue-antrean-reimburse');
  if (mountPoint) vmAntreanReimburse = createApp(AppAntreanReimburse).mount('#vue-antrean-reimburse');
};
window.refreshAntreanReimburse = function() { if (vmAntreanReimburse) vmAntreanReimburse.muat(); };

// ============================================================================
// KOMPONEN 3 — Master Keuangan: cuma bungkus tipis MasterDataCategory yang
// SUDAH ADA (dipakai ulang, bukan bikin UI baru) — kelola daftar Kategori
// Pengeluaran (BBM, Tol, Parkir, dst) buat dropdown di form Ajukan Reimburse.
// ============================================================================
const AppMasterKeuangan = {
  components: { MasterDataCategory },
  template: `
    <div class="gc-card" style="margin-bottom:16px;">
      <h3 class="gc-heading" style="font-weight:700; font-size:13.5px;"><i class="fas fa-wallet" style="color:var(--burgundy); margin-right:8px;"></i> Master Keuangan</h3>
      <p style="font-size:10.5px; color:var(--text-muted); margin-top:3px;">Kelola kategori pengeluaran (dipakai form Ajukan Reimburse) dan kategori pemasukan.</p>
    </div>
    <div style="display:grid; gap:16px;" class="grid-cols-1 md:grid-cols-2">
      <master-data-category kategori="kategori_reimburse" label="Kategori Pengeluaran" menu-id="master_keuangan" />
      <master-data-category kategori="kategori_pemasukan" label="Kategori Pemasukan" menu-id="master_keuangan" />
    </div>
  `
};
let vmMasterKeuangan = null;
window.pastikanMountMasterKeuangan = function() {
  if (vmMasterKeuangan) return;
  const mountPoint = document.getElementById('vue-master-keuangan');
  if (mountPoint) vmMasterKeuangan = createApp(AppMasterKeuangan).mount('#vue-master-keuangan');
};

// ============================================================================
// KOMPONEN 4 — Master Kendaraan: daftar kendaraan + supir pemegang SAAT
// INI (bisa di-assign ulang kapan saja — rotasi antar supir, permintaan
// eksplisit Hilman 19 Agt 2026). Dipakai form Ajukan Reimburse supaya
// Admin Finance/PIC/Owner bisa monitor biaya bensin+servis PER KENDARAAN,
// bukan cuma per orang (supir bisa gonta-ganti kendaraan dari waktu ke
// waktu, kendaraan yang jadi acuan biaya, bukan orangnya).
//
// SENGAJA 1 dokumen per kendaraan (bukan 1 dokumen array semua kendaraan,
// pola master_data biasa) — supaya assign ulang supir 1 kendaraan TIDAK
// perlu baca+tulis ulang SELURUH daftar kendaraan (hindari resiko
// tabrakan kalau 2 Admin assign kendaraan BEDA di waktu bersamaan),
// PERSIS alasan yang sama kenapa master_gudang/master_shift juga begitu.
// ============================================================================
const MasterKendaraanManager = {
  setup() {
    const daftarKendaraan = ref([]);
    const memuat = ref(true);

    // Form tambah kendaraan baru — urutan sesuai permintaan: Jenis
    // Pekerjaan -> Gudang -> Plat Nomor -> (Atur Supir belakangan, lewat
    // panel terpisah biar konsisten sama alur edit).
    const jenisPekerjaanBaru = ref('');
    const gudangBaru = ref('');
    const platBaru = ref('');
    const namaBaru = ref('');
    const opsiJenisPekerjaan = ref([]);
    const opsiGudang = ref([]);
    const menyimpan = ref(false);

    const daftarOperator = ref([]);
    const sedangEditSupirId = ref(null); // id kendaraan yang panel checkbox-nya lagi kebuka
    const pilihanSementara = ref([]); // array email, draft sebelum disimpan

    // BARU — search box + tabel riwayat
    const cariKendaraan = ref('');
    const daftarKendaraanTersaring = computed(() => {
      const kata = cariKendaraan.value.trim().toLowerCase();
      if (!kata) return daftarKendaraan.value;
      return daftarKendaraan.value.filter(k =>
        (k.plat_nomor || '').toLowerCase().includes(kata) ||
        (k.nama_kendaraan || '').toLowerCase().includes(kata) ||
        (k.gudang || '').toLowerCase().includes(kata) ||
        k.supir_pemegang.some(s => (s.nama || '').toLowerCase().includes(kata))
      );
    });
    // PEDOMAN KERJA (19 Agt 2026) — setiap menu baru WAJIB paginasi.
    // Client-side (bukan cursor Firestore) karena koleksi kendaraan
    // biasanya kecil, cukup dipotong di browser.
    const PER_HALAMAN = 15;
    const halamanSaatIni = ref(1);
    watch(cariKendaraan, () => { halamanSaatIni.value = 1; });
    const totalHalaman = computed(() => Math.max(1, Math.ceil(daftarKendaraanTersaring.value.length / PER_HALAMAN)));
    const daftarKendaraanTerpaginasi = computed(() => {
      const mulai = (halamanSaatIni.value - 1) * PER_HALAMAN;
      return daftarKendaraanTersaring.value.slice(mulai, mulai + PER_HALAMAN);
    });
    function gantiHalaman(delta) { halamanSaatIni.value = Math.min(totalHalaman.value, Math.max(1, halamanSaatIni.value + delta)); }
    function formatTglSingkat(ts) {
      if (!ts || !ts.toDate) return '-';
      return ts.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    async function muat() {
      memuat.value = true;
      try {
        const snap = await getDocs(collection(db, "master_kendaraan"));
        const list = [];
        snap.forEach(d => {
          const data = d.data();
          // Kompatibel data LAMA (single supir_pemegang_email) — otomatis
          // dikonversi jadi array pas dibaca, TANPA perlu migrasi paksa.
          const supirArr = Array.isArray(data.supir_pemegang) ? data.supir_pemegang
            : (data.supir_pemegang_email ? [{ email: data.supir_pemegang_email, nama: data.supir_pemegang_nama || data.supir_pemegang_email }] : []);
          list.push({ id: d.id, ...data, supir_pemegang: supirArr });
        });
        list.sort((a, b) => (a.plat_nomor || '').localeCompare(b.plat_nomor || ''));
        daftarKendaraan.value = list;
      } catch (e) {
        console.error("Gagal muat master kendaraan:", e);
      }
      memuat.value = false;
    }

    async function muatOpsi() {
      try {
        opsiJenisPekerjaan.value = window.ambilMasterList ? await window.ambilMasterList('jenis_pekerjaan') : [];
        const qGudang = await getDocs(collection(db, "master_gudang"));
        const listGudang = [];
        qGudang.forEach(g => listGudang.push(g.data().nama_gudang));
        opsiGudang.value = listGudang;
      } catch (e) {
        console.error("Gagal muat opsi jenis pekerjaan/gudang:", e);
      }
    }

    async function muatOperator() {
      try {
        const snap = await getDocs(query(collection(db, "users"), where("role", "==", "operator")));
        const list = [];
        snap.forEach(d => list.push({ email: d.id, nama: d.data().name || d.data().nama || d.id }));
        list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
        daftarOperator.value = list;
      } catch (e) {
        console.error("Gagal muat daftar operator:", e);
      }
    }

    async function tambah() {
      if (!jenisPekerjaanBaru.value) return alert("Pilih Jenis Pekerjaan (bidang usaha) dulu.");
      if (!gudangBaru.value) return alert("Pilih Gudang dulu.");
      if (!platBaru.value.trim()) return alert("Isi plat nomor dulu.");
      menyimpan.value = true;
      try {
        await addDoc(collection(db, "master_kendaraan"), {
          jenis_pekerjaan: jenisPekerjaanBaru.value,
          gudang: gudangBaru.value,
          plat_nomor: platBaru.value.trim().toUpperCase(),
          nama_kendaraan: namaBaru.value.trim(),
          supir_pemegang: [], // array kosong, isi belakangan lewat panel edit
          dibuat_pada: serverTimestamp()
        });
        platBaru.value = ''; namaBaru.value = '';
        await muat();
      } catch (e) {
        console.error("Gagal tambah kendaraan:", e);
        alert("Gagal menambah kendaraan.");
      }
      menyimpan.value = false;
    }

    // Panel "Atur Supir" — fitur checklist multi-select yang SUDAH ADA,
    // dipakai ulang apa adanya (bukan dibangun baru).
    function bukaEditSupir(k) {
      sedangEditSupirId.value = k.id;
      pilihanSementara.value = k.supir_pemegang.map(s => s.email);
    }
    function batalEditSupir() {
      sedangEditSupirId.value = null;
      pilihanSementara.value = [];
    }
    async function simpanSupir(kendaraanId) {
      const supirTerpilih = daftarOperator.value
        .filter(o => pilihanSementara.value.includes(o.email))
        .map(o => ({ email: o.email, nama: o.nama }));
      try {
        await updateDoc(doc(db, "master_kendaraan", kendaraanId), {
          supir_pemegang: supirTerpilih,
          supir_pemegang_email: null,
          supir_pemegang_nama: null,
          // BARU — catat KAPAN pengaitan ini dibuat, ditampilkan sebagai
          // kolom "Dikaitkan Sejak" di tabel (permintaan riwayat).
          supir_ditugaskan_pada: serverTimestamp()
        });
        sedangEditSupirId.value = null;
        await muat();
      } catch (e) {
        console.error("Gagal simpan supir pemegang:", e);
        alert("Gagal mengubah supir pemegang.");
      }
    }

    async function hapus(id) {
      if (!confirm("Hapus data kendaraan ini secara permanen?")) return;
      try {
        await deleteDoc(doc(db, "master_kendaraan", id));
        await muat();
      } catch (e) {
        console.error("Gagal hapus kendaraan:", e);
        alert("Gagal menghapus kendaraan.");
      }
    }

    onMounted(async () => { await window.authReady; await muat(); await muatOpsi(); await muatOperator(); });
    return {
      daftarKendaraan, daftarKendaraanTersaring, daftarKendaraanTerpaginasi, cariKendaraan, formatTglSingkat, memuat,
      halamanSaatIni, totalHalaman, gantiHalaman,
      jenisPekerjaanBaru, gudangBaru, platBaru, namaBaru, opsiJenisPekerjaan, opsiGudang, menyimpan,
      daftarOperator, hapus, tambah,
      sedangEditSupirId, pilihanSementara, bukaEditSupir, batalEditSupir, simpanSupir
    };
  },
  template: `
    <div class="gc-card" style="margin-bottom:16px;">
      <h3 class="gc-heading" style="font-weight:700; font-size:13.5px; margin-bottom:14px;"><i class="fas fa-truck" style="color:var(--burgundy); margin-right:8px;"></i> Tambah Kendaraan Baru</h3>
      <div style="display:grid; gap:10px; margin-bottom:12px;" class="grid-cols-1 md:grid-cols-2">
        <div class="gc-field" style="margin-bottom:0;">
          <label>1. Jenis Pekerjaan (bidang usaha)</label>
          <select v-model="jenisPekerjaanBaru"><option value="" disabled>Pilih...</option><option v-for="jp in opsiJenisPekerjaan" :key="jp" :value="jp">{{ jp }}</option></select>
        </div>
        <div class="gc-field" style="margin-bottom:0;">
          <label>2. Gudang</label>
          <select v-model="gudangBaru"><option value="" disabled>Pilih...</option><option v-for="g in opsiGudang" :key="g" :value="g">{{ g }}</option></select>
        </div>
      </div>
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <input v-model="platBaru" type="text" placeholder="3. Plat nomor (contoh: D 1234 AB)" style="flex:1; min-width:160px; padding:8px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
        <input v-model="namaBaru" type="text" placeholder="Nama/jenis kendaraan (opsional)" style="flex:1; min-width:160px; padding:8px 12px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
      </div>
      <p style="font-size:10px; color:var(--text-faint); margin-bottom:12px;"><i class="fas fa-circle-info" style="margin-right:4px;"></i>4. Atur Supir (rolling, bisa 2+ orang) dilakukan setelah kendaraan tersimpan, lewat tombol "Atur Supir" di tabel bawah.</p>
      <button @click="tambah" :disabled="menyimpan" class="btn-primary"><i class="fas fa-plus" style="margin-right:6px;"></i>{{ menyimpan ? 'Menyimpan...' : 'Tambah Kendaraan' }}</button>
    </div>

    <div style="position:relative; margin-bottom:14px; max-width:320px;">
      <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
      <input v-model="cariKendaraan" type="text" placeholder="Cari plat, nama, gudang, atau supir..." style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
    </div>

    <!-- GANTI (grid-fix mobile §perbaikan grid+kartu) — dulu tabel scroll
         horizontal (5 kolom, freeze-right), SEKARANG kartu supaya tidak
         perlu geser ke kanan di HP. Semua kolom lama tetap ada: header =
         Plat (judul) + Nama (subjudul), kartu-rows = Jenis Pekerjaan/
         Gudang, Supir Pemegang, Dikaitkan Sejak, Aksi jadi 2 ikon di
         header, panel "Atur Supir" tetap muncul DI DALAM kartu yang sama
         (bukan baris tabel terpisah lagi). -->
    <div v-if="memuat" class="gc-card" style="text-align:center; padding:20px; color:var(--text-faint); font-size:12px;">Memuat...</div>
    <div v-else-if="daftarKendaraan.length === 0" class="gc-card" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Belum ada kendaraan terdaftar.</div>
    <div v-else-if="daftarKendaraanTersaring.length === 0" class="gc-card" style="text-align:center; padding:24px; color:var(--text-faint); font-size:12px;">Tidak ada yang cocok dicari.</div>
    <div v-else style="display:flex; flex-direction:column; gap:10px;">
      <div v-for="k in daftarKendaraanTerpaginasi" :key="k.id" class="gc-card" style="padding:14px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:12px;">
          <div>
            <div style="font-weight:700; font-size:13.5px;">{{ k.plat_nomor }}</div>
            <div style="font-size:11.5px; color:var(--text-muted);">{{ k.nama_kendaraan || '-' }}</div>
          </div>
          <div style="display:flex; gap:6px; flex-shrink:0;">
            <button @click="bukaEditSupir(k)" class="icon-btn" title="Atur Supir"><i class="fas fa-user-edit"></i></button>
            <button @click="hapus(k.id)" class="icon-btn" style="color:var(--danger);" title="Hapus"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>

        <div class="kartu-rows" style="display:flex; flex-direction:column; gap:5px; background:var(--ivory-dim); border-radius:10px; padding:10px 12px;">
          <div style="display:flex; justify-content:space-between; font-size:12px; gap:10px;"><span style="color:var(--text-faint); flex-shrink:0;">Jenis Pekerjaan / Gudang</span><span style="font-weight:700; text-align:right;">{{ k.jenis_pekerjaan || '-' }} / {{ k.gudang || '-' }}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:12px; gap:10px;">
            <span style="color:var(--text-faint); flex-shrink:0;">Supir Pemegang</span>
            <span style="font-weight:700; text-align:right;">
              <span v-if="k.supir_pemegang.length === 0" style="color:var(--text-faint); font-weight:400;">Belum ada supir</span>
              <span v-else>{{ k.supir_pemegang.map(s => s.nama).join(', ') }}</span>
            </span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:12px; gap:10px;"><span style="color:var(--text-faint); flex-shrink:0;">Dikaitkan Sejak</span><span style="font-weight:700;">{{ formatTglSingkat(k.supir_ditugaskan_pada) }}</span></div>
        </div>

        <div v-if="sedangEditSupirId === k.id" style="margin-top:12px; padding-top:12px; border-top:1px dashed var(--line);">
          <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Centang supir yang boleh pakai kendaraan ini:</label>
          <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
            <label v-for="o in daftarOperator" :key="o.email" style="display:flex; align-items:center; gap:5px; font-size:11.5px; background:var(--surface); padding:5px 10px; border-radius:20px; cursor:pointer; border:1px solid var(--line);">
              <input type="checkbox" :value="o.email" v-model="pilihanSementara" style="accent-color:var(--burgundy);">{{ o.nama }}
            </label>
          </div>
          <div style="display:flex; gap:8px;">
            <button @click="simpanSupir(k.id)" class="btn-primary" style="padding:6px 16px; font-size:11.5px;">Simpan</button>
            <button @click="batalEditSupir" style="background:none; border:none; color:var(--text-faint); font-weight:700; cursor:pointer; font-size:11.5px;">Batal</button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="!memuat && daftarKendaraanTersaring.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
      <button class="icon-btn" :disabled="halamanSaatIni <= 1" @click="gantiHalaman(-1)"><i class="fas fa-chevron-left"></i></button>
      <span style="font-size:12px; color:var(--text-muted);">Halaman {{ halamanSaatIni }} / {{ totalHalaman }} &middot; {{ daftarKendaraanTersaring.length }} kendaraan</span>
      <button class="icon-btn" :disabled="halamanSaatIni >= totalHalaman" @click="gantiHalaman(1)"><i class="fas fa-chevron-right"></i></button>
    </div>
  `
};

const AppMasterKendaraan = { components: { MasterKendaraanManager }, template: `<master-kendaraan-manager />` };
let vmMasterKendaraan = null;
window.pastikanMountMasterKendaraan = function() {
  if (vmMasterKendaraan) return;
  const mountPoint = document.getElementById('vue-master-kendaraan');
  if (mountPoint) vmMasterKendaraan = createApp(AppMasterKendaraan).mount('#vue-master-kendaraan');
};

// ============================================================================
// KOMPONEN 5 — Riwayat (3 menu: Reimburse/Bensin/Servis, permintaan
// Hilman 19 Agt 2026). 1 komponen dipakai ULANG buat ketiganya lewat
// prop `mode` — bukan bikin 3 komponen terpisah yang isinya 90% sama.
// Beda dari Antrean Reimburse: di sini TAMPILKAN SEMUA tahap (termasuk
// yang sudah disetujui/ditolak) — ini laporan/riwayat, bukan antrean
// kerja. Di-scope jenis_pekerjaan+gudang (window.bolehLihatData), SAMA
// seperti tabel lain di app ini.
// ============================================================================
const LABEL_MODE = {
  semua: { judul: 'Riwayat Reimburse', ikon: 'fa-receipt', placeholder: 'Cari nama karyawan...' },
  bensin: { judul: 'Riwayat Isi Bensin', ikon: 'fa-gas-pump', placeholder: 'Cari nama karyawan atau plat...' },
  servis: { judul: 'Riwayat Servis', ikon: 'fa-wrench', placeholder: 'Cari nama karyawan atau plat...' }
};

const RiwayatReimburseTable = {
  props: { mode: { type: String, default: 'semua' } },
  setup(props) {
    const daftarSemua = ref([]);
    const memuat = ref(true);
    const errorMuat = ref('');
    const cariKata = ref('');

    const daftarTersaring = computed(() => {
      const kata = cariKata.value.trim().toLowerCase();
      if (!kata) return daftarSemua.value;
      return daftarSemua.value.filter(r =>
        (r.nama_pegawai || '').toLowerCase().includes(kata) ||
        (r.kendaraan_plat || '').toLowerCase().includes(kata)
      );
    });
    // PEDOMAN KERJA (19 Agt 2026) — setiap menu baru WAJIB paginasi.
    const PER_HALAMAN = 15;
    const halamanSaatIni = ref(1);
    watch(cariKata, () => { halamanSaatIni.value = 1; });
    const totalHalaman = computed(() => Math.max(1, Math.ceil(daftarTersaring.value.length / PER_HALAMAN)));
    const daftarTerpaginasi = computed(() => {
      const mulai = (halamanSaatIni.value - 1) * PER_HALAMAN;
      return daftarTersaring.value.slice(mulai, mulai + PER_HALAMAN);
    });
    function gantiHalaman(delta) { halamanSaatIni.value = Math.min(totalHalaman.value, Math.max(1, halamanSaatIni.value + delta)); }

    function formatTgl(ts) {
      if (!ts || !ts.toDate) return '-';
      return ts.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    async function muat() {
      memuat.value = true;
      errorMuat.value = '';
      try {
        // Riwayat = SEMUA tahap (bukan cuma pending) — ini laporan, bukan
        // antrean kerja. Filter jenis_entry_kendaraan (bensin/servis)
        // dilakukan DI CLIENT (bukan where() Firestore) supaya 1 fetch
        // ini bisa dipakai ulang oleh ketiga mode tanpa 3x baca beda-beda.
        const snap = await getDocs(collection(db, "reimburse"));
        const list = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          if (props.mode === 'bensin' && d.jenis_entry_kendaraan !== 'bensin') return;
          if (props.mode === 'servis' && d.jenis_entry_kendaraan !== 'servis') return;
          if (!window.bolehLihatData(d.jenis_pekerjaan, d.gudang)) return;
          list.push({ id: docSnap.id, ...d });
        });
        list.sort((a, b) => (b.diajukan_pada?.toDate?.().getTime() || 0) - (a.diajukan_pada?.toDate?.().getTime() || 0));
        daftarSemua.value = list;
      } catch (e) {
        console.error("Gagal muat riwayat reimburse:", e);
        errorMuat.value = 'Gagal memuat data. Cek Console untuk detail (mungkin perlu index Firestore baru — lihat link di pesan error aslinya).';
      }
      memuat.value = false;
    }

    function lihatFotoBesar(url) {
      if (url && window.bukaPreviewFoto) window.bukaPreviewFoto(url);
    }

    // BARU (29 Agt 2026, permintaan Guru) — Download CSV, pola SAMA PERSIS
    // dengan exportCSV() di js/vue-riwayat-absensi.js (data URI + <a
    // download>, tanpa library) — export daftarTersaring (hasil pencarian
    // AKTIF, bukan cuma 1 halaman paginasi yang tampil), kolom menyesuaikan
    // mode (semua/bensin/servis) SAMA PERSIS kolom yang ditampilkan di
    // kartu (lihat v-if="mode === ..." di template kartu). Jumlah diekspor
    // sebagai ANGKA MENTAH (bukan string "Rp100.000") supaya bisa
    // dijumlah langsung di Excel — ini buat Master Keuangan.
    function csvEsc(v) {
      return '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    }
    // Rumus SAMA PERSIS dengan efisiensiBBM di ReimburseCard (lihat
    // catatan sumber Auto2000 di sana) — diduplikasi kecil di sini karena
    // beda komponen, bukan tebakan baru.
    function hitungEfisiensiCSV(r) {
      if (r.jenis_entry_kendaraan !== 'bensin' || !r.odo_sebelum || !r.odo_sesudah || !r.liter_bensin) return '';
      const jarak = r.odo_sesudah - r.odo_sebelum;
      if (jarak <= 0 || r.liter_bensin <= 0) return '';
      return Math.round((jarak / r.liter_bensin) * 10) / 10;
    }
    function exportCSV() {
      if (daftarTersaring.value.length === 0) return alert("Tidak ada data untuk di-export sesuai pencarian yang aktif.");

      let header;
      if (props.mode === 'bensin') {
        header = ['Nama Pegawai', 'Email', 'Gudang', 'Tanggal Diajukan', 'Kendaraan', 'Odometer Sebelum (km)', 'Odometer Sesudah (km)', 'Liter Dibeli', 'Efisiensi (km/L)', 'Jumlah (Rp)', 'Status', 'Keterangan'];
      } else if (props.mode === 'servis') {
        header = ['Nama Pegawai', 'Email', 'Gudang', 'Tanggal Diajukan', 'Kendaraan', 'Rincian Servis', 'Jumlah (Rp)', 'Status', 'Keterangan'];
      } else {
        header = ['Nama Pegawai', 'Email', 'Gudang', 'Tanggal Diajukan', 'Kategori', 'Jumlah (Rp)', 'Status', 'Keterangan'];
      }

      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += csvEsc(LABEL_MODE[props.mode].judul + (cariKata.value.trim() ? ' | Cari: ' + cariKata.value.trim() : '')) + "\n\n";
      csvContent += header.join(',') + "\n";

      daftarTersaring.value.forEach(r => {
        const tgl = formatTgl(r.diajukan_pada);
        const status = LABEL_TAHAP[r.tahap] || r.tahap || '-';
        let baris;
        if (props.mode === 'bensin') {
          baris = [
            r.nama_pegawai || '-', r.email || '-', r.gudang || '-', tgl, r.kendaraan_plat || '-',
            r.odo_sebelum || '', r.odo_sesudah || '', r.liter_bensin || '', hitungEfisiensiCSV(r),
            r.jumlah || 0, status, r.keterangan || ''
          ];
        } else if (props.mode === 'servis') {
          const rincian = (r.item_servis && r.item_servis.length > 0) ? r.item_servis.map(i => i.nama_barang + ' x' + i.qty).join('; ') : '-';
          baris = [r.nama_pegawai || '-', r.email || '-', r.gudang || '-', tgl, r.kendaraan_plat || '-', rincian, r.jumlah || 0, status, r.keterangan || ''];
        } else {
          baris = [r.nama_pegawai || '-', r.email || '-', r.gudang || '-', tgl, r.kategori || '-', r.jumlah || 0, status, r.keterangan || ''];
        }
        csvContent += baris.map(csvEsc).join(',') + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${LABEL_MODE[props.mode].judul.replace(/\s+/g, '_')}_Zevanic_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    onMounted(async () => { await window.authReady; muat(); });
    return {
      daftarSemua, daftarTersaring, daftarTerpaginasi, memuat, errorMuat, muat, cariKata, formatTgl, lihatFotoBesar,
      LABEL_TAHAP, warnaTahap, formatRupiah, LABEL_MODE, halamanSaatIni, totalHalaman, gantiHalaman, exportCSV
    };
  },
  template: `
    <div class="gc-card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
      <h3 class="gc-heading" style="font-weight:700; font-size:13.5px;"><i class="fas" :class="LABEL_MODE[mode].ikon" style="color:var(--burgundy); margin-right:8px;"></i> {{ LABEL_MODE[mode].judul }}</h3>
      <div style="display:flex; gap:8px;">
        <button @click="exportCSV" class="btn-outline" title="Unduh riwayat yang sedang tampil (ikut pencarian aktif) sebagai CSV"><i class="fas fa-file-excel" style="margin-right:6px;"></i> Unduh CSV</button>
        <button @click="muat" class="btn-outline filled"><i class="fas fa-sync-alt" style="margin-right:6px;"></i> Refresh</button>
      </div>
    </div>

    <div v-if="!memuat && daftarSemua.length > 0" style="position:relative; margin-bottom:14px; max-width:320px;">
      <i class="fas fa-search" style="position:absolute; left:13px; top:11px; color:var(--text-faint); font-size:12px;"></i>
      <input v-model="cariKata" type="text" :placeholder="LABEL_MODE[mode].placeholder" style="width:100%; padding:9px 13px 9px 34px; border:1.5px solid var(--line); border-radius:10px; font-size:12.5px;">
    </div>

    <div v-if="memuat" style="text-align:center; padding:40px 0; color:var(--text-faint);"><i class="fas fa-spinner fa-spin" style="font-size:26px; margin-bottom:10px; display:block;"></i><p style="font-size:12px;">Memuat riwayat...</p></div>
    <div v-else-if="errorMuat" style="text-align:center; padding:40px 0; color:var(--danger); font-size:12px; background:var(--danger-light); border-radius:18px;">{{ errorMuat }}</div>
    <div v-else-if="daftarSemua.length === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px;">
      <i class="fas fa-inbox" style="font-size:40px; color:var(--text-faint); margin-bottom:12px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">Belum ada riwayat</h4>
    </div>
    <div v-else-if="daftarTersaring.length === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px;">
      <p style="font-size:11.5px; color:var(--text-muted);">Tidak ada yang cocok dicari.</p>
    </div>
    <!-- GANTI (grid-fix mobile §perbaikan grid+kartu) — dulu tabel scroll
         horizontal (9 kolom, sebagian kondisional lewat v-if mode),
         SEKARANG kartu supaya tidak perlu geser ke kanan di HP. Semua
         kolom lama + logic v-if mode (Kendaraan/KM/Kategori/Rincian)
         tetap PERSIS sama, cuma disusun ulang: header = Nama + tag
         Status, foto jadi thumbnail di header, Jumlah ditonjolkan di
         bawah (pola sama seperti "Harga Pakai" di Data Bahan & Aksesoris). -->
    <div v-else style="display:flex; flex-direction:column; gap:10px;">
      <div v-for="r in daftarTerpaginasi" :key="r.id" class="gc-card" style="padding:14px;">
        <div style="display:flex; gap:12px; align-items:flex-start; margin-bottom:12px;">
          <img v-if="r.foto_bukti" :src="r.foto_bukti" @click="lihatFotoBesar(r.foto_bukti)" style="width:52px; height:52px; object-fit:cover; border-radius:10px; flex-shrink:0; cursor:pointer; border:1px solid var(--line);">
          <div v-else style="width:52px; height:52px; border-radius:10px; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; flex-shrink:0;"><i class="fas fa-image" style="color:var(--text-faint); font-size:15px;"></i></div>
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:13.5px;">{{ r.nama_pegawai || '-' }}</div>
            <div style="font-size:10.5px; color:var(--text-faint); margin-top:2px;">{{ formatTgl(r.diajukan_pada) }}</div>
          </div>
          <span class="tag" :class="warnaTahap(r.tahap)" style="flex-shrink:0;">{{ LABEL_TAHAP[r.tahap] || r.tahap }}</span>
        </div>

        <div class="kartu-rows" style="display:flex; flex-direction:column; gap:5px; background:var(--ivory-dim); border-radius:10px; padding:10px 12px; margin-bottom:10px;">
          <div v-if="mode !== 'semua'" style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Kendaraan</span><span style="font-weight:700;">{{ r.kendaraan_plat || '-' }}</span></div>
          <div v-if="mode === 'bensin'" style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">KM</span><span style="font-weight:700;">{{ r.km_saat_isi ? r.km_saat_isi.toLocaleString('id-ID') + ' km' : '-' }}</span></div>
          <div v-if="mode === 'semua'" style="display:flex; justify-content:space-between; font-size:12px;"><span style="color:var(--text-faint);">Kategori</span><span style="font-weight:700;">{{ r.kategori || '-' }}</span></div>
          <div v-if="mode === 'servis'" style="display:flex; justify-content:space-between; font-size:12px; gap:10px;">
            <span style="color:var(--text-faint); flex-shrink:0;">Rincian</span>
            <span style="font-weight:700; text-align:right;">
              <span v-if="!r.item_servis || r.item_servis.length === 0">-</span>
              <span v-else>{{ r.item_servis.map(i => i.nama_barang).join(', ') }}</span>
            </span>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:11px; color:var(--text-faint);">Jumlah</span>
          <b style="font-size:15px; color:var(--burgundy);">{{ formatRupiah(r.jumlah) }}</b>
        </div>
      </div>
    </div>
    <div v-if="!memuat && daftarTersaring.length > 0" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
      <button class="icon-btn" :disabled="halamanSaatIni <= 1" @click="gantiHalaman(-1)"><i class="fas fa-chevron-left"></i></button>
      <span style="font-size:12px; color:var(--text-muted);">Halaman {{ halamanSaatIni }} / {{ totalHalaman }} &middot; {{ daftarTersaring.length }} baris</span>
      <button class="icon-btn" :disabled="halamanSaatIni >= totalHalaman" @click="gantiHalaman(1)"><i class="fas fa-chevron-right"></i></button>
    </div>
  `
};

const AppRiwayatReimburse = { components: { RiwayatReimburseTable }, template: `<riwayat-reimburse-table mode="semua" />` };
const AppRiwayatBensin = { components: { RiwayatReimburseTable }, template: `<riwayat-reimburse-table mode="bensin" />` };
const AppRiwayatServis = { components: { RiwayatReimburseTable }, template: `<riwayat-reimburse-table mode="servis" />` };

let vmRiwayatReimburse = null;
window.pastikanMountRiwayatReimburse = function() {
  if (vmRiwayatReimburse) return;
  const mountPoint = document.getElementById('vue-riwayat-reimburse');
  if (mountPoint) vmRiwayatReimburse = createApp(AppRiwayatReimburse).mount('#vue-riwayat-reimburse');
};
let vmRiwayatBensin = null;
window.pastikanMountRiwayatBensin = function() {
  if (vmRiwayatBensin) return;
  const mountPoint = document.getElementById('vue-riwayat-bensin');
  if (mountPoint) vmRiwayatBensin = createApp(AppRiwayatBensin).mount('#vue-riwayat-bensin');
};
let vmRiwayatServis = null;
window.pastikanMountRiwayatServis = function() {
  if (vmRiwayatServis) return;
  const mountPoint = document.getElementById('vue-riwayat-servis');
  if (mountPoint) vmRiwayatServis = createApp(AppRiwayatServis).mount('#vue-riwayat-servis');
};
