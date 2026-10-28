import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# The sign-in and online panels can't freeze or trap the player:
#  1. supabase-js's cross-tab auth lock: if another tab holds it, auth calls go ahead after 4 s instead of waiting forever.
#  2. a sign-in request that never answers gives up after 20 s with a message, and the button works again.
#  3. a gamepad can move around the form, and B always backs out (even with the cursor in the email box).
#  4. while a panel covers the screen, the canvas behind it is redrawn ~10 times a second instead of 60.
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/build/uma-versus.html'); await pg.wait_for_timeout(2500); ok = n = 0
        r = await pg.evaluate("""async () => { const c = []; const real = render; render = () => { c.push(UI.screen); real(); };
          UI.screen = 'mode'; await new Promise(r => setTimeout(r, 1000)); const menu = c.length; c.length = 0;
          UI.screen = 'online'; showNetPanel(); await new Promise(r => setTimeout(r, 1000)); const online = c.length;
          hideNetPanel(); UI.screen = 'mode'; render = real; return [menu, online]; }""")
        good = r[1] <= 12 and r[0] >= 3 * r[1]; ok += good; n += 1; print('OK ' if good else 'BAD', 'redraws per second: menu vs behind the Online panel', r)
        r = await pg.evaluate("""async () => { if (!ACCT.client) return 'no client';
          navigator.locks.request('lock:umavs.auth', () => new Promise(() => {}));   // a stuck tab holding the auth lock forever
          await new Promise(r => setTimeout(r, 50)); const t = performance.now();
          await ACCT.client.auth.getSession(); return Math.round(performance.now() - t); }""")
        good = isinstance(r, int) and 3500 < r < 8000; ok += good; n += 1; print('OK ' if good else 'BAD', 'auth lock held by another tab: went ahead after', r, 'ms')
        await pg.clock.install()
        r = await pg.evaluate("""async () => { acctOpen(); window.__real = ACCT.client.auth.signInWithPassword;
          ACCT.client.auth.signInWithPassword = () => new Promise(() => {});   // the request never comes back
          document.getElementById('acEmail').value = 'a@b.c'; document.getElementById('acPass').value = 'secret1'; document.getElementById('acGo').click();
          await Promise.resolve(); return [ACCT.busy, document.getElementById('acGo').disabled]; }""")
        await pg.clock.run_for(21000)
        r2 = await pg.evaluate("() => { ACCT.client.auth.signInWithPassword = window.__real; return [ACCT.busy, document.getElementById('acGo').disabled, document.getElementById('acStatus').textContent]; }")
        good = r == [True, True] and r2[0] is False and r2[1] is False and "didn't answer" in r2[2]; ok += good; n += 1; print('OK ' if good else 'BAD', 'stalled sign-in gives up', r, r2)
        r = await pg.evaluate("""() => { acctOpen(); document.getElementById('acEmail').focus();
          const pe = (o) => ({ ...NEUTRAL, ...o }), tick = o => acctScreenTick(pe({}), false, false, pe(o));
          tick({ d: 1 }); tick({ d: 1 }); const at = document.querySelector('#acct .padfocus'); const focusName = at && (at.id || at.textContent);
          tick({ H: 1 }); return [focusName, UI.screen, document.getElementById('acct').classList.contains('hidden')]; }""")
        good = bool(r[0]) and r[1] == 'mode' and r[2]; ok += good; n += 1; print('OK ' if good else 'BAD', 'gamepad: moves around the form, B leaves with the email box focused', r)
        print(f'{ok}/{n}', 'ERR', errs); await b.close()
asyncio.run(main())
