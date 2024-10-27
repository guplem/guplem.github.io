/**
 * A framework for creating and managing a 2D simulation canvas.
 * It allows users to draw axes, grids, and plot data points on a canvas, translating
 * physical coordinates into pixel values for visual representation.
 *
 * This class manages the canvas context, scaling factors, and origin for the
 * coordinate system, enabling customizable visualizations for simulations or graphs.
 *
 * It can be configured with properties such as axis labels, grid spacing, and plot colors,
 * making it a versatile tool for visual data representation.
 */
export class Space {
  /**
   * Creates a new instance of the Space class for drawing a simulation.
   *
   * @param {HTMLCanvasElement} simCanvas - The canvas element where the simulation will be drawn.
   * @param {number} xmin - The minimum x-coordinate in physical units.
   * @param {number} xmax - The maximum x-coordinate in physical units.
   * @param {number} ymin - The minimum y-coordinate in physical units.
   * @param {number} ymax - The maximum y-coordinate in physical units.
   * @param {string} [xlabel="x"] - The label for the x-axis.
   * @param {string} [ylabel="y"] - The label for the y-axis.
   */
  constructor(simCanvas, xmin, xmax, ymin, ymax, xlabel, ylabel) {
    // Set default axis labels if not provided
    if (typeof xlabel === "undefined") xlabel = "x";
    if (typeof ylabel === "undefined") ylabel = "y";

    // VARIABLE DECLARATION
    // Get the context of the simulation canvas for drawing
    var context = simCanvas.getContext("2d");
    // Store the overall width and height of the canvas in pixels
    var x_width = simCanvas.width;
    var y_width = simCanvas.height;

    // Calculate scaling factors for displaying values on the axes
    var x_scal = (xmax - xmin) / x_width;
    var y_scal = (ymax - ymin) / y_width;

    // Calculate the location of the origin in pixels
    var x_orig = -xmin / x_scal;
    var y_orig = y_width + ymin / y_scal;

    // Width and height of text box used for displaying values on the axes
    var tw = 15; // Text width
    var th = 20; // Text height
    var txpos = x_orig - tw; // X position for text
    var typos = y_orig; // Y position for text
    var x_label = xlabel; // X-axis label
    var y_label = ylabel; // Y-axis label

    // METHODS
    // Methods to delegate drawing functionality to the canvas context
    this.strokeStyle = function (st) {
      context.strokeStyle = st; // Set stroke style
    };
    this.lineWidth = function (lw) {
      context.lineWidth = lw; // Set line width
    };
    this.stroke = function () {
      context.stroke(); // Execute stroke operation
    };
    this.fillStyle = function (color) {
      context.fillStyle = color; // Set fill style
    };
    this.beginPath = function () {
      context.beginPath(); // Begin a new path
    };
    this.moveTo = function (posx, posy) {
      // Move to specified position, adjusted for origin and scaling
      context.moveTo(x_orig + posx / x_scal, y_orig - posy / y_scal);
    };
    this.lineTo = function (posx, posy) {
      // Draw a line to the specified position, adjusted for origin and scaling
      context.lineTo(x_orig + posx / x_scal, y_orig - posy / y_scal);
    };
    this.arc = function (posx, posy, rad, angi, angf, bool) {
      // Draw an arc with specified parameters, adjusted for origin and scaling
      context.arc(x_orig + posx / x_scal, y_orig - posy / y_scal, rad / y_scal, angi, angf, bool);
    };
    this.closePath = function () {
      context.closePath(); // Close the current path
    };
    this.fill = function () {
      context.fill(); // Fill the current path
    };
    this.createRadialGradient = function (xi, yi, radi1, xf, yf, radi2) {
      // Create a radial gradient
      return context.createRadialGradient(xi, yi, radi1, xf, yf, radi2);
    };
    this.clear = function () {
      context.clearRect(0, 0, x_width, y_width); // Clear the canvas
    };

    // DRAW AXES: Draw axes and labels on the canvas
    this.drawaxes = function () {
      context.strokeStyle = "#000000"; // Set axis color
      context.lineWidth = 2; // Set axis line width
      context.beginPath();
      context.moveTo(0, y_orig); // X-axis
      context.lineTo(x_width, y_orig);
      context.moveTo(x_orig, y_width); // Y-axis
      context.lineTo(x_orig, 0);
      context.stroke();

      // Draw axis labels
      context.font = "12pt Arial"; // Set font style
      context.fillStyle = "#000000"; // Set label color
      context.textAlign = "left";
      context.textBaseline = "top";
      context.fillText(x_label, x_width - 0.75 * tw, typos + th / 2); // X-axis label
      context.fillText(y_label, txpos, 0.5 * th); // Y-axis label
    };

    // DRAW GRID: Draw major and minor grid lines and display values
    this.drawgrid = function (xmajor, xminor, ymajor, yminor) {
      var x_tick_major = xmajor / x_scal; // Major tick spacing for x
      var x_tick_minor = xminor / x_scal; // Minor tick spacing for x
      var y_tick_major = ymajor / y_scal; // Major tick spacing for y
      var y_tick_minor = yminor / y_scal; // Minor tick spacing for y

      // Draw major grid lines
      context.strokeStyle = "#999999"; // Major grid color
      context.lineWidth = 1;
      context.beginPath();
      var yy = y_width;
      do {
        context.moveTo(0, yy);
        context.lineTo(x_width, yy); // Horizontal lines
        yy -= y_tick_major;
      } while (yy <= 0);
      var xx = 0;
      do {
        context.moveTo(xx, 0);
        context.lineTo(xx, y_width); // Vertical lines
        xx += x_tick_major;
      } while (xx <= x_width);
      context.stroke();

      // Draw minor grid lines
      context.strokeStyle = "#cccccc"; // Minor grid color
      context.lineWidth = 1;
      context.beginPath();
      yy = y_width;
      do {
        context.moveTo(0, yy);
        context.lineTo(x_width, yy);
        yy -= y_tick_minor;
      } while (yy <= 0);
      xx = 0;
      do {
        context.moveTo(xx, 0);
        context.lineTo(xx, y_width);
        xx += x_tick_minor;
      } while (xx <= x_width);
      context.stroke();

      // Display values on the grid
      var y_displ, x_displ;
      context.font = "10pt Arial"; // Set font style for values
      context.fillStyle = "#000000";
      context.textAlign = "right";
      context.textBaseline = "top";
      yy = y_width;
      do {
        y_displ = (y_orig - yy) * y_scal; // Calculate y value
        context.fillText(y_displ, txpos + 5, yy - th / 2); // Display y value
        yy -= y_tick_major;
      } while (yy <= 0);
      context.textAlign = "left";
      context.textBaseline = "top";
      xx = 0;
      do {
        x_displ = (xx - x_orig) * x_scal; // Calculate x value
        context.fillText(x_displ, xx - tw + 10, typos + 5); // Display x value
        xx += x_tick_major;
      } while (xx <= x_width);
    };

    // PLOT DATA: Plot data using arrays of x and y values
    this.plot = function (xArr, yArr, pColor, pDots, pLine) {
      // Set default values for optional parameters
      if (typeof pColor === "undefined") pColor = "#0000ff"; // Default color
      if (typeof pDots === "undefined") pDots = true; // Default to showing dots
      if (typeof pLine === "undefined") pLine = true; // Default to connecting dots with a line

      // Calculate the starting position for the plot
      var xpos = x_orig + xArr[0] / x_scal;
      var ypos = y_orig - yArr[0] / y_scal;
      context.strokeStyle = pColor; // Set plot color
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(xpos, ypos); // Move to the first point
      context.arc(xpos, ypos, 1, 0, 2 * Math.PI, true); // Draw a dot at the first point

      // Loop through the arrays to draw the points and lines
      for (var i = 1; i < xArr.length; i++) {
        xpos = x_orig + xArr[i] / x_scal; // Calculate x position
        ypos = y_orig - yArr[i] / y_scal; // Calculate y position
        if (pLine) {
          context.lineTo(xpos, ypos); // Draw line to the next point
        } else {
          context.moveTo(xpos, ypos); // Move to next point without line
        }
        if (pDots) {
          context.arc(xpos, ypos, 1, 0, 2 * Math.PI, true); // Draw a dot
        }
      }
      context.stroke(); // Execute the stroke to render lines and dots
    };
  }
}
