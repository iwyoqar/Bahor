// Tanlangan xonadonning alohida 3D maketi: qorong'i fonda, iliq yorug'likda, xonalar ustida nuqtalar.
import * as THREE from 'three';
import { extrudePolys, toWorld } from './building.js';
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
