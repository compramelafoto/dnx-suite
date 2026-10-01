"use client";

import { Check } from "lucide-react";
import styles from "./landing.module.css";
import { EnlaceIngresar } from "./enlace-ingresar";
import { useClavesElegidas } from "./elegi-tu-caso";
import { IconoDe } from "./iconos";
import type { FichaModulo } from "@/lib/landing/catalogo";

/**
 * El catálogo entero, cuadro por cuadro.
 *
 * No vuelve a preguntar nada: marca con el tilde del logo lo que corresponde al tipo de
 * organización elegido arriba. Y nada se oculta — los módulos que no le sirven a este caso
 * siguen ahí, sin marcar, porque mañana puede necesitarlos.
 */
export function HojaDeContactos({ modulos }: { modulos: FichaModulo[] }) {
  const elegidas = useClavesElegidas();

  return (
    <>
      <div className={styles.ancho}>
        <h2 className={styles.tituloSeccion}>Todo lo que hace, cuadro por cuadro</h2>
        <p className={styles.textoSeccion}>
          Los quince módulos del sistema, sin recortar. Si elegiste tu caso arriba, los que te
          sirven están marcados.
        </p>
      </div>

      <div className={styles.ancho} style={{ marginTop: "40px" }}>
        <div className={styles.tira}>
          <span className={styles.tiraBorde}>Fotoffice · módulos y base</span>
          <div className={styles.hoja}>
            {modulos.map((m) => {
              const marcado = elegidas.has(m.key);
              return (
                <article
                  key={m.key}
                  id={`m-${m.key}`}
                  className={`${styles.cuadro} ${marcado ? styles.cuadroMarcado : ""}`}
                >
                  <span className={styles.tilde}>
                    <Check size={17} strokeWidth={3.2} aria-hidden />
                  </span>
                  <div className={styles.cuadroCabeza}>
                    <span className={styles.tile}>
                      <IconoDe nombre={m.key} size={22} />
                    </span>
                    <span className={styles.cuadroNumero}>{m.cuadro}</span>
                  </div>
                  <h3 className={styles.cuadroNombre}>{m.nombre}</h3>
                  <p className={styles.cuadroResuelve}>{m.resuelve}</p>
                  <ul className={styles.cuadroPantallas}>
                    {m.pantallas.map((pantalla) => (
                      <li key={pantalla}>{pantalla}</li>
                    ))}
                  </ul>
                </article>
              );
            })}

            <div className={styles.cta}>
              <div className={styles.ctaCopy}>
                <h3 className={styles.ctaTitulo}>¿Tu caso no es ninguno de los siete?</h3>
                <p className={styles.ctaTexto}>
                  Entrá y prendé un módulo. Se apaga igual de fácil, y nada de lo que cargues se
                  pierde por apagarlo.
                </p>
              </div>
              <EnlaceIngresar className={`${styles.btn} ${styles.btnPrimario}`}>
                Entrar con mi cuenta
              </EnlaceIngresar>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
