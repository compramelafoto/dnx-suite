import Link from "next/link";
import { AVISOS_ERROR, AVISOS_OK, avisoDeCodigo } from "@/lib/avisos";
import { getPurchaseRequestOptOut } from "@/lib/busco/pedidos";
import { requireLevel } from "@/lib/guards";
import { fechaAr } from "@/lib/inventario/formato";
import { getUserRating, listRatingsAbout } from "@/lib/ventas/calificaciones";
import { Aviso, Boton, Estrellas, Pagina, SelloIdentidad } from "@/app/_ui";
import { guardarAvisosBusco } from "../busco/actions";

export const dynamic = "force-dynamic";

const ENLACES = [
  {
    href: "/cuenta/verificacion",
    titulo: "Mi verificación",
    detalle: "Correo, teléfono e identidad: lo que te falta para comprar y vender.",
  },
  {
    href: "/compras",
    titulo: "Mis compras y ventas",
    detalle: "Confirmá compras, seguí tus ventas y calificá a la otra parte.",
  },
  { href: "/favoritos", titulo: "Favoritos", detalle: "Las publicaciones que guardaste para mirar después." },
  { href: "/alertas", titulo: "Alertas", detalle: "Te avisamos cuando se publica un equipo que buscás." },
  {
    href: "/busco",
    titulo: "Mis pedidos «Busco»",
    detalle: "Contá qué equipo buscás para que te encuentren los vendedores.",
  },
] as const;

export default async function CuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireLevel("registrado", "/cuenta");
  const sp = await searchParams;
  const ok = avisoDeCodigo(AVISOS_OK, sp.ok);
  const error = avisoDeCodigo(AVISOS_ERROR, sp.error);
  const [calificacion, comentarios, sinAvisosBusco] = await Promise.all([
    getUserRating(user.id),
    listRatingsAbout(user.id),
    getPurchaseRequestOptOut(user.id),
  ]);

  return (
    <Pagina titulo="Mi cuenta" bajada={user.displayName ?? user.email}>
      {user.level === "identidad" ? (
        <div className="acciones">
          <SelloIdentidad />
        </div>
      ) : null}

      <nav className="seccion" aria-label="Mi cuenta">
        <ul className="registro">
          {ENLACES.map((e) => (
            <li key={e.href} className="registro-fila">
              <div className="registro-principal">
                <Link className="registro-titulo" href={e.href}>
                  {e.titulo}
                </Link>
                <span className="registro-detalle">{e.detalle}</span>
              </div>
            </li>
          ))}
        </ul>
      </nav>

      <section className="seccion pila" id="avisos-busco" aria-labelledby="avisos-titulo">
        <h2 id="avisos-titulo">Avisos</h2>
        {ok ? <Aviso tipo="exito">{ok}</Aviso> : null}
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
        <form action={guardarAvisosBusco} className="pila">
          <label className="opcion">
            <input type="checkbox" name="avisarme" defaultChecked={!sinAvisosBusco} />
            <span className="opcion-texto">
              Avisarme cuando alguien busque un equipo como los míos
            </span>
          </label>
          <p className="texto-secundario texto-chico">
            Te escribimos como mucho dos veces por semana. El comprador no sabe quién sos ni que tenés
            el equipo.
          </p>
          <div className="acciones">
            <Boton variante="secundario">Guardar</Boton>
          </div>
        </form>
      </section>

      <section className="seccion" aria-labelledby="calificaciones">
        <h2 id="calificaciones">Tu calificación</h2>
        <p className="calificacion-resumen">
          <Estrellas valor={calificacion} />
        </p>
        <p className="texto-secundario texto-chico">
          Te califican las personas con las que cerraste una compra o una venta confirmada. Los demás
          ven el promedio junto a tus publicaciones.
        </p>
        {comentarios.length > 0 ? (
          <ul className="comentarios">
            {comentarios.map((c) => (
              <li key={c.id} className="comentario">
                <Estrellas puntaje={c.score} />
                <p className="texto-multilinea">{c.comment}</p>
                <p className="texto-secundario texto-chico">
                  {c.de}, el {fechaAr(c.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="texto-secundario">Todavía no recibiste comentarios.</p>
        )}
      </section>
    </Pagina>
  );
}
