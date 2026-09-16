import { prisma } from "@repo/db";
import { rechazoDeLlave } from "@/lib/llave-de-servicio";

/**
 * Diagnóstico de arranque: confirma que la app llega a la base, que la moderación responde
 * y que R2 se puede escribir y leer.
 *
 * **Protegida con la llave de servicio.** Estuvo abierta hasta el 2026-09-15 y no debió
 * estarlo por dos motivos:
 *
 * - Publicaba el host de la base, el nombre del bucket, la región y la cantidad de
 *   eventos. Nada de eso es una credencial, pero es el mapa para buscarlas.
 * - **Cada visita escribe y borra un archivo en R2 y llama a Rekognition.** Abierta, es un
 *   endpoint que cualquiera puede poner en un bucle y que se factura.
 *
 * Sigue siendo la forma más rápida de saber si un despliegue quedó bien, así que se cierra
 * en vez de borrarse.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rechazo = rechazoDeLlave(req);
  if (rechazo) return rechazo;

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

  /*
    A qué cuenta de Mercado Pago apunta el token.

    Es el error más caro y el más silencioso: con las credenciales de un usuario de prueba
    todo "funciona" —el checkout abre, el pago se aprueba— y el dinero no existe. No se
    descubre hasta que alguien pregunta dónde está la plata de un evento real.

    Se pregunta a la API en vez de mirar el prefijo del token, porque un `APP_USR-` también
    lo tiene un usuario de prueba. Nunca se devuelve el token.
  */
  try {
    const token = process.env.SUBILAFOTO_MP_ACCESS_TOKEN?.trim();
    if (!token) {
      resultado.mercadopago = { ok: false, error: "Falta SUBILAFOTO_MP_ACCESS_TOKEN." };
    } else {
      const inicio = Date.now();
      const respuesta = await fetch("https://api.mercadopago.com/users/me", {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8_000),
      });

      if (!respuesta.ok) {
        resultado.mercadopago = { ok: false, estado: respuesta.status, ms: Date.now() - inicio };
      } else {
        const cuenta = (await respuesta.json()) as {
          id?: number;
          nickname?: string;
          email?: string;
          site_id?: string;
        };
        // La marca de usuario de prueba es el nick y el correo, no el prefijo del token.
        const esDePrueba =
          Boolean(cuenta.nickname?.startsWith("TESTUSER")) ||
          Boolean(cuenta.email?.includes("@testuser.com"));

        resultado.mercadopago = {
          ok: !esDePrueba,
          esDePrueba,
          cuentaId: cuenta.id ?? null,
          nickname: cuenta.nickname ?? null,
          pais: cuenta.site_id ?? null,
          ms: Date.now() - inicio,
          nota: esDePrueba
            ? "ATENCIÓN: son credenciales de un usuario de prueba. Los cobros no son reales."
            : "Cuenta productiva.",
        };
      }
    }
  } catch (e) {
    resultado.mercadopago = { ok: false, error: e instanceof Error ? e.name : "desconocido" };
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
