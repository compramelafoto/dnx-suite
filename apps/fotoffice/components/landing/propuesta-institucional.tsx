import { Check } from "lucide-react";
import styles from "./landing.module.css";
import { IconoDe } from "./iconos";
import { MODULOS_DE_LA_SUITE } from "@/lib/landing/catalogo";
import { PARA_LA_COMISION, PUNTOS_INSTITUCIONALES } from "@/lib/landing/instituciones";

/**
 * La propuesta para una institución, dentro de la respuesta a «¿qué sos?».
 *
 * Va después de los tres destacados: aquéllos dicen por dónde empezar, esto dice todo lo que
 * la comisión deja de hacer a mano, incluidos los concursos y las muestras que viven en otras
 * aplicaciones de DNX Suite. Lo que todavía no existe se dice en la misma tarjeta.
 */
export function PropuestaInstitucional() {
  return (
    <div className={styles.propuesta} id="propuesta-institucional">
      <h2 className={styles.tituloSeccion}>Lo que la comisión deja de hacer a mano</h2>
      <p className={styles.textoSeccion}>
        FOTOFFICE es el sistema de gestión de DNX Suite para instituciones fotográficas. Junta en un
        solo lugar lo que hoy está repartido entre planillas, transferencias y grupos de WhatsApp,
        y le suma lo que las otras aplicaciones de la suite hacen por los socios.
      </p>

      <ul className={styles.paraComision}>
        {PARA_LA_COMISION.map((linea) => (
          <li key={linea}>
            <Check size={16} strokeWidth={3} aria-hidden />
            <span>{linea}</span>
          </li>
        ))}
      </ul>

      <div className={styles.puntos}>
        {PUNTOS_INSTITUCIONALES.map((p) => (
          <article key={p.id} className={styles.punto} id={`p-${p.id}`}>
            <h3 className={styles.puntoTitulo}>{p.titulo}</h3>
            <p className={styles.puntoTexto}>{p.texto}</p>
            {p.pendiente ? (
              <p className={styles.puntoPendiente}>
                <strong>Todavía no:</strong> {p.pendiente}
              </p>
            ) : null}
          </article>
        ))}
      </div>

      <h3 className={styles.subtitulo}>También incluidos: concursos y muestras de DNX Suite</h3>
      <div className={styles.dos}>
        {MODULOS_DE_LA_SUITE.map((m) => (
          <article key={m.key} className={styles.destacado}>
            <span className={styles.tilde}>
              <Check size={17} strokeWidth={3.2} aria-hidden />
            </span>
            <div className={styles.cuadroCabeza}>
              <span className={styles.tile}>
                <IconoDe nombre={m.key} size={22} />
              </span>
              <span className={styles.cuadroNumero}>
                {m.app} · {m.dominio}
              </span>
            </div>
            <h3 className={styles.cuadroNombre}>{m.nombre}</h3>
            <p className={styles.destacadoPorque}>{m.resuelve}</p>
            <ul className={styles.cuadroPantallas}>
              {m.pantallas.map((pantalla) => (
                <li key={pantalla}>{pantalla}</li>
              ))}
            </ul>
            {m.pendiente ? (
              <p className={styles.puntoPendienteClaro}>
                <strong>Todavía no:</strong> {m.pendiente}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
