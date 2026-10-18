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
