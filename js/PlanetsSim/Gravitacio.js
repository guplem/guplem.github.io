// DEPENDENCIES: Particula
function Gravitacio() {
	this.forca = function(planeta) {
		return Vector.escala(planeta.pos,-planeta.massa/Math.pow(planeta.pos.norma(),3));
	}
};
