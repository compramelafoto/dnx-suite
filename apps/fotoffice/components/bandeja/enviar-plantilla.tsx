"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { enviarPlantillaAction } from "@/app/actions/bandeja";
import { armarTexto, AVISO_CATEGORIA, ETIQUETA_CATEGORIA, urlDelBoton, type PlantillaParaElegir } from "@/lib/bandeja/plantillas-puro";

/**
 * Elegir y mandar una plantilla aprobada de Meta. Fuera de la ventana de 24 h es la única forma de
 * escribirle al cliente. Las variables vienen completadas con los datos del chat y se pueden
 * corregir; la vista previa muestra exactamente lo que va a llegar. Un identificador por envío
 * evita mandar dos veces si se corta la red.
 */
export function EnviarPlantilla({ chatId, plantillas, abierta = true }: { chatId: string; plantillas: PlantillaParaElegir[]; abierta?: boolean }) {
  const router = useRouter();
  const idSelector = useId();
  const [clave, setClave] = useState<string>(plantillas[0] ? `${plantillas[0].nombre}|${plantillas[0].idioma}` : "");
  const elegida = useMemo(() => plantillas.find((p) => `${p.nombre}|${p.idioma}` === clave) ?? null, [plantillas, clave]);
  const [valores, setValores] = useState<string[]>(plantillas[0]?.sugeridos ?? []);
  const [boton, setBoton] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const envioEnCurso = useRef<{ token: string; firma: string } | null>(null);

  if (plantillas.length === 0) {
    return (
      <p className="text-sm text-[var(--fo-muted)]">
        No hay plantillas aprobadas en Meta para mandar desde acá. Se crean en el Administrador de WhatsApp de Meta y aparecen solas cuando Meta las aprueba.
      </p>
    );
  }

  function elegir(nueva: string) {
    setClave(nueva);
    const p = plantillas.find((x) => `${x.nombre}|${x.idioma}` === nueva);
    setValores(p?.sugeridos ?? []);
    setBoton("");
    setError(null);
    setAviso(null);
  }

  const completos = elegida !== null && valores.length === elegida.variables && valores.every((v) => v.trim()) && (!elegida.boton?.dinamico || boton.trim() !== "");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!elegida || enviando || !completos) return;
    const datos = { nombre: elegida.nombre, idioma: elegida.idioma, valores: valores.map((v) => v.trim()), boton: elegida.boton?.dinamico ? boton.trim() : undefined };
    const firma = JSON.stringify(datos);
    if (!envioEnCurso.current || envioEnCurso.current.firma !== firma) envioEnCurso.current = { token: crypto.randomUUID(), firma };
    setEnviando(true);
    setError(null);
    setAviso(null);
    try {
      const r = await enviarPlantillaAction(chatId, datos, envioEnCurso.current.token);
      envioEnCurso.current = null;
      if (r.ok) {
        setAviso(r.aviso ?? (r.estadoEnvio === "SIMULADO" ? "Plantilla registrada (modo de prueba: no salió a WhatsApp)." : "Plantilla enviada."));
        router.refresh();
      } else {
        setError(r.error);
      }
    } catch {
      setError("No pudimos confirmar el envío. Revisá la conversación antes de reintentar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <details open={abierta} className="group space-y-3">
      <summary className="cursor-pointer text-sm font-medium text-[var(--fo-text)]">Enviar una plantilla aprobada</summary>
      <form onSubmit={enviar} className="space-y-3 pt-2">
        <div className="space-y-1">
          <label htmlFor={idSelector} className="fo-label">
            Plantilla
          </label>
          <select id={idSelector} className="fo-input" value={clave} onChange={(ev) => elegir(ev.target.value)} disabled={enviando}>
            {plantillas.map((p) => (
              <option key={`${p.nombre}|${p.idioma}`} value={`${p.nombre}|${p.idioma}`}>
                {p.nombre.replace(/_/g, " ")} · {ETIQUETA_CATEGORIA[p.categoria]}
              </option>
            ))}
          </select>
        </div>

        {elegida ? (
          <>
            {elegida.variables > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {valores.map((v, i) => (
                  <label key={i} className="space-y-1 text-sm">
                    <span className="fo-label">Dato {`{{${i + 1}}}`}</span>
                    <input
                      className="fo-input"
                      value={v}
                      maxLength={200}
                      disabled={enviando}
                      placeholder={elegida.ejemplos[i] ? `Ej.: ${elegida.ejemplos[i]}` : undefined}
                      onChange={(ev) => setValores((prev) => prev.map((x, j) => (j === i ? ev.target.value : x)))}
                    />
                  </label>
                ))}
              </div>
            ) : null}
            {elegida.boton?.dinamico ? (
              <label className="block space-y-1 text-sm">
                <span className="fo-label">Final del enlace del botón «{elegida.boton.texto}»</span>
                <input className="fo-input" value={boton} maxLength={200} disabled={enviando} onChange={(ev) => setBoton(ev.target.value)} />
                <span className="block text-xs text-[var(--fo-muted)]">{urlDelBoton(elegida.boton.url, boton || "…")}</span>
              </label>
            ) : null}

            <div className="rounded-[var(--fo-radius)] border border-[var(--fo-accent-muted)] bg-[var(--fo-accent-soft)] px-3 py-2 text-sm" aria-label="Vista previa">
              {elegida.encabezado ? <p className="font-semibold text-[var(--fo-text)]">{elegida.encabezado}</p> : null}
              <p className="whitespace-pre-wrap break-words text-[var(--fo-text)]">{armarTexto(elegida.cuerpo, valores)}</p>
              {elegida.pie ? <p className="mt-1 text-xs text-[var(--fo-muted)]">{elegida.pie}</p> : null}
              {elegida.boton || elegida.otrosBotones.length > 0 ? (
                <p className="mt-2 text-xs font-medium text-[var(--fo-accent-hover)]">
                  {[elegida.boton?.texto, ...elegida.otrosBotones].filter(Boolean).map((t) => `[ ${t} ]`).join("  ")}
                </p>
              ) : null}
            </div>
            <p className="text-xs text-[var(--fo-muted)]">{AVISO_CATEGORIA[elegida.categoria]}</p>
          </>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {error}
          </p>
        ) : null}
        {aviso ? (
          <p role="status" className="text-sm text-[var(--fo-muted)]">
            {aviso}
          </p>
        ) : null}
        <div className="flex justify-end">
          <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={enviando || !completos}>
            {enviando ? "Enviando…" : "Enviar plantilla"}
          </button>
        </div>
      </form>
    </details>
  );
}
