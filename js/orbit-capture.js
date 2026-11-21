// 360° aylanishning 3D kadrlarini diskka saqlash (faqat lokal dev-serverda): ?capture=1&orbit=rec
// Natija: captures/orbit/frames/f0000.jpg ... (butun aylanish) va captures/orbit/keys/key-N.png (tayanch kadrlar).
// Keyin: node tools/orbit.mjs refs  -> Kling uchun kliplar. Qo'llanma: docs/orbit-360.md
//
// Parametrlar: seg (bo'laklar soni, odatda stops), per (bir bo'lakdagi kadrlar, 120 = 30 kadr/s da 4 s),
// w, h (o'lcham), only=keys (faqat tayanch kadrlar).

const save = async (file, dataUrl) => {
  const r = await fetch('/__capture?file=' + encodeURIComponent(file), { method: 'POST', body: await (await fetch(dataUrl)).blob() });
  if (!r.ok) throw new Error(`${file}: ${r.status}`);
};

export async function record(app, cfg, params) {
  const seg = +params.get('seg') || cfg.stops || 8;
  const per = +params.get('per') || 120;
  const W = +params.get('w') || 1280, H = +params.get('h') || 720;
  const total = seg * per;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:99;padding:10px 14px;border-radius:10px;background:#000c;color:#fff;font:14px/1.4 system-ui';
  document.body.appendChild(box);
  // clicks must not reach the scene while recording (a click would open a floor in the middle of the turn)
  const shield = document.createElement('div');
  shield.style.cssText = 'position:fixed;inset:0;z-index:98;cursor:progress';
  document.body.appendChild(shield);
  const say = (s) => { box.textContent = s; };
  try {
    // tayanch kadrlar: 2x o'lchamda PNG (AI suratlar uchun referens)
    app.captureSize(W, H, 2);
    for (let k = 0; k < seg; k++) {
      say(`Tayanch kadr ${k + 1} / ${seg}`);
      await save(`orbit/keys/key-${k}.png`, app.orbitShot((k * 360) / seg, 'image/png'));
    }
    if (params.get('only') !== 'keys') {
      // butun aylanish: bir tekis tezlik, kadr g = g * 360 / total gradus
      app.captureSize(W, H, 1.5);
      for (let g = 0; g < total; g++) {
        if (g % 10 === 0) say(`Aylanish kadrlari ${g} / ${total}`);
        await save(`orbit/frames/f${String(g).padStart(4, '0')}.jpg`, app.orbitShot((g * 360) / total));
      }
    }
    await save('orbit/meta.json', 'data:application/json,' + encodeURIComponent(JSON.stringify({ seg, per, total, w: W, h: H })));
    say('Tayyor: captures/orbit/. Endi terminalda: node tools/orbit.mjs refs');
    window.__orbitCapture = 'done';
  } catch (e) {
    say('Xatolik: ' + e.message);
    window.__orbitCapture = 'error: ' + e.message;
  }
  shield.remove();
}
