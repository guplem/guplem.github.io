import { Space } from "./elements/space.js";
import { Particle } from "./elements/particle.js";
import { Vector } from "./elements/vector.js";
import { Gravity } from "./elements/gravity.js";
import { Time } from "./elements/time.js";

// Get the area to get the correct canvas size
const area = document.getElementById("introduction");
// Get the canvas element
const simCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById("simCanvas"));

setProperCanvasSize();

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
export function setProperCanvasSize() {
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

// Create the workspace
var space = new Space(simCanvas, -5, 5, -5, 5);

// Create the planets that will orbit
var planets = new Array();
for (var i = 0; i < 100; i++) {
  // Determine the radius of the planet
  var particleRadius = Math.random() / 5;
  planets.push(new Particle(1, 0, 0, particleRadius, "#c2dde6", true));

  // Determine the radius of the orbit
  var orbitRadius = Math.random() * 3.5 + 0.5;

  // Determine the planet's speed
  var variation = 0.4;
  var vel = Math.sqrt(1 / orbitRadius) + Math.random() * variation - variation / 2;

  // Determine the initial position and adjust the planet's speed
  var initPos = new Vector(orbitRadius, 0);
  if (Math.random() >= 0.5) {
    initPos = new Vector(-orbitRadius, 0);
    vel = -vel;
  }

  planets[i].pos = initPos;
  planets[i].vel = new Vector(0, vel);
}

// This was the previous way of initializing the simulation, but it took too long since it waited for all images to load
// window.onload = init;

// This is the new way of initializing the simulation; it just waits for the DOM to be fully loaded
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM fully loaded and parsed. Initializing simulation...");
  init();
});

function init() {
  setInterval(onEachStep, 1000 / 60); // 60 fps
}

// Create the force of gravity
var g = new Gravity();

function onEachStep() {
  // Advance time by calculating new positions and velocities
  for (var i = 0; i < 100; i++) {
    Time.euler(planets[i], 1 / 60, g.force(planets[i]));
  }

  space.clear();
  for (var i = 0; i < 100; i++) {
    planets[i].draw(space);
  }
}
