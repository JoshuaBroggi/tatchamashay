"""Author Mulligan's iPhone-first skin, deforming rig and baked six-second idle.

Blender 4.5: blender --background --factory-startup --python build-mulligan.py
Then run tools/convert-rigged-beasts.py -- mulligan. No external assets or add-ons.
Coordinates: Z up, facing -Y. The shared converter supplies iPhone framing/units.
The character adaptation follows Joshua's five supplied toy photographs.
"""
from pathlib import Path
import json
import math
import random

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
random.seed(714)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 24
scene.frame_start, scene.frame_end = 1, 145

OLIVE = (0.25, 0.27, 0.12)
LIGHT_OLIVE = (0.33, 0.35, 0.17)
PINK = (0.66, 0.25, 0.29)
OCHRE = (0.62, 0.40, 0.16)
DARK = (0.018, 0.023, 0.015)
IVORY = (0.80, 0.64, 0.30)
MOUTH = (0.022, 0.006, 0.033)
TONGUE = (0.57, 0.045, 0.045)


def mix(a, b, t):
    t = min(1, max(0, t))
    return tuple(x * (1-t) + y*t for x, y in zip(a, b))


def skin_color(p):
    # The references have pink hands/feet, ochre transitions and an olive torso.
    t = (p.z - 0.40) / 0.85
    base = mix(PINK, OCHRE, t * 2) if t < .5 else mix(OCHRE, OLIVE, (t-.5)*2)
    mottle = 1+.045*math.sin(p.x*31+p.z*13)*math.sin(p.y*27-p.z*21)
    return tuple(c*mottle for c in base)


verts, faces, colors, weights, materials = [], [], [], [], []


def vertex(p, color, weight):
    p = Vector(p)
    assignment = weight(p) if callable(weight) else weight
    verts.append(tuple(p))
    colors.append(tuple(color(p) if callable(color) else color) + (1,))
    weights.append(assignment)
    return len(verts)-1


def face(indices, mat=0):
    faces.append(indices)
    materials.append(mat)


def ellipsoid(center, scale, color, weight, segments=24, rings=14, mat=0):
    center, scale = Vector(center), Vector(scale)
    ids = []
    for j in range(rings+1):
        theta = math.pi*j/rings
        row = []
        for i in range(segments):
            phi = 2*math.pi*i/segments
            local = Vector((math.sin(theta)*math.cos(phi), math.sin(theta)*math.sin(phi), math.cos(theta)))
            # Subtle broad skin unevenness, rather than expensive wrinkle textures.
            bump = 1 + .018*math.sin(phi*5 + theta*3)*math.sin(theta)**2
            p = center + Vector((local.x*scale.x, local.y*scale.y, local.z*scale.z))*bump
            row.append(vertex(p, color, weight))
        ids.append(row)
    for j in range(rings):
        for i in range(segments):
            a, b = i, (i+1) % segments
            if j == 0:
                face((ids[j][a], ids[j+1][a], ids[j+1][b]), mat)
            elif j == rings-1:
                face((ids[j][a], ids[j+1][a], ids[j][b]), mat)
            else:
                face((ids[j][a], ids[j+1][a], ids[j+1][b], ids[j][b]), mat)


def tube(points, radii, color, weight, sides=10, mat=0, flatten=1):
    points = [Vector(p) for p in points]
    rows = []
    for j, p in enumerate(points):
        tangent = (points[min(j+1, len(points)-1)] - points[max(0, j-1)]).normalized()
        u = tangent.cross(Vector((0, 1, 0)))
        if u.length < .01:
            u = tangent.cross(Vector((1, 0, 0)))
        u.normalize()
        v = tangent.cross(u).normalized()
        row = []
        for k in range(sides):
            angle = k*math.tau/sides
            offset = u*math.cos(angle)*radii[j] + v*math.sin(angle)*radii[j]*flatten
            row.append(vertex(p+offset, color, weight))
        rows.append(row)
    face(tuple(reversed(rows[0])), mat)
    for j in range(len(rows)-1):
        for k in range(sides):
            nxt = (k+1) % sides
            face((rows[j][k], rows[j][nxt], rows[j+1][nxt], rows[j+1][k]), mat)
    face(tuple(rows[-1]), mat)


def sweep_surface(points, radii, segment, t, angle, offset=0):
    """A point/normal on the same limb sweep, for attached creases and nodules."""
    a, b = Vector(points[segment]), Vector(points[segment+1])
    tangent = (b-a).normalized()
    u = tangent.cross(Vector((0,1,0))).normalized()
    v = tangent.cross(u).normalized()
    normal = u*math.cos(angle)+v*math.sin(angle)
    radius = radii[segment]*(1-t)+radii[segment+1]*t
    return a.lerp(b,t)+normal*(radius+offset)


def torso_weights(p):
    t = min(1, max(0, (p.y+.5)/1.5))
    return {'Chest': 1-t, 'Pelvis': t}


# Heavy, hunched trunk. The lower belly is narrower than the shoulder dome.
ellipsoid((0, .12, 1.67), (.83, 1.0, .78),
          lambda p: mix(OLIVE, LIGHT_OLIVE, (p.z-1.5)*.45), torso_weights, 28, 16)
ellipsoid((0, .73, 1.44), (.62, .65, .61), OLIVE, torso_weights, 20, 12)
ellipsoid((0, -.54, 1.69), (.69, .42, .59), OLIVE, {'Chest': 1}, 24, 12)

# Rig joints: long load-bearing arms, short rear legs, independent jaw and toes.
bones = [
    ('Root', (0, 0, 0), (0, 0, .3), None),
    ('Pelvis', (0, .58, 1.25), (0, .40, 1.65), 'Root'),
    ('Chest', (0, .40, 1.65), (0, -.42, 1.98), 'Pelvis'),
    ('Neck', (0, -.42, 1.98), (0, -.83, 2.12), 'Chest'),
    ('Head', (0, -.83, 2.12), (0, -1.58, 2.12), 'Neck'),
    ('Jaw', (0, -.95, 1.99), (0, -1.64, 1.85), 'Head'),
]

for side, s in [('L', 1), ('R', -1)]:
    shoulder = Vector((s*.70, -.52, 1.90))
    elbow = Vector((s*.91, -.66, 1.03))
    wrist = Vector((s*.91, -.95, .25))
    toe = Vector((s*.90, -1.18, .12))
    hip = Vector((s*.49, .78, 1.34))
    knee = Vector((s*.66, .97, .73))
    ankle = Vector((s*.59, 1.00, .23))
    rear_toe = Vector((s*.62, .77, .12))
    bones += [
        (f'Arm.{side}', shoulder, elbow, 'Chest'),
        (f'Forearm.{side}', elbow, wrist, f'Arm.{side}'),
        (f'Hand.{side}', wrist, toe, f'Forearm.{side}'),
        (f'Thigh.{side}', hip, knee, 'Pelvis'),
        (f'Shin.{side}', knee, ankle, f'Thigh.{side}'),
        (f'Foot.{side}', ankle, rear_toe, f'Shin.{side}'),
    ]

    def arm_weights(p, side=side):
        if p.z > 1.8:
            chest = min(.95, (p.z-1.8)/.4)
            return {f'Arm.{side}': 1-chest, 'Chest': chest}
        t = min(1, max(0, (1.32-p.z)/.53))
        return {f'Arm.{side}': 1-t, f'Forearm.{side}': t}

    # Rounded deltoid cap with a continuous downward sweep; no folded top ring.
    arm_path = [(s*.72,-.52,2.18),(s*.72,-.52,2.135),
                (s*.735,-.53,2.045),(s*.765,-.55,1.90),
                (s*.81,-.58,1.70),(s*.865,-.62,1.40),
                elbow,elbow.lerp(wrist,.4),elbow.lerp(wrist,.75),wrist]
    arm_radii = [.015,.13,.235,.32,.34,.30,.23,.22,.14,.115]
    tube(arm_path, arm_radii, skin_color, arm_weights, sides=20)
    # Pebbled deltoids visible in the new front/three-quarter references.
    for j in range(10):
        segment = 2 if j < 4 else 3
        t = .28+.6*((j*7)%13)/13
        angle = .48+(j%5)*.35
        p = sweep_surface(arm_path,arm_radii,segment,t,angle,.016)
        radius = .024+.014*((j*3)%7)/7
        ellipsoid(p,(radius,radius,radius*.95),LIGHT_OLIVE,arm_weights,12,8)
    # Branching cords wrap the muscles, with smaller creases reaching the forearm.
    for j in range(5):
        segment = 3+j//3
        t = .15+(j%3)*.28
        path = [sweep_surface(arm_path,arm_radii,segment,t+.04*math.sin(k+j),
                              .12+k*.30,.012) for k in range(7)]
        tube(path,[.026,.025,.025,.021,.018,.013,.004],DARK,arm_weights,6,mat=1)
    for j in range(3):
        path = [sweep_surface(arm_path,arm_radii,6+k//3,.14+(k%3)*.22,
                              .7+j*.45+.12*math.sin(k),.01) for k in range(6)]
        tube(path,[.018,.02,.018,.015,.011,.003],DARK,arm_weights,5,mat=1)
    ellipsoid((s*.91, -1.04, .19), (.18, .23, .15), PINK, {f'Hand.{side}':1}, 16, 8)

    def leg_weights(p, side=side):
        t = min(1, max(0, (.88-p.z)/.35))
        return {f'Thigh.{side}': 1-t, f'Shin.{side}': t}

    ellipsoid(hip, (.31, .36, .38), OLIVE, {f'Thigh.{side}':.75, 'Pelvis':.25}, 20, 10)
    tube([hip, hip.lerp(knee,.5), knee, knee.lerp(ankle,.45), ankle],
         [.25, .24, .16, .13, .095], skin_color, leg_weights, sides=14)
    ellipsoid((s*.61, .87, .16), (.14, .22, .13), PINK, {f'Foot.{side}':1}, 16, 8)

    for front, base in [(True, Vector((s*.91, -1.05, .15))),
                        (False, Vector((s*.61, .88, .13)))]:
        parent = f'Hand.{side}' if front else f'Foot.{side}'
        for digit in range(3):
            x = (digit-1)*.115
            start = base + Vector((x, -.015, 0))
            tip = start + Vector((x*.23, -.20 if digit != 1 else -.25, -.02))
            name = f'{"Finger" if front else "Toe"}{digit+1}.{side}'
            bones.append((name, start, tip, parent))
            tube([start, start.lerp(tip,.55), tip], [.068,.064,.043], PINK,
                 {name:.7, parent:.3}, sides=8)
            tube([tip+Vector((0,.015,.025)), tip+Vector((0,-.06,.045)),
                  tip+Vector((0,-.105,.018))], [.047,.035,.005], IVORY, {name:1}, sides=8, mat=3)

    # Small inner thumb/hind dewclaw; no extra limbs or invented tail.
    base = Vector((s*.79,-.99,.23))
    tube([base, base+Vector((-s*.12,-.015,-.09)), base+Vector((-s*.13,-.10,-.13))],
         [.075,.06,.032], PINK, {f'Hand.{side}':1}, sides=8)


def head_color(p):
    t = min(1, max(0, (-p.y-.65)/.95))
    return mix(OLIVE,OCHRE,t/.22) if t < .22 else mix(OCHRE,PINK,(t-.22)/.52)


def skull(sections):
    rows = []
    for y, width, z, height in sections:
        row = []
        for i in range(24):
            angle = i*math.tau/24
            # A tall tapering crown over a thin palate, rather than a round snout cap.
            sine = math.sin(angle)
            p = Vector((math.cos(angle)*width,y,z+max(sine,0)*height+min(sine,0)*.035))
            row.append(vertex(p,head_color,{'Head':1}))
        rows.append(row)
    face(tuple(reversed(rows[0])))
    for j in range(len(rows)-1):
        for i in range(24):
            n = (i+1)%24
            face((rows[j][i], rows[j][n], rows[j+1][n], rows[j+1][i]))
    face(tuple(rows[-1]))


# Rebuilt from the two open-mouth reference views: a long wedge above two slim
# mandibular rails meeting at a point. No broad lower plate or flat front tooth bar.
HEAD_SECTIONS = [(-.65,.265,2.005,.43),(-.92,.255,2.01,.44),
                 (-1.20,.205,2.02,.34),(-1.50,.140,2.025,.235),
                 (-1.78,.078,2.03,.125),(-1.97,.026,2.035,.045),
                 (-2.025,.006,2.04,.014)]
JAW_RAIL = [(.185,-.99,1.955),(.172,-1.17,1.925),(.130,-1.40,1.91),
            (.077,-1.65,1.915),(.025,-1.88,1.93),(0,-2.025,1.95)]
skull(HEAD_SECTIONS)
ellipsoid((0,-.64,2.11),(.265,.36,.28),head_color,{'Neck':.3,'Head':.7},20,10)


def profile_at(sections,y):
    for a,b in zip(sections,sections[1:]):
        if a[0] >= y >= b[0]:
            t = (y-a[0])/(b[0]-a[0])
            return tuple(a[i]*(1-t)+b[i]*t for i in range(1,len(a)))
    return sections[0][1:] if y > sections[0][0] else sections[-1][1:]


def skull_surface(y,angle,offset=.006):
    width,z,height = profile_at(HEAD_SECTIONS,y)
    return (math.cos(angle)*(width+offset),y,z+math.sin(angle)*(height+offset))


# Dark palate and throat; concave lower lining is skinned to the moving jaw.
ellipsoid((0,-1.02,1.975),(.174,.13,.13),MOUTH,{'Head':1},16,8,mat=2)
lining_rows = []
for x,y,z in JAW_RAIL:
    row = [vertex((x*t,y,z-.018-.035*(1-t*t)),MOUTH,{'Jaw':1})
           for t in [-1,-.5,0,.5,1]]
    lining_rows.append(row)
for j in range(len(lining_rows)-1):
    for k in range(4):
        face((lining_rows[j][k],lining_rows[j+1][k],lining_rows[j+1][k+1],lining_rows[j][k+1]),2)

for s in [-1,1]:
    lower = [(s*x,y,z) for x,y,z in JAW_RAIL]
    tube(lower,[.043,.041,.033,.027,.019,.009],PINK,{'Jaw':1},sides=10)
    tube([(s*x*.90,y,z+.018) for x,y,z in JAW_RAIL],
         [.014,.014,.012,.01,.008,.003],mix(PINK,IVORY,.12),{'Jaw':1},sides=6)
    upper = [(s*profile_at(HEAD_SECTIONS,y)[0]*.96,y,2.012)
             for y in [-1.0,-1.17,-1.40,-1.65,-1.88,-2.02]]
    tube(upper,[.022,.022,.018,.014,.010,.003],PINK,{'Head':1},sides=8)
    # Cheek cartilage and the deep corner of the open mouth.
    tube([(s*.19,-.94,2.08),(s*.22,-1.01,2.04),(s*.195,-1.09,1.97)],
         [.040,.042,.026],PINK,{'Head':1},sides=9)
    for i in range(22):
        t = (i+.4)/22
        y = -1.035-.95*t
        width,_,_ = profile_at(HEAD_SECTIONS,y)
        x = s*width*.94
        size = .011+.004*math.sin(t*math.pi)
        height = .035+.02*math.sin(t*math.pi)**2
        tube([(x,y,2.004),(x-s*.004,y-.003,2.004-height*.6),
              (x-s*.007,y,2.004-height)], [size,size*.68,.0025],IVORY,{'Head':1},sides=6,mat=3)
        # The lower row follows the actual taper of each mandibular rail.
        width,z = profile_at([(p[1],p[0],p[2]) for p in JAW_RAIL],y)
        x = s*width*.91
        tube([(x,y,z+.015),(x-s*.004,y,z+.015+height*.6),
              (x-s*.007,y,z+.015+height)], [size,size*.65,.0025],IVORY,{'Jaw':1},sides=6,mat=3)
    # Fine mucosal folds read inside the open V instead of an empty black gap.
    for i in range(3):
        factor = .3+i*.2
        path = [(s*x*factor,y,z-.025) for x,y,z in JAW_RAIL[:-1]]
        tube(path,[.008,.010,.009,.006,.002],(.085,.025,.10),{'Jaw':1},sides=5)

# A short curved red tongue with a center groove and small paired nostril recesses.
tube([(0,-1.10,1.935),(0,-1.45,1.92),(0,-1.76,1.935),(0,-1.98,1.95),(0,-2.04,1.975)],
     [.020,.026,.030,.025,.012],TONGUE,{'Head':1},sides=12,flatten=2.7)
tube([(0,-1.25,1.954),(0,-1.56,1.953),(0,-1.90,1.979)],
     [.005,.006,.002],(.21,.013,.025),{'Head':1},sides=5)
for s in [-1,1]:
    ellipsoid((s*.018,-1.985,2.077),(.009,.021,.008),MOUTH,{'Head':1},8,5,mat=2)
tube([(0,-1.00,2.455),(0,-1.25,2.345),(0,-1.52,2.262),(0,-1.91,2.092)],
     [.014,.017,.012,.002],mix(PINK,LIGHT_OLIVE,.12),{'Head':1},sides=6)


def ridge(points, radius=.032, weight=torso_weights):
    tube(points, [radius*(1-.82*i/(len(points)-1)) for i in range(len(points))],
         DARK, weight, sides=6, mat=1)


# The toy's defining black branching ridges: central spine and broad rib branches.
def back_surface(y, theta, offset=.015):
    # Ellipsoid cross-section follows the shoulder dome.
    cross = math.sqrt(max(.02, 1-((y-.12)/1.0)**2))
    return Vector(((.83*cross+offset)*math.sin(theta), y,
                   1.67+(.78*cross+offset)*math.cos(theta)))

ridge([back_surface(y,0,.035) for y in [-.64,-.45,-.15,.15,.45,.70,.94]], .065)
for j, y in enumerate([-.58,-.34,-.07,.21,.48,.72]):
    for s in [-1,1]:
        points = [back_surface(y+.065*math.sin(k*2+j+s)+.06*k/5, s*k*.27, .023) for k in range(6)]
        ridge(points,.045)
        origin = points[2]
        ridge([origin, origin+Vector((s*.09,-.12,-.015)),
               back_surface(y-.18,s*.9,.025)],.025)
        origin = points[4]
        ridge([origin, origin+Vector((s*.03,.10,-.07)),
               back_surface(y+.12,s*1.48,.025)],.026)

# The rear reference has a dense, radiating knot of dark ridges over the rump.
def rump_surface(x, z):
    y = .73+.65*math.sqrt(max(.02,1-(x/.62)**2-((z-1.44)/.61)**2))
    return (x,y+.022,z)

for i in range(12):
    angle = i*math.tau/12
    path = []
    for j, radius in enumerate([.045,.16,.31,.48]):
        bend = angle+.14*math.sin(i+j*2)
        path.append(rump_surface(math.cos(bend)*radius,1.40+math.sin(bend)*radius))
    ridge(path,.047,{'Pelvis':1})

def chest_surface(x,z,offset=.015):
    # Project every cord onto the actual overlapping chest/trunk surfaces.
    ys = []
    for center,scale in [((0,.12,1.67),(.83,1,.78)),
                         ((0,-.54,1.69),(.69,.42,.59))]:
        rest = 1-((x-center[0])/scale[0])**2-((z-center[2])/scale[2])**2
        if rest >= 0:
            ys.append(center[1]-scale[1]*math.sqrt(rest))
    return (x,min(ys,default=-.5)-offset,z)


# Dense overlapping cords, rather than a handful of marks on a bare belly.
for j in range(19):
    z = 1.14+j*.05
    width = .43+.19*math.sin((j+1)/21*math.pi)
    path = [chest_surface(width*(k/4-1),z+.04*abs(k/4-1)+
            .028*math.sin(j*.73+k*1.5)+.012*math.sin(k*3.2+j)) for k in range(9)]
    thickness = .021+.007*(j%4)/3
    tube(path,[thickness*(.65+.35*math.sin(k/8*math.pi)) for k in range(9)],
         DARK,{'Chest':1},sides=6,mat=1)
    if j%2 == 0:
        # A forked strand bridges adjacent layers, breaking the horizontal rhythm.
        s = 1 if j%4 else -1
        ridge([chest_surface(s*.10,z),chest_surface(s*.21,z+.07,.024),
               chest_surface(s*.34,z+.09,.024),chest_surface(s*.45,z+.14)],
              .018,{'Chest':1})

for s in [-1,1]:
    # Thicker crooked strands weave over the smaller rib cords and fork sideways.
    for j in range(3):
        path = [chest_surface(s*x,z,.042) for x,z in
                [(.48+j*.035,2.08-j*.04),(.36+j*.045,1.96-j*.055),
                 (.42-j*.07,1.79-j*.07),(.17+j*.08,1.59-j*.08),
                 (.23-j*.04,1.39-j*.07),(.08+j*.07,1.20+j*.015)]]
        ridge(path,.040-j*.004,{'Chest':1})
        ridge([path[2],chest_surface(s*(.44+j*.05),1.65-j*.07,.04),
               chest_surface(s*.58,1.53-j*.06,.032)],.023,{'Chest':1})
    for j in range(4):
        ridge([chest_surface(s*(.23+j*.035),2.28-j*.035),
               chest_surface(s*(.32+j*.04),2.15-j*.04,.025),
               chest_surface(s*(.48+j*.03),1.98-j*.05,.026),
               chest_surface(s*(.57+j*.015),1.83-j*.04)],.035,{'Chest':1})

    def on_head(y,angle):
        p = Vector(skull_surface(y,angle))
        p.x *= s
        return p

    for j,y in enumerate([-.73,-.90,-1.07,-1.24]):
        path = [on_head(y-.095*k,.95-.15*k+.08*math.sin(j+k)) for k in range(5)]
        ridge(path,.016+.003*(j%2),{'Head':1})
        ridge([path[2],on_head(y-.20,.96),on_head(y-.28,1.14)],.010,{'Head':1})
    # Thin skin creases down the pink cheek, separate from the large dark cords.
    for j in range(3):
        ridge([on_head(-1.22-j*.12,.20),on_head(-1.29-j*.12,.14),
               on_head(-1.37-j*.12,.08)],.006,{'Head':1})

# Build a single multi-material skinned mesh, rather than loose animated objects.
mesh = bpy.data.meshes.new('MulliganSkin')
mesh.from_pydata(verts, [], faces)
mesh.update()
skin = bpy.data.objects.new('Mulligan', mesh)
scene.collection.objects.link(skin)
color_attr = mesh.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
for i, color in enumerate(colors):
    color_attr.data[i].color = color

for name, color, roughness, use_color in [
    ('Olive_to_rose_skin', OLIVE, .48, True),
    ('Charcoal_branching_ridges', DARK, .36, False),
    ('Mouth_interior', MOUTH, .7, False),
    ('Warm_yellow_teeth_and_claws', IVORY, .36, False),
]:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color,1)
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color,1)
    bsdf.inputs['Roughness'].default_value = roughness
    if use_color:
        vertex_color = mat.node_tree.nodes.new('ShaderNodeVertexColor')
        vertex_color.layer_name = 'Color'
        mat.node_tree.links.new(vertex_color.outputs['Color'], bsdf.inputs['Base Color'])
    mesh.materials.append(mat)
for polygon, mat in zip(mesh.polygons, materials):
    polygon.material_index = mat
    polygon.use_smooth = True

armature = bpy.data.armatures.new('MulliganSkeleton')
rig = bpy.data.objects.new('MulliganRig', armature)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name, head, tail, parent in bones:
    bone = armature.edit_bones.new(name)
    bone.head, bone.tail = head, tail
    if parent:
        bone.parent = armature.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
groups = {name:skin.vertex_groups.new(name=name) for name, *_ in bones}
for i, assignment in enumerate(weights):
    total = sum(assignment.values())
    for name, weight in assignment.items():
        if weight > 0:
            groups[name].add([i], weight/total, 'REPLACE')
skin.parent = rig
modifier = skin.modifiers.new('Deforming Mulligan skeleton', 'ARMATURE')
modifier.object = rig

# All motion is baked on deforming joints. No object transform, driver or runtime IK.
# Feet stay planted by solving two-bone limb positions offline for each frame.
def aim_bone(name, head, tail):
    bone = rig.pose.bones[name]
    direction = Vector(tail)-Vector(head)
    # Preserve the authored bind roll: a fresh track quaternion would twist the
    # arms/hands even in frame 1, hiding front-facing detail and turning toes down.
    rest_direction = bone.bone.tail_local-bone.bone.head_local
    rotation = rest_direction.normalized().rotation_difference(direction.normalized())
    matrix = rotation.to_matrix().to_4x4() @ bone.bone.matrix_local
    matrix.translation = head
    bone.matrix = matrix


def solve_limb(a, b, c, hip_delta):
    # Keep the wrist/ankle fixed, with the knee/elbow bending along the rest plane.
    a0,b0,c0 = Vector(a),Vector(b),Vector(c)
    a = a0+hip_delta
    axis = (c0-a).normalized()
    l1, l2 = (b0-a0).length, (c0-b0).length
    distance = (c0-a).length
    along = (l1*l1-l2*l2+distance*distance)/(2*distance)
    height = math.sqrt(max(0, l1*l1-along*along))
    bend = b0-(a0+c0)*.5
    bend = (bend-axis*bend.dot(axis)).normalized()
    return a, a+axis*along+bend*height, c0


rig.animation_data_create()
action = bpy.data.actions.new('Idle')
rig.animation_data.action = action
for bone in rig.pose.bones:
    bone.rotation_mode = 'QUATERNION'

for frame in range(1,146):
    scene.frame_set(frame)
    phase = (frame-1)/144*math.tau
    for pb in rig.pose.bones:
        pb.location = (0,0,0)
        pb.rotation_quaternion = (1,0,0,0)
        pb.scale = (1,1,1)
    pelvis = rig.pose.bones['Pelvis']
    pelvis.location.x = .024*math.sin(phase)
    pelvis.location.z = .012*math.sin(phase*2)
    chest = rig.pose.bones['Chest']
    chest.rotation_mode = 'XYZ'
    chest.rotation_euler = (.013*math.sin(phase*2), .015*math.sin(phase), .012*math.sin(phase))
    chest.scale = (1+.018*math.sin(phase*2), 1+.009*math.sin(phase*2), 1+.012*math.sin(phase*2))
    neck = rig.pose.bones['Neck']
    neck.rotation_mode = 'XYZ'
    neck.rotation_euler = (.028*math.sin(phase*2), .035*math.sin(phase), .04*math.sin(phase))
    head = rig.pose.bones['Head']
    head.rotation_mode = 'XYZ'
    head.rotation_euler = (.025*math.sin(phase*2), .045*math.sin(phase), .10*math.sin(phase))
    jaw = rig.pose.bones['Jaw']
    jaw.rotation_mode = 'XYZ'
    # Hold the characteristic open V and breathe through it; no snap/attack clip.
    jaw.rotation_euler.x = .68+.18*(1-math.cos(phase))/2
    bpy.context.view_layer.update()
    for side in ['L','R']:
        for names in [(f'Arm.{side}',f'Forearm.{side}',f'Hand.{side}'),
                      (f'Thigh.{side}',f'Shin.{side}',f'Foot.{side}')]:
            upper,lower,foot = names
            a0 = armature.bones[upper].head_local
            b0 = armature.bones[lower].head_local
            c0 = armature.bones[foot].head_local
            parent = rig.pose.bones[upper].parent
            parent_rest = parent.bone.matrix_local
            delta = (parent.matrix @ parent_rest.inverted() @ a0)-a0
            a,b,c = solve_limb(a0,b0,c0,delta)
            aim_bone(upper,a,b)
            bpy.context.view_layer.update()
            aim_bone(lower,b,c)
            bpy.context.view_layer.update()
            aim_bone(foot,c,c+(armature.bones[foot].tail_local-c0))
            bpy.context.view_layer.update()
        for digit in range(1,4):
            for prefix in ['Finger','Toe']:
                pb = rig.pose.bones[f'{prefix}{digit}.{side}']
                pb.rotation_mode = 'XYZ'
                pb.rotation_euler.x = .035*math.sin(phase+(0 if side=='L' else math.pi))
    for pb in rig.pose.bones:
        pb.keyframe_insert('location', frame=frame, group=pb.name)
        pb.keyframe_insert('rotation_euler' if pb.rotation_mode == 'XYZ' else 'rotation_quaternion', frame=frame, group=pb.name)
        pb.keyframe_insert('scale', frame=frame, group=pb.name)

scene.frame_set(1)
rig['source_description'] = 'Mulligan adaptation from Joshua Broggi visual references, 15 November 2026'
rig['idle'] = 'Six seconds: breathing, head look, jaw opening, planted-foot weight shift, toe flex'
scene.world = bpy.data.worlds.new('Neutral studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes.get('Background').inputs[0].default_value = (.18,.18,.18,1)
scene.world.node_tree.nodes.get('Background').inputs[1].default_value = .4
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'mulligan.blend'), compress=True)
triangles = sum(len(p.vertices)-2 for p in mesh.polygons)
report = dict(bones=len(bones), vertices=len(verts), triangles=triangles,
              clip='Idle', fps=24, firstFrame=1, lastFrame=145, durationSeconds=6,
              source='build-mulligan.py', objectAnimation=False,
              skullProfile=HEAD_SECTIONS, mandibularRail=JAW_RAIL,
              teeth=88, shoulderNodules=20, chestCordLayers=19,
              jawOpeningDegrees=[round(math.degrees(.68),2),round(math.degrees(.86),2)],
              motions=['breathing','head turn and nod','jaw movement','planted-foot weight shift','toe flex'])
(HERE/'authoring-record.json').write_text(json.dumps(report,indent=2)+'\n')
print('AUTHORED MULLIGAN',json.dumps(report),flush=True)
