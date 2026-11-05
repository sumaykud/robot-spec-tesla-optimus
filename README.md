# robot-spec-tesla-optimus
Belajar spec robot, ini tidak akurat tapi bisa membantu memahami Robot

Halaman edukasi interaktif tentang anatomi robot humanoid, dengan Tesla Optimus sebagai studi kasus: dari kepala sampai telapak kaki, cara kerja motor di tiap sendi, elektronik, chip, OS, dan constraint industri (status November 2026).

> Materi edukasi tidak resmi. Tidak berafiliasi dengan Tesla. Setiap angka di halaman diberi label tingkat kepastian.

## Isi halaman

| Tab | Isi |
| --- | --- |
| **Anatomi 3D** | Model 3D dengan cangkang x-ray dan komponen internal prosedural: aktuator rotari dan linear, tangan, baterai, komputer, sensor, jalur daya 52 V dan data. 13 komponen dari kepala sampai telapak, masing-masing dengan animasi cara kerja, spesifikasi, dan constraint industri. Simulasi daya per aktivitas dan rantai kendali kamera → sensor. |
| **Motor & sendi** | Lab interaktif strain wave gear, planetary roller screw, worm gear + tendon jari. Tabel enam desain aktuator (AI Day 2022), peta aktuator per sendi, penjelasan Field-Oriented Control. |
| **Elektronik** | Diagram distribusi daya dan data, spesifikasi daya, anggaran daya per aktivitas, inventaris sensor. |
| **Chip** | Denah blok chip FSD (HW3), kalkulator TOPS, perbandingan AI4 / AI5 / NVIDIA Jetson Thor, MCU di sendi. |
| **OS & software** | Tumpukan software dan laju loop kendali, cara Optimus belajar, pembanding Figure / Unitree / NVIDIA. |
| **Constraint industri** | Garis waktu 2021–2026, delapan constraint utama, koreksi untuk infografis yang beredar, daftar sumber. |

Bagian bisa dibuka langsung lewat hash: `#aktuator`, `#elektronik`, `#chip`, `#os`, `#industri`, atau nama komponen seperti `#lutut`, `#tangan`, `#baterai`.

### Label kepastian

- **Resmi**: dari materi Tesla (AI Day 2021/2022, video Gen 2) atau pabrikan lain.
- **Laporan**: paten, pernyataan publik, analisis rantai pasok atau media.
- **Inferensi**: praktik umum industri humanoid, tidak dikonfirmasi untuk Optimus.

Tesla tidak pernah merilis nama atau spesifikasi OS Optimus. Tab OS memisahkan yang dipastikan dari yang diduga.

## Menjalankan secara lokal

Halaman memuat file lewat `fetch()`, jadi harus dibuka dari server HTTP, bukan `file://`.

```bash
python3 -m http.server 8000
```

Lalu buka `http://localhost:8000`. three.js dan font dimuat dari CDN (jsDelivr, Google Fonts), jadi perlu koneksi internet.

Bisa juga langsung di-deploy sebagai situs statis (GitHub Pages, Vercel, Netlify) dari root repo.

## Struktur

```
index.html            halaman hasil build (jangan diedit langsung)
tesla_bot_geo.txt     geometri model (GLB tanpa tekstur, base64)
tesla_tex0..2.png     tekstur model (warna, metal/roughness/occlusion, normal)
model/tesla_bot.glb   model 3D asli
src/                  sumber halaman, dipotong per bagian
  p1_head.html        <title>, font, seluruh CSS
  p2_anat.html        markup tab Anatomi 3D
  p3_docs1.html       tab Motor & sendi, Elektronik
  p3_docs2.html       tab Chip, OS, Constraint industri
  p4_data.js          konten: komponen, aktivitas, rantai kendali, constraint
  p5_three.js         scene 3D, komponen internal prosedural, kamera, label
  p6_viz.js           visualisasi canvas (gear, roller screw, jari, gait, dll.)
  p7_ui.js            UI, simulasi daya, tab dan routing, lab aktuator
  build.sh            gabungkan src/ menjadi index.html
tools/split_glb.py    pecah model/tesla_bot.glb menjadi geometri base64 + PNG
```

Setelah mengubah file di `src/`:

```bash
./src/build.sh
```

`FRAGMENT=1 ./src/build.sh` juga menulis `dist/artifact.html` (tanpa `<html>`/`<head>`) untuk dipublikasikan sebagai Claude Artifact.

Kalau model 3D diganti:

```bash
python3 tools/split_glb.py
```

Geometri dipisah dari tekstur karena Claude Artifact tidak menyajikan file `.glb`. Di browser, teks base64 di-decode lalu dibaca dengan `GLTFLoader.parse`.

## Catatan akurasi

- Bentuk model mengikuti konsep Tesla Bot 2021 dan diskalakan ke 173 cm. Posisi komponen internal adalah ilustrasi, bukan hasil bongkaran.
- Pembagian aktuator per sendi (14 rotari + 14 linear) berasal dari analisis rantai pasok; kelas torsi per sendi adalah inferensi.
- Angka daya 100 W (duduk) dan 500 W (jalan cepat) resmi dari Tesla; daya aktivitas lain adalah estimasi.
- Status Optimus V3 per Oktober 2026 berasal dari pelacak pihak ketiga, bukan pengumuman Tesla.

## Kredit dan lisensi

- Kode halaman: Apache License 2.0 (lihat `LICENSE`).
- Model 3D: [“Tesla Bot”](https://sketchfab.com/3d-models/tesla-bot-7664b167d89c4e1aa6ea101b11fc8118) oleh [amalmurali347](https://sketchfab.com/amalmurali347), lisensi [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Berlaku untuk `model/tesla_bot.glb`, `tesla_bot_geo.txt`, dan `tesla_tex*.png` (diskalakan dan dipecah, tanpa perubahan bentuk).
- Pustaka: [three.js](https://threejs.org) r170 (MIT), font Barlow, Barlow Condensed, IBM Plex Mono (SIL OFL) dari Google Fonts.
- “Tesla” dan “Optimus” adalah merek dagang Tesla, Inc. Proyek ini tidak berafiliasi dengan Tesla.
