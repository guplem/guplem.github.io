// Both modes hand the page the same fire shape, so app.js draws one kind of fire:
// { id, name, lat, lon, frp, confidence, firstSeen, lastSeen, active,
//   crossChecked, crossText, weather, town, radiusKm?, detections?, mtg?, ageMin? }

import { FIRES } from "./mockData.js";
import { clusterDetections, isActive } from "./cluster.js";
import { sourceByKey } from "./firms.js";

/** A town further away than this does not name the fire. */
const NAME_TOWN_KM = 15;

export const MODE_CONFIG = {
  demo: { pastSteps: [-3, -1] },
  real: { pastSteps: [-24, -12] },
};

export function demoFires(now) {
  return FIRES.map((f) => ({
    ...f,
    firstSeen: now - f.ageMin * 60_000,
    lastSeen: now - 60_000,
    active: true,
    crossChecked: f.mtg.confirmed,
    crossText: f.mtg.confirmed ? `Confirmed by MTG ${f.mtg.minAgo} min ago` : "Not yet confirmed by MTG",
    town: null,
  }));
}

export function satelliteText(sources) {
  const names = sources.map((key) => {
    const s = sourceByKey(key);
    return s ? `${s.satellite} (${s.sensor})` : key;
  });
  return sources.length >= 2
    ? `Seen by ${sources.length} satellites: ${names.join(", ")}`
    : `Seen by one satellite only: ${names[0]}`;
}

const position = ({ lat, lon }) =>
  `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(3)}° ${lon >= 0 ? "E" : "W"}`;

/**
 * @param detections FIRMS detections from the feed
 * @param findTown a `nearestIndex` over the feed's places
 */
export function realFires(detections, now, findTown) {
  return clusterDetections(detections).map((fire) => {
    const town = findTown(fire, NAME_TOWN_KM);
    return {
      ...fire,
      name: town ? `Near ${town.item.name}` : `Hotspot at ${position(fire)}`,
      town,
      active: isActive(fire, now),
      crossText: satelliteText(fire.sources),
      weather: null,
    };
  });
}

export function inBounds(p, b) {
  return p.lat >= b.south && p.lat <= b.north && p.lon >= b.west && p.lon <= b.east;
}
