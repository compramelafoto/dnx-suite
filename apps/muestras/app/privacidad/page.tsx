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
      <h2 className="pt-2 text-xl font-medium">Visitas y escaneos</h2>
      <p>Contamos cuántas veces se abre la página de cada muestra y de cada obra, y cuántas veces se escanean los códigos QR de la sala. Sólo guardamos totales por día: no guardamos tu IP, no usamos cookies y no sabemos quién sos.</p>
      <h2 className="pt-2 text-xl font-medium">Libro de visitas</h2>
      <p>Si dejás un comentario en el libro de visitas de una muestra, guardamos sólo lo que escribís: el comentario y, si los ponés, tu nombre y tu ciudad. Se publica en la página de la muestra y quien la organiza puede ocultarlo o borrarlo. No guardamos tu IP ni te pedimos cuenta.</p>
      <h2 className="pt-2 text-xl font-medium">Confirmación de asistencia</h2>
      <p>Si confirmás que vas a una inauguración, guardamos sólo lo que escribís: tu nombre, tu email si lo dejás y cuántas personas te acompañan. Lo ven únicamente quienes organizan esa muestra. No guardamos tu dirección IP. Borramos estos datos 30 días después de que termina la muestra; queda sólo la cantidad total de personas.</p>
      <h2 className="pt-2 text-xl font-medium">Equipo de una muestra</h2>
      <p>Si te invitan a organizar una muestra, el resto del equipo ve tu nombre y tu email.</p>
      <h2 className="pt-2 text-xl font-medium">Pedir la baja de tus datos</h2>
      {contacto ? (
        <p>Escribinos a <a href={`mailto:${contacto}`} className="underline">{contacto}</a> y la tramitamos.</p>
      ) : (
        <p>Podés pedirla respondiendo cualquier correo que te haya llegado de Muestras Fotográficas, o contactando a la organización que opera DNX Suite.</p>
      )}
    </main>
  );
}
