import { EDITOR_FONT_CATALOG } from "@repo/template-editor-core";
import { MEDIDAS_PLIEGO } from "@/lib/fotolibro/medidas-pliego";
import type { EstiloFotolibro, TipoPliego } from "./tipos";
import { cajaDeFotos, vistaPreviaPliego } from "./vista-previa";

/**
 * Lo que tiene que cumplir todo estilo de fotolibro, en una función: la usan la prueba del
 * catálogo y la de cada temática. Devuelve la lista de problemas (vacía si está todo bien).
 */

const TIPOS: TipoPliego[] = ["apertura", "interior", "interior-alt", "cierre"];
// Las medidas extremas: la más angosta, la cuadrada y las más apaisadas.
const MEDIDAS = MEDIDAS_PLIEGO.filter((m) => ["rigido-20x30", "rigido-30x60", "rigido-30x90", "rigido-15x60"].includes(m.id)).map((m) => ({
  anchoMm: m.anchoMm,
  altoMm: m.altoMm,
}));
const FAMILIAS = new Set(EDITOR_FONT_CATALOG.map((f) => f.family));

export function problemasDeEstilos(estilos: readonly EstiloFotolibro[]): string[] {
  const problemas: string[] = [];
  const ids = new Set<string>();
  for (const e of estilos) {
    if (ids.has(e.id)) problemas.push(`${e.id}: id repetido`);
    ids.add(e.id);
    if (!e.id.startsWith(`${e.tema}-`)) problemas.push(`${e.id}: el id tiene que empezar con "${e.tema}-"`);
    for (const m of MEDIDAS) {
      for (const t of TIPOS) {
        let svg = "";
        try {
          svg = e.fondo(t, m);
          vistaPreviaPliego(e, t, m);
        } catch (err) {
          problemas.push(`${e.id} ${t}: falla al dibujar (${err instanceof Error ? err.message : err})`);
          continue;
        }
        if (!svg.startsWith("<svg")) problemas.push(`${e.id} ${t}: el fondo no es un SVG`);
        if (/NaN|undefined|Infinity/.test(svg)) problemas.push(`${e.id} ${t}: el SVG tiene NaN/undefined`);
        if (/<text[\s>]/.test(svg)) problemas.push(`${e.id} ${t}: el fondo no puede tener textos (van como títulos)`);
        if (/<image[\s>]|href="http/.test(svg)) problemas.push(`${e.id} ${t}: el fondo no puede usar imágenes externas`);
        for (const lado of ["izq", "der"] as const) {
          const c = cajaDeFotos(e, t, lado, m);
          const deTitulo = (t === "apertura" && lado === "izq") || (t === "cierre" && lado === "der");
          if (c.w <= m.anchoMm * 0.12 || c.h <= m.altoMm * (deTitulo ? 0.08 : 0.2)) {
            problemas.push(`${e.id} ${t} ${lado} (${Math.round(m.anchoMm)}×${Math.round(m.altoMm)}): no deja lugar para las fotos`);
          }
        }
        for (const x of e.textos?.(t, m) ?? []) {
          if (x.x < 0 || x.y < 0 || x.x + x.w > m.anchoMm + 0.01 || x.y + x.h > m.altoMm + 0.01) {
            problemas.push(`${e.id} ${t}: el texto ${x.rol} se sale del pliego`);
          }
          if (!FAMILIAS.has(x.fuente)) problemas.push(`${e.id}: la tipografía "${x.fuente}" no está en el editor`);
        }
      }
    }
  }
  return problemas;
}
