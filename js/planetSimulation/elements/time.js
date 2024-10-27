import { Vector } from "./vector.js";
import { Particle } from "./particle.js";

/**
 * The `Time` class provides methods for simulating time-based physics
 * calculations for particles, specifically using the Euler integration method.
 * This class allows for the calculation of a particle's position and velocity
 * based on applied forces over a specified time interval.
 */
export class Time {
  /**
   * Calculates the new position and velocity of a particle on which a force acts.
   * This method uses the Euler integration technique to update the particle's
   * velocity and position based on the applied force and the time step.
   *
   * @param {Particle} particle - The particle to update. It must have properties `pos` and `vel`, which are vectors.
   * @param {number} dt - The time step for the simulation (in seconds).
   * @param {Vector} force - The force applied to the particle, represented as a vector.
   */
  static euler(particle, dt, force) {
    // Update the particle's velocity based on the force and mass
    particle.vel.y += (force.y * dt) / particle.mass;
    particle.pos.y += particle.vel.y * dt; // Update the y position

    particle.vel.x += (force.x * dt) / particle.mass;
    particle.pos.x += particle.vel.x * dt; // Update the x position
  }
}
