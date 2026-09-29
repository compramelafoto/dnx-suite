export const ATAJOS_PERIODO = [
  "hoy", "esta-semana", "semana-pasada", "este-mes", "mes-pasado", "ultimos-3-meses", "este-anio", "anio-pasado",
] as const;
export type AtajoPeriodo = (typeof ATAJOS_PERIODO)[number];

export function esAtajoPeriodo(v: string): v is AtajoPeriodo {
  return (ATAJOS_PERIODO as readonly string[]).includes(v);
}

const FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function esRangoValido(valor: string): boolean {
  const [desde, hasta, ...resto] = valor.split("..");
  if (resto.length || !desde || !hasta || !FECHA.test(desde) || !FECHA.test(hasta)) return false;
  return desde <= hasta;
}
