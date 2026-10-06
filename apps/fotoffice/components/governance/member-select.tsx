import type { MemberOption } from "@/lib/governance/repository";
import { CircleAlert, CircleCheck } from "lucide-react";

/**
 * Elegir a una persona: primero la comisión (con su cargo), después el resto del padrón activo.
 * Si el valor actual es alguien que ya no está activo, se agrega para no perderlo al guardar.
 */
export function MemberSelect({
  id,
  name,
  options,
  defaultValue,
  current,
  emptyLabel = "Sin asignar",
}: {
  id: string;
  name: string;
  options: { commission: MemberOption[]; others: MemberOption[] };
  defaultValue?: string | null;
  /** Quien figura hoy, por si no aparece entre los activos. */
  current?: MemberOption | null;
  emptyLabel?: string;
}) {
  const todos = [...options.commission, ...options.others];
  const falta = current && !todos.some((o) => o.id === current.id) ? current : null;
  return (
    <select id={id} name={name} className="fo-input" defaultValue={defaultValue ?? ""}>
      <option value="">{emptyLabel}</option>
      {falta ? <option value={falta.id}>{falta.label} (inactivo)</option> : null}
      {options.commission.length > 0 ? (
        <optgroup label="Comisión directiva">
          {options.commission.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ) : null}
      <optgroup label="Socios">
        {options.others.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

/** Avisos de las acciones (`?ok=` / `?error=`), con el mismo estilo en todo el módulo. */
const AVISOS: Record<string, string> = {
  guardado: "Cambios guardados.",
  "sin-cambios": "No había nada distinto para guardar.",
  estado: "Estado actualizado.",
  nota: "Nota agregada al historial.",
  tarea: "Tarea actualizada.",
  tipo: "Tipo de proyecto guardado.",
  archivado: "Tipo archivado: ya no se ofrece para proyectos nuevos.",
  restaurado: "Tipo restaurado.",
  realizada: "La reunión figura como realizada. Cuando todo esté tratado, aprobá el acta.",
  acta: "Acta aprobada: ya no se modifica; lo posterior va como nota.",
  asistentes: "Asistentes guardados.",
  voto: "Tu voto quedó registrado. Lo podés cambiar mientras la votación esté abierta.",
  propuesta: "Tu propuesta llegó a la comisión.",
};

export function Flash({ error, ok }: { error?: string; ok?: string }) {
  if (error) {
    return (
      <p className="fo-alert-error flex items-center gap-2 px-4 py-2.5 text-sm" role="alert">
        <CircleAlert className="size-4 shrink-0" aria-hidden />
        {error}
      </p>
    );
  }
  if (ok) {
    return (
      <p className="fo-alert-success flex items-center gap-2 px-4 py-2.5 text-sm" role="status">
        <CircleCheck className="size-4 shrink-0" aria-hidden />
        {AVISOS[ok] ?? "Listo."}
      </p>
    );
  }
  return null;
}
