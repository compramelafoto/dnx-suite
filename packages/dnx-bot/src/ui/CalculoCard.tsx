import type { TarjetaCalculo } from "./calculo";

/** La tarjeta «cálculo»: los números del servidor, en filas. Sin lógica: la valida `parseTarjetaCalculo`. */
export function CalculoCard({ tarjeta }: { tarjeta: TarjetaCalculo }) {
  return (
    <div role="group" aria-label={tarjeta.titulo} style={{ border: "1px solid #e4e4e7", background: "#fafafa", borderRadius: 12, padding: 10 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{tarjeta.titulo}</div>
      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px" }}>
        {tarjeta.filas.map((f) => (
          <div key={f.etiqueta} style={{ display: "contents" }}>
            <dt style={{ color: "#555" }}>{f.etiqueta}</dt>
            <dd style={{ margin: 0, fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.valor}</dd>
          </div>
        ))}
      </dl>
      {tarjeta.avisos.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#8a5a00", fontSize: 12 }}>
          {tarjeta.avisos.map((a) => <li key={a}>{a}</li>)}
        </ul>
      )}
    </div>
  );
}
