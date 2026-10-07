import Link from "next/link";

export type AvisosVista = {
  fechaSuperpuesta?: { leadId: string; display: string }[];
  duplicados?: { id: string; nombre: string }[];
  /** Hay otro contacto con el mismo correo o teléfono, pero quien mira no ve Clientes (R10). */
  posibleDuplicado?: boolean;
};

/**
 * Carteles de la consulta (spec §3.1 y §5): otra consulta abierta con el evento el mismo día y
 * otros contactos con el mismo correo o teléfono. Sólo avisan: no bloquean nada. Todavía no hay
 * pantalla para fusionar contactos (R5): el cartel lleva a la ficha del otro contacto.
 */
export function AvisosConsulta({ avisos }: { avisos: AvisosVista }) {
  const superpuestas = avisos.fechaSuperpuesta ?? [];
  const duplicados = avisos.duplicados ?? [];
  const soloAviso = duplicados.length === 0 && avisos.posibleDuplicado === true;
  if (superpuestas.length === 0 && duplicados.length === 0 && !soloAviso) return null;
  return (
    <div className="space-y-2">
      {superpuestas.length > 0 ? (
        <div role="status" className="rounded-lg border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-3 text-sm">
          <p className="font-medium text-[var(--fo-text)]">Fecha superpuesta</p>
          <p className="text-[var(--fo-muted)]">Hay otra consulta abierta con el evento el mismo día:</p>
          <ul className="mt-1 space-y-0.5">
            {superpuestas.map((s) => (
              <li key={s.leadId}>
                <Link href={`/consultas/${s.leadId}`} className="text-[var(--fo-accent)] hover:underline">
                  {s.display}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {duplicados.length > 0 ? (
        <div role="status" className="rounded-lg border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-3 text-sm">
          <p className="font-medium text-[var(--fo-text)]">Posible duplicado</p>
          <p className="text-[var(--fo-muted)]">Otro contacto tiene el mismo correo o teléfono:</p>
          <ul className="mt-1 space-y-0.5">
            {duplicados.map((d) => (
              <li key={d.id}>
                <Link href={`/clientes/${d.id}`} className="text-[var(--fo-accent)] hover:underline">
                  {d.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {soloAviso ? (
        <div role="status" className="rounded-lg border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-3 text-sm">
          <p className="font-medium text-[var(--fo-text)]">Posible duplicado</p>
          <p className="text-[var(--fo-muted)]">Otro contacto tiene el mismo correo o teléfono. Quien gestiona Clientes lo puede revisar.</p>
        </div>
      ) : null}
    </div>
  );
}
