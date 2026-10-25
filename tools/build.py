import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import json,re,hashlib
root=ROOT+'/'
assets={k:json.load(open(root+f'assets/sprites/{k}.json')) for k in ['spe','suz','gs','vo','ds','mm','tt','kb','jp','at','mc','df']}
files=['data.js','engine.js','render.js','stages.js','net.js','replay.js','ui.js','music.js','trials.js','tutorial.js','arcade.js','ranges.js','ai.js','config.js','account.js','social.js','main.js']
src={f:open(root+'src/'+f).read() for f in files}
# BUILD = fingerprint of everything that affects the simulation (characters, engine, netcode)
build=hashlib.sha1((src['data.js']+src['engine.js']+src['net.js']).encode()).hexdigest()[:6]
code=f"const BUILD = '{build}';\n"+'\n'.join(src[f] for f in files)
peer=open(ROOT+'/vendor/peerjs.min.js').read()
peer=re.sub(r'//# sourceMappingURL=.*','',peer)
assert '</script' not in peer.lower()
html=open(root+'src/template.html').read()
import base64
fdir=ROOT+'/vendor/fonts/'
fonts=''.join("@font-face{font-family:'Barlow Condensed';font-style:%s;font-weight:%d;font-display:block;src:url(data:font/woff2;base64,%s) format('woff2')}" % (st, w, base64.b64encode(open(fdir+f'barlow-condensed-latin-{w}-{st}.woff2','rb').read()).decode()) for w, st in [(600,'normal'),(800,'italic'),(900,'italic')])
fonts+="@font-face{font-family:'Dela Gothic One';font-style:normal;font-weight:400;font-display:block;src:url(data:font/woff2;base64,%s) format('woff2')}" % base64.b64encode(open(ROOT+'/vendor/fonts/dela-gothic-one-latin-400-normal.woff2','rb').read()).decode()
html=html.replace('/*__FONTS__*/',fonts)
# logo (downscaled for the game) and tab icons
from PIL import Image as _I
import io as _io
def _uri(path, w=None):
    im=_I.open(path)
    if w and im.width>w: im=im.resize((w, round(im.height*w/im.width)), _I.LANCZOS)
    b=_io.BytesIO(); im.save(b,'PNG',optimize=True); return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
art=ROOT+'/assets/art/'
html=html.replace('<!--__ICONS__-->', f'<link rel="icon" type="image/png" sizes="64x64" href="{_uri(art+"icon-64.png")}"><link rel="icon" type="image/png" sizes="32x32" href="{_uri(art+"icon-32.png")}"><link rel="apple-touch-icon" href="{_uri(art+"icon-180.png")}">')
html=html.replace('/*__LOGO__*/', 'const LOGO_URI = ' + json.dumps(_uri(art+'logo.png', 1000)) + '; const LOGO_ERA_URI = ' + json.dumps(_uri(art+'logo-era.png', 1000)) + ';')
import os
mdir=ROOT+'/assets/music/'
music={k[:-4]: base64.b64encode(open(mdir+k,'rb').read()).decode() for k in sorted(os.listdir(mdir)) if k.endswith('.mp3')}
# music goes after the game code as inert text blocks: the game starts while the tracks are still downloading
html=html.replace('<!--__MUSIC__-->',''.join(f'<script type="text/plain" class="track" id="mus-{k}">{v}</script>' for k,v in music.items()))
sb=open(ROOT+'/vendor/supabase.js').read()
sb=re.sub(r'//# sourceMappingURL=.*','',sb)
# the bundle is inlined, so webpack can't find its own script URL; it only needs one for a Node-only chunk, so give it a dummy
_pp='if(!e)throw new Error("Automatic publicPath is not supported in this browser");'
assert sb.count(_pp)==1; sb=sb.replace(_pp,'if(!e)e="https://invalid.local/";')
assert '</script' not in sb.lower()
html=html.replace('/*__SUPABASE__*/',sb)
html=html.replace('/*__PEERJS__*/',peer).replace('/*__ASSETS__*/','const ASSETS = '+json.dumps(assets)+';').replace('/*__CODE__*/',code)
open(root+'index.html','w').write(html)
print(len(html), 'build', build)
