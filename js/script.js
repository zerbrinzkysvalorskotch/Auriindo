/* =========================================================
   AURI – script.js
   Carousel: ganti gambar otomatis tiap 10 detik,
   bisa digeser manual, dan bulatan penanda ikut berubah.
   ========================================================= */

// ---------- Pengaturan (ubah di sini) ----------
const JEDA_GANTI = 10000;   // 10000 milidetik = 10 detik

// ---------- Ambil elemen dari HTML ----------
const track = document.getElementById("carouselTrack");
const dots  = document.querySelectorAll(".carousel__dot");

let slideAktif = 0;   // nomor slide yang sedang tampil (mulai dari 0)
let timer;            // penyimpan timer ganti otomatis


// ---------- Pindah ke slide tertentu ----------
function keSlide(nomor) {
  // Jika lewat slide terakhir, kembali ke slide pertama (dan sebaliknya)
  slideAktif = (nomor + dots.length) % dots.length;

  track.scrollTo({
    left: track.clientWidth * slideAktif,
    behavior: "smooth"
  });
}


// ---------- Perbarui bulatan penanda ----------
function perbaruiBulatan() {
  // Hitung sedang di slide ke berapa berdasarkan posisi geser
  const nomor = Math.round(track.scrollLeft / track.clientWidth);
  slideAktif = nomor;

  dots.forEach(function (dot, i) {
    dot.classList.toggle("is-active", i === nomor);
  });
}


// ---------- Ganti otomatis ----------
function mulaiOtomatis() {
  clearInterval(timer);                       // hentikan timer lama
  timer = setInterval(function () {
    keSlide(slideAktif + 1);
  }, JEDA_GANTI);
}


// ---------- Pasang aksi ----------

// 1. Tiap kali carousel bergeser (otomatis / digeser tangan), perbarui bulatan
track.addEventListener("scroll", perbaruiBulatan);

// 2. Klik bulatan -> pindah ke gambar itu
dots.forEach(function (dot, i) {
  dot.addEventListener("click", function () {
    keSlide(i);
    mulaiOtomatis();                          // hitung ulang 10 detik
  });
});

// 3. Kalau pengunjung menggeser sendiri, hitung ulang 10 detik
track.addEventListener("touchstart", mulaiOtomatis, { passive: true });
track.addEventListener("wheel",      mulaiOtomatis, { passive: true });

// 4. Jika ukuran jendela berubah, rapikan posisi slide
window.addEventListener("resize", function () {
  track.scrollTo({ left: track.clientWidth * slideAktif });
});

// Jalankan saat halaman dibuka
mulaiOtomatis();
