/* ===============================================================
   AXIOMORT server - zero-dependency static host + multiplayer relay.
   Run:  node server.js   (then open http://localhost:8741)
   Serves the site over HTTP and runs a raw WebSocket relay on the
   SAME port. No npm install needed.
   =============================================================== */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8741;
const ROOT = __dirname;

// -- multiplayer safety limits (prevent DoS / abuse) --
const MAX_FRAME   = 64 * 1024;    // largest single WS message we accept (bytes)
const MAX_BUFFER  = 256 * 1024;   // hard cap on a socket's pending parse buffer
const MAX_PLAYERS = 64;           // concurrent connections
const MSG_PER_SEC = 120;          // per-socket message rate cap (sliding 1s window)

// strip HTML-significant + control chars so player text can never inject markup where it's rendered
const sanitizeText = (s, n) => ('' + (s == null ? '' : s)).replace(/[<>&"'`\x00-\x1f\x7f]/g, '').slice(0, n);
const sanitizeName = (s) => sanitizeText(s, 18) || 'PILOT';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css', '.json': 'application/json', '.mjs': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.fbx': 'application/octet-stream',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
};

/* -- static file server (with HTTP range support for media) -- */
const server = http.createServer((req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end('method not allowed'); }
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
    // confine strictly to ROOT (require the path separator so a sibling like ROOT+"-x" can't pass)
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) { res.writeHead(404); return res.end('not found'); }
      const ext = path.extname(filePath).toLowerCase();
      const type = MIME[ext] || 'application/octet-stream';
      const range = req.headers.range;
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        let start = m && m[1] ? parseInt(m[1], 10) : 0;
        let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
        if (!(start >= 0) || !(end >= 0)) { start = 0; end = stat.size - 1; }
        if (start > end || end >= stat.size) end = stat.size - 1;
        if (start >= stat.size) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
        res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'X-Content-Type-Options': 'nosniff' });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
        if (req.method === 'HEAD') return res.end();
        fs.createReadStream(filePath).pipe(res);
      }
    });
  } catch (e) { res.writeHead(500); res.end('err'); }
});

/* ============ raw WebSocket (RFC 6455, text frames) ============ */
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
let nextId = 1;
const players = new Map();   // id -> { id, sock, name, skin, level, pos, rot, anim }

function send(sock, obj) {
  if (sock.destroyed) return;
  const data = Buffer.from(JSON.stringify(obj));
  const len = data.length;
  let header;
  if (len < 126) { header = Buffer.from([0x81, len]); }
  else if (len < 65536) { header = Buffer.from([0x81, 126, (len >> 8) & 255, len & 255]); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127;
    header.writeUInt32BE(Math.floor(len / 4294967296), 2); header.writeUInt32BE(len >>> 0, 6); }
  try { sock.write(Buffer.concat([header, data])); } catch (e) {}
}
function broadcast(obj, exceptId, sameLevelOf) {
  for (const p of players.values()) {
    if (p.id === exceptId) continue;
    if (sameLevelOf && p.level !== sameLevelOf) continue;
    send(p.sock, obj);
  }
}

server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { sock.destroy(); return; }
  // refuse new connections past the cap (cheap DoS guard)
  if (players.size >= MAX_PLAYERS) {
    sock.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
    sock.destroy(); return;
  }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);

  const id = nextId++;
  const me = { id, sock, name: 'PILOT', skin: 0, level: 'vault', pos: [0, 0, 0], rot: 0, anim: 'idle' };
  players.set(id, me);

  // per-socket message rate limiter (sliding 1s window)
  let winStart = Date.now(), winCount = 0;
  function rateOk() {
    const now = Date.now();
    if (now - winStart >= 1000) { winStart = now; winCount = 0; }
    return ++winCount <= MSG_PER_SEC;
  }

  let buf = Buffer.alloc(0);
  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    if (buf.length > MAX_BUFFER) { cleanup(); return; }   // runaway buffer -> drop
    // parse all complete frames in the buffer
    while (buf.length >= 2) {
      const op = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_FRAME) { cleanup(); return; }          // oversize frame -> drop (prevents OOM)
      const need = off + (masked ? 4 : 0) + len;
      if (buf.length < need) break;
      let payload;
      if (masked) {
        const mask = buf.slice(off, off + 4);
        payload = Buffer.alloc(len);
        for (let i = 0; i < len; i++) payload[i] = buf[off + 4 + i] ^ mask[i & 3];
      } else payload = buf.slice(off, off + len);
      buf = buf.slice(need);
      if (op === 0x8) { cleanup(); return; }                       // close
      else if (op === 0x9) { sock.write(Buffer.from([0x8a, 0])); }  // ping -> pong
      else if (op === 0x1) {
        if (!rateOk()) { cleanup(); return; }                      // flooding -> drop
        try { handle(JSON.parse(payload.toString())); } catch (e) {}
      }
    }
  });
  sock.on('error', cleanup);
  sock.on('close', cleanup);

  function snapshot(p) { return { id: p.id, name: p.name, skin: p.skin, level: p.level, pos: p.pos, rot: p.rot, anim: p.anim }; }

  function handle(msg) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'join':
        me.name = sanitizeName(msg.name);
        me.skin = (msg.skin | 0) % 64; me.level = msg.level === 'island' ? 'island' : 'vault';
        send(sock, { t: 'welcome', id, players: [...players.values()].filter(p => p.id !== id).map(snapshot) });
        broadcast({ t: 'join', player: snapshot(me) }, id);
        broadcast({ t: 'sys', text: `${me.name} entered the ${me.level === 'island' ? 'Island' : 'Vault'}` }, id);
        break;
      case 'state':
        // accept only 3 finite numbers for position; ignore anything else
        if (Array.isArray(msg.pos) && msg.pos.length === 3 && msg.pos.every(n => Number.isFinite(n))) me.pos = msg.pos;
        if (Number.isFinite(msg.rot)) me.rot = msg.rot;
        if (msg.anim) me.anim = sanitizeText(msg.anim, 20);
        broadcast({ t: 'state', id, pos: me.pos, rot: me.rot, anim: me.anim }, id, me.level);
        break;
      case 'level':
        me.level = msg.level === 'island' ? 'island' : 'vault';
        broadcast({ t: 'leave', id }, id);
        broadcast({ t: 'join', player: snapshot(me) }, id);
        break;
      case 'chat': {
        const text = sanitizeText(msg.text, 180);
        if (text) broadcast({ t: 'chat', id, name: me.name, text }, id);   // sender shows a local echo
        break;
      }
      case 'event':
        broadcast({ t: 'event', id, name: me.name, kind: sanitizeText(msg.kind, 12),
          disc: sanitizeText(msg.disc, 60), idx: msg.idx | 0, level: me.level }, id);
        break;
      case 'anim':
        broadcast({ t: 'anim', id, anim: sanitizeText(msg.anim, 20) }, id, me.level);
        break;
      case 'punch': {
        // client-authoritative knockback to the target; the swing anim is broadcast separately via 'anim'
        const tgt = players.get(msg.target | 0);
        if (tgt && tgt !== me) send(tgt.sock, { t: 'punch', from: id, kx: +msg.kx || 0, kz: +msg.kz || 0 });
        break;
      }
    }
  }

  function cleanup() {
    if (!players.has(id)) return;
    const p = players.get(id);
    players.delete(id);
    broadcast({ t: 'leave', id }, id);
    broadcast({ t: 'sys', text: `${p.name} left` }, id);
    try { sock.destroy(); } catch (e) {}
  }
});

server.listen(PORT, () => {
  console.log(`\n  AXIOMORT  ->  http://localhost:${PORT}`);
  console.log(`  Multiplayer relay live on ws://localhost:${PORT}\n`);
});
