import {riftState,validateRifts} from './rifts.js';
import {preparationState} from './preparation.js';
import {expeditionState,gatheringBonus} from './expedition.js';
import {chapterState} from './chapter.js';
// New survival systems. Creative source: Desktop/AXIOMORT; see sources.json.
export const SAVE_KEY = 'axiomort_survival_v1';
export const BACKUP_KEY = SAVE_KEY + '_backup';
export const SAVE_VERSION = 6;
export const ITEMS = {wood:'Timber',stone:'Stone',fiber:'Fibre',scrap:'VPS salvage',crystal:'Rift crystal',berries:'Berries'};
export const RECIPES = {
  axe: {name:'Field axe',description:'Salvaged stone, a branch, a little ingenuity. Gather twice as much.',cost:{wood:3,stone:3,fiber:2},kind:'tool'},
  shelter: {name:'Storm shelter',description:'Your first home. Restores warmth and becomes your return point.',cost:{wood:10,fiber:6},radius:3.3},
  fire: {name:'Campfire',description:'Restores warmth nearby. Use it to prepare a trail meal or warming broth before an expedition.',cost:{wood:4,stone:4},radius:1.2},
  bench: {name:'Workbench',description:'A place to turn wreckage into useful equipment.',cost:{wood:6,stone:4},radius:1.6},
  garden: {name:'Berry planter',description:'Grow berries for eating and campfire meals. Harvest every 45 seconds of play.',cost:{wood:6,fiber:4},radius:1.5},
  anchor: {name:'Stability anchor',description:'Hold one small piece of reality together. Enables VPS watch repair.',cost:{stone:6,scrap:4,crystal:2},requires:'bench',radius:1.4},
  foundation: {name:'Timber foundation',description:'A walkable four-metre floor. Snaps beside another foundation.',cost:{wood:6,stone:2},radius:2,modular:true},
  wall: {name:'Timber wall',description:'Clad one edge of a foundation. Q chooses the edge.',cost:{wood:4,fiber:1},radius:2,modular:true,attachment:true},
  doorway: {name:'Open doorway',description:'A wide entrance you can walk through. Snaps to a foundation edge.',cost:{wood:3,fiber:1},radius:2,modular:true,attachment:true},
  roof: {name:'Canopy roof',description:'Posts and a canvas roof. Gives warmth underneath and creates a home.',cost:{wood:4,fiber:4},radius:2,modular:true,attachment:true},
};
export const WATCH_COST = {scrap:4,crystal:2};
export const ISLANDS = [{id:'haven',name:'The First Refuge',x:0,z:0,radius:49},{id:'echo',name:'The Fractured Reach',x:112,z:-48,radius:29}];
export function terrain(x,z){
  let best=-6;
  for(const island of ISLANDS){const dx=x-island.x,dz=z-island.z;const r=Math.hypot(dx,dz)/island.radius;
    const mound=6*Math.pow(Math.max(0,1-r*r),1.1)-2;
    const hills=(Math.sin(dx*.12)*Math.cos(dz*.1)*1.3+Math.sin(dx*.26+dz*.15)*.4)*Math.max(0,1-r);
    best=Math.max(best,mound+hills);
  }return best;
}
export function regionAt(x,z){return ISLANDS.reduce((a,b)=>Math.hypot(x-b.x,z-b.z)<Math.hypot(x-a.x,z-a.z)?b:a);}
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export const NODES = (()=>{const nodes=[],rand=random(4209);for(const island of ISLANDS){
  for(let n=0;n<72;n++){const angle=rand()*Math.PI*2,r=Math.sqrt(rand())*island.radius*.8,x=island.x+Math.cos(angle)*r,z=island.z+Math.sin(angle)*r;
    if(terrain(x,z)<.65||Math.hypot(x,z-18)<4||Math.hypot(x-7,z+16)<5||Math.hypot(x-112,z+48)<5)continue;
    const type=['wood','wood','stone','fiber','scrap','berries'][n%6];nodes.push({id:`${island.id}-${n}`,type,x,z,scale:.85+rand()*.5,rotation:rand()*6.28});
  }
  for(let n=0;n<5;n++)nodes.push({id:`${island.id}-crystal-${n}`,type:'crystal',x:island.x-20+n*1.5,z:island.z-8+n*2.2,scale:1,rotation:n});
}
  for(const [id,type,x,z] of [['start-timber','wood',-2,15],['start-stone','stone',3,14],['start-fibre','fiber',-3,9]])nodes.push({id,type,x,z,scale:.9,rotation:.3});
  return nodes;})();
export function freshState(){return {version:SAVE_VERSION,inventory:Object.fromEntries(Object.keys(ITEMS).map(k=>[k,0])),tools:[],buildings:[],harvested:{},gardenTimes:{},player:{x:0,z:18,yaw:0,pitch:0},time:0,warmth:100,food:100,watch:false,rifts:riftState(),chapter:chapterState(),expedition:expeditionState(),preparation:preparationState(),visited:['haven'],milestones:[],nextId:1,settings:{quality:'balanced',sensitivity:1,sound:.35,motion:true},savedAt:null};}
export function hasBuilding(s,kind){return s.buildings.some(b=>b.kind===kind);}
export function affordable(s,cost){return Object.entries(cost).every(([k,n])=>s.inventory[k]>=n);}
export function spend(s,cost){if(!affordable(s,cost))return false;for(const[k,n]of Object.entries(cost))s.inventory[k]-=n;return true;}
export function canCraft(s,kind){const r=RECIPES[kind];return !!r&&(!r.requires||hasBuilding(s,r.requires))&&!(r.kind==='tool'&&s.tools.includes(kind))&&affordable(s,r.cost);}
export function craftTool(s,kind){if(RECIPES[kind]?.kind!=='tool'||!canCraft(s,kind))return false;spend(s,RECIPES[kind].cost);s.tools.push(kind);return true;}
export function placeBuilding(s,kind,x,z,rotation,pose={}){if(!RECIPES[kind]||RECIPES[kind].kind==='tool'||!canCraft(s,kind))return null;spend(s,RECIPES[kind].cost);const b={id:s.nextId++,kind,x,z,rotation};if(RECIPES[kind].modular){b.y=pose.y??terrain(x,z);b.supportId=pose.supportId??null;}s.buildings.push(b);return b;}
export function dismantle(s,id){const b=s.buildings.find(b=>b.id===id);if(!b||s.buildings.some(piece=>piece.supportId===id))return false;for(const[k,n]of Object.entries(RECIPES[b.kind].cost))s.inventory[k]+=n;s.buildings=s.buildings.filter(b=>b.id!==id);delete s.gardenTimes[id];return true;}
export function available(s,node){return !s.buildings.some(b=>Math.hypot(node.x-b.x,node.z-b.z)<RECIPES[b.kind].radius+.6)&&(s.harvested[node.id]===undefined||s.time-s.harvested[node.id]>=60);}
export function harvest(s,node){if(!available(s,node))return null;s.harvested[node.id]=s.time;const amount=(node.type==='crystal'?1:node.type==='berries'?3:s.tools.includes('axe')?6:3)+gatheringBonus(s,node.type);s.inventory[node.type]+=amount;return {type:node.type,amount};}
export function repairWatch(s){if(s.watch||!hasBuilding(s,'anchor')||!spend(s,WATCH_COST))return false;s.watch=true;return true;}
export function eat(s){if(!s.inventory.berries||s.food>=100)return false;s.inventory.berries--;s.food=Math.min(100,s.food+30);return true;}
export function harvestGarden(s,b){if(b.kind!=='garden'||s.time-(s.gardenTimes[b.id]??-45)<45)return false;s.gardenTimes[b.id]=s.time;s.inventory.berries+=4;return true;}
export function objective(s){
  if(!s.chapter.observed)return {title:'A signal in the silence',text:'Inspect the glass device on the table ahead. E interacts.',target:'observe'};
  if(!s.tools.includes('axe'))return {title:'Make something useful',text:'Gather timber, stone and fibre. Craft a field axe.',target:'axe'};
  if(!hasBuilding(s,'shelter')&&!hasBuilding(s,'roof'))return {title:'A place of your own',text:'Build a storm shelter, or make your own home with a foundation and canopy roof.',target:'shelter'};
  if(!hasBuilding(s,'bench'))return {title:'From wreckage to possibility',text:'Build a workbench. Search the shoreline for VPS salvage.',target:'bench'};
  if(!hasBuilding(s,'anchor'))return {title:'Hold reality together',text:'Find green crystals near the broken arches. Build a stability anchor.',target:'anchor'};
  if(!s.watch)return {title:'The watch still remembers',text:'Bring 4 VPS salvage and 2 crystals to the old rift.',target:'watch'};
  if(!s.visited.includes('echo'))return {title:'Beyond the familiar',text:'Step up to the rift and cross to the Fractured Reach.',target:'travel'};
  if(!s.chapter.recovered)return {title:'A trace of another world',text:'Follow the dark stone path. Recover the field record at the ruined arch.',target:'recover'};
  if(!s.chapter.complete)return {title:'Bring something back',text:'Cross home and use your shelter to keep the recovered record.',target:'return'};
  if(!s.expedition.recovered.length)return {title:'Choose what comes home',text:'Return to the Reach. East: gather faster with a salvage harness. West: stay warm with insulated lining. J shows both routes.',target:'equipment'};
  if(!s.expedition.returned)return {title:'Make the journey count',text:'Your recovered equipment is already working. Bring it home to your shelter. The other wreck remains yours to explore.',target:'equipment-return'};
  return {title:'A home between worlds',text:'Equipment recovered. Refit at your workbench, explore the other wreck, or keep building your refuge.',target:'explore'};
}
export function validateState(raw){
  if(!raw||![1,2,3,4,5,SAVE_VERSION].includes(raw.version)||!raw.inventory||!Array.isArray(raw.buildings)||raw.buildings.length>250)throw new Error('This is not a supported Island save.');
  const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  for(const k of Object.keys(ITEMS))if(!Number.isInteger(raw.inventory[k])||!finite(raw.inventory[k],0,100000))throw new Error('Invalid inventory.');
  const s=freshState();s.inventory={...raw.inventory};
  if(!raw.player||!finite(raw.player.x,-100,170)||!finite(raw.player.z,-100,100)||terrain(raw.player.x,raw.player.z)<-.3)throw new Error('Invalid saved location.');
  if(!finite(raw.player.yaw,-1e8,1e8)||!finite(raw.player.pitch,-1.5,1.5))throw new Error('Invalid camera.');
  s.player={...raw.player};s.buildings=raw.buildings.map(b=>{if(!RECIPES[b.kind]||RECIPES[b.kind].kind==='tool'||!Number.isInteger(b.id)||!finite(b.id,1,100000)||!finite(b.x,-100,170)||!finite(b.z,-100,100)||terrain(b.x,b.z)<.3||!finite(b.rotation,-1e8,1e8))throw new Error('Invalid construction.');const result={id:b.id,kind:b.kind,x:b.x,z:b.z,rotation:b.rotation};if(RECIPES[b.kind].modular){if(raw.version===1||!finite(b.y,0,12)||!(b.supportId===null||Number.isInteger(b.supportId)))throw new Error("Invalid modular construction.");result.y=b.y;result.supportId=b.supportId;}return result;});
  for(const b of s.buildings.filter(b=>RECIPES[b.kind].modular)){if(b.kind==='foundation'){if(b.supportId!==null||Math.abs(b.y-terrain(b.x,b.z))>1)throw new Error('Invalid foundation.');}else{const base=s.buildings.find(p=>p.id===b.supportId&&p.kind==='foundation');if(!base||Math.hypot(b.x-base.x,b.z-base.z)>.01||Math.abs(b.y-base.y-.2)>.01)throw new Error('Missing foundation support.');}}
  if(new Set(s.buildings.map(b=>b.id)).size!==s.buildings.length)throw new Error('Duplicate construction.');
  if(!finite(raw.time,0,1e9)||!finite(raw.warmth,0,100)||!finite(raw.food,0,100)||typeof raw.watch!=='boolean')throw new Error('Invalid survival state.');
  if(raw.chapter!==undefined){if(!raw.chapter||['observed','recovered','complete'].some(k=>typeof raw.chapter[k]!=='boolean')||(raw.chapter.complete&&!raw.chapter.recovered))throw Error('Invalid chapter progress');s.chapter={observed:raw.chapter.observed,recovered:raw.chapter.recovered,complete:raw.chapter.complete};}
  if(raw.expedition!==undefined){
    const e=raw.expedition,ids=['harness','lining'];
    if(!e||!Array.isArray(e.recovered)||e.recovered.length>2||new Set(e.recovered).size!==e.recovered.length||e.recovered.some(id=>!ids.includes(id))||!(e.equipped===null||e.recovered.includes(e.equipped))||!ids.includes(e.tracked)||typeof e.returned!=='boolean'||(e.returned&&!e.recovered.length))throw Error('Invalid expedition equipment.');
    s.expedition={recovered:[...e.recovered],equipped:e.equipped,tracked:e.tracked,returned:e.returned};
  }
  if(raw.preparation!==undefined){const p=raw.preparation;if(!p||![null,'trail','broth'].includes(p.meal)||!finite(p.remaining,0,p.meal==='trail'?240:p.meal==='broth'?120:0)||(p.remaining===0&&p.meal!==null))throw Error('Invalid expedition preparation.');s.preparation={meal:p.meal,remaining:p.remaining};}
  if(raw.rifts!==undefined)s.rifts=validateRifts(raw.rifts);
  s.time=raw.time;s.food=raw.food;s.warmth=raw.warmth;s.watch=raw.watch;
  if(!Array.isArray(raw.tools)||raw.tools.some(t=>t!=='axe')||!Array.isArray(raw.visited)||raw.visited.some(t=>!['haven','echo'].includes(t)))throw new Error('Invalid progress.');
  s.tools=[...new Set(raw.tools)];s.visited=[...new Set(raw.visited)];s.nextId=Math.max(0,...s.buildings.map(b=>b.id))+1;
  for(const[id,t]of Object.entries(raw.harvested||{})){if(!NODES.some(n=>n.id===id)||!finite(t,0,s.time))throw new Error('Invalid resource state.');s.harvested[id]=t;}
  for(const[id,t]of Object.entries(raw.gardenTimes||{})){if(!s.buildings.some(b=>String(b.id)===id&&b.kind==='garden')||!finite(t,0,s.time))throw new Error('Invalid garden state.');s.gardenTimes[id]=t;}
  const o=raw.settings||{};s.settings={quality:['performance','balanced','high'].includes(o.quality)?o.quality:'balanced',sensitivity:finite(o.sensitivity,.25,2)?o.sensitivity:1,sound:finite(o.sound,0,1)?o.sound:.35,motion:o.motion!==false};s.savedAt=typeof raw.savedAt==='string'?raw.savedAt:null;return s;
}
// Keep the original key so existing journeys migrate on their next successful save.
export function loadSave(storage){
  const value=storage.getItem(SAVE_KEY),backup=storage.getItem(BACKUP_KEY);
  if(value){try{return {state:validateState(JSON.parse(value)),recovered:false};}catch{/* Try the last good checkpoint. */}}
  if(backup){try{return {state:validateState(JSON.parse(backup)),recovered:true};}catch{/* Preserve both originals for export. */}}
  if(value||backup)throw new Error('No readable Island checkpoint.');
  return {state:freshState(),recovered:false};
}
export function loadState(storage){return loadSave(storage).state;}
export function saveState(s,storage){
  const next=validateState(s);next.savedAt=new Date().toISOString();
  const previous=storage.getItem(SAVE_KEY);
  if(previous){let valid=false;try{validateState(JSON.parse(previous));valid=true;}catch{/* Never overwrite a good backup with corrupt data. */}
    if(valid)storage.setItem(BACKUP_KEY,previous);
  }
  // localStorage replaces one key atomically. A failed write leaves the primary intact.
  storage.setItem(SAVE_KEY,JSON.stringify(next));s.savedAt=next.savedAt;
}

// One shared solar cycle for lighting, exposure and the HUD.
export const DAY_SECONDS=1200;
export const solarElevation=t=>Math.sin(t/DAY_SECONDS*Math.PI*2+.32);
export function dayPeriod(t){const p=t%DAY_SECONDS;return p<240?'MORNING':p<480?'AFTERNOON':p<620?'DUSK':p<1140?'NIGHT':'DAWN';}
