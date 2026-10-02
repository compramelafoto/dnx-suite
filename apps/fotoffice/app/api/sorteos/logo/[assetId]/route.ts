import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

export const runtime = "nodejs";

/**
 * Entrega el logo de un aliado de los sorteos, desde el dominio de FOTOFFICE.
 *
 * ── Por qué existe ──
 *
 * Los logos se cargan en DNX Partners, que vive en Clickatón y los guarda en el bucket de
 * Clickatón. FOTOFFICE no tiene acceso a ese bucket, y el proxy público de Clickatón
 * (`clickaton.com/api/media`) está detrás de la protección de Cloudflare, que bloquea los
 * pedidos que no vienen de un navegador. Se pide entonces al dominio de Vercel de Clickatón,
 * desde el servidor, y el resultado lo guarda la CDN: el archivo no cambia nunca porque la clave
 * del bucket es única por subida.
 *
 * ── Qué se puede pedir ──
 *
 * Sólo un archivo de marca activo y aprobado, y sólo de la carpeta de marcas de Partners. El
 * identificador del archivo no dice nada de dónde está: la clave la busca este servidor, así que
 * no hay forma de usar esta ruta para leer otra cosa del bucket.
 */

const CLAVE_DE_MARCA = /^clickaton\/partners\/[a-z0-9]+\/brand\/[\w./-]+\.(png|jpe?g|webp)$/i;
const ORIGEN = process.env.CLICKATON_MEDIA_ORIGIN?.trim() || "https://clickaton-dnxsuite.vercel.app";

async function buscarArchivo(assetId: string) {
  const consulta = {
    where: {
      id: assetId,
      archivedAt: null,
      status: "ACTIVE" as const,
      approvalStatus: "APPROVED" as const,
    },
    select: { storageKey: true },
  };
  const { getClickatonReadonlyClient, isClickatonReadonlyAvailable } = await import(
    "@repo/db/clickaton-readonly-client"
  );
  return isClickatonReadonlyAvailable()
    ? getClickatonReadonlyClient().dnxPartnerAsset.findFirst(consulta)
    : prisma.dnxPartnerAsset.findFirst(consulta);
}

export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  if (!/^[a-z0-9]{20,40}$/.test(assetId)) {
    return new NextResponse(null, { status: 404 });
  }

  const archivo = await buscarArchivo(assetId);
  const clave = archivo?.storageKey?.trim();
  if (!clave || !CLAVE_DE_MARCA.test(clave) || clave.includes("..")) {
    return new NextResponse(null, { status: 404 });
  }

  const respuesta = await fetch(`${ORIGEN.replace(/\/$/, "")}/api/media/${clave}`, {
    cache: "no-store",
  });
  const tipo = respuesta.headers.get("content-type") ?? "";
  // Nunca SVG: servido desde este dominio podría ejecutar código.
  if (!respuesta.ok || !respuesta.body || !/^image\/(png|jpeg|webp)/.test(tipo)) {
    console.error("[fotoffice][sorteos] no se pudo traer el logo del aliado", {
      assetId,
      status: respuesta.status,
    });
    return new NextResponse(null, { status: 502 });
  }

  return new NextResponse(respuesta.body, {
    headers: {
      "Content-Type": tipo,
      // La clave es única por subida: el contenido de esta dirección no cambia.
      "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
