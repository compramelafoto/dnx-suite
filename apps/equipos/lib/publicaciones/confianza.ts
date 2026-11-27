import type { GearListingUsageSeal } from "./catalogos";

export type TrustLevel = "BASICO" | "BUENO" | "ALTO" | "MAXIMO";

/** Puntos: uso verificado 3 o serie con foto 2 (excluyentes), factura 2, disparos leídos 2. */
export function computeTrust(input: {
  usageSeal: GearListingUsageSeal;
  hasPurchaseProof: boolean;
  shutterVerified: boolean;
  /**
   * Resultado REAL de la revisión de denuncias (`findActiveReportForSerial`). La línea «Sin
   * denuncias…» sólo aparece cuando es `true`: nunca se afirma algo que no se revisó.
   */
  noActiveReport: boolean;
  /** Fecha de la revisión de denuncias; por defecto, hoy. */
  checkedAt?: Date;
}): { points: number; level: TrustLevel; verified: string[] } {
  let points = 0;
  // Una publicación que se muestra siempre tiene al vendedor verificado; esa línea y la de
  // denuncias (si se revisó y no hay) van primero y no suman puntos.
  const fecha = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(input.checkedAt ?? new Date());
  const verified: string[] = ["Identidad del vendedor verificada"];
  if (input.noActiveReport) {
    verified.push(`Sin denuncias de robo ni pérdida en el portal (revisado el ${fecha})`);
  }
  if (input.usageSeal === "USAGE_VERIFIED") {
    points += 3;
    verified.push("Uso verificado en CompraMeLaFoto");
  } else if (input.usageSeal === "PROOF_PHOTO") {
    points += 2;
    verified.push("Serie comprobada con foto del equipo");
  }
  if (input.hasPurchaseProof) {
    points += 2;
    verified.push("Factura de compra presentada");
  }
  if (input.shutterVerified) {
    points += 2;
    verified.push("Cantidad de disparos leída de los metadatos");
  }
  const level: TrustLevel =
    points >= 6 ? "MAXIMO" : points >= 4 ? "ALTO" : points >= 2 ? "BUENO" : "BASICO";
  return { points, level, verified };
}

/** Lo que el vendedor declara: se muestra pero nunca suma puntos. */
export function declaredItems(l: {
  declaredFirstOwner: boolean;
  includesCharger: boolean;
  batteriesCount: number | null;
  includesManual: boolean;
  includesBox: boolean;
}): string[] {
  const out: string[] = [];
  if (l.declaredFirstOwner) out.push("Primer dueño");
  if (l.includesCharger) out.push("Incluye cargador");
  if (l.batteriesCount != null && l.batteriesCount > 0) {
    out.push(l.batteriesCount === 1 ? "1 batería" : `${l.batteriesCount} baterías`);
  }
  if (l.includesManual) out.push("Incluye manual");
  if (l.includesBox) out.push("Incluye caja original");
  return out;
}

export function usageSealText(
  seal: GearListingUsageSeal,
  since: Date | null,
  photos: number | null,
): string | null {
  if (seal === "PROOF_PHOTO") return "Serie comprobada con foto del equipo";
  if (seal === "USAGE_VERIFIED" && since) {
    const mes = new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      month: "long",
      year: "numeric",
    })
      .formatToParts(since)
      .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {} as Record<string, string>);
    const n = photos ?? 0;
    return `Usado por el vendedor desde ${mes.month} de ${mes.year}, en ${n} ${n === 1 ? "foto" : "fotos"}`;
  }
  return null;
}
