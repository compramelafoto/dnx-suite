import { describe, expect, test } from "vitest";
import { HORAS_PARA_CONTESTAR, urgenciaDeLaSolicitud } from "./urgencia";

const AHORA = new Date("2026-10-10T18:00:00Z");
const haceHoras = (n: number) => new Date(AHORA.getTime() - n * 3_600_000);

describe("cuánto apura una solicitud", () => {
  test("la norma da 24 horas para contestar", () => {
    expect(HORAS_PARA_CONTESTAR).toBe(24);
  });

  test("recién entrada, hay tiempo", () => {
    const r = urgenciaDeLaSolicitud({ creada: haceHoras(2), resuelta: null, ahora: AHORA });
    expect(r.nivel).toBe("a-tiempo");
    expect(r.texto).toContain("22");
  });

  test("faltando poco, apura", () => {
    const r = urgenciaDeLaSolicitud({ creada: haceHoras(20), resuelta: null, ahora: AHORA });
    expect(r.nivel).toBe("apura");
  });

  test("pasadas las 24 horas está vencida", () => {
    const r = urgenciaDeLaSolicitud({ creada: haceHoras(30), resuelta: null, ahora: AHORA });
    expect(r.nivel).toBe("vencida");
    expect(r.texto).toContain("6");
  });

  test("una resuelta ya no apura, aunque haya tardado", () => {
    const r = urgenciaDeLaSolicitud({
      creada: haceHoras(50),
      resuelta: haceHoras(1),
      ahora: AHORA,
    });
    expect(r.nivel).toBe("resuelta");
  });

  test("el texto se entiende sin mirar el reloj", () => {
    // "Quedan 22 horas" o "Vencida hace 6 horas", no una fecha ISO.
    const r = urgenciaDeLaSolicitud({ creada: haceHoras(2), resuelta: null, ahora: AHORA });
    expect(r.texto).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  test("en el minuto exacto de las 24 horas ya está vencida", () => {
    const r = urgenciaDeLaSolicitud({ creada: haceHoras(24), resuelta: null, ahora: AHORA });
    expect(r.nivel).toBe("vencida");
  });
});
