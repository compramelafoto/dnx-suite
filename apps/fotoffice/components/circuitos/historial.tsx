import { AVANZO_CON_PENDIENTES, type PasoVista } from "@/lib/circuitos/ficha-vista";
import type { CambioVista } from "@/lib/campos/vista";
import { fechaHoraBA } from "@/lib/ficha/formato";
import type { MensajeVista } from "@/lib/plantillas/vista-mensaje";
import { MensajeRegistrado } from "@/components/mensajes/mensaje-registrado";

type Entrada =
  | { tipo: "paso"; paso: PasoVista }
  | { tipo: "cambio"; cambio: CambioVista }
  | { tipo: "mensaje"; mensaje: MensajeVista };

const fechaDe = (e: Entrada) => (e.tipo === "paso" ? e.paso.fecha : e.tipo === "cambio" ? e.cambio.fecha : e.mensaje.fecha);

/**
 * Qué pasó en la consulta, lo último primero: los pasos del recorrido, los cambios de
 * "Más datos" y los mensajes (correo o WhatsApp), intercalados por fecha. Las fechas van en
 * hora de Buenos Aires.
 */
export function Historial({
  pasos,
  cambios = [],
  mensajes = [],
}: {
  pasos: PasoVista[];
  cambios?: CambioVista[];
  mensajes?: MensajeVista[];
}) {
  const entradas: Entrada[] = [
    ...pasos.map((paso) => ({ tipo: "paso" as const, paso })),
    ...cambios.map((cambio) => ({ tipo: "cambio" as const, cambio })),
    ...mensajes.map((mensaje) => ({ tipo: "mensaje" as const, mensaje })),
  ].sort((a, b) => new Date(fechaDe(b)).getTime() - new Date(fechaDe(a)).getTime());

  return (
    <section aria-labelledby="historial-titulo" className="fo-card space-y-3">
      <h2 id="historial-titulo" className="text-base font-semibold text-[var(--fo-text)]">
        Historial
      </h2>
      {entradas.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">Todavía no hay movimientos.</p> : null}
      <ol className="space-y-3">
        {entradas.map((e) =>
          e.tipo === "mensaje" ? (
            <li key={`mensaje-${e.mensaje.id}`} className="border-l-2 border-[var(--fo-border)] pl-3 text-sm">
              <MensajeRegistrado mensaje={e.mensaje} conEncabezado />
            </li>
          ) : e.tipo === "cambio" ? (
            <li key={`cambio-${e.cambio.id}`} className="border-l-2 border-[var(--fo-border)] pl-3 text-sm">
              <p className="text-xs text-[var(--fo-muted)]">
                {fechaHoraBA(e.cambio.fecha)} · {e.cambio.quien} · Más datos
              </p>
              <p className="break-words text-[var(--fo-text)]">
                {e.cambio.campo}: {e.cambio.antes} → {e.cambio.despues}
              </p>
            </li>
          ) : (
            <Paso key={`paso-${e.paso.id}`} p={e.paso} />
          ),
        )}
      </ol>
    </section>
  );
}

function Paso({ p }: { p: PasoVista }) {
  return (
    <li className="border-l-2 border-[var(--fo-border)] pl-3 text-sm">
      <p className="text-xs text-[var(--fo-muted)]">
        {fechaHoraBA(p.fecha)} · {p.quien}
        {p.evento ? ` · ${p.evento}` : ""}
      </p>
      <p className="text-[var(--fo-text)]">
        {p.clase === "vencimiento"
          ? `Vencimiento de ${p.a ?? "la etapa"}`
          : p.clase === "inicio"
            ? `Entró en ${p.a ?? "el circuito"}`
            : `${p.de ?? "—"} → ${p.a ?? "—"}`}
        {p.forzada ? <span className="ml-1 text-xs text-[var(--fo-danger)]">({AVANZO_CON_PENDIENTES})</span> : null}
      </p>
      {p.nota ? <p className="whitespace-pre-line text-[var(--fo-muted)]">{p.nota}</p> : null}
    </li>
  );
}
