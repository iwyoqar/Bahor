// Protsedural teksturalar (canvas) — tashqi rasm fayllarsiz realistik sirtlar uchun.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// value noise (tileable) for natural variation
function valueNoise(w, h, cells, seed) {
  const r = rng(seed);
  const grid = [];
  for (let j = 0; j < cells; j++) { grid[j] = []; for (let i = 0; i < cells; i++) grid[j][i] = r(); }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const gy = (y / h) * cells; const y0 = Math.floor(gy); const fy = gy - y0;
    const sy = fy * fy * (3 - 2 * fy);
    for (let x = 0; x < w; x++) {
      const gx = (x / w) * cells; const x0 = Math.floor(gx); const fx = gx - x0;
      const sx = fx * fx * (3 - 2 * fx);
      const a = grid[y0 % cells][x0 % cells], b = grid[y0 % cells][(x0 + 1) % cells];
      const c = grid[(y0 + 1) % cells][x0 % cells], d = grid[(y0 + 1) % cells][(x0 + 1) % cells];
      out[y * w + x] = (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
    }
  }
  return out;
}

function fbm(w, h, seed, octaves = [[4, 0.5], [8, 0.25], [16, 0.15], [32, 0.1]]) {
  const out = new Float32Array(w * h);
  octaves.forEach(([cells, amp], k) => {
    const n = valueNoise(w, h, cells, seed + k * 101);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
  });
  return out;
}

function toTexture(canvas, { repeat = 1, srgb = true, aniso = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = aniso;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function paintNoise(ctx, w, h, seed, base, amp, grain = 0.06) {
  const img = ctx.createImageData(w, h);
  const n = fbm(w, h, seed);
  const r = rng(seed * 7 + 3);
  for (let i = 0; i < w * h; i++) {
    const v = (n[i] - 0.5) * amp + (r() - 0.5) * grain;
    img.data[i * 4] = clamp255(base[0] * (1 + v));
    img.data[i * 4 + 1] = clamp255(base[1] * (1 + v));
    img.data[i * 4 + 2] = clamp255(base[2] * (1 + v));
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

const cache = {};

export function plasterTexture() {
  if (cache.plaster) return cache.plaster;
  const c = makeCanvas(512, 512); const ctx = c.getContext('2d');
  paintNoise(ctx, 512, 512, 11, [246, 244, 239], 0.07, 0.035);
  return (cache.plaster = toTexture(c));
}

export function stoneTexture() {
  if (cache.stone) return cache.stone;
  // travertine with rustication joints (one tile = 2.4m x 1.2m)
  const W = 512, H = 256;
  const c = makeCanvas(W, H); const ctx = c.getContext('2d');
  paintNoise(ctx, W, H, 21, [226, 216, 198], 0.12, 0.05);
  const r = rng(5);
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = r() > 0.5 ? '#b9a98c' : '#f4ede0';
    ctx.lineWidth = 0.6 + r() * 1.6;
    const y = r() * H;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 3 + (r() - 0.5) * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // joints: horizontal every 0.6 m (H/2), staggered verticals
  ctx.fillStyle = 'rgba(120,108,90,0.85)';
  for (let row = 0; row < 2; row++) {
    const y = row * (H / 2);
    ctx.fillRect(0, y, W, 3);
    const off = row % 2 ? W / 4 : 0;
    for (let x = off; x < W + 1; x += W / 2) ctx.fillRect(x % W, y, 3, H / 2);
  }
  return (cache.stone = toTexture(c));
}

export function asphaltTexture() {
  if (cache.asphalt) return cache.asphalt;
  const c = makeCanvas(512, 512); const ctx = c.getContext('2d');
  paintNoise(ctx, 512, 512, 31, [62, 63, 66], 0.25, 0.22);
  return (cache.asphalt = toTexture(c));
}

export function paverTexture() {
  if (cache.paver) return cache.paver;
  const W = 256; const c = makeCanvas(W, W); const ctx = c.getContext('2d');
  paintNoise(ctx, W, W, 41, [196, 192, 184], 0.12, 0.08);
  const r = rng(9);
  const n = 8; const s = W / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const v = (r() - 0.5) * 22;
    ctx.fillStyle = `rgba(${150 + v},${146 + v},${140 + v},0.25)`;
    ctx.fillRect(i * s + 1, j * s + 1, s - 2, s - 2);
  }
  ctx.strokeStyle = 'rgba(95,90,84,0.7)'; ctx.lineWidth = 1.5;
  for (let k = 0; k <= n; k++) {
    ctx.beginPath(); ctx.moveTo(k * s, 0); ctx.lineTo(k * s, W); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, k * s); ctx.lineTo(W, k * s); ctx.stroke();
  }
  return (cache.paver = toTexture(c));
}

export function grassTexture() {
  if (cache.grass) return cache.grass;
  const W = 512; const c = makeCanvas(W, W); const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, W);
  const n = fbm(W, W, 51);
  const r = rng(77);
  for (let i = 0; i < W * W; i++) {
    const v = n[i];
    const g = r();
    img.data[i * 4] = 92 + v * 46 + g * 14;
    img.data[i * 4 + 1] = 112 + v * 44 + g * 18;
    img.data[i * 4 + 2] = 62 + v * 20 + g * 8;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return (cache.grass = toTexture(c));
}

export function roofTexture() {
  if (cache.roof) return cache.roof;
  const c = makeCanvas(256, 256); const ctx = c.getContext('2d');
  paintNoise(ctx, 256, 256, 61, [150, 152, 156], 0.2, 0.25);
  return (cache.roof = toTexture(c));
}

export function tileTexture() {
  if (cache.tile) return cache.tile;
  const W = 256; const c = makeCanvas(W, W); const ctx = c.getContext('2d');
  paintNoise(ctx, W, W, 71, [168, 74, 48], 0.15, 0.1);
  for (let y = 0; y < W; y += 16) {
    const g = ctx.createLinearGradient(0, y, 0, y + 16);
    g.addColorStop(0, 'rgba(255,190,150,0.18)'); g.addColorStop(1, 'rgba(60,20,10,0.35)');
    ctx.fillStyle = g; ctx.fillRect(0, y, W, 16);
  }
  ctx.fillStyle = 'rgba(70,25,15,0.35)';
  for (let x = 0; x < W; x += 21) ctx.fillRect(x, 0, 2, W);
  return (cache.tile = toTexture(c));
}

/** Iron balcony railing (alpha) — one texture spans 1 m wide x 1 m tall */
export function railingTexture() {
  if (cache.rail) return cache.rail;
  const W = 256, H = 256; const c = makeCanvas(W, H); const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1b1c1e';
  ctx.fillRect(0, 0, W, 14);           // top rail
  ctx.fillRect(0, H - 22, W, 10);      // bottom rail
  ctx.fillRect(0, H * 0.32, W, 5);
  for (let x = 8; x < W; x += 32) ctx.fillRect(x, 0, 6, H - 12);
  ctx.strokeStyle = '#1b1c1e'; ctx.lineWidth = 4;
  for (let x = 24; x < W; x += 64) {
    ctx.beginPath(); ctx.ellipse(x, H * 0.55, 12, 22, 0, 0, Math.PI * 2); ctx.stroke();
  }
  const tex = toTexture(c);
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return (cache.rail = tex);
}

/** Facade texture for context buildings: base + emissive (lit windows) */
export function contextFacade(seed) {
  const key = 'ctx' + seed;
  if (cache[key]) return cache[key];
  const W = 256, H = 256;
  const c = makeCanvas(W, H); const ctx = c.getContext('2d');
  const e = makeCanvas(W, H); const ex = e.getContext('2d');
  const r = rng(seed);
  const base = [200 + r() * 30, 196 + r() * 26, 188 + r() * 24];
  paintNoise(ctx, W, H, seed, base, 0.06, 0.04);
  ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
  const cols = 4, rows = 4; const cw = W / cols, rh = H / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = i * cw + cw * 0.22, y = j * rh + rh * 0.2, w = cw * 0.56, h = rh * 0.58;
    ctx.fillStyle = '#3d4a56'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(x, y, w, h * 0.35);
    if (r() < 0.55) {
      const warm = r();
      ex.fillStyle = `rgb(${255},${190 + warm * 50},${110 + warm * 70})`;
      ex.globalAlpha = 0.5 + r() * 0.5;
      ex.fillRect(x, y, w, h);
      ex.globalAlpha = 1;
    }
  }
  const res = { map: toTexture(c), emissive: toTexture(e) };
  return (cache[key] = res);
}

/** Soft radial glow (light pools, halos) */
export function glowTexture() {
  if (cache.glow) return cache.glow;
  const W = 128; const c = makeCanvas(W, W); const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (cache.glow = tex);
}

/** Text sprite canvas (for signage) */
export function signTexture(text, sub) {
  const W = 1024, H = 256; const c = makeCanvas(W, H); const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1a1c'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#b89b5e'; ctx.lineWidth = 8; ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.fillStyle = '#e9d9b0';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 130px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(text, W / 2, H * 0.44);
  if (sub) { ctx.font = '500 40px Georgia, serif'; ctx.fillText(sub, W / 2, H * 0.8); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
