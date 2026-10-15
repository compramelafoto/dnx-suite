/** Opciones del script `caja:importar-historico` y lectura del resumen de referencia. Módulo PURO. */
import Papa from "papaparse";
import { pesosACentavos } from "./csv";
import type { ReferenciaMes } from "./reporte";
import { esMes } from "./tipos";

export type OpcionesImportacion = {
  csv: string[];
  mapeo: string;
  /** `null` = todos los meses del archivo. */
  meses: string[] | null;
  reporte: string | null;
  referencia: string | null;
  aplicar: boolean;
  workspace: string | null;
  reemplazarConfirmado: boolean;
  mesActual: string | null;
};

export const USO_IMPORTACION = [
  "Uso:",
  "  En seco (no abre la base):",
  "    pnpm --filter fotoffice caja:importar-historico --csv <movimientos.csv> [--csv <otro.csv>] --mapeo <mapeo.json> \\",
  "      [--mes AAAA-MM ...] [--reporte <informe.md>] [--referencia <resumen_mensual.csv>]",
  "  Escribiendo borradores (un mes por vez, o --todos):",
  "    DATABASE_URL_FOTOFFICE=... pnpm --filter fotoffice caja:importar-historico ... --aplicar --workspace <slug> --mes AAAA-MM",
  "    [--reemplazar-confirmado]",
].join("\n");

export function opcionesDeImportacion(args: readonly string[]): { ok: true; opciones: OpcionesImportacion } | { ok: false; error: string } {
  const o: OpcionesImportacion = { csv: [], mapeo: "", meses: null, reporte: null, referencia: null, aplicar: false, workspace: null, reemplazarConfirmado: false, mesActual: null };
  let todos = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const valor = () => {
      const v = args[i + 1];
      if (v === undefined || v.startsWith("--")) throw new Error(`Falta el valor de ${a}.`);
      i += 1;
      return v;
    };
    try {
      if (a === "--csv") o.csv.push(valor());
      else if (a === "--mapeo") o.mapeo = valor();
      else if (a === "--mes") o.meses = [...(o.meses ?? []), valor()];
      else if (a === "--reporte") o.reporte = valor();
      else if (a === "--referencia") o.referencia = valor();
      else if (a === "--workspace") o.workspace = valor();
      else if (a === "--mes-actual") o.mesActual = valor();
      else if (a === "--aplicar") o.aplicar = true;
      else if (a === "--todos") todos = true;
      else if (a === "--reemplazar-confirmado") o.reemplazarConfirmado = true;
      else return { ok: false, error: `Opción desconocida: ${a}` };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
  if (o.csv.length === 0) return { ok: false, error: "Falta --csv." };
  if (!o.mapeo) return { ok: false, error: "Falta --mapeo." };
  const malos = [...(o.meses ?? []), ...(o.mesActual ? [o.mesActual] : [])].filter((m) => !esMes(m));
  if (malos.length) return { ok: false, error: `Mes inválido: ${malos.join(", ")} (AAAA-MM).` };
  if (o.aplicar && !o.workspace) return { ok: false, error: "--aplicar necesita --workspace <slug>." };
  if (o.aplicar && !o.meses && !todos) return { ok: false, error: "--aplicar necesita --mes AAAA-MM (o --todos): los meses se cargan y se revisan de a uno." };
  return { ok: true, opciones: o };
}

/** `resumen_mensual.csv`: columnas `mes`, `ingresos_total` y `egresos_total` (pesos con signo). */
export function leerReferencia(texto: string): Map<string, ReferenciaMes> {
  const r = Papa.parse<Record<string, string>>(texto, { header: true, skipEmptyLines: "greedy" });
  const out = new Map<string, ReferenciaMes>();
  for (const f of r.data) {
    const ing = pesosACentavos(f.ingresos_total ?? "");
    const egr = pesosACentavos(f.egresos_total ?? "");
    if (f.mes && esMes(f.mes) && ing !== null && egr !== null) out.set(f.mes, { ingresosCentavos: ing, egresosCentavos: egr });
  }
  return out;
}
