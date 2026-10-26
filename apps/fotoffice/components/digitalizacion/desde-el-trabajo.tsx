// apps/fotoffice/components/digitalizacion/desde-el-trabajo.tsx
import Link from "next/link";
import { AccionesGrabacion } from "@/components/digitalizacion/acciones-grabacion";
import { AccionesEntrega, EnvioYCargos, VerComoCliente } from "@/components/digitalizacion/entregas";
import { extensionDeMime } from "@/lib/digitalizacion/claves";
import { duracionLegible, estadoVisibleDeEntrega, fechaArgentina, fechaHoraArgentina } from "@/lib/digitalizacion/entrega";
import { nombreArchivoVideo, nombreCliente } from "@/lib/digitalizacion/nombre-archivo";
import type { EntregaDelPedido, TrabajoDeDigitalizacion } from "@/lib/digitalizacion/servidor/trabajo";
import {
  ETIQUETA_ESTADO_GRABACION, datosTextoEntrega, estadoDeGrabacion, textoDeDescargas, textoDeEntrega, textoDeSaldo, type EstadoDeGrabacion,
} from "@/lib/digitalizacion/trabajo";
import { estadoVisible } from "@/lib/digitalizacion/validar";

/**
 * Digitalización desde la ficha del trabajo y la del pedido: grabar sin volver a buscar el pedido,
 * las grabaciones del trabajo y el estado de la entrega. Reutiliza los botones de la lista de
 * Digitalización (`AccionesGrabacion`, `AccionesEntrega`, `EnvioYCargos`), con sus mismas acciones
 * y permisos: el servidor los vuelve a decidir en cada una.
 */

const urlGrabar = (proyectoId: string) => `/digitalizacion/grabar?proyecto=${encodeURIComponent(proyectoId)}`;

/** "dd/mm/aaaa hh:mm" en hora argentina. */
function fechaYHora(d: Date): string {
  return `${fechaArgentina(d)} ${fechaHoraArgentina(d).split(" ")[1]}`;
}

const CLASE_ESTADO: Partial<Record<EstadoDeGrabacion, string>> = {
  INTERRUMPIDA: "fo-alert-warning px-2",
  ERROR: "fo-alert-warning px-2",
};

/** El estado de la entrega de un pedido: texto, saldo, casilla, envío de cassettes, extras y botones. */
export function EstadoDeEntrega({ entrega, puedeGrabar, envioAutomatico, ahora, conDescargas = false }: {
  entrega: EntregaDelPedido;
  puedeGrabar: boolean;
  /** El valor por defecto del negocio, para una entrega que todavía no tiene fila. */
  envioAutomatico: boolean;
  ahora: Date;
  /** La ficha del pedido muestra las descargas acá; la del trabajo, en cada grabación. */
  conDescargas?: boolean;
}) {
  const r = entrega.resumen;
  const estado = estadoVisibleDeEntrega(
    { preparacion: r.preparacion, enviadoAt: r.entrega?.enviadoAt ?? null, videosVencenAt: r.entrega?.videosVencenAt ?? null, videosBorradosAt: r.entrega?.videosBorradosAt ?? null },
    ahora,
  );
  const saldo = textoDeSaldo(entrega.saldoMinor);
  return (
    <div className="space-y-2 text-sm">
      <p className={estado === "CON_ERROR" ? "fo-alert-warning px-2" : "font-medium"}>{textoDeEntrega(estado, datosTextoEntrega(r, envioAutomatico), ahora)}</p>
      {saldo && !r.cancelado && estado !== "BORRADA" ? <p className="fo-alert-warning px-2">{saldo}</p> : null}
      {entrega.casillaConProblema && r.email ? (
        <p className="fo-alert-warning px-2">
          Ojo: la casilla {r.email} rebotó o se dio de baja de los correos del estudio. Si rebotó, el correo de los videos tampoco le llega: confirmá la dirección con el cliente.
        </p>
      ) : null}
      {conDescargas && r.entrega?.enviadoAt && entrega.videos.length > 0 ? (
        <ul className="space-y-0.5 text-[var(--fo-muted)]">
          {entrega.videos.map((v) => (
            <li key={v.id}>{v.titulo}: {textoDeDescargas({ usadas: entrega.descargas.get(v.id) ?? 0, descargasExtra: v.descargasExtra })}</li>
          ))}
        </ul>
      ) : null}
      <EnvioYCargos entregaId={r.entrega?.id ?? null} envio={r.envio} cargos={r.cargosPendientes} aRevisar={r.cargosARevisar} puedeGestionar={puedeGrabar} />
      {puedeGrabar && !r.cancelado ? (
        <AccionesEntrega pedidoId={r.pedidoId} entregaId={r.entrega?.id ?? null} estado={estado} tieneEmail={r.tieneEmail} envioAutomatico={r.entrega?.envioAutomatico ?? envioAutomatico}>
          <VerComoCliente pedidoId={r.pedidoId} />
        </AccionesEntrega>
      ) : (
        <div><VerComoCliente pedidoId={r.pedidoId} /></div>
      )}
    </div>
  );
}

type GrabacionDelTrabajo = {
  id: string; titulo: string | null; tipo: string; estado: string; cassetteNumero: number | null; duracionSeg: number; iniciadaAt: Date;
  ultimoLatidoAt: Date | null; sinImagen: boolean; mimeType: string; conversionEstado: string | null; conversionError: string | null;
  videoDuracionSeg: number | null; partesBorradasAt: Date | null; hlsKey: string | null; videoBorradoAt: Date | null; descargasExtra: number;
};

/** La sección «Digitalización» de la ficha del trabajo. */
export function DigitalizacionDelTrabajo({ datos, puedeGrabar, envioAutomatico, ahora }: {
  datos: {
    trabajo: TrabajoDeDigitalizacion;
    grabaciones: GrabacionDelTrabajo[];
    entrega: EntregaDelPedido | null;
    pedidoNumero: string | null;
    cliente: { firstName: string | null; lastName: string | null; businessName: string | null } | null;
  };
  puedeGrabar: boolean;
  envioAutomatico: boolean;
  ahora: Date;
}) {
  const { trabajo, grabaciones, entrega } = datos;
  const enviada = Boolean(entrega?.resumen.entrega?.enviadoAt);
  return (
    <section aria-labelledby="digitalizacion-titulo" className="fo-card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="digitalizacion-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
          Digitalización
        </h2>
        {puedeGrabar ? <a href={urlGrabar(trabajo.id)} className="fo-btn fo-btn-primary text-sm">● Grabar cassette</a> : null}
      </div>
      {grabaciones.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no hay grabaciones de este trabajo.</p>
      ) : (
        <ul className="divide-y divide-[var(--fo-border)] text-sm">
          {grabaciones.map((g) => {
            const estado = estadoDeGrabacion(g, ahora);
            const duracion = g.videoDuracionSeg ?? (g.tipo === "VHS" ? g.duracionSeg : null);
            const usadas = entrega?.descargas.get(g.id) ?? 0;
            return (
              <li key={g.id} className="space-y-1 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {g.titulo ? `${g.titulo} · ` : ""}
                    {g.tipo === "DVD" ? "DVD" : `VHS${g.cassetteNumero ? ` · cassette ${g.cassetteNumero}` : ""}`}
                  </p>
                  <span className={CLASE_ESTADO[estado] ?? "text-xs text-[var(--fo-muted)]"}>{ETIQUETA_ESTADO_GRABACION[estado]}</span>
                </div>
                <p className="text-[var(--fo-muted)]">
                  {fechaYHora(g.iniciadaAt)}
                  {duracion != null && duracion > 0 ? ` · ${duracionLegible(duracion)}` : ""}
                  {estado === "ERROR" && g.conversionError ? ` · ${g.conversionError}` : ""}
                  {estado === "LISTA" && enviada ? ` · ${textoDeDescargas({ usadas, descargasExtra: g.descargasExtra })}` : ""}
                  {g.videoBorradoAt ? " · video borrado" : ""}
                </p>
                {estado !== "DESCARTADA" && !g.videoBorradoAt ? (
                  <AccionesGrabacion
                    id={g.id}
                    estado={estadoVisible(g, ahora)}
                    puedeGrabar={puedeGrabar}
                    conversionEstado={g.conversionEstado ?? ""}
                    partesBorradas={g.partesBorradasAt != null}
                    tieneHls={g.hlsKey != null && g.videoBorradoAt == null}
                    titulo={g.titulo}
                    nombreArchivo={nombreArchivoVideo(
                      { pedidoNumero: datos.pedidoNumero, clienteNombre: nombreCliente(datos.cliente), titulo: g.titulo, tipo: g.tipo === "DVD" ? "DVD" : "VHS", cassetteNumero: g.cassetteNumero },
                      extensionDeMime(g.mimeType) ?? "bin",
                    )}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {entrega ? (
        <div className="space-y-1 border-t border-[var(--fo-border)] pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
            Entrega del pedido{datos.pedidoNumero ? ` N° ${datos.pedidoNumero}` : ""}
          </p>
          <EstadoDeEntrega entrega={entrega} puedeGrabar={puedeGrabar} envioAutomatico={envioAutomatico} ahora={ahora} />
        </div>
      ) : null}
    </section>
  );
}

/** El bloque compacto de la ficha del pedido: la entrega y un acceso a cada trabajo para grabar. */
export function DigitalizacionDelPedido({ trabajos, entrega, puedeGrabar, envioAutomatico, ahora }: {
  trabajos: TrabajoDeDigitalizacion[];
  entrega: EntregaDelPedido | null;
  puedeGrabar: boolean;
  envioAutomatico: boolean;
  ahora: Date;
}) {
  return (
    <section id="digitalizacion" aria-labelledby="digitalizacion-pedido-titulo" className="fo-card space-y-3">
      <h2 id="digitalizacion-pedido-titulo" className="text-base font-semibold text-[var(--fo-text)]">
        Digitalización
      </h2>
      <ul className="space-y-1 text-sm">
        {trabajos.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2">
            <Link href={`/proyectos/${encodeURIComponent(t.id)}`} className="font-medium hover:underline">
              {t.numero} · {t.nombre}
            </Link>
            <span className="text-xs text-[var(--fo-muted)]">
              {t.grabaciones === 0 ? "sin grabaciones" : t.grabaciones === 1 ? "1 grabación" : `${t.grabaciones} grabaciones`}
            </span>
            {puedeGrabar ? <a href={urlGrabar(t.id)} className="fo-btn fo-btn-secondary text-xs">● Grabar</a> : null}
          </li>
        ))}
      </ul>
      {entrega ? <EstadoDeEntrega entrega={entrega} puedeGrabar={puedeGrabar} envioAutomatico={envioAutomatico} ahora={ahora} conDescargas /> : null}
    </section>
  );
}
