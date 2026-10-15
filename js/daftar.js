/* =========================================================
   AURI – daftar.js
   Mengambil data dari Google Spreadsheet, lalu menampilkannya
   sebagai tabel yang bisa difilter dan dibagi per halaman.

   ISI:
   1. PENGATURAN   (bagian yang mungkin perlu Anda ubah)
   2. ALAT BANTU   (pembaca CSV, dll.)
   3. MENGAMBIL DATA
   4. FILTER
   5. MENAMPILKAN TABEL
   6. PASANG AKSI & MULAI
   ========================================================= */


/* =========================================================
   1. PENGATURAN
   ========================================================= */

// ID spreadsheet = bagian di antara "/d/" dan "/edit" pada alamat spreadsheet
const ID_SPREADSHEET = "19AzRjBrQ5phv3lX7FYtrCSMlWuR2AdhJOD0VUU84Szs";

// Daftar kelompok. "gid" = nomor tab di spreadsheet.
// Cara cari gid: buka tab tersebut di spreadsheet, lihat alamat di browser,
// angka setelah "gid=" itulah gid-nya (contoh: ...edit#gid=123456).
// Kosongkan ("") kalau tab-nya belum dibuat → kotaknya otomatis nonaktif.
const KELOMPOK = {
  mamalia: { nama: "Mamalia", gid: "0" },   // <- cek: sesuaikan dengan gid tab Mamalia Anda
  burung:  { nama: "Burung",  gid: ""  },
  ikan:    { nama: "Ikan",    gid: ""  },
  reptil:  { nama: "Reptil",  gid: ""  },
  amfibi:  { nama: "Amfibi",  gid: ""  }
};

// Urutan kolom di spreadsheet (mulai dari 0):
// A=No (tidak dipakai, nomor dibuat ulang otomatis), B=Famili, C=Nama ilmiah,
// D=Nama Inggris, E=Nama Indonesia, F=Sebaran, G=Status
const KOLOM = { famili: 1, ilmiah: 2, inggris: 3, indonesia: 4, sebaran: 5, status: 6 };

// Urutan status pada dropdown filter (yang tidak tercantum ditaruh di akhir)
const URUTAN_STATUS = [
  "Punah", "Punah di alam liar", "Kritis", "Genting", "Rentan", "Terancam",
  "Hampir terancam", "Risiko rendah", "Data kurang", "Belum dinilai"
];


/* =========================================================
   2. ALAT BANTU
   ========================================================= */

// Mengubah teks CSV (hasil unduhan spreadsheet) menjadi array baris.
// Sudah menangani sel berkoma di dalam tanda kutip, misal "Maluku, Papua".
function bacaCSV(teks) {
  const baris = [];
  let sel = "";
  let barisIni = [];
  let dalamKutip = false;

  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];

    if (dalamKutip) {
      if (c === '"') {
        if (teks[i + 1] === '"') { sel += '"'; i++; }   // "" = satu tanda kutip
        else { dalamKutip = false; }
      } else {
        sel += c;
      }
    } else if (c === '"') {
      dalamKutip = true;
    } else if (c === ",") {
      barisIni.push(sel); sel = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && teks[i + 1] === "\n") i++;
      barisIni.push(sel); sel = "";
      baris.push(barisIni); barisIni = [];
    } else {
      sel += c;
    }
  }
  if (sel !== "" || barisIni.length > 0) { barisIni.push(sel); baris.push(barisIni); }
  return baris;
}

// Merapikan teks sel: hapus spasi berlebih dan baris baru
function rapikan(teks) {
  return (teks || "").replace(/\s+/g, " ").trim();
}

// "Risiko rendah" -> "risiko-rendah" (untuk nama kelas warna lencana)
function buatSlug(teks) {
  return teks.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Urutkan teks sesuai abjad bahasa Indonesia
function urutAbjad(daftar) {
  return daftar.slice().sort(function (a, b) { return a.localeCompare(b, "id"); });
}


/* =========================================================
   3. MENGAMBIL DATA
   ========================================================= */

const cacheData = {};        // data tiap kelompok disimpan di sini agar tidak diunduh ulang
let semuaData = [];          // gabungan data kelompok yang dicentang
let hasilFilter = [];        // data setelah difilter
let halamanSekarang = 1;
let nomorPermintaan = 0;     // penanda agar hasil lama tidak menimpa hasil baru

// Ambil satu tab dari spreadsheet
async function muatKelompok(kunci) {
  if (cacheData[kunci]) return cacheData[kunci];

  const gid = KELOMPOK[kunci].gid;
  const alamat = "https://docs.google.com/spreadsheets/d/" + ID_SPREADSHEET +
                 "/gviz/tq?tqx=out:csv&headers=1&gid=" + gid;

  const respons = await fetch(alamat);
  if (!respons.ok) throw new Error("Gagal mengambil " + KELOMPOK[kunci].nama);
  const baris = bacaCSV(await respons.text());

  const data = [];
  baris.forEach(function (b) {
    const ilmiah = rapikan(b[KOLOM.ilmiah]);
    // Lewati baris judul kolom dan baris kosong
    if (!ilmiah || ilmiah.toLowerCase() === "nama ilmiah") return;

    data.push({
      kelompok:  KELOMPOK[kunci].nama,
      famili:    rapikan(b[KOLOM.famili]),
      ilmiah:    ilmiah,
      inggris:   rapikan(b[KOLOM.inggris]),
      indonesia: rapikan(b[KOLOM.indonesia]),
      sebaran:   rapikan(b[KOLOM.sebaran]),
      status:    rapikan(b[KOLOM.status])
    });
  });

  cacheData[kunci] = data;
  return data;
}

// Muat semua kelompok yang sedang dicentang, lalu tampilkan
async function perbaruiData() {
  const permintaan = ++nomorPermintaan;
  const dicentang = Array.from(kotakKelompok)
    .filter(function (k) { return k.checked; })
    .map(function (k) { return k.value; });

  if (dicentang.length === 0) {
    semuaData = [];
    isiPilihanFilter();
    terapkanFilter();
    tampilkanPesan("Pilih minimal satu kelompok di atas.");
    return;
  }

  tampilkanPesan("Memuat data…");
  try {
    const hasil = await Promise.all(dicentang.map(muatKelompok));
    if (permintaan !== nomorPermintaan) return;     // ada permintaan yang lebih baru
    semuaData = [].concat.apply([], hasil);
    isiPilihanFilter();
    terapkanFilter();
  } catch (galat) {
    if (permintaan !== nomorPermintaan) return;
    console.error(galat);
    semuaData = [];
    terapkanFilter();
    tampilkanPesan("Data gagal dimuat. Pastikan spreadsheet dibagikan dengan akses " +
                   "“Siapa saja yang memiliki link” (Pelihat) dan nomor gid di js/daftar.js sudah benar.");
  }
}


/* =========================================================
   4. FILTER
   ========================================================= */

// Isi pilihan dropdown dari data yang sedang dimuat
function isiPilihanFilter() {
  const famili = [], sebaran = [], status = [];

  semuaData.forEach(function (d) {
    if (d.famili && famili.indexOf(d.famili) === -1) famili.push(d.famili);
    if (d.status && status.indexOf(d.status) === -1) status.push(d.status);
    d.sebaran.split(",").forEach(function (w) {
      const wilayah = w.trim();
      if (wilayah && sebaran.indexOf(wilayah) === -1) sebaran.push(wilayah);
    });
  });

  // Urutan status: sesuai URUTAN_STATUS, sisanya di akhir
  status.sort(function (a, b) {
    let ia = URUTAN_STATUS.indexOf(a), ib = URUTAN_STATUS.indexOf(b);
    if (ia === -1) ia = 999;
    if (ib === -1) ib = 999;
    return ia - ib;
  });

  isiDropdown(pilihFamili,  urutAbjad(famili),  "Semua famili");
  isiDropdown(pilihSebaran, urutAbjad(sebaran), "Semua sebaran");
  isiDropdown(pilihStatus,  status,             "Semua status");
}

// Isi satu dropdown; pilihan yang sedang aktif dipertahankan kalau masih ada
function isiDropdown(elemen, pilihan, teksSemua) {
  const terpilih = elemen.value;
  elemen.innerHTML = "";

  const semua = document.createElement("option");
  semua.value = "";
  semua.textContent = teksSemua;
  elemen.appendChild(semua);

  pilihan.forEach(function (p) {
    const o = document.createElement("option");
    o.value = p;
    o.textContent = p;
    elemen.appendChild(o);
  });

  if (pilihan.indexOf(terpilih) !== -1) elemen.value = terpilih;
}

// Saring data sesuai tiga dropdown, lalu tampilkan halaman 1
function terapkanFilter() {
  const famili  = pilihFamili.value;
  const sebaran = pilihSebaran.value;
  const status  = pilihStatus.value;

  hasilFilter = semuaData.filter(function (d) {
    if (famili && d.famili !== famili) return false;
    if (status && d.status !== status) return false;
    if (sebaran) {
      // Sebaran bisa berisi beberapa wilayah dipisah koma: cocokkan salah satunya
      const daftar = d.sebaran.split(",").map(function (w) { return w.trim(); });
      if (daftar.indexOf(sebaran) === -1) return false;
    }
    return true;
  });

  halamanSekarang = 1;
  tampilkanTabel();
}


/* =========================================================
   5. MENAMPILKAN TABEL
   ========================================================= */

function tampilkanPesan(teks) {
  elemenPesan.textContent = teks;
}

// Buat satu sel tabel berisi teks
function buatSel(teks) {
  const td = document.createElement("td");
  td.textContent = teks;
  return td;
}

function tampilkanTabel() {
  const perHalaman = parseInt(pilihJumlah.value, 10);
  const total = hasilFilter.length;
  const jumlahHalaman = Math.max(1, Math.ceil(total / perHalaman));
  if (halamanSekarang > jumlahHalaman) halamanSekarang = jumlahHalaman;

  const awal = (halamanSekarang - 1) * perHalaman;
  const potongan = hasilFilter.slice(awal, awal + perHalaman);

  // Isi baris tabel
  isiTabel.innerHTML = "";
  potongan.forEach(function (d, i) {
    const tr = document.createElement("tr");

    tr.appendChild(buatSel(awal + i + 1));       // nomor entri
    tr.appendChild(buatSel(d.famili));
    tr.appendChild(buatSel(d.ilmiah));
    tr.appendChild(buatSel(d.inggris));
    tr.appendChild(buatSel(d.indonesia));
    tr.appendChild(buatSel(d.sebaran));

    // Status dibuat sebagai lencana berwarna
    const tdStatus = document.createElement("td");
    if (d.status) {
      const lencana = document.createElement("span");
      lencana.className = "status status--" + buatSlug(d.status);
      lencana.textContent = d.status;
      tdStatus.appendChild(lencana);
    }
    tr.appendChild(tdStatus);

    isiTabel.appendChild(tr);
  });

  // Pesan, info halaman, dan panah
  if (total === 0 && semuaData.length > 0) {
    tampilkanPesan("Tidak ada entri yang cocok dengan filter.");
  } else if (semuaData.length > 0) {
    tampilkanPesan(total + " entri ditemukan.");
  }

  if (total === 0) {
    infoHalaman.textContent = "";
  } else {
    infoHalaman.textContent = "Entri " + (awal + 1) + "–" + (awal + potongan.length) +
      " dari " + total + " · Halaman " + halamanSekarang + " dari " + jumlahHalaman;
  }
  tombolSebelumnya.disabled = halamanSekarang <= 1;
  tombolBerikutnya.disabled = halamanSekarang >= jumlahHalaman;
}

// Pindah halaman, lalu gulir ke bagian atas tabel
function keHalaman(nomor) {
  halamanSekarang = nomor;
  tampilkanTabel();
  tabelBungkus.scrollIntoView({ behavior: "smooth", block: "start" });
}


/* =========================================================
   6. PASANG AKSI & MULAI
   ========================================================= */

// Ambil elemen-elemen dari HTML
const kotakKelompok     = document.querySelectorAll("#pilihanKelompok input");
const pilihFamili       = document.getElementById("filterFamili");
const pilihSebaran      = document.getElementById("filterSebaran");
const pilihStatus       = document.getElementById("filterStatus");
const pilihJumlah       = document.getElementById("jumlahPerHalaman");
const tombolReset       = document.getElementById("tombolReset");
const tombolSebelumnya  = document.getElementById("tombolSebelumnya");
const tombolBerikutnya  = document.getElementById("tombolBerikutnya");
const infoHalaman       = document.getElementById("infoHalaman");
const elemenPesan       = document.getElementById("pesan");
const isiTabel          = document.getElementById("isiTabel");
const tabelBungkus      = document.getElementById("tabelBungkus");

// Kotak centang untuk kelompok yang belum punya gid dinonaktifkan
kotakKelompok.forEach(function (kotak) {
  const kelompok = KELOMPOK[kotak.value];
  if (!kelompok || kelompok.gid === "") {
    kotak.checked = false;
    kotak.disabled = true;
    kotak.parentElement.classList.add("is-nonaktif");
    kotak.parentElement.title = "Data belum tersedia";
  }
  kotak.addEventListener("change", perbaruiData);
});

// Filter berubah -> saring ulang
[pilihFamili, pilihSebaran, pilihStatus].forEach(function (p) {
  p.addEventListener("change", terapkanFilter);
});

// Jumlah entri per halaman berubah -> kembali ke halaman 1
pilihJumlah.addEventListener("change", function () {
  halamanSekarang = 1;
  tampilkanTabel();
});

// Tombol atur ulang: kosongkan semua filter
tombolReset.addEventListener("click", function () {
  pilihFamili.value = "";
  pilihSebaran.value = "";
  pilihStatus.value = "";
  terapkanFilter();
});

// Panah halaman
tombolSebelumnya.addEventListener("click", function () { keHalaman(halamanSekarang - 1); });
tombolBerikutnya.addEventListener("click", function () { keHalaman(halamanSekarang + 1); });

// Mulai
perbaruiData();
