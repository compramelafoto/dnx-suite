import { Boton, Campo } from "@/app/_ui";
import type { OrigenReporte } from "@/lib/usuarios/reportes";
import { reportarUsuario } from "./actions";

/**
 * «Reportar a esta persona»: un desplegable con el motivo. Manda sólo el origen y el número; a
 * quién se reporta lo decide el servidor.
 */
export function ReportarPersona({
  origen,
  refId,
  persona,
  nombre,
}: {
  origen: OrigenReporte;
  refId: number;
  /** Sólo desde los interesados de una publicación propia: quién consultó. */
  persona?: number;
  /** Para el texto del desplegable (por ejemplo «Reportar a Juan»). */
  nombre?: string;
}) {
  return (
    <details className="desplegable">
      <summary className="desplegable-titulo">
        {nombre ? `Reportar a ${nombre}` : "Reportar a esta persona"}
      </summary>
      <form action={reportarUsuario} className="formulario">
        <input type="hidden" name="origen" value={origen} />
        <input type="hidden" name="ref" value={refId} />
        {persona ? <input type="hidden" name="persona" value={persona} /> : null}
        <p className="texto-secundario">
          Si te pidió pagar por fuera, no cumplió lo acordado o algo no te cerró, contanos. Sólo lo ve
          el equipo de MercadoFotoRaw: la otra persona no se entera.
        </p>
        <Campo etiqueta="Qué pasó" ayuda="Entre 10 y 500 caracteres.">
          <textarea
            className="control control-texto"
            name="motivo"
            rows={4}
            minLength={10}
            maxLength={500}
            required
          />
        </Campo>
        <div className="acciones">
          <Boton variante="secundario">Enviar reporte</Boton>
        </div>
      </form>
    </details>
  );
}
