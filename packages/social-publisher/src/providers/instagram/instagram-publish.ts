import { createHash, randomUUID } from "node:crypto";
import { degradeMentionPlan, type MentionPlan } from "../../mentions";
import type { PublishAsset, PublishResult } from "../../types";
import { SocialPublisherError } from "../../types";
import type { ProviderPublishInput, SocialPublishProvider } from "../types";
import { createMetaGraphClient } from "./graph-client";

/** Consultas del estado del contenedor antes de publicar: 20 × 2 s = 40 s como mucho. */
const MAX_ESPERAS_CONTENEDOR = 20;
const ESPERA_CONTENEDOR_MS = 2000;

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

/** Meta tampoco tiene código propio para una etiqueta rechazada: se mira el mensaje. */
function esErrorDeEtiquetas(e: unknown): boolean {
  const msg = e instanceof Error ? e.message.toLowerCase() : "";
  return msg.includes("user_tags") || msg.includes("tag") || msg.includes("username");
}

/** Tope de pedidos a Meta para encontrar las etiquetas rechazadas en una historia. */
const MAX_INTENTOS_ETIQUETAS = 30;

/**
 * Crea el contenedor de una historia etiquetando a todos los que se pueda.
 *
 * Si Meta rechaza la lista (una cuenta que no existe o es privada), no se tira la lista
 * entera: se busca por mitades cuál falla y se saca solo esa. La primera de la lista (el
 * fotógrafo) se prueba sola primero para no perderla por culpa de otra. Con 20 cuentas
 * y una mala son unos 10 pedidos; los contenedores de prueba que no se publican no
 * cuentan para el cupo diario y Meta los descarta solo. La historia sale siempre: en el
 * peor caso, sin etiquetas.
 */
/** Separación vertical entre etiquetas cuando hay varias (≈ 67 px en una historia de 1920). */
const PASO_ETIQUETAS = 0.035;

const recortar = (v: number) => Math.round(Math.min(0.95, Math.max(0.05, v)) * 1000) / 1000;

/**
 * El valor de `user_tags` para Meta. Con ancla, cada etiqueta lleva su lugar: la primera
 * (el fotógrafo) en el ancla y las demás apiladas debajo, sin salirse de la imagen.
 */
export function userTagsParam(lista: string[], ancla?: { x: number; y: number } | null): string {
  return JSON.stringify(
    lista.map((username, i) =>
      ancla && Number.isFinite(ancla.x) && Number.isFinite(ancla.y)
        ? { username, x: recortar(ancla.x), y: recortar(ancla.y + i * PASO_ETIQUETAS) }
        : { username },
    ),
  );
}

export async function crearHistoriaConEtiquetas(
  crear: (body: Record<string, string>) => Promise<string>,
  base: Record<string, string>,
  etiquetas: string[],
  ancla?: { x: number; y: number } | null,
): Promise<{ id: string; dropped: string[]; conPosicion: boolean }> {
  if (ancla && etiquetas.length > 0) {
    // Primero con posición. Si Meta rechazara las coordenadas, la lista entera caería:
    // en ese caso se repite sin posición, que es como funcionaba antes.
    const con = await crearHistoriaConEtiquetasSinAncla(crear, base, etiquetas, ancla);
    if (con.dropped.length < etiquetas.length) return { ...con, conPosicion: true };
    const sin = await crearHistoriaConEtiquetasSinAncla(crear, base, etiquetas, null);
    return { ...sin, conPosicion: false };
  }
  return { ...(await crearHistoriaConEtiquetasSinAncla(crear, base, etiquetas, null)), conPosicion: false };
}

async function crearHistoriaConEtiquetasSinAncla(
  crear: (body: Record<string, string>) => Promise<string>,
  base: Record<string, string>,
  etiquetas: string[],
  ancla: { x: number; y: number } | null,
): Promise<{ id: string; dropped: string[] }> {
  let intentos = 0;
  let ultimoOk: { lista: string[]; id: string } | null = null;

  async function intentar(lista: string[]): Promise<string | null> {
    intentos++;
    try {
      const id = await crear(
        lista.length > 0
          ? { ...base, user_tags: userTagsParam(lista, ancla) }
          : base,
      );
      ultimoOk = { lista, id };
      return id;
    } catch (e) {
      if (lista.length === 0 || !esErrorDeEtiquetas(e)) throw e;
      return null;
    }
  }

  if (etiquetas.length === 0) return { id: (await intentar([]))!, dropped: [] };
  const todas = await intentar(etiquetas);
  if (todas) return { id: todas, dropped: [] };

  const buenas: string[] = [];
  const caidas: string[] = [];
  const [primera, ...resto] = etiquetas;
  if (await intentar([primera!])) buenas.push(primera!);
  else caidas.push(primera!);

  async function probar(grupo: string[]): Promise<void> {
    if (grupo.length === 0) return;
    if (intentos >= MAX_INTENTOS_ETIQUETAS) {
      caidas.push(...grupo);
      return;
    }
    if (await intentar([...buenas, ...grupo])) {
      buenas.push(...grupo);
      return;
    }
    if (grupo.length === 1) {
      caidas.push(grupo[0]!);
      return;
    }
    const mitad = Math.ceil(grupo.length / 2);
    await probar(grupo.slice(0, mitad));
    await probar(grupo.slice(mitad));
  }
  await probar(resto);

  const final = etiquetas.filter((e) => buenas.includes(e));
  const ok = ultimoOk as { lista: string[]; id: string } | null;
  if (ok && ok.lista.length === final.length && ok.lista.every((e) => final.includes(e))) {
    return { id: ok.id, dropped: etiquetas.filter((e) => !final.includes(e)) };
  }
  const id = (await intentar(final)) ?? (await intentar([]))!;
  // `ultimoOk` es el contenedor que acaba de crearse: con `final` o, si eso falló, sin etiquetas.
  const usadas = (ultimoOk as { lista: string[] } | null)?.lista ?? [];
  return { id, dropped: etiquetas.filter((e) => !usadas.includes(e)) };
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
  /** Para tests: reemplaza la espera entre consultas del estado del contenedor. */
  sleepImpl?: (ms: number) => Promise<void>;
}): SocialPublishProvider {
  const dormir = options?.sleepImpl ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
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

      async function esperarContenedor(id: string): Promise<void> {
        for (let intento = 0; intento < MAX_ESPERAS_CONTENEDOR; intento++) {
          const r = await client.request<{ status_code?: string; status?: string }>(
            `/${id}?fields=status_code,status`,
            { accessToken: input.accessToken },
          );
          // Sin `status_code` (respuestas viejas o de prueba) no hay nada que esperar.
          if (!r.status_code || r.status_code === "FINISHED" || r.status_code === "PUBLISHED") return;
          if (r.status_code === "ERROR" || r.status_code === "EXPIRED") {
            throw new SocialPublisherError(
              "CONTAINER_FAILED",
              `Meta no pudo procesar la imagen (${r.status_code}${r.status ? `: ${r.status}` : ""})`,
              true,
            );
          }
          await dormir(ESPERA_CONTENEDOR_MS);
        }
        throw new SocialPublisherError(
          "CONTAINER_TIMEOUT",
          "Meta tardó demasiado en procesar la imagen; se reintenta más tarde",
          true,
        );
      }

      let contenedorId: string;
      let droppedCollaborators: string[] = [];
      let etiquetasCaidas: string[] = [];
      let etiquetasConPosicion = false;

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
        // Meta no acepta caption ni colaboradores en historias, pero sí `user_tags`.
        const baseHistoria: Record<string, string> = {
          image_url: fotos[0]!.publicUrl as string,
          media_type: "STORIES",
        };
        const resultado = await crearHistoriaConEtiquetas(
          crearContenedor,
          baseHistoria,
          (input.userTags ?? []).filter(Boolean),
          input.userTagAnchor ?? null,
        );
        contenedorId = resultado.id;
        etiquetasCaidas = resultado.dropped;
        etiquetasConPosicion = resultado.conPosicion;
      } else {
        const baseImagen: Record<string, string> = {
          image_url: fotos[0]!.publicUrl as string,
          caption: input.caption,
        };
        const resultado = await crearConColaboradores(crearContenedor, baseImagen, colaboradores);
        contenedorId = resultado.id;
        droppedCollaborators = resultado.dropped;
      }

      // Meta procesa la imagen después de crear el contenedor. Publicar antes de que
      // termine da «Media ID is not available» (pasó con la primera historia real,
      // 2026-11-22): hay que esperar a que el contenedor diga FINISHED.
      await esperarContenedor(contenedorId);

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
          ...(etiquetasCaidas.length > 0 ? { droppedUserTags: etiquetasCaidas } : {}),
          ...(format === "STORY" ? { userTagsWithPosition: etiquetasConPosicion } : {}),
        },
      };
    },
  };
}
