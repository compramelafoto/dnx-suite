export const metadata = { title: "Privacidad" };

/**
 * El contacto se lee del entorno al mostrar la página: así se puede cargar o cambiar la casilla
 * en Vercel sin tocar el código. No se escribe ningún correo personal en el código.
 */
export const dynamic = "force-dynamic";

export default function Privacidad() {
  const contacto = process.env.MUESTRAS_CONTACTO_EMAIL?.trim();
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 leading-relaxed sm:p-8">
      <h1 className="mf-titulo text-[2.45rem]">Privacidad</h1>
      <p>Guardamos tu nombre y tu email de Google para identificarte cuando proponés una actividad y para avisarte cuando la revisamos. No los compartimos con terceros.</p>
      <p>Tu cuenta es la misma cuenta de DNX Suite que se usa en FOTOFFICE y FotoRank: si ya entraste a alguna de esas plataformas, Muestras Fotográficas usa ese mismo usuario.</p>
      <p>Las actividades publicadas, sus fotos y los nombres de los organizadores y autores son públicos.</p>
      <h2 className="pt-2 text-xl font-medium">Pedir la baja de tus datos</h2>
      {contacto ? (
        <p>Escribinos a <a href={`mailto:${contacto}`} className="underline">{contacto}</a> y la tramitamos.</p>
      ) : (
        <p>Podés pedirla respondiendo cualquier correo que te haya llegado de Muestras Fotográficas, o contactando a la organización que opera DNX Suite.</p>
      )}
    </main>
  );
}
