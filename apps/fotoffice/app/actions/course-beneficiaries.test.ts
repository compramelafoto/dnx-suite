import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  ctx: vi.fn(),
  membership: vi.fn(),
  course: vi.fn(),
  send: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/workspace", () => ({ requireCoursesSalesContext: m.ctx }));
vi.mock("@/lib/app-url", () => ({ appUrl: () => "https://x.test" }));
vi.mock("@/lib/communications/send-email", () => ({ sendTransactionalEmail: m.send }));
vi.mock("@/lib/course-marketplace/access", () => ({
  invitacionesPendientesWhere: vi.fn(),
  requireDuenoOAdminDelNegocio: vi.fn(),
}));
vi.mock("@/lib/course-marketplace/cargar", () => ({ cargarDueno: vi.fn().mockResolvedValue({ nombre: "Dueño" }) }));
vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return {
    ...actual,
    prisma: {
      workspaceMembership: { findUnique: m.membership },
      course: { findFirst: m.course },
    },
  };
});

const { guardarBeneficiariosAction } = await import("./course-beneficiaries");

beforeEach(() => {
  m.ctx.mockReset().mockResolvedValue({ user: { id: 1 }, workspace: { id: "ws" } });
  m.membership.mockReset().mockResolvedValue({ role: "WORKSPACE_OWNER" });
  m.course.mockReset().mockResolvedValue({
    id: "c", title: "T", workspaceId: "ws", freeForMembers: false, deliveryMode: "RECORDED", priceArs: 1000,
  });
});

describe("guardarBeneficiariosAction", () => {
  it("rechaza a quien no es dueño ni administrador", async () => {
    m.membership.mockResolvedValue({ role: "WORKSPACE_STAFF" });
    const r = await guardarBeneficiariosAction("c", []);
    expect(r).toEqual({
      ok: false,
      errores: ["Sólo el dueño o un administrador del negocio puede definir quién cobra."],
    });
    expect(m.course).not.toHaveBeenCalled();
  });

  it("rechaza un curso que no es grabado", async () => {
    m.course.mockResolvedValue({ id: "c", title: "T", workspaceId: "ws", freeForMembers: false, deliveryMode: "IN_PERSON", priceArs: 1000 });
    const r = await guardarBeneficiariosAction("c", []);
    expect(r).toEqual({ ok: false, errores: ["El reparto sólo se arma en cursos grabados con precio."] });
  });

  it("rechaza un curso sin precio", async () => {
    m.course.mockResolvedValue({ id: "c", title: "T", workspaceId: "ws", freeForMembers: false, deliveryMode: "RECORDED", priceArs: null });
    const r = await guardarBeneficiariosAction("c", []);
    expect(r).toEqual({ ok: false, errores: ["El reparto sólo se arma en cursos grabados con precio."] });
  });
});
