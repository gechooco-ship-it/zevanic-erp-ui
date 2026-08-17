// js/vue-otp.js
// ============================================================================
// Fondasi OTP email — dipakai BERSAMA untuk 2 kebutuhan: (1) verifikasi
// email saat registrasi awal, (2) verifikasi saat login dari perangkat baru.
// Kalau ke depan ada kebutuhan OTP serupa lagi, PAKAI ULANG fungsi di sini,
// jangan bikin mekanisme baru.
//
// CARA KIRIM EMAIL: lewat Firebase Extension "Trigger Email" — kita cuma
// tulis dokumen ke koleksi "mail", Firebase yang urus pengirimannya lewat
// SMTP yang sudah dikonfigurasi di Extension (lihat STATUS-PROYEK.md §X).
//
// MODEL KEAMANAN (baca ini sebelum ubah apapun di sini / firestore.rules
// bagian otp_email) — PENTING, desain ini SENGAJA disederhanakan:
// Kode OTP asli TIDAK PERNAH bisa dibaca balik oleh client manapun ("allow
// get: if false" total di rules, bahkan pemilik emailnya sendiri tidak
// boleh baca). Verifikasi terjadi lewat PERCOBAAN TULIS: client kirim
// tebakan sebagai field terpisah, Firestore Rules membandingkan tebakan
// itu dengan kode asli (rules BOLEH baca data lama untuk memutuskan, walau
// client tidak boleh). Kalau cocok DAN belum kadaluarsa -> rules izinkan
// tulis "terverifikasi: true". Kalau salah -> operasi tulisnya GAGAL total
// (tidak ada apapun tersimpan), client cuma lihat error, boleh coba lagi.
//
// SENGAJA TIDAK ADA hitungan "maksimal N kali coba" — awalnya saya coba
// bikin itu, tapi ternyata butuh client tahu jumlah percobaan sebelumnya
// (yang justru tidak boleh dibaca, jadi saling bertentangan) dan cara
// putarnya (increment tervalidasi rules) berisiko salah tanpa bisa dites
// langsung. PERLINDUNGANNYA SEKARANG murni dari BATAS WAKTU: kode cuma
// berlaku 10 menit, dan 1 kode 6-digit (1 juta kemungkinan) MUSTAHIL
// ditebak habis dalam 10 menit lewat request Firestore satu-satu (perlu
// puluhan jam bahkan di kecepatan tinggi). Cukup aman untuk skala kecil
// (bukan sistem finansial bernilai tinggi), TAPI kalau nanti ada Cloud
// Function (server) yang bisa diakses, pertimbangkan pindah ke sana untuk
// tambahan pembatas jumlah percobaan yang lebih presisi.
// ============================================================================
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const MASA_BERLAKU_MENIT = 10;

function buatKodeAcak() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digit, "100000"-"999999"
}

// window.kirimOtpEmail(email, konteks) — konteks: 'registrasi' | 'perangkat_baru'
// (dipakai buat teks emailnya beda sedikit). Selalu bikin kode BARU
// (menimpa yang lama kalau ada, otomatis "reset" masa berlaku).
window.kirimOtpEmail = async function(email, konteks) {
  const emailBersih = (email || '').trim().toLowerCase();
  if (!emailBersih) return { sukses: false, pesan: 'Email tidak valid.' };

  const kode = buatKodeAcak();
  const kadaluarsa = Timestamp.fromMillis(Date.now() + MASA_BERLAKU_MENIT * 60 * 1000);

  try {
    // 1. Simpan kode (tersembunyi total dari pembacaan client, lihat rules)
    await setDoc(doc(db, "otp_email", emailBersih), {
      kode,
      terverifikasi: false,
      kadaluarsa,
      dibuat_pada: serverTimestamp()
    });

    // 2. Tulis ke koleksi "mail" -> Trigger Email extension otomatis kirim.
    // Subjek & isi diambil dari config/mail_templates (bisa diubah Admin
    // lewat Mail Gateway > Template Pesan), fallback ke teks baku di sini
    // kalau belum pernah diatur sama sekali.
    let tpl = {};
    try {
      const snapTpl = await getDoc(doc(db, "config", "mail_templates"));
      tpl = snapTpl.exists() ? snapTpl.data() : {};
    } catch (e) { /* gagal baca template -> pakai fallback baku di bawah */ }

    const judulEmail = konteks === 'perangkat_baru'
      ? (tpl.subjek_perangkat || 'Kode Verifikasi Login Perangkat Baru - Zevanic ERP')
      : (tpl.subjek_registrasi || 'Kode Verifikasi Pendaftaran - Zevanic ERP');
    const templateIsi = konteks === 'perangkat_baru'
      ? (tpl.isi_perangkat || `Ada percobaan login ke akun Zevanic ERP Anda dari perangkat baru.\n\nKode verifikasi Anda: {kode}\n\nKode berlaku ${MASA_BERLAKU_MENIT} menit. Kalau ini bukan Anda, abaikan email ini dan segera ganti password.`)
      : (tpl.isi_registrasi || `Terima kasih sudah mendaftar di Zevanic ERP.\n\nKode verifikasi email Anda: {kode}\n\nMasukkan kode ini di aplikasi untuk melanjutkan pendaftaran. Kode berlaku ${MASA_BERLAKU_MENIT} menit.`);
    const isiTeksEmail = templateIsi.replace(/\{kode\}/g, kode);

    await addDoc(collection(db, "mail"), {
      to: [emailBersih],
      message: {
        subject: judulEmail,
        text: isiTeksEmail
      },
      dikirim_pada: serverTimestamp() // dipakai Mail Gateway > Monitoring buat urutkan (ID dokumen acak, tidak mencerminkan waktu)
    });

    return { sukses: true };
  } catch (e) {
    console.error("Gagal kirim OTP email:", e);
    return { sukses: false, pesan: 'Gagal mengirim kode verifikasi. Coba lagi beberapa saat.' };
  }
};

// window.verifikasiOtpEmail(email, tebakan) — return { sukses, pesan }.
window.verifikasiOtpEmail = async function(email, tebakan) {
  const emailBersih = (email || '').trim().toLowerCase();
  const tebakanBersih = (tebakan || '').trim();
  if (!/^\d{6}$/.test(tebakanBersih)) {
    return { sukses: false, pesan: 'Kode harus 6 angka.' };
  }

  try {
    // Client TIDAK bisa baca dokumennya (rules blokir get) — jadi tidak
    // tahu dari sini apakah kodenya benar/salah/kadaluarsa SEBELUM coba.
    // Kirim tebakan sebagai percobaan update; Firestore Rules yang
    // MEMUTUSKAN boleh/tidaknya — hasil akhirnya kita baca dari
    // BERHASIL/GAGALNYA operasi update INI SENDIRI (lihat catch di bawah).
    await updateDoc(doc(db, "otp_email", emailBersih), {
      tebakan: tebakanBersih,
      terverifikasi: true
    });
    return { sukses: true };
  } catch (e) {
    // Rules menolak (kode salah / kadaluarsa) -> Firestore lempar error
    // permission-denied ke sini. Ini SINYAL "tebakan ditolak", bukan
    // berarti ada error teknis — pesan ke user harus tetap ramah.
    return { sukses: false, pesan: 'Kode salah atau sudah kadaluarsa (berlaku 10 menit). Coba lagi atau minta kode baru.' };
  }
};
