import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# For every move: the sprite frame shown on its first active frame, plus the hitboxes and hurtbox
# at that moment (relative to the fighter's feet, facing right). Used to draw the wiki's move cards.
import asyncio, json
from playwright.async_api import async_playwright
JS = r"""() => {
  const N = () => ({...NEUTRAL}), out = {};
  const rel = (p, r) => r && [Math.round(r.x - p.x), Math.round(r.y - GY), Math.round(r.w), Math.round(r.h)];
  for (const cid of ROSTER) {
    const c = CHARS[cid]; out[cid] = { idle: ['800', SPR[cid].anims['800'][1]], win: [c.win, SPR[cid].anims[c.win][1]], moves: {} };
    for (const [id, m] of Object.entries(c.moves)) {
      if (id === 'taunt') continue;
      startMatch('training', cid, 'spe'); G.training.meter = false;
      const [a, d] = G.p; a.x = 900; a.facing = 1; d.x = 1700; a.meter = 100;
      if (m.air) { a.setState('air'); a.y = GY - 120; }
      startMove(a, id, true); G.freeze = 0;
      const evs = Object.keys(m.ev || {}).map(Number);
      const key = m.hits ? m.first : m.grab ? m.grab[0] : m.counter ? Math.round((m.counter.f[0] + m.counter.f[1]) / 2) : m.reflect ? m.reflect.f[0] + 2 : evs.length ? Math.min(...evs) + 3 : Math.min(8, m.total - 1);
      let guard = 0;
      while (a.state === 'attack' && a.t < key && guard++ < 300) { step([N(), N()]); G.freeze = 0; }
      if (a.state !== 'attack') { startMove(a, id, true); }
      // Cafe: show the moment the Friend's first hit comes out instead
      let pup = null;
      if (m.pup) {
        const t0 = Math.min(...m.pup.hits.map(h => h.f[0]));
        let g = 0; while (!(a.pupState === 'act' && a.pupT >= t0) && g++ < 300) { step([N(), N()]); G.freeze = 0; }
        const pm = pupMoveOf(a), [pa, pf] = pm ? seqFrame(pm, a.pupT) : ['800', 0];
        pup = { anim: pa, fi: pf, x: Math.round(a.pupX - a.x), y: Math.round(a.pupY - GY), hits: pm ? pm.hits.filter(h => a.pupT >= h.f[0] && a.pupT <= h.f[1]).map(h => rel(a, pupRect(a, h.box))) : [] };
      }
      a.facing = 1;
      const hits = (m.hits || []).filter(h => a.t >= h.f[0] && a.t <= h.f[1]).map(h => rel(a, rect(a, h.box)));
      const grab = m.grab ? [[0, -130, m.range, 130]] : [];
      const refl = m.reflect ? [rel(a, rect(a, m.reflect.box))] : [];
      const projs = G.projs.filter(q => q.owner === 0).map(q => [Math.round(q.x - a.x + q.box[0]), Math.round(q.y - GY + q.box[1]), q.box[2], q.box[3], q.style]);
      const inv = invulnerable(a, false), hb = inv ? null : rel(a, hurtbox(a));
      const [anim, fi] = frameOf(a);
      out[cid].moves[id] = { pup, anim, fi, y: Math.round(a.y - GY), t: a.t, hits, grab: m.grab ? grab : [], refl, projs, hurt: hb, inv, counter: !!m.counter, aaInv: m.aaInv || null, armor: m.armor || null, armorHits: m.armorHits || (m.armor ? 1 : 0), projInv: m.projInv || null, cw: m.counter ? m.counter.f : null, cproj: !!(m.counter && m.counter.proj), air: !!m.air, crouch: !!m.crouch };
    }
  }
  return JSON.stringify(out);
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/build/uma-versus.html', wait_until='domcontentloaded', timeout=120000); await pg.wait_for_timeout(3000)
        await pg.evaluate("() => { tick = () => {}; render = () => {}; }")
        open(ROOT+'/build/wiki/wiki_frames.json','w').write(await pg.evaluate(JS))
        print('ERR', errs); await b.close()
asyncio.run(main())
