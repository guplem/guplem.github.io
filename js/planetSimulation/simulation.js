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

// define the central point of attraction.
let centralPoint = new Vector(0, 0);

// Create the force of gravity
const gravity = new Gravity();

// Create the array of planets
const planets = new Array();
createPlanets();

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
 */
function createPlanets() {
  // clear previoulsy created planets
  planets.length = 0;

  for (let i = 0; i < 100; i++) {
    // Determine the radius of the planet
    let particleRadius = Math.random() / 5;
    // Create the planet
    planets.push(new Particle(1, 0, 0, particleRadius, "#c2dde6", true));

    // Determine the radius of the orbit
    let orbitRadius = Math.random() * 3.5 + 0.5;

    // Determine the planet's speed
    let variation = 0.4;
    let vel = Math.sqrt(1 / orbitRadius) + Math.random() * variation - variation / 2;

    // Determine the initial position and adjust the planet's speed
    let initPos = new Vector(orbitRadius, 0);
    if (Math.random() >= 0.5) {
      initPos = new Vector(-orbitRadius, 0);
      vel = -vel;
    }

    // Set the planet's position and speed
    planets[i].position = initPos;
    planets[i].velocity = new Vector(0, vel);
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
  // Advance time by calculating new positions and velocities
  for (let i = 0; i < 100; i++) {
    Time.euler(planets[i], 1 / 60, gravity.forceToAttractionPoint(planets[i], centralPoint));
  }

  space.clear();
  for (let i = 0; i < 100; i++) {
    planets[i].draw(space);
  }

  space.drawPoint(centralPoint, "#f7ded1");
}

/**
 * Updates the central point of attraction.
 * Given a value between -1 and 1 for both x and y, this function updates the central point of attraction.
 * The new value will be within the boundaries of the space.
 *
 * @param {number} newX - The new position of the central point along the x-axis.
 * @param {number} newY - The new position of the central point along the y-axis.
 */
export function updateCentralPoint(newX, newY) {
  // Ensure they are clamped to -1 and 1
  newX = Math.min(1, Math.max(-1, newX));
  newY = Math.min(1, Math.max(-1, newY));

  // Update the central point
  centralPoint = new Vector((newX * spaceSize.x) / 2, (newY * spaceSize.y) / 2);
}
