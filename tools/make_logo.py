"""Render the Uma Versus logo and tab icons (PNG) with the game's display fonts in headless Chromium."""
import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import asyncio, base64, json
from playwright.async_api import async_playwright
F = ROOT+'/vendor/fonts/'
dela = base64.b64encode(open(F + 'dela-gothic-one-latin-400-normal.woff2', 'rb').read()).decode()
PAGE = """<!doctype html><style>@font-face{font-family:Dela;src:url(data:font/woff2;base64,__DELA__)}</style><body style="margin:0;background:#334">
<script>
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// dilate a mask: union of copies on rings -> a solid outline r px wide
function dilate(src, r, color) {
  const c = mk(src.width, src.height), x = c.getContext('2d');
  for (const k of [1, 0.75, 0.5, 0.25]) for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; x.drawImage(src, Math.cos(a) * r * k, Math.sin(a) * r * k); }
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); return c;
}
function paint(mask, fill, opts = {}) {
  // fill + halftone + gloss, clipped to the mask
  const c = mk(mask.width, mask.height), x = c.getContext('2d');
  x.drawImage(mask, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = fill; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'source-atop';
  const [y0, y1] = opts.band || [0, c.height], step = opts.dot || 14;
  for (let y = y0; y < y1; y += step) for (let xx = (y / step % 2) * step / 2; xx < c.width; xx += step) {
    const t = 1 - (y - y0) / (y1 - y0); const r = step * 0.42 * Math.max(0, t - 0.25);
    if (r > 0.6) { x.fillStyle = 'rgba(255,255,255,.32)'; x.beginPath(); x.arc(xx, y, r, 0, 7); x.fill(); }
  }
  const g = x.createLinearGradient(0, y0, 0, y0 + (y1 - y0) * 0.5); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, y0, c.width, (y1 - y0) * 0.42);
  return c;
}
function sticker(mask, fill, o) {
  const c = mk(mask.width, mask.height), x = c.getContext('2d');
  const outer = dilate(mask, o.outer, o.edge), white = dilate(mask, o.inner, '#fff');
  x.globalAlpha = 0.45; x.drawImage(dilate(mask, o.outer, '#2a0a2a'), o.shadow[0], o.shadow[1]); x.globalAlpha = 1;
  x.drawImage(outer, 0, 0); x.drawImage(white, 0, 0); x.drawImage(paint(mask, fill, o), 0, 0);
  return c;
}
// the horseshoe U
function horseshoe(x, cx, top, w, h, th) {
  x.save(); x.lineWidth = th; x.lineCap = 'butt'; x.beginPath();
  const r = (w - th) / 2; x.moveTo(cx - r, top); x.lineTo(cx - r, top + h - r - th / 2); x.arc(cx, top + h - r - th / 2, r, Math.PI, 0, true); x.lineTo(cx + r, top); x.stroke();
  // calkins: flared heel ends
  x.fillRect(cx - r - th / 2 - 8, top - 2, th + 16, th * 0.42); x.fillRect(cx + r - th / 2 - 8, top - 2, th + 16, th * 0.42);
  x.restore();
}
function nails(x, cx, top, w, h, th) {
  const r = (w - th) / 2, cy = top + h - r - th / 2; x.fillStyle = 'rgba(140,30,60,.6)';
  const holes = [[cx - r, top + th * 0.75], [cx - r, top + th * 1.6], [cx + r, top + th * 0.75], [cx + r, top + th * 1.6]];
  for (const a of [Math.PI * 0.78, Math.PI * 0.22]) holes.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  for (const [hx, hy] of holes) { x.beginPath(); x.ellipse(hx, hy, th * 0.075, th * 0.13, 0, 0, 7); x.fill(); }
}
function sparkle(x, cx, cy, s, col) {
  x.save(); x.translate(cx, cy); x.fillStyle = col; x.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? s * 0.22 : s; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  x.closePath(); x.fill(); x.restore();
}
const GOLD = (x, y0, y1) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#ffe94d'); g.addColorStop(0.45, '#ffa02e'); g.addColorStop(1, '#ff4d93'); return g; };

function buildLogo() {
  const W = 1700, H = 760, SK = -0.2;
  // ---- UMA (horseshoe U + MA)
  const m1 = mk(W, H), a = m1.getContext('2d'); a.setTransform(1, 0, SK, 1, 120, 0);
  a.fillStyle = a.strokeStyle = '#000';
  horseshoe(a, 360, 90, 270, 300, 86);
  a.font = '330px Dela'; a.textBaseline = 'alphabetic'; a.fillText('MA', 510, 392);
  const g1 = mk(W, H).getContext('2d'); const fillU = GOLD(g1, 90, 400);
  const uma = sticker(m1, fillU, { outer: 30, inner: 15, edge: '#a3205f', shadow: [10, 14], band: [90, 400], dot: 15 });
  const tmp = uma.getContext('2d'); tmp.setTransform(1, 0, SK, 1, 120, 0); nails(tmp, 360, 90, 270, 300, 86);
  // ---- VERSUS on a slanted ribbon
  const m2 = mk(W, H), b = m2.getContext('2d'); b.setTransform(1, 0, SK, 1, 150, 0);
  b.font = '150px Dela'; b.fillText('VERSUS', 470, 588);
  const tw = b.measureText('VERSUS').width;
  const g2 = mk(W, H).getContext('2d'); const fillV = g2.createLinearGradient(0, 458, 0, 593); fillV.addColorStop(0, '#d9c4ff'); fillV.addColorStop(0.5, '#a77bff'); fillV.addColorStop(1, '#ff6fb1');
  const vs = sticker(m2, fillV, { outer: 22, inner: 11, edge: '#5b2aa6', shadow: [8, 11], band: [458, 593], dot: 11 });
  // ---- compose
  const out = mk(W, H), o = out.getContext('2d');
  // gate-colour speed stripes behind VERSUS
  o.save(); o.setTransform(1, 0, SK, 1, 150, 0);
  ['#ff4f8b', '#f6c343', '#2fae5b', '#4aa8ff', '#ffffff'].forEach((c, i) => { o.fillStyle = '#5b2aa6'; o.fillRect(160 - i * 46 - 6, 452 + i * 30 - 6, 330 + 12, 22 + 12); });
  ['#ff4f8b', '#f6c343', '#2fae5b', '#4aa8ff', '#ffffff'].forEach((c, i) => { o.fillStyle = c; o.fillRect(160 - i * 46, 452 + i * 30, 330, 22); });
  o.restore();
  o.drawImage(vs, 0, 0); o.drawImage(uma, 0, 0);
  sparkle(o, 1290, 120, 46, '#fff'); sparkle(o, 1350, 205, 22, '#ffe94d'); sparkle(o, 205, 455, 30, '#ffd1ea'); sparkle(o, 1395, 470, 34, '#fff'); sparkle(o, 1350, 585, 16, '#d9c4ff');
  return trim(out);
}
function trim(c) {
  const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) if (d[(y * c.width + i) * 4 + 3] > 8) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const p = 6, t = mk(x1 - x0 + 1 + p * 2, y1 - y0 + 1 + p * 2); t.getContext('2d').drawImage(c, -x0 + p, -y0 + p); return t;
}
function buildIcon(S) {
  const k = S / 256, m = mk(S, S), a = m.getContext('2d'); a.fillStyle = a.strokeStyle = '#000';
  a.setTransform(k, 0, -0.12 * k, k, 18 * k, 0); horseshoe(a, 128, 40, 176, 196, 58);
  const g = mk(S, S).getContext('2d'); const ic = sticker(m, GOLD(g, 40 * k, 236 * k), { outer: Math.max(2, 16 * k), inner: Math.max(1, 8 * k), edge: '#a3205f', shadow: [4 * k, 5 * k], band: [40 * k, 236 * k], dot: Math.max(4, 12 * k) });
  const x = ic.getContext('2d'); if (S >= 64) { x.setTransform(k, 0, -0.12 * k, k, 18 * k, 0); nails(x, 128, 40, 176, 196, 58); x.setTransform(1, 0, 0, 1, 0, 0); sparkle(x, S * 0.8, S * 0.2, S * 0.12, '#fff'); }
  return ic;
}
window.go = async () => { await document.fonts.load('100px Dela'); const L = buildLogo();
  return { logo: L.toDataURL('image/png'), w: L.width, h: L.height, icons: [32, 64, 180, 512].map(s => buildIcon(s).toDataURL('image/png')) }; };
</script>""".replace("__DELA__", dela)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.set_content(PAGE); r = await pg.evaluate('go()')
        open(ROOT+'/assets/art/logo.png', 'wb').write(base64.b64decode(r['logo'].split(',')[1]))
        open(ROOT+'/assets/art/icon-512.png', 'wb').write(base64.b64decode(r['icons'][3].split(',')[1]))
        from PIL import Image
        big = Image.open(ROOT+'/assets/art/icon-512.png')
        for s in (32, 64, 180): big.resize((s, s), Image.LANCZOS).save(ROOT+f'/assets/art/icon-{s}.png')   # small icons downscaled from the big one
        print('logo', r['w'], r['h']); await b.close()
asyncio.run(main())
