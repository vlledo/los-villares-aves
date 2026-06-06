export interface WikiSummary {
	title: string;
	extract: string;
	canonicalUrl: string;
}

export async function fetchSummary(titleEs: string): Promise<WikiSummary | null> {
	const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titleEs)}`;
	const res = await fetch(url, {
		headers: {
			'User-Agent': 'aves-villares/0.1 (proyecto personal de ornitología)',
			Accept: 'application/json',
		},
	});
	if (res.status === 404) return null;
	if (!res.ok) {
		throw new Error(`Wikipedia summary falló para "${titleEs}": HTTP ${res.status}`);
	}
	const data = (await res.json()) as {
		title: string;
		extract: string;
		content_urls?: { desktop?: { page?: string } };
	};
	return {
		title: data.title,
		extract: data.extract ?? '',
		canonicalUrl: data.content_urls?.desktop?.page ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(titleEs)}`,
	};
}
