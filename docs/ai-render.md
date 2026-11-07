# Bahor — Higgsfield (Nano Banana) bilan fotorealistik render

Maqsad: saytning asosiy ko'rinishi (bitta qotirilgan burchak) haqiqiy arxitektura renderidek ko'rinsin, lekin qavatlarni tanlash, yoritish va narxlar avvalgidek ishlasin.

Qanday ishlaydi:
1. Saytdan aynan o'sha burchakdan, interfeyssiz «xom» suratlar olinadi (`?capture=1`). Bu suratlar `docs/` yonida emas, alohida yuboriladi.
2. Higgsfield'da Nano Banana har bir suratni fotorealistik renderga aylantiradi. Kompozitsiya va bino geometriyasi o'zgarmasligi shart.
3. Tayyor renderlar saytga fon sifatida qo'yiladi. Qavat yoritilishi va bosish nuqtalari o'sha kameradagi 3D modeldan olinadi, shuning uchun render ustiga aniq tushadi. Kunning vaqtiga qarab renderlar almashadi.
4. Qavat ichki ko'rinishi (mebel bilan) real vaqtli 3D bo'lib qoladi.

## Fayllar

| Fayl | Nima uchun | Nano Banana nisbati |
|---|---|---|
| `desktop-21x9_1-tong-0810.png` … `_5-tun-2100.png` | Kompyuter ekrani | 21:9 |
| `mobile-9x16_1-tong-0810.png` … `_5-tun-2100.png` | Telefon | 9:16 |
| `assets/gallery/render-1.jpg`, `render-2.jpg` | Uslub namunasi (developer renderlari) | — |

## Higgsfield'da qadamlar

1. Higgsfield → **Image** → model: **Nano Banana Pro** (bo'lmasa, Nano Banana).
2. Rasm yuklash: **1-rasm** — bizning surat (masalan `desktop-21x9_2-kunduz-1230.png`), **2-rasm** — `render-1.jpg` (uslub uchun).
3. Nisbat: kompyuter suratlari uchun **21:9**, telefon suratlari uchun **9:16**. Sifat: eng yuqori (2K/4K).
4. Quyidagi asosiy promptni qo'ying va `{LIGHTING}` o'rniga shu vaqtga mos qatorni yozing.
5. 2–4 variant yarating. Asl surat bilan solishtirib (ustma-ust 50% shaffoflikda), bino konturi va qavatlari eng aniq mos kelganini tanlang.
6. **Avval kunduzgi renderni** tayyorlang. Qolgan vaqtlar uchun 1-rasm sifatida o'sha tanlangan kunduzgi renderni, 2-rasm sifatida shu vaqtdagi bizning suratni bering va «faqat kun vaqtini o'zgartir» promptidan foydalaning. Shunda mashinalar, daraxtlar va qo'shni binolar barcha vaqtlarda bir xil bo'ladi.
7. Natijalarni asl fayl nomlari bilan saqlab, menga yuboring (yoki `assets/renders/` papkasiga qo'ying).

## Asosiy prompt (ingliz tilida — model shuni yaxshi tushunadi)

```
Turn image 1 into a photorealistic architectural visualization render, as if photographed
with a full-frame camera. Keep EXACTLY the same camera position, angle, framing, perspective
and aspect ratio as image 1. Do not move, add, remove or resize any part of the building:
every floor, window, balcony, cornice, roof, setback and the building outline must stay in
the same position. Materials: ivory-white stucco facade with fine classical moldings,
cornices and pilasters; warm beige travertine stone on the ground floor; dark tinted glass
with slim graphite frames; black wrought-iron balcony railings; terracotta tile hip roofs;
solar panels on the flat roofs. Use image 2 only as a reference for architectural style,
colors and landscaping quality, not for composition. Surroundings: clean asphalt roads
with crisp white markings, parked modern cars, paved sidewalks, lush trees and neat
landscaping, classical black street lamps, a courtyard with a gazebo and a playground.
Replace the plain grey neighbouring boxes with realistic but unobtrusive mid-rise
residential buildings typical of Tashkent. Lighting: {LIGHTING}.
Physically based materials, realistic soft shadows and ambient occlusion, subtle
atmospheric perspective, sharp details, high-end architectural render quality.
No text, no logos, no watermark.
```

### `{LIGHTING}` — kun vaqtlari

| Fayl | Yozing |
|---|---|
| `1-tong-0810` | early morning in late autumn, low warm sun from the east, long soft shadows, light morning haze, clear pale blue sky |
| `2-kunduz-1230` | bright clear midday in autumn, crisp sunlight, deep blue sky with a few light clouds, crisp shadows |
| `3-oltin-soat-1615` | golden hour shortly before sunset, warm orange sunlight grazing the facade, long shadows, warm glowing sky |
| `4-shom-1720` | blue hour just after sunset, deep blue-violet sky with an orange glow on the horizon, warm 3000K light in the windows that are lit in image 1, street lamps on, car headlights |
| `5-tun-2100` | night, dark blue starry sky, warm interior light only in the windows that are lit in image 1, warm uplighting at the base of the facade, glowing street lamps with light pools on the sidewalks, car light trails on the road |

### Boshqa vaqtlar uchun prompt (kunduzgi render tayyor bo'lgach)

```
Image 1 is the final daytime render. Keep image 1 completely identical — same camera,
same building, same cars, trees, neighbouring buildings, colors and materials — and change
only the time of day and lighting to: {LIGHTING}. Use image 2 only to see which windows
are lit and where the street lamps are. Photorealistic architectural render, no text.
```

## Muhim

- Geometriya qanchalik aniq saqlansa, qavat yoritilishi renderga shunchalik aniq tushadi. Kichik siljishlarni men saytga qo'yishda avtomatik to'g'rilayman (asl surat bilan solishtirib).
- Kamera burchagi saytda o'zgarmasligi kerak: burchak o'zgarsa, suratlarni qayta olish va renderlarni qayta yaratish kerak bo'ladi.
- Suratlarni qayta olish: sayt ishlab turganda `http://localhost:5173/?capture=1&t=750&pr=2` (t — daqiqada vaqt, masalan 750 = 12:30), oyna o'lchami kompyuter uchun 1680×720, telefon uchun 405×720.
