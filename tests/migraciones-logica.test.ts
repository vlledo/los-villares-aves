import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	epocaPorMes,
	puntosRuta,
	sentido,
	textoKm,
	textoRango,
	validarGrupo,
	type Migracion,
	type MesClave,
	type Punto,
} from '../src/utils/migraciones-logica.ts';

const MESES: MesClave[] = [
	'ene', 'feb', 'mar', 'abr', 'may', 'jun',
	'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

function estacionalidadCon(valor: string): Record<MesClave, string> {
	const e = Object.fromEntries(MESES.map((m) => [m, 'residente'])) as Record<MesClave, string>;
	e.jun = valor;
	return e;
}

const todoResidente = estacionalidadCon('residente');

const villares: Punto = { nombre: 'Los Villares', lat: 37.78, lng: -3.83 };
const sahel: Punto = { nombre: 'Sahel', lat: 13, lng: -8 };
const escandinavia: Punto = { nombre: 'Escandinavia', lat: 62, lng: 15 };
const estrecho = { nombre: 'Estrecho de Gibraltar', lat: 36, lng: -5.6 };

function migracion(parcial: Partial<Migracion>): Migracion {
	return {
		grupo: 'estival',
		zona_cria: villares,
		zona_invernada: sahel,
		km: [4000, 5000],
		primavera: { desde: 'abr', hasta: 'may' },
		otono: { desde: 'ago', hasta: 'sep' },
		viaje: 'con_escalas',
		...parcial,
	};
}

test('validarGrupo acepta un estival con algún mes estival', () => {
	assert.equal(validarGrupo('estival', estacionalidadCon('estival')), null);
});

test('validarGrupo rechaza un estival sin meses estival y nombra el grupo', () => {
	assert.match(validarGrupo('estival', todoResidente) ?? '', /estival/);
});

test('validarGrupo acepta y rechaza invernante', () => {
	assert.equal(validarGrupo('invernante', estacionalidadCon('invernante')), null);
	assert.match(validarGrupo('invernante', todoResidente) ?? '', /invernante/);
});

test('validarGrupo acepta y rechaza paso', () => {
	assert.equal(validarGrupo('paso', estacionalidadCon('paso')), null);
	assert.match(validarGrupo('paso', todoResidente) ?? '', /paso/);
});

test('puntosRuta de un estival no inserta Los Villares', () => {
	const m = migracion({ escalas: [estrecho] });
	assert.deepEqual(puntosRuta(m, villares), [villares, estrecho, sahel]);
});

test('puntosRuta de un paso inserta Los Villares antes del primer punto más al sur', () => {
	const m = migracion({
		grupo: 'paso',
		zona_cria: escandinavia,
		zona_invernada: sahel,
		escalas: [estrecho],
	});
	assert.deepEqual(puntosRuta(m, villares), [escandinavia, villares, estrecho, sahel]);
});

test('puntosRuta de un paso sin puntos al sur inserta Los Villares antes del último', () => {
	const norteA: Punto = { nombre: 'A', lat: 60, lng: 10 };
	const norteB: Punto = { nombre: 'B', lat: 45, lng: 5 };
	const m = migracion({ grupo: 'paso', zona_cria: norteA, zona_invernada: norteB });
	assert.deepEqual(puntosRuta(m, villares), [norteA, villares, norteB]);
});

test('sentido en otoño devuelve la ruta tal cual', () => {
	const ruta = [villares, estrecho, sahel];
	assert.deepEqual(sentido(ruta, 'otono'), ruta);
});

test('sentido en primavera invierte la ruta sin mutar la original', () => {
	const ruta = [villares, estrecho, sahel];
	assert.deepEqual(sentido(ruta, 'primavera'), [sahel, estrecho, villares]);
	assert.deepEqual(ruta, [villares, estrecho, sahel]);
});

test('textoKm con mínimo igual al máximo no repite la cifra y agrupa miles', () => {
	assert.equal(textoKm([4500, 4500]), '≈ 4.500 km');
});

test('textoKm con rango agrupa miles también en 4 cifras', () => {
	assert.equal(textoKm([4000, 5000]), '≈ 4.000-5.000 km');
	assert.equal(textoKm([800, 1200]), '≈ 800-1.200 km');
});

test('textoRango de un solo mes, de varios y que cruza el año', () => {
	assert.equal(textoRango({ desde: 'abr', hasta: 'abr' }), 'abril');
	assert.equal(textoRango({ desde: 'abr', hasta: 'may' }), 'abril-mayo');
	assert.equal(textoRango({ desde: 'nov', hasta: 'feb' }), 'noviembre-febrero');
});

test('epocaPorMes reparte enero-junio en primavera y julio-diciembre en otoño', () => {
	assert.equal(epocaPorMes(0), 'primavera');
	assert.equal(epocaPorMes(5), 'primavera');
	assert.equal(epocaPorMes(6), 'otono');
	assert.equal(epocaPorMes(11), 'otono');
});
