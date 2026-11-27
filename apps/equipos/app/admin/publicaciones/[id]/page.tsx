import { isSuperAdmin } from "@repo/auth-guards";
import { notFound } from "next/navigation";
import { formatDolares, formatPesos } from "@/lib/catalogo/buscar";
import { getPortalUser } from "@/lib/guards";
import { KIND_LABELS } from "@/lib/inventario/equipos";
import { fechaHoraAr } from "@/lib/inventario/formato";
import {
  ESTADOS_DENUNCIA,
  getListingForAdmin,
  TIPOS_DENUNCIA,
} from "@/lib/publicaciones/admin-detalle";
import { CONDITION_LABELS } from "@/lib/publicaciones/catalogos";
import { EstadoPublicacion, Pagina, type GearListingStatus } from "@/app/_ui";
import { DecisionPublicacionForm } from "../DecisionPublicacionForm";

export const dynamic = "force-dynamic";

/**
 * Publicación vista por el admin, en cualquier estado: todo lo necesario para decidir. Sólo super
 * admin; para cualquier otra persona la página no existe.
 */
export default async function PublicacionAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getPortalUser();
  if (!user || !(await isSuperAdmin(user))) notFound();

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const l = await getListingForAdmin(id);
  if (!l) notFound();

  const titulo = `${l.make} ${l.model}`;

  return (
    <Pagina
      titulo={`#${l.id} · ${titulo}`}
      bajada={KIND_LABELS[l.kind]}
      ancho="ancha"
      volver={{ href: "/admin/publicaciones", texto: "Publicaciones" }}
    >
      <div className="pila">
        <div className="acciones">
          <EstadoPublicacion status={l.status as GearListingStatus} />
          {l.status === "PUBLISHED" ? <a href={`/equipos/${l.id}`}>Ver la ficha pública</a> : null}
        </div>

        <section className="superficie pila" aria-labelledby="serie">
          <h2 id="serie" className="ficha-subtitulo">
            Número de serie
          </h2>
          <dl className="documento-datos">
            <dt>Serie cargada</dt>
            <dd className="cifra">{l.serialRaw ?? "Sin serie"}</dd>
            <dt>Serie normalizada</dt>
            <dd className="cifra">{l.serialNormalized ?? "Sin serie"}</dd>
          </dl>
          <h3 className="ficha-subtitulo">Foto del número de serie</h3>
          {l.fotoSerie ? (
            <a href={l.fotoSerie} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="foto" src={l.fotoSerie} alt={`Número de serie de ${titulo}`} />
            </a>
          ) : (
            <p className="texto-secundario">
              {l.fotoSerie === undefined ? "La publicación no tiene foto de la serie." : "Sin foto"}
            </p>
          )}
        </section>

        <section className="superficie pila" aria-labelledby="denuncias">
          <h2 id="denuncias" className="ficha-subtitulo">
            Denuncias sobre la serie
          </h2>
          {l.denuncias.length === 0 ? (
            <p className="texto-secundario">No hay denuncias citadas ni activas sobre esta serie.</p>
          ) : (
            <ul className="lista-texto">
              {l.denuncias.map((d) => (
                <li key={d.id}>
                  Denuncia #{d.id} · {TIPOS_DENUNCIA[d.incident] ?? d.incident} · cargada el{" "}
                  {fechaHoraAr(d.createdAt)} · {ESTADOS_DENUNCIA[d.status] ?? d.status} · denunciante
                  usuario #{d.reporterId}
                  {d.citada ? "" : " (activa, no citada en la nota)"}
                </li>
              ))}
            </ul>
          )}
          <h3 className="ficha-subtitulo">Motivo interno</h3>
          <p className="texto-multilinea">{l.reviewNote ?? "Sin detalle."}</p>
        </section>

        <section className="superficie pila" aria-labelledby="fotos">
          <h2 id="fotos" className="ficha-subtitulo">
            Fotos del equipo
          </h2>
          {l.fotos.length === 0 ? <p className="texto-secundario">Sin foto</p> : null}
          {l.fotos.length > 0 ? (
            <div className="fotos">
              {l.fotos.map((url, i) =>
                url ? (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="foto" src={url} alt={`Foto ${i + 1} de ${titulo}`} />
                  </a>
                ) : (
                  <p key={i} className="texto-secundario">
                    Sin foto
                  </p>
                ),
              )}
            </div>
          ) : null}
        </section>

        <section className="superficie pila" aria-labelledby="datos">
          <h2 id="datos" className="ficha-subtitulo">
            Datos de la publicación
          </h2>
          <dl className="documento-datos">
            <dt>Precio</dt>
            <dd className="cifra">{formatPesos(l.priceArs)}</dd>
            {l.priceUsdRef ? (
              <>
                <dt>Referencia</dt>
                <dd className="cifra">{formatDolares(l.priceUsdRef)}</dd>
              </>
            ) : null}
            <dt>Estado del equipo</dt>
            <dd>{CONDITION_LABELS[l.condition]}</dd>
            <dt>Ubicación</dt>
            <dd>
              {l.city}, {l.province}
            </dd>
            <dt>Incluye</dt>
            <dd>{l.accessories ?? "Sin detalle."}</dd>
            <dt>Creada</dt>
            <dd>{fechaHoraAr(l.createdAt)}</dd>
            {l.publishedAt ? (
              <>
                <dt>Publicada</dt>
                <dd>{fechaHoraAr(l.publishedAt)}</dd>
              </>
            ) : null}
          </dl>
          <h3 className="ficha-subtitulo">Descripción</h3>
          <p className="texto-multilinea">{l.description ?? "Sin descripción."}</p>
        </section>

        <section className="superficie pila" aria-labelledby="vendedor">
          <h2 id="vendedor" className="ficha-subtitulo">
            Vendedor
          </h2>
          <dl className="documento-datos">
            <dt>Nombre legal</dt>
            <dd>{l.vendedor.nombreLegal ?? "(sin nombre legal)"}</dd>
            <dt>Correo</dt>
            <dd>{l.vendedor.email ?? "(sin correo)"}</dd>
            <dt>Usuario</dt>
            <dd>#{l.vendedor.id}</dd>
          </dl>
        </section>

        {l.status === "IN_REVIEW" ? (
          <section className="superficie pila" aria-labelledby="decision">
            <h2 id="decision" className="ficha-subtitulo">
              Decisión
            </h2>
            <DecisionPublicacionForm id={l.id} />
          </section>
        ) : null}
      </div>
    </Pagina>
  );
}
