export function formatoRango(valor: number | [number, number], unidad: string): string {
	if (Array.isArray(valor)) {
		const [min, max] = valor;
		return min === max ? `${min} ${unidad}` : `${min}–${max} ${unidad}`;
	}
	return `${valor} ${unidad}`;
}

export const ABUNDANCIA_LABEL: Record<string, string> = {
	muy_comun: 'Muy común',
	comun: 'Común',
	escaso: 'Escaso',
	raro: 'Raro',
};

export const HABITAT_LABEL: Record<string, string> = {
	olivar: 'Olivar',
	huertas: 'Huertas',
	bordes_de_camino: 'Bordes de camino',
	jardines: 'Jardines',
	pinar: 'Pinar',
	encinar: 'Encinar',
	matorral_mediterraneo: 'Matorral mediterráneo',
	cortados_rocosos: 'Cortados rocosos',
	rios_y_arroyos: 'Ríos y arroyos',
	embalses: 'Embalses',
	campos_cultivo: 'Campos de cultivo',
	cielo_abierto: 'Cielo abierto',
	taludes_arenosos: 'Taludes arenosos',
	casco_urbano: 'Casco urbano',
};

export const UICN_LABEL: Record<string, { sigla: string; texto: string; color: string }> = {
	LC: { sigla: 'LC', texto: 'Preocupación menor', color: 'bg-olivo-100 text-olivo-800' },
	NT: { sigla: 'NT', texto: 'Casi amenazada', color: 'bg-yellow-100 text-yellow-800' },
	VU: { sigla: 'VU', texto: 'Vulnerable', color: 'bg-orange-100 text-orange-800' },
	EN: { sigla: 'EN', texto: 'En peligro', color: 'bg-red-100 text-red-800' },
	CR: { sigla: 'CR', texto: 'En peligro crítico', color: 'bg-red-200 text-red-900' },
	DD: { sigla: 'DD', texto: 'Datos insuficientes', color: 'bg-tierra-100 text-tierra-800' },
	EX: { sigla: 'EX', texto: 'Extinta', color: 'bg-tierra-900 text-tierra-50' },
};
