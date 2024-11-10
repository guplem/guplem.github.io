import { Space } from "./elements/space.js";
import { Particle } from "./elements/particle.js";
import { Vector } from "./elements/vector.js";
import { Gravity } from "./elements/gravity.js";
import { Time } from "./elements/time.js";

// Get the area to get the correct canvas size
const area = document.getElementById("introduction");
// Get the canvas element
const simCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById("simCanvas"));

// Declare the uninitialized variables
let space;
let simulationInterval;

const spaceSize = new Vector(10, 10);
const planetsQuantityTarget = 120;

// define the central point of attraction.
let attractionPoints = [
  new Vector(0, 0),
  // No need to create them if they are desired to be generated upon "update of the location", so it becomes a 2 or 3 body problem instead of 1 on the fly
  // new Vector(0, 0),
  // new Vector(0, 0)
];

// Create the force of gravity
const gravity = new Gravity();

// Create the array of planets
const planets = new Array();

/**
 * Initializes the planet simulation.
 *
 * This function performs the following tasks:
 * 1. Stops any existing simulation interval.
 * 2. Sets the proper size for the canvas.
 * 3. (Re)Initializes the space with the new size/boundaries.
 * 4. Starts a new simulation interval running at 60 frames per second.
 */
export function init() {
  clearInterval(simulationInterval);
  setProperCanvasSize();
  space = new Space(simCanvas, -spaceSize.x / 2, spaceSize.x / 2, -spaceSize.y / 2, spaceSize.y / 2);
  simulationInterval = setInterval(onEachStep, 1000 / 60); // 60 fps
}

/**
 * Sets the canvas size to match the dimensions of the area element.
 *
 * This function adjusts the height and width of the canvas element to match
 * the offsetHeight and offsetWidth of the area element. It throws an error
 * if either the area or the canvas element is not found.
 *
 * @throws {Error} If the area element (div with id "introduction") is not found.
 * @throws {Error} If the canvas element (canvas with id "simCanvas") is not found.
 */
function setProperCanvasSize() {
  if (area === null || area === undefined) {
    throw new Error(`Area to draw the simulation (div with id "introduction") not found`);
  }

  if (simCanvas === null || simCanvas === undefined) {
    throw new Error(`Canvas element (canvas with id "simCanvas") not found`);
  }

  simCanvas.height = area.offsetHeight;
  simCanvas.width = area.offsetWidth;

  // console.log("Canvas size set to match the dimensions of the area element: ", simCanvas.width, " x ", simCanvas.height);
}

/**
 * Creates a set of planets for the simulation.
 *
 * This function clears any previously created planets and generates 100 new planets.
 * Each planet is assigned a random radius, orbit radius, and speed. The initial position
 * and velocity of each planet are also determined randomly.
 *
 * The planets are stored in the global `planets` array.
 *
 * @param {number} [planetsPerIteration=0] - How many planets to create per iteration, set to 0 to create all at once.
 */
function createPlanets(planetsPerIteration = 0) {
  // clear previoulsy created planets if desired to (re) create all of them
  if (planetsPerIteration <= 0) {
    console.log("Clearing previously created planets: ", planets.length);
    planets.length = 0;
  }

  let qttyToGenerate = planetsPerIteration > 0 ? planetsPerIteration : planetsQuantityTarget;

  // Ensure the target is not exceeded
  qttyToGenerate = Math.min(qttyToGenerate, planetsQuantityTarget - planets.length);

  for (let p = 0; p < qttyToGenerate; p++) {
    // Determine the radius of the planet
    let particleRadius = Math.random() / 5;
    // Create the planet
    planets.push(new Particle(1, 0, 0, particleRadius, "#c2dde6", true));

    // Determine the radius of the orbit
    let orbitRadius = Math.random() * 3.5 + 0.5;

    // Determine the planet's vertical speed
    let variation = 0.4;
    let verticalSpeed = Math.sqrt(1 / orbitRadius) + Math.random() * variation - variation / 2;

    // Determine the initial position and adjust the planet's speed
    let initPos = new Vector(orbitRadius, 0);
    if (Math.random() >= 0.5) {
      initPos = new Vector(-orbitRadius, 0);
      verticalSpeed = -verticalSpeed;
    }

    // Set the planet's position and speed
    planets[planets.length - 1].position = initPos;
    planets[planets.length - 1].velocity = new Vector(0, verticalSpeed);
  }
}

/**
 * Advances the simulation by one step.
 *
 * This function updates the positions and velocities of the planets
 * using Euler's method and then redraws them on the space canvas.
 *
 * The simulation assumes there are 100 planets.
 *
 * @function
 */
function onEachStep() {
  // create 2 planets per iteration until the target is reached
  createPlanets(3);

  // // Ensure no planets are going too far outside the boundaries
  // const limit = 1; // 1 means just the edge, 2 means twice the edge, 0.5 means half the edge
  // for (let p = 0; p < planets.length; p++) {
  //   if (Math.abs(planets[p].position.x) > spaceSize.x / (2 / limit) || Math.abs(planets[p].position.y) > spaceSize.y / (2 / limit)) {
  //     // If they are going too fast, reset their velocity
  //     if (planets[p].velocity.magnitude() > 0.75) {
  //       planets[p].velocity = Vector.scale(planets[p].velocity, 0.95);
  //     }
  //   }
  // }

  // Advance time by calculating new positions and velocities
  for (let p = 0; p < planets.length; p++) {
    const planetForces = [];
    for (let a = 0; a < attractionPoints.length; a++) {
      planetForces.push(gravity.forceToAttractionPoint(planets[p], attractionPoints[a]));
    }

    // Calculate the total force acting on the planet
    let totalForce = new Vector(0, 0);
    for (let j = 0; j < planetForces.length; j++) {
      totalForce = Vector.add(totalForce, planetForces[j]);
    }

    Time.euler(planets[p], 1 / 60, totalForce);
  }

  // // Ensure no planets are going too fast (smooth visuals, bad physics)
  // const speedLimit = 1.5;
  // for (let p = 0; p < planets.length; p++) {
  //   // If they are going too fast, set their speed to the speed limit, mantaining the direction
  //   if (planets[p].velocity.magnitude() > speedLimit) {
  //     planets[p].velocity = planets[p].velocity.normalized().scale(speedLimit);
  //   }
  // }

  space.clear();
  for (let p = 0; p < planets.length; p++) {
    planets[p].draw(space);
  }

  // Draw the central points of attraction (debugging)
  for (let a = 0; a < attractionPoints.length; a++) {
    // space.drawPoint(attractionPoints[a], "#f7ded1");
  }
}

/**
 * Updates the central point of attraction.
 * Given a value between -1 and 1 for both x and y, this function updates the central point of attraction.
 * The new value will be within the boundaries of the space.
 *
 * @param {number} index - The index of the central point to update.
 * @param {number} newX - The new position of the central point along the x-axis.
 * @param {number} newY - The new position of the central point along the y-axis.
 */
export function updateCentralPoint(index, newX, newY) {
  // Ensure they are clamped to -1 and 1
  newX = Math.min(1, Math.max(-1, newX));
  newY = Math.min(1, Math.max(-1, newY));

  // Update the central point
  attractionPoints[index] = new Vector((newX * spaceSize.x) / 2, (newY * spaceSize.y) / 2);
}
