"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { chequearEdicionAction, type RespuestaChequeo } from "@/lib/edition-rehearsal/actions";
import {
  agruparPorRubro,
  enlaceDeHallazgo,
  presentarRubro,
  presentarSeveridad,
  resumirHallazgos,
} from "@/lib/edition-rehearsal/ui/rehearsal-presentation";

type Props = {
  editionId: string;
  editionName: string;
  timezone: string;
};

function formatearMomento(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function RehearsalClient({ editionId, editionName, timezone }: Props) {
  const [chequeo, setChequeo] = useState<RespuestaChequeo | null>(null);
  const [revisando, empezarRevision] = useTransition();

  function revisar() {
    empezarRevision(async () => {
      setChequeo(await chequearEdicionAction(editionId));
    });
  }

  const resumen =
    chequeo?.ok === true ? resumirHallazgos(chequeo.hallazgos) : null;
  const grupos = chequeo?.ok === true ? agruparPorRubro(chequeo.hallazgos) : [];

  return (
    <div className="min-w-0 space-y-6">
      <Card variant="outlined" className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold text-ck-text">Chequeo de la edición</h2>
            <p className="text-sm text-ck-text-muted">
              Revisa la configuración de {editionName} y avisa qué le falta para que un
              participante pueda hacer todo el recorrido. No modifica nada, así que lo podés
              apretar cuando quieras.
            </p>
          </div>
          <Button type="button" onClick={revisar} loading={revisando} variant="primary">
            {revisando ? "Revisando…" : "Revisar todo"}
          </Button>
        </div>

        {chequeo?.ok === false ? (
          <p className="text-sm text-[var(--ck-danger)]">{chequeo.mensaje}</p>
        ) : null}

        {chequeo?.ok === true && resumen ? (
          <div className="space-y-4">
            <div className="rounded-[var(--ck-radius-sm)] border border-ck-border bg-ck-surface-strong p-4">
              <p className="text-sm font-medium text-ck-text">{resumen.veredicto}</p>
              <p className="mt-1 text-xs text-ck-text-muted">
                {resumen.bloqueantes} bloqueantes · {resumen.atenciones} para revisar ·{" "}
                {resumen.bien} correctos · revisado el{" "}
                {formatearMomento(chequeo.revisadoEl, timezone)}
              </p>
            </div>

            {grupos.map((grupo) => (
              <section key={grupo.rubro} className="space-y-2">
                <h3 className="text-xs uppercase tracking-[0.1em] text-ck-text-muted">
                  {presentarRubro(grupo.rubro)}
                </h3>
                <ul className="space-y-2">
                  {grupo.hallazgos.map((hallazgo) => {
                    const severidad = presentarSeveridad(hallazgo.severidad);
                    const enlace = enlaceDeHallazgo(hallazgo, editionId);
                    return (
                      <li
                        key={hallazgo.id}
                        className="rounded-[var(--ck-radius-sm)] border border-ck-border p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={severidad.variante}>{severidad.etiqueta}</Badge>
                          <span className="text-sm font-medium text-ck-text">
                            {hallazgo.titulo}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-ck-text-secondary">{hallazgo.detalle}</p>
                        {hallazgo.comoArreglar ? (
                          <p className="mt-1 text-sm text-ck-text-muted">
                            Qué hacer: {hallazgo.comoArreglar}
                          </p>
                        ) : null}
                        {enlace ? (
                          <Button href={enlace} variant="text" size="sm" className="mt-2">
                            Ir a arreglarlo
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : null}

        {chequeo === null && !revisando ? (
          <p className="text-sm text-ck-text-muted">
            Todavía no revisaste nada. Apretá &laquo;Revisar todo&raquo; para empezar.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
