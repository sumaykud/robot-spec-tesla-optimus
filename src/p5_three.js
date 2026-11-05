
/* ================= theme tokens ================= */
let C = {};
function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['bg', 'panel-solid', 'ink', 'ink-2', 'ink-3', 'line', 'accent', 'rot', 'lin', 'fin', 'sen', 'pwr', 'sig', 'hot', 'metal']) C[k] = cs.getPropertyValue('--' + k).trim() || '#888';
}
function rgba(hex, a) {
  let h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
const isDark = () => { const h = C.bg.replace('#', ''); const n = parseInt(h, 16); return ((n >> 16 & 255) + (n >> 8 & 255) + (n & 255)) / 3 < 100; };
readTokens();

/* ================= shared state ================= */
const S = { act: 'jalan', sel: 'lutut', hover: null, soc: 0.82, P: 0, Pn: 0, I: 0, V: 52, tk: 0, temp: 34, phase: 0, t: 0, hist: [],
  shell: 'xray', cam: 'depan', ov: { labels: true, power: true, data: true, isolate: false }, chainSel: null, chainHi: [], tab: 'anatomi', ui: true };
const K = 1.73 / 1.977; // scale model to 173 cm
const WARP = 60;

/* ================= 3D ================= */
let THREE, OrbitControls, GLTFLoader, RoomEnvironment;
let renderer, scene, camera, controls, root, shellMesh, shellMats = {}, ready3D = false;
const PM = {}; // part -> {meshes:[], anchor:Vector3}
const ROT = [], RODS = [], FLOWS = [], MATS = [], HITS = [];
let tween = null;

const J = {
  head: [-0.01, 1.87, 0.07], neck: [0, 1.715, 0.0], chest: [0, 1.42, 0.025], waist: [0, 1.13, 0.0], pelvis: [0, 0.99, 0.0],
  shL: [-0.172, 1.565, 0.0], shR: [0.174, 1.57, 0.005], elL: [-0.25, 1.30, -0.007], elR: [0.236, 1.304, 0.025],
  wrL: [-0.271, 1.116, 0.049], wrR: [0.239, 1.118, 0.093], haL: [-0.298, 1.035, 0.06], haR: [0.266, 1.04, 0.103],
  hiL: [-0.088, 0.95, 0.02], hiR: [0.092, 0.95, 0.03], knL: [-0.132, 0.535, 0.05], knR: [0.175, 0.534, 0.08],
  anL: [-0.141, 0.11, -0.04], anR: [0.224, 0.11, 0.03], ftL: [-0.15, 0.03, 0.02], ftR: [0.25, 0.03, 0.11],
};

function V(a) { return new THREE.Vector3(a[0], a[1], a[2]); }
function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function regMat(key, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color: C[key], metalness: key === 'metal' ? .7 : .25, roughness: key === 'metal' ? .38 : .5, ...o });
  m.userData.key = key; MATS.push({ m, key }); return m;
}
function reg(part, ...meshes) {
  (PM[part] ??= { meshes: [] }).meshes.push(...meshes);
  for (const m of meshes) { m.userData.part = part; m.userData.baseOpacity = 1; }
}
const UP = () => new THREE.Vector3(0, 1, 0);

function rotary(part, pos, axis, r, len) {
  const g = new THREE.Group(); g.position.copy(V(pos));
  g.quaternion.setFromUnitVectors(UP(), V(axis).normalize());
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 28), regMat('metal'));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.05, len * .34, 28), regMat('rot'));
  const spin = new THREE.Group();
  const mark = new THREE.Mesh(new THREE.BoxGeometry(r * 1.55, len * 1.06, r * .2), regMat('rot'));
  spin.add(mark); g.add(body, band, spin); root.add(g);
  reg(part, body, band, mark); ROT.push({ spin, part, k: 0.6 + Math.random() * .3 });
}
function linear(part, a, b, r, phase = 0) {
  const A = V(a), B = V(b), dir = B.clone().sub(A), L = dir.length(); dir.normalize();
  const g = new THREE.Group(); g.position.copy(A); g.quaternion.setFromUnitVectors(UP(), dir);
  const mL = L * .45;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, mL, 24), regMat('metal')); body.position.y = mL / 2;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.07, r * 1.07, mL * .38, 24), regMat('lin')); band.position.y = mL * .55;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(r * .42, r * .42, 1, 12), regMat('ink-2', { metalness: .8, roughness: .3 }));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(r * .62, 14, 10), regMat('lin'));
  g.add(body, band, rod, tip); root.add(g);
  reg(part, body, band, rod, tip); RODS.push({ rod, tip, mL, span: L - mL, part, phase });
}
function pin(part, pos, axis, r, len) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 16), regMat('metal'));
  m.position.copy(V(pos)); m.quaternion.setFromUnitVectors(UP(), V(axis).normalize()); root.add(m); reg(part, m);
}
function box(part, key, pos, size, o) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), regMat(key, o)); m.position.copy(V(pos)); root.add(m); reg(part, m); return m;
}
function ball(part, key, pos, r) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), regMat(key)); m.position.copy(V(pos)); root.add(m); reg(part, m); return m;
}

function buildInternals() {
  // head sensors
  box('kepala', 'ink-2', [-0.01, 1.875, 0.135], [0.075, 0.026, 0.022]);
  for (const dx of [-0.024, 0, 0.024]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.012, 16), regMat('sen')); c.position.set(-0.01 + dx, 1.875, 0.149); c.rotation.x = Math.PI / 2; root.add(c); reg('kepala', c); }
  ball('kepala', 'sen', [-0.08, 1.86, 0.06], 0.007); ball('kepala', 'sen', [0.06, 1.86, 0.06], 0.007);
  // neck
  rotary('leher', [0, 1.725, 0], [0, 1, 0], 0.024, 0.03);
  rotary('leher', [0, 1.775, 0.01], [1, 0, 0], 0.02, 0.05);
  // shoulders, elbows, forearms, hands
  for (const s of ['L', 'R']) {
    const sg = s === 'L' ? -1 : 1, sh = J['sh' + s], el = J['el' + s], wr = J['wr' + s], ha = J['ha' + s];
    rotary('bahu', add(sh, [sg * -0.012, 0.01, 0]), [1, 0, 0], 0.036, 0.045);
    rotary('bahu', add(sh, [sg * 0.03, -0.022, 0]), [0, 0, 1], 0.032, 0.045);
    const ua = [el[0] - sh[0], el[1] - sh[1], el[2] - sh[2]];
    rotary('bahu', mix(sh, el, 0.3), ua, 0.028, 0.04);
    linear('siku', add(mix(sh, el, 0.42), [0, 0, -0.018]), add(el, [0, 0.02, -0.022]), 0.014, s === 'L' ? 0 : Math.PI);
    pin('siku', el, [1, 0, 0], 0.016, 0.05);
    const fa = [wr[0] - el[0], wr[1] - el[1], wr[2] - el[2]];
    rotary('pergelangan', mix(el, wr, 0.22), fa, 0.022, 0.03);
    linear('pergelangan', add(mix(el, wr, 0.42), [0.011, 0, 0]), add(wr, [0.011, 0.012, 0]), 0.008, 0);
    linear('pergelangan', add(mix(el, wr, 0.42), [-0.011, 0, 0]), add(wr, [-0.011, 0.012, 0]), 0.008, 1.3);
    // hand: 6 mini actuators + tendons + tactile tips
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.028, 12), regMat('fin'));
      m.position.copy(V(add(ha, [sg * -0.004 + (i % 2) * 0.008 * sg, 0.03 - Math.floor(i / 2) * 0.004, -0.02 + Math.floor(i / 2) * 0.018]))); root.add(m); reg('tangan', m);
      ROT.push({ spin: m, part: 'tangan', k: 1.2 });
    }
    const tips = [-0.03, -0.012, 0.006, 0.024].map(dz => add(ha, [sg * 0.004, -0.075, dz])); tips.push(add(ha, [sg * -0.012, -0.03, 0.045]));
    const pts = [];
    tips.forEach((tp, i) => { pts.push(V(add(ha, [0, 0.02, -0.02 + (i % 3) * 0.018])), V(tp)); ball('tangan', 'sen', tp, 0.005); });
    const tg = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: C.fin, transparent: true, opacity: .9 }));
    MATS.push({ m: tg.material, key: 'fin' }); root.add(tg);
  }
  // torso: battery with cell slabs + BMS, compute board, IMU
  box('baterai', 'pwr', [0, 1.415, 0.02], [0.2, 0.19, 0.085], { metalness: .2, roughness: .6 });
  for (let i = 1; i < 14; i++) box('baterai', 'ink-2', [-0.1 + i * 0.2 / 14, 1.415, 0.0635], [0.002, 0.18, 0.002]);
  box('baterai', 'sig', [0, 1.525, 0.02], [0.12, 0.025, 0.05]);
  box('komputer', 'sig', [0, 1.255, 0.025], [0.15, 0.1, 0.012]);
  box('komputer', 'ink', [0, 1.255, 0.034], [0.045, 0.045, 0.006]);
  for (let i = 0; i < 7; i++) box('komputer', 'metal', [-0.06 + i * 0.02, 1.255, 0.008], [0.004, 0.09, 0.022]);
  box('komputer', 'sen', [0.05, 1.22, 0.034], [0.014, 0.014, 0.008]);
  // waist
  rotary('pinggang', [0, 1.165, -0.005], [0, 1, 0], 0.05, 0.04);
  rotary('pinggang', [0, 1.085, 0], [1, 0, 0], 0.045, 0.075);
  // legs
  for (const s of ['L', 'R']) {
    const sg = s === 'L' ? -1 : 1, hi = J['hi' + s], kn = J['kn' + s], an = J['an' + s], ft = J['ft' + s], ph = s === 'L' ? 0 : Math.PI;
    rotary('pinggul', add(hi, [0, 0.05, 0]), [0, 1, 0], 0.038, 0.035);
    rotary('pinggul', add(hi, [sg * 0.005, 0, 0]), [0, 0, 1], 0.036, 0.048);
    linear('pinggul', add(hi, [sg * 0.01, -0.03, -0.035]), add(mix(hi, kn, 0.38), [0, 0, -0.035]), 0.018, ph + 0.6);
    linear('lutut', add(mix(hi, kn, 0.36), [0, 0, 0.026]), add(kn, [0, 0.045, 0.026]), 0.023, ph);
    pin('lutut', kn, [1, 0, 0], 0.022, 0.075);
    box('lutut', 'lin', add(kn, [0, -0.01, 0.034]), [0.05, 0.05, 0.006]);
    linear('pergkaki', add(mix(kn, an, 0.22), [0.017, 0, -0.03]), add(an, [0.017, 0.055, -0.03]), 0.013, ph + 1);
    linear('pergkaki', add(mix(kn, an, 0.22), [-0.017, 0, -0.03]), add(an, [-0.017, 0.055, -0.03]), 0.013, ph + 2.2);
    pin('pergkaki', an, [1, 0, 0], 0.016, 0.06);
    const ftc = [an[0] + (ft[0] - an[0]) * .4, 0.045, an[2] + 0.02];
    const ftd = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.009, 24), regMat('sen')); ftd.position.copy(V(ftc)); root.add(ftd); reg('telapak', ftd);
    pin('telapak', [ft[0] + 0.005 * sg, 0.02, ft[2] + 0.085], [1, 0, 0], 0.008, 0.07);
  }
  // power + data harness
  const paths = [];
  for (const s of ['L', 'R']) {
    const sg = s === 'L' ? -1 : 1;
    paths.push([J.chest, [sg * 0.1, 1.53, 0], J['sh' + s], J['el' + s], J['wr' + s], J['ha' + s]]);
    paths.push([J.chest, [sg * 0.02, 1.25, -0.04], J.waist, [sg * 0.05, 1.0, -0.02], J['hi' + s], J['kn' + s], J['an' + s], [J['ft' + s][0], 0.05, J['ft' + s][2]]]);
  }
  paths.push([J.chest, [0, 1.6, -0.02], J.neck, J.head]);
  const dot = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(16, 16, 14, 0, TAU); x.fill(); return new THREE.CanvasTexture(cv); })();
  const mk = (pts, kind) => {
    const off = kind === 'data' ? [0.008, 0, -0.012] : [0, 0, 0];
    const src = kind === 'data' ? [[0, 1.255, 0.02], ...pts.slice(1)] : pts;
    const curve = new THREE.CatmullRomCurve3(src.map(p => V(add(p, off))));
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(90));
    const lm = kind === 'data' ? new THREE.LineDashedMaterial({ color: C.sig, dashSize: 0.012, gapSize: 0.009, transparent: true, opacity: .85 }) : new THREE.LineBasicMaterial({ color: C.pwr, transparent: true, opacity: .75 });
    MATS.push({ m: lm, key: kind === 'data' ? 'sig' : 'pwr' });
    const line = new THREE.Line(geo, lm); if (kind === 'data') line.computeLineDistances();
    const n = kind === 'data' ? 7 : 6, arr = new Float32Array(n * 3);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pm = new THREE.PointsMaterial({ color: kind === 'data' ? C.sig : C.pwr, size: kind === 'data' ? 4 : 6, sizeAttenuation: false, map: dot, transparent: true, alphaTest: .4, depthTest: false });
    MATS.push({ m: pm, key: kind === 'data' ? 'sig' : 'pwr' });
    const pts3 = new THREE.Points(pg, pm); pts3.renderOrder = 5;
    root.add(line, pts3);
    FLOWS.push({ curve, line, pts: pts3, arr, n, kind, off: Math.random() });
  };
  for (const p of paths) { mk(p, 'power'); mk(p, 'data'); }
  // hit proxies + anchors
  for (const p of PARTS) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(p.id === 'baterai' || p.id === 'komputer' ? 0.07 : 0.05, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
    h.position.copy(V(p.anchor)); h.userData.part = p.id; root.add(h); HITS.push(h);
    (PM[p.id] ??= { meshes: [] }).anchor = V(p.anchor).multiplyScalar(K);
    for (const m of PM[p.id].meshes) { m.material = m.material.clone(); m.userData.baseEmissive = m.material.emissive.clone(); }
  }
}

function applyTheme() {
  readTokens();
  if (!ready3D) return;
  for (const { m, key } of MATS) m.color?.set(C[key]);
  for (const id in PM) for (const m of PM[id].meshes) { const k = m.material.userData.key; if (k) m.material.color.set(C[k]); }
  if (shellMats.xray) shellMats.xray.color.set(isDark() ? '#9aa6b5' : '#ffffff');
}

async function init3D() {
  try {
    THREE = await import('three');
    ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
    ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
    ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
  } catch (e) { $('#loaderTxt').textContent = 'Pustaka 3D gagal dimuat. Panel lain tetap bisa dipakai.'; return; }
  const stage = $('#stage');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  stage.prepend(renderer.domElement);
  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 0.7));
  const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(1.5, 3, 2.5); scene.add(dl);
  camera = new THREE.PerspectiveCamera(30, 1, 0.02, 50);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 0.35; controls.maxDistance = 7;
  controls.target.set(0, 0.88, 0); camera.position.set(0, 0.95, 3.6);
  controls.addEventListener('start', () => { tween = null; });
  root = new THREE.Group(); root.scale.setScalar(K); scene.add(root);
  // floor shadow disc
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const sx = sc.getContext('2d');
  const gr = sx.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = gr; sx.fillRect(0, 0, 128, 128);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0.04, 0.001, 0.04); scene.add(floor);
  buildInternals();
  ready3D = true;
  resize3D(); setView(S.cam, false);
  try {
    const res = await fetch('tesla_bot_geo.txt'); if (!res.ok) throw new Error('geo ' + res.status);
    $('#loaderBar').style.width = '45%';
    const bin = Uint8Array.from(atob((await res.text()).trim()), ch => ch.charCodeAt(0));
    $('#loaderBar').style.width = '70%';
    const gltf = await new Promise((ok, no) => new GLTFLoader().parse(bin.buffer, './', ok, no));
    gltf.scene.traverse(o => { if (o.isMesh) shellMesh = o; });
    root.add(gltf.scene);
    shellMats.solid = shellMesh.material;
    shellMats.xray = new THREE.MeshStandardMaterial({ color: isDark() ? '#9aa6b5' : '#ffffff', map: shellMats.solid.map, transparent: true, opacity: .16, depthWrite: false, metalness: .1, roughness: .35, side: THREE.FrontSide });
    shellMesh.renderOrder = 2;
    setShell(S.shell);
    $('#loader').hidden = true;
  } catch (e) { $('#loaderTxt').textContent = 'Model cangkang gagal dimuat; komponen internal tetap tampil.'; }
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointerleave', () => { S.hover = null; stage.classList.remove('pick'); });
}

function setShell(mode) {
  S.shell = mode;
  $$('#shells .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.shell === mode));
  if (!shellMesh) return;
  shellMesh.visible = mode !== 'off';
  shellMesh.material = mode === 'solid' ? shellMats.solid : shellMats.xray;
}

/* camera */
function viewOffsets() {
  const st = $('#stage'), W = st.clientWidth, H = st.clientHeight;
  if (!isDesk()) return { W, H, ox: 0, oy: -18, fw: W, fh: H - 40 };
  const lw = $('.col-left').offsetWidth + 16, rw = $('.col-right').offsetWidth + 16;
  const fb = $('.flowbar').offsetHeight + 12;
  return { W, H, ox: (lw - rw) / 2, oy: (fb - 30) / 2 * -1, fw: W - lw - rw, fh: H - fb - 30 };
}
function resize3D() {
  if (!ready3D) return;
  const o = viewOffsets();
  renderer.setSize(o.W, o.H, false);
  camera.aspect = o.W / o.H;
  camera.setViewOffset(o.W, o.H, -o.ox, -o.oy, o.W, o.H);
  camera.updateProjectionMatrix();
}
function fitDist() {
  const o = viewOffsets(), fov = camera.fov * Math.PI / 180, tv = Math.tan(fov / 2);
  const dh = 0.99 / tv * Math.max(1, o.H / Math.max(o.fh, 200));
  const dw = 0.62 / (tv * (o.W / o.H)) * Math.max(1, o.W / Math.max(o.fw, 200));
  return Math.max(dh, dw) * 1.04;
}
function sph(t, az, el, r) {
  const a = az * Math.PI / 180, e = el * Math.PI / 180;
  return new THREE.Vector3(t.x + r * Math.sin(a) * Math.cos(e), t.y + r * Math.sin(e), t.z + r * Math.cos(a) * Math.cos(e));
}
const CAMS = { depan: [0, 4], tiga: [34, 10], samping: [90, 4], belakang: [180, 4] };
function setView(name, anim = true) {
  S.cam = name;
  $$('#cams .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.cam === name));
  if (!ready3D) return;
  let t, pos;
  if (name === 'fokus') {
    const p = P[S.sel]; t = PM[p.id].anchor.clone();
    pos = sph(t, p.view.az, p.view.el, p.view.r * 1.45 * (isDesk() ? 1 : 1.25));
  } else { t = new THREE.Vector3(0.02, 0.87, 0.02); const [az, el] = CAMS[name]; pos = sph(t, az, el, fitDist()); }
  if (!anim || REDUCED) { controls.target.copy(t); camera.position.copy(pos); controls.update(); tween = null; return; }
  tween = { t0: performance.now(), d: 900, ft: controls.target.clone(), fp: camera.position.clone(), tt: t, tp: pos };
}
function stepTween(now) {
  if (!tween) return;
  const k = clamp((now - tween.t0) / tween.d, 0, 1), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  controls.target.lerpVectors(tween.ft, tween.tt, e);
  // interpolate around target to avoid cutting through the body
  const a = tween.fp.clone().sub(tween.ft), b = tween.tp.clone().sub(tween.tt);
  const sa = new THREE.Spherical().setFromVector3(a), sb = new THREE.Spherical().setFromVector3(b);
  let dth = sb.theta - sa.theta; if (dth > Math.PI) dth -= TAU; if (dth < -Math.PI) dth += TAU;
  const s = new THREE.Spherical(lerp(sa.radius, sb.radius, e), lerp(sa.phi, sb.phi, e), sa.theta + dth * e);
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));
  if (k >= 1) tween = null;
}

/* picking */
let downAt = null;
const ray = () => new THREE.Raycaster();
function pickAt(e) {
  if (!ready3D) return null;
  const r = renderer.domElement.getBoundingClientRect();
  const m = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  const rc = ray(); rc.setFromCamera(m, camera);
  const objs = [...HITS]; for (const id in PM) objs.push(...PM[id].meshes);
  const hit = rc.intersectObjects(objs, false).find(h => h.object.userData.part);
  return hit ? hit.object.userData.part : null;
}
function onPointerMove(e) {
  if (e.buttons) return;
  const id = pickAt(e); S.hover = id; $('#stage').classList.toggle('pick', !!id);
}
function onPointerUp(e) {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  const id = pickAt(e); if (id) select(id, true);
}

/* labels */
const tagEls = {};
function buildTags() {
  const box = $('#tags'); box.innerHTML = '';
  for (const p of PARTS) {
    const b = document.createElement('button'); b.className = 'tag'; b.innerHTML = `<span class="nl">${p.name}</span><span class="ns">${p.short || p.name}</span><small>${p.dof}</small>`;
    b.addEventListener('click', () => select(p.id, true));
    b.addEventListener('pointerenter', () => S.hover = p.id); b.addEventListener('pointerleave', () => S.hover = null);
    box.appendChild(b); tagEls[p.id] = b;
  }
}
function project(v) {
  const o = viewOffsets(), q = v.clone().project(camera);
  return { x: (q.x + 1) / 2 * o.W, y: (1 - q.y) / 2 * o.H, z: q.z };
}
function layoutTags() {
  const svg = $('#leaders');
  if (!ready3D || !S.ov.labels || S.tab !== 'anatomi') { svg.innerHTML = ''; for (const id in tagEls) tagEls[id].hidden = true; return; }
  const o = viewOffsets(), desk = isDesk();
  const lw = desk ? $('.col-left').offsetWidth + 24 : 8, rw = desk ? o.W - $('.col-right').offsetWidth - 24 : o.W - 8;
  const c = project(new THREE.Vector3(0, 0.95, 0)), e = project(new THREE.Vector3(0.36 * K, 0.95, 0));
  const half = Math.max(30, Math.abs(e.x - c.x));
  const items = [];
  for (const p of PARTS) {
    const a = project(PM[p.id].anchor);
    const vis = a.z < 1 && a.x > lw - 40 && a.x < rw + 40 && a.y > 20 && a.y < o.H - 20;
    if (!vis) { tagEls[p.id].hidden = true; continue; }
    const side = a.x < c.x ? 'L' : 'R';
    items.push({ id: p.id, a, side, y: a.y });
  }
  const gap = desk ? 32 : 28;
  for (const side of ['L', 'R']) {
    const L = items.filter(i => i.side === side).sort((x, y) => x.y - y.y);
    for (let i = 1; i < L.length; i++) if (L[i].y < L[i - 1].y + gap) L[i].y = L[i - 1].y + gap;
    for (let i = L.length - 1; i >= 0; i--) { const lim = (i === L.length - 1 ? o.H - 26 : L[i + 1].y - gap); if (L[i].y > lim) L[i].y = lim; }
  }
  let html = '';
  for (const it of items) {
    const el = tagEls[it.id]; el.hidden = false;
    const L = it.side === 'L', w = el.offsetWidth;
    let x = L ? Math.max(lw, c.x - half - 34 - w) : Math.min(rw - w, c.x + half + 34);
    if (!desk) x = L ? Math.max(6, Math.min(x, it.a.x - w - 24)) : Math.min(o.W - w - 6, Math.max(x, it.a.x + 24));
    el.style.transform = `translate(${x.toFixed(1)}px,${(it.y - 9).toFixed(1)}px)`;
    el.classList.toggle('r', L);
    const sel = it.id === S.sel, hov = it.id === S.hover;
    el.classList.toggle('sel', sel); el.classList.toggle('hov', hov && !sel);
    const lx = L ? x + w + 4 : x - 4;
    html += `<g class="${sel ? 'sel' : ''}"><polyline points="${it.a.x.toFixed(1)},${it.a.y.toFixed(1)} ${(lx + (L ? 10 : -10)).toFixed(1)},${it.y.toFixed(1)} ${lx.toFixed(1)},${it.y.toFixed(1)}"/><circle cx="${it.a.x.toFixed(1)}" cy="${it.a.y.toFixed(1)}" r="${sel ? 3.5 : 2.6}"/></g>`;
  }
  svg.innerHTML = html;
}

/* per-frame 3D animation */
const tmpC = () => new THREE.Color();
function anim3D(dt, now) {
  if (!ready3D) return;
  const A = ACT[S.act], t = S.t, mot = REDUCED ? 0 : 1;
  for (const r of ROT) {
    const ld = A.load[r.part] ?? .1;
    r.spin.rotation.y += dt * mot * (0.4 + 14 * ld * Math.max(A.motion, .15)) * r.k;
  }
  for (const r of RODS) {
    const ld = A.load[r.part] ?? .1, amp = .22 * Math.max(A.motion, .08) * (0.4 + ld);
    const s = mot ? Math.sin(TAU * (S.act === 'jalan' ? S.phase : t * .25) + r.phase) : 0;
    const ext = r.span * clamp(0.55 + amp * s, 0.15, 0.95);
    const len = r.mL * .5 + ext;
    r.rod.scale.y = len; r.rod.position.y = r.mL * .5 + len / 2; r.tip.position.y = r.mL + ext;
  }
  const pRate = S.P / 500;
  for (const f of FLOWS) {
    const show = f.kind === 'power' ? S.ov.power : S.ov.data;
    f.line.visible = show; f.pts.visible = show && !REDUCED;
    if (!show || REDUCED) continue;
    const sp = f.kind === 'power' ? 0.06 + 0.22 * pRate : 0.5;
    f.off = (f.off + dt * sp) % 1;
    for (let i = 0; i < f.n; i++) { const u = (f.off + i / f.n) % 1, p = f.curve.getPointAt(u); f.arr[i * 3] = p.x; f.arr[i * 3 + 1] = p.y; f.arr[i * 3 + 2] = p.z; }
    f.pts.geometry.attributes.position.needsUpdate = true;
  }
  const pulse = 0.55 + 0.3 * Math.sin(now / 260);
  const hotC = new THREE.Color(C.hot), accC = new THREE.Color(C.accent);
  for (const id in PM) {
    const sel = id === S.sel, hi = sel || id === S.hover || S.chainHi.includes(id);
    const ld = A.load[id] ?? 0;
    const dimK = S.ov.isolate ? .12 : S.cam === 'fokus' ? .3 : 1;
    const dim = dimK < 1 && !sel && !S.chainHi.includes(id);
    for (const m of PM[id].meshes) {
      const mt = m.material;
      if (hi) { mt.emissive.copy(accC); mt.emissiveIntensity = sel ? pulse : .35; }
      else if (ld > .2 && mt.userData.key !== 'metal') { mt.emissive.copy(hotC); mt.emissiveIntensity = (ld - .2) * .55; }
      else { mt.emissive.copy(m.userData.baseEmissive); mt.emissiveIntensity = 1; }
      const op = dim ? dimK : 1;
      if (mt.opacity !== op) { mt.transparent = op < 1; mt.opacity = op; mt.depthWrite = op === 1; mt.needsUpdate = true; }
    }
  }
}
