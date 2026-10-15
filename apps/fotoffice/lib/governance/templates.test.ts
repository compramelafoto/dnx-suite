import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT_TEMPLATES, parseStagesText, stagesToText } from "./templates";

describe("texto de etapas y tareas", () => {
  it("lee etapas y sus tareas con distintas viñetas", () => {
    const r = parseStagesText("Difusión\n- Flyer\n* Redes\n\nImpresión\n• Cotizar\r\n— Retirar\n");
    expect(r).toEqual({
      ok: true,
      stages: [
        { title: "Difusión", tasks: ["Flyer", "Redes"] },
        { title: "Impresión", tasks: ["Cotizar", "Retirar"] },
      ],
    });
  });

  it("una tarea sin etapa arriba es un error que dice la línea", () => {
    const r = parseStagesText("\n- Suelta\nEtapa");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/línea 2/);
  });

  it("ida y vuelta sin pérdidas en todas las plantillas", () => {
    for (const t of DEFAULT_PROJECT_TEMPLATES) {
      expect(parseStagesText(stagesToText(t.stages))).toEqual({ ok: true, stages: t.stages });
    }
  });

  it("las plantillas tienen claves y nombres únicos", () => {
    const claves = DEFAULT_PROJECT_TEMPLATES.map((t) => t.key);
    const nombres = DEFAULT_PROJECT_TEMPLATES.map((t) => t.name);
    expect(new Set(claves).size).toBe(claves.length);
    expect(new Set(nombres).size).toBe(nombres.length);
  });
});
