import { DnxPreciosVistos, type DnxPagina, type DnxPaleta } from "@/components/dnx/DnxCta";

export type PlanDnx = {
  key: string;
  titulo: string;
  /** Una línea que ubica al lector: para quién es este plan. */
  idealPara: string;
  total: number;
  /** Todo lo que el plan incluye, en positivo. Nunca se listan faltantes. */
  incluye: string[];
  /** Lo que no trae, presentado como ampliación y no como carencia. */
  podesSumar?: string[];
  destacado?: boolean;
  badge?: string;
  /** Proporción de descuento por pago único (0.2 = 20%). Ausente = sin descuento. */
  descuentoContado?: number;
};

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const PALETAS = {
  xv: {
    tarjeta: "border-zinc-200 bg-white",
    tarjetaDestacada: "border-zinc-900 bg-zinc-900 text-white",
    titulo: "text-zinc-800",
    tituloDestacado: "text-amber-300",
    ideal: "text-zinc-500",
    idealDestacado: "text-zinc-300",
    importe: "text-zinc-900",
    importeDestacado: "text-white",
    detalle: "text-zinc-600",
    detalleDestacado: "text-zinc-300",
    tilde: "text-emerald-600",
    tildeDestacado: "text-emerald-300",
    item: "text-zinc-700",
    itemDestacado: "text-zinc-100",
    separador: "border-zinc-200",
    separadorDestacado: "border-zinc-700",
    badge: "bg-amber-300 text-zinc-900",
    nota: "text-zinc-600",
  },
  bodas: {
    tarjeta: "border-stone-200 bg-white",
    tarjetaDestacada: "border-stone-900 bg-stone-900 text-white",
    titulo: "text-stone-800",
    tituloDestacado: "text-amber-200",
    ideal: "text-stone-500",
    idealDestacado: "text-stone-300",
    importe: "text-stone-900",
    importeDestacado: "text-white",
    detalle: "text-stone-600",
    detalleDestacado: "text-stone-300",
    tilde: "text-emerald-600",
    tildeDestacado: "text-emerald-300",
    item: "text-stone-700",
    itemDestacado: "text-stone-100",
    separador: "border-stone-200",
    separadorDestacado: "border-stone-700",
    badge: "bg-amber-200 text-stone-900",
    nota: "text-stone-600",
  },
} satisfies Record<DnxPaleta, Record<string, string>>;

function TarjetaPlan({ plan, cuotas, paleta }: { plan: PlanDnx; cuotas: number; paleta: DnxPaleta }) {
  const c = PALETAS[paleta];
  const destacado = plan.destacado ?? false;
  const cuota = Math.round(plan.total / cuotas);
  const contado = plan.descuentoContado ? Math.round(plan.total * (1 - plan.descuentoContado)) : null;

  return (
    <article
      className={`flex h-full flex-col rounded-3xl border p-6 shadow-sm ${
        destacado ? c.tarjetaDestacada : c.tarjeta
      }`}
    >
      {destacado && plan.badge ? (
        <span className={`mb-3 inline-flex self-start rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${c.badge}`}>
          {plan.badge}
        </span>
      ) : null}

      <h3 className={`text-lg font-semibold uppercase tracking-wide ${destacado ? c.tituloDestacado : c.titulo}`}>
        {plan.titulo}
      </h3>
      <p className={`mt-1 text-sm ${destacado ? c.idealDestacado : c.ideal}`}>{plan.idealPara}</p>

      <div className={`mt-5 border-t pt-5 ${destacado ? c.separadorDestacado : c.separador}`}>
        <p className={`text-3xl font-bold leading-none ${destacado ? c.importeDestacado : c.importe}`}>
          {pesos.format(cuota)}
          <span className={`ml-1.5 text-sm font-medium ${destacado ? c.detalleDestacado : c.detalle}`}>por mes</span>
        </p>
        <p className={`mt-2 text-sm ${destacado ? c.detalleDestacado : c.detalle}`}>
          Hasta {cuotas} pagos sin interés · Total {pesos.format(plan.total)}
        </p>
        {contado ? (
          <p className={`mt-1 text-sm font-semibold ${destacado ? c.importeDestacado : c.importe}`}>
            En un pago: {pesos.format(contado)}
            <span className={`ml-1 font-medium ${destacado ? c.detalleDestacado : c.detalle}`}>
              ({Math.round((plan.descuentoContado ?? 0) * 100)}% de descuento)
            </span>
          </p>
        ) : null}
      </div>

      <ul className={`mt-5 space-y-2 border-t pt-5 ${destacado ? c.separadorDestacado : c.separador}`}>
        {plan.incluye.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <span className={`mt-px font-bold ${destacado ? c.tildeDestacado : c.tilde}`} aria-hidden>
              ✓
            </span>
            <span className={destacado ? c.itemDestacado : c.item}>{item}</span>
          </li>
        ))}
      </ul>

      {plan.podesSumar?.length ? (
        <p className={`mt-auto pt-5 text-xs leading-relaxed ${destacado ? c.detalleDestacado : c.detalle}`}>
          <span className="font-semibold">Podés sumar:</span> {plan.podesSumar.join(" · ")}.
        </p>
      ) : null}
    </article>
  );
}

/**
 * Las mismas tres propuestas sin ningún importe, para la versión `/sp`
 * que se manda en el primer contacto. Se muestra qué incluye cada una
 * para que la conversación posterior arranque desde el contenido y no
 * desde el número.
 */
export function DnxPropuestasSinPrecio({
  id,
  planes,
  paleta,
}: {
  id: string;
  planes: PlanDnx[];
  paleta: DnxPaleta;
}) {
  const c = PALETAS[paleta];

  return (
    <div id={id} className="scroll-mt-8 grid gap-5 lg:grid-cols-3">
      {planes.map((plan) => {
        const destacado = plan.destacado ?? false;
        return (
          <article
            key={plan.key}
            className={`flex h-full flex-col rounded-3xl border p-6 shadow-sm ${
              destacado ? c.tarjetaDestacada : c.tarjeta
            }`}
          >
            {destacado && plan.badge ? (
              <span
                className={`mb-3 inline-flex self-start rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${c.badge}`}
              >
                {plan.badge}
              </span>
            ) : null}

            <h3 className={`text-lg font-semibold uppercase tracking-wide ${destacado ? c.tituloDestacado : c.titulo}`}>
              {plan.titulo}
            </h3>
            <p className={`mt-1 text-sm ${destacado ? c.idealDestacado : c.ideal}`}>{plan.idealPara}</p>

            <ul className={`mt-5 space-y-2 border-t pt-5 ${destacado ? c.separadorDestacado : c.separador}`}>
              {plan.incluye.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <span className={`mt-px font-bold ${destacado ? c.tildeDestacado : c.tilde}`} aria-hidden>
                    ✓
                  </span>
                  <span className={destacado ? c.itemDestacado : c.item}>{item}</span>
                </li>
              ))}
            </ul>

            {plan.podesSumar?.length ? (
              <p className={`mt-auto pt-5 text-xs leading-relaxed ${destacado ? c.detalleDestacado : c.detalle}`}>
                <span className="font-semibold">Podés sumar:</span> {plan.podesSumar.join(" · ")}.
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export default function DnxPlanes({
  id,
  planes,
  cuotas,
  paleta,
  pagina,
  notaFinanciacion,
}: {
  id: string;
  /** Ya ordenados de mayor a menor: el precio más alto ancla la lectura. */
  planes: PlanDnx[];
  cuotas: number;
  paleta: DnxPaleta;
  pagina: DnxPagina;
  notaFinanciacion: string;
}) {
  const c = PALETAS[paleta];

  return (
    <div id={id} className="scroll-mt-8">
      <DnxPreciosVistos pagina={pagina} />
      <div className="grid gap-5 lg:grid-cols-3">
        {planes.map((plan) => (
          <TarjetaPlan key={plan.key} plan={plan} cuotas={cuotas} paleta={paleta} />
        ))}
      </div>
      <p className={`mx-auto mt-6 max-w-3xl text-center text-sm leading-relaxed ${c.nota}`}>{notaFinanciacion}</p>
    </div>
  );
}
