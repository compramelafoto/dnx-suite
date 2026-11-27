import { notFound } from "next/navigation";
import { AVISOS_ERROR, AVISOS_OK, avisoDeCodigo } from "@/lib/avisos";
import { requireLevel } from "@/lib/guards";
import { fechaAr } from "@/lib/inventario/formato";
import { hasRated } from "@/lib/ventas/calificaciones";
import { estadoCalificacion } from "@/lib/ventas/estado";
import { getSaleForParty } from "@/lib/ventas/ventas";
import { Aviso, BotonEnlace, Pagina } from "@/app/_ui";
import { DatosVenta, EstadoVenta, SeccionCalificacion } from "@/app/compras/PartesVenta";

export const dynamic = "force-dynamic";

export default async function VentaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const user = await requireLevel("identidad", `/ventas/${id}`);
  const sp = await searchParams;
  const ok = avisoDeCodigo(AVISOS_OK, sp.ok);
  const error = avisoDeCodigo(AVISOS_ERROR, sp.error);

  const venta = await getSaleForParty(user.id, id);
  // Esta pantalla es sólo del vendedor; el comprador tiene la suya en /compras/<id>.
  if (!venta || venta.rol !== "VENDEDOR") notFound();

  const estado = estadoCalificacion(venta, await hasRated(user.id, venta.id));
  const vencidaSinResolver = venta.status === "PENDING_BUYER" && venta.expiresAt.getTime() < Date.now();

  return (
    <Pagina
      titulo={venta.equipo}
      bajada={`Venta a ${venta.otraParte}`}
      volver={{ href: "/compras", texto: "Mis compras y ventas" }}
    >
      <div className="pila">
        <div className="acciones">
          <EstadoVenta status={venta.status} rol="VENDEDOR" />
        </div>
        {ok ? <Aviso tipo="exito">{ok}</Aviso> : null}
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
      </div>

      <section className="seccion" aria-labelledby="datos">
        <h2 id="datos">Datos de la venta</h2>
        <div className="superficie">
          <DatosVenta venta={venta} />
        </div>
      </section>

      <section className="seccion" aria-labelledby="que-sigue">
        <h2 id="que-sigue">Qué sigue</h2>
        {venta.status === "PENDING_BUYER" && !vencidaSinResolver ? (
          <Aviso tipo="revision">
            Esperamos que {venta.otraParte} confirme la compra hasta el {fechaAr(venta.expiresAt)}. Hasta
            entonces el equipo sigue a tu nombre. Si no confirma, la publicación se cierra y el equipo
            sigue siendo tuyo.
          </Aviso>
        ) : null}
        {vencidaSinResolver || venta.status === "EXPIRED" ? (
          <p>
            {venta.otraParte} no confirmó la compra a tiempo. La publicación se cierra y el equipo sigue
            siendo tuyo.
          </p>
        ) : null}
        {venta.status === "DECLINED" ? (
          <p>
            {venta.otraParte} indicó que no compró el equipo. La publicación se cerró y el equipo sigue en
            tu inventario. Si querés, podés volver a publicarlo desde «Mi equipo».
          </p>
        ) : null}
        {venta.status === "CONFIRMED" ? (
          <Aviso tipo="exito">
            {venta.otraParte} confirmó la compra. El equipo ya figura a su nombre, con su historial.
          </Aviso>
        ) : null}
        <div className="acciones">
          <BotonEnlace variante="secundario" href={`/mis-publicaciones/${venta.listingId}`}>
            Ver la publicación
          </BotonEnlace>
        </div>
      </section>

      <SeccionCalificacion venta={venta} estado={estado} />
    </Pagina>
  );
}
