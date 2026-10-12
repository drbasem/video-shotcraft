import cv2, numpy as np
from common import *
cap=cv2.VideoCapture('src.mp4'); cap.set(cv2.CAP_PROP_POS_FRAMES,3560)
bx0,bx1,by0,by1=800,1120,930,1060
stack=[]
for i in range(3560,3604):
    ok,f=cap.read(); stack.append(f[by0:by1,bx0:bx1].min(2))
med=np.median(np.stack(stack),0); m=(med>175).astype(np.uint8)
n,lab,st,_=cv2.connectedComponentsWithStats(m)
keep=np.zeros_like(m)
for k in range(1,n):
    if st[k,cv2.CC_STAT_AREA]>=25: keep[lab==k]=1
mk=cv2.dilate(keep,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(9,9)))
full=np.zeros((1080,1920),np.uint8); full[by0:by1,bx0:bx1]=mk*255
keepbox=np.zeros_like(full); keepbox[950:1045,850:1076]=1; full=full*keepbox
cv2.imwrite('textmask.png',full)
ys,xs=np.where(keep>0); print('text bbox',xs.min()+bx0,xs.max()+bx0,ys.min()+by0,ys.max()+by0,'components',n-1)
# overlay check + before/after on 3 frames
load_mask()
cap.set(cv2.CAP_PROP_POS_FRAMES,REF); ok,ref=cap.read()
rows=[]
for fi in (3380,3480,3600):
    cap.set(cv2.CAP_PROP_POS_FRAMES,fi); ok,f=cap.read()
    o=clean_frame(f,ref)
    ov=f.copy(); ov[full>0]=(ov[full>0]*0.4+np.array([0,0,255])*0.6).astype(np.uint8)
    rows.append(np.vstack([ov[900:1080,780:1150],o[900:1080,780:1150]]))
cv2.imwrite('test.png',cv2.resize(np.hstack(rows),None,fx=1.5,fy=1.5,interpolation=cv2.INTER_CUBIC))
