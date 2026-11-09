# Bahor — Higgsfield bilan «haqiqiy render» va video tur

Omnya Lab «tower method» usuli Bahor uchun moslashtirilgan. Bizning ustunligimiz: binoning aniq 3D modeli bor. Shuning uchun:

- 1-referens sifatida oddiy foto emas, saytdagi aniq kamera burchagidan olingan surat beriladi;
- qavat konturlarini qo'lda chizish shart emas: ularni 3D modeldan avtomatik olaman va render ustiga moslayman.

## Kim nima qiladi

| Qadam | Qayerda | Kim |
|---|---|---|
| 1. Bino surati (hero) | Higgsfield → Nano Banana Pro, 16:9 | Siz (prompt tayyor) |
| 2. Yakuniy kadr — xonadon ichi | Higgsfield → Nano Banana Pro, 16:9 | Siz (prompt tayyor) |
| 3. Uchish videosi | Higgsfield → Seedance, boshlanish = 1, oxiri = 2 | Siz (prompt tayyor) |
| 4. Xonama-xona videolar | Higgsfield → Kling, har biri oldingisining oxirgi kadridan | Siz; oxirgi kadrlarni men kesib beraman |
| 5. Sayt: qavat tanlash, video pleyer, telefon | Kod | Men |

Xom suratlar (16:9 kompyuter, 9:16 telefon; kunduz, oltin soat, shom, tun) alohida yuboriladi. Ularni qayta olish: sayt ishlab turganda `?capture=1&t=1040&pr=2` (t — kun boshidan daqiqalar, 1040 = 17:20), oyna 1280×720 (telefon uchun 405×720).

---

## Higgsfield o'rniga Gemini ilovasi (Google AI Pro obunasi)

Nano Banana Pro Gemini ilovasida ham bor (gemini.google.com):
1. Model menyusidan **Thinking** (Pro) ni tanlang va **Rasm yaratish** (🍌) asbobini yoqing.
2. «+» orqali avval bino suratini, keyin uslub rasmini yuklang.
3. Promptdan oldin shu qatorni qo'shing: `Reference 1 is the first attached image, reference 2 is the second attached image. Output: 16:9 landscape, same framing as reference 1.`
4. Natijani eng yuqori sifatda yuklab oling. Qayta yaratish bilan 2–3 variant oling.

Videolar (3–4-qadamlar) uchun shu obunadagi Google Flow'da Veo bilan «birinchi va oxirgi kadr» rejimi Seedance o'rnini bosadi.

## 1-qadam. Bino surati — Nano Banana Pro, 16:9

**Referenslar:** 1 — `desktop-16x9_1-kunduz-1230.png` (bino va kamera; kunduzgi surat eng aniq ko'rinadi, yorug'likni prompt belgilaydi), 2 — `assets/gallery/render-1.jpg` (materiallar va uslub).
Asosiy kadr — shom (blue hour), qo'llanmadagidek. Keyin shu kadrdan boshqa vaqtlar yasaladi (pastda). Shom va tun suratlari (`_3-shom`, `_4-tun`) faqat qaysi derazalar yonganini ko'rsatish uchun kerak.

```
Use reference 1 for the building AND the camera: keep exactly this building and this exact
camera position, angle, framing and lens. It is a nine-storey neoclassical residential
complex, U-shaped in plan: ivory-white stucco facades with pilasters, cornices and moulded
window surrounds, tall windows with small French balconies and black wrought-iron railings,
a warm travertine ground floor with large shop windows, terracotta hip roofs on the rooftop
pavilions, solar panels on the flat roofs, the left wing one floor lower at the top.
Do not change the number of floors, the window rhythm, the setbacks or the outline: every
floor must stay exactly where it is in reference 1. Use reference 2 only for materials,
colours and level of detail, not for the shape or the camera.

Elevated three-quarter aerial view, 16:9, camera about 40 m high and 110 m away, looking
slightly down, framed exactly as reference 1. In front: a wide city avenue with crisp white
markings and a few modern cars, a parking strip, tree-lined paved sidewalks, neat lawns and
flower beds, classical black lamp posts. On the right: a side street. Behind and around:
softly hazed mid-rise residential blocks of Tashkent, low and unobtrusive, faint mountains
on the far horizon.

Light: blue hour, ten minutes after sunset. Sky gradient from deep cyan at the top to soft
peach at the horizon. Warm 2700K light on inside about a third of the apartments, scattered
randomly; ground-floor shop windows and the entrance warmly lit; street lamps on, soft warm
uplighting at the base of the facade.

Shot on DJI Inspire 3, 24mm, f/5.6, everything sharp, light atmospheric haze for depth,
natural contrast, true colours, real luxury developer launch photography.

Avoid: changing the building design, the number of floors or the camera angle, eye-level
view, people in the foreground, text, logos, watermark, lens flare, HDR, oversaturation,
CGI look.
```

**Boshqa vaqtlar** (kun vaqtiga qarab saytda almashadi). Referens 1 — tanlangan shom renderi, referens 2 — shu vaqtdagi xom surat:

```
Reference 1 is the final photo. Keep it completely identical: same camera, same building,
same cars, trees, neighbouring buildings, materials and colours. Change only the time of
day and the light to: {LIGHT}. Use reference 2 only to see the sun direction, which windows
are lit and where the lamps are. Real developer launch photography, no text, no CGI look.
```

| Fayl | `{LIGHT}` |
|---|---|
| kunduz 12:30 | bright clear autumn midday, crisp sunlight from the south, deep blue sky with a few light clouds, crisp shadows, no interior lights |
| oltin soat 16:15 | golden hour shortly before sunset, warm orange sunlight grazing the facade, long shadows across the avenue, warm glowing sky |
| tun 21:00 | night, deep navy sky, warm 2700K light in about half of the windows, warm uplighting at the base of the facade, glowing street lamps with light pools on the sidewalks, car light trails on the avenue |

Telefon uchun xuddi shu promptlar 9:16 da, referens 1 — `mobile-9x16_…png`.

## 2-qadam. Yakuniy kadr — xonadon ichi, Nano Banana Pro, 16:9

Misol: 6-qavat, old fasaddagi 2 xonali xonadonning mehmonxonasi. **Referenslar:** 1 — 1-qadamdagi tayyor shom renderi, 2 — divan rasmi, 3 — qandil, 4 — tosh/marmar namunasi (o'zingiz tanlaysiz). Qo'llanmada bu kadr 3 urinishda chiqqan, 2–3 variant yaratishga tayyor turing.

```
Interior architectural photograph, 16:9. The living room of an apartment on the 6th floor
of the building in reference 1, seen at 45 degrees from the French balcony through the tall
open glass door with slim graphite frames; the black wrought-iron railing and the edge of
the white moulded window surround are visible at the frame edges. About 24 m²: warm oak
parquet, a large hand-knotted Uzbek carpet with a deep red and navy medallion pattern, the
sofa from reference 2, the chandelier from reference 3, warm white walls with thin classical
mouldings, a TV wall in the stone from reference 4, a dining table for six by the window,
an open door at the back to a softly lit hallway. Same light as reference 1: blue hour
outside, warm 2700K light inside, the city lights reflected in the glass.

Shot on Sony A7R V, 24mm, f/8, everything sharp, real estate photography, natural contrast,
true colours.

Avoid: people, text, logos, fisheye distortion, oversaturation, CGI look.
```

## 3-qadam. Uchish — Seedance

Boshlanish kadri — 1-qadamdagi shom renderi, oxirgi kadr — 2-qadamdagi ichki kadr. Avval 480p qoralama, yoqsa 1080p.

```
One single continuous drone shot, no cuts, no dissolves. The first second holds the first
frame exactly, then the camera starts moving slowly: the white neoclassical residential
building at blue hour. The camera flies forward and slightly downward towards the building,
smoothly accelerating, heading for one tall lit window on the 6th floor of the front facade,
slightly right of the middle. As it approaches, the cornices, pilasters and window surrounds
grow larger and the warm lit windows of that floor fill the frame. The camera slows down,
passes over the black wrought-iron railing of the French balcony and comes to rest in front
of the open glass door, looking into the warmly lit living room, matching the last frame
exactly.

The camera physically flies through the space; the facade, cornices and glass stay solid and
in place for the whole shot; the transition is a real camera movement, not a dissolve.
Steady gimbal movement, constant forward motion, no rotation, no shaking. The building and
the room stay exactly the same as in the two frames. Blue hour light constant throughout,
warm interior lights.
```

## 4-qadam. Xonama-xona — Kling

Har bir video oldingisining **oxirgi kadri**dan boshlanadi: uchish → mehmonxona → oshxona → yotoqxona → hammom. Oxirgi kadrni videoning oxiridan oling yoki videoni menga yuboring, men aniq kadrni kesib beraman. Shu tarzda butun sayohat bitta kadrdek ko'rinadi.

```
Continue exactly from this frame. One continuous steady gimbal shot, no cuts: the camera
walks slowly through the {ROOM_FROM} towards the open door and into the {ROOM_TO}, turning
gently to reveal it, and comes to rest on a calm, well composed view of the {ROOM_TO}.
All furniture, materials and light stay exactly as in the frame. Warm 2700K interior light,
blue hour outside the windows. No people, no text, no shaking.
```

## 5-qadam. Sayt (mening ishim)

Videolar va renderlar tayyor bo'lgach:

- Bosh ekran: renderlar fon bo'ladi va kun vaqtiga qarab almashadi.
- Qavat konturlari 3D modeldan olinadi va renderga avtomatik moslanadi. Qavat ustiga kelganda yoritiladi, panelda narxlar chiqadi (hozirgi panel).
- Qavat tanlanganda uchish videosi o'ynaydi, keyin xonadon turi va xonalar tugmalari chiqadi.
- «Orqaga» uchun uchish videosining teskarisini o'zim tayyorlayman.
- Hozirgi interaktiv 3D reja (mebel, xonalar maydoni, narx kalkulyatori) «Qavat rejasi» sifatida saqlanadi.
- Telefon uchun 9:16 renderlar ishlatiladi; videolar markazdan qirqiladi yoki alohida 9:16 versiyasi beriladi.

Fayllarni menga quyidagicha nomlab yuboring:
`hero_kunduz.png`, `hero_oltin.png`, `hero_shom.png`, `hero_tun.png` (+ `_mobile` varianti),
`interior_living.png`, `flight.mp4`, `room_1_living.mp4`, `room_2_kitchen.mp4`, …
