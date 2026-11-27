import type { Metadata } from "next";
import { AVISOS_ERROR, AVISOS_OK, avisoDeCodigo } from "@/lib/avisos";
import { knownModels } from "@/lib/busco/modelo";
import { getRequestMatches } from "@/lib/busco/pedidos";
import { requireLevel } from "@/lib/guards";
import { KIND_LABELS } from "@/lib/inventario/equipos";
import { CONDITION_LABELS, PROVINCIAS } from "@/lib/publicaciones/catalogos";
import { Aviso, Boton, BotonEnlace, Campo, Pagina } from "@/app/_ui";
import { MARCA } from "@/app/_ui/marca";
import { TarjetaEquipo } from "@/app/equipos/TarjetaEquipo";
import { crearPedido } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Nuevo pedido — ${MARCA}` };

export default async function NuevoPedidoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; creado?: string }>;
}) {
  const user = await requireLevel("identidad", "/busco/nuevo");
  const sp = await searchParams;
  const error = avisoDeCodigo(AVISOS_ERROR, sp.error);

  // Recién creado y con publicaciones que ya coinciden: se muestran en vez del formulario.
  const creado = sp.creado ? await getRequestMatches(user.id, Number(sp.creado)) : null;
  if (creado) {
    return (
      <Pagina
        titulo={
          creado.matches.length > 0 ? "Ya hay equipos publicados como el que buscás" : "Pedido guardado"
        }
        bajada={`${creado.make} ${creado.model}`}
        ancho="ancha"
        volver={{ href: "/busco", texto: "Mis pedidos" }}
      >
        <div className="pila">
          <Aviso tipo="exito">{AVISOS_OK.PEDIDO_CREADO}</Aviso>
          {creado.matches.length > 0 ? (
            <ul className="resultados-lista">
              {creado.matches.map((l) => (
                <TarjetaEquipo key={l.id} l={l} />
              ))}
            </ul>
          ) : (
            <p className="texto-secundario">Por ahora no hay publicaciones de ese modelo.</p>
          )}
          <div className="acciones">
            <BotonEnlace variante="secundario" href="/busco">
              Ver mis pedidos
            </BotonEnlace>
          </div>
        </div>
      </Pagina>
    );
  }

  const modelos = await knownModels();
  const marcas = [...new Set(modelos.map((m) => m.make))];
  const nombresModelo = [...new Set(modelos.map((m) => m.model))];

  return (
    <Pagina
      titulo="Nuevo pedido"
      bajada="Contanos qué equipo buscás. Si alguien lo tiene en su inventario, le avisamos sin decirte quién es. Esa persona ve tu nombre verificado sólo si responde que le interesa vender."
      volver={{ href: "/busco", texto: "Mis pedidos" }}
    >
      <div className="pila">
        {error ? <Aviso tipo="error">{error}</Aviso> : null}

        <form action={crearPedido} className="superficie formulario">
          <Campo etiqueta="Tipo de equipo">
            <select className="control" name="kind" defaultValue="" required>
              <option value="" disabled>
                Elegí una opción
              </option>
              {Object.entries(KIND_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Campo>
          <div className="formulario-dos">
            <Campo etiqueta="Marca">
              <input
                className="control"
                name="make"
                list="busco-marcas"
                maxLength={60}
                autoComplete="off"
                placeholder="Canon, Nikon, Sony, Fujifilm"
                required
              />
            </Campo>
            <Campo etiqueta="Modelo">
              <input
                className="control"
                name="model"
                list="busco-modelos"
                maxLength={120}
                autoComplete="off"
                required
              />
            </Campo>
          </div>
          <datalist id="busco-marcas">
            {marcas.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <datalist id="busco-modelos">
            {nombresModelo.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>

          <div className="formulario-dos">
            <Campo etiqueta="Precio máximo en pesos (opcional)" ayuda="Un número entero, sin centavos.">
              <input className="control" name="maxPriceArs" inputMode="numeric" />
            </Campo>
            <Campo etiqueta="Estado mínimo (opcional)">
              <select className="control" name="minCondition" defaultValue="">
                <option value="">Cualquiera</option>
                {Object.entries(CONDITION_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <Campo
            etiqueta="Tu provincia (opcional)"
            ayuda="Dónde lo buscás. Se la mostramos a quien tenga el equipo."
          >
            <select className="control" name="province" defaultValue="">
              <option value="">Sin indicar</option>
              {PROVINCIAS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Campo>

          <div className="acciones">
            <Boton>Crear pedido</Boton>
            <BotonEnlace variante="secundario" href="/busco">
              Cancelar
            </BotonEnlace>
          </div>
        </form>
      </div>
    </Pagina>
  );
}
