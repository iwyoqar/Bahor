# Bahor — turar-joy majmuasi (Prestige Light House)

Bahor turar-joy majmuasi uchun interaktiv 3D sayt.

- **3D bino.** Rejalardan olingan aniq kontur bo'yicha qurilgan neoklassik fasad: chuqur derazalar, karnizlar, pilyastrlar, fransuz balkonlari, qizil chatirli tomlar, quyosh panellari. 8- va 9-qavatlardagi pog'onali qisqarishlar ham rejadagidek.
- **Qavat tanlash.** Sichqoncha qavat ustiga olib borilganda qavat oltin rangda yoritiladi va narxlari ko'rsatiladi. Bosilganda yuqori qavatlar olinadi va shu qavatning ichki bo'linishi ko'rinadi: rejadagi devorlar va har bir xonadonning maydoni.
- **Jihozlangan xonalar.** Har bir qavatdagi har bir xona turiga qarab jihozlangan: mehmonxonada divan, kreslo, televizor, gilam va mehmon stoli; yotoqxonada karavot, tumbochka va chiroq, shkaf; oshxonada muzlatkich, plita, rakovina va ovqat stoli; hammomda vanna yoki dush, unitaz, rakovina, kir yuvish mashinasi; dahlizda poyabzal javoni; balkon va terrasalarda stol-stullar va o'simliklar. Pollar parket yoki kafel. Tunda chiroqlar yonadi.
- **Kamera.** Bino bitta burchakdan ko'rsatiladi, aylantirib bo'lmaydi. Faqat yaqinlashtirish va uzoqlashtirish mumkin, bunda ham cheklangan masofada. Yaqinlashtirish sichqoncha turgan joyga qarab bo'ladi.
- **Xonadon kartochkasi.** Xonalar ro'yxati va ularning maydoni, umumiy maydon (8–9-qavatlarda terrasa bilan birga), narx kalkulyatori: 30% / 50% boshlang'ich to'lov yoki to'liq to'lov, 6 oyga bo'lib to'lash.
- **2D reja.** Vektor sxema yoki asl chizma (PDF'dan), kattalashtirish va surish mumkin.
- **Kun vaqti.** Quyosh holati Toshkent vaqti bo'yicha hisoblanadi. Tunda derazalar, ko'cha chiroqlari, mashina faralari yonadi, osmonda yulduzlar chiqadi. Vaqtni slayder bilan ham o'zgartirish mumkin.
- O'zbek va rus tillari, galereya.
- **Telefonda** qavat ochilganda pastda ixcham panel chiqadi (qavat nomi va xonadonlar qatori), 3D ko'rinib turadi. To'liq narxlar va ro'yxat panelni yuqoriga surish yoki «Batafsil» tugmasi bilan ochiladi.

## Ishga tushirish

Hech narsa o'rnatish yoki yig'ish (build) shart emas — bu oddiy statik sayt. Three.js `js/vendor/` ichida joylashgan.

```bash
python3 -m http.server 8000
# brauzerda: http://localhost:8000
```

GitHub Pages'da joylash uchun: repozitoriy → Settings → Pages → `Deploy from a branch`, papka `/ (root)`.

`?q=low` parametri sifatni pasaytiradi (zaif qurilmalar uchun). Sekin qurilmalarda sayt sifatni o'zi ham avtomatik pasaytiradi.

## Narx va aloqa ma'lumotlarini o'zgartirish

Hammasi `js/config.js` faylida:

| Sozlama | Ma'nosi |
|---|---|
| `prices` | Har qavat uchun 1 m² narxi (so'm): `30`, `50` — boshlang'ich to'lov foizi, `100` — to'liq to'lov |
| `installmentMonths` | Bo'lib to'lash muddati (6 oy) |
| `phone`, `phoneHref` | «Qo'ng'iroq qilish» tugmasi uchun telefon raqami |
| `parkingPrice` | Parking joyi narxi |
| `commercialPriceOnRequest` | 1-qavatdagi tijorat maydonlari uchun narxni «so'rov bo'yicha» ko'rsatish |
| `location`, `facadeAzimuth` | Quyosh hisobi uchun joylashuv va asosiy fasad yo'nalishi (180 = janub) |
| `floorHeights` | Qavat balandliklari (m) |

Narxlar ro'yxatida (prays-list) 3, 4, 5-qavatlar ko'rsatilmagan. Shu sababli ularda hozircha «Narxi so'rov bo'yicha» yozuvi chiqadi. Narxlarni `prices` ga qo'shsangiz, ular darhol ko'rinadi.

## Ma'lumotlar qayerdan olingan

`data/floors.json` qavat rejalari PDF'laridan (AutoCAD) avtomatik ajratib olingan. PDF ichida har bir xonadon alohida rangli maska sifatida saqlangan, shuning uchun konturlar aniq chiqadi. Xonadonlar umumiy maydoni chizmadagi ramkadagi raqamdan, xonalar maydoni esa xona nomi ostidagi raqamlardan olingan.

Qayta generatsiya qilish (Python 3, `pymupdf opencv-python-headless shapely numpy pillow`):

```bash
export BAHOR_PDF_DIR=path/to/pdfs
python3 tools/extract_plans.py work/
python3 tools/render_plans.py work/ assets/plans
python3 tools/build_geometry.py work/ data/floors.json
python3 tools/build_rooms.py work/ data/floors.json   # xonalarni ajratish (mebel uchun)
```

Tuzatilgan joylar:

- 3, 4, 5-qavatlarda chap yuqoridagi xonadon chizmada «98.00» deb yozilgan. Lekin xonalari yig'indisi 67.8 m² va u 2-, 6-, 7-qavatlardagi 68.00 m² li xonadon bilan bir xil. Saytda **68 m²** ko'rsatilgan.
- 9-qavatdagi bitta balkon chizmada «29.88» deb yozilgan, saytda 2.99 m² deb olingan.

## Tuzilma

```
index.html            sahifa
css/style.css         interfeys uslublari
js/config.js          narxlar, aloqa, bino parametrlari
js/app.js             sahna, kamera, tanlash, animatsiyalar
js/building.js        bino fasadi, tom, ichki kesim
js/furniture.js       mebel, gilam, texnika, pol qoplamalari
js/environment.js     yo'llar, daraxtlar, chiroqlar, mashinalar, hovli
js/lighting.js        osmon, quyosh/oy, yulduzlar, kun-tun
js/ui.js, plan2d.js   panel, xonadon kartochkasi, 2D reja
js/i18n.js            o'zbek / rus tarjimalari
data/floors.json      qavatlar, xonadonlar, devorlar (metrda)
assets/plans/         asl chizmalar (WebP)
assets/gallery/       renderlar
tools/                PDF'dan ma'lumot ajratish skriptlari
```
