/**
 * Las fotografías que esperan una decisión de la organización.
 *
 * Antes estaban listadas en el resumen de decisiones recientes, sin imagen y
 * sin nada que apretar: decía el código del motivo y ahí terminaba. Decidir
 * sobre una fotografía sin verla no es decidir, así que acá va la foto, lo que
 * pasó en criollo y los dos botones.
 */
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { AdminTechnicalInfo } from "@/components/admin/AdminTechnicalInfo";
import { MiniaturaDeEnvio } from "@/components/admin/admission/MiniaturaDeEnvio";
import { Card } from "@/components/ui/Card";
import { resolveManualReviewAction } from "@/lib/technical-admission/actions";
import { porQueEspera } from "@/lib/technical-admission/por-que-espera";
import { formatSubmissionDateTime } from "@/lib/photo-upload/ui/submission-status-presentation";

export type FilaDeRevision = {
  decisionId: string;
  submissionId: string;
  manualReviewReasons: unknown;
  participante: string | null;
  consignaNumero: number | null;
  consignaTitulo: string | null;
  subidaEn: Date;
  capturaEn: Date | null;
  razonDeCaptura: string | null;
  tieneArchivo: boolean;
};

function codigos(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

export function ColaDeRevision({
  editionId,
  filas,
  totalPendientes,
}: {
  editionId: string;
  filas: FilaDeRevision[];
  totalPendientes: number;
}) {
  if (totalPendientes === 0) {
    return (
      <Card variant="outlined" className="space-y-2 p-5">
        <h2 className="font-semibold text-ck-text">Fotos que esperan tu decisión</h2>
        <p className="text-sm text-ck-text-muted">
          No queda ninguna. Todas las fotografías evaluadas tienen decisión.
        </p>
      </Card>
    );
  }

  return (
    <Card variant="outlined" className="space-y-5 p-5">
      <div>
        <h2 className="font-semibold text-ck-text">
          Fotos que esperan tu decisión ({totalPendientes})
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ck-text-muted">
          El control automático no las rechazó: las dejó para que las mire una persona. Mirá cada
          fotografía y elegí. Admitir la deja lista para el jurado; rechazar la saca del concurso y
          el participante ve el motivo que escribas.
        </p>
      </div>

      <ul className="space-y-5">
        {filas.map((fila) => {
          const motivo = porQueEspera({
            codigos: codigos(fila.manualReviewReasons),
            razonDeCaptura: fila.razonDeCaptura,
            horaDeCaptura: fila.capturaEn ? formatSubmissionDateTime(fila.capturaEn) : null,
          });

          return (
            <li
              key={fila.decisionId}
              className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border p-4"
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
                {fila.tieneArchivo ? (
                  <MiniaturaDeEnvio
                    submissionId={fila.submissionId}
                    alt={`Fotografía de ${fila.participante ?? "un participante"} para la consigna ${fila.consignaNumero ?? "sin número"}`}
                    className="h-auto max-h-[22rem] w-full bg-ck-surface-strong object-contain"
                    abreEnPestana
                  />
                ) : (
                  <div className="flex min-h-[10rem] items-center justify-center rounded-[var(--ck-radius-sm)] border border-dashed border-ck-border px-4 text-center text-sm text-ck-text-muted">
                    No hay archivo guardado para esta entrega.
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-ck-text">
                      {fila.participante ?? "Participante sin código"}
                      {fila.consignaNumero !== null ? ` · Consigna ${fila.consignaNumero}` : ""}
                    </p>
                    {fila.consignaTitulo ? (
                      <p className="text-sm text-ck-text-secondary">{fila.consignaTitulo}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-ck-text-muted">
                      Cargada el {formatSubmissionDateTime(fila.subidaEn)}
                    </p>
                  </div>

                  <div className="rounded-[var(--ck-radius-sm)] bg-ck-surface-strong px-3 py-3">
                    <p className="text-sm font-semibold text-ck-text">{motivo.titulo}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ck-text-secondary">
                      {motivo.quePaso}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-ck-text-muted">
                      {motivo.comoDecidir}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <form
                      action={resolveManualReviewAction.bind(null, editionId)}
                      className="w-full"
                    >
                      <input type="hidden" name="submissionId" value={fila.submissionId} />
                      <input type="hidden" name="decision" value="ADMIT" />
                      <input type="hidden" name="notes" value="Revisión manual: admitida." />
                      <ConfirmSubmitButton
                        variant="primary"
                        size="sm"
                        className="min-h-11 w-full sm:w-auto"
                        confirmMessage="¿Admitir esta fotografía? Queda dentro del concurso y pasa al jurado."
                      >
                        Admitir la foto
                      </ConfirmSubmitButton>
                    </form>

                    <form
                      action={resolveManualReviewAction.bind(null, editionId)}
                      className="flex w-full flex-col gap-3 sm:flex-row"
                    >
                      <input type="hidden" name="submissionId" value={fila.submissionId} />
                      <input type="hidden" name="decision" value="REJECT" />
                      <input
                        name="publicReason"
                        placeholder="Motivo que va a ver el participante"
                        className="min-h-11 flex-1 rounded-[var(--ck-radius-sm)] border border-ck-border bg-transparent px-3 text-sm"
                        aria-label="Motivo que va a ver el participante"
                      />
                      <ConfirmSubmitButton
                        variant="outline"
                        size="sm"
                        className="min-h-11 w-full sm:w-auto"
                        confirmMessage="¿Rechazar esta fotografía? Queda fuera del concurso y el participante ve el motivo."
                      >
                        Rechazar la foto
                      </ConfirmSubmitButton>
                    </form>
                  </div>

                  <AdminTechnicalInfo
                    rows={[
                      { label: "Envío", value: fila.submissionId, mono: true },
                      {
                        label: "Motivos",
                        value: codigos(fila.manualReviewReasons).join(", ") || "—",
                      },
                      {
                        label: "Fecha de captura leída",
                        value: fila.capturaEn ? formatSubmissionDateTime(fila.capturaEn) : "ausente",
                      },
                      { label: "Lectura del control", value: fila.razonDeCaptura ?? "—" },
                    ]}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {totalPendientes > filas.length ? (
        <p className="text-sm text-ck-text-muted">
          Se muestran {filas.length} de {totalPendientes}. Al resolver estas aparecen las
          siguientes.
        </p>
      ) : null}
    </Card>
  );
}
