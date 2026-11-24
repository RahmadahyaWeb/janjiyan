# Janjiyan Story Bank & Product Reference for Threads

This reference file supplies verified product facts, business-type scenarios, and hook frameworks for the `threads-storyteller` skill.

---

## 1. Core Identity, Founder Origin Story (Soklenn -> Janjiyan) & Value Proposition

- **Product Name**: **Janjiyan** (`janjiyan.web.id`)
- **True Founder Origin Story (`Soklenn` -> `Janjiyan`)**:
  - Rahmat runs his own shoe care (cuci sepatu) business called **Soklenn** (`soklenn-shoes.janjiyan.web.id`).
  - Initially, **Soklenn** already had its own custom internal web system built to handle its daily shoe care operations (catat sepatu masuk, label tag per pasang, pantau antrean kerja, info ke WA pelanggan, sampai struk kasir).
  - Seeing how much calmer daily operations became at Soklenn, Rahmat felt it would be a waste to keep the system only for himself (*"sayang aja kalau sistem ini cuma gue pake sendiri, kenapa nggak gue share ke UMKM lain siapa tahu ada yang butuh"*).
  - That internal system evolved into **Janjiyan**, opened up for fellow Indonesian service businesses across drop-off shops (cuci sepatu, laundry, servis), staff appointments (barbershop, salon, klinik), and space bookings (studio, lapangan olahraga).
- **Positioning**: All-in-one B2B SaaS appointment booking, drop-off queue, and counter POS operations platform built by a real service business owner for Indonesian UMKM jasa.
- **Public Tenant Portal**: Wildcard subdomain `{slug}.janjiyan.web.id` (e.g., `rapi-studio.janjiyan.web.id`, `arena-padel.janjiyan.web.id`, `soklenn-shoes.janjiyan.web.id`).
- **Key Differentiators**:
  1. **Booking <= 60 Seconds Without Customer Login**: Customers click the link in IG/TikTok bio or scan a QR poster, pick a slot/service, and book immediately without downloading an app or creating an account.
  2. **0% DP Transaction Fee**: Customer down payments (*Uang Muka* / DP) go directly to the merchant's bank account or static QRIS. Janjiyan takes 0% cut.
  3. **Three Permanently Locked Business Models**: The entire dashboard, terminology, WhatsApp templates, and booking flow adapt automatically to the business's operational reality.
  4. **End-to-End Operations (From Booking to Cashier Receipt & Google Review)**: Replaces fragmented WhatsApp chats, manual Excel sheets, paper notes, separate cashier calculators, and awkward Google review requests.

---

## 2. Pricing & Trial Facts

- **Free Trial**: 14-day Free Trial on the **Professional** plan (no credit card required to start).
- **Plans**:
  - **Basic (Rp 49.000 / bulan)**: 1 bisnis, 5 layanan, 100 booking/bulan, hingga 5 add-ons, pelunasan kasir & cetak struk thermal `58mm`/`80mm` + label tag barang.
  - **Professional (Rp 129.000 / bulan)**: Hingga 3 bisnis, 10 layanan/bisnis, 500 booking/bulan, unlimited add-ons & multi-service cart, laporan komisi staff + export CSV, rekap kasir harian per metode bayar (`cash`, `qris`, `transfer`, `edc`), Smart Google Maps Review Redirect + cetak stiker QR review.
  - **Enterprise (Rp 249.000 / bulan)**: Hingga 10 bisnis, layanan & kuota booking unlimited, seluruh fitur Pro tanpa batas.

---

## 3. Real-World UMKM Scenarios by Locked Business Type

### A. `staff_appointment` — Janji Temu & Staff
- **Target Verticals**: Barbershop, Salon, Klinik Kecantikan/Gigi, Spa & Reflexology, Pet Grooming, Konsultasi.
- **Daily Pain Points**:
  - Admin kewalahan balas chat WA satu-satu: *"Mas Andi jam 4 kosong nggak?"*, pas dibalas 15 menit kemudian slotnya udah diisi orang lain yang walk-in.
  - Pelanggan booking jam ramai (Malam Minggu / Jumat sore), terus *ghosting* (no-show) tanpa kabar. Kursi kosong, kapster/terapis nganggur, pelanggan lain yang mau masuk malah udah ditolak.
  - Malam akhir bulan owner pusing rekap komisi masing-masing kapster dari tumpukan nota kertas, sering selisih antara komisi jasa potong vs produk pomade/add-on.
- **How Janjiyan Solves It**:
  - Pelanggan pilih langsung jadwal & staff yang tersedia secara real-time di `{slug}.janjiyan.web.id`.
  - Jam kerja per staff (`StaffOperatingHour`), jam istirahat, dan cuti (`StaffTimeOff`) otomatis memblokir slot.
  - **Auto No-Show Protection**: Pelanggan yang pernah *no-show* melewati batas otomatis wajib bayar **DP 100%** di booking berikutnya atau diblokir dari booking online.
  - **Komisi Staff Otomatis**: Komisi dihitung & di-snapshot otomatis dari layanan utama + add-on yang *commissionable* saja.

### B. `space_booking` — Booking Tempat / Sesi
- **Target Verticals**: Lapangan Padel, Futsal, Badminton, Mini Soccer, Studio Foto / Podcast, Kelas Pilates / Yoga, Ruang Meeting.
- **Daily Pain Points**:
  - *Double-booking* di jam *prime time* (jam 18.00–22.00) karena satu orang pesan lewat DM Instagram, satu lagi chat WA ke admin yang beda shift.
  - Orang booking lapangan tahan jadwal dari pagi tapi nggak transfer-transfer DP, akhirnya jam 7 malam batal mendadak.
  - Sewa tambahan (sewa raket padel, bola, extra lighting studio, air mineral) nggak tercatat rapi waktu pelunasan di meja kasir.
- **How Janjiyan Solves It**:
  - **Atomic Slot Locking & Auto-Expiry DP**: Kalau pelanggan pilih "Bayar Nanti" dan belum upload bukti DP dalam batas waktu (misal 2 jam), sistem otomatis membatalkan booking (`dp_expired`) dan membuka kembali slot lapangan untuk orang lain.
  - **Add-ons & Kasir Pelunasan**: Saat pelanggan datang ke lapangan/studio, kasir tinggal tambah item sewa raket/minuman di meja kasir, sistem langsung hitung total kurang bayar (`total_price - paid_amount`), catat pembayaran (`cash`/`qris`/`transfer`/`edc`), dan cetak struk thermal atau kirim struk gambar PNG ke WhatsApp.

### C. `dropoff` — Layanan Titip / Drop-off
- **Target Verticals**: Cuci Sepatu & Tas (Shoe Care), Laundry & Dry Clean, Servis Gadget/Elektronik, Bengkel & Detailing, Jahit & Permak.
- **Daily Pain Points**:
  - Nota kertas luntur atau hilang, sepatu pelanggan tertukar karena nggak ada label tag per barang.
  - Terima order kebanyakan dalam sehari sampai kuota pengerjaan jebol dan cucian telat semua.
  - Setiap hari puluhan chat masuk cuma nanya: *"Kak, sepatu saya udah beres belum?"*
  - Pelanggan bawa 3 pasang sepatu dengan layanan beda-beda (Deep Clean, Unyellowing, Repaint) + parfum sepatu, hitung estimasi selesai dan sisa bayarnya masih manual pakai kalkulator.
- **How Janjiyan Solves It**:
  - **Satuan Adaptif (`unit_label`)**: Bisa diatur per `pasang`, `kg`, `pcs`, `unit`, atau `item` dengan batas kuota harian otomatis dan hitungan estimasi tanggal selesai (`estimated_ready_date`) yang melewati hari libur toko.
  - **Multi-Service Cart & Cetak Tag Barang**: Satu nota bisa gabung banyak layanan + add-on sekaligus, cetak **Drop-off Item Tag/Label** (kode order, nama pelanggan, jumlah item) untuk ditempel di barang, dan pantau progres lewat tab antrean kerja (`Menunggu Barang`, `Sedang Dikerjakan`, `Siap Diambil`, `Sudah Diambil`).
  - **1-Click WhatsApp & Real-Time Status**: Begitu status digeser ke `Siap Diambil`, klik satu tombol untuk kirim WA otomatis lengkap dengan rincian sisa tagihan.

---

## 4. High-Impact Feature Spotlights for Case Study Threads

1. **Smart Google Maps Review Redirect + Stiker QR Meja Kasir**:
   - Masalah: Pelanggan yang puas jarang kepikiran nulis review di Google Maps, tapi pelanggan yang komplain langsung kasih bintang 1 di publik.
   - Solusi Janjiyan: Cetak stiker QR Review (`1:1`, A6 Tent Card, atau A4 grid) di meja kasir atau klik link dari invoice. Pelanggan kasih rating dulu: kalau **bintang 4–5**, komentarnya bisa di-copy 1 klik lalu diarahkan langsung ke **Google Maps Review**. Kalau **bintang 1–3**, masuk ke **kotak saran privat** di dashboard owner + kirim notifikasi Telegram instan supaya owner bisa bereskan masalahnya sebelum jadi keributan di publik.
2. **Kasir Pelunasan & Struk Thermal / WhatsApp PNG**:
   - Masalah: Aplikasi booking biasanya pisah sama kasir. DP dicatat di mana, pelunasan di mana, pas tutup toko uang di laci nggak cocok sama catatan.
   - Solusi Janjiyan: Buku besar pembayaran (`booking_payments`) mencatat setiap rupiah dari DP awal sampai pelunasan di kasir (termasuk uang tunai diterima & kembalian). Bisa langsung print struk thermal `58mm`/`80mm` atau unduh gambar struk PNG siap kirim ke WA pelanggan.
3. **Notifikasi Telegram Bot Instan & Terenkripsi**:
   - Masalah: Notifikasi email sering ketumpuk, sementara grup WA toko terlalu berisik.
   - Solusi Janjiyan: Setiap ada booking baru, bukti DP diunggah, atau komplain bintang rendah masuk, bot Telegram langsung bunyi di HP owner & tim dalam hitungan detik.

---

## 5. Warm, Empathetic Indonesian Threads Hook Patterns (Santai `Gue / Lo` & Anti-Menggurui)

Use these natural, non-preachy storytelling openings with casual `gue / lo` for **Post 1 (`HOOK`)**:

- **The Slice-of-Life Observation Hook (Cerita dari Kursi Tunggu)**:
  - *"Sabtu sore kemarin pas lagi nunggu giliran potong rambut, gue perhatiin Mas kapsternya bolak-balik naruh gunting cuma buat balesin chat WhatsApp yang masuk beruntun."*
  - *"Minggu lalu gue mampir ke tempat cuci sepatu langganan pas habis hujan. Di meja kasirnya ada puluhan pasang sepatu basah, sementara mbak kasirnya lagi panik nyariin satu lembar nota kertas yang nyelip."*
- **The Humble Founder Confession Hook (Cerita Awal Mula Soklenn -> Janjiyan)**:
  - *"Awalnya gue bikin sistem web cuma buat ngurus operasional usaha cuci sepatu gue sendiri, Soklenn. Tapi lama-lama gue mikir, sayang juga ya kalau cuma gue pake sendiri."*
  - *"Gue sehari-hari jalanin usaha cuci sepatu namanya Soklenn. Dari dulu udah pake sistem web bikinan sendiri buat ngatur sepatu masuk sampai kasir, terus kepikiran: kenapa nggak gue buka aja buat temen-temen UMKM lain, siapa tahu ada yang lagi butuh."*
- **The Behind-the-Counter Empathy Hook (Empati di Balik Meja Kasir)**:
  - *"Kadang gue suka salut sama kesabaran lo yang punya usaha lapangan olahraga atau studio foto. Udah nahan jadwal jam 7 malam buat pelanggan yang janji mau transfer, eh pas jamnya tiba orangnya malah ngilang."*
  - *"Hal yang paling jarang kelihatan dari luar pas orang lihat barbershop atau tempat laundry lagi ramai: pemiliknya masih duduk di depan meja kasir jam 11 malam, nyocokin uang di laci sama tumpukan chat dari pagi."*
