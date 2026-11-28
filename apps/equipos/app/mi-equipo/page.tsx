import { requireLevel } from "@/lib/guards";
import { KIND_LABELS, listItems, STATUS_LABELS } from "@/lib/inventario/equipos";
import { listSightingSuggestions } from "@/lib/inventario/sugerencias";
import { fechaAr } from "@/lib/inventario/formato";
import { agregarEquipo, esMio, noEsMio } from "./actions";

export const dynamic = "force-dynamic";

export default async function MiEquipoPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireLevel("identidad", "/mi-equipo");
  const { ok, error } = await searchParams;
  const [sugerencias, equipos] = await Promise.all([
    listSightingSuggestions(user.id),
    listItems(user.id),
  ]);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1>Mi equipo</h1>
      {ok ? <p role="status">{ok}</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      {sugerencias.length > 0 ? (
        <section>
          <h2>Equipos que vimos en tus fotos</h2>
          <p>
            CompraMeLaFoto detectó estos números de serie en las fotos que subiste. Confirmá cuáles son
            tuyos.
          </p>
          <ul>
            {sugerencias.map((s) => (
              <li key={s.sightingId} style={{ marginBottom: 12 }}>
                <strong>
                  {s.make} {s.model}
                </strong>{" "}
                ({KIND_LABELS[s.kind]}) · serie {s.serialRaw}
                <br />
                Visto en {s.photosCount} {s.photosCount === 1 ? "foto" : "fotos"}, entre{" "}
                {fechaAr(s.firstSeenAt)} y {fechaAr(s.lastSeenAt)}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <form action={esMio}>
                    <input type="hidden" name="sightingId" value={s.sightingId} />
                    <button type="submit">Es mío</button>
                  </form>
                  <form action={noEsMio}>
                    <input type="hidden" name="sightingId" value={s.sightingId} />
                    <button type="submit">No es mío</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2>Mis equipos</h2>
        {equipos.length === 0 ? (
          <p>Todavía no cargaste ningún equipo.</p>
        ) : (
          <ul>
            {equipos.map((e) => (
              <li key={e.id}>
                <a href={`/mi-equipo/${e.id}`}>
                  {e.make} {e.model}
                </a>{" "}
                · {KIND_LABELS[e.kind]} · {STATUS_LABELS[e.status]}
                {e.serialRaw ? ` · serie ${e.serialRaw}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Agregar equipo</h2>
        <form action={agregarEquipo} style={{ display: "grid", gap: 8 }}>
          <label>
            Tipo
            <select name="kind" defaultValue="BODY" required>
              {Object.entries(KIND_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Marca <input name="make" required maxLength={80} />
          </label>
          <label>
            Modelo <input name="model" required maxLength={120} />
          </label>
          <label>
            Número de serie <input name="serialRaw" maxLength={80} />
          </label>
          <label>
            Fecha de compra <input name="purchaseDate" type="date" />
          </label>
          <label>
            Valor declarado en pesos <input name="declaredValueArs" inputMode="numeric" />
          </label>
          <label>
            Valor declarado en dólares <input name="declaredValueUsd" inputMode="numeric" />
          </label>
          <label>
            Notas <textarea name="notes" maxLength={1000} />
          </label>
          <button type="submit">Agregar equipo</button>
        </form>
      </section>
    </main>
  );
}
