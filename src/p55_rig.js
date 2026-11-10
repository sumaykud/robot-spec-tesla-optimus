
/* ================= rig: animasi aktivitas + komponen internal ikut tulang ================= */
// Model ber-rig dibuat tools/rig_tesla_bot.py. Tulang ada di sendi J yang sama dengan komponen prosedural,
// jadi setiap komponen ditempel ke tulang terdekat; aktuator linear & jalur kabel direntang ulang tiap frame.
const RIG = { ok: false, mixer: null, acts: {}, w: {}, props: {}, rods: [], flows: [], anchors: [] };
// tulang: [kepala, ekor, jari-jari anggota tubuh] (koordinat model, sama dengan BONES di rig_tesla_bot.py)
// dibangun saat dipakai, karena three.js baru dimuat di init3D
let RIG_BONES;
function rigBones() {
  const b = { hips: ['pelvis', 'waist', .13], spine: ['waist', 'chest', .13], chest: ['chest', 'neck', .15], neck: ['neck', [0, 1.8, .02], .05], head: [[0, 1.8, .02], [0, 1.98, .02], .1] };
  for (const s of 'LR') {
    const ha = J['ha' + s];
    Object.assign(b, {
      ['upperarm_' + s]: ['sh' + s, 'el' + s, .05], ['forearm_' + s]: ['el' + s, 'wr' + s, .045], ['hand_' + s]: ['wr' + s, [ha[0], .95, ha[2]], .04],
      ['thigh_' + s]: ['hi' + s, 'kn' + s, .075], ['shin_' + s]: ['kn' + s, 'an' + s, .06], ['foot_' + s]: ['an' + s, 'ft' + s, .05],
    });
  }
  for (const k in b) b[k] = [V(typeof b[k][0] === 'string' ? J[b[k][0]] : b[k][0]), V(typeof b[k][1] === 'string' ? J[b[k][1]] : b[k][1]), b[k][2]];
  return b;
}
// periode tiap klip mengikuti jam simulasi yang sudah ada (S.phase untuk jalan, kurva lutut untuk angkat)
const RIG_U = { jalan: () => S.phase, angkat: () => (S.t * 1.1 / TAU) % 1 };
const RIG_PROP = { prop_bench: 'diam', prop_box: 'angkat', prop_egg: 'telur' };

function rigNearest(p) {
  // tulang terdekat (jarak ke segmen dibagi jari-jari, sama dengan bobot kulit)
  let best = null, bd = Infinity;
  const ab = new THREE.Vector3(), ap = new THREE.Vector3();
  for (const n in RIG_BONES) {
    const [a, b, r] = RIG_BONES[n];
    ab.subVectors(b, a); ap.subVectors(p, a);
    const u = clamp(ap.dot(ab) / ab.lengthSq(), 0, 1);
    const d = ap.sub(ab.multiplyScalar(u)).length() / r;
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
function rigHelper(bones, p) {
  // titik (koordinat root) yang ikut tulang terdekat
  const h = new THREE.Object3D(); h.position.copy(p); root.add(h); root.updateMatrixWorld(true);
  const n = rigNearest(p); bones[n].attach(h); h.userData.bone = n; return h;
}
const rigTmp = () => (rigTmp.v ??= new THREE.Vector3());
function rigLocal(h, out) { return root.worldToLocal(h.getWorldPosition(out)); }

function initRig(gltf) {
  RIG_BONES ??= rigBones();
  const bones = {};
  gltf.scene.traverse(o => { if (o.isBone && RIG_BONES[o.name]) bones[o.name] = o; if (RIG_PROP[o.name]) RIG.props[o.name] = o; });
  if (Object.keys(bones).length < Object.keys(RIG_BONES).length || !gltf.animations.length) return;
  root.updateMatrixWorld(true); // tulang masih di pose rest
  // aktuator linear: ujung pangkal & ujung batang di tulang masing-masing
  const rodGroups = new Set();
  for (const r of RODS) {
    rodGroups.add(r.g);
    RIG.rods.push({ r, ha: rigHelper(bones, r.a), hb: rigHelper(bones, r.b) });
  }
  for (const R of RIG.rods) R.same = R.ha.userData.bone === R.hb.userData.bone;
  // jalur daya/data: tiap titik kontrol ikut tulang terdekat
  const flowObjs = new Set();
  for (const f of FLOWS) {
    flowObjs.add(f.line); flowObjs.add(f.pts);
    RIG.flows.push({ f, hs: f.curve.points.map(p => rigHelper(bones, p.clone())) });
  }
  // titik label/kamera fokus
  for (const p of PARTS) RIG.anchors.push({ id: p.id, h: rigHelper(bones, V(p.anchor)) });
  // komponen lain: tempel utuh ke tulang terdekat dari pusat bounding box-nya
  const box = new THREE.Box3(), c = new THREE.Vector3();
  for (const o of [...root.children]) {
    if (o === gltf.scene || rodGroups.has(o) || flowObjs.has(o) || o.userData.bone) continue;
    box.setFromObject(o); if (box.isEmpty()) continue;
    root.worldToLocal(box.getCenter(c));
    bones[rigNearest(c)].attach(o);
  }
  RIG.mixer = new THREE.AnimationMixer(gltf.scene);
  for (const clip of gltf.animations) {
    const a = RIG.mixer.clipAction(clip); a.play(); a.setEffectiveWeight(0);
    RIG.acts[clip.name] = a; RIG.w[clip.name] = clip.name === S.act ? 1 : 0;
  }
  RIG.ok = true;
  animRig(0);
}

function animRig(dt) {
  if (!RIG.ok) return;
  // bobot klip: aktivitas aktif naik ke 1, lainnya turun (crossfade ±0,5 s)
  const k = dt ? 1 - Math.exp(-dt * 6) : 1;
  for (const n in RIG.acts) {
    const a = RIG.acts[n], w = RIG.w[n] += ((n === S.act ? 1 : 0) - RIG.w[n]) * k, d = a.getClip().duration;
    a.setEffectiveWeight(w);
    const u = REDUCED ? .25 : (RIG_U[n] ? RIG_U[n]() : (S.t / d) % 1);
    a.time = u * d;
  }
  RIG.mixer.update(0);
  for (const n in RIG.props) RIG.props[n].visible = RIG.w[RIG_PROP[n]] > .5;
  root.updateMatrixWorld(true);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), dir = new THREE.Vector3();
  for (const R of RIG.rods) {
    rigLocal(R.ha, A); rigLocal(R.hb, B); dir.subVectors(B, A);
    const r = R.r; r.g.position.copy(A); r.g.quaternion.setFromUnitVectors(UP(), dir.clone().normalize());
    if (!R.same) r.extRig = dir.length() - r.mL; // panjang batang mengikuti pose
  }
  for (const F of RIG.flows) {
    F.hs.forEach((h, i) => rigLocal(h, F.f.curve.points[i]));
    const pos = F.f.line.geometry.attributes.position, pts = F.f.curve.getPoints(pos.count - 1);
    for (let i = 0; i < pts.length; i++) pos.setXYZ(i, pts[i].x, pts[i].y, pts[i].z);
    pos.needsUpdate = true; F.f.line.geometry.computeBoundingSphere();
    if (F.f.kind === 'data') F.f.line.computeLineDistances();
  }
  for (const a of RIG.anchors) a.h.getWorldPosition(PM[a.id].anchor);
}
