import { Vector } from "./vector.js";

/**
 * Represents a particle in a 2D space.
 */
export class Particle {
  /**
   * Creates a new instance of the Particle class.
   *
   * @param {number} [mass=1] - The mass of the particle, affecting its physics properties.
   * @param {number} [charge=0] - The electric charge of the particle.
   * @param {number} [restitution=1] - Coefficient of restitution for elastic collisions.
   * @param {number} [radius=1] - The radius of the particle.
   * @param {string} [color="#0000ff"] - The fill color of the particle in hexadecimal format.
   * @param {boolean} [gradient=false] - If true, draw with a radial gradient; otherwise, use solid color.
   */
  constructor(mass = 1, charge = 0, restitution = 1, radius = 1, color = "#0000ff", gradient = false) {
    this.mass = mass;
    this.charge = charge;
    this.restitution = restitution;
    this.radius = radius;
    this.color = color;
    this.gradient = gradient;
    this.pos = new Vector(0, 0); // Initial position of the particle
    this.vel = new Vector(0, 0); // Initial velocity of the particle
  }

  /**
   * Draws the particle on the provided canvas context.
   *
   * @param {CanvasRenderingContext2D} space - The canvas rendering context where the particle will be drawn.
   */
  draw(space) {
    // If gradient is enabled, create a radial gradient
    if (this.gradient) {
      let grad = space.createRadialGradient(this.pos.x, this.pos.y, 0, this.pos.x, this.pos.y, this.radius);
      grad.addColorStop(0, "#ffffff"); // Center color
      grad.addColorStop(1, this.color); // Outer color
      space.fillStyle(grad); // Set the fill style to the gradient
    } else {
      space.fillStyle(this.color); // Set fill style to the solid color
    }

    // Draw the particle as a circle
    space.beginPath();
    space.arc(this.pos.x, this.pos.y, this.radius, 0, 2 * Math.PI, true);
    space.closePath();
    space.fill(); // Fill the circle
  }
}
