// Quyosh holati (NOAA soddalashtirilgan algoritmi) va mahalliy vaqt yordamchilari.
const RAD = Math.PI / 180;

/** Returns sun azimuth (deg, from north clockwise) and elevation (deg). */
export function sunPosition(date, lat, lon) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = mod(280.46 + 0.9856474 * n, 360);
  const g = mod(357.528 + 0.9856003 * n, 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = mod(18.697374558 + 24.06570982441908 * n, 24);
  const lst = (gmst * 15 + lon) * RAD;
  const ha = lst - ra;
  const phi = lat * RAD;
  const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(ha));
  return { azimuth: mod(az / RAD, 360), elevation: el / RAD, declination: dec / RAD };
}

function mod(a, b) { return ((a % b) + b) % b; }

/** Local (project timezone) clock for a Date: {y, m, d, minutes} */
export function localParts(date, tz) {
  const s = new Date(date.getTime() + tz * 3600000);
  return {
    y: s.getUTCFullYear(), m: s.getUTCMonth(), d: s.getUTCDate(),
    minutes: s.getUTCHours() * 60 + s.getUTCMinutes() + s.getUTCSeconds() / 60,
  };
}

/** Build a Date for given local day + minutes since local midnight */
export function dateFromLocal(parts, minutes, tz) {
  return new Date(Date.UTC(parts.y, parts.m, parts.d, 0, 0, 0) + (minutes - tz * 60) * 60000);
}

export function fmtClock(minutes) {
  const m = Math.round(minutes) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Day phase from sun elevation and whether it is morning */
export function phaseOf(elevation, morning) {
  if (elevation > 8) return 'day';
  if (elevation > -6) return morning ? 'dawn' : 'dusk';
  return 'night';
}
