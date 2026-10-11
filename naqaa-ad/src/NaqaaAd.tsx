import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';

export const TOTAL = 600;
const W = 1080;
const H = 1920;

type Key = {f: number; cx: number; cy: number; k: number};
type Img = {src: string; w: number; h: number};

const P1: Img = {src: 'img/p1.png', w: 941, h: 1672};
const P2: Img = {src: 'img/p2.png', w: 1224, h: 1285};
const P3: Img = {src: 'img/p3.png', w: 1224, h: 1285};
const fit = (i: Img) => W / i.w; // scale where the image fills the canvas width

const ease = Easing.inOut(Easing.cubic);

// Piecewise interpolation of camera keyframes (each segment eased).
const cam = (keys: Key[], frame: number) => {
  const f = Math.min(Math.max(frame, keys[0].f), keys[keys.length - 1].f);
  let i = 0;
  while (i < keys.length - 2 && f > keys[i + 1].f) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const t = ease(interpolate(f, [a.f, b.f], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  return {cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, k: a.k + (b.k - a.k) * t};
};

const Shot: React.FC<{img: Img; keys: Key[]; start: number; zoomIsFit?: boolean}> = ({img, keys, start, zoomIsFit}) => {
  const frame = useCurrentFrame() ; // local to the Sequence
  const c = cam(keys, frame + start);
  const k = zoomIsFit ? c.k * fit(img) : c.k;
  const vw = W / k;
  const vh = H / k;
  // subtle handheld drift (deterministic)
  const t = (frame + start) / 30;
  const dx = Math.sin(t * 1.3) * 3 + Math.sin(t * 2.7) * 1.5;
  const dy = Math.cos(t * 1.1) * 3 + Math.cos(t * 2.3) * 1.5;
  const cx = Math.min(Math.max(c.cx, vw / 2), img.w - vw / 2);
  const cy = Math.min(Math.max(c.cy, vh / 2), img.h - vh / 2);
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#0a3a78'}}>
      <Img
        src={staticFile(img.src)}
        style={{
          position: 'absolute', left: 0, top: 0, width: img.w, height: img.h,
          transformOrigin: '0 0',
          transform: `translate(${W / 2 - cx * k + dx}px, ${H / 2 - cy * k + dy}px) scale(${k})`,
        }}
      />
    </AbsoluteFill>
  );
};

// Scene wrapper: fades in/out over `fade` frames
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

// Deterministic PRNG
const mulberry32 = (a: number) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const Droplets: React.FC = () => {
  const frame = useCurrentFrame();
  const rnd = mulberry32(7);
  const items = Array.from({length: 26}, () => ({
    x: rnd() * W, y0: rnd() * H, r: 6 + rnd() * 22, sp: 0.4 + rnd() * 1.1, ph: rnd() * 6.28, o: 0.18 + rnd() * 0.28,
  }));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {items.map((d, i) => {
        const y = (((d.y0 - frame * d.sp * 1.4) % (H + 80)) + H + 80) % (H + 80) - 40;
        const x = d.x + Math.sin(frame / 40 + d.ph) * 14;
        return (
          <div key={i} style={{
            position: 'absolute', left: x, top: y, width: d.r * 2, height: d.r * 2, borderRadius: '50%',
            background: 'radial-gradient(circle at 32% 30%, rgba(255,255,255,0.95), rgba(190,230,255,0.35) 45%, rgba(255,255,255,0) 72%)',
            opacity: d.o, filter: 'blur(0.6px)',
          }} />
        );
      })}
    </AbsoluteFill>
  );
};

// A soft diagonal light sweep at the given frame
const Sweep: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [at - 10, at + 22], [-0.4, 1.4], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const o = interpolate(frame, [at - 10, at + 4, at + 22], [0, 0.55, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{
      opacity: o, mixBlendMode: 'screen',
      background: `linear-gradient(110deg, transparent ${t * 100 - 18}%, rgba(255,255,255,0.9) ${t * 100}%, transparent ${t * 100 + 18}%)`,
    }} />
  );
};

const Sfx: React.FC<{f: number; src: string; v?: number; dur?: number}> = ({f, src, v = 0.7, dur = 120}) => (
  <Sequence from={f} durationInFrames={dur}>
    <Audio src={staticFile(`sfx/${src}`)} volume={v} />
  </Sequence>
);

// ---- camera plans -------------------------------------------------------
// Poster 1 (vertical). k = zoom relative to fit-width.
const A: Key[] = [
  {f: 0, cx: 470, cy: 930, k: 1.38},     // open on waterfall & mountains
  {f: 20, cx: 470, cy: 930, k: 1.38},
  {f: 95, cx: 470, cy: 0, k: 1.1},      // crane up to the Naqaa logo
  {f: 135, cx: 470, cy: 0, k: 1.04},     // hold on logo
  {f: 185, cx: 470, cy: 700, k: 1.9},    // three benefit icons
  {f: 225, cx: 470, cy: 700, k: 1.9},
  {f: 285, cx: 480, cy: 2000, k: 1.22},  // drop to the bottle trio
  {f: 345, cx: 520, cy: 2000, k: 1.32},  // slow push-in
];
// Poster 2 (square, k absolute px scale): 50ml -> 100ml -> 200ml
const B: Key[] = [
  {f: 330, cx: 365, cy: 790, k: 1.93},
  {f: 362, cx: 365, cy: 790, k: 1.93},
  {f: 392, cx: 610, cy: 790, k: 1.93},
  {f: 412, cx: 610, cy: 790, k: 1.93},
  {f: 440, cx: 880, cy: 790, k: 1.93},
  {f: 452, cx: 880, cy: 790, k: 1.93},
];
// Poster 3: bottles -> "اختيارك الطبيعي" tagline
const D: Key[] = [
  {f: 440, cx: 400, cy: 700, k: 1.93},
  {f: 470, cx: 400, cy: 700, k: 1.93},
  {f: 520, cx: 990, cy: 800, k: 1.93},
  {f: 536, cx: 990, cy: 800, k: 1.93},
];
// Poster 1 full-frame closing pull-back with the Cairo Foods mark
const E: Key[] = [
  {f: 524, cx: 470, cy: 836, k: 1.18},
  {f: 600, cx: 470, cy: 836, k: 1.0},
];

export const NaqaaAd: React.FC = () => {
  const frame = useCurrentFrame();
  const master = interpolate(frame, [TOTAL - 24, TOTAL], [1, 0], {extrapolateLeft: 'clamp'});
  return (
    <AbsoluteFill style={{background: '#0a3a78'}}>
      <Scene from={0} to={345}>
        <Shot img={P1} keys={A} start={0} zoomIsFit />
      </Scene>
      <Scene from={330} to={452}>
        <Shot img={P2} keys={B} start={330} />
      </Scene>
      <Scene from={440} to={536}>
        <Shot img={P3} keys={D} start={440} />
      </Scene>
      <Scene from={524} to={TOTAL} fade={14}>
        <Shot img={P1} keys={E} start={524} zoomIsFit />
      </Scene>

      <Droplets />
      <Sweep at={90} />
      <Sweep at={330} />
      <Sweep at={440} />
      <Sweep at={524} />

      {/* soft vignette */}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 62%, rgba(0,30,80,0.28) 100%)'}} />
      <AbsoluteFill style={{background: '#0a3a78', opacity: 1 - master}} />

      {/* sound design: riser -> whoosh on logo reveal -> splash on bottles -> sparkle on close */}
      <Sfx f={0} src="riser-cine.mp3" v={0.35} dur={100} />
      <Sfx f={80} src="whoosh-big.mp3" v={0.6} />
      <Sfx f={178} src="swoosh-slow.mp3" v={0.45} />
      <Sfx f={272} src="water-splash.mp3" v={0.7} />
      <Sfx f={326} src="swoosh-slow.mp3" v={0.5} />
      <Sfx f={436} src="whoosh-big.mp3" v={0.45} />
      <Sfx f={520} src="shimmer-sparkle-sweep.mp3" v={0.6} />
      <Sfx f={548} src="sparkle.mp3" v={0.5} dur={50} />
    </AbsoluteFill>
  );
};
