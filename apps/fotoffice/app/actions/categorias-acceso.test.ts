import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  role: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
}));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ id: 7 }), getAuthUser: async () => ({ id: 7 }) }));
vi.mock("@/lib/workspace", () => ({ resolveActiveWorkspace: async () => ({ id: "ws-1", name: "SFPR" }) }));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: H.role }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: async () => true }));
vi.mock("@/lib/vocabulario/load", () => ({ loadPersonVocabulary: vi.fn() }));
vi.mock("@repo/db/fotoffice-members", async (orig) => ({
  ...(await orig<object>()),
  createMemberCategory: H.create,
  updateMemberCategory: H.update,
}));

const { createMemberCategoryAction, updateMemberCategoryAction } = await import("./members");

function form(campos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

beforeEach(() => {
  H.role.mockReset();
  H.create.mockReset().mockResolvedValue({});
  H.update.mockReset().mockResolvedValue({ id: "c1" });
});

describe("categorías de socios: sólo configura Dueño/Admin", () => {
  it("Equipo no puede crear una categoría llamando la acción directo", async () => {
    H.role.mockResolvedValue("STAFF");
    await expect(createMemberCategoryAction(undefined, form({ name: "Nueva" }))).rejects.toThrow(
      "REDIRECT:/members?forbidden=configurar",
    );
    expect(H.create).not.toHaveBeenCalled();
  });

  it("Equipo no puede editar una categoría", async () => {
    H.role.mockResolvedValue("STAFF");
    await expect(
      updateMemberCategoryAction(undefined, form({ id: "c1", name: "X" })),
    ).rejects.toThrow("REDIRECT:/members?forbidden=configurar");
    expect(H.update).not.toHaveBeenCalled();
  });

  it("el Dueño crea y edita", async () => {
    H.role.mockResolvedValue("WORKSPACE_OWNER");
    await expect(createMemberCategoryAction(undefined, form({ name: "Nueva" }))).rejects.toThrow(
      "REDIRECT:/members/categories",
    );
    expect(H.create).toHaveBeenCalled();
    await expect(
      updateMemberCategoryAction(undefined, form({ id: "c1", name: "X" })),
    ).rejects.toThrow("REDIRECT:/members/categories");
    expect(H.update).toHaveBeenCalled();
  });
});
