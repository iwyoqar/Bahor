// Tanlangan xonadonning alohida 3D maketi: qorong'i fonda, iliq yorug'likda, xonalar ustida nuqtalar.
import * as THREE from 'three';
import { extrudePolys, flatPolys, pointInPoly, toWorld } from './building.js';
import { buildFurnishing } from './furniture.js';
import { floorBase } from './config.js';

const WALL_H = 1.45;
let mats = null;
function materials() {
  if (mats) return mats;
  mats = {
    slab: new THREE.MeshStandardMaterial({ color: 0xcbbda4, roughness: 0.85 }),
    wallCap: new THREE.MeshStandardMaterial({ color: 0xd9ccb5, roughness: 0.8 }),
    wallSide: new THREE.MeshStandardMaterial({ color: 0xf5f0e7, roughness: 0.88 }),
    shadow: new THREE.ShadowMaterial({ opacity: 0.42 }),
  };
  return mats;
}

/** Build the isolated model of one apartment (in world coordinates, like the building). */
export function buildApartmentModel(fd, apt) {
  const M = materials();
  const base = floorBase(fd.floor);
  const g = new THREE.Group();
  g.name = 'apartment-' + apt.id;

  const slabPolys = apt.af && apt.af.length ? apt.af : apt.polys.map((o) => ({ o, h: [] }));
  const slab = new THREE.Mesh(extrudePolys(slabPolys, base - 0.35, 0.35), M.slab);
  slab.castShadow = true; slab.receiveShadow = true;
  g.add(slab);

  if (apt.aw && apt.aw.length) {
    const walls = new THREE.Mesh(extrudePolys(apt.aw, base, WALL_H), [M.wallCap, M.wallSide]);
    walls.castShadow = true; walls.receiveShadow = true;
    g.add(walls);
  }

  g.add(buildFurnishing(fd, base, apt));

  // bounds
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of slabPolys) for (const [x, y] of p.o) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const size = Math.max(x1 - x0, y1 - y0);
  const center = toWorld(cx, cy, base + 0.4);

  // soft contact shadow under the floating model
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(size * 5, size * 5).rotateX(-Math.PI / 2), M.shadow);
  catcher.position.copy(toWorld(cx, cy, base - 0.37));
  catcher.receiveShadow = true;
  g.add(catcher);

  // hotspots: one per named room, at the centre of its usable rectangle
  const spots = [];
  for (const r of apt.rg || []) {
    if (!r.n || r.n === 'other') continue;
    const [rx0, ry0, rx1, ry1] = r.r;
    spots.push({ n: r.n, a: r.a, pos: toWorld((rx0 + rx1) / 2, (ry0 + ry1) / 2, base + 1.1), w: rx1 - rx0, d: ry1 - ry0 });
  }
  return { group: g, center, size, spots };
}

// ---------------------------------------------------------------- eye-level interior (reference frames for AI renders)

const ROOM_H = 2.85;

/** Full-height version of the apartment: walls to the ceiling, ceiling, furniture and warm room lights. */
export function buildApartmentInterior(fd, apt) {
  const M = materials();
  const base = floorBase(fd.floor);
  const g = new THREE.Group();
  g.name = 'interior-full-' + apt.id;
  const slabPolys = apt.af && apt.af.length ? apt.af : apt.polys.map((o) => ({ o, h: [] }));
  g.add(new THREE.Mesh(extrudePolys(slabPolys, base - 0.35, 0.35), M.slab));
  if (apt.aw && apt.aw.length) {
    const walls = new THREE.Mesh(extrudePolys(apt.aw, base, ROOM_H), [M.wallSide, M.wallSide]);
    walls.castShadow = true; walls.receiveShadow = true;
    g.add(walls);
  }
  const ceiling = new THREE.Mesh(flatPolys(slabPolys, base + ROOM_H), new THREE.MeshStandardMaterial({ color: 0xf6f3ee, roughness: 0.95, side: THREE.DoubleSide }));
  g.add(ceiling);
  g.add(buildFurnishing(fd, base, apt));
  for (const r of apt.rg || []) {
    const [x0, y0, x1, y1] = r.r;
    const area = (x1 - x0) * (y1 - y0);
    const L = new THREE.PointLight(0xffdcb4, 6 + area * 1.2, 12, 1.6);
    L.position.copy(toWorld((x0 + x1) / 2, (y0 + y1) / 2, base + ROOM_H - 0.35));
    g.add(L);
  }
  return { group: g, base };
}

function sidesOf(room) {
  const [x0, y0, x1, y1] = room.r;
  return [
    { start: [x0, y0], dir: [1, 0], in: [0, 1], len: x1 - x0, depth: y1 - y0, n: [0, -1] },
    { start: [x1, y0], dir: [0, 1], in: [-1, 0], len: y1 - y0, depth: x1 - x0, n: [1, 0] },
    { start: [x1, y1], dir: [-1, 0], in: [0, -1], len: x1 - x0, depth: y1 - y0, n: [0, 1] },
    { start: [x0, y1], dir: [0, -1], in: [1, 0], len: y1 - y0, depth: x1 - x0, n: [-1, 0] },
  ];
}

/** side of the room that faces the outside of the building (the window wall) */
function exteriorSide(fd, room) {
  const sides = sidesOf(room);
  let best = 0, bd = Infinity;
  sides.forEach((s, i) => {
    const mx = s.start[0] + s.dir[0] * s.len / 2, my = s.start[1] + s.dir[1] * s.len / 2;
    for (let d = 0.2; d < 9; d += 0.2) {
      const x = mx + s.n[0] * d, y = my + s.n[1] * d;
      if (!fd.mass.some((p) => pointInPoly(x, y, p))) { if (d < bd) { bd = d; best = i; } break; }
    }
  });
  return best;
}

/**
 * Camera for an eye-level photo of one room.
 * kind 'window': from the window corner looking into the room (end frame of the flight);
 * kind 'door':   from the entrance side looking towards the window.
 */
export function roomView(fd, apt, room, kind) {
  const base = floorBase(fd.floor);
  const sides = sidesOf(room);
  const ext = exteriorSide(fd, room);
  // the SAME side indexing as room.s: S, E, N, W  ->  sidesOf order S, E, N, W
  let k = ext;
  if (kind === 'door') {
    const opp = (ext + 2) % 4;
    let bestRun = -1;
    room.s.forEach((sd, i) => {
      if (i === ext) return;
      const run = sd[2].reduce((m, [a, b]) => Math.max(m, b - a), 0);
      if (run > bestRun + 0.05) { bestRun = run; k = i; }
    });
    if (bestRun <= 0) k = opp;
  }
  const s = sides[k];
  const inset = Math.min(0.45, s.depth * 0.2);
  const side0 = Math.min(0.55, s.len * 0.2);
  const cx = s.start[0] + s.dir[0] * side0 + s.in[0] * inset;
  const cy = s.start[1] + s.dir[1] * side0 + s.in[1] * inset;
  const tx = s.start[0] + s.dir[0] * (s.len - 0.3) + s.in[0] * (s.depth - 0.3);
  const ty = s.start[1] + s.dir[1] * (s.len - 0.3) + s.in[1] * (s.depth - 0.3);
  return { pos: toWorld(cx, cy, base + 1.45), target: toWorld(tx, ty, base + 1.0) };
}
