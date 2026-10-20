// apps/fotoffice/app/(shell)/digitalizacion/page.tsx
import { PageHeader } from "@/components/page-header";
import { AccionesGrabacion, AjusteMinutos } from "@/components/digitalizacion/acciones-grabacion";
import { extensionDeMime } from "@/lib/digitalizacion/claves";
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
const mb = (b: bigint) => `${(Number(b) / 1024 ** 2).toFixed(0)} MB`;
const duracion = (s: number) => `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min`;
const gb = (b: bigint) => `${(Number(b) / 1024 ** 3).toFixed(2)} GB`;
const fecha = (d: Date) => d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" });

export default async function DigitalizacionPage() {
  const { workspace, puedeGrabar } = await requireDigitalizacion("VIEW");
  const [grabaciones, ajustes] = await Promise.all([listarGrabaciones(workspace.id), leerAjustes(workspace.id)]);
  const ahora = new Date();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Digitalización"
        description="Cassettes VHS y DVD grabados o subidos, con su conversión a video Full HD."
        actions={puedeGrabar ? <a href="/digitalizacion/grabar" className="fo-btn fo-btn-primary text-sm">● Grabar</a> : undefined}
      />
      {puedeGrabar ? <AjusteMinutos minutos={ajustes.minutosSinSenal} /> : null}
      {grabaciones.length === 0 ? <p className="text-sm text-gray-600">Todavía no hay grabaciones.</p> : (
        <ul className="divide-y rounded border">
          {grabaciones.map((g) => {
            const estado = estadoVisible(g, ahora);
            return (
              <li key={g.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
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
                  nombreArchivo={`grabacion-${g.id}.${extensionDeMime(g.mimeType) ?? "bin"}`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
