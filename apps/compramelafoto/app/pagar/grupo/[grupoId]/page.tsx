import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolvePilotoConfig } from "@/lib/split-1n-piloto/config";
import { ocultarCorreo } from "@/lib/split-1n-piloto/mensajes";
import { cargarGrupo, estadoDelGrupo } from "@/lib/split-1n-carrito-evento/cargar";
import { carritoActivoParaEvento, resolveCarritoConfig } from "@/lib/split-1n-carrito-evento/config";
import { urlDescargaPedido } from "@/lib/split-1n-carrito-evento/descargas";
import { finalizarGrupo } from "@/lib/split-1n-carrito-evento/finalizar-grupo";
import PagarClient from "../../[orderId]/PagarClient";

export const dynamic = "force-dynamic";

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

/**
 * Pago con tarjeta de un carrito de evento (Split 1:N): fotos de varios fotógrafos, un solo pago.
 * Con todo pagado, la misma página es el centro de descargas del grupo (un botón por fotógrafo):
 * el enlace del grupo es un UUID que sólo conoce quien compró.
 * Con el carrito apagado para el evento, un grupo sin cobrar da 404.
 */
export default async function PagarGrupoPage({ params }: { params: Promise<{ grupoId: string }> }) {
  const { grupoId } = await params;
  const piloto = resolvePilotoConfig();
  let grupo = await cargarGrupo(grupoId);
  if (!grupo) notFound();
  // El interruptor sólo decide si se puede pagar. Un grupo ya pagado o con un cobro en curso
  // sigue mostrando sus descargas (es el enlace del correo) y conciliando aunque se apague.
  const puedePagar = Boolean(piloto.publicKey) && carritoActivoParaEvento(resolveCarritoConfig(), piloto, grupo.eventId);
  // Una orden de Mercado Pago con reparto abierta también cuenta: el comprador vuelve acá desde
  // Mercado Pago y la página tiene que conciliar aunque el carrito se haya apagado.
  const yaCobrado =
    grupo.pedidos.some((p) => p.order.status === "PAID") ||
    estadoDelGrupo(grupo.pedidos) !== "PENDIENTE" ||
    grupo.pedidos.some((p) => p.marca.estado === "CHECKOUT_SPLIT");
  if (!puedePagar && !yaCobrado) notFound();

  // Conciliación al visitar: si ya hay una orden de Mercado Pago y falta confirmar algún pedido
  // (el comprador cerró la página o el aviso no llegó), se verifica y se confirma acá.
  const providerOrderId = grupo.pedidos.find((p) => p.marca.providerOrderId)?.marca.providerOrderId;
  if (providerOrderId && grupo.pedidos.some((p) => p.order.status !== "PAID")) {
    try {
      await finalizarGrupo({ grupoId: grupo.grupoId, providerOrderId });
      grupo = (await cargarGrupo(grupoId)) ?? grupo;
    } catch (err: unknown) {
      console.error("[carrito-evento] conciliacion_visita_fallida", { grupoId, err });
    }
  }

  const fotografos = await prisma.user.findMany({
    where: { id: { in: grupo.pedidos.map((p) => p.order.album?.userId).filter((id): id is number => id != null) } },
    select: { id: true, name: true },
  });
  const nombre = new Map(fotografos.map((f) => [f.id, f.name?.trim() || "Fotógrafo"]));
  const evento =
    grupo.eventId != null
      ? await prisma.event.findUnique({ where: { id: grupo.eventId }, select: { title: true, shareSlug: true } })
      : null;

  const correo = ocultarCorreo(grupo.pedidos[0].order.buyerEmail);
  const total = grupo.pedidos.reduce((acc, p) => acc + p.order.totalCents, 0);
  const todosPagados = grupo.pedidos.every((p) => p.order.status === "PAID");
  const estado = estadoDelGrupo(grupo.pedidos);
  // «Pagar con Mercado Pago» con reparto (mismo interruptor que el de un álbum). Si el grupo ya
  // tiene una orden con reparto, se sigue ahí aunque el interruptor se haya apagado.
  const mercadoPagoEnCurso = grupo.pedidos.every((p) => p.marca.estado === "CHECKOUT_SPLIT");
  const conMercadoPago = (piloto.planBSplit && puedePagar) || mercadoPagoEnCurso;
  const fotos = (n: number) => (n === 1 ? "1 foto" : `${n} fotos`);

  const descargas = todosPagados
    ? await Promise.all(
        grupo.pedidos.map(async (p) => ({
          pedidoId: p.order.id,
          fotografo: nombre.get(p.order.album?.userId ?? -1) ?? "Fotógrafo",
          url: await urlDescargaPedido(p.order.id, p.order.createdAt),
        })),
      )
    : [];

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold">
        {todosPagados ? "Tus fotos" : "Pagar tus fotos"}
      </h1>
      <p className="mt-2 text-neutral-700">
        {evento?.title ? <>Fotos de «{evento.title}» · </> : null}Total <strong>{pesos.format(total)}</strong>
      </p>
      <ul className="mt-4 divide-y rounded-lg border">
        {grupo.pedidos.map((p) => (
          <li key={p.order.id} className="flex justify-between px-4 py-2 text-sm">
            <span>
              {nombre.get(p.order.album?.userId ?? -1) ?? "Fotógrafo"} · {fotos(p.order.items.length)}
            </span>
            <span>{pesos.format(p.order.totalCents)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        {todosPagados ? (
          <div className="space-y-3">
            <p className="text-emerald-700">
              ¡Listo! El pago se acreditó. También te mandamos estos enlaces a {correo}.
            </p>
            {descargas.map((d) =>
              d.url ? (
                <a
                  key={d.pedidoId}
                  href={d.url}
                  className="block rounded-lg bg-emerald-600 px-5 py-3 text-center font-medium text-white"
                >
                  Descargar las fotos de {d.fotografo}
                </a>
              ) : (
                <p key={d.pedidoId} className="text-sm text-neutral-700">
                  Las fotos de {d.fotografo} se están preparando. Recargá la página en unos minutos.
                </p>
              ),
            )}
          </div>
        ) : estado !== "PENDIENTE" || (!puedePagar && !mercadoPagoEnCurso) ? (
          <p className="text-neutral-700">
            Estamos verificando tu pago con Mercado Pago. Te avisamos por correo a {correo} apenas se
            confirme. <strong>No pagues de nuevo.</strong>
          </p>
        ) : (
          <PagarClient
            publicKey={piloto.publicKey ?? ""}
            grupoId={grupo.grupoId}
            totalPesos={total}
            correoVisible={correo}
            volverA={evento?.shareSlug ? `/e/${evento.shareSlug}` : "/"}
            volverTexto="Volver al evento"
            planB={conMercadoPago}
            soloMercadoPago={mercadoPagoEnCurso}
            permitirTarjeta={puedePagar}
          />
        )}
      </div>
    </main>
  );
}
