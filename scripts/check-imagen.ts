import { lookupSpecies } from './lib/wikidata.ts';
import { pickBestPhoto } from './lib/commons.ts';

async function check(scientificName: string): Promise<void> {
	console.log(`\n=== ${scientificName} ===`);
	const wd = await lookupSpecies(scientificName);
	console.log(`  Wikidata P18: ${wd.imageFile ?? '—'}`);

	const best = await pickBestPhoto(scientificName, wd.imageFile);
	if (!best) {
		console.log('  ✗ ninguna candidata pasa los filtros');
		return;
	}

	console.log(`  ★ elegida (${best.source})`);
	console.log(`    archivo:  ${best.title}`);
	console.log(`    tamaño:   ${best.width}x${best.height}  ratio ${best.ratio.toFixed(2)}`);
	console.log(`    licencia: ${best.licenseShortName}`);
	console.log(`    autor:    ${best.artist}`);
	console.log(`    puntaje:  ${best.score.toFixed(1)}`);
}

async function main() {
	const names = process.argv.slice(2);
	const targets = names.length
		? names
		: [
				'Buteo buteo',
				'Merops apiaster',
				'Aquila fasciata',
				'Upupa epops',
				'Cyanistes caeruleus',
				'Sylvia melanocephala',
			];

	for (const name of targets) {
		try {
			await check(name);
		} catch (e) {
			console.error(`  ✗ ${name}: ${(e as Error).message}`);
		}
		await new Promise((r) => setTimeout(r, 800));
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
