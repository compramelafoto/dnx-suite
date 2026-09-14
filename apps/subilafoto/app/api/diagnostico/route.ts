import { prisma } from "@repo/db";

/**
 * Diagnóstico de arranque: confirma que la app llega a la base y que la moderación
 * responde, sin exponer ningún valor de configuración.
 *
 * Temporal, para verificar el despliegue de la Etapa 1. Se retira antes del lanzamiento.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const resultado: Record<string, unknown> = {};

  try {
    const perfiles = await prisma.subilafotoSellerProfile.count();
    const eventos = await prisma.subilafotoEvent.count();
    resultado.base = { ok: true, perfiles, eventos };
  } catch (e) {
    const err = e as { name?: string; code?: string; meta?: unknown };
    resultado.base = {
      ok: false,
      error: err.name ?? "desconocido",
      // El código de Prisma dice qué pasó: P2021 = la tabla no existe,
      // P1001 = no llega a la base, P1017 = la conexión se cerró.
      code: err.code ?? null,
      meta: err.meta ?? null,
    };
  }

  try {
    const { RekognitionClient, DetectModerationLabelsCommand } = await import(
      "@aws-sdk/client-rekognition"
    );
    const cliente = new RekognitionClient({ region: process.env.AWS_REGION });
    const inicio = Date.now();
    try {
      // Imagen deliberadamente inválida: alcanza para distinguir "sin permiso" de
      // "permitido", y no gasta una llamada real de análisis.
      await cliente.send(
        new DetectModerationLabelsCommand({ Image: { Bytes: new Uint8Array([1, 2, 3]) } }),
      );
      resultado.moderacion = { ok: true, nota: "respondio sin error" };
    } catch (e) {
      const nombre = e instanceof Error ? e.name : "desconocido";
      // InvalidImageFormatException = la credencial sirve, sólo la imagen es basura.
      // AccessDeniedException = la credencial no tiene el permiso.
      resultado.moderacion = {
        ok: nombre === "InvalidImageFormatException",
        error: nombre,
        ms: Date.now() - inicio,
      };
    }
  } catch (e) {
    resultado.moderacion = { ok: false, error: e instanceof Error ? e.name : "desconocido" };
  }

  // R2: se sube un archivo diminuto, se lee y se borra. Es la única forma de saber que
  // la credencial sirve de verdad y no sólo que las variables están presentes.
  try {
    const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = await import(
      "@aws-sdk/client-s3"
    );
    const { almacenamiento, bucket } = await import("@/lib/almacenamiento");
    const cliente = almacenamiento();
    const clave = `diagnostico/prueba-${Date.now()}.txt`;
    const contenido = "prueba de escritura";
    const inicio = Date.now();

    await cliente.send(
      new PutObjectCommand({ Bucket: bucket(), Key: clave, Body: contenido }),
    );
    const leido = await cliente.send(
      new GetObjectCommand({ Bucket: bucket(), Key: clave }),
    );
    const texto = await leido.Body?.transformToString();
    await cliente.send(new DeleteObjectCommand({ Bucket: bucket(), Key: clave }));

    resultado.almacenamiento = {
      ok: texto === contenido,
      escribeYLee: texto === contenido,
      ms: Date.now() - inicio,
    };
  } catch (e) {
    resultado.almacenamiento = {
      ok: false,
      error: e instanceof Error ? e.name : "desconocido",
      detalle: e instanceof Error ? e.message.slice(0, 120) : null,
    };
  }

  // Sólo el host de la base, nunca usuario ni contraseña: alcanza para saber
  // si la app está hablando con la base que creemos.
  let hostBase: string | null = null;
  try {
    const url = process.env.DATABASE_URL;
    hostBase = url ? new URL(url).hostname : null;
  } catch {
    hostBase = "url ilegible";
  }

  resultado.configuracion = {
    hostBase,
    tieneGoogle: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    tieneAuthSecret: Boolean(process.env.AUTH_SECRET),
    authUrl: process.env.AUTH_URL ?? null,
    region: process.env.AWS_REGION ?? null,
    bucket: process.env.R2_BUCKET ?? null,
  };

  return Response.json(resultado);
}
