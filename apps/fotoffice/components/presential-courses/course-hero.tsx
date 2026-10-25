/**
 * El encabezado de la página de venta cuando el curso tiene portada.
 *
 * La foto ocupa todo el ancho y el título va encima, sobre un degradé oscuro que lo hace
 * legible con cualquier imagen. Abajo, lo que alguien necesita para decidir —cuántas clases,
 * cuántas horas, por cuánto tiempo, cuánto cuesta— y el botón que lleva al formulario.
 * Sin portada, la página sigue con el encabezado de texto de siempre.
 */
export function CourseHero({
  etiqueta,
  titulo,
  bajada,
  instructor,
  nivel,
  portadaUrl,
  datos,
  precio,
  comprarHref,
}: {
  etiqueta: string;
  titulo: string;
  bajada: string | null;
  instructor: string | null;
  nivel: string | null;
  portadaUrl: string;
  /** Pares cortos, por ejemplo { valor: "7", detalle: "clases" }. */
  datos: { valor: string; detalle: string }[];
  /** Precio ya formateado, o null si no se muestra. */
  precio: string | null;
  /** A dónde lleva "Comprar el curso"; null si todavía no se puede comprar. */
  comprarHref: string | null;
}) {
  return (
    <div className="space-y-6">
      <header className="relative isolate overflow-hidden rounded-[var(--fo-radius)] bg-black text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={portadaUrl}
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover object-center"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-black/5"
        />
        <div className="flex min-h-[480px] flex-col justify-end gap-4 p-6 md:min-h-[560px] md:p-10">
          <p className="text-sm font-medium text-white/75">{etiqueta}</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            {titulo}
          </h1>
          {bajada ? (
            <p className="max-w-2xl text-base leading-relaxed text-white/85 md:text-lg">{bajada}</p>
          ) : null}
          {instructor || nivel ? (
            <p className="max-w-2xl text-sm text-white/70">
              {instructor ? `Con ${instructor}.` : ""}
              {nivel ? ` ${nivel}.` : ""}
            </p>
          ) : null}
        </div>
      </header>

      {datos.length > 0 || precio ? (
        <div className="flex flex-col gap-5 border-b border-[var(--fo-border)] pb-6 md:flex-row md:items-end md:justify-between">
          {datos.length > 0 ? (
            <dl className="flex flex-wrap gap-x-10 gap-y-3">
              {datos.map((d) => (
                <div key={d.detalle}>
                  <dt className="sr-only">{d.detalle}</dt>
                  <dd className="text-2xl font-semibold tracking-tight">{d.valor}</dd>
                  <dd className="text-sm text-[var(--fo-muted)]">{d.detalle}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {precio ? (
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-3xl font-semibold tracking-tight">{precio}</p>
              {comprarHref ? (
                <a href={comprarHref} className="fo-btn fo-btn-primary">
                  Comprar el curso
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
