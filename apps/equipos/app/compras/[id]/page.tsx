import { notFound } from "next/navigation";
import { AVISOS_ERROR, AVISOS_OK, avisoDeCodigo } from "@/lib/avisos";
import { requireLevel } from "@/lib/guards";
import { fechaAr } from "@/lib/inventario/formato";
import { hasRated } from "@/lib/ventas/calificaciones";
import { estadoCalificacion } from "@/lib/ventas/estado";
import { getSaleForParty } from "@/lib/ventas/ventas";
import { Aviso, Boton, BotonEnlace, Pagina } from "@/app/_ui";
import { confirmarCompra, rechazarCompra } from "../actions";
import { ReportarPersona } from "@/app/reportar-usuario/ReportarPersona";
import { DatosVenta, EstadoVenta, SeccionCalificacion } from "../PartesVenta";

export const dynamic = "force-dynamic";

export default async function CompraPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const user = await requireLevel("identidad", `/compras/${id}`);
  const sp = await searchParams;
  const ok = avisoDeCodigo(AVISOS_OK, sp.ok);
  const error = avisoDeCodigo(AVISOS_ERROR, sp.error);

  const venta = await getSaleForParty(user.id, id);
  // Esta pantalla es sólo del comprador; el vendedor tiene la suya en /ventas/<id>.
  if (!venta || venta.rol !== "COMPRADOR") notFound();

  const pendiente = venta.status === "PENDING_BUYER";
  const vencidaSinResolver = pendiente && venta.expiresAt.getTime() < Date.now();
  const estado = estadoCalificacion(venta, await hasRated(user.id, venta.id));

  return (
    <Pagina
      titulo={venta.equipo}
      bajada={`Compra a ${venta.otraParte}`}
      volver={{ href: "/compras", texto: "Mis compras y ventas" }}
    >
      <div className="pila">
        <div className="acciones">
          <EstadoVenta status={venta.status} rol="COMPRADOR" />
        </div>
        {ok ? <Aviso tipo="exito">{ok}</Aviso> : null}
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
      </div>

      <section className="seccion" aria-labelledby="datos">
        <h2 id="datos">Datos de la compra</h2>
        <div className="superficie">
          <DatosVenta venta={venta} />
        </div>
      </section>

      {pendiente && !vencidaSinResolver ? (
        <section className="seccion" aria-labelledby="confirmar">
          <h2 id="confirmar">¿Le compraste este equipo a {venta.otraParte}?</h2>
          <p>
            {venta.otraParte} indicó que te vendió este equipo. Confirmalo sólo si ya lo tenés en tus
            manos y lo pagaste. Al confirmar, el equipo pasa a tu inventario con todo su historial y
            sus datos quedan a tu nombre.
          </p>
          <p className="texto-secundario">Tenés tiempo hasta el {fechaAr(venta.expiresAt)}.</p>
          <form action={confirmarCompra} className="acciones">
            <input type="hidden" name="saleId" value={venta.id} />
            <Boton>Confirmar que lo compré</Boton>
          </form>
          <details className="desplegable">
            <summary className="desplegable-titulo">No lo compré</summary>
            <form action={rechazarCompra} className="pila">
              <input type="hidden" name="saleId" value={venta.id} />
              <p>
                Si no lo compraste, avisamos a {venta.otraParte}: la publicación se cierra y el equipo
                sigue siendo suyo. Esto no se puede deshacer.
              </p>
              <div className="acciones">
                <Boton variante="peligro">Sí, no lo compré</Boton>
              </div>
            </form>
          </details>
        </section>
      ) : null}

      {vencidaSinResolver || venta.status === "EXPIRED" ? (
        <section className="seccion">
          <Aviso tipo="revision">
            El plazo para confirmar esta compra venció. El equipo sigue siendo de {venta.otraParte}.
          </Aviso>
        </section>
      ) : null}

      {venta.status === "DECLINED" ? (
        <section className="seccion">
          <p className="texto-secundario">
            Indicaste que no compraste este equipo. Le avisamos a {venta.otraParte}.
          </p>
        </section>
      ) : null}

      {venta.status === "CONFIRMED" ? (
        <section className="seccion" aria-labelledby="tuyo">
          <h2 id="tuyo">El equipo ya es tuyo</h2>
          <p>
            Está en «Mi equipo» con su historial. Revisá sus datos y agregá tu comprobante de compra:
            te sirve si alguna vez lo tenés que denunciar o asegurar.
          </p>
          <div className="acciones">
            <BotonEnlace variante="secundario" href={`/mi-equipo/${venta.gearItemId}`}>
              Ver en Mi equipo
            </BotonEnlace>
          </div>
        </section>
      ) : null}

      <SeccionCalificacion venta={venta} estado={estado} />
      <section className="seccion" aria-labelledby="algo-mal">
        <h2 id="algo-mal">¿Algo salió mal?</h2>
        <ReportarPersona origen="venta" refId={venta.id} nombre={venta.otraParte} />
      </section>
    </Pagina>
  );
}
