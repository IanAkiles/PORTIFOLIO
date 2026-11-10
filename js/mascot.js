import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/* Mascote do portfólio: cabeça que gira para o cursor, pupilas que seguem
   o mouse e dois braços flutuando. Paleta verde do site (#23ea57). */

const HEAD_GLB = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261018_172206_0181329a-86e2-41c9-8ab8-c496f29aaa53.glb";
const ARM_GLB = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261018_172137_cd6086ec-07ef-44dc-bd15-95a450ddaa8c.glb";

const BG = 0x0a0f0c;
const GREEN = 0x3dff7a;
const FOV = 28;
const LOAD_TIMEOUT = 30000;

const section = document.getElementById("mascote");
const canvas = document.getElementById("mascot-stage");
const loaderEl = document.getElementById("mascot-loader");
const copy = section && section.querySelector(".mascot-copy");

if (!section || !canvas || !copy) throw new Error("mascote: marcação ausente");

const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const clamp = THREE.MathUtils.clamp;

/* ------------------------------------------------------------------ */
/* renderer, cena, câmera                                              */
/* ------------------------------------------------------------------ */

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);

const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);

function radialTexture(stops, size = 256) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([offset, color]) => g.addColorStop(offset, color));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const glowTex = radialTexture([
  [0, "rgba(140,255,175,1)"],
  [0.25, "rgba(35,234,87,.55)"],
  [0.6, "rgba(20,160,60,.12)"],
  [1, "rgba(10,100,40,0)"]
]);

/* estúdio escuro com softboxes redondas (sem luzes pontuais) */
function buildEnvironment() {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x030305);
  const geometry = new THREE.SphereGeometry(0.5, 32, 16);
  const softbox = (hex, intensity, w, h, x, y, z) => {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(intensity) })
    );
    mesh.scale.set(w, h, 0.3);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    env.add(mesh);
  };
  softbox(0xffffff, 3.2, 5, 3.2, -3, 4.5, 4);
  softbox(0xffffff, 1.1, 1.2, 6, 6, 0.5, 2);
  softbox(0xffffff, 0.8, 3, 1, 1.5, 5, -1);
  softbox(0x23ea57, 1.0, 4, 5, -5, 0, -4);
  softbox(0x23ea57, 1.0, 4, 5, 5, 0, -4);
  softbox(0x12b84a, 0.35, 6, 3, 0, -5, 1);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return texture;
}

scene.environment = buildEnvironment();
scene.environmentIntensity = 1.0;

scene.add(new THREE.HemisphereLight(0xdcf0e2, 0x0f2a18, 2.3));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.55);
keyLight.position.set(-3, 4, 5);
scene.add(keyLight);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.4, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* borda de luz (fresnel) */
function rimMaterial(color, power, strength) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: power },
      uStrength: { value: strength }
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uStrength;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), uPower);
        gl_FragColor = vec4(uColor * f * uStrength, f);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
}

function addRim(mesh, rim) {
  const shell = new THREE.Mesh(mesh.geometry, rimMaterial(rim.color, rim.power, rim.strength));
  shell.renderOrder = 2;
  shell.userData.shell = true;
  mesh.add(shell);
}

/* ------------------------------------------------------------------ */
/* preparo dos modelos                                                 */
/* ------------------------------------------------------------------ */

function collectMeshes(root) {
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && !o.userData.shell) meshes.push(o);
  });
  return meshes;
}

function prepareModel(root, { glossy, rim, tint, useMap, smooth }) {
  const meshes = collectMeshes(root);
  meshes.forEach((mesh) => {
    if (smooth) {
      let g = mesh.geometry.clone();
      ["normal", "uv", "uv1", "tangent", "color"].forEach((name) => g.deleteAttribute(name));
      g = mergeVertices(g, 1e-3);
      g.computeVertexNormals();
      mesh.geometry = g;
    }

    const previous = mesh.material;
    mesh.material = new THREE.MeshPhysicalMaterial(
      glossy
        ? {
            map: useMap && previous ? previous.map : null,
            color: new THREE.Color(tint),
            metalness: 0.1,
            roughness: 0.3,
            clearcoat: 1.0,
            clearcoatRoughness: 0.16,
            envMapIntensity: 0.9
          }
        : {
            map: useMap && previous ? previous.map : null,
            color: new THREE.Color(tint),
            metalness: 0,
            roughness: 0.48,
            clearcoat: 0.3,
            clearcoatRoughness: 0.4,
            envMapIntensity: 0.55
          }
    );

    if (rim) addRim(mesh, rim);
  });
  return root;
}

function hasMesh(root) {
  return collectMeshes(root).length > 0;
}

/* a esfera da cabeça passa a ter centro na origem e profundidade 2 */
function normaliseHead(root) {
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  root.scale.multiplyScalar(2 / (size.z || 2));
  root.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(root);
  const centre = box.getCenter(new THREE.Vector3());
  root.position.x -= centre.x;
  root.position.y -= box.min.y + 1;
  root.position.z -= centre.z;
  const holder = new THREE.Group();
  holder.add(root);
  holder.updateMatrixWorld(true);
  return holder;
}

function normaliseArm(root) {
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  root.scale.multiplyScalar(0.78 / (size.y || 0.78));
  root.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(root);
  const centre = box.getCenter(new THREE.Vector3());
  root.position.sub(centre);
  const holder = new THREE.Group();
  holder.add(root);
  return holder;
}

/* modelos de reserva, caso um GLB não carregue */
function fallbackHead() {
  const group = new THREE.Group();
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x2c2c35,
    roughness: 0.26,
    metalness: 0.1,
    clearcoat: 1
  });
  const rim = { color: 0x3dff7a, power: 4.5, strength: 0.32 };

  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), material);
  group.add(sphere);

  [-1, 1].forEach((side) => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 32), material);
    cap.rotation.z = Math.PI / 2;
    cap.position.set(side * 1.0, 0, 0);
    group.add(cap);

    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 16), material);
    rod.position.set(side * 0.46, 1.08, 0);
    rod.rotation.z = -side * 0.25;
    group.add(rod);
  });

  group.updateMatrixWorld(true);
  collectMeshes(group).forEach((mesh) => addRim(mesh, rim));
  return group;
}

function fallbackArm() {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.42, 8, 24),
    new THREE.MeshPhysicalMaterial({ color: 0x1b1b21, roughness: 0.4, clearcoat: 0.4 })
  );
  addRim(mesh, { color: 0x3dff7a, power: 2.6, strength: 1.05 });
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

/* ------------------------------------------------------------------ */
/* visor, olhos e bolas das antenas                                    */
/* ------------------------------------------------------------------ */

function roundedRectShape(w, h, r) {
  const x = -w / 2;
  const y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/* divide cada triângulo em quatro (pontos médios) */
function subdivide(positions) {
  const out = [];
  for (let i = 0; i < positions.length; i += 9) {
    const a = [positions[i], positions[i + 1], positions[i + 2]];
    const b = [positions[i + 3], positions[i + 4], positions[i + 5]];
    const c = [positions[i + 6], positions[i + 7], positions[i + 8]];
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
    const ab = mid(a, b);
    const bc = mid(b, c);
    const ca = mid(c, a);
    out.push(...a, ...ab, ...ca, ...ab, ...b, ...bc, ...ca, ...bc, ...c, ...ab, ...bc, ...ca);
  }
  return out;
}

/* retângulo arredondado "enrolado" na esfera da cabeça */
function visorGeometry(w, h, corner, centreY, radius) {
  let geometry = new THREE.ShapeGeometry(roundedRectShape(w, h, corner), 48).toNonIndexed();
  let positions = Array.from(geometry.getAttribute("position").array);
  for (let round = 0; round < 3; round += 1) positions = subdivide(positions);

  const count = positions.length / 3;
  const wrapped = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i += 1) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1] + centreY;
    const z = Math.sqrt(Math.max(radius * radius - x * x - y * y, 0));
    v.set(x, y, z);
    wrapped[i * 3] = x;
    wrapped[i * 3 + 1] = y;
    wrapped[i * 3 + 2] = z;
    v.normalize();
    normals[i * 3] = v.x;
    normals[i * 3 + 1] = v.y;
    normals[i * 3 + 2] = v.z;
  }

  geometry.dispose();
  geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(wrapped, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  return geometry;
}

const eyes = [];
const antennaGlows = [];

function addEye(head, side, R) {
  const x = side * 0.43;
  const y = -0.08;
  const z = Math.sqrt(Math.max((R * 1.055) ** 2 - x * x - y * y, 0));

  const eye = new THREE.Group();
  eye.position.set(x, y, z);
  eye.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), eye.position.clone().normalize());

  const flat = { toneMapped: false, depthWrite: false, depthTest: false };

  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 48),
    new THREE.MeshBasicMaterial({
      ...flat,
      map: glowTex,
      color: GREEN,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending
    })
  );
  halo.position.z = -0.004;
  halo.renderOrder = 9;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.168, 0.212, 64),
    new THREE.MeshBasicMaterial({ ...flat, color: new THREE.Color(0.75, 2.0, 0.95) })
  );
  ring.renderOrder = 10;

  const iris = new THREE.Mesh(
    new THREE.CircleGeometry(0.17, 48),
    new THREE.MeshBasicMaterial({
      ...flat,
      map: radialTexture([
        [0, "#d2ffe0"],
        [0.45, "#6dffa0"],
        [0.8, "#23c957"],
        [1, "#12963c"]
      ]),
      color: new THREE.Color(0.95, 1.15, 1.0)
    })
  );
  iris.position.z = 0.001;
  iris.renderOrder = 10;

  const pupilWrap = new THREE.Group();
  const pupil = new THREE.Mesh(
    new THREE.CircleGeometry(0.083, 32),
    new THREE.MeshBasicMaterial({ ...flat, color: 0x030a05 })
  );
  pupil.position.z = 0.003;
  pupil.renderOrder = 11;
  const glint = new THREE.Mesh(
    new THREE.CircleGeometry(0.022, 16),
    new THREE.MeshBasicMaterial({ ...flat, color: 0xffffff })
  );
  glint.position.set(0.032, 0.034, 0.005);
  glint.renderOrder = 12;
  pupilWrap.add(pupil, glint);

  eye.add(halo, ring, iris, pupilWrap);
  head.add(eye);
  eyes.push({ group: eye, pupilWrap });
}

function addVisor(head, R) {
  const bezel = new THREE.Mesh(
    visorGeometry(1.86, 1.12, 0.46, -0.07, R * 1.03),
    new THREE.MeshPhysicalMaterial({
      color: 0x0c0c10,
      roughness: 0.3,
      metalness: 0.3,
      clearcoat: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6
    })
  );
  bezel.renderOrder = 3;

  const glass = new THREE.Mesh(
    visorGeometry(1.74, 1.0, 0.4, -0.07, R * 1.036),
    new THREE.MeshPhysicalMaterial({
      color: 0x000000,
      roughness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      envMapIntensity: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -8,
      polygonOffsetUnits: -8
    })
  );
  glass.renderOrder = 4;
  head.add(bezel, glass);
}

function addAntennaBalls(head, model) {
  const toHead = new THREE.Matrix4().copy(head.matrixWorld).invert();
  const points = [];
  const v = new THREE.Vector3();
  collectMeshes(model).forEach((mesh) => {
    const position = mesh.geometry.getAttribute("position");
    const matrix = new THREE.Matrix4().multiplyMatrices(toHead, mesh.matrixWorld);
    for (let i = 0; i < position.count; i += 1) {
      v.fromBufferAttribute(position, i).applyMatrix4(matrix);
      if (v.y > 0.75 && Math.abs(v.x) > 0.15) points.push(v.clone());
    }
  });

  [-1, 1].forEach((side) => {
    const side_points = points.filter((p) => Math.sign(p.x) === side);
    if (!side_points.length) return;

    const top = side_points.reduce((best, p) => (p.y > best.y ? p : best), side_points[0]);
    const near = side_points.filter((p) => p.distanceTo(top) < 0.2);
    const centre = near
      .reduce((sum, p) => sum.add(p), new THREE.Vector3())
      .multiplyScalar(1 / near.length);
    centre.y = Math.max(centre.y, top.y - 0.1);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.118, 32, 24),
      new THREE.MeshPhysicalMaterial({
        color: 0x3dff7a,
        emissive: 0x1fcf55,
        emissiveIntensity: 1.5,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.14
      })
    );
    ball.position.copy(centre);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0x4dff8a,
        opacity: 0.85,
        transparent: true,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        depthWrite: false
      })
    );
    glow.scale.setScalar(0.5);
    glow.position.copy(centre);

    head.add(ball, glow);
    antennaGlows.push(glow);
  });
}

/* normais perfeitas na parte esférica, para reflexos lisos */
function smoothSphereNormals(head, model, R) {
  const toHead = new THREE.Matrix4().copy(head.matrixWorld).invert();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  collectMeshes(model).forEach((mesh) => {
    const geometry = mesh.geometry.clone();
    if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();

    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const matrix = new THREE.Matrix4().multiplyMatrices(toHead, mesh.matrixWorld);
    const toLocal = new THREE.Matrix3().getNormalMatrix(matrix).invert();

    for (let i = 0; i < position.count; i += 1) {
      v.fromBufferAttribute(position, i).applyMatrix4(matrix);
      if (Math.abs(v.length() - R) <= R * 0.07) {
        n.copy(v).normalize().applyMatrix3(toLocal).normalize();
        normal.setXYZ(i, n.x, n.y, n.z);
      }
    }
    normal.needsUpdate = true;

    mesh.geometry = geometry;
    mesh.children.forEach((child) => {
      if (child.userData.shell) child.geometry = geometry;
    });
  });
}

function mountHead(head, model) {
  head.updateMatrixWorld(true);

  const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
  const hits = raycaster.intersectObject(model, true);
  const R = clamp(hits.length ? hits[0].point.length() : 1, 0.85, 1.1);

  smoothSphereNormals(head, model, R);
  addVisor(head, R);
  addEye(head, -1, R);
  addEye(head, 1, R);
  addAntennaBalls(head, model);
}

/* ------------------------------------------------------------------ */
/* rig: robot > body > head                                            */
/* ------------------------------------------------------------------ */

const robot = new THREE.Group();
const body = new THREE.Group();
const head = new THREE.Group();
robot.add(body);
body.add(head);
scene.add(robot);

const arms = [];

const haze = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: glowTex,
    color: 0x2eff6a,
    opacity: 0.06,
    transparent: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    depthWrite: false
  })
);
haze.scale.setScalar(7.5);
haze.position.set(0, 0.1, -3);
scene.add(haze);

const floorGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({
    map: glowTex,
    color: GREEN,
    opacity: 0.95,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
floorGlow.position.set(0, -2.05, -0.6);
floorGlow.scale.set(3.4, 0.42, 1);
scene.add(floorGlow);

function addArm(model, restX, restRz, phase) {
  model.position.set(restX, -0.72, 0.15);
  model.rotation.z = restRz;
  body.add(model);
  arms.push({ model, restX, restY: -0.72, restRz, phase, sign: Math.sign(restX) });
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("tempo esgotado")), ms))
  ]);
}

async function loadModels() {
  const loader = new GLTFLoader();
  const [headResult, armResult] = await Promise.allSettled([
    withTimeout(loader.loadAsync(HEAD_GLB), LOAD_TIMEOUT),
    withTimeout(loader.loadAsync(ARM_GLB), LOAD_TIMEOUT)
  ]);

  let headModel = null;
  if (headResult.status === "fulfilled" && hasMesh(headResult.value.scene)) {
    headModel = normaliseHead(
      prepareModel(headResult.value.scene, {
        glossy: true,
        useMap: false,
        smooth: false,
        tint: "#4a4a56",
        rim: { color: 0x3dff7a, power: 4.5, strength: 0.32 }
      })
    );
  } else {
    console.warn("[mascot] cabeça em modelo de reserva", headResult.reason || "");
    headModel = fallbackHead();
    headModel.updateMatrixWorld(true);
  }

  let armTemplate = null;
  if (armResult.status === "fulfilled" && hasMesh(armResult.value.scene)) {
    armTemplate = prepareModel(armResult.value.scene, {
      glossy: false,
      useMap: false,
      smooth: true,
      tint: "#1d1d23",
      rim: { color: 0x3dff7a, power: 2.6, strength: 1.05 }
    });
  } else {
    console.warn("[mascot] braços em modelo de reserva", armResult.reason || "");
  }

  const armModels = armTemplate
    ? [armTemplate, armTemplate.clone(true)].map(normaliseArm)
    : [fallbackArm(), fallbackArm()];

  head.add(headModel);
  addArm(armModels[0], -1.32, -0.62, 0);
  addArm(armModels[1], 1.32, 0.62, Math.PI * 0.85);

  robot.updateMatrixWorld(true);
  mountHead(head, headModel);
}

/* ------------------------------------------------------------------ */
/* layout                                                              */
/* ------------------------------------------------------------------ */

let W = 1;
let H = 1;
let isMobile = false;
const anchor = { x: 0, y: 0 };

function layout() {
  W = Math.max(1, section.clientWidth);
  H = Math.max(1, section.clientHeight);
  isMobile = W <= 860;

  renderer.setSize(W, H, false);
  composer.setSize(W, H);
  bloom.setSize(W, H);

  let robotPx;
  if (isMobile) {
    const copyTop = copy.getBoundingClientRect().top - section.getBoundingClientRect().top;
    const room = Math.max(copyTop - 24, 220);
    robotPx = Math.min(room * 0.92, W * 0.82);
    anchor.x = W / 2;
    anchor.y = 24 + room * 0.5;
  } else {
    robotPx = Math.min(H * 0.62, W * 0.4, 640);
    anchor.x = W * 0.695;
    anchor.y = H * 0.5 + 8;
  }

  camera.aspect = W / H;
  camera.position.z = (3.4 * H) / (robotPx * 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
  camera.setViewOffset(W, H, W / 2 - anchor.x, H / 2 - anchor.y, W, H);
  camera.updateProjectionMatrix();

  if (loaderEl) {
    loaderEl.style.left = `${anchor.x}px`;
    loaderEl.style.top = `${anchor.y}px`;
  }
}

/* ------------------------------------------------------------------ */
/* interação                                                           */
/* ------------------------------------------------------------------ */

const target = { x: 0, y: 0 };
const look = { x: 0, y: 0 };
let t = 0;
let lastMoveAt = -100;

function aim(clientX, clientY) {
  const rect = section.getBoundingClientRect();
  const rx = isMobile ? W * 0.5 : Math.max(W * 0.55, 500);
  const ry = isMobile ? H * 0.5 : Math.max(H * 0.55, 400);
  target.x = clamp((clientX - (rect.left + anchor.x)) / rx, -1.2, 1.2);
  target.y = clamp((clientY - (rect.top + anchor.y)) / ry, -1.2, 1.2);
  lastMoveAt = t;
}

window.addEventListener("pointermove", (e) => aim(e.clientX, e.clientY), { passive: true });
window.addEventListener("pointerdown", (e) => aim(e.clientX, e.clientY), { passive: true });
window.addEventListener(
  "touchmove",
  (e) => {
    const touch = e.touches[0];
    if (touch) aim(touch.clientX, touch.clientY);
  },
  { passive: true }
);

/* ------------------------------------------------------------------ */
/* animação                                                            */
/* ------------------------------------------------------------------ */

let intro = 0;
let loaded = false;
let visible = false;
let rafId = 0;
let lastTime = 0;
let nextBlink = 3;
let blinkStart = -1;

function update(dt) {
  t += dt;
  const m = reduceQuery.matches ? 0.25 : 1;

  if (t - lastMoveAt > 3.5) {
    target.x = Math.sin(t * 0.45) * 0.45;
    target.y = Math.sin(t * 0.31 + 1.2) * 0.2;
  }

  const smooth = 1 - Math.pow(0.0025, dt);
  look.x += (target.x - look.x) * smooth;
  look.y += (target.y - look.y) * smooth;

  intro = Math.min(1, intro + dt * 1.4);
  const k = intro;
  const pop = 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);
  robot.scale.setScalar(Math.max(pop, 0.001));

  const bob = Math.sin(t * 1.6) * 0.09 * m;
  robot.position.y = bob;

  head.rotation.set(
    look.y * 0.42,
    look.x * 0.5,
    -look.x * 0.06 + Math.sin(t * 1.1) * 0.015 * m
  );
  body.rotation.set(look.y * 0.12, look.x * 0.28, 0);

  arms.forEach((arm) => {
    const w = Math.sin(t * 2.0 + arm.phase);
    arm.model.position.y = arm.restY + w * 0.13 * m - bob * 0.35;
    arm.model.position.x = arm.restX + arm.sign * look.x * -0.04;
    arm.model.rotation.z = arm.restRz + w * 0.12 * arm.sign * m;
    arm.model.rotation.x = Math.sin(t * 1.3 + arm.phase) * 0.08 * m;
  });

  const px = clamp(look.x * 0.075, -0.07, 0.07);
  const py = clamp(-look.y * 0.06, -0.06, 0.06);

  let blinkScale = 1;
  if (blinkStart < 0 && t >= nextBlink) blinkStart = t;
  if (blinkStart >= 0) {
    const p = (t - blinkStart) / 0.32;
    if (p >= 1) {
      blinkStart = -1;
      nextBlink = t + 2.5 + Math.random() * 3.5;
    } else {
      blinkScale = 1 - 0.92 * Math.sin(Math.PI * p);
    }
  }

  eyes.forEach((eye) => {
    eye.pupilWrap.position.set(px, py, 0);
    eye.group.scale.y = blinkScale;
  });

  floorGlow.scale.set(3.4 - bob * 3, 0.42 - bob * 0.4, 1);
  floorGlow.material.opacity = clamp(0.7 + (0.09 - bob) * 1.5, 0, 1);

  const antennaOpacity = 0.7 * (0.85 + Math.sin(t * 1.6) * 0.15) + 0.15;
  antennaGlows.forEach((glow) => {
    glow.material.opacity = antennaOpacity;
  });
}

function frame(now) {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  update(dt);
  composer.render();
}

function sync() {
  const shouldRun = loaded && visible && !document.hidden;
  if (shouldRun && !rafId) {
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  } else if (!shouldRun && rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

new IntersectionObserver(
  (entries) => {
    visible = entries[0] ? entries[0].isIntersecting : true;
    sync();
  },
  { threshold: 0 }
).observe(section);

document.addEventListener("visibilitychange", sync);

if ("ResizeObserver" in window) {
  new ResizeObserver(layout).observe(section);
} else {
  window.addEventListener("resize", layout);
}

layout();

await loadModels();

layout();
robot.scale.setScalar(0.001);
if (loaderEl) loaderEl.classList.add("hide");
loaded = true;
sync();
