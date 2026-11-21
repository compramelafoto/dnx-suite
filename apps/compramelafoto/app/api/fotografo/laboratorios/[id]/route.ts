import { NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { validarContacto } from "@/lib/print-batches/contactos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER];
const NO_ENCONTRADO = "No encontramos ese laboratorio.";

async function propio(idTexto: string, photographerId: number) {
  const id = Number(idTexto);
  if (!Number.isInteger(id) || id <= 0) return null;
  return prisma.photographerLabContact.findFirst({
    where: { id, photographerId, activo: true },
    include: { lab: { select: { address: true } } },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireAuth(ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado. Iniciá sesión como fotógrafo." }, { status: 401 });
  }
  const { id: idTexto } = await params;
  const actual = await propio(idTexto, user.id);
  if (!actual) return NextResponse.json({ error: NO_ENCONTRADO }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "No pudimos leer los datos enviados." }, { status: 400 });
  }

  const v = validarContacto(
    {
      nombre: body.nombre !== undefined ? String(body.nombre) : actual.nombre,
      email: body.email !== undefined ? String(body.email) : actual.email,
      whatsapp: body.whatsapp !== undefined ? body.whatsapp : actual.whatsapp ?? undefined,
      puntoDeRetiro: body.puntoDeRetiro !== undefined ? body.puntoDeRetiro === true : actual.puntoDeRetiro,
      direccion: body.direccion !== undefined ? body.direccion : actual.direccion ?? undefined,
      horario: body.horario !== undefined ? body.horario : actual.horario ?? undefined,
      esPredeterminado:
        body.esPredeterminado !== undefined ? body.esPredeterminado === true : actual.esPredeterminado,
    },
    actual.lab ? { address: actual.lab.address } : null,
  );
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const d = v.datos;

  try {
    const actualizado = await prisma.$transaction(async (tx) => {
      if (d.esPredeterminado) {
        await tx.photographerLabContact.updateMany({
          where: { photographerId: user.id, esPredeterminado: true, NOT: { id: actual.id } },
          data: { esPredeterminado: false },
        });
      }
      return tx.photographerLabContact.update({
        where: { id: actual.id },
        data: {
          nombre: d.nombre,
          email: d.email,
          whatsapp: d.whatsapp ?? null,
          notas:
            body.notas !== undefined ? (String(body.notas).trim() || null) : actual.notas,
          esPredeterminado: d.esPredeterminado === true,
          puntoDeRetiro: d.puntoDeRetiro === true,
          direccion: d.direccion ?? null,
          horario: d.horario ?? null,
        },
      });
    });
    return NextResponse.json({ laboratorio: actualizado });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Ya cargaste un laboratorio con ese correo." }, { status: 409 });
    }
    console.error("PATCH /api/fotografo/laboratorios/[id]", e);
    return NextResponse.json({ error: "No pudimos guardar el laboratorio. Probá de nuevo." }, { status: 500 });
  }
}

/** DELETE = baja lógica (`activo = false`): los lotes ya armados conservan su referencia. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, user } = await requireAuth(ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado. Iniciá sesión como fotógrafo." }, { status: 401 });
  }
  const { id: idTexto } = await params;
  const actual = await propio(idTexto, user.id);
  if (!actual) return NextResponse.json({ error: NO_ENCONTRADO }, { status: 404 });
  await prisma.photographerLabContact.update({
    where: { id: actual.id },
    data: { activo: false, esPredeterminado: false },
  });
  return NextResponse.json({ ok: true });
}
