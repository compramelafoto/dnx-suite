import { describe, expect, it, vi } from "vitest";

/**
 * Elegir y publicar obras, con una base en memoria. FotoRank (vista previa) y R2 son dobles.
 */
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/communications/send-and-log", () => ({ sendAndLogEmail: vi.fn() }));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: vi.fn() }));
vi.mock("@/lib/images/r2-client", () => ({ uploadToFotofficeR2: vi.fn() }));

const { ContestNotLinkedError } = await import("./links");
const { ArtworkPublishError, listStoreContests, loadContestCatalog, publishArtwork, saveContestRoyalty, unpublishArtwork } =
  await import("./catalog");

const WS = "ws1";
const C = "c1";
const AHORA = new Date("2026-10-05T15:00:00Z");

type Listing = {
  id: string;
  workspaceId: string;
  contestId: string;
  entryId: string;
  slug: string;
  title: string;
  authorDisplayName: string | null;
  awardLabel: string | null;
  previewUrl: string;
  previewWidth: number;
  previewHeight: number;
  originalWidth: number;
  originalHeight: number;
  status: string;
  publishedAt: Date | null;
  withdrawnAt: Date | null;
};
type Consent = { workspaceId: string; contestId: string; entryId: string; basis: string; status: string; notifiedAt: Date | null; authorUserId: number };
type Entry = {
  id: string;
  contestId: string;
  status: string;
  withdrawnAt: Date | null;
  title: string | null;
  entryNumber: string | null;
  authorUserId: number | null;
  activeAsset: { kind: string; width: number | null; height: number | null; sourceOriginal: null } | null;
  rights?: unknown;
};

function cumple(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => {
    const actual = row[k];
    if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      const op = v as { in?: unknown[]; not?: unknown };
      if (op.in) return op.in.includes(actual);
      if ("not" in op) return actual !== op.not;
    }
    return actual === v;
  });
}

function entrada(id: string, over: Partial<Entry> = {}): Entry {
  return {
    id,
    contestId: C,
    status: "CONFIRMED",
    withdrawnAt: null,
    title: `Obra ${id}`,
    entryNumber: id.toUpperCase(),
    authorUserId: 10,
    activeAsset: { kind: "ORIGINAL", width: 6000, height: 4000, sourceOriginal: null },
    rights: { allowPrint: true, allowCommercial: true, attributionRequired: true },
    ...over,
  };
}

function baseFalsa(
  opts: {
    entries?: Entry[];
    consents?: Consent[];
    listings?: Listing[];
    vinculado?: boolean;
    contestStatus?: string;
    formats?: { widthCm: number; heightCm: number }[];
    minDpi?: number;
    results?: { entryId: string; resultStatus: string; awardType: string | null; batchStatus: string }[];
    royaltyBps?: number;
    /** Hace que el próximo `create` choque con P2002 (otra pestaña tomó la dirección). */
    chocarUnaVez?: boolean;
  } = {},
) {
  const entries = opts.entries ?? [entrada("e1"), entrada("e2"), entrada("e3", { status: "REJECTED" })];
  const consents: Consent[] = opts.consents ?? [];
  const listings: Listing[] = opts.listings ?? [];
  const settings: { workspaceId: string; contestId: string; royaltyBps: number }[] =
    opts.royaltyBps === undefined ? [] : [{ workspaceId: WS, contestId: C, royaltyBps: opts.royaltyBps }];
  const results = opts.results ?? [];
  let chocar = opts.chocarUnaVez ?? false;
  /** Orden de lo que se hace dentro de la transacción de publicar. */
  const orden: string[] = [];
  const contest = { id: C, title: "Salón 2026", status: opts.contestStatus ?? "COMPLETED", organizationId: "org1", organization: { name: "FCSF" } };
  const db = {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => {
      orden.push("BEGIN");
      try {
        return await fn(db);
      } finally {
        orden.push("END");
      }
    }),
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      orden.push(sql.includes("FOR UPDATE") ? "LOCK consent" : "SQL");
      const [ws, entryId] = values;
      return consents
        .filter((c) => c.workspaceId === ws && c.entryId === entryId)
        .map((c) => ({ basis: c.basis, status: c.status, notifiedAt: c.notifiedAt }));
    }),
    fotorankContest: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === C ? contest : null)),
      findMany: vi.fn(async ({ where }: { where: { organizationId: { in: string[] }; status: { in: string[] } } }) =>
        [
          contest,
          { ...contest, id: "c2", title: "En inscripción", status: "REGISTRATION_OPEN" },
          { ...contest, id: "c3", title: "De otra org", organizationId: "org9" },
        ].filter((c) => where.organizationId.in.includes(c.organizationId) && where.status.in.includes(c.status)),
      ),
    },
    workspaceContestOrganizationLink: {
      findFirst: vi.fn(async ({ where }: { where: { workspaceId: string; organizationId: string } }) =>
        opts.vinculado === false || where.workspaceId !== WS || where.organizationId !== "org1" ? null : { id: "l1" },
      ),
      findMany: vi.fn(async ({ where }: { where: { workspaceId: string } }) =>
        opts.vinculado === false || where.workspaceId !== WS ? [] : [{ organizationId: "org1" }],
      ),
    },
    fotorankContestEntry: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => entries.filter((e) => cumple(e, where))),
      findFirst: vi.fn(async ({ where }: { where: { id: string; contestId: string } }) => {
        const e = entries.find((x) => x.id === where.id && x.contestId === where.contestId);
        if (!e) return null;
        return {
          ...e,
          registration: e.rights === undefined ? null : { rulesVersion: { configurationVersion: { configurationJson: { rights: e.rights } } } },
        };
      }),
    },
    fotorankResultEntry: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: {
            resultStatus: { in: string[] };
            resultBatch: { contestId: string; status: { in: string[] } };
            juryEntrySnapshot?: { entryId: { in: string[] } };
          };
        }) =>
          results
            .filter(
              (r) =>
                where.resultStatus.in.includes(r.resultStatus) &&
                where.resultBatch.status.in.includes(r.batchStatus) &&
                (!where.juryEntrySnapshot || where.juryEntrySnapshot.entryId.in.includes(r.entryId)),
            )
            .map((r) => ({ resultStatus: r.resultStatus, awardType: r.awardType, juryEntrySnapshot: { entryId: r.entryId } })),
      ),
    },
    fotorankProfile: {
      findMany: vi.fn(async () => [{ userId: 10, displayName: "Ana P." }]),
    },
    user: {
      findMany: vi.fn(async () => [
        { id: 10, name: "Ana Pérez" },
        { id: 11, name: "Beto" },
      ]),
    },
    artworkConsent: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => consents.filter((c) => cumple(c, where))),
      findUnique: vi.fn(
        async ({ where }: { where: { workspaceId_entryId: { workspaceId: string; entryId: string } } }) =>
          consents.find((c) => c.workspaceId === where.workspaceId_entryId.workspaceId && c.entryId === where.workspaceId_entryId.entryId) ??
          null,
      ),
    },
    artworkListing: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => listings.filter((l) => cumple(l, where))),
      findUnique: vi.fn(
        async ({ where }: { where: { workspaceId_entryId: { workspaceId: string; entryId: string } } }) =>
          listings.find((l) => l.workspaceId === where.workspaceId_entryId.workspaceId && l.entryId === where.workspaceId_entryId.entryId) ??
          null,
      ),
      groupBy: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const cuenta = new Map<string, number>();
        for (const l of listings.filter((x) => cumple(x, where))) cuenta.set(l.contestId, (cuenta.get(l.contestId) ?? 0) + 1);
        return [...cuenta].map(([contestId, n]) => ({ contestId, _count: { _all: n } }));
      }),
      create: vi.fn(async ({ data }: { data: Listing }) => {
        orden.push("create listing");
        if (chocar) {
          chocar = false;
          listings.push({ ...data, id: "otra", entryId: "otra-obra" });
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        if (listings.some((l) => l.workspaceId === data.workspaceId && (l.slug === data.slug || l.entryId === data.entryId))) {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        listings.push({ ...data });
        return data;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Listing> }) => {
        orden.push("update listing");
        const filas = listings.filter((l) => cumple(l, where));
        for (const f of filas) Object.assign(f, data);
        return { count: filas.length };
      }),
    },
    contestStoreSettings: {
      findUnique: vi.fn(async () => settings.find((s) => s.workspaceId === WS && s.contestId === C) ?? null),
      upsert: vi.fn(
        async ({ where, create, update }: { where: { workspaceId_contestId: { workspaceId: string; contestId: string } }; create: { workspaceId: string; contestId: string; royaltyBps: number }; update: { royaltyBps: number } }) => {
          const s = settings.find(
            (x) => x.workspaceId === where.workspaceId_contestId.workspaceId && x.contestId === where.workspaceId_contestId.contestId,
          );
          if (s) Object.assign(s, update);
          else settings.push({ ...create });
        },
      ),
    },
    printFormat: {
      findMany: vi.fn(async () => opts.formats ?? [{ widthCm: 30, heightCm: 45 }]),
    },
    storePrintSettings: {
      findUnique: vi.fn(async () => (opts.minDpi === undefined ? null : { minDpi: opts.minDpi })),
    },
    workspace: {
      findUnique: vi.fn(async () => ({ name: "fcsf", fotofficeBranding: { commercialName: "Foto Club Santa Fe" } })),
    },
  };
  return { db, consents, listings, settings, orden };
}

const avisado = (entryId: string, over: Partial<Consent> = {}): Consent => ({
  workspaceId: WS,
  contestId: C,
  entryId,
  basis: "RULES",
  status: "NOTIFIED",
  notifiedAt: AHORA,
  authorUserId: 10,
  ...over,
});

function publishDeps(db: unknown) {
  const fetchPreview = vi.fn(async () => Buffer.from("jpeg"));
  const storePreview = vi.fn(async (_ws: string, listingId: string) => ({
    url: `https://cdn.test/${listingId}.jpg`,
    width: 1600,
    height: 1067,
  }));
  let n = 0;
  return {
    deps: { db: db as never, now: AHORA, fetchPreview, storePreview, newId: () => `L${++n}` },
    fetchPreview,
    storePreview,
  };
}

describe("listStoreContests", () => {
  it("sólo concursos de organizaciones vinculadas y en estados que se muestran", async () => {
    const { db } = baseFalsa({
      listings: [
        { ...({} as Listing), workspaceId: WS, contestId: C, entryId: "e1", status: "PUBLISHED" },
        { ...({} as Listing), workspaceId: WS, contestId: C, entryId: "e2", status: "WITHDRAWN" },
      ],
    });
    const r = await listStoreContests(WS, db as never);
    expect(r).toEqual([{ id: C, title: "Salón 2026", status: "COMPLETED", organizationName: "FCSF", publishedCount: 1 }]);
    const arg = db.fotorankContest.findMany.mock.calls[0]![0];
    expect(arg.where.status.in.sort()).toEqual(["ARCHIVED", "CLOSED", "COMPLETED", "FINALISTS", "JUDGING"]);
  });
  it("sin organizaciones vinculadas → nada, sin consultar concursos", async () => {
    const { db } = baseFalsa({ vinculado: false });
    expect(await listStoreContests(WS, db as never)).toEqual([]);
    expect(db.fotorankContest.findMany).not.toHaveBeenCalled();
  });
});

describe("loadContestCatalog", () => {
  const firmar = (id: string, wm: string) => `https://fr.test/${id}?wm=${encodeURIComponent(wm)}`;

  it("obras confirmadas con premio, permiso, publicación y miniatura", async () => {
    const { db } = baseFalsa({
      consents: [avisado("e1"), avisado("e2", { basis: "EXPLICIT", status: "PENDING", notifiedAt: null })],
      listings: [
        { ...({} as Listing), workspaceId: WS, contestId: C, entryId: "e1", status: "PUBLISHED", previewUrl: "https://cdn.test/e1.jpg" },
      ],
      results: [
        { entryId: "e1", resultStatus: "WINNER", awardType: "FIRST_PLACE", batchStatus: "PUBLISHED" },
        { entryId: "e2", resultStatus: "FINALIST", awardType: null, batchStatus: "DRAFT" },
      ],
      royaltyBps: 1500,
    });
    const r = await loadContestCatalog(WS, C, { filter: "todas", page: 1 }, { db: db as never, signPreview: firmar });
    expect(r?.royaltyBps).toBe(1500);
    expect(r?.total).toBe(2);
    expect(r?.rows).toEqual([
      expect.objectContaining({
        entryId: "e1",
        title: "Obra e1",
        authorName: "Ana P.",
        award: { kind: "WINNER", label: "Primer premio" },
        original: { width: 6000, height: 4000 },
        consentLabel: "Avisado",
        sellable: true,
        listingLabel: "Publicada",
        thumbnailUrl: "https://cdn.test/e1.jpg",
      }),
      expect.objectContaining({
        entryId: "e2",
        award: null, // el lote de resultados está en borrador
        consentLabel: "Correo sin enviar",
        canResend: true,
        sellable: false,
        listingLabel: "Sin publicar",
        thumbnailUrl: `https://fr.test/e2?wm=${encodeURIComponent("Muestra · Foto Club Santa Fe")}`,
      }),
    ]);
  });

  it("filtros premiadas / finalistas y sin secreto no hay miniatura", async () => {
    const { db } = baseFalsa({
      results: [
        { entryId: "e1", resultStatus: "MENTION", awardType: null, batchStatus: "FINALIZED" },
        { entryId: "e2", resultStatus: "FINALIST", awardType: null, batchStatus: "PUBLISHED" },
      ],
    });
    const sinSecreto = () => {
      throw new Error("ARTWORKS_NOT_CONFIGURED");
    };
    const premiadas = await loadContestCatalog(WS, C, { filter: "premiadas", page: 1 }, { db: db as never, signPreview: sinSecreto });
    expect(premiadas?.rows.map((r) => r.entryId)).toEqual(["e1"]);
    expect(premiadas?.rows[0]!.thumbnailUrl).toBeNull();
    const finalistas = await loadContestCatalog(WS, C, { filter: "finalistas", page: 1 }, { db: db as never, signPreview: firmar });
    expect(finalistas?.rows.map((r) => r.entryId)).toEqual(["e2"]);
  });

  it("de a 50 por página", async () => {
    const entries = Array.from({ length: 120 }, (_, i) => entrada(`e${String(i).padStart(3, "0")}`));
    const { db } = baseFalsa({ entries });
    const p3 = await loadContestCatalog(WS, C, { filter: "todas", page: 3 }, { db: db as never, signPreview: firmar });
    expect(p3).toMatchObject({ page: 3, totalPages: 3, total: 120 });
    expect(p3?.rows).toHaveLength(20);
    const fuera = await loadContestCatalog(WS, C, { filter: "todas", page: 99 }, { db: db as never, signPreview: firmar });
    expect(fuera?.page).toBe(3);
  });

  it("publicadas cuya obra ya no está en el concurso: aparte, para despublicar", async () => {
    const pub = (entryId: string, title: string, status = "PUBLISHED") =>
      ({ ...({} as Listing), workspaceId: WS, contestId: C, entryId, status, title, previewUrl: `https://cdn.test/${entryId}.jpg` }) as Listing;
    const { db } = baseFalsa({
      entries: [
        entrada("e1"),
        entrada("e3", { status: "REJECTED" }),
        entrada("e4", { status: "WITHDRAWN", withdrawnAt: AHORA }),
        entrada("e5", { withdrawnAt: AHORA }),
        entrada("e6", { status: "REJECTED" }),
      ],
      listings: [
        pub("e1", "Confirmada"),
        pub("e3", "Rechazada"),
        pub("e4", "Bajada por el autor"),
        pub("e5", "Confirmada pero retirada"),
        // Ya despublicada: no hace falta hacer nada.
        pub("e6", "Ya despublicada", "WITHDRAWN"),
      ],
    });
    const r = await loadContestCatalog(WS, C, { filter: "todas", page: 1 }, { db: db as never, signPreview: firmar });
    expect(r?.rows.map((x) => x.entryId)).toEqual(["e1"]);
    expect(r?.orphans).toEqual([
      { entryId: "e4", title: "Bajada por el autor", reason: "Retirada del concurso" },
      { entryId: "e5", title: "Confirmada pero retirada", reason: "Retirada del concurso" },
      { entryId: "e3", title: "Rechazada", reason: "Rechazada en el concurso" },
    ]);
  });

  it("sin publicadas fuera del concurso, orphans vacío y sin consulta extra", async () => {
    const { db } = baseFalsa({});
    const r = await loadContestCatalog(WS, C, { filter: "todas", page: 1 }, { db: db as never, signPreview: firmar });
    expect(r?.orphans).toEqual([]);
    expect(db.fotorankContestEntry.findMany).toHaveBeenCalledTimes(1);
  });

  it("concurso no vinculado o en un estado que no se muestra → null", async () => {
    expect(await loadContestCatalog(WS, C, { filter: "todas", page: 1 }, { db: baseFalsa({ vinculado: false }).db as never })).toBeNull();
    expect(
      await loadContestCatalog(WS, C, { filter: "todas", page: 1 }, { db: baseFalsa({ contestStatus: "REGISTRATION_OPEN" }).db as never }),
    ).toBeNull();
    expect(await loadContestCatalog("otro", C, { filter: "todas", page: 1 }, { db: baseFalsa().db as never })).toBeNull();
  });
});

describe("saveContestRoyalty", () => {
  it("guarda por workspace y concurso; exige vínculo y rango", async () => {
    const { db, settings } = baseFalsa();
    await saveContestRoyalty(WS, C, 1250, db as never);
    expect(settings).toEqual([{ workspaceId: WS, contestId: C, royaltyBps: 1250 }]);
    await saveContestRoyalty(WS, C, 3000, db as never);
    expect(settings).toEqual([{ workspaceId: WS, contestId: C, royaltyBps: 3000 }]);
    await expect(saveContestRoyalty(WS, C, 10001, db as never)).rejects.toThrow();
    await expect(saveContestRoyalty(WS, C, 2000, baseFalsa({ vinculado: false }).db as never)).rejects.toBeInstanceOf(
      ContestNotLinkedError,
    );
  });
});

describe("publishArtwork", () => {
  it("publica: vista previa con marca, ficha (O13), premio y dirección", async () => {
    const { db, listings } = baseFalsa({
      consents: [avisado("e1")],
      results: [{ entryId: "e1", resultStatus: "WINNER", awardType: "SECOND_PLACE", batchStatus: "PUBLISHED" }],
    });
    const { deps, fetchPreview, storePreview } = publishDeps(db);
    const r = await publishArtwork(WS, C, "e1", 1, deps);
    expect(r).toEqual({ listingId: "L1", slug: "obra-e1" });
    expect(fetchPreview).toHaveBeenCalledWith("e1", "Muestra · Foto Club Santa Fe");
    expect(storePreview).toHaveBeenCalledWith(WS, "L1", expect.any(Buffer));
    expect(listings).toEqual([
      expect.objectContaining({
        id: "L1",
        workspaceId: WS,
        contestId: C,
        entryId: "e1",
        slug: "obra-e1",
        title: "Obra e1",
        authorDisplayName: "Ana P.",
        awardLabel: "Segundo premio",
        previewUrl: "https://cdn.test/L1.jpg",
        previewWidth: 1600,
        previewHeight: 1067,
        originalWidth: 6000,
        originalHeight: 4000,
        status: "PUBLISHED",
        publishedAt: AHORA,
        withdrawnAt: null,
      }),
    ]);
  });

  it("sin atribución en las bases y aviso por bases → sin nombre; con permiso explícito → con nombre", async () => {
    const sinAtribucion = { allowPrint: true, allowCommercial: true, attributionRequired: false };
    const a = baseFalsa({ entries: [entrada("e1", { rights: sinAtribucion })], consents: [avisado("e1")] });
    await publishArtwork(WS, C, "e1", 1, publishDeps(a.db).deps);
    expect(a.listings[0]!.authorDisplayName).toBeNull();

    const b = baseFalsa({
      entries: [entrada("e1", { rights: null, authorUserId: 11 })],
      consents: [avisado("e1", { basis: "EXPLICIT", status: "GRANTED", authorUserId: 11 })],
    });
    await publishArtwork(WS, C, "e1", 1, publishDeps(b.db).deps);
    expect(b.listings[0]!.authorDisplayName).toBe("Beto"); // sin perfil de FotoRank → nombre de la cuenta
  });

  it("volver a publicar reutiliza la vista previa y la dirección", async () => {
    const { db, listings } = baseFalsa({
      consents: [avisado("e1")],
      listings: [
        {
          id: "L0", workspaceId: WS, contestId: C, entryId: "e1", slug: "rio", title: "viejo", authorDisplayName: null, awardLabel: null,
          previewUrl: "https://cdn.test/vieja.jpg", previewWidth: 1600, previewHeight: 1000, originalWidth: 1, originalHeight: 1,
          status: "WITHDRAWN", publishedAt: null, withdrawnAt: new Date(0),
        },
      ],
    });
    const { deps, fetchPreview } = publishDeps(db);
    expect(await publishArtwork(WS, C, "e1", 1, deps)).toEqual({ listingId: "L0", slug: "rio" });
    expect(fetchPreview).not.toHaveBeenCalled();
    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      status: "PUBLISHED",
      withdrawnAt: null,
      previewUrl: "https://cdn.test/vieja.jpg",
      title: "Obra e1",
      originalWidth: 6000,
    });
  });

  it("dirección única dentro del workspace, aun si otra pestaña la toma en el medio", async () => {
    const { db, listings } = baseFalsa({
      entries: [entrada("e1", { title: "Río" }), entrada("e2", { title: "Río" })],
      consents: [avisado("e1"), avisado("e2")],
      chocarUnaVez: true,
    });
    const { deps } = publishDeps(db);
    const r1 = await publishArtwork(WS, C, "e1", 1, deps);
    // El primer create chocó (otra pestaña tomó "rio"): se releyó y quedó "rio-2".
    expect(r1.slug).toBe("rio-2");
    const r2 = await publishArtwork(WS, C, "e2", 1, deps);
    expect(r2.slug).toBe("rio-3");
    expect(new Set(listings.map((l) => l.slug)).size).toBe(listings.length);
  });

  it("sin permiso vigente no publica (incluye correo de aviso que no salió)", async () => {
    for (const consents of [
      [],
      [avisado("e1", { notifiedAt: null })],
      [avisado("e1", { status: "WITHDRAWN" })],
      [avisado("e1", { basis: "EXPLICIT", status: "PENDING" })],
      [avisado("e1", { basis: "EXPLICIT", status: "DECLINED" })],
    ]) {
      const { db, listings } = baseFalsa({ consents });
      const { deps, fetchPreview } = publishDeps(db);
      await expect(publishArtwork(WS, C, "e1", 1, deps)).rejects.toMatchObject({ code: "NO_CONSENT" });
      expect(fetchPreview).not.toHaveBeenCalled();
      expect(listings).toHaveLength(0);
    }
  });

  it("ningún formato alcanza la resolución → error claro", async () => {
    const { db, listings } = baseFalsa({
      entries: [entrada("e1", { activeAsset: { kind: "ORIGINAL", width: 1200, height: 800, sourceOriginal: null } })],
      consents: [avisado("e1")],
      formats: [{ widthCm: 30, heightCm: 45 }],
      minDpi: 150,
    });
    const err = await publishArtwork(WS, C, "e1", 1, publishDeps(db).deps).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ArtworkPublishError);
    expect((err as Error).message).toBe("Ningún formato alcanza la resolución de esta obra.");
    expect(listings).toHaveLength(0);

    const sinFormatos = baseFalsa({ consents: [avisado("e1")], formats: [] });
    await expect(publishArtwork(WS, C, "e1", 1, publishDeps(sinFormatos.db).deps)).rejects.toMatchObject({ code: "NO_FORMATS" });
  });

  it("obra no confirmada, retirada, de otro concurso o sin original → error", async () => {
    const { db } = baseFalsa({
      entries: [
        entrada("e1", { status: "REJECTED" }),
        entrada("e2", { withdrawnAt: AHORA }),
        entrada("e4", { activeAsset: null }),
        entrada("e5", { contestId: "c9" }),
      ],
      consents: [avisado("e1"), avisado("e2"), avisado("e4"), avisado("e5")],
    });
    const { deps } = publishDeps(db);
    await expect(publishArtwork(WS, C, "e1", 1, deps)).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    await expect(publishArtwork(WS, C, "e2", 1, deps)).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    await expect(publishArtwork(WS, C, "e5", 1, deps)).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    await expect(publishArtwork(WS, C, "e4", 1, deps)).rejects.toMatchObject({ code: "NO_ORIGINAL" });
  });

  it("concurso no vinculado o no disponible → error sin traer nada", async () => {
    const a = baseFalsa({ vinculado: false, consents: [avisado("e1")] });
    const da = publishDeps(a.db);
    await expect(publishArtwork(WS, C, "e1", 1, da.deps)).rejects.toBeInstanceOf(ContestNotLinkedError);
    expect(da.fetchPreview).not.toHaveBeenCalled();
    const b = baseFalsa({ contestStatus: "REGISTRATION_OPEN", consents: [avisado("e1")] });
    await expect(publishArtwork(WS, C, "e1", 1, publishDeps(b.db).deps)).rejects.toMatchObject({ code: "CONTEST_NOT_AVAILABLE" });
  });

  it("si FotoRank no da la vista previa, no queda nada publicado", async () => {
    const { db, listings } = baseFalsa({ consents: [avisado("e1")] });
    const { deps } = publishDeps(db);
    deps.fetchPreview.mockRejectedValueOnce(new Error("FETCH_FAILED"));
    await expect(publishArtwork(WS, C, "e1", 1, deps)).rejects.toThrow("FETCH_FAILED");
    expect(listings).toHaveLength(0);
  });

  it("el permiso se bloquea y se vuelve a mirar ANTES de escribir la ficha, dentro de la transacción", async () => {
    const { db, orden } = baseFalsa({ consents: [avisado("e1")] });
    await publishArtwork(WS, C, "e1", 1, publishDeps(db).deps);
    expect(orden).toEqual(["BEGIN", "LOCK consent", "create listing", "END"]);
    const [strings, ...values] = db.$queryRaw.mock.calls[0]!;
    expect(strings.join("?")).toMatch(/FROM "ArtworkConsent"\s+WHERE "workspaceId" = \? AND "entryId" = \?\s+FOR UPDATE/);
    expect(values).toEqual([WS, "e1"]);

    // Volver a publicar: también con el bloqueo antes de actualizar.
    orden.length = 0;
    await publishArtwork(WS, C, "e1", 1, publishDeps(db).deps);
    expect(orden).toEqual(["BEGIN", "LOCK consent", "update listing", "END"]);
  });

  it("si el autor retiró mientras se subía la vista previa, no se publica nada", async () => {
    const { db, consents, listings, orden } = baseFalsa({ consents: [avisado("e1")] });
    const { deps } = publishDeps(db);
    deps.storePreview.mockImplementationOnce(async (_ws: string, listingId: string) => {
      consents[0]!.status = "WITHDRAWN"; // el autor retiró en el medio
      return { url: `https://cdn.test/${listingId}.jpg`, width: 1600, height: 1067 };
    });
    await expect(publishArtwork(WS, C, "e1", 1, deps)).rejects.toMatchObject({ code: "NO_CONSENT" });
    expect(listings).toHaveLength(0);
    expect(orden).toEqual(["BEGIN", "LOCK consent", "END"]);
  });
});

describe("unpublishArtwork", () => {
  it("pasa a WITHDRAWN sólo la obra publicada de este workspace", async () => {
    const fila = (workspaceId: string, status: string) =>
      ({ ...({} as Listing), workspaceId, contestId: C, entryId: "e1", status, withdrawnAt: null }) as Listing;
    const { db, listings } = baseFalsa({ listings: [fila(WS, "PUBLISHED"), fila("ws2", "PUBLISHED")] });
    expect(await unpublishArtwork(WS, C, "e1", { db: db as never, now: AHORA })).toEqual({ withdrawn: true });
    expect(listings.map((l) => l.status)).toEqual(["WITHDRAWN", "PUBLISHED"]);
    expect(listings[0]!.withdrawnAt).toEqual(AHORA);
    expect(await unpublishArtwork(WS, C, "e1", { db: db as never, now: AHORA })).toEqual({ withdrawn: false });
  });
});
