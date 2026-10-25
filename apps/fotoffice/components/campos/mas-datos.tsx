import "server-only";
import Link from "next/link";
import { cargarMasDatos } from "@/lib/campos/ficha";
import type { CampoVista } from "@/lib/campos/vista";
import { EditorMasDatos } from "./editor-mas-datos";

/**
 * Tarjeta "Más datos" de la ficha (Cliente, Socio o Consulta). Componente de servidor:
 * `cargarMasDatos` hace la guarda (sesión, workspace, `operar`, módulo y registro del
 * workspace) ANTES de leer valores. Sin campos activos no se ve nada, salvo un enlace
 * discreto a Configuración → Campos para quien puede configurar.
 */
export async function MasDatos({ entityType, entityId }: { entityType: "CLIENTE" | "SOCIO" | "CONSULTA" | "PROYECTO"; entityId: string }) {
  const vista = await cargarMasDatos(entityType, entityId);
  if (!vista) return null;

  if (vista.campos.length === 0) {
    if (!vista.puedeConfigurar) return null;
    return (
      <p className="px-1 text-xs text-[var(--fo-muted)]">
        ¿Te faltan datos en esta ficha?{" "}
        <Link href="/workspace/configuracion/campos" className="text-[var(--fo-accent)] hover:underline">
          Sumá campos en Configuración → Campos
        </Link>
        .
      </p>
    );
  }

  return (
    <section className="fo-card space-y-3 p-4" aria-labelledby={`mas-datos-${entityId}`}>
      <h2 id={`mas-datos-${entityId}`} className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
        Más datos
      </h2>
      <EditorMasDatos entityType={entityType} entityId={entityId} campos={vista.campos} puedeEditar={vista.puedeEditar}>
        <dl className="space-y-2 text-sm">
          {vista.campos.map((c) => (
            <Fila key={c.id} campo={c} />
          ))}
        </dl>
      </EditorMasDatos>
    </section>
  );
}

function Fila({ campo }: { campo: CampoVista }) {
  const faltaObligatorio = campo.obligatorio && campo.legible === "";
  return (
    <div className="flex justify-between gap-4">
      <dt className={faltaObligatorio ? "text-[var(--fo-danger)]" : "text-[var(--fo-muted)]"}>
        {campo.nombre}
        {campo.obligatorio ? <span className="text-[var(--fo-danger)]"> *</span> : null}
      </dt>
      <dd className="min-w-0 whitespace-pre-line break-words text-right text-[var(--fo-text)]">
        {faltaObligatorio ? (
          <span className="text-[var(--fo-danger)]">Falta completar</span>
        ) : campo.legible === "" ? (
          "—"
        ) : campo.href ? (
          <a href={campo.href} target="_blank" rel="noopener noreferrer" className="text-[var(--fo-accent)] hover:underline">
            {campo.legible}
          </a>
        ) : (
          campo.legible
        )}
      </dd>
    </div>
  );
}
