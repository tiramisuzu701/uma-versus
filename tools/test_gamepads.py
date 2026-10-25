import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Controllers: hat-style D-pads (non-standard layouts like the Switch Pro Controller in some browsers) and players
# assigned by the controller they press, so a phantom device in slot 1 doesn't steal Player 1.
from playwright.sync_api import sync_playwright
INIT = r"""
window.__pads = [];
const mk = (index, id, mapping, nb, na) => ({ index, id, mapping, connected: true, buttons: Array.from({ length: nb }, () => ({ pressed: false, value: 0 })), axes: Array.from({ length: na }, () => 0) });
window.__mk = mk;
Object.defineProperty(navigator, 'getGamepads', { value: () => window.__pads, configurable: true });
"""
JS = r"""() => {
  const out = [], errs = [], HAT = { up: -1, upright: -0.7142857, right: -0.4285714, downright: -0.1428571, down: 0.1428571, downleft: 0.4285714, left: 0.7142857, upleft: 1, none: 1.2857143 };
  // slot 0: a phantom virtual pad that never sends anything; slot 1: a Switch Pro Controller, non-standard, D-pad on axis 9
  const phantom = __mk(0, 'Virtual Controller (STANDARD GAMEPAD)', 'standard', 17, 4);
  const pro = __mk(1, 'Pro Controller (Vendor: 057e Product: 2009)', '', 16, 10); pro.axes[9] = HAT.none;
  __pads = [phantom, pro];
  // before the Pro Controller is used, nothing is assigned by use yet
  for (const [d, want] of Object.entries({ up: 'u', right: 'r', down: 'd', left: 'l', upright: 'ur', downleft: 'dl' })) {
    pro.axes[9] = HAT[d]; const o = padInput(0).o;
    const got = ['u', 'd', 'l', 'r'].filter(k => o[k]).join('');
    const exp = want.split('').sort().join(''), g2 = got.split('').sort().join('');
    out.push(`hat ${d}: P1 gets ${got || 'nothing'}`); if (g2 !== exp) errs.push(`hat ${d}: got ${got}, want ${want}`);
  }
  pro.axes[9] = HAT.none; const idle = padInput(0).o; if (idle.u || idle.d || idle.l || idle.r) errs.push('centred hat reads as a direction');
  pro.buttons[0].pressed = true; const b = padInput(0).o; pro.buttons[0].pressed = false;
  out.push(`Pro bottom face button (B) -> ${['L', 'M', 'H', 'S'].filter(k => b[k]).join('') || 'nothing'} on P1`);
  if (!b.S) errs.push('Pro bottom button did not reach Player 1 as Skill (A position)');
  // the phantom never becomes P1, P2 is free for a second real pad
  const p2 = __mk(2, 'Xbox Wireless Controller (STANDARD GAMEPAD)', 'standard', 17, 4); __pads = [phantom, pro, p2];
  p2.buttons[14].pressed = true; const second = padInput(1).o; p2.buttons[14].pressed = false;
  out.push(`second real pad (Xbox, d-pad left) -> P2 ${second.l ? 'moves left' : 'nothing'}`); if (!second.l) errs.push('second pad did not become P2');
  // unplug the Pro: the Xbox pad moves up to P1
  __pads = [phantom, p2]; p2.buttons[15].pressed = true; const after = padInput(0).o; p2.buttons[15].pressed = false;
  out.push(`after unplugging the Pro, Xbox -> P1 ${after.r ? 'moves right' : 'nothing'}`); if (!after.r) errs.push('remaining pad did not move to P1');
  return [out, errs];
}"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 960, 'height': 540}); pe = []; pg.on('pageerror', lambda e: pe.append(str(e)))
    pg.add_init_script(INIT)
    pg.goto('file://' + ROOT + '/index.html'); pg.wait_for_timeout(1500)
    out, errs = pg.evaluate(JS)
    for l in out: print(l)
    # the Controls screen's test readout, with a Pro Controller holding d-pad up-right and B
    pg.evaluate("() => { const pro = __mk(1, 'Pro Controller (Vendor: 057e Product: 2009)', '', 16, 10); pro.axes[9] = -0.7142857; pro.buttons[0].pressed = true; __pads = [__mk(0, 'Virtual Controller (STANDARD GAMEPAD)', 'standard', 17, 4), pro]; UI.screen = 'controls'; }")
    pg.wait_for_timeout(400); pg.screenshot(path='/tmp/claude-0/-home-claude/beead88c-29e2-5633-85fe-f20dc7826420/scratchpad/shots/padtest.png')
    b.close()
print('ERR', errs + pe)
