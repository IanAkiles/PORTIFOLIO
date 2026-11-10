const section = document.getElementById('bandeira');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let started = false;

async function start() {
  if (started || reduced.matches || navigator.connection?.saveData) return;
  started = true;
  try {
    const THREE = await import('./three.module.min.js');
    await createFlag(THREE);
  } catch (error) {
    section.classList.remove('is-ready');
    console.warn('Bandeira: exibindo a fotografia estática.', error);
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

async function createFlag(T) {
  const canvas = section.querySelector('canvas');
  const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(35, 1, .1, 20);
  camera.position.set(0, 0, 4.4);
  scene.add(new T.HemisphereLight(0xffffff, 0x899b89, 2.5));
  const light = new T.DirectionalLight(0xffffff, 1.7);
  light.position.set(-3, 4, 5);
  scene.add(light);
  let texture;
  try {
    texture = await new T.TextureLoader().loadAsync(new URL('../media/flag-photo.webp', import.meta.url).href);
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const cols = 24, rows = 32, width = 2 * 891 / 1170, height = 2;
  const geometry = new T.PlaneGeometry(width, height, cols, rows);
  const attribute = geometry.attributes.position;
  attribute.setUsage(T.DynamicDrawUsage);
  const positions = attribute.array;
  const rest = positions.slice();
  // Slight roll and permanent folds keep the resting portrait from looking like a rigid card.
  for (let i = 0; i < attribute.count; i++) {
    const k = i * 3, x = rest[k], y = rest[k + 1];
    positions[k] = x * Math.cos(-.07) - y * Math.sin(-.07);
    positions[k + 1] = x * Math.sin(-.07) + y * Math.cos(-.07);
    positions[k + 2] = .028 * Math.sin(x * 12 + y * 5);
  }
  const previous = positions.slice();
  const pins = positions.slice();
  const fixed = i => i === 0 || i === cols;
  const links = [];
  function link(a, b, strength) {
    const length = Math.hypot(rest[a * 3] - rest[b * 3], rest[a * 3 + 1] - rest[b * 3 + 1]);
    links.push([a, b, length, strength]);
  }
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
    const i = y * (cols + 1) + x;
    if (x < cols) link(i, i + 1, 1);
    if (y < rows) link(i, i + cols + 1, 1);
    if (x < cols && y < rows) {
      link(i, i + cols + 2, .65);
      link(i + 1, i + cols + 1, .65);
    }
    if (x + 2 <= cols) link(i, i + 2, .3);
    if (y + 2 <= rows) link(i, i + 2 * (cols + 1), .3);
  }
  const material = new T.MeshStandardMaterial({ map: texture, side: T.DoubleSide, roughness: .86, metalness: 0 });
  const mesh = new T.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const raycaster = new T.Raycaster();
  const pointer = new T.Vector2();
  const plane = new T.Plane(new T.Vector3(0, 0, 1), 0);
  const target = new T.Vector3();
  const offset = new T.Vector3();
  const dragStart = new T.Vector3();
  const stretchWeights = new Float32Array(attribute.count);
  let stretch = 0;
  let held = -1, pointerId = null, visible = false, failed = false, frame = 0, last = 0, time = 0;
  renderer.debug.onShaderError = () => {
    failed = true;
    sync();
    section.classList.remove('is-ready');
  };

  function updateRay(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(2 * (event.clientX - rect.left) / rect.width - 1, 1 - 2 * (event.clientY - rect.top) / rect.height);
    raycaster.setFromCamera(pointer, camera);
  }
  function pick(event) {
    updateRay(event);
    geometry.computeBoundingSphere();
    return raycaster.intersectObject(mesh)[0];
  }
  function release() {
    const id = pointerId;
    held = -1;
    pointerId = null;
    canvas.classList.remove('is-held', 'is-over');
    if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  canvas.addEventListener('pointerdown', event => {
    if (reduced.matches || (event.pointerType === 'mouse' && event.button !== 0) || held >= 0) return;
    const hit = pick(event);
    if (!hit) return;
    let distance = Infinity;
    for (let i = 0; i < attribute.count; i++) {
      if (fixed(i)) continue;
      const k = i * 3;
      const d = (positions[k] - hit.point.x) ** 2 + (positions[k + 1] - hit.point.y) ** 2 + (positions[k + 2] - hit.point.z) ** 2;
      if (d < distance) { held = i; distance = d; }
    }
    plane.constant = -hit.point.z;
    offset.set(positions[held * 3], positions[held * 3 + 1], positions[held * 3 + 2]).sub(hit.point);
    target.copy(hit.point).add(offset);
    dragStart.copy(target);
    for (let i = 0; i < attribute.count; i++) {
      const distance = Math.hypot(rest[i * 3] - rest[held * 3], rest[i * 3 + 1] - rest[held * 3 + 1]);
      stretchWeights[i] = Math.exp(-distance / .85);
    }
    pointerId = event.pointerId;
    canvas.setPointerCapture(pointerId);
    canvas.classList.add('is-held');
  });
  canvas.addEventListener('pointermove', event => {
    if (held >= 0) {
      if (event.pointerId !== pointerId) return;
      updateRay(event);
      if (raycaster.ray.intersectPlane(plane, target)) {
        target.add(offset);
        target.x = T.MathUtils.clamp(target.x, -2, 2);
        target.y = T.MathUtils.clamp(target.y, -1.9, 1.6);
      }
    } else if (event.pointerType === 'mouse') canvas.classList.toggle('is-over', Boolean(pick(event)));
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, e => {
    if (e.pointerId === pointerId) release();
  });
  canvas.addEventListener('pointerleave', () => canvas.classList.remove('is-over'));
  // Cancel touch scrolling only for a gesture that starts on the actual cloth.
  canvas.addEventListener('touchstart', event => {
    if (event.touches.length === 1 && pick(event.touches[0])) event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', event => { if (held >= 0) event.preventDefault(); }, { passive: false });
  window.addEventListener('blur', release);

  function simulate(dt, wind = true) {
    const desiredStretch = held >= 0 ? Math.min(.6, target.distanceTo(dragStart) * .6) : 0;
    stretch += (desiredStretch - stretch) * (1 - Math.exp(-9 * dt));
    const h = dt / 6;
    for (let step = 0; step < 6; step++) {
      time += h;
      const damping = Math.exp(-3.5 * h);
      for (let i = 0; i < attribute.count; i++) {
        if (fixed(i)) continue;
        const k = i * 3;
        const flutter = wind ? .9 * Math.sin(rest[k] * 6 + rest[k + 1] * 4 + time * 2.2) : 0;
        for (let axis = 0; axis < 3; axis++) {
          const value = positions[k + axis];
          const acceleration = axis === 1 ? -3.2 : axis === 2 ? flutter + (wind ? .4 : 0) : flutter * .13;
          positions[k + axis] += T.MathUtils.clamp((value - previous[k + axis]) * damping, -.025, .025) + acceleration * h * h;
          previous[k + axis] = value;
        }
      }
      if (held >= 0) {
        const k = held * 3;
        for (const pin of [0, cols]) {
          const p = pin * 3;
          const max = 1.5 * Math.hypot(rest[k] - rest[p], rest[k + 1] - rest[p + 1]);
          const delta = new T.Vector3(target.x - pins[p], target.y - pins[p + 1], target.z - pins[p + 2]);
          if (delta.length() > max) target.set(pins[p], pins[p + 1], pins[p + 2]).add(delta.setLength(max));
        }
        const dx = target.x - positions[k], dy = target.y - positions[k + 1], dz = target.z - positions[k + 2];
        for (let i = 0; i < attribute.count; i++) {
          if (fixed(i)) continue;
          const p = i * 3;
          const distance = Math.hypot(rest[p] - rest[k], rest[p + 1] - rest[k + 1]) / .26;
          if (distance >= 1) continue;
          const weight = (1 - distance * distance) ** 2;
          positions[p] += dx * weight; positions[p + 1] += dy * weight; positions[p + 2] += dz * weight;
          previous[p] = positions[p]; previous[p + 1] = positions[p + 1]; previous[p + 2] = positions[p + 2];
        }
      }
      for (let n = 0; n < links.length; n++) {
        const [a, b, length, strength] = links[step % 2 ? links.length - 1 - n : n];
        const ia = a * 3, ib = b * 3;
        const dx = positions[ib] - positions[ia], dy = positions[ib + 1] - positions[ia + 1], dz = positions[ib + 2] - positions[ia + 2];
        const distance = Math.hypot(dx, dy, dz) || 1;
        const wa = fixed(a) || a === held ? 0 : 1, wb = fixed(b) || b === held ? 0 : 1;
        if (!(wa + wb)) continue;
        const elasticLength = length * (1 + stretch * (stretchWeights[a] + stretchWeights[b]) * .5);
        const correction = (distance - elasticLength) / distance * strength / (wa + wb);
        positions[ia] += dx * correction * wa; positions[ia + 1] += dy * correction * wa; positions[ia + 2] += dz * correction * wa;
        positions[ib] -= dx * correction * wb; positions[ib + 1] -= dy * correction * wb; positions[ib + 2] -= dz * correction * wb;
      }
      // Allow controlled stretch while pulling, then ease the tethers back on release.
      for (let i = 0; i < attribute.count; i++) {
        if (fixed(i)) continue;
        const k = i * 3;
        for (const pin of [0, cols]) {
          const p = pin * 3;
          const max = (1.015 + stretch * .8) * Math.hypot(rest[k] - rest[p], rest[k + 1] - rest[p + 1]);
          const dx = positions[k] - pins[p], dy = positions[k + 1] - pins[p + 1], dz = positions[k + 2] - pins[p + 2];
          const length = Math.hypot(dx, dy, dz);
          if (length > max) {
            const scale = max / length;
            positions[k] = pins[p] + dx * scale; positions[k + 1] = pins[p + 1] + dy * scale; positions[k + 2] = pins[p + 2] + dz * scale;
          }
        }
      }
    }
  }
  function render() {
    attribute.needsUpdate = true;
    geometry.computeVertexNormals();
    renderer.render(scene, camera);
  }
  function resize() {
    const { width: w, height: h } = section.getBoundingClientRect();
    if (!w || !h || failed) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = Math.max(4, 3 / camera.aspect);
    camera.updateProjectionMatrix();
    if (visible && !reduced.matches) render();
  }
  function tick(now) {
    frame = 0;
    if (!visible || document.hidden || reduced.matches || failed) return;
    simulate(last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60);
    last = now;
    render();
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    release();
    if (visible && !document.hidden && !reduced.matches && !failed) frame = requestAnimationFrame(tick);
  }
  const sizing = new ResizeObserver(resize);
  sizing.observe(section);
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    sync();
  }).observe(section);
  else visible = true;
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    failed = true;
    sync();
    section.classList.remove('is-ready');
    sizing.disconnect();
    geometry.dispose(); material.dispose(); texture.dispose(); renderer.dispose();
  });
  for (let i = 0; i < 90; i++) simulate(1 / 60, false);
  resize();
  render();
  if (!failed) section.classList.add('is-ready');
  sync();
}
