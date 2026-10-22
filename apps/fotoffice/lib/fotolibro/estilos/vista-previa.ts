import { acomodar } from "@/lib/fotolibro/modo/maquetar";
import type { EstiloFotolibro, Medidas, TipoPliego, Zona } from "./tipos";

/**
 * Cómo se ve un pliego del estilo, en un solo SVG: el fondo, recuadros donde irían las fotos
 * (acomodados con el mismo motor del Modo Fotolibro) y los títulos de ejemplo. Es lo que muestra
 * el catálogo y la lámina de revisión.
 */

const FOTOS_DE_EJEMPLO: Record<TipoPliego, { izq: number[]; der: number[] }> = {
  apertura: { izq: [], der: [0.67] },
  interior: { izq: [1.5, 1.5], der: [0.67, 0.67] },
  "interior-alt": { izq: [0.67], der: [1.5, 0.67, 1.5] },
  cierre: { izq: [1.5, 1.5, 1.5], der: [] },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function zonaDe(estilo: EstiloFotolibro, tipo: TipoPliego, lado: "izq" | "der", m: Medidas): Zona {
  const z = estilo.zona?.(tipo, lado, m) ?? {};
  return { arriba: z.arriba ?? 0, abajo: z.abajo ?? 0, exterior: z.exterior ?? 0, interior: z.interior ?? 0 };
}

/** La caja donde van las fotos de una página: margen del estilo más su zona reservada. */
export function cajaDeFotos(estilo: EstiloFotolibro, tipo: TipoPliego, lado: "izq" | "der", m: Medidas, margenMm?: number) {
  const z = zonaDe(estilo, tipo, lado, m);
  const mg = margenMm ?? estilo.margenMm ?? 12;
  const w = m.anchoMm / 2;
  const x0 = lado === "izq" ? 0 : w;
  const izqExtra = lado === "izq" ? z.exterior : z.interior;
  const derExtra = lado === "izq" ? z.interior : z.exterior;
  return {
    x: x0 + mg + izqExtra,
    y: mg + z.arriba,
    w: Math.max(1, w - 2 * mg - izqExtra - derExtra),
    h: Math.max(1, m.altoMm - 2 * mg - z.arriba - z.abajo),
  };
}

export function vistaPreviaPliego(estilo: EstiloFotolibro, tipo: TipoPliego, m: Medidas): string {
  const fondo = estilo.fondo(tipo, m);
  let extra = "";
  const sep = estilo.separacionMm ?? 4;
  for (const lado of ["izq", "der"] as const) {
    const aspectos = FOTOS_DE_EJEMPLO[tipo][lado];
    if (!aspectos.length) continue;
    const marcos = acomodar(aspectos, cajaDeFotos(estilo, tipo, lado, m), sep, 0);
    for (const c of marcos) {
      extra += `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="${estilo.esquinasMm ?? 0}" fill="#c9cdd3"/><path d="M ${c.x + c.w * 0.3} ${c.y + c.h * 0.68} l ${c.w * 0.14} -${c.h * 0.2} l ${c.w * 0.1} ${c.h * 0.12} l ${c.w * 0.08} -${c.h * 0.08} l ${c.w * 0.1} ${c.h * 0.16} z" fill="#aeb3ba"/>`;
    }
  }
  for (const t of estilo.textos?.(tipo, m) ?? []) {
    const tam = (t.puntos * 25.4) / 72;
    const x = t.alineacion === "left" ? t.x : t.alineacion === "right" ? t.x + t.w : t.x + t.w / 2;
    const ancla = t.alineacion === "left" ? "start" : t.alineacion === "right" ? "end" : "middle";
    const contenido = t.mayusculas ? t.ejemplo.toUpperCase() : t.ejemplo;
    extra += `<text x="${x}" y="${t.y + tam}" font-family="'${t.fuente}', serif" font-size="${tam}" fill="${t.color}" text-anchor="${ancla}"${t.negrita ? ' font-weight="700"' : ""}${t.italica ? ' font-style="italic"' : ""}${t.mayusculas ? ' letter-spacing="0.6"' : ""}>${esc(contenido)}</text>`;
  }
  return fondo.replace(/<\/svg>$/, `${extra}</svg>`);
}
