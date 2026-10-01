// app/api/fotografo/perfil/qr/route.ts — QR de la página pública del fotógrafo.
//
// Es el QR de `/<handler>`, la página que lista todos sus álbumes: no depende de ningún
// álbum en particular y por eso vive en el perfil y no en la pestaña de un álbum.
import { NextResponse } from "next/server";

import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { buildQrPng } from "@/lib/instructivos/instructivo-qr";
import { buildCartelQrPdf } from "@/lib/instructivos/cartel-qr-pdf";
import type { AlbumInstructivoProfile } from "@/lib/instructivos/album-instructivo-profile";

export const runtime = "nodejs";

function baseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://compramelafoto.com";
  return raw.replace(/\/+$/, "");
}

async function bajarLogo(logoUrl: string | null): Promise<Uint8Array | null> {
  if (!logoUrl) return null;
  try {
    const r = await fetch(logoUrl, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const perfil = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      handler: true,
      logoUrl: true,
      primaryColor: true,
      isPublicPageEnabled: true,
    },
  });

  if (!perfil?.handler) {
    return NextResponse.json(
      { error: "Todavía no elegiste tu dirección pública" },
      { status: 409 }
    );
  }
  if (!perfil.isPublicPageEnabled) {
    return NextResponse.json({ error: "Tu página pública está apagada" }, { status: 409 });
  }

  const url = `${baseUrl()}/${perfil.handler}`;
  const formato = new URL(request.url).searchParams.get("formato");

  if (formato === "cartel") {
    // El cartel del perfil reutiliza el motor del cartel de álbum: el "álbum" es la
    // página del fotógrafo y la línea de acción, la de una galería sin fotos propias.
    const comoPerfil: AlbumInstructivoProfile = {
      entrada: "abierta",
      busqueda: ["navegar"],
      momento: "postventa",
      venta: {
        digital: true,
        impreso: false,
        packs: false,
        video: false,
        digitalIncluidoConImpreso: false,
      },
      entrega: { descarga: true, retiro: false, envio: false, laboratorio: null },
      vencimiento: null,
      listo: true,
      fotografo: {
        nombre: perfil.name?.trim() || "Tu fotógrafo",
        logoUrl: perfil.logoUrl,
        color: perfil.primaryColor,
        handler: perfil.handler,
      },
      album: {
        id: 0,
        titulo: "Todas mis galerías",
        slug: perfil.handler,
        url,
      },
    };
    const [qr, logo] = await Promise.all([buildQrPng(url, 960), bajarLogo(perfil.logoUrl)]);
    const pdf = await buildCartelQrPdf(comoPerfil, qr, "a4", logo);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="cartel-${perfil.handler}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const png = await buildQrPng(url, 720);
  return new NextResponse(Buffer.from(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="qr-${perfil.handler}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
