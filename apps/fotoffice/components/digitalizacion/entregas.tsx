// apps/fotoffice/components/digitalizacion/entregas.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  anularCargoAction, cambiarEnvioAutomaticoAction, enviarEntregaAction, guardarAjustesEntregaAction, marcarEnvioEntregadoAction, quitarCargoAManoAction,
} from "@/app/(shell)/digitalizacion/actions";
import { ETIQUETA_ENVIO, esEstadoEnvio } from "@/lib/digitalizacion/cargos";
import { leerNumero, pesos, type EstadoVisibleEntrega, type FranjaEnvio } from "@/lib/digitalizacion/entrega";

type PropsAcciones = {
  pedidoId: string;
  entregaId: string | null;
  estado: EstadoVisibleEntrega;
  tieneEmail: boolean;
  envioAutomatico: boolean;
};

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/** Botones de la entrega de un pedido en la lista de Digitalización (sólo con permiso de gestión). */
export function AccionesEntrega({ pedidoId, entregaId, estado, tieneEmail, envioAutomatico }: PropsAcciones) {
  const [pendiente, empezar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const [enlace, setEnlace] = useState<string | null>(null);
  const router = useRouter();
  const destino = entregaId ? { entregaId } : { pedidoId };

  const enviar = () =>
    empezar(async () => {
      const r = await enviarEntregaAction(destino, "CORREO");
      setAviso(r.ok ? (estado === "ENVIADA" ? "Listo: se reenvió el correo con un enlace nuevo." : "Listo: se envió el correo al cliente.") : r.error);
      router.refresh();
    });

  const copiarEnlace = () => {
    const advertencia =
      estado === "ENVIADA"
        ? "Se va a generar un enlace nuevo: el que tiene el cliente (por correo o WhatsApp) deja de funcionar. ¿Seguimos?"
        : "Se va a dar la entrega por enviada (empiezan a correr los 30 días) y se copia el enlace para mandarlo por WhatsApp. ¿Seguimos?";
    if (!window.confirm(advertencia)) return;
    empezar(async () => {
      const r = await enviarEntregaAction(destino, "ENLACE");
      if (!r.ok) { setAviso(r.error); return; }
      const ok = await copiar(r.url);
      setEnlace(ok ? null : r.url);
      setAviso(ok ? "Enlace nuevo copiado. El anterior ya no funciona." : "Enlace nuevo (copialo a mano). El anterior ya no funciona:");
      router.refresh();
    });
  };

  const cambiarAutomatico = (valor: boolean) =>
    empezar(async () => {
      const r = await cambiarEnvioAutomaticoAction(pedidoId, valor);
      setAviso(r.ok ? null : r.error);
      router.refresh();
    });

  const abierta = estado !== "ENVIADA" && estado !== "BORRADA";
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {estado === "LISTA_PARA_ENVIAR" ? (
        <button type="button" className="fo-btn fo-btn-primary text-xs" disabled={pendiente || !tieneEmail} onClick={enviar}>Enviar al cliente</button>
      ) : null}
      {estado === "ENVIADA" && tieneEmail ? (
        <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente} onClick={enviar}>Reenviar</button>
      ) : null}
      {estado === "LISTA_PARA_ENVIAR" || estado === "ENVIADA" ? (
        <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente} onClick={copiarEnlace}>Copiar enlace</button>
      ) : null}
      {abierta ? (
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={envioAutomatico} disabled={pendiente} onChange={(e) => cambiarAutomatico(e.target.checked)} />
          Enviar automáticamente
        </label>
      ) : null}
      {aviso ? <span className="text-gray-600">{aviso}</span> : null}
      {enlace ? <input readOnly className="w-full rounded border p-1 text-xs" value={enlace} onFocus={(e) => e.currentTarget.select()} /> : null}
    </div>
  );
}

type FranjaEditable = { hastaKm: string; precioArs: string };

/** E11: envío automático por defecto y franjas de envío de cassettes. */
export function AjustesEntrega({ envioAutomatico, franjas }: { envioAutomatico: boolean; franjas: FranjaEnvio[] }) {
  const [auto, setAuto] = useState(envioAutomatico);
  const [filas, setFilas] = useState<FranjaEditable[]>(franjas.map((f) => ({ hastaKm: String(f.hastaKm), precioArs: String(f.precioArs) })));
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const router = useRouter();

  const cambiar = (i: number, campo: keyof FranjaEditable, valor: string) => setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));

  const guardar = () =>
    empezar(async () => {
      // El rango y los decimales los valida el servidor (`validarFranjas`).
      const datos = filas.map((f) => ({ hastaKm: leerNumero(f.hastaKm), precioArs: leerNumero(f.precioArs) }));
      if (datos.some((d) => !Number.isFinite(d.hastaKm) || !Number.isFinite(d.precioArs))) {
        setAviso("Completá los km y el precio de cada franja con números.");
        return;
      }
      const r = await guardarAjustesEntregaAction(auto, datos);
      if (!r.ok) { setAviso(r.error); return; }
      setFilas(r.franjas.map((f) => ({ hastaKm: String(f.hastaKm), precioArs: String(f.precioArs) })));
      setAviso("Guardado.");
      router.refresh();
    });

  return (
    <div className="space-y-2 text-sm">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        Enviar al cliente automáticamente al terminar
      </label>
      <div className="space-y-1">
        <p className="font-medium">Envío de cassettes a domicilio</p>
        <p className="text-xs text-gray-600">Precio según la distancia desde el estudio. Más lejos que la última franja, o sin franjas: «A coordinar».</p>
        {filas.map((f, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <label>Hasta
              <input inputMode="decimal" className="mx-1 w-20 rounded border p-1" value={f.hastaKm} onChange={(e) => cambiar(i, "hastaKm", e.target.value)} aria-label="Hasta cuántos km" />
              km
            </label>
            <label>cuesta
              <input inputMode="decimal" className="mx-1 w-28 rounded border p-1" value={f.precioArs} onChange={(e) => cambiar(i, "precioArs", e.target.value)} aria-label="Precio en pesos" />
              pesos
            </label>
            <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))}>Quitar</button>
          </div>
        ))}
        <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={() => setFilas((fs) => [...fs, { hastaKm: "", precioArs: "" }])}>Agregar franja</button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="fo-btn fo-btn-primary text-xs" disabled={pendiente} onClick={guardar}>Guardar</button>
        {aviso ? <span>{aviso}</span> : null}
      </div>
    </div>
  );
}

const CARGO: Record<string, string> = { DESCARGA_EXTRA: "Descarga extra", EXTENSION: "Extensión de 30 días", ENVIO: "Envío de cassettes" };

/**
 * Envío de los cassettes y cargos extra sin pagar de una entrega (spec 2026-10-22, E6 y E9): la
 * dirección, los km, el precio y el estado del envío, con «Marcar entregado»; cada cargo pendiente
 * con «Anular» (lo saca del pedido). Los botones, sólo con permiso de gestión.
 */
export function EnvioYCargos({
  entregaId,
  envio,
  cargos,
  aRevisar = [],
  puedeGestionar,
}: {
  entregaId: string | null;
  envio: { estado: string; direccion: string | null; km: number | null; precioMinor: number | null } | null;
  cargos: { id: string; tipo: string; montoMinor: number }[];
  /** Cargos "a revisar" (el plan se editó a mano): con «Quitar del pedido a mano» si no tienen cobros. */
  aRevisar?: { id: string; concepto: string; montoMinor: number; tieneCobros: boolean }[];
  puedeGestionar: boolean;
}) {
  const [pendiente, empezar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const router = useRouter();
  if (!envio && cargos.length === 0 && aRevisar.length === 0) return null;

  const correr = (fn: () => Promise<{ ok: boolean; error?: string; planCuadra?: boolean }>) =>
    empezar(async () => {
      const r = await fn();
      setAviso(!r.ok ? (r.error ?? "No se pudo.") : r.planCuadra === false ? "Listo. Ahora revisá el plan de pagos del pedido: no suma el total nuevo." : null);
      router.refresh();
    });

  return (
    <div className="space-y-1 text-sm">
      {envio ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>
            <span className="font-semibold">Envío de cassettes:</span> {esEstadoEnvio(envio.estado) ? ETIQUETA_ENVIO[envio.estado] : envio.estado}
            {envio.direccion ? ` · ${envio.direccion}` : ""}
            {envio.km !== null ? ` · ${String(envio.km).replace(".", ",")} km` : ""}
            {envio.precioMinor !== null ? ` · ${pesos(envio.precioMinor)}` : ""}
          </span>
          {puedeGestionar && entregaId && (envio.estado === "CONFIRMADO" || envio.estado === "A_COORDINAR") ? (
            <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente} onClick={() => correr(() => marcarEnvioEntregadoAction(entregaId))}>
              Marcar entregado
            </button>
          ) : null}
        </div>
      ) : null}
      {cargos.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-2">
          <span>{CARGO[c.tipo] ?? c.tipo}: {pesos(c.montoMinor)}, pendiente de pago</span>
          {puedeGestionar ? (
            <button
              type="button"
              className="fo-btn fo-btn-ghost text-xs"
              disabled={pendiente}
              onClick={() => {
                if (!window.confirm("Se saca el cargo del pedido (el renglón y su cuota). ¿Seguimos?")) return;
                correr(() => anularCargoAction(c.id));
              }}
            >
              Anular
            </button>
          ) : null}
        </div>
      ))}
      {aRevisar.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-2">
          <span className="fo-alert-warning px-2">
            A revisar: {c.concepto} ({pesos(c.montoMinor)}) · el plan se editó a mano
            {c.tieneCobros ? " · tiene cobros: revisalo en el pedido" : ""}
          </span>
          {puedeGestionar && !c.tieneCobros ? (
            <button
              type="button"
              className="fo-btn fo-btn-ghost text-xs"
              disabled={pendiente}
              onClick={() => {
                const ok = window.confirm(
                  `Se saca del pedido el renglón «${c.concepto}» y ${pesos(c.montoMinor)} del total. Si la plata del cargo se había repartido en otras cuotas, después vas a tener que ajustar el plan de pagos. ¿Seguimos?`,
                );
                if (ok) correr(() => quitarCargoAManoAction(c.id));
              }}
            >
              Quitar del pedido a mano
            </button>
          ) : null}
        </div>
      ))}
      {aviso ? <p className="text-gray-600">{aviso}</p> : null}
    </div>
  );
}
