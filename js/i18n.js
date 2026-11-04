// Tarjimalar: o'zbek (lotin) va rus tillari
const DICT = {
  uz: {
    title: 'Bahor',
    subtitle: 'Turar-joy majmuasi',
    by: 'Prestige Light House',
    floors: 'qavat',
    floor: '{n}-qavat',
    floorShort: '{n}',
    apartments: 'xonadon',
    aptCount: '{n} ta xonadon',
    chooseFloor: 'Qavatni tanlang',
    hint: 'Sichqonchani qavat ustiga olib boring va bosing',
    hintTouch: 'Qavatni tanlash uchun ustiga bosing',
    perM2: '1 m² narxi',
    from: 'dan',
    priceFrom: '{p} so\'mdan',
    priceOnRequest: 'Narxi so\'rov bo\'yicha',
    downPayment: 'Boshlang\'ich to\'lov',
    fullPayment: 'To\'liq to\'lov',
    installment: '{m} oyga bo\'lib to\'lash',
    totalPrice: 'Umumiy narx',
    firstPayment: 'Boshlang\'ich to\'lov',
    monthly: 'Oylik to\'lov',
    months: '{m} oy davomida',
    sum: 'so\'m',
    mln: 'mln',
    area: 'Maydoni',
    areaTer: 'Terrasa bilan',
    rooms: 'Xonalar',
    roomsN: '{n} xonali',
    commercial: 'Tijorat maydoni',
    apt: 'Xonadon',
    aptNo: '№ {n}',
    back: 'Orqaga',
    close: 'Yopish',
    plan2d: '2D reja',
    scheme: 'Sxema',
    drawing: 'Asl chizma',
    building: 'Bino',
    call: 'Qo\'ng\'iroq qilish',
    gallery: 'Galereya',
    parking: 'Parking',
    parkingPrice: 'Parking joyi',
    time: 'Vaqt',
    live: 'Jonli',
    now: 'Hozir',
    dawn: 'Tong',
    day: 'Kunduz',
    dusk: 'Shom',
    night: 'Tun',
    priceList: 'Narxlar',
    priceTable: '1 m² narxi (6 oylik bo\'lib to\'lash)',
    selectApt: 'Xonadonni tanlang — xonalar va narx ko\'rinadi',
    notInPrice: 'Bu qavat narxlar ro\'yxatida ko\'rsatilmagan',
    loading: 'Yuklanmoqda',
    zoomHint: 'G\'ildirak — kattalashtirish, sudrash — surish',
    total: 'Jami',
    note: 'Izoh',
    viewFloor: 'Qavatni ko\'rish',
    living: 'Yashash maydoni',
    floorPlan: 'Qavat rejasi',
    compass: 'Shimol',
    lang: 'RU',
    terraceBadge: 'Terrasa',
    sqm: 'm²',
    rooms_kitchen: 'Oshxona',
    rooms_bedroom: 'Yotoqxona',
    rooms_living: 'Mehmonxona',
    rooms_hall: 'Dahliz',
    rooms_bath: 'Hammom',
    rooms_balcony: 'Balkon',
    rooms_wc: 'Hojatxona',
    rooms_terrace: 'Terrasa',
    rooms_storage: 'Omborxona',
    rooms_wardrobe: 'Kiyim xonasi',
  },
  ru: {
    title: 'Bahor',
    subtitle: 'Жилой комплекс',
    by: 'Prestige Light House',
    floors: 'этаж',
    floor: '{n} этаж',
    floorShort: '{n}',
    apartments: 'квартир',
    aptCount: '{n} квартир',
    chooseFloor: 'Выберите этаж',
    hint: 'Наведите курсор на этаж и нажмите',
    hintTouch: 'Нажмите на этаж, чтобы выбрать',
    perM2: 'Цена за 1 м²',
    from: 'от',
    priceFrom: 'от {p} сум',
    priceOnRequest: 'Цена по запросу',
    downPayment: 'Первоначальный взнос',
    fullPayment: 'Полная оплата',
    installment: 'Рассрочка на {m} месяцев',
    totalPrice: 'Общая стоимость',
    firstPayment: 'Первый взнос',
    monthly: 'Ежемесячно',
    months: 'в течение {m} мес.',
    sum: 'сум',
    mln: 'млн',
    area: 'Площадь',
    areaTer: 'С террасой',
    rooms: 'Комнаты',
    roomsN: '{n}-комн.',
    commercial: 'Коммерческое помещение',
    apt: 'Квартира',
    aptNo: '№ {n}',
    back: 'Назад',
    close: 'Закрыть',
    plan2d: '2D план',
    scheme: 'Схема',
    drawing: 'Чертёж',
    building: 'Здание',
    call: 'Позвонить',
    gallery: 'Галерея',
    parking: 'Паркинг',
    parkingPrice: 'Парковочное место',
    time: 'Время',
    live: 'Сейчас',
    now: 'Сейчас',
    dawn: 'Утро',
    day: 'День',
    dusk: 'Вечер',
    night: 'Ночь',
    priceList: 'Цены',
    priceTable: 'Цена за 1 м² (рассрочка на 6 месяцев)',
    selectApt: 'Выберите квартиру — покажем комнаты и цену',
    notInPrice: 'Этот этаж не указан в прайс-листе',
    loading: 'Загрузка',
    zoomHint: 'Колесо — масштаб, перетаскивание — сдвиг',
    total: 'Итого',
    note: 'Примечание',
    viewFloor: 'Смотреть этаж',
    living: 'Жилая площадь',
    floorPlan: 'План этажа',
    compass: 'Север',
    lang: 'UZ',
    terraceBadge: 'Терраса',
    sqm: 'м²',
    rooms_kitchen: 'Кухня',
    rooms_bedroom: 'Спальня',
    rooms_living: 'Зал',
    rooms_hall: 'Холл',
    rooms_bath: 'Санузел',
    rooms_balcony: 'Балкон',
    rooms_wc: 'С/у',
    rooms_terrace: 'Терраса',
    rooms_storage: 'Кладовая',
    rooms_wardrobe: 'Гардероб',
  },
};

let lang = 'uz';
try {
  const saved = localStorage.getItem('bahor-lang');
  if (saved && DICT[saved]) lang = saved;
} catch (e) { /* storage unavailable */ }

const listeners = new Set();

export function t(key, vars) {
  let s = (DICT[lang] && DICT[lang][key]) ?? DICT.uz[key] ?? key;
  if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
  return s;
}

export function getLang() { return lang; }

export function setLang(l) {
  if (!DICT[l]) return;
  lang = l;
  try { localStorage.setItem('bahor-lang', l); } catch (e) { /* ignore */ }
  document.documentElement.lang = l;
  listeners.forEach((fn) => fn(l));
}

export function onLang(fn) { listeners.add(fn); }

export function roomName(code) { return t('rooms_' + code); }

export function fmtMoney(v) {
  return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function fmtMln(v) {
  const m = v / 1e6;
  const s = m >= 100 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, '');
  return `${s.replace('.', ',')} ${t('mln')}`;
}

export function fmtArea(a) {
  return (Math.round(a * 100) / 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}
