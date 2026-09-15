import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import archiver from "archiver";
import { prisma } from "@repo/db";
import { almacenamiento, bucket } from "@/lib/almacenamiento";
import { condicionDePublicadas } from "@/lib/album";
import { armarManifiesto, nombreEnElPaquete, type ArchivoDelManifiesto } from "./manifiesto";
import { repartirEnPartes } from "./partes";
import { vencimientoDelEnlace } from "./enlace";

/**
 * Arma el paquete de descarga de un evento.
 *
 * **Se transmite, no se acumula.** Cada foto se lee de R2, entra al ZIP y sale hacia R2 en
 * el mismo movimiento, con subida multiparte. Escribirlo a disco primero —como hace
 * CompraMeLaFoto— tiene un techo de 512 MB en Vercel, y un casamiento lo pasa sin esfuerzo.
 *
 * **Sin compresión, a propósito.** Un JPEG ya está comprimido: apretarlo otra vez gasta
 * minutos de procesador para ahorrar el uno por ciento. El ZIP acá sirve para juntar, no
 * para achicar.
 */

/** Cuántas partes como mucho. Más que esto y el problema no es el paquete. */
const LIMITE_DE_PARTES = 20;

export type ResultadoDelArmado =
  | { ok: true; partes: number; archivos: number }
  | { ok: false; error: string };

export async function armarPaquete(eventoId: string): Promise<ResultadoDelArmado> {
  const evento = await prisma.subilafotoEvent.findUnique({
    where: { id: eventoId },
    select: { id: true, name: true, code: true, retentionUntil: true },
  });
  if (!evento) return { ok: false, error: "El evento no existe." };

  const fotos = await prisma.subilafotoMedia.findMany({
    where: { ...condicionDePublicadas(evento.id), kind: "PHOTO" },
    // El mismo orden en cada generación: si cambiara, la foto 007 de un cliente
    // no sería la misma que la de ayer.
    orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      originalKey: true,
      originalBytes: true,
      checksum: true,
      caption: true,
      guestName: true,
      publishedAt: true,
    },
  });

  if (fotos.length === 0) return { ok: false, error: "El evento no tiene fotos publicadas." };

  // El repartidor es puro y habla de `bytes`; la base lo llama `originalBytes`. La
  // traducción va acá y no adentro del módulo, que no tiene por qué saber de Prisma.
  const partes = repartirEnPartes(fotos.map((f) => ({ ...f, bytes: f.originalBytes })));
  if (partes.length > LIMITE_DE_PARTES) {
    return { ok: false, error: `El evento necesita ${partes.length} partes y el tope es ${LIMITE_DE_PARTES}.` };
  }

  const ahora = new Date();
  const venceEl = vencimientoDelEnlace(ahora, evento.retentionUntil);

  /*
    Se borra lo anterior antes de empezar. Sin esto, regenerar un paquete deja las partes
    viejas conviviendo con las nuevas y el cliente baja una mezcla de dos generaciones.
  */
  await prisma.subilafotoPackage.deleteMany({ where: { eventId: evento.id } });

  let numeroDeParte = 0;
  for (const grupo of partes) {
    numeroDeParte += 1;

    const paquete = await prisma.subilafotoPackage.create({
      data: {
        eventId: evento.id,
        status: "BUILDING",
        partIndex: numeroDeParte,
        partCount: partes.length,
        startedAt: new Date(),
      },
      select: { id: true },
    });

    try {
      const resultado = await escribirParte({
        evento,
        grupo,
        parte: { numero: numeroDeParte, de: partes.length },
        totalDeFotos: fotos.length,
        desde: partes.slice(0, numeroDeParte - 1).reduce((n, p) => n + p.length, 0),
      });

      await prisma.subilafotoPackage.update({
        where: { id: paquete.id },
        data: {
          status: "READY",
          storageKey: resultado.clave,
          bytes: BigInt(resultado.bytes),
          itemCount: grupo.length,
          manifest: resultado.manifiesto as unknown as object,
          checksum: resultado.checksum,
          // El identificador no dice nada de sí mismo: no lleva el evento ni el
          // cliente, así que no se puede adivinar el de otro.
          downloadToken: randomBytes(24).toString("base64url"),
          tokenExpiresAt: venceEl,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      await prisma.subilafotoPackage.update({
        where: { id: paquete.id },
        data: {
          status: "FAILED",
          error: (error instanceof Error ? error.message : "desconocido").slice(0, 400),
          completedAt: new Date(),
        },
      });
      return { ok: false, error: `Falló la parte ${numeroDeParte}.` };
    }
  }

  await prisma.subilafotoEvent.update({
    where: { id: evento.id },
    data: { downloadStatus: "DELIVERED" },
  });

  return { ok: true, partes: partes.length, archivos: fotos.length };
}

type FotoDelPaquete = {
  id: string;
  originalKey: string;
  originalBytes: number | null;
  checksum: string | null;
  caption: string | null;
  guestName: string | null;
  publishedAt: Date | null;
};

async function escribirParte(entrada: {
  evento: { id: string; name: string; code: string };
  grupo: FotoDelPaquete[];
  parte: { numero: number; de: number };
  totalDeFotos: number;
  desde: number;
}): Promise<{ clave: string; bytes: number; checksum: string; manifiesto: object }> {
  const { evento, grupo, parte, totalDeFotos, desde } = entrada;
  const cliente = almacenamiento();
  const clave = `paquetes/${evento.code}/parte-${parte.numero}-de-${parte.de}.zip`;

  // `store` y no `zlib`: un JPEG ya está comprimido y volver a apretarlo gasta
  // minutos de procesador para ahorrar casi nada.
  const zip = archiver("zip", { store: true });
  const huella = createHash("sha256");
  let bytesEscritos = 0;

  zip.on("data", (trozo: Buffer) => {
    bytesEscritos += trozo.length;
    huella.update(trozo);
  });

  // La subida arranca antes de escribir nada: el ZIP va saliendo mientras se arma.
  const subida = new Upload({
    client: cliente,
    params: {
      Bucket: bucket(),
      Key: clave,
      Body: Readable.from(zip),
      ContentType: "application/zip",
    },
    queueSize: 2,
    partSize: 16 * 1024 * 1024,
  });
  const terminada = subida.done();

  const archivos: ArchivoDelManifiesto[] = [];

  for (const [i, foto] of grupo.entries()) {
    const nombre = nombreEnElPaquete(desde + i + 1, totalDeFotos, foto.originalKey);

    const objeto = await cliente.send(
      new GetObjectCommand({ Bucket: bucket(), Key: foto.originalKey }),
    );
    if (!objeto.Body) throw new Error(`No se pudo leer ${nombre}.`);

    zip.append(objeto.Body as Readable, { name: nombre });

    archivos.push({
      archivo: nombre,
      bytes: foto.originalBytes ?? Number(objeto.ContentLength ?? 0),
      checksum: foto.checksum,
      autor: foto.guestName,
      pie: foto.caption,
      subidaEl: (foto.publishedAt ?? new Date()).toISOString(),
    });
  }

  const manifiesto = armarManifiesto({
    evento: { nombre: evento.name, codigo: evento.code },
    parte: { numero: parte.numero, de: parte.de },
    archivos,
    generadoEl: new Date(),
  });

  // El manifiesto va último para que liste lo que efectivamente entró.
  zip.append(JSON.stringify(manifiesto, null, 2), { name: "manifiesto.json" });

  await zip.finalize();
  await terminada;

  return { clave, bytes: bytesEscritos, checksum: huella.digest("hex"), manifiesto };
}
