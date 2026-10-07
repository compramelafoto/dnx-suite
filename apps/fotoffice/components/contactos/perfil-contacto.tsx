"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { guardarPerfilContactoAction } from "@/app/actions/contactos";
import { CATEGORIAS_CONTACTO, ETIQUETA_CATEGORIA_CONTACTO } from "@/lib/consultas/constantes";
import type { PerfilContacto } from "@/lib/contactos/perfil";

const MENSAJE_FALLA = "No se pudo guardar el cambio. Probá de nuevo.";

type Campo = "category" | "mobile" | "email2" | "birthday" | "website" | "province" | "country" | "postalCode" | "about";
type Form = Record<Campo, string>;

const ETIQUETA: Record<Campo, string> = {
  category: "Categoría",
  mobile: "Celular",
  email2: "Segundo correo",
  birthday: "Cumpleaños",
  website: "Sitio web",
  province: "Provincia",
  country: "País",
  postalCode: "Código postal",
  about: "Sobre",
};

/** "aaaa-mm-dd" → "dd/mm/aaaa" (fecha de calendario, sin zona). */
function diaVisible(ymd: string): string {
  const [a, m, d] = ymd.split("-");
  return `${d}/${m}/${a}`;
}

/** Categoría del contacto como insignia (Contacto, Cliente, Proveedor, Colaborador). */
export function InsigniaCategoria({ categoria }: { categoria: PerfilContacto["category"] }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--fo-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--fo-text)]">
      {ETIQUETA_CATEGORIA_CONTACTO[categoria] ?? categoria}
    </span>
  );
}

/**
 * Datos ampliados del contacto en la ficha del cliente (spec §3.3): categoría, celular, segundo
 * correo, cumpleaños, web, provincia, país, código postal y "Sobre". Con "Gestionar" en Clientes
 * se editan acá; con "Ver" sólo se leen. La acción vuelve a verificar todo en el servidor.
 */
export function PerfilContactoTarjeta({
  clientId,
  perfil,
  puedeEditar,
}: {
  clientId: string;
  perfil: PerfilContacto;
  puedeEditar: boolean;
}) {
  const idBase = useId();
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [estado, setEstado] = useState("");

  const inicial = (): Form => ({
    category: perfil.category,
    mobile: perfil.mobile ?? "",
    email2: perfil.email2 ?? "",
    birthday: perfil.birthday ?? "",
    website: perfil.website ?? "",
    province: perfil.province ?? "",
    country: perfil.country ?? "",
    postalCode: perfil.postalCode ?? "",
    about: perfil.about ?? "",
  });
  const [form, setForm] = useState<Form>(inicial);
  const cambiar = (c: Campo, v: string) => setForm((f) => ({ ...f, [c]: v }));

  function guardar() {
    setError(null);
    setErrores({});
    iniciar(async () => {
      try {
        const r = await guardarPerfilContactoAction({ clientId, datos: form });
        if (!r.ok) {
          setError(r.error);
          setErrores(r.errores ?? {});
          return;
        }
        setEditando(false);
        setEstado("Datos guardados.");
        router.refresh();
      } catch {
        setError(MENSAJE_FALLA);
      }
    });
  }

  const filas: { campo: Campo; valor: React.ReactNode }[] = [
    { campo: "mobile", valor: perfil.mobile },
    {
      campo: "email2",
      valor: perfil.email2 ? (
        <a href={`mailto:${perfil.email2}`} className="text-[var(--fo-accent)] hover:underline">
          {perfil.email2}
        </a>
      ) : null,
    },
    { campo: "birthday", valor: perfil.birthday ? diaVisible(perfil.birthday) : null },
    {
      campo: "website",
      valor: perfil.website ? (
        <a href={perfil.website} target="_blank" rel="noopener noreferrer nofollow" className="text-[var(--fo-accent)] hover:underline">
          {perfil.website.replace(/^https?:\/\//i, "")}
        </a>
      ) : null,
    },
    { campo: "province", valor: perfil.province },
    { campo: "country", valor: perfil.country },
    { campo: "postalCode", valor: perfil.postalCode },
    { campo: "about", valor: perfil.about ? <span className="whitespace-pre-line">{perfil.about}</span> : null },
  ];

  const id = (c: Campo) => `${idBase}-${c}`;
  const marca = (c: Campo) =>
    errores[c] ? { "aria-invalid": true as const, "aria-describedby": `${id(c)}-error` } : {};
  const errorDe = (c: Campo) =>
    errores[c] ? (
      <p id={`${id(c)}-error`} className="text-xs text-[var(--fo-danger)]">
        {errores[c]}
      </p>
    ) : null;
  const texto = (c: Exclude<Campo, "category" | "about">, tipo = "text", extra: Record<string, unknown> = {}) => (
    <div className="fo-field-stack" key={c}>
      <label className="fo-label" htmlFor={id(c)}>
        {ETIQUETA[c]}
      </label>
      <input
        id={id(c)}
        type={tipo}
        className="fo-input"
        value={form[c]}
        onChange={(e) => cambiar(c, e.target.value)}
        {...marca(c)}
        {...extra}
      />
      {errorDe(c)}
    </div>
  );

  return (
    <section aria-labelledby={`${idBase}-titulo`} className="fo-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id={`${idBase}-titulo`} className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
          Datos de contacto
        </h2>
        {puedeEditar && !editando ? (
          <button
            type="button"
            className="fo-btn fo-btn-ghost text-xs"
            onClick={() => {
              setForm(inicial());
              setError(null);
              setErrores({});
              setEstado("");
              setEditando(true);
            }}
          >
            Editar
          </button>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {estado}
      </p>

      {!editando ? (
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[var(--fo-muted)]">{ETIQUETA.category}</dt>
            <dd>
              <InsigniaCategoria categoria={perfil.category} />
            </dd>
          </div>
          {filas.map((f) => (
            <div key={f.campo} className="flex justify-between gap-4">
              <dt className="shrink-0 text-[var(--fo-muted)]">{ETIQUETA[f.campo]}</dt>
              <dd className="min-w-0 break-words text-right text-[var(--fo-text)]">
                {f.valor === null || f.valor === undefined || f.valor === "" ? "—" : f.valor}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor={id("category")}>
              {ETIQUETA.category}
            </label>
            <select
              id={id("category")}
              className="fo-input"
              value={form.category}
              onChange={(e) => cambiar("category", e.target.value)}
              {...marca("category")}
            >
              {CATEGORIAS_CONTACTO.map((c) => (
                <option key={c} value={c}>
                  {ETIQUETA_CATEGORIA_CONTACTO[c]}
                </option>
              ))}
            </select>
            {errorDe("category")}
          </div>
          {texto("mobile", "tel", { inputMode: "tel", autoComplete: "off" })}
          {texto("email2", "email", { autoComplete: "off" })}
          {texto("birthday", "date")}
          {texto("website", "text", { inputMode: "url", placeholder: "www.ejemplo.com" })}
          {texto("province")}
          {texto("country")}
          {texto("postalCode")}
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor={id("about")}>
              {ETIQUETA.about}
            </label>
            <textarea
              id={id("about")}
              className="fo-input min-h-24"
              value={form.about}
              onChange={(e) => cambiar("about", e.target.value)}
              {...marca("about")}
            />
            {errorDe("about")}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-[var(--fo-danger)]">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
              {pendiente ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className="fo-btn fo-btn-ghost text-sm" disabled={pendiente} onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
