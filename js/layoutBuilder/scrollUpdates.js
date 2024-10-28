import { updateCentralPoint } from "../planetSimulation/simulation.js";

window.addEventListener("scroll", function () {
  const scrollTop = window.scrollY;

  updateCentralPoint(0, -scrollTop / window.innerHeight);
});
