import { renderEmailSignature, type EmailSignatureData } from "@repo/communications/signature";

/**
 * Vista previa de la firma institucional del workspace.
 *
 * El HTML se muestra dentro de un `<iframe sandbox="">` SIN `allow-scripts`, `allow-forms`,
 * `allow-same-origin` ni `allow-top-navigation`. El renderer ya escapa todo, pero el
 * aislamiento es la segunda barrera: si alguna vez se filtrara algo, no puede tocar la
 * aplicación, leer cookies ni navegar la ventana.
 *
 * Por eso NO se usa `dangerouslySetInnerHTML`: el contenido va al `srcDoc` del iframe.
 *
 * Este preview NO sustituye las pruebas del HTML final. Que se vea bien acá no dice nada
 * sobre Outlook, que renderiza con el motor de Word.
 */

function Frame({ title, html }: { title: string; html: string }) {
  return (
    <iframe
      title={title}
      sandbox=""
      srcDoc={`<!doctype html><html><body style="margin:0;padding:12px;background:#ffffff;">${html}</body></html>`}
      className="w-full rounded-lg border border-[var(--fo-border)] bg-white"
      style={{ height: 190 }}
    />
  );
}

function Block({
  label,
  data,
  note,
}: {
  label: string;
  data: EmailSignatureData;
  note?: string;
}) {
  const { html } = renderEmailSignature(data);
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
        {label}
      </p>
      {note ? <p className="text-xs text-[var(--fo-muted)]">{note}</p> : null}
      <Frame title={label} html={html} />
    </div>
  );
}

export function EmailSignaturePreview({ data }: { data: EmailSignatureData }) {
  const { text } = renderEmailSignature(data);

  // Variantes: así el administrador ve cómo queda cuando el cliente bloquea imágenes
  // (el comportamiento por defecto de muchos) y cuando todavía no cargó la nota.
  const withoutLogo: EmailSignatureData = { ...data, organizationLogoUrl: undefined };
  const withoutNote: EmailSignatureData = { ...data, institutionalNote: undefined };

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Vista previa de la firma</h3>
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          Esta es la firma institucional. Más adelante podrás seleccionar un firmante personal.
        </p>
      </div>

      <Block label="Como se ve en el email" data={data} />

      <Block
        label="Sin logo"
        data={withoutLogo}
        note="Muchos clientes de correo bloquean las imágenes por defecto: así se ve tu firma en ese caso."
      />

      <Block
        label="Sin nota institucional"
        data={withoutNote}
        note="Cómo queda si dejás la nota vacía."
      />

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
          Versión en texto plano
        </p>
        <p className="text-xs text-[var(--fo-muted)]">
          La reciben quienes leen el correo sin formato.
        </p>
        <pre className="w-full overflow-x-auto rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] p-3 text-xs leading-relaxed whitespace-pre-wrap">
          {text}
        </pre>
      </div>
    </section>
  );
}
