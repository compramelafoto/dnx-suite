import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
  revalidatePath: vi.fn(),
  requireSponsorsManager: vi.fn(),
  estaEnDirectorio: vi.fn(),
  linkSponsor: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/sponsors/access", () => ({ requireSponsorsManager: m.requireSponsorsManager }));
vi.mock("@/lib/sponsors/directory", () => ({ estaEnDirectorio: m.estaEnDirectorio }));
vi.mock("@/lib/sponsors/repository", () => ({
  SponsorsError: class extends Error {},
  linkSponsor: m.linkSponsor,
  assignPlacement: vi.fn(),
  cancelPlacement: vi.fn(),
  createSponsor: vi.fn(),
  saveSponsorLogo: vi.fn(),
  unlinkSponsor: vi.fn(),
  updateSponsorCommon: vi.fn(),
  updateSponsorLocal: vi.fn(),
}));

const { sumarDesdeRedAction } = await import("./actions");

function form(datos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(datos)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.requireSponsorsManager.mockResolvedValue({ workspace: { id: "ws-1" } });
  m.estaEnDirectorio.mockResolvedValue(true);
  m.linkSponsor.mockResolvedValue(undefined);
});

describe("Agregar a mis sponsors desde la red", () => {
  it("exige el permiso de gestionar sponsors antes de tocar nada", async () => {
    m.requireSponsorsManager.mockRejectedValue(new Error("REDIRECT:/sponsors"));
    await expect(sumarDesdeRedAction(form({ partnerId: "p1" }))).rejects.toThrow("REDIRECT:/sponsors");
    expect(m.linkSponsor).not.toHaveBeenCalled();
  });

  it("vincula la marca (sin copiarla) y lleva a la ficha para elegir los espacios", async () => {
    await expect(sumarDesdeRedAction(form({ partnerId: "p1" }))).rejects.toThrow("REDIRECT:/sponsors/p1?ok=vinculado");
    expect(m.estaEnDirectorio).toHaveBeenCalledWith("ws-1", "p1");
    expect(m.linkSponsor).toHaveBeenCalledWith({ workspaceId: "ws-1", partnerId: "p1" });
  });

  it("rechaza una marca que no está en el directorio público", async () => {
    m.estaEnDirectorio.mockResolvedValue(false);
    await expect(sumarDesdeRedAction(form({ partnerId: "p-oculta", volver: "/sponsors/red?q=lab" }))).rejects.toThrow(
      /REDIRECT:\/sponsors\/red\?q=lab&error=/,
    );
    expect(m.linkSponsor).not.toHaveBeenCalled();
  });

  it("no acepta volver a una dirección de afuera", async () => {
    m.estaEnDirectorio.mockResolvedValue(false);
    await expect(sumarDesdeRedAction(form({ partnerId: "p1", volver: "https://malo.com" }))).rejects.toThrow(
      /REDIRECT:\/sponsors\/red\?error=/,
    );
  });
});
