"""Blender 4.5+: convert configured GLB or native .blend companions into animated USDZ.
blender --background --factory-startup --python convert-rigged-beasts.py -- [--config FILE] [ID ...]
This builds assets; it does not launch the app or run its tests.
"""
import argparse
import json
import math
from pathlib import Path
import sys
import bpy
from mathutils import Vector
from pxr import Usd, UsdSkel, UsdGeom, UsdShade

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent


def inspect_package(path, spec):
    stage = Usd.Stage.Open(str(path))
    animations = [UsdSkel.Animation(p) for p in stage.Traverse() if p.IsA(UsdSkel.Animation)]
    skeletons = [UsdSkel.Skeleton(p) for p in stage.Traverse() if p.IsA(UsdSkel.Skeleton)]
    if len(animations) != 1 or not skeletons:
        raise ValueError('Deliver one idle skeletal clip and at least one skeleton')
    if not all(s.GetJointsAttr().Get() and s.GetBindTransformsAttr().Get() and
               s.GetRestTransformsAttr().Get() for s in skeletons):
        raise ValueError('Skeleton must retain joint names, bind transforms and rest transforms')
    skin_meshes = [p for p in stage.Traverse() if p.IsA(UsdGeom.Mesh) and
                   UsdSkel.BindingAPI(p).GetJointWeightsPrimvar().HasValue() and
                   UsdSkel.BindingAPI(p).GetJointIndicesPrimvar().HasValue()]
    if not skin_meshes:
        raise ValueError('No skinned mesh weights/indices in USDZ')
    if tint_name := spec.get('tintMaterial'):
        bound_materials = [UsdShade.MaterialBindingAPI(mesh).ComputeBoundMaterial()[0] for mesh in skin_meshes]
        if not any(material and material.GetPrim().GetName() == tint_name for material in bound_materials):
            raise ValueError('No skinned mesh uses the configured tint material: ' + tint_name)
    rotations = animations[0].GetRotationsAttr()
    if not rotations.GetTimeSamples():
        raise ValueError('Skeletal animation was lost during export')
    channels = [rotations, animations[0].GetTranslationsAttr(), animations[0].GetScalesAttr()]
    if not any(len(a.GetTimeSamples()) > 1 and any(a.Get(t) != a.Get(a.GetTimeSamples()[0])
               for t in a.GetTimeSamples()[1:]) for a in channels):
        raise ValueError('The idle must actually change joint poses over time')
    if UsdGeom.GetStageUpAxis(stage) != 'Y' or abs(UsdGeom.GetStageMetersPerUnit(stage) - 1) > 0.00001:
        raise ValueError('iPhone assets must use Y-up and meters')
    if path.stat().st_size > spec.get('maxBytes', 2000000):
        raise ValueError('USDZ exceeds size budget: ' + str(path.stat().st_size))
    return len(animations)


def catalog_entry(spec, height):
    entry = {key: spec[key] for key in ('id', 'displayName', 'file', 'thumbnail', 'description', 'defaultColor')}
    entry.update(kind='treasure', heightMeters=round(height, 4),
                 tintableParts=spec.get('tintableParts', []), idleMotion='skeletal', movingParts=[],
                 skeletalAnimation=dict(name=spec.get('animationName', 'GentleIdle'), sourceClip=spec['clip'],
                                        speed=spec.get('speed', 1)), provenance=spec['provenance'])
    if spec.get('tintMaterial'):
        entry['tintMaterial'] = spec['tintMaterial']
    if spec.get('attribution'):
        entry['attribution'] = spec['attribution']
    return entry


def native_package(spec, source, config_dir):
    """A directly authored UsdSkel USDZ needs packaging only, with no intermediate conversion."""
    inspect_package(source, spec)
    picture = (config_dir / spec['thumbnailSource']).resolve()
    picture_bytes = picture.read_bytes()
    if not picture_bytes.startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError('Provide a PNG thumbnail for native USDZ')
    height = spec['heightMeters']
    if height <= 0:
        raise ValueError('Provide the native USDZ height in meters')
    model = ASSETS / spec['file']
    picture_out = ASSETS / spec['thumbnail']
    model.parent.mkdir(parents=True, exist_ok=True)
    picture_out.parent.mkdir(parents=True, exist_ok=True)
    model.write_bytes(source.read_bytes())
    picture_out.write_bytes(picture_bytes)
    print('PACKAGED', spec['id'], source.stat().st_size, 'bytes; native skeletal USDZ', flush=True)
    return catalog_entry(spec, height)


def bounds(meshes):
    deps = bpy.context.evaluated_depsgraph_get()
    points = [obj.matrix_world @ Vector(corner) for mesh in meshes
              for obj in [mesh.evaluated_get(deps)] for corner in obj.bound_box]
    if not points:
        raise ValueError('No visible mesh')
    return Vector([min(p[i] for p in points) for i in range(3)]), Vector([max(p[i] for p in points) for i in range(3)])


def thumbnail(spec, meshes):
    scene = bpy.context.scene
    low, high = bounds(meshes)
    center = (low + high) / 2
    span = max(high - low)
    bpy.ops.object.camera_add(location=center + Vector((0.8, -1.6, 0.7)) * span)
    camera = bpy.context.object
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = span * 1.25
    scene.camera = camera
    for position, power in [((1, -2, 3), 130), ((-2, -1, 1), 80)]:
        bpy.ops.object.light_add(type='AREA', location=center + Vector(position) * span)
        lamp = bpy.context.object
        lamp.rotation_euler = (center - lamp.location).to_track_quat('-Z', 'Y').to_euler()
        lamp.data.energy = power * span * span
        lamp.data.size = span * 2
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.render.resolution_x = scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(ASSETS / spec['thumbnail'])
    scene.view_settings.view_transform = 'Standard'
    bpy.ops.render.render(write_still=True)


def convert(spec, config_dir):
    source = (config_dir / spec['source']).resolve()
    if source.suffix.lower() == '.usdz':
        return native_package(spec, source, config_dir)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if source.suffix.lower() == '.blend':
        # Never execute embedded scripts or drivers from supplied source files.
        bpy.ops.wm.open_mainfile(filepath=str(source), use_scripts=False)
    elif source.suffix.lower() in ('.glb', '.gltf'):
        bpy.ops.import_scene.gltf(filepath=str(source))
    else:
        raise ValueError('Use GLB/glTF, .blend or native .usdz source: ' + str(source))
    scene = bpy.context.scene
    # An input must supply a real rig and explicit idle; never silently export a static pose.
    rigs = [o for o in scene.objects if o.type == 'ARMATURE']
    if not rigs:
        raise ValueError(spec['id'] + ': no skeleton')
    source_action = bpy.data.actions.get(spec['clip'])
    if not source_action:
        raise ValueError(spec['id'] + ': missing action ' + spec['clip'])
    animated_rigs = []
    for rig in rigs:
        data = rig.animation_data_create()
        for track in data.nla_tracks:
            track.mute = True
        # Single-rig sources bind explicitly; multi-rig inputs must already have their idle bound.
        if len(rigs) == 1:
            data.action = source_action
            if source_action.slots:
                data.action_slot = source_action.slots[0]
        if data.action:
            if data.action != source_action:
                raise ValueError('Multi-rig source must bind only the configured idle action')
            animated_rigs.append(rig)
    if not animated_rigs:
        raise ValueError('No armature bound to the idle')
    source_action.name = 'GentleIdle'
    scene.frame_start = math.floor(source_action.frame_range[0])
    scene.frame_end = math.ceil(source_action.frame_range[1])
    scene.frame_set(scene.frame_start)
    for obj in scene.objects:
        if obj.type != 'ARMATURE' and obj.animation_data:
            transform = obj.matrix_basis.copy()
            obj.animation_data_clear()
            obj.matrix_basis = transform
    widgets = {bone.custom_shape for rig in rigs for bone in rig.pose.bones if bone.custom_shape}
    meshes = [o for o in scene.objects if o.type == 'MESH' and not o.hide_render and o not in widgets]
    if not any(any(m.type == 'ARMATURE' for m in mesh.modifiers) for mesh in meshes):
        raise ValueError('No skinned mesh')
    # Strip generated import bone widgets and authoring props, not the skinned body.
    for obj in list(scene.objects):
        if obj.type == 'MESH' and obj not in meshes:
            bpy.data.objects.remove(obj, do_unlink=True)
    triangle_budget = spec.get('triangleBudget', 14000)
    triangles = sum(sum(len(p.vertices) - 2 for p in mesh.data.polygons) for mesh in meshes)
    for mesh in meshes:
        if triangles > triangle_budget:
            bpy.context.view_layer.objects.active = mesh
            modifier = mesh.modifiers.new('iPhone detail budget', 'DECIMATE')
            modifier.ratio = triangle_budget / triangles
            # Apply in bind space before the armature, preserving skin weights.
            while list(mesh.modifiers).index(modifier) > 0:
                bpy.ops.object.modifier_move_up(modifier=modifier.name)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        for polygon in mesh.data.polygons:
            polygon.use_smooth = True
    # Native sources can opt into plain body tint; otherwise preserve their authored materials.
    for name in spec.get('tintableParts', []):
        mesh = bpy.data.objects.get(name)
        if not mesh or mesh not in meshes:
            raise ValueError('Unknown tint mesh: ' + name)
    roots = [o for o in scene.objects if o.parent is None]
    wrapper = bpy.data.objects.new('Companion', None)
    scene.collection.objects.link(wrapper)
    for obj in roots:
        obj.parent = wrapper
    bpy.context.view_layer.update()
    low, high = bounds(meshes)
    factor = spec.get('sizeMeters', 0.32) / max(high - low)
    wrapper.scale = (factor,) * 3
    wrapper.location = Vector((-(low.x + high.x) / 2, -(low.y + high.y) / 2, -low.z)) * factor
    # Source glTF faces +Z in Y-up; Blender's import makes it -Y in Z-up.
    # Blender's native -Z-forward export converts that back to the app's +Z view.
    bpy.context.view_layer.update()
    low, high = bounds(meshes)
    destination = ASSETS / spec['file']
    destination.parent.mkdir(parents=True, exist_ok=True)
    stage_file = HERE / '.build' / (spec['id'] + '.usdz')
    stage_file.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.usd_export(filepath=str(stage_file), export_animation=True, export_armatures=True,
                          export_shapekeys=False, only_deform_bones=False, export_textures=True,
                          export_cameras=False, export_lights=False, convert_orientation=True,
                          export_global_forward_selection='NEGATIVE_Z', export_global_up_selection='Y',
                          usdz_downscale_size='512', root_prim_path='/Treasure', export_custom_properties=False)
    animation_count = inspect_package(stage_file, spec)
    destination.write_bytes(stage_file.read_bytes())
    thumbnail(spec, meshes)
    print('EXPORTED', spec['id'], destination.stat().st_size, 'bytes;', animation_count, 'skeletal animation(s)', flush=True)
    return catalog_entry(spec, high.z - low.z)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', type=Path, default=HERE / 'rigged-beasts.json')
    parser.add_argument('ids', nargs='*')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    config = json.loads(args.config.read_text())
    specs = config['beasts']
    if len({s['id'] for s in specs}) != len(specs):
        raise ValueError('Duplicate beast ID in config')
    for spec in specs:
        if not 0 < spec.get('speed', 1) <= 1:
            raise ValueError('Use a gentle playback speed greater than 0 and at most 1')
        for key in ('file', 'thumbnail'):
            if not (ASSETS / spec[key]).resolve().is_relative_to(ASSETS):
                raise ValueError('Output paths must stay inside Assets')
    if args.ids:
        unknown = set(args.ids) - {s['id'] for s in specs}
        if unknown:
            raise ValueError('Unknown beast IDs: ' + ', '.join(sorted(unknown)))
        specs = [s for s in specs if s['id'] in args.ids]
    entries = [convert(spec, args.config.resolve().parent) for spec in specs]
    manifest_file = ASSETS / 'manifest.json'
    manifest = json.loads(manifest_file.read_text())
    updates = {e['id']: e for e in entries}
    manifest['models'] = [updates.pop(e['id'], e) for e in manifest['models']] + list(updates.values())
    manifest_file.write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
