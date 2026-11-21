"use client";

export type PasoDeLaBarra<K extends string> = {
  clave: K;
  numero: number;
  titulo: string;
  /** Va en el `title` del botón. */
  ayuda: string;
  cantidad: number;
};

type Props<K extends string> = {
  pasos: readonly PasoDeLaBarra<K>[];
  activo: K | null;
  onElegir: (clave: K) => void;
  /** Ancho mínimo antes de pasar a desplazamiento horizontal (más pasos, más ancho). */
  anchoMinimo?: number;
  etiqueta?: string;
};

/**
 * Los pasos de una línea de producción, como un embudo: flechas encadenadas, cada una entra en la
 * siguiente. El tono se va oscureciendo a medida que el pedido avanza; el paso elegido va en
 * naranja lleno y los pasos vacíos quedan apagados. La comparten «Pedidos escolares» e «Impresiones»
 * para que las dos pantallas se lean igual.
 */
export default function BarraDePasos<K extends string>({
  pasos,
  activo,
  onElegir,
  anchoMinimo = 860,
  etiqueta = "Pasos del pedido",
}: Props<K>) {
  return (
    <nav aria-label={etiqueta} className="overflow-x-auto pb-1">
      <ol className="m-0 flex list-none p-0" style={{ minWidth: anchoMinimo }}>
        {pasos.map((p, i) => {
          const elegido = activo === p.clave;
          const n = p.cantidad;
          const primero = i === 0;
          const ultimo = i === pasos.length - 1;
          const punta = 18;
          const forma = `polygon(0 0, calc(100% - ${ultimo ? 0 : punta}px) 0, 100% 50%, calc(100% - ${
            ultimo ? 0 : punta
          }px) 100%, 0 100%, ${primero ? 0 : punta}px 50%)`;
          // Siete pasos bajan de a 4 puntos de luz; con menos pasos el escalón es mayor y el último
          // termina en el mismo tono.
          const escalon = pasos.length > 1 ? 24 / (pasos.length - 1) : 0;
          const tono = 96 - i * escalon;
          const fondo = elegido ? "#c27b3d" : n === 0 ? "#f3f4f6" : `hsl(28 45% ${tono}%)`;
          const tinta = elegido ? "#ffffff" : n === 0 ? "#9ca3af" : "#5b3518";
          return (
            <li key={p.clave} className="relative min-w-0 flex-1" style={{ marginLeft: primero ? 0 : -punta + 4 }}>
              <button
                type="button"
                onClick={() => onElegir(p.clave)}
                aria-current={elegido ? "step" : undefined}
                title={p.ayuda}
                className="group flex h-[72px] w-full items-center gap-2.5 text-left transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:brightness-90"
                style={{
                  clipPath: forma,
                  background: fondo,
                  color: tinta,
                  paddingLeft: primero ? 14 : punta + 10,
                  paddingRight: ultimo ? 12 : punta + 4,
                }}
              >
                <span className="text-[26px] font-bold leading-none tabular-nums">{n}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Paso {p.numero}</span>
                  <span className="text-[13px] font-semibold leading-tight">{p.titulo}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
