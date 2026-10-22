// apps/fotoffice/app/(shell)/digitalizacion/page.tsx
import { PageHeader } from "@/components/page-header";
import { AccionesGrabacion, AjusteMinutos } from "@/components/digitalizacion/acciones-grabacion";
import { AccionesEntrega, AjustesEntrega } from "@/components/digitalizacion/entregas";
import { estadoVisibleDeEntrega, fechaArgentina, fechaHoraArgentina, type EstadoVisibleEntrega } from "@/lib/digitalizacion/entrega";
import { resumenDeEntregas, type ResumenEntrega } from "@/lib/digitalizacion/servidor/entregas";
import { extensionDeMime } from "@/lib/digitalizacion/claves";
import { nombreArchivoVideo, nombreCliente } from "@/lib/digitalizacion/nombre-archivo";
import { requireDigitalizacion } from "@/lib/digitalizacion/contexto";
import { leerAjustes, listarGrabaciones } from "@/lib/digitalizacion/servidor/grabaciones";
import { estadoVisible } from "@/lib/digitalizacion/validar";

export const dynamic = "force-dynamic";

const ESTADOS: Record<string, string> = { GRABANDO: "Grabando", COMPLETA: "Completa", INTERRUMPIDA: "Interrumpida" };
const MOTIVOS: Record<string, string> = {
  MANUAL: "Detenida a mano",
  SIN_SENAL: "Se cortó sola (sin imagen)",
  TOPE: "Llegó al tope de 8 h 30 min",
  DVD_COMPLETO: "DVD completo",
  TERMINADA_CON_LO_GRABADO: "Terminada con lo grabado",
};
const CONVERSION: Record<string, string> = {
  PENDIENTE: "En cola para convertir",
  PROCESANDO: "Convirtiendo…",
  SIN_IMAGEN: "Sin imagen: no se convierte",
};
/** Lo que dice la lista sobre la entrega de un pedido. */
function textoDeEntrega(estado: EstadoVisibleEntrega, r: ResumenEntrega, automatico: boolean, ahora: Date): string {
  const e = r.entrega;
  if (r.cancelado && estado !== "ENVIADA" && estado !== "BORRADA") return "Pedido cancelado: no se envían los videos.";
  if (estado === "LISTA_PARA_ENVIAR" && automatico && r.tieneEmail && r.enviaSoloDesde && r.enviaSoloDesde.getTime() > ahora.getTime()) {
    return `Listo · se envía solo el ${fechaHoraArgentina(r.enviaSoloDesde)} si no grabás otro cassette`;
  }
  switch (estado) {
    case "CONVIRTIENDO": return "Convirtiendo…";
    case "CON_ERROR": return "Hay un video con error: reintentá la conversión o descartalo para poder enviar.";
    case "SIN_VIDEOS": return "Sin videos para entregar.";
    case "LISTA_PARA_ENVIAR": return r.tieneEmail ? "Listo para enviar" : "Listo para enviar · el cliente no tiene correo: copiá el enlace y mandáselo por WhatsApp";
    case "ENVIADA": return `Enviado el ${fechaArgentina(e!.enviadoAt!, "corta")}, vence ${fechaArgentina(e!.videosVencenAt!, "corta")}${r.tieneEmail ? "" : " · sin correo (por enlace)"}`;
    case "BORRADA": return `Videos borrados el ${fechaArgentina(e?.videosBorradosAt ?? e!.videosVencenAt!, "corta")}`;
    default: return "";
  }
}

const mb = (b: bigint) => `${(Number(b) / 1024 ** 2).toFixed(0)} MB`;
const duracion = (s: number) => `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min`;
const gb = (b: bigint) => `${(Number(b) / 1024 ** 3).toFixed(2)} GB`;
const fecha = (d: Date) => d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" });

export default async function DigitalizacionPage() {
  const { workspace, puedeGrabar } = await requireDigitalizacion("VIEW");
  const [grabaciones, ajustes, entregas] = await Promise.all([listarGrabaciones(workspace.id), leerAjustes(workspace.id), resumenDeEntregas(workspace.id)]);
  const ahora = new Date();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Digitalización"
        description="Cassettes VHS y DVD grabados o subidos, con su conversión a video Full HD."
        actions={puedeGrabar ? <a href="/digitalizacion/grabar" className="fo-btn fo-btn-primary text-sm">● Grabar</a> : undefined}
      />
      {puedeGrabar ? (
        <details className="rounded border p-3">
          <summary className="cursor-pointer text-sm font-semibold">Configuración</summary>
          <div className="mt-3 space-y-4">
            <AjusteMinutos minutos={ajustes.minutosSinSenal} />
            <AjustesEntrega envioAutomatico={ajustes.envioAutomatico} franjas={ajustes.franjas} />
          </div>
        </details>
      ) : null}
      {entregas.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Entregas por pedido</h2>
          <ul className="divide-y rounded border">
            {entregas.map((r) => {
              const estado = estadoVisibleDeEntrega(
                { preparacion: r.preparacion, enviadoAt: r.entrega?.enviadoAt ?? null, videosVencenAt: r.entrega?.videosVencenAt ?? null, videosBorradosAt: r.entrega?.videosBorradosAt ?? null },
                ahora,
              );
              return (
                <li key={r.pedidoId} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">Pedido {r.pedidoNumero}{r.cliente ? ` · ${r.cliente}` : ""}</p>
                    <span className="text-xs text-gray-600">{r.videos === 1 ? "1 video listo" : `${r.videos} videos listos`}</span>
                  </div>
                  <p className={estado === "CON_ERROR" ? "fo-alert-warning px-2 text-sm" : "text-sm"}>{textoDeEntrega(estado, r, r.entrega?.envioAutomatico ?? ajustes.envioAutomatico, ahora)}</p>
                  {puedeGrabar && !r.cancelado ? (
                    <AccionesEntrega
                      pedidoId={r.pedidoId}
                      entregaId={r.entrega?.id ?? null}
                      estado={estado}
                      tieneEmail={r.tieneEmail}
                      envioAutomatico={r.entrega?.envioAutomatico ?? ajustes.envioAutomatico}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {grabaciones.length === 0 ? <p className="text-sm text-gray-600">Todavía no hay grabaciones.</p> : (
        <ul className="divide-y rounded border">
          {grabaciones.map((g) => {
            const estado = estadoVisible(g, ahora);
            return (
              <li key={g.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {g.titulo ? <span className="font-bold">{g.titulo} · </span> : null}
                    {g.tipo === "DVD" ? "DVD" : `VHS${g.cassetteNumero ? ` · cassette ${g.cassetteNumero}` : ""}`}
                    {g.proyecto ? ` · ${g.proyecto.number} · ${g.proyecto.name}` : " · prueba"}
                  </p>
                  <span className={estado === "INTERRUMPIDA" ? "fo-alert-warning px-2 text-xs" : "text-xs text-gray-600"}>{ESTADOS[estado] ?? estado}</span>
                </div>
                <p className="text-sm text-gray-600">
                  {fecha(g.iniciadaAt)} · {g.tipo === "VHS" ? `${duracion(g.duracionSeg)} · ` : ""}{gb(g.bytesSubidos)}
                  {g.tramos > 1 ? ` · ${g.tramos} tramos` : ""}
                  {g.motivoFin ? ` · ${MOTIVOS[g.motivoFin] ?? g.motivoFin}` : ""}
                  {g.sinImagen && g.tipo === "VHS" ? " · ¡no se vio imagen en ningún momento!" : ""}
                </p>
                {g.conversionEstado ? <p className="text-sm">
                  {g.conversionEstado === "LISTA"
                    ? `Video listo${g.videoDuracionSeg != null ? ` · ${duracion(g.videoDuracionSeg)}` : ""}${g.videoBytes != null ? ` · ${mb(g.videoBytes)}` : ""}`
                    : g.conversionEstado === "ERROR"
                      ? <span className="fo-alert-warning px-2">Error: {g.conversionError ?? "falló la conversión"}</span>
                      : CONVERSION[g.conversionEstado] ?? g.conversionEstado}
                </p> : null}
                <AccionesGrabacion
                  id={g.id}
                  estado={estado}
                  puedeGrabar={puedeGrabar}
                  conversionEstado={g.conversionEstado ?? ""}
                  partesBorradas={g.partesBorradasAt != null}
                  tieneHls={g.hlsKey != null && g.videoBorradoAt == null}
                  titulo={g.titulo}
                  nombreArchivo={nombreArchivoVideo(
                    { pedidoNumero: g.proyecto?.pedido?.number ?? null, clienteNombre: nombreCliente(g.proyecto?.client), titulo: g.titulo, tipo: g.tipo === "DVD" ? "DVD" : "VHS", cassetteNumero: g.cassetteNumero },
                    extensionDeMime(g.mimeType) ?? "bin",
                  )}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
