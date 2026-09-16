// Original Blender kit + compact rendering of legacy models. No runtime lighting,
// textures, network dependencies, or shadow maps are required.
import * as THREE from 'three';
const models=new Map(), compactCache=new Map();
const opaque=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
const additive=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
const translucent=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,depthWrite:false});
let ready=false;
export async function loadArt(){
  try{
    const response=await fetch(new URL('./assets/spire-kit.json',import.meta.url));
    if(!response.ok)throw new Error('Art response '+response.status);
    const kit=await response.json();
    for(const [name,data] of Object.entries(kit.models)){
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.position,3));
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(data.color,3));
      if(data.normal)geometry.setAttribute('normal',new THREE.Float32BufferAttribute(data.normal,3));
      if(data.index)geometry.setIndex(data.index);
      geometry.computeBoundingSphere();models.set(name,geometry);
    }
    ready=true;return true;
  }catch(error){console.warn('[Art] Using existing models:',error.message);return false;}
}
export function artReady(){return ready;}
export function artModel(name){const geometry=models.get(name);return geometry?new THREE.Mesh(geometry,opaque):null;}

// Bake static components into opaque/additive/translucent GPU submissions. Cached
// geometry belongs to the kit, so entity removal must not dispose these meshes.
export function compactObject(source){
  source.updateMatrixWorld(true);
  const buckets=[{p:[],c:[]},{p:[],c:[]},{p:[],c:[]}],v=new THREE.Vector3(),color=new THREE.Color();
  source.traverseVisible(o=>{
    if(!o.isMesh||!o.visible||!o.geometry||Array.isArray(o.material))return;
    const material=o.material,geometry=o.geometry,position=geometry.getAttribute('position');
    if(!position||!material)return;
    const colors=geometry.getAttribute('color'),index=geometry.index;
    const isAdd=material.blending===THREE.AdditiveBlending;
    const bucket=buckets[isAdd?1:material.transparent?2:0],count=index?index.count:position.count;
    for(let i=0;i<count;i++){
      const n=index?index.getX(i):i;
      v.fromBufferAttribute(position,n).applyMatrix4(o.matrixWorld);bucket.p.push(v.x,v.y,v.z);
      color.copy(material.color||new THREE.Color(1,1,1));
      if(material.vertexColors&&colors)color.multiply(new THREE.Color(colors.getX(n),colors.getY(n),colors.getZ(n)));
      const alpha=(material.transparent?material.opacity:1)*(material.vertexColors&&colors&&colors.itemSize===4?colors.getW(n):1);
      // Alpha must remain separate from linear RGB: baking opacity into RGB
      // brightens glows incorrectly after the display's sRGB conversion.
      bucket.c.push(color.r,color.g,color.b,alpha);
    }
  });
  const group=new THREE.Group();
  for(let i=0;i<buckets.length;i++){const b=buckets[i];if(!b.p.length)continue;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,4));g.computeBoundingSphere();group.add(new THREE.Mesh(g,[opaque,additive,translucent][i]));}
  return group;
}
export function compactBuilder(name,builder,opts={}){
  const key=name+'|'+JSON.stringify(opts);let cached=compactCache.get(key);
  if(!cached){cached=compactObject(builder(opts));compactCache.set(key,cached);}
  return cached.clone();
}
export function releaseCompact(group){if(group)group.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
export function buildHero(classId){
  if(!models.has('hero_core_'+classId))return null;
  const group=new THREE.Group();group.add(artModel('hero_core_'+classId));
  const legs=[],arms=[];
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(side*.14,.56,0);const lm=artModel('hero_leg');if(lm)leg.add(lm);group.add(leg);legs.push(leg);
    const arm=new THREE.Group();arm.position.set(side*.35,1.05,0);const am=artModel('hero_arm_'+classId)||artModel('hero_arm_warrior');if(am)arm.add(am);group.add(arm);arms.push(arm);
  }
  const mount=(x,y,z)=>{const m=new THREE.Object3D();m.position.set(x,y,z);group.add(m);return m;};
  // Equipment remains independent: every existing drop/transmog keeps its look.
  const weaponMount=new THREE.Object3D();weaponMount.position.set(0,-.465,.04);arms[1].add(weaponMount);
  const headHeight={warrior:1.68,mage:1.6931,ranger:1.5045,summoner:1.574,paladin:1.65}[classId]||1.65;
  group.userData={legs,arms,bakedArt:true,weaponMount,backMount:mount(0,.98,-.19),headMount:mount(0,headHeight,0),chestMount:mount(0,1,.19),auraMount:mount(0,.02,0)};
  return group;
}
export function artStats(){return{ready,models:models.size,legacyModels:compactCache.size};}

const gateMaterials=new Map();
export function buildGate(color){
  const arch=artModel('portal_frame');if(!arch)return null;
  const group=new THREE.Group();arch.scale.setScalar(.72);group.add(arch);
  let gate=gateMaterials.get(color);
  if(!gate){gate={geometry:new THREE.CircleGeometry(.56,20),material:new THREE.MeshBasicMaterial({color,transparent:true,opacity:.24,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide})};gateMaterials.set(color,gate);}
  const veil=new THREE.Mesh(gate.geometry,gate.material);veil.position.set(0,.94,-.025);veil.scale.y=1.3;group.add(veil);
  return group;
}
