"use client";

/**
 * La tabla de Personas: ordenar, filtrar, exportar y mirar en el mapa.
 *
 * Trabaja entera en el navegador: son cientos de filas, no millones, y así
 * cada clic en un encabezado o filtro responde al instante. El mapa y el CSV
 * usan las filas filtradas, así que "los de Rosario que vinieron 2 veces" se
 * pueden ver, exportar y ubicar con los mismos filtros.
 */
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import type { Persona } from "@/lib/people/armar-personas";
import { cn } from "@/lib/cn";
import { formatMoneyMinor } from "@/lib/money";

import { MapaDePersonas, type PuntoDelMapa } from "./MapaDePersonas";

type Orden = { columna: ColumnaOrdenable; direccion: "asc" | "desc" };

type ColumnaOrdenable =
  | "nombre"
  | "edad"
  | "cumple"
  | "ciudad"
  | "ediciones"
  | "alta"
  | "pagado"
  | "fotos"
  | "nota"
  | "puesto"
  | "referidos"
  | "nps";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function valorParaOrdenar(p: Persona, c: ColumnaOrdenable): string | number | null {
  switch (c) {
    case "nombre":
      return p.nombre.toLocaleLowerCase("es");
    case "edad":
      return p.edad;
    case "cumple":
      return p.diasParaCumple;
    case "ciudad":
      return (p.localidad?.ciudad ?? p.ciudad ?? "").toLocaleLowerCase("es") || null;
    case "ediciones":
      return p.ediciones;
    case "alta":
      return p.primeraInscripcion;
    case "pagado":
      return p.totalPagado;
    case "fotos":
      return p.fotosSubidas;
    case "nota":
      return p.notaMax;
    case "puesto":
      return p.mejorPuesto;
    case "referidos":
      return p.referidos;
    case "nps":
      return p.nps;
  }
}

function fecha(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

function nota(n: number | null): string {
  return n == null ? "—" : n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function ciudadVisible(p: Persona): string {
  const c = p.localidad?.ciudad ?? p.ciudad;
  const pr = p.localidad?.provincia ?? p.provincia;
  return c ? (pr ? `${c}, ${pr}` : c) : "—";
}

function textoDeBusqueda(p: Persona): string {
  return [p.nombre, p.email, p.instagram, p.ciudad, p.localidad?.ciudad, p.documento, p.telefono]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function aCsv(personas: Persona[]): string {
  const columnas: [string, (p: Persona) => string | number | null][] = [
    ["Nombre", (p) => p.nombre],
    ["Email", (p) => p.email],
    ["Teléfono", (p) => p.telefono],
    ["Documento", (p) => p.documento],
    ["Fecha de nacimiento", (p) => p.fechaNacimiento],
    ["Edad", (p) => p.edad],
    ["Días para el cumpleaños", (p) => p.diasParaCumple],
    ["Ciudad", (p) => p.localidad?.ciudad ?? p.ciudad],
    ["Provincia", (p) => p.localidad?.provincia ?? p.provincia],
    ["Instagram", (p) => (p.instagram ? `@${p.instagram}` : null)],
    ["Ediciones", (p) => p.ediciones],
    ["Cuáles", (p) => p.edicionesNombres.join(" | ")],
    ["Primera inscripción", (p) => p.primeraInscripcion.slice(0, 10)],
    ["Total pagado", (p) => (p.totalPagado / 100).toFixed(2)],
    ["Cupones", (p) => p.cupones.join(" | ")],
    ["Fotos subidas", (p) => p.fotosSubidas],
    ["Fotos admitidas", (p) => p.fotosAdmitidas],
    ["Nota mínima", (p) => p.notaMin],
    ["Nota máxima", (p) => p.notaMax],
    ["Mejor puesto", (p) => p.mejorPuesto],
    ["Referidos", (p) => p.referidos],
    ["NPS", (p) => p.nps],
    ["Autoriza redes", (p) => (p.autorizaRedes ? "sí" : "no")],
    ["Talle", (p) => p.talle],
  ];
  const celda = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    columnas.map(([t]) => celda(t)).join(","),
    ...personas.map((p) => columnas.map(([, f]) => celda(f(p))).join(",")),
  ].join("\n");
}

function descargarCsv(personas: Persona[]) {
  // El BOM hace que Excel lea bien las tildes.
  const blob = new Blob([`\uFEFF${aCsv(personas)}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `personas-clickaton-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function PersonasTabla({
  personas,
  ediciones,
}: {
  personas: Persona[];
  ediciones: { id: string; nombre: string }[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [soloParticipantes, setSoloParticipantes] = useState(true);
  const [edicion, setEdicion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [mesCumple, setMesCumple] = useState("");
  const [edadMin, setEdadMin] = useState("");
  const [edadMax, setEdadMax] = useState("");
  const [minEdiciones, setMinEdiciones] = useState("");
  const [soloConFotos, setSoloConFotos] = useState(false);
  const [soloAutorizanRedes, setSoloAutorizanRedes] = useState(false);
  const [orden, setOrden] = useState<Orden>({ columna: "nombre", direccion: "asc" });
  const [abierta, setAbierta] = useState<string | null>(null);
  const [verMapa, setVerMapa] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const ciudades = useMemo(
    () =>
      [...new Set(personas.map((p) => p.localidad?.ciudad ?? p.ciudad).filter(Boolean) as string[])].sort(
        (a, b) => a.localeCompare(b, "es"),
      ),
    [personas],
  );

  const filtradas = useMemo(() => {
    const q = busqueda
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
    const min = edadMin ? Number(edadMin) : null;
    const max = edadMax ? Number(edadMax) : null;
    const minEd = minEdiciones ? Number(minEdiciones) : null;
    const lista = personas.filter((p) => {
      if (soloParticipantes && p.ediciones === 0) return false;
      if (q && !textoDeBusqueda(p).includes(q)) return false;
      if (edicion && !p.historial.some((h) => h.editionId === edicion && h.cuenta)) return false;
      if (ciudad && (p.localidad?.ciudad ?? p.ciudad) !== ciudad) return false;
      if (mesCumple && p.fechaNacimiento?.slice(5, 7) !== mesCumple) return false;
      if (min != null && (p.edad == null || p.edad < min)) return false;
      if (max != null && (p.edad == null || p.edad > max)) return false;
      if (minEd != null && p.ediciones < minEd) return false;
      if (soloConFotos && p.fotosSubidas === 0) return false;
      if (soloAutorizanRedes && !p.autorizaRedes) return false;
      return true;
    });
    const signo = orden.direccion === "asc" ? 1 : -1;
    return lista.sort((a, b) => {
      const va = valorParaOrdenar(a, orden.columna);
      const vb = valorParaOrdenar(b, orden.columna);
      // Los vacíos siempre al final, ordene como ordene.
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return -1 * signo;
      if (va > vb) return 1 * signo;
      return a.nombre.localeCompare(b.nombre, "es");
    });
  }, [
    personas,
    busqueda,
    soloParticipantes,
    edicion,
    ciudad,
    mesCumple,
    edadMin,
    edadMax,
    minEdiciones,
    soloConFotos,
    soloAutorizanRedes,
    orden,
  ]);

  const puntos = useMemo<PuntoDelMapa[]>(() => {
    const porClave = new Map<string, PuntoDelMapa>();
    for (const p of filtradas) {
      const l = p.localidad;
      if (!l || l.lat == null || l.lng == null) continue;
      const punto = porClave.get(l.clave) ?? {
        clave: l.clave,
        lat: l.lat,
        lng: l.lng,
        etiqueta: l.provincia ? `${l.ciudad}, ${l.provincia}` : l.ciudad,
        personas: [],
      };
      punto.personas.push({ nombre: p.nombre, registrationId: p.registrationId });
      porClave.set(l.clave, punto);
    }
    return [...porClave.values()];
  }, [filtradas]);
  const sinUbicar = filtradas.filter((p) => p.localidad?.lat == null).length;

  const ordenarPor = (columna: ColumnaOrdenable) =>
    setOrden((o) =>
      o.columna === columna
        ? { columna, direccion: o.direccion === "asc" ? "desc" : "asc" }
        : // Los números arrancan de mayor a menor: lo interesante suele ser "el que más".
          { columna, direccion: ["nombre", "ciudad", "cumple", "puesto"].includes(columna) ? "asc" : "desc" },
    );

  const encabezado = (columna: ColumnaOrdenable, children: string) => (
    <th scope="col" className="px-3 py-3 text-left">
      <button
        type="button"
        onClick={() => ordenarPor(columna)}
        className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.08em] text-ck-text-muted hover:text-ck-text"
      >
        {children}
        <span aria-hidden className="text-[10px]">
          {orden.columna === columna ? (orden.direccion === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );

  const campo =
    "min-h-10 rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-3 py-2 text-sm text-ck-text";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar nombre, email, Instagram, DNI…"
          className={cn(campo, "sm:col-span-2")}
          aria-label="Buscar"
        />
        <select value={edicion} onChange={(e) => setEdicion(e.target.value)} className={campo} aria-label="Edición">
          <option value="">Todas las ediciones</option>
          {ediciones.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        <select value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={campo} aria-label="Ciudad">
          <option value="">Todas las ciudades</option>
          {ciudades.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={mesCumple} onChange={(e) => setMesCumple(e.target.value)} className={campo} aria-label="Mes de cumpleaños">
          <option value="">Cumpleaños: cualquier mes</option>
          {MESES.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, "0")}>
              Cumple en {m.toLowerCase()}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={edadMin}
            onChange={(e) => setEdadMin(e.target.value)}
            placeholder="Edad desde"
            className={cn(campo, "w-full")}
            aria-label="Edad desde"
          />
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={edadMax}
            onChange={(e) => setEdadMax(e.target.value)}
            placeholder="hasta"
            className={cn(campo, "w-full")}
            aria-label="Edad hasta"
          />
        </div>
        <select value={minEdiciones} onChange={(e) => setMinEdiciones(e.target.value)} className={campo} aria-label="Ediciones">
          <option value="">Cualquier cantidad de ediciones</option>
          <option value="1">1 o más ediciones</option>
          <option value="2">2 o más ediciones</option>
          <option value="3">3 o más ediciones</option>
        </select>
        <div className="flex flex-col justify-center gap-1 text-sm text-ck-text-secondary">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={soloParticipantes} onChange={(e) => setSoloParticipantes(e.target.checked)} />
            Sólo quienes participaron
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={soloConFotos} onChange={(e) => setSoloConFotos(e.target.checked)} />
            Con fotos subidas
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={soloAutorizanRedes}
              onChange={(e) => setSoloAutorizanRedes(e.target.checked)}
            />
            Autorizan publicar en redes
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-ck-text-secondary">
          {filtradas.length} {filtradas.length === 1 ? "persona" : "personas"}
        </p>
        <Button type="button" variant={verMapa ? "primary" : "outline"} size="sm" onClick={() => setVerMapa((v) => !v)}>
          {verMapa ? "Ocultar mapa" : "Ver en el mapa"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            const lista = filtradas
              .map((p) => p.instagram)
              .filter(Boolean)
              .map((i) => `@${i}`)
              .join(" ");
            await navigator.clipboard.writeText(lista);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          }}
        >
          {copiado ? "¡Copiados!" : "Copiar los @ de Instagram"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => descargarCsv(filtradas)}>
          Exportar CSV
        </Button>
      </div>

      {verMapa ? (
        <div className="space-y-2">
          <MapaDePersonas puntos={puntos} />
          {sinUbicar > 0 ? (
            <p className="text-xs text-ck-text-muted">
              {sinUbicar} de estas personas no aparecen en el mapa: no cargaron ciudad o su ciudad
              todavía no está ubicada (ver &quot;Ciudades a revisar&quot;).
            </p>
          ) : null}
        </div>
      ) : null}

      {filtradas.length === 0 ? (
        <p className="rounded-[var(--ck-radius-card)] border border-dashed border-ck-border px-4 py-8 text-center text-sm text-ck-text-muted">
          Nadie coincide con estos filtros.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--ck-radius-card)] border border-ck-border">
          <table className="min-w-full divide-y divide-ck-border text-sm">
            <thead className="bg-ck-surface-muted/60 text-xs">
              <tr>
                {encabezado("nombre", "Persona")}
                {encabezado("edad", "Nacimiento")}
                {encabezado("cumple", "Cumple")}
                {encabezado("ciudad", "Ciudad")}
                {encabezado("ediciones", "Ediciones")}
                {encabezado("alta", "Desde")}
                {encabezado("pagado", "Pagó")}
                {encabezado("fotos", "Fotos")}
                {encabezado("nota", "Notas")}
                {encabezado("puesto", "Mejor puesto")}
                {encabezado("referidos", "Trajo")}
                {encabezado("nps", "Encuesta")}
                <th scope="col" className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ck-border bg-ck-surface">
              {filtradas.map((p) => (
                <Fragment key={p.clave}>
                  <tr
                    className="cursor-pointer align-top hover:bg-ck-surface-muted/40"
                    onClick={() => setAbierta((a) => (a === p.clave ? null : p.clave))}
                  >
                    <td className="px-3 py-3">
                      <p className="font-medium text-ck-text">{p.nombre}</p>
                      <p className="text-xs text-ck-text-muted">{p.email}</p>
                      {p.instagram ? (
                        <a
                          href={`https://instagram.com/${p.instagram}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-ck-yellow hover:underline"
                        >
                          @{p.instagram}
                        </a>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {p.fechaNacimiento ? (
                        <>
                          {fecha(p.fechaNacimiento)}
                          <span className="block text-xs text-ck-text-muted">{p.edad} años</span>
                        </>
                      ) : (
                        <span className="text-ck-text-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {p.diasParaCumple == null
                        ? "—"
                        : p.diasParaCumple === 0
                          ? "¡Hoy!"
                          : `en ${p.diasParaCumple} d`}
                    </td>
                    <td className="px-3 py-3">
                      {ciudadVisible(p)}
                      {p.ciudad && p.localidad?.estado !== "RESUELTA" ? (
                        <span className="block text-xs text-[var(--ck-warning)]">sin ubicar</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-base font-semibold text-ck-text">{p.ediciones}</span>
                      <span className="block text-xs text-ck-text-muted">
                        {p.edicionesNombres.map((n) => n.replace(/^Clickat[oó]n\s*-\s*/i, "")).join(" · ")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{fecha(p.primeraInscripcion)}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {p.totalPagado > 0 ? formatMoneyMinor(p.totalPagado, "ARS") : "—"}
                      {p.recibioRegalo ? <span className="block text-xs text-ck-text-muted">regalo</span> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {p.fotosSubidas}
                      <span className="block text-xs text-ck-text-muted">{p.fotosAdmitidas} admitidas</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {p.notaMax == null
                        ? "—"
                        : p.notaMin === p.notaMax
                          ? nota(p.notaMax)
                          : `${nota(p.notaMin)} a ${nota(p.notaMax)}`}
                      {p.notaPromedio != null ? (
                        <span className="block text-xs text-ck-text-muted">prom. {nota(p.notaPromedio)}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">{p.mejorPuesto ?? "—"}</td>
                    <td className="px-3 py-3">{p.referidos || "—"}</td>
                    <td className="px-3 py-3">{p.nps ?? "—"}</td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/personas/${p.registrationId}`}
                        onClick={(e) => e.stopPropagation()}
                        title="Carpeta de fotos y ficha"
                        aria-label={`Carpeta de fotos de ${p.nombre}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--ck-radius-sm)] border border-ck-border text-ck-text-secondary hover:border-ck-yellow/60 hover:text-ck-yellow"
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                  {abierta === p.clave ? (
                    <tr className="bg-ck-surface-muted/30">
                      <td colSpan={13} className="px-4 py-4">
                        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
                          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                            <dt className="text-ck-text-muted">Teléfono</dt>
                            <dd>{p.telefono ?? "—"}</dd>
                            <dt className="text-ck-text-muted">Documento</dt>
                            <dd>{p.documento ?? "—"}</dd>
                            <dt className="text-ck-text-muted">Talle</dt>
                            <dd>{p.talle ?? "—"}</dd>
                            <dt className="text-ck-text-muted">Cupones</dt>
                            <dd>{p.cupones.join(", ") || "—"}</dd>
                            <dt className="text-ck-text-muted">Acreditaciones</dt>
                            <dd>{p.acreditaciones}</dd>
                            <dt className="text-ck-text-muted">Publicar en redes</dt>
                            <dd>{p.autorizaRedes ? "Autorizado" : "No autorizado"}</dd>
                          </dl>
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ck-text-muted">
                              Historial
                            </p>
                            <ul className="space-y-1 text-sm">
                              {p.historial.map((h) => (
                                <li key={h.registrationId} className={cn(!h.cuenta && "text-ck-text-muted")}>
                                  <Link
                                    href={`/admin/inscripciones/${h.registrationId}`}
                                    className="font-medium hover:text-ck-yellow"
                                  >
                                    {h.edicion}
                                  </Link>{" "}
                                  · {fecha(h.fecha)} · {h.estado.toLowerCase()} / pago {h.pago.toLowerCase()}
                                  {h.numero ? ` · N.º ${h.numero}` : ""}
                                  {h.sede ? ` · ${h.sede}` : ""}
                                  {h.fotosSubidas ? ` · ${h.fotosSubidas} fotos` : ""}
                                  {h.mejorPuesto ? ` · mejor puesto ${h.mejorPuesto}` : ""}
                                  {h.monto ? ` · ${formatMoneyMinor(h.monto, h.moneda)}` : ""}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
