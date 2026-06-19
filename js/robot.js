/* ════════════════════════════════════════════════════════════
   AXIOMORT robot — the rigged courier from the music videos.
   UAL2_Standard.glb: full UE-mannequin skeleton + 43 mocap clips.
   ES module — shares the page's three / three/addons import map.

   import { createRobot } from './robot.js';
   const bot = await createRobot(THREE, scene, { x,y,z, height:2.4, rotY:0 });
   bot.play('wave');           // friendly-named clip, crossfaded
   bot.playOnce('yes', 'idle');// one-shot then return to idle
   bot.update(dt);             // call every frame
════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

let _gltf = null, _loading = null;

// player skins — body (M_Main) + joint/accent (M_Joints). Index 0 is the gold courier.
export const SKINS = [
  { name: 'Gold',    body: 0xeae6dc, joint: 0xd4af37 },
  { name: 'Magenta', body: 0x16161c, joint: 0xff2bd6 },
  { name: 'Cyan',    body: 0xe8edf6, joint: 0x00e0ff },
  { name: 'Lime',    body: 0x202028, joint: 0xb6ff3c },
  { name: 'Coral',   body: 0xf2e8da, joint: 0xff5e7a },
  { name: 'Azure',   body: 0x12203a, joint: 0x6c9bff },
  { name: 'Amber',   body: 0x2a1d12, joint: 0xffc24a },
  { name: 'Violet',  body: 0xdfe2ea, joint: 0x9d6cff }
];

export function preloadRobot() {
  if (_gltf) return Promise.resolve(_gltf);
  if (_loading) return _loading;
  _loading = new Promise((res, rej) => {
    new GLTFLoader().load('assets/models/robot.glb', (g) => { _gltf = g; res(g); }, undefined, rej);
  });
  return _loading;
}

// friendly name → actual clip in the UAL2 library
const CLIP = {
  idle:  'Idle_FoldArms_Loop',
  chill: 'Idle_TalkingPhone_Loop',
  look:  'Idle_Rail_Loop',
  wave:  'Idle_Rail_Call',     // hail / present gesture
  yes:   'Yes',                 // excited nod
  walk:  'Walk_Carry_Loop',
  jumpUp:'NinjaJump_Start',
  air:   'NinjaJump_Idle_Loop',
  land:  'NinjaJump_Land',
  dance: 'Sword_Regular_Combo', // dynamic flourish, reads as a dance beat
  open:  'Chest_Open',
  punch: 'Melee_Hook',
  kick:  'Sword_Regular_A'
};

export async function createRobot(THREElib, scene, opts = {}) {
  const T = THREElib || THREE;
  const gltf = await preloadRobot();

  const skin = (typeof opts.skin === 'number') ? SKINS[((opts.skin % SKINS.length) + SKINS.length) % SKINS.length]
             : (opts.skin && opts.skin.body != null) ? opts.skin : SKINS[0];
  const model = cloneSkeleton(gltf.scene);
  model.traverse((o) => {
    o.frustumCulled = false;
    if (o.isMesh) {
      o.castShadow = !!opts.shadow;
      // clone materials per-instance so each robot can wear its own skin
      o.material = Array.isArray(o.material) ? o.material.map((m) => m && m.clone()) : (o.material && o.material.clone());
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m) return;
        if (m.name === 'M_Main') { m.color.set(skin.body); m.metalness = 0.32; m.roughness = 0.46; }
        else if (m.name === 'M_Joints') { m.color.set(skin.joint); m.metalness = 1.0; m.roughness = 0.3; m.emissive = new T.Color(skin.joint); m.emissiveIntensity = 0.16; }
      });
    }
  });

  const mixer = new T.AnimationMixer(model);
  mixer.update(0); // Force bone matrices to calculate their true world positions
  model.updateMatrixWorld(true);

  const box = new T.Box3().setFromObject(model);
  let sizeY = box.getSize(new T.Vector3()).y;
  if (sizeY < 0.1) sizeY = 1.8;
  const h = opts.height || 2.4;
  
  // Dynamically scale the model from its true current world size to the target height
  model.scale.multiplyScalar(h / sizeY);
  
  model.updateMatrixWorld(true);
  mixer.update(0); // Refresh bones to the new scale

  const box2 = new T.Box3().setFromObject(model);
  const c = box2.getCenter(new T.Vector3());
  const wrap = new T.Group();
  model.position.x -= c.x; model.position.z -= c.z; model.position.y -= box2.min.y;
  wrap.add(model);
  wrap.position.set(opts.x || 0, opts.y || 0, opts.z || 0);
  wrap.rotation.y = opts.rotY || 0;
  scene.add(wrap);

  const byName = {}; gltf.animations.forEach((cl) => { byName[cl.name] = cl; });
  const get = (key) => byName[CLIP[key] || key];

  let current = null, currentKey = null, queued = null;
  function play(key, { fade = 0.35 } = {}) {
    const clip = get(key); if (!clip) return;
    if (currentKey === key) return;
    const act = mixer.clipAction(clip);
    act.reset(); act.setLoop(T.LoopRepeat, Infinity); act.clampWhenFinished = false;
    act.enabled = true; act.setEffectiveWeight(1); act.fadeIn(fade); act.play();
    if (current && current !== act) current.fadeOut(fade);
    current = act; currentKey = key;
  }
  function playOnce(key, thenKey = 'idle', { fade = 0.2 } = {}) {
    const clip = get(key); if (!clip) { play(thenKey); return; }
    const act = mixer.clipAction(clip);
    act.reset(); act.setLoop(T.LoopOnce, 1); act.clampWhenFinished = true;
    act.enabled = true; act.setEffectiveWeight(1); act.fadeIn(fade); act.play();
    if (current && current !== act) current.fadeOut(fade);
    current = act; currentKey = '__once';
    queued = thenKey;
    const onFin = (e) => { if (e.action === act) { mixer.removeEventListener('finished', onFin); play(queued, { fade: 0.3 }); } };
    mixer.addEventListener('finished', onFin);
  }

  play('idle', { fade: 0 });

  return {
    group: wrap,
    model,
    clips: gltf.animations.map((c) => c.name),
    play,
    playOnce,
    update: (dt) => mixer.update(dt),
    setPosition: (x, y, z) => wrap.position.set(x, y, z),
    faceTo: (x, z) => { wrap.rotation.y = Math.atan2(x - wrap.position.x, z - wrap.position.z); },
    getCurrentKey: () => currentKey,
    setSkin: (skinIndex) => {
      const newSkin = (typeof skinIndex === 'number') ? SKINS[((skinIndex % SKINS.length) + SKINS.length) % SKINS.length]
                    : (skinIndex && skinIndex.body != null) ? skinIndex : SKINS[0];
      model.traverse((o) => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if (!m) return;
            if (m.name === 'M_Main') { m.color.set(newSkin.body); }
            else if (m.name === 'M_Joints') { m.color.set(newSkin.joint); m.emissive.set(newSkin.joint); }
          });
        }
      });
    }
  };
}
