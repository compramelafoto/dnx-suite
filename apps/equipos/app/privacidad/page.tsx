import type { Metadata } from "next";
import { Aviso, Pagina } from "@/app/_ui";
import { MARCA } from "@/app/_ui/marca";

export const metadata: Metadata = { title: `Política de privacidad — ${MARCA}` };

/** Borrador de la política de privacidad: queda a la vista que falta la revisión legal. */
export default function PrivacidadPage() {
  return (
    <Pagina titulo="Política de privacidad" bajada="Qué datos guardamos, quién los ve y cómo los manejás.">
      <div className="pila">
        <Aviso tipo="revision">Borrador: este texto está pendiente de revisión legal.</Aviso>

        <section className="seccion" aria-labelledby="datos">
          <h2 id="datos">Qué datos guardamos</h2>
          <ul className="lista-texto">
            <li>Tu correo electrónico y tu teléfono.</li>
            <li>El resultado de la verificación de identidad y tu nombre legal.</li>
            <li>
              Del DNI, sólo un código cifrado (hash) y los últimos 3 dígitos, para evitar cuentas
              duplicadas.
            </li>
            <li>Los equipos, publicaciones, denuncias y consultas que cargás en el portal.</li>
          </ul>
          <p>
            Nunca guardamos las imágenes de tu DNI ni de tu cara: el proveedor de verificación las
            usa para comprobar tu identidad y a nosotros sólo nos llega el resultado.
          </p>
        </section>

        <section className="seccion" aria-labelledby="biometria">
          <h2 id="biometria">Consentimiento para la verificación biométrica</h2>
          <p>
            Para verificar tu identidad comparamos una selfie con la foto de tu DNI y con los datos
            del RENAPER. Lo hacemos sólo si das tu consentimiento expreso al empezar la
            verificación. Si no lo das, podés usar el portal sin verificarte, con funciones
            limitadas.
          </p>
        </section>

        <section className="seccion" aria-labelledby="quien">
          <h2 id="quien">Quién ve qué</h2>
          <ul className="lista-texto">
            <li>
              En una publicación se ve tu nombre de pila, la ciudad y los últimos caracteres del
              número de serie; nunca tu apellido, tu correo, tu teléfono ni la serie completa.
            </li>
            <li>
              Tu contacto (nombre, correo y teléfono) sólo lo ve un comprador con la identidad
              verificada que lo pidió, y vos te enterás de que lo pidió.
            </li>
            <li>
              Guardamos un registro de interesados: quién vio tu publicación y quién pidió tu
              contacto, para que lo veas en «Mis publicaciones» y para prevenir abusos.
            </li>
          </ul>
        </section>

        <section className="seccion" aria-labelledby="avisos">
          <h2 id="avisos">Avisos por correo</h2>
          <p>
            Te mandamos correos sobre tu cuenta, tu verificación, tus publicaciones, tus denuncias y
            las personas interesadas en tus equipos.
          </p>
        </section>

        <section className="seccion" aria-labelledby="base">
          <h2 id="base">Base compartida con CompraMeLaFoto</h2>
          <p>
            {MARCA} comparte la base de datos y la cuenta de usuario con CompraMeLaFoto. Por eso
            podemos mostrarte como sugerencia los equipos que aparecen en tus fotos publicadas allá
            y usar ese historial para el sello «Uso verificado».
          </p>
        </section>

        <section className="seccion" aria-labelledby="derechos">
          <h2 id="derechos">Tus derechos</h2>
          <p>
            Según la Ley 25.326 de Protección de Datos Personales, podés pedir acceso a tus datos,
            su rectificación y su supresión. La Agencia de Acceso a la Información Pública, como
            órgano de control, atiende las denuncias por incumplimientos.
          </p>
        </section>
      </div>
    </Pagina>
  );
}
