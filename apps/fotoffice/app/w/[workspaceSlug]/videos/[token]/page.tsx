import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactoPublico, MarcaPublica } from "@/components/pedidos/pedido-publico";
import { PedirEnvio } from "@/components/digitalizacion/pedir-envio";
import { VerVideo } from "@/components/digitalizacion/ver-video";
import { duracionLegible, fechaArgentina, leerFranjas, pesos } from "@/lib/digitalizacion/entrega";
import { MENSAJES_CARGOS } from "@/lib/digitalizacion/servidor/cargos";
import { abrirEntregaPublica } from "@/lib/digitalizacion/servidor/videos-publicos";
import { coordenadasDelEstudio, envioParaNavegador } from "@/lib/impresiones/envio";
import { pasaElFrenoDeEnlaces } from "@/lib/pedidos/freno-publico";
import { extrasDelWorkspace } from "@/lib/presupuestos/perfil-cobro";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";
import { prisma } from "@repo/db";
import { comprarDescargaAction, extenderAction } from "./actions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspaceSlug: string; token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** El aviso de un cargo que no se pudo pedir (`?cargo=error&motivo=`): sólo códigos conocidos. */
function avisoDeCargo(cargo: unknown, motivo: unknown): string | null {
  if (cargo !== "error") return null;
  if (motivo === "limite") return "Hubo demasiados pedidos desde tu conexión. Esperá unos minutos y probá de nuevo.";
  if (typeof motivo === "string" && Object.hasOwn(MENSAJES_CARGOS, motivo)) return MENSAJES_CARGOS[motivo as keyof typeof MENSAJES_CARGOS];
  return MENSAJES_CARGOS.fallo;
}

/** El estado del envío de los cassettes, como lo lee el cliente. */
function textoDelEnvio(e: { estado: string | null; precioMinor: number | null }): string | null {
  if (e.estado === "A_PAGAR") return `Envío pedido: ${pesos(e.precioMinor ?? 0)}, pendiente de pago.`;
  if (e.estado === "CONFIRMADO") return "Envío confirmado: te vamos a escribir para coordinar el día.";
  if (e.estado === "A_COORDINAR") return "Envío a coordinar: te vamos a escribir para coordinar el envío.";
  if (e.estado === "ENTREGADO") return "Tus cassettes ya fueron entregados.";
  return null;
}

export async function generateMetadata(): Promise<Metadata> {
  // Es del cliente: no se indexa y la dirección (que lleva el token) no se manda a otros sitios.
  return { title: "Tus videos", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * La página de videos del cliente (spec 2026-10-22, E4), sin sesión: el token es la llave. Con
 * saldo pendiente no se muestran ni se firman los videos. Vencida o borrada: lo dice. Token sin
 * forma, desconocido, renovado o de otro workspace: "Enlace no disponible" (404).
 */
export default async function VideosPublicosPage({ params, searchParams }: Props) {
  const { workspaceSlug, token } = await params;
  const q = await searchParams;
  if (!(await pasaElFrenoDeEnlaces())) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 md:px-8">
        <p>Hubo demasiadas visitas desde tu conexión. Esperá unos minutos y volvé a abrir el enlace.</p>
      </main>
    );
  }
  const workspaceId = await workspaceDelSlug(workspaceSlug);
  if (!workspaceId) notFound();
  const vista = await abrirEntregaPublica(workspaceId, token);
  if (!vista) notFound();
  const base = `/w/${encodeURIComponent(workspaceSlug)}/videos/${encodeURIComponent(token)}`;
  const aviso = avisoDeCargo(q.cargo, q.motivo);
  // Para mostrar el precio del envío mientras se elige la dirección (informativo): el estudio
  // redondeado a ~100 m y las franjas. El que vale lo calcula el servidor al pedirlo.
  const [extras, ajustes] = vista.envio.puedePedir
    ? await Promise.all([
        extrasDelWorkspace(workspaceId).catch(() => null),
        prisma.digitalizacionAjustes.findUnique({ where: { workspaceId }, select: { enviosFranjas: true } }),
      ])
    : [null, null];
  const estudio = coordenadasDelEstudio(extras);
  const estudioNavegador = estudio ? envioParaNavegador({ estudio })!.estudio : null;
  const ocultos = (
    <>
      <input type="hidden" name="slug" value={workspaceSlug} />
      <input type="hidden" name="token" value={token} />
    </>
  );
  const textoEnvio = textoDelEnvio(vista.envio);

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
          {vista.urlPedido ? <a href={vista.urlPedido} className="fo-btn fo-btn-primary inline-block">Pagar el saldo</a> : null}
        </div>
      ) : vista.videosVencenAt ? (
        <p className="text-sm opacity-80">Están disponibles hasta el {fechaArgentina(vista.videosVencenAt)}. Después se borran: descargalos antes.</p>
      ) : null}

      <ul className="divide-y rounded border">
        {vista.videos.map((v) => (
          <li key={v.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">{v.titulo}</p>
              {v.duracionSeg != null ? <span className="text-sm opacity-80">{duracionLegible(v.duracionSeg)}</span> : null}
            </div>
            {vista.habilitados ? (
              <div className="flex flex-wrap items-center gap-2">
                {v.urlVer ? <VerVideo url={v.urlVer} /> : null}
                {v.quedan > 0 ? (
                  <a href={`${base}/descargar/${encodeURIComponent(v.id)}`} className="fo-btn fo-btn-secondary text-sm" rel="nofollow">
                    Descargar (quedan {v.quedan} de {v.total})
                  </a>
                ) : (
                  <span className="text-sm opacity-80">Ya usaste las {v.total} descargas de este video.</span>
                )}
              </div>
            ) : null}
            {v.descargaPendiente ? (
              <p className="text-sm">
                Descarga extra pedida: {pesos(v.descargaPendiente.montoMinor)}, pendiente de pago.{" "}
                {v.descargaPendiente.urlPagar ? <a href={v.descargaPendiente.urlPagar} className="underline">Pagarla</a> : null}
              </p>
            ) : v.puedeComprar ? (
              <form action={comprarDescargaAction}>
                {ocultos}
                <input type="hidden" name="grabacionId" value={v.id} />
                <button type="submit" className="fo-btn fo-btn-secondary text-xs">Comprar otra descarga</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      {vista.extensionPendiente ? (
        <div className="space-y-2 rounded border p-4">
          <p>Extensión de 30 días pedida: {pesos(vista.extensionPendiente.montoMinor)}, pendiente de pago.</p>
          {vista.extensionPendiente.urlPagar ? <a href={vista.extensionPendiente.urlPagar} className="fo-btn fo-btn-primary inline-block text-sm">Pagar la extensión</a> : null}
        </div>
      ) : vista.puedeExtender ? (
        <form action={extenderAction} className="space-y-2 rounded border p-4">
          {ocultos}
          <p>¿Necesitás más tiempo para descargarlos? Podés extender la disponibilidad 30 días más.</p>
          <button type="submit" className="fo-btn fo-btn-secondary text-sm">Extender 30 días</button>
        </form>
      ) : null}

      {vista.cassettesVencenAt && !vista.cancelado ? (
        <div className="space-y-2 rounded border p-4">
          {vista.envio.estado !== "CONFIRMADO" && vista.envio.estado !== "ENTREGADO" ? (
            <p>Retirá tus cassettes antes del {fechaArgentina(vista.cassettesVencenAt)}: después los descartamos porque no tenemos espacio para guardarlos.</p>
          ) : null}
          {textoEnvio ? <p className="font-semibold">{textoEnvio}</p> : null}
          {vista.envio.direccion && vista.envio.estado !== "ENTREGADO" ? <p className="text-sm opacity-80">Dirección: {vista.envio.direccion}</p> : null}
          {vista.envio.estado === "A_PAGAR" && vista.envio.urlPagar ? (
            <a href={vista.envio.urlPagar} className="fo-btn fo-btn-primary inline-block text-sm">Pagar el envío</a>
          ) : null}
          {vista.envio.puedePedir ? (
            <PedirEnvio slug={workspaceSlug} token={token} estudio={estudioNavegador} franjas={leerFranjas(ajustes?.enviosFranjas ?? null)} />
          ) : null}
        </div>
      ) : null}

      <ContactoPublico organizacion={vista.organizacion} />
    </main>
  );
}
