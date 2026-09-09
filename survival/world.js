import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createCoast} from './coast.js';
import {WRECKS} from './expedition.js';
import {createSetpieces} from './setpieces.js';
import * as THREE from 'three/webgpu';
import {positionLocal,positionWorld,time,sin,cos,vec3,color,mix,smoothstep,fract,dot,float,texture,uv} from 'three/tsl';
import {SkyMesh} from 'three/addons/objects/SkyMesh.js';
import {solarElevation,terrain,ISLANDS,NODES,RECIPES,available} from './state.js';
import {level,moduleError,moduleCollides} from './construction.js';

let cooksetTemplate=null;
const M=(c,r=.88,metal=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:metal});
const materials={timber:M(0x796447),edge:M(0x9e8561),metal:M(0x4d5e5d,.63,.65),rust:M(0x926747,.85,.35),dark:M(0x26353b,.7,.55),canvas:M(0xadb08d),stone:M(0x66736b),leaf:M(0x526d48),berry:M(0xc97d66),soil:M(0x483e33),green:new THREE.MeshStandardMaterial({color:0x77e9b0,emissive:0x46e891,emissiveIntensity:2,roughness:.4}),ember:new THREE.MeshStandardMaterial({color:0xffcc72,emissive:0xff853c,emissiveIntensity:2})};
export function mesh(parent,geometry,material,x=0,y=0,z=0){const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
const box=(p,w,h,d,m,x=0,y=0,z=0)=>mesh(p,new THREE.BoxGeometry(w,h,d),m,x,y,z);
const cylinder=(p,a,b,h,m,x=0,y=0,z=0,n=12)=>mesh(p,new THREE.CylinderGeometry(a,b,h,n),m,x,y,z);
const orb=(p,r,m,x=0,y=0,z=0)=>mesh(p,new THREE.IcosahedronGeometry(r,1),m,x,y,z);
function beam(parent,a,b,width,material){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);const o=cylinder(parent,width,width,start.distanceTo(end),material);o.position.copy(start.clone().add(end).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return o;}
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function surfaceTexture(kind){const n=128,data=new Uint8Array(n*n*4),rand=seeded(kind==='wood'?139:381);for(let y=0;y<n;y++)for(let x=0;x<n;x++){let v;if(kind==='wood'){v=160+Math.sin(x*.4+Math.sin(y*.025)*2)*20+rand()*30;if(x%32<2)v*=.55;}else v=165+Math.sin(x*.18)*Math.cos(y*.2)*22+rand()*40;const i=(y*n+x)*4;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}const t=new THREE.DataTexture(data,n,n);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;}
const woodTexture=surfaceTexture('wood'),stoneTexture=surfaceTexture('stone');
for(const name of ['timber','edge']){materials[name].map=woodTexture;materials[name].bumpMap=woodTexture;materials[name].bumpScale=.07;}
for(const name of ['stone','rust','dark','metal']){materials[name].map=stoneTexture;materials[name].bumpMap=stoneTexture;materials[name].bumpScale=.035;}
function pineCrown(){
  // Branch sprays with gaps between leaflets: light reaches through the crown.
  const points=[],shade=[],rand=seeded(913);
  const tri=(a,b,c,v)=>{points.push(...a,...b,...c);for(let n=0;n<3;n++)shade.push(v*.86,v,v*.83);};
  for(let tier=0;tier<9;tier++)for(let branch=0;branch<8;branch++){
    const y=.24+tier*.078+Math.sin(branch*7+tier)*.018,a=branch/8*Math.PI*2+tier*2.399,len=(1-y)*(.32+rand()*.075),dx=Math.cos(a),dz=Math.sin(a),sx=-dz,sz=dx;
    const tip=[dx*len,y-.035,dz*len];
    tri([-.008,y,0],tip,[.008,y,0],.58);
    for(let n=0;n<5;n++){
      const f=(n+.5)/5,r=len*f,spread=(1-f)*len*.68+.008,cy=y-.085*f;
      for(const side of [-1,1]){
        const base=[dx*r,cy,dz*r],outer=[dx*(r+len*.15)+sx*spread*side,cy+.009,dz*(r+len*.15)+sz*spread*side],end=[dx*(r+len*.3),cy-.013,dz*(r+len*.3)];
        const v=.65+rand()*.35;tri(base,outer,end,v);
        tri([base[0],cy+.032,base[2]],[outer[0],outer[1]-.04,outer[2]],end,v*.86);
      }
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(shade,3));geo.computeVertexNormals();return geo;
}

export function makeAxe(){const g=new THREE.Group();cylinder(g,.025,.037,.65,materials.timber,0,0,0,8);const head=orb(g,.15,materials.stone,.08,.24,0);head.scale.set(1.6,.65,.3);for(let y of [.16,.2,.24]){const binding=mesh(g,new THREE.TorusGeometry(.04,.01,5,10),materials.canvas,0,y,0);binding.rotation.x=Math.PI/2;}return g;}

export function makeBuilding(kind,{ghost=false}={}){
  const g=new THREE.Group();g.userData.kind=kind;
  if(kind==='foundation'){
    box(g,4,.2,4,materials.dark,0,-.05,0);
    for(let n=0;n<10;n++)box(g,.385,.16,3.98,materials.timber,-1.8+n*.4,.12,0);
    for(const x of [-1.8,1.8])for(const z of [-1.8,1.8])box(g,.2,.75,.2,materials.dark,x,-.25,z);
    for(const z of [-1.96,1.96])box(g,4,.16,.08,materials.edge,0,.08,z);
  }else if(kind==='wall'||kind==='doorway'){
    for(const x of [-1.92,1.92])box(g,.16,2.7,.18,materials.dark,x,1.35,-2);
    box(g,4,.18,.2,materials.edge,0,2.61,-2);
    if(kind==='wall')for(let n=0;n<10;n++)box(g,.38,2.5,.1,materials.timber,-1.8+n*.4,1.25,-2);
    else{
      for(const x of [-1.46,1.46]){box(g,1.08,2.5,.1,materials.timber,x,1.25,-2);box(g,.12,2.25,.2,materials.edge,Math.sign(x)*.94,1.125,-2);}
      box(g,1.9,.4,.15,materials.timber,0,2.45,-2);
    }
  }else if(kind==='roof'){
    for(const x of [-1.85,1.85])for(const z of [-1.85,1.85])box(g,.16,2.7,.16,materials.timber,x,1.35,z);
    for(const z of [-1.95,1.95])box(g,4.1,.14,.14,materials.edge,0,2.65,z);
    for(const side of [-1,1]){const roof=box(g,2.13,.08,4.2,materials.canvas,side*1.03,2.9,0);roof.rotation.z=-side*.18;}
    beam(g,[0,3.1,-2.1],[0,3.1,2.1],.07,materials.dark);
  }else if(kind==='shelter'){
    for(let x=-1.7;x<=1.7;x+=3.4)for(let z=-1.5;z<=1.5;z+=3){cylinder(g,.09,.12,2.5,materials.timber,x,1.25,z);box(g,.3,.12,.3,materials.metal,x,.1,z);}
    for(let z of [-1.5,1.5]){beam(g,[-1.85,2.3,z],[0,3.15,z],.1,materials.timber);beam(g,[0,3.15,z],[1.85,2.3,z],.1,materials.timber);}
    beam(g,[0,3.15,-1.7],[0,3.15,1.7],.1,materials.timber);
    for(let side of [-1,1]){const roof=box(g,2.1,.07,3.65,materials.canvas,side*.9,2.7,0);roof.rotation.z=-side*.43;}
    const bed=box(g,1,.18,1.9,materials.canvas,-.7,.25,-.15);bed.rotation.y=.1;
    box(g,.75,.25,.4,materials.edge,-.7,.4,-.8);box(g,.65,.65,.65,materials.timber,1,.32,-1);
    cylinder(g,.1,.1,.4,materials.ember,1,1.4,-1.3);const lamp=new THREE.PointLight(0xffcf80,3,6);lamp.position.set(1,1.4,-1.3);g.add(lamp);
  }else if(kind==='fire'){
    if(cooksetTemplate){const kit=cooksetTemplate.clone(true);kit.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();o.castShadow=true;o.receiveShadow=true;}});g.add(kit);}
    for(let n=0;n<9;n++){const a=n/9*Math.PI*2;orb(g,.22,materials.stone,Math.cos(a)*.65,.18,Math.sin(a)*.65);}
    for(let n=0;n<3;n++){const log=cylinder(g,.12,.12,1,materials.timber,0,.2,0);log.rotation.z=Math.PI/2;log.rotation.y=n*1.05;}
    const flame=mesh(g,new THREE.ConeGeometry(.24,.75,7),materials.ember,0,.55,0);flame.userData.flame=true;
    const light=new THREE.PointLight(0xffb36a,9,9);light.position.y=1;g.add(light);
  }else if(kind==='bench'){
    box(g,2.5,.16,1.05,materials.edge,0,1,0);for(let x of [-1,1])for(let z of [-.35,.35])box(g,.14,.95,.14,materials.dark,x,.5,z);
    box(g,2.3,.1,.8,materials.timber,0,.25,0);box(g,.4,.4,.4,materials.metal,.8,1.25,0);cylinder(g,.16,.16,.3,materials.rust,-.75,1.23,.1);
    beam(g,[-1.2,1.15,-.45],[-1.2,1.9,-.45],.04,materials.dark);orb(g,.12,materials.ember,-1.2,1.9,-.45);
  }else if(kind==='garden'){
    box(g,2,.35,1.5,materials.timber,0,.175,0);box(g,1.8,.1,1.3,materials.soil,0,.38,0);
    for(let x of [-.6,0,.6])for(let z of [-.35,.35]){orb(g,.25,materials.leaf,x,.65,z);orb(g,.07,materials.berry,x+.09,.82,z);}
  }else if(kind==='anchor'){
    cylinder(g,.75,.9,.25,materials.dark,0,.15,0);cylinder(g,.32,.45,1.4,materials.rust,0,.85,0);
    for(let n=0;n<4;n++){const a=n*Math.PI/2;beam(g,[Math.cos(a)*.8,.2,Math.sin(a)*.8],[Math.cos(a)*.4,2.25,Math.sin(a)*.4],.065,materials.metal);}
    for(let y of [.55,1.55,2.25]){const r=mesh(g,new THREE.TorusGeometry(.55,.05,8,24),materials.metal,0,y,0);r.rotation.x=Math.PI/2;}
    const crystal=mesh(g,new THREE.OctahedronGeometry(.34),materials.green,0,1.75,0);crystal.userData.rotate=true;
    const light=new THREE.PointLight(0x7bffc2,5,8);light.position.y=1.8;g.add(light);
    const field=new THREE.Mesh(new THREE.RingGeometry(1.6,1.64,64),new THREE.MeshBasicMaterial({color:0x82a995,transparent:true,opacity:.24,side:THREE.DoubleSide,depthWrite:false}));field.rotation.x=-Math.PI/2;field.position.y=.06;field.userData.anchorField=true;g.add(field);
    for(let n=0;n<5;n++){const a=n/5*Math.PI*2;const shard=orb(g,.18,materials.stone,Math.cos(a)*1.15,.65+(n%2)*.2,Math.sin(a)*1.15);shard.userData.settling=true;shard.userData.baseY=shard.position.y;}
  }
  if(ghost)g.traverse(o=>{if(o.isMesh){o.material=new THREE.MeshBasicMaterial({color:0xb8edb3,transparent:true,opacity:.4,depthWrite:false});o.castShadow=false;}if(o.isLight)o.intensity=0;});
  return g;
}

function makeNode(node){
  const g=new THREE.Group(),rand=seeded(node.id.length*91+Math.round(node.x*10));
  if(node.type==='wood'){
    for(let i=0;i<3;i++){const log=cylinder(g,.13,.17,1.7,materials.timber,(i-1)*.25,.16+i*.03,0);log.rotation.z=1.52;log.rotation.y=i*.35;}
  }else if(node.type==='stone'){
    for(let i=0;i<3;i++){const rock=orb(g,.36+rand()*.25,materials.stone,(i-1)*.4,.22,rand()*.5-.25);rock.scale.y=.75;}
  }else if(node.type==='scrap'){
    box(g,.9,.55,.7,materials.dark,0,.3,0);for(let x of [-.33,.33])box(g,.06,.58,.74,materials.rust,x,.3,0);
    const pipe=cylinder(g,.13,.13,.9,materials.metal,.1,.67,0);pipe.rotation.z=1.6;box(g,.23,.025,.25,materials.green,.16,.58,.1);
  }else if(node.type==='fiber'||node.type==='berries'){
    for(let i=0;i<7;i++){const a=i*2.4,h=.48+rand()*.32,x=Math.cos(a)*.35,z=Math.sin(a)*.35;beam(g,[0,0,0],[x,h,z],.014,materials.timber);for(let k=0;k<4;k++){const f=.4+k*.17,leaf=orb(g,.15,materials.leaf,x*f,h*f,z*f);leaf.scale.set(.45,.18,1.4);leaf.rotation.set(.3,a+k*.9,.4);}if(node.type==='berries')for(let k=0;k<3;k++)orb(g,.055,materials.berry,x+Math.sin(k*3)*.07,h-.04,z+Math.cos(k*3)*.07);}
  }else{
    for(let i=0;i<4;i++){const c=mesh(g,new THREE.OctahedronGeometry(.27),materials.green,(i-1.5)*.24,.4+(i%2)*.3,Math.sin(i)*.2);c.scale.y=2;c.rotation.z=(i-1.5)*.2;}
    orb(g,.6,materials.stone,0,0,0).scale.y=.3;
  }
  g.updateMatrixWorld(true);const byMaterial=new Map();
  for(const child of [...g.children]){const geo=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();geo.applyMatrix4(child.matrixWorld);const list=byMaterial.get(child.material)||[];list.push(geo);byMaterial.set(child.material,list);g.remove(child);child.geometry.dispose();}
  for(const [material,parts] of byMaterial){const combined=mergeGeometries(parts);mesh(g,combined,material);parts.forEach(p=>p.dispose());}
  g.position.set(node.x,terrain(node.x,node.z),node.z);g.rotation.y=node.rotation;g.scale.setScalar(node.scale);return g;
}

function makePortal(){
  const g=new THREE.Group();
  // The passage is open: ring pieces are decorative, interaction handles crossing.
  for(let n=0;n<4;n++){mesh(g,new THREE.TorusGeometry(2.35-n*.16,.14,8,36),n%2?materials.rust:materials.metal,0,2.6,-n*.45);}
  for(let n=0;n<12;n++){const a=n/12*Math.PI*2;const brace=box(g,.22,.55,1.6,materials.dark,Math.cos(a)*2.6,2.6+Math.sin(a)*2.6,-.65);brace.rotation.z=a-Math.PI/2;}
  const energy=new THREE.MeshBasicNodeMaterial({transparent:true,opacity:.65,side:THREE.DoubleSide});
  const pattern=sin(positionLocal.x.mul(5).add(time.mul(.5))).mul(cos(positionLocal.y.mul(6).sub(time.mul(.4)))).mul(.5).add(.5);
  energy.colorNode=mix(color(0x073d36),color(0x8af4bd),pattern);energy.opacityNode=pattern.mul(.35).add(.2);
  const surface=mesh(g,new THREE.CircleGeometry(2.12,48),energy,0,2.6,-.1);surface.castShadow=false;
  for(let x of [-2,2]){box(g,.65,.65,2.4,materials.dark,x,.3,-.5);cylinder(g,.08,.08,2.6,materials.rust,x,1.4,.5);}
  const light=new THREE.PointLight(0x8affc9,5,12);light.position.set(0,2.5,1);g.add(light);return g;
}

export function createWorld({quality='balanced'}={}){
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xa8cbd5);scene.fog=new THREE.FogExp2(0xb8d4d8,.0033);
  const ambient=new THREE.HemisphereLight(0xc9e7ef,0x566a47,2.1);scene.add(ambient);
  const sun=new THREE.DirectionalLight(0xffe4b7,3);sun.position.set(-70,95,40);sun.castShadow=quality!=='performance';sun.shadow.mapSize.setScalar(quality==='high'?2048:1024);Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:240});sun.shadow.bias=-.0003;sun.shadow.normalBias=.05;scene.add(sun);
  const sky=new SkyMesh();sky.scale.setScalar(8000);sky.sunPosition.value.copy(sun.position).normalize();sky.turbidity.value=3;sky.rayleigh.value=1.5;scene.add(sky);
  const groundMaterial=new THREE.MeshStandardNodeMaterial({roughness:.93});
  const noise=fract(sin(dot(positionWorld.xz,/* stable micro texture */new THREE.Vector2(12.9898,78.233))).mul(43758.54));
  const macro=sin(positionWorld.x.mul(.21)).mul(cos(positionWorld.z.mul(.27))).mul(.5).add(.5);
  const pathMask=float(1).sub(smoothstep(1,2.8,positionWorld.x.sub(sin(positionWorld.z.mul(.1)).mul(6)).abs()));
  const base=mix(color(0xb1a387),mix(color(0x4e6045),color(0x869073),macro),smoothstep(.2,2.3,positionWorld.y));
  groundMaterial.colorNode=mix(base,color(0x998974),pathMask.mul(.48)).mul(texture(stoneTexture,positionWorld.xz.mul(.13)).r.mul(.3).add(.72)).mul(noise.mul(.12).add(.91));
  const terrainRoot=new THREE.Group();scene.add(terrainRoot);
  for(const island of ISLANDS){const size=island.radius*2.4,geo=new THREE.PlaneGeometry(size,size,128,128).rotateX(-Math.PI/2);const pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i)+island.x,z=pos.getZ(i)+island.z;pos.setXYZ(i,x,terrain(x,z),z);}geo.computeVertexNormals();const land=mesh(terrainRoot,geo,groundMaterial);land.castShadow=false;
  }
  const waterMat=new THREE.MeshStandardNodeMaterial({roughness:.3,metalness:.2});
  const waves=sin(positionWorld.x.mul(.4).add(time.mul(.5))).mul(cos(positionWorld.z.mul(.25).sub(time.mul(.3))));
  waterMat.colorNode=mix(color(0x23464e),color(0x497578),waves.mul(.13).add(.45));
  waterMat.positionNode=positionLocal.add(vec3(0,0,sin(positionLocal.x.mul(.2).add(time.mul(.5))).mul(.09).add(cos(positionLocal.y.mul(.24).sub(time.mul(.35))).mul(.06))));
  const water=mesh(scene,new THREE.PlaneGeometry(2200,2200,120,120),waterMat,0,-.12,0);water.rotation.x=-Math.PI/2;water.castShadow=false;
  const rand=seeded(1849),dummy=new THREE.Object3D();
  // Instanced trees and grass keep the playable scene economical.
  const treePositions=[];for(const island of ISLANDS){for(let i=0;i<100;i++){const a=rand()*6.28,r=(.25+rand()*.65)*island.radius,x=island.x+Math.cos(a)*r,z=island.z+Math.sin(a)*r;
    if(terrain(x,z)<1||Math.hypot(x,z-18)<10||Math.hypot(x-7,z+16)<8||Math.hypot(x-112,z+48)<6||(Math.abs(x-112)<4&&z<-53&&z>-70)||(island.id==='echo'&&Math.abs(z+54)<4&&x>95&&x<131)||WRECKS.some(w=>Math.hypot(x-w.x,z-w.z)<6)||NODES.some(n=>Math.hypot(x-n.x,z-n.z)<1.5))continue;treePositions.push({x,z,h:5+rand()*5});}}
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.1,.28,1,7),materials.timber,treePositions.length);trunks.castShadow=true;scene.add(trunks);
  const foliageMat=new THREE.MeshStandardNodeMaterial({color:0x3e644c,roughness:.95,side:THREE.DoubleSide,vertexColors:true});
  foliageMat.positionNode=positionLocal.add(vec3(sin(time.mul(.65).add(positionWorld.x)).mul(positionLocal.y.max(0)).mul(.02),0,0));
  const foliage=new THREE.InstancedMesh(pineCrown(),foliageMat,treePositions.length);foliage.castShadow=true;scene.add(foliage);
  treePositions.forEach((p,i)=>{const y=terrain(p.x,p.z);dummy.position.set(p.x,y+p.h*.43,p.z);dummy.scale.set(.9,p.h*.86,.9);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
    dummy.position.set(p.x,y,p.z);dummy.scale.setScalar(p.h);dummy.rotation.y=i;dummy.updateMatrix();foliage.setMatrixAt(i,dummy.matrix);});
  const grassMat=new THREE.MeshStandardNodeMaterial({color:0x66745a,roughness:1,side:THREE.DoubleSide});grassMat.positionNode=positionLocal.add(vec3(sin(time.add(positionWorld.x)).mul(positionLocal.y).mul(.12),0,0));
  const grassGeo=new THREE.BufferGeometry();grassGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.025,0,0,.008,.35,0,.025,0,0, 0,0,-.025,0,.29,.01,0,0,.025],3));grassGeo.computeVertexNormals();const grass=new THREE.InstancedMesh(grassGeo,grassMat,1800);scene.add(grass);
  for(let i=0;i<1800;i++){const island=ISLANDS[i%5===0?1:0],a=rand()*6.28,r=Math.sqrt(rand())*island.radius*.8,x=island.x+Math.cos(a)*r,z=island.z+Math.sin(a)*r;dummy.position.set(x,terrain(x,z),z);dummy.rotation.set(0,rand()*6.28,0);dummy.scale.setScalar(terrain(x,z)>1.2?.5+rand()*.7:0);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);}
  const rocks=[];for(const island of ISLANDS){for(let i=0;i<22;i++){const a=rand()*6.28,r=(.64+rand()*.28)*island.radius,x=island.x+Math.cos(a)*r,z=island.z+Math.sin(a)*r;const size=1+rand()*2.5;const rock=mesh(scene,new THREE.DodecahedronGeometry(1,0),materials.stone,x,terrain(x,z)+size*.25,z);rock.scale.set(size,size*.65,size*.8);rock.rotation.set(rand(),rand()*6.28,rand());rocks.push({x,z,r:size*.75,y:terrain(x,z),height:size*1.5});}}
  // A fractured industrial arch frames the first rift, leaving its approach open.
  for(let side of [-1,1]){const x=7+side*6,z=-18,y=terrain(x,z);box(scene,1.2,9,1.3,materials.rust,x,y+4.5,z);box(scene,1.6,.4,1.7,materials.dark,x,y+8,z);}
  beam(scene,[1,12,-18],[13,12,-18],.3,materials.dark);
  const portals=[{id:'haven',x:7,z:-16,destination:'echo'},{id:'echo',x:112,z:-48,destination:'haven'}];
  portals.forEach(p=>{p.mesh=makePortal();p.mesh.position.set(p.x,terrain(p.x,p.z),p.z);if(p.id==='echo')p.mesh.rotation.y=Math.PI;scene.add(p.mesh);});
  for(let i=0;i<7;i++){const g=new THREE.Group(),x=-140+i*65,z=-200-Math.sin(i)*65,y=28+(i%3)*13;const r=15+i%3*7;
    const underside=new THREE.CylinderGeometry(r,r*.18,r*1.4,17,5);const pp=underside.attributes.position;for(let v=0;v<pp.count;v++){const px=pp.getX(v),pz=pp.getZ(v),a=Math.atan2(pz,px),variation=1+Math.sin(a*5+i)*.13;pp.setX(v,px*variation);pp.setZ(v,pz*variation);pp.setY(v,pp.getY(v)+Math.sin(a*3+i)*r*.12+Math.cos(a*7)*r*.05);}underside.computeVertexNormals();mesh(g,underside,materials.stone,0,-r*.7,0);
    cylinder(g,r*.84,r*.9,.7,groundMaterial,0,.1,0,17);for(const side of [-1,1]){box(g,2,8,2,materials.stone,side*4,4,0);const lintel=box(g,5,1.3,2,materials.stone,side*2.1,8.5,0);lintel.rotation.z=-side*.42;}box(g,2,4,2,materials.stone,-r*.55,2,3);g.position.set(x,y,z);scene.add(g);
  }
  const nodes=new Map();NODES.forEach(n=>{const o=makeNode(n);scene.add(o);nodes.set(n.id,o);});
  const setpieces=createSetpieces(scene),coast=createCoast(scene);setpieces.colliders.push(...coast.colliders);
  const buildings=new Map();
  const addBuilding=b=>{const g=makeBuilding(b.kind);g.position.set(b.x,level(b),b.z);g.rotation.y=b.rotation;scene.add(g);buildings.set(b.id,g);return g;};
  const removeBuilding=id=>{const g=buildings.get(id);if(!g)return;scene.remove(g);g.traverse(o=>o.geometry?.dispose());buildings.delete(id);};
  return {scene,portals,nodes,treePositions,rocks,buildings,addBuilding,removeBuilding,sun,ready:Promise.all([setpieces.ready,new GLTFLoader().loadAsync('survival/assets/cookset.glb').then(gltf=>{cooksetTemplate=gltf.scene;})]),setpieces,update(t,player,state){if(state){setpieces.update(t,state);coast.update(t,state);}for(const g of buildings.values())g.traverse(o=>{if(o.userData.rotate)o.rotation.y=t*.5;if(o.userData.settling){o.userData.born??=t;const age=t-o.userData.born;o.position.y=.18+(o.userData.baseY-.18)*Math.exp(-age*.6);o.rotation.z=Math.sin(age*2)*Math.exp(-age*.6)*.2;}if(o.userData.anchorField){o.userData.born??=t;const age=t-o.userData.born;const size=1+Math.min(age,5)*.45;o.scale.setScalar(size);o.material.opacity=.08+Math.exp(-age*.8)*.28;}if(o.userData.flame)o.scale.y=1+Math.sin(t*9)*.1;});if(player){const elevation=solarElevation(t),daylight=Math.max(0,elevation);sun.intensity=.3+daylight*3.4;ambient.intensity=.45+daylight*.85;sun.target.position.set(player.x,0,player.z);sun.position.set(player.x-70,Math.max(12,95*elevation),player.z+40);sun.target.updateMatrixWorld();sky.sunPosition.value.set(-.7,Math.max(-.08,elevation),.4).normalize();scene.fog.color.setRGB(.3+daylight*.38,.43+daylight*.35,.49+daylight*.31);}}};
}

export function playerCollides(world,s,x,y,z){
  for(const p of world.setpieces?.colliders||[])if(Math.hypot(x-p.x,z-p.z)<p.r+.25&&y<terrain(p.x,p.z)+p.height)return true;
  for(const b of s.buildings)if(moduleCollides(b,x,y,z))return true;
  for(const p of world.treePositions)if(Math.hypot(x-p.x,z-p.z)<.55&&y<terrain(p.x,p.z)+p.h)return true;
  for(const p of world.rocks)if(Math.hypot(x-p.x,z-p.z)<p.r+.28&&y<p.y+p.height)return true;
  for(const b of s.buildings){const dx=x-b.x,dz=z-b.z,c=Math.cos(b.rotation),sn=Math.sin(b.rotation),lx=dx*c-dz*sn,lz=dx*sn+dz*c,feet=y-terrain(b.x,b.z);
    if(b.kind==='shelter'){for(const px of [-1.7,1.7])for(const pz of [-1.5,1.5])if(Math.hypot(lx-px,lz-pz)<.38&&feet<2.5)return true;}
    if(b.kind==='bench'&&Math.abs(lx)<1.5&&Math.abs(lz)<.8&&feet<1.15)return true;
    if(b.kind==='anchor'&&Math.hypot(dx,dz)<.6&&feet<2.3)return true;
  }return false;
}
export function placementCheck(world,s,kind,x,z,player,pose={x,z,y:terrain(x,z),rotation:0}){const r=RECIPES[kind].radius,y=terrain(x,z);if(s.buildings.length>=250)return 'Construction limit reached';if(y<.65)return 'Choose dry ground';
  const modular=RECIPES[kind].modular,attachment=RECIPES[kind].attachment;const error=moduleError(s,kind,pose,player);if(error)return error;
  if(!attachment&&Math.hypot(x-player.x,z-player.z)<r+.6)return 'Leave room to stand';
  for(const a of [0,1.57,3.14,4.71])if(Math.abs(terrain(x+Math.cos(a)*r,z+Math.sin(a)*r)-y)>.85)return 'Find flatter ground';
  if(world.setpieces?.colliders.some(p=>Math.hypot(x-p.x,z-p.z)<r+p.r+1))return 'Leave the field station accessible';
  if(world.portals.some(p=>Math.hypot(x-p.x,z-p.z)<r+3))return 'Keep the rift approach clear';
  if(world.treePositions.some(p=>Math.hypot(x-p.x,z-p.z)<r+.4)||world.rocks.some(p=>Math.hypot(x-p.x,z-p.z)<r+p.r))return 'Too close to a tree or rock';
  if(NODES.some(n=>available(s,n)&&Math.hypot(x-n.x,z-n.z)<r+.6))return 'Gather this resource to clear a building spot';
  if(s.buildings.some(b=>{if(attachment&&(b.id===pose.supportId||RECIPES[b.kind].modular))return false;if(modular&&b.kind==='foundation')return false;if(modular&&RECIPES[b.kind].attachment)return false;return Math.hypot(x-b.x,z-b.z)<r+RECIPES[b.kind].radius;}))return 'Leave space between structures';return null;
}
