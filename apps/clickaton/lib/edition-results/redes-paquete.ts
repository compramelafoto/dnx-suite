import "server-only";

import { prisma } from "@/lib/admin/db";
import { getPrivateEntryStorage } from "@/lib/photo-upload/storage";

import { porConsigna } from "./armar-resultados";
import { cargarResultadosDeEdicion, type ResultadosConAutores } from "./cargar-resultados";
import { aleatorioConSemilla, armarCopy, mezclarPlantillas } from "./redes-copys";
import { fichaParaRedes, fotoParaRedes } from "./redes-ficha";
import {
  instagramConArroba,
  nombreDeArchivo,
  nombreDeCarpeta,
  pasaElFiltro,
  separarPublicables,
  type FiltroDeResultados,
  type ObraParaRedes,
} from "./redes-seleccion";

/**
 * El paquete para redes de una edición: qué carpetas, qué archivos y qué copy.
 *
 * El servidor arma la lista y cada imagen por separado; el ZIP se arma en el
 * navegador, porque una función de Vercel no puede responder más de 4,5 MB.
 */

export type ArchivoDelPaquete = { snapshotId: string; tipo: "foto" | "ficha"; nombre: string };

export type CarpetaDelPaquete = {
  carpeta: string;
  copy: string;
  /** Avisos para quien publica; van en un archivo aparte para que no se peguen en el posteo. */
  notas: string[];
  archivos: ArchivoDelPaquete[];
};

export type ExcluidaDelPaquete = { consigna: string; puesto: number; nombre: string; motivo: string };

export type PaqueteParaRedes = {
  edicion: string;
  carpetas: CarpetaDelPaquete[];
  excluidas: ExcluidaDelPaquete[];
};

type Consigna = { id: string; sequence: number; title: string | null; titleSnapshot: string | null };

function tituloDe(c: Consigna | undefined): string | null {
  return c?.title?.trim() || c?.titleSnapshot?.trim() || null;
}

/*
 * Una descarga pide la lista y después dos imágenes por obra: sin esto, cada
 * imagen recalcularía el ranking entero de la edición. Medio minuto alcanza
 * para una descarga y no deja ver un ranking viejo.
 */
const cache = new Map<string, { hasta: number; datos: Promise<ResultadosConAutores | null> }>();
function resultadosRecientes(editionId: string): Promise<ResultadosConAutores | null> {
  const ahora = Date.now();
  const guardado = cache.get(editionId);
  if (guardado && guardado.hasta > ahora) return guardado.datos;
  const datos = cargarResultadosDeEdicion(editionId);
  cache.set(editionId, { hasta: ahora + 30_000, datos });
  datos.catch(() => cache.delete(editionId));
  return datos;
}

export function obrasParaRedes(resultados: ResultadosConAutores): ObraParaRedes[] {
  return resultados.filas.map((f) => ({
    snapshotId: f.snapshotId,
    submissionId: f.autor?.submissionId ?? null,
    consignaId: f.promptExternalId,
    puesto: f.puesto,
    nota: f.nota,
    anonymousCode: f.anonymousCode,
    nombre: f.autor?.nombre ?? "Sin datos de inscripción",
    numero: f.autor?.numero ?? null,
    instagram: f.autor?.instagram ?? null,
    autorizaRedes: f.autor?.autorizaRedes ?? false,
  }));
}

export async function armarPaqueteParaRedes(
  editionId: string,
  filtro: FiltroDeResultados,
  semilla = Date.now(),
): Promise<PaqueteParaRedes | null> {
  const [edicion, resultados, consignas] = await Promise.all([
    prisma.clickatonEdition.findUnique({ where: { id: editionId }, select: { name: true } }),
    resultadosRecientes(editionId),
    prisma.clickatonPrompt.findMany({
      where: { editionId },
      orderBy: { sequence: "asc" },
      select: { id: true, sequence: true, title: true, titleSnapshot: true },
    }),
  ]);
  if (!edicion || !resultados) return null;

  const consignaPorId = new Map(consignas.map((c) => [c.id, c]));
  const azar = aleatorioConSemilla(semilla);
  const turnos = mezclarPlantillas(azar);
  const carpetas: CarpetaDelPaquete[] = [];
  const excluidas: ExcluidaDelPaquete[] = [];

  const filas = resultados.filas.filter((f) => pasaElFiltro(f, filtro));
  const obras = obrasParaRedes({ ...resultados, filas });
  const grupos = porConsigna(obras.map((o) => ({ ...o, promptExternalId: o.consignaId })), consignas);

  for (const grupo of grupos) {
    if (grupo.filas.length === 0) continue;
    const consigna = grupo.consignaId ? consignaPorId.get(grupo.consignaId) : undefined;
    const titulo = tituloDe(consigna) ?? (consigna ? `Consigna ${consigna.sequence}` : "Sin consigna");
    const { publicables, sinPermiso, sinFoto } = separarPublicables(grupo.filas);

    for (const o of sinPermiso) {
      excluidas.push({ consigna: titulo, puesto: o.puesto!, nombre: o.nombre, motivo: "no autorizó publicar en redes" });
    }
    for (const o of sinFoto) {
      excluidas.push({ consigna: titulo, puesto: o.puesto!, nombre: o.nombre, motivo: "su foto no está disponible" });
    }
    if (publicables.length === 0) continue;

    const cifras = String(Math.max(...publicables.map((o) => o.puesto!))).length;
    const archivos: ArchivoDelPaquete[] = publicables.flatMap((o) =>
      (["foto", "ficha"] as const).map((tipo) => ({
        snapshotId: o.snapshotId,
        tipo,
        nombre: nombreDeArchivo({ consigna: titulo, puesto: o.puesto!, nombre: o.nombre, instagram: o.instagram, tipo, cifras }),
      })),
    );

    const notas: string[] = [];
    for (const o of publicables) {
      if (!instagramConArroba(o.instagram)) {
        notas.push(`${o.puesto}.º ${o.nombre} no cargó Instagram: en el copy figura con su nombre.`);
      }
    }
    for (const o of [...sinPermiso, ...sinFoto]) {
      notas.push(
        `${o.puesto}.º ${o.nombre} quedó afuera: ${sinPermiso.includes(o) ? "no autorizó publicar su obra en redes" : "su foto no está disponible"}. No se la nombra en el copy.`,
      );
    }

    carpetas.push({
      carpeta: consigna ? nombreDeCarpeta({ sequence: consigna.sequence, titulo: tituloDe(consigna) }) : "Sin consigna",
      copy: armarCopy({
        consigna: titulo,
        personas: publicables.map((o) => ({ puesto: o.puesto!, nombre: o.nombre, instagram: o.instagram })),
        plantilla: turnos[carpetas.length % turnos.length]!,
        azar,
      }),
      notas,
      archivos,
    });
  }

  return { edicion: edicion.name, carpetas, excluidas };
}

/** La foto o la ficha de una obra, ya lista para subir. Null si la obra no se puede publicar. */
export async function imagenParaRedes(
  editionId: string,
  snapshotId: string,
  tipo: "foto" | "ficha",
): Promise<Buffer | null> {
  const [edicion, resultados] = await Promise.all([
    prisma.clickatonEdition.findUnique({ where: { id: editionId }, select: { name: true } }),
    resultadosRecientes(editionId),
  ]);
  if (!edicion || !resultados) return null;
  const obra = obrasParaRedes(resultados).find((o) => o.snapshotId === snapshotId);
  // El permiso se vuelve a mirar acá: la lista no es la única puerta.
  if (!obra || obra.puesto == null || !obra.autorizaRedes || !obra.submissionId) return null;

  const envio = await prisma.clickatonPhotoSubmission.findUnique({
    where: { id: obra.submissionId },
    select: { originalStorageKey: true, previewStorageKey: true },
  });
  // La foto sale del original; la ficha sólo necesita la proporción y una miniatura.
  const clave =
    tipo === "foto"
      ? (envio?.originalStorageKey ?? envio?.previewStorageKey)
      : (envio?.previewStorageKey ?? envio?.originalStorageKey);
  if (!clave) return null;

  const foto = await fotoParaRedes(await getPrivateEntryStorage().get(clave));
  if (tipo === "foto") return foto.jpeg;

  const consigna = obra.consignaId
    ? await prisma.clickatonPrompt.findUnique({
        where: { id: obra.consignaId },
        select: { id: true, sequence: true, title: true, titleSnapshot: true },
      })
    : null;
  const ficha = await fichaParaRedes(foto, {
    consigna: tituloDe(consigna ?? undefined) ?? (consigna ? `Consigna ${consigna.sequence}` : ""),
    puesto: obra.puesto,
    nombre: obra.nombre,
    numero: obra.numero,
    instagram: obra.instagram,
    codigo: obra.anonymousCode,
    nota: obra.nota,
    escala: resultados.sesion.scoreScaleMax,
  });
  return ficha.jpeg;
}
