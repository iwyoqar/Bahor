// Bahor turar-joy majmuasi — asosiy sozlamalar.
// Narxlar, aloqa ma'lumotlari va bino parametrlari shu faylda tahrirlanadi.

export const CONFIG = {
  developer: 'Prestige Light House',
  project: 'Bahor',

  // Aloqa (telefon raqamini shu yerga yozing)
  phone: '+998 00 000 00 00',
  phoneHref: 'tel:+998000000000',
  telegram: '',

  // Joylashuv: quyosh holatini hisoblash uchun (Toshkent)
  location: { lat: 41.3111, lon: 69.2797, tz: 5, tzName: 'Asia/Tashkent' },
  // Asosiy (А o'qi bo'yidagi) fasad qaysi tomonga qaragan, gradusda: 180 = janub
  facadeAzimuth: 180,
  // Sayt doim kunduzgi yorug'likda: quyosh holati shu sana va vaqt bo'yicha (Toshkent vaqti)
  fixedTime: { y: 2026, m: 4, d: 15, minutes: 11 * 60 },

  // Bosh ko'rinish uchun fotorealistik render (kompyuter). Kamera burchagi o'zgarsa, qayta yaratiladi.
  hero: { desktop: 'assets/hero/hero-desktop.jpg', aspect: 16 / 9 },

  // Narxlar: 1 m² uchun, so'mda. 6 oylik muddatli to'lov.
  // Kalit — boshlang'ich to'lov ulushi (%). 100 = to'liq to'lov.
  // Narxlar ro'yxatida 3, 4, 5-qavatlar yo'q — shu sababli null (so'rov bo'yicha).
  installmentMonths: 6,
  paymentPlans: [30, 50, 100],
  prices: {
    1: { 30: 16500000, 50: 15500000, 100: 14500000 },
    2: { 30: 16500000, 50: 15500000, 100: 14500000 },
    3: null,
    4: null,
    5: null,
    6: { 30: 13000000, 50: 12500000, 100: 12000000 },
    7: { 30: 13000000, 50: 12500000, 100: 12000000 },
    8: { 30: 13000000, 50: 12500000, 100: 12000000 },
    9: { 30: 13000000, 50: 12500000, 100: 12000000 },
  },
  // Tijorat maydonlari (1-qavat) narxi narxlar ro'yxatida alohida ko'rsatilmagan
  commercialPriceOnRequest: true,
  parkingPrice: 150000000,

  // Bino geometriyasi (metr)
  plinth: 0.45,
  floorHeights: [4.2, 3.3, 3.3, 3.3, 3.3, 3.3, 3.3, 3.3, 3.3],
};

export function floorBase(f) {
  let z = CONFIG.plinth;
  for (let i = 1; i < f; i++) z += CONFIG.floorHeights[i - 1];
  return z;
}

export function floorHeight(f) {
  return CONFIG.floorHeights[f - 1];
}
