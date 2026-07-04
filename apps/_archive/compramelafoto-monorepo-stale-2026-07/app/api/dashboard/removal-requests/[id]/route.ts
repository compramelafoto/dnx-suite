import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH: Aprobar o rechazar una solicitud de remoción
export async function PATCH(
  req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const params = await Promise.resolve(ctx.params);
    const requestId = Number(params.id);

    if (!Number.isFinite(requestId)) {
      return NextResponse.json(
        { error: "ID inválido" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { action, decisionNote, photographerId } = body;

    if (!action || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json(
        { error: "action debe ser 'APPROVE' o 'REJECT'" },
        { status: 400 }
      );
    }

    // TODO: Implementar autenticación del fotógrafo
    // Por ahora, usar photographerId del body (en producción usar sesión/auth)
    if (!photographerId || !Number.isFinite(Number(photographerId))) {
      return NextResponse.json(
        { error: "photographerId es requerido" },
        { status: 400 }
      );
    }

    const photographerIdNum = Number(photographerId);

    // Obtener la solicitud y verificar ownership
    let request: any;
    try {
      request = await prisma.removalRequest.findUnique({
        where: { id: requestId },
        include: {
          photo: {
            select: {
              id: true,
              isRemoved: true,
            },
          },
        },
      });
    } catch (photoErr: any) {
      // Si falla por campo desconocido (isRemoved), intentar sin él
      if (photoErr?.message?.includes("isRemoved") || photoErr?.message?.includes("Unknown field")) {
        request = await prisma.removalRequest.findUnique({
          where: { id: requestId },
          include: {
            photo: {
              select: {
                id: true,
              },
            },
          },
        });
        // Asignar isRemoved como false si no existe
        if (request?.photo) {
          request.photo.isRemoved = false;
        }
      } else {
        throw photoErr;
      }
    }

    if (!request) {
      return NextResponse.json(
        { error: "Solicitud no encontrada" },
        { status: 404 }
      );
    }

    if (request.photographerId !== photographerIdNum) {
      return NextResponse.json(
        { error: "No tenés permiso para decidir sobre esta solicitud" },
        { status: 403 }
      );
    }

    if (request.status !== "PENDING") {
      return NextResponse.json(
        { error: "Esta solicitud ya fue procesada" },
        { status: 400 }
      );
    }

    const now = new Date();
    const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

    // Actualizar la solicitud
    let updatedRequest: any;
    try {
      updatedRequest = await prisma.removalRequest.update({
        where: { id: requestId },
        data: {
          status: newStatus,
          decidedAt: now,
          decidedByUserId: photographerIdNum,
          decisionNote: decisionNote?.trim() || null,
        },
        include: {
          album: {
            select: {
              id: true,
              title: true,
            },
          },
          photo: {
            select: {
              id: true,
              previewUrl: true,
              isRemoved: true,
            },
          },
        },
      });
    } catch (updateErr: any) {
      // Si falla por campo desconocido, intentar sin isRemoved
      if (updateErr?.message?.includes("isRemoved") || updateErr?.message?.includes("Unknown field")) {
        updatedRequest = await prisma.removalRequest.update({
          where: { id: requestId },
          data: {
            status: newStatus,
            decidedAt: now,
            decidedByUserId: photographerIdNum,
            decisionNote: decisionNote?.trim() || null,
          },
          include: {
            album: {
              select: {
                id: true,
                title: true,
              },
            },
            photo: {
              select: {
                id: true,
                previewUrl: true,
              },
            },
          },
        });
        if (updatedRequest?.photo) {
          updatedRequest.photo.isRemoved = false;
        }
      } else {
        throw updateErr;
      }
    }

    // Si se aprueba, marcar la foto como removida
    if (action === "APPROVE") {
      const photoIsRemoved = request.photo?.isRemoved ?? false;
      if (!photoIsRemoved) {
        try {
          await prisma.photo.update({
            where: { id: request.photoId },
            data: {
              isRemoved: true,
              removedAt: now,
              removedReason: `RemovalRequest #${requestId}`,
            },
          });
          console.log(`✅ Foto ${request.photoId} marcada como removida (RemovalRequest #${requestId})`);
        } catch (photoUpdateErr: any) {
          const errorMsg = String(photoUpdateErr?.message ?? "");
          // Si falla porque las columnas no existen, intentar solo con isRemoved
          if (
            errorMsg.includes("isRemoved") ||
            errorMsg.includes("removedAt") ||
            errorMsg.includes("removedReason") ||
            errorMsg.includes("does not exist") ||
            errorMsg.includes("Unknown column")
          ) {
            try {
              // Intentar solo con isRemoved
              await prisma.photo.update({
                where: { id: request.photoId },
                data: {
                  isRemoved: true,
                },
              });
              console.log(`✅ Foto ${request.photoId} marcada como removida (solo isRemoved, RemovalRequest #${requestId})`);
            } catch (simpleErr: any) {
              // Si aún falla, loguear el error pero no fallar la solicitud
              console.error(`⚠️ No se pudo marcar la foto ${request.photoId} como removida:`, simpleErr?.message);
              console.error(`⚠️ Es posible que las columnas isRemoved, removedAt, removedReason no existan en la base de datos.`);
              console.error(`⚠️ Ejecutá: npx prisma db push o npx prisma migrate dev para sincronizar el schema.`);
            }
          } else {
            // Otro tipo de error, relanzarlo
            throw photoUpdateErr;
          }
        }
      }
    }

    return NextResponse.json(updatedRequest, { status: 200 });
  } catch (err: any) {
    console.error("PATCH /api/dashboard/removal-requests/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error procesando la solicitud", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
