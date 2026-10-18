import { coincideGrupo, epocaPorMes, type Epoca, type Grupo } from '../utils/migraciones-logica.ts';

type FiltroGrupo = 'todas' | Grupo;

interface Estado {
	grupo: FiltroGrupo;
	epoca: Epoca;
	seleccion: string | null;
}

const AYUDA: Record<FiltroGrupo, Record<Epoca, string>> = {
	todas: {
		primavera:
			'En primavera llegan las estivales y se van las invernantes; las de paso solo cruzan.',
		otono: 'En otoño se van las estivales y llegan las invernantes; las de paso solo cruzan.',
	},
	estival: { primavera: 'Llegan en primavera.', otono: 'Se van en otoño.' },
	invernante: { primavera: 'Se van en primavera.', otono: 'Llegan en otoño.' },
	paso: { primavera: 'Pasan en primavera.', otono: 'Pasan en otoño.' },
};

const prefiereMenosMovimiento = (): boolean =>
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initMigraciones(): void {
	const raiz = document.querySelector<HTMLElement>('[data-migraciones]');
	const mapa = document.querySelector<SVGSVGElement>('[data-mapa-migraciones]');
	if (!raiz || !mapa) return;

	const wrap = document.querySelector<HTMLElement>('[data-mapa-wrap]');
	const tooltips = Array.from(document.querySelectorAll<HTMLElement>('[data-tooltip]'));
	const tarjetas = Array.from(document.querySelectorAll<HTMLElement>('[data-tarjeta-migracion]'));
	const rutas = Array.from(mapa.querySelectorAll<SVGGElement>('[data-ruta]'));
	const botonesGrupo = Array.from(raiz.querySelectorAll<HTMLElement>('[data-filtro-grupo]'));
	const botonesEpoca = Array.from(raiz.querySelectorAll<HTMLElement>('[data-filtro-epoca]'));
	const ayuda = raiz.querySelector<HTMLElement>('[data-ayuda]');
	const contador = document.querySelector<HTMLElement>('[data-contador]');

	/** Muestra el tooltip de la ruta seleccionada anclado en el punto medio de su trazo. */
	function colocarTooltip(slug: string | null): void {
		tooltips.forEach((t) => {
			t.hidden = t.dataset.slug !== slug;
		});
		if (!slug || !wrap) return;
		const tip = tooltips.find((t) => t.dataset.slug === slug);
		const linea = mapa!.querySelector<SVGPathElement>(`[data-ruta][data-slug="${slug}"] .linea`);
		const ctm = mapa!.getScreenCTM();
		if (!tip || !linea || !ctm) {
			if (tip) tip.hidden = true;
			return;
		}
		const medio = linea.getPointAtLength(linea.getTotalLength() / 2);
		const punto = new DOMPoint(medio.x, medio.y).matrixTransform(ctm);
		const caja = wrap.getBoundingClientRect();
		const px = punto.x - caja.left;
		const py = punto.y - caja.top;
		const x = Math.min(Math.max(px - tip.offsetWidth / 2, 8), caja.width - tip.offsetWidth - 8);
		const y = Math.max(py - tip.offsetHeight - 14, 8);
		tip.style.transform = `translate(${x}px, ${y}px)`;
		tip.style.setProperty('--caret-x', `${px - x}px`);
	}

	const estado: Estado = {
		grupo: 'todas',
		epoca: epocaPorMes(new Date().getMonth()),
		seleccion: null,
	};

	function pintar(): void {
		botonesGrupo.forEach((b) =>
			b.setAttribute('aria-pressed', String(b.dataset.filtroGrupo === estado.grupo)),
		);
		botonesEpoca.forEach((b) =>
			b.setAttribute('aria-pressed', String(b.dataset.filtroEpoca === estado.epoca)),
		);
		mapa!.dataset.epoca = estado.epoca;
		if (ayuda) ayuda.textContent = AYUDA[estado.grupo][estado.epoca];

		const visibles = new Set<string>();
		tarjetas.forEach((t) => {
			const visible = coincideGrupo(estado.grupo, t.dataset.grupo as Grupo);
			t.hidden = !visible;
			if (visible) visibles.add(t.dataset.slug ?? '');
			t.querySelectorAll<HTMLElement>('[data-fecha]').forEach((fila) => {
				fila.toggleAttribute('data-destacada', fila.dataset.fecha === estado.epoca);
			});
		});
		rutas.forEach((r) => {
			// Los elementos SVG no tienen la propiedad `hidden`: hay que usar el atributo.
			r.toggleAttribute('hidden', !visibles.has(r.dataset.slug ?? ''));
		});
		if (contador) contador.textContent = String(visibles.size);

		// Si el filtro oculta la tarjeta seleccionada, la selección se limpia.
		if (estado.seleccion && !visibles.has(estado.seleccion)) estado.seleccion = null;

		if (estado.seleccion) mapa!.dataset.seleccion = estado.seleccion;
		else delete mapa!.dataset.seleccion;
		rutas.forEach((r) => r.toggleAttribute('data-seleccionada', r.dataset.slug === estado.seleccion));
		tarjetas.forEach((t) => {
			const activa = t.dataset.slug === estado.seleccion;
			t.toggleAttribute('data-seleccionada', activa);
			t.querySelector('[data-ver-en-mapa]')?.setAttribute('aria-pressed', String(activa));
		});
		colocarTooltip(estado.seleccion);
	}

	function seleccionar(slug: string): void {
		const deseleccionar = estado.seleccion === slug;
		estado.seleccion = deseleccionar ? null : slug;
		pintar();
		// El mapa queda encima de las tarjetas: si no se ve entero, se lleva a la vista.
		if (!deseleccionar && wrap) {
			const caja = wrap.getBoundingClientRect();
			if (caja.top < 64 || caja.bottom > window.innerHeight) {
				wrap.scrollIntoView({
					behavior: prefiereMenosMovimiento() ? 'auto' : 'smooth',
					block: 'start',
				});
			}
		}
	}

	botonesGrupo.forEach((b) =>
		b.addEventListener('click', () => {
			estado.grupo = b.dataset.filtroGrupo as FiltroGrupo;
			pintar();
		}),
	);
	botonesEpoca.forEach((b) =>
		b.addEventListener('click', () => {
			estado.epoca = b.dataset.filtroEpoca as Epoca;
			pintar();
		}),
	);

	tarjetas.forEach((t) => {
		const boton = t.querySelector<HTMLElement>('[data-ver-en-mapa]');
		if (!boton) return;
		boton.hidden = false;
		boton.addEventListener('click', () => seleccionar(t.dataset.slug ?? ''));
	});

	mapa.addEventListener('click', () => {
		if (estado.seleccion) {
			estado.seleccion = null;
			pintar();
		}
	});
	window.addEventListener('resize', () => colocarTooltip(estado.seleccion));
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && estado.seleccion) {
			estado.seleccion = null;
			pintar();
		}
	});

	pintar();
}
