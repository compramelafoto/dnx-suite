"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clasificarArchivo,
  comprimirImagen,
  copiarTexto,
  descargarTexto,
  mensajeResultado,
  validarCsv,
} from "@/lib/stock/importacion/archivo-cliente";
import { descargarCsvAction, importarArchivoAction, importarCsvAction, importarTextoAction } from "../actions";

/** Lo que devuelven las acciones de importar (mismo tipo que `ResultadoImportacion`, sin importar el módulo de servidor). */
type Resultado = Awaited<ReturnType<typeof importarCsvAction>>;

type Estado =
  | { tipo: "nada" }
  | { tipo: "error"; texto: string }
  | { tipo: "ok"; texto: string; noCuadra: boolean; proveedorDetectado: string | null }
  | { tipo: "info"; texto: string };

const SIN_IA = "La lectura con IA no está configurada.";
const MAX_TEXTO = 20000;

/**
 * «Importar desde factura o remito» (stock etapa 3), dentro del borrador de una recepción.
 * Tres caminos: una foto o PDF que se lee con IA, un texto pegado (también con IA) y la
 * plantilla CSV (completada a mano o con otro asistente, con las instrucciones copiables).
 * Lo leído se suma como líneas del borrador; las reglas viven en el servidor.
 *
 * Las fotos se achican en el navegador antes de mandarlas: la acción del servidor no acepta
 * pedidos de más de 4 MB (ver `lib/stock/importacion/archivo-cliente.ts`).
 */
export function ImportarSeccion({
  recepcionId,
  iaDisponible,
  plantillaCsv,
  promptExterno,
  deshabilitada,
}: {
  recepcionId: string;
  iaDisponible: boolean;
  plantillaCsv: string;
  promptExterno: string;
  deshabilitada: boolean;
}) {
  const router = useRouter();
  const [leyendo, startTransition] = useTransition();
  const [estado, setEstado] = useState<Estado>({ tipo: "nada" });
  const [texto, setTexto] = useState("");
  const [verTexto, setVerTexto] = useState(false);
  const [verPrompt, setVerPrompt] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const ocupado = leyendo || deshabilitada;

  function mostrar(r: Resultado) {
    if (!r.ok) {
      setEstado({ tipo: "error", texto: r.error });
      return;
    }
    setEstado({
      tipo: "ok",
      texto: mensajeResultado(r),
      noCuadra: !r.cuadra,
      proveedorDetectado: r.proveedorDetectado,
    });
  }

  function correr(accion: () => Promise<Resultado | { ok: false; error: string }>, alTerminar?: () => void) {
    setEstado({ tipo: "nada" });
    startTransition(async () => {
      try {
        const r = await accion();
        mostrar(r as Resultado);
        if (r.ok) {
          alTerminar?.();
          router.refresh();
        }
      } catch {
        setEstado({ tipo: "error", texto: "No se pudo enviar. Revisá la conexión y probá de nuevo." });
      }
    });
  }

  function elegirArchivo(archivo: File | undefined) {
    if (archivoRef.current) archivoRef.current.value = "";
    if (!archivo) return;
    const clase = clasificarArchivo(archivo);
    if (!clase.ok) {
      setEstado({ tipo: "error", texto: clase.error });
      return;
    }
    correr(async () => {
      let enviar: File = archivo;
      if (clase.clase === "imagen") {
        const c = await comprimirImagen(archivo);
        if (!c.ok) return c;
        enviar = c.file;
      }
      const fd = new FormData();
      fd.set("recepcionId", recepcionId);
      fd.set("file", enviar);
      return importarArchivoAction(fd);
    });
  }

  function elegirCsv(archivo: File | undefined) {
    if (csvRef.current) csvRef.current.value = "";
    if (!archivo) return;
    const v = validarCsv(archivo);
    if (!v.ok) {
      setEstado({ tipo: "error", texto: v.error });
      return;
    }
    correr(() => {
      const fd = new FormData();
      fd.set("recepcionId", recepcionId);
      fd.set("file", archivo);
      return importarCsvAction(fd);
    });
  }

  function leerTexto() {
    if (texto.trim() === "") {
      setEstado({ tipo: "error", texto: "Pegá el texto de la factura." });
      return;
    }
    correr(
      () => importarTextoAction(recepcionId, texto),
      () => {
        setTexto("");
        setVerTexto(false);
      },
    );
  }

  async function copiarInstrucciones() {
    const ok = await copiarTexto(promptExterno);
    setEstado(
      ok
        ? { tipo: "info", texto: "Instrucciones copiadas: pegalas en tu asistente de IA junto con la factura y subí el CSV que te devuelva." }
        : { tipo: "error", texto: "No se pudo copiar: seleccioná el texto de abajo y copialo a mano." },
    );
    if (!ok) setVerPrompt(true);
  }

  function descargarCsv() {
    startTransition(async () => {
      try {
        const r = await descargarCsvAction(recepcionId);
        if (!r.ok) {
          setEstado({ tipo: "error", texto: r.error });
          return;
        }
        descargarTexto(r.nombre, r.csv);
        setEstado({ tipo: "nada" });
      } catch {
        setEstado({ tipo: "error", texto: "No se pudo descargar. Probá de nuevo." });
      }
    });
  }

  return (
    <section className="fo-card space-y-4 p-4" aria-labelledby="importar-titulo">
      <div className="space-y-1">
        <h2 id="importar-titulo" className="text-base font-semibold text-[var(--fo-text)]">
          Importar desde factura o remito
        </h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Subí una foto o el PDF de la factura, pegá el texto o usá la plantilla CSV. Lo leído se suma a la lista de abajo
          para que lo revises antes de confirmar.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Con IA */}
        <div className="space-y-2">
          <p className="fo-label">Leer con IA</p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={archivoRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => elegirArchivo(e.target.files?.[0])}
            />
            <button
              type="button"
              className="fo-btn fo-btn-primary text-sm"
              disabled={ocupado || !iaDisponible}
              onClick={() => archivoRef.current?.click()}
            >
              Subir foto o PDF
            </button>
            <button
              type="button"
              className="fo-btn fo-btn-ghost text-sm"
              disabled={ocupado || !iaDisponible}
              onClick={() => setVerTexto((v) => !v)}
              aria-expanded={verTexto}
            >
              Pegar texto
            </button>
          </div>
          {iaDisponible ? (
            <p className="fo-helper">Foto, captura o PDF (hasta 4 MB). Las fotos se achican solas antes de mandarlas.</p>
          ) : (
            <p className="fo-helper">{SIN_IA}</p>
          )}
          {verTexto && iaDisponible ? (
            <div className="space-y-2">
              <textarea
                className="fo-input min-h-32 w-full"
                aria-label="Texto de la factura"
                placeholder="Pegá acá el mail o el detalle del pedido del proveedor"
                maxLength={MAX_TEXTO}
                value={texto}
                disabled={ocupado}
                onChange={(e) => setTexto(e.target.value)}
              />
              <div className="flex justify-end">
                <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={ocupado} onClick={leerTexto}>
                  Leer el texto
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Plantilla CSV */}
        <div className="space-y-2">
          <p className="fo-label">Con la plantilla CSV</p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={csvRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => elegirCsv(e.target.files?.[0])}
            />
            <button
              type="button"
              className="fo-btn fo-btn-primary text-sm"
              disabled={ocupado}
              onClick={() => csvRef.current?.click()}
            >
              Subir CSV
            </button>
            <button
              type="button"
              className="fo-btn fo-btn-ghost text-sm"
              onClick={() => descargarTexto("plantilla-recepcion.csv", plantillaCsv)}
            >
              Descargar plantilla CSV
            </button>
            <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={copiarInstrucciones}>
              Copiar instrucciones para la IA
            </button>
            <button type="button" className="fo-btn fo-btn-ghost text-sm" disabled={ocupado} onClick={descargarCsv}>
              Descargar CSV
            </button>
          </div>
          <p className="fo-helper">
            Completá la plantilla a mano o pasale la factura y las instrucciones a otro asistente de IA. «Descargar CSV» baja
            lo que ya está cargado, para corregirlo en una planilla.
          </p>
          {verPrompt ? (
            <textarea
              className="fo-input min-h-32 w-full text-xs"
              aria-label="Instrucciones para la IA"
              readOnly
              value={promptExterno}
              onFocus={(e) => e.currentTarget.select()}
            />
          ) : null}
        </div>
      </div>

      <div aria-live="polite">
        {leyendo ? (
          <p role="status" className="text-sm text-[var(--fo-muted)]">
            Leyendo…
          </p>
        ) : estado.tipo === "error" ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {estado.texto}
          </p>
        ) : estado.tipo === "info" ? (
          <p role="status" className="text-sm text-[var(--fo-success)]">
            {estado.texto}
          </p>
        ) : estado.tipo === "ok" ? (
          <div role="status" className="space-y-1 text-sm">
            <p className="text-[var(--fo-success)]">{estado.texto}</p>
            {estado.noCuadra ? (
              <p className="font-medium text-[var(--fo-warning)]">
                Lo leído no suma igual que el total de la factura: revisá las líneas.
              </p>
            ) : null}
            {estado.proveedorDetectado ? (
              <p className="text-[var(--fo-text)]">
                Proveedor detectado: {estado.proveedorDetectado}.{" "}
                <span className="text-[var(--fo-muted)]">
                  Elegilo arriba o, si no está, crealo en{" "}
                  <Link href="/workspace/configuracion/proveedores" className="underline">
                    Proveedores
                  </Link>
                  .
                </span>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
