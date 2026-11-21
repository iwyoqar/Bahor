# Bahor — bino atrofida fotoreal 360° aylanish

Bosh ko'rinishda binoni sichqoncha bilan tortib aylantirish. Ekranda real vaqtdagi 3D emas, oldindan tayyorlangan fotoreal kadrlar ketma-ketligi ko'rinadi; 3D model faqat kamera yo'lini beradi va qavat yoritilishini kadr ustiga chizadi.

Aylanish 8 ta bo'lakka bo'lingan, har biri 45°. 0° — hozirgi bosh ko'rinish (hero surati), shuning uchun u qayta yaratilmaydi.

## Kim nima qiladi

| Qadam | Qayerda | Kim |
|---|---|---|
| 1. 3D kadrlar va referens kliplar | Sayt + `tools/orbit.mjs` | Tayyor: `captures/orbit/` |
| 2. 7 ta fotoreal surat (45°, 90° … 315°) | Nano Banana Pro, 16:9 | Siz (prompt pastda) |
| 3. 8 ta fotoreal klip | Kling (video edit) yoki Veo (birinchi va oxirgi kadr) | Siz (prompt pastda) |
| 4. Kliplarni saytga ulash | `node tools/orbit.mjs frames` | Bitta buyruq |

## 1-qadam. 3D fayllar (tayyor)

`captures/orbit/` ichida (git'ga kirmaydi):

- `keys/key-0.png … key-7.png` — 8 ta burchakdan 3D surat, 2560×1440. `key-N` = N × 45°.
- `clips/seg-1.mp4 … seg-8.mp4` — 3D aylanish kliplari, 1920×1080, 4 soniya. `seg-N` kamera `key-(N-1)` dan `key-N` ga boradi; `seg-8` yana `key-0` ga qaytadi.

Bino yoki kamera o'zgarsa, qayta olish: sayt ishlab turganda brauzerda `http://localhost:5173/?capture=1&orbit=rec` ni oching (2–3 daqiqa, oynani yopmang), so'ng:

```
node tools/orbit.mjs refs
```

## 2-qadam. 7 ta surat — Nano Banana Pro, 16:9

Har bir `key-1 … key-7` uchun bittadan surat. **Referenslar:** 1 — `captures/orbit/keys/key-N.png` (bino va kamera), 2 — `assets/hero/hero-desktop.jpg` (tayyor bosh surat: materiallar, yorug'lik, atrof uslubi).

```
Reference 1 is a 3D render of a building seen from a new side. Reference 2 is the finished
photograph of the same building from another side. Turn reference 1 into a real aerial
photograph that belongs to the same shoot as reference 2.

Keep the composition, the camera position, the horizon line and every building exactly as
in reference 1: same positions, same proportions, same silhouettes, same number of floors
and windows, same roofs and setbacks, same streets, same neighbouring blocks, nothing added
and nothing removed. Change only surfaces, light and realism.

Take from reference 2 only the look: ivory-white stucco facades with pilasters, cornices
and moulded window surrounds, black wrought-iron French balconies, warm travertine ground
floor, terracotta hip roofs, solar panels on the flat roofs; the same blue-hour light, the
same sky, the same warm 2700K windows and facade uplighting, the same trees, cars, paving
and hazy mid-rise Tashkent blocks around.

Elevated three-quarter aerial view, 16:9, shot on DJI Inspire 3, 24mm, f/5.6, everything
sharp, light atmospheric haze, natural contrast, real developer launch photography.

Avoid: changing the building design, the number of floors or the camera angle, new
buildings, people in the foreground, text, logos, watermark, lens flare, HDR, CGI look.
```

Natijalarni `captures/orbit/photos/photo-1.jpg … photo-7.jpg` deb saqlang (raqam `key` raqami bilan bir xil). `photo-0` kerak emas: u hero surati.

Tekshirish: suratni `key-N.png` ustiga qo'yib ko'ring. Tom chizig'i, burchaklar va qavatlar ustma-ust tushishi kerak, aks holda qavat yoritilishi siljib qoladi. Hovli tomonidagi suratlarda (`key-3`, `key-4`, `key-5`) o'yin maydonchasi va ayvon joyida qolganini ham tekshiring.

## 3-qadam. 8 ta klip

`seg-N` uchun: boshlang'ich kadr — `photo-(N-1)`, oxirgi kadr — `photo-N`. `seg-1` hero suratidan boshlanadi, `seg-8` hero surati bilan tugaydi.

| Klip | Boshlang'ich kadr | Oxirgi kadr | 3D klip |
|---|---|---|---|
| seg-1 | `assets/hero/hero-desktop.jpg` | photo-1 | clips/seg-1.mp4 |
| seg-2 … seg-7 | photo-(N-1) | photo-N | clips/seg-N.mp4 |
| seg-8 | photo-7 | `assets/hero/hero-desktop.jpg` | clips/seg-8.mp4 |

**A variant — Kling, video edit** (3D klip harakatni beradi, eng aniq yo'l). Fayllar: @Video1 — 3D klip, @Image1 — boshlang'ich kadr, @Image2 — oxirgi kadr, @Image3 — hero surati (faqat uslub uchun).

```
Edit @Video1 into a real aerial drone shot at blue hour. Follow the camera movement of
@Video1 exactly, same path and same speed: one continuous smooth orbit to the right around
the building at constant height, no extra rotation, no zoom, no cuts. The first frame is
@Image1 (start frame). The last frame is @Image2 (end frame): the camera has moved 45
degrees around the same building. @Image3 is only a style reference for how the building
looks: use it to keep the look, never as a frame. Keep the building, the number of floors,
the streets, the neighbouring blocks, the lights and the colours exactly as in the images.
Parked cars stay parked, realistic motion, no new buildings, no people appearing, no text,
no warping, no flicker.
```

**B variant — Veo (Google Flow), birinchi va oxirgi kadr.** 3D klip berilmaydi, shuning uchun kamera yo'li biroz chetga chiqishi mumkin; aylanish baribir ishlaydi, chunki sayt to'xtash nuqtalarida aniq suratlarni ko'rsatadi.

```
Aerial drone shot at blue hour: the camera orbits smoothly to the right around the white
neoclassical nine-storey residential building at constant height and constant speed, from
the first frame to the last frame, 45 degrees in total. One continuous move, no cuts, no
zoom. The building, the streets and the neighbouring blocks stay exactly as in the frames,
parked cars stay parked, no new buildings, no text, no warping.
```

Kliplarni `captures/orbit/kling/seg-1.mp4 … seg-8.mp4` deb saqlang (uzunligi va kadr tezligi farq qilsa ham bo'ladi).

## 4-qadam. Saytga ulash

```
node tools/orbit.mjs frames
```

Buyruq har bir klipdan 20 tadan kadr olib `assets/orbit/` ga yozadi (jami 160 ta, 1280×720 WebP) va `photos/` dagi suratlardan to'xtash nuqtalari uchun tiniq `still-N.jpg` yasaydi. Hamma klip tayyor bo'lmasa ham ishlatsa bo'ladi: yetishmayotgan bo'laklar o'zgarmay qoladi.

Sinash: `http://localhost:5173/?orbit=1`. Hammasi joyida bo'lsa, `js/config.js` da:

```js
orbit: { enabled: true, …, stills: true, … }
```

## Saytda qanday ishlaydi

- Bosh ko'rinishda, kompyuterda ham, telefonda ham. Tik ekranda (telefon) foto ekran kengligiga moslanadi, ustida va ostida shu kadrning xira nusxasi turadi.
- Tortish (telefonda barmoq bilan surish) — aylantirish; qo'yib yuborilganda eng yaqin to'xtash nuqtasiga (har 45°) o'tadi. Pastdagi ‹ 360° › tugmalari va klaviaturadagi ← → ham bitta nuqtaga suradi.
- Sahifa ochilganda faqat har 22.5° dagi 16 ta kadr yuklanadi (~1 MB). Qolganlari birinchi aylantirishda yuklanadi (kompyuterda 6 soniyadan keyin o'zi ham).
- Qavat yoritilishi va bosish faqat to'xtash nuqtalarida ishlaydi: u yerda kadr 3D bilan aniq ustma-ust tushadi. Aylanish paytida AI klip 3D yo'ldan biroz og'ishi mumkin.
- Qavat tanlansa, kamera shu tomondan 3D'ga o'tadi; orqaga qaytganda yana shu burchakdagi surat chiqadi.
- `orbit.stops: 0` — istalgan burchakda to'xtash (faqat kliplar 3D yo'lni aniq takrorlasa).
