/**
 * The `Vector` class represents a 2D vector and provides methods
 * for vector arithmetic and operations. This class allows for
 * calculations such as vector addition, subtraction, normalization,
 * and finding angles between vectors.
 */
export class Vector {
  /**
   * Creates a new instance of the Vector class.
   *
   * @param {number} x - The x-coordinate of the vector.
   * @param {number} y - The y-coordinate of the vector.
   */
  constructor(x, y) {
    this.x = x; // The x component of the vector
    this.y = y; // The y component of the vector
  }

  /**
   * Calculates the magnitude (norm) of the vector.
   *
   * @returns {number} The magnitude of the vector.
   */
  norm() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Returns a new vector that is the opposite of this vector.
   *
   * @returns {Vector} A new vector with inverted components.
   */
  opposite() {
    return new Vector(-this.x, -this.y);
  }

  /**
   * Normalizes the vector, returning a new vector with a magnitude of 1.
   *
   * @returns {Vector} A new normalized vector.
   */
  normalize() {
    const norm = this.norm();
    return new Vector(this.x / norm, this.y / norm);
  }

  // Static methods

  /**
   * Adds two vectors and returns a new vector.
   *
   * @param {Vector} vec1 - The first vector.
   * @param {Vector} vec2 - The second vector.
   * @returns {Vector} The resulting vector from the addition.
   */
  static add(vec1, vec2) {
    return new Vector(vec1.x + vec2.x, vec1.y + vec2.y);
  }

  /**
   * Scales a vector by a scalar factor and returns a new vector.
   *
   * @param {Vector} vec - The vector to scale.
   * @param {number} k - The scalar factor.
   * @returns {Vector} The scaled vector.
   */
  static scale(vec, k) {
    return new Vector(k * vec.x, k * vec.y);
  }

  /**
   * Subtracts one vector from another and returns a new vector.
   *
   * @param {Vector} vec1 - The vector to subtract from.
   * @param {Vector} vec2 - The vector to subtract.
   * @returns {Vector} The resulting vector from the subtraction.
   */
  static subtract(vec1, vec2) {
    return new Vector(vec1.x - vec2.x, vec1.y - vec2.y);
  }

  /**
   * Calculates the distance between two vectors.
   *
   * @param {Vector} vec1 - The first vector.
   * @param {Vector} vec2 - The second vector.
   * @returns {number} The distance between the two vectors.
   */
  static distance(vec1, vec2) {
    return Vector.subtract(vec1, vec2).norm();
  }

  /**
   * Calculates the scalar (dot) product of two vectors.
   *
   * @param {Vector} vec1 - The first vector.
   * @param {Vector} vec2 - The second vector.
   * @returns {number} The scalar product of the two vectors.
   */
  static scalar(vec1, vec2) {
    return vec1.x * vec2.x + vec1.y * vec2.y;
  }

  /**
   * Calculates the angle (in radians) between two vectors using the
   * dot product and magnitudes.
   *
   * @param {Vector} vec1 - The first vector.
   * @param {Vector} vec2 - The second vector.
   * @returns {number} The angle between the two vectors in radians.
   */
  static angle(vec1, vec2) {
    return Math.acos(Vector.scalar(vec1, vec2) / (vec1.norm() * vec2.norm()));
  }
}
