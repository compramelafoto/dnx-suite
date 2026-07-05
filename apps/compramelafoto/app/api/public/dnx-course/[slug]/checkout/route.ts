import { NextResponse } from "next/server";
import { createPreference, mercadoPagoAccessTokenIsTestCredential } from "@/lib/mercadopago";
import { prisma } from "@/lib/prisma";
import {
  DNX_FOTO_BASICA_FUNES_COURSE_KEY,
  DNX_FOTO_BASICA_FUNES_MAX_SEATS,
  DNX_FOTO_BASICA_FUNES_PRICE_ARS,
  DNX_FOTO_BASICA_PENDING_HOLD_MS,
  resolveDnxCourseMpAccessToken,
  logDnxCourseMpTokenMissing,
  isDnxFotoBasicaFunesSlug,
  normalizeDnxEnrollmentEmail,
} from "@/lib/dnx-foto-basica-funes";
import { countOccupiedCourseSeats } from "@/lib/dnx-foto-basica-funes-seats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MP_TITLE = "Curso presencial Fotografía Básica — DNX Estudio (Funes)";

function buildCourseMpPreferenceArgs(enrollmentId: number) {
  return {
    title: MP_TITLE,
    total: DNX_FOTO_BASICA_FUNES_PRICE_ARS,
    externalReference: String(enrollmentId),
    metadata: {
      orderType: "DNX_COURSE_ENROLLMENT" as const,
      orderId: enrollmentId,
      courseKey: DNX_FOTO_BASICA_FUNES_COURSE_KEY,
      internalNoPlatformFee: true,
    },
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isDnxFotoBasicaFunesSlug(slug)) {
    return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
  }

  const accessToken = await resolveDnxCourseMpAccessToken();
  if (!accessToken) {
    logDnxCourseMpTokenMissing("POST /checkout", { slug });
    return NextResponse.json(
      { error: "El cobro del curso no está configurado. Contactá al organizador." },
      { status: 503 }
    );
  }

  if (process.env.NODE_ENV === "production" && mercadoPagoAccessTokenIsTestCredential(accessToken)) {
    console.error(
      "[dnx-course/checkout] SANDBOX CREDENTIAL: en producción MP_ACCESS_TOKEN no puede usar prefijo TEST-. Configurá en Vercel el Access Token de producción (APP_USR-…).",
      { slug, tokenPrefix: accessToken.slice(0, Math.min(24, accessToken.length)) }
    );
    return NextResponse.json(
      {
        error:
          "El pago no está disponible: Mercado Pago está en modo prueba en el servidor. Contactá al organizador.",
        code: "MP_SANDBOX_CREDENTIALS_IN_PRODUCTION",
      },
      { status: 503 }
    );
  }

  const courseMpOptions = {
    accessTokenOverride: accessToken,
    forbidSandboxCheckoutUrl: process.env.NODE_ENV === "production",
  };

  const body = await req.json().catch(() => ({}));
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (firstName.length < 2) {
    return NextResponse.json({ error: "Indicá un nombre válido." }, { status: 400 });
  }
  if (lastName.length < 2) {
    return NextResponse.json({ error: "Indicá un apellido válido." }, { status: 400 });
  }
  if (!email.includes("@") || email.length < 5) {
    return NextResponse.json({ error: "Indicá un email válido." }, { status: 400 });
  }
  if (phone.length < 6) {
    return NextResponse.json({ error: "Indicá un teléfono de contacto." }, { status: 400 });
  }

  const courseKey = DNX_FOTO_BASICA_FUNES_COURSE_KEY;
  const emailNorm = normalizeDnxEnrollmentEmail(email);
  const pendingCutoff = new Date(Date.now() - DNX_FOTO_BASICA_PENDING_HOLD_MS);

  try {
    const alreadyApproved = await prisma.dnxCourseEnrollment.findFirst({
      where: { courseKey, email: emailNorm, status: "APPROVED" },
      select: { id: true },
    });
    if (alreadyApproved) {
      return NextResponse.json(
        { error: "Ya estás inscripto en este curso con ese email." },
        { status: 409 }
      );
    }

    const occupied = await countOccupiedCourseSeats(courseKey);
    if (occupied >= DNX_FOTO_BASICA_FUNES_MAX_SEATS) {
      return NextResponse.json(
        { error: "Cupo completo. Consultá por WhatsApp por posibles nuevas fechas." },
        { status: 409 }
      );
    }

    const reuse = await prisma.dnxCourseEnrollment.findFirst({
      where: {
        courseKey,
        email: emailNorm,
        status: "PENDING_PAYMENT",
        createdAt: { gt: pendingCutoff },
        mpInitPoint: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        mpInitPoint: true,
        mpPreferenceId: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });
    if (reuse?.mpInitPoint) {
      const samePerson =
        reuse.firstName === firstName && reuse.lastName === lastName && reuse.phone === phone;
      if (samePerson) {
        // Regenerar preferencia: no devolver mpInitPoint viejo (p. ej. sandbox de un intento anterior).
        const { initPoint, preferenceId } = await createPreference(
          buildCourseMpPreferenceArgs(reuse.id),
          courseMpOptions
        );
        await prisma.dnxCourseEnrollment.update({
          where: { id: reuse.id },
          data: { mpPreferenceId: preferenceId, mpInitPoint: initPoint },
        });
        return NextResponse.json({
          initPoint,
          enrollmentId: reuse.id,
          preferenceId,
          reused: true,
        });
      }
    }

    const enrollment = await prisma.$transaction(async (tx) => {
      const occ = await tx.dnxCourseEnrollment.count({
        where: {
          courseKey,
          OR: [
            { status: "APPROVED" },
            { status: "PENDING_PAYMENT", createdAt: { gt: pendingCutoff } },
          ],
        },
      });
      if (occ >= DNX_FOTO_BASICA_FUNES_MAX_SEATS) {
        throw new Error("CUPO_FULL");
      }
      return tx.dnxCourseEnrollment.create({
        data: {
          courseKey,
          firstName,
          lastName,
          email: emailNorm,
          phone,
          status: "PENDING_PAYMENT",
          amountArs: DNX_FOTO_BASICA_FUNES_PRICE_ARS,
        },
        select: { id: true },
      });
    });

    console.info("[dnx-course/checkout] Creando preferencia MP", {
      slug,
      enrollmentId: enrollment.id,
      amountArs: DNX_FOTO_BASICA_FUNES_PRICE_ARS,
      marketplaceFee: null,
      orderType: "DNX_COURSE_ENROLLMENT",
    });

    const { initPoint, preferenceId } = await createPreference(
      buildCourseMpPreferenceArgs(enrollment.id),
      courseMpOptions
    );

    await prisma.dnxCourseEnrollment.update({
      where: { id: enrollment.id },
      data: { mpPreferenceId: preferenceId, mpInitPoint: initPoint },
    });

    return NextResponse.json({
      initPoint,
      enrollmentId: enrollment.id,
      preferenceId,
      reused: false,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "CUPO_FULL") {
      return NextResponse.json(
        { error: "Cupo completo. Consultá por WhatsApp por posibles nuevas fechas." },
        { status: 409 }
      );
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("DNX course checkout:", { message: msg, err: e });

    const payload: { error: string; details?: string; code?: string } = {
      error: "No se pudo iniciar el pago. Intentá de nuevo.",
    };

    // En prod también damos pistas seguras (sin volcar respuestas crudas de MP).
    if (
      msg.startsWith("Mercado Pago devolvió solo") ||
      msg.startsWith("La URL de pago es de sandbox") ||
      msg.startsWith("Mercado Pago: credencial de prueba") ||
      msg.startsWith("Mercado Pago no retornó init_point")
    ) {
      payload.details = msg;
      payload.code = "MP_CHECKOUT_BLOCKED";
    } else if (msg.startsWith("Error creando preferencia en Mercado Pago")) {
      payload.details =
        "Mercado Pago rechazó crear la preferencia. Revisá en Vercel que MP_ACCESS_TOKEN sea el Access Token de producción (APP_USR-…), no la Public Key ni credenciales de prueba. En Logs buscá «MP CREATE PREFERENCE ERROR».";
      payload.code = "MP_PREFERENCE_REJECTED";
    } else if (process.env.NODE_ENV === "development") {
      payload.details = msg;
    }

    return NextResponse.json(payload, { status: 500 });
  }
}
