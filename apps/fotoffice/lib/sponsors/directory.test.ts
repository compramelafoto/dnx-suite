import { describe, expect, it, vi } from "vitest";

vi.mock("./clients", () => ({ partnersReader: vi.fn() }));
vi.mock("@/lib/raffles/partners-live", () => ({ elegirLogo: () => null }));

const { searchDirectory, estaEnDirectorio, selectFichaPublica } = await import("./directory");

type Fila = Record<string, unknown>;

function marca(over: Fila = {}): Fila {
  return {
    id: "p1",
    name: "Fotolab",
    description: "Laboratorio fotográfico de Rosario",
    type: "BUSINESS",
    city: "Rosario",
    provinceOrState: "Santa Fe",
    websiteUrl: "https://fotolab.com.ar",
    instagram: "fotolab",
    logoUrl: null,
    brandAssets: [],
    participations: [],
    // Lo que nunca debería salir aunque la base lo devolviera.
    email: "privado@fotolab.com",
    phone: "341 555-0000",
    notes: "le debemos plata",
    ...over,
  };
}

function baseFalsa(filas: Fila[], total = filas.length) {
  return {
    dnxPartner: {
      count: vi.fn().mockResolvedValue(total),
      findMany: vi.fn().mockImplementation((args: { select: Fila }) =>
        Promise.resolve("id" in args.select ? filas : filas.map(({ type, city, provinceOrState }) => ({ type, city, provinceOrState }))),
      ),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
}

describe("directorio de la red DNX", () => {
  it("pide a la base sólo la ficha pública", () => {
    const campos = Object.keys(selectFichaPublica("ws-1")).sort();
    expect(campos).toEqual(
      ["brandAssets", "city", "description", "id", "instagram", "logoUrl", "name", "participations", "provinceOrState", "type", "websiteUrl"].sort(),
    );
    for (const prohibido of ["email", "phone", "address", "taxId", "legalName", "notes", "contacts", "postalCode"]) {
      expect(campos).not.toContain(prohibido);
    }
  });

  it("las participaciones que pide son sólo las de esta institución, y sólo para saber si ya está", () => {
    const { participations } = selectFichaPublica("ws-1");
    expect(participations.where).toMatchObject({ application: "FOTO_OFFICE", contextType: "ORGANIZATION", contextId: "ws-1" });
    expect(participations.select).toEqual({ id: true });
  });

  it("la tarjeta no lleva contactos ni notas, y marca las ya vinculadas", async () => {
    const db = baseFalsa([marca(), marca({ id: "p2", name: "Otra", participations: [{ id: "x" }] })]);
    const r = await searchDirectory("ws-1", {}, db as never);
    expect(r.items.map((i) => [i.id, i.linked])).toEqual([
      ["p1", false],
      ["p2", true],
    ]);
    const tarjeta = r.items[0] as Record<string, unknown>;
    for (const prohibido of ["email", "phone", "notes", "participations"]) expect(tarjeta).not.toHaveProperty(prohibido);
    expect(tarjeta).toMatchObject({ tipoLabel: "Comercio", city: "Rosario", province: "Santa Fe" });
  });

  it("pagina en el servidor y no se pasa de la última página", async () => {
    const db = baseFalsa([marca()], 30);
    const r = await searchDirectory("ws-1", { pagina: "9" }, db as never);
    expect(r).toMatchObject({ total: 30, page: 2, pageCount: 2 });
    const pedido = db.dnxPartner.findMany.mock.calls.find(([a]) => "id" in a.select)![0];
    expect(pedido).toMatchObject({ skip: 24, take: 24 });
  });

  it("arma las opciones de tipo, provincia y ciudad con lo que hay, y las ciudades según la provincia", async () => {
    const db = baseFalsa([
      marca(),
      marca({ id: "p2", type: "BRAND", city: "Paraná", provinceOrState: "Entre Ríos" }),
      marca({ id: "p3", city: "rosario ", provinceOrState: "Santa Fe" }),
    ]);
    const r = await searchDirectory("ws-1", { provincia: "Santa Fe" }, db as never);
    expect(r.opciones.tipos.map((t) => t.etiqueta)).toEqual(["Comercio", "Marca"]);
    expect(r.opciones.provincias.map((t) => t.valor)).toEqual(["Entre Ríos", "Santa Fe"]);
    expect(r.opciones.ciudades.map((t) => t.valor)).toEqual(["Rosario"]);
  });

  it("antes de vincular, confirma que la marca está en el directorio público", async () => {
    const db = baseFalsa([]);
    expect(await estaEnDirectorio("ws-1", "p9", db as never)).toBe(false);
    const where = db.dnxPartner.findFirst.mock.calls[0][0].where;
    expect(where.AND[1]).toEqual({ id: "p9" });
    expect(JSON.stringify(where.AND[0])).toContain('"publicVisibility":"PUBLIC"');
    db.dnxPartner.findFirst.mockResolvedValue({ id: "p9" });
    expect(await estaEnDirectorio("ws-1", "p9", db as never)).toBe(true);
  });
});
