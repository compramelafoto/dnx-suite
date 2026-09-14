import Link from "next/link";
import { Archivo } from "next/font/google";
import { Check } from "lucide-react";
import { FotofficeLogo } from "@/components/fotoffice-logo";
import { ElegiTuCaso } from "./elegi-tu-caso";
import { EnlaceIngresar } from "./enlace-ingresar";
import { HojaDeContactos } from "./hoja-de-contactos";
import { IconoDe } from "./iconos";
import {
  BASE_DEL_SISTEMA,
  EN_CONSTRUCCION,
  MODULOS_DISPONIBLES,
  PASOS,
} from "@/lib/landing/catalogo";
import styles from "./landing.module.css";

/**
 * Archivo, de Omnibus-Type (Buenos Aires). Se usa sólo para los titulares de esta página: es
 * una grotesca de señalética, con la misma familia de formas que el logotipo. El texto corrido
 * sigue en Geist, la del panel, para que la portada y el sistema se lean como una sola cosa.
 */
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-archivo",
  display: "swap",
});

const CATALOGO = [...MODULOS_DISPONIBLES, ...BASE_DEL_SISTEMA];

/** Un renglón de lista con su ícono. Se usa en las dos puertas y en los cobros. */
function Punto({ icono, children }: { icono: string; children: React.ReactNode }) {
  return (
    <li>
      <span className={styles.listaIcono}>
        <IconoDe nombre={icono} size={13} />
      </span>
      <span>{children}</span>
    </li>
  );
}

export function FotofficeLanding({ dbUnavailable }: { dbUnavailable?: boolean }) {
  return (
    <div className={`${styles.pagina} ${archivo.variable}`}>
      <header className={styles.barra}>
        <div className={`${styles.ancho} ${styles.barraFila}`}>
          <Link href="/" className={styles.barraMarca} aria-label="FotOffice, inicio">
            <FotofficeLogo variant="compact" priority />
          </Link>
          <EnlaceIngresar className={`${styles.btn} ${styles.btnPrimario}`}>Entrar</EnlaceIngresar>
        </div>
      </header>

      <main>
        {dbUnavailable ? (
          <div className={styles.ancho} style={{ paddingTop: "20px" }} role="status">
            <p className={styles.heroPie}>
              La base de datos no responde. Podés leer esta página, pero el ingreso va a fallar
              hasta que vuelva.
            </p>
          </div>
        ) : null}

        <ElegiTuCaso>
        {/* ── Cómo funciona ── */}
        <section id="como-funciona" className={`${styles.seccion} ${styles.seccionBlanca}`}>
          <div className={styles.ancho}>
            <h2 className={styles.tituloSeccion}>Se arma en tres movimientos</h2>
            <p className={styles.textoSeccion}>
              No es un programa que se instala ni una planilla que alguien tiene que mantener.
              Entrás por el navegador, armás tu espacio y trabajás ahí.
            </p>
            <div className={styles.pasos}>
              {PASOS.map((paso) => (
                <article key={paso.numero} className={styles.paso}>
                  <div className={styles.pasoCabeza}>
                    <span className={styles.tile}>
                      <IconoDe nombre={paso.icono} size={22} />
                    </span>
                    <span className={styles.pasoNumero}>Paso {paso.numero}</span>
                  </div>
                  <h3 className={styles.pasoTitulo}>{paso.titulo}</h3>
                  <p className={styles.pasoTexto}>{paso.texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── La hoja de contactos: el catálogo entero ── */}
        <section id="modulos" className={`${styles.seccion} ${styles.seccionOscura}`}>
          <HojaDeContactos modulos={CATALOGO} />
        </section>

        {/* ── Las puertas hacia afuera ── */}
        <section id="afuera" className={`${styles.seccion} ${styles.seccionBlanca}`}>
          <div className={styles.ancho}>
            <h2 className={styles.tituloSeccion}>Tu gente no entra al panel: entra por su puerta</h2>
            <p className={styles.textoSeccion}>
              El panel es tuyo y de tu equipo. Para afuera hay dos puertas distintas, y cada una
              muestra únicamente lo que le corresponde a quien la cruza.
            </p>
            <div className={styles.dos}>
              <article className={styles.puerta}>
                <div className={styles.puertaCabeza}>
                  <span className={styles.tile}>
                    <IconoDe nombre="sitio" size={22} />
                  </span>
                  <h3 className={styles.puertaTitulo}>El sitio público</h3>
                </div>
                <p className={styles.puertaTexto}>
                  Abierto a cualquiera. Es donde alguien te conoce, mira tu trabajo y te pide un
                  precio. Lo armás vos por bloques y lo publicás cuando está listo: el borrador
                  se guarda solo y no se ve hasta que apretás publicar.
                </p>
                <ul className={styles.lista}>
                  <Punto icono="website">
                    Portada con varias imágenes que pasan solas, con el texto donde quieras.
                  </Punto>
                  <Punto icono="consultas">
                    Un formulario de presupuesto que cambia según lo que te pidan: una boda
                    pregunta por los novios y las tres fechas, unos XV por la quinceañera y el
                    salón.
                  </Punto>
                  <Punto icono="courses-sales">
                    Inscripción y pago de cursos sin salir del sitio.
                  </Punto>
                  <Punto icono="telefono">Botón que abre WhatsApp con el mensaje ya escrito.</Punto>
                  <Punto icono="members">
                    Solicitud de ingreso, si sos una institución que suma socios.
                  </Punto>
                </ul>
              </article>
              <article className={styles.puerta}>
                <div className={styles.puertaCabeza}>
                  <span className={styles.tile}>
                    <IconoDe nombre="telefono" size={22} />
                  </span>
                  <h3 className={styles.puertaTitulo}>El portal privado</h3>
                </div>
                <p className={styles.puertaTexto}>
                  Para los tuyos. El socio entra con su cuenta y encuentra lo suyo, sin llamar a
                  nadie ni esperar a que alguien le conteste el mail. Está pensado para el
                  teléfono, con las cuatro cosas más usadas en la barra de abajo.
                </p>
                <ul className={styles.lista}>
                  <Punto icono="carnets">
                    Su carnet, con el código que prueba que es socio y que está al día.
                  </Punto>
                  <Punto icono="membership-dues">
                    Qué debe, qué pagó y el botón para pagar en el momento.
                  </Punto>
                  <Punto icono="equipo">
                    Su perfil profesional: a qué se dedica y dónde se ve su trabajo.
                  </Punto>
                  <Punto icono="bookings">
                    Reservar el salón, el estudio o el coworking con su precio de socio.
                  </Punto>
                  <Punto icono="raffles">El sorteo del mes y los resultados de los anteriores.</Punto>
                  <Punto icono="verificado">
                    A quién recomendó y cuánto le bonificaron la cuota por eso.
                  </Punto>
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* ── Cobros ── */}
        <section id="cobros" className={styles.seccion}>
          <div className={styles.ancho}>
            <h2 className={styles.tituloSeccion}>El dinero va a tu cuenta</h2>
            <p className={styles.textoSeccion}>
              Conectás tu cuenta de Mercado Pago una sola vez y el sistema cobra por vos. El pago
              entra directo a esa cuenta: FOTOFFICE no se pone en el medio a guardar la plata de
              nadie. Cuando acredita, lo marca solo y queda pegado a lo que se pagó, así nadie
              tiene que ir a revisar si entró.
            </p>
            <div className={styles.dos}>
              <article className={styles.puerta}>
                <div className={styles.puertaCabeza}>
                  <span className={styles.tile}>
                    <IconoDe nombre="cobros" size={22} />
                  </span>
                  <h3 className={styles.puertaTitulo}>Qué se cobra desde adentro</h3>
                </div>
                <ul className={styles.lista}>
                  <Punto icono="membership-dues">
                    La cuota societaria, mes a mes, desde el portal del socio.
                  </Punto>
                  <Punto icono="bookings">
                    La reserva de un espacio y el equipamiento que va con ella.
                  </Punto>
                  <Punto icono="courses-sales">
                    La inscripción a un curso, en el mismo momento de anotarse.
                  </Punto>
                  <Punto icono="carnets">La emisión y la impresión de un carnet.</Punto>
                </ul>
              </article>
              <article className={styles.puerta}>
                <div className={styles.puertaCabeza}>
                  <span className={styles.tile}>
                    <IconoDe nombre="caja" size={22} />
                  </span>
                  <h3 className={styles.puertaTitulo}>Y lo que se cobra en mano</h3>
                </div>
                <p className={styles.puertaTexto}>
                  El efectivo y la transferencia se registran a mano y entran al mismo historial,
                  con la fecha real del pago. No hay dos verdades: la deuda de un socio es una
                  sola, se haya pagado por donde se haya pagado.
                </p>
                <ul className={styles.lista}>
                  <Punto icono="cash">Pagos a mano con su comprobante y quién los cargó.</Punto>
                  <Punto icono="membership-dues">
                    Historial por socio, sin borrar lo que ya pasó.
                  </Punto>
                  <Punto icono="verificado">
                    Todo cambio queda firmado: quién lo hizo y cuándo.
                  </Punto>
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* ── Lo que todavía no está ── */}
        <section className={`${styles.seccion} ${styles.seccionOscura}`}>
          <div className={styles.ancho}>
            <h2 className={styles.tituloSeccion}>Lo que todavía está sin revelar</h2>
            <p className={styles.textoSeccion}>
              Estos cuadros están en el rollo y todavía no se copiaron. Los mostramos porque es
              hacia dónde va el sistema, pero hoy no se pueden usar y no aparecen en el menú de
              nadie.
            </p>
          </div>
          <div className={styles.ancho} style={{ marginTop: "40px" }}>
            <div className={`${styles.tira} ${styles.hojaVelada}`}>
              <span className={styles.tiraBorde}>Fotoffice · sin revelar</span>
              <div className={styles.hoja}>
                {EN_CONSTRUCCION.map((m) => (
                  <article key={m.cuadro} className={styles.cuadro}>
                    <div className={styles.cuadroCabeza}>
                      <span className={`${styles.tile} ${styles.tileApagada}`}>
                        <IconoDe nombre={m.icono} size={22} />
                      </span>
                      <span className={styles.cuadroNumero}>{m.cuadro}</span>
                    </div>
                    <h3 className={styles.cuadroNombre}>{m.nombre}</h3>
                    <p className={styles.cuadroResuelve}>{m.resuelve}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Cierre ── */}
        <section className={styles.cierre}>
          <div className={styles.ancho}>
            <h2>Entrá y encendé el primero.</h2>
            <p className={styles.cierreTexto}>
              Con la cuenta que ya usás en el ecosistema DNX. Si todavía no la tenés, se crea al
              entrar con Google y tu espacio de trabajo queda armado en el mismo paso.
            </p>
            <div className={styles.heroAcciones}>
              <EnlaceIngresar className={`${styles.btn} ${styles.btnClaro}`}>
                <Check size={18} strokeWidth={2.6} aria-hidden />
                Entrar con mi cuenta
              </EnlaceIngresar>
            </div>
          </div>
        </section>
        </ElegiTuCaso>
      </main>

      <footer className={styles.pie}>
        <div className={`${styles.ancho} ${styles.pieFila}`}>
          <Link href="/terminos">Términos</Link>
          <Link href="/privacidad">Privacidad</Link>
          <span className={styles.pieNota}>FOTOFFICE es parte de DNX Suite.</span>
        </div>
      </footer>
    </div>
  );
}
