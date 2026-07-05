"use client";

import CuantoCobroJobLocationSearch from "@/components/cuantocobro/CuantoCobroJobLocationSearch";
import { DsField } from "@/components/ui/DsField";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import {
  CLIENT_HOUR_FIELDS,
  CLIENT_HOUR_HINTS,
  CLIENT_HOUR_LABELS,
  sumClientHours,
  type ClientHourField,
} from "@/lib/cuantocobro/client-hours";
import type { CuantoCobroClientHoursInput, CuantoCobroClientInput, CuantoCobroQuoteInput } from "@/lib/cuantocobro/types";
import { handleCuantoCobroDetailsToggle } from "@/lib/cuantocobro/scroll-section-into-view";
import { useMemo, type ReactNode } from "react";

const DS_FORM_GRID = "ds-form-grid grid grid-cols-1 gap-4 sm:grid-cols-2";
const DS_HOURS_GRID = "cc-client-step__hours-grid ds-form-grid grid grid-cols-2 gap-3 sm:grid-cols-3";

const CLIENT_HOUR_GROUPS: { title: string; description: string; fields: ClientHourField[] }[] = [
  {
    title: "Comercial",
    description: "Venta, reuniones y seguimiento con el cliente.",
    fields: ["salesHours", "meetingsHours", "followUpHours"],
  },
  {
    title: "Gestión y cierre",
    description: "Coordinación, preparación, facturación y entrega administrativa.",
    fields: ["generalPrepHours", "coordinationHours", "billingHours", "administrativeDeliveryHours"],
  },
];

type Props = {
  quote: CuantoCobroQuoteInput;
  onQuoteChange: <K extends keyof CuantoCobroQuoteInput>(key: K, value: CuantoCobroQuoteInput[K]) => void;
};

function updateClient(
  client: CuantoCobroClientInput,
  patch: Partial<CuantoCobroClientInput>,
): CuantoCobroClientInput {
  return { ...client, ...patch };
}

function updateClientHours(
  hours: CuantoCobroClientHoursInput,
  patch: Partial<CuantoCobroClientHoursInput>,
): CuantoCobroClientHoursInput {
  return { ...hours, ...patch };
}

function ClientStepSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="cc-client-step__section">
      <header className="cc-client-step__section-header">
        <h4 className="cc-client-step__section-title m-0">{title}</h4>
        {description ? <p className="cc-client-step__section-desc m-0">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export default function CuantoCobroClientStep({ quote, onQuoteChange }: Props) {
  const { client } = quote;

  const setClient = (patch: Partial<CuantoCobroClientInput>) => {
    onQuoteChange("client", updateClient(client, patch));
  };

  const setClientHours = (patch: Partial<CuantoCobroClientHoursInput>) => {
    onQuoteChange("client", updateClient(client, { hours: updateClientHours(client.hours, patch) }));
  };

  const totalClientHours = useMemo(() => sumClientHours(client.hours), [client.hours]);
  const hasInternalNotes = quote.internalNotes.trim().length > 0;

  return (
    <div className="cc-client-step ds-form-stack">
      <p className="cc-client-step__lead m-0 text-sm text-[var(--cc-color-muted)]">
        Datos del cliente y del trabajo. Las horas generales se cargan una sola vez por presupuesto — no van en cada
        producto o servicio.
      </p>

      <ClientStepSection title="Contacto" description="Quién contrata y cómo contactarlo.">
        <div className={DS_FORM_GRID}>
          <DsField label="Nombre" htmlFor="cc-client-name">
            <Input
              id="cc-client-name"
              placeholder="Nombre del contacto"
              value={client.name}
              onChange={(e) => setClient({ name: e.target.value })}
            />
          </DsField>
          <DsField label="Empresa" htmlFor="cc-client-company" hint="Opcional">
            <Input
              id="cc-client-company"
              placeholder="Razón social o marca"
              value={client.company}
              onChange={(e) => setClient({ company: e.target.value })}
            />
          </DsField>
          <DsField label="Email" htmlFor="cc-client-email" hint="Opcional">
            <Input
              id="cc-client-email"
              type="email"
              placeholder="contacto@cliente.com"
              value={client.email}
              onChange={(e) => setClient({ email: e.target.value })}
            />
          </DsField>
          <DsField label="Teléfono" htmlFor="cc-client-phone" hint="Opcional">
            <Input
              id="cc-client-phone"
              type="tel"
              placeholder="+54 9 …"
              value={client.phone}
              onChange={(e) => setClient({ phone: e.target.value })}
            />
          </DsField>
        </div>
      </ClientStepSection>

      <ClientStepSection title="Trabajo" description="Cuándo, qué tipo y dónde se realiza.">
        <div className={DS_FORM_GRID}>
          <DsField label="Fecha" htmlFor="cc-job-date" hint="Opcional">
            <Input
              id="cc-job-date"
              type="date"
              value={client.jobDate}
              onChange={(e) => setClient({ jobDate: e.target.value })}
            />
          </DsField>
          <DsField label="Tipo de trabajo" htmlFor="cc-job-type">
            <Select id="cc-job-type" value={client.jobType} onChange={(e) => setClient({ jobType: e.target.value })}>
              <option value="">Seleccioná un tipo</option>
              <option value="boda">Boda</option>
              <option value="evento">Evento</option>
              <option value="retrato">Retrato / sesión</option>
              <option value="producto">Producto / comercial</option>
              <option value="escolar">Fotografía escolar</option>
              <option value="otro">Otro</option>
            </Select>
          </DsField>
        </div>
        <DsField
          label="Lugar"
          className="mt-4"
          hint="Opcional. Buscá en la lista para georeferenciar y calcular distancia."
        >
          <CuantoCobroJobLocationSearch
            location={client.jobLocation}
            latitude={client.jobLatitude}
            longitude={client.jobLongitude}
            onLocationChange={(address, lat, lon) => {
              setClient({
                jobLocation: address,
                jobLatitude: String(lat),
                jobLongitude: String(lon),
              });
            }}
            onClear={() => {
              setClient({ jobLocation: "", jobLatitude: "", jobLongitude: "" });
            }}
          />
        </DsField>
      </ClientStepSection>

      <details
        className="cc-client-step__details"
        open={totalClientHours > 0}
        onToggle={handleCuantoCobroDetailsToggle}
      >
        <summary className="cc-client-step__details-summary">
          <span className="cc-client-step__details-title">Horas generales del cliente</span>
          <span className="cc-client-step__details-meta">
            {totalClientHours > 0 ? `${totalClientHours} h cargadas` : "Opcional"}
          </span>
        </summary>
        <div className="cc-client-step__details-body">
          <p className="cc-client-step__section-desc m-0">
            Tiempo de gestión que no pertenece a un producto o servicio puntual del presupuesto.
          </p>
          {CLIENT_HOUR_GROUPS.map((group) => (
            <div key={group.title} className="cc-client-step__hour-group">
              <h5 className="cc-client-step__hour-group-title m-0">{group.title}</h5>
              <p className="cc-client-step__hour-group-desc m-0">{group.description}</p>
              <div className={`${DS_HOURS_GRID} mt-3`}>
                {group.fields.map((field) => (
                  <DsField
                    key={field}
                    label={CLIENT_HOUR_LABELS[field]}
                    htmlFor={`cc-client-${field}`}
                    hint={CLIENT_HOUR_HINTS[field]}
                    className="cc-client-step__hour-field"
                  >
                    <Input
                      id={`cc-client-${field}`}
                      type="number"
                      min={0}
                      inputMode="decimal"
                      placeholder="0"
                      className="cc-client-step__hour-input"
                      value={client.hours[field]}
                      onChange={(e) => setClientHours({ [field]: e.target.value })}
                    />
                  </DsField>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>

      <details
        className="cc-client-step__details"
        open={hasInternalNotes}
        onToggle={handleCuantoCobroDetailsToggle}
      >
        <summary className="cc-client-step__details-summary">
          <span className="cc-client-step__details-title">Notas internas</span>
          <span className="cc-client-step__details-meta">Solo para vos</span>
        </summary>
        <div className="cc-client-step__details-body">
          <DsField
            label="Recordatorios"
            htmlFor="cc-internal-notes"
            hint="No se muestran en la vista previa comercial."
          >
            <Textarea
              id="cc-internal-notes"
              rows={3}
              placeholder="Acuerdos previos, restricciones del lugar, recordatorios…"
              value={quote.internalNotes}
              onChange={(e) => onQuoteChange("internalNotes", e.target.value)}
            />
          </DsField>
        </div>
      </details>
    </div>
  );
}
