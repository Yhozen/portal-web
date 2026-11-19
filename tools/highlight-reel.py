# Builds the session highlight reel from clips in /workspace/portal-web-shots/anim (recorded with portal-ctl record).
# The clips and the reel stay outside the repository. usage: python3 tools/highlight-reel.py (run from any dir; writes ./NN.mp4 scratch files)
import subprocess
A='/workspace/portal-web-shots/anim/'
B='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'; R='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def esc(t): return t.replace('\\','\\\\').replace(':','\\:').replace("'","\u2019").replace(',','\\,')
def seg(i, src, title, sub, w, h, speed=1.0, ss=0, t=None, labels=False):
    trim=f"trim=start={ss}" + (f":duration={t}" if t else "") + ",setpts=(PTS-STARTPTS)/" + str(speed)
    vf=(f"[0:v]{trim},scale={w}:{h}:flags=lanczos,fps=30,pad=1280:720:(ow-iw)/2:150+(570-ih)/2:color=0x101214,"
        f"drawtext=fontfile={B}:text='{esc(title)}':fontcolor=white:fontsize=40:x=60:y=42,"
        f"drawtext=fontfile={R}:text='{esc(sub)}':fontcolor=0xb8c4cc:fontsize=24:x=60:y=96,"
        f"drawbox=x=60:y=136:w=80:h=4:color=0xff9a00@1:t=fill,"
        + (f"drawtext=fontfile={B}:text='BEFORE':fontcolor=white:fontsize=22:box=1:boxcolor=0x000000@0.6:boxborderw=6:x=540:y=250,drawtext=fontfile={B}:text='AFTER':fontcolor=0xffb340:fontsize=22:box=1:boxcolor=0x000000@0.6:boxborderw=6:x=1190:y=250," if labels else "")
        + f"fade=in:st=0:d=0.3[v]")
    subprocess.run(['ffmpeg','-v','error','-y','-i',A+src,'-filter_complex',vf,'-map','[v]','-an','-c:v','libx264','-crf','18','-preset','slow','-pix_fmt','yuv420p',f'{i:02d}.mp4'],check=True)
def card(i, l1, l2, l3, d=3.0):
    vf=(f"drawtext=fontfile={B}:text='{esc(l1)}':fontcolor=white:fontsize=64:x=(w-tw)/2:y=260,"
        f"drawbox=x=560:y=350:w=160:h=5:color=0xff9a00@1:t=fill,"
        f"drawtext=fontfile={R}:text='{esc(l2)}':fontcolor=0xb8c4cc:fontsize=30:x=(w-tw)/2:y=390,"
        f"drawtext=fontfile={R}:text='{esc(l3)}':fontcolor=0x7d8a93:fontsize=22:x=(w-tw)/2:y=440,fade=in:st=0:d=0.4,fade=out:st={d-0.4}:d=0.4")
    subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i',f'color=c=0x101214:s=1280x720:r=30:d={d}','-vf',vf,'-c:v','libx264','-crf','18','-pix_fmt','yuv420p',f'{i:02d}.mp4'],check=True)
card(0,'portal-web','Animation fixes, Nov 19 2026','Every clip recorded tick by tick in the test harness')
seg(1,'glados-cores-compare.mp4','GLaDOS: the cores ride her body','Before: they floated in place. After: they follow her animated pose.',1280,400)
seg(2,'lift-compare.mp4','Chamber 10: telescoping lifts','Before: the platform hung 128 units over the pit. After: it sinks flush with the floor.',1280,400,labels=True)
seg(3,'viewmodel-fizzle-after.mp4','Portal gun: the fizzle animation','The first-person gun plays its fizzle with the model\u2019s timings (half speed).',896,560,speed=0.5)
seg(4,'turret-after.mp4','Floor turrets: deploy, aim, fire','Built from the turret model\u2019s sequences and pose parameters.',896,560,t=8)
seg(5,'turret-tip-after.mp4','\u2026and tip over','Knocked over, it sounds the alarm, thrashes and fires, then shuts down.',896,560)
seg(6,'cube-on-train-compare.mp4','Chamber 08: the cube rides its platform','Before: it fell off as the train started. After: it rides along (2x speed).',1280,400,speed=2,labels=True)
card(7,'Still open','a08 cube-platform fling, later chambers, polish','Full list in journey.md',d=2.5)
open('list.txt','w').write(''.join(f"file '{i:02d}.mp4'\n" for i in range(8)))
subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i','list.txt','-c:v','libx264','-crf','20','-preset','slow','-pix_fmt','yuv420p','-movflags','+faststart',A+'highlights-2026-11-19.mp4'],check=True)
