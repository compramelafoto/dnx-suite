/**
 * Archivo de mapeo del histórico: concepto → rubro (y su clase), estimados y avisos. Módulo PURO.
 *
 * Es un JSON versionado que vive FUERA del repositorio cuando trae datos de un cliente real.
 * La clase de cada rubro tiene que coincidir con su código (spec 7.1): así el histórico se suma
 * con el mismo criterio que los informes de Caja.
 */
import { z } from "zod";
import { CLASES_HISTORICO, esMes, type ClaseHistorico, type FilaCsv } from "./tipos";

const mes = z.string().refine(esMes, "mes inválido (AAAA-MM)");

const RubroSchema = z.object({
  codigo: z.string().trim().min(1),
  nombre: z.string().trim().min(1),
  clase: z.enum(CLASES_HISTORICO),
});

const ReglaSchema = z.object({
  /** Concepto normalizado (se compara sin mayúsculas ni espacios de más). */
  concepto: z.string().trim().min(1),
  rubro: z.string().trim().min(1),
  confianza: z.enum(["alta", "media", "baja"]),
  /** Sólo para importes positivos (+) o negativos (−). */
  signo: z.enum(["+", "-"]).optional(),
  /** Sólo si |importe| ≥ este monto, en pesos. */
  montoMinimo: z.number().positive().optional(),
  nota: z.string().optional(),
});

const EstimadoSchema = z.object({
  concepto: z.string().trim().min(1),
  rubro: z.string().trim().min(1),
  /** Pesos por mes (positivo: se guarda como egreso). */
  montoMensual: z.number().positive(),
  desde: mes,
  hasta: mes,
  /** Día del mes en que se fecha (1 por omisión; se recorta al último día). */
  dia: z.number().int().min(1).max(31).optional(),
  /** No se estima si ese mes el libro ya tiene un egreso con alguno de estos conceptos. */
  soloSiNoHay: z.array(z.string()).optional(),
  nota: z.string().optional(),
});

const AvisoSchema = z.object({ desde: mes, hasta: mes, texto: z.string().trim().min(1) });

export const MapeoSchema = z.object({
  version: z.literal(1),
  rubros: z.array(RubroSchema),
  reglas: z.array(ReglaSchema),
  estimados: z.array(EstimadoSchema).default([]),
  avisos: z.array(AvisoSchema).default([]),
});

export type MapeoHistorico = z.input<typeof MapeoSchema>;
export type MapeoValidado = z.output<typeof MapeoSchema>;
export type ReglaMapeo = z.output<typeof ReglaSchema>;
export type EstimadoMapeo = z.output<typeof EstimadoSchema>;

/** Clase que corresponde a un código de rubro, por su primer dígito. */
export function claseEsperadaDeCodigo(codigo: string): ClaseHistorico | null {
  const c = codigo.trim().charAt(0);
  if (c === "3") return "INGRESO";
  if (c === "4") return "COSTO_VARIABLE";
  if (c === "5") return "GASTO_FIJO";
  if (c === "6") return "RETIRO_DUENO";
  if (c === "0") return "MOVIMIENTO_INTERNO";
  return null;
}

export function normalizarConcepto(texto: string): string {
  return texto.normalize("NFC").trim().replace(/\s+/g, " ").toUpperCase();
}

export function claveDeRegla(r: Pick<ReglaMapeo, "concepto" | "signo" | "montoMinimo">): string {
  return `${normalizarConcepto(r.concepto)}|${r.signo ?? "*"}|${r.montoMinimo ?? 0}`;
}

export function validarMapeo(
  entrada: unknown,
): { ok: true; mapeo: MapeoValidado } | { ok: false; errores: string[] } {
  const p = MapeoSchema.safeParse(entrada);
  if (!p.success) {
    return { ok: false, errores: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  const m = p.data;
  const errores: string[] = [];
  const codigos = new Set<string>();
  for (const r of m.rubros) {
    if (codigos.has(r.codigo)) errores.push(`Código de rubro repetido: ${r.codigo}.`);
    codigos.add(r.codigo);
    const esperada = claseEsperadaDeCodigo(r.codigo);
    if (esperada === null) errores.push(`El código ${r.codigo} no empieza con 0, 3, 4, 5 ni 6.`);
    else if (esperada !== r.clase) errores.push(`El rubro ${r.codigo} dice ${r.clase} pero su código es de ${esperada}.`);
  }
  const claves = new Set<string>();
  for (const r of m.reglas) {
    if (!codigos.has(r.rubro)) errores.push(`La regla de "${r.concepto}" usa el rubro ${r.rubro}, que no existe.`);
    const k = claveDeRegla(r);
    if (claves.has(k)) errores.push(`Regla repetida: ${k}.`);
    claves.add(k);
  }
  for (const e of m.estimados) {
    if (!codigos.has(e.rubro)) errores.push(`El estimado "${e.concepto}" usa el rubro ${e.rubro}, que no existe.`);
    if (e.desde > e.hasta) errores.push(`El estimado "${e.concepto}" termina antes de empezar.`);
  }
  for (const a of m.avisos) {
    if (a.desde > a.hasta) errores.push(`El aviso "${a.texto}" termina antes de empezar.`);
  }
  return errores.length > 0 ? { ok: false, errores } : { ok: true, mapeo: m };
}

export type Clasificacion = {
  clase: ClaseHistorico;
  rubroCodigo: string | null;
  rubroNombre: string | null;
  regla: string | null;
  confianza: ReglaMapeo["confianza"] | null;
};

const SIN_CLASIFICAR: Clasificacion = { clase: "SIN_CLASIFICAR", rubroCodigo: null, rubroNombre: null, regla: null, confianza: null };

/** Más específica primero: con monto mínimo (el mayor), después con signo, después la general. */
function especificidad(r: ReglaMapeo): number {
  return (r.montoMinimo ?? 0) * 10 + (r.signo ? 1 : 0);
}

export function clasificarFila(
  fila: Pick<FilaCsv, "conceptoNormalizado" | "centavos">,
  mapeo: MapeoHistorico | MapeoValidado,
): Clasificacion {
  const concepto = normalizarConcepto(fila.conceptoNormalizado);
  const absPesos = Math.abs(fila.centavos) / 100;
  const signo = fila.centavos >= 0 ? "+" : "-";
  const candidatas = (mapeo.reglas as ReglaMapeo[])
    .filter((r) => normalizarConcepto(r.concepto) === concepto)
    .filter((r) => !r.signo || r.signo === signo)
    .filter((r) => r.montoMinimo === undefined || absPesos >= r.montoMinimo)
    .sort((a, b) => especificidad(b) - especificidad(a));
  const regla = candidatas[0];
  if (!regla) return SIN_CLASIFICAR;
  const rubro = mapeo.rubros.find((r) => r.codigo === regla.rubro);
  if (!rubro) return SIN_CLASIFICAR;
  return { clase: rubro.clase, rubroCodigo: rubro.codigo, rubroNombre: rubro.nombre, regla: claveDeRegla(regla), confianza: regla.confianza };
}
