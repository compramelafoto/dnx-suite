/**
 * Módulo PURO: imprimir varias hojas en un documento (una página por copia) y convertir la
 * respuesta de "¿Cómo salió?" en registros. Lo usan la página de impresión y el servidor.
 */

export type HojaAImprimir = { hojaId: string; version: string; copias: number };
export type RegistroDeHoja = { hojaId: string; motivo: "NORMAL" | "DESCARTADA"; hojas: number };

export function paginas(hojas: HojaAImprimir[]): { hojaId: string; version: string; copia: number }[] {
  return hojas.flatMap((h) => Array.from({ length: h.copias }, (_, i) => ({ hojaId: h.hojaId, version: h.version, copia: i + 1 })));
}

/** Lo que falta imprimir: a cada hoja se le descuentan las que ya salieron bien. */
export function pendientes(hojas: HojaAImprimir[], impresas: ReadonlyMap<string, number>): HojaAImprimir[] {
  return hojas.map((h) => ({ ...h, copias: h.copias - (impresas.get(h.hojaId) ?? 0) })).filter((h) => h.copias > 0);
}

/**
 * `malas`: por hoja, cuántas copias salieron mal (falta = 0). Las buenas van NORMAL; las malas,
 * DESCARTADA (el desperdicio también cuenta en el gasto) y se vuelven a imprimir.
 */
export function registrosDeRespuesta(
  hojas: HojaAImprimir[],
  malas: Readonly<Record<string, number>>,
): { registros: RegistroDeHoja[]; reimprimir: HojaAImprimir[] } {
  const registros: RegistroDeHoja[] = [];
  const reimprimir: HojaAImprimir[] = [];
  for (const h of hojas) {
    const m = Math.min(h.copias, Math.max(0, Math.round(malas[h.hojaId] ?? 0)));
    if (h.copias - m > 0) registros.push({ hojaId: h.hojaId, motivo: "NORMAL", hojas: h.copias - m });
    if (m > 0) {
      registros.push({ hojaId: h.hojaId, motivo: "DESCARTADA", hojas: m });
      reimprimir.push({ ...h, copias: m });
    }
  }
  return { registros, reimprimir };
}
