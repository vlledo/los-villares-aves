// Lógica pura de la sección Migraciones: sin imports de Astro para poder
// probarla con `node --test`.

export type Grupo = 'estival' | 'invernante' | 'paso';
export type Epoca = 'primavera' | 'otono';
export type MesClave =
	| 'ene' | 'feb' | 'mar' | 'abr' | 'may' | 'jun'
	| 'jul' | 'ago' | 'sep' | 'oct' | 'nov' | 'dic';

export interface Punto {
	nombre: string;
	lat: number;
	lng: number;
}

export interface Escala extends Punto {
	nota?: string;
}

export interface RangoMeses {
	desde: MesClave;
	hasta: MesClave;
}

export interface Migracion {
	grupo: Grupo;
	zona_cria: Punto;
	zona_invernada: Punto;
	km: [number, number];
	primavera: RangoMeses;
	otono: RangoMeses;
	viaje: 'directo' | 'con_escalas';
	escalas?: Escala[];
	nota?: string;
	fuente?: string;
}

const MES_LARGO: Record<MesClave, string> = {
	ene: 'enero',
	feb: 'febrero',
	mar: 'marzo',
	abr: 'abril',
	may: 'mayo',
	jun: 'junio',
	jul: 'julio',
	ago: 'agosto',
	sep: 'septiembre',
	oct: 'octubre',
	nov: 'noviembre',
	dic: 'diciembre',
};

/** `null` si el grupo tiene respaldo en la estacionalidad; si no, el motivo. */
export function validarGrupo(
	grupo: Grupo,
	estacionalidad: Record<MesClave, string>,
): string | null {
	const respaldado = Object.values(estacionalidad).includes(grupo);
	return respaldado
		? null
		: `grupo "${grupo}" sin ningún mes "${grupo}" en la estacionalidad`;
}

/** `[zona_cria, ...escalas, zona_invernada]`; en los de paso, con Los Villares en medio. */
export function puntosRuta(m: Migracion, villares: Punto): Punto[] {
	const ruta: Punto[] = [m.zona_cria, ...(m.escalas ?? []), m.zona_invernada];
	if (m.grupo !== 'paso') return ruta;

	let indice = ruta.findIndex((p, i) => i > 0 && p.lat < villares.lat);
	if (indice === -1) indice = ruta.length - 1;
	return [...ruta.slice(0, indice), villares, ...ruta.slice(indice)];
}

/** Otoño: de la cría a la invernada; primavera: al revés. */
export function sentido(ruta: Punto[], epoca: Epoca): Punto[] {
	return epoca === 'otono' ? ruta : [...ruta].reverse();
}

// `Intl` con es-ES no agrupa los números de 4 cifras, así que se hace a mano.
function miles(n: number): string {
	return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function textoKm([min, max]: [number, number]): string {
	return min === max ? `≈ ${miles(min)} km` : `≈ ${miles(min)}-${miles(max)} km`;
}

export function textoRango({ desde, hasta }: RangoMeses): string {
	return desde === hasta
		? MES_LARGO[desde]
		: `${MES_LARGO[desde]}-${MES_LARGO[hasta]}`;
}

/** `mes0` es `Date#getMonth()`: de enero a junio, primavera; de julio a diciembre, otoño. */
export function epocaPorMes(mes0: number): Epoca {
	return mes0 < 6 ? 'primavera' : 'otono';
}

export function coincideGrupo(filtro: 'todas' | Grupo, grupo: Grupo): boolean {
	return filtro === 'todas' || filtro === grupo;
}

const RADIO_TIERRA_KM = 6371;
const rad = (grados: number): number => (grados * Math.PI) / 180;

/** Longitud de la ruta como suma de tramos en línea recta sobre la esfera (haversine). */
export function kmGranCirculo(ruta: Punto[]): number {
	let total = 0;
	for (let i = 1; i < ruta.length; i++) {
		const a = ruta[i - 1];
		const b = ruta[i];
		const h =
			Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
			Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
		total += 2 * RADIO_TIERRA_KM * Math.asin(Math.sqrt(h));
	}
	return total;
}

/**
 * `null` si el rango de km es compatible con la geometría de la ruta; si no, el motivo.
 * Un ave no recorre menos que la línea recta (con un 15 % de margen por redondeo de
 * coordenadas) ni, razonablemente, más del triple.
 */
export function validarKm([min, max]: [number, number], ruta: Punto[]): string | null {
	const recta = Math.round(kmGranCirculo(ruta));
	if (min < recta * 0.85) {
		return `km mínimo (${min}) menor que la distancia en línea recta de la ruta (≈ ${recta} km)`;
	}
	if (max > recta * 3) {
		return `km máximo (${max}) desmedido frente a la distancia en línea recta de la ruta (≈ ${recta} km)`;
	}
	return null;
}
