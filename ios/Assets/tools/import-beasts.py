"""Build the CC-BY companions with Blender 4.5's UsdSkel exporter.

blender --background --factory-startup --python ios/Assets/tools/import-beasts.py
Only the allowlisted files below are read. No attack/death clips are exported.
"""
import json
import math
import pathlib
import re
import struct
import bpy
from mathutils import Vector, Quaternion
from pxr import Usd, UsdSkel

ASSETS = pathlib.Path(__file__).resolve().parents[1]
REPO = ASSETS.parents[1]
SOURCE = next(p for p in (REPO / 'web/public/models', REPO / 'public/models') if p.exists())
BEASTS = [
    dict(id='t-rex', file='BuddyRex', name='Buddy Rex', source='rigged-t-rex-fabulous/source/rigged_t-rex_fabulous.glb',
         clip='CINEMA_4D_Main', color='#40C46B', speed=0.75, description='A tiny dinosaur with a big, wiggly hello.'),
    dict(id='scorpion', file='ScooterScorpion', name='Scooter the Scorpion', source='scorpion.glb',
         clip='Idle', color='#996BFF', speed=0.65, description='A little purple pal doing a sleepy wiggle.'),
    dict(id='spider', file='ButtonSpider', name='Button the Spider', source='theraphosa-blondi/source/hi-fi-spider.glb',
         clip='walk cycle', color='#FF7A9C', speed=0.3, description='Eight little feet practicing a silly tiptoe dance.'),
]


def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = 0.65
    return mat


def srgb(hex_color):
    values = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in values)


def bounds(meshes):
    deps = bpy.context.evaluated_depsgraph_get()
    points = [o.matrix_world @ Vector(p) for obj in meshes for o in [obj.evaluated_get(deps)] for p in o.bound_box]
    return Vector([min(p[i] for p in points) for i in range(3)]), Vector([max(p[i] for p in points) for i in range(3)])


def friendly_eyes(spec, arm):
    """Skin round toy eyes to the existing head bone; they move with the original skeleton."""
    white = material('EyeWhite', (0.95, 0.95, 0.85))
    dark = material('Pupil', (0.012, 0.025, 0.02))
    if spec['id'] == 't-rex':
        eyes = [(bone, arm.matrix_world @ arm.pose.bones[bone].head + Vector((side * 0.004, 0, 0.004)),
                 0.008, Vector((side * 0.65, -0.45, 0.45)))
                for side, bone in [(1, 'jt_Eye_L_012'), (-1, 'jt_Eye_R_013')]]
    elif spec['id'] == 'scorpion':
        eyes = [('body_00', Vector((side * 0.012, -0.065, 0.052)), 0.010, Vector((0, -0.8, 0.4)))
                for side in (-1, 1)]
    else:
        eyes = [('cephalothorax.M_71_12', Vector((side * 0.015, -0.043, 0.060)), 0.013,
                 Vector((0, -0.8, 0.4))) for side in (-1, 1)]
    result = []
    for bone_name, center, radius, gaze in eyes:
        bone = arm.pose.bones[bone_name]
        to_bind = arm.matrix_world @ bone.bone.matrix_local @ bone.matrix.inverted() @ arm.matrix_world.inverted()
        for name, mat, pos, size in [('FriendlyEye', white, center, radius),
                                     ('FriendlyPupil', dark, center + gaze.normalized() * radius * 0.8, radius * 0.5)]:
            bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=size, location=pos)
            obj = bpy.context.object
            obj.name = name
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
            for vertex in obj.data.vertices:
                vertex.co = to_bind @ vertex.co
            # Keep eyes and body under the same armature ancestor so USD can author one SkelRoot.
            obj.parent = arm
            obj.matrix_parent_inverse = arm.matrix_world.inverted()
            group = obj.vertex_groups.new(name=bone_name)
            group.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
            modifier = obj.modifiers.new('Follow the head', 'ARMATURE')
            modifier.object = arm
            obj.data.materials.append(mat)
            for face in obj.data.polygons:
                face.use_smooth = True
            result.append(obj)
    return result


def render_thumbnail(spec, meshes):
    scene = bpy.context.scene
    scene.frame_set(1)
    lo, hi = bounds(meshes)
    center = (lo + hi) / 2
    span = max(hi - lo)
    bpy.ops.object.camera_add(location=center + Vector((0.55, -1, 0.65)) * span * 2.2)
    camera = bpy.context.object
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = span * 1.25
    scene.camera = camera
    for position, energy, size in [((1, -2, 3), 100, 2), ((-2, -1, 1), 50, 2)]:
        bpy.ops.object.light_add(type='AREA', location=center + Vector(position) * span)
        light = bpy.context.object
        light.rotation_euler = (center - light.location).to_track_quat('-Z', 'Y').to_euler()
        light.data.energy = energy * span * span
        light.data.shape = 'DISK'
        light.data.size = size * span
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.render.resolution_x = scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'Standard'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(ASSETS / 'Thumbnails' / (spec['id'] + '.png'))
    bpy.ops.render.render(write_still=True)


def build(spec):
    path = SOURCE / spec['source']
    data = path.read_bytes()
    meta = json.loads(data[20:20 + struct.unpack_from('<I', data, 12)[0]])['asset']['extras']
    if not meta['license'].startswith('CC-BY-4.0 '):
        raise ValueError('Unexpected license: ' + str(path))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    scene = bpy.context.scene
    scene.render.fps = 24
    arm = next(o for o in scene.objects if o.type == 'ARMATURE')
    action = bpy.data.actions[spec['clip']]
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH' and (not obj.data.materials or (spec['id'] == 'spider' and obj.name == 'Object_14')):
            bpy.data.objects.remove(obj, do_unlink=True) # importer bone shapes / spider's hair cards
    for obj in scene.objects:
        if obj.animation_data:
            for track in obj.animation_data.nla_tracks:
                track.mute = True
    arm.animation_data.action = action
    if action.slots:
        arm.animation_data.action_slot = action.slots[0]
    scene.frame_set(0)
    # Non-armature actions (e.g. the spider's circular path) never travel across a chest preview.
    for obj in scene.objects:
        if obj.type != 'ARMATURE' and obj.animation_data:
            pose = obj.matrix_basis.copy()
            obj.animation_data_clear()
            obj.matrix_basis = pose
    scene.frame_start = 0
    scene.frame_end = round(action.frame_range[1])
    changes = 'Converted to USDZ; plain tintable toy colors; one slowed, in-place skeletal clip.'
    if spec['id'] == 't-rex':
        # The source is a long performance. Use its opening pose and the original rig for a new
        # closed-mouth greeting, not an unidentified section that might include a roar or lunge.
        bases = {b.name: b.matrix_basis.copy() for b in arm.pose.bones}
        arm.animation_data_clear()
        for b in arm.pose.bones:
            b.matrix_basis = bases[b.name]
            b.rotation_mode = 'QUATERNION'
        scene.frame_start, scene.frame_end = 0, 64
        for frame in (0, 16, 32, 48, 64):
            wave = math.sin(frame / 64 * math.tau)
            for b in arm.pose.bones:
                b.matrix_basis = bases[b.name]
                if b.name in ('jt_Head_C_08', 'jt_Tail2_C_033', 'jt_Tail3_C_034'):
                    b.rotation_quaternion = b.rotation_quaternion @ Quaternion((0, 0, 1), math.radians(4) * wave)
                b.keyframe_insert('location', frame=frame)
                b.keyframe_insert('rotation_quaternion', frame=frame)
                b.keyframe_insert('scale', frame=frame)
        changes += ' New gentle head-and-tail greeting on the original skeleton.'
    arm.animation_data.action.name = 'GentleIdle'
    scene.frame_set(0)
    body_material = material('Tint', (0.85, 0.85, 0.85))
    meshes = [o for o in scene.objects if o.type == 'MESH']
    for index, obj in enumerate(meshes):
        obj.name = 'BeastBody' if index == 0 else 'BeastBody' + str(index)
        obj.data.name = obj.name + 'Mesh'
        obj.data.materials.clear()
        obj.data.materials.append(body_material)
        for poly in obj.data.polygons:
            poly.material_index = 0
            poly.use_smooth = True
        if len(obj.data.polygons) > 8000:
            bpy.context.view_layer.objects.active = obj
            modifier = obj.modifiers.new('Treasure-sized detail', 'DECIMATE')
            modifier.ratio = 7000 / len(obj.data.polygons)
            # Apply before the armature: preserve joints and weights, never bake the deformed mesh.
            bpy.ops.object.modifier_move_up(modifier=modifier.name)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    # A wrapper normalizes size without applying transforms to the skin or changing bind poses.
    wrapper = bpy.data.objects.new('Companion', None)
    roots = [o for o in scene.objects if o.parent is None]
    scene.collection.objects.link(wrapper)
    for obj in roots:
        obj.parent = wrapper
    bpy.context.view_layer.update()
    lo, hi = bounds(meshes)
    factor = 0.32 / max(hi - lo)
    wrapper.scale = (factor,) * 3
    wrapper.location = Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)) * factor
    bpy.context.view_layer.update()
    lo, hi = bounds(meshes)
    eye_meshes = friendly_eyes(spec, arm)
    changes += ' Oversized eyes skinned to the head; original textures removed.'
    if spec['id'] == 'spider':
        changes += ' Body mesh decimated and hair cards removed for a smooth toy finish.'
    dest = ASSETS / 'Models' / (spec['file'] + '.usdz')
    bpy.ops.wm.usd_export(filepath=str(dest), export_animation=True, export_armatures=True,
                          export_shapekeys=False, only_deform_bones=False, export_textures=False,
                          export_cameras=False, export_lights=False, convert_orientation=True,
                          export_global_forward_selection='NEGATIVE_Z', export_global_up_selection='Y',
                          root_prim_path='/Treasure', export_custom_properties=False)
    # Inspect authored structure during conversion; app/device animation is deliberately not run.
    stage = Usd.Stage.Open(str(dest))
    animations = [UsdSkel.Animation(p) for p in stage.Traverse() if p.IsA(UsdSkel.Animation)]
    print('EXPORTED', dest.name, dest.stat().st_size, 'bytes;', len(animations), 'skeletal clip(s)', flush=True)
    if not animations or not animations[0].GetRotationsAttr().GetTimeSamples():
        raise RuntimeError('Exporter lost the skeletal clip')
    if dest.stat().st_size > 2_000_000:
        raise RuntimeError('Model exceeds 2 MB')
    # Thumbnails show the default child-selectable color, using the same exported mesh/pose.
    body_material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*srgb(spec['color']), 1)
    render_thumbnail(spec, meshes + eye_meshes)
    author = re.fullmatch(r'(.+) \((https?://.+)\)', meta['author'])
    return dict(id=spec['id'], displayName=spec['name'], kind='treasure', file='Models/' + dest.name,
                thumbnail='Thumbnails/' + spec['id'] + '.png', description=spec['description'],
                heightMeters=round(hi.z - lo.z, 4), tintMaterial='Tint', tintableParts=[o.name for o in meshes],
                defaultColor=spec['color'], idleMotion='skeletal', movingParts=[],
                skeletalAnimation=dict(name='GentleIdle', sourceClip=spec['clip'], speed=spec['speed']),
                attribution=dict(title=meta['title'], author=author[1], authorURL=author[2], source=meta['source'],
                                 license='CC BY 4.0', licenseURL='https://creativecommons.org/licenses/by/4.0/', changes=changes))


entries = [build(spec) for spec in BEASTS]
manifest_path = ASSETS / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
by_id = {entry['id']: entry for entry in entries}
manifest['models'] = [by_id.pop(e['id'], e) for e in manifest['models']] + list(by_id.values())
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
