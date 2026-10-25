import "server-only";
import { prisma } from "@repo/db";
import { normalizarSitioWeb, normalizarUrlRed } from "@/lib/membership/social";
import { appUrl } from "@/lib/app-url";
import { partnersWriter, type PartnersDb } from "./clients";
import { validateSponsorLogo } from "./logo-rules";
import {
  SponsorsError,
  createSponsor,
  logoDe,
  normalizarComunes,
  saveSponsorLogo,
} from "./repository";
import {
  generateSelfSignupToken,
  hashSelfSignupToken,
  isSelfSignupUsable,
  looksLikeSelfSignupToken,
  selfSignupExpiry,
  selfSignupUrl,
} from "./self-signup-token";

/**
 * Autoalta de sponsors: la institución genera un enlace, se lo manda al sponsor por WhatsApp o
 * correo, y el sponsor carga su logo, sus redes, el beneficio para los socios y un contacto.
 *
 * Usa la tabla `DnxPartnerOnboardingInvitation` de DNX Partners (base de Clickatón), la misma
 * que pensó el panel de Clickatón para esto. Cada enlace queda atado a la participación de la
 * institución: de ahí sale a qué institución pertenece y nada más.
 *
 * Lo que carga el sponsor se aplica directo, sin revisión: la institución eligió a quién mandarle
 * el enlace, y la ficha no aparece en ningún lado público hasta que la institución lo ponga en un
 * espacio. Lo que haga falta corregir se corrige desde la ficha, como siempre.
 */

const SIN_CONEXION =
  "Falta la conexión de FOTOFFICE con DNX Partners: por ahora no se pueden generar enlaces.";

function escritor(): PartnersDb {
  const db = partnersWriter();
  if (!db) throw new SponsorsError(SIN_CONEXION);
  return db;
}

function participacionDe(workspaceId: string, partnerId: string) {
  return {
    partnerId,
    application: "FOTO_OFFICE" as const,
    contextType: "ORGANIZATION" as const,
    contextId: workspaceId,
    archivedAt: null,
    status: { notIn: ["ARCHIVED" as const, "CANCELLED" as const] },
  };
}

export type SelfSignupLink = { url: string; expiresAt: Date };

/**
 * Genera un enlace nuevo para un sponsor ya vinculado. Los enlaces anteriores sin usar de esta
 * institución dejan de servir: así, si el primero se mandó a quien no era, alcanza con generar
 * otro.
 */
export async function createSelfSignupLink(input: {
  workspaceId: string;
  partnerId: string;
  now?: Date;
}): Promise<SelfSignupLink> {
  const db = escritor();
  const now = input.now ?? new Date();
  const participacion = await db.dnxPartnerParticipation.findFirst({
    where: participacionDe(input.workspaceId, input.partnerId),
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!participacion) throw new SponsorsError("Ese sponsor no está vinculado a la institución.");

  const base = appUrl();
  if (!base) throw new SponsorsError("FOTOFFICE no tiene configurada su dirección pública: no se puede armar el enlace.");

  const token = generateSelfSignupToken();
  const expiresAt = selfSignupExpiry(now);
  await db.$transaction([
    db.dnxPartnerOnboardingInvitation.updateMany({
      where: { participationId: participacion.id, status: { in: ["PENDING", "OPENED"] } },
      data: { status: "REVOKED", revokedAt: now },
    }),
    db.dnxPartnerOnboardingInvitation.create({
      data: {
        partnerId: input.partnerId,
        participationId: participacion.id,
        tokenHash: hashSelfSignupToken(token),
        status: "PENDING",
        expiresAt,
      },
    }),
  ]);
  return { url: selfSignupUrl(base, token), expiresAt };
}

/** Crea un sponsor con sólo su nombre y devuelve el enlace para que complete el resto. */
export async function inviteNewSponsor(input: {
  workspaceId: string;
  name: string;
}): Promise<SelfSignupLink & { partnerId: string }> {
  const partnerId = await createSponsor({
    workspaceId: input.workspaceId,
    name: input.name,
    websiteUrl: "",
    instagram: "",
  });
  const enlace = await createSelfSignupLink({ workspaceId: input.workspaceId, partnerId });
  return { ...enlace, partnerId };
}

export type SelfSignupContact = { name: string; email: string | null; phone: string | null };

function contactoDe(json: unknown): SelfSignupContact | null {
  if (!json || typeof json !== "object") return null;
  const c = (json as { contacto?: unknown }).contacto;
  if (!c || typeof c !== "object") return null;
  const { firstName, email, phone } = c as Record<string, unknown>;
  if (typeof firstName !== "string") return null;
  return {
    name: firstName,
    email: typeof email === "string" ? email : null,
    phone: typeof phone === "string" ? phone : null,
  };
}

export type SelfSignupStatus =
  | { kind: "NONE" }
  | { kind: "WAITING"; createdAt: Date; openedAt: Date | null; expiresAt: Date }
  | { kind: "SUBMITTED"; submittedAt: Date; contact: SelfSignupContact | null }
  | { kind: "EXPIRED"; createdAt: Date };

/** En qué anda el último enlace de esta institución para este sponsor. Para la ficha y la lista. */
export async function selfSignupStatuses(
  db: PartnersDb,
  workspaceId: string,
  partnerIds: string[],
  now = new Date(),
): Promise<Map<string, SelfSignupStatus>> {
  const salida = new Map<string, SelfSignupStatus>();
  if (partnerIds.length === 0) return salida;
  const filas = await db.dnxPartnerOnboardingInvitation.findMany({
    where: {
      partnerId: { in: partnerIds },
      status: { not: "REVOKED" },
      participation: { application: "FOTO_OFFICE", contextType: "ORGANIZATION", contextId: workspaceId },
    },
    orderBy: { createdAt: "desc" },
    select: {
      partnerId: true,
      status: true,
      createdAt: true,
      openedAt: true,
      submittedAt: true,
      expiresAt: true,
      revokedAt: true,
      submissionJson: true,
    },
  });
  for (const f of filas) {
    if (salida.has(f.partnerId)) continue;
    if (f.status === "SUBMITTED" && f.submittedAt) {
      salida.set(f.partnerId, { kind: "SUBMITTED", submittedAt: f.submittedAt, contact: contactoDe(f.submissionJson) });
    } else if (isSelfSignupUsable(f, now)) {
      salida.set(f.partnerId, { kind: "WAITING", createdAt: f.createdAt, openedAt: f.openedAt, expiresAt: f.expiresAt });
    } else {
      salida.set(f.partnerId, { kind: "EXPIRED", createdAt: f.createdAt });
    }
  }
  return salida;
}

// ─────────────────────────────── Lado del sponsor ───────────────────────────────

export type SelfSignupView = {
  invitationId: string;
  partnerId: string;
  workspaceId: string;
  institution: { name: string; logoUrl: string | null };
  current: {
    name: string;
    logoSrc: string | null;
    websiteUrl: string | null;
    instagram: string | null;
    facebookUrl: string | null;
    description: string | null;
    benefitTitle: string | null;
    benefitText: string | null;
  };
};

/**
 * Lo que necesita la página pública, o null si el enlace no sirve. Un enlace inexistente,
 * vencido o ya usado dan lo mismo: confirmar que un token existió le dice a quien lo prueba
 * que acertó.
 */
export async function findSelfSignup(rawToken: string, now = new Date()): Promise<SelfSignupView | null> {
  if (!looksLikeSelfSignupToken(rawToken)) return null;
  const db = partnersWriter();
  if (!db) return null;

  const fila = await db.dnxPartnerOnboardingInvitation.findUnique({
    where: { tokenHash: hashSelfSignupToken(rawToken) },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      revokedAt: true,
      partner: {
        select: {
          id: true,
          name: true,
          archivedAt: true,
          logoUrl: true,
          websiteUrl: true,
          instagram: true,
          facebookUrl: true,
          description: true,
          brandAssets: {
            where: { archivedAt: null, status: "ACTIVE", approvalStatus: "APPROVED" },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      participation: {
        select: { application: true, contextType: true, contextId: true, archivedAt: true, title: true, description: true },
      },
    },
  });
  if (!fila || !isSelfSignupUsable(fila, now)) return null;
  const p = fila.participation;
  if (!p || p.archivedAt || p.application !== "FOTO_OFFICE" || p.contextType !== "ORGANIZATION" || !p.contextId) {
    return null;
  }
  if (fila.partner.archivedAt) return null;

  const workspace = await prisma.workspace.findUnique({
    where: { id: p.contextId },
    select: { name: true, fotofficeBranding: { select: { commercialName: true, logoUrl: true } } },
  });
  if (!workspace) return null;

  if (fila.status === "PENDING") {
    await db.dnxPartnerOnboardingInvitation.update({
      where: { id: fila.id },
      data: { status: "OPENED", openedAt: now },
    });
  }

  return {
    invitationId: fila.id,
    partnerId: fila.partner.id,
    workspaceId: p.contextId,
    institution: {
      name: workspace.fotofficeBranding?.commercialName || workspace.name,
      logoUrl: workspace.fotofficeBranding?.logoUrl ?? null,
    },
    current: {
      name: fila.partner.name,
      logoSrc: logoDe(fila.partner),
      websiteUrl: fila.partner.websiteUrl,
      instagram: fila.partner.instagram,
      facebookUrl: fila.partner.facebookUrl,
      description: fila.partner.description,
      benefitTitle: p.title,
      benefitText: p.description,
    },
  };
}

export type SelfSignupInput = {
  name: string;
  websiteUrl: string;
  instagram: string;
  facebookUrl: string;
  description: string;
  benefitTitle: string;
  benefitText: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  logo: File | null;
};

function textoONulo(valor: string, max: number): string | null {
  const t = valor.trim();
  return t ? t.slice(0, max) : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Valida lo que se puede validar sin base. Exportada para probarla. */
export function validarAutoalta(input: SelfSignupInput) {
  const comunes = normalizarComunes({ name: input.name, websiteUrl: input.websiteUrl, instagram: input.instagram });
  const facebook = normalizarUrlRed("facebook", input.facebookUrl);
  if (!facebook.ok) throw new SponsorsError(facebook.error);

  const contactName = textoONulo(input.contactName, 120);
  const contactEmail = textoONulo(input.contactEmail, 200)?.toLowerCase() ?? null;
  const contactPhone = textoONulo(input.contactPhone, 40);
  if (!contactName) throw new SponsorsError("Dejanos el nombre de una persona de contacto.");
  if (!contactEmail && !contactPhone) throw new SponsorsError("Dejanos un correo o un teléfono para comunicarnos.");
  if (contactEmail && !EMAIL.test(contactEmail)) throw new SponsorsError("El correo no parece válido.");

  return {
    comunes: { ...comunes, facebookUrl: facebook.valor, description: textoONulo(input.description, 2000) },
    beneficio: { title: textoONulo(input.benefitTitle, 120), description: textoONulo(input.benefitText, 600) },
    contacto: { firstName: contactName, email: contactEmail, phone: contactPhone },
  };
}

/**
 * Guarda lo que cargó el sponsor y deja el enlace usado.
 *
 * Devuelve si el logo quedó guardado: un archivo inválido (formato, peso) se rechaza antes de
 * guardar nada, para que lo cambie; pero si lo que falla es el almacenamiento, los demás datos
 * igual se guardan y el logo lo sube después la institución desde la ficha.
 */
export async function submitSelfSignup(
  rawToken: string,
  input: SelfSignupInput,
  now = new Date(),
): Promise<{ logo: "saved" | "none" | "failed" }> {
  const vista = await findSelfSignup(rawToken, now);
  if (!vista) throw new SponsorsError("Este enlace ya no está disponible. Pedile uno nuevo a la institución.");
  const datos = validarAutoalta(input);
  const logo = input.logo && input.logo.size > 0 ? input.logo : null;
  if (logo) {
    const valido = validateSponsorLogo({ type: logo.type, size: logo.size });
    if (!valido.ok) throw new SponsorsError(valido.error);
  }
  const db = escritor();

  const antes = vista.current;
  await db.$transaction(async (tx) => {
    // Se vuelve a marcar con condición: si el mismo enlace se envía dos veces a la vez, gana uno.
    const tomado = await tx.dnxPartnerOnboardingInvitation.updateMany({
      where: { id: vista.invitationId, status: { in: ["PENDING", "OPENED"] }, revokedAt: null },
      data: {
        status: "SUBMITTED",
        submittedAt: now,
        submissionJson: {
          marca: datos.comunes,
          beneficio: datos.beneficio,
          contacto: datos.contacto,
          logo: Boolean(logo),
        },
      },
    });
    if (tomado.count === 0) throw new SponsorsError("Este enlace ya se usó.");

    const partner = await tx.dnxPartner.findUnique({
      where: { id: vista.partnerId },
      select: { email: true, phone: true },
    });
    await tx.dnxPartner.update({
      where: { id: vista.partnerId },
      data: {
        ...datos.comunes,
        // La ficha común puede tener ya un correo de otra plataforma: no se pisa.
        email: partner?.email ?? datos.contacto.email,
        phone: partner?.phone ?? datos.contacto.phone,
      },
    });

    if (datos.beneficio.title || datos.beneficio.description) {
      await tx.dnxPartnerParticipation.updateMany({
        where: participacionDe(vista.workspaceId, vista.partnerId),
        data: { title: datos.beneficio.title, description: datos.beneficio.description },
      });
    }

    const tienePrincipal = await tx.dnxPartnerContact.count({
      where: { partnerId: vista.partnerId, isPrimary: true, archivedAt: null },
    });
    await tx.dnxPartnerContact.create({
      data: {
        partnerId: vista.partnerId,
        firstName: datos.contacto.firstName,
        email: datos.contacto.email,
        phone: datos.contacto.phone,
        whatsapp: datos.contacto.phone,
        isPrimary: tienePrincipal === 0,
        notes: `Cargado por el sponsor desde el enlace de FOTOFFICE (institución ${vista.workspaceId}).`,
      },
    });

    await tx.dnxPartnerAuditEvent.create({
      data: {
        partnerId: vista.partnerId,
        entityType: "DnxPartnerOnboardingInvitation",
        entityId: vista.invitationId,
        action: "SELF_SIGNUP_SUBMITTED",
        summary: `El sponsor completó sus datos desde el enlace de FOTOFFICE (institución ${vista.workspaceId}).`,
        beforeJson: {
          name: antes.name,
          websiteUrl: antes.websiteUrl,
          instagram: antes.instagram,
          facebookUrl: antes.facebookUrl,
          description: antes.description,
        },
        afterJson: datos.comunes,
      },
    });
  });

  if (!logo) return { logo: "none" };
  try {
    const r = await saveSponsorLogo({ workspaceId: vista.workspaceId, partnerId: vista.partnerId, file: logo });
    if (r.ok) return { logo: "saved" };
    console.error("[fotoffice][sponsors] autoalta: el logo no se guardó", { detalle: r.error });
  } catch (error) {
    console.error("[fotoffice][sponsors] autoalta: el logo no se guardó", {
      detalle: error instanceof Error ? error.message : String(error),
    });
  }
  return { logo: "failed" };
}
