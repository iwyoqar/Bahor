// Osmon, quyosh, oy, yulduzlar va kun vaqtiga qarab yorug'lik.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { CONFIG } from './config.js';
import { sunPosition } from './sun.js';

const RAD = Math.PI / 180;

function smooth(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

export function createLighting(scene, renderer, opts = {}) {
  const sky = new Sky();
  sky.scale.setScalar(4500);
  scene.add(sky);
  const su = sky.material.uniforms;
  su.turbidity.value = 5.5;
  su.rayleigh.value = 1.6;
  su.mieCoefficient.value = 0.004;
  su.mieDirectionalG.value = 0.86;

  // separate scene used only to bake the environment map from the sky
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(4500);
  envScene.add(envSky);
  const envNightColor = new THREE.Mesh(new THREE.SphereGeometry(4000, 16, 8), new THREE.MeshBasicMaterial({ color: 0x0b1020, side: THREE.BackSide, transparent: true, opacity: 0 }));
  envScene.add(envNightColor);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  const isMobile = matchMedia('(max-width: 760px)').matches || navigator.maxTouchPoints > 1;
  const sm = opts.low ? 1024 : isMobile ? 2048 : 4096;
  sun.shadow.mapSize.set(sm, sm);
  const sc = sun.shadow.camera;
  sc.left = -95; sc.right = 95; sc.top = 95; sc.bottom = -95; sc.near = 10; sc.far = 600;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.035;
  scene.add(sun); scene.add(sun.target);

  const moon = new THREE.DirectionalLight(0x9db4ff, 0);
  moon.position.set(-120, 160, 90);
  scene.add(moon);

  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x6a6150, 0.6);
  scene.add(hemi);

  // stars
  const starGeo = new THREE.BufferGeometry();
  const N = 2600;
  const sp = new Float32Array(N * 3);
  const ss = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = Math.random(), v = Math.random() * 0.95;
    const th = u * Math.PI * 2, ph = Math.acos(1 - v);
    const r = 3800;
    sp[i * 3] = r * Math.sin(ph) * Math.cos(th);
    sp[i * 3 + 1] = r * Math.cos(ph) + 60;
    sp[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    ss[i] = Math.random();
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  starGeo.setAttribute('aS', new THREE.BufferAttribute(ss, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `attribute float aS; varying float vS; uniform float uTime;
      void main(){ vS = aS; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = (0.8 + aS * 2.0) * (0.85 + 0.15 * sin(uTime * (1.0 + aS * 3.0) + aS * 40.0)); }`,
    fragmentShader: `varying float vS; uniform float uOpacity;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vec3(0.85, 0.9, 1.0), a * uOpacity * (0.35 + vS * 0.65)); }`,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  // moon disc
  const moonTexCanvas = document.createElement('canvas');
  moonTexCanvas.width = moonTexCanvas.height = 128;
  {
    const ctx = moonTexCanvas.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,252,240,1)'); g.addColorStop(0.42, 'rgba(240,238,225,1)');
    g.addColorStop(0.5, 'rgba(200,210,255,0.25)'); g.addColorStop(1, 'rgba(160,180,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(190,188,175,0.35)';
    [[50, 52, 9], [74, 70, 7], [60, 80, 5], [80, 48, 4]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); });
  }
  const moonTex = new THREE.CanvasTexture(moonTexCanvas); moonTex.colorSpace = THREE.SRGBColorSpace;
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, opacity: 0, fog: false }));
  moonSprite.scale.set(160, 160, 1);
  scene.add(moonSprite);

  const fog = new THREE.Fog(0xcfd8e3, 260, 1700);
  scene.fog = fog;

  const sunDir = new THREE.Vector3();
  const tmpColor = new THREE.Color();
  let lastEnvEl = 999, lastEnvAz = 999;
  const state = { elevation: 0, azimuth: 0, night: 0, day: 1 };

  // rotate astronomy into scene: facade (A) azimuth faces +z in scene
  const yaw = (CONFIG.facadeAzimuth - 180) * RAD;

  // ---- studio mode: isolated apartment model on a dark backdrop with warm light
  const studioBg = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 512;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#07080b'); g.addColorStop(0.55, '#141519'); g.addColorStop(1, '#1d1b18');
    x.fillStyle = g; x.fillRect(0, 0, 64, 512);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  let studio = null;
  function setStudio(on, center, size) {
    if (on) {
      studio = true;
      sky.visible = false; stars.visible = false; moonSprite.visible = false;
      scene.fog = null; scene.background = studioBg;
      moon.intensity = 0;
      sun.castShadow = true;
      sun.color.setRGB(1, 0.92, 0.8); sun.intensity = 2.6;
      sun.target.position.copy(center);
      sun.position.copy(center).add(new THREE.Vector3(-26, 58, 30));
      const r = size * 0.75 + 3;
      sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.updateProjectionMatrix();
      sun.shadow.bias = -0.0004;
      hemi.intensity = 0.8; hemi.color.setRGB(1, 0.95, 0.88); hemi.groundColor.setRGB(0.42, 0.38, 0.33);
      renderer.toneMappingExposure = 0.6;
      scene.environmentIntensity = 0.4;
    } else if (studio) {
      studio = null;
      sky.visible = true; stars.visible = true; moonSprite.visible = true;
      scene.fog = fog; scene.background = null;
      sc.left = -95; sc.right = 95; sc.top = 95; sc.bottom = -95; sc.updateProjectionMatrix();
      sun.shadow.bias = -0.00025;
      sun.target.position.set(0, 0, 0);
      lastEnvEl = 999;
    }
  }

  function update(date, { forceEnv = false } = {}) {
    if (studio) return state;
    const { lat, lon } = CONFIG.location;
    const p = sunPosition(date, lat, lon);
    state.elevation = p.elevation; state.azimuth = p.azimuth;
    // azimuth: 0 = north. scene north = -z when facade faces south (+z)
    const az = p.azimuth * RAD - yaw;
    const el = p.elevation * RAD;
    sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));

    su.sunPosition.value.copy(sunDir);
    envSky.material.uniforms.sunPosition.value.copy(sunDir);
    envSky.material.uniforms.turbidity.value = su.turbidity.value;
    envSky.material.uniforms.rayleigh.value = su.rayleigh.value;
    envSky.material.uniforms.mieCoefficient.value = su.mieCoefficient.value;
    envSky.material.uniforms.mieDirectionalG.value = su.mieDirectionalG.value;

    const e = p.elevation;
    const day = smooth(-4, 10, e);           // 0 at night, 1 in full day
    const golden = 1 - smooth(4, 22, e);     // warm light near horizon
    const night = 1 - smooth(-8, 2, e);
    state.day = day; state.night = night;

    // sun light
    sun.position.copy(sunDir).multiplyScalar(300);
    sun.target.position.set(0, 0, 0);
    tmpColor.setRGB(1, 0.97, 0.92).lerp(new THREE.Color(1.0, 0.62, 0.36), golden * 0.85);
    sun.color.copy(tmpColor);
    sun.intensity = 4.6 * smooth(-2, 6, e);
    sun.castShadow = e > -1;

    moon.intensity = 0.35 * night;
    const md = sunDir.clone().negate(); md.y = Math.abs(md.y) * 0.6 + 0.45; md.normalize();
    moon.position.copy(md).multiplyScalar(300);
    moonSprite.position.copy(md).multiplyScalar(3400);
    moonSprite.material.opacity = night;

    hemi.intensity = 0.1 + 0.34 * day;
    hemi.color.setRGB(0.8, 0.88, 1).lerp(new THREE.Color(0.42, 0.5, 0.75), night);
    hemi.groundColor.setRGB(0.42, 0.38, 0.31).lerp(new THREE.Color(0.08, 0.08, 0.1), night);

    starMat.uniforms.uOpacity.value = smooth(-2, -12, e);

    // fog tint follows sky
    const dayFog = new THREE.Color(0xc4d3e3);
    const duskFog = new THREE.Color(0xd9a98a);
    const nightFog = new THREE.Color(0x0b1220);
    fog.color.copy(dayFog).lerp(duskFog, golden * day * 0.7).lerp(nightFog, night);
    fog.near = 380; fog.far = 2100 + 900 * day;

    renderer.toneMappingExposure = 0.4 + 0.36 * night;
    su.rayleigh.value = 1.05 + golden * 1.6;
    su.turbidity.value = 2.6 + golden * 6;

    envNightColor.material.opacity = night * 0.92;

    if (forceEnv || Math.abs(lastEnvEl - e) > 1.2 || Math.abs(lastEnvAz - p.azimuth) > 6) {
      lastEnvEl = e; lastEnvAz = p.azimuth;
      if (envRT) envRT.dispose();
      envRT = pmrem.fromScene(envScene, 0, 1, 5000);
      scene.environment = envRT.texture;
      scene.environmentIntensity = 0.25 + 0.4 * day;
    }
    return state;
  }

  function tick(t) { starMat.uniforms.uTime.value = t; }

  return { update, tick, state, sun, hemi, sky, setStudio };
}
