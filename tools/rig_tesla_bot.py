"""Rig model Tesla Bot + animasi lima aktivitas, di Blender.

Pakai (dari root repo):
  blender --background --factory-startup --python tools/rig_tesla_bot.py
  python3 tools/split_glb.py model/tesla_bot_rigged.glb

Masukan  : model/tesla_bot.glb (Sketchfab, CC BY 4.0, satu mesh tanpa tulang)
Hasil    : model/tesla_bot_rigged.blend, model/tesla_bot_rigged.glb

Tulang diletakkan di koordinat sendi yang sama dengan halaman (J di src/p5_three.js), jadi komponen
internal prosedural bisa ditempel ke tulang terdekat saat runtime. Bobot kulit dihitung sendiri
(jarak ke segmen tulang dibagi jari-jari anggota tubuh), karena mesh terdiri dari banyak pelat terpisah.

Animasi (nama = id aktivitas di src/p4_data.js, semua berulang mulus):
  diam    duduk di bangku, bernapas                 4,0 s
  berdiri berdiri, bergoyang halus                  4,0 s
  jalan   siklus jalan di tempat                    1/0,9 s (sama dengan S.phase halaman)
  angkat  jongkok-angkat kotak 20 kg                2π/1,1 s (sama dengan kurva lutut ACT.angkat)
  telur   tangan kanan memegang telur               4,0 s
Properti: prop_bench (diam), prop_box (angkat, ikut tangan kanan), prop_egg (telur, ikut tangan kanan).
"""
import math, os, sys
import bpy
from mathutils import Matrix, Vector, Quaternion

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from act_common import ROOT, new_scene, mat, link  # noqa: E402

TAU = math.tau
FPS = 30
scene = new_scene()
scene.render.fps = FPS

bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'model', 'tesla_bot.glb'))
body = next(o for o in bpy.data.objects if o.type == 'MESH')
# lepaskan hierarki Sketchfab dan terapkan transformasinya ke vertex
mw = body.matrix_world.copy()
body.parent = None
body.matrix_world = mw
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in [o for o in bpy.data.objects if o.type == 'EMPTY']:
    bpy.data.objects.remove(o)
body.name = 'body'


def B(p):
    """Koordinat halaman (three.js, Y atas, Z depan) -> Blender (Z atas, -Y depan)."""
    return Vector((p[0], -p[2], p[1]))


# sendi dari src/p5_three.js (J)
J = {
    'head': [-0.01, 1.87, 0.07], 'neck': [0, 1.715, 0.0], 'chest': [0, 1.42, 0.025], 'waist': [0, 1.13, 0.0], 'pelvis': [0, 0.99, 0.0],
    'shL': [-0.172, 1.565, 0.0], 'shR': [0.174, 1.57, 0.005], 'elL': [-0.25, 1.30, -0.007], 'elR': [0.236, 1.304, 0.025],
    'wrL': [-0.271, 1.116, 0.049], 'wrR': [0.239, 1.118, 0.093], 'haL': [-0.298, 1.035, 0.06], 'haR': [0.266, 1.04, 0.103],
    'hiL': [-0.088, 0.95, 0.02], 'hiR': [0.092, 0.95, 0.03], 'knL': [-0.132, 0.535, 0.05], 'knR': [0.175, 0.534, 0.08],
    'anL': [-0.141, 0.11, -0.04], 'anR': [0.224, 0.11, 0.03], 'ftL': [-0.15, 0.03, 0.02], 'ftR': [0.25, 0.03, 0.11],
}
# (nama, kepala, ekor, induk, jari-jari anggota tubuh untuk bobot)
BONES = [
    ('hips', J['pelvis'], J['waist'], None, .13),
    ('spine', J['waist'], J['chest'], 'hips', .13),
    ('chest', J['chest'], J['neck'], 'spine', .15),
    ('neck', J['neck'], [0, 1.80, 0.02], 'chest', .05),
    ('head', [0, 1.80, 0.02], [0, 1.98, 0.02], 'neck', .10),
]
for s in 'LR':
    ha = J['ha' + s]
    BONES += [
        (f'upperarm_{s}', J['sh' + s], J['el' + s], 'chest', .05),
        (f'forearm_{s}', J['el' + s], J['wr' + s], f'upperarm_{s}', .045),
        (f'hand_{s}', J['wr' + s], [ha[0], 0.95, ha[2]], f'forearm_{s}', .04),
        (f'thigh_{s}', J['hi' + s], J['kn' + s], 'hips', .075),
        (f'shin_{s}', J['kn' + s], J['an' + s], f'thigh_{s}', .06),
        (f'foot_{s}', J['an' + s], J['ft' + s], f'shin_{s}', .05),
    ]

# ---------------------------------------------------------------- armature
arm_data = bpy.data.armatures.new('rig')
arm = link(bpy.data.objects.new('rig', arm_data))
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
for name, h, t, par, _ in BONES:
    eb = arm_data.edit_bones.new(name)
    eb.head, eb.tail = B(h), B(t)
    eb.align_roll(Vector((0, -1, 0)))  # sumbu Z lokal menghadap depan
    if par:
        eb.parent = arm_data.edit_bones[par]
        eb.use_connect = False
bpy.ops.object.mode_set(mode='OBJECT')

# ---------------------------------------------------------------- bobot kulit
segs = [(n, B(h), B(t), r) for n, h, t, _, r in BONES]


def seg_dist(p, a, b):
    ab = b - a
    u = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * u)).length


groups = {n: body.vertex_groups.new(name=n) for n, *_ in BONES}
SIG = 0.18
for v in body.data.vertices:
    p = v.co
    d = [(seg_dist(p, a, b) / r, n) for n, a, b, r in segs]
    dmin = min(x for x, _ in d)
    ws = sorted(((math.exp(-(x - dmin) / SIG), n) for x, n in d), reverse=True)[:3]
    ws = [(w, n) for w, n in ws if w > .02]
    tot = sum(w for w, _ in ws)
    for w, n in ws:
        groups[n].add([v.index], w / tot, 'REPLACE')
body.parent = arm
mod = body.modifiers.new('rig', 'ARMATURE')
mod.object = arm

# ---------------------------------------------------------------- properti
M_wood = mat('Bench', (0.16, 0.17, 0.19), 0.2, 0.55)
M_box = mat('Box', (0.55, 0.40, 0.24), 0.0, 0.8)
M_egg = mat('Egg', (0.93, 0.88, 0.80), 0.0, 0.45)


def cube(name, size, loc, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    bev = o.modifiers.new('b', 'BEVEL'); bev.width = .008; bev.segments = 2
    bpy.ops.object.modifier_apply(modifier='b')
    o.data.materials.append(material)
    return o


bench = cube('prop_bench', (0.46, 0.40, 0.44), (0, 0.40, 0.22), M_wood)


def bone_parent(o, bone):
    w = o.matrix_world.copy()
    o.parent = arm
    o.parent_type = 'BONE'
    o.parent_bone = bone
    o.matrix_world = w


# kotak & telur ditempatkan pada pose rest di depan tangan, lalu ikut tangan kanan (pose memakai lengan simetris)
box = cube('prop_box', (0.42, 0.30, 0.24), (0, 0, 0), M_box)
bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, radius=0.024, location=(0, 0, 0))
egg = bpy.context.active_object
egg.name = 'prop_egg'
egg.scale = (1, 1, 1.3)
bpy.ops.object.transform_apply(scale=True)
egg.data.materials.append(M_egg)
for p in egg.data.polygons:
    p.use_smooth = True

# ---------------------------------------------------------------- pose helper
pb = arm.pose.bones
REST = {b.name: b.matrix_local.to_3x3() for b in arm_data.bones}
AX = {'x': Vector((1, 0, 0)), 'y': Vector((0, 1, 0)), 'z': Vector((0, 0, 1))}


def rot(name, *rots):
    """Rotasi relatif induk, dinyatakan pada sumbu global di pose rest.
    Nama tulang memakai '_' (bukan '.') karena three.js membuang titik dari nama node.
    Sumbu X = kiri-kanan. Tanda: anggota menggantung (paha, lengan atas) negatif = ayun ke depan;
    lutut positif = menekuk; batang tubuh / kepala positif = condong ke depan; siku negatif = menekuk."""
    R = Matrix.Identity(3)
    for ax, deg in rots:
        R = Matrix.Rotation(math.radians(deg), 3, AX[ax]) @ R
    M = REST[name]
    pb[name].rotation_mode = 'QUATERNION'
    pb[name].rotation_quaternion = (M.inverted() @ R @ M).to_quaternion()


def move_hips(v):
    pb['hips'].location = REST['hips'].inverted() @ Vector(v)


def reset():
    for b in pb:
        b.rotation_mode = 'QUATERNION'
        b.rotation_quaternion = Quaternion()
        b.location = Vector()


L_TH = (B(J['hiL']) - B(J['knL'])).length
L_SH = (B(J['knL']) - B(J['anL'])).length


def legs_fold(alpha, beta, side='LR'):
    """Kaki menekuk dengan telapak tetap di lantai. alpha = condong paha ke depan, beta = condong betis ke depan (derajat).
    Kembalikan offset pinggul (global) agar telapak tidak bergeser."""
    a, b = math.radians(alpha), math.radians(beta)
    for s in side:
        rot(f'thigh_{s}', ('x', -alpha))
        rot(f'shin_{s}', ('x', alpha + beta))
        rot(f'foot_{s}', ('x', -beta))
    # posisi pinggul relatif pergelangan kaki: sebelum vs sesudah
    dz = (L_SH * math.cos(b) + L_TH * math.cos(a)) - (L_SH + L_TH)
    dy = -L_SH * math.sin(b) + L_TH * math.sin(a)   # -Y = depan
    return Vector((0, dy, dz))


def bump(u, c, w):
    d = min(abs(u - c), 1 - abs(u - c))
    return math.exp(-(d / w) ** 2)


# ---------------------------------------------------------------- aktivitas
def pose_berdiri(u):
    br = math.sin(TAU * u)
    reset()
    move_hips((0.003 * math.sin(TAU * u), 0, 0.002 * br - 0.004))
    legs_fold(4, 2)
    rot('spine', ('x', 1 + .6 * br)); rot('chest', ('x', -.4 * br))
    rot('head', ('x', 3), ('z', 2 * math.sin(TAU * u)))
    for s, sg in (('L', 1), ('R', -1)):
        rot(f'upperarm_{s}', ('x', -3 + 1.5 * br), ('y', sg * 3))
        rot(f'forearm_{s}', ('x', -8))


def pose_diam(u):
    br = math.sin(TAU * u)
    reset()
    off = legs_fold(86, 0)
    move_hips(off + Vector((0, 0, -0.02)))
    rot('hips', ('x', -4))
    rot('spine', ('x', 4 + .8 * br)); rot('chest', ('x', 2 - .6 * br))
    rot('head', ('x', 6 + 1.5 * br))
    for s, sg in (('L', 1), ('R', -1)):
        rot(f'upperarm_{s}', ('x', -22), ('y', sg * 4))
        rot(f'forearm_{s}', ('x', -58 + 1.5 * br))
        rot(f'hand_{s}', ('x', 10))


def pose_jalan(u):
    reset()
    for s, ph in (('L', 0.0), ('R', 0.5)):
        v = (u + ph) % 1
        th = 24 * math.cos(TAU * v) - 4             # + = paha ke depan
        kn = 14 * bump(v, .12, .07) + 62 * bump(v, .72, .12) + 4
        an = 12 * bump(v, .02, .06) - 16 * bump(v, .58, .07) + 8 * bump(v, .78, .1)
        rot(f'thigh_{s}', ('x', -th))
        rot(f'shin_{s}', ('x', kn))
        rot(f'foot_{s}', ('x', an))
    move_hips((0.012 * math.sin(TAU * u), 0, 0.012 * math.cos(2 * TAU * u) - 0.028))
    rot('hips', ('z', 5 * math.sin(TAU * u)))
    rot('spine', ('x', 4), ('z', -4 * math.sin(TAU * u)))
    rot('chest', ('z', -3 * math.sin(TAU * u)))
    rot('head', ('z', 2 * math.sin(TAU * u)))
    for s, ph, sg in (('L', 0.0, 1), ('R', 0.5, -1)):
        v = (u + ph) % 1
        rot(f'upperarm_{s}', ('x', 18 * math.cos(TAU * v)), ('y', sg * 4))
        rot(f'forearm_{s}', ('x', -22 - 10 * max(0, -math.cos(TAU * v))))


def pose_angkat(u):
    s = 0.5 - 0.5 * math.cos(TAU * u)               # 0 berdiri, 1 jongkok terdalam (sama dengan ACT.angkat.knee)
    reset()
    off = legs_fold(10 + 78 * s, 6 + 26 * s)
    move_hips(off)
    rot('hips', ('x', 8 + 22 * s))
    rot('spine', ('x', 4 + 12 * s)); rot('chest', ('x', 2 + 4 * s))
    rot('head', ('x', -8 - 16 * s))
    for side, sg in (('L', 1), ('R', -1)):
        rot(f'upperarm_{side}', ('x', -30 + 6 * s), ('y', sg * -6))
        rot(f'forearm_{side}', ('x', -62 + 10 * s))
        rot(f'hand_{side}', ('x', -6), ('y', sg * 30))


def pose_telur(u):
    br = math.sin(TAU * u)
    reset()
    move_hips((0, 0, -0.004))
    legs_fold(4, 2)
    rot('spine', ('x', 3)); rot('chest', ('x', 2))
    rot('head', ('x', 18 + 2 * br), ('z', -6))
    rot('upperarm_L', ('x', -4), ('y', 3)); rot('forearm_L', ('x', -10))
    rot('upperarm_R', ('x', -34 - 2 * br), ('y', 8))
    rot('forearm_R', ('x', -64 - 3 * br), ('z', 6))
    rot('hand_R', ('x', -10), ('y', -60))


ACTS = [('diam', 4.0, pose_diam), ('berdiri', 4.0, pose_berdiri), ('jalan', 1 / 0.9, pose_jalan),
        ('angkat', TAU / 1.1, pose_angkat), ('telur', 4.0, pose_telur)]

# tempatkan kotak & telur pada pose referensi lalu tempel ke tangan kanan
bpy.context.view_layer.update()


# kotak: di antara kedua tangan pada pose angkat u=0
pose_angkat(0.0); bpy.context.view_layer.update()
hL = (arm.matrix_world @ pb['hand_L'].matrix).translation
hR = (arm.matrix_world @ pb['hand_R'].matrix).translation
tL = (arm.matrix_world @ pb['hand_L'].matrix) @ Vector((0, pb['hand_L'].length * .6, 0))
tR = (arm.matrix_world @ pb['hand_R'].matrix) @ Vector((0, pb['hand_R'].length * .6, 0))
mid = (tL + tR) / 2
box.dimensions = (max(0.2, (tR - tL).length - 0.04), 0.26, 0.22)
bpy.ops.object.select_all(action='DESELECT'); box.select_set(True); bpy.context.view_layer.objects.active = box
bpy.ops.object.transform_apply(scale=True)
box.location = mid + Vector((0, -0.04, -0.02))
box.rotation_euler = (math.radians(-(30 + 0)), 0, 0)  # kira-kira sejajar lengan bawah
bpy.context.view_layer.update()
bone_parent(box, 'hand_R')

# telur: di ujung jari tangan kanan pada pose telur u=0
pose_telur(0.0); bpy.context.view_layer.update()
mR = arm.matrix_world @ pb['hand_R'].matrix
egg.location = mR @ Vector((0.0, pb['hand_R'].length * .85, 0.028))
bpy.context.view_layer.update()
bone_parent(egg, 'hand_R')
reset(); bpy.context.view_layer.update()

# ---------------------------------------------------------------- keyframe tiap aktivitas
arm.animation_data_create()
for name, dur, fn in ACTS:
    act = bpy.data.actions.new(name)
    arm.animation_data.action = act
    n = max(8, round(dur * FPS))
    for f in range(n + 1):
        fn((f / n) % 1.0)
        for b in pb:
            b.keyframe_insert('rotation_quaternion', frame=f)
            if b.name == 'hips':
                b.keyframe_insert('location', frame=f)
    act.use_fake_user = True
    tr = arm.animation_data.nla_tracks.new()
    tr.name = name
    st = tr.strips.new(name, 0, act)
    tr.mute = True
    arm.animation_data.action = None
reset()

# ---------------------------------------------------------------- simpan & ekspor
os.makedirs(os.path.join(ROOT, 'model'), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'model', 'tesla_bot_rigged.blend'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT, 'model', 'tesla_bot_rigged.glb'), export_format='GLB',
                          use_selection=True, export_yup=True, export_animations=True,
                          export_animation_mode='NLA_TRACKS', export_force_sampling=True,
                          export_cameras=False, export_lights=False)
print('RIG', len(BONES), 'bones', 'ACTS', [a for a, *_ in ACTS], 'L_TH', round(L_TH, 3), 'L_SH', round(L_SH, 3))
