# garanggati
Garanggati — personal knowledge app for philosophy, language, AI, and learning notes.

## Menjalankan aplikasi

Aplikasi ini adalah SPA statis tanpa proses build atau dependency tambahan. Jalankan server HTTP lokal dari root repository:

```sh
python3 -m http.server 8000
```

Buka `http://localhost:8000`. Service worker dan fitur instalasi PWA memerlukan HTTPS atau `localhost`; membuka `index.html` langsung tidak mengaktifkan fitur tersebut.

Catatan disimpan di `localStorage` browser dan dapat dibaca saat offline setelah app shell pertama kali dimuat. Data tidak disinkronkan ke server dan hanya tersedia di browser/perangkat yang menyimpannya.

## Hosting

Workflow GitHub Pages disiapkan untuk menerbitkan situs setiap ada push ke branch `main`. Domain kustomnya `garanggati.web.id`; record DNS perlu diarahkan ke GitHub Pages di panel registrar sebelum HTTPS aktif. Untuk domain apex, tambahkan record A berikut:

```text
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

GitHub Pages akan menerbitkan sertifikat HTTPS setelah DNS terverifikasi dan propagasi selesai. Status deploy dan verifikasi domain dapat dilihat di Settings → Pages pada repository.
