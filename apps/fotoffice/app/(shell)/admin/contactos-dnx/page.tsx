import Link from "next/link";
import { Facebook, Globe, Instagram, Mail, MessageCircle, Phone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { filtrosDesdeQuery, listarContactos, POR_PAGINA, type FiltrosContactos } from "@/lib/agentes/buscador/consultas-panel";
import {
  ETIQUETA_ESTADO, ETIQUETA_NICHO, ETIQUETA_REGION, ETIQUETA_TIPO, ETIQUETA_VINCULO, etiquetaEstado, etiquetaNicho,
  etiquetaRegion, etiquetaTipo, etiquetaVinculo,
} from "@/lib/agentes/buscador/etiquetas";
import { diaArgentino } from "@/lib/agentes/periodista/horario";
import { BotonImportarConocidos } from "./acciones-contacto";

export const dynamic = "force-dynamic";
/** «Importar conocidos» recorre todos los clientes de DNX Estudio: puede pasar del minuto. */
export const maxDuration = 300;

type Busqueda = Promise<Record<string, string | string[] | undefined>>;

/** El querystring de unos filtros (para los enlaces de página y el CSV). */
function query(f: FiltrosContactos, extra: Record<string, string | undefined> = {}): string {
  const q = new URLSearchParams();
  const todo: Record<string, string | undefined> = {
    tipo: f.tipo, nicho: f.nicho, region: f.region, provincia: f.provincia, estado: f.estado, vinculo: f.vinculo,
    conEmail: f.conEmail ? "1" : undefined, texto: f.texto, ...extra,
  };
  for (const [k, v] of Object.entries(todo)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

function Opciones({ nombre, etiqueta, valor, opciones }: { nombre: string; etiqueta: string; valor?: string; opciones: Record<string, string> }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="fo-label">{etiqueta}</span>
      <select name={nombre} defaultValue={valor ?? ""} className="fo-input">
        <option value="">Todos</option>
        {Object.entries(opciones).map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

const ICONOS = [
  { campo: "web", Icono: Globe, titulo: "Web" },
  { campo: "instagram", Icono: Instagram, titulo: "Instagram" },
  { campo: "facebook", Icono: Facebook, titulo: "Facebook" },
  { campo: "email", Icono: Mail, titulo: "Correo" },
  { campo: "telefono", Icono: Phone, titulo: "Teléfono" },
  { campo: "whatsapp", Icono: MessageCircle, titulo: "WhatsApp" },
] as const;

/**
 * Contactos DNX: la base de prospectos (fotógrafos, escuelas, clubes…) que arman los agentes. El
 * acceso lo controla el layout de /admin (sólo SUPER_ADMIN).
 */
export default async function ContactosDnxPage({ searchParams }: { searchParams: Busqueda }) {
  const sp = await searchParams;
  const f = filtrosDesdeQuery((k) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  });
  const { filas, total } = await listarContactos(f);
  const pagina = f.pagina ?? 1;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const hayFiltros = Object.keys(f).some((k) => k !== "pagina");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Contactos DNX"
        description="La base de prospectos de DNX: fotógrafos, escuelas, clubes y organizadores que encuentran los agentes o que ya conocemos. Nadie de esta lista recibe nada sin que lo decidas."
        actions={<BotonImportarConocidos />}
      />

      {/* Cabecera del agente Buscador: la agrega la Tarea 11 (estado, regiones, costos). Por ahora, vacía. */}

      <form method="get" className="fo-card grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="fo-label">Buscar</span>
          <input name="texto" defaultValue={f.texto ?? ""} placeholder="Nombre, ciudad, correo o Instagram" className="fo-input" />
        </label>
        <Opciones nombre="tipo" etiqueta="Tipo" valor={f.tipo} opciones={ETIQUETA_TIPO} />
        <Opciones nombre="nicho" etiqueta="Nicho" valor={f.nicho} opciones={ETIQUETA_NICHO} />
        <Opciones nombre="region" etiqueta="Región" valor={f.region} opciones={ETIQUETA_REGION} />
        <label className="space-y-1 text-sm">
          <span className="fo-label">Provincia</span>
          <input name="provincia" defaultValue={f.provincia ?? ""} placeholder="Por ejemplo: Santa Fe" className="fo-input" />
        </label>
        <Opciones nombre="estado" etiqueta="Estado" valor={f.estado} opciones={ETIQUETA_ESTADO} />
        <Opciones nombre="vinculo" etiqueta="Vínculo" valor={f.vinculo} opciones={ETIQUETA_VINCULO} />
        <label className="flex items-center gap-2 text-sm text-[var(--fo-text)]">
          <input type="checkbox" name="conEmail" value="1" defaultChecked={f.conEmail} />
          Sólo los que tienen correo
        </label>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
          <button type="submit" className="fo-btn-primary">
            Filtrar
          </button>
          {hayFiltros ? (
            <Link href="/admin/contactos-dnx" className="fo-btn-ghost">
              Sacar filtros
            </Link>
          ) : null}
          {/* Descarga directa: un enlace común a la ruta del CSV, con los mismos filtros. */}
          <a href={`/api/admin/contactos-dnx/csv${query(f)}`} className="fo-btn-secondary" download>
            Exportar CSV
          </a>
        </div>
      </form>

      <section className="fo-card space-y-4">
        <p className="text-sm text-[var(--fo-muted)]">
          {total === 0
            ? hayFiltros
              ? "Ningún contacto coincide con esos filtros."
              : "Todavía no hay contactos. Tocá «Importar conocidos» para traer a los fotógrafos que ya son clientes de DNX Estudio."
            : `${total} ${total === 1 ? "contacto" : "contactos"}${paginas > 1 ? ` · página ${pagina} de ${paginas}` : ""}`}
        </p>

        {filas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--fo-muted)] border-b border-[var(--fo-border)]">
                  <th className="py-2 pr-3 font-medium">Nombre</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium">Nichos</th>
                  <th className="py-2 pr-3 font-medium">Ciudad / provincia</th>
                  <th className="py-2 pr-3 font-medium">Región</th>
                  <th className="py-2 pr-3 font-medium">Datos</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium">Vínculo</th>
                  <th className="py-2 font-medium">Alta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fo-border)]">
                {filas.map((c) => (
                  <tr key={c.id} className="align-top">
                    <td className="py-2 pr-3">
                      <Link href={`/admin/contactos-dnx/${c.id}`} className="text-[var(--fo-accent)] underline font-medium">
                        {c.nombre}
                      </Link>
                      {c.compradorClf ? <span className="block text-xs text-[var(--fo-muted)]">Compró en CLF</span> : null}
                    </td>
                    <td className="py-2 pr-3 text-[var(--fo-text)]">{etiquetaTipo(c.tipo)}</td>
                    <td className="py-2 pr-3 text-[var(--fo-muted)]">{c.nichos.map(etiquetaNicho).join(", ") || "—"}</td>
                    <td className="py-2 pr-3 text-[var(--fo-muted)]">{[c.ciudad, c.provincia].filter(Boolean).join(", ") || "—"}</td>
                    <td className="py-2 pr-3 text-[var(--fo-muted)]">{etiquetaRegion(c.region) || "—"}</td>
                    <td className="py-2 pr-3">
                      <span className="flex gap-1.5 text-[var(--fo-muted)]">
                        {ICONOS.filter(({ campo }) => c[campo]).map(({ campo, Icono, titulo }) => (
                          <span key={campo} title={`${titulo}: ${c[campo]}`}>
                            <Icono className="size-4" aria-label={titulo} />
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-[var(--fo-text)]">{etiquetaEstado(c.estado)}</td>
                    <td className="py-2 pr-3 text-[var(--fo-muted)]">{etiquetaVinculo(c.vinculo)}</td>
                    <td className="py-2 text-[var(--fo-muted)] whitespace-nowrap">{diaArgentino(c.creadoEn).split("-").reverse().join("/")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {paginas > 1 ? (
          <nav className="flex flex-wrap items-center gap-3 text-sm" aria-label="Páginas">
            {pagina > 1 ? (
              <Link href={`/admin/contactos-dnx${query(f, { pagina: pagina > 2 ? String(pagina - 1) : undefined })}`} className="fo-btn-secondary">
                Anterior
              </Link>
            ) : null}
            {pagina < paginas ? (
              <Link href={`/admin/contactos-dnx${query(f, { pagina: String(pagina + 1) })}`} className="fo-btn-secondary">
                Siguiente
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
