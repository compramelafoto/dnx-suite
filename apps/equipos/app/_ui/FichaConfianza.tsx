import type { TrustLevel } from "@/lib/publicaciones/confianza";
import { MedidorConfianza } from "./MedidorConfianza";
import { PlacaSerie } from "./PlacaSerie";

/** Las cifras leídas de metadatos van en la tipografía de la placa; el resto, en la de texto. */
function conCifras(texto: string) {
  return texto.split(/(\d[\d.,]*)/).map((parte, i) =>
    /^\d/.test(parte) ? (
      <span key={i} className="cifra">
        {parte}
      </span>
    ) : (
      parte
    ),
  );
}

/**
 * Lo comprobado por el portal y lo declarado por el vendedor, en listas separadas y con marcas
 * distintas: nunca se ven igual.
 */
export function FichaConfianza({
  level,
  verified,
  declared,
  shutterText,
  serialMasked,
}: {
  level: TrustLevel;
  verified: string[];
  declared: string[];
  shutterText: string | null;
  serialMasked: string | null;
}) {
  const disparosPendiente = shutterText ? /no verificad/i.test(shutterText) : false;

  return (
    <section className="ficha" aria-label="Ficha de confianza">
      <MedidorConfianza level={level} size="grande" />

      <div className="ficha-bloque">
        <h3 className="ficha-subtitulo">Comprobado por el portal</h3>
        {verified.length > 0 ? (
          <ul className="lista-comprobado">
            {verified.map((v) => (
              <li key={v} className="item-comprobado">
                <span className="marca-comprobado" aria-hidden="true">
                  ✔
                </span>
                <span>{v}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ficha-vacio">El portal todavía no comprobó ningún dato de este equipo.</p>
        )}
      </div>

      <div className="ficha-bloque">
        <h3 className="ficha-subtitulo">Declarado por el vendedor</h3>
        {declared.length > 0 ? (
          <ul className="lista-declarado">
            {declared.map((d) => (
              <li key={d} className="item-declarado">
                <span className="marca-declarado" aria-hidden="true">
                  □
                </span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ficha-vacio">El vendedor no declaró accesorios ni historia del equipo.</p>
        )}
      </div>

      {serialMasked || shutterText ? (
        <div className="ficha-bloque">
          <PlacaSerie value={serialMasked} />
          {shutterText ? (
            <p
              className={
                disparosPendiente ? "ficha-disparos ficha-disparos-pendiente" : "ficha-disparos"
              }
            >
              {conCifras(shutterText)}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
