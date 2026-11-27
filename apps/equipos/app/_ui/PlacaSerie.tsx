/**
 * Número de serie grabado como en la placa del equipo. En pantallas públicas llega siempre
 * enmascarado; completo sólo se le muestra a su dueño.
 */
export function PlacaSerie({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <div className="placa">
      <span className="placa-etiqueta">Número de serie</span>
      <span className="placa-valor">{value}</span>
    </div>
  );
}
