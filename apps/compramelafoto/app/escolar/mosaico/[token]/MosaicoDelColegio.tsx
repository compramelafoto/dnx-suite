"use client";

import { useMemo, useState } from "react";
import type { ResumenParaElColegio } from "@/lib/escolar-mosaico/resumen-para-el-colegio";

type Props = { token: string; inicial: ResumenParaElColegio };

const NO_SE = "no-se";

export default function MosaicoDelColegio({ token, inicial }: Props) {
  const [datos, setDatos] = useState(inicial);
  const [vencido, setVencido] = useState(false);
  const base = `/api/escolar/mosaico/${encodeURIComponent(token)}`;

  const sinRetrato = useMemo(
    () => datos.alumnos.filter((a) => !a.tieneRetrato).sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, "es")),
    [datos.alumnos],
  );

  async function enviar(body: unknown): Promise<string | null> {
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (res.status === 410) {
        setVencido(true);
        return null;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        return j?.error ?? "No se pudo guardar. Probá de nuevo.";
      }
      return null;
    } catch {
      return "No hay conexión. Probá de nuevo.";
    }
  }

  async function recargar() {
    try {
      const res = await fetch(base, { cache: "no-store" });
      if (res.status === 410) return setVencido(true);
      if (res.ok) setDatos((await res.json()) as ResumenParaElColegio);
    } catch {
      // nos quedamos con lo que hay
    }
  }

  if (vencido) {
    return (
      <main className="min-h-screen bg-[#f9fafb] flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Este enlace ya no está activo</h1>
          <p className="text-sm text-gray-600">Puede que haya vencido o que el curso ya se haya cerrado. Pedile uno nuevo al fotógrafo.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f9fafb] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="text-sm font-medium text-[#a8652e]">Mosaico del curso</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-gray-900">
            Ayudanos a poner el nombre a cada chico del curso {datos.titulo}
          </h1>
          <p className="mt-3 text-gray-600 max-w-2xl">
            Abajo están los retratos que todavía no sabemos de quién son. Elegí el nombre de la lista y tocá «Guardar». Si no
            lo reconocés, dejalo como está. Después el fotógrafo revisa todo antes de armar el mosaico.
          </p>
        </header>

        <section aria-labelledby="sin-nombre">
          <h2 id="sin-nombre" className="text-lg font-semibold text-gray-900">
            Retratos sin nombre {datos.sinIdentificar.length > 0 ? `(${datos.sinIdentificar.length})` : ""}
          </h2>
          {datos.sinIdentificar.length === 0 ? (
            <p className="mt-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
              ¡Listo! No quedan retratos por nombrar. Gracias por la ayuda.
            </p>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {datos.sinIdentificar.map((s) => (
                <TarjetaDeRetrato
                  key={s.photoId}
                  photoId={s.photoId}
                  src={`${base}/foto/${s.photoId}`}
                  opciones={sinRetrato}
                  onGuardar={async (rosterEntryId) => {
                    const error = await enviar({ accion: "asignar", photoId: s.photoId, rosterEntryId });
                    if (!error) {
                      setDatos((d) => ({
                        ...d,
                        sinIdentificar: d.sinIdentificar.filter((x) => x.photoId !== s.photoId),
                        alumnos: d.alumnos.map((a) => (a.rosterEntryId === rosterEntryId ? { ...a, tieneRetrato: true } : a)),
                      }));
                    } else {
                      void recargar();
                    }
                    return error;
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        {datos.integrantes.length > 0 ? (
          <Integrantes
            inicial={datos.integrantes}
            base={base}
            onGuardar={async (integrantes) => {
              const error = await enviar({ accion: "integrantes", integrantes });
              if (!error) void recargar();
              return error;
            }}
          />
        ) : null}

        <footer className="mt-12 text-center text-xs text-gray-400">ComprameLaFoto · Este enlace es sólo para el colegio: no lo compartas.</footer>
      </div>
    </main>
  );
}

function TarjetaDeRetrato({
  photoId,
  src,
  opciones,
  onGuardar,
}: {
  photoId: number;
  src: string;
  opciones: Array<{ rosterEntryId: number; nombre: string; apellido: string }>;
  onGuardar: (rosterEntryId: number) => Promise<string | null>;
}) {
  const [elegido, setElegido] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `alumno-${photoId}`;
  const puedeGuardar = elegido !== "" && elegido !== NO_SE && !guardando;

  return (
    <li className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="aspect-[4/5] bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Retrato sin nombre" loading="lazy" className="h-full w-full object-cover" />
      </div>
      <div className="p-4">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          ¿Quién es?
        </label>
        <select
          id={id}
          value={elegido}
          onChange={(e) => {
            setElegido(e.target.value);
            setError(null);
          }}
          className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900"
        >
          <option value="">Elegí de la lista…</option>
          {opciones.map((a) => (
            <option key={a.rosterEntryId} value={String(a.rosterEntryId)}>
              {a.apellido}, {a.nombre}
            </option>
          ))}
          <option value={NO_SE}>No es de este curso / no sé</option>
        </select>
        {elegido === NO_SE ? (
          <p className="mt-2 text-sm text-gray-500">No pasa nada: dejalo así y el fotógrafo se encarga.</p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          disabled={!puedeGuardar}
          onClick={async () => {
            setGuardando(true);
            const e = await onGuardar(Number(elegido));
            setGuardando(false);
            if (e) setError(e);
          }}
          className="mt-3 w-full rounded-lg bg-[#a8652e] px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </li>
  );
}

function Integrantes({
  inicial,
  base,
  onGuardar,
}: {
  inicial: ResumenParaElColegio["integrantes"];
  base: string;
  onGuardar: (integrantes: Array<{ role: string; name: string }>) => Promise<string | null>;
}) {
  const [filas, setFilas] = useState(() => inicial.map((i) => ({ role: i.role, name: i.name })));
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  return (
    <section aria-labelledby="seno" className="mt-12">
      <h2 id="seno" className="text-lg font-semibold text-gray-900">
        Seño y directivos
      </h2>
      <p className="mt-1 text-gray-600">Revisá que el cargo y el nombre estén bien escritos, así salen en el mosaico.</p>
      <form
        className="mt-4 space-y-3"
        onSubmit={async (ev) => {
          ev.preventDefault();
          setGuardando(true);
          setMensaje(null);
          const e = await onGuardar(filas.map((f, i) => ({ role: f.role.trim() || inicial[i]!.role, name: f.name.trim() })));
          setGuardando(false);
          setMensaje(e ? { ok: false, texto: e } : { ok: true, texto: "¡Guardado! Gracias." });
        }}
      >
        {inicial.map((i, idx) => (
          <div key={idx} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-end">
            {i.tieneFoto && i.photoId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${base}/foto/${i.photoId}`} alt="" loading="lazy" className="h-20 w-16 shrink-0 rounded-lg bg-gray-100 object-cover" />
            ) : null}
            <label className="block flex-1 text-sm font-medium text-gray-700">
              Cargo
              <input
                value={filas[idx]?.role ?? ""}
                maxLength={60}
                placeholder="Maestra, Directora…"
                onChange={(e) => setFilas((f) => f.map((x, j) => (j === idx ? { ...x, role: e.target.value } : x)))}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900"
              />
            </label>
            <label className="block flex-[2] text-sm font-medium text-gray-700">
              Nombre y apellido
              <input
                value={filas[idx]?.name ?? ""}
                maxLength={120}
                onChange={(e) => setFilas((f) => f.map((x, j) => (j === idx ? { ...x, name: e.target.value } : x)))}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900"
              />
            </label>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={guardando}
            className="rounded-lg bg-[#a8652e] px-5 py-2.5 font-medium text-white disabled:opacity-40"
          >
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
          {mensaje ? <p className={`text-sm ${mensaje.ok ? "text-green-700" : "text-red-600"}`}>{mensaje.texto}</p> : null}
        </div>
      </form>
    </section>
  );
}
