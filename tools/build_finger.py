"""Bangun model 3D aktuator jari (motor mini + worm gear + tendon) di Blender.

Pakai (dari root repo):
  blender --background --factory-startup --python tools/build_finger.py

Hasil: model/actuator_finger.blend, model/actuator_finger.glb, actuator_finger_geo.txt

Prinsip: motor kecil memutar ulir cacing (worm); worm memutar roda gigi + puli tendon (r = 5 mm, sama dengan
rumus halaman). Tendon fleksor ditarik puli dan menekuk tiga ruas jari. Sudut ulir kecil -> self-locking.

Tata letak: panjang jari searah +Z Blender (layar: ke kanan), sisi telapak +X (layar: ke bawah),
sendi berputar pada sumbu Y. Nama objek dipakai src/p65_lab3d.js:
  palm, motor, worm (putar sumbu Z), wheel (roda + puli, putar sumbu Y),
  phalanx_1 > phalanx_2 > phalanx_3 (origin di sendi), tip_sensor, egg,
  tendon_0..tendon_6 (empty: titik lintasan tendon, digambar ulang tiap frame di halaman)
"""
import math, os, sys
import bpy, bmesh

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from act_common import *  # noqa: F401,F403

scene = new_scene()
M = materials()
M['print'] = mat('PrintedPLA', (0.045, 0.047, 0.052), 0.0, 0.62)
M['spool'] = mat('SpoolWhite', (0.86, 0.87, 0.88), 0.0, 0.45)
M['worm'] = mat('WormSteel', (0.66, 0.68, 0.72), 1.0, 0.2)
M['wheel'] = mat('WheelBronze', (0.72, 0.56, 0.30), 1.0, 0.3)
M['pad'] = mat('TactilePad', (0.85, 0.62, 0.12), 0.0, 0.5)
M['egg'] = mat('Egg', (0.93, 0.88, 0.80), 0.0, 0.45)


def rounded_box(name, sx, sy, z0, z1, x0, material, bevel=0.002):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(sx, sy, z1 - z0), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(x0, 0, (z0 + z1) / 2), verts=bm.verts)
    o = obj_from_bm(name, bm, material, smooth_angle=0.6)
    b = o.modifiers.new('b', 'BEVEL'); b.width = bevel; b.segments = 3
    apply_mods(o)
    return o


def cyl_y(name, r, y0, y1, x, z, material, n=32):
    """Silinder bersumbu Y."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=n, radius1=r, radius2=r, depth=y1 - y0)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(x, (y0 + y1) / 2, z))
    return obj_from_bm(name, bm, material)


def empty(name, parent, loc):
    e = link(bpy.data.objects.new(name, None))
    e.empty_display_size = 0.002
    e.parent = parent
    e.location = loc
    return e


# ---------------------------------------------------------------- geometri dasar
WORM_X, WORM_Z0, WORM_Z1 = -0.0062, -0.056, -0.034
WR_ROOT, WR_TIP, W_PITCH = 0.0027, 0.0040, 0.0016
WHEEL_R = 0.0102                 # puncak gigi roda
WHEEL_X = WORM_X + WR_TIP + WHEEL_R - 0.0012
WHEEL_Z = (WORM_Z0 + WORM_Z1) / 2
RP = 0.005                        # jari-jari puli tendon (rumus: F = τ·N·η ÷ r_puli)
SPOOL_Y = -0.0068                 # puli di depan roda (sisi kamera = −Y)
SEG = [0.045, 0.032, 0.024]       # panjang ruas proksimal, tengah, distal
KS = [0.9, 1.1, 0.8]              # faktor tekuk tiap sendi (sama dengan animasi 2D)

parts = []

# 1. Rangka telapak: pelat samping belakang + dudukan motor + bantalan poros roda + pemandu tendon
plate = rounded_box('palm', 0.036, 0.003, -0.086, 0.004, -0.002, M['print'], 0.0012)
plate.location.y = 0.0105
bpy.context.view_layer.objects.active = plate
bpy.ops.object.select_all(action='DESELECT'); plate.select_set(True)
bpy.ops.object.transform_apply(location=True)
plate['zc'] = 0
mount = rounded_box('mount', 0.017, 0.017, -0.084, -0.076, WORM_X, M['print'], 0.001)
boss = cyl_y('boss', 0.0042, 0.0005, 0.0095, WHEEL_X, WHEEL_Z, M['print'])
guide = rounded_box('guide', 0.004, 0.012, -0.016, -0.004, 0.0085, M['print'], 0.0008)
knuckle = rounded_box('knuckle', 0.016, 0.009, -0.010, 0.0, 0.0, M['print'], 0.0015)
knuckle.location.y = 0.0045
bpy.ops.object.select_all(action='DESELECT'); knuckle.select_set(True); bpy.context.view_layer.objects.active = knuckle
bpy.ops.object.transform_apply(location=True)
palm = join('palm', [plate, mount, boss, guide, knuckle])
parts.append(palm)

# 2. Motor mini (coreless) + kabel kecil
motor = lathe('motor', [(0.0, -0.0835), (0.0062, -0.0835), (0.0065, -0.082), (0.0065, -0.061), (0.0062, -0.0595),
                        (0.0016, -0.0595), (0.0016, WORM_Z0), (0.0, WORM_Z0)], M['alu'], 48)
for o in [motor]:
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    o.location.x = WORM_X
    bpy.ops.object.transform_apply(location=True)
band = lathe('mband', [(0.0066, -0.078), (0.0068, -0.078), (0.0068, -0.072), (0.0066, -0.072)], M['alu_dark'], 48)
band.location.x = WORM_X
bpy.ops.object.select_all(action='DESELECT'); band.select_set(True); bpy.context.view_layer.objects.active = band
bpy.ops.object.transform_apply(location=True)
motor = join('motor', [motor, band])
parts.append(motor)

# 3. Worm: ulir heliks satu start (modifier Screw), origin di sumbu poros agar bisa diputar di halaman
bm = bmesh.new()
pv = [bm.verts.new(v) for v in [(WR_ROOT, 0, 0), (WR_TIP, 0, W_PITCH * .35), (WR_TIP, 0, W_PITCH * .65), (WR_ROOT, 0, W_PITCH)]]
for i in range(3):
    bm.edges.new((pv[i], pv[i + 1]))
me = bpy.data.meshes.new('wthr'); bm.to_mesh(me); bm.free()
wthr = link(bpy.data.objects.new('wthr', me))
sm = wthr.modifiers.new('Screw', 'SCREW')
sm.angle = TAU; sm.screw_offset = W_PITCH; sm.steps = 32; sm.render_steps = 32
sm.iterations = int((WORM_Z1 - WORM_Z0 - 0.004) / W_PITCH); sm.use_merge_vertices = True
wthr.location = (0, 0, WORM_Z0 + 0.002)
wthr.data.materials.append(M['worm'])
apply_mods(wthr)
bpy.ops.object.select_all(action='DESELECT'); wthr.select_set(True); bpy.context.view_layer.objects.active = wthr
bpy.ops.object.transform_apply(location=True)
for p in wthr.data.polygons:
    p.use_smooth = True
wcore = lathe('wcore', [(0.0, WORM_Z0), (WR_ROOT + 0.00002, WORM_Z0), (WR_ROOT + 0.00002, WORM_Z1), (0.0, WORM_Z1)], M['worm'], 32)
worm = join('worm', [wcore, wthr])
worm.location.x = WORM_X  # objek di sumbu poros, geometri di origin
parts.append(worm)

# 4. Roda gigi worm (24 gigi) + puli tendon putih bersayap, satu objek berporos Y di (WHEEL_X, WHEEL_Z)
NT = 24
bm = bmesh.new()
profile_ring(bm, lambda a: tooth(a, NT, WHEEL_R - 0.0016, 0.0016), lambda a: 0.0016, -0.0025, 0.0025, NT * 8)
gear = obj_from_bm('gear', bm, M['wheel'], smooth_angle=1.2)
spool = lathe('spool', [(0.0016, -0.0024), (RP + 0.0016, -0.0024), (RP + 0.0016, -0.0018), (RP, -0.0014), (RP, 0.0014),
                        (RP + 0.0016, 0.0018), (RP + 0.0016, 0.0024), (0.0016, 0.0024)], M['spool'], 48)
spool.location.z = SPOOL_Y  # sebelum diputar: z lokal = sumbu Y nanti
bpy.ops.object.select_all(action='DESELECT'); spool.select_set(True); bpy.context.view_layer.objects.active = spool
bpy.ops.object.transform_apply(location=True)
axle = lathe('axle', [(0.0, SPOOL_Y - 0.003), (0.0012, SPOOL_Y - 0.003), (0.0012, 0.0095), (0.0, 0.0095)], M['steel'], 16)
wheel = join('wheel', [gear, spool, axle])
wheel.rotation_euler = (-math.pi / 2, 0, 0)  # Rx(−90°): sumbu Z lokal -> +Y global, puli ke −Y (sisi kamera)
bpy.ops.object.select_all(action='DESELECT'); wheel.select_set(True); bpy.context.view_layer.objects.active = wheel
bpy.ops.object.transform_apply(rotation=True)
wheel.location = (WHEEL_X, 0, WHEEL_Z)
parts.append(wheel)

# 5. Tiga ruas jari, bersarang; origin tiap ruas di sendinya
def phalanx(name, L, half_x, half_y, parent, z_at):
    body_ = rounded_box(name, half_x * 2, half_y * 2, 0.0035, L - 0.0025, 0.0, M['print'], 0.0022)
    barrel = cyl_y(name + '_b', half_x * .92, -half_y - 0.0005, half_y + 0.0005, 0.0, 0.0, M['print'])
    pin = cyl_y(name + '_p', 0.0012, -half_y - 0.0016, half_y + 0.0016, 0.0, 0.0, M['steel'], 16)
    o = join(name, [body_, barrel, pin])
    if parent:
        o.parent = parent
    o.location = (0, 0, z_at)
    return o


p1 = phalanx('phalanx_1', SEG[0], 0.0068, 0.0078, None, 0.0)
p2 = phalanx('phalanx_2', SEG[1], 0.0063, 0.0072, p1, SEG[0])
p3 = phalanx('phalanx_3', SEG[2], 0.0058, 0.0066, p2, SEG[1])
# ujung distal dibulatkan + bantalan taktil di sisi telapak
cap_ = lathe('cap', [(0.0, SEG[2] - 0.004), (0.0058, SEG[2] - 0.004), (0.0052, SEG[2] - 0.001), (0.003, SEG[2] + 0.0015), (0.0, SEG[2] + 0.002)], M['print'], 32)
cap_.parent = p3
bpy.ops.object.select_all(action='DESELECT'); cap_.select_set(True); p3.select_set(True); bpy.context.view_layer.objects.active = p3
bpy.ops.object.join()
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=1)
bmesh.ops.scale(bm, vec=(0.0022, 0.0055, 0.0085), verts=bm.verts)
bmesh.ops.translate(bm, vec=(0.0055, 0, SEG[2] * .58), verts=bm.verts)
pad = obj_from_bm('tip_sensor', bm, M['pad'])
pad.parent = p3
parts.append(p1)

# 6. Titik lintasan tendon fleksor (sisi telapak, bidang puli)
TY = SPOOL_Y
empty('tendon_0', palm, (WHEEL_X + RP, TY, WHEEL_Z))           # garis singgung puli
empty('tendon_1', palm, (0.0100, TY, -0.012))                   # pemandu di telapak
empty('tendon_2', p1, (0.0082, TY - (0.0), 0.006))
empty('tendon_3', p1, (0.0082, TY, SEG[0] - 0.006))
empty('tendon_4', p2, (0.0076, TY, 0.006))
empty('tendon_5', p2, (0.0076, TY, SEG[1] - 0.005))
empty('tendon_6', p3, (0.0070, TY, 0.010))                      # ujung tendon terikat di ruas distal

# 7. Telur: diletakkan di dalam lengkung jari pada tekukan 0,82 (saat sensor taktil mendeteksi tekanan)
for o, k in zip((p1, p2, p3), KS):
    o.rotation_euler = (0, 0.82 * k, 0)
bpy.context.view_layer.update()
mw = p3.matrix_world
pad_w = mw @ Vector((0.0055 + 0.0022, 0, SEG[2] * .58))
n = (mw.to_3x3() @ Vector((1, 0, 0))).normalized()
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=18, radius=1, location=(0, 0, 0))
egg = bpy.context.active_object
egg.name = 'egg'
egg.scale = (0.021, 0.021, 0.027)
bpy.ops.object.transform_apply(scale=True)
egg.location = pad_w + n * 0.0215
egg.rotation_euler = (0, -0.5, 0)
egg.data.materials.append(M['egg'])
for p in egg.data.polygons:
    p.use_smooth = True
for o in (p1, p2, p3):
    o.rotation_euler = (0, 0, 0)
parts.append(egg)

preview_rig((0, 0, -0.01))
cam = scene.camera
cam.location = (0.03, -0.30, -0.01); cam.data.lens = 60
cam.rotation_euler = (Vector((0.01, 0, -0.01)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
save_and_export('actuator_finger', parts)
