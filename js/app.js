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
import { buildFurnishing, setFurnishingNight } from './furniture.js';
import { buildApartmentModel } from './aptview.js';
import { buildEnvironment } from './environment.js';
import { createLighting } from './lighting.js';
import { createUI } from './ui.js';
import { t, fmtArea, roomName } from './i18n.js';
import { dateFromLocal } from './sun.js';

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
  // ?capture=1&t=1020&pr=2 : clean frame without UI (source images for AI photo-real renders)
  const capture = params.has('capture');
  if (capture) document.body.classList.add('capture');
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(params.get('pr') ? +params.get('pr') : low ? 1 : Math.min(devicePixelRatio, isMobile ? 1.5 : 1.75));
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

  // fixed viewing angle: no orbiting or panning, only zoom (towards the cursor) within limits
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enableRotate = false;
  controls.enablePan = false;
  controls.zoomToCursor = true;
  controls.zoomSpeed = 0.9;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

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
  // soft light for the furnished interior of a selected floor (stronger at night)
  const interiorLight = new THREE.HemisphereLight(0xfff1dc, 0x9c8b74, 0);
  scene.add(interiorLight);

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

  // floor light drawn over the photo-real hero: depth pre-pass of all floors, then the hovered floor
  const overlayScene = new THREE.Scene();
  const ovDepthMat = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const ovFillMat = new THREE.MeshBasicMaterial({ color: 0xf2c061, transparent: true, opacity: 0.34, depthWrite: false, toneMapped: false });
  const ovLineMat = new THREE.LineBasicMaterial({ color: 0xffe3a6, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
  const ov = new Map();
  for (const f of floors) {
    const h = hl.get(f.floor);
    const depth = new THREE.Mesh(h.mesh.geometry, ovDepthMat); depth.renderOrder = 0;
    const fill = new THREE.Mesh(h.mesh.geometry, ovFillMat); fill.renderOrder = 1; fill.visible = false;
    const lines = new THREE.LineSegments(h.lines.geometry, ovLineMat); lines.renderOrder = 2; lines.visible = false;
    overlayScene.add(depth, fill, lines);
    ov.set(f.floor, { fill, lines });
  }

  // ------------------------------------------------ post processing
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: low ? 0 : isMobile ? 2 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.35, 0.55, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ------------------------------------------------ fixed daytime light
  const TZ = CONFIG.location.tz;
  const FT = CONFIG.fixedTime;
  const fixedDate = dateFromLocal({ y: FT.y, m: FT.m, d: FT.d }, FT.minutes, TZ);
  function applyTime(force = false) {
    lighting.update(fixedDate, { forceEnv: force });
    mats.uniforms.night.value = 0;
    mats.uniforms.winIntensity.value = 0.2;
    mats.uniforms.uplight.value = 0;
    if (!aptView) { bloom.strength = 0.15; bloom.threshold = 0.92; }
    if (bld.root.userData.signMat) bld.root.userData.signMat.emissiveIntensity = 0.2;
    setFurnishingNight(aptView ? 0.55 : 0);
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
    ov.forEach((o, f) => { o.fill.visible = o.lines.visible = f === fl && !selectedFloor; });
    ui.setHoverFloor(fl);
    renderer.domElement.style.cursor = fl ? 'pointer' : '';
  }

  function aptMeshFor(id) { return interior ? interior.aptMeshes.find((m) => m.userData.apt.id === id) : null; }

  function paintApt(m) {
    const a = m.userData.apt;
    const on = (hoveredApt && hoveredApt.id === a.id) || (selectedApt && selectedApt.id === a.id);
    const sel = selectedApt && selectedApt.id === a.id;
    m.material.opacity = sel ? 0.34 : on ? 0.22 : 0;
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
    const it = buildInterior(fd, buildFurnishing);
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

  // ------------------------------------------------ fixed camera angles
  const homeTarget = new THREE.Vector3(0, 11, 4);
  // elevated three-quarter aerial view, looking slightly down (hero frame for the AI renders)
  const homeOffset = isMobile ? new THREE.Vector3(80, 50, 136) : new THREE.Vector3(64, 37, 94);
  const floorOffset = isMobile ? new THREE.Vector3(8, 150, 82) : new THREE.Vector3(16, 74, 58);
  const VIEWS = {
    home: { dir: homeOffset.clone().normalize(), dist: homeOffset.length(), min: isMobile ? 62 : 52, max: homeOffset.length() * 1.08,
      bmin: new THREE.Vector3(-38, 2, -24), bmax: new THREE.Vector3(38, 26, 30) },
    floor: { fixY: true, dir: floorOffset.clone().normalize(), dist: floorOffset.length(), min: isMobile ? 40 : 26, max: floorOffset.length() * 1.1,
      bmin: new THREE.Vector3(-38, 0, -24), bmax: new THREE.Vector3(38, 40, 26) },
  };
  let view = VIEWS.home;
  let viewHome = homeTarget.clone();
  function useView(v, home) {
    view = v; viewHome = home.clone();
    controls.minDistance = v.min; controls.maxDistance = v.max;
  }
  const tmpV = new THREE.Vector3();
  function enforceView(dt) {
    if (anim.active) return;
    const t = controls.target;
    t.clamp(view.bmin, view.bmax);
    if (view.fixY) t.y = viewHome.y;
    let d = camera.position.distanceTo(t);
    d = Math.min(Math.max(d, view.min), view.max);
    // when zoomed out, drift back to the default framing
    const k = Math.min(1, Math.max(0, (d - (view.min + 0.7 * (view.max - view.min))) / (0.3 * (view.max - view.min))));
    if (k > 0) t.lerp(viewHome, Math.min(1, k * dt * 4));
    camera.position.copy(tmpV.copy(view.dir).multiplyScalar(d).add(t));
  }

  // ------------------------------------------------ camera animation
  const anim = { active: false };
  function flyTo(pos, target, dur = 1.4, done = null) {
    anim.active = true;
    anim.done = done;
    anim.t = 0; anim.dur = dur;
    anim.p0 = camera.position.clone(); anim.p1 = pos.clone();
    anim.t0 = controls.target.clone(); anim.t1 = target.clone();
    controls.minDistance = 0; controls.maxDistance = Infinity;   // limits apply again after the flight
  }
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  function stepAnim(dt) {
    if (!anim.active) return;
    anim.t += dt / anim.dur;
    const k = ease(Math.min(anim.t, 1));
    camera.position.lerpVectors(anim.p0, anim.p1, k);
    controls.target.lerpVectors(anim.t0, anim.t1, k);
    if (anim.t >= 1) {
      anim.active = false; controls.minDistance = view.min; controls.maxDistance = view.max;
      if (anim.done) { const d = anim.done; anim.done = null; d(); }
    }
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

  // ------------------------------------------------ isolated apartment model (like a dollhouse)
  let aptView = null;           // { model, labels, apt }
  const aptModels = new Map();
  const aptDir = new THREE.Vector3(0.55, 1.0, 0.85).normalize();
  function enterApt(a) {
    if (aptView && aptView.apt.id === a.id) return;
    if (aptView) leaveApt(false);
    const fd = byFloor.get(selectedFloor);
    let model = aptModels.get(a.id);
    if (!model) { model = buildApartmentModel(fd, a); aptModels.set(a.id, model); }
    // hide building, surroundings and the floor cutaway
    bld.root.visible = false; env.group.visible = false;
    if (interior) { interior.group.visible = false; interior.labels.forEach((o) => { o.element.style.display = 'none'; }); }
    scene.add(model.group);
    lighting.setStudio(true, model.center, model.size);
    bloom.strength = 0.22; bloom.threshold = 0.86;
    setFurnishingNight(0.55);
    // room hotspots
    const labels = model.spots.map((sp) => {
      const div = document.createElement('div');
      div.className = 'room-dot';
      div.innerHTML = `<i></i><span>${roomName(sp.n)}${sp.a ? `<b>${fmtArea(sp.a)} m²</b>` : ''}</span>`;
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        const tgt = sp.pos.clone(); tgt.y = model.center.y;
        const d = Math.max(7, Math.max(sp.w, sp.d) * 1.9 + 3);
        flyTo(tgt.clone().add(aptDir.clone().multiplyScalar(d)), tgt, 0.9);
      });
      const o = new CSS2DObject(div);
      o.position.copy(sp.pos);
      model.group.add(o);
      return o;
    });
    aptView = { model, labels, apt: a };
    // distance so the whole apartment fits the free part of the screen (right panel on desktop)
    const freeW = innerWidth <= 760 ? innerWidth : innerWidth - 460;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (freeW / innerHeight);
    const dist = Math.max(model.size * 1.35 + 5, (model.size * (innerWidth <= 760 ? 0.5 : 0.6)) / tanH + 2);
    VIEWS.apt = { fixY: true, dir: aptDir, dist, min: dist * 0.35, max: dist * 1.3,
      bmin: model.center.clone().addScalar(-model.size * 0.6), bmax: model.center.clone().addScalar(model.size * 0.6) };
    useView(VIEWS.apt, model.center);
    flyTo(model.center.clone().add(aptDir.clone().multiplyScalar(dist)), model.center, 1.2);
    document.body.classList.add('apt-mode');
    renderer.domElement.style.cursor = '';
    ui.hideTip();
    setTimeout(setShiftTarget, 60);
  }

  function leaveApt(toFloor = true) {
    if (!aptView) return;
    scene.remove(aptView.model.group);
    aptView.labels.forEach((o) => { o.element.remove(); aptView.model.group.remove(o); });
    aptView = null;
    lighting.setStudio(false);
    bld.root.visible = true; env.group.visible = true;
    if (interior) { interior.group.visible = true; interior.labels.forEach((o) => { o.element.style.display = ''; }); }
    document.body.classList.remove('apt-mode');
    applyTime(true);
    if (toFloor && selectedFloor) {
      const target = new THREE.Vector3(0, floorBase(selectedFloor), 2);
      useView(VIEWS.floor, target);
      flyTo(target.clone().add(floorOffset), target, 1.2);
    }
    setTimeout(setShiftTarget, 60);
  }

  function selectFloor(fl) {
    if (selectedFloor === fl) return;
    if (aptView) leaveApt(false);
    setPhoto(false);
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
    useView(VIEWS.floor, target);
    flyTo(target.clone().add(floorOffset), target);
    ui.openFloor(fl);
    setTimeout(setShiftTarget, 60);
    document.body.classList.add('cutaway');
  }

  function back() {
    if (!selectedFloor) return;
    if (aptView) leaveApt(false);
    removeInterior();
    selectedFloor = null; selectedApt = null; hoveredApt = null;
    setClip(1e4);
    useView(VIEWS.home, homeTarget);
    // back home: the photo-real hero takes over again once the camera has landed
    const homePos = homeTarget.clone().add(homeOffset);
    flyTo(homePos, homeTarget, 1.4, () => { if (!selectedFloor) setPhoto(true); });
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
      if (a && selectedFloor) enterApt(a);
      else if (!a) leaveApt(true);
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
    if (aptView) return {};
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
    if (aptView) return { x: (innerWidth - p.left) / 2 - 10, y: 0 };   // panel on the right
    return { x: -p.right / 2 + 110, y: 0 };
  }
  function setShiftTarget() { const s = panelShift(); viewShift.tx = s.x; viewShift.ty = s.y; }
  function applyViewOffset() {
    const w = innerWidth, h = innerHeight;
    if (photo.active) {
      if (photo.z > 1.0001) camera.setViewOffset(w, h, photo.x0, photo.y0, w / photo.z, h / photo.z);
      else camera.clearViewOffset();
      return;
    }
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

  // ------------------------------------------------ photo-real hero (desktop home view)
  const heroEl = document.getElementById('hero');
  const heroImg = document.getElementById('hero-photo');
  const HERO_ASPECT = CONFIG.hero.aspect;
  const BASE_FOV = camera.fov;
  const photo = { loaded: false, enabled: false, active: false, z: 1, x0: 0, y0: 0 };
  const photoAllowed = () => photo.loaded && !isMobile && !capture && innerWidth > 760;
  function frameFov() {
    // on screens wider than the photo keep the photo's horizontal field of view
    const A = innerWidth / innerHeight;
    if (isMobile || A <= HERO_ASPECT) return BASE_FOV;
    return 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2)) * HERO_ASPECT / A));
  }
  function layoutPhoto() {
    const W = innerWidth, H = innerHeight;
    let pw, ph;
    if (W / H <= HERO_ASPECT) { ph = H; pw = H * HERO_ASPECT; } else { pw = W; ph = W / HERO_ASPECT; }
    Object.assign(heroImg.style, { width: pw + 'px', height: ph + 'px', left: (W - pw) / 2 + 'px', top: (H - ph) / 2 + 'px' });
    heroEl.style.transform = `scale(${photo.z}) translate(${-photo.x0}px, ${-photo.y0}px)`;
  }
  function resetPhotoZoom() { photo.z = 1; photo.x0 = 0; photo.y0 = 0; layoutPhoto(); }
  function photoZoom(cx, cy, factor) {
    const W = innerWidth, H = innerHeight;
    const z0 = photo.z, z1 = Math.min(2.2, Math.max(1, z0 * factor));
    const qx = photo.x0 + cx / z0, qy = photo.y0 + cy / z0;   // point under the cursor stays put
    photo.z = z1;
    photo.x0 = Math.min(Math.max(qx - cx / z1, 0), W - W / z1);
    photo.y0 = Math.min(Math.max(qy - cy / z1, 0), H - H / z1);
    layoutPhoto(); applyViewOffset();
  }
  function setPhoto(on, fade = true) {
    if (!photo.enabled) on = false;
    const canvas = renderer.domElement;
    if (on) {
      if (photo.active) return;
      resetPhotoZoom();
      document.body.classList.add('photo');
      controls.enabled = false;
      const go = () => { photo.active = true; applyViewOffset(); canvas.style.transition = 'none'; canvas.style.opacity = '1'; requestAnimationFrame(() => { canvas.style.transition = ''; }); };
      if (fade) { canvas.style.opacity = '0'; setTimeout(go, 460); } else go();
    } else {
      if (!photo.active && !document.body.classList.contains('photo')) return;
      photo.active = false;
      resetPhotoZoom();
      controls.enabled = true;
      applyViewOffset();
      canvas.style.transition = 'none'; canvas.style.opacity = '0';
      requestAnimationFrame(() => { canvas.style.transition = ''; canvas.style.opacity = '1'; });
      setTimeout(() => { if (!photo.active) document.body.classList.remove('photo'); }, 520);
    }
  }
  el.addEventListener('wheel', (e) => {
    if (!photo.active) return;
    e.preventDefault();
    photoZoom(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
  }, { passive: false });

  // ------------------------------------------------ resize
  function resize() {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h; camera.fov = frameFov(); camera.updateProjectionMatrix();
    const was = photo.enabled;
    photo.enabled = photoAllowed();
    if (photo.enabled) layoutPhoto();
    if (was && !photo.enabled) setPhoto(false);
    if (!was && photo.enabled && !selectedFloor) setPhoto(true);
    setShiftTarget(); applyViewOffset();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    labelRenderer.setSize(w, h);
  }
  addEventListener('resize', resize);
  addEventListener('sheetchange', () => setShiftTarget());

  // ------------------------------------------------ start
  const startTarget = homeTarget.clone();
  const startPos = homeTarget.clone().add(homeOffset);
  useView(VIEWS.home, homeTarget);
  camera.position.copy(homeTarget.clone().add(homeOffset.clone().multiplyScalar(2.6)));
  controls.target.copy(startTarget);
  applyTime(true);
  if (CONFIG.hero.desktop && !isMobile && !capture) {
    heroImg.src = CONFIG.hero.desktop;
    try { await heroImg.decode(); photo.loaded = true; } catch (e) { console.warn('hero image', e); }
  }
  camera.fov = frameFov(); camera.updateProjectionMatrix();
  photo.enabled = photoAllowed();
  setProgress(1);
  // compile shaders before revealing
  renderer.compile(scene, camera);
  await nextFrame();
  loaderEl.classList.add('done');
  setTimeout(() => loaderEl.remove(), 900);
  if (capture || photo.enabled) camera.position.copy(startPos); else flyTo(startPos, startTarget, 3.2);
  if (photo.enabled) { layoutPhoto(); setPhoto(true, false); document.body.classList.add('photo-intro'); }

  const clock = new THREE.Clock();
  let since = 0;
  // adaptive quality: drop resolution on slow GPUs
  const perf = { frames: 0, time: 0, checks: 0 };
  function adapt(dt) {
    if (perf.checks > 6 || low || capture) return;
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
    stepAnim(dt);
    stepClip(dt);
    stepViewShift(dt);
    controls.update();
    enforceView(dt);
    interiorLight.intensity = selectedFloor && !aptView ? 0.3 + 1.2 * envNight : 0;
    lighting.tick(clock.elapsedTime);
    env.update(dt, envNight);
    // keep shadow camera centred on the view target
    if (photo.active) {
      renderer.setRenderTarget(null);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(overlayScene, camera);
    } else {
      renderer.setClearColor(0x000000, 1);
      composer.render();
    }
    labelRenderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // debug / automation hooks
  window.__bahor = {
    selectFloor, back, camera, controls, renderer, scene,
    selectApt: (id) => { const fd = byFloor.get(selectedFloor); const a = fd && fd.apartments.find((x) => x.id === id); if (a) ui.selectApt(a); },
    hover: (fl) => setHoverFloor(fl),
    aptMode: () => !!aptView,
    photo: () => photo.active,
    hovered: () => hoveredFloor,
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
