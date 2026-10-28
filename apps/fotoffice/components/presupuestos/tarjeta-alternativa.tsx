import { pesos } from "@/lib/presupuestos/editor";
import { pesosCuota, type OpcionPublica } from "@/lib/presupuestos/opciones-pago";
import type { AlternativaDeLaVista, ItemDeLaVista } from "@/lib/presupuestos/vista-publica";

/**
 * Una opción del presupuesto (Básico, Premium…) como tarjeta. Sin estado propio: la usan la vista
 * del servidor (imprimir, aceptado) y la elección del cliente en el navegador, que le pasa
 * `seleccionada` y `onElegir`. Sin `onElegir` no hay botón.
 */

/** Lo que paga el cliente por la opción: con IVA si lo tiene. */
export function totalDeAlternativa(a: Pick<AlternativaDeLaVista, "cobro" | "totales">): number {
  return a.cobro && a.cobro.iva > 0 ? a.cobro.totalConIva : a.totales.total;
}

/** El plan en cuotas sin interés más largo de una opción (null si no hay). */
export function cuotasSinInteres(opciones: readonly OpcionPublica[], total: number): OpcionPublica | null {
  const sin = opciones.filter((o) => o.cuotas > 1 && o.total <= total + 0.5);
  return sin.sort((a, b) => b.cuotas - a.cuotas)[0] ?? null;
}

/** La forma de pago más barata, si cuesta menos que el total (contado o transferencia con descuento). */
export function pagoConDescuento(opciones: readonly OpcionPublica[], total: number): OpcionPublica | null {
  const menor = [...opciones].sort((a, b) => a.total - b.total)[0];
  return menor && menor.total < total - 0.5 ? menor : null;
}

/**
 * Si la opción incluye todo lo de la anterior (por nombre), sólo lo que suma; si no, null y se
 * muestra la lista entera. Así «Premium» dice «Todo lo de Intermedio, más:» en vez de repetirlo.
 */
function extrasSobre(items: ItemDeLaVista[], anterior: ItemDeLaVista[] | undefined): ItemDeLaVista[] | null {
  if (!anterior || anterior.length === 0) return null;
  const nombres = new Set(items.map((i) => i.nombre));
  if (!anterior.every((i) => nombres.has(i.nombre))) return null;
  const previos = new Set(anterior.map((i) => i.nombre));
  return items.filter((i) => !previos.has(i.nombre));
}

function Tilde() {
  return (
    <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--fo-accent-soft)] text-[var(--fo-accent-hover)]">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
        <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function TarjetaAlternativa({
  a,
  anterior,
  seleccionada = false,
  onElegir,
}: {
  a: AlternativaDeLaVista;
  /** La opción de la tarjeta anterior, para resumir «Todo lo de…». */
  anterior?: AlternativaDeLaVista;
  seleccionada?: boolean;
  onElegir?: () => void;
}) {
  const total = totalDeAlternativa(a);
  const cuotas = cuotasSinInteres(a.opcionesPago, total);
  const descuento = pagoConDescuento(a.opcionesPago, total);
  const incluye = a.items.filter((i) => !i.opcional);
  const opcionales = a.items.filter((i) => i.opcional);
  const extras = extrasSobre(incluye, anterior?.items.filter((i) => !i.opcional));
  const lista = extras ?? incluye;

  return (
    <section
      aria-label={`Opción ${a.nombre}`}
      className={`relative flex flex-col rounded-2xl border bg-[var(--fo-surface)] p-6 transition-shadow ${
        seleccionada
          ? "border-[var(--fo-accent)] shadow-lg ring-2 ring-[var(--fo-accent)]"
          : a.masElegida
            ? "border-[var(--fo-accent)] shadow-md"
            : "border-[var(--fo-border)] shadow-sm"
      } ${onElegir ? "hover:shadow-lg" : ""}`}
    >
      {a.masElegida ? (
        <span className="absolute -top-3 left-6 rounded-full bg-[var(--fo-accent)] px-3 py-1 text-xs font-semibold text-[var(--fo-on-accent,#fff)] shadow-sm">
          La más elegida
        </span>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-xl font-semibold tracking-tight">{a.nombre}</h3>
        {a.descripcion ? <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--fo-muted)]">{a.descripcion}</p> : null}
      </div>

      <div className="mt-5 border-y border-[var(--fo-border)] py-5">
        <p className="text-3xl font-bold tracking-tight tabular-nums">{pesos(total)}</p>
        {a.cobro && a.cobro.iva > 0 ? <p className="text-xs text-[var(--fo-muted)]">IVA incluido ({a.cobro.ivaPorcentaje} %)</p> : null}
        <div className="mt-2 space-y-1 text-sm">
          {cuotas ? (
            <p>
              o <span className="font-semibold">{cuotas.cuotas} cuotas sin interés</span> de <span className="tabular-nums">{pesosCuota(cuotas.importeCuota)}</span>
            </p>
          ) : null}
          {descuento ? (
            <p className="text-[var(--fo-success,#047857)]">
              <span className="font-semibold tabular-nums">{pesos(descuento.total)}</span> pagando todo junto
            </p>
          ) : null}
          {a.cobro && a.cobro.senaPorcentaje > 0 ? (
            <p className="text-xs text-[var(--fo-muted)]">Reservás la fecha con una seña del {a.cobro.senaPorcentaje} %.</p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex-1 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--fo-muted)]">Qué incluye</h4>
        {extras && anterior ? (
          <p className="flex gap-2.5 text-sm font-medium">
            <Tilde />
            <span>Todo lo de {anterior.nombre}{extras.length > 0 ? ", más:" : ""}</span>
          </p>
        ) : null}
        <ul className="space-y-2.5 text-sm">
          {lista.map((i) => (
            <li key={i.id} className="flex gap-2.5">
              <Tilde />
              <span className="leading-snug">
                {i.cantidad !== 1 ? `${i.cantidad.toLocaleString("es-AR")} × ` : ""}
                {i.nombre}
                {i.descripcion ? <span className="mt-0.5 block whitespace-pre-line text-xs text-[var(--fo-muted)]">{i.descripcion}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        {opcionales.length > 0 ? (
          <p className="pt-1 text-xs text-[var(--fo-muted)]">
            Opcionales (aparte): {opcionales.map((i) => `${i.nombre} (${pesos(i.neto)})`).join(", ")}
          </p>
        ) : null}
      </div>

      {onElegir ? (
        <button
          type="button"
          onClick={onElegir}
          aria-pressed={seleccionada}
          className={`no-imprimir mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
            seleccionada
              ? "bg-[var(--fo-accent)] text-[var(--fo-on-accent,#fff)]"
              : "border border-[var(--fo-accent)] text-[var(--fo-accent-hover)] hover:bg-[var(--fo-accent-soft)]"
          }`}
        >
          {seleccionada ? "✓ Elegida" : `Elegir ${a.nombre}`}
        </button>
      ) : null}
    </section>
  );
}
