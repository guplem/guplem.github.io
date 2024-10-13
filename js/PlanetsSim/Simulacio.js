// Recuperem el canvas
var simCanvas = document.getElementById('simCanvas');

//Posar el tamany correcte del canvas al html

function setProperCanvasSize() {

    var presentation = document.getElementById('PresentationTextZone');

    var topHeight = presentation.offsetHeight;
    var topWidth = presentation.offsetWidth;
    simCanvas.height = topHeight;
    simCanvas.width = topWidth;

    //alert("topHeight = " + topHeight + ", topWidth = " + topWidth + " canvas: " + simCanvas.height +", "+ simCanvas.width);    

}
setProperCanvasSize();

//Creem l'espai de treball
var espai = new Espai(simCanvas, -5, 5, -5, 5);
var ctx = simCanvas.getContext("2d");

// Creem els planetes que orbitaran
var planetes = new Array();
for (var i = 0; i < 100; i++) {
    //es determina el radi del planeta
    var radiParticula = Math.random() / 5;
    planetes.push(new Particula(1, 0, 0, radiParticula, '#c2dde6', true));

    //es determina el radi de l'òrbita
    var radiOrbita = Math.random() * 3.5 + 0.5;

    //es determina la velocitat del planeta
    var variacio = 0.4;
    var vel = Math.sqrt(1 / radiOrbita) + Math.random() * variacio - (variacio / 2);

    //Es determina la posicio inicial i es corregeix la velocitat del planeta
    var initPos = new Vector(radiOrbita, 0);
    if (Math.random() >= 0.5) {
        initPos = new Vector(-radiOrbita, 0);
        vel = -vel;
    }

    planetes[i].pos = initPos;
    planetes[i].vel = new Vector(0, vel);
}

// Creem la força de gravitacio
var g = new Gravitacio();

window.onload = init;

function init() {
    setInterval(onEachStep, 1000 / 60); // 60 fps
};

function onEachStep() {
    // Avancem el temps calculant les noves posicions i velocitats
    for (var i = 0; i < 100; i++) {
        Temps.euler(planetes[i], 1 / 60, g.forca(planetes[i]));
    }

    espai.clear();
    for (var i = 0; i < 100; i++) {
        planetes[i].draw(espai);
    }

    //Draw text
    /*ctx.font = "30px Arial";
    ctx.fillStyle = "red";
    ctx.textAlign = "center";
    ctx.fillText("Hello World", simCanvas.width/2, simCanvas.height/2); */
};