import { notFound } from "next/navigation";
import { getSignedFileUrl } from "@/lib/archivos";
import { requireLevel } from "@/lib/guards";
import {
  EquipoError,
  getItem,
  KIND_LABELS,
  listItemHistory,
  STATUS_LABELS,
} from "@/lib/inventario/equipos";
import { EVENT_LABELS, fechaHoraAr, fechaInput } from "@/lib/inventario/formato";
import { Aviso, Boton, BotonEnlace, Campo, EstadoEquipo, Pagina, PlacaSerie } from "@/app/_ui";
import { guardarEquipo, loRecupere, subirComprobante, subirFoto } from "../actions";

export const dynamic = "force-dynamic";

const ESTADOS_EDITABLES = ["IN_USE", "FOR_SALE", "SOLD"] as const;
// Un equipo recuperado vuelve al uso normal: el servidor lo permite.
const ESTADOS_CON_SELECTOR = [...ESTADOS_EDITABLES, "RECOVERED"] as readonly string[];

export default async function EquipoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();
  const user = await requireLevel("identidad", `/mi-equipo/${id}`);
  const { ok, error } = await searchParams;

  let item;
  try {
    item = await getItem(user.id, id);
  } catch (err) {
    if (err instanceof EquipoError && err.code === "NO_ENCONTRADO") notFound();
    throw err;
  }
  const historial = await listItemHistory(user.id, id);

  // Archivos privados: sólo con URL firmada y de corta vida, generada para el dueño.
  const fotos = await Promise.all(item.photoKeys.map((k) => getSignedFileUrl(k)));
  const comprobante = item.purchaseProofKey ? await getSignedFileUrl(item.purchaseProofKey) : null;
  const estadoEditable = ESTADOS_CON_SELECTOR.includes(item.status);

  return (
    <Pagina
      titulo={`${item.make} ${item.model}`}
      bajada={KIND_LABELS[item.kind]}
      volver={{ href: "/mi-equipo", texto: "Mi equipo" }}
    >
      <div className="pila">
        <div className="acciones">
          <EstadoEquipo status={item.status} texto={STATUS_LABELS[item.status]} />
          <PlacaSerie value={item.serialRaw} />
        </div>
        {ok ? <Aviso tipo="exito">{ok}</Aviso> : null}
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
      </div>

      <section className="seccion" aria-labelledby="datos">
        <h2 id="datos">Datos</h2>
        <form action={guardarEquipo} className="superficie formulario">
          <input type="hidden" name="id" value={item.id} />
          <div className="formulario-dos">
            <Campo etiqueta="Tipo">
              <select className="control" name="kind" defaultValue={item.kind} required>
                {Object.entries(KIND_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </Campo>
            {estadoEditable ? (
              <Campo etiqueta="Estado">
                <select
                  className="control"
                  name="status"
                  defaultValue={item.status === "RECOVERED" ? "" : item.status}
                >
                  {item.status === "RECOVERED" ? (
                    <option value="">{STATUS_LABELS.RECOVERED} (sin cambios)</option>
                  ) : null}
                  {ESTADOS_EDITABLES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Campo>
            ) : null}
          </div>
          <div className="formulario-dos">
            <Campo etiqueta="Marca">
              <input className="control" name="make" defaultValue={item.make} required maxLength={80} />
            </Campo>
            <Campo etiqueta="Modelo">
              <input
                className="control"
                name="model"
                defaultValue={item.model}
                required
                maxLength={120}
              />
            </Campo>
          </div>
          <Campo etiqueta="Número de serie">
            <input
              className="control"
              name="serialRaw"
              defaultValue={item.serialRaw ?? ""}
              maxLength={80}
              autoComplete="off"
            />
          </Campo>
          <Campo etiqueta="Fecha de compra">
            <input
              className="control"
              name="purchaseDate"
              type="date"
              defaultValue={fechaInput(item.purchaseDate)}
            />
          </Campo>
          <div className="formulario-dos">
            <Campo etiqueta="Valor declarado en pesos">
              <input
                className="control"
                name="declaredValueArs"
                inputMode="numeric"
                defaultValue={item.declaredValueArs ?? ""}
              />
            </Campo>
            <Campo etiqueta="Valor declarado en dólares">
              <input
                className="control"
                name="declaredValueUsd"
                inputMode="numeric"
                defaultValue={item.declaredValueUsd ?? ""}
              />
            </Campo>
          </div>
          <Campo etiqueta="Notas">
            <textarea
              className="control control-texto"
              name="notes"
              defaultValue={item.notes ?? ""}
              maxLength={1000}
            />
          </Campo>
          <div className="acciones">
            <Boton>Guardar cambios</Boton>
          </div>
        </form>
      </section>

      <section className="seccion" aria-labelledby="fotos">
        <h2 id="fotos">Fotos del equipo</h2>
        {fotos.length === 0 ? <p className="texto-secundario">Todavía no hay fotos.</p> : null}
        {fotos.length > 0 ? (
          <div className="fotos">
            {fotos.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                className="foto"
                src={url}
                alt={`Foto ${i + 1} del equipo`}
                width={160}
                height={160}
              />
            ))}
          </div>
        ) : null}
        {item.photoKeys.length < 6 ? (
          <form action={subirFoto} className="superficie formulario">
            <input type="hidden" name="id" value={item.id} />
            <Campo etiqueta="Foto" ayuda="JPG, PNG o WEBP, hasta 4 MB. Máximo 6 fotos.">
              <input
                className="control-archivo"
                type="file"
                name="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
            </Campo>
            <div className="acciones">
              <Boton variante="secundario">Agregar foto</Boton>
            </div>
          </form>
        ) : (
          <p className="texto-secundario">Llegaste al máximo de 6 fotos.</p>
        )}
      </section>

      <section className="seccion" aria-labelledby="comprobante">
        <h2 id="comprobante">Comprobante de compra</h2>
        {comprobante ? (
          <p>
            <a href={comprobante} target="_blank" rel="noreferrer">
              Ver comprobante
            </a>{" "}
            <span className="texto-secundario">(el enlace vence en 15 minutos)</span>
          </p>
        ) : (
          <p className="texto-secundario">Todavía no cargaste el comprobante.</p>
        )}
        <form action={subirComprobante} className="superficie formulario">
          <input type="hidden" name="id" value={item.id} />
          <Campo etiqueta="Archivo del comprobante" ayuda="JPG, PNG, WEBP o PDF, hasta 4 MB.">
            <input
              className="control-archivo"
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required
            />
          </Campo>
          <div className="acciones">
            <Boton variante="secundario">
              {comprobante ? "Reemplazar comprobante" : "Subir comprobante"}
            </Boton>
          </div>
        </form>
      </section>

      {item.status === "IN_USE" || item.status === "FOR_SALE" || item.status === "RECOVERED" ? (
        <section className="seccion" aria-labelledby="robo">
          <h2 id="robo">Robo o pérdida</h2>
          <p className="texto-secundario">
            Si te lo robaron o lo perdiste, cargá la denuncia desde acá.
          </p>
          <div className="acciones">
            <BotonEnlace variante="peligro" href={`/mi-equipo/${item.id}/denunciar`}>
              Denunciar robo o pérdida
            </BotonEnlace>
          </div>
        </section>
      ) : null}
      {item.status === "STOLEN" || item.status === "LOST" ? (
        <section className="seccion" aria-labelledby="robo">
          <h2 id="robo">Robo o pérdida</h2>
          <p>Este equipo figura como {STATUS_LABELS[item.status].toLowerCase()}.</p>
          <form action={loRecupere}>
            <input type="hidden" name="id" value={item.id} />
            <Boton>Lo recuperé</Boton>
          </form>
        </section>
      ) : null}

      <section className="seccion" aria-labelledby="historial">
        <h2 id="historial">Historial</h2>
        <ul className="historial">
          {historial.map((e) => (
            <li key={e.id} className="historial-fila">
              <span className="historial-fecha">{fechaHoraAr(e.createdAt)}</span>
              <span>{EVENT_LABELS[e.type] ?? e.type}</span>
            </li>
          ))}
        </ul>
      </section>
    </Pagina>
  );
}
