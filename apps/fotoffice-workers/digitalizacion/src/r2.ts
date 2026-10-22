import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "node:stream";
import type { Config } from "./config";

export type R2 = {
  leerParte(clave: string): Promise<Buffer>;
  subirStream(clave: string, stream: Readable, señal?: AbortSignal): Promise<number>;
  borrarPrefijo(prefijo: string): Promise<void>;
  /** Sube un archivo chico (segmento o playlist HLS); corta a los 2 min. */
  subirArchivo(clave: string, cuerpo: Buffer, tipo: string): Promise<void>;
  /** Lee un objeto grande en streaming; si la conexión se corta, sigue desde el último byte. */
  leerStream(clave: string): Readable;
  /** Falla si no hay acceso al bucket. */
  verificarAcceso(): Promise<void>;
};

export function crearR2(config: Pick<Config, "r2" | "bucket">): R2 {
  const client = new S3Client({
    region: "auto",
    endpoint: config.r2.endpoint,
    credentials: { accessKeyId: config.r2.accessKeyId, secretAccessKey: config.r2.secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const Bucket = config.bucket;

  return {
    async verificarAcceso() {
      await client.send(new HeadBucketCommand({ Bucket }));
    },

    /** Baja el objeto entero a memoria y suelta la conexión. */
    async leerParte(clave) {
      const r = await client.send(new GetObjectCommand({ Bucket, Key: clave }));
      if (!r.Body) throw new Error(`Parte vacía en R2: ${clave}`);
      return Buffer.from(await r.Body.transformToByteArray());
    },

    async subirStream(clave, stream, señal) {
      const upload = new Upload({
        client,
        params: { Bucket, Key: clave, Body: stream, ContentType: "video/mp4" },
        partSize: 64 * 1024 * 1024,
        queueSize: 2,
        leavePartsOnError: false,
      });
      // Al cancelar, se aborta la multiparte: no puede quedar un final.mp4 huérfano.
      señal?.addEventListener("abort", () => void upload.abort().catch(() => {}), { once: true });
      await upload.done();
      const head = await client.send(new HeadObjectCommand({ Bucket, Key: clave }));
      return Number(head.ContentLength ?? 0);
    },

    async subirArchivo(clave, cuerpo, tipo) {
      await client.send(
        new PutObjectCommand({ Bucket, Key: clave, Body: cuerpo, ContentType: tipo, ContentLength: cuerpo.length }),
        { abortSignal: AbortSignal.timeout(SUBIDA_ARCHIVO_MS) },
      );
    },

    leerStream(clave) {
      return Readable.from(leerReanudable(client, Bucket, clave));
    },

    async borrarPrefijo(prefijo) {
      let token: string | undefined;
      do {
        const lista = await client.send(
          new ListObjectsV2Command({ Bucket, Prefix: prefijo, ContinuationToken: token, MaxKeys: 1000 }),
        );
        const claves = (lista.Contents ?? []).map((o) => ({ Key: o.Key! }));
        if (claves.length > 0) {
          const r = await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: claves, Quiet: true } }));
          if (r.Errors && r.Errors.length > 0) {
            throw new Error(`No se pudieron borrar ${r.Errors.length} objetos de ${prefijo}`);
          }
        }
        token = lista.IsTruncated ? lista.NextContinuationToken : undefined;
      } while (token);
    },
  };
}

const SUBIDA_ARCHIVO_MS = 2 * 60_000;
const ESPERAS_LECTURA_MS = [2000, 5000, 15000, 30000, 60000];

/**
 * El `final.mp4` de una cinta de 2 h pesa ~8 GB: una sola conexión puede cortarse en el medio.
 * Ante un error se vuelve a pedir con `Range: bytes=<leídos>-`, hasta 5 veces seguidas sin avanzar.
 */
async function* leerReanudable(client: S3Client, Bucket: string, Key: string): AsyncGenerator<Uint8Array> {
  let leidos = 0;
  let total: number | null = null;
  let fallosSeguidos = 0;
  while (total === null || leidos < total) {
    const antes = leidos;
    try {
      const r = await client.send(
        new GetObjectCommand({ Bucket, Key, ...(leidos > 0 ? { Range: `bytes=${leidos}-` } : {}) }),
      );
      if (!r.Body) throw new Error(`Objeto vacío en R2: ${Key}`);
      if (total === null) {
        const rango = r.ContentRange?.match(/\/(\d+)$/);
        total = rango ? Number(rango[1]) : Number(r.ContentLength ?? 0);
      }
      for await (const chunk of r.Body as AsyncIterable<Uint8Array>) {
        leidos += chunk.length;
        yield chunk;
      }
      if (total !== null && leidos < total) throw new Error(`Lectura cortada en ${leidos} de ${total} bytes`);
    } catch (e) {
      fallosSeguidos = leidos > antes ? 1 : fallosSeguidos + 1;
      if (fallosSeguidos > ESPERAS_LECTURA_MS.length) throw e;
      console.error(`[digitalizacion] lectura de ${Key} cortada en ${leidos} bytes; reintento:`, e instanceof Error ? e.message : e);
      await new Promise((r) => setTimeout(r, ESPERAS_LECTURA_MS[fallosSeguidos - 1]));
    }
  }
}
