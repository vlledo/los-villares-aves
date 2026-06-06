interface Estado {
	texto: string;
	mes: string;
	habitats: Set<string>;
	abundancia: string;
}

const CLASES_PULSADO = ['bg-olivo-100', 'text-olivo-800', 'border-olivo-300', 'font-semibold'];
const CLASES_REPOSO = ['bg-tierra-50', 'text-tierra-700'];

function normalizar(texto: string): string {
	return texto
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '');
}

function aplicarEstilo(boton: HTMLElement, activo: boolean): void {
	boton.setAttribute('aria-pressed', activo ? 'true' : 'false');
	if (activo) {
		boton.classList.add(...CLASES_PULSADO);
		boton.classList.remove(...CLASES_REPOSO);
	} else {
		boton.classList.remove(...CLASES_PULSADO);
		boton.classList.add(...CLASES_REPOSO);
	}
}

function leerEstado(panel: HTMLElement): Estado {
	const texto = (panel.querySelector('[data-filtro-texto]') as HTMLInputElement | null)?.value ?? '';
	const mesBtn = panel.querySelector<HTMLElement>('[data-filtro-mes][aria-pressed="true"]');
	const mes = mesBtn?.dataset.filtroMes ?? '';
	const habitats = new Set<string>();
	panel
		.querySelectorAll<HTMLElement>('[data-filtro-habitat][aria-pressed="true"]')
		.forEach((b) => {
			if (b.dataset.filtroHabitat) habitats.add(b.dataset.filtroHabitat);
		});
	const abundanciaBtn = panel.querySelector<HTMLElement>(
		'[data-filtro-abundancia][aria-pressed="true"]',
	);
	const abundancia = abundanciaBtn?.dataset.filtroAbundancia ?? '';

	return { texto: normalizar(texto.trim()), mes, habitats, abundancia };
}

function coincide(tarjeta: HTMLElement, estado: Estado): boolean {
	if (estado.texto) {
		const nombre = tarjeta.dataset.nombre ?? '';
		if (!nombre.includes(estado.texto)) return false;
	}
	if (estado.mes) {
		const meses = (tarjeta.dataset.meses ?? '').split(',').filter(Boolean);
		if (!meses.includes(estado.mes)) return false;
	}
	if (estado.habitats.size > 0) {
		const habitats = new Set((tarjeta.dataset.habitats ?? '').split(',').filter(Boolean));
		for (const h of estado.habitats) {
			if (!habitats.has(h)) return false;
		}
	}
	if (estado.abundancia) {
		if ((tarjeta.dataset.abundancia ?? '') !== estado.abundancia) return false;
	}
	return true;
}

function aplicar(panel: HTMLElement, contenedor: HTMLElement): void {
	const estado = leerEstado(panel);
	const tarjetas = contenedor.querySelectorAll<HTMLElement>('[data-tarjeta]');
	let visibles = 0;
	tarjetas.forEach((t) => {
		const visible = coincide(t, estado);
		t.hidden = !visible;
		if (visible) visibles++;
	});

	const contador = panel.querySelector('[data-filtro-resultado]');
	if (contador) contador.textContent = String(visibles);

	const vacio = document.querySelector<HTMLElement>('[data-vacio]');
	if (vacio) vacio.hidden = visibles > 0;
}

export function initFiltrosCatalogo(): void {
	const panel = document.querySelector<HTMLElement>('[data-filtros]');
	const grid = document.querySelector<HTMLElement>('[data-grid-aves]');
	if (!panel || !grid) return;

	panel.querySelectorAll<HTMLElement>('[data-filtro-mes]').forEach((btn) => {
		btn.addEventListener('click', () => {
			panel.querySelectorAll<HTMLElement>('[data-filtro-mes]').forEach((other) =>
				aplicarEstilo(other, other === btn),
			);
			aplicar(panel, grid);
		});
	});

	panel.querySelectorAll<HTMLElement>('[data-filtro-habitat]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const ya = btn.getAttribute('aria-pressed') === 'true';
			aplicarEstilo(btn, !ya);
			aplicar(panel, grid);
		});
	});

	panel.querySelectorAll<HTMLElement>('[data-filtro-abundancia]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const ya = btn.getAttribute('aria-pressed') === 'true';
			panel.querySelectorAll<HTMLElement>('[data-filtro-abundancia]').forEach((other) =>
				aplicarEstilo(other, false),
			);
			aplicarEstilo(btn, !ya);
			aplicar(panel, grid);
		});
	});

	const input = panel.querySelector<HTMLInputElement>('[data-filtro-texto]');
	input?.addEventListener('input', () => aplicar(panel, grid));

	panel.querySelector<HTMLElement>('[data-filtro-reset]')?.addEventListener('click', () => {
		if (input) input.value = '';
		panel.querySelectorAll<HTMLElement>('[data-filtro-mes]').forEach((b) =>
			aplicarEstilo(b, b.dataset.filtroMes === ''),
		);
		panel.querySelectorAll<HTMLElement>('[data-filtro-habitat]').forEach((b) =>
			aplicarEstilo(b, false),
		);
		panel.querySelectorAll<HTMLElement>('[data-filtro-abundancia]').forEach((b) =>
			aplicarEstilo(b, false),
		);
		aplicar(panel, grid);
	});

	aplicar(panel, grid);
}
