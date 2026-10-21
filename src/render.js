// Drawing: fighters, effects, projectiles and the game frame.
'use strict';
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
// game coords are always 960x540; RES scales them to the canvas
let RES = 1;
function baseT(dx = 0, dy = 0) { ctx.setTransform(RES, 0, 0, RES, dx * RES, dy * RES); }
const SPR = {};

function loadImg(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; }); }
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function hueRotate(img, deg) {
  const c = canvasOf(img.width, img.height), x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
  const r = deg * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
  const m = [.213 + cs * .787 - sn * .213, .715 - cs * .715 - sn * .715, .072 - cs * .072 + sn * .928,
    .213 - cs * .213 + sn * .143, .715 + cs * .285 + sn * .140, .072 - cs * .072 - sn * .283,
    .213 - cs * .213 - sn * .787, .715 - cs * .715 + sn * .715, .072 + cs * .928 + sn * .072];
  for (let i = 0; i < a.length; i += 4) {
    if (!a[i + 3]) continue;
    const R = a[i], Gc = a[i + 1], B = a[i + 2];
    a[i] = R * m[0] + Gc * m[1] + B * m[2]; a[i + 1] = R * m[3] + Gc * m[4] + B * m[5]; a[i + 2] = R * m[6] + Gc * m[7] + B * m[8];
  }
  x.putImageData(d, 0, 0); return c;
}
function whiteOf(img) {
  const c = canvasOf(img.width, img.height), x = c.getContext('2d');
  x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  return c;
}
async function loadAssets() {
  for (const [k, a] of Object.entries(ASSETS)) {
    const img = await loadImg(a.img), imgR = await loadImg(a.imgR);
    SPR[k] = { img, alt: hueRotate(img, 160), white: whiteOf(img),
               imgR, altR: hueRotate(imgR, 160), whiteR: whiteOf(imgR), anims: a.anims, cols: a.cols };
  }
  buildStages();
}

// ------------------------------------------------------------------ sprites
function seqFrame(m, t) {
  let acc = 0;
  for (const s of m.seq) { acc += s[1]; if (t <= acc) return [s[2] || m.anim, s[0]]; }
  const l = m.seq[m.seq.length - 1]; return [l[2] || m.anim, l[0]];
}
function winAnim(p) { const L = p.c.look, a = L.wins[(G.round + p.side) % L.wins.length]; return SPR[p.cid].anims[a] ? a : p.c.win; }
function frameOf(p) {
  const A = SPR[p.cid].anims, n = a => (A[a] ? A[a][1] : 1), c = p.c, L = c.look;
  const cyc = (a, spd, t) => [a, Math.floor(t / spd) % n(a)];
  switch (p.state) {
    case 'idle':
      if (p.guarding) return ['800', 0];
      if (L.idle2 && A[L.idle2] && p.t > 420 && G.phase === 'fight') return cyc(L.idle2, 7, p.t - 420);   // long-idle fidget
      return cyc('800', L.idleSpeed, p.frame);
    case 'walk': return p.walkDir > 0 ? cyc('101', L.walkSpeed, p.t) : ['101', 5 - Math.floor(p.t / L.walkSpeed) % 6];
    case 'dash': return cyc('102', L.runSpeed, p.t);
    case 'crouch': return ['821', 0];
    case 'jsquat': case 'land': return ['162', 3];
    case 'air':
      if (p.jx === 0) return p.vy < -2 ? ['161', Math.min(3, Math.floor(p.t / 4))] : ['162', Math.min(2, Math.floor((p.vy + 2) / 4))];
      return p.vy < -1 ? ['160', Math.min(3, Math.floor(p.t / 4))] : ['163', p.vy < 6 ? 1 : 2];
    case 'backdash': return ['163', p.t < 8 ? 0 : 1];
    case 'airdash': return p.adDir > 0 ? cyc('701', 3, p.t) : ['163', 1];
    case 'attack': return seqFrame(p.move, p.t);
    case 'hit':
      if (p.crouchHit && A['110']) return ['110', p.t < 6 ? 0 : 1];          // cower
      if (p.hitLvl >= 2 && A['340'] && p.t < 9) return ['340', 0];          // heavy hit: shocked recoil
      return ['310', p.t < 5 ? 0 : 1];
    case 'block': return p.crouchBlock ? ['821', 0] : ['800', 0];
    case 'airHit': return p.vy < 0 ? ['138', Math.min(1, Math.floor(p.t / 4))] : ['138', 2];
    case 'down': return p.t < 6 ? ['139', 0] : ['138', 3];
    case 'wake': return ['139', 2];
    case 'throwing': return cyc(c.throwAnim, 6, p.t);
    case 'thrown': return ['310', 0];
    case 'tech': return ['310', 1];
    case 'cine': { const s = p.move.cine[p.cs] || p.move.cine[p.move.cine.length - 1]; return [s[0], s[1]]; }
    case 'cineHit': return ['310', Math.floor(p.frame / 3) % 2];
    case 'intro': { const a = L.intros[(G.round - 1) % L.intros.length]; return cyc(A[a] ? a : c.intro, 10, p.frame); }
    case 'win': { const a = winAnim(p); return [a, Math.min(n(a) - 1, Math.floor(p.t / 7)) % n(a)]; }
    case 'lose': return ['340', 0];
  }
  return ['800', 0];
}
function drawSpr(cid, variant, anim, fi, x, y, facing, scale = SC, kx = 1, ky = 1, lean = 0) {
  const S = SPR[cid], a = S.anims[anim]; if (!a) return;
  const idx = a[0] + Math.min(fi, a[1] - 1);
  const sx = (idx % S.cols) * 64, sy = Math.floor(idx / S.cols) * 64;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y));
  if (lean) ctx.transform(1, 0, -lean * facing, 1, 0, 0);
  ctx.scale((facing === 1 ? -1 : 1) * kx, ky);
  const s = 64 * scale;
  // facing right = mirrored sprite with the "r" detail layer (asymmetric hair/accessories)
  const key = (variant || 'img') + (facing === 1 ? 'R' : '');
  ctx.drawImage(S[key] || S[variant] || S.img, sx, sy, 64, 64, -s / 2, -s, s, s);
  ctx.restore();
}

function drawFx(left) {
  for (const f of G.fx) {
    const x = f.x - left, y = f.y, k = f.t / f.life;
    const col = { hit: '#ffe066', counter: '#ff5050', block: '#7fd4ff', super: '#ffffff', armor: '#ffcc33' }[f.kind] || '#fff';
    if (f.type === 'spark') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(f.rot);
      const R = (24 + f.lvl * 16) * (0.4 + k * 0.9);
      ctx.globalAlpha = 1 - k;
      if (f.kind === 'block') {
        ctx.strokeStyle = col; ctx.lineWidth = 6 * (1 - k) + 1;
        ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2; ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); } ctx.stroke();
      } else {
        ctx.fillStyle = col;
        const spikes = 8;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const a = i / (spikes * 2) * Math.PI * 2, rr = i % 2 ? R * 0.35 : R * (i % 4 ? 1 : 1.4);
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, R * 0.35 * (1 - k), 0, 7); ctx.fill();
      }
      ctx.restore();
    } else if (f.type === 'pt') {
      ctx.globalAlpha = 1 - k; ctx.fillStyle = col; ctx.fillRect(x - 3, y - 3, 6, 6);
    } else if (f.type === 'dust') {
      ctx.globalAlpha = (1 - k) * 0.6; ctx.fillStyle = '#e9dcc0';
      const s = 6 + k * 12; ctx.fillRect(x - s / 2, y - s / 2 - 4, s, s);
    } else if (f.type === 'vfx') {
      drawVfx(f, left);
    } else if (f.type === 'mot') {
      ctx.globalAlpha = 1 - k; drawMotif(f.motif, f.x - left, f.y, f.size, f.rot + f.t * f.vr, f.color);
    } else if (f.type === 'aura') {
      ctx.globalAlpha = (1 - k) * 0.8; ctx.fillStyle = f.col; ctx.fillRect(x - 3, y - 3, 6, 9);
    }
    ctx.globalAlpha = 1;
  }
}
function star(x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}
function drawMotif(motif, x, y, size, rot, color) {
  ctx.fillStyle = color;
  if (motif === 'stars') star(x, y, size, rot);
  else if (motif === 'leaves') { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath(); ctx.ellipse(0, 0, size, size * 0.42, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,60,20,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(size, 0); ctx.stroke(); ctx.restore(); }
  else if (motif === 'bolt') { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
    ctx.moveTo(-size * 0.2, -size); ctx.lineTo(size * 0.35, -size * 0.1); ctx.lineTo(0, -size * 0.05); ctx.lineTo(size * 0.25, size);
    ctx.lineTo(-size * 0.35, size * 0.05); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.restore(); }
  else if (motif === 'petals') { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath(); ctx.ellipse(0, 0, size * 0.75, size * 0.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(-size * 0.2, -size * 0.1, size * 0.25, size * 0.15, 0, 0, 7); ctx.fill(); ctx.restore(); }
  else if (motif === 'gems') { ctx.save(); ctx.translate(x, y); ctx.rotate(rot * 0.3); ctx.beginPath();   // McQueen: cut gems
    ctx.moveTo(0, -size); ctx.lineTo(size * 0.6, -size * 0.2); ctx.lineTo(0, size); ctx.lineTo(-size * 0.6, -size * 0.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * 0.6, -size * 0.2); ctx.lineTo(0, -size * 0.1); ctx.closePath(); ctx.fill(); ctx.restore(); }
  else if (motif === 'sparkle') { ctx.save(); ctx.translate(x, y); ctx.rotate(rot * 0.2); ctx.beginPath();   // Teio: four-point twinkles
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? size * 0.22 : size * 1.1; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.restore(); }
  else if (motif === 'flames') { ctx.save(); ctx.translate(x, y); ctx.beginPath();   // Kitasan: festival embers
    ctx.moveTo(0, -size * 1.2); ctx.quadraticCurveTo(size * 0.8, 0, 0, size * 0.6); ctx.quadraticCurveTo(-size * 0.8, 0, 0, -size * 1.2); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,170,.7)'; ctx.beginPath(); ctx.arc(0, size * 0.15, size * 0.28, 0, 7); ctx.fill(); ctx.restore(); }
  else { ctx.fillRect(x - size * 0.4, y - size * 0.4, size * 0.8, size * 0.8); }   // bang: chunky confetti
}
// one effect instance; local space faces right, mirrored by facing
function drawVfx(f, left) {
  const own = G.p[f.owner];
  let x = f.x, y = f.y, facing = f.facing;
  if (f.attached && own) { x = own.x + own.facing * f.ox; y = own.y + f.oy; facing = own.facing; }
  const k = f.t / f.life, sx = x - left;
  ctx.save(); ctx.translate(sx, y); ctx.scale(facing, 1);
  switch (f.kind) {
    case 'swipe': {   // tapered arc revealed over the first frames
      const reveal = Math.min(1, f.t / 3), a0 = f.a0, a1 = f.a0 + (f.a1 - f.a0) * reveal;
      ctx.scale(1, f.flat || 1);
      ctx.lineCap = 'round';
      for (let i = 3; i >= 0; i--) {   // wide colored body, then a bright core
        ctx.globalAlpha = (1 - k) * (i === 0 ? 1 : 0.5);
        ctx.strokeStyle = i === 0 ? '#fff' : f.color; ctx.lineWidth = (f.w + 3) * (i === 0 ? 0.5 : 1.6 - i * 0.3) * (1 - k * 0.5);
        ctx.beginPath(); ctx.arc(0, 0, f.r - i * 6, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
      }
      break;
    }
    case 'thrust': {  // forward smear: tapered streak plus speed ticks
      const len = f.len * 1.25 * (0.6 + 0.4 * Math.min(1, f.t / 2));
      ctx.globalAlpha = 1 - k * 0.8;
      const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, f.color); g.addColorStop(1, '#fff');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.quadraticCurveTo(0, -f.w, len / 2, 0); ctx.quadraticCurveTo(0, f.w, -len / 2, 0); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.globalAlpha = (1 - k) * 0.6;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-len * 0.6, i * f.w * 1.3); ctx.lineTo(-len * 0.1, i * f.w * 1.3); ctx.stroke(); }
      break;
    }
    case 'ring': {
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = 8 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(0, 0, f.r * (0.3 + k * 0.9), 0, 7); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, f.r * (0.2 + k * 0.7), 0, 7); ctx.stroke();
      break;
    }
    case 'pillar': {  // vertical burst of light
      const w = f.w * (1 - k);
      const g = ctx.createLinearGradient(0, -f.h, 0, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, f.color); g.addColorStop(1, '#fff');
      ctx.globalAlpha = (1 - k) * 0.75; ctx.fillStyle = g; ctx.fillRect(-w / 2, -f.h, w, f.h);
      ctx.fillStyle = '#fff'; ctx.globalAlpha = (1 - k); ctx.fillRect(-w / 6, -f.h, w / 3, f.h);
      break;
    }
    case 'speed': {   // lines streaming behind the character
      ctx.strokeStyle = f.color; ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        const yy = -20 - ((i * 37 + f.seed * 13) % 130), off = ((f.t * 17 + i * 29) % 60);
        ctx.globalAlpha = 0.55 * (1 - k * 0.5);
        ctx.beginPath(); ctx.moveTo(-40 - off, yy); ctx.lineTo(-40 - off - 50 - (i % 3) * 20, yy); ctx.stroke();
      }
      break;
    }
    case 'streak': {  // diagonal trail for dives
      ctx.globalAlpha = 0.6 * (1 - k); ctx.strokeStyle = f.color; ctx.lineWidth = 4;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-15 - i * 10, -70 + i * 14); ctx.lineTo(-75 - i * 14, -125 + i * 10); ctx.stroke(); }
      break;
    }
    case 'spiral': {  // whirlwind around the body
      const flat = f.flat || 0.32;
      for (let i = 0; i < 3; i++) {
        const a = f.t * 0.55 + i * 2.1;
        ctx.globalAlpha = 0.65 * (1 - k * 0.6); ctx.strokeStyle = i === 1 ? '#fff' : f.color; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(0, -i * 22 + 18, f.r * (1 - i * 0.15), f.r * flat, 0, a, a + 2.6); ctx.stroke();
      }
      break;
    }
    case 'vanish': {
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = f.color; ctx.lineWidth = 3;
      for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 30 + k * 60 + i * 12, (30 + k * 60 + i * 12) * 1.4, 0, 0, 7); ctx.stroke(); }
      break;
    }
    case 'dustTrail': {
      if (own && f.t % 3 === 0 && f.lastT !== f.t) { f.lastT = f.t; dust(own.x - own.facing * 20, GY, own.facing); }
      break;
    }
    case 'bang': {   // comic onomatopoeia burst
      ctx.scale(facing, 1);
      const pop = f.t < 4 ? 0.6 + f.t * 0.12 : 1, a = f.t > f.life * 0.7 ? (1 - k) / 0.3 : 1;
      ctx.globalAlpha = a; ctx.scale(pop, pop); ctx.rotate(-0.12);
      ctx.fillStyle = f.alt; ctx.beginPath();
      for (let i = 0; i < 24; i++) { const ang = i / 24 * Math.PI * 2, rr = i % 2 ? 26 : 44; ctx.lineTo(Math.cos(ang) * rr * 1.6, Math.sin(ang) * rr); }
      ctx.fill();
      ctx.restore(); ctx.save(); ctx.translate(sx, y); ctx.globalAlpha = a; ctx.scale(pop, pop); ctx.rotate(-0.12);
      txt(f.text, 0, 0, f.text.length > 5 ? 22 : 30, f.color, 'center', '#2a1208');
      break;
    }
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
function drawProj(q, left) {
  const x = q.x - left, y = q.y;   // q.y is the projectile's center
  const owner = G.p[q.owner];
  if (q.style === 'rose') {   // crimson shot with a petal trail
    const col = q.sup ? '#ffc93c' : owner ? owner.c.look.fxColor : '#ff5872', ang = Math.atan2(q.vy || 0, q.vx), sz = q.size || 1;
    for (let i = 5; i >= 1; i--) { ctx.globalAlpha = q.sup ? 0.22 : 0.14; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x - q.vx * i * 2, y - (q.vy || 0) * i * 2, (20 - i * 2) * sz, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sz, sz);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 24); g.addColorStop(0, '#fff'); g.addColorStop(0.5, q.sup ? '#ffe9a8' : '#ffb3c1'); g.addColorStop(1, q.sup ? '#e2304a' : col);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 26, 17, 0, 0, 7); ctx.fill();
    ctx.rotate(q.t * 0.25); ctx.fillStyle = 'rgba(160,10,40,.85)';
    for (let i = 0; i < 5; i++) { ctx.rotate(Math.PI * 2 / 5); ctx.beginPath(); ctx.ellipse(7, 0, 7, 4, 0, 0, 7); ctx.fill(); }
    ctx.restore();
    if (q.t % (q.sup ? 2 : 4) === 0) G.fx.push({ type: 'mot', motif: 'petals', color: q.t % 4 ? '#e2304a' : col, x: q.x, y: q.y, vx: -q.vx * 0.1, vy: 0.6, rot: q.t, vr: 0.2, t: 0, life: 20, size: 5 });
    return;
  }
  if (q.style === 'wave') {   // ground-hugging low wave
    const col = owner ? owner.c.look.fxColor : '#ff5872';
    ctx.save(); ctx.translate(x, GY); ctx.scale(q.facing, 1);
    for (let i = 3; i >= 0; i--) {
      ctx.globalAlpha = i === 0 ? 0.95 : 0.25; ctx.fillStyle = i === 0 ? col : '#ffd0da';
      const h = 34 + Math.sin((q.t + i * 3) * 0.6) * 8 - i * 4;
      ctx.beginPath(); ctx.moveTo(-34 - i * 14, 0); ctx.quadraticCurveTo(-8 - i * 14, -h, 20 - i * 14, 0); ctx.closePath(); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
    if (q.t % 3 === 0) dust(q.x - q.vx * 2, GY, Math.sign(q.vx));
    return;
  }
  if (q.style === 'flame') {   // Kitasan's festival drum: a spinning ring of fire with a drum-skin center
    const col = owner ? owner.c.look.fxColor : '#ff4d3d', alt = owner ? owner.c.look.fxAlt : '#ffd24a';
    for (let i = 5; i >= 1; i--) { ctx.globalAlpha = 0.13; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x - q.vx * i * 2, y, 25 - i * 2, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(q.facing, 1);
    ctx.rotate(-q.t * 0.3); ctx.fillStyle = col;
    for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(18, -6); ctx.quadraticCurveTo(34 + Math.sin(q.t * 0.7 + i) * 5, 0, 18, 6); ctx.fill(); }
    ctx.rotate(q.t * 0.3);
    const g = ctx.createRadialGradient(0, 0, 3, 0, 0, 22); g.addColorStop(0, '#fff8e0'); g.addColorStop(0.55, alt); g.addColorStop(1, col);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 21, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(120,20,10,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.stroke();   // the drum rim
    ctx.restore();
    if (q.t % 3 === 0) G.fx.push({ type: 'mot', motif: 'flames', color: q.t % 6 ? col : alt, x: q.x - q.vx * 2, y: q.y + 6, vx: -q.vx * 0.15, vy: -1.2, rot: 0, vr: 0, t: 0, life: 16, size: 6 });
    return;
  }
  if (q.style === 'orb') {
    const col = G.p[q.owner] ? G.p[q.owner].c.color : '#e45ba8';
    for (let i = 5; i >= 1; i--) { ctx.globalAlpha = 0.12; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x - q.vx * i * 2, y, 26 - i * 2, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    const r = 24 + Math.sin(q.t * 0.6) * 3;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, '#fff'); g.addColorStop(0.45, '#ffd1ea'); g.addColorStop(1, col);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(q.t * 0.2); ctx.fillStyle = '#fff'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, rr = i % 2 ? 5 : 11; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.fill(); ctx.restore();
    return;
  }
  for (let i = 4; i >= 0; i--) {
    ctx.save(); ctx.translate(x - q.vx * i * 2.2, y); ctx.scale(q.facing, 1);
    ctx.globalAlpha = i === 0 ? 1 : 0.18;
    ctx.strokeStyle = i === 0 ? '#eaffef' : '#47d77a'; ctx.lineWidth = 7;
    const wob = Math.sin((q.t + i) * 0.5) * 4;
    ctx.beginPath(); ctx.arc(-10, 0, 30 + wob, -1.1, 1.1); ctx.stroke();
    ctx.strokeStyle = '#3fbf6a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(-22, 0, 22 - wob, -1.0, 1.0); ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ fighters
// squash & stretch on whole frames, scaled by the character's look.squash
function squash(p) {
  const k = p.c.look.squash, t = p.t;
  let sx = 1, sy = 1, lean = 0;
  if (p.state === 'jsquat') { sy = 1 - 0.13 * k; sx = 1 + 0.1 * k; }
  else if (p.state === 'air' && t < 6 && p.vy < 0) { const e = 1 - t / 6; sy = 1 + 0.1 * k * e; sx = 1 - 0.07 * k * e; }
  else if (p.state === 'land' && t < 5) { const e = 1 - t / 5; sy = 1 - 0.12 * k * e; sx = 1 + 0.1 * k * e; }
  else if (p.state === 'hit' && t < 6) { const e = 1 - t / 6, h = 0.04 + 0.035 * p.hitLvl; sx = 1 - h * k * e; sy = 1 + h * 0.5 * k * e; lean = -0.12 * k * e; }
  else if (p.state === 'dash' || p.state === 'airdash') lean = 0.1 * k;
  else if (p.state === 'attack' && p.move.vel && p.move.vel.some(v => Math.abs(v[2]) >= 9 && t >= v[0] && t <= v[1])) lean = 0.13 * k;
  else if (p.state === 'down' && t < 4) { sy = 1 - 0.15 * k * (1 - t / 4); sx = 1 + 0.12 * k * (1 - t / 4); }
  return [sx, sy, lean];
}
function drawFighter(p, left) {
  const variant = p.alt ? 'alt' : 'img';
  const [anim, fi] = frameOf(p);
  // afterimages
  for (const tr of p.trail) {
    ctx.globalAlpha = 0.35 * (1 - tr.t / 12);
    drawSpr(p.cid, 'white', tr.f[0], tr.f[1], tr.x - left, tr.y, tr.facing);
  }
  ctx.globalAlpha = 1;
  // guts aura
  if (p.gold > 0 && G.frameCount % 2 === 0) G.fx.push({ type: 'aura', x: p.x + (Math.random() - .5) * 70, y: p.y - Math.random() * 130, vx: 0, vy: -2.5, t: 0, life: 16, col: '#ffd24a' });
  if (p.guts > 0 && G.frameCount % 3 === 0) G.fx.push({ type: 'aura', x: p.x + (Math.random() - .5) * 60, y: p.y - Math.random() * 120, vx: 0, vy: -2, t: 0, life: 18, col: p.c.color });
  const invis = p.state === 'attack' && p.move.invis && p.t >= p.move.invis[0] && p.t <= p.move.invis[1];
  if (invis) ctx.globalAlpha = 0.1;
  const [sx, sy, lean] = squash(p);
  drawSpr(p.cid, variant, anim, fi, p.x - left, p.y, p.facing, SC, sx, sy, lean);
  ctx.globalAlpha = 1;
  if (p.flash > 0) { ctx.globalAlpha = Math.min(1, p.flash / 4) * (SET.calm ? 0.25 : 0.8); drawSpr(p.cid, 'white', anim, fi, p.x - left, p.y, p.facing, SC, sx, sy, lean); ctx.globalAlpha = 1; }
  if (p.guarding && p.state !== 'block') {
    ctx.save(); ctx.translate(p.x - left + p.facing * 14, p.y - (p.state === 'crouch' ? 48 : 82));
    ctx.globalAlpha = 0.28 + 0.08 * Math.sin(G.frameCount / 5); ctx.strokeStyle = '#8fdcff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, p.state === 'crouch' ? 50 : 70, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1;
  }
  if (p.state === 'block') {
    ctx.save(); ctx.translate(p.x - left + p.facing * 34, p.y - (p.crouchBlock ? 48 : 82));
    ctx.globalAlpha = 0.55 * Math.min(1, p.bs / 6); ctx.strokeStyle = '#8fdcff'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(-p.facing * 20, 0, p.crouchBlock ? 46 : 62, p.facing === 1 ? -1 : Math.PI - 1, p.facing === 1 ? 1 : Math.PI + 1); ctx.stroke();
    ctx.restore(); ctx.globalAlpha = 1;
  }
}
function drawShadow(p, left) {
  const h = Math.max(0, GY - p.y), s = Math.max(0.4, 1 - h / 300);
  ctx.fillStyle = 'rgba(20,50,20,.35)';
  ctx.beginPath(); ctx.ellipse(p.x - left, GY + 2, 40 * s, 9 * s, 0, 0, 7); ctx.fill();
}
function drawBoxes(left) {
  const R = (r, c) => { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.strokeRect(r.x - left, r.y, r.w, r.h); ctx.fillStyle = c.replace('1)', '.18)'); ctx.fillRect(r.x - left, r.y, r.w, r.h); };
  for (const p of G.p) {
    const hb = hurtbox(p);
    if (hb) R(hb, invulnerable(p, false) ? 'rgba(255,255,255,1)' : p.state === 'attack' && p.armorLeft && p.move.armor && p.t >= p.move.armor[0] && p.t <= p.move.armor[1] ? 'rgba(255,200,40,1)' : 'rgba(80,160,255,1)');
    if (p.state === 'attack' && p.move.hits) p.move.hits.forEach((h, i) => { if (p.t >= h.f[0] && p.t <= h.f[1] && !p.hitDone[i]) R(rect(p, h.box), 'rgba(255,60,60,1)'); });
    if (p.state === 'attack' && p.move.grab && p.t >= p.move.grab[0] && p.t <= p.move.grab[1]) R(rect(p, [0, -120, p.move.range, 120]), 'rgba(255,230,60,1)');
    ctx.fillStyle = '#fff'; ctx.fillRect(p.x - left - 1, p.y - 6, 2, 12);
  }
  for (const q of G.projs) R(projRect(q), 'rgba(255,60,60,1)');
}

// ------------------------------------------------------------------ text helpers

// ------------------------------------------------------------------ HUD


// ------------------------------------------------------------------ game frame
function renderGame() {
  const sh = G.shake && !SET.calm ? (Math.random() - .5) * G.shake * 2 : 0;
  baseT(Math.round(sh), Math.round(sh * 0.6));
  const left = G.cam - W / 2;
  drawStage(G.cam);
  for (const p of G.p) drawShadow(p, left);
  const order = [...G.p].sort((a, b) => (a.state === 'attack' || a.state === 'cine' || a.state === 'throwing' ? 1 : 0) - (b.state === 'attack' || b.state === 'cine' || b.state === 'throwing' ? 1 : 0));
  if (G.flashOwner) {
    for (const p of order) if (p !== G.flashOwner) drawFighter(p, left);
    ctx.fillStyle = 'rgba(10,8,30,.7)'; ctx.fillRect(-20, -20, W + 40, HGT + 40);
    // speed lines
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) { const y = (i * 37 + G.frameCount * 23) % HGT; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 4); ctx.stroke(); }
    drawFighter(G.flashOwner, left);
    drawSuperFlash(G.flashOwner);
  } else for (const p of order) drawFighter(p, left);
  for (const q of G.projs) drawProj(q, left);
  drawFx(left);
  drawStageFront(G.cam);
  if (G.showBoxes) drawBoxes(left);
  for (const t of G.texts) {
    const k = t.t / t.life; ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    txt(t.txt, t.x - left, t.y - t.t * 0.6, t.size, t.color); ctx.globalAlpha = 1;
  }
  baseT();
  drawHUD();
  if (G.mode === 'training') { if (!TR.on) drawTrainingHUD(); drawInputDisplay(); drawFrameMeter(); drawTrialHUD(); }
  if (G.phase === 'intro') drawRoundIntro();
  if (G.phase === 'ko') drawKO();
  if (G.phase === 'match') drawResults();
}
