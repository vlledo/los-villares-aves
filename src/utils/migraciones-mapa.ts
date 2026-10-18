// Proyección y trazado del mapa de migraciones. Puro (sin imports de Astro):
// lo usan la página, los tests y scripts/generate-mapa-base.ts.
import type { Punto } from './migraciones-logica.ts';

const LNG_MIN = -25;
const LNG_MAX = 75;
const LAT_MIN = 0;
const LAT_MAX = 66;
const ANCHO = 1000;

// Equirectangular con el paralelo de referencia a 35° N (el centro de Europa y el
// Sáhara), de modo que la forma de las costas no se deforma. El marco va del ecuador
// a 66° N y del Atlántico a Rusia occidental para que quede apaisado y el mapa pueda
// ocupar todo el ancho de la página sin empujar las tarjetas.
const GRADO_X = ANCHO / (LNG_MAX - LNG_MIN);
const GRADO_Y = GRADO_X / Math.cos((35 * Math.PI) / 180);

export const MARCO = {
	lngMin: LNG_MIN,
	lngMax: LNG_MAX,
	latMin: LAT_MIN,
	latMax: LAT_MAX,
	ancho: ANCHO,
	alto: (LAT_MAX - LAT_MIN) * GRADO_Y,
};

export function proyectar(lat: number, lng: number): { x: number; y: number } {
	return {
		x: (lng - LNG_MIN) * GRADO_X,
		y: (LAT_MAX - lat) * GRADO_Y,
	};
}

export function dentroDelMarco(p: { lat: number; lng: number }): boolean {
	return p.lat >= LAT_MIN && p.lat <= LAT_MAX && p.lng >= LNG_MIN && p.lng <= LNG_MAX;
}

const r1 = (n: number): string => n.toFixed(1);

const ARCO = 0.18;

/** Curva Catmull-Rom convertida a Béziers cúbicas que pasa por todos los puntos. */
export function trazo(puntos: Punto[]): string {
	const p = puntos.map((q) => proyectar(q.lat, q.lng));
	let d = `M ${r1(p[0].x)} ${r1(p[0].y)}`;
	for (let i = 0; i < p.length - 1; i++) {
		const p0 = p[Math.max(i - 1, 0)];
		const p1 = p[i];
		const p2 = p[i + 1];
		const p3 = p[Math.min(i + 2, p.length - 1)];
		// Cada tramo se curva hacia el mismo lado (la normal izquierda del avance)
		// en una fracción de su longitud, para que las rutas se lean como arcos.
		const dx = p2.x - p1.x;
		const dy = p2.y - p1.y;
		const arcoX = -dy * ARCO;
		const arcoY = dx * ARCO;
		const c1x = p1.x + (p2.x - p0.x) / 6 + arcoX;
		const c1y = p1.y + (p2.y - p0.y) / 6 + arcoY;
		const c2x = p2.x - (p3.x - p1.x) / 6 + arcoX;
		const c2y = p2.y - (p3.y - p1.y) / 6 + arcoY;
		d += ` C ${r1(c1x)} ${r1(c1y)} ${r1(c2x)} ${r1(c2y)} ${r1(p2.x)} ${r1(p2.y)}`;
	}
	return d;
}
