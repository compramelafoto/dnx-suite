"use client";

import { useEffect, useState, type ReactNode } from "react";
import { opcionesDeConsultaAction, type OpcionesConsultaState } from "@/app/actions/website-formularios";
import { SelectField, TextAreaField, TextField, ToggleField } from "@/components/website/inspector/inspector-fields";
import {
  FORM_FIELD_TYPES,
  FORM_MAX_FIELDS,
  FORM_MAX_OPTIONS,
  type FormBlockConfig,
  type FormField,
  type FormFieldType,
  type NewsletterBlockConfig,
} from "@/lib/website/blocks";
import { contactoPorEtiquetas, enlaceSeguroDelFormulario } from "@/lib/website/formularios";

/**
 * Inspectores de los bloques Formulario (FORM) y Boletín (NEWSLETTER). Archivo «use client» aparte
 * porque tienen estado (las opciones de Consultas se piden al abrir, y la lista de opciones de un
 * campo se edita como texto). Controlados: cada cambio llama a `onChange` con la config completa.
 */

const TIPOS: Record<FormFieldType, string> = {
  text: "Texto corto",
  email: "Correo",
  phone: "Teléfono",
  number: "Número",
  date: "Fecha",
  select: "Lista de opciones",
  checkbox: "Casilla (sí/no)",
  textarea: "Texto largo",
};

function newItemId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `it_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function Warning({ children }: { children: ReactNode }) {
  return <p className="text-xs text-red-600">{children}</p>;
}

function Helper({ children }: { children: ReactNode }) {
  return <p className="text-xs text-[var(--fo-muted)]">{children}</p>;
}

/** Las opciones de una lista, una por renglón. El texto se guarda aparte para no comerse el Enter. */
function OpcionesDelCampo({ options, onChange, label }: { options: string[]; onChange: (o: string[]) => void; label: string }) {
  const [texto, setTexto] = useState(options.join("\n"));
  return (
    <label className="block space-y-1">
      <span className="text-xs text-[var(--fo-muted)]">Opciones (una por renglón, hasta {FORM_MAX_OPTIONS})</span>
      <textarea
        className="fo-input"
        rows={4}
        aria-label={`Opciones de ${label}`}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          onChange(
            e.target.value
              .split("\n")
              .map((o) => o.trim().slice(0, 100))
              .filter(Boolean)
              .slice(0, FORM_MAX_OPTIONS),
          );
        }}
      />
    </label>
  );
}

function CampoEditor({
  field,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  field: FormField;
  index: number;
  count: number;
  onChange: (f: FormField) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const nombre = field.label.trim() || `Campo ${index + 1}`;
  return (
    <div className="space-y-2 rounded-lg border border-[var(--fo-border)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-[var(--fo-muted)]">{nombre}</span>
        <div className="flex items-center gap-1">
          <button type="button" className="px-1 disabled:opacity-30" aria-label={`Subir ${nombre}`} disabled={index === 0} onClick={() => onMove(index - 1)}>
            ↑
          </button>
          <button type="button" className="px-1 disabled:opacity-30" aria-label={`Bajar ${nombre}`} disabled={index === count - 1} onClick={() => onMove(index + 1)}>
            ↓
          </button>
          <button type="button" className="px-1 text-red-600" aria-label={`Quitar ${nombre}`} onClick={onRemove}>
            ×
          </button>
        </div>
      </div>
      <input
        className="fo-input"
        aria-label={`Etiqueta del campo ${index + 1}`}
        placeholder="Etiqueta (por ejemplo «Nombre»)"
        maxLength={120}
        value={field.label}
        onChange={(e) => onChange({ ...field, label: e.target.value })}
      />
      <select className="fo-input" aria-label={`Tipo del campo ${index + 1}`} value={field.type} onChange={(e) => onChange({ ...field, type: e.target.value as FormFieldType })}>
        {FORM_FIELD_TYPES.map((t) => (
          <option key={t} value={t}>
            {TIPOS[t]}
          </option>
        ))}
      </select>
      {field.type === "select" ? <OpcionesDelCampo options={field.options} label={nombre} onChange={(options) => onChange({ ...field, options })} /> : null}
      {field.type === "select" && field.options.length === 0 ? <Warning>Sin opciones, se muestra como texto corto.</Warning> : null}
      <input
        className="fo-input"
        aria-label={`Ayuda del campo ${index + 1}`}
        placeholder="Texto de ayuda (opcional)"
        maxLength={200}
        value={field.help}
        onChange={(e) => onChange({ ...field, help: e.target.value })}
      />
      <ToggleField label={field.type === "checkbox" ? "Obligatorio (hay que marcarla)" : "Obligatorio"} checked={field.required} onChange={(v) => onChange({ ...field, required: v })} />
    </div>
  );
}

export function FormInspector({ config, onChange }: { config: FormBlockConfig; onChange: (c: FormBlockConfig) => void }) {
  const fields = config.fields;
  const setFields = (next: FormField[]) => onChange({ ...config, fields: next });
  const [opciones, setOpciones] = useState<OpcionesConsultaState | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    if (!config.createInquiry || opciones) return;
    let vivo = true;
    opcionesDeConsultaAction()
      .then((r) => vivo && setOpciones(r))
      .catch(() => vivo && setFallo(true));
    return () => {
      vivo = false;
    };
  }, [config.createInquiry, opciones]);

  const redirectOk = enlaceSeguroDelFormulario(config.redirectUrl);
  const revealLinkOk = enlaceSeguroDelFormulario(config.revealLinkUrl);
  // ¿Puede crear consultas? Hace falta un campo «Nombre» y uno de correo o teléfono.
  const etiquetas = fields.map((f) => ({ etiqueta: f.label, valor: "x" }));
  const tieneNombre = contactoPorEtiquetas(etiquetas).nombre !== null;
  const tieneContacto = fields.some((f) => f.type === "email" || f.type === "phone");

  return (
    <div className="space-y-4">
      <TextField label="Título" value={config.title} onChange={(v) => onChange({ ...config, title: v })} helper="Con este nombre aparecen los envíos en Sitio web → Formularios." />
      <TextAreaField label="Texto de presentación (opcional)" value={config.intro} onChange={(v) => onChange({ ...config, intro: v })} rows={3} />

      <div className="space-y-3">
        <span className="fo-label">Campos</span>
        {fields.map((field, i) => (
          <CampoEditor
            key={field.id || i}
            field={field}
            index={i}
            count={fields.length}
            onChange={(f) => setFields(fields.map((it, j) => (j === i ? f : it)))}
            onMove={(to) => setFields(move(fields, i, to))}
            onRemove={() => setFields(fields.filter((_, j) => j !== i))}
          />
        ))}
        {fields.length < FORM_MAX_FIELDS ? (
          <button
            type="button"
            className="text-sm underline"
            onClick={() => setFields([...fields, { id: newItemId(), type: "text", label: "", required: false, help: "", options: [] }])}
          >
            Agregar campo
          </button>
        ) : (
          <Helper>Llegaste al máximo de {FORM_MAX_FIELDS} campos.</Helper>
        )}
        {fields.length === 0 ? <Warning>Agregá al menos un campo: sin campos el formulario no se puede enviar.</Warning> : null}
      </div>

      <TextField label="Texto del botón" value={config.buttonLabel} onChange={(v) => onChange({ ...config, buttonLabel: v })} />

      <SelectField
        label="Al enviar"
        value={config.afterSubmit}
        onChange={(v) => onChange({ ...config, afterSubmit: v as FormBlockConfig["afterSubmit"] })}
        options={[
          { value: "message", label: "Mostrar un mensaje" },
          { value: "redirect", label: "Ir a otra página o enlace" },
          { value: "reveal", label: "Mostrar contenido oculto" },
        ]}
      />
      {config.afterSubmit === "message" ? (
        <TextAreaField label="Mensaje" value={config.thanksMessage} onChange={(v) => onChange({ ...config, thanksMessage: v })} rows={2} />
      ) : null}
      {config.afterSubmit === "redirect" ? (
        <>
          <TextField
            label="Adónde lleva"
            value={config.redirectUrl}
            onChange={(v) => onChange({ ...config, redirectUrl: v })}
            helper="Una página de tu sitio («/videos») o un enlace que empiece con https://."
          />
          {config.redirectUrl.trim() && !redirectOk ? <Warning>Esa dirección no sirve: se va a mostrar el mensaje de gracias.</Warning> : null}
          <TextAreaField label="Mensaje si no se puede ir" value={config.thanksMessage} onChange={(v) => onChange({ ...config, thanksMessage: v })} rows={2} />
        </>
      ) : null}
      {config.afterSubmit === "reveal" ? (
        <>
          <TextAreaField label="Texto que aparece después de enviar" value={config.revealText} onChange={(v) => onChange({ ...config, revealText: v })} rows={3} />
          <TextField label="Texto del botón (opcional)" value={config.revealLinkLabel} onChange={(v) => onChange({ ...config, revealLinkLabel: v })} helper="Por ejemplo «Mirá los videos acá»." />
          <TextField label="Enlace del botón (opcional)" value={config.revealLinkUrl} onChange={(v) => onChange({ ...config, revealLinkUrl: v })} helper="Una página de tu sitio o un enlace https://." />
          {config.revealLinkUrl.trim() && !revealLinkOk ? <Warning>Ese enlace no sirve: el botón no se va a mostrar.</Warning> : null}
          <Helper>Este contenido no viaja con la página: el sitio lo muestra recién cuando alguien envía el formulario completo.</Helper>
        </>
      ) : null}

      <ToggleField label="Crear también una consulta en Consultas" checked={config.createInquiry} onChange={(v) => onChange({ ...config, createInquiry: v })} />
      {config.createInquiry ? (
        <div className="space-y-3 rounded-lg border border-[var(--fo-border)] p-3">
          {opciones && !opciones.consultasEncendido ? <Warning>Consultas está apagado: los envíos llegan a la bandeja pero no se crea la consulta.</Warning> : null}
          {fallo ? <Warning>No se pudieron leer las categorías. Probá de nuevo más tarde.</Warning> : null}
          {!opciones && !fallo ? <Helper>Cargando categorías…</Helper> : null}
          {opciones ? (
            <>
              <SelectField
                label="Categoría de la consulta"
                value={config.categoryId}
                onChange={(v) => onChange({ ...config, categoryId: v })}
                options={[{ value: "", label: "La que corresponda (Otro)" }, ...opciones.categorias.map((c) => ({ value: c.id, label: c.nombre }))]}
              />
              <SelectField
                label="Origen («¿Cómo nos conociste?»)"
                value={config.origenId}
                onChange={(v) => onChange({ ...config, origenId: v })}
                options={[{ value: "", label: "Sin origen" }, ...opciones.origenes.map((o) => ({ value: o.id, label: o.nombre }))]}
              />
            </>
          ) : null}
          {!tieneNombre || !tieneContacto ? (
            <Warning>Para crear la consulta hace falta un campo «Nombre» y uno de tipo Correo o Teléfono. Sin esos datos, el envío llega sólo a la bandeja.</Warning>
          ) : (
            <Helper>La consulta se crea cuando la persona deja su nombre y un correo o teléfono.</Helper>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function NewsletterInspector({ config, onChange }: { config: NewsletterBlockConfig; onChange: (c: NewsletterBlockConfig) => void }) {
  return (
    <div className="space-y-4">
      <TextField label="Título" value={config.title} onChange={(v) => onChange({ ...config, title: v })} />
      <TextAreaField label="Texto (opcional)" value={config.intro} onChange={(v) => onChange({ ...config, intro: v })} rows={3} />
      <ToggleField label="Pedir también el nombre" checked={config.askName} onChange={(v) => onChange({ ...config, askName: v })} />
      <TextField label="Texto del botón" value={config.buttonLabel} onChange={(v) => onChange({ ...config, buttonLabel: v })} />
      <TextAreaField label="Mensaje de gracias" value={config.thanksMessage} onChange={(v) => onChange({ ...config, thanksMessage: v })} rows={2} />
      <Helper>Los correos se guardan en Sitio web → Formularios → Suscriptores, de donde se pueden exportar. Un correo repetido no se duplica.</Helper>
    </div>
  );
}
