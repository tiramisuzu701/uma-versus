import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Reads the character tabs of the editable wiki doc (exported as markdown into tools/wiki_doc/<cid>.md)
# so the wiki shows the hand-edited text. Frame data, damage and generated lines still come from the game.
import html, os, re

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wiki_doc')
NOTE_IDS = {'5L': '5L', '5M': '5M', '5H': '5H', '2L': '2L', '2M': '2M', '2H': '2H', 'j.L': 'jL', 'j.M': 'jM', 'j.H': 'jH',
            '6M': '6M', '66L': 'dL', '66M': 'dM', '66H': 'dH', 'L+M': 'throw', 'while blocking': 'GC'}

def clean(s):
    s = s.replace('&#32;', ' ').replace('****', '')
    return re.sub(r'\s{2,}', ' ', s).strip()

def inline(s):
    """markdown bold / italic to html (text escaped first)"""
    s = html.escape(clean(s), quote=False)
    s = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)
    return re.sub(r'\*(.+?)\*', r'<i>\1</i>', s)

def parse(cid):
    path = os.path.join(DIR, cid + '.md')
    if not os.path.exists(path): return None
    out = {'lead': '', 'tagline': '', 'over': '', 'plan': [], 'strong': [], 'weak': [], 'normals': {}, 'skills': {},
           'skill_intro': '', 'super': [], 'combos': [], 'tips': []}
    sec = sub = None; cur = None; sw = None
    for raw in open(path, encoding='utf-8').read().split('\n'):
        line = raw.rstrip()
        if not line.strip(): continue
        if line.startswith('# '): continue
        if line.startswith('## '): sec = line[3:].strip(); cur = None; sw = None; continue
        if line.startswith('### '): continue
        if line.startswith('#### '):
            title = clean(line[5:]); key = re.search(r'\(([^()]*)\)\s*$', title)
            name = title[:key.start()].strip() if key else title; key = key.group(1) if key else ''
            if sec == 'Normal moves': cur = out['normals'].setdefault(NOTE_IDS.get(key, key), [])
            elif sec == 'Skills': cur = out['skills'].setdefault(name, [])
            elif sec == 'Super': cur = out['super']
            continue
        bullet = line.lstrip().startswith('- ')
        text = line.lstrip()[2:] if bullet else line
        if sec is None: out['lead'] = text; continue
        if sec == 'Overview':
            plain = clean(text).replace('*', '').strip().lower()
            if not bullet and plain in ('strengths', 'weaknesses'): sw = plain; continue
            if bullet and sw: out['strong' if sw == 'strengths' else 'weak'].append(text); continue
            if not out['tagline']:
                m = re.match(r'\s*\*\*(.+?)\*\*\s*(.*)$', clean(text))
                out['tagline'], out['over'] = (m.group(1), m.group(2)) if m else ('', text)
            else: out['plan'].append(text)
            continue
        if sec == 'Combos':
            if line.startswith('|'):
                cells = [c.strip() for c in line.strip('|').split('|')]
                if cells[0] in ('Combo', '---'): continue
                out['combos'].append((cells[0], cells[1] if len(cells) > 1 else ''))
            continue
        if sec == 'Tips':
            if bullet: out['tips'].append(text)
            continue
        if sec == 'Skills' and not bullet and cur is None:
            if 'added to each potion skill' not in text: out['skill_intro'] = text
            continue
        if bullet and cur is not None: cur.append(text)
    return out

DOC = {}
def get(cid):
    if cid not in DOC: DOC[cid] = parse(cid)
    return DOC[cid]
