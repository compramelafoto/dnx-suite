import type { Metadata } from "next";
import { Aviso, Pagina } from "@/app/_ui";
import { MARCA } from "@/app/_ui/marca";

export const metadata: Metadata = {
  title: `Términos y condiciones — ${MARCA}`,
};

/** Borrador de los términos: queda a la vista que falta la revisión legal. */
export default function TerminosPage() {
  return (
    <Pagina
      titulo="Términos y condiciones"
      bajada={`Las reglas para usar ${MARCA}.`}
    >
      <div className="pila">
        <Aviso tipo="revision">
          Borrador: este texto está pendiente de revisión legal.
        </Aviso>

        <section className="seccion" aria-labelledby="que-es">
          <h2 id="que-es">Qué es {MARCA}</h2>
          <p>
            {MARCA} es un portal de equipos fotográficos usados: cámaras,
            lentes, flashes y accesorios. Cualquier persona puede mirar el
            catálogo; para publicar y para contactar a quien vende hace falta
            tener la identidad verificada. El portal pone en contacto a quien
            vende con quien compra; no compra ni vende equipos por su cuenta.
          </p>
        </section>

        <section className="seccion" aria-labelledby="identidad">
          <h2 id="identidad">Qué significa «Identidad verificada»</h2>
          <p>
            «Identidad verificada» significa que sabemos quién es la persona:
            validamos su DNI, una selfie y los datos del RENAPER. No significa
            que la operación esté garantizada. El portal no garantiza el estado
            del equipo, que la entrega se concrete ni el pago.
          </p>
        </section>

        <section className="seccion" aria-labelledby="pago">
          <h2 id="pago">Pago y entrega</h2>
          <p>
            El pago y la entrega se arreglan entre las partes. Antes de pagar,
            revisá el equipo en persona, probalo y comprobá que el número de
            serie coincida con el de la publicación.
          </p>
        </section>

        <section className="seccion" aria-labelledby="prohibido">
          <h2 id="prohibido">Qué no se puede publicar</h2>
          <ul className="lista-texto">
            <li>Equipos que no son tuyos.</li>
            <li>
              Equipos robados o perdidos, o con una denuncia activa en el
              portal.
            </li>
            <li>
              Datos falsos sobre el equipo, su estado o su número de serie.
            </li>
          </ul>
        </section>

        <section className="seccion" aria-labelledby="moderacion">
          <h2 id="moderacion">Revisión y bajas</h2>
          <p>
            El portal puede pasar una publicación a revisión, pedir más datos o
            darla de baja, por ejemplo si el número de serie tiene una denuncia
            activa, si otra persona la reporta o si no cumple estas reglas.
            Mientras está en revisión, la publicación no se muestra.
          </p>
        </section>

        <section className="seccion" aria-labelledby="costo">
          <h2 id="costo">Costo</h2>
          <p>Publicar en {MARCA} es gratis.</p>
        </section>
      </div>
    </Pagina>
  );
}
