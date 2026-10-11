import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';

export const TOTAL = 600;
const W = 1080;
const H = 1920;

type Key = {f: number; cx: number; cy: number; k: number};
type Pic = {src: string; w: number; h: number};
type Rect = {x: number; y: number; w: number; h: number};
type Pt = [number, number];

const P1: Pic = {src: 'img/p1.png', w: 941, h: 1672};
const P2: Pic = {src: 'img/p2.png', w: 1224, h: 1285};
const P3: Pic = {src: 'img/p3.png', w: 1224, h: 1285};
const fit = (i: Pic) => W / i.w;
const ease = Easing.inOut(Easing.cubic);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const cam = (keys: Key[], frame: number) => {
  const f = Math.min(Math.max(frame, keys[0].f), keys[keys.length - 1].f);
  let i = 0;
  while (i < keys.length - 2 && f > keys[i + 1].f) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const t = ease(clamp01((f - a.f) / (b.f - a.f)));
  return {cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, k: a.k + (b.k - a.k) * t};
};

const mulberry32 = (a: number) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---------------------------------------------------------------------------
// Poster-space effects (drawn inside the camera transform, so they stay glued
// to the picture while the camera moves)
// ---------------------------------------------------------------------------

/** Falling water streaks clipped to the waterfall polygon + rising mist at its base. */
const WaterfallFlow: React.FC<{g: number; poly: Pt[]; seed: number; w: number; h: number}> = ({g, poly, seed, w, h}) => {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const rnd = mulberry32(seed);
  const streaks = Array.from({length: 70}, () => ({
    x: x0 + rnd() * (x1 - x0), ph: rnd() * 1000, sp: 7 + rnd() * 9, len: 40 + rnd() * 110, wd: 1.5 + rnd() * 4, o: 0.3 + rnd() * 0.55,
  }));
  const span = y1 - y0;
  return (
    <>
      <div style={{position: 'absolute', left: 0, top: 0, width: w, height: h,
        clipPath: `polygon(${poly.map((p) => `${p[0]}px ${p[1]}px`).join(',')})`, mixBlendMode: 'screen'}}>
        {streaks.map((s, i) => {
          const y = y0 - s.len + ((s.ph + g * s.sp) % (span + s.len));
          return <div key={i} style={{position: 'absolute', left: s.x, top: y, width: s.wd, height: s.len, borderRadius: s.wd,
            background: 'linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.95) 55%, rgba(255,255,255,0))',
            opacity: s.o, filter: 'blur(0.8px)'}} />;
        })}
      </div>
      {Array.from({length: 7}, (_, i) => {
        const life = (g * 0.7 + i * 23) % 160;
        const px = x0 + (x1 - x0) * (0.2 + 0.1 * i) + Math.sin(g / 30 + i) * 16;
        return <div key={`m${i}`} style={{position: 'absolute', left: px - 70, top: y1 - 40 - life * 1.1, width: 140, height: 90,
          borderRadius: '50%', opacity: Math.sin((life / 160) * Math.PI) * 0.35, filter: 'blur(18px)',
          background: 'radial-gradient(closest-side, #fff, rgba(255,255,255,0))'}} />;
      })}
    </>
  );
};

/** Physically-driven droplet burst (gravity + drag), deterministic. */
const Splash: React.FC<{g: number; at: number; x: number; y: number; n?: number; power?: number; seed?: number}> = ({g, at, x, y, n = 26, power = 1, seed = 1}) => {
  const t = g - at;
  if (t < 0 || t > 60) return null;
  const rnd = mulberry32(seed * 977 + at);
  return (
    <>
      {Array.from({length: n}, (_, i) => {
        const ang = (-90 + (rnd() - 0.5) * 150) * (Math.PI / 180);
        const sp = (6 + rnd() * 11) * power;
        const r = 3 + rnd() * 7;
        const px = x + Math.cos(ang) * sp * t * 0.9;
        const py = y + Math.sin(ang) * sp * t * 0.9 + 0.5 * 0.55 * t * t;
        const o = clamp01(1 - t / 52);
        return <div key={i} style={{position: 'absolute', left: px - r, top: py - r, width: r * 2, height: r * 2, borderRadius: '50%', opacity: o,
          background: 'radial-gradient(circle at 32% 30%, #fff, rgba(200,235,255,0.75) 45%, rgba(120,190,255,0.25) 75%, rgba(255,255,255,0))',
          boxShadow: '0 0 6px rgba(255,255,255,0.6)'}} />;
      })}
      {/* ripple ring at the base */}
      <div style={{position: 'absolute', left: x - 20 - t * 4.5, top: y - 6 - t * 0.9, width: 40 + t * 9, height: 12 + t * 1.8, borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.8)', opacity: clamp01(1 - t / 40) * 0.8}} />
    </>
  );
};

/** Specular highlight sweeping across a bottle. */
const Glint: React.FC<{g: number; rect: Rect; at: number; radius?: number}> = ({g, rect, at, radius = 46}) => {
  const t = clamp01((g - at) / 26);
  if (g < at || t >= 1) return null;
  const p = -30 + t * 160;
  return (
    <div style={{position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: radius, overflow: 'hidden', mixBlendMode: 'screen',
      opacity: Math.sin(t * Math.PI), background: `linear-gradient(105deg, transparent ${p - 14}%, rgba(255,255,255,0.95) ${p}%, transparent ${p + 14}%)`}} />
  );
};

/** Twinkling glints on the water surface. */
const Sparkles: React.FC<{g: number; area: Rect; n: number; seed: number}> = ({g, area, n, seed}) => {
  const rnd = mulberry32(seed);
  return (
    <>
      {Array.from({length: n}, (_, i) => {
        const x = area.x + rnd() * area.w, y = area.y + rnd() * area.h, sp = 5 + rnd() * 8, ph = rnd() * 20, s = 10 + rnd() * 20;
        const o = Math.pow(Math.max(0, Math.sin(g / sp + ph)), 8);
        return (
          <div key={i} style={{position: 'absolute', left: x - s, top: y - s, width: s * 2, height: s * 2, opacity: o, mixBlendMode: 'screen',
            background: `radial-gradient(closest-side, #fff, rgba(255,255,255,0) 70%), linear-gradient(90deg, transparent 40%, #fff 50%, transparent 60%), linear-gradient(0deg, transparent 40%, #fff 50%, transparent 60%)`,
            backgroundSize: '100% 100%, 100% 3px, 3px 100%', backgroundRepeat: 'no-repeat', backgroundPosition: 'center'}} />
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------------------
// Camera shot: pan/zoom + gentle 3D orbit tilt, overlay lives in poster space
// ---------------------------------------------------------------------------
const Shot: React.FC<{img: Pic; keys: Key[]; start: number; zoomIsFit?: boolean; tilt?: number; overlay?: (g: number) => React.ReactNode}> = ({
  img, keys, start, zoomIsFit, tilt = 1, overlay,
}) => {
  const frame = useCurrentFrame();
  const g = frame + start;
  const c = cam(keys, g);
  const k = zoomIsFit ? c.k * fit(img) : c.k;
  const m = 1.08; // overscan so the 3D tilt never exposes edges
  const vw = (W / k) * m;
  const vh = (H / k) * m;
  const cl = (v: number, half: number, size: number) => (half * 2 <= size ? Math.min(Math.max(v, half), size - half) : size / 2);
  const cx = cl(c.cx, vw / 2, img.w);
  const cy = cl(c.cy, vh / 2, img.h);
  const t = g / 30;
  const ry = Math.sin(t * 0.9) * 3.2 * tilt;
  const rx = Math.cos(t * 0.7) * 1.8 * tilt;
  const rz = Math.sin(t * 0.5) * 0.7 * tilt;
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#0a3a78', perspective: 1700}}>
      <Img src={staticFile(img.src)} style={{position: 'absolute', left: -150, top: -150, width: W + 300, height: H + 300, objectFit: 'cover', filter: 'blur(40px)'}} />
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '50% 50%',
        transform: `rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${rz}deg) scale(${m})`}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: img.w, height: img.h, transformOrigin: '0 0',
          transform: `translate(${W / 2 - cx * k}px, ${H / 2 - cy * k}px) scale(${k})`}}>
          <Img src={staticFile(img.src)} style={{position: 'absolute', left: 0, top: 0, width: img.w, height: img.h}} />
          {overlay ? overlay(g) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Scene: React.FC<{from: number; to: number; fade?: number; children: React.ReactNode}> = ({from, to, fade = 12, children}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [from, from + fade, to - fade, to], [from === 0 ? 1 : 0, 1, 1, to >= TOTAL ? 1 : 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return (
    <Sequence from={from} durationInFrames={to - from}>
      <AbsoluteFill style={{opacity: o}}>{children}</AbsoluteFill>
    </Sequence>
  );
};

// ---------------------------------------------------------------------------
// Screen-space layers
// ---------------------------------------------------------------------------
const Droplets: React.FC = () => {
  const frame = useCurrentFrame();
  const rnd = mulberry32(7);
  const items = Array.from({length: 26}, () => ({x: rnd() * W, y0: rnd() * H, r: 6 + rnd() * 22, sp: 0.4 + rnd() * 1.1, ph: rnd() * 6.28, o: 0.18 + rnd() * 0.28}));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {items.map((d, i) => {
        const y = (((d.y0 - frame * d.sp * 1.4) % (H + 80)) + H + 80) % (H + 80) - 40;
        const x = d.x + Math.sin(frame / 40 + d.ph) * 14;
        return <div key={i} style={{position: 'absolute', left: x, top: y, width: d.r * 2, height: d.r * 2, borderRadius: '50%', opacity: d.o, filter: 'blur(0.6px)',
          background: 'radial-gradient(circle at 32% 30%, rgba(255,255,255,0.95), rgba(190,230,255,0.35) 45%, rgba(255,255,255,0) 72%)'}} />;
      })}
    </AbsoluteFill>
  );
};

/** Slowly rotating sun rays from the top-left, like light through trees. */
const SunRays: React.FC = () => {
  const frame = useCurrentFrame();
  const a = -8 + Math.sin(frame / 60) * 6;
  return (
    <AbsoluteFill style={{mixBlendMode: 'screen', opacity: 0.42, pointerEvents: 'none',
      background: `repeating-conic-gradient(from ${a}deg at -5% 6%, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.55) 3deg, rgba(255,255,255,0) 7deg, rgba(255,255,255,0) 11deg)`,
      maskImage: 'radial-gradient(ellipse at 0% 5%, #000 0%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse at 0% 5%, #000 0%, transparent 75%)'}} />
  );
};

const Flash: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at - 3, at + 2, at + 16], [0, 0.75, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 40%, #fff, rgba(210,240,255,0.6) 50%, rgba(255,255,255,0) 80%)', opacity: o, mixBlendMode: 'screen'}} />;
};

/** Arabic kinetic caption: words blur/rise in one by one, glass pill, fades out. */
const Caption: React.FC<{text: string; from: number; to: number; y: number; size?: number}> = ({text, from, to, y, size = 74}) => {
  const frame = useCurrentFrame();
  if (frame < from || frame > to) return null;
  const words = text.split(' ');
  const out = interpolate(frame, [to - 10, to], [1, 0], {extrapolateLeft: 'clamp'});
  const pill = interpolate(frame, [from, from + 10], [0, 1], {extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', opacity: out}}>
      <div style={{direction: 'rtl', display: 'flex', gap: 18, padding: '18px 44px', borderRadius: 80, transform: `scale(${0.92 + 0.08 * pill})`,
        background: 'linear-gradient(135deg, rgba(5,50,130,0.72), rgba(20,110,200,0.55))', border: '2px solid rgba(255,255,255,0.55)',
        boxShadow: '0 12px 40px rgba(0,40,120,0.35), inset 0 0 30px rgba(255,255,255,0.18)', opacity: pill}}>
        {words.map((w, i) => {
          const t = clamp01((frame - from - 4 - i * 6) / 14);
          const e = Easing.out(Easing.cubic)(t);
          return <span key={i} style={{fontFamily: 'CairoAr, sans-serif', fontWeight: 900, fontSize: size, color: '#fff', lineHeight: 1.25,
            textShadow: '0 4px 18px rgba(0,40,120,0.6)', opacity: e, transform: `translateY(${(1 - e) * 36}px)`, filter: `blur(${(1 - e) * 10}px)`}}>{w}</span>;
        })}
      </div>
    </div>
  );
};

const Sfx: React.FC<{f: number; src: string; v?: number; dur?: number}> = ({f, src, v = 0.7, dur = 120}) => (
  <Sequence from={f} durationInFrames={dur}><Audio src={staticFile(`sfx/${src}`)} volume={v} /></Sequence>
);

// ---------------------------------------------------------------------------
// Camera plans + poster geometry
// ---------------------------------------------------------------------------
const A: Key[] = [
  {f: 0, cx: 470, cy: 930, k: 1.38},
  {f: 20, cx: 470, cy: 930, k: 1.38},
  {f: 95, cx: 470, cy: 0, k: 1.1},
  {f: 135, cx: 470, cy: 0, k: 1.04},
  {f: 185, cx: 470, cy: 700, k: 1.9},
  {f: 225, cx: 470, cy: 700, k: 1.9},
  {f: 285, cx: 480, cy: 2000, k: 1.22},
  {f: 345, cx: 520, cy: 2000, k: 1.32},
];
const B: Key[] = [
  {f: 330, cx: 365, cy: 790, k: 1.93},
  {f: 362, cx: 365, cy: 790, k: 1.93},
  {f: 392, cx: 610, cy: 790, k: 1.93},
  {f: 412, cx: 610, cy: 790, k: 1.93},
  {f: 440, cx: 880, cy: 790, k: 1.93},
  {f: 452, cx: 880, cy: 790, k: 1.93},
];
const D: Key[] = [
  {f: 440, cx: 400, cy: 700, k: 1.93},
  {f: 470, cx: 400, cy: 700, k: 1.93},
  {f: 520, cx: 990, cy: 800, k: 1.93},
  {f: 536, cx: 990, cy: 800, k: 1.93},
];
const E: Key[] = [
  {f: 524, cx: 470, cy: 836, k: 1.18},
  {f: 600, cx: 470, cy: 836, k: 1.0},
];

const P1_WATERFALL: Pt[] = [[85, 775], [190, 790], [300, 900], [345, 1020], [330, 1060], [150, 1055], [100, 900]];
const P1_BOTTLES: Rect[] = [{x: 170, y: 1035, w: 165, h: 370}, {x: 375, y: 940, w: 175, h: 470}, {x: 595, y: 780, w: 215, h: 620}];
const P1_BASES: Pt[] = [[252, 1395], [462, 1405], [702, 1400]];
const P2_WATERFALL: Pt[] = [[90, 425], [150, 420], [235, 640], [245, 745], [120, 745], [70, 600]];
const P2_BOTTLES: Rect[] = [{x: 262, y: 650, w: 205, h: 450}, {x: 488, y: 497, w: 230, h: 610}, {x: 748, y: 375, w: 270, h: 730}];
const P2_BASES: Pt[] = [[365, 1085], [603, 1095], [880, 1095]];
const P3_WATERFALL: Pt[] = [[10, 470], [80, 470], [160, 600], [165, 700], [40, 700], [10, 620]];
const P3_BOTTLES: Rect[] = [{x: 105, y: 660, w: 165, h: 390}, {x: 278, y: 510, w: 185, h: 545}, {x: 475, y: 350, w: 215, h: 720}];
const P3_BASES: Pt[] = [[185, 1040], [365, 1045], [585, 1050]];

const overlayP1 = (g: number) => (
  <>
    <WaterfallFlow g={g} poly={P1_WATERFALL} seed={3} w={941} h={1672} />
    <Sparkles g={g} area={{x: 330, y: 1040, w: 560, h: 110}} n={14} seed={5} />
    {P1_BASES.map((p, i) => <Splash key={`s${i}`} g={g} at={274 + i * 5} x={p[0]} y={p[1]} seed={i + 1} />)}
    {P1_BASES.map((p, i) => <Splash key={`t${i}`} g={g} at={322 + i * 5} x={p[0]} y={p[1]} n={16} power={0.7} seed={i + 9} />)}
    {P1_BOTTLES.map((r, i) => <Glint key={i} g={g} rect={r} at={288 + i * 9} />)}
  </>
);
const overlayP2 = (g: number) => (
  <>
    <WaterfallFlow g={g} poly={P2_WATERFALL} seed={11} w={1224} h={1285} />
    <Sparkles g={g} area={{x: 520, y: 700, w: 700, h: 220}} n={16} seed={8} />
    {[[340, 0], [370, 1], [402, 2]].map(([at, i]) => (
      <Splash key={i} g={g} at={at} x={P2_BASES[i][0]} y={P2_BASES[i][1]} n={30} power={1.15} seed={i + 21} />
    ))}
    {P2_BOTTLES.map((r, i) => <Glint key={i} g={g} rect={r} at={[348, 378, 418][i]} radius={60} />)}
  </>
);
const overlayP3 = (g: number) => (
  <>
    <WaterfallFlow g={g} poly={P3_WATERFALL} seed={17} w={1224} h={1285} />
    <Sparkles g={g} area={{x: 480, y: 820, w: 700, h: 180}} n={14} seed={13} />
    {P3_BASES.map((p, i) => <Splash key={i} g={g} at={444 + i * 6} x={p[0]} y={p[1]} n={22} seed={i + 31} />)}
    {P3_BOTTLES.map((r, i) => <Glint key={i} g={g} rect={r} at={452 + i * 8} radius={55} />)}
  </>
);
const overlayE = (g: number) => (
  <>
    <WaterfallFlow g={g} poly={P1_WATERFALL} seed={3} w={941} h={1672} />
    <Sparkles g={g} area={{x: 330, y: 1040, w: 560, h: 110}} n={14} seed={5} />
    {P1_BASES.map((p, i) => <Splash key={i} g={g} at={528 + i * 5} x={p[0]} y={p[1]} n={22} seed={i + 41} />)}
    {P1_BOTTLES.map((r, i) => <Glint key={i} g={g} rect={r} at={540 + i * 8} />)}
  </>
);

export const NaqaaAd: React.FC = () => {
  const frame = useCurrentFrame();
  const master = interpolate(frame, [TOTAL - 24, TOTAL], [1, 0], {extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{background: '#0a3a78'}}>
      <style>{`
        @font-face{font-family:'CairoAr';font-weight:900;src:url(${staticFile('fonts/cairo-arabic-900-normal.woff2')}) format('woff2');}
        @font-face{font-family:'CairoAr';font-weight:700;src:url(${staticFile('fonts/cairo-arabic-700-normal.woff2')}) format('woff2');}
      `}</style>
      <Scene from={0} to={345}><Shot img={P1} keys={A} start={0} zoomIsFit overlay={overlayP1} /></Scene>
      <Scene from={330} to={452}><Shot img={P2} keys={B} start={330} overlay={overlayP2} /></Scene>
      <Scene from={440} to={536}><Shot img={P3} keys={D} start={440} overlay={overlayP3} tilt={0.8} /></Scene>
      <Scene from={524} to={TOTAL} fade={14}><Shot img={P1} keys={E} start={524} zoomIsFit overlay={overlayE} tilt={0.5} /></Scene>

      <SunRays />
      <Droplets />
      <Flash at={92} />
      <Flash at={330} />
      <Flash at={440} />
      <Flash at={524} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 62%, rgba(0,30,80,0.28) 100%)'}} />

      <Caption text="من قلب الطبيعة…" from={4} to={44} y={700} size={60} />
      <Caption text="ثلاثة أحجام.. نقاء واحد" from={270} to={330} y={745} size={56} />
      <Caption text="حجم يناسب كل لحظة" from={450} to={526} y={70} size={62} />

      <AbsoluteFill style={{background: '#0a3a78', opacity: 1 - master}} />

      <Sfx f={0} src="riser-cine.mp3" v={0.35} dur={100} />
      <Sfx f={80} src="whoosh-big.mp3" v={0.6} />
      <Sfx f={178} src="swoosh-slow.mp3" v={0.45} />
      <Sfx f={272} src="water-splash.mp3" v={0.8} />
      <Sfx f={326} src="swoosh-slow.mp3" v={0.5} />
      <Sfx f={340} src="water-splash.mp3" v={0.55} dur={60} />
      <Sfx f={436} src="whoosh-big.mp3" v={0.45} />
      <Sfx f={444} src="water-splash.mp3" v={0.5} dur={60} />
      <Sfx f={520} src="shimmer-sparkle-sweep.mp3" v={0.6} />
      <Sfx f={548} src="sparkle.mp3" v={0.5} dur={50} />
    </AbsoluteFill>
  );
};
