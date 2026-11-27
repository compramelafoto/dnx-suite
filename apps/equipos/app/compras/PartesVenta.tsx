import { Fragment } from "react";
import { formatPesos } from "@/lib/catalogo/buscar";
import { fechaAr } from "@/lib/inventario/formato";
import { estadoVenta, plazoParaCalificar, type EstadoCalificacion, type Rol } from "@/lib/ventas/estado";
import type { SaleDetail, SaleSummary } from "@/lib/ventas/ventas";
import { Aviso, Boton, Campo } from "@/app/_ui";
import { calificar } from "./actions";

/** Píldora del estado de la venta, nombrada según quién mira. */
export function EstadoVenta({ status, rol }: { status: SaleSummary["status"]; rol: Rol }) {
  const e = estadoVenta(status, rol);
  return <span className={e.clase}>{e.texto}</span>;
}

/** Los datos de la operación, iguales para las dos partes salvo el nombre de la otra. */
export function DatosVenta({ venta }: { venta: SaleDetail }) {
  return (
    <dl className="documento-datos">
      <dt>Equipo</dt>
      <dd>{venta.equipo}</dd>
      <dt>{venta.rol === "COMPRADOR" ? "Vendedor" : "Comprador"}</dt>
      <dd>{venta.otraParte}</dd>
      <dt>Precio final</dt>
      <dd className="cifra">{formatPesos(venta.priceArs)}</dd>
      <dt>Marcada como vendida</dt>
      <dd>{fechaAr(venta.createdAt)}</dd>
      {venta.status === "PENDING_BUYER" ? (
        <>
          <dt>Plazo para confirmar</dt>
          <dd>Hasta el {fechaAr(venta.expiresAt)}</dd>
        </>
      ) : null}
      {venta.resolvedAt ? (
        <>
          <dt>{venta.status === "CONFIRMED" ? "Confirmada" : "Resuelta"}</dt>
          <dd>{fechaAr(venta.resolvedAt)}</dd>
        </>
      ) : null}
    </dl>
  );
}

const ESTRELLAS = [5, 4, 3, 2, 1] as const;

/**
 * La calificación de la otra parte. El estado se decide en la página con los datos de la venta
 * (`estadoCalificacion`): el formulario sale sólo cuando corresponde.
 */
export function SeccionCalificacion({ venta, estado }: { venta: SaleDetail; estado: EstadoCalificacion }) {
  if (estado === "NO_CORRESPONDE") return null;
  const aQuien = venta.rol === "COMPRADOR" ? "al vendedor" : "al comprador";
  return (
    <section className="seccion" aria-labelledby="calificar">
      <h2 id="calificar">Calificá {aQuien}</h2>
      {estado === "YA_CALIFICASTE" ? <Aviso tipo="exito">Ya calificaste esta operación.</Aviso> : null}
      {estado === "VENCIDO" ? (
        <p className="texto-secundario">El plazo para calificar esta operación venció.</p>
      ) : null}
      {estado === "FORMULARIO" && venta.resolvedAt ? (
        <form action={calificar} className="superficie formulario">
          <input type="hidden" name="saleId" value={venta.id} />
          <p>
            ¿Cómo fue la operación con {venta.otraParte}? Tenés hasta el{" "}
            {fechaAr(plazoParaCalificar(venta.resolvedAt))} para calificar. Las estrellas se suman a
            su calificación en el portal y tu comentario le llega a su cuenta.
          </p>
          <fieldset className="grupo">
            <legend className="campo-etiqueta">Tu calificación</legend>
            {/* De 5 a 1 y en fila invertida: así «la elegida y las anteriores» se pintan sólo con CSS. */}
            <div className="elegir-estrellas">
              {ESTRELLAS.map((n) => (
                <Fragment key={n}>
                  <input
                    className="solo-lectores"
                    type="radio"
                    name="score"
                    id={`estrella-${n}`}
                    value={n}
                    required
                  />
                  <label htmlFor={`estrella-${n}`}>
                    <span aria-hidden="true">★</span>
                    <span className="solo-lectores">
                      {n} {n === 1 ? "estrella" : "estrellas"}
                    </span>
                  </label>
                </Fragment>
              ))}
            </div>
            <p className="campo-ayuda">De 1 (mala) a 5 (excelente).</p>
          </fieldset>
          <Campo etiqueta="Comentario (opcional)" ayuda="Hasta 300 caracteres. Contá cómo fue el trato y si el equipo era como se describía.">
            <textarea className="control control-texto" name="comment" maxLength={300} />
          </Campo>
          <div className="acciones">
            <Boton>Enviar calificación</Boton>
          </div>
        </form>
      ) : null}
    </section>
  );
}
