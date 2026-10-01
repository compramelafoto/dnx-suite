"use client";

import { useActionState } from "react";
import { enviarFichaDeProveedorAction, type EstadoFicha } from "@/app/actions/proveedores";
import { nombreDeCategoria, type Categoria } from "@/lib/proveedores/categorias";

const ETIQUETA = "block text-sm font-extrabold";
const CAMPO =
  "mt-2 w-full rounded-xl border px-4 py-3 text-base outline-none focus:border-[var(--slf-violeta)]";
const BORDE = { borderColor: "var(--slf-borde)" };
const OPCIONAL = <span className="font-medium opacity-60">(opcional)</span>;

export function FormularioProveedor({
  token,
  categorias,
  categoriaFija,
}: {
  token: string;
  categorias: readonly Categoria[];
  /** Si el enlace es de un rubro, viene acá y no se pregunta. */
  categoriaFija: string | null;
}) {
  const [estado, accion, enviando] = useActionState<EstadoFicha, FormData>(
    enviarFichaDeProveedorAction,
    {},
  );

  if (estado.listo) {
    return (
      <div
        className="mt-10 rounded-2xl border p-8"
        style={{ ...BORDE, background: "white" }}
        role="status"
      >
        <p className="text-xl font-extrabold">Listo, quedaste registrado.</p>
        <p className="mt-3" style={{ color: "var(--slf-tinta-suave)" }}>
          {estado.yaEstaba
            ? "Tu empresa ya figuraba en este evento, así que completamos lo que faltaba."
            : "Tu empresa quedó vinculada a este evento."}
        </p>
      </div>
    );
  }

  return (
    <form action={accion} className="mt-10 space-y-7">
      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="nombre" className={ETIQUETA}>
          Nombre de tu empresa
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          minLength={2}
          placeholder="Salón Luna"
          className={CAMPO}
          style={BORDE}
        />
      </div>

      {categoriaFija ? (
        <p className="text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
          Te anotamos como <strong>{nombreDeCategoria(categoriaFija)}</strong>. Si no es lo
          tuyo, pedile a quien te pasó el enlace el que corresponde.
        </p>
      ) : (
        <div>
          <label htmlFor="categoria" className={ETIQUETA}>
            ¿A qué te dedicás?
          </label>
          <select id="categoria" name="categoria" required className={CAMPO} style={BORDE}>
            <option value="">Elegí una</option>
            {categorias.map((c) => (
              <option key={c.clave} value={c.clave}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-7 sm:grid-cols-2">
        <div>
          <label htmlFor="contactoNombre" className={ETIQUETA}>
            Tu nombre
          </label>
          <input id="contactoNombre" name="contactoNombre" className={CAMPO} style={BORDE} />
        </div>
        <div>
          <label htmlFor="contactoRol" className={ETIQUETA}>
            Tu rol {OPCIONAL}
          </label>
          <input
            id="contactoRol"
            name="contactoRol"
            placeholder="Dueño, encargada…"
            className={CAMPO}
            style={BORDE}
          />
        </div>
      </div>

      <div className="grid gap-7 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className={ETIQUETA}>
            Email
          </label>
          <input id="email" name="email" type="email" className={CAMPO} style={BORDE} />
        </div>
        <div>
          <label htmlFor="whatsapp" className={ETIQUETA}>
            WhatsApp
          </label>
          <input id="whatsapp" name="whatsapp" type="tel" className={CAMPO} style={BORDE} />
        </div>
      </div>

      <div className="grid gap-7 sm:grid-cols-2">
        <div>
          <label htmlFor="instagram" className={ETIQUETA}>
            Instagram {OPCIONAL}
          </label>
          <input
            id="instagram"
            name="instagram"
            placeholder="@salonluna"
            className={CAMPO}
            style={BORDE}
          />
        </div>
        <div>
          <label htmlFor="sitioWeb" className={ETIQUETA}>
            Sitio web {OPCIONAL}
          </label>
          <input id="sitioWeb" name="sitioWeb" className={CAMPO} style={BORDE} />
        </div>
      </div>

      <div className="grid gap-7 sm:grid-cols-2">
        <div>
          <label htmlFor="localidad" className={ETIQUETA}>
            Localidad {OPCIONAL}
          </label>
          <input id="localidad" name="localidad" className={CAMPO} style={BORDE} />
        </div>
        <div>
          <label htmlFor="provincia" className={ETIQUETA}>
            Provincia {OPCIONAL}
          </label>
          <input id="provincia" name="provincia" className={CAMPO} style={BORDE} />
        </div>
      </div>

      <div>
        <label htmlFor="descripcion" className={ETIQUETA}>
          Qué hacés {OPCIONAL}
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={3}
          maxLength={600}
          className={CAMPO}
          style={BORDE}
        />
      </div>

      <details className="rounded-xl border p-5" style={BORDE}>
        <summary className="cursor-pointer text-sm font-extrabold">
          Datos de facturación {OPCIONAL}
        </summary>
        <div className="mt-5 grid gap-7 sm:grid-cols-2">
          <div>
            <label htmlFor="razonSocial" className={ETIQUETA}>
              Razón social
            </label>
            <input id="razonSocial" name="razonSocial" className={CAMPO} style={BORDE} />
          </div>
          <div>
            <label htmlFor="cuit" className={ETIQUETA}>
              CUIT
            </label>
            <input
              id="cuit"
              name="cuit"
              inputMode="numeric"
              placeholder="30-71234567-4"
              className={CAMPO}
              style={BORDE}
            />
          </div>
        </div>
      </details>

      {/*
        Los dos permisos van separados y ninguno viene marcado. Uno marcado de fábrica no
        es un permiso: es una casilla que la persona no vio.
      */}
      <div className="space-y-4 rounded-xl border p-5" style={BORDE}>
        <label className="flex gap-3 text-sm">
          <input type="checkbox" name="aceptaContacto" required className="mt-1 h-5 w-5" />
          <span>
            Autorizo que me contacten por este evento y que mis datos queden guardados.
          </span>
        </label>
        <label className="flex gap-3 text-sm">
          <input type="checkbox" name="aceptaNovedades" className="mt-1 h-5 w-5" />
          <span>
            Quiero recibir oportunidades de trabajo y novedades.{" "}
            <span className="opacity-60">Podés decir que no y registrarte igual.</span>
          </span>
        </label>
      </div>

      {estado.error ? (
        <p role="alert" className="text-sm font-extrabold" style={{ color: "#b00020" }}>
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-xl px-7 py-4 font-extrabold text-white disabled:opacity-50"
        style={{ background: "var(--slf-violeta)", minHeight: "44px" }}
      >
        {enviando ? "Enviando…" : "Sumar mi empresa"}
      </button>
    </form>
  );
}
