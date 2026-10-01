import { describe, expect, test } from "vitest";
import { DURACION_DEL_ENLACE_MS, revisarEnlace, vencimientoDelEnlace } from "./enlace";

const AHORA = new Date("2026-10-20T12:00:00Z");
const LISTO = {
  status: "READY",
  tokenExpiresAt: new Date("2026-10-25T12:00:00Z"),
  retentionUntil: new Date("2026-11-09T12:00:00Z"),
  storageKey: "paquetes/ABC123/parte-1.zip",
};

describe("cuándo sirve un enlace de descarga", () => {
  test("listo y dentro del plazo, sirve", () => {
    const r = revisarEnlace(LISTO, AHORA);
    expect(r.sirve).toBe(true);
    expect(r.sirve && r.clave).toBe("paquetes/ABC123/parte-1.zip");
  });

  test("un enlace que no existe no revela si alguna vez existió", () => {
    const r = revisarEnlace(null, AHORA);
    expect(r.sirve).toBe(false);
    expect(r.sirve === false && r.motivo).toMatch(/no existe o fue dado de baja/i);
  });

  test("vencido dice que venció, no un error", () => {
    // Es el criterio 3.6: quien lo abre ya pagó y merece saber que puede pedir
    // uno nuevo, no ver un 404.
    const r = revisarEnlace({ ...LISTO, tokenExpiresAt: new Date("2026-10-19T00:00:00Z") }, AHORA);
    expect(r.sirve).toBe(false);
    expect(r.sirve === false && r.vencido).toBe(true);
    expect(r.sirve === false && r.motivo).toMatch(/venció/i);
    expect(r.sirve === false && r.motivo).toMatch(/el paquete sigue estando/i);
  });

  test("justo en el instante del vencimiento, ya no sirve", () => {
    expect(revisarEnlace({ ...LISTO, tokenExpiresAt: AHORA }, AHORA).sirve).toBe(false);
  });

  test.each(["QUEUED", "BUILDING"])("mientras se arma (%s), avisa que está en camino", (status) => {
    const r = revisarEnlace({ ...LISTO, status }, AHORA);
    expect(r.sirve).toBe(false);
    expect(r.sirve === false && r.motivo).toMatch(/armando/i);
    expect(r.sirve === false && r.vencido).toBe(false);
  });

  test("si falló, lo dice sin culpar al cliente", () => {
    const r = revisarEnlace({ ...LISTO, status: "FAILED" }, AHORA);
    expect(r.sirve).toBe(false);
    expect(r.sirve === false && r.motivo).toMatch(/no pudimos/i);
  });

  test.each(["EXPIRED", "PURGED"])("si ya se borró (%s), lo dice claro", (status) => {
    const r = revisarEnlace({ ...LISTO, status }, AHORA);
    expect(r.sirve).toBe(false);
    expect(r.sirve === false && r.motivo).toMatch(/se borró/i);
  });

  test("aunque el enlace siga vigente, si el material se borró no hay nada que bajar", () => {
    const r = revisarEnlace({ ...LISTO, retentionUntil: new Date("2026-10-01T00:00:00Z") }, AHORA);
    expect(r.sirve).toBe(false);
    expect(r.sirve === false && r.motivo).toMatch(/se borró/i);
  });

  test("listo pero sin archivo no sirve", () => {
    expect(revisarEnlace({ ...LISTO, storageKey: null }, AHORA).sirve).toBe(false);
  });
});

describe("hasta cuándo vale un enlace nuevo", () => {
  test("siete días", () => {
    const hasta = vencimientoDelEnlace(AHORA, new Date("2026-12-01T00:00:00Z"));
    expect(hasta.getTime() - AHORA.getTime()).toBe(DURACION_DEL_ENLACE_MS);
  });

  test("nunca más allá del borrado del material", () => {
    // Prometer siete días cuando el material se borra en dos es prometer algo
    // que no vamos a poder cumplir.
    const borra = new Date("2026-10-22T12:00:00Z");
    expect(vencimientoDelEnlace(AHORA, borra)).toEqual(borra);
  });

  test("sin fecha de borrado, siete días igual", () => {
    const hasta = vencimientoDelEnlace(AHORA, null);
    expect(hasta.getTime() - AHORA.getTime()).toBe(DURACION_DEL_ENLACE_MS);
  });
});
