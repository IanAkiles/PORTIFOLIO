const section = document.getElementById('bandeira');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let started = false;

async function start() {
  if (started || reduced.matches || navigator.connection?.saveData) return;
  started = true;
  try {
    const THREE = await import('./three.module.min.js');
    await createFlags(THREE);
  } catch (error) {
    section.classList.remove('is-ready');
    console.warn('Bandeiras: exibindo as imagens estáticas.', error);
  }
}

if (section) {
  if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) start();
    }, { rootMargin: '300px' });
    near.observe(section);
  } else start();
  reduced.addEventListener('change', () => { if (!reduced.matches) start(); });
}

async function createFlags(T) {
  const canvas = section.querySelector('canvas');
  const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(35, 1, .1, 20);
  camera.position.set(0, 0, 4.4);
  scene.add(new T.HemisphereLight(0xffffff, 0x899b89, 2.5));
  const light = new T.DirectionalLight(0xffffff, 1.7);
  light.position.set(-3, 4, 5);
  scene.add(light);
  const flags = [];
  let active = null, pointerId = null, visible = false, failed = false, frame = 0, last = 0, sizing;
  const raycaster = new T.Raycaster();
  const pointer = new T.Vector2();
  const plane = new T.Plane(new T.Vector3(0, 0, 1), 0);
  const point = new T.Vector3();
  const offset = new T.Vector3();

  function release() {
    active?.release();
    active = null;
    const id = pointerId;
    pointerId = null;
    canvas.classList.remove('is-held', 'is-over');
    if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    release();
    if (visible && !document.hidden && !reduced.matches && !failed) frame = requestAnimationFrame(tick);
  }
  function fail() {
    failed = true;
    sync();
    section.classList.remove('is-ready');
  }
  renderer.debug.onShaderError = fail;
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    fail();
    sizing?.disconnect();
    for (const flag of flags) {
      flag.mesh.geometry.dispose();
      flag.mesh.material.map.dispose();
      flag.mesh.material.dispose();
    }
    renderer.dispose();
  });
  // A missing logo leaves only its own static fallback; the other flags still work.
  await Promise.all([...section.querySelectorAll('.photo-flag-still')].map(async image => {
    let texture;
    try {
      texture = await new T.TextureLoader().loadAsync(image.src);
      if (failed) { texture.dispose(); return; }
      texture.colorSpace = T.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      const flag = createCloth(T, image, texture);
      flags.push(flag);
      scene.add(flag.mesh);
    } catch (error) {
      texture?.dispose();
      console.warn('Bandeira indisponível:', image.alt, error);
    }
  }));
  if (failed || !flags.length) { renderer.dispose(); return; }
  const meshes = flags.map(flag => flag.mesh);
  function updateRay(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(2 * (event.clientX - rect.left) / rect.width - 1, 1 - 2 * (event.clientY - rect.top) / rect.height);
    raycaster.setFromCamera(pointer, camera);
  }
  function pick(event) {
    updateRay(event);
    for (const flag of flags) flag.mesh.geometry.computeBoundingSphere();
    return raycaster.intersectObjects(meshes, false).find(hit => hit.object.userData.cloth.opaque(hit.uv));
  }
  canvas.addEventListener('pointerdown', event => {
    if (failed || reduced.matches || (event.pointerType === 'mouse' && event.button !== 0) || active) return;
    const hit = pick(event);
    if (!hit) return;
    active = hit.object.userData.cloth;
    plane.constant = -hit.point.z;
    point.copy(hit.point);
    active.mesh.worldToLocal(point);
    offset.copy(active.grab(point)).sub(point);
    pointerId = event.pointerId;
    canvas.setPointerCapture(pointerId);
    canvas.classList.add('is-held');
  });
  canvas.addEventListener('pointermove', event => {
    if (failed || reduced.matches) return;
    if (active) {
      if (event.pointerId !== pointerId) return;
      updateRay(event);
      if (raycaster.ray.intersectPlane(plane, point)) {
        active.mesh.worldToLocal(point);
        active.move(point.add(offset));
      }
    } else if (event.pointerType === 'mouse') canvas.classList.toggle('is-over', Boolean(pick(event)));
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, e => {
    if (e.pointerId === pointerId) release();
  });
  canvas.addEventListener('pointerleave', () => canvas.classList.remove('is-over'));
  canvas.addEventListener('touchstart', event => {
    if (!failed && !reduced.matches && event.touches.length === 1 && pick(event.touches[0])) event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', event => { if (active) event.preventDefault(); }, { passive: false });
  window.addEventListener('blur', release);

  function render() {
    for (const flag of flags) {
      flag.mesh.geometry.attributes.position.needsUpdate = true;
      flag.mesh.geometry.computeVertexNormals();
    }
    renderer.render(scene, camera);
  }
  function resize() {
    const { width: w, height: h } = section.getBoundingClientRect();
    if (!w || !h || failed) return;
    release();
    renderer.setPixelRatio(Math.min(devicePixelRatio, w <= 600 ? 1.25 : 1.5));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const unit = 2 * camera.position.z * Math.tan(T.MathUtils.degToRad(camera.fov / 2)) / h;
    for (const flag of flags) {
      const image = flag.image;
      const style = getComputedStyle(image);
      const x = parseFloat(style.left), y = parseFloat(style.top);
      flag.mesh.position.set((x - w / 2) * unit, (h / 2 - y) * unit, 0);
      flag.mesh.rotation.z = -T.MathUtils.degToRad(parseFloat(style.getPropertyValue('--tilt')) || 5);
      flag.mesh.scale.setScalar(Math.min(image.clientWidth / flag.width, image.clientHeight / flag.height) * unit);
      flag.mesh.updateMatrixWorld();
    }
    if (visible && !reduced.matches) render();
  }
  function tick(now) {
    frame = 0;
    if (!visible || document.hidden || reduced.matches || failed) return;
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    for (const flag of flags) flag.simulate(dt);
    last = now;
    render();
    frame = requestAnimationFrame(tick);
  }
  await renderer.compileAsync(scene, camera);
  for (const flag of flags) {
    if (failed) return;
    renderer.initTexture(flag.mesh.material.map);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  // Settle the cloth in small tasks before starting the visible animation.
  for (let i = 0; i < 90; i++) {
    if (failed) return;
    for (const flag of flags) flag.simulate(1 / 60, false);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  sizing = new ResizeObserver(resize);
  sizing.observe(section);
  // Image decoding may change an auto-sized fallback after the section has settled.
  for (const flag of flags) flag.image.addEventListener('load', resize, { once: true });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    sync();
  }).observe(section);
  else visible = true;
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  resize();
  render();
  if (!failed) {
    for (const flag of flags) flag.image.classList.add('is-rendered');
    section.classList.add('is-ready');
  }
  sync();
}

function createCloth(T, image, texture) {
  const portrait = image.classList.contains('photo-flag-portrait');
  const aspect = texture.image.width / texture.image.height;
  const width = 2 * aspect, height = 2;
  const cols = portrait ? 24 : 8, rows = portrait ? 32 : 8;
  const geometry = new T.PlaneGeometry(width, height, cols, rows);
  const attribute = geometry.attributes.position;
  attribute.setUsage(T.DynamicDrawUsage);
  const positions = attribute.array;
  const rest = positions.slice();
  const waveSin = new Float64Array(attribute.count), waveCos = new Float64Array(attribute.count);
  for (let i = 0; i < attribute.count; i++) {
    const k = i * 3;
    positions[k + 2] = .022 * Math.sin(rest[k] * 12 + rest[k + 1] * 5);
    const phase = rest[k] * 6 + rest[k + 1] * 4;
    waveSin[i] = Math.sin(phase);
    waveCos[i] = Math.cos(phase);
  }
  const previous = positions.slice(), pins = positions.slice();
  const fixed = i => i === 0 || i === cols;
  const links = [];
  const tethers = new Float32Array(attribute.count * 2);
  for (let i = 0; i < attribute.count; i++) for (let pin = 0; pin < 2; pin++) {
    tethers[i * 2 + pin] = Math.hypot(rest[i * 3] - rest[pin * cols * 3], rest[i * 3 + 1] - rest[pin * cols * 3 + 1]);
  }
  function link(a, b, strength) {
    links.push([a, b, Math.hypot(rest[a * 3] - rest[b * 3], rest[a * 3 + 1] - rest[b * 3 + 1]), strength]);
  }
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
    const i = y * (cols + 1) + x;
    if (x < cols) link(i, i + 1, 1);
    if (y < rows) link(i, i + cols + 1, 1);
    if (x < cols && y < rows) { link(i, i + cols + 2, .65); link(i + 1, i + cols + 1, .65); }
    if (x + 2 <= cols) link(i, i + 2, .3);
    if (y + 2 <= rows) link(i, i + 2 * (cols + 1), .3);
  }
  const material = new T.MeshStandardMaterial({
    map: texture, side: T.DoubleSide, roughness: .86, metalness: 0,
    transparent: !portrait, alphaTest: portrait ? 0 : .3, depthWrite: portrait, forceSinglePass: true
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.frustumCulled = false;
  let alpha;
  if (!portrait) {
    const mask = document.createElement('canvas');
    mask.width = mask.height = 128;
    const context = mask.getContext('2d', { willReadFrequently: true });
    context.drawImage(texture.image, 0, 0, 128, 128);
    alpha = context.getImageData(0, 0, 128, 128).data;
  }
  const target = new T.Vector3(), dragStart = new T.Vector3();
  const stretchWeights = new Float32Array(attribute.count), pullWeights = new Float32Array(attribute.count);
  let held = -1, stretch = 0, time = 0;
  const cloth = {
    image, mesh, width, height, simulate,
    opaque(uv) {
      if (!alpha) return true;
      const x = Math.min(127, Math.max(0, Math.floor(uv.x * 128)));
      const y = Math.min(127, Math.max(0, Math.floor((1 - uv.y) * 128)));
      return alpha[(y * 128 + x) * 4 + 3] > 76;
    },
    grab(point) {
      let distance = Infinity;
      for (let i = 0; i < attribute.count; i++) {
        if (fixed(i)) continue;
        const k = i * 3;
        const d = (positions[k] - point.x) ** 2 + (positions[k + 1] - point.y) ** 2 + (positions[k + 2] - point.z) ** 2;
        if (d < distance) { held = i; distance = d; }
      }
      target.fromArray(positions, held * 3);
      dragStart.copy(target);
      for (let i = 0; i < attribute.count; i++) {
        const d = Math.hypot(rest[i * 3] - rest[held * 3], rest[i * 3 + 1] - rest[held * 3 + 1]);
        stretchWeights[i] = Math.exp(-d / .85);
        pullWeights[i] = d < .26 ? (1 - (d / .26) ** 2) ** 2 : 0;
      }
      return target;
    },
    move(point) { target.copy(point); target.x = T.MathUtils.clamp(target.x, -Math.max(width, 2), Math.max(width, 2)); target.y = T.MathUtils.clamp(target.y, -1.9, 1.6); },
    release() { held = -1; }
  };
  mesh.userData.cloth = cloth;
  return cloth;

  function simulate(dt, wind = true) {
    const desiredStretch = held >= 0 ? Math.min(.6, target.distanceTo(dragStart) * .6) : 0;
    stretch += (desiredStretch - stretch) * (1 - Math.exp(-9 * dt));
    const h = dt / 6;
    for (let step = 0; step < 6; step++) {
      time += h;
      const damping = Math.exp(-3.5 * h);
      const sinTime = Math.sin(time * 2.2), cosTime = Math.cos(time * 2.2);
      for (let i = 0; i < attribute.count; i++) {
        if (fixed(i)) continue;
        const k = i * 3;
        // sin(phase + time) reuses the fixed spatial wave instead of evaluating every vertex.
        const flutter = wind ? (portrait ? .9 : .65) * (waveSin[i] * cosTime + waveCos[i] * sinTime) : 0;
        const x = positions[k], y = positions[k + 1], z = positions[k + 2];
        positions[k] += T.MathUtils.clamp((x - previous[k]) * damping, -.025, .025) + flutter * .13 * h * h;
        positions[k + 1] += T.MathUtils.clamp((y - previous[k + 1]) * damping, -.025, .025) - 3.2 * h * h;
        positions[k + 2] += T.MathUtils.clamp((z - previous[k + 2]) * damping, -.025, .025) + (flutter + (wind ? .4 : 0)) * h * h;
        previous[k] = x; previous[k + 1] = y; previous[k + 2] = z;
      }
      if (held >= 0) {
        const k = held * 3;
        for (let pin = 0; pin < 2; pin++) {
          const p = pin * cols * 3;
          const max = 1.5 * tethers[held * 2 + pin];
          const dx = target.x - pins[p], dy = target.y - pins[p + 1], dz = target.z - pins[p + 2];
          const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (length > max) target.set(pins[p] + dx * max / length, pins[p + 1] + dy * max / length, pins[p + 2] + dz * max / length);
        }
        const dx = target.x - positions[k], dy = target.y - positions[k + 1], dz = target.z - positions[k + 2];
        for (let i = 0; i < attribute.count; i++) {
          if (fixed(i) || !pullWeights[i]) continue;
          const p = i * 3, weight = pullWeights[i];
          positions[p] += dx * weight; positions[p + 1] += dy * weight; positions[p + 2] += dz * weight;
          previous[p] = positions[p]; previous[p + 1] = positions[p + 1]; previous[p + 2] = positions[p + 2];
        }
      }
      for (let n = 0; n < links.length; n++) {
        const constraint = links[step % 2 ? links.length - 1 - n : n];
        const a = constraint[0], b = constraint[1], length = constraint[2], strength = constraint[3];
        const ia = a * 3, ib = b * 3;
        const dx = positions[ib] - positions[ia], dy = positions[ib + 1] - positions[ia + 1], dz = positions[ib + 2] - positions[ia + 2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const wa = fixed(a) || a === held ? 0 : 1, wb = fixed(b) || b === held ? 0 : 1;
        if (!(wa + wb)) continue;
        const elasticLength = length * (1 + stretch * (stretchWeights[a] + stretchWeights[b]) * .5);
        const correction = (distance - elasticLength) / distance * strength / (wa + wb);
        positions[ia] += dx * correction * wa; positions[ia + 1] += dy * correction * wa; positions[ia + 2] += dz * correction * wa;
        positions[ib] -= dx * correction * wb; positions[ib + 1] -= dy * correction * wb; positions[ib + 2] -= dz * correction * wb;
      }
      // Cache rest distances; all nine cloths reuse the same solver without repeated square roots for their tethers.
      for (let i = 0; i < attribute.count; i++) {
        if (fixed(i)) continue;
        const k = i * 3;
        for (let pin = 0; pin < 2; pin++) {
          const p = pin * cols * 3;
          const max = (1.015 + stretch * .8) * tethers[i * 2 + pin];
          const dx = positions[k] - pins[p], dy = positions[k + 1] - pins[p + 1], dz = positions[k + 2] - pins[p + 2];
          const lengthSquared = dx * dx + dy * dy + dz * dz;
          if (lengthSquared > max * max) {
            const scale = max / Math.sqrt(lengthSquared);
            positions[k] = pins[p] + dx * scale; positions[k + 1] = pins[p + 1] + dy * scale; positions[k + 2] = pins[p + 2] + dz * scale;
          }
        }
      }
    }
  }
}
