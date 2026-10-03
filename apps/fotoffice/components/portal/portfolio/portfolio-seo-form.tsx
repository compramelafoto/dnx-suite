"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setPortfolioSeoAction } from "@/app/actions/portfolio";
import {
  OPCIONES_MINIATURA,
  SEO_DESCRIPCION_MAX,
  SEO_DESCRIPCION_VISIBLE,
  SEO_TITULO_MAX,
  SEO_TITULO_VISIBLE,
  descripcionEfectiva,
  miniaturaEfectiva,
  recorteDeGoogle,
  tituloEfectivo,
  type OpcionMiniatura,
} from "@/lib/portfolio/seo-fields";

/**
 * Cómo se ve la ficha en Google y al compartirla.
 *
 * ── Por qué hay una vista previa ──
 *
 * "Título para Google" y "Descripción para Google" no le dicen nada a un fotógrafo. El resultado
 * de búsqueda dibujado sí: se entiende de un vistazo qué se está editando, y se ve en el momento
 * dónde corta el buscador. Sin eso, el campo se completa a ciegas o no se completa.
 *
 * ── Por qué los contadores no son rojos ──
 *
 * Pasarse del largo visible no es un error: Google corta y listo, la página sigue funcionando. El
 * aviso dice qué va a pasar, no reta. El rojo se reserva para el tope duro, que sí recorta lo
 * guardado.
 */

type Fuentes = {
  displayName: string;
  businessName: string | null;
  bio: string | null;
  rubros: string[];
  city: string | null;
  province: string | null;
  institucion: string;
  logoUrl: string | null;
  coverUrl: string | null;
  profilePhotoUrl: string | null;
  /** El dominio que se muestra en la vista previa, sólo decorativo. */
  urlVisible: string;
};

const ETIQUETA_IMAGEN: Record<OpcionMiniatura, string> = {
  LOGO: "El logo de mi estudio",
  COVER: "Mi foto destacada",
  PROFILE: "Mi foto de perfil",
};

export function PortfolioSeoForm({
  seoTitle,
  seoDescription,
  seoImageChoice,
  fuentes,
}: {
  seoTitle: string | null;
  seoDescription: string | null;
  seoImageChoice: string | null;
  fuentes: Fuentes;
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(seoTitle ?? "");
  const [descripcion, setDescripcion] = useState(seoDescription ?? "");
  const [imagen, setImagen] = useState(seoImageChoice ?? "");
  const [estado, setEstado] = useState<"quieto" | "guardando" | "listo" | "error">("quieto");
  const [error, setError] = useState<string | null>(null);

  // Lo que se va a ver de verdad, con lo que hay escrito en este momento.
  const tituloFinal = tituloEfectivo({
    seoTitle: titulo,
    displayName: fuentes.displayName,
    businessName: fuentes.businessName,
    city: fuentes.city,
  });
  const descripcionFinal = descripcionEfectiva({
    seoDescription: descripcion,
    bio: fuentes.bio,
    businessName: fuentes.businessName,
    displayName: fuentes.displayName,
    rubros: fuentes.rubros,
    city: fuentes.city,
    province: fuentes.province,
    institucion: fuentes.institucion,
  });
  const miniatura = miniaturaEfectiva({
    seoImageChoice: imagen,
    logoUrl: fuentes.logoUrl,
    coverUrl: fuentes.coverUrl,
    profilePhotoUrl: fuentes.profilePhotoUrl,
  });

  const tCorte = recorteDeGoogle(tituloFinal, SEO_TITULO_VISIBLE);
  const dCorte = recorteDeGoogle(descripcionFinal, SEO_DESCRIPCION_VISIBLE);

  const disponibles = OPCIONES_MINIATURA.filter(
    (o) =>
      ({ LOGO: fuentes.logoUrl, COVER: fuentes.coverUrl, PROFILE: fuentes.profilePhotoUrl })[o],
  );

  async function guardar() {
    setEstado("guardando");
    setError(null);
    const r = await setPortfolioSeoAction({
      title: titulo,
      description: descripcion,
      imageChoice: imagen,
    });
    if (!r.ok) {
      setError(r.error ?? "No pudimos guardar.");
      setEstado("error");
      return;
    }
    setEstado("listo");
    router.refresh();
  }

  return (
    <section className="fo-card space-y-5 p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Cómo te ve Google</h2>
        <p className="fo-helper">
          Todo esto es opcional. Si lo dejás vacío se arma solo con tu nombre, tu estudio y tu
          presentación, igual que hasta ahora.
        </p>
      </div>

      {/* La vista previa primero: se entiende qué se edita antes de tocar nada. */}
      <div className="rounded-lg border border-[var(--fo-border)] p-4">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-[var(--fo-muted-soft)]">
          Así se vería en el buscador
        </p>
        <p className="truncate text-xs text-[var(--fo-muted)]">{fuentes.urlVisible}</p>
        <p className="text-[17px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
          {tCorte.visible}
          {tCorte.cortado ? "…" : ""}
        </p>
        <p className="mt-0.5 text-sm leading-snug text-[var(--fo-muted)]">
          {dCorte.visible}
          {dCorte.cortado ? "…" : ""}
        </p>
      </div>

      <label className="block text-xs">
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="fo-label">Título para Google</span>
          <Contador largo={titulo.length} visible={SEO_TITULO_VISIBLE} max={SEO_TITULO_MAX} />
        </span>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value.slice(0, SEO_TITULO_MAX))}
          className="fo-input mt-1"
          placeholder={tituloEfectivo({
            seoTitle: null,
            displayName: fuentes.displayName,
            businessName: fuentes.businessName,
            city: fuentes.city,
          })}
        />
        <span className="fo-helper mt-1 block">
          Lo que más se busca, primero. Por ejemplo: &ldquo;Fotógrafo de 15 en Funes · DNX
          Estudio&rdquo;.
        </span>
      </label>

      <label className="block text-xs">
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="fo-label">Descripción para Google</span>
          <Contador
            largo={descripcion.length}
            visible={SEO_DESCRIPCION_VISIBLE}
            max={SEO_DESCRIPCION_MAX}
          />
        </span>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value.slice(0, SEO_DESCRIPCION_MAX))}
          rows={3}
          className="fo-input mt-1"
          placeholder="Vacío usa tu presentación."
        />
        <span className="fo-helper mt-1 block">
          Un resumen corto de qué hacés y dónde. No es tu presentación: ésa puede ser larga, ésta
          se lee en dos segundos.
        </span>
      </label>

      {disponibles.length > 1 ? (
        <div className="space-y-2 text-xs">
          <span className="fo-label">Imagen al compartir el enlace</span>
          <div className="flex flex-wrap gap-3">
            <Opcion valor="" actual={imagen} onElegir={setImagen} etiqueta="Automática" />
            {disponibles.map((o) => (
              <Opcion
                key={o}
                valor={o}
                actual={imagen}
                onElegir={setImagen}
                etiqueta={ETIQUETA_IMAGEN[o]}
              />
            ))}
          </div>
          {miniatura ? (
            <div className="flex items-center gap-3 pt-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={miniatura}
                alt=""
                className="h-16 w-28 rounded border border-[var(--fo-border)] object-contain"
              />
              <span className="fo-helper">
                Es la que aparece en WhatsApp, Facebook y cuando alguien comparte tu portfolio.
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="fo-alert-error text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {estado === "listo" ? (
        <p className="text-sm text-[var(--fo-success)]">Listo, guardamos los cambios.</p>
      ) : null}

      <button
        type="button"
        onClick={() => void guardar()}
        disabled={estado === "guardando"}
        className="fo-btn fo-btn-primary text-sm"
      >
        {estado === "guardando" ? "Guardando…" : "Guardar"}
      </button>
    </section>
  );
}

/** Cuántos caracteres van, y qué pasa al pasarse: Google corta, nosotros recortamos. */
function Contador({ largo, visible, max }: { largo: number; visible: number; max: number }) {
  const alTope = largo >= max;
  const pasado = largo > visible;
  return (
    <span
      className={
        "tabular-nums " +
        (alTope
          ? "text-[var(--fo-danger)]"
          : pasado
            ? "text-[var(--fo-warning)]"
            : "text-[var(--fo-muted)]")
      }
    >
      {largo}/{visible}
      {pasado && !alTope ? " · Google corta acá" : ""}
      {alTope ? " · es el máximo" : ""}
    </span>
  );
}

function Opcion({
  valor,
  actual,
  onElegir,
  etiqueta,
}: {
  valor: string;
  actual: string;
  onElegir: (v: string) => void;
  etiqueta: string;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="radio"
        name="seoImageChoice"
        value={valor}
        checked={actual === valor}
        onChange={() => onElegir(valor)}
      />
      <span>{etiqueta}</span>
    </label>
  );
}
