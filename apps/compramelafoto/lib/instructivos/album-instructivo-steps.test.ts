import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildInstructivoSteps } from "./album-instructivo-steps";
import type { AlbumInstructivoProfile } from "./album-instructivo-profile";

function perfil(over: Partial<AlbumInstructivoProfile> = {}): AlbumInstructivoProfile {
  return {
    entrada: "abierta",
    busqueda: ["cara", "navegar"],
    momento: "postventa",
    venta: {
      digital: true,
      impreso: false,
      packs: false,
      video: false,
      digitalIncluidoConImpreso: false,
    },
    entrega: { descarga: true, retiro: false, envio: false, laboratorio: null },
    vencimiento: new Date("2026-11-01T00:00:00Z"),
    listo: true,
    fotografo: { nombre: "Estudio DNX", logoUrl: null, color: null, handler: "dnx" },
    album: {
      id: 1,
      titulo: "Maratón 2026",
      slug: "maraton-2026",
      url: "https://compramelafoto.com/a/maraton-2026",
    },
    ...over,
  };
}

const titulos = (p: AlbumInstructivoProfile) => buildInstructivoSteps(p).map((s) => s.titulo);

describe("buildInstructivoSteps", () => {
  it("postventa: primero elegís, después pagás", () => {
    const t = titulos(perfil());
    assert.ok(t.indexOf("Elegí tus fotos") < t.indexOf("Pagá"));
  });

  it("preventa: primero pagás, después elegís tus fotos", () => {
    const t = titulos(perfil({ momento: "preventa" }));
    assert.ok(t.indexOf("Pagá") < t.indexOf("Elegí tus fotos"));
  });

  it("preventa: elegir el producto viene antes de pagar", () => {
    const t = titulos(perfil({ momento: "preventa" }));
    assert.ok(t.indexOf("Elegí qué querés") < t.indexOf("Pagá"));
  });

  it("postventa no tiene el paso de elegir producto", () => {
    assert.ok(!titulos(perfil()).includes("Elegí qué querés"));
  });

  it("preventa nombra la espera hasta que se publiquen las fotos", () => {
    const pasos = buildInstructivoSteps(perfil({ momento: "preventa" }));
    const texto = JSON.stringify(pasos).toLowerCase();
    assert.ok(texto.includes("todavía no están"));
  });

  it("con selfie obligatoria explica el reconocimiento facial y nada más", () => {
    const pasos = buildInstructivoSteps(
      perfil({ entrada: "selfie_obligatoria", busqueda: ["cara"] })
    );
    const texto = JSON.stringify(pasos).toLowerCase();
    assert.ok(texto.includes("selfie"));
    assert.ok(!texto.includes("dorsal"));
    assert.ok(!texto.includes("palabra clave"));
  });

  it("con dorsales explica la búsqueda por número", () => {
    const pasos = buildInstructivoSteps(perfil({ busqueda: ["cara", "dorsal", "navegar"] }));
    assert.ok(JSON.stringify(pasos).toLowerCase().includes("dorsal"));
  });

  it("antepone el aviso cuando el álbum todavía se está procesando", () => {
    const pasos = buildInstructivoSteps(perfil({ listo: false }));
    assert.equal(pasos[0].titulo, "Las fotos se están procesando");
  });

  it("no antepone nada cuando el álbum está listo", () => {
    assert.notEqual(buildInstructivoSteps(perfil())[0].titulo, "Las fotos se están procesando");
  });

  it("el vencimiento aparece como nota del último paso, en hora argentina", () => {
    // `expiresAt` se guarda en UTC. 2026-11-01T00:00:00Z es el 31 de octubre a las 21 en
    // Buenos Aires, y eso es lo que le sirve saber al cliente: el día que para él se acaba.
    const pasos = buildInstructivoSteps(perfil());
    assert.match(String(pasos[pasos.length - 1].nota), /31 de octubre de 2026/);
  });

  it("sin fecha de vencimiento no inventa una nota", () => {
    const pasos = buildInstructivoSteps(perfil({ vencimiento: null }));
    assert.equal(pasos[pasos.length - 1].nota, undefined);
  });

  it("explica el retiro cuando las fotos se retiran en persona", () => {
    const pasos = buildInstructivoSteps(
      perfil({
        venta: {
          digital: false,
          impreso: true,
          packs: false,
          video: false,
          digitalIncluidoConImpreso: false,
        },
        entrega: { descarga: false, retiro: true, envio: false, laboratorio: null },
      })
    );
    assert.ok(JSON.stringify(pasos).toLowerCase().includes("retir"));
  });

  it("todos los pasos tienen título y al menos una línea de detalle", () => {
    for (const momento of ["simple", "postventa", "preventa"] as const) {
      for (const paso of buildInstructivoSteps(perfil({ momento }))) {
        assert.ok(paso.titulo.length > 0, `título vacío en ${momento}`);
        assert.ok(paso.detalle.length > 0, `detalle vacío en ${momento}: ${paso.titulo}`);
      }
    }
  });
});
