// apps/fotoffice/app/(shell)/digitalizacion/page.tsx
import { vistaPreviaAgotada } from "@/lib/digitalizacion/hls";
import { PageHeader } from "@/components/page-header";
import { AccionesGrabacion, AjusteMinutos } from "@/components/digitalizacion/acciones-grabacion";
import { AccionesEntrega, AjustesEntrega, EnvioYCargos, VerComoCliente } from "@/components/digitalizacion/entregas";
import { QuitarNoDigitalizable } from "@/components/digitalizacion/no-digitalizable";
import { esNoDigitalizable, textoNoDigitalizable } from "@/lib/digitalizacion/no-digitalizable";
import { confirmacionEnvioIncompleto, textoDeCassettes } from "@/lib/digitalizacion/cassettes";
import { estadoVisibleDeEntrega, pesos } from "@/lib/digitalizacion/entrega";
import { datosTextoEntrega, textoDeEntrega } from "@/lib/digitalizacion/trabajo";
import { resumenDeComision } from "@/lib/digitalizacion/servidor/comision";
import { resumenDeEntregas } from "@/lib/digitalizacion/servidor/entregas";
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
  NO_DIGITALIZABLE: "No se pudo digitalizar",
};
const CONVERSION: Record<string, string> = {
  PENDIENTE: "En cola para convertir",
  PROCESANDO: "Convirtiendo…",
  SIN_IMAGEN: "Sin imagen: no se convierte",
};
const mb = (b: bigint) => `${(Number(b) / 1024 ** 2).toFixed(0)} MB`;
const duracion = (s: number) => `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min`;
const gb = (b: bigint) => `${(Number(b) / 1024 ** 3).toFixed(2)} GB`;
const fecha = (d: Date) => d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" });

export default async function DigitalizacionPage() {
  const { workspace, puedeGrabar } = await requireDigitalizacion("VIEW");
  const ahora = new Date();
  const [grabaciones, ajustes, entregas, comision] = await Promise.all([
    listarGrabaciones(workspace.id),
    leerAjustes(workspace.id),
    resumenDeEntregas(workspace.id),
    // F1: la comisión de plataforma, sólo para quien gestiona y si la tasa no es 0 (DNX no la ve).
    puedeGrabar ? resumenDeComision(workspace.id, ahora).catch(() => null) : Promise.resolve(null),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Digitalización"
        description="Cassettes VHS y DVD grabados o subidos, con su conversión a video Full HD."
        actions={puedeGrabar ? <a href="/digitalizacion/grabar" className="fo-btn fo-btn-primary text-sm">● Grabar</a> : undefined}
      />
      {comision ? (
        <p className="text-sm text-gray-600">
          Comisión de plataforma: {pesos(comision.devengadoMesMinor)} devengados este mes · saldo pendiente {pesos(comision.saldoPendienteMinor)}
        </p>
      ) : null}
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
                    <span className="text-xs text-gray-600">
                      {textoDeCassettes(r.cassettes)} · {r.videos === 1 ? "1 video listo" : `${r.videos} videos listos`}
                    </span>
                  </div>
                  <p className={estado === "CON_ERROR" ? "fo-alert-warning px-2 text-sm" : "text-sm"}>{textoDeEntrega(estado, datosTextoEntrega(r, ajustes.envioAutomatico), ahora)}</p>
                  <EnvioYCargos entregaId={r.entrega?.id ?? null} envio={r.envio} cargos={r.cargosPendientes} aRevisar={r.cargosARevisar} puedeGestionar={puedeGrabar} />
                  {puedeGrabar && !r.cancelado ? (
                    <AccionesEntrega
                      pedidoId={r.pedidoId}
                      entregaId={r.entrega?.id ?? null}
                      estado={estado}
                      tieneEmail={r.tieneEmail}
                      envioAutomatico={r.entrega?.envioAutomatico ?? ajustes.envioAutomatico}
                      avisoFaltantes={confirmacionEnvioIncompleto(r.cassettes)}
                    >
                      <VerComoCliente pedidoId={r.pedidoId} />
                    </AccionesEntrega>
                  ) : (
                    <div className="text-sm"><VerComoCliente pedidoId={r.pedidoId} /></div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {grabaciones.length === 0 ? <p className="text-sm text-gray-600">Todavía no hay grabaciones.</p> : (
        <ul className="divide-y rounded border">
          {grabaciones.map((g) => {
            if (esNoDigitalizable(g)) {
              return (
                <li key={g.id} className="flex flex-wrap items-baseline justify-between gap-2 p-4">
                  <p className="font-semibold">
                    {textoNoDigitalizable(g)}
                    {g.proyecto ? ` · ${g.proyecto.number} · ${g.proyecto.name}` : ""}
                  </p>
                  {puedeGrabar ? <QuitarNoDigitalizable id={g.id} /> : null}
                </li>
              );
            }
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
                    ? <>
                        {`Video listo${g.videoDuracionSeg != null ? ` · ${duracion(g.videoDuracionSeg)}` : ""}${g.videoBytes != null ? ` · ${mb(g.videoBytes)}` : ""}`}
                        {vistaPreviaAgotada(g.hlsKey, g.conversionError)
                          ? <span className="fo-alert-warning ml-2 px-2">No se pudo preparar la vista previa (falló 3 veces): el video se puede descargar igual.</span>
                          : null}
                      </>
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
