import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactoPublico, MarcaPublica } from "@/components/pedidos/pedido-publico";
import { VerVideo } from "@/components/digitalizacion/ver-video";
import { duracionLegible, fechaArgentina, pesos } from "@/lib/digitalizacion/entrega";
import { abrirEntregaPublica } from "@/lib/digitalizacion/servidor/videos-publicos";
import { pasaElFrenoDeEnlaces } from "@/lib/pedidos/freno-publico";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string; token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  // Es del cliente: no se indexa y la dirección (que lleva el token) no se manda a otros sitios.
  return { title: "Tus videos", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * La página de videos del cliente (spec 2026-10-22, E4), sin sesión: el token es la llave. Con
 * saldo pendiente no se muestran ni se firman los videos. Vencida o borrada: lo dice. Token sin
 * forma, desconocido, renovado o de otro workspace: "Enlace no disponible" (404).
 */
export default async function VideosPublicosPage({ params }: Props) {
  const { workspaceSlug, token } = await params;
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

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <MarcaPublica organizacion={vista.organizacion}>
        <p className="font-semibold">Pedido N° {vista.pedidoNumero}</p>
        {vista.cliente ? <p className="opacity-80">{vista.cliente}</p> : null}
      </MarcaPublica>

      <h1 className="text-2xl font-semibold">{vista.videos.length === 1 ? "Tu video" : "Tus videos"}</h1>

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
            {!vista.borradosAt && !vista.cancelado ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled title="Muy pronto">Comprar otra descarga · Muy pronto</button>
                <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled title="Muy pronto">Extender 30 días · Muy pronto</button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {vista.cassettesVencenAt && !vista.cancelado ? (
        <div className="space-y-2 rounded border p-4">
          <p>Retirá tus cassettes antes del {fechaArgentina(vista.cassettesVencenAt)}: después los descartamos porque no tenemos espacio para guardarlos.</p>
          <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled title="Muy pronto">Pedir envío de los cassettes · Muy pronto</button>
        </div>
      ) : null}

      <ContactoPublico organizacion={vista.organizacion} />
    </main>
  );
}
