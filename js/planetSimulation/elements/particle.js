// DEPENDENCIES: Vector, Space

function Particle(mass, charge, restitution, radius, color, gradient) {
  if (typeof mass === "undefined") mass = 1;
  if (typeof charge === "undefined") charge = 0;
  if (typeof restitution === "undefined") restitution = 1;
  if (typeof radius === "undefined") radius = 1;
  if (typeof color === "undefined") color = "#0000ff";
  if (typeof gradient === "undefined") gradient = false;

  this.mass = mass;
  this.charge = charge;
  this.restitution = restitution;
  this.radius = radius;
  this.color = color;
  this.gradient = gradient;
  this.pos = new Vector(0, 0);
  this.vel = new Vector(0, 0);

  // METHODS

  this.draw = function (space) {
    if (this.gradient) {
      grad = space.createRadialGradient(this.pos.x, this.pos.y, 0, this.pos.x, this.pos.y, this.radius);
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
  };
}
