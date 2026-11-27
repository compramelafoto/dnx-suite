import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicListing } from "@/lib/catalogo/buscar";
import { contactedBefore, contactSeller, ContactoError } from "@/lib/contacto/contactar";
import { textoDeAviso } from "@/lib/contacto/avisos";
import { requireLevel } from "@/lib/guards";
import { Aviso, Boton, GuiaCompraSegura, Pagina } from "@/app/_ui";
import { MARCA } from "@/app/_ui/marca";
import { contactarVendedor } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Contactar al vendedor — ${MARCA}` };

export default async function ContactarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const user = await requireLevel("identidad", `/equipos/${id}/contactar`);
  const { error } = await searchParams;

  const listing = await getPublicListing(id);
  if (!listing) notFound();
  const titulo = `${listing.make} ${listing.model}`;

  // Si ya contactó, mostramos los datos sin volver a avisar al vendedor (`firstTime: false`).
  let aviso = textoDeAviso(error);
  let datos: Awaited<ReturnType<typeof contactSeller>> | null = null;
  if (await contactedBefore(user.id, id)) {
    try {
      datos = await contactSeller({ id: user.id, displayName: user.displayName }, id);
    } catch (err) {
      aviso =
        err instanceof ContactoError ? err.message : "No pudimos mostrar los datos. Probá de nuevo.";
    }
  }

  const telefono = datos?.sellerPhone?.replace(/\D/g, "") ?? "";
  const texto = encodeURIComponent(`Hola, vi tu ${titulo} en ${MARCA}.`);

  return (
    <Pagina
      titulo="Contactar al vendedor"
      bajada={titulo}
      volver={{ href: `/equipos/${id}`, texto: "Volver a la publicación" }}
    >
      <div className="pila">
        {aviso ? <Aviso tipo="error">{aviso}</Aviso> : null}

        {datos ? (
          <>
            <section className="superficie" aria-labelledby="datos-vendedor">
              <h2 id="datos-vendedor">Datos del vendedor</h2>
              <dl className="documento-datos">
                <dt>Nombre</dt>
                <dd>{datos.sellerName}</dd>
                <dt>Correo</dt>
                <dd>
                  <a href={`mailto:${datos.sellerEmail}`}>{datos.sellerEmail}</a>
                </dd>
                {telefono ? (
                  <>
                    <dt>WhatsApp</dt>
                    <dd>
                      <a href={`https://wa.me/${telefono}?text=${texto}`}>{datos.sellerPhone}</a>
                    </dd>
                  </>
                ) : null}
              </dl>
            </section>
            <GuiaCompraSegura />
          </>
        ) : (
          <section className="superficie" aria-labelledby="contactar-titulo">
            <h2 id="contactar-titulo">Antes de seguir</h2>
            <p>
              Le avisamos al vendedor que te interesa, con tu nombre verificado, y te mostramos su
              correo y WhatsApp.
            </p>
            <form action={contactarVendedor} className="acciones">
              <input type="hidden" name="id" value={id} />
              <Boton>Ver datos del vendedor</Boton>
            </form>
          </section>
        )}
      </div>
    </Pagina>
  );
}
