// Narx hisob-kitobi (narxlar ro'yxati bo'yicha)
import { CONFIG } from './config.js';

export function floorPrices(floor) {
  return CONFIG.prices[floor] || null;
}

export function minPerM2(floor) {
  const p = floorPrices(floor);
  if (!p) return null;
  return Math.min(...CONFIG.paymentPlans.map((k) => p[k]).filter(Boolean));
}

/** Price breakdown for an apartment and a payment plan (down payment %) */
export function aptPrice(floor, apt, plan) {
  const p = floorPrices(floor);
  if (!p || (apt.commercial && CONFIG.commercialPriceOnRequest)) return null;
  const perM2 = p[plan];
  if (!perM2) return null;
  const total = perM2 * apt.area;
  const months = CONFIG.installmentMonths;
  const first = plan >= 100 ? total : (total * plan) / 100;
  const monthly = plan >= 100 ? 0 : (total - first) / months;
  return { perM2, total, first, monthly, months, plan };
}

export function aptMinPrice(floor, apt) {
  const m = minPerM2(floor);
  if (!m || (apt.commercial && CONFIG.commercialPriceOnRequest)) return null;
  return m * apt.area;
}
