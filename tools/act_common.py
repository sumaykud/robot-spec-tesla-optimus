"""Fungsi bersama untuk skrip Blender aktuator (build_actuator.py, build_linear.py).

Semua bagian dibangun di sekitar sumbu Z Blender (= sumbu Y di glTF/three.js), satuan meter.
"""
import base64, math, os
import bpy, bmesh
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAU = math.tau


def new_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0  # tanpa file cadangan .blend1
    s = bpy.context.scene
    s.unit_settings.system = 'METRIC'
    return s


def link(o):
    bpy.context.scene.collection.objects.link(o)
    return o


def mat(name, color, metal, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    return m


def materials():
    return {
        'alu': mat('Aluminium', (0.80, 0.81, 0.83), 1.0, 0.28),
        'alu_dark': mat('AluminiumAnodized', (0.10, 0.11, 0.12), 0.85, 0.42),
        'steel': mat('Steel', (0.62, 0.63, 0.65), 1.0, 0.22),
        'flex': mat('Flexspline', (0.72, 0.70, 0.78), 1.0, 0.25),
        'copper': mat('Copper', (0.80, 0.42, 0.22), 1.0, 0.32),
        'magnet': mat('Magnet', (0.20, 0.21, 0.24), 0.9, 0.35),
        'lam': mat('Lamination', (0.24, 0.25, 0.27), 0.9, 0.5),
        'pcb': mat('PCB', (0.03, 0.18, 0.11), 0.0, 0.55),
        'chip': mat('Chip', (0.02, 0.02, 0.025), 0.2, 0.4),
    }


def obj_from_bm(name, bm, material, smooth_angle=0.6):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    link(o)
    me.materials.append(material)
    for p in me.polygons:
        p.use_smooth = True
    try:
        me.set_sharp_from_angle(angle=smooth_angle)
    except AttributeError:
        pass
    return o


def profile_ring(bm, r_out_fn, r_in_fn, z0, z1, n):
    """Cincin tertutup dengan profil radial luar/dalam sembarang (fungsi sudut)."""
    vo0, vo1, vi0, vi1 = [], [], [], []
    for i in range(n):
        a = TAU * i / n
        ro, ri = r_out_fn(a), r_in_fn(a)
        c, s = math.cos(a), math.sin(a)
        vo0.append(bm.verts.new((ro * c, ro * s, z0)))
        vo1.append(bm.verts.new((ro * c, ro * s, z1)))
        vi0.append(bm.verts.new((ri * c, ri * s, z0)))
        vi1.append(bm.verts.new((ri * c, ri * s, z1)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((vo0[i], vo0[j], vo1[j], vo1[i]))      # dinding luar
        bm.faces.new((vi0[j], vi0[i], vi1[i], vi1[j]))      # dinding dalam
        bm.faces.new((vo1[i], vo1[j], vi1[j], vi1[i]))      # atas
        bm.faces.new((vo0[j], vo0[i], vi0[i], vi0[j]))      # bawah


def lathe(name, pts, material, n=160):
    """Putar profil tertutup [(r, z), ...] mengelilingi sumbu Z."""
    bm = bmesh.new()
    vs = [bm.verts.new((r, 0, z)) for r, z in pts]
    es = [bm.edges.new((vs[i], vs[(i + 1) % len(vs)])) for i in range(len(vs))]
    bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 0, 1), angle=TAU, steps=n, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, material)


def ring(name, r_out, r_in, z0, z1, material, n=96, **kw):
    bm = bmesh.new()
    profile_ring(bm, lambda a: r_out, lambda a: r_in, z0, z1, n)
    return obj_from_bm(name, bm, material, **kw)


def disc(name, r, z0, z1, material, n=96):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=n, radius1=r, radius2=r, depth=z1 - z0)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, (z0 + z1) / 2))
    return obj_from_bm(name, bm, material)


def tooth(a, n, r_root, h, phase=0.0):
    """Profil gigi: trapesium halus. 0 = akar, 1 = puncak."""
    u = (a * n / TAU + phase) % 1.0
    # 0..0.2 naik, 0.2..0.5 puncak, 0.5..0.7 turun, sisa akar
    if u < 0.18:
        f = u / 0.18
    elif u < 0.48:
        f = 1.0
    elif u < 0.66:
        f = 1.0 - (u - 0.48) / 0.18
    else:
        f = 0.0
    f = f * f * (3 - 2 * f)
    return r_root + h * f


def add_bevel(o, w=0.0006, seg=2):
    m = o.modifiers.new('Bevel', 'BEVEL')
    m.width = w
    m.segments = seg
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(40)
    m.harden_normals = False


def drill(o, holes, depth=1.0):
    """Lubang baut lewat boolean (holes = list (x, y, r))."""
    cut = []
    for (x, y, r) in holes:
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=r, radius2=r, depth=depth)
        bmesh.ops.translate(bm, verts=bm.verts, vec=(x, y, o.get('zc', 0.0)))
        me = bpy.data.meshes.new('cut')
        bm.to_mesh(me); bm.free()
        c = bpy.data.objects.new('cut', me)
        link(c)
        cut.append(c)
    # gabung semua pemotong jadi satu objek
    bpy.ops.object.select_all(action='DESELECT')
    for c in cut:
        c.select_set(True)
    bpy.context.view_layer.objects.active = cut[0]
    bpy.ops.object.join()
    cutter = cut[0]
    m = o.modifiers.new('Holes', 'BOOLEAN')
    m.operation = 'DIFFERENCE'
    m.object = cutter
    m.solver = 'EXACT'
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier='Holes')
    bpy.data.objects.remove(cutter)


def bolt_circle(n, rc, r, start=0.0):
    return [(rc * math.cos(start + TAU * i / n), rc * math.sin(start + TAU * i / n), r) for i in range(n)]


def join(name, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    objs[0].name = name
    objs[0].data.name = name
    return objs[0]


def apply_mods(o):
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def stator(name, n, r_out, r_yoke, r_tooth, z0, z1, m_lam, m_cu):
    """Inti stator berlaminasi dengan n gigi ke dalam dan gulungan tembaga pada tiap gigi."""
    h = z1 - z0
    zc = (z0 + z1) / 2
    core = ring(name, r_out, r_yoke, z0, z1, m_lam, 144)
    tw = (r_yoke - r_tooth) * .82            # panjang radial gigi tanpa sepatu
    width = TAU * r_tooth / n * .42
    objs = [core]
    for i in range(n):
        a = TAU * i / n
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1)
        bmesh.ops.scale(bm, vec=(tw, width, h), verts=bm.verts)
        bmesh.ops.translate(bm, vec=(r_yoke - tw / 2 + .0002, 0, zc), verts=bm.verts)
        bm2 = bmesh.new()
        bmesh.ops.create_cube(bm2, size=1)
        sh = (r_yoke - r_tooth) * .2
        bmesh.ops.scale(bm2, vec=(sh, width * 2.1, h), verts=bm2.verts)
        bmesh.ops.translate(bm2, vec=(r_tooth + sh / 2, 0, zc), verts=bm2.verts)
        me2 = bpy.data.meshes.new('tmp'); bm2.to_mesh(me2); bm2.free(); bm.from_mesh(me2); bpy.data.meshes.remove(me2)
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, 'Z'))
        objs.append(obj_from_bm(f'{name}_t{i}', bm, m_lam))
        # gulungan: torus pipih mengelilingi gigi
        rc = (r_yoke + r_tooth) / 2 + (r_yoke - r_tooth) * .05
        # torus di bidang XY; setelah diputar 90° pada Y: X -> aksial, Y -> tangensial, Z -> radial
        mj, mn = h / 2 * .98, width * .4
        bpy.ops.mesh.primitive_torus_add(major_radius=mj, minor_radius=mn,
                                         major_segments=32, minor_segments=8, location=(0, 0, 0))
        coil = bpy.context.active_object
        coil.name = f'{name}_c{i}'
        coil.scale = (1.0, (width * .5 + mn * 1.6) / (mj + mn), (r_yoke - r_tooth) * .32 / mn)
        coil.rotation_euler = (0, math.pi / 2, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        coil.location = (rc * math.cos(a), rc * math.sin(a), zc)
        coil.rotation_euler = (0, 0, a)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        coil.data.materials.append(m_cu)
        for p in coil.data.polygons:
            p.use_smooth = True
        objs.append(coil)
    return join(name, objs)


def preview_rig(target=(0, 0, 0.05)):
    """Kamera + lampu untuk render pratinjau di Blender (tidak diekspor)."""
    s = bpy.context.scene
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    cam.data.lens = 70
    link(cam)
    cam.location = (0.30, -0.34, 0.24)
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    s.camera = cam
    for loc, e in [((0.3, -0.2, 0.4), 40), ((-0.3, -0.3, 0.1), 15), ((0, 0.3, 0.3), 20)]:
        ld = bpy.data.lights.new('L', 'AREA'); ld.energy = e; ld.size = 0.3
        lo = link(bpy.data.objects.new('L', ld)); lo.location = loc
        lo.rotation_euler = (Vector(target) - lo.location).to_track_quat('-Z', 'Y').to_euler()
    w = bpy.data.worlds.new('W'); s.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.05, 0.055, 0.065, 1)


def save_and_export(stem, parts):
    """Simpan model/<stem>.blend, ekspor model/<stem>.glb (Draco) dan <stem>_geo.txt (base64)."""
    os.makedirs(os.path.join(ROOT, 'model'), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'model', stem + '.blend'))
    glb = os.path.join(ROOT, 'model', stem + '.glb')
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
        for c in o.children_recursive:
            c.select_set(True)
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_texcoords=False,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                              export_draco_position_quantization=16, export_draco_normal_quantization=10,
                              export_cameras=False, export_lights=False)
    data = open(glb, 'rb').read()
    open(os.path.join(ROOT, stem + '_geo.txt'), 'w').write(base64.b64encode(data).decode())
    verts = sum(len(o.data.vertices) for p in parts for o in [p, *p.children_recursive] if o.type == 'MESH')
    print('PARTS', [o.name for o in parts], 'GLB', len(data), 'bytes', 'VERTS', verts)
