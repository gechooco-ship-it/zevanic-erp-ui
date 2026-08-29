// js/vue-antrean-absensi.js
// ============================================================================
// Halaman KELIMA yang dimigrasi ke Vue: Master Absensi > Antrean Absensi
// (validasi/approve pengajuan absensi karyawan).
//
// DIROMBAK (18 Agt 2026) — dua perubahan besar sekaligus:
//
// 1. HEMAT: dulu fetch SELURUH histori "absensi" (bisa ribuan dokumen)
//    lalu difilter di JS cari yang PENDING. Sekarang 2 query LANGSUNG
//    cari yang pending, tidak baca histori yang sudah selesai:
//      A. where("ada_pending","==",true) — dokumen format BARU (HADIR
//         gabungan Clock In+Out, lihat js/vue-camera.js)
//      B. where("status_acc","==","PENDING") — dokumen format LAMA
//         (HADIR versi 2-dokumen-terpisah, MASIH ada selama masa
//         transisi) DAN IZIN/CUTI/LEMBUR yang PERMANEN pakai status_acc
//         tunggal (jalur itu di vue-camera.js TIDAK ikut dirombak).
//    Dokumen SANGAT lama yang belum sempat punya field status_acc SAMA
//    SEKALI (dari sebelum field itu konsisten diisi) TIDAK akan ketemu
//    lewat where() ini — makanya ada tombol "Cek Data Sangat Lama"
//    terpisah (fetch-semua, TAPI cuma jalan kalau diklik manual, bukan
//    otomatis tiap buka halaman) buat jaring-jaring pengaman.
//
// 2. Kartu sekarang mendukung 2 BENTUK dokumen: LAMA (1 status_acc, 1
//    tombol Accept/Reject, TAMPILAN TIDAK BERUBAH) dan BARU (field
//    ber-akhiran _masuk/_keluar terpisah, kartu punya SAMPAI 2 blok
//    approve independen — PIC bisa Accept Clock In pagi, Accept Clock
//    Out sore, terpisah, sesuai kesepakatan 18 Agt 2026).
//
// PENTING: window.hapusAbsensi (dipanggil di sini) juga dipakai oleh Riwayat
// All Absensi yang belum dimigrasi — TIDAK dihapus dari dashboard.js, tetap
// dipanggil apa adanya lewat window.
// ============================================================================
import { createApp, ref, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
// BARU (29 Agt 2026, moodboard "Gechoo Mobile Organic") — KolomCari (pil,
// dipakai bareng Menu Lengkap/Atur Favorit) GANTI kolom cari hand-rolled.
import { KolomCari } from './vue-components.js?v=5';

// Diekspor juga (dipakai test) — bandingkan JAM aktual (Firestore
// Timestamp) vs JAM jadwal shift ("HH:MM" dari master_shift).
// DIROMBAK (19 Agt 2026, revisi ke-2) — versi PERTAMA cuma bandingkan
// jam-saja (abaikan tanggal), yang ternyata BUG buat shift malam
// nyebrang tengah malam: orang lembur pulang jam 07:00 (tanggal
// berikutnya) malah salah dibilang "Pulang Cepat" dibanding jadwal
// 06:00, padahal itu justru LEMBUR. Sekarang pakai `waktuAnchorTs`
// (SELALU waktu Clock In, baik lagi hitung status masuk MAUPUN keluar)
// buat tentukan TANGGAL DASAR yang benar — persis pola yang sama
// dengan window.cekMasihJamKerja (auth.js) buat shift yang nyebrang
// tengah malam.
// tipe: 'masuk' (Ontime/Terlambat) atau 'keluar' (Ontime/Pulang Cepat)
// — arah perbandingannya BERLAWANAN (masuk: cepat=Ontime; keluar:
// lambat=Ontime), makanya tidak bisa 1 fungsi generik tanpa parameter ini.
export function hitungStatusKehadiran(waktuAktualTs, waktuAnchorTs, jamJadwalStr, tipe) {
  if (!waktuAktualTs || typeof waktuAktualTs.toDate !== 'function') return null;
  if (!waktuAnchorTs || typeof waktuAnchorTs.toDate !== 'function') return null;
  if (!jamJadwalStr) return null;

  const aktual = waktuAktualTs.toDate();
  const anchor = waktuAnchorTs.toDate();
  const [jamJadwalH, jamJadwalM] = jamJadwalStr.split(':').map(Number);

  let batasJadwal = new Date(anchor);
  batasJadwal.setHours(jamJadwalH, jamJadwalM, 0, 0);

  if (tipe === 'keluar') {
    // Kalau batas (jam_keluar) yang dibangun di TANGGAL Clock In itu <=
    // Clock In itu sendiri, berarti shift ini nyebrang tengah malam ->
    // WAJIB didorong ke hari berikutnya, biar perbandingan kronologis
    // benar (bukan cuma bandingkan jam mentah 0-23).
    if (batasJadwal <= anchor) batasJadwal.setDate(batasJadwal.getDate() + 1);
    return aktual >= batasJadwal ? 'Ontime' : 'Pulang Cepat';
  }
  return aktual <= batasJadwal ? 'Ontime' : 'Terlambat';
}

// Diekspor juga (dipakai test) — hitung ulang ada_pending dari status
// masuk+keluar TERBARU (bukan dari data lama di props, supaya benar
// walau salah satu baru saja diproses barengan).
export function hitungAdaPending(statusMasuk, statusKeluar) {
  return statusMasuk === "PENDING" || statusKeluar === "PENDING";
}

const AntreanAbsensiCard = {
  props: {
    docId: { type: String, required: true },
    data: { type: Object, required: true }
  },
  emits: ['diproses'],
  setup(props, { emit }) {
    // Format BARU kalau field ada_pending ADA di dokumennya (cuma dokumen
    // hasil js/vue-camera.js yang sudah dirombak yang punya field ini).
    const adalahFormatBaru = computed(() => props.data.ada_pending !== undefined);

    // JARING PENGAMAN (19 Agt 2026) — kalau karena SEBAB APAPUN item ini
    // ke-query padahal KEDUA sisi (masuk & keluar) sudah tidak PENDING
    // lagi, JANGAN render kartu kosong tanpa Accept/Reject sama sekali
    // (dilaporkan Hilman: kartu "hantu" cuma nampilin Gudang+hapus,
    // menumpuk di layar). Kartu SEMBUNYI total dari tampilan kalau tidak
    // ada satupun sisi yang butuh diproses.
    const adaYangPending = computed(() => {
      if (!adalahFormatBaru.value) return true; // format lama selalu render seperti biasa
      return props.data.status_acc_masuk === 'PENDING' || props.data.status_acc_keluar === 'PENDING';
    });

    function lihatFotoBesar(url) {
      if (url && window.bukaPreviewFoto) window.bukaPreviewFoto(url);
    }
    const bolehEdit = computed(() => window.cekIzinMenu('antrean_absensi', 'edit') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu('antrean_absensi', 'delete') !== false);

    // BARU (28 Agt 2026, redesain "Gechoo Mobile Organic", permintaan Guru
    // "avatar pakai foto terakhir") — avatar ringkasan di header kartu
    // SEKARANG utamakan foto_selfie_keluar (Clock Out, KRONOLOGIS lebih
    // baru dari Clock In pada record yang sama) sebelum jatuh ke
    // foto_selfie_masuk lalu field lama (foto_selfie/foto). Sebelumnya
    // urutan cuma masuk->lama, foto_selfie_keluar TIDAK PERNAH dipakai di
    // header ringkasan (padahal sudah tampil di blok Clock Out sendiri).
    const fotoAvatar = computed(() =>
      props.data.foto_selfie_keluar || props.data.foto_selfie_masuk || props.data.foto_selfie || props.data.foto || ''
    );
    const menuAksiTerbuka = ref(false);
    function toggleMenuAksi() { menuAksiTerbuka.value = !menuAksiTerbuka.value; }
    function tutupMenuAksi() { menuAksiTerbuka.value = false; }

    // BARU (19 Agt 2026, permintaan Hilman) — Status Kehadiran SEKARANG
    // dihitung OTOMATIS oleh sistem (bandingkan jam Clock In/Out asli vs
    // jadwal shift di master_shift), BUKAN dipilih manual admin lagi.
    // Admin cuma MANUAL cek Seragam (satu-satunya yang butuh mata
    // manusia — belum ada OCR/pengenalan gambar buat itu). Jam shift
    // diambil SEKALI per kartu (bukan re-fetch tiap render).
    const jamShift = ref({ masuk: null, keluar: null }); // "HH:MM" | null kalau shift tidak ketemu
    async function muatJamShift() {
      if (!props.data.nama_shift) return;
      try {
        const qShift = await getDocs(query(collection(db, "master_shift"), where("nama_shift", "==", props.data.nama_shift)));
        if (!qShift.empty) {
          const s = qShift.docs[0].data();
          jamShift.value = { masuk: s.jam_masuk || null, keluar: s.jam_keluar || null };
        }
      } catch (e) {
        console.error("Gagal muat jam shift buat hitung status kehadiran:", e);
      }
    }

    // BARU (19 Agt 2026, permintaan Hilman) — kalau ada pengajuan LEMBUR
    // yang SUDAH DI-ACC buat email+tanggal yang sama dengan Clock In
    // shift reguler ini, badge Clock Out jadi "Lembur" (bukan Ontime/
    // Pulang Cepat biasa) — Lembur itu SESI TERPISAH (status "LEMBUR
    // (CLOCK IN)", collection SAMA "absensi" tapi dokumen beda), jadi
    // dicek silang, bukan dihitung dari jam shift reguler.
    const adaLemburApproved = ref(false);
    async function cekLemburHariItu(waktuAnchorTs) {
      if (!waktuAnchorTs || typeof waktuAnchorTs.toDate !== 'function' || !props.data.email) return;
      try {
        const tglAnchor = waktuAnchorTs.toDate().toDateString();
        const snap = await getDocs(query(collection(db, "absensi"),
          where("email", "==", props.data.email), where("status", "==", "LEMBUR (CLOCK IN)"), where("status_acc", "==", "ACC")));
        adaLemburApproved.value = snap.docs.some(d => {
          const wl = d.data().waktu_ts;
          return wl && typeof wl.toDate === 'function' && wl.toDate().toDateString() === tglAnchor;
        });
      } catch (e) {
        console.error("Gagal cek lembur approved:", e);
      }
    }

    // ---- FORMAT LAMA: 1 status_acc tunggal — TIDAK DIUBAH SAMA SEKALI
    // dari versi sebelumnya (juga dipakai IZIN/CUTI/LEMBUR SELAMANYA,
    // bukan cuma migrasi sementara). ----
    // Status Kehadiran OTOMATIS — CUMA dihitung kalau ini beneran record
    // HADIR (Clock In); IZIN/CUTI/LEMBUR tidak relevan buat "ontime/
    // terlambat" sama sekali, biarkan null (tampil '-').
    const statusKehadiranOtomatis = computed(() => {
      if (props.data.status !== 'HADIR (CLOCK IN)') return null;
      return hitungStatusKehadiran(props.data.waktu_ts, props.data.waktu_ts, jamShift.value.masuk, 'masuk');
    });
    const seragam = ref(props.data.seragam || 'Sesuai');
    const memproses = ref(false);
    // BARU (29 Agt 2026, moodboard "Gechoo Mobile Organic", lihat PEDOMAN-
    // GAYA-KERJA.md) — dulu pilih Seragam (dropdown) & Accept itu 2 langkah
    // terpisah. Sekarang 3 tombol sejajar (Sesuai/Tidak Sesuai/Reject) —
    // 2 yang pertama SAMA-SAMA accept, cuma nilai seragam yang ikut
    // disimpan beda. Reject TIDAK mengubah seragam (proses('REJECT') apa
    // adanya, sama seperti sebelumnya).
    function prosesDenganSeragam(statusAcc, nilaiSeragam) {
      if (nilaiSeragam) seragam.value = nilaiSeragam;
      proses(statusAcc);
    }
    async function proses(statusAcc) {
      if (window.cekIzinMenu('antrean_absensi', 'edit') === false) {
        return alert('Anda tidak punya izin memproses ACC/Reject di sini. Hubungi Owner/PIC.');
      }
      memproses.value = true;
      try {
        await updateDoc(doc(db, "absensi", props.docId), {
          status_acc: statusAcc,
          status_kehadiran: statusKehadiranOtomatis.value || 'Tidak Absen',
          seragam: seragam.value,
          validated_at: new Date().toISOString(),
          validated_by: window.currentUser.name || window.currentUser.email
        });
        emit('diproses');
      } catch (e) {
        console.error("Gagal update ACC:", e);
        alert("Terjadi kesalahan sistem saat memproses validasi.");
      }
      memproses.value = false;
    }

    // ---- FORMAT BARU: masuk & keluar diproses independen ----
    const statusKehadiranMasukOtomatis = computed(() => hitungStatusKehadiran(props.data.waktu_masuk_ts, props.data.waktu_masuk_ts, jamShift.value.masuk, 'masuk'));
    const seragamMasuk = ref(props.data.seragam_masuk || 'Sesuai');
    const memprosesMasuk = ref(false);
    function prosesMasukDenganSeragam(statusAcc, nilaiSeragam) {
      if (nilaiSeragam) seragamMasuk.value = nilaiSeragam;
      prosesMasuk(statusAcc);
    }
    async function prosesMasuk(statusAcc) {
      if (window.cekIzinMenu('antrean_absensi', 'edit') === false) {
        return alert('Anda tidak punya izin memproses ACC/Reject di sini. Hubungi Owner/PIC.');
      }
      memprosesMasuk.value = true;
      try {
        await updateDoc(doc(db, "absensi", props.docId), {
          status_acc_masuk: statusAcc,
          status_kehadiran_masuk: statusKehadiranMasukOtomatis.value || 'Tidak Absen',
          seragam_masuk: seragamMasuk.value,
          validated_at_masuk: new Date().toISOString(),
          validated_by_masuk: window.currentUser.name || window.currentUser.email,
          // Cek status KELUAR TERBARU dari props.data (bukan diasumsikan) —
          // supaya ada_pending benar walau keluar sudah diproses duluan.
          ada_pending: hitungAdaPending(statusAcc, props.data.status_acc_keluar)
        });
        emit('diproses');
      } catch (e) {
        console.error("Gagal update ACC Clock In:", e);
        alert("Terjadi kesalahan sistem saat memproses validasi Clock In.");
      }
      memprosesMasuk.value = false;
    }

    const statusKehadiranKeluarOtomatis = computed(() => hitungStatusKehadiran(props.data.waktu_keluar_ts, props.data.waktu_masuk_ts, jamShift.value.keluar, 'keluar'));
    const seragamKeluar = ref(props.data.seragam_keluar || 'Sesuai');
    const memprosesKeluar = ref(false);
    function prosesKeluarDenganSeragam(statusAcc, nilaiSeragam) {
      if (nilaiSeragam) seragamKeluar.value = nilaiSeragam;
      prosesKeluar(statusAcc);
    }
    async function prosesKeluar(statusAcc) {
      if (window.cekIzinMenu('antrean_absensi', 'edit') === false) {
        return alert('Anda tidak punya izin memproses ACC/Reject di sini. Hubungi Owner/PIC.');
      }
      memprosesKeluar.value = true;
      try {
        await updateDoc(doc(db, "absensi", props.docId), {
          status_acc_keluar: statusAcc,
          status_kehadiran_keluar: adaLemburApproved.value ? 'Lembur' : (statusKehadiranKeluarOtomatis.value || 'Tidak Absen'),
          seragam_keluar: seragamKeluar.value,
          validated_at_keluar: new Date().toISOString(),
          validated_by_keluar: window.currentUser.name || window.currentUser.email,
          ada_pending: hitungAdaPending(props.data.status_acc_masuk, statusAcc)
        });
        emit('diproses');
      } catch (e) {
        console.error("Gagal update ACC Clock Out:", e);
        alert("Terjadi kesalahan sistem saat memproses validasi Clock Out.");
      }
      memprosesKeluar.value = false;
    }

    function hapus() {
      if (window.cekIzinMenu('antrean_absensi', 'delete') === false) {
        return alert('Anda tidak punya izin menghapus data di sini. Hubungi Owner/PIC.');
      }
      if (window.hapusAbsensi) window.hapusAbsensi(props.docId).then(() => emit('diproses'));
    }

    onMounted(() => {
      muatJamShift();
      cekLemburHariItu(props.data.waktu_masuk_ts || props.data.waktu_ts);
    });

    return {
      adalahFormatBaru, adaYangPending, lihatFotoBesar, hapus, bolehEdit, bolehHapus,
      fotoAvatar, menuAksiTerbuka, toggleMenuAksi, tutupMenuAksi,
      statusKehadiranOtomatis, seragam, memproses, proses, prosesDenganSeragam,
      statusKehadiranMasukOtomatis, seragamMasuk, memprosesMasuk, prosesMasuk, prosesMasukDenganSeragam,
      statusKehadiranKeluarOtomatis, seragamKeluar, memprosesKeluar, prosesKeluar, prosesKeluarDenganSeragam, adaLemburApproved
    };
  },
  // ==========================================================================
  // TEMPLATE DIROMBAK (29 Agt 2026, moodboard "Gechoo Mobile Organic", lihat
  // PEDOMAN-GAYA-KERJA.md — pilot Antrean Absensi, disetujui Guru lewat
  // mockup "antrean-absensi-clean.html"). Perubahan:
  //  - Blok Clock In/Clock Out yang tadinya kotak besar (foto besar+grid 2
  //    kolom+dropdown+2 tombol) diringkas jadi 1 baris "event" (foto kecil+
  //    label+jam+tag), TANPA menghilangkan info apapun.
  //  - Dropdown Seragam + tombol Accept (2 langkah) DIGANTI 3 tombol sejajar
  //    Sesuai/Tidak Sesuai/Reject (pakai prosesDenganSeragam dkk, LIHAT
  //    setup() di atas — logic Firestore/validasi TIDAK berubah).
  //  - Sudut kartu/avatar/foto dilebarkan dikit, tombol ikon jadi bulat
  //    penuh — sesuai moodboard, TAPI tag/tombol aksi TETAP sudut sedang
  //    (bukan pil semua).
  // Field/logic Firestore, cekIzinMenu, hapus(), lembur, dst — TIDAK ada
  // yang berubah, cuma tampilannya.
  // ==========================================================================
  template: `
    <div v-if="adaYangPending" class="gc-card" style="border-radius:20px;">
      <div style="display:flex; align-items:center; gap:10px;">
        <img :src="fotoAvatar || 'https://via.placeholder.com/150'" @click="lihatFotoBesar(fotoAvatar)" style="width:40px; height:40px; border-radius:14px; object-fit:cover; border:1px solid var(--line); cursor:pointer; flex-shrink:0;">
        <div style="flex:1; min-width:0;">
          <h4 class="gc-heading" style="font-weight:700; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ data.nama_pegawai || data.nama || 'Karyawan' }}</h4>
          <p style="font-size:9.5px; color:var(--text-faint); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ data.email || '-' }}</p>
        </div>
        <template v-if="adalahFormatBaru">
          <span v-if="data.status_acc_masuk === 'PENDING' && data.status_acc_keluar === 'PENDING'" class="tag warn" style="flex-shrink:0;"><span class="tag-dot"></span>2 menunggu</span>
          <span v-else class="tag warn" style="flex-shrink:0;"><span class="tag-dot"></span>1 menunggu</span>
        </template>
        <span v-else class="tag warn" style="flex-shrink:0;"><span class="tag-dot"></span>Menunggu</span>
      </div>

      <div style="display:flex; gap:12px; font-size:10px; color:var(--text-muted); padding-top:8px; margin-top:8px; border-top:1px solid var(--ivory-dim); flex-wrap:wrap;">
        <span><b>Gudang:</b> {{ data.gudang || '-' }}</span>
        <span><b>Shift:</b> {{ data.nama_shift || '-' }}</span>
        <a v-if="!adalahFormatBaru && data.koordinat" :href="'https://www.google.com/maps?q=' + data.koordinat.lat + ',' + data.koordinat.lng" target="_blank" style="color:var(--burgundy); font-weight:700;"><i class="fas fa-map-marker-alt"></i> Peta</a>
      </div>

      <!-- ============ FORMAT LAMA — 1 event "Hadir" ============ -->
      <template v-if="!adalahFormatBaru">
        <div style="padding-top:8px; margin-top:8px; border-top:1px solid var(--ivory-dim);">
          <div style="display:flex; align-items:center; gap:7px;">
            <span style="font-size:9px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.02em; display:flex; align-items:center; gap:4px; flex-shrink:0;"><i class="fas fa-user-check" style="color:var(--burgundy); font-size:10px;"></i>Hadir</span>
            <span style="font-size:12.5px; font-weight:700; flex-shrink:0;">{{ data.waktu || '-' }}</span>
            <div style="display:flex; flex-wrap:wrap; gap:4px; margin-left:auto; justify-content:flex-end;">
              <span v-if="statusKehadiranOtomatis === 'Ontime'" class="tag ok">Ontime</span>
              <span v-else-if="statusKehadiranOtomatis === 'Terlambat'" class="tag danger">Terlambat</span>
              <span v-if="data.status_radius === 'DALAM RADIUS'" class="tag ok">Radius {{ data.jarak_meter || 0 }}m</span>
              <span v-else-if="data.status_radius === 'DI LUAR RADIUS'" class="tag danger">Radius {{ data.jarak_meter || 0 }}m</span>
              <span v-else-if="data.status_radius === 'LOKASI DINAMIS'" class="tag blue">Lokasi dinamis</span>
            </div>
          </div>
          <div v-if="bolehEdit" class="approve-row">
            <button @click="prosesDenganSeragam('ACC','Sesuai')" :disabled="memproses" class="appr-btn ok"><i class="fas fa-check"></i> Sesuai</button>
            <button @click="prosesDenganSeragam('ACC','Tidak Sesuai')" :disabled="memproses" class="appr-btn warn"><i class="fas fa-check"></i> Tdk Sesuai</button>
            <button @click="proses('REJECT')" :disabled="memproses" class="appr-btn danger"><i class="fas fa-times"></i> Reject</button>
          </div>
        </div>
        <div v-if="bolehHapus" style="display:flex; justify-content:flex-end; margin-top:6px; position:relative;">
          <button @click="toggleMenuAksi" class="icon-btn" style="border-radius:50%; border:none; background:none;" title="Aksi lainnya"><i class="fas fa-ellipsis-vertical"></i></button>
          <div v-if="menuAksiTerbuka" @click="tutupMenuAksi" style="position:fixed; inset:0; z-index:60;"></div>
          <div v-if="menuAksiTerbuka" style="position:absolute; right:0; top:34px; z-index:61; background:var(--surface); border:1px solid var(--line); border-radius:14px; box-shadow:0 10px 24px -6px rgba(31,22,17,.3); padding:6px; min-width:150px;">
            <button @click="tutupMenuAksi(); hapus();" style="width:100%; text-align:left; background:none; border:none; padding:9px 11px; border-radius:9px; font-size:12px; font-weight:600; color:var(--danger); cursor:pointer; display:flex; align-items:center; gap:8px;"><i class="fas fa-trash-alt"></i> Hapus permanen</button>
          </div>
        </div>
      </template>

      <!-- ============ FORMAT BARU — event Clock In & Clock Out terpisah, independen ============ -->
      <template v-else>
        <div style="padding-top:8px; margin-top:8px; border-top:1px solid var(--ivory-dim);">
          <div style="display:flex; align-items:center; gap:7px;">
            <img v-if="data.foto_selfie_masuk" :src="data.foto_selfie_masuk" @click="lihatFotoBesar(data.foto_selfie_masuk)" style="width:24px; height:24px; border-radius:9px; object-fit:cover; border:1px solid var(--line); cursor:pointer; flex-shrink:0;">
            <div v-else style="width:24px; height:24px; border-radius:9px; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; color:var(--text-faint); font-size:11px; flex-shrink:0;"><i class="fas fa-camera"></i></div>
            <span style="font-size:9px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.02em; display:flex; align-items:center; gap:4px; flex-shrink:0;"><i class="fas fa-right-to-bracket" style="color:var(--burgundy); font-size:10px;"></i>Masuk</span>
            <span style="font-size:12.5px; font-weight:700; flex-shrink:0;">{{ data.waktu_masuk || '-' }}</span>
            <div style="display:flex; flex-wrap:wrap; gap:4px; margin-left:auto; justify-content:flex-end;">
              <span v-if="statusKehadiranMasukOtomatis === 'Ontime'" class="tag ok">Ontime</span>
              <span v-else-if="statusKehadiranMasukOtomatis === 'Terlambat'" class="tag danger">Terlambat</span>
              <span v-if="data.status_radius_masuk === 'DI LUAR RADIUS'" class="tag danger">Radius {{ data.jarak_meter_masuk || 0 }}m</span>
              <span v-else-if="data.status_radius_masuk === 'LOKASI DINAMIS'" class="tag blue">Lokasi dinamis</span>
            </div>
          </div>
          <div v-if="data.status_acc_masuk === 'PENDING' && bolehEdit" class="approve-row">
            <button @click="prosesMasukDenganSeragam('ACC','Sesuai')" :disabled="memprosesMasuk" class="appr-btn ok"><i class="fas fa-check"></i> Sesuai</button>
            <button @click="prosesMasukDenganSeragam('ACC','Tidak Sesuai')" :disabled="memprosesMasuk" class="appr-btn warn"><i class="fas fa-check"></i> Tdk Sesuai</button>
            <button @click="prosesMasuk('REJECT')" :disabled="memprosesMasuk" class="appr-btn danger"><i class="fas fa-times"></i> Reject</button>
          </div>
        </div>

        <div style="padding-top:8px; margin-top:8px; border-top:1px solid var(--ivory-dim);">
          <div style="display:flex; align-items:center; gap:7px;">
            <img v-if="data.foto_selfie_keluar" :src="data.foto_selfie_keluar" @click="lihatFotoBesar(data.foto_selfie_keluar)" style="width:24px; height:24px; border-radius:9px; object-fit:cover; border:1px solid var(--line); cursor:pointer; flex-shrink:0;">
            <div v-else style="width:24px; height:24px; border-radius:9px; background:var(--ivory-dim); display:flex; align-items:center; justify-content:center; color:var(--text-faint); font-size:11px; flex-shrink:0;"><i class="fas fa-camera"></i></div>
            <span style="font-size:9px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.02em; display:flex; align-items:center; gap:4px; flex-shrink:0;"><i class="fas fa-right-from-bracket" style="color:var(--burgundy); font-size:10px;"></i>Keluar</span>
            <template v-if="data.waktu_keluar">
              <span style="font-size:12.5px; font-weight:700; flex-shrink:0;">{{ data.waktu_keluar }}</span>
              <div style="display:flex; flex-wrap:wrap; gap:4px; margin-left:auto; justify-content:flex-end;">
                <span v-if="adaLemburApproved" class="tag blue">Lembur</span>
                <span v-else-if="statusKehadiranKeluarOtomatis === 'Ontime'" class="tag ok">Ontime</span>
                <span v-else-if="statusKehadiranKeluarOtomatis === 'Pulang Cepat'" class="tag warn">Pulang Cepat</span>
                <span v-if="data.status_radius_keluar === 'DI LUAR RADIUS'" class="tag danger">Radius {{ data.jarak_meter_keluar || 0 }}m</span>
                <span v-else-if="data.status_radius_keluar === 'LOKASI DINAMIS'" class="tag blue">Lokasi dinamis</span>
              </div>
            </template>
            <span v-else style="font-size:10.5px; color:var(--text-faint); font-style:italic; margin-left:auto;">Belum absen</span>
          </div>
          <div v-if="data.status_acc_keluar === 'PENDING' && bolehEdit" class="approve-row">
            <button @click="prosesKeluarDenganSeragam('ACC','Sesuai')" :disabled="memprosesKeluar" class="appr-btn ok"><i class="fas fa-check"></i> Sesuai</button>
            <button @click="prosesKeluarDenganSeragam('ACC','Tidak Sesuai')" :disabled="memprosesKeluar" class="appr-btn warn"><i class="fas fa-check"></i> Tdk Sesuai</button>
            <button @click="prosesKeluar('REJECT')" :disabled="memprosesKeluar" class="appr-btn danger"><i class="fas fa-times"></i> Reject</button>
          </div>
        </div>

        <div v-if="bolehHapus" style="display:flex; justify-content:flex-end; margin-top:6px;">
          <button @click="hapus" class="icon-btn" style="border-radius:50%; border:none; background:none;" title="Hapus permanen"><i class="fas fa-trash-alt"></i></button>
        </div>
      </template>
    </div>
  `
};

const AppAntreanAbsensi = {
  components: { AntreanAbsensiCard, KolomCari },
  setup() {
    const daftarPending = ref([]);
    const memuat = ref(true);
    const errorMuat = ref('');
    const memuatDataLama = ref(false);
    const infoDataLama = ref('');

    // PEDOMAN KERJA (18 Agt 2026) — Search box SELALU ada. Filter Jenis
    // Pekerjaan & Gudang CUMA muncul buat Owner/Superuser — Admin biasa
    // SUDAH otomatis kefilter lewat window.bolehLihatData (1 jenis
    // pekerjaan + gudang sendiri), jadi dropdown manual buat mereka cuma
    // bikin bingung/redundan. Owner BISA lihat semua (bypass otomatis),
    // makanya dikasih kendali MANUAL buat nyaring sendiri kalau datanya
    // banyak — beda kebutuhan dari Admin biasa. Pola ini WAJIB dicontek
    // sama persis di tabel/kartu-grid antrean lain (Antrean Dakar,
    // Antrean Lembur, dst ke depan).
    const cariNama = ref('');
    const isOwnerRole = computed(() => ['owner', 'superuser'].includes((window.currentUser.role || '').toLowerCase()));
    const filterJenisPekerjaanOwner = ref('ALL');
    const filterGudangOwner = ref('ALL');
    const opsiJenisPekerjaanOwner = ref([]);
    const opsiGudangOwner = ref([]);
    // BARU (29 Agt 2026, moodboard "Gechoo Mobile Organic") — dropdown
    // filter Owner yang tadinya SELALU tampil sekarang di belakang 1 ikon
    // filter (toggle show/hide), biar baris cari lebih ringkas. Cuma
    // kosmetik — filterJenisPekerjaanOwner/filterGudangOwner & logic
    // filternya di daftarPendingTersaring TIDAK berubah.
    const filterTerbuka = ref(false);
    function toggleFilterTerbuka() { filterTerbuka.value = !filterTerbuka.value; }
    const adaFilterAktif = computed(() => filterJenisPekerjaanOwner.value !== 'ALL' || filterGudangOwner.value !== 'ALL');
    const daftarPendingTersaring = computed(() => {
      let hasil = daftarPending.value;
      const cari = cariNama.value.trim().toLowerCase();
      if (cari) hasil = hasil.filter(item => (item.data.nama_pegawai || item.data.nama || '').toLowerCase().includes(cari));
      if (isOwnerRole.value) {
        if (filterJenisPekerjaanOwner.value !== 'ALL') hasil = hasil.filter(item => item.jenisPekerjaan === filterJenisPekerjaanOwner.value);
        if (filterGudangOwner.value !== 'ALL') hasil = hasil.filter(item => item.data.gudang === filterGudangOwner.value);
      }
      return hasil;
    });

    async function muat() {
      memuat.value = true;
      errorMuat.value = '';
      try {
        // BARU (18 Agt 2026) — 2 query LANGSUNG cari yang pending, BUKAN
        // fetch seluruh histori absensi lagi. Lihat catatan lengkap di
        // header file.
        const [snapBaru, snapLama] = await Promise.all([
          getDocs(query(collection(db, "absensi"), where("ada_pending", "==", true))),
          getDocs(query(collection(db, "absensi"), where("status_acc", "==", "PENDING")))
        ]);

        // DIROMBAK (19 Agt 2026) — dulu SELALU fetch-semua "users" duluan
        // demi peta email->jenis_pekerjaan (dipakai filter §15, absensi
        // tidak simpan info ini). SEKARANG js/vue-camera.js sudah titip
        // field jenis_pekerjaan LANGSUNG di tiap dokumen absensi baru —
        // jadi users CUMA dibaca kalau BENERAN masih ada dokumen PENDING
        // yang belum punya field ini sendiri (dokumen sangat lama, dari
        // sebelum perbaikan ini dipasang). Begitu dokumen lama itu habis
        // diproses (ACC/Reject), baca users di sini akan OTOMATIS
        // berhenti sepenuhnya — TANPA perlu ubah kode lagi nanti.
        const semuaDokPending = [];
        snapBaru.forEach(d => semuaDokPending.push(d));
        snapLama.forEach(d => { if (d.data().status !== "LEMBUR (CLOCK IN)") semuaDokPending.push(d); });
        const adaYangBelumPunyaJP = semuaDokPending.some(d => !d.data().jenis_pekerjaan);

        let petaJenisPekerjaan = {};
        if (adaYangBelumPunyaJP) {
          const qUsers = await getDocs(collection(db, "users"));
          qUsers.forEach(u => { petaJenisPekerjaan[u.data().email] = u.data().jenis_pekerjaan || ''; });
        }
        function ambilJP(d) { return d.jenis_pekerjaan || petaJenisPekerjaan[d.email] || ''; }

        const list = [];
        snapBaru.forEach(docSnap => {
          const d = docSnap.data();
          if (!window.bolehLihatData(ambilJP(d), d.gudang)) return;
          list.push({ id: docSnap.id, data: d, jenisPekerjaan: ambilJP(d) });
        });
        snapLama.forEach(docSnap => {
          const d = docSnap.data();
          // Lembur SENGAJA dikecualikan (17 Agt 2026) — ditangani terpisah
          // di Antrean Lembur (info relevan beda: jam mulai/selesai
          // diajukan, bukan radius/koordinat seperti di sini).
          if (d.status === "LEMBUR (CLOCK IN)") return;
          if (!window.bolehLihatData(ambilJP(d), d.gudang)) return;
          list.push({ id: docSnap.id, data: d, jenisPekerjaan: ambilJP(d) });
        });
        daftarPending.value = list;

        // Opsi dropdown filter khusus Owner — cuma dimuat kalau memang
        // Owner (hemat, Admin biasa tidak pernah butuh ini).
        if (isOwnerRole.value) {
          opsiJenisPekerjaanOwner.value = window.ambilMasterList ? await window.ambilMasterList('jenis_pekerjaan') : [];
          const qGudang = await getDocs(collection(db, "master_gudang"));
          const listGudang = [];
          qGudang.forEach(g => listGudang.push(g.data().nama_gudang));
          opsiGudangOwner.value = listGudang;
        }
      } catch (e) {
        console.error("Error muat antrean absensi:", e);
        errorMuat.value = 'Gagal memuat data. Cek Console untuk detail (mungkin perlu index Firestore baru — lihat link di pesan error aslinya).';
      }
      memuat.value = false;
    }

    // Jaring pengaman MANUAL (bukan otomatis) — cari dokumen SANGAT lama
    // yang belum sempat punya status_acc/ada_pending SAMA SEKALI, jadi
    // tidak akan pernah ketemu lewat where() di muat() di atas. Fetch-semua
    // SEKALI kalau diklik, bukan default tiap buka halaman.
    async function cekDataSangatLama() {
      memuatDataLama.value = true;
      infoDataLama.value = '';
      try {
        const snap = await getDocs(collection(db, "absensi"));
        const perluDiperbaiki = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          if (d.status === "LEMBUR (CLOCK IN)") return;
          const sudahFormatBaru = d.ada_pending !== undefined;
          const sudahFormatLama = d.status_acc !== undefined;
          if (!sudahFormatBaru && !sudahFormatLama) perluDiperbaiki.push(docSnap.id);
        });
        if (perluDiperbaiki.length === 0) {
          infoDataLama.value = 'Tidak ada data sangat lama yang perlu diperbaiki. Aman.';
        } else {
          for (const id of perluDiperbaiki) {
            updateDoc(doc(db, "absensi", id), { status_acc: "PENDING" }).catch(() => {});
          }
          infoDataLama.value = `Ketemu & diperbaiki ${perluDiperbaiki.length} data sangat lama. Klik Refresh buat lihat di daftar.`;
        }
      } catch (e) {
        console.error("Gagal cek data sangat lama:", e);
        infoDataLama.value = 'Gagal memeriksa data sangat lama.';
      }
      memuatDataLama.value = false;
    }

    onMounted(async () => { await window.authReady; muat(); });
    return {
      daftarPending, daftarPendingTersaring, memuat, errorMuat, muat, memuatDataLama, infoDataLama, cekDataSangatLama,
      cariNama, isOwnerRole, filterJenisPekerjaanOwner, filterGudangOwner, opsiJenisPekerjaanOwner, opsiGudangOwner,
      filterTerbuka, toggleFilterTerbuka, adaFilterAktif
    };
  },
  template: `
    <div class="gc-card" style="display:flex; justify-content:space-between; align-items:center; background:var(--pink); border:none; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
      <div>
        <h3 class="gc-heading" style="font-size:13.5px; font-weight:700; color:var(--burgundy-dark);"><i class="fas fa-clock" style="margin-right:8px;"></i> Antrean validasi absensi</h3>
        <p style="font-size:10.5px; color:var(--mahogany-soft); margin-top:2px;">Klik Refresh untuk melihat pengajuan absensi terbaru.</p>
      </div>
      <div style="display:flex; gap:8px;">
        <button @click="cekDataSangatLama" :disabled="memuatDataLama" class="btn-outline" title="Cek sekali data sangat lama yang mungkin belum kebaca"><i class="fas fa-magnifying-glass" style="margin-right:6px;"></i> Cek Data Sangat Lama</button>
        <button @click="muat" class="btn-outline filled"><i class="fas fa-sync-alt" style="margin-right:6px;"></i> Refresh</button>
      </div>
    </div>
    <p v-if="infoDataLama" style="font-size:11px; color:var(--text-muted); margin:-10px 0 16px; padding:8px 12px; background:var(--ivory-dim); border-radius:10px;">{{ infoDataLama }}</p>

    <div style="display:flex; gap:8px; align-items:center;" :style="{ marginBottom: (isOwnerRole && filterTerbuka) ? '8px' : '16px' }">
      <div style="flex:1; min-width:0;"><kolom-cari v-model="cariNama" placeholder="Cari nama karyawan..." /></div>
      <button v-if="isOwnerRole" @click="toggleFilterTerbuka" class="icon-btn" style="border-radius:50%; position:relative; flex-shrink:0;" title="Filter (Jenis Pekerjaan/Gudang)">
        <i class="fas fa-filter"></i>
        <span v-if="adaFilterAktif" style="position:absolute; top:-2px; right:-2px; width:8px; height:8px; border-radius:50%; background:var(--danger); border:1.5px solid var(--ivory);"></span>
      </button>
    </div>
    <div v-if="isOwnerRole && filterTerbuka" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;">
      <select v-model="filterJenisPekerjaanOwner" style="flex:1; min-width:150px; padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
        <option value="ALL">Semua jenis pekerjaan</option>
        <option v-for="jp in opsiJenisPekerjaanOwner" :key="jp" :value="jp">{{ jp }}</option>
      </select>
      <select v-model="filterGudangOwner" style="flex:1; min-width:150px; padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
        <option value="ALL">Semua gudang</option>
        <option v-for="g in opsiGudangOwner" :key="g" :value="g">{{ g }}</option>
      </select>
    </div>

    <div v-if="memuat && daftarPending.length === 0" style="text-align:center; padding:40px 0; color:var(--text-faint);">
      <i class="fas fa-spinner fa-spin" style="font-size:26px; margin-bottom:10px; display:block;"></i><p style="font-size:12px;">Memuat antrean validasi absensi...</p>
    </div>
    <div v-else-if="errorMuat" style="text-align:center; padding:40px 0; color:var(--danger); font-size:12px; background:var(--danger-light); border-radius:18px;">{{ errorMuat }}</div>
    <div v-else-if="daftarPending.length === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px;">
      <i class="fas fa-glass-cheers" style="font-size:40px; color:var(--blue-deep); margin-bottom:12px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">Semua absensi telah tervalidasi</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">Tidak ada antrean absensi baru yang perlu diperiksa.</p>
    </div>
    <div v-else-if="daftarPendingTersaring.length === 0" style="text-align:center; padding:56px 0; background:var(--surface); border:1px dashed var(--line); border-radius:18px;">
      <i class="fas fa-filter-circle-xmark" style="font-size:34px; color:var(--text-faint); margin-bottom:12px; display:block;"></i>
      <h4 class="gc-heading" style="font-weight:700; font-size:13.5px;">Tidak ada yang cocok</h4>
      <p style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">Coba ubah kata kunci pencarian atau filter yang aktif.</p>
    </div>
    <div v-else style="gap:14px;" class="grid grid-cols-1 md:grid-cols-2">
      <antrean-absensi-card
        v-for="item in daftarPendingTersaring" :key="item.id"
        :doc-id="item.id" :data="item.data"
        @diproses="muat"
      />
    </div>
  `
};

let vmAntreanAbsensi = null;
window.pastikanMountAntreanAbsensi = function() {
  if (vmAntreanAbsensi) return;
  const mountPoint = document.getElementById('vue-antrean-absensi');
  if (mountPoint) vmAntreanAbsensi = createApp(AppAntreanAbsensi).mount('#vue-antrean-absensi');
};
window.refreshAntreanAbsensi = function() { if (vmAntreanAbsensi) vmAntreanAbsensi.muat(); };
