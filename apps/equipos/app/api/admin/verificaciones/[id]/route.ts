import { getCurrentUser, isSuperAdmin } from "@repo/auth-guards";
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { sendPortalEmail } from "@/lib/correo";
import { hashDni, normalizeDni } from "@/lib/identidad/dni";
import { MOTIVOS } from "@/lib/identidad/motivos";
import { decideVerification, type ProviderResult } from "@/lib/identidad/resultado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


/** Decide a mano una verificación en revisión: aprobar (con DNI y nombre) o rechazar (con motivo). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Necesitás iniciar sesión" }, { status: 401 });
  if (!(await isSuperAdmin(user))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Verificación inválida" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }
  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  const row = await prisma.identityVerification.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "No existe la verificación" }, { status: 404 });
  if (row.status !== "IN_REVIEW") {
    return NextResponse.json({ error: "Esta verificación ya no está en revisión" }, { status: 409 });
  }

  let data: Record<string, unknown>;
  let motivoCorreo = "";

  if (action === "reject") {
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) return NextResponse.json({ error: "Indicá el motivo del rechazo" }, { status: 400 });
    data = { status: "REJECTED", rejectionReason: reason, reviewedById: user.id };
    motivoCorreo = reason;
  } else {
    const documentNumber = typeof body.documentNumber === "string" ? body.documentNumber : "";
    const legalName = typeof body.legalName === "string" ? body.legalName.trim() : "";
    const dni = normalizeDni(documentNumber);
    if (!dni || !legalName) {
      return NextResponse.json({ error: "Cargá el DNI y el nombre como figuran en el DNI" }, { status: 400 });
    }
    const pepper = process.env.IDENTITY_DNI_PEPPER;
    if (!pepper) throw new Error("Falta IDENTITY_DNI_PEPPER");

    // Una cuenta por DNI: cualquier otra fila con ese hash, en el estado que sea, es dueña.
    const owner = await prisma.identityVerification.findFirst({
      where: { documentHash: hashDni(dni, pepper), userId: { not: row.userId } },
      select: { userId: true },
    });
    const result: ProviderResult = {
      providerRef: row.providerRef ?? "",
      outcome: "approved",
      documentNumber: dni,
      legalName,
    };
    const decision = decideVerification(result, {
      userId: row.userId,
      hashOwnerUserId: owner?.userId ?? null,
      pepper,
      previous: {
        documentHash: row.documentHash ?? null,
        documentLast3: row.documentLast3 ?? null,
        legalName: row.legalName ?? null,
      },
    });
    if (decision.status !== "APPROVED") {
      const razon = decision.rejectionReason ?? "REVISION";
      return NextResponse.json(
        { error: MOTIVOS[razon] ?? "No se puede aprobar con esos datos", reason: razon },
        { status: 409 },
      );
    }
    data = {
      status: "APPROVED",
      documentHash: decision.documentHash,
      documentLast3: decision.documentLast3,
      legalName: decision.legalName,
      rejectionReason: null,
      approvedAt: new Date(),
      reverifyRequiredAt: null,
      reviewedById: user.id,
    };
  }

  // Escritura condicional: si otra persona decidió en el medio, no pisamos nada.
  const { count } = await prisma.identityVerification.updateMany({
    where: { id, status: "IN_REVIEW" },
    data,
  });
  if (count === 0) {
    return NextResponse.json({ error: "Esta verificación ya fue decidida" }, { status: 409 });
  }

  const cuenta = await prisma.user.findUnique({
    where: { id: row.userId },
    select: { email: true, name: true },
  });
  if (cuenta?.email) {
    try {
      await sendPortalEmail(
        cuenta.email,
        action === "approve" ? "verificacion_aprobada" : "verificacion_rechazada",
        { nombre: cuenta.name ?? "", motivo: motivoCorreo },
      );
    } catch (e) {
      console.error("No se pudo avisar la decisión de verificación", e);
    }
  }
  return NextResponse.json({ ok: true });
}
