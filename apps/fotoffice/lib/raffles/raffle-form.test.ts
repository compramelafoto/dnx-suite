import { describe, expect, it } from "vitest";
import { parseRaffleForm } from "./raffle-form";

const form = (campos: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
};

const completo = {
  title: "Sorteo de septiembre",
  description: "Con premios de nuestras marcas aliadas.",
  drawsAt: "2026-09-30T20:00",
  entriesCloseAt: "2026-09-29T20:00",
};

describe("el formulario del sorteo", () => {
  it("acepta un sorteo completo", () => {
    const r = parseRaffleForm(form(completo));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.title).toBe("Sorteo de septiembre");
    expect(r.values.description).toBe("Con premios de nuestras marcas aliadas.");
  });

  it("exige título", () => {
    expect(parseRaffleForm(form({ ...completo, title: "  " }))).toEqual({
      ok: false,
      error: "Poné un título.",
    });
  });

  it("la descripción vacía queda en nulo, no en texto vacío", () => {
    const r = parseRaffleForm(form({ ...completo, description: "" }));
    expect(r.ok && r.values.description).toBe(null);
  });

  it("exige la fecha del acto", () => {
    expect(parseRaffleForm(form({ ...completo, drawsAt: "" })).ok).toBe(false);
  });

  it("si no le ponen cierre de padrón, lo pone 24 horas antes del acto", () => {
    const fd = form(completo);
    fd.set("entriesCloseAt", "");
    const r = parseRaffleForm(fd);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const horas = (r.values.drawsAt.getTime() - r.values.entriesCloseAt.getTime()) / 3_600_000;
    expect(horas).toBe(24);
  });

  it("el padrón no puede cerrar después del acto", () => {
    expect(parseRaffleForm(form({ ...completo, entriesCloseAt: "2026-10-01T20:00" }))).toEqual({
      ok: false,
      error: "El padrón tiene que cerrar antes del acto.",
    });
  });

  it("el padrón no puede cerrar en el mismo instante del acto: ahí se abre la ventana para acomodar la lista", () => {
    expect(parseRaffleForm(form({ ...completo, entriesCloseAt: "2026-09-30T20:00" })).ok).toBe(false);
  });

  it("las fechas se leen en hora argentina, no en la del servidor", () => {
    const r = parseRaffleForm(form(completo));
    expect(r.ok).toBe(true);
    // 20:00 en Buenos Aires (UTC−3) son las 23:00 UTC.
    if (r.ok) expect(r.values.drawsAt.toISOString()).toBe("2026-09-30T23:00:00.000Z");
  });

  it("una fecha con forma inválida se rechaza con un mensaje entendible", () => {
    const r = parseRaffleForm(form({ ...completo, drawsAt: "30/09/2026" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/fecha/i);
  });
});
