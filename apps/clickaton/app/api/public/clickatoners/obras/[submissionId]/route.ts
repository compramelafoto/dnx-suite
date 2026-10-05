/**
 * Una obra de un clickatoner, en su versión de vista previa (1280 px).
 *
 * Nunca el original: la vista previa alcanza para mirarla y el original es el archivo que el
 * participante entregó. Sólo sale una obra admitida, de una edición con resultados publicados y
 * de alguien que hoy puede aparecer.
 */
import { NextResponse } from "next/server";
import { servableSubmissionKey } from "@/lib/clickatoner/repository";
import { getPrivateEntryStorage } from "@/lib/photo-upload/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ submissionId: string }> };

function notFound() {
  return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
}

export async function GET(_request: Request, { params }: Params) {
  const { submissionId } = await params;
  if (!submissionId) return notFound();

  const key = await servableSubmissionKey(submissionId);
  if (!key) return notFound();

  try {
    const body = await getPrivateEntryStorage().get(key);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
