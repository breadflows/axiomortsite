/* ════════════════════════════════════════════════════════════
   AXIOMORT multiplayer client.
   - connects to the zero-dep relay in server.js (same origin)
   - renders other players as skinned, animated robots
   - AAA bottom-left game chat + system event feed
   - hold-TAB scoreboard
   - punch knockback (mouse click)

   import { MP, AXChat } from './js/mp.js';
   MP.init({ THREE, scene, level:'vault', name, skin,
             getSelf: () => ({ pos:[x,y,z], rot, anim }),
             onPunched: (kx,kz) => { player.vel.x += kx; player.vel.z += kz; },
             onTyping: (typing) => {} });
   MP.update(dt);  // each frame
   MP.event('pickup'|'play', discName);
   MP.tryPunch(camera);   // on mouse click
════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { createRobot, preloadRobot, SKINS } from './robot.js';

/* ── shared chat feed (also used by ARIA / the game) ── */
export const AXChat = (() => {
  let feedEl, inputEl, root, onSend = null, onType = null;
  let fadeT = null, typing = false;

  const css = `
  #axchat{position:fixed;left:20px;bottom:20px;z-index:115;width:min(440px,46vw);
    font-family:'Space Grotesk','Jost',system-ui,sans-serif;pointer-events:none;}
  #axchat .feed{display:flex;flex-direction:column;gap:4px;justify-content:flex-end;max-height:34vh;overflow:hidden;
    transition:opacity .5s;mask-image:linear-gradient(transparent,#000 22%);-webkit-mask-image:linear-gradient(transparent,#000 22%);}
  #axchat.idle .feed{opacity:0;}
  #axchat .ln{font-size:13.5px;line-height:1.45;font-weight:500;color:#e8eef7;
    text-shadow:0 1px 3px #000,0 0 10px rgba(0,0,0,.7);padding:1px 0;animation:axln .25s ease;}
  @keyframes axln{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
  #axchat .ln .who{font-weight:700;}
  #axchat .ln.sys{color:#9fb2cf;font-weight:600;font-style:italic;font-size:12.5px;}
  #axchat .ln.aria .who{color:#ffd34a;} #axchat .ln.aria{color:#f4ead0;}
  #axchat .ln.me .who{color:#7CFFB2;}
  #axchat .entry{display:none;margin-top:8px;align-items:center;gap:8px;pointer-events:auto;
    background:rgba(6,9,18,.82);border:1.5px solid rgba(212,175,55,.4);border-radius:10px;padding:8px 12px;
    backdrop-filter:blur(8px);box-shadow:0 8px 30px rgba(0,0,0,.5);}
  #axchat.typing{opacity:1!important;}
  #axchat.typing .entry{display:flex;animation:axln .2s ease;}
  #axchat.typing .feed{opacity:1;}
  #axchat .entry .pfx{font-weight:700;font-size:12px;letter-spacing:1px;color:#ffd34a;text-transform:uppercase;}
  #axchat .entry input{flex:1;background:none;border:none;outline:none;color:#fff;font-family:inherit;font-size:14px;}
  #axchat .entry .hint{font-size:10px;color:#6c7a96;letter-spacing:1px;}
  `;

  function build() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    root = document.createElement('div'); root.id = 'axchat'; root.className = 'idle';
    root.innerHTML = `<div class="feed" id="axchat-feed"></div>
      <div class="entry"><span class="pfx">SAY</span><input id="axchat-in" maxlength="180" autocomplete="off" spellcheck="false"><span class="hint">ENTER ↵</span></div>`;
    document.body.appendChild(root);
    feedEl = document.getElementById('axchat-feed');
    inputEl = document.getElementById('axchat-in');
    inputEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { submit(); }
      else if (e.key === 'Escape') { closeInput(); }
    });
    inputEl.addEventListener('keyup', (e) => e.stopPropagation());
  }

  function nudge() { // briefly show the feed on new activity
    if (!root) return;
    root.classList.remove('idle');
    clearTimeout(fadeT);
    if (!typing) fadeT = setTimeout(() => root.classList.add('idle'), 7000);
  }

  function add(who, text, type) {
    if (!root) build();
    const ln = document.createElement('div');
    ln.className = 'ln' + (type ? ' ' + type : '');
    if (type === 'sys') ln.textContent = text;
    else ln.innerHTML = `<span class="who">${esc(who)}</span> <span class="tx">${esc(text)}</span>`;
    feedEl.appendChild(ln);
    while (feedEl.children.length > 40) feedEl.removeChild(feedEl.firstChild);
    feedEl.scrollTop = feedEl.scrollHeight;
    nudge();
  }
  const esc = (s) => ('' + s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function openInput() {
    if (!root) build();
    typing = true; root.classList.add('typing'); clearTimeout(fadeT);
    setTimeout(() => inputEl.focus(), 30);
    if (onType) onType(true);
  }
  function closeInput() {
    typing = false; root.classList.remove('typing'); inputEl.value = ''; inputEl.blur();
    nudge();
    if (onType) onType(false);
  }
  function submit() {
    const t = inputEl.value.trim();
    closeInput();
    if (t && onSend) onSend(t);
  }

  const api = {
    add,
    open: openInput, close: closeInput,
    isTyping: () => typing,
    onSend: (fn) => { onSend = fn; },
    onType: (fn) => { onType = fn; }
  };
  if (typeof window !== 'undefined') window.AXChat = api;   // reachable by ARIA / the game
  return api;
})();

/* ── the multiplayer client ── */
export const MP = (() => {
  let ws = null, cfg = null, scene = null, myId = null, connected = false;
  const remotes = new Map();   // id -> { bot, name, skin, tPos:Vector3, tRot, anim, tag, level, _lastAnim }
  let sendAcc = 0;
  let boardEl = null, boardOn = false;
  let selfName = 'PILOT', selfSkin = 0, selfLevel = 'vault';

  function nameTag(name) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = '700 34px "Space Grotesk", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowBlur = 8;
    g.fillStyle = '#fff'; g.fillText(name, 128, 34);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: false, depthWrite: false }));
    s.scale.set(2.2, 0.55, 1); s.renderOrder = 998;
    return s;
  }

  async function addRemote(p) {
    if (remotes.has(p.id) || p.id === myId) return;
    const placeholder = {}; remotes.set(p.id, placeholder);   // reserve slot (async guard)
    
    let bot = null;
    if (window.AXEngine && window.AXEngine.pool) {
      bot = window.AXEngine.pool.get('player');
      if (bot) {
        bot.setSkin(p.skin | 0);
        bot.setPosition(p.pos[0], p.pos[1], p.pos[2]);
      }
    }
    if (!bot) {
      bot = await createRobot(THREE, scene, { x: p.pos[0], y: p.pos[1], z: p.pos[2], height: 2.4, skin: p.skin | 0, shadow: true });
    }

    const tag = nameTag(p.name); scene.add(tag);
    const rec = { bot, name: p.name, skin: p.skin | 0, level: p.level,
      tPos: new THREE.Vector3(p.pos[0], p.pos[1], p.pos[2]), tRot: p.rot || 0, anim: p.anim || 'idle', tag, _lastAnim: '' };
    remotes.set(p.id, rec);
    
    if (placeholder._removed) removeRemote(p.id);   // left while loading
    AXChat.add('', `${p.name} is here`, 'sys');
  }
  function removeRemote(id) {
    const r = remotes.get(id); if (!r) return;
    if (r._removed === undefined && !r.bot) { r._removed = true; return; }  // still loading
    
    if (r.bot) {
      if (window.AXEngine && window.AXEngine.pool) {
        window.AXEngine.pool.release('player', r.bot);
      } else {
        scene.remove(r.bot.group);
      }
    }
    if (r.tag) scene.remove(r.tag);
    remotes.delete(id);
  }

  function setState(id, pos, rot, anim) {
    const r = remotes.get(id); if (!r || !r.bot) return;
    r.tPos.set(pos[0], pos[1], pos[2]); r.tRot = rot;
    if (anim && anim !== r.anim) { r.anim = anim; }
  }

  function handle(msg) {
    switch (msg.t) {
      case 'welcome': myId = msg.id; (msg.players || []).forEach(p => { if (p.level === selfLevel) addRemote(p); }); break;
      case 'join': if (msg.player.level === selfLevel) addRemote(msg.player); break;
      case 'leave': removeRemote(msg.id); break;
      case 'state': setState(msg.id, msg.pos, msg.rot, msg.anim); break;
      case 'anim': { const r = remotes.get(msg.id); if (r && r.bot && msg.anim) r.bot.playOnce(msg.anim, r.anim || 'idle'); break; }
      case 'chat': AXChat.add(msg.name, msg.text, msg.id === myId ? 'me' : ''); break;
      case 'sys': AXChat.add('', msg.text, 'sys'); break;
      case 'event': {
        const verb = msg.kind === 'play' ? 'played' : 'picked up';
        const where = msg.kind === 'play' ? ' on the projection' : '';
        AXChat.add('', `${msg.name} ${verb} ${msg.disc}${where}`, 'sys');
        if (msg.kind === 'play' && msg.idx !== undefined && typeof window.setProjectionPlayback === 'function') {
           window.setProjectionPlayback(msg.idx, true);
        }
        break;
      }
      case 'punch': if (cfg.onPunched) cfg.onPunched(+msg.kx || 0, +msg.kz || 0); break;
    }
  }

  let everConnected = false, offlineNoticeShown = false, connAttempt = 0;
  // The relay lives on the same origin in production (axiomort.com / node server.js).
  // Locally the game is sometimes opened from a STATIC server with no WebSocket — the
  // Claude/dev preview on another port, or straight off disk (file://). In those cases
  // location.host points at a server with no relay, so we fall back to the node port.
  const RELAY_PORT = 8741;
  function relayURL() {
    if (location.protocol === 'file:' || !location.host) return 'ws://localhost:' + RELAY_PORT;
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    const onLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    // first try same-origin; if that origin has no relay, retry against the known node port
    if (onLocal && (connAttempt > 0 || location.port !== String(RELAY_PORT))) {
      return proto + location.hostname + ':' + RELAY_PORT;
    }
    return proto + location.host;
  }
  function connect() {
    let url;
    try { url = relayURL(); ws = new WebSocket(url); } catch (e) { setTimeout(connect, 3000); return; }
    ws.onopen = () => { connected = true; everConnected = true; offlineNoticeShown = false; connAttempt = 0; ws.send(JSON.stringify({ t: 'join', name: selfName, skin: selfSkin, level: selfLevel })); };
    ws.onmessage = (e) => { try { handle(JSON.parse(e.data)); } catch (err) {} };
    ws.onclose = () => {
      connected = false; connAttempt++;
      // surface the failure instead of failing silently
      if (!everConnected && !offlineNoticeShown && connAttempt >= 2) {
        offlineNoticeShown = true;
        AXChat.add('', 'Multiplayer offline — open the game at http://localhost:' + RELAY_PORT + ' (run  node server.js , not python).', 'sys');
      }
      setTimeout(connect, everConnected ? 3000 : 1200);   // retry quickly while still hunting for the relay
    };
    ws.onerror = () => {};
  }

  /* ── scoreboard (hold TAB) ── */
  function buildBoard() {
    const st = document.createElement('style');
    st.textContent = `#mp-board{position:fixed;inset:0;z-index:140;display:none;align-items:center;justify-content:center;
      background:rgba(5,7,14,.55);backdrop-filter:blur(4px);font-family:'Space Grotesk',sans-serif;}
      #mp-board.on{display:flex;}
      #mp-board .card{min-width:min(440px,86vw);border:1.5px solid rgba(212,175,55,.35);border-radius:16px;overflow:hidden;
        background:linear-gradient(180deg,rgba(12,15,26,.96),rgba(7,10,18,.97));box-shadow:0 24px 70px rgba(0,0,0,.6);}
      #mp-board h3{margin:0;padding:16px 22px;font-size:14px;letter-spacing:3px;color:#ffd34a;text-transform:uppercase;border-bottom:1px solid rgba(212,175,55,.2);}
      #mp-board .row{display:flex;align-items:center;gap:12px;padding:11px 22px;border-bottom:1px solid rgba(255,255,255,.05);}
      #mp-board .dot{width:12px;height:12px;border-radius:50%;flex:none;}
      #mp-board .pn{font-weight:700;font-size:15px;color:#fff;flex:1;}
      #mp-board .pl{font-size:11px;letter-spacing:1px;color:#8fa3cf;text-transform:uppercase;}
      #mp-board .you{color:#7CFFB2;}`;
    document.head.appendChild(st);
    boardEl = document.createElement('div'); boardEl.id = 'mp-board';
    boardEl.innerHTML = '<div class="card"><h3>Pilots in the Signal</h3><div id="mp-board-list"></div></div>';
    document.body.appendChild(boardEl);
  }
  function hex(n) { return '#' + ('000000' + (n >>> 0).toString(16)).slice(-6); }
  const escHtml = (s) => ('' + s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  function showBoard() {
    if (!boardEl) buildBoard();
    const list = document.getElementById('mp-board-list'); list.innerHTML = '';
    const rows = [{ name: selfName + '  (you)', skin: selfSkin, level: selfLevel, you: true },
      ...[...remotes.values()].filter(r => r.name).map(r => ({ name: r.name, skin: r.skin, level: r.level }))];
    rows.forEach(p => {
      const d = document.createElement('div'); d.className = 'row';
      d.innerHTML = `<span class="dot" style="background:${hex((SKINS[(p.skin|0)%SKINS.length]||SKINS[0]).joint)}"></span>
        <span class="pn ${p.you ? 'you' : ''}">${escHtml(p.name)}</span><span class="pl">${p.level === 'island' ? 'The Island' : 'The Vault'}</span>`;
      list.appendChild(d);
    });
    boardEl.classList.add('on'); boardOn = true;
  }
  function hideBoard() { if (boardEl) boardEl.classList.remove('on'); boardOn = false; }

  return {
    init(c) {
      cfg = c || {}; scene = c.scene; selfLevel = c.level || 'vault';
      selfName = c.name || localStorage.getItem('ax_pilot') || 'PILOT';
      selfSkin = (c.skin != null ? c.skin : (parseInt(localStorage.getItem('ax_skin'), 10) || 0)) | 0;
      preloadRobot().then(async () => {
        window.AXEngine = window.AXEngine || {};
        if (window.AXEngine.PoolManager) {
          window.AXEngine.pool = new window.AXEngine.PoolManager(scene);
          await window.AXEngine.pool.registerPool('player', 16, async () => {
            return await createRobot(THREE, scene, { height: 2.4, shadow: true });
          });
        }
        connect();
      });
      // chat wiring
      AXChat.onSend((text) => {
        if (/^@?aria[\s,:]/i.test(text) && window.__ARIA_ASK) { window.__ARIA_ASK(text.replace(/^@?aria[\s,:]+/i, '')); return; }
        AXChat.add(selfName, text, 'me');                 // local echo
        if (connected) ws.send(JSON.stringify({ t: 'chat', text }));
      });
      AXChat.onType((typing) => { if (cfg.onTyping) cfg.onTyping(typing); });
      // TAB scoreboard
      addEventListener('keydown', (e) => { if (e.code === 'Tab' && cfg.boardEnabled !== false && !AXChat.isTyping()) { e.preventDefault(); if (!boardOn) showBoard(); } });
      addEventListener('keyup', (e) => { if (e.code === 'Tab') { e.preventDefault(); hideBoard(); } });
      return this;
    },
    update(dt) {
      // send own state ~12/s
      sendAcc += dt;
      if (connected && cfg.getSelf && sendAcc > 0.08) {
        sendAcc = 0;
        const s = cfg.getSelf();
        if (s) ws.send(JSON.stringify({ t: 'state', pos: s.pos, rot: s.rot, anim: s.anim }));
      }
      // interpolate + animate remotes
      const k = Math.min(1, dt * 12);
      remotes.forEach((r) => {
        if (!r.bot) return;
        r.bot.group.position.lerp(r.tPos, k);
        let dr = r.tRot - r.bot.group.rotation.y;
        while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2;
        r.bot.group.rotation.y += dr * k;
        if (r.anim !== r._lastAnim) { r._lastAnim = r.anim; if (r.bot.getCurrentKey() !== '__once') r.bot.play(r.anim === 'walk' ? 'walk' : r.anim === 'air' ? 'air' : 'idle'); }
        r.bot.update(dt);
        if (r.tag) { r.tag.position.set(r.bot.group.position.x, r.bot.group.position.y + 2.7, r.bot.group.position.z); }
      });
    },
    setLevel(level) { selfLevel = level; if (connected) ws.send(JSON.stringify({ t: 'level', level })); remotes.forEach((_, id) => removeRemote(id)); },
    event(kind, disc, idx) { if (connected) ws.send(JSON.stringify({ t: 'event', kind, disc, idx })); },
    broadcastAnim(anim) { if (connected) ws.send(JSON.stringify({ t: 'anim', anim })); },
    // mouse-click punch: knock back the nearest remote in front of the camera
    tryPunch(camera, range = 3.2) {
      if (!connected || AXChat.isTyping()) return false;
      const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      const me = camera.position; let best = null, bestId = null, bd = range;
      remotes.forEach((r, id) => {
        if (!r.bot) return;
        const dx = r.bot.group.position.x - me.x, dz = r.bot.group.position.z - me.z;
        const dist = Math.hypot(dx, dz); if (dist > bd) return;
        const dot = (dx / dist) * fwd.x + (dz / dist) * fwd.z;
        if (dot > 0.4 && dist < bd) { bd = dist; best = r; bestId = id; }
      });
      if (best) {
        const dx = best.bot.group.position.x - me.x, dz = best.bot.group.position.z - me.z;
        const d = Math.hypot(dx, dz) || 1; const power = 26;
        ws.send(JSON.stringify({ t: 'punch', target: bestId, kx: dx / d * power, kz: dz / d * power }));
        if (cfg.onPunchThrown) cfg.onPunchThrown();
        return true;
      }
      return false;
    },
    isTyping: () => AXChat.isTyping(),
    openChat: () => AXChat.open(),
    connected: () => connected,
    // remote players (for the lobby roster) — name, skin, level
    roster: () => [...remotes.values()].filter(r => r.name).map(r => ({ name: r.name, skin: r.skin, level: r.level })),
    skinName: (i) => (SKINS[i] || SKINS[0]).name
  };
})();
