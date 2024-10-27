/* ARGUMENTS
simCanvas = space where the simulation will be drawn.
xmin, xmax, ymin, ymax = the minimum and maximum values in the horizontal and vertical directions in physical units.
xlabel, ylabel = labels for the coordinate axes.
*/
function Espai(simCanvas, xmin, xmax, ymin, ymax, xlabel, ylabel) {
  if (typeof xlabel === "undefined") xlabel = "x";
  if (typeof ylabel === "undefined") ylabel = "y";
  // VARIABLE DECLARATION
  // simCanvas context on which to draw graph instance
  var context = simCanvas.getContext("2d");
  // overall width and height of graph in pixels
  var x_width = simCanvas.width;
  var y_width = simCanvas.height;
  // scaling used in displaying values on the axes
  var x_scal = (xmax - xmin) / x_width;
  var y_scal = (ymax - ymin) / y_width;
  // location of origin (in pixels) in parent document
  var x_orig = -xmin / x_scal;
  var y_orig = y_width + ymin / y_scal;
  // width and height of textbox used for displaying values on the axes
  // this should not have to be tampered with (I hope)
  var tw = 15;
  var th = 20;
  var txpos = x_orig - tw;
  var typos = y_orig;
  var x_label = xlabel;
  var y_label = ylabel;

  // METHODS
  // These basically delegate their functionality to context
  this.strokeStyle = function (st) {
    context.strokeStyle = st;
  };
  this.lineWidth = function (lw) {
    context.lineWidth = lw;
  };
  this.stroke = function () {
    context.stroke();
  };
  this.fillStyle = function (color) {
    context.fillStyle = color;
  };
  this.beginPath = function () {
    context.beginPath();
  };
  this.moveTo = function (posx, posy) {
    context.moveTo(x_orig + posx / x_scal, y_orig - posy / y_scal);
  };
  this.lineTo = function (posx, posy) {
    context.lineTo(x_orig + posx / x_scal, y_orig - posy / y_scal);
  };
  this.arc = function (posx, posy, rad, angi, angf, bool) {
    context.arc(x_orig + posx / x_scal, y_orig - posy / y_scal, rad / y_scal, angi, angf, bool);
  };
  this.closePath = function () {
    context.closePath();
  };
  this.fill = function () {
    context.fill();
  };
  this.createRadialGradient = function (xi, yi, radi1, xf, yf, radi2) {
    return context.createRadialGradient(xi, yi, radi1, xf, yf, radi2);
  };
  this.clear = function () {
    context.clearRect(0, 0, x_width, y_width);
  };

  // These draw the axes and graphs if necessary
  // DRAW AXES: draw axes and labels
  this.drawaxes = function () {
    context.strokeStyle = "#000000";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, y_orig);
    context.lineTo(x_width, y_orig);
    context.moveTo(x_orig, y_width);
    context.lineTo(x_orig, 0);
    context.stroke();
    // axis labels
    context.font = "12pt Arial";
    context.fillStyle = "#000000";
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillText(x_label, x_width - 0.75 * tw, typos + th / 2);
    context.fillText(y_label, txpos, 0.5 * th);
  };

  // DRAW GRID: draw major, minor lines and display values
  this.drawgrid = function (xmajor, xminor, ymajor, yminor) {
    var x_tick_major = xmajor / x_scal;
    var x_tick_minor = xminor / x_scal;
    var y_tick_major = ymajor / y_scal;
    var y_tick_minor = yminor / y_scal;
    // draw major grid lines
    context.strokeStyle = "#999999";
    context.lineWidth = 1;
    context.beginPath();
    var yy = y_width;
    do {
      context.moveTo(0, yy);
      context.lineTo(x_width, yy);
      yy -= y_tick_major;
    } while (yy <= 0);
    var xx = 0;
    do {
      context.moveTo(xx, 0);
      context.lineTo(xx, y_width);
      xx += x_tick_major;
    } while (xx <= x_width);
    context.stroke();
    // draw minor grid lines
    context.strokeStyle = "#cccccc";
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
    // display values
    var y_displ;
    var x_displ;
    context.font = "10pt Arial";
    context.fillStyle = "#000000";
    context.textAlign = "right";
    context.textBaseline = "top";
    yy = y_width;
    do {
      y_displ = (y_orig - yy) * y_scal;
      context.fillText(y_displ, txpos + 5, yy - th / 2);
      yy -= y_tick_major;
    } while (yy <= 0);
    context.textAlign = "left";
    context.textBaseline = "top";
    xx = 0;
    do {
      x_displ = (xx - x_orig) * x_scal;
      context.fillText(x_displ, xx - tw + 10, typos + 5);
      xx += x_tick_major;
    } while (xx <= x_width);
  };

  // PLOT DATA: plot data x, y arrays of pairs of values to plot
  this.plot = function (xArr, yArr, pColor, pDots, pLine) {
    // the last three arguments have default values
    if (typeof pColor === "undefined") pColor = "#0000ff";
    if (typeof pDots === "undefined") pDots = true;
    if (typeof pLine === "undefined") pLine = true;
    var xpos = x_orig + xArr[0] / x_scal;
    var ypos = y_orig - yArr[0] / y_scal;
    context.strokeStyle = pColor;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(xpos, ypos);
    context.arc(xpos, ypos, 1, 0, 2 * Math.PI, true);
    for (var i = 1; i < xArr.length; i++) {
      xpos = x_orig + xArr[i] / x_scal;
      ypos = y_orig - yArr[i] / y_scal;
      if (pLine) {
        context.lineTo(xpos, ypos);
      } else {
        context.moveTo(xpos, ypos);
      }
      if (pDots) {
        context.arc(xpos, ypos, 1, 0, 2 * Math.PI, true);
      }
    }
    context.stroke();
  };
}
