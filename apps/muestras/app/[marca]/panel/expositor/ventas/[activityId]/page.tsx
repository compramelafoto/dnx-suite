import Link from "next/link";
import { notFound } from "next/navigation";
import { ORDER_STATUS_LABELS, SALE_SPLIT_TEXT, formatArDay, formatArDayLong, isOrderStatus, splitExample } from "@repo/muestras";
import { aviso, enlace, nota, seccion } from "@/components/ventas/estilos";
import { FirmaAutor } from "@/components/ventas/firma-autor";
import { AceptarReparto, OfertasDeObra } from "@/components/ventas/ofertas-autor";
import { SubirOriginal } from "@/components/ventas/subir-original";
import { ventaDelAutor } from "@/lib/ventas/consultas";
import { ventasDelAutor } from "@/lib/ventas/pedidos-consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
/** `confirmarOriginal` lee el archivo entero (hasta 80 MB) para su huella: puede tardar. */
export const maxDuration = 60;
export const metadata = { title: "Vender tus obras" };

const COBRO: Record<string, string> = {
  NONE: "Todavía no conectaste tu Mercado Pago.",
  PENDING: "Falta que aceptes en Mercado Pago.",
  ACTIVE: "Mercado Pago conectado: recibís tu parte en el momento de cada venta.",
};

const pesos = (n: number) => `$${n.toLocaleString("es-AR")}`;

export default async function VenderTusObras({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  const usuario = await requireUsuario(`/panel/expositor/ventas/${activityId}`);
  const v = await ventaDelAutor(activityId, usuario);
  if (!v) notFound();
  const ventas = await ventasDelAutor(activityId, usuario);
  const s = v.setup;
  const aceptado = s != null && v.terminos?.splitVersion === s.splitVersion;
  const ejemplo = s ? splitExample(100_000, { platformFeeBps: s.platformFeeBps, organizerBps: s.organizerBps }) : null;
  return (
    <main className="max-w-3xl space-y-8">
      <Link href="/panel/expositor" className="text-sm text-[var(--mf-accent)] underline underline-offset-4">Volver a Dónde expongo</Link>
      <header className="space-y-2">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Vender tus obras</h1>
        <p className="text-lg text-[var(--mf-muted)]">{v.actividad.title}</p>
      </header>
      {v.modo !== "LIVE" ? <p className={aviso}>La venta todavía no está habilitada para el público: podés dejar todo listo.</p> : null}
      <p className={nota}>
        Copia única: se vende una sola. Edición limitada: elegís cuántas (N) y cada una lleva su número y su certificado. Impresa: Fine Art / premium; poné el papel y la medida.
      </p>

      <section className={seccion}>
        <h2 className="mf-titulo text-2xl">1. Reparto</h2>
        {s ? (
          <>
            <p className="text-[15px]">{SALE_SPLIT_TEXT({ activityTitle: v.actividad.title, platformFeeBps: s.platformFeeBps, organizerBps: s.organizerBps, photographerBps: s.photographerBps })}</p>
            {ejemplo ? <p className={nota}>De una venta de {pesos(100_000)}: plataforma {pesos(ejemplo.plataforma)}, organización {pesos(ejemplo.organizacion)}, vos {pesos(ejemplo.fotografo)}.</p> : null}
            {aceptado ? (
              <p className="text-[15px]">Aceptado el {formatArDayLong(v.terminos!.acceptedAt)}.</p>
            ) : (
              <>
                {v.terminos ? <p className="text-[15px] text-[var(--mf-alerta)]">La organización cambió el reparto: revisalo y aceptalo de nuevo.</p> : null}
                <AceptarReparto activityId={v.actividad.id} splitVersion={s.splitVersion} />
              </>
            )}
          </>
        ) : (
          <p className={nota}>La organización todavía no fijó el reparto de la venta.</p>
        )}
      </section>

      <section className={seccion}>
        <h2 className="mf-titulo text-2xl">2. Tu firma</h2>
        <p className={nota}>Una sola vez para todas tus muestras.</p>
        <FirmaAutor cargada={v.firma ? formatArDayLong(v.firma) : null} />
      </section>

      <section className={seccion}>
        <h2 className="mf-titulo text-2xl">3. Cobros</h2>
        <p className="text-[15px]">
          {COBRO[v.cobro.status] ?? "Mercado Pago dice que no está aceptado: volvé a pedirlo."} <Link href="/panel/cobros" className={enlace}>Ir a Cobros</Link>
        </p>
      </section>

      <section className={seccion}>
        <h2 className="mf-titulo text-2xl">4. Tus obras</h2>
        <ul className="space-y-10">
          {v.obras.map((o) => {
            const vendio = o.ofertas.some((f) => f.evaluacion.vendidas > 0 || f.firstSoldAt != null);
            return (
              <li key={o.activityWorkId} className="grid gap-5 sm:grid-cols-[10rem_1fr]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.imageUrl} alt={o.title} className="aspect-square w-40 bg-[var(--mf-surface)] object-contain" />
                <div className="space-y-4">
                  <p className="mf-titulo text-xl">{o.title}</p>
                  <div className="space-y-1">
                    <p className="text-[15px]">
                      Archivo original:{" "}
                      {o.original?.status === "READY"
                        ? `listo, ${o.original.widthPx} × ${o.original.heightPx} px`
                        : o.original?.status === "REJECTED"
                          ? `rechazado: ${o.original.problem ?? "no es una imagen válida"}`
                          : "falta"}
                    </p>
                    <p className={nota}>JPEG, PNG o TIFF de hasta 80 MB, en la mayor calidad que tengas. Es privado: sólo se usa para imprimir y para la copia digital.</p>
                    <SubirOriginal activityWorkId={o.activityWorkId} hayOriginal={o.original?.status === "READY"} bloqueado={vendio} />
                  </div>
                  <OfertasDeObra obra={o} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section className={seccion}>
        <h2 className="mf-titulo text-2xl">Tus ventas</h2>
        {ventas.length === 0 ? <p className={nota}>Todavía no vendiste copias en esta muestra.</p> : (
          <ul className="border-t border-[var(--mf-line)] text-[15px]">
            {ventas.map((x) => (
              <li key={x.id} className="space-y-1 border-b border-[var(--mf-line)] py-3">
                <p className="font-medium">{x.obra} · {x.formato === "PRINT" ? "impresa" : "digital"}{x.numero ? ` · ${x.numero}` : ""}{x.prueba ? " · Prueba" : ""}</p>
                <p className={nota}>
                  {x.fecha ? formatArDay(x.fecha) : ""} · {isOrderStatus(x.status) ? ORDER_STATUS_LABELS[x.status] : x.status} · tu parte {pesos(x.tuParteCents / 100)}
                  {x.comprador ? ` · a nombre de ${x.comprador}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
