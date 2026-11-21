// Bino atrofida 360° aylanish: fotorealistik kadrlar ketma-ketligi (assets/orbit/0000.webp ...).
// 0-kadr bosh ko'rinish (hero surati) bilan bir xil burchak; i-kadr = i * 360 / frames gradus.
// Kadrlar docs/orbit-360.md bo'yicha tayyorlanadi (tools/orbit.mjs).

export function createOrbit(canvas, cfg) {
  const N = cfg.frames || 0;
  const ctx = canvas.getContext('2d');
  const frames = new Array(N).fill(null);
  const stills = new Map();
  const name = (i) => `${cfg.dir}/${String(i).padStart(4, '0')}.${cfg.ext || 'webp'}`;
  const api = { canvas, ready: false, load, show };
  let shown = -1, want = 0;

  function loadOne(i) {
    return new Promise((res) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { frames[i] = im; res(true); };
      im.onerror = () => res(false);
      im.src = name(i);
    });
  }

  /** coarse pass first (the turn works right away), then the frames in between */
  async function load() {
    if (!N) return false;
    const order = [], seen = new Set();
    for (let step = Math.max(1, Math.round(N / 16)); ; step = Math.floor(step / 2)) {
      for (let i = 0; i < N; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
      if (step <= 1) break;
    }
    const first = order.splice(0, Math.min(order.length, Math.ceil(N / Math.max(1, Math.round(N / 16)))));
    const ok = await Promise.all(first.map(loadOne));
    if (!ok.every(Boolean)) return false;       // no frames yet: the hero stays a single photo
    api.ready = true;
    (async () => {
      for (let i = 0; i < order.length; i += 6) await Promise.all(order.slice(i, i + 6).map(loadOne));
    })();
    return true;
  }

  function nearest(i) {
    for (let d = 0; d <= N / 2; d++) {
      if (frames[(i + d) % N]) return (i + d) % N;
      if (frames[(i - d + N) % N]) return (i - d + N) % N;
    }
    return -1;
  }

  function draw(im) {
    const w = im.naturalWidth, h = im.naturalHeight;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.drawImage(im, 0, 0);
  }

  /** show the frame for an angle; settled: the turn has stopped (sharp still, or the hero photo at 0°) */
  function show(deg, settled) {
    if (!api.ready) return;
    const i = Math.round((deg / 360) * N) % N;
    want = i;
    if (settled && i === 0) { canvas.classList.remove('on'); shown = -1; return; }
    const k = nearest(i);
    if (k < 0) return;
    if (k !== shown) { draw(frames[k]); shown = k; }
    canvas.classList.add('on');
    if (!settled || !cfg.stills || !cfg.stops) return;
    const stop = (deg / 360) * cfg.stops;
    if (Math.abs(stop - Math.round(stop)) > 0.01) return;
    const s = Math.round(stop) % cfg.stops;
    const put = (im) => { if (want === i && shown === k) { draw(im); shown = -2; } };
    if (stills.has(s)) { if (stills.get(s)) put(stills.get(s)); return; }
    stills.set(s, null);
    const im = new Image();
    im.onload = () => { stills.set(s, im); put(im); };
    im.src = `${cfg.dir}/still-${s}.jpg`;
  }

  return api;
}
