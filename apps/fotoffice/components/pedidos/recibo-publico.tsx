import { pesosConCentavos } from "@/lib/pedidos/pantalla";
import type { VistaReciboPublica } from "@/lib/pedidos/vista-publica";
import { ContactoPublico, MarcaPublica } from "./pedido-publico";

/**
 * El recibo X interno como lo ve el cliente (enlace público), listo para imprimir o "Guardar como
 * PDF". Sólo recibe la `VistaReciboPublica` (sin el motivo de la anulación ni ids). Importes con
 * centavos, como va en el recibo. Componente de servidor.
 */

/** Al imprimir sale sólo el recibo, sin el menú ni el pie del sitio ni los botones. */
export const ESTILO_IMPRESION_RECIBO = `@media print {
  body * { visibility: hidden !important; }
  #recibo-imprimible, #recibo-imprimible * { visibility: visible !important; }
  #recibo-imprimible { position: absolute; inset: 0 auto auto 0; width: 100%; padding: 0; }
  .no-imprimir { display: none !important; }
}`;

export function ReciboPublico({ vista }: { vista: VistaReciboPublica }) {
  return (
    <article id="recibo-imprimible" className="relative space-y-6 overflow-hidden">
      {vista.anulado ? (
        <p
          aria-label="Recibo anulado"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 select-none rounded-lg border-4 border-red-600 px-6 py-2 text-5xl font-black tracking-widest text-red-600 opacity-70"
        >
          ANULADO
        </p>
      ) : null}

      <MarcaPublica organizacion={vista.organizacion}>
        <p className="font-semibold">Recibo N° {vista.numero}</p>
        <p className="opacity-70">Fecha: {vista.fecha}</p>
      </MarcaPublica>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs opacity-70">Recibimos de</dt>
          <dd className="font-medium">{vista.cliente || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs opacity-70">Concepto</dt>
          <dd>{vista.concepto}</dd>
        </div>
        <div>
          <dt className="text-xs opacity-70">Medio de pago</dt>
          <dd>{vista.medio}</dd>
        </div>
        <div>
          <dt className="text-xs opacity-70">Importe</dt>
          <dd className="text-lg font-semibold tabular-nums">{pesosConCentavos(vista.importe)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs opacity-70">Son</dt>
          <dd className="first-letter:uppercase">{vista.importeEnLetras}</dd>
        </div>
      </dl>

      {vista.cuotas.length > 0 ? (
        <section aria-label="Cuotas" className="space-y-2">
          <h2 className="text-base font-semibold">Este pago se aplica a</h2>
          <ul className="divide-y divide-[var(--fo-border)] text-sm">
            {vista.cuotas.map((c) => (
              <li key={c.numero} className="flex justify-between gap-2 py-2">
                <span>
                  Cuota {c.numero} <span className="opacity-70">· vence el {c.vence}</span>
                </span>
                <span className="tabular-nums">{pesosConCentavos(c.importe)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {vista.anulado ? <p className="text-sm font-semibold text-red-600">Este recibo está anulado.</p> : null}
      <p className="border-t border-[var(--fo-border)] pt-3 text-xs font-semibold uppercase tracking-wide opacity-80">{vista.leyenda}</p>
      <ContactoPublico organizacion={vista.organizacion} />
    </article>
  );
}
