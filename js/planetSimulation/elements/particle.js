import { Vector } from "./vector.js";

export class Particle {
  constructor(mass = 1, charge = 0, restitution = 1, radius = 1, color = "#0000ff", gradient = false) {
    this.mass = mass;
    this.charge = charge;
    this.restitution = restitution;
    this.radius = radius;
    this.color = color;
    this.gradient = gradient;
    this.pos = new Vector(0, 0);
    this.vel = new Vector(0, 0);
  }

  draw(space) {
    if (this.gradient) {
      let grad = space.createRadialGradient(this.pos.x, this.pos.y, 0, this.pos.x, this.pos.y, this.radius);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(1, this.color);
      space.fillStyle(grad);
    } else {
      space.fillStyle(this.color);
    }
    space.beginPath();
    space.arc(this.pos.x, this.pos.y, this.radius, 0, 2 * Math.PI, true);
    space.closePath();
    space.fill();
  }
}
