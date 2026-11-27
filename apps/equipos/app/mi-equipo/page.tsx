import { AVISOS_ERROR, AVISOS_OK, avisoDeCodigo } from "@/lib/avisos";
import { requireLevel } from "@/lib/guards";
import { KIND_LABELS, listItems, STATUS_LABELS } from "@/lib/inventario/equipos";
import { listSightingSuggestions } from "@/lib/inventario/sugerencias";
import { fechaAr } from "@/lib/inventario/formato";
import { Aviso, Boton, BotonEnlace, Campo, EstadoEquipo, Pagina } from "@/app/_ui";
import { agregarEquipo, esMio, noEsMio } from "./actions";

export const dynamic = "force-dynamic";

export default async function MiEquipoPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireLevel("identidad", "/mi-equipo");
  // Por la URL viajan códigos; el texto sale siempre del mapa fijo (texto libre: sin aviso).
  const sp = await searchParams;
  const ok = avisoDeCodigo(AVISOS_OK, sp.ok);
  const error = avisoDeCodigo(AVISOS_ERROR, sp.error);
  const [sugerencias, equipos] = await Promise.all([
    listSightingSuggestions(user.id),
    listItems(user.id),
  ]);

  return (
    <Pagina
      titulo="Mi equipo"
      bajada="Tu inventario: los equipos que cargás acá no se publican hasta que vos lo decidas."
    >
      <div className="pila">
        {ok ? <Aviso tipo="exito">{ok}</Aviso> : null}
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
        <div className="acciones">
          <BotonEnlace variante="secundario" href="/mis-publicaciones">
            Mis publicaciones
          </BotonEnlace>
          <BotonEnlace variante="secundario" href="/mi-equipo/informe">
            Generar un informe para la aseguradora
          </BotonEnlace>
        </div>
      </div>

      {sugerencias.length > 0 ? (
        <section className="seccion" aria-labelledby="sugerencias">
          <div className="seccion-cabecera">
            <h2 id="sugerencias">Equipos que vimos en tus fotos</h2>
            <p className="texto-secundario">
              CompraMeLaFoto detectó estos números de serie en las fotos que subiste. Confirmá cuáles
              son tuyos.
            </p>
          </div>
          <ul className="registro">
            {sugerencias.map((s) => (
              <li key={s.sightingId} className="registro-fila">
                <div className="registro-principal">
                  <span className="registro-titulo">
                    {s.make} {s.model}
                  </span>
                  <span className="registro-detalle">
                    {KIND_LABELS[s.kind]}, serie <span className="cifra">{s.serialRaw}</span>
                  </span>
                  <span className="registro-detalle">
                    Visto en <span className="cifra">{s.photosCount}</span>{" "}
                    {s.photosCount === 1 ? "foto" : "fotos"}, entre {fechaAr(s.firstSeenAt)} y{" "}
                    {fechaAr(s.lastSeenAt)}
                  </span>
                </div>
                <div className="registro-lado">
                  <form action={esMio}>
                    <input type="hidden" name="sightingId" value={s.sightingId} />
                    <Boton>Es mío</Boton>
                  </form>
                  <form action={noEsMio}>
                    <input type="hidden" name="sightingId" value={s.sightingId} />
                    <Boton variante="secundario">No es mío</Boton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="seccion" aria-labelledby="mis-equipos">
        <h2 id="mis-equipos">Mis equipos</h2>
        {equipos.length === 0 ? (
          <p className="texto-secundario">Todavía no cargaste ningún equipo.</p>
        ) : (
          <ul className="registro">
            {equipos.map((e) => (
              <li key={e.id} className="registro-fila">
                <div className="registro-principal">
                  <a className="registro-titulo" href={`/mi-equipo/${e.id}`}>
                    {e.make} {e.model}
                  </a>
                  <span className="registro-detalle">
                    {KIND_LABELS[e.kind]}
                    {e.serialRaw ? (
                      <>
                        , serie <span className="cifra">{e.serialRaw}</span>
                      </>
                    ) : null}
                  </span>
                </div>
                <EstadoEquipo status={e.status} texto={STATUS_LABELS[e.status]} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="seccion" aria-labelledby="agregar">
        <h2 id="agregar">Agregar un equipo</h2>
        <form action={agregarEquipo} className="superficie formulario">
          <Campo etiqueta="Tipo">
            <select className="control" name="kind" defaultValue="BODY" required>
              {Object.entries(KIND_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Campo>
          <div className="formulario-dos">
            <Campo etiqueta="Marca">
              <input className="control" name="make" required maxLength={80} />
            </Campo>
            <Campo etiqueta="Modelo">
              <input className="control" name="model" required maxLength={120} />
            </Campo>
          </div>
          <Campo
            etiqueta="Número de serie"
            ayuda="Está grabado en el equipo. Para cámaras y lentes lo vas a necesitar al publicar."
          >
            <input className="control" name="serialRaw" maxLength={80} autoComplete="off" />
          </Campo>
          <Campo etiqueta="Fecha de compra">
            <input className="control" name="purchaseDate" type="date" />
          </Campo>
          <div className="formulario-dos">
            <Campo etiqueta="Valor declarado en pesos">
              <input className="control" name="declaredValueArs" inputMode="numeric" />
            </Campo>
            <Campo etiqueta="Valor declarado en dólares">
              <input className="control" name="declaredValueUsd" inputMode="numeric" />
            </Campo>
          </div>
          <Campo etiqueta="Notas">
            <textarea className="control control-texto" name="notes" maxLength={1000} />
          </Campo>
          <div className="acciones">
            <Boton>Agregar equipo</Boton>
          </div>
        </form>
      </section>
    </Pagina>
  );
}
