import { beforeEach, describe, expect, it, vi } from "vitest";

// Sin esto, importar `./members` carga `@repo/db/fotoffice-members`, que instancia Prisma y
// pide DATABASE_URL: el test se caería por algo que no tiene nada que ver con lo que prueba.
vi.mock("@repo/db/fotoffice-members", () => ({
  searchMembers: vi.fn(),
  updateMember: vi.fn(),
}));

const { memberContactSource, toSyncablePerson } = await import("./members");
// Mismo módulo mockeado que usa `members.ts` por dentro: agarrando estas referencias podemos
// decirle qué devolver y mirar con qué se los llama, sin tocar una base real.
const { searchMembers, updateMember } = await import("@repo/db/fotoffice-members");
const searchMembersMock = vi.mocked(searchMembers);
const updateMemberMock = vi.mocked(updateMember);

beforeEach(() => {
  searchMembersMock.mockReset();
  updateMemberMock.mockReset();
});

const socio = (over: Record<string, unknown> = {}) => ({
  id: "m-1",
  memberNumber: "124",
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@ejemplo.com",
  phone: "342 5550000",
  address: "San Martín 1234",
  city: "Santa Fe",
  province: "Santa Fe",
  postalCode: "3000",
  birthDate: new Date("1985-04-12T00:00:00Z"),
  businessName: "Estudio Pérez",
  status: "ACTIVE",
  updatedAt: new Date("2026-09-16T10:00:00Z"),
  ...over,
});

describe("un socio como persona sincronizable", () => {
  it("lleva los datos de contacto", () => {
    const p = toSyncablePerson(socio(), "Activo");
    expect(p.sourceId).toBe("m-1");
    expect(p.values).toMatchObject({
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@ejemplo.com",
      phone: "342 5550000",
      city: "Santa Fe",
    });
  });

  it("la fecha viaja como texto, para poder compararla con lo que devuelve Google", () => {
    expect(toSyncablePerson(socio(), "Activo").values.birthDate).toBe("1985-04-12");
  });

  it("un socio sin cumpleaños no rompe", () => {
    expect(toSyncablePerson(socio({ birthDate: null }), "Activo").values.birthDate).toBeNull();
  });

  it("el número de socio y la categoría van a la vista en el contacto", () => {
    // Sirven justamente cuando suena el teléfono y hay que saber quién llama.
    const p = toSyncablePerson(socio(), "Activo");
    expect(p.labels).toEqual({ "Nº de socio": "124", Categoría: "Activo", Estado: "Activo" });
  });

  it("un socio sin categoría no inventa una", () => {
    const p = toSyncablePerson(socio(), null);
    expect(p.labels["Categoría"]).toBeUndefined();
  });

  it("el estudio va como organización", () => {
    expect(toSyncablePerson(socio(), "Activo").organization).toBe("Estudio Pérez");
  });
});

describe("qué acepta Socios que le corrijan desde el celular", () => {
  it("los datos de contacto vuelven", () => {
    expect(memberContactSource.pullableFields).toEqual([
      "firstName",
      "lastName",
      "email",
      "phone",
      "address",
      "city",
      "province",
      "postalCode",
      "birthDate",
    ]);
  });

  it("es el módulo de socios, y su marca es estable", () => {
    // `sourceType` se guarda en la base y viaja en la marca de cada contacto de Google:
    // cambiarlo deja huérfanos a todos los contactos ya creados.
    expect(memberContactSource.moduleKey).toBe("members");
    expect(memberContactSource.sourceType).toBe("MEMBER");
    expect(memberContactSource.moduleLabel).toBe("Socios");
  });
});

/**
 * Arma una página tal como la devuelve `searchMembers`. El tipo real (`MemberSearchResult`)
 * exige todos los campos de `Member` de Prisma; acá sólo importan los que usa `list()`
 * (`items` y `total`), así que se cierra con un `as unknown as` — el mismo recurso que usa
 * `members.ts` para el lado contrario (`m as unknown as MemberRow`).
 */
function pagina(items: ReadonlyArray<Record<string, unknown>>, total: number) {
  return { items, total, page: 1, pageSize: 50, pageCount: 1 } as unknown as Awaited<
    ReturnType<typeof searchMembers>
  >;
}

describe("list(): el bucle de paginación tiene que terminar siempre", () => {
  // Es la lógica de mayor impacto de todo el módulo: la corre el cron de sincronización de
  // TODAS las instituciones. Un bucle que no termina acá no cuelga a una sola, las cuelga a
  // todas.

  it("un padrón vacío no pide una segunda página", async () => {
    searchMembersMock.mockResolvedValueOnce(pagina([], 0));

    const personas = await memberContactSource.list("ws1");

    expect(personas).toEqual([]);
    expect(searchMembersMock).toHaveBeenCalledTimes(1);
  });

  it("un solo socio corta en la primera vuelta", async () => {
    searchMembersMock.mockResolvedValueOnce(pagina([socio()], 1));

    const personas = await memberContactSource.list("ws1");

    expect(personas).toHaveLength(1);
    expect(personas[0].sourceId).toBe("m-1");
    expect(searchMembersMock).toHaveBeenCalledTimes(1);
  });

  it("varias páginas: junta a todos los socios y pide sólo los ACTIVE", async () => {
    // Un socio de baja deja de pertenecer al grupo de Google — esa decisión se toma acá,
    // filtrando por status, no en otra capa.
    searchMembersMock
      .mockResolvedValueOnce(
        pagina([socio({ id: "m-1" }), socio({ id: "m-2", memberNumber: "125" })], 3),
      )
      .mockResolvedValueOnce(pagina([socio({ id: "m-3", memberNumber: "126" })], 3));

    const personas = await memberContactSource.list("ws1");

    expect(personas.map((p) => p.sourceId)).toEqual(["m-1", "m-2", "m-3"]);
    expect(searchMembersMock).toHaveBeenCalledTimes(2);
    for (const [, filtros] of searchMembersMock.mock.calls) {
      expect(filtros).toMatchObject({ status: "ACTIVE" });
    }
  });

  it("si `total` no coincide con lo que realmente hay, el bucle termina igual", async () => {
    // Pasa de verdad: si alguien da de alta un socio mientras el bucle está corriendo, el
    // `count` de la primera página y el `findMany` de la siguiente pueden desincronizarse. Si
    // el corte dependiera sólo de comparar contra `total`, un `total` que quedó "alto" haría
    // que el bucle siguiera pidiendo páginas para siempre.
    searchMembersMock
      .mockResolvedValueOnce(pagina([socio()], 999))
      .mockResolvedValueOnce(pagina([], 999));

    const personas = await memberContactSource.list("ws1");

    expect(personas).toHaveLength(1);
    // Dos llamadas: la que trajo el único socio real y la que, al volver vacía, cortó el
    // bucle. Si esto alguna vez diera más de 2, es que la red de seguridad se rompió.
    expect(searchMembersMock).toHaveBeenCalledTimes(2);
  });

  it("la categoría de cada socio llega a la etiqueta correspondiente", async () => {
    searchMembersMock.mockResolvedValueOnce(
      pagina(
        [
          { ...socio({ id: "m-1" }), category: { name: "Honorario" } },
          { ...socio({ id: "m-2", memberNumber: "125" }), category: null },
        ],
        2,
      ),
    );

    const personas = await memberContactSource.list("ws1");

    expect(personas[0].labels["Categoría"]).toBe("Honorario");
    expect(personas[1].labels["Categoría"]).toBeUndefined();
  });
});

describe("applyPull(): con qué se llama a updateMember cuando Google corrige a un socio", () => {
  it("la fecha de texto llega convertida a Date, sin corrimiento de día", async () => {
    await memberContactSource.applyPull("ws1", "m-1", { birthDate: "1990-05-20" });

    expect(updateMemberMock).toHaveBeenCalledTimes(1);
    const [, , data] = updateMemberMock.mock.calls[0];
    expect(data.birthDate).toBeInstanceOf(Date);
    // Si la conversión corriera con el huso horario local en vez de UTC, esto daría
    // "1990-05-19" o "1990-05-21" según dónde corra el proceso.
    expect((data.birthDate as Date).toISOString().slice(0, 10)).toBe("1990-05-20");
  });

  it("la corrección queda marcada como SYSTEM / Google Contacts en la auditoría", async () => {
    // Es el rastro que deja "esto lo corrigió Google" en el historial del socio: si algo lo
    // cambia sin querer (o el default de `updateMember` se cuela), el historial pasa a decir
    // que fue una persona la que tocó el dato, y nadie se entera de que no fue así.
    await memberContactSource.applyPull("ws1", "m-1", { firstName: "Ana" });

    expect(updateMemberMock).toHaveBeenCalledTimes(1);
    const [, , , opciones] = updateMemberMock.mock.calls[0];
    expect(opciones).toMatchObject({
      source: "SYSTEM",
      actor: { userId: null, label: "Google Contacts" },
    });
  });

  it("un `changes` vacío no llama a updateMember", async () => {
    // No se escribe por gusto, y sobre todo no se inventa un evento en el historial del socio
    // por una sincronización que en los hechos no trajo ninguna corrección.
    await memberContactSource.applyPull("ws1", "m-1", {});

    expect(updateMemberMock).not.toHaveBeenCalled();
  });
});
