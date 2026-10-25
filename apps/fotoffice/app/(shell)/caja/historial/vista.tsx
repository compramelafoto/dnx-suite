import { formatMinorArs } from "@/lib/membership/money";
import type { EstadoLote } from "@/lib/historico-caja/tipos";

export const ETIQUETA_ESTADO: Record<EstadoLote, string> = {
  BORRADOR: "Para revisar",
  CONFIRMADO: "Confirmado",
  DESCARTADO: "Descartado",
};

export function Estado({ estado }: { estado: EstadoLote }) {
  const color =
    estado === "CONFIRMADO" ? "text-[var(--fo-success)]" : estado === "DESCARTADO" ? "text-[var(--fo-muted-soft)]" : "text-[var(--fo-warning)]";
  return <span className={`text-xs font-semibold ${color}`}>{ETIQUETA_ESTADO[estado]}</span>;
}

export function Pesos({ centavos, positivo = false }: { centavos: number; positivo?: boolean }) {
  const v = positivo ? Math.abs(centavos) : centavos;
  return <span className={v < 0 ? "text-[var(--fo-danger)]" : undefined}>{formatMinorArs(v)}</span>;
}

export function Tabla({ columnas, children, minimo = 480 }: { columnas: { titulo: string; derecha?: boolean }[]; children: React.ReactNode; minimo?: number }) {
  return (
    <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
      <table className="w-full text-left text-sm" style={{ minWidth: minimo }}>
        <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
          <tr>
            {columnas.map((c) => (
              <th key={c.titulo} className={`px-4 py-2 font-semibold ${c.derecha ? "text-right" : ""}`}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">{children}</tbody>
      </table>
    </div>
  );
}
