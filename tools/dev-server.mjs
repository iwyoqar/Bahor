// Bahor — lokal dev-server (qo'shimcha paketlarsiz).
// Ishga tushirish:  npm run dev        (yoki: node tools/dev-server.mjs)
// Port o'zgartirish: PORT=3000 npm run dev
// Fayl saqlanganda brauzer sahifani o'zi yangilaydi (live reload).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START_PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || 'localhost';
const LIVE = !process.argv.includes('--no-reload');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
};

const RELOAD_SNIPPET = `<script>(() => { const es = new EventSource('/__reload');
  es.onmessage = (e) => { if (e.data === 'reload') location.reload(); }; })();</script>`;

const clients = new Set();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 1000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep) || file.includes(`${path.sep}.git${path.sep}`)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  const type0 = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  if (type0.startsWith('video/')) { serveRange(req, res, file, type0); return; }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404: ' + rel);
      log(404, req.url);
      return;
    }
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    let body = buf;
    if (LIVE && type.startsWith('text/html')) body = Buffer.from(buf.toString('utf8').replace('</body>', RELOAD_SNIPPET + '\n</body>'));
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  });
});

// videos: byte ranges (Safari / iOS will not play video without them)
function serveRange(req, res, file, type) {
  fs.stat(file, (err, st) => {
    if (err) { res.writeHead(404); res.end(); log(404, req.url); return; }
    const size = st.size;
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (!m) {
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
      return;
    }
    let start = m[1] === '' ? size - +m[2] : +m[1];
    let end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(+m[2], size - 1);
    if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
    res.writeHead(206, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
    fs.createReadStream(file, { start, end }).pipe(res);
  });
}

function log(code, what) {
  const t = new Date().toTimeString().slice(0, 8);
  console.log(`${t}  ${code}  ${what}`);
}

// live reload: watch project files (not .git / tools / node_modules)
if (LIVE) {
  let timer = null;
  const notify = (f) => {
    if (!f || /(^|[\\/])(\.git|node_modules|tools)([\\/]|$)/.test(f)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      log('↻', 'o\'zgardi: ' + f);
      for (const c of clients) c.write('data: reload\n\n');
    }, 120);
  };
  try {
    fs.watch(ROOT, { recursive: true }, (_, f) => notify(f));
  } catch {
    // older Node on Linux: watch the main folders one by one
    for (const d of ['', 'css', 'js', 'data', 'assets']) {
      const p = path.join(ROOT, d);
      if (fs.existsSync(p)) fs.watch(p, (_, f) => notify(path.join(d, f || '')));
    }
  }
}

function listen(port, triesLeft) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && triesLeft > 0) {
      console.log(`Port ${port} band, ${port + 1} sinab ko'rilyapti...`);
      listen(port + 1, triesLeft - 1);
    } else {
      console.error('Server xatosi:', e.message);
      process.exit(1);
    }
  });
  server.listen(port, HOST, () => {
    const url = `http://localhost:${port}`;
    console.log('');
    console.log('  Bahor dev-server ishga tushdi');
    console.log(`  ➜  Brauzerda oching:  ${url}`);
    console.log(`  ➜  Past sifat rejimi:  ${url}/?q=low`);
    if (LIVE) console.log('  ➜  Fayl saqlansa sahifa o\'zi yangilanadi');
    console.log('  ➜  To\'xtatish: Ctrl + C');
    console.log('');
  });
}

listen(START_PORT, 10);
