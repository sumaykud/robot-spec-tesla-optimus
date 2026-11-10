
/* ================= UI ================= */
function buildParts() {
  const nav = $('#parts'); let html = '';
  for (const g of GROUPS) {
    html += `<h3 class="eyebrow">${g}</h3>`;
    for (const p of PARTS.filter(q => q.grp === g)) html += `<button class="part" data-id="${p.id}" style="--c:var(--${TYPE[p.type][0]})"><span class="dot"></span><span class="nm">${p.name}</span><span class="lv">${p.dof}</span></button>`;
  }
  nav.innerHTML = html;
  $$('.part', nav).forEach(b => {
    b.addEventListener('click', () => select(b.dataset.id, true));
    b.addEventListener('pointerenter', () => S.hover = b.dataset.id); b.addEventListener('pointerleave', () => S.hover = null);
  });
}
function renderDetail() {
  const p = P[S.sel], ty = TYPE[p.type];
  $('#dGrp').textContent = p.grp;
  $('#dDom').innerHTML = `<i style="--c:var(--${ty[0]})"></i>${ty[1]}`;
  $('#dName').textContent = p.name; $('#dEn').textContent = p.en; $('#dRole').textContent = p.role;
  $('#cTitle').textContent = p.chart[1]; $('#cCap').textContent = p.chart[2];
  $('#cMeta').textContent = p.chart[0] === 'battery' ? 'simulasi' : p.chart[0] === 'gait' || p.chart[0] === 'knee' ? 'ilustratif' : 'animasi';
  $('#dSteps').innerHTML = p.steps.map(s => `<li><span>${s}</span></li>`).join('');
  $('#dSpecs').innerHTML = p.specs.map(([k, v, c]) => `<dt>${k}</dt><dd>${v}</dd><span class="c">${c ? cf(c) : '<span class="cf cf-I" style="font-style:normal">—</span>'}</span>`).join('');
  $('#dInd').innerHTML = `<div><b>Masalah</b>${p.ind[0]}</div><div class="dev"><b>Sedang dikembangkan</b>${p.ind[1]}</div>`;
  $('#dLinks').innerHTML = p.links.map(id => `<button class="chip" data-go="${id}">${P[id].name}</button>`).join('');
  $$('#dLinks .chip').forEach(b => b.addEventListener('click', () => select(b.dataset.go, true)));
  $$('#parts .part').forEach(b => b.setAttribute('aria-current', b.dataset.id === S.sel));
}
function select(id, fromUser) {
  if (!P[id]) return;
  S.sel = id; renderDetail();
  if (fromUser) {
    $('#detail').scrollTop = 0;
    if (S.cam === 'fokus' || isDesk()) setView('fokus');
    setHash(id);
  }
}
function setHash(h) { try { history.replaceState(null, '', '#' + h); } catch (e) { location.hash = h; } }

function buildChain() {
  const el = $('#chain'); let html = '';
  CHAIN.forEach(([id, t, v], i) => {
    if (i) html += '<span class="arr" aria-hidden="true">›</span>';
    html += `<button class="node" data-n="${id}"><span class="n">${i + 1}</span><span class="t">${t}</span><span class="v">${v}</span></button>`;
  });
  el.innerHTML = html;
  $$('.node', el).forEach(b => b.addEventListener('click', () => setChain(S.chainSel === b.dataset.n ? null : b.dataset.n)));
  setChain(null);
}
function setChain(id) {
  S.chainSel = id; const it = CHAIN.find(c => c[0] === id);
  S.chainHi = it ? it[3] : [];
  $$('#chain .node').forEach(b => b.classList.toggle('sel', b.dataset.n === id));
  $('#chainCap').textContent = it ? it[4] : 'Satu siklus: kamera melihat, AI memutuskan, motor bergerak, sensor melapor balik. Makin ke kanan, makin cepat detaknya.';
}

function setAct(a) {
  S.act = a;
  $$('#acts .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.act === a));
  const A = ACT[a];
  $('#pLabel').textContent = `Daya total · ${A.name}`;
  $('#pConf').innerHTML = A.conf === 'R' ? 'angka Tesla' : 'estimasi';
}

/* ================= simulation ================= */
function simStep(dt) {
  const A = ACT[S.act];
  S.t += dt;
  S.phase = (S.phase + dt * 0.9) % 1;
  let Pt = A.P;
  if (S.act === 'jalan') Pt = A.P + 110 * Math.sin(TAU * 2 * S.phase - 1);
  if (S.act === 'angkat') Pt = A.P + 160 * Math.sin(S.t * 1.1 - Math.PI / 2);
  S.Pn = Pt; S.P = lerp(S.P || Pt, Pt, clamp(dt * 6, 0, 1));
  const ocv = 14 * (3.3 + 0.9 * S.soc), Rp = 0.06;
  S.I = S.P / ocv; S.V = ocv - S.I * Rp;
  S.soc = Math.max(0.02, S.soc - S.P * dt * WARP / 3600 / 2300);
  if (S.soc <= 0.021) S.soc = 0.82;
  S.tk = A.knee(S.phase, S.t);
  const Tss = 30 + 0.0018 * S.tk * S.tk;
  S.temp += (Tss - S.temp) * clamp(dt / 18, 0, 1);
  S.hist.push(S.P); if (S.hist.length > 300) S.hist.shift();
}
let lastRO = 0;
function renderReadout(now) {
  if (now - lastRO < 90) return; lastRO = now;
  $('#bigP').innerHTML = `${fmt(S.P)}<small>W</small>`;
  $('#sSoc').textContent = fmt(S.soc * 100);
  $('#sRem').textContent = fmt(S.soc * 2300 * .9 / Math.max(ACT[S.act].P, 1), 1);
  $('#sI').textContent = fmt(S.I, 1); $('#sV').textContent = fmt(S.V, 1);
  $('#sTk').textContent = fmt(S.tk); $('#sTt').textContent = fmt(S.temp);
  const [c, w, h] = fitCv($('#spark'));
  const H = S.hist; if (H.length < 2) return;
  const y = v => h - 3 - v / 900 * (h - 6);
  c.strokeStyle = C.line; c.beginPath(); c.moveTo(0, y(500)); c.lineTo(w, y(500)); c.stroke();
  c.beginPath(); H.forEach((v, i) => { const x = i / 299 * w; i ? c.lineTo(x, y(v)) : c.moveTo(x, y(v)); });
  c.strokeStyle = C.accent; c.lineWidth = 1.5; c.stroke();
  c.lineTo((H.length - 1) / 299 * w, h); c.lineTo(0, h); c.closePath(); c.fillStyle = rgba(C.accent, .1); c.fill();
  const lx = (H.length - 1) / 299 * w; c.beginPath(); c.arc(lx, y(H[H.length - 1]), 2.5, 0, TAU); c.fillStyle = C.accent; c.fill();
  txt(c, '500 W', w, y(500) - 3, { s: 8.5, a: 'right', c: C['ink-3'] });
}

/* ================= tabs + routing ================= */
const TABS = ['anatomi', 'aktuator', 'elektronik', 'chip', 'os', 'industri'];
function showTab(tab) {
  S.tab = tab;
  for (const t of TABS) $('#v-' + t).hidden = t !== tab;
  $$('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  if (tab === 'anatomi') requestAnimationFrame(() => { resize3D(); });
  if (tab === 'aktuator') initLab3D();
  else { $('#v-' + tab).scrollTop = 0; if (!isDesk()) scrollTo(0, 0); }
}
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (TABS.includes(h)) showTab(h);
  else if (P[h]) { showTab('anatomi'); select(h, false); if (ready3D) setView('fokus', false); else S.cam = 'fokus'; }
  else showTab('anatomi');
}

/* ================= actuator lab ================= */
const LAB = {
  rotary: { T: ['Torsi motor', .2, 2.5, .05, 1.2, v => `${fmt(v, 2)} Nm`], R: ['Rasio gigi', 30, 160, 10, 100, v => `${v} : 1`], eta: .75,
    steps: ['Motor PMSM frameless memutar wave generator, sebuah cam elips dengan bantalan tipis.', 'Flexspline (cangkir baja tipis bergigi luar) ikut melendut menjadi elips, sehingga giginya hanya bertaut dengan circular spline di dua titik.', 'Circular spline punya 2 gigi lebih banyak. Tiap satu putaran wave generator, flexspline tertinggal 2 gigi: rasio = gigi flexspline ÷ 2, misalnya 200 ÷ 2 = 100.', 'Hampir tanpa celah antar-gigi (backlash), ringkas, cocok untuk sendi yang butuh presisi. Kelemahannya: flexspline lelah logam dan peka benturan.'] },
  linear: { T: ['Torsi motor', .2, 3, .05, 1.5, v => `${fmt(v, 2)} Nm`], R: ['Lead ulir', 1, 6, .5, 2, v => `${fmt(v, 1)} mm/putaran`], eta: .85,
    steps: ['Stator membuat medan putar; rotor berlubang di dalamnya adalah mur roller screw.', 'Di dalam mur ada 7–10 rol berulir yang menggelinding di antara mur dan batang ulir, seperti planet di gigi planetary.', 'Kontak garis antar-ulir yang banyak membuat roller screw menahan gaya jauh lebih besar dari ball screw berukuran sama.', 'Satu putaran mur menggeser batang sejauh lead. Lead kecil = gaya besar tapi lambat; lead besar = cepat dan lebih mudah diputar balik.'] },
  finger: { T: ['Torsi motor', 5, 40, 1, 20, v => `${fmt(v)} mNm`], R: ['Rasio worm', 15, 80, 5, 40, v => `${v} : 1`], eta: .4,
    steps: ['Motor kecil (coreless atau brushless mini) memutar ulir cacing (worm).', 'Worm memutar roda gigi; rasio = jumlah gigi roda ÷ jumlah ulir worm, biasanya 20–80 dalam satu tahap.', 'Karena sudut ulir kecil, gesekan lebih besar dari gaya balik: jari tidak bisa memutar motor (self-locking). Genggaman tertahan tanpa arus listrik.', 'Harga yang dibayar: efisiensi hanya ± 40 %, dan jari tidak bisa “mengalah” saat terbentur, jadi sensor taktil dan kontrol gaya wajib.'] },
};
let labFam = 'rotary';
function setLab(f) {
  labFam = f; const L = LAB[f];
  $$('#labFam .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.fam === f));
  const t = $('#lT'), r = $('#lR');
  [t.min, t.max, t.step, t.value] = [L.T[1], L.T[2], L.T[3], L.T[4]]; $('#lTl').textContent = L.T[0];
  [r.min, r.max, r.step, r.value] = [L.R[1], L.R[2], L.R[3], L.R[4]]; $('#lRl').textContent = L.R[0];
  $('#labSteps').innerHTML = L.steps.map(s => `<li><span>${s}</span></li>`).join('');
  syncLabView();
  if (S.tab === 'aktuator') initLab3D();
  updLab();
}
function labVals() { return { T: +$('#lT').value, rpm: +$('#lS').value, R: +$('#lR').value }; }
function updLab() {
  const L = LAB[labFam], v = labVals();
  $('#lTo').textContent = L.T[5](v.T); $('#lRo').textContent = L.R[5](v.R); $('#lSo').textContent = `${fmt(v.rpm)} rpm`;
  let A, B, Pw, F;
  if (labFam === 'rotary') { A = v.T * v.R * L.eta; B = v.rpm / v.R; Pw = A * B * TAU / 60; $('#oAl').textContent = 'Torsi output'; $('#oA').innerHTML = `${fmt(A)}<small>Nm</small>`; $('#oBl').textContent = 'Kecepatan output'; $('#oB').innerHTML = `${fmt(B, 1)}<small>rpm</small>`; F = `τ_out = τ_motor × N × η = ${fmt(v.T, 2)} × ${v.R} × ${fmt(L.eta, 2)} = ${fmt(A)} Nm`; }
  else if (labFam === 'linear') { A = TAU * L.eta * v.T / (v.R / 1000); B = v.rpm / 60 * v.R; Pw = A * B / 1000; $('#oAl').textContent = 'Gaya output'; $('#oA').innerHTML = `${fmt(A)}<small>N</small>`; $('#oBl').textContent = 'Kecepatan batang'; $('#oB').innerHTML = `${fmt(B)}<small>mm/s</small>`; F = `F = 2π × η × τ ÷ lead = 2π × ${fmt(L.eta, 2)} × ${fmt(v.T, 2)} ÷ ${fmt(v.R / 1000, 4)} m = ${fmt(A)} N`; }
  else { const T = v.T / 1000; A = T * v.R * L.eta / .005; B = v.rpm / v.R; Pw = T * v.R * L.eta * B * TAU / 60; $('#oAl').textContent = 'Tarikan tendon'; $('#oA').innerHTML = `${fmt(A)}<small>N</small>`; $('#oBl').textContent = 'Putaran roda'; $('#oB').innerHTML = `${fmt(B, 1)}<small>rpm</small>`; F = `F_tendon = τ × N × η ÷ r_puli = ${fmt(T, 3)} × ${v.R} × ${fmt(L.eta, 2)} ÷ 0,005 m = ${fmt(A)} N`; }
  $('#oC').innerHTML = `${fmt(Pw)}<small>W</small>`; $('#oD').innerHTML = `${fmt(L.eta * 100)}<small>%</small>`;
  $('#lF').textContent = F;
}
let labDt = 0;
function drawLab(t) {
  const v = labVals();
  if (L3.M[labFam]?.st === 'ready' && L3.st === 'ready') return drawLab3D(labDt, v);
  const [c, w, h] = fitCv($('#labCv'));
  if (labFam === 'rotary') drawRotary(c, w, h, t, { T: v.T, rpm: v.rpm, N: v.R, eta: .75, big: true, spd: v.rpm / 1800 });
  else if (labFam === 'linear') drawLinear(c, w, h, t, { T: v.T, lead: v.R, rpm: v.rpm, eta: .85, big: true, spd: .6 + v.rpm / 6000 });
  else drawHand(c, w, h, t, { T: v.T, N: v.R, big: true, spd: .5 + v.rpm / 4000 });
}

/* ================= static doc widgets ================= */
function buildDocs() {
  // power bars
  const maxP = 700;
  $('#pbars').innerHTML = PBARS.map(([nm, pw, k]) => `<div class="pbar"><span>${nm} ${cf(k)}</span><span class="bar"><i class="${k === 'R' ? '' : 'est'}" style="width:${pw / maxP * 100}%"></i></span><span class="v">${pw} W · ${fmt(2300 * .9 / pw, 1)} jam</span></div>`).join('');
  // loop rates (log 1 Hz .. 100 kHz)
  const lx = f => Math.log10(f) / 5 * 100;
  let rh = `<div class="rate axis"><span></span><span class="ticks"><span>1 Hz</span><span>10</span><span>100</span><span>1 k</span><span>10 k</span><span>100 k</span></span><span></span></div>`;
  for (const [nm, lo, hi, k, lab, col] of RATES) {
    const a = lx(lo), b = Math.max(lx(hi), a + 1.2);
    rh += `<div class="rate"><span>${nm} ${cf(k)}</span><span class="bar"><i style="left:${a}%;width:${b - a}%;--c:${col}"></i></span><span class="v">${lab}</span></div>`;
  }
  $('#rates').innerHTML = rh;
  // constraint cards
  $('#cards').innerHTML = CARDS.map(([t, k, key, prob, dev]) => `<article class="ccard"><header><h4>${t}</h4>${cf(k)}</header><div class="key">${key}</div><p><b>Masalah</b>${prob}</p><p class="dev"><b>Sedang dikembangkan</b>${dev}</p></article>`).join('');
  // TOPS calculator
  const upd = () => {
    const N = +$('#tN').value, f = +$('#tF').value, n = +$('#tC').value, per = N * N * 2 * f / 1000;
    $('#tNo').textContent = `${N} × ${N}`; $('#tFo').textContent = `${fmt(f, 1)} GHz`; $('#tCo').textContent = n;
    $('#tA').innerHTML = `${fmt(per, 1)}<small>TOPS</small>`; $('#tB').innerHTML = `${fmt(per * n, 1)}<small>TOPS</small>`;
    $('#tFm').textContent = `${N} × ${N} MAC × 2 op × ${fmt(f, 1)} × 10⁹ Hz = ${fmt(per, 1)} × 10¹² op/s per NPU`;
  };
  ['#tN', '#tF', '#tC'].forEach(s => $(s).addEventListener('input', upd)); upd();
}

/* ================= main loop ================= */
let lastT = performance.now(), vizT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  simStep(dt);
  if (!REDUCED) vizT += dt;
  if (S.tab === 'anatomi') {
    if (ready3D) {
      stepTween(now); controls.update(); anim3D(dt, now);
      renderer.render(scene, camera);
    }
    layoutTags();
    renderReadout(now);
    const cv = $('#chart'); if (cv.offsetParent) { const [c, w, h] = fitCv(cv); const p = P[S.sel]; VIZ[p.chart[0]](c, w, h, vizT, p); }
    // chain pulse
    const k = Math.floor(now / 380) % CHAIN.length;
    $$('#chain .node').forEach((b, i) => b.classList.toggle('pulse', !REDUCED && i === k));
  } else if (S.tab === 'aktuator') {
    labDt = dt; drawLab(vizT);
    const [c, w, h] = fitCv($('#focCv')); drawFOC(c, w, h, vizT);
  }
  requestAnimationFrame(frame);
}

/* ================= boot ================= */
function boot() {
  buildParts(); buildTags(); buildChain(); buildDocs();
  setAct(S.act); setShell(S.shell);
  $$('#ovl .chip').forEach(b => b.setAttribute('aria-pressed', !!S.ov[b.dataset.ov]));
  $$('#cams .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.cam === S.cam));
  $$('#acts .chip').forEach(b => b.addEventListener('click', () => setAct(b.dataset.act)));
  $$('#cams .chip').forEach(b => b.addEventListener('click', () => setView(b.dataset.cam)));
  $$('#shells .chip').forEach(b => b.addEventListener('click', () => setShell(b.dataset.shell)));
  $$('#ovl .chip').forEach(b => b.addEventListener('click', () => { const k = b.dataset.ov; S.ov[k] = !S.ov[k]; b.setAttribute('aria-pressed', S.ov[k]); }));
  $$('.tab').forEach(b => b.addEventListener('click', () => { showTab(b.dataset.tab); setHash(b.dataset.tab); }));
  $$('#labFam .chip').forEach(b => b.addEventListener('click', () => setLab(b.dataset.fam)));
  $$('#labMode .chip').forEach(b => b.addEventListener('click', () => setLabMode(b.dataset.m)));
  ['#lT', '#lS', '#lR'].forEach(s => $(s).addEventListener('input', updLab));
  setLab('rotary');
  select(S.sel, false);
  addEventListener('hashchange', route);
  addEventListener('resize', () => { resize3D(); });
  addEventListener('keydown', e => {
    if (e.target.closest('input,textarea') || S.tab !== 'anatomi') return;
    if (e.key === 'h' || e.key === 'H') { S.ui = !S.ui; $('#v-anatomi').classList.toggle('ui-off', !S.ui); }
  });
  const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener?.('change', applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  route();
  requestAnimationFrame(frame);
  init3D().then(() => { if (S.cam === 'fokus') setView('fokus', false); });
}
boot();
