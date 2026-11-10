// HTML interfeys: qavatlar ro'yxati, panel, xonadon kartochkasi, vaqt boshqaruvi, galereya.
import { CONFIG } from './config.js';
import { t, setLang, getLang, onLang, fmtMoney, fmtMln, fmtArea, roomName } from './i18n.js';
import { floorPrices, minPerM2, aptPrice, aptMinPrice } from './pricing.js';
import { PlanViewer } from './plan2d.js';
import { createTours, createTourPlayer } from './tour.js';

const $ = (s, r = document) => r.querySelector(s);

function aptNo(a) { return a.id.split('-')[1].replace(/^0/, ''); }

export function createUI(data, cb) {
  const floors = data.floors;
  const byFloor = new Map(floors.map((f) => [f.floor, f]));
  const state = { floor: null, apt: null, plan: 30, planMode: 'scheme', hoverFloor: null };

  const rail = $('#floor-rail .rail-list');
  const panel = $('#floor-panel');
  const tooltip = $('#tooltip');
  const planModal = $('#plan-modal');
  const tourFor = createTours(data);
  const player = createTourPlayer();
  const viewer = new PlanViewer($('#plan-host'), {
    onHover: (a) => { cb.onHoverApt(a); viewer.highlight(a ? a.id : null); showAptTip(a); },
    onSelect: (a) => { selectApt(a); },
  });

  // ---------------------------------------------------------------- static texts
  function applyTexts() {
    document.querySelectorAll('[data-t]').forEach((n) => { n.textContent = t(n.dataset.t); });
    $('#btn-lang').textContent = t('lang');
    $('#cta-call span').textContent = t('call');
    $('#cta-call').href = CONFIG.phoneHref;
    $('#parking-price').textContent = `${fmtMoney(CONFIG.parkingPrice)} ${t('sum')}`;
    const touch = matchMedia('(hover: none)').matches;
    $('#hint-text').textContent = touch ? t('hintTouch') : t('hint');
    buildRail();
    if (state.floor) renderFloor(state.floor, false);
    if (planModal.classList.contains('open') && state.floor) viewer.show(byFloor.get(state.floor));
  }

  // ---------------------------------------------------------------- floor rail
  function buildRail() {
    rail.innerHTML = '';
    [...floors].sort((a, b) => b.floor - a.floor).forEach((f) => {
      const b = document.createElement('button');
      b.className = 'rail-btn';
      b.dataset.floor = f.floor;
      const p = minPerM2(f.floor);
      const n = f.apartments.filter((a) => !a.commercial).length;
      b.innerHTML = `<span class="rb-num">${f.floor}</span><span class="rb-info"><b>${t('floor', { n: f.floor })}</b><small>${t('aptCount', { n })}</small><em>${p ? fmtMln(p) + ' / m²' : t('priceOnRequest')}</em></span>`;
      b.addEventListener('pointerenter', () => cb.onHoverFloor(f.floor, true));
      b.addEventListener('pointerleave', () => cb.onHoverFloor(null, true));
      b.addEventListener('click', () => cb.onSelectFloor(f.floor));
      if (state.floor === f.floor) b.classList.add('active');
      rail.appendChild(b);
    });
  }

  function setHoverFloor(fl) {
    state.hoverFloor = fl;
    rail.querySelectorAll('.rail-btn').forEach((b) => b.classList.toggle('hover', +b.dataset.floor === fl));
  }

  // ---------------------------------------------------------------- tooltip
  function showTip(x, y, html) {
    tooltip.innerHTML = html;
    tooltip.classList.add('show');
    const r = tooltip.getBoundingClientRect();
    let tx = x + 18, ty = y + 18;
    if (tx + r.width > innerWidth - 8) tx = x - r.width - 18;
    if (ty + r.height > innerHeight - 8) ty = y - r.height - 18;
    tooltip.style.transform = `translate(${Math.max(8, tx)}px, ${Math.max(8, ty)}px)`;
  }
  function hideTip() { tooltip.classList.remove('show'); }
  let lastPointer = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => { lastPointer = { x: e.clientX, y: e.clientY }; }, { passive: true });

  function floorTipHTML(fl) {
    const f = byFloor.get(fl);
    const p = floorPrices(fl);
    const n = f.apartments.filter((a) => !a.commercial).length;
    const com = f.apartments.filter((a) => a.commercial).length;
    const areas = f.apartments.filter((a) => !a.commercial).map((a) => a.area);
    const range = areas.length ? `${fmtArea(Math.min(...areas))}–${fmtArea(Math.max(...areas))} m²` : '';
    const priceRows = p ? CONFIG.paymentPlans.map((k) => `<div class="tt-row"><span>${k === 100 ? t('fullPayment') : `${k}% ${t('downPayment').toLowerCase()}`}</span><b>${fmtMoney(p[k])}</b></div>`).join('') : `<div class="tt-row"><span>${t('priceOnRequest')}</span></div>`;
    return `<div class="tt-title">${t('floor', { n: fl })}</div>
      <div class="tt-sub">${t('aptCount', { n })}${com ? ` · ${com} ${t('commercial').toLowerCase()}` : ''}${range ? ' · ' + range : ''}</div>
      <div class="tt-sec">${t('perM2')}, ${t('sum')}</div>${priceRows}`;
  }

  function aptTipHTML(a) {
    const fl = state.floor;
    const min = aptMinPrice(fl, a);
    const roomsTxt = a.commercial ? t('commercial') : t('roomsN', { n: a.rooms });
    return `<div class="tt-title">${a.commercial ? t('commercial') : `${t('apt')} ${t('aptNo', { n: aptNo(a) })}`}</div>
      <div class="tt-sub">${roomsTxt} · ${fmtArea(a.area)} m²${a.areaT ? ` (${t('areaTer').toLowerCase()} ${fmtArea(a.areaT)} m²)` : ''}</div>
      <div class="tt-price">${min ? t('priceFrom', { p: fmtMoney(min) }) : t('priceOnRequest')}</div>`;
  }

  function showAptTip(a) {
    if (!a) { hideTip(); return; }
    showTip(lastPointer.x, lastPointer.y, aptTipHTML(a));
  }

  // ---------------------------------------------------------------- mobile bottom sheet
  const mobile = () => innerWidth <= 760;
  function setExpanded(on) {
    panel.classList.toggle('expanded', !!on);
    document.body.classList.toggle('sheet-expanded', !!on);
    $('#fp-expand').textContent = on ? '▾' : '▴';
    setTimeout(() => dispatchEvent(new Event('sheetchange')), 380);
  }
  $('#fp-handle').addEventListener('click', () => setExpanded(!panel.classList.contains('expanded')));
  $('#fp-expand').addEventListener('click', () => setExpanded(!panel.classList.contains('expanded')));
  {
    // swipe the sheet up / down by its handle or header
    let y0 = null;
    const start = (e) => { y0 = e.clientY; };
    const end = (e) => {
      if (y0 === null) return;
      const dy = e.clientY - y0; y0 = null;
      if (dy < -30) setExpanded(true);
      else if (dy > 30) setExpanded(false);
    };
    for (const n of [$('#fp-handle'), panel.querySelector('.fp-head')]) {
      n.addEventListener('pointerdown', start);
      n.addEventListener('pointerup', end);
      n.addEventListener('pointercancel', () => { y0 = null; });
    }
  }

  // ---------------------------------------------------------------- floor panel
  function renderFloor(fl, scroll = true) {
    const f = byFloor.get(fl);
    const p = floorPrices(fl);
    const list = f.apartments;
    const n = list.filter((a) => !a.commercial).length;
    $('#fp-title').textContent = t('floor', { n: fl });
    $('#fp-sub').textContent = t('aptCount', { n });
    const pt = $('#fp-prices');
    if (p) {
      pt.innerHTML = `<div class="pt-head">${t('priceTable')}</div><div class="pt-grid">` + CONFIG.paymentPlans.map((k) => `
        <div class="pt-cell"><small>${k === 100 ? t('fullPayment') : `${k}%`}</small><b>${fmtMoney(p[k])}</b><span>${t('sum')} / m²</span></div>`).join('') + '</div>';
    } else {
      pt.innerHTML = `<div class="pt-head">${t('notInPrice')}</div><div class="pt-onreq">${t('priceOnRequest')}</div>`;
    }
    // compact chips (mobile, collapsed sheet)
    const chips = $('#fp-chips');
    chips.innerHTML = '';
    [...list].sort((a, b) => aptNo(a) - aptNo(b)).forEach((a) => {
      const c = document.createElement('button');
      c.className = 'apt-chip' + (state.apt && state.apt.id === a.id ? ' sel' : '');
      c.dataset.id = a.id;
      const min = aptMinPrice(fl, a);
      c.innerHTML = `<b>${a.commercial ? '★' : aptNo(a)}</b><span>${fmtArea(a.area)} m²<small>${min ? fmtMln(min) : (a.commercial ? t('commercial') : '—')}</small></span>`;
      c.addEventListener('click', () => selectApt(a));
      chips.appendChild(c);
    });
    const p0 = minPerM2(fl);
    $('#fp-sub').textContent = t('aptCount', { n }) + (p0 ? ` · ${fmtMln(p0)} / m²` : '');
    const ul = $('#fp-list');
    ul.innerHTML = '';
    [...list].sort((a, b) => aptNo(a) - aptNo(b)).forEach((a) => {
      const li = document.createElement('button');
      li.className = 'apt-card' + (state.apt && state.apt.id === a.id ? ' sel' : '');
      li.dataset.id = a.id;
      const min = aptMinPrice(fl, a);
      li.innerHTML = `<span class="ac-no">${a.commercial ? '★' : aptNo(a)}</span>
        <span class="ac-main"><b>${a.commercial ? t('commercial') : t('roomsN', { n: a.rooms })}</b>
        <small>${fmtArea(a.area)} m²${a.areaT ? ` · ${t('terraceBadge')}` : ''}</small></span>
        <span class="ac-price">${min ? fmtMln(min) : '—'}</span>`;
      li.addEventListener('pointerenter', () => cb.onHoverApt(a, true));
      li.addEventListener('pointerleave', () => cb.onHoverApt(null, true));
      li.addEventListener('click', () => selectApt(a));
      ul.appendChild(li);
    });
    if (state.apt) renderApt(state.apt); else $('#fp-detail').classList.remove('open');
    if (scroll) $('#fp-body').scrollTop = 0;
  }

  function openFloor(fl) {
    state.floor = fl; state.apt = null;
    renderFloor(fl);
    panel.classList.add('open');
    document.body.classList.add('floor-open');
    setExpanded(false);
    rail.querySelectorAll('.rail-btn').forEach((b) => b.classList.toggle('active', +b.dataset.floor === fl));
    hideTip();
  }

  function closeFloor() {
    state.floor = null; state.apt = null;
    panel.classList.remove('open');
    document.body.classList.remove('floor-open');
    panel.classList.remove('expanded');
    document.body.classList.remove('sheet-expanded');
    $('#fp-detail').classList.remove('open');
    rail.querySelectorAll('.rail-btn').forEach((b) => b.classList.remove('active'));
    closePlan();
  }

  function selectApt(a) {
    state.apt = a;
    cb.onSelectApt(a);
    renderApt(a);
    viewer.select(a ? a.id : null);
    document.querySelectorAll('.apt-card, .apt-chip').forEach((c) => c.classList.toggle('sel', !!a && c.dataset.id === a.id));
    if (a && mobile()) {
      const chip = document.querySelector(`.apt-chip[data-id="${a.id}"]`);
      if (chip) chip.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }

  function renderApt(a) {
    const box = $('#fp-detail');
    if (!a) { box.classList.remove('open'); dispatchEvent(new Event('sheetchange')); return; }
    const fl = state.floor;
    const rooms = a.list.filter((r) => r.n);
    const order = ['living', 'bedroom', 'kitchen', 'hall', 'bath', 'wc', 'storage', 'wardrobe', 'balcony', 'terrace'];
    rooms.sort((x, y) => order.indexOf(x.n) - order.indexOf(y.n));
    const roomsHTML = rooms.map((r) => `<li><span class="ri ri-${r.n}"></span><span>${roomName(r.n)}</span><b>${r.a ? fmtArea(r.a) + ' m²' : '—'}</b></li>`).join('');
    const pr = aptPrice(fl, a, state.plan);
    let priceHTML;
    if (!pr) {
      priceHTML = `<div class="calc-onreq">${t('priceOnRequest')}</div>`;
    } else {
      const tabs = CONFIG.paymentPlans.map((k) => `<button class="pl-tab${k === state.plan ? ' on' : ''}" data-plan="${k}">${k === 100 ? t('fullPayment') : k + '%'}</button>`).join('');
      priceHTML = `<div class="pl-tabs">${tabs}</div>
        <div class="calc">
          <div class="calc-row"><span>${t('perM2')}</span><b>${fmtMoney(pr.perM2)} ${t('sum')}</b></div>
          <div class="calc-row big"><span>${t('totalPrice')}</span><b>${fmtMoney(pr.total)} ${t('sum')}</b></div>
          ${pr.plan < 100 ? `
          <div class="calc-row"><span>${t('firstPayment')} (${pr.plan}%)</span><b>${fmtMoney(pr.first)} ${t('sum')}</b></div>
          <div class="calc-row"><span>${t('monthly')} <small>${t('months', { m: pr.months })}</small></span><b>${fmtMoney(pr.monthly)} ${t('sum')}</b></div>` : ''}
        </div>`;
    }
    box.innerHTML = `
      <div class="dt-head">
        <button class="icon-btn dt-back" aria-label="${t('back')}">←</button>
        <div><div class="dt-title">${a.commercial ? t('commercial') : `${t('apt')} ${t('aptNo', { n: aptNo(a) })}`}</div>
        <div class="dt-sub">${t('floor', { n: fl })}${a.commercial ? '' : ' · ' + t('roomsN', { n: a.rooms })}</div></div>
      </div>
      <div class="dt-mini"><div><b>${fmtArea(a.area)} m²</b><span>${a.commercial ? t('commercial') : t('roomsN', { n: a.rooms })} · ${aptMinPrice(fl, a) ? t('priceFrom', { p: fmtMln(aptMinPrice(fl, a)) }) : t('priceOnRequest')}</span></div>${tourFor(a) ? `<button class="btn small gold dt-tour dt-tour-mini" aria-label="${t('tour')}">▶</button>` : ''}<button class="btn small ${tourFor(a) ? 'ghost' : 'gold'} dt-more">${t('more')}</button></div>
      ${tourFor(a) ? `<button class="dt-tour-hero dt-tour"><span class="pl">▶</span><span><b>${t('tour')}</b><small>${t('tourHint')}</small></span></button>` : ''}
      <div class="dt-area"><b>${fmtArea(a.area)}</b><span>m²</span>${a.areaT ? `<em>${t('areaTer')}: ${fmtArea(a.areaT)} m²</em>` : ''}</div>
      ${a.commercial ? '' : `<div class="dt-stats">
        <div><b>${rooms.filter((r) => r.n === 'bedroom').length}</b><span>${t('statBed')}</span></div>
        <div><b>${rooms.filter((r) => r.n === 'bath' || r.n === 'wc').length}</b><span>${t('statBath')}</span></div>
        <div><b>${fmtArea(a.areaT || a.area)}</b><span>m²</span></div>
      </div>`}
      <div class="dt-from">${aptMinPrice(fl, a) ? t('priceFrom', { p: fmtMoney(aptMinPrice(fl, a)) }) : t('priceOnRequest')}</div>
      ${rooms.length ? `<div class="dt-sec">${t('rooms')}</div><ul class="rooms">${roomsHTML}</ul>` : ''}
      <div class="dt-sec">${t('installment', { m: CONFIG.installmentMonths })}</div>
      ${priceHTML}
      <div class="dt-actions">
        <button class="btn ghost dt-plan">${t('plan2d')}</button>
        <a class="btn gold" href="${CONFIG.phoneHref}">${t('call')}</a>
        <button class="btn ghost dt-tower">${t('backToBuilding')}</button>
      </div>`;
    box.classList.add('open');
    box.querySelector('.dt-back').addEventListener('click', () => selectApt(null));
    box.querySelector('.dt-plan').addEventListener('click', () => openPlan());
    box.querySelector('.dt-tower').addEventListener('click', () => cb.onBack());
    box.querySelectorAll('.dt-tour').forEach((b) => b.addEventListener('click', () => player.open(tourFor(a))));
    const chip = document.getElementById('tour-chip');
    if (chip) {
      const tr = tourFor(a);
      chip.hidden = !tr;
      chip.onclick = tr ? () => player.open(tr) : null;
    }
    box.querySelector('.dt-more').addEventListener('click', () => setExpanded(true));
    box.querySelectorAll('.pl-tab').forEach((b) => b.addEventListener('click', () => { state.plan = +b.dataset.plan; renderApt(a); }));
  }

  // ---------------------------------------------------------------- 2D plan modal
  function openPlan() {
    if (!state.floor) return;
    planModal.classList.add('open');
    $('#pm-title').textContent = `${t('floorPlan')} · ${t('floor', { n: state.floor })}`;
    viewer.show(byFloor.get(state.floor));
    viewer.setMode(state.planMode);
    if (state.apt) viewer.select(state.apt.id);
    planModal.querySelectorAll('.pm-mode').forEach((b) => b.classList.toggle('on', b.dataset.mode === state.planMode));
  }
  function closePlan() { planModal.classList.remove('open'); hideTip(); }
  $('#fp-plan').addEventListener('click', openPlan);
  $('#pm-close').addEventListener('click', closePlan);
  $('#pm-reset').addEventListener('click', () => viewer.resetView());
  planModal.querySelectorAll('.pm-mode').forEach((b) => b.addEventListener('click', () => {
    state.planMode = b.dataset.mode; viewer.setMode(state.planMode);
    planModal.querySelectorAll('.pm-mode').forEach((x) => x.classList.toggle('on', x === b));
  }));

  // ---------------------------------------------------------------- gallery
  const gal = $('#gallery-modal');
  let gi = 0;
  const imgs = [1, 2, 3, 4, 5, 6].map((i) => `assets/gallery/render-${i}.jpg`);
  function showGal(i) {
    gi = (i + imgs.length) % imgs.length;
    $('#gal-img').src = imgs[gi];
    $('#gal-count').textContent = `${gi + 1} / ${imgs.length}`;
  }
  $('#btn-gallery').addEventListener('click', () => { gal.classList.add('open'); showGal(gi); });
  $('#gal-close').addEventListener('click', () => gal.classList.remove('open'));
  $('#gal-prev').addEventListener('click', () => showGal(gi - 1));
  $('#gal-next').addEventListener('click', () => showGal(gi + 1));

  // ---------------------------------------------------------------- panel buttons
  $('#fp-close').addEventListener('click', () => cb.onBack());
  $('#btn-lang').addEventListener('click', () => setLang(getLang() === 'uz' ? 'ru' : 'uz'));
  onLang(applyTexts);
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (gal.classList.contains('open')) gal.classList.remove('open');
    else if (planModal.classList.contains('open')) closePlan();
    else if (state.apt) selectApt(null);
    else if (state.floor) cb.onBack();
  });

  applyTexts();

  return {
    state, setHoverFloor, showTip, hideTip, floorTipHTML, aptTipHTML, openFloor, closeFloor, selectApt,
    highlightApt(id) {
      document.querySelectorAll('.apt-card').forEach((c) => c.classList.toggle('hl', c.dataset.id === id));
      viewer.highlight(id);
    },
  };
}
