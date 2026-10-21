import os as _os
ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))   # repo root
for _d in ('build/wiki', 'build/shots/ui', 'build/shots/fx'): _os.makedirs(_os.path.join(ROOT, _d), exist_ok=True)
import asyncio, sys
from playwright.async_api import async_playwright
from PIL import Image
OUT=ROOT+'/build/shots/ui/'
CASES = [
 ('title', "UI.screen='title'; UI.t=200;"),
 ('mode', "UI.screen='mode'; UI.modeIdx=2; UI.t=900;"),
 ('select', "UI.pendingMode='versus'; UI.screen='select'; UI.sel=[6,5]; UI.selDone=[true,false];"),
 ('stage', "UI.pendingMode='versus'; UI.sel=[6,5]; UI.screen='stage'; UI.stageIdx=2; UI.stageT=10;"),
 ('vs', "UI.pendingMode='versus'; UI.sel=[0,7]; UI.vsStage=1; UI.screen='vs'; UI.vsT=40;"),
 ('game_tokyo', "UI.pendingMode='versus'; UI.sel=[0,1]; UI.vsStage=0; beginLocalMatch(); for(let i=0;i<120;i++) step([{...NEUTRAL},{...NEUTRAL}]); G.p[0].hp=6200; G.p[0].dispHp=6200; G.p[0].redHp=7000; G.p[1].meter=100; G.p[0].meter=62; G.p[0].wins=1;"),
 ('game_tracen', "UI.pendingMode='versus'; UI.sel=[2,3]; UI.vsStage=1; beginLocalMatch(); for(let i=0;i<120;i++) step([{...NEUTRAL},{...NEUTRAL}]); G.p[1].hp=2000; G.p[1].dispHp=2000; G.p[1].redHp=2000;"),
 ('game_nakayama', "UI.pendingMode='versus'; UI.sel=[4,5]; UI.vsStage=2; beginLocalMatch(); for(let i=0;i<120;i++) step([{...NEUTRAL},{...NEUTRAL}]);"),
 ('game_live', "UI.pendingMode='versus'; UI.sel=[6,7]; UI.vsStage=3; beginLocalMatch(); for(let i=0;i<120;i++) step([{...NEUTRAL},{...NEUTRAL}]);"),
 ('intro_round', "UI.pendingMode='versus'; UI.sel=[0,1]; UI.vsStage=0; beginLocalMatch(); for(let i=0;i<30;i++) step([{...NEUTRAL},{...NEUTRAL}]);"),
 ('intro_gate', "UI.pendingMode='versus'; UI.sel=[0,1]; UI.vsStage=0; beginLocalMatch(); for(let i=0;i<88;i++) step([{...NEUTRAL},{...NEUTRAL}]);"),
 ('combo', "UI.pendingMode='versus'; UI.sel=[6,5]; UI.vsStage=3; beginLocalMatch(); for(let i=0;i<110;i++) step([{...NEUTRAL},{...NEUTRAL}]); G.p[0].x=900; G.p[1].x=990; startMove(G.p[0],'2S',true); for(let i=0;i<14;i++) step([{...NEUTRAL},{...NEUTRAL}]);"),
 ('ko', "UI.pendingMode='versus'; UI.sel=[0,1]; UI.vsStage=2; beginLocalMatch(); for(let i=0;i<110;i++) step([{...NEUTRAL},{...NEUTRAL}]); G.p[1].hp=0; for(let i=0;i<6;i++) step([{...NEUTRAL},{...NEUTRAL}]);"),
 ('roundwin', "UI.pendingMode='versus'; UI.sel=[0,1]; UI.vsStage=2; beginLocalMatch(); for(let i=0;i<110;i++) step([{...NEUTRAL},{...NEUTRAL}]); G.p[1].hp=0; for(let i=0;i<260;i++) { step([{...NEUTRAL},{...NEUTRAL}]); if (G.posed && G.phaseT>118) break; }"),
 ('results', "UI.pendingMode='versus'; UI.sel=[5,6]; UI.vsStage=1; beginLocalMatch(); G.p[0].wins=2; G.p[1].wins=1; G.phase='match'; G.phaseT=80;"),
 ('super', "UI.pendingMode='versus'; UI.sel=[7,0]; UI.vsStage=0; beginLocalMatch(); for(let i=0;i<110;i++) step([{...NEUTRAL},{...NEUTRAL}]); G.p[0].meter=100; startMove(G.p[0],'SU'); for(let i=0;i<8;i++) step([{...NEUTRAL},{...NEUTRAL}]);"),
 ('pause', "UI.pendingMode='training'; UI.sel=[1,2]; UI.vsStage=0; beginLocalMatch(); for(let i=0;i<30;i++) step([{...NEUTRAL},{...NEUTRAL}]); UI.paused=true; UI.pauseIdx=1;"),
 ('training', "UI.pendingMode='training'; UI.sel=[3,4]; UI.vsStage=1; beginLocalMatch(); for(let i=0;i<30;i++) step([{...NEUTRAL},{...NEUTRAL}]);"),
 ('moves', "UI.screen='moves'; UI.movesChar=5; UI.movesPage=0;"),
 ('combos', "UI.screen='moves'; UI.movesChar=6; UI.movesPage=1;"),
 ('controls', "UI.screen='controls'; UI.ctl={row:4,col:0,wait:null,cool:0};"),
 ('replays', "UI.screen='replays';"),
 ('online', "UI.screen='online'; showNetPanel(); netPanelPad({...NEUTRAL, d:1}); netPanelPad({...NEUTRAL, d:1}); netPanelPad({...NEUTRAL, d:1});"),
 ('select_rand', "UI.pendingMode='versus'; UI.screen='select'; UI.sel=[8,3]; UI.selDone=[false,false];"),
 ('results2', "UI.pendingMode='versus'; UI.sel=[0,7]; UI.vsStage=2; beginLocalMatch(); G.p[0].wins=1; G.p[1].wins=2; G.phase='match'; G.phaseT=80; UI.resIdx=0;"),
 ('options', "UI.screen='sound'; UI.soundIdx=2;"),
 ('trials_menu', "UI.screen='trials'; TM.char=6; TM.idx=4; trialDone={tt:[0,1]};"),
 ('trial_run', "UI.pendingMode='training'; UI.sel=[0,0]; UI.vsStage=0; UI.musicIdx=0; beginLocalMatch(); trialStart('spe', 5); demoStart(); for (let f=0; f<75; f++) { const ins = gameInputs([{...NEUTRAL},{...NEUTRAL}]); step(ins); demoAfterStep(); trialTrack(); toolsAfterStep(); }"),
 ('training_tools', "UI.pendingMode='training'; UI.sel=[2,5]; UI.vsStage=1; UI.musicIdx=2; beginLocalMatch(); TR.on=false; const [a,d]=G.p; a.x=900; d.x=990; for (let f=0; f<40; f++) { const inp = f===6?{...NEUTRAL,M:1}:f===2||f===3?{...NEUTRAL,d:1}:{...NEUTRAL}; step([inp,{...NEUTRAL}]); toolsAfterStep(); } for (let f=0; f<30; f++) { step([f===2?{...NEUTRAL,d:1,H:1}:{...NEUTRAL},{...NEUTRAL}]); toolsAfterStep(); }"),
 ('music', "UI.pendingMode='versus'; UI.sel=[6,2]; UI.vsStage=1; UI.musicIdx=6; UI.screen='music';"),
 ('sound', "UI.screen='sound'; UI.soundIdx=4; MD.jukebox='gs';"),
 ('netselect2', "hideNetPanel(); Net.side=0; Net.role='host'; Net.myPick=2; Net.theirPick=4; Net.theirReady=true; Net.theirBuild=BUILD; Net.stage=1; Net.music='kb'; Net.focus=2; UI.screen='netselect';"),
 ('netselect', "hideNetPanel(); Net.side=0; Net.role='host'; Net.myPick=2; Net.theirPick=4; Net.theirReady=true; Net.theirBuild=BUILD; Net.stage=3; UI.screen='netselect';"),
]
async def main():
    only = sys.argv[1:] 
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); pg = await b.new_page(viewport={'width':960,'height':540})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/index.html'); await pg.wait_for_timeout(1500)
        await pg.evaluate("() => { window.__tick = tick; tick = () => { UI.t++; }; }")
        imgs=[]
        for name, js in CASES:
            if only and name not in only: continue
            await pg.evaluate("() => { try { hideNetPanel(); } catch(e){}; UI.paused=false; }")
            await pg.evaluate("() => { " + js + " }")
            await pg.wait_for_timeout(250)
            await pg.screenshot(path=OUT+name+'.png'); imgs.append(name)
        print('ERR', errs[:6]); await b.close()
        # contact sheets of 4
        for k in range(0, len(imgs), 4):
            sh = Image.new('RGB', (1920, 1080))
            for j, n in enumerate(imgs[k:k+4]): sh.paste(Image.open(OUT+n+'.png').resize((960,540)), ((j%2)*960, (j//2)*540))
            sh.save(OUT+f'sheet{k//4}.png')
        print(imgs)
asyncio.run(main())
