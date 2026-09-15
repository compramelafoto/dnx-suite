"use client";

import { useActionState, useMemo, useState } from "react";
import { guardarPerfilAction, type EstadoDelPerfil } from "@/app/actions/perfil";
import { aCentavos } from "@/lib/perfil";
import { calcularVenta } from "@/lib/pagos/venta";
import { formatearPesos } from "@/lib/precios";

const ETIQUETA = "block text-sm font-extrabold";
const CAMPO =
  "mt-2 w-full rounded-xl border px-4 py-3 text-base outline-none focus:border-[var(--slf-violeta)]";
const BORDE = { borderColor: "var(--slf-borde)" };
const OPCIONAL = <span className="font-medium opacity-60">(opcional)</span>;

type Perfil = {
  slug: string;
  displayName: string;
  headline: string | null;
  description: string | null;
  logoUrl: string | null;
  brandColor: string | null;
  basePriceCents: number;
  termsText: string | null;
  isPublished: boolean;
  mpConnected: boolean;
};

/** De centavos al texto que se edita cómodo: "120000", no "120000.00". */
function aTexto(centavos: number): string {
  if (centavos <= 0) return "";
  return centavos % 100 === 0 ? String(centavos / 100) : (centavos / 100).toFixed(2).replace(".", ",");
}

export function FormularioPerfil({ perfil, enlace }: { perfil: Perfil; enlace: string }) {
  const [estado, accion, guardando] = useActionState<EstadoDelPerfil, FormData>(
    guardarPerfilAction,
    {},
  );
  const [precio, setPrecio] = useState(aTexto(perfil.basePriceCents));

  /*
    La cuenta se muestra mientras escribe, con la misma función que usa el servidor al
    cobrar. El fotógrafo tiene que ver lo que le queda **antes** de publicar: descubrirlo
    con la primera venta es la peor forma de enterarse de una comisión.
  */
  const cuentas = useMemo(() => {
    const centavos = aCentavos(precio);
    if (centavos === null) return null;
    try {
      return {
        sin: calcularVenta({ baseCents: centavos, conDescarga: false }),
        con: calcularVenta({ baseCents: centavos, conDescarga: true }),
      };
    } catch {
      return null;
    }
  }, [precio]);

  return (
    <form action={accion} className="mt-10 space-y-7">
      <div>
        <label htmlFor="displayName" className={ETIQUETA}>
          Nombre de tu estudio
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          defaultValue={perfil.displayName}
          className={CAMPO}
          style={BORDE}
        />
      </div>

      <div>
        <label htmlFor="headline" className={ETIQUETA}>
          Una línea que te describa {OPCIONAL}
        </label>
        <input
          id="headline"
          name="headline"
          defaultValue={perfil.headline ?? ""}
          placeholder="Fotografía de casamientos en Córdoba"
          className={CAMPO}
          style={BORDE}
        />
      </div>

      <div>
        <label htmlFor="precio" className={ETIQUETA}>
          Tu precio por evento
        </label>
        <input
          id="precio"
          name="precio"
          inputMode="decimal"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          placeholder="120000"
          className={CAMPO}
          style={BORDE}
        />

        <div
          className="mt-4 rounded-xl px-5 py-4 text-sm leading-relaxed"
          style={{ background: "var(--slf-purpura)", color: "var(--slf-lila)" }}
          aria-live="polite"
        >
          {cuentas ? (
            <>
              Tu cliente paga{" "}
              <strong className="text-white">{formatearPesos(cuentas.sin.totalCents)}</strong> y a
              vos te quedan{" "}
              <strong style={{ color: "var(--slf-amarillo)" }}>
                {formatearPesos(cuentas.sin.vendedorCents)}
              </strong>
              .
              <br />
              Con la descarga incluida paga{" "}
              <strong className="text-white">{formatearPesos(cuentas.con.totalCents)}</strong> y a
              vos te quedan{" "}
              <strong style={{ color: "var(--slf-amarillo)" }}>
                {formatearPesos(cuentas.con.vendedorCents)}
              </strong>{" "}
              — <em>lo mismo</em>. Incluirla no te quita nada.
            </>
          ) : (
            "Escribí tu precio y te muestro cuánto te queda."
          )}
        </div>
      </div>

      <div className="grid gap-7 sm:grid-cols-2">
        <div>
          <label htmlFor="logoUrl" className={ETIQUETA}>
            Dirección de tu logo {OPCIONAL}
          </label>
          <input
            id="logoUrl"
            name="logoUrl"
            defaultValue={perfil.logoUrl ?? ""}
            placeholder="https://…"
            className={CAMPO}
            style={BORDE}
          />
        </div>
        <div>
          <label htmlFor="brandColor" className={ETIQUETA}>
            Tu color {OPCIONAL}
          </label>
          <input
            id="brandColor"
            name="brandColor"
            defaultValue={perfil.brandColor ?? ""}
            placeholder="#7C2BFF"
            className={CAMPO}
            style={BORDE}
          />
        </div>
      </div>

      <div>
        <label htmlFor="descripcion" className={ETIQUETA}>
          Qué incluye tu servicio {OPCIONAL}
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={4}
          defaultValue={perfil.description ?? ""}
          className={CAMPO}
          style={BORDE}
        />
      </div>

      <div>
        <label htmlFor="termsText" className={ETIQUETA}>
          Tus condiciones {OPCIONAL}
        </label>
        <textarea
          id="termsText"
          name="termsText"
          rows={3}
          defaultValue={perfil.termsText ?? ""}
          className={CAMPO}
          style={BORDE}
        />
      </div>

      <div className="rounded-xl border p-5" style={BORDE}>
        <label className="flex gap-3 text-sm">
          <input
            type="checkbox"
            name="publicar"
            defaultChecked={perfil.isPublished}
            className="mt-1 h-5 w-5"
          />
          <span>
            <strong className="font-extrabold">Publicar mi enlace de venta.</strong>
            <span className="mt-1 block break-all" style={{ color: "var(--slf-tinta-suave)" }}>
              {enlace.replace(/^https?:\/\//, "")}
            </span>
          </span>
        </label>

        {!perfil.mpConnected ? (
          <p
            className="mt-4 rounded-lg px-4 py-3 text-sm"
            style={{ background: "#ffc46b22", color: "#7c4a03" }}
          >
            Todavía no conectaste Mercado Pago. Podés publicar igual, pero nadie va a poder
            pagarte hasta que lo conectes.
          </p>
        ) : null}
      </div>

      {estado.error ? (
        <p role="alert" className="text-sm font-extrabold" style={{ color: "#b00020" }}>
          {estado.error}
        </p>
      ) : estado.guardado ? (
        <p role="status" className="text-sm font-extrabold" style={{ color: "#14532d" }}>
          Guardado.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={guardando}
        className="rounded-xl px-7 py-4 font-extrabold text-white disabled:opacity-50"
        style={{ background: "var(--slf-violeta)", minHeight: "44px" }}
      >
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
