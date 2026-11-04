// Atrof-muhit: yer, yo'llar, parkovka, daraxtlar, chiroqlar, mashinalar, qo'shni binolar, hovli.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';
import { toWorld } from './building.js';

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

/** axis-aligned rectangle in plan coords -> horizontal plane mesh */
function rectPlane(x0, y0, x1, y1, h, mat, texScale) {
  const w = x1 - x0, d = y1 - y0;
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  if (texScale) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / texScale, uv.getY(i) * d / texScale);
  }
  const m = new THREE.Mesh(g, mat);
  const c = toWorld((x0 + x1) / 2, (y0 + y1) / 2, h);
  m.position.copy(c);
  m.receiveShadow = true;
  return m;
}

export function buildEnvironment(scene) {
  const env = new THREE.Group();
  env.name = 'environment';
  const R = rng(2024);
  const nightMats = [];      // materials whose emissive follows the night factor
  const lampLights = [];
  const pools = [];

  // ------------------------------------------------ ground surfaces
  const grassTex = TX.grassTexture();
  const grass = new THREE.MeshStandardMaterial({ map: grassTex, color: 0x9fae86, roughness: 1 });
  const groundGeo = new THREE.PlaneGeometry(1400, 1400);
  groundGeo.rotateX(-Math.PI / 2);
  const uv = groundGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1400 / 23, uv.getY(i) * 1400 / 23);
  const ground = new THREE.Mesh(groundGeo, grass);
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  env.add(ground);

  const asphaltTex = TX.asphaltTexture();
  const asphalt = new THREE.MeshStandardMaterial({ map: asphaltTex, color: 0xffffff, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const paverTex = TX.paverTexture();
  const pavers = new THREE.MeshStandardMaterial({ map: paverTex, color: 0xffffff, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const curb = new THREE.MeshStandardMaterial({ color: 0xc9c6bf, roughness: 0.7 });
  const lawn = new THREE.MeshStandardMaterial({ map: grassTex, color: 0xd3e8b0, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const paint = new THREE.MeshStandardMaterial({ roughness: 0.8, color: 0xe9e9e4, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const paintY = new THREE.MeshStandardMaterial({ roughness: 0.8, color: 0xd9b24a, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });

  // site plaza around the building
  env.add(rectPlane(-9, -9, 79, 52, 0.0, pavers, 3));
  // main road (front, along А facade)
  env.add(rectPlane(-160, -32, 220, -15, 0.0, asphalt, 8));
  // east road
  env.add(rectPlane(80, -15, 92, 220, 0.0, asphalt, 8));
  // west street & back drive
  env.add(rectPlane(-19, -15, -10, 160, 0.0, asphalt, 8));
  env.add(rectPlane(-10, 52, 80, 59, 0.0, asphalt, 8));
  // front parking strip
  env.add(rectPlane(-9, -15, 79, -9, 0.0, asphalt, 8));
  // far sidewalks
  env.add(rectPlane(-160, -37, 220, -32, 0.0, pavers, 3));
  env.add(rectPlane(92, -15, 98, 220, 0.0, pavers, 3));
  env.add(rectPlane(79, -15, 80, 52, 0.0, pavers, 3));
  env.add(rectPlane(-10, -15, -9, 52, 0.0, pavers, 3));

  // curbs
  const curbs = [];
  const curbBox = (x0, y0, x1, y1) => {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0) || 0.25, 0.16, Math.abs(y1 - y0) || 0.25);
    const c = toWorld((x0 + x1) / 2, (y0 + y1) / 2, 0.08);
    g.translate(c.x, c.y, c.z);
    curbs.push(g);
  };
  curbBox(-160, -15, 220, -15); curbBox(-160, -32, 220, -32); curbBox(80, -15, 80, 220); curbBox(92, -15, 92, 220);
  curbBox(-10, -15, -10, 160); curbBox(-9, -9, 79, -9);
  const curbMesh = new THREE.Mesh(mergeGeometries(curbs), curb);
  curbMesh.receiveShadow = true; curbMesh.castShadow = true;
  env.add(curbMesh);

  // road markings
  const marks = [];
  const markRect = (x0, y0, x1, y1) => {
    const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
    g.rotateX(-Math.PI / 2);
    const c = toWorld((x0 + x1) / 2, (y0 + y1) / 2, 0.012);
    g.translate(c.x, c.y, c.z);
    marks.push(g);
  };
  for (let x = -150; x < 210; x += 9) { markRect(x, -19.4, x + 4.5, -19.25); markRect(x, -27.6, x + 4.5, -27.45); }
  for (let y = -10; y < 210; y += 9) markRect(85.93, y, 86.07, y + 4.5);
  for (let y = -10; y < 150; y += 9) markRect(-14.57, y, -14.43, y + 4.5);
  // parking stalls
  for (let x = -8; x <= 78; x += 2.7) markRect(x - 0.06, -14.6, x + 0.06, -9.6);
  // zebra crossings
  for (let k = 0; k < 8; k++) { const x = 36 + k * 1.1 - 4; markRect(x, -31.5, x + 0.55, -15.5); }
  env.add(new THREE.Mesh(mergeGeometries(marks), paint));
  const center = [];
  for (const yy of [-23.6, -23.4]) {
    const g = new THREE.PlaneGeometry(380, 0.12); g.rotateX(-Math.PI / 2);
    const c = toWorld(30, yy, 0.013); g.translate(c.x, c.y, c.z); center.push(g);
  }
  env.add(new THREE.Mesh(mergeGeometries(center), paintY));

  // ------------------------------------------------ courtyard & landscaping
  const beds = [];
  const bedRect = (x0, y0, x1, y1) => {
    const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
    g.rotateX(-Math.PI / 2);
    const uvs = g.attributes.uv;
    for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * (x1 - x0) / 5, uvs.getY(i) * (y1 - y0) / 5);
    const c = toWorld((x0 + x1) / 2, (y0 + y1) / 2, 0.02);
    g.translate(c.x, c.y, c.z);
    beds.push(g);
    // low curb around bed
    for (const [a0, b0, a1, b1] of [[x0, y0, x1, y0], [x0, y1, x1, y1], [x0, y0, x0, y1], [x1, y0, x1, y1]]) {
      const cg = new THREE.BoxGeometry(Math.abs(a1 - a0) || 0.15, 0.18, Math.abs(b1 - b0) || 0.15);
      const cc = toWorld((a0 + a1) / 2, (b0 + b1) / 2, 0.09);
      cg.translate(cc.x, cc.y, cc.z);
      curbs.push(cg);
    }
  };
  // courtyard lawns (between wings)
  bedRect(21, 23, 33.5, 32); bedRect(37.8, 23, 50.5, 32);
  bedRect(21, 35.5, 33.5, 46); bedRect(37.8, 35.5, 50.5, 46);
  // front planting strips
  for (const [a, b] of [[-7, 4], [9, 20], [24, 33], [38.5, 47.5], [51.5, 62.5], [67, 77.5]]) bedRect(a, -7.6, b, -5.4);
  // east strip
  bedRect(74.5, 2, 78.2, 20); bedRect(74.5, 24, 78.2, 44);
  const lawnMesh = new THREE.Mesh(mergeGeometries(beds), lawn);
  lawnMesh.receiveShadow = true;
  env.add(lawnMesh);
  const curbMesh2 = new THREE.Mesh(mergeGeometries(curbs.splice(0)), curb);
  curbMesh2.receiveShadow = true;
  env.add(curbMesh2);

  // flower clusters (instanced small spheres)
  const flowers = [];
  const addFlowers = (x0, y0, x1, y1, n) => {
    for (let i = 0; i < n; i++) flowers.push([x0 + R() * (x1 - x0), y0 + R() * (y1 - y0)]);
  };
  for (const [a, b] of [[-7, 4], [9, 20], [24, 33], [38.5, 47.5], [51.5, 62.5], [67, 77.5]]) addFlowers(a + 0.3, -7.3, b - 0.3, -5.7, 26);
  addFlowers(21.5, 23.5, 33, 31.5, 30); addFlowers(38.3, 23.5, 50, 31.5, 30);
  {
    const fg = new THREE.IcosahedronGeometry(0.32, 1);
    const fm = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const inst = new THREE.InstancedMesh(fg, fm, flowers.length);
    const palette = ['#d9487a', '#f2c14e', '#e86a92', '#ffffff', '#a05cc8', '#ef7d3c', '#5a9a3a', '#4f8a33'];
    const m = new THREE.Matrix4();
    flowers.forEach(([x, y], k) => {
      const s = 0.6 + R() * 0.8;
      m.compose(toWorld(x, y, 0.2 * s), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.7, s));
      inst.setMatrixAt(k, m);
      inst.setColorAt(k, new THREE.Color(palette[Math.floor(R() * palette.length)]));
    });
    inst.castShadow = true; inst.receiveShadow = true;
    env.add(inst);
  }

  // gazebo (courtyard centre) + playground
  {
    const gz = new THREE.Group();
    const cx = 35.68, cy = 39.5;
    const white = new THREE.MeshStandardMaterial({ color: 0xf1eee6, roughness: 0.6 });
    const tile = new THREE.MeshStandardMaterial({ map: TX.tileTexture(), roughness: 0.8 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.7 });
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.7, 0.3, 32), new THREE.MeshStandardMaterial({ color: 0xb98c6a, roughness: 0.8 }));
    floor.position.copy(toWorld(cx, cy, 0.15)); floor.receiveShadow = true; gz.add(floor);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.8, 16), white);
      col.position.copy(toWorld(cx + Math.cos(a) * 3.1, cy + Math.sin(a) * 3.1, 1.7));
      col.castShadow = true; gz.add(col);
    }
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.35, 32, 1, true), white);
    ring.position.copy(toWorld(cx, cy, 3.25)); ring.castShadow = true; gz.add(ring);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.3, 1.9, 32), tile);
    roof.position.copy(toWorld(cx, cy, 4.35)); roof.castShadow = true; gz.add(roof);
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.0), wood);
    table.position.copy(toWorld(cx, cy, 0.7)); table.castShadow = true; gz.add(table);
    env.add(gz);
    // playground
    const pad = new THREE.Mesh(new THREE.CircleGeometry(4.5, 40), new THREE.MeshStandardMaterial({ color: 0xd06a4a, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }));
    pad.rotation.x = -Math.PI / 2; pad.position.copy(toWorld(27, 27.5, 0.03)); pad.receiveShadow = true; env.add(pad);
    const pad2 = pad.clone(); pad2.material = pad.material.clone(); pad2.material.color.set(0x4f8fc0); pad2.position.copy(toWorld(44.3, 27.5, 0.03)); env.add(pad2);
    const plast = ['#e8b44a', '#e05a4f', '#4fa3d9', '#6cc070'];
    for (let k = 0; k < 7; k++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.8 + R() * 1.2, 0.6 + R() * 1.6, 0.8 + R() * 1.2), new THREE.MeshStandardMaterial({ color: plast[k % 4], roughness: 0.5 }));
      const left = k < 4;
      m.position.copy(toWorld((left ? 27 : 44.3) + (R() - 0.5) * 5, 27.5 + (R() - 0.5) * 5, 0.5));
      m.rotation.y = R() * Math.PI;
      m.castShadow = true; env.add(m);
    }
  }

  // ------------------------------------------------ trees
  const trees = [];
  const pines = [];
  for (let x = -6; x <= 78; x += 6.6) {
    if (Math.abs(x - 35.7) < 3) continue;
    trees.push([x + (R() - 0.5), -12 - 4.6 + (R() - 0.5) * 0.3]);
  }
  for (const [a, b] of [[-7, 4], [9, 20], [24, 33], [38.5, 47.5], [51.5, 62.5], [67, 77.5]]) {
    pines.push([a + 1.2, -6.5]); pines.push([b - 1.2, -6.5]);
    trees.push([(a + b) / 2, -6.5]);
  }
  for (let y = 4; y < 44; y += 7) { trees.push([76.4, y]); }
  for (let y = 2; y < 50; y += 8) trees.push([-6, y]);
  for (const p of [[22.5, 24.5], [32, 24.5], [39.5, 24.5], [49, 24.5], [22.5, 44.5], [49, 44.5], [24, 34], [47.5, 34], [32, 44.5], [39.5, 44.5]]) trees.push(p);
  for (const p of [[21.5, 30], [50, 30], [21.5, 37], [50, 37], [-7.5, -1], [78, 47]]) pines.push(p);
  for (let x = -150; x < 220; x += 11) { if (R() < 0.85) trees.push([x, -34.5]); }
  for (let y = -12; y < 200; y += 10) { trees.push([95, y]); }
  // random trees in surrounding lots
  for (let i = 0; i < 90; i++) {
    const x = -140 + R() * 340, y = -120 + R() * 320;
    const inSite = x > -22 && x < 100 && y > -40 && y < 62;
    if (!inSite) (R() < 0.6 ? trees : pines).push([x, y]);
  }

  {
    // deciduous tree: displaced icosphere crown
    const crown = new THREE.IcosahedronGeometry(1, 3);
    const pos = crown.attributes.position;
    const col = [];
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = Math.sin(v.x * 5.1) * Math.cos(v.y * 4.3) * Math.sin(v.z * 3.7);
      const n2 = Math.sin(v.x * 11 + v.z * 9) * 0.5;
      v.multiplyScalar(1 + n * 0.16 + n2 * 0.06);
      v.y *= 0.88;
      pos.setXYZ(i, v.x, v.y, v.z);
      const shade = 0.62 + (v.y + 1) * 0.22 + n2 * 0.08;
      col.push(shade, shade, shade);
    }
    crown.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    crown.computeVertexNormals();
    const c2 = crown.clone(); c2.scale(0.7, 0.7, 0.7); c2.translate(0.75, -0.35, 0.3);
    const c3 = crown.clone(); c3.scale(0.65, 0.6, 0.65); c3.translate(-0.7, -0.25, -0.35);
    const crownAll = mergeGeometries([crown, c2, c3]);
    crownAll.translate(0, 3.6, 0);
    const trunkG = new THREE.CylinderGeometry(0.12, 0.2, 3.2, 8); trunkG.translate(0, 1.6, 0);
    const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 1 });
    const ci = new THREE.InstancedMesh(crownAll, leafMat, trees.length);
    const ti = new THREE.InstancedMesh(trunkG, barkMat, trees.length);
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion();
    const greens = ['#4f7a35', '#5c8a3c', '#6c9444', '#41692f', '#77a04b', '#5a7f3a'];
    trees.forEach(([x, y], k) => {
      const s = 0.8 + R() * 0.6;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * Math.PI * 2);
      m.compose(toWorld(x, y, 0), q, new THREE.Vector3(s * 1.6, s * 1.25, s * 1.6));
      ci.setMatrixAt(k, m);
      m.compose(toWorld(x, y, 0), q, new THREE.Vector3(s, s * 1.25, s));
      ti.setMatrixAt(k, m);
      ci.setColorAt(k, new THREE.Color(greens[Math.floor(R() * greens.length)]));
    });
    ci.castShadow = true; ci.receiveShadow = true; ti.castShadow = true;
    env.add(ci); env.add(ti);

    // pines / cypress
    const pc = [];
    for (let k = 0; k < 4; k++) {
      const g = new THREE.ConeGeometry(1.25 - k * 0.22, 2.4, 9);
      g.translate(0, 2.2 + k * 1.35, 0);
      pc.push(g);
    }
    const pineG = mergeGeometries(pc);
    const pcol = [];
    const pp = pineG.attributes.position;
    for (let i = 0; i < pp.count; i++) { const sh = 0.55 + (pp.getY(i) / 7) * 0.45; pcol.push(sh, sh, sh); }
    pineG.setAttribute('color', new THREE.Float32BufferAttribute(pcol, 3));
    const pi = new THREE.InstancedMesh(pineG, leafMat, pines.length);
    const pt = new THREE.InstancedMesh(trunkG, barkMat, pines.length);
    pines.forEach(([x, y], k) => {
      const s = 0.85 + R() * 0.5;
      m.compose(toWorld(x, y, 0), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6), new THREE.Vector3(s, s * 1.15, s));
      pi.setMatrixAt(k, m);
      pt.setMatrixAt(k, m);
      pi.setColorAt(k, new THREE.Color(['#2f5a2e', '#3a6634', '#2b4f2a'][k % 3]));
    });
    pi.castShadow = true; pi.receiveShadow = true; pt.castShadow = true;
    env.add(pi); env.add(pt);
  }

  // ------------------------------------------------ street lamps (classical lanterns)
  const lamps = [];
  for (let x = -6; x <= 78; x += 10.5) lamps.push([x + 2.2, -8.4]);
  for (let y = 0; y < 50; y += 10) lamps.push([79.2, y]);
  for (let y = 0; y < 50; y += 12) lamps.push([-9.4, y]);
  for (const p of [[35.68 - 4, 33.7], [35.68 + 4, 33.7], [22, 34], [49.4, 34], [35.68 - 5, 46.5], [35.68 + 5, 46.5], [27, 21.5], [44.4, 21.5]]) lamps.push(p);
  for (let x = -150; x < 220; x += 26) lamps.push([x, -33.5]);
  {
    const iron = new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.5, metalness: 0.7 });
    const poleParts = [];
    const base = new THREE.CylinderGeometry(0.22, 0.3, 0.6, 12); base.translate(0, 0.3, 0); poleParts.push(base);
    const pole = new THREE.CylinderGeometry(0.06, 0.09, 3.9, 10); pole.translate(0, 2.4, 0); poleParts.push(pole);
    const cap = new THREE.ConeGeometry(0.34, 0.42, 6); cap.translate(0, 4.95, 0); poleParts.push(cap);
    const collar = new THREE.CylinderGeometry(0.16, 0.12, 0.2, 8); collar.translate(0, 4.32, 0); poleParts.push(collar);
    const poleG = mergeGeometries(poleParts.map((g) => g.toNonIndexed()));
    const glassG = new THREE.CylinderGeometry(0.26, 0.18, 0.55, 6); glassG.translate(0, 4.6, 0);
    const lampGlass = new THREE.MeshStandardMaterial({ color: 0xfff2d8, emissive: 0xffc77a, emissiveIntensity: 0, roughness: 0.3, transparent: true, opacity: 0.9 });
    nightMats.push({ mat: lampGlass, day: 0.0, night: 6.0 });
    const pi = new THREE.InstancedMesh(poleG, iron, lamps.length);
    const gi = new THREE.InstancedMesh(glassG, lampGlass, lamps.length);
    const m = new THREE.Matrix4();
    lamps.forEach(([x, y], k) => {
      m.makeTranslation(toWorld(x, y, 0));
      pi.setMatrixAt(k, m); gi.setMatrixAt(k, m);
    });
    pi.castShadow = true;
    env.add(pi); env.add(gi);

    // light pools on the ground (cheap) + a few real point lights near the building
    const poolMat = new THREE.MeshBasicMaterial({ map: TX.glowTexture(), color: 0xffb866, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    const poolG = new THREE.PlaneGeometry(9, 9); poolG.rotateX(-Math.PI / 2);
    const poolI = new THREE.InstancedMesh(poolG, poolMat, lamps.length);
    lamps.forEach(([x, y], k) => { m.makeTranslation(toWorld(x, y, 0.05)); poolI.setMatrixAt(k, m); });
    poolI.renderOrder = 2;
    env.add(poolI);
    pools.push(poolMat);
    const halo = new THREE.SpriteMaterial({ map: TX.glowTexture(), color: 0xffcf8a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    pools.push(halo);
    lamps.forEach(([x, y]) => {
      const s = new THREE.Sprite(halo); s.scale.set(2.2, 2.2, 1); s.position.copy(toWorld(x, y, 4.6)); env.add(s);
    });
    const near = lamps.filter(([x, y]) => (y > -10 && y < 0) || (x > 20 && x < 52 && y > 20 && y < 48)).slice(0, 10);
    near.forEach(([x, y]) => {
      const L = new THREE.PointLight(0xffc27a, 0, 22, 1.6);
      L.position.copy(toWorld(x, y, 4.4));
      env.add(L); lampLights.push(L);
    });
  }

  // ------------------------------------------------ benches
  {
    const wood = new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.75 });
    const parts = [];
    const seat = new THREE.BoxGeometry(1.8, 0.08, 0.45); seat.translate(0, 0.45, 0); parts.push(seat);
    const back = new THREE.BoxGeometry(1.8, 0.4, 0.06); back.translate(0, 0.75, -0.22); parts.push(back);
    const lg1 = new THREE.BoxGeometry(0.08, 0.45, 0.4); lg1.translate(-0.8, 0.22, 0); parts.push(lg1);
    const lg2 = lg1.clone(); lg2.translate(1.6, 0, 0); parts.push(lg2);
    const bg = mergeGeometries(parts);
    const spots = [[26, 33.7, 0], [30, 33.7, 0], [41.4, 33.7, 0], [45.4, 33.7, 0], [12, -4.5, Math.PI], [59, -4.5, Math.PI], [35.68 - 2.5, 35.5, 0], [35.68 + 2.5, 35.5, 0]];
    const bi = new THREE.InstancedMesh(bg, wood, spots.length);
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion();
    spots.forEach(([x, y, r], k) => { m.compose(toWorld(x, y, 0), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r), new THREE.Vector3(1, 1, 1)); bi.setMatrixAt(k, m); });
    bi.castShadow = true;
    env.add(bi);
  }

  // ------------------------------------------------ cars (parked + moving)
  const cars = buildCars(env, R, nightMats);

  // ------------------------------------------------ context buildings
  // distant neighbourhood massing (kept away from the main viewpoints)
  const ctxBlocks = [
    [-95, 10, 36, 20, 18], [-100, 55, 30, 24, 15], [-70, 105, 40, 20, 24], [10, 112, 44, 18, 15], [70, 110, 30, 22, 21],
    [140, 5, 24, 40, 24], [140, 60, 28, 30, 15], [150, 110, 30, 24, 30], [-150, -10, 30, 26, 12], [-140, 90, 26, 34, 21],
    [190, 40, 30, 30, 15], [40, 170, 50, 24, 33], [-60, 170, 34, 30, 18], [-75, -95, 44, 20, 15], [70, -110, 40, 22, 18],
    [-180, -70, 30, 24, 12], [190, -80, 36, 22, 18],
  ];
  ctxBlocks.forEach(([x, y, w, d, h], k) => {
    const tex = TX.contextFacade(100 + k);
    const mk = (repU, repV) => {
      const map = tex.map.clone(); map.needsUpdate = true; map.repeat.set(repU, repV);
      const em = tex.emissive.clone(); em.needsUpdate = true; em.repeat.set(repU, repV);
      const mat = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.85 });
      nightMats.push({ mat, day: 0, night: 0.9 });
      return mat;
    };
    const floors = h / 3;
    const mx = mk(d / 14, floors / 4), mz = mk(w / 14, floors / 4);
    const top = new THREE.MeshStandardMaterial({ color: 0xa7a9ac, roughness: 0.95 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mx, mx, top, top, mz, mz]);
    box.position.copy(toWorld(x, y, h / 2));
    box.castShadow = true; box.receiveShadow = true;
    env.add(box);
  });

  scene.add(env);

  return {
    group: env,
    update(dt, night) {
      for (const n of nightMats) n.mat.emissiveIntensity = n.day + (n.night - n.day) * night;
      for (const p of pools) p.opacity = night * (p.isSpriteMaterial ? 0.9 : 0.55);
      for (const L of lampLights) L.intensity = night * 38;
      cars.update(dt, night);
    },
  };
}

function carProfile() {
  // sedan side silhouette (x along length, y up), length 4.6 m
  const s = new THREE.Shape();
  const pts = [[-2.3, 0.32], [2.3, 0.32], [2.32, 0.62], [2.18, 0.8], [1.2, 0.9], [0.55, 1.36], [-0.75, 1.4], [-1.55, 0.96], [-2.25, 0.88], [-2.34, 0.6]];
  s.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(([x, y]) => s.lineTo(x, y));
  s.closePath();
  return s;
}

function windowProfile() {
  const s = new THREE.Shape();
  const pts = [[1.1, 0.92], [0.52, 1.3], [-0.72, 1.34], [-1.42, 0.97]];
  s.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(([x, y]) => s.lineTo(x, y));
  s.closePath();
  return s;
}

function buildCars(env, R, nightMats) {
  const body = new THREE.ExtrudeGeometry(carProfile(), { depth: 1.72, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 4 });
  body.translate(0, 0, -0.86);
  const win = new THREE.ExtrudeGeometry(windowProfile(), { depth: 1.8, bevelEnabled: false });
  win.translate(0, 0, -0.9);
  const wheel = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 16); wheel.rotateX(Math.PI / 2);
  const wheels = [];
  for (const [x, z] of [[1.42, 0.8], [-1.42, 0.8], [1.42, -0.8], [-1.42, -0.8]]) { const w = wheel.clone(); w.translate(x, 0.34, z); wheels.push(w); }
  const wheelG = mergeGeometries(wheels);
  const headG = mergeGeometries([new THREE.BoxGeometry(0.06, 0.12, 0.4).translate(2.33, 0.66, 0.55), new THREE.BoxGeometry(0.06, 0.12, 0.4).translate(2.33, 0.66, -0.55)]);
  const tailG = mergeGeometries([new THREE.BoxGeometry(0.06, 0.12, 0.42).translate(-2.36, 0.72, 0.55), new THREE.BoxGeometry(0.06, 0.12, 0.42).translate(-2.36, 0.72, -0.55)]);

  const paint = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0d1218, roughness: 0.05, metalness: 0.9 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dd, emissiveIntensity: 0 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2010, emissiveIntensity: 0 });
  nightMats.push({ mat: head, day: 0.2, night: 8 });
  nightMats.push({ mat: tail, day: 0.1, night: 3 });

  const parked = [];
  for (let x = -6.65; x <= 77; x += 2.7) if (R() < 0.72) parked.push({ x, y: -12.1, rot: R() < 0.5 ? Math.PI / 2 : -Math.PI / 2 });
  for (let y = 0; y < 48; y += 2.8) if (R() < 0.5) parked.push({ x: 82.5, y, rot: Math.PI });
  for (let x = -6; x < 76; x += 5.4) if (R() < 0.45) parked.push({ x, y: 55.5, rot: 0 });
  // moving cars on main and east road
  const moving = [];
  const lanes = [{ y: -17.3, dir: 1 }, { y: -21.4, dir: 1 }, { y: -25.6, dir: -1 }, { y: -29.7, dir: -1 }];
  lanes.forEach((ln, li) => {
    for (let k = 0; k < 4; k++) moving.push({ lane: li, x: -150 + R() * 360, y: ln.y, dir: ln.dir, speed: 9 + R() * 6, axis: 'x' });
  });
  for (let k = 0; k < 4; k++) moving.push({ x: 83.2, y: -10 + R() * 200, dir: 1, speed: 7 + R() * 4, axis: 'y' });
  for (let k = 0; k < 4; k++) moving.push({ x: 88.8, y: -10 + R() * 200, dir: -1, speed: 7 + R() * 4, axis: 'y' });

  const N = parked.length + moving.length;
  const iBody = new THREE.InstancedMesh(body, paint, N);
  const iWin = new THREE.InstancedMesh(win, glass, N);
  const iWheel = new THREE.InstancedMesh(wheelG, tyre, N);
  const iHead = new THREE.InstancedMesh(headG, head, N);
  const iTail = new THREE.InstancedMesh(tailG, tail, N);
  const colors = ['#f4f4f2', '#d9dadc', '#1c1d20', '#9aa0a8', '#2a3c5c', '#7a1d1d', '#f4f4f2', '#c8c9cb', '#ffffff', '#3b3f45'];
  for (let k = 0; k < N; k++) iBody.setColorAt(k, new THREE.Color(colors[Math.floor(R() * colors.length)]));
  [iBody, iWin, iWheel].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
  [iBody, iWin, iWheel, iHead, iTail].forEach((m) => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); env.add(m); });
  const mat = new THREE.Matrix4(); const q = new THREE.Quaternion(); const one = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const place = (k, x, y, rot) => {
    q.setFromAxisAngle(up, rot);
    mat.compose(toWorld(x, y, 0.02), q, one);
    iBody.setMatrixAt(k, mat); iWin.setMatrixAt(k, mat); iWheel.setMatrixAt(k, mat); iHead.setMatrixAt(k, mat); iTail.setMatrixAt(k, mat);
  };
  parked.forEach((c, k) => place(k, c.x, c.y, c.rot));
  const flush = () => { [iBody, iWin, iWheel, iHead, iTail].forEach((m) => { m.instanceMatrix.needsUpdate = true; }); };
  const update = (dt) => {
    moving.forEach((c, j) => {
      if (c.axis === 'x') {
        c.x += c.dir * c.speed * dt;
        if (c.x > 215) c.x = -155; if (c.x < -155) c.x = 215;
        place(parked.length + j, c.x, c.y, c.dir > 0 ? 0 : Math.PI);
      } else {
        c.y += c.dir * c.speed * dt;
        if (c.y > 215) c.y = -12; if (c.y < -12) c.y = 215;
        place(parked.length + j, c.x, c.y, c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
    });
    flush();
  };
  update(0);
  return { update };
}
