// DEPENDENCIES: Particle
import { Particle } from "./particle.js";
import { Vector } from "./vector.js";

export function Gravity() {
  this.force = function (planet) {
    return Vector.scale(planet.pos, -planet.mass / Math.pow(planet.pos.norm(), 3));
  };
}
