function Vector(x, y) {
  this.x = x;
  this.y = y;

  // Object methods

  (this.norm = function () {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }),
    (this.opposite = function () {
      return new Vector(-this.x, -this.y);
    }),
    (this.normalize = function () {
      var norm = this.norm();
      return new Vector(this.x / norm, this.y / norm);
    }),
    // Static methods

    (Vector.add = function (vec1, vec2) {
      return new Vector(vec1.x + vec2.x, vec1.y + vec2.y);
    });
  Vector.scale = function (vec, k) {
    return new Vector(k * vec.x, k * vec.y);
  };
  Vector.subtract = function (vec1, vec2) {
    return new Vector(vec1.x - vec2.x, vec1.y - vec2.y);
  };
  Vector.distance = function (vec1, vec2) {
    return Vector.subtract(vec1, vec2).norm();
  };
  Vector.scalar = function (vec1, vec2) {
    return vec1.x * vec2.x + vec1.y * vec2.y;
  };
  Vector.angle = function (vec1, vec2) {
    return Math.acos(Vector.scalar(vec1, vec2) / (vec1.norm() * vec2.norm()));
  };
}
