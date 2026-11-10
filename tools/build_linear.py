"""Bangun model 3D aktuator linear (PMSM frameless + planetary roller screw) di Blender.

Pakai (dari root repo):
  blender --background --factory-startup --python tools/build_linear.py

Hasil: model/actuator_linear.blend, model/actuator_linear.glb, actuator_linear_geo.txt

Prinsip: stator diam di rumah; rotor berlubang = mur roller screw (ulir dalam + ring gear di kedua ujung).
Rol berulir (10 buah) menggelinding di antara mur dan batang ulir, ditahan dua cincin pembawa (carrier).
Batang ulir tidak berputar dan bergeser maju-mundur. Sumbu aktuator = Z Blender (Y di three.js).

Nama objek dipakai halaman (src/p65_lab3d.js):
  housing_rear, housing, motor_stator, nut, roller_set (empty: roller_0..9 + carrier_a/b), housing_front, screw
Tiap roller_i ber-origin di sumbunya sendiri agar bisa diputar pada porosnya.
"""
import math, os, sys
import bpy, bmesh

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from act_common import *  # noqa: F401,F403

scene = new_scene()
M = materials()
M['screw'] = mat('ScrewSteel', (0.70, 0.72, 0.76), 1.0, 0.18)
M['nut'] = mat('NutSteel', (0.55, 0.62, 0.78), 1.0, 0.26)   # sedikit biru, senada --lin di halaman

R = 0.032           # jari-jari luar rumah
L0, L1 = 0.0, 0.112  # rumah: z dari belakang ke depan
# geometri roller screw (jari-jari pitch kira-kira: batang 9 mm, rol 3 mm, mur 15 mm)
RS_ROOT, RS_TIP = 0.0084, 0.0094
RR_ROOT, RR_TIP = 0.0024, 0.0033
RN_TIP, RN_ROOT = 0.0147, 0.0157
RC = 0.0120          # jari-jari lingkaran pusat rol
NR = 10              # jumlah rol
PITCH = 0.0016       # pitch ulir (mm-an, diperbesar agar terlihat)
ZR0, ZR1 = 0.020, 0.084   # panjang rol
ZG = 0.006           # panjang zona gigi di ujung rol


def zigzag(r_root, r_tip, z0, z1, pitch, inner=False, cap=None):
    """Profil lathe: alur ulir annular (rol & mur) dari z0 ke z1. cap = jari-jari sisi tertutup."""
    pts = []
    n = max(1, round((z1 - z0) / pitch))
    p = (z1 - z0) / n
    for i in range(n):
        z = z0 + i * p
        pts += [(r_root, z), (r_root, z + p * .12), (r_tip, z + p * .38), (r_tip, z + p * .62), (r_root, z + p * .88)]
    pts.append((r_root, z1))
    if cap is not None:
        pts += [(cap, z1), (cap, z0)]
    return pts


parts = []

# 1. Tutup belakang + kotak konektor
rear = lathe('housing_rear', [(0.0112, -0.008), (R, -0.008), (R, 0.0), (0.0112, 0.0)], M['alu'], 128)
rear['zc'] = -0.004
drill(rear, bolt_circle(6, 0.0275, 0.0013, TAU / 12))
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1)
bmesh.ops.scale(bm, vec=(0.014, 0.010, 0.016), verts=bm.verts)
bmesh.ops.translate(bm, vec=(0, -R - 0.004, 0.006), verts=bm.verts)
box = obj_from_bm('conn', bm, M['alu_dark'], smooth_angle=0.3)
rear = join('housing_rear', [rear, box])
add_bevel(rear, 0.0005)
parts.append(rear)

# 2. Rumah motor: tabung anodized dengan alur pendingin
prof = [(R - 0.0025, L0), (R, L0)]
for k in range(7):
    z = 0.030 + k * 0.006
    prof += [(R, z), (R - 0.0012, z + 0.0008), (R - 0.0012, z + 0.0032), (R, z + 0.004)]
prof += [(R, L1), (R - 0.0025, L1)]
housing = lathe('housing', prof, M['alu_dark'], 160)
add_bevel(housing, 0.0004)
parts.append(housing)

# 3. Stator: 12 gigi, gulungan tembaga
st = stator('motor_stator', 12, R - 0.0027, 0.0245, 0.0182, 0.022, 0.082, M['lam'], M['copper'])
parts.append(st)

# 4. Mur = rotor berlubang: magnet di luar, ulir dalam, ring gear di kedua ujung, bantalan di ujung
mag_r0, mag_r1 = 0.0166, 0.0178
nut_body = lathe('nut_body', [(RN_ROOT, ZR0 - 0.004), (mag_r0, ZR0 - 0.004), (mag_r0, ZR1 + 0.004), (RN_ROOT, ZR1 + 0.004)], M['nut'], 128)
nut_thr = lathe('nut_thread', zigzag(RN_ROOT, RN_TIP, ZR0 + ZG, ZR1 - ZG, PITCH, cap=RN_ROOT + 0.0003), M['nut'], 96)
gears = []
NRG = 50
for (z0, z1) in [(ZR0, ZR0 + ZG), (ZR1 - ZG, ZR1)]:
    bm = bmesh.new()
    profile_ring(bm, lambda a: RN_ROOT + 0.0002, lambda a: RN_TIP + 0.0010 - (tooth(a, NRG, RN_TIP, 0.0010, .5) - RN_TIP), z0, z1, NRG * 8)
    gears.append(obj_from_bm('nut_gear', bm, M['steel'], smooth_angle=1.2))
mags = []
NP = 14
for i in range(NP):
    a0, a1 = TAU * (i + .06) / NP, TAU * (i + .94) / NP
    bm = bmesh.new()
    vs = []
    for k in range(5):
        a = a0 + (a1 - a0) * k / 4
        for r in (mag_r0, mag_r1):
            for z in (0.024, 0.080):
                vs.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
    bmesh.ops.convex_hull(bm, input=vs)
    mags.append(obj_from_bm(f'mag{i}', bm, M['magnet'] if i % 2 else M['alu_dark'], smooth_angle=0.3))
brg = [lathe('nut_brg_a', [(mag_r0, 0.008), (0.0215, 0.008), (0.0215, ZR0 - 0.004), (mag_r0, ZR0 - 0.004)], M['steel'], 96),
       lathe('nut_brg_b', [(mag_r0, ZR1 + 0.004), (0.0215, ZR1 + 0.004), (0.0215, 0.100), (mag_r0, 0.100)], M['steel'], 96)]
nut = join('nut', [nut_body, nut_thr] + gears + mags + brg)
parts.append(nut)

# 5. Rol berulir (gigi di kedua ujung) + dua carrier, di bawah satu empty 'roller_set'
rset = link(bpy.data.objects.new('roller_set', None))
rollers = []
NRT = 10  # gigi rol (NRG / NRT = rasio jari-jari mur : rol)
for i in range(NR):
    a = TAU * i / NR
    thr = lathe(f'roller_{i}', zigzag(RR_ROOT, RR_TIP, ZR0 + ZG, ZR1 - ZG, PITCH, cap=0.0), M['steel'], 32)
    objs = [thr]
    for (z0, z1) in [(ZR0, ZR0 + ZG), (ZR1 - ZG, ZR1)]:
        bm = bmesh.new()
        profile_ring(bm, lambda t: tooth(t, NRT, RR_ROOT, 0.0010), lambda t: 0.0008, z0, z1, NRT * 8)
        objs.append(obj_from_bm('rg', bm, M['steel'], smooth_angle=1.2))
    objs.append(lathe('pin', [(0.0, ZR0 - 0.0045), (0.0011, ZR0 - 0.0045), (0.0011, ZR1 + 0.0045), (0.0, ZR1 + 0.0045)], M['steel'], 16))
    ro = join(f'roller_{i}', objs)
    # geometri dibuat di sumbu; pindahkan objeknya ke lingkaran pusat rol
    ro.location = (RC * math.cos(a), RC * math.sin(a), 0)
    ro.rotation_euler = (0, 0, a)   # fasa awal acak-terlihat
    ro.parent = rset
    rollers.append(ro)
for nm, (z0, z1) in [('carrier_a', (ZR0 - 0.0040, ZR0 - 0.0008)), ('carrier_b', (ZR1 + 0.0008, ZR1 + 0.0040))]:
    c = ring(nm, RN_TIP - 0.0003, RS_TIP + 0.0004, z0, z1, M['alu'], 96)
    c['zc'] = (z0 + z1) / 2
    drill(c, bolt_circle(NR, RC, 0.00115))
    c.parent = rset
parts.append(rset)

# 6. Tutup depan dengan flens pemasangan + seal
front = lathe('housing_front', [(0.0105, L1), (R, L1), (R, L1 + 0.006), (0.040, L1 + 0.006), (0.040, L1 + 0.011),
                                (0.0140, L1 + 0.011), (0.0140, L1 + 0.016), (0.0105, L1 + 0.016)], M['alu'], 160)
front['zc'] = L1 + 0.0085
drill(front, bolt_circle(4, 0.036, 0.0022, TAU / 8) + bolt_circle(6, 0.0275, 0.0012))
add_bevel(front, 0.0005)
parts.append(front)

# 7. Batang ulir: ulir heliks sungguhan (modifier Screw) + mata batang (rod eye) di ujung depan
ZS0, ZS1 = -0.020, 0.176
bm = bmesh.new()
pv = [bm.verts.new(v) for v in [(RS_ROOT, 0, 0), (RS_TIP, 0, PITCH * .38), (RS_TIP, 0, PITCH * .62), (RS_ROOT, 0, PITCH)]]
for i in range(3):
    bm.edges.new((pv[i], pv[i + 1]))
me = bpy.data.meshes.new('thread'); bm.to_mesh(me); bm.free()
thr = link(bpy.data.objects.new('thread', me))
sm = thr.modifiers.new('Screw', 'SCREW')
sm.angle = TAU
sm.screw_offset = PITCH
sm.steps = 40
sm.render_steps = 40
sm.iterations = int((ZS1 - ZS0 - 0.012) / PITCH)
sm.use_merge_vertices = True
thr.location = (0, 0, ZS0 + 0.006)
thr.data.materials.append(M['screw'])
apply_mods(thr)
bpy.context.view_layer.objects.active = thr
bpy.ops.object.transform_apply(location=True)
for p in thr.data.polygons:
    p.use_smooth = True
core = lathe('screw_core', [(0.0, ZS0), (RS_ROOT - 0.0004, ZS0), (RS_ROOT + 0.00002, ZS0 + 0.004), (RS_ROOT + 0.00002, ZS1 - 0.004),
                            (0.0072, ZS1 - 0.002), (0.0072, ZS1), (0.0, ZS1)], M['screw'], 64)
# mata batang: blok + lubang melintang
eye = lathe('eye', [(0.0, ZS1), (0.0080, ZS1), (0.0080, ZS1 + 0.010), (0.0, ZS1 + 0.010)], M['steel'], 64)
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=0.0110, radius2=0.0110, depth=0.012)
bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, ZS1 + 0.020), )
lug = obj_from_bm('lug', bm, M['steel'])
eye = join('eye', [eye, lug])
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=0.0055, radius2=0.0055, depth=0.05)
bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, ZS1 + 0.020))
me = bpy.data.meshes.new('c'); bm.to_mesh(me); bm.free()
cutter = link(bpy.data.objects.new('c', me))
bo = eye.modifiers.new('Hole', 'BOOLEAN'); bo.operation = 'DIFFERENCE'; bo.object = cutter; bo.solver = 'EXACT'
apply_mods(eye)
bpy.data.objects.remove(cutter)
add_bevel(eye, 0.0006)
screw = join('screw', [core, thr, eye])
parts.append(screw)

for o in parts:
    if o.type == 'MESH':
        apply_mods(o)
for o in rset.children:
    apply_mods(o)

preview_rig((0, 0, 0.07))
save_and_export('actuator_linear', parts)
