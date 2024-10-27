const Time = {};

// STATIC METHODS
// Calculates the new position and velocity of a particle on which
// a force acts for a time dt
Time.euler = function (particle, dt, force) {
  particle.vel.y += (force.y * dt) / particle.mass;
  particle.pos.y += particle.vel.y * dt;
  particle.vel.x += (force.x * dt) / particle.mass;
  particle.pos.x += particle.vel.x * dt;
};

export { Time };
