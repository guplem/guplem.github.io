// Colour by height, for a printer with one nozzle: the slicer pauses at a
// chosen layer and the person swaps the filament. The sea is flat, so a sea
// in one colour and land in another is a single swap at the first layer above
// the water. A snow line adds a second swap.
//
// The same bands colour the 3D preview, so the preview shows the print.

/**
 * @param {object} o
 * @param {object} o.stats from buildHeights
 * @param {object} o.settings the design
 * @param {number} [o.layer=0.2] layer height, mm
 * @returns {{bands:{fromMm:number, colour:string, label:string}[], swaps:{atMm:number, layer:number, colour:string, label:string}[]}}
 *   `bands` start at 0 and are in height order; a swap happens at the
 *   bottom of every band after the first.
 */
export function colourPlan({ stats, settings, layer = 0.2 }) {
  const bands = [];
  const useSea = settings.seaOn && stats.anyWater && stats.seaZ !== null;
  if (useSea) {
    bands.push({ fromMm: 0, colour: settings.seaColour, label: "Sea" });
    // Land starts at the first layer boundary at or above the sea surface, so
    // the layer that holds the surface still prints in the sea colour.
    const at = Math.ceil(stats.seaZ / layer - 1e-6) * layer;
    bands.push({ fromMm: round(at), colour: settings.terrainColour, label: "Land" });
  } else {
    bands.push({ fromMm: 0, colour: settings.terrainColour, label: "Terrain" });
  }
  if (settings.snowOn && !stats.curved && stats.verticalMmPerMetre > 0) {
    const z = mmAtHeight(settings.snowLine, stats, settings);
    if (z > bands[bands.length - 1].fromMm + layer && z < stats.topMm) {
      bands.push({ fromMm: round(Math.round(z / layer) * layer), colour: settings.snowColour, label: "Snow" });
    }
  }
  const swaps = bands.slice(1).map((b) => ({ atMm: b.fromMm, layer: Math.round(b.fromMm / layer) + 1, colour: b.colour, label: b.label }));
  return { bands, swaps };
}

/** Print height (mm) of ground height `metres`, on land. */
export function mmAtHeight(metres, stats, settings) {
  const land = settings.seaOn && stats.anyWater ? stats.seaStepMm : 0;
  return settings.baseMm + (metres - stats.lowM) * stats.verticalMmPerMetre + land;
}

/**
 * The band colour of a surface at print height `z`. A surface exactly at a
 * band's start is the top of the band below (the flat sea is the top of the
 * last sea layer), so a band starts strictly above its `fromMm`.
 */
export function colourAt(bands, z) {
  let c = bands[0].colour;
  for (let i = 1; i < bands.length; i++) if (z > bands[i].fromMm + 1e-4) c = bands[i].colour;
  return c;
}

function round(v) {
  return Math.round(v * 1000) / 1000;
}
