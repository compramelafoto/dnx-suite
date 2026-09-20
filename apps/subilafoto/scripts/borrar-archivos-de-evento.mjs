/*
  Borra de R2 todos los archivos de un evento, por su código.

  Para qué: la purga automática busca los archivos **a partir del evento**. Si el evento
  ya no está en la base (una prueba que se limpió a mano, por ejemplo), sus archivos
  quedan en el bucket para siempre y nadie los reclama. Esto los alcanza igual.

  Uso:
    R2_ENDPOINT=... R2_BUCKET=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
      node scripts/borrar-archivos-de-evento.mjs E2EAAA

  Sin --borrar sólo lista. Las claves salen del panel de Cloudflare: `vercel env pull`
  las devuelve enmascaradas porque están marcadas como sensibles.
*/
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

const codigo = process.argv[2];
const borrar = process.argv.includes("--borrar");
if (!codigo) {
  console.error("Falta el código del evento. Ej: node scripts/borrar-archivos-de-evento.mjs E2EAAA");
  process.exit(1);
}

const falta = ["R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"].filter(
  (k) => !process.env[k],
);
if (falta.length) {
  console.error(`Faltan variables: ${falta.join(", ")}`);
  process.exit(1);
}

const s3 = new S3Client({
  region: process.env.R2_REGION || "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const Bucket = process.env.R2_BUCKET;

let total = 0;
for (const prefijo of [`eventos/${codigo}/`, `paquetes/${codigo}/`]) {
  /* La lista viene de a mil; un evento grande necesita varias vueltas. */
  let token;
  do {
    const lista = await s3.send(
      new ListObjectsV2Command({ Bucket, Prefix: prefijo, ContinuationToken: token }),
    );
    const claves = (lista.Contents ?? []).map((o) => ({ Key: o.Key }));
    token = lista.IsTruncated ? lista.NextContinuationToken : undefined;
    if (claves.length === 0) continue;
    total += claves.length;
    if (borrar) {
      await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: claves } }));
    }
    console.log(`${prefijo} · ${claves.length} archivos${borrar ? " borrados" : ""}`);
  } while (token);
}

console.log(
  total === 0
    ? `No hay archivos de ${codigo} en el bucket.`
    : borrar
      ? `Listo: ${total} archivos de ${codigo} borrados.`
      : `${total} archivos de ${codigo}. Agregá --borrar para borrarlos de verdad.`,
);
