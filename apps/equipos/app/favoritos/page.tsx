import type { Metadata } from "next";
import { AVISOS_ERROR, AVISOS_OK, avisoDeCodigo } from "@/lib/avisos";
import { listFavorites } from "@/lib/catalogo/favoritos";
import { requireLevel } from "@/lib/guards";
import { Aviso, Boton, BotonEnlace, Pagina } from "@/app/_ui";
import { MARCA } from "@/app/_ui/marca";
import { alternarFavorito } from "@/app/equipos/[id]/favorito/actions";
import { TarjetaEquipo } from "@/app/equipos/TarjetaEquipo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Favoritos — ${MARCA}` };

export default async function FavoritosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireLevel("registrado", "/favoritos");
  const sp = await searchParams;
  const ok = avisoDeCodigo(AVISOS_OK, sp.ok);
  const error = avisoDeCodigo(AVISOS_ERROR, sp.error);
  const favoritos = await listFavorites(user.id);

  return (
    <Pagina
      titulo="Favoritos"
      bajada="Las publicaciones que guardaste para mirar después. Si una se vende o se pausa, deja de aparecer acá."
      ancho="ancha"
      volver={{ href: "/cuenta", texto: "Mi cuenta" }}
    >
      <div className="pila">
        {ok ? <Aviso tipo="exito">{ok}</Aviso> : null}
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
      </div>

      {favoritos.length === 0 ? (
        <div className="pila">
          <p className="texto-secundario">
            Todavía no guardaste ninguna publicación. Cuando veas un equipo que te interesa, tocá
            «Guardar en favoritos» en su ficha y lo vas a encontrar acá.
          </p>
          <div className="acciones">
            <BotonEnlace href="/equipos">Ver equipos en venta</BotonEnlace>
          </div>
        </div>
      ) : (
        <ul className="resultados-lista">
          {favoritos.map((l) => (
            <TarjetaEquipo
              key={l.id}
              l={l}
              extra={
                <form action={alternarFavorito}>
                  <input type="hidden" name="listingId" value={l.id} />
                  <input type="hidden" name="desde" value="favoritos" />
                  <Boton variante="secundario">Quitar de favoritos</Boton>
                </form>
              }
            />
          ))}
        </ul>
      )}
    </Pagina>
  );
}
