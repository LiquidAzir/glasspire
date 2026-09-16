// Grounded masonry and biome detail, baked once per zone. Decoration is confined
// to existing blocked cells; it never invents collision on a walkable tile.
import * as THREE from 'three';
import {artModel,compactObject} from './spire-art.js';
const PROFILES={
  town:{stone:'#646577',edge:'#a7a0a1',floor:'#464653',accent:'#d8ac64',decor:'brazier'},
  crypts:{stone:'#657484',edge:'#b4bcc2',floor:'#414d5a',accent:'#78cfda',decor:'crypt_pillar'},
  overgrowth:{stone:'#64796d',edge:'#a0ad85',floor:'#354840',accent:'#90c970',decor:'ruined_tree'},
  frostpeak:{stone:'#6689a2',edge:'#c9e7eb',floor:'#374f65',accent:'#97e1f1',decor:'crystal_cluster'},
  infernal:{stone:'#66505b',edge:'#b89c86',floor:'#483b40',accent:'#f78b4f',decor:'obsidian_spires'},
  tempest:{stone:'#616c95',edge:'#b4c6de',floor:'#384354',accent:'#9dadff',decor:'crystal_cluster'},
  voidspire:{stone:'#70617e',edge:'#baa7cc',floor:'#3c354c',accent:'#bd91e9',decor:'obsidian_spires'},
};
const hash=(x,y,s=0)=>(((x*73856093)^(y*19349663)^(s*83492791))>>>0)%10000/10000;
export function buildWorldArt(world){
  const profile=PROFILES[world.kind==='town'?'town':world.biomeId]||PROFILES.crypts;
  const {grid,w:W,h:H}=world,chunks=new Map();
  let positions,colors,props;
  const color=new THREE.Color();
  const floor=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&grid[y][x]===0;
  function quad(a,b,c,d,hex,k=1){color.set(hex).multiplyScalar(k);for(const v of [a,b,c,a,c,d]){positions.push(...v);colors.push(color.r,color.g,color.b);}}
  function slab(x,z,w,d,y,height,hex,k=1){
    const inset=.045,top=y+height;
    quad([x+inset,top,z+inset],[x+w-inset,top,z+inset],[x+w-inset,top,z+d-inset],[x+inset,top,z+d-inset],hex,k);
    quad([x,y,z],[x+w,y,z],[x+w-inset,top,z+inset],[x+inset,top,z+inset],hex,k*.65);
    quad([x+w,y,z],[x+w,y,z+d],[x+w-inset,top,z+d-inset],[x+w-inset,top,z+inset],hex,k*.72);
    quad([x+w,y,z+d],[x,y,z+d],[x+inset,top,z+d-inset],[x+w-inset,top,z+d-inset],hex,k*.9);
    quad([x,y,z+d],[x,y,z],[x+inset,top,z+inset],[x+inset,top,z+d-inset],hex,k*1.1);
  }
  function face(x,z,dx,dz){
    // Three offset mortar courses with a subtle bevel catch on every stone.
    for(let row=0;row<3;row++)for(let part=0;part<2;part++){
      const a=part*.5+.018,b=(part+1)*.5-.018,lo=row*.28+.025,hi=lo+.245;
      const k=(dx? .84:.64)*(1+hash(x+part,z,row)*.24);
      quad([x+dx*a,lo,z+dz*a],[x+dx*b,lo,z+dz*b],[x+dx*b,hi,z+dz*b],[x+dx*a,hi,z+dz*a],profile.stone,k);
      quad([x+dx*a,hi-.025,z+dz*a],[x+dx*b,hi-.025,z+dz*b],[x+dx*b,hi,z+dz*b],[x+dx*a,hi,z+dz*a],profile.edge,.55);
    }
  }
  function prop(name,x,z,scale=1,rotation=0){const mesh=artModel(name);if(!mesh)return;mesh.position.set(x,0,z);mesh.scale.setScalar(scale);mesh.rotation.y=rotation;props.add(mesh);}
  for(let z=0;z<H;z++)for(let x=0;x<W;x++){
    const chunkKey=Math.floor(x/8)+':'+Math.floor(z/8);
    if(!chunks.has(chunkKey))chunks.set(chunkKey,{positions:[],colors:[],props:new THREE.Group()});
    ({positions,colors,props}=chunks.get(chunkKey));
    const cell=grid[z][x];
    if(cell===0){
      const edge=(!floor(x-1,z)||!floor(x+1,z)||!floor(x,z-1)||!floor(x,z+1));
      const light=(edge?.65:.9)+hash(x,z,5)*.16;
      quad([x,0,z],[x+1,0,z],[x+1,0,z+1],[x,0,z+1],profile.floor,.48);
      // Flat tops remain flush with collision; bevels and directional colour give
      // depth without raised lips that suggest an impassable obstruction.
      slab(x+.018,z+.018,.964,.964,.001,.027,profile.floor,light);
      // Sparse mineral chips / inlay. Never a glowing repeated pattern on every cell.
      if(hash(x,z,8)<.075){const ox=.2+hash(x,z,3)*.5,oz=.2+hash(x,z,4)*.5;quad([x+ox,.032,z+oz],[x+ox+.16,.032,z+oz+.02],[x+ox+.11,.032,z+oz+.045],[x+ox-.04,.032,z+oz+.025],profile.accent,.6);}
      if(world.kind==='town'&&(x===10||z===8)){quad([x+.46,.034,z+.12],[x+.51,.034,z+.12],[x+.51,.034,z+.88],[x+.46,.034,z+.88],profile.accent,.55);}
    }else if(cell===1){
      const adjacent=floor(x-1,z)||floor(x+1,z)||floor(x,z-1)||floor(x,z+1);if(!adjacent)continue;
      slab(x,z,1,1,.83,.1,profile.edge,.72+hash(x,z)*.12);
      if(floor(x,z+1))face(x,z+1,1,0);
      if(floor(x,z-1))face(x,z,1,0);
      if(floor(x-1,z))face(x,z,0,1);
      if(floor(x+1,z))face(x+1,z,0,1);
      // Small architectural buttresses sit on the wall, not in corridors.
      if(hash(x,z,6)<.06)prop(world.kind==='town'?'crypt_pillar':profile.decor,x+.5,z+.5,.48,hash(x,z)*6.28);
    }else if(cell===2){
      slab(x+.08,z+.08,.84,.84,0,.1,profile.stone,.65);
      const name=world.kind==='town'?'brazier':profile.decor;
      if(artModel(name))prop(name,x+.5,z+.5,name==='ruined_tree'?.36:name==='crypt_pillar'?.45:.62,hash(x,z)*6.28);
      else slab(x+.23,z+.23,.54,.54,.1,.4,profile.stone);
    }
  }
  // Eight-tile chunks let the GPU skip rooms outside the view. A single mesh
  // for the entire dungeon submits every unseen room on every frame.
  const group=new THREE.Group();
  const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
  for(const chunk of chunks.values()){
    if(!chunk.positions.length)continue;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(chunk.positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(chunk.colors,3));geometry.computeBoundingSphere();
    group.add(new THREE.Mesh(geometry,material));
    if(chunk.props.children.length){const merged=compactObject(chunk.props);merged.traverse(o=>{if(o.isMesh)o.material=o.material.clone();});group.add(merged);}
  }
  return group;
}
