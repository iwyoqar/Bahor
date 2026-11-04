// Bino: rejalardan olingan kontur bo'yicha protsedural neoklassik fasad.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG, floorBase, floorHeight } from './config.js';
import * as TX from './textures.js';

// building-plan coordinates (X along axes 1→18, Y along А→Л) are centred here
export const CX = 35.68;
export const CY = 21.5;

export function toWorld(X, Y, h = 0) {
  return new THREE.Vector3(X - CX, h, -(Y - CY));
}

// ---------------------------------------------------------------- helpers
function signedArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPoly(x, y, poly) {
  if (!pointInRing(x, y, poly.o)) return false;
  for (const h of poly.h || []) if (pointInRing(x, y, h)) return false;
  return true;
}

function hash(a, b, c = 0) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function shapeFrom(poly) {
  const s = new THREE.Shape(poly.o.map(([x, y]) => new THREE.Vector2(x - CX, y - CY)));
  for (const h of poly.h || []) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x - CX, y - CY))));
  return s;
}

/** extrude plan polygons (with holes) vertically from z0 by height */
export function extrudePolys(polys, z0, height) {
  const shapes = polys.map(shapeFrom);
  const g = new THREE.ExtrudeGeometry(shapes, { depth: height, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, z0, 0);
  return g;
}

export function flatPolys(polys, z) {
  const g = new THREE.ShapeGeometry(polys.map(shapeFrom));
  g.rotateX(-Math.PI / 2);
  g.translate(0, z, 0);
  return g;
}

/** Non-indexed triangle soup builder with uv (+ optional extra vec3 attribute) */
class GB {
  constructor(extra = false) { this.p = []; this.uv = []; this.ex = extra ? [] : null; }
  tri(a, b, c, ua, ub, uc, e) {
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    if (this.ex) for (let i = 0; i < 3; i++) this.ex.push(e[0], e[1], e[2]);
  }
  quad(a, b, c, d, ua, ub, uc, ud, nExp, e) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.dot(nExp) < 0) { this.tri(a, c, b, ua, uc, ub, e); this.tri(a, d, c, ua, ud, uc, e); return; }
    this.tri(a, b, c, ua, ub, uc, e); this.tri(a, c, d, ua, uc, ud, e);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.ex) g.setAttribute('aWin', new THREE.Float32BufferAttribute(this.ex, 3));
    g.computeVertexNormals();
    return g;
  }
  get empty() { return this.p.length === 0; }
}

function boxAt(list, center, size, dirX, normal) {
  // oriented box: x along wall (dirX), y up, z along outward normal
  const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const m = new THREE.Matrix4().makeBasis(dirX, new THREE.Vector3(0, 1, 0), normal);
  m.setPosition(center);
  g.applyMatrix4(m);
  list.push(g.toNonIndexed());
}

function mergeOrNull(list) {
  if (!list.length) return null;
  const g = mergeGeometries(list, false);
  list.forEach((x) => x.dispose());
  return g;
}

// ---------------------------------------------------------------- materials
export function createMaterials(clipPlane) {
  const clipping = [clipPlane];
  const plasterTex = TX.plasterTexture();
  const stoneTex = TX.stoneTexture();
  const night = { value: 0 };     // fraction of windows lit (0..1)
  const winIntensity = { value: 0 };
  const uplight = { value: 0 };

  const plaster = new THREE.MeshStandardMaterial({ color: 0xe4dfd4, map: plasterTex, roughness: 0.9, metalness: 0 });
  plaster.onBeforeCompile = (sh) => {
    sh.uniforms.uUplight = uplight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWY;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWY = (modelMatrix * vec4(transformed,1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uUplight;\nvarying float vWY;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float up = uUplight * (exp(-max(vWY - 0.4, 0.0) / 4.5) * 0.9 + 0.05);
        totalEmissiveRadiance += vec3(1.0, 0.78, 0.52) * up * diffuseColor.rgb;`);
  };
  const stone = new THREE.MeshStandardMaterial({ color: 0xffffff, map: stoneTex, roughness: 0.72 });
  stone.onBeforeCompile = plaster.onBeforeCompile;
  const trim = new THREE.MeshStandardMaterial({ color: 0xf0ede6, roughness: 0.62 });
  trim.onBeforeCompile = plaster.onBeforeCompile;
  const frame = new THREE.MeshStandardMaterial({ color: 0x2b2f34, roughness: 0.42, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x18222d, roughness: 0.07, metalness: 0.92, envMapIntensity: 0.9 });
  glass.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = night;
    sh.uniforms.uWin = winIntensity;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aWin;\nvarying vec3 vWin;\nvarying vec2 vGUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvWin = aWin; vGUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nuniform float uWin;\nvarying vec3 vWin;\nvarying vec2 vGUv;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float on = step(vWin.x, uNight);
        vec3 warm = mix(vec3(1.0, 0.66, 0.36), vec3(1.0, 0.86, 0.66), vWin.y);
        float grad = 0.45 + 0.55 * smoothstep(0.05, 0.95, vGUv.y);
        float curtain = mix(0.45, 1.0, vWin.z);
        float frameMask = smoothstep(0.0, 0.04, vGUv.x) * smoothstep(1.0, 0.96, vGUv.x);
        totalEmissiveRadiance += warm * on * grad * curtain * frameMask * uWin;`);
  };
  const railing = new THREE.MeshStandardMaterial({ map: TX.railingTexture(), color: 0xffffff, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.6 });
  const roof = new THREE.MeshStandardMaterial({ map: TX.roofTexture(), color: 0xc9cacc, roughness: 0.95 });
  const tile = new THREE.MeshStandardMaterial({ map: TX.tileTexture(), color: 0xffffff, roughness: 0.78 });
  const solar = new THREE.MeshStandardMaterial({ color: 0x14213a, roughness: 0.18, metalness: 0.6, envMapIntensity: 1.4 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.8 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x8f8778, roughness: 0.8, map: stoneTex });
  const all = { plaster, stone, trim, frame, glass, railing, roof, tile, solar, metal, darkStone };
  for (const m of Object.values(all)) { m.clippingPlanes = clipping; m.clipShadows = true; }
  return { ...all, uniforms: { night, winIntensity, uplight } };
}

// ---------------------------------------------------------------- facade
const REVEAL = 0.24;

function facadeForFloor(fl, data, mats, out) {
  const base = floorBase(fl);
  const H = floorHeight(fl);
  const ground = fl === 1;
  const commercialPolys = ground ? data.apartments.filter((a) => a.commercial).map((a) => ({ o: a.polys[0], h: [] })) : [];
  const wall = new GB(); const glass = new GB(true); const rail = new GB();
  const trims = []; const frames = [];
  let uAcc = 0;
  let edgeId = 0;

  for (const poly of data.mass) {
    const rings = [poly.o, ...(poly.h || [])];
    rings.forEach((ringIn, ri) => {
      let ring = ringIn.slice();
      const ccw = signedArea(ring) > 0;
      if ((ri === 0 && !ccw) || (ri > 0 && ccw)) ring.reverse();
      const n = ring.length;
      for (let i = 0; i < n; i++) {
        const A = ring[i], B = ring[(i + 1) % n];
        const dx = B[0] - A[0], dy = B[1] - A[1];
        const L = Math.hypot(dx, dy);
        edgeId++;
        if (L < 0.02) continue;
        const tX = dx / L, tY = dy / L;
        const nX = tY, nY = -tX;                       // outward (right-hand) normal in plan
        const nW = new THREE.Vector3(nX, 0, -nY);       // outward normal in world
        const tW = new THREE.Vector3(tX, 0, -tY);
        const P = (u, h, d = 0) => toWorld(A[0] + tX * u - nX * d, A[1] + tY * u - nY * d, base + h);
        const uvW = (u, h) => ground ? [(uAcc + u) / 2.4, h / 1.2] : [(uAcc + u) / 4, h / 4];

        // ----- window layout
        const midX = A[0] + dx / 2 + nX * 0.6, midY = A[1] + dy / 2 + nY * 0.6;
        const shop = ground && commercialPolys.some((p) => pointInRing(midX - nX * 1.2, midY - nY * 1.2, p.o));
        const bay = ground ? 3.5 : 3.2;
        let count = Math.floor(L / bay);
        if (count === 0 && L >= 1.9) count = 1;
        const spacing = count ? L / count : L;
        let ww = ground ? (shop ? 2.3 : 1.55) : 1.4;
        ww = Math.min(ww, spacing - 0.75);
        const wins = [];
        if (ww >= 0.7) {
          for (let k = 0; k < count; k++) {
            const c = (k + 0.5) * spacing;
            const french = !ground && hash(edgeId, k, 7) < 0.42 && ww >= 1.0;
            const sill = ground ? (shop ? 0.35 : 0.95) : french ? 0.1 : 0.62;
            const head = ground ? (shop ? 3.05 : 2.85) : 2.62;
            wins.push({ u0: c - ww / 2, u1: c + ww / 2, s: sill, t: head, french, shop, k });
          }
        }

        // ----- wall surface with openings
        let u = 0;
        const addWall = (u0, u1, h0, h1) => {
          if (u1 - u0 < 1e-3 || h1 - h0 < 1e-3) return;
          wall.quad(P(u0, h0), P(u1, h0), P(u1, h1), P(u0, h1), uvW(u0, h0), uvW(u1, h0), uvW(u1, h1), uvW(u0, h1), nW);
        };
        for (const w of wins) {
          addWall(u, w.u0, 0, H);
          addWall(w.u0, w.u1, 0, w.s);
          addWall(w.u0, w.u1, w.t, H);
          u = w.u1;
          // reveals
          const d = REVEAL;
          wall.quad(P(w.u0, w.s, 0), P(w.u0, w.s, d), P(w.u0, w.t, d), P(w.u0, w.t, 0), [0, 0], [d, 0], [d, 1], [0, 1], tW.clone());
          wall.quad(P(w.u1, w.s, 0), P(w.u1, w.s, d), P(w.u1, w.t, d), P(w.u1, w.t, 0), [0, 0], [d, 0], [d, 1], [0, 1], tW.clone().negate());
          wall.quad(P(w.u0, w.s, 0), P(w.u1, w.s, 0), P(w.u1, w.s, d), P(w.u0, w.s, d), [0, 0], [1, 0], [1, d], [0, d], new THREE.Vector3(0, 1, 0));
          wall.quad(P(w.u0, w.t, 0), P(w.u1, w.t, 0), P(w.u1, w.t, d), P(w.u0, w.t, d), [0, 0], [1, 0], [1, d], [0, d], new THREE.Vector3(0, -1, 0));
          // glass
          const lit = w.shop ? 0.02 : hash(fl, edgeId, w.k) * 0.98 + 0.02;
          const tint = hash(edgeId, w.k, fl + 3);
          const curtain = w.shop ? 1 : hash(w.k, fl, edgeId + 11);
          const gd = d - 0.03;
          glass.quad(P(w.u0, w.s, gd), P(w.u1, w.s, gd), P(w.u1, w.t, gd), P(w.u0, w.t, gd), [0, 0], [1, 0], [1, 1], [0, 1], nW, [lit, tint, curtain]);
          // frame & mullions (just in front of glass)
          const fd = gd - 0.03;
          const wc = (w.u0 + w.u1) / 2, wwid = w.u1 - w.u0, hh = w.t - w.s;
          const fz = (uu, h) => P(uu, h, fd);
          boxAt(frames, fz(wc, w.s + 0.03), [wwid, 0.06, 0.06], tW, nW);
          boxAt(frames, fz(wc, w.t - 0.03), [wwid, 0.06, 0.06], tW, nW);
          boxAt(frames, fz(w.u0 + 0.03, w.s + hh / 2), [0.06, hh, 0.06], tW, nW);
          boxAt(frames, fz(w.u1 - 0.03, w.s + hh / 2), [0.06, hh, 0.06], tW, nW);
          if (wwid > 1.05) boxAt(frames, fz(wc, w.s + hh / 2), [0.05, hh, 0.05], tW, nW);
          if (!w.french || ground) boxAt(frames, fz(wc, w.s + hh * 0.72), [wwid, 0.05, 0.05], tW, nW);
          // exterior trim: sill, architrave, hood
          boxAt(trims, P(wc, w.s - 0.04, -0.06), [wwid + 0.22, 0.08, 0.14], tW, nW);
          boxAt(trims, P(w.u0 - 0.06, w.s + hh / 2, -0.025), [0.12, hh + 0.04, 0.05], tW, nW);
          boxAt(trims, P(w.u1 + 0.06, w.s + hh / 2, -0.025), [0.12, hh + 0.04, 0.05], tW, nW);
          if (ground) {
            // arch-like rusticated keystone header + archivolt band
            boxAt(trims, P(wc, w.t + 0.12, -0.04), [wwid + 0.4, 0.24, 0.08], tW, nW);
            boxAt(trims, P(wc, w.t + 0.32, -0.06), [0.34, 0.42, 0.12], tW, nW);
          } else {
            boxAt(trims, P(wc, w.t + 0.08, -0.03), [wwid + 0.24, 0.16, 0.06], tW, nW);
            boxAt(trims, P(wc, w.t + 0.2, -0.07), [wwid + 0.42, 0.08, 0.14], tW, nW);
          }
          if (w.french) {
            const rw = wwid + 0.16, rh = 0.98, ro = -0.16;
            rail.quad(P(w.u0 - 0.08, 0.1, ro), P(w.u1 + 0.08, 0.1, ro), P(w.u1 + 0.08, 0.1 + rh, ro), P(w.u0 - 0.08, 0.1 + rh, ro),
              [0, 0], [rw * 2, 0], [rw * 2, 1], [0, 1], nW);
            boxAt(trims, P(wc, 0.06, -0.12), [wwid + 0.3, 0.1, 0.26], tW, nW);
          }
        }
        addWall(u, L, 0, H);

        // ----- pilasters between bays (upper floors) and at corners
        if (!ground && L > 2.2) {
          for (let k = 1; k < count; k++) {
            boxAt(trims, P(k * spacing, H / 2, -0.04), [0.42, H, 0.08], tW, nW);
          }
        }
        if (L > 1.2) {
          boxAt(trims, P(0.22, H / 2, -0.045), [0.44, H, 0.09], tW, nW);
          boxAt(trims, P(L - 0.22, H / 2, -0.045), [0.44, H, 0.09], tW, nW);
        }
        uAcc += L;
      }
    });
  }

  const meshes = [];
  const add = (geom, mat, cast = true) => {
    if (!geom) return;
    const m = new THREE.Mesh(geom, mat);
    m.castShadow = cast; m.receiveShadow = true;
    meshes.push(m);
  };
  add(wall.build(), ground ? mats.stone : mats.plaster);
  if (!glass.empty) add(glass.build(), mats.glass, false);
  if (!rail.empty) add(rail.build(), mats.railing);
  add(mergeOrNull(frames), mats.frame, false);
  add(mergeOrNull(trims), ground ? mats.trim : mats.trim);
  meshes.forEach((m) => out.add(m));
}

// ---------------------------------------------------------------- whole building
export function buildBuilding(floorsData, mats) {
  const root = new THREE.Group();
  root.name = 'building';
  const floorGroups = [];
  const hitMeshes = [];
  const hitMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const n = floorsData.length;

  for (let i = 0; i < n; i++) {
    const fd = floorsData[i];
    const fl = fd.floor;
    const g = new THREE.Group();
    g.name = 'floor-' + fl;
    g.userData.floor = fl;
    facadeForFloor(fl, fd, mats, g);
    const base = floorBase(fl), H = floorHeight(fl);
    const top = base + H;

    // belt course at top of each floor (podium cornice on floor 1)
    if (fd.belt.length) {
      const bh = fl === 1 ? 0.55 : 0.2;
      const m = new THREE.Mesh(extrudePolys(fd.belt, top - bh + (fl === 1 ? 0.12 : 0), bh), mats.trim);
      m.castShadow = true; m.receiveShadow = true; g.add(m);
      if (fl === 1) {
        // plinth under the whole building
        const pl = new THREE.Mesh(extrudePolys(fd.belt.map((p) => ({ o: p.o, h: [] })), 0, CONFIG.plinth), mats.darkStone);
        pl.receiveShadow = true; pl.castShadow = true; root.add(pl);
      }
    }
    // roofs over parts not covered by the floor above
    if (fd.roof.length) {
      const r = new THREE.Mesh(extrudePolys(fd.roof, top - 0.25, 0.25), mats.roof);
      r.receiveShadow = true; r.castShadow = true; g.add(r);
      if (fd.crown.length) {
        const c = new THREE.Mesh(extrudePolys(fd.crown, top - 0.62, 0.66), mats.trim);
        c.castShadow = true; c.receiveShadow = true; g.add(c);
        const c2 = new THREE.Mesh(extrudePolys(fd.crown, top - 0.9, 0.2), mats.trim);
        c2.scale.set(1, 1, 1); g.add(c2);
      }
      if (fd.parapet.length) {
        const p = new THREE.Mesh(extrudePolys(fd.parapet, top, 1.0), mats.plaster);
        p.castShadow = true; p.receiveShadow = true; g.add(p);
        const cap = new THREE.Mesh(extrudePolys(fd.parapet, top + 1.0, 0.09), mats.trim);
        g.add(cap);
      }
      addRoofEquipment(fd, floorsData[i + 1], top, mats, g);
    }

    // invisible hit volume for picking
    const hit = new THREE.Mesh(extrudePolys(fd.mass, base, H), hitMat);
    hit.userData.floor = fl;
    hitMeshes.push(hit);
    g.userData.hit = hit;
    g.userData.base = base; g.userData.height = H;
    root.add(g); root.add(hit);
    floorGroups.push(g);
  }

  addEntranceSign(floorsData[0], root, mats);
  return { root, floorGroups, hitMeshes };
}

function polyBBox(ring) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of ring) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
}

function addRoofEquipment(fd, above, top, mats, g) {
  // penthouses (stair / lift machine rooms) with red hip roofs on cores not covered above
  const pent = [];
  for (const core of fd.cores) {
    const b = polyBBox(core);
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const coveredAbove = above && above.mass.some((p) => pointInPoly(cx, cy, p));
    if (coveredAbove) continue;
    const onRoof = fd.roof.some((p) => pointInPoly(cx, cy, p));
    if (!onRoof) continue;
    const w = Math.min(b.x1 - b.x0, 9), d = Math.min(b.y1 - b.y0, 8);
    const box = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - d / 2, y1: cy + d / 2 };
    pent.push(box);
    const ring = [[box.x0, box.y0], [box.x1, box.y0], [box.x1, box.y1], [box.x0, box.y1]];
    const m = new THREE.Mesh(extrudePolys([{ o: ring, h: [] }], top, 3.0), mats.plaster);
    m.castShadow = true; m.receiveShadow = true; g.add(m);
    const cor = new THREE.Mesh(extrudePolys([{ o: [[box.x0 - 0.25, box.y0 - 0.25], [box.x1 + 0.25, box.y0 - 0.25], [box.x1 + 0.25, box.y1 + 0.25], [box.x0 - 0.25, box.y1 + 0.25]], h: [] }], top + 2.85, 0.3), mats.trim);
    cor.castShadow = true; g.add(cor);
    // hip roof
    const cone = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1, false, Math.PI / 4);
    cone.scale(w + 0.7, 2.2, d + 0.7);
    const roofM = new THREE.Mesh(cone, mats.tile);
    const c = toWorld(cx, cy, top + 3.15 + 1.1);
    roofM.position.copy(c);
    roofM.castShadow = true; g.add(roofM);
    // small window strip on the penthouse front
  }
  // solar panel field
  const panels = [];
  const PW = 1.7, PD = 1.05;
  for (const r of fd.roof) {
    const b = polyBBox(r.o);
    for (let y = b.y0 + 1.6; y < b.y1 - 1.6; y += 2.3) {
      for (let x = b.x0 + 1.4; x < b.x1 - 1.4; x += PW + 0.08) {
        const corners = [[x - PW / 2 - 0.6, y - PD / 2 - 0.6], [x + PW / 2 + 0.6, y - PD / 2 - 0.6], [x + PW / 2 + 0.6, y + PD / 2 + 0.6], [x - PW / 2 - 0.6, y + PD / 2 + 0.6]];
        if (!corners.every(([px, py]) => pointInPoly(px, py, r))) continue;
        if (pent.some((p) => x > p.x0 - 1.5 && x < p.x1 + 1.5 && y > p.y0 - 1.5 && y < p.y1 + 1.5)) continue;
        if (hash(Math.round(x * 10), Math.round(y * 10), 5) < 0.06) continue;
        panels.push([x, y]);
      }
    }
  }
  if (panels.length) {
    const geo = new THREE.BoxGeometry(PW, 0.045, PD);
    const inst = new THREE.InstancedMesh(geo, mats.solar, panels.length);
    const legGeo = new THREE.BoxGeometry(PW * 0.9, 0.5, 0.05);
    const legs = new THREE.InstancedMesh(legGeo, mats.metal, panels.length);
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion();
    // panels face the sun path (south = towards the А facade)
    const tilt = 25 * Math.PI / 180;
    const southYaw = (CONFIG.facadeAzimuth - 180) * Math.PI / 180;
    panels.forEach(([x, y], k) => {
      q.setFromEuler(new THREE.Euler(tilt, southYaw, 0, 'YXZ'));
      m.compose(toWorld(x, y, top + 0.55), q, new THREE.Vector3(1, 1, 1));
      inst.setMatrixAt(k, m);
      m.compose(toWorld(x, y - PD * 0.42, top + 0.28), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      legs.setMatrixAt(k, m);
    });
    inst.castShadow = true; inst.receiveShadow = true;
    legs.castShadow = true;
    g.add(inst); g.add(legs);
  }
}

function addEntranceSign(f1, root, mats) {
  // "BAHOR" sign on the main (А) facade above the ground floor, centred
  let best = null;
  for (const p of f1.mass) {
    const ring = p.o;
    for (let i = 0; i < ring.length; i++) {
      const A = ring[i], B = ring[(i + 1) % ring.length];
      if (Math.abs(A[1] - B[1]) > 0.05) continue;
      const x0 = Math.min(A[0], B[0]), x1 = Math.max(A[0], B[0]);
      if (x1 - x0 < 5) continue;
      if (A[1] > 3) continue;
      const mid = (x0 + x1) / 2;
      const score = Math.abs(mid - 22) ;
      if (!best || score < best.score) best = { score, y: A[1], x0, x1 };
    }
  }
  if (!best) return;
  const tex = TX.signTexture('BAHOR', 'TURAR-JOY MAJMUASI');
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.5, metalness: 0.2 });
  mat.clippingPlanes = mats.plaster.clippingPlanes;
  mat.userData.sign = true;
  const g = new THREE.PlaneGeometry(4.2, 1.05);
  const m = new THREE.Mesh(g, mat);
  const x = Math.min(Math.max(best.x0 + 3, 20), best.x1 - 3);
  m.position.copy(toWorld(x, best.y - 0.12, floorBase(1) + 3.55));
  root.add(m);
  root.userData.signMat = mat;
}

// ---------------------------------------------------------------- interior cutaway
const APT_COLORS = ['#e9c896', '#9fd0e6', '#c9e7a6', '#e6b4d8', '#f2d79a', '#b9c8f0', '#f0b9a6', '#a9e0cf'];

export function buildInterior(fd, clipMats) {
  const base = floorBase(fd.floor);
  const g = new THREE.Group();
  g.name = 'interior-' + fd.floor;
  const slab = new THREE.Mesh(extrudePolys(fd.mass, base - 0.3, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.9 }));
  slab.receiveShadow = true; slab.castShadow = true;
  g.add(slab);

  // walls (from plan), cut at 1.25 m
  if (fd.walls.length) {
    const wallGeo = extrudePolys(fd.walls, base, 1.25);
    const wallMats = [
      new THREE.MeshStandardMaterial({ color: 0x3a3936, roughness: 0.7 }),   // caps (cut)
      new THREE.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 0.85 }),  // sides
    ];
    const walls = new THREE.Mesh(wallGeo, wallMats);
    walls.castShadow = true; walls.receiveShadow = true;
    g.add(walls);
  }
  // terraces
  for (const a of fd.apartments) {
    if (!a.ter.length) continue;
    const tg = flatPolys(a.ter.map((o) => ({ o, h: [] })), base + 0.012);
    const tm = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: 0xa88a66, roughness: 0.8 }));
    tm.receiveShadow = true; g.add(tm);
  }
  // apartment floors (pickable)
  const aptMeshes = [];
  fd.apartments.forEach((a, k) => {
    const col = new THREE.Color(a.commercial ? '#d7dde6' : APT_COLORS[k % APT_COLORS.length]);
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.75, emissive: col.clone(), emissiveIntensity: 0.05 });
    const geo = flatPolys(a.polys.map((o) => ({ o, h: [] })), base + 0.02);
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    m.userData.apt = a;
    m.userData.baseColor = col;
    aptMeshes.push(m);
    g.add(m);
  });
  return { group: g, aptMeshes };
}

export { APT_COLORS };
