import "server-only";
import { NextResponse } from "next/server";
import { verifyMercadoPagoWebhookSignature } from "@repo/payments/mercado-pago/webhook-signature";
import { extractPaymentId } from "@/lib/bookings/webhook-payload";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { fetchMpPayment, MpReadError } from "./client";
import { syncMpPayment } from "./sync";
import { findWorkspaceByPaymentId, listConnectedWorkspaceIds } from "./workspaces";

/**
 * El aviso de Mercado Pago, para cualquier cobro de FOTOFFICE.
 *
 * Las cuatro direcciones de aviso (cuotas, reservas, cursos, tienda) siguen existiendo porque
 * las preferencias ya creadas apuntan a ellas, pero todas terminan acá. Antes cada una cortaba
 * con "aviso repetido" si el cobro ya estaba registrado, y por eso una devolución o un
 * contracargo posterior no llegaba nunca: ahora siempre se le pregunta a Mercado Pago el estado
 * actual y se aplica lo que corresponda (todo es idempotente).
 *
 * **Siempre responde 200.** Un error hace que Mercado Pago reintente durante días y casi nunca
 * se arregla reintentando; lo que no se aplica acá lo encuentra la revisión diaria.
 *
 * **Firma.** No se confía en el cuerpo (trae sólo un id; el pago se lee con el token de la
 * institución), así que la firma es una segunda barrera. Con `FOTOFFICE_MP_WEBHOOK_SECRET`
 * cargada se verifica; si no coincide, se registra, y sólo se rechaza el aviso cuando además
 * `FOTOFFICE_MP_WEBHOOK_SIGNATURE=enforce`. Así cargar la clave nunca deja de acreditar pagos
 * por un error de configuración.
 */
export async function handleMercadoPagoWebhook(request: Request, origen: string): Promise<NextResponse> {
  const url = new URL(request.url);
  const cuerpo = await request.json().catch(() => null);
  const paymentId = extractPaymentId(cuerpo, url);
  if (!paymentId) return NextResponse.json({ ignored: "sin identificador de pago" });

  const secreto = process.env.FOTOFFICE_MP_WEBHOOK_SECRET;
  if (secreto) {
    const firma = verifyMercadoPagoWebhookSignature({
      signatureHeader: request.headers.get("x-signature"),
      requestIdHeader: request.headers.get("x-request-id"),
      dataId: paymentId,
      queryDataId: url.searchParams.get("data.id"),
      secret: secreto,
    });
    if (!firma.ok) {
      console.warn("[fotoffice][mp-webhook] firma inválida", { origen, paymentId, motivo: firma.reason });
      if (process.env.FOTOFFICE_MP_WEBHOOK_SIGNATURE === "enforce") {
        return NextResponse.json({ ignored: "firma inválida" }, { status: 401 });
      }
    }
  }

  try {
    const conocido = await findWorkspaceByPaymentId(paymentId);
    const candidatos = await listConnectedWorkspaceIds();
    const orden = conocido ? [conocido, ...candidatos.filter((w) => w !== conocido)] : candidatos;

    for (const workspaceId of orden) {
      const collector = await resolveWorkspaceCollector(workspaceId);
      if (!collector.ok) continue;
      let hechos;
      try {
        hechos = await fetchMpPayment(collector.collector.accessToken, paymentId);
      } catch (error) {
        // 404/403: el pago no es de esta institución. Se prueba con la siguiente.
        if (error instanceof MpReadError && (error.status === 404 || error.status === 403 || error.status === 401)) {
          continue;
        }
        throw error;
      }
      const r = await syncMpPayment(workspaceId, hechos);
      return NextResponse.json({ ok: true, ...r });
    }
    return NextResponse.json({ ok: true, applied: false, motivo: "ninguna institución reconoce el pago" });
  } catch (error) {
    console.error("[fotoffice][mp-webhook] falló el aviso", { origen, paymentId, detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, motivo: "error interno" });
  }
}
