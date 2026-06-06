import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchSpecies } from './lib/gbif.ts';
import { lookupSpecies } from './lib/wikidata.ts';
import { fetchSummary } from './lib/wikipedia.ts';
import { downloadTo, extensionFromMime, pickBestPhoto } from './lib/commons.ts';

interface AveInput {
	slug: string;
	nombre_comun: string;
	nombre_cientifico: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'src/content/aves');
const ASSETS_DIR = path.join(ROOT, 'src/assets/aves');

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

function yamlString(value: string): string {
	const needsQuote = /[:#&*!|>{}\[\],?\-`@%\n]/.test(value) || value.trim() !== value;
	if (!needsQuote) return value;
	return JSON.stringify(value);
}

function formatFrontmatter(data: {
	nombre_comun: string;
	nombre_cientifico: string;
	familia: string;
	orden: string;
	descripcion_corta: string;
	foto_principal?: string;
	foto_principal_credito?: string;
	fuentes: {
		gbif_taxon_key?: number;
		ebird_code?: string;
		wikipedia_url?: string;
	};
}): string {
	const lines: string[] = ['---'];
	lines.push(`nombre_comun: ${yamlString(data.nombre_comun)}`);
	lines.push(`nombre_cientifico: ${yamlString(data.nombre_cientifico)}`);
	lines.push(`familia: ${yamlString(data.familia)}`);
	lines.push(`orden: ${yamlString(data.orden)}`);
	lines.push('');
	lines.push('# TODO autogenerado — completar con dimensiones reales');
	lines.push('tamano_cm: [0, 0]');
	lines.push('');
	lines.push(`descripcion_corta: >`);
	for (const chunk of data.descripcion_corta.match(/.{1,80}(\s|$)/g) ?? [data.descripcion_corta]) {
		lines.push(`  ${chunk.trim()}`);
	}
	lines.push('');
	lines.push('# TODO autogenerado — revisar mes a mes para Los Villares');
	lines.push('estacionalidad:');
	for (const m of ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']) {
		lines.push(`  ${m}: ausente`);
	}
	lines.push('');
	lines.push('abundancia: comun           # TODO: muy_comun | comun | escaso | raro');
	lines.push('habitats:                   # TODO: añadir hábitats reales');
	lines.push('  - olivar');
	lines.push('');
	lines.push('estado_uicn: LC');
	lines.push('');
	if (data.foto_principal) {
		lines.push(`foto_principal: ${data.foto_principal}`);
	}
	if (data.foto_principal_credito) {
		lines.push(`foto_principal_credito: ${yamlString(data.foto_principal_credito)}`);
	}
	lines.push('');
	lines.push('fuentes:');
	if (data.fuentes.gbif_taxon_key) lines.push(`  gbif_taxon_key: ${data.fuentes.gbif_taxon_key}`);
	if (data.fuentes.ebird_code) lines.push(`  ebird_code: ${yamlString(data.fuentes.ebird_code)}`);
	if (data.fuentes.wikipedia_url) lines.push(`  wikipedia_url: ${yamlString(data.fuentes.wikipedia_url)}`);
	lines.push('---');
	return lines.join('\n');
}

async function processSpecies(ave: AveInput): Promise<{ slug: string; status: string; message?: string }> {
	const mdxPath = path.join(CONTENT_DIR, `${ave.slug}.mdx`);
	if (existsSync(mdxPath)) {
		return { slug: ave.slug, status: 'skipped', message: 'ya existe' };
	}

	console.log(`→ ${ave.nombre_comun} (${ave.nombre_cientifico})`);

	const gbif = await matchSpecies(ave.nombre_cientifico);
	const wd = await lookupSpecies(ave.nombre_cientifico);

	let descripcionCorta = `${ave.nombre_comun} (${ave.nombre_cientifico}). Descripción pendiente.`;
	let wikipediaUrl: string | undefined = wd.wikipediaEsUrl;

	if (wd.wikipediaEsTitle) {
		try {
			const summary = await fetchSummary(wd.wikipediaEsTitle);
			if (summary?.extract) {
				descripcionCorta = summary.extract.split(/\.\s/).slice(0, 2).join('. ').trim();
				if (!descripcionCorta.endsWith('.')) descripcionCorta += '.';
				wikipediaUrl = summary.canonicalUrl;
			}
		} catch (e) {
			console.warn(`   ! Wikipedia ES falló: ${(e as Error).message}`);
		}
	}

	let fotoPrincipal: string | undefined;
	let fotoCredito: string | undefined;

	try {
		const best = await pickBestPhoto(ave.nombre_cientifico, wd.imageFile);
		if (best) {
			const ext = extensionFromMime(best.mime);
			const destRel = `../../assets/aves/${ave.slug}.${ext}`;
			const destAbs = path.join(ASSETS_DIR, `${ave.slug}.${ext}`);
			await downloadTo(best.url, destAbs);
			fotoPrincipal = destRel;
			fotoCredito = `${best.artist} (${best.licenseShortName}) — Wikimedia Commons`;
			console.log(
				`   ✓ foto descargada (${best.licenseShortName}, ${best.width}x${best.height}, ratio ${best.ratio.toFixed(2)}, fuente ${best.source})`,
			);
		} else {
			console.warn(`   ! Sin fotos válidas para ${ave.nombre_cientifico}`);
		}
	} catch (e) {
		console.warn(`   ! Foto falló: ${(e as Error).message}`);
	}

	const frontmatter = formatFrontmatter({
		nombre_comun: ave.nombre_comun,
		nombre_cientifico: ave.nombre_cientifico,
		familia: gbif.family ?? 'desconocida',
		orden: gbif.order ?? 'desconocido',
		descripcion_corta: descripcionCorta,
		foto_principal: fotoPrincipal,
		foto_principal_credito: fotoCredito,
		fuentes: {
			gbif_taxon_key: gbif.usageKey,
			ebird_code: wd.ebirdId,
			wikipedia_url: wikipediaUrl,
		},
	});

	const body = `\n\n> Ficha autogenerada el ${new Date().toISOString().slice(0, 10)}. Revisar los campos marcados con \`TODO\` antes de publicar.\n\n## Identificación en campo\n\n${descripcionCorta}\n\n## Calendario en Los Villares\n\n_Pendiente de revisión._\n`;

	await writeFile(mdxPath, frontmatter + body);
	return { slug: ave.slug, status: 'created' };
}

async function main() {
	const inputPath = path.join(__dirname, 'aves-iniciales.json');
	const json = JSON.parse(await readFile(inputPath, 'utf8')) as { aves: AveInput[] };

	const results: Array<{ slug: string; status: string; message?: string }> = [];
	for (const ave of json.aves) {
		try {
			results.push(await processSpecies(ave));
		} catch (e) {
			results.push({ slug: ave.slug, status: 'error', message: (e as Error).message });
			console.error(`   ✗ ${ave.slug}: ${(e as Error).message}`);
		}
		await sleep(1500);
	}

	console.log('\n=== Resumen ===');
	const counts = { created: 0, skipped: 0, error: 0 };
	for (const r of results) {
		counts[r.status as keyof typeof counts] = (counts[r.status as keyof typeof counts] ?? 0) + 1;
		console.log(`  ${r.status.padEnd(8)} ${r.slug}${r.message ? ` (${r.message})` : ''}`);
	}
	console.log(`\nCreadas: ${counts.created} · Saltadas: ${counts.skipped} · Errores: ${counts.error}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
