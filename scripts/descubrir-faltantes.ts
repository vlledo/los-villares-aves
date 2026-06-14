import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'src/content/aves');
const CONSTS_PATH = path.join(ROOT, 'src/consts.ts');
const CACHE_DIR = path.join(ROOT, 'scripts/.cache');
const TAXONOMY_CACHE = path.join(CACHE_DIR, 'ebird-taxonomy.json');
const TAXONOMY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const EBIRD_KEY = process.env.EBIRD_API_KEY;
if (!EBIRD_KEY) {
	console.error('Falta EBIRD_API_KEY. Lanza con: node --env-file=.env scripts/descubrir-faltantes.ts');
	process.exit(1);
}

function argValue(args: string[], flag: string, fallback: string): string {
	const i = args.indexOf(flag);
	if (i >= 0 && i < args.length - 1) return args[i + 1];
	return fallback;
}

const args = process.argv.slice(2);
const radiusKm = parseFloat(argValue(args, '--radius', '10'));
const topN = parseInt(argValue(args, '--top', '30'), 10);
const asJson = args.includes('--json');

async function readLocation(): Promise<{ lat: number; lon: number }> {
	const consts = await readFile(CONSTS_PATH, 'utf8');
	const lat = consts.match(/lat:\s*([\d.-]+)/)?.[1];
	const lon = consts.match(/lon:\s*([\d.-]+)/)?.[1];
	if (!lat || !lon) throw new Error('No se pudo leer LOCATION de consts.ts');
	return { lat: parseFloat(lat), lon: parseFloat(lon) };
}

async function readCatalogIndex(): Promise<{ codes: Set<string>; sciNames: Set<string> }> {
	const codes = new Set<string>();
	const sciNames = new Set<string>();
	for (const f of (await readdir(CONTENT_DIR)).filter((x) => x.endsWith('.mdx'))) {
		const content = await readFile(path.join(CONTENT_DIR, f), 'utf8');
		const ebird = content.match(/^\s+ebird_code:\s*(.+)$/m);
		if (ebird) codes.add(ebird[1].trim().replace(/^["']|["']$/g, ''));
		const sci = content.match(/^nombre_cientifico:\s*(.+)$/m);
		if (sci) sciNames.add(sci[1].trim().replace(/^["']|["']$/g, '').toLowerCase());
	}
	return { codes, sciNames };
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

async function fetchHotspots(lat: number, lon: number, dist: number) {
	const res = await fetch(
		`https://api.ebird.org/v2/ref/hotspot/geo?lat=${lat}&lng=${lon}&dist=${dist}&fmt=json`,
		{ headers: { 'X-eBirdApiToken': EBIRD_KEY! } },
	);
	if (!res.ok) throw new Error(`Hotspots HTTP ${res.status}`);
	return (await res.json()) as Array<{ locId: string; locName: string; lat: number; lng: number }>;
}

async function fetchHotspotSpecies(locId: string): Promise<string[]> {
	const res = await fetch(`https://api.ebird.org/v2/product/spplist/${locId}`, {
		headers: { 'X-eBirdApiToken': EBIRD_KEY! },
	});
	if (!res.ok) return [];
	return (await res.json()) as string[];
}

interface TaxEntry {
	speciesCode: string;
	comName: string;
	sciName: string;
	familyComName?: string;
	order?: string;
}

async function fetchTaxonomy(): Promise<Map<string, TaxEntry>> {
	try {
		const s = await stat(TAXONOMY_CACHE);
		if (Date.now() - s.mtimeMs < TAXONOMY_TTL_MS) {
			const cached = JSON.parse(await readFile(TAXONOMY_CACHE, 'utf8')) as TaxEntry[];
			process.stderr.write(`  (taxonomía en caché, ${cached.length} entradas)\n`);
			return new Map(cached.map((t) => [t.speciesCode, t]));
		}
	} catch {
		// no cache: caer al fetch
	}
	process.stderr.write(`  (bajando taxonomía de eBird, ~15000 especies)\n`);
	const res = await fetch('https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json&locale=es', {
		headers: { 'X-eBirdApiToken': EBIRD_KEY! },
	});
	if (!res.ok) throw new Error(`Taxonomía HTTP ${res.status}`);
	const tax = (await res.json()) as TaxEntry[];
	await mkdir(CACHE_DIR, { recursive: true });
	await writeFile(TAXONOMY_CACHE, JSON.stringify(tax));
	process.stderr.write(`  (taxonomía cacheada en ${path.relative(ROOT, TAXONOMY_CACHE)})\n`);
	return new Map(tax.map((t) => [t.speciesCode, t]));
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

async function main() {
	const { lat, lon } = await readLocation();
	const catalog = await readCatalogIndex();

	process.stderr.write(`LOCATION: ${lat}, ${lon} · radio ${radiusKm} km\n`);
	process.stderr.write(`catálogo actual: ${catalog.sciNames.size} fichas (${catalog.codes.size} con ebird_code)\n`);
	process.stderr.write(`obteniendo hotspots…\n`);
	const hotspots = await fetchHotspots(lat, lon, radiusKm);
	process.stderr.write(`  ${hotspots.length} hotspots en ${radiusKm} km\n`);

	const presence = new Map<string, number>();
	for (const h of hotspots) {
		const codes = await fetchHotspotSpecies(h.locId);
		for (const c of codes) presence.set(c, (presence.get(c) ?? 0) + 1);
		await sleep(250);
	}
	process.stderr.write(`  ${presence.size} especies únicas en la unión\n`);

	process.stderr.write(`resolviendo taxonomía…\n`);
	const tax = await fetchTaxonomy();

	const missing: Array<{ code: string; count: number; sci: string; name: string; slug: string }> = [];
	for (const [code, count] of presence) {
		if (catalog.codes.has(code)) continue;
		const t = tax.get(code);
		if (!t) continue;
		if (catalog.sciNames.has(t.sciName.toLowerCase())) continue;
		missing.push({
			code,
			count,
			sci: t.sciName,
			name: t.comName,
			slug: slugify(t.comName),
		});
	}
	missing.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

	process.stderr.write(`\nfaltantes:  ${missing.length} (${catalog.sciNames.size}/${presence.size} ya cubiertas)\n\n`);

	const slice = missing.slice(0, topN);
	if (asJson) {
		const entries = slice.map((m) => ({
			slug: m.slug,
			nombre_comun: m.name,
			nombre_cientifico: m.sci,
		}));
		console.log(JSON.stringify(entries, null, '\t').replace(/^/gm, '\t\t').trimStart());
	} else {
		console.log(`top ${slice.length} faltantes (orden por presencia en ${hotspots.length} hotspots):`);
		console.log('');
		for (const m of slice) {
			console.log(`  ${String(m.count).padStart(2)}/${hotspots.length} · ${m.code.padEnd(9)} · ${m.name.padEnd(32)} · ${m.sci}`);
		}
		console.log('');
		console.log(`Para pegar en scripts/aves-iniciales.json, relanza con --json:`);
		console.log(`  npm run faltantes:listar -- --top ${topN} --json`);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
