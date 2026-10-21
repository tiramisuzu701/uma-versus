"""Random key presses through every menu screen (and into matches), rendering every frame, watching for errors."""
import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import asyncio, sys
from playwright.async_api import async_playwright
JS = r"""async (n) => {
  let s = 99; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const K = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyF','KeyF','Enter','KeyH','Escape','KeyG','KeyT','KeyY','KeyW','KeyS','KeyA','KeyD',
             'Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','KeyJ','KeyK','Backspace'];
  const visits = {}, errs = []; let longest = { scr: '', n: 0 }, cur = '', curN = 0;
  window.onerror = (m) => errs.push(String(m));
  for (let i = 0; i < n; i++) {
    let k = K[Math.floor(R() * K.length)];
    if (UI.screen === 'online' || UI.screen === 'netselect') k = 'Escape';            // no network in the test
    if (UI.screen === 'game' && curN > 60 && R() < 0.3) k = 'Escape';                // pause, and eventually quit, matches
    if (k === 'KeyD' && UI.screen === 'results') k = 'KeyF';                           // don't download replay files
    dispatchEvent(new KeyboardEvent('keydown', { code: k })); 
    const hold = 1 + Math.floor(R() * 6);
    for (let t = 0; t < hold; t++) { try { tick(); render(); } catch (e) { errs.push(UI.screen + ': ' + e.message + ' ' + (e.stack || '').split('\n')[1]); } }
    dispatchEvent(new KeyboardEvent('keyup', { code: k }));
    try { tick(); render(); } catch (e) { errs.push(UI.screen + ': ' + e.message); }
    // let matches play out a bit (CPU drives P2; P1 is the masher)
    visits[UI.screen] = (visits[UI.screen] || 0) + 1;
    if (UI.screen === cur) { if (++curN > longest.n) longest = { scr: cur, n: curN }; } else { cur = UI.screen; curN = 0; }
    if (errs.length > 20) break;
  }
  return { visits, errs: [...new Set(errs)].slice(0, 20), longest };
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); pg = await b.new_page(viewport={'width': 960, 'height': 540})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/index.html'); await pg.wait_for_timeout(1500)
        await pg.evaluate("() => { window.__loop = loop; loop = () => {}; requestAnimationFrame = () => 0; }")
        r = await pg.evaluate(JS, int(sys.argv[1]) if len(sys.argv) > 1 else 20000)
        print(r); print('PAGE ERR', errs[:8]); await b.close()
asyncio.run(main())
