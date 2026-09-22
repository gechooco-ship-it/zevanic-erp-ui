// js/vue-report-absensi.js
// Master Absensi > Report Absensi: ringkasan kehadiran per periode (KPI, rekap
// per karyawan, belum absen & terlambat hari ini), Export CSV, dan panel
// Jadwal Kirim WA (report yang dikirim otomatis lewat Fonnte).
//
// Koleksi & field:
// - users (status_kerja=='Aktif'): name, jenis_pekerjaan, gudang_penempatan,
//   nama_shift, jenis_akun (kiosk dilewati).
// - jadwal_shift (where bulan==YYYY-MM): hari{"1":"Pagi"|"OFF"}; master_shift.
// - absensi: waktu_masuk_ts (format baru), waktu_ts (lama & lembur),
//   tanggal_pengajuan YYYY-MM-DD (izin/cuti). Hanya dibaca.
// - wa_jadwal: nama, modul, jenis, hari[0-6], jam[], jenis_pekerjaan, aktif,
//   template, bagian[{gudang[], penerima[{jenis,id}]}]. Phonebook hanya dibaca.
//
// Jebakan:
// - rekapAbsensi() satu-satunya aturan hitung di browser; functions/index.js
//   punya salinannya untuk pesan terjadwal — ubah keduanya bersamaan.
// - Status belum divalidasi dihitung otomatis dari jam shift. Belum absen hari
//   ini baru dihitung setelah jam masuk shift lewat. Kunci hari = tanggal WIB.
// - Jadwal dihapus = templatenya ikut hilang (template field di dokumen jadwal).

import { createApp, ref, computed, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { collection, getDocs, query, where, orderBy, doc, addDoc, updateDoc, deleteDoc, deleteField, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { KolomCari } from './vue-components.js?v=13';
import { hitungStatusKehadiran } from './vue-antrean-absensi.js?v=8';
import { JENIS_REPORT_WA, TEMPLATE_BAWAAN_WA, jalankanPerintahWa } from './vue-whatsapp-gateway.js?v=3';

const STATUS_NON_HADIR = ["IZIN", "CUTI", "LEMBUR (CLOCK IN)", "CLOCK OUT"];
const MAKS_HARI = 31;

function kunciHari(date) { return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); }
function tsKeKunci(ts) { return ts && typeof ts.toDate === 'function' ? kunciHari(ts.toDate()) : null; }
function jamDari(ts) {
  if (!ts || typeof ts.toDate !== 'function') return '-';
  return ts.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
}

// Selisih menit aktual vs jam jadwal di tanggal yang sama (untuk total menit terlambat).
function menitLewat(ts, jamStr) {
  if (!ts || typeof ts.toDate !== 'function' || !jamStr) return 0;
  const aktual = ts.toDate();
  const [h, m] = jamStr.split(':').map(Number);
  const batas = new Date(aktual); batas.setHours(h, m, 0, 0);
  return Math.max(0, Math.round((aktual - batas) / 60000));
}

// input: { karyawan[], hari[] (kunci YYYY-MM-DD urut), kunciHariIni, sekarang (Date),
//   jadwal {email|YYYY-MM: hari{}}, shift {nama: {jam_masuk, jam_keluar}}, dokAbsensi[] }
export function rekapAbsensi(input) {
  const { karyawan, hari, kunciHariIni, sekarang, jadwal, shift, dokAbsensi } = input;
  const hadirPer = {}, izinPer = {}, lemburPer = {}, keluarLamaPer = {};
  let menungguValidasi = 0;
  dokAbsensi.forEach(d => {
    const baru = d.status_acc_masuk !== undefined;
    if (baru) {
      const k = tsKeKunci(d.waktu_masuk_ts); if (!k) return;
      if (d.ada_pending === true) menungguValidasi++;
      if (d.status_acc_masuk === 'REJECT') return;
      hadirPer[`${d.email}|${k}`] = d;
      return;
    }
    if (d.status === 'IZIN' || d.status === 'CUTI') {
      if (d.status_acc === 'REJECT' || !d.tanggal_pengajuan) return;
      izinPer[`${d.email}|${d.tanggal_pengajuan}`] = d;
      return;
    }
    const k = tsKeKunci(d.waktu_ts); if (!k) return;
    if (d.status === 'LEMBUR (CLOCK IN)') { if (d.status_acc === 'ACC') lemburPer[`${d.email}|${k}`] = d; return; }
    if (d.status_acc === 'PENDING') menungguValidasi++;
    if (d.status_acc === 'REJECT') return;
    if (d.status === 'CLOCK OUT') { keluarLamaPer[`${d.email}|${k}`] = d; return; }
    if (!STATUS_NON_HADIR.includes(d.status)) hadirPer[`${d.email}|${k}`] = d;
  });

  const kpi = { hadir: 0, terjadwal: 0, terlambat: 0, menitTerlambat: 0, pulangCepat: 0, belumAbsen: 0,
    tidakAbsen: 0, izin: 0, izinMenunggu: 0, lembur: 0, seragamTdkSesuai: 0, menungguValidasi };
  const baris = [], daftarBelumAbsen = [], daftarTerlambatHariIni = [];

  karyawan.forEach(u => {
    const r = { email: u.email, nama: u.nama, gudang: u.gudang, jenisPekerjaan: u.jenisPekerjaan,
      hadir: 0, terlambat: 0, menitTerlambat: 0, pulangCepat: 0, izin: 0, tidakAbsen: 0, lembur: 0, seragam: 0 };
    hari.forEach(k => {
      const bulan = k.slice(0, 7), tgl = String(Number(k.slice(8)));
      const hariJadwal = (jadwal[`${u.email}|${bulan}`] || {})[tgl];
      const namaShiftHari = hariJadwal !== undefined ? hariJadwal : u.namaShift;
      const kunci = `${u.email}|${k}`;
      const h = hadirPer[kunci];
      if (lemburPer[kunci]) { r.lembur++; kpi.lembur++; }
      if (h) {
        const sh = shift[h.nama_shift || namaShiftHari] || {};
        const baru = h.status_acc_masuk !== undefined;
        const tsMasuk = baru ? h.waktu_masuk_ts : h.waktu_ts;
        const stMasuk = (baru ? h.status_kehadiran_masuk : h.status_kehadiran) || hitungStatusKehadiran(tsMasuk, tsMasuk, sh.jam_masuk, 'masuk');
        const kl = keluarLamaPer[kunci];
        const stKeluar = baru
          ? (h.status_kehadiran_keluar || (h.waktu_keluar_ts ? hitungStatusKehadiran(h.waktu_keluar_ts, tsMasuk, sh.jam_keluar, 'keluar') : null))
          : (kl ? kl.status_kehadiran : null);
        r.hadir++; kpi.hadir++; kpi.terjadwal++;
        if (stMasuk === 'Terlambat') {
          const mnt = menitLewat(tsMasuk, sh.jam_masuk);
          r.terlambat++; r.menitTerlambat += mnt; kpi.terlambat++; kpi.menitTerlambat += mnt;
          if (k === kunciHariIni) daftarTerlambatHariIni.push({ nama: u.nama, gudang: u.gudang, jam: jamDari(tsMasuk), menit: mnt });
        }
        if (stKeluar === 'Pulang Cepat') { r.pulangCepat++; kpi.pulangCepat++; }
        const seragam = baru ? [h.seragam_masuk, h.seragam_keluar] : [h.seragam, kl && kl.seragam];
        if (seragam.includes('Tidak Sesuai')) { r.seragam++; kpi.seragamTdkSesuai++; }
        return;
      }
      const iz = izinPer[kunci];
      if (iz) {
        r.izin++; kpi.izin++;
        if (iz.status_acc === 'PENDING') kpi.izinMenunggu++;
        return;
      }
      if (!namaShiftHari || namaShiftHari === 'OFF') return;
      if (k < kunciHariIni) { kpi.terjadwal++; r.tidakAbsen++; kpi.tidakAbsen++; return; }
      if (k === kunciHariIni) {
        const jm = (shift[namaShiftHari] || {}).jam_masuk;
        const [hh, mm] = (jm || '00:00').split(':').map(Number);
        if (sekarang.getHours() * 60 + sekarang.getMinutes() < hh * 60 + mm) return;
        kpi.terjadwal++; r.tidakAbsen++; kpi.belumAbsen++;
        daftarBelumAbsen.push({ nama: u.nama, gudang: u.gudang, shift: namaShiftHari, jamMasuk: jm || '-' });
      }
    });
    baris.push(r);
  });

  baris.sort((a, b) => (b.tidakAbsen - a.tidakAbsen) || (b.terlambat - a.terlambat) || a.nama.localeCompare(b.nama));
  daftarTerlambatHariIni.sort((a, b) => b.menit - a.menit);
  daftarBelumAbsen.sort((a, b) => a.jamMasuk.localeCompare(b.jamMasuk) || a.nama.localeCompare(b.nama));
  return { kpi, baris, daftarBelumAbsen, daftarTerlambatHariIni };
}

const NAMA_HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const OPSI_JAM = [];
for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m += 5) OPSI_JAM.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

// Jam dibatasi kelipatan 5 menit karena jadwalKirimWa di server berjalan tiap 5 menit.
const JadwalKirimWa = {
  props: { petaGudangJp: { type: Object, default: () => ({}) }, opsiJp: { type: Array, default: () => [] } },
  emits: ['tutup'],
  setup(props) {
    const bolehUbah = ['owner', 'pic_owner'].includes((window.currentUser?.role || '').toLowerCase());
    const daftar = ref([]), kontak = ref([]), grup = ref([]), waGroup = ref([]);
    const memuat = ref(true);
    const form = ref(null);
    const menyimpan = ref(false);
    const mengirimTes = ref('');

    async function muat() {
      memuat.value = true;
      try {
        const [sj, sk, sg, sw] = await Promise.all([
          getDocs(query(collection(db, 'wa_jadwal'), orderBy('nama'))),
          getDocs(query(collection(db, 'wa_kontak'), orderBy('nama'))),
          getDocs(query(collection(db, 'wa_grup_phonebook'), orderBy('nama'))),
          getDocs(query(collection(db, 'wa_group'), orderBy('nama')))
        ]);
        daftar.value = sj.docs.map(d => ({ id: d.id, ...d.data() })).filter(j => (j.modul || 'absensi') === 'absensi');
        kontak.value = sk.docs.map(d => ({ id: d.id, ...d.data() }));
        grup.value = sg.docs.map(d => ({ id: d.id, ...d.data() }));
        waGroup.value = sw.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error('Gagal memuat jadwal WA:', e);
        alert('Gagal memuat jadwal kirim WA.');
      }
      memuat.value = false;
    }

    const opsiPenerima = computed(() => [
      ...grup.value.map(g => ({ jenis: 'grup', id: g.id, label: `Grup: ${g.nama}` })),
      ...waGroup.value.map(w => ({ jenis: 'wa_group', id: w.id, label: `WA Group: ${w.nama}` })),
      ...kontak.value.map(k => ({ jenis: 'kontak', id: k.id, label: `Kontak: ${k.nama}` }))
    ]);
    const labelPenerima = p => (opsiPenerima.value.find(o => o.jenis === p.jenis && o.id === p.id) || {}).label || '(terhapus)';
    const labelJenis = key => (JENIS_REPORT_WA.find(j => j.key === key) || {}).label || key;
    // Bentuk baku sama dengan bagianJadwal di server: gudang selalu array ([] =
    // semua), jenis pekerjaan di level jadwal; bentuk lama tetap terbaca.
    const jpDari = j => j.jenis_pekerjaan !== undefined ? j.jenis_pekerjaan : ((j.bagian || [])[0]?.jenis_pekerjaan || '');
    const bagianDari = j => ((Array.isArray(j.bagian) && j.bagian.length) ? j.bagian : [{ gudang: j.gudang || '', penerima: j.penerima || [] }])
      .map(b => ({ gudang: Array.isArray(b.gudang) ? b.gudang.filter(Boolean) : (b.gudang ? [b.gudang] : []), penerima: b.penerima || [] }));
    const labelGudang = b => b.gudang.length ? b.gudang.join(', ') : 'Semua gudang';
    const opsiGudangForm = computed(() => form.value ? (props.petaGudangJp[form.value.jenis_pekerjaan] || []) : []);
    const teksHari = j => j.jenis === 'rekap_bulanan' ? 'Tanggal 1'
      : ((j.hari || []).length === 7 ? 'Setiap hari' : (j.hari || []).slice().sort().map(h => NAMA_HARI_PENDEK[h]).join(', '));

    function bagianBaru(b) {
      return { gudang: b ? [...b.gudang] : [], gudangBaru: '', penerima: b ? [...(b.penerima || [])] : [], penerimaBaru: '' };
    }
    function buka(j) {
      form.value = j
        ? { id: j.id, nama: j.nama, jenis: j.jenis, hari: [...(j.hari || [])], jam: [...(j.jam || [])], jenis_pekerjaan: jpDari(j), bagian: bagianDari(j).map(bagianBaru), aktif: !!j.aktif, jamBaru: '10:00' }
        : { id: null, nama: '', jenis: 'ringkasan_pagi', hari: [1, 2, 3, 4, 5, 6], jam: ['10:00'], jenis_pekerjaan: '', bagian: [bagianBaru(null)], aktif: true, jamBaru: '16:00' };
    }
    function toggleHari(h) { const i = form.value.hari.indexOf(h); if (i >= 0) form.value.hari.splice(i, 1); else form.value.hari.push(h); }
    function tambahJam() { const j = form.value.jamBaru; if (j && !form.value.jam.includes(j)) form.value.jam.push(j); form.value.jam.sort(); }
    function tambahPenerima(b) {
      const o = opsiPenerima.value.find(x => `${x.jenis}|${x.id}` === b.penerimaBaru);
      if (o && !b.penerima.some(p => p.jenis === o.jenis && p.id === o.id)) b.penerima.push({ jenis: o.jenis, id: o.id });
      b.penerimaBaru = '';
    }
    function tambahBagian() { form.value.bagian.push(bagianBaru(null)); }
    function tambahGudang(b) {
      if (b.gudangBaru && !b.gudang.includes(b.gudangBaru)) b.gudang.push(b.gudangBaru);
      b.gudangBaru = '';
    }
    // Ganti jenis pekerjaan di form yang sama: gudang yang bukan milik jenis itu
    // dicabut. Saat form baru dibuka (id berubah) gudang tersimpan dibiarkan utuh.
    watch(() => form.value ? [form.value.id, form.value.jenis_pekerjaan] : null, (baru, lama) => {
      if (!baru || !lama || baru[0] !== lama[0]) return;
      const boleh = opsiGudangForm.value;
      form.value.bagian.forEach(b => { b.gudang = b.gudang.filter(g => boleh.includes(g)); });
    });

    async function simpan() {
      const f = form.value;
      if (!f.nama.trim()) return alert('Nama jadwal wajib diisi.');
      if (daftar.value.some(j => j.nama.toLowerCase() === f.nama.trim().toLowerCase() && j.id !== f.id)) return alert('Nama jadwal sudah dipakai. Nama ini juga jadi nama templatenya.');
      if (!f.jam.length) return alert('Tambahkan minimal satu jam kirim.');
      if (f.jenis !== 'rekap_bulanan' && !f.hari.length) return alert('Pilih minimal satu hari.');
      if (f.bagian.some(b => !b.penerima.length)) return alert('Setiap bagian wajib punya minimal satu penerima.');
      const semuaGudang = f.bagian.flatMap(b => b.gudang);
      if (new Set(semuaGudang).size !== semuaGudang.length) return alert('Satu gudang dipilih di lebih dari satu bagian. Tiap gudang cukup ada di satu bagian.');
      if (f.bagian.length > 1 && f.bagian.some(b => !b.gudang.length)) return alert('Kalau ada lebih dari satu bagian, tiap bagian wajib memilih gudang.');
      menyimpan.value = true;
      const bagian = f.bagian.map(b => ({ gudang: [...b.gudang], penerima: b.penerima }));
      const data = { nama: f.nama.trim(), modul: 'absensi', jenis: f.jenis, hari: [...f.hari].sort(), jam: [...f.jam], jenis_pekerjaan: f.jenis_pekerjaan, bagian, aktif: f.aktif, diubah_pada: serverTimestamp() };
      try {
        if (f.id) {
          const lama = daftar.value.find(j => j.id === f.id);
          if (lama && lama.jenis !== f.jenis && confirm('Jenis report berubah. Ganti template dengan versi bawaan jenis baru?')) data.template = TEMPLATE_BAWAAN_WA[f.jenis];
          await updateDoc(doc(db, 'wa_jadwal', f.id), { ...data, gudang: deleteField(), penerima: deleteField() });
        } else {
          await addDoc(collection(db, 'wa_jadwal'), { ...data, template: TEMPLATE_BAWAAN_WA[f.jenis], dibuat_oleh: window.currentUser.email || '', dibuat_pada: serverTimestamp() });
        }
        form.value = null;
        await muat();
      } catch (e) {
        console.error('Gagal simpan jadwal WA:', e);
        alert('Gagal menyimpan jadwal.');
      }
      menyimpan.value = false;
    }
    async function hapus(j) {
      if (!confirm(`Hapus jadwal "${j.nama}"? Templatenya ikut terhapus.`)) return;
      try { await deleteDoc(doc(db, 'wa_jadwal', j.id)); await muat(); }
      catch (e) { console.error('Gagal hapus jadwal WA:', e); alert('Gagal menghapus jadwal.'); }
    }
    async function ubahAktif(j) {
      try { await updateDoc(doc(db, 'wa_jadwal', j.id), { aktif: !j.aktif }); j.aktif = !j.aktif; }
      catch (e) { console.error('Gagal ubah status jadwal WA:', e); alert('Gagal mengubah status jadwal.'); }
    }
    async function kirimTes(j) {
      mengirimTes.value = j.id;
      try {
        const x = await jalankanPerintahWa({ aksi: 'tes_jadwal', jadwal_id: j.id });
        alert('Pesan tes diantrekan. ' + (x.keterangan || ''));
      } catch (e) { alert('Gagal kirim tes: ' + e.message); }
      mengirimTes.value = '';
    }
    function bukaTemplate() {
      window.pindahTab('tab-whatsapp');
      if (window.bukaSubTabWhatsapp) window.bukaSubTabWhatsapp('template');
    }

    onMounted(muat);
    return { bolehUbah, daftar, memuat, form, menyimpan, mengirimTes, opsiPenerima, labelPenerima, labelJenis, teksHari,
      jpDari, bagianDari, labelGudang, opsiGudangForm, tambahGudang, buka, toggleHari, tambahJam, tambahPenerima, tambahBagian, simpan, hapus, ubahAktif, kirimTes, bukaTemplate,
      JENIS_REPORT_WA, NAMA_HARI_PENDEK, OPSI_JAM };
  },
  template: `
    <div class="gc-card" style="margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:12px;">
        <div>
          <h3 class="gc-heading" style="font-weight:700; font-size:13.5px;"><i class="fab fa-whatsapp" style="color:var(--ok); margin-right:8px;"></i>Jadwal Kirim WA</h3>
          <p style="font-size:10.5px; color:var(--text-muted); margin-top:3px;">Dikirim lewat nomor Fonnte yang sama dengan bot report. Isi pesan diatur di Master Integrasi › WhatsApp › Template Pesan.</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button @click="$emit('tutup')" class="btn-outline">Tutup</button>
          <button v-if="bolehUbah" @click="buka(null)" class="btn-primary"><i class="fas fa-plus" style="margin-right:6px;"></i>Jadwal</button>
        </div>
      </div>
      <div v-if="memuat" style="font-size:12px; color:var(--text-faint);">Memuat jadwal...</div>
      <div v-else-if="!daftar.length" style="font-size:12px; color:var(--text-faint);">Belum ada jadwal kirim WA.</div>
      <div v-for="j in daftar" :key="j.id" style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; padding:10px 0; border-top:1px solid var(--line);">
        <div style="min-width:0;">
          <div style="font-size:12.5px; font-weight:700;">{{ j.nama }} <span class="tag" :class="j.aktif ? 'ok' : 'neutral'" style="margin-left:4px;">{{ j.aktif ? 'Aktif' : 'Mati' }}</span></div>
          <div style="font-size:11px; color:var(--text-muted);">{{ labelJenis(j.jenis) }} · {{ teksHari(j) }} · {{ (j.jam || []).join(' & ') }} · {{ jpDari(j) || 'Semua jenis pekerjaan' }}</div>
          <div v-for="(b, i) in bagianDari(j)" :key="i" style="font-size:11px; color:var(--text-faint);"><b>{{ labelGudang(b) }}</b> → {{ (b.penerima || []).map(labelPenerima).join(', ') }}</div>
          <div v-if="j.hasil_terakhir" style="font-size:10.5px; color:var(--text-faint);">Terakhir: {{ j.hasil_terakhir }}</div>
        </div>
        <div v-if="bolehUbah" style="display:flex; gap:6px; flex-wrap:wrap;">
          <button @click="kirimTes(j)" :disabled="mengirimTes === j.id" class="btn-outline" style="padding:5px 10px; font-size:11px;">{{ mengirimTes === j.id ? 'Mengirim...' : 'Tes ke nomor saya' }}</button>
          <button @click="ubahAktif(j)" class="btn-outline" style="padding:5px 10px; font-size:11px;">{{ j.aktif ? 'Matikan' : 'Aktifkan' }}</button>
          <button @click="buka(j)" class="btn-outline" style="padding:5px 10px; font-size:11px;">Ubah</button>
          <button @click="hapus(j)" class="btn-outline" style="padding:5px 10px; font-size:11px; color:var(--danger); border-color:var(--danger);">Hapus</button>
        </div>
      </div>
      <button @click="bukaTemplate" class="btn-outline" style="margin-top:10px; font-size:11px;"><i class="fas fa-comment-dots" style="margin-right:6px;"></i>Atur template pesan</button>
    </div>

    <div v-if="form" style="position:fixed; inset:0; background:rgba(var(--scrim-rgb),.6); z-index:60; display:flex; align-items:center; justify-content:center; padding:16px;" class="fade-in">
      <div style="background:var(--surface); width:100%; max-width:480px; max-height:90vh; overflow:auto; padding:22px; border-radius:20px;">
        <h3 class="gc-heading" style="font-weight:700; font-size:14px; margin-bottom:14px;">{{ form.id ? 'Ubah jadwal' : 'Tambah jadwal' }}</h3>
        <div class="gc-field"><label>Nama jadwal (juga nama template)</label><input v-model="form.nama" type="text" placeholder="mis. Ringkasan pagi SOG19"></div>
        <div class="gc-field"><label>Jenis report</label>
          <select v-model="form.jenis"><option v-for="j in JENIS_REPORT_WA" :key="j.key" :value="j.key">{{ j.label }}</option></select>
        </div>
        <div v-if="form.jenis !== 'rekap_bulanan'" style="margin-bottom:12px;">
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:6px;">Hari</label>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button v-for="(h, i) in NAMA_HARI_PENDEK" :key="i" @click="toggleHari(i)" class="btn-outline" :class="{ filled: form.hari.includes(i) }" style="padding:5px 10px; font-size:11px;">{{ h }}</button>
          </div>
        </div>
        <p v-else style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">Rekap bulanan dikirim tiap tanggal 1 untuk bulan sebelumnya.</p>
        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:6px;">Jam kirim (WIB)</label>
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px;">
            <span v-for="(j, i) in form.jam" :key="j" class="tag neutral">{{ j }} <a @click="form.jam.splice(i, 1)" style="cursor:pointer; margin-left:4px;">&times;</a></span>
          </div>
          <div style="display:flex; gap:6px;">
            <select v-model="form.jamBaru" style="padding:6px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);"><option v-for="o in OPSI_JAM" :key="o" :value="o">{{ o }}</option></select>
            <button @click="tambahJam" class="btn-outline" style="padding:5px 10px; font-size:11px;">+ jam</button>
          </div>
        </div>
        <div class="gc-field"><label>Jenis pekerjaan yang dilaporkan</label>
          <select v-model="form.jenis_pekerjaan"><option value="">Semua jenis pekerjaan</option><option v-for="jp in opsiJp" :key="jp" :value="jp">{{ jp }}</option></select>
        </div>
        <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Bagian kirim</label>
        <p style="font-size:10.5px; color:var(--text-muted); margin-bottom:8px;">Tiap bagian dapat pesan sendiri berisi angka gudang-gudang di bagian itu. Gudang yang muncul hanya yang punya karyawan {{ form.jenis_pekerjaan || 'jenis apa pun' }}. Templatenya tetap satu.</p>
        <div v-for="(b, bi) in form.bagian" :key="bi" style="border:1px solid var(--line); border-radius:14px; padding:10px 12px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:11.5px; font-weight:700;">Bagian {{ bi + 1 }}</span>
            <a v-if="form.bagian.length > 1" @click="form.bagian.splice(bi, 1)" style="cursor:pointer; font-size:11px; color:var(--danger);">Hapus bagian</a>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px;">
            <span v-if="!b.gudang.length" class="tag neutral">Semua gudang</span>
            <span v-for="(g, gi) in b.gudang" :key="g" class="tag neutral">{{ g }} <a @click="b.gudang.splice(gi, 1)" style="cursor:pointer; margin-left:4px;">&times;</a></span>
          </div>
          <select v-model="b.gudangBaru" @change="tambahGudang(b)" style="width:100%; padding:7px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface); margin-bottom:10px;">
            <option value="">+ Tambah gudang...</option>
            <option v-for="g in opsiGudangForm" :key="g" :value="g" :disabled="form.bagian.some(x => x.gudang.includes(g))">{{ g }}</option>
          </select>
          <div style="font-size:11px; font-weight:700; margin-bottom:6px;">Penerima</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px;">
            <span v-for="(p, i) in b.penerima" :key="p.jenis + p.id" class="tag neutral">{{ labelPenerima(p) }} <a @click="b.penerima.splice(i, 1)" style="cursor:pointer; margin-left:4px;">&times;</a></span>
          </div>
          <select v-model="b.penerimaBaru" @change="tambahPenerima(b)" style="width:100%; padding:7px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
            <option value="">+ Tambah penerima dari Phonebook...</option>
            <option v-for="o in opsiPenerima" :key="o.jenis + o.id" :value="o.jenis + '|' + o.id">{{ o.label }}</option>
          </select>
        </div>
        <button @click="tambahBagian" class="btn-outline" style="font-size:11px; padding:6px 12px; margin-bottom:12px;">+ Bagian</button>
        <p v-if="form.jenis === 'pengingat_hrd'" style="font-size:10.5px; color:var(--text-muted); margin-bottom:12px;">Pengingat HRD hanya terkirim ke bagian yang punya absensi menunggu validasi.</p>
        <label style="display:flex; align-items:center; gap:8px; font-size:12.5px; margin-bottom:14px; cursor:pointer;"><input type="checkbox" v-model="form.aktif" style="width:15px; height:15px; accent-color:var(--burgundy);"> Aktif</label>
        <div style="display:flex; gap:10px;">
          <button @click="form = null" class="btn-outline" style="flex:1;">Batal</button>
          <button @click="simpan" :disabled="menyimpan" class="btn-primary" style="flex:1;">{{ menyimpan ? 'Menyimpan...' : 'Simpan jadwal' }}</button>
        </div>
      </div>
    </div>
  `
};

const AppReportAbsensi = {
  components: { KolomCari, JadwalKirimWa },
  setup() {
    const tampilJadwal = ref(false);
    const preset = ref('hari_ini');
    const tglMulai = ref(''), tglSelesai = ref('');
    const filterGudang = ref(''), filterJP = ref('');
    const cari = ref('');
    const memuat = ref(true);
    const errorMuat = ref('');
    const PER_HALAMAN = 20;
    const halaman = ref(1);

    // Bahan mentah dari Firestore; filter gudang/jenis pekerjaan dihitung ulang
    // di browser tanpa query baru.
    const bahan = ref({ karyawan: [], hari: [], kunciHariIni: '', sekarang: new Date(), jadwal: {}, shift: {}, dokAbsensi: [] });

    function hitungRentang() {
      const s = new Date();
      const awalHari = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      const akhirHari = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 23, 59, 59, 999);
      if (preset.value === 'kemarin') {
        const m = new Date(awalHari); m.setDate(m.getDate() - 1);
        const a = new Date(akhirHari); a.setDate(a.getDate() - 1);
        return { mulai: m, selesai: a };
      }
      if (preset.value === '7_hari') { const m = new Date(awalHari); m.setDate(m.getDate() - 6); return { mulai: m, selesai: akhirHari }; }
      if (preset.value === 'bulan_ini') return { mulai: new Date(s.getFullYear(), s.getMonth(), 1), selesai: akhirHari };
      if (preset.value === 'custom' && tglMulai.value && tglSelesai.value) {
        const [y1, m1, d1] = tglMulai.value.split('-').map(Number);
        const [y2, m2, d2] = tglSelesai.value.split('-').map(Number);
        return { mulai: new Date(y1, m1 - 1, d1), selesai: new Date(y2, m2 - 1, d2, 23, 59, 59, 999) };
      }
      return { mulai: awalHari, selesai: akhirHari };
    }

    async function muat() {
      const { mulai, selesai } = hitungRentang();
      if (selesai < mulai) { errorMuat.value = 'Tanggal akhir lebih awal dari tanggal mulai.'; memuat.value = false; return; }
      if ((selesai - mulai) / 86400000 > MAKS_HARI) { errorMuat.value = `Rentang maksimal ${MAKS_HARI} hari.`; memuat.value = false; return; }
      memuat.value = true; errorMuat.value = '';
      try {
        const sekarang = new Date();
        const kunciHariIni = kunciHari(sekarang);
        const hari = [];
        for (let d = new Date(mulai); d <= selesai; d.setDate(d.getDate() + 1)) {
          const k = kunciHari(d);
          if (k <= kunciHariIni) hari.push(k);
        }
        const daftarBulan = [...new Set(hari.map(k => k.slice(0, 7)))];
        const tsMulai = Timestamp.fromDate(mulai), tsSelesai = Timestamp.fromDate(selesai);
        const [snapUsers, snapShift, snapBaru, snapLama, snapIzin, ...snapJadwal] = await Promise.all([
          getDocs(query(collection(db, "users"), where("status_kerja", "==", "Aktif"))),
          getDocs(collection(db, "master_shift")),
          getDocs(query(collection(db, "absensi"), where("waktu_masuk_ts", ">=", tsMulai), where("waktu_masuk_ts", "<=", tsSelesai))),
          getDocs(query(collection(db, "absensi"), where("waktu_ts", ">=", tsMulai), where("waktu_ts", "<=", tsSelesai))),
          getDocs(query(collection(db, "absensi"), where("tanggal_pengajuan", ">=", hari[0] || kunciHariIni), where("tanggal_pengajuan", "<=", hari[hari.length - 1] || kunciHariIni))),
          ...daftarBulan.map(b => getDocs(query(collection(db, "jadwal_shift"), where("bulan", "==", b))))
        ]);

        const karyawan = [];
        snapUsers.forEach(s => {
          const u = s.data();
          if (u.jenis_akun === 'kiosk' || !u.email) return;
          const gudang = window.normalisasiGudang(u.gudang_penempatan);
          if (!window.bolehLihatData(u.jenis_pekerjaan, gudang)) return;
          karyawan.push({ email: u.email, nama: u.name || u.nama || u.email, gudang: gudang.join(', ') || '-',
            gudangList: gudang, jenisPekerjaan: u.jenis_pekerjaan || '-', namaShift: u.nama_shift || '' });
        });
        const shift = {};
        snapShift.forEach(s => { const d = s.data(); if (d.nama_shift) shift[d.nama_shift] = { jam_masuk: d.jam_masuk, jam_keluar: d.jam_keluar }; });
        const jadwal = {};
        snapJadwal.forEach(sn => sn.forEach(s => { const d = s.data(); jadwal[`${d.email}|${d.bulan}`] = d.hari || {}; }));
        const dokAbsensi = [], sudah = new Set();
        [snapBaru, snapLama, snapIzin].forEach(sn => sn.forEach(s => { if (!sudah.has(s.id)) { sudah.add(s.id); dokAbsensi.push(s.data()); } }));

        bahan.value = { karyawan, hari, kunciHariIni, sekarang, jadwal, shift, dokAbsensi };
        halaman.value = 1;
      } catch (e) {
        console.error("Gagal muat Report Absensi:", e);
        errorMuat.value = 'Gagal memuat data. Cek Console (mungkin perlu index Firestore baru, ikuti link di pesan error).';
      }
      memuat.value = false;
    }

    const opsiGudang = computed(() => [...new Set(bahan.value.karyawan.flatMap(k => k.gudangList))].sort());
    // Gudang per jenis pekerjaan untuk form Jadwal Kirim WA; kunci '' = semua jenis.
    const petaGudangJp = computed(() => {
      const peta = { '': new Set() };
      bahan.value.karyawan.forEach(k => k.gudangList.forEach(g => {
        peta[''].add(g);
        (peta[k.jenisPekerjaan] = peta[k.jenisPekerjaan] || new Set()).add(g);
      }));
      return Object.fromEntries(Object.entries(peta).map(([k, v]) => [k, [...v].sort()]));
    });
    const opsiJP = computed(() => [...new Set(bahan.value.karyawan.map(k => k.jenisPekerjaan).filter(x => x && x !== '-'))].sort());

    const hasil = computed(() => {
      const b = bahan.value;
      const karyawan = b.karyawan.filter(k =>
        (!filterGudang.value || k.gudangList.includes(filterGudang.value)) &&
        (!filterJP.value || k.jenisPekerjaan === filterJP.value));
      const emailTersaring = new Set(karyawan.map(k => k.email));
      const dokAbsensi = b.dokAbsensi.filter(d => emailTersaring.has(d.email));
      return rekapAbsensi({ ...b, karyawan, dokAbsensi });
    });
    const kpi = computed(() => hasil.value.kpi);
    const adaHariIni = computed(() => bahan.value.hari.includes(bahan.value.kunciHariIni));

    const barisTersaring = computed(() => {
      const c = cari.value.trim().toLowerCase();
      return c ? hasil.value.baris.filter(r => r.nama.toLowerCase().includes(c)) : hasil.value.baris;
    });
    const totalHalaman = computed(() => Math.max(1, Math.ceil(barisTersaring.value.length / PER_HALAMAN)));
    const barisHalaman = computed(() => barisTersaring.value.slice((halaman.value - 1) * PER_HALAMAN, halaman.value * PER_HALAMAN));
    function gantiHalaman(delta) { halaman.value = Math.min(totalHalaman.value, Math.max(1, halaman.value + delta)); }

    const LABEL_PRESET = { hari_ini: 'Hari Ini', kemarin: 'Kemarin', '7_hari': '7 Hari Terakhir', bulan_ini: 'Bulan Ini', custom: 'Rentang Pilihan' };
    const captionRentang = computed(() => {
      const h = bahan.value.hari;
      if (!h.length) return '';
      const fmt = k => new Date(k + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      return `${LABEL_PRESET[preset.value]} (${h.length === 1 ? fmt(h[0]) : fmt(h[0]) + ' — ' + fmt(h[h.length - 1])})`;
    });

    function bukaAntrean() {
      window.pindahSubTab('sub-absensi', 'sub-absensi-accept', null, { catatRiwayat: true });
    }

    function exportCSV() {
      const rows = barisTersaring.value;
      if (!rows.length) return alert("Tidak ada data untuk di-export.");
      const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      let csv = q(`Report Absensi: ${captionRentang.value}${filterGudang.value ? ' | Gudang: ' + filterGudang.value : ''}${filterJP.value ? ' | Jenis: ' + filterJP.value : ''}`) + "\n\n";
      csv += "Nama,Email,Gudang,Jenis Pekerjaan,Hadir,Terlambat,Menit Terlambat,Pulang Cepat,Izin/Cuti,Tidak Absen,Lembur,Seragam Tidak Sesuai\n";
      rows.forEach(r => {
        csv += [r.nama, r.email, r.gudang, r.jenisPekerjaan, r.hadir, r.terlambat, r.menitTerlambat, r.pulangCepat, r.izin, r.tidakAbsen, r.lembur, r.seragam].map(q).join(',') + "\n";
      });
      const link = document.createElement("a");
      link.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURIComponent(csv));
      link.setAttribute("download", `Report_Absensi_${preset.value}_${bahan.value.kunciHariIni}.csv`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }

    watch([filterGudang, filterJP, cari], () => { halaman.value = 1; });
    watch([preset, tglMulai, tglSelesai], () => {
      if (preset.value === 'custom' && (!tglMulai.value || !tglSelesai.value)) return;
      muat();
    });
    onMounted(async () => { await window.authReady; muat(); });

    return { preset, tglMulai, tglSelesai, filterGudang, filterJP, cari, memuat, errorMuat, muat,
      opsiGudang, opsiJP, petaGudangJp, kpi, hasil, adaHariIni, barisHalaman, barisTersaring, halaman, totalHalaman,
      gantiHalaman, captionRentang, bukaAntrean, exportCSV, tampilJadwal };
  },
  template: `
    <div class="gc-card" style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:16px;">
      <div>
        <h3 class="gc-heading" style="font-weight:700; font-size:13.5px;"><i class="fas fa-chart-pie" style="color:var(--burgundy); margin-right:8px;"></i> Report Absensi</h3>
        <p style="font-size:10.5px; color:var(--text-muted); margin-top:3px;">Ringkasan kehadiran karyawan aktif per periode.</p>
      </div>
      <div style="display:flex; gap:8px;">
        <button @click="tampilJadwal = !tampilJadwal" class="btn-outline" style="display:flex; align-items:center; gap:6px;"><i class="fab fa-whatsapp"></i><span>Jadwal Kirim WA</span></button>
        <button @click="muat" :disabled="memuat" class="btn-outline" style="display:flex; align-items:center; gap:6px;"><i class="fas fa-rotate"></i><span>Muat ulang</span></button>
        <button @click="exportCSV" class="btn-outline filled" style="display:flex; align-items:center; gap:8px;"><i class="fas fa-file-excel"></i><span>Export CSV</span></button>
      </div>
    </div>

    <jadwal-kirim-wa v-if="tampilJadwal" :peta-gudang-jp="petaGudangJp" :opsi-jp="opsiJP" @tutup="tampilJadwal = false" />

    <div class="gc-card" style="margin-bottom:16px;">
      <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
        <select v-model="preset" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface); font-weight:600;">
          <option value="hari_ini">Hari Ini</option>
          <option value="kemarin">Kemarin</option>
          <option value="7_hari">7 Hari Terakhir</option>
          <option value="bulan_ini">Bulan Ini</option>
          <option value="custom">Pilih Tanggal Sendiri...</option>
        </select>
        <template v-if="preset === 'custom'">
          <input v-model="tglMulai" type="date" style="padding:7px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
          <span style="color:var(--text-faint); font-size:12px;">s/d</span>
          <input v-model="tglSelesai" type="date" style="padding:7px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
        </template>
        <select v-model="filterGudang" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
          <option value="">Semua gudang</option>
          <option v-for="g in opsiGudang" :key="g" :value="g">{{ g }}</option>
        </select>
        <select v-model="filterJP" style="padding:8px 10px; font-size:12px; border:1.5px solid var(--line); border-radius:10px; background:var(--surface);">
          <option value="">Semua jenis pekerjaan</option>
          <option v-for="j in opsiJP" :key="j" :value="j">{{ j }}</option>
        </select>
      </div>
      <p v-if="captionRentang" style="font-size:11px; color:var(--text-muted); margin-top:10px; font-style:italic;"><i class="fas fa-circle-info" style="margin-right:5px;"></i>{{ captionRentang }}</p>
    </div>

    <div v-if="errorMuat" class="gc-card" style="background:var(--danger-light); border:1.5px solid var(--danger); margin-bottom:16px; font-size:12px;">{{ errorMuat }}</div>
    <div v-if="memuat" style="text-align:center; padding:40px 0; color:var(--text-faint); font-size:12px;"><i class="fas fa-spinner fa-spin" style="font-size:26px; margin-bottom:10px; display:block;"></i>Menyusun Report Absensi...</div>

    <template v-if="!memuat && !errorMuat">
      <div v-if="kpi.menungguValidasi > 0" class="gc-card" style="background:var(--warn-light); border:1.5px solid var(--warn); margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <i class="fas fa-hourglass-half" style="color:var(--warn); font-size:18px; margin-top:2px;"></i>
          <div>
            <h4 class="gc-heading" style="font-weight:700; font-size:12.5px;">{{ kpi.menungguValidasi }} absensi menunggu validasi</h4>
            <p style="font-size:11px; color:var(--text-muted); margin-top:3px;">Status Ontime/Terlambat yang belum divalidasi dihitung otomatis dari jam shift.</p>
          </div>
        </div>
        <button @click="bukaAntrean" class="btn-outline filled" style="flex-shrink:0;">Buka Antrean</button>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px; margin-bottom:16px;">
        <div class="gc-card"><p style="font-size:11px; color:var(--text-muted);">Hadir</p><p style="font-size:22px; font-weight:700; color:var(--ok);">{{ kpi.hadir }}</p><p style="font-size:10.5px; color:var(--text-faint);">dari {{ kpi.terjadwal }} yang terjadwal</p></div>
        <div class="gc-card"><p style="font-size:11px; color:var(--text-muted);">Terlambat</p><p style="font-size:22px; font-weight:700; color:var(--danger);">{{ kpi.terlambat }}</p><p style="font-size:10.5px; color:var(--text-faint);">total {{ kpi.menitTerlambat }} menit</p></div>
        <div class="gc-card"><p style="font-size:11px; color:var(--text-muted);">Pulang cepat</p><p style="font-size:22px; font-weight:700; color:var(--warn);">{{ kpi.pulangCepat }}</p><p style="font-size:10.5px; color:var(--text-faint);">sebelum jam keluar shift</p></div>
        <div class="gc-card"><p style="font-size:11px; color:var(--text-muted);">{{ adaHariIni ? 'Belum absen' : 'Tidak absen' }}</p><p style="font-size:22px; font-weight:700; color:var(--danger);">{{ adaHariIni ? kpi.belumAbsen : kpi.tidakAbsen }}</p><p style="font-size:10.5px; color:var(--text-faint);">{{ adaHariIni ? 'hari ini, shift sudah mulai' : 'punya shift, tanpa Clock In/izin' }}<template v-if="adaHariIni && kpi.tidakAbsen"> &middot; {{ kpi.tidakAbsen }} hari sebelumnya</template></p></div>
        <div class="gc-card"><p style="font-size:11px; color:var(--text-muted);">Izin / Cuti</p><p style="font-size:22px; font-weight:700;">{{ kpi.izin }}</p><p style="font-size:10.5px; color:var(--text-faint);">{{ kpi.izinMenunggu ? kpi.izinMenunggu + ' belum di-ACC' : 'semua sudah di-ACC' }}</p></div>
        <div class="gc-card"><p style="font-size:11px; color:var(--text-muted);">Lembur</p><p style="font-size:22px; font-weight:700; color:var(--blue);">{{ kpi.lembur }}</p><p style="font-size:10.5px; color:var(--text-faint);">lembur di-ACC</p></div>
        <div class="gc-card"><p style="font-size:11px; color:var(--text-muted);">Seragam tidak sesuai</p><p style="font-size:22px; font-weight:700; color:var(--warn);">{{ kpi.seragamTdkSesuai }}</p><p style="font-size:10.5px; color:var(--text-faint);">dari validasi HRD</p></div>
        <div class="gc-card"><p style="font-size:11px; color:var(--text-muted);">Menunggu validasi</p><p style="font-size:22px; font-weight:700; color:var(--warn);">{{ kpi.menungguValidasi }}</p><p style="font-size:10.5px; color:var(--text-faint);">belum di-ACC di Antrean</p></div>
      </div>

      <div v-if="adaHariIni" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:12px; margin-bottom:16px;">
        <div class="gc-card">
          <h4 class="gc-heading" style="font-weight:700; font-size:12.5px; margin-bottom:8px;"><i class="fas fa-user-clock" style="color:var(--danger); margin-right:6px;"></i>Belum absen hari ini ({{ hasil.daftarBelumAbsen.length }})</h4>
          <p v-if="!hasil.daftarBelumAbsen.length" style="font-size:11.5px; color:var(--text-faint);">Semua yang shiftnya sudah mulai sudah Clock In.</p>
          <div v-for="b in hasil.daftarBelumAbsen" :key="b.nama + b.shift" style="display:flex; justify-content:space-between; gap:8px; font-size:11.5px; padding:6px 0; border-top:1px solid var(--line);">
            <span><b>{{ b.nama }}</b> <span style="color:var(--text-faint);">&middot; {{ b.gudang }}</span></span>
            <span style="color:var(--text-muted); white-space:nowrap;">{{ b.shift }} {{ b.jamMasuk }}</span>
          </div>
        </div>
        <div class="gc-card">
          <h4 class="gc-heading" style="font-weight:700; font-size:12.5px; margin-bottom:8px;"><i class="fas fa-stopwatch" style="color:var(--warn); margin-right:6px;"></i>Terlambat hari ini ({{ hasil.daftarTerlambatHariIni.length }})</h4>
          <p v-if="!hasil.daftarTerlambatHariIni.length" style="font-size:11.5px; color:var(--text-faint);">Tidak ada yang terlambat.</p>
          <div v-for="t in hasil.daftarTerlambatHariIni" :key="t.nama + t.jam" style="display:flex; justify-content:space-between; gap:8px; font-size:11.5px; padding:6px 0; border-top:1px solid var(--line);">
            <span><b>{{ t.nama }}</b> <span style="color:var(--text-faint);">&middot; {{ t.gudang }}</span></span>
            <span style="color:var(--danger); white-space:nowrap;">{{ t.jam }} &middot; {{ t.menit }} mnt</span>
          </div>
        </div>
      </div>

      <div class="gc-card">
        <h4 class="gc-heading" style="font-weight:700; font-size:12.5px; margin-bottom:10px;">Rekap per karyawan</h4>
        <kolom-cari v-model="cari" placeholder="Cari nama karyawan..." />
        <div class="gc-table-scroll" style="background:var(--surface); border:1px solid var(--line);">
          <table class="gc-table">
            <thead><tr><th>Nama</th><th>Gudang</th><th>Jenis Pekerjaan</th><th>Hadir</th><th>Terlambat</th><th>Pulang cepat</th><th>Izin/Cuti</th><th>Tidak absen</th><th>Lembur</th><th>Seragam</th></tr></thead>
            <tbody>
              <tr v-if="!barisTersaring.length"><td colspan="10" style="text-align:center; padding:20px; color:var(--text-faint);">Tidak ada karyawan pada filter ini.</td></tr>
              <tr v-for="r in barisHalaman" :key="r.email">
                <td><b>{{ r.nama }}</b></td>
                <td class="gc-cell-muted">{{ r.gudang }}</td>
                <td class="gc-cell-muted">{{ r.jenisPekerjaan }}</td>
                <td>{{ r.hadir }}</td>
                <td :style="r.terlambat ? 'color:var(--danger); font-weight:600;' : ''">{{ r.terlambat }}<span v-if="r.menitTerlambat" style="font-size:10.5px; color:var(--text-faint); font-weight:400;"> ({{ r.menitTerlambat }} mnt)</span></td>
                <td :style="r.pulangCepat ? 'color:var(--warn); font-weight:600;' : ''">{{ r.pulangCepat }}</td>
                <td>{{ r.izin }}</td>
                <td :style="r.tidakAbsen ? 'color:var(--danger); font-weight:600;' : ''">{{ r.tidakAbsen }}</td>
                <td>{{ r.lembur }}</td>
                <td :style="r.seragam ? 'color:var(--warn); font-weight:600;' : ''">{{ r.seragam }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="barisTersaring.length" style="display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px;">
          <button class="icon-btn" :disabled="halaman <= 1" @click="gantiHalaman(-1)"><i class="fas fa-chevron-left"></i></button>
          <span style="font-size:12px; color:var(--text-muted);">Halaman {{ halaman }} / {{ totalHalaman }} &middot; {{ barisTersaring.length }} karyawan</span>
          <button class="icon-btn" :disabled="halaman >= totalHalaman" @click="gantiHalaman(1)"><i class="fas fa-chevron-right"></i></button>
        </div>
      </div>
    </template>
  `
};

let vmReportAbsensi = null;
window.pastikanMountReportAbsensi = function() {
  if (vmReportAbsensi) { vmReportAbsensi.muat(); return; }
  if (document.getElementById('vue-report-absensi')) vmReportAbsensi = createApp(AppReportAbsensi).mount('#vue-report-absensi');
};
