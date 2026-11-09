# Bahor — turar-joy majmuasi (Prestige Light House)

Bahor turar-joy majmuasi uchun interaktiv 3D sayt.

- **3D bino.** Rejalardan olingan aniq kontur bo'yicha qurilgan neoklassik fasad: chuqur derazalar, karnizlar, pilyastrlar, fransuz balkonlari, qizil chatirli tomlar, quyosh panellari. 8- va 9-qavatlardagi pog'onali qisqarishlar ham rejadagidek.
- **Qavat tanlash.** Sichqoncha qavat ustiga olib borilganda qavat oltin rangda yoritiladi va narxlari ko'rsatiladi. Bosilganda yuqori qavatlar olinadi va shu qavatning ichki bo'linishi ko'rinadi: rejadagi devorlar va har bir xonadonning maydoni.
- **Jihozlangan xonalar.** Har bir qavatdagi har bir xona turiga qarab jihozlangan: mehmonxonada divan, kreslo, televizor, gilam va mehmon stoli; yotoqxonada karavot, tumbochka va chiroq, shkaf; oshxonada muzlatkich, plita, rakovina va ovqat stoli; hammomda vanna yoki dush, unitaz, rakovina, kir yuvish mashinasi; dahlizda poyabzal javoni; balkon va terrasalarda stol-stullar va o'simliklar. Pollar parket yoki kafel. Tunda chiroqlar yonadi.
- **Xonadon maketi.** Xonadon tanlanganda bino va atrof yashirinadi, faqat shu xonadon qorong'i fonda alohida 3D maket bo'lib ochiladi: devorlar, mebel, gilamlar, iliq studiya yorug'ligi, xonalar ustida nomi va maydoni yozilgan nuqtalar (bosilsa, kamera o'sha xonaga yaqinlashadi). O'ng tomonda yotoqxona/hammom soni, maydon, narx va kalkulyator. «←» qavatga, «Binoga qaytish» bosh ko'rinishga qaytaradi.
- **Kamera.** Bino bitta burchakdan ko'rsatiladi, aylantirib bo'lmaydi. Faqat yaqinlashtirish va uzoqlashtirish mumkin, bunda ham cheklangan masofada. Yaqinlashtirish sichqoncha turgan joyga qarab bo'ladi.
- **Xonadon kartochkasi.** Xonalar ro'yxati va ularning maydoni, umumiy maydon (8–9-qavatlarda terrasa bilan birga), narx kalkulyatori: 30% / 50% boshlang'ich to'lov yoki to'liq to'lov, 6 oyga bo'lib to'lash.
- **2D reja.** Vektor sxema yoki asl chizma (PDF'dan), kattalashtirish va surish mumkin.
- **Fotorealistik bosh ko'rinish.** Kompyuterda bosh ko'rinish AI render (`assets/hero/`), qavat yoritilishi va bosish 3D modeldan olinib, render ustiga aniq tushadi. Yaqinlashtirish rasm bilan birga ishlaydi. Qavatga kirilganda sayt silliq 3D'ga o'tadi. Yorug'lik doim kunduzgi (`CONFIG.fixedTime`).
- O'zbek va rus tillari, galereya.
- **Telefonda** qavat ochilganda pastda ixcham panel chiqadi (qavat nomi va xonadonlar qatori), 3D ko'rinib turadi. To'liq narxlar va ro'yxat panelni yuqoriga surish yoki «Batafsil» tugmasi bilan ochiladi.

## Kompyuterda ishga tushirish

Kerak bo'ladi: **Node.js** (18 yoki undan yangi, https://nodejs.org → LTS) va ixtiyoriy ravishda **Git** (https://git-scm.com).

```bash
git clone https://github.com/iwyoqar/Bahor.git
cd Bahor
npm run dev
```

So'ng brauzerda **http://localhost:5173** ni oching. `npm install` shart emas: qo'shimcha paketlar yo'q, Three.js `js/vendor/` ichida.

- Faylni (masalan `js/config.js`) o'zgartirib saqlasangiz, sahifa o'zi yangilanadi.
- To'xtatish: terminalda `Ctrl + C`.
- Port band bo'lsa, server keyingisini (5174, 5175, …) tanlaydi. O'zingiz belgilash: `PORT=3000 npm run dev` (Windows PowerShell'da: `$env:PORT=3000; npm run dev`).
- Git o'rnatilmagan bo'lsa: GitHub'da **Code → Download ZIP**, arxivni oching, papka ichida terminal ochib `npm run dev`.
- Node.js o'rniga Python bo'lsa: `python -m http.server 8000` → http://localhost:8000 (avtomatik yangilanishsiz).

`index.html` faylini ikki marta bosib ochish ishlamaydi: brauzer modullar va ma'lumot fayllarini serversiz yuklamaydi.

Sayt GitHub Pages'da: https://iwyoqar.github.io/Bahor/ (`gh-pages` branchidan). O'zgarishni saytga chiqarish: `git push origin HEAD:gh-pages`.

`?q=low` parametri sifatni pasaytiradi (zaif qurilmalar uchun). Sekin qurilmalarda sayt sifatni o'zi ham avtomatik pasaytiradi.

## Fotorealistik render (Higgsfield / Nano Banana)

Asosiy ko'rinishni AI render bilan almashtirish bo'yicha qo'llanma va promptlar: [docs/ai-render.md](docs/ai-render.md). Render uchun xom suratlar `?capture=1&t=750&pr=2` rejimida olinadi (interfeyssiz, qotirilgan kamera burchagidan).

## Narx va aloqa ma'lumotlarini o'zgartirish

Hammasi `js/config.js` faylida:

| Sozlama | Ma'nosi |
|---|---|
| `prices` | Har qavat uchun 1 m² narxi (so'm): `30`, `50` — boshlang'ich to'lov foizi, `100` — to'liq to'lov |
| `installmentMonths` | Bo'lib to'lash muddati (6 oy) |
| `phone`, `phoneHref` | «Qo'ng'iroq qilish» tugmasi uchun telefon raqami |
| `parkingPrice` | Parking joyi narxi |
| `commercialPriceOnRequest` | 1-qavatdagi tijorat maydonlari uchun narxni «so'rov bo'yicha» ko'rsatish |
| `location`, `facadeAzimuth`, `fixedTime` | Quyosh hisobi: joylashuv, asosiy fasad yo'nalishi (180 = janub), kunduzgi sana va vaqt |
| `hero.desktop` | Bosh ko'rinishdagi fotorender fayli |
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
python3 tools/build_apt_walls.py data/floors.json     # har bir xonadonning o'z devorlari (maket uchun)
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
js/aptview.js         tanlangan xonadonning alohida maketi
js/environment.js     yo'llar, daraxtlar, chiroqlar, mashinalar, hovli
js/lighting.js        osmon, quyosh/oy, yulduzlar, kun-tun
js/ui.js, plan2d.js   panel, xonadon kartochkasi, 2D reja
js/i18n.js            o'zbek / rus tarjimalari
data/floors.json      qavatlar, xonadonlar, devorlar (metrda)
assets/plans/         asl chizmalar (WebP)
assets/gallery/       renderlar
tools/                PDF'dan ma'lumot ajratish skriptlari, dev-server
package.json          npm run dev / npm start
```
