import { requireLevel } from "@/lib/guards";
import { KIND_LABELS } from "@/lib/inventario/equipos";
import { fechaAr } from "@/lib/inventario/formato";
import { listSellerListings } from "@/lib/publicaciones/publicar";
import { Aviso, BotonEnlace, EstadoPublicacion, Pagina } from "@/app/_ui";
import { TEXTO_EN_REVISION } from "./textos";

export const dynamic = "force-dynamic";

const pesos = (n: number) => `$ ${n.toLocaleString("es-AR")}`;

export default async function MisPublicacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireLevel("identidad", "/mis-publicaciones");
  const { ok, error } = await searchParams;
  const publicaciones = await listSellerListings(user.id);

  return (
    <Pagina
      titulo="Mis publicaciones"
      bajada="Los equipos que pusiste a la venta."
      ancho="ancha"
      volver={{ href: "/mi-equipo", texto: "Mi equipo" }}
    >
      <div className="pila">
        {ok ? <Aviso tipo="exito">{ok}</Aviso> : null}
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
      </div>

      {publicaciones.length === 0 ? (
        <section className="seccion">
          <p className="texto-secundario">Todavía no publicaste ningún equipo.</p>
          <div className="acciones">
            <BotonEnlace href="/mi-equipo">Elegir un equipo para publicar</BotonEnlace>
          </div>
        </section>
      ) : (
        <ul className="registro">
          {publicaciones.map((p) => (
            <li key={p.id} className="registro-fila">
              <div className="registro-principal">
                <a className="registro-titulo" href={`/mis-publicaciones/${p.id}`}>
                  {p.make} {p.model}
                </a>
                <span className="registro-detalle">
                  {KIND_LABELS[p.kind]}, <span className="cifra">{pesos(p.priceArs)}</span>, creada el{" "}
                  {fechaAr(p.createdAt)}
                </span>
                {p.status === "IN_REVIEW" ? (
                  <span className="registro-detalle">{TEXTO_EN_REVISION}</span>
                ) : null}
              </div>
              <div className="registro-lado">
                <EstadoPublicacion status={p.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Pagina>
  );
}
