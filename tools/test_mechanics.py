import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import asyncio
from playwright.async_api import async_playwright
from test_combos import LIB
TESTS = r"""() => {
  const out = [], N = T.N, R = (k, v) => out.push(k + ': ' + (typeof v === 'string' ? v : JSON.stringify(v)));
  const run = (n, f) => { for (let i = 0; i < n; i++) f(i); };
  // McQueen counter vs a strike: Spe 5M into Noble Parry
  const parry = (id, atk, setup) => { startMatch('training', 'mm', 'spe'); const [a, d] = G.p; a.x = 900; d.x = 1000; a.meter = 100; G.training.meter = false; setup && setup(a, d);
    startMove(a, id, true); let res = [], st = new Set(), dmg = 0;
    run(120, f => { if (f === 4 && atk) atk(d); step([N(), N()]); if (a.state === 'attack' && a.move.followOf && !res.includes(a.move.id)) res.push(a.move.id);
      if (['hit', 'airHit', 'thrown'].includes(a.state)) st.add('McQ ' + a.state); if (d.combo > 0) dmg = d.comboDmg; if (G.texts.some(t => t.txt === 'PARRY')) st.add('PARRY'); });
    return (res.join(',') || 'no riposte') + ' | riposte dmg ' + dmg + ' | ' + ([...st].join(',') || 'McQ untouched'); };
  R('Parry vs 5M', parry('2S', d => startMove(d, '5M')));
  R('Parry vs 2L (low)', parry('2S', d => startMove(d, '2L')));
  R('Parry vs throw', parry('2S', d => startMove(d, 'throw'), (a, d) => { d.x = 970; }));
  R('Parry M vs fireball', parry('2S', null, (a, d) => { d.x = 1200; startMove(d, '5S', true); run(24, () => step([N(), N()])); }));
  R('Parry EX vs fireball', parry('2SX', null, (a, d) => { d.x = 1200; startMove(d, '5S', true); run(24, () => step([N(), N()])); }));
  R('Parry vs jump-in j.H', parry('2S', null, (a, d) => { d.x = 990; d.setState('air'); d.y = GY - 90; d.vy = 2; d.vx = -2; startMove(d, 'jH'); }));
  // Punish bonus: McQueen 5M on a whiffed DP vs on a walking opponent
  const pun = (whiff) => { startMatch('training', 'mm', 'spe'); const [a, d] = G.p; a.x = 900; d.x = 1010; G.training.meter = false;
    if (whiff) { startMove(d, '4S', true); run(20, () => step([N(), N()])); }
    startMove(a, '5M'); let dmg = 0, txt = ''; run(30, () => { step([N(), N()]); if (G.dmgInfo) dmg = G.dmgInfo.last; if (G.texts.some(t => t.txt === 'PUNISH!')) txt = ' PUNISH!'; }); return dmg + txt; };
  R('McQ 5M dmg on neutral opponent', pun(false)); R('McQ 5M dmg on whiffed DP recovery', pun(true));
  // EX lance / EX stride through a fireball
  for (const id of ['5SX', '6SX', '5S']) R('McQ ' + id + ' vs incoming fireball', (() => { startMatch('training', 'mm', 'spe'); const [a, d] = G.p; a.x = 900; d.x = 1150; a.meter = 100; startMove(d, '5S', true);
    let r = ''; run(80, f => { if (f === 16) startMove(a, id, true); step([N(), N()]); if (['hit', 'airHit'].includes(a.state) && !r) r = 'McQ HIT by fireball'; if (['hit', 'airHit'].includes(d.state) && !r) r = 'went through, hit Spe'; }); return r || 'nothing'; })());
  // Teio special chain
  const chain = seq => T.runCombo('tt', seq);
  for (const s of ['236M 214M', '236M 214M 623M', '236M 236M', '214M 623M 41236M']) { const r = chain(s); R('Teio chain "' + s + '"', (r.ok ? 'OK ' : 'no ') + r.hits + ' hits ' + r.dmg + ' dmg ' + r.done); }
  R('Teio 5M dmg full hp / 25% hp', (() => { const v = []; for (const hp of [8000, 2000]) { startMatch('training', 'tt', 'spe'); const [a, d] = G.p; a.x = 900; d.x = 1000; a.hp = hp; G.training.meter = false; startMove(a, '5M'); run(20, () => step([N(), N()])); v.push(G.dmgInfo.last); } return v.join(' / '); })());
  // Kitasan
  R('Kitasan DP vs meaty 5H (invincible)', (() => { startMatch('training', 'kb', 'gs'); const [a, d] = G.p; a.x = 900; d.x = 990; startMove(d, '5H'); run(8, () => step([N(), N()])); startMove(a, '4S', true);
    let r = ''; run(40, () => { step([N(), N()]); if (['hit', 'airHit'].includes(a.state) && !r) r = 'Kitasan got hit'; if (['hit', 'airHit'].includes(d.state) && !r) r = 'DP won'; }); return r; })());
  R('Kitasan air whirlwind from jump', (() => { startMatch('training', 'kb', 'spe'); const [a, d] = G.p; a.x = 850; d.x = 990; a.setState('air'); a.y = GY - 120; a.vy = -2; startMove(a, 'jS', true);
    let hits = 0; run(80, () => { step([N(), N()]); hits = Math.max(hits, d.combo); }); return hits + ' hits, landed=' + (a.y >= GY); })());
  R('Kitasan fireball recovery vs Spe', CHARS.kb.moves['5S'].total + ' vs ' + CHARS.spe.moves['5S'].total);
  return out.join('\n');
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/index.html'); await pg.wait_for_timeout(800)
        await pg.evaluate("() => { tick = () => {}; render = () => {}; }")
        await pg.evaluate(LIB + "\n;0")
        print(await pg.evaluate(TESTS)); print('ERR', errs[:5]); await b.close()
if __name__ == '__main__': asyncio.run(main())
