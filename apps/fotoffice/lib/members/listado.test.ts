import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => {
  class MemberConcurrencyError extends Error {}
  return {
    memberFindMany: vi.fn(),
    categoryFindMany: vi.fn(),
    categoryFindFirst: vi.fn(),
    updateMember: vi.fn(),
    tagFindFirst: vi.fn(),
    tagFindMany: vi.fn(),
    poner: vi.fn(),
    quitar: vi.fn(),
    inviteOneMember: vi.fn(),
    MemberConcurrencyError,
  };
});

vi.mock("@repo/db", () => ({
  prisma: {
    member: { findMany: (...a: unknown[]) => H.memberFindMany(...a) },
    fotofficeTag: { findFirst: (...a: unknown[]) => H.tagFindFirst(...a), findMany: (...a: unknown[]) => H.tagFindMany(...a) },
    memberCategory: {
      findMany: (...a: unknown[]) => H.categoryFindMany(...a),
      findFirst: (...a: unknown[]) => H.categoryFindFirst(...a),
    },
  },
}));
vi.mock("@repo/db/fotoffice-members", () => ({
  updateMember: (...a: unknown[]) => H.updateMember(...a),
  MemberConcurrencyError: H.MemberConcurrencyError,
}));
vi.mock("@/lib/ficha/etiquetas", () => ({
  ponerEtiqueta: (...a: unknown[]) => H.poner(...a),
  quitarEtiqueta: (...a: unknown[]) => H.quitar(...a),
  buscarEtiquetas: vi.fn(async () => []),
}));
vi.mock("@/lib/members/invite-member", () => ({ inviteOneMember: (...a: unknown[]) => H.inviteOneMember(...a) }));

import { listadoSocios, whereSocios } from "./listado";
import { INVITE_BATCH_MAX } from "./invitations";
import { memberAccessWhere } from "@repo/db/fotoffice-member-access-filter";
import { cargoImpagoWhere } from "@/lib/membership/dues-overview";
import { PARAMETROS_RESERVADOS, type ConsultaResuelta, type ContextoListado } from "@/lib/listado/tipos";
import { personVocabulary } from "@/lib/vocabulario/personas";

const base = { q: "", filtros: {}, periodos: {}, etiquetasRelacion: {}, orden: { campo: "apellido", desc: false }, pagina: 1, filas: 25, ver: null } as ConsultaResuelta;
const ctx: ContextoListado = { workspaceId: "w1", workspaceName: "W", userId: 7, userLabel: "Ana", role: "OWNER" };
const def = listadoSocios(personVocabulary({ singular: "voluntario", plural: "voluntarios" }));
const accion = (clave: string) => def.acciones.find((a) => a.clave === clave)!;

describe("whereSocios", () => {
  it("siempre filtra por workspace", () => expect(whereSocios("w1", base)).toEqual({ workspaceId: "w1" }));

  it("traduce estado y categoría", () => {
    expect(whereSocios("w1", { ...base, filtros: { estado: "SUSPENDED", categoria: "cat1" } })).toEqual({
      workspaceId: "w1",
      status: "SUSPENDED",
      categoryId: "cat1",
    });
  });

  it("el acceso delega en memberAccessWhere", () => {
    const w = whereSocios("w1", { ...base, filtros: { acceso: "CON_ACCESO" } });
    expect(w).toEqual({ workspaceId: "w1", AND: [memberAccessWhere("CON_ACCESO")] });
    expect(whereSocios("w1", { ...base, filtros: { acceso: "INVENTADO" } })).toEqual({ workspaceId: "w1" });
  });

  it("deuda usa la misma condición de cuota impaga que Cuotas", () => {
    expect(whereSocios("w1", { ...base, filtros: { deuda: "si" } }).charges).toEqual({ some: cargoImpagoWhere("w1") });
    expect(whereSocios("w1", { ...base, filtros: { deuda: "no" } }).charges).toEqual({ none: cargoImpagoWhere("w1") });
  });

  it("busca en nombre, apellido, número, correo y documento", () => {
    const w = whereSocios("w1", { ...base, q: " perez " });
    expect(w.workspaceId).toBe("w1");
    expect(w.OR).toHaveLength(5);
    expect(w.OR).toContainEqual({ documentNumber: { contains: "perez", mode: "insensitive" } });
  });
});

describe("campos personalizados en el where", () => {
  it("la búsqueda suma los ids de los campos al OR y los filtros acotan dentro del AND", () => {
    const w = whereSocios("w1", { ...base, q: "x", filtros: { acceso: "SIN_EMAIL" }, campos: { soloIds: ["m1", "m2"], buscarIds: ["m1", "m3"] } });
    expect(w.workspaceId).toBe("w1");
    expect(w.OR).toContainEqual({ id: { in: ["m1"] } });
    expect(w.AND).toContainEqual({ id: { in: ["m1", "m2"] } });
  });
  it("si filtros y búsqueda juntos pasan el presupuesto de ids, la lista queda vacía", () => {
    const rango = (n: number) => Array.from({ length: n }, (_, i) => `m${i}`);
    const w = whereSocios("w1", { ...base, q: "x", campos: { soloIds: rango(15_000), buscarIds: rango(18_000) } });
    expect(w.AND).toContainEqual({ id: { in: [] } });
    expect(w.OR).not.toContainEqual(expect.objectContaining({ id: expect.anything() }));
  });
});

describe("definición", () => {
  it("ninguna clave propia usa el prefijo de los campos personalizados", () => {
    for (const f of def.filtros) expect(f.clave.startsWith("cf_")).toBe(false);
    for (const c of def.columnas) expect(c.clave.startsWith("cf_")).toBe(false);
  });
  it("usa el vocabulario del workspace", () => {
    expect(def.sustantivo).toEqual({ singular: "voluntario", plural: "voluntarios" });
    expect(def.titulo).toBe("Voluntarios");
    expect(accion("invitar").confirmacion).toBe("Vas a invitar al portal a {n} voluntarios.");
    expect(accion("categoria").confirmacion).toBe("Vas a cambiar la categoría de {n} voluntarios a {parametro}.");
  });

  it("ninguna clave de filtro está reservada", () => {
    for (const f of def.filtros) expect(PARAMETROS_RESERVADOS as readonly string[]).not.toContain(f.clave);
  });

  it("los órdenes incluyen el de por defecto y los de las columnas", () => {
    expect(def.ordenes).toContain(def.ordenPorDefecto.campo);
    for (const c of def.columnas) if (c.orden) expect(def.ordenes).toContain(c.orden);
  });

  it("invitar conserva el tope de la tanda; cambiar categoría llega a 5.000; etiquetar, a 1.000", () => {
    expect(accion("invitar").maximo).toBe(INVITE_BATCH_MAX);
    expect(accion("categoria").maximo).toBe(5000);
    expect(accion("etiqueta").maximo).toBe(1000);
    expect(accion("invitar").capacidad).toBe("operar");
    expect(accion("categoria").capacidad).toBe("operar");
  });
});

describe("acceso a filas", () => {
  beforeEach(() => H.memberFindMany.mockReset());

  it("traerPorIds devuelve en el orden pedido, filtra por workspace e ignora ids mal formados", async () => {
    H.memberFindMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    const filas = await def.traerPorIds(ctx, ["b", "../x", "a"]);
    expect(filas.map((f) => f.id)).toEqual(["b", "a"]);
    expect(H.memberFindMany.mock.calls[0][0].where).toEqual({ workspaceId: "w1", id: { in: ["b", "a"] } });
  });

  it("traer y traerIds filtran por workspace", async () => {
    H.memberFindMany.mockResolvedValue([]);
    await def.traer(ctx, base, { skip: 0, take: 25 });
    await def.traerIds(ctx, base, 100);
    for (const call of H.memberFindMany.mock.calls) expect(call[0].where.workspaceId).toBe("w1");
  });
});

describe("invitar al portal", () => {
  beforeEach(() => {
    H.memberFindMany.mockReset();
    H.inviteOneMember.mockReset();
  });

  it("elegibles excluye a quien no tiene correo y a quien ya tiene acceso", async () => {
    H.memberFindMany.mockResolvedValue([
      { id: "a", email: "a@x.com", userId: null, status: "ACTIVE" },
      { id: "b", email: null, userId: null, status: "ACTIVE" },
      { id: "c", email: "  ", userId: null, status: "ACTIVE" },
      { id: "d", email: "d@x.com", userId: 3, status: "ACTIVE" },
    ]);
    const r = await accion("invitar").elegibles!(ctx, ["a", "b", "c", "d"], null);
    expect(r.elegibles).toEqual(["a"]);
    expect(r.excluidos).toEqual([
      { id: "b", motivo: "no tiene correo" },
      { id: "c", motivo: "no tiene correo" },
      { id: "d", motivo: "ya tiene acceso" },
    ]);
    expect(H.memberFindMany.mock.calls[0][0].where.workspaceId).toBe("w1");
  });

  it("aplicar invita de a uno con el workspace de la sesión y cuenta los fallidos", async () => {
    H.inviteOneMember.mockResolvedValueOnce({ error: null, ok: true, sentTo: "a@x.com" }).mockResolvedValueOnce({ error: "no salió" });
    const r = await accion("invitar").aplicar(ctx, ["a", "b"], null);
    expect(r.aplicados).toBe(1);
    expect(r.fallidos).toEqual([{ id: "b", error: "no salió" }]);
    const [workspace, actor, id] = H.inviteOneMember.mock.calls[0];
    expect(workspace).toEqual({ id: "w1" });
    expect(actor).toEqual({ id: 7, name: "Ana", email: null });
    expect(id).toBe("a");
  });
});

describe("cambiar categoría", () => {
  beforeEach(() => {
    H.memberFindMany.mockReset();
    H.categoryFindMany.mockReset();
    H.categoryFindFirst.mockReset();
    H.updateMember.mockReset();
  });

  it("las opciones son las categorías activas de este workspace", async () => {
    H.categoryFindMany.mockResolvedValue([{ id: "c1", name: "Activo" }]);
    expect(await accion("categoria").parametro!.opciones(ctx)).toEqual([{ valor: "c1", etiqueta: "Activo" }]);
    expect(H.categoryFindMany.mock.calls[0][0].where).toEqual({ workspaceId: "w1", isActive: true });
  });

  it("elegibles excluye a quien ya tiene esa categoría", async () => {
    H.memberFindMany.mockResolvedValue([
      { id: "a", categoryId: "c1" },
      { id: "b", categoryId: "c2" },
    ]);
    const r = await accion("categoria").elegibles!(ctx, ["a", "b"], "c1");
    expect(r).toEqual({ elegibles: ["b"], excluidos: [{ id: "a", motivo: "ya tiene esa categoría" }] });
  });

  it("aplicar va socio por socio y cuenta no encontrados y cambios concurrentes como fallidos", async () => {
    H.categoryFindFirst.mockResolvedValue({ id: "c1" });
    H.memberFindMany.mockResolvedValue([
      { id: "a", categoryId: "c0" },
      { id: "b", categoryId: null },
      { id: "c", categoryId: "c2" },
    ]);
    H.updateMember
      .mockResolvedValueOnce({ id: "a" })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new H.MemberConcurrencyError());
    const r = await accion("categoria").aplicar(ctx, ["a", "b", "c"], "c1");
    expect(r.aplicados).toBe(1);
    expect(r.fallidos).toEqual([
      { id: "b", error: "no encontrado" },
      { id: "c", error: "se modificó mientras tanto" },
    ]);
    expect(r.detalle).toEqual([{ id: "a", antes: "c0", despues: "c1" }]);
    expect(H.updateMember).toHaveBeenCalledWith("w1", "a", { categoryId: "c1" }, {
      actor: { userId: 7, label: "Ana" },
      action: "UPDATED",
      source: "MANUAL",
    });
    expect(H.categoryFindFirst.mock.calls[0][0].where).toEqual({ id: "c1", workspaceId: "w1", isActive: true });
  });

  it("un error inesperado en una fila no corta el lote: se cuenta como fallido y se sigue", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    H.categoryFindFirst.mockResolvedValue({ id: "c1" });
    H.memberFindMany.mockResolvedValue([
      { id: "a", categoryId: "c0" },
      { id: "b", categoryId: "c0" },
      { id: "c", categoryId: "c0" },
    ]);
    H.updateMember
      .mockResolvedValueOnce({ id: "a" })
      .mockRejectedValueOnce(new Error("db"))
      .mockResolvedValueOnce({ id: "c" });
    const r = await accion("categoria").aplicar(ctx, ["a", "b", "c"], "c1");
    expect(r.aplicados).toBe(2);
    expect(r.fallidos).toEqual([{ id: "b", error: "error inesperado" }]);
    expect(r.detalle).toEqual([
      { id: "a", antes: "c0", despues: "c1" },
      { id: "c", antes: "c0", despues: "c1" },
    ]);
    expect(consola).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ memberId: "b" }));
    consola.mockRestore();
  });

  it("el actor nunca queda con etiqueta vacía", async () => {
    H.categoryFindFirst.mockResolvedValue({ id: "c1" });
    H.memberFindMany.mockResolvedValue([{ id: "a", categoryId: null }]);
    H.updateMember.mockResolvedValue({ id: "a" });
    await accion("categoria").aplicar({ ...ctx, userLabel: "   " }, ["a"], "c1");
    expect(H.updateMember.mock.calls[0][3].actor).toEqual({ userId: 7, label: "Usuario 7" });
  });

  it("aplicar no toca nada si la categoría no es de este workspace", async () => {
    H.categoryFindFirst.mockResolvedValue(null);
    const r = await accion("categoria").aplicar(ctx, ["a"], "ajena");
    expect(r.aplicados).toBe(0);
    expect(r.fallidos).toEqual([{ id: "a", error: "categoría no válida" }]);
    expect(H.updateMember).not.toHaveBeenCalled();
  });
});

describe("etiquetas", () => {
  const acc = () => accion("etiqueta");
  const filtroEtiqueta = { OR: [{ fotofficeTags: { some: { tagId: "t1" } } }, { clientLink: { fotofficeTags: { some: { tagId: "t1" } } } }] };
  beforeEach(() => {
    H.memberFindMany.mockReset(); H.tagFindFirst.mockReset(); H.tagFindMany.mockReset(); H.poner.mockReset(); H.quitar.mockReset();
  });

  it("filtra por las etiquetas del socio o de su cliente vinculado", () => {
    expect(whereSocios("w1", { ...base, filtros: { etiqueta: "t1" } }).AND).toEqual([filtroEtiqueta]);
  });
  it("la búsqueda y el acceso conviven con el filtro de etiqueta", () => {
    const w = whereSocios("w1", { ...base, q: "ana", filtros: { etiqueta: "t1", acceso: "SIN_EMAIL" } });
    expect(w.OR).toHaveLength(5);
    expect(w.AND).toHaveLength(2);
    expect(w.AND).toContainEqual(filtroEtiqueta);
  });
  it("el filtro es una relación con buscador y rechaza etiquetas de otro workspace", async () => {
    expect(def.filtros.find((f) => f.clave === "etiqueta")).toMatchObject({ tipo: "relacion", conBuscador: true });
    H.tagFindFirst.mockResolvedValue(null);
    expect(await def.validarRelacion!(ctx, "etiqueta", "ajena")).toBeNull();
    expect(H.tagFindFirst.mock.calls[0][0].where).toEqual({ id: "ajena", workspaceId: "w1" });
  });
  it("aplicar pone la etiqueta sobre el cliente vinculado y sobre el socio si no tiene cliente", async () => {
    H.tagFindFirst.mockResolvedValue({ id: "t1" });
    H.memberFindMany.mockResolvedValue([
      { id: "a", clientLink: { id: "c1" } },
      { id: "b", clientLink: null },
    ]);
    H.poner.mockResolvedValue({ ok: true });
    const r = await acc().aplicar(ctx, ["a", "b"], "+t1");
    expect(r.aplicados).toBe(2);
    expect(H.poner.mock.calls[0][1]).toEqual({ clientId: "c1", memberId: "a" });
    expect(H.poner.mock.calls[1][1]).toEqual({ clientId: null, memberId: "b" });
  });
  it("cuenta fallidos por fila sin abortar y no toca nada con una etiqueta ajena", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    H.tagFindFirst.mockResolvedValue({ id: "t1" });
    H.memberFindMany.mockResolvedValue([{ id: "a", clientLink: null }, { id: "b", clientLink: null }]);
    H.quitar.mockRejectedValueOnce(new Error("db")).mockResolvedValueOnce({ ok: true });
    const r = await acc().aplicar(ctx, ["a", "b", "zz"], "-t1");
    expect(r.aplicados).toBe(1);
    expect(r.fallidos).toEqual([{ id: "a", error: "error inesperado" }, { id: "zz", error: "no encontrado" }]);
    consola.mockRestore();
    H.tagFindFirst.mockResolvedValue(null);
    H.poner.mockReset();
    expect((await acc().aplicar(ctx, ["a"], "+ajena")).aplicados).toBe(0);
    expect(H.poner).not.toHaveBeenCalled();
  });
});
