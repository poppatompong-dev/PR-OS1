// The wall screen's 3D mascot — "ตัวเลือก 2 · ฟองคำพูดโทรโข่ง" (a mint speech
// bubble holding a pink megaphone), built from three.js primitives.
//
// Loaded only by /monitor?v=3d, through a dynamic import, so the default
// screen never downloads three.js.
//
// It runs on the office Smart TV's built-in browser, which is the weakest
// device the system serves. Every choice below follows from that:
//   - 30 fps cap, pixel ratio 1, no antialiasing, no shadow maps (the floor
//     shadow is a CSS glow under the canvas), modest segment counts;
//   - the loop stops while the tab is hidden;
//   - if frames keep arriving slower than 60 ms for about 90 frames, the loop
//     stops for good and the last frame stays on screen — a still mascot is
//     fine, a screen that stutters all day is not.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const C = {
  purple: 0x7a3d96,
  gold: 0xf2b937,
  goldSoft: 0xffd77a,
  mint: 0x7fd6c2,
  pink: 0xff8fa3,
  blush: 0xffb3c1,
  ink: 0x2d2350,
  white: 0xffffff,
};

// MeshStandardMaterial, not MeshPhysical: clearcoat roughly doubles the
// per-pixel cost, and on a TV GPU the mascot has to share the frame with the
// whole page. Low roughness gives most of the same glossy look.
const soft = (color: number, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.3, ...o });
const metal = (color: number) => new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.25 });
const glossy = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.06 });
const glow = (color: number) => new THREE.MeshBasicMaterial({ color });

type V3 = [number, number, number];

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  return m;
}

function eye(r: number, pos: V3) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(r, 20, 14), glossy(C.ink), [0, 0, 0], [0, 0, 0], [1, 1.2, 0.6]));
  g.add(mesh(new THREE.SphereGeometry(r * 0.32, 10, 8), glow(C.white), [r * 0.35, r * 0.45, r * 0.5]));
  g.position.set(...pos);
  return g;
}

/** Closed happy eye "^". */
function happyEye(pos: V3) {
  return mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 20, Math.PI), glossy(C.ink), pos);
}

/** An arm pivoted at the shoulder, so rotating the pivot swings the arm. */
function arm(mat: THREE.Material, from: V3, angleZ: number) {
  const pivot = new THREE.Group();
  pivot.position.set(...from);
  pivot.add(mesh(new THREE.CapsuleGeometry(0.12, 0.3, 4, 10), mat, [0, -0.2, 0]));
  pivot.add(mesh(new THREE.SphereGeometry(0.15, 14, 10), mat, [0, -0.41, 0]));
  pivot.rotation.z = angleZ;
  return pivot;
}

function megaphone(handle: THREE.Material) {
  const m = new THREE.Group();
  m.add(
    mesh(
      new THREE.CylinderGeometry(0.34, 0.11, 0.62, 28, 1, true),
      new THREE.MeshStandardMaterial({ color: C.pink, roughness: 0.3, side: THREE.DoubleSide }),
    ),
  );
  m.add(mesh(new THREE.TorusGeometry(0.34, 0.04, 8, 28), soft(C.white), [0, 0.31, 0], [Math.PI / 2, 0, 0]));
  m.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 16), handle, [0, -0.38, 0]));
  m.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 10), metal(C.gold), [0, -0.3, -0.16], [Math.PI / 2, 0, 0]));
  return m;
}

function soundWaves() {
  const g = new THREE.Group();
  [0.32, 0.5, 0.68].forEach((r, i) => {
    g.add(
      mesh(new THREE.TorusGeometry(r, 0.03, 6, 20, Math.PI * 0.55), glow(i === 1 ? C.gold : C.goldSoft), [0, 0, 0], [0, 0, -Math.PI * 0.275]),
    );
  });
  return g;
}

function buildMascot() {
  const root = new THREE.Group();
  const body = new THREE.Group(); // everything that bobs and breathes
  root.add(body);

  const skin = soft(C.mint);
  const accent = soft(C.purple);

  body.add(mesh(new THREE.SphereGeometry(1, 36, 26), skin, [0, 1.28, 0], [0, 0, 0], [1.12, 0.96, 0.86]));
  // the speech-bubble tail
  body.add(mesh(new THREE.ConeGeometry(0.24, 0.5, 20), skin, [-0.66, 0.48, 0.2], [0, 0, 2.4]));
  // three "typing" dots
  [-0.2, 0, 0.2].forEach((x) => body.add(mesh(new THREE.SphereGeometry(0.075, 10, 8), metal(C.gold), [x, 1.86, 0.66])));

  // two faces, swapped by mood: open eyes + smile, or happy "^ ^" + open mouth
  const calm = new THREE.Group();
  calm.add(eye(0.12, [-0.34, 1.4, 0.8]));
  calm.add(eye(0.12, [0.34, 1.4, 0.8]));
  calm.add(mesh(new THREE.TorusGeometry(0.15, 0.035, 8, 20, Math.PI), glossy(C.ink), [0, 1.15, 0.85], [0, 0, Math.PI]));
  const happy = new THREE.Group();
  happy.add(happyEye([-0.34, 1.42, 0.83]));
  happy.add(happyEye([0.34, 1.42, 0.83]));
  happy.add(mesh(new THREE.SphereGeometry(0.13, 16, 12), glossy(0x4a1f3a), [0, 1.08, 0.83], [0, 0, 0], [1.1, 0.9, 0.35]));
  happy.visible = false;
  body.add(calm, happy);

  const cheek = soft(C.blush, { roughness: 0.6 });
  body.add(mesh(new THREE.SphereGeometry(0.12, 14, 10), cheek, [-0.66, 1.16, 0.66], [0, -0.5, 0], [1, 0.62, 0.3]));
  body.add(mesh(new THREE.SphereGeometry(0.12, 14, 10), cheek, [0.66, 1.16, 0.66], [0, 0.5, 0], [1, 0.62, 0.3]));

  // left arm waves; right arm holds the megaphone
  const leftArm = arm(skin, [-1.12, 1.12, 0.05], -0.5);
  body.add(leftArm);
  const rightArm = arm(skin, [1.02, 1.1, 0.05], 0.75);
  body.add(rightArm);
  const mp = megaphone(accent);
  mp.position.set(1.47, 1.06, 0.05);
  mp.rotation.set(0, 0, -0.55);
  body.add(mp);
  const waves = soundWaves();
  waves.position.set(1.72, 1.42, 0.05);
  waves.rotation.z = 0.6;
  waves.scale.setScalar(0.8);
  waves.visible = false;
  body.add(waves);

  // feet stay on the floor while the body bobs
  root.add(mesh(new THREE.SphereGeometry(0.2, 16, 10), accent, [-0.34, 0.15, 0.1], [0, 0, 0], [1, 0.6, 1.25]));
  root.add(mesh(new THREE.SphereGeometry(0.2, 16, 10), accent, [0.34, 0.15, 0.1], [0, 0, 0], [1, 0.6, 1.25]));

  return { root, body, calm, happy, leftArm, waves };
}

export type MascotHandle = {
  /** A short happy wave — someone just acknowledged. */
  wave: () => void;
  /** Lively mode while the next job is close (≤ 30 min). */
  setExcited: (on: boolean) => void;
  /** Whether the loop is still running (false once frozen or static). */
  isAnimating: () => boolean;
  dispose: () => void;
};

const FRAME_MS = 1000 / 30;
const SLOW_MS = 60;
const SLOW_FRAMES = 90;

/**
 * Mount the mascot into `canvas`. Throws if WebGL is unavailable, so the
 * caller can show the still image instead.
 */
export function mountMascot(
  canvas: HTMLCanvasElement,
  opts: { animate: boolean; onFreeze?: () => void },
): MascotHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd9b8ff, 1.3);
  rim.position.set(-5, 3, -4);
  scene.add(rim);

  const m = buildMascot();
  m.root.rotation.y = -0.3;
  scene.add(m.root);

  const resize = () => {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Frame the whole figure (about 3.6 wide with the megaphone, 2.6 tall)
    // so it fills the box whatever its ratio: tan(15°) for the 30° fov.
    const span = 2 * Math.tan((15 * Math.PI) / 180);
    const dist = Math.max(2.9 / span, 3.8 / (span * camera.aspect));
    camera.position.set(0.2, 1.45, dist);
    camera.lookAt(0.25, 1.15, 0);
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(() => {
    resize();
    if (!running) renderer.render(scene, camera);
  });
  ro.observe(canvas);

  let excited = false;
  let waveUntil = 0;
  let running = opts.animate;
  let raf = 0;
  let last = 0;
  let lastFrameAt = 0;
  let slow = 0;
  const start = performance.now();

  const pose = (now: number) => {
    const t = (now - start) / 1000;
    const waving = now < waveUntil;
    const hop = excited ? Math.abs(Math.sin(t * 3.2)) * 0.16 : 0;
    m.body.position.y = Math.sin(t * 1.6) * 0.035 + hop;
    m.body.scale.set(1, 1 + Math.sin(t * 1.6 + 1) * 0.012, 1);
    m.root.rotation.y = -0.3 + Math.sin(t * 0.5) * 0.06;
    m.leftArm.rotation.z = waving ? -2.3 + Math.sin(t * 12) * 0.35 : -0.5 + Math.sin(t * 1.6) * 0.04;
    m.calm.visible = !(waving || excited);
    m.happy.visible = waving || excited;
    m.waves.visible = excited && Math.sin(t * 6) > -0.2;
  };

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (now - last < FRAME_MS - 2) return;
    // Judge the device by how often frames actually arrive, after the cap.
    if (lastFrameAt) {
      const dt = now - lastFrameAt;
      slow = dt > SLOW_MS ? slow + 1 : Math.max(0, slow - 2);
    }
    lastFrameAt = now;
    last = now;
    pose(now);
    renderer.render(scene, camera);
    if (slow >= SLOW_FRAMES) {
      cancelAnimationFrame(raf);
      running = false;
      opts.onFreeze?.();
    }
  };

  const onVisibility = () => {
    if (!running) return;
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else {
      // Don't count the time spent hidden as one slow frame.
      lastFrameAt = 0;
      last = 0;
      raf = requestAnimationFrame(loop);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  pose(start);
  renderer.render(scene, camera);
  if (running) raf = requestAnimationFrame(loop);

  return {
    wave: () => {
      waveUntil = performance.now() + 1600;
      if (!running) {
        // Still frame: show the happy face once rather than animate.
        pose(performance.now());
        renderer.render(scene, camera);
      }
    },
    setExcited: (on: boolean) => {
      if (excited === on) return;
      excited = on;
      if (!running) {
        pose(performance.now());
        renderer.render(scene, camera);
      }
    },
    isAnimating: () => running,
    dispose: () => {
      cancelAnimationFrame(raf);
      running = false;
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((mat) => mat.dispose());
        }
      });
      envRT.dispose();
      renderer.dispose();
    },
  };
}
