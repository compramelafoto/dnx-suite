import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { contactoMailto } from "@/lib/contacto-publico";
import { getPortalUser } from "@/lib/guards";
import { Boton, Pagina } from "@/app/_ui";
import { MARCA } from "@/app/_ui/marca";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Cuenta suspendida — ${MARCA}` };

/**
 * Adonde manda `requireLevel` a una cuenta bloqueada. Usa `getPortalUser` (no `requireLevel`): si
 * no, una cuenta bloqueada volvería acá para siempre. Nunca muestra el motivo interno.
 */
export default async function CuentaBloqueadaPage() {
  const user = await getPortalUser();
  if (!user) redirect("/login");
  if (!user.blocked) redirect("/cuenta");

  const contacto = contactoMailto("Mi cuenta está suspendida");

  return (
    <Pagina titulo="Tu cuenta está suspendida">
      <div className="pila">
        <p>
          Suspendimos tu cuenta de {MARCA}. Mientras siga suspendida no podés publicar, contactar
          vendedores, comprar, vender ni pedir equipos, y tus publicaciones no se muestran en el
          catálogo.
        </p>
        <p>
          {contacto ? (
            <>
              Si creés que es un error, <a href={contacto}>escribinos</a> y lo revisamos.
            </>
          ) : (
            "Si creés que es un error, respondé el correo en el que te avisamos de la suspensión."
          )}
        </p>
        <form action="/api/auth/logout" method="post" className="acciones">
          <Boton variante="secundario">Cerrar sesión</Boton>
        </form>
      </div>
    </Pagina>
  );
}
