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
import { guardarEquipo, loRecupere, subirComprobante, subirFoto } from "../actions";

export const dynamic = "force-dynamic";

const ESTADOS_EDITABLES = ["IN_USE", "FOR_SALE", "SOLD"] as const;

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
  const estadoEditable = (ESTADOS_EDITABLES as readonly string[]).includes(item.status);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <p>
        <a href="/mi-equipo">← Mi equipo</a>
      </p>
      <h1>
        {item.make} {item.model}
      </h1>
      <p>
        {KIND_LABELS[item.kind]} · {STATUS_LABELS[item.status]}
      </p>
      {ok ? <p role="status">{ok}</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      <section>
        <h2>Datos</h2>
        <form action={guardarEquipo} style={{ display: "grid", gap: 8 }}>
          <input type="hidden" name="id" value={item.id} />
          <label>
            Tipo
            <select name="kind" defaultValue={item.kind} required>
              {Object.entries(KIND_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {estadoEditable ? (
            <label>
              Estado
              <select name="status" defaultValue={item.status}>
                {ESTADOS_EDITABLES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Marca <input name="make" defaultValue={item.make} required maxLength={80} />
          </label>
          <label>
            Modelo <input name="model" defaultValue={item.model} required maxLength={120} />
          </label>
          <label>
            Número de serie{" "}
            <input name="serialRaw" defaultValue={item.serialRaw ?? ""} maxLength={80} />
          </label>
          <label>
            Fecha de compra{" "}
            <input name="purchaseDate" type="date" defaultValue={fechaInput(item.purchaseDate)} />
          </label>
          <label>
            Valor declarado en pesos{" "}
            <input
              name="declaredValueArs"
              inputMode="numeric"
              defaultValue={item.declaredValueArs ?? ""}
            />
          </label>
          <label>
            Valor declarado en dólares{" "}
            <input
              name="declaredValueUsd"
              inputMode="numeric"
              defaultValue={item.declaredValueUsd ?? ""}
            />
          </label>
          <label>
            Notas <textarea name="notes" defaultValue={item.notes ?? ""} maxLength={1000} />
          </label>
          <button type="submit">Guardar cambios</button>
        </form>
      </section>

      <section>
        <h2>Fotos del equipo</h2>
        {fotos.length === 0 ? <p>Todavía no hay fotos.</p> : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {fotos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt={`Foto ${i + 1} del equipo`} width={160} height={160} />
          ))}
        </div>
        {item.photoKeys.length < 6 ? (
          <form action={subirFoto}>
            <input type="hidden" name="id" value={item.id} />
            <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required />
            <button type="submit">Agregar foto</button>
            <p>JPG, PNG o WEBP, hasta 4 MB. Máximo 6 fotos.</p>
          </form>
        ) : (
          <p>Llegaste al máximo de 6 fotos.</p>
        )}
      </section>

      <section>
        <h2>Comprobante de compra</h2>
        {comprobante ? (
          <p>
            <a href={comprobante} target="_blank" rel="noreferrer">
              Ver comprobante
            </a>{" "}
            (el enlace vence en 15 minutos)
          </p>
        ) : (
          <p>Todavía no cargaste el comprobante.</p>
        )}
        <form action={subirComprobante}>
          <input type="hidden" name="id" value={item.id} />
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            required
          />
          <button type="submit">{comprobante ? "Reemplazar comprobante" : "Subir comprobante"}</button>
          <p>JPG, PNG, WEBP o PDF, hasta 4 MB.</p>
        </form>
      </section>

      {item.status === "IN_USE" || item.status === "FOR_SALE" || item.status === "RECOVERED" ? (
        <section>
          <h2>Robo o pérdida</h2>
          <p>
            <a href={`/mi-equipo/${item.id}/denunciar`}>Denunciar robo o pérdida</a>
          </p>
        </section>
      ) : null}
      {item.status === "STOLEN" || item.status === "LOST" ? (
        <section>
          <h2>Robo o pérdida</h2>
          <p>Este equipo figura como {STATUS_LABELS[item.status].toLowerCase()}.</p>
          <form action={loRecupere}>
            <input type="hidden" name="id" value={item.id} />
            <button type="submit">Lo recuperé</button>
          </form>
        </section>
      ) : null}

      <section>
        <h2>Historial</h2>
        <ul>
          {historial.map((e) => (
            <li key={e.id}>
              {fechaHoraAr(e.createdAt)} · {EVENT_LABELS[e.type] ?? e.type}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
