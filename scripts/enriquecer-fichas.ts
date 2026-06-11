import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTENT_DIR = path.resolve(__dirname, '..', 'src/content/aves');
const EBIRD_KEY = process.env.EBIRD_API_KEY;
const REGION = 'ES-AN-JA';
const YEAR = 2024;
const SAMPLE_DAYS = [1, 8, 15, 22];
const HOTSPOT_LAT = 37.78;
const HOTSPOT_LON = -3.83;
const HOTSPOT_RADIUS_KM = 10;

if (!EBIRD_KEY) {
	console.error('Falta EBIRD_API_KEY. Lanza con: node --env-file=.env scripts/enriquecer-fichas.ts');
	process.exit(1);
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;
type Mes = (typeof MESES)[number];

const HABITAT_KEYWORDS: Record<string, RegExp> = {
	olivar: /\bolivar(es)?\b/i,
	huertas: /\bhuerta(s)?\b/i,
	bordes_de_camino: /\bborde(s)?\s+de\s+camino\b|\bsendero(s)?\b/i,
	jardines: /\bjardín|jardines\b/i,
	pinar: /\bpinar(es)?\b|\bbosque(s)?\s+de\s+pino\b/i,
	encinar: /\bencinar(es)?\b|\bdehesa(s)?\b/i,
	matorral_mediterraneo: /\bmatorral(es)?\b|\bjaral(es)?\b|\baulagar(es)?\b/i,
	cortados_rocosos: /\bcortado(s)?(\s+rocoso)?\b|\bacantilado(s)?\b|\bpared(es)?\s+rocos|\brisco(s)?\b|\bcantil(es)?\b/i,
	rios_y_arroyos: /\brío(s)?\b|\barroyo(s)?\b|\bribera(s)?\b|\bribereñ/i,
	embalses: /\bembalse(s)?\b|\blaguna(s)?\b|\bpantano(s)?\b|\bcharca(s)?\b|\bhumedal(es)?\b|\bbalsa(s)?\b|\bmarismas?\b/i,
	campos_cultivo: /\bcultivo(s)?\b|\bcereal(es)?\b|\bsembrado(s)?\b|\bagrícola(s)?\b|\bcampos?\s+(?:de\s+)?cultivo\b/i,
	cielo_abierto: /\bvuelo(s)?\s+(?:alto|aéreo)\b|\bcaza\s+(?:aérea|en\s+vuelo)\b|\baéreo(s)?\b/i,
	taludes_arenosos: /\btalud(es)?\b|\bareno(so|sa)s?\b|\bduna(s)?\b/i,
	casco_urbano: /\burbano(s|a|as)?\b|\bciudad(es)?\b|\bedificio(s)?\b|\btejado(s)?\b|\bcasa(s)?\s+(?:antigua|de pueblo)\b/i,
};

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 5): Promise<Response> {
	let last: Response | undefined;
	for (let i = 0; i < attempts; i++) {
		const res = await fetch(url, init);
		if (res.ok) return res;
		if (res.status !== 429 && res.status < 500) return res;
		last = res;
		const wait = 1000 * Math.pow(3, i);
		await sleep(wait);
	}
	return last as Response;
}

interface Range {
	min: number;
	max: number;
}

interface Dimensions {
	tamano_cm?: Range;
	envergadura_cm?: Range;
	peso_g?: Range;
}

function cleanWikitext(wt: string): string {
	return wt
		.replace(/<ref[^>]*\/>/g, '')
		.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/\[\[([^|\]]+\|)?([^\]]+)\]\]/g, '$2');
}

function matchRange(text: string, unit: string): Range | null {
	const patterns = [
		new RegExp(`entre\\s+(\\d+(?:,\\d+)?)\\s+y\\s+(\\d+(?:,\\d+)?)\\s*${unit}\\b`, 'i'),
		new RegExp(`de\\s+(\\d+(?:,\\d+)?)\\s+a\\s+(\\d+(?:,\\d+)?)\\s*${unit}\\b`, 'i'),
		new RegExp(`(\\d+(?:,\\d+)?)\\s*[-–]\\s*(\\d+(?:,\\d+)?)\\s*${unit}\\b`, 'i'),
	];
	for (const re of patterns) {
		const m = text.match(re);
		if (m) return { min: parseFloat(m[1].replace(',', '.')), max: parseFloat(m[2].replace(',', '.')) };
	}
	const single = new RegExp(`(\\d+(?:,\\d+)?)\\s*${unit}\\b`, 'i');
	const m = text.match(single);
	if (m) {
		const n = parseFloat(m[1].replace(',', '.'));
		return { min: n, max: n };
	}
	return null;
}

function extractDimensions(wikitext: string): Dimensions {
	const clean = cleanWikitext(wikitext);
	const sentences = clean.split(/(?<=[.!?])\s+/);

	const tamanoCandidates: Range[] = [];
	const envCandidates: Range[] = [];
	const pesoCandidates: Range[] = [];

	for (const s of sentences) {
		const hasEnv = /\benvergadura\b/i.test(s);
		const hasTamano = /\b(?:longitud|tamaño|miden?|cuerpo)\b/i.test(s);
		const hasPeso = /\b(?:pesa[rn]?|peso(?!s))\b/i.test(s);
		const isAboutOtherPart = /\b(?:cola|ala|pico|tarso|nido|huevo|cráneo|tarsometatars|cuerda)\b/i.test(s);

		if (hasEnv) {
			const r = matchRange(s, 'cm');
			if (r && r.min > 0 && r.max <= 350) envCandidates.push(r);
		} else if (hasTamano && !isAboutOtherPart) {
			const r = matchRange(s, 'cm');
			if (r && r.min > 0 && r.max <= 200) tamanoCandidates.push(r);
		}

		if (hasPeso && !isAboutOtherPart) {
			const r = matchRange(s, '(?:gramos?|g)');
			if (r && r.min > 0 && r.max <= 15000) pesoCandidates.push(r);
			else {
				const rKg = matchRange(s, '(?:kilogramos?|kg)');
				if (rKg && rKg.min > 0 && rKg.max <= 50) {
					pesoCandidates.push({ min: rKg.min * 1000, max: rKg.max * 1000 });
				}
			}
		}
	}

	function best(rs: Range[]): Range | undefined {
		if (rs.length === 0) return undefined;
		const ranges = rs.filter((r) => r.max > r.min);
		if (ranges.length > 0) return ranges[0];
		return rs[0];
	}

	return {
		tamano_cm: best(tamanoCandidates),
		envergadura_cm: best(envCandidates),
		peso_g: best(pesoCandidates),
	};
}

function extractHabitats(wikitext: string, descripcion: string): string[] {
	const text = `${descripcion}\n\n${cleanWikitext(wikitext)}`;
	const found: string[] = [];
	for (const [habitat, re] of Object.entries(HABITAT_KEYWORDS)) {
		if (re.test(text)) found.push(habitat);
	}
	return found;
}

async function fetchWikitext(scientificName: string): Promise<string> {
	const url = new URL('https://es.wikipedia.org/w/api.php');
	url.searchParams.set('action', 'parse');
	url.searchParams.set('page', scientificName);
	url.searchParams.set('prop', 'wikitext');
	url.searchParams.set('format', 'json');
	url.searchParams.set('formatversion', '2');
	const res = await fetch(url, { headers: { 'User-Agent': 'aves-villares/0.1' } });
	if (!res.ok) return '';
	const data = (await res.json()) as { parse?: { wikitext?: string } };
	return data.parse?.wikitext ?? '';
}

interface PresenceMaps {
	monthly: Map<string, Set<number>>;
	hotspotCount: Map<string, number>;
}

async function buildPresenceMaps(): Promise<PresenceMaps> {
	const monthly = new Map<string, Set<number>>();
	const hotspotCount = new Map<string, number>();

	console.log(`Construyendo presencia mensual ES-AN-JA ${YEAR} (${SAMPLE_DAYS.length}×12 llamadas)…`);
	for (let month = 1; month <= 12; month++) {
		for (const day of SAMPLE_DAYS) {
			const url = `https://api.ebird.org/v2/data/obs/${REGION}/historic/${YEAR}/${month}/${day}?cat=species&maxResults=10000`;
			const res = await fetchWithRetry(url, { headers: { 'X-eBirdApiToken': EBIRD_KEY! } });
			if (!res.ok) {
				console.warn(`  ! HTTP ${res.status} en ${YEAR}-${month}-${day}`);
				continue;
			}
			const obs = (await res.json()) as Array<{ speciesCode: string }>;
			for (const o of obs) {
				if (!monthly.has(o.speciesCode)) monthly.set(o.speciesCode, new Set());
				monthly.get(o.speciesCode)!.add(month);
			}
			await sleep(200);
		}
		process.stdout.write('.');
	}
	console.log(`  ${monthly.size} sp con observaciones mensuales.`);

	console.log(`Construyendo presencia por hotspot en ${HOTSPOT_RADIUS_KM} km…`);
	const hotspotsRes = await fetchWithRetry(
		`https://api.ebird.org/v2/ref/hotspot/geo?lat=${HOTSPOT_LAT}&lng=${HOTSPOT_LON}&dist=${HOTSPOT_RADIUS_KM}&fmt=json`,
		{ headers: { 'X-eBirdApiToken': EBIRD_KEY! } },
	);
	if (!hotspotsRes.ok) {
		console.warn(`  ! No se pudo obtener hotspots (HTTP ${hotspotsRes.status}); abundancia se queda sin actualizar.`);
		return { monthly, hotspotCount };
	}
	const hs = (await hotspotsRes.json()) as Array<{ locId: string; lat: number; lng: number }>;
	for (const h of hs) {
		const r = await fetchWithRetry(`https://api.ebird.org/v2/product/spplist/${h.locId}`, {
			headers: { 'X-eBirdApiToken': EBIRD_KEY! },
		});
		if (!r.ok) continue;
		const codes = (await r.json()) as string[];
		for (const c of codes) hotspotCount.set(c, (hotspotCount.get(c) ?? 0) + 1);
		await sleep(250);
	}
	console.log(`  ${hotspotCount.size} sp en ${hs.length} hotspots.`);

	return { monthly, hotspotCount };
}

function classifyEstacionalidad(months: Set<number>): Record<Mes, string> {
	const out: Record<Mes, string> = Object.fromEntries(MESES.map((m) => [m, 'ausente'])) as Record<Mes, string>;
	if (months.size === 0) return out;

	const winter = new Set([11, 12, 1, 2]);
	const summer = new Set([4, 5, 6, 7, 8]);
	const migration = new Set([3, 9, 10]);

	const arr = [...months];
	const inWinter = arr.filter((m) => winter.has(m)).length;
	const inSummer = arr.filter((m) => summer.has(m)).length;
	const inMigration = arr.filter((m) => migration.has(m)).length;

	let kind: string;
	if (months.size === 12) kind = 'residente';
	else if (months.size >= 10 && inWinter >= 2 && inSummer >= 3) kind = 'residente';
	else if (inSummer >= 3 && inWinter <= 1) kind = 'estival';
	else if (inWinter >= 2 && inSummer <= 1) kind = 'invernante';
	else if (months.size <= 3 && inMigration >= Math.ceil(months.size / 2)) kind = 'paso';
	else if (months.size <= 3) kind = 'raro';
	else kind = 'residente';

	for (let i = 1; i <= 12; i++) {
		if (kind === 'residente') {
			out[MESES[i - 1]] = 'residente';
		} else {
			out[MESES[i - 1]] = months.has(i) ? kind : 'ausente';
		}
	}
	return out;
}

function classifyAbundancia(hotspotCount: number): string {
	if (hotspotCount >= 11) return 'muy_comun';
	if (hotspotCount >= 6) return 'comun';
	if (hotspotCount >= 3) return 'escaso';
	if (hotspotCount >= 1) return 'raro';
	return 'raro';
}

function formatRange(r: Range): string {
	const fmt = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(1));
	return `[${fmt(r.min)}, ${fmt(r.max)}]`;
}

interface UpdateReport {
	slug: string;
	tamano?: string;
	envergadura?: string;
	peso?: string;
	estacionalidad?: string;
	habitats?: string;
	abundancia?: string;
	bodyClean?: boolean;
	notes: string[];
}

function stripBodyStub(content: string): { content: string; changed: boolean } {
	let updated = content;
	let changed = false;
	const stubRe = /\n*> Ficha autogenerada el \d{4}-\d{2}-\d{2}\. Revisar los campos marcados con `TODO` antes de publicar\.\n+/;
	if (stubRe.test(updated)) {
		updated = updated.replace(stubRe, '\n\n');
		changed = true;
	}
	const pendienteRe = /\n## Calendario en Los Villares\n\n_Pendiente de revisión\._\n/;
	if (pendienteRe.test(updated)) {
		updated = updated.replace(pendienteRe, '\n');
		changed = true;
	}
	return { content: updated, changed };
}

async function processFile(filePath: string, presence: PresenceMaps): Promise<UpdateReport | null> {
	const slug = path.basename(filePath, '.mdx');
	const content = await readFile(filePath, 'utf8');
	const hasFrontTodo = /TODO autogenerado/.test(content);
	const hasBodyStub = /Ficha autogenerada el/.test(content);
	if (!hasFrontTodo && !hasBodyStub) return null;

	const sciMatch = content.match(/^nombre_cientifico:\s*(.+)$/m);
	if (!sciMatch) return { slug, notes: ['sin nombre_cientifico'] };
	const sciName = sciMatch[1].trim().replace(/^["']|["']$/g, '');
	const ebirdMatch = content.match(/^\s+ebird_code:\s*(.+)$/m);
	const ebirdCode = ebirdMatch ? ebirdMatch[1].trim().replace(/^["']|["']$/g, '') : null;
	const descMatch = content.match(/^descripcion_corta:\s*>\n((?:  .+\n)+)/m);
	const descripcion = descMatch ? descMatch[1].replace(/^  /gm, '').trim() : '';

	const report: UpdateReport = { slug, notes: [] };
	let updated = content;

	const wikitext = await fetchWikitext(sciName);

	const dims = extractDimensions(wikitext);
	const hasTamanoPlaceholder = /^tamano_cm:\s*\[0,\s*0\]/m.test(updated);
	if (dims.tamano_cm && hasTamanoPlaceholder) {
		updated = updated.replace(/^# TODO autogenerado — completar con dimensiones reales\n/m, '');
		updated = updated.replace(
			/^tamano_cm:\s*\[0,\s*0\]\n/m,
			`tamano_cm: ${formatRange(dims.tamano_cm)}\n`,
		);
		report.tamano = formatRange(dims.tamano_cm);
	}
	if (dims.envergadura_cm && !/^envergadura_cm:/m.test(updated)) {
		updated = updated.replace(
			/^(tamano_cm:.+\n)/m,
			(_m, line) => `${line}envergadura_cm: ${formatRange(dims.envergadura_cm!)}\n`,
		);
		report.envergadura = formatRange(dims.envergadura_cm);
	}
	if (dims.peso_g && !/^peso_g:/m.test(updated)) {
		updated = updated.replace(
			/^((?:envergadura_cm|tamano_cm):.+\n)/m,
			(_m, line) => `${line}peso_g: ${formatRange(dims.peso_g!)}\n`,
		);
		report.peso = formatRange(dims.peso_g);
	}

	const allAusente = /^estacionalidad:\n(?:  (?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic):\s*ausente\n){12}/m.test(updated);
	if (ebirdCode && allAusente) {
		const months = presence.monthly.get(ebirdCode);
		if (months && months.size > 0) {
			const est = classifyEstacionalidad(months);
			updated = updated.replace(/^# TODO autogenerado — revisar mes a mes para Los Villares\n/m, '');
			const lines = MESES.map((m) => `  ${m}: ${est[m]}`).join('\n');
			updated = updated.replace(
				/^estacionalidad:\n(?:  (?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic):.+\n){12}/m,
				`estacionalidad:\n${lines}\n`,
			);
			const kind = [...new Set(Object.values(est))].filter((v) => v !== 'ausente').join('/');
			report.estacionalidad = `${months.size}/12 → ${kind}`;
		} else {
			report.notes.push('ebird sin presencia en muestreo');
		}
	}

	const habitatsTodoRe = /^habitats:\s*# TODO: añadir hábitats reales\n  - olivar\n/m;
	if (habitatsTodoRe.test(updated)) {
		const habs = extractHabitats(wikitext, descripcion);
		if (habs.length > 0) {
			const lines = habs.map((h) => `  - ${h}`).join('\n');
			updated = updated.replace(habitatsTodoRe, `habitats:\n${lines}\n`);
			report.habitats = habs.join(', ');
		} else {
			report.notes.push('sin hábitats detectables');
		}
	}

	const abundTodoRe = /^abundancia:\s*comun\s+# TODO:.+\n/m;
	if (abundTodoRe.test(updated) && ebirdCode) {
		const count = presence.hotspotCount.get(ebirdCode) ?? 0;
		const ab = classifyAbundancia(count);
		updated = updated.replace(abundTodoRe, `abundancia: ${ab}\n`);
		report.abundancia = `${ab} (${count}/14 hotspots)`;
	} else if (abundTodoRe.test(updated)) {
		const abundLine = updated.match(abundTodoRe)?.[0] ?? '';
		updated = updated.replace(abundTodoRe, `abundancia: comun\n`);
		report.abundancia = 'comun (default, sin ebird)';
	}

	const stripResult = stripBodyStub(updated);
	updated = stripResult.content;
	if (stripResult.changed) report.bodyClean = true;

	if (/Descripción pendiente/.test(updated)) {
		report.notes.push('descripcion_corta = "Descripción pendiente"');
	}

	if (updated !== content) {
		await writeFile(filePath, updated);
	}
	return report;
}

async function main() {
	const files = (await readdir(CONTENT_DIR)).filter((f) => f.endsWith('.mdx')).sort();
	const presence = await buildPresenceMaps();

	console.log('\nProcesando fichas autogeneradas…\n');
	const reports: UpdateReport[] = [];
	for (const f of files) {
		const r = await processFile(path.join(CONTENT_DIR, f), presence);
		if (r) {
			reports.push(r);
			const parts: string[] = [];
			if (r.tamano) parts.push(`tam=${r.tamano}`);
			if (r.envergadura) parts.push(`env=${r.envergadura}`);
			if (r.peso) parts.push(`peso=${r.peso}`);
			if (r.estacionalidad) parts.push(`est=${r.estacionalidad}`);
			if (r.habitats) parts.push(`hab=[${r.habitats}]`);
			if (r.abundancia) parts.push(`ab=${r.abundancia}`);
			if (r.bodyClean) parts.push('body↓');
			if (r.notes.length) parts.push(`(${r.notes.join('; ')})`);
			console.log(`  ${r.slug.padEnd(24)} ${parts.join(' · ') || '—'}`);
		}
		await sleep(300);
	}

	console.log(`\n=== Resumen ===`);
	console.log(`Fichas revisadas:        ${reports.length}`);
	console.log(`tamaño rellenado:        ${reports.filter((r) => r.tamano).length}`);
	console.log(`envergadura rellenada:   ${reports.filter((r) => r.envergadura).length}`);
	console.log(`peso rellenado:          ${reports.filter((r) => r.peso).length}`);
	console.log(`estacionalidad puesta:   ${reports.filter((r) => r.estacionalidad).length}`);
	console.log(`hábitats puestos:        ${reports.filter((r) => r.habitats).length}`);
	console.log(`abundancia puesta:       ${reports.filter((r) => r.abundancia).length}`);
	console.log(`cuerpos limpiados:       ${reports.filter((r) => r.bodyClean).length}`);

	const stillTodo = reports.filter((r) => r.notes.length > 0);
	if (stillTodo.length > 0) {
		console.log(`\nResiduos a revisar a mano:`);
		for (const r of stillTodo) console.log(`  ${r.slug.padEnd(24)} ${r.notes.join('; ')}`);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
