"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../primitives/cn";

/**
 * Controles de la interfaz del editor.
 *
 * Separados del `Button` general del paquete a propósito. Aquel es un botón de sitio: pastilla,
 * semibold, sombra que crece al pasar por encima y un rebote de escala al pulsarlo. Está bien
 * para una llamada a la acción; puesto en una barra de herramientas produce lo que el editor
 * mostraba — una hilera de píldoras flotando, cada una pidiendo atención, sin decir cuáles
 * hacen cosas parecidas.
 *
 * Una herramienta necesita lo contrario: controles que no se noten, agrupados por lo que hacen,
 * y una sola cosa resaltada — lo que está seleccionado.
 */

type ToolButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Qué hace. Va al `title` y al `aria-label`: un ícono solo no se lee. */
  label: string;
  /** La tecla que hace lo mismo, si existe. Se muestra en la ayuda emergente. */
  shortcut?: string;
  /** El control está activo: herramienta elegida, panel abierto. */
  active?: boolean;
  children: ReactNode;
};

export function ToolButton({
  label,
  shortcut,
  active = false,
  className,
  children,
  ...props
}: ToolButtonProps) {
  return (
    <button
      type="button"
      title={shortcut ? `${label}  ·  ${shortcut}` : label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={cn(
        "grid shrink-0 place-items-center border-0 bg-transparent transition-colors",
        "h-[var(--te-control)] w-[var(--te-control)]",
        "text-[color:var(--te-ink-muted)]",
        "hover:enabled:bg-[color:var(--te-chrome-sunken)] hover:enabled:text-[color:var(--te-ink)]",
        "disabled:cursor-default disabled:opacity-40",
        "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--te-accent)]",
        active && "bg-[color:var(--te-accent-wash)] text-[color:var(--te-accent)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Agrupa controles que pertenecen al mismo asunto: deshacer con rehacer, ver con previsualizar.
 *
 * El agrupamiento es la información. Diez controles sueltos son diez decisiones; tres grupos de
 * tres son tres. La separación entre grupos hace ese trabajo sin una sola palabra.
 */
export function ToolGroup({
  children,
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex shrink-0 items-center overflow-hidden",
        "rounded-[var(--te-radius)] border border-[color:var(--te-line)] bg-[color:var(--te-surface)]",
        "[&>button]:border-0 [&>button]:border-r [&>button]:border-solid [&>button]:border-[color:var(--te-line)]",
        "[&>button:last-child]:border-r-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Separador entre zonas de la barra. Una línea, no un espacio: el espacio se lee como descuido. */
export function ToolDivider() {
  return (
    <span
      aria-hidden
      className="mx-1 h-5 w-px shrink-0 bg-[color:var(--te-line-strong)]"
    />
  );
}

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "primary" | "danger";
  children: ReactNode;
};

/** Botón con texto. Para lo que se nombra: Guardar, Cancelar, Salir sin guardar. */
export function ActionButton({
  tone = "default",
  className,
  children,
  ...props
}: ActionButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-[var(--te-control)] shrink-0 items-center gap-1.5 whitespace-nowrap px-3",
        "rounded-[var(--te-radius)] border text-[12.5px] font-medium transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--te-accent)]",
        "disabled:cursor-default disabled:opacity-45",
        tone === "primary"
          ? "border-[color:var(--te-accent)] bg-[color:var(--te-accent)] text-[color:var(--te-accent-ink)] hover:enabled:brightness-110"
          : tone === "danger"
            ? "border-[color:var(--te-danger)] bg-[color:var(--te-danger)] text-white hover:enabled:brightness-110"
            : "border-[color:var(--te-line)] bg-[color:var(--te-surface)] text-[color:var(--te-ink)] hover:enabled:bg-[color:var(--te-chrome-sunken)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Encabezado de panel. Minúsculas espaciadas y pequeñas: tiene que ordenar sin pesar más que
 * el contenido que rotula.
 */
export function PanelHeader({
  title,
  meta,
  children,
}: {
  title: string;
  /** Dato al margen: el tipo del bloque elegido, cuántas capas hay. */
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-[color:var(--te-line)] px-3">
      <h3 className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--te-ink-faint)]">
        {title}
      </h3>
      {meta ? (
        <span className="shrink-0 text-[10px] tabular-nums text-[color:var(--te-ink-faint)]">
          {meta}
        </span>
      ) : null}
      {children}
    </div>
  );
}
