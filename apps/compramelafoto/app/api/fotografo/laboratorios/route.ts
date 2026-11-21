import { NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { validarContacto, type ContactoInput } from "@/lib/print-batches/contactos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER];
const MENSAJE_DUPLICADO = "Ya cargaste un laboratorio con ese correo.";

/**
 * GET /api/fotografo/laboratorios            → laboratorios activos del fotógrafo.
 * GET /api/fotografo/laboratorios?directorio=1 → laboratorios aprobados del directorio de CLF.
 */
export async function GET(req: Request) {
  const { error, user } = await requireAuth(ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado. Iniciá sesión como fotógrafo." }, { status: 401 });
  }
  const url = new URL(req.url);
  if (url.searchParams.get("directorio") === "1") {
    const labs = await prisma.lab.findMany({
      where: { approvalStatus: "APPROVED", isActive: true },
      select: { id: true, name: true, city: true, email: true, address: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ labs });
  }
  const laboratorios = await prisma.photographerLabContact.findMany({
    where: { photographerId: user.id, activo: true },
    orderBy: [{ esPredeterminado: "desc" }, { nombre: "asc" }],
  });
  return NextResponse.json({ laboratorios });
}

export async function POST(req: Request) {
  const { error, user } = await requireAuth(ROLES);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado. Iniciá sesión como fotógrafo." }, { status: 401 });
  }
  let body: Partial<ContactoInput> & { notas?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "No pudimos leer los datos enviados." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const lab = email
    ? await prisma.lab.findFirst({
        where: { email, approvalStatus: "APPROVED" },
        select: { id: true, address: true },
      })
    : null;

  const v = validarContacto(
    {
      nombre: String(body.nombre ?? ""),
      email,
      whatsapp: body.whatsapp,
      puntoDeRetiro: body.puntoDeRetiro,
      direccion: body.direccion,
      horario: body.horario,
      esPredeterminado: body.esPredeterminado,
    },
    lab,
  );
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const d = v.datos;

  try {
    const creado = await prisma.$transaction(async (tx) => {
      const existente = await tx.photographerLabContact.findUnique({
        where: { photographerId_email: { photographerId: user.id, email: d.email } },
        select: { id: true, activo: true },
      });
      if (existente?.activo) return null;
      if (d.esPredeterminado) {
        await tx.photographerLabContact.updateMany({
          where: { photographerId: user.id, esPredeterminado: true },
          data: { esPredeterminado: false },
        });
      }
      const datos = {
        labId: lab?.id ?? null,
        nombre: d.nombre,
        whatsapp: d.whatsapp ?? null,
        notas: typeof body.notas === "string" && body.notas.trim() ? body.notas.trim() : null,
        esPredeterminado: d.esPredeterminado === true,
        puntoDeRetiro: d.puntoDeRetiro === true,
        direccion: d.direccion ?? null,
        horario: d.horario ?? null,
        activo: true,
      };
      // Si lo había dado de baja antes, se reactiva con los datos nuevos.
      if (existente) return tx.photographerLabContact.update({ where: { id: existente.id }, data: datos });
      return tx.photographerLabContact.create({
        data: { photographerId: user.id, email: d.email, ...datos },
      });
    });
    if (!creado) return NextResponse.json({ error: MENSAJE_DUPLICADO }, { status: 409 });
    return NextResponse.json({ laboratorio: creado }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: MENSAJE_DUPLICADO }, { status: 409 });
    console.error("POST /api/fotografo/laboratorios", e);
    return NextResponse.json({ error: "No pudimos guardar el laboratorio. Probá de nuevo." }, { status: 500 });
  }
}
