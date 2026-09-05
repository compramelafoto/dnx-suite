import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role, TokenPurpose } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/token-hash";
import { sendEmail } from "@/emails/send";
import { buildVerifyEmail } from "@/emails/templates/auth";
import { getOrCreateReferralCodeForUser } from "@/lib/referral-code-service";
import { buildReferralAmbassadorMessages } from "@/lib/referral-share-messages";
import { FUNNEL_COOKIE_NAME, FUNNEL_EVENTS } from "@/lib/funnel-events";
import { PHOTOGRAPHER_TERMS_VERSION } from "@/lib/terms/photographerTermsExtended";
import { tryCreateReferralAttributionOnSignup } from "@/lib/referral/referral-signup-attribution";
import { ReferralProgram } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REFERRER_ROLES: Role[] = [Role.PHOTOGRAPHER, Role.LAB, Role.LAB_PHOTOGRAPHER];

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

function normalizeWhatsapp(raw: string): string {
  const t = raw.trim();
  return t.replace(/[^\d+]/g, "") || t;
}

function normalizeInstagram(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().replace(/^@+/, "");
  return t.length ? t.slice(0, 80) : null;
}

function buildMarketingSource(payload: {
  source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}): string {
  const parts = ["recomendanos"];
  if (payload.source) parts.push(`src=${payload.source.slice(0, 80)}`);
  if (payload.utm_source) parts.push(`utm_source=${payload.utm_source.slice(0, 80)}`);
  if (payload.utm_medium) parts.push(`utm_medium=${payload.utm_medium.slice(0, 80)}`);
  if (payload.utm_campaign) parts.push(`utm_campaign=${payload.utm_campaign.slice(0, 80)}`);
  if (payload.utm_content) parts.push(`utm_content=${payload.utm_content.slice(0, 80)}`);
  if (payload.utm_term) parts.push(`utm_term=${payload.utm_term.slice(0, 80)}`);
  return parts.join("|").slice(0, 500);
}

const profileEnum = z.enum([
  "FOTOGRAFO",
  "CREADOR",
  "COMUNIDAD",
  "ESTUDIO",
  "INSTITUCION",
  "LABORATORIO",
  "MARCA",
  "INFLUENCER",
  "OTRO",
]);

const bodySchema = z.object({
  fullName: z.string().trim().min(2, "Ingresá tu nombre y apellido").max(120),
  email: z.string().trim().toLowerCase().email("Email inválido").max(254),
  whatsapp: z
    .string()
    .trim()
    .min(8, "Ingresá un WhatsApp válido")
    .max(40),
  instagram: z.string().trim().max(80).optional().or(z.literal("")),
  profileType: z.union([profileEnum, z.literal("")]).optional(),
  termsAccepted: z
    .boolean()
    .refine((v) => v === true, "Tenés que aceptar términos y privacidad"),
  /** Si llegó con ?ref= de otro referidor */
  incomingRef: z.string().trim().max(32).optional().or(z.literal("")),
  source: z.string().trim().max(120).optional().or(z.literal("")),
  utm_source: z.string().trim().max(120).optional().or(z.literal("")),
  utm_medium: z.string().trim().max(120).optional().or(z.literal("")),
  utm_campaign: z.string().trim().max(120).optional().or(z.literal("")),
  utm_content: z.string().trim().max(120).optional().or(z.literal("")),
  utm_term: z.string().trim().max(120).optional().or(z.literal("")),
});

function digitsCount(s: string): number {
  return (s.match(/\d/g) || []).length;
}

async function logFunnel(req: NextRequest, event: string, userId: number | null) {
  try {
    const visitorKey = req.cookies.get(FUNNEL_COOKIE_NAME)?.value?.trim() || `srv_${Date.now()}`;
    const referrer = req.headers.get("referer")?.slice(0, 2000) ?? null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 2000) ?? null;
    await prisma.funnelVisit.create({
      data: {
        visitorKey: visitorKey.length >= 8 ? visitorKey : `srv_${Date.now()}`,
        event,
        userId,
        referrer,
        userAgent,
        path: "/recomendanos",
      },
    });
  } catch (e) {
    console.warn("referral-ambassador funnel log", e);
  }
}

async function ensurePhotographerTermsAcceptance(userId: number, req: NextRequest) {
  try {
    let termsDoc = await prisma.termsDocument.findFirst({
      where: { role: Role.PHOTOGRAPHER, version: PHOTOGRAPHER_TERMS_VERSION },
    });
    if (!termsDoc) {
      const { PHOTOGRAPHER_TERMS_TEXT } = await import("@/lib/terms/photographerTermsExtended");
      try {
        termsDoc = await prisma.termsDocument.create({
          data: {
            role: Role.PHOTOGRAPHER,
            version: PHOTOGRAPHER_TERMS_VERSION,
            contentMd: PHOTOGRAPHER_TERMS_TEXT,
            isActive: true,
          },
        });
      } catch (createErr: unknown) {
        const code = (createErr as { code?: string })?.code;
        if (code === "P2002") {
          termsDoc = await prisma.termsDocument.findFirst({
            where: { role: Role.PHOTOGRAPHER, version: PHOTOGRAPHER_TERMS_VERSION },
          });
        } else {
          throw createErr;
        }
      }
    }
    if (!termsDoc) return;
    const acceptedIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null;
    const acceptedUserAgent = req.headers.get("user-agent") || null;
    await prisma.termsAcceptance.create({
      data: {
        userId,
        role: Role.PHOTOGRAPHER,
        termsDocumentId: termsDoc.id,
        termsVersion: PHOTOGRAPHER_TERMS_VERSION,
        acceptedIp,
        acceptedUserAgent,
      },
    });
  } catch (e: unknown) {
    const msg = (e as { code?: string; message?: string })?.code;
    if (msg === "P2002") return;
    console.warn("referral-ambassador terms acceptance", e);
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit({
    key: `referral-ambassador:${ip}`,
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, message: "Recibimos muchas solicitudes desde esta red. Probá de nuevo en un rato." },
      { status: 429 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "No pudimos leer el formulario. Recargá la página e intentá de nuevo." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg =
      first.fullName?.[0] ||
      first.email?.[0] ||
      first.whatsapp?.[0] ||
      first.termsAccepted?.[0] ||
      "Revisá los datos e intentá de nuevo.";
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }

  const body = parsed.data;
  const wa = normalizeWhatsapp(body.whatsapp);
  if (digitsCount(wa) < 8) {
    return NextResponse.json({ ok: false, message: "Ingresá un WhatsApp con al menos 8 dígitos." }, { status: 400 });
  }

  const instagram = normalizeInstagram(body.instagram);
  const marketingSource = buildMarketingSource(body);

  const profileTag =
    body.profileType && profileEnum.safeParse(body.profileType).success
      ? `recomendanos_perfil:${body.profileType.toLowerCase()}`
      : null;

  let incomingRefTag: string | null = null;
  let incomingRefCode: string | null = null;
  if (body.incomingRef) {
    const codeRow = await prisma.referralCode.findFirst({
      where: { code: body.incomingRef, isActive: true },
      select: { code: true },
    });
    if (codeRow) {
      incomingRefCode = codeRow.code;
      incomingRefTag = `landing_ref:${codeRow.code}`;
    }
  }

  const existing = await prisma.user.findUnique({
    where: { email: body.email },
    select: {
      id: true,
      role: true,
      name: true,
      whatsapp: true,
      instagram: true,
      tags: true,
    },
  });

  if (existing) {
    if (!REFERRER_ROLES.includes(existing.role)) {
      return NextResponse.json({
        ok: false,
        message:
          "Este correo ya está asociado a otro tipo de cuenta. Iniciá sesión desde la web o escribinos por soporte si necesitás ayuda.",
      });
    }

    const mergeTags = Array.from(
      new Set([
        ...existing.tags,
        "origen:recomendanos",
        ...(profileTag ? [profileTag] : []),
        ...(incomingRefTag ? [incomingRefTag] : []),
      ])
    );

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        tags: mergeTags,
        whatsapp: existing.whatsapp || wa || undefined,
        instagram: existing.instagram || instagram || undefined,
        marketingOptIn: true,
        marketingOptInSource: marketingSource,
      },
    });

    const { code, url } = await getOrCreateReferralCodeForUser(existing.id);
    const messages = buildReferralAmbassadorMessages(url);

    await logFunnel(req, FUNNEL_EVENTS.REFERRAL_FORM_SUBMITTED, existing.id);
    await logFunnel(req, FUNNEL_EVENTS.REFERRAL_EXISTING_USER_RECOVERED, existing.id);
    await logFunnel(req, FUNNEL_EVENTS.REFERRAL_LINK_GENERATED, existing.id);

    return NextResponse.json({
      ok: true,
      existingUser: true,
      referralCode: code,
      referralUrl: url,
      messages,
      infoMessage:
        "Ya había una cuenta con este correo: te volvimos a mostrar tu link de referidos. Si no recordás la contraseña, podés recuperarla desde el inicio de sesión.",
    });
  }

  const randomPassword = randomBytes(24).toString("hex");
  const hashedPassword = await bcrypt.hash(randomPassword, 10);
  const ipAddr = getClientIp(req);

  const newTags = ["origen:recomendanos", ...(profileTag ? [profileTag] : []), ...(incomingRefTag ? [incomingRefTag] : [])];

  let userId: number;
  try {
    const created = await prisma.user.create({
      data: {
        email: body.email,
        name: body.fullName,
        password: hashedPassword,
        role: Role.PHOTOGRAPHER,
        whatsapp: wa,
        instagram: instagram ?? undefined,
        tags: newTags,
        marketingOptIn: true,
        marketingOptInAt: new Date(),
        marketingOptInIp: ipAddr,
        marketingOptInSource: marketingSource,
        unsubscribeToken: randomBytes(24).toString("hex"),
      },
      select: { id: true },
    });
    userId = created.id;
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json({
        ok: false,
        message: "Hubo un conflicto al crear la cuenta. Recargá la página e intentá de nuevo.",
      });
    }
    console.error("referral-ambassador create user", e);
    return NextResponse.json({
      ok: false,
      message: "No pudimos completar el alta en este momento. Intentá de nuevo en unos minutos.",
    });
  }

  await ensurePhotographerTermsAcceptance(userId, req);

  // Si llegó con el link de otro referidor, dejarlo como referido de verdad
  // (antes sólo quedaba una etiqueta `landing_ref:` y no cobraba comisión).
  if (incomingRefCode) {
    await tryCreateReferralAttributionOnSignup({
      referredUserId: userId,
      referredUserEmail: body.email,
      referralProgram: ReferralProgram.PHOTOGRAPHER_REFERRAL,
      refCode: incomingRefCode,
      logContext: "REFERRAL AMBASSADOR SIGNUP",
    });
  }

  const verifyToken = randomBytes(32).toString("hex");
  const verifyExpires = new Date();
  verifyExpires.setHours(verifyExpires.getHours() + 24);
  const verifyUrl = `${process.env.APP_URL || "http://localhost:3000"}/verify-email?token=${verifyToken}`;

  await prisma.emailVerificationToken.create({
    data: {
      email: body.email,
      token: hashToken(verifyToken),
      purpose: TokenPurpose.VERIFY_EMAIL,
      expiresAt: verifyExpires,
    },
  });

  try {
    const userRow = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (userRow) {
      const { subject, html } = buildVerifyEmail({
        firstName: userRow.name || undefined,
        verifyUrl,
      });
      await sendEmail({
        to: userRow.email,
        subject,
        html,
        templateKey: "AUTH01_VERIFY_EMAIL",
        meta: { userId },
      });
    }
  } catch (emailErr) {
    console.error("referral-ambassador verify email", emailErr);
  }

  const { code, url } = await getOrCreateReferralCodeForUser(userId);
  const messages = buildReferralAmbassadorMessages(url);

  await logFunnel(req, FUNNEL_EVENTS.REFERRAL_FORM_SUBMITTED, userId);
  await logFunnel(req, FUNNEL_EVENTS.REFERRAL_USER_CREATED, userId);
  await logFunnel(req, FUNNEL_EVENTS.REFERRAL_LINK_GENERATED, userId);

  return NextResponse.json({
    ok: true,
    existingUser: false,
    referralCode: code,
    referralUrl: url,
    messages,
    infoMessage:
      "Te enviamos un correo para validar tu email. Para entrar a tu cuenta usá el inicio de sesión de fotógrafos y, si hace falta, recuperá la contraseña desde ahí.",
  });
}
