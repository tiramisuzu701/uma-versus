"""Uma Versus wiki, Mizuumi-style: character pages with an infobox, move cards (sprite on the
move's first active frame + hitbox overlay drawn from the game data), frame data tables and combos.
Written content (game plans, archetypes, How to play, patch notes) lives in wiki_content.py."""
import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import json, html, base64, io
from PIL import Image

src = open(ROOT+'/tools/wiki_content.py').read()
exec(src)          # D, CB, BUILD, ORDER, ARCH, CHAR, SYSTEMS, UPDATE15, UPDATE, helpers
FR = json.load(open(ROOT+'/build/wiki/wiki_frames.json'))
STG = json.load(open(ROOT+'/build/wiki/wiki_stages.json'))
def _png(path, w=None):
    im = Image.open(path)
    if w and im.width > w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
VERSION = __import__('re').search(r"const VERSION = '([^']+)'", open(ROOT+'/src/ui.js').read()).group(1)
LOGO = _png(ROOT+'/assets/art/logo.png', 720); ICON = _png(ROOT+'/assets/art/icon-64.png')
E = html.escape
nm = lambda cid: D['chars'][cid]['name'].title().replace('Mcqueen', 'McQueen')
archname = lambda a: a.title().replace(' And ', ' and ')

# ------------------------------------------------------------------ sprites
ATL = {}
def atlas(cid):
    if cid not in ATL:
        j = json.load(open(ROOT+f'/assets/sprites/{cid}.json'))
        im = Image.open(io.BytesIO(base64.b64decode(j['imgR'].split(',')[1]))).convert('RGBA')
        ATL[cid] = (im, j['anims'], j['cols'])
    return ATL[cid]
def cell(cid, anim, fi):
    im, anims, cols = atlas(cid)
    a = anims.get(anim)
    if not a: return Image.new('RGBA', (64, 64))
    i = a[0] + min(fi, a[1] - 1)
    c = im.crop(((i % cols) * 64, (i // cols) * 64, (i % cols) * 64 + 64, (i // cols) * 64 + 64))
    return c.transpose(Image.FLIP_LEFT_RIGHT)          # facing right = mirrored "r" layer, as in the game
def head(cid):
    c = cell(cid, '800', 0); bb = c.getbbox() or (0, 0, 64, 64)
    cx = (bb[0] + bb[2]) // 2; return c.crop((cx - 13, bb[1], cx + 13, bb[1] + 26))
def uri(img):
    b = io.BytesIO(); img.save(b, 'PNG', optimize=True); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
def strip(cid, anim, scale=3):
    im, anims, cols = atlas(cid); n = anims[anim][1]
    s = Image.new('RGBA', (64 * scale * n, 64 * scale))
    for i in range(n): s.paste(cell(cid, anim, i).resize((64 * scale, 64 * scale), Image.NEAREST), (i * 64 * scale, 0))
    return uri(s), n

# move image: game pixels around the fighter, x -100..230, 270 tall, following her up for air moves
VW, VH, OX = 330, 270, 100
def oy(f):
    boxes = f['hits'] + f['grab'] + f['refl'] + [b[:4] for b in f['projs']] + ([f['hurt']] if f['hurt'] else [])
    top = min([f['y'] - 200] + [b[1] - 10 for b in boxes])
    return -top
def move_img(cid, f):
    can = Image.new('RGBA', (VW, VH)); OY = oy(f)
    sp = cell(cid, f['anim'], f['fi']).resize((192, 192), Image.NEAREST)
    can.alpha_composite(sp, (OX - 96, OY + f['y'] - 192))
    return uri(can)
def overlay(f):
    OY = oy(f)
    r = lambda b, cls: f'<rect class="{cls}" x="{b[0] + OX}" y="{b[1] + OY}" width="{b[2]}" height="{b[3]}"/>'
    parts = [f'<line class="gl" x1="0" y1="{OY}" x2="{VW}" y2="{OY}"/>'] if OY < VH else []
    if f['hurt']: parts.append(r(f['hurt'], 'hu'))
    for b in f['refl']: parts.append(r(b, 'rf'))
    for b in f['grab']: parts.append(r(b, 'gr'))
    for b in f['hits']: parts.append(r(b, 'hi'))
    for b in f['projs']: parts.append(r(b, 'pj'))
    return f'<svg class="box" viewBox="0 0 {VW} {VH}" aria-hidden="true">{"".join(parts)}</svg>'

# ------------------------------------------------------------------ move descriptions
NORMAL_DESC = {
  '5L': 'Fastest standing attack. Chains into 5M or 5H, cancels into skills, and starts the auto-combo if you mash L.',
  '5M': 'Midrange poke with a small step forward. Cancels into 5H and skills.',
  '5H': 'Two hits. The second launches, and you can jump cancel it (hold ↑) for an air combo.',
  '2L': 'Fast low jab.',
  '2M': 'Sliding low kick that travels forward. Good starter from a distance.',
  '2H': 'Launcher, and an anti-air: the upper body beats air attacks during startup. Jump cancel on hit.',
  '6M': "Hop overhead. You're airborne, so lows beat it.",
  'jL': 'Fast air attack.', 'jM': 'Air attack.', 'jH': 'Strongest air attack and the usual jump-in.',
  'dL': 'Quick dash jab that combos into 5M. →→ + L, or L during a dash.',
  'dM': 'Long dash lunge. →→ + M.',
  'dH': 'Leaping overhead kick that knocks down. →→ + H.',
  'throw': 'L + M up close, hold back to throw the other way. Beats blocking. Tech with L + M.',
  'GC': 'S + H while blocking, 50 Spurt. Invincible and knocks them away.',
}
EXTRA = {('vo', 'jL'): 'Also hits behind her, so it crosses up.', ('vo', 'jM'): "Wide hitbox that hits behind her. Vodka's main cross-up.",
         ('gs', '2L'): 'Chains into itself.', ('gs', '5L'): 'Plus on block. Her pressure starts here.',
         ('ds', '5M'): 'Very long for a medium.', ('mm', '5M'): 'One of the longest pokes in the game.',
         ('suz', '5M'): 'Good reach and quick startup.'}
NAMES = {**NORMAL_NAMES, '2M': 'Crouching M', '2H': 'Crouching H', '6M': 'Hop Overhead', 'throw': 'Throw', 'GC': 'Counter Spurt'}
NOTATION = {'throw': 'L+M', 'GC': 'S+H (blocking)', '6M': '6M', 'dL': '66L', 'dM': '66M', 'dH': '66H', 'jL': 'j.L', 'jM': 'j.M', 'jH': 'j.H'}

def props(cid, mid, f, m):
    """bullet list of properties read from the data"""
    out = []
    if f['inv'] or m['inv']:
        iv = m['inv']; out.append(f'Invincible on frames {iv[0]}–{iv[1]}.' if iv else 'Invincible.')
    if f.get('aaInv'): out.append(f'Beats air attacks on frames {f["aaInv"][0]}–{f["aaInv"][1]}, but not ground attacks.')
    if f.get('armor'): out.append(f'{f["armorHits"]}-hit armor on frames {f["armor"][0]}–{f["armor"][1]}.')
    if f.get('projInv'): out.append(f'Passes through projectiles on frames {f["projInv"][0]}–{f["projInv"][1]}.')
    if f.get('cw'): out.append(f'Catches strikes on frames {f["cw"][0]}–{f["cw"][1]}' + (' and parries projectiles.' if f['cproj'] else '. Throws and projectiles beat it.'))
    if m['hard']: out.append('Hard knockdown (no quick rise).')
    elif m['kd'] and mid not in ('GC', 'dH'): out.append('Knocks down.')
    if f['projs']: out.append('Projectile.')
    return out

# ------------------------------------------------------------------ html pieces
def advc(v, m, kind): return adv(v, m, kind)
def recov(m):
    if m['startup'] and m['active']: return m['total'] - (m['startup'] + m['active'] - 1)
    if m['startup']: return m['total'] - m['startup']
    return None
def inv_cell(cid, m, f):
    t = []
    if m['inv']: t.append(f'{m["inv"][0]}–{m["inv"][1]}')
    if f and f.get('aaInv'): t.append(f'Air {f["aaInv"][0]}–{f["aaInv"][1]}')
    if f and f.get('armor'): t.append(f'Armor {f["armor"][0]}–{f["armor"][1]}')
    if f and f.get('projInv'): t.append(f'Proj {f["projInv"][0]}–{f["projInv"][1]}')
    if f and f.get('cw'): t.append(f'Counter {f["cw"][0]}–{f["cw"][1]}')
    return ', '.join(t) or '<span class="na">-</span>'
def data_row(cid, m, label, f):
    return (f'<tr>{"<th scope=row>" + label + "</th>" if label is not None else ""}<td>{m["dmg"] or "-"}</td><td>{guard(m["guard"])}</td><td>{num(m["startup"])}</td><td>{num(m["active"])}</td>'
            f'<td>{num(recov(m))}</td><td>{airmark(advc(m["onBlock"], m, "block"), m)}</td><td>{airmark(advc(m["onHit"], m, "hit"), m)}</td><td class="iv">{inv_cell(cid, m, f)}</td></tr>')
def airmark(cell, m):   # air attacks: best case (lowest possible hit), flagged with *
    return cell + '<span class="am" title="Best case: hitting as low as possible before landing">*</span>' if m.get('airAdv') and 'class="na"' not in cell else cell
HEAD = '<tr>{}<th>Damage</th><th>Guard</th><th>Startup</th><th>Active</th><th>Recovery</th><th>On-Block</th><th>On-Hit</th><th>Invuln</th></tr>'

def figure(cid, mid, alt):
    f = FR[cid]['moves'].get(mid)
    if not f: return ''
    return (f'<figure class="mimg"><div class="frame"><img src="{move_img(cid, f)}" alt="{E(alt)}">{overlay(f)}</div>'
            f'<figcaption>Frame {f["t"]}</figcaption></figure>')

def move_card(cid, mid, mv):
    m = mv[mid]; f = FR[cid]['moves'].get(mid, {})
    desc = [NORMAL_DESC.get(mid, '')] + ([EXTRA[(cid, mid)]] if (cid, mid) in EXTRA else []) + props(cid, mid, f, m)
    return f"""<article class="move" id="{cid}.{mid}">
  <header class="mhead"><h4>{E(NAMES.get(mid, mid))}</h4><span class="minput">{E(NOTATION.get(mid, mid))}</span></header>
  <div class="mbody">{figure(cid, mid, NAMES.get(mid, mid))}
    <div class="mdata"><div class="tw"><table class="mft"><thead>{HEAD.format('')}</thead><tbody>{data_row(cid, m, None, f)}</tbody></table></div>
    <ul class="mnotes">{''.join(f'<li>{E(x)}</li>' for x in desc if x)}</ul></div></div></article>"""

def skill_card(cid, m, mv):
    rows, notes = '', []
    vers = [(m['id'] + '.L', 'L'), (m['id'], 'M' if (m['id'] + '.L') in mv else 'L / M'), (m['id'] + 'X', 'EX')]
    for vid, lab in vers:
        if vid in mv: rows += data_row(cid, mv[vid], f'<span class="ver">{lab}</span>', FR[cid]['moves'].get(vid))
    for fm in D['chars'][cid]['moves']:
        if fm['followOf'] == m['id']: rows += data_row(cid, fm, '› ' + E(fm['name']), FR[cid]['moves'].get(fm['id']))
    if m['note']: notes.append(m['note'] + '.')
    if m['vnote']: notes.append(m['vnote'].replace(' · ', ', ') + '.')
    if m['exNote']: notes.append('EX: ' + m['exNote'] + '.')
    if m['fnote']: notes.append(m['fnote'][0].upper() + m['fnote'][1:].replace(' · ', ', ') + '.')
    notes += props(cid, m['id'], FR[cid]['moves'].get(m['id'], {}), m)
    if m['input']: notes.append(f'Shortcut: {m["input"]} (M version, with a cooldown and 10% less damage).')
    inp = arrows(m['motion']) + ' + L / M / H'
    return f"""<article class="move skill" id="{cid}.{m['id']}">
  <header class="mhead"><h4>{E(m['name'])}</h4><span class="minput">{m['motion']}X <span class="arw">{inp}</span></span></header>
  <div class="mbody">{figure(cid, m['id'], m['name'])}
    <div class="mdata"><div class="tw"><table class="mft"><thead>{HEAD.format('<th>Version</th>')}</thead><tbody>{rows}</tbody></table></div>
    <ul class="mnotes">{''.join(f'<li>{E(x)}</li>' for x in notes)}</ul></div></div></article>"""

def super_card(cid, mv):
    m = mv.get('SU')
    if not m: return ''
    return f"""<article class="move super" id="{cid}.SU">
  <header class="mhead"><h4>{E(m['name'])}</h4><span class="minput">S+H</span></header>
  <div class="mbody">{figure(cid, 'SU', m['name'])}
    <div class="mdata"><div class="tw"><table class="mft"><thead>{HEAD.format('')}</thead><tbody>{data_row(cid, m, None, FR[cid]['moves'].get('SU'))}</tbody></table></div>
    <ul class="mnotes">{''.join(f'<li>{x}</li>' for x in super_notes(cid, m))}</ul></div></div></article>"""
def super_notes(cid, m):
    if m.get('shots'):
        return ['Full Spurt gauge (100). Invincible on frames 1–20.',
                f'A volley of {m["shots"] - 1} golden roses and one big finishing rose. Each shot is its own projectile, so they can hit, get blocked or miss separately.',
                f'Up close to midrange all six hit for {m["dmg"]:,} and end in a hard knockdown. From full screen, or against a juggled or crouching opponent, some can fly past.',
                "Goes through normal projectiles and can't be reflected. Costs no juggle points, so it works as a combo ender.",
                'Punishable on block up close, safe from range.']
    return ['Full Spurt gauge (100).', 'Invincible sprint. If the first hit lands, the whole cinematic plays out, even on a juggled opponent. Cancel into it at the end of a combo.']

def sprite_box(cid, anim, cls, scale=3, spd=0.13):
    u, n = strip(cid, anim, scale)
    return f'<span class="spr {cls}" style="--n:{n};--d:{n * spd:.2f}s;background-image:url({u})" role="img" aria-label="{E(nm(cid))}"></span>'

def char_page(cid, idx):
    c = D['chars'][cid]; t = CHAR[cid]; col = c['color']; mv = {m['id']: m for m in c['moves']}
    arch_t, arch_d = ARCH[c['arch']]
    traits = []
    if c['flags']['airDash']: traits.append('Air dash')
    if c['flags']['lightChain']: traits.append('2L chains into itself')
    if c['flags']['dashCancel']: traits.append('Dash cancel (10 Spurt)')
    if c['flags']['projMax'] > 1: traits.append(f"{c['flags']['projMax']} projectiles on screen")
    if c['flags'].get('punisher'): traits.append('Punish: +20% on recovering foes')
    if c['flags'].get('specialChain'): traits.append('Special chain on hit')
    if c['flags'].get('lowHpBoost'): traits.append('Miracle Mode below 30% HP')
    if c['backdash']: traits.append(f"Long backdash ({c['backdash']['inv']}f invuln)")
    infobox = f"""<aside class="infobox" style="--char:{col}">
  <div class="ibtitle">{E(nm(cid))}</div>
  <div class="ibport">{sprite_box(cid, '800', 'big')}</div>
  <table><tbody>
   <tr><th>Archetype</th><td>{E(archname(c['arch']))}</td></tr>
   <tr><th>Health</th><td>{c['hp']:,}</td></tr>
   <tr><th>Damage</th><td>×{c['flags']['dmgMul']:g}</td></tr>
   <tr><th>Walk speed</th><td>{c['walk']:g}</td></tr><tr><th>Back walk</th><td>{c['back']:g}</td></tr>
   <tr><th>Dash speed</th><td>{c['dash']:g}</td></tr><tr><th>Jump</th><td>{abs(c['jumpV']):g}</td></tr>
   {'<tr><th>Traits</th><td>' + '<br>'.join(E(x) for x in traits) + '</td></tr>' if traits else ''}
  </tbody></table></aside>"""
    skills = [m for m in c['moves'] if m['kind'] in ('special', 'throw') and m['motion'] and not m['isEx'] and not m['varOf'] and not m['followOf']]
    groups = [('Standing', ['5L', '5M', '5H']), ('Crouching', ['2L', '2M', '2H']), ('Jumping', ['jL', 'jM', 'jH']),
              ('Command and dash attacks', ['6M', 'dL', 'dM', 'dH']), ('Universal', ['throw', 'GC'])]
    normals = ''.join(f'<h3 id="{cid}.g{i}">{g}</h3>' + ''.join(move_card(cid, k, mv) for k in ks if k in mv) for i, (g, ks) in enumerate(groups))
    combos = ''.join(f"""<tr><td class="cseq">{notation(cb['seq'])}</td><td class="num">{cb['dmg']:,}</td><td class="num">{cb['hits']}</td><td>{'★ ' if cb.get('level', 1) > 1 else ''}{E(cb['name'])}{' (corner)' if cb.get('corner') else ''}: {E(cb['note'])}</td></tr>""" for cb in CB[cid])
    toc = [('overview', 'Overview'), ('normals', 'Normal moves'), ('skills', 'Skills'), ('super', 'Super'), ('combos', 'Combos'), ('tips', 'Tips')]
    return f"""
<section class="view char" id="v-{cid}" data-view="{cid}" style="--char:{col}" hidden>
  <p class="crumb"><a href="#home" data-go="home">Uma Versus</a> › Characters › {E(nm(cid))}</p>
  <h1 class="ptitle">{E(nm(cid))}</h1>
  <p class="tagline">From Uma Versus Wiki · build {BUILD}</p>
  {infobox}
  <p class="lead"><b>{E(nm(cid))}</b> is the {E(archname(c['arch']).lower())} of the cast. {E(c['blurb'].split('. ', 1)[1])}</p>
  <nav class="toc" aria-label="Contents"><p class="toch">Contents</p><ol>{''.join(f'<li><a href="#{cid}.{a}">{b}</a></li>' for a, b in toc)}</ol></nav>
  <h2 id="{cid}.overview">Overview</h2>
  <p class="archline"><b>{E(archname(c['arch']))}: {E(arch_t)}.</b> {E(arch_d)}</p>
  {''.join(f'<p>{E(p)}</p>' for p in t['plan'])}
  <div class="sw"><div class="pro"><p class="swh">Strengths</p><ul>{''.join(f'<li>{E(x)}</li>' for x in t['strong'])}</ul></div>
    <div class="con"><p class="swh">Weaknesses</p><ul>{''.join(f'<li>{E(x)}</li>' for x in t['weak'])}</ul></div></div>
  <h2 id="{cid}.normals">Normal moves</h2>
  <p class="note">Images show the first active frame, with <span class="k hi"></span> hitboxes and the <span class="k hu"></span> hurtbox (<span class="k gr"></span> is throw range). Frame data is taken from the game at close range. <b>*</b> Air attacks and hops: the best case, hitting as low as possible right before landing. Hit higher and they're less plus.</p>
  {normals}
  <h2 id="{cid}.skills">Skills</h2>
  <p class="note">Motion + L or M for the free versions, + H for EX (50 Spurt). Images show the M version. <b>*</b> = best case for air moves (hitting as low as possible).</p>
  {''.join(skill_card(cid, m, mv) for m in skills)}
  <h2 id="{cid}.super">Super</h2>
  {super_card(cid, mv)}
  <h2 id="{cid}.combos">Combos</h2>
  <p class="note">The same combos as the Combo Trials mode (★ = advanced). Damage is with scaling, on build {BUILD}.</p>
  <div class="tw"><table class="ctab"><thead><tr><th>Combo</th><th>Damage</th><th>Hits</th><th>Notes</th></tr></thead><tbody>{combos}</tbody></table></div>
  <h2 id="{cid}.tips">Tips</h2><ul>{''.join(f'<li>{E(x)}</li>' for x in t['tips'])}</ul>
</section>"""

def side():
    chars = ''.join(f'<li><a href="#{cid}" data-go="{cid}"><img class="ico" src="{uri(head(cid))}" alt="">{E(nm(cid))}</a></li>' for cid in ORDER)
    return f"""<nav class="side" aria-label="Wiki">
  <div class="portal"><p class="ph">Navigation</p><ul><li><a href="#home" data-go="home">Main page</a></li><li><a href="#systems" data-go="systems">How to play</a></li></ul></div>
  <div class="portal"><p class="ph">Characters</p><ul>{chars}</ul></div>
  <div class="portal"><p class="ph">Game</p><ul><li><a href="#stages" data-go="stages">Stages</a></li></ul></div>
  <div class="portal"><p class="ph">Patch notes</p><ul><li><a href="#update18" data-go="update18">Update 1.8</a></li><li><a href="#update17" data-go="update17">Update 1.7</a></li><li><a href="#update16" data-go="update16">Update 1.6</a></li><li><a href="#update15" data-go="update15">Update 1.5</a></li><li><a href="#update1" data-go="update1">Update 1</a></li></ul></div>
</nav>"""

roster2 = ''.join(f"""<a class="rcard" href="#{cid}" data-go="{cid}" style="--char:{D['chars'][cid]['color']}">{sprite_box(cid, '800', 'mid')}
  <span class="rn">{E(nm(cid))}</span><span class="ra">{E(archname(D['chars'][cid]['arch']))}</span></a>""" for cid in ORDER)
archrows = ''.join(f"""<tr><th scope="row">{E(archname(a))}</th><td>{E(t)}. {E(d)}</td><td>{', '.join(f'<a href="#{cid}" data-go="{cid}">{E(nm(cid))}</a>' for cid in ORDER if D['chars'][cid]['arch'] == a)}</td></tr>""" for a, (t, d) in ARCH.items())
HOME2 = f"""
<section class="view" id="v-home" data-view="home">
  <h1 class="ptitle">Uma Versus Wiki</h1>
  <p class="tagline">Update {VERSION} · build {BUILD}</p>
  <img class="homelogo" src="{LOGO}" alt="Uma Versus logo">
  <div class="welcome"><p>The wiki for <b>Uma Versus</b>, a fan-made Umamusume fighting game you play in the browser. Frame data and combos come straight from the game, so they're accurate for build <span class="mono">{BUILD}</span>.</p></div>
  <h2>Characters</h2>
  <div class="roster">{roster2}</div>
  <h2>Archetypes</h2>
  <div class="tw"><table class="atab"><thead><tr><th>Archetype</th><th>Plays like</th><th>Characters</th></tr></thead><tbody>{archrows}</tbody></table></div>
  <h2>Getting started</h2>
  <ul><li><a href="#systems" data-go="systems">How to play</a>: controls, notation, defense and combos</li><li><a href="#stages" data-go="stages">Stages</a></li><li><a href="#update18" data-go="update18">Latest patch notes (1.8.2)</a></li></ul>
</section>"""

CSS = """
:root {
  --page: #eef0f3; --paper: #ffffff; --ink: #202122; --muted: #54595d; --line: #c8ccd1; --soft: #f8f9fa; --head: #eaecf0;
  --link: #3366cc; --bar: #1b2133; --barink: #e8ebf5; --plus: #14866d; --minus: #d33; --gold: #ac6600;
  --hi: #ff2d2d; --hu: #23b85e; --gr: #f2b705; --pj: #ff6a00; --rf: #8a5cf6;
  --serif: "Linux Libertine", Georgia, "Times New Roman", serif;
  --sans: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --page: #101418; --paper: #181c22; --ink: #e6e8eb; --muted: #a2a9b1; --line: #3a414a; --soft: #1f242b; --head: #262c34;
  --link: #88a3e8; --bar: #0b0e14; --plus: #3fd4a8; --minus: #ff7b7b; --gold: #e8b04e; color-scheme: dark } }
:root[data-theme="dark"] { --page: #101418; --paper: #181c22; --ink: #e6e8eb; --muted: #a2a9b1; --line: #3a414a; --soft: #1f242b; --head: #262c34;
  --link: #88a3e8; --bar: #0b0e14; --plus: #3fd4a8; --minus: #ff7b7b; --gold: #e8b04e; color-scheme: dark }
* { box-sizing: border-box }
body { margin: 0; background: var(--page); color: var(--ink); font: 14.5px/1.6 var(--sans) }
a { color: var(--link); text-decoration: none } a:hover { text-decoration: underline }
.topbar { background: var(--bar); color: var(--barink); padding: 10px max(16px, env(safe-area-inset-right, 0px)) 10px max(16px, env(safe-area-inset-left, 0px)) }
.topbar .in { max-width: 1240px; margin: 0 auto; display: flex; align-items: center; gap: 14px }
.logo { font: 700 20px/1 var(--serif); color: #fff; letter-spacing: .01em; display: flex; align-items: center; gap: 8px } .logo span { color: #ffcf4a } .lgimg { height: 40px; width: auto; display: block }
.homelogo { display: block; width: min(460px, 100%); height: auto; margin: 4px 0 10px }
.badge { font: 12px var(--mono); color: #aab3cc } .badge:first-of-type { margin-left: auto }
.wrap { display: grid; grid-template-columns: 196px minmax(0, 1fr); gap: 18px; max-width: 1240px; margin: 0 auto;
  padding: 18px max(16px, env(safe-area-inset-right, 0px)) 60px max(16px, env(safe-area-inset-left, 0px)) }
.side { font-size: 13.5px; align-self: start; position: sticky; top: 12px }
.portal { margin-bottom: 16px } .ph { margin: 0 0 4px; padding-bottom: 3px; border-bottom: 1px solid var(--line); font-size: 12px; color: var(--muted) }
.side ul { list-style: none; margin: 0; padding: 0 } .side li { margin: 1px 0 }
.side a { display: flex; align-items: center; gap: 6px; padding: 3px 4px; border-radius: 3px }
.side a.on { background: var(--paper); font-weight: 700; color: var(--ink) }
.ico { width: 24px; height: 24px; image-rendering: pixelated; flex: none }
main { min-width: 0; background: var(--paper); border: 1px solid var(--line); padding: 20px 26px 40px; display: flow-root }
.crumb { margin: 0; font-size: 12.5px; color: var(--muted) }
.ptitle { font: 400 30px/1.25 var(--serif); margin: 2px 0 0; padding-bottom: 4px; border-bottom: 1px solid var(--line) }
.tagline { margin: 4px 0 14px; font-size: 12.5px; color: var(--muted) }
h2 { font: 400 23px/1.3 var(--serif); margin: 26px 0 10px; padding-bottom: 3px; border-bottom: 1px solid var(--line); clear: right }
.char h2 { clear: none }
h3 { font: 700 16px/1.4 var(--sans); margin: 20px 0 8px }
p, li { max-width: 80ch }
.note { color: var(--muted); font-size: 13px }
.mono, .num { font-family: var(--mono); font-variant-numeric: tabular-nums }
.am { color: var(--muted, #888); font-size: .85em; margin-left: 1px }
.welcome { background: var(--soft); border: 1px solid var(--line); padding: 10px 16px; margin-bottom: 8px }
/* animated sprite strips */
.spr { display: inline-block; width: var(--s); height: var(--s); background-repeat: no-repeat; background-size: calc(var(--n) * var(--s)) var(--s);
  image-rendering: pixelated; animation: play var(--d) steps(var(--n)) infinite }
.spr.big { --s: 192px } .spr.mid { --s: 128px }
@keyframes play { to { background-position: calc(var(--n) * var(--s) * -1) 0 } }
@media (prefers-reduced-motion: reduce) { .spr { animation: none } }
.roster { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px }
.rcard { display: flex; flex-direction: column; align-items: center; padding: 4px 8px 10px; border: 1px solid var(--line); background: var(--soft);
  border-top: 4px solid var(--char); color: var(--ink) }
.rcard:hover { text-decoration: none; border-color: var(--char) } .rcard .spr { margin: -6px 0 0 }
.rn { font-weight: 700 } .ra { font-size: 12.5px; color: var(--muted) }
/* infobox */
.infobox { float: right; clear: right; width: 290px; margin: 0 0 14px 20px; border: 1px solid var(--line); background: var(--soft); font-size: 13px }
.ibtitle { background: var(--char); color: #fff; text-align: center; font: 700 16px/1.2 var(--sans); padding: 7px; text-shadow: 0 1px 2px rgba(0,0,0,.35) }
.ibport { display: flex; justify-content: center; background: linear-gradient(180deg, var(--paper), var(--soft)); border-bottom: 1px solid var(--line); padding: 4px 0 0 }
.infobox table { width: 100%; border-collapse: collapse } .infobox th, .infobox td { padding: 5px 9px; border-top: 1px solid var(--line); text-align: left; vertical-align: top }
.infobox th { width: 42%; background: var(--head); font-weight: 600 }
.lead { margin-top: 0 }
.toc { display: inline-block; border: 1px solid var(--line); background: var(--soft); padding: 8px 18px 8px 12px; font-size: 13.5px; margin: 4px 0 6px }
.toch { margin: 0 0 2px; font-weight: 700; text-align: center } .toc ol { margin: 0; padding-left: 20px }
.archline { background: var(--soft); border-left: 4px solid var(--char); padding: 8px 12px }
.sw { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid var(--line); margin: 12px 0 }
.sw > div { padding: 0 14px 8px } .sw ul { margin: 6px 0; padding-left: 18px }
.swh { margin: 0 -14px; padding: 5px 14px; font-weight: 700; color: #fff }
.pro .swh { background: #2f8a4c } .con .swh { background: #b8323a } .con { border-left: 1px solid var(--line) }
/* move cards */
.move { border: 1px solid var(--line); margin: 0 0 14px; background: var(--paper); clear: none }
.mhead { display: flex; align-items: baseline; gap: 12px; background: var(--head); border-bottom: 1px solid var(--line); padding: 6px 12px; border-left: 4px solid var(--char) }
.mhead h4 { margin: 0; font: 700 15.5px/1.3 var(--sans) }
.minput { margin-left: auto; font: 700 14px var(--mono) } .arw { font-weight: 400; color: var(--muted); margin-left: 6px }
.mbody { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 0 }
.mimg { margin: 0; border-right: 1px solid var(--line); background: repeating-linear-gradient(45deg, var(--soft) 0 10px, var(--paper) 10px 20px); padding: 6px }
.frame { position: relative; width: 100%; aspect-ratio: 330 / 270 }
.frame img, .frame svg { position: absolute; inset: 0; width: 100%; height: 100% } .frame img { image-rendering: pixelated }
.mimg figcaption { text-align: center; font-size: 11.5px; color: var(--muted) }
.box .gl { stroke: var(--muted); stroke-width: 1.5; stroke-dasharray: 4 4 }
.box rect { stroke-width: 2 } .hi { fill: color-mix(in srgb, var(--hi) 22%, transparent); stroke: var(--hi) }
.hu { fill: none; stroke: var(--hu); stroke-opacity: .85 } .gr { fill: color-mix(in srgb, var(--gr) 22%, transparent); stroke: var(--gr); stroke-dasharray: 6 4 }
.pj { fill: color-mix(in srgb, var(--pj) 30%, transparent); stroke: var(--pj) } .rf { fill: color-mix(in srgb, var(--rf) 18%, transparent); stroke: var(--rf); stroke-dasharray: 6 4 }
.k { display: inline-block; width: 12px; height: 10px; border: 2px solid; vertical-align: -1px }
.k.hi, .k.hu, .k.gr { border-style: solid } .k.hi { border-color: var(--hi) } .k.hu { border-color: var(--hu) } .k.gr { border-color: var(--gr) }
.mdata { padding: 10px 12px; min-width: 0 }
.mnotes { margin: 8px 0 0; padding-left: 18px } .mnotes li { margin: 2px 0 }
.hideboxes .box { display: none }
/* tables */
.tw { overflow-x: auto }
table { border-collapse: collapse }
.mft, .ctab, .atab, .tw > table { width: 100%; font-size: 13px }
.tw th, .tw td { border: 1px solid var(--line); padding: 4px 8px; text-align: center; vertical-align: middle }
.tw thead th { background: var(--head); font-weight: 700; white-space: nowrap }
.mft td { font-family: var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap } .mft td:nth-child(2), .mft .iv { font-family: var(--sans) } .mft .iv { white-space: normal; min-width: 70px }
.mft tbody th { text-align: left; white-space: nowrap; font-weight: 600; background: var(--soft) }
.ver { display: inline-block; min-width: 28px; text-align: center; padding: 0 5px; border-radius: 3px; background: var(--char); color: #fff; font: 700 11px/18px var(--mono) }
.plus { color: var(--plus); font-weight: 700 } .minus { color: var(--minus); font-weight: 700 } .kd { color: var(--gold); font-weight: 700 } .na { color: var(--muted) }
.ctab td:last-child, .atab td, .atab th { text-align: left } .cseq { text-align: left !important; font-family: var(--mono); white-space: nowrap }
.sep { color: var(--muted) } .tag { background: var(--head); padding: 0 6px; border-radius: 3px; font: 12px var(--sans) }
.ctl td { font-family: var(--mono) } .prose ul { padding-left: 20px }
.eyebrow { margin: 0; font-size: 12.5px; color: var(--muted) }
.view > h1:not(.ptitle) { font: 400 30px/1.25 var(--serif); margin: 2px 0 14px; padding-bottom: 4px; border-bottom: 1px solid var(--line) }
.stgs { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-top: 12px }
.stg { margin: 0; border: 1px solid var(--line); background: var(--soft) } .stg img { display: block; width: 100%; height: auto; image-rendering: pixelated }
.stg figcaption { padding: 8px 12px; display: flex; flex-direction: column } .stg figcaption span { color: var(--muted); font-size: 13px }
.toggle { float: right; font-size: 12.5px; color: var(--muted); margin-top: -6px }
@media (max-width: 860px) {
  .wrap { grid-template-columns: minmax(0, 1fr); padding-top: 10px } .bld { display: none }
  .side { position: static; display: flex; flex-wrap: wrap; gap: 4px 14px } .portal { margin: 0 } .ph { display: none }
  .side ul { display: flex; flex-wrap: wrap; gap: 2px 8px }
  main { padding: 14px 14px 32px }
  .infobox { float: none; width: auto; margin: 0 0 14px }
  .mbody { grid-template-columns: minmax(0, 1fr) } .mimg { border-right: 0; border-bottom: 1px solid var(--line) } .frame { max-width: 300px; margin: 0 auto }
  .sw { grid-template-columns: minmax(0, 1fr) } .con { border-left: 0; border-top: 1px solid var(--line) }
}
"""

JS = """
const views = [...document.querySelectorAll('.view')], links = [...document.querySelectorAll('[data-go]')];
function show(h, push) {
  const [id] = h.split('.');
  const view = views.some(v => v.dataset.view === id) ? id : 'home';
  views.forEach(v => { v.hidden = v.dataset.view !== view; });
  links.forEach(a => a.classList.toggle('on', a.dataset.go === view && !!a.closest('.side')));
  const el = h.includes('.') && document.getElementById(h);
  if (el) el.scrollIntoView(); else window.scrollTo(0, 0);
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return;
  e.preventDefault(); const h = a.getAttribute('href').slice(1);
  try { history.replaceState(null, '', '#' + h); } catch (err) {}
  show(h);
});
const tg = document.getElementById('boxes');
tg.addEventListener('change', () => { document.body.classList.toggle('hideboxes', !tg.checked); try { localStorage.setItem('umavs.wiki.boxes', tg.checked ? '1' : '0'); } catch (err) {} });
try { if (localStorage.getItem('umavs.wiki.boxes') === '0') { tg.checked = false; document.body.classList.add('hideboxes'); } } catch (err) {}
show((location.hash || '#home').slice(1));
window.addEventListener('hashchange', () => show(location.hash.slice(1)));
"""

stage_cards = ''.join(f'<figure class="stg"><img src="{x["img"]}" alt="{E(x["name"].title())}"><figcaption><b>{E(x["name"].title())}</b><span>{E(x["sub"].title().replace("M ·", "m ·"))}</span></figcaption></figure>' for x in STG)
STAGESV = f"""
<section class="view" id="v-stages" data-view="stages" hidden>
  <h1 class="ptitle">Stages</h1>
  <p class="tagline">From Uma Versus Wiki · build {BUILD}</p>
  <p>You pick the course after character select, or choose <b>Random</b>. Every stage is the same size, so they're just for looks. Online, the host picks.</p>
  <div class="stgs">{stage_cards}</div>
</section>"""
UPDATE18 = f"""
<section class="view" id="v-update18" data-view="update18" hidden>
  <h1 class="ptitle">Update 1.8</h1>
  <p class="tagline">Patch notes · build {BUILD}</p>
  <div class="prose">
  <h2>1.8.2</h2>
  <ul><li>Fixed a freeze of about a twentieth of a second at the start of each match, when the battle theme loaded. Music now loads in the background after the game opens.</li>
  <li>Hit sounds reuse their audio instead of making new audio on every hit, which cuts down on small stutters mid-fight.</li>
  <li>Winning Live and Nakayama Nights draw their lights and snow with less work per frame.</li>
  <li>Press <b>F3</b> to show frames per second, frame time and the worst frame in the last second.</li>
  <li>Same build as 1.8.1, so 1.8.1 and 1.8.2 can play each other online.</li></ul>
  <h2>1.8.1</h2>
  <ul><li>The Sharp text option is now <b>Graphics: Low / Medium / High</b> in Options and the pause menu. Low is the original 960×540 picture, Medium is sharper, High is full resolution. Medium is the default.</li>
  <li>Smoother frame pacing on 60 Hz screens, and less work per frame on 120 Hz and higher.</li>
  <li>Fixed pressing A (Skill) to confirm a menu or unpause doing a skill as the match starts. A button that's still held from a menu is ignored until you let go.</li>
  <li>Rewrote the wiki and in-game text.</li></ul>
  <h2>Accounts</h2>
  <ul><li>Added optional accounts. Sign up from <b>Account</b> on the main menu with an email, password, display name and favourite runner. Guests can still play everything.</li>
  <li>Your display name shows up for your opponent online.</li>
  <li>Controls, volume, options and trial progress save to your account and load when you sign in somewhere else.</li>
  <li>Online matches are saved to your match history. The Account screen shows your record, win rate, most-played runner and recent results. VS CPU doesn't count.</li>
  <li>The title screen shows who's signed in.</li></ul>
  <p>Your email is only used to sign in. Display names, favourite runners and online results are public. Settings are private.</p>
  <h2>Display</h2>
  <ul><li>The game now renders at your screen's resolution, so text and menus are sharp. Sprites still look like pixel art.</li></ul>
  <h2>Online</h2>
  <ul><li>Both players need build <b class="mono">{BUILD}</b>.</li></ul>
  </div>
</section>"""
UPDATE17 = f"""
<section class="view" id="v-update17" data-view="update17" hidden>
  <h1 class="ptitle">Update 1.7</h1>
  <p class="tagline">Patch notes</p>
  <div class="prose">
  <h2>New</h2>
  <ul><li>Uma Versus has a logo and a browser tab icon.</li></ul>
  <h2>Daiwa Scarlet</h2>
  <ul><li><b>Number One Finish</b> is now her own super: a volley of five golden roses and a big finishing rose instead of a rush. Each shot can hit, be blocked or miss on its own. About 2,300 damage if everything lands.</li>
  <li>The shots go through normal projectiles, can't be reflected and don't use juggle points. Punishable on block up close.</li>
  <li>The CPU uses it as a long-range punish.</li></ul>
  <h2>Fixes</h2>
  <ul><li>Fixed Gold Ship flying off the top of the screen when Golshi Dropkick!! was cancelled into a super in the air. Same for Suzuka's Silent Flicker.</li>
  <li>Fixed matches getting stuck if a super cinematic was cut short, for example by time running out.</li>
  <li>Fixed matches getting stuck if a projectile hit someone in the middle of a throw.</li>
  <li>Fixed super cinematics near the edge pushing the opponent off the stage.</li>
  <li>Fixed a crash when resetting Training during a super flash.</li>
  <li>Super cinematics now use the character's damage multiplier and Miracle Mode, so Suzuka's and Teio's supers hit a little harder.</li></ul>
  </div>
</section>"""
UPDATE16 = f"""
<section class="view" id="v-update16" data-view="update16" hidden>
  <h1 class="ptitle">Update 1.6</h1>
  <p class="tagline">Patch notes</p>
  <div class="prose">
  <h2>New look</h2>
  <ul><li>New race-day UI for all menus and the HUD: starting-gate colours, tote-board timers, saddlecloth name plates and rosettes for round wins.</li>
  <li>Added a course select, a VS screen before each match and a results board after it.</li>
  <li>Rounds start with the starting gate opening, and knockouts end in a photo finish.</li></ul>
  <h2>Stages</h2>
  <ul><li>Three new stages: Tracen Training Track, Nakayama Nights and Winning Live.</li></ul>
  <h2>Music</h2>
  <ul><li>Added a menu theme, a theme for every runner and a Third Round Theme.</li>
  <li>P1 picks the battle theme after the course. It defaults to P1's runner. Online, the host picks.</li>
  <li>If a match goes to round 3, the Third Round Theme takes over.</li>
  <li>Music and effects volume are in Options, and you can listen to every track there.</li></ul>
  <h2>Combos</h2>
  <ul><li>New damage scaling based on the starter, with a 13% drop per hit from the 3rd hit (minimum 25%, supers 50%).</li>
  <li>Added ground bounce (j.H in an air combo) and wall bounce (some EX knockdowns), once each per combo.</li>
  <li>Juggle points, hitstun decay after 2 seconds, and a combo limit of 32 hits or 7 seconds.</li>
  <li>The combo counter shows the scaling for the next hit.</li></ul>
  <h2>Training</h2>
  <ul><li>New Combo Trials mode with 51 trials and demos.</li>
  <li>Input display, frame meter and dummy recording in Training.</li></ul>
  <h2>CPU</h2>
  <ul><li>Rebuilt the CPU. Four levels: Rookie, Normal, Hard and G1.</li>
  <li>It reacts with a delay instead of reading your inputs, and guesses when blocking, so mixups work on it.</li>
  <li>Higher levels do real combos, punish, anti-air, tech throws and get around projectiles.</li>
  <li>Each runner plays to her archetype.</li></ul>
  <h2>Quality of life</h2>
  <ul><li>Rematch from the results screen.</li>
  <li>Random slot on character select, and cursors remember your last pick.</li>
  <li>Reduce flashes &amp; shake and fullscreen options.</li>
  <li>The online room panel works with a gamepad.</li>
  <li>Menu sounds, plus a bell and gate sound at the start of each round.</li></ul>
  <h2>Fixes</h2>
  <ul><li>The CPU could super while airborne or right out of hitstun.</li>
  <li>Supers at the end of a combo sometimes only did the first hit.</li>
  <li>The menu music didn't start until you opened a menu.</li>
  <li>Leaving a match during a KO could skip a round win in the next match.</li>
  <li>Some of Teio's frames had a green square behind her.</li></ul>
  </div>
</section>"""

page = f"""<title>Uma Versus Wiki</title>
<link rel="icon" type="image/png" href="{ICON}">
<meta name="claude:viewport-fit-sides" content="cover">
<style>{CSS}</style>
<header class="topbar"><div class="in"><span class="logo"><img class="lgimg" src="{LOGO}" alt="Uma Versus"> Wiki</span>
  <label class="badge"><input type="checkbox" id="boxes" checked> hitboxes</label><span class="badge bld">build {BUILD}</span></div></header>
<div class="wrap">
{side()}
<main>
{HOME2}
{SYSTEMS}
{''.join(char_page(cid, i) for i, cid in enumerate(ORDER, 1))}
{STAGESV}
{UPDATE18}
{UPDATE17}
{UPDATE16}
{UPDATE15}
{UPDATE}
</main>
</div>
<script>{JS}</script>
"""
page = page.replace('Mcqueen', 'McQueen')
open(ROOT+'/wiki/index.html', 'w').write(page)
print('wrote', len(page))
