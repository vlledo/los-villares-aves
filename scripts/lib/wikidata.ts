const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

export interface WikidataInfo {
	qid?: string;
	imageFile?: string;
	gbifTaxonId?: string;
	ebirdId?: string;
	wikipediaEsTitle?: string;
	wikipediaEsUrl?: string;
}

function pickValue(binding: Record<string, { value: string }>, key: string): string | undefined {
	return binding[key]?.value;
}

export async function lookupSpecies(scientificName: string): Promise<WikidataInfo> {
	const query = `
SELECT ?item ?image ?gbif ?ebird ?wikiEs ?wikiEsName WHERE {
  ?item wdt:P225 "${scientificName.replace(/"/g, '\\"')}".
  OPTIONAL { ?item wdt:P18    ?image. }
  OPTIONAL { ?item wdt:P846   ?gbif.  }
  OPTIONAL { ?item wdt:P3444  ?ebird. }
  OPTIONAL {
    ?wikiEs schema:about ?item ;
            schema:isPartOf <https://es.wikipedia.org/> ;
            schema:name ?wikiEsName .
  }
}
LIMIT 1
`;
	const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;
	const res = await fetch(url, {
		headers: {
			Accept: 'application/sparql-results+json',
			'User-Agent': 'aves-villares/0.1 (proyecto personal de ornitología)',
		},
	});
	if (!res.ok) {
		throw new Error(`Wikidata SPARQL falló para "${scientificName}": HTTP ${res.status}`);
	}
	const data = (await res.json()) as {
		results: { bindings: Array<Record<string, { value: string }>> };
	};
	const binding = data.results.bindings[0];
	if (!binding) return {};

	const itemUri = pickValue(binding, 'item');
	const imageUri = pickValue(binding, 'image');
	const wikiEsUri = pickValue(binding, 'wikiEs');

	return {
		qid: itemUri?.split('/').pop(),
		imageFile: imageUri ? decodeURIComponent(imageUri.split('/').pop() ?? '') : undefined,
		gbifTaxonId: pickValue(binding, 'gbif'),
		ebirdId: pickValue(binding, 'ebird'),
		wikipediaEsUrl: wikiEsUri,
		wikipediaEsTitle: pickValue(binding, 'wikiEsName'),
	};
}
