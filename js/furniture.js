// Xonalarni jihozlash: mebel, gilam, maishiy texnika va pol qoplamalari.
// Har bir xona rejadan ajratilgan to'rtburchak (r) va uning devorlari (s) bo'yicha jihozlanadi.
import * as THREE from 'three';
import { toWorld, flatPolys } from './building.js';

// ---------------------------------------------------------------- random
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
const pick = (R, arr) => arr[Math.floor(R() * arr.length) % arr.length];

// ---------------------------------------------------------------- textures
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, rep = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.repeat.set(rep, rep);
  return t;
}

function parquetTexture() {
  // herringbone-free straight planks, 2.4 m tile
  const c = canvas(512, 512); const x = c.getContext('2d'); const R = rng(7);
  const plankW = 512 / 12, plankL = 512 / 2;
  for (let i = 0; i < 12; i++) {
    for (let j = -1; j < 3; j++) {
      const off = (i % 2) * plankL / 2 + (i % 3) * 30;
      const y0 = j * plankL + off;
      const b = 0.88 + R() * 0.22;
      x.fillStyle = `rgb(${Math.round(176 * b)},${Math.round(132 * b)},${Math.round(88 * b)})`;
      x.fillRect(i * plankW, y0, plankW, plankL);
      x.globalAlpha = 0.16;
      for (let k = 0; k < 7; k++) {
        x.strokeStyle = R() > 0.5 ? '#6b4426' : '#e2bd8a';
        x.lineWidth = 0.8 + R();
        const gx = i * plankW + 3 + R() * (plankW - 6);
        x.beginPath(); x.moveTo(gx, y0); x.bezierCurveTo(gx + 4, y0 + plankL * 0.3, gx - 4, y0 + plankL * 0.6, gx + 2, y0 + plankL); x.stroke();
      }
      x.globalAlpha = 1;
      x.fillStyle = 'rgba(60,38,20,0.55)';
      x.fillRect(i * plankW, y0, 1.5, plankL);
      x.fillRect(i * plankW, y0, plankW, 1.5);
    }
  }
  return tex(c, 1 / 2.4);
}

function tileTexture(base, joint, size, n, seed) {
  const c = canvas(size, size); const x = c.getContext('2d'); const R = rng(seed);
  const s = size / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = (R() - 0.5) * 10;
    x.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`;
    x.fillRect(i * s, j * s, s, s);
    // subtle marble veins
    x.globalAlpha = 0.08; x.strokeStyle = '#8a8478'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(i * s + R() * s, j * s); x.lineTo(i * s + R() * s, j * s + s); x.stroke();
    x.globalAlpha = 1;
  }
  x.strokeStyle = joint; x.lineWidth = 2;
  for (let k = 0; k <= n; k++) {
    x.beginPath(); x.moveTo(k * s, 0); x.lineTo(k * s, size); x.stroke();
    x.beginPath(); x.moveTo(0, k * s); x.lineTo(size, k * s); x.stroke();
  }
  return c;
}

function deckTexture() {
  const c = canvas(256, 256); const x = c.getContext('2d'); const R = rng(17);
  for (let i = 0; i < 8; i++) {
    const b = 0.85 + R() * 0.25;
    x.fillStyle = `rgb(${Math.round(150 * b)},${Math.round(104 * b)},${Math.round(70 * b)})`;
    x.fillRect(0, i * 32, 256, 32);
    x.fillStyle = 'rgba(40,25,15,0.6)'; x.fillRect(0, i * 32, 256, 2);
  }
  return tex(c, 1 / 1.2);
}

/** Procedural carpets: classic medallion rugs and modern ones */
function rugTexture(style, seed) {
  const W = 512, H = 768; const c = canvas(W, H); const x = c.getContext('2d'); const R = rng(seed);
  const pal = {
    red: ['#7d1d1f', '#a8323a', '#1f2a4a', '#e8d6b0', '#c98b3a'],
    blue: ['#1d2e55', '#2d4a80', '#7d1d1f', '#eadcb8', '#b88a3a'],
    beige: ['#d9cbb0', '#c4b08e', '#7a5a3a', '#f3ead8', '#9a7a52'],
    grey: ['#8d8f92', '#6d7074', '#d9d6cf', '#3d4044', '#b9b4aa'],
  }[style];
  x.fillStyle = pal[0]; x.fillRect(0, 0, W, H);
  if (style === 'red' || style === 'blue') {
    // borders
    const bands = [[0, pal[2]], [26, pal[3]], [34, pal[1]], [70, pal[3]], [78, pal[0]]];
    bands.forEach(([inset, col]) => { x.fillStyle = col; x.fillRect(inset, inset, W - 2 * inset, H - 2 * inset); });
    // border motifs
    x.fillStyle = pal[4];
    for (let i = 0; i < 18; i++) {
      const yy = 52 + i * (H - 104) / 17;
      [[52, yy], [W - 52, yy]].forEach(([cx, cy]) => { x.beginPath(); x.moveTo(cx, cy - 10); x.lineTo(cx + 9, cy); x.lineTo(cx, cy + 10); x.lineTo(cx - 9, cy); x.fill(); });
    }
    for (let i = 0; i < 12; i++) {
      const xx = 52 + i * (W - 104) / 11;
      [[xx, 52], [xx, H - 52]].forEach(([cx, cy]) => { x.beginPath(); x.moveTo(cx, cy - 10); x.lineTo(cx + 9, cy); x.lineTo(cx, cy + 10); x.lineTo(cx - 9, cy); x.fill(); });
    }
    // field pattern
    x.globalAlpha = 0.35; x.strokeStyle = pal[1]; x.lineWidth = 3;
    for (let yy = 100; yy < H - 100; yy += 36) for (let xx = 100; xx < W - 100; xx += 36) {
      x.beginPath(); x.arc(xx, yy, 8, 0, Math.PI * 2); x.stroke();
    }
    x.globalAlpha = 1;
    // central medallion
    const cx = W / 2, cy = H / 2;
    [[150, 230, pal[1]], [118, 190, pal[3]], [96, 156, pal[2]], [60, 100, pal[4]], [30, 50, pal[0]]].forEach(([rx, ry, col]) => {
      x.fillStyle = col; x.beginPath();
      for (let k = 0; k <= 16; k++) {
        const a = (k / 16) * Math.PI * 2, rr = k % 2 ? 0.82 : 1;
        x.lineTo(cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr);
      }
      x.fill();
    });
    // corner pieces
    x.fillStyle = pal[1];
    [[100, 100], [W - 100, 100], [100, H - 100], [W - 100, H - 100]].forEach(([px, py]) => { x.beginPath(); x.arc(px, py, 34, 0, Math.PI * 2); x.fill(); });
  } else {
    // modern: soft stripes / geometric
    x.globalAlpha = 0.55;
    for (let i = 0; i < 14; i++) {
      x.fillStyle = pick(R, pal.slice(1));
      const yy = R() * H;
      x.fillRect(0, yy, W, 6 + R() * 30);
    }
    x.globalAlpha = 1;
    x.strokeStyle = pal[3]; x.lineWidth = 10; x.strokeRect(22, 22, W - 44, H - 44);
  }
  // pile noise
  const img = x.getImageData(0, 0, W, H); const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------------------------------------------------------------- shared materials & templates
let M = null;
function materials() {
  if (M) return M;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const tileC = tex(tileTexture([226, 222, 214], 'rgba(150,145,135,0.9)', 512, 4, 3), 1 / 2.4);
  const bathC = tex(tileTexture([205, 214, 220], 'rgba(120,130,140,0.9)', 512, 8, 5), 1 / 2.4);
  const shopC = tex(tileTexture([236, 234, 230], 'rgba(170,166,160,0.8)', 512, 3, 9), 1 / 2.4);
  M = {
    parquet: std({ map: parquetTexture(), roughness: 0.55 }),
    tile: std({ map: tileC, roughness: 0.3 }),
    bathTile: std({ map: bathC, roughness: 0.25 }),
    shopTile: std({ map: shopC, roughness: 0.18 }),
    deck: std({ map: deckTexture(), roughness: 0.8 }),
    wood: std({ color: 0xb98d5f, roughness: 0.55 }),
    woodDark: std({ color: 0x5b3e2b, roughness: 0.5 }),
    lacquer: std({ color: 0xf1eee8, roughness: 0.35 }),
    fabric: std({ color: 0xffffff, roughness: 0.95 }),
    linen: std({ color: 0xf6f3ec, roughness: 0.9 }),
    steel: std({ color: 0xc4c8cc, roughness: 0.28, metalness: 0.85 }),
    black: std({ color: 0x151618, roughness: 0.25, metalness: 0.3 }),
    ceramic: std({ color: 0xfbfbfa, roughness: 0.12 }),
    stone: std({ color: 0x3d3a37, roughness: 0.3 }),
    leaf: std({ color: 0xffffff, roughness: 0.85 }),
    pot: std({ color: 0xa35c3c, roughness: 0.8 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfe6ee, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false }),
    water: std({ color: 0x9fc9d9, roughness: 0.05, metalness: 0.2 }),
    shade: std({ color: 0xf5ead2, roughness: 0.8, emissive: 0xffc88a, emissiveIntensity: 0 }),
    screen: std({ color: 0x0b0c0e, roughness: 0.15, metalness: 0.4, emissive: 0x6d8fb8, emissiveIntensity: 0 }),
    rugs: ['red', 'blue', 'beige', 'grey', 'red', 'blue'].map((s, i) => std({ map: rugTexture(s, 31 + i), roughness: 1 })),
  };
  return M;
}

const T = {};
function templates() {
  if (T.box) return T;
  T.box = new THREE.BoxGeometry(1, 1, 1);
  T.cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
  T.cone = new THREE.ConeGeometry(0.5, 1, 20);
  T.sphere = new THREE.SphereGeometry(0.5, 14, 10);
  T.plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  // lumpy foliage
  const f = new THREE.IcosahedronGeometry(0.5, 2);
  const p = f.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + Math.sin(v.x * 17) * Math.cos(v.z * 13) * 0.12); p.setXYZ(i, v.x, v.y, v.z); }
  f.computeVertexNormals();
  T.leaves = f;
  return T;
}

// ---------------------------------------------------------------- instanced kit
class Kit {
  constructor(base) { this.base = base; this.buckets = new Map(); }
  /** add a part in plan space: item frame (X,Y,rot) + local box (x,y,z centre; sx,sy,sz size) */
  part(item, tpl, mat, lx, ly, lz, sx, sy, sz, color, rx = 0, rz = 0) {
    const key = tpl + '|' + (typeof mat === 'string' ? mat : mat.uuid);
    if (!this.buckets.has(key)) this.buckets.set(key, { tpl, mat, list: [] });
    // local -> plan: local x along item.ax, local z along item.fw
    const X = item.x + item.ax[0] * lx + item.fw[0] * lz;
    const Y = item.y + item.ax[1] * lx + item.fw[1] * lz;
    this.buckets.get(key).list.push({ p: toWorld(X, Y, this.base + ly), s: [sx, sy, sz], rot: item.rot, rx, rz, color });
  }
  build() {
    const g = new THREE.Group();
    const mats = materials(); const tpls = templates();
    const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler(); const sc = new THREE.Vector3();
    const col = new THREE.Color();
    for (const b of this.buckets.values()) {
      const mat = typeof b.mat === 'string' ? mats[b.mat] : b.mat;
      const inst = new THREE.InstancedMesh(tpls[b.tpl], mat, b.list.length);
      b.list.forEach((it, i) => {
        e.set(it.rx, it.rot, it.rz, 'YXZ');
        q.setFromEuler(e);
        sc.set(it.s[0], it.s[1], it.s[2]);
        m4.compose(it.p, q, sc);
        inst.setMatrixAt(i, m4);
        if (it.color !== undefined) inst.setColorAt(i, col.set(it.color));
        else if (b.list.some((x) => x.color !== undefined)) inst.setColorAt(i, col.set(0xffffff));
      });
      inst.castShadow = b.mat !== 'glass';
      inst.receiveShadow = true;
      g.add(inst);
    }
    return g;
  }
}

// ---------------------------------------------------------------- layout helpers
function frame(room) {
  const [x0, y0, x1, y1] = room.r;
  const sides = [
    { id: 0, len: x1 - x0, start: [x0, y0], dir: [1, 0], in: [0, 1] },
    { id: 1, len: y1 - y0, start: [x1, y0], dir: [0, 1], in: [-1, 0] },
    { id: 2, len: x1 - x0, start: [x0, y1], dir: [1, 0], in: [0, -1] },
    { id: 3, len: y1 - y0, start: [x0, y0], dir: [0, 1], in: [1, 0] },
  ];
  sides.forEach((s, i) => { const [w, e, runs] = room.s[i]; s.wall = w; s.ext = e; s.runs = runs; });
  return { x0, y0, x1, y1, W: x1 - x0, D: y1 - y0, sides, occ: [], keep: [] };
}

function rectOf(F, side, u, w, d, gap) {
  const s = F.sides[side];
  const a = [s.start[0] + s.dir[0] * (u - w / 2) + s.in[0] * gap, s.start[1] + s.dir[1] * (u - w / 2) + s.in[1] * gap];
  const b = [s.start[0] + s.dir[0] * (u + w / 2) + s.in[0] * (gap + d), s.start[1] + s.dir[1] * (u + w / 2) + s.in[1] * (gap + d)];
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}

const overlap = (a, b, m = 0) => a[0] < b[2] - m && b[0] < a[2] - m && a[1] < b[3] - m && b[1] < a[3] - m;

function keepOuts(F) {
  // keep door openings clear (runs on interior sides)
  for (const s of F.sides) {
    if (s.ext > 0.5) continue;
    for (const [u0, u1] of s.runs) {
      F.keep.push(rectOf(F, s.id, (u0 + u1) / 2, (u1 - u0) + 0.2, 0.85, 0));
    }
  }
}

/** try to place an item of size w x d against side, anywhere along it (pref = preferred u fraction) */
function placeAgainst(F, side, w, d, { gap = 0.02, pref = 0.5, tall = false, allowDoor = false } = {}) {
  const s = F.sides[side];
  if (w > s.len - 0.04) return null;
  const steps = [];
  const u0 = w / 2 + 0.02, u1 = s.len - w / 2 - 0.02;
  const c = Math.min(Math.max(pref * s.len, u0), u1);
  for (let k = 0; k <= 40; k++) {
    const off = ((k + 1) >> 1) * (k % 2 ? 1 : -1) * 0.1;
    const u = c + off;
    if (u >= u0 - 1e-6 && u <= u1 + 1e-6) steps.push(u);
  }
  for (const u of steps) {
    const r = rectOf(F, side, u, w, d, gap);
    if (r[0] < F.x0 - 0.01 || r[1] < F.y0 - 0.01 || r[2] > F.x1 + 0.01 || r[3] > F.y1 + 0.01) continue;
    if (F.occ.some((o) => overlap(o, r, 0.02))) continue;
    if (!allowDoor && F.keep.some((o) => overlap(o, r, 0.02))) continue;
    if (tall && s.ext > 0.3) continue;
    F.occ.push(r);
    return itemAt(F, side, u, w, d, gap);
  }
  return null;
}

function itemAt(F, side, u, w, d, gap) {
  const s = F.sides[side];
  const cx = s.start[0] + s.dir[0] * u + s.in[0] * (gap + d / 2);
  const cy = s.start[1] + s.dir[1] * u + s.in[1] * (gap + d / 2);
  return makeItem(cx, cy, s.in, w, d);
}

function makeItem(cx, cy, fwd, w, d) {
  // world rotation so local +z points along fwd (plan), local +x = right-hand of fwd
  const rot = Math.atan2(fwd[0], -fwd[1]);
  // local x maps to world (cos rot, 0, -sin rot) = plan (cos rot, sin rot)
  return { x: cx, y: cy, rot, fw: fwd, ax: [Math.cos(rot), Math.sin(rot)], w, d };
}

/** free-standing item centred at plan point facing fwd, registers occupancy */
function placeFree(F, cx, cy, fwd, w, d, { force = false } = {}) {
  const horiz = Math.abs(fwd[1]) > 0.5;
  const hw = (horiz ? w : d) / 2, hd = (horiz ? d : w) / 2;
  const r = [cx - hw, cy - hd, cx + hw, cy + hd];
  if (!force) {
    if (r[0] < F.x0 - 0.01 || r[1] < F.y0 - 0.01 || r[2] > F.x1 + 0.01 || r[3] > F.y1 + 0.01) return null;
    if (F.occ.some((o) => overlap(o, r, 0.02))) return null;
    if (F.keep.some((o) => overlap(o, r, 0.02))) return null;
  }
  F.occ.push(r);
  return makeItem(cx, cy, fwd, w, d);
}

const opposite = (s) => (s + 2) % 4;
function windowSide(F) { return [...F.sides].sort((a, b) => b.ext - a.ext)[0]; }
function wallSides(F) { return [...F.sides].sort((a, b) => (b.wall - b.ext * 0.8) - (a.wall - a.ext * 0.8)); }

// ---------------------------------------------------------------- models (local frame: x width, y up, z depth, back at -d/2)
const FABRICS = ['#8a8f96', '#c9bda6', '#3f4f6b', '#6b4f3f', '#8c3b3b', '#d8d2c6', '#4f6b5a', '#2f3338', '#b49a74'];
const DUVETS = ['#f2efe9', '#d9cbb3', '#9fb2c8', '#c7a7a0', '#e6dccb', '#a8b8a0'];

function bed(K, it, R, single) {
  const w = it.w, l = it.d, fab = pick(R, FABRICS), duv = pick(R, DUVETS);
  K.part(it, 'box', 'fabric', 0, 0.17, 0, w + 0.06, 0.34, l, fab);
  K.part(it, 'box', 'fabric', 0, 0.55, -l / 2 + 0.05, w + 0.1, 1.1, 0.1, fab);
  K.part(it, 'box', 'linen', 0, 0.44, 0.03, w - 0.04, 0.2, l - 0.1);
  K.part(it, 'box', 'fabric', 0, 0.565, l * 0.12, w + 0.02, 0.07, l * 0.7, duv);
  K.part(it, 'box', 'fabric', 0, 0.58, l / 2 - 0.42, w + 0.04, 0.085, 0.34, pick(R, FABRICS));
  const n = single ? 1 : 2;
  for (let i = 0; i < n; i++) {
    const px = single ? 0 : (i ? 1 : -1) * w / 4;
    K.part(it, 'box', 'linen', px, 0.62, -l / 2 + 0.33, single ? w - 0.2 : w / 2 - 0.12, 0.13, 0.36);
  }
}

function nightstand(K, it) {
  K.part(it, 'box', 'wood', 0, 0.25, 0, 0.45, 0.5, 0.4);
  K.part(it, 'box', 'black', 0, 0.38, 0.201, 0.3, 0.02, 0.01);
  K.part(it, 'cyl', 'steel', 0, 0.62, 0, 0.1, 0.24, 0.1);
  K.part(it, 'cyl', 'shade', 0, 0.82, 0, 0.26, 0.2, 0.26);
}

function wardrobe(K, it) {
  const w = it.w;
  K.part(it, 'box', 'lacquer', 0, 1.0, 0, w, 2.0, 0.58);
  const doors = Math.max(2, Math.round(w / 0.5));
  for (let i = 1; i < doors; i++) K.part(it, 'box', 'black', -w / 2 + (i * w) / doors, 1.0, 0.292, 0.008, 1.94, 0.006);
  for (let i = 0; i < doors; i++) K.part(it, 'box', 'steel', -w / 2 + ((i + 0.5) * w) / doors + (i % 2 ? -1 : 1) * 0.15, 1.05, 0.3, 0.02, 0.3, 0.02);
}

function sofa(K, it, R, color) {
  const w = it.w, d = it.d, c = color || pick(R, FABRICS);
  K.part(it, 'box', 'fabric', 0, 0.22, 0.02, w, 0.36, d - 0.04, c);
  K.part(it, 'box', 'fabric', 0, 0.62, -d / 2 + 0.11, w, 0.5, 0.22, c);
  K.part(it, 'box', 'fabric', -w / 2 + 0.1, 0.33, 0, 0.2, 0.32, d, c);
  K.part(it, 'box', 'fabric', w / 2 - 0.1, 0.33, 0, 0.2, 0.32, d, c);
  const n = Math.max(1, Math.round((w - 0.4) / 0.65));
  const cw = (w - 0.42) / n;
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + 0.21 + cw * (i + 0.5);
    K.part(it, 'box', 'fabric', cx, 0.46, 0.08, cw - 0.03, 0.13, d - 0.28, c);
    K.part(it, 'box', 'fabric', cx, 0.68, -d / 2 + 0.3, cw - 0.05, 0.36, 0.14, c);
  }
  if (w > 1.2) K.part(it, 'box', 'fabric', -w / 2 + 0.45, 0.66, -d / 2 + 0.42, 0.4, 0.34, 0.12, pick(R, ['#c9a14a', '#8c3b3b', '#f2efe9', '#3f4f6b']));
}

function coffeeTable(K, it) {
  K.part(it, 'box', 'wood', 0, 0.4, 0, it.w, 0.04, it.d);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.part(it, 'box', 'black', sx * (it.w / 2 - 0.06), 0.19, sz * (it.d / 2 - 0.06), 0.03, 0.38, 0.03);
  K.part(it, 'cyl', 'ceramic', 0.15, 0.47, 0, 0.14, 0.1, 0.14);
}

function tvUnit(K, it) {
  K.part(it, 'box', 'woodDark', 0, 0.24, 0, it.w, 0.48, it.d);
  const tw = Math.min(1.45, it.w - 0.2);
  K.part(it, 'box', 'black', 0, 0.52, -0.02, 0.3, 0.03, 0.18);
  K.part(it, 'box', 'black', 0, 0.95, -0.04, tw, tw * 0.58, 0.05);
  K.part(it, 'box', 'screen', 0, 0.95, -0.01, tw - 0.04, tw * 0.58 - 0.04, 0.01);
}

function rug(K, it, R, M_) {
  K.part(it, 'plane', M_.rugs[Math.floor(R() * M_.rugs.length)], 0, 0.012, 0, it.w, 1, it.d);
}

function table(K, it, R, round = false) {
  if (round) {
    K.part(it, 'cyl', 'wood', 0, 0.74, 0, it.w, 0.04, it.w);
    K.part(it, 'cyl', 'black', 0, 0.37, 0, 0.08, 0.72, 0.08);
  } else {
    K.part(it, 'box', 'wood', 0, 0.74, 0, it.w, 0.045, it.d);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.part(it, 'box', 'woodDark', sx * (it.w / 2 - 0.07), 0.36, sz * (it.d / 2 - 0.07), 0.05, 0.72, 0.05);
  }
}

function chairs(K, F, it, count, R, color) {
  // chairs around a table item (plan coordinates)
  const c = color || pick(R, FABRICS);
  const pts = [];
  const long = it.w, short = it.d;
  const perLong = Math.max(1, Math.min(4, Math.floor(long / 0.62)));
  for (let i = 0; i < perLong && pts.length < count; i++) {
    const t = -long / 2 + (long / perLong) * (i + 0.5);
    pts.push([t, -short / 2 - 0.24, [0, 1]]);
    if (pts.length < count) pts.push([t, short / 2 + 0.24, [0, -1]]);
  }
  if (count > pts.length && long > 1.5) { pts.push([-long / 2 - 0.24, 0, [1, 0]]); pts.push([long / 2 + 0.24, 0, [-1, 0]]); }
  for (const [lx, lz, f] of pts.slice(0, count)) {
    // local table frame -> plan
    const X = it.x + it.ax[0] * lx + it.fw[0] * lz;
    const Y = it.y + it.ax[1] * lx + it.fw[1] * lz;
    // chair faces toward the table centre
    const dx = it.x - X, dy = it.y - Y; const L = Math.hypot(dx, dy) || 1;
    const ch = makeItem(X, Y, [dx / L, dy / L], 0.46, 0.48);
    K.part(ch, 'box', 'fabric', 0, 0.46, 0, 0.44, 0.07, 0.44, c);
    K.part(ch, 'box', 'fabric', 0, 0.78, -0.2, 0.44, 0.56, 0.06, c);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.part(ch, 'box', 'woodDark', sx * 0.19, 0.22, sz * 0.19, 0.035, 0.44, 0.035);
  }
}

function plant(K, it, R, big = true) {
  const s = big ? 1 : 0.6;
  K.part(it, 'cyl', 'pot', 0, 0.18 * s, 0, 0.36 * s, 0.36 * s, 0.36 * s);
  const g = pick(R, ['#3f7a3a', '#2f6a34', '#4f8a3f']);
  K.part(it, 'leaves', 'leaf', 0, 0.62 * s, 0, 0.62 * s, 0.7 * s, 0.62 * s, g);
  if (big) K.part(it, 'leaves', 'leaf', 0.08, 1.0, 0.05, 0.45, 0.55, 0.45, g);
}

function floorLamp(K, it) {
  K.part(it, 'cyl', 'black', 0, 0.015, 0, 0.3, 0.03, 0.3);
  K.part(it, 'cyl', 'black', 0, 0.8, 0, 0.03, 1.55, 0.03);
  K.part(it, 'cone', 'shade', 0, 1.55, 0, 0.4, 0.3, 0.4);
}

function kitchenRun(K, it, R, withFridge) {
  const w = it.w, front = pick(R, ['lacquer', 'wood', 'woodDark']);
  let x = -w / 2;
  if (withFridge) {
    K.part(it, 'box', 'steel', x + 0.36, 0.92, 0, 0.7, 1.84, 0.66);
    K.part(it, 'box', 'black', x + 0.36, 1.3, 0.331, 0.66, 0.006, 0.006);
    K.part(it, 'box', 'black', x + 0.66, 1.0, 0.34, 0.025, 0.5, 0.025);
    x += 0.74;
  }
  const L = w / 2 - x;
  if (L < 0.5) return;
  const cx = x + L / 2;
  K.part(it, 'box', front, cx, 0.43, 0, L, 0.86, 0.6);
  K.part(it, 'box', 'stone', cx, 0.885, 0.01, L + 0.02, 0.04, 0.63);
  const doors = Math.max(1, Math.round(L / 0.6));
  for (let i = 1; i < doors; i++) K.part(it, 'box', 'black', x + (i * L) / doors, 0.43, 0.301, 0.006, 0.8, 0.004);
  // sink
  const sx = x + Math.min(L * 0.35, L - 0.4);
  K.part(it, 'box', 'steel', sx, 0.905, 0.02, 0.55, 0.012, 0.44);
  K.part(it, 'cyl', 'steel', sx, 1.02, -0.2, 0.03, 0.26, 0.03);
  // cooktop + oven
  if (L > 1.4) {
    const ox = x + L - 0.45;
    K.part(it, 'box', 'black', ox, 0.907, 0.02, 0.58, 0.01, 0.5);
    K.part(it, 'box', 'black', ox, 0.45, 0.302, 0.56, 0.56, 0.006);
    K.part(it, 'box', 'steel', ox, 0.7, 0.32, 0.45, 0.02, 0.02);
  }
  // kettle / bowl
  K.part(it, 'cyl', 'ceramic', x + L * 0.62, 0.97, -0.05, 0.16, 0.14, 0.16);
}

function bathtub(K, it) {
  K.part(it, 'box', 'ceramic', 0, 0.28, 0, it.w, 0.56, it.d);
  K.part(it, 'box', 'water', 0, 0.565, 0, it.w - 0.14, 0.01, it.d - 0.14);
}

function shower(K, it) {
  K.part(it, 'box', 'ceramic', 0, 0.04, 0, it.w, 0.08, it.d);
  K.part(it, 'box', 'glass', 0, 1.0, it.d / 2 - 0.01, it.w, 1.9, 0.01);
  K.part(it, 'box', 'glass', it.w / 2 - 0.01, 1.0, 0, 0.01, 1.9, it.d);
}

function toilet(K, it) {
  K.part(it, 'box', 'ceramic', 0, 0.42, -0.25, 0.38, 0.36, 0.16);
  K.part(it, 'cyl', 'ceramic', 0, 0.2, 0.04, 0.36, 0.4, 0.5);
  K.part(it, 'cyl', 'ceramic', 0, 0.41, 0.05, 0.38, 0.04, 0.48);
}

function vanity(K, it) {
  K.part(it, 'box', 'wood', 0, 0.42, 0, it.w, 0.64, it.d);
  K.part(it, 'box', 'ceramic', 0, 0.8, 0.02, it.w + 0.02, 0.12, it.d + 0.02);
  K.part(it, 'box', 'steel', 0, 0.94, -0.16, 0.04, 0.16, 0.04);
}

function washer(K, it) {
  K.part(it, 'box', 'ceramic', 0, 0.43, 0, 0.6, 0.86, 0.58);
  K.part(it, 'cyl', 'black', 0, 0.42, 0.29, 0.38, 0.02, 0.38, undefined, Math.PI / 2);
  K.part(it, 'box', 'black', 0, 0.78, 0.291, 0.5, 0.08, 0.004);
}

function shoeCabinet(K, it) {
  K.part(it, 'box', 'lacquer', 0, 0.45, 0, it.w, 0.9, it.d);
  K.part(it, 'box', 'wood', 0, 0.91, 0, it.w + 0.02, 0.03, it.d + 0.02);
  K.part(it, 'cyl', 'ceramic', it.w / 2 - 0.2, 1.0, 0, 0.14, 0.16, 0.14);
}

function shelves(K, it, R) {
  K.part(it, 'box', 'woodDark', 0, 0.9, 0, it.w, 1.8, it.d);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    K.part(it, 'box', 'fabric', -it.w / 2 + 0.2 + j * (it.w - 0.4) / 2, 0.25 + i * 0.42, 0.05, 0.25, 0.22, 0.25, pick(R, ['#c9bda6', '#8a8f96', '#6b4f3f', '#e6dccb']));
  }
}

function lounger(K, it, R) {
  const c = pick(R, ['#f2efe9', '#c9bda6', '#3f4f6b']);
  K.part(it, 'box', 'woodDark', 0, 0.2, 0.15, it.w, 0.12, it.d - 0.5);
  K.part(it, 'box', 'fabric', 0, 0.3, 0.15, it.w - 0.04, 0.08, it.d - 0.55, c);
  K.part(it, 'box', 'fabric', 0, 0.55, -it.d / 2 + 0.28, it.w - 0.04, 0.08, 0.6, c, -0.9);
}

function umbrella(K, it) {
  K.part(it, 'cyl', 'black', 0, 0.04, 0, 0.45, 0.08, 0.45);
  K.part(it, 'cyl', 'steel', 0, 1.2, 0, 0.04, 2.3, 0.04);
  K.part(it, 'cone', 'linen', 0, 2.25, 0, 2.6, 0.45, 2.6);
}

function shopRack(K, it, R) {
  K.part(it, 'box', 'steel', 0, 1.45, 0, it.w, 0.03, 0.03);
  K.part(it, 'box', 'steel', -it.w / 2, 0.73, 0, 0.03, 1.46, 0.03);
  K.part(it, 'box', 'steel', it.w / 2, 0.73, 0, 0.03, 1.46, 0.03);
  const n = Math.floor(it.w / 0.1);
  for (let i = 0; i < n; i++) K.part(it, 'box', 'fabric', -it.w / 2 + 0.08 + i * (it.w - 0.16) / n, 1.05, 0, 0.05, 0.75, 0.42, pick(R, FABRICS.concat(['#f2efe9', '#e8d6b0'])));
}

// ---------------------------------------------------------------- room layouts
function layBedroom(F, K, R, M_) {
  const win = windowSide(F);
  const order = [opposite(win.id), (win.id + 1) % 4, (win.id + 3) % 4, win.id];
  let bedItem = null, bedSide = null;
  for (const single of [false, true]) {
    const bw = single ? 0.95 : 1.65, bl = 2.08;
    for (const sid of order) {
      const s = F.sides[sid];
      if (s.wall < 0.35) continue;
      const depthAvail = (sid % 2 === 0) ? F.D : F.W;
      if (depthAvail < bl + 0.6) continue;
      bedItem = placeAgainst(F, sid, bw + 1.0, bl, { pref: 0.5 });   // reserve space for nightstands
      if (bedItem) { bedItem.w = bw; bedSide = sid; bedItem.single = single; break; }
    }
    if (bedItem) break;
  }
  if (bedItem) {
    rug(K, { ...bedItem, w: bedItem.w + 0.9, d: 1.6, x: bedItem.x + bedItem.fw[0] * 0.55, y: bedItem.y + bedItem.fw[1] * 0.55 }, R, M_);
    bed(K, bedItem, R, bedItem.single);
    for (const sgn of [-1, 1]) {
      const ns = { ...bedItem, x: bedItem.x + bedItem.ax[0] * sgn * (bedItem.w / 2 + 0.27) - bedItem.fw[0] * (bedItem.d / 2 - 0.2), y: bedItem.y + bedItem.ax[1] * sgn * (bedItem.w / 2 + 0.27) - bedItem.fw[1] * (bedItem.d / 2 - 0.2) };
      nightstand(K, ns);
    }
  }
  // wardrobe along another wall
  const cand = [0, 1, 2, 3].filter((s) => s !== bedSide && F.sides[s].ext < 0.3).sort((a, b) => F.sides[b].wall - F.sides[a].wall);
  for (const sid of cand) {
    const len = Math.min(2.2, F.sides[sid].len - 0.5);
    if (len < 1.0) continue;
    const it = placeAgainst(F, sid, len, 0.6, { pref: 0.75, tall: true });
    if (it) { wardrobe(K, it); break; }
  }
  // desk by the window
  if (F.W * F.D > 11) {
    const it = placeAgainst(F, win.id, 1.1, 0.55, { pref: 0.25 });
    if (it) {
      K.part(it, 'box', 'wood', 0, 0.74, 0, 1.1, 0.04, 0.55);
      K.part(it, 'box', 'lacquer', -0.45, 0.36, 0, 0.4, 0.72, 0.5);
      K.part(it, 'box', 'black', 0.46, 0.36, 0, 0.04, 0.72, 0.5);
      K.part(it, 'box', 'black', 0.1, 0.95, -0.15, 0.5, 0.33, 0.02);
      const ch = placeFree(F, it.x + it.fw[0] * 0.6, it.y + it.fw[1] * 0.6, [-it.fw[0], -it.fw[1]], 0.48, 0.48);
      if (ch) { K.part(ch, 'box', 'fabric', 0, 0.47, 0, 0.46, 0.08, 0.46, '#2f3338'); K.part(ch, 'box', 'fabric', 0, 0.78, -0.21, 0.46, 0.55, 0.06, '#2f3338'); K.part(ch, 'cyl', 'black', 0, 0.22, 0, 0.05, 0.44, 0.05); }
    }
  }
  corners(F, K, R, 1);
}

function corners(F, K, R, n) {
  // plants in free corners
  const cs = [[F.x0 + 0.3, F.y0 + 0.3], [F.x1 - 0.3, F.y0 + 0.3], [F.x1 - 0.3, F.y1 - 0.3], [F.x0 + 0.3, F.y1 - 0.3]];
  let placed = 0;
  for (const [x, y] of cs.sort(() => R() - 0.5)) {
    if (placed >= n) break;
    const it = placeFree(F, x, y, [0, 1], 0.45, 0.45);
    if (it) { plant(K, it, R); placed++; }
  }
}

function layLiving(F, K, R, M_) {
  const win = windowSide(F);
  // TV wall: best interior wall that is not the window wall
  const walls = [0, 1, 2, 3].filter((s) => s !== win.id).sort((a, b) => (F.sides[b].wall - F.sides[b].ext) - (F.sides[a].wall - F.sides[a].ext));
  let done = false;
  const big = F.W * F.D > 25;
  for (const tvSide of walls) {
    const s = F.sides[tvSide];
    const depth = tvSide % 2 === 0 ? F.D : F.W;
    if (depth < 2.9 || s.len < 2.2) continue;
    const zoneLen = big ? Math.min(s.len, Math.max(3.6, s.len * 0.55)) : s.len;
    const pref = big ? (zoneLen / 2) / s.len : 0.5;
    const tv = placeAgainst(F, tvSide, Math.min(1.9, s.len - 0.6), 0.42, { pref });
    if (!tv) continue;
    tvUnit(K, tv);
    const viewD = Math.min(depth - 1.1, 3.2);
    const sw = Math.min(2.4, s.len - 0.9);
    // sofa facing tv
    const sx = tv.x + tv.fw[0] * (viewD + 0.21), sy = tv.y + tv.fw[1] * (viewD + 0.21);
    const sof = placeFree(F, sx, sy, [-tv.fw[0], -tv.fw[1]], sw, 0.95);
    if (sof) sofa(K, sof, R);
    const color = pick(R, FABRICS);
    const ctx = tv.x + tv.fw[0] * (viewD * 0.55 + 0.2), cty = tv.y + tv.fw[1] * (viewD * 0.55 + 0.2);
    rug(K, makeItem(ctx, cty, tv.fw, Math.min(sw + 0.6, s.len - 0.3), Math.min(viewD + 0.4, 2.6)), R, M_);
    const ct = placeFree(F, ctx, cty, tv.fw, 1.1, 0.6);
    if (ct) coffeeTable(K, ct);
    // armchairs at the sides
    for (const sgn of [-1, 1]) {
      const ax = ctx + tv.ax[0] * sgn * (sw / 2 + 0.25), ay = cty + tv.ax[1] * sgn * (sw / 2 + 0.25);
      const ac = placeFree(F, ax, ay, [-tv.ax[0] * sgn, -tv.ax[1] * sgn], 0.85, 0.85);
      if (ac) sofa(K, ac, R, color);
    }
    const fl = placeFree(F, sx + tv.ax[0] * (sw / 2 + 0.3), sy + tv.ax[1] * (sw / 2 + 0.3), tv.fw, 0.35, 0.35);
    if (fl) floorLamp(K, fl);
    done = true;
    break;
  }
  if (big || !done) {
    // dining zone (dasturxon / mehmon stoli) in remaining space
    const tw = Math.min(2.2, Math.max(F.W, F.D) * 0.4), td = 0.95;
    const horiz = F.W >= F.D;
    const tries = [];
    for (let k = 0; k < 9; k++) {
      const fx = 0.2 + (k % 3) * 0.3, fy = 0.2 + Math.floor(k / 3) * 0.3;
      tries.push([F.x0 + F.W * fx, F.y0 + F.D * fy]);
    }
    for (const [x, y] of tries) {
      const fw = horiz ? [0, 1] : [1, 0];
      const pad = placeFree(F, x, y, fw, tw + 1.1, td + 1.1);
      if (!pad) continue;
      F.occ.pop();
      const t = makeItem(x, y, fw, tw, td);
      F.occ.push([x - (horiz ? tw : td) / 2 - 0.5, y - (horiz ? td : tw) / 2 - 0.5, x + (horiz ? tw : td) / 2 + 0.5, y + (horiz ? td : tw) / 2 + 0.5]);
      rug(K, makeItem(x, y, fw, tw + 1.4, td + 1.5), R, M_);
      table(K, t, R);
      chairs(K, F, t, tw > 1.8 ? 8 : 6, R);
      break;
    }
  }
  corners(F, K, R, 2);
}

function layKitchen(F, K, R) {
  const win = windowSide(F);
  const cands = [0, 1, 2, 3].filter((s) => s !== win.id).sort((a, b) => (F.sides[b].len * F.sides[b].wall) - (F.sides[a].len * F.sides[a].wall));
  let run = null;
  for (const sid of cands) {
    const len = Math.min(F.sides[sid].len - 0.1, 3.8);
    if (len < 1.4) continue;
    for (const L of [len, len - 0.6, len - 1.2]) {
      if (L < 1.4) break;
      run = placeAgainst(F, sid, L, 0.62, { pref: 0.5 });
      if (run) { kitchenRun(K, run, R, L >= 2.2); break; }
    }
    if (run) break;
  }
  // dining table
  const fwd = run ? run.fw : [0, 1];
  const cx = run ? run.x + run.fw[0] * 0.62 : (F.x0 + F.x1) / 2;
  const cy = run ? run.y + run.fw[1] * 0.62 : (F.y0 + F.y1) / 2;
  const depthLeft = run ? ((Math.abs(run.fw[1]) > 0.5 ? F.D : F.W) - 0.62) : Math.min(F.W, F.D);
  if (depthLeft > 2.1) {
    const d = Math.min(1.6, depthLeft - 0.4);
    const x = cx + fwd[0] * (d + 0.25), y = cy + fwd[1] * (d + 0.25);
    const w = Math.min(1.4, (Math.abs(fwd[1]) > 0.5 ? F.W : F.D) - 1.3);
    if (w >= 0.8) {
      const t = placeFree(F, x, y, fwd, w, 0.8);
      if (t) { table(K, t, R); chairs(K, F, t, w > 1.15 ? 6 : 4, R); }
    }
  }
  corners(F, K, R, 1);
}

function layBath(F, K, R, wcOnly) {
  const sides = wallSides(F);
  if (!wcOnly) {
    let placed = false;
    for (const s of sides) {
      if (s.len >= 1.55 && (s.id % 2 === 0 ? F.D : F.W) >= 1.3) {
        const L = Math.min(1.7, s.len - 0.05);
        const it = placeAgainst(F, s.id, L, 0.75, { pref: 0.0, allowDoor: false });
        if (it) { bathtub(K, it); placed = true; break; }
      }
    }
    if (!placed) for (const s of sides) {
      const it = placeAgainst(F, s.id, 0.9, 0.9, { pref: 0 });
      if (it) { shower(K, it); break; }
    }
  }
  for (const s of sides) { const it = placeAgainst(F, s.id, 0.42, 0.68, { pref: 1 }); if (it) { toilet(K, it); break; } }
  for (const s of sides) { const it = placeAgainst(F, s.id, wcOnly ? 0.45 : 0.62, 0.46, { pref: 0.5 }); if (it) { vanity(K, { ...it }); break; } }
  if (!wcOnly && F.W * F.D > 3.6) for (const s of sides) { const it = placeAgainst(F, s.id, 0.6, 0.6, { pref: 0.5 }); if (it) { washer(K, it); break; } }
}

function layHall(F, K, R, M_) {
  const sides = wallSides(F);
  for (const s of sides) {
    const w = Math.min(1.2, s.len - 0.3);
    if (w < 0.7) continue;
    const it = placeAgainst(F, s.id, w, 0.36, { pref: 0.5 });
    if (it) { shoeCabinet(K, it); break; }
  }
  const horiz = F.W >= F.D;
  const L = Math.min(Math.max(F.W, F.D) - 0.6, 3.2);
  if (L > 1.2) {
    const cx = (F.x0 + F.x1) / 2, cy = (F.y0 + F.y1) / 2;
    rug(K, makeItem(cx, cy, horiz ? [0, 1] : [1, 0], L, Math.min(Math.min(F.W, F.D) - 0.5, 0.9)), R, M_);
  }
  corners(F, K, R, 1);
}

function layBalcony(F, K, R) {
  if (F.W * F.D < 1.8 || Math.min(F.W, F.D) < 0.9) { corners(F, K, R, 1); return; }
  const cx = (F.x0 + F.x1) / 2, cy = (F.y0 + F.y1) / 2;
  const t = placeFree(F, cx, cy, [0, 1], 0.6, 0.6);
  if (t) {
    table(K, t, R, true);
    const horiz = F.W >= F.D;
    for (const sgn of [-1, 1]) {
      const x = cx + (horiz ? sgn * 0.6 : 0), y = cy + (horiz ? 0 : sgn * 0.6);
      const ch = placeFree(F, x, y, horiz ? [-sgn, 0] : [0, -sgn], 0.45, 0.45);
      if (ch) { K.part(ch, 'box', 'woodDark', 0, 0.44, 0, 0.44, 0.05, 0.44); K.part(ch, 'box', 'woodDark', 0, 0.72, -0.2, 0.44, 0.5, 0.04); for (const sx of [-1, 1]) K.part(ch, 'box', 'black', sx * 0.2, 0.22, 0, 0.03, 0.44, 0.4); }
    }
  }
  corners(F, K, R, 2);
}

function layTerrace(F, K, R) {
  const horiz = F.W >= F.D;
  const cx = (F.x0 + F.x1) / 2, cy = (F.y0 + F.y1) / 2;
  if (Math.min(F.W, F.D) >= 1.6) {
    for (const k of [-1, 1]) {
      const x = cx + (horiz ? k * 0.75 : 0), y = cy + (horiz ? 0 : k * 0.75);
      const it = placeFree(F, x, y, horiz ? [0, 1] : [1, 0], 0.7, 1.9);
      if (it) lounger(K, it, R);
    }
    const u = placeFree(F, cx + (horiz ? 2.0 : 0), cy + (horiz ? 0 : 2.0), [0, 1], 0.6, 0.6);
    if (u) { umbrella(K, u); table(K, { ...u, w: 0.55 }, R, true); }
  }
  corners(F, K, R, 4);
}

function layStorage(F, K, R) {
  for (const s of wallSides(F)) {
    const it = placeAgainst(F, s.id, Math.min(1.4, s.len - 0.2), 0.45, { pref: 0.5, tall: true });
    if (it) { shelves(K, it, R); break; }
  }
}

function layShop(F, K, R) {
  // clothing racks in rows + display tables + cash desk
  const horiz = F.W >= F.D;
  const along = horiz ? F.W : F.D, across = horiz ? F.D : F.W;
  const rows = Math.max(1, Math.floor((across - 2.2) / 2.4));
  for (let i = 0; i < rows; i++) {
    const off = -across / 2 + 1.6 + i * 2.4;
    for (let j = 0; j < Math.floor((along - 2.4) / 2.2); j++) {
      const u = -along / 2 + 1.6 + j * 2.2;
      const cx = (F.x0 + F.x1) / 2 + (horiz ? u : off), cy = (F.y0 + F.y1) / 2 + (horiz ? off : u);
      const it = placeFree(F, cx, cy, horiz ? [0, 1] : [1, 0], 1.6, 0.5);
      if (it) shopRack(K, it, R);
    }
  }
  for (const s of wallSides(F)) {
    const it = placeAgainst(F, s.id, 2.2, 0.7, { pref: 0.2 });
    if (it) { K.part(it, 'box', 'lacquer', 0, 0.5, 0, 2.2, 1.0, 0.7); K.part(it, 'box', 'stone', 0, 1.02, 0, 2.24, 0.04, 0.74); K.part(it, 'box', 'black', 0.5, 1.2, 0, 0.4, 0.3, 0.05); break; }
  }
  for (const s of wallSides(F).slice(0, 2)) {
    const it = placeAgainst(F, s.id, Math.min(4, s.len - 1), 0.45, { pref: 0.6, tall: true });
    if (it) shelves(K, it, R);
  }
  corners(F, K, R, 4);
}

// ---------------------------------------------------------------- public
const FLOOR_MAT = { living: 'parquet', bedroom: 'parquet', hall: 'parquet', storage: 'parquet', other: 'parquet', kitchen: 'tile', bath: 'bathTile', wc: 'bathTile', balcony: 'tile', terrace: 'deck' };

export function buildFurnishing(fd, base) {
  const M_ = materials();
  const K = new Kit(base);
  const finishes = new Map();
  const addFinish = (mat, poly) => { if (!finishes.has(mat)) finishes.set(mat, []); finishes.get(mat).push({ o: poly, h: [] }); };

  fd.apartments.forEach((a, ai) => {
    const R = rng(fd.floor * 1000 + ai * 37 + 11);
    if (a.commercial || !a.rg || !a.rg.length) {
      a.polys.forEach((p) => addFinish(a.commercial ? 'shopTile' : 'parquet', p));
      if (a.commercial) {
        // whole unit as one rectangle (bounding box of the largest polygon, shrunk)
        const p = a.polys[0];
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        p.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
        const room = { r: [x0 + 0.6, y0 + 0.6, x1 - 0.6, y1 - 0.6], s: [[1, 0, []], [1, 0, []], [1, 0, []], [1, 0, []]] };
        const F = frame(room);
        layShop(F, K, R);
      }
      return;
    }
    const covered = [];
    for (const room of a.rg) {
      addFinish(FLOOR_MAT[room.n] || 'parquet', room.poly);
      covered.push(room);
      const F = frame(room);
      if (F.W < 0.6 || F.D < 0.6) continue;
      keepOuts(F);
      switch (room.n) {
        case 'bedroom': layBedroom(F, K, R, M_); break;
        case 'living': layLiving(F, K, R, M_); break;
        case 'kitchen': layKitchen(F, K, R); break;
        case 'bath': layBath(F, K, R, false); break;
        case 'wc': layBath(F, K, R, true); break;
        case 'hall': layHall(F, K, R, M_); break;
        case 'balcony': layBalcony(F, K, R); break;
        case 'terrace': layTerrace(F, K, R); break;
        case 'storage': layStorage(F, K, R); break;
        default: break;
      }
    }
  });

  const g = new THREE.Group();
  g.name = 'furnishing';
  for (const [mat, polys] of finishes) {
    const m = new THREE.Mesh(flatPolys(polys, base + 0.008), M_[mat]);
    m.receiveShadow = true;
    g.add(m);
  }
  g.add(K.build());
  return g;
}

/** night factor -> lamp shades and TV screens glow */
export function setFurnishingNight(night) {
  const M_ = materials();
  M_.shade.emissiveIntensity = 0.15 + 2.4 * night;
  M_.screen.emissiveIntensity = 0.05 + 0.35 * night;
}
