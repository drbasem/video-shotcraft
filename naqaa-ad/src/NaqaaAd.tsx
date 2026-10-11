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

// ---------------------------------------------------------------------------
// Layered 2.5D rig: background / bottles / size pills are separate layers with
// their own depth, so they genuinely move relative to each other.
// ---------------------------------------------------------------------------
const BG = 'layers/p1_bg.png';
const BOTTLES: Rect[] = [{x: 167, y: 1033, w: 171, h: 380}, {x: 372, y: 937, w: 181, h: 481}, {x: 592, y: 778, w: 221, h: 635}];
const PILLS: Rect[] = [{x: 165, y: 1427, w: 157, h: 46}, {x: 385, y: 1427, w: 158, h: 46}, {x: 622, y: 1427, w: 168, h: 46}];
const B_DEPTH = [0.9, 1.0, 1.15];
const PW = 941;
const PH = 1672;
const P1_WATERFALL: Pt[] = [[85, 775], [190, 790], [300, 900], [345, 1020], [330, 1060], [150, 1055], [100, 900]];

// each bottle hops (start frames). A hop lasts 26 frames in the air, then squashes on landing.
const HOPS: number[][] = [
  [14, 300, 452],
  [28, 350, 466],
  [42, 396, 480],
];
const AIR = 26;

const bottleMotion = (g: number, i: number) => {
  let lift = 0, sq = 0, tilt = 0;
  for (const h0 of HOPS[i]) {
    const u = (g - h0) / AIR;
    if (u >= 0 && u <= 1) { lift = Math.max(lift, 4 * u * (1 - u) * 85); tilt = Math.sin(u * Math.PI * 2) * (i % 2 ? -3 : 3); }
    const d = g - (h0 + AIR);
    if (d >= 0 && d < 40) sq += Math.exp(-d / 5) * Math.cos(d * 0.75);
  }
  const t = g / 30;
  return {
    lift, sy: 1 - 0.095 * sq, sx: 1 + 0.065 * sq,
    rot: tilt + Math.sin(t * 1.2 + i * 1.7) * 1.3,
    bob: Math.sin(t * 1.7 + i * 1.1) * 4,
  };
};

const glintFrames = (i: number) => [...HOPS[i].map((h) => h + AIR + 3), 118 + i * 9, 218 + i * 9, 520 + i * 8];

const Rig: React.FC<{keys: Key[]}> = ({keys}) => {
  const g = useCurrentFrame();
  const c = cam(keys, g);
  const k = c.k * fit({src: BG, w: PW, h: PH});
  const vw = W / k, vh = H / k;
  const cl = (v: number, half: number, size: number) => (half * 2 <= size ? Math.min(Math.max(v, half), size - half) : size / 2);
  const cx = cl(c.cx, vw / 2, PW);
  const cy = cl(c.cy, vh / 2, PH);
  const t = g / 30;
  const base = (d: number) => {
    const ex = d * (Math.sin(t * 0.8) * 11 + (cx - 470) * k * 0.035);
    const ey = d * Math.cos(t * 0.6) * 5;
    return `translate(${ex}px, ${ey}px) translate(${W / 2 - cx * k}px, ${H / 2 - cy * k}px) scale(${k})`;
  };
  const layer = (d: number): React.CSSProperties => ({position: 'absolute', left: 0, top: 0, width: PW, height: PH, transformOrigin: '0 0', transform: base(d)});
  const landings = BOTTLES.flatMap((b, i) => HOPS[i].map((h0) => ({at: h0 + AIR, x: b.x + b.w / 2, y: b.y + b.h - 14, i})));
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#0a3a78'}}>
      {/* background plate */}
      <div style={layer(0)}>
        <Img src={staticFile(BG)} style={{position: 'absolute', left: 0, top: 0, width: PW, height: PH}} />
        <WaterfallFlow g={g} poly={P1_WATERFALL} seed={3} w={PW} h={PH} />
        <Sparkles g={g} area={{x: 330, y: 1040, w: 560, h: 110}} n={16} seed={5} />
      </div>

      {/* bottles */}
      {BOTTLES.map((b, i) => {
        const m = bottleMotion(g, i);
        return (
          <div key={i} style={layer(B_DEPTH[i])}>
            <div style={{position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, transformOrigin: '50% 100%',
              transform: `translateY(${-m.lift + m.bob}px) rotate(${m.rot}deg) scale(${m.sx}, ${m.sy})`,
              filter: m.lift > 8 ? 'drop-shadow(0 14px 14px rgba(0,40,100,0.25))' : undefined}}>
              <Img src={staticFile(`layers/p1_b${i}.png`)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} />
              {glintFrames(i).map((f) => {
                const u = clamp01((g - f) / 28);
                if (g < f || u >= 1) return null;
                const p = -35 + u * 170;
                const mask = `url(${staticFile(`layers/p1_b${i}.png`)})`;
                return <div key={f} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: Math.sin(u * Math.PI),
                  WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
                  background: `linear-gradient(105deg, transparent ${p - 16}%, rgba(255,255,255,1) ${p}%, transparent ${p + 16}%)`}} />;
              })}
            </div>
          </div>
        );
      })}

      {/* size pills (slightly nearer than the bottles) */}
      {PILLS.map((p, i) => {
        const m = bottleMotion(g, i);
        return (
          <div key={i} style={layer(0)}>
            <Img src={staticFile(`layers/p1_pill${i}.png`)} style={{position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h,
              transform: `scale(${1 + (m.sx - 1) * 0.6})`, transformOrigin: '50% 50%'}} />
          </div>
        );
      })}

      {/* splashes where the bottles land */}
      <div style={layer(1.0)}>
        {landings.map((l, n) => <Splash key={n} g={g} at={l.at} x={l.x} y={l.y} n={30} power={1.15} seed={l.i * 7 + n} />)}
      </div>
    </AbsoluteFill>
  );
};

const KEYS: Key[] = [
  {f: 0, cx: 470, cy: 1180, k: 1.12},
  {f: 60, cx: 470, cy: 1150, k: 1.2},
  {f: 100, cx: 470, cy: 1100, k: 1.26},
  {f: 165, cx: 470, cy: 0, k: 1.5},      // crane up to the logo
  {f: 205, cx: 470, cy: 0, k: 1.5},
  {f: 248, cx: 470, cy: 700, k: 1.9},    // benefit icons
  {f: 285, cx: 470, cy: 700, k: 1.9},
  {f: 325, cx: 262, cy: 1230, k: 1.85},  // 50 ml
  {f: 345, cx: 262, cy: 1230, k: 1.85},
  {f: 375, cx: 462, cy: 1190, k: 1.8},   // 100 ml
  {f: 390, cx: 462, cy: 1190, k: 1.8},
  {f: 420, cx: 702, cy: 1100, k: 1.7},   // 200 ml
  {f: 440, cx: 702, cy: 1100, k: 1.7},
  {f: 495, cx: 470, cy: 1250, k: 1.14},  // wide, wave of hops
  {f: 600, cx: 470, cy: 836, k: 1.0},    // final pull-back
];

const Sfx: React.FC<{f: number; src: string; v?: number; dur?: number}> = ({f, src, v = 0.7, dur = 120}) => (
  <Sequence from={f} durationInFrames={dur}><Audio src={staticFile(`sfx/${src}`)} volume={v} /></Sequence>
);

export const NaqaaAd: React.FC = () => {
  const frame = useCurrentFrame();
  const master = interpolate(frame, [TOTAL - 24, TOTAL], [1, 0], {extrapolateLeft: 'clamp'});
  const landings = HOPS.flatMap((hs) => hs.map((h) => h + AIR)).sort((a, b) => a - b);
  return (
    <AbsoluteFill style={{background: '#0a3a78'}}>
      <style>{`
        @font-face{font-family:'CairoAr';font-weight:900;src:url(${staticFile('fonts/cairo-arabic-900-normal.woff2')}) format('woff2');}
        @font-face{font-family:'CairoAr';font-weight:700;src:url(${staticFile('fonts/cairo-arabic-700-normal.woff2')}) format('woff2');}
      `}</style>
      <Rig keys={KEYS} />
      <SunRays />
      <Droplets />
      <Flash at={108} />
      <Flash at={210} />
      <Flash at={430} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 62%, rgba(0,30,80,0.28) 100%)'}} />

      <Caption text="ثلاثة أحجام.. نقاء واحد" from={296} to={372} y={90} size={60} />
      <Caption text="حجم يناسب كل لحظة" from={374} to={444} y={90} size={60} />

      <AbsoluteFill style={{background: '#0a3a78', opacity: 1 - master}} />

      <Sfx f={0} src="riser-cine.mp3" v={0.3} dur={90} />
      {landings.map((l, n) => <Sfx key={n} f={l - 2} src="water-splash.mp3" v={0.5} dur={50} />)}
      <Sfx f={104} src="whoosh-big.mp3" v={0.55} />
      <Sfx f={205} src="swoosh-slow.mp3" v={0.45} />
      <Sfx f={290} src="swoosh-slow.mp3" v={0.4} />
      <Sfx f={428} src="whoosh-big.mp3" v={0.45} />
      <Sfx f={540} src="shimmer-sparkle-sweep.mp3" v={0.6} />
      <Sfx f={560} src="sparkle.mp3" v={0.5} dur={50} />
    </AbsoluteFill>
  );
};
