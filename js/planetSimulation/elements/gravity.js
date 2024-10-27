import { Vector } from "./vector.js";

/**
 * Class representing gravitational force calculations.
 */
export class Gravity {
  /**
   * Creates an instance of Gravity.
   */
  constructor() {
    /**
     * Calculates the gravitational force on a planet.
     * @param {Object} planet - The planet object.
     * @param {Vector} planet.pos - The position vector of the planet.
     * @param {number} planet.mass - The mass of the planet.
     * @returns {Vector} The gravitational force vector.
     */
    this.force = function (planet) {
      return Vector.scale(planet.pos, -planet.mass / Math.pow(planet.pos.norm(), 3));
    };
  }
}
