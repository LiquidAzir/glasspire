// Grounded masonry and biome detail, baked once per zone. Decoration is confined
// to existing blocked cells; it never invents collision on a walkable tile.
import * as THREE from 'three';
import {artModel} from './spire-art.js';
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
  let positions,colors;
  const scenery={props:[],rooms:[],floorDetails:0};
  const targets=[world.player,...(world.portals||[]),...(world.shrines||[]),...(world.npcs||[])].filter(Boolean);
  const clearTarget=(x,z,r=1.65)=>targets.every(p=>Math.hypot(p.x-x,p.y-z)>r);
  const rooms=world.kind==='dungeon'?(world.rooms||[]):[];
  const roomTiles=new Int16Array(W*H).fill(-1);
  rooms.forEach((r,i)=>{for(let z=Math.max(0,r.y);z<Math.min(H,r.y+r.h);z++)for(let x=Math.max(0,r.x);x<Math.min(W,r.x+r.w);x++)roomTiles[z*W+x]=i;});
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
  function chunkAt(x,z){
    const key=Math.floor(x/8)+':'+Math.floor(z/8);
    if(!chunks.has(key))chunks.set(key,{positions:[],colors:[]});
    ({positions,colors}=chunks.get(key));
  }
  // Bake the shared Blender triangles straight into the terrain chunk. This
  // adds scenery without a new material, mesh, draw call or disposable kit copy.
  function prop(name,x,z,scale=1,rotation=0,strict=false,lift=0){
    const mesh=artModel(name);if(!mesh)return false;
    const geo=mesh.geometry,p=geo.getAttribute('position'),c=geo.getAttribute('color'),idx=geo.index;
    const co=Math.cos(rotation),si=Math.sin(rotation),min=[Infinity,Infinity],max=[-Infinity,-Infinity];
    for(let i=0;i<p.count;i++){const px=x+scale*(p.getX(i)*co+p.getZ(i)*si),pz=z+scale*(-p.getX(i)*si+p.getZ(i)*co);min[0]=Math.min(min[0],px);min[1]=Math.min(min[1],pz);max[0]=Math.max(max[0],px);max[1]=Math.max(max[1],pz);}
    if(strict){
      if(!clearTarget(x,z,2.1))return false;
      for(let gz=Math.floor(min[1]);gz<=Math.floor(max[1]);gz++)for(let gx=Math.floor(min[0]);gx<=Math.floor(max[0]);gx++)if(gx<0||gz<0||gx>=W||gz>=H||floor(gx,gz))return false;
    }
    chunkAt(x,z);
    // Exterior alcoves also get a visible stone footing, so an authored arch in
    // otherwise unrendered blocked space never appears to hover over the void.
    if(strict&&lift===0)slab(min[0],min[1],max[0]-min[0],max[1]-min[1],-.06,.09,profile.floor,.78);
    for(let i=0;i<(idx?idx.count:p.count);i++){const n=idx?idx.getX(i):i;positions.push(x+scale*(p.getX(n)*co+p.getZ(n)*si),lift+scale*p.getY(n),z+scale*(-p.getX(n)*si+p.getZ(n)*co));colors.push(c.getX(n),c.getY(n),c.getZ(n));}
    if(strict)scenery.props.push({name,x,z,scale,rotation,lift,min,max});
    return true;
  }
  function ink(x,z,w,d,hex,k=1){quad([x,.038,z],[x+w,.038,z],[x+w,.038,z+d],[x,.038,z+d],hex,k);scenery.floorDetails++;}
  function floorDetail(x,z,r){
    if(!r||!clearTarget(x+.5,z+.5,1.25))return;
    const cx=r.cx+.5,cz=r.cy+.5,dx=x+.5-cx,dz=z+.5-cz;
    const edge=Math.min(x-r.x,r.x+r.w-1-x,z-r.y,r.y+r.h-1-z),q=hash(x,z,29),biome=world.biomeId;
    if(biome==='crypts'){
      // A broad funerary aisle and inset brass corner ornaments.
      if(Math.abs(dx)<1.1&&edge>0)ink(x+.08,z+.06,.84,.88,'#605e69',.67);
      if(Math.abs(dx)>1.3&&Math.abs(dx)<2.6&&edge>0)ink(x+.44,z,.055,1,profile.accent,.26);
    }else if(biome==='overgrowth'){
      // Large irregular moss banks follow room edges; open ground remains flat.
      if(edge<1.5&&q<.9)ink(x,z,1,1,'#677851',.38+q*.08);
      if(edge<2&&q<.22)ink(x+.08,z+.46,.81,.045,'#a08a61',.4);
    }else if(biome==='frostpeak'){
      if(edge<1.5&&q<.75)ink(x,z,1,1,'#a6c1ce',.26+q*.09);
      if(q<.13)ink(x+.24,z+.12,.035,.72,'#bde3e6',.48);
    }else if(biome==='infernal'){
      if((Math.abs(dx)<2&&Math.abs(dz)<2)||edge<1)ink(x+.04,z+.04,.92,.92,'#2c262d',.7);
      if(edge===1&&q<.65){ink(x+.16,z+.43,.67,.065,'#c47c45',.37);ink(x+.61,z+.28,.06,.3,'#c47c45',.31);}
    }else if(biome==='tempest'){
      if(edge<1&&q<.2)ink(x+.44,z+.08,.075,.84,profile.accent,.3);
    }else if(biome==='voidspire'){
      if(edge<1.1&&q<.5)ink(x+.15,z+.13,.7,.72,'#211d30',.7);
    }
  }
  // Clip flat scenery to actual floor cells. Broad, continuous shapes can cross
  // tile seams while respecting curved rooms, corridors and interaction clearings.
  function paint(poly,hex,k=1){
    const xs=poly.map(v=>v[0]),zs=poly.map(v=>v[1]);
    for(let z=Math.max(0,Math.floor(Math.min(...zs)));z<=Math.min(H-1,Math.floor(Math.max(...zs)));z++)for(let x=Math.max(0,Math.floor(Math.min(...xs)));x<=Math.min(W-1,Math.floor(Math.max(...xs)));x++){
      if(!floor(x,z)||!clearTarget(x+.5,z+.5,1.25))continue;
      let shape=poly;
      for(const [axis,limit,sign] of [[0,x,1],[0,x+1,-1],[1,z,1],[1,z+1,-1]]){
        const next=[];for(let i=0;i<shape.length;i++){const a=shape[i],b=shape[(i+1)%shape.length],aa=(a[axis]-limit)*sign>=0,bb=(b[axis]-limit)*sign>=0;if(aa)next.push(a);if(aa!==bb){const t=(limit-a[axis])/(b[axis]-a[axis]);next.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}shape=next;if(!shape.length)break;
      }
      if(shape.length<3)continue;chunkAt(x,z);color.set(hex).multiplyScalar(k);
      for(let i=1;i<shape.length-1;i++){const a=shape[0],b=shape[i],c=shape[i+1];if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<1e-7)continue;for(const v of [a,b,c]){positions.push(v[0],.041,v[1]);colors.push(color.r,color.g,color.b);}scenery.floorDetails++;}
    }
  }
  function stripe(ax,az,bx,bz,width,hex,k){const d=Math.hypot(bx-ax,bz-az),nx=-(bz-az)/d*width/2,nz=(bx-ax)/d*width/2;paint([[ax+nx,az+nz],[bx+nx,bz+nz],[bx-nx,bz-nz],[ax-nx,az-nz]],hex,k);}
  function ring(x,z,r,width,hex,k,segments=32,rotation=0){for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2+rotation,b=(i+1)/segments*Math.PI*2+rotation;paint([[x+Math.cos(a)*r,z+Math.sin(a)*r],[x+Math.cos(b)*r,z+Math.sin(b)*r],[x+Math.cos(b)*(r-width),z+Math.sin(b)*(r-width)],[x+Math.cos(a)*(r-width),z+Math.sin(a)*(r-width)]],hex,k);}}
  for(let z=0;z<H;z++)for(let x=0;x<W;x++){
    chunkAt(x,z);
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
      floorDetail(x,z,rooms[roomTiles[z*W+x]]);
    }else if(cell===1){
      const adjacent=floor(x-1,z)||floor(x+1,z)||floor(x,z-1)||floor(x,z+1);if(!adjacent)continue;
      slab(x,z,1,1,.83,.1,profile.edge,.72+hash(x,z)*.12);
      if(floor(x,z+1))face(x,z+1,1,0);
      if(floor(x,z-1))face(x,z,1,0);
      if(floor(x-1,z))face(x,z,0,1);
      if(floor(x+1,z))face(x+1,z,0,1);
      // Small architectural buttresses sit on the wall, not in corridors.
      const isolated=floor(x-1,z)&&floor(x+1,z)&&floor(x,z-1)&&floor(x,z+1);
      if(isolated&&world.kind!=='town')prop('crypt_pillar',x+.5,z+.5,.73,0,true);
      else if(hash(x,z,6)<.06)prop(world.kind==='town'?'crypt_pillar':profile.decor,x+.5,z+.5,.48,hash(x,z)*6.28);
    }else if(cell===2){
      slab(x+.08,z+.08,.84,.84,0,.1,profile.stone,.65);
      const name=world.kind==='town'?'brazier':world.biomeId==='crypts'?'sarcophagus':profile.decor;
      const size=world.kind==='town'?.62:name==='ruined_tree'?.58:name==='sarcophagus'?.58:name==='crypt_pillar'?.65:.8;
      if(artModel(name)){if(!prop(name,x+.5,z+.5,size,hash(x,z)*.3,world.kind!=='town'))slab(x+.23,z+.23,.54,.54,.1,.4,profile.stone);}
      else slab(x+.23,z+.23,.54,.54,.1,.4,profile.stone);
    }
  }
  // Large room-side compositions have a purpose and silhouette. Entire model
  // bounds must stay on existing masonry/solid decoration, never on player floor.
  // North-side landmarks are tallest; foreground side pieces stay below a hero.
  rooms.forEach((r,i)=>{
    const style=world.biomeId,base=scenery.props.length,cx=r.cx+.5,z=r.y-1.35;
    const cz=r.cy+.5;
    if(style==='crypts'){
      ring(cx,cz,2.05,.12,'#aba48b',.32);ring(cx,cz,1.7,.035,profile.accent,.42);
      for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])stripe(cx+Math.cos(a)*.4,cz+Math.sin(a)*.4,cx+Math.cos(a)*1.55,cz+Math.sin(a)*1.55,.11,'#99999c',.4);
    }else if(style==='tempest'){
      ring(cx,cz,2.9,.11,'#c1ac73',.45);ring(cx,cz,2.48,.035,'#c1ac73',.45);ring(cx,cz,1.35,.08,'#a7bac9',.32);
      for(let j=0;j<8;j++){const a=j*Math.PI/4;stripe(cx+Math.cos(a)*2.3,cz+Math.sin(a)*2.3,cx+Math.cos(a)*3.12,cz+Math.sin(a)*3.12,.06,'#c1ac73',.47);}
    }else if(style==='voidspire'){
      ring(cx,cz,2.7,.12,'#ae92b6',.36,4);ring(cx,cz,2.3,.04,'#ae92b6',.36,4);ring(cx,cz,1.45,.055,'#83788f',.38,8,Math.PI/8);
    }else if(style==='overgrowth'||style==='frostpeak'){
      const frost=style==='frostpeak';
      for(const side of [-1,1]){const x=r.x+(side<0?1:r.w-1),zz=cz+side*r.h*.25;for(let j=0;j<5;j++){const a=j*1.26;const xx=x+Math.cos(a)*.8,yy=zz+Math.sin(a)*1.15;paint([[xx-1.4,yy-.3],[xx-.55,yy-1.15],[xx+.8,yy-.88],[xx+1.35,yy+.3],[xx+.4,yy+1.0],[xx-1,yy+.95]],frost?'#9ab7c3':'#76905d',frost?.34+j*.025:.34+j*.018);}}
    }
    const primary={crypts:'broken_arch',overgrowth:'ruined_tree',frostpeak:'crystal_cluster',infernal:'obsidian_spires',tempest:'broken_arch',voidspire:'broken_arch'}[style];
    if(primary&&r.w>=7){
      const scale=primary==='broken_arch'?.88:primary==='ruined_tree'?.96:1.65;
      // Corridors may cut the nominal wall center. Find a real piece of masonry
      // beside that opening instead of losing the room's entire landmark.
      let landmarkX=cx;for(const offset of [0,-2,2,-4,4])if(prop(primary,cx+offset,z,scale,0,true)){landmarkX=cx+offset;break;}
      for(const side of [-1,1]){
        const xx=landmarkX+side*1.8;
        if(style==='crypts'){prop('sarcophagus',xx,z+.1,.78,Math.PI/2,true);prop('brazier',xx+side*.75,z+.1,.68,0,true);}
        else if(style==='overgrowth'){prop('ruined_tree',xx,z+.1,.69,side*.4,true);prop('stone_brick',xx+side*.55,z+.05,.7,side*.45,true);}
        else if(style==='frostpeak'){prop('crystal_cluster',xx,z+.1,1.05,side*.8,true);prop('stone_brick',xx+side*.6,z,.8,side*.25,true);}
        else if(style==='infernal'){prop('brazier',xx,z+.1,1.02,0,true);prop('obsidian_spires',xx+side*.55,z,.62,side*.9,true);}
        else if(style==='tempest'){prop('crypt_pillar',xx,z,.64,0,true);prop('crystal_cluster',xx+side*.65,z,.74,side*.4,true);}
        else {prop('obsidian_spires',xx,z,1.1,side*.65,true);prop('stone_brick',xx+side*.65,z,.6,side*.35,true);}
      }
    }
    // Low masonry piles articulate the other corners without screening combat.
    for(const side of [-1,1]){const x=r.x+(side<0?-.55:r.w+.55),zz=r.y+r.h-.9;for(let n=0;n<2;n++)prop('stone_brick',x,zz+n*.36,.58,side*.35+n*.6,true,n*.12);}
    // Paired side-wall exhibits stay in view even when an entrance corridor
    // occupies the back wall. They sit on the existing parapet, outside floor.
    for(const side of [-1,1]){
      const row=Math.max(r.y,Math.min(r.y+r.h-1,r.cy+side*2));
      const cells=[];for(let x=r.x;x<r.x+r.w;x++)if(floor(x,row))cells.push(x);
      if(!cells.length)continue;
      const xx=side<0?cells[0]-1:cells[cells.length-1]+1;
      if(xx<0||xx>=W||floor(xx,row))continue;
      const lift=grid[row][xx]===1?.92:0;
      const exhibit={crypts:['sarcophagus',.57],overgrowth:['ruined_tree',.61],frostpeak:['crystal_cluster',1.0],infernal:['brazier',.9],tempest:['crypt_pillar',.63],voidspire:['obsidian_spires',.94]}[style];
      if(exhibit)prop(exhibit[0],xx+.5,row+.5,exhibit[1],0,true,lift);
    }
    scenery.rooms.push({index:i,biome:style,props:scenery.props.length-base});
  });
  // Eight-tile chunks let the GPU skip rooms outside the view. A single mesh
  // for the entire dungeon submits every unseen room on every frame.
  const group=new THREE.Group();
  const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
  for(const chunk of chunks.values()){
    if(!chunk.positions.length)continue;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(chunk.positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(chunk.colors,3));geometry.computeBoundingSphere();
    group.add(new THREE.Mesh(geometry,material));
  }
  group.name='Spire scenery chunks';group.userData.scenery=scenery;
  return group;
}
