# Ruang

Blog publik berbahasa Indonesia untuk filsafat, bahasa, teknologi, dan belajar. Situs dibangun sebagai file statis dan diterbitkan ke GitHub Pages; panel admin menggunakan Firebase Authentication dan Cloud Firestore.

## Setup Firebase gratis

Firebase Web config yang dipakai situs bukan password atau service-account key. Izin baca/tulis tetap harus dibatasi oleh Firestore Security Rules.

1. Buat project di [Firebase Console](https://console.firebase.google.com/) dan pilih paket **Spark (no-cost)**. Google Analytics tidak dibutuhkan untuk blog ini.
2. Dari halaman Project Overview, tambahkan aplikasi **Web**. Salin nilai `apiKey`, `authDomain`, `projectId`, dan `appId` ke `firebase-config.js`, menggantikan nilai `REPLACE_WITH_...`.
3. Di **Authentication → Sign-in method**, aktifkan **Email/Password**.
4. Di **Authentication → Users**, pilih **Add user** untuk membuat akun admin. Setelah dibuat, UID ada di kolom **User UID**; bila tabel tidak menampilkannya, klik baris akun untuk membuka detail pengguna. Jangan menambahkan form pendaftaran publik.
5. Salin nilai **User UID** tersebut, lalu ganti teks `REPLACE_WITH_ADMIN_UID` di `firestore.rules` dengan UID itu. Pertahankan tanda kutipnya.
6. Di **Firestore Database**, buat database pada mode Production. Pilih lokasi yang paling dekat dengan pembaca; lokasi database tidak dapat diubah sesudah dibuat.
7. Buka tab **Rules**, tempel isi `firestore.rules`, lalu tekan **Publish**. Aturan mengizinkan publik membaca tulisan yang terbit dan hanya UID admin yang mengubah data.
8. Di **Authentication → Settings → Authorized domains**, tambahkan `garanggati.web.id`. Tambahkan `localhost` untuk pengujian lokal bila belum tercantum.
9. Commit perubahan `firebase-config.js` dan `firestore.rules` ke `main`. GitHub Actions akan membangun ulang situs.
10. Buka `https://garanggati.web.id/admin/`, masuk dengan akun admin, lalu pilih **Impor 5 tulisan awal** jika ingin memindahkan tulisan contoh ke Firestore.

Firebase Web config memang tampil di bundle publik; itu normal untuk aplikasi web. Jangan pernah mengunggah password admin, token, private key, atau service-account JSON. Proteksi penulisan berasal dari Firestore Rules, bukan dari menyembunyikan URL admin.

Paket Spark tidak memerlukan metode pembayaran untuk mulai. Kuota Firebase saat ini mencakup hingga 50.000 pengguna aktif bulanan untuk layanan Authentication non-SMS; Firestore menyediakan 1 GiB data tersimpan, 50.000 pembacaan/hari, 20.000 penulisan/hari, 20.000 penghapusan/hari, dan 10 GiB transfer keluar/bulan. Jika kuota Spark terlampaui, operasi dapat ditolak sampai kuota tersedia lagi. Lihat [harga Firebase](https://firebase.google.com/pricing) dan [kuota Firestore](https://firebase.google.com/docs/firestore/quotas).

## Menulis artikel

Buka `/admin/`, masuk, lalu buat atau edit tulisan. Slug menjadi alamat artikel dan tidak dapat diubah sesudah dibuat. Centang **Terbitkan tulisan** agar artikel terlihat di blog. Isi artikel mendukung Markdown.

Artikel awal dalam `content/posts/` dipakai untuk tampilan statis sebelum Firebase dikonfigurasi dan sebagai sumber impor pertama. Setelah tulisan diimpor, Firestore menjadi sumber utama untuk blog dan panel admin.

Karena GitHub Pages tidak menjalankan server, isi Firestore dimuat oleh browser. Halaman publik tetap bisa dibaca tanpa login, tetapi artikel dinamis tidak dipra-render saat build; SEO, sitemap artikel, feed RSS, dan pratinjau tautan sosial belum sekuat CMS yang menghasilkan halaman statis per artikel. Jangan simpan artikel rahasia di Firestore; pengunjung dapat membaca semua dokumen yang berstatus terbit.

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

Workflow `.github/workflows/pages.yml` membangun situs dan menerbitkan `_site` ke GitHub Pages pada setiap push ke `main`. Domain `garanggati.web.id` dan sitemap halaman utama (`/sitemap.xml`) sudah dikonfigurasi.
