import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { fitSizeToAvailable, fitTipoToFormats, resolveAvailableFormats } from "./available-formats";

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

describe("fitTipoToFormats", () => {
  const formats = (albumAllowsDigital: boolean, albumAllowsPrint: boolean) =>
    resolveAvailableFormats({ albumAllowsDigital, albumAllowsPrint, photoSellsDigital: true, photoSellsPrint: true });

  it("pasa a impresa una foto guardada como digital en un álbum que sólo vende impresas", () => {
    assert.equal(fitTipoToFormats("digital", formats(false, true)), "impresa");
  });

  it("pasa a digital una foto guardada como impresa en un álbum sólo digital", () => {
    assert.equal(fitTipoToFormats("impresa", formats(true, false)), "digital");
  });

  it("respeta la elección cuando el formato está disponible", () => {
    assert.equal(fitTipoToFormats("impresa", formats(true, true)), "impresa");
    assert.equal(fitTipoToFormats("digital", formats(true, true)), "digital");
  });

  it("sin configuración del álbum todavía, no cambia nada", () => {
    const f = resolveAvailableFormats({ albumAllowsDigital: undefined, albumAllowsPrint: undefined, photoSellsDigital: true, photoSellsPrint: true });
    assert.equal(fitTipoToFormats("digital", f), "digital");
  });
});

describe("fitSizeToAvailable", () => {
  it("cambia el 10x15 de relleno por la medida que vende el álbum", () => {
    assert.equal(fitSizeToAvailable("10x15", ["15x20"], "15x20"), "15x20");
  });

  it("respeta una medida que el álbum vende", () => {
    assert.equal(fitSizeToAvailable("13x18", ["10x15", "13x18"], "10x15"), "13x18");
  });

  it("sin precios cargados todavía, no toca la medida", () => {
    assert.equal(fitSizeToAvailable("10x15", [], "10x15"), "10x15");
  });

  it("si el relleno tampoco existe, usa la primera medida disponible", () => {
    assert.equal(fitSizeToAvailable(null, ["15x20", "20x30"], "10x15"), "15x20");
  });
});
