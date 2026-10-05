import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Permiso de los autores, con una base en memoria: qué se escribe, qué correos salen y qué hace
 * cada respuesta del autor. El correo es un doble (`send`).
 */
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/communications/send-and-log", () => ({ sendAndLogEmail: vi.fn() }));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: vi.fn() }));

const { hashConsentToken } = await import("./consent-token");
const { ContestNotLinkedError } = await import("./links");
const { ConsentSetupError, loadConsentView, readContestRights, requestConsents, respondConsent } = await import("./consent");

const WS = "ws1";
const OTRO_WS = "ws2";
const CONCURSO = "c1";
const AHORA = new Date("2026-10-05T15:00:00Z");
const HORA = 60 * 60 * 1000;

type Consent = {
  id: string;
  workspaceId: string;
  contestId: string;
  entryId: string;
  authorUserId: number;
  basis: string;
  status: string;
  tokenHash: string;
  tokenExpiresAt: Date;
  notifiedAt: Date | null;
  respondedAt: Date | null;
};
type Listing = { workspaceId: string; entryId: string; previewUrl: string; status: string; withdrawnAt: Date | null };
type Entry = {
  id: string;
  contestId: string;
  status: string;
  withdrawnAt: Date | null;
  authorUserId: number | null;
  title: string | null;
  entryNumber: string | null;
};

function cumple(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return (v as Record<string, unknown>[]).some((w) => cumple(row, w));
    const actual = row[k];
    if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      const op = v as { in?: unknown[]; not?: unknown; lte?: Date };
      if (op.in) return op.in.includes(actual);
      if ("not" in op) return actual !== op.not;
      if (op.lte) return actual instanceof Date && actual.getTime() <= op.lte.getTime();
    }
    if (v instanceof Date) return actual instanceof Date && actual.getTime() === v.getTime();
    return actual === v;
  });
}

function baseFalsa(
  opts: {
    entries?: Entry[];
    consents?: Consent[];
    listings?: Listing[];
    rights?: unknown;
    vinculado?: boolean;
    slug?: string | null;
    dominio?: { domain: string; status: string } | null;
    royaltyBps?: number;
  } = {},
) {
  const entries: Entry[] = opts.entries ?? [
    { id: "e1", contestId: CONCURSO, status: "CONFIRMED", withdrawnAt: null, authorUserId: 10, title: "Río quieto", entryNumber: "SFE-1" },
    { id: "e2", contestId: CONCURSO, status: "CONFIRMED", withdrawnAt: null, authorUserId: 11, title: null, entryNumber: "SFE-2" },
  ];
  const consents: Consent[] = opts.consents ?? [];
  const listings: Listing[] = opts.listings ?? [];
  const usuarios = [
    { id: 10, email: "ana@x.test", name: "Ana" },
    { id: 11, email: "beto@x.test", name: null },
    { id: 12, email: "", name: "Sin mail" },
  ];
  let n = 0;
  const db = {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
    fotorankContest: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === CONCURSO ? { organizationId: "org1", title: "Salón 2026" } : null,
      ),
    },
    workspaceContestOrganizationLink: {
      findFirst: vi.fn(async ({ where }: { where: { workspaceId: string } }) =>
        opts.vinculado === false || where.workspaceId !== WS ? null : { id: "l1" },
      ),
    },
    fotorankContestRulesVersion: {
      findFirst: vi.fn(async () =>
        opts.rights === undefined ? null : { configurationVersion: { configurationJson: { rights: opts.rights } } },
      ),
    },
    fotorankContestEntry: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] }; contestId: string } }) =>
        entries.filter((e) => where.id.in.includes(e.id) && e.contestId === where.contestId),
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => entries.find((e) => e.id === where.id) ?? null),
    },
    user: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: number[] } } }) => usuarios.filter((u) => where.id.in.includes(u.id))),
    },
    artworkConsent: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => consents.filter((c) => cumple(c, where))),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => consents.find((c) => cumple(c, where)) ?? null),
      createMany: vi.fn(async ({ data }: { data: Omit<Consent, "id" | "respondedAt">[] }) => {
        let count = 0;
        for (const d of data) {
          if (consents.some((c) => c.workspaceId === d.workspaceId && c.entryId === d.entryId)) continue;
          consents.push({ ...d, id: `k${++n}`, respondedAt: null });
          count++;
        }
        return { count };
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Consent> }) => {
        const filas = consents.filter((c) => cumple(c, where));
        for (const f of filas) Object.assign(f, data);
        return { count: filas.length };
      }),
    },
    artworkListing: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => listings.filter((l) => cumple(l, where))),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => listings.find((l) => cumple(l, where)) ?? null),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Listing> }) => {
        const filas = listings.filter((l) => cumple(l, where));
        for (const f of filas) Object.assign(f, data);
        return { count: filas.length };
      }),
    },
    contestStoreSettings: {
      findUnique: vi.fn(async () => (opts.royaltyBps === undefined ? null : { royaltyBps: opts.royaltyBps })),
    },
    printFormat: {
      findMany: vi.fn(async () => [{ name: "Impresión mate", widthCm: 30, heightCm: 45, priceArs: "25000.00" }]),
    },
    workspace: {
      findUnique: vi.fn(async () => ({
        name: "FCSF",
        fotofficeBranding: opts.slug === null ? null : { publicSlug: opts.slug ?? "fcsf", commercialName: "Foto Club Santa Fe" },
      })),
    },
    fotofficeWorkspaceDomain: { findUnique: vi.fn(async () => opts.dominio ?? null) },
  };
  return { db, consents, listings };
}

let tokens: string[];
function random(nBytes: number): Buffer {
  const b = Buffer.alloc(nBytes, tokens.length + 1);
  tokens.push(b.toString("base64url"));
  return b;
}

const sentOk = () => vi.fn(async () => ({ status: "SENT" as const, providerId: "re_1" }));

beforeEach(() => {
  tokens = [];
});

function deps(db: unknown, send: unknown = sentOk(), now = AHORA) {
  return { db: db as never, send: send as never, now, appOrigin: "https://fo.test", random };
}

describe("bases del concurso", () => {
  it("lee rights de la configuración de las bases publicadas", async () => {
    const { db } = baseFalsa({ rights: { allowPrint: true, allowCommercial: true } });
    expect(await readContestRights(CONCURSO, db as never)).toEqual({ allowPrint: true, allowCommercial: true });
    expect(db.fotorankContestRulesVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { contestId: CONCURSO, status: "PUBLISHED" }, orderBy: { versionNumber: "desc" } }),
    );
  });
  it("sin bases publicadas o con rights malformado → null", async () => {
    expect(await readContestRights(CONCURSO, baseFalsa().db as never)).toBeNull();
    expect(await readContestRights(CONCURSO, baseFalsa({ rights: { allowPrint: "si" } }).db as never)).toBeNull();
  });
});

describe("requestConsents", () => {
  it("bases que permiten imprimir y vender → RULES/NOTIFIED y correo de aviso", async () => {
    const { db, consents } = baseFalsa({ rights: { allowPrint: true, allowCommercial: true } });
    const send = sentOk();
    const r = await requestConsents(WS, CONCURSO, ["e1"], 1, deps(db, send));
    expect(r).toEqual({ notified: 1, requested: 0, skipped: [] });
    expect(consents).toHaveLength(1);
    expect(consents[0]).toMatchObject({ workspaceId: WS, entryId: "e1", authorUserId: 10, basis: "RULES", status: "NOTIFIED" });
    expect(consents[0]!.tokenHash).toBe(hashConsentToken(tokens[0]!));
    expect(consents[0]!.tokenExpiresAt.getTime() - AHORA.getTime()).toBe(60 * 24 * HORA);
    expect(send).toHaveBeenCalledTimes(1);
    const arg = (send.mock.calls[0] as unknown as [{ to: string; templateKey: string; body: { text: string } }])[0];
    expect(arg.to).toBe("ana@x.test");
    expect(arg.templateKey).toBe("store.artwork_consent_rules");
    expect(arg.body.text).toContain(`https://fo.test/w/fcsf/obras/permiso/${tokens[0]}`);
    expect(arg.body.text).toContain("20 %");
  });

  it("bases que no lo prevén (o sin bases) → EXPLICIT/PENDING y pedido de permiso", async () => {
    const { db, consents } = baseFalsa({ rights: { allowPrint: true, allowCommercial: false }, royaltyBps: 1500 });
    const send = sentOk();
    const r = await requestConsents(WS, CONCURSO, ["e1", "e2"], 1, deps(db, send));
    expect(r).toEqual({ notified: 0, requested: 2, skipped: [] });
    expect(consents.map((c) => [c.basis, c.status])).toEqual([
      ["EXPLICIT", "PENDING"],
      ["EXPLICIT", "PENDING"],
    ]);
    const arg = (send.mock.calls[1] as unknown as [{ templateKey: string; body: { text: string; subject: string } }])[0];
    expect(arg.templateKey).toBe("store.artwork_consent_request");
    expect(arg.body.subject).toContain("«Obra SFE-2»");
    expect(arg.body.text).toContain("15 %");
  });

  it("usa el dominio propio conectado y la vista previa ya guardada", async () => {
    const { db } = baseFalsa({
      dominio: { domain: "fcsf.com.ar", status: "CONNECTED" },
      listings: [{ workspaceId: WS, entryId: "e1", previewUrl: "https://cdn.test/p.jpg", status: "DRAFT", withdrawnAt: null }],
    });
    const send = sentOk();
    await requestConsents(WS, CONCURSO, ["e1"], 1, deps(db, send));
    const arg = (send.mock.calls[0] as unknown as [{ body: { text: string; html: string } }])[0];
    expect(arg.body.text).toContain(`https://fcsf.com.ar/obras/permiso/${tokens[0]}`);
    expect(arg.body.html).toContain(`<img src="https://cdn.test/p.jpg"`);
  });

  it("no respeta lo no elegible: otro concurso, no confirmada, retirada, sin autor o sin email", async () => {
    const { db, consents } = baseFalsa({
      entries: [
        { id: "a", contestId: "otro", status: "CONFIRMED", withdrawnAt: null, authorUserId: 10, title: "x", entryNumber: null },
        { id: "b", contestId: CONCURSO, status: "REJECTED", withdrawnAt: null, authorUserId: 10, title: "x", entryNumber: null },
        { id: "c", contestId: CONCURSO, status: "CONFIRMED", withdrawnAt: AHORA, authorUserId: 10, title: "x", entryNumber: null },
        { id: "d", contestId: CONCURSO, status: "CONFIRMED", withdrawnAt: null, authorUserId: null, title: "x", entryNumber: null },
        { id: "e", contestId: CONCURSO, status: "CONFIRMED", withdrawnAt: null, authorUserId: 12, title: "x", entryNumber: null },
      ],
    });
    const send = sentOk();
    const r = await requestConsents(WS, CONCURSO, ["a", "b", "c", "d", "e"], 1, deps(db, send));
    expect(r.skipped).toEqual([
      { entryId: "a", reason: "NOT_IN_CONTEST" },
      { entryId: "b", reason: "NOT_ELIGIBLE" },
      { entryId: "c", reason: "NOT_ELIGIBLE" },
      { entryId: "d", reason: "NO_AUTHOR_EMAIL" },
      { entryId: "e", reason: "NO_AUTHOR_EMAIL" },
    ]);
    expect(consents).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("lo que el autor rechazó o retiró no se vuelve a preguntar", async () => {
    const viejo = (entryId: string, status: string): Consent => ({
      id: `k-${entryId}`,
      workspaceId: WS,
      contestId: CONCURSO,
      entryId,
      authorUserId: 10,
      basis: "EXPLICIT",
      status,
      tokenHash: `h-${entryId}`,
      tokenExpiresAt: new Date(AHORA.getTime() + HORA),
      notifiedAt: new Date(AHORA.getTime() - 30 * 24 * HORA),
      respondedAt: AHORA,
    });
    const { db, consents } = baseFalsa({ consents: [viejo("e1", "DECLINED"), viejo("e2", "WITHDRAWN")] });
    const send = sentOk();
    const r = await requestConsents(WS, CONCURSO, ["e1", "e2"], 1, deps(db, send));
    expect(r.skipped).toEqual([
      { entryId: "e1", reason: "AUTHOR_DECLINED" },
      { entryId: "e2", reason: "AUTHOR_WITHDREW" },
    ]);
    expect(consents.map((c) => [c.status, c.tokenHash])).toEqual([
      ["DECLINED", "h-e1"],
      ["WITHDRAWN", "h-e2"],
    ]);
    expect(send).not.toHaveBeenCalled();
  });

  it("reenviar: token nuevo que invalida el viejo, y como mucho una vez cada 24 h", async () => {
    const { db, consents } = baseFalsa();
    await requestConsents(WS, CONCURSO, ["e1"], 1, deps(db));
    const viejo = tokens[0]!;

    const pronto = await requestConsents(WS, CONCURSO, ["e1"], 1, deps(db, sentOk(), new Date(AHORA.getTime() + 23 * HORA)));
    expect(pronto.skipped).toEqual([{ entryId: "e1", reason: "RECENTLY_SENT" }]);
    expect(consents[0]!.tokenHash).toBe(hashConsentToken(viejo));

    const luego = new Date(AHORA.getTime() + 25 * HORA);
    const send = sentOk();
    const r = await requestConsents(WS, CONCURSO, ["e1"], 1, deps(db, send, luego));
    expect(r.requested).toBe(1);
    const nuevo = tokens.at(-1)!;
    expect(nuevo).not.toBe(viejo);
    expect(consents).toHaveLength(1);
    expect(consents[0]).toMatchObject({ status: "PENDING", tokenHash: hashConsentToken(nuevo), notifiedAt: luego });

    // El enlace viejo ya no abre; el nuevo sí.
    expect(await loadConsentView(WS, viejo, { db: db as never, now: luego })).toBeNull();
    expect(await loadConsentView(WS, nuevo, { db: db as never, now: luego })).not.toBeNull();
  });

  it("si el correo no sale, se informa y se puede reintentar sin esperar", async () => {
    const { db, consents } = baseFalsa();
    const falla = vi.fn(async () => ({ status: "PROVIDER_REJECTED" as const, detail: "caído" }));
    const r = await requestConsents(WS, CONCURSO, ["e1"], 1, deps(db, falla));
    expect(r.skipped).toEqual([{ entryId: "e1", reason: "EMAIL_FAILED" }]);
    expect(consents[0]!.notifiedAt).toBeNull();
    const otra = await requestConsents(WS, CONCURSO, ["e1"], 1, deps(db, sentOk(), new Date(AHORA.getTime() + 60_000)));
    expect(otra.requested).toBe(1);
  });

  it("ya aceptado: no se vuelve a pedir", async () => {
    const { db } = baseFalsa({
      consents: [
        {
          id: "k1", workspaceId: WS, contestId: CONCURSO, entryId: "e1", authorUserId: 10, basis: "EXPLICIT", status: "GRANTED",
          tokenHash: "h", tokenExpiresAt: AHORA, notifiedAt: null, respondedAt: AHORA,
        },
      ],
    });
    const r = await requestConsents(WS, CONCURSO, ["e1"], 1, deps(db));
    expect(r.skipped).toEqual([{ entryId: "e1", reason: "ALREADY_GRANTED" }]);
  });

  it("concurso no vinculado → error, sin escribir", async () => {
    const { db, consents } = baseFalsa({ vinculado: false });
    await expect(requestConsents(WS, CONCURSO, ["e1"], 1, deps(db))).rejects.toBeInstanceOf(ContestNotLinkedError);
    expect(consents).toHaveLength(0);
  });

  it("sin dirección pública → error antes de escribir", async () => {
    const { db, consents } = baseFalsa({ slug: null });
    await expect(requestConsents(WS, CONCURSO, ["e1"], 1, deps(db))).rejects.toBeInstanceOf(ConsentSetupError);
    expect(consents).toHaveLength(0);
  });
});

describe("respondConsent y la página del autor", () => {
  async function conPermiso(rights?: unknown, listing = true) {
    const base = baseFalsa({
      rights,
      listings: listing
        ? [{ workspaceId: WS, entryId: "e1", previewUrl: "https://cdn.test/p.jpg", status: "PUBLISHED", withdrawnAt: null }]
        : [],
    });
    await requestConsents(WS, CONCURSO, ["e1"], 1, deps(base.db));
    return { ...base, token: tokens.at(-1)! };
  }
  const opts = (db: unknown, now = AHORA) => ({ db: db as never, now });
  const RULES = { allowPrint: true, allowCommercial: true };

  it("la página muestra lo que el autor puede hacer según la base", async () => {
    const reglas = await conPermiso(RULES);
    const v = await loadConsentView(WS, reglas.token, opts(reglas.db));
    expect(v).toMatchObject({
      basis: "RULES",
      status: "NOTIFIED",
      actions: ["withdraw"],
      institution: "Foto Club Santa Fe",
      contestTitle: "Salón 2026",
      artworkTitle: "Río quieto",
      storedPreviewUrl: "https://cdn.test/p.jpg",
      royaltyBps: 2000,
      contestLinked: true,
    });
    const explicito = await conPermiso();
    expect((await loadConsentView(WS, explicito.token, opts(explicito.db)))?.actions).toEqual(["accept", "decline"]);
  });

  it("RULES: retirar despublica la obra; el enlace sigue abriendo", async () => {
    const { db, consents, listings, token } = await conPermiso(RULES);
    const r = await respondConsent(WS, token, "withdraw", opts(db));
    expect(r).toEqual({ ok: true, status: "WITHDRAWN", listingWithdrawn: true });
    expect(consents[0]).toMatchObject({ status: "WITHDRAWN", respondedAt: AHORA });
    expect(listings[0]).toMatchObject({ status: "WITHDRAWN", withdrawnAt: AHORA });
    const v = await loadConsentView(WS, token, opts(db));
    expect(v?.status).toBe("WITHDRAWN");
    expect(v?.actions).toEqual([]);
    expect(await respondConsent(WS, token, "withdraw", opts(db))).toEqual({ ok: false, reason: "NOT_ALLOWED" });
  });

  it("RULES: aceptar o no aceptar no corresponden", async () => {
    const { db, token } = await conPermiso(RULES);
    expect(await respondConsent(WS, token, "accept", opts(db))).toEqual({ ok: false, reason: "NOT_ALLOWED" });
    expect(await respondConsent(WS, token, "decline", opts(db))).toEqual({ ok: false, reason: "NOT_ALLOWED" });
  });

  it("EXPLICIT: aceptar no toca la obra; después puede retirarla con el mismo enlace", async () => {
    const { db, consents, listings, token } = await conPermiso();
    expect(await respondConsent(WS, token, "accept", opts(db))).toEqual({ ok: true, status: "GRANTED", listingWithdrawn: false });
    expect(listings[0]!.status).toBe("PUBLISHED");
    const despues = new Date(AHORA.getTime() + 10 * 24 * HORA);
    expect(await respondConsent(WS, token, "withdraw", opts(db, despues))).toEqual({
      ok: true,
      status: "WITHDRAWN",
      listingWithdrawn: true,
    });
    expect(consents[0]).toMatchObject({ status: "WITHDRAWN", respondedAt: despues });
  });

  it("EXPLICIT: no aceptar despublica (si estaba) y no falla si no hay obra", async () => {
    const con = await conPermiso();
    expect(await respondConsent(WS, con.token, "decline", opts(con.db))).toEqual({
      ok: true,
      status: "DECLINED",
      listingWithdrawn: true,
    });
    expect(con.listings[0]!.status).toBe("WITHDRAWN");
    const sin = await conPermiso(undefined, false);
    expect(await respondConsent(WS, sin.token, "decline", opts(sin.db))).toEqual({
      ok: true,
      status: "DECLINED",
      listingWithdrawn: false,
    });
  });

  it("token de otra institución, vencido, desconocido o acción rara → inválido, sin cambios", async () => {
    const { db, consents, token } = await conPermiso();
    expect(await loadConsentView(OTRO_WS, token, opts(db))).toBeNull();
    expect(await respondConsent(OTRO_WS, token, "decline", opts(db))).toEqual({ ok: false, reason: "INVALID_LINK" });
    const vencido = new Date(AHORA.getTime() + 60 * 24 * HORA);
    expect(await loadConsentView(WS, token, opts(db, vencido))).toBeNull();
    expect(await respondConsent(WS, token, "decline", opts(db, vencido))).toEqual({ ok: false, reason: "INVALID_LINK" });
    expect(await respondConsent(WS, "x".repeat(43), "decline", opts(db))).toEqual({ ok: false, reason: "INVALID_LINK" });
    expect(await respondConsent(WS, "corto", "decline", opts(db))).toEqual({ ok: false, reason: "INVALID_LINK" });
    expect(await respondConsent(WS, token, "borrar", opts(db))).toEqual({ ok: false, reason: "NOT_ALLOWED" });
    expect(consents[0]!.status).toBe("PENDING");
  });
});
