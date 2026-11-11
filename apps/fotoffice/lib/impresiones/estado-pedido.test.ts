import { describe, expect, it } from "vitest";
import { etiquetaDelEstado } from "./estado-pedido";

describe("etiquetaDelEstado", () => {
  it("sólo instantáneas: no dice «laboratorio»", () => {
    expect(etiquetaDelEstado("ENVIADO", "TODAS")).toBe("Para imprimir en el estudio");
    expect(etiquetaDelEstado("PAGADO", "TODAS")).toBe("Pagado, para imprimir en el estudio");
  });
  it("mezcla: aclara que las instantáneas van en el estudio", () => {
    expect(etiquetaDelEstado("ENVIADO", "ALGUNAS")).toBe("Enviado al laboratorio · las instantáneas se imprimen en el estudio");
  });
  it("sin instantáneas: como siempre", () => {
    expect(etiquetaDelEstado("ENVIADO", "NINGUNA")).toBe("Enviado al laboratorio");
    expect(etiquetaDelEstado("PAGADO_SIN_ENVIAR", "NINGUNA")).toBe("Pagado, sin enviar");
    expect(etiquetaDelEstado("RARO", "NINGUNA")).toBe("RARO");
  });
});

import { copiasInstantaneas, quedaPorImprimir } from "./estado-pedido";

describe("quedaPorImprimir", () => {
  it("se muestra hasta que el trabajo pasa a Listo o se cierra", () => {
    expect(quedaPorImprimir("RECIBIDO", false)).toBe(true);
    expect(quedaPorImprimir("EN_PROCESO", false)).toBe(true);
    expect(quedaPorImprimir(null, false)).toBe(true);
    expect(quedaPorImprimir("LISTO", false)).toBe(false);
    expect(quedaPorImprimir("ENTREGADO", false)).toBe(false);
    expect(quedaPorImprimir("RECIBIDO", true)).toBe(false);
  });
});

describe("copiasInstantaneas", () => {
  it("suma sólo las instantáneas, por medida y papel (vertical y horizontal juntas)", () => {
    expect(
      copiasInstantaneas(
        [
          { widthCm: 10, heightCm: 15, quantity: 1, paper: "BRILLO", plazo: "INSTANTANEA" },
          { widthCm: 15, heightCm: 10, quantity: 2, paper: "BRILLO", plazo: "INSTANTANEA" },
          { widthCm: 20, heightCm: 30, quantity: 1, paper: "MATE", plazo: "MANANA" },
        ],
        "BRILLO",
      ),
    ).toEqual([{ tamano: "10x15", papel: "Brillo", cantidad: 3 }]);
  });
});
