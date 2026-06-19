/* ════════════════════════════════════════════════════════════
   AXLoader — cinematic loading screen
   Video montage of collected clips + sleek white-on-grey bar.
   Doubles as a real chunked-build runner so heavy 3D work is
   split across frames (keeps low-end devices responsive).

   AXLoader.show({ videos:[urls], label, sub });
   AXLoader.set(0..1);            // manual progress (smoothed)
   AXLoader.bump(text);          // update the phase label
   AXLoader.hide();              // fade out + cleanup
   await AXLoader.runPhases(phases, { videos, label, minMs });
       phases = [ ['Carving terrain', fn], ['Lighting the city', fn], ... ]
       each fn may be sync or async; loader yields to a frame between them.
════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const css = `
  #ax-load{position:fixed;inset:0;z-index:400;display:none;overflow:hidden;
    font-family:'Space Grotesk','Jost',system-ui,sans-serif;background:#0c0d12;}
  #ax-load.on{display:block;}
  #ax-load.fade{opacity:0;transition:opacity .6s ease;}
  #ax-load .vids{position:absolute;inset:0;}
  #ax-load .vids video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
    opacity:0;transition:opacity 1s ease;filter:grayscale(.35) brightness(.62) contrast(1.05);}
  #ax-load .vids video.show{opacity:1;}
  /* sleek dark wash so the bar + text always read */
  #ax-load .wash{position:absolute;inset:0;pointer-events:none;
    background:
      linear-gradient(180deg,rgba(12,13,18,.55) 0%,rgba(12,13,18,.15) 35%,rgba(12,13,18,.65) 100%),
      radial-gradient(ellipse 80% 60% at 50% 50%,transparent 40%,rgba(8,9,13,.7) 100%);}
  #ax-load .grain{position:absolute;inset:0;pointer-events:none;opacity:.05;mix-blend-mode:overlay;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}

  #ax-load .panel{position:absolute;left:0;right:0;bottom:0;padding:0 7vw 8vh;z-index:3;}
  #ax-load .mark{font-weight:700;font-size:13px;letter-spacing:6px;color:rgba(255,255,255,.55);
    text-transform:uppercase;margin-bottom:14px;}
  #ax-load .mark b{color:#fff;}
  #ax-load .sub{font-weight:600;font-size:clamp(22px,3.4vw,40px);letter-spacing:-.5px;color:#fff;
    margin-bottom:26px;text-shadow:0 2px 30px rgba(0,0,0,.6);max-width:18ch;line-height:1.05;}

  #ax-load .barwrap{display:flex;align-items:center;gap:16px;max-width:560px;}
  #ax-load .track{position:relative;flex:1;height:4px;border-radius:6px;
    background:rgba(255,255,255,.16);overflow:hidden;}
  #ax-load .fill{position:absolute;left:0;top:0;bottom:0;width:0%;border-radius:6px;
    background:linear-gradient(90deg,rgba(255,255,255,.7),#fff);
    box-shadow:0 0 14px rgba(255,255,255,.5);transition:width .35s cubic-bezier(.4,0,.2,1);}
  #ax-load .fill::after{content:'';position:absolute;right:0;top:50%;width:7px;height:7px;
    margin-top:-3.5px;border-radius:50%;background:#fff;box-shadow:0 0 10px 2px rgba(255,255,255,.8);}
  #ax-load .pct{font-weight:700;font-size:14px;letter-spacing:.5px;color:#fff;
    min-width:48px;text-align:right;font-variant-numeric:tabular-nums;}
  #ax-load .phase{margin-top:14px;font-weight:600;font-size:12px;letter-spacing:2px;
    color:rgba(255,255,255,.55);text-transform:uppercase;}
  #ax-load .phase::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;
    background:#fff;margin-right:9px;vertical-align:middle;animation:axblink 1.1s ease-in-out infinite;}
  @keyframes axblink{0%,100%{opacity:.25}50%{opacity:1}}
  `;

  let root, vidsBox, fillEl, pctEl, phaseEl, subEl, markEl;
  let videoEls = [], vidTimer = null, vidIdx = 0;
  let target = 0, shown = 0, raf = null;
  let built = false;

  function build() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    root = document.createElement('div'); root.id = 'ax-load';
    root.innerHTML =
      '<div class="vids"></div><div class="wash"></div><div class="grain"></div>' +
      '<div class="panel">' +
        '<div class="mark">AXIO<b>MORT</b> &nbsp;//&nbsp; LOADING</div>' +
        '<div class="sub"></div>' +
        '<div class="barwrap"><div class="track"><div class="fill"></div></div><div class="pct">0%</div></div>' +
        '<div class="phase"></div>' +
      '</div>';
    document.body.appendChild(root);
    vidsBox = root.querySelector('.vids');
    fillEl = root.querySelector('.fill');
    pctEl  = root.querySelector('.pct');
    phaseEl= root.querySelector('.phase');
    subEl  = root.querySelector('.sub');
    markEl = root.querySelector('.mark');
    built = true;
  }

  function startMontage(videos) {
    // tear down old
    if (vidTimer) clearInterval(vidTimer);
    videoEls.forEach(v => { try { v.pause(); v.src = ''; } catch (e) {} v.remove(); });
    videoEls = []; vidIdx = 0;
    if (!videos || !videos.length) return;
    // shuffle
    const list = videos.slice();
    for (let i = list.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [list[i], list[j]] = [list[j], list[i]]; }
    // two layers we ping-pong between for crossfade
    for (let k = 0; k < 2; k++) {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.loop = false;
      vidsBox.appendChild(v); videoEls.push(v);
    }
    let li = 0;
    const swap = () => {
      const front = videoEls[vidIdx % 2];
      const back = videoEls[(vidIdx + 1) % 2];
      const url = list[li % list.length]; li++;
      back.classList.remove('show');
      back.pause();
      back.src = url;
      back.load();
      const playFromRandomPoint = () => {
        if (back.duration && isFinite(back.duration) && back.duration > 3) {
          const safeTail = Math.min(2.5, back.duration * 0.18);
          back.currentTime = Math.random() * Math.max(0.1, back.duration - safeTail);
        }
        const p = back.play();
        if (p && p.catch) p.catch(() => {});
        back.classList.add('show');
        front.classList.remove('show');
      };
      if (back.readyState >= 1) playFromRandomPoint();
      else back.addEventListener('loadedmetadata', playFromRandomPoint, { once: true });
      vidIdx++;
    };
    swap();
    vidTimer = setInterval(swap, 4200);
  }

  function tick() {
    shown += (target - shown) * 0.12;
    if (Math.abs(target - shown) < 0.002) shown = target;
    const pc = Math.round(shown * 100);
    fillEl.style.width = pc + '%';
    pctEl.textContent = pc + '%';
    if (shown < target - 0.0001 || shown < 0.999) raf = requestAnimationFrame(tick);
    else raf = null;
  }

  const API = {
    show(opts) {
      opts = opts || {};
      if (!built) build();
      root.classList.add('on');
      root.classList.remove('fade');
      root.style.opacity = '1';
      delete root.dataset.holding;
      const panel = root.querySelector('.panel');
      panel.style.transition = 'none'; panel.style.opacity = '1'; panel.style.pointerEvents = '';
      target = 0; shown = 0;
      fillEl.style.width = '0%'; pctEl.textContent = '0%';
      subEl.textContent = opts.label || 'Loading';
      phaseEl.textContent = opts.sub || 'Preparing assets';
      if (opts.mark) markEl.innerHTML = opts.mark;
      startMontage(opts.videos);
      if (!raf) raf = requestAnimationFrame(tick);
      window.__axLoadT = { show: performance.now(), videosPassed: (opts.videos || []).length };
      return API;
    },
    set(p) { target = Math.max(0, Math.min(1, p)); if (!raf) raf = requestAnimationFrame(tick); return API; },
    bump(text) { if (phaseEl && text) phaseEl.textContent = text; return API; },
    label(text) { if (subEl && text) subEl.textContent = text; return API; },
    // loading finished — keep the montage playing as a live backdrop, fade out only the chrome
    hold() {
      if (!built) return;
      target = 1;
      const panel = root.querySelector('.panel');
      panel.style.transition = 'opacity .6s ease';
      panel.style.opacity = '0';
      panel.style.pointerEvents = 'none';
      root.dataset.holding = '1';
    },
    hide() {
      if (!built) return Promise.resolve();
      return new Promise(res => {
        target = 1;
        setTimeout(() => {
          root.classList.add('fade'); root.style.opacity = '0';
          setTimeout(() => {
            root.classList.remove('on');
            if (vidTimer) { clearInterval(vidTimer); vidTimer = null; }
            videoEls.forEach(v => { try { v.pause(); v.src = ''; } catch (e) {} v.remove(); });
            videoEls = [];
            if (window.__axLoadT) window.__axLoadT.hide = performance.now();
            res();
          }, 620);
        }, 240);
      });
    },
    // Run an array of [label, fn] phases, yielding a frame between each so the
    // browser can paint the loader and stay responsive on low-end hardware.
    async runPhases(phases, opts) {
      opts = opts || {};
      API.show(opts);
      const start = performance.now();
      const n = phases.length;
      // let the first montage frame paint before heavy work
      await frame(); await frame();
      for (let i = 0; i < n; i++) {
        const [label, fn] = phases[i];
        API.bump(label);
        await frame();                 // paint the new label + bar position
        try { await fn(); } catch (e) { console.error('[AXLoader] phase failed:', label, e); }
        API.set((i + 1) / n);
        await frame();                 // let GPU upload / paint settle
      }
      const minMs = opts.minMs || 0;
      const elapsed = performance.now() - start;
      if (elapsed < minMs) await wait(minMs - elapsed);
      return API;
    }
  };

  // yield a frame, but never stall: rAF pauses on hidden/unfocused tabs, so race it with a timer
  function frame() { return new Promise(r => { let done = false; const fin = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(fin); setTimeout(fin, 120); }); }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  window.AXLoader = API;
})();
