"""Original HollowLight art. Run Blender --background --python this_file.

Logical coordinates are Three.js (+Y up, +Z front). All detail is mesh geometry.
Directional light and local ray-traced ambient occlusion are baked into linear
vertex colors. Runtime needs one MeshBasicMaterial per tint, no lights/textures.
"""
import bpy, bmesh, math, json, random, os, gzip
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'
SOURCE = ROOT / 'art-source'
REVIEW = ROOT.parent / '.visual-review' / 'spire' / 'art'
for p in [OUT, SOURCE, REVIEW]: p.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
RNG = random.Random(91125)
MATS, PARTS, MODELS, META = {}, [], {}, {}

def cv(p): return (p[0], -p[2], p[1])
def linear(v): return v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4
def material(name, color):
    c = tuple(linear(int(color[i:i+2],16)/255) for i in [0,2,4])
    m = bpy.data.materials.new(name); m.diffuse_color = (*c,1)
    m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*c,1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .77
    MATS[name] = m
for name, color in {
    'stone':'83929D', 'stone_light':'B5B8AC', 'stone_dark':'566371',
    'recess':'303D50', 'iron':'506073', 'steel':'9FAFBA', 'steel_edge':'D7DACE',
    'bronze':'A27E44', 'gold':'D9B565', 'gold_light':'F1D793',
    'wood':'71513B', 'wood_light':'967147', 'wood_dark':'473D34',
    'leather':'655342', 'leather_light':'9A7A50', 'bone':'C7BC97',
    'bone_light':'E3D8B4', 'bone_dark':'898872', 'skin':'BD9779',
    'eye':'FFDCA1', 'ember':'F7AA5B', 'fire':'FFE8AE',
    'crystal':'718CE0', 'crystal_light':'AACDE5', 'crystal_dark':'405479',
    'obsidian':'55516B', 'obsidian_edge':'9790B6', 'lava':'DA7A46',
    'moss':'71836A', 'bark':'686054', 'bark_light':'A19573',
    'warrior':'687B93', 'warrior_dark':'485568', 'red':'986356',
    'mage':'617CB1', 'mage_light':'819ACA', 'ranger':'657F65',
    'ranger_light':'91A183', 'summoner':'847293', 'summoner_light':'B0A0B7',
    'ghoul':'839B87', 'ghoul_dark':'536D68', 'wraith':'7696A9',
    'wraith_light':'A1C6CF', 'wraith_dark':'405A6B',
}.items(): material(name,color)

def mesh(name, verts, faces, mat, palette=None):
    me=bpy.data.meshes.new(name); me.from_pydata([cv(v) for v in verts],[],faces); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o)
    names=list(dict.fromkeys(palette or [mat]))
    for n in names: me.materials.append(MATS[n])
    if palette:
        for p,n in zip(me.polygons,palette): p.material_index=names.index(n)
    PARTS.append(o); return o

def cloth(name,verts,faces,mat):
    o=mesh(name,verts,faces,mat)
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('Cloth thickness and visible hem','SOLIDIFY');mod.thickness=.010;mod.offset=0
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def box(name, loc, size, mat, bevel=0):
    x,y,z=loc; a,b,c=[v/2 for v in size]
    vs=[(x+sx*a,y+sy*b,z+sz*c) for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]]
    o=mesh(name,vs,[(0,1,2,3),(7,6,5,4),(4,5,1,0),(5,6,2,1),(6,7,3,2),(7,4,0,3)],mat)
    if bevel:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('Hand-cut bevel','BEVEL'); mod.width=bevel; mod.segments=1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def beam(name,a,b,width,mat,depth=None):
    a,b=Vector(a),Vector(b); axis=(b-a).normalized()
    ref=Vector((0,0,1)) if abs(axis.z)<.9 else Vector((1,0,0))
    u=axis.cross(ref).normalized()*width/2; v=u.normalized().cross(axis).normalized()*(depth or width)/2
    return mesh(name,[tuple(p+s*u+t*v) for p in [a,b] for s,t in [(-1,-1),(1,-1),(1,1),(-1,1)]],[(0,1,2,3),(7,6,5,4),(4,5,1,0),(5,6,2,1),(6,7,3,2),(7,4,0,3)],mat)

def rings(name, sections, mat, n=8, loc=(0,0,0), phase=math.pi/8):
    # y, x radius, z radius, optional x/z offsets.
    vs=[]
    for s in sections:
        yy,rx,rz=s[:3]; ox,oz=s[3:] if len(s)>3 else (0,0)
        vs += [(loc[0]+ox+math.cos(phase+i*2*math.pi/n)*rx,loc[1]+yy,loc[2]+oz+math.sin(phase+i*2*math.pi/n)*rz) for i in range(n)]
    fs=[tuple(reversed(range(n))),tuple(range((len(sections)-1)*n,len(sections)*n))]
    for j in range(len(sections)-1):
        fs += [(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for i in range(n)]
    return mesh(name,vs,fs,mat)

def cyl(name,loc,r,h,mat,n=8,rt=None):
    return rings(name,[(-h/2,r,r),(h/2,r if rt is None else rt,r if rt is None else rt)],mat,n,loc)

def ico(name,loc,size,mat,sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=cv(loc))
    o=bpy.context.object; o.name=name
    for v in o.data.vertices: v.co.x*=size[0];v.co.y*=size[2];v.co.z*=size[1]
    o.data.materials.append(MATS[mat]); PARTS.append(o);return o

def slab(name,outline,depth,z,mat):
    vs=[(x,y,z+dz) for dz in [-depth/2,depth/2] for x,y in outline]; n=len(outline)
    fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,vs,fs,mat)

def arc(name,points,width,depth,mat):
    # Separate wedge voussoirs preserve open Gothic apertures.
    for i,(a,b) in enumerate(zip(points,points[1:])):
        aa,bb=Vector(a),Vector(b);mid=(aa+bb)/2;delta=(bb-aa)*.48
        beam(name+' stone '+str(i),tuple(mid-delta),tuple(mid+delta),width,mat,depth)

def gem(name,loc,r,h,mat='crystal',n=5):
    x,y,z=loc
    return rings(name,[(0,r*.8,r*.8),(.12*h,r,r),(.69*h,r*.85,r*.85),(h,.006,.006)],mat,n,(x,y,z))

def skull(loc=(0,0,0),scale=1,mat='bone'):
    x,y,z=loc; s=scale
    rings('carved cranium',[(-.10*s,.11*s,.095*s),(.0,.155*s,.118*s),(.16*s,.15*s,.12*s),(.22*s,.07*s,.07*s)],mat,8,(x,y,z))
    for side in [-1,1]:
        slab('deep angular eye socket',[(x+side*.072*s-.042*s,y+.066*s),(x+side*.072*s+.042*s,y+.066*s),(x+side*.072*s+.034*s,y-.002*s),(x+side*.072*s-.027*s,y-.017*s)],.012*s,z+.116*s,'recess')
        beam('skull heavy brow',(x+side*.025*s,y+.081*s,z+.124*s),(x+side*.121*s,y+.073*s,z+.10*s),.032*s,mat)
    slab('nasal cavity',[(x,y+.012*s),(x+.03*s,y-.05*s),(x-.03*s,y-.05*s)],.008*s,z+.133*s,'recess')
    box('jaw shadow',(x,y-.076*s,z+.07*s),(.16*s,.05*s,.05*s),'bone_dark')
    for i in range(4): box('individual teeth',(x+(i-1.5)*.034*s,y-.080*s,z+.110*s),(.026*s,.052*s,.034*s),'bone_light')

def finish(name,role='prop',pivot=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in PARTS:o.select_set(True)
    bpy.context.view_layer.objects.active=PARTS[0]
    if len(PARTS)>1:bpy.ops.object.join()
    o=bpy.context.object; o.name=name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    if role in ['prop','creature']:
        ground=min(v.co.z for v in o.data.vertices)
        for v in o.data.vertices:v.co.z-=ground
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
    MODELS[name]=o;META[name]={'role':role,'pivot':pivot or 'feet: ground Y=0'};PARTS.clear()
    return o

def crypt_pillar():
    box('square chamfered footing',(0,.06,0),(.83,.12,.83),'stone_dark',.035)
    box('beveled plinth',(0,.17,0),(.72,.12,.72),'stone_light',.035)
    rings('octagonal Gothic shaft',[(.23,.31,.31),(.34,.265,.265),(1.74,.235,.235),(1.86,.29,.29)],'stone',8)
    for a in [0,math.pi/2,math.pi,3*math.pi/2]:
        x,z=math.sin(a),math.cos(a)
        beam('recessed shaft fluting',(x*.237,.40,z*.237),(x*.213,1.72,z*.213),.06,'stone_dark',.04)
    rings('carved capital',[(1.80,.27,.27),(1.90,.35,.35),(2.02,.36,.36),(2.08,.40,.40)],'stone_light',8)
    for x in [-.25,.25]:
        for z in [-.25,.25]: gem('capital pointed finial',(x,2.04,z),.083,.20,'stone',4)
    skull((0,1.84,.302),.55)
    box('broken cornice',(0,2.10,0),(.83,.12,.83),'stone',.028)
    finish('crypt_pillar')

def broken_arch():
    for side in [-1,1]:
        x=side*.83
        box('arch foundation',(x,.08,0),(.52,.16,.68),'stone_dark',.035)
        for j in range(4):box('jointed pier',(x,.29+j*.27,0),(.31,.25,.45),'stone' if j%2 else 'stone_light',.018)
        box('arch spring capital',(x,1.32,0),(.44,.13,.59),'stone_light',.02)
    points=[(-.83,1.38,0),(-.73,1.64,0),(-.56,1.9,0),(-.34,2.16,0),(0,2.43,0),(.34,2.16,0),(.56,1.9,0)]
    arc('pointed arch',points,.25,.44,'stone')
    # Right side deliberately fractured, with matching fallen voussoirs.
    for x,z,a in [(.55,.31,.28),(.86,.52,-.35)]:
        o=box('fallen arch block',(x,.11,z),(.24,.21,.40),'stone_light',.018);o.rotation_euler.z=a
    finish('broken_arch')

def sarcophagus():
    box('coffin stepped footing',(0,.09,0),(.82,.18,1.50),'stone_dark',.045)
    box('carved stone coffin',(0,.30,0),(.70,.30,1.33),'stone',.065)
    box('overhanging beveled lid',(0,.49,0),(.83,.16,1.50),'stone_light',.060)
    for z in [-.47,0,.47]:
        for x in [-.363,.363]:box('coffin inset panels',(x,.31,z),(.014,.15,.30),'stone_dark',.01)
    # Effigy is sculpted relief lying along the slab rather than painted glyph.
    ico('sleeping knight head',(0,.615,-.48),(.105,.085,.13),'stone_light',1)
    rings('effigy chest armor',[(.56,.13,.23),(.63,.16,.22),(.71,.095,.17)],'stone',8,(0,0,-.1))
    for x in [-.075,.075]: beam('effigy greave',(x,.60,.1),(x,.59,.51),.11,'stone')
    beam('effigy sword',(0,.74,-.28),(0,.67,.48),.04,'steel')
    beam('effigy hands',(-.16,.66,-.12),(.16,.66,-.12),.067,'stone_light')
    finish('sarcophagus')

def chest():
    box('chest dark frame',(0,.19,0),(.77,.34,.49),'wood_dark',.025)
    for j in range(5):box('front oak stave',(-.292+j*.146,.19,.253),(.135,.30,.024),'wood' if j%2 else 'wood_light')
    # Barrel-vault lid built as five connected bevel-colored faces.
    cross=[(-.26,.35),(-.23,.47),(-.13,.55),(0,.59),(.13,.55),(.23,.47),(.26,.35)]
    vs=[(x,y,z) for x in [-.39,.39] for z,y in cross];n=len(cross)
    mesh('arched oak lid',vs,[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(i,i+1,i+1+n,i+n) for i in range(n-1)],'wood_light')
    for x in [-.29,.29]:
        for (z1,y1),(z2,y2) in zip(cross,cross[1:]):beam('lid forged strap',(x,y1+.008,z1),(x,y2+.008,z2),.053,'iron')
        box('chest front strap',(x,.2,.274),(.058,.34,.037),'iron')
        for y in [.085,.3]: ico('brass rivet',(x,y,.30),(.022,.022,.012),'gold',1)
    box('brass lock housing',(0,.325,.29),(.14,.14,.055),'bronze',.018)
    slab('keyhole',[(0,.37),(.020,.34),(.008,.31),(.022,.29),(-.022,.29),(-.008,.31),(-.020,.34)],.008,.322,'recess')
    finish('chest')

def flame(loc,scale=1):
    x,y,z=loc
    rings('angular golden flame',[(0,.10*scale,.10*scale),(.15*scale,.12*scale,.09*scale),(.29*scale,.065*scale,.065*scale,.04*scale,0),(.49*scale,.003,.003,-.02*scale,0)],'ember',5,(x,y,z))
    gem('white-hot flame core',(x,y,z+.07*scale),.055*scale,.29*scale,'fire',4)

def brazier():
    cyl('octagonal pedestal',(0,.065,0),.29,.13,'stone_dark',8)
    rings('fluted brazier stand',[(.12,.15,.15),(.22,.11,.11),(.62,.085,.085),(.73,.13,.13)],'iron',6)
    rings('forged cup',[(.66,.09,.09),(.79,.25,.25),(.86,.25,.25),(.88,.21,.21),(.80,.16,.16)],'bronze',8)
    cyl('glowing coal bed',(0,.81,0),.18,.02,'lava',8)
    for i in range(4):
        a=i*math.pi/2;beam('brazier iron claw',(math.sin(a)*.23,.80,math.cos(a)*.23),(math.sin(a)*.18,1.01,math.cos(a)*.18),.042,'iron')
    flame((0,.83,0),.83)
    finish('brazier')

def altar():
    box('altar bottom stair',(0,.06,0),(1.22,.12,.86),'stone_dark',.03)
    for x in [-.43,.43]:
        rings('altar tapered pedestal',[(.12,.145,.21),(.21,.12,.17),(.59,.12,.17),(.69,.18,.23)],'stone',6,(x,0,0))
    box('heavy sacrificial slab',(0,.73,0),(1.28,.16,.84),'stone_light',.042)
    box('linen runner',(0,.821,.04),(.34,.016,.66),'red')
    slab('hanging altar cloth',[(-.17,.82),(.17,.82),(.17,.40),(0,.32),(-.17,.40)],.012,.423,'red')
    skull((0,.51,.439),.37,'gold')
    for x in [-.43,.43]:
        cyl('candle saucer',(x,.829,-.09),.085,.026,'bronze',7)
        cyl('wax candle',(x,.94,-.09),.039,.20,'bone_light',7);flame((x,1.042,-.09),.26)
    box('bound ritual book',(0,.844,-.02),(.27,.035,.26),'wood_dark',.006)
    box('open parchment',(0,.866,-.02),(.24,.012,.24),'bone_light')
    finish('altar')

def shrine():
    rings('shrine pedestal',[(0,.40,.34),(.11,.40,.34),(.17,.32,.28),(.65,.27,.24),(.75,.35,.30)],'stone',8)
    box('shrine back',(0,1.02,-.115),(.62,.60,.17),'stone_dark',.03)
    pts=[(-.36,.78,0),(-.36,1.16,0),(-.22,1.45,0),(0,1.67,0),(.22,1.45,0),(.36,1.16,0),(.36,.78,0)]
    arc('shrine pointed niche',pts,.12,.26,'stone_light')
    gem('sacred suspended crystal',(0,.90,.064),.12,.45,'crystal_light',5)
    for s in [-1,1]:
        beam('shrine rune chevron',(s*.21,1.12,.11),(0,1.35,.11),.018,'gold')
    skull((0,.48,.271),.70)
    finish('shrine')

def portal():
    for s in [-1,1]:
        x=s*.83
        box('portal massive foot',(x,.10,0),(.57,.20,.76),'stone_dark',.04)
        rings('portal armored pier',[(.20,.20,.24),(.33,.17,.20),(1.59,.17,.20),(1.73,.24,.27)],'stone',8,(x,0,0))
        for y in [.52,.89,1.27]:
            slab('portal incised rune',[(x-.04,y-.065),(x+.04,y),(x-.04,y+.065)],.016,.204,'crystal_light')
    pts=[(-.83,1.66,0),(-.70,1.97,0),(-.43,2.29,0),(0,2.61,0),(.43,2.29,0),(.70,1.97,0),(.83,1.66,0)]
    arc('portal stone crown',pts,.29,.46,'stone_light')
    gem('portal crown keystone',(0,2.47,0),.18,.41,'obsidian_edge',4)
    skull((0,2.44,.263),.76)
    finish('portal_frame')

def nature():
    for x,z,r,h in [(0,0,.20,1.07),(-.23,.03,.12,.63),(.20,.06,.13,.78),(.03,.19,.09,.43)]:
        gem('amethyst prism',(x,0,z),r,h,'crystal_light' if x<0 else 'crystal',5)
    ico('crystal matrix',(0,.075,0),(.44,.10,.37),'crystal_dark')
    finish('crystal_cluster')
    rings('lightning-struck trunk',[(0,.24,.21),(.16,.19,.17),(.64,.13,.13,.02,0),(1.18,.10,.095,-.06,.02),(1.69,.06,.055,.06,.03),(1.94,.01,.01,.13,.06)],'bark',7)
    for a,b,c in [((-.01,.69,0),(-.44,1.02,.04),(-.52,1.47,.05)),((-.02,1.21,.01),(.36,1.39,-.09),(.62,1.71,-.12)),((.03,1.60,.03),(-.18,1.85,.08),(-.32,2.11,.05))]:
        beam('crooked dead branch',a,b,.11,'bark');beam('splintered branch tip',b,c,.05,'bark_light')
    for i in range(5):
        a=i*2*math.pi/5;beam('exposed root',(0,.13,0),(math.sin(a)*.39,.02,math.cos(a)*.39),.10,'bark')
    finish('ruined_tree')
    for x,z,r,h in [(0,0,.24,1.5),(-.25,.03,.14,.88),(.22,.13,.15,.64)]:
        gem('volcanic glass shard',(x,.02,z),r,h,'obsidian',5)
        beam('lit volcanic fault',(x-r*.45,.15,z+r*.6),(x+r*.09,h*.7,z+r*.68),.021,'lava')
    ico('cooled lava shelf',(0,.06,0),(.44,.085,.36),'obsidian_edge')
    finish('obsidian_spires')

def floor_modules():
    # Irregular corner cuts and broad bevels remain readable at 28 pixels/tile.
    box('weathered flagstone',(0,.060,0),(.975,.12,.975),'stone',.044)
    beam('split flagstone seam',(-.44,.122,.17),(-.14,.122,.24),.015,'stone_dark')
    beam('split flagstone seam',(-.14,.122,.24),(-.025,.122,.47),.014,'stone_dark')
    finish('stone_slab')
    box('chamfered ashlar',(0,.18,0),(.94,.36,.45),'stone',.040)
    finish('stone_brick')

def tube(name,a,b,r1,r2,mat,n=6):
    a,b=Vector(a),Vector(b);axis=(b-a).normalized();ref=Vector((0,0,1)) if abs(axis.z)<.9 else Vector((1,0,0))
    u=axis.cross(ref).normalized();v=axis.cross(u)
    vs=[tuple(p+r*(math.cos(i*math.pi*2/n)*u+math.sin(i*math.pi*2/n)*v)) for p,r in [(a,r1),(b,r2)] for i in range(n)]
    return mesh(name,vs,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],mat)

def human_face(y=1.30,z=.045):
    rings('modeled adventurer face',[(-.13,.064,.064),(-.08,.104,.078),(.045,.105,.099),(.115,.073,.075)],'skin',8,(0,y,z))
    for side in [-1,1]:
        slab('quiet watchful eye',[(side*.044-.023,y+.012),(side*.044+.023,y+.012),(side*.044+.019,y-.008),(side*.044-.018,y-.010)],.01,z+.096,'recess')
        beam('stern brow',(side*.019,y+.036,z+.101),(side*.081,y+.030,z+.086),.019,'leather')
    mesh('modeled nose',[(-.025,y+.019,z+.101),(.025,y+.019,z+.101),(.025,y-.042,z+.101),(0,y-.025,z+.14),(-.025,y-.042,z+.101)],[(0,1,3),(1,2,3),(2,4,3),(4,0,3)],'skin')

def hood(mat,accent,y=1.30,peak=1.61,width=.20):
    # Closed back, open face, projecting angular brow, no visor-painted cube.
    n=10
    vs=[]
    for yy,r,zz in [(1.13,width*.96,-.015),(1.39,width,0),(peak,width*.06,-.075)]:
        vs += [(math.cos(math.pi/10+i*2*math.pi/n)*r,yy,zz+math.sin(math.pi/10+i*2*math.pi/n)*r*.80) for i in range(n)]
    fs=[]
    for j in range(2):
        for i in range(n):
            if j==0 and i in [1,2,3]:continue
            fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    cloth('deep open cowl',vs,fs,mat)
    pts=[(-width*.75,1.15,.095),(-width*.80,1.37,.11),(0,1.43,.19),(width*.80,1.37,.11),(width*.75,1.15,.095)]
    arc('stitched hood hem',pts,.026,.038,accent)

def cloak(mat,accent,wide=.27,long=.52):
    vs=[(-.17,1.10,-.16),(0,1.14,-.22),(.17,1.10,-.16),(-wide,1.10-long,-.26),(0,1.05-long,-.35),(wide,1.10-long,-.26)]
    cloth('three folded cloak panels',vs,[(0,1,4,3),(1,2,5,4)],mat)
    beam('left cloak sewn hem',vs[0],vs[3],.028,accent)
    beam('right cloak sewn hem',vs[2],vs[5],.028,accent)

def hero_leg():
    rings('tailored trouser and armored boot',[(-.50,.081,.082,0,.014),(-.37,.077,.075),(-.14,.085,.08),(0,.094,.094)],'leather',8)
    rings('boot folded cuff',[(-.17,.095,.089),(-.105,.097,.092)],'steel',8)
    box('angular greave plate',(0,-.31,.071),(.107,.26,.052),'iron',.018)
    rings('beveled boot toe',[(-.56,.095,.14,0,.033),(-.51,.095,.14,0,.033),(-.44,.086,.106,0,.026)],'leather_light',8)
    rings('boot sole',[(-.56,.096,.14,0,.033),(-.53,.096,.14,0,.033)],'iron',8)
    finish('hero_leg','character_part','hip (0,0,0); bottom Y=-0.56; attach x=+/-0.14, Y=0.56')

def hero_arm(kind):
    mat={'warrior':'warrior','mage':'mage','ranger':'ranger','summoner':'summoner','paladin':'steel'}[kind]
    if kind in ['mage','summoner']:
        rings('hanging layered sleeve',[(-.41,.14,.125,0,.016),(-.37,.14,.125,0,.016),(-.14,.092,.087),(0,.11,.106)],mat,8)
        rings('sleeve embroidered hem',[(-.415,.145,.13,0,.016),(-.37,.145,.13,0,.016)],'gold' if kind=='mage' else 'bone',8)
    else:
        rings('articulated sleeve',[(-.37,.072,.075,0,.020),(-.23,.084,.08),(0,.11,.11)],mat,8)
        rings('forged vambrace',[(-.42,.089,.088,0,.018),(-.35,.09,.09,0,.018),(-.25,.086,.085)],'steel' if kind!='ranger' else 'leather_light',8)
        box('bracer inset',(0,-.32,.098),(.057,.14,.023),'gold' if kind=='paladin' else 'iron',.009)
    ico('gloved articulated fist',(0,-.465,.040),(.078,.065,.077),'leather_light' if kind in ['warrior','ranger','paladin'] else 'skin',1)
    # Hand is a visible independent end volume; finger division survives tinting.
    beam('finger knuckle seam',(-.050,-.452,.101),(.047,-.452,.101),.013,'leather')
    finish('hero_arm_'+kind,'character_part','shoulder (0,0,0); hand center (0,-0.465,0.04); attach x=+/-0.35,Y=1.05')

def hero_core(kind):
    mat={'warrior':'warrior','mage':'mage','ranger':'ranger','summoner':'summoner','paladin':'steel'}[kind]
    accent={'warrior':'steel_edge','mage':'gold','ranger':'leather_light','summoner':'bone','paladin':'gold'}[kind]
    if kind in ['mage','summoner']:
        # Folds have distinct angular planes and irregular draped hem; no cone dress.
        n=12;vs=[]
        for j,(yy,r) in enumerate([(.06,.32),(.38,.29),(.69,.18)]):
            vs += [(math.cos(i*2*math.pi/n)*r*(.96 if i%2 else 1.03),yy+(.07*(i%2) if j==0 else 0),math.sin(i*2*math.pi/n)*r*.78) for i in range(n)]
        fs=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(2) for i in range(n)]
        cloth('angular tailored robe folds',vs,fs,mat)
        for side in [-1,1]:beam('robe vertical stitched edge',(side*.13,.66,.15),(side*.18,.10,.26),.026,accent)
    rings('fitted chest silhouette',[(.54,.19,.135),(.68,.175,.135),(.99,.24,.17),(1.08,.20,.14),(1.135,.095,.09)],mat,8)
    rings('girdle and belt',[(.62,.195,.15),(.69,.192,.15)],'leather',8)
    box('belt clasp',(0,.655,.155),(.12,.085,.038),accent,.012)
    if kind in ['warrior','paladin']:
        mesh('breastplate raised keel',[(-.16,.74,.133),(.16,.74,.133),(.19,1.0,.136),(0,1.08,.172),(-.19,1.0,.136),(0,.83,.228)],[(0,1,5),(1,2,3,5),(3,4,0,5)],'steel')
        for s in [-1,1]:
            rings('layered angular pauldron',[(.93,.16,.20),(1.03,.17,.205),(1.14,.11,.14)],mat,6,(s*.31,0,0))
            rings('rolled pauldron edge',[(.925,.162,.20),(.967,.162,.20)],accent,6,(s*.31,0,0))
            slab('split plate tasset',[(s*.025,.63),(s*.20,.64),(s*.26,.43),(s*.055,.42)],.034,.145,mat)
        # Helmet has real cheek guards, brow and a raised nasal bridge.
        human_face(1.31,.005)
        rings('faceted closed helmet',[(1.34,.155,.15),(1.46,.157,.15),(1.54,.09,.10)],mat,8)
        for s in [-1,1]:slab('swept cheek guard',[(s*.14,1.39),(s*.15,1.20),(s*.05,1.15),(s*.06,1.33)],.036,.105,'steel')
        beam('helmet brow rim',(-.14,1.36,.14),(.14,1.36,.14),.032,accent)
        beam('helmet nasal ridge',(0,1.47,.147),(0,1.25,.147),.028,accent)
        if kind=='warrior':
            slab('swept red helmet crest',[(-.035,1.53),(-.035,1.68),(.035,1.64),(.035,1.53)],.26,-.03,'red')
            cloak('red','leather_light',.27,.59)
        else:
            # Dawn-knight: winged helm, ivory tabard and sun-shaped chest medallion.
            for s in [-1,1]:slab('helmet wing',[(s*.12,1.41),(s*.28,1.65),(s*.29,1.46),(s*.18,1.32)],.055,-.015,'gold')
            slab('ivory knight tabard',[(-.12,.78),(.12,.78),(.12,.35),(0,.28),(-.12,.35)],.014,.218,'bone_light')
            gem('dawn emblem',(0,.89,.236),.075,.17,'gold',4)
            cloak('bone_light','gold',.28,.66)
    elif kind=='ranger':
        human_face(1.30,.038);hood('ranger','ranger_light',peak=1.50,width=.186)
        cloak('ranger','ranger_light',.255,.67)
        beam('diagonal leather baldric',(-.185,1.04,.15),(.17,.68,.16),.056,'leather_light')
        for s in [-1,1]:
            rings('stitched leather shoulder',[(.95,.12,.14),(1.075,.14,.15),(1.12,.082,.10)],'leather',6,(s*.285,0,0))
        box('ranger belt pouch',(-.17,.60,.06),(.14,.17,.17),'wood_light',.024)
        # Back quiver and individual fletchings identify the class even unarmed.
        tube('leather quiver',(.17,.70,-.21),(.28,1.20,-.21),.08,.095,'leather_light',7)
        for j in range(3):
            beam('quiver arrow',(.23+j*.035,1.05,-.20),(.20+j*.035,1.42,-.20),.012,'wood_light')
            slab('arrow fletching',[(.20+j*.035,1.34),(.19+j*.035,1.42),(.24+j*.035,1.39)],.012,-.20,'bone_light')
    else:
        human_face(1.29,.030);hood(mat,'mage_light' if kind=='mage' else 'summoner_light',peak=1.69 if kind=='mage' else 1.57,width=.22)
        for s in [-1,1]:
            slab('high flared collar',[(s*.09,1.07),(s*.24,1.25),(s*.31,1.0),(s*.19,.96)],.10,0,accent)
        if kind=='mage':
            gem('arcane chest focus',(0,.92,.165),.074,.20,'crystal_light',5)
            for s in [-1,1]:beam('arcane stole',(s*.14,1.02,.147),(s*.09,.71,.166),.025,'gold')
        else:
            skull((0,.88,.17),.47)
            for s in [-1,1]:
                for j in range(2):gem('bone mantle fang',(s*(.26+j*.055),1.055,0),.048,.22+j*.075,'bone',4)
            cloak('summoner','bone_dark',.31,.83)
    finish('hero_core_'+kind,'character_core','ground-origin; shoulder mounts (+/-0.35,1.05,0), hips (+/-0.14,0.56,0)')

def skeleton():
    # An exposed anatomical ribcage, separated forearms and joints, visible pelvis.
    for s in [-1,1]:
        hip=(s*.095,.61,0);knee=(s*.13,.33,.018);ankle=(s*.155,.085,0)
        tube('femur',hip,knee,.043,.033,'bone',6);ico('patella',knee,(.05,.05,.05),'bone_light')
        tube('shin',knee,ankle,.032,.025,'bone',6);box('skeletal foot',(s*.155,.048,.05),(.08,.075,.18),'bone_dark',.015)
    rings('hollow pelvis',[(.52,.14,.08),(.59,.16,.09),(.68,.105,.067)],'bone_dark',6)
    beam('lumbar spine',(0,.59,0),(0,1.05,-.005),.046,'bone')
    for j in range(3):
        yy=.79+j*.09;w=.16-j*.019
        for s in [-1,1]:
            tube('curved rib back',(0,yy+.025,-.065),(s*w,yy+.005,0),.024,.021,'bone',5)
            tube('curved rib front',(s*w,yy+.005,0),(s*.028,yy-.03,.090),.022,.018,'bone_light',5)
    beam('sternum',(0,.77,.084),(0,1.04,.07),.033,'bone_light')
    for s in [-1,1]:
        shoulder=(s*.23,1.02,0);elbow=(s*.31,.80,.02);wrist=(s*.32,.57,.10)
        tube('clavicle',(0,1.06,0),shoulder,.035,.028,'bone',6)
        ico('shoulder joint',shoulder,(.056,.06,.056),'bone')
        tube('upper arm bone',shoulder,elbow,.03,.025,'bone',6)
        for dx in [-.018,.018]:tube('radius ulna',(elbow[0]+dx,elbow[1],elbow[2]),(wrist[0]+dx,wrist[1],wrist[2]),.013,.01,'bone',5)
        ico('clenched skeletal hand',wrist,(.05,.072,.054),'bone_dark')
    skull((0,1.20,.008),.92)
    # A damaged iron cap plus broken sword distinguishes it from the hero.
    rings('rusted skull cap',[(1.32,.142,.12),(1.42,.13,.11),(1.46,.02,.025)],'iron',7)
    beam('rusted sword grip',(.32,.58,.10),(.32,.44,.10),.035,'leather')
    beam('sword guard',(.22,.45,.10),(.43,.45,.10),.030,'bronze')
    slab('chipped skeleton blade',[(.285,.43),(.36,.43),(.38,.18),(.34,.13),(.36,.08),(.29,-.02)],.025,.10,'steel')
    finish('skeleton','creature')

def ghoul():
    ico('arched ghoul thorax',(0,.85,-.025),(.265,.29,.23),'ghoul',2)
    ico('hunched raised back',(0,1.00,-.13),(.19,.20,.17),'ghoul_dark',1)
    rings('emaciated waist',[(.47,.14,.115),(.64,.16,.15),(.79,.22,.17)],'ghoul',7)
    for s in [-1,1]:
        tube('crooked thigh',(s*.12,.56,0),(s*.20,.29,.085),.105,.066,'ghoul',7)
        tube('crooked shin',(s*.20,.29,.085),(s*.23,.06,.025),.064,.046,'ghoul_dark',6)
        ico('clawed ghoul foot',(s*.23,.055,.09),(.085,.055,.14),'ghoul',1)
        tube('long muscular upper arm',(s*.23,.96,.02),(s*.43,.65,.08),.115,.078,'ghoul',7)
        tube('long forearm',(s*.43,.65,.08),(s*.44,.39,.26),.075,.058,'ghoul_dark',6)
        ico('grasping hand',(s*.44,.35,.30),(.075,.075,.09),'ghoul',1)
        for j in range(3):tube('long black claw',(s*.44+(j-1)*.042,.34,.34),(s*.44+(j-1)*.047,.28,.44),.014,.005,'bone_dark',5)
    # Low brow, protruding jaw and bald skull make a forward hunched silhouette.
    rings('sunken ghoul face',[(1.00,.12,.09,0,.17),(1.09,.17,.145,0,.19),(1.24,.165,.125,0,.14),(1.34,.09,.075,0,.09)],'ghoul',7)
    for s in [-1,1]:
        box('sunken ghoul eye',(s*.071,1.20,.277),(.047,.025,.026),'eye')
        beam('heavy ghoul brow',(s*.016,1.235,.267),(s*.13,1.21,.245),.042,'ghoul_dark')
    box('gaping mouth',(0,1.074,.319),(.16,.074,.019),'recess')
    for x in [-.064,-.022,.022,.064]:gem('exposed ghoul fang',(x,1.061,.336),.016,.06,'bone_light',3)
    for j in range(4):ico('exposed spinal knob',(0,.68+j*.096,-.222),(.035,.036,.030),'bone_dark')
    for s in [-1,1]:slab('ragged waist cloth',[(s*.015,.59),(s*.13,.61),(s*.17,.31),(s*.09,.36),(s*.075,.25)],.022,.126,'leather')
    finish('ghoul','creature')

def wraith():
    # Fully authored torn cloth planes; lower edge is irregular but grounded.
    n=12;vs=[]
    for yy,rx,rz in [(0,.39,.26),(.44,.26,.19),(.93,.18,.14),(1.10,.25,.18)]:
        vs += [(math.cos(i*2*math.pi/n)*rx,yy+(.16*(i%2) if yy==0 else 0),math.sin(i*2*math.pi/n)*rz) for i in range(n)]
    fs=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(3) for i in range(n)]
    cloth('tattered layered spectral cloth',vs,fs,'wraith_dark')
    for s in [-1,1]:
        slab('ghostly breast drape',[(s*.035,1.09),(s*.20,1.00),(s*.24,.53),(s*.07,.32)],.016,.16,'wraith')
        tube('spectral extended upper arm',(s*.24,1.02,0),(s*.41,.90,.06),.098,.075,'wraith',6)
        tube('spectral rag sleeve',(s*.41,.90,.06),(s*.52,.83,.19),.074,.11,'wraith_dark',6)
        for j in range(3):
            tube('wraith skeletal finger',(s*.52+(j-1)*.03,.84,.20),(s*.56+(j-1)*.033,.78,.34),.018,.01,'wraith_light',5)
    hood('wraith','wraith_light',peak=1.60,width=.235)
    slab('bottomless hood face',[(-.12,1.17),(.12,1.17),(.135,1.37),(0,1.44),(-.135,1.37)],.018,.04,'recess')
    for s in [-1,1]:box('spectral pale eye',(s*.053,1.31,.075),(.045,.028,.020),'crystal_light')
    # Collar clasp and float hem wisps remain deliberately sparse.
    gem('wraith clasp',(0,1.04,.21),.040,.10,'bone_light',4)
    finish('wraith','creature')

crypt_pillar();broken_arch();sarcophagus();chest();brazier();altar();shrine();portal();nature();floor_modules()
hero_leg()
for kind in ['warrior','mage','ranger','summoner','paladin']:hero_core(kind);hero_arm(kind)
skeleton();ghoul();wraith()

def export_model(name,o):
    print('BAKE',name,flush=True)
    data=o.data
    bm=bmesh.new();bm.from_mesh(data);bvh=BVHTree.FromBMesh(bm)
    colors=data.color_attributes.new(name='BakedLight',type='FLOAT_COLOR',domain='CORNER')
    data.calc_loop_triangles()
    triangles=[(tuple(t.vertices),tuple(t.loops),t.material_index,t.normal.copy(),t.area) for t in data.loop_triangles]
    key=Vector(cv((-.55,.83,.48))).normalized();rim=Vector(cv((.8,.5,-.7))).normalized()
    # Fixed low-discrepancy hemisphere; no nondeterministic scene light dependency.
    hemi=[Vector((math.cos(i*2.399963)*math.sqrt((i+.5)/12),math.sin(i*2.399963)*math.sqrt((i+.5)/12),math.sqrt(1-(i+.5)/12))) for i in range(12)]
    lookup={};pos=[];ns=[];cs=[];ix=[];bake_cache={}
    for vertices,loops,material_index,normal,area in triangles:
        if area<1e-10:continue
        base=data.materials[material_index].diffuse_color[:3];n=normal.normalized()
        for vi,li in zip(vertices,loops):
            v=data.vertices[vi].co;k=tuple(round(f,5) for f in (*v,*n))
            if k not in bake_cache:
                ref=Vector((0,0,1)) if abs(n.z)<.9 else Vector((1,0,0));u=n.cross(ref).normalized();w=n.cross(u)
                hit=0
                for h in hemi:
                    d=(u*h.x+w*h.y+n*h.z).normalized()
                    if bvh.ray_cast(v+n*.003,d,.32 if META[name]['role']=='prop' else .16)[0] is not None:hit+=1
                ao=1-.33*hit/12
                light=(.49+.62*max(0,n.dot(key))+.12*max(0,n.dot(rim)))*ao
                bake_cache[k]=light
            light=bake_cache[k];color=tuple(round(min(1,max(.012,c*light)),4) for c in base)
            colors.data[li].color=(*color,1)
            p=(v.x,v.z,-v.y);nn=(n.x,n.z,-n.y)
            vertkey=tuple(round(f,4) for f in (*p,*nn,*color))
            if vertkey not in lookup:
                lookup[vertkey]=len(pos)//3;pos.extend(vertkey[:3]);ns.extend(vertkey[3:6]);cs.extend(vertkey[6:])
            ix.append(lookup[vertkey])
    bm.free()
    material=bpy.data.materials.get('Runtime baked vertex colors')
    if material is None:
        material=bpy.data.materials.new('Runtime baked vertex colors');material.use_nodes=True
        nodes=material.node_tree.nodes;nodes.clear();attr=nodes.new('ShaderNodeAttribute');attr.attribute_name='BakedLight'
        emit=nodes.new('ShaderNodeEmission');output=nodes.new('ShaderNodeOutputMaterial')
        material.node_tree.links.new(attr.outputs['Color'],emit.inputs['Color']);material.node_tree.links.new(emit.outputs[0],output.inputs['Surface'])
    # Source keeps authoring palettes as unused slots, displaying exact exported colors.
    data.materials.append(material)
    for p in data.polygons:p.material_index=len(data.materials)-1
    bounds={kind:[round((min if kind=='min' else max)(pos[i::3]),4) for i in range(3)] for kind in ['min','max']}
    META[name].update({'triangles':len(ix)//3,'vertices':len(pos)//3,'bounds':bounds})
    return {'position':pos,'normal':ns,'color':cs,'index':ix}

kit={'version':1,'models':{},'metadata':{'generator':'Blender 5.2 / scripts/build-spire-art.py','license':'Original HollowLight project artwork','coordinates':'+Y up, +Z front; 1 tile = 1 unit','colors':'linear RGB; baked directional light and 12-ray local AO','models':META}}
for name,o in MODELS.items():kit['models'][name]=export_model(name,o)
raw=json.dumps(kit,separators=(',',':')).encode()
temp=OUT/'spire-kit.tmp';temp.write_bytes(raw);os.replace(temp,OUT/'spire-kit.json')
stats={'jsonBytes':len(raw),'gzipBytes':len(gzip.compress(raw,mtime=0)),'models':META}
(REVIEW/'asset-metrics.json').write_text(json.dumps(stats,indent=2))
print('SPIRE_ASSET_METRICS',json.dumps(stats))

# Contact sheet uses emission vertex colors, so it proves baked depth without
# renderer shadows or flattering studio lights absent from the runtime.
scene=bpy.context.scene
labelmat=bpy.data.materials.new('Review label ivory');labelmat.use_nodes=True
labelnodes=labelmat.node_tree.nodes;labelnodes.clear();le=labelnodes.new('ShaderNodeEmission');le.inputs['Color'].default_value=(.68,.65,.56,1);lo=labelnodes.new('ShaderNodeOutputMaterial');labelmat.node_tree.links.new(le.outputs[0],lo.inputs['Surface'])
names=[n for n in MODELS if META[n]['role']=='prop']
for name in MODELS:
    MODELS[name].hide_render=name not in names
    MODELS[name].hide_set(name not in names)
for i,name in enumerate(names):
    x=(i%4-1.5)*3.3;z=(i//4)*3.65
    MODELS[name].location=cv((x,0,z))
    bpy.ops.object.text_add(location=cv((x,.025,z+1.25)))
    label=bpy.context.object;label.name='Label '+name;label.data.body=name.upper().replace('_',' ');label.data.align_x='CENTER';label.data.size=.19
    label.data.materials.append(labelmat)
world=bpy.data.worlds.new('Dark additive reference');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.025,.032,.045,1);world.node_tree.nodes['Background'].inputs[1].default_value=.7;scene.world=world
bpy.ops.object.camera_add(location=cv((9,15,22)))
cam=bpy.context.object;target=Vector(cv((0,.55,5.0)));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=18;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.resolution_x=1800;scene.render.resolution_y=1500;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(REVIEW/'spire-environment-contact.png')
bpy.context.view_layer.update()
env_camera=cam.matrix_world.copy()
env_objects=[o for o in scene.objects if o.type in ['MESH','FONT'] and not o.hide_render]
bpy.ops.render.render(write_still=True)

# Separate assembled-character study, using the exact exported rig parts.
for o in scene.objects:
    if o.type in ['MESH','FONT']:o.hide_render=True
def instance(name,loc):
    o=bpy.data.objects.new('Study '+name,MODELS[name].data);scene.collection.objects.link(o);o.location=cv(loc);return o
for i,kind in enumerate(['warrior','mage','ranger','summoner','paladin']):
    x=(i-2)*1.7
    instance('hero_core_'+kind,(x,0,0))
    for s in [-1,1]:
        instance('hero_leg',(x+s*.14,.56,0));instance('hero_arm_'+kind,(x+s*.35,1.05,0))
    bpy.ops.object.text_add(location=cv((x,.015,.55)));label=bpy.context.object;label.data.body=kind.upper();label.data.align_x='CENTER';label.data.size=.12;label.data.materials.append(labelmat)
cam.location=cv((4,5,12));cam.rotation_euler=(Vector(cv((0,.80,0)))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=9.4
scene.render.resolution_x=1900;scene.render.resolution_y=900;scene.render.filepath=str(REVIEW/'spire-adventurers-contact.png')
bpy.ops.render.render(write_still=True)
for o in scene.objects:
    if o.type in ['MESH','FONT']:o.hide_render=True
for i,name in enumerate(['skeleton','ghoul','wraith']):
    x=(i-1)*1.7;instance(name,(x,0,0))
    bpy.ops.object.text_add(location=cv((x,.015,.67)));label=bpy.context.object;label.data.body=name.upper();label.data.align_x='CENTER';label.data.size=.12;label.data.materials.append(labelmat)
cam.location=cv((3,3.8,9));cam.rotation_euler=(Vector(cv((0,.80,0)))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=6.2
scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.filepath=str(REVIEW/'spire-creatures-contact.png')
bpy.ops.render.render(write_still=True)
# Keep the .blend opening on the environmental scene. Character source meshes
# retain local pivots, and their assembled linked instances remain in the file.
for o in scene.objects:
    if o.type in ['MESH','FONT']:
        o.hide_render=o not in env_objects;o.hide_set(o not in env_objects)
cam.matrix_world=env_camera;cam.data.ortho_scale=18
scene.render.resolution_x=1800;scene.render.resolution_y=1500;scene.render.filepath=str(REVIEW/'spire-environment-contact.png')
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'spire-kit.blend'))
