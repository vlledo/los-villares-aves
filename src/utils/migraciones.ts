import { type CollectionEntry, getCollection } from 'astro:content';
import { LOCATION } from '../consts';
import { type Migracion, type Punto, puntosRuta, validarGrupo } from './migraciones-logica';
import { dentroDelMarco } from './migraciones-mapa';

export interface Migrante {
	ave: CollectionEntry<'aves'>;
	migracion: Migracion;
	ruta: Punto[];
}

const VILLARES: Punto = { nombre: LOCATION.nombre, lat: LOCATION.lat, lng: LOCATION.lon };

/**
 * Devuelve las aves con `migracion` ordenadas por nombre común, con su ruta
 * resuelta. Rompe el build, con el path del .mdx, si el grupo no tiene
 * respaldo en la estacionalidad de la ficha o si algún punto de la ruta cae
 * fuera del marco del mapa.
 */
export async function obtenerMigrantes(): Promise<Migrante[]> {
	const aves = await getCollection('aves');

	return aves
		.filter((ave) => ave.data.migracion)
		.sort((a, b) => a.data.nombre_comun.localeCompare(b.data.nombre_comun, 'es'))
		.map((ave) => {
			const migracion = ave.data.migracion as Migracion;

			const motivo = validarGrupo(migracion.grupo, ave.data.estacionalidad);
			if (motivo) throw new Error(`aves/${ave.id}.mdx: ${motivo}`);

			const ruta = puntosRuta(migracion, VILLARES);
			for (const punto of ruta) {
				if (!dentroDelMarco(punto)) {
					throw new Error(`aves/${ave.id}.mdx: punto "${punto.nombre}" fuera del marco del mapa`);
				}
			}
			return { ave, migracion, ruta };
		});
}
