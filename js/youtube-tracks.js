(function () {
  'use strict';

  const VIDEO_IDS = {
    "1 Machina Corpus": "h50MD9svoVg",
    "2 Ink Of Infinity": "9B2-dywcJ_E",
    "3 Rift's Bounty": "mp_B1G6mqfc",
    "4 The Nexus Veil": "ylSL2EhBg80",
    "5 The Nexus Veil (Galactic Chill)": "usqvuf_UDW0",
    "6 The Nexus Veil (Anthem)": "FgJfZrImh1g",
    "7 The Rose Petals Ressistance": "bhQzV6GyQRs",
    "8 Ink Between Worlds (The Rift Soundtrack)": "DGlXjTk3IXI",
    "9 106.5s Jul 1 432PM": "Zo3w9mKr5-E",
    "10 Go Cry To Interpol": "JyJBHHXiT18",
    "11 TrapStar": "k_W0Jf7xqj8",
    "12 Glitch Rebirth": "B1tYBUGv1n4",
    "13 Neon Hunters": "SnvruafYLtw",
    "14 Event Horizon Lament": "oyZRvLjMAug",
    "15 Ink Between Worlds (Rift Mix)": "CtPA2t7vZDo",
    "16 Nobody": "as_KkIP0s6w",
    "20 Theta Glyph Eclipse - Climax Divine": "uSZg3YSKZYQ",
    "21 Pressure Seal": "bLUE7sG7KbU",
    "22 Chronodrift": "7E4u3O3woZk",
    "25 Phantom Glide": "gquEew9RZuc"
  };

  function idFor(trackOrFolder) {
    const folder = typeof trackOrFolder === 'string'
      ? trackOrFolder
      : trackOrFolder && trackOrFolder.folder;
    return folder ? VIDEO_IDS[folder] || '' : '';
  }

  function randomStart(maxSeconds) {
    return Math.floor(Math.random() * (maxSeconds || 165));
  }

  function embedUrl(id, opts) {
    opts = opts || {};
    const start = Number.isFinite(opts.start) ? opts.start : randomStart(opts.maxStart);
    const params = new URLSearchParams({
      autoplay: opts.autoplay === false ? '0' : '1',
      mute: opts.mute ? '1' : '0',
      controls: opts.controls === false ? '0' : '1',
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      start: String(start),
      enablejsapi: '1',
      origin: location.origin === 'null' ? location.href.split('/').slice(0, -1).join('/') : location.origin
    });
    if (opts.loop) {
      params.set('loop', '1');
      params.set('playlist', id);
    }
    return 'https://www.youtube.com/embed/' + encodeURIComponent(id) + '?' + params.toString();
  }

  function embedUrlForTrack(track, opts) {
    const id = idFor(track);
    return id ? embedUrl(id, opts) : '';
  }

  function watchUrlForTrack(track, opts) {
    const id = idFor(track);
    const start = Number.isFinite(opts && opts.start) ? opts.start : randomStart(opts && opts.maxStart);
    return id ? 'https://youtu.be/' + encodeURIComponent(id) + '?t=' + start : '';
  }

  function iframeForTrack(track, opts) {
    const src = embedUrlForTrack(track, opts);
    if (!src) return null;
    const frame = document.createElement('iframe');
    frame.src = src;
    frame.title = (track && (track.t || track.title)) || 'AXIOMORT YouTube player';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.allowFullscreen = true;
    frame.loading = 'lazy';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    return frame;
  }

  window.AXYT = {
    VIDEO_IDS,
    idFor,
    hasTrack: (track) => !!idFor(track),
    randomStart,
    embedUrl,
    embedUrlForTrack,
    watchUrlForTrack,
    iframeForTrack
  };
})();
