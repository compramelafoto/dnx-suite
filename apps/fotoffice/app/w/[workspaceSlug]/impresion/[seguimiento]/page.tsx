import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { verificarVueltaImpresion } from "@/lib/impresiones/acreditar-servidor";
import { etiquetaTamano } from "@/lib/impresiones/carpeta-lab";
import { ETIQUETA_PAPEL, type Papel } from "@/lib/impresiones/constantes";
import { PASOS, pasoDelPedido } from "@/lib/impresiones/seguimiento";
import { fasesDeTrabajos } from "@/lib/impresiones/seguimiento-servidor";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  // Es privada: no se indexa y la dirección (que lleva el token) no se manda a otros sitios.
  return { title: "Seguimiento del pedido", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

const primero = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

function fechaLarga(d: Date): string {
  return d.toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
}

/** Seguimiento público de un pedido de copias impresas (enlace privado) y vuelta de Mercado Pago. */
export default async function SeguimientoImpresionPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string; seguimiento: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspaceSlug, seguimiento } = await params;
  const consulta = await searchParams;
  // El estudio sale siempre de la dirección, nunca de los parámetros de la consulta.
  const workspaceId = await workspaceDelSlug(workspaceSlug);
  if (!workspaceId) notFound();

  const buscar = () =>
    prisma.fotofficePrintOrder.findFirst({
      where: { trackingToken: seguimiento, workspaceId },
      select: {
        id: true,
        number: true,
        status: true,
        paper: true,
        promisedAt: true,
        items: { select: { widthCm: true, heightCm: true, quantity: true, proyectoId: true } },
      },
    });
  let pedido = await buscar();
  if (!pedido) notFound();

  // Vuelta de Mercado Pago: si todavía figura sin pagar, se confirma el pago en el momento.
  let rechazado = false;
  if (primero(consulta.pago) !== undefined && pedido.status === "PENDIENTE_PAGO") {
    const paymentId = primero(consulta.payment_id) ?? primero(consulta.collection_id);
    const r = await verificarVueltaImpresion(workspaceId, pedido.id, paymentId);
    if (r.estado === "PAGADO") pedido = (await buscar()) ?? pedido;
    else rechazado = r.estado === "RECHAZADO";
  }

  const cancelado = pedido.status === "CANCELADO";
  const esperando = pedido.status === "PENDIENTE_PAGO";
  const confirmado = !cancelado && !esperando;

  const proyectoIds = [...new Set(pedido.items.map((i) => i.proyectoId).filter((x): x is string => x !== null))];
  const fases = pedido.status === "ENVIADO" ? await fasesDeTrabajos(workspaceId, proyectoIds) : [];
  const actual = PASOS.findIndex((p) => p.clave === pasoDelPedido(pedido.status, fases));

  // Copias por tamaño.
  const porTamano = new Map<string, number>();
  for (const i of pedido.items) {
    const t = etiquetaTamano(Number(i.widthCm), Number(i.heightCm));
    porTamano.set(t, (porTamano.get(t) ?? 0) + i.quantity);
  }
  const papel = ETIQUETA_PAPEL[pedido.paper as Papel] ?? pedido.paper;

  const titulo = cancelado
    ? "Este pedido fue cancelado"
    : confirmado
      ? "¡Pedido confirmado!"
      : rechazado
        ? "No pudimos confirmar tu pago"
        : "Estamos esperando la confirmación del pago";
  const detalle = cancelado
    ? "Si pagaste y no esperabas esto, escribile al estudio."
    : confirmado
      ? "Ya recibimos tu pago. Guardá esta página: acá podés seguir tu pedido."
      : rechazado
        ? "El pago no se completó. Podés volver a intentarlo desde el enlace de tu carpeta de archivos."
        : "Mercado Pago todavía no nos avisó. Puede demorar unos minutos: recargá esta página en un rato.";

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <p className="mt-2 text-sm text-neutral-600">{detalle}</p>

      <section className="mt-6 rounded-lg border border-neutral-200 p-4">
        <p className="text-sm text-neutral-500">Pedido</p>
        <p className="text-lg font-medium">N° {pedido.number}</p>
        <p className="mt-3 text-sm text-neutral-500">Copias · papel {papel}</p>
        <ul className="mt-1 text-sm">
          {[...porTamano].map(([t, n]) => (
            <li key={t}>
              {n} {n === 1 ? "copia" : "copias"} de {t} cm
            </li>
          ))}
        </ul>
        {confirmado && pedido.promisedAt && (
          <p className="mt-3 text-sm">
            <span className="text-neutral-500">Entrega prometida: </span>
            {fechaLarga(pedido.promisedAt)}
          </p>
        )}
      </section>

      {confirmado && (
        <ol className="mt-6 space-y-2" aria-label="Pasos del pedido">
          {PASOS.map((p, i) => (
            <li
              key={p.clave}
              aria-current={i === actual ? "step" : undefined}
              className={`rounded-md border px-3 py-2 text-sm ${i === actual ? "border-neutral-900 bg-neutral-900 font-medium text-white" : i < actual ? "border-neutral-300 text-neutral-700" : "border-neutral-200 text-neutral-400"}`}
            >
              {i < actual ? "✓ " : ""}
              {p.titulo}
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
