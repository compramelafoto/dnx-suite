import { NextResponse } from "next/server";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { PhotoUploadError } from "@/lib/photo-upload/errors";
import {
  processPromptUpload,
  processPromptUploadFromInbox,
} from "@/lib/photo-upload/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ registrationId: string; promptId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await getClickatonAuthUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { registrationId, promptId } = await ctx.params;

  // Dos caminos hacia el mismo procesamiento:
  //
  // - JSON con `inboxKey`: la foto ya está en el bucket, subida directo por el
  //   navegador. Es el camino de las fotos de cámara, que superan el tope de
  //   4,5 MB que la plataforma impone al cuerpo de una petición.
  // - multipart: el archivo viaja acá. Sigue siendo válido para fotos chicas y
  //   es la red de seguridad si el bucket no está disponible.
  const esDirecta = (req.headers.get("content-type") ?? "").includes("application/json");

  try {
    if (esDirecta) {
      const body = (await req.json().catch(() => ({}))) as {
        inboxKey?: string;
        fileName?: string;
        contentType?: string;
        replace?: boolean;
      };
      if (!body.inboxKey) {
        return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
      }
      const data = await processPromptUploadFromInbox({
        registrationId,
        promptId,
        userId: user.id,
        inboxKey: body.inboxKey,
        originalFileName: body.fileName || "photo.jpg",
        declaredMime: body.contentType,
        isReplace: Boolean(body.replace),
      });
      return NextResponse.json(data, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const isReplace = String(form.get("replace") ?? "") === "1";

    const data = await processPromptUpload({
      registrationId,
      promptId,
      userId: user.id,
      buffer,
      originalFileName: file.name || "photo.jpg",
      declaredMime: file.type,
      isReplace,
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof PhotoUploadError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    throw error;
  }
}
