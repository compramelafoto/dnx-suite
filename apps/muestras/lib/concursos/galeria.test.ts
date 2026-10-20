import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { AVISO_TOPE, sincronizarObraConGaleria } = await import("./galeria");

type Obra = { id: string; activityId: string; imageUrl: string; title: string; authorName: string; authorUserId: number | null; authorProfileId: string | null; sortOrder: number; isHighlight: boolean };
type FilaConcurso = {
  id: string; activityId: string; include: boolean; imageStatus: string; imageUrl: string | null; exhibitConsent: string; consentBy: string | null;
  attributionRequired: boolean; authorUserId: number | null; authorName: string; title: string; rank: number; activityWorkId: string | null;
  imageError?: string | null; copiedAt?: Date | null;
};

function base() {
  const obras: Obra[] = [];
  const filas: FilaConcurso[] = [];
  const autores: { activityId: string; userId: number; displayName: string | null; profileId: string | null }[] = [];
  const codigos: { activityId: string; workId: string }[] = [];
  let n = 0;
  const tx = {
    culturalContestWork: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; activityId: string } }) => {
        const f = filas.find((x) => x.id === where.id && x.activityId === where.activityId);
        return f ? { ...f } : null;
      }),
      findMany: vi.fn(async ({ where }: { where: { activityId: string; id: { not: string }; rank: { gt: number } } }) =>
        filas.filter((f) => f.activityId === where.activityId && f.id !== where.id.not && f.activityWorkId && f.rank > where.rank.gt).map((f) => ({ activityWorkId: f.activityWorkId })),
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FilaConcurso> }) => Object.assign(filas.find((f) => f.id === where.id)!, data)),
    },
    culturalActivityWork: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; activityId: string } }) => obras.find((o) => o.id === where.id && o.activityId === where.activityId) ?? null),
      count: vi.fn(async () => obras.length),
      create: vi.fn(async ({ data }: { data: Omit<Obra, "id"> }) => {
        const o = { ...data, id: `aw${++n}` };
        obras.push(o);
        return { id: o.id };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Obra> }) => Object.assign(obras.find((o) => o.id === where.id)!, data)),
      deleteMany: vi.fn(async ({ where }: { where: { id: string } }) => {
        const i = obras.findIndex((o) => o.id === where.id);
        if (i >= 0) obras.splice(i, 1);
        return { count: i >= 0 ? 1 : 0 };
      }),
      updateMany: vi.fn(async ({ where }: { where: { sortOrder: { gte: number } } }) => {
        for (const o of obras) if (o.sortOrder >= where.sortOrder.gte) o.sortOrder += 1;
      }),
      aggregate: vi.fn(async (args: { where: { id?: { in: string[] } } }) => {
        const de = args.where.id ? obras.filter((o) => args.where.id!.in.includes(o.id)) : obras;
        const ordenes = de.map((o) => o.sortOrder);
        return { _min: { sortOrder: ordenes.length ? Math.min(...ordenes) : null }, _max: { sortOrder: ordenes.length ? Math.max(...ordenes) : null } };
      }),
    },
    culturalContestAuthor: {
      findUnique: vi.fn(async ({ where }: { where: { activityId_userId: { activityId: string; userId: number } } }) =>
        autores.find((a) => a.activityId === where.activityId_userId.activityId && a.userId === where.activityId_userId.userId) ?? null,
      ),
    },
    culturalActivityRoomCode: {
      deleteMany: vi.fn(async ({ where }: { where: { workId: string } }) => {
        const i = codigos.findIndex((c) => c.workId === where.workId);
        if (i >= 0) codigos.splice(i, 1);
      }),
    },
  };
  return { tx, obras, filas, autores, codigos };
}

const fila = (o: Partial<FilaConcurso> = {}): FilaConcurso => ({
  id: "cw1", activityId: "a1", include: true, imageStatus: "COPIED", imageUrl: "https://r2/muestras/10/fr-e1-x.webp", exhibitConsent: "ACCEPTED",
  consentBy: "AUTHOR", attributionRequired: false, authorUserId: 10, authorName: "Ana Pérez", title: "Amanecer", rank: 0, activityWorkId: null, ...o,
});

let b: ReturnType<typeof base>;
const sync = (id = "cw1") => sincronizarObraConGaleria(b.tx as never, "a1", id);
beforeEach(() => {
  b = base();
  b.autores.push({ activityId: "a1", userId: 10, displayName: null, profileId: "p-ana" });
});

describe("sincronizarObraConGaleria", () => {
  it("con permiso y la imagen copiada: entra a la muestra con autor, perfil e imagen", async () => {
    b.filas.push(fila());
    expect(await sync()).toEqual({ cambio: "CREADA" });
    expect(b.obras).toEqual([
      expect.objectContaining({ activityId: "a1", imageUrl: "https://r2/muestras/10/fr-e1-x.webp", title: "Amanecer", authorName: "Ana Pérez", authorUserId: 10, authorProfileId: "p-ana", isHighlight: false, sortOrder: 0 }),
    ]);
    expect(b.filas[0]!.activityWorkId).toBe("aw1");
  });

  it("base RULES sin atribución ni confirmación: Autoría reservada, sin perfil", async () => {
    b.filas.push(fila({ consentBy: "RULES" }));
    await sync();
    expect(b.obras[0]).toMatchObject({ authorName: "Autoría reservada", authorProfileId: null, authorUserId: 10 });
  });
  it("con atribución en las bases: su nombre", async () => {
    b.filas.push(fila({ consentBy: "RULES", attributionRequired: true }));
    await sync();
    expect(b.obras[0]).toMatchObject({ authorName: "Ana Pérez", authorProfileId: "p-ana" });
  });
  it("cuando el autor firma, re-sincronizar pasa de Autoría reservada a su firma, sin duplicar", async () => {
    b.filas.push(fila({ consentBy: "RULES" }));
    await sync();
    b.autores[0]!.displayName = "Ana P.";
    expect(await sync()).toEqual({ cambio: "ACTUALIZADA" });
    expect(b.obras).toHaveLength(1);
    expect(b.obras[0]).toMatchObject({ authorName: "Ana P.", authorProfileId: "p-ana" });
  });

  it("esperando al autor o sin la imagen: no entra", async () => {
    b.filas.push(fila({ exhibitConsent: "PENDING", consentBy: null, imageStatus: "PENDING", imageUrl: null }));
    expect(await sync()).toEqual({ cambio: "SIN_CAMBIO" });
    b.filas[0] = fila({ imageStatus: "PENDING", imageUrl: null });
    await sync();
    expect(b.obras).toHaveLength(0);
  });

  it("el autor la sacó: sale de la muestra, pierde su código de sala y se borra la copia", async () => {
    b.filas.push(fila());
    await sync();
    b.codigos.push({ activityId: "a1", workId: "aw1" });
    b.filas[0]!.exhibitConsent = "WITHDRAWN";
    expect(await sync()).toEqual({ cambio: "SACADA", borrarImagen: "https://r2/muestras/10/fr-e1-x.webp" });
    expect(b.obras).toHaveLength(0);
    expect(b.codigos).toHaveLength(0);
    expect(b.filas[0]).toMatchObject({ activityWorkId: null, imageStatus: "PENDING", imageUrl: null });
  });
  it("quien organiza la quitó: igual", async () => {
    b.filas.push(fila());
    await sync();
    b.filas[0]!.include = false;
    expect((await sync()).borrarImagen).toBe("https://r2/muestras/10/fr-e1-x.webp");
    expect(b.obras).toHaveLength(0);
  });

  it("tope técnico de 300: no la crea y avisa", async () => {
    for (let i = 0; i < 300; i++) b.obras.push({ id: `x${i}`, activityId: "a1", imageUrl: "u", title: "t", authorName: "a", authorUserId: null, authorProfileId: null, sortOrder: i, isHighlight: false });
    b.filas.push(fila());
    expect(await sync()).toEqual({ cambio: "TOPE", aviso: AVISO_TOPE });
    expect(b.obras).toHaveLength(300);
    expect(b.filas[0]!.activityWorkId).toBeNull();
  });

  it("re-sincronizar no duplica", async () => {
    b.filas.push(fila());
    await sync();
    await sync();
    await sync();
    expect(b.obras).toHaveLength(1);
  });

  it("respeta el orden del ranking aunque las imágenes lleguen desordenadas", async () => {
    b.obras.push({ id: "otra", activityId: "a1", imageUrl: "u", title: "Del editor", authorName: "x", authorUserId: null, authorProfileId: null, sortOrder: 0, isHighlight: false });
    b.filas.push(fila({ id: "cw2", rank: 2, title: "Segunda" }), fila({ id: "cw1", rank: 1, title: "Primera" }));
    await sync("cw2");
    await sync("cw1");
    expect([...b.obras].sort((x, y) => x.sortOrder - y.sortOrder).map((o) => o.title)).toEqual(["Del editor", "Primera", "Segunda"]);
  });

  it("una obra de otra muestra no existe", async () => {
    b.filas.push(fila({ activityId: "a2" }));
    expect(await sync()).toEqual({ cambio: "SIN_CAMBIO" });
  });
});
