import { NextResponse } from "next/server";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { PhotoUploadError } from "@/lib/photo-upload/errors";
import { requestDirectUploadTicket } from "@/lib/photo-upload/service";

/**
 * Permiso para depositar la foto directo en el bucket.
 *
 * La foto de una cámara pesa más de lo que la plataforma deja pasar por una
 * función (4,5 MB), así que el archivo no viaja por acá: sólo el permiso. El
 * servidor la baja después, del lado de adentro, y la valida igual que siempre.
 *
 * Responde `{ ticket: null }` cuando el bucket no está configurado; el cliente
 * cae entonces al envío por el servidor, que sigue existiendo.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ registrationId: string; promptId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await getClickatonAuthUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { registrationId, promptId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    fileName?: string;
    contentType?: string;
  };

  try {
    const ticket = await requestDirectUploadTicket({
      registrationId,
      promptId,
      userId: user.id,
      fileName: String(body.fileName ?? ""),
      declaredMime: String(body.contentType ?? ""),
    });
    return NextResponse.json({ ticket }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof PhotoUploadError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    throw error;
  }
}
