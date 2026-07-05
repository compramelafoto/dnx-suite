"use client";

import Input from "@/components/ui/Input";
import {
  CC_CONSULTA_CLOSURE_PROBABILITY_OPTIONS,
  parseClosureProbabilitySelectValue,
  resolveClosureProbabilitySelectValue,
} from "@/lib/cuantocobro/consulta/consulta-closure-probability";
import {
  CC_CONSULTA_JOB_TYPE_OPTIONS,
  CC_CONSULTA_PRIORITY_LABELS,
  CC_CONSULTA_SOURCE_LABELS,
  type CuantoCobroConsultaInput,
} from "@/lib/cuantocobro/consulta/types";
import type {
  CuantoCobroConsultaPipelineStage,
  CuantoCobroConsultaPriority,
  CuantoCobroConsultaSourceChannel,
  CuantoCobroConsultaStatus,
} from "@prisma/client";

const PIPELINE_OPTIONS: { value: CuantoCobroConsultaPipelineStage; label: string }[] = [
  { value: "NEW", label: "Nueva" },
  { value: "CONTACTED", label: "Contactada" },
  { value: "QUALIFIED", label: "Calificada" },
  { value: "PROPOSAL_SENT", label: "Propuesta enviada" },
  { value: "NEGOTIATION", label: "Negociación" },
  { value: "WON", label: "Ganada" },
  { value: "LOST", label: "Perdida" },
];

const STATUS_OPTIONS: { value: CuantoCobroConsultaStatus; label: string }[] = [
  { value: "OPEN", label: "Abierta" },
  { value: "WON", label: "Ganada" },
  { value: "LOST", label: "Perdida" },
  { value: "ARCHIVED", label: "Archivada" },
];

type Props = {
  value: CuantoCobroConsultaInput;
  onChange: (next: CuantoCobroConsultaInput) => void;
  idPrefix?: string;
};

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="cc-consulta-field__label">
      {children}
    </label>
  );
}

export default function ConsultaFormFields({ value, onChange, idPrefix = "consulta" }: Props) {
  const patch = (partial: Partial<CuantoCobroConsultaInput>) => onChange({ ...value, ...partial });

  const priorityOptions = Object.entries(CC_CONSULTA_PRIORITY_LABELS) as [CuantoCobroConsultaPriority, string][];
  const sourceOptions = Object.entries(CC_CONSULTA_SOURCE_LABELS) as [CuantoCobroConsultaSourceChannel, string][];

  return (
    <div className="cc-consulta-form">
      <section className="cc-consulta-form__section">
        <h2 className="cc-consulta-form__section-title">Información</h2>
        <div className="cc-consulta-form__grid">
          <div className="cc-consulta-field cc-consulta-field--full">
            <FieldLabel htmlFor={`${idPrefix}-title`}>Título *</FieldLabel>
            <Input
              id={`${idPrefix}-title`}
              value={value.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Ej. Boda María & Juan — Marzo 2026"
            />
          </div>
          <div className="cc-consulta-field">
            <FieldLabel htmlFor={`${idPrefix}-pipeline`}>Etapa</FieldLabel>
            <select
              id={`${idPrefix}-pipeline`}
              className="cc-consulta-select"
              value={value.pipelineStage}
              onChange={(e) => patch({ pipelineStage: e.target.value as CuantoCobroConsultaPipelineStage })}
            >
              {PIPELINE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="cc-consulta-field">
            <FieldLabel htmlFor={`${idPrefix}-status`}>Estado</FieldLabel>
            <select
              id={`${idPrefix}-status`}
              className="cc-consulta-select"
              value={value.status}
              onChange={(e) => patch({ status: e.target.value as CuantoCobroConsultaStatus })}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="cc-consulta-field">
            <FieldLabel htmlFor={`${idPrefix}-priority`}>Prioridad</FieldLabel>
            <select
              id={`${idPrefix}-priority`}
              className="cc-consulta-select"
              value={value.priority}
              onChange={(e) => patch({ priority: e.target.value as CuantoCobroConsultaPriority })}
            >
              {priorityOptions.map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="cc-consulta-field cc-consulta-field--full">
            <FieldLabel htmlFor={`${idPrefix}-probability`}>Probabilidad de cierre efectivo</FieldLabel>
            <p className="cc-consulta-field__hint m-0 mb-2 text-sm text-[var(--cc-color-muted)]">
              Qué tan probable es que este trabajo se concrete. Te ayuda a priorizar el seguimiento comercial.
            </p>
            <select
              id={`${idPrefix}-probability`}
              className="cc-consulta-select min-h-[44px]"
              value={resolveClosureProbabilitySelectValue(value.probability)}
              onChange={(e) => patch({ probability: parseClosureProbabilitySelectValue(e.target.value) })}
            >
              {CC_CONSULTA_CLOSURE_PROBABILITY_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value ?? ""}>
                  {opt.value != null ? `${opt.label} — ${opt.description}` : opt.description}
                </option>
              ))}
            </select>
          </div>
          <div className="cc-consulta-field">
            <FieldLabel htmlFor={`${idPrefix}-jobType`}>Tipo de trabajo</FieldLabel>
            <select
              id={`${idPrefix}-jobType`}
              className="cc-consulta-select"
              value={value.jobType}
              onChange={(e) => patch({ jobType: e.target.value })}
            >
              {CC_CONSULTA_JOB_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value || "empty"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="cc-consulta-field">
            <FieldLabel htmlFor={`${idPrefix}-eventDate`}>Fecha del evento</FieldLabel>
            <Input
              id={`${idPrefix}-eventDate`}
              type="date"
              value={value.eventDate}
              onChange={(e) => patch({ eventDate: e.target.value })}
            />
          </div>
          <div className="cc-consulta-field">
            <FieldLabel htmlFor={`${idPrefix}-currency`}>Moneda</FieldLabel>
            <Input
              id={`${idPrefix}-currency`}
              value={value.currency}
              onChange={(e) => patch({ currency: e.target.value.toUpperCase() })}
              placeholder="ARS"
            />
          </div>
          <div className="cc-consulta-field">
            <FieldLabel htmlFor={`${idPrefix}-estimatedValue`}>Valor estimado</FieldLabel>
            <Input
              id={`${idPrefix}-estimatedValue`}
              inputMode="decimal"
              value={value.estimatedValue}
              onChange={(e) => patch({ estimatedValue: e.target.value })}
              placeholder="Monto orientativo"
            />
          </div>
          <div className="cc-consulta-field cc-consulta-field--full">
            <FieldLabel htmlFor={`${idPrefix}-eventLocation`}>Lugar</FieldLabel>
            <Input
              id={`${idPrefix}-eventLocation`}
              value={value.eventLocation}
              onChange={(e) => patch({ eventLocation: e.target.value })}
            />
          </div>
          <div className="cc-consulta-field">
            <FieldLabel htmlFor={`${idPrefix}-eventCity`}>Ciudad</FieldLabel>
            <Input
              id={`${idPrefix}-eventCity`}
              value={value.eventCity}
              onChange={(e) => patch({ eventCity: e.target.value })}
            />
          </div>
          <div className="cc-consulta-field cc-consulta-field--full">
            <FieldLabel htmlFor={`${idPrefix}-brief`}>Resumen / brief</FieldLabel>
            <textarea
              id={`${idPrefix}-brief`}
              className="cc-consulta-textarea"
              rows={3}
              value={value.brief}
              onChange={(e) => patch({ brief: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="cc-consulta-form__section">
        <h2 className="cc-consulta-form__section-title">Cliente</h2>
        <div className="cc-consulta-form__grid">
          <div className="cc-consulta-field">
            <FieldLabel htmlFor={`${idPrefix}-clientName`}>Nombre</FieldLabel>
            <Input
              id={`${idPrefix}-clientName`}
              value={value.clientDisplayName}
              onChange={(e) => patch({ clientDisplayName: e.target.value })}
            />
          </div>
          <div className="cc-consulta-field">
            <FieldLabel htmlFor={`${idPrefix}-clientCompany`}>Empresa</FieldLabel>
            <Input
              id={`${idPrefix}-clientCompany`}
              value={value.clientCompany}
              onChange={(e) => patch({ clientCompany: e.target.value })}
            />
          </div>
          <div className="cc-consulta-field">
            <FieldLabel htmlFor={`${idPrefix}-clientEmail`}>Email</FieldLabel>
            <Input
              id={`${idPrefix}-clientEmail`}
              type="email"
              value={value.clientEmail}
              onChange={(e) => patch({ clientEmail: e.target.value })}
            />
          </div>
          <div className="cc-consulta-field">
            <FieldLabel htmlFor={`${idPrefix}-clientPhone`}>Teléfono</FieldLabel>
            <Input
              id={`${idPrefix}-clientPhone`}
              type="tel"
              value={value.clientPhone}
              onChange={(e) => patch({ clientPhone: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="cc-consulta-form__section">
        <h2 className="cc-consulta-form__section-title">Origen y seguimiento</h2>
        <div className="cc-consulta-form__grid">
          <div className="cc-consulta-field">
            <FieldLabel htmlFor={`${idPrefix}-source`}>Origen</FieldLabel>
            <select
              id={`${idPrefix}-source`}
              className="cc-consulta-select"
              value={value.sourceChannel}
              onChange={(e) => patch({ sourceChannel: e.target.value as CuantoCobroConsultaSourceChannel })}
            >
              {sourceOptions.map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="cc-consulta-field">
            <FieldLabel htmlFor={`${idPrefix}-sourceDetail`}>Detalle de origen</FieldLabel>
            <Input
              id={`${idPrefix}-sourceDetail`}
              value={value.sourceDetail}
              onChange={(e) => patch({ sourceDetail: e.target.value })}
            />
          </div>
          <div className="cc-consulta-field cc-consulta-field--full">
            <FieldLabel htmlFor={`${idPrefix}-nextAction`}>Próxima acción</FieldLabel>
            <Input
              id={`${idPrefix}-nextAction`}
              value={value.nextActionTitle}
              onChange={(e) => patch({ nextActionTitle: e.target.value })}
              placeholder="Ej. Enviar presupuesto, llamar al cliente…"
            />
          </div>
          <div className="cc-consulta-field">
            <FieldLabel htmlFor={`${idPrefix}-nextActionDue`}>Vence</FieldLabel>
            <Input
              id={`${idPrefix}-nextActionDue`}
              type="datetime-local"
              value={value.nextActionDueAt ? value.nextActionDueAt.slice(0, 16) : ""}
              onChange={(e) =>
                patch({
                  nextActionDueAt: e.target.value ? new Date(e.target.value).toISOString() : "",
                })
              }
            />
          </div>
          <div className="cc-consulta-field cc-consulta-field--full">
            <FieldLabel htmlFor={`${idPrefix}-tags`}>Etiquetas (separadas por coma)</FieldLabel>
            <Input
              id={`${idPrefix}-tags`}
              value={value.tags.join(", ")}
              onChange={(e) =>
                patch({
                  tags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              placeholder="boda, 2026, prioridad"
            />
          </div>
          {value.status === "LOST" ? (
            <div className="cc-consulta-field cc-consulta-field--full">
              <FieldLabel htmlFor={`${idPrefix}-lostReason`}>Motivo de pérdida</FieldLabel>
              <Input
                id={`${idPrefix}-lostReason`}
                value={value.lostReason}
                onChange={(e) => patch({ lostReason: e.target.value })}
              />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
