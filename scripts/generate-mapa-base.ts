// Genera src/utils/mapa-base.generated.ts: siluetas de tierra firme de Natural Earth
// (dominio público, 50m), recortadas a un área ampliada alrededor del marco, proyectadas y simplificadas.
// Uso: npm run mapa:generar
import { writeFileSync } from 'node:fs';
import { MARCO, proyectar } from '../src/utils/migraciones-mapa.ts';

const URL_TIERRA =
	'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson';
const SALIDA = new URL('../src/utils/mapa-base.generated.ts', import.meta.url);
const DISTANCIA_MINIMA_PX = 0.8;
// Fuera del marco solo se rellena el fondo: no hace falta detalle de costa.
const DISTANCIA_MINIMA_FUERA_PX = 5;

// La tierra se recorta a un área mayor que el marco: si el mapa se muestra con bandas
// laterales o superiores (límite de altura, pantallas estrechas), la costa sigue en
// vez de cortarse en seco en el borde del marco.
const MARGEN = { lng: 60, latSur: 20, latNorte: 14 };

type Par = [number, number]; // [lng, lat]
type Anillo = Par[];

// Sutherland-Hodgman contra un borde del marco.
function recortar(anillo: Anillo, dentro: (p: Par) => boolean, corte: (a: Par, b: Par) => Par): Anillo {
	const salida: Anillo = [];
	for (let i = 0; i < anillo.length; i++) {
		const actual = anillo[i];
		const previo = anillo[(i + anillo.length - 1) % anillo.length];
		if (dentro(actual)) {
			if (!dentro(previo)) salida.push(corte(previo, actual));
			salida.push(actual);
		} else if (dentro(previo)) {
			salida.push(corte(previo, actual));
		}
	}
	return salida;
}

function recortarAlMarco(anillo: Anillo): Anillo {
	const lngMin = MARCO.lngMin - MARGEN.lng;
	const lngMax = MARCO.lngMax + MARGEN.lng;
	const latMin = MARCO.latMin - MARGEN.latSur;
	const latMax = MARCO.latMax + MARGEN.latNorte;
	const enLng = (lng: number) => (a: Par, b: Par): Par => {
		const t = (lng - a[0]) / (b[0] - a[0]);
		return [lng, a[1] + t * (b[1] - a[1])];
	};
	const enLat = (lat: number) => (a: Par, b: Par): Par => {
		const t = (lat - a[1]) / (b[1] - a[1]);
		return [a[0] + t * (b[0] - a[0]), lat];
	};
	let r = anillo;
	r = recortar(r, (p) => p[0] >= lngMin, enLng(lngMin));
	if (r.length) r = recortar(r, (p) => p[0] <= lngMax, enLng(lngMax));
	if (r.length) r = recortar(r, (p) => p[1] >= latMin, enLat(latMin));
	if (r.length) r = recortar(r, (p) => p[1] <= latMax, enLat(latMax));
	return r;
}

function anilloAPath(anillo: Anillo): string {
	const puntos: { x: number; y: number }[] = [];
	for (const [lng, lat] of anillo) {
		const p = proyectar(lat, lng);
		const ult = puntos[puntos.length - 1];
		const dentro = p.x >= 0 && p.x <= MARCO.ancho && p.y >= 0 && p.y <= MARCO.alto;
		const minimo = dentro ? DISTANCIA_MINIMA_PX : DISTANCIA_MINIMA_FUERA_PX;
		if (!ult || Math.hypot(p.x - ult.x, p.y - ult.y) >= minimo) puntos.push(p);
	}
	if (puntos.length < 3) return '';
	return `M${puntos.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}Z`;
}

const respuesta = await fetch(URL_TIERRA);
if (!respuesta.ok) throw new Error(`No se pudo descargar Natural Earth: ${respuesta.status}`);
const geojson = (await respuesta.json()) as {
	features: { geometry: { type: string; coordinates: any } }[];
};

const anillos: Anillo[] = [];
for (const { geometry } of geojson.features) {
	const poligonos: Anillo[][] =
		geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
	for (const poligono of poligonos) for (const anillo of poligono) anillos.push(anillo);
}

const d = anillos.map((a) => anilloAPath(recortarAlMarco(a))).filter(Boolean).join('');

writeFileSync(
	SALIDA,
	`// Generado por scripts/generate-mapa-base.ts — no editar a mano.\n` +
		`// Fuente: Natural Earth 50m land (dominio público). Marco: ${JSON.stringify(MARCO)}\n` +
		`export const TIERRA_PATH =\n\t${JSON.stringify(d)};\n`,
);
console.log(`mapa-base.generated.ts: ${(d.length / 1024).toFixed(0)} KB, ${anillos.length} anillos de entrada`);
