// Small, proposed game chapter. Film lore and new game objectives stay distinct.
export const FIELD_DEVICE={id:'field-device',x:0,z:12,name:'Glass device'};
export const MEMORY={id:'memory',x:112,z:-64,name:'Ink-bound field record'};
export const chapterState=()=>({observed:false,recovered:false,complete:false});
export function readDevice(state){if(state.chapter.observed)return false;state.chapter.observed=true;return true;}
export function recoverRecord(state){if(!state.visited.includes('echo')||state.chapter.recovered)return false;state.chapter.recovered=true;return true;}
export function returnRecord(state,building){if(!state.chapter.recovered||state.chapter.complete||!['shelter','roof'].includes(building?.kind)||Math.hypot(building.x,building.z)>50)return false;state.chapter.complete=true;return true;}
export function neededResources(state,recipes,watchCost){
  if(!state.tools.includes('axe'))return recipes.axe.cost;
  if(!state.buildings.some(b=>['shelter','roof'].includes(b.kind)))return recipes.shelter.cost;
  if(!state.buildings.some(b=>b.kind==='bench'))return recipes.bench.cost;
  if(!state.buildings.some(b=>b.kind==='anchor'))return recipes.anchor.cost;
  if(!state.watch)return watchCost;
  return {};
}
