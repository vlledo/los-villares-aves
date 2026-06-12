import { type CollectionEntry, getCollection } from 'astro:content';

const MESES_CORTOS = [
	'ene', 'feb', 'mar', 'abr', 'may', 'jun',
	'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const MESES_LARGOS = [
	'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
	'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function formatoFechaCorta(d: Date): string {
	return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatoMesLargo(d: Date): string {
	return `${MESES_LARGOS[d.getMonth()]} ${d.getFullYear()}`;
}

export type EntradaBitacora = CollectionEntry<'bitacora'> & {
	especiesResueltas: CollectionEntry<'aves'>[];
};

/**
 * Devuelve todas las entradas de la bitácora ordenadas por fecha
 * descendente, con los slugs de `especies` resueltos a entradas del
 * catálogo. Si una entrada referencia un slug que no existe, lanza un
 * error en build con el path del .mdx y el slug problemático.
 */
export async function obtenerEntradasBitacora(): Promise<EntradaBitacora[]> {
	const [entradas, aves] = await Promise.all([
		getCollection('bitacora'),
		getCollection('aves'),
	]);
	const avesPorSlug = new Map(aves.map((a) => [a.id, a]));

	return entradas
		.map((entrada) => {
			const especiesResueltas = (entrada.data.especies ?? []).map((slug) => {
				const ave = avesPorSlug.get(slug);
				if (!ave) {
					throw new Error(
						`bitacora/${entrada.id}.mdx: especie "${slug}" no existe en el catálogo`,
					);
				}
				return ave;
			});
			return { ...entrada, especiesResueltas };
		})
		.sort((a, b) => {
			const dt = b.data.fecha.getTime() - a.data.fecha.getTime();
			return dt !== 0 ? dt : a.id.localeCompare(b.id);
		});
}

/**
 * Agrupa las entradas (ya ordenadas) por "Mes Año" en español.
 * Devuelve array de pares [titulo, entradas] preservando el orden.
 */
export function agruparPorMes(
	entradas: EntradaBitacora[],
): Array<[string, EntradaBitacora[]]> {
	const grupos = new Map<string, EntradaBitacora[]>();
	for (const e of entradas) {
		const clave = formatoMesLargo(e.data.fecha);
		const lista = grupos.get(clave) ?? [];
		lista.push(e);
		grupos.set(clave, lista);
	}
	return Array.from(grupos.entries());
}

/**
 * Devuelve los `n` slugs únicos más recientes encontrados en
 * entradas con `especies` (en orden cronológico inverso). Útil para
 * el bloque "Últimas añadidas" de portada.
 */
export function ultimasEspeciesUnicas(
	entradas: EntradaBitacora[],
	n: number,
): CollectionEntry<'aves'>[] {
	const vistos = new Set<string>();
	const resultado: CollectionEntry<'aves'>[] = [];
	for (const entrada of entradas) {
		for (const ave of entrada.especiesResueltas) {
			if (vistos.has(ave.id)) continue;
			vistos.add(ave.id);
			resultado.push(ave);
			if (resultado.length >= n) return resultado;
		}
	}
	return resultado;
}
