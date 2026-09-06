import { createHash, randomUUID } from "node:crypto";
import { degradeMentionPlan, type MentionPlan } from "../../mentions";
import type { PublishAsset, PublishResult } from "../../types";
import { SocialPublisherError } from "../../types";
import type { ProviderPublishInput, SocialPublishProvider } from "../types";
import { createMetaGraphClient } from "./graph-client";

/** Piso de fotos para que un carrusel tenga sentido. */
const CAROUSEL_MIN = 2;
/** Tope de Meta para un carrusel. */
const CAROUSEL_MAX = 10;

function assetsConUrl(assets: PublishAsset[]): PublishAsset[] {
  return [...assets]
    .filter((a) => Boolean(a.publicUrl))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** Meta no tiene un código propio para esto; el mensaje es lo único que lo distingue. */
function esErrorDeColaboradores(e: unknown): boolean {
  const msg = e instanceof Error ? e.message.toLowerCase() : "";
  return msg.includes("collaborator");
}

/**
 * Crea el contenedor bajando un colaborador por intento.
 *
 * Instagram no documenta un límite estable (3, 4 o 5 según la época y el tipo de cuenta),
 * así que en vez de adivinar el número se prueba y se degrada. Quien se cae de la etiqueta
 * vuelve en `dropped` para que el motor lo sume al copy: nadie desaparece.
 */
async function crearConColaboradores(
  crear: (body: Record<string, string>) => Promise<string>,
  base: Record<string, string>,
  colaboradores: string[],
): Promise<{ id: string; dropped: string[] }> {
  let plan: MentionPlan | null = { collaborators: colaboradores, captionMentions: [] };
  let ultimoError: unknown = null;

  while (plan) {
    const body = { ...base };
    if (plan.collaborators.length > 0) {
      body.collaborators = JSON.stringify(plan.collaborators);
    }
    try {
      return { id: await crear(body), dropped: plan.captionMentions };
    } catch (e) {
      if (!esErrorDeColaboradores(e)) throw e;
      ultimoError = e;
      plan = degradeMentionPlan(plan);
    }
  }
  throw ultimoError;
}

/**
 * Instagram Content Publishing API (imagen sola, carrusel e historia).
 * create media container(s) → publish → permalink.
 * Dry-run por defecto cuando no hay LIVE.
 */
export function createInstagramPublishProvider(options?: {
  apiVersion?: string;
  fetchImpl?: typeof fetch;
}): SocialPublishProvider {
  const client = createMetaGraphClient({
    apiVersion: options?.apiVersion,
    fetchImpl: options?.fetchImpl,
  });

  return {
    platform: "INSTAGRAM",
    async publish(input: ProviderPublishInput): Promise<PublishResult> {
      const format = input.format ?? "SINGLE_IMAGE";
      const fotos = assetsConUrl(input.assets);

      if (fotos.length === 0) {
        throw new SocialPublisherError(
          "ASSET_URL_REQUIRED",
          "Instagram requiere publicUrl del asset",
          false,
        );
      }
      if (input.account.status !== "ACTIVE") {
        throw new SocialPublisherError("ACCOUNT_INACTIVE", "Cuenta social no activa", false);
      }
      if (format === "CAROUSEL" && fotos.length < CAROUSEL_MIN) {
        throw new SocialPublisherError(
          "CAROUSEL_TOO_FEW_ITEMS",
          `CAROUSEL_TOO_FEW_ITEMS: un carrusel necesita al menos ${CAROUSEL_MIN} fotos`,
          false,
        );
      }
      if (format === "CAROUSEL" && fotos.length > CAROUSEL_MAX) {
        throw new SocialPublisherError(
          "CAROUSEL_TOO_MANY_ITEMS",
          `CAROUSEL_TOO_MANY_ITEMS: un carrusel admite hasta ${CAROUSEL_MAX} fotos`,
          false,
        );
      }

      if (input.dryRun) {
        const hash = createHash("sha256")
          .update(fotos.map((f) => f.publicUrl).join("|"))
          .update(input.caption)
          .update(format)
          .digest("hex")
          .slice(0, 16);
        return {
          ok: true,
          dryRun: true,
          externalMediaId: `dry_media_${hash}`,
          externalPostId: `dry_post_${randomUUID().slice(0, 8)}`,
          permalink: `https://www.instagram.com/p/dry_${hash}/`,
          providerRawSanitized: { mode: "dry_run", format },
        };
      }

      const igUserId = input.account.externalAccountId;
      const colaboradores = (input.collaborators ?? []).filter(Boolean);

      async function crearContenedor(body: Record<string, string>): Promise<string> {
        const r = await client.request<{ id: string }>(`/${igUserId}/media`, {
          method: "POST",
          accessToken: input.accessToken,
          form: true,
          body,
        });
        return r.id;
      }

      let contenedorId: string;
      let droppedCollaborators: string[] = [];

      if (format === "CAROUSEL") {
        // Los hijos van pelados: caption y collaborators en un hijo hacen fallar
        // la publicación entera.
        const hijos: string[] = [];
        for (const foto of fotos) {
          hijos.push(
            await crearContenedor({
              image_url: foto.publicUrl as string,
              is_carousel_item: "true",
            }),
          );
        }
        const basePadre: Record<string, string> = {
          media_type: "CAROUSEL",
          children: hijos.join(","),
          caption: input.caption,
        };
        const resultado = await crearConColaboradores(crearContenedor, basePadre, colaboradores);
        contenedorId = resultado.id;
        droppedCollaborators = resultado.dropped;
      } else if (format === "STORY") {
        // Meta no acepta caption ni colaboradores en historias.
        contenedorId = await crearContenedor({
          image_url: fotos[0]!.publicUrl as string,
          media_type: "STORIES",
        });
      } else {
        const baseImagen: Record<string, string> = {
          image_url: fotos[0]!.publicUrl as string,
          caption: input.caption,
        };
        const resultado = await crearConColaboradores(crearContenedor, baseImagen, colaboradores);
        contenedorId = resultado.id;
        droppedCollaborators = resultado.dropped;
      }

      const published = await client.request<{ id: string }>(`/${igUserId}/media_publish`, {
        method: "POST",
        accessToken: input.accessToken,
        form: true,
        body: { creation_id: contenedorId },
      });

      let permalink: string | null = null;
      try {
        const conCampos = await client.request<{ permalink?: string }>(
          `/${published.id}?fields=permalink`,
          { accessToken: input.accessToken },
        );
        permalink = conCampos.permalink ?? null;
      } catch {
        permalink = null;
      }

      return {
        ok: true,
        dryRun: false,
        externalMediaId: contenedorId,
        externalPostId: published.id,
        permalink,
        providerRawSanitized: {
          containerId: contenedorId,
          mediaId: published.id,
          format,
          ...(droppedCollaborators.length > 0 ? { droppedCollaborators } : {}),
        },
      };
    },
  };
}
