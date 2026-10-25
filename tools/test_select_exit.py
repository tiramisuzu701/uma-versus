import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Character select: Back with nothing to undo asks before leaving; Stay is the default; Back still undoes a pick first.
from playwright.sync_api import sync_playwright
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 960, 'height': 540})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + ROOT + '/index.html'); pg.wait_for_timeout(1500)
    key = lambda k: (pg.keyboard.press(k), pg.wait_for_timeout(120))
    st = lambda: pg.evaluate("() => [UI.screen, !!UI.selExit, UI.selExitIdx, JSON.stringify(UI.selDone)]")
    for mode in ['versus', 'cpu', 'training']:
        pg.evaluate(f"() => {{ UI.screen = 'select'; UI.pendingMode = '{mode}'; UI.selDone = [false, false]; UI.sel = [0, 1]; UI.selExit = false; }}"); pg.wait_for_timeout(100)
        key('KeyH'); a = st()
        if not (a[0] == 'select' and a[1] and a[2] == 0): errs.append(f'{mode}: back did not open the prompt {a}')
        if mode == 'versus': pg.screenshot(path='/tmp/claude-0/-home-claude/beead88c-29e2-5633-85fe-f20dc7826420/scratchpad/shots/selexit.png')
        key('KeyF'); a = st()
        if not (a[0] == 'select' and not a[1]): errs.append(f'{mode}: confirm on Stay left the screen {a}')
        key('KeyF'); key('KeyH'); a = st()   # pick, then back undoes the pick
        if not (a[0] == 'select' and not a[1] and a[3].startswith('[false')): errs.append(f'{mode}: back did not undo the pick first {a}')
        key('KeyH'); key('KeyD'); key('KeyF'); a = st()
        if a[0] != 'mode': errs.append(f'{mode}: Leave did not go back to the menu {a}')
        pg.evaluate("() => { UI.screen = 'select'; UI.selDone = [false, false]; UI.selExit = false; }"); pg.wait_for_timeout(100)
        key('Escape'); a = st()
        if not a[1]: errs.append(f'{mode}: Esc did not open the prompt {a}')
        key('Escape'); a = st()
        if a[1] or a[0] != 'select': errs.append(f'{mode}: Esc in the prompt did not stay {a}')
        print(mode, 'ok' if not errs else errs[-1])
    b.close()
print('ERR', errs)
