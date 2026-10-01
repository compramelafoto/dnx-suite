import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveAvailableFormats } from "./available-formats";

describe("qué formatos se le ofrecen al cliente", () => {
  it("el álbum manda: sin impresión habilitada, no se ofrece impresa", () => {
    // El bug real: un fotógrafo habilitaba sólo digital y el cliente podía
    // elegir "Impresa" igual, con precio $0.
    const f = resolveAvailableFormats({
      albumAllowsDigital: true,
      albumAllowsPrint: false,
      photoSellsDigital: true,
      photoSellsPrint: true,
    });
    assert.equal(f.print, false, "ofrece impresa con el álbum en sólo digital");
    assert.equal(f.digital, true);
  });

  it("el álbum manda también al revés", () => {
    const f = resolveAvailableFormats({
      albumAllowsDigital: false,
      albumAllowsPrint: true,
      photoSellsDigital: true,
      photoSellsPrint: true,
    });
    assert.equal(f.digital, false);
    assert.equal(f.print, true);
  });

  it("la foto puede restringir más, nunca ampliar", () => {
    const f = resolveAvailableFormats({
      albumAllowsDigital: true,
      albumAllowsPrint: true,
      photoSellsDigital: true,
      photoSellsPrint: false,
    });
    assert.equal(f.print, false, "la foto excluida de impresión igual se ofrece");
    assert.equal(f.digital, true);
  });

  it("una foto no puede habilitar lo que el álbum apagó", () => {
    const f = resolveAvailableFormats({
      albumAllowsDigital: false,
      albumAllowsPrint: false,
      photoSellsDigital: true,
      photoSellsPrint: true,
    });
    assert.equal(f.digital, false);
    assert.equal(f.print, false);
    assert.equal(f.any, false);
  });

  it("con las dos habilitadas se ofrecen las dos", () => {
    const f = resolveAvailableFormats({
      albumAllowsDigital: true,
      albumAllowsPrint: true,
      photoSellsDigital: true,
      photoSellsPrint: true,
    });
    assert.equal(f.digital, true);
    assert.equal(f.print, true);
    assert.equal(f.any, true);
  });

  it("si el álbum no dice nada, se asume habilitado (comportamiento de siempre)", () => {
    // Álbumes viejos sin la configuración cargada no pueden quedar sin vender.
    const f = resolveAvailableFormats({
      albumAllowsDigital: undefined,
      albumAllowsPrint: undefined,
      photoSellsDigital: undefined,
      photoSellsPrint: undefined,
    });
    assert.equal(f.digital, true);
    assert.equal(f.print, true);
  });

  it("dice cuál conviene preseleccionar", () => {
    assert.equal(
      resolveAvailableFormats({
        albumAllowsDigital: true,
        albumAllowsPrint: false,
        photoSellsDigital: true,
        photoSellsPrint: true,
      }).preferred,
      "digital"
    );
    assert.equal(
      resolveAvailableFormats({
        albumAllowsDigital: false,
        albumAllowsPrint: true,
        photoSellsDigital: true,
        photoSellsPrint: true,
      }).preferred,
      "impresa"
    );
  });

  it("sin ningún formato disponible no preselecciona nada", () => {
    assert.equal(
      resolveAvailableFormats({
        albumAllowsDigital: false,
        albumAllowsPrint: false,
        photoSellsDigital: true,
        photoSellsPrint: true,
      }).preferred,
      null
    );
  });
});
