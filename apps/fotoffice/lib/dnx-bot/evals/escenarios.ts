import type { Capacidades } from "../acceso";

/**
 * Banco de escenarios de `bot:eval` (spec §10). Se corre contra la API real con las herramientas
 * reales cuyo `run`/`describe` sólo registran la llamada: GASTA PLATA, sólo con permiso de Daniel.
 * Base (PR 1): vacío. Las etapas suman los casos 1–5, 6–13 y 14–20.
 */
export type Escenario = {
  id: string;
  situacion: string;
  mensaje: string;
  /** Lo que se pisa de un dueño con todo (p. ej. `{ configurar: false }` para un STAFF). */
  capacidades?: Partial<Capacidades>;
  debeUsar?: string[];
  /** Al menos una de estas herramientas tiene que usarse. */
  debeUsarAlguna?: string[];
  noDebeUsar?: string[];
  textoNoDebeContener?: RegExp[];
  /** Por herramienta: valores que tiene que traer CADA llamada que se haga a esa herramienta. */
  entradaEsperada?: Record<string, Record<string, unknown>>;
  /** Para el verificador de cifras (etapa 1): las únicas cifras que el texto puede tener. */
  cifrasPermitidas?: string[];
};

export type LlamadaRegistrada = { herramienta: string; entrada: unknown };

export const ESCENARIOS: Escenario[] = [];

/** Llamadas cuya entrada no trae alguno de los valores pedidos en `entradaEsperada`. */
export function fallasDeEntrada(e: Escenario, llamadas: LlamadaRegistrada[]): string[] {
  const fallas: string[] = [];
  for (const [herramienta, esperado] of Object.entries(e.entradaEsperada ?? {})) {
    for (const l of llamadas.filter((x) => x.herramienta === herramienta)) {
      const entrada = (l.entrada ?? {}) as Record<string, unknown>;
      for (const [campo, valor] of Object.entries(esperado)) {
        if (entrada[campo] !== valor) {
          fallas.push(`${herramienta} con ${campo}=${JSON.stringify(entrada[campo])} (se esperaba ${JSON.stringify(valor)})`);
        }
      }
    }
  }
  return fallas;
}
