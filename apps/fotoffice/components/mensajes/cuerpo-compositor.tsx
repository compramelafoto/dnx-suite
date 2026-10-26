import type { ReactNode } from "react";
import { MAX_ASUNTO, MAX_CUERPO, type Canal } from "@/lib/plantillas/constantes";

/**
 * El formulario del compositor de mensajes, sin estado propio: título y «Para», lo que cada uso pone
 * antes del texto (plantilla, canal), asunto (sólo correo), mensaje con su contador, el freno de los
 * textos en MAYÚSCULAS por completar, el error, el enlace a WhatsApp si el navegador bloqueó la
 * pestaña, y los botones. Lo usan «Mensaje» (`PanelMensaje`) y «Pedir testimonio».
 */
export type IdsCompositor = { titulo: string; asunto: string; cuerpo: string };

export function idsCompositor(prefijo: string, id: string): IdsCompositor {
  return { titulo: `${prefijo}-titulo-${id}`, asunto: `${prefijo}-asunto-${id}`, cuerpo: `${prefijo}-cuerpo-${id}` };
}

export function CuerpoCompositor({
  ids,
  titulo,
  descripcion,
  destino,
  antesDelTexto,
  canal,
  asunto,
  onAsunto,
  cuerpo,
  onCuerpo,
  textoBloqueado = false,
  ayuda,
  pendientes,
  error,
  enlace,
  enviando,
  ocupado,
  onEnviar,
  onCancelar,
}: {
  ids: IdsCompositor;
  titulo: string;
  descripcion?: ReactNode;
  destino: string | null | undefined;
  antesDelTexto?: ReactNode;
  canal: Canal;
  asunto: string;
  onAsunto: (v: string) => void;
  cuerpo: string;
  onCuerpo: (v: string) => void;
  /** Mientras se completa una plantilla, el texto no se edita. */
  textoBloqueado?: boolean;
  /** Ayuda bajo el mensaje (va antes del contador). */
  ayuda: ReactNode;
  /** Quedan `[TEXTO EN MAYÚSCULAS]` por completar: se avisa y no se deja enviar. */
  pendientes: boolean;
  error: string | null;
  enlace: string | null;
  enviando: boolean;
  ocupado: boolean;
  onEnviar: () => void;
  onCancelar: () => void;
}) {
  return (
    <form
      className="space-y-4 p-6"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (ocupado) return;
        onEnviar();
      }}
    >
      <div className="space-y-1">
        <h2 id={ids.titulo} className="text-lg font-semibold text-[var(--fo-text)]">
          {titulo}
        </h2>
        {descripcion}
        <p className="break-all text-sm text-[var(--fo-muted)]">Para: {destino}</p>
      </div>

      {antesDelTexto}

      {canal === "EMAIL" ? (
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={ids.asunto}>
            Asunto
          </label>
          <input
            id={ids.asunto}
            className="fo-input"
            value={asunto}
            maxLength={MAX_ASUNTO}
            required
            disabled={textoBloqueado}
            onChange={(ev) => onAsunto(ev.target.value)}
          />
        </div>
      ) : null}

      <div className="fo-field-stack">
        <label className="fo-label" htmlFor={ids.cuerpo}>
          Mensaje
        </label>
        <textarea
          id={ids.cuerpo}
          className="fo-input min-h-56 font-[inherit]"
          value={cuerpo}
          maxLength={MAX_CUERPO[canal]}
          required
          disabled={textoBloqueado}
          onChange={(ev) => onCuerpo(ev.target.value)}
        />
        <p className="text-xs text-[var(--fo-muted)]">
          {ayuda} {cuerpo.length.toLocaleString("es-AR")} / {MAX_CUERPO[canal].toLocaleString("es-AR")}
        </p>
      </div>

      {pendientes ? (
        <p className="rounded-md border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-3 text-sm text-[var(--fo-warning)]">
          Hay textos entre corchetes en MAYÚSCULAS para completar a mano (por ejemplo, un enlace). Reemplazalos antes de
          {canal === "EMAIL" ? " enviar" : " abrir WhatsApp"}.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {enlace ? (
        <p className="text-sm text-[var(--fo-text)]" role="status">
          El navegador no dejó abrir otra pestaña. Quedó registrado;{" "}
          <a href={enlace} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--fo-accent)] hover:underline">
            abrí WhatsApp desde acá
          </a>
          .
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={onCancelar} disabled={enviando}>
          {enlace ? "Cerrar" : "Cancelar"}
        </button>
        {enlace ? null : (
          <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={ocupado || !cuerpo.trim() || pendientes}>
            {canal === "EMAIL" ? (enviando ? "Enviando…" : "Enviar") : enviando ? "Abriendo…" : "Abrir WhatsApp"}
          </button>
        )}
      </div>
    </form>
  );
}
