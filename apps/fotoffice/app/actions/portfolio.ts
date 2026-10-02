"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { IMAGE_PRESETS } from "@/lib/images/presets";
import { FOTOFFICE_R2_PREFIXES } from "@/lib/images/r2-key-policy";
import { deleteFotofficeR2Object, getFotofficeR2PublicUrl } from "@/lib/images/r2-client";
import { verifyUploadedImage } from "@/lib/images/r2-presign";
import { PORTFOLIO_MODULE_KEY } from "@/lib/portfolio/constants";
import { ensurePortfolio } from "@/lib/portfolio/repository";
import { canAcceptAnotherPhoto } from "@/lib/portfolio/upload-guard";
import { parseInstagramPostUrls } from "@/lib/portfolio/instagram";

/**
 * Todo lo que una persona puede hacer con su propio portfolio.
 *
 * Tres reglas que valen para las seis acciones:
 *
 * 1. **Nada llega del navegador salvo el contenido.** El portfolio se resuelve desde la sesión; no
 *    hay ningún parámetro con el que nombrar el portfolio de otro.
 * 2. **Toda consulta sobre una foto filtra por el portfolio de la sesión.** Un id ajeno no
 *    encuentra fila, y no encontrar fila devuelve error — no un no-op silencioso que deja a la
 *    persona creyendo que algo pasó.
 * 3. **El módulo apagado cierra todas las acciones.** No alcanza con esconder la pantalla.
 */

export type PortfolioActionResult = { ok: true } | { ok: false; error: string };
export type RegisterPhotoResult = { ok: true; photoId: string } | { ok: false; error: string };

const SIN_FICHA = "No encontramos tu ficha de socio.";
const MODULO_APAGADO = "Los portfolios no están habilitados en tu institución.";
const NO_ES_TUYA = "Esa foto no es de tu portfolio.";

/** Contexto común: sesión, ficha, módulo encendido y el portfolio ya creado. */
async function contextoDelPortfolio(): Promise<
  | { ok: true; workspaceId: string; memberId: string; portfolioId: string }
  | { ok: false; error: string }
> {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) return { ok: false, error: SIN_FICHA };

  if (!(await isModuleEnabledForWorkspace(context.workspace.id, PORTFOLIO_MODULE_KEY))) {
    return { ok: false, error: MODULO_APAGADO };
  }

  const portfolio = await ensurePortfolio({
    workspaceId: context.workspace.id,
    memberId: context.member.id,
    firstName: context.member.firstName,
    lastName: context.member.lastName,
  });

  return {
    ok: true,
    workspaceId: context.workspace.id,
    memberId: context.member.id,
    portfolioId: portfolio.id,
  };
}

function refrescarPantallas(): void {
  revalidatePath("/portal/portfolio");
}

/**
 * Registra en la base una foto que el navegador ya subió a R2.
 *
 * El orden importa: **primero se verifica el objeto subido, después se escribe**. El cliente dice
 * qué subió y el cliente miente; lo único que vale es lo que hay en R2. Un archivo que no pasa la
 * verificación se borra: si quedara, ocuparía lugar para siempre sin que nadie sepa que está.
 */
export async function registerPortfolioPhotoAction(input: {
  key: string;
  width: number;
  height: number;
}): Promise<RegisterPhotoResult> {
  const ctx = await contextoDelPortfolio();
  if (!ctx.ok) return ctx;

  const preset = IMAGE_PRESETS.memberPortfolioPhoto;

  /*
   * La key tiene que caer en el namespace de ESTA institución. Sin este chequeo, alguien podría
   * pedir una URL firmada para su propio workspace y después registrar la key de otro: la foto de
   * otra institución aparecería en su portfolio.
   */
  const prefijoPropio = `${FOTOFFICE_R2_PREFIXES.memberPortfolioPhoto}/${ctx.workspaceId}/`;
  if (!input.key.startsWith(prefijoPropio)) {
    return { ok: false, error: "No pudimos verificar el archivo subido." };
  }

  // Alto y ancho los lee el navegador; sin ellos la galería salta al cargar.
  if (!Number.isInteger(input.width) || !Number.isInteger(input.height) || input.width < 1 || input.height < 1) {
    return { ok: false, error: "No pudimos leer el tamaño de la imagen. Probá de nuevo." };
  }

  const cantidad = await prisma.fotofficeMemberPortfolioPhoto.count({
    where: { portfolioId: ctx.portfolioId },
  });
  const cupo = canAcceptAnotherPhoto(cantidad);
  if (!cupo.ok) return { ok: false, error: cupo.error };

  const verificacion = await verifyUploadedImage({
    key: input.key,
    maxFileSizeBytes: preset.maxFileSizeBytes,
    acceptedFormats: preset.acceptedFormats,
  });
  if (!verificacion.ok) {
    await deleteFotofficeR2Object(input.key);
    return { ok: false, error: verificacion.error };
  }

  const creada = await prisma.fotofficeMemberPortfolioPhoto.create({
    data: {
      portfolioId: ctx.portfolioId,
      r2Key: input.key,
      url: getFotofficeR2PublicUrl(input.key),
      contentType: verificacion.contentType,
      sizeBytes: verificacion.sizeBytes,
      width: input.width,
      height: input.height,
      order: cantidad,
    },
    select: { id: true },
  });

  // La primera foto queda destacada sola: pedirle a alguien que elija entre una sola opción es
  // pedirle un trámite.
  if (cantidad === 0) {
    await prisma.fotofficeMemberPortfolio.update({
      where: { id: ctx.portfolioId },
      data: { coverPhotoId: creada.id },
    });
  }

  refrescarPantallas();
  return { ok: true, photoId: creada.id };
}

/** Borra una foto del portfolio propio, de la base y de R2. */
export async function deletePortfolioPhotoAction(input: {
  photoId: string;
}): Promise<PortfolioActionResult> {
  const ctx = await contextoDelPortfolio();
  if (!ctx.ok) return ctx;

  const foto = await prisma.fotofficeMemberPortfolioPhoto.findFirst({
    where: { id: input.photoId, portfolioId: ctx.portfolioId },
    select: { id: true, r2Key: true, portfolioId: true },
  });
  if (!foto) return { ok: false, error: NO_ES_TUYA };

  const portfolio = await prisma.fotofficeMemberPortfolio.findFirst({
    where: { id: ctx.portfolioId },
    select: { id: true, coverPhotoId: true },
  });

  await prisma.fotofficeMemberPortfolioPhoto.delete({ where: { id: foto.id } });

  /*
   * Si era la destacada, la destacada pasa a ser la primera que queda. Dejar el portfolio sin
   * destacada lo saca del directorio por una razón que la persona no eligió.
   */
  if (portfolio?.coverPhotoId === foto.id) {
    const siguiente = await prisma.fotofficeMemberPortfolioPhoto.findFirst({
      where: { portfolioId: ctx.portfolioId },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    await prisma.fotofficeMemberPortfolio.update({
      where: { id: ctx.portfolioId },
      data: { coverPhotoId: siguiente?.id ?? null },
    });
  }

  // Después de la base: si R2 falla, la foto ya no se muestra y el objeto huérfano no rompe nada.
  await deleteFotofficeR2Object(foto.r2Key);

  refrescarPantallas();
  return { ok: true };
}

/** Elige cuál es la foto que representa a la persona en el directorio. */
export async function setPortfolioCoverAction(input: {
  photoId: string;
}): Promise<PortfolioActionResult> {
  const ctx = await contextoDelPortfolio();
  if (!ctx.ok) return ctx;

  const foto = await prisma.fotofficeMemberPortfolioPhoto.findFirst({
    where: { id: input.photoId, portfolioId: ctx.portfolioId },
    select: { id: true },
  });
  if (!foto) return { ok: false, error: NO_ES_TUYA };

  await prisma.fotofficeMemberPortfolio.update({
    where: { id: ctx.portfolioId },
    data: { coverPhotoId: foto.id },
  });

  refrescarPantallas();
  return { ok: true };
}

/**
 * Guarda el orden que eligió la persona arrastrando.
 *
 * Los ids ajenos se descartan en silencio en lugar de rechazar el lote entero: el orden llega de
 * una pantalla que acaba de leer la lista, y si alguien borró una foto en otra pestaña, hacer
 * fallar todo el reordenamiento por eso sería peor que ignorar ese id.
 */
export async function reorderPortfolioPhotosAction(input: {
  orderedIds: string[];
}): Promise<PortfolioActionResult> {
  const ctx = await contextoDelPortfolio();
  if (!ctx.ok) return ctx;

  const propias = await prisma.fotofficeMemberPortfolioPhoto.findMany({
    where: { portfolioId: ctx.portfolioId },
    select: { id: true },
  });
  const idsPropios = new Set(propias.map((f) => f.id));

  const aOrdenar = input.orderedIds.filter((id) => idsPropios.has(id));
  for (const [indice, id] of aOrdenar.entries()) {
    await prisma.fotofficeMemberPortfolioPhoto.update({
      where: { id },
      data: { order: indice },
    });
  }

  refrescarPantallas();
  return { ok: true };
}

/** El año más viejo admisible. Antes de eso no había fotografía. */
const ANIO_MINIMO = 1826;

/** Título y año de una foto. Los dos opcionales: una foto sin título es una foto válida. */
export async function updatePortfolioPhotoAction(input: {
  photoId: string;
  title: string | null;
  year: number | null;
}): Promise<PortfolioActionResult> {
  const ctx = await contextoDelPortfolio();
  if (!ctx.ok) return ctx;

  const foto = await prisma.fotofficeMemberPortfolioPhoto.findFirst({
    where: { id: input.photoId, portfolioId: ctx.portfolioId },
    select: { id: true },
  });
  if (!foto) return { ok: false, error: NO_ES_TUYA };

  const anioMaximo = new Date().getFullYear() + 1;
  if (input.year !== null && (input.year < ANIO_MINIMO || input.year > anioMaximo)) {
    return { ok: false, error: `El año tiene que estar entre ${ANIO_MINIMO} y ${anioMaximo}.` };
  }

  // Un título vacío es nulo, no una cadena vacía: si no, la ficha pública muestra un renglón hueco.
  const title = (input.title ?? "").trim() || null;

  await prisma.fotofficeMemberPortfolioPhoto.update({
    where: { id: foto.id },
    data: { title, year: input.year },
  });

  refrescarPantallas();
  return { ok: true };
}

/**
 * Prende o apaga la publicación.
 *
 * Publicar exige consentimiento y al menos una foto; **despublicar no exige nada**. Bajarse del
 * sitio tiene que poder hacerse siempre, sin condiciones: es la propia cara la que está ahí.
 */
export async function setPortfolioPublishedAction(input: {
  published: boolean;
}): Promise<PortfolioActionResult> {
  const ctx = await contextoDelPortfolio();
  if (!ctx.ok) return ctx;

  if (!input.published) {
    await prisma.fotofficeMemberPortfolio.update({
      where: { id: ctx.portfolioId },
      data: { memberPublished: false },
    });
    refrescarPantallas();
    return { ok: true };
  }

  const [ficha, cantidad] = await Promise.all([
    prisma.member.findFirst({
      where: { id: ctx.memberId, workspaceId: ctx.workspaceId },
      select: { directoryOptIn: true },
    }),
    prisma.fotofficeMemberPortfolioPhoto.count({ where: { portfolioId: ctx.portfolioId } }),
  ]);

  if (!ficha?.directoryOptIn) {
    return {
      ok: false,
      error:
        "Primero tenés que autorizar la publicación de tus datos profesionales, desde Mi perfil.",
    };
  }
  if (cantidad < 1) {
    return { ok: false, error: "Subí al menos una foto antes de publicar tu portfolio." };
  }

  await prisma.fotofficeMemberPortfolio.update({
    where: { id: ctx.portfolioId },
    data: {
      memberPublished: true,
      // Queda la fecha de la PRIMERA publicación. Despublicar y volver no la reescribe: es el dato
      // de cuándo esta persona se sumó al directorio.
      memberPublishedAt: new Date(),
    },
  });

  refrescarPantallas();
  return { ok: true };
}

/**
 * Los posteos de Instagram que el socio quiere mostrar, y si la franja se ve.
 *
 * El interruptor y los enlaces se guardan juntos aunque sean dos cosas: apagar la franja **no**
 * borra lo cargado. Quien la apaga por un tiempo no tiene que volver a pegar seis direcciones.
 */
export async function setPortfolioInstagramAction(input: {
  enabled: boolean;
  postUrls: string[];
}): Promise<PortfolioActionResult> {
  const ctx = await contextoDelPortfolio();
  if (!ctx.ok) return ctx;

  const parsed = parseInstagramPostUrls(input.postUrls);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  await prisma.fotofficeMemberPortfolio.update({
    where: { id: ctx.portfolioId },
    data: { instagramEnabled: input.enabled, instagramPostUrls: parsed.urls },
  });

  refrescarPantallas();
  return { ok: true };
}
