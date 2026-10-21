"""Generate the Uma Versus wiki (a single HTML page with hash views) from game data."""
import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import json, html

D = json.load(open(ROOT+'/build/wiki/wiki_data.json'))
CB = json.load(open(ROOT+'/build/wiki/wiki_combos.json'))
BUILD = D['build']
ORDER = ['spe', 'suz', 'gs', 'vo', 'ds', 'mm', 'tt', 'kb']
E = html.escape
ARROW = {'1': '↙', '2': '↓', '3': '↘', '4': '←', '6': '→', '7': '↖', '8': '↑', '9': '↗'}
arrows = lambda mo: ''.join(ARROW.get(ch, ch) for ch in mo)

def notation(seq):
    out = []
    for t in seq.split(' '):
        if t == 'jc': out.append('<span class="tag">jump cancel</span>')
        elif t == 'dc': out.append('<span class="tag">→→ dash cancel</span>')
        elif t == ',': out.append('<span class="tag">link</span>')
        elif t[:-1].isdigit() and len(t) >= 4: out.append(f'<b>{arrows(t[:-1])}{t[-1]}</b>')
        else: out.append(f'<b>{E(t)}</b>')
    return ' <span class="sep">›</span> '.join(out)

def adv(v, m, kind):
    if v is None: return '<span class="na">—</span>'
    if kind == 'hit' and m['kd'] and v > 25: return '<span class="kd">KD</span>'
    if kind == 'hit' and v > 40: return '<span class="kd">Launch</span>'
    cls = 'plus' if v > 0 else 'minus' if v < 0 else 'even'
    return f'<span class="{cls}">{"+" if v > 0 else ""}{v}</span>'

def num(v): return '<span class="na">—</span>' if v in (None, 0) else str(v)

GUARD = {'mid': 'Mid', 'low': 'Low', 'high': 'Overhead', 'throw': 'Throw', '': '—'}
def guard(g): return ' / '.join(GUARD.get(x, x) for x in g.split('/')) if g else '—'

NORMAL_NAMES = {'5L': 'Standing L', '5M': 'Standing M', '5H': 'Standing H', '2L': 'Crouching L', '2M': 'Crouching M (slide)', '2H': 'Crouching H (launcher)',
                '6M': 'Hop overhead (→M)', 'jL': 'Jumping L', 'jM': 'Jumping M', 'jH': 'Jumping H', 'dL': 'Dash L', 'dM': 'Dash M', 'dH': 'Dash H',
                'throw': 'Throw (L+M)', 'GC': 'Counter Spurt (S+H blocking)'}
NORMAL_ORDER = ['5L', '5M', '5H', '2L', '2M', '2H', '6M', 'jL', 'jM', 'jH', 'dL', 'dM', 'dH', 'throw', 'GC']

# ------------------------------------------------------------------ written content
ARCH = {
  'ALL-ROUNDER': ('A little of everything', 'Has a tool for every range: a projectile, an anti-air, a way in and a way to defend. Rarely loses a matchup outright, but also rarely wins one on paper. Good for learning the game and for adapting mid-match.'),
  'HIT AND RUN': ('Get in, hit, get out', 'Darts in for one clean hit, then leaves before the opponent can answer. High damage and strong escape tools, balanced by low health and few ways to defend once cornered.'),
  'RUSHDOWN': ('Stay in their face', 'Fast, plus-on-block attacks and ways to keep a turn going after it is blocked. Wants to start pressure and never let it end; struggles when forced to play from a distance.'),
  'VORTEX': ('Knock down, then make them guess', 'Built around knockdowns that remove the defender\'s wake-up options, followed by a 50/50: in front or behind, high or low, strike or throw. A wrong guess leads back to another knockdown.'),
  'BAIT AND PUNISH': ('Make them commit, then make them pay', 'Waits for the opponent to act first. Long pokes, a counter stance and extra damage on recovering opponents turn every mistake into a big punish. Has few ways to start offense alone, and once the opponent stops taking the bait it has to work hard.'),
  'GLASS CANNON': ('Win fast or lose fast', 'Turns a single opening into huge damage, but has the least health and almost no defensive tools. Every exchange matters: the round can be over in two combos either way.'),
  'SHOTO': ('The classic toolkit', 'A projectile, an invincible uppercut and an advancing attack, in the tradition of Street Fighter\'s Ryu and Ken. Easy to pick up and solid in every matchup, but the game plan is predictable.'),
  'ZONER': ('Control the screen', 'Keeps the opponent at a distance with projectiles at different angles and speeds. Low damage, so wins come from many small hits and from denying the opponent a way in.'),
}
CHAR = {
  'spe': {
    'plan': ['Special Week has an answer at every range. Dream Shot controls the middle of the screen, Rising Dream stops jump-ins, Spurt Tornado travels in and passes over low pokes, and Last Spurt Tackle armors through a single hit or projectile to close distance.',
             'The game plan is to play to whatever the opponent is weak against. Against a zoner, walk behind L Dream Shot and armor through their shots with Tackle. Against rushdown, block, then reversal with Rising Dream.'],
    'strong': ['Tools for every situation', 'Fully invincible EX Rising Dream', 'Straightforward combos that end in a knockdown'],
    'weak': ['Specialists beat her at their own game', 'Rising Dream and Last Spurt Tackle are very punishable if blocked'],
    'tips': ['L Dream Shot is slow: walk or dash behind it to approach.', 'L Rising Dream has less invincibility but recovers faster. Use M or EX when you need it to beat a meaty attack.', 'Last Spurt Tackle absorbs one hit, including a projectile. EX absorbs two.'],
  },
  'suz': {
    'plan': ['Land one clean hit, then leave. Great Escape (M) runs through the opponent and keeps going, and Silent Flicker kicks then hops far back, so many of her moves are minus on paper but safe because she ends up out of reach.',
             'Her damage per hit (×1.1) is second only to Tokai Teio, and she moves fast: a quick dash, a long invincible backdash and an air dash. The cost is 8,500 health and a weak reversal, so getting cornered is dangerous.'],
    'strong': ['High damage per hit (×1.1, second only to Teio)', 'Moves that leave her out of punish range', 'Air dash and a long invincible backdash'],
    'weak': ['Second-lowest health in the cast (8,500)', 'Lead the Pack has little invincibility, especially the L version', 'Few options once she is pinned in a corner'],
    'tips': ['Great Escape L stops in front, M runs through. Mixing the two makes them hard to punish on reaction.', 'Silent Flicker M on block leaves you about 240 px away when you recover (about 200 for L, 270 for EX). Few moves can reach that far.', 'Air dash needs some height and has 7 frames of landing recovery if you land out of it.'],
  },
  'gs': {
    'plan': ['Gold Ship wants to start her turn and keep it. Her 5L comes out in 4 frames, recovers faster than anyone else\'s and is plus on block (+2), crouching jabs chain into themselves, and Barrage is plus on block too.',
             'Golshi Rush is the mixup engine: during the dash, choose a low slide, an overhead hop chop, an untechable command grab, or stop dead and do something else. Dash cancels (→→ after a normal, 10 Spurt) keep pressure going after a blocked string.'],
    'strong': ['Fastest normals in the game (4f 5L, 6f 5M)', 'Plus-on-block pressure tools', 'Four-way command dash mixup'],
    'weak': ['No invincible reversal attack (only EX Golshi Rush is invincible, and it is a dash)', 'Golshi Dropkick!! is about −22 on block', 'Struggles against keep-away at long range'],
    'tips': ['End blocked strings with L Barrage (+5) to keep your turn.', 'From the command dash, the grab beats players who block, the slide beats standing guard, and the chop beats crouching guard.', 'Golshi Mode adds 2 frames of blockstun to everything for 6 seconds, which makes even more of her moves plus.'],
  },
  'vo': {
    'plan': ['Vodka\'s loop starts with a hard knockdown: Full Throttle, the Pit Stop command grab, or the EX versions of Drift Hop and Drift Drop. A hard knockdown cannot be quick-risen, so the opponent always gets up at the same time and her setups line up.',
             'On their wake-up, make them guess. Drift Hop L lands in front and M crosses over. A meaty 2L is low, Drift Drop and j.M are overheads, and a walk-up Pit Stop beats blocking. A wrong guess leads into another hard knockdown.'],
    'strong': ['Consistent wake-up setups after hard knockdowns', 'Cross-up jumping attacks (j.L / j.M hit behind her)', 'Untechable command grab'],
    'weak': ['Rev Kick only beats air attacks, it is not invincible on the ground', 'Average neutral game: she has to earn the first knockdown', 'Patterns become readable if you never vary them'],
    'tips': ['After Full Throttle, the opponent is down for a fixed 34 frames. Practice your timing in Training.', 'Drift Hop is an overhead and also crosses up with M: two guesses at once.', 'Pit Stop leaves the opponent close to you, ready for the next mixup.'],
  },
  'mm': {
    'plan': ['McQueen wants the opponent to move first. Her 5M and Stayer\'s Lance reach further than almost anything in the game, so walking toward her is risky, and anyone who throws out an attack up close may run into Noble Parry.',
             'Her passive, Punish, adds 20% damage and extra hitstun to the first hit on an opponent who is recovering from a move or a long landing. Whiffed specials, blocked unsafe moves and badly spaced jump-ins all turn into big damage. Long-Distance Stride covers the far end of the screen, and its EX passes through projectiles.'],
    'strong': ['Very long pokes: Stayer\'s Lance has the longest reach of any poke', 'Counter stance that catches any strike, high or low', 'Highest health (10,500) and PUNISH! damage'],
    'weak': ['Little offense of her own', 'Noble Parry loses to throws and (except EX) projectiles', 'A patient opponent who stops attacking takes away her game'],
    'tips': ['Noble Parry catches strikes from frame 3. It does not catch throws, so a smart opponent will grab you out of it. Use it when you expect an attack, not on reflex.', 'Block an unsafe move, then punish it: the PUNISH! bonus applies to the first hit of your combo.', 'EX Stayer\'s Lance and EX Long-Distance Stride go through projectiles, which makes zoners think twice.'],
  },
  'tt': {
    'plan': ['Teio turns one hit into a lot of damage. Her specials can chain into each other on hit: after the last hit of one skill, input another and it comes out immediately. Each skill can be used once per combo, so a full chain looks like Teio Step › Imperial Rush › Emperor\'s Rise.',
             'Her health is the lowest in the game (8,000) and Emperor\'s Rise is not invincible unless you spend meter, so her defense is thin. When her health drops below 30%, Miracle Mode adds 15% damage for a last-ditch comeback.'],
    'strong': ['Highest damage in the cast (×1.12) and the biggest combos', 'Specials chain into each other on hit', 'Miracle Mode comeback below 30% health'],
    'weak': ['Lowest health (8,000)', 'No invincible reversal without meter', 'Chains only work on hit: a blocked special is just a blocked special'],
    'tips': ['Input the next special after the current one\'s last hit. The 9-frame buffer gives you some room.', 'Miracle Leap is an overhead: mix it with low 2M and 2L.', 'EX Teio Step goes through projectiles to start a chain from mid-range.'],
  },
  'kb': {
    'plan': ['Kitasan is the textbook shoto. Festival Drum is a fireball with quick recovery, Matsuri Uppercut is the strongest invincible reversal in the cast, Festival Whirlwind travels in and passes over lows, and Kitasan Straight is a nearly safe step-in punch.',
             'The plan is the classic one: throw fireballs to make the opponent jump, uppercut the jump, and use the step-in and whirlwind to take your turn up close. Special Week shares some tools but plays as an all-rounder; Kitasan has the stronger fundamentals and the more predictable game plan.'],
    'strong': ['Fast-recovering fireball (28 frames total)', 'Strongest invincible uppercut (1,300 damage)', 'Whirlwind works on the ground and in the air'],
    'weak': ['Predictable once the opponent learns the pattern', 'Matsuri Uppercut is very punishable if blocked', 'No armor or counter tools'],
    'tips': ['L Festival Drum is slow enough to walk behind.', 'Sky Whirlwind is an overhead that changes your jump arc.', 'Kitasan Straight is only slightly minus on block. End blocked strings with it to keep pressure.'],
  },
  'ds': {
    'plan': ['Daiwa keeps the opponent where she wants them. Scarlet Shot goes straight (two can be on screen), High Top Line angles upward to stop jumps, Ground Rose travels low along the ground, and Sky Shot fires downward from a jump.',
             'Rose Barrier reflects incoming projectiles and knocks away anyone too close, which sends them back to shooting range. Her damage is the lowest in the cast (×0.88) and her dash is slow, so she wins through many small hits.'],
    'strong': ['Projectiles at four different angles', 'Reflector that also pushes people away', 'Long-reaching normals and a strong backdash'],
    'weak': ['Lowest damage (×0.88)', 'Slowest dash', 'Struggles once an opponent is up close'],
    'tips': ['Mix Ground Rose (low) with Scarlet Shot (mid) so opponents cannot just block one way.', 'High Top Line L is flatter and covers a forward jump. M is steeper and covers a jump from closer.', 'Rose Barrier\'s reflect window is longest on EX.', 'Number One Finish is a volley of shots, not a rush: fire it to punish a whiffed move or a dash from mid-range, or end a combo with it.'],
  },
}

def char_page(cid, idx):
    c = D['chars'][cid]; t = CHAR[cid]; col = c['color']
    mv = {m['id']: m for m in c['moves']}
    arch_title, arch_desc = ARCH[c['arch']]
    flags = []
    if c['flags']['airDash']: flags.append('Air dash (once per jump)')
    if c['flags']['lightChain']: flags.append('Crouching L chains into itself')
    if c['flags']['dashCancel']: flags.append('Dash cancel (→→ during a normal, 10 Spurt)')
    if c['flags']['projMax'] > 1: flags.append(f"Up to {c['flags']['projMax']} projectiles on screen")
    if c['flags']['dmgMul'] != 1: flags.append(f"Damage ×{c['flags']['dmgMul']:g}")
    if c['flags'].get('punisher'): flags.append('Punish: +20% damage on recovering opponents')
    if c['flags'].get('specialChain'): flags.append('Special chain: skills cancel into other skills on hit')
    if c['flags'].get('lowHpBoost'): flags.append('Miracle Mode: +15% damage below 30% health')
    if c['backdash']: flags.append(f"Long backdash ({c['backdash']['inv']}f invincible)")
    stats = [('Health', f"{c['hp']:,}"), ('Walk', f"{c['walk']:g} px/f"), ('Back walk', f"{c['back']:g} px/f"), ('Dash', f"{c['dash']:g} px/f"), ('Jump', f"{abs(c['jumpV']):g}")]
    # skills
    skills = [m for m in c['moves'] if m['kind'] in ('special', 'throw') and m['motion'] and not m['isEx'] and not m['varOf'] and not m['followOf']]
    skill_rows = ''
    for m in skills:
        L = mv.get(m['id'] + '.L'); X = mv.get(m['id'] + 'X')
        def fd(x):
            if not x: return '—'
            bits = [f"{x['startup']}f" if x['startup'] else (f"catches {x['counter'][0]}–{x['counter'][1]}f" if x.get('counter') else None), f"{x['dmg']} dmg" if x['dmg'] else None]
            return ' · '.join(b for b in bits if b)
        skill_rows += f"""<tr><th scope="row"><span class="mv">{E(m['name'])}</span><span class="sub">{E(m['note'] or '')}</span></th>
          <td class="inp">{arrows(m['motion'])} + L/M{'<br><span class="sub">or ' + E(m['input']) + ' (shortcut)</span>' if m['input'] else ''}</td>
          <td>{E(m['vnote'] or 'Same as M')}<span class="sub mono">L: {fd(L or m)} · M: {fd(m)}</span></td>
          <td>{E(m['exNote'] or '—')}<span class="sub mono">{fd(X)}</span></td></tr>"""
        if m['fnote']:
            skill_rows += f"""<tr class="follow"><th scope="row"><span class="sub">Follow-ups</span></th><td colspan="3">{E(m['fnote'])}</td></tr>"""
    su = mv.get('SU')
    if su: skill_rows += f"""<tr class="super"><th scope="row"><span class="mv">{E(su['name'])}</span><span class="sub">Super · costs the full Spurt gauge</span></th><td class="inp">S + H</td><td colspan="2">Invincible sprint into a cinematic combo · <span class="mono">{su['dmg']} dmg</span></td></tr>"""
    # frame data
    def fd_row(m, label):
        return f"""<tr><th scope="row">{label}</th><td>{num(m['startup'])}</td><td>{num(m['active'])}</td><td>{m['total']}</td><td>{m['dmg'] or '—'}</td>
          <td>{guard(m['guard'])}</td><td>{adv(m['onHit'], m, 'hit')}</td><td>{adv(m['onBlock'], m, 'block')}</td></tr>"""
    normals = ''.join(fd_row(mv[k], NORMAL_NAMES[k]) for k in NORMAL_ORDER if k in mv)
    specials = ''
    for m in skills:
        for vid, lab in [(m['id'] + '.L', ' L'), (m['id'], ' M'), (m['id'] + 'X', ' EX')]:
            if vid in mv: specials += fd_row(mv[vid], E(m['name']) + f'<span class="ver">{lab}</span>')
            elif lab == ' L' and m['id'] in mv: pass
        for f in c['moves']:
            if f['followOf'] == m['id']: specials += fd_row(f, '&nbsp;&nbsp;› ' + E(f['name']))
    combos = ''
    for cb in CB[cid]:
        combos += f"""<li class="combo"><div class="ch"><span class="mv">{E(cb['name'])}</span><span class="dmg mono">{cb['dmg']:,} dmg · {cb['hits']} hits</span></div>
          <div class="seq">{notation(cb['seq'])}</div><p class="sub">{E(cb['note'])}</p></li>"""
    return f"""
<section class="view char" id="v-{cid}" data-view="{cid}" style="--char:{col}" hidden>
  <header class="charhead">
    <div class="gate"><span class="gl">Gate</span><span class="gn">{idx}</span></div>
    <div><p class="eyebrow">{E(c['arch'])} · {E(arch_title)}</p><h1>{E(c['name'].title())}</h1><p class="lede">{E(c['blurb'])}</p></div>
  </header>
  <dl class="stats">{''.join(f'<div><dt>{k}</dt><dd>{v}</dd></div>' for k, v in stats)}</dl>
  {'<ul class="traits">' + ''.join(f'<li>{E(f)}</li>' for f in flags) + '</ul>' if flags else ''}
  <div class="two">
    <div class="prose"><h2>Game plan</h2>{''.join(f'<p>{E(p)}</p>' for p in t['plan'])}</div>
    <div class="sw"><h3>Strengths</h3><ul>{''.join(f'<li>{E(x)}</li>' for x in t['strong'])}</ul><h3>Weaknesses</h3><ul>{''.join(f'<li>{E(x)}</li>' for x in t['weak'])}</ul></div>
  </div>
  <h2>Skills</h2>
  <div class="tw"><table class="skills"><thead><tr><th>Skill</th><th>Input</th><th>L / M versions</th><th>EX (H, 50 Spurt)</th></tr></thead><tbody>{skill_rows}</tbody></table></div>
  <h2>Starter combos</h2>
  <p class="note">Every combo here is performed automatically by the game's test suite on build {BUILD}, so they are confirmed to work. Damage is against a full-health opponent.</p>
  <ul class="combos">{combos}</ul>
  <h2>Frame data</h2>
  <p class="note">Measured in the game on build {BUILD}. Startup is the first active frame. On hit / on block is frame advantage at close range: <span class="plus">+</span> means you recover first. <span class="kd">KD</span> = knockdown, <span class="kd">Launch</span> = launches for a juggle. Air moves show — for advantage.</p>
  <div class="tw"><table class="fd"><thead><tr><th>Normals</th><th>Startup</th><th>Active</th><th>Total</th><th>Damage</th><th>Guard</th><th>On hit</th><th>On block</th></tr></thead><tbody>{normals}</tbody></table></div>
  <div class="tw"><table class="fd"><thead><tr><th>Skills</th><th>Startup</th><th>Active</th><th>Total</th><th>Damage</th><th>Guard</th><th>On hit</th><th>On block</th></tr></thead><tbody>{specials}</tbody></table></div>
  <h2>Tips</h2><ul class="tips">{''.join(f'<li>{E(x)}</li>' for x in t['tips'])}</ul>
</section>"""

def nav():
    items = [('home', 'Home', ''), ('systems', 'How to play', '')]
    chars = ''.join(f'<a href="#{cid}" data-go="{cid}" style="--char:{D["chars"][cid]["color"]}"><span class="dot"></span>{E(D["chars"][cid]["name"].title())}<span class="navarch">{E(D["chars"][cid]["arch"].title().replace(' And ',' and '))}</span></a>' for cid in ORDER)
    return f"""<nav class="side" aria-label="Wiki sections">
  <a href="#home" data-go="home">Home</a><a href="#systems" data-go="systems">How to play</a>
  <p class="navh">Characters</p>{chars}
  <p class="navh">Updates</p><a href="#update15" data-go="update15">Update 1.5 notes</a><a href="#update1" data-go="update1">Update 1 notes</a>
</nav>"""

arch_cards = ''.join(f"""<div class="arch"><p class="eyebrow">{E(a.title().replace(' And ',' and '))}</p><h3>{E(t)}</h3><p>{E(d)}</p>
  <p class="who">{', '.join(E(D['chars'][cid]['name'].title()) for cid in ORDER if D['chars'][cid]['arch'] == a)}</p></div>""" for a, (t, d) in ARCH.items())
roster = ''.join(f"""<a class="rcard" href="#{cid}" data-go="{cid}" style="--char:{D['chars'][cid]['color']}"><span class="gn">{i}</span>
  <span class="rn">{E(D['chars'][cid]['name'].title())}</span><span class="ra">{E(D['chars'][cid]['arch'].title().replace(' And ',' and '))}</span>
  <span class="rs mono">{D['chars'][cid]['hp']:,} HP</span></a>""" for i, cid in enumerate(ORDER, 1))

SYSTEMS = f"""
<section class="view" id="v-systems" data-view="systems" hidden>
  <p class="eyebrow">Reference</p><h1>How to play</h1>
  <div class="prose">
  <h2>Default controls</h2>
  <p>Every input can be rebound from <b>Controls</b> in the main menu (saved in your browser).</p>
  <div class="tw"><table class="ctl"><thead><tr><th>Action</th><th>Player 1</th><th>Player 2</th><th>Gamepad</th></tr></thead><tbody>
  <tr><th>Move / jump / crouch</th><td>W A S D</td><td>Arrow keys</td><td>D-pad / left stick</td></tr>
  <tr><th>Light (L)</th><td>F</td><td>J or Num1</td><td>X / □</td></tr><tr><th>Medium (M)</th><td>G</td><td>K or Num2</td><td>Y / △</td></tr>
  <tr><th>Heavy (H)</th><td>H</td><td>L or Num3</td><td>B / ○</td></tr><tr><th>Skill (S)</th><td>T</td><td>I or Num5</td><td>A / ✕</td></tr>
  <tr><th>Throw (L+M)</th><td>R</td><td>U or Num4</td><td>LB</td></tr><tr><th>Super (S+H)</th><td>Y</td><td>O or Num6</td><td>RB</td></tr>
  <tr><th>Taunt (L+H)</th><td>E</td><td>P or Num7</td><td>Back</td></tr><tr><th>Pause</th><td colspan="3">Esc / Start</td></tr></tbody></table></div>

  <h2>Notation</h2>
  <p>Directions use the numpad, as if the character faces right: <b>5</b> neutral, <b>2</b> down, <b>6</b> forward, <b>4</b> back. <b>5M</b> is a standing medium, <b>2M</b> a crouching medium, <b>j.H</b> a jumping heavy. <b>236</b> is ↓↘→, <b>623</b> is →↓↘, <b>214</b> is ↓↙←, <b>41236</b> is ←↙↓↘→. In combos, <b>›</b> means cancel or link into the next move.</p>

  <h2>Defense</h2>
  <ul>
  <li><b>Block</b> by holding back. Hold down-back to block lows. Overheads (jumping attacks, hop moves, dive kicks) must be blocked standing.</li>
  <li>You can block straight out of a dash: holding back cancels the dash immediately.</li>
  <li><b>Throw</b> with L+M up close; hold back for a back throw. Throws beat blocking. Escape a throw by pressing L+M as it connects (command grabs cannot be escaped).</li>
  <li><b>Counter Spurt</b>: press S+H while blocking to spend 50 Spurt on an invincible push-away.</li>
  <li><b>Backdash</b> (←←) is briefly invincible.</li>
  <li><b>Wake-up</b>: hold any attack button while knocked down to get up early, or hold ↓ to get up late. Hard knockdowns (throws, command grabs, supers, and some skills such as Vodka's Full Throttle) disable both.</li>
  </ul>

  <h2>Skills and the Spurt gauge</h2>
  <ul>
  <li>Do a skill's motion with <b>L</b> or <b>M</b> for its two free versions. With <b>H</b> it becomes the <b>EX</b> version, which costs 50 Spurt. Without 50 Spurt, H gives the M version.</li>
  <li>The <b>S + direction</b> shortcut (S, →S, ←S, ↓S) does the M version without a motion, at the cost of a cooldown and 10% less damage.</li>
  <li>The Spurt gauge fills as you deal and take damage. It pays for EX skills (50), Counter Spurt (50), Gold Ship's dash cancel (10) and supers (100, S+H).</li>
  </ul>

  <h2>Combos</h2>
  <ul>
  <li><b>Chains</b>: normals cancel into stronger normals: L › M › H.</li>
  <li><b>Auto-combo</b>: on hit, mash L for 5L › 5M › 5H › skill.</li>
  <li><b>Skill cancels</b>: any normal that connects can be cancelled into a skill or super.</li>
  <li><b>Jump cancel</b>: after a launching hit (2H, or the second hit of 5H), hold ↑ to jump after them for an air combo.</li>
  <li>The input buffer is 9 frames. A buffered button remembers the direction and motion you entered when you pressed it, so inputs made during hit freeze still come out as intended.</li>
  </ul>
  <h2>Combo scaling and limits</h2>
  <ul>
  <li><b>Damage scaling</b>: the first hit of a combo does full damage. After that, damage depends on what started the combo (a light starter: 80%, a medium: 90%, a heavy, counter hit or punish: 100%), and drops by a further 13% per hit from the 3rd hit, down to 25%. Supers always keep at least 50%. The combo counter shows the scaling for the next hit.</li>
  <li><b>Juggle points</b>: every hit on an airborne opponent costs juggle points (normals 1, skills 2, bounces 1). At 10 the opponent can no longer be hit in the air.</li>
  <li><b>Ground bounce</b>: j.H in an air combo slams the opponent into the ground and they bounce back up, so you can relaunch them (2H) after you land. Once per combo.</li>
  <li><b>Wall bounce</b>: several EX knockdowns bounce the opponent off the corner or the edge of the screen, ready for a follow-up. Once per combo.</li>
  <li><b>Hitstun decay</b>: after a combo has lasted 2 seconds, each new hit causes less hitstun and juggled opponents fall faster, so loops eventually drop.</li>
  <li><b>Combo limit</b>: after 32 hits or 7 seconds, further hits pass through and the opponent drops out. This makes infinites impossible.</li>
  <li>In combo notation, <b>link</b> means wait until you recover, then start the next move (it can't be cancelled into).</li>
  </ul>

  <h2>Movement</h2>
  <ul>
  <li>Double-tap → to dash and ←← to backdash. Press L, M or H during a dash, or input →→ + button, for a dash attack: L jab, M lunge, H leaping overhead kick.</li>
  <li>→+M is a hop overhead. Low attacks beat it because you are briefly airborne.</li>
  <li>Only Silence Suzuka can air dash. It needs some height, cannot attack for the first 8 frames, and has landing recovery.</li>
  </ul>

  <h2>Training, replays and online</h2>
  <ul>
  <li><b>Training</b> shows damage, combo scaling, juggle points, frame advantage and hitboxes. Keys: 1 dummy · 2 dummy guard · 3 hitboxes · 4 reset · 5 input display · 6 frame meter · 7 record the dummy · 8 play the recording back.</li>
  <li><b>Frame meter</b>: one cell per frame for both players, coloured by startup (green), active (red), recovery (blue), hit or block stun (yellow) and outlined when invincible, plus the startup of your move and the frame advantage.</li>
  <li><b>Dummy record &amp; playback</b>: press 7 to control the dummy and record up to 10 seconds, 7 again to stop, then 8 to have the dummy loop it while you practice blocking or punishing.</li>
  <li><b>Combo trials</b>: every runner's combos as challenges the game checks for you, with a demo (9) that performs each one. Cleared trials are saved in your browser.</li>
  <li><b>Replays</b>: every Versus, VS CPU and Online match is recorded. Press R on the results screen to watch, or D to save a file.</li>
  <li><b>Online</b> uses rollback netcode and room codes. Both players need the same build: this wiki matches build <b class="mono">{BUILD}</b>.</li>
  </ul>
  </div>
</section>"""

UPDATE15 = f"""
<section class="view" id="v-update15" data-view="update15" hidden>
  <p class="eyebrow">Patch notes · build {BUILD}</p><h1>Update 1.5</h1>
  <div class="prose">
  <p>Team Spica is complete: three new characters bring the roster to eight.</p>
  <h2>New characters</h2>
  <ul><li><b>Mejiro McQueen</b> (Bait and Punish): long pokes, the Noble Parry counter stance, and the Punish passive (+20% damage on recovering opponents). Highest health in the cast.</li>
  <li><b>Tokai Teio</b> (Glass Cannon): specials chain into each other on hit for the biggest combos in the game. Lowest health, no free reversal, and Miracle Mode below 30% health.</li>
  <li><b>Kitasan Black</b> (Shoto): fireball, invincible uppercut, a whirlwind kick on the ground and in the air, and a step-in punch.</li></ul>
  <h2>Systems</h2>
  <ul><li>New move properties: counter stances, passing through projectiles (several EX moves), special chains and comeback damage.</li>
  <li>Move list shows each character's passive traits.</li>
  <li>CPU: McQueen's CPU waits, pokes and uses Noble Parry when you swing up close.</li></ul>
  <h2>Online</h2>
  <ul><li>Both players need build <b class="mono">{BUILD}</b>. Older builds are refused at connect.</li></ul>
  </div>
</section>"""

UPDATE = f"""
<section class="view" id="v-update1" data-view="update1" hidden>
  <p class="eyebrow">Patch notes · build {BUILD}</p><h1>Update 1</h1>
  <div class="prose">
  <h2>New</h2>
  <ul><li>Three new characters: <b>Gold Ship</b> (Rushdown), <b>Vodka</b> (Vortex) and <b>Daiwa Scarlet</b> (Zoner).</li>
  <li><b>Control mapping</b> for both keyboard layouts and gamepads, saved in your browser.</li>
  <li>Unique animation profiles for every character: timing, taunts, intros, win poses and signature effects.</li>
  <li>A <b>Combos</b> page in the in-game move list, and this wiki.</li></ul>
  <h2>Gameplay</h2>
  <ul><li><b>EX rework</b>: motion + L and M are the free versions; motion + H is the EX and costs 50 Spurt. The Skill button no longer triggers EX.</li>
  <li><b>Guard button removed</b>: block by holding back. Taunt moved to L+H.</li>
  <li><b>Blocking out of a dash</b>: holding back cancels a dash instantly.</li>
  <li><b>Movement</b>: walk and dash speeds brought closer together, backdash invincibility shortened (4 frames for most), double jump removed, and air dash now needs height, cannot attack for 8 frames and has landing recovery.</li>
  <li><b>Combos</b>: 9-frame input buffer that remembers your direction and motion, slightly more hitstun on normals, less pushback on hit, more lenient juggles, higher 5H launchers, and jump cancels only after a launching hit.</li>
  <li>Projectiles can now travel at angles, along the ground, from the air, two at a time, and be reflected.</li></ul>
  <h2>Characters</h2>
  <ul><li><b>Special Week</b> is now an All-Rounder: Guts! is replaced by Last Spurt Tackle, an armored charge.</li>
  <li><b>Silence Suzuka</b> is now Hit and Run: new Silent Flicker (kick, then hop away), Turbine Roll moved to ←↙↓↘→, teleport and double jump removed, damage +10%, health 8,500.</li>
  <li><b>Gold Ship</b>: H versions of her skills are now EX versions.</li></ul>
  </div>
</section>"""

HOME = f"""
<section class="view" id="v-home" data-view="home">
  <div class="hero">
    <p class="eyebrow">Fan-made fighting game · Update 1.5 · build {BUILD}</p>
    <h1 class="big">Uma Versus Wiki</h1>
    <p class="lede">Characters, moves, frame data and combos for the Uma Versus browser fighting game. Frame data and combos are generated from the game itself, so they match build {BUILD}.</p>
  </div>
  <h2>The roster</h2>
  <div class="roster">{roster}</div>
  <h2>Archetypes</h2>
  <p class="note">Each character is built around a classic fighting-game archetype.</p>
  <div class="archs">{arch_cards}</div>
  <p class="note">New to the game? Start with <a href="#systems" data-go="systems">How to play</a>.</p>
</section>"""

CSS = """
/* Layout: sidebar index + single content column, like a race program with a table of contents. */
:root {
  --bg: #f1f5ef; --panel: #ffffff; --fg: #142118; --muted: #56675b; --line: #d2ddd2; --accent: #1d7346; --gold: #a97b06;
  --plus: #13804a; --minus: #c0362c; --tag: #e7efe6;
  --display: "Saira Condensed", "Arial Narrow", "Roboto Condensed", sans-serif;
  --body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0d1611; --panel: #142019; --fg: #e4eee6; --muted: #93a798; --line: #23352a; --accent: #4cc283; --gold: #e2b43a;
  --plus: #4cd38a; --minus: #ff7a6e; --tag: #1c2c22; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #0d1611; --panel: #142019; --fg: #e4eee6; --muted: #93a798; --line: #23352a; --accent: #4cc283; --gold: #e2b43a;
  --plus: #4cd38a; --minus: #ff7a6e; --tag: #1c2c22; color-scheme: dark }
* { box-sizing: border-box }
body { background: var(--bg); color: var(--fg); font: 15px/1.6 var(--body); margin: 0 }
a { color: var(--accent) }
.wrap { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 40px; max-width: 1180px; margin: 0 auto;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 28px 64px }
.side { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 20px); align-self: start; display: flex; flex-direction: column; gap: 2px; font-size: 14px }
.side a { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; color: var(--fg); text-decoration: none }
.side a:hover, .side a:focus-visible { background: var(--tag); outline: none }
.side a.on { background: var(--tag); font-weight: 600; box-shadow: inset 3px 0 0 var(--char, var(--accent)) }
.side .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--char); flex: none }
.navarch { margin-left: auto; color: var(--muted); font-size: 12px }
.navh { margin: 14px 10px 4px; font: 600 11px/1 var(--body); letter-spacing: .12em; text-transform: uppercase; color: var(--muted) }
main { min-width: 0 }
h1, h2, h3 { font-family: var(--display); line-height: 1.1; text-wrap: balance; margin: 0 }
h1 { font-size: 46px; font-weight: 800; letter-spacing: .01em }
h1.big { font-size: clamp(44px, 7vw, 74px) }
h2 { font-size: 26px; font-weight: 700; margin: 38px 0 12px; padding-top: 10px; border-top: 2px solid var(--line) }
h3 { font-size: 19px; font-weight: 700; margin: 0 0 6px }
.eyebrow { margin: 0 0 6px; font: 600 12px/1.3 var(--body); letter-spacing: .14em; text-transform: uppercase; color: var(--muted) }
.lede { font-size: 17px; max-width: 62ch; color: var(--muted); margin: 10px 0 0 }
.note { color: var(--muted); font-size: 13.5px; max-width: 72ch }
.prose p, .prose li { max-width: 68ch }
.prose ul { padding-left: 20px }
.mono { font-family: var(--mono); font-variant-numeric: tabular-nums }
.hero { padding: 6px 0 4px }
.roster { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px }
.rcard { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto auto; column-gap: 12px; padding: 14px; background: var(--panel);
  border: 1px solid var(--line); border-radius: 8px; color: var(--fg); text-decoration: none; border-top: 4px solid var(--char) }
.rcard:hover, .rcard:focus-visible { border-color: var(--char); outline: none }
.rcard .gn { grid-row: 1 / 4; font: 800 40px/1 var(--display); color: var(--char) }
.rn { font: 700 18px/1.2 var(--display) } .ra { color: var(--muted); font-size: 13px } .rs { font-size: 12px; color: var(--muted) }
.archs { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px }
.arch { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px }
.arch p { margin: 0 0 8px } .arch .who { color: var(--accent); font-weight: 600; font-size: 13px; margin: 0 }
.charhead { display: flex; gap: 18px; align-items: flex-start }
.gate { flex: none; width: 74px; height: 86px; border-radius: 8px; background: var(--char); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center }
.gate .gl { font: 600 11px/1 var(--body); letter-spacing: .15em; text-transform: uppercase; opacity: .85 }
.gate .gn { font: 800 46px/1 var(--display) }
.charhead h1 { color: var(--fg) }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 0; margin: 22px 0 10px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--panel) }
.stats div { padding: 10px 14px; border-right: 1px solid var(--line) } .stats div:last-child { border-right: 0 }
.stats dt { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted) }
.stats dd { margin: 2px 0 0; font: 600 18px/1.2 var(--mono); font-variant-numeric: tabular-nums }
.traits { display: flex; flex-wrap: wrap; gap: 6px; padding: 0; margin: 10px 0 0; list-style: none }
.traits li { background: var(--tag); border-radius: 999px; padding: 3px 11px; font-size: 13px }
.two { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 28px }
.sw { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px 18px; margin-top: 38px; align-self: start }
.sw ul { margin: 0 0 12px; padding-left: 18px } .sw li { margin: 3px 0 }
.tw { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); margin: 10px 0 14px }
table { border-collapse: collapse; width: 100%; font-size: 14px }
th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--line); vertical-align: top }
thead th { font: 600 11px/1.3 var(--body); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); background: var(--tag); white-space: nowrap }
tbody tr:last-child th, tbody tr:last-child td { border-bottom: 0 }
tbody th { font-weight: 600 }
.fd td { font-family: var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap }
.fd td:nth-child(6) { font-family: var(--body) }
.fd tbody th { white-space: nowrap }
.ver { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 4px; background: var(--tag); font: 600 11px/18px var(--mono) }
.plus { color: var(--plus); font-weight: 600 } .minus { color: var(--minus); font-weight: 600 } .even { color: var(--fg) }
.kd { color: var(--gold); font-weight: 600 } .na { color: var(--muted) }
.skills .mv, .combo .mv { font-weight: 600; display: block }
.sub { display: block; color: var(--muted); font-size: 12.5px; font-weight: 400 }
.inp { font-family: var(--mono); white-space: nowrap }
.skills tr.super th .mv { color: var(--char) }
.skills tr.follow th, .skills tr.follow td { padding-top: 0; font-size: 13px; color: var(--muted) }
.combos { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px }
.combo { background: var(--panel); border: 1px solid var(--line); border-left: 4px solid var(--char); border-radius: 8px; padding: 12px 16px }
.combo .ch { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap }
.combo .dmg { color: var(--muted); font-size: 13px }
.combo .seq { font: 15px/1.7 var(--mono); margin: 4px 0 2px }
.combo .sep { color: var(--muted) }
.tag { display: inline-block; background: var(--tag); padding: 0 7px; border-radius: 4px; font: 12px/20px var(--body) }
.tips li { margin: 4px 0; max-width: 70ch }
.ctl td { font-family: var(--mono) }
@media (max-width: 820px) {
  .wrap { grid-template-columns: minmax(0, 1fr); gap: 18px; padding-block: 16px 48px }
  .side { position: static; flex-direction: row; flex-wrap: wrap; gap: 4px }
  .side .navh { display: none } .navarch { display: none }
  .side a { padding: 5px 10px; background: var(--panel); border: 1px solid var(--line) }
  .two { grid-template-columns: minmax(0, 1fr) } .sw { margin-top: 0 }
  h1 { font-size: 38px }
  .stats div { border-right: 0; border-bottom: 1px solid var(--line) }
}
@media (prefers-reduced-motion: no-preference) { .view:not([hidden]) { animation: rise .25s ease-out } @keyframes rise { from { transform: translateY(6px) } to { transform: none } } }
"""

JS = """
const views = [...document.querySelectorAll('.view')], links = [...document.querySelectorAll('[data-go]')];
function show(id) {
  if (!views.some(v => v.dataset.view === id)) id = 'home';
  views.forEach(v => { v.hidden = v.dataset.view !== id; });
  links.forEach(a => a.classList.toggle('on', a.dataset.go === id && a.closest('.side')));
  window.scrollTo(0, 0);
}
links.forEach(a => a.addEventListener('click', e => { e.preventDefault(); const id = a.dataset.go; try { history.replaceState(null, '', '#' + id); } catch (err) {} show(id); }));
show((location.hash || '#home').slice(1));
window.addEventListener('hashchange', () => show(location.hash.slice(1)));
"""

page = f"""<title>Uma Versus Wiki</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;600&family=Saira+Condensed:wght@700;800&display=swap">
<style>{CSS}</style>
<div class="wrap">
{nav()}
<main>
{HOME}
{SYSTEMS}
{''.join(char_page(cid, i) for i, cid in enumerate(ORDER, 1))}
{UPDATE15}
{UPDATE}
</main>
</div>
<script>{JS}</script>
"""
page = page.replace('Mcqueen', 'McQueen')
open(ROOT+'/wiki/index.html', 'w').write(page)
print('wrote', len(page))
