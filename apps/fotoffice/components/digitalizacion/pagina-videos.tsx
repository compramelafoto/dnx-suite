import type { ReactNode } from "react";
import { ContactoPublico, MarcaPublica } from "@/components/pedidos/pedido-publico";
import { PedirEnvio } from "@/components/digitalizacion/pedir-envio";
import { VerVideo } from "@/components/digitalizacion/ver-video";
import { duracionLegible, fechaArgentina, pesos, type FranjaEnvio } from "@/lib/digitalizacion/entrega";
import type { VistaVideosPrevia, VistaVideosPublica } from "@/lib/digitalizacion/servidor/videos-publicos";
import type { Punto } from "@/lib/impresiones/envio";
import { comprarDescargaAction, extenderAction } from "@/app/w/[workspaceSlug]/videos/[token]/actions";

/**
 * La página de videos del cliente (spec 2026-10-22, E4), la misma para la dirección pública y para
 * «Ver como el cliente» del equipo. En la vista previa:
 * - «Ver» usa la ruta interna de HLS (sesión), no el token, y deja reproducir aunque el cliente
 *   todavía no pueda (saldo, vencida), con una nota para el equipo.
 * - Descargar, comprar, extender, pagar y pedir envío se ven pero apagados: no llaman a nada.
 * - Sin enviar, en lugar de fechas dice que se calculan al enviar.
 */
type Props =
  | {
      modo: "PUBLICA";
      vista: VistaVideosPublica;
      slug: string;
      token: string;
      /** El aviso de un cargo que no se pudo pedir. */
      aviso: string | null;
      estudio: Punto | null;
      franjas: FranjaEnvio[];
    }
  | { modo: "PREVIA"; vista: VistaVideosPrevia };

export const LEYENDA_PREVIA = "En la vista previa no se descarga ni se compra nada.";
const SIN_FECHA = "se calcula al enviar (30 días)";

/** Un botón de la vista previa: se ve como el del cliente, pero apagado y con la leyenda. */
function Apagado({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" className={className} disabled aria-disabled="true" title={LEYENDA_PREVIA}>{children}</button>
      <span className="text-xs opacity-70">{LEYENDA_PREVIA}</span>
    </span>
  );
}

/** El estado del envío de los cassettes, como lo lee el cliente. */
function textoDelEnvio(e: { estado: string | null; precioMinor: number | null }): string | null {
  if (e.estado === "A_PAGAR") return `Envío pedido: ${pesos(e.precioMinor ?? 0)}, pendiente de pago.`;
  if (e.estado === "CONFIRMADO") return "Envío confirmado: te vamos a escribir para coordinar el día.";
  if (e.estado === "A_COORDINAR") return "Envío a coordinar: te vamos a escribir para coordinar el envío.";
  if (e.estado === "ENTREGADO") return "Tus cassettes ya fueron entregados.";
  return null;
}

/** Un enlace para pagar: en la pública, el enlace (si hay); en la vista previa, apagado. */
function Pagar({ previa, url, className, children }: { previa: boolean; url: string | null; className: string; children: ReactNode }) {
  if (previa) return <Apagado className={className}>{children}</Apagado>;
  return url ? <a href={url} className={className}>{children}</a> : null;
}

export function PaginaVideos(props: Props) {
  const { vista } = props;
  const previa = props.modo === "PREVIA" ? props.vista : null;
  const base = props.modo === "PUBLICA" ? `/w/${encodeURIComponent(props.slug)}/videos/${encodeURIComponent(props.token)}` : null;
  const sinEnviar = previa !== null && !previa.enviada;
  const ocultos = props.modo === "PUBLICA" ? (
    <>
      <input type="hidden" name="slug" value={props.slug} />
      <input type="hidden" name="token" value={props.token} />
    </>
  ) : null;
  const textoEnvio = textoDelEnvio(vista.envio);
  const aviso = props.modo === "PUBLICA" ? props.aviso : null;
  const mostrarCassettes = (vista.cassettesVencenAt || sinEnviar) && !vista.cancelado;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <MarcaPublica organizacion={vista.organizacion}>
        <p className="font-semibold">Pedido N° {vista.pedidoNumero}</p>
        {vista.cliente ? <p className="opacity-80">{vista.cliente}</p> : null}
      </MarcaPublica>

      <h1 className="text-2xl font-semibold">{vista.videos.length === 1 ? "Tu video" : "Tus videos"}</h1>

      {aviso ? <p role="alert" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{aviso}</p> : null}

      {vista.cancelado ? (
        <p className="rounded border p-4">Este pedido fue cancelado.</p>
      ) : vista.borradosAt ? (
        <p className="rounded border p-4">Los videos se borraron el {fechaArgentina(vista.borradosAt)}.</p>
      ) : vista.saldoMinor > 0 ? (
        <div className="space-y-3 rounded border p-4">
          <p>Pagá el saldo de {pesos(vista.saldoMinor)} para habilitar tus videos.</p>
          <Pagar previa={previa !== null} url={vista.urlPedido} className="fo-btn fo-btn-primary inline-block">Pagar el saldo</Pagar>
        </div>
      ) : vista.videosVencenAt ? (
        <p className="text-sm opacity-80">Están disponibles hasta el {fechaArgentina(vista.videosVencenAt)}. Después se borran: descargalos antes.</p>
      ) : sinEnviar ? (
        <p className="text-sm opacity-80">Están disponibles hasta: {SIN_FECHA}. Después se borran: descargalos antes.</p>
      ) : null}

      <ul className="divide-y rounded border">
        {vista.videos.map((v) => {
          const verEquipo = previa ? previa.videos.find((x) => x.id === v.id)?.verComoEquipo === true : false;
          const sinHls = v.vistaPreviaAgotada ? (
            <span className="text-sm opacity-80">No pudimos preparar la vista previa; podés descargar el video.</span>
          ) : (
            <span className="text-sm opacity-80">La versión para mirar se está preparando.</span>
          );
          return (
            <li key={v.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{v.titulo}</p>
                {v.duracionSeg != null ? <span className="text-sm opacity-80">{duracionLegible(v.duracionSeg)}</span> : null}
              </div>
              {vista.habilitados ? (
                <div className="flex flex-wrap items-center gap-2">
                  {previa ? (
                    verEquipo ? <VerVideo src={`/api/digitalizacion/grabaciones/${encodeURIComponent(v.id)}/hls`} /> : sinHls
                  ) : v.vistaPrevia ? (
                    <VerVideo src={`${base}/ver/${encodeURIComponent(v.id)}`} />
                  ) : sinHls}
                  {v.quedan > 0 ? (
                    previa ? (
                      <Apagado className="fo-btn fo-btn-secondary text-sm">Descargar (quedan {v.quedan} de {v.total})</Apagado>
                    ) : (
                      <a href={`${base}/descargar/${encodeURIComponent(v.id)}`} className="fo-btn fo-btn-secondary text-sm" rel="nofollow">
                        Descargar (quedan {v.quedan} de {v.total})
                      </a>
                    )
                  ) : (
                    <span className="text-sm opacity-80">Ya usaste las {v.total} descargas de este video.</span>
                  )}
                </div>
              ) : previa ? (
                // El cliente no ve nada acá (saldo, vencida o cancelada); el equipo puede mirarlo igual.
                <div className="flex flex-wrap items-center gap-2">
                  {verEquipo ? <VerVideo src={`/api/digitalizacion/grabaciones/${encodeURIComponent(v.id)}/hls`} /> : sinHls}
                  <span className="text-sm italic opacity-70">(Como equipo podés reproducirlo igual)</span>
                </div>
              ) : null}
              {v.descargaPendiente ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>Descarga extra pedida: {pesos(v.descargaPendiente.montoMinor)}, pendiente de pago.</span>
                  <Pagar previa={previa !== null} url={v.descargaPendiente.urlPagar} className={previa ? "fo-btn fo-btn-secondary text-xs" : "underline"}>Pagarla</Pagar>
                </div>
              ) : v.puedeComprar ? (
                previa ? (
                  <Apagado className="fo-btn fo-btn-secondary text-xs">Comprar otra descarga</Apagado>
                ) : (
                  <form action={comprarDescargaAction}>
                    {ocultos}
                    <input type="hidden" name="grabacionId" value={v.id} />
                    <button type="submit" className="fo-btn fo-btn-secondary text-xs">Comprar otra descarga</button>
                  </form>
                )
              ) : null}
            </li>
          );
        })}
      </ul>

      {vista.extensionPendiente ? (
        <div className="space-y-2 rounded border p-4">
          <p>Extensión de 30 días pedida: {pesos(vista.extensionPendiente.montoMinor)}, pendiente de pago.</p>
          <Pagar previa={previa !== null} url={vista.extensionPendiente.urlPagar} className="fo-btn fo-btn-primary inline-block text-sm">Pagar la extensión</Pagar>
        </div>
      ) : vista.puedeExtender ? (
        previa ? (
          <div className="space-y-2 rounded border p-4">
            <p>¿Necesitás más tiempo para descargarlos? Podés extender la disponibilidad 30 días más.</p>
            <Apagado className="fo-btn fo-btn-secondary text-sm">Extender 30 días</Apagado>
          </div>
        ) : (
          <form action={extenderAction} className="space-y-2 rounded border p-4">
            {ocultos}
            <p>¿Necesitás más tiempo para descargarlos? Podés extender la disponibilidad 30 días más.</p>
            <button type="submit" className="fo-btn fo-btn-secondary text-sm">Extender 30 días</button>
          </form>
        )
      ) : null}

      {mostrarCassettes ? (
        <div className="space-y-2 rounded border p-4">
          {vista.envio.estado !== "CONFIRMADO" && vista.envio.estado !== "ENTREGADO" ? (
            vista.cassettesVencenAt ? (
              <p>Retirá tus cassettes antes del {fechaArgentina(vista.cassettesVencenAt)}: después los descartamos porque no tenemos espacio para guardarlos.</p>
            ) : (
              <p>Retirá tus cassettes antes de: {SIN_FECHA}. Después los descartamos porque no tenemos espacio para guardarlos.</p>
            )
          ) : null}
          {textoEnvio ? <p className="font-semibold">{textoEnvio}</p> : null}
          {vista.envio.direccion && vista.envio.estado !== "ENTREGADO" ? <p className="text-sm opacity-80">Dirección: {vista.envio.direccion}</p> : null}
          {vista.envio.estado === "A_PAGAR" ? (
            <Pagar previa={previa !== null} url={vista.envio.urlPagar} className="fo-btn fo-btn-primary inline-block text-sm">Pagar el envío</Pagar>
          ) : null}
          {vista.envio.puedePedir ? (
            props.modo === "PUBLICA" ? (
              <PedirEnvio slug={props.slug} token={props.token} estudio={props.estudio} franjas={props.franjas} />
            ) : (
              <Apagado className="fo-btn fo-btn-secondary text-sm">Pedir envío de los cassettes</Apagado>
            )
          ) : null}
        </div>
      ) : null}

      <ContactoPublico organizacion={vista.organizacion} />
    </main>
  );
}
