import { updateCentralPoint } from "../planetSimulation/simulation.js";

window.addEventListener("scroll", function () {
  const scrollTop = window.scrollY;

  // 1 BODY
  // updateCentralPoint(0, 0, -scrollTop / window.innerHeight / 1.5);

  // 2 BODY
  // updateCentralPoint(1, 0, -scrollTop / window.innerHeight);

  // 3 BODY
  // updateCentralPoint(1, -scrollTop / window.innerHeight, -scrollTop / window.innerHeight);
  // updateCentralPoint(2, scrollTop / window.innerHeight, -scrollTop / window.innerHeight);
});
