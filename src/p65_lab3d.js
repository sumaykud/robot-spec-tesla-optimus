
/* ================= actuator lab: model 3D (Blender → GLB) ================= */
// Model dibangun oleh tools/build_actuator.py (rotari) dan tools/build_linear.py (linear).
// Sumbu aktuator = sumbu Y model; bagian diberi nama tetap. Satu renderer dipakai bersama semua model.
const L3 = { st: 'idle', fam: null, M: {} };
let L3r, L3s, L3c, L3ctl, L3clip, L3GL, l3tmp;
const L3_HINT = 'Seret untuk memutar · gulir untuk zoom';

/* --- definisi per model ---
   order: nama objek di GLB · name: label bagian · ex: offset urai [aksial, ke atas] (m)
   tag: arah label urai [−1 atas | 1 bawah, tingkat jarak] · notes: keterangan saat rakit/potong
   pose: posisi kamera relatif target per mode · exT: geser target saat diurai · tint: warnai bagian dengan token tema */
const L3_DEF = {
  rotary: {
    file: 'actuator_rotary_geo.txt', mid: .056, mode: 'rakit', tint: { flexspline: 'rot' },
    order: ['housing_rear', 'encoder_pcb', 'motor_stator', 'motor_rotor', 'motor_housing', 'wave_generator', 'flexspline', 'circular_spline', 'crossroller_bearing', 'output_flange'],
    name: {
      housing_rear: 'Tutup belakang', encoder_pcb: 'Encoder + driver', motor_stator: 'Stator (gulungan)', motor_rotor: 'Rotor magnet',
      motor_housing: 'Rumah motor', wave_generator: 'Wave generator', flexspline: 'Flexspline', circular_spline: 'Circular spline',
      crossroller_bearing: 'Bantalan cross-roller', output_flange: 'Flens output',
    },
    ex: { housing_rear: [0, 0], encoder_pcb: [.037, 0], motor_stator: [.077, 0], motor_rotor: [.11, 0], motor_housing: [.147, 0], wave_generator: [.2, 0],
      flexspline: [.256, 0], circular_spline: [.312, 0], crossroller_bearing: [.362, 0], output_flange: [.406, 0] },
    tag: { housing_rear: [-1, 1], encoder_pcb: [1, 1], motor_stator: [-1, .55], motor_rotor: [1, .55], motor_housing: [-1, 1],
      wave_generator: [1, 1], flexspline: [-1, .55], circular_spline: [1, .55], crossroller_bearing: [-1, 1], output_flange: [1, 1] },
    notes: [['motor_housing', 0, 'Motor → wave generator (input cepat)', -1, 1.2], ['output_flange', 0, 'Flens output (pelan, torsi besar)', -1, .8]],
    pose: { rakit: [.25, .15, .36], urai: [.06, .24, .7], potong: [.03, .05, .38] }, exT: [.205, 0],
    setup(m) {
      // flexspline: simpan posisi asal + bobot lendutan (penuh di gigi, nol di diafragma & hub)
      const p = m.parts.flexspline; if (!p) return;
      p.o.traverse(o => { if (o.isMesh) p.mesh = o; });
      p.mesh.geometry = p.mesh.geometry.clone(); p.pos = p.mesh.geometry.attributes.position; p.pos.setUsage(THREE.DynamicDrawUsage);
      const a = p.pos.array, n = p.pos.count;
      p.w = new Float32Array(n); p.ang = new Float32Array(n); p.r0 = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = a[i * 3], y = a[i * 3 + 1], z = a[i * 3 + 2], r = Math.hypot(x, z);
        const t = Math.min(1, Math.max(0, (.096 - y) / (.096 - .076)));
        p.w[i] = r < .02 ? 0 : t * t * (3 - 2 * t); p.ang[i] = Math.atan2(z, x); p.r0[i] = r;
      }
      m.phi = 0; m.psi = 0;
    },
    animate(m, dt, v) {
      // wave generator & rotor = input; flexspline + flens output = −input × 2 / 60 gigi (rasio model 30 : 1)
      if (!REDUCED) { m.phi += (v.rpm / 1800) * 2.4 * dt; m.psi = -m.phi * 2 / 60; }
      const P = m.parts;
      for (const n of ['wave_generator', 'motor_rotor']) if (P[n]) P[n].g.rotation.y = m.phi;
      for (const n of ['flexspline', 'output_flange']) if (P[n]) P[n].g.rotation.y = m.psi;
      // lendutan elips flexspline mengikuti sumbu panjang wave generator (dalam kerangka flexspline)
      const f = P.flexspline; if (!f) return;
      const a = f.pos.array, ph = m.phi - m.psi, E = .0012;
      for (let i = 0, n = f.w.length; i < n; i++) {
        if (!f.w[i]) continue;
        const th = f.ang[i], r = f.r0[i] + E * f.w[i] * Math.cos(2 * (th + ph));
        a[i * 3] = r * Math.cos(th); a[i * 3 + 2] = r * Math.sin(th);
      }
      f.pos.needsUpdate = true;
    },
    cap(v) {
      const T = v.T, N = v.R, eta = LAB.rotary.eta;
      return `<div><b>Motor</b><span>${fmt(v.rpm)} rpm · ${fmt(T, 2)} Nm</span></div>
        <div style="--c:var(--rot)"><b>Rasio</b><span>${N} : 1  (Nf ÷ (Nc − Nf))</span></div>
        <div style="--c:var(--accent)"><b>Output</b><span>${fmt(v.rpm / N, 1)} rpm · ${fmt(T * N * eta)} Nm</span></div>
        <small>Model: 60/62 gigi (rasio 30 : 1) agar gigi terbaca</small>`;
    },
  },
  linear: {
    file: 'actuator_linear_geo.txt', mid: .11, mode: 'potong', tint: { nut: 'lin' }, noclip: ['screw', 'roller_set'],
    order: ['housing_rear', 'housing', 'motor_stator', 'nut', 'roller_set', 'housing_front', 'screw'],
    name: {
      housing_rear: 'Tutup belakang', housing: 'Rumah motor', motor_stator: 'Stator (gulungan)', nut: 'Mur = rotor magnet',
      roller_set: 'Rol berulir + carrier', housing_front: 'Tutup depan', screw: 'Batang ulir',
    },
    // urai dua baris: atas = rumah, stator, batang ulir; sumbu = tutup belakang, mur, rol, tutup depan
    ex: { housing: [-.05, .08], motor_stator: [.075, .08], screw: [.2, .08], housing_rear: [-.07, 0], nut: [0, 0], roller_set: [.1, 0], housing_front: [.16, 0] },
    tag: { housing: [-1, .55], motor_stator: [-1, .55], screw: [-1, .55], housing_rear: [1, .5], nut: [1, .85], roller_set: [1, .5], housing_front: [1, .85] },
    notes: [['motor_stator', 0, 'Stator + mur berputar', -1], ['roller_set', 0, 'Rol berulir', 1, .8], ['screw', .125, 'Batang ulir (tidak berputar, bergeser)', 1]],
    pose: { rakit: [.15, .11, .36], urai: [.02, .07, .6], potong: [.02, .035, .37] }, exT: [.051, .035],
    setup(m) {
      m.disp = 0; m.phi = 0; m.t = 0;
      const rs = m.parts.roller_set; if (!rs) return;
      m.rollers = []; rs.o.traverse(o => { if (/^roller_\d/.test(o.name)) m.rollers.push([o, o.rotation.y]); });
    },
    animate(m, dt, v) {
      // batang maju-mundur (seperti animasi 2D); mur berputar sebanding perpindahan ÷ lead
      if (!REDUCED) m.t += dt * (.6 + v.rpm / 6000);
      const disp = (.5 + .45 * Math.sin(m.t)) * .07;
      m.phi = disp / (.006 * v.R) * TAU;               // lead visual 6 mm per 1 mm lead asli
      const carrier = m.phi * .0152 / (.0152 + .0089);   // planet: ring (mur) diputar, matahari (batang) diam
      const spin = -(m.phi - carrier) * .0152 / .00285;  // putaran rol pada porosnya, relatif carrier
      const P = m.parts;
      if (P.nut) P.nut.g.rotation.y = m.phi;
      if (P.roller_set) P.roller_set.g.rotation.y = carrier;
      for (const [o, b] of m.rollers) o.rotation.y = b + spin;
      if (P.screw) P.screw.g.position.y += disp;
      m.screwDisp = disp;
    },
    cap(v) {
      const T = v.T, L = v.R, eta = LAB.linear.eta, F = TAU * eta * T / (L / 1000);
      return `<p class="f">F = 2π · ${fmt(eta, 2)} · ${fmt(T, 2)} Nm ÷ ${fmt(L, 1)} mm = ${fmt(F)} N</p>
        <p>≈ ${fmt(F / 9.81)} kgf · kecepatan ${fmt(v.rpm / 60 * L)} mm/s</p>`;
    },
  },
};

async function initLab3D() {
  if (L3.st === 'idle') {
    L3.st = 'loading';
    try {
      THREE ??= await import('three');
      const [{ OrbitControls: OC }, { GLTFLoader: GL }, { DRACOLoader }, { RoomEnvironment: RE }] = await Promise.all([
        import('three/addons/controls/OrbitControls.js'), import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/loaders/DRACOLoader.js'), import('three/addons/environments/RoomEnvironment.js')]);
      const cv = $('#labGl');
      L3r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
      L3r.setPixelRatio(Math.min(devicePixelRatio, 2));
      L3r.outputColorSpace = THREE.SRGBColorSpace;
      L3r.toneMapping = THREE.ACESFilmicToneMapping; L3r.toneMappingExposure = 1.1;
      L3r.localClippingEnabled = true;
      L3s = new THREE.Scene();
      L3s.environment = new THREE.PMREMGenerator(L3r).fromScene(new RE(), 0.04).texture;
      const kl = new THREE.DirectionalLight(0xffffff, 1.6); kl.position.set(.4, .6, .5); L3s.add(kl);
      L3s.add(new THREE.HemisphereLight(0xffffff, 0x404858, .5));
      L3c = new THREE.PerspectiveCamera(28, 1, .01, 10);
      L3c.position.set(.2, .12, .3);
      L3ctl = new OC(L3c, cv);
      L3ctl.enableDamping = true; L3ctl.dampingFactor = .08; L3ctl.minDistance = .14; L3ctl.maxDistance = 1.4; L3ctl.enablePan = false;
      L3ctl.addEventListener('start', () => { const m = L3.M[L3.fam]; if (m) m.drag = true; });
      L3clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1);
      const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
      L3GL = new GL().setDRACOLoader(draco);
      l3tmp = new THREE.Vector3();
      L3.st = 'ready';
    } catch (e) { L3.st = 'fail'; }
  }
  if (L3.st === 'ready') loadLab3D(labFam);
  syncLabView();
}

async function loadLab3D(fam) {
  const D = L3_DEF[fam]; if (!D || L3.M[fam]) return;
  const m = L3.M[fam] = { st: 'loading', D, parts: {}, ex: 0, cut: D.mode === 'potong' ? 1 : 0, mode: D.mode, drag: false, tags: [], notes: [] };
  syncLabView();
  try {
    const res = await fetch(D.file); if (!res.ok) throw new Error('geo ' + res.status);
    const bin = Uint8Array.from(atob((await res.text()).trim()), ch => ch.charCodeAt(0));
    const gltf = await new Promise((ok, no) => L3GL.parse(bin.buffer, './', ok, no));
    // sumbu aktuator dibaringkan: output ke kanan
    const root = new THREE.Group(); root.rotation.z = -Math.PI / 2; root.visible = false; L3s.add(root);
    const center = new THREE.Group(); center.position.y = -D.mid; root.add(center);
    Object.assign(m, { root, center });
    for (const name of D.order) {
      const o = gltf.scene.getObjectByName(name); if (!o) continue;
      const g = new THREE.Group(); g.add(o); center.add(g);
      const clip = !(D.noclip || []).includes(name), tint = D.tint[name];
      o.traverse(x => {
        if (!x.isMesh) return;
        x.material = x.material.clone();
        x.material.side = THREE.DoubleSide; if (clip) x.material.clippingPlanes = [L3clip];
        if (tint) x.material.color.lerp(new THREE.Color(C[tint]), .45);
      });
      const bb = new THREE.Box3().setFromObject(o);
      m.parts[name] = { g, o, mid: (bb.min.y + bb.max.y) / 2 };
    }
    D.setup(m);
    m.st = 'ready';
  } catch (e) { m.st = 'fail'; }
  syncLabView();
}

function setLabMode(md) {
  const m = L3.M[labFam]; if (!m) return;
  m.mode = md; m.drag = false; // kembalikan kamera ke pose mode
  syncLabView();
}

function syncLabView() {
  const D = L3_DEF[labFam], m = L3.M[labFam], on = !!(m && m.st === 'ready' && L3.st === 'ready');
  const failed = L3.st === 'fail' || (m && m.st === 'fail');
  $('#labGl').hidden = !on; $('#labCv').hidden = on;
  $('#labTags').hidden = !on; $('#labNotes').hidden = !on; $('#labCap').hidden = !on;
  $('#labMode').hidden = !D || failed;
  $('#labHint').hidden = !D;
  $('#labHint').textContent = failed ? 'Model 3D gagal dimuat; memakai animasi 2D.' : on ? L3_HINT : 'Memuat model 3D…';
  $('#labV').classList.toggle('is3d', !!D);
  $$('#labMode .chip').forEach(b => b.setAttribute('aria-pressed', !!m && b.dataset.m === m.mode));
  if (!on || L3.fam === labFam) return;
  // ganti model aktif: tampilkan root-nya, bangun ulang label
  for (const k in L3.M) if (L3.M[k].root) L3.M[k].root.visible = k === labFam;
  L3.fam = labFam; m.capKey = '';
  const box = $('#labTags'); box.innerHTML = '';
  m.tags = D.order.filter(n => m.parts[n]).map(n => { const d = document.createElement('span'); d.textContent = D.name[n]; box.append(d); return [n, d]; });
  const nb = $('#labNotes'); nb.innerHTML = '';
  m.notes = D.notes.filter(x => m.parts[x[0]]).map(x => { const d = document.createElement('span'); d.textContent = x[2]; nb.append(d); return [x, d]; });
  const P = D.pose[m.mode]; L3c.position.set(P[0], P[1], P[2]); L3ctl.target.set(0, 0, 0);
}

function l3place(d, m, part, y, up, tier, w, h) {
  // proyeksikan titik pada sumbu bagian ke layar, geser label ke atas/bawah dengan garis penunjuk
  const p = m.parts[part];
  l3tmp.set(p.g.position.x, y + p.g.position.y, 0); m.center.localToWorld(l3tmp); l3tmp.project(L3c);
  const hw = d.offsetWidth / 2 + 6; // jaga label tetap di dalam kanvas
  const x = Math.min(w - hw, Math.max(hw, (l3tmp.x * .5 + .5) * w)), yy = (-l3tmp.y * .5 + .5) * h, off = Math.min(h * .25, 100) * tier;
  d.style.transform = `translate(${x}px,${yy + up * off}px) translate(-50%,-50%)`; d.style.setProperty('--l', off - 12 + 'px');
  d.classList.toggle('up', up < 0);
}

function drawLab3D(dt, v) {
  const m = L3.M[labFam]; if (!m || m.st !== 'ready' || L3.fam !== labFam) return;
  const D = m.D, cv = $('#labGl'), w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * L3r.getPixelRatio()) || cv.height !== Math.round(h * L3r.getPixelRatio())) {
    L3r.setSize(w, h, false); L3c.aspect = w / h; L3c.updateProjectionMatrix();
  }
  const k = 1 - Math.exp(-dt * 5);
  m.ex += ((m.mode === 'urai' ? 1 : 0) - m.ex) * k; m.cut += ((m.mode === 'potong' ? 1 : 0) - m.cut) * k;
  // kamera: ikuti pose mode sampai pengguna menyeret
  const tx = m.ex * D.exT[0], ty = m.ex * D.exT[1], nar = Math.max(1, 1.8 / (w / h)); // kanvas sempit: kamera mundur sebanding
  if (!m.drag) {
    const P = D.pose[m.mode];
    L3c.position.lerp(l3vec(tx + P[0] * nar, ty + P[1] * nar, P[2] * nar), k);
    L3ctl.target.lerp(l3vec(tx, ty, 0), k);
  }
  L3ctl.update();
  L3clip.constant = .0005 + (1 - m.cut) * .3; // potongan: bidang z bergerak dari jauh ke 0
  // urai: offset [aksial, ke atas]; di kerangka root, "atas" layar = −x lokal
  for (const n of D.order) {
    const p = m.parts[n]; if (!p) continue;
    const [ax, up] = D.ex[n] || [0, 0];
    p.g.position.set(-up * m.ex, ax * m.ex, 0);
  }
  D.animate(m, dt, v);
  L3r.render(L3s, L3c);
  // label bagian saat diurai, keterangan saat rakit/potong
  const sTag = Math.min(1, Math.max(0, (m.ex - .6) * 3)), sNote = Math.min(1, Math.max(0, (.35 - m.ex) * 3));
  $('#labTags').style.opacity = sTag; $('#labNotes').style.opacity = sNote;
  if (sTag) for (const [n, d] of m.tags) { const [up, tier] = D.tag[n]; l3place(d, m, n, m.parts[n].mid, up, tier, w, h); }
  if (sNote) for (const [[n, y, , up, tier = 1], d] of m.notes) l3place(d, m, n, y || m.parts[n].mid, up, tier, w, h);
  const key = labFam + v.T + '|' + v.rpm + '|' + v.R;
  if (m.capKey !== key) { m.capKey = key; $('#labCap').innerHTML = D.cap(v); }
}
function l3vec(x, y, z) { return (l3vec.v ??= new THREE.Vector3()).set(x, y, z); }
