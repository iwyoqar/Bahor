// 2D qavat rejasi: vektor sxema yoki asl chizma ustida interaktiv xonadonlar.
import { t, roomName, fmtArea } from './i18n.js';
import { APT_COLORS } from './building.js';

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function ringPath(r) {
  return 'M' + r.map(([x, y]) => `${x.toFixed(2)} ${(-y).toFixed(2)}`).join('L') + 'Z';
}

export class PlanViewer {
  constructor(host, { onHover, onSelect }) {
    this.host = host;
    this.onHover = onHover;
    this.onSelect = onSelect;
    this.mode = 'scheme';
    this.svg = el('svg', { class: 'plan-svg', preserveAspectRatio: 'xMidYMid meet' }, host);
    this.vb = { x: 0, y: 0, w: 100, h: 60 };
    this.pointers = new Map();
    this._bind();
  }

  _bind() {
    const svg = this.svg;
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = Math.exp(e.deltaY * 0.0015);
      this._zoomAt(e.clientX, e.clientY, f);
    }, { passive: false });
    svg.addEventListener('pointerdown', (e) => {
      svg.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.dragMoved = 0;
    });
    svg.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      const prev = this.pointers.get(e.pointerId);
      const cur = { x: e.clientX, y: e.clientY };
      if (this.pointers.size === 1) {
        const s = this._scale();
        this.vb.x -= (cur.x - prev.x) * s;
        this.vb.y -= (cur.y - prev.y) * s;
        this.dragMoved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
        this._apply();
      } else if (this.pointers.size === 2) {
        const pts = [...this.pointers.values()];
        const other = pts.find((p) => p !== prev);
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
        const d1 = Math.hypot(cur.x - other.x, cur.y - other.y);
        if (d0 > 0 && d1 > 0) this._zoomAt((cur.x + other.x) / 2, (cur.y + other.y) / 2, d0 / d1);
        this.dragMoved += 10;
      }
      this.pointers.set(e.pointerId, cur);
    });
    const up = (e) => { this.pointers.delete(e.pointerId); };
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
  }

  _scale() {
    const r = this.svg.getBoundingClientRect();
    return Math.max(this.vb.w / r.width, this.vb.h / r.height);
  }

  _zoomAt(cx, cy, f) {
    const r = this.svg.getBoundingClientRect();
    const s = this._scale();
    // account for meet letterboxing
    const offX = (r.width - this.vb.w / s) / 2, offY = (r.height - this.vb.h / s) / 2;
    const px = this.vb.x + (cx - r.left - offX) * s;
    const py = this.vb.y + (cy - r.top - offY) * s;
    const nw = Math.min(Math.max(this.vb.w * f, 6), this.fit.w * 1.6);
    const k = nw / this.vb.w;
    this.vb.x = px - (px - this.vb.x) * k;
    this.vb.y = py - (py - this.vb.y) * k;
    this.vb.w *= k; this.vb.h *= k;
    this._apply();
  }

  _apply() {
    const { x, y, w, h } = this.vb;
    this.svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    // room names appear once the plan is large enough on screen
    const r = this.svg.getBoundingClientRect();
    const pxPerM = Math.min(r.width / w, r.height / h);
    this.svg.classList.toggle('show-rooms', pxPerM > 15);
  }

  resetView() {
    this.vb = { ...this.fit };
    this._apply();
  }

  show(fd) {
    this.fd = fd;
    const svg = this.svg;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    // bounds
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of fd.mass) for (const [x, y] of p.o) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (const a of fd.apartments) for (const r of a.ter) for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const m = 2;
    this.fit = { x: x0 - m, y: -y1 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m };

    const defs = el('defs', {}, svg);
    const hatch = el('pattern', { id: 'terrace-hatch', width: 0.6, height: 0.6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('rect', { width: 0.6, height: 0.6, fill: '#d9e7c9' }, hatch);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 0.6, stroke: '#9cb98a', 'stroke-width': 0.12 }, hatch);

    // original drawing (raster) layer
    const pl = fd.plan;
    this.imgLayer = el('g', { class: 'layer-img' }, svg);
    el('image', { href: pl.src, x: pl.x0, y: -pl.y1, width: pl.x1 - pl.x0, height: pl.y1 - pl.y0, preserveAspectRatio: 'none' }, this.imgLayer);

    // vector scheme layers
    this.schemeLayer = el('g', { class: 'layer-scheme' }, svg);
    for (const p of fd.mass) el('path', { d: ringPath(p.o) + (p.h || []).map(ringPath).join(''), class: 'slab', 'fill-rule': 'evenodd' }, this.schemeLayer);
    for (const a of fd.apartments) for (const r of a.ter) el('path', { d: ringPath(r), class: 'terrace', fill: 'url(#terrace-hatch)' }, this.schemeLayer);

    this.aptLayer = el('g', { class: 'layer-apts' }, svg);
    this.aptEls = new Map();
    fd.apartments.forEach((a, k) => {
      const d = a.polys.map(ringPath).join('');
      const path = el('path', { d, class: 'apt' + (a.commercial ? ' commercial' : ''), 'data-id': a.id }, this.aptLayer);
      path.style.setProperty('--c', a.commercial ? '#d7dde6' : APT_COLORS[k % APT_COLORS.length]);
      path.addEventListener('pointerenter', () => this.onHover && this.onHover(a));
      path.addEventListener('pointerleave', () => this.onHover && this.onHover(null));
      path.addEventListener('click', () => { if ((this.dragMoved || 0) < 6) this.onSelect && this.onSelect(a); });
      this.aptEls.set(a.id, path);
    });

    const walls = fd.walls.map((w) => ringPath(w.o) + w.h.map(ringPath).join('')).join('');
    this.wallLayer = el('path', { d: walls, class: 'walls', 'fill-rule': 'evenodd' }, svg);

    // labels
    this.labelLayer = el('g', { class: 'layer-labels' }, svg);
    this.roomLayer = el('g', { class: 'layer-rooms' }, svg);
    fd.apartments.forEach((a) => {
      const g = el('g', { class: 'apt-label', transform: `translate(${a.label[0]} ${-a.label[1]})` }, this.labelLayer);
      const num = a.id.split('-')[1].replace(/^0/, '');
      const area = fmtArea(a.area) + ' m²';
      const bw = Math.max(area.length, 3) * 0.52 + 1.0;
      el('rect', { x: -bw / 2, y: -1.05, width: bw, height: 2.1, rx: 0.35, class: 'lbl-bg' }, g);
      const t1 = el('text', { y: -0.2, class: 'lbl-num' }, g); t1.textContent = a.commercial ? t('commercial') : `№ ${num}`;
      const t2 = el('text', { y: 0.75, class: 'lbl-area' }, g); t2.textContent = area;
      for (const r of a.list) {
        if (!r.n || r.n === 'terrace' && !r.a) continue;
        const rg = el('g', { class: 'room-label', transform: `translate(${r.x} ${-r.y})` }, this.roomLayer);
        const rn = el('text', { y: -0.05, class: 'rm-name' }, rg); rn.textContent = roomName(r.n);
        if (r.a) { const ra = el('text', { y: 0.5, class: 'rm-area' }, rg); ra.textContent = fmtArea(r.a); }
      }
    });
    this.setMode(this.mode);
    this.resetView();
  }

  setMode(mode) {
    this.mode = mode;
    this.svg.classList.toggle('mode-drawing', mode === 'drawing');
    this.svg.classList.toggle('mode-scheme', mode === 'scheme');
  }

  highlight(id) {
    if (!this.aptEls) return;
    this.aptEls.forEach((p, k) => p.classList.toggle('hl', k === id));
  }

  select(id) {
    if (!this.aptEls) return;
    this.aptEls.forEach((p, k) => p.classList.toggle('sel', k === id));
  }
}
