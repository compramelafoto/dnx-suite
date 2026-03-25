import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const doc = await prisma.photobookDocument.findUnique({
    where: { id },
  });

  if (!doc) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  return NextResponse.json(doc);
}

export async function PUT(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title : null;
  const data = body.data ?? null;

  if (!data) {
    return NextResponse.json({ error: "Falta data" }, { status: 400 });
  }

  const doc = await prisma.photobookDocument.upsert({
    where: { id },
    create: { id, title, data },
    update: { title, data },
  });

  return NextResponse.json(doc);
}
