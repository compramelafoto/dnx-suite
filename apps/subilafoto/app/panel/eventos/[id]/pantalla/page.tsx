import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { CopiarEnlace } from "./copiar";
import { eventoQueAdministra } from "@/lib/acceso-al-evento";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "http://localhost:3012"
  );
}

/**
 * El instructivo para proyectar, pensado para mandárselo al DJ o al iluminador.
 *
 * Es la pantalla que resuelve el momento más incómodo del evento: el fotógrafo llegando
 * al salón con la fiesta por empezar, teniendo que explicarle a alguien que nunca vio
 * esto cómo poner una página en pantalla completa en una computadora que no es suya.
 */
export default async function PantallaYProyeccion({ params }: Props) {
  const { id } = await params;

  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) redirect(`/login?next=${encodeURIComponent(`/panel/eventos/${id}/pantalla`)}`);

  const evento = await prisma.subilafotoEvent.findFirst({
    where: eventoQueAdministra(id, usuario.id),
    select: { name: true, screenCode: true },
  });
  if (!evento) notFound();

  const urlDePantalla = `${baseUrl()}/pantalla/${evento.screenCode}`;

  return (
    <main className="sobre-claro mx-auto max-w-2xl px-6 py-16">

      <h1 className="mt-4 text-3xl font-extrabold leading-tight">La pantalla del salón</h1>
      <p className="mt-3" style={{ color: "var(--slf-tinta-suave)" }}>
        Esta dirección es para el DJ o el iluminador, el que maneje la pantalla grande.
        No se la pases a los invitados: ellos usan el código QR.
      </p>

      <CopiarEnlace url={urlDePantalla} que="el enlace" />

      <section className="mt-12">
        <h2 className="text-lg font-extrabold">Cómo ponerla a pantalla completa</h2>

        <div className="mt-5 space-y-6">
          <div>
            <h3 className="font-extrabold">En Windows</h3>
            <ol
              className="mt-2 list-decimal space-y-1 pl-5"
              style={{ color: "var(--slf-tinta-suave)" }}
            >
              <li>Abrí la dirección en Chrome o Edge.</li>
              <li>
                Conectá el cable al proyector y apretá <strong>Windows + P</strong>.
                Elegí <strong>Duplicar</strong> si querés ver lo mismo en la notebook, o{" "}
                <strong>Extender</strong> si preferís trabajar en la pantalla chica.
              </li>
              <li>
                Con la ventana del navegador en la pantalla grande, apretá{" "}
                <strong>F11</strong>. Se va todo menos la foto.
              </li>
            </ol>
          </div>

          <div>
            <h3 className="font-extrabold">En Mac</h3>
            <ol
              className="mt-2 list-decimal space-y-1 pl-5"
              style={{ color: "var(--slf-tinta-suave)" }}
            >
              <li>Abrí la dirección en Chrome o Safari.</li>
              <li>
                Conectá el proyector. Si querés la misma imagen en las dos pantallas, andá
                a <strong>Ajustes del Sistema → Pantallas</strong> y elegí{" "}
                <strong>Duplicar</strong>.
              </li>
              <li>
                Con la ventana en la pantalla grande, apretá{" "}
                <strong>Control + Command + F</strong>.
              </li>
            </ol>
          </div>
        </div>

        {/*
          Esto no es un consejo de prolijidad: es la causa número uno de que la pantalla
          parezca colgada. Los navegadores frenan los temporizadores de las pestañas que
          no se ven, así que la rotación se detiene y las fotos dejan de pasar.
          Comprobado el 10/10/2026 midiendo la pantalla con el panel oculto: cien segundos
          sin que cambiara nada.
        */}
        <div
          className="mt-8 rounded-2xl p-5"
          style={{ background: "#FFF4E5", border: "1px solid #E0A458" }}
        >
          <p className="font-extrabold" style={{ color: "#7A4A08" }}>
            Dejala a pantalla completa y adelante toda la noche
          </p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "#7A4A08" }}>
            Si esa ventana queda tapada por otra, o la computadora apaga la pantalla, o
            entra el protector de pantalla, <strong>las fotos dejan de pasar</strong>. No
            es una falla nuestra: los navegadores frenan las pestañas que nadie está
            mirando. Al volver a la ventana se reanuda sola.
          </p>
          <ul className="mt-3 space-y-1 pl-5 text-sm" style={{ color: "#7A4A08" }}>
            <li>Dejá esa ventana adelante y a pantalla completa.</li>
            <li>Apagá el protector de pantalla y el suspender automático.</li>
            <li>
              Si tenés que hacer otra cosa en esa computadora, usá otra ventana en la
              pantalla chica, no encima de la proyección.
            </li>
          </ul>
          <p className="mt-3 text-sm" style={{ color: "#7A4A08" }}>
            Si en algún momento ves la pantalla clavada, esto es casi siempre el motivo.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-extrabold">Los controles son teclas</h2>
        <p className="mt-2" style={{ color: "var(--slf-tinta-suave)" }}>
          La pantalla no tiene botones a la vista: serían una barra gris proyectada en la
          pared toda la noche, al lado de las fotos. Se maneja desde el{" "}
          <strong>teclado de la computadora</strong> que está conectada al televisor.
        </p>

        <ul className="mt-5 space-y-3" style={{ color: "var(--slf-tinta-suave)" }}>
          <li>
            <strong>Barra espaciadora</strong> — pausa y reanuda. Deja fija la foto que
            está, para el brindis o cuando hay un momento que quieren dejar puesto un rato.
          </li>
          <li>
            <strong>Flecha derecha</strong> (o la tecla <strong>N</strong>) — pasa a la
            siguiente sin esperar.
          </li>
          <li>
            <strong>A</strong> — alterna entre pasar en orden y pasar al azar. Al azar no
            repite ninguna hasta que no hayan pasado todas.
          </li>
          <li>
            <strong>H</strong> — muestra los atajos en pantalla, por si te olvidaste.
          </li>
        </ul>

        <p className="mt-5 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
          Cada tecla muestra un cartelito abajo a la izquierda que confirma en qué quedó
          («En pausa», «Pasa al azar»). Es la única señal de que la tecla llegó, así que si
          apretás y no aparece nada, la computadora perdió el foco de la ventana: hacé un
          clic sobre la pantalla y probá de nuevo.
        </p>

        <p className="mt-3 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
          Si el televisor se maneja sólo con control remoto, sin teclado, la pantalla
          funciona igual sola —pasa las fotos e intercala el código QR— pero no vas a poder
          pausar ni adelantar.
        </p>

        <p className="mt-5 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
          Si la computadora se apaga o se recarga la página, vuelve sola a reproducir en
          orden. No queda en pausa por algo que alguien tocó hace dos horas.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-extrabold">Qué va a ver el salón</h2>
        <p className="mt-2" style={{ color: "var(--slf-tinta-suave)" }}>
          Las fotos van pasando de a una. Cada diez, la pantalla muestra el código QR
          grande para que se sumen los que van llegando. Si todavía no subió nadie, se
          queda con el código hasta que llegue la primera foto.
        </p>
        <p className="mt-3" style={{ color: "var(--slf-tinta-suave)" }}>
          Los emojis que mandan los invitados desde el celular suben por encima de la
          foto, con el contador arriba a la izquierda.
        </p>
      </section>
    </main>
  );
}
