// app/api/a/[id]/instructivo/pdf/route.ts — Descarga del instructivo.
//
// Pública, igual que la página: el cliente tiene que poder bajarla desde WhatsApp sin
// iniciar sesión.
import { NextResponse } from "next/server";

import { loadAlbumInstructivo } from "@/lib/instructivos/load-album-instructivo";
import { buildInstructivoSteps } from "@/lib/instructivos/album-instructivo-steps";
import { buildQrPng } from "@/lib/instructivos/instructivo-qr";
import { buildInstructivoPdf } from "@/lib/instructivos/instructivo-pdf";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id?: string }> }) {
  const { id } = await params;
  const profile = await loadAlbumInstructivo(String(id || "").trim());
  if (!profile) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const steps = buildInstructivoSteps(profile);
  const qr = await buildQrPng(profile.album.url, 480);
  const pdf = await buildInstructivoPdf(profile, steps, qr);

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="instructivo-${profile.album.slug}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
