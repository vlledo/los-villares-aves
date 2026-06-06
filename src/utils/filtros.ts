import type { CollectionEntry } from 'astro:content';
import { meses } from '../content.config';

type Mes = (typeof meses)[number];
type Estacionalidad = Record<Mes, string>;

export function mesesPresentes(estacionalidad: Estacionalidad): Mes[] {
	return meses.filter((m) => estacionalidad[m] !== 'ausente');
}

export function presenteEnMes(estacionalidad: Estacionalidad, mes: Mes): boolean {
	return estacionalidad[mes] !== 'ausente';
}

export function habitatsEnCatalogo(aves: CollectionEntry<'aves'>[]): string[] {
	const set = new Set<string>();
	for (const ave of aves) {
		for (const h of ave.data.habitats) set.add(h);
	}
	return Array.from(set).sort();
}

export function abundanciasEnCatalogo(aves: CollectionEntry<'aves'>[]): string[] {
	const set = new Set<string>();
	for (const ave of aves) set.add(ave.data.abundancia);
	return Array.from(set);
}

export function normalizar(texto: string): string {
	return texto
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '');
}
