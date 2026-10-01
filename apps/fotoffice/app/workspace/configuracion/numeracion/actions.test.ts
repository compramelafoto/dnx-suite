import { beforeEach, describe, expect, it, vi } from "vitest";

/** Acción de Configuración → Numeración contra el catálogo real y la base en memoria. */
const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../../../lib/circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const H = vi.hoisted(() => ({ role: vi.fn(), workspaceId: vi.fn(), revalidate: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@/lib/access/active-context", () => ({
  requireActiveWorkspaceRole: vi.fn(async () => ({
    user: { id: 7, email: "ana@x.test", name: "Ana" },
    workspace: { id: H.workspaceId(), name: "Estudio" },
    role: H.role(),
  })),
}));

const A = await import("./actions");
const { describirCambioSecuencia } = await import("./historial");

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

const sec = (key: string, ws = "ws-1") => B.datos.fotofficeSequence.find((s) => s.key === key && s.workspaceId === ws);
const PEDIDO = { clave: "PEDIDO", prefijo: "P-", digitos: "4", proximo: "42" };

beforeEach(() => {
  B.vaciar();
  vi.clearAllMocks();
  H.role.mockReturnValue("WORKSPACE_ADMIN");
  H.workspaceId.mockReturnValue("ws-1");
});

describe("configurarSecuenciaAction", () => {
  it("sin `configurar` no crea ni cambia nada", async () => {
    H.role.mockReturnValue("STAFF");
    expect((await A.configurarSecuenciaAction(undefined, fd(PEDIDO))).error).toMatch(/dueño o un administrador/);
    expect(B.datos.fotofficeSequence).toHaveLength(0);
    expect(H.revalidate).not.toHaveBeenCalled();
  });

  it("guarda con el workspace de la sesión, deja el cambio en el historial y revalida", async () => {
    const r = await A.configurarSecuenciaAction(undefined, fd({ ...PEDIDO, conAnio: "1", workspaceId: "otro" }));
    expect(r).toEqual({ error: null, ok: "Numeración guardada." });
    expect(sec("PEDIDO")).toMatchObject({ prefix: "P-", withYear: true, digits: 4, nextValue: 42 });
    expect(sec("PEDIDO", "otro")).toBeUndefined();
    const cambio = B.datos.fotofficeSequenceChange[0]!;
    expect(cambio).toMatchObject({ workspaceId: "ws-1", key: "PEDIDO", actorUserId: 7, actorLabel: "Ana" });
    expect(describirCambioSecuencia(cambio.before, cambio.after)).toEqual([
      'Prefijo: sin prefijo → "P-"',
      "Año: sin año → con año",
      "Dígitos: 1 → 4",
      "Próximo número: 1 → 42",
    ]);
    expect(H.revalidate).toHaveBeenCalledWith("/workspace/configuracion/numeracion");
  });

  it("no deja volver a un número ya usado y el error llega a la pantalla", async () => {
    await A.configurarSecuenciaAction(undefined, fd(PEDIDO));
    B.agregar("fotofficeRecordNumber", { workspaceId: "ws-1", sequenceKey: "PEDIDO", year: null, value: 50, entityType: "PEDIDO", entityId: "e1" });
    H.revalidate.mockClear();
    const r = await A.configurarSecuenciaAction(undefined, fd({ ...PEDIDO, proximo: "50" }));
    expect(r).toEqual({ error: "No se puede volver a un número ya usado." });
    expect(sec("PEDIDO")!.nextValue).toBe(42);
    expect(H.revalidate).not.toHaveBeenCalled();
  });

  it("prefijo inválido o clave inventada: rechazados", async () => {
    expect((await A.configurarSecuenciaAction(undefined, fd({ ...PEDIDO, prefijo: "P/" }))).error).toMatch(/prefijo/);
    expect((await A.configurarSecuenciaAction(undefined, fd({ ...PEDIDO, clave: "FACTURA" }))).error).toBe("No encontramos esa numeración.");
    expect((await A.configurarSecuenciaAction(undefined, fd({ ...PEDIDO, prefijo: "x".repeat(51) }))).error).toBe("Los datos no son válidos.");
  });
});

describe("describirCambioSecuencia", () => {
  it("sin diferencias o con datos rotos no falla", () => {
    expect(describirCambioSecuencia({ prefix: "", withYear: false, digits: 1, nextValue: 1 }, { prefix: "", withYear: false, digits: 1, nextValue: 1 })).toEqual([
      "Sin cambios de formato",
    ]);
    expect(describirCambioSecuencia(null, "x")).toEqual(["Sin cambios de formato"]);
  });
});
