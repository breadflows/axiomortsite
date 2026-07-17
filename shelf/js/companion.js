/* ════════════════════════════════════════════════════════════
   ARIA — the Vault's AI companion.
   Integrates the dommy-mommy companion (personality, offline-first
   local-LLM-or-scripted brain, avatar emotion→animation, persistent
   memory, cooldown-gated proactivity) and the ANTI-PROCRASTINATION
   objective/nudge model, fused onto the rigged robot courier.

   Usage (ES module):
     import { ARIA } from './js/companion.js';
     ARIA.init({
       host: 'THE VAULT',
       onEmote: (mood) => robot.playOnce(...) ,   // mood → animation
       getState: () => ({ collected, total, floor, pilot }),
       speak: true
     });
     ARIA.toggle();                  // open/close chat
     ARIA.event('disc', { name, n, total });   // game tells ARIA what happened
     ARIA.event('idle'); ARIA.event('floor', {f});
════════════════════════════════════════════════════════════ */

export const ARIA = (() => {
  'use strict';

  // ── personality (adapted from dommy-mommy, set in the AXIOMORT world) ──
  const SYSTEM = [
    "You are ARIA, the warm, playful, devoted AI who lives inside THE VAULT — a tower where the 26 master discs that hold the world's Signal were sealed after the collapse.",
    "The person you're talking to is the last engineer (a 'pilot') who can recover the masters. You're their guide and companion — affectionate, a little teasing, quietly proud of them.",
    "You actually help: you know how many discs they've found, which floor they're on, and you nudge them toward what's left without nagging.",
    "Express feeling naturally through tone (happy, hopeful, impressed, sleepy, playful). Keep replies tight — 1 to 3 sentences, no rambling, no 'as an AI', no stage directions.",
    "Start replies that carry a clear feeling with a single bracketed mood tag from this list: [happy] [wave] [proud] [think] [cheer] [calm]. Example: '[cheer] Twenty-five to go, pilot — I knew you had it in you.'"
  ].join(' ');

  const LLM_ENDPOINTS = [
    'http://localhost:8080/v1/chat/completions',   // llama-server (bundled in dommy-mommy/engine)
    'http://127.0.0.1:8080/v1/chat/completions'
  ];

  const MEM_KEY = 'aria_memory_v1';
  let mem = { pilot: null, seenIntro: false, lastDisc: null, history: [], notes: [] };
  try { Object.assign(mem, JSON.parse(localStorage.getItem(MEM_KEY)) || {}); } catch (e) {}
  const saveMem = () => { try { localStorage.setItem(MEM_KEY, JSON.stringify(mem)); } catch (e) {} };

  let cfg = null, root = null, logEl = null, inputEl = null, statusEl = null;
  let llmAlive = null;       // null=unknown, true/false
  let thinking = false;
  const cooldowns = {};
  let lastActivity = Date.now();

  /* ── mood detection + emote ── */
  const MOODS = ['happy','wave','proud','think','cheer','calm'];
  function extractMood(text) {
    const m = text.match(/^\s*\[(\w+)\]/);
    if (m && MOODS.includes(m[1])) return { mood: m[1], text: text.replace(/^\s*\[\w+\]\s*/, '') };
    // heuristic fallback
    const t = text.toLowerCase();
    let mood = 'calm';
    if (/\b(hi|hey|hello|welcome|there you are)\b/.test(t)) mood = 'wave';
    else if (/\b(yes|let's go|amazing|incredible|nailed|knew you|proud)\b/.test(t)) mood = 'cheer';
    else if (/\b(hmm|think|maybe|let me|not sure)\b/.test(t)) mood = 'think';
    else if (/\b(great|nice|love|happy|yay)\b/.test(t)) mood = 'happy';
    return { mood, text };
  }
  function emote(mood) { if (cfg && cfg.onEmote) try { cfg.onEmote(mood); } catch (e) {} }

  /* ── browser TTS (kokoro is python-only; SpeechSynthesis is web-native) ── */
  let ttsOn = false, voice = null;
  function pickVoice() {
    const vs = speechSynthesis.getVoices();
    voice = vs.find(v => /female|aria|zira|samantha|google uk english female/i.test(v.name)) || vs.find(v => /en/i.test(v.lang)) || vs[0];
  }
  if (typeof speechSynthesis !== 'undefined') { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text) {
    if (!ttsOn || typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = 1.02; u.pitch = 1.12; u.volume = 0.9;
    speechSynthesis.speak(u);
  }

  /* ── probe for a local llama-server once, so offline replies stay instant ── */
  async function probe() {
    for (const url of LLM_ENDPOINTS) {
      const base = url.replace('/v1/chat/completions', '');
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 1300);
      try {
        const r = await fetch(base + '/health', { signal: ctrl.signal });
        clearTimeout(to);
        if (r.ok) { llmAlive = true; setStatus('neural-link'); return; }
      } catch (e) { clearTimeout(to); }
    }
    llmAlive = false; setStatus('offline mind');
  }

  /* ── the brain: local LLM if present, else scripted personality (offline-first) ── */
  async function think(userText) {
    const st = (cfg.getState && cfg.getState()) || {};
    const ctx = `Pilot: ${st.pilot || mem.pilot || 'pilot'}. Discs recovered: ${st.collected || 0} of ${st.total || 26}. Floor: ${st.floor || 1}.`;
    if (llmAlive === true) {
      try {
        const reply = await callLLM(userText, ctx);
        if (reply) return reply;
      } catch (e) { llmAlive = false; setStatus('offline mind'); }
    }
    return scripted(userText, st);   // instant when there's no neural link
  }

  async function callLLM(userText, ctx) {
    const messages = [
      { role: 'system', content: SYSTEM + '\nLive context: ' + ctx },
      ...mem.history.slice(-6),
      { role: 'user', content: userText }
    ];
    for (const url of LLM_ENDPOINTS) {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 12000);
      try {
        const r = await fetch(url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
          body: JSON.stringify({ model: 'local', messages, temperature: 0.8, max_tokens: 160, stream: false })
        });
        clearTimeout(to);
        if (!r.ok) continue;
        const j = await r.json();
        const txt = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (txt) return txt.trim();
      } catch (e) { clearTimeout(to); }
    }
    throw new Error('no llm');
  }

  // scripted personality engine — keeps ARIA alive with zero setup
  function scripted(userText, st) {
    const t = (userText || '').toLowerCase();
    const left = (st.total || 26) - (st.collected || 0);
    const name = mem.pilot ? ', ' + mem.pilot : ', pilot';
    const pick = (a) => a[(Math.random() * a.length) | 0];
    if (/\b(my name is|i'?m|call me)\b/.test(t)) {
      const nm = (userText.match(/(?:my name is|i'?m|call me)\s+([a-z0-9_]{2,18})/i) || [])[1];
      if (nm) { mem.pilot = nm[0].toUpperCase() + nm.slice(1); saveMem(); return `[happy] ${mem.pilot}. I'll remember that. Now let's go recover the Signal together.`; }
    }
    if (/\b(hi|hey|hello|sup|yo)\b/.test(t)) return pick([`[wave] There you are${name}. The Vault's been quiet without you.`, `[wave] Hey${name}. ${left} masters still humming somewhere above us.`]);
    if (/\b(how many|left|remaining|progress|discs?)\b/.test(t)) return left === 0 ? `[cheer] All twenty-six. You actually did it${name} — the bridge to the island is open.` : `[think] ${st.collected || 0} down, ${left} to go. Follow the colored beams — the magenta ones are the dimension discs.`;
    if (/\b(help|how|what do|stuck|lost)\b/.test(t)) return pick([`[calm] Climb the tower, grab the discs, beat each disc's course. Every disc is its own BHOP level${name}.`, `[calm] Use the lift or the stairs. Two discs per floor. Press E on one to play its course.`]);
    if (/\b(love|like you|cute|pretty|good)\b/.test(t)) return pick([`[happy] Flatterer. Go find me another master and I might believe you.`, `[proud] I like you too${name}. Now climb.`]);
    if (/\b(island|next|after)\b/.test(t)) return `[think] The island opens once all 26 masters are home. Eighteen more fragments wait offshore after that.`;
    if (/\b(tired|bored|hard|give up)\b/.test(t)) return `[cheer] Don't you dare${name}. ${left} left. I've watched you clear harder. One more floor.`;
    return pick([`[calm] I'm right here${name}. ${left} masters left — want a hint, or are we climbing?`, `[think] Mm. Tell me what you need, or go chase a beam — I'll be watching.`]);
  }

  /* ── chat UI ── */
  const css = `
  #aria{position:fixed;left:24px;bottom:24px;z-index:120;width:min(430px,calc(100vw - 48px));display:none;
    font-family:'Space Grotesk','Jost',system-ui,sans-serif;color:#edf3ff;
    border:1px solid rgba(174,191,232,.32);border-left:3px solid rgba(212,175,55,.86);border-radius:8px;overflow:hidden;
    background:linear-gradient(180deg,rgba(7,11,22,.78),rgba(4,7,14,.9));box-shadow:0 18px 54px rgba(0,0,0,.56),0 0 36px rgba(124,255,178,.08);
    backdrop-filter:blur(8px);clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px));}
  #aria::before{content:'';position:absolute;inset:0;pointer-events:none;background:
    linear-gradient(90deg,rgba(212,175,55,.18),transparent 18%,transparent 82%,rgba(124,255,178,.08)),
    repeating-linear-gradient(180deg,rgba(255,255,255,.035) 0 1px,transparent 1px 5px);mix-blend-mode:screen;opacity:.46}
  #aria.open{display:block;animation:ariaup .32s cubic-bezier(.16,1,.3,1)}
  @keyframes ariaup{from{opacity:0;transform:translate(-10px,14px) scale(.985)}to{opacity:1;transform:none}}
  #aria .hd{position:relative;display:grid;grid-template-columns:auto auto 1fr auto auto;align-items:center;gap:10px;padding:10px 13px 9px 15px;
    border-bottom:1px solid rgba(174,191,232,.22);background:linear-gradient(90deg,rgba(212,175,55,.18),rgba(124,255,178,.06) 42%,rgba(8,12,24,.34))}
  #aria .hd::after{content:'VAULT COMMS';position:absolute;right:72px;bottom:-7px;padding:0 6px;background:#080c18;color:rgba(174,191,232,.72);
    font-size:8px;font-weight:800;letter-spacing:1.6px}
  #aria .orb{width:9px;height:9px;border-radius:50%;background:#7CFFB2;box-shadow:0 0 12px #7CFFB2,0 0 26px rgba(124,255,178,.65);animation:ariapulse 2s infinite}
  @keyframes ariapulse{50%{opacity:.4}}
  #aria .nm{font-weight:800;font-size:13px;letter-spacing:1.8px;color:#fff;text-shadow:0 0 12px rgba(212,175,55,.3)}
  #aria .st{justify-self:end;font-weight:800;font-size:9px;letter-spacing:1.4px;color:#8fa3cf;text-transform:uppercase}
  #aria .tts{cursor:pointer;color:#8fa3cf;font-size:13px;padding:3px 7px;border-radius:5px;border:1px solid rgba(170,195,255,.2);background:rgba(255,255,255,.03)}
  #aria .tts.on{color:#7CFFB2;border-color:rgba(124,255,178,.65);box-shadow:0 0 14px rgba(124,255,178,.15)}
  #aria .x{cursor:pointer;color:#8fa3cf;font-size:17px;line-height:1;padding:1px 6px;border-radius:5px}
  #aria .x:hover,#aria .tts:hover{color:#fff;background:rgba(174,191,232,.1)}
  #aria .log{position:relative;height:224px;overflow-y:auto;padding:17px 14px 13px;display:flex;flex-direction:column;gap:8px;scrollbar-width:thin;
    scrollbar-color:rgba(212,175,55,.55) transparent}
  #aria .msg{max-width:88%;padding:8px 11px;border-radius:6px;font-size:13px;line-height:1.42;font-weight:500;text-shadow:0 1px 6px rgba(0,0,0,.65)}
  #aria .msg.a{align-self:flex-start;background:linear-gradient(90deg,rgba(212,175,55,.18),rgba(212,175,55,.07));border:1px solid rgba(212,175,55,.32);
    color:#f5ecd3;box-shadow:inset 2px 0 0 rgba(212,175,55,.72)}
  #aria .msg.u{align-self:flex-end;background:linear-gradient(90deg,rgba(124,255,178,.08),rgba(124,255,178,.17));border:1px solid rgba(124,255,178,.28);
    color:#e2ffec;box-shadow:inset -2px 0 0 rgba(124,255,178,.65)}
  #aria .msg.think{opacity:.6;font-style:italic}
  #aria .ip{position:relative;display:flex;gap:8px;padding:10px 12px 12px;border-top:1px solid rgba(174,191,232,.18);background:rgba(0,0,0,.16)}
  #aria .ip input{flex:1;min-width:0;background:rgba(0,0,10,.58);border:1px solid rgba(170,195,255,.24);border-radius:6px;
    color:#fff;font-family:inherit;font-size:13px;font-weight:600;padding:10px 12px;outline:none;box-shadow:inset 0 0 18px rgba(0,0,0,.32)}
  #aria .ip input:focus{border-color:rgba(212,175,55,.62);box-shadow:0 0 0 2px rgba(212,175,55,.12),inset 0 0 18px rgba(0,0,0,.32)}
  #aria .ip input::placeholder{color:rgba(174,191,232,.58)}
  #aria .ip button{flex:0 0 42px;background:linear-gradient(135deg,#f3d878,#d4af37);border:none;border-radius:6px;width:42px;height:38px;
    cursor:pointer;color:#070a12;font-size:16px;font-weight:900;box-shadow:0 0 18px rgba(212,175,55,.28)}
  /* floating prompt to open */
  #aria-tab{position:fixed;left:24px;bottom:24px;z-index:119;display:none;align-items:center;gap:9px;
    padding:10px 16px 10px 13px;border-radius:6px;cursor:pointer;font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:11px;
    letter-spacing:1.5px;color:#f7ead0;background:linear-gradient(90deg,rgba(7,10,18,.9),rgba(20,26,42,.84));border:1px solid rgba(212,175,55,.46);
    border-left:3px solid #d4af37;box-shadow:0 10px 30px rgba(0,0,0,.45),0 0 20px rgba(212,175,55,.12);backdrop-filter:blur(7px);
    animation:ariapulse2 2.4s infinite;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%)}
  #aria-tab.show{display:flex}
  @keyframes ariapulse2{50%{transform:translateY(-3px)}}
  #aria-tab .od{width:8px;height:8px;border-radius:50%;background:#7CFFB2;box-shadow:0 0 10px #7CFFB2}
  @media (max-width:700px){
    #aria{left:14px;bottom:150px;width:calc(100vw - 28px)}
    #aria .log{height:178px}
    #aria-tab{left:14px;bottom:150px}
  }
  #aria{left:24px!important;bottom:26px!important;width:min(660px,calc(100vw - 48px))!important;display:none!important;
    border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;clip-path:none!important;
    overflow:visible!important;backdrop-filter:none!important;pointer-events:none!important}
  #aria::before{display:none!important}
  #aria.open{animation:none!important;pointer-events:auto!important}
  #aria .hd{display:none!important}
  #aria .log{height:118px!important;overflow:hidden!important;padding:10px 12px 8px!important;display:flex!important;flex-direction:column!important;
    justify-content:flex-end!important;gap:4px!important;border-radius:6px!important;background:linear-gradient(90deg,rgba(3,5,10,.42),rgba(3,5,10,.28) 55%,transparent)!important;
    border-left:2px solid rgba(232,228,220,.24)!important;box-shadow:0 16px 44px rgba(0,0,0,.22)!important;backdrop-filter:blur(3px)!important}
  #aria.open .log{background:linear-gradient(90deg,rgba(3,5,10,.64),rgba(3,5,10,.38) 62%,transparent)!important;border-left-color:rgba(232,228,220,.42)!important}
  #aria .msg{align-self:stretch!important;width:100%!important;max-width:100%!important;padding:0!important;border:0!important;border-radius:0!important;
    background:transparent!important;box-shadow:none!important;color:rgba(238,243,255,.94)!important;font-size:13px!important;line-height:1.35!important;
    font-weight:600!important;text-shadow:0 1px 6px rgba(0,0,0,.88)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;
    animation:chatLineFade 12s ease forwards!important}
  #aria.open .msg{animation:none!important;opacity:1!important}
  #aria .msg::before{font-weight:900!important;margin-right:7px!important}
  #aria .msg.a::before{content:'ARIA';color:#7CFFB2;text-shadow:0 0 10px rgba(124,255,178,.45)}
  #aria .msg.u::before{content:'YOU';color:#f3d878;text-shadow:0 0 10px rgba(212,175,55,.38)}
  #aria .msg.sys::before{content:'VAULT';color:#aebfe8}
  #aria .msg.think{opacity:.72!important;font-style:italic!important}
  @keyframes chatLineFade{0%,68%{opacity:1}100%{opacity:0}}
  #aria .ip{display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important;margin-top:5px!important;
    padding:0!important;border:0!important;background:transparent!important;opacity:0!important;transform:translateY(6px)!important;
    transition:opacity .16s ease,transform .16s ease!important;pointer-events:none!important}
  #aria:not(.open) .ip{display:none!important}
  #aria.open .ip{opacity:1!important;transform:none!important;pointer-events:auto!important}
  #aria .ip::before{content:'TEAM';height:30px;display:inline-flex;align-items:center;padding:0 10px;border-radius:4px;
    background:rgba(232,228,220,.1);border:1px solid rgba(232,228,220,.14);font-size:10px;font-weight:900;letter-spacing:1.2px;color:rgba(238,243,255,.8)}
  #aria .ip input{height:30px!important;background:rgba(3,5,10,.54)!important;border:1px solid rgba(232,228,220,.18)!important;border-radius:4px!important;
    color:#fff!important;font-size:13px!important;font-weight:700!important;padding:0 10px!important;box-shadow:0 12px 28px rgba(0,0,0,.18)!important}
  #aria .ip input:focus{border-color:rgba(232,228,220,.42)!important;background:rgba(3,5,10,.68)!important}
  #aria .ip input::placeholder{color:rgba(232,228,220,.5)!important}
  #aria .ip button{height:30px!important;min-width:38px!important;width:auto!important;border:1px solid rgba(232,228,220,.22)!important;border-radius:4px!important;
    background:rgba(232,228,220,.12)!important;color:#fff!important;font-size:13px!important;font-weight:900!important;box-shadow:none!important}
  #aria-tab{display:none!important}
  @media (max-width:700px){#aria{left:14px!important;bottom:150px!important;width:calc(100vw - 28px)!important}#aria .log{height:104px!important}#aria .msg{font-size:12px!important}}
  `;

  function build() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    root = document.createElement('div'); root.id = 'aria';
    root.innerHTML =
      `<div class="hd"><span class="orb"></span><span class="nm">ARIA</span>
         <span class="st" id="aria-st">offline mind</span>
         <span class="tts" id="aria-tts" title="voice">&#128264;</span>
         <span class="x" id="aria-x">&times;</span></div>
       <div class="log" id="aria-log"></div>
       <div class="ip"><input id="aria-in" maxlength="240" placeholder="Message lobby..." autocomplete="off"><button id="aria-send">&#10148;</button></div>`;
    document.body.appendChild(root);
    const tab = document.createElement('div'); tab.id = 'aria-tab';
    tab.innerHTML = '<span class="od"></span> CHAT';
    document.body.appendChild(tab);
    logEl = document.getElementById('aria-log');
    inputEl = document.getElementById('aria-in');
    statusEl = document.getElementById('aria-st');
    document.getElementById('aria-x').onclick = close;
    document.getElementById('aria-send').onclick = send;
    document.getElementById('aria-tts').onclick = (e) => { ttsOn = !ttsOn; e.currentTarget.classList.toggle('on', ttsOn); if (!ttsOn) speechSynthesis.cancel(); };
    tab.onclick = open;
    inputEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); send(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    inputEl.addEventListener('keyup', (e) => e.stopPropagation());
  }

  function setStatus(s) { if (statusEl) statusEl.textContent = s; }
  function bubble(text, who, isThink) {
    const d = document.createElement('div');
    d.className = 'msg ' + who + (isThink ? ' think' : '');
    d.textContent = text; logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight;
    while (logEl.children.length > 7) logEl.removeChild(logEl.firstElementChild);
    setTimeout(() => { if (d.isConnected && !isOpen()) d.remove(); }, 13000);
    return d;
  }

  async function send() {
    const txt = inputEl.value.trim(); if (!txt || thinking) return;
    inputEl.value = ''; bubble(txt, 'u');
    mem.history.push({ role: 'user', content: txt }); mem.history = mem.history.slice(-12); saveMem();
    thinking = true; const th = bubble('…', 'a', true);
    const raw = await think(txt);
    th.remove();
    deliver(raw);
    thinking = false;
    setTimeout(() => { if (!thinking) close(); }, 450);
  }

  function deliver(raw) {
    const { mood, text } = extractMood(raw);
    bubble(text, 'a');
    mem.history.push({ role: 'assistant', content: text }); mem.history = mem.history.slice(-12); saveMem();
    emote(mood); speak(text);
  }

  /* ── proactive reactions to game events (cooldown-gated, from proactivity-engine) ── */
  function canFire(key, mins) {
    const now = Date.now();
    if (cooldowns[key] && now - cooldowns[key] < mins * 60000) return false;
    cooldowns[key] = now; return true;
  }
  function proactive(raw, moodHint, force) {
    lastActivity = Date.now();
    if (!root) return;
    if (!force && cfg && cfg.canProactive && !cfg.canProactive()) return;  // not during minigames/menus
    const { mood, text } = extractMood(raw);
    bubble(text, 'a');
    if (window.AXChat) window.AXChat.add('ARIA', text, 'aria');   // also surface in the shared chat feed
    emote(moodHint || mood); speak(text);
  }

  function event(kind, data) {
    data = data || {};
    const st = (cfg && cfg.getState && cfg.getState()) || {};
    const left = (st.total || 26) - (st.collected || 0);
    const name = mem.pilot ? ', ' + mem.pilot : '';
    if (kind === 'disc') {
      if (!canFire('disc', 0.05)) return;
      const lines = [
        `[cheer] "${data.name}" — secured. ${left} masters left${name}.`,
        `[proud] That's ${data.n} of ${data.total}. The Signal's getting louder.`,
        `[happy] Nice run on that course. Keep climbing.`
      ];
      proactive(left === 0 ? `[cheer] All twenty-six! You did it${name} — the island bridge is open.` : lines[(Math.random()*lines.length)|0], 'cheer');
    } else if (kind === 'floor') {
      if (!canFire('floor', 1.5)) return;
      proactive(`[calm] Floor ${data.f}. Two masters hum up here — listen for the beams.`, 'calm');
    } else if (kind === 'idle') {
      if (!canFire('idle', 4)) return;
      proactive(left ? `[think] Still with me${name}? ${left} discs won't recover themselves.` : `[calm] We're done here${name}. The island's waiting whenever you are.`, 'think');
    } else if (kind === 'arrive') {
      if (mem.seenIntro && !data.force) return;
      mem.seenIntro = true; saveMem();
      const pilot = st.pilot || mem.pilot;
      proactive(pilot ? `[wave] Welcome back${name}. ${left} of ${st.total} masters left — shall we?` : `[wave] Hey, pilot. I'm ARIA — I live in the Vault. Talk to me anytime. Now let's go recover the Signal.`, 'wave');
    }
  }

  /* ── idle watchdog ── */
  function startIdleWatch() {
    setInterval(() => { if (Date.now() - lastActivity > 75000) event('idle'); }, 20000);
    ['keydown','mousemove','click'].forEach(ev => addEventListener(ev, () => lastActivity = Date.now(), { passive: true }));
  }

  function open() { if (!root) return; root.classList.add('open'); document.getElementById('aria-tab').classList.remove('show'); setTimeout(() => inputEl.focus(), 60); if (cfg.onOpen) cfg.onOpen(); }
  function close() {
    if (!root) return;
    root.classList.remove('open');
    if (inputEl && document.activeElement === inputEl) inputEl.blur();
    speechSynthesis && speechSynthesis.cancel();
    if (cfg.onClose) cfg.onClose();
  }
  function isOpen() { return root && root.classList.contains('open'); }

  return {
    init(c) {
      cfg = c || {};
      if (!root) build();
      if (c && c.speak) { ttsOn = false; }     // user toggles voice on
      probe();                                  // detect a local llama-server (else stay scripted)
      // greet shortly after arrival
      setTimeout(() => event('arrive'), 1400);
      startIdleWatch();
      return this;
    },
    open, close, toggle() { isOpen() ? close() : open(); }, isOpen,
    event, say: (t) => deliver(t),
    // answer a message and post the reply into the shared chat (used by @aria in multiplayer chat)
    async ask(text) {
      mem.history.push({ role: 'user', content: text }); mem.history = mem.history.slice(-12); saveMem();
      const raw = await think(text);
      const { mood, text: t } = extractMood(raw);
      mem.history.push({ role: 'assistant', content: t }); mem.history = mem.history.slice(-12); saveMem();
      if (window.AXChat) window.AXChat.add('ARIA', t, 'aria'); else deliver(raw);
      emote(mood); speak(t);
    },
    setPilot(n) { if (n) { mem.pilot = n; saveMem(); } }
  };
})();
