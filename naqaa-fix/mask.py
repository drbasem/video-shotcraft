import cv2, numpy as np
cap=cv2.VideoCapture('src.mp4')
X0,X1,Y0,Y1=840,1080,945,1050
stack=[];i=0
while True:
    ok,f=cap.read()
    if not ok: break
    if i>=880: stack.append(f[Y0:Y1,X0:X1].min(2))
    i+=1
med=np.median(np.stack(stack),0)
m=(med>175).astype(np.uint8)
n,lab,st,_=cv2.connectedComponentsWithStats(m)
keep=np.zeros_like(m)
for k in range(1,n):
    if st[k,cv2.CC_STAT_AREA]>=25: keep[lab==k]=1
mask=cv2.dilate(keep,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(9,9)))
full=np.zeros((1080,1920),np.uint8); full[Y0:Y1,X0:X1]=mask*255
cv2.imwrite('textmask.png',full)
ys,xs=np.where(keep>0); print('text bbox',xs.min()+X0,xs.max()+X0,ys.min()+Y0,ys.max()+Y0,'mask px',int(mask.sum()))
