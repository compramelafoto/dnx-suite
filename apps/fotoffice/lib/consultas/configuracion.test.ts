import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const C = await import("./configuracion");
const S = await import("./semillas");

beforeEach(async () => {
  B.vaciar();
  await S.asegurarCatalogosIniciales("ws-1", "otra-org");
  await S.asegurarCatalogosIniciales("ws-2", "otra-org");
  B.agregar("serviceLeadForm", { id: "f-boda", workspaceId: "ws-1", name: "Bodas 2027", eventType: "BODA" });
  B.agregar("serviceLeadForm", { id: "f-15", workspaceId: "ws-1", name: "Quinces", eventType: "XV" });
  B.agregar("serviceLeadForm", { id: "f-ajeno", workspaceId: "ws-2", name: "Ajeno", eventType: "BODA" });
});

describe("formulariosConCategoriaReemplazada", () => {
  it("sin archivadas no avisa nada", async () => {
    expect(await C.formulariosConCategoriaReemplazada("ws-1")).toEqual([]);
  });

  it("con la equivalente archivada avisa qué categoría recibe ahora, sólo del workspace", async () => {
    const boda = B.datos.fotofficeConsultaCategoria.find((c) => c.workspaceId === "ws-1" && c.legacyEventType === "BODA")!;
    boda.archivedAt = new Date();
    const r = await C.formulariosConCategoriaReemplazada("ws-1");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ formularioId: "f-boda", formulario: "Bodas 2027" });
    expect(r[0]!.categoria).toBeTruthy();
    expect(r[0]!.categoria).not.toBe(boda.name);
    expect(await C.formulariosConCategoriaReemplazada("ws-2")).toEqual([]);
  });
});
