// ============================================================================
//  STAGES  —  procedural pixel art at 1/3 resolution, three parallax layers
//  (far 0.35, mid 0.65, near 1.0) plus animated back/front passes.
//  Purely cosmetic: nothing here is read by the simulation.
// ============================================================================
'use strict';

const PX = 3;                                   // art is drawn at 1/3 res and scaled up
const PH = HGT / PX;                            // 180 art rows; feet stand at GY/3 ≈ 157
const layerW = par => Math.ceil((W + (STAGE_W - W) * par) / PX) + 2;
function seeded(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function vgrad(c, h, stops) { const g = c.createLinearGradient(0, 0, 0, h); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; }
const prect = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

// shared: white running rail + posts along y
function rail(n, w, y, r) {
  prect(n, '#f4f4f4', 0, y, w, 2); prect(n, '#c9c9c9', 0, y + 2, w, 1);
  for (let x = 0; x < w; x += 20) prect(n, '#e8e8e8', x, y, 1, 8);
}

// ---------------------------------------------------------------- 1. Tokyo Racecourse (day)
function buildTokyo() {
  const r = seeded(3);
  const farW = layerW(0.35), far = canvasOf(farW, PH), f = far.getContext('2d');
  f.fillStyle = vgrad(f, PH, [[0, '#4f8fd8'], [0.55, '#a9d6f5'], [0.8, '#ffe6bf']]); f.fillRect(0, 0, farW, PH);
  for (let i = 0; i < 9; i++) {
    const cx = r() * farW, cy = 8 + r() * 40, w = 20 + r() * 40;
    for (let k = 0; k < 5; k++) prect(f, 'rgba(255,255,255,.85)', cx + k * w / 6 - w / 3, cy - (k % 2) * 3, w / 2, 5 + (k % 3) * 2);
  }
  for (let x = 0; x < farW; x++) { const h = 18 + Math.sin(x / 23) * 6 + Math.sin(x / 9) * 2; prect(f, '#9cc0d6', x, 112 - h, 1, h + 10); }
  for (let x = 0; x < farW; x++) { const h = 9 + Math.sin(x / 15 + 2) * 4; prect(f, '#87b08f', x, 118 - h, 1, h + 10); }

  const midW = layerW(0.65), mid = canvasOf(midW, PH), m = mid.getContext('2d');
  const gx = 40, gw = midW - 80;
  prect(m, '#d9d4cc', gx, 52, gw, 70); prect(m, '#8b8f99', gx - 6, 44, gw + 12, 8); prect(m, '#6d717c', gx - 6, 52, gw + 12, 2);
  for (let x = gx + 10; x < gx + gw; x += 46) prect(m, '#a7a39b', x, 52, 3, 70);
  const cols = ['#e24b4b', '#3b6fd8', '#f2c94c', '#ffffff', '#2f2f3a', '#e57bb7', '#4fbf7a', '#f08a3c'];
  for (let row = 0; row < 6; row++) {
    const y = 60 + row * 9; prect(m, '#b9b3a8', gx, y + 6, gw, 2);
    for (let x = gx + 2; x < gx + gw - 2; x += 3) if (r() < 0.82) {
      const up = r() < .3 ? -1 : 0;
      prect(m, cols[Math.floor(r() * cols.length)], x, y + 2 + up, 2, 4); prect(m, '#f1c9a5', x, y + up, 2, 2);
    }
  }
  const sx = Math.round(midW / 2 - 50);
  prect(m, '#2b2d33', sx - 3, 6, 106, 44); prect(m, '#10141c', sx, 9, 100, 34);
  m.font = 'bold 9px monospace'; m.textAlign = 'center';
  m.fillStyle = '#ffd24a'; m.fillText('TURF 2400m', sx + 50, 22); m.fillStyle = '#7fe0ff'; m.fillText('GOOD  ·  FINAL', sx + 50, 36);
  prect(m, '#2b2d33', sx + 46, 50, 8, 4);
  prect(m, '#3f7a3c', 0, 118, midW, 6);
  for (let x = 0; x < midW; x += 4) prect(m, r() < .5 ? '#4c8c45' : '#36693a', x, 116 + Math.floor(r() * 2), 4, 3);

  const PW = STAGE_W / PX, near = canvasOf(PW, PH), n = near.getContext('2d');
  for (let y = 124; y < PH; y++) prect(n, Math.floor((y - 124) / 6) % 2 ? '#5daa4c' : '#68b856', 0, y, PW, 1);
  for (let x = 0; x < PW; x += 32) prect(n, 'rgba(255,255,255,.05)', x, 124, 16, PH - 124);
  rail(n, PW, 126, r);
  [[120, '1000'], [330, '800'], [540, '600']].forEach(([x, t]) => {
    prect(n, '#fff', x, 104, 2, 30); prect(n, '#d43c3c', x - 11, 99, 24, 10);
    n.fillStyle = '#fff'; n.font = 'bold 6px monospace'; n.textAlign = 'center'; n.fillText(t, x + 1, 107);
  });
  prect(n, '#b48a5a', 0, 170, PW, 10); for (let x = 0; x < PW; x += 3) prect(n, '#9b7448', x, 170 + Math.floor(r() * 3), 2, 1);
  prect(n, '#f4f4f4', 0, 166, PW, 2); for (let x = 6; x < PW; x += 24) prect(n, '#ddd', x, 166, 2, 6);

  // a few birds drifting over the hills
  const back = (c, left, t) => {
    c.fillStyle = 'rgba(40,60,90,.55)';
    for (let i = 0; i < 4; i++) {
      const x = ((i * 271 + t * (0.25 + i * 0.04)) % (W + 200)) - 100, y = 34 + i * 18 + Math.sin(t / 30 + i) * 6, wing = Math.sin(t / 6 + i) > 0 ? 3 : 0;
      c.fillRect(x, y, 3, 3); c.fillRect(x - 6, y - wing, 6, 3); c.fillRect(x + 3, y - wing, 6, 3);
    }
  };
  return { far, mid, near, back };
}

// ---------------------------------------------------------------- 2. Tracen training track (sunset)
function buildTracen() {
  const r = seeded(11);
  const farW = layerW(0.35), far = canvasOf(farW, PH), f = far.getContext('2d');
  f.fillStyle = vgrad(f, PH, [[0, '#2b1b4f'], [0.3, '#6c2c6e'], [0.52, '#d9584f'], [0.66, '#ff9a4a'], [0.74, '#ffd27a']]); f.fillRect(0, 0, farW, PH);
  // retro striped sun sinking behind the hills
  const sunX = Math.round(farW * 0.56), sunY = 98;
  for (let y = -30; y <= 30; y++) {
    if (y > 4 && (y % 5 === 0 || (y > 14 && y % 3 === 0))) continue;
    const hw = Math.sqrt(Math.max(0, 900 - y * y));
    prect(f, y < -10 ? '#fff4c2' : y < 6 ? '#ffe08a' : '#ffc061', sunX - hw, sunY + y, hw * 2, 1);
  }
  for (let i = 0; i < 7; i++) {   // long thin clouds
    const cx = r() * farW, cy = 18 + r() * 60, w = 40 + r() * 70;
    prect(f, 'rgba(255,170,160,.45)', cx, cy, w, 2); prect(f, 'rgba(255,210,190,.35)', cx + w * 0.2, cy - 2, w * 0.5, 2);
  }
  for (let x = 0; x < farW; x++) { const h = 22 + Math.sin(x / 31) * 9 + Math.sin(x / 11) * 3; prect(f, '#6e3567', x, 116 - h, 1, h + 10); }
  for (let x = 0; x < farW; x++) { const h = 12 + Math.sin(x / 17 + 1) * 5; prect(f, '#4a2554', x, 120 - h, 1, h + 10); }

  const midW = layerW(0.65), mid = canvasOf(midW, PH), m = mid.getContext('2d');
  const sil = '#2a1a36', win = '#ffcf6b';
  // tree line
  for (let x = -10; x < midW + 10; x += 9 + Math.floor(r() * 7)) {
    const rr = 7 + r() * 6, cy = 104 - r() * 8;
    m.fillStyle = '#331f40'; m.beginPath(); m.arc(x, cy, rr, 0, 7); m.fill();
    prect(m, '#331f40', x - 1, cy, 2, 20);
  }
  // academy main building with a clock tower
  const bx = Math.round(midW / 2 - 110), bw = 220;
  prect(m, sil, bx, 72, bw, 48); prect(m, '#3b2547', bx - 4, 68, bw + 8, 5);
  for (let row = 0; row < 3; row++) for (let x = bx + 8; x < bx + bw - 8; x += 12)
    if (r() < 0.55) prect(m, row === 0 ? '#ffd98a' : win, x, 78 + row * 12, 5, 6); else prect(m, '#3e2a4c', x, 78 + row * 12, 5, 6);
  const tx = bx + bw / 2 - 12;
  prect(m, sil, tx, 30, 24, 42); prect(m, '#3b2547', tx - 3, 27, 30, 4);
  m.fillStyle = sil; m.beginPath(); m.moveTo(tx - 2, 27); m.lineTo(tx + 12, 10); m.lineTo(tx + 26, 27); m.fill();
  m.fillStyle = '#f3e6c4'; m.beginPath(); m.arc(tx + 12, 44, 7, 0, 7); m.fill();
  prect(m, '#3b2547', tx + 11, 39, 2, 6); prect(m, '#3b2547', tx + 12, 44, 5, 1);
  // side wings
  prect(m, sil, bx - 70, 88, 66, 32); prect(m, sil, bx + bw + 4, 88, 66, 32);
  for (let x = bx - 64; x < bx - 8; x += 10) prect(m, r() < .5 ? win : '#3e2a4c', x, 96, 4, 5);
  for (let x = bx + bw + 10; x < bx + bw + 66; x += 10) prect(m, r() < .5 ? win : '#3e2a4c', x, 96, 4, 5);
  // wooden practice-track rail
  prect(m, '#e9cfa6', 0, 114, midW, 2); prect(m, '#b8946a', 0, 116, midW, 1);
  for (let x = 2; x < midW; x += 16) prect(m, '#d8b98d', x, 114, 2, 8);
  prect(m, '#3a5a35', 0, 120, midW, 4);

  const PW = STAGE_W / PX, near = canvasOf(PW, PH), n = near.getContext('2d');
  for (let y = 124; y < PH; y++) {
    const k = (y - 124) / 56;
    prect(n, `rgb(${Math.round(176 - k * 40)},${Math.round(116 - k * 30)},${Math.round(72 - k * 18)})`, 0, y, PW, 1);
  }
  for (let i = 0; i < 900; i++) prect(n, r() < .5 ? 'rgba(255,214,160,.35)' : 'rgba(90,50,30,.35)', r() * PW, 128 + r() * 40, 2 + r() * 4, 1);   // raked dirt
  for (let i = 0; i < 70; i++) { const x = r() * PW, y = 132 + r() * 34; prect(n, 'rgba(80,45,25,.45)', x, y, 3, 2); prect(n, 'rgba(80,45,25,.45)', x + 1, y + 2, 1, 1); }   // hoof prints
  rail(n, PW, 124, r);
  for (let y = 124; y < 170; y += 1) prect(n, `rgba(255,140,70,${0.08 * (1 - (y - 124) / 46)})`, 0, y, PW, 1);   // sunset glaze
  prect(n, '#4a6b3a', 0, 170, PW, 10); for (let x = 0; x < PW; x += 2) prect(n, r() < .5 ? '#5a7d45' : '#3b5a30', x, 168 + Math.floor(r() * 3), 2, 3);
  // cones / tyre markers used for training
  [[150, '#ff7a30'], [520, '#ff7a30']].forEach(([x, col]) => { n.fillStyle = col; n.beginPath(); n.moveTo(x, 120); n.lineTo(x + 4, 130); n.lineTo(x - 4, 130); n.fill(); prect(n, '#fff', x - 2, 125, 4, 1); });

  const back = (c, left, t) => {   // crows heading home + a warm haze pulse
    c.fillStyle = 'rgba(30,10,40,.8)';
    for (let i = 0; i < 6; i++) {
      const x = ((i * 197 + t * (0.35 + i * 0.05)) % (W + 240)) - 120, y = 40 + (i % 3) * 18 + Math.sin(t / 28 + i) * 5, wing = Math.sin(t / 5 + i * 2) > 0 ? 3 : -1;
      c.fillRect(x, y, 3, 3); c.fillRect(x - 6, y - wing, 6, 2); c.fillRect(x + 3, y - wing, 6, 2);
    }
  };
  const front = (c, left, t) => {   // drifting dust motes catching the low sun
    for (let i = 0; i < 26; i++) {
      const x = ((i * 89 + t * (0.3 + (i % 4) * 0.12) - left * 0.2) % W + W) % W, y = 300 + ((i * 47 + Math.sin(t / 40 + i) * 30) % 180);
      c.fillStyle = `rgba(255,220,150,${0.25 + 0.25 * Math.sin(t / 20 + i)})`; c.fillRect(x, y, 3, 3);
    }
  };
  return { far, mid, near, back, front };
}

// ---------------------------------------------------------------- 3. Nakayama, winter night race
function buildNakayama() {
  const r = seeded(29);
  const farW = layerW(0.35), far = canvasOf(farW, PH), f = far.getContext('2d');
  f.fillStyle = vgrad(f, PH, [[0, '#060a1c'], [0.45, '#121a42'], [0.66, '#26306a']]); f.fillRect(0, 0, farW, PH);
  const stars = [];
  for (let i = 0; i < 90; i++) { const x = r() * farW, y = r() * 80; stars.push([x, y]); prect(f, r() < .3 ? '#fff' : '#9fb0e0', x, y, 1, 1); }
  f.fillStyle = '#f4f1d8'; f.beginPath(); f.arc(Math.round(farW * 0.18), 26, 10, 0, 7); f.fill();
  f.fillStyle = '#d8d3b0'; [[-3, -2, 2], [3, 3, 1.5], [1, -5, 1]].forEach(([dx, dy, rr]) => { f.beginPath(); f.arc(Math.round(farW * 0.18) + dx, 26 + dy, rr, 0, 7); f.fill(); });
  // city skyline with lit windows
  for (let x = 0; x < farW;) {
    const w = 8 + Math.floor(r() * 16), h = 14 + Math.floor(r() * 28);
    prect(f, '#0e1433', x, 118 - h, w, h + 6);
    for (let wy = 118 - h + 3; wy < 114; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) if (r() < 0.28) prect(f, r() < .8 ? '#ffd27a' : '#9fd0ff', wx, wy, 1, 1);
    x += w + Math.floor(r() * 4);
  }

  const midW = layerW(0.65), mid = canvasOf(midW, PH), m = mid.getContext('2d');
  const gx = 30, gw = midW - 60;
  prect(m, '#1c2244', gx, 50, gw, 72); prect(m, '#2d3563', gx - 6, 42, gw + 12, 8); prect(m, '#141938', gx - 6, 50, gw + 12, 2);
  for (let x = gx + 10; x < gx + gw; x += 46) prect(m, '#283058', x, 50, 3, 72);
  for (let row = 0; row < 6; row++) {   // crowd lit by the stand lights
    const y = 58 + row * 9; prect(m, '#252c52', gx, y + 6, gw, 2);
    for (let x = gx + 2; x < gx + gw - 2; x += 3) if (r() < 0.8) {
      const cols = ['#b84a5a', '#4a64b8', '#c9a94a', '#d8dce8', '#2a2a3a', '#b86a9a', '#4a9a6a'];
      const up = r() < .3 ? -1 : 0;
      prect(m, cols[Math.floor(r() * cols.length)], x, y + 2 + up, 2, 4); prect(m, '#d9b496', x, y + up, 2, 2);
    }
  }
  // illumination garland along the roof edge (positions kept for the blink pass)
  const garland = [];
  for (let x = gx - 4; x < gx + gw + 4; x += 5) { const y = 51 + Math.round(Math.sin((x - gx) / 40 * Math.PI) * 2 + 2); garland.push([x, y]); prect(m, '#3a3f66', x, y, 1, 1); }
  // big screen
  const sx = Math.round(midW / 2 - 56);
  prect(m, '#0b0e1c', sx - 3, 4, 118, 40); prect(m, '#050814', sx, 7, 112, 32);
  m.font = 'bold 10px monospace'; m.textAlign = 'center';
  m.fillStyle = '#ffd24a'; m.fillText('ARIMA KINEN', sx + 56, 20); m.fillStyle = '#ff8fb0'; m.font = 'bold 8px monospace'; m.fillText('TURF 2500m', sx + 56, 33);
  // light towers
  const towers = [];
  for (let x = 60; x < midW; x += 230) {
    prect(m, '#2a3050', x, 6, 3, 116); prect(m, '#3a4270', x - 10, 4, 23, 8);
    for (let k = 0; k < 4; k++) prect(m, '#fffbe0', x - 8 + k * 5, 6, 4, 4);
    towers.push(x + 1);
  }
  prect(m, '#1f3f2a', 0, 118, midW, 6);
  for (let x = 0; x < midW; x += 4) prect(m, r() < .5 ? '#27503a' : '#1a3a26', x, 116 + Math.floor(r() * 2), 4, 3);
  for (let x = 0; x < midW; x += 3) if (r() < .6) prect(m, '#e8eef8', x, 115 + Math.floor(r() * 2), 3, 1);   // snow on the hedge

  const PW = STAGE_W / PX, near = canvasOf(PW, PH), n = near.getContext('2d');
  for (let y = 124; y < PH; y++) prect(n, Math.floor((y - 124) / 6) % 2 ? '#2f6a3c' : '#367646', 0, y, PW, 1);
  for (let i = 0; i < 500; i++) prect(n, 'rgba(235,242,255,.55)', r() * PW, 126 + r() * 44, 1 + r() * 2, 1);   // dusting of snow
  rail(n, PW, 126, r);
  for (let x = 0; x < PW; x += 2) if (r() < .7) prect(n, '#f2f6ff', x, 125, 2, 1);
  prect(n, '#5a4a40', 0, 170, PW, 10); prect(n, '#f4f4f4', 0, 166, PW, 2);
  for (let x = 0; x < PW; x += 3) prect(n, '#e8eef8', x, 169 + Math.floor(r() * 2), 3, 2);

  const lamp = (c, x, y, rad, a) => { const g = c.createRadialGradient(x, y, 2, x, y, rad); g.addColorStop(0, `rgba(255,248,210,${a})`); g.addColorStop(1, 'rgba(255,248,210,0)'); c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); };
  const back = (c, left, t) => {
    // star twinkle
    for (let i = 0; i < stars.length; i += 3) { const [x, y] = stars[i]; if (y > 38) continue; const a = 0.5 + 0.5 * Math.sin(t / 14 + i); c.fillStyle = `rgba(255,255,255,${a})`; c.fillRect(x * PX - left * 0.35, y * PX, 3, 3); }
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const tx of towers) lamp(c, tx * PX - left * 0.65, 24, 80, 0.55);
    garland.forEach(([x, y], i) => {
      const on = ((i + Math.floor(t / 12)) % 4) !== 0;
      if (!on) return;
      const col = ['#ff4d6a', '#ffd24a', '#5fe08a', '#5fb0ff'][i % 4];
      c.fillStyle = col; c.globalAlpha = 0.9; c.fillRect(x * PX - left * 0.65, y * PX, 3, 3);
    });
    c.restore(); c.globalAlpha = 1;
  };
  const front = (c, left, t) => {   // snowfall in front of everything
    for (let i = 0; i < 70; i++) {
      const sp = 0.6 + (i % 5) * 0.25, sz = i % 7 === 0 ? 4 : i % 3 === 0 ? 3 : 2;
      const x = ((i * 137 + Math.sin(t / 50 + i) * 20 + t * 0.3 - left * (0.3 + sp * 0.3)) % W + W) % W;
      const y = (i * 61 + t * sp) % (HGT + 20) - 10;
      c.fillStyle = `rgba(245,248,255,${0.55 + (i % 3) * 0.15})`; c.fillRect(x, y, sz, sz);
    }
  };
  return { far, mid, near, back, front };
}

// ---------------------------------------------------------------- 4. Winning Live (concert stage)
function buildLive() {
  const r = seeded(47);
  const farW = layerW(0.35), far = canvasOf(farW, PH), f = far.getContext('2d');
  f.fillStyle = vgrad(f, PH, [[0, '#08040f'], [0.5, '#170a2a'], [0.75, '#2a1240']]); f.fillRect(0, 0, farW, PH);
  // ceiling truss
  for (let x = 0; x < farW; x += 10) { prect(f, '#2a2238', x, 6, 1, 10); f.strokeStyle = '#2a2238'; f.beginPath(); f.moveTo(x, 6); f.lineTo(x + 10, 16); f.stroke(); }
  prect(f, '#3a3050', 0, 5, farW, 2); prect(f, '#3a3050', 0, 16, farW, 2);
  // back wall panels
  for (let x = 0; x < farW; x += 24) prect(f, x % 48 ? '#1a0f2c' : '#1f1334', x, 24, 24, 100);

  const midW = layerW(0.65), mid = canvasOf(midW, PH), m = mid.getContext('2d');
  const scr = { x: Math.round(midW / 2 - 90), y: 20, w: 180, h: 72 };
  prect(m, '#0c0a14', scr.x - 4, scr.y - 4, scr.w + 8, scr.h + 8); prect(m, '#05040a', scr.x, scr.y, scr.w, scr.h);
  // speaker stacks + light bars
  for (const sx of [scr.x - 70, scr.x + scr.w + 30]) {
    prect(m, '#141020', sx, 40, 40, 82);
    for (let k = 0; k < 3; k++) { m.fillStyle = '#241c36'; m.beginPath(); m.arc(sx + 20, 56 + k * 24, 8, 0, 7); m.fill(); m.fillStyle = '#0a0812'; m.beginPath(); m.arc(sx + 20, 56 + k * 24, 4, 0, 7); m.fill(); }
  }
  const pars = [];
  for (let x = 20; x < midW - 20; x += 34) { prect(m, '#2a2238', x, 2, 10, 6); pars.push(x + 5); }
  // risers with steps
  prect(m, '#1e1530', 0, 104, midW, 20); for (let x = 0; x < midW; x += 40) prect(m, '#2a1e42', x, 104, 38, 2);

  const PW = STAGE_W / PX, near = canvasOf(PW, PH), n = near.getContext('2d');
  // glossy stage floor
  for (let y = 124; y < 168; y++) { const k = (y - 124) / 44; prect(n, `rgb(${Math.round(46 - k * 14)},${Math.round(24 - k * 8)},${Math.round(70 - k * 20)})`, 0, y, PW, 1); }
  for (let x = 0; x < PW; x += 48) { n.fillStyle = 'rgba(255,255,255,.05)'; n.beginPath(); n.moveTo(x, 124); n.lineTo(x + 24, 124); n.lineTo(x + 40, 168); n.lineTo(x + 8, 168); n.fill(); }
  prect(n, '#ff6fb0', 0, 124, PW, 1); prect(n, '#3a2a58', 0, 125, PW, 1);
  prect(n, '#120a1e', 0, 168, PW, 12);
  const foot = [];
  for (let x = 4; x < PW; x += 12) { prect(n, '#3a2a10', x, 169, 6, 2); foot.push(x); }

  const COLS = ['#ff5fa8', '#5fc8ff', '#ffd24a', '#8a6bff', '#5fff9a', '#ff8a3a'];
  let overlayC = null;
  const back = (c, left, t) => {
    // LED screen: title + equalizer, at mid parallax
    const ox = scr.x * PX - left * 0.65, oy = scr.y * PX, w = scr.w * PX, h = scr.h * PX;
    c.save(); c.beginPath(); c.rect(ox, oy, w, h); c.clip();
    const hue = (t * 0.6) % 360; c.fillStyle = `hsl(${hue},70%,14%)`; c.fillRect(ox, oy, w, h);
    for (let i = 0; i < 36; i++) {
      const bh = (0.25 + 0.75 * Math.abs(Math.sin(t / (9 + (i % 5)) + i * 0.7))) * h * 0.55;
      c.fillStyle = `hsl(${(hue + i * 10) % 360},90%,60%)`;
      for (let y = oy + h - 6; y > oy + h - 6 - bh; y -= 6) c.fillRect(ox + 6 + i * (w - 12) / 36, y, (w - 12) / 36 - 3, 4);
    }
    if (!overlayC) {   // title glow + scanlines rendered once
      overlayC = canvasOf(w, h); const o = overlayC.getContext('2d');
      o.font = 'italic 900 40px "Barlow Condensed", "Arial Narrow", sans-serif'; o.textAlign = 'center'; o.textBaseline = 'middle';
      o.fillStyle = '#fff'; o.shadowColor = '#ff5fa8'; o.shadowBlur = 16; o.fillText('WINNING LIVE', w / 2, h * 0.32); o.shadowBlur = 0;
      o.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < h; y += 3) o.fillRect(0, y, w, 1);
    }
    c.drawImage(overlayC, ox, oy);
    c.restore();
    // sweeping spotlights
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const sx = (pars[(i * 3 + 2) % pars.length] * PX - left * 0.65), ang = Math.sin(t / (70 + i * 13) + i * 1.7) * 0.5, len = 520;
      const ex = sx + Math.sin(ang) * len, ey = 24 + Math.cos(ang) * len, sp = 70;
      const g = c.createLinearGradient(sx, 24, ex, ey); const col = COLS[i % COLS.length];
      g.addColorStop(0, col + '55'); g.addColorStop(1, col + '00'); c.fillStyle = g;
      c.beginPath(); c.moveTo(sx - 4, 24); c.lineTo(ex - sp, ey); c.lineTo(ex + sp, ey); c.lineTo(sx + 4, 24); c.fill();
    }
    pars.forEach((x, i) => { const on = Math.sin(t / 8 + i) > -0.2; c.fillStyle = on ? COLS[i % COLS.length] : '#2a2238'; c.fillRect(x * PX - left * 0.65 - 6, 18, 12, 6); });
    c.restore();
  };
  const front = (c, left, t) => {   // footlights, then the crowd in front of the stage with penlights
    foot.forEach((x, i) => { c.fillStyle = (Math.floor(t / 10) + i) % 3 ? '#ffd27a' : '#ff9ad0'; c.fillRect(x * PX - left, 169 * PX, 18, 4); });
    for (let i = 0; i < 46; i++) {
      const bx = ((i * 41 - left * 1.15) % (W + 80) + W + 80) % (W + 80) - 40, by = HGT - 14 + (i % 3) * 5;
      const sway = Math.sin(t / 12 + (i % 6)) * 0.6, col = COLS[(i * 7) % COLS.length];
      c.save(); c.translate(bx + 10, by); c.rotate(sway);
      c.globalCompositeOperation = 'lighter'; c.fillStyle = col + '44'; c.fillRect(-4, -30, 8, 20); c.globalCompositeOperation = 'source-over';
      c.fillStyle = col; c.globalAlpha = 0.75; c.fillRect(-1.5, -28, 3, 18); c.globalAlpha = 1; c.fillStyle = '#c8c8d4'; c.fillRect(-1.5, -10, 3, 6);
      c.restore();
      c.fillStyle = '#07040d'; c.beginPath(); c.arc(bx + 6, by + 8, 13, 0, 7); c.fill(); c.fillRect(bx - 10, by + 14, 34, 20);
    }
  };
  return { far, mid, near, back, front };
}

const STAGE_LIST = [
  { id: 'tokyo', name: 'TOKYO RACECOURSE', sub: 'TURF 2400m · CLEAR SKIES', build: buildTokyo },
  { id: 'tracen', name: 'TRACEN TRAINING TRACK', sub: 'DIRT · SUNSET PRACTICE', build: buildTracen },
  { id: 'nakayama', name: 'NAKAYAMA NIGHTS', sub: 'ARIMA KINEN · WINTER NIGHT', build: buildNakayama },
  { id: 'live', name: 'WINNING LIVE', sub: 'CONCERT STAGE · AFTER THE RACE', build: buildLive },
];
const STAGES = [];
function buildStages() {
  for (const s of STAGE_LIST) STAGES.push(s.build());
  // small previews for the course select
  for (let i = 0; i < STAGES.length; i++) {
    const c = canvasOf(W, HGT), x = c.getContext('2d'), S = STAGES[i], left = STAGE_W / 2 - W / 2;
    x.imageSmoothingEnabled = false;
    x.drawImage(S.far, Math.round(-left * 0.35), 0, S.far.width * PX, HGT);
    x.drawImage(S.mid, Math.round(-left * 0.65), 0, S.mid.width * PX, HGT);
    if (S.back) S.back(x, left, 200);
    x.drawImage(S.near, Math.round(-left), 0, S.near.width * PX, HGT);
    if (S.front) S.front(x, left, 200);
    S.thumb = c;
  }
}
let menuStage = 0;
function stageIndex() { return UI.screen === 'game' || UI.screen === 'replay' ? (G.stage || 0) : menuStage; }
function drawStage(cam, idx = stageIndex()) {
  const S = STAGES[idx] || STAGES[0], left = cam - W / 2;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(S.far, Math.round(-left * 0.35), 0, S.far.width * PX, HGT);
  ctx.drawImage(S.mid, Math.round(-left * 0.65), 0, S.mid.width * PX, HGT);
  if (S.back) S.back(ctx, left, UI.t);
  ctx.drawImage(S.near, Math.round(-left), 0, S.near.width * PX, HGT);
}
function drawStageFront(cam, idx = stageIndex()) {
  const S = STAGES[idx] || STAGES[0];
  if (S.front) S.front(ctx, cam - W / 2, UI.t);
}
