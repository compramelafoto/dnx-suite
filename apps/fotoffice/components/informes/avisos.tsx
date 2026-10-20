/** Avisos de un informe (período corregido, demasiados datos…). */
export function AvisosInforme({ avisos }: { avisos: readonly string[] }) {
  if (avisos.length === 0) return null;
  return (
    <div className="space-y-2" role="status">
      {avisos.map((a) => (
        <p key={a} className="fo-card text-sm text-[var(--fo-muted)]">
          {a}
        </p>
      ))}
    </div>
  );
}

/** Estado vacío en palabras, en vez de una tabla de ceros. */
export function SinDatos({ children }: { children: React.ReactNode }) {
  return <p className="fo-card text-sm text-[var(--fo-muted)]">{children}</p>;
}
