import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Update 2 mechanics: command grabs, traps, the puppet, on-hit follow-ups, backdash, training HP, dash macro.
import asyncio
from playwright.async_api import async_playwright
JS = r"""() => {
  const N = () => ({ ...NEUTRAL }), out = [];
  const R = (name, v) => out.push(name + ': ' + v);
  const setup = (c1, c2, d) => { startMatch('versus', c1, c2); G.phase = 'fight'; G.p.forEach(p => p.setState('idle')); const [a, b] = G.p; a.x = 900; b.x = 900 + d; a.facing = 1; b.facing = -1; return [a, b]; };
  const hit = b => b.c.hp - b.hp > 150;   // more than chip damage
  const run = (n, fa, fb) => { for (let f = 0; f < n; f++) step([fa ? fa(f) : N(), fb ? fb(f) : N()]); };
  const back = () => ({ ...N(), r: 1 }), crouchBack = () => ({ ...N(), r: 1, d: 1 });
  // ---- Jungle Pocket
  { const [a, b] = setup('jp', 'spe', 80); startMove(a, '6S', true); run(60, null, () => back()); R('JP Pocket Buster vs blocking', `${b.hp < b.c.hp ? 'GRABBED ' + (b.c.hp - b.hp) : 'missed'}`); }
  { const [a, b] = setup('jp', 'spe', 90); startMove(a, '6S', true); run(60, null, f => f > 6 && f < 12 ? { ...N(), L: 1, M: 1 } : crouchBack()); R('JP Pocket Buster vs crouch + tech attempt', b.hp < b.c.hp ? 'GRABBED (no tech)' : 'missed'); }
  { const [a, b] = setup('jp', 'spe', 90); b.setState('air'); b.y = GY - 80; b.vy = -3; startMove(a, '6S', true); run(60); R('JP Pocket Buster vs jumping', b.hp < b.c.hp ? 'GRABBED (bad)' : 'whiffed (good)'); }
  { const [a, b] = setup('jp', 'spe', 100); b.setState('air'); b.y = GY - 140; b.vy = 2; startMove(a, '4S', true); run(60); R('JP Wild Catch vs jumper', b.hp < b.c.hp ? 'CAUGHT ' + (b.c.hp - b.hp) : 'missed'); }
  { const [a, b] = setup('jp', 'spe', 90); startMove(a, '4S', true); run(60); R('JP Wild Catch vs grounded', b.hp < b.c.hp ? 'GRABBED (bad)' : 'whiffed (good)'); }
  { const [a, b] = setup('jp', 'spe', 260); startMove(a, '5S', true); run(70); R('JP Jungle Rush from 260', b.hp < b.c.hp ? 'GRABBED ' + (b.c.hp - b.hp) : 'missed'); }
  { const [a, b] = setup('jp', 'spe', 80); b.meter = 60; startMove(a, '6S', true); let broke = false;
    run(70, null, f => { if (b.state === 'thrown' && b.t >= 3 && b.t <= 5) return { ...N(), S: 1, H: 1 }; if (b.state === 'tech') broke = true; return N(); });
    R('Counter Spurt breaks Pocket Buster', broke && b.hp === b.c.hp ? `BROKE, Spurt ${Math.round(b.meter)} (60 - 50)` : `failed (hp ${b.hp}, meter ${b.meter})`); }
  { const [a, b] = setup('jp', 'spe', 80); b.meter = 30; startMove(a, '6S', true);
    run(70, null, f => b.state === 'thrown' && b.t >= 3 && b.t <= 5 ? { ...N(), S: 1, H: 1 } : N());
    R('Counter Spurt break without 50 Spurt', b.hp < b.c.hp ? 'GRABBED (good)' : 'escaped (bad)'); }
  { const [a, b] = setup('spe', 'gs', 70); b.meter = 100; startMove(a, 'throw', true);
    run(70, null, f => b.state === 'thrown' && b.t >= 3 && b.t <= 5 ? { ...N(), S: 1, H: 1 } : N());
    R('S+H against a normal throw', b.hp < b.c.hp && b.meter === 100 ? 'THROWN, no Spurt spent (good)' : `escaped or spent Spurt (bad, ${b.meter})`); }
  { const [a, b] = setup('jp', 'spe', 70); a.meter = 100; startMove(a, '2M', true); let cine = false, hitAt = -1;
    run(90, f => { if (hitAt < 0 && b.state === 'hit') { hitAt = f; startMove(a, 'SU', true); } if (a.state === 'cine') cine = true; return N(); });
    R('JP Wild Typhoon in a combo (2M xx super)', cine ? `CAUGHT IN HITSTUN, ${b.c.hp - b.hp} dmg` : 'missed'); }
  { const [a, b] = setup('jp', 'spe', 80); startMove(a, '2M', true); let hitAt = -1, grabbed = false;
    run(60, f => { if (hitAt < 0 && b.state === 'hit') { hitAt = f; startMove(a, '6S', true); } if (b.state === 'thrown') grabbed = true; return N(); });
    R('JP Pocket Buster in a combo', grabbed ? 'GRABBED (bad)' : 'whiffed (good)'); }
  { const [a, b] = setup('jp', 'spe', 100); a.meter = 100; startMove(a, 'SU', true); let cine = false; run(200, () => { if (a.state === 'cine') cine = true; return N(); }); R('JP Wild Typhoon (grab super)', `${cine ? 'cinematic' : 'no cinematic'}, ${b.c.hp - b.hp} dmg`); }
  // ---- Agnes Tachyon
  { const [a, b] = setup('at', 'spe', 400); startMove(a, '5S', true); let set = -1; run(60, () => { const q = G.projs[0]; if (q && q.phase === 'set' && set < 0) set = Math.round(q.x - a.x); return N(); });
    R('AT potion lands as a trap', set >= 0 ? `set ${set}px away` : 'never set');
    run(30); const hp0 = b.hp; run(120, null, () => ({ ...N(), l: 1 })); R('AT trap bursts when walked into', b.hp < hp0 ? 'HIT ' + (hp0 - b.hp) + ' ' + b.state : 'no hit'); }
  { const [a, b] = setup('at', 'spe', 600); startMove(a, '5S', true); let c = null; run(60, () => { const q = G.projs[0]; if (q && q.phase === 'set' && c === null) c = q.cool; return N(); }); R('AT potion arms after landing', c !== null ? 'arming for ' + c + 'f' : 'never set'); }
  { const [a, b] = setup('at', 'spe', 300); b.x = 1150; startMove(a, '2S', true); let boomAt = -1; run(140, () => { const q = G.projs[0]; if (q && q.phase === 'boom' && boomAt < 0) boomAt = G.frameCount; return N(); }); R('AT Delayed Reaction goes off on its own', boomAt > 0 ? 'yes' : 'no'); }
  { const [a, b] = setup('at', 'spe', 500); startMove(a, '5S', true); run(70); startMove(a, '6S', true); let boom = false; run(20, () => { if (G.projs.some(q => q.phase === 'boom')) boom = true; return N(); }); R('AT Catalyst detonates', boom ? 'yes' : 'no'); }
  { const [a, b] = setup('at', 'spe', 600); for (let k = 0; k < 4; k++) { a.cd = {}; tryAttack(a) || startMove(a, techOK(a, '5S') ? '5S' : 'taunt', true); run(50); } R('AT trap limit', G.projs.filter(q => q.owner === 0).length + ' out (max 3)'); }
  // ---- Manhattan Cafe
  { const [a, b] = setup('mc', 'spe', 200); startMove(a, '5S', true); let free = -1; run(60, f => { if (free < 0 && a.actionable()) free = f; return N(); }); R('MC Phantom Rush', `${b.c.hp - b.hp} dmg, Cafe free after ${free}f, Friend ${a.pupState}`); }
  { const [a, b] = setup('mc', 'spe', 230); startMove(b, '5M', true); run(4); startMove(a, '5S', true); run(40); R('MC Friend hit by a strike', a.pupState + ' cd ' + a.pupCd + ', Cafe hp ' + (a.c.hp - a.hp) + ' lost'); run(260); R('MC Friend comes back', a.pupState); }
  { const [a, b] = setup('mc', 'spe', 150); startMove(a, '6S', true); run(60, null, () => crouchBack()); R('MC Night Drop vs crouch block', hit(b) ? 'HIT (overhead works)' : 'blocked'); }
  { const [a, b] = setup('mc', 'spe', 150); startMove(a, '6S', true); run(60, null, () => back()); R('MC Night Drop vs stand block', hit(b) ? 'HIT' : 'BLOCKED (good)'); }
  { const [a, b] = setup('mc', 'spe', 150); startMove(a, '2S', true); run(40, null, () => back()); R('MC Shadow Sweep vs stand block', hit(b) ? 'HIT (low works)' : 'blocked'); }
  { const [a, b] = setup('mc', 'mm', 150); startMove(a, '5S', true); run(2); startMove(b, '2S', true); run(40); R('MC Friend vs McQueen parry', a.pupState + ', Cafe ' + a.state); }
  // ---- Dantsu Flame
  { const [a, b] = setup('df', 'spe', 175); startMove(a, '5S', true); run(40, f => f > 11 && f < 15 ? { ...N(), S: 1 } : N()); R('DF Flame Thrust tip + S on hit', `${b.c.hp - b.hp} dmg, ${b.state}`); }
  { const [a, b] = setup('df', 'spe', 175); startMove(a, '5S', true); let fol = false; run(40, f => { if (a.state === 'attack' && a.move.id === '5S~F') fol = true; return f > 11 && f < 15 ? { ...N(), S: 1 } : N(); }, () => back()); R('DF Flame Thrust blocked + S', fol ? 'follow-up came out (bad)' : 'no follow-up (good)'); }
  { const [a, b] = setup('df', 'spe', 175); startMove(a, '5S', true); let adv = null; run(60, null, () => back()); for (let f = 0; f < 40 && !(a.actionable()); f++) step([N(), back()]); R('DF Flame Thrust at the tip, recovers vs blocker', a.actionable() && b.state !== 'block' ? 'ok' : a.state + ' / ' + b.state); }
  { const [a, b] = setup('df', 'spe', 160); startMove(a, '2S', true); run(70, null, () => back()); R('DF Cheese Wheel vs stand block', hit(b) ? 'HIT (low)' : 'blocked'); }
  { const [a, b] = setup('df', 'spe', 260); a.meter = 100; startMove(a, '2SX', true); let n = 0; run(30, () => { n = Math.max(n, G.projs.length); return N(); }); R('DF EX Cheese (wedge + wheel)', n + ' on screen'); }
  { const [a, b] = setup('df', 'spe', 400); const x0 = a.x; run(60, () => ({ ...N(), r: 1 })); R('DF walk speed (px/s)', Math.round(a.x - x0)); }
  // ---- universal changes
  { const [a, b] = setup('spe', 'ds', 80); b.x = STAGE_W - 45; a.x = b.x - 80; b.facing = -1; a.facing = 1;
    let bd = false; run(3, null, f => f === 0 ? { ...N(), r: 1 } : f === 1 ? N() : { ...N(), r: 1 }); startMove(a, '5L', true); run(20, null, () => { if (b.state === 'backdash') bd = true; return N(); }); R('Corner backdash vs 5L', `${bd ? 'backdashed' : 'no backdash'}, ${b.hp < b.c.hp ? 'HIT (good)' : 'dodged'}`); }
  { startMatch('training', 'tt', 'suz'); G.p.forEach(p => p.setState('idle')); const d = G.p[1]; d.hp = 300; resolveHit(G.p[0], d, H({ dmg: 2000, launch: [2, -8], kd: true }), G.p[0].x, false, false); run(120); R('Training: dummy at 0 hp', `hp ${d.hp}, state ${d.state}, combo dmg ${d.comboDmg}`); }
  { const [a, b] = setup('vo', 'spe', 90); startMove(a, '6S', true); run(5); const early = b.state; run(40); R('Vodka Pit Stop startup', `${early} at frame 5, dmg ${b.c.hp - b.hp}`); }
  return out.join('\n');
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/index.html', wait_until='domcontentloaded', timeout=120000); await pg.wait_for_timeout(3000)
        await pg.evaluate("() => { tick = () => {}; render = () => {}; Sfx.play = () => {}; }")
        print(await pg.evaluate(JS)); print('ERR', errs[:5]); await b.close()
asyncio.run(main())
