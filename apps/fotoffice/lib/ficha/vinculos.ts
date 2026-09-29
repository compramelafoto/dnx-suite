/**
 * Los vínculos entre personas. Cada uno se lee distinto según de qué lado se lo mire:
 * "madre-padre" es "Madre o padre" para quien figura como origen y "Hijo o hija" para el
 * otro extremo. Módulo PURO (sin base de datos).
 */
export type Vinculo = { clave: string; desde: string; hacia: string };

export const CLAVE_VINCULO_LIBRE = "otro";
export const MAX_ETIQUETA_LIBRE = 40;

export const VINCULOS: readonly Vinculo[] = [
  { clave: "madre-padre", desde: "Madre o padre", hacia: "Hijo o hija" },
  { clave: "pareja", desde: "Pareja", hacia: "Pareja" },
  { clave: "hermano", desde: "Hermano o hermana", hacia: "Hermano o hermana" },
  { clave: "abuelo", desde: "Abuelo o abuela", hacia: "Nieto o nieta" },
  { clave: "tio", desde: "Tío o tía", hacia: "Sobrino o sobrina" },
  { clave: "proveedor", desde: "Proveedor", hacia: "Cliente" },
  { clave: "empleado", desde: "Empleado", hacia: "Empleador" },
  { clave: "amigo", desde: "Amigo o amiga", hacia: "Amigo o amiga" },
  // Texto libre: el mismo en los dos lados. Los textos van en `customLabel`.
  { clave: CLAVE_VINCULO_LIBRE, desde: "Otro", hacia: "Otro" },
];

export function esClaveDeVinculo(v: unknown): v is string {
  return typeof v === "string" && VINCULOS.some((x) => x.clave === v);
}

/** Cómo se lee el vínculo desde el extremo de origen ("desde") o el de destino ("hacia"). */
export function etiquetaDelVinculo(clave: string, lado: "desde" | "hacia", customLabel?: string | null): string {
  if (clave === CLAVE_VINCULO_LIBRE) {
    const libre = customLabel?.trim();
    return libre ? libre : "Otro";
  }
  const v = VINCULOS.find((x) => x.clave === clave);
  return v ? v[lado] : clave;
}

/**
 * Hacia dónde apunta la cara elegida. La pantalla pregunta "¿Qué es <otra persona> para <esta
 * persona>?", así que la respuesta describe a la OTRA:
 * - "otra-es": la otra persona es el origen (su cara es `desde`: "Madre o padre").
 * - "esta-es": esta persona es el origen (la otra se lee con `hacia`: "Hijo o hija").
 */
export type SentidoVinculo = "otra-es" | "esta-es";

export function esSentidoDeVinculo(v: unknown): v is SentidoVinculo {
  return v === "otra-es" || v === "esta-es";
}

export type CaraDeVinculo = { valor: string; clave: string; sentido: SentidoVinculo; texto: string };

/**
 * Las opciones del selector: las dos caras de cada vínculo ("Madre o padre", "Hijo o hija"…),
 * una sola cuando se lee igual desde los dos lados ("Pareja").
 */
export function carasDeVinculos(): CaraDeVinculo[] {
  const out: CaraDeVinculo[] = [];
  for (const v of VINCULOS) {
    if (v.desde === v.hacia) {
      out.push({ valor: `${v.clave}:esta-es`, clave: v.clave, sentido: "esta-es", texto: v.desde });
      continue;
    }
    out.push({ valor: `${v.clave}:otra-es`, clave: v.clave, sentido: "otra-es", texto: v.desde });
    out.push({ valor: `${v.clave}:esta-es`, clave: v.clave, sentido: "esta-es", texto: v.hacia });
  }
  return out;
}

/** Cómo se lee, desde la ficha de una persona, a la otra persona de la relación. */
export function etiquetaDeLaOtra(clave: string, soyOrigen: boolean, customLabel?: string | null): string {
  // La otra es el origen cuando yo no lo soy: su cara es `desde`.
  return etiquetaDelVinculo(clave, soyOrigen ? "hacia" : "desde", customLabel);
}
