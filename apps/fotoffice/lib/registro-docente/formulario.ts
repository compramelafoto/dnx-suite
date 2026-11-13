import { CATEGORIAS, claveDePeriodoNueva, valorValido, type ClaveRegla, type Periodo, type Reglas } from "./reglas";

/**
 * Lee de un formulario el valor de una regla. Puro (recibe un «get»), así se prueba sin Next.
 * Devuelve `{ ok: false }` con un mensaje claro cuando el valor no sirve.
 */
export type Getter = (nombre: string) => string;

export function getterDe(fd: FormData): Getter {
  return (n) => {
    const v = fd.get(n);
    return typeof v === "string" ? v.trim() : "";
  };
}

const numero = (s: string): number | null => {
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function leerValorRegla(
  clave: ClaveRegla,
  g: Getter,
  actuales: Pick<Reglas, "periodos">,
): { ok: true; valor: unknown } | { ok: false; error: string } {
  let valor: unknown;
  switch (clave) {
    case "decimales":
    case "justificadaCuenta":
    case "ppi":
      valor = g("valor") === "si";
      break;
    case "notaMinima":
    case "notaMaxima":
    case "notaAprobacion":
    case "faltaPorTarde":
    case "faltaPorRetiro":
      valor = numero(g("valor"));
      break;
    case "limiteFaltas":
      valor = g("valor") === "" ? null : numero(g("valor"));
      break;
    case "redondeo":
    case "recuperatorio":
    case "destino":
      valor = g("valor");
      break;
    case "pesos":
      valor = Object.fromEntries(CATEGORIAS.map((c) => [c, numero(g(`peso_${c}`)) ?? 0]));
      break;
    case "periodos":
      valor = leerPeriodos(g, actuales.periodos);
      break;
  }
  if (!valorValido(clave, valor)) {
    const mensajes: Partial<Record<ClaveRegla, string>> = {
      pesos: "Los pesos van de 0 a 100 y al menos uno tiene que ser mayor que 0.",
      periodos: "Cada período necesita un nombre, y las fechas tienen que ser válidas.",
      faltaPorTarde: "Va de 0 a 1 (por ejemplo 0,5 = media falta).",
      faltaPorRetiro: "Va de 0 a 1 (por ejemplo 0,5 = media falta).",
    };
    return { ok: false, error: mensajes[clave] ?? "Ese valor no sirve para esta regla." };
  }
  return { ok: true, valor };
}

/**
 * Los períodos llegan como filas `periodo_<i>_clave|nombre|desde|hasta|cargaDesde|cargaHasta`,
 * más `periodo_<i>_quitar` y una fila nueva `periodo_nuevo_nombre`. La clave de los existentes se
 * respeta (las notas la guardan); a uno nuevo se le da una clave que nunca se usó.
 */
function leerPeriodos(g: Getter, actuales: readonly Periodo[]): Periodo[] {
  const out: Periodo[] = [];
  const fecha = (s: string) => (s ? s : null);
  for (let i = 0; i < 12; i++) {
    const clave = g(`periodo_${i}_clave`);
    if (!clave) continue;
    if (g(`periodo_${i}_quitar`) === "on") continue;
    out.push({
      clave,
      nombre: g(`periodo_${i}_nombre`),
      desde: fecha(g(`periodo_${i}_desde`)),
      hasta: fecha(g(`periodo_${i}_hasta`)),
      cargaDesde: fecha(g(`periodo_${i}_cargaDesde`)),
      cargaHasta: fecha(g(`periodo_${i}_cargaHasta`)),
    });
  }
  const nuevo = g("periodo_nuevo_nombre");
  if (nuevo) {
    out.push({
      clave: claveDePeriodoNueva([...actuales, ...out]),
      nombre: nuevo,
      desde: fecha(g("periodo_nuevo_desde")),
      hasta: fecha(g("periodo_nuevo_hasta")),
      cargaDesde: null,
      cargaHasta: null,
    });
  }
  return out;
}

/** Texto opcional recortado: vacío → null. */
export function opcional(s: string, max = 200): string | null {
  const t = s.trim().slice(0, max);
  return t ? t : null;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
export function fechaOpcional(s: string): string | null {
  return FECHA.test(s) ? s : null;
}
