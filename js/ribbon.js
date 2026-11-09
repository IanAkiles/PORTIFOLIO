let THREE;

(() => {
  "use strict";

  const section = document.getElementById("projetos");
  const stage = document.getElementById("ribbon-stage");
  const canvas = document.getElementById("ribbon-canvas");
  const prevBtn = document.getElementById("ribbon-prev");
  const nextBtn = document.getElementById("ribbon-next");
  const list = document.getElementById("ribbon-list");
  const positionEl = document.getElementById("ribbon-position");
  const totalEl = document.getElementById("ribbon-total");

  const projects =
    typeof PROJECTS !== "undefined" && Array.isArray(PROJECTS)
      ? PROJECTS
      : Array.isArray(window.PROJECTS)
        ? window.PROJECTS
        : [];

  if (!section || !stage || !canvas || !projects.length) return;

  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reduce = () => reduceQuery.matches;

  const FOV = 53.4;
  const CAM_Z = 41.18;
  const TAN = Math.tan((FOV * Math.PI) / 360);
  const TAU = Math.PI * 2;
  const PI = Math.PI;
  const BANK = -0.16;
  const REAR_Y = 0.1;
  const REAR_Z = 0.2;
  const VTWIST = 1.8;
  const TAIL = 1.0;
  const SHIFT = -0.2;

  let renderer;
  let scene;
  let camera;
  let mirrorCamera;
  let reflectionTarget;
  let floor;
  let floorMaterial;
  let cards = [];
  let disposed = false;
  let initialized = false;

  let vw = 0;
  let vh = 0;
  let U = 1;
  let H = 1;
  let W = 1;
  let k = 1;
  let loopLength = 0;
  let loopLeft = 0;
  let loopTop = 0;
  let isPhone = false;

  let current = 0;
  let target = 0;
  let pending = 0;
  let centredIndex = 0;
  let hovered = -1;
  let readyAt = 0;
  let active = false;
  let rafId = 0;
  const desktop = window.matchMedia("(min-width: 821px) and (prefers-reduced-motion: no-preference)");
  let lastFrame = 0;
  let lastPosition = "";
  let depth = 0;
  let wrung = 0;
  let frames = 0;

  let lastWheelAt = 0;
  let burstAt = 0;

  const pointer = { x: -1, y: -1, inside: false };
  let drag = null;
  let dragMoved = false;

  const pad = (value) => String(value).padStart(2, "0");
  const mod = (value, length) => ((value % length) + length) % length;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const smoothstep = (edge0, edge1, x) => {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const ramp = (value) => {
    const s = clamp(value, -1, 1);
    return s * (1.5 - 0.5 * s * s);
  };
  const leanSlope = (value) => {
    const s = clamp(value, -1, 1);
    return 1.5 * (1 - s * s);
  };
  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  function shapeCurve(q, c) {
    const bowl = 1 - q * q;
    const ess = Math.sin(PI * q);
    return (bowl + (ess - bowl) * c) * Math.exp(-TAIL * q * q);
  }

  function shapeSlope(q, c) {
    const bowl = -2 * q * (1 + TAIL * (1 - q * q));
    const ess = PI * Math.cos(PI * q) - 2 * TAIL * q * Math.sin(PI * q);
    return (bowl + (ess - bowl) * c) * Math.exp(-q * q);
  }

  function fail() {
    section.classList.remove("is-loading");
    section.classList.remove("ribbon-ready");
    stage.hidden = true;
    disposed = true;
  }

  /* ------------------------------------------------------------------ */
  /* shaders                                                             */
  /* ------------------------------------------------------------------ */

  const cardVertex = /* glsl */ `
    uniform float u_sheetW;
    uniform float u_sheetD;
    uniform float u_sheetT;
    uniform float u_sheetC;
    uniform float u_sheetV;
    uniform float u_leanA;
    uniform float u_leanW;
    uniform float u_diag;
    uniform float u_axis;
    uniform float u_dent;
    uniform float u_hover;
    uniform vec2 u_res;

    varying vec2 vUv;
    varying vec3 vWorld;
    varying float vRibbonZ;
    varying float vHoverDome;

    const float PI = 3.141592653589793;
    const float BANK = -0.16;
    const float REAR_Y = 0.1;
    const float REAR_Z = 0.2;
    const float VTWIST = 1.8;
    const float TAIL = 1.0;
    const float SHIFT = -0.2;

    float shapeCurve(float q) {
      float bowl = 1.0 - q * q;
      float ess = sin(PI * q);
      return mix(bowl, ess, u_sheetC) * exp(-TAIL * q * q);
    }

    float shapeSlope(float q) {
      float bowl = -2.0 * q * (1.0 + TAIL * (1.0 - q * q));
      float ess = PI * cos(PI * q) - 2.0 * TAIL * q * sin(PI * q);
      return mix(bowl, ess, u_sheetC) * exp(-q * q);
    }

    float ramp(float s) {
      s = clamp(s, -1.0, 1.0);
      return s * (1.5 - 0.5 * s * s);
    }

    void main() {
      vUv = uv;

      vec3 pos = position;
      float qx = 2.0 * uv.x - 1.0;
      float qy = 2.0 * uv.y - 1.0;
      float dome = (1.0 - qx * qx) * (1.0 - qy * qy);
      float dent = u_hover * u_dent * u_res.y * dome;
      pos.z -= dent;
      vHoverDome = dent;

      vec4 world = modelMatrix * vec4(pos, 1.0);
      vec3 w = world.xyz;

      if (u_axis > 0.5) {
        float swap = w.x;
        w.x = w.y;
        w.y = swap;
      }

      float along = w.x;
      float q = along / u_sheetW * u_sheetT + SHIFT;

      float roll = BANK * shapeSlope(q) / PI * u_sheetC;
      if (u_sheetV > 0.0) {
        roll += VTWIST * u_sheetV * smoothstep(0.3, 0.9, abs(along / u_sheetW)) * sign(along / u_sheetW);
      }

      float c = cos(roll);
      float s = sin(roll);
      float curvedY = w.y * c - w.z * s;
      float curvedZ = w.y * s + w.z * c;

      float shape = shapeCurve(q);
      curvedZ += -u_sheetD * shape;

      curvedY += u_diag * along;

      if (u_sheetV > 0.0) {
        float m = 1.0 - smoothstep(-1.0, 0.3, along / u_sheetW);
        curvedY += REAR_Y * u_sheetW * u_sheetV * m;
        curvedZ += REAR_Z * u_sheetW * u_sheetV * m;
      }

      if (u_leanA != 0.0) {
        curvedZ += u_leanA * ramp(along / u_leanW);
      }

      w.y = curvedY;
      w.z = curvedZ;

      if (u_axis > 0.5) {
        float swapBack = w.x;
        w.x = w.y;
        w.y = swapBack;
      }

      vRibbonZ = -u_sheetD * shape;
      vWorld = w;
      gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
    }
  `;

  const cardFragment = /* glsl */ `
    uniform sampler2D u_media;
    uniform sampler2D u_overlay;
    uniform vec4 u_crop;
    uniform float u_aspect;
    uniform float u_corner;
    uniform float u_alpha;
    uniform float u_shade;
    uniform float u_shadeS;
    uniform float u_D;
    uniform float u_sheetW;
    uniform float u_sheetT;
    uniform float u_sheetC;
    uniform float u_sheetV;
    uniform float u_leanA;
    uniform float u_leanW;
    uniform float u_axis;
    uniform float u_hover;
    uniform float u_dent;
    uniform vec2 u_res;

    varying vec2 vUv;
    varying vec3 vWorld;
    varying float vRibbonZ;
    varying float vHoverDome;

    const float PI = 3.141592653589793;
    const float BANK = -0.16;
    const float VTWIST = 1.8;
    const float TAIL = 1.0;
    const float SHIFT = -0.2;

    float shapeSlope(float q) {
      float bowl = -2.0 * q * (1.0 + TAIL * (1.0 - q * q));
      float ess = PI * cos(PI * q) - 2.0 * TAIL * q * sin(PI * q);
      return mix(bowl, ess, u_sheetC) * exp(-q * q);
    }

    float leanSlope(float s) {
      s = clamp(s, -1.0, 1.0);
      return 1.5 * (1.0 - s * s);
    }

    void main() {
      vec2 mediaUv = u_crop.xy + vUv * u_crop.zw;
      vec4 media = texture2D(u_media, mediaUv);
      vec4 overlay = texture2D(u_overlay, vUv);
      vec3 rgb = mix(media.rgb, overlay.rgb, overlay.a);

      float shadeDepth = clamp((u_D - vRibbonZ) / (2.0 * max(u_D, 0.0001)), 0.0, 1.0);
      shadeDepth = clamp(shadeDepth + vHoverDome / max(2.0 * u_D, 0.0001), 0.0, 1.0);
      rgb = mix(rgb, vec3(0.059), clamp(u_shade * 0.8 * pow(shadeDepth, u_shadeS), 0.0, 1.0));

      float wx = mix(vWorld.x, vWorld.y, u_axis);
      float q = wx / u_sheetW * u_sheetT + SHIFT;
      float slope = shapeSlope(q);

      float dzdx = -u_D * slope * u_sheetT / u_sheetW;
      if (u_leanA != 0.0) {
        dzdx += (u_leanA / u_leanW) * leanSlope(wx / u_leanW);
      }

      float qx = 2.0 * vUv.x - 1.0;
      float qy = 2.0 * vUv.y - 1.0;
      float domeDx = u_hover * u_dent * u_res.y * (-4.0 * qx * (1.0 - qy * qy)) / max(u_res.x, 0.0001);
      dzdx += domeDx;

      float roll = BANK * slope / PI * u_sheetC;
      if (u_sheetV > 0.0) {
        roll += VTWIST * u_sheetV * smoothstep(0.3, 0.9, abs(wx / u_sheetW)) * sign(wx / u_sheetW);
      }

      vec3 n = normalize(vec3(-dzdx, -sin(roll), cos(roll)));
      if (u_axis > 0.5) n = normalize(vec3(-sin(roll), -dzdx, cos(roll)));
      vec3 viewDir = normalize(cameraPosition - vWorld);
      if (dot(n, viewDir) < 0.0) n = -n;

      vec3 lightDir = normalize(vec3(-0.4, 0.5, 1.0));
      float ndl = dot(n, lightDir) * 0.5 + 0.5;
      rgb *= 1.0 - 0.12 * (1.0 - ndl);

      vec3 halfVec = normalize(lightDir + viewDir);
      rgb += vec3(pow(max(dot(n, halfVec), 0.0), 48.0) * 0.35);

      vec2 p = (vUv - 0.5) * vec2(u_aspect, 1.0) * 2.0;
      vec2 halfSize = vec2(u_aspect, 1.0) - u_corner;
      vec2 d = abs(p) - halfSize;
      float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - u_corner;
      float edges = 1.0 - smoothstep(-fwidth(dist), fwidth(dist), dist);

      float alpha = edges * u_alpha;
      if (alpha < 0.004) discard;

      gl_FragColor = vec4(rgb, alpha);
    }
  `;

  const floorVertex = /* glsl */ `
    uniform float u_o;
    uniform float u_leanA;
    uniform float u_leanW;

    varying vec2 vUv;
    varying vec3 vWorld;
    varying float vFar;

    float ramp(float s) {
      s = clamp(s, -1.0, 1.0);
      return s * (1.5 - 0.5 * s * s);
    }

    void main() {
      vUv = uv;
      vec4 world = modelMatrix * vec4(position, 1.0);
      vec3 w = world.xyz;
      w.z += u_leanA * ramp(w.x / u_leanW);
      vFar = -w.z / u_o;
      vWorld = w;
      gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
    }
  `;

  const floorFragment = /* glsl */ `
    uniform sampler2D u_reflection;
    uniform float u_alpha;
    uniform float u_cellsX;
    uniform float u_cellsY;
    uniform float u_line;
    uniform float u_lightX;
    uniform mat4 u_mirrorVP;

    varying vec2 vUv;
    varying vec3 vWorld;
    varying float vFar;

    void main() {
      float fade = 1.0 - smoothstep(0.2, 0.95, vFar);
      vec3 tintA = vec3(0.0);
      vec3 tintB = vec3(0.0);
      vec3 col = mix(tintA, tintB, smoothstep(0.0, 0.8, vFar));
      col *= 1.0 - 0.55 * exp(-14.0 * abs(vFar));

      vec2 g = vec2(vUv.x * u_cellsX, vFar * u_cellsY);
      vec2 fw = max(fwidth(g) * 1.5, vec2(0.0001));
      vec2 lines = 1.0 - smoothstep(vec2(0.0), fw, abs(fract(g) - 0.5));
      float line = max(lines.x, lines.y);
      col += line * u_line * fade;

      vec3 wp = vWorld;
      wp.x -= (wp.x - u_lightX) * 0.35 * abs(vFar);
      vec4 clip = u_mirrorVP * vec4(wp, 1.0);
      vec2 ruv = clip.xy / max(clip.w, 0.0001) * 0.5 + 0.5;
      float weight = vFar > 0.0 ? exp(-6.0 * vFar) : exp(2.2 * vFar);
      float edges = smoothstep(0.0, 0.1, ruv.x)
        * smoothstep(0.0, 0.1, 1.0 - ruv.x)
        * smoothstep(0.0, 0.1, ruv.y)
        * smoothstep(0.0, 0.1, 1.0 - ruv.y);
      vec3 reflection = texture2D(u_reflection, clamp(ruv, 0.002, 0.998)).rgb;

      col += reflection * line * 0.5 * weight * edges * fade;

      gl_FragColor = vec4(col, u_alpha * fade);
    }
  `;

  /* ------------------------------------------------------------------ */
  /* boot                                                                */
  /* ------------------------------------------------------------------ */

  let loading = false;
  let nearby = !("IntersectionObserver" in window);
  const start = () => {
    if (loading || !nearby || !desktop.matches) return;
    loading = true;
    import("./three.module.min.js").then((module) => {
      THREE = module;
      return boot();
    }).catch((error) => {
      console.error("[ribbon]", error);
      fail();
    });
  };
  desktop.addEventListener("change", () => { start(); syncFrame(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      nearby = entry.isIntersecting;
      start();
    }, { rootMargin: "300px" }).observe(section);
  }
  start();

  function syncFrame() {
    if (initialized && !disposed && active && !document.hidden && desktop.matches) {
      if (!rafId) {
        lastFrame = 0;
        rafId = requestAnimationFrame(frame);
      }
    } else if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  async function boot() {
    section.classList.add("is-loading");
    stage.hidden = false;

    buildIndex();

    let gl = null;
    try {
      gl = canvas.getContext("webgl2", {
        alpha: false,
        antialias: true,
        depth: true,
        stencil: false,
        powerPreference: "high-performance"
      });
    } catch {
      gl = null;
    }

    if (!gl) {
      fail();
      return;
    }

    renderer = new THREE.WebGLRenderer({
      canvas,
      context: gl,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setClearColor(0x000000, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    try {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } catch {
      /* versões antigas usam outputEncoding */
    }

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 2000);
    camera.position.set(0, 0, CAM_Z);
    mirrorCamera = camera.clone();

    await Promise.race([
      document.fonts.load('400 18px "Inter Tight"'),
      new Promise((resolve) => setTimeout(resolve, 2500))
    ]).catch(() => {});

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const images = await Promise.all(projects.map((project) => loadImage(project.capa)));

    const geometry = new THREE.PlaneGeometry(1, 1, 96, 24);

    cards = projects.map((project, index) => {
      const image = images[index];
      const rawAspect = image && image.naturalWidth ? image.naturalWidth / image.naturalHeight : 1.6;
      const aspect = Number(project.aspecto) || clamp(rawAspect, 1.15, 1.85);

      const mediaTexture = image
        ? makeImageTexture(image, maxAniso)
        : makePlaceholderTexture(index);

      const material = new THREE.ShaderMaterial({
        vertexShader: cardVertex,
        fragmentShader: cardFragment,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        extensions: { derivatives: true },
        uniforms: {
          u_media: { value: mediaTexture },
          u_overlay: { value: null },
          u_crop: { value: new THREE.Vector4(0, 0, 1, 1) },
          u_aspect: { value: aspect },
          u_corner: { value: 0.05 },
          u_alpha: { value: 0 },
          u_shade: { value: 1 },
          u_shadeS: { value: 1 },
          u_D: { value: 1 },
          u_sheetW: { value: 1 },
          u_sheetD: { value: 1 },
          u_sheetT: { value: 1.15 },
          u_sheetC: { value: 1 },
          u_sheetP: { value: 1 },
          u_sheetV: { value: 0 },
          u_leanA: { value: 0 },
          u_leanW: { value: 1 },
          u_diag: { value: 0.03 },
          u_axis: { value: 0 },
          u_dent: { value: 0.035 },
          u_hover: { value: 0 },
          u_res: { value: new THREE.Vector2(1, 1) }
        }
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = 0;
      mesh.userData.index = index;
      scene.add(mesh);

      return {
        index,
        project,
        aspect,
        mediaAspect: rawAspect,
        mediaTexture,
        posterTexture: image ? mediaTexture : null,
        video: null,
        videoTexture: null,
        mesh,
        material,
        overlayCanvas: null,
        overlayTexture: null,
        cssW: 1,
        cssH: 1,
        base: 0,
        screen: { x: 0, y: 0, w: 0, h: 0 },
        hover: 0,
        hoverTarget: 0
      };
    });

    floorMaterial = new THREE.ShaderMaterial({
      vertexShader: floorVertex,
      fragmentShader: floorFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      extensions: { derivatives: true },
      uniforms: {
        u_reflection: { value: null },
        u_alpha: { value: 0 },
        u_cellsX: { value: 1 },
        u_cellsY: { value: 1 },
        u_line: { value: 0.08 },
        u_o: { value: 1 },
        u_leanA: { value: 0 },
        u_leanW: { value: 1 },
        u_lightX: { value: -1 },
        u_mirrorVP: { value: new THREE.Matrix4() }
      }
    });

    floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 48, 24), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.frustumCulled = false;
    floor.renderOrder = -1;
    floor.visible = false;
    scene.add(floor);

    resize();
    initialiseStart();
    renderer.setSize(vw, vh, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    section.classList.add("ribbon-ready");
    section.classList.remove("is-loading");
    readyAt = performance.now();

    bindEvents();
    observeStage();

    if (new URLSearchParams(location.search).has("debug")) {
      window.__ribbon = {
        scene,
        camera,
        floor,
        floorMaterial,
        cards,
        state: () => ({
          current,
          target,
          pending,
          centredIndex,
          vw,
          vh,
          H,
          W,
          k,
          isPhone,
          loopLength,
          loopLeft,
          loopTop,
          depth,
          wrung,
          active,
          frames
        })
      };
    }

    syncFrame();
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      if (!src) {
        resolve(null);
        return;
      }
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  function makeImageTexture(image, maxAniso) {
    const texture = new THREE.Texture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    texture.anisotropy = maxAniso;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  function makePlaceholderTexture(index) {
    const c = document.createElement("canvas");
    c.width = 8;
    c.height = 8;
    const ctx = c.getContext("2d");
    ctx.fillStyle = index % 2 ? "#16241b" : "#1d2f22";
    ctx.fillRect(0, 0, 8, 8);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  function createVideo(card) {
    if (card.video || reduce() || !card.project.video) return;

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.preload = "auto";
    video.src = card.project.video;
    card.video = video;

    let swapped = false;
    const swap = () => {
      if (swapped || !video.videoWidth || !video.videoHeight) return;
      swapped = true;

      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

      card.mediaAspect = video.videoWidth / video.videoHeight;
      card.mediaTexture = texture;
      card.videoTexture = texture;
      card.material.uniforms.u_media.value = texture;
      updateCrop(card);

      if (card.posterTexture && card.posterTexture !== texture) {
        card.posterTexture.dispose();
        card.posterTexture = null;
      }
    };

    if (typeof video.requestVideoFrameCallback === "function") {
      video.requestVideoFrameCallback(swap);
    } else {
      video.addEventListener("playing", swap, { once: true });
    }
  }

  function pauseVideos() {
    cards.forEach((card) => {
      if (card.video && !card.video.paused) card.video.pause();
    });
  }

  /* ------------------------------------------------------------------ */
  /* índice acessível                                                    */
  /* ------------------------------------------------------------------ */

  function buildIndex() {
    totalEl.textContent = pad(projects.length);

    list.innerHTML = projects
      .map(
        (project, index) =>
          `<li><button type="button" data-project="${index}">${escapeHtml(project.titulo)}<span>${escapeHtml(project.categoria || "")}</span></button></li>`
      )
      .join("");

    list.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-project]");
      if (button) openProject(Number(button.dataset.project));
    });

    list.addEventListener("focusin", (event) => {
      const button = event.target.closest("button[data-project]");
      if (button) focusCard(Number(button.dataset.project));
    });
  }

  /* ------------------------------------------------------------------ */
  /* layout                                                              */
  /* ------------------------------------------------------------------ */

  function startForMode() {
    return isPhone ? -0.177 * vh : 100;
  }

  function initialiseStart() {
    current = target = startForMode();
    pending = 0;
    initialized = true;
  }

  function resize() {
    vw = stage.clientWidth;
    vh = stage.clientHeight;
    const phone = vw <= 649;
    const modeChanged = phone !== isPhone;
    isPhone = phone;

    U = vw / (isPhone ? 390 : 1500);
    H = TAN * CAM_Z;
    W = H * (vw / vh);
    k = (2 * H) / vh;

    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
    mirrorCamera.aspect = camera.aspect;
    mirrorCamera.updateProjectionMatrix();

    const gap = (isPhone ? 20 : 10) * U;
    let base = 0;

    if (isPhone) {
      const cardW = vw - 40 * U;
      cards.forEach((card) => {
        card.cssW = cardW;
        card.cssH = cardW / card.aspect;
        card.base = base;
        base += card.cssH + gap;
      });
      loopLength = base;
      loopTop = -(loopLength - vh) / 2;
    } else {
      const cardH = Math.min(vh * 0.435, 550 * U);
      cards.forEach((card) => {
        card.cssH = cardH;
        card.cssW = cardH * card.aspect;
        card.base = base;
        base += card.cssW + gap;
      });
      loopLength = base;
      loopLeft = -(loopLength - vw) / 2;
    }

    const radius = (isPhone ? 15 : 20) * U;

    cards.forEach((card) => {
      card.mesh.scale.set(card.cssW * k, card.cssH * k, 1);
      card.mesh.position.set(0, 0, 0);

      const u = card.material.uniforms;
      u.u_sheetW.value = isPhone ? H : W;
      u.u_sheetT.value = isPhone ? 1 : 1.15;
      u.u_sheetC.value = isPhone ? 0 : 1;
      u.u_sheetP.value = 1;
      u.u_leanA.value = isPhone ? 0 : W * -0.12;
      u.u_leanW.value = isPhone ? 1 : W;
      u.u_diag.value = isPhone ? 0 : 0.03;
      u.u_axis.value = isPhone ? 1 : 0;
      u.u_shade.value = isPhone ? 0 : 1;
      u.u_shadeS.value = isPhone ? 0.6 : 1;
      u.u_aspect.value = card.cssW / card.cssH;
      u.u_corner.value = (2 * radius) / card.cssH;
      u.u_res.value.set(card.cssW * k, card.cssH * k);

      updateCrop(card);
      drawOverlay(card);
    });

    if (floor) buildFloor();

    if (!isPhone) {
      if (!reflectionTarget) makeReflectionTarget();
      else {
        reflectionTarget.setSize(
          Math.max(2, Math.floor(vw / 2)),
          Math.max(2, Math.floor(vh / 2))
        );
      }
    }

    if (!initialized || modeChanged) {
      current = target = startForMode();
      pending = 0;
    } else if (cards.length) {
      const raw = targetFor(centredIndex);
      target = raw - Math.round((raw - current) / (loopLength || 1)) * (loopLength || 1);
    }
  }

  function buildFloor() {
    if (!floor) return;

    floor.visible = !isPhone;
    if (isPhone) return;

    const cardH = cards.length ? cards[0].cssH : 0;
    const a = (-cardH * k) / 2 - 0.06 * H;
    const o = 6 * H;
    const near = Math.min(CAM_Z * (1 - Math.abs(a) / H) + 0.2 * H, CAM_Z * 0.8);

    floor.position.set(0, a, (near - o) / 2);
    floor.scale.set(W * 2 * 4, near + o, 1);

    const mirrorY = a - 0.07 * H;
    mirrorCamera.position.set(0, 2 * mirrorY, CAM_Z);
    mirrorCamera.rotation.set(0, 0, 0);

    const cell = 0.22 * H;
    const u = floorMaterial.uniforms;
    u.u_o.value = o;
    u.u_leanA.value = W * -0.12;
    u.u_leanW.value = W;
    u.u_cellsX.value = (W * 2 * 4) / cell;
    u.u_cellsY.value = o / cell;
    u.u_line.value = 0.08;
    u.u_lightX.value = W * -0.6;
    u.u_alpha.value = 0;
  }

  /* ------------------------------------------------------------------ */
  /* overlay (legenda + pill)                                            */
  /* ------------------------------------------------------------------ */

  function drawOverlay(card) {
    const cssW = Math.max(1, card.cssW);
    const cssH = Math.max(1, card.cssH);
    const s = (2 * Math.min(window.devicePixelRatio || 1, 2)) / 1.5;
    const pixelW = Math.max(2, Math.round(cssW * s));
    const pixelH = Math.max(2, Math.round(cssH * s));

    if (!card.overlayCanvas) card.overlayCanvas = document.createElement("canvas");
    const c = card.overlayCanvas;
    c.width = pixelW;
    c.height = pixelH;

    const ctx = c.getContext("2d");
    ctx.setTransform(pixelW / cssW, 0, 0, pixelH / cssH, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const fontSize = (isPhone ? 16 : 18) * U;
    const inset = (isPhone ? 10 : 20) * U;

    ctx.font = `400 ${fontSize}px "Inter Tight", Inter, system-ui, sans-serif`;
    ctx.letterSpacing = "-0.05em";
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,.5)";
    ctx.shadowBlur = 12 * U;
    ctx.fillText(card.project.titulo, inset, cssH - 10 * U - 0.22 * fontSize);
    ctx.shadowBlur = 0;
    ctx.letterSpacing = "0px";

    const radius = 12.5 * U;
    const cx = cssW - inset - radius;
    const cy = cssH - 10 * U - radius;

    ctx.fillStyle = "rgba(0,0,0,.86)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.4 * U;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const arm = 4.5 * U;
    ctx.beginPath();
    if (isPhone) {
      ctx.moveTo(cx - arm, cy);
      ctx.lineTo(cx + arm, cy);
      ctx.moveTo(cx + 0.2 * arm, cy - 0.8 * arm);
      ctx.lineTo(cx + arm, cy);
      ctx.lineTo(cx + 0.2 * arm, cy + 0.8 * arm);
    } else {
      ctx.moveTo(cx - arm, cy);
      ctx.lineTo(cx + arm, cy);
      ctx.moveTo(cx, cy - arm);
      ctx.lineTo(cx, cy + arm);
    }
    ctx.stroke();

    if (card.overlayTexture) card.overlayTexture.dispose();
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    card.overlayTexture = texture;
    card.material.uniforms.u_overlay.value = texture;
  }

  function updateCrop(card) {
    const u = card.material.uniforms;
    const mediaAspect = card.mediaAspect || 1.6;
    const cardAspect = card.cssW / card.cssH;
    let scaleX = 1;
    let scaleY = 1;
    if (cardAspect > mediaAspect) scaleY = mediaAspect / cardAspect;
    else scaleX = cardAspect / mediaAspect;
    u.u_crop.value.set((1 - scaleX) / 2, (1 - scaleY) / 2, scaleX, scaleY);
  }

  /* ------------------------------------------------------------------ */
  /* loop                                                                */
  /* ------------------------------------------------------------------ */

  function frame(now) {
    rafId = 0;
    if (disposed || !active || document.hidden || !desktop.matches) return;
    rafId = requestAnimationFrame(frame);

    if (!lastFrame) lastFrame = now;
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    if (!active || document.hidden) return;
    frames++;

    const still = reduce();
    const ratio = Math.min(dt * 60, 2);

    if (still) {
      current = target;
    } else {
      if (Math.abs(pending) > 0.0001) {
        const ease = pending * (1 - Math.pow(1 - 0.22, Math.min(dt * 60, 4)));
        target += ease;
        pending -= ease;
        if (Math.abs(pending) < 0.05) {
          target += pending;
          pending = 0;
        }
      }
      if (!isPhone) {
        target = current + Math.tanh((target - current) / vw) * vw;
      }
      current += (target - current) * 0.1 * ratio;
      current = Math.round(current * 100) / 100;
    }

    const lag = target - current;
    const t = Math.tanh(lag / (isPhone ? 245 : 550));
    const vel = t * Math.abs(t);
    const r = still ? 0 : Math.min(1, Math.abs(vel));

    depth = isPhone ? H * 0.18 * 1.1 * r : W * 0.2 * (1 + 1.1 * r);
    wrung = isPhone ? 0 : r;

    cards.forEach((card) => {
      const u = card.material.uniforms;
      u.u_sheetD.value = depth;
      u.u_sheetV.value = wrung;
      u.u_D.value = depth;

      const rate = 1 - Math.exp(-(card.hoverTarget ? 8 : 6) * dt);
      card.hover += (card.hoverTarget - card.hover) * rate;
      u.u_hover.value = still ? 0 : card.hover;

      if (isPhone) {
        let y = card.base - current;
        y = loopTop + mod(y - loopTop, loopLength);
        card.mesh.position.set(0, -((y + card.cssH / 2 - vh / 2) * k), 0);
        card.screen.x = (vw - card.cssW) / 2;
        card.screen.y = y;
      } else {
        let x = card.base - current;
        x = loopLeft + mod(x - loopLeft, loopLength);
        card.mesh.position.set((x + card.cssW / 2 - vw / 2) * k, 0, 0);
        card.screen.x = x;
        card.screen.y = (vh - card.cssH) / 2;
      }
      card.screen.w = card.cssW;
      card.screen.h = card.cssH;
      card.mesh.visible = isPhone
        ? card.screen.y + card.cssH > -vh && card.screen.y < vh * 2
        : card.screen.x + card.cssW > -vw && card.screen.x < vw * 2;
    });

    updateVideos();
    updateHover();

    if (readyAt) {
      const elapsed = (now - readyAt) / 1000;
      const cardAlpha = still ? 1 : Math.min(1, elapsed / 0.6);
      cards.forEach((card) => {
        card.material.uniforms.u_alpha.value = cardAlpha;
      });
      if (floorMaterial) {
        floorMaterial.uniforms.u_alpha.value = still
          ? 0.9
          : Math.min(0.9, (elapsed / 0.8) * 0.9);
      }
    }

    if (!isPhone && floor && floor.visible && reflectionTarget) {
      renderer.setRenderTarget(reflectionTarget);
      renderer.setClearAlpha(0);
      renderer.clear();
      floor.visible = false;
      renderer.render(scene, mirrorCamera);
      floor.visible = true;
      renderer.setRenderTarget(null);
      renderer.setClearAlpha(1);
      floorMaterial.uniforms.u_mirrorVP.value.multiplyMatrices(
        mirrorCamera.projectionMatrix,
        mirrorCamera.matrixWorldInverse
      );
    }

    renderer.render(scene, camera);

    updatePosition();
  }

  function updatePosition() {
    const centre = isPhone ? vh / 2 : vw / 2;
    let best = 0;
    let bestDistance = Infinity;

    cards.forEach((card) => {
      const cardCentre = isPhone
        ? card.screen.y + card.cssH / 2
        : card.screen.x + card.cssW / 2;
      const distance = Math.abs(cardCentre - centre);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = card.index;
      }
    });

    centredIndex = best;

    const label = pad(best + 1);
    if (label !== lastPosition) {
      lastPosition = label;
      positionEl.textContent = label;
    }
  }

  function updateVideos() {
    if (reduce() || document.hidden) {
      pauseVideos();
      return;
    }

    cards.forEach((card) => {
      const near = isPhone
        ? card.screen.y + card.cssH > -0.5 * vh && card.screen.y < 1.5 * vh
        : card.screen.x + card.cssW > -0.5 * vw && card.screen.x < 1.5 * vw;

      if (!near) {
        if (card.video && !card.video.paused) card.video.pause();
        return;
      }

      if (!card.video) createVideo(card);
      const video = card.video;
      if (video && video.paused) video.play().catch(() => {});
    });
  }

  /* ------------------------------------------------------------------ */
  /* hover                                                               */
  /* ------------------------------------------------------------------ */

  function deformWorld(card, u, v, hoverValue) {
    const sx = card.mesh.position.x;
    const sy = card.mesh.position.y;
    const x0 = sx + (u - 0.5) * card.cssW * k;
    const y0 = sy + (v - 0.5) * card.cssH * k;

    const qx = 2 * u - 1;
    const qy = 2 * v - 1;
    const dome = (1 - qx * qx) * (1 - qy * qy);
    const dent = hoverValue * 0.035 * card.cssH * k * dome;
    const z0 = -dent;

    const swap = isPhone;
    const along = swap ? y0 : x0;
    const cross = swap ? x0 : y0;
    const sheetW = swap ? H : W;
    const sheetT = swap ? 1 : 1.15;
    const sheetC = swap ? 0 : 1;
    const q = (along / sheetW) * sheetT + SHIFT;

    let roll = (BANK * shapeSlope(q, sheetC)) / PI * sheetC;
    if (!swap && wrung > 0) {
      roll += VTWIST * wrung * smoothstep(0.3, 0.9, Math.abs(along / W)) * Math.sign(along / W);
    }

    const c = Math.cos(roll);
    const s = Math.sin(roll);
    let curvedY = cross * c - z0 * s;
    let curvedZ = cross * s + z0 * c;

    const shape = shapeCurve(q, sheetC);
    curvedZ += -depth * shape;

    if (!swap) {
      curvedY += 0.03 * along;
      if (wrung > 0) {
        const m = 1 - smoothstep(-1, 0.3, along / W);
        curvedY += REAR_Y * W * wrung * m;
        curvedZ += REAR_Z * W * wrung * m;
      }
      curvedZ += (W * -0.12) * ramp(along / W);
    }

    if (swap) return { x: curvedY, y: along, z: curvedZ };
    return { x: along, y: curvedY, z: curvedZ };
  }

  function pickCard(clientX, clientY) {
    if (isPhone || reduce()) return -1;

    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    if (px < 0 || py < 0 || px > vw || py > vh) return -1;

    camera.updateMatrixWorld();
    let found = -1;
    let bestDistance = Infinity;
    const point = new THREE.Vector3();

    cards.forEach((card) => {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (let i = 0; i <= 4; i++) {
        const u = i / 4;
        for (let j = 0; j <= 1; j++) {
          const world = deformWorld(card, u, j, card.hover);
          point.set(world.x, world.y, world.z).project(camera);
          const sx = (point.x * 0.5 + 0.5) * vw;
          const sy = (-point.y * 0.5 + 0.5) * vh;
          if (sx < minX) minX = sx;
          if (sx > maxX) maxX = sx;
          if (sy < minY) minY = sy;
          if (sy > maxY) maxY = sy;
        }
      }

      if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const d = Math.hypot(px - cx, py - cy);
        if (d < bestDistance) {
          bestDistance = d;
          found = card.index;
        }
      }
    });

    return found;
  }

  function setHover(index) {
    if (hovered === index) return;
    hovered = index;
    cards.forEach((card) => {
      card.hoverTarget = card.index === index ? 1 : 0;
    });
    canvas.style.cursor = index >= 0 ? "pointer" : "";
  }

  function updateHover() {
    if (!pointer.inside || drag || isPhone || reduce()) {
      setHover(-1);
      return;
    }
    setHover(pickCard(pointer.x, pointer.y));
  }

  /* ------------------------------------------------------------------ */
  /* interação                                                           */
  /* ------------------------------------------------------------------ */

  function push(delta) {
    target += delta;
    if (!isPhone) {
      target = current + Math.tanh((target - current) / vw) * vw;
    }
  }

  function targetFor(index) {
    const card = cards[index];
    if (!card) return 0;
    const centre = isPhone ? vh / 2 : vw / 2;
    return isPhone
      ? card.base + card.cssH / 2 - centre
      : card.base + card.cssW / 2 - centre;
  }

  function focusCard(index) {
    if (!cards.length) return;
    const wrapped = mod(index, cards.length);
    const raw = targetFor(wrapped);
    const length = loopLength || 1;
    target = raw - Math.round((raw - current) / length) * length;
    hovered = wrapped;
  }

  function openProject(index) {
    if (window.IAN && typeof window.IAN.openProject === "function") {
      window.IAN.openProject(index, canvas);
      return;
    }
    const project = projects[index];
    if (project && project.url) window.open(project.url, "_blank", "noopener");
  }

  function setPointer(event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.inside = true;
  }

  function bindEvents() {
    canvas.addEventListener("pointermove", (event) => {
      setPointer(event);

      if (drag) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!dragMoved && Math.hypot(dx, dy) > 6) {
          dragMoved = true;
          canvas.classList.add("is-dragging");
        }
        if (dragMoved) {
          const delta = isPhone
            ? -(event.clientY - drag.lastY) * 3.25
            : -(event.clientX - drag.lastX) * 1.6;
          push(delta);
          drag.lastX = event.clientX;
          drag.lastY = event.clientY;
        }
        return;
      }

      setHover(pickCard(event.clientX, event.clientY));
    });

    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      drag = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY };
      dragMoved = false;
      canvas.setPointerCapture?.(event.pointerId);
    });

    const endDrag = (event) => {
      if (!drag) return;
      const moved = dragMoved;
      drag = null;
      dragMoved = false;
      canvas.classList.remove("is-dragging");
      canvas.releasePointerCapture?.(event.pointerId);

      if (!moved) {
        const index = pickCard(event.clientX, event.clientY);
        if (index >= 0) openProject(index);
      } else {
        setHover(pickCard(event.clientX, event.clientY));
      }
    };

    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", (event) => {
      drag = null;
      dragMoved = false;
      canvas.classList.remove("is-dragging");
      canvas.releasePointerCapture?.(event.pointerId);
    });

    canvas.addEventListener("pointerleave", () => {
      pointer.inside = false;
      if (!drag) setHover(-1);
    });

    document.addEventListener("pointerleave", () => {
      pointer.inside = false;
      setHover(-1);
    });

    canvas.addEventListener(
      "wheel",
      (event) => {
        if (event.ctrlKey) return;

        const now = performance.now();
        const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
        if (!event.shiftKey && !horizontal) return;

        let delta = event.shiftKey ? event.deltaY : event.deltaX;
        if (event.deltaMode === 1) delta *= 16;
        else if (event.deltaMode === 2) delta *= vh;

        event.preventDefault();
        if (!delta) return;

        const big =
          Math.abs(delta) >= 40 &&
          now - lastWheelAt >= 30 &&
          now - burstAt > 500;
        const burst = now - lastWheelAt < 30;
        if (big) pending += delta * 1.25 * 2;
        else pending += delta * 1.25;

        burstAt = burst ? now : burstAt;
        lastWheelAt = now;
      },
      { passive: false }
    );

    canvas.addEventListener("keydown", (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          focusCard(centredIndex + 1);
          return;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          focusCard(centredIndex - 1);
          return;
        case "PageDown":
          event.preventDefault();
          focusCard(centredIndex + 3);
          return;
        case "PageUp":
          event.preventDefault();
          focusCard(centredIndex - 3);
          return;
        case " ":
          event.preventDefault();
          focusCard(centredIndex + (event.shiftKey ? -3 : 3));
          return;
        case "Enter":
          event.preventDefault();
          openProject(hovered >= 0 ? hovered : centredIndex);
          return;
        case "Home":
          event.preventDefault();
          focusCard(0);
          return;
        case "End":
          event.preventDefault();
          focusCard(projects.length - 1);
          return;
        default:
          return;
      }
    });

    prevBtn?.addEventListener("click", () => focusCard(centredIndex - 1));
    nextBtn?.addEventListener("click", () => focusCard(centredIndex + 1));

    let resizeTimer = 0;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resize();
        renderer.setSize(vw, vh, false);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      }, 100);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    reduceQuery.addEventListener?.("change", () => {
      if (reduce()) {
        target = current;
        pending = 0;
        pauseVideos();
        cards.forEach((card) => {
          card.hoverTarget = 0;
          card.hover = 0;
        });
      }
      /* ao sair de reduced motion, updateVideos cria os vídeos sob demanda */
    });
  }

  function makeReflectionTarget() {
    reflectionTarget = new THREE.WebGLRenderTarget(
      Math.max(2, Math.floor(vw / 2)),
      Math.max(2, Math.floor(vh / 2)),
      { depthBuffer: true, stencilBuffer: false }
    );
    reflectionTarget.texture.minFilter = THREE.LinearFilter;
    reflectionTarget.texture.magFilter = THREE.LinearFilter;
    floorMaterial.uniforms.u_reflection.value = reflectionTarget.texture;
  }

  function observeStage() {
    if (!("IntersectionObserver" in window)) {
      active = true;
      return;
    }
    new IntersectionObserver(
      (entries) => {
        active = entries[0]?.isIntersecting ?? true;
        if (!active) pauseVideos();
        syncFrame();
      },
      { threshold: 0 }
    ).observe(stage);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseVideos();
    } else {
      lastFrame = 0;
    }
    syncFrame();
  });
})();
