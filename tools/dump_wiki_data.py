import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright
JS = r"""() => {
  const N = () => ({...NEUTRAL});
  const measure = (cid, id, block) => {
    for (const dist of [80, 110, 150, 210, 300, 420]) {
      startMatch('training', cid, 'spe'); G.training.meter = false;
      const [a, d] = G.p; a.x = 800; d.x = 800 + dist; a.meter = 100;
      startMove(a, id, true); let res = null;
      for (let f = 0; f < 260; f++) { step([N(), block ? {...N(), r: 1, d: (CHARS[cid].moves[id].hits || []).some(h => h.guard === 'low') || (CHARS[cid].moves[id].proj && CHARS[cid].moves[id].proj.hit.guard === 'low') ? 1 : 0} : N()]);
        if (G.adv && G.adv.val !== null && res === null) res = G.adv.val; }
      const hit = block ? d.state : null;
      if (res !== null) return res;
    }
    return null;
  };
  // real damage of a super landing as a fresh hit (with scaling), measured in the game
  const superDmg = (cid) => {
    startMatch('training', cid, 'spe'); G.training.meter = false;
    const [a, d] = G.p; a.x = 800; d.x = 900; a.meter = 100; startMove(a, 'SU', true); let lost = 0, hp = d.hp;
    for (let f = 0; f < 320; f++) { step([N(), N()]); if (d.hp < hp) lost += hp - d.hp; hp = d.hp; }
    return lost;
  };
  const out = {};
  for (const cid of ROSTER) {
    const c = CHARS[cid], moves = [];
    for (const [id, m] of Object.entries(c.moves)) {
      if (['GC', 'taunt', 'SU'].includes(id) && id !== 'SU') {}
      const hits = m.hits || [], ph = m.proj ? [m.proj.hit] : [], sh = (m.shots || []).map(q => q.hit), allHits = [...hits, ...ph, ...sh];
      const evFrames = m.ev ? Object.keys(m.ev).map(Number) : [];
      const startup = hits.length ? Math.min(...hits.map(h => h.f[0])) : (m.grab ? m.grab[0] : ((m.proj || m.shots) && evFrames.length ? Math.min(...evFrames) : null));
      const lastActive = hits.length ? Math.max(...hits.map(h => h.f[1])) : (m.grab ? m.grab[1] : null);
      let dmg = hits.reduce((s, h) => s + h.dmg, 0) + ph.reduce((s, h) => s + h.dmg * (m.proj.hits || 1), 0) + (m.proj2 ? m.proj2.hit.dmg : 0) + (m.throwDmg || 0) + sh.reduce((s, h) => s + h.dmg, 0);
      if (m.cine) dmg = m.cine.reduce((s, st) => s + (st[3] || 0), 0) + hits.reduce((s, h) => s + h.dmg, 0);
      dmg = Math.round(dmg * (c.dmgMul || 1));
      if (m.kind === 'super') dmg = superDmg(cid);   // supers: what actually lands on a fresh hit
      const guards = [...new Set(allHits.map(h => h.guard))];
      const ground = !m.air && m.kind !== 'taunt';
      moves.push({ id, name: m.name || null, kind: m.kind, motion: m.motion || null, input: m.input || null, note: m.note || null, vnote: m.vnote || null, fnote: m.fnote || null,
        exNote: m.ex ? m.ex.note : null, isEx: !!m.isEx, varOf: m.varOf || null, exOf: m.exOf || null, followOf: m.followOf || null,
        startup, active: lastActive && startup ? lastActive - startup + 1 : null, total: m.total, dmg, guard: guards.join('/') || (m.grab ? 'throw' : ''),
        inv: m.inv || null, counter: m.counter ? m.counter.f : null, projInv: m.projInv || null, armor: m.armor ? (m.armorHits || 1) : 0, hard: allHits.some(h => h.hard), kd: allHits.some(h => h.kd),
        onHit: ground && (hits.length || m.proj) && !m.cine ? measure(cid, id, false) : null, shots: m.shots ? m.shots.length : 0,
        onBlock: ground && (hits.length || m.proj) && !m.cine ? measure(cid, id, true) : null });
    }
    out[cid] = { name: c.name, arch: c.arch, color: c.color, blurb: c.blurb, hp: c.hp, walk: c.walk, back: c.back, dash: c.dash, jumpV: c.jumpV,
      flags: { airDash: !!c.airDash, lightChain: !!c.lightChain, dashCancel: !!c.dashCancel, projMax: c.projMax || 1, dmgMul: c.dmgMul || 1, punisher: !!c.punisher, specialChain: !!c.specialChain, lowHpBoost: !!c.lowHpBoost },
      backdash: c.backdash || null, combos: c.combos, moves };
  }
  return JSON.stringify({ build: BUILD, chars: out });
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/index.html'); await pg.wait_for_timeout(800)
        await pg.evaluate("() => { tick = () => {}; render = () => {}; }")
        data = await pg.evaluate(JS)
        open(ROOT+'/build/wiki/wiki_data.json','w').write(data)
        await pg.evaluate(open(ROOT+'/tools/test_all.py').read().split('LIB = r"""')[1].split('"""')[0] + "\n;0")
        combos = await pg.evaluate("() => { const o = {}; for (const cid of ROSTER) o[cid] = trialsFor(cid).map(cb => ({ ...cb, ...T.runCombo(cid, cb.seq, 'spe', cb.corner ? 1650 : undefined) })); return JSON.stringify(o); }")
        open(ROOT+'/build/wiki/wiki_combos.json','w').write(combos)
        print('ERR', errs); await b.close()
asyncio.run(main())
