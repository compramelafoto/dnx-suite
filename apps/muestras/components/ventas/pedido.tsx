import Link from "next/link";
import { formatArDay, formatCertificateCode } from "@repo/muestras";
import { CopiarEnlace } from "@/components/enlace/copiar-enlace";
import type { VistaDelPedido } from "@/lib/ventas/pedido-comprador";
import { aviso, botonFino, botonLleno, nota, seccion } from "./estilos";

const pesos = (n: number) => `$${n.toLocaleString("es-AR")}`;

/** La página del pedido del comprador (etapa 8): estado, copia, entrega, certificado y descargas. */
export function Pedido({ v }: { v: VistaDelPedido }) {
  const base = `/compras/${v.publicId}`;
  return (
    <main className="mf-marco max-w-2xl space-y-6 py-8 sm:py-12">
      <p className="text-sm text-[var(--mf-muted)]">Tu pedido{v.prueba ? " · Prueba" : ""}</p>
      <h1 className="mf-titulo text-[clamp(1.8rem,4.5vw,2.6rem)]">{v.estado}</h1>
      {v.status === "PENDING_PAYMENT" ? <p className={nota}>Si ya pagaste, no vuelvas a pagar: recargá esta página en unos minutos.</p> : null}

      <section className={seccion}>
        <h2 className="text-xl">{v.obra.title}</h2>
        <p>{v.obra.authorName}</p>
        <p className="text-[15px]">{v.formato}</p>
        {v.numero ? <p className="text-lg">{v.numeroEsCopiaUnica ? "Tu copia es la copia única" : `Tu copia es la ${v.numero}`}</p> : null}
        <p className="text-[15px]">
          Total: <strong>{pesos(v.totalArs)}</strong>
          {v.envioArs > 0 ? ` (incluye envío ${pesos(v.envioArs)})` : ""}
        </p>
      </section>

      {v.entrega.tipo !== "DIGITAL" ? (
        <section className={seccion}>
          <h2 className="text-lg">{v.entrega.tipo === "SHIPPING" ? "Envío" : "Retiro en la sede"}</h2>
          {v.entrega.texto ? <p className="text-[15px]">{v.entrega.texto}</p> : null}
          {v.entrega.direccion ? <p className="text-[15px]">Dirección: {v.entrega.direccion}</p> : null}
          {v.produccion.length ? (
            <ol className="space-y-1 text-[15px]">
              {v.produccion.map((p) => (
                <li key={p.texto} className={p.hecho ? "" : "text-[var(--mf-muted)]"}>
                  {p.hecho ? "✓" : "○"} {p.texto}{p.fecha ? ` — ${formatArDay(p.fecha)}` : ""}
                </li>
              ))}
            </ol>
          ) : null}
          {v.seguimiento ? <p className="text-[15px]">Seguimiento: {v.seguimiento}</p> : null}
        </section>
      ) : null}

      {v.certificado ? (
        <section className={seccion}>
          <h2 className="text-lg">Certificado de autenticidad</h2>
          <p className="text-[15px]">Código {formatCertificateCode(v.certificado.codigo)}</p>
          <div className="flex flex-wrap gap-3">
            <a href={`${base}/certificado`} className={botonLleno}>Descargar certificado (PDF)</a>
            {v.digital ? <a href={`${base}/archivo`} className={botonFino}>Descargar archivo firmado</a> : null}
            <Link href={`/verificar/${v.certificado.codigo}`} className={botonFino}>Verificar en línea</Link>
          </div>
        </section>
      ) : v.status === "PAID" && !v.copiaAnulada ? (
        <p className={nota}>Estamos preparando tu certificado. Recargá la página en unos minutos.</p>
      ) : null}
      {v.copiaAnulada ? <p className={nota}>Esta copia fue anulada.</p> : null}

      <section className={`${aviso} space-y-3`}>
        <p>Guardá este enlace: es la forma de volver a tu pedido y a tu certificado.</p>
        <CopiarEnlace url={v.enlace} etiqueta="Enlace de tu pedido" />
      </section>

      {v.muestra ? (
        <section className={seccion}>
          <h2 className="text-lg">La organización</h2>
          <p className="text-[15px]">
            <Link href={`/m/${v.muestra.slug}`} className="underline underline-offset-[6px]">{v.muestra.title}</Link>
          </p>
          {v.muestra.organizadores ? <p className="text-[15px]">{v.muestra.organizadores}</p> : null}
          {v.muestra.sede ? <p className="text-[15px]">{v.muestra.sede}</p> : null}
        </section>
      ) : null}

      {v.arrepentimiento.pedido ? (
        <p className={nota}>Pediste el arrepentimiento de esta compra. La organización y la plataforma lo están revisando.</p>
      ) : v.arrepentimiento.puede ? (
        <p className="border-t border-[var(--mf-line)] pt-4 text-[15px]">
          <Link href={`${base}/arrepentimiento`} className="underline underline-offset-[6px]">Botón de arrepentimiento</Link>
        </p>
      ) : null}
    </main>
  );
}
