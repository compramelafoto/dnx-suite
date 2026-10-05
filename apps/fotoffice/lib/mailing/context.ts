import "server-only";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import type { RenderedEmailSignature } from "@repo/communications/signature";
import { resolveUnsubscribeSecret, signUnsubscribeToken } from "./unsubscribe-token";
import type { MailingBrand } from "./layout";

/**
 * Lo que todo correo a socios de una institución necesita: su marca, su firma, dónde vive su sitio
 * y cómo armar el enlace de baja de cada destinatario.
 */
export type MailingContext = {
  workspaceId: string;
  brand: MailingBrand;
  signature: RenderedEmailSignature | null;
  /** Origen del sitio público + prefijo: `https://sfpr.com.ar` o `https://fotoffice.com/w/sfpr`. */
  siteBase: string | null;
  /** null si falta la URL de la app o la clave: sin enlace de baja no sale ningún envío masivo. */
  unsubscribe: ((email: string, topic: string) => { pageUrl: string; oneClickUrl: string }) | null;
  reason: string;
  /** Dirección pública de FOTOFFICE (para el botón «Entrar al portal»). */
  appBase: string | null;
};

export async function loadMailingContext(workspaceId: string): Promise<MailingContext> {
  const [ctx, ws, domain] = await Promise.all([
    loadWorkspaceEmailContext(workspaceId),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { fotofficeBranding: { select: { logoUrl: true, accentColor: true, primaryColor: true, publicSlug: true } } },
    }),
    prisma.fotofficeWorkspaceDomain
      .findUnique({ where: { workspaceId }, select: { domain: true, status: true } })
      .catch(() => null),
  ]);
  const b = ws?.fotofficeBranding;
  const app = appUrl();
  const siteBase =
    domain?.status === "CONNECTED"
      ? `https://${domain.domain}`
      : app && b?.publicSlug
        ? `${app}/w/${b.publicSlug}`
        : null;

  const secret = resolveUnsubscribeSecret();
  const unsubscribe =
    app && secret
      ? (email: string, topic: string) => {
          const t = encodeURIComponent(signUnsubscribeToken({ workspaceId, email }, secret));
          const tema = encodeURIComponent(topic);
          return {
            pageUrl: `${app}/correo/baja?t=${t}&tema=${tema}`,
            oneClickUrl: `${app}/api/correo/baja?t=${t}&tema=${tema}`,
          };
        }
      : null;

  return {
    workspaceId,
    brand: {
      name: ctx.organizationName,
      logoUrl: b?.logoUrl ?? null,
      accentColor: b?.accentColor || b?.primaryColor || null,
    },
    signature: ctx.signature,
    siteBase,
    unsubscribe,
    reason: `Recibís este correo porque sos socio de ${ctx.organizationName}.`,
    appBase: app || null,
  };
}

export function postUrl(ctx: MailingContext, slug: string): string | null {
  return ctx.siteBase ? `${ctx.siteBase}/blog/${slug}` : null;
}

export function blogUrl(ctx: MailingContext): string | null {
  return ctx.siteBase ? `${ctx.siteBase}/blog` : null;
}

/** Cabeceras que piden Gmail y Yahoo para la baja de un clic. */
export function unsubscribeHeaders(oneClickUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${oneClickUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** A dónde lleva el botón de un correo del ciclo del socio. */
export function ctaUrlFor(ctx: MailingContext, target: "portal" | "sitio"): string | null {
  if (target === "portal") return ctx.appBase ? `${ctx.appBase}/portal` : null;
  return ctx.siteBase;
}
