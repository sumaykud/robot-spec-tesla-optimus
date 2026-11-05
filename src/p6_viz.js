
/* ================= 2D visualisations ================= */
function fitCv(cv) {
  const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
  const w = Math.max(1, r.width), h = Math.max(1, r.height);
  if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
  const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h); return [c, w, h];
}
function txt(c, s, x, y, o = {}) {
  c.font = `${o.w || 500} ${o.s || 10.5}px ${o.f || MONO}`; c.fillStyle = o.c || C['ink-2']; c.textAlign = o.a || 'left'; c.textBaseline = o.b || 'alphabetic'; c.fillText(s, x, y);
}
function arrow(c, x1, y1, x2, y2, col, lw = 1.5) {
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  const a = Math.atan2(y2 - y1, x2 - x1); c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - 7 * Math.cos(a - .4), y2 - 7 * Math.sin(a - .4)); c.lineTo(x2 - 7 * Math.cos(a + .4), y2 - 7 * Math.sin(a + .4)); c.closePath(); c.fill();
}
function rrect(c, x, y, w, h, r = 3) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }

// strain wave gear. o: {T (Nm), rpm, N, eta, hold, big}
function drawRotary(c, w, h, t, o) {
  const Nf = 30, Nc = 32, rv = Nf / (Nc - Nf);
  const R = Math.min(h * .44, w * (o.big ? .3 : .27)), cx = R + (o.big ? 24 : 10), cy = h / 2;
  const phi = t * (o.spd ?? 1.6), out = -phi / rv;
  // circular spline (fixed)
  c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fillStyle = rgba(C.ink, .09); c.fill(); c.strokeStyle = C['ink-3']; c.lineWidth = 1; c.stroke();
  c.beginPath();
  for (let i = 0; i <= Nc * 2; i++) { const a = i / (Nc * 2) * TAU, rr = R * (i % 2 ? .8 : .865); i ? c.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : c.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
  c.closePath(); c.fillStyle = C['panel-solid']; c.fill(); c.strokeStyle = C['ink-3']; c.stroke();
  // flexspline
  const rb = a => R * (.7 + .05 * Math.cos(2 * (a - phi)));
  c.beginPath();
  for (let i = 0; i <= Nf * 2; i++) { const a = out + i / (Nf * 2) * TAU, rr = rb(a) + (i % 2 ? R * .085 : 0); i ? c.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : c.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
  c.closePath(); c.fillStyle = rgba(C.rot, .28); c.fill(); c.strokeStyle = C.rot; c.lineWidth = 1.2; c.stroke();
  // wave generator ellipse + balls
  c.save(); c.translate(cx, cy); c.rotate(phi);
  c.beginPath(); c.ellipse(0, 0, R * .69, R * .59, 0, 0, TAU); c.fillStyle = C['panel-solid']; c.fill(); c.strokeStyle = C['ink-2']; c.lineWidth = 1; c.stroke();
  c.beginPath(); c.ellipse(0, 0, R * .61, R * .51, 0, 0, TAU); c.stroke();
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + t * .4; c.beginPath(); c.arc(R * .65 * Math.cos(a), R * .55 * Math.sin(a), R * .03, 0, TAU); c.fillStyle = C['ink-3']; c.fill(); }
  c.beginPath(); c.arc(0, 0, R * .12, 0, TAU); c.fillStyle = C.ink; c.fill();
  c.strokeStyle = C['panel-solid']; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(R * .11, 0); c.stroke();
  c.restore();
  // output marker
  const mx = cx + rb(out) * .93 * Math.cos(out), my = cy + rb(out) * .93 * Math.sin(out);
  c.beginPath(); c.arc(mx, my, 4.5, 0, TAU); c.fillStyle = C.accent; c.fill();
  // contact zones
  for (const k of [0, Math.PI]) { const a = phi + k; c.beginPath(); c.arc(cx, cy, R * .835, a - .22, a + .22); c.strokeStyle = C.accent; c.lineWidth = 2.5; c.stroke(); }
  // readouts
  const x0 = cx + R + (o.big ? 34 : 18), compact = w - x0 < 230; let y = o.big ? 46 : 24;
  const T = o.T ?? 1.2, rpm = o.rpm ?? 3000, N = o.N ?? 100, eta = o.eta ?? .75;
  const lines = compact
    ? [['Motor', [`${fmt(rpm)} rpm`, `${fmt(T, 2)} Nm`], C.ink], ['Rasio', [`${N} : 1`], C.rot], ['Output', [`${fmt(rpm / N, 1)} rpm`, `${fmt(T * N * eta)} Nm`], C.accent]]
    : [['Motor', [`${fmt(rpm)} rpm · ${fmt(T, 2)} Nm`], C.ink], ['Rasio', [`${N} : 1  (Nf ÷ (Nc − Nf))`], C.rot], ['Output', [`${fmt(rpm / N, 1)} rpm · ${fmt(T * N * eta)} Nm`], C.accent]];
  const vs = o.big && !compact ? 13 : 11, vl = vs + 3;
  for (const [k, vals, col] of lines) {
    txt(c, k.toUpperCase(), x0, y, { s: 9, f: BODY, w: 600, c: C['ink-3'] });
    vals.forEach((v, i) => txt(c, v, x0, y + 13 + i * vl, { s: vs, c: col }));
    y += 13 + vals.length * vl + (compact ? 6 : 12);
  }
  if (o.hold) { const heat = (T * N * eta / 180) ** 2; txt(c, compact ? `panas ∝ I²: ${fmt(heat * 100)} %` : `rugi panas ∝ I² · ${fmt(heat * 100)} % dari maks.`, x0, y + 2, { s: 10, c: C.hot }); }
  else if (o.big && !compact) txt(c, 'Merah: dua zona gigi yang sedang bertaut', x0, y + 2, { s: 10, f: BODY, c: C['ink-3'] });
}

// planetary roller screw. o: {T, lead(mm), eta, rpm, big, dual}
function drawLinear(c, w, h, t, o) {
  if (o.dual) return drawLinear2(c, w, h, t);
  const big = o.big, H = Math.min(h * (big ? .34 : .4), big ? 84 : 58), y = big ? h * .42 : h * .44;
  const x0 = 12, mW = w * (big ? .38 : .42), travel = w * (big ? .28 : .3);
  const ext = 0.5 + 0.45 * Math.sin(t * (o.spd ?? 1.1));
  const rot = t * 9 * (o.rpm ?? 3000) / 3000;
  // screw (behind)
  const sx = x0 + mW * .12, sEnd = x0 + mW + travel * ext, sh = H * .24;
  c.fillStyle = rgba(C.ink, .12); c.fillRect(sx, y - sh / 2, sEnd - sx, sh);
  c.save(); c.beginPath(); c.rect(sx, y - sh / 2, sEnd - sx, sh); c.clip(); c.strokeStyle = C['ink-3']; c.lineWidth = 1;
  for (let x = sx - 20 + ((ext * travel) % 6); x < sEnd + 10; x += 6) { c.beginPath(); c.moveTo(x, y + sh / 2); c.lineTo(x + 5, y - sh / 2); c.stroke(); }
  c.restore();
  // rod eye
  c.beginPath(); c.arc(sEnd + sh * .6, y, sh * .75, 0, TAU); c.fillStyle = C['panel-solid']; c.fill(); c.strokeStyle = C.ink; c.lineWidth = 1.5; c.stroke();
  // housing
  rrect(c, x0, y - H / 2, mW, H, 4); c.fillStyle = rgba(C.ink, .07); c.fill(); c.strokeStyle = C['ink-3']; c.lineWidth = 1; c.stroke();
  // stator coils
  for (let i = 0; i < 8; i++) { const cx = x0 + mW * .1 + i * mW * .1; c.fillStyle = rgba(C.lin, .55); c.fillRect(cx, y - H / 2 + 3, mW * .07, H * .16); c.fillRect(cx, y + H / 2 - 3 - H * .16, mW * .07, H * .16); }
  // rotating nut
  const nx = x0 + mW * .14, nW = mW * .72, nH = H * .52;
  rrect(c, nx, y - nH / 2, nW, nH, 2); c.fillStyle = rgba(C.lin, .18); c.fill(); c.strokeStyle = C.lin; c.stroke();
  c.save(); c.beginPath(); c.rect(nx, y - nH / 2, nW, nH); c.clip(); c.strokeStyle = rgba(C.lin, .7);
  for (let k = 0; k < 14; k++) { const yy = y - nH / 2 + ((k * nH / 7 + rot * 3) % (nH * 2)) - nH / 2; c.beginPath(); c.moveTo(nx, yy); c.lineTo(nx + nW, yy); c.stroke(); }
  c.restore();
  // rollers above/below screw
  for (const sgn of [-1, 1]) for (let i = 0; i < 4; i++) {
    const rx = nx + nW * (.15 + i * .23), ry = y + sgn * (sh / 2 + nH * .13);
    c.beginPath(); c.arc(rx, ry, nH * .11, 0, TAU); c.fillStyle = C['panel-solid']; c.fill(); c.strokeStyle = C.ink; c.lineWidth = 1; c.stroke();
    const a = rot * 2.2; c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx + nH * .1 * Math.cos(a), ry + nH * .1 * Math.sin(a)); c.stroke();
  }
  // force arrow
  const T = o.T ?? 1.5, L = o.lead ?? 2, eta = o.eta ?? .85, F = TAU * eta * T / (L / 1000);
  const ax = sEnd + sh * 1.6; arrow(c, ax, y, ax + 18 + Math.min(40, F / 250), y, C.accent, 2);
  // labels
  txt(c, 'STATOR + MUR BERPUTAR', x0, y - H / 2 - 7, { s: 9, f: BODY, w: 600, c: C['ink-3'] });
  txt(c, 'BATANG ULIR (TIDAK BERPUTAR, BERGESER)', x0 + mW * .1, y + H / 2 + 16, { s: 9, f: BODY, w: 600, c: C['ink-3'] });
  const ty = big ? h - 46 : h - 24;
  txt(c, `F = 2π · ${fmt(eta, 2)} · ${fmt(T, 2)} Nm ÷ ${fmt(L, 1)} mm = ${fmt(F)} N`, x0, ty, { s: big ? 12.5 : 11, c: C.ink });
  txt(c, `≈ ${fmt(F / 9.81)} kgf · kecepatan ${fmt((o.rpm ?? 3000) / 60 * L)} mm/s`, x0, ty + (big ? 18 : 14), { s: big ? 11.5 : 10, c: C['ink-2'] });
}
function drawLinear2(c, w, h, t) {
  const pd = Math.PI * (0.5 - 0.5 * Math.cos(t * .35));
  const e1 = .5 + .38 * Math.sin(t * 1.4), e2 = .5 + .38 * Math.sin(t * 1.4 + pd);
  const x0 = 12, mW = w * .34, trav = w * .2, ys = [h * .3, h * .62], H = Math.min(26, h * .16);
  const ends = [];
  [e1, e2].forEach((e, i) => {
    const y = ys[i], sx = x0 + mW, ex = sx + trav * e;
    c.fillStyle = rgba(C.ink, .14); c.fillRect(x0 + mW * .5, y - H * .16, ex - x0 - mW * .5, H * .32);
    rrect(c, x0, y - H / 2, mW, H, 3); c.fillStyle = rgba(C.lin, .2); c.fill(); c.strokeStyle = C.lin; c.lineWidth = 1; c.stroke();
    c.beginPath(); c.arc(ex, y, 4, 0, TAU); c.fillStyle = C.ink; c.fill(); ends.push([ex, y]);
  });
  // plate hinged at a pivot driven by both rods
  const px = x0 + mW + trav * .5 + 34, py = (ys[0] + ys[1]) / 2;
  const mean = (e1 + e2) / 2 - .5, diff = e1 - e2;
  c.strokeStyle = C['ink-3']; c.setLineDash([3, 3]); c.lineWidth = 1;
  for (const [ex, ey] of ends) { c.beginPath(); c.moveTo(ex, ey); c.lineTo(px - 8, py + (ey - py) * .5); c.stroke(); }
  c.setLineDash([]);
  c.save(); c.translate(px, py); c.rotate(diff * .9);
  c.fillStyle = rgba(C.accent, .18); c.strokeStyle = C.accent; c.lineWidth = 1.5; rrect(c, -6, -(ys[1] - ys[0]) * .45, 12 + mean * 40, (ys[1] - ys[0]) * .9, 2); c.fill(); c.stroke();
  c.restore();
  c.beginPath(); c.arc(px, py, 3, 0, TAU); c.fillStyle = C.ink; c.fill();
  const mode = pd < .6 ? 'Searah → menekuk (pitch)' : pd > 2.5 ? 'Berlawanan → miring (roll / yaw)' : 'Campuran pitch + roll';
  txt(c, mode, x0, h - 12, { s: 11, c: C.ink });
  txt(c, `Δ panjang ${fmt(diff * 100)} %`, w - 10, h - 12, { s: 10, a: 'right' });
}

// finger: worm gear + tendon + tactile stop. o: {T (mNm), N, big}
function drawHand(c, w, h, t, o) {
  const big = o.big, s = Math.min(1.3, h / (big ? 240 : 170));
  const flexRaw = 0.5 - 0.5 * Math.cos(t * (o.spd ?? 1)), flex = Math.min(flexRaw, .82), touch = flexRaw > .8;
  // worm + wheel
  const wx = 16 * s + 6, wy = h * .74, wl = 70 * s, wr = 9 * s;
  rrect(c, wx, wy - wr, wl, wr * 2, 4); c.fillStyle = rgba(C.fin, .2); c.fill(); c.strokeStyle = C.fin; c.lineWidth = 1; c.stroke();
  c.save(); c.beginPath(); c.rect(wx, wy - wr, wl, wr * 2); c.clip(); c.strokeStyle = C.fin;
  const wph = (touch ? .82 : flexRaw) * 60;
  for (let x = wx - 10 + (wph % 7); x < wx + wl + 8; x += 7) { c.beginPath(); c.moveTo(x, wy + wr); c.lineTo(x + 6, wy - wr); c.stroke(); }
  c.restore();
  const gx = wx + wl * .5, gR = 26 * s, gy = wy - wr - gR + 3 * s;
  c.beginPath();
  for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU + flex * 2.2, rr = gR * (i % 2 ? .9 : 1); i ? c.lineTo(gx + rr * Math.cos(a), gy + rr * Math.sin(a)) : c.moveTo(gx + rr * Math.cos(a), gy + rr * Math.sin(a)); }
  c.closePath(); c.fillStyle = C['panel-solid']; c.fill(); c.strokeStyle = C['ink-2']; c.stroke();
  c.beginPath(); c.arc(gx, gy, gR * .45, 0, TAU); c.strokeStyle = C.ink; c.stroke();
  // finger chain
  const bx = gx + gR + 40 * s, by = gy - 6 * s, segs = [46 * s, 34 * s, 24 * s], ks = [.9, 1.1, .8];
  const pts = [[bx, by]]; let a = 0;
  for (let i = 0; i < 3; i++) { a += flex * ks[i]; const [px, py] = pts[i]; pts.push([px + segs[i] * Math.cos(a), py + segs[i] * Math.sin(a)]); }
  // palm
  c.strokeStyle = rgba(C.ink, .25); c.lineWidth = 16 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(gx + gR * .3, by); c.lineTo(bx, by); c.stroke();
  // egg target at full flex
  const eggPos = (() => { let aa = 0, p = [bx, by]; for (let i = 0; i < 3; i++) { aa += .82 * ks[i]; p = [p[0] + segs[i] * Math.cos(aa), p[1] + segs[i] * Math.sin(aa)]; } return p; })();
  c.beginPath(); c.ellipse(eggPos[0] + 4 * s, eggPos[1] + 22 * s, 15 * s, 20 * s, .3, 0, TAU); c.fillStyle = rgba(C.sen, .14); c.fill(); c.strokeStyle = rgba(C.sen, .7); c.lineWidth = 1; c.stroke();
  // tendon
  c.strokeStyle = C.fin; c.lineWidth = 1.4; c.lineCap = 'butt'; c.beginPath(); c.moveTo(gx + gR * .45, gy + gR * .1);
  for (let i = 0; i < pts.length; i++) { const [px, py] = pts[i], aa = i ? Math.atan2(py - pts[i - 1][1], px - pts[i - 1][0]) : 0; c.lineTo(px - 6 * s * Math.sin(-aa), py + 6 * s * Math.cos(aa)); }
  c.stroke();
  // segments + joints
  c.lineCap = 'round';
  for (let i = 0; i < 3; i++) { c.strokeStyle = C.ink; c.lineWidth = 11 * s; c.beginPath(); c.moveTo(...pts[i]); c.lineTo(...pts[i + 1]); c.stroke(); }
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(pts[i][0], pts[i][1], 4 * s, 0, TAU); c.fillStyle = C['panel-solid']; c.fill(); }
  const tip = pts[3]; c.beginPath(); c.arc(tip[0], tip[1], 6 * s, 0, TAU); c.fillStyle = touch ? C.sen : rgba(C.sen, .5); c.fill();
  c.lineCap = 'butt';
  const T = (o.T ?? 20) / 1000, N = o.N ?? 40, eta = .4, rp = .005, Ft = T * N * eta / rp;
  const x0 = Math.min(w - 10, Math.max(bx + 90 * s, w * .62)), al = 'right';
  txt(c, touch ? 'TAKTIL: TEKANAN TERDETEKSI · BERHENTI' : 'JARI MENEKUK', x0, 18, { s: 9, f: BODY, w: 600, c: touch ? C.accent : C['ink-3'], a: al });
  txt(c, `tendon ≈ ${fmt(Ft)} N`, x0, 34, { s: big ? 12.5 : 11, c: C.ink, a: al });
  txt(c, `ujung jari ≈ ${fmt(Ft * .16, 1)} N`, x0, 49, { s: big ? 12.5 : 11, c: C.ink, a: al });
  txt(c, 'worm η ≈ 40 % → terkunci', x0, 64, { s: 10, c: C.fin, a: al });
}

// battery: 14 cells + runtime bars
function drawBattery(c, w, h, t) {
  const n = 14, x0 = 8, cw = (w - 16) / n, y0 = 18, ch = 30;
  txt(c, `14 sel seri × ${fmt(S.V / 14, 2)} V = ${fmt(S.V, 1)} V`, x0, 11, { s: 10, c: C.ink });
  for (let i = 0; i < n; i++) {
    const x = x0 + i * cw + 1.5, ww = cw - 3;
    rrect(c, x, y0, ww, ch, 2); c.strokeStyle = C['ink-3']; c.lineWidth = 1; c.stroke();
    const f = clamp(S.soc + Math.sin(i * 7.1) * .012, 0, 1);
    c.fillStyle = rgba(C.pwr, .75); c.fillRect(x + 1.5, y0 + 1.5 + (ch - 3) * (1 - f), ww - 3, (ch - 3) * f);
  }
  const rows = PBARS, by = y0 + ch + 18, rh = Math.min(20, (h - by - 4) / rows.length), maxH = 2300 * .9 / 100;
  const actName = ACT[S.act].name;
  rows.forEach(([nm, pw, cfk], i) => {
    const y = by + i * rh, hrs = 2300 * .9 / pw, bw = (w - 150) * hrs / maxH, on = nm.toLowerCase().startsWith(actName.toLowerCase().slice(0, 5));
    txt(c, `${nm} · ${pw} W`, x0, y + rh * .62, { s: 10, f: BODY, w: on ? 600 : 500, c: on ? C.accent : C['ink-2'] });
    const bx = 108;
    if (cfk === 'R') { c.fillStyle = on ? C.accent : C.pwr; c.fillRect(bx, y + 3, bw, rh - 7); }
    else { c.save(); c.beginPath(); c.rect(bx, y + 3, bw, rh - 7); c.clip(); c.fillStyle = rgba(on ? C.accent : C.pwr, .35); c.fillRect(bx, y + 3, bw, rh - 7); c.strokeStyle = on ? C.accent : C.pwr; for (let k = -20; k < bw + 20; k += 6) { c.beginPath(); c.moveTo(bx + k, y + rh); c.lineTo(bx + k + 12, y); c.stroke(); } c.restore(); }
    txt(c, `${fmt(hrs, 1)} j`, bx + bw + 5, y + rh * .62, { s: 10, c: C.ink });
  });
}

// compute pipeline
function drawCompute(c, w, h, t) {
  const blocks = [['Kamera', C.sen], ['ISP', C['ink-3']], ['NPU ×2', C.accent], ['CPU', C.lin], ['Bus', C.sig]];
  const n = blocks.length, gap = 10, bw = (w - 16 - gap * (n - 1)) / n, bh = 40, y = 26;
  blocks.forEach(([nm, col], i) => {
    const x = 8 + i * (bw + gap); rrect(c, x, y, bw, bh, 3); c.fillStyle = rgba(col, .14); c.fill(); c.strokeStyle = col; c.lineWidth = 1.2; c.stroke();
    txt(c, nm, x + bw / 2, y + bh / 2 + 4, { s: 11, f: BODY, w: 600, c: C.ink, a: 'center' });
    if (i < n - 1) { c.strokeStyle = C['ink-3']; c.lineWidth = 1; c.beginPath(); c.moveTo(x + bw, y + bh / 2); c.lineTo(x + bw + gap, y + bh / 2); c.stroke(); }
  });
  for (let k = 0; k < 6; k++) {
    const u = ((t * .35 + k / 6) % 1), X = 8 + u * (w - 16), yy = y + bh / 2;
    c.beginPath(); c.arc(X, yy + 26, 3, 0, TAU); c.fillStyle = C.accent; c.fill();
  }
  c.strokeStyle = rgba(C.accent, .3); c.beginPath(); c.moveTo(8, y + bh / 2 + 26); c.lineTo(w - 8, y + bh / 2 + 26); c.stroke();
  txt(c, '1 NPU: 96 × 96 MAC × 2 operasi × 2 GHz', 8, y + bh + 54, { s: 10.5, c: C.ink });
  txt(c, '= 36,9 TOPS · 2 NPU per chip = 73,7 TOPS', 8, y + bh + 70, { s: 10.5, c: C.accent });
  txt(c, 'CPU 12 × Cortex-A72 · LPDDR4 68 GB/s · 14 nm', 8, y + bh + 86, { s: 10, c: C['ink-2'] });
}

// gait curves
const gHip = p => 10 + 20 * Math.cos(TAU * p);
const gKnee = p => 5 + 15 * Math.exp(-(((p - .15) / .07) ** 2)) + 55 * Math.exp(-(((p - .72) / .11) ** 2));
const gAnk = p => -5 * Math.exp(-(((p - .07) / .04) ** 2)) + 10 * Math.exp(-(((p - .42) / .12) ** 2)) - 18 * Math.exp(-(((p - .62) / .06) ** 2));
function drawGait(c, w, h, t) {
  const L = 34, R = w - 8, T = 10, B = h - 22, y = v => B - (v + 20) / 85 * (B - T), x = p => L + p * (R - L);
  c.strokeStyle = C.line; c.lineWidth = 1;
  for (const v of [-20, 0, 20, 40, 60]) { c.beginPath(); c.moveTo(L, y(v)); c.lineTo(R, y(v)); c.stroke(); txt(c, `${v}°`, L - 5, y(v) + 3, { s: 9, a: 'right', c: C['ink-3'] }); }
  for (const p of [0, .25, .5, .75, 1]) txt(c, `${p * 100}%`, x(p), h - 8, { s: 9, a: 'center', c: C['ink-3'] });
  c.fillStyle = rgba(C.ink, .05); c.fillRect(x(0), T, x(.6) - x(0), B - T);
  txt(c, 'TUMPU', x(.3), T + 11, { s: 8.5, f: BODY, w: 600, a: 'center', c: C['ink-3'] }); txt(c, 'AYUN', x(.8), T + 11, { s: 8.5, f: BODY, w: 600, a: 'center', c: C['ink-3'] });
  const curves = [[gHip, C.rot, 'Pinggul'], [gKnee, C.lin, 'Lutut'], [gAnk, C.fin, 'Pergelangan kaki']];
  curves.forEach(([f, col, nm], i) => {
    c.strokeStyle = col; c.lineWidth = 2; c.beginPath();
    for (let k = 0; k <= 100; k++) { const p = k / 100; k ? c.lineTo(x(p), y(f(p))) : c.moveTo(x(p), y(f(p))); } c.stroke();
    txt(c, nm, R - 2, T + 24 + i * 12, { s: 9.5, f: BODY, w: 600, a: 'right', c: col });
  });
  const ph = S.act === 'jalan' ? S.phase % 1 : (t * .15) % 1;
  c.strokeStyle = C.accent; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x(ph), T); c.lineTo(x(ph), B); c.stroke();
  for (const [f] of curves) { c.beginPath(); c.arc(x(ph), y(f(ph)), 3.5, 0, TAU); c.fillStyle = C.accent; c.fill(); }
}

// knee torque vs flexion
function drawKnee(c, w, h, t) {
  const L = 38, R = w - 10, T = 12, B = h - 24, x = d => L + d / 120 * (R - L), y = v => B - v / 420 * (B - T);
  c.strokeStyle = C.line; c.lineWidth = 1;
  for (const v of [0, 100, 200, 300, 400]) { c.beginPath(); c.moveTo(L, y(v)); c.lineTo(R, y(v)); c.stroke(); txt(c, v, L - 5, y(v) + 3, { s: 9, a: 'right', c: C['ink-3'] }); }
  for (const d of [0, 30, 60, 90, 120]) txt(c, `${d}°`, x(d), h - 8, { s: 9, a: 'center', c: C['ink-3'] });
  txt(c, 'Nm', L - 5, T - 2, { s: 9, a: 'right', c: C['ink-3'] });
  const fix = d => 8000 * .035 * Math.cos(d * Math.PI / 180 * .7), link = d => 8000 * (.025 + .022 * Math.sin(d * Math.PI / 180 * .9));
  const need = d => (63 + 20) / 2 * 9.81 * .42 * Math.sin(d * Math.PI / 360) + 15;
  const plot = (f, col, lw, dash) => { c.strokeStyle = col; c.lineWidth = lw; c.setLineDash(dash || []); c.beginPath(); for (let d = 0; d <= 120; d += 2) d ? c.lineTo(x(d), y(f(d))) : c.moveTo(x(d), y(f(d))); c.stroke(); c.setLineDash([]); };
  plot(fix, C['ink-3'], 1.5); plot(need, C.ink, 1.2, [4, 3]); plot(link, C.accent, 2.2);
  const d = 60 + 50 * Math.sin(t * .6);
  c.beginPath(); c.arc(x(d), y(link(d)), 4, 0, TAU); c.fillStyle = C.accent; c.fill();
  txt(c, `${fmt(d)}° → ${fmt(link(d))} Nm`, Math.min(x(d) + 8, R - 90), y(link(d)) - 8, { s: 10, c: C.accent });
}

// foot CoP
function drawFoot(c, w, h, t) {
  const cx = w / 2, cy = h / 2 + 4, fl = Math.min(h * .78, 130), fw = fl * .38, sep = fw * 1.25;
  const walking = S.act === 'jalan', ph = walking ? S.phase % 1 : 0;
  const feet = [{ x: cx - sep, dy: walking ? Math.sin(TAU * ph) * fl * .28 : 0, on: !walking || ph < .6 }, { x: cx + sep, dy: walking ? -Math.sin(TAU * ph) * fl * .28 : 0, on: !walking || ((ph + .5) % 1) < .6 }];
  const hull = [];
  feet.forEach((f, i) => {
    const top = cy - fl / 2 + f.dy;
    rrect(c, f.x - fw / 2, top, fw, fl, fw / 2); c.fillStyle = f.on ? rgba(C.ink, .1) : 'transparent'; c.fill(); c.strokeStyle = f.on ? C['ink-2'] : C['ink-3']; c.lineWidth = 1.2; c.setLineDash(f.on ? [] : [3, 3]); c.stroke(); c.setLineDash([]);
    c.strokeStyle = C['ink-3']; c.beginPath(); c.moveTo(f.x - fw / 2 + 2, top + fl * .22); c.lineTo(f.x + fw / 2 - 2, top + fl * .22); c.stroke();
    txt(c, i ? 'KANAN' : 'KIRI', f.x, top + fl + 13, { s: 8.5, f: BODY, w: 600, a: 'center', c: C['ink-3'] });
    if (f.on) hull.push([f.x - fw / 2, top + 4], [f.x + fw / 2, top + 4], [f.x + fw / 2, top + fl - 4], [f.x - fw / 2, top + fl - 4]);
  });
  if (hull.length) {
    const xs = hull.map(p => p[0]), ys = hull.map(p => p[1]);
    c.strokeStyle = C.accent; c.setLineDash([4, 3]); c.lineWidth = 1; c.strokeRect(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)); c.setLineDash([]);
  }
  let cop, com;
  if (walking) {
    const st = ph < .5 ? feet[0] : feet[1], q = (ph % .5) / .5, top = cy - fl / 2 + st.dy;
    cop = [st.x + (ph < .5 ? 3 : -3), top + fl * (.88 - .72 * q)];
    com = [cx + (ph < .5 ? -1 : 1) * sep * .45 * Math.sin(Math.PI * q), cy];
  } else { cop = [cx + Math.sin(t * .9) * sep * .35, cy + Math.sin(t * .6) * fl * .12]; com = [cx + Math.sin(t * .9 - .5) * sep * .3, cy + Math.sin(t * .6 - .4) * fl * .1]; }
  c.beginPath(); c.arc(com[0], com[1], 5, 0, TAU); c.fillStyle = C.ink; c.fill();
  c.beginPath(); c.arc(cop[0], cop[1], 5, 0, TAU); c.fillStyle = C.accent; c.fill();
  txt(c, 'CoP', cop[0] + 8, cop[1] + 3, { s: 10, c: C.accent });
  txt(c, 'CoM', com[0] + 8, com[1] - 6, { s: 10, c: C.ink });
}

// camera parallax
function drawCamera(c, w, h, t) {
  const hx = w * .16, hy = h * .5, B = Math.min(h * .32, 46);
  const cams = [[hx + 18, hy - B / 2], [hx + 18, hy + B / 2]];
  c.beginPath(); c.ellipse(hx, hy, 22, B * .9, 0, 0, TAU); c.fillStyle = rgba(C.ink, .85); c.fill();
  const ox = w * (.55 + .3 * (0.5 + 0.5 * Math.sin(t * .5))), oy = hy + Math.sin(t * .8) * h * .18;
  for (const [x, y] of cams) {
    c.fillStyle = rgba(C.sen, .1); c.beginPath(); c.moveTo(x, y); c.lineTo(w, y - (w - x) * .45); c.lineTo(w, y + (w - x) * .45); c.closePath(); c.fill();
    c.strokeStyle = C.sen; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(ox, oy); c.stroke();
    c.beginPath(); c.arc(x, y, 4, 0, TAU); c.fillStyle = C.sen; c.fill();
  }
  c.beginPath(); c.arc(ox, oy, 7, 0, TAU); c.fillStyle = C.accent; c.fill();
  const Z = ((ox - hx) / (w * .85)) * 3 + .3, d = 1000 * .08 / Z;
  txt(c, `jarak ${fmt(Z, 2)} m → disparitas ${fmt(d)} px`, 8, h - 22, { s: 10.5, c: C.ink });
  txt(c, 'Z = f · B ÷ d   (f = 1.000 px, B = 8 cm, ilustratif)', 8, h - 8, { s: 9.5, c: C['ink-2'] });
}

const VIZ = {
  rotary: (c, w, h, t, p) => drawRotary(c, w, h, t, p.id === 'leher' ? { T: .3, N: 50, rpm: 2000 } : p.id === 'pinggang' ? { T: 1.8, N: 100, rpm: 1500, hold: true, spd: .7 } : { T: 1.2, N: 100, rpm: 3000 }),
  linear: (c, w, h, t, p) => drawLinear(c, w, h, t, p.id === 'lutut' ? { T: 2.6, lead: 2 } : { T: 1.5, lead: 2 }),
  linear2: (c, w, h, t) => drawLinear2(c, w, h, t),
  hand: (c, w, h, t) => drawHand(c, w, h, t, {}),
  battery: drawBattery, compute: drawCompute, gait: drawGait, knee: drawKnee, foot: drawFoot, camera: drawCamera,
};

// FOC canvas: rotating field + 3-phase currents
function drawFOC(c, w, h, t) {
  const R = Math.min(h * .36, w * .17), cx = R + 24, cy = h / 2, th = t * 1.4;
  c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.strokeStyle = C['ink-3']; c.lineWidth = 1; c.stroke();
  const ph = [0, TAU / 3, 2 * TAU / 3], cols = [C.pwr, C.lin, C.fin];
  ph.forEach((p, i) => {
    const a = p - Math.PI / 2, I = Math.cos(th + Math.PI / 2 - p);
    const x = cx + R * 1.12 * Math.cos(a), y = cy + R * 1.12 * Math.sin(a);
    c.beginPath(); c.arc(x, y, 8, 0, TAU); c.fillStyle = rgba(cols[i], .2 + .6 * Math.abs(I)); c.fill(); c.strokeStyle = cols[i]; c.stroke();
    txt(c, 'UVW'[i], x, y + 3.5, { s: 10, a: 'center', c: C.ink, w: 600 });
  });
  // rotor magnet
  c.save(); c.translate(cx, cy); c.rotate(th);
  c.fillStyle = rgba(C.hot, .8); c.fillRect(0, -R * .22, R * .7, R * .44); c.fillStyle = rgba(C.lin, .8); c.fillRect(-R * .7, -R * .22, R * .7, R * .44);
  txt(c, 'N', R * .45, 4, { s: 11, a: 'center', c: '#fff', w: 600 }); txt(c, 'S', -R * .45, 4, { s: 11, a: 'center', c: '#fff', w: 600 });
  c.restore();
  // stator field vector, 90° ahead (pure Iq)
  arrow(c, cx, cy, cx + R * .85 * Math.cos(th + Math.PI / 2), cy + R * .85 * Math.sin(th + Math.PI / 2), C.accent, 2.5);
  txt(c, 'medan stator 90° di depan magnet = torsi maksimum', 8, h - 8, { s: 9.5, c: C['ink-2'] });
  // waves
  const L = cx + R + 40, Rr = w - 10, T = 20, B = h - 30, mid = (T + B) / 2, amp = (B - T) / 2 * .85;
  c.strokeStyle = C.line; c.beginPath(); c.moveTo(L, mid); c.lineTo(Rr, mid); c.stroke();
  ph.forEach((p, i) => {
    c.strokeStyle = cols[i]; c.lineWidth = 1.8; c.beginPath();
    for (let k = 0; k <= 120; k++) { const u = k / 120, a = th - (1 - u) * TAU * 1.5; const v = Math.cos(a + Math.PI / 2 - p); const X = L + u * (Rr - L), Y = mid - v * amp; k ? c.lineTo(X, Y) : c.moveTo(X, Y); }
    c.stroke();
  });
  c.strokeStyle = C.accent; c.lineWidth = 1; c.beginPath(); c.moveTo(Rr, T); c.lineTo(Rr, B); c.stroke();
  txt(c, 'arus fasa U · V · W', L, 12, { s: 9.5, c: C['ink-2'] });
  txt(c, 'sekarang', Rr, B + 14, { s: 9, a: 'right', c: C.accent });
}
