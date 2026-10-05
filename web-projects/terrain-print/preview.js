// The 3D preview (three.js). DOM glue only: it draws the parts the worker
// built, coloured with the same bands as the colour plan, on the printer bed.
//
// The model uses x east, y north and z up, in mm. three.js puts y up, so one
// group turns the whole model by -90 degrees about x.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { colourAt } from "./colourPlan.js";
import { layoutOffsets } from "./model.js";
import { filamentHex } from "./settings.js";

export function createPreview(element) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  element.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 20000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;

  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1f2b, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0x9fb8ff, 0.35);
  scene.add(fill);

  const world = new THREE.Group();
  world.rotation.x = -Math.PI / 2;
  scene.add(world);
  const bedGroup = new THREE.Group();
  world.add(bedGroup);
  const modelGroup = new THREE.Group();
  world.add(modelGroup);

  let meshes = [];
  let frameMesh = null;
  let showFrame = true;
  let spread = false;
  let parts = [];
  let offsets = [];
  let cell = 40;
  let radius = 100;
  let lift = 0;
  let running = false;

  function resize() {
    const w = element.clientWidth || 1;
    const h = element.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(element);

  function loop() {
    if (!running) return;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  function clear(group) {
    for (const child of [...group.children]) {
      group.remove(child);
      child.geometry?.dispose();
      child.material?.dispose?.();
    }
  }

  function drawBed(bed) {
    clear(bedGroup);
    const w = bed.width;
    const h = bed.height;
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ color: 0x1b2232, roughness: 0.95, metalness: 0, transparent: true, opacity: 0.92 }),
    );
    plate.position.z = -0.05;
    bedGroup.add(plate);
    const lines = [];
    const step = 10;
    for (let x = -w / 2; x <= w / 2 + 1e-6; x += step) lines.push(x, -h / 2, 0, x, h / 2, 0);
    for (let y = -h / 2; y <= h / 2 + 1e-6; y += step) lines.push(-w / 2, y, 0, w / 2, y, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
    bedGroup.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x2c3a55 })));
    const edge = new THREE.BufferGeometry();
    edge.setAttribute("position", new THREE.Float32BufferAttribute([-w / 2, -h / 2, 0.02, w / 2, -h / 2, 0.02, w / 2, h / 2, 0.02, -w / 2, h / 2, 0.02], 3));
    bedGroup.add(new THREE.LineLoop(edge, new THREE.LineBasicMaterial({ color: 0x4f9be8 })));
  }

  function geometryOf(part) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(part.positions, 3));
    g.setIndex(new THREE.BufferAttribute(part.indices, 1));
    g.computeVertexNormals();
    return g;
  }

  function colourise(geometry, bands) {
    const pos = geometry.getAttribute("position").array;
    const colours = new Float32Array(pos.length);
    const cache = new Map();
    const c = new THREE.Color();
    for (let k = 0; k < pos.length; k += 3) {
      const id = colourAt(bands, pos[k + 2]);
      let rgb = cache.get(id);
      if (!rgb) {
        c.set(filamentHex(id)).convertSRGBToLinear();
        rgb = [c.r, c.g, c.b];
        cache.set(id, rgb);
      }
      colours[k] = rgb[0];
      colours[k + 1] = rgb[1];
      colours[k + 2] = rgb[2];
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  }

  function place() {
    // In its frame, a tile rests on the frame's floor.
    const up = frameMesh && showFrame && !spread ? lift : 0;
    meshes.forEach((m, i) => {
      const [dx, dy] = spread ? offsets[i] : [0, 0];
      m.position.set(dx, dy, m === frameMesh ? 0 : up);
    });
    if (frameMesh) frameMesh.visible = showFrame;
  }

  function show(result, settings, bed, { keepCamera = false } = {}) {
    clear(modelGroup);
    meshes = [];
    frameMesh = null;
    parts = result.parts;
    drawBed(bed);
    lift = settings.frame === "tray" ? settings.floorMm : 0;
    cell = Math.min(result.geom.width / result.grid.cols, result.geom.height / result.grid.rows);
    offsets = layoutOffsets(parts, cell, Math.max(4, cell * 0.12)).map(([x, y]) => [x, y]);
    for (const part of parts) {
      const geometry = geometryOf(part);
      let material;
      if (part.kind === "piece") {
        colourise(geometry, result.colours.bands);
        material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02 });
      } else {
        material = new THREE.MeshStandardMaterial({ color: new THREE.Color(part.colour), roughness: 0.7, metalness: 0.05 });
      }
      const mesh = new THREE.Mesh(geometry, material);
      modelGroup.add(mesh);
      meshes.push(mesh);
      if (part.kind === "frame") frameMesh = mesh;
    }
    place();
    const span = Math.max(result.geom.width, result.geom.height, 40);
    radius = span;
    // Light from the north-west, the upper left as seen by the camera, as on
    // a relief map. Light from the camera side makes craters look like domes.
    setLight(315, 40);
    if (!keepCamera) frameCamera();
  }

  function frameCamera(fromBelow = false) {
    const d = radius * 1.9;
    // Seen from the south, a little to the west: north is up, as on the map.
    const az = (-12 * Math.PI) / 180;
    const el = ((fromBelow ? -55 : 52) * Math.PI) / 180;
    camera.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    controls.target.set(0, fromBelow ? 0 : radius * 0.02, 0);
    controls.update();
  }

  function setLight(azimuthDeg, elevationDeg) {
    const az = (azimuthDeg * Math.PI) / 180;
    const el = (elevationDeg * Math.PI) / 180;
    const d = radius * 4;
    sun.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, -Math.cos(az) * Math.cos(el) * d);
    fill.position.set(-sun.position.x, radius, -sun.position.z);
  }

  let below = false;
  return {
    show,
    start() {
      if (running) return;
      running = true;
      resize();
      loop();
    },
    stop() {
      running = false;
    },
    setSpread(on) {
      spread = on;
      place();
    },
    setShowFrame(on) {
      showFrame = on;
      place();
    },
    toggleBack() {
      below = !below;
      frameCamera(below);
      return below;
    },
    setLight,
  };
}
