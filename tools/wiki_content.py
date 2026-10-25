"""Wiki text: archetypes, character guides, How to play and the older patch notes.
build_wiki.py imports this and turns it into the page."""
import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import json, html

D = json.load(open(ROOT+'/build/wiki/wiki_data.json'))
CB = json.load(open(ROOT+'/build/wiki/wiki_combos.json'))
BUILD = D['build']
ORDER = ['spe', 'suz', 'gs', 'vo', 'ds', 'mm', 'tt', 'kb', 'jp', 'at', 'mc', 'df']
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
    if v is None: return '<span class="na">-</span>'
    if kind == 'hit' and m['kd'] and v > 25: return '<span class="kd">KD</span>'
    if kind == 'hit' and v > 40: return '<span class="kd">Launch</span>'
    cls = 'plus' if v > 0 else 'minus' if v < 0 else 'even'
    return f'<span class="{cls}">{"+" if v > 0 else ""}{v}</span>'

def num(v): return '<span class="na">-</span>' if v in (None, 0) else str(v)

GUARD = {'mid': 'Mid', 'low': 'Low', 'high': 'Overhead', 'throw': 'Throw', '': '-'}
def guard(g): return ' / '.join(GUARD.get(x, x) for x in g.split('/')) if g else '-'

NORMAL_NAMES = {'5L': 'Standing L', '5M': 'Standing M', '5H': 'Standing H', '2L': 'Crouching L', '2M': 'Crouching M (slide)', '2H': 'Crouching H (launcher)',
                '6M': 'Hop overhead (→M)', 'jL': 'Jumping L', 'jM': 'Jumping M', 'jH': 'Jumping H', 'dL': 'Dash L', 'dM': 'Dash M', 'dH': 'Dash H',
                'throw': 'Throw (L+M)', 'GC': 'Counter Spurt (S+H blocking)'}
NORMAL_ORDER = ['5L', '5M', '5H', '2L', '2M', '2H', '6M', 'jL', 'jM', 'jH', 'dL', 'dM', 'dH', 'throw', 'GC']

# ------------------------------------------------------------------ written content
ARCH = {
  'ALL-ROUNDER': ('A bit of everything', "Has something for every range: a projectile, an anti-air, a way in and a way out. Few matchups are bad for her, and few are good. Good for learning the game."),
  'HIT AND RUN': ('Get in, get out', "Darts in for one hit and leaves before you can answer. Big damage and great escape tools, but low health and not much to do once she's cornered."),
  'RUSHDOWN': ('Stay in their face', "Fast attacks that are plus on block and ways to keep going after a blocked string. Wants to start pressure and never stop. Has a hard time at long range."),
  'VORTEX': ('Knock down, make them guess', "Gets a knockdown that takes away the opponent's wake-up options, then runs a mixup. Guess wrong and you're back on the floor for another one."),
  'BAIT AND PUNISH': ('Make them commit', "Waits for you to do something, then makes you pay for it with long pokes, a counter stance and bonus damage on recovering opponents. Struggles against someone patient."),
  'GLASS CANNON': ('Win fast or lose fast', "Turns one opening into huge damage, but has the least health in the game and barely any defense. Rounds can end in two combos either way."),
  'SHOTO': ('The classic kit', "Fireball, invincible uppercut, an advancing attack. The Ryu and Ken formula: easy to pick up, solid everywhere, a little predictable."),
  'ZONER': ('Control the screen', "Keeps you out with projectiles at different angles and speeds. Low damage, so she wins by chipping away and never letting you in."),
  'GRAPPLER': ('Get close, then grab', "Command grabs that can't be blocked or teched and do huge damage. Lots of health and armor to get in, but slow, and she has to walk through your whole game plan to reach you."),
  'SET-PLAY': ('Set traps, then fight around them', "Puts things on the screen that go off later. Strong once her setup is out, weak while she's building it and on defence."),
  'PUPPET': ('Two bodies at once', "Controls a second fighter. Her skills send the puppet to attack while she does something else, so she can hit you from two places at once. Lose the puppet and she loses most of her offence."),
  'FOOTSIES': ('Win the space', "Walks in and out at the edge of her range, waiting for you to whiff, then punishes. Fast feet and a poke that turns into a combo, but not much defence once you're in."),
}
CHAR = {
  'spe': {
    'plan': ["Special Week has an answer at every range. Dream Shot covers midscreen, Rising Dream stops jump-ins, Spurt Tornado travels in over low pokes and Last Spurt Tackle armors through a hit or a fireball to close the gap.",
             "Her game plan is whatever beats your opponent. Against zoners, walk in behind L Dream Shot and Tackle through their shots. Against rushdown, block and look for a Rising Dream reversal."],
    'strong': ['A tool for every situation', 'EX Rising Dream is fully invincible', 'Simple combos that end in a knockdown'],
    'weak': ['Each specialist does her own job better', 'Rising Dream and Tackle are very punishable on block'],
    'tips': ['L Dream Shot is slow enough to walk or dash in behind.', 'L Rising Dream is less invincible but recovers faster. Use M or EX to beat a meaty.', 'Tackle absorbs one hit, fireballs included. EX absorbs two.'],
  },
  'suz': {
    'plan': ["Land one hit and leave. M Great Escape runs through the opponent and keeps going, and Silent Flicker kicks and then hops way back, so a lot of her moves are minus on paper but safe because she's out of range.",
             "She hits harder than anyone except Teio (×1.1) and she's fast, with a quick dash, a long backdash and the only air dash in the game. The catch is 9,000 health and a reversal that only covers its first few frames. Don't get cornered."],
    'strong': ['×1.1 damage, second only to Teio', 'Moves that leave her out of punish range', 'Air dash and the longest backdash'],
    'weak': ['Below-average health (9,000)', "Lead the Pack's invincibility ends early, L especially", "Not much to do once she's pinned in the corner"],
    'tips': ['L Great Escape stops in front, M runs through. Mix them up so they can\'t punish on reaction.', 'Blocked M Silent Flicker leaves you about 240 px away (200 for L, 270 for EX). Very few moves reach that.', 'Air dash needs some height, and landing out of it has 7 frames of recovery.'],
  },
  'gs': {
    'plan': ["Gold Ship wants her turn and she doesn't want to give it back. 5L is 4 frames, recovers faster than anyone else's and is +2 on block. 2L chains into itself, and Barrage is plus too.",
             "Golshi Rush is where the mixups come from. During the dash you can slide (low), hop chop (overhead), grab (can't be teched) or stop and do something else. Dash cancels (→→ after a normal, 10 Spurt) keep pressure going after a blocked string."],
    'strong': ['Fastest normals in the game (4f 5L, 6f 5M)', 'Lots of plus-on-block pressure', 'Four-way command dash mixup'],
    'weak': ['No invincible reversal attack. EX Golshi Rush is invincible, but it\'s a dash', 'Golshi Dropkick!! is around −22 on block', 'Has a hard time against keep-away'],
    'tips': ['End blocked strings with L Barrage (+5) to keep your turn.', 'Out of the dash: grab beats blocking, slide beats standing guard, chop beats crouching guard.', 'Golshi Mode adds 2 frames of blockstun to everything for 6 seconds, so even more of her stuff is plus.'],
  },
  'vo': {
    'plan': ["Everything starts with a hard knockdown: Full Throttle, Pit Stop, or EX Drift Hop and EX Drift Drop. No quick rise means the opponent always gets up on the same frame, so her setups always line up.",
             "Then make them guess. L Drift Hop lands in front, M crosses over. Meaty 2L is low, Drift Drop and j.M are overheads, and a walk-up Pit Stop beats blocking. Guess wrong and it's another hard knockdown."],
    'strong': ['Consistent setups after hard knockdowns', 'j.L and j.M cross up', "Command grab that only Counter Spurt escapes"],
    'weak': ["Rev Kick only beats air attacks. It isn't invincible on the ground", 'Average neutral. She has to earn that first knockdown', 'Gets readable if you run the same mixup every time'],
    'tips': ['After Full Throttle the opponent is down for exactly 34 frames. Practice the timing in Training.', 'M Drift Hop is an overhead and a cross-up at once.', 'Pit Stop leaves them right next to you for the next mixup. It starts on frame 6, so a jump or backdash on wake-up gets out of it.'],
  },
  'mm': {
    'plan': ["McQueen wants you to move first. 5M and Stayer's Lance outrange almost everything, so walking at her is risky, and swinging at her up close might run into Noble Parry.",
             "Her passive, Punish, gives +20% damage and extra hitstun on the first hit against someone stuck in recovery or a long landing. Whiffed specials, unsafe moves on block and bad jump-ins all turn into big damage. Long-Distance Stride covers the far end of the screen, and the EX goes through projectiles."],
    'strong': ["Stayer's Lance is the longest-reaching poke in the game", 'Counter stance that catches high and low strikes', 'Most health in the cast (10,500)', 'PUNISH! damage'],
    'weak': ['Not much offense of her own', 'Noble Parry loses to throws, and to projectiles unless it\'s EX', 'A patient opponent takes her whole game away'],
    'tips': ["Noble Parry catches strikes from frame 3 but not throws. Use it when you're expecting an attack, not on reflex.", 'Block something unsafe and punish it. The PUNISH! bonus goes on the first hit of your combo.', "EX Stayer's Lance and EX Long-Distance Stride both go through projectiles."],
  },
  'tt': {
    'plan': ["Teio turns one hit into a lot of damage. Her specials chain into each other on hit: after the last hit of one skill, input another and it comes out right away. Each skill once per combo, so a full chain is something like Teio Step › Imperial Rush › Emperor's Rise.",
             "She has the least health in the game (8,000) and Emperor's Rise isn't invincible without meter, so her defense is thin. Below 30% health, Miracle Mode gives her +15% damage for a comeback."],
    'strong': ['Highest damage in the cast (×1.12)', 'Specials chain into each other on hit', 'Miracle Mode comeback below 30%'],
    'weak': ['Lowest health (8,000)', 'No invincible reversal without meter', "Chains only work on hit. A blocked special is just a blocked special"],
    'tips': ["Input the next special after the current one's last hit. The 9-frame buffer gives you a little room.", 'Miracle Leap is an overhead. Mix it with 2L and 2M.', 'EX Teio Step goes through projectiles, so you can start a chain from midrange.'],
  },
  'kb': {
    'plan': ["Kitasan is the textbook shoto. Festival Drum is a fireball with quick recovery, Matsuri Uppercut is the best invincible reversal in the cast, Festival Whirlwind goes over lows, and Kitasan Straight is a step-in punch that's barely minus.",
             "The plan is the classic one: fireball until they jump, uppercut the jump, then use Straight and Whirlwind to take your turn up close. She shares a few tools with Special Week but has stronger fundamentals and a more predictable game plan."],
    'strong': ['Fireball recovers fast (28 frames total)', 'Strongest invincible uppercut (1,300 damage)', 'Whirlwind works on the ground and in the air'],
    'weak': ['Predictable once people learn her', 'Matsuri Uppercut is very punishable on block', 'No armor or counter tools'],
    'tips': ['L Festival Drum is slow enough to walk behind.', 'Sky Whirlwind is an overhead and changes your jump arc.', 'Kitasan Straight is only a little minus. End blocked strings with it.'],
  },
  'jp': {
    'plan': ["Jungle Pocket wants to be right next to you, and when she is, you have to guess. Pocket Buster (→S) is a command grab that does 1,500 (1,750 EX) and can't be blocked or teched. If you block, she grabs. If you try to jump or press a button, her normals and Lion Charge are waiting.",
             "Getting in is the hard part. She walks slowly, but she has the most health in the cast (11,000), Lion Charge armors through a poke, Jungle Rush grabs from half a screen away, and Wild Catch grabs people out of the air. Her super is a grab too, and it can catch someone in hitstun, so it doubles as a combo ender."],
    'strong': ['Command grabs that can\'t be blocked or teched', 'Most health (11,000)', 'Anti-air grab and an armored charge to get in'],
    'weak': ['Slowest walk speed', "Command grabs whiff on anyone jumping, backdashing or in hitstun", 'Very punishable if a grab whiffs'],
    'tips': ['Grabs beat blocking. Once they start jumping to escape, use Wild Catch or 2H instead.', 'Lion Charge absorbs one hit (two with EX). Use it through pokes and fireballs.', "L Pocket Buster has less reach but recovers faster when it misses."],
  },
  'at': {
    'plan': ["Agnes Tachyon fills the floor with potions. Test Tube Toss lobs one that lands and stays as a trap, Delayed Reaction sets a flask that goes off on a timer, and Catalyst sets every potion off at once. Up to three can be out.",
             "Potions arm a moment after they land, then burst when the opponent steps on one. That makes walking forward dangerous, and a knockdown next to a potion is a big setup. The answer is to pop them: any attack or projectile that touches a potion breaks it harmlessly. Her own defence is weak, with no invincible reversal unless she spends meter."],
    'strong': ['Controls where the opponent can walk', 'Catalyst lets her set off potions whenever she wants', 'Strong setups after a knockdown'],
    'weak': ['Low health (9,000)', 'Overdose Spark only beats air attacks without meter', 'Slow to set up, and any hit pops a potion'],
    'tips': ['L Test Tube Toss lands close and can hit them in a combo. M lands farther away as a trap.', 'Delayed Reaction on a knocked-down opponent goes off as they get up.', "Bursts are blocked by holding away from Tachyon, wherever the potion is. Block them like any other attack."],
  },
  'mc': {
    'plan': ["Manhattan Cafe's skills send her Friend, Sunday Silence, to attack for her. Phantom Rush charges across the screen, Shadow Sweep is a low, Night Drop falls from above as an overhead, and Rising Shade is an anti-air. Cafe recovers almost right away, so she can attack at the same time.",
             "That means a low from Cafe and an overhead from the Friend at once, or a Friend rush that keeps you blocking while Cafe walks in. The Friend takes one command at a time and has to come back before the next. Hitting her while she attacks sends her away, and Cafe is much weaker without her."],
    'strong': ['Attacks from two places at once', 'High-low mixups with the Friend', 'Recovers early from every skill'],
    'weak': ['Hit the Friend and Cafe loses her offence', 'No invincible reversal without meter', 'One command at a time'],
    'tips': ['Night Drop takes a moment to fall, so time it with a low from Cafe.', 'Phantom Rush hits after Cafe has recovered, so you can link 5M after it.', 'EX skills make Cafe invincible as well.'],
  },
  'df': {
    'plan': ["Dantsu Flame wins the space in front of her. She has the fastest walk in the cast, a quick dash and backdash, and normals that recover fast, so she can step into range, poke, and step back out before you answer.",
             "Flame Thrust (S) is her signature: a long poke that's safe on block at the tip. If it hits, press S again for Flame Twist, which launches into a combo. Whiff a button near her and she punishes with it from range. The Cheese Wheel rolls in low over a short distance, so it controls the ground in front of her instead of zoning."],
    'strong': ['Fastest walk speed (4.0)', 'A poke that turns into a combo on hit', 'Footwork (→S) steps in or out in an instant'],
    'weak': ['Fromage Rising only beats air attacks without meter', "Average health and no armor", 'Needs to win neutral to get anything'],
    'tips': ['Only press S for Flame Twist when Flame Thrust hits. On block it never comes out.', 'EX Cheese Wheel adds a cheese wedge in an arc, so it covers a jump and the ground at once.', 'EX Footwork goes right through them to the other side.'],
  },
  'ds': {
    'plan': ["Daiwa keeps you where she wants you. Scarlet Shot goes straight and she can have two out, High Top Line angles up to stop jumps, Ground Rose runs along the floor and Sky Shot fires down from the air.",
             "Rose Barrier reflects projectiles and knocks away anyone too close, which puts them back at shooting range. She has the lowest damage in the cast (×0.95) and a slow dash, so she wins by chipping away."],
    'strong': ['Projectiles at four different angles', 'Reflector that also pushes people out', 'Long normals and a good backdash'],
    'weak': ['Lowest damage (×0.95)', 'Slowest dash', 'In trouble once someone gets in'],
    'tips': ["Mix Ground Rose (low) with Scarlet Shot (mid) so they can't just block one way.", 'L High Top Line is flatter and covers a forward jump. M is steeper for jumps from closer in.', 'EX Rose Barrier has the longest reflect window.', 'Number One Finish fires a volley of shots. Use it to punish a whiff or a dash from midrange, or to end a combo.'],
  },
}

SYSTEMS = f"""
<section class="view" id="v-systems" data-view="systems" hidden>
  <p class="eyebrow">Reference</p><h1>How to play</h1>
  <div class="prose">
  <h2>Default controls</h2>
  <p>You can rebind everything under <b>Controls</b> on the main menu.</p>
  <div class="tw"><table class="ctl"><thead><tr><th>Action</th><th>Player 1</th><th>Player 2</th><th>Gamepad</th></tr></thead><tbody>
  <tr><th>Move / jump / crouch</th><td>W A S D</td><td>Arrow keys</td><td>D-pad / left stick</td></tr>
  <tr><th>Light (L)</th><td>F</td><td>J or Num1</td><td>X / □</td></tr><tr><th>Medium (M)</th><td>G</td><td>K or Num2</td><td>Y / △</td></tr>
  <tr><th>Heavy (H)</th><td>H</td><td>L or Num3</td><td>B / ○</td></tr><tr><th>Skill (S)</th><td>T</td><td>I or Num5</td><td>A / ✕</td></tr>
  <tr><th>Throw (L+M)</th><td>R</td><td>U or Num4</td><td>LB</td></tr><tr><th>Super (S+H)</th><td>Y</td><td>O or Num6</td><td>RB</td></tr>
  <tr><th>Taunt (L+H)</th><td>E</td><td>P or Num7</td><td>Back</td></tr><tr><th>Pause</th><td colspan="3">Esc / Start</td></tr></tbody></table></div>

  <h2>Notation</h2>
  <p>Directions use numpad notation with the character facing right: <b>5</b> is neutral, <b>2</b> down, <b>6</b> forward, <b>4</b> back. So <b>5M</b> is standing medium, <b>2M</b> crouching medium and <b>j.H</b> jumping heavy. <b>236</b> is ↓↘→, <b>623</b> is →↓↘, <b>214</b> is ↓↙← and <b>41236</b> is ←↙↓↘→. In combos, <b>›</b> means cancel or link into the next move.</p>

  <h2>Defense</h2>
  <ul>
  <li>Hold back to block, and down-back to block lows. Overheads (jumping attacks, hops, dive kicks) have to be blocked standing.</li>
  <li>Holding back during a dash cancels it, so you can block straight out of one.</li>
  <li>L+M up close throws, and holding back throws the other way. Throws beat blocking, but you can't combo after a normal throw. Press L+M as a throw connects to tech it. Command grabs ignore L+M, but S+H as one connects breaks it with Counter Spurt (50 Spurt).</li>
  <li><b>Counter Spurt</b>: S+H while blocking. Costs 50 Spurt and knocks them away.</li>
  <li>Backdash (←←) gets you out of throws, but it isn't invincible to attacks, so a quick hit still catches it, especially in the corner.</li>
  <li>While knocked down, hold any attack button to get up early or hold ↓ to get up late. You can't do either after a hard knockdown (throws, command grabs, supers and some skills like Vodka's Full Throttle).</li>
  </ul>

  <h2>Skills and Spurt</h2>
  <ul>
  <li>Skill motion + <b>L</b> or <b>M</b> gives the two free versions. Motion + <b>H</b> is the <b>EX</b> version and costs 50 Spurt. Without 50 Spurt you get the M version.</li>
  <li>There's also a shortcut: S, →S, ←S or ↓S does the M version without the motion, but it goes on cooldown and does 10% less damage.</li>
  <li>Spurt builds as you deal and take damage. It pays for EX skills (50), Counter Spurt (50), Gold Ship's dash cancel (10) and supers (100).</li>
  </ul>

  <h2>Combos</h2>
  <ul>
  <li>Normals chain into stronger normals: L › M › H.</li>
  <li>Mashing L on hit does an auto-combo: 5L › 5M › 5H › skill.</li>
  <li>Any normal that connects can be cancelled into a skill or a super.</li>
  <li>After a launcher (2H, or the second hit of 5H), hold ↑ to jump after them for an air combo.</li>
  <li>The input buffer is 9 frames, and it remembers the direction and motion you entered, so inputs during hitstop still come out right.</li>
  </ul>
  <h2>Scaling and limits</h2>
  <ul>
  <li><b>Damage scaling</b>: the first hit does full damage. After that it depends on the starter (lights 80%, mediums 90%, heavies, counter hits and punishes 100%), then drops 13% per hit from the 3rd hit down to a floor of 25%. Supers keep at least 50%. The combo counter shows the scaling on the next hit.</li>
  <li><b>Juggle points</b>: hits on an airborne opponent cost juggle points (normals 1, skills 2, bounces 1). At 10 you can't hit them in the air anymore.</li>
  <li><b>Ground bounce</b>: j.H in an air combo slams them into the floor and they bounce back up for a 2H relaunch. Once per combo.</li>
  <li><b>Wall bounce</b>: some EX knockdowns bounce them off the corner or the edge of the screen. Once per combo.</li>
  <li><b>Hitstun decay</b>: after 2 seconds of combo, hits do less hitstun and juggled opponents fall faster.</li>
  <li><b>Combo limit</b>: after 32 hits or 7 seconds, hits pass through and they drop out.</li>
  <li><b>Link</b> in a combo means wait until you recover, then start the next move.</li>
  </ul>

  <h2>Movement</h2>
  <ul>
  <li>Double-tap → to dash, ←← to backdash. L, M or H during a dash (or →→ + button) is a dash attack: L jab, M lunge, H leaping overhead kick.</li>
  <li>You can also bind a <b>Dash</b> button in Controls. It types →→ for you (← + Dash for a backdash), and Dash + L/M/H does a dash attack.</li>
  <li>→+M is a hop overhead. You're briefly airborne, so lows beat it.</li>
  <li>Only Silence Suzuka can air dash. She needs some height, can't attack for the first 8 frames, and has landing recovery.</li>
  </ul>

  <h2>Accounts</h2>
  <ul>
  <li>Accounts are optional and guests can play every mode. Make one from <b>Account</b> on the main menu.</li>
  <li>Your display name shows up for your opponent online.</li>
  <li>Controls, volume, Options, combo trial, tutorial and Arcade progress are saved to your account and come back when you sign in somewhere else.</li>
  <li><b>Friends</b>: add someone by display name. Once you've both added each other you can see when they're online and invite them to your room.</li>
  <li><b>Leaderboards</b> rank players by online wins, win rate and matches. Only matches both players recorded count.</li>
  <li>Online matches you finish while signed in are saved, and the Account screen shows your record, win rate and most-played runner. VS CPU matches aren't counted.</li>
  </ul>

  <h2>Training, replays and online</h2>
  <ul>
  <li><b>Training</b> shows damage, scaling, juggle points, frame advantage and hitboxes. Keys: 1 dummy, 2 dummy guard, 3 hitboxes, 4 reset, 5 input display, 6 frame meter, 7 record dummy, 8 play recording.</li>
  <li>The <b>frame meter</b> shows one cell per frame for both players: green startup, red active, blue recovery, yellow stun, outlined when invincible. It also shows your startup and the frame advantage.</li>
  <li><b>Dummy recording</b>: 7 to take control of the dummy and record up to 10 seconds, 7 again to stop, then 8 to have it loop while you practice.</li>
  <li><b>Combo trials</b> has every runner's combos as challenges, with a demo on 9. Cleared trials are saved.</li>
  <li><b>Replays</b>: every Versus, VS CPU and online match is recorded. R on the results screen watches it, D saves the file.</li>
  <li><b>Tutorial</b> walks through the basics in seven short lessons, from walking to supers, and checks each step as you do it.</li>
  <li><b>Arcade</b> is seven CPU races that get harder, then your runner's rival as the final race, then her ending. Clear times are saved.</li>
  <li><b>Online</b> uses rollback netcode and room codes. Hosts can list their room so anyone can find it, and let people watch. Both players need the same build, and this wiki is for build <b class="mono">{BUILD}</b>.</li>
  <li><b>Colours</b>: every runner has six colour palettes. Press ↑ ↓ on character select (M in the online lobby).</li>
  </ul>
  </div>
</section>"""

UPDATE15 = f"""
<section class="view" id="v-update15" data-view="update15" hidden>
  <p class="eyebrow">Patch notes · build {BUILD}</p><h1>Update 1.5</h1>
  <div class="prose">
  <p>Team Spica is complete. Three new characters bring the roster to eight.</p>
  <h2>New characters</h2>
  <ul><li><b>Mejiro McQueen</b> (Bait and Punish): long pokes, the Noble Parry counter stance, and a Punish passive that adds 20% damage on recovering opponents. Most health in the cast.</li>
  <li><b>Tokai Teio</b> (Glass Cannon): specials chain into each other on hit for the biggest combos in the game. Least health, no free reversal, and Miracle Mode below 30% health.</li>
  <li><b>Kitasan Black</b> (Shoto): fireball, invincible uppercut, a whirlwind kick on the ground and in the air, and a step-in punch.</li></ul>
  <h2>Systems</h2>
  <ul><li>New move properties: counter stances, moves that pass through projectiles (several EX moves), special chains and comeback damage.</li>
  <li>The move list shows each character's passive traits.</li>
  <li>McQueen's CPU waits, pokes, and uses Noble Parry when you swing at her up close.</li></ul>
  <h2>Online</h2>
  <ul><li>Both players need build <b class="mono">{BUILD}</b>. Older builds can't connect.</li></ul>
  </div>
</section>"""

UPDATE = f"""
<section class="view" id="v-update1" data-view="update1" hidden>
  <p class="eyebrow">Patch notes · build {BUILD}</p><h1>Update 1</h1>
  <div class="prose">
  <h2>New</h2>
  <ul><li>Three new characters: <b>Gold Ship</b> (Rushdown), <b>Vodka</b> (Vortex) and <b>Daiwa Scarlet</b> (Zoner).</li>
  <li>Control mapping for keyboard and gamepad, saved in your browser.</li>
  <li>Every character has her own animation timing, taunt, intro, win pose and effects.</li>
  <li>A Combos page in the in-game move list, and this wiki.</li></ul>
  <h2>Gameplay</h2>
  <ul><li>EX rework: motion + L and M are the free versions, motion + H is the EX and costs 50 Spurt. The Skill button no longer does EX.</li>
  <li>The guard button is gone. Block by holding back. Taunt moved to L+H.</li>
  <li>Holding back cancels a dash instantly.</li>
  <li>Walk and dash speeds are closer together, backdash invincibility is shorter (4 frames for most), double jump is gone, and air dash now needs height, can't attack for 8 frames and has landing recovery.</li>
  <li>Combos: a 9-frame input buffer that remembers your direction and motion, a bit more hitstun on normals, less pushback on hit, easier juggles, higher 5H launchers, and jump cancels only after a launcher.</li>
  <li>Projectiles can now travel at angles, along the ground and from the air, two can be out at once, and they can be reflected.</li></ul>
  <h2>Characters</h2>
  <ul><li><b>Special Week</b> is now an All-Rounder. Guts! is replaced by Last Spurt Tackle, an armored charge.</li>
  <li><b>Silence Suzuka</b> is now Hit and Run: new Silent Flicker (kick, then hop away), Turbine Roll moved to ←↙↓↘→, teleport and double jump removed, +10% damage, 8,500 health.</li>
  <li><b>Gold Ship</b>: the H versions of her skills are now EX versions.</li></ul>
  </div>
</section>"""
