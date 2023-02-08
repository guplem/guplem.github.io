//DEPENDENCIES: Vector, Espai

function Particula(massa,carrega,restitucio,radi,color,gradient){
    if(typeof(massa)==='undefined') massa = 1;
    if(typeof(carrega)==='undefined') carrega = 0;
	if(typeof(restitucio)==='undefined') restitucio = 1;
	if(typeof(radi)==='undefined') radi = 1;     
	if(typeof(color)==='undefined') color = '#0000ff';
	if(typeof(gradient)==='undefined') gradient = false;
    this.massa = massa;
    this.carrega = carrega;
	this.restitucio=restitucio;
	this.radi = radi;
	this.color = color;
	this.gradient = gradient;
    this.pos = new Vector(0,0);     
	this.vel = new Vector(0,0);
	
	//METODES
	
	this.draw = function (espai) {
		if (this.gradient){
			grad = espai.createRadialGradient(this.pos.x,this.pos.y,0,this.pos.x,this.pos.y,this.radi);
			grad.addColorStop(0,'#ffffff');
			grad.addColorStop(1,this.color);
			espai.fillStyle(grad);
		}
		else {
			espai.fillStyle(this.color);
		}          
		espai.beginPath();
		espai.arc(this.pos.x, this.pos.y, this.radi, 0, 2*Math.PI, true);
		espai.closePath();
		espai.fill();
	}; 
} 