![Cover Robot](Cover%20Robot.png)

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
model/tesla_bot.glb   model 3D asli (tanpa rig)
model/tesla_bot_rigged.blend / .glb  model ber-rig + animasi lima aktivitas
actuator_rotary_geo.txt  model aktuator rotari (GLB Draco, base64)
model/actuator_rotary.blend / .glb  sumber Blender + ekspor aktuator rotari
actuator_linear_geo.txt  model aktuator linear roller screw (GLB Draco, base64)
model/actuator_linear.blend / .glb  sumber Blender + ekspor aktuator linear
actuator_finger_geo.txt  model aktuator jari worm + tendon (GLB Draco, base64)
model/actuator_finger.blend / .glb  sumber Blender + ekspor aktuator jari
src/                  sumber halaman, dipotong per bagian
  p1_head.html        <title>, font, seluruh CSS
  p2_anat.html        markup tab Anatomi 3D
  p3_docs1.html       tab Motor & sendi, Elektronik
  p3_docs2.html       tab Chip, OS, Constraint industri
  p4_data.js          konten: komponen, aktivitas, rantai kendali, constraint
  p5_three.js         scene 3D, komponen internal prosedural, kamera, label
  p55_rig.js          animasi aktivitas; komponen internal, kabel, label ikut tulang
  p6_viz.js           visualisasi canvas (gear, roller screw, jari, gait, dll.)
  p65_lab3d.js        lab aktuator 3D (rotari, linear, jari): rakit / urai / potong, label, keterangan rumus
  p7_ui.js            UI, simulasi daya, tab dan routing, lab aktuator
  build.sh            gabungkan src/ menjadi index.html
tools/rig_tesla_bot.py   rig model Tesla Bot + animasi duduk, berdiri, jalan, angkat, pegang telur
tools/split_glb.py    pecah model ber-rig menjadi geometri base64 + PNG
tools/act_common.py   fungsi Blender bersama (cincin, lathe, stator, lubang baut, ekspor)
tools/build_actuator.py  bangun model aktuator rotari di Blender
tools/build_linear.py    bangun model aktuator linear (planetary roller screw) di Blender
tools/build_finger.py    bangun model aktuator jari (motor mini + worm + tendon) di Blender
```

Setelah mengubah file di `src/`:

```bash
./src/build.sh
```

`FRAGMENT=1 ./src/build.sh` juga menulis `dist/artifact.html` (tanpa `<html>`/`<head>`) untuk dipublikasikan sebagai Claude Artifact.

Kalau model 3D atau animasi aktivitas diubah:

```bash
blender --background --factory-startup --python tools/rig_tesla_bot.py
python3 tools/split_glb.py
```

Tulang diletakkan di sendi yang sama dengan komponen internal (`J` di `src/p5_three.js`); kalau `J` diubah, samakan juga di `tools/rig_tesla_bot.py` dan `src/p55_rig.js`. Nama klip animasi sama dengan id aktivitas di `src/p4_data.js`.

Model aktuator rotari (motor PMSM frameless + strain wave gear), linear (motor PMSM + planetary roller screw), dan jari (motor mini + worm + tendon) dibangun dengan skrip Blender. Setelah mengubah skrip:

```bash
blender --background --factory-startup --python tools/build_actuator.py
blender --background --factory-startup --python tools/build_linear.py
blender --background --factory-startup --python tools/build_finger.py
```

Tiap skrip menulis `model/actuator_<jenis>.blend`, `model/actuator_<jenis>.glb`, dan `actuator_<jenis>_geo.txt`. Nama objek (`wave_generator`, `flexspline`, `nut`, `roller_set`, `screw`, `phalanx_1`, `tendon_0`, dll.) dipakai halaman untuk animasi, jadi jangan diganti. Gigi diperkecil (flexspline 60, circular spline 62) agar terbaca.

Geometri dipisah dari tekstur karena Claude Artifact tidak menyajikan file `.glb`. Di browser, teks base64 di-decode lalu dibaca dengan `GLTFLoader.parse`.

## Catatan akurasi

- Bentuk model mengikuti konsep Tesla Bot 2021 dan diskalakan ke 173 cm. Posisi komponen internal adalah ilustrasi, bukan hasil bongkaran.
- Pembagian aktuator per sendi (14 rotari + 14 linear) berasal dari analisis rantai pasok; kelas torsi per sendi adalah inferensi.
- Angka daya 100 W (duduk) dan 500 W (jalan cepat) resmi dari Tesla; daya aktivitas lain adalah estimasi.
- Status Optimus V3 per Oktober 2026 berasal dari pelacak pihak ketiga, bukan pengumuman Tesla.

## Kredit dan lisensi

- Kode halaman: Apache License 2.0 (lihat `LICENSE`).
- Model 3D: [“Tesla Bot”](https://sketchfab.com/3d-models/tesla-bot-7664b167d89c4e1aa6ea101b11fc8118) oleh [amalmurali347](https://sketchfab.com/amalmurali347), lisensi [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Berlaku untuk `model/tesla_bot.glb`, `tesla_bot_geo.txt`, dan `tesla_tex*.png` (diskalakan, dipecah, dan diberi rig + animasi aktivitas; bentuk mesh tidak diubah).
- Model aktuator rotari, linear, dan jari (`model/actuator_*`, `actuator_*_geo.txt`): dibuat untuk proyek ini dengan `tools/build_actuator.py`, `tools/build_linear.py`, dan `tools/build_finger.py`, ilustrasi umum, bukan desain Tesla.
- Pustaka: [three.js](https://threejs.org) r170 (MIT), font Barlow, Barlow Condensed, IBM Plex Mono (SIL OFL) dari Google Fonts.
- “Tesla” dan “Optimus” adalah merek dagang Tesla, Inc. Proyek ini tidak berafiliasi dengan Tesla.
