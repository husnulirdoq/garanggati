# Ruang

Blog publik berbahasa Indonesia untuk filsafat, bahasa, teknologi, dan belajar. Situs dibangun sebagai file statis dan diterbitkan ke GitHub Pages; panel admin menggunakan Firebase Authentication dan Cloud Firestore.

## Setup Firebase gratis

Firebase Web config yang dipakai situs bukan password atau service-account key. Izin baca/tulis tetap harus dibatasi oleh Firestore Security Rules.

1. Buat project di [Firebase Console](https://console.firebase.google.com/) dan pilih paket **Spark (no-cost)**. GA4 terpisah dari Firebase (lihat bagian Analytics).
2. Dari halaman Project Overview, tambahkan aplikasi **Web**. Salin nilai `apiKey`, `authDomain`, `projectId`, dan `appId` ke `firebase-config.js`, menggantikan nilai `REPLACE_WITH_...`.
3. Di **Authentication → Sign-in method**, aktifkan **Email/Password**.
4. Di **Authentication → Users**, pilih **Add user** untuk membuat akun admin. Setelah dibuat, UID ada di kolom **User UID**; bila tabel tidak menampilkannya, klik baris akun untuk membuka detail pengguna. Jangan menambahkan form pendaftaran publik.
5. Salin nilai **User UID** tersebut, lalu ganti teks `REPLACE_WITH_ADMIN_UID` di `firestore.rules` dengan UID itu. Pertahankan tanda kutipnya.
6. Di **Firestore Database**, buat database pada mode Production. Pilih lokasi yang paling dekat dengan pembaca; lokasi database tidak dapat diubah sesudah dibuat.
7. Buka tab **Rules**, tempel isi `firestore.rules`, lalu tekan **Publish**. Aturan mengizinkan publik membaca tulisan yang terbit dan hanya UID admin yang mengubah data.
8. Di **Authentication → Settings → Authorized domains**, tambahkan `garanggati.web.id`. Tambahkan `localhost` untuk pengujian lokal bila belum tercantum.
9. Commit perubahan `firebase-config.js` dan `firestore.rules` ke `main`. GitHub Actions akan membangun ulang situs.
10. Buka `https://garanggati.web.id/admin/`, masuk dengan akun admin, lalu pilih **Impor tulisan dari Codespaces** untuk menambahkan artikel Markdown yang belum ada di Firestore. Artikel Firestore yang sudah ada tidak ditimpa.

Firebase Web config memang tampil di bundle publik; itu normal untuk aplikasi web. Jangan pernah mengunggah password admin, token, private key, atau service-account JSON. Proteksi penulisan berasal dari Firestore Rules, bukan dari menyembunyikan URL admin.

Paket Spark tidak memerlukan metode pembayaran untuk mulai. Kuota Firebase saat ini mencakup hingga 50.000 pengguna aktif bulanan untuk layanan Authentication non-SMS; Firestore menyediakan 1 GiB data tersimpan, 50.000 pembacaan/hari, 20.000 penulisan/hari, 20.000 penghapusan/hari, dan 10 GiB transfer keluar/bulan. Jika kuota Spark terlampaui, operasi dapat ditolak sampai kuota tersedia lagi. Lihat [harga Firebase](https://firebase.google.com/pricing) dan [kuota Firestore](https://firebase.google.com/docs/firestore/quotas).

## Analytics (GA4)

Halaman publik mengirim data langsung ke properti GA4 dengan Measurement ID `G-9XYG7QZPFV`. Admin tidak mengirim data Analytics.

Setelah situs diterbitkan, uji kunjungan dengan laporan **Realtime** di GA4. Klik tombol share mengirim event `article_share_click` dengan parameter `article_title`, `article_url`, dan `share_method`; gunakan **DebugView** untuk memeriksanya. Data kunjungan dapat dilihat pada **Traffic acquisition**.

Tautan dari tombol share membawa `utm_source=article_share`, `utm_medium=social`, dan `utm_campaign=article_share`; laporan kampanye dapat membedakan kunjungan dari tautan share. Event `article_share_click` mengukur klik/percobaan berbagi, bukan memastikan tautannya benar-benar dikirim. Tombol share bawaan perangkat tidak memberi tahu platform tujuan. Pengiriman data bergantung pada izin browser, koneksi jaringan, dan pemblokir pelacak.

## Adsterra

Iklan Adsterra sedang dimatikan karena trafik masih rendah dan iklan yang sebelumnya tampil dirasa meragukan. Script serta unit iklan tidak lagi dimuat pada halaman publik. Tinjau kembali jaringan dan format iklan sebelum mengaktifkannya lagi.

## Menulis artikel

Buka `/admin/`, masuk, lalu buat atau edit tulisan. Alamat artikel dibuat otomatis dari judul. Pilih salah satu topik yang tersedia dan tulis langsung di editor visual; tombol pemformatan tersedia jika diperlukan. Centang **Terbitkan tulisan** agar artikel terlihat di blog.

Artikel terbit dalam `content/posts/` ditampilkan bersama artikel terbit dari Firestore. Jika slug sama, versi Firestore yang digunakan. Gunakan tombol impor di admin untuk menambahkan artikel Codespaces yang belum ada; artikel yang sudah ada tidak ditimpa.

Karena GitHub Pages tidak menjalankan server, isi Firestore dimuat oleh browser. Artikel di `content/posts/` dibuat sebagai halaman statis dengan URL kanonis per artikel, metadata, data terstruktur, dan entri sitemap. Artikel yang hanya ada di Firestore tetap dirender di browser dan belum otomatis masuk sitemap sampai tersedia di `content/posts/`. Feed RSS belum tersedia. Jangan simpan artikel rahasia di Firestore; pengunjung dapat membaca semua dokumen yang berstatus terbit.

## Newsfeed

Halaman utama memiliki bagian headline untuk Ojol, Bitcoin, Keuangan, dan Teknologi. Bagian Bitcoin, Keuangan, dan Teknologi mengambil feed RSS publik Cointelegraph (`/rss/tag/bitcoin`, `/rss/tag/business`, `/rss/tag/technology`) melalui proxy CORS stateless di `workers/cointelegraph-rss-proxy/` tanpa database atau cache tambahan, sehingga feed dapat dimuat ulang langsung dari browser.

### Setup Cloudflare Worker untuk RSS CORS (gratis)

1. Masuk ke [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Create Worker** (atau deploy dari `workers/cointelegraph-rss-proxy/` menggunakan `npx wrangler deploy`).
2. Salin isi `workers/cointelegraph-rss-proxy/worker.js` ke editor Worker, lalu tekan **Deploy**.
3. Salin URL Worker (contoh: `https://garanggati-rss-proxy.<subdomain>.workers.dev`) dan ganti `REPLACE_WITH_CLOUDFLARE_WORKER_URL` di `rss-config.js`.
4. Commit dan push perubahan `rss-config.js` ke `main` agar GitHub Actions membangun ulang situs.

Worker hanya meneruskan daftar URL RSS Cointelegraph yang diizinkan (`?feed=bitcoin|business|technology|...`) dan membatasi header `Access-Control-Allow-Origin` ke `https://garanggati.web.id`, `https://www.garanggati.web.id`, serta `localhost` untuk pengujian lokal. Bagian Ojol belum terhubung ke sumber berita karena Cointelegraph tidak menyediakan topik transportasi online lokal.

## Donasi Web3

Halaman utama menampilkan pilot donasi **USDC sungguhan di Base Mainnet** (`chainId 8453`). Wallet browser EVM, seperti MetaMask, harus memiliki USDC untuk donasi dan ETH di Base untuk gas. Penerima adalah alamat wallet yang diberikan pemilik situs; transaksi harus diperiksa dengan teliti di wallet sebelum disetujui dan tidak dapat dibatalkan setelah dikonfirmasi.

Integrasi berinteraksi langsung dengan kontrak USDC resmi Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`), tanpa perantara atau penyimpanan private key. Alamat penerima dan transaksi dapat dilihat publik di blockchain. Jangan masukkan seed phrase atau private key di situs.

## Grafik BTC live

Halaman utama menampilkan grafik BTC/USD dari ticker gratis CoinPaprika tanpa API key. Titik harga disimpan di `localStorage` browser dan dipulihkan saat halaman dibuka kembali, sehingga riwayat grafik tidak hilang saat refresh. Riwayat mencakup maksimal 24 jam dan 289 titik, hanya tersedia di browser/perangkat yang sama, serta dapat terhapus jika data situs dibersihkan. Data CoinPaprika adalah harga agregat tertimbang dari pasar yang dipantau; paket gratis diperbarui rata-rata setiap lima menit, bukan tick bursa real-time. API paket gratis memiliki kuota 20.000 request per bulan, sehingga widget meminta data tiap lima menit. Endpoint merespons dari workspace dan mengizinkan CORS, tetapi akses dari Codespaces tidak menjamin endpoint dapat diakses dari semua ISP Indonesia. Fitur ini hanya menampilkan data pasar; tidak melakukan trading dan bukan saran investasi.

## Shop

Halaman `/shop/` berisi kartu menuju toko Garanggati di Shopee, TikTok Shop, Blibli, dan Lazada. Kartu saat ini membuka halaman toko masing-masing; untuk menampilkan embed produk individual, gunakan tautan produk yang spesifik.

Tombol **Unduh Wellbeing Tracker** di halaman utama mengarah ke APK Android pada GitHub Release `build-35`. Perbarui `WELLBEING_APK_URL` di `scripts/build.py` ketika APK rilis baru tersedia.

## Buku tamu

Bagian buku tamu di halaman utama memungkinkan pengunjung mengirim nama dan pesan singkat. Pesan disimpan di koleksi Firestore `guestbook` dan ditampilkan secara real-time, dengan batas 50 karakter untuk nama dan 500 karakter untuk pesan. Pengunjung hanya dapat membaca dan menambahkan pesan; UID admin tetap menjadi satu-satunya akun yang dapat mengubah atau menghapus entri melalui aturan Firestore.

## Pengembangan lokal

Perlu Python 3.12+ dan Node.js 22+:

```sh
npm ci
npm run build:js
python3 -m pip install -r requirements.txt
python3 scripts/build.py
python3 -m http.server 8000 --directory _site
```

Buka `http://localhost:8000`. Untuk login lokal, tambahkan `localhost` ke Authorized domains Firebase. Hasil build tersimpan di `_site/` dan `dist/` (keduanya tidak perlu di-commit).

## Publikasi

Workflow `.github/workflows/pages.yml` membangun situs dan menerbitkan `_site` ke GitHub Pages pada setiap push ke `main`. Domain `garanggati.web.id` dan sitemap halaman publik serta artikel Markdown (`/sitemap.xml`) sudah dikonfigurasi.
