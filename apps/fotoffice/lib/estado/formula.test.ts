import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
// @ts-expect-error — el script es JavaScript puro a propósito: no puede depender de nada.
import { valorDeCriterio, porcentaje, queFalta } from "../../../../scripts/estado-de-obra.mjs";

/**
 * La fórmula del tablero de estado (ver `docs/estado/LEEME.md`).
 *
 * Se prueba acá y no sólo a ojo porque de este número depende una decisión: qué falta para
 * llegar al 100%. Un error que inflara los porcentajes diría que algo está terminado cuando
 * nadie lo probó, que es exactamente el problema que el tablero vino a resolver.
 */
describe("cuánto vale un criterio", () => {
  it("sin implementar no vale nada", () => {
    expect(valorDeCriterio({ implementado: null, probado: null })).toBe(0);
  });

  it("implementado y sin probar vale la mitad", () => {
    expect(valorDeCriterio({ implementado: { pr: 1 }, probado: null })).toBe(0.5);
  });

  it("probado en producción vale entero", () => {
    expect(
      valorDeCriterio({ implementado: { pr: 1 }, probado: { fecha: "2026-09-17", evidencia: "x" } }),
    ).toBe(1);
  });

  it("un criterio bloqueado no llega al 100% por estar implementado", () => {
    // Si no se puede probar, no se sabe si funciona. La mitad, como cualquier otro sin probar.
    expect(
      valorDeCriterio({ implementado: { pr: 1 }, probado: null, bloqueado: "falta la sesión" }),
    ).toBe(0.5);
  });
});

describe("el porcentaje de una etapa", () => {
  it("una etapa sin criterios no está al 100%: está sin definir", () => {
    // Devolver 100 acá sería el peor error posible del tablero: una etapa vacía se leería como
    // terminada, y quien la mire no tendría cómo notar que nadie escribió sus criterios.
    expect(porcentaje([])).toBe(0);
  });

  it("promedia los criterios", () => {
    const probado = { implementado: { pr: 1 }, probado: { fecha: "x", evidencia: "y" } };
    const aMedias = { implementado: { pr: 1 }, probado: null };
    const sinHacer = { implementado: null, probado: null };
    expect(porcentaje([probado, aMedias])).toBe(75);
    expect(porcentaje([probado, sinHacer])).toBe(50);
    expect(porcentaje([probado, probado])).toBe(100);
  });
});

describe("qué falta", () => {
  it("lo dice en palabras y prioriza el motivo del bloqueo", () => {
    expect(queFalta({ implementado: null, probado: null })).toBe("falta implementarlo");
    expect(queFalta({ implementado: { pr: 1 }, probado: null })).toBe(
      "falta probarlo en producción",
    );
    expect(queFalta({ implementado: { pr: 1 }, probado: null, bloqueado: "sin sesión" })).toBe(
      "bloqueado: sin sesión",
    );
    expect(queFalta({ probado: { fecha: "x", evidencia: "y" } })).toBeNull();
  });
});

/**
 * Los archivos de estado se editan a mano, así que se revisan como cualquier dato que alguien
 * escribe: una evidencia ausente o una etapa sin criterios convierte el tablero en decoración.
 */
describe("los archivos de estado de obra están bien formados", () => {
  const carpeta = join(__dirname, "..", "..", "..", "..", "docs", "estado-de-obra");
  const archivos = readdirSync(carpeta, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      readdirSync(join(carpeta, d.name))
        .filter((n) => n.endsWith(".json"))
        .map((n) => ({ ruta: join(carpeta, d.name, n), etiqueta: `${d.name}/${n}` })),
    );

  it("hay al menos uno", () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  for (const { ruta, etiqueta } of archivos) {
    describe(etiqueta, () => {
      const datos = JSON.parse(readFileSync(ruta, "utf8"));

      it("dice de qué proyecto y de qué plataforma es", () => {
        expect(datos.proyecto?.length).toBeGreaterThan(0);
        expect(datos.plataforma?.length).toBeGreaterThan(0);
      });

      it("o tiene etapas con criterios, o se declara sin auditar", () => {
        // Un archivo sin ninguna de las dos cosas es un proyecto que nadie midió y que además
        // no lo dice: aparecería en el tablero como si estuviera vacío por estar terminado.
        if (datos.sinAuditar) {
          expect(datos.nota?.length ?? 0, "sin auditar y sin explicar por qué").toBeGreaterThan(0);
          return;
        }
        expect(datos.etapas?.length ?? 0).toBeGreaterThan(0);
        for (const e of datos.etapas) {
          expect(e.criterios?.length, `«${e.nombre}» no tiene criterios`).toBeGreaterThan(0);
        }
      });

      it("todo lo probado dice con qué se comprobó", () => {
        for (const e of datos.etapas ?? []) {
          for (const c of e.criterios) {
            if (!c.probado) continue;
            expect(c.probado.fecha, `«${c.que}» no dice cuándo`).toBeTruthy();
            expect(
              c.probado.evidencia?.length ?? 0,
              `«${c.que}» dice estar probado sin decir qué se miró`,
            ).toBeGreaterThan(0);
          }
        }
      });

      it("nada figura probado sin estar implementado", () => {
        for (const e of datos.etapas ?? []) {
          for (const c of e.criterios) {
            if (c.probado) expect(c.implementado, `«${c.que}»`).toBeTruthy();
          }
        }
      });

      it("si declara uso, usa uno de los tres valores", () => {
        if (datos.enUso === undefined) return;
        expect(["si", "no", "parcial"]).toContain(datos.enUso);
      });
    });
  }
});
