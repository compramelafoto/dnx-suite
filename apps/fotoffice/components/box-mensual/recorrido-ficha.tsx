import Link from "next/link";
import { DatosFicha } from "@/components/ficha/datos-ficha";
import { direccionDeEnvio, etiquetaBox, type RecorridoBox } from "@/lib/box-mensual/secuencia";
import type { EnvioFila } from "@/lib/box-mensual/store";
import { fechaBox } from "@/lib/box-mensual/formato";

/**
 * El recorrido de la BOX mensual en la ficha: qué cajas recibió, cuándo, con qué seguimiento, y
 * cuál le toca. Sólo lectura: los envíos se marcan desde Socios → BOX mensual.
 */
export function RecorridoBoxFicha({
  recorrido,
  envios,
  conBox,
  direccion,
  conEnlace,
}: {
  recorrido: RecorridoBox;
  envios: EnvioFila[];
  conBox: boolean;
  direccion: { address: string | null; city: string | null; province: string | null; postalCode: string | null };
  /** Sólo quien gestiona Socios puede abrir la pantalla de envíos. */
  conEnlace: boolean;
}) {
  const proxima = recorrido.proxima;
  const leToca = !conBox
    ? "Su categoría no incluye la BOX mensual."
    : recorrido.estado === "PARA_ENVIAR" && proxima
      ? `Le toca la ${etiquetaBox(proxima)}.`
      : recorrido.estado === "AL_DIA"
        ? "Recibió todas las cajas cargadas: está al día y sigue con las nuevas que se carguen."
        : proxima
          ? `Con el próximo mes pagado le toca la ${etiquetaBox(proxima)}.`
          : null;

  return (
    <DatosFicha
      titulo="BOX mensual"
      acciones={
        conEnlace ? (
          <Link href="/members/box" className="text-xs text-[var(--fo-accent)] hover:underline">
            Ver envíos
          </Link>
        ) : null
      }
    >
      {leToca ? <p className="text-sm text-[var(--fo-text)]">{leToca}</p> : null}
      {conBox && recorrido.pendientes > 1 ? (
        <p className="text-xs text-[var(--fo-muted)]">{`Tiene ${recorrido.pendientes} meses pagados sin caja.`}</p>
      ) : null}
      {conBox && recorrido.estado === "PARA_ENVIAR" && !direccionDeEnvio(direccion) ? (
        <p className="text-xs text-[var(--fo-danger)]">Falta la dirección: sin ella no se le puede enviar.</p>
      ) : null}

      {envios.length > 0 ? (
        <ul className="divide-y divide-[var(--fo-border)]">
          {envios.map((e) => (
            <li key={e.id} className="space-y-0.5 py-2">
              <p className="text-sm text-[var(--fo-text)]">{etiquetaBox({ number: e.boxNumber, name: e.boxName })}</p>
              <p className="text-xs text-[var(--fo-muted-soft)]">
                {[
                  `Enviada ${fechaBox(e.shippedAt)}`,
                  e.status === "ENTREGADA" ? `entregada ${fechaBox(e.deliveredAt)}` : null,
                  e.carrier,
                  e.trackingCode ? `seguimiento ${e.trackingCode}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--fo-muted)]">Todavía no recibió ninguna caja.</p>
      )}
    </DatosFicha>
  );
}
