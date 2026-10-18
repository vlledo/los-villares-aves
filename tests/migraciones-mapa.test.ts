import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	dentroDelMarco,
	MARCO,
	proyectar,
	trazo,
} from '../src/utils/migraciones-mapa.ts';

const numeros = (d: string): number[] => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

test('proyectar lleva la esquina noroeste del marco al origen', () => {
	assert.deepEqual(proyectar(MARCO.latMax, MARCO.lngMin), { x: 0, y: 0 });
});

test('proyectar lleva la esquina sureste del marco a (ancho, alto)', () => {
	const { x, y } = proyectar(MARCO.latMin, MARCO.lngMax);
	assert.ok(Math.abs(x - MARCO.ancho) < 1e-6);
	assert.ok(Math.abs(y - MARCO.alto) < 1e-6);
});

test('proyectar: y crece hacia el sur y x crece hacia el este', () => {
	const base = proyectar(37.78, -3.83);
	assert.ok(proyectar(30, -3.83).y > base.y);
	assert.ok(proyectar(37.78, 10).x > base.x);
});

test('dentroDelMarco acepta Los Villares y rechaza el polo', () => {
	assert.equal(dentroDelMarco({ lat: 37.78, lng: -3.83 }), true);
	assert.equal(dentroDelMarco({ lat: 80, lng: 0 }), false);
	assert.equal(dentroDelMarco({ lat: 0, lng: 100 }), false);
});

test('trazo de dos puntos empieza por M y no contiene NaN', () => {
	const d = trazo([
		{ nombre: 'A', lat: 62, lng: 15 },
		{ nombre: 'B', lat: 13, lng: -8 },
	]);
	assert.ok(d.startsWith('M'));
	assert.ok(!d.includes('NaN'));
});

test('trazo de tres puntos pasa exactamente por el punto central', () => {
	const a = { nombre: 'A', lat: 62, lng: 15 };
	const b = { nombre: 'B', lat: 37.78, lng: -3.83 };
	const c = { nombre: 'C', lat: 13, lng: -8 };
	const n = numeros(trazo([a, b, c]));
	const medio = proyectar(b.lat, b.lng);
	// M x0 y0 C c1x c1y c2x c2y x1 y1 ...: el final del primer tramo es el punto central.
	assert.ok(Math.abs(n[6] - medio.x) < 0.1);
	assert.ok(Math.abs(n[7] - medio.y) < 0.1);
});
