import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/lib/prisma";
import {
  executePreventaPackRedeemV1,
  PreventaPackRedeemValidationError,
} from "@/lib/preventa-canjeable/redeem-preventa-pack-order-v1";
import { getOrderIdForPackAccessToken } from "@/lib/preventa-canjeable/pack-access-tokens";
import { completePreventaRedemption } from "@/lib/preventa-canjeable/complete-preventa-redemption";
import { prisma } from "@/lib/prisma";
import { getCheckoutEmailValidationError } from "@/lib/email-validation";
import { digitsOnly, isValidPhoneForPurchase } from "@/lib/phone-validation";
import { isPlaceholderEmail } from "@/lib/canje-externo/external-preventa";
import { parsePreventaPackSnapshotV1 } from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import { packRequiereAutorizacion } from "@/lib/revision-de-impresion/en-el-canje";
import { getAuthUser } from "@/lib/auth";
import { puedeUsarPackDePrueba } from "@/lib/canje-externo/reiniciar-pack-de-prueba";
import { familiaPuedeElegir } from "@/lib/schools/quien-elige-las-fotos";
import { cargarRegla } from "@/lib/schools/quien-elige-las-fotos-server";
import { claveDeCurso, grupalParaGuardar } from "@/lib/schools/grupal-del-curso";
import { parseExternalPreventaRefs } from "@/lib/canje-externo/external-preventa";
import { parsePreCompraOrderIdFromPaymentRef } from "@/lib/preventa-canjeable/preventa-redeem-url";

/** Guarda la grupal que eligió el fotógrafo para el curso del pack (se propone en el resto). */
async function recordarGrupalDelCurso(opts: {
  albumId: number;
  preCompraPaymentRef: string | null;
  redemptionPaymentRefsJson: unknown;
  photoId: number;
  userId: number;
}) {
  const preCompraId = parsePreCompraOrderIdFromPaymentRef(opts.preCompraPaymentRef);
  const preCompra = preCompraId
    ? await prisma.preCompraOrder.findUnique({
        where: { id: preCompraId },
        select: { schoolCourse: { select: { name: true, division: true } } },
      })
    : null;
  const externo = parseExternalPreventaRefs(opts.redemptionPaymentRefsJson);
  const courseKey = claveDeCurso(
    preCompra?.schoolCourse ?? (externo?.courseName ? { name: externo.courseName, division: null } : null)
  );
  if (!courseKey) return;
  await prisma.schoolCourseGroupPhoto.upsert({
    where: { albumId_courseKey: { albumId: opts.albumId, courseKey } },
    create: { albumId: opts.albumId, courseKey, photoId: opts.photoId, chosenByUserId: opts.userId },
    update: { photoId: opts.photoId, chosenByUserId: opts.userId },
  });
}

/** El pack ya tiene canje: ¿lo hizo el fotógrafo o la familia? */
async function yaElegido(preventaOrderId: number) {
  const delFotografo = await prisma.schoolPhotoChosenByPhotographer.findUnique({
    where: { preventaOrderId },
    select: { id: true },
  });
  return NextResponse.json(
    {
      error: delFotografo ? "Este pack ya lo eligió el fotógrafo." : "Este pack ya lo eligió la familia.",
      code: "already_redeemed",
    },
    { status: 409 }
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  selections: z
    .array(
      z.object({
        benefitStableKey: z.string().min(1),
        units: z.array(z.array(z.number().int().positive())),
        crops: z
          .array(
            z.array(
              z
                .object({ zoom: z.number().finite(), x: z.number().finite(), y: z.number().finite() })
                .nullable()
            )
          )
          .optional(),
      })
    )
    .min(1),
  /** El fotógrafo elige por la familia («Elegir de corrido»): exige su sesión de dueño del álbum. */
  comoFotografo: z.literal(true).optional(),
  /** Modo fotógrafo: la foto del lugar grupal, para proponerla en el resto del curso. */
  grupalElegida: z.number().int().positive().optional(),
  /** Pack cobrado por fuera: la familia carga sus datos al canjear (ver `external-preventa`). */
  contacto: z
    .object({
      nombre: z.string().trim().min(1).max(120),
      email: z.string().trim().min(3).max(200),
      telefono: z.string().trim().min(6).max(40),
    })
    .optional(),
  /**
   * La revisión del librito: la familia vio todos los textos, corrigió los suyos y autorizó la
   * impresión. Obligatoria para los packs con librito.
   */
  revision: z
    .object({
      autorizado: z.literal(true),
      textos: z.record(z.string(), z.string().max(500)).optional(),
      cursos: z.array(z.string().min(1).max(300)).max(30).optional(),
      avisos: z.array(z.string().max(2000)).max(5).optional(),
      /** Nombres del listado que la familia corrigió (sólo en su librito). Se limpian en el servidor. */
      nombres: z.array(z.unknown()).max(50).optional(),
    })
    .optional(),
});

type RouteParams = {
  params: Promise<{ token: string }>;
};

export async function POST(req: Request, { params }: RouteParams) {
  const { token } = await params;
  const lookup = await getOrderIdForPackAccessToken(token);
  if (!lookup.ok) {
    const status = lookup.error === "invalid" ? 404 : 410;
    return NextResponse.json({ error: "token_invalid" }, { status });
  }

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Sin email real no hay a dónde mandar los digitales: el pack cargado por fuera los pide acá.
  const pack = await prisma.order.findUnique({
    where: { id: lookup.orderId },
    select: {
      buyerEmail: true,
      buyerName: true,
      redemptionOrderId: true,
      preventaPackSnapshotJson: true,
      albumId: true,
      album: { select: { userId: true } },
      preCompraPaymentRef: true,
      redemptionPaymentRefsJson: true,
    },
  });
  if (!pack) return NextResponse.json({ error: "token_invalid" }, { status: 404 });

  // Quién confirma: el fotógrafo (con su sesión) o la familia (si la preventa la deja).
  const comoFotografo = parsed.data.comoFotografo === true;
  const fotografo = comoFotografo ? await getAuthUser().catch(() => null) : null;
  if (comoFotografo && (!fotografo || !pack.album || !puedeUsarPackDePrueba(fotografo, pack.album.userId))) {
    return NextResponse.json({ error: "Iniciá sesión con la cuenta del fotógrafo del álbum." }, { status: 403 });
  }
  if (pack.redemptionOrderId != null) return yaElegido(lookup.orderId);
  if (!comoFotografo && pack.albumId && !familiaPuedeElegir(await cargarRegla(pack.albumId))) {
    return NextResponse.json(
      {
        error: "El fotógrafo elige las fotos de este pack. Te avisamos por correo cuando esté listo.",
        code: "photographer_chooses",
      },
      { status: 409 }
    );
  }
  // Un pack con librito no se canjea sin la autorización de impresión de la familia.
  if (pack && pack.redemptionOrderId == null && !parsed.data.revision) {
    let requiere = false;
    try {
      requiere = packRequiereAutorizacion(parsePreventaPackSnapshotV1(pack.preventaPackSnapshotJson));
    } catch {
      requiere = false;
    }
    if (requiere) {
      return NextResponse.json(
        {
          error: "Antes de confirmar, revisá los datos del librito y tildá que autorizás la impresión.",
          code: "authorization_required",
        },
        { status: 400 }
      );
    }
  }
  // El fotógrafo no sabe el email de la familia: sin contacto el canje sigue y él entrega.
  if (isPlaceholderEmail(pack.buyerEmail) && !(comoFotografo && !parsed.data.contacto)) {
    const c = parsed.data.contacto;
    if (!c) {
      return NextResponse.json({ error: "Completá tu nombre, email y WhatsApp." }, { status: 400 });
    }
    const errEmail = getCheckoutEmailValidationError(c.email);
    if (errEmail) return NextResponse.json({ error: errEmail }, { status: 400 });
    if (!isValidPhoneForPurchase(c.telefono)) {
      return NextResponse.json({ error: "Revisá el WhatsApp: tiene que llevar código de área." }, { status: 400 });
    }
    await prisma.order.update({
      where: { id: lookup.orderId },
      data: { buyerEmail: c.email.toLowerCase(), buyerName: c.nombre, buyerPhone: digitsOnly(c.telefono) },
    });
  }

  try {
    const revision = parsed.data.revision
      ? {
          pedida: parsed.data.revision,
          // En modo fotógrafo, quien revisó y autorizó la impresión es el fotógrafo.
          by: fotografo
            ? { name: fotografo.name ?? null, email: fotografo.email ?? null }
            : {
                name: parsed.data.contacto?.nombre ?? pack?.buyerName ?? null,
                email:
                  parsed.data.contacto?.email ?? (isPlaceholderEmail(pack?.buyerEmail) ? null : (pack?.buyerEmail ?? null)),
              },
          userAgent: req.headers.get("user-agent"),
        }
      : null;
    const result = await executePreventaPackRedeemV1(lookup.orderId, parsed.data.selections, revision);
    if (fotografo) {
      // Queda registrado que lo eligió el fotógrafo (el canje ya está confirmado: sin propagar).
      await prisma.schoolPhotoChosenByPhotographer
        .create({
          data: {
            preventaOrderId: lookup.orderId,
            redemptionOrderId: result.redemptionOrderId,
            photographerUserId: fotografo.id,
          },
        })
        .catch((err) => console.error("[preventa_redeem] chosen_by_photographer_failed", { err }));
      const grupal = grupalParaGuardar(
        parsed.data.grupalElegida,
        parsed.data.selections.flatMap((s) => s.units.flat())
      );
      if (grupal != null && pack.albumId) {
        await recordarGrupalDelCurso({
          albumId: pack.albumId,
          preCompraPaymentRef: pack.preCompraPaymentRef,
          redemptionPaymentRefsJson: pack.redemptionPaymentRefsJson,
          photoId: grupal,
          userId: fotografo.id,
        }).catch((err) => console.error("[preventa_redeem] group_photo_failed", { err }));
      }
    }
    const baseUrl = (process.env.APP_URL || new URL(req.url).origin).replace(/\/+$/, "");
    const { downloadUrl } = await completePreventaRedemption(
      result.redemptionOrderId,
      lookup.orderId,
      baseUrl
    );
    return NextResponse.json(
      { redemptionOrderId: result.redemptionOrderId, downloadUrl },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof PreventaPackRedeemValidationError) {
      // Confirmaron los dos a la vez: el segundo se entera de quién llegó primero.
      const ahora = await prisma.order
        .findUnique({ where: { id: lookup.orderId }, select: { redemptionOrderId: true } })
        .catch(() => null);
      if (ahora?.redemptionOrderId != null) return yaElegido(lookup.orderId);
      return NextResponse.json(
        {
          error: err.message,
          ...(err.code ? { code: err.code } : {}),
        },
        { status: err.httpStatus ?? 400 }
      );
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2034") {
        return NextResponse.json(
          { error: "Conflicto al canjear; reintentá en unos segundos" },
          { status: 409 }
        );
      }
    }
    console.error("POST /api/public/pack/[token]/redeem", err);
    return NextResponse.json({ error: "Error al procesar el canje" }, { status: 500 });
  }
}
