// The scene engine. Only ever reached through a dynamic import from Scene.tsx,
// so three.js never loads on the server or before the page is interactive.
//
// Two draws a frame: every point in one THREE.Points call into a render
// target, then one fullscreen composite to the canvas. All motion is uniforms
// on those two draws; the CPU's per-frame work is the choreography lookup and
// a ~2000-cell pointer field.

import * as THREE from "three";
import { prefersReducedMotion } from "@/lib/motion/easings";
import { damp } from "@/lib/motion/progress";
import { introStarted, stageProgress } from "@/lib/stage/store";
import { readLayoutFlags, type LayoutFlags } from "@/lib/stage/useLayoutFlags";
import {
  DESKTOP_LAYOUT,
  DESKTOP_LOOKS,
  MOBILE_LAYOUT,
  MOBILE_LOOKS,
  PROOF_STEP,
  createLook,
  evaluateFill,
  evaluateForm,
  evaluateLook,
  formForStep,
  lookForStep,
  markWeight,
  type FormBlend,
} from "./choreography";
import { INTRO, MARK, MARK_EXTENT, buildSceneGeometry } from "./geometry";
import { PointerField } from "./pointerField";
import {
  CLEAR_HIGH,
  FramePacingGovernor,
  RENDER_SCALE_STEPS,
  TIERS,
  median,
  pickTier,
  probeStep,
} from "./quality";
import { compositeFragment, compositeVertex, pointsFragment, pointsVertex } from "./shaders";
import { readTokens } from "./tokens";

export type EngineOptions = {
  signal: AbortSignal;
  onProgress: (pct: number) => void;
  onReady: () => void;
};

export type SceneEngine = { dispose: () => void };

const DEG = Math.PI / 180;
/** Stage-position smoothing on top of Lenis, so jumps sweep instead of snap. */
const DAMP_MS = 140;
/** Base RGB split at the screen edge, in viewport heights. */
const CA_BASE = 0.0026;
const CA_MOTION_MAX = 0.005;
/** Grid pitch and dot radius, CSS px. */
const GRID_PITCH = 14;
const GRID_DOT = 0.65;
const GRID_STRENGTH = 0.055;
const DOT_RADIUS = 7;
const FOG_DENSITY = 0.15;
/** Sprite diameter as a share of the mark's lattice spacing. */
const SPRITE_SHARE = 0.52;
const MIN_SPRITE_PX = 1.5;
/** Field recession speed, world units per second; depth span of the field. */
const FIELD_SPEED = 0.35;
const FIELD_NEAR = 2;
const FIELD_FAR = -22;
/** Camera z at which parallax ranges are authored. */
const PARALLAX_REF_Z = 5;
/** Reads/ships cluster sizes are authored at this camera distance. */
const CLUSTER_REF_Z = 6.6;

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

function makeFieldTexture(field: PointerField): THREE.DataTexture {
  const texture = new THREE.DataTexture(
    field.data,
    field.width,
    field.height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export async function createSceneEngine(
  container: HTMLElement,
  options: EngineOptions,
): Promise<SceneEngine | null> {
  const { signal, onProgress, onReady } = options;
  const tokens = readTokens();
  const tier = TIERS[pickTier()];

  // ── Geometry (the heavy CPU step, behind the preloader) ─────────────────
  await nextTask();
  if (signal.aborted) return null;
  const geo = buildSceneGeometry(tier.points);
  onProgress(55);
  await nextTask();
  if (signal.aborted) return null;

  // ── Renderer ─────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });
  renderer.setClearColor(0x000000, 1);
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  const vec3 = (rgb: [number, number, number]) => new THREE.Vector3(rgb[0], rgb[1], rgb[2]);

  // ── Points ───────────────────────────────────────────────────────────────
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(geo.mark, 3));
  geometry.setAttribute("aInfo", new THREE.BufferAttribute(geo.info, 4));
  geometry.setAttribute("aReads", new THREE.BufferAttribute(geo.reads, 4));
  geometry.setAttribute("aBand", new THREE.BufferAttribute(geo.band, 3));
  geometry.setAttribute("aField", new THREE.BufferAttribute(geo.field, 3));
  geometry.setAttribute("aShips", new THREE.BufferAttribute(geo.ships, 4));
  geometry.setAttribute("aVis", new THREE.BufferAttribute(geo.vis, 4));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

  let flags: LayoutFlags = readLayoutFlags();
  let width = Math.max(1, container.clientWidth || window.innerWidth);
  let height = Math.max(1, container.clientHeight || window.innerHeight);

  let field = new PointerField(tier.fieldCells, width / height);
  let fieldTexture = makeFieldTexture(field);

  const u = {
    uTime: { value: 0 },
    uMotion: { value: 1 },
    uIntroTime: { value: 0 },
    uIntroFlight: { value: INTRO.flight },
    uIntroGlobal: { value: 0 },
    uFrom: { value: 0 },
    uTo: { value: 0 },
    uFormT: { value: 0 },
    uMark: { value: new THREE.Matrix4() },
    uSplit: { value: new THREE.Matrix4() },
    uFrustum: { value: new THREE.Vector3(0.36, 0.36, 5) },
    uReadsL: { value: new THREE.Vector3() },
    uReadsR: { value: new THREE.Vector3() },
    uReadsScale: { value: 1 },
    uBandY: { value: -1 },
    uField: { value: new THREE.Vector4(FIELD_SPEED, FIELD_NEAR, FIELD_FAR, 0.4) },
    uFieldClear: { value: new THREE.Vector4() },
    uShips: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 1)) },
    uBright: { value: 1 },
    uGlow: { value: 0 },
    uShimmer: { value: 1 },
    uSize: { value: geo.spacing * SPRITE_SHARE },
    uPxScale: { value: 1000 },
    uMinPx: { value: MIN_SPRITE_PX },
    uDisturb: { value: 1 },
    uCalmRight: { value: 0 },
    uFog: { value: new THREE.Vector2(5, FOG_DENSITY) },
    uInk: { value: vec3(tokens.ink) },
    uAccent: { value: vec3(tokens.accent) },
    uFieldTex: { value: fieldTexture as THREE.Texture },
  };

  const pointsMaterial = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: pointsVertex,
    fragmentShader: pointsFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  const points = new THREE.Points(geometry, pointsMaterial);
  points.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(points);
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 120);

  // ── Composite ────────────────────────────────────────────────────────────
  const target = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    stencilBuffer: false,
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
  });
  const post = {
    tScene: { value: target.texture as THREE.Texture },
    tField: { value: fieldTexture as THREE.Texture },
    uRes: { value: new THREE.Vector2(1, 1) },
    uAspect: { value: width / height },
    uTime: u.uTime,
    uMotion: u.uMotion,
    uCA: { value: CA_BASE },
    uCAMotion: { value: 0 },
    uInk: u.uInk,
    uAccent: u.uAccent,
    uAccentDeep: { value: vec3(tokens.accentDeep) },
    uGround: { value: vec3(tokens.ground) },
    uHaze: { value: 0 },
    uGrid: { value: new THREE.Vector3(GRID_PITCH, GRID_DOT, GRID_STRENGTH) },
    uGridShift: { value: new THREE.Vector2() },
    uGlow: { value: new THREE.Vector3(0.5, 0.5, 0) },
    uGlowRadius: { value: 0.2 },
    uFill: { value: new THREE.Vector2(0, 0) },
    uFillAlpha: { value: 1 },
    uFillDetail: { value: 1 },
    uVignette: { value: 0.6 },
    uDot: { value: new THREE.Vector4(0.5, 0.5, DOT_RADIUS, 0) },
  };
  const postMaterial = new THREE.ShaderMaterial({
    uniforms: post,
    vertexShader: compositeVertex,
    fragmentShader: compositeFragment,
    depthTest: false,
    depthWrite: false,
  });
  const triangle = new THREE.BufferGeometry();
  triangle.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  triangle.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const quad = new THREE.Mesh(triangle, postMaterial);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(quad);
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ── Sizing ───────────────────────────────────────────────────────────────
  let dprCap = tier.dprCap;
  let maxPixels = tier.maxPixels;
  let scaleStep = 0;
  let pixelRatio = 1;
  let bufferHeight = 1;

  function applySize() {
    width = Math.max(1, container.clientWidth || window.innerWidth);
    height = Math.max(1, container.clientHeight || window.innerHeight);
    let dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const pixels = width * height * dpr * dpr;
    if (pixels > maxPixels) dpr *= Math.sqrt(maxPixels / pixels);
    dpr *= RENDER_SCALE_STEPS[Math.min(scaleStep, RENDER_SCALE_STEPS.length - 1)];
    pixelRatio = dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
    target.setSize(buffer.x, buffer.y);
    bufferHeight = buffer.y;
    post.uRes.value.copy(buffer);
    post.uAspect.value = width / height;
    post.uFillDetail.value = scaleStep >= 2 ? 0 : 1;
  }

  function rebuildField() {
    const next = new PointerField(tier.fieldCells, width / height);
    const texture = makeFieldTexture(next);
    fieldTexture.dispose();
    field = next;
    fieldTexture = texture;
    u.uFieldTex.value = texture;
    post.tField.value = texture;
  }

  applySize();

  // ── Frame state ──────────────────────────────────────────────────────────
  let reduced = prefersReducedMotion();
  let introOn = introStarted.get();
  let introTime = 0;
  let elapsed = 0;
  let stageP = 0;
  let firstUpdate = true;
  let pointerSpeed = 0;
  let caMotion = 0;
  const look = createLook();
  const form: FormBlend = { from: 0, to: 0, t: 0 };
  const pointer = { nx: 0, ny: 0, u: 0.5, v: 0.5, t: 0, seen: false };
  const parallax = new THREE.Vector2();
  const markPos = new THREE.Vector3();
  const markQuat = new THREE.Quaternion();
  const markScale = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, "YXZ");
  const splitQuat = new THREE.Quaternion();
  const m1 = new THREE.Matrix4();
  const m2 = new THREE.Matrix4();
  const projected = new THREE.Vector3();

  function update(dt: number) {
    const dtMs = dt * 1000;
    const stage = stageProgress.get();
    const targetP = stage.step + stage.value;
    const previousP = stageP;
    stageP = reduced || firstUpdate ? targetP : damp(stageP, targetP, DAMP_MS, dtMs);
    const scrollSpeed = firstUpdate ? 0 : Math.abs(stageP - previousP) / Math.max(dt, 1e-3);
    firstUpdate = false;

    const mobile = flags.isMobile;
    const table = mobile ? MOBILE_LOOKS : DESKTOP_LOOKS;
    const layout = mobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT;
    let fillIn = 0;
    let fillOut = 0;
    if (reduced) {
      lookForStep(stage.step, table, look);
      formForStep(stage.step, form);
      fillIn = stage.step === PROOF_STEP ? 1 : 0;
    } else {
      evaluateLook(stageP, table, look);
      evaluateForm(stageP, form);
      [fillIn, fillOut] = evaluateFill(stageP);
    }

    if (!reduced) elapsed += dt;
    if (introOn) {
      introTime = reduced ? INTRO.total : Math.min(INTRO.total + 1, introTime + Math.min(dt, 1 / 30));
    }
    const introGlobal = introOn ? smoothstep(0.4, 1.8, introTime) : 0;
    const motion = reduced ? 0 : 1;

    // Camera: `fit` is half the shorter side at the subject plane.
    const aspect = width / height;
    const fov = aspect < 1 ? layout.fovPortrait : layout.fovLandscape;
    const tanH = Math.tan((fov * DEG) / 2);
    const camZ = look.fit / (tanH * Math.min(aspect, 1));
    const parallaxOn = !reduced && !flags.isTouch;
    const blend = 1 - Math.exp(-8 * dt);
    parallax.x += ((parallaxOn ? pointer.nx * look.parallax : 0) - parallax.x) * blend;
    parallax.y += ((parallaxOn ? pointer.ny * look.parallax : 0) - parallax.y) * blend;
    const pScale = camZ / PARALLAX_REF_Z;
    camera.fov = fov;
    camera.aspect = aspect;
    camera.position.set(parallax.x * 0.35 * pScale, parallax.y * 0.2 * pScale, camZ);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // The mark: placed in NDC at its depth, breathing.
    const markDist = camZ - look.mz;
    const breathe = look.breathe * motion;
    markPos.set(look.mx * tanH * aspect * markDist, look.my * tanH * markDist, look.mz);
    euler.set(
      look.tiltX + breathe * 0.1 * Math.sin(elapsed * 0.17 + 1.3),
      look.tiltY + breathe * 0.16 * Math.sin(elapsed * 0.21),
      breathe * 0.02 * Math.sin(elapsed * 0.13),
    );
    markQuat.setFromEuler(euler);
    const s = look.scale * (1 + breathe * 0.012 * Math.sin(elapsed * 0.5));
    markScale.set(s, s, s);
    u.uMark.value.compose(markPos, markQuat, markScale);

    // The S drifting off the C, turning about its own centre.
    const sp = look.split;
    const [ox, oy, oz] = layout.splitOffset;
    splitQuat.setFromEuler(euler.set(0, sp * 0.55, -sp * 0.12));
    m1.makeTranslation(-MARK.sShift, 0, 0);
    m2.makeRotationFromQuaternion(splitQuat);
    u.uSplit.value
      .makeTranslation(MARK.sShift + ox * sp, oy * sp + 0.04 * sp * Math.sin(elapsed * 0.4) * motion, oz * sp)
      .multiply(m2)
      .multiply(m1);

    // Screen-anchored formations.
    u.uFrustum.value.set(tanH * aspect, tanH, camZ);
    const unproject = (out: THREE.Vector3, nx: number, ny: number, z: number) =>
      out.set(nx * tanH * aspect * (camZ - z), ny * tanH * (camZ - z), z);
    unproject(u.uReadsL.value, -layout.readsX, layout.readsY, 0);
    unproject(u.uReadsR.value, layout.readsX, layout.readsY, 0);
    u.uReadsScale.value = layout.readsWidth * tanH * aspect * camZ;
    u.uBandY.value = layout.bandY * tanH * camZ;
    u.uField.value.set(FIELD_SPEED, FIELD_NEAR, FIELD_FAR, Math.min(1, layout.fieldPoints / geo.count));
    u.uFieldClear.value.fromArray(layout.fieldClear);
    layout.ships.forEach(([nx, ny, z], i) => {
      const cluster = u.uShips.value[i];
      const d = camZ - z;
      cluster.set(nx * tanH * aspect * d, ny * tanH * d, z, 0);
      cluster.w = layout.shipsScale * (camZ / CLUSTER_REF_Z) * (1 + 0.45 * (d / camZ - 1));
    });

    // Formation blend and the look.
    u.uFrom.value = form.from;
    u.uTo.value = form.to;
    u.uFormT.value = form.t;
    u.uTime.value = elapsed;
    u.uMotion.value = motion;
    u.uIntroTime.value = introOn ? introTime : 0;
    u.uIntroGlobal.value = introGlobal;
    u.uBright.value = look.bright;
    u.uGlow.value = look.glow;
    u.uShimmer.value = look.shimmer;
    u.uSize.value = geo.spacing * SPRITE_SHARE * look.size;
    u.uPxScale.value = bufferHeight / (2 * tanH);
    u.uMinPx.value = MIN_SPRITE_PX;
    u.uDisturb.value = reduced ? 0 : look.disturb;
    u.uCalmRight.value = look.calmRight;
    u.uFog.value.set(camZ + 0.3, FOG_DENSITY);
    points.visible = introOn;

    // Pointer field.
    pointerSpeed *= Math.exp(-dt / 0.25);
    if (!reduced && field.step(dt)) fieldTexture.needsUpdate = true;

    // Composite.
    const caTarget = reduced ? 0 : Math.min(CA_MOTION_MAX, scrollSpeed * 0.0022 + pointerSpeed * 0.0016);
    caMotion += (caTarget - caMotion) * (1 - Math.exp(-6 * dt));
    post.uCA.value = CA_BASE * look.ca * (reduced ? 0.6 : 1);
    post.uCAMotion.value = caMotion;
    post.uHaze.value = look.haze * introGlobal;
    post.uGrid.value.set(GRID_PITCH * pixelRatio, GRID_DOT * pixelRatio, GRID_STRENGTH * look.grid);
    post.uGridShift.value.set(-parallax.x * 6 * pixelRatio, -parallax.y * 4 * pixelRatio);
    post.uVignette.value = look.vignette;
    post.uFill.value.set(fillIn, fillOut);
    post.uFillAlpha.value = reduced ? 0.9 : 1;

    // Glow and the intro dot sit on the mark's projected centre.
    projected.copy(markPos).project(camera);
    const cx = projected.x * 0.5 + 0.5;
    const cy = projected.y * 0.5 + 0.5;
    const markRadius = (MARK_EXTENT * look.scale) / (markDist * tanH) / 2;
    post.uGlow.value.set(cx, cy, look.glow * markWeight(form) * introGlobal);
    post.uGlowRadius.value = markRadius * 0.75;

    let dotAlpha = 0;
    let dotRadius = 0;
    if (introOn && !reduced && introTime < INTRO.dotOutEnd) {
      const grow = easeOutBack(clamp(introTime / INTRO.dotIn, 0, 1));
      const fade = 1 - smoothstep(INTRO.dotOutStart, INTRO.dotOutEnd, introTime);
      dotAlpha = fade;
      dotRadius = DOT_RADIUS * pixelRatio * Math.max(0, grow) * (0.6 + 0.4 * fade);
    }
    post.uDot.value.set(cx, cy, dotRadius, dotAlpha);
  }

  function render() {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
  }

  // ── Compile behind the preloader ─────────────────────────────────────────
  update(0);
  onProgress(65);
  // compile() only walks visible objects, and the points stay hidden until the
  // intro: show them for the compile so the intro never waits on a shader.
  points.visible = true;
  try {
    await renderer.compileAsync(scene, camera);
    await renderer.compileAsync(postScene, postCamera);
  } catch {
    // Parallel compile is an optimisation; the first render compiles anyway.
  }
  points.visible = introOn;
  if (signal.aborted) {
    disposeResources();
    return null;
  }
  onProgress(85);

  // ── Probe: a few synced frames in the heaviest state (band + fill) ──────
  {
    const gl = renderer.getContext();
    const pixel = new Uint8Array(4);
    const times: number[] = [];
    const wasVisible = points.visible;
    points.visible = true;
    u.uFrom.value = 2;
    u.uTo.value = 2;
    u.uIntroGlobal.value = 1;
    post.uFill.value.set(0.7, 0);
    for (let i = 0; i < 6; i++) {
      const t0 = performance.now();
      render();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      times.push(performance.now() - t0);
    }
    points.visible = wasVisible;
    const ms = median(times, 2);
    scaleStep = probeStep(ms);
    if (scaleStep === 0 && tier === TIERS.high && ms < CLEAR_HIGH.probeMs && window.devicePixelRatio >= 2) {
      dprCap = CLEAR_HIGH.dprCap;
      maxPixels = CLEAR_HIGH.maxPixels;
    }
    applySize();
    // Leave the canvas holding a real frame, never the probe's.
    update(0);
    render();
  }
  onProgress(92);
  if (signal.aborted) {
    disposeResources();
    return null;
  }

  // ── Loop ─────────────────────────────────────────────────────────────────
  let raf = 0;
  let lastNow = 0;
  let disposed = false;
  let contextLost = false;
  let resizePending = false;
  let readySent = false;
  const governor = new FramePacingGovernor((step) => {
    scaleStep = Math.max(scaleStep, step);
    applySize();
  }, scaleStep);

  const continuous = () => !disposed && !contextLost && !document.hidden && !reduced && introOn;

  function schedule() {
    if (!raf && !disposed && !contextLost && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function frame(now: number) {
    raf = 0;
    if (disposed || contextLost) return;
    const dtMs = lastNow ? Math.min(now - lastNow, 100) : 1000 / 60;
    lastNow = now;
    if (resizePending) {
      resizePending = false;
      handleResize();
    }
    update(dtMs / 1000);
    render();
    if (!readySent) {
      readySent = true;
      onReady();
    }
    if (introOn && introTime >= INTRO.total && continuous()) governor.record(dtMs, now);
    if (continuous()) schedule();
    else lastNow = 0;
  }

  function handleResize() {
    const nextWidth = Math.max(1, container.clientWidth || window.innerWidth);
    const nextHeight = Math.max(1, container.clientHeight || window.innerHeight);
    const nextFlags = readLayoutFlags();
    // A touch browser's URL bar sliding in and out only changes the height a
    // little: let CSS stretch the canvas instead of reallocating buffers.
    const urlBarOnly =
      nextFlags.isTouch &&
      nextWidth === width &&
      Math.abs(nextHeight - height) < 160 &&
      nextFlags.isMobile === flags.isMobile;
    flags = nextFlags;
    if (urlBarOnly) return;
    const aspectChanged = Math.abs(nextWidth / nextHeight - width / height) > 0.05;
    applySize();
    if (aspectChanged) rebuildField();
  }

  // ── Events ───────────────────────────────────────────────────────────────
  function onPointerMove(event: PointerEvent) {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const pu = event.clientX / w;
    const pv = 1 - event.clientY / h;
    pointer.nx = pu * 2 - 1;
    pointer.ny = pv * 2 - 1;
    if (reduced || !introOn) return;
    const now = event.timeStamp || performance.now();
    if (pointer.seen) {
      const dts = Math.max((now - pointer.t) / 1000, 1 / 240);
      const vx = clamp((pu - pointer.u) / dts, -4, 4);
      const vy = clamp((pv - pointer.v) / dts, -4, 4);
      field.splat(pu, pv, vx * 0.7, vy * 0.7);
      pointerSpeed = Math.max(pointerSpeed, Math.hypot(vx, vy));
    }
    pointer.u = pu;
    pointer.v = pv;
    pointer.t = now;
    pointer.seen = true;
  }

  function onPointerDown(event: PointerEvent) {
    if (reduced || !introOn) return;
    field.pulse(event.clientX / (window.innerWidth || 1), 1 - event.clientY / (window.innerHeight || 1), 1.2);
  }

  function onPointerLeave() {
    pointer.seen = false;
  }

  function onVisibility() {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      lastNow = 0;
      return;
    }
    // rAF stopped mid-flight: drop the frozen pointer energy and pacing samples.
    field.clear();
    pointer.seen = false;
    governor.reset();
    schedule();
  }

  function onContextLost(event: Event) {
    event.preventDefault();
    contextLost = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function onContextRestored() {
    contextLost = false;
    fieldTexture.needsUpdate = true;
    lastNow = 0;
    schedule();
  }

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  function onMotionChange() {
    reduced = motionQuery.matches;
    field.clear();
    schedule();
  }

  const resizeObserver = new ResizeObserver(() => {
    resizePending = true;
    schedule();
  });
  resizeObserver.observe(container);

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  document.documentElement.addEventListener("pointerleave", onPointerLeave);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);
  motionQuery.addEventListener("change", onMotionChange);

  const unsubscribeIntro = introStarted.subscribe(() => {
    if (introStarted.get() && !introOn) {
      introOn = true;
      introTime = 0;
      // Pointer moves over the preloader must not burst the mark as it forms.
      field.clear();
      schedule();
    }
  });
  // Under reduced motion (and before the intro) frames are drawn on demand.
  const unsubscribeStage = stageProgress.subscribe(() => {
    if (!continuous()) schedule();
  });

  schedule();

  function disposeResources() {
    geometry.dispose();
    pointsMaterial.dispose();
    triangle.dispose();
    postMaterial.dispose();
    target.dispose();
    fieldTexture.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    unsubscribeIntro();
    unsubscribeStage();
    resizeObserver.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
    document.documentElement.removeEventListener("pointerleave", onPointerLeave);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.removeEventListener("webglcontextrestored", onContextRestored);
    motionQuery.removeEventListener("change", onMotionChange);
    disposeResources();
  }

  return { dispose };
}
