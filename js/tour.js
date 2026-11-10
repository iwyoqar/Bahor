// Namunaviy xonadon bo'ylab video sayohat: binodan uchib kirish va xonama-xona videolar.
// Videolar CONFIG.tours da ro'yxatlanadi; bo'lmasa tugma ko'rinmaydi.
import { CONFIG } from './config.js';
import { t, roomName } from './i18n.js';

const $ = (s) => document.querySelector(s);

function centroid(a) {
  let x = 0, y = 0, n = 0;
  for (const p of a.polys) for (const [px, py] of p) { x += px; y += py; n++; }
  return [x / n, y / n];
}

/** tour for an apartment: its own, or the sample apartment with the same plan in the same stack */
export function createTours(data) {
  const all = new Map();
  for (const f of data.floors) for (const a of f.apartments) all.set(a.id, a);
  const tours = Object.entries(CONFIG.tours || {}).filter(([, v]) => v && v.clips && v.clips.length);
  return function tourFor(apt) {
    for (const [id, tour] of tours) {
      if (id === apt.id) return { id, ...tour };
      const src = all.get(id);
      if (!src || src.area !== apt.area) continue;
      const [x0, y0] = centroid(src), [x1, y1] = centroid(apt);
      if (Math.hypot(x0 - x1, y0 - y1) < 0.6) return { id, ...tour, sample: true };
    }
    return null;
  };
}

/** full-screen player: clips play one after another without gaps (two <video> elements) */
export function createTourPlayer() {
  const root = $('#tour');
  const vids = [...root.querySelectorAll('video')];
  const chapters = $('#tour-chapters');
  let tour = null, idx = 0, front = 0;

  const label = (c) => {
    if (c.key === 'flight') return t('tourFlight');
    const to = roomName(c.key) || c.key;
    return c.from ? `${roomName(c.from)} → ${to}` : to;
  };

  function load(v, clip) {
    if (!clip) { v.removeAttribute('src'); return; }
    if (v.dataset.src !== clip.src) {
      v.dataset.src = clip.src;
      if (clip.poster) v.poster = clip.poster; else v.removeAttribute('poster');
      v.src = clip.src; v.load();
    }
  }

  function show(i) {
    if (!tour) return;
    idx = Math.max(0, Math.min(i, tour.clips.length - 1));
    const cur = vids[front], nxt = vids[1 - front];
    load(cur, tour.clips[idx]);
    cur.currentTime = 0;
    cur.classList.add('on'); nxt.classList.remove('on');
    cur.play().catch(() => {});
    load(nxt, tour.clips[idx + 1]);   // preload the next clip
    chapters.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === idx));
  }

  function next() {
    if (!tour || idx >= tour.clips.length - 1) return;
    front = 1 - front;                   // the preloaded element becomes the visible one
    show(idx + 1);
  }

  vids.forEach((v) => {
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.addEventListener('ended', () => { if (v === vids[front]) next(); });
  });

  function open(tr) {
    tour = tr; front = 0;
    $('#tour-title').textContent = tr.title || t('tour');
    $('#tour-note').textContent = tr.sample ? t('tourSample') : '';
    chapters.innerHTML = '';
    tr.clips.forEach((c, i) => {
      const b = document.createElement('button');
      b.textContent = label(c);
      b.addEventListener('click', () => { vids[front].pause(); show(i); });
      chapters.appendChild(b);
    });
    root.classList.add('open');
    show(0);
  }

  function close() {
    root.classList.remove('open');
    vids.forEach((v) => { v.pause(); });
    tour = null;
  }

  $('#tour-close').addEventListener('click', close);
  addEventListener('keydown', (e) => {
    if (!root.classList.contains('open')) return;
    if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); }
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') show(idx - 1);
  }, true);
  return { open, close };
}
