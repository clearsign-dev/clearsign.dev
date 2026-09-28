// GLSL for the scene's two draws. Written GLSL1-style for THREE.ShaderMaterial,
// which compiles it as GLSL ES 3.00 on WebGL2 (so int uniforms, dynamic array
// indexing and texture reads in the vertex stage are all available).

import { MARK, MARK_VISUAL_CX } from "./geometry";
import { FIELD_RANGE } from "./pointerField";

const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${n}`);

const SHARED = /* glsl */ `
#define PI 3.14159265
#define FIELD_SCALE ${f(FIELD_RANGE * 2)}
`;

// ── Points ─────────────────────────────────────────────────────────────────
// Every point carries a target in each formation; the shader places it by
// blending the active two, then lets the pointer field push it about.

export const pointsVertex = /* glsl */ `
${SHARED}
#define S_CENTRE vec2(${f(MARK.sShift)}, 0.0)
#define INTRO_ORIGIN vec2(${f(MARK_VISUAL_CX)}, 0.0)

attribute vec4 aInfo;   // part (0 C, 1 S), intro delay, rand, rand
attribute vec4 aReads;  // side, lattice offset xyz
attribute vec3 aBand;   // ndc x, y offset, z
attribute vec3 aField;  // ndc xy, z at t = 0
attribute vec4 aShips;  // cluster, local xyz
attribute vec4 aVis;    // reads, band, field threshold, ships

uniform float uTime;
uniform float uMotion;
uniform float uIntroTime;
uniform float uIntroFlight;
uniform float uIntroGlobal;
uniform int uFrom;
uniform int uTo;
uniform float uFormT;
uniform mat4 uMark;
uniform mat4 uSplit;
uniform vec3 uFrustum;      // tan(fov/2) * aspect, tan(fov/2), camera z
uniform vec3 uReadsL;
uniform vec3 uReadsR;
uniform float uReadsScale;
uniform vec4 uReadsClear;   // dim disc: centre xy, radius, feather (lattice units)
uniform float uBandY;
uniform vec4 uField;        // speed, z near, z far, share shown
uniform vec4 uFieldClear;   // ndc rectangle kept clear
uniform vec4 uShips[4];     // centre xyz, scale
uniform float uBright;
uniform float uSLevel;
uniform float uGlow;
uniform float uShimmer;
uniform float uSize;
uniform float uPxScale;
uniform float uMinPx;
uniform float uDisturb;
uniform float uCalmRight;
uniform vec2 uFog;          // start distance, density
uniform vec3 uInk;
uniform vec3 uAccent;
uniform sampler2D uFieldTex;

varying vec3 vColor;
varying float vAlpha;

vec2 rot2(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

vec3 unproject(vec2 ndc, float z) {
  return vec3(ndc * uFrustum.xy * (uFrustum.z - z), z);
}

vec3 markPos(out float vis) {
  vec3 p = position;
  if (aInfo.x > 0.5) p = (uSplit * vec4(p, 1.0)).xyz;
  // Intro: out of the centre dot, swirling into place along the drawing direction.
  float it = clamp((uIntroTime - aInfo.y) / uIntroFlight, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - it, 3.0);
  vec3 origin = vec3(INTRO_ORIGIN, 0.0);
  vec3 q = origin + (p - origin) * e;
  q.xy = INTRO_ORIGIN + rot2(q.xy - INTRO_ORIGIN, -(1.0 - e) * 1.3);
  q.z -= (1.0 - e) * 0.5;
  vis = smoothstep(0.0, 0.35, it);
  return (uMark * vec4(q, 1.0)).xyz;
}

vec3 readsPos(out float vis) {
  vec3 centre = aReads.x < 0.0 ? uReadsL : uReadsR;
  // A scan line walks down the rows, the way a reader goes down a dump.
  float scanY = 0.75 - fract(uTime * 0.09 + (aReads.x < 0.0 ? 0.0 : 0.5)) * 1.5;
  float scan = exp(-pow((aReads.z - scanY) * 9.0, 2.0)) * uMotion;
  // Keep the hotspot's eye and label legible: dim a soft disc behind them.
  float clearK = uReadsClear.z > 0.0
    ? smoothstep(uReadsClear.z - uReadsClear.w, uReadsClear.z, length(aReads.yz - uReadsClear.xy))
    : 1.0;
  vis = aVis.x * (1.0 + 1.1 * scan) * mix(0.3, 1.0, clearK) * uIntroGlobal;
  return centre + aReads.yzw * uReadsScale;
}

vec3 bandPos(out float vis) {
  float z = aBand.z;
  float x = aBand.x * uFrustum.x * (uFrustum.z - z);
  float y = uBandY + aBand.y + 0.035 * sin(aBand.x * 4.0 + z * 0.6 + uTime * 0.45) * uMotion;
  vis = aVis.y * uIntroGlobal;
  return vec3(x, y, z);
}

vec3 fieldPos(out float vis) {
  float range = uField.y - uField.z;
  float z = uField.z + mod(aField.z - uField.z - uTime * uField.x, range);
  vec2 ndc = aField.xy;
  ndc.x += 0.015 * sin(uTime * 0.3 + aInfo.w * 6.2831) * uMotion;
  vec2 lo = smoothstep(uFieldClear.xy - 0.08, uFieldClear.xy + 0.08, aField.xy);
  vec2 hi = 1.0 - smoothstep(uFieldClear.zw - 0.08, uFieldClear.zw + 0.08, aField.xy);
  float inside = lo.x * lo.y * hi.x * hi.y;
  // Fade in as a point wraps back to the near plane; the fog takes it at the far end.
  float enter = 1.0 - smoothstep(uField.y - 2.5, uField.y, z);
  vis = step(aVis.z, uField.w) * (1.0 - inside) * enter * (0.55 + 0.45 * aInfo.w) * uIntroGlobal;
  return unproject(ndc, z);
}

vec3 shipsPos(out float vis) {
  vec4 cluster = uShips[int(aShips.x + 0.5)];
  vec3 l = aShips.yzw * cluster.w;
  l.xz = rot2(l.xz, uTime * 0.22 * uMotion + aShips.x * 1.7);
  l.yz = rot2(l.yz, 0.35);
  vis = aVis.w * uIntroGlobal;
  return cluster.xyz + l;
}

vec3 formPos(int id, out float vis) {
  if (id == 1) return readsPos(vis);
  if (id == 2) return bandPos(vis);
  if (id == 3) return fieldPos(vis);
  if (id == 4) return shipsPos(vis);
  return markPos(vis);
}

void main() {
  float vis;
  vec3 world = formPos(uFrom, vis);
  float markW = uFrom == 0 ? 1.0 : 0.0;
  float flight = 0.0;

  if (uFormT > 0.0 && uTo != uFrom) {
    float visB;
    vec3 target = formPos(uTo, visB);
    // Staggered per point, on a slight arc, so the morph reads as a flock.
    float k = clamp(uFormT * 1.6 - aInfo.z * 0.6, 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    vec3 dir = normalize(vec3(cos(aInfo.z * 6.2831), sin(aInfo.w * 6.2831), aInfo.z - aInfo.w) + 1e-4);
    flight = sin(PI * k);
    world = mix(world, target, k) + dir * flight * min(length(target - world), 5.0) * 0.18;
    vis = mix(vis, visB, k);
    markW = mix(markW, uTo == 0 ? 1.0 : 0.0, k);
  }

  vec4 mv = viewMatrix * vec4(world, 1.0);
  vec4 clip = projectionMatrix * mv;
  vec2 suv = clip.xy / max(clip.w, 1e-3) * 0.5 + 0.5;

  // Pointer disturbance from the velocity field under this point.
  vec2 vel = (texture2D(uFieldTex, suv).rg - 0.5) * FIELD_SCALE;
  float calm = 1.0 - uCalmRight * smoothstep(0.42, 0.62, suv.x);
  float act = smoothstep(0.03, 0.7, length(vel)) * uDisturb * calm;
  float dist = max(-mv.z, 0.001);
  float depthK = dist / uFrustum.z;
  vec3 rnd = normalize(vec3(aInfo.z - 0.5, aInfo.w - 0.5, fract(aInfo.z * 7.13 + aInfo.w) - 0.5) + 1e-4);
  mv.xy += (vel * 0.07 + rnd.xy * 0.09) * act * depthK;
  mv.z += rnd.z * 0.12 * act * depthK;
  gl_Position = projectionMatrix * mv;

  // Brightness: slow per-point shimmer and a travelling wave.
  float shimmer = uShimmer * uMotion * calm;
  float twinkle = sin(uTime * (0.55 + aInfo.w * 0.8) + aInfo.w * 40.0);
  float wave = sin(dot(world.xy, vec2(1.7, 1.1)) - uTime * 0.8);
  float b = uBright * (1.0 + shimmer * (0.22 * twinkle + 0.12 * wave));
  // The S tube packs more points per pixel than the rods: hold it to the C's level.
  b *= mix(1.0, uSLevel, aInfo.x * markW);

  // getIt: brighter from within, leaning toward the accent near the core.
  float inner = 1.0 - smoothstep(0.15, 1.05, length(position.xy - S_CENTRE));
  float glow = uGlow * markW * inner;
  vec3 color = mix(uInk, uAccent * 1.3 + vec3(0.08), glow * 0.55);
  b *= 1.0 + glow * 0.9 + flight * 0.35;

  // Size by depth with a floor; what the floor adds is paid back in alpha.
  float px = uSize * uPxScale / dist;
  float shown = max(px, uMinPx);
  float cover = (px * px) / (shown * shown);
  float fog = exp(-pow(max(0.0, dist - uFog.x) * uFog.y, 2.0));
  float nearFade = smoothstep(0.3, 1.2, dist);

  vAlpha = vis * fog * nearFade * cover;
  vColor = color * b * (1.0 + act * 0.8);
  gl_PointSize = shown * (1.0 + act * 0.6);
  // Unused slots are moved off screen so they cost no fill.
  if (vAlpha < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

export const pointsFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float edge = 1.0 - smoothstep(0.45, 1.0, r2);
  // Each sprite shaded as a tiny ball, lit from above.
  float lit = 0.7 + 0.3 * clamp(sqrt(1.0 - r2) * 0.55 - c.y * 0.45, 0.0, 1.0);
  gl_FragColor = vec4(vColor * (vAlpha * edge * lit), 1.0);
}
`;

// ── Composite ──────────────────────────────────────────────────────────────
// One fullscreen pass: RGB split, haze, grid, getIt glow, the proof fill,
// vignette, the intro dot, dither.

export const compositeVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const compositeFragment = /* glsl */ `
${SHARED}
uniform sampler2D tScene;
uniform sampler2D tField;
uniform vec2 uRes;
uniform float uAspect;
uniform float uTime;
uniform float uMotion;
uniform float uCA;
uniform float uCAMotion;
uniform vec3 uInk;
uniform vec3 uAccent;
uniform vec3 uAccentDeep;
uniform vec3 uGround;
uniform float uHaze;
uniform vec3 uGrid;         // pitch px, dot radius px, strength
uniform vec2 uGridShift;    // px
uniform vec3 uGlow;         // centre uv, amount
uniform float uGlowRadius;  // in viewport heights
uniform vec2 uFill;         // sweep in, sweep out
uniform float uFillAlpha;
uniform float uFillDetail;
uniform float uVignette;
uniform vec4 uDot;          // centre uv, radius px, alpha

varying vec2 vUv;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float ridge(vec2 p) {
  return pow(1.0 - abs(vnoise(p) * 2.0 - 1.0), 1.35);
}

float ridgedFbm(vec2 p) {
  float v = ridge(p) * 0.55 + ridge(p * 2.05 + 3.1) * 0.3;
  v += uFillDetail > 0.5 ? ridge(p * 4.1 + 7.7) * 0.15 : 0.075;
  return v;
}

void main() {
  vec2 uv = vUv;
  vec2 axisScale = vec2(max(uAspect, 1.0), max(1.0 / uAspect, 1.0));
  vec2 cc = (uv - 0.5) * axisScale;   // 0.5 at the inscribed circle
  float r = length(cc);

  // RGB split: radial, breathing, wider with motion, bent by the pointer field.
  vec2 fv = (texture2D(tField, uv).rg - 0.5) * FIELD_SCALE;
  vec2 radial = r > 1e-4 ? (cc / r) / axisScale : vec2(0.0);
  float amount = uCA * (1.0 + 0.5 * sin(uTime * 1.3) * uMotion) * smoothstep(0.08, 0.75, r)
               + uCAMotion * smoothstep(0.0, 0.55, r);
  vec2 off = radial * amount + fv * 0.0025 * uMotion;
  vec3 col = vec3(
    texture2D(tScene, uv + off).r,
    texture2D(tScene, uv - off * 0.35).g,
    texture2D(tScene, uv - off).b
  );
  col += uGround;

  // Faint accent haze, weighted to the centre.
  vec2 hp = uv * vec2(uAspect, 1.0) * 2.2 + vec2(uTime * 0.015, -uTime * 0.01);
  col += uAccentDeep * uHaze * 0.1 * (0.55 * exp(-r * r * 5.0) + 0.45 * vnoise(hp));

  // The dotted grid, a plane behind everything.
  vec2 cell = (fract((gl_FragCoord.xy + uGridShift) / uGrid.x) - 0.5) * uGrid.x;
  float gridDot = 1.0 - smoothstep(uGrid.y - 0.5, uGrid.y + 0.6, length(cell));
  col += uInk * gridDot * uGrid.z * (1.0 - 0.5 * smoothstep(0.2, 0.9, r));

  // getIt: light from within the mark.
  vec2 gd = (uv - uGlow.xy) * vec2(uAspect, 1.0);
  col += uAccent * uGlow.z * 0.22 * exp(-dot(gd, gd) / max(uGlowRadius * uGlowRadius, 1e-4));

  // Proof: a procedural fog in dark accent tones sweeps across and away.
  if (uFill.x > 0.0 && uFill.y < 1.0) {
    vec2 np = uv * vec2(uAspect, 1.0) * vec2(2.4, 3.2) + vec2(uTime * 0.03, -uTime * 0.02);
    float n = ridgedFbm(np);
    float front = uv.x * 0.78 + (1.0 - uv.y) * 0.22 + (n - 0.5) * 0.56;
    float soft = 0.16;
    float thIn = mix(-0.5, 1.5, uFill.x);
    float thOut = mix(-0.5, 1.5, uFill.y);
    float mIn = 1.0 - smoothstep(thIn - soft, thIn + soft, front);
    float mOut = 1.0 - smoothstep(thOut - soft, thOut + soft, front);
    float cover = mIn * (1.0 - mOut);
    vec3 fogCol = mix(uGround, uAccentDeep * 0.55, 0.35 + 0.65 * n) + uAccent * 0.1 * n * n * n;
    float rim = 4.0 * (mIn * (1.0 - mIn) * (1.0 - mOut) + mOut * (1.0 - mOut) * mIn);
    col = mix(col, fogCol, cover * (0.8 + 0.2 * n) * uFillAlpha);
    col += uAccent * rim * 0.12 * uFillAlpha;
  }

  col *= 1.0 - uVignette * smoothstep(0.35, 0.95, r);

  // Intro: the single bright dot the mark grows out of.
  if (uDot.w > 0.0) {
    float dd = length((uv - uDot.xy) * uRes);
    float disc = 1.0 - smoothstep(uDot.z - 1.0, uDot.z + 1.0, dd);
    float halo = exp(-dd * dd / max(uDot.z * uDot.z * 7.0, 1e-3)) * 0.35;
    col = mix(col, uInk, disc * uDot.w);
    col += uInk * halo * uDot.w;
  }

  col += (hash12(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;
