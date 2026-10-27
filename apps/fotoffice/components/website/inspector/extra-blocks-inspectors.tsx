"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImageUploadField } from "@/components/image-upload-field";
import { InputMoneda } from "@/components/campos/input-moneda";
import { SelectField, TextAreaField, TextField, ToggleField } from "@/components/website/inspector/inspector-fields";
import {
  FAQ_MAX_ITEMS,
  FEATURE_ICONS,
  FEATURES_MAX_ITEMS,
  FEATURES_MIN_ITEMS,
  MAP_DEFAULT_HEIGHT_PX,
  MAP_MAX_HEIGHT_PX,
  MAP_MIN_HEIGHT_PX,
  PARTNERS_MAX_ITEMS,
  PAYMENT_MAX_AMOUNT,
  type BeforeAfterBlockConfig,
  type CountdownBlockConfig,
  type DividerBlockConfig,
  type FaqBlockConfig,
  type FeatureIcon,
  type FeaturesBlockConfig,
  type MapBlockConfig,
  type PartnersBlockConfig,
  type PaymentButtonBlockConfig,
  type WhatsappButtonBlockConfig,
} from "@/lib/website/blocks";
import { countdownTargetMs, externalHttpUrl, externalHttpsUrl } from "@/lib/website/blocks-extra";
import { whatsappHref } from "@/lib/website/contact";

/**
 * Inspectores de los bloques nuevos del armador. Viven en un archivo «use client» aparte porque
 * algunos tienen estado (subidas asíncronas, listas) y `block-registry.tsx` no puede usar hooks.
 * Todos son controlados: cada cambio llama a `onChange` con la config completa.
 */

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

/** La config vigente en una ref: las subidas terminan después y no deben pisar lo que se tipeó. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function Warning({ children }: { children: ReactNode }) {
  return <p className="text-xs text-red-600">{children}</p>;
}

function Helper({ children }: { children: ReactNode }) {
  return <p className="text-xs text-[var(--fo-muted)]">{children}</p>;
}

/** Botonera de un ítem de lista: subir, bajar, quitar. */
function ItemActions({ index, count, onMove, onRemove, noun }: { index: number; count: number; onMove: (to: number) => void; onRemove?: () => void; noun: string }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" className="px-1 disabled:opacity-30" aria-label={`Subir ${noun}`} disabled={index === 0} onClick={() => onMove(index - 1)}>
        ↑
      </button>
      <button type="button" className="px-1 disabled:opacity-30" aria-label={`Bajar ${noun}`} disabled={index === count - 1} onClick={() => onMove(index + 1)}>
        ↓
      </button>
      {onRemove ? (
        <button type="button" className="px-1 text-red-600" aria-label={`Quitar ${noun}`} onClick={onRemove}>
          ×
        </button>
      ) : null}
    </div>
  );
}

export function DividerInspector({ config, onChange }: { config: DividerBlockConfig; onChange: (c: DividerBlockConfig) => void }) {
  return (
    <div className="space-y-4">
      <SelectField
        label="Estilo"
        value={config.style}
        onChange={(v) => onChange({ ...config, style: v as DividerBlockConfig["style"] })}
        options={[
          { value: "solid", label: "Línea lisa" },
          { value: "dotted", label: "Línea punteada" },
          { value: "ornament", label: "Línea con adorno al medio" },
        ]}
      />
      <SelectField
        label="Ancho"
        value={config.width}
        onChange={(v) => onChange({ ...config, width: v as DividerBlockConfig["width"] })}
        options={[
          { value: "short", label: "Corta" },
          { value: "medium", label: "Media" },
          { value: "full", label: "De lado a lado" },
        ]}
      />
      <SelectField
        label="Espacio arriba y abajo"
        value={config.spacing}
        onChange={(v) => onChange({ ...config, spacing: v as DividerBlockConfig["spacing"] })}
        options={[
          { value: "sm", label: "Poco" },
          { value: "md", label: "Medio" },
          { value: "lg", label: "Mucho" },
        ]}
      />
    </div>
  );
}

export function FaqInspector({ config, onChange }: { config: FaqBlockConfig; onChange: (c: FaqBlockConfig) => void }) {
  const items = config.items;
  const set = (next: FaqBlockConfig["items"]) => onChange({ ...config, items: next });
  return (
    <div className="space-y-4">
      <TextField label="Título" value={config.title} onChange={(v) => onChange({ ...config, title: v })} />
      <div className="space-y-3">
        <span className="fo-label">Preguntas</span>
        {items.map((item, i) => (
          <div key={item.id || i} className="space-y-2 rounded-lg border border-[var(--fo-border)] p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--fo-muted)]">Pregunta {i + 1}</span>
              <ItemActions index={i} count={items.length} noun="pregunta" onMove={(to) => set(move(items, i, to))} onRemove={() => set(items.filter((_, j) => j !== i))} />
            </div>
            <input
              className="fo-input"
              aria-label={`Pregunta ${i + 1}`}
              placeholder="¿Cuánto tarda la entrega de las fotos?"
              maxLength={300}
              value={item.question}
              onChange={(e) => set(items.map((it, j) => (j === i ? { ...it, question: e.target.value } : it)))}
            />
            <textarea
              className="fo-input"
              aria-label={`Respuesta ${i + 1}`}
              placeholder="La respuesta (texto simple; los saltos de línea se respetan)."
              rows={3}
              maxLength={3000}
              value={item.answer}
              onChange={(e) => set(items.map((it, j) => (j === i ? { ...it, answer: e.target.value } : it)))}
            />
          </div>
        ))}
        {items.length < FAQ_MAX_ITEMS ? (
          <button type="button" className="text-sm underline" onClick={() => set([...items, { id: newItemId(), question: "", answer: "" }])}>
            Agregar pregunta
          </button>
        ) : (
          <Helper>Llegaste al máximo de {FAQ_MAX_ITEMS} preguntas.</Helper>
        )}
      </div>
      <Helper>Las preguntas sin escribir no aparecen en el sitio.</Helper>
    </div>
  );
}

export function CountdownInspector({ config, onChange }: { config: CountdownBlockConfig; onChange: (c: CountdownBlockConfig) => void }) {
  const valid = countdownTargetMs(config.date, config.time) !== null;
  return (
    <div className="space-y-4">
      <TextField label="Título (opcional)" value={config.title} onChange={(v) => onChange({ ...config, title: v })} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="fo-label">Fecha</span>
          <input type="date" className="fo-input" value={config.date} onChange={(e) => onChange({ ...config, date: e.target.value })} />
        </label>
        <label className="block space-y-1.5">
          <span className="fo-label">Hora</span>
          <input type="time" className="fo-input" value={config.time} onChange={(e) => onChange({ ...config, time: e.target.value })} />
        </label>
      </div>
      <Helper>Fecha y hora de Argentina: el reloj es el mismo para todos los visitantes, estén donde estén.</Helper>
      {!valid ? <Warning>Elegí una fecha: sin fecha, la sección no aparece en el sitio.</Warning> : null}
      <TextAreaField label="Texto cuando llegue la fecha" value={config.doneText} onChange={(v) => onChange({ ...config, doneText: v })} rows={2} />
    </div>
  );
}

export function BeforeAfterInspector({ config, onChange }: { config: BeforeAfterBlockConfig; onChange: (c: BeforeAfterBlockConfig) => void }) {
  const latest = useLatest(config);
  return (
    <div className="space-y-4">
      <TextField label="Título (opcional)" value={config.title} onChange={(v) => onChange({ ...config, title: v })} />
      <ImageUploadField
        name="_before_image"
        presetKey="websiteBlockImage"
        label="Foto de antes"
        initialUrl={config.beforeUrl || null}
        onUploaded={(url) => onChange({ ...latest.current, beforeUrl: url ?? "" })}
      />
      <ImageUploadField
        name="_after_image"
        presetKey="websiteBlockImage"
        label="Foto de después"
        initialUrl={config.afterUrl || null}
        onUploaded={(url) => onChange({ ...latest.current, afterUrl: url ?? "" })}
      />
      <Helper>Conviene que las dos fotos tengan el mismo encuadre y la misma proporción.</Helper>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Etiqueta de antes" value={config.beforeLabel} onChange={(v) => onChange({ ...config, beforeLabel: v })} />
        <TextField label="Etiqueta de después" value={config.afterLabel} onChange={(v) => onChange({ ...config, afterLabel: v })} />
      </div>
      <TextField label="Descripción de la foto" value={config.alt} onChange={(v) => onChange({ ...config, alt: v })} helper="Para lectores de pantalla y buscadores." />
    </div>
  );
}

export function PartnersInspector({ config, onChange }: { config: PartnersBlockConfig; onChange: (c: PartnersBlockConfig) => void }) {
  const latest = useLatest(config);
  const [uploaderKey, setUploaderKey] = useState(0);
  const items = config.items;
  const set = (next: PartnersBlockConfig["items"]) => onChange({ ...config, items: next });
  return (
    <div className="space-y-4">
      <TextField label="Título (opcional)" value={config.title} onChange={(v) => onChange({ ...config, title: v })} />
      <ToggleField label="Logos en blanco y negro (se ven en color al pasar el mouse)" checked={config.grayscale} onChange={(v) => onChange({ ...config, grayscale: v })} />
      {items.length < PARTNERS_MAX_ITEMS ? (
        <ImageUploadField
          key={uploaderKey}
          name="_partner_logo"
          presetKey="websiteBlockImage"
          label="Agregar logo"
          onUploaded={(url) => {
            if (!url) return;
            const cur = latest.current;
            onChange({ ...cur, items: [...cur.items, { id: newItemId(), imageUrl: url, name: "", url: undefined }] });
            setUploaderKey((k) => k + 1);
          }}
        />
      ) : (
        <Helper>Llegaste al máximo de {PARTNERS_MAX_ITEMS} logos.</Helper>
      )}
      {items.map((item, i) => (
        <div key={item.id || i} className="space-y-2 rounded-lg border border-[var(--fo-border)] p-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl} alt="" className="h-10 w-16 shrink-0 rounded object-contain" />
            <input
              className="fo-input min-w-0 flex-1"
              aria-label={`Nombre del colaborador ${i + 1}`}
              placeholder="Nombre"
              maxLength={120}
              value={item.name}
              onChange={(e) => set(items.map((it, j) => (j === i ? { ...it, name: e.target.value } : it)))}
            />
            <ItemActions index={i} count={items.length} noun="logo" onMove={(to) => set(move(items, i, to))} onRemove={() => set(items.filter((_, j) => j !== i))} />
          </div>
          <input
            className="fo-input"
            aria-label={`Enlace del colaborador ${i + 1}`}
            placeholder="https:// (opcional)"
            value={item.url ?? ""}
            onChange={(e) => set(items.map((it, j) => (j === i ? { ...it, url: e.target.value } : it)))}
          />
          {item.url?.trim() && !externalHttpUrl(item.url) ? <Warning>Ese enlace no es válido (tiene que empezar con https://): no se va a guardar.</Warning> : null}
        </div>
      ))}
      {items.length === 0 ? <Helper>Todavía no hay logos. La sección no aparece en el sitio hasta que subas alguno.</Helper> : null}
    </div>
  );
}

const ICON_LABELS: Record<FeatureIcon, string> = {
  camera: "Cámara",
  image: "Foto",
  video: "Video",
  heart: "Corazón",
  star: "Estrella",
  award: "Premio",
  clock: "Reloj",
  calendar: "Calendario",
  "map-pin": "Ubicación",
  phone: "Teléfono",
  mail: "Correo",
  gift: "Regalo",
  users: "Personas",
  check: "Tilde",
  sparkles: "Destellos",
  printer: "Impresora",
  shield: "Escudo",
  truck: "Envío",
};

export function FeaturesInspector({ config, onChange }: { config: FeaturesBlockConfig; onChange: (c: FeaturesBlockConfig) => void }) {
  const items = config.items;
  const set = (next: FeaturesBlockConfig["items"]) => onChange({ ...config, items: next });
  return (
    <div className="space-y-4">
      <TextField label="Título (opcional)" value={config.title} onChange={(v) => onChange({ ...config, title: v })} />
      {items.map((item, i) => (
        <div key={item.id || i} className="space-y-2 rounded-lg border border-[var(--fo-border)] p-3">
          <div className="flex items-center gap-2">
            <select
              className="fo-input min-w-0 flex-1"
              aria-label={`Ícono del ítem ${i + 1}`}
              value={item.icon}
              onChange={(e) => set(items.map((it, j) => (j === i ? { ...it, icon: e.target.value as FeatureIcon } : it)))}
            >
              {FEATURE_ICONS.map((icon) => (
                <option key={icon} value={icon}>
                  {ICON_LABELS[icon]}
                </option>
              ))}
            </select>
            <ItemActions
              index={i}
              count={items.length}
              noun="ítem"
              onMove={(to) => set(move(items, i, to))}
              onRemove={items.length > FEATURES_MIN_ITEMS ? () => set(items.filter((_, j) => j !== i)) : undefined}
            />
          </div>
          <input
            className="fo-input"
            aria-label={`Título del ítem ${i + 1}`}
            placeholder="Título"
            maxLength={120}
            value={item.title}
            onChange={(e) => set(items.map((it, j) => (j === i ? { ...it, title: e.target.value } : it)))}
          />
          <textarea
            className="fo-input"
            aria-label={`Texto del ítem ${i + 1}`}
            placeholder="Un texto corto"
            rows={2}
            maxLength={500}
            value={item.text}
            onChange={(e) => set(items.map((it, j) => (j === i ? { ...it, text: e.target.value } : it)))}
          />
        </div>
      ))}
      {items.length < FEATURES_MAX_ITEMS ? (
        <button type="button" className="text-sm underline" onClick={() => set([...items, { id: newItemId(), icon: "star", title: "", text: "" }])}>
          Agregar ítem
        </button>
      ) : null}
      <Helper>
        Entre {FEATURES_MIN_ITEMS} y {FEATURES_MAX_ITEMS} ítems. Los que queden sin título ni texto no aparecen en el sitio.
      </Helper>
    </div>
  );
}

export function MapInspector({ config, onChange }: { config: MapBlockConfig; onChange: (c: MapBlockConfig) => void }) {
  // Lo que se está tipeando en el alto: se ajusta a 250–800 recién al salir del campo, así se
  // puede borrar y escribir «600» sin que «6» salte a 250 en la primera tecla.
  const [heightDraft, setHeightDraft] = useState<string | null>(null);
  const commitHeight = () => {
    if (heightDraft === null) return;
    const n = Number(heightDraft);
    onChange({ ...config, heightPx: heightDraft.trim() && Number.isFinite(n) ? Math.min(MAP_MAX_HEIGHT_PX, Math.max(MAP_MIN_HEIGHT_PX, Math.round(n))) : MAP_DEFAULT_HEIGHT_PX });
    setHeightDraft(null);
  };
  return (
    <div className="space-y-4">
      <TextField label="Título (opcional)" value={config.title} onChange={(v) => onChange({ ...config, title: v })} />
      <TextField
        label="Dirección o coordenadas"
        value={config.query}
        onChange={(v) => onChange({ ...config, query: v })}
        helper="Ej.: «Córdoba 1234, Rosario, Santa Fe» o «-32.9468, -60.6393»."
      />
      <label className="block space-y-1.5">
        <span className="fo-label">Alto (en píxeles)</span>
        <input
          type="number"
          className="fo-input"
          min={MAP_MIN_HEIGHT_PX}
          max={MAP_MAX_HEIGHT_PX}
          step={50}
          value={heightDraft ?? String(config.heightPx)}
          onChange={(e) => setHeightDraft(e.target.value)}
          onBlur={commitHeight}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitHeight();
          }}
        />
      </label>
      <ToggleField label="Mostrar el botón «Cómo llegar»" checked={config.showDirections} onChange={(v) => onChange({ ...config, showDirections: v })} />
    </div>
  );
}

export function WhatsappButtonInspector({ config, onChange }: { config: WhatsappButtonBlockConfig; onChange: (c: WhatsappButtonBlockConfig) => void }) {
  return (
    <div className="space-y-4">
      <TextField label="Título (opcional)" value={config.title} onChange={(v) => onChange({ ...config, title: v })} />
      <TextAreaField label="Texto (opcional)" value={config.text} onChange={(v) => onChange({ ...config, text: v })} rows={2} />
      <TextField label="Número de WhatsApp" value={config.phone} onChange={(v) => onChange({ ...config, phone: v })} helper="Con o sin código de país: «341 341-9869»." />
      {config.phone.trim() && !whatsappHref(config.phone) ? <Warning>Ese número no parece válido: el botón no se va a mostrar.</Warning> : null}
      <TextField label="Texto del botón" value={config.buttonLabel} onChange={(v) => onChange({ ...config, buttonLabel: v })} />
      <TextField label="Mensaje inicial del chat (opcional)" value={config.message} onChange={(v) => onChange({ ...config, message: v })} helper="Lo que ya aparece escrito cuando se abre el chat." />
      <SelectField
        label="Estilo"
        value={config.style}
        onChange={(v) => onChange({ ...config, style: v as WhatsappButtonBlockConfig["style"] })}
        options={[
          { value: "solid", label: "Verde lleno" },
          { value: "outline", label: "Contorno verde" },
        ]}
      />
    </div>
  );
}

export function PaymentButtonInspector({ config, onChange }: { config: PaymentButtonBlockConfig; onChange: (c: PaymentButtonBlockConfig) => void }) {
  return (
    <div className="space-y-4">
      <TextField label="Título" value={config.title} onChange={(v) => onChange({ ...config, title: v })} />
      <label className="block space-y-1.5">
        <span className="fo-label">Monto que se muestra (opcional)</span>
        <InputMoneda
          value={config.amount}
          decimales={false}
          envio="punto"
          aria-label="Monto en pesos"
          onChange={(v) => {
            const n = Math.round(Number(v));
            onChange({ ...config, amount: v === "" || !Number.isFinite(n) || n < 0 ? null : Math.min(n, PAYMENT_MAX_AMOUNT) });
          }}
        />
      </label>
      <TextAreaField label="Descripción (opcional)" value={config.description} onChange={(v) => onChange({ ...config, description: v })} rows={3} />
      <TextField label="Texto del botón" value={config.buttonLabel} onChange={(v) => onChange({ ...config, buttonLabel: v })} />
      <TextField
        label="Enlace de cobro"
        value={config.url}
        onChange={(v) => onChange({ ...config, url: v })}
        helper="Pegá el enlace de pago de Mercado Pago, del Cobrador o de otro medio (empieza con https://)."
      />
      {config.url.trim() && !externalHttpsUrl(config.url) ? <Warning>Ese enlace no es válido (tiene que empezar con https://): no se va a guardar.</Warning> : null}
      <Helper>El monto es sólo informativo: lo que se cobra es lo que diga la página del enlace.</Helper>
    </div>
  );
}
