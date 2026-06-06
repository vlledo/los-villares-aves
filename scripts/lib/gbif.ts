const GBIF_BASE = 'https://api.gbif.org/v1';

export interface GbifMatch {
	usageKey: number;
	scientificName: string;
	canonicalName: string;
	rank: string;
	status: string;
	confidence: number;
	kingdom?: string;
	phylum?: string;
	class?: string;
	order?: string;
	family?: string;
	genus?: string;
	species?: string;
	matchType: string;
}

export async function matchSpecies(scientificName: string): Promise<GbifMatch> {
	const tryMatch = async (params: string): Promise<GbifMatch> => {
		const url = `${GBIF_BASE}/species/match?${params}`;
		const res = await fetch(url, { headers: { 'User-Agent': 'aves-villares/0.1' } });
		if (!res.ok) throw new Error(`GBIF HTTP ${res.status}`);
		return (await res.json()) as GbifMatch;
	};

	let data = await tryMatch(
		`name=${encodeURIComponent(scientificName)}&strict=false&rank=SPECIES&kingdom=Animalia`,
	);
	if (data.matchType !== 'NONE') return data;

	data = await tryMatch(
		`name=${encodeURIComponent(scientificName)}&strict=false&rank=SPECIES&class=Aves`,
	);
	if (data.matchType !== 'NONE') return data;

	throw new Error(`GBIF no encontró "${scientificName}"`);
}
