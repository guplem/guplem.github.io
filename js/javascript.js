var delay = (function () {
  var timer = 0;
  return function (callback, ms) {
    clearTimeout(timer);
    timer = setTimeout(callback, ms);
  };
})();

function ajustPresentationHeight() {
  var presentation = document.getElementById("PresentationTextZone");

  var topHeight = presentation.offsetHeight;

  simCanvas.height = topHeight;

  document.getElementById("PresentationPlaceHolder").style.height = topHeight + "px";
}

function ajustDocument() {
  //alert("ajusting Document...");

  //alert("gona setProperCanvasSize");
  setProperCanvasSize();

  //alert("gona ajustPresentationHeight");
  ajustPresentationHeight();

  //alert("gona ajustTabHeight");
  //setTimeout(ajustTabHeight, 250);
  ajustTabHeight();
}

//window.onload = ajustDocument;
//window.onresize = ajustDocument;
