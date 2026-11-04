// Bahor — 3D interaktiv sayt: sahna, kamera, tanlash va animatsiyalar.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CONFIG, floorBase, floorHeight } from './config.js';
import { buildBuilding, buildInterior, createMaterials, extrudePolys, toWorld } from './building.js';
import { buildEnvironment } from './environment.js';
import { createLighting } from './lighting.js';
import { createUI } from './ui.js';
import { t, fmtArea } from './i18n.js';
import { localParts, dateFromLocal, phaseOf } from './sun.js';

const loaderEl = document.getElementById('loader');
const loaderBar = document.getElementById('loader-bar');
const setProgress = (p) => { loaderBar.style.width = `${Math.round(p * 100)}%`; };

async function loadData() {
  const res = await fetch('data/floors.json');
  if (!res.ok) throw new Error('data/floors.json: ' + res.status);
  const total = +res.headers.get('content-length') || 700000;
  const reader = res.body.getReader();
  const chunks = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    setProgress(Math.min(0.5, (got / total) * 0.5));
  }
  const buf = new Uint8Array(got); let o = 0;
  for (const c of chunks) { buf.set(c, o); o += c.length; }
  return JSON.parse(new TextDecoder().decode(buf));
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function main() {
  const data = await loadData();
  const floors = data.floors;
  const byFloor = new Map(floors.map((f) => [f.floor, f]));

  // ------------------------------------------------ renderer
  const isMobile = matchMedia('(max-width: 760px)').matches || navigator.maxTouchPoints > 1;
  const params = new URLSearchParams(location.search);
  const low = params.get('q') === 'low';
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio, isMobile ? 1.5 : 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  document.getElementById('scene').appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer({ element: document.getElementById('labels') });
  labelRenderer.setSize(innerWidth, innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(isMobile ? 50 : 38, innerWidth / innerHeight, 0.5, 9000);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 18;
  controls.maxDistance = 360;
  controls.maxPolarAngle = Math.PI * 0.475;
  controls.screenSpacePanning = true;
  controls.zoomSpeed = 0.9;

  // ------------------------------------------------ scene content
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4);
  const mats = createMaterials(clipPlane);
  const lighting = createLighting(scene, renderer, { low });
  setProgress(0.55); await nextFrame();
  const env = buildEnvironment(scene);
  setProgress(0.7); await nextFrame();
  const bld = buildBuilding(floors, mats);
  scene.add(bld.root);
  setProgress(0.9); await nextFrame();

  // highlight overlays per floor
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xe0a84a, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, side: THREE.FrontSide, fog: false });
  const hlLineMat = new THREE.LineBasicMaterial({ color: 0xffd896, transparent: true, opacity: 0.95, depthTest: true });
  const hl = new Map();
  for (const f of floors) {
    const geo = extrudePolys(f.mass, floorBase(f.floor) + 0.02, floorHeight(f.floor) - 0.04);
    const mesh = new THREE.Mesh(geo, hlMat);
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 35), hlLineMat);
    mesh.visible = lines.visible = false;
    mesh.renderOrder = lines.renderOrder = 5;
    scene.add(mesh); scene.add(lines);
    hl.set(f.floor, { mesh, lines });
  }

  // ------------------------------------------------ post processing
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: low ? 0 : isMobile ? 2 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.35, 0.55, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ------------------------------------------------ time of day
  const TZ = CONFIG.location.tz;
  const timeState = { live: true, minutes: 0 };
  let lastLightUpdate = -1e9;
  function currentDate() {
    const now = new Date();
    if (timeState.live) { timeState.minutes = localParts(now, TZ).minutes; return now; }
    return dateFromLocal(localParts(now, TZ), timeState.minutes, TZ);
  }
  function litFraction(h) {
    if (h >= 17 && h < 23) return 0.6;
    if (h >= 23 || h < 1) return 0.42;
    if (h >= 1 && h < 5) return 0.18;
    if (h >= 5 && h < 8) return 0.45;
    return 0.35;
  }
  function applyTime(force = false) {
    const d = currentDate();
    const s = lighting.update(d, { forceEnv: force });
    const h = timeState.minutes / 60;
    const night = s.night;
    mats.uniforms.night.value = night > 0.02 ? litFraction(h) * Math.min(1, night * 1.4) + (1 - s.day) * 0.05 : 0;
    mats.uniforms.winIntensity.value = 0.2 + 1.25 * night;
    mats.uniforms.uplight.value = 0.22 * night;
    bloom.strength = 0.15 + 0.42 * night;
    bloom.threshold = 0.92 - 0.14 * night;
    if (bld.root.userData.signMat) bld.root.userData.signMat.emissiveIntensity = 0.2 + 1.6 * night;
    envNight = night;
    ui.setClock(timeState.minutes, phaseOf(s.elevation, h < 12), timeState.live);
  }
  let envNight = 0;

  // ------------------------------------------------ interaction state
  let hoveredFloor = null;
  let selectedFloor = null;
  let hoveredApt = null;
  let selectedApt = null;
  let interior = null;        // { group, aptMeshes, labels }
  const interiors = new Map();
  let savedView = null;

  function setHoverFloor(fl) {
    if (hoveredFloor === fl) return;
    if (hoveredFloor && hl.get(hoveredFloor)) { hl.get(hoveredFloor).mesh.visible = false; hl.get(hoveredFloor).lines.visible = false; }
    hoveredFloor = fl;
    if (fl && !selectedFloor) { hl.get(fl).mesh.visible = true; hl.get(fl).lines.visible = true; }
    ui.setHoverFloor(fl);
    renderer.domElement.style.cursor = fl ? 'pointer' : '';
  }

  function aptMeshFor(id) { return interior ? interior.aptMeshes.find((m) => m.userData.apt.id === id) : null; }

  function paintApt(m) {
    const a = m.userData.apt;
    const on = (hoveredApt && hoveredApt.id === a.id) || (selectedApt && selectedApt.id === a.id);
    const sel = selectedApt && selectedApt.id === a.id;
    m.material.emissive.set(sel ? 0xd6a84a : on ? 0xf0c77a : m.userData.baseColor);
    m.material.emissiveIntensity = sel ? 0.85 : on ? 0.6 : 0.05;
    m.position.y = on ? 0.04 : 0;
    const lbl = interior.labels.get(a.id);
    if (lbl) lbl.element.classList.toggle('on', !!on);
  }

  function setHoverApt(a) {
    hoveredApt = a;
    if (!interior) return;
    interior.aptMeshes.forEach(paintApt);
    ui.highlightApt(a ? a.id : null);
    renderer.domElement.style.cursor = a ? 'pointer' : '';
  }

  function getInterior(fl) {
    if (interiors.has(fl)) return interiors.get(fl);
    const fd = byFloor.get(fl);
    const it = buildInterior(fd);
    const labels = new Map();
    fd.apartments.forEach((a) => {
      const div = document.createElement('div');
      div.className = 'apt-tag' + (a.commercial ? ' com' : '');
      const no = a.id.split('-')[1].replace(/^0/, '');
      div.innerHTML = `<b>${a.commercial ? '★' : no}</b><span>${fmtArea(a.area)} m²</span>`;
      div.addEventListener('pointerenter', () => { setHoverApt(a); ui.showTip(lastPointer.x, lastPointer.y, ui.aptTipHTML(a)); });
      div.addEventListener('pointerleave', () => { setHoverApt(null); ui.hideTip(); });
      div.addEventListener('click', (e) => { e.stopPropagation(); ui.selectApt(a); });
      const o = new CSS2DObject(div);
      o.position.copy(toWorld(a.label[0], a.label[1], floorBase(fl) + 1.6));
      it.group.add(o);
      labels.set(a.id, o);
    });
    it.labels = labels;
    interiors.set(fl, it);
    return it;
  }

  // ------------------------------------------------ camera animation
  const anim = { active: false };
  function flyTo(pos, target, dur = 1.4) {
    anim.active = true;
    anim.t = 0; anim.dur = dur;
    anim.p0 = camera.position.clone(); anim.p1 = pos.clone();
    anim.t0 = controls.target.clone(); anim.t1 = target.clone();
  }
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  function stepAnim(dt) {
    if (!anim.active) return;
    anim.t += dt / anim.dur;
    const k = ease(Math.min(anim.t, 1));
    camera.position.lerpVectors(anim.p0, anim.p1, k);
    controls.target.lerpVectors(anim.t0, anim.t1, k);
    if (anim.t >= 1) anim.active = false;
  }

  // clip animation (floors above slide away)
  const clipAnim = { from: 1e4, to: 1e4, t: 1 };
  function setClip(h) {
    clipAnim.from = Math.min(clipPlane.constant, 60);
    clipAnim.to = h; clipAnim.t = 0;
  }
  function stepClip(dt) {
    if (clipAnim.t >= 1) return;
    clipAnim.t = Math.min(1, clipAnim.t + dt / 0.9);
    const k = ease(clipAnim.t);
    const v = clipAnim.from + (Math.min(clipAnim.to, 60) - clipAnim.from) * k;
    clipPlane.constant = clipAnim.t >= 1 && clipAnim.to > 1000 ? 1e4 : v;
  }

  function removeInterior() {
    if (!interior) return;
    scene.remove(interior.group);
    // CSS2D elements are not detached automatically when their parent group leaves the scene
    interior.labels.forEach((o) => o.element.remove());
    interior = null;
  }

  function selectFloor(fl) {
    if (selectedFloor === fl) return;
    if (!selectedFloor) savedView = { pos: camera.position.clone(), target: controls.target.clone() };
    removeInterior();
    setHoverFloor(null);
    selectedFloor = fl; selectedApt = null; hoveredApt = null;
    interior = getInterior(fl);
    interior.aptMeshes.forEach(paintApt);
    scene.add(interior.group);
    const base = floorBase(fl);
    setClip(base + 0.001);
    const target = new THREE.Vector3(0, base, 2);
    const offset = isMobile ? new THREE.Vector3(8, 150, 82) : new THREE.Vector3(16, 74, 58);
    flyTo(target.clone().add(offset), target);
    ui.openFloor(fl);
    setTimeout(setShiftTarget, 60);
    document.body.classList.add('cutaway');
  }

  function back() {
    if (!selectedFloor) return;
    removeInterior();
    selectedFloor = null; selectedApt = null; hoveredApt = null;
    setClip(1e4);
    if (savedView) flyTo(savedView.pos, savedView.target);
    ui.closeFloor();
    viewShift.tx = 0; viewShift.ty = 0;
    document.body.classList.remove('cutaway');
  }

  // ------------------------------------------------ UI
  let lastPointer = { x: 0, y: 0 };
  const ui = createUI(data, {
    onHoverFloor: (fl, fromRail) => {
      if (selectedFloor) return;
      setHoverFloor(fl);
      if (fromRail) ui.hideTip();
    },
    onSelectFloor: (fl) => selectFloor(fl),
    onBack: back,
    onHoverApt: (a) => setHoverApt(a),
    onSelectApt: (a) => {
      selectedApt = a;
      if (interior) interior.aptMeshes.forEach(paintApt);
      if (a && interior) {
        const m = aptMeshFor(a.id);
        if (m) {
          m.geometry.computeBoundingBox();
          const c = m.geometry.boundingBox.getCenter(new THREE.Vector3());
          const off = isMobile ? new THREE.Vector3(6, 60, 40) : new THREE.Vector3(8, 38, 31);
          flyTo(c.clone().add(off), c, 1.0);
        }
      }
    },
    onTime: (minutes, live) => {
      timeState.live = live;
      if (!live) timeState.minutes = minutes;
      applyTime();
    },
  });

  // ------------------------------------------------ picking
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = null;
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (selectedFloor && interior) {
      const hit = raycaster.intersectObjects(interior.aptMeshes, false)[0];
      return { apt: hit ? hit.object.userData.apt : null };
    }
    const hits = raycaster.intersectObjects(bld.hitMeshes, false);
    return { floor: hits.length ? hits[0].object.userData.floor : null };
  }
  const el = renderer.domElement;
  el.addEventListener('pointermove', (e) => {
    lastPointer = { x: e.clientX, y: e.clientY };
    if (e.pointerType === 'touch') return;
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) { ui.hideTip(); return; }
    const p = pick(e);
    if (selectedFloor) {
      if ((p.apt && p.apt.id) !== (hoveredApt && hoveredApt.id)) setHoverApt(p.apt);
      if (p.apt) ui.showTip(e.clientX, e.clientY, ui.aptTipHTML(p.apt)); else ui.hideTip();
    } else {
      setHoverFloor(p.floor);
      if (p.floor) ui.showTip(e.clientX, e.clientY, ui.floorTipHTML(p.floor)); else ui.hideTip();
    }
  });
  el.addEventListener('pointerleave', () => { if (!selectedFloor) setHoverFloor(null); ui.hideTip(); });
  el.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  el.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    const quick = performance.now() - downAt.t < 600;
    downAt = null;
    if (moved > 6 || !quick) return;
    const p = pick(e);
    if (selectedFloor) {
      if (p.apt) ui.selectApt(p.apt);
    } else if (p.floor) {
      if (e.pointerType === 'touch' && hoveredFloor !== p.floor) {
        setHoverFloor(p.floor);
        ui.showTip(e.clientX, e.clientY, ui.floorTipHTML(p.floor) + `<div class="tt-cta">${t('viewFloor')} →</div>`);
        return;
      }
      ui.hideTip();
      selectFloor(p.floor);
    }
  });
  document.getElementById('tooltip').addEventListener('click', () => { if (hoveredFloor && !selectedFloor) selectFloor(hoveredFloor); });

  // shift the projection centre so the building is not hidden behind the side panel
  const viewShift = { x: 0, y: 0, tx: 0, ty: 0 };
  function panelShift() {
    if (!selectedFloor) return { x: 0, y: 0 };
    const p = document.getElementById('floor-panel').getBoundingClientRect();
    if (innerWidth <= 760) return { x: 0, y: Math.max(0, innerHeight - p.top) / 2 - 20 };
    return { x: -p.right / 2 + 110, y: 0 };
  }
  function setShiftTarget() { const s = panelShift(); viewShift.tx = s.x; viewShift.ty = s.y; }
  function applyViewOffset() {
    const w = innerWidth, h = innerHeight;
    if (Math.abs(viewShift.x) < 0.5 && Math.abs(viewShift.y) < 0.5) camera.clearViewOffset();
    else camera.setViewOffset(w, h, viewShift.x, viewShift.y, w, h);
  }
  function stepViewShift(dt) {
    const dx = viewShift.tx - viewShift.x, dy = viewShift.ty - viewShift.y;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      if (viewShift.x !== viewShift.tx || viewShift.y !== viewShift.ty) { viewShift.x = viewShift.tx; viewShift.y = viewShift.ty; applyViewOffset(); }
      return;
    }
    const k = Math.min(1, dt * 5);
    viewShift.x += dx * k; viewShift.y += dy * k;
    applyViewOffset();
  }

  // ------------------------------------------------ resize
  function resize() {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    setShiftTarget(); applyViewOffset();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    labelRenderer.setSize(w, h);
  }
  addEventListener('resize', resize);

  // ------------------------------------------------ start
  const startTarget = new THREE.Vector3(0, 11, 4);
  const startPos = isMobile ? new THREE.Vector3(82, 46, 142) : new THREE.Vector3(78, 34, 118);
  camera.position.set(240, 150, 420);
  controls.target.copy(startTarget);
  applyTime(true);
  setProgress(1);
  // compile shaders before revealing
  renderer.compile(scene, camera);
  await nextFrame();
  loaderEl.classList.add('done');
  setTimeout(() => loaderEl.remove(), 900);
  flyTo(startPos, startTarget, 3.2);

  const clock = new THREE.Clock();
  let since = 0;
  const tMin = new THREE.Vector3(-95, 0, -95), tMax = new THREE.Vector3(95, 40, 95);
  // adaptive quality: drop resolution on slow GPUs
  const perf = { frames: 0, time: 0, checks: 0 };
  function adapt(dt) {
    if (perf.checks > 6 || low) return;
    perf.frames++; perf.time += dt;
    if (perf.time < 2) return;
    const fps = perf.frames / perf.time;
    perf.frames = 0; perf.time = 0; perf.checks++;
    const pr = renderer.getPixelRatio();
    if (fps < 28 && pr > 1) {
      const next = Math.max(1, pr - 0.5);
      renderer.setPixelRatio(next); composer.setPixelRatio(next); resize();
    }
  }
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    since += dt;
    adapt(dt);
    controls.target.clamp(tMin, tMax);
    stepAnim(dt);
    stepClip(dt);
    stepViewShift(dt);
    controls.update();
    if (since > (timeState.live ? 10 : 0.25)) { since = 0; if (timeState.live) applyTime(); }
    lighting.tick(clock.elapsedTime);
    env.update(dt, envNight);
    // keep shadow camera centred on the view target
    composer.render();
    labelRenderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // debug / automation hooks
  window.__bahor = {
    selectFloor, back, setTime: (m) => { timeState.live = false; timeState.minutes = m; applyTime(true); },
    live: () => { timeState.live = true; applyTime(true); }, camera, controls, renderer, scene,
    selectApt: (id) => { const fd = byFloor.get(selectedFloor); const a = fd && fd.apartments.find((x) => x.id === id); if (a) ui.selectApt(a); },
    hover: (fl) => setHoverFloor(fl),
    fps: () => renderer.info.render.frame,
    view: (x, y, z, tx, ty, tz) => { anim.active = false; camera.position.set(x, y, z); controls.target.set(tx, ty, tz); controls.update(); },
    ready: true,
  };
}

main().catch((err) => {
  console.error(err);
  const m = document.getElementById('loader-msg');
  if (m) m.textContent = 'Xatolik: ' + err.message;
});
