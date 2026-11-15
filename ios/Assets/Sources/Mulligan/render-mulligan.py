"""Render the authored idle for art review, not app/runtime verification.

blender --background --factory-startup --python render-mulligan.py
Outputs transparent source frames in tools/.build/mulligan-preview/.
"""
from pathlib import Path
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
OUTPUT = HERE.parent.parent / 'tools' / '.build' / 'mulligan-preview'
OUTPUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(HERE/'mulligan.blend'), use_scripts=False)
scene = bpy.context.scene
center = Vector((0,-.2,1.28))
bpy.ops.object.camera_add(location=(4.7,-6.8,3.7))
camera = bpy.context.object
camera.rotation_euler = (center-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 3.85
scene.camera = camera
for pos, power, size in [((3,-4,6),650,5),((-4,-2,3),400,4),((1,3,5),650,3)]:
    bpy.ops.object.light_add(type='AREA',location=pos)
    light = bpy.context.object
    light.rotation_euler = (center-light.location).to_track_quat('-Z','Y').to_euler()
    light.data.energy = power
    light.data.size = size
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'Standard'
for frame in range(1,145,4):
    scene.frame_set(frame)
    scene.render.filepath = str(OUTPUT/f'idle-{frame:03}.png')
    bpy.ops.render.render(write_still=True)
# A separate rear view records the branches and four-limbed anatomy.
scene.frame_set(1)
camera.location = (3,6,3.1)
camera.rotation_euler = (center-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath = str(OUTPUT/'rear.png')
bpy.ops.render.render(write_still=True)
# Front and profile views make the narrow skull/jaw proportions reviewable.
for name, position in [('front',(0,-7,2.3)),('side',(7,-.2,2.3))]:
    camera.location = position
    camera.rotation_euler = (center-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath = str(OUTPUT/f'{name}.png')
    bpy.ops.render.render(write_still=True)
