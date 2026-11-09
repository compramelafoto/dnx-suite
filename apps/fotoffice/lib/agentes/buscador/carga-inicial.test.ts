import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const { importarConocidos } = await import("./carga-inicial");

const WS = "cmv5z6qxwwmmhf0q5gp8qja1j";

function sembrar() {
  const tag = B.agregar("fotofficeTag", { workspaceId: WS, name: "Fotógrafo", nameKey: "fotografo" });
  const otra = B.agregar("fotofficeTag", { workspaceId: WS, name: "Cliente VIP", nameKey: "cliente vip" });
  const a = B.agregar("client", { workspaceId: WS, clientNumber: 1, firstName: "Ana", lastName: "Luz", email: "ana@luz.com", phone: "341 555 1111", city: "Rosario" });
  const b = B.agregar("client", { workspaceId: WS, clientNumber: 2, kind: "EMPRESA", businessName: "Estudio Bruma", email: "hola@bruma.com" });
  const c = B.agregar("client", { workspaceId: WS, clientNumber: 3, firstName: "Carlos", lastName: "Sin Etiqueta", email: "c@x.com" });
  B.agregar("fotofficeContactoPerfil", { workspaceId: WS, clientId: b.id, website: "https://www.bruma.com", province: "Santa Fe" });
  B.agregar("fotofficeTagAssignment", { tagId: tag.id, clientId: a.id });
  B.agregar("fotofficeTagAssignment", { tagId: tag.id, clientId: b.id });
  B.agregar("fotofficeTagAssignment", { tagId: otra.id, clientId: c.id });
  return { a, b, c };
}

beforeEach(() => B.vaciar());

describe("importarConocidos", () => {
  it("importa los clientes con etiqueta Fotógrafo", async () => {
    const { a, b } = sembrar();
    const r = await importarConocidos();
    expect(r).toEqual({ importados: 2, yaEstaban: 0 });
    const cs = B.datos.dnxContacto;
    expect(cs).toHaveLength(2);
    for (const c of cs) {
      expect(c).toMatchObject({ tipo: "FOTOGRAFO", creadoPor: "CARGA_INICIAL", estado: "REVISADO", vinculo: "CONOCIDO_DNX_ESTUDIO" });
    }
    expect(cs.map((c) => c.vinculoId).sort()).toEqual([a.id, b.id].sort());
    const bruma = cs.find((c) => c.vinculoId === b.id)!;
    expect(bruma).toMatchObject({ nombre: "Estudio Bruma", web: "https://www.bruma.com", provincia: "Santa Fe", email: "hola@bruma.com" });
    expect(B.datos.dnxContactoDato.every((d) => d.fuente === "ALBOOM")).toBe(true);
    // Los prospectos nunca se escriben en Client.
    expect(B.datos.client).toHaveLength(3);
  });

  it("correrlo dos veces no duplica", async () => {
    sembrar();
    await importarConocidos();
    const eventos = B.datos.dnxContactoEvento.length;
    const datos = B.datos.dnxContactoDato.length;
    const r = await importarConocidos();
    expect(r).toEqual({ importados: 0, yaEstaban: 2 });
    expect(B.datos.dnxContacto).toHaveLength(2);
    expect(B.datos.dnxContactoEvento).toHaveLength(eventos);
    expect(B.datos.dnxContactoDato).toHaveLength(datos);
  });
});
