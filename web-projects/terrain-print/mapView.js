// The selection map (Leaflet, loaded as the global `L`). DOM glue only.
//
// The Moon and Mars use plate carrée tiles (Leaflet's EPSG:4326), the Earth
// uses Web Mercator. Leaflet cannot change the projection of a live map, so a
// change of world makes a new map in the same element.
//
// The selection always sits at the centre of the view. Its size on the
// ground follows the zoom: "box size" is a share of the shorter side of the
// view, and the ground size is that many pixels times the metres per pixel.

import { BODIES } from "./bodies.js";
import { decodeTerrarium } from "./elevation.js";
import { decodeLerc1 } from "./lerc1.js";
import { footprint } from "./model.js";
import { unwrapLon } from "./geo.js";

const PLATE = "plate";

export function createMapView(element, { onMove, onMoveEnd, onPlace }) {
  let map = null;
  let body = null;
  let baseLayer = null;
  let seaLayer = null;
  let outline = null;
  let markers = null;
  let sea = { on: false, level: 0 };
  let sunAzimuth = 315;

  function metresPerPixelAtZoom0(lat) {
    const R = body.radius;
    return body.projection === PLATE ? (Math.PI * R) / 256 : (2 * Math.PI * R * Math.cos((lat * Math.PI) / 180)) / 256;
  }

  function viewPixels() {
    const size = map.getSize();
    // A hidden map has no size; assume a typical one until it shows.
    return Math.min(size.x, size.y) || 600;
  }

  /** Ground size in km of a box of `pct` % of the view. */
  function kmForBox(pct) {
    const c = map.getCenter();
    const mpp = metresPerPixelAtZoom0(c.lat) / 2 ** map.getZoom();
    return (viewPixels() * (pct / 100) * mpp) / 1000;
  }

  /** Zoom at which `km` fills `pct` % of the view at latitude `lat`. */
  function zoomForKm(km, pct, lat) {
    const pixels = viewPixels() * (pct / 100);
    return Math.log2((metresPerPixelAtZoom0(lat) * pixels) / (km * 1000));
  }

  function setBody(bodyId, view) {
    if (map) map.remove();
    body = BODIES[bodyId];
    const plate = body.projection === PLATE;
    map = L.map(element, {
      crs: plate ? L.CRS.EPSG4326 : L.CRS.EPSG3857,
      // No snapping: a shared link's ground size must come back exactly.
      zoomSnap: 0,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90,
      minZoom: plate ? 0 : 1,
      maxZoom: plate ? 13 : 16,
      worldCopyJump: false,
      attributionControl: true,
      zoomControl: true,
    });
    map.attributionControl.setPrefix(false);
    map.setView([view.lat, view.lon], view.zoom ?? 3);
    markers = L.layerGroup().addTo(map);
    map.on("move", () => onMove?.());
    map.on("moveend", () => onMoveEnd?.());
    baseLayer = null;
    seaLayer = null;
    outline = null;
    return map;
  }

  function setLayer(layerId) {
    if (baseLayer) map.removeLayer(baseLayer);
    const spec = body.layers.find((l) => l.id === layerId) ?? body.layers[0];
    if (spec.computed) baseLayer = earthReliefLayer();
    else {
      baseLayer = L.tileLayer(spec.url, {
        tileSize: 256,
        maxNativeZoom: spec.maxNativeZoom,
        maxZoom: 16,
        attribution: spec.attribution,
        crossOrigin: false,
      });
    }
    baseLayer.addTo(map);
    baseLayer.bringToBack();
    updateSeaLayer();
  }

  // ---- Earth: relief drawn from the same height tiles the model uses ----
  const terrariumCache = new Map();
  function loadTerrarium(z, x, y) {
    const key = `${z}/${x}/${y}`;
    if (!terrariumCache.has(key)) {
      const p = new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = c.height = 256;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          resolve(decodeTerrarium(ctx.getImageData(0, 0, 256, 256).data));
        };
        img.onerror = () => resolve(null);
        img.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
      });
      terrariumCache.set(key, p);
      if (terrariumCache.size > 400) terrariumCache.delete(terrariumCache.keys().next().value);
    }
    return terrariumCache.get(key);
  }

  // Leaflet's own redraw() breaks at a fractional zoom (it forgets to round
  // the tile zoom), so a sea change repaints the live tiles in place instead.
  function withRepaint(layer) {
    const live = new Map();
    layer.on("tileunload", (e) => live.delete(e.tile));
    layer.track = (canvas, paint) => {
      live.set(canvas, paint);
      paint();
    };
    layer.repaint = () => {
      for (const paint of live.values()) paint();
    };
    return layer;
  }

  function earthReliefLayer() {
    const Layer = L.GridLayer.extend({
      createTile(coords, done) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 256;
        const n = 2 ** coords.z;
        const x = ((coords.x % n) + n) % n;
        loadTerrarium(coords.z, x, coords.y).then((h) => {
          if (h) this.track(canvas, () => paintRelief(canvas, h, coords.z, sea, sunAzimuth));
          done(null, canvas);
        });
        return canvas;
      },
    });
    return withRepaint(new Layer({ tileSize: 256, maxNativeZoom: 12, maxZoom: 16, attribution: body.layers[0].attribution }));
  }

  // ---- Mars: a sea drawn over the photo where the ground is below the level ----
  const marsCache = new Map();
  function loadMarsTile(level, row, col) {
    const key = `${level}/${row}/${col}`;
    if (!marsCache.has(key)) {
      const url = body.sources[0].url.replace("{z}", level).replace("{y}", row).replace("{x}", col);
      marsCache.set(
        key,
        fetch(url)
          .then((r) => (r.ok ? r.arrayBuffer() : null))
          .then((b) => (b ? decodeLerc1(b).data : null))
          .catch(() => null),
      );
      if (marsCache.size > 120) marsCache.delete(marsCache.keys().next().value);
    }
    return marsCache.get(key);
  }

  function marsSeaLayer() {
    const Layer = L.GridLayer.extend({
      createTile(coords, done) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 512;
        const level = coords.z - 1;
        const cols = 2 ** (level + 1);
        if (level < 0 || coords.y < 0 || coords.y >= 2 ** level) {
          setTimeout(() => done(null, canvas));
          return canvas;
        }
        const col = ((coords.x % cols) + cols) % cols;
        loadMarsTile(level, coords.y, col).then((h) => {
          if (h) this.track(canvas, () => paintSea(canvas, h, sea.level));
          done(null, canvas);
        });
        return canvas;
      },
    });
    return withRepaint(new Layer({ tileSize: 512, minZoom: 1, maxNativeZoom: 8, maxZoom: 16, opacity: 0.85 }));
  }

  function updateSeaLayer() {
    if (body.id === "earth") {
      baseLayer?.repaint?.();
      return;
    }
    if (body.id !== "mars") return;
    if (sea.on && !seaLayer) seaLayer = marsSeaLayer().addTo(map);
    else if (!sea.on && seaLayer) {
      map.removeLayer(seaLayer);
      seaLayer = null;
    } else if (seaLayer) seaLayer.repaint();
  }

  function setSea(next) {
    const changed = next.on !== sea.on || next.level !== sea.level;
    sea = { ...next };
    if (changed && map) updateSeaLayer();
  }

  function setSelection(settings) {
    if (!map) return;
    const centreLng = map.getCenter().lng;
    const pts = footprint(settings).map(([lat, lon]) => [lat, unwrapLon(lon, centreLng)]);
    if (!outline) outline = L.polygon(pts, { color: "#6cb0f5", weight: 2, fillColor: "#4f9be8", fillOpacity: 0.16, interactive: false }).addTo(map);
    else outline.setLatLngs(pts);
  }

  function setPlaces(list) {
    markers.clearLayers();
    for (const p of list) {
      const m = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "poi-dot", iconSize: [10, 10] }), keyboard: false, title: p.name });
      m.bindTooltip(p.name, { className: "poi-tip", direction: "top", offset: [0, -6] });
      m.on("click", () => onPlace?.(p));
      m.addTo(markers);
    }
  }

  function centre() {
    const c = map.getCenter();
    return { lat: c.lat, lon: c.lng };
  }

  return {
    setBody,
    setLayer,
    setSea,
    setSelection,
    setPlaces,
    centre,
    kmForBox,
    zoomForKm,
    get map() {
      return map;
    },
    setView(lat, lon, zoom, animate = false) {
      if (animate) map.flyTo([lat, lon], zoom, { duration: 1.2 });
      else map.setView([lat, lon], zoom, { animate: false });
    },
    invalidate() {
      map?.invalidateSize({ animate: false });
    },
    visible() {
      const size = map?.getSize();
      return Boolean(size && size.x > 0 && size.y > 0);
    },
  };
}

// Hypsometric colours for land, by height above the sea, and a hillshade.
const LAND = [
  [0, [70, 128, 64]],
  [300, [120, 160, 86]],
  [900, [196, 186, 128]],
  [1800, [168, 128, 86]],
  [3200, [140, 112, 96]],
  [4800, [236, 236, 236]],
];
const FLOOR = [
  [0, [96, 116, 128]],
  [4000, [58, 70, 84]],
  [9000, [34, 40, 50]],
];

function ramp(stops, v) {
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      const t = (v - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t];
    }
  }
  return stops[stops.length - 1][1];
}

function paintRelief(canvas, h, z, sea, sunAzimuth) {
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(256, 256);
  // Slope = height change over two pixels; a pixel is about 156 543 / 2^z m
  // at the equator. A 1.3x lift close in, and more when zoomed out (where the
  // tiles are smoothed), keeps the relief readable at every zoom.
  const exaggerate = ((1.3 * 2 ** z) / (2 * 156543)) * (1 + Math.max(0, 9 - z) * 0.7);
  const az = (sunAzimuth * Math.PI) / 180;
  const lx = Math.sin(az) * Math.cos(Math.PI / 4);
  const ly = -Math.cos(az) * Math.cos(Math.PI / 4);
  const lz = Math.sin(Math.PI / 4);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const k = y * 256 + x;
      const v = h[k];
      const dx = (h[y * 256 + Math.min(255, x + 1)] - h[y * 256 + Math.max(0, x - 1)]) * exaggerate;
      const dy = (h[Math.min(255, y + 1) * 256 + x] - h[Math.max(0, y - 1) * 256 + x]) * exaggerate;
      const len = Math.hypot(dx, dy, 1);
      // Flat ground sits at 0.9; slopes facing the light go brighter.
      const shade = Math.min(1.2, Math.max(0.25, ((-dx * lx - dy * ly + lz) / len / lz) * 0.9));
      let c;
      if (sea.on && v < sea.level) {
        const depth = sea.level - v;
        const t = Math.min(1, depth / 4000);
        c = [44 + (14 - 44) * t, 110 + (45 - 110) * t, 178 + (110 - 178) * t];
        const s = 0.85 + 0.15 * shade;
        img.data[4 * k] = c[0] * s;
        img.data[4 * k + 1] = c[1] * s;
        img.data[4 * k + 2] = c[2] * s;
      } else {
        c = v < 0 && !sea.on ? ramp(FLOOR, -v) : ramp(LAND, v - (sea.on ? sea.level : 0));
        img.data[4 * k] = c[0] * shade;
        img.data[4 * k + 1] = c[1] * shade;
        img.data[4 * k + 2] = c[2] * shade;
      }
      img.data[4 * k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function paintSea(canvas, h, level) {
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const v = h[y * 513 + x];
      if (!(v < level)) continue;
      const t = Math.min(1, (level - v) / 3000);
      const k = 4 * (y * 512 + x);
      img.data[k] = 40 - 20 * t;
      img.data[k + 1] = 100 - 40 * t;
      img.data[k + 2] = 170 - 40 * t;
      img.data[k + 3] = 210;
    }
  }
  ctx.putImageData(img, 0, 0);
}
