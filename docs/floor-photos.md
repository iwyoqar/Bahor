# Bahor — qavatlarning fotoreal suratlari

Qavat tanlanganda 3D kesim o'rniga shu qavatning fotoreal surati ochiladi (`assets/floors/floor-N.jpg`, 4096×4096). Surat ustiga xonadonlarning yoritilishi va raqamlari 3D'dan chiziladi, shuning uchun surat 3D kadr bilan aniq ustma-ust tushishi shart.

Saytda: tortish (barmoq bilan surish) — surat bo'ylab yurish, g'ildirak yoki ikki barmoq — yaqinlashtirish, klaviatura ← → ↑ ↓ — surish. Xonadon bosilganda avvalgidek 3D model ochiladi, yopilganda yana surat chiqadi.

## Kamera

`js/config.js` → `floorPhoto`: `cam` (yo'nalish), `dist`, `fov` — hamma qavatlar uchun bitta kamera, kvadrat kadr. `bbox` — bino suratning qaysi qismida (birinchi ko'rinish shuni ekranga sig'diradi). Kamera o'zgarsa, hamma suratlar qayta yaratiladi.

## Qayta yaratish

1. **3D kadr.** Sayt ishlab turganda brauzerda `http://localhost:5173/?capture=1` ni oching va konsolda:

   ```js
   for (const fl of [1,2,3,4,5,6,7,8,9]) {
     __bahor.floorShot(fl, 2048, 1); await new Promise(r => setTimeout(r, 1200));
     const blob = await (await fetch(__bahor.floorShot(fl, 2048, 1, 'image/jpeg', 0.95))).blob();
     await fetch(`/__capture?file=floors/ref/floor-${fl}.jpg`, { method: 'POST', body: blob });
   }
   ```

   Natija: `captures/floors/ref/floor-N.jpg`.

2. **Fotoreal surat** — Nano Banana (2.1 yoki Pro), 1:1, 4K. Referenslar: 1 — `floor-N.jpg` (3D), 2 — `assets/hero/hero-desktop.jpg` (uslub). Har qavatdan 2–3 variant oling.

   ```
   The first image is a 3D render of a residential building seen from a drone high above, with the roof
   and all floors above the Nth floor cut away, so the apartments of one floor are visible from above like
   a dollhouse: walls, doors, furniture, rugs, kitchens and bathrooms. The second image is the finished
   photograph of the same building from the street (only for materials, colours and mood).

   Turn the first image into a real, photorealistic aerial photograph of this cut-away floor. The output
   must have exactly the same framing as the first image: same camera height, same zoom, the building at
   the same size and in the same place in the frame, the same streets running along the same edges of the
   frame. Keep every wall, room, door opening, piece of furniture, rug, bed, sofa, table and kitchen in
   the same place and the same size; the courtyard with the pergola and the two playgrounds; the parked
   cars, trees and the neighbouring blocks at the top of the frame. Nothing added, nothing removed,
   nothing moved, no zoom in. Change only materials, light and realism.

   Interiors: warm oak parquet, white plaster walls with visible wall thickness, real furniture with
   fabric and wood textures, patterned rugs, white kitchens and bathrooms with tiles, small plants, soft
   daylight with gentle shadows. Exterior: ivory-white stucco facade with cornices like the second image,
   real trees, real cars, asphalt with road markings, green lawns. Bright soft daylight, everything
   sharp, natural colours.

   Avoid: cropping or zooming in, changing the floor plan, merging or adding rooms, extra floors, new
   buildings, people, text, numbers, logos, watermark, CGI or toy look, tilt-shift blur.
   ```

   8 va 9-qavatlarda chapdagi past qism tomi qoladi — promptga qo'shing: "the plain grey block on the left is the roof of the lower part of the building and stays a roof".

3. **Tekshirish.** AI ba'zan kadrni biroz yaqinlashtiradi yoki suradi — bunday surat yaroqsiz (raqamlar xonalardan siljiydi). Variantni 3D kadr ustiga qo'yib ko'ring: ko'chalar, bino burchaklari va devorlar ustma-ust tushishi kerak. Avtomatik tekshirish (OpenCV): har variant uchun 3D kadrga nisbatan masshtab ~1.000 va siljish ~0 bo'lishi kerak.

4. **Saytga.** Tanlangan suratni `assets/floors/floor-N.jpg` qilib saqlang (JPEG, sifat ~85, 4096 px) va `floorPhoto.floors` ro'yxatiga qavat raqamini qo'shing. Ro'yxatda yo'q qavat avvalgidek 3D bo'lib ochiladi.
