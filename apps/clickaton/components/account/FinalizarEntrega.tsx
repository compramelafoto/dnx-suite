"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { estadoDeFinalizacion } from "@/lib/participant-support/finalizar-entrega";
import { formatearEnAr, horaAr } from "@/lib/fecha-ar";

export type ResumenConsigna = {
  sequence: number;
  title: string;
  entregada: boolean;
  etiqueta: string;
};

export type FinalizarEntregaProps = {
  registrationId: string;
  finalizadaEn: string | null;
  fotosEnviadas: number;
  totalConsignas: number;
  entregaAbierta: boolean;
  resumen: ResumenConsigna[];
  timezone: string;
  nombre: string;
};

function formatearFechaHora(iso: string, timezone: string): string {
  const fecha = formatearEnAr(iso, { day: "2-digit", month: "2-digit" }, timezone);
  return `${fecha} a las ${horaAr(iso, timezone)}`;
}

export function FinalizarEntrega(props: FinalizarEntregaProps) {
  const [finalizadaEn, setFinalizadaEn] = useState<string | null>(props.finalizadaEn);
  const [mostrandoResumen, setMostrandoResumen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estado = estadoDeFinalizacion({
    finalizadaEn: finalizadaEn ? new Date(finalizadaEn) : null,
    fotosEnviadas: props.fotosEnviadas,
    entregaAbierta: props.entregaAbierta,
  });

  async function confirmar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/registrations/${props.registrationId}/finalizar-entrega`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        finalizadaEn?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.message ?? "No pudimos cerrar tu entrega. Probá de nuevo.");
        return;
      }
      setFinalizadaEn(data.finalizadaEn ?? new Date().toISOString());
      setMostrandoResumen(false);
    } catch {
      setError("No pudimos cerrar tu entrega. Revisá la señal y probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  // Participación cerrada: felicitaciones y agradecimiento.
  if (estado === "YA_FINALIZADA" && finalizadaEn) {
    return (
      <Card variant="yellow" className="mt-8 space-y-4 text-center">
        <p className="text-4xl leading-none" aria-hidden="true">
          🎉
        </p>
        <h2 className="font-[family-name:var(--font-ck-display)] text-3xl leading-tight text-ck-text">
          {props.nombre ? `¡Gracias, ${props.nombre}!` : "¡Gracias por participar!"}
        </h2>
        <p className="text-base leading-relaxed text-ck-text">
          Tu participación quedó cerrada. Entregaste{" "}
          <strong>
            {props.fotosEnviadas} {props.fotosEnviadas === 1 ? "foto" : "fotos"}
          </strong>{" "}
          {props.totalConsignas > 0 ? `sobre ${props.totalConsignas} consignas.` : "."}
        </p>
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          Cerraste el {formatearFechaHora(finalizadaEn, props.timezone)} h. Ya no hace falta que
          hagas nada más: cuando el jurado termine te avisamos por correo.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {props.resumen.map((c) => (
            <Badge key={c.sequence} variant={c.entregada ? "success" : "neutral"}>
              {c.sequence}. {c.etiqueta}
            </Badge>
          ))}
        </div>
        <p className="ck-overline pt-2 text-ck-text-muted">¡Felicitaciones por llegar hasta acá!</p>
      </Card>
    );
  }

  if (estado === "SIN_FOTOS") return null;

  // Paso intermedio: que vea qué está por cerrar antes de cerrarlo.
  if (mostrandoResumen) {
    const faltan = props.resumen.filter((c) => !c.entregada).length;
    return (
      <Card variant="outlined" className="mt-8 space-y-4">
        <h2 className="ck-heading-sm">Esto es lo que vas a entregar</h2>
        <ul className="space-y-2">
          {props.resumen.map((c) => (
            <li
              key={c.sequence}
              className="flex items-center justify-between gap-3 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface-muted px-4 py-3"
            >
              <span className="min-w-0 text-sm leading-snug text-ck-text">
                <span className="text-ck-text-muted">{c.sequence}.</span> {c.title}
              </span>
              <Badge variant={c.entregada ? "success" : "neutral"}>{c.etiqueta}</Badge>
            </li>
          ))}
        </ul>

        {faltan > 0 ? (
          <p
            role="alert"
            className="rounded-[var(--ck-radius-card)] border border-[var(--ck-warning)]/60 bg-[var(--ck-warning-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--ck-warning)]"
          >
            Te {faltan === 1 ? "queda 1 consigna sin entregar" : `quedan ${faltan} consignas sin entregar`}.
            Si cerrás ahora, {faltan === 1 ? "esa consigna queda" : "esas consignas quedan"} sin foto.
          </p>
        ) : null}

        <p className="text-sm leading-relaxed text-ck-text-secondary">
          Al cerrar tu participación le avisás a la organización que ya terminaste. Si después
          querés cambiar algo, tenés que escribirnos.
        </p>

        {error ? (
          <p
            role="alert"
            className="rounded-[var(--ck-radius-card)] border border-[var(--ck-danger)]/60 bg-[var(--ck-danger-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--ck-danger)]"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={confirmar}
            disabled={enviando}
            className="min-h-11 w-full sm:w-auto"
          >
            {enviando ? "Cerrando…" : "Sí, cerrar mi participación"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setMostrandoResumen(false)}
            disabled={enviando}
            className="min-h-11 w-full sm:w-auto"
          >
            Volver
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="outlined" className="mt-8 space-y-3">
      <h2 className="ck-heading-sm">¿Terminaste?</h2>
      <p className="text-sm leading-relaxed text-ck-text-secondary">
        Cuando no vayas a subir nada más, cerrá tu participación. Vas a ver un resumen antes de
        confirmar.
      </p>
      <Button
        onClick={() => setMostrandoResumen(true)}
        className="min-h-11 w-full sm:w-auto"
      >
        Terminé de subir mis fotos
      </Button>
    </Card>
  );
}
