import { afterEach, describe, expect, it, vi } from "vitest";
import { createCalendarClient, isCalendarPermissionError } from "./client";

/** Deja a `fetch` contestando lo que pida el test, sin salir a la red. */
function responder(status: number, body: unknown = {}) {
  const fake = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fake);
  return fake;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("crear un calendario", () => {
  it("devuelve el id del calendario nuevo", async () => {
    responder(200, { id: "cal-nuevo" });
    const client = createCalendarClient("token");
    await expect(client.createCalendar("Coworking — reservas")).resolves.toBe("cal-nuevo");
  });

  it("un 403 se reconoce como falta de permiso, no como falla pasajera", async () => {
    // Producción devolvió exactamente esto: la cuenta estaba conectada con permiso para
    // escribir eventos, que no alcanza para crear un calendario.
    responder(403);
    const client = createCalendarClient("token");
    const error = await client.createCalendar("Coworking — reservas").catch((e: unknown) => e);
    expect(isCalendarPermissionError(error)).toBe(true);
  });

  it("un 500 NO se confunde con falta de permiso: eso sí se reintenta", async () => {
    responder(500);
    const client = createCalendarClient("token");
    const error = await client.createCalendar("Coworking — reservas").catch((e: unknown) => e);
    expect(isCalendarPermissionError(error)).toBe(false);
  });

  it("cualquier otra cosa que llegue no se toma por un problema de permisos", () => {
    expect(isCalendarPermissionError(new Error("network"))).toBe(false);
    expect(isCalendarPermissionError(null)).toBe(false);
    expect(isCalendarPermissionError({ code: 403 })).toBe(false);
  });
});
