import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const presenciaMes = z.enum([
	'residente',
	'invernante',
	'estival',
	'paso',
	'raro',
	'ausente',
]);

const meses = [
	'ene',
	'feb',
	'mar',
	'abr',
	'may',
	'jun',
	'jul',
	'ago',
	'sep',
	'oct',
	'nov',
	'dic',
] as const;

const estacionalidadSchema = z.object(
	Object.fromEntries(meses.map((m) => [m, presenciaMes])) as Record<
		(typeof meses)[number],
		typeof presenciaMes
	>,
);

const abundancia = z.enum(['muy_comun', 'comun', 'escaso', 'raro']);

const habitat = z.enum([
	'olivar',
	'huertas',
	'bordes_de_camino',
	'jardines',
	'pinar',
	'encinar',
	'matorral_mediterraneo',
	'cortados_rocosos',
	'rios_y_arroyos',
	'embalses',
	'campos_cultivo',
	'cielo_abierto',
	'taludes_arenosos',
	'casco_urbano',
]);

const estadoUICN = z.enum(['LC', 'NT', 'VU', 'EN', 'CR', 'DD', 'EX']);

const aves = defineCollection({
	loader: glob({ base: './src/content/aves', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			nombre_comun: z.string(),
			nombre_cientifico: z.string(),
			nombre_local: z.string().optional(),
			familia: z.string(),
			orden: z.string(),

			tamano_cm: z.tuple([z.number(), z.number()]).or(z.number()),
			envergadura_cm: z.tuple([z.number(), z.number()]).optional(),
			peso_g: z.tuple([z.number(), z.number()]).optional(),
			descripcion_corta: z.string(),

			estacionalidad: estacionalidadSchema,
			abundancia: abundancia,
			habitats: z.array(habitat).min(1),
			altitud_m: z.tuple([z.number(), z.number()]).optional(),

			comportamiento: z.string().optional(),
			canto_descripcion: z.string().optional(),
			canto_audio_url: z.string().url().optional(),
			canto_audio_credito: z.string().optional(),
			puntos_buenos_avistamiento: z.array(z.string()).optional(),

			estado_uicn: estadoUICN.default('LC'),
			amenazas_locales: z.array(z.string()).optional(),

			destacada: z.boolean().default(false),

			foto_principal: image().optional(),
			foto_principal_credito: z.string().optional(),
			ilustracion_silueta: image().optional(),

			fuentes: z
				.object({
					gbif_taxon_key: z.number().optional(),
					ebird_code: z.string().optional(),
					wikipedia_url: z.string().url().optional(),
					xeno_canto_id: z.string().optional(),
				})
				.optional(),
		}),
});

export const collections = { aves };

export { meses, presenciaMes, abundancia, habitat, estadoUICN };
