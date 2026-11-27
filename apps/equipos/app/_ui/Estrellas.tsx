// Del módulo sin base de datos: este componente sale por el barril `app/_ui`, que también
// importan componentes de cliente.
import { PROMEDIO, formatRating, type UserRating } from "@/lib/ventas/formato-calificacion";

function iconos(puntaje: number) {
  const llenas = Math.max(0, Math.min(5, Math.round(puntaje)));
  return (
    <span className="estrellas-iconos" aria-hidden="true">
      <span className="estrellas-llenas">{"★".repeat(llenas)}</span>
      <span className="estrellas-vacias">{"★".repeat(5 - llenas)}</span>
    </span>
  );
}

/**
 * Calificación de una persona (`valor`, con el texto de `formatRating`) o una sola calificación
 * (`puntaje` de 1 a 5). Las estrellas son decorado (`aria-hidden`); el lector oye el texto.
 */
export function Estrellas(props: { valor: UserRating } | { puntaje: number }) {
  if ("puntaje" in props) {
    return (
      <span className="estrellas">
        {iconos(props.puntaje)}
        <span className="solo-lectores">{props.puntaje} de 5 estrellas</span>
      </span>
    );
  }
  const { valor } = props;
  if (valor.count === 0 || valor.average == null) {
    return <span className="estrellas texto-secundario">{formatRating(valor)}</span>;
  }
  const cuantas = `${valor.count} ${valor.count === 1 ? "calificación" : "calificaciones"}`;
  return (
    <span className="estrellas">
      {iconos(valor.average)}
      <span aria-hidden="true">{formatRating(valor)}</span>
      <span className="solo-lectores">
        Calificación: {PROMEDIO.format(valor.average)} de 5 estrellas, {cuantas}
      </span>
    </span>
  );
}
