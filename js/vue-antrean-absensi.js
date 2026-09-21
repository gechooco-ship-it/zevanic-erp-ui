// js/vue-antrean-absensi.js
// Master Absensi > Antrean Absensi: validasi ACC/Reject kehadiran (Hadir,
// seragam, ontime). Clock In dan Clock Out diproses sebagai 2 aksi independen.
//
// Koleksi & field:
// - absensi: dua query pending — where(ada_pending==true) untuk dokumen
//   gabungan, where(status_acc=='PENDING') untuk format lama. Menulis
//   status_acc_masuk/keluar, status_kehadiran_*, seragam_*, validated_*,
//   ada_pending.
// - users (chunked where email 'in'): jenis_pekerjaan & gudang_penempatan.
// - master_shift (chunked where nama_shift 'in') & master_gudang: jam shift
//   dan opsi filter.
//
// Jebakan:
// - IZIN/CUTI/LEMBUR DIKECUALIKAN di sini — lihat vue-antrean-lembur.js.
// - ada_pending wajib dihitung ulang dari pasangan status masuk+keluar tiap
//   update; yang tersangkut (dua sisi sudah diproses) diperbaiki di muat().
// - Lookup shift & Lembur dihitung SEKALI di induk lalu dioper lewat prop
//   shiftInfo/lemburTanggal — kartu dilarang query sendiri (bug N+1).
// - "Cek Data Sangat Lama" fetch SELURUH koleksi absensi; sengaja manual.

import { createApp, ref, computed, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
// KolomCari (pil, dipakai bareng Menu Lengkap/Atur Favorit) GANTI kolom cari
// hand-rolled.
import { KolomCari } from './vue-components.js?v=13';

// Diekspor juga (dipakai test) — bandingkan jam aktual (Firestore Timestamp) vs
// jam jadwal shift ("HH:MM" dari master_shift). Tanggal dasar diambil dari
// `waktuAnchorTs` (SELALU waktu Clock In) supaya shift malam yang nyebrang tengah
// malam tidak salah dibaca; tipe 'masuk'/'keluar' membalik arah perbandingan.
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
    // Kalau batas (jam_keluar) yang dibangun di TANGGAL Clock In itu <= Clock In
    // itu sendiri, berarti shift ini nyebrang tengah malam -> WAJIB didorong ke
    // hari berikutnya, biar perbandingan kronologis benar (bukan cuma bandingkan
    // jam mentah 0-23).
    if (batasJadwal <= anchor) batasJadwal.setDate(batasJadwal.getDate() + 1);
    return aktual >= batasJadwal ? 'Ontime' : 'Pulang Cepat';
  }
  return aktual <= batasJadwal ? 'Ontime' : 'Terlambat';
}

// Diekspor juga (dipakai test) — hitung ulang ada_pending dari status
// masuk+keluar TERBARU (bukan dari data lama di props, supaya benar walau salah
// satu baru saja diproses barengan).
export function hitungAdaPending(statusMasuk, statusKeluar) {
  return statusMasuk === "PENDING" || statusKeluar === "PENDING";
}

const AntreanAbsensiCard = {
  props: {
    docId: { type: String, required: true },
    data: { type: Object, required: true },
    // lihat catatan lengkap di jamShift/ adaLemburApproved di bawah: dua prop
    // ini dihitung SEKALI di induk (AppAntreanAbsensi.muat) untuk seluruh
    // daftar sekaligus, bukan 1 query Firestore per kartu (N+1).
    shiftInfo: { type: Object, default: () => ({ masuk: null, keluar: null }) },
    lemburTanggal: { type: Array, default: () => [] }
  },
  emits: ['diproses'],
  setup(props, { emit }) {
    // Format gabungan dipakai kalau field ada_pending ADA di dokumennya (cuma
    // dokumen hasil js/vue-camera.js terkini yang punya field ini).
    const adalahFormatBaru = computed(() => props.data.ada_pending !== undefined);

    // JARING PENGAMAN — kalau karena SEBAB APAPUN item ini ke-query padahal
    // KEDUA sisi (masuk & keluar) sudah tidak PENDING lagi, JANGAN render kartu
    // kosong tanpa Accept/Reject sama sekali . Kartu SEMBUNYI total dari
    // tampilan kalau tidak ada satupun sisi yang butuh diproses.
    // Status KINI per sisi — diisi saat tombol berhasil, supaya kartu langsung
    // berubah tanpa menunggu muat ulang seluruh antrean (dulu muat ulang ini
    // lambat, tombol keburu aktif lagi dan terpencet 2-3 kali).
    const statusLamaKini = ref(props.data.status_acc);
    const statusMasukKini = ref(props.data.status_acc_masuk);
    const statusKeluarKini = ref(props.data.status_acc_keluar);
    const adaYangPending = computed(() => {
      if (!adalahFormatBaru.value) return statusLamaKini.value === 'PENDING' || statusLamaKini.value === undefined;
      return statusMasukKini.value === 'PENDING' || statusKeluarKini.value === 'PENDING';
    });
    // Badge hasil validasi di sisi yang sudah diproses, beda dari badge Ontime.
    function teksValidasi(status, nilaiSeragam) {
      if (status === 'REJECT') return 'Ditolak';
      return nilaiSeragam === 'Tidak Sesuai' ? 'Seragam tdk sesuai' : 'Seragam sesuai';
    }
    function kelasValidasi(status, nilaiSeragam) {
      if (status === 'REJECT') return 'danger';
      return nilaiSeragam === 'Tidak Sesuai' ? 'warn' : 'ok';
    }

    function lihatFotoBesar(url) {
      if (url && window.bukaPreviewFoto) window.bukaPreviewFoto(url);
    }
    const bolehEdit = computed(() => window.cekIzinMenu('antrean_absensi', 'edit') !== false);
    const bolehHapus = computed(() => window.cekIzinMenu('antrean_absensi', 'delete') !== false);

    // avatar ringkasan di header kartu mengutamakan foto_selfie_keluar (Clock Out,
    // kronologis lebih baru dari Clock In pada record yang sama), baru jatuh ke
    // foto_selfie_masuk lalu field lama (foto_selfie/foto).
    const fotoAvatar = computed(() =>
      props.data.foto_selfie_keluar || props.data.foto_selfie_masuk || props.data.foto_selfie || props.data.foto || ''
    );
    const menuAksiTerbuka = ref(false);
    function toggleMenuAksi() { menuAksiTerbuka.value = !menuAksiTerbuka.value; }
    function tutupMenuAksi() { menuAksiTerbuka.value = false; }

    // Status Kehadiran dihitung OTOMATIS oleh sistem (jam Clock In/Out asli vs jadwal
    // shift di master_shift); admin cuma manual cek Seragam. Jam shift untuk semua
    // nama_shift yang kepakai dihitung SEKALI di induk (muat/petaShiftInfo) lalu
    // dikirim turun lewat prop shiftInfo — kartu dilarang query sendiri (bug N+1).
    const jamShift = computed(() => props.shiftInfo || { masuk: null, keluar: null });

    // Kalau ada pengajuan LEMBUR yang sudah di-ACC untuk email+tanggal yang sama,
    // badge Clock Out jadi "Lembur" — Lembur sesi terpisah (status "LEMBUR (CLOCK
    // IN)", koleksi absensi sama tapi dokumen beda), jadi dicek silang. Dihitung
    // sekali di induk (petaLemburTanggal) dan dioper lewat prop lemburTanggal.
    const adaLemburApproved = computed(() => {
      const anchorTs = props.data.waktu_masuk_ts || props.data.waktu_ts;
      if (!anchorTs || typeof anchorTs.toDate !== 'function') return false;
      const tglAnchor = anchorTs.toDate().toDateString();
      return (props.lemburTanggal || []).includes(tglAnchor);
    });

    // FORMAT LAMA: 1 status_acc tunggal — juga dipakai IZIN/CUTI/LEMBUR selamanya,
    // bukan migrasi sementara. Status Kehadiran otomatis CUMA dihitung kalau record
    // ini benar HADIR (Clock In); IZIN/CUTI/LEMBUR dibiarkan null (tampil '-').
    const statusKehadiranOtomatis = computed(() => {
      if (props.data.status !== 'HADIR (CLOCK IN)') return null;
      return hitungStatusKehadiran(props.data.waktu_ts, props.data.waktu_ts, jamShift.value.masuk, 'masuk');
    });
    const seragam = ref(props.data.seragam || 'Sesuai');
    const memproses = ref(false);
    // dulu pilih Seragam (dropdown) & Accept itu 2 langkah terpisah. Sekarang 3
    // tombol sejajar (Sesuai/Tidak Sesuai/Reject) — 2 yang pertama SAMA-SAMA
    // accept, cuma nilai seragam yang ikut disimpan beda. Reject TIDAK mengubah
    // seragam (proses('REJECT') apa adanya, sama seperti sebelumnya).
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
        statusLamaKini.value = statusAcc;
        emit('diproses', { id: props.docId, masihPending: false });
      } catch (e) {
        console.error("Gagal update ACC:", e);
        alert("Terjadi kesalahan sistem saat memproses validasi.");
      }
      memproses.value = false;
    }

    // FORMAT GABUNGAN: masuk & keluar diproses independen
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
          // Pakai status KELUAR kini (bukan props lama) — benar walau keluar
          // sudah diproses duluan di kartu yang sama.
          ada_pending: hitungAdaPending(statusAcc, statusKeluarKini.value)
        });
        statusMasukKini.value = statusAcc;
        emit('diproses', { id: props.docId, masihPending: adaYangPending.value });
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
          ada_pending: hitungAdaPending(statusMasukKini.value, statusAcc)
        });
        statusKeluarKini.value = statusAcc;
        emit('diproses', { id: props.docId, masihPending: adaYangPending.value });
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
      if (window.hapusAbsensi) window.hapusAbsensi(props.docId).then(() => emit('diproses', { id: props.docId, masihPending: false }));
    }

    return {
      adalahFormatBaru, adaYangPending, statusMasukKini, statusKeluarKini, teksValidasi, kelasValidasi, lihatFotoBesar, hapus, bolehEdit, bolehHapus,
      fotoAvatar, menuAksiTerbuka, toggleMenuAksi, tutupMenuAksi, jamShift,
      statusKehadiranOtomatis, seragam, memproses, proses, prosesDenganSeragam,
      statusKehadiranMasukOtomatis, seragamMasuk, memprosesMasuk, prosesMasuk, prosesMasukDenganSeragam,
      statusKehadiranKeluarOtomatis, seragamKeluar, memprosesKeluar, prosesKeluar, prosesKeluarDenganSeragam, adaLemburApproved
    };
  },

  // Kartu: blok Clock In/Clock Out tampil sebagai 1 baris "event" (foto kecil +
  // label + jam + tag). Seragam dipilih lewat 3 tombol sejajar Sesuai/Tidak Sesuai/
  // Reject (prosesDenganSeragam dkk, lihat setup). Tag & tombol aksi tetap sudut
  // sedang, bukan pil semua.

  template: `
    <div v-if="adaYangPending" class="gc-card" style="border-radius:20px;">
      <div style="display:flex; align-items:center; gap:10px;">
        <img :src="fotoAvatar || 'https://via.placeholder.com/150'" @click="lihatFotoBesar(fotoAvatar)" style="width:40px; height:40px; border-radius:14px; object-fit:cover; border:1px solid var(--line); cursor:pointer; flex-shrink:0;">
        <div style="flex:1; min-width:0;">
          <h4 class="gc-heading" style="font-weight:700; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ data.nama_pegawai || data.nama || 'Karyawan' }}</h4>
          <!-- baris "email" tidak ditampilkan; yang tampil nama Gudang lalu nama Shift +
            jam shift (jamShift dari prop shiftInfo). -->
          <p style="font-size:9.5px; color:var(--text-faint); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ data.gudang || '-' }}</p>
          <p style="font-size:9.5px; color:var(--text-faint); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{{ data.nama_shift || '-' }}<span v-if="jamShift.masuk && jamShift.keluar"> &middot; {{ jamShift.masuk }}&ndash;{{ jamShift.keluar }}</span></p>
        </div>
        <template v-if="adalahFormatBaru">
          <span v-if="statusMasukKini === 'PENDING' && statusKeluarKini === 'PENDING'" class="tag warn" style="flex-shrink:0;"><span class="tag-dot"></span>2 menunggu</span>
          <span v-else class="tag warn" style="flex-shrink:0;"><span class="tag-dot"></span>1 menunggu</span>
        </template>
        <span v-else class="tag warn" style="flex-shrink:0;"><span class="tag-dot"></span>Menunggu</span>
      </div>

      <div v-if="!adalahFormatBaru && data.koordinat" style="padding-top:6px; margin-top:8px; border-top:1px solid var(--ivory-dim);">
        <a :href="'https://www.google.com/maps?q=' + data.koordinat.lat + ',' + data.koordinat.lng" target="_blank" style="font-size:9.5px; color:var(--burgundy); font-weight:700;"><i class="fas fa-map-marker-alt"></i> Lihat lokasi di Peta</a>
      </div>

      <!-- FORMAT LAMA — 1 event "Hadir" -->
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

      <!-- FORMAT GABUNGAN — event Clock In & Clock Out terpisah, independen -->
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
              <span v-if="statusMasukKini && statusMasukKini !== 'PENDING'" class="tag" :class="kelasValidasi(statusMasukKini, seragamMasuk)"><i class="fas fa-check-double" style="margin-right:3px;"></i>{{ teksValidasi(statusMasukKini, seragamMasuk) }}</span>
              <span v-if="data.status_radius_masuk === 'DI LUAR RADIUS'" class="tag danger">Radius {{ data.jarak_meter_masuk || 0 }}m</span>
              <span v-else-if="data.status_radius_masuk === 'LOKASI DINAMIS'" class="tag blue">Lokasi dinamis</span>
            </div>
          </div>
          <p v-if="statusMasukKini === 'PENDING' && bolehEdit" style="font-size:9.5px; font-weight:700; color:var(--text-muted); margin-top:8px;">Validasi Clock Masuk:</p>
          <div v-if="statusMasukKini === 'PENDING' && bolehEdit" class="approve-row" style="margin-top:4px;">
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
                <span v-if="statusKeluarKini && statusKeluarKini !== 'PENDING'" class="tag" :class="kelasValidasi(statusKeluarKini, seragamKeluar)"><i class="fas fa-check-double" style="margin-right:3px;"></i>{{ teksValidasi(statusKeluarKini, seragamKeluar) }}</span>
                <span v-if="data.status_radius_keluar === 'DI LUAR RADIUS'" class="tag danger">Radius {{ data.jarak_meter_keluar || 0 }}m</span>
                <span v-else-if="data.status_radius_keluar === 'LOKASI DINAMIS'" class="tag blue">Lokasi dinamis</span>
              </div>
            </template>
            <span v-else style="font-size:10.5px; color:var(--text-faint); font-style:italic; margin-left:auto;">Belum absen</span>
          </div>
          <p v-if="statusKeluarKini === 'PENDING' && bolehEdit" style="font-size:9.5px; font-weight:700; color:var(--text-muted); margin-top:8px;">Validasi Clock Keluar:</p>
          <div v-if="statusKeluarKini === 'PENDING' && bolehEdit" class="approve-row" style="margin-top:4px;">
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
    // hasil batch jam shift & Lembur-approved buat SEMUA kartu (dihitung sekali
    // per muat, lihat di bawah), dikirim turun ke tiap AntreanAbsensiCard lewat
    // prop. Lihat catatan lengkap di komponen kartu
    // (jamShift/adaLemburApproved).
    const petaShiftInfo = ref({});
    const petaLemburTanggal = ref({});

    // PEDOMAN KERJA — Search box SELALU ada. Filter Jenis Pekerjaan & Gudang CUMA
    // muncul buat Owner/Superuser; Admin biasa sudah otomatis kefilter lewat
    // window.bolehLihatData, jadi dropdown manual cuma bikin bingung. Pola ini WAJIB
    // dicontek di kartu-grid antrean lain (Antrean Dakar, Antrean Lembur, dst).
    const cariNama = ref('');
    const isOwnerRole = computed(() => ['owner', 'superuser'].includes((window.currentUser.role || '').toLowerCase()));
    const filterJenisPekerjaanOwner = ref('ALL');
    const filterGudangOwner = ref('ALL');
    const opsiJenisPekerjaanOwner = ref([]);
    const opsiGudangOwner = ref([]);
    // Dropdown filter Owner ada di belakang tombol oval titik-tiga "menu lainnya"
    // (menuTerbuka) yang juga menampung Cek Data Sangat Lama & Refresh. Ref
    // filterJenisPekerjaanOwner/filterGudangOwner & logic filter di
    // daftarPendingTersaring tidak ikut berubah.
    const menuTerbuka = ref(false);
    function toggleMenuTerbuka() { menuTerbuka.value = !menuTerbuka.value; }
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
        // 2 query LANGSUNG cari yang pending, BUKAN fetch seluruh histori
        // absensi lagi. Lihat catatan lengkap di header file.
        const [snapBaru, snapLama] = await Promise.all([
          getDocs(query(collection(db, "absensi"), where("ada_pending", "==", true))),
          getDocs(query(collection(db, "absensi"), where("status_acc", "==", "PENDING")))
        ]);

        // Koleksi `users` CUMA dibaca kalau masih ada dokumen PENDING yang belum punya
        // field jenis_pekerjaan sendiri (vue-camera.js sudah menitipkannya di tiap
        // dokumen absensi baru). Bacanya pun query bertarget where("email","in",[..])
        // dipotong 30 per query (batas Firestore), bukan full fetch koleksi users.
        const semuaDokPending = [];
        snapBaru.forEach(d => semuaDokPending.push(d));
        // IZIN/CUTI SEKARANG JUGA dikecualikan dari sini, sama seperti LEMBUR
        // (lihat catatan lengkap di loop snapLama.forEach di bawah) — pindah ke
        // tab gabungan "Antrean Izin/Cuti/Lembur" (js/vue-antrean-lembur.js,
        // tetap nama file lama).
        snapLama.forEach(d => {
          const st = d.data().status;
          if (st === "LEMBUR (CLOCK IN)" || st === "IZIN" || st === "CUTI") return;
          semuaDokPending.push(d);
        });
        const emailPerluJP = [...new Set(
          semuaDokPending.filter(d => !d.data().jenis_pekerjaan && d.data().email).map(d => d.data().email)
        )];

        let petaJenisPekerjaan = {};
        const UKURAN_POTONGAN_EMAIL = 30; // batas Firestore where(field,'in',[...])
        for (let i = 0; i < emailPerluJP.length; i += UKURAN_POTONGAN_EMAIL) {
          const potongan = emailPerluJP.slice(i, i + UKURAN_POTONGAN_EMAIL);
          const qUsers = await getDocs(query(collection(db, "users"), where("email", "in", potongan)));
          qUsers.forEach(u => { petaJenisPekerjaan[u.data().email] = u.data().jenis_pekerjaan || ''; });
        }
        function ambilJP(d) { return d.jenis_pekerjaan || petaJenisPekerjaan[d.email] || ''; }

        const list = [];
        const idTersangkut = [];
        snapBaru.forEach(docSnap => {
          const d = docSnap.data();
          // Tersangkut: kartunya sembunyi (adaYangPending false) tapi ikut terhitung.
          if (!hitungAdaPending(d.status_acc_masuk, d.status_acc_keluar)) { idTersangkut.push(docSnap.id); return; }
          if (!window.bolehLihatData(ambilJP(d), d.gudang)) return;
          list.push({ id: docSnap.id, data: d, jenisPekerjaan: ambilJP(d) });
        });
        snapLama.forEach(docSnap => {
          const d = docSnap.data();
          // LEMBUR, IZIN & CUTI SENGAJA dikecualikan di sini — ketiganya ditangani tab
          // "Antrean Izin/Cuti/Lembur" (info relevannya beda: jam mulai/selesai diajukan,
          // bukan radius/koordinat). Lihat js/vue-antrean-lembur.js yang isinya gabungan
          // ketiganya.
          if (d.status === "LEMBUR (CLOCK IN)" || d.status === "IZIN" || d.status === "CUTI") return;
          if (!window.bolehLihatData(ambilJP(d), d.gudang)) return;
          list.push({ id: docSnap.id, data: d, jenisPekerjaan: ambilJP(d) });
        });
        // jam shift & status Lembur approved dihitung SEKALI di sini buat
        // SELURUH daftar sekaligus (bukan per-kartu lagi, lihat catatan panjang
        // di AntreanAbsensiCard). Chunked where(.,'in',..) pola sama seperti
        // petaJenisPekerjaan di atas.
        const UKURAN_POTONGAN_SHIFT = 30; // batas Firestore where(field,'in',[...])
        const distinctShift = [...new Set(list.map(item => item.data.nama_shift).filter(Boolean))];
        const petaShift = {};
        for (let i = 0; i < distinctShift.length; i += UKURAN_POTONGAN_SHIFT) {
          const potongan = distinctShift.slice(i, i + UKURAN_POTONGAN_SHIFT);
          const snapShift = await getDocs(query(collection(db, "master_shift"), where("nama_shift", "in", potongan)));
          snapShift.forEach(s => {
            const sd = s.data();
            petaShift[sd.nama_shift] = { masuk: sd.jam_masuk || null, keluar: sd.jam_keluar || null };
          });
        }
        petaShiftInfo.value = petaShift;

        const UKURAN_POTONGAN_LEMBUR = 30; // batas Firestore where(field,'in',[...])
        const distinctEmailLembur = [...new Set(list.map(item => item.data.email).filter(Boolean))];
        const petaLembur = {};
        for (let i = 0; i < distinctEmailLembur.length; i += UKURAN_POTONGAN_LEMBUR) {
          const potongan = distinctEmailLembur.slice(i, i + UKURAN_POTONGAN_LEMBUR);
          const snapLembur = await getDocs(query(collection(db, "absensi"),
            where("email", "in", potongan), where("status", "==", "LEMBUR (CLOCK IN)"), where("status_acc", "==", "ACC")));
          snapLembur.forEach(d => {
            const dd = d.data();
            const wl = dd.waktu_ts;
            if (wl && typeof wl.toDate === 'function') {
              if (!petaLembur[dd.email]) petaLembur[dd.email] = [];
              petaLembur[dd.email].push(wl.toDate().toDateString());
            }
          });
        }
        petaLemburTanggal.value = petaLembur;

        // Paling lama di atas, supaya yang tertinggal dikerjakan duluan.
        const waktuMs = x => { const t = x.data.waktu_masuk_ts || x.data.waktu_ts; return t && typeof t.toMillis === 'function' ? t.toMillis() : 0; };
        list.sort((a, b) => waktuMs(a) - waktuMs(b));
        daftarPending.value = list;
        // Perbaiki diam-diam, best-effort: gagal (mis. role tanpa izin tulis) tidak
        // mengganggu tampilan karena dokumennya sudah dibuang dari daftar di atas.
        idTersangkut.forEach(id => updateDoc(doc(db, "absensi", id), { ada_pending: false }).catch(() => {}));
        if (idTersangkut.length) console.info(`Antrean Absensi: ${idTersangkut.length} dokumen ada_pending tersangkut diperbaiki.`);

        // Opsi dropdown filter khusus Owner — cuma dimuat kalau memang Owner
        // (hemat, Admin biasa tidak pernah butuh ini).
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

    // Jaring pengaman MANUAL (bukan otomatis) — cari dokumen SANGAT lama yang
    // belum sempat punya status_acc/ada_pending SAMA SEKALI, jadi tidak akan
    // pernah ketemu lewat where di muat di atas. Fetch-semua SEKALI kalau
    // diklik, bukan default tiap buka halaman.
    async function cekDataSangatLama() {
      memuatDataLama.value = true;
      infoDataLama.value = '';
      try {
        const snap = await getDocs(collection(db, "absensi"));
        const perluDiperbaiki = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          // IZIN/CUTI ikut dikecualikan sama seperti LEMBUR — diperbaiki lewat
          // "Cek Data Sangat Lama" di tab Antrean Izin/Cuti/Lembur sendiri
          // (js/vue-antrean-lembur.js), bukan di sini.
          if (d.status === "LEMBUR (CLOCK IN)" || d.status === "IZIN" || d.status === "CUTI") return;
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

    // Kartu selesai dibuang dari daftar lokal saja — tanpa muat ulang seluruh
    // antrean, yang lambat dan membuat badge/kartu telat berubah.
    function setelahDiproses(info) {
      if (!info || info.masihPending) return;
      daftarPending.value = daftarPending.value.filter(item => item.id !== info.id);
    }

    onMounted(async () => { await window.authReady; muat(); });
    return {
      setelahDiproses,
      daftarPending, daftarPendingTersaring, memuat, errorMuat, muat, memuatDataLama, infoDataLama, cekDataSangatLama,
      cariNama, isOwnerRole, filterJenisPekerjaanOwner, filterGudangOwner, opsiJenisPekerjaanOwner, opsiGudangOwner,
      menuTerbuka, toggleMenuTerbuka, adaFilterAktif, petaShiftInfo, petaLemburTanggal
    };
  },
  // Desain global layar ini: tanpa kartu deskripsi besar, banner pink dipadatkan 1
  // baris di bawah kolom cari, dan tombol oval titik-tiga "menu lainnya"
  // (gc-overflow-btn) menampung Filter Owner + Cek Data Sangat Lama + Refresh.

  template: `
    <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
      <div style="flex:1; min-width:0;"><kolom-cari v-model="cariNama" placeholder="Cari nama karyawan..." /></div>
      <button @click="toggleMenuTerbuka" class="gc-overflow-btn" title="Menu lainnya">
        <i class="fas fa-ellipsis"></i>
        <span v-if="adaFilterAktif" class="gc-overflow-dot"></span>
      </button>
      <div v-if="menuTerbuka" @click="toggleMenuTerbuka" class="gc-overflow-backdrop"></div>
      <div v-if="menuTerbuka" class="gc-overflow-panel">
        <template v-if="isOwnerRole">
          <div class="gc-overflow-label">Filter</div>
          <div style="padding:2px 6px 8px;">
            <select v-model="filterJenisPekerjaanOwner" style="width:100%; margin-bottom:6px; padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
              <option value="ALL">Semua jenis pekerjaan</option>
              <option v-for="jp in opsiJenisPekerjaanOwner" :key="jp" :value="jp">{{ jp }}</option>
            </select>
            <select v-model="filterGudangOwner" style="width:100%; padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
              <option value="ALL">Semua gudang</option>
              <option v-for="g in opsiGudangOwner" :key="g" :value="g">{{ g }}</option>
            </select>
          </div>
          <hr class="gc-overflow-sep">
        </template>
        <button @click="toggleMenuTerbuka(); cekDataSangatLama();" :disabled="memuatDataLama" class="gc-overflow-item"><i class="fas fa-magnifying-glass"></i> Cek Data Sangat Lama</button>
        <button @click="toggleMenuTerbuka(); muat();" class="gc-overflow-item"><i class="fas fa-sync-alt"></i> Refresh</button>
      </div>
    </div>
    <div class="gc-card" style="display:flex; align-items:center; gap:8px; background:var(--pink); border:none; padding:9px 14px; margin-bottom:16px;">
      <i class="fas fa-clock" style="color:var(--burgundy-dark); font-size:12px;"></i>
      <b style="font-size:11px; color:var(--burgundy-dark);">Antrean validasi absensi</b>
      <span class="gc-badge-count">{{ daftarPendingTersaring.length }}</span>
    </div>
    <p v-if="infoDataLama" style="font-size:11px; color:var(--text-muted); margin:-10px 0 16px; padding:8px 12px; background:var(--ivory-dim); border-radius:10px;">{{ infoDataLama }}</p>

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
        :shift-info="petaShiftInfo[item.data.nama_shift] || {masuk:null,keluar:null}"
        :lembur-tanggal="petaLemburTanggal[item.data.email] || []"
        @diproses="setelahDiproses"
      />
    </div>
  `
};

let vmAntreanAbsensi = null;
window.pastikanMountAntreanAbsensi = function() {
  if (vmAntreanAbsensi) { if (typeof vmAntreanAbsensi.muat === 'function') vmAntreanAbsensi.muat(); return; }
  const mountPoint = document.getElementById('vue-antrean-absensi');
  if (mountPoint) vmAntreanAbsensi = createApp(AppAntreanAbsensi).mount('#vue-antrean-absensi');
};
window.refreshAntreanAbsensi = function() { if (vmAntreanAbsensi) vmAntreanAbsensi.muat(); };
