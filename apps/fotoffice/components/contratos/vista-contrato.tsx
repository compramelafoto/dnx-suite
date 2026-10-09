import type { Bloque, Segmento } from "@/lib/contratos/formato";

function Texto({ segmentos }: { segmentos: Segmento[] }) {
  return (
    <>
      {segmentos.map((s, i) => (s.negrita ? <strong key={i}>{s.texto}</strong> : <span key={i}>{s.texto}</span>))}
    </>
  );
}

/**
 * Dibuja los bloques de un contrato (títulos, párrafos, tablas y saltos de página). Nunca interpreta
 * HTML: cada bloque es un dato y React escapa el texto.
 */
export function VistaContrato({ bloques }: { bloques: Bloque[] }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-[var(--fo-text)]">
      {bloques.map((b, i) => {
        if (b.tipo === "titulo") {
          return b.nivel === 1 ? (
            <h3 key={i} className="text-lg font-semibold">
              <Texto segmentos={b.segmentos} />
            </h3>
          ) : (
            <h4 key={i} className="pt-2 text-base font-semibold">
              <Texto segmentos={b.segmentos} />
            </h4>
          );
        }
        if (b.tipo === "parrafo") {
          return (
            <p key={i} className="whitespace-pre-line">
              <Texto segmentos={b.segmentos} />
            </p>
          );
        }
        if (b.tipo === "salto") {
          return (
            <p key={i} role="separator" className="border-t border-dashed border-[var(--fo-border)] pt-1 text-center text-xs text-[var(--fo-muted)]">
              Salto de página
            </p>
          );
        }
        const [encabezado, ...filas] = b.filas;
        return (
          <div key={i} className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr>
                  {(encabezado ?? []).map((c, j) => (
                    <th key={j} className="border border-[var(--fo-border)] bg-[var(--fo-surface-muted)] px-2 py-1 text-left font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f, j) => (
                  <tr key={j}>
                    {f.map((c, k) => (
                      <td key={k} className="border border-[var(--fo-border)] px-2 py-1">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
