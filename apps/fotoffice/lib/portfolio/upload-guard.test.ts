import { describe, expect, it } from "vitest";
import { canAcceptAnotherPhoto } from "./upload-guard";

describe("canAcceptAnotherPhoto", () => {
  it("con 0 fotos entra", () => {
    expect(canAcceptAnotherPhoto(0)).toEqual({ ok: true });
  });

  it("con 19 todavía entra una más", () => {
    expect(canAcceptAnotherPhoto(19)).toEqual({ ok: true });
  });

  it("con 20 ya no: el tope se valida en el servidor, no en el botón", () => {
    const r = canAcceptAnotherPhoto(20);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("20");
  });

  it("un conteo mayor al tope (datos viejos) tampoco deja subir", () => {
    expect(canAcceptAnotherPhoto(25).ok).toBe(false);
  });

  it("el error dice qué hacer, no sólo que no se puede", () => {
    const r = canAcceptAnotherPhoto(20);
    if (!r.ok) expect(r.error).toContain("Borrá");
  });
});
