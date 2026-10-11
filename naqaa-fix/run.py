import cv2, subprocess, numpy as np
from clean import clean_frame, REF
START=841
cap=cv2.VideoCapture('src.mp4')
W=int(cap.get(3)); H=int(cap.get(4))
cmd=['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s',f'{W}x{H}','-r','30','-i','-',
     '-i','src.mp4','-map','0:v','-map','1:a','-map','1:s?','-c:v','libx264','-crf','15','-preset','slow','-pix_fmt','yuv420p',
     '-c:a','copy','-c:s','mov_text','-movflags','+faststart','naqaa-clean.mp4']
p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
ref=None;i=0
while True:
    ok,f=cap.read()
    if not ok: break
    if i==REF: ref=f.copy()
    if i>=START: f=clean_frame(f,ref)
    p.stdin.write(f.tobytes()); i+=1
p.stdin.close(); p.wait(); print('frames',i,'rc',p.returncode)
