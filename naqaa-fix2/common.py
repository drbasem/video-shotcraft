import cv2, numpy as np
REF=3350          # clean frame before the text appears
START=3360        # first frame to patch
END=3603          # last frame of the scene (cut to end card is at 3604)
X0,Y0,X1,Y1=640,760,1280,1080   # work window around the text
mask=None
def load_mask():
    global mask
    mask=cv2.imread('textmask.png',0); return mask
def clean_frame(cur,ref):
    c=cur[Y0:Y1,X0:X1]; r=ref[Y0:Y1,X0:X1]; m=(mask[Y0:Y1,X0:X1]>0).astype(np.uint8)
    cf=cv2.inpaint(c,cv2.dilate(m,np.ones((5,5),np.uint8)),5,cv2.INPAINT_TELEA)
    g1=cv2.cvtColor(cf,cv2.COLOR_BGR2GRAY); g2=cv2.cvtColor(r,cv2.COLOR_BGR2GRAY)
    flow=cv2.calcOpticalFlowFarneback(g1,g2,None,0.5,5,31,6,7,1.5,0)
    h,w=g1.shape
    gx,gy=np.meshgrid(np.arange(w,dtype=np.float32),np.arange(h,dtype=np.float32))
    warped=cv2.remap(r,gx+flow[...,0],gy+flow[...,1],cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
    ring=(cv2.dilate(m,np.ones((31,31),np.uint8))-cv2.dilate(m,np.ones((9,9),np.uint8)))>0
    off=(c.astype(np.float32)-warped)[ring].mean(0)
    a=np.clip(cv2.GaussianBlur(m.astype(np.float32),(0,0),2.0)[...,None]*1.6,0,1)
    out=c.astype(np.float32)*(1-a)+(warped+off)*a
    res=cur.copy(); res[Y0:Y1,X0:X1]=out.clip(0,255).astype(np.uint8)
    return res
