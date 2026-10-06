import "server-only";
import { prisma } from "@repo/db";
import type { ContentPostUpdateInput } from "@repo/content";
import { updateBlogPost } from "./admin-queries";
import { blogWhere } from "./scope";
import { uploadBlogImage } from "./storage";
import {
  collectImageSources,
  externalImageHosts,
  isExternalBlogImage,
  replaceImageSources,
  type JSONContent,
} from "./localize-images-core";

/**
 * Trae al almacenamiento de FOTOFFICE las imágenes del blog que todavía viven en otro sitio.
 *
 * Existe por las instituciones que migran su blog: los artículos se importan apuntando a las
 * fotos donde estaban (el CDN de Alboom), así se ven iguales desde el primer momento. Pero si
 * la institución da de baja ese sitio, las fotos desaparecen. Esto las copia y reescribe los
 * artículos para que usen la copia.
 *
 * Se hace por tandas: cada foto se descarga y se sube, y una función del servidor tiene un
 * tiempo máximo. Quien llama repite hasta que no quedan pendientes.
 */

export type LocalizeReport = { copiadas: number; fallidas: { url: string; motivo: string }[]; pendientes: number };

const MAX_BYTES = 8 * 1024 * 1024;

async function externasPorArticulo(workspaceId: string) {
  const posts = await prisma.blogPost.findMany({
    where: blogWhere(workspaceId),
    select: { id: true, heroImageUrl: true, contentJson: true },
  });
  return posts.map((p) => ({
    id: p.id,
    hero: p.heroImageUrl && isExternalBlogImage(p.heroImageUrl) ? p.heroImageUrl : null,
    cuerpo: collectImageSources(p.contentJson as JSONContent).filter(isExternalBlogImage),
    contentJson: p.contentJson as JSONContent,
    heroImageUrl: p.heroImageUrl,
  }));
}

/** Cuántas imágenes distintas quedan afuera. Para mostrar el aviso en la lista. */
export async function countExternalBlogImages(workspaceId: string): Promise<number> {
  const posts = await externasPorArticulo(workspaceId);
  return new Set(posts.flatMap((p) => [p.hero, ...p.cuerpo].filter(Boolean))).size;
}

async function descargar(url: string): Promise<{ bytes: Uint8Array; tipo: string; nombre: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: "follow" });
  if (!res.ok) throw new Error(`respondió ${res.status}`);
  const tipo = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!/^image\/(jpeg|png|webp)$/.test(tipo)) throw new Error(`no es una imagen admitida (${tipo || "sin tipo"})`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error("pesa más de 8 MB");
  const nombre = decodeURIComponent(new URL(url).pathname.split("/").pop() || "imagen");
  return { bytes: buf, tipo, nombre };
}

export async function localizeBlogImages(workspaceId: string, opts: { limit?: number } = {}): Promise<LocalizeReport> {
  const limite = opts.limit ?? 12;
  const posts = await externasPorArticulo(workspaceId);
  const portadas = new Set(posts.map((p) => p.hero).filter((u): u is string => Boolean(u)));
  const todas = [...new Set(posts.flatMap((p) => [p.hero, ...p.cuerpo].filter((u): u is string => Boolean(u))))];

  const reemplazos = new Map<string, string>();
  const fallidas: LocalizeReport["fallidas"] = [];
  for (const url of todas.slice(0, limite)) {
    try {
      const { bytes, tipo, nombre } = await descargar(url);
      const subida = await uploadBlogImage({
        workspaceId,
        kind: portadas.has(url) ? "hero" : "media",
        bytes,
        filename: nombre,
        mimeType: tipo,
      });
      if (!subida.ok) throw new Error(subida.error);
      reemplazos.set(url, subida.url);
    } catch (error) {
      fallidas.push({ url, motivo: error instanceof Error ? error.message : String(error) });
    }
  }

  // Cada artículo se guarda con el motor, que regenera el HTML y la imagen para redes.
  for (const p of posts) {
    const tocaHero = p.heroImageUrl ? reemplazos.has(p.heroImageUrl) : false;
    const tocaCuerpo = p.cuerpo.some((u) => reemplazos.has(u));
    if (!tocaHero && !tocaCuerpo) continue;
    // Sólo los dos campos que cambian. No pasa por `parseContentPostUpdate`: ese esquema completa
    // con vacío lo que no recibe (resumen, textos para Google, etiquetas) y los borraría.
    const cambio = {
      ...(tocaCuerpo ? { contentJson: replaceImageSources(p.contentJson, reemplazos) } : {}),
      ...(tocaHero ? { heroImageUrl: reemplazos.get(p.heroImageUrl as string) ?? null } : {}),
    } as unknown as ContentPostUpdateInput;
    await updateBlogPost(workspaceId, p.id, cambio);
  }

  // Pendientes = las que esta tanda no llegó a intentar. Las que fallaron se informan aparte:
  // contarlas como pendientes haría que quien repite tandas no termine nunca.
  return { copiadas: reemplazos.size, fallidas, pendientes: Math.max(todas.length - limite, 0) };
}

export { externalImageHosts };
