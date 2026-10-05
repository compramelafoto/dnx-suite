/**
 * Permiso de los autores para vender sus obras (spec O4, O5, O13; plan Task 6).
 *
 * - `requestConsents`: la institución avisa (bases que ya permiten imprimir y vender → RULES,
 *   queda NOTIFIED) o pide permiso (bases que no → EXPLICIT, queda PENDING). Un correo por obra
 *   con un enlace personal. Volver a llamarla con una obra ya avisada = reenviar: token nuevo
 *   (el viejo deja de abrir), como mucho una vez cada 24 h. Lo que el autor ya rechazó o retiró
 *   NO se vuelve a preguntar: se respeta y se informa.
 * - `loadConsentView` / `respondConsent`: la página pública del enlace, sin cuenta. Retirar o no
 *   aceptar despublica la obra en la misma transacción.
 *
 * Toda consulta lleva `workspaceId`: un token de otra institución no abre nada acá. Logs sin
 * datos personales (sólo ids y códigos).
 */
import "server-only";

import { prisma } from "@repo/db";

import { appUrl } from "@/lib/app-url";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { decimalArsToMinor } from "@/lib/membership/money";

import { applyAuthorAction, consentBasisFromRights, type AuthorAction, type ConsentBasis, type ConsentStatus } from "./consent-basis";
import { buildConsentUrl, renderArtworkConsentEmail } from "./consent-email";
import {
  canResendConsent,
  CONSENT_RESEND_COOLDOWN_MS,
  hashConsentToken,
  isConsentTokenExpired,
  looksLikeConsentToken,
  newConsentToken,
} from "./consent-token";
import { assertContestLinked, isContestLinked } from "./links";

export const DEFAULT_ROYALTY_BPS = 2000;
/** Obras por llamada: cada una es un correo. Las que sobran vuelven en `skipped` con "LIMIT". */
export const MAX_ENTRIES_PER_REQUEST = 100;

type Db = Pick<
  typeof prisma,
  | "$transaction"
  | "fotorankContest"
  | "fotorankContestEntry"
  | "user"
  | "artworkConsent"
  | "artworkListing"
  | "contestStoreSettings"
  | "printFormat"
  | "workspace"
  | "fotofficeWorkspaceDomain"
  | "contestOrganization"
  | "contestOrganizationMember"
  | "workspaceContestOrganizationLink"
>;

type SendEmail = typeof sendAndLogEmail;

export type ConsentDeps = {
  db?: Db;
  send?: SendEmail;
  now?: Date;
  appOrigin?: string;
  random?: (n: number) => Buffer;
};

// ── Bases que aceptó cada autor ─────────────────────────────────────────────

export type Rights = { allowPrint: boolean; allowCommercial: boolean; attributionRequired: boolean };

/** `rights` de la configuración versionada, o null si falta o no tiene la forma esperada. */
export function rightsFromConfigurationJson(json: unknown): Rights | null {
  if (!json || typeof json !== "object") return null;
  const rights = (json as { rights?: unknown }).rights;
  if (!rights || typeof rights !== "object") return null;
  const { allowPrint, allowCommercial, attributionRequired } = rights as Record<string, unknown>;
  if (typeof allowPrint !== "boolean" || typeof allowCommercial !== "boolean") return null;
  return { allowPrint, allowCommercial, attributionRequired: attributionRequired === true };
}

/** Lo que hace falta de la obra para saber qué bases aceptó su autor (select de Prisma). */
export const ENTRY_RULES_SELECT = {
  registration: {
    select: { rulesVersion: { select: { configurationVersion: { select: { configurationJson: true } } } } },
  },
} as const;

type EntryWithRules = {
  registration?: {
    rulesVersion: { configurationVersion: { configurationJson: unknown } | null } | null;
  } | null;
};

/**
 * Los derechos que dan las bases que ESTE autor aceptó al inscribirse: la versión de las bases
 * de su inscripción (`FotorankContestRegistration.rulesVersionId`) y la configuración con la que
 * se generó. No las bases vigentes: si el concurso cambió las bases después, al autor lo obliga
 * lo que firmó. Sin inscripción, sin configuración o con `rights` ilegible → null (y entonces se
 * pide permiso explícito).
 */
export function rightsAcceptedByAuthor(entry: EntryWithRules): Rights | null {
  return rightsFromConfigurationJson(entry.registration?.rulesVersion?.configurationVersion?.configurationJson ?? null);
}

// ── Pedir permiso / avisar ──────────────────────────────────────────────────

export type ConsentSkipReason =
  | "NOT_IN_CONTEST"
  | "NOT_ELIGIBLE"
  | "NO_AUTHOR_EMAIL"
  | "AUTHOR_DECLINED"
  | "AUTHOR_WITHDREW"
  | "ALREADY_GRANTED"
  | "RECENTLY_SENT"
  | "IN_PROGRESS"
  | "EMAIL_FAILED"
  | "LIMIT";

export type RequestConsentsResult = {
  /** Correos de aviso (RULES) enviados. */
  notified: number;
  /** Correos de pedido de permiso (EXPLICIT) enviados. */
  requested: number;
  skipped: { entryId: string; reason: ConsentSkipReason }[];
};

export class ConsentSetupError extends Error {
  readonly code = "SITE_NOT_CONFIGURED" as const;
  constructor() {
    super("Para mandar el enlace al autor, tu institución necesita una dirección pública (el sitio de FOTOFFICE o un dominio propio).");
    this.name = "ConsentSetupError";
  }
}

const AUTOR_YA_DIJO: Partial<Record<string, ConsentSkipReason>> = {
  DECLINED: "AUTHOR_DECLINED",
  WITHDRAWN: "AUTHOR_WITHDREW",
  GRANTED: "ALREADY_GRANTED",
};

/**
 * Avisa o pide permiso a los autores de `entryIds` (obras CONFIRMED, no retiradas, del concurso).
 * El correo sale DESPUÉS de escribir el permiso; si el correo falla, `notifiedAt` vuelve a null
 * para que se pueda reintentar sin esperar las 24 h.
 */
export async function requestConsents(
  workspaceId: string,
  contestId: string,
  entryIds: string[],
  userId: number,
  deps: ConsentDeps = {},
): Promise<RequestConsentsResult> {
  void userId; // Quien pide ya pasó `requireStoreConfigurer`; se recibe para auditoría futura.
  const db = deps.db ?? prisma;
  const send = deps.send ?? sendAndLogEmail;
  const now = deps.now ?? new Date();

  await assertContestLinked(workspaceId, contestId, db);

  const todos = [...new Set(entryIds.filter((id) => typeof id === "string" && id.length > 0))];
  const ids = todos.slice(0, MAX_ENTRIES_PER_REQUEST);
  const result: RequestConsentsResult = {
    notified: 0,
    requested: 0,
    skipped: todos.slice(MAX_ENTRIES_PER_REQUEST).map((entryId) => ({ entryId, reason: "LIMIT" as const })),
  };
  if (ids.length === 0) return result;

  const contexto = await cargarContexto(workspaceId, contestId, db, deps.appOrigin ?? appUrl());
  // El enlace se arma igual para todos: si no hay dirección pública, no se escribe nada.
  if (!buildConsentUrl({ ...contexto.sitio, token: "x" })) throw new ConsentSetupError();

  const [entries, existentes, listings] = await Promise.all([
    db.fotorankContestEntry.findMany({
      where: { id: { in: ids }, contestId },
      select: {
        id: true,
        status: true,
        withdrawnAt: true,
        authorUserId: true,
        title: true,
        entryNumber: true,
        ...ENTRY_RULES_SELECT,
      },
    }),
    db.artworkConsent.findMany({
      where: { workspaceId, entryId: { in: ids } },
      select: { id: true, entryId: true, basis: true, status: true, notifiedAt: true },
    }),
    db.artworkListing.findMany({ where: { workspaceId, entryId: { in: ids } }, select: { entryId: true, previewUrl: true } }),
  ]);
  const autoresIds = [...new Set(entries.map((e) => e.authorUserId).filter((x): x is number => x !== null))];
  const autores = autoresIds.length
    ? await db.user.findMany({ where: { id: { in: autoresIds } }, select: { id: true, email: true, name: true } })
    : [];
  const autorPorId = new Map(autores.map((a) => [a.id, a]));
  const entryPorId = new Map(entries.map((e) => [e.id, e]));
  const consentPorEntry = new Map(existentes.map((c) => [c.entryId, c]));
  const previewPorEntry = new Map(listings.map((l) => [l.entryId, l.previewUrl]));

  for (const entryId of ids) {
    const saltear = (reason: ConsentSkipReason) => result.skipped.push({ entryId, reason });
    const entry = entryPorId.get(entryId);
    if (!entry) {
      saltear("NOT_IN_CONTEST");
      continue;
    }
    if (entry.status !== "CONFIRMED" || entry.withdrawnAt !== null) {
      saltear("NOT_ELIGIBLE");
      continue;
    }
    const autor = entry.authorUserId !== null ? autorPorId.get(entry.authorUserId) : undefined;
    const email = autor?.email?.trim();
    if (!autor || !email) {
      saltear("NO_AUTHOR_EMAIL");
      continue;
    }

    const { token, tokenHash, tokenExpiresAt } = newConsentToken(now, deps.random);
    const previo = consentPorEntry.get(entryId);
    let basis: ConsentBasis;
    let consentId: string | null = null;

    if (previo) {
      const yaDijo = AUTOR_YA_DIJO[previo.status];
      if (yaDijo) {
        saltear(yaDijo);
        continue;
      }
      if (!canResendConsent(previo.notifiedAt, now)) {
        saltear("RECENTLY_SENT");
        continue;
      }
      // Reenvío: token nuevo (el viejo deja de abrir). Condicional en una sola sentencia: el
      // estado no cambió y pasaron 24 h desde el último envío, aunque haya dos pestañas.
      const { count } = await db.artworkConsent.updateMany({
        where: {
          id: previo.id,
          workspaceId,
          status: previo.status,
          OR: [{ notifiedAt: null }, { notifiedAt: { lte: new Date(now.getTime() - CONSENT_RESEND_COOLDOWN_MS) } }],
        },
        data: { tokenHash, tokenExpiresAt, notifiedAt: now, authorUserId: autor.id },
      });
      if (count === 0) {
        saltear("RECENTLY_SENT");
        continue;
      }
      // Se conserva la base con la que se avisó: cambiarla en silencio confundiría al autor.
      basis = previo.basis === "RULES" ? "RULES" : "EXPLICIT";
      consentId = previo.id;
    } else {
      basis = consentBasisFromRights(rightsAcceptedByAuthor(entry));
      // `createMany` con `skipDuplicates`: si otra pestaña lo creó recién, no hay error que atrapar.
      const { count } = await db.artworkConsent.createMany({
        data: [
          {
            workspaceId,
            contestId,
            entryId,
            authorUserId: autor.id,
            basis,
            status: basis === "RULES" ? "NOTIFIED" : "PENDING",
            tokenHash,
            tokenExpiresAt,
            notifiedAt: now,
          },
        ],
        skipDuplicates: true,
      });
      if (count === 0) {
        saltear("IN_PROGRESS");
        continue;
      }
    }

    const url = buildConsentUrl({ ...contexto.sitio, token }) as string;
    const correo = renderArtworkConsentEmail({
      basis,
      institution: contexto.institution,
      authorName: autor.name?.trim() || null,
      contestTitle: contexto.contestTitle,
      artworkTitle: entry.title?.trim() || (entry.entryNumber ? `Obra ${entry.entryNumber}` : "Tu obra"),
      previewUrl: previewPorEntry.get(entryId) ?? null,
      royaltyBps: contexto.royaltyBps,
      formats: contexto.formats,
      url,
      expiresAt: tokenExpiresAt,
    });
    const salida = await send({
      to: email,
      templateKey: basis === "RULES" ? "store.artwork_consent_rules" : "store.artwork_consent_request",
      body: correo,
      userId: autor.id,
    });
    if (salida.status !== "SENT") {
      // Sin datos personales. `notifiedAt` en null: se puede reintentar ya mismo.
      console.warn("[fotoffice][tienda] el correo de permiso no salió", { workspaceId, entryId, status: salida.status });
      await db.artworkConsent.updateMany({
        where: consentId ? { id: consentId, workspaceId } : { workspaceId, entryId, tokenHash },
        data: { notifiedAt: null },
      });
      saltear("EMAIL_FAILED");
      continue;
    }
    if (basis === "RULES") result.notified += 1;
    else result.requested += 1;
  }
  return result;
}

type Contexto = {
  institution: string;
  contestTitle: string;
  royaltyBps: number;
  formats: { name: string; widthCm: number; heightCm: number; priceMinor: number }[];
  sitio: { customDomain: string | null; appOrigin: string; slug: string | null };
};

async function cargarContexto(workspaceId: string, contestId: string, db: Db, appOrigin: string): Promise<Contexto> {
  const [workspace, dominio, concurso, ajustes, formatos] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, fotofficeBranding: { select: { publicSlug: true, commercialName: true } } },
    }),
    db.fotofficeWorkspaceDomain.findUnique({ where: { workspaceId }, select: { domain: true, status: true } }),
    db.fotorankContest.findUnique({ where: { id: contestId }, select: { title: true } }),
    db.contestStoreSettings.findUnique({
      where: { workspaceId_contestId: { workspaceId, contestId } },
      select: { royaltyBps: true },
    }),
    db.printFormat.findMany({
      where: { workspaceId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { name: true, widthCm: true, heightCm: true, priceArs: true },
    }),
  ]);
  return {
    institution: workspace?.fotofficeBranding?.commercialName || workspace?.name || "La institución",
    contestTitle: concurso?.title ?? "",
    royaltyBps: ajustes?.royaltyBps ?? DEFAULT_ROYALTY_BPS,
    formats: formatos.map((f) => ({
      name: f.name,
      widthCm: f.widthCm,
      heightCm: f.heightCm,
      priceMinor: decimalArsToMinor(f.priceArs),
    })),
    sitio: {
      customDomain: dominio?.status === "CONNECTED" ? dominio.domain : null,
      appOrigin,
      slug: workspace?.fotofficeBranding?.publicSlug ?? null,
    },
  };
}

// ── La página del autor ─────────────────────────────────────────────────────

export type ConsentView = {
  consentId: string;
  contestId: string;
  entryId: string;
  basis: ConsentBasis;
  status: ConsentStatus;
  institution: string;
  contestTitle: string;
  artworkTitle: string;
  /** Vista previa guardada en el R2 de FOTOFFICE, si la obra ya se preparó para la tienda. */
  storedPreviewUrl: string | null;
  /** ¿El concurso sigue vinculado? Sin vínculo no se firma ninguna imagen de FotoRank. */
  contestLinked: boolean;
  royaltyBps: number;
  formats: { name: string; widthCm: number; heightCm: number; priceMinor: number }[];
  expiresAt: Date;
  /** Lo que el autor puede hacer ahora, según `applyAuthorAction`. */
  actions: AuthorAction[];
};

const ACCIONES: AuthorAction[] = ["accept", "decline", "withdraw"];

function accionesPosibles(basis: ConsentBasis, status: ConsentStatus): AuthorAction[] {
  return ACCIONES.filter((a) => applyAuthorAction({ basis, status }, a).ok);
}

function comoBasis(v: string): ConsentBasis {
  return v === "RULES" ? "RULES" : "EXPLICIT";
}

const ESTADOS: readonly ConsentStatus[] = ["PENDING", "GRANTED", "DECLINED", "NOTIFIED", "WITHDRAWN"];
function comoStatus(v: string): ConsentStatus {
  return (ESTADOS as readonly string[]).includes(v) ? (v as ConsentStatus) : "WITHDRAWN";
}

async function buscarPorToken(workspaceId: string, token: unknown, db: Db, now: Date) {
  if (!looksLikeConsentToken(token)) return null;
  const consent = await db.artworkConsent.findFirst({
    where: { workspaceId, tokenHash: hashConsentToken(token) },
    select: { id: true, contestId: true, entryId: true, basis: true, status: true, tokenExpiresAt: true },
  });
  if (!consent || isConsentTokenExpired(consent.tokenExpiresAt, now)) return null;
  return consent;
}

/** Lo que muestra la página del enlace. null = enlace desconocido, de otra institución o vencido. */
export async function loadConsentView(
  workspaceId: string,
  token: unknown,
  deps: Pick<ConsentDeps, "db" | "now"> = {},
): Promise<ConsentView | null> {
  const db = deps.db ?? prisma;
  const now = deps.now ?? new Date();
  const consent = await buscarPorToken(workspaceId, token, db, now);
  if (!consent) return null;

  const [contexto, entry, listing, linked] = await Promise.all([
    cargarContexto(workspaceId, consent.contestId, db, ""),
    db.fotorankContestEntry.findUnique({ where: { id: consent.entryId }, select: { title: true, entryNumber: true } }),
    db.artworkListing.findFirst({ where: { workspaceId, entryId: consent.entryId }, select: { previewUrl: true } }),
    isContestLinked(workspaceId, consent.contestId, db),
  ]);
  const basis = comoBasis(consent.basis);
  const status = comoStatus(consent.status);
  return {
    consentId: consent.id,
    contestId: consent.contestId,
    entryId: consent.entryId,
    basis,
    status,
    institution: contexto.institution,
    contestTitle: contexto.contestTitle,
    artworkTitle: entry?.title?.trim() || (entry?.entryNumber ? `Obra ${entry.entryNumber}` : "Tu obra"),
    storedPreviewUrl: listing?.previewUrl || null,
    contestLinked: linked,
    royaltyBps: contexto.royaltyBps,
    formats: contexto.formats,
    expiresAt: consent.tokenExpiresAt,
    actions: accionesPosibles(basis, status),
  };
}

export type RespondConsentResult =
  | { ok: true; status: ConsentStatus; listingWithdrawn: boolean }
  | { ok: false; reason: "INVALID_LINK" | "NOT_ALLOWED" };

/**
 * La respuesta del autor. En una transacción: cambia el permiso (sólo si sigue en el estado que
 * se leyó) y, si retira o no acepta, despublica la obra de esa institución. El token sigue
 * sirviendo hasta que vence: quien aceptó puede volver más tarde a retirarla.
 */
export async function respondConsent(
  workspaceId: string,
  token: unknown,
  action: unknown,
  deps: Pick<ConsentDeps, "db" | "now"> = {},
): Promise<RespondConsentResult> {
  const db = deps.db ?? prisma;
  const now = deps.now ?? new Date();
  if (action !== "accept" && action !== "decline" && action !== "withdraw") return { ok: false, reason: "NOT_ALLOWED" };
  if (!looksLikeConsentToken(token)) return { ok: false, reason: "INVALID_LINK" };
  const tokenHash = hashConsentToken(token);

  return db.$transaction(async (tx) => {
    const consent = await tx.artworkConsent.findFirst({
      where: { workspaceId, tokenHash },
      select: { id: true, entryId: true, basis: true, status: true, tokenExpiresAt: true },
    });
    if (!consent || isConsentTokenExpired(consent.tokenExpiresAt, now)) {
      return { ok: false as const, reason: "INVALID_LINK" as const };
    }
    const paso = applyAuthorAction({ basis: comoBasis(consent.basis), status: comoStatus(consent.status) }, action);
    if (!paso.ok) return { ok: false as const, reason: "NOT_ALLOWED" as const };

    const { count } = await tx.artworkConsent.updateMany({
      where: { id: consent.id, workspaceId, tokenHash, status: consent.status },
      data: { status: paso.status, respondedAt: now },
    });
    if (count === 0) return { ok: false as const, reason: "NOT_ALLOWED" as const };

    let listingWithdrawn = false;
    if (paso.status === "DECLINED" || paso.status === "WITHDRAWN") {
      const r = await tx.artworkListing.updateMany({
        where: { workspaceId, entryId: consent.entryId, status: { not: "WITHDRAWN" } },
        data: { status: "WITHDRAWN", withdrawnAt: now },
      });
      listingWithdrawn = r.count > 0;
    }
    return { ok: true as const, status: paso.status, listingWithdrawn };
  });
}
