import { describe, expect, test } from "vitest";
import { resumenDeFalla } from "./motivo-del-rechazo";

describe("por qué no se pudo cobrar", () => {
  /*
    El 10/10/2026 quedó una orden de $150.000 en PENDING sin preferencia de Mercado Pago.
    Al día siguiente no había forma de saber qué pasó: lo único guardado era `error.name`
    en un `console.error`, y los registros de Vercel de ese día ya no existían.

    Una venta que falla en silencio es peor que una que falla ruidosamente.
  */
  test("siempre queda un detalle para entenderlo después", () => {
    expect(resumenDeFalla(new Error("algo raro")).detalle).toContain("algo raro");
    expect(resumenDeFalla(undefined).detalle).toBe("sin detalle");
  });

  test("el texto del fotógrafo dice qué hacer, no qué pasó", () => {
    // "Reconectá tu cuenta" es accionable; "error 401" no.
    const f = resumenDeFalla(new Error("invalid_access_token"));

    expect(f.paraElFotografo).toContain("Reconectá");
    expect(f.paraElFotografo).not.toContain("401");
  });

  test("reconoce la cuenta conectada a medias", () => {
    const f = resumenDeFalla(new Error("marketplace_fee is not allowed for this collector"));

    expect(f.paraElFotografo).toContain("comisión de la plataforma");
  });

  test("un corte de red no se confunde con un problema de la cuenta", () => {
    // Mandarlo a reconectar la cuenta por un timeout lo hace perder media hora.
    const f = resumenDeFalla(new Error("fetch failed"));

    expect(f.paraElFotografo).toContain("Probá de nuevo");
  });

  test("mira adentro de la causa anidada", () => {
    // El SDK de Mercado Pago acomoda el motivo real en `cause` según el caso.
    const error = new Error("Request failed");
    (error as { cause?: unknown }).cause = new Error("401 unauthorized");

    expect(resumenDeFalla(error).paraElFotografo).toContain("Reconectá");
  });

  test("lo que no se reconoce no inventa un diagnóstico", () => {
    const f = resumenDeFalla(new Error("qwerty"));

    expect(f.paraElFotografo).toContain("no aceptó el cobro");
    expect(f.detalle).toContain("qwerty");
  });

  test("el detalle no crece sin límite", () => {
    // Va a una columna de la base en cada falla: no puede ser la respuesta entera.
    expect(resumenDeFalla(new Error("x".repeat(5000))).detalle.length).toBeLessThanOrEqual(600);
  });
});
