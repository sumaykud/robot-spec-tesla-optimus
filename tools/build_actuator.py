"""Bangun model 3D aktuator rotari (PMSM frameless + strain wave gear) di Blender.

Pakai (dari root repo):
  blender --background --factory-startup --python tools/build_actuator.py

Hasil:
  model/actuator_rotary.blend  : file sumber Blender
  model/actuator_rotary.glb    : ekspor glTF
  actuator_rotary_geo.txt      : GLB di-encode base64 (dimuat halaman lewat fetch, sama seperti tesla_bot_geo.txt)

Sumbu aktuator = sumbu Z Blender (jadi sumbu Y di glTF/three.js). Satuan meter, diameter luar ±100 mm.
Setiap bagian adalah satu objek dengan nama tetap; halaman memakai nama itu untuk animasi & exploded view.
Jumlah gigi diperkecil (flexspline 60, circular spline 62) agar terbaca; rasio asli ±100 : 1.
"""
import math, os, sys
import bpy, bmesh
from mathutils import Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from act_common import *  # noqa: F401,F403  (helper bersama: ring, lathe, drill, join, ...)

scene = new_scene()
M = materials()

# Tata letak aksial (z, meter), dari belakang (z kecil) ke depan / output (z besar)
R = 0.050  # jari-jari luar rumah

parts = []

# 1. Tutup belakang: cangkir aluminium dengan lubang kabel
bm = bmesh.new()
profile_ring(bm, lambda a: R, lambda a: R - 0.003, 0.000, 0.025, 128)
cap = obj_from_bm('housing_rear', bm, M['alu'])
back = disc('housing_rear_back', R, -0.003, 0.000, M['alu'], 128)
back['zc'] = -0.0015
drill(back, [(0.0, 0.0, 0.011), (0.030, 0.012, 0.0045), (-0.028, -0.016, 0.003)] + bolt_circle(8, 0.044, 0.0016, 0.2))
cap = join('housing_rear', [cap, back])
add_bevel(cap)
parts.append(cap)

# 2. Encoder + PCB driver
pcb = disc('encoder_pcb', 0.044, 0.024, 0.0256, M['pcb'], 96)
pcb['zc'] = 0.0248
drill(pcb, [(0, 0, 0.012)] + bolt_circle(4, 0.039, 0.0018, TAU / 8))
chips = []
for i, (x, y, w, h) in enumerate([(0.022, 0.0, 0.010, 0.010), (-0.020, 0.012, 0.008, 0.005), (-0.018, -0.016, 0.006, 0.006), (0.004, 0.026, 0.009, 0.004), (0.006, -0.027, 0.012, 0.004)]):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(w, h, 0.0016), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(x, y, 0.0264), verts=bm.verts)
    chips.append(obj_from_bm(f'chip{i}', bm, M['chip']))
enc_ring = ring('enc_ring', 0.018, 0.0125, 0.0256, 0.0275, M['steel'], 64)  # cakram magnet encoder
pcb = join('encoder_pcb', [pcb, enc_ring] + chips)
parts.append(pcb)

# 3. Stator motor: inti laminasi dengan 18 gigi ke dalam + gulungan tembaga
NS = 18
st_core = ring('stator_yoke', 0.046, 0.040, 0.030, 0.050, M['lam'], 144)
teeth = []
for i in range(NS):
    a = TAU * i / NS
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(0.0085, 0.0045, 0.020), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0.0362, 0, 0.040), verts=bm.verts)
    # sepatu gigi
    bm2 = bmesh.new()
    bmesh.ops.create_cube(bm2, size=1)
    bmesh.ops.scale(bm2, vec=(0.0018, 0.0095, 0.020), verts=bm2.verts)
    bmesh.ops.translate(bm2, vec=(0.0322, 0, 0.040), verts=bm2.verts)
    me2 = bpy.data.meshes.new('tmp'); bm2.to_mesh(me2); bm2.free(); bm.from_mesh(me2); bpy.data.meshes.remove(me2)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, 'Z'))
    teeth.append(obj_from_bm(f'tooth{i}', bm, M['lam']))
    # gulungan: torus pipih mengelilingi gigi
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, segments=4, radius=1)
    me = bpy.data.meshes.new('coil')
    bpy.ops.mesh.primitive_torus_add(major_radius=0.0105, minor_radius=0.0021, major_segments=24, minor_segments=8, location=(0, 0, 0))
    coil = bpy.context.active_object
    bm.free()
    coil.name = f'coil{i}'
    coil.scale = (0.30, 1.0, 1.0)
    coil.rotation_euler = (0, math.pi / 2, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    coil.location = (0.0365 * math.cos(a), 0.0365 * math.sin(a), 0.040)
    coil.rotation_euler = (0, 0, a)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    coil.data.materials.append(M['copper'])
    for p in coil.data.polygons:
        p.use_smooth = True
    teeth.append(coil)
stator = join('motor_stator', [st_core] + teeth)
parts.append(stator)

# 4. Rotor: cincin besi + magnet NdFeB permukaan (20 kutub) + poros berongga
rotor_core = ring('rotor_core', 0.0285, 0.0200, 0.031, 0.049, M['steel'], 96)
mags = []
NP = 20
for i in range(NP):
    a0, a1 = TAU * (i + 0.06) / NP, TAU * (i + 0.94) / NP
    bm = bmesh.new()
    seg = 4
    vs = []
    for k in range(seg + 1):
        a = a0 + (a1 - a0) * k / seg
        for r in (0.0285, 0.0305):
            for z in (0.032, 0.048):
                vs.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
    bmesh.ops.convex_hull(bm, input=vs)
    mags.append(obj_from_bm(f'mag{i}', bm, M['magnet'] if i % 2 else M['alu_dark'], smooth_angle=0.3))
hub = ring('rotor_hub', 0.0200, 0.0110, 0.029, 0.058, M['alu'], 64)
web = ring('rotor_web', 0.0200, 0.0110, 0.038, 0.042, M['alu'], 64)
rotor = join('motor_rotor', [rotor_core, hub, web] + mags)
add_bevel(rotor, 0.0004)
parts.append(rotor)

# 5. Rumah motor (silinder tengah, anodized gelap) dengan lubang baut di flens
mh = lathe('motor_housing', [(0.0465, 0.026), (R, 0.026), (R, 0.058), (0.041, 0.058), (0.041, 0.055), (0.0465, 0.055)], M['alu_dark'])
mh['zc'] = 0.0545
drill(mh, bolt_circle(12, 0.0440, 0.0014))
add_bevel(mh)
parts.append(mh)

# 6. Wave generator: cam elips + bantalan bola tipis (sumbu panjang di X)
E = 0.0012  # setengah selisih sumbu (dilebih-lebihkan agar terlihat)
r_wg = 0.0246
ell = lambda a: r_wg * (1 + (E / r_wg) * math.cos(2 * a))
bm = bmesh.new()
profile_ring(bm, ell, lambda a: 0.011, 0.062, 0.074, 128)
cam = obj_from_bm('wg_cam', bm, M['steel'])
bm = bmesh.new()
profile_ring(bm, lambda a: ell(a) + 0.0038, lambda a: ell(a) + 0.0027, 0.062, 0.074, 128)
outer_race = obj_from_bm('wg_race', bm, M['steel'])
balls = []
NB = 24
for i in range(NB):
    a = TAU * i / NB
    rr = ell(a) + 0.0014
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0016, segments=12, ring_count=8, location=(rr * math.cos(a), rr * math.sin(a), 0.068))
    b = bpy.context.active_object
    b.data.materials.append(M['steel'])
    for p in b.data.polygons:
        p.use_smooth = True
    balls.append(b)
wg = join('wave_generator', [cam, outer_race] + balls)
parts.append(wg)

# 7. Flexspline: cangkir baja tipis, gigi luar di ujung terbuka, diafragma + hub di dasar
#    Dibuat bulat (tidak elips); halaman membengkokkannya per frame mengikuti wave generator.
ZF = 60
r_fr = 0.0294  # akar gigi luar (puncak 0.0312; elips ±1,2 mm -> 0.0300..0.0324)
bm = bmesh.new()
profile_ring(bm, lambda a: tooth(a, ZF, r_fr, 0.0018), lambda a: r_fr - 0.0010, 0.060, 0.076, ZF * 8)
ft = obj_from_bm('flex_teeth', bm, M['flex'], smooth_angle=1.2)
wall = ring('flex_wall', r_fr - 0.0001, r_fr - 0.0009, 0.076, 0.096, M['flex'], ZF * 8)
dia = ring('flex_diaphragm', r_fr - 0.0001, 0.010, 0.095, 0.097, M['flex'], ZF * 8)
fhub = ring('flex_hub', 0.016, 0.008, 0.093, 0.101, M['flex'], 64)
flex = join('flexspline', [ft, wall, dia, fhub])
parts.append(flex)

# 8. Circular spline: cincin kaku dengan 62 gigi dalam + lubang baut
ZC = ZF + 2
r_cr = 0.0302  # puncak gigi dalam (jari-jari terkecil); akar 0.0326
bm = bmesh.new()
profile_ring(bm, lambda a: R, lambda a: r_cr + 0.0024 - (tooth(a, ZC, r_cr, 0.0024, 0.5) - r_cr), 0.060, 0.076, ZC * 8)
cs = obj_from_bm('circular_spline', bm, M['steel'], smooth_angle=1.2)
cs['zc'] = 0.068
drill(cs, bolt_circle(16, 0.0440, 0.0015, TAU / 32))
parts.append(cs)

# 9. Bantalan cross-roller + rumah depan
bo = ring('xrb_outer', R, 0.040, 0.078, 0.096, M['alu'], 160)
bo['zc'] = 0.087
drill(bo, bolt_circle(12, 0.0455, 0.0016))
bi = ring('xrb_inner', 0.036, 0.020, 0.080, 0.094, M['steel'], 128)
rollers = []
NR = 30
for i in range(NR):
    a = TAU * i / NR
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0022, depth=0.0040, vertices=12, location=(0.038 * math.cos(a), 0.038 * math.sin(a), 0.087))
    c = bpy.context.active_object
    tilt = math.pi / 4 if i % 2 else -math.pi / 4
    c.rotation_euler = (0, math.pi / 2 + tilt, a)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    c.data.materials.append(M['steel'])
    rollers.append(c)
xrb = join('crossroller_bearing', [bo, bi] + rollers)
add_bevel(xrb, 0.0005)
parts.append(xrb)

# 10. Flens output + poros
fl = disc('output_flange', 0.034, 0.100, 0.106, M['alu_dark'], 128)
fl['zc'] = 0.103
drill(fl, [(0, 0, 0.007)] + bolt_circle(8, 0.026, 0.0024, TAU / 16) + bolt_circle(6, 0.014, 0.0013))
boss = ring('out_boss', 0.016, 0.007, 0.106, 0.112, M['alu_dark'], 64)
of = join('output_flange', [fl, boss])
add_bevel(of)
parts.append(of)

for o in parts:
    apply_mods(o)
    # origin tetap di (0,0,0) agar rotasi di halaman berporos pada sumbu aktuator
preview_rig((0, 0, 0.055))
save_and_export('actuator_rotary', parts)
