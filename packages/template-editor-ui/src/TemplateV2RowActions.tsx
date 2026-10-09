"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, PenLine, Pencil, Trash2 } from "lucide-react";

type ApiResponse = { ok?: boolean; error?: string; code?: string };

function mensajeDeError(code: string | undefined, fallback: string): string {
  if (code === "TEMPLATE_PUBLISHED_LOCKED") {
    return "La plantilla está publicada en el catálogo y no se puede cambiar.";
  }
  if (code === "TEMPLATE_FORBIDDEN" || code === "TEMPLATE_NOT_FOUND") {
    return "No tenés permiso sobre esta plantilla.";
  }
  return fallback;
}

/*
 * Estilos en línea a propósito: no todas las apps que usan este paquete recorren sus fuentes con
 * Tailwind (ComprameLaFoto no tiene `@source` hacia acá), y sin eso los botones saldrían sin forma.
 * Los colores salen de `currentColor`, así que toman el texto de la tabla en tema claro u oscuro.
 */
const fila: CSSProperties = { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" };
const boton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  height: 28,
  minWidth: 28,
  padding: "0 6px",
  borderRadius: 6,
  border: "1px solid color-mix(in srgb, currentColor 22%, transparent)",
  background: "transparent",
  color: "inherit",
  fontSize: 12,
  lineHeight: 1,
  cursor: "pointer",
  textDecoration: "none",
};
const icono = { width: 14, height: 14 } as const;

function BotonIcono({
  etiqueta,
  onClick,
  disabled,
  peligro,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  disabled?: boolean;
  peligro?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={etiqueta}
      aria-label={etiqueta}
      onClick={onClick}
      disabled={disabled}
      className="hover:opacity-70"
      style={{
        ...boton,
        ...(peligro ? { color: "#dc2626" } : null),
        ...(disabled ? { opacity: 0.45, cursor: "default" } : null),
      }}
    >
      {children}
    </button>
  );
}

/**
 * Los botoncitos de cada fila del listado de plantillas: editar el diseño, cambiar el nombre,
 * duplicar y eliminar. Usan las rutas `/api/template-v2/templates/…` que ya tiene cada app, así
 * que el permiso lo decide el servidor de esa app y no este componente.
 *
 * Eliminar **archiva** (`status: ARCHIVED`): la plantilla sale de la lista pero la fila queda.
 * Hay cosas que la nombran por id sin clave foránea —las placas asignadas en Clickatón, los
 * diplomas emitidos en FotoRank, las tarjetas de bienvenida—; un borrado físico las dejaría
 * apuntando a la nada. Archivada, lo ya emitido sigue funcionando.
 */
export function TemplateV2RowActions({
  templateId,
  name,
  editorHref,
  deleteWarning,
  showRename = true,
}: {
  templateId: string;
  name: string;
  /** Ruta del editor para la versión vigente; `null` si la plantilla no tiene versión. */
  editorHref: string | null;
  /** Aviso extra al confirmar el borrado (por ejemplo, qué vuelve al diseño de fábrica). */
  deleteWarning?: string;
  /** `false` donde la lista ya edita el nombre en el lugar (ComprameLaFoto). */
  showRename?: boolean;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function llamar(
    url: string,
    init: RequestInit,
    fallback: string,
  ): Promise<boolean> {
    setOcupado(true);
    setError(null);
    try {
      const res = await fetch(url, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || !data.ok) {
        setError(mensajeDeError(data.code, data.error || fallback));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("No se pudo conectar. Revisá tu conexión.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const base = `/api/template-v2/templates/${encodeURIComponent(templateId)}`;

  function renombrar() {
    const nuevo = window.prompt("Nombre de la plantilla", name);
    if (nuevo == null) return;
    const limpio = nuevo.trim();
    if (!limpio) {
      setError("El nombre no puede quedar vacío.");
      return;
    }
    if (limpio === name) return;
    void llamar(
      base,
      { method: "PATCH", body: JSON.stringify({ name: limpio }) },
      "No se pudo cambiar el nombre.",
    );
  }

  function duplicar() {
    void llamar(
      `${base}/duplicate`,
      { method: "POST", body: JSON.stringify({ name: `${name} (copia)` }) },
      "No se pudo duplicar la plantilla.",
    );
  }

  function eliminar() {
    const aviso = deleteWarning ? `\n\n${deleteWarning}` : "";
    if (!window.confirm(`¿Eliminar la plantilla «${name}»?${aviso}`)) return;
    void llamar(
      base,
      { method: "PATCH", body: JSON.stringify({ status: "ARCHIVED" }) },
      "No se pudo eliminar la plantilla.",
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
      <div style={fila} data-testid="template-v2-row-actions">
        {editorHref ? (
          <Link
            href={editorHref}
            title="Editar el diseño"
            className="hover:opacity-70"
            style={boton}
          >
            <PenLine style={icono} aria-hidden />
            Editar
          </Link>
        ) : (
          <span style={{ fontSize: 12, opacity: 0.6 }}>Sin versión</span>
        )}
        {showRename ? (
          <BotonIcono etiqueta="Cambiar nombre" onClick={renombrar} disabled={ocupado}>
            <Pencil style={icono} aria-hidden />
          </BotonIcono>
        ) : null}
        <BotonIcono
          etiqueta="Hacer una copia"
          onClick={duplicar}
          disabled={ocupado || !editorHref}
        >
          <Copy style={icono} aria-hidden />
        </BotonIcono>
        <BotonIcono etiqueta="Eliminar" onClick={eliminar} disabled={ocupado} peligro>
          <Trash2 style={icono} aria-hidden />
        </BotonIcono>
      </div>
      {error ? (
        <p role="alert" style={{ margin: 0, maxWidth: 260, fontSize: 11, color: "#dc2626" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
