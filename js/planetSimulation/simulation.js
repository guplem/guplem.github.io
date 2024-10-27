// Retrieve the canvas
var simCanvas = document.getElementById("simCanvas");

// Set the correct canvas size in the HTML
function setProperCanvasSize() {
  var presentation = document.getElementById("PresentationTextZone");
  var topHeight = presentation.offsetHeight;
  var topWidth = presentation.offsetWidth;
  simCanvas.height = topHeight;
  simCanvas.width = topWidth;
  // alert("topHeight = " + topHeight + ", topWidth = " + topWidth + " canvas: " + simCanvas.height + ", " + simCanvas.width);
}
setProperCanvasSize();

// Create the workspace
var space = new Espai(simCanvas, -5, 5, -5, 5);
var ctx = simCanvas.getContext("2d");

// Create the planets that will orbit
var planets = new Array();
for (var i = 0; i < 100; i++) {
  // Determine the radius of the planet
  var particleRadius = Math.random() / 5;
  planets.push(new Particula(1, 0, 0, particleRadius, "#c2dde6", true));

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

// Create the force of gravity
var g = new Gravitacio();

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

function onEachStep() {
  // Advance time by calculating new positions and velocities
  for (var i = 0; i < 100; i++) {
    Temps.euler(planets[i], 1 / 60, g.force(planets[i]));
  }

  space.clear();
  for (var i = 0; i < 100; i++) {
    planets[i].draw(space);
  }

  // Draw text
  /* ctx.font = "30px Arial";
     ctx.fillStyle = "red";
     ctx.textAlign = "center";
     ctx.fillText("Hello World", simCanvas.width / 2, simCanvas.height / 2); */
}
