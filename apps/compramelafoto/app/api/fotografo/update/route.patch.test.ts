import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* Caracterización del PATCH del perfil después de mover las reglas a lib/fotografo/profile-field-rules.ts. */

const m = vi.hoisted(() => ({ findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => m.findUnique(...a),
      findFirst: (...a: unknown[]) => m.findFirst(...a),
      update: (...a: unknown[]) => m.update(...a),
    },
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
}));
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn(async () => ({ id: 7, role: "PHOTOGRAPHER" })) }));
vi.mock("@/lib/services/settingsService", () => ({ getAppConfig: vi.fn(async () => ({ minDigitalPhotoPrice: 5000 })) }));
vi.mock("@/lib/photographer/working-coverage-radius", () => ({ normalizeWorkingCoverageRadiusKm: (n: number) => n }));

import { PATCH } from "./route";

const call = (body: unknown) => PATCH(new Request("http://x/api", { method: "PATCH", body: JSON.stringify(body) }));
let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.findUnique.mockResolvedValue({ role: "PHOTOGRAPHER" });
  log = vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => log.mockRestore());

describe("PATCH /api/fotografo/update", () => {
  it("handler con espacios → 400 con el mismo texto", async () => {
    const res = await call({ publicPageHandler: "mi estudio" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "El handler solo puede contener letras, números y guiones" });
  });
  it("handler en uso → 400", async () => {
    m.findFirst.mockResolvedValue({ id: 8, publicPageHandler: "estudio" });
    const res = await call({ publicPageHandler: " Estudio " });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Este handler ya está en uso" });
    expect(m.findFirst.mock.calls[0]![0].where).toEqual({ publicPageHandler: "estudio", id: { not: 7 } });
  });
  it("precio por defecto debajo del mínimo → 400 con el mínimo en el texto", async () => {
    const res = await call({ defaultDigitalPhotoPrice: 100 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "El precio por foto digital no puede ser menor al mínimo del sistema (5000 pesos)" });
  });
  it("colores: válido se guarda, vacío borra, inválido se ignora; no imprime los datos en los logs", async () => {
    m.update.mockResolvedValue({ id: 7 });
    const res = await call({ primaryColor: "#AABBCC", secondaryColor: "", fontColor: "rojo", defaultDigitalPhotoPrice: 0 });
    expect(res.status).toBe(200);
    expect(m.update.mock.calls[0]![0].data).toEqual({ primaryColor: "#AABBCC", secondaryColor: null, defaultDigitalPhotoPrice: 5000 });
    expect(log).not.toHaveBeenCalled();
  });
});
