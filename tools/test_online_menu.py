import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Online menu responsiveness:
#  1. Drawing a runner in a colour nobody has used yet (online lobby, select screens, faces) recolours just the
#     frame being drawn instead of the whole sprite sheet, so scrolling runners/colours never stalls a frame.
#  3. Rooms show the host's region; rooms in your region are listed first; the host picks a region each time.
#  2. Hosting retries when the signalling server is slow (no answer in 8 s) or the code is taken, gives up with a
#     message after 4 tries, and reconnects if the signalling connection drops.
import asyncio, sys
from playwright.async_api import async_playwright
FAKE = r"""() => {
  window.__peers = [];
  window.Peer = class { constructor(id) { this.id = id; this.h = {}; this.open = false; this.destroyed = false; this.recon = 0; __peers.push(this);
      const mode = (window.__mode || [])[__peers.length - 1] || 'never'; if (mode === 'open') setTimeout(() => { this.open = true; this.emit('open'); }, 50);
      if (mode === 'taken') setTimeout(() => this.emit('error', { type: 'unavailable-id' }), 50); }
    on(e, f) { (this.h[e] = this.h[e] || []).push(f); return this; } emit(e, a) { for (const f of this.h[e] || []) f(a); }
    destroy() { this.emit('disconnected'); this.destroyed = true; } reconnect() { this.recon++; } };
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.clock.install()
        await pg.goto('file://' + (sys.argv[1] if len(sys.argv) > 1 else ROOT+'/build/uma-versus.html'))
        await pg.clock.run_for(6000); ok = n = 0
        # 1. first-time draws of every runner in every colour
        r = await pg.evaluate("""() => { let worst = 0, who = ''; for (const cid of ROSTER) for (let pal = 1; pal < PALETTES.length; pal++) {
            const t = performance.now(); drawSpr(cid, pal, '800', 0, 300, 400, pal % 2 ? 1 : -1, 4); faceOf(cid, pal, false); const d = performance.now() - t;
            if (d > worst) { worst = d; who = cid + ' colour ' + pal; } } return [Math.round(worst * 10) / 10, who]; }""")
        good = r[0] < 12; ok += good; n += 1; print('OK ' if good else 'BAD', f'slowest first draw of a runner in a new colour: {r[0]} ms ({r[1]})')
        # 2. hosting against a fake signalling server
        await pg.evaluate(FAKE)
        async def host(modes, wait):
            await pg.evaluate(f"() => {{ __peers.length = 0; window.__mode = {modes}; UI.screen = 'online'; showNetPanel(); netHost(false); }}")
            await pg.clock.run_for(wait)
            return await pg.evaluate("() => ({ status: Net.status, peers: __peers.length, code: Net.code, open: !!(Net.peer && Net.peer.open), recon: __peers.reduce((a, q) => a + q.recon, 0) })")
        r = await host("['never', 'open']", 9000); good = r['open'] and r['peers'] == 2 and r['recon'] == 0 and 'Room code' in r['status']; ok += good; n += 1
        print('OK ' if good else 'BAD', 'slow server: retried after 8 s and opened', r)
        r = await host("['taken', 'taken', 'open']", 1000); good = r['open'] and r['peers'] == 3; ok += good; n += 1
        print('OK ' if good else 'BAD', 'code taken twice: new codes until one opens', r)
        r = await host("[]", 40000); good = not r['open'] and r['peers'] == 4 and "Couldn't reach" in r['status']; ok += good; n += 1
        print('OK ' if good else 'BAD', 'server never answers: gives up after 4 tries', r)
        r = await host("['open']", 500); await pg.evaluate("() => Net.peer.emit('disconnected')"); r2 = await pg.evaluate("() => Net.peer.recon")
        good = r['open'] and r2 == 1; ok += good; n += 1; print('OK ' if good else 'BAD', 'signalling dropped: reconnects', r2)
        await pg.evaluate("() => netClose(true)"); r3 = await pg.evaluate("() => __peers[__peers.length - 1].recon")
        good = r3 == 1; ok += good; n += 1; print('OK ' if good else 'BAD', 'closing the room does not reconnect it', r3)
        # 3. regions
        r = await pg.evaluate("""() => { localStorage.setItem('umavs.region', 'eu'); Net.role = null;
          renderRooms([{ code: 'AAAAA', host_name: 'Ann', build: BUILD, status: 'open', region: 'nae' }, { code: 'BBBBB', host_name: 'Ben', build: BUILD, status: 'open', region: 'eu' },
                       { code: 'CCCCC', host_name: 'Cy', build: BUILD, status: 'open' }, { code: 'DDDDD', host_name: 'Di', build: BUILD, status: 'open', region: 'eu' }]);
          return [...document.querySelectorAll('#netRooms .room')].map(x => x.querySelector('.rc').textContent + ':' + x.querySelector('.rg').textContent); }""")
        good = r == ['BBBBB:Europe', 'DDDDD:Europe', 'AAAAA:NA East', 'CCCCC:Region ?']; ok += good; n += 1; print('OK ' if good else 'BAD', 'room list: region tags, your region first', r)
        r = await pg.evaluate("""async () => { const calls = []; ACCT.client = { rpc: (fn, a) => { calls.push(a.p_region === undefined ? 'old' : 'new:' + a.p_region);
              return Promise.resolve(a.p_region === undefined ? { data: true } : { error: { code: 'PGRST202' } }); } };
          Net.regionRpc = undefined; Net.role = 'host'; Net.code = 'ZZZZZ'; Net.listed = true; Net.region = 'as'; roomBeat(true);
          await new Promise(r => setTimeout(r, 50)); roomBeat(false); await new Promise(r => setTimeout(r, 50)); ACCT.client = null; return calls; }""")
        good = r == ['new:as', 'old', 'old']; ok += good; n += 1; print('OK ' if good else 'BAD', 'before the SQL is run: falls back to the old room_open', r)
        r = await pg.evaluate("""() => { netClose(true); Net.role = null; hideNetPanel(); const s = document.getElementById('netRegion'); s.value = 'oc'; s.dispatchEvent(new Event('change'));
          const before = [Net.region, localStorage.getItem('umavs.region')]; hideNetPanel(); showNetPanel(); return [...before, Net.region, s.value]; }""")
        good = r == ['oc', 'oc', '', '']; ok += good; n += 1; print('OK ' if good else 'BAD', 'region resets each time you open Online (remembered only for sorting)', r)
        await pg.clock.run_for(100)
        print(f'{ok}/{n}', 'ERR', errs); await b.close()
asyncio.run(main())
