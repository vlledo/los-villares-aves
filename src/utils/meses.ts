import { meses } from '../content.config';

export const MES_LARGO: Record<(typeof meses)[number], string> = {
	ene: 'Enero',
	feb: 'Febrero',
	mar: 'Marzo',
	abr: 'Abril',
	may: 'Mayo',
	jun: 'Junio',
	jul: 'Julio',
	ago: 'Agosto',
	sep: 'Septiembre',
	oct: 'Octubre',
	nov: 'Noviembre',
	dic: 'Diciembre',
};

export const MES_INICIAL: Record<(typeof meses)[number], string> = {
	ene: 'E',
	feb: 'F',
	mar: 'M',
	abr: 'A',
	may: 'M',
	jun: 'J',
	jul: 'J',
	ago: 'A',
	sep: 'S',
	oct: 'O',
	nov: 'N',
	dic: 'D',
};

export const PRESENCIA_COLOR: Record<string, string> = {
	residente: 'bg-olivo-600 text-white',
	estival: 'bg-amber-500 text-white',
	invernante: 'bg-sky-600 text-white',
	paso: 'bg-olivo-300 text-olivo-900',
	raro: 'bg-rose-300 text-rose-900',
	ausente: 'bg-tierra-50 text-tierra-300 ring-1 ring-inset ring-tierra-200',
};

export const PRESENCIA_LABEL: Record<string, string> = {
	residente: 'Residente',
	estival: 'Estival',
	invernante: 'Invernante',
	paso: 'De paso',
	raro: 'Raro',
	ausente: 'Ausente',
};
