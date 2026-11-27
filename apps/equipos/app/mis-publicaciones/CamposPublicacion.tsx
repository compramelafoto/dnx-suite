import { Campo } from "@/app/_ui";
import { CONDITION_LABELS, MONTURAS, PROVINCIAS } from "@/lib/publicaciones/catalogos";

export type ValoresPublicacion = {
  priceArs?: number | null;
  priceUsdRef?: number | null;
  condition?: string;
  province?: string;
  city?: string;
  mount?: string | null;
  description?: string | null;
  accessories?: string | null;
  declaredFirstOwner?: boolean;
  includesCharger?: boolean;
  includesManual?: boolean;
  includesBox?: boolean;
  batteriesCount?: number | null;
};

/** Campos comunes de publicar y editar. No hay ningún campo de cantidad de disparos. */
export function CamposPublicacion({
  valores = {},
  conMontura,
}: {
  valores?: ValoresPublicacion;
  /** Sólo cámaras y lentes tienen montura. */
  conMontura: boolean;
}) {
  return (
    <>
      <div className="formulario-dos">
        <Campo etiqueta="Precio en pesos" ayuda="Un número entero, sin centavos.">
          <input
            className="control"
            name="priceArs"
            inputMode="numeric"
            defaultValue={valores.priceArs ?? ""}
            required
          />
        </Campo>
        <Campo etiqueta="Referencia en dólares (opcional)">
          <input
            className="control"
            name="priceUsdRef"
            inputMode="numeric"
            defaultValue={valores.priceUsdRef ?? ""}
          />
        </Campo>
      </div>
      <div className="formulario-dos">
        <Campo etiqueta="Estado del equipo">
          <select className="control" name="condition" defaultValue={valores.condition ?? ""} required>
            <option value="" disabled>
              Elegí una opción
            </option>
            {Object.entries(CONDITION_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Campo>
        {conMontura ? (
          <Campo etiqueta="Montura">
            <select className="control" name="mount" defaultValue={valores.mount ?? ""}>
              <option value="">Sin indicar</option>
              {MONTURAS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Campo>
        ) : null}
      </div>
      <div className="formulario-dos">
        <Campo etiqueta="Provincia">
          <select className="control" name="province" defaultValue={valores.province ?? ""} required>
            <option value="" disabled>
              Elegí una provincia
            </option>
            {PROVINCIAS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Ciudad">
          <input className="control" name="city" defaultValue={valores.city ?? ""} required maxLength={80} />
        </Campo>
      </div>
      <Campo etiqueta="Descripción">
        <textarea
          className="control control-texto"
          name="description"
          defaultValue={valores.description ?? ""}
          maxLength={2000}
        />
      </Campo>
      <Campo etiqueta="Accesorios incluidos">
        <input
          className="control"
          name="accessories"
          defaultValue={valores.accessories ?? ""}
          maxLength={500}
        />
      </Campo>

      <fieldset className="grupo pila">
        <legend className="campo-etiqueta">Qué incluye</legend>
        <p className="campo-ayuda">
          Esto lo declarás vos; en la publicación se muestra como declarado por el vendedor.
        </p>
        <label className="opcion">
          <input type="checkbox" name="declaredFirstOwner" defaultChecked={valores.declaredFirstOwner} />
          <span className="opcion-texto">Soy el primer dueño</span>
        </label>
        <label className="opcion">
          <input type="checkbox" name="includesCharger" defaultChecked={valores.includesCharger} />
          <span className="opcion-texto">Incluye cargador</span>
        </label>
        <label className="opcion">
          <input type="checkbox" name="includesManual" defaultChecked={valores.includesManual} />
          <span className="opcion-texto">Incluye manual</span>
        </label>
        <label className="opcion">
          <input type="checkbox" name="includesBox" defaultChecked={valores.includesBox} />
          <span className="opcion-texto">Incluye caja original</span>
        </label>
        <Campo etiqueta="Cantidad de baterías">
          <input
            className="control"
            name="batteriesCount"
            inputMode="numeric"
            defaultValue={valores.batteriesCount ?? ""}
          />
        </Campo>
      </fieldset>
    </>
  );
}
