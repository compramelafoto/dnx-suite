"use client";

import { useActionState } from "react";
import { Aviso, Boton, Campo } from "@/app/_ui";
import { consultarSerie, type ConsultaEstado } from "./actions";

const TEXTOS = {
  SIN_DENUNCIA:
    "Este número de serie no figura con denuncias activas en el portal. Igual revisá el equipo en persona antes de comprarlo.",
  CON_DENUNCIA: "Este número de serie figura con una denuncia activa.",
  CON_DENUNCIA_SIN_CONTACTO: "Guardá este número de serie y no concretes la compra.",
  SERIE_INVALIDA: "Escribí el número de serie completo (al menos 4 caracteres).",
  LIMITE: "Llegaste al máximo de consultas por hoy. Probá mañana.",
} as const;

/** `contacto`: el `mailto:` de MercadoFotoRaw, o `null` si no hay correo configurado. */
export function FormularioSerie({ contacto }: { contacto: string | null }) {
  const [estado, accion, pendiente] = useActionState<ConsultaEstado, FormData>(
    consultarSerie,
    null,
  );
  const error = estado && "error" in estado ? estado.error : null;

  return (
    <div className="pila">
      <form action={accion} className="formulario">
        <Campo
          etiqueta="Número de serie"
          ayuda="Lo encontrás grabado en el cuerpo del equipo o en la caja."
          error={error === "SERIE_INVALIDA" ? TEXTOS.SERIE_INVALIDA : undefined}
        >
          <input
            className="control"
            name="serie"
            type="text"
            autoComplete="off"
            required
            maxLength={100}
          />
        </Campo>
        <div>
          <Boton disabled={pendiente}>{pendiente ? "Consultando…" : "Consultar serie"}</Boton>
        </div>
      </form>

      {error === "LIMITE" ? <Aviso tipo="revision">{TEXTOS.LIMITE}</Aviso> : null}

      {estado && "result" in estado ? (
        <>
          <p className="texto-secundario">
            Consultaste: <strong>{estado.serial}</strong>
          </p>
          {estado.result === "CON_DENUNCIA" ? (
            <Aviso tipo="error">
              {TEXTOS.CON_DENUNCIA}{" "}
              {contacto ? (
                <>
                  No lo compres y <a href={contacto}>escribinos</a>.
                </>
              ) : (
                TEXTOS.CON_DENUNCIA_SIN_CONTACTO
              )}
            </Aviso>
          ) : (
            <Aviso tipo="exito">{TEXTOS.SIN_DENUNCIA}</Aviso>
          )}
        </>
      ) : null}
    </div>
  );
}
