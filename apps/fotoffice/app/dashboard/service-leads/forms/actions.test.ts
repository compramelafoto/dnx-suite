import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Captación (pedidos de servicio) decide por módulo y nivel (roles etapa 2b).
 *
 * Hasta acá sólo pedía sesión: cualquiera con membresía veía las consultas y editaba los
 * formularios, con el módulo prendido o apagado.
 */

const H = vi.hoisted(() => ({
  ctx: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (d: string) => {
    throw new Error(`REDIRECT:${d}`);
  },
}));
vi.mock("@/lib/workspace", () => ({ requireServiceLeadsContext: H.ctx }));
vi.mock("@repo/db", () => ({
  Prisma: {},
  prisma: {
    serviceLeadForm: {
      create: H.create,
      update: H.update,
      updateMany: H.updateMany,
      findFirst: H.findFirst,
    },
  },
}));

const { createServiceLeadForm, updateServiceLeadForm } = await import("./actions");

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

const VALIDO = { name: "Bodas", slug: "bodas", eventType: "boda", formMode: "GENERAL" };

beforeEach(() => {
  H.ctx.mockReset().mockImplementation(async (min: "VIEW" | "MANAGE" = "VIEW") => {
    if (min === "MANAGE") throw new Error("REDIRECT:/dashboard");
    return { user: { id: 7 }, workspace: { id: "ws-1", name: "DNX Estudio" } };
  });
  for (const m of [H.create, H.update, H.updateMany, H.findFirst]) m.mockReset();
});

describe("acciones de formularios", () => {
  it("crear pide MANAGE: con VIEW no escribe", async () => {
    await expect(createServiceLeadForm(form(VALIDO))).rejects.toThrow("REDIRECT:/dashboard");
    expect(H.ctx).toHaveBeenCalledWith("MANAGE");
    expect(H.create).not.toHaveBeenCalled();
    expect(H.updateMany).not.toHaveBeenCalled();
  });

  it("editar pide MANAGE: con VIEW no escribe", async () => {
    await expect(updateServiceLeadForm(form({ ...VALIDO, formId: "f-1" }))).rejects.toThrow(
      "REDIRECT:/dashboard",
    );
    expect(H.ctx).toHaveBeenCalledWith("MANAGE");
    expect(H.update).not.toHaveBeenCalled();
  });

  it("con MANAGE crea en el workspace activo", async () => {
    H.ctx.mockResolvedValue({ user: { id: 7 }, workspace: { id: "ws-1", name: "DNX Estudio" } });
    await expect(createServiceLeadForm(form(VALIDO))).rejects.toThrow(
      "REDIRECT:/dashboard/service-leads/forms",
    );
    expect(H.create.mock.calls[0][0].data.workspaceId).toBe("ws-1");
  });
});

describe("las pantallas de Captación", () => {
  // Se lee el código: la falla probable es una pantalla nueva que vuelve a `requireActiveWorkspace`.
  const raiz = join(import.meta.dirname, "..");
  const paginas: string[] = [];
  (function recorrer(dir: string) {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (nombre === "page.tsx") paginas.push(ruta);
    }
  })(raiz);

  it("hay pantallas para revisar", () => {
    expect(paginas.length).toBeGreaterThanOrEqual(5);
  });

  it.each(paginas.map((p) => [p.slice(raiz.length)]))("%s pasa por la puerta del módulo", (rel) => {
    const src = readFileSync(join(raiz, rel), "utf8");
    expect(src).toContain("requireServiceLeadsContext()");
    expect(src).not.toContain("requireActiveWorkspace");
  });
});
