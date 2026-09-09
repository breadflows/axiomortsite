import * as THREE from 'three/webgpu';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FIELD_DEVICE,MEMORY} from './chapter.js';
import {terrain} from './state.js';

export function createSetpieces(scene){
 const stone=new THREE.MeshStandardMaterial({color:0x343b3e,roughness:.88}),metal=new THREE.MeshStandardMaterial({color:0x554735,metalness:.65,roughness:.5}),wood=new THREE.MeshStandardMaterial({color:0x766047,roughness:.9}),ink=new THREE.MeshStandardMaterial({color:0x070c14,metalness:.48,roughness:.2}),light=new THREE.MeshStandardMaterial({color:0xbaaed4,emissive:0x7666b0,emissiveIntensity:1.3});
 const objects=[],drifting=[],colliders=[];
 const cube=(group,x,y,z,w,h,d,mat)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
 const field=new THREE.Group();field.position.set(FIELD_DEVICE.x,terrain(FIELD_DEVICE.x,FIELD_DEVICE.z),FIELD_DEVICE.z);scene.add(field);
 cube(field,0,1,0,1.7,.12,.75,wood);for(const x of [-.65,.65])for(const z of [-.27,.27])cube(field,x,.5,z,.09,1,.09,metal);
 cube(field,-.6,1.16,0,.25,.22,.32,metal);cube(field,.45,1.075,0,.3,.025,.35,new THREE.MeshStandardMaterial({color:0xc6bb9d,roughness:1}));
 const lamp=new THREE.PointLight(0xffd9aa,5,5);lamp.position.set(.3,2.2,.5);field.add(lamp);
 colliders.push({x:FIELD_DEVICE.x,z:FIELD_DEVICE.z,r:.8,height:1.2});
 const ruin=new THREE.Group();ruin.position.set(MEMORY.x,terrain(MEMORY.x,MEMORY.z),MEMORY.z);scene.add(ruin);
 cube(ruin,0,.25,0,5,.5,4,stone);cube(ruin,0,.83,0,1.2,1.2,1,stone);
 for(const side of [-1,1]){cube(ruin,side*3,2.6,-1,1,5.2,1.2,stone);const beam=cube(ruin,side*1.55,5.3,-1,3.4,.7,1.2,stone);beam.rotation.z=-side*.38;}
 // Nested lancet ribs echo the film's lunar-gothic silhouettes.
 for(const side of [-1,1])for(let layer=0;layer<3;layer++){
  const width=3.2+layer*.34,curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(side*width,1,-1-layer*.25),new THREE.Vector3(side*width,5.4,-1-layer*.25),new THREE.Vector3(side*.12,7.1+layer*.28,-1-layer*.25));
  const rib=new THREE.Mesh(new THREE.TubeGeometry(curve,22,.15,6,false),stone);rib.castShadow=true;rib.receiveShadow=true;ruin.add(rib);
 }
 for(const side of [-1,1])for(const y of [.35,1,4.6])cube(ruin,side*3,y,-1,1.35,.22,1.6,metal);
 // Broken masonry floats within the Ink disturbance, leaving the walking route open.
 for(let n=0;n<12;n++){const a=n/12*Math.PI*2,r=2.7+(n%3)*.4;const m=cube(ruin,Math.cos(a)*r,1.5+(n%4)*.5,Math.sin(a)*r,.35+(n%3)*.12,.25,.35,ink);m.rotation.set(n*.6,n*.3,n);drifting.push({mesh:m,y:m.position.y,phase:n});}
 const record=new THREE.Mesh(new THREE.OctahedronGeometry(.23),light);record.position.set(0,1.7,0);ruin.add(record);
 const glow=new THREE.PointLight(0xa297e4,4,9);glow.position.set(0,2,0);ruin.add(glow);
 // A readable spine of stones leads away from the arrival rift.
 for(let z=-56;z>-62;z-=1.5){const step=new THREE.Mesh(new THREE.BoxGeometry(1.4,.16,.8),stone);step.position.set(112,terrain(112,z)+.06,z);scene.add(step);}
 const ready=new GLTFLoader().loadAsync('survival/assets/axio.glb').then(gltf=>{const axio=gltf.scene;axio.scale.setScalar(2.1);axio.position.set(0,1.09,0);field.add(axio);axio.traverse(o=>{if(o.isMesh){o.castShadow=!o.material.transparent;o.receiveShadow=true;if(o.material.transparent){o.material.depthWrite=false;o.material.opacity=.23;}}});objects.push(axio);return true;});
 return {ready,colliders,update(time,state){for(const d of drifting){d.mesh.position.y=d.y+(state.chapter.recovered?0:Math.sin(time*.85+d.phase)*.32);if(!state.chapter.recovered)d.mesh.rotation.y+=.002;}record.visible=!state.chapter.recovered;glow.intensity=state.chapter.recovered?.6:3+Math.sin(time*2)*.5;},field,ruin};
}
