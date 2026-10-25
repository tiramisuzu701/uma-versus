import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Update 2 logo: the Uma Versus logo with "BEGINNING OF A NEW ERA" under it, in the game's own condensed italic,
# a green-to-blue gradient with a white outline. Writes game/art/logo-era.png.
import base64, os
from playwright.sync_api import sync_playwright
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = ROOT+'/vendor/fonts/barlow-condensed-latin-900-italic.woff2'
logo = base64.b64encode(open(ROOT+'/assets/art/logo.png', 'rb').read()).decode()
font = base64.b64encode(open(FONT, 'rb').read()).decode()
PAGE = """<!doctype html><style>@font-face{font-family:BC;font-style:italic;font-weight:900;src:url(data:font/woff2;base64,__F__)}body{margin:0;background:transparent}</style>
<canvas id=c></canvas><script>
window.go = async () => {
  await document.fonts.load('italic 900 100px BC');
  const img = new Image(); img.src = 'data:image/png;base64,__L__'; await img.decode();
  const text = 'BEGINNING OF A NEW ERA', fs = 150, pad = 40;
  const c = document.getElementById('c'), x = c.getContext('2d');
  x.font = `italic 900 ${fs}px BC`; const tw = x.measureText(text).width;
  const W = Math.max(img.width, Math.ceil(tw * 1.12) + pad * 2), Hh = img.height + fs + 20;
  c.width = W; c.height = Hh;
  x.drawImage(img, (W - img.width) / 2, 0);
  const cx = W / 2, cy = img.height + fs * 0.42;
  // the subtitle on its own layer, plus a mask of just its white-outlined letters (no dark edge)
  const layer = document.createElement('canvas'), mask = document.createElement('canvas');
  layer.width = mask.width = W; layer.height = mask.height = Hh;
  const L = layer.getContext('2d'), M = mask.getContext('2d');
  const shape = (g, fn) => { g.save(); g.translate(cx, cy); g.transform(1, 0, -0.12, 1, 0, 0); g.font = `italic 900 ${fs}px BC`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; fn(g); g.restore(); };
  shape(L, g => {
    g.lineWidth = 34; g.strokeStyle = '#1d2a6b'; g.strokeText(text, 6, 8);   // dark edge, then a thick white outline, then the gradient fill
    g.lineWidth = 26; g.strokeStyle = '#ffffff'; g.strokeText(text, 0, 0);
    const gr = g.createLinearGradient(-tw / 2, 0, tw / 2, 0);
    gr.addColorStop(0, '#5fdc4e'); gr.addColorStop(0.35, '#1fc6b6'); gr.addColorStop(0.65, '#2a9de0'); gr.addColorStop(1, '#2b56b8');
    g.fillStyle = gr; g.fillText(text, 0, 0);
  });
  shape(M, g => { g.lineWidth = 26; g.strokeStyle = '#fff'; g.strokeText(text, 0, 0); g.fillStyle = '#fff'; g.fillText(text, 0, 0); });
  // the holes inside letters (B, R, A, O...) = not part of a letter and not reachable from the edge
  const md = M.getImageData(0, 0, W, Hh).data, out = new Uint8Array(W * Hh), q = [];
  const open = i => md[i * 4 + 3] < 128;
  for (let x0 = 0; x0 < W; x0++) for (const y0 of [0, Hh - 1]) { const i = y0 * W + x0; if (open(i) && !out[i]) { out[i] = 1; q.push(i); } }
  for (let y0 = 0; y0 < Hh; y0++) for (const x0 of [0, W - 1]) { const i = y0 * W + x0; if (open(i) && !out[i]) { out[i] = 1; q.push(i); } }
  while (q.length) { const i = q.pop(), x1 = i % W, y1 = (i / W) | 0;
    for (const j of [x1 > 0 ? i - 1 : -1, x1 < W - 1 ? i + 1 : -1, y1 > 0 ? i - W : -1, y1 < Hh - 1 ? i + W : -1]) if (j >= 0 && !out[j] && open(j)) { out[j] = 1; q.push(j); } }
  // fill each hole solid with the outline's white, reaching a few pixels past its edge so no dark seam is left
  const hole = new Uint8Array(W * Hh);
  for (let i = 0; i < W * Hh; i++) if (open(i) && !out[i]) hole[i] = 1;
  const ld = L.getImageData(0, 0, W, Hh), R = 3;
  for (let i = 0; i < W * Hh; i++) {
    if (!hole[i]) continue;
    const x1 = i % W, y1 = (i / W) | 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const xx = x1 + dx, yy = y1 + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= Hh || dx * dx + dy * dy > R * R) continue;
      const j = yy * W + xx, a = md[j * 4 + 3];
      if (hole[j] || a < 250) { const k = j * 4; ld.data[k] = 255; ld.data[k + 1] = 255; ld.data[k + 2] = 255; ld.data[k + 3] = 255; }
    }
  }
  L.putImageData(ld, 0, 0);
  x.drawImage(layer, 0, 0);
  return c.toDataURL('image/png');
};
</script>""".replace('__F__', font).replace('__L__', logo)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.set_content(PAGE)
    url = pg.evaluate('go()'); b.close()
out = ROOT+'/assets/art/logo-era.png'
open(out, 'wb').write(base64.b64decode(url.split(',')[1]))
from PIL import Image
im = Image.open(out); bb = im.getbbox(); im.crop(bb).save(out, optimize=True); print('wrote', out, Image.open(out).size)
