import { Vector } from "./vector.js";
import { Particle } from "./particle.js";

/**
 * Class representing gravitational force calculations.
 */
export class Gravity {
  /**
   * Creates an instance of Gravity.
   */
  constructor() {
    /**
     * Calculates the gravitational force on a planet towards the center of the coordinate system.
     * @param {Particle} planet - The planet object.
     * @returns {Vector} The gravitational force vector.
     */
    this.forceToCenter = function (planet) {
      return Vector.scale(planet.position, -planet.mass / Math.pow(planet.position.norm(), 3));
    };

    /**
     * Calculates the gravitational force on a planet towards a point of attraction.
     * @param {Particle} planet - The planet object.
     * @param {Vector} attractionPoint - The point of attraction.
     * @returns {Vector} The gravitational force vector.
     */
    this.forceToAttractionPoint = function (planet, attractionPoint) {
      // Calculate the vector from the attraction point to the planet
      const direction = Vector.subtract(planet.position, attractionPoint);
      // const direction = Vector.subtract(attractionPoint, planet.position);
      const distance = direction.norm();

      // Avoid division by zero
      if (distance === 0) {
        console.warn("Distance is zero, cannot calculate gravitational force.");
        return new Vector(0, 0);
      }

      // Calculate gravitational force
      return Vector.scale(direction, -planet.mass / Math.pow(distance, 3));
    };
  }
}
