"use server";

/**
 * El portfolio del jurado: subir, titular, ordenar y borrar.
 *
 * Todas las acciones verifican que la imagen sea del jurado que la pide. Sin
 * eso, cualquiera con el id de una imagen borraría las fotos de otro.
 */
import { revalidatePath } from "next/cache";

import { prisma } from "@repo/db";

import { requireJudgeAuth } from "../lib/judge-auth";
import {
  deletePortfolioImageByKey,
  savePortfolioImage,
} from "../lib/fotorank/judges/judgeAssetStorage";
import { PORTFOLIO_MAX_IMAGENES } from "../lib/fotorank/judges/portfolioKeys";
import {
  moverImagen,
  ordenParaNueva,
  ordenTrasBorrar,
} from "../lib/fotorank/judges/portfolioOrder";
import { portfolioImageSrc } from "../lib/fotorank/judges/portfolioSrc";

export type ResultadoPortfolio<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const TITULO_MAXIMO = 120;

/** El perfil del jurado que pide, con su slug para revalidar su página. */
async function perfilDelJurado(): Promise<
  { ok: true; profileId: string; judgeAccountId: string; publicSlug: string } | { ok: false; error: string }
> {
  const judge = await requireJudgeAuth();
  const perfil = await prisma.fotorankJudgeProfile.findUnique({
    where: { judgeAccountId: judge.id },
    select: { id: true, publicSlug: true },
  });
  if (!perfil) return { ok: false, error: "No se encontró tu perfil. Contactá soporte." };
  return { ok: true, profileId: perfil.id, judgeAccountId: judge.id, publicSlug: perfil.publicSlug };
}

function refrescar(publicSlug: string): void {
  revalidatePath("/jurado/perfil");
  revalidatePath(`/jurados/publico/${publicSlug}`);
  revalidatePath("/jurados/directorio");
}

export async function subirImagenDePortfolioAction(
  formData: FormData,
): Promise<ResultadoPortfolio<{ id: string; src: string }>> {
  const perfil = await perfilDelJurado();
  if (!perfil.ok) return perfil;

  const cuantas = await prisma.fotorankJudgePortfolioImage.count({
    where: { judgeProfileId: perfil.profileId },
  });
  // Se comprueba ANTES de tocar el bucket: subir un archivo que después se
  // rechaza deja basura que se paga.
  if (cuantas >= PORTFOLIO_MAX_IMAGENES) {
    return {
      ok: false,
      error: `Llegaste al máximo de ${PORTFOLIO_MAX_IMAGENES} imágenes. Borrá alguna para subir otra.`,
    };
  }

  const file = formData.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return { ok: false, error: "No se recibió ninguna imagen." };
  }
  const f = file as File;
  const ancho = Number(formData.get("width")) || null;
  const alto = Number(formData.get("height")) || null;

  const guardada = await savePortfolioImage({
    judgeAccountId: perfil.judgeAccountId,
    body: new Uint8Array(await f.arrayBuffer()),
    mime: f.type || "",
  });
  if (!guardada.ok) return { ok: false, error: guardada.error };

  let creada;
  try {
    creada = await prisma.fotorankJudgePortfolioImage.create({
      data: {
        judgeProfileId: perfil.profileId,
        storageKey: guardada.key,
        contentHash: guardada.hash,
        contentType: f.type,
        sizeBytes: guardada.sizeBytes,
        width: ancho,
        height: alto,
        // Al final de la fila. El orden se renumera solo al mover o borrar.
        sortOrder: ordenParaNueva(cuantas),
      },
      select: { id: true, storageKey: true, contentHash: true },
    });
  } catch (err) {
    // La fila falló pero el archivo ya está en el bucket: se borra, o queda
    // huérfano pagando espacio para siempre.
    await deletePortfolioImageByKey(guardada.key);
    console.error("[portfolio] no se pudo guardar la fila", err);
    return { ok: false, error: "No pudimos guardar la imagen. Probá de nuevo." };
  }

  refrescar(perfil.publicSlug);
  return { ok: true, data: { id: creada.id, src: portfolioImageSrc(creada) ?? "" } };
}

export async function borrarImagenDePortfolioAction(
  imageId: string,
): Promise<ResultadoPortfolio> {
  const perfil = await perfilDelJurado();
  if (!perfil.ok) return perfil;

  const imagen = await prisma.fotorankJudgePortfolioImage.findUnique({
    where: { id: imageId },
    select: { id: true, judgeProfileId: true, storageKey: true },
  });
  // Un id ajeno se trata como inexistente: no se confirma que exista.
  if (!imagen || imagen.judgeProfileId !== perfil.profileId) {
    return { ok: false, error: "No encontramos esa imagen." };
  }

  const resto = await prisma.fotorankJudgePortfolioImage.findMany({
    where: { judgeProfileId: perfil.profileId },
    select: { id: true, sortOrder: true },
  });
  const ordenNuevo = ordenTrasBorrar(resto, imageId);

  await prisma.$transaction([
    prisma.fotorankJudgePortfolioImage.delete({ where: { id: imageId } }),
    ...ordenNuevo.map((img) =>
      prisma.fotorankJudgePortfolioImage.update({
        where: { id: img.id },
        data: { sortOrder: img.sortOrder },
      }),
    ),
  ]);

  // El objeto se borra después de la fila: si esto falla, queda un huérfano,
  // pero la pantalla ya es coherente.
  await deletePortfolioImageByKey(imagen.storageKey);

  refrescar(perfil.publicSlug);
  return { ok: true };
}

export async function moverImagenDePortfolioAction(
  imageId: string,
  hacia: "arriba" | "abajo",
): Promise<ResultadoPortfolio> {
  const perfil = await perfilDelJurado();
  if (!perfil.ok) return perfil;

  const imagenes = await prisma.fotorankJudgePortfolioImage.findMany({
    where: { judgeProfileId: perfil.profileId },
    select: { id: true, sortOrder: true },
  });
  if (!imagenes.some((i) => i.id === imageId)) {
    return { ok: false, error: "No encontramos esa imagen." };
  }

  const ordenNuevo = moverImagen(imagenes, imageId, hacia);
  await prisma.$transaction(
    ordenNuevo.map((img) =>
      prisma.fotorankJudgePortfolioImage.update({
        where: { id: img.id },
        data: { sortOrder: img.sortOrder },
      }),
    ),
  );

  refrescar(perfil.publicSlug);
  return { ok: true };
}

export async function ponerTituloAImagenAction(
  imageId: string,
  titulo: string,
): Promise<ResultadoPortfolio> {
  const perfil = await perfilDelJurado();
  if (!perfil.ok) return perfil;

  const imagen = await prisma.fotorankJudgePortfolioImage.findUnique({
    where: { id: imageId },
    select: { judgeProfileId: true },
  });
  if (!imagen || imagen.judgeProfileId !== perfil.profileId) {
    return { ok: false, error: "No encontramos esa imagen." };
  }

  await prisma.fotorankJudgePortfolioImage.update({
    where: { id: imageId },
    data: { title: titulo.trim().slice(0, TITULO_MAXIMO) || null },
  });

  refrescar(perfil.publicSlug);
  return { ok: true };
}
