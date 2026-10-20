import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { Readable } from "node:stream";
import type { Config } from "./config";

export type R2 = {
  leerParte(clave: string): Promise<Buffer>;
  subirStream(clave: string, stream: Readable, señal?: AbortSignal): Promise<number>;
  borrarPrefijo(prefijo: string): Promise<void>;
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
