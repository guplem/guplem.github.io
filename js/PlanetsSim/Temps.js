// DEPENDENCIES: particula (posicio, velocitat i massa)

Temps = {
};

//METODES ESTATICS
//Calcula la posicio i velocitat noves d'una particula sobre la que
//	actua una forca	durant un temps dt	
Temps.euler =	function(particula,dt,forca) {
		particula.vel.y += forca.y*dt/particula.massa; 
		particula.pos.y += particula.vel.y*dt; 
		particula.vel.x += forca.x*dt/particula.massa; 
		particula.pos.x += particula.vel.x*dt; 
	};

