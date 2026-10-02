import { describe, expect, it } from "vitest";
import { guardarObservacionesImportadas, idObservacionesDeSocio } from "./observaciones";

type Nota = Record<string, unknown>;

/** Transacción de mentira: guarda las notas por id y respeta `skipDuplicates` como ON CONFLICT DO NOTHING. */
function txFalsa(clientes: { id: string; workspaceId: string; memberId: string }[] = []) {
  const notas = new Map<string, Nota>();
  const tx = {
    client: {
      findFirst: async ({ where }: { where: { workspaceId: string; memberId: string } }) =>
        clientes.find((c) => c.workspaceId === where.workspaceId && c.memberId === where.memberId) ?? null,
    },
    fotofficeNote: {
      createMany: async ({ data, skipDuplicates }: { data: Nota[]; skipDuplicates?: boolean }) => {
        for (const n of data) {
          if (notas.has(n.id as string)) {
            if (!skipDuplicates) throw Object.assign(new Error("P2002"), { code: "P2002" });
            continue;
          }
          notas.set(n.id as string, n);
        }
        return { count: data.length };
      },
    },
  };
  return { tx: tx as never, notas };
}

describe("observaciones del CSV → nota fijada de la ficha", () => {
  it("una fila con observaciones crea exactamente una nota fijada con esos datos", async () => {
    const { tx, notas } = txFalsa();
    await guardarObservacionesImportadas(tx, "ws-1", { id: "m1", notes: "Vino por la muestra" });
    expect([...notas.values()]).toEqual([
      {
        id: "obs_m_m1",
        workspaceId: "ws-1",
        clientId: null,
        memberId: "m1",
        categoryId: null,
        body: "Vino por la muestra",
        pinned: true,
        authorUserId: null,
        authorLabel: "Importado",
      },
    ]);
    expect(idObservacionesDeSocio("m1")).toBe("obs_m_m1");
  });

  it("sin observaciones (o sólo espacios) no crea ninguna", async () => {
    const { tx, notas } = txFalsa();
    await guardarObservacionesImportadas(tx, "ws-1", { id: "m1", notes: null });
    await guardarObservacionesImportadas(tx, "ws-1", { id: "m2", notes: "   " });
    expect(notas.size).toBe(0);
  });

  it("importar otra vez el mismo socio no duplica (el choque de id se tolera)", async () => {
    const { tx, notas } = txFalsa();
    await guardarObservacionesImportadas(tx, "ws-1", { id: "m1", notes: "Primera" });
    await guardarObservacionesImportadas(tx, "ws-1", { id: "m1", notes: "Segunda" });
    expect(notas.size).toBe(1);
    expect(notas.get("obs_m_m1")?.body).toBe("Primera");
  });

  it("con cliente enlazado en el mismo workspace, la nota es del cliente", async () => {
    const { tx, notas } = txFalsa([
      { id: "c-ajeno", workspaceId: "ws-2", memberId: "m1" },
      { id: "c1", workspaceId: "ws-1", memberId: "m1" },
    ]);
    await guardarObservacionesImportadas(tx, "ws-1", { id: "m1", notes: "Algo" });
    expect(notas.get("obs_m_m1")).toMatchObject({ clientId: "c1", memberId: null, workspaceId: "ws-1" });
  });
});
