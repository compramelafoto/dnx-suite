import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ bulk: vi.fn(), guardar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/db/fotoffice-members", () => ({
  bulkCreateMembers: H.bulk,
  listMemberCategories: async () => [{ id: "cat-1", name: "Socio activo" }],
  listMemberIdentifiersForWorkspace: async () => ({ memberNumbers: [], documents: [], emails: [] }),
}));
vi.mock("@/lib/members/access", () => ({
  requireMembersManageContext: async () => ({
    workspace: { id: "ws-1", name: "SFPR" },
    user: { id: 7, name: "Ana", email: "ana@x.com" },
  }),
}));
vi.mock("@/lib/vocabulario/load", async () => {
  const { personVocabulary } = await import("@/lib/vocabulario/personas");
  return { loadPersonVocabulary: async () => personVocabulary(null) };
});
vi.mock("@/lib/members/import/observaciones", () => ({ guardarObservacionesImportadas: H.guardar }));

const { confirmMemberImportAction } = await import("./members-import");

const HEADER =
  "memberNumber,firstName,lastName,documentType,documentNumber,email,phone,birthDate,address,city,province,postalCode,joinedAt,status,category,notes";

beforeEach(() => {
  H.guardar.mockReset().mockResolvedValue(undefined);
  // Simula la transacción: crea cada socio y llama al gancho con la misma `tx`.
  H.bulk.mockReset().mockImplementation(async (_ws, inputs, opts) => {
    const tx = { soy: "tx" };
    const creados = [];
    for (const [i, input] of inputs.entries()) {
      const m = { id: `m${i + 1}`, ...input };
      await opts.afterCreate?.(tx, m);
      creados.push(m);
    }
    return creados;
  });
});

describe("confirmMemberImportAction — observaciones", () => {
  it("guarda las observaciones de cada socio creado dentro de la transacción del lote", async () => {
    const csv = `${HEADER}\n124,Juan,Pérez,,,,,,,,,,2024-01-15,ACTIVE,Socio activo,Vino por la muestra\n125,Eva,Díaz,,,,,,,,,,2024-01-15,ACTIVE,Socio activo,`;
    const r = await confirmMemberImportAction(csv);
    expect(r).toEqual({ ok: true, createdCount: 2 });
    // La columna vieja se sigue escribiendo como antes.
    expect(H.bulk.mock.calls[0]![1][0].notes).toBe("Vino por la muestra");
    expect(H.guardar).toHaveBeenCalledTimes(2);
    expect(H.guardar.mock.calls[0]).toEqual([{ soy: "tx" }, "ws-1", expect.objectContaining({ id: "m1", notes: "Vino por la muestra" })]);
    expect(H.guardar.mock.calls[1]![2]).toMatchObject({ id: "m2", notes: null });
  });
});
