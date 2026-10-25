import { beforeEach, describe, expect, it, vi } from "vitest";
import { planContestImport } from "@repo/muestras";

vi.mock("server-only", () => ({}));

const { aplicarResultados, CorteDeArmado } = await import("./armar");
import type { ObraDelConcurso, ResultadosDelConcurso } from "./fotorank";

type Fila = {
  id: string; entryId: string; include: boolean; sourceStatus: string; tier: string; awardType: string | null;
  categoryId: string; categoryName: string; distinction: string; rank: number;
};

/** Una base en memoria con lo que toca `aplicarResultados`. */
function baseFalsa() {
  const obras: (Fila & Record<string, unknown>)[] = [];
  const autores: { userId: number | null; authorName: string; profileId?: string | null }[] = [];
  let enLaGaleria = 0;
  const tx = {
    culturalContestWork: {
      findMany: vi.fn(async () => obras.map((o) => ({ ...o }))),
      count: vi.fn(async () => obras.filter((o) => o.include && !o.activityWorkId && !["DECLINED", "WITHDRAWN"].includes(o.exhibitConsent as string)).length),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const fila = { id: `cw-${data.entryId}`, include: true, sourceStatus: "CURRENT", activityWorkId: null, ...data } as unknown as Fila & Record<string, unknown>;
        obras.push(fila);
        return { id: fila.id };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        Object.assign(obras.find((o) => o.id === where.id)!, data);
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { entryId: { in: string[] } }; data: Record<string, unknown> }) => {
        for (const o of obras) if (where.entryId.in.includes(o.entryId)) Object.assign(o, data);
        return { count: where.entryId.in.length };
      }),
    },
    culturalActivityWork: { count: vi.fn(async () => enLaGaleria) },
    culturalContestAuthor: {
      findMany: vi.fn(async () => autores.filter((x) => x.userId != null)),
      createMany: vi.fn(async ({ data }: { data: typeof autores }) => {
        autores.push(...data);
        return { count: data.length };
      }),
    },
    photographerProfile: { findMany: vi.fn(async () => [{ id: "p-ana", userId: 10 }]) },
    culturalContestImport: { update: vi.fn(async () => ({})) },
  };
  return { tx, obras, autores, setGaleria: (n: number) => (enLaGaleria = n) };
}

const obra = (entryId: string, o: Partial<ObraDelConcurso> = {}): ObraDelConcurso => ({
  entryId, authorUserId: 10, authorName: "Ana Pérez", title: `Obra ${entryId}`, tier: "WINNER", awardType: "FIRST_PLACE",
  categoryId: "cat-p", categoryName: "Paisaje", distinction: "1.er premio · Paisaje", rank: 0, exhibitBasis: "RULES", attributionRequired: false, ...o,
});

const resultados = (works: ObraDelConcurso[], batch = { id: "b1", version: new Date("2026-09-21") }): Extract<ResultadosDelConcurso, { ok: true }> => ({
  ok: true,
  contest: { id: "c1", title: "Paisajes 2026", slug: "paisajes-2026", shortDescription: null, organizationId: "org1", organizationName: "SFPR", visibility: "PUBLIC", status: "COMPLETED" },
  batch: { id: batch.id, status: "FINALIZED", version: batch.version, date: batch.version },
  categories: [{ id: "cat-p", name: "Paisaje", sortOrder: 0 }],
  works,
});

const AHORA = new Date("2026-10-10T12:00:00Z");
const correr = (b: ReturnType<typeof baseFalsa>, works: ObraDelConcurso[], tiers: ("WINNER" | "MENTION" | "FINALIST")[] = ["WINNER", "MENTION"], batch?: { id: string; version: Date }) =>
  aplicarResultados(b.tx as never, { activityId: "a1", importId: "i1", resultados: resultados(works, batch), tiers, ahora: AHORA });

let b: ReturnType<typeof baseFalsa>;
beforeEach(() => {
  b = baseFalsa();
});

describe("aplicarResultados", () => {
  it("crea las obras de los niveles elegidos, con la base de permiso de sus bases", async () => {
    const r = await correr(b, [
      obra("e1", { exhibitBasis: "RULES", attributionRequired: true }),
      obra("e2", { tier: "MENTION", awardType: "HONORABLE_MENTION", exhibitBasis: "EXPLICIT", authorUserId: 11, authorName: "Beto", rank: 1 }),
      obra("e3", { tier: "FINALIST", awardType: "FINALIST", rank: 2 }),
    ]);
    expect(r).toMatchObject({ creadas: 2, actualizadas: 0, gone: 0 });
    expect(b.obras.map((o) => [o.entryId, o.exhibitConsent, o.consentBy, o.attributionRequired])).toEqual([
      ["e1", "ACCEPTED", "RULES", true],
      ["e2", "PENDING", null, false],
    ]);
    expect(b.obras[0]).toMatchObject({ consentAt: AHORA, distinction: "1.er premio · Paisaje", importId: "i1", activityId: "a1" });
  });

  it("un autor por cuenta (con su perfil si tiene) y uno por obra sin cuenta", async () => {
    await correr(b, [
      obra("e1"), obra("e2", { rank: 1 }),
      obra("e4", { authorUserId: null, authorName: "Autor viejo", rank: 2 }),
      obra("e5", { authorUserId: null, authorName: "Otro viejo", rank: 3 }),
    ]);
    expect(b.autores).toEqual([
      expect.objectContaining({ userId: 10, authorName: "Ana Pérez", profileId: "p-ana" }),
      expect.objectContaining({ userId: null, authorName: "Autor viejo" }),
      expect.objectContaining({ userId: null, authorName: "Otro viejo" }),
    ]);
  });

  it("dos veces seguidas no duplica nada (la segunda no crea)", async () => {
    const works = [obra("e1"), obra("e2", { rank: 1, authorUserId: null })];
    await correr(b, works);
    const segunda = await correr(b, works);
    expect(segunda).toMatchObject({ creadas: 0, actualizadas: 0, gone: 0 });
    expect(b.obras).toHaveLength(2);
    expect(b.autores).toHaveLength(2);
  });

  it("una obra que quien organiza sacó no se vuelve a sumar", async () => {
    await correr(b, [obra("e1")]);
    b.obras[0]!.include = false;
    await correr(b, [obra("e1")]);
    expect(b.obras).toHaveLength(1);
    expect(b.obras[0]!.include).toBe(false);
  });

  it("actualiza premio y orden (nunca título ni permisos) y marca GONE la que salió, sin sacarla", async () => {
    await correr(b, [obra("e1"), obra("e2", { rank: 1 })]);
    b.obras[0]!.title = "Título de quien organiza";
    const r = await correr(b, [obra("e1", { tier: "MENTION", awardType: "SPECIAL_MENTION", distinction: "Mención especial · Paisaje", rank: 3, title: "Otro" })], undefined, { id: "b2", version: new Date("2026-10-01") });
    expect(r).toMatchObject({ creadas: 0, actualizadas: 1, gone: 1 });
    expect(b.obras[0]).toMatchObject({ title: "Título de quien organiza", distinction: "Mención especial · Paisaje", rank: 3, exhibitConsent: "ACCEPTED" });
    expect(b.obras[1]).toMatchObject({ entryId: "e2", sourceStatus: "GONE", include: true });
    expect(b.tx.culturalContestImport.update).toHaveBeenLastCalledWith({
      where: { id: "i1" },
      data: expect.objectContaining({ resultBatchId: "b2", sourceVersion: new Date("2026-10-01"), tiers: ["WINNER", "MENTION"], syncedAt: AHORA }),
    });
  });

  it("una que había salido y vuelve deja de estar GONE", async () => {
    await correr(b, [obra("e1")]);
    b.obras[0]!.sourceStatus = "GONE";
    await correr(b, [obra("e1")]);
    expect(b.obras[0]!.sourceStatus).toBe("CURRENT");
  });

  it("tope técnico de 300: cuenta la galería y las que van a entrar, y no crea nada", async () => {
    b.setGaleria(299);
    await expect(correr(b, [obra("e1"), obra("e2", { rank: 1 })])).rejects.toThrow(CorteDeArmado);
    await expect(correr(b, [obra("e1"), obra("e2", { rank: 1 })])).rejects.toThrow(
      "La muestra admite hasta 300 obras: ya tiene 299 y el concurso suma 2. Elegí menos niveles o sacá obras de la muestra.",
    );
    expect(b.obras).toHaveLength(0);
  });

  it("sin obras en los niveles elegidos", async () => {
    await expect(correr(b, [obra("e3", { tier: "FINALIST" })], ["WINNER"])).rejects.toThrow("El concurso no tiene obras en los niveles que elegiste.");
  });

  it("de punta a punta con la regla: lo que crea es lo que dice el plan", async () => {
    const works = [obra("e1"), obra("e3", { tier: "FINALIST", rank: 1 })];
    const plan = planContestImport({ selected: works, existing: new Map(), tiers: ["WINNER"], galleryCount: 0 });
    await correr(b, works, ["WINNER"]);
    expect(b.obras.map((o) => o.entryId)).toEqual(plan.create.map((w) => w.entryId));
  });
});
