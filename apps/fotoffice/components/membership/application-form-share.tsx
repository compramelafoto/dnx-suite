"use client";

import { useEffect, useState } from "react";

/**
 * Compartir el formulario público de asociación.
 *
 * La institución ya tiene su sitio, sus redes y su WhatsApp: el formulario sirve en la medida
 * en que se pueda pegar donde la gente ya está. Se ofrecen las tres formas que cubren eso —el
 * enlace suelto, un botón para el sitio, y el formulario incrustado— porque quien administra
 * no necesariamente sabe cuál le sirve hasta que las ve.
 */
export function ApplicationFormShare({ publicUrl }: { publicUrl: string }) {
  const botonHtml = `<a href="${publicUrl}" target="_blank" rel="noopener"
   style="display:inline-block;padding:12px 24px;background:#111;color:#fff;
          border-radius:8px;text-decoration:none;font-family:sans-serif;font-weight:600">
  Asociarme
</a>`;
  const iframeHtml = `<iframe src="${publicUrl}" width="100%" height="900" style="border:0"
        title="Formulario de asociación"></iframe>`;

  return (
    <section className="fo-card space-y-5 p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
          Compartir el formulario
        </h2>
        <p className="text-xs text-[var(--fo-muted)]">
          Cualquiera con el enlace puede solicitar el ingreso. La solicitud cae acá para que la
          resuelvas: nadie se asocia solo.
        </p>
      </div>

      <Bloque
        titulo="El enlace"
        ayuda="Para mandar por WhatsApp, mail o poner en la bio de Instagram."
        valor={publicUrl}
        filas={1}
      />
      <Bloque
        titulo="Un botón para el sitio"
        ayuda="Pegá este HTML donde quieras que aparezca el botón. Abre el formulario en una pestaña nueva."
        valor={botonHtml}
        filas={5}
      />
      <Bloque
        titulo="El formulario incrustado"
        ayuda="Muestra el formulario dentro de tu propia página, sin que la persona salga del sitio."
        valor={iframeHtml}
        filas={3}
      />
    </section>
  );
}

function Bloque({
  titulo,
  ayuda,
  valor,
  filas,
}: {
  titulo: string;
  ayuda: string;
  valor: string;
  filas: number;
}) {
  const [copiado, setCopiado] = useState(false);

  // El "Copiado" vuelve solo: obliga a leerlo pero no a descartarlo.
  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
    } catch {
      // Sin portapapeles —navegador viejo, permiso denegado— el texto sigue visible y
      // seleccionable. No se avisa un error: no hay nada que la persona pueda arreglar.
    }
  }

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-xs text-[var(--fo-muted)]">{ayuda}</p>
      </div>
      <textarea
        rows={filas}
        readOnly
        value={valor}
        onFocus={(e) => e.currentTarget.select()}
        className="fo-input w-full resize-none font-mono text-xs"
      />
      <button type="button" onClick={copiar} className="fo-btn fo-btn-secondary text-xs">
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
