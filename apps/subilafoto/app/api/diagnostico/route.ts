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
    resultado.base = { ok: false, error: e instanceof Error ? e.name : "desconocido" };
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

  resultado.configuracion = {
    tieneGoogle: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    tieneAuthSecret: Boolean(process.env.AUTH_SECRET),
    authUrl: process.env.AUTH_URL ?? null,
    region: process.env.AWS_REGION ?? null,
  };

  return Response.json(resultado);
}
