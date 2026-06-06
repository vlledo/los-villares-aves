import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

export interface CommonsImage {
	url: string;
	width: number;
	height: number;
	mime: string;
	artist: string;
	licenseShortName: string;
	licenseUrl?: string;
	descriptionUrl: string;
}

function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 4): Promise<Response> {
	let last: Response | undefined;
	for (let i = 0; i < attempts; i++) {
		const res = await fetch(url, init);
		if (res.ok) return res;
		if (res.status !== 429 && res.status < 500) return res;
		last = res;
		const wait = 1000 * Math.pow(3, i);
		await new Promise((r) => setTimeout(r, wait));
	}
	return last as Response;
}

export async function fetchImageInfo(fileName: string, widthHint = 1600): Promise<CommonsImage | null> {
	const titles = fileName.startsWith('File:') ? fileName : `File:${fileName}`;
	const params = new URLSearchParams({
		action: 'query',
		prop: 'imageinfo',
		titles,
		iiprop: 'url|size|mime|extmetadata',
		iiurlwidth: String(widthHint),
		format: 'json',
		formatversion: '2',
	});
	const res = await fetchWithRetry(`${COMMONS_API}?${params}`, {
		headers: { 'User-Agent': 'aves-villares/0.1 (proyecto personal de ornitología)' },
	});
	if (!res.ok) throw new Error(`Commons imageinfo HTTP ${res.status} para ${fileName}`);

	const data = (await res.json()) as {
		query?: {
			pages?: Array<{
				missing?: boolean;
				imageinfo?: Array<{
					url: string;
					thumburl?: string;
					thumbwidth?: number;
					thumbheight?: number;
					width: number;
					height: number;
					mime: string;
					descriptionurl: string;
					extmetadata?: Record<string, { value: string }>;
				}>;
			}>;
		};
	};
	const page = data.query?.pages?.[0];
	if (!page || page.missing || !page.imageinfo?.[0]) return null;
	const info = page.imageinfo[0];
	const meta = info.extmetadata ?? {};

	const url = info.thumburl ?? info.url;
	const width = info.thumbwidth ?? info.width;
	const height = info.thumbheight ?? info.height;

	return {
		url,
		width,
		height,
		mime: info.mime,
		artist: stripHtml(meta.Artist?.value ?? 'Desconocido'),
		licenseShortName: meta.LicenseShortName?.value ?? 'desconocida',
		licenseUrl: meta.LicenseUrl?.value,
		descriptionUrl: info.descriptionurl,
	};
}

export async function downloadTo(url: string, destPath: string): Promise<void> {
	const res = await fetchWithRetry(url, {
		headers: { 'User-Agent': 'aves-villares/0.1 (proyecto personal de ornitología)' },
	});
	if (!res.ok) throw new Error(`Descarga falló HTTP ${res.status}: ${url}`);
	const buf = Buffer.from(await res.arrayBuffer());
	await writeFile(destPath, buf);
}

export function extensionFromMime(mime: string): string {
	switch (mime) {
		case 'image/jpeg':
			return 'jpg';
		case 'image/png':
			return 'png';
		case 'image/webp':
			return 'webp';
		case 'image/gif':
			return 'gif';
		default:
			return path.extname(mime) || 'jpg';
	}
}

const NON_PHOTO_KEYWORDS = [
	'skull',
	'skeleton',
	'egg',
	'eggs',
	'nest',
	'feather',
	'pluma',
	'diagram',
	'illustration',
	'drawing',
	'plate',
	'sonogram',
	'spectrogram',
	'distribution',
	'range map',
	'cranium',
	'bones',
	'museum',
	'mounted',
	'taxidermy',
	'stamp',
	'collection',
	'collections',
	'mhnt',
	'zoo.',
	'specimen',
	'preserved',
	'naturalis',
	'macro',
	'closeup',
	'close-up',
	'detail',
	'chick',
	'juvenile-in-hand',
];

function isLikelyNonPhoto(title: string): boolean {
	const lower = title.toLowerCase();
	return NON_PHOTO_KEYWORDS.some((kw) => lower.includes(kw));
}

function isPermissiveLicense(licenseShortName: string): boolean {
	const lower = licenseShortName.toLowerCase();
	if (lower === 'desconocida' || lower === 'unknown') return false;
	if (lower.includes('nc') || lower.includes('nd')) return false;
	return /cc|public domain|cc0/i.test(licenseShortName);
}

function scoreCandidate(c: CommonsImage & { title: string }): number {
	if (!c.mime.startsWith('image/')) return -Infinity;
	if (c.mime === 'image/svg+xml') return -Infinity;
	if (isLikelyNonPhoto(c.title)) return -Infinity;
	if (!isPermissiveLicense(c.licenseShortName)) return -Infinity;

	const ratio = c.width / c.height;
	let score = 0;
	if (ratio >= 1.3) score += 100;
	else if (ratio >= 1.1) score += 30;
	else score -= 50;

	const distanceFrom32 = Math.abs(ratio - 1.5);
	score -= distanceFrom32 * 20;

	score += Math.min(c.width / 200, 10);

	return score;
}

export interface BestImageResult extends CommonsImage {
	title: string;
	source: 'wikidata' | 'commons-search';
	ratio: number;
	score: number;
}

export async function searchImages(
	query: string,
	limit = 20,
	widthHint = 1600,
): Promise<Array<CommonsImage & { title: string }>> {
	const params = new URLSearchParams({
		action: 'query',
		generator: 'search',
		gsrsearch: query,
		gsrnamespace: '6',
		gsrlimit: String(limit),
		prop: 'imageinfo',
		iiprop: 'url|size|mime|extmetadata',
		iiurlwidth: String(widthHint),
		format: 'json',
		formatversion: '2',
	});
	const res = await fetchWithRetry(`${COMMONS_API}?${params}`, {
		headers: { 'User-Agent': 'aves-villares/0.1 (proyecto personal de ornitología)' },
	});
	if (!res.ok) throw new Error(`Commons search HTTP ${res.status} para ${query}`);
	const data = (await res.json()) as {
		query?: {
			pages?: Array<{
				title: string;
				imageinfo?: Array<{
					url: string;
					thumburl?: string;
					thumbwidth?: number;
					thumbheight?: number;
					width: number;
					height: number;
					mime: string;
					descriptionurl: string;
					extmetadata?: Record<string, { value: string }>;
				}>;
			}>;
		};
	};
	const pages = data.query?.pages ?? [];
	return pages
		.map((p) => {
			const info = p.imageinfo?.[0];
			if (!info) return null;
			const meta = info.extmetadata ?? {};
			return {
				title: p.title,
				url: info.thumburl ?? info.url,
				width: info.thumbwidth ?? info.width,
				height: info.thumbheight ?? info.height,
				mime: info.mime,
				artist: stripHtml(meta.Artist?.value ?? 'Desconocido'),
				licenseShortName: meta.LicenseShortName?.value ?? 'desconocida',
				licenseUrl: meta.LicenseUrl?.value,
				descriptionUrl: info.descriptionurl,
			};
		})
		.filter((x): x is CommonsImage & { title: string } => x !== null);
}

export async function pickBestPhoto(
	scientificName: string,
	preferredFile?: string,
): Promise<BestImageResult | null> {
	const candidates: Array<CommonsImage & { title: string; source: 'wikidata' | 'commons-search' }> = [];

	if (preferredFile) {
		try {
			const info = await fetchImageInfo(preferredFile, 1920);
			if (info) {
				candidates.push({ ...info, title: preferredFile, source: 'wikidata' });
			}
		} catch {
			// ignore — caemos a la búsqueda
		}
	}

	try {
		const found = await searchImages(scientificName, 25, 1920);
		for (const f of found) {
			candidates.push({ ...f, source: 'commons-search' });
		}
	} catch {
		// si la búsqueda falla y tenemos Wikidata, usamos eso
	}

	if (candidates.length === 0) return null;

	const scored = candidates
		.map((c) => ({
			...c,
			ratio: c.width / c.height,
			score: scoreCandidate(c),
		}))
		.filter((c) => c.score > -Infinity)
		.sort((a, b) => b.score - a.score);

	return scored[0] ?? null;
}
