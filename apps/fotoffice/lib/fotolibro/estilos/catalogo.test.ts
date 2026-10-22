import { describe, expect, it } from "vitest";
import { EDITOR_FONT_CATALOG } from "@repo/template-editor-core";
import { MEDIDAS_PLIEGO } from "@/lib/fotolibro/medidas-pliego";
import { ESTILOS, temasConEstilos } from "./catalogo";
import type { TipoPliego } from "./tipos";
import { cajaDeFotos, vistaPreviaPliego } from "./vista-previa";

const TIPOS: TipoPliego[] = ["apertura", "interior", "interior-alt", "cierre"];
// Las medidas extremas del catálogo: la más angosta, la cuadrada y la más apaisada.
const MEDIDAS = MEDIDAS_PLIEGO.filter((m) => ["rigido-20x30", "rigido-30x60", "rigido-30x90", "rigido-15x60"].includes(m.id)).map((m) => ({
  anchoMm: m.anchoMm,
  altoMm: m.altoMm,
}));
const FAMILIAS = new Set(EDITOR_FONT_CATALOG.map((f) => f.family));

describe("catálogo de estilos de fotolibro", () => {
  it("no repite ids y cada temática tiene al menos 10 estilos", () => {
    const ids = ESTILOS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of temasConEstilos()) expect(ESTILOS.filter((e) => e.tema === t.id).length).toBeGreaterThanOrEqual(10);
  });

  it("cada estilo dibuja un SVG válido para todos los pliegos y medidas", () => {
    for (const e of ESTILOS) {
      for (const m of MEDIDAS) {
        for (const t of TIPOS) {
          const svg = e.fondo(t, m);
          expect(svg.startsWith("<svg"), `${e.id} ${t}`).toBe(true);
          expect(svg).not.toMatch(/NaN|undefined|Infinity/);
          expect(vistaPreviaPliego(e, t, m)).toContain("</svg>");
        }
      }
    }
  });

  it("siempre deja lugar para las fotos y los títulos caen dentro del pliego", () => {
    for (const e of ESTILOS) {
      for (const m of MEDIDAS) {
        for (const t of TIPOS) {
          for (const lado of ["izq", "der"] as const) {
            const c = cajaDeFotos(e, t, lado, m);
            // Las páginas de título (portada a la izquierda, cierre a la derecha) dejan menos lugar.
            const deTitulo = (t === "apertura" && lado === "izq") || (t === "cierre" && lado === "der");
            expect(c.w, `${e.id} ${t} ${lado}`).toBeGreaterThan(m.anchoMm * 0.12);
            expect(c.h, `${e.id} ${t} ${lado}`).toBeGreaterThan(m.altoMm * (deTitulo ? 0.08 : 0.2));
          }
          for (const x of e.textos?.(t, m) ?? []) {
            expect(x.x).toBeGreaterThanOrEqual(0);
            expect(x.y).toBeGreaterThanOrEqual(0);
            expect(x.x + x.w).toBeLessThanOrEqual(m.anchoMm + 0.01);
            expect(x.y + x.h).toBeLessThanOrEqual(m.altoMm + 0.01);
            expect(FAMILIAS.has(x.fuente), `${e.id}: la tipografía ${x.fuente} no está en el editor`).toBe(true);
          }
        }
      }
    }
  });
});
