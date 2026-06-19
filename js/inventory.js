/* ════════════════════════════════════════════════════════════
   AXInventory — PS2-era CD player / memory card inventory
   Shared by tower.html and island.html.
   Usage:
     AXInventory.init({ title, subtitle, tracks:[{t,src,img,meta}], isOwned(i), onOpen, onClose });
     AXInventory.toggle() / .open() / .close() / .isOpen()
     AXInventory.playTrack(i)  — also called when a tile is clicked
════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const css = `
  #ax-inv{position:fixed;inset:0;z-index:200;display:none;font-family:'Jost','DM Sans',sans-serif;
    background:
      radial-gradient(ellipse 90% 70% at 50% 110%, rgba(28,42,90,.55), transparent 60%),
      radial-gradient(ellipse 70% 50% at 50% -10%, rgba(16,22,52,.8), transparent 70%),
      linear-gradient(180deg,#04050d 0%,#070b1d 45%,#0a1028 100%);
    color:#dfe6f5;}
  #ax-inv.open{display:block;animation:axfade .45s ease}
  @keyframes axfade{from{opacity:0}to{opacity:1}}
  #ax-inv .motes{position:absolute;inset:0;overflow:hidden;pointer-events:none}
  #ax-inv .mote{position:absolute;bottom:-20px;width:3px;height:3px;border-radius:50%;
    background:rgba(170,195,255,.7);filter:blur(1px);animation:axrise linear infinite}
  @keyframes axrise{to{transform:translateY(-110vh)}}
  #ax-inv .frame{position:relative;z-index:2;max-width:1060px;margin:0 auto;height:100%;
    display:flex;flex-direction:column;padding:34px 28px 22px;box-sizing:border-box}
  #ax-inv header{display:flex;justify-content:space-between;align-items:baseline;
    border-bottom:1px solid rgba(170,195,255,.18);padding-bottom:12px}
  #ax-inv h1{margin:0;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:38px;letter-spacing:-.5px;color:#fff;
    text-shadow:0 0 24px rgba(140,170,255,.5)}
  #ax-inv .sub{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:12px;letter-spacing:1.5px;color:#9fb2dc;text-transform:uppercase}
  #ax-inv .cols{flex:1;display:grid;grid-template-columns:1.35fr 1fr;gap:26px;min-height:0;padding-top:20px}
  /* memory-card grid */
  #ax-inv .grid{overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));
    gap:12px;align-content:start;padding-right:6px;scrollbar-width:thin;scrollbar-color:#2a3a66 transparent}
  #ax-inv .card{position:relative;border:1px solid rgba(170,195,255,.14);border-radius:3px;
    background:linear-gradient(165deg,rgba(40,55,105,.35),rgba(10,14,32,.55));
    padding:10px;cursor:default;overflow:hidden;transition:all .25s}
  #ax-inv .card.owned{cursor:pointer}
  #ax-inv .card.owned:hover{border-color:rgba(200,215,255,.55);transform:translateY(-2px);
    box-shadow:0 6px 22px rgba(80,110,200,.25)}
  #ax-inv .card.owned::after{content:'';position:absolute;top:0;left:-80%;width:60%;height:100%;
    background:linear-gradient(100deg,transparent,rgba(255,255,255,.13),transparent);
    transform:skewX(-20deg);transition:left .5s}
  #ax-inv .card.owned:hover::after{left:120%}
  #ax-inv .card.playing{border-color:rgba(255,255,255,.7);box-shadow:0 0 24px rgba(120,150,255,.4)}
  #ax-inv .card img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:2px;display:block;
    filter:saturate(.95)}
  #ax-inv .card.locked img{filter:brightness(.18) saturate(0)}
  #ax-inv .card .nm{font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;letter-spacing:.2px;margin-top:9px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#f1f5ff}
  #ax-inv .card.locked .nm{color:#5a6a92;font-weight:500}
  #ax-inv .card .no{position:absolute;top:12px;left:12px;font-family:'Space Grotesk',sans-serif;font-size:12px;letter-spacing:0;
    color:#fff;text-shadow:0 1px 6px #000;font-weight:700;background:rgba(8,12,28,.55);
    padding:2px 7px;border-radius:20px;backdrop-filter:blur(4px)}
  #ax-inv .card.locked .no{color:#6a7aa2;text-shadow:none;background:rgba(8,12,28,.4)}
  /* CD tray */
  #ax-inv .tray{display:flex;flex-direction:column;align-items:center;justify-content:center;
    border:1px solid rgba(170,195,255,.14);border-radius:4px;
    background:linear-gradient(180deg,rgba(14,20,44,.6),rgba(6,9,22,.8));padding:26px;min-height:0}
  #ax-inv .disc-wrap{position:relative;width:min(240px,42vw);aspect-ratio:1}
  #ax-inv .disc{position:absolute;inset:0;border-radius:50%;overflow:hidden;
    background:conic-gradient(from 0deg,#b9c4dd,#7d8ba8 12%,#e8edf8 25%,#8b97b5 40%,#dfe5f2 55%,#7d8ba8 70%,#cfd7e8 85%,#b9c4dd);
    box-shadow:0 0 40px rgba(120,150,255,.18), inset 0 0 30px rgba(0,0,10,.5);
    animation:axspin 4s linear infinite paused}
  #ax-inv .disc.spin{animation-play-state:running}
  #ax-inv .disc .label{position:absolute;inset:18%;border-radius:50%;overflow:hidden;
    border:2px solid rgba(255,255,255,.25)}
  #ax-inv .disc .label img{width:100%;height:100%;object-fit:cover}
  #ax-inv .disc .hub{position:absolute;inset:44%;border-radius:50%;background:#0a0e1e;
    border:3px solid rgba(255,255,255,.3)}
  @keyframes axspin{to{transform:rotate(360deg)}}
  #ax-inv .now{margin-top:22px;text-align:center;min-height:58px}
  #ax-inv .now .tt{font-family:'Space Grotesk',sans-serif;font-size:21px;font-weight:700;letter-spacing:-.3px;color:#fff}
  #ax-inv .now .mm{font-family:'Space Grotesk',sans-serif;font-size:11px;font-weight:600;letter-spacing:1px;color:#9fb2dc;margin-top:6px;text-transform:uppercase}
  #ax-inv .bar{width:100%;height:6px;border-radius:6px;background:rgba(170,195,255,.14);margin:18px 0 14px;cursor:pointer}
  #ax-inv .bar i{display:block;height:100%;border-radius:6px;width:0%;background:linear-gradient(90deg,#7CFFB2,#9fd8ff)}
  #ax-inv .ctl{display:flex;gap:18px;align-items:center}
  #ax-inv .ctl button{background:rgba(170,195,255,.08);border:1.5px solid rgba(170,195,255,.32);color:#eaf0ff;
    width:52px;height:52px;border-radius:50%;font-size:17px;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center}
  #ax-inv .ctl button:hover{border-color:#7CFFB2;background:rgba(124,255,178,.12);box-shadow:0 0 18px rgba(124,255,178,.3);transform:scale(1.06)}
  #ax-inv footer{padding-top:16px;display:flex;justify-content:space-between;align-items:center;
    font-family:'Space Grotesk',sans-serif;font-size:12px;font-weight:600;letter-spacing:.5px;color:#7e8eb4;text-transform:uppercase}
  #ax-inv .pct{color:#7CFFB2}
  @media(max-width:760px){#ax-inv .cols{grid-template-columns:1fr;overflow-y:auto}
    #ax-inv .tray{order:-1}}
  #ax-inv .tabs{display:flex;gap:0;border-bottom:1px solid rgba(170,195,255,.12);margin-bottom:18px}
  #ax-inv .tab-btn{background:none;border:none;color:#7e8eb4;font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;padding:12px 24px;cursor:pointer;position:relative;transition:color .25s}
  #ax-inv .tab-btn:hover{color:#c8d7ff}
  #ax-inv .tab-btn.active{color:#7CFFB2}
  #ax-inv .tab-btn.active::after{content:'';position:absolute;bottom:-1px;left:12px;right:12px;height:2px;background:#7CFFB2;box-shadow:0 0 12px rgba(124,255,178,.5);border-radius:2px}
  #ax-inv .tab-pane{display:none;flex:1;min-height:0}
  #ax-inv .tab-pane.active{display:grid}
  #ax-inv .tab-pane-player,#ax-inv .tab-pane-extra{display:none;flex:1;min-height:0}
  #ax-inv .tab-pane-player.active,#ax-inv .tab-pane-extra.active{display:flex;align-items:stretch}
  #ax-inv .tab-pane-player iframe{width:100%;flex:1;border:1px solid rgba(170,195,255,.14);border-radius:4px;background:#020308}
  #ax-inv .tab-pane-extra{overflow:hidden}
  #ax-inv .tab-pane-extra.active{display:block;overflow:auto}
  #ax-inv .ax-extra-wrap{min-height:100%;border:1px solid rgba(170,195,255,.14);border-radius:4px;background:linear-gradient(180deg,rgba(14,20,44,.54),rgba(6,9,22,.74));padding:18px;box-sizing:border-box}
  #ax-inv .ax-extra-head{display:flex;justify-content:space-between;gap:16px;align-items:end;border-bottom:1px solid rgba(170,195,255,.12);padding-bottom:12px;margin-bottom:14px}
  #ax-inv .ax-extra-title{font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;color:#fff}
  #ax-inv .ax-extra-sub{font-family:'Space Grotesk',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.2px;color:#9fb2dc;text-transform:uppercase}
  #ax-inv .ax-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
  #ax-inv .ax-row{min-height:66px;text-align:left;border:1px solid rgba(170,195,255,.14);border-radius:4px;background:rgba(255,255,255,.045);color:#eaf0ff;padding:10px 12px;font-family:'Space Grotesk',sans-serif;cursor:pointer}
  #ax-inv .ax-row:hover{border-color:rgba(124,255,178,.45);background:rgba(124,255,178,.08)}
  #ax-inv .ax-row.locked{opacity:.38;cursor:default;filter:saturate(.35)}
  #ax-inv .ax-row.locked:hover{border-color:rgba(170,195,255,.14);background:rgba(255,255,255,.045)}
  #ax-inv .ax-row b{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #ax-inv .ax-row span{display:block;margin-top:5px;font-size:10px;font-weight:700;letter-spacing:1px;color:#9fb2dc;text-transform:uppercase}
  #ax-inv .ax-watch{margin-top:14px;display:none}
  #ax-inv .ax-watch.open{display:block}
  #ax-inv .ax-watch iframe{width:100%;aspect-ratio:16/9;border:1px solid rgba(170,195,255,.14);border-radius:4px;background:#020308}
  `;

  let cfg = null, audio = null, current = -1, root = null, playerLoaded = false;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function build() {
    if (!document.getElementById('ax-inv-font')) {
      const l = document.createElement('link');
      l.id = 'ax-inv-font'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Jost:wght@200;300;400&family=Space+Grotesk:wght@400;500;600;700&display=swap';
      document.head.appendChild(l);
    }
    const st = el('style'); st.textContent = css; document.head.appendChild(st);
    root = el('div'); root.id = 'ax-inv';
    const motes = el('div', 'motes');
    for (let i = 0; i < 26; i++) {
      const m = el('div', 'mote');
      m.style.left = (Math.random() * 100) + '%';
      m.style.animationDuration = (9 + Math.random() * 14) + 's';
      m.style.animationDelay = (-Math.random() * 20) + 's';
      m.style.opacity = 0.25 + Math.random() * 0.5;
      motes.appendChild(m);
    }
    root.appendChild(motes);
    const frame = el('div', 'frame');
    frame.innerHTML = `
      <header><h1>${cfg.title}</h1><div class="sub">${cfg.subtitle || 'DISC ARCHIVE'}</div></header>
      <div class="tabs">
        <button class="tab-btn active" data-tab="archive">DISC ARCHIVE</button>
        <button class="tab-btn" data-tab="player">STUDIO PLAYER</button>
        ${(cfg.extraTabs || []).map(tab => `<button class="tab-btn" data-tab="${tab.id}">${tab.label}</button>`).join('')}
      </div>
      <div class="cols tab-pane active" data-pane="archive">
        <div class="grid" id="axg"></div>
        <div class="tray">
          <div class="disc-wrap">
            <div class="disc" id="axdisc">
              <div class="label"><img id="axlbl" src="" alt=""></div>
              <div class="hub"></div>
            </div>
          </div>
          <div class="now">
            <div class="tt" id="axtt">NO DISC</div>
            <div class="mm" id="axmm">SELECT A MEMORY CARD</div>
          </div>
          <div class="bar" id="axbar"><i id="axfill"></i></div>
          <div class="ctl">
            <button id="axprev">&#9198;</button>
            <button id="axplay">&#9654;</button>
            <button id="axnext">&#9197;</button>
          </div>
        </div>
      </div>
      <div class="tab-pane-player" data-pane="player">
        <iframe id="ax-player-frame" src="" allow="autoplay; fullscreen" loading="lazy"></iframe>
      </div>
      ${(cfg.extraTabs || []).map(tab => `<div class="tab-pane-extra" data-pane="${tab.id}">${tab.html || ''}</div>`).join('')}
      <footer><span>${cfg.footer || '&#9651; CLOSE&nbsp;&nbsp;&middot;&nbsp;&nbsp;I'}</span><span class="pct" id="axpct"></span></footer>`;
    root.appendChild(frame);
    document.body.appendChild(root);

    audio = new Audio();
    audio.addEventListener('timeupdate', () => {
      if (audio.duration) document.getElementById('axfill').style.width = (audio.currentTime / audio.duration * 100) + '%';
    });
    audio.addEventListener('ended', () => nextOwned(1));
    document.getElementById('axplay').addEventListener('click', () => {
      if (current < 0) return;
      if (audio.paused) { audio.play(); } else { audio.pause(); }
      refreshPlayBtn();
    });
    document.getElementById('axprev').addEventListener('click', () => nextOwned(-1));
    document.getElementById('axnext').addEventListener('click', () => nextOwned(1));
    document.getElementById('axbar').addEventListener('click', (e) => {
      if (!audio.duration) return;
      const r = e.currentTarget.getBoundingClientRect();
      audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
    });
    renderGrid();

    // Tab switching
    root.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            // Update button states
            root.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // Update pane visibility
            root.querySelectorAll('[data-pane]').forEach(p => p.classList.toggle('active', p.dataset.pane === target));
            if (target === 'player') {
                // Lazy load iframe
                if (!playerLoaded) {
                    document.getElementById('ax-player-frame').src = 'CD_PLAYER.html';
                    playerLoaded = true;
                }
            }
            const extra = (cfg.extraTabs || []).find(t => t.id === target);
            if (extra && extra.onShow) extra.onShow(root);
            // Pause disc archive audio when switching away
            if (target !== 'archive' && audio && !audio.paused) {
                audio.pause();
                refreshPlayBtn();
            }
        });
    });
  }

  function refreshPlayBtn() {
    document.getElementById('axplay').innerHTML = (audio && !audio.paused) ? '&#10073;&#10073;' : '&#9654;';
    document.getElementById('axdisc').classList.toggle('spin', audio && !audio.paused);
  }

  function renderGrid() {
    const g = document.getElementById('axg');
    g.innerHTML = '';
    let owned = 0;
    cfg.tracks.forEach((tr, i) => {
      const has = cfg.isOwned(i);
      if (has) owned++;
      const c = el('div', 'card ' + (has ? 'owned' : 'locked') + (i === current ? ' playing' : ''));
      c.innerHTML = `<span class="no">${String(i + 1).padStart(2, '0')}</span>
        <img src="${tr.img}" loading="lazy" alt="">
        <div class="nm">${has ? tr.t : '— SEALED —'}</div>`;
      if (has) c.addEventListener('click', () => playTrack(i));
      g.appendChild(c);
    });
    document.getElementById('axpct').textContent =
      `ARCHIVE ${owned} / ${cfg.tracks.length} — ${Math.round(owned / cfg.tracks.length * 100)}%`;
  }

  function nextOwned(dir) {
    if (current < 0) return;
    for (let k = 1; k <= cfg.tracks.length; k++) {
      const i = (current + dir * k + cfg.tracks.length * k) % cfg.tracks.length;
      if (cfg.isOwned(i)) { playTrack(i); return; }
    }
  }

  function playTrack(i) {
    current = i;
    const tr = cfg.tracks[i];
    const ytSrc = window.AXYT && tr.folder ? AXYT.embedUrlForTrack(tr, { autoplay: true, mute: false, controls: true, loop: true }) : '';
    if (ytSrc) {
      audio.pause();
      audio.removeAttribute('src');
      const frame = document.getElementById('ax-player-frame');
      if (frame) {
        frame.src = ytSrc;
        playerLoaded = true;
      }
      selectTab('player');
    } else {
      audio.src = tr.src;
      audio.play().catch(() => {});
    }
    document.getElementById('axtt').textContent = tr.t;
    document.getElementById('axmm').textContent = tr.meta || 'BREADFLOWS';
    document.getElementById('axlbl').src = tr.img;
    renderGrid();
    refreshPlayBtn();
  }

  let isOpen = false;
  function selectTab(id) {
    if (!root) return;
    const btn = root.querySelector(`.tab-btn[data-tab="${id}"]`);
    if (btn) btn.click();
  }
  const API = {
    init(c) { cfg = c; build(); },
    open() {
      if (!root || isOpen) return;
      isOpen = true; renderGrid(); root.classList.add('open');
      if (cfg.onOpen) cfg.onOpen();
    },
    close() {
      if (!root || !isOpen) return;
      isOpen = false; root.classList.remove('open');
      if (audio) { audio.pause(); refreshPlayBtn(); }
      // Reset to archive tab and unload player iframe
      const archivePane = root.querySelector('[data-pane="archive"]');
      const playerPane = root.querySelector('[data-pane="player"]');
      if (archivePane) archivePane.classList.add('active');
      if (playerPane) playerPane.classList.remove('active');
      root.querySelectorAll('.tab-pane-extra').forEach(p => p.classList.remove('active'));
      root.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.tab === 'archive');
      });
      const pf = document.getElementById('ax-player-frame');
      if (pf && pf.src) { pf.src = ''; playerLoaded = false; }
      root.querySelectorAll('.tab-pane-extra iframe').forEach(f => { f.src = ''; });
      root.querySelectorAll('.ax-watch.open').forEach(w => w.classList.remove('open'));
      if (cfg.onClose) cfg.onClose();
    },
    toggle() { isOpen ? API.close() : API.open(); },
    isOpen() { return isOpen; },
    openTab(id) { API.open(); selectTab(id); },
    playTrack,
    refresh: () => { if (root) renderGrid(); }
  };
  window.AXInventory = API;
})();
