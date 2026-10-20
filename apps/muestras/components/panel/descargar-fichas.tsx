const enlace = "underline underline-offset-[6px]";
const url = (id: string, tamano: "A6" | "A5", obra?: string) =>
  `/api/fichas/${encodeURIComponent(id)}?tamano=${tamano}${obra ? `&obra=${encodeURIComponent(obra)}` : ""}`;

/** Enlaces de descarga del PDF de fichas: todas juntas o una por obra, en A6 o A5. */
export function DescargarFichas({ id, obras }: { id: string; obras: { id: string; title: string }[] }) {
  if (obras.length === 0) return <p className="text-[15px] text-[var(--mf-muted)]">Esta muestra no tiene obras cargadas.</p>;
  return (
    <div className="space-y-2 text-[15px]">
      <p>
        Todas las fichas ({obras.length}): <a href={url(id, "A6")} className={enlace}>A6</a> · <a href={url(id, "A5")} className={enlace}>A5</a>
      </p>
      <details>
        <summary className="cursor-pointer text-[var(--mf-muted)]">Una por obra</summary>
        <ul className="mt-2 space-y-1">
          {obras.map((o) => (
            <li key={o.id}>
              {o.title}: <a href={url(id, "A6", o.id)} className={enlace}>A6</a> · <a href={url(id, "A5", o.id)} className={enlace}>A5</a>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
