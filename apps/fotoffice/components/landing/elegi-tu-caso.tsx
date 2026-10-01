"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Check } from "lucide-react";
import styles from "./landing.module.css";
import { EnlaceIngresar } from "./enlace-ingresar";
import { IconoDe } from "./iconos";
import { BASE_DEL_SISTEMA, EN_CONSTRUCCION, MODULOS_DISPONIBLES } from "@/lib/landing/catalogo";
import { TIPOS, clavesDe, tipoPorId } from "@/lib/landing/tipos";

/**
 * Qué módulos le sirven a quien está mirando, para el resto de la página.
 *
 * El catálogo completo, más abajo, marca con el tilde los cuadros que le corresponden al tipo
 * elegido arriba. Sin esto habría dos selectores contestando la misma pregunta.
 */
const ClavesElegidas = createContext<ReadonlySet<string>>(new Set());

export function useClavesElegidas() {
  return useContext(ClavesElegidas);
}

const FICHAS = new Map(
  [...MODULOS_DISPONIBLES, ...BASE_DEL_SISTEMA].map((m) => [m.key, m] as const),
);

/**
 * La única pregunta con la que abre la portada.
 *
 * Hasta que no se contesta no se muestra nada más: quince módulos de entrada obligan a cada
 * visitante a descartar por su cuenta, y la mayoría abandona antes de terminar. Quien no quiera
 * contestar tiene la salida de «Prefiero ver todo el sistema» — nada queda detrás de la
 * pregunta, sólo ordenado detrás de ella.
 */
export function ElegiTuCaso({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const [verTodo, setVerTodo] = useState(false);
  const tipo = tipoPorId(id);
  const claves = useMemo(() => new Set(tipo ? clavesDe(tipo) : []), [tipo]);
  const abierto = tipo !== undefined || verTodo;

  return (
    <ClavesElegidas.Provider value={claves}>
      <section className={`${styles.pregunta} ${tipo ? styles.preguntaCompacta : ""}`}>
        <div className={styles.ancho}>
          {tipo ? (
            <div className={styles.elegido}>
              <button
                type="button"
                className={styles.volver}
                onClick={() => {
                  setId(null);
                  setVerTodo(false);
                }}
              >
                <ArrowLeft size={15} strokeWidth={2.2} aria-hidden />
                Cambiar
              </button>
              <span className={styles.elegidoLabel}>
                <span className={`${styles.tile} ${styles.tileChico}`}>
                  <IconoDe nombre={tipo.icono} size={17} />
                </span>
                {tipo.label}
              </span>
            </div>
          ) : (
            <>
              <p className={styles.preguntaMarca}>
                FOTOFFICE es el sistema para la parte del oficio que no es sacar fotos.
              </p>
              <h1 className={styles.preguntaTitulo}>
                ¿Qué tipo de negocio o institución fotográfica tenés?
              </h1>
              <p className={styles.preguntaBajada}>
                Elegí el tuyo y te muestro los módulos que más te van a servir, y por qué. El
                sistema tiene quince y ninguna organización usa los quince: se encienden los que
                hacen falta y el resto ni aparece en el menú.
              </p>

              <div className={styles.tipos}>
                {TIPOS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={styles.tipoCard}
                    onClick={() => {
                      setId(t.id);
                      setVerTodo(false);
                    }}
                  >
                    <span className={styles.tile}>
                      <IconoDe nombre={t.icono} size={22} />
                    </span>
                    <span className={styles.tipoLabel}>{t.label}</span>
                    <span className={styles.tipoResumen}>{t.resumen}</span>
                  </button>
                ))}
              </div>

              <div className={styles.escapes}>
                {verTodo ? null : (
                  <button
                    type="button"
                    className={styles.verTodo}
                    onClick={() => setVerTodo(true)}
                  >
                    Prefiero ver todo el sistema
                  </button>
                )}
                <EnlaceIngresar className={`${styles.btn} ${styles.btnSecundario}`}>
                  Ya tengo cuenta, entrar
                </EnlaceIngresar>
              </div>
            </>
          )}
        </div>
      </section>

      {tipo ? (
        <section className={`${styles.seccion} ${styles.seccionOscura}`} id="tu-combinacion">
          <div className={styles.ancho}>
            <h2 className={styles.tituloSeccion}>Para tu caso, arrancá por estos tres</h2>
            <p className={styles.textoSeccion}>{tipo.resumen}</p>

            <div className={styles.destacados}>
              {tipo.destacados.map((d, i) => {
                const ficha = FICHAS.get(d.key);
                if (!ficha) return null;
                return (
                  <article key={d.key} className={styles.destacado}>
                    <span className={styles.tilde}>
                      <Check size={17} strokeWidth={3.2} aria-hidden />
                    </span>
                    <div className={styles.cuadroCabeza}>
                      <span className={styles.tile}>
                        <IconoDe nombre={d.key} size={22} />
                      </span>
                      <span className={styles.cuadroNumero}>
                        {i + 1} de 3 · cuadro {ficha.cuadro}
                      </span>
                    </div>
                    <h3 className={styles.cuadroNombre}>{ficha.nombre}</h3>
                    <p className={styles.destacadoPorque}>{d.porque}</p>
                    <ul className={styles.cuadroPantallas}>
                      {ficha.pantallas.slice(0, 5).map((pantalla) => (
                        <li key={pantalla}>{pantalla}</li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>

            <h3 className={styles.subtitulo}>Y además tenés, si los querés</h3>
            <div className={styles.ademas}>
              {tipo.ademas.map((k) => {
                const ficha = FICHAS.get(k);
                if (!ficha) return null;
                return (
                  <a key={k} href={`#m-${k}`} className={styles.ademasItem}>
                    <span className={`${styles.tile} ${styles.tileChico}`}>
                      <IconoDe nombre={k} size={16} />
                    </span>
                    {ficha.nombre}
                  </a>
                );
              })}
            </div>

            <Proximo cuadro={tipo.proximo} />

            <div className={styles.heroAcciones}>
              <EnlaceIngresar className={`${styles.btn} ${styles.btnPrimario}`}>
                Entrar y encender el primero
              </EnlaceIngresar>
              <a href="#modulos" className={`${styles.btn} ${styles.btnFantasma}`}>
                Ver los quince cuadros
              </a>
            </div>
          </div>
        </section>
      ) : null}

      {abierto ? children : null}
    </ClavesElegidas.Provider>
  );
}

/** Lo que a este caso le va a interesar y todavía no existe. Se dice así, sin adornos. */
function Proximo({ cuadro }: { cuadro: string }) {
  const ficha = EN_CONSTRUCCION.find((m) => m.cuadro === cuadro);
  if (!ficha) return null;
  return (
    <div className={styles.proximo}>
      <span className={`${styles.tile} ${styles.tileChico} ${styles.tileApagada}`}>
        <IconoDe nombre={ficha.icono} size={16} />
      </span>
      <p>
        <strong>Todavía no: {ficha.nombre}.</strong> {ficha.resuelve}
      </p>
    </div>
  );
}
