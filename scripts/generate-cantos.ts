import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTENT_DIR = path.resolve(__dirname, '..', 'src/content/aves');
const API = 'https://xeno-canto.org/api/3/recordings';
const KEY = process.env.XENO_CANTO_API_KEY;

if (!KEY) {
	console.error('Falta XENO_CANTO_API_KEY. Lanza con: node --env-file=.env scripts/generate-cantos.ts');
	process.exit(1);
}

interface Pick {
	id: string;
	rec: string;
	lic: string;
	type: string;
	length: string;
	cnt: string;
	query: string;
}

interface XCRecording {
	id: string;
	rec: string;
	lic: string;
	type: string;
	length: string;
	cnt: string;
}

interface XCResponse {
	numRecordings?: string;
	recordings?: XCRecording[];
	error?: string;
	message?: string;
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

function licenseShort(licUrl: string): string {
	const cc = licUrl.match(/licenses\/([a-z-]+)\/(\d+\.\d+)/i);
	if (cc) return `CC ${cc[1].toUpperCase()} ${cc[2]}`;
	if (/publicdomain\/zero/.test(licUrl)) return 'CC0';
	if (/publicdomain\/mark/.test(licUrl)) return 'Public Domain';
	return licUrl;
}

async function query(q: string): Promise<XCRecording[]> {
	const url = new URL(API);
	url.searchParams.set('key', KEY!);
	url.searchParams.set('query', q);
	const res = await fetch(url, { headers: { 'User-Agent': 'aves-villares/0.1' } });
	if (!res.ok) {
		console.warn(`  ! HTTP ${res.status} en "${q}"`);
		return [];
	}
	const data = (await res.json()) as XCResponse;
	return data.recordings ?? [];
}

async function pickRecording(scientificName: string): Promise<Pick | null> {
	const parts = scientificName.trim().split(/\s+/);
	if (parts.length < 2) return null;
	const [gen, sp] = parts;

	const queries = [
		`gen:${gen} sp:${sp} q:A type:song len:5-30 cnt:Spain`,
		`gen:${gen} sp:${sp} q:A type:song len:5-30`,
		`gen:${gen} sp:${sp} q:A type:song`,
		`gen:${gen} sp:${sp} q:A len:5-30`,
		`gen:${gen} sp:${sp} q:A`,
		`gen:${gen} sp:${sp} q:B type:song len:5-30`,
		`gen:${gen} sp:${sp}`,
	];

	for (const q of queries) {
		const recs = await query(q);
		if (recs.length > 0) {
			const r = recs[0];
			return { id: r.id, rec: r.rec, lic: r.lic, type: r.type, length: r.length, cnt: r.cnt, query: q };
		}
		await sleep(400);
	}
	return null;
}

interface Result {
	slug: string;
	status: 'updated' | 'skipped' | 'error';
	message: string;
}

async function processFile(filePath: string): Promise<Result> {
	const slug = path.basename(filePath, '.mdx');
	const content = await readFile(filePath, 'utf8');

	if (/^\s*xeno_canto_id:/m.test(content)) {
		return { slug, status: 'skipped', message: 'ya tiene xeno_canto_id' };
	}

	const m = content.match(/^nombre_cientifico:\s*(.+)$/m);
	if (!m) return { slug, status: 'error', message: 'sin nombre_cientifico' };
	const scientificName = m[1].trim().replace(/^["']|["']$/g, '');

	console.log(`→ ${slug} (${scientificName})`);

	const pick = await pickRecording(scientificName);
	if (!pick) return { slug, status: 'error', message: 'sin grabaciones' };

	const credito = `${pick.rec} (${licenseShort(pick.lic)}) — xeno-canto XC${pick.id}`;
	console.log(`  XC${pick.id} · ${pick.length} · ${pick.type} · ${pick.cnt} · ${licenseShort(pick.lic)}`);

	let updated = content;

	const fuentesRe = /^(fuentes:\n(?:  .+\n)*)/m;
	if (!fuentesRe.test(updated)) {
		return { slug, status: 'error', message: 'sin bloque fuentes:' };
	}
	updated = updated.replace(fuentesRe, (_match, block) => `${block}  xeno_canto_id: "${pick.id}"\n`);

	const creditoLine = `canto_audio_credito: ${JSON.stringify(credito)}\n`;
	const urlRe = /^(canto_audio_url:.+\n)/m;
	const descRe = /^(canto_descripcion:\s*>\n(?:  .+\n)+)/m;
	if (urlRe.test(updated)) {
		updated = updated.replace(urlRe, (_m, line) => `${line}${creditoLine}`);
	} else if (descRe.test(updated)) {
		updated = updated.replace(descRe, (_m, block) => `${block}\n${creditoLine}`);
	} else {
		updated = updated.replace(/^fuentes:/m, `${creditoLine}\nfuentes:`);
	}

	await writeFile(filePath, updated);
	return { slug, status: 'updated', message: `XC${pick.id}` };
}

async function main() {
	const files = (await readdir(CONTENT_DIR)).filter((f) => f.endsWith('.mdx')).sort();

	const results: Result[] = [];
	for (const f of files) {
		try {
			const r = await processFile(path.join(CONTENT_DIR, f));
			results.push(r);
			if (r.status === 'updated') await sleep(1200);
		} catch (e) {
			results.push({ slug: f, status: 'error', message: (e as Error).message });
			console.error(`  ✗ ${(e as Error).message}`);
		}
	}

	console.log('\n=== Resumen ===');
	const counts = { updated: 0, skipped: 0, error: 0 };
	for (const r of results) {
		counts[r.status]++;
	}
	for (const r of results) {
		if (r.status !== 'updated') console.log(`  ${r.status.padEnd(8)} ${r.slug} (${r.message})`);
	}
	console.log(
		`\nActualizadas: ${counts.updated} · Saltadas: ${counts.skipped} · Errores: ${counts.error}`,
	);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
