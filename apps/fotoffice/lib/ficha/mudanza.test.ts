import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/db", () => ({ prisma: {} }));

import { mudarPiezasDelSocioAlCliente } from "./mudanza";

type Llamada = { modelo: string; op: string; args: any };

function txFalso(datos: { etiquetasCliente?: string[]; etiquetasSocio?: { id: string; tagId: string }[]; relaciones?: any[]; relacionesCliente?: any[] }) {
  const llamadas: Llamada[] = [];
  const reg = (modelo: string, op: string, args: any) => llamadas.push({ modelo, op, args });
  const tx: any = {
    fotofficeNote: { updateMany: async (a: any) => (reg("nota", "updateMany", a), { count: 2 }) },
    fotofficeAttachment: { updateMany: async (a: any) => (reg("adjunto", "updateMany", a), { count: 1 }) },
    fotofficePersonEvent: { updateMany: async (a: any) => (reg("evento", "updateMany", a), { count: 4 }) },
    fotofficeTagAssignment: {
      findMany: async (a: any) => {
        reg("etiqueta", "findMany", a);
        return a.where.clientId ? (datos.etiquetasCliente ?? []).map((tagId) => ({ tagId })) : (datos.etiquetasSocio ?? []);
      },
      deleteMany: async (a: any) => (reg("etiqueta", "deleteMany", a), { count: a.where.id.in.length }),
      updateMany: async (a: any) => (reg("etiqueta", "updateMany", a), { count: a.where.id.in.length }),
    },
    fotofficePersonRelation: {
      findMany: async (a: any) => {
        reg("relacion", "findMany", a);
        return a.where.OR.some((o: any) => "fromMemberId" in o) ? (datos.relaciones ?? []) : (datos.relacionesCliente ?? []);
      },
      updateMany: async (a: any) => (reg("relacion", "updateMany", a), { count: 1 }),
      deleteMany: async (a: any) => (reg("relacion", "deleteMany", a), { count: a.where.id.in.length }),
    },
  };
  return { tx, llamadas };
}

const args = { workspaceId: "w1", memberId: "m1", clientId: "c1" };
const rel = (id: string, o: any) => ({ id, fromClientId: null, fromMemberId: null, toClientId: null, toMemberId: null, kind: "hijo", customLabel: null, ...o });

describe("mudarPiezasDelSocioAlCliente", () => {
  it("todas las operaciones filtran por workspace", async () => {
    const { tx, llamadas } = txFalso({ etiquetasSocio: [{ id: "a1", tagId: "t1" }], relaciones: [rel("r1", { fromMemberId: "m1", toClientId: "c9" })] });
    await mudarPiezasDelSocioAlCliente(tx, args);
    for (const l of llamadas) expect(JSON.stringify(l.args.where), `${l.modelo}.${l.op}`).toContain('"workspaceId":"w1"');
  });

  it("notas, adjuntos y eventos pasan al cliente y devuelve los conteos", async () => {
    const { tx, llamadas } = txFalso({});
    const r = await mudarPiezasDelSocioAlCliente(tx, args);
    expect(r).toEqual({ notas: 2, etiquetas: 0, adjuntos: 1, relaciones: 0, eventos: 4 });
    const nota = llamadas.find((l) => l.modelo === "nota")!;
    expect(nota.args).toEqual({ where: { workspaceId: "w1", memberId: "m1" }, data: { clientId: "c1", memberId: null } });
  });

  it("una etiqueta que el cliente ya tiene se borra del socio en vez de moverse", async () => {
    const { tx, llamadas } = txFalso({ etiquetasCliente: ["t1"], etiquetasSocio: [{ id: "a1", tagId: "t1" }, { id: "a2", tagId: "t2" }] });
    const r = await mudarPiezasDelSocioAlCliente(tx, args);
    expect(llamadas.find((l) => l.modelo === "etiqueta" && l.op === "deleteMany")!.args.where.id.in).toEqual(["a1"]);
    expect(llamadas.find((l) => l.modelo === "etiqueta" && l.op === "updateMany")!.args.where.id.in).toEqual(["a2"]);
    expect(r.etiquetas).toBe(1);
  });

  it("una relación del socio con su propio cliente se borra", async () => {
    const { tx, llamadas } = txFalso({ relaciones: [rel("r1", { fromMemberId: "m1", toClientId: "c1" })] });
    const r = await mudarPiezasDelSocioAlCliente(tx, args);
    expect(llamadas.find((l) => l.modelo === "relacion" && l.op === "deleteMany")!.args.where.id.in).toEqual(["r1"]);
    expect(llamadas.some((l) => l.modelo === "relacion" && l.op === "updateMany")).toBe(false);
    expect(r.relaciones).toBe(0);
  });

  it("cambia el lado del socio por el del cliente y borra las que quedarían repetidas", async () => {
    const { tx, llamadas } = txFalso({
      relaciones: [
        rel("r1", { fromMemberId: "m1", toClientId: "c9" }),
        rel("r2", { toMemberId: "m1", fromClientId: "c8" }),
        rel("r3", { fromMemberId: "m1", toClientId: "c9" }), // igual a r1 tras mudar
        rel("r4", { fromMemberId: "m1", toClientId: "c7" }), // ya existe en el cliente
      ],
      relacionesCliente: [rel("x", { fromClientId: "c1", toClientId: "c7" })],
    });
    const r = await mudarPiezasDelSocioAlCliente(tx, args);
    const updates = llamadas.filter((l) => l.modelo === "relacion" && l.op === "updateMany");
    expect(updates.map((u) => u.args.where.id)).toEqual(["r1", "r2"]);
    expect(updates[0].args.data).toEqual({ fromClientId: "c1", fromMemberId: null });
    expect(updates[1].args.data).toEqual({ toClientId: "c1", toMemberId: null });
    expect(llamadas.find((l) => l.op === "deleteMany" && l.modelo === "relacion")!.args.where.id.in).toEqual(["r3", "r4"]);
    expect(r.relaciones).toBe(2);
  });

  it("una relación que repite una existente en sentido inverso se borra", async () => {
    const { tx, llamadas } = txFalso({
      relaciones: [
        rel("r1", { fromMemberId: "m1", toClientId: "c7", kind: "hijo" }), // c7→c1 ya existe al revés
        rel("r2", { toMemberId: "m1", fromClientId: "c8", kind: "amigo" }), // c8→c1 ya existe al revés con otro tipo
        rel("r3", { fromMemberId: "m1", toClientId: "c9" }), // A→B y luego B→A entre los del socio
        rel("r4", { toMemberId: "m1", fromClientId: "c9" }),
      ],
      relacionesCliente: [
        rel("x", { fromClientId: "c7", toClientId: "c1" }),
        rel("y", { fromClientId: "c1", toClientId: "c8" }),
      ],
    });
    const r = await mudarPiezasDelSocioAlCliente(tx, args);
    expect(llamadas.filter((l) => l.modelo === "relacion" && l.op === "updateMany").map((u) => u.args.where.id)).toEqual(["r3"]);
    expect(llamadas.find((l) => l.modelo === "relacion" && l.op === "deleteMany")!.args.where.id.in).toEqual(["r1", "r2", "r4"]);
    expect(r.relaciones).toBe(1);
  });
});
