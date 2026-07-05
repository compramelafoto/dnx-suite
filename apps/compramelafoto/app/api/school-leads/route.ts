import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  schoolName: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(120),
  contactRole: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().toLowerCase().email().max(254).optional().or(z.literal("")),
  whatsapp: z.string().trim().min(6).max(40),
  approxStudents: z.union([z.number().int().min(0).max(100000), z.null()]).optional(),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  referralCode: z.string().trim().max(32).optional().or(z.literal("")),
});

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function normalizeWhatsapp(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.replace(/[^\d+]/g, "") || trimmed;
}

function countDigits(raw: string): number {
  return (raw.match(/\d/g) || []).length;
}

function normalizeOptionalString(value?: string | null): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function normalizeApproxStudents(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = Math.floor(value);
    return parsed >= 0 ? parsed : null;
  }
  const parsed = Number(String(value).trim());
  if (!Number.isFinite(parsed)) return null;
  const intParsed = Math.floor(parsed);
  return intParsed >= 0 ? intParsed : null;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = checkRateLimit({
    key: `school-leads:${ip}`,
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Recibimos muchas solicitudes desde esta red. Probá nuevamente en unos minutos." },
      { status: 429 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "No pudimos leer el formulario." }, { status: 400 });
  }

  const payload = typeof json === "object" && json !== null ? json : {};
  const referralCode = normalizeOptionalString((payload as { referralCode?: string }).referralCode);
  const parsed = bodySchema.safeParse({
    schoolName: (payload as { schoolName?: string }).schoolName,
    city: (payload as { city?: string }).city,
    contactName: (payload as { contactName?: string }).contactName,
    contactRole: (payload as { contactRole?: string }).contactRole ?? "",
    email: (payload as { email?: string }).email ?? "",
    whatsapp: (payload as { whatsapp?: string }).whatsapp,
    approxStudents: normalizeApproxStudents((payload as { approxStudents?: unknown }).approxStudents),
    message: (payload as { message?: string }).message ?? "",
    referralCode: referralCode ?? "",
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const message =
      fieldErrors.schoolName?.[0] ||
      fieldErrors.city?.[0] ||
      fieldErrors.contactName?.[0] ||
      fieldErrors.whatsapp?.[0] ||
      fieldErrors.email?.[0] ||
      "Revisá los datos del formulario.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const data = parsed.data;
  const normalizedWhatsapp = normalizeWhatsapp(data.whatsapp);
  if (countDigits(normalizedWhatsapp) < 8) {
    return NextResponse.json({ error: "Ingresá un WhatsApp válido." }, { status: 400 });
  }

  let referredByUserId: number | null = null;
  let referrerRole: Role | null = null;

  if (data.referralCode) {
    const referralOwner = await prisma.referralCode.findFirst({
      where: {
        code: data.referralCode,
        isActive: true,
        ownerUser: { role: { in: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER] } },
      },
      select: {
        ownerUserId: true,
        ownerUser: { select: { role: true } },
      },
    });

    if (referralOwner) {
      referredByUserId = referralOwner.ownerUserId;
      referrerRole = referralOwner.ownerUser.role;
    }
  }

  try {
    const created = await prisma.schoolLead.create({
      data: {
        schoolName: data.schoolName,
        city: data.city,
        contactName: data.contactName,
        contactRole: normalizeOptionalString(data.contactRole),
        email: normalizeOptionalString(data.email),
        whatsapp: normalizedWhatsapp,
        approxStudents: typeof data.approxStudents === "number" ? data.approxStudents : null,
        message: normalizeOptionalString(data.message),
        referralCode: data.referralCode || null,
        referredByUserId,
        referrerRole,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, leadId: created.id });
  } catch (err) {
    console.error("POST /api/school-leads:", err);
    return NextResponse.json({ error: "No se pudo guardar la solicitud." }, { status: 500 });
  }
}
