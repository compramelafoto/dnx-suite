import { describe, expect, it } from "vitest";
import { armarPasos } from "@/lib/bot/escolar/progreso";
import { buildSystemGuide } from "./index";

describe("buildSystemGuide", () => {
  it("es idéntica entre llamadas (si cambia, se rompe el caché)", () => {
    expect(buildSystemGuide()).toBe(buildSystemGuide());
  });
  it("no contiene fechas ni datos variables", () => {
    expect(buildSystemGuide()).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
  });
  it("incluye las reglas duras y el nombre", () => {
    const g = buildSystemGuide();
    expect(g).toContain("DNX Bot");
    expect(g).toContain("Nunca prometas");
    expect(g).toContain("pesos");
  });
  it("pide mensajes cortos, una pregunta por vez y rutas sueltas", () => {
    const g = buildSystemGuide();
    expect(g).toContain("1 a 3 oraciones");
    expect(g).toContain("UNA pregunta corta");
    expect(g).toContain("no lo anuncies");
    expect(g).toContain("Entrá acá: /fotografo/configuracion");
  });
  it("es lo bastante larga para cachearse (>4096 caracteres)", () => {
    expect(buildSystemGuide().length).toBeGreaterThan(4096);
  });
  it("incluye las preguntas frecuentes del sitio", () => {
    expect(buildSystemGuide()).toContain("¿Para qué sirve ComprameLaFoto?");
  });
  it("enseña la venta escolar sin prometer lo que no existe", () => {
    const g = buildSystemGuide();
    expect(g).toContain("## Venta escolar");
    expect(g).toContain("ver_progreso_escolar");
    expect(g).toContain("recién estrenado");
    expect(g).toContain("Ofrecelos como parte del sistema escolar; aclará que son nuevos y que lo acompañamos en el primer uso");
    expect(g).toContain("Fotografía escolar: nunca la usó");
    expect(g).not.toMatch(/descarga gratuita/i);
    expect(g).not.toMatch(/selfie escolar/i);
  });
  it("ofrece aprender fotografía escolar una sola vez a quien no la hace", () => {
    expect(buildSystemGuide()).toContain(
      "Si el fotógrafo no hace fotografía escolar (la situación de la cuenta lo dice), cuando termines de resolver su consulta ofrecele en una línea aprender a vender fotografía escolar. Una sola vez por conversación; si dice que no, no insistas."
    );
  });
  it("lista los 11 pasos escolares con los mismos títulos que el progreso", () => {
    const g = buildSystemGuide();
    const vacio = {
      escuela: null, tieneCursos: false, admin: null, album: null, rosterActivos: 0, packsConBeneficios: 0,
      plantillasRequeridas: 0, plantillasRequeridasCargadas: 0, packsPublicados: 0, fotos: 0, avisoEnviado: false,
      itemsPreventa: 0, itemsSinEntregar: 0,
    };
    for (const p of armarPasos(vacio).pasos) expect(g).toContain(`${p.n}. ${p.titulo}`);
  });
});
