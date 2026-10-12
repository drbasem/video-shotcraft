import cv2, subprocess
from common import *
load_mask()
cap=cv2.VideoCapture('src.mp4'); W=int(cap.get(3)); H=int(cap.get(4))
cmd=['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s',f'{W}x{H}','-r','120','-i','-',
     '-i','src.mp4','-map','0:v','-map','1:a','-c:v','libx264','-crf','17','-preset','medium','-pix_fmt','yuv420p',
     '-c:a','copy','-movflags','+faststart','naqaa2-clean.mp4']
p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
ref=None;i=0
while True:
    ok,f=cap.read()
    if not ok: break
    if i==REF: ref=f.copy()
    if START<=i<=END: f=clean_frame(f,ref)
    p.stdin.write(f.tobytes()); i+=1
    if i%500==0: print('progress',i,flush=True)
p.stdin.close(); p.wait(); print('frames',i,'rc',p.returncode)
