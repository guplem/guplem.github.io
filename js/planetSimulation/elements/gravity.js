import { Vector } from "./vector.js";

export class Gravity {
  constructor() {
    this.force = function (planet) {
      return Vector.scale(planet.pos, -planet.mass / Math.pow(planet.pos.norm(), 3));
    };
  }
}
