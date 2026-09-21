import { NextResponse } from "next/server";
import { createCourseEnrollmentCheckout } from "@/lib/presential-courses/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Abre el pago de una inscripción.
 *
 * Toda la lógica vive en `lib/presential-courses/checkout.ts`: acá sólo se validan los datos
 * que llegan y se traduce el resultado a una respuesta. La ruta conserva su dirección para no
 * romper el botón que ya está publicado.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    enrollmentId?: string;
    workspaceSlug?: string;
    courseSlug?: string;
  };
  const enrollmentId = body.enrollmentId?.trim();
  const workspaceSlug = body.workspaceSlug?.trim();
  const courseSlug = body.courseSlug?.trim();
  if (!enrollmentId || !workspaceSlug || !courseSlug) {
    return NextResponse.json({ error: "Faltan datos de la inscripción." }, { status: 400 });
  }

  const resultado = await createCourseEnrollmentCheckout({
    enrollmentId,
    workspaceSlug,
    courseSlug,
  });
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 400 });
  }
  return NextResponse.json({ checkoutUrl: resultado.checkoutUrl }, { status: 200 });
}
