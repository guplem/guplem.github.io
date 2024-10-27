export class Vector {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  // Instance methods
  norm() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  opposite() {
    return new Vector(-this.x, -this.y);
  }

  normalize() {
    const norm = this.norm();
    return new Vector(this.x / norm, this.y / norm);
  }

  // Static methods
  static add(vec1, vec2) {
    return new Vector(vec1.x + vec2.x, vec1.y + vec2.y);
  }

  static scale(vec, k) {
    return new Vector(k * vec.x, k * vec.y);
  }

  static subtract(vec1, vec2) {
    return new Vector(vec1.x - vec2.x, vec1.y - vec2.y);
  }

  static distance(vec1, vec2) {
    return Vector.subtract(vec1, vec2).norm();
  }

  static scalar(vec1, vec2) {
    return vec1.x * vec2.x + vec1.y * vec2.y;
  }

  static angle(vec1, vec2) {
    return Math.acos(Vector.scalar(vec1, vec2) / (vec1.norm() * vec2.norm()));
  }
}
