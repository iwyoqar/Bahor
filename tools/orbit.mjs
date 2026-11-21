// Bahor — 360° aylanish uchun fayllarni tayyorlash (ffmpeg kerak). Qo'llanma: docs/orbit-360.md
//
//   node tools/orbit.mjs refs     3D kadrlardan Kling uchun referens kliplar: captures/orbit/clips/seg-1.mp4 ...
//   node tools/orbit.mjs draft    3D kadrlardan saytga qoralama aylanish: assets/orbit/0000.webp ...
//   node tools/orbit.mjs frames   tayyor fotoreal kliplardan (captures/orbit/kling/seg-N.mp4) saytga kadrlar,
//                                 fotoreal suratlardan (captures/orbit/photos/photo-N.jpg|png) tiniq to'xtash suratlari
//
// 3D kadrlar avval brauzerda olinadi: http://localhost:5173/?capture=1&orbit=rec
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../js/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAP = path.join(ROOT, 'captures', 'orbit');
const OUT = path.join(ROOT, CONFIG.orbit.dir);
const N = CONFIG.orbit.frames;
const FPS = 30;

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.error) { console.error('ffmpeg topilmadi. O\'rnatish: winget install Gyan.FFmpeg'); process.exit(1); }
  if (r.status !== 0) process.exit(r.status || 1);
}

function meta() {
  const f = path.join(CAP, 'meta.json');
  if (!fs.existsSync(f)) { console.error('3D kadrlar yo\'q. Avval brauzerda oching: http://localhost:5173/?capture=1&orbit=rec'); process.exit(1); }
  const m = JSON.parse(fs.readFileSync(f, 'utf8'));
  const have = fs.existsSync(path.join(CAP, 'frames')) ? fs.readdirSync(path.join(CAP, 'frames')).filter((n) => /^f\d+\.jpg$/.test(n)).length : 0;
  if (have < m.total) { console.error(`3D kadrlar to'liq emas (${have} / ${m.total}). Brauzerda yozib olish tugashini kuting yoki qayta oching: http://localhost:5173/?capture=1&orbit=rec`); process.exit(1); }
  return m;
}

const frame3d = (g, total) => path.join(CAP, 'frames', `f${String(g % total).padStart(4, '0')}.jpg`);

/** concat list: every file shown for one frame */
function listFile(files) {
  const f = path.join(os.tmpdir(), `bahor-orbit-${process.pid}-${Math.random().toString(36).slice(2)}.txt`);
  const body = files.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'\nduration ${1 / FPS}`).join('\n');
  fs.writeFileSync(f, body + '\n');
  return f;
}

function refs() {
  const { seg, per, total } = meta();
  const dir = path.join(CAP, 'clips');
  fs.mkdirSync(dir, { recursive: true });
  for (let k = 0; k < seg; k++) {
    // the clip ends exactly on the first frame of the next one
    const files = Array.from({ length: per + 1 }, (_, j) => frame3d(k * per + j, total));
    const list = listFile(files);
    const out = path.join(dir, `seg-${k + 1}.mp4`);
    ffmpeg(['-f', 'concat', '-safe', '0', '-r', String(FPS), '-i', list, '-fps_mode', 'cfr', '-r', String(FPS), '-frames:v', String(per + 1), '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
    fs.unlinkSync(list);
    console.log(`seg-${k + 1}.mp4  ${(k * 360) / seg}° → ${((k + 1) * 360) / seg}°  (${((per + 1) / FPS).toFixed(1)} s)`);
  }
  console.log(`\nTayyor: ${path.relative(ROOT, dir)}`);
}

function writeFrames(files, start) {
  fs.mkdirSync(OUT, { recursive: true });
  const list = listFile(files);
  ffmpeg(['-f', 'concat', '-safe', '0', '-r', String(FPS), '-i', list, '-fps_mode', 'cfr', '-r', String(FPS), '-frames:v', String(files.length), '-vf', 'scale=1280:720:flags=lanczos,setsar=1', '-c:v', 'libwebp', '-q:v', '80', '-start_number', String(start), path.join(OUT, '%04d.webp')]);
  fs.unlinkSync(list);
}

function draft() {
  const { total } = meta();
  writeFrames(Array.from({ length: N }, (_, i) => frame3d(Math.round((i * total) / N), total)), 0);
  console.log(`Qoralama: ${N} kadr → ${path.relative(ROOT, OUT)} (3D ko'rinishda). Sinash: http://localhost:5173/?orbit=1`);
}

function frames() {
  const seg = CONFIG.orbit.stops || 8;
  const per = N / seg;
  if (!Number.isInteger(per)) { console.error(`orbit.frames (${N}) orbit.stops (${seg}) ga bo'linishi kerak`); process.exit(1); }
  const src = path.join(CAP, 'kling');
  let done = 0;
  for (let k = 0; k < seg; k++) {
    const clip = ['mp4', 'mov', 'webm'].map((e) => path.join(src, `seg-${k + 1}.${e}`)).find((p) => fs.existsSync(p));
    if (!clip) { console.log(`seg-${k + 1}: klip yo'q, o'tkazib yuborildi`); continue; }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bahor-seg-'));
    ffmpeg(['-i', clip, '-q:v', '2', path.join(tmp, '%05d.jpg')]);
    const all = fs.readdirSync(tmp).sort();
    // the last frame of a clip is the first frame of the next one
    const pick = Array.from({ length: per }, (_, j) => path.join(tmp, all[Math.round((j * (all.length - 1)) / per)]));
    writeFrames(pick, k * per);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`seg-${k + 1}: ${all.length} kadrdan ${per} tasi → ${String(k * per).padStart(4, '0')}…${String((k + 1) * per - 1).padStart(4, '0')}.webp`);
    done++;
  }
  let stills = 0;
  for (let k = 1; k < seg; k++) {
    const photo = ['jpg', 'jpeg', 'png', 'webp'].map((e) => path.join(CAP, 'photos', `photo-${k}.${e}`)).find((p) => fs.existsSync(p));
    if (!photo) continue;
    ffmpeg(['-i', photo, '-vf', 'scale=2560:1440:flags=lanczos,setsar=1', '-q:v', '3', '-frames:v', '1', '-update', '1', path.join(OUT, `still-${k}.jpg`)]);
    stills++;
  }
  console.log(`\n${done} / ${seg} bo'lak fotoreal. Tiniq suratlar: ${stills} / ${seg - 1}.`);
  if (stills === seg - 1) console.log('Hamma tiniq suratlar bor: js/config.js da orbit.stills: true qiling.');
  if (done === seg) console.log('Hamma bo\'laklar tayyor: js/config.js da orbit.enabled: true qiling.');
}

const cmd = process.argv[2];
if (cmd === 'refs') refs();
else if (cmd === 'draft') draft();
else if (cmd === 'frames') frames();
else console.log('Foydalanish: node tools/orbit.mjs refs | draft | frames   (docs/orbit-360.md)');
