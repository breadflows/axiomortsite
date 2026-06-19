(function(){
'use strict';

// ----------------------------------------------------
// 1. Tracks Database (reused from STUDIO SOUNDS 2025)
// ----------------------------------------------------
const TRACKS = [
  {title:"Machina Corpus",folder:"1 Machina Corpus",audio:"MixeaMediumNeutralhdMachinaCorpusRemaster-mastered.mp3",img:"800x800-9505173--C0B19EC7-5227-482C-817DCFE0055D6E4C--0--79710--imagelarge31db43c5af5c4ff8b9913f345351dc9f.jpg",isrc:"QZNWX2585565",release:"9 May 2025",upc:"199331125480"},
  {title:"Ink Of Infinity",folder:"2 Ink Of Infinity",audio:"LANDRInkOfInfinityBalancedMedium.mp3",img:"800x800-9505173--B75D4CEA-02D5-410C-AC950AA9DF5D6BE0--0--100291--imagelarge43b3c8433e324a10af4a4e457f932ea3.jpg",isrc:"QZTAS2572650",release:"25 May 2025",upc:"199524648765"},
  {title:"Rift's Bounty",folder:"3 Rift's Bounty",audio:"RiftsBountyMalikCreed-mastered.mp3",img:"800x800-9505173--9FE1D9EB-7BF6-4118-99A8A0B93088F070--0--1599132--driftsbountycover.jpg",isrc:"QZTAU2584933",release:"6 June 2025",upc:"199523503393"},
  {title:"The Nexus Veil",folder:"4 The Nexus Veil",audio:"TheNexusVeil.mp3",img:"800x800-9505173--CE0018D0-50BA-4021-90F9E03E696CF281--mod-1749445658.jpg",isrc:"QZTB22535368",release:"9 June 2025",upc:"199521237788"},
  {title:"The Nexus Veil (Galactic Chill)",folder:"5 The Nexus Veil (Galactic Chill)",audio:"TheNexusVeil (1).mp3",img:"800x800-9505173--11E05B6C-B27F-44C4-BF840D30A4889B43--0--81744--1000032453.jpg",isrc:"QZTB22537703",release:"9 June 2025",upc:"199521223361"},
  {title:"The Nexus Veil (Anthem)",folder:"6 The Nexus Veil (Anthem)",audio:"TheNEXUSVeilLessoverstimulatedvibesRemastered.mp3",img:"800x800-9505173--17F3D509-A665-448E-B9DB7B2CE8A52AD7--0--153455--imagelarge7a4eecb7723a47d8bb0edb1679bffb71.jpg",isrc:"QZTB82517271",release:"22 June 2025",upc:"199518309870"},
  {title:"The Rose Petals Resistance",folder:"7 The Rose Petals Ressistance",audio:"TheRosePetalsResistanceMayasNeonHuntv4style50weird50nopersonaextraelectro.mp3",img:"800x800-9505173--B85A943A-1F3E-42A1-ADCC197DC2899983--0--349490--03.jpg",isrc:"QZTB92557213",release:"25 June 2025",upc:"199517623885"},
  {title:"Ink Between Worlds (Rift Soundtrack)",folder:"8 Ink Between Worlds (The Rift Soundtrack)",audio:"ThroughtheInk.mp3",img:"800x800-9505173--D8232C15-0932-4C31-97F3DEFB411C7A33--0--88537--imagelarge9ca5c366c91f4797a9166f59963bbdda.jpg",isrc:"QZTB92583036",release:"25 June 2025",upc:"199517504771"},
  {title:"106.5s — Jul 1 4:32PM",folder:"9 106.5s Jul 1 432PM",audio:"106-mastered.mp3",img:"800x800-9505173--3D538CC9-2C15-44B9-8DED613E0D579BAA--0--3665304--f8916ddfda464653bf8fe9ca8fce36e7.jpg",isrc:"QZTBC2548360",release:"1 July 2025",upc:"199516141120"},
  {title:"Go Cry To Interpol",folder:"10 Go Cry To Interpol",audio:"GoCrytoInterpol.mp3",img:"800x800-9505173--5561940C-E202-4273-83C54CEC4D9D2375--0--1542355--0db03a51b6064a69920851a818f4c413.jpg",isrc:"QZTBD2550115",release:"3 July 2025",upc:"199515634296"},
  {title:"TrapStar",folder:"11 TrapStar",audio:"Trapstar.mp3",img:"800x800-9505173--2E6AC500-6191-449E-998B78A538B0EF21--0--61681--imagelarged18b89fcfde74845bffa63c56ebecbde.jpg",isrc:"QZTBC2558191",release:"28 June 2025",upc:"199514973303"},
  {title:"Glitch Rebirth",folder:"12 Glitch Rebirth",audio:"GlitchRebirthv0.2.mp3",img:"800x800-9505173--EF41E9B6-8A2E-49DA-A845A7C13520A74E--0--2260545--0c719f0d598f45e48650bbcb0ab8bc2b.jpg",isrc:"QZTBE2578978",release:"5 July 2025",upc:"199514970661"},
  {title:"Neon Hunters",folder:"13 Neon Hunters",audio:"RosePetalsRessistancehook.mp3",img:"800x800-9505173--D217436A-7E94-4DD0-A1F35DA9487143BA--0--1884888--ChatGPTImageJul102025022902AM.jpg",isrc:"QZWFE2543122",release:"10 July 2025",upc:"199514125245"},
  {title:"Event Horizon Lament",folder:"14 Event Horizon Lament",audio:"EventHorizonLament.mp3",img:"800x800-9505173--B52047B5-9B8C-45AD-89CC66335D4C7361--0--73648--1000034474.jpg",isrc:"QZWFJ2522862",release:"18 July 2025",upc:"199512214613"},
  {title:"Ink Between Worlds (Rift Mix)",folder:"15 Ink Between Worlds (Rift Mix)",audio:"InkBetweenWorldsRemasteredRemixnew100SIstyleimprovedv2.mp3",img:"800x800-9505173--BEC87121-EF7B-423C-9A59DED3366AC6D9--0--118580--1000035148.jpg",isrc:"QZWFL2599021",release:"24 July 2025",upc:"199510824005"},
  {title:"Nobody",folder:"16 Nobody",audio:"Timeline100086400.mp3",img:"800x800-9505173--70827A2E-B79D-4BDF-A56B7F0417343F2D--0--227840--01.jpg",isrc:"QZWFR2523595",release:"1 August 2025",upc:"199508715032"},
  {title:"Theta Glyph Eclipse — Inception Haze",folder:"17 Theta Glyph Eclipse -  Inception Haze",audio:"ThetaGlyphEclipseInstrumental.mp3",img:"800x800-9505173--41574B65-842C-4832-BD6D4740BEAACD74--0--2285016--breadflowsEcstaticroboticfemaleandroidinmetallictogavcf479809c54.jpg",isrc:"QZWFW2525744",release:"11 August 2025",upc:"199506249676"},
  {title:"Theta Glyph Eclipse — Recursive Bridge",folder:"18 Theta Glyph Eclipse - Recursive Bridge",audio:"ThetaGlyphEclipseInstrumental1.mp3",img:"800x800-9505173--41574B65-842C-4832-BD6D4740BEAACD74--0--2285016--breadflowsEcstaticroboticfemaleandroidinmetallictogavcf479809c54.jpg",isrc:"QZWFW2525745",release:"11 August 2025",upc:"199506249676"},
  {title:"Theta Glyph Eclipse — Awakening Hijack",folder:"19 Theta Glyph Eclipse - Awakening Hijack",audio:"ThetaGlyphEclipse.mp3",img:"800x800-9505173--41574B65-842C-4832-BD6D4740BEAACD74--0--2285016--breadflowsEcstaticroboticfemaleandroidinmetallictogavcf479809c54643.jpg",isrc:"QZWFW2525746",release:"11 August 2025",upc:"199506249676"},
  {title:"Theta Glyph Eclipse — Climax Divine",folder:"20 Theta Glyph Eclipse - Climax Divine",audio:"ThetaGlyphEclipse1.mp3",img:"800x800-9505173--41574B65-842C-4832-BD6D4740BEAACD74--0--2285016--breadflowsEcstaticroboticfemaleandroidinmetallictogavcf479809c5 (1).jpg",isrc:"QZWFW2525747",release:"11 August 2025",upc:"199506249676"},
  {title:"Pressure Seal",folder:"21 Pressure Seal",audio:"PressureSeal.mp3",img:"800x800-9505173--8C19305D-2798-47BF-A93DEF3BE3D337D0--0--85553--imagelarge1b0599a712d74ef4ac30b1be334d5044.jpg",isrc:"QZZ772542961",release:"18 August 2025",upc:"199326582861"},
  {title:"Chronodrift",folder:"22 Chronodrift",audio:"Chronodrift.mp3",img:"800x800-9505173--398DC3FC-6CD5-4E33-A0F24B0FB58C846E--0--1518526--gemini2.5flashimagepreviewEpiccinematicindustrialalbumcoverdarkmetalliccityscapeatduskasymme.jpg",isrc:"QT3EY2543171",release:"20 September 2025",upc:"199739552116"},
  {title:"Rift's Bounty — Creed's Oath",folder:"23 Rift's Bounty Creeds Oath",audio:"RiftsBountyv0.4.mp3",img:"800x800-9505173--78CBAF13-D1BE-45CD-89B657982A6B606E--0--93603--imagelarge69d5d43c1c4b43eb9cdaf3c7dc1c8bf1.jpg",isrc:"QT3FB2599805",release:"10 October 2025",upc:"199744063485"},
  {title:"When the Grace Is Good",folder:"24 When the Grace Is Good",audio:"WHENTHEGRACEISGOODMatrixCrackingVersionv0.2.mp3",img:"800x800-9505173--54264C4D-3ADB-4197-A2D935E8EAA154FD--0--40625--imagelargea282191724ca4b2e8721ac3251828592.jpg",isrc:"QT3FB2599808",release:"20 October 2025",upc:"199744063461"},
  {title:"Phantom Glide",folder:"25 Phantom Glide",audio:"PhantomGlide.mp3",img:"800x800-9505173--7DD6AA13-A2A1-4B74-98BA9BD85C58CD56--0--27597--imagelargea367396fdbc943eabbbd716798585956.jpg",isrc:"QT3FB2599840",release:"28 October 2025",upc:"199744063447"},
  {title:"GOOD GRACE",folder:"26 GOOD GRACE",audio:"TheSecondWaveWhentheGraceisGood2008Trance-mastered.mp3",img:"800x800-9505173--424BF13E-9019-483C-89F765392644ED7D--0--5464302--1000042374.jpg",isrc:"QT6EF2525636",release:"6 November 2025",upc:"199956805873"}
];

// Prepend studio sounds base folder path and assign metadata
const STUDIO_SOUNDS_BASE = "../media/tracks/";
const DESCRIPTIONS = [
  "Corrupted core systems awakening. Sector 1 of the cuneiform archives is now online.",
  "Exploring the outer boundary. The deep space signal repeats a cuneiform encryption.",
  "Deciphering cuneiform signatures. Rift fluctuations detected near the control hub.",
  "The boundary layer of the anomaly. Muted space-strings echo through the corridor.",
  "Galactic ambient frequencies recorded from the dark space terminal vacuum.",
  "Reconstructed soundtrack data from the first space rift expedition.",
  "The rose petals resistance signal. Decrypted files indicate active bio-mechanical pods.",
  "Sub-orbital ambient soundscape. Deep space resonance and void ripples.",
  "Signal frequency 106.5s. Broadcast origin remains unknown, dated July 1st.",
  "Intercepted communications. A dark wave signal referencing a cuneiform eclipse.",
  "High-frequency trap rhythms merged with low-poly console synthesizers.",
  "Glitch anomalies detected. Structural rebirth sequence active on deck 12.",
  "Hunter protocols initialized. Cybernetic pursuit units deployed in sector 13.",
  "Event horizon simulation. Gravity anomalies warping ambient telemetry.",
  "Rift mix variants. Cyber-symphonies reconstructed from damaged memory blocks.",
  "Ghost signals from the void. Origin indicates an empty cuneiform sector.",
  "Inception haze telemetry. Muted synth pads looping in a recursive cycle.",
  "The bridge between worlds. Cuneiform runes glowing at 50% power.",
  "Awakening hijacked network nodes. Muted security protocols detected.",
  "The divine climax. System stability critical. Rift energy peaking.",
  "Hermetic seal breach. Pressure levels dropping in sector 21.",
  "Chronodrift protocols active. Temporal distortion waves detected in transit.",
  "The creed's oath. Heavy bass loops echoing in the sub-level bunker.",
  "Matrix crack attempts. Synthetic voices breaking through the static.",
  "Glide sequence active. Muted propulsion systems navigating the dark void.",
  "Trance waveforms from the old world. Archives indicate year 2008 origin."
];
TRACKS.forEach(function(t, i) {
  t.num = i + 1;
  t.episode = "EPISODE " + String(i + 1).padStart(2, '0');
  t.desc = DESCRIPTIONS[i] || "Data block accessed. Running diagnostic telemetry.";
  t.audioURL = t.audio ? (STUDIO_SOUNDS_BASE + encodeURIComponent(t.folder) + '/' + encodeURIComponent(t.audio)) : '';
  t.imgURL   = t.img   ? (STUDIO_SOUNDS_BASE + encodeURIComponent(t.folder) + '/' + encodeURIComponent(t.img))   : '';
});

// Hoisted State Variables to prevent Temporal Dead Zone (TDZ) reference errors
let currentTrackIdx = 0;
let isPlaying = false;
let openPercent = 0;
let targetOpenPercent = 0;

// ----------------------------------------------------
// 2. Procedural Sound Effects Synthesizer (Web Audio API)
// ----------------------------------------------------
let synthCtx = null;

function initSynth() {
  if (synthCtx) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    synthCtx = new AudioContextClass();
  }
}

function playSelectSound() {
  initSynth();
  if (!synthCtx) return;
  if (synthCtx.state === 'suspended') synthCtx.resume();
  
  const now = synthCtx.currentTime;
  const osc = synthCtx.createOscillator();
  const gainNode = synthCtx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(659.25, now); // E5
  osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.1); // E4
  
  gainNode.gain.setValueAtTime(0.08, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  
  osc.connect(gainNode);
  gainNode.connect(synthCtx.destination);
  
  osc.start(now);
  osc.stop(now + 0.12);
}

function playClickSound() {
  initSynth();
  if (!synthCtx) return;
  if (synthCtx.state === 'suspended') synthCtx.resume();
  
  const now = synthCtx.currentTime;
  const osc = synthCtx.createOscillator();
  const gainNode = synthCtx.createGain();
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(440.00, now); // A4
  osc.frequency.setValueAtTime(880.00, now + 0.04); // A5
  
  gainNode.gain.setValueAtTime(0.12, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  
  osc.connect(gainNode);
  gainNode.connect(synthCtx.destination);
  
  osc.start(now);
  osc.stop(now + 0.2);
}

function playBootSound() {
  initSynth();
  if (!synthCtx) return;
  if (synthCtx.state === 'suspended') synthCtx.resume();
  
  const now = synthCtx.currentTime;
  const masterGain = synthCtx.createGain();
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(0.55, now + 1.5);
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + 8.5);
  masterGain.connect(synthCtx.destination);
  
  const filter = synthCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400, now);
  filter.frequency.exponentialRampToValueAtTime(350, now + 6.0);
  filter.connect(masterGain);
  
  // Synth sub bass and warm synth strings (root, octave, fifth, 10th)
  const freqs = [55.00, 110.00, 164.81, 220.00, 329.63]; // A1, A2, E3, A3, E4
  freqs.forEach((freq, idx) => {
    const osc = synthCtx.createOscillator();
    osc.type = idx % 2 === 0 ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(freq, now);
    
    // Add LFO pitch modulation
    const lfo = synthCtx.createOscillator();
    lfo.frequency.setValueAtTime(1.5 + idx * 0.4, now);
    const lfoGain = synthCtx.createGain();
    lfoGain.gain.setValueAtTime(idx === 0 ? 0.3 : 1.2, now);
    
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    
    const oscGain = synthCtx.createGain();
    oscGain.gain.setValueAtTime(0.18, now);
    
    osc.connect(oscGain);
    oscGain.connect(filter);
    
    lfo.start(now);
    osc.start(now);
    
    lfo.stop(now + 8.5);
    osc.stop(now + 8.5);
  });
}

// ----------------------------------------------------
// 3. WebGL Initialization (Three.js Setup)
// ----------------------------------------------------
const canvas = document.getElementById('webgl-canvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030406);
scene.fog = new THREE.Fog(0x030406, 12, 50);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 0.45, 5.5);
camera.lookAt(0, 0.25, 0);

// Custom mouse and touch drag rotation (replaces OrbitControls)
let isDragging = false;
let wasDragged = false;
let dragStartPos = { x: 0, y: 0 };
let previousMousePosition = { x: 0, y: 0 };
let targetRotationX = 0.2;
let targetRotationY = 0.4;
let currentRotationX = 0.2;
let currentRotationY = 0.4;

renderer.domElement.style.cursor = 'grab';

renderer.domElement.addEventListener('mousedown', (e) => {
  isDragging = true;
  wasDragged = false;
  dragStartPos = { x: e.clientX, y: e.clientY };
  renderer.domElement.style.cursor = 'grabbing';
  previousMousePosition = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const deltaX = e.clientX - previousMousePosition.x;
  const deltaY = e.clientY - previousMousePosition.y;
  
  if (Math.abs(e.clientX - dragStartPos.x) > 3 || Math.abs(e.clientY - dragStartPos.y) > 3) {
    wasDragged = true;
  }
  
  targetRotationY += deltaX * 0.008;
  targetRotationX += deltaY * 0.008;
  
  // Limit rotation X to prevent going completely upside down
  targetRotationX = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, targetRotationX));
  
  previousMousePosition = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mouseup', () => {
  isDragging = false;
  renderer.domElement.style.cursor = 'grab';
});

// Touch events for mobile
renderer.domElement.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    isDragging = true;
    previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
}, { passive: true });

renderer.domElement.addEventListener('touchmove', (e) => {
  if (!isDragging || e.touches.length !== 1) return;
  const deltaX = e.touches[0].clientX - previousMousePosition.x;
  const deltaY = e.touches[0].clientY - previousMousePosition.y;
  
  targetRotationY += deltaX * 0.008;
  targetRotationX += deltaY * 0.008;
  targetRotationX = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, targetRotationX));
  
  previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

window.addEventListener('touchend', () => {
  isDragging = false;
});

// Ambient and Focused Spot/Rim Lighting (dimmed for menu prominence)
scene.add(new THREE.AmbientLight(0x121620, 0.2));

const mainLight = new THREE.DirectionalLight(0xdbe4f5, 0.35);
mainLight.position.set(2, 8, 3);
scene.add(mainLight);

// Spotlight focused directly on the display pedestal and CD case
const spotLight = new THREE.SpotLight(0xffffff, 1.2, 12, Math.PI / 5, 0.6, 1.0);
spotLight.position.set(0, 5, 2.5);
scene.add(spotLight);

// Slow, atmospheric steel-blue rim lights to reflect off the CD plastic
const blueRimLight = new THREE.PointLight(0x56c2e6, 0.7, 15);
blueRimLight.position.set(-4, 2, 2);
scene.add(blueRimLight);

const purpleRimLight = new THREE.PointLight(0xa892b5, 0.4, 15);
purpleRimLight.position.set(4, 2, -2);
scene.add(purpleRimLight);

// ----------------------------------------------------
// 4. Background Void Atmosphere (Starfields & Grid)
// ----------------------------------------------------
// Nebula particle stars
(function(){
  const geom = new THREE.BufferGeometry();
  const count = 1200;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 25 + Math.random() * 45;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ size: 0.08, color: 0x9fbcff, transparent: true, opacity: 0.8 });
  scene.add(new THREE.Points(geom, mat));
})();

// Floating Y2K wireframe torus shapes in the background
const wireframes = [];
(function(){
  const torusGeom = new THREE.TorusGeometry(8, 0.2, 8, 48);
  const wireMat = new THREE.MeshBasicMaterial({ color: 0xbd2bda, wireframe: true, transparent: true, opacity: 0.005 });
  
  const torus1 = new THREE.Mesh(torusGeom, wireMat);
  torus1.position.set(0, 0, -10);
  scene.add(torus1);
  wireframes.push(torus1);

  const torus2 = new THREE.Mesh(new THREE.TorusGeometry(12, 0.15, 8, 48), new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.003 }));
  torus2.position.set(0, 0, -15);
  scene.add(torus2);
  wireframes.push(torus2);
})();

// Cybernetic bottom grid floor (muted slate-gray console BIOS style)
(function(){
  const grid = new THREE.GridHelper(50, 40, 0x323a48, 0x161c25);
  grid.position.y = -2.2;
  grid.material.transparent = true;
  grid.material.opacity = 0.02;
  scene.add(grid);
})();

// ----------------------------------------------------
// 5. Console Display Pedestal & Cuneiform Runes
// ----------------------------------------------------
function makePedestalTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const x = c.getContext('2d');
  
  // Slate-gray stone base
  x.fillStyle = '#11141a';
  x.fillRect(0, 0, 512, 128);
  
  // Stone grain noise
  x.fillStyle = 'rgba(255, 255, 255, 0.03)';
  for (let i = 0; i < 400; i++) {
    x.fillRect(Math.random() * 512, Math.random() * 128, 2, 2);
  }
  
  // Procedural cuneiform wedge drawer
  function drawWedge(wx, wy, scale, rotAngle) {
    x.save();
    x.translate(wx, wy);
    x.rotate(rotAngle);
    x.scale(scale, scale);
    
    x.fillStyle = '#378051';
    
    // Wedge head (triangle)
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(-8, -4.5);
    x.lineTo(-8, 4.5);
    x.closePath();
    x.fill();
    
    // Wedge tail (line)
    x.beginPath();
    x.moveTo(-8, 0);
    x.lineTo(-24, 0);
    x.strokeStyle = '#378051';
    x.lineWidth = 2.5;
    x.stroke();
    x.restore();
  }

  // Draw 5 distinct procedurally composed cuneiform runes
  // Rune 1
  drawWedge(95, 64, 1.15, 0);
  drawWedge(110, 44, 1.15, Math.PI / 2);
  
  // Rune 2
  drawWedge(175, 48, 0.95, 0);
  drawWedge(175, 64, 0.95, 0);
  drawWedge(175, 80, 0.95, 0);
  drawWedge(195, 64, 1.15, Math.PI / 2);
  
  // Rune 3
  drawWedge(255, 54, 1.05, Math.PI / 4);
  drawWedge(255, 74, 1.05, -Math.PI / 4);
  
  // Rune 4
  drawWedge(335, 64, 1.15, Math.PI / 4);
  drawWedge(345, 48, 1.15, Math.PI / 2);
  
  // Rune 5
  drawWedge(415, 64, 1.25, 0);
  
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const pedestalTex = makePedestalTexture();

const stoneMat = new THREE.MeshStandardMaterial({
  color: 0x141822,
  roughness: 0.85,
  metalness: 0.25
});

const frontStoneMat = new THREE.MeshStandardMaterial({
  map: pedestalTex,
  emissive: 0x378051,
  emissiveMap: pedestalTex,
  emissiveIntensity: 0.05,
  roughness: 0.85,
  metalness: 0.2
});

const pedestal = new THREE.Mesh(
  new THREE.BoxGeometry(2.1, 0.45, 2.1),
  [stoneMat, stoneMat, stoneMat, stoneMat, frontStoneMat, stoneMat]
);
pedestal.scale.set(0.35, 0.35, 0.35);
pedestal.position.set(0, -0.28, 0);
scene.add(pedestal);

// ----------------------------------------------------
// 6. Texture Loading
// ----------------------------------------------------
const texLoader = new THREE.TextureLoader();
texLoader.setCrossOrigin('');

const textures = {
  grime: texLoader.load('assets/image_6.png'),
  iridescence: texLoader.load('assets/image_5.png'),
  frontCover: texLoader.load('assets/image_7.png'),
  backTray: texLoader.load('assets/image_8.png')
};

// ----------------------------------------------------
// 7. 3D CD Jewel Case & Disc Assembly
// ----------------------------------------------------
const jewelCaseGroup = new THREE.Group();
jewelCaseGroup.scale.set(0.35, 0.35, 0.35);
scene.add(jewelCaseGroup);
spotLight.target = jewelCaseGroup;

// Translucent plastic material
const plasticMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.45,
  transmission: 0.9,
  roughness: 0.25,
  roughnessMap: textures.grime,
  metalness: 0.05,
  clearcoat: 1.0,
  clearcoatRoughness: 0.1,
  side: THREE.DoubleSide
});

// A. Back Cover Tray Assembly
const backTrayGroup = new THREE.Group();
jewelCaseGroup.add(backTrayGroup);

const backCase = new THREE.Mesh(new THREE.BoxGeometry(2.82, 2.52, 0.06), plasticMat);
backCase.position.set(0, 0, -0.04);
backTrayGroup.add(backCase);

const backInlay = new THREE.Mesh(
  new THREE.PlaneGeometry(2.76, 2.46),
  new THREE.MeshBasicMaterial({ map: textures.backTray, side: THREE.FrontSide })
);
backInlay.position.set(0, 0, -0.025);
backTrayGroup.add(backInlay);

const internalTray = new THREE.Mesh(
  new THREE.BoxGeometry(2.76, 2.46, 0.04),
  new THREE.MeshStandardMaterial({ color: 0x050810, transparent: true, opacity: 0.78, roughness: 0.35 })
);
internalTray.position.set(0, 0, -0.02);
backTrayGroup.add(internalTray);

// Upgraded PlayStation-style Center Spindle (holds CD)
const spindleGroup = new THREE.Group();
spindleGroup.position.set(0, 0, -0.012);
spindleGroup.rotation.x = Math.PI / 2;
backTrayGroup.add(spindleGroup);

const spindleCap = new THREE.Mesh(
  new THREE.CylinderGeometry(0.13, 0.13, 0.08, 32),
  new THREE.MeshStandardMaterial({ color: 0x07070a, roughness: 0.4 })
);
spindleGroup.add(spindleCap);

const spindleBase = new THREE.Mesh(
  new THREE.CylinderGeometry(0.24, 0.24, 0.03, 32),
  new THREE.MeshStandardMaterial({ color: 0x15161c, roughness: 0.3, metalness: 0.5 })
);
spindleBase.position.y = -0.025;
spindleGroup.add(spindleBase);

// Three tiny steel bearings
for (let i = 0; i < 3; i++) {
  const angle = (i / 3) * Math.PI * 2;
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x888a93, metalness: 1.0, roughness: 0.08 })
  );
  ball.position.set(Math.cos(angle) * 0.12, 0.01, Math.sin(angle) * 0.12);
  spindleGroup.add(ball);
}

// B. Front Door Hinge Pivot Assembly
const frontHinge = new THREE.Group();
frontHinge.position.set(-1.41, 0, 0); // Position at the left edge of the case
jewelCaseGroup.add(frontHinge);

// Front lid attached to the hinge (so offset by its half-width in X)
const frontLid = new THREE.Mesh(new THREE.BoxGeometry(2.82, 2.52, 0.06), plasticMat);
frontLid.position.set(1.41, 0, 0.04);
frontHinge.add(frontLid);

// Positioned clearly in front of the CD (Z = 0.024) to avoid rendering depth bugs when closed
const frontBooklet = new THREE.Mesh(
  new THREE.PlaneGeometry(2.76, 2.46),
  new THREE.MeshBasicMaterial({ map: textures.frontCover, side: THREE.FrontSide })
);
frontBooklet.position.set(1.41, 0, 0.024);
frontHinge.add(frontBooklet);

// Plain white paper inside page of booklet so it's not mirrored cover art when open
const bookletInside = new THREE.Mesh(
  new THREE.PlaneGeometry(2.76, 2.46),
  new THREE.MeshBasicMaterial({ color: 0xf0f0f5, side: THREE.FrontSide })
);
bookletInside.position.set(1.41, 0, 0.022);
bookletInside.rotation.y = Math.PI; // Face the inside of the cover
frontHinge.add(bookletInside);

// C. Detailed Internal Polycarbonate CD Disc
const cdGroup = new THREE.Group();
jewelCaseGroup.add(cdGroup);

// Dedicated Spin Group so all CD components spin together
const cdSpinGroup = new THREE.Group();
cdGroup.add(cdSpinGroup);

const cdRadius = 1.15;
const cdThickness = 0.015;

// Extruded shape for physical center hole and beveled rims
const cdShape = new THREE.Shape();
cdShape.absarc(0, 0, cdRadius, 0, Math.PI * 2, false);

const holePath = new THREE.Path();
holePath.absarc(0, 0, 0.15, 0, Math.PI * 2, true);
cdShape.holes.push(holePath);

const extrudeSettings = {
  depth: cdThickness,
  bevelEnabled: true,
  bevelSegments: 2,
  steps: 1,
  bevelSize: 0.002,
  bevelThickness: 0.002,
  curveSegments: 32
};

const cdGeom = new THREE.ExtrudeGeometry(cdShape, extrudeSettings);

const clearPlasticMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.35,
  transmission: 0.9,
  roughness: 0.12,
  metalness: 0.1,
  clearcoat: 1.0,
  clearcoatRoughness: 0.05,
  ior: 1.58,
  thickness: cdThickness,
  side: THREE.DoubleSide
});

const cdBody = new THREE.Mesh(cdGeom, clearPlasticMat);
cdSpinGroup.add(cdBody);

// Printed CD label on the front side (radius 0.38 to outer rim)
const cdLabelMat = new THREE.MeshStandardMaterial({
  map: textures.iridescence, // Updated to track cover dynamically
  roughness: 0.4,
  metalness: 0.15,
  side: THREE.FrontSide
});
const cdLabel = new THREE.Mesh(
  new THREE.RingGeometry(0.38, cdRadius * 0.98, 64),
  cdLabelMat
);
cdLabel.position.z = cdThickness + 0.003;
cdSpinGroup.add(cdLabel);

// Underside label (shiny rainbow diffraction stripes procedurally generated with radial rays)
function makeCDStripeTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const x = c.getContext('2d');
  const cx = 256, cy = 256;
  
  // Base dark silver metal color
  x.fillStyle = '#6e737c';
  x.fillRect(0, 0, 512, 512);
  
  // Radial color wedges (diffraction rays)
  const numWedges = 270;
  for (let i = 0; i < numWedges; i++) {
    const angle1 = (i / numWedges) * Math.PI * 2;
    const angle2 = ((i + 1.2) / numWedges) * Math.PI * 2;
    
    // Smooth spectrum color cycles radiating outward
    const wave = Math.sin(angle1 * 3.5);
    const hue = (wave * 180 + 180) % 360;
    
    // Wedge shape
    x.beginPath();
    x.moveTo(cx, cy);
    x.arc(cx, cy, 256, angle1, angle2);
    x.closePath();
    
    // Radial gradient along the wedge
    const grd = x.createRadialGradient(cx, cy, 80, cx, cy, 250);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.2, `hsla(${hue}, 95%, 50%, 0.45)`);
    grd.addColorStop(0.5, `hsla(${hue + 35}, 95%, 55%, 0.4)`);
    grd.addColorStop(0.8, `hsla(${hue}, 95%, 50%, 0.45)`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    
    x.fillStyle = grd;
    x.fill();
  }
  
  // Specular reflection lines
  x.globalCompositeOperation = 'lighter';
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 180) {
    if (Math.sin(a * 4) > 0.94) {
      const grd = x.createLinearGradient(cx, cy, cx + Math.cos(a) * 250, cy + Math.sin(a) * 250);
      grd.addColorStop(0, 'rgba(255,255,255,0)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.18)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      x.strokeStyle = grd;
      x.lineWidth = 2.5;
      x.beginPath();
      x.moveTo(cx, cy);
      x.lineTo(cx + Math.cos(a) * 256, cy + Math.sin(a) * 256);
      x.stroke();
    }
  }
  
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const cdBackStripeTex = makeCDStripeTex();

const cdDataMat = new THREE.MeshStandardMaterial({
  map: cdBackStripeTex,
  metalness: 0.98,
  roughness: 0.12,
  side: THREE.FrontSide
});
const cdDataRing = new THREE.Mesh(
  new THREE.RingGeometry(0.38, cdRadius * 0.98, 64),
  cdDataMat
);
cdDataRing.position.z = -0.003;
cdDataRing.rotation.y = Math.PI; // flip to face backward
cdSpinGroup.add(cdDataRing);

// Steel mirror band with radial barcode and etched text
function makeMirrorBandTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const x = c.getContext('2d');
  const cx = 256, cy = 256;
  
  x.fillStyle = '#9498a1';
  x.fillRect(0, 0, 512, 512);
  
  // Radial barcode
  x.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  for (let r = 85; r < 185; r += 2 + Math.floor(Math.random() * 4)) {
    x.lineWidth = Math.random() > 0.5 ? 1.5 : 0.8;
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.stroke();
  }
  
  // Laser text
  x.fillStyle = 'rgba(255, 255, 255, 0.45)';
  x.font = 'bold 9px "Share Tech Mono", monospace';
  x.textAlign = 'center';
  const textStr = "AURORA DDS * CD-ROM * ISRC-QZNWX2585565 * MADE IN NEBULA-1 * VOL.2026";
  for (let i = 0; i < textStr.length; i++) {
    const angle = (i / textStr.length) * Math.PI * 2;
    x.save();
    x.translate(cx + Math.cos(angle) * 192, cy + Math.sin(angle) * 192);
    x.rotate(angle + Math.PI / 2);
    x.fillText(textStr[i], 0, 0);
    x.restore();
  }
  
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const mirrorBandTex = makeMirrorBandTexture();

const cdMirrorBandMat = new THREE.MeshStandardMaterial({
  map: mirrorBandTex,
  metalness: 0.98,
  roughness: 0.1,
  side: THREE.FrontSide
});
const cdMirrorBand = new THREE.Mesh(
  new THREE.RingGeometry(0.16, 0.38, 64),
  cdMirrorBandMat
);
cdMirrorBand.position.z = -0.002;
cdMirrorBand.rotation.y = Math.PI; // flip to face backward
cdSpinGroup.add(cdMirrorBand);

// Initial position (resting flat inside case)
cdGroup.position.set(0, 0, 0);

// Base orientation of the entire case (rotated slightly to show depth, centered)
jewelCaseGroup.position.set(0, 0.25, 0);
jewelCaseGroup.rotation.set(0.2, 0.4, 0);

// ----------------------------------------------------
// 8. Audio Visualizer Setup (Platform Rings)
// ----------------------------------------------------
const VIZ_COUNT = 64;
const vizBars = [];
const vizGroup = new THREE.Group();
scene.add(vizGroup);

for (let i = 0; i < VIZ_COUNT; i++) {
  const angle = (i / VIZ_COUNT) * Math.PI * 2;
  const bar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.007, 1, 8),
    new THREE.MeshBasicMaterial({ color: 0x56c2e6, transparent: true, opacity: 0.55 })
  );
  // Place on a circle closely hugging the cuneiform pedestal
  bar.position.set(Math.cos(angle) * 0.77, -2.2 + 0.5, Math.sin(angle) * 0.77);
  bar.scale.y = 0.001; // Start flat
  vizGroup.add(bar);
  vizBars.push(bar);
}

// ----------------------------------------------------
// 8.5. CoverFlow Carousel Initialization & Loader
// ----------------------------------------------------
const coverTextures = new Array(TRACKS.length).fill(null);

function makePlaceholderTex(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#060914'; x.fillRect(0, 0, 256, 256);
  x.fillStyle = '#00f0ff'; x.font = 'bold 36px "Share Tech Mono"'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text || 'AURORA', 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function loadCoverTexture(url, onLoad, onError) {
  const img = new Image();
  img.onload = function() {
    const tex = new THREE.Texture(img);
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    onLoad(tex);
  };
  img.onerror = function(e) { onError && onError(e); };
  img.src = url;
}

// Helper to get active track cover URL
function getTrackCoverURL(idx) {
  const t = TRACKS[idx];
  if (t && t.resolvedImgURL) return t.resolvedImgURL;
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23060914"/><text x="50" y="55" font-family="Share Tech Mono" font-size="20" fill="%2300f0ff" text-anchor="middle">${idx + 1}</text></svg>`;
}

// 2D HTML Carousel Centering & Update Logic (PS2/GameCube 3-Slot save file layout)
function updateHTMLCarousel() {
  const cardLeftEl = document.getElementById('card-left');
  const cardCenterEl = document.getElementById('card-center');
  const cardRightEl = document.getElementById('card-right');
  if (!cardLeftEl || !cardCenterEl || !cardRightEl) return;

  const total = TRACKS.length;
  const leftIdx = (currentTrackIdx - 1 + total) % total;
  const centerIdx = currentTrackIdx;
  const rightIdx = (currentTrackIdx + 1 + total) % total;

  const leftTrack = TRACKS[leftIdx];
  const centerTrack = TRACKS[centerIdx];
  const rightTrack = TRACKS[rightIdx];

  // Render left mini card
  cardLeftEl.innerHTML = `
    <div class="mini-save-card" title="${leftTrack.title}">
      <img src="${getTrackCoverURL(leftIdx)}" />
    </div>
  `;

  // Render right mini card
  cardRightEl.innerHTML = `
    <div class="mini-save-card" title="${rightTrack.title}">
      <img src="${getTrackCoverURL(rightIdx)}" />
    </div>
  `;

  // Render center save file tile
  const fileNo = String(centerIdx + 1).padStart(2, '0');
  cardCenterEl.innerHTML = `
    <div class="save-file-card">
      <div class="card-badge">8MB</div>
      <div class="card-label-area">AURORA SYSTEM</div>
      <div class="card-thumb-border">
        <img src="${getTrackCoverURL(centerIdx)}" class="card-thumb-img" />
      </div>
      <div class="card-sector-info">
        <span class="sector-label">FILE NO.</span>
        <span class="sector-value">${fileNo}</span>
      </div>
    </div>
    <div class="card-under-title">${centerTrack.title}</div>
    <div class="card-under-meta">MISSION ACTIVE</div>
  `;

  // Update Right Stats panel properties
  const statStatusEl = document.getElementById('stat-status');
  const statFileEl = document.getElementById('stat-file');
  const statCompletionEl = document.getElementById('stat-completion');
  
  if (statStatusEl) statStatusEl.textContent = isPlaying ? "RUNNING" : "ACTIVE";
  if (statFileEl) statFileEl.textContent = fileNo;
  if (statCompletionEl) {
    const pct = Math.floor(((centerIdx + 1) / total) * 100);
    statCompletionEl.textContent = pct + "%";
  }
}

// Build 2D Carousel elements dynamically
function buildHTMLCarousel() {
  updateHTMLCarousel();
  
  // Bind click event listeners to slot elements so clicking left/right navigates
  const leftSlot = document.getElementById('card-left');
  const rightSlot = document.getElementById('card-right');
  
  if (leftSlot) {
    leftSlot.addEventListener('click', () => {
      playClickSound();
      loadTrack(currentTrackIdx - 1, isPlaying);
    });
  }
  if (rightSlot) {
    rightSlot.addEventListener('click', () => {
      playClickSound();
      loadTrack(currentTrackIdx + 1, isPlaying);
    });
  }
  
  const centerSlot = document.getElementById('card-center');
  if (centerSlot) {
    centerSlot.addEventListener('click', () => {
      togglePlayback();
    });
  }
}

// Build horizontal carousel on load
buildHTMLCarousel();

// Load covers from database or fallback URLs
for (let i = 0; i < TRACKS.length; i++) {
  const t = TRACKS[i];
  const embedded = (window.COVER_DATA && window.COVER_DATA[t.folder]) || '';
  const tryURLs = [embedded, t.imgURL, t.folder + '/' + t.img].filter(Boolean);
  
  (function(idx, urls) {
    let attempt = 0;
    function tryNext() {
      if (attempt >= urls.length) { return; }
      const u = urls[attempt++];
      loadCoverTexture(u,
        function(tex) {
          coverTextures[idx] = tex;
          TRACKS[idx].resolvedImgURL = u; // Cache the loaded URL
          if (idx === currentTrackIdx) {
            frontBooklet.material.map = tex;
            frontBooklet.material.needsUpdate = true;
            cdLabel.material.map = tex;
            cdLabel.material.needsUpdate = true;
          }
          // Update carousel view
          updateHTMLCarousel();
        },
        tryNext
      );
    }
    tryNext();
  })(i, tryURLs);
}
// ----------------------------------------------------
// 9. Audio Player & Analyser Integration
// ----------------------------------------------------
const audio = document.getElementById('audio-player');
let audioCtx = null, analyser = null, freqData = null, sourceNode = null;
const youtubePanel = document.createElement('div');
youtubePanel.style.cssText = 'position:fixed;right:18px;bottom:150px;width:min(430px,42vw);aspect-ratio:16/9;z-index:35;border:1px solid rgba(86,194,230,.35);background:#02050b;box-shadow:0 18px 50px rgba(0,0,0,.5);display:none';
const youtubeFrame = document.createElement('iframe');
youtubeFrame.style.cssText = 'width:100%;height:100%;border:0;display:block';
youtubeFrame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
youtubeFrame.allowFullscreen = true;
youtubePanel.appendChild(youtubeFrame);
document.body.appendChild(youtubePanel);
let youtubePlaying = false;

function initAnalyser() {
  if (audioCtx) return;
  if (location.protocol === 'file:') {
    // WebAudio is blocked on local file:// files in some browsers, skip analysis and run synthetics
    return;
  }
  try {
    const CtxClass = window.AudioContext || window.webkitAudioContext;
    if (!CtxClass) return;
    audioCtx = new CtxClass();
    sourceNode = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);
  } catch (e) {
    console.warn('AudioContext failed to initialize', e);
  }
}

// ----------------------------------------------------
// 10. Player UI Control Logic
// ----------------------------------------------------
// (State variables are declared at the top of the script)

const trackNumberEl = document.getElementById('track-number');
const trackTitleEl = document.getElementById('track-title');
const trackMetadataEl = document.getElementById('track-metadata');
const seekFillEl = document.getElementById('seek-fill');
const seekBarEl = document.getElementById('seek-bar');
const timeCurrentEl = document.getElementById('time-current');
const timeDurationEl = document.getElementById('time-duration');
const errorConsoleEl = document.getElementById('error-console');

const playBtn = document.getElementById('ctrl-play');
const prevBtn = document.getElementById('ctrl-prev');
const nextBtn = document.getElementById('ctrl-next');

// LEFT VERTICAL NAVIGATION MENU BINDINGS & ACTIONS
let activeMenuIdx = 0;
const menuItems = ['menu-load', 'menu-new', 'menu-options', 'menu-extras', 'menu-back'];
let visualizerMode = 0; // 0: Normal, 1: High, 2: Off
let autoRotateCase = true;

function selectMenuItem(idx) {
  activeMenuIdx = idx;
  menuItems.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    const pointer = el.querySelector('.menu-pointer');
    if (i === idx) {
      el.classList.add('active');
      if (pointer) pointer.textContent = '>';
    } else {
      el.classList.remove('active');
      if (pointer) pointer.textContent = '';
    }
  });
}

function triggerMenuAction(id) {
  if (id === 'menu-load') {
    togglePlayback();
  } else if (id === 'menu-new') {
    audio.currentTime = 0;
    if (audio.paused) {
      togglePlayback();
    } else {
      playClickSound();
    }
  } else if (id === 'menu-options') {
    visualizerMode = (visualizerMode + 1) % 3;
    const baseColor = new THREE.Color(visualizerMode === 2 ? 0x10141d : 0x56c2e6);
    vizBars.forEach(bar => {
      bar.material.color.copy(baseColor);
      if (visualizerMode === 2) {
        bar.scale.y = 0.001;
        bar.position.y = -2.2;
      }
    });
  } else if (id === 'menu-extras') {
    autoRotateCase = !autoRotateCase;
  } else if (id === 'menu-back') {
    resetPlayer();
    const bootScreen = document.getElementById('boot-screen');
    if (bootScreen) {
      bootScreen.style.visibility = 'visible';
      bootScreen.style.opacity = 1;
    }
    if (window.restartBootAnimation) window.restartBootAnimation();
  }
}

menuItems.forEach((id, idx) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('click', () => {
      playClickSound();
      selectMenuItem(idx);
      triggerMenuAction(id);
    });
  }
});

function formatTime(s) {
  if (!isFinite(s) || s < 0) return '00:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
}

function loadTrack(idx, autoplay = false) {
  currentTrackIdx = (idx + TRACKS.length) % TRACKS.length;
  const t = TRACKS[currentTrackIdx];
  
  const trackNumberEl = document.getElementById('track-number');
  const trackEpisodeEl = document.getElementById('track-episode');
  const trackTitleEl = document.getElementById('track-title');
  const trackDescriptionEl = document.getElementById('track-description');
  
  if (trackNumberEl) trackNumberEl.textContent = 'TRACK ' + String(t.num).padStart(2, '0');
  if (trackEpisodeEl) trackEpisodeEl.textContent = t.episode || 'EPISODE ' + String(t.num).padStart(2, '0');
  if (trackTitleEl) trackTitleEl.textContent = t.title;
  if (trackDescriptionEl) trackDescriptionEl.textContent = t.desc || 'Memory block accessed. Telemetry active.';
  if (errorConsoleEl) errorConsoleEl.style.display = 'none';

  // Update cover art textures dynamically
  if (coverTextures[currentTrackIdx]) {
    if (frontBooklet) {
      frontBooklet.material.map = coverTextures[currentTrackIdx];
      frontBooklet.material.needsUpdate = true;
    }
    if (cdLabel) {
      cdLabel.material.map = coverTextures[currentTrackIdx];
      cdLabel.material.needsUpdate = true;
    }
  } else {
    const ph = makePlaceholderTex(String(t.num));
    if (frontBooklet) {
      frontBooklet.material.map = ph;
      frontBooklet.material.needsUpdate = true;
    }
    if (cdLabel) {
      cdLabel.material.map = ph;
      cdLabel.material.needsUpdate = true;
    }
  }

  // Update the horizontal 2D HTML/CSS carousel view
  updateHTMLCarousel();

  const youtubeSrc = window.AXYT ? AXYT.embedUrlForTrack(t, { autoplay: !!autoplay, mute: false, controls: true, loop: true }) : '';
  if (youtubeSrc) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    youtubeFrame.src = autoplay ? youtubeSrc : '';
    youtubePanel.style.display = autoplay ? 'block' : 'none';
    youtubePlaying = !!autoplay;
    if (seekFillEl) seekFillEl.style.width = '0%';
    if (timeCurrentEl) timeCurrentEl.textContent = 'YT';
    if (timeDurationEl) timeDurationEl.textContent = 'LIVE';
  } else if (t.audioURL) {
    youtubeFrame.src = '';
    youtubePanel.style.display = 'none';
    youtubePlaying = false;
    audio.src = t.audioURL;
    if (autoplay) {
      initAnalyser();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      audio.play().catch(e => { showError('Playback blocked: ' + e.message); });
    }
  } else {
    youtubeFrame.src = '';
    youtubePanel.style.display = 'none';
    youtubePlaying = false;
    audio.removeAttribute('src');
    audio.load();
  }
  updatePlayButtonUI();
}

function showError(msg) {
  if (errorConsoleEl) {
    errorConsoleEl.textContent = msg;
    errorConsoleEl.style.display = 'block';
  }
}

function updatePlayButtonUI() {
  const active = youtubePlaying || (!audio.paused && !audio.ended && audio.src);
  isPlaying = active;
  if (playBtn) playBtn.textContent = active ? '⏸' : '▶';
  targetOpenPercent = active ? 1 : 0;
  
  // Update stats panel status
  const statStatusEl = document.getElementById('stat-status');
  if (statStatusEl) statStatusEl.textContent = active ? "RUNNING" : "ACTIVE";
}

function togglePlayback() {
  const t = TRACKS[currentTrackIdx];
  const youtubeSrc = window.AXYT ? AXYT.embedUrlForTrack(t, { autoplay: true, mute: false, controls: true, loop: true }) : '';
  if (youtubeSrc) {
    if (youtubePlaying) {
      youtubeFrame.src = '';
      youtubePlaying = false;
    } else {
      youtubeFrame.src = youtubeSrc;
      youtubePanel.style.display = 'block';
      youtubePlaying = true;
    }
    updatePlayButtonUI();
    return;
  }
  if (!audio.src) return;
  initAnalyser();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  
  if (audio.paused) {
    audio.play().catch(e => { showError('Playback blocked: ' + e.message); });
  } else {
    audio.pause();
  }
  updatePlayButtonUI();
}

function nextTrack() {
  loadTrack(currentTrackIdx + 1, isPlaying);
}

function prevTrack() {
  loadTrack(currentTrackIdx - 1, isPlaying);
}

function resetPlayer() {
  audio.pause();
  audio.currentTime = 0;
  youtubeFrame.src = '';
  youtubePlaying = false;
  targetOpenPercent = 0;
  updatePlayButtonUI();
}

// Audio Listeners
if (playBtn) playBtn.addEventListener('click', togglePlayback);
if (nextBtn) nextBtn.addEventListener('click', nextTrack);
if (prevBtn) prevBtn.addEventListener('click', prevTrack);

audio.addEventListener('play', () => { isPlaying = true; updatePlayButtonUI(); });
audio.addEventListener('pause', () => { isPlaying = false; updatePlayButtonUI(); });
audio.addEventListener('ended', nextTrack);
audio.addEventListener('error', () => {
  showError('Could not play file. Please run a local web server (e.g. "python -m http.server") to access media files correctly.');
});

audio.addEventListener('timeupdate', () => {
  if (audio.duration) {
    const pct = (audio.currentTime / audio.duration) * 100;
    if (seekFillEl) seekFillEl.style.width = pct + '%';
    if (timeCurrentEl) timeCurrentEl.textContent = formatTime(audio.currentTime);
    if (timeDurationEl) timeDurationEl.textContent = formatTime(audio.duration);
    
    // Sync Right Stats Panel
    const statTimeEl = document.getElementById('stat-time');
    if (statTimeEl) statTimeEl.textContent = formatTime(audio.currentTime);
    
    const statCompletionEl = document.getElementById('stat-completion');
    if (statCompletionEl) {
      statCompletionEl.textContent = Math.floor(pct) + "%";
    }
  }
});

audio.addEventListener('loadedmetadata', () => {
  if (timeDurationEl) timeDurationEl.textContent = formatTime(audio.duration);
});

if (seekBarEl) {
  seekBarEl.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = seekBarEl.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  });
}

// Scroll to browse tracks
window.addEventListener('wheel', (e) => {
  const dir = Math.sign(e.deltaY);
  if (dir !== 0) {
    playSelectSound();
    loadTrack(currentTrackIdx + dir, isPlaying);
  }
}, { passive: true });

// Keyboard hotkeys
window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowRight') { playSelectSound(); nextTrack(); }
  else if (e.code === 'ArrowLeft') { playSelectSound(); prevTrack(); }
  else if (e.code === 'ArrowDown') {
    e.preventDefault();
    playSelectSound();
    selectMenuItem((activeMenuIdx + 1) % menuItems.length);
  }
  else if (e.code === 'ArrowUp') {
    e.preventDefault();
    playSelectSound();
    selectMenuItem((activeMenuIdx - 1 + menuItems.length) % menuItems.length);
  }
  else if (e.code === 'Enter') {
    e.preventDefault();
    playClickSound();
    triggerMenuAction(menuItems[activeMenuIdx]);
  }
  else if (e.code === 'Space') { e.preventDefault(); playClickSound(); togglePlayback(); }
});

// Double click case to open/close
const ray = new THREE.Raycaster();
const mouseV = new THREE.Vector2();

renderer.domElement.addEventListener('click', (e) => {
  if (wasDragged) return; // Ignore clicks if mouse was dragged
  
  mouseV.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseV.y = -(e.clientY / window.innerHeight) * 2 + 1;
  
  ray.setFromCamera(mouseV, camera);
  
  // Check if clicked the CD jewel case to play/pause
  const caseHits = ray.intersectObjects(jewelCaseGroup.children, true);
  if (caseHits.length > 0) {
    playClickSound();
    togglePlayback();
  }
});

renderer.domElement.addEventListener('dblclick', () => {
  playClickSound();
  togglePlayback();
});

// Boot screen activation
const pressStartBtn = document.getElementById('press-start-btn');
if (pressStartBtn) {
  pressStartBtn.addEventListener('click', () => {
    playBootSound();
    
    // Fade out boot screen
    const bootScreen = document.getElementById('boot-screen');
    if (bootScreen) {
      bootScreen.style.opacity = 0;
      setTimeout(() => {
        bootScreen.style.visibility = 'hidden';
        loadTrack(0, false);
      }, 1500);
    }
  });
}

// Resize handler
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0.25, 0);
  updateHTMLCarousel();
});

// ----------------------------------------------------
// 11. Boot Screen Particle Animators (PS2-style)
// ----------------------------------------------------
(function(){
  const bcv = document.getElementById('boot-canvas');
  const bx = bcv.getContext('2d');
  
  function size() {
    bcv.width = window.innerWidth;
    bcv.height = window.innerHeight;
  }
  size();
  window.addEventListener('resize', size);
  
  const particles = [];
  for (let i = 0; i < 150; i++) {
    particles.push({
      a: Math.random() * Math.PI * 2,
      r: 15 + Math.random() * 200,
      s: 0.15 + Math.random() * 0.85,
      y: Math.random() * 800,
      vy: 0.5 + Math.random() * 1.5,
      hue: 190 + Math.random() * 50 // Cyan to Purple
    });
  }
  
  let active = true;
  function anim() {
    if (!active) return;
    const w = bcv.width, h = bcv.height;
    bx.fillStyle = 'rgba(2, 2, 8, 0.18)';
    bx.fillRect(0, 0, w, h);
    
    const cx = w / 2, cy = h / 2;
    
    // Central energy beam
    const grad = bx.createLinearGradient(cx, cy - 250, cx, cy + 250);
    grad.addColorStop(0, 'rgba(189, 43, 218, 0)');
    grad.addColorStop(0.5, 'rgba(0, 240, 255, 0.35)');
    grad.addColorStop(1, 'rgba(189, 43, 218, 0)');
    bx.fillStyle = grad;
    bx.fillRect(cx - 2, cy - 250, 4, 500);
    
    // Orbiting particles
    bx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.y -= p.vy;
      p.a += 0.008 * p.s;
      
      if (p.y < -300) {
        p.y = 400 + Math.random() * 200;
        p.r = 15 + Math.random() * 200;
      }
      
      const px = cx + Math.cos(p.a) * p.r;
      const py = cy + p.y;
      
      bx.fillStyle = `hsla(${p.hue}, 100%, 75%, 0.9)`;
      bx.beginPath();
      bx.arc(px, py, p.s * 2, 0, Math.PI * 2);
      bx.fill();
    }
    bx.globalCompositeOperation = 'source-over';
    
    requestAnimationFrame(anim);
  }
  anim();
  
  window.restartBootAnimation = function() {
    if (!active) {
      active = true;
      anim();
    }
  };
  
  document.getElementById('press-start-btn').addEventListener('click', () => {
    active = false;
  });
})();

// ----------------------------------------------------
// 12. Main Rendering Loop (Animation & Audio Reactivity)
// ----------------------------------------------------
const clock = new THREE.Clock();
let pulseFactor = 0;

function tick() {
  const dt = clock.getDelta();
  const elapsedTime = clock.getElapsedTime();
  
  // A. Audio Reactivity
  let avgFreq = 0;
  let bassFreq = 0;
  if (analyser && visualizerMode !== 2) {
    analyser.getByteFrequencyData(freqData);
    const len = freqData.length;
    for (let i = 0; i < len; i++) {
      avgFreq += freqData[i];
    }
    avgFreq /= (len * 255); // Normalized average [0, 1]
    
    // Average first 6 bins for bass
    for (let i = 0; i < 6; i++) {
      bassFreq += freqData[i];
    }
    bassFreq /= (6 * 255); // Normalized bass [0, 1]
    
    // Update visualizer bars (subtle, clean steel-blue to white blend)
    const baseColor = new THREE.Color(0x56c2e6);
    const waveColor = new THREE.Color(0xffffff);
    const visualizerHeight = visualizerMode === 1 ? 3.6 : 1.8;
    for (let i = 0; i < VIZ_COUNT; i++) {
      const bin = Math.floor((i / VIZ_COUNT) * (len * 0.75));
      const val = freqData[bin] / 255;
      const scaleY = 0.05 + val * visualizerHeight; // shorter, cleaner visualizer
      
      vizBars[i].scale.y = vizBars[i].scale.y * 0.55 + scaleY * 0.45;
      vizBars[i].position.y = -2.2 + vizBars[i].scale.y * 0.5;
      vizBars[i].material.color.copy(baseColor).lerp(waveColor, val * 0.6);
      vizBars[i].material.opacity = 0.3 + val * 0.5;
    }
  } else if (visualizerMode !== 2) {
    // Fallback synthetic wave animation
    const baseColor = new THREE.Color(0x56c2e6);
    const waveColor = new THREE.Color(0xffffff);
    for (let i = 0; i < VIZ_COUNT; i++) {
      const val = 0.05 + Math.abs(Math.sin(elapsedTime * 1.2 + i * 0.4)) * 0.6;
      vizBars[i].scale.y = val;
      vizBars[i].position.y = -2.2 + val * 0.5;
      vizBars[i].material.color.copy(baseColor).lerp(waveColor, val * 0.4);
      vizBars[i].material.opacity = 0.3 + val * 0.3;
    }
  } else {
    // Muted mode
    for (let i = 0; i < VIZ_COUNT; i++) {
      vizBars[i].scale.y = 0.001;
      vizBars[i].position.y = -2.2;
    }
  }
  
  pulseFactor = pulseFactor * 0.85 + bassFreq * 0.15;
  
  // B. Smooth Case Opening Animation
  openPercent += (targetOpenPercent - openPercent) * 5 * dt;
  
  // Swing cover lid around hinge pivot
  frontHinge.rotation.y = openPercent * (-Math.PI * 0.7);
  
  // C. CD Lift & Spin Animation
  if (openPercent > 0.1) {
    const lift = (openPercent - 0.1) / 0.9; // Normalised lift value [0, 1]
    
    // Lift out of tray, float upward in Y and forward in Z
    cdGroup.position.z = lift * 2.1;
    cdGroup.position.y = lift * 0.55 + Math.sin(elapsedTime * 1.5) * 0.05 + pulseFactor * 0.15;
    
    // Rotate to face camera (smoothly transition rotation.x from 0 to -0.5)
    cdGroup.rotation.x = -lift * 0.5;
    cdGroup.rotation.y = lift * 0.1;
    
    // CD Spin (faster when bass pulses, spins entire assembly around local Z)
    const spinSpeed = (isPlaying) ? (2.2 + bassFreq * 3.5) : 0.4;
    cdSpinGroup.rotation.z += dt * spinSpeed;
  } else {
    // Lock back inside tray when closed
    cdGroup.position.set(0, 0, 0);
    cdGroup.rotation.set(0, 0, 0);
    cdSpinGroup.rotation.z = 0;
  }
  
  // D. Environment animations
  // Slow idle bobbing and rotation with damping
  currentRotationX += (targetRotationX - currentRotationX) * 5 * dt;
  currentRotationY += (targetRotationY - currentRotationY) * 5 * dt;
  
  if (targetOpenPercent === 0) {
    jewelCaseGroup.position.y = 0.25 + Math.sin(elapsedTime * 0.8) * 0.02;
    const rotationOffset = autoRotateCase ? Math.sin(elapsedTime * 0.4) * 0.08 : 0;
    jewelCaseGroup.rotation.x = currentRotationX;
    jewelCaseGroup.rotation.y = currentRotationY + rotationOffset;
  } else {
    // Keep facing forward when open, slightly adjust orientation
    jewelCaseGroup.position.y = 0.25 + Math.sin(elapsedTime * 0.8) * 0.01;
    const rotationOffset = autoRotateCase ? Math.sin(elapsedTime * 0.8) * 0.03 : 0;
    jewelCaseGroup.rotation.x = currentRotationX * (1 - openPercent) + openPercent * 0.15;
    jewelCaseGroup.rotation.y = (currentRotationY * (1 - openPercent) + openPercent * 0.1) + rotationOffset;
  }
  
  // Rotate background toruses
  wireframes.forEach((tf, index) => {
    tf.rotation.x += dt * 0.12 * (index === 0 ? 1 : -1);
    tf.rotation.y += dt * 0.08;
  });
  
  // Orbit point lights for dynamic reflections
  blueRimLight.position.x = Math.cos(elapsedTime * 0.6) * 6;
  blueRimLight.position.z = Math.sin(elapsedTime * 0.6) * 6;
  blueRimLight.intensity = 1.8 + bassFreq * 2.0;
  
  purpleRimLight.position.x = Math.cos(elapsedTime * 0.4 + 3) * 6;
  purpleRimLight.position.z = Math.sin(elapsedTime * 0.4 + 3) * 6;
  purpleRimLight.intensity = 1.8 + avgFreq * 1.5;
  
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// Start WebGL render loop
tick();

})();
