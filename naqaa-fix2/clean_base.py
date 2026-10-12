import cv2, numpy as np
REF=838
def load_frames(path):
    cap=cv2.VideoCapture(path); fr=[]
    while True:
        ok,f=cap.read()
        if not ok: break
        fr.append(f)
    return fr
mask=cv2.imread('textmask.png',0)
X0,Y0,X1,Y1=640,760,1280,1080     # work window around the text
def clean_frame(cur,ref):
    c=cur[Y0:Y1,X0:X1]; r=ref[Y0:Y1,X0:X1]; m=(mask[Y0:Y1,X0:X1]>0).astype(np.uint8)
    # neutralise the text so it doesn't corrupt motion estimation
    cf=cv2.inpaint(c,cv2.dilate(m,np.ones((5,5),np.uint8)),5,cv2.INPAINT_TELEA)
    g1=cv2.cvtColor(cf,cv2.COLOR_BGR2GRAY); g2=cv2.cvtColor(r,cv2.COLOR_BGR2GRAY)
    flow=cv2.calcOpticalFlowFarneback(g1,g2,None,0.5,5,31,6,7,1.5,0)
    h,w=g1.shape
    gx,gy=np.meshgrid(np.arange(w,dtype=np.float32),np.arange(h,dtype=np.float32))
    warped=cv2.remap(r,gx+flow[...,0],gy+flow[...,1],cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
    ring=(cv2.dilate(m,np.ones((31,31),np.uint8))-cv2.dilate(m,np.ones((9,9),np.uint8)))>0
    off=(c.astype(np.float32)-warped)[ring].mean(0)
    a=cv2.GaussianBlur(m.astype(np.float32),(0,0),2.0)[...,None]
    a=np.clip(a*1.6,0,1)
    out=c.astype(np.float32)*(1-a)+(warped+off)*a
    res=cur.copy(); res[Y0:Y1,X0:X1]=out.clip(0,255).astype(np.uint8)
    return res
if __name__=='__main__':
    fr=load_frames('src.mp4'); print(len(fr))
    ref=fr[REF]; rows=[]
    for fi in (848,870,895):
        o=clean_frame(fr[fi],ref)
        rows.append(np.vstack([fr[fi][900:1080,800:1130],o[900:1080,800:1130]]))
    cv2.imwrite('clean_test.png',cv2.resize(np.hstack(rows),None,fx=1.6,fy=1.6,interpolation=cv2.INTER_CUBIC))
