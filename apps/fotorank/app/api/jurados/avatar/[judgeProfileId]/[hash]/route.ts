/**
 * Sirve la foto del jurado desde el bucket privado.
 *
 * La foto de un perfil es pública por naturaleza —se muestra en la landing del
 * concurso—, pero el archivo vive en el bucket privado: esta ruta es la que
 * decide qué se entrega, y sólo entrega la clave que ese perfil tiene guardada.
 */
import { prisma } from "@repo/db";

import {
  contentTypeForJudgeAvatarExtension,
  parseJudgeAvatarKey,
  type JudgeAvatarExtension,
} from "../../../../../lib/fotorank/judges/judgeAssetStorage";
import { getPrivateContestStorageProvider } from "../../../../../lib/fotorank/storage/provider";

type Ctx = { params: Promise<{ judgeProfileId: string; hash: string }> };

type ConLectura = { readObject(key: string): Promise<Uint8Array> };

function puedeLeer(p: unknown): p is ConLectura {
  return typeof (p as ConLectura).readObject === "function";
}

export async function GET(_req: Request, ctx: Ctx) {
  const { judgeProfileId, hash } = await ctx.params;

  const profile = await prisma.fotorankJudgeProfile.findUnique({
    where: { id: judgeProfileId },
    select: { avatarUrl: true },
  });
  if (!profile?.avatarUrl) return new Response("No encontrada", { status: 404 });

  const parsed = parseJudgeAvatarKey(profile.avatarUrl);
  if (!parsed) return new Response("No encontrada", { status: 404 });

  // El hash pedido tiene que ser el que este perfil tiene guardado: así una URL
  // vieja no sirve una foto nueva ni al revés.
  const pedido = hash.replace(/\.(jpg|png|webp)$/, "");
  if (pedido !== parsed.hash) return new Response("No encontrada", { status: 404 });

  const storage = getPrivateContestStorageProvider();
  if (!puedeLeer(storage)) return new Response("No disponible", { status: 503 });

  let bytes: Uint8Array;
  try {
    bytes = await storage.readObject(profile.avatarUrl);
  } catch {
    return new Response("No encontrada", { status: 404 });
  }

  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": contentTypeForJudgeAvatarExtension(parsed.ext as JudgeAvatarExtension),
      "Content-Length": String(bytes.byteLength),
      // El hash está en la ruta: si cambia la foto, cambia la URL.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
