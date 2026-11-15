"""Author Mulligan's iPhone-first skin, deforming rig and baked six-second idle.

Blender 4.5: blender --background --factory-startup --python build-mulligan.py
Then run tools/convert-rigged-beasts.py -- mulligan. No external assets or add-ons.
Coordinates: Z up, facing -Y. The shared converter supplies iPhone framing/units.
The character adaptation follows Joshua's three supplied toy photographs.
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
DARK = (0.035, 0.043, 0.031)
IVORY = (0.80, 0.64, 0.30)
MOUTH = (0.052, 0.013, 0.022)

# Joshua's reference has a narrow, deep skull and an even narrower lower jaw.
# Apply the same transverse proportion to the skin, lips, teeth and forehead ridges,
# retaining their depth/height and the existing centerline head/jaw bind poses.
HEAD_WIDTH_SCALE = .55
JAW_WIDTH_SCALE = .50


def mix(a, b, t):
    t = min(1, max(0, t))
    return tuple(x * (1-t) + y*t for x, y in zip(a, b))


def skin_color(p):
    # The references have pink hands/feet, ochre transitions and an olive torso.
    t = (p.z - 0.40) / 0.85
    return mix(PINK, OCHRE, t * 2) if t < .5 else mix(OCHRE, OLIVE, (t-.5)*2)


verts, faces, colors, weights, materials = [], [], [], [], []


def vertex(p, color, weight):
    p = Vector(p)
    assignment = weight(p) if callable(weight) else weight
    if set(assignment) <= {'Neck', 'Head', 'Jaw'}:
        p.x *= JAW_WIDTH_SCALE if 'Jaw' in assignment else HEAD_WIDTH_SCALE
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

    tube([(s*.40,-.30,2.00), (s*.62,-.43,2.01), shoulder, shoulder.lerp(elbow,.4), elbow,
          elbow.lerp(wrist,.4), elbow.lerp(wrist,.75), wrist],
         [.10, .25, .36, .33, .23, .22, .14, .115], skin_color, arm_weights, sides=20)
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
    t = min(1, max(0, (-p.y-.69)/1.15))
    return mix(OLIVE, OCHRE, t*1.8) if t < .52 else mix(OCHRE, PINK, (t-.52)/.48)


def muzzle(sections, bone, lower=False):
    rows = []
    for y, width, z, height in sections:
        row = []
        for i in range(24):
            angle = i*math.tau/24
            p = Vector((math.cos(angle)*width, y, z+math.sin(angle)*height))
            row.append(vertex(p, PINK if lower else head_color, {bone:1}))
        rows.append(row)
    face(tuple(reversed(rows[0])))
    for j in range(len(rows)-1):
        for i in range(24):
            n = (i+1)%24
            face((rows[j][i], rows[j][n], rows[j+1][n], rows[j+1][i]))
    face(tuple(rows[-1]))


# Narrow eyeless skull and tapered jaw; vertex() also narrows the mouth details.
ellipsoid((0,-.65,2.10), (.60,.48,.39), head_color, {'Neck':.3,'Head':.7}, 24, 12)
muzzle([(-.72,.49,2.14,.31), (-1.04,.61,2.17,.28), (-1.40,.57,2.15,.22),
        (-1.69,.47,2.12,.15), (-1.86,.37,2.10,.105), (-1.91,.29,2.10,.085)], 'Head')
ellipsoid((0,-1.42,1.975), (.48,.49,.075), MOUTH, {'Head':1}, 24, 8, mat=2)
muzzle([(-.94,.34,1.91,.085), (-1.27,.49,1.855,.095), (-1.61,.46,1.84,.08),
        (-1.83,.34,1.87,.065), (-1.89,.25,1.895,.04)], 'Jaw', lower=True)

for s in [-1,1]:
    lip_points = [(s*.38,-.98,1.99),(s*.54,-1.26,2.00),(s*.48,-1.54,2.005),
                  (s*.37,-1.77,2.015),(s*.25,-1.89,2.025)]
    tube(lip_points, [.045,.05,.047,.043,.03], PINK, {'Head':1}, sides=8)
    tube([(s*.36,-1.0,1.91),(s*.48,-1.25,1.91),(s*.43,-1.58,1.90),(s*.28,-1.83,1.925)],
         [.035,.04,.04,.025], PINK, {'Jaw':1}, sides=8)
    # Stubby ochre teeth follow each side of the mouth, upper and lower.
    for i in range(10):
        t = i/9
        y = -1.10-.72*t
        x = s*(.51-.23*t*t)
        size = .045 + .015*math.sin(t*math.pi)
        tube([(x,y,2.025),(x-s*.013,y-.008,1.985),(x-s*.018,y-.005,1.96)],
             [size,size*.70,.008], IVORY, {'Head':1}, sides=7, mat=3)
        tube([(x*.92,y+.012,1.92),(x*.92-s*.012,y,1.96),(x*.92-s*.015,y,1.975)],
             [size*.85,size*.55,.005], IVORY, {'Jaw':1}, sides=7, mat=3)

for i in range(7):
    x = (i-3)*.068
    y = -1.915+.025*abs(i-3)/3
    tube([(x,y,2.025),(x,y-.012,1.985),(x,y-.01,1.965)],
         [.036,.025,.007], IVORY, {'Head':1}, sides=7, mat=3)
    tube([(x,y+.014,1.93),(x,y+.005,1.965),(x,y+.008,1.98)],
         [.030,.018,.005], IVORY, {'Jaw':1}, sides=7, mat=3)


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

# Chest scratches/ribs and shoulder branches retain the photographic silhouette.
for s in [-1,1]:
    for j in range(4):
        z = 1.45+j*.15
        ridge([(s*.11,-.935,z),(s*.29,-.91,z-.025),(s*.51,-.81,z+.015)],
              .026, {'Chest':1})
    for j in range(3):
        z = 1.55+j*.18
        ridge([(s*.80,-.90,z+.13),(s*.92,-.83,z),
               (s*1.01,-.67,z-.04)], .031, {f'Arm.{"L" if s>0 else "R"}':1})
    # Black vein branches on the olive forehead; face remains eyeless.
    for y in [-.80,-1.03,-1.26]:
        ridge([(s*.08,y,2.435-(abs(y)-.8)*.25),
               (s*.27,y-.07,2.43-(abs(y)-.8)*.22),
               (s*.43,y+.02,2.36-(abs(y)-.8)*.20),
               (s*.52,y-.09,2.24-(abs(y)-.8)*.17)], .024, {'Head':1})

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
    matrix = direction.to_track_quat('Y','Z').to_matrix().to_4x4()
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
    jaw.rotation_euler.x = .075*(1-math.cos(phase))/2
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
              headWidthScale=HEAD_WIDTH_SCALE, jawWidthScale=JAW_WIDTH_SCALE,
              motions=['breathing','head turn and nod','jaw movement','planted-foot weight shift','toe flex'])
(HERE/'authoring-record.json').write_text(json.dumps(report,indent=2)+'\n')
print('AUTHORED MULLIGAN',json.dumps(report),flush=True)
