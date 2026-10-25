import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
# Normalise every track to -16 LUFS, trim leading/trailing silence (so loops don't sit in a gap), encode MP3 96 kbps.
import subprocess, json, re, os
import sys
U = '/root/.claude/uploads/beead88c-29e2-5633-85fe-f20dc7826420/'
U2 = '/mnt/user-data/attachments/beead88c-29e2-5633-85fe-f20dc7826420/'
TRACKS = {'menu': 'bfcd2687-Menu_Theme.mp3', 'round3': '2714e0a0-Third_Round_Theme.mp3', 'spe': 'f74fabb3-Special_Week_Theme.mp3',
  'suz': '467cc8f5-Silence_Suzuka_Theme.mp3', 'gs': 'c9972cf3-Gold_Ship_Theme.mp3', 'vo': 'b2a86848-Vodka_Theme.mp3', 'ds': '866455d8-Daiwa_Scarlet_Theme.mp3',
  'mm': 'bf7bcb9f-Mejiro_McQueen_Theme.mp3', 'tt': '65ea6163-Tokai_Teio_Theme.mp3', 'kb': 'c8495ed9-Kitasan_Black_Theme.mp3',
  # Update 2
  'jp': U2 + '5cb78bde-Jungle_Pocket_Theme.mp3', 'at': U2 + '75058745-Agnes_Tachyon_Theme.mp3', 'mc': U2 + 'f2ab3760-Manhattan_Cafe_Theme.mp3', 'df': U2 + '37304532-Dantsu_Flame_Theme.mp3'}
ONLY = sys.argv[1:]
def run(a): return subprocess.run(a, capture_output=True, text=True).stderr
info = json.load(open(ROOT+'/assets/music/info.json'))
for k, f in TRACKS.items():
    if ONLY and k not in ONLY: continue
    src = f if f.startswith('/') else U + f
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout)
    sd = run(['ffmpeg', '-hide_banner', '-i', src, '-af', 'silencedetect=n=-45dB:d=0.4', '-f', 'null', '-'])
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', sd)]; ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', sd)]
    a, b = 0.0, dur
    if k != 'menu':   # the menu theme already fades in and out by design
        if starts and starts[0] < 0.05 and ends: a = max(0.0, ends[0] - 0.05)
        if starts and starts[-1] > dur - 8: b = min(dur, starts[-1] + 0.25)
    m = run(['ffmpeg', '-hide_banner', '-ss', str(a), '-to', str(b), '-i', src, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'])
    j = json.loads(m[m.rindex('{'):m.rindex('}') + 1])
    flt = f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true"
    out = ROOT+f'/assets/music/{k}.mp3'
    run(['ffmpeg', '-hide_banner', '-y', '-ss', str(a), '-to', str(b), '-i', src, '-af', flt + ',aresample=44100', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '96k', out])
    info[k] = {'trim': [round(a, 2), round(b, 2)], 'dur': round(b - a, 2), 'kb': os.path.getsize(out) // 1024}
    print(k, info[k])
json.dump(info, open(ROOT+'/assets/music/info.json', 'w'))
