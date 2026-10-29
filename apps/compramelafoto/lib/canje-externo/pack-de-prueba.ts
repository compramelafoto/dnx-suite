/**
 * Reglas puras del pack de prueba del fotógrafo ("Probar como cliente").
 *
 * Sin base de datos a propósito: lo que decide qué pack se copia, qué plantilla lleva el
 * librito y qué datos de la familia viajan con la prueba se prueba con tests unitarios. La
 * parte que lee y escribe está en `crear-pack-de-prueba.ts`.
 */

import { EXTERNAL_PREVENTA_KIND, EXTERNAL_SIN_EMAIL, parseExternalPreventaRefs } from "./external-preventa";

/** Clave dentro de `redemptionPaymentRefsJson` con lo propio de la prueba. */
export const PACK_DE_PRUEBA_KEY = "packDePrueba";

/**
 * El alumno de la prueba cuando el álbum no tiene ni compras ni padrón: un nombre creíble (en el
 * orden del Excel, apellido primero), porque la prueba se muestra en demos y charlas.
 */
export const ALUMNO_DE_MUESTRA = "López Martina";

type SnapshotBenefitLike = {
  stableKey: string;
  benefitDefinitionId: number;
  kind: string;
  templatePolicy: string;
  templateV2Id?: string | null;
  [k: string]: unknown;
};

type SnapshotLike = {
  redemptionDeadlineAt?: string | null;
  benefits: SnapshotBenefitLike[];
  [k: string]: unknown;
};

export type PlantillasParaPrueba = {
  /** Plantilla asignada hoy en la definición del beneficio (BenefitDefinition.templateV2Id). */
  porBeneficio: ReadonlyMap<number, string>;
  /** Plantilla que ya tenía el pack de prueba anterior, por `stableKey`. */
  porPruebaAnterior: ReadonlyMap<string, string>;
};

/**
 * Snapshot del pack de prueba a partir del de un pack real, sin tocar el real.
 *
 * - El plazo de canje se quita: la prueba se tiene que poder hacer aunque el de las familias
 *   haya vencido.
 * - El librito lleva la plantilla que corresponde hoy: la de la definición del beneficio si el
 *   fotógrafo la asignó, si no la que ya traía el pack, si no la del pack de prueba anterior.
 *   Con plantilla, el diseño pasa a obligatorio (así la familia lo ve armado antes de confirmar).
 */
export function prepararSnapshotDePrueba<T extends SnapshotLike>(snapshot: T, plantillas: PlantillasParaPrueba): T {
  return {
    ...snapshot,
    redemptionDeadlineAt: null,
    benefits: snapshot.benefits.map((b) => {
      const plantilla =
        plantillas.porBeneficio.get(b.benefitDefinitionId) ||
        (typeof b.templateV2Id === "string" && b.templateV2Id.trim() ? b.templateV2Id.trim() : null) ||
        plantillas.porPruebaAnterior.get(b.stableKey) ||
        null;
      if (!plantilla) return { ...b };
      return { ...b, templateV2Id: plantilla, templatePolicy: "REQUIRED" };
    }),
  };
}

/** Plantillas por `stableKey` de un snapshot (para heredarlas del pack de prueba anterior). */
export function plantillasDelSnapshot(raw: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!raw || typeof raw !== "object") return out;
  const benefits = (raw as { benefits?: unknown }).benefits;
  if (!Array.isArray(benefits)) return out;
  for (const b of benefits) {
    if (!b || typeof b !== "object") continue;
    const key = (b as { stableKey?: unknown }).stableKey;
    const tpl = (b as { templateV2Id?: unknown }).templateV2Id;
    if (typeof key === "string" && typeof tpl === "string" && tpl.trim()) out.set(key, tpl.trim());
  }
  return out;
}

export type PackCandidato = {
  id: number;
  /** Cantidad de beneficios del snapshot (0 si no se pudo leer). */
  beneficios: number;
  /** Algún beneficio arma diseño (librito). */
  conDiseno: boolean;
};

/**
 * Qué pack real se copia para la prueba: el más completo, así el fotógrafo recorre todos los
 * pasos (primero el que arma un librito, después el de más beneficios, después el más nuevo).
 */
export function elegirPackFuente(candidatos: PackCandidato[]): number | null {
  const validos = candidatos.filter((c) => c.beneficios > 0);
  if (validos.length === 0) return null;
  validos.sort(
    (a, b) =>
      Number(b.conDiseno) - Number(a.conDiseno) || b.beneficios - a.beneficios || b.id - a.id
  );
  return validos[0]!.id;
}

/** El pack arma algún diseño (librito) con su plantilla actual o la que traía. */
export function snapshotArmaDiseno(raw: unknown, porBeneficio: ReadonlyMap<number, string>): boolean {
  if (!raw || typeof raw !== "object") return false;
  const benefits = (raw as { benefits?: unknown }).benefits;
  if (!Array.isArray(benefits)) return false;
  return benefits.some((b) => {
    if (!b || typeof b !== "object") return false;
    const r = b as { templateV2Id?: unknown; benefitDefinitionId?: unknown };
    return (
      (typeof r.templateV2Id === "string" && r.templateV2Id.trim() !== "") ||
      (typeof r.benefitDefinitionId === "number" && porBeneficio.has(r.benefitDefinitionId))
    );
  });
}

export function cantidadDeBeneficios(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  const benefits = (raw as { benefits?: unknown }).benefits;
  return Array.isArray(benefits) ? benefits.length : 0;
}

export type DatosDeFamiliaPrueba = {
  /** Va a `redemptionPaymentRefsJson`: alumno, curso, colegio y adulto de la prueba. */
  refs: Record<string, unknown>;
  buyerName: string | null;
  /** El email del pack: el del fotógrafo, o el "sin email" si la familia real lo carga al canjear. */
  buyerEmail: string;
};

/**
 * Datos de la familia que viajan con la prueba.
 *
 * Pack cobrado por fuera: se copian alumno y curso del pack real (el librito se arma con ellos)
 * y el email queda "sin email", igual que el de la familia: al canjear se piden los datos de
 * contacto, como le pasa a ella. Lo que se escriba ahí no recibe nada: la prueba no manda correos.
 *
 * Pack comprado en la plataforma: el alumno sale de la compra escolar, pero NO se copia la
 * referencia a esa compra (el canje escribiría sobre la de la familia real); viaja como datos
 * sueltos. El email es el del fotógrafo.
 */
export function datosDeFamiliaParaPrueba(input: {
  refsFuente: unknown;
  buyerNameFuente: string | null;
  emailFotografo: string;
  preCompra?: {
    studentFirstName: string | null;
    studentLastName: string | null;
    buyerName: string | null;
    curso: string | null;
  } | null;
  colegio: string | null;
}): DatosDeFamiliaPrueba {
  const externo = parseExternalPreventaRefs(input.refsFuente);
  if (externo) {
    return {
      refs: { ...(input.refsFuente as Record<string, unknown>), [PACK_DE_PRUEBA_KEY]: { pedirContacto: true } },
      buyerName: input.buyerNameFuente ?? externo.parentName ?? null,
      buyerEmail: EXTERNAL_SIN_EMAIL,
    };
  }
  const pc = input.preCompra;
  // Mismo orden que el Excel de las preventas por fuera (apellido primero): así lo parte
  // `splitExcelStudentName` para el librito.
  const alumno = pc ? [pc.studentLastName, pc.studentFirstName].filter((s) => s && s.trim()).join(" ").trim() : "";
  const adulto = pc?.buyerName?.trim() || input.buyerNameFuente?.trim() || null;
  return {
    refs: {
      kind: EXTERNAL_PREVENTA_KIND,
      studentName: alumno || ALUMNO_DE_MUESTRA,
      parentName: adulto,
      courseName: pc?.curso?.trim() || null,
      schoolName: input.colegio,
      label: null,
      [PACK_DE_PRUEBA_KEY]: { pedirContacto: false },
    },
    buyerName: adulto,
    buyerEmail: input.emailFotografo,
  };
}

/** Al reiniciar: el email del pack vuelve a ser el de antes de canjear. */
export function emailDelPackReiniciado(refs: unknown, emailActual: string, emailFotografo: string | null): string {
  if (refs && typeof refs === "object") {
    const meta = (refs as Record<string, unknown>)[PACK_DE_PRUEBA_KEY];
    if (meta && typeof meta === "object") {
      return (meta as { pedirContacto?: unknown }).pedirContacto === true
        ? EXTERNAL_SIN_EMAIL
        : (emailFotografo ?? emailActual);
    }
  }
  return emailActual;
}

/**
 * Un solo pack de prueba por álbum: si el último todavía no se canjeó se reusa (se le actualiza
 * el contenido y el link); si ya se canjeó, se crea una copia nueva y el canje viejo queda como
 * pedido DEMO.
 */
export function accionSobrePackDePrueba(previa: { id: number; redemptionOrderId: number | null } | null):
  | { tipo: "reusar"; orderId: number }
  | { tipo: "crear" } {
  if (previa && previa.redemptionOrderId == null) return { tipo: "reusar", orderId: previa.id };
  return { tipo: "crear" };
}

/** Pedido de canje de una prueba del fotógrafo: se lista en Pedidos como DEMO. */
export function esPedidoDemo(o: { isTest: boolean; origin: string | null | undefined }): boolean {
  return o.isTest === true && o.origin === "PACK_REDEMPTION";
}

/** Saca los pedidos DEMO de cualquier total, conteo o indicador. */
export function sinPedidosDemo<T extends { isDemo?: boolean }>(rows: T[]): T[] {
  return rows.filter((r) => r.isDemo !== true);
}
