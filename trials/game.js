import * as THREE from 'three/webgpu';
import {MAZE_WALLS,mazeMove,overlap} from './rules.js';
const $=id=>document.getElementById(id),menu=$('trial-menu'),pause=$('trial-pause');
const params=new URLSearchParams(location.search),assigned=params.get('rift'),token=params.get('token');
const embedded=window.parent!==window&&['maze','runner','zephyr'].includes(assigned)&&!!token;
if(!embedded)location.replace('survival.html');
const descriptors={maze:['THE MAZE','Reach the green rift.','WASD / arrows to steer.'],runner:['THE RUNNER','Jump the broken ground.','Space / tap to jump. Clear six obstacles.'],zephyr:['ZEPHYR','Keep the wisp in the passage.','Space / tap to flap. Pass five gates.']};
let renderer,camera,scene,arena,body,goal,ready=false,phase='menu',mode='maze',elapsed=0,trialTime=0,last=0,uiTime=0,paused=false,practice=false,cleared=0,lives=3;
let p={x:0,y:0,vy:0},obstacles=[],gates=[],audio,won=false;
const notify=type=>parent.postMessage({type,trial:assigned,token},location.origin);
const keys=new Set(),meshes=[],materials={
 stone:new THREE.MeshStandardMaterial({color:0x57736d,roughness:.88}),floor:new THREE.MeshStandardMaterial({color:0x203b41,roughness:.8,metalness:.2}),
 bronze:new THREE.MeshStandardMaterial({color:0x9a7751,roughness:.65,metalness:.6}),ink:new THREE.MeshStandardMaterial({color:0x252c43,roughness:.4,metalness:.4}),
 player:new THREE.MeshStandardMaterial({color:0xdae9c5,roughness:.3,metalness:.25,emissive:0x78916a,emissiveIntensity:.3}),rift:new THREE.MeshStandardMaterial({color:0xa1efd0,emissive:0x4bb88d,emissiveIntensity:1.3,roughness:.5}),
 hazard:new THREE.MeshStandardMaterial({color:0xb06d56,roughness:.65,metalness:.3}),line:new THREE.MeshBasicMaterial({color:0x507476}),
};
function mesh(geometry,material,x,y,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);arena.add(m);meshes.push(m);return m;}
const box=(x,y,w,h,material,z=0,depth=.55)=>mesh(new THREE.BoxGeometry(w,h,depth),material,x,y,z);
function clearArena(){for(const m of meshes){arena.remove(m);m.geometry.dispose();}meshes.length=0;obstacles=[];gates=[];}
function tone(win){try{audio??=new AudioContext();audio.resume();const osc=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;osc.type='sine';osc.frequency.setValueAtTime(win?380:150,t);osc.frequency.exponentialRampToValueAtTime(win?760:80,t+.2);g.gain.setValueAtTime(.04,t);g.gain.exponentialRampToValueAtTime(.001,t+.25);osc.connect(g);g.connect(audio.destination);osc.start();osc.stop(t+.26);}catch{}}
function setPaused(value){paused=value;keys.clear();document.body.dataset.paused=String(value);if(audio){if(value)audio.suspend();else audio.resume();}}
function setup(next){
 mode=next;document.body.dataset.mode=mode;phase='brief';elapsed=0;trialTime=0;keys.clear();clearArena();
 if(mode==='maze'){
  box(0,0,18.6,10.2,materials.floor,-.7,.6);
  for(let x=-8;x<=8;x+=2)box(x,0,.014,9.4,materials.line,-.38,.015);
  for(let y=-4;y<=4;y+=2)box(0,y,17.5,.014,materials.line,-.38,.015);
 }
 const radius=mode==='zephyr'?.25:.28;body=mesh(new THREE.IcosahedronGeometry(radius,2),materials.player,0,0,.4);
 if(mode==='maze'){
   p={x:-7.5,y:-3.6,vy:0};for(const w of MAZE_WALLS)box(w.x,w.y,w.w,w.h,materials.stone,.1,.9);
   for(const x of [-9,9])box(x,0,.3,10,materials.bronze);for(const y of [-5,5])box(0,y,18,.3,materials.bronze);
   goal=mesh(new THREE.TorusGeometry(.6,.09,8,36),materials.rift,7.4,3.5,.25);
 }else if(mode==='runner'){
   p={x:-5.5,y:-3.5,vy:0};box(0,-4.05,18,.5,materials.ink);for(let x=-9;x<9;x+=1.5){box(x,-4.36,1.45,.12,materials.bronze,-.05);box(x,-3.78,.8,.018,materials.rift,.15,.02);}goal=mesh(new THREE.TorusGeometry(.8,.1,8,36),materials.rift,42,-2.8,.3);
   for(let i=0;i<6;i++){const o={x:4.5+i*4.8,y:-3.36,w:.55,h:.78};o.mesh=mesh(new THREE.ConeGeometry(.38,.78,4),materials.hazard,o.x,o.y,.35);obstacles.push(o);}
 }else{
   p={x:-5.5,y:0,vy:0};goal=null;
   const centers=[-.7,.6,-.5,.7,0];for(let i=0;i<5;i++){
     const gate={x:5+i*5.3,center:centers[i],gap:4.5,passed:false,meshes:[]};
     for(const side of [-1,1]){const edge=gate.center+side*gate.gap/2,extent=5-Math.abs(edge),y=edge+side*extent/2;gate.meshes.push(box(gate.x,y,.65,extent,materials.ink,.15,.9));gate.meshes.push(box(gate.x,edge,.8,.1,materials.bronze,.3));}gates.push(gate);
   }
 }
 body.position.set(p.x,p.y,.4);const [title,task,controls]=descriptors[mode];$('task-title').textContent=title;$('task-kicker').textContent=task.toUpperCase();$('task-controls').textContent=controls;$('flash').textContent=task;
 $('trial-pad').style.visibility=mode==='maze'?'visible':'hidden';$('trial-action').style.visibility=mode==='maze'?'hidden':'visible';$('trial-action').textContent=mode==='runner'?'JUMP':'FLAP';updateUI();
}
function outcome(success){
 if(phase!=='play')return;phase='result';elapsed=0;keys.clear();tone(success);
 won=success;
 $('flash').textContent=success?'RIFT CLEARED':'PASSAGE LOST';updateUI();
}
function action(){if(paused||phase!=='play')return;if(mode==='runner'&&p.y<=-3.49)p.vy=7.7;if(mode==='zephyr')p.vy=4.2;}
function updateUI(){$('run-stats').textContent='CLEAR THIS PASSAGE';$('timer').textContent=phase==='play'?Math.ceil((mode==='maze'?25:15)-trialTime):'—';}
function step(dt){
 if(paused||phase==='menu'||phase==='complete')return;elapsed+=dt;
 if(phase==='brief'){if(elapsed>=1.8){phase='play';elapsed=0;$('flash').textContent='';updateUI();}return;}
 if(phase==='result'){if(elapsed>=1.5){if(won){phase='complete';notify('rift-cleared');}else{setup(assigned);$('flash').textContent='Try again. '+descriptors[assigned][1];}}return;}
 trialTime+=dt;
 if(mode==='maze'){
   let dx=Number(keys.has('right'))-Number(keys.has('left')),dy=Number(keys.has('up'))-Number(keys.has('down')),length=Math.hypot(dx,dy)||1;mazeMove(p,dx/length*4.5*dt,dy/length*4.5*dt);
   if(Math.hypot(p.x-7.4,p.y-3.5)<.65)outcome(true);
 }else if(mode==='runner'){
   p.vy-=18*dt;p.y=Math.max(-3.5,p.y+p.vy*dt);if(p.y===-3.5)p.vy=0;
   for(const o of obstacles){o.x-=4.5*dt;o.mesh.position.x=o.x;if(overlap(p,o))outcome(false);}
   goal.position.x-=4.5*dt;if(goal.position.x<p.x+.3)outcome(true);
 }else{
   p.vy=Math.max(-5,p.vy-6.8*dt);p.y+=p.vy*dt;
   if(Math.abs(p.y)>4.65)outcome(false);
   for(const g of gates){g.x-=3.5*dt;for(const m of g.meshes)m.position.x=g.x;
     if(Math.abs(g.x-p.x)<.62&&Math.abs(p.y-g.center)>g.gap/2-.27)outcome(false);
     if(g.x<p.x-.65)g.passed=true;
   }
   if(gates.every(g=>g.passed))outcome(true);
 }
 body.position.set(p.x,p.y,.4);body.rotation.z+=dt*1.4;
 if(phase==='play'&&trialTime>=(mode==='maze'?25:15))outcome(false);
}
function openPause(){if(phase==='menu'||paused)return;setPaused(true);pause.showModal();}
function resume(){pause.close();setPaused(false);}
$('pause-trials').onclick=openPause;$('resume-trials').onclick=resume;$('end-trials').onclick=()=>notify('rift-retreat');pause.addEventListener('cancel',e=>{e.preventDefault();resume();});menu.addEventListener('cancel',e=>e.preventDefault());
const direction={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
document.addEventListener('keydown',e=>{if(e.code==='Escape'){e.preventDefault();if(!paused)openPause();return;}if(direction[e.code]||e.code==='Space')e.preventDefault();if(paused||phase==='menu'||phase==='complete')return;if(direction[e.code])keys.add(direction[e.code]);if(!e.repeat&&(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'))action();});
document.addEventListener('keyup',e=>{if(direction[e.code])keys.delete(direction[e.code]);});
for(const b of document.querySelectorAll('[data-direction]')){b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.direction);};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.direction);}
$('trial-action').onpointerdown=e=>{e.preventDefault();action();};$('trial-world').onpointerdown=()=>action();
window.addEventListener('blur',()=>{keys.clear();openPause();});document.addEventListener('visibilitychange',()=>{if(document.hidden)openPause();});
function resize(){const aspect=innerWidth/innerHeight,halfX=Math.max(10.5,7*aspect);camera.left=-halfX;camera.right=halfX;camera.top=halfX/aspect;camera.bottom=-halfX/aspect;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);}
window.addEventListener('resize',()=>{if(renderer&&camera)resize();});
async function boot(){
 if(!embedded)return;menu.showModal();renderer=new THREE.WebGPURenderer({canvas:$('trial-world'),alpha:true,antialias:true,powerPreference:'high-performance'});await renderer.init();renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
 scene=new THREE.Scene();scene.background=null;scene.add(new THREE.HemisphereLight(0xd5ece6,0x20343b,2.2));const sun=new THREE.DirectionalLight(0xffe1ba,3);sun.position.set(-4,6,12);scene.add(sun);
 camera=new THREE.OrthographicCamera(-12,12,7,-7,.1,100);camera.position.set(0,0,24);arena=new THREE.Group();arena.position.y=-.7;arena.rotation.x=.12;scene.add(arena);setup('maze');phase='menu';$('flash').textContent='';resize();await renderer.compileAsync(scene,camera);ready=true;menu.close();setup(assigned);
 renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-last)/1000||0);last=now;step(dt);uiTime+=dt;if(uiTime>.1){updateUI();uiTime=0;}renderer.render(scene,camera);});
 renderer.onDeviceLost=()=>{openPause();$('trial-error').hidden=false;$('trial-error').textContent='The graphics device was interrupted. Retreat to the island, then enter the rift again.';};
}
boot().catch(e=>{console.error(e);menu.close();$('trial-error').hidden=false;$('trial-error').textContent='A graphics resource could not load. Try a current browser with hardware acceleration.';});

