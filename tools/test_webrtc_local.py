import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Real WebRTC match through a local PeerJS server : checks the match channel is
# fire-and-forget (unordered, no retransmits), the lobby works over it, and a bot match stays in sync.
# Needs the `peer` npm package (npm i peer@1.0.2 in some folder); pass that folder. The script starts the server on 127.0.0.1:9000.
import asyncio, subprocess, sys, os, time
from playwright.async_api import async_playwright
SRV = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~')   # folder with node_modules/peer
JS_SRV = "const { ExpressPeerServer } = require('peer'); const app = require('express')(); const s = require('http').createServer(app); app.use('/', ExpressPeerServer(s, { path: '/' })); s.listen(9000, '127.0.0.1');"
LOCAL = "() => { Object.assign(PEER_OPTS, { host: '127.0.0.1', port: 9000, path: '/', secure: false, key: 'peerjs', config: { iceServers: [] } }); }"
BOT = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test_online.py')).read().split('BOT = """', 1)[1].split('"""', 1)[0]
async def main():
    srv = subprocess.Popen(['node', '-e', JS_SRV], cwd=SRV, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(2)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'])
            ctx = await b.new_context(viewport={'width': 960, 'height': 540}); A = await ctx.new_page(); B = await ctx.new_page(); errs = []; ok = n = 0
            for nm, pg in (('A', A), ('B', B)):
                pg.on('pageerror', lambda e, nm=nm: errs.append(nm + ': ' + str(e)))
                await pg.goto('file://' + ROOT + '/index.html'); await pg.wait_for_timeout(800)
                await pg.evaluate(LOCAL); await pg.evaluate("() => { UI.screen = 'online'; showNetPanel(); }")
            await A.click('#netHost'); await A.wait_for_timeout(1500)
            code = await A.evaluate("() => Net.code"); await B.fill('#netCodeIn', code); await B.click('#netJoin')
            for _ in range(40):
                await B.wait_for_timeout(250)
                if await A.evaluate("() => Net.connected") and await B.evaluate("() => Net.connected"): break
            ch = await B.evaluate("() => { const d = Net.conn && Net.conn.dataChannel; return d ? [d.ordered, d.maxRetransmits] : null; }")
            good = ch == [False, 0]; ok += good; n += 1; print('OK ' if good else 'BAD', 'match channel unordered with no retransmits', ch)
            st = [await A.evaluate("() => UI.screen + ' ' + Net.connected"), await B.evaluate("() => UI.screen + ' ' + Net.connected")]
            good = st == ['netselect true'] * 2; ok += good; n += 1; print('OK ' if good else 'BAD', 'both in the match lobby', st)
            await A.evaluate("() => { Net.myPick = 2; }"); await B.evaluate("() => { Net.myPick = 10; }")
            await A.keyboard.press('Enter'); await B.keyboard.press('Enter'); await A.wait_for_timeout(2000)
            await A.evaluate("() => (" + BOT + ")(0)"); await B.evaluate("() => (" + BOT + ")(1)")
            await A.wait_for_timeout(15000)
            sa = await A.evaluate("() => ({ mode: G.mode, F: Net.F, desync: Net.desync, ping: Math.round(Net.ping), stalls: Net.stalls })")
            sb = await B.evaluate("() => ({ mode: G.mode, F: Net.F, desync: Net.desync })")
            good = sa['mode'] == 'online' and sa['F'] > 300 and sa['desync'] < 0 and sb['desync'] < 0; ok += good; n += 1
            print('OK ' if good else 'BAD', '15 s bot match over WebRTC, in sync', sa, sb)
            await A.evaluate("() => { Net.menu = true; }"); await A.keyboard.press('Enter'); await A.wait_for_timeout(1500)
            sb = await B.evaluate("() => [UI.screen, Net.connected, Net.status]")
            good = sb[0] == 'online' and not sb[1]; ok += good; n += 1; print('OK ' if good else 'BAD', 'leaving tells the other player', sb)
            print(f'{ok}/{n}', 'ERR', errs); await b.close()
    finally: srv.terminate()
asyncio.run(main())
