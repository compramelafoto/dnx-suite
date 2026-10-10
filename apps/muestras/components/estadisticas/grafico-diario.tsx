import { barChart, formatArDay, dayStartAr } from "@repo/muestras";

const ANCHO = 600;
const ALTO = 120;

/** Barras por día en SVG, con la tabla de números a mano (accesible y sin bibliotecas). */
export function GraficoDiario({ titulo, serie }: { titulo: string; serie: { day: string; count: number }[] }) {
  if (serie.length === 0) return null;
  const { max, bars } = barChart(serie, { width: ANCHO, height: ALTO, gap: 2 });
  const total = serie.reduce((s, x) => s + x.count, 0);
  const dia = (d: string) => formatArDay(dayStartAr(d));
  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap justify-between gap-x-4 text-sm"><span>{titulo}</span><span className="text-[var(--mf-muted)]">{total} en {serie.length} días · máximo {max} en un día</span></figcaption>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={`${titulo}: ${total} en total`} className="h-auto w-full border-b border-[var(--mf-line)]">
        {bars.map((b) => (
          <rect key={b.day} x={b.x} y={b.y} width={b.width} height={b.height} fill="var(--mf-teal)">
            <title>{`${dia(b.day)}: ${b.count}`}</title>
          </rect>
        ))}
      </svg>
      <div className="flex justify-between text-xs text-[var(--mf-muted)]"><span>{dia(serie[0]!.day)}</span><span>{dia(serie.at(-1)!.day)}</span></div>
      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--mf-muted)]">Ver los números</summary>
        <table className="mt-2 w-full text-left">
          <tbody>{serie.filter((x) => x.count > 0).map((x) => <tr key={x.day} className="border-b border-[var(--mf-line)]"><td className="py-1">{dia(x.day)}</td><td className="py-1 text-right">{x.count}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
