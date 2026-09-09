import {encounterRift,clearRift} from './rifts.js';
import {MEALS,prepareMeal,tickPreparation,preparedEnergyRate,preparedExposureRate} from './preparation.js';
import {WRECKS,recoverEquipment,equipAtBench,returnEquipment,exposureRate,trackedWreck} from './expedition.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {FIELD_DEVICE,MEMORY,readDevice,recoverRecord,returnRecord,neededResources} from './chapter.js';
import {createSound} from './sound.js';
import * as THREE from 'three/webgpu';
import {DAY_SECONDS,dayPeriod,solarElevation,SAVE_KEY,ITEMS,RECIPES,WATCH_COST,NODES,ISLANDS,freshState,terrain,regionAt,affordable,canCraft,craftTool,placeBuilding,dismantle,available,harvest,repairWatch,eat,harvestGarden,hasBuilding,objective,loadSave,saveState,validateState} from './state.js';
import {createWorld,makeBuilding,makeAxe,playerCollides,placementCheck} from './world.js';

import {constructionPose,floorHeight,underRoof,ceilingHeight} from './construction.js';
import {createMotion,resetMotion,movePlayer} from './controller.js';
const sound=createSound();let transitioning=false,riftSession=null;
let orbitTime=0,arrivalTime=null,arrivalPosition=null,arrivalRotation=null;
const reducedMotion=()=>!state.settings.motion||matchMedia('(prefers-reduced-motion: reduce)').matches;
const motion=createMotion(),raycaster=new THREE.Raycaster(),reachRaycaster=new THREE.Raycaster();
const $=id=>document.getElementById(id),canvas=$('world'),panel=$('panel'),start=$('start');
const touch=matchMedia('(pointer:coarse)').matches;document.body.dataset.touch=String(touch);$('touch-controls').hidden=!touch;
let state,saveProblem='',saveBlocked=false;
try{const loaded=loadSave(localStorage);state=loaded.state;if(loaded.recovered)saveProblem='Recovered your last good checkpoint. Your most recent changes may be missing.';}catch(e){state=freshState();saveProblem='Your previous save could not be read. Download it from Pause before starting a new save.';saveBlocked=true;}
let world,renderer,camera,axe,started=false,paused=true,activePanel='',target=null,ghost=null,buildKind=null,buildRotation=0,buildPosition=null,placementError=null;
let y=0,vy=0,onGround=true,last=0,uiClock=0,saveClock=0,toastTimer,audio,drag=null,lastUse=-10,swing=0;
const keys=new Set(),direction=new THREE.Vector3(),colors={wood:'#bfa079',stone:'#a2b2b0',fiber:'#a6c487',scrap:'#c7a37d',crystal:'#94e0bc',berries:'#d68f7c'};
start.showModal();document.body.dataset.paused='true';document.body.dataset.intro='true';
const showToast=(message)=>{if(panel.open)$('panel-status').textContent=message;$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3400);};
function tone(kind='gather'){
  try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();if(!state.settings.sound)return;const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type=kind==='gather'?'triangle':'sine';const t=audio.currentTime;oscillator.frequency.setValueAtTime(kind==='build'?330:kind==='travel'?160:kind==='error'?110:540,t);oscillator.frequency.exponentialRampToValueAtTime(kind==='travel'?600:kind==='build'?660:230,t+.18);gain.gain.setValueAtTime(state.settings.sound*.12,t);gain.gain.exponentialRampToValueAtTime(.001,t+.25);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(t+.3);}catch{/* Sound is optional; gameplay is independent. */}
}
function save(){if(saveBlocked){$('save-label').textContent='Save recovery needed';return false;}try{saveState(state,localStorage);$('save-label').textContent='Saved on this device';return true;}catch{$('save-label').textContent='Storage unavailable — export your save';return false;}}
function captureMouse(){if(touch||paused||panel.open||document.pointerLockElement)return;try{const p=canvas.requestPointerLock?.();p?.catch(()=>showToast('Drag across the world to look around.'));}catch{showToast('Drag across the world to look around.');}}
function setPaused(value){paused=value;sound.setPaused(value);keys.clear();resetMotion(motion);drag=null;document.body.dataset.paused=String(value);if(value&&document.pointerLockElement)document.exitPointerLock();}
function costMarkup(cost){return Object.entries(cost).map(([k,n])=>`<span class="${state.inventory[k]<n?'missing':''}">${state.inventory[k]} / ${n} ${ITEMS[k]}</span>`).join('');}
function renderCraft(){
  $('panel-title').textContent='Make a place here.';$('panel-kicker').textContent='FIELD WORKSHOP';
  $('panel-body').innerHTML=`<div class="recipe-grid">${Object.entries(RECIPES).map(([kind,r])=>`<article class="recipe"><h3>${r.name}</h3><p>${r.description}</p><div class="cost">${costMarkup(r.cost)}</div>${r.requires&&!hasBuilding(state,r.requires)?'<div class="needs">Build a workbench first</div>':''}<button data-recipe="${kind}" ${canCraft(state,kind)?'':'disabled'}>${r.kind==='tool'?(state.tools.includes(kind)?'Crafted':'Craft tool'):'Choose placement'}</button></article>`).join('')}</div><p class="muted">Gather with E. Aim at a piece and press R for a full refund. Remove walls and roofs before their foundation. Progress saves on this device.</p>`;
  renderEquipment();
  document.querySelectorAll('[data-recipe]').forEach(b=>b.onclick=()=>{const kind=b.dataset.recipe;if(RECIPES[kind].kind==='tool'){if(craftTool(state,kind)){tone('build');showToast('Field axe crafted. Resource yields doubled.');save();renderCraft();refreshUI();}}else startBuild(kind);});
}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function renderPause(){
  $('panel-title').textContent='Take a breath.';$('panel-kicker').textContent='THE FIRST REFUGE / PAUSED';
  $('panel-body').innerHTML=`<div class="settings"><button class="primary" id="resume">Resume your journey</button><p>WASD / arrows move · mouse looks · Space jumps · Shift sprints · E gathers or uses · B crafts · F eats · R dismantles nearby buildings.</p><label>Look sensitivity<input id="sensitivity" type="range" min=".25" max="2" step=".05" value="${state.settings.sensitivity}"></label><label>Sound effects<input id="volume" type="range" min="0" max="1" step=".05" value="${state.settings.sound}"></label><label>Camera movement<input id="motion" type="checkbox" ${state.settings.motion?'checked':''}></label><label>Visual quality<select id="quality"><option value="performance">Performance</option><option value="balanced">Balanced</option><option value="high">High</option></select></label><p class="muted">Quality changes resolution immediately. Shadow detail applies after reloading. The game pauses while this menu is open or the tab is hidden.</p><div class="settings-actions"><button id="return-home">Return to refuge</button><button id="export">Export save</button><button id="import">Import save</button><a href="index.html">AXIOMORT menu</a></div><input type="file" id="save-file" accept=".json,application/json" hidden>${saveBlocked?'<p>Your previous save could not be read. Export the original before replacing it.</p><button id="export-raw">Download original save</button><button id="replace-save">Replace with this new journey</button>':''}</div>`;
  $('resume').onclick=()=>{closePanel();};$('quality').value=state.settings.quality;
  $('sensitivity').oninput=e=>{state.settings.sensitivity=Number(e.target.value);save();};$('volume').oninput=e=>{state.settings.sound=Number(e.target.value);sound.setVolume(state.settings.sound);save();};$('motion').onchange=e=>{state.settings.motion=e.target.checked;save();};$('quality').onchange=e=>{state.settings.quality=e.target.value;setResolution();save();};
  $('return-home').onclick=()=>{returnHome();closePanel();showToast('Back at your refuge. Your pack is safe.');save();};
  $('export').onclick=()=>download(JSON.stringify(state,null,2),'axiomort-island-save.json');$('import').onclick=()=>$('save-file').click();
  $('save-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>500000)throw new Error('Choose an Island save smaller than 500 KB.');const next=validateState(JSON.parse(await file.text()));
    if(!confirm('Replace this Island journey with the selected save? Export your current save first if you want to keep it.'))return;
    saveState(next,localStorage);state=next;saveBlocked=false;location.reload();
  }catch(error){showToast(error.message);}};
  if(saveBlocked){$('export-raw').onclick=()=>{try{download(localStorage.getItem(SAVE_KEY)||'', 'axiomort-original-save.json');}catch{showToast('Browser storage is unavailable.');}};$('replace-save').onclick=()=>{if(confirm('Replace the unreadable save with this journey?')){saveBlocked=false;save();renderPause();}};}
}
function renderJournal(){
  $('panel-title').textContent='Your field notes.';$('panel-kicker').textContent='RECOVERED FIELD NOTES';
  $('panel-body').innerHTML=`<div class="journal"><h3>Your first foothold</h3><p>Find timber, stone and fibre around the coast. An axe makes gathering faster. A shelter gives you somewhere to return. With a workbench, salvage and rift crystals, you can build a stability anchor.</p><h3>Build your own refuge</h3><p>Timber foundations make walkable floors and snap beside one another. Aim towards a foundation to attach a wall, open doorway or canopy roof. Q chooses the wall edge. A canopy restores warmth underneath and counts as your first home. Remove attached pieces before dismantling their foundation; every piece refunds its materials.</p><h3>The VPS watch</h3><p>A portal device can still connect the fragments. Once an anchor is built, take four pieces of salvage and two rift crystals to the old rift. Use E to repair the watch, then E again to enter. An unknown trial waits inside. Clear it once and this passage stays open in both directions. Retreating or failing does not take your belongings.</p><h3>Living here</h3><p>Eat berries with F to restore energy. Shelter and fire restore warmth. A planter produces four berries every 45 seconds of active play. Use your campfire to turn two berries and one timber into a trail meal (four minutes of reduced energy use) or warming broth (two minutes of reduced exposure). A new meal replaces the previous preparation; recovered equipment still works alongside it. Scavenging spots replenish after a minute. If exposure overwhelms you, you return safely with your belongings.</p></div>`;
  if(state.chapter.complete)renderRoutes();
  if(state.chapter.recovered){const button=document.createElement('button');button.textContent='Listen to recovered Ink of Infinity';button.onclick=()=>{sound.setPaused(false);sound.music();button.textContent='Playing · Ink of Infinity';};$('panel-body').append(button);}
}
function showCampfire(fire){
  openPanel('journal');$('panel-title').textContent='Before you head out.';$('panel-kicker').textContent='BY THE FIRE';
  const current=MEALS[state.preparation.meal];
  $('panel-body').innerHTML=`<div class="journal"><p>Your garden can keep this fire supplied. Choose a meal for the trip you have in mind.</p>${current?`<p class="preparation-current">${current.name} · ${Math.ceil(state.preparation.remaining/60)} min remaining. A new meal replaces this effect.</p>`:''}<div class="recipe-grid">${Object.entries(MEALS).map(([kind,m])=>`<article class="recipe"><h3>${m.name}</h3><p>${m.description}</p><div class="cost">${costMarkup(m.cost)}</div><button data-meal="${kind}" ${affordable(state,m.cost)?'':'disabled'}>Cook and eat</button></article>`).join('')}</div><p class="muted">Preparation lasts during active play. Menus and time away do not use it up. You can always explore without a meal.</p><button class="primary" id="leave-fire">Back to the refuge</button></div>`;
  document.querySelectorAll('[data-meal]').forEach(b=>b.onclick=()=>{if(prepareMeal(state,b.dataset.meal,fire)){save();refreshUI();closePanel();tone('build');showToast(MEALS[b.dataset.meal].name+' prepared. You are ready to head out.');}});$('leave-fire').onclick=closePanel;
}
function renderRoutes(){
  const section=document.createElement('section');section.className='expedition-routes';
  section.innerHTML=`<p class="eyebrow">THE NEXT EXPEDITION</p><h3>What does your refuge need?</h3><p>Two wrecks survived on the Reach. Both stay available. Recovered equipment works immediately; change your loadout at a workbench.</p><div class="recipe-grid">${WRECKS.map(w=>`<article class="recipe"><p class="eyebrow">${w.direction}</p><h3>${w.title}</h3><p>${w.description}</p><button data-route="${w.id}" ${state.expedition.recovered.includes(w.id)?'disabled':''}>${state.expedition.recovered.includes(w.id)?'Recovered':state.expedition.tracked===w.id?'Following this route':'Follow this route'}</button></article>`).join('')}</div>`;
  $('panel-body').append(section);section.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>{state.expedition.tracked=b.dataset.route;save();refreshUI();closePanel();showToast('Route marked. Both wrecks remain available.');});
}
function renderEquipment(){
  if(!state.expedition.recovered.length)return;
  const bench=state.buildings.find(b=>b.kind==='bench'&&Math.hypot(b.x-state.player.x,b.z-state.player.z)<=3.5);
  const section=document.createElement('section');section.className='expedition-routes';
  section.innerHTML=`<p class="eyebrow">RECOVERED EQUIPMENT</p><p>${bench?'One loadout at a time. Refit freely; you keep every recovered item.':'Visit a workbench to change your loadout.'}</p><div class="recipe-grid">${WRECKS.filter(w=>state.expedition.recovered.includes(w.id)).map(w=>`<article class="recipe"><h3>${w.title}</h3><p>${w.description}</p><button data-equip="${w.id}" ${!bench||state.expedition.equipped===w.id?'disabled':''}>${state.expedition.equipped===w.id?'Equipped':'Equip'}</button></article>`).join('')}</div>`;
  $('panel-body').prepend(section);section.querySelectorAll('[data-equip]').forEach(b=>b.onclick=()=>{if(equipAtBench(state,b.dataset.equip,bench)){save();renderCraft();showToast('Equipment changed. Your other loadout is kept.');}});
}
function showEquipment(id){
  openPanel('journal');const w=WRECKS.find(w=>w.id===id);$('panel-title').textContent=w.title;$('panel-kicker').textContent='RECOVERED AND EQUIPPED';
  $('panel-body').innerHTML=`<div class="journal chapter-note"><p>${w.description}</p><p>This is yours now. Bring it back to your shelter, or explore the other wreck. You can refit either recovered item at your workbench for free.</p><button class="primary" id="equipment-continue">Put it to use</button></div>`;$('equipment-continue').onclick=closePanel;
}
function openPanel(name){if(!started||riftSession)return;cancelBuild();activePanel=name;$('panel-status').textContent='';setPaused(true);if(name==='craft')renderCraft();else if(name==='journal')renderJournal();else renderPause();if(!panel.open)panel.showModal();}
function closePanel(){if(panel.open)panel.close();activePanel='';if(started){setPaused(false);captureMouse();}}
panel.addEventListener('cancel',e=>{e.preventDefault();closePanel();});$('close-panel').onclick=closePanel;
$('pause-button').onclick=()=>openPanel('pause');$('craft-button').onclick=()=>openPanel('craft');$('journal-button').onclick=()=>openPanel('journal');
function startBuild(kind){if(!canCraft(state,kind))return;cancelBuild();buildKind=kind;ghost=makeBuilding(kind,{ghost:true});world.scene.add(ghost);$('build-hint').hidden=false;$('build-name').textContent=RECIPES[kind].name;closePanel();showToast(RECIPES[kind].attachment?'Aim at a foundation. Q chooses an edge. E places.':'Find open ground. Nearby foundations snap together. E places.');}
function cancelBuild(){if(ghost){world.scene.remove(ghost);ghost.traverse(o=>{o.geometry?.dispose();if(o.isMesh)o.material.dispose();});}ghost=null;buildKind=null;buildPosition=null;$('build-hint').hidden=true;}
function updateGhost(){
  if(!ghost)return;const distance=RECIPES[buildKind].attachment?4:RECIPES[buildKind].radius+3,x=state.player.x-Math.sin(state.player.yaw)*distance,z=state.player.z-Math.cos(state.player.yaw)*distance;
  buildPosition=constructionPose(state,buildKind,x,z,buildRotation);placementError=placementCheck(world,state,buildKind,buildPosition.x,buildPosition.z,state.player,buildPosition);
  if(!canCraft(state,buildKind))placementError='You need more materials';ghost.position.set(buildPosition.x,buildPosition.y,buildPosition.z);ghost.rotation.y=buildPosition.rotation;
  ghost.traverse(o=>{if(o.isMesh)o.material.color.set(placementError?0xe99b7a:0xb6edb0);});$('build-status').textContent=placementError||'Clear ground — ready to build';
}
function interact(){if(paused||!started||transitioning)return;if(state.time-lastUse<.28)return;lastUse=state.time;
  if(buildKind){updateGhost();if(placementError){showToast(placementError);tone('error');return;}const b=placeBuilding(state,buildKind,buildPosition.x,buildPosition.z,buildPosition.rotation,buildPosition);if(b){world.addBuilding(b);showToast(`${RECIPES[b.kind].name} built. This place is becoming yours.`);tone('build');cancelBuild();save();refreshUI();}return;}
  // Resolve at the input event so a quick turn-and-use cannot act on an old HUD target.
  camera.rotation.set(state.player.pitch,state.player.yaw,0,'YXZ');camera.updateMatrixWorld();findTarget();
  if(!target)return;
  if(target.type==='node'){const result=harvest(state,target.data);if(result){world.nodes.get(target.data.id).visible=false;showToast(`+${result.amount} ${ITEMS[result.type]}`);tone();swing=.25;save();}}
  if(target.type==='portal'){
    if(!state.watch){if(!hasBuilding(state,'anchor'))showToast('Build a stability anchor before repairing the VPS watch.');else if(!affordable(state,WATCH_COST))showToast('Repair needs 4 VPS salvage and 2 rift crystals.');else if(repairWatch(state)){showToast('VPS watch repaired. Use the rift again to cross.');tone('travel');save();}}
    else enterRift(target.data.destination);
  }
  if(target.type==='device'){readDevice(state);save();refreshUI();showChapter('device');}
  if(target.type==='wreck'){if(recoverEquipment(state,target.data.id)){save();tone('build');showEquipment(target.data.id);}}
  if(target.type==='memory'){if(recoverRecord(state)){save();sound.effect('portal',.25);showChapter('record');}}
  if(target.type==='building'){
    const b=target.data;if(b.kind==='garden'){if(harvestGarden(state,b)){showToast('+4 Berries from your planter');tone();save();}else showToast('Growing. Come back in a little while.');}
    else if(b.kind==='fire')showCampfire(b);else if(b.kind==='bench')openPanel('craft');else if(b.kind==='shelter'||b.kind==='roof'){state.warmth=100;if(returnRecord(state,b)){save();showChapter('complete');}else if(returnEquipment(state,b)){save();openPanel('journal');$('panel-title').textContent='A better way to survive.';$('panel-kicker').textContent='EQUIPMENT EXPEDITION COMPLETE';showToast('Equipment brought home. Refit at your workbench.');}else{showToast('A moment of shelter. Warmth restored.');save();}}
    else showToast(b.kind==='anchor'?'This anchor keeps a little piece of reality steady.':RECIPES[b.kind].modular?'Aim at a piece and use R to dismantle it. Remove walls and roofs before their foundation.':'Stay close to restore warmth.');
  }refreshUI();
}

function showChapter(kind){
  openPanel('journal');
  const complete=kind==='complete',record=kind==='record';
  $('panel-title').textContent=complete?'A home between worlds.':record?'Something worth bringing back.':'A world under glass.';
  $('panel-kicker').textContent=complete?'FIRST EXPEDITION COMPLETE':record?'RECOVERED FIELD RECORD':'THE FIRST REFUGE';
  $('panel-body').innerHTML=`<div class="journal chapter-note"><p>${complete?'You made a shelter, repaired a passage, and brought a trace of another world home. Your refuge is now more than somewhere to survive.':record?'The field record survived the disturbance. Keep it safe at your shelter. You can listen to an excerpt here.':'Inside the glass, miniature structures climb towards a distant point. Beyond this coast lie other worlds. For now, the shore has what you need: timber, stone and fibre.'}</p><p>${complete?'Your buildings and discoveries are saved. Keep exploring and making this place yours.':record?'The rift behind you leads home. Use your storm shelter or canopy to complete the expedition.':'Gather nearby materials and make a field axe. Build a refuge, then repair the old passage. You can explore freely and build at your own pace.'}</p>${record||complete?'<button id="play-record">Listen to Ink of Infinity</button>':''}<button class="primary" id="chapter-continue">${complete?'Keep building':record?'Bring it home':'Step into the world'}</button></div>`;
  if(complete)renderRoutes();
  if($('play-record'))$('play-record').onclick=()=>{sound.setPaused(false);sound.music();$('play-record').textContent='Playing · Ink of Infinity';};
  $('chapter-continue').onclick=()=>{closePanel();};
}
function enterRift(destination){
  if(riftSession||transitioning||!state.watch)return;
  const passage='haven-echo',trial=encounterRift(state,passage);
  save();if(!trial){travelTo(destination);return;}
  cancelBuild();setPaused(true);
  const token=crypto.randomUUID(),frame=document.createElement('iframe');
  const url=new URL('trials.html',location.href);url.searchParams.set('rift',trial);url.searchParams.set('token',token);
  
  frame.title='Rift passage';frame.allow='autoplay';frame.src=url.href;
  riftSession={frame,token,trial,passage,destination};$('rift-frame').replaceChildren(frame);$('rift-challenge').showModal();
  frame.onload=()=>frame.contentWindow?.focus();
}
function leaveRift(){
  if(!riftSession)return;const frame=riftSession.frame;riftSession=null;frame.remove();$('rift-challenge').close();canvas.focus();
  setPaused(false);lastUse=state.time-.3;showToast('Back on the island. The same passage waits when you are ready.');
}
$('leave-rift').onclick=leaveRift;$('rift-challenge').addEventListener('cancel',e=>{e.preventDefault();leaveRift();});
window.addEventListener('message',e=>{
  const r=riftSession;
  if(!r||e.origin!==location.origin||e.source!==r.frame.contentWindow||e.data?.token!==r.token||e.data?.trial!==r.trial)return;
  if(e.data.type==='rift-retreat'){leaveRift();return;}
  if(e.data.type!=='rift-cleared'||!clearRift(state,r.passage,r.trial))return;
  save();riftSession=null;r.frame.remove();$('rift-challenge').close();canvas.focus();
  setPaused(false);travelTo(r.destination);
});
async function travelTo(id){
  if(transitioning)return;transitioning=true;keys.clear();save();
  const overlay=$('rift-transition');overlay.hidden=false;overlay.dataset.active='true';$('transition-label').textContent=id==='echo'?'THE FRACTURED REACH':'THE FIRST REFUGE';sound.effect('portal',.45);
  await new Promise(r=>setTimeout(r,450));
  const dest=world.portals.find(p=>p.id===id);state.player.x=dest.x;state.player.z=dest.z+(id==='echo'?-6:6);state.player.yaw=0;state.player.pitch=0;y=floorHeight(state,state.player.x,state.player.z);vy=0;resetMotion(motion);
  if(!state.visited.includes(id))state.visited.push(id);save();refreshUI();
  await new Promise(r=>setTimeout(r,350));overlay.dataset.active='false';transitioning=false;
  showToast(id==='echo'?(state.chapter.recovered?'East: cargo wreck. West: weather station. Choose what comes home.':'A field record waits beyond the ruined arch.'):'Home, for now. Your shelter is waiting.');
  setTimeout(()=>{overlay.hidden=true;},350);
}
function updateGuide(goal){
  let point=null,label='';
  if(goal.target==='observe'){point=FIELD_DEVICE;label='Glass device';}
  else if(goal.target==='recover'){point=MEMORY;label='Field record';}
  else if(['watch','travel'].includes(goal.target)){point=world?.portals.find(p=>p.id==='haven');label='Old rift';}
  else if(goal.target==='equipment'){point=regionAt(state.player.x,state.player.z).id==='echo'?trackedWreck(state):world?.portals.find(p=>p.id==='haven');label=regionAt(state.player.x,state.player.z).id==='echo'?point?.name:'Rift to the wreck sites';}
  else if(['return','equipment-return'].includes(goal.target)){point=regionAt(state.player.x,state.player.z).id==='echo'?world?.portals.find(p=>p.id==='echo'):state.buildings.find(b=>['shelter','roof'].includes(b.kind));label=regionAt(state.player.x,state.player.z).id==='echo'?'Return rift':'Your shelter';}
  else{const need=neededResources(state,RECIPES,WATCH_COST),candidates=NODES.filter(n=>available(state,n)&&state.inventory[n.type]<(need[n.type]||0)&&regionAt(n.x,n.z).id===regionAt(state.player.x,state.player.z).id);candidates.sort((a,b)=>Math.hypot(a.x-state.player.x,a.z-state.player.z)-Math.hypot(b.x-state.player.x,b.z-state.player.z));point=candidates[0];if(point)label=ITEMS[point.type];}
  if(!point){$('trail-guide').textContent=goal.target==='explore'?'Expedition complete · Your world to build':'Materials ready · B opens crafting';return;}
  const dx=point.x-state.player.x,dz=point.z-state.player.z,angle=Math.atan2(-dx,-dz)-state.player.yaw,arrow=['↑','↖','←','↙','↓','↘','→','↗'][((Math.round(angle/(Math.PI/4))%8)+8)%8];
  $('trail-guide').textContent=`${arrow} ${label} · ${Math.round(Math.hypot(dx,dz))} m`;
}

function eatBerry(){if(eat(state)){showToast('A small meal. +30 energy.');tone();save();refreshUI();}else showToast(state.inventory.berries?'You are already well fed.':'Find a berry bush or build a planter.');}
$('eat-button').onclick=eatBerry;$('touch-use').onclick=interact;
$('rotate-build').onclick=()=>buildRotation+=Math.PI/2;$('cancel-build').onclick=cancelBuild;
function findTarget(){
  let best=null,score=Infinity;camera.getWorldDirection(direction);
  const consider=(type,data,x,z,height=1,range=3.5)=>{const dx=x-state.player.x,dz=z-state.player.z,dist=Math.hypot(dx,dz);if(dist>range)return;const facing=dist>.2?(dx*direction.x+dz*direction.z)/dist:1;if(facing<.4&&dist>1.2)return;const rank=dist+(1-facing)*2;if(rank<score){score=rank;best={type,data};}};
  NODES.forEach(n=>{if(!available(state,n)||Math.hypot(n.x-state.player.x,n.z-state.player.z)>3.5)return;const point=new THREE.Vector3(n.x,terrain(n.x,n.z)+.6,n.z),reach=point.clone().sub(camera.position);reachRaycaster.set(camera.position,reach.clone().normalize());const obstacle=reachRaycaster.intersectObjects([...world.buildings.values()],true)[0];if(!obstacle||obstacle.distance>=reach.length()-.2)consider('node',n,n.x,n.z);});world.portals.forEach(p=>consider('portal',p,p.x,p.z,2.5,5));for(const b of state.buildings)if(!RECIPES[b.kind].modular)consider('building',b,b.x,b.z,1,3.5);WRECKS.forEach(w=>{if(!state.expedition.recovered.includes(w.id))consider('wreck',w,w.x,w.z,1,3.5);});consider('device',FIELD_DEVICE,FIELD_DEVICE.x,FIELD_DEVICE.z,1,3.5);if(!state.chapter.recovered)consider('memory',MEMORY,MEMORY.x,MEMORY.z,1,3.5);raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const hit=raycaster.intersectObjects([...world.buildings.values()],true)[0];if(hit&&hit.distance<6){let root=hit.object;while(root.parent&&root.parent!==world.scene)root=root.parent;const b=state.buildings.find(b=>world.buildings.get(b.id)===root);if(b)best={type:'building',data:b};}target=best;
  let name='',action='';if(best&&!buildKind){if(best.type==='device'){name=FIELD_DEVICE.name;action='E · Inspect';}else if(best.type==='memory'){name=MEMORY.name;action='E · Recover record';}else if(best.type==='wreck'){name=best.data.name;action='E · Recover '+best.data.title.toLowerCase();}else if(best.type==='node'){name=ITEMS[best.data.type];action='E · Gather';}else if(best.type==='portal'){name='VPS rift';action=state.watch?'E · Cross to '+(best.data.destination==='echo'?'the Fractured Reach':'your refuge'):'E · Repair watch';}else{name=RECIPES[best.data.kind].name;action=best.data.kind==='garden'?'E · Harvest berries':best.data.kind==='bench'?'E · Craft':best.data.kind==='fire'?'E · Prepare a meal':'E · Use';action+='   R · Dismantle & refund';}}
  $('target-label').textContent=name;$('target-action').textContent=action;
}
function returnHome(){const b=state.buildings.find(b=>b.kind==='shelter'||b.kind==='roof');state.player.x=b?b.x:0;state.player.z=b?b.z+4.5:18;
  // Choose a safe point near the shelter instead of spawning inside a post or sea.
  if(b){for(let n=0;n<12;n++){const a=n/12*Math.PI*2,x=b.x+Math.sin(a)*4.7,z=b.z+Math.cos(a)*4.7,h=terrain(x,z);if(h>.5&&!playerCollides(world,state,x,h,z)){state.player.x=x;state.player.z=z;break;}}}
  y=floorHeight(state,state.player.x,state.player.z);vy=0;state.warmth=Math.max(60,state.warmth);state.food=Math.max(45,state.food);
}
function refreshUI(){
  const goal=objective(state);$('objective-title').textContent=goal.title;$('objective-text').textContent=goal.text;updateGuide(goal);
  $('inventory').innerHTML=Object.entries(ITEMS).filter(([k])=>state.inventory[k]>0).map(([k,name])=>`<div class="resource" style="--color:${colors[k]}"><b>${state.inventory[k]}</b><small>${name}</small></div>`).join('');
  $('warmth').value=state.warmth;$('food').value=state.food;$('warmth-number').textContent=Math.round(state.warmth);$('food-number').textContent=Math.round(state.food);
  const loadout=WRECKS.find(w=>w.id===state.expedition.equipped);const meal=MEALS[state.preparation.meal],seconds=Math.ceil(state.preparation.remaining);$('equipment-label').textContent=[loadout?.title,meal?`${meal.name} · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:null].filter(Boolean).join(' · ');
  $('region').textContent=regionAt(state.player.x,state.player.z).name.toUpperCase();const period=dayPeriod(state.time);$('day').textContent=`DAY ${String(Math.floor(state.time/DAY_SECONDS)+1).padStart(2,'0')} · ${period}`;
}
function setResolution(){renderer.setPixelRatio(Math.min(devicePixelRatio,state.settings.quality==='performance'?1:state.settings.quality==='high'?2:1.5));renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
function look(dx,dy){state.player.yaw-=dx*.002*state.settings.sensitivity;state.player.pitch=THREE.MathUtils.clamp(state.player.pitch-dy*.002*state.settings.sensitivity,-1.3,1.3);}
document.addEventListener('mousemove',e=>{if(!paused&&document.pointerLockElement===canvas)look(e.movementX,e.movementY);});
canvas.addEventListener('pointerdown',e=>{if(paused)return;if(document.pointerLockElement===canvas){if(e.button===0)interact();return;}drag={x:e.clientX,y:e.clientY,moved:0,id:e.pointerId};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||paused||document.pointerLockElement===canvas)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved+=Math.abs(dx)+Math.abs(dy);look(dx,dy);drag.x=e.clientX;drag.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(drag&&drag.moved<5&&!touch)captureMouse();drag=null;});canvas.addEventListener('pointercancel',()=>drag=null);
document.addEventListener('pointerlockchange',()=>{
  // A pending browser lock request can finish after a menu has opened.
  if(document.pointerLockElement&&paused){document.exitPointerLock();return;}
  if(!document.pointerLockElement&&started&&!paused&&!buildKind)openPanel('pause');
});
document.addEventListener('keydown',e=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  if(!started||riftSession)return;
  if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(e.code==='Escape'){e.preventDefault();if(buildKind){cancelBuild();return;}if(!e.repeat&&!panel.open)openPanel('pause');return;}
  if(!e.repeat&&(e.code==='KeyB'||e.code==='Tab')){panel.open?closePanel():openPanel('craft');return;}
  if(!e.repeat&&e.code==='KeyJ'){panel.open?closePanel():openPanel('journal');return;}
  if(paused)return;keys.add(e.code);if(e.repeat)return;
  if(e.code==='KeyE')interact();if(e.code==='KeyF')eatBerry();if(e.code==='KeyQ'&&buildKind)buildRotation+=Math.PI/2;
  if(e.code==='KeyR'&&!buildKind&&target?.type==='building'){const b=target.data;if(dismantle(state,b.id)){world.removeBuilding(b.id);showToast('Dismantled. All materials returned.');save();refreshUI();}else showToast('Remove the walls and roof from this foundation first. Their materials are fully refunded.');}
  if(e.code==='Space'&&onGround){vy=6.8;onGround=false;}
});document.addEventListener('keyup',e=>keys.delete(e.code));
document.querySelectorAll('[data-move]').forEach(b=>{b.onpointerdown=e=>{if(paused)return;e.preventDefault();keys.add(b.dataset.move);b.setPointerCapture(e.pointerId);};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.move);});
window.addEventListener('blur',()=>{keys.clear();if(started&&!paused)openPanel('pause');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&started){save();if(!paused)openPanel('pause');}});window.addEventListener('pagehide',()=>{if(started)save();});
window.addEventListener('resize',()=>{if(renderer)setResolution();});

function updatePlayer(dt){
  const forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),side=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  const speed=((keys.has('ShiftLeft')||keys.has('ShiftRight'))&&state.food>10?7:4.4)*(state.food<15?.8:1);
  const nx=state.player.x-Math.sin(state.player.yaw)*.4,nz=state.player.z-Math.cos(state.player.yaw)*.4;
  const canMove=(x,z)=>{const h=floorHeight(state,x,z,y);return h>-.35&&h-y<.55&&!playerCollides(world,state,x,Math.max(y,h),z);};
  const {dx,dz}=movePlayer(state.player,motion,{forward,side,speed},dt,canMove);
  const ground=floorHeight(state,state.player.x,state.player.z,y),ceiling=ceilingHeight(state,state.player.x,state.player.z,y);vy-=18*dt;y+=vy*dt;
  if(y+1.7>ceiling&&vy>0){y=ceiling-1.7;vy=0;}
  if(y<=ground){y=ground;vy=0;onGround=true;}else onGround=false;
  state.time+=dt;const night=solarElevation(state.time)<0;
  const sheltered=underRoof(state,state.player.x,state.player.z)||state.buildings.some(b=>['shelter','fire'].includes(b.kind)&&Math.hypot(state.player.x-b.x,state.player.z-b.z)<(b.kind==='shelter'?4:5));
  const cold=regionAt(state.player.x,state.player.z).id==='echo';state.warmth=THREE.MathUtils.clamp(state.warmth+(sheltered?8:night||cold?-exposureRate(state)*preparedExposureRate(state):.3)*dt,0,100);state.food=Math.max(0,state.food-dt*(keys.has('ShiftLeft')?.09:.045)*preparedEnergyRate(state));
  tickPreparation(state,dt);
  if(state.warmth<=0){returnHome();showToast('Exposure brought you back to shelter. Your belongings are safe.');save();}
  const moving=forward||side,bob=state.settings.motion&&moving&&onGround?Math.sin(state.time*10)*.035:0;camera.position.set(state.player.x,y+1.7+bob,state.player.z);camera.rotation.set(state.player.pitch,state.player.yaw,0,'YXZ');
  axe.visible=state.tools.includes('axe')&&!buildKind;axe.position.set(.37,-.34+bob,-.65);axe.rotation.set(-.25-swing*3,0,-.3);
  if((dx||dz)&&terrain(nx,nz)<=-.35&&state.time-lastUse>4){lastUse=state.time;showToast('The current is too strong. Repair the VPS watch to cross between islands.');}
}
function finishArrival(){
  if(started)return;arrivalTime=null;started=true;start.close();$('skip-arrival').hidden=true;document.body.dataset.intro='false';
  camera.position.set(state.player.x,y+1.7,state.player.z);camera.rotation.set(state.player.pitch,state.player.yaw,0,'YXZ');
  setPaused(false);canvas.focus();
  if(saveProblem)showToast(saveProblem);else showToast('WASD to move. E gathers and uses. B opens crafting.');
}
$('skip-arrival').onclick=finishArrival;
function titleCamera(dt){
  if(arrivalTime!==null){
    arrivalTime+=dt;const t=Math.min(1,arrivalTime/2.4),ease=t*t*(3-2*t);
    const end=new THREE.Vector3(state.player.x,y+1.7,state.player.z);
    const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(state.player.pitch,state.player.yaw,0,'YXZ'));
    camera.position.copy(arrivalPosition).lerp(end,ease);camera.quaternion.copy(arrivalRotation).slerp(rotation,ease);
    if(t===1)finishArrival();return;
  }
  if(!reducedMotion())orbitTime+=dt;
  const island=ISLANDS.find(i=>i.id===regionAt(state.player.x,state.player.z).id)||ISLANDS[0];
  const angle=.7+orbitTime*.07,radius=island.radius*1.45;
  camera.position.set(island.x+Math.sin(angle)*radius,32,island.z+Math.cos(angle)*radius);
  camera.lookAt(island.x,2,island.z);
}
function animate(now){
  const dt=Math.min((now-last)/1000||0,.05);last=now;
  if(!started&&!document.hidden)titleCamera(dt);
  if(riftSession)return;
  if(started&&!paused&&!transitioning){updatePlayer(dt);updateGhost();uiClock+=dt;saveClock+=dt;swing=Math.max(0,swing-dt);if(uiClock>.15){uiClock=0;refreshUI();findTarget();for(const n of NODES)world.nodes.get(n.id).visible=available(state,n);}if(saveClock>8){saveClock=0;save();}}
  world.update(state.time,state.player,state);renderer.render(world.scene,camera);
}
async function boot(){
  renderer=new THREE.WebGPURenderer({canvas,antialias:true,powerPreference:'high-performance'});await renderer.init();renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=state.settings.quality!=='performance';renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.onDeviceLost=()=>{setPaused(true);$('fatal-message').textContent='The graphics device was interrupted. Your latest save is safe; try reloading.';$('fatal').hidden=false;};
  world=createWorld({quality:state.settings.quality});await world.ready;const environment=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(renderer);world.scene.environment=pmrem.fromScene(environment,.04).texture;world.scene.environmentIntensity=.4;environment.dispose();pmrem.dispose();state.buildings.forEach(world.addBuilding);for(const n of NODES)world.nodes.get(n.id).visible=available(state,n);
  camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,4000);axe=makeAxe();axe.visible=false;camera.add(axe);world.scene.add(camera);y=floorHeight(state,state.player.x,state.player.z);camera.position.set(state.player.x,y+1.7,state.player.z);camera.rotation.set(state.player.pitch,state.player.yaw,0,'YXZ');setResolution();refreshUI();
  titleCamera(0);await renderer.compileAsync(world.scene,camera);renderer.setAnimationLoop(animate);$('start-button').disabled=false;$('start-button').textContent=state.savedAt?'Continue your journey':'Enter the island';if(saveProblem)$('start-note').textContent=saveProblem;
  $('start-button').onclick=()=>{start.close();sound.setVolume(state.settings.sound);sound.start();tone('build');if(reducedMotion()){finishArrival();return;}arrivalTime=0;arrivalPosition=camera.position.clone();arrivalRotation=camera.quaternion.clone();$('skip-arrival').hidden=false;};
}
boot().catch(error=>{console.error(error);start.close();$('fatal-message').textContent='A graphics feature or game resource could not load. Try a current browser with hardware acceleration enabled.';$('fatal').hidden=false;});


