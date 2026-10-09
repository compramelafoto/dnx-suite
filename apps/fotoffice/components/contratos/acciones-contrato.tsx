"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { anularContratoAction, enviarContratoAction, marcarFirmadoEnPapelAction } from "@/app/actions/contratos";
import { subirAdjuntoConId } from "@/components/ficha/subir-adjunto";
import type { EstadoContrato } from "@/lib/contratos/constantes";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";
const MAX_MOTIVO = 500;
const MAX_TEXTO = 100_000;

type Panel = null | "corregir" | "anular" | "papel";

/**
 * Acciones de un contrato ya creado (con "Gestionar"): "Corregir y reenviar" (texto nuevo → versión nueva; los
 * enlaces anteriores dejan de servir), "Anular" (con motivo) y "Marcar firmado en papel" (se sube el escaneo a
 * la ficha del contacto y recién después se marca). Cada botón sólo aparece en los estados donde el servidor lo
 * acepta, y el servidor lo vuelve a decidir.
 */
export function AccionesContrato({
  contratoId,
  clientId,
  estado,
  textoVigente,
  adjuntosHabilitados,
}: {
  contratoId: string;
  clientId: string;
  estado: EstadoContrato;
  textoVigente: string;
  adjuntosHabilitados: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState(textoVigente);
  const [motivo, setMotivo] = useState("");
  const [progreso, setProgreso] = useState<number | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  const puedeCorregir = estado === "ENVIADO" || estado === "FIRMADO_PARCIAL";
  const puedeAnular = estado === "BORRADOR" || estado === "ENVIADO" || estado === "FIRMADO_PARCIAL" || estado === "RECHAZADO";
  const puedePapel = estado === "BORRADOR" || estado === "ENVIADO" || estado === "FIRMADO_PARCIAL";
  if (!puedeCorregir && !puedeAnular && !puedePapel) return null;

  function abrir(p: Exclude<Panel, null>) {
    setError(null);
    setPanel(panel === p ? null : p);
  }

  function correr(accion: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    iniciar(async () => {
      const r = await accion().catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (r.ok) {
        setPanel(null);
        setMotivo("");
        router.refresh();
      } else setError(r.error);
    });
  }

  function marcarEnPapel() {
    const f = archivo.current?.files?.[0];
    if (!f) return setError("Elegí el archivo con el contrato firmado en papel (PDF o imagen).");
    setError(null);
    iniciar(async () => {
      setProgreso(0);
      try {
        const subida = await subirAdjuntoConId({ tipo: "CLIENTE", id: clientId }, f, setProgreso);
        if (!subida.ok) return setError(subida.error);
        const r = await marcarFirmadoEnPapelAction(contratoId, subida.id).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
        if (r.ok) {
          setPanel(null);
          router.refresh();
        } else setError(r.error);
      } catch {
        setError(ERROR_CONEXION);
      } finally {
        setProgreso(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {puedeCorregir ? (
          <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} aria-expanded={panel === "corregir"} onClick={() => abrir("corregir")}>
            Corregir y reenviar
          </button>
        ) : null}
        {puedePapel ? (
          <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} aria-expanded={panel === "papel"} onClick={() => abrir("papel")}>
            Marcar firmado en papel
          </button>
        ) : null}
        {puedeAnular ? (
          <button type="button" className="fo-btn fo-btn-danger-outline text-sm" disabled={pendiente} aria-expanded={panel === "anular"} onClick={() => abrir("anular")}>
            Anular contrato
          </button>
        ) : null}
      </div>

      {panel === "corregir" ? (
        <form
          className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            correr(() => enviarContratoAction(contratoId, texto));
          }}
        >
          <p className="text-xs text-[var(--fo-muted)]">
            Corregí el texto y reenviá. Se crea una versión nueva: los enlaces anteriores dejan de servir y cada contratante tiene que firmar de nuevo (las firmas ya hechas quedan guardadas en la versión anterior).
          </p>
          <textarea className="fo-input min-h-[18rem] w-full font-mono text-xs leading-relaxed" value={texto} maxLength={MAX_TEXTO} onChange={(e) => setTexto(e.target.value)} required />
          <div className="flex gap-2">
            <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
              {pendiente ? "Reenviando…" : "Enviar versión corregida"}
            </button>
            <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => setPanel(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {panel === "anular" ? (
        <form
          className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!motivo.trim()) return setError("Para anular el contrato escribí el motivo.");
            correr(() => anularContratoAction(contratoId, motivo));
          }}
        >
          <label className="block space-y-1">
            <span className="text-xs text-[var(--fo-muted)]">Motivo de la anulación (obligatorio)</span>
            <textarea className="fo-input w-full" value={motivo} maxLength={MAX_MOTIVO} onChange={(e) => setMotivo(e.target.value)} required />
          </label>
          <p className="text-xs text-[var(--fo-muted)]">Los enlaces enviados dejan de servir y no se puede deshacer. Si hace falta, se genera un contrato nuevo.</p>
          <div className="flex gap-2">
            <button type="submit" className="fo-btn fo-btn-danger-outline text-sm" disabled={pendiente}>
              Anular contrato
            </button>
            <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => setPanel(null)}>
              No anular
            </button>
          </div>
        </form>
      ) : null}

      {panel === "papel" ? (
        <div className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3 text-sm">
          {adjuntosHabilitados ? (
            <>
              <p className="text-xs text-[var(--fo-muted)]">
                Subí el escaneo o la foto del contrato firmado. Queda guardado en la ficha del contacto como respaldo, el contrato pasa a firmado y los enlaces enviados dejan de servir.
              </p>
              <input ref={archivo} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif" className="block text-sm" disabled={pendiente} />
              {progreso !== null ? <p className="text-xs text-[var(--fo-muted)]">Subiendo… {progreso}%</p> : null}
              <div className="flex gap-2">
                <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente} onClick={marcarEnPapel}>
                  Subir y marcar como firmado
                </button>
                <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => setPanel(null)}>
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--fo-muted)]">Los archivos adjuntos no están configurados en este momento: no se puede guardar el respaldo del contrato firmado en papel.</p>
          )}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
