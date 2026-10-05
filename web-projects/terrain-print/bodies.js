// The three worlds: their size, where their heights come from, what the map
// shows, and the sea each one can have. Every URL here was checked by hand
// for CORS (the browser must be allowed to read the bytes) on 2026-10-05.
//
// Sources are listed in the order the app tries them. A source is one of:
//   esri:      Esri elevation tile cache, 513 x 513 LERC 1 tiles in plate
//              carrée, level 0 = 0.3515625 degrees per pixel, 2 x 1 tiles.
//              Sample (i, j) of tile (row, col) sits at
//              lon = -180 + (col * 512 + i) * res, lat = 90 - (row * 512 + j) * res.
//   terrarium: AWS Terrain Tiles, 256 px PNG in Web Mercator,
//              height = R * 256 + G + B / 256 - 32768 metres.
//   strip:     a USGS GeoTIFF stored one uncompressed int16 row per strip,
//              read with HTTP range requests. Pixel (col, row) is centred at
//              lon = -180 + (col + 0.5) / ppd, lat = 90 - (row + 0.5) / ppd.
// `calibrateAgainst` names a strip source that a tiled copy is checked
// against before use: a copy of the Moon heights on ArcGIS Online stores them
// doubled, so no copy is trusted until its ratio to the NASA file is measured.

import { EARTH_SEA_PRESETS, MARS_SHORELINES } from "./places.js";

const TREK = "https://trek.nasa.gov/tiles";

export const BODIES = {
  moon: {
    id: "moon",
    name: "Moon",
    tagline: "Our Moon",
    radius: 1737400,
    projection: "plate",
    view: { lat: -20, lon: -10, zoom: 2 },
    sources: [
      {
        id: "esri-lola-kaguya",
        kind: "esri",
        label: "LRO LOLA and SELENE Kaguya terrain, served by Esri",
        url: "https://astro.arcgis.com/arcgis/rest/services/OnMoon/LOLA_Kaguya/ImageServer/tile/{z}/{y}/{x}",
        maxLevel: 8,
        calibrateAgainst: "usgs-lola-118m",
      },
      {
        id: "lola-tile-copy",
        kind: "esri",
        label: "LRO LOLA terrain, a tiled copy on ArcGIS Online",
        url: "https://tiles.arcgis.com/tiles/lqRTrQp2HrfnJt8U/arcgis/rest/services/Lunar_LRO_LOLA_Elevation_GCSMoon2000/ImageServer/tile/{z}/{y}/{x}",
        maxLevel: 6,
        calibrateAgainst: "usgs-lola-118m",
      },
      {
        id: "usgs-lola-kaguya-59m",
        kind: "strip",
        label: "LRO LOLA and SELENE Kaguya merged terrain, 59 m (NASA / JAXA via USGS)",
        url: "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/LolaKaguya_Topo/Lunar_LRO_LOLAKaguya_DEMmerge_60N60S_512ppd.tif",
        width: 184320,
        height: 61440,
        ppd: 512,
        latTop: 60,
        dataOffset: 984003,
        scale: 0.5,
        noData: null,
      },
      {
        id: "usgs-lola-118m",
        kind: "strip",
        label: "LRO LOLA global terrain, 118 m (NASA via USGS)",
        url: "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif",
        width: 92160,
        height: 46080,
        ppd: 256,
        latTop: 90,
        dataOffset: 738233,
        scale: 0.5,
        noData: null,
      },
    ],
    layers: [
      {
        id: "photo",
        name: "Photo",
        url: `${TREK}/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`,
        maxNativeZoom: 8,
        attribution: "LRO WAC mosaic: NASA / GSFC / Arizona State University, via NASA Moon Trek",
      },
      {
        id: "relief",
        name: "Height colours",
        url: `${TREK}/Moon/EQ/LRO_LOLA_ClrShade_Global_128ppd_v04/1.0.0/default/default028mm/{z}/{y}/{x}.png`,
        maxNativeZoom: 5,
        attribution: "LOLA colour shaded relief: NASA / GSFC, via NASA Moon Trek",
      },
    ],
    sea: null,
    colours: { terrain: "moon-grey", frame: "charcoal" },
  },

  mars: {
    id: "mars",
    name: "Mars",
    tagline: "Red planet",
    radius: 3396190,
    projection: "plate",
    view: { lat: 0, lon: -100, zoom: 2 },
    sources: [
      {
        id: "esri-hrsc-mola",
        kind: "esri",
        label: "MGS MOLA and Mars Express HRSC blended terrain, 200 m (USGS), served by Esri",
        url: "https://astro.arcgis.com/arcgis/rest/services/OnMars/MDEM200M/ImageServer/tile/{z}/{y}/{x}",
        maxLevel: 7,
        scale: 1,
      },
      {
        id: "usgs-mola-463m",
        kind: "strip",
        label: "MGS MOLA global terrain, 463 m (NASA via USGS)",
        url: "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif",
        width: 46080,
        height: 23040,
        ppd: 128,
        latTop: 90,
        dataOffset: 184973,
        scale: 1,
        noData: -32768,
      },
    ],
    layers: [
      {
        id: "colour",
        name: "Colour",
        url: `${TREK}/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`,
        maxNativeZoom: 7,
        attribution: "Viking MDIM 2.1 colour mosaic: NASA / USGS, via NASA Mars Trek",
      },
      {
        id: "relief",
        name: "Height colours",
        url: `${TREK}/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`,
        maxNativeZoom: 7,
        attribution: "MOLA colour shaded relief: NASA / GSFC, via NASA Mars Trek",
      },
    ],
    sea: {
      defaultOn: false,
      level: MARS_SHORELINES[0].elevation,
      flood: "all",
      presets: MARS_SHORELINES,
      min: -8000,
      max: 4000,
    },
    colours: { terrain: "mars-red", frame: "charcoal", sea: "ocean-blue" },
  },

  earth: {
    id: "earth",
    name: "Earth",
    tagline: "Home",
    radius: 6371008.8,
    projection: "mercator",
    view: { lat: 41.5, lon: 2, zoom: 5 },
    sources: [
      {
        id: "terrarium",
        kind: "terrarium",
        label: "AWS Terrain Tiles (SRTM, NED, ETOPO1, GEBCO and more, via Mapzen)",
        url: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
        maxZoom: 15,
      },
    ],
    layers: [
      { id: "relief", name: "Relief", computed: true, attribution: "Relief drawn from AWS Terrain Tiles (Mapzen, SRTM, GEBCO and others)" },
      {
        id: "streets",
        name: "Street map",
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        maxNativeZoom: 19,
        attribution: "© OpenStreetMap contributors",
      },
    ],
    sea: {
      defaultOn: true,
      level: 0,
      flood: "connected",
      presets: EARTH_SEA_PRESETS,
      min: -6000,
      max: 3000,
    },
    colours: { terrain: "forest-green", frame: "charcoal", sea: "ocean-blue" },
  },
};

export const BODY_IDS = Object.keys(BODIES);

/** Degrees per sample of an Esri elevation cache at `level`. */
export function esriResolution(level) {
  return 0.3515625 / 2 ** level;
}

/** Ground size in metres of one sample of `source` at its finest, near the equator. */
export function finestResolution(source, radius) {
  const perDeg = (Math.PI * radius) / 180;
  if (source.kind === "esri") return esriResolution(source.maxLevel) * perDeg;
  if (source.kind === "strip") return perDeg / source.ppd;
  if (source.kind === "terrarium") return (2 * Math.PI * radius) / (256 * 2 ** source.maxZoom);
  throw new Error(`Unknown source kind ${source.kind}`);
}
